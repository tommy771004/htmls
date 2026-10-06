# 入口：blender -b --factory-startup --python blender/build_heroes.py -- [--only goku,vegeta] [--preview out_dir] [--no-write]
# 讀 blender/rig.json（node tools/rig-dump.mjs 產生）→ 依 heroes.py 建模 → 綁骨刷權重 → 算遮蔽 → 寫 src/models-baked.js。
import base64
import json
import math
import os
import struct
import sys
import time
import zlib

import bpy
from mathutils import Vector

sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__))
if HERE not in sys.path:
    sys.path.insert(0, HERE)

import kit  # noqa: E402
import heroes  # noqa: E402

V = Vector
ROOT = os.path.dirname(HERE)
OUT_JS = os.path.join(ROOT, 'src', 'models-baked.js')
CACHE = os.path.join(HERE, 'out')


def args():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    o = {'only': None, 'preview': None, 'write': True}
    for k, a in enumerate(argv):
        if a == '--only':
            o['only'] = argv[k + 1].split(',')
        elif a == '--preview':
            o['preview'] = os.path.abspath(argv[k + 1])
        elif a == '--no-write':
            o['write'] = False
    return o


# ---------------------------------------------------------------- 編碼
def hex_of(c):
    return int(c) & 0xffffff


def oct_enc(n):
    x, y, z = n
    s = abs(x) + abs(y) + abs(z) or 1.0
    x, y, z = x / s, y / s, z / s
    if z < 0:
        x, y = (1 - abs(y)) * math.copysign(1, x), (1 - abs(x)) * math.copysign(1, y)
    q = lambda v: max(-127, min(127, int(round(v * 127))))
    return q(x), q(y)


def encode_mesh(ob, offset=V((0, 0, 0)), weights=None, ao=None):
    """欄位式串流（利於 zlib）：位置 3×u16 差分、法線 2×i8、pal、mat、ao、ol（外框倍率×100）各一欄 u8；
    蒙皮時再 4 欄骨索引 u8＋4 欄權重 u8；索引以差分 u16（或 u32）存。每欄補齊到 4 位元組。"""
    me = ob.data
    n = len(me.vertices)
    co = [V(v.co) - offset for v in me.vertices]
    lo = V((min(c.x for c in co), min(c.y for c in co), min(c.z for c in co)))
    hi = V((max(c.x for c in co), max(c.y for c in co), max(c.z for c in co)))
    sz = hi - lo
    sz = V((max(sz.x, 1e-6), max(sz.y, 1e-6), max(sz.z, 1e-6)))
    A = me.attributes
    pal = [d.value for d in A['pal'].data]
    mat = [d.value for d in A['mat'].data]
    ol = [max(0, min(255, int(round(d.value * 100)))) for d in A['ol'].data]
    nrm = A.get('nrm')
    nor = [oct_enc(nrm.data[i].vector if nrm else me.vertices[i].normal) for i in range(n)]
    idx = kit.triangles(ob)
    big = n > 65535
    flags = (1 if weights else 0) | (2 if big else 0)
    out = bytearray(struct.pack('<III3f3f', n, len(idx), flags, lo.x, lo.y, lo.z, sz.x, sz.y, sz.z))

    def col(fmt, vals):
        nonlocal out
        out += struct.pack('<%d%s' % (len(vals), fmt), *vals)
        while len(out) % 4:
            out += b'\0'
    for k in range(3):
        q = [int(round((c[k] - lo[k]) / sz[k] * 65535)) for c in co]
        col('H', [(q[i] - (q[i - 1] if i else 0)) & 0xffff for i in range(n)])
    col('b', [x for x, _ in nor])
    col('b', [y for _, y in nor])
    col('B', pal)
    col('B', mat)
    col('B', [int(round((ao[i] if ao else 1.0) * 255)) for i in range(n)])
    col('B', ol)
    if weights:
        W = []
        for w in weights:
            ws = w + [(0, 0.0)] * (4 - len(w))
            wq = [int(round(x * 255)) for _, x in ws]
            wq[0] += 255 - sum(wq)
            W.append(([b for b, _ in ws], wq))
        for k in range(4):
            col('B', [b[k] for b, _ in W])
        for k in range(4):
            col('B', [q[k] for _, q in W])
    m = 0xffffffff if big else 0xffff
    col('I' if big else 'H', [(idx[i] - (idx[i - 1] if i else 0)) & m for i in range(len(idx))])
    return bytes(out), len(idx) // 3


# ---------------------------------------------------------------- 預覽
def preview(objs, path, rig_h):
    """Workbench 快速算圖：正面、斜側、側面三格，給建模時檢查形體。"""
    scn = bpy.context.scene
    scn.render.engine = 'BLENDER_WORKBENCH'
    sh = scn.display.shading
    sh.light = 'STUDIO'
    sh.color_type = 'VERTEX'
    sh.show_object_outline = True
    sh.show_cavity = True
    sh.cavity_type = 'WORLD'
    scn.render.resolution_x = 520
    scn.render.resolution_y = 900
    scn.render.film_transparent = False
    scn.world = scn.world or bpy.data.worlds.new('w')
    cam_d = bpy.data.cameras.new('cam')
    cam_d.type = 'ORTHO'
    cam_d.ortho_scale = rig_h * 1.12
    cam = bpy.data.objects.new('cam', cam_d)
    scn.collection.objects.link(cam)
    scn.camera = cam
    shots = []
    for k, ang in enumerate((0, 35, 90, 180)):
        a = math.radians(ang)
        cam.location = V((math.sin(a) * 6, rig_h * 0.5, math.cos(a) * 6))
        # three 空間 +Y 向上：讓相機朝向原點、上方為 +Y
        d = (V((0, rig_h * 0.5, 0)) - cam.location).normalized()
        rt = d.cross(V((0, 1, 0))).normalized()
        uc = rt.cross(d)
        from mathutils import Matrix
        cam.matrix_world = Matrix.Translation(cam.location) @ Matrix((
            (rt.x, uc.x, -d.x, 0), (rt.y, uc.y, -d.y, 0), (rt.z, uc.z, -d.z, 0), (0, 0, 0, 1)))
        p = path.replace('.png', '_%d.png' % k)
        scn.render.filepath = p
        bpy.ops.render.render(write_still=True)
        shots.append(p)
    bpy.data.objects.remove(cam, do_unlink=True)
    return shots


def color_attr(ob, palette):
    """把 pal 索引轉成 Workbench 顯示用的顏色屬性。"""
    me = ob.data
    if 'Col' in me.color_attributes:
        me.color_attributes.remove(me.color_attributes['Col'])
    ca = me.color_attributes.new('Col', 'FLOAT_COLOR', 'POINT')
    P = me.attributes['pal'].data
    for i in range(len(me.vertices)):
        h = palette[P[i].value]
        if h < 0:
            h = 0x24a38f
        r, g, b = ((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255
        lin = lambda c: c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
        ca.data[i].color = (lin(r), lin(g), lin(b), 1)
    me.color_attributes.active_color = ca


# ---------------------------------------------------------------- 主流程
def build_one(hid, R, opt):
    t0 = time.time()
    kit.reset()
    H = heroes.build(hid, R)
    proxy_parts = [kit.duplicate(o, 'px') for o in H['proxy']]
    body = kit.join(H['body'], 'body')
    kit.decimate_keep(body, H.get('body_tris', 32000))
    kit.crisp_split(body)
    # 頭：各型態共用同一顆頭顱（取 base 的），髮型各自一張；只減髮束（單色），頭顱保留切好的上色邊界
    skull = H['heads']['base'][0]
    for f, objs in H['heads'].items():
        if f != 'base':
            bpy.data.objects.remove(objs[0], do_unlink=True)
    hairs = {}
    for f, objs in H['heads'].items():
        if objs[1:]:
            hairs[f] = kit.join(objs[1:], 'hair_' + f)
            kit.decimate_keep(hairs[f], H.get('hair_tris', 5200))
            kit.crisp_split(hairs[f])
    kit.crisp_split(skull)
    kit.face_normals(skull, H['head_center'], H['hr'])
    extras = {k: kit.join(v, k) if isinstance(v, list) else v for k, v in H.get('extras', {}).items()}
    bone_names = [b['name'] for b in R['bones']]
    arm = kit.build_armature([(b['name'], b['head'], b['tail'], b['parent']) for b in R['bones']])

    # 權重：在聯集代理體上算骨熱，再轉移到各部件。骨熱偶爾整體解不出來：換體素大小重試，最後退回膠囊距離權重
    from mathutils import Matrix
    src = kit.join(proxy_parts, 'proxy_src')
    proxy, cnt = None, {}
    for vox, tris_ in ((0.012, 24000), (0.01, 30000), (0.015, 18000)):
        if proxy is not None:
            bpy.data.objects.remove(proxy, do_unlink=True)
        proxy = kit.duplicate(src, 'proxy')
        m = proxy.modifiers.new('rm', 'REMESH')
        m.mode = 'VOXEL'
        m.voxel_size = vox
        kit.bake(proxy)
        kit.decimate(proxy, tris_)
        kit.transform(proxy, Matrix.Scale(10, 4))   # 骨熱在小尺度網格上常解不出來：放大 10 倍算再縮回
        arm10 = kit.build_armature([(b['name'], [x * 10 for x in b['head']], [x * 10 for x in b['tail']], b['parent']) for b in R['bones']])
        try:
            kit.heat_weights(proxy, arm10)
        except Exception as e:  # noqa: BLE001
            print('  骨熱例外', e)
        proxy.modifiers.clear()
        proxy.parent = None
        bpy.data.objects.remove(arm10, do_unlink=True)
        kit.transform(proxy, Matrix.Scale(0.1, 4))
        gi = {g.index: g.name for g in proxy.vertex_groups}
        cnt = {g.name: 0 for g in proxy.vertex_groups}
        for v in proxy.data.vertices:
            for g in v.groups:
                if g.weight > 0.5:
                    cnt[gi[g.group]] += 1
        main = [n for n in bone_names if not n[-1].isdigit()]
        if all(cnt.get(n, 0) > 0 for n in main):
            break
        print('  骨熱失敗（體素 %.3f），重試' % vox)
    else:
        print('  骨熱都失敗，改用膠囊距離權重')
        proxy.vertex_groups.clear()
        kit.capsule_weights(proxy, [(b['name'], b['head'], b['tail'], b['parent']) for b in R['bones'] if not b['name'][-1].isdigit()], H.get('radius', {}))
    print('  代理體 %d 頂點，各骨主導頂點數：%s' % (len(proxy.data.vertices), cnt))
    kit.transfer_weights(proxy, body, bone_names)
    W = kit.read_weights(body, bone_names, H['allow'])
    # 自訂權重（擺動鏈等）：grp → fn(co) → [(bone, w)]
    if H.get('custom'):
        G = body.data.attributes['grp'].data
        bidx = {n: i for i, n in enumerate(bone_names)}
        for i, v in enumerate(body.data.vertices):
            fn = H['custom'].get(G[i].value)
            if fn:
                # blend=True 的函式拿到原本的骨熱權重，可以只把一部分讓給擺動鏈
                ws = fn(V(v.co), [(bone_names[b], w) for b, w in W[i]]) if getattr(fn, 'blend', False) else fn(V(v.co))
                acc = {}
                for b, w in ws:
                    acc[b] = acc.get(b, 0) + w
                ws = sorted(acc.items(), key=lambda bw: -bw[1])[:4]
                tot = sum(w for _, w in ws) or 1
                W[i] = [(bidx[b], w / tot) for b, w in ws][:4]

    # 腳：腳踝以下整塊跟著腳踝骨，靴筒往上漸漸交回小腿（骨熱在腳掌這種小塊上分得很亂，直接依高度指定）
    if 'anL' in bone_names:
        G = body.data.attributes['grp'].data
        bidx = {n: i for i, n in enumerate(bone_names)}
        feet = {heroes.G_FOOT_L: ('knL', 'anL', 'toL'), heroes.G_FOOT_R: ('knR', 'anR', 'toR')}
        has_toe = 'toL' in bidx
        for i, v in enumerate(body.data.vertices):
            g = G[i].value
            fb = feet.get(g)
            if fb:
                ay = R['bones'][bidx[fb[1]]]['head'][1]
                k = kit.smooth(max(0.0, min(1.0, (ay + 0.045 - v.co.y) / 0.06)))
                ws = {fb[0]: 1 - k, fb[1]: k}
                if has_toe:
                    # 腳趾：腳掌前段（腳趾關節之前）漸漸交給腳趾骨
                    tz = R['bones'][bidx[fb[2]]]['head'][2]
                    t = kit.smooth(max(0.0, min(1.0, (v.co.z - (tz - 0.015)) / 0.03))) * k
                    ws = {fb[0]: 1 - k, fb[1]: k - t, fb[2]: t}
                W[i] = [(bidx[b], w) for b, w in ws.items() if w > 1e-4] or [(bidx[fb[0]], 1.0)]
            elif g in heroes.FINGER_BONE and heroes.FINGER_BONE[g] in bidx:
                W[i] = [(bidx[heroes.FINGER_BONE[g]], 1.0)]   # 手指每節剛性跟著自己的骨頭

    # 遮蔽（各髮型分開算，避免超級賽亞人的頭髮被基本髮型遮到）
    t1 = time.time()
    hb = hairs.get('base')
    aos = kit.ambient_occlusion([body, skull], [o for o in (body, skull, hb) if o])
    for f, ob in hairs.items():
        aos.update(kit.ambient_occlusion([ob], [body, skull, ob]))
    print('  遮蔽 %.1fs；權重骨群：%s' % (time.time() - t1, ','.join(sorted({g.name for g in body.vertex_groups}))))
    head_off = V(R['bones'][2]['head'])
    meshes = []
    bdata, bt = encode_mesh(body, weights=W, ao=aos[body.name])
    meshes.append(('body', bdata))
    tris = bt
    dd, t = encode_mesh(skull, offset=head_off, ao=aos[skull.name])
    meshes.append(('skull', dd))
    tris += t
    for f, ob in hairs.items():
        dd, t = encode_mesh(ob, offset=head_off, ao=aos[ob.name])
        meshes.append(('hair_' + f, dd))
        tris += t
    for k, ob in extras.items():
        dd, t = encode_mesh(ob)
        meshes.append((k, dd))
        tris += t
    print('%s：身體 %d 面、合計 %d 面、%.1fs' % (hid, bt, tris, time.time() - t0))

    if opt['preview']:
        os.makedirs(opt['preview'], exist_ok=True)
        for o in [body, skull] + list(hairs.values()) + list(extras.values()):
            color_attr(o, H['palette'].cols)
        for o in list(bpy.data.objects):
            if o.type == 'MESH' and o not in (body, skull, hairs.get('base')):
                o.hide_render = True
        preview([body], os.path.join(opt['preview'], hid + '.png'), R['H'] + 0.1)
        if 'ssj' in hairs:
            hairs['base'].hide_render = True
            hairs['ssj'].hide_render = False
            preview([body], os.path.join(opt['preview'], hid + '_ssj.png'), R['H'] + 0.1)

    return {
        'names': [n for n, _ in meshes],
        'pal': H['palette'].cols,
        'faceRect': H['faceRect'],
        'data': b''.join(d for _, d in meshes),
        'tris': tris,
    }


def main():
    opt = args()
    rig = json.load(open(os.path.join(HERE, 'rig.json')))
    ids = opt['only'] or list(rig['heroes'].keys())
    os.makedirs(CACHE, exist_ok=True)
    for hid in ids:
        res = build_one(hid, rig['heroes'][hid], opt)
        z = zlib.compress(res['data'], 9)
        rec = {'names': res['names'], 'pal': res['pal'], 'faceRect': res['faceRect'], 'rig': rig['heroes'][hid].get('rig', 1), 'data': base64.b64encode(z).decode()}
        json.dump(rec, open(os.path.join(CACHE, hid + '.json'), 'w'))
        print('  %s：%d KB（zlib）' % (hid, len(z) // 1024))
    if opt['write']:
        # 只重建部分英雄時，其他英雄沿用 blender/out 的快取；沒有快取就從現有的 models-baked.js 取回，避免把它們覆蓋掉
        prev = {}
        if os.path.exists(OUT_JS):
            import re
            m = re.search(r'export const BAKED = (.*);\s*$', open(OUT_JS).read(), re.S)
            if m:
                prev = json.loads(m.group(1))
        allh = {}
        for hid in rig['heroes'].keys():
            p = os.path.join(CACHE, hid + '.json')
            if os.path.exists(p):
                allh[hid] = json.load(open(p))
            elif hid in prev:
                allh[hid] = prev[hid]
            else:
                print('  警告：%s 沒有網格（請不加 --only 重建全部）' % hid)
        with open(OUT_JS, 'w') as f:
            f.write('// 由 blender/build_heroes.py 產生，請勿手改。英雄網格（Blender 建模、A 字綁定姿勢、量化＋zlib＋base64）。\n')
            f.write('export const BAKED = ' + json.dumps(allh, separators=(',', ':')) + ';\n')
        print('寫入', OUT_JS, '%d KB' % (os.path.getsize(OUT_JS) // 1024))


main()
