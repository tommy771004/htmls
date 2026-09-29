# 191 靜白之家：由手工標的 2D 對應點解出每張關鍵幀的相機（焦距、位置、朝向），並算重投影誤差
# 用法：python3 solve_cameras.py [--log "這一輪改了什麼"]
# 需要 numpy 與 opencv-python。輸出 cameras.json（網頁與 build_scene.py 讀取），--log 會把本輪結果追加到 iterations.json。
import json, math, os, sys, time
import numpy as np
import cv2
from scipy.optimize import least_squares

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from landmarks import load_params, landmarks  # noqa: E402

F0 = 230.0       # 焦距先驗（320 寬的縮圖上約等於手機主鏡頭 69° 水平視角）
PRIOR_W = 2.0    # 先驗權重（px²／ln 單位²）：共面或點少的幀靠它避免焦距亂跑
REDO_PX = 4.0    # 物件平均誤差超過這個像素值就標記為「重做」
FRAME_SEC = 44.445 / 9


def T3(v):
    """平面座標（x 東、y 北、z 上）→ three.js（x、y 上、z 南）"""
    return [float(v[0]), float(v[2]), float(-v[1])]


def quat_from_m(m):
    m = np.asarray(m, dtype=float)
    tr = m[0, 0] + m[1, 1] + m[2, 2]
    if tr > 0:
        s = math.sqrt(tr + 1.0) * 2
        w, x, y, z = 0.25 * s, (m[2, 1] - m[1, 2]) / s, (m[0, 2] - m[2, 0]) / s, (m[1, 0] - m[0, 1]) / s
    elif m[0, 0] > m[1, 1] and m[0, 0] > m[2, 2]:
        s = math.sqrt(1.0 + m[0, 0] - m[1, 1] - m[2, 2]) * 2
        w, x, y, z = (m[2, 1] - m[1, 2]) / s, 0.25 * s, (m[0, 1] + m[1, 0]) / s, (m[0, 2] + m[2, 0]) / s
    elif m[1, 1] > m[2, 2]:
        s = math.sqrt(1.0 + m[1, 1] - m[0, 0] - m[2, 2]) * 2
        w, x, y, z = (m[0, 2] - m[2, 0]) / s, (m[0, 1] + m[1, 0]) / s, 0.25 * s, (m[1, 2] + m[2, 1]) / s
    else:
        s = math.sqrt(1.0 + m[2, 2] - m[0, 0] - m[1, 1]) * 2
        w, x, y, z = (m[1, 0] - m[0, 1]) / s, (m[0, 2] + m[2, 0]) / s, (m[1, 2] + m[2, 1]) / s, 0.25 * s
    return [x, y, z, w]


def solve(frame, L, W, H, P):
    """只解相機（尺寸固定）：從 refine_scene.GUESS 的站位出發，最小化重投影誤差，並要求相機在屋內、手持高度"""
    from refine_scene import GUESS, look_rt, project, camera_penalty
    names = [n for n in frame['points'] if n in L]
    obj = np.array([L[n][1] for n in names], dtype=float)
    img = np.array([frame['points'][n] for n in names], dtype=float)
    cx, cy = W / 2, H / 2
    w, d = P['room']['w'], P['room']['d']
    rv0, tv0 = look_rt(*GUESS[frame['id']])

    def resid(c):
        rv, tv, f = c[:3], c[3:6], math.exp(c[6])
        pr, z = project(obj, rv, tv, f, cx, cy)
        Rm, _ = cv2.Rodrigues(rv)
        C = -Rm.T @ tv
        return np.concatenate([((pr - img) / 2.0).ravel(), [10.0 * max(0, 0.3 - zz) for zz in z],
                               camera_penalty(C, P) / 0.05, [math.log(f / F0) / 0.5]])

    sol = least_squares(resid, np.concatenate([rv0, tv0, [math.log(F0)]]), loss='soft_l1', f_scale=1.5, max_nfev=3000)
    rv, tv, f = sol.x[:3], sol.x[3:6], math.exp(sol.x[6])
    proj, _ = project(obj, rv, tv, f, cx, cy)
    e = np.linalg.norm(proj - img, axis=1)
    rms = float(np.sqrt((e ** 2).mean()))
    R, _ = cv2.Rodrigues(rv)
    C = (-R.T @ tv).ravel()
    right, down, fwd = R[0], R[1], R[2]
    # three.js 相機：本地 X=右、Y=上、Z=後
    m3 = np.column_stack([T3(right), T3(-down), T3(-fwd)])
    # Blender 相機（世界座標即平面座標）：本地 X=右、Y=上、Z=後
    mb = np.column_stack([right, -down, -fwd])
    pts = []
    for i, n in enumerate(names):
        pts.append({'name': n, 'obj': L[n][0], 'uv': [float(v) for v in img[i]],
                    'proj': [round(float(v), 2) for v in proj[i]], 'err': round(float(e[i]), 2)})
    objs = {}
    for p in pts:
        objs.setdefault(p['obj'], []).append(p['err'])
    people = {}
    for pid, (u, v) in frame.get('feet', {}).items():
        # 腳點反投影：相機中心沿該像素射線，和地板 z=0 相交
        ray = R.T @ np.array([(u - cx) / f, (v - cy) / f, 1.0])
        s = -C[2] / ray[2]
        people[pid] = [round(float(C[0] + ray[0] * s), 3), round(float(C[1] + ray[1] * s), 3)]
    idx = int(frame['cellref'].split('_')[0]) * 9 + int(frame['cellref'].split('_')[1])
    return {
        'id': frame['id'], 'title': frame['title'], 'cellref': frame['cellref'], 'time': round(idx * FRAME_SEC, 1),
        'image': 'frames/%s.jpg' % frame['id'],
        'f': round(float(f), 1), 'hfov': round(math.degrees(2 * math.atan(W / 2 / f)), 1),
        'vfov': round(math.degrees(2 * math.atan(H / 2 / f)), 2),
        'rms': round(rms, 2), 'n': len(names),
        'position': [round(float(v), 3) for v in C],
        'three': {'position': [round(v, 4) for v in T3(C)], 'quaternion': [round(v, 6) for v in quat_from_m(m3)]},
        'blender': {'location': [round(float(v), 4) for v in C], 'matrix3': [[round(float(v), 6) for v in row] for row in mb],
                    'lens36': round(float(f) / W * 36, 3)},
        'cv': {'rvec': [float(v) for v in rv], 'tvec': [float(v) for v in tv], 'f': float(f)},
        'points': pts,
        'people': people,
        'objects': {k: round(float(np.mean(v)), 2) for k, v in objs.items()},
    }


def main():
    P = load_params()
    L = landmarks(P)
    A = json.load(open(os.path.join(HERE, 'annotations.json'), encoding='utf-8'))
    W, H = A['image']
    frames = [solve(fr, L, W, H, P) for fr in A['frames']]
    agg = {}
    for fr in frames:
        for p in fr['points']:
            agg.setdefault(p['obj'], []).append(p['err'])
    objects = {k: {'mean': round(float(np.mean(v)), 2), 'max': round(float(np.max(v)), 2), 'n': len(v),
                   'redo': bool(np.mean(v) > REDO_PX)} for k, v in sorted(agg.items())}
    allerr = [p['err'] for fr in frames for p in fr['points']]
    out = {'version': P['version'], 'image': [W, H], 'threshold_px': REDO_PX, 'prior_f': F0,
           'rms_all': round(float(np.sqrt(np.mean(np.square(allerr)))), 2), 'frames': frames, 'objects': objects}
    json.dump(out, open(os.path.join(HERE, 'cameras.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    for fr in frames:
        worst = max(fr['points'], key=lambda p: p['err'])
        print('%s f=%5.1f hfov=%4.1f° rms=%5.2fpx  cam=(%.2f, %.2f, %.2f)  worst %s %.1fpx' % (
            fr['id'], fr['f'], fr['hfov'], fr['rms'], *fr['position'], worst['name'], worst['err']))
    print('objects:')
    for k, v in objects.items():
        print('  %-12s mean %5.2f max %5.2f n=%d%s' % (k, v['mean'], v['max'], v['n'], '  ← 重做' if v['redo'] else ''))
    print('rms all', out['rms_all'])
    if '--log' in sys.argv:
        note = sys.argv[sys.argv.index('--log') + 1]
        path = os.path.join(HERE, 'iterations.json')
        hist = json.load(open(path, encoding='utf-8')) if os.path.exists(path) else []
        hist.append({'version': P['version'], 'when': time.strftime('%Y-%m-%d %H:%M'), 'note': note, 'rms_all': out['rms_all'],
                     'frames': {fr['id']: fr['rms'] for fr in frames},
                     'objects': {k: v['mean'] for k, v in objects.items()},
                     'redo': [k for k, v in objects.items() if v['redo']]})
        json.dump(hist, open(path, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)


if __name__ == '__main__':
    main()
