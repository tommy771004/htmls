# 191 靜白之家：束調整（bundle adjustment）—同時微調每張關鍵幀的相機與場景尺寸，讓重建投影回影片的誤差最小
# 用法：python3 refine_scene.py [--redo]
#   不加參數：所有可調尺寸用正常先驗一起擬合
#   --redo：讀 cameras.json 裡被標成「重做」的物件，只放寬那些物件的尺寸先驗再擬合一次
# 結果寫回 scene_params.json（version +1，舊版另存 scene_params.v<N>.json），之後再跑 solve_cameras.py 產生相機與誤差報告。
import copy, json, math, os, sys
import numpy as np
import cv2
from scipy.optimize import least_squares

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from landmarks import load_params, landmarks  # noqa: E402

SIGMA_PX = 2.0   # 分鏡縮圖上手工標點的誤差（px）
F0 = 230.0

# 可調的尺寸：(路徑, 先驗標準差 m, 屬於哪件物件)
FREE = [
    (('room', 'd'), 0.5, 'shell'), (('room', 'w'), 0.3, 'shell'), (('ceiling', 'living_soffit'), 0.15, 'shell'),
    (('window', 'x0'), 0.3, 'window'), (('window', 'x1'), 0.3, 'window'), (('window', 'z0'), 0.06, 'window'), (('window', 'z1'), 0.15, 'window'),
    (('tv_wall', 'tv_yc'), 0.5, 'tv'), (('tv_wall', 'tv_zc'), 0.15, 'tv'), (('tv_wall', 'tv_w'), 0.15, 'tv'),
    (('tv_wall', 'plat_y0'), 0.4, 'tv_platform'), (('tv_wall', 'plat_y1'), 0.4, 'tv_platform'),
    (('tv_wall', 'plat_z0'), 0.05, 'tv_platform'), (('tv_wall', 'plat_z1'), 0.06, 'tv_platform'), (('tv_wall', 'plat_d'), 0.1, 'tv_platform'),
    (('sofa', 'x0'), 0.25, 'sofa'), (('sofa', 'y1'), 0.4, 'sofa'), (('sofa', 'seat'), 0.05, 'sofa'),
    (('kitchen', 'x0'), 0.3, 'kitchen'), (('kitchen', 'h'), 0.03, 'kitchen'),
    (('kitchen', 'upper_x0'), 0.3, 'kitchen'), (('kitchen', 'upper_x1'), 0.3, 'kitchen'),
    (('kitchen', 'upper_z0'), 0.15, 'kitchen'), (('kitchen', 'upper_z1'), 0.15, 'kitchen'),
    (('island', 'x0'), 0.25, 'island'), (('island', 'x1'), 0.25, 'island'), (('island', 'y0'), 0.2, 'island'),
    (('island', 'y1'), 0.2, 'island'), (('island', 'h'), 0.05, 'island'),
    (('entry_door', 'y'), 0.6, 'entry_door'), (('entry_door', 'x0'), 0.3, 'entry_door'), (('entry_door', 'x1'), 0.3, 'entry_door'),
    (('table', 'x0'), 0.3, 'table'), (('table', 'h'), 0.03, 'table'),
    (('pendants', 0, 'x'), 0.3, 'pendant0'), (('pendants', 0, 'y'), 0.3, 'pendant0'), (('pendants', 0, 'z'), 0.15, 'pendant0'),
    (('pendants', 1, 'x'), 0.3, 'pendant1'), (('pendants', 1, 'y'), 0.3, 'pendant1'), (('pendants', 1, 'z'), 0.15, 'pendant1'),
]

# 硬性範圍：擬合不能跑出物理上不合理的尺寸（中島不能伸進走廊、平台不能深過 60 cm 等）
BOUNDS = {
    ('room', 'd'): (9.5, 11.5), ('room', 'w'): (4.3, 5.0), ('ceiling', 'living_soffit'): (2.4, 2.75),
    ('window', 'x0'): (0.3, 2.0), ('window', 'x1'): (2.6, 4.3), ('window', 'z0'): (0.0, 0.2), ('window', 'z1'): (2.2, 2.7),
    ('tv_wall', 'plat_d'): (0.3, 0.6), ('tv_wall', 'plat_z0'): (0.05, 0.3), ('tv_wall', 'plat_z1'): (0.3, 0.55),
    ('sofa', 'x0'): (3.3, 3.9), ('sofa', 'y1'): (8.4, 9.85), ('sofa', 'seat'): (0.36, 0.48),
    ('tv_wall', 'plat_y0'): (3.3, 6.0), ('tv_wall', 'plat_y1'): (8.6, 10.1),
    ('kitchen', 'x0'): (1.6, 2.4), ('kitchen', 'upper_z0'): (1.3, 1.7), ('kitchen', 'upper_z1'): (1.9, 2.45),
    ('island', 'x0'): (2.5, 3.6), ('island', 'x1'): (3.6, 4.05), ('island', 'y0'): (1.2, 1.9), ('island', 'y1'): (1.9, 2.5), ('island', 'h'): (0.85, 1.05),
    ('entry_door', 'y'): (0.0, 1.6), ('entry_door', 'x0'): (0.45, 1.2), ('entry_door', 'x1'): (1.1, 2.0),
    ('table', 'x0'): (0.9, 2.2), ('table', 'h'): (0.7, 0.78),
    ('pendants', 0, 'x'): (1.0, 3.4), ('pendants', 0, 'y'): (1.4, 2.9), ('pendants', 0, 'z'): (1.4, 2.1),
    ('pendants', 1, 'x'): (1.0, 3.4), ('pendants', 1, 'y'): (1.4, 2.9), ('pendants', 1, 'z'): (1.4, 2.1),
}

# 相對約束 a ≤ b − 間距：物件不能穿過會一起變動的牆（違反時以 1 cm 為單位強力懲罰）
RELATIONS = [
    (('sofa', 'y1'), ('room', 'd'), 0.06), (('tv_wall', 'plat_y1'), ('room', 'd'), 0.3),
    (('window', 'x1'), ('room', 'w'), 0.25), (('island', 'x1'), ('room', 'w'), 0.2),
    (('sofa', 'x0'), ('room', 'w'), 0.85), (('kitchen', 'upper_x1'), ('kitchen', 'tall_x0'), 0.0),
    (('entry_door', 'x1'), ('kitchen', 'x0'), 0.1), (('table', 'x0'), ('island', 'x0'), 0.9),
]

# 每張關鍵幀的初始相機猜測（依畫面內容判斷站位與朝向）：位置、看向的點
GUESS = {
    'f112': ((2.3, 4.2, 1.25), (2.3, 10.4, 1.2)),
    'f094': ((2.1, 6.6, 1.3), (2.1, 10.4, 1.3)),
    'f050': ((3.9, 7.4, 1.15), (0.0, 7.4, 1.0)),
    'f016': ((1.0, 0.5, 1.5), (1.6, 10.4, 1.3)),
    'f081': ((3.3, 9.4, 1.3), (1.9, 0.0, 1.2)),
    'f053': ((2.4, 3.3, 1.45), (2.6, 0.0, 1.2)),
    'f041': ((0.8, 3.5, 1.55), (3.4, 1.0, 1.0)),
    'f052': ((3.6, 5.6, 1.4), (2.4, 0.0, 1.0)),
}


FRESH = sys.argv[sys.argv.index('--fresh') + 1].split(',') if '--fresh' in sys.argv else []


def get(P, path):
    for k in path:
        P = P[k]
    return P


def put(P, path, v):
    for k in path[:-1]:
        P = P[k]
    P[path[-1]] = v


def look_rt(pos, target):
    """位置 + 看向點 → OpenCV 的 rvec、tvec（相機 x 右、y 下、z 前；世界 z 朝上）"""
    C = np.array(pos, float)
    fwd = np.array(target, float) - C
    fwd /= np.linalg.norm(fwd)
    right = np.cross(fwd, [0, 0, 1.0])
    right /= np.linalg.norm(right)
    down = np.cross(fwd, right)
    R = np.stack([right, down, fwd])
    rv, _ = cv2.Rodrigues(R)
    return rv.ravel(), (-R @ C).ravel()


def camera_penalty(C, P):
    """相機位置的軟限制（公尺）：要在屋內、手持高度，而且不能在家具裡面"""
    w, d = P['room']['w'], P['room']['d']
    out = [max(0, 0.15 - C[0]), max(0, C[0] - (w - 0.15)), max(0, 0.15 - C[1]), max(0, C[1] - (d - 0.15)),
           max(0, 0.7 - C[2]), max(0, C[2] - 1.85)]
    K, I, S, SH = P['kitchen'], P['island'], P['sofa'], P['shoe']
    keep_out = [(0, SH['d'] + 0.1, 0, SH['y1']), (K['x0'], w, 0, K['d'] + 0.1), (I['x0'] - 0.1, I['x1'] + 0.1, I['y0'] - 0.1, I['y1'] + 0.1),
                (S['x0'] - 0.1, w, S['y0'], S['y1'])]
    for (x0, x1, y0, y1) in keep_out:
        inside = min(C[0] - x0, x1 - C[0], C[1] - y0, y1 - C[1])
        out.append(max(0.0, inside))
    return np.array(out)


def project(X, rv, tv, f, cx, cy):
    R, _ = cv2.Rodrigues(rv)
    Xc = X @ R.T + tv
    z = np.maximum(Xc[:, 2], 1e-3)
    return np.stack([f * Xc[:, 0] / z + cx, f * Xc[:, 1] / z + cy], 1), Xc[:, 2]


def run(P0, A, sig_scale):
    W, H = A['image']
    cx, cy = W / 2, H / 2
    frames = A['frames']
    free = [(p, s * sig_scale.get(o, 1.0), o) for p, s, o in FREE]
    th0 = np.array([get(P0, p) for p, _, _ in free], float)
    sig = np.array([s for _, s, _ in free], float)
    cams = []
    prev = {}
    cp = os.path.join(HERE, 'cameras.json')
    if os.path.exists(cp):
        prev = {c['id']: c['cv'] for c in json.load(open(cp, encoding='utf-8'))['frames'] if 'cv' in c}
    for fr in frames:
        if fr['id'] in prev and fr['id'] not in FRESH:
            c = prev[fr['id']]
            cams.append(np.concatenate([c['rvec'], c['tvec'], [math.log(c['f'])]]))
        else:
            rv, tv = look_rt(*GUESS[fr['id']])
            cams.append(np.concatenate([rv, tv, [math.log(F0)]]))
    x0 = np.concatenate([th0] + cams)
    nθ = len(th0)
    R_, D_ = P0['room'], None

    def unpack(x):
        P = copy.deepcopy(P0)
        for (p, _, _), v in zip(free, x[:nθ]):
            put(P, p, float(v))
        return P

    def resid(x):
        P = unpack(x)
        L = landmarks(P)
        r = [(x[:nθ] - th0) / sig]
        r.append([max(0.0, get(P, a) - (get(P, b) - gap)) / 0.01 for a, b, gap in RELATIONS])
        w, d = P['room']['w'], P['room']['d']
        for i, fr in enumerate(frames):
            c = x[nθ + 7 * i: nθ + 7 * i + 7]
            rv, tv, f = c[:3], c[3:6], math.exp(c[6])
            names = [n for n in fr['points'] if n in L]
            X = np.array([L[n][1] for n in names], float)
            uv = np.array([fr['points'][n] for n in names], float)
            pr, z = project(X, rv, tv, f, cx, cy)
            r.append(((pr - uv) / SIGMA_PX).ravel())
            r.append([10.0 * max(0, 0.3 - zz) for zz in z])  # 地標必須在相機前方
            Rm, _ = cv2.Rodrigues(rv)
            C = -Rm.T @ tv
            r.append(camera_penalty(C, P) / 0.05)
            r.append([math.log(f / F0) / 0.5])
        return np.concatenate([np.ravel(a) for a in r])

    lo = np.full(len(x0), -np.inf)
    hi = np.full(len(x0), np.inf)
    for i, (p, _, _) in enumerate(free):
        if tuple(p) in BOUNDS:
            lo[i], hi[i] = BOUNDS[tuple(p)]
    x0 = np.clip(x0, lo + 1e-6, hi - 1e-6)
    sol = least_squares(resid, x0, bounds=(lo, hi), loss='soft_l1', f_scale=1.5, max_nfev=20000, x_scale='jac')
    return unpack(sol.x), sol


def main():
    P0 = load_params()
    A = json.load(open(os.path.join(HERE, 'annotations.json'), encoding='utf-8'))
    scale = {}
    if '--redo' in sys.argv:
        cams = json.load(open(os.path.join(HERE, 'cameras.json'), encoding='utf-8'))
        redo = [k for k, v in cams['objects'].items() if v['redo']]
        scale = {k: 3.0 for k in redo}
        print('重做（放寬先驗 ×3）：', redo or '無')
    P, sol = run(P0, A, scale)
    print('cost %.2f → %.2f, nfev %d' % (sol.cost if False else 0, sol.cost, sol.nfev))
    for p, _, o in FREE:
        a, b = get(P0, p), get(P, p)
        if abs(a - b) >= 0.005:
            print('  %-28s %6.2f → %6.2f' % ('.'.join(map(str, p)), a, b))
    for p, _, _ in FREE:
        put(P, p, round(get(P, p), 2))
    P['tv_wall']['tv_h'] = round(P['tv_wall']['tv_w'] * 9 / 16 + 0.02, 3)
    json.dump(P0, open(os.path.join(HERE, 'scene_params.v%d.json' % P0['version']), 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
    P['version'] = P0['version'] + 1
    json.dump(P, open(os.path.join(HERE, 'scene_params.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
    print('scene_params.json → version', P['version'])


if __name__ == '__main__':
    main()
