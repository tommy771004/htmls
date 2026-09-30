# 190 封頂：雙旋翼起重直升機與七種工地機具 → machines.glb
# 重建：/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P assets/190/build_machines.py
#   環境變數 PREVIEW=資料夾 會另存預覽圖；GLB=路徑 改寫到別處（驗證用）
# 車輛原點在地面中心、車頭朝 +z，外形尺寸對齊網頁裡的碰撞盒。材質叫 paint 的部分由網頁換車身色，
# 皮卡的 glass 材質由網頁畫成半透明；其他機具的玻璃是 fixed 的深色頂點色。
# 細節：板件縫、螺栓、油壓缸（鍍鉻桿、油管、銷座）、履帶板與支重輪、格柵、燈具、後照鏡、踏板扶手、
# 排氣管、警示斜紋（頂點色）、靠近地面的泥污漸層，最後烘焙 AO（含臨時地面）。
import sys, os, math
sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lb_lib import *

import lb_lib


def finish(bm, name, role, color, at=(0, 0, 0), rot=None, smooth=True, var=0.0, seed=0):
    """同 lb_lib.finish，但在 recalc 前先更新法線：否則繞 x 軸轉過的零件會整個翻成朝內（背面剔除後看起來是破的）"""
    R = rot_m(rot)
    at = Vector(at)
    for v in bm.verts:
        v.co = V(*(R @ Vector(v.co) + at))
    bm.normal_update()
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    me.materials.append(mat(role if role in ROLES or role == 'glass' else 'fixed'))
    for p in me.polygons:
        p.use_smooth = smooth
    c = (1.0, 1.0, 1.0) if role in ROLES else hexrgb(color)
    paint(ob, lambda p, n: tuple(max(0, min(1, x * (1 + noise.noise(p * 9 + Vector((seed, seed * 2, 3))) * var))) for x in c))
    return ob


lb_lib.finish = finish   # lb_lib 的 box / lathe / tube / loft 也改用這一版

HERE = os.path.dirname(os.path.abspath(__file__))
PREVIEW = os.environ.get('PREVIEW')
reset()
bpy.context.scene.world.light_settings.distance = 0.8

OUT, BAKE = [], []
YEL, YELD, DARK, RUB, CHROME, GLASS = 0xe8ad18, 0xb8860f, 0x2c2d2f, 0x1c1d1f, 0xc9cdd0, 0x2e3b44
STEEL, BLK, SEAMY, LENS, AMB, REDL = 0x5d6064, 0x1b1c1e, 0x6b4c0c, 0xf6f3e6, 0xf29a1a, 0xb8231b
DIRT = 0x6e5d47
HAZ = (0xf0b418, 0x1d1d1d)


def sub(p, o):
    return (p[0] + o[0], p[1] + o[1], p[2] + o[2])


def lerp3(a, b, t):
    return tuple(a[i] + (b[i] - a[i]) * t for i in range(3))


# ───────── 幾何小工具 ─────────
def slice_bm(bm, step, axes=(0, 1, 2)):
    """用平面切開大面，讓 AO 與泥污漸層有足夠頂點"""
    for ax in axes:
        cs = [v.co[ax] for v in bm.verts]
        lo, hi = min(cs), max(cs)
        n = int((hi - lo) / step)
        no = [0, 0, 0]; no[ax] = 1
        for i in range(1, n + 1):
            co = [0, 0, 0]; co[ax] = lo + (hi - lo) * i / (n + 1)
            bmesh.ops.bisect_plane(bm, geom=list(bm.verts) + list(bm.edges) + list(bm.faces), dist=1e-5, plane_co=co, plane_no=no)
    return bm


def boxs(name, role, color, c, s, bevel=.02, rot=None, seg=1, step=.6, var=.04, smooth=False):
    return finish(slice_bm(bm_box(s, bevel, seg), step), name, role, color, c, rot, smooth, var)


def bm_boxes(lst):
    bm = bmesh.new()
    for (c, s) in lst:
        r = bmesh.ops.create_cube(bm, size=1.0)
        for v in r['verts']:
            v.co = Vector((v.co.x * s[0] + c[0], v.co.y * s[1] + c[1], v.co.z * s[2] + c[2]))
    return bm


def boxes(name, role, color, lst, at=(0, 0, 0), rot=None, var=.03):
    return finish(bm_boxes(lst), name, role, color, at, rot, False, var)


def _align(a, b):
    a, b = Vector(a), Vector(b)
    d = b - a
    q = Vector((0, 0, 1)).rotation_difference(d.normalized())
    return Matrix.Translation((a + b) / 2) @ q.to_matrix().to_4x4(), d.length


def bm_cyls(lst, seg=12):
    """lst=[(a, b, r)]：一組圓柱併成一個 bmesh"""
    bm = bmesh.new()
    for (a, b, r) in lst:
        m, L = _align(a, b)
        bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=seg, radius1=r, radius2=r, depth=L, matrix=m)
    return bm


def cyls(name, role, color, lst, seg=12, var=.03, smooth=True):
    return finish(bm_cyls(lst, seg), name, role, color, (0, 0, 0), None, smooth, var)


def bolts(pts, axis, r=.022, l=.025, col=STEEL):
    """六角螺栓頭：pts 為螺栓底座中心，axis 為朝外方向"""
    ax = Vector(axis).normalized()
    return cyls('bt', 'fixed', col, [(p, tuple(Vector(p) + ax * l), r) for p in pts], 6, .02, smooth=False)


def seams(lst, col=SEAMY):
    """板件縫：[(中心, 尺寸)] 的細長深色條"""
    return boxes('sm', 'fixed', col, lst, var=0)


def clip_poly(poly, a, b, c):
    """保留 a*u + b*v <= c 的部分"""
    out = []
    for i in range(len(poly)):
        P, Q = poly[i], poly[(i + 1) % len(poly)]
        fp, fq = a * P[0] + b * P[1] - c, a * Q[0] + b * Q[1] - c
        if fp <= 0:
            out.append(P)
        if (fp > 0) != (fq > 0) and fp != fq:
            t = fp / (fp - fq)
            out.append((P[0] + (Q[0] - P[0]) * t, P[1] + (Q[1] - P[1]) * t))
    res = []
    for p in out:
        if not res or abs(p[0] - res[-1][0]) + abs(p[1] - res[-1][1]) > 1e-5:
            res.append(p)
    if len(res) > 1 and abs(res[0][0] - res[-1][0]) + abs(res[0][1] - res[-1][1]) < 1e-5:
        res.pop()
    return res


def hazard(c, w, h, rot=None, p=.22, t=.01, cols=HAZ):
    """警示斜紋貼片：本地 xy 平面、面向 +z，rot 轉到車身表面"""
    rect = [(-w / 2, -h / 2), (w / 2, -h / 2), (w / 2, h / 2), (-w / 2, h / 2)]
    parts = []
    k0 = int(math.floor((-w / 2 - h / 2) / (p / 2))) - 1
    k1 = int(math.ceil((w / 2 + h / 2) / (p / 2))) + 1
    for k in range(k0, k1):
        a0 = k * p / 2
        poly = clip_poly(clip_poly(rect, -1, -1, -a0), 1, 1, a0 + p / 2)
        if len(poly) < 3:
            continue
        area = sum(poly[i][0] * poly[(i + 1) % len(poly)][1] - poly[(i + 1) % len(poly)][0] * poly[i][1] for i in range(len(poly)))
        if abs(area) < 1e-5:
            continue
        if area < 0:
            poly = poly[::-1]
        bm = bmesh.new()
        bm.faces.new([bm.verts.new((u, v, t * .4)) for (u, v) in poly])
        ob = finish(bm, 'hz', 'fixed', cols[k % 2], c, rot, smooth=False, var=.03)
        want = V(*(rot_m(rot) @ Vector((0, 0, 1))))
        if ob.data.polygons[0].normal.dot(want) < 0:
            ob.data.flip_normals()
        parts.append(ob)
    return parts


FACE = {'+z': (math.pi / 2, 0, 0), '-z': (-math.pi / 2, 0, 0), '+x': (0, 0, -math.pi / 2), '-x': (0, 0, math.pi / 2), '+y': None, '-y': (math.pi, 0, 0)}
DECAL = {'+z': None, '-z': (0, math.pi, 0), '+x': (0, math.pi / 2, 0), '-x': (0, -math.pi / 2, 0)}


def lamp(c, r, face='+z', lens=LENS, housing=BLK, depth=.08):
    """圓燈：燈殼 + 燈罩（燈罩取名 GL_ 不上泥）"""
    rot = FACE[face]
    h = lathe('lh', 'fixed', housing, [(r * .85, -depth), (r * 1.12, -depth * .5), (r * 1.15, 0), (r * 1.05, .012), (r * .95, .012)], c, 14, rot=rot)
    l = lathe('GL_lens', 'fixed', lens, [(r * .96, 0), (r * .8, .025), (.001, .034)], c, 14, rot=rot, var=0)
    return [h, l]


def rlamp(c, s, face='+z', lens=LENS, housing=BLK):
    """方燈：燈框 + 燈面"""
    rot = DECAL[face]
    return [boxs('rh', 'fixed', housing, c, (s[0] + .04, s[1] + .04, .06), 0, rot, 1, 9),
            finish(bm_boxes([((0, 0, .025), (s[0], s[1], .03))]), 'GL_rl', 'fixed', lens, c, rot, False, 0)]


def beacon(c, r=.07, col=AMB):
    return [lathe('bb', 'fixed', BLK, [(r * 1.2, 0), (r * 1.25, .03), (r * 1.05, .04)], c, 12, cap_bot=True),
            lathe('GL_bc', 'fixed', col, [(r, .04), (r, .1), (r * .8, .15), (.001, .165)], c, 12, var=0)]


def mirror(a, b, s=(.08, .26, .16), col=BLK):
    """後照鏡：從 a 伸到 b 的支架 + 鏡殼"""
    return [tube('ma', 'fixed', col, [a, b], .014, 6), boxs('mh', 'fixed', col, b, s, .02, None, 1, 9),
            boxs('GL_mg', 'fixed', 0x9aa6ad, sub(b, (0, 0, -s[2] / 2 - .004)), (s[0] * .8, s[1] * .85, .01), .002, None, 1, 9, var=0)]


def glass(name, c, s, role='fixed', bevel=0, rot=None, top=0x6c8594, bot=0x1d262c):
    """玻璃：上亮下暗的天空反射漸層"""
    ob = boxs('GL_' + name, role, GLASS, c, s, bevel, rot, 1, 9, var=0)
    y0 = c[1] - s[1] / 2
    ct, cb = hexrgb(top), hexrgb(bot)
    paint(ob, lambda p, n: lerp3(cb, ct, max(0, min(1, (p.y - y0) / max(s[1], .01)))) if role != 'glass' else (1, 1, 1))
    return ob


def grille(c, w, h, n, face='+z', frame=BLK, slat=0x3a3c3f, depth=.05):
    """格柵：外框 + 水平葉片（本地面向 +z）"""
    lst = [((0, h / 2 - .02, 0), (w, .04, depth)), ((0, -h / 2 + .02, 0), (w, .04, depth)),
           ((w / 2 - .02, 0, 0), (.04, h, depth)), ((-w / 2 + .02, 0, 0), (.04, h, depth))]
    sl = [((0, -h / 2 + .04 + (h - .08) * (i + .5) / n, .0), (w - .06, (h - .08) / n * .45, depth * .7)) for i in range(n)]
    rot = DECAL[face]
    return [boxes('gf', 'fixed', frame, lst, c, rot), boxes('gs', 'fixed', slat, sl, c, (rot[0] + .0, rot[1], rot[2]) if rot else None),
            boxes('gb', 'fixed', 0x121314, [((0, 0, -depth * .45), (w - .06, h - .06, .01))], c, rot, 0)]


def handrail(pts, h=.8, col=YEL, r=.022):
    out = [tube('hp', 'fixed', col, [p, (p[0], p[1] + h, p[2])], r, 8) for p in pts]
    out.append(tube('hr', 'fixed', col, [(p[0], p[1] + h, p[2]) for p in pts], r * 1.1, 8))
    return out


def catmull(pts, n=6):
    P = [Vector(p) for p in pts]
    P = [P[0] * 2 - P[1]] + P + [P[-1] * 2 - P[-2]]
    out = []
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
        for k in range(n):
            t = k / n
            out.append(tuple(.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3)))
    out.append(tuple(P[-2]))
    return out


def hose(pts, r=.022, col=0x141516):
    return tube('hs', 'fixed', col, catmull(pts, 5), r, 6)


def ram(a, b, r, body=YEL, eye_axis=(1, 0, 0), ext=.55, hoses=True):
    """油壓缸：缸筒 + 端蓋 + 鍍鉻活塞桿 + 兩端銷座 + 油管接頭"""
    A, B = Vector(a), Vector(b)
    d = (B - A).normalized()
    m = A + (B - A) * ext
    ex = Vector(eye_axis)
    out = [cyls('rb', 'fixed', body, [(tuple(A + d * r * .6), tuple(m), r)], 14),
           cyls('rc', 'fixed', DARK, [(tuple(m - d * .04), tuple(m + d * .03), r * 1.08), (tuple(A + d * r * .6), tuple(A + d * (r * .6 + .05)), r * 1.08)], 14),
           cyls('rr', 'fixed', CHROME, [(tuple(m), tuple(B - d * r * .6), r * .52)], 12, 0),
           cyls('re', 'fixed', DARK, [(tuple(A - ex * r * .75), tuple(A + ex * r * .75), r * .72), (tuple(B - ex * r * .75), tuple(B + ex * r * .75), r * .62)], 12)]
    if hoses:
        side = d.cross(ex).normalized()
        if side.y < 0:
            side = -side
        h0 = A + d * .15 + side * r * 1.05
        h1 = m - d * .1 + side * r * 1.05
        out += [cyls('hf', 'fixed', STEEL, [(tuple(h0 - side * r * .3), tuple(h0 + side * .04), r * .22), (tuple(h1 - side * r * .3), tuple(h1 + side * .04), r * .22)], 6),
                tube('hl', 'fixed', 0x141516, [tuple(h0 + side * .04), tuple(h0 + side * .05 + d * .1), tuple(h1 + side * .05 - d * .1), tuple(h1 + side * .04)], r * .16, 6)]
    return out


def pin(c, axis_len, r, col=DARK, axis=(1, 0, 0)):
    ax = Vector(axis) * axis_len / 2
    return cyls('pn', 'fixed', col, [(tuple(Vector(c) - ax), tuple(Vector(c) + ax), r)], 14)


def exhaust(base, top, r=.06, cap=True):
    out = [cyls('eb', 'fixed', 0x2a2b2d, [(base, sub(base, (0, .08, 0)), r * 1.5)], 12),
           cyls('ex', 'fixed', 0x3d3b39, [(base, top, r)], 12)]
    if cap:
        out.append(boxs('ec', 'fixed', 0x262728, sub(top, (0, .02, -r * .3)), (r * 2.3, .02, r * 2.4), .005, (-.35, 0, 0), 1, 9))
    return out


def fin_lathe(name, role, color, prof, c, seg, axis_x=1, var=.03, **kw):
    """繞 x 軸的旋轉體（輪胎、滾輪）；axis_x=±1 決定外側方向"""
    return lathe(name, role, color, prof, c, seg, rot=(0, 0, -axis_x * math.pi / 2), var=var, **kw)


# ───────── 輪胎與輪圈 ─────────
def wheel(O, c, r, w, rim=0x8c8f91, lug='block', nlug=18, spokes=0, tread=None):
    """輪子（輪軸沿 x）：胎身 + 胎紋塊 + 輪圈 + 輪轂螺帽；輪圈在外側（x 同號方向）"""
    x, y, z = sub(O, c)
    s = 1 if x >= 0 else -1
    t = r * (tread or (.06 if lug == 'chevron' else (.035 if lug else .0)))   # 胎紋厚
    seg = 32 if r > .6 else 24
    R = r - t
    prof = [(R * .62, -w / 2 + .01), (R * .9, -w / 2), (R * .98, -w / 2 + .03), (R, -w / 2 + .07), (R, w / 2 - .07), (R * .98, w / 2 - .03), (R * .9, w / 2), (R * .62, w / 2 - .01), (R * .62, -w / 2 + .01)]
    out = [fin_lathe('tire', 'fixed', RUB, prof, (x, y, z), seg, s, .05, cap_top=False, cap_bot=False)]
    # 胎紋塊：人字紋（工程車，V 形後掠）或交錯塊（一般車）；塊的底面跟著胎肩的弧度往下，不會懸空
    shoulder = sorted((abs(q[1]), q[0]) for q in prof[1:4])      # (|側向位置|, 半徑)：胎面 → 胎肩

    def prof_r(lx):
        ax = abs(lx)
        if ax <= shoulder[0][0]:
            return shoulder[0][1]
        for (a0, r0), (a1, r1) in zip(shoulder, shoulder[1:]):
            if ax <= a1:
                return r0 + (r1 - r0) * (ax - a0) / (a1 - a0)
        return shoulder[-1][1]
    bm = bmesh.new()
    for i in range(nlug if lug else 0):
        for side in (-1, 1):
            a = i / nlug * TAU + (TAU / nlug / 2 if (side > 0 and lug != 'chevron') else 0)
            cz, ww = side * w * .23, w * .42
            ln = TAU * R / nlug * (.42 if lug != 'chevron' else .32)
            r_ = bmesh.ops.create_cube(bm, size=1.0)
            inner = [f for f in bm.faces if all(v in r_['verts'] for v in f.verts) and all(v.co.y < 0 for v in f.verts)]
            bmesh.ops.delete(bm, geom=inner, context='FACES_ONLY')
            for v in r_['verts']:
                lx, lr, lz = v.co.x * ww + cz, v.co.y * t, v.co.z * ln
                ang = a + lz / R + (abs(lx) * .8 / R if lug == 'chevron' else 0)
                rr = prof_r(lx) + t / 2 + lr
                v.co = Vector((lx, math.cos(ang) * rr, math.sin(ang) * rr))
    if lug:
        out.append(finish(bm, 'lug', 'fixed', 0x19191a, (x, y, z), None, False, .05))
    else:
        bm.free()
    # 輪圈：碟形 + 輪轂 + 螺帽
    ri = R * .62
    rp = [(ri, -w / 2 + .03), (ri * .97, 0), (ri * .9, w * .3), (ri * .55, w * .28), (ri * .35, w * .36), (ri * .2, w * .4), (.001, w * .4)]
    out.append(fin_lathe('rim', 'fixed', rim, rp, (x, y, z), 18, s, .02, cap_top=True, cap_bot=True))
    nn = 6 if r < .45 else (8 if r < .6 else 10)
    bp = []
    for i in range(nn):
        a = i / nn * TAU
        bp.append((x + s * w * .32, y + math.sin(a) * ri * .42, z + math.cos(a) * ri * .42))
    out.append(bolts(bp, (s, 0, 0), r * .045, r * .05, 0x4a4d50))
    if spokes:
        sp = []
        for i in range(spokes):
            a = (i + .5) / spokes * TAU
            sp.append(((0, math.sin(a) * ri * .72, math.cos(a) * ri * .72), (.02, ri * .16, ri * .3)))
        hole = boxes('rh', 'fixed', 0x151617, sp, (x + s * w * .305, y, z))
        out.append(hole)
    return out


def arc_fender(O, c, r, w, a0, a1, col=BLK, th=.03, role='fixed'):
    """車輪上的圓弧擋泥板（在 yz 平面、以 c 為圓心）"""
    x, y, z = sub(O, c)
    pts_o, pts_i = [], []
    n = 12
    secs = []
    for i in range(n + 1):
        a = a0 + (a1 - a0) * i / n
        cz, cy = math.sin(a), math.cos(a)
        secs.append([(x - w / 2, y + cy * r, z + cz * r), (x + w / 2, y + cy * r, z + cz * r), (x + w / 2, y + cy * (r + th), z + cz * (r + th)), (x - w / 2, y + cy * (r + th), z + cz * (r + th))])
    return loft('fd', role, col, secs, smooth=False)


# ───────── 履帶 ─────────
def stadium_path(L, h, rp, n):
    """回傳沿跑道形的 n 個點：(z, y, 外法線角)"""
    r = h / 2
    straight = L - h
    P = 2 * straight + TAU * rp
    out = []
    for i in range(n):
        s = P * i / n
        if s < straight:                 # 上段往後
            out.append((straight / 2 - s, r + rp, 0.0))
        elif s < straight + math.pi * rp:
            a = (s - straight) / rp
            out.append((-straight / 2 - math.sin(a) * rp, r + math.cos(a) * rp, -a))
        elif s < 2 * straight + math.pi * rp:
            s2 = s - straight - math.pi * rp
            out.append((-straight / 2 + s2, r - rp, -math.pi))
        else:
            a = (s - 2 * straight - math.pi * rp) / rp
            out.append((straight / 2 + math.sin(a) * rp, r - math.cos(a) * rp, math.pi - a))
    return out, P


def stadium_ring(x0, x1, L, h, r_in, r_out, n=10):
    """跑道形環帶（履帶鏈條），在 x0..x1 之間"""
    rr = h / 2
    st = L - h
    def pts(rad):
        out = []
        for i in range(n + 1):
            a = -math.pi / 2 + math.pi * i / n
            out.append((st / 2 + math.cos(a) * rad, rr + math.sin(a) * rad))
        for i in range(n + 1):
            a = math.pi / 2 + math.pi * i / n
            out.append((-st / 2 + math.cos(a) * rad, rr + math.sin(a) * rad))
        return out
    po, pi_ = pts(r_out), pts(r_in)
    bm = bmesh.new()
    rings = []
    for (xx, rad) in ((x0, 'o'), (x1, 'o'), (x1, 'i'), (x0, 'i')):
        src = po if rad == 'o' else pi_
        rings.append([bm.verts.new((xx, yy, zz)) for (zz, yy) in src])
    m = len(po)
    for k in range(4):
        A, B = rings[k], rings[(k + 1) % 4]
        for i in range(m):
            j = (i + 1) % m
            bm.faces.new((A[i], A[j], B[j], B[i]))
    return bm


def track(O, x, w, L, h, frame_col=DARK, nroll=5):
    ox, oy, oz = O
    X = ox + x
    r = h / 2
    rp = r - .03
    out = []
    # 履帶板（含履齒），沿整圈排列
    pitch = .25
    n = int(round((2 * (L - h) + TAU * rp) / pitch))
    pts, P = stadium_path(L, h, rp, n)
    bm = bmesh.new()
    for (zz, yy, ang) in pts:
        M = Matrix.Translation((0, yy, zz)) @ Matrix.Rotation(ang, 4, 'X')
        for (c, s) in (((0, 0, 0), (w + .02, .045, P / n * .9)), ((0, .035, 0), (w + .02, .03, .035))):
            rr_ = bmesh.ops.create_cube(bm, size=1.0)
            for v in rr_['verts']:
                v.co = M @ Vector((v.co.x * s[0] + c[0], v.co.y * s[1] + c[1], v.co.z * s[2] + c[2]))
    out.append(finish(bm, 'sh', 'fixed', 0x2b2b2c, (X, oy, oz), None, False, .06))
    # 鏈條兩側環帶 + 鏈節銷
    for sx in (-1, 1):
        out.append(finish(stadium_ring(sx * w * .2 - .035, sx * w * .2 + .035, L, h, rp - .12, rp - .03), 'lk', 'fixed', 0x3a3a3b, (X, oy, oz), None, False, .05))
    # 支重輪、托輪、導輪、驅動輪
    ry = .03 + .03 + .08 + h * .12
    rl = []
    for i in range(nroll):
        zz = -(L - h) / 2 + h * .2 + (L - h - h * .4) * i / (nroll - 1)
        rl.append(((X - w * .3, ry, oz + zz), (X + w * .3, ry, oz + zz), h * .12))
    out.append(cyls('rl', 'fixed', 0x404143, [(sub(a, (0, oy, 0)), sub(b, (0, oy, 0)), rr * 1.08) for (a, b, rr) in rl], 10))
    cy_ = h - .03 - .12 - .06
    out.append(cyls('cr', 'fixed', 0x404143, [((X - w * .25, oy + cy_, oz + zz), (X + w * .25, oy + cy_, oz + zz), .06) for zz in (-(L - h) * .2, (L - h) * .25)], 12))
    ri = rp - .12
    fz, bz = oz + (L - h) / 2, oz - (L - h) / 2
    out.append(cyls('id', 'fixed', 0x46484b, [((X - w * .36, oy + r, fz), (X + w * .36, oy + r, fz), ri)], 20))
    out.append(cyls('ih', 'fixed', 0x2f3032, [((X - w * .42, oy + r, fz), (X + w * .42, oy + r, fz), ri * .45)], 12))
    out.append(cyls('sp', 'fixed', 0x46484b, [((X - w * .3, oy + r, bz), (X + w * .3, oy + r, bz), ri * .92)], 20))
    teeth = []
    for i in range(13):
        a = i / 13 * TAU
        teeth.append(((0, math.cos(a) * ri, math.sin(a) * ri), (w * .16, .06, .07)))
    tb = bm_boxes(teeth)
    out.append(finish(tb, 'st', 'fixed', 0x55575a, (X, oy + r, bz), None, False, .03))
    sgn = -1 if x > 0 else 1   # 驅動馬達在內側
    out.append(cyls('mt', 'fixed', 0x35363a, [((X + sgn * w * .3, oy + r, bz), (X + sgn * (w * .5 + .12), oy + r, bz), ri * .6)], 16))
    out.append(bolts([(X - sgn * w * .3, oy + r + math.sin(i / 8 * TAU) * ri * .5, bz + math.cos(i / 8 * TAU) * ri * .5) for i in range(8)], (-sgn, 0, 0), .02, .02))
    # 履帶架（中間大梁）與上方護板
    out.append(boxs('tf', 'fixed', frame_col, (X, oy + r, oz), (w * .38, h * .42, L - h * 1.05), .03, None, 1, .5))
    out.append(boxs('tg', 'fixed', frame_col, (X, oy + r + h * .23, oz), (w * .48, .04, L - h * 1.2), .01, None, 1, .5))
    return out


# ───────── 駕駛室 ─────────
def cabin(O, c, s, body, bevel=.06, roof=None, glass_sides=(1, 1, 1, 1), gr='fixed', door=(1,), lights=True, beacon_at=None, wipers=True):
    """駕駛室：下半殼、四角柱、車頂、四面玻璃（上亮下暗）、門縫與門把、雨刷、頂燈"""
    x, y, z = sub(O, c)
    w, h, d = s
    role, col = body
    out = [boxs('cb', role, col, (x, y + h * .22, z), (w, h * .44, d), bevel, None, 2, .35),
           boxs('cr', role, col, (x, y + h - .04, z), (w, .08, d), bevel * .6, None, 2, .4)]
    pl = []
    for sx in (1, -1):
        for sz in (1, -1):
            pl.append(((x + sx * (w / 2 - .045), y + h * .72, z + sz * (d / 2 - .045)), (.09, h * .56, .09)))
    out.append(boxes('pl', role, col, pl))
    # 窗框（深色細框）
    gy, gh = y + h * .72, h * .52
    f, b, l, r = glass_sides
    if f: out.append(glass('gf', (x, gy, z + d / 2 - .03), (w - .1, gh, .03), gr))
    if b: out.append(glass('gb', (x, gy, z - d / 2 + .03), (w - .1, gh, .03), gr))
    if l: out.append(glass('gl', (x + w / 2 - .03, gy, z), (.03, gh, d - .1), gr))
    if r: out.append(glass('gr', (x - w / 2 + .03, gy, z), (.03, gh, d - .1), gr))
    fr = [((x, y + h * .44 + .015, z + d / 2 - .02), (w - .06, .03, .03)), ((x, y + h * .44 + .015, z - d / 2 + .02), (w - .06, .03, .03)),
          ((x + w / 2 - .02, y + h * .44 + .015, z), (.03, .03, d - .06)), ((x - w / 2 + .02, y + h * .44 + .015, z), (.03, .03, d - .06))]
    out.append(boxes('fr', 'fixed', BLK, fr))
    if roof:
        out.append(boxs('rf', 'fixed', roof, (x, y + h + .02, z), (w + .06, .05, d + .06), .02, None, 2, .4))
    for sx in (door if isinstance(door, tuple) else ((door,) if door else ())):
        dx = x + sx * (w / 2 + .002)
        out.append(seams([((dx, y + h * .22, z + d * .38), (.006, h * .4, .012)), ((dx, y + h * .22, z - d * .38), (.006, h * .4, .012)), ((dx, y + .03, z), (.006, .012, d * .76))], 0x151515))
        out.append(boxs('dh', 'fixed', BLK, (x + sx * (w / 2 + .02), y + h * .38, z - d * .28), (.03, .04, .14), .01, None, 1, 9))
    if wipers and f:
        for sx in (-.2, .25):
            out.append(tube('wp', 'fixed', BLK, [(x + sx * w, gy - gh * .45, z + d / 2 + .005), (x + sx * w - .08, gy + gh * .25, z + d / 2 + .005)], .01, 4))
    if lights:
        for sx in (1, -1):
            out += rlamp((x + sx * w * .32, y + h + .09, z + d / 2 - .06), (.16, .09), '+z')
            out.append(boxs('lb', 'fixed', BLK, (x + sx * w * .32, y + h + .05, z + d / 2 - .1), (.05, .05, .05), .01, None, 1, 9))
    if beacon_at is not None:
        out += beacon(sub((x, y + h + .045, z), beacon_at))
    return out


def railings(O, pts, h=.9, col=0x1f1f1f):
    return handrail([sub(O, p) for p in pts], h, col)


def beam_path(pts, w, h, color, role='fixed'):
    secs = []
    for k, p in enumerate(pts):
        t = (Vector(pts[min(k + 1, len(pts) - 1)]) - Vector(pts[max(k - 1, 0)])).normalized()
        up = Vector((0, 1, 0))
        n = (up - t * up.dot(t)).normalized()
        side = t.cross(n).normalized()
        ww, hh = (w[k], h[k]) if isinstance(w, list) else (w, h)
        P = Vector(p)
        secs.append([tuple(P + side * sx * ww / 2 + n * sy * hh / 2) for (sx, sy) in ((-1, -1), (1, -1), (1, 1), (-1, 1))])
    return loft('bm', role, color, secs, smooth=False)


def beam_plates(pts, w, h, color, inset=.03):
    """箱型梁兩側的補強板（略寬，稍短）"""
    ww = [x + .03 for x in w] if isinstance(w, list) else w + .03
    hh = [x - inset * 2 for x in h] if isinstance(h, list) else h - inset * 2
    P = [tuple(Vector(pts[0]).lerp(Vector(pts[1]), .12))] + list(pts[1:-1]) + [tuple(Vector(pts[-1]).lerp(Vector(pts[-2]), .12))]
    return beam_path(P, ww, hh, color)


def along(pts, t):
    """折線上比例 t 的點"""
    P = [Vector(p) for p in pts]
    segs = [(P[i + 1] - P[i]).length for i in range(len(P) - 1)]
    L = sum(segs) * t
    for i, sl in enumerate(segs):
        if L <= sl or i == len(segs) - 1:
            return tuple(P[i].lerp(P[i + 1], min(1, L / sl)))
        L -= sl


def offset_path(pts, h, gap):
    """沿梁的上表面（與 beam_path 同一個法線）偏移的折線"""
    out = []
    for k, p in enumerate(pts):
        t = (Vector(pts[min(k + 1, len(pts) - 1)]) - Vector(pts[max(k - 1, 0)])).normalized()
        up = Vector((0, 1, 0))
        n = (up - t * up.dot(t)).normalized()
        out.append(tuple(Vector(p) + n * (h[k] / 2 + gap)))
    return out


def bucket(C, W, prof_out, prof_in, col, rot=None):
    """鏟斗殼：外弧 + 內弧圍成的截面沿 x 擠出，兩端封成側板"""
    poly = prof_out + list(reversed(prof_in))
    secs = [[(xx, yy, zz) for (yy, zz) in poly] for xx in (-W / 2, W / 2)]
    return finish(bm_loft(secs), 'bk', 'fixed', col, C, rot, False, .05)


# ───────── 風化與收尾 ─────────
def weather(ob, h1=1.0, amt=.55, ground=0.0, dirt=DIRT, blot=.12):
    """靠近地面的泥污漸層 + 大尺度色斑（不動玻璃與燈罩）"""
    me = ob.data
    col = me.color_attributes['Col']
    nv = len(me.vertices)
    a = np.zeros(nv * 4, dtype=np.float32)
    col.data.foreach_get('color', a)
    a = a.reshape(-1, 4)
    co = np.zeros(nv * 3, dtype=np.float32)
    me.vertices.foreach_get('co', co)
    co = co.reshape(-1, 3)
    M = np.array(ob.matrix_world)
    w = co @ M[:3, :3].T + M[:3, 3]
    ty = w[:, 2] - ground
    t = np.clip((h1 - ty) / h1, 0, 1) ** 1.7 * amt
    nz = np.array([noise.noise(Vector((w[i, 0] * 1.3, w[i, 1] * 1.3, w[i, 2] * 2.2))) for i in range(nv)], dtype=np.float32)
    t = np.clip(t * (.75 + nz * .7), 0, 1)[:, None]
    d = np.array([srgb2lin(c) for c in hexrgb(dirt)], dtype=np.float32)
    a[:, :3] = a[:, :3] * (1 - t) + d * t
    a[:, :3] *= (1 - blot * np.clip(nz * .5 + .5, 0, 1))[:, None] ** 1.0
    col.data.foreach_set('color', a.ravel())


def done(name, parts, origin, deg=35, h1=1.0, amt=.55, ground=0.0):
    parts = [p for p in parts if p]
    clean = [p for p in parts if p.name.startswith('GL_')]
    rest = [p for p in parts if not p.name.startswith('GL_')]
    ob = join(rest, name + '_tmp')
    if amt > 0:
        weather(ob, h1, amt, ground)
    ob = join([ob] + clean, name)
    smooth_by_angle(ob, deg)
    origin_to(ob, origin)
    OUT.append(ob); BAKE.append(ob)
    return ob


# ═════════ 挖土機（下部 + 可旋轉的上部，上部原點在迴轉中心 y=1）═════════
O = (0, 0, 0)
eb = track(O, 1.25, .62, 4.6, .85, nroll=7) + track(O, -1.25, .62, 4.6, .85, nroll=7) + [
    boxs('cb', 'fixed', DARK, (0, .5, 0), (1.9, .5, 1.7), .08),
    boxs('xf', 'fixed', DARK, (0, .45, 0), (2.2, .32, .9), .04),
    cyls('sr', 'fixed', 0x3a3b3d, [((0, .75, 0), (0, 1.0, 0), .8)], 32),
    cyls('sb', 'fixed', 0x2a2b2c, [((0, .9, 0), (0, .98, 0), .84)], 32),
    cyls('sj', 'fixed', 0x4a4c4f, [((0, .75, 0), (0, .35, 0), .22)], 12),
]
eb.append(bolts([(math.sin(i / 20 * TAU) * .76, 1.0, math.cos(i / 20 * TAU) * .76) for i in range(20)], (0, 1, 0), .02, .015))
for sx in (1, -1):
    eb.append(hose([(sx * .2, .7, -.3), (sx * .7, .55, -.9), (sx * .95, .5, -1.6)], .025))
done('V_exc_base', eb, O, h1=.9, amt=.65)

U = (0, 1, 0)
up = [
    boxs('dk', 'fixed', 0x303134, sub(U, (0, .1, -.35)), (2.52, .2, 3.02), .03),
    boxs('bd', 'fixed', YEL, sub(U, (0, .62, -.35)), (2.5, .96, 3.0), .1, None, 2, .35),
    boxs('cw', 'fixed', YELD, sub(U, (0, .6, -1.9)), (2.5, 1.2, .55), .25, None, 4, .35, smooth=True),
    boxs('hd', 'fixed', YEL, sub(U, (-.35, 1.13, -.9)), (1.7, .1, 1.6), .04, None, 2, .35),
]
# 板件縫：側門、引擎蓋
up.append(seams([(sub(U, (-1.252, .62, z)), (.006, .82, .012)) for z in (-1.6, -.9, -.2, .5)] +
                [(sub(U, (1.252, .62, z)), (.006, .82, .012)) for z in (-1.6, -.9)] +
                [(sub(U, (-.35, 1.183, z)), (1.6, .006, .012)) for z in (-.5, -1.3)] +
                [(sub(U, (0, .15, 1.152)), (2.4, .012, .006))]))
up += grille(sub(U, (-1.262, .62, -1.25)), .55, .6, 8, '-x')
up.append(boxes('lv', 'fixed', 0x2e2f31, [((-.35 + (i - 3) * .12, 1.185, -1.25), (.06, .015, .55)) for i in range(7)], U))
for sx in (1, -1):
    up.append(boxs('dh', 'fixed', BLK, sub(U, (sx * 1.27, .82, -1.25)), (.03, .05, .12), .01, None, 1, 9))
# 配重：斜紋與尾燈
up += hazard(sub(U, (0, .7, -2.18)), 1.9, .26, DECAL['-z'])
for sx in (1, -1):
    up += rlamp(sub(U, (sx * .8, .42, -2.18)), (.14, .1), '-z', REDL)
up.append(boxs('cm', 'fixed', BLK, sub(U, (0, 1.22, -2.0)), (.12, .08, .1), .01, None, 1, 9))
up += exhaust(sub(U, (-.8, 1.1, -1.2)), sub(U, (-.8, 1.55, -1.2)), .06)
up.append(cyls('ac', 'fixed', 0x2d2e30, [(sub(U, (.1, 1.18, -1.45)), sub(U, (.1, 1.42, -1.45)), .14)], 14))
up.append(lathe('acp', 'fixed', 0x3a3b3d, [(.15, 0), (.1, .06), (.001, .08)], sub(U, (.1, 1.42, -1.45)), 14))
# 駕駛室
up += cabin(U, (.72, 1.1, .55), (1.0, 1.65, 1.35), ('fixed', YEL), roof=0x2a2b2d, door=1, beacon_at=(-.25, 0, -.4))
up.append(boxes('gd', 'fixed', 0x1f1f1f, [((.72, 1.1 + 1.65 * .72, 1.25), (.9, .03, .03))] + [((.72 + (i - 1.5) * .26, 1.1 + 1.65 * .72, 1.25), (.03, .85, .03)) for i in range(4)], U))
up += mirror(sub(U, (1.22, 2.2, 1.1)), sub(U, (1.24, 2.35, 1.2)), (.05, .2, .12))
up += mirror(sub(U, (-1.1, 1.9, .9)), sub(U, (-1.12, 2.05, .95)), (.05, .2, .12))
# 扶手與踏板
up += handrail([sub(U, p) for p in [(-1.12, 1.2, -1.65), (-1.12, 1.2, -.6), (-1.12, 1.2, .35), (-.75, 1.2, .95)]], .7, YEL, .02)
up.append(boxs('wl', 'fixed', BLK, sub(U, (-.3, 1.25, .95)), (.08, .08, .08), .01, None, 1, 9))
up += lamp(sub(U, (-.3, 1.3, 1.0)), .05, '+z')
# 大臂：箱型梁 + 補強板 + 雙油壓缸 + 油管
BP = [sub(U, (-.3, 1.0, 1.0)), sub(U, (-.3, 2.6, 2.4)), sub(U, (-.3, 3.6, 3.5)), sub(U, (-.3, 3.9, 4.3))]
up.append(beam_path(BP, [.52, .5, .46, .42], [.7, .62, .56, .5], YEL))
up.append(beam_plates(BP, [.52, .5, .46, .42], [.7, .62, .56, .5], YELD))
AP = [sub(U, (-.3, 3.95, 4.2)), sub(U, (-.3, 3.1, 5.4)), sub(U, (-.3, 1.7, 6.5))]
up.append(beam_path(AP, [.38, .36, .32], [.46, .42, .36], YEL))
up.append(beam_plates(AP, [.38, .36, .32], [.46, .42, .36], YELD))
up.append(pin(sub(U, (-.3, 1.0, 1.0)), .66, .12))
up.append(pin(sub(U, (-.3, 3.95, 4.25)), .56, .11))
up.append(boxs('ah', 'fixed', YEL, sub(U, (-.3, 4.22, 4.38)), (.34, .5, .42), .04, (-.5, 0, 0), 1, 9))
up.append(pin(sub(U, (-.3, 4.45, 4.5)), .4, .07))
for sx in (1, -1):
    up += ram(sub(U, (-.3 + sx * .2, .6, .9)), sub(U, (-.3 + sx * .2, 2.55, 2.75)), .085)
up += ram(sub(U, (-.3, 3.1, 3.2)), sub(U, (-.3, 4.45, 4.5)), .085)
up += ram(sub(U, (-.3, 4.05, 4.55)), sub(U, (-.3, 2.25, 6.25)), .07, ext=.5)
HP = offset_path(BP, [.7, .62, .56, .5], .035)
for sx in (1, -1):
    up.append(hose([sub(p, (sx * .1, 0, 0)) for p in HP[1:]] + [sub(U, (-.3 + sx * .1, 4.15, 4.6))], .025))
up.append(boxes('hc', 'fixed', BLK, [(along(HP[1:], t), (.28, .05, .07)) for t in (.15, .5, .85)]))
# 鏟斗（彎殼 + 齒 + 連桿）
bk = sub(U, (-.3, 1.3, 6.6))
PO = [(.08, -.22), (.02, .18), (-.22, .42), (-.5, .42), (-.7, .24), (-.76, .02)]
PI = [(.02, -.18), (-.03, .12), (-.23, .34), (-.47, .35), (-.64, .2), (-.7, .02)]
up.append(bucket(bk, 1.0, PO, PI, 0x3a3b3d))
up.append(boxs('be', 'fixed', 0x55575a, sub(bk, (0, -.74, .03)), (1.02, .06, .1), .01, None, 1, 9))
for i in range(5):
    up.append(boxs('tt', 'fixed', 0x9a9c9e, sub(bk, (-.4 + i * .2, -.8, -.06)), (.08, .16, .08), .015, (-.6, 0, 0), 1, 9))
up.append(boxes('lk', 'fixed', DARK, [((sx * .2, 0, 0), (.04, .07, .5)) for sx in (1, -1)], sub(bk, (0, .12, -.1)), (.7, 0, 0)))
up.append(pin(sub(bk, (0, .05, -.1)), .5, .07))
done('V_exc_upper', up, U, h1=.5, amt=.25, ground=1.0)

# ═════════ 推土機 ═════════
O = (8, 0, 0)
dz = track(O, 1.2, .65, 3.8, .9, nroll=5) + track(O, -1.2, .65, 3.8, .9, nroll=5) + [
    boxs('bd', 'fixed', YEL, sub(O, (0, .95, .6)), (1.8, 1.0, 2.3), .1, None, 2, .35),
    boxs('hd', 'fixed', YEL, sub(O, (0, 1.45, .7)), (1.5, .25, 2.0), .1, None, 2, .35),
    boxs('rr', 'fixed', YELD, sub(O, (0, .9, -1.35)), (2.2, 1.0, 1.1), .1, None, 2, .35),
]
for sx in (1, -1):
    dz.append(boxs('fd', 'fixed', YEL, sub(O, (sx * 1.2, .93, -.1)), (.7, .04, 3.0), .01, None, 1, .5))
    dz += grille(sub(O, (sx * .905, 1.0, .7)), 1.1, .55, 7, '+x' if sx > 0 else '-x')
    dz.append(boxs('dh', 'fixed', BLK, sub(O, (sx * .92, .9, 1.35)), (.03, .05, .12), .01, None, 1, 9))
dz.append(seams([(sub(O, (sx * .902, .95, z)), (.006, .9, .012)) for sx in (1, -1) for z in (-.05, 1.45)] + [(sub(O, (0, 1.577, z)), (1.3, .006, .012)) for z in (.1, 1.2)]))
dz += grille(sub(O, (0, 1.05, 1.76)), 1.5, .8, 9, '+z')
dz.append(boxes('rg', 'fixed', 0x2a2b2d, [((0, .1, 0), (1.62, .06, .08)), ((.78, -.1, 0), (.06, .9, .08)), ((-.78, -.1, 0), (.06, .9, .08))] + [((x, -.1, .02), (.035, .8, .03)) for x in (-.45, -.15, .15, .45)], sub(O, (0, 1.05, 1.8))))
for sx in (1, -1):
    dz += lamp(sub(O, (sx * .55, 1.66, 1.62)), .07, '+z')
    dz.append(boxs('lm', 'fixed', BLK, sub(O, (sx * .55, 1.6, 1.55)), (.06, .06, .08), .01, None, 1, 9))
dz += exhaust(sub(O, (.5, 1.575, 1.2)), sub(O, (.5, 2.25, 1.2)), .06)
dz.append(cyls('pc', 'fixed', 0x2d2e30, [(sub(O, (-.4, 1.575, 1.3)), sub(O, (-.4, 1.95, 1.3)), .09)], 14))
dz.append(lathe('pcc', 'fixed', 0x9aa0a4, [(.12, 0), (.12, .1), (.001, .13)], sub(O, (-.4, 1.95, 1.3)), 14))
dz += cabin(O, (0, 1.9, -1.15), (1.8, 1.55, 1.3), ('fixed', YEL), roof=YEL, door=1, beacon_at=(.6, 0, -.4))
for sx in (1, -1):
    dz += rlamp(sub(O, (sx * .6, 3.53, -1.8)), (.16, .09), '-z')
dz += mirror(sub(O, (.92, 2.9, -.55)), sub(O, (.98, 3.0, -.45)), (.05, .18, .1))
dz += handrail([sub(O, p) for p in [(.95, 1.45, -1.85), (.95, 1.45, -.55)]], .8, BLK, .02)
dz.append(boxes('st', 'fixed', 0x3a3b3d, [((1.2, .55, -1.35), (.34, .03, .25))], O))
dz += hazard(sub(O, (0, 1.22, -1.905)), 1.8, .24, DECAL['-z'])
for sx in (1, -1):
    dz += rlamp(sub(O, (sx * .85, 1.05, -1.905)), (.12, .12), '-z', REDL)
# 推土鏟：弧形鏟面 + 背肋 + 刀刃螺栓 + 角刀
arc = [(math.sin(t) * .35, .15 + t * .85, 2.85 - (1 - math.cos(t)) * .45) for t in [i / 8 * 1.6 for i in range(9)]]
blade = []
for x in (-1.72, 1.72):
    front = [sub(O, (x, p[1], p[2])) for p in arc]
    back = [sub(O, (x, p[1], p[2] - .14)) for p in reversed(arc)]
    blade.append(front + back)
bl = loft('bl', 'fixed', YELD, blade, smooth=False)
dz.append(bl)
dz.append(boxs('ce', 'fixed', 0x8a8c8e, sub(O, (0, .12, 2.92)), (3.44, .1, .12), .01, None, 1, .5))
dz.append(bolts([sub(O, (x * .25, .12, 2.98)) for x in range(-6, 7)], (0, 0, 1), .018, .012))
for sx in (1, -1):
    dz.append(boxs('eb', 'fixed', 0x6a6c6e, sub(O, (sx * 1.62, .22, 2.9)), (.2, .3, .14), .01, None, 1, 9))
for x in (-1.35, -.7, 0, .7, 1.35):
    dz.append(loft('rb', 'fixed', YELD, [[sub(O, (x + dx, p[1], p[2] - .14 - dd)) for (dx, dd) in ((-.04, 0), (.04, 0), (.04, .13), (-.04, .13))] for p in arc[1:-1]], smooth=False))
dz.append(boxs('sg', 'fixed', YELD, sub(O, (0, 1.53, 2.35)), (3.2, .06, .18), .01, None, 1, .5))
for sx in (1, -1):
    dz.append(beam_path([sub(O, (sx * 1.2, .7, .8)), sub(O, (sx * 1.2, .55, 2.6))], .18, .22, YEL))
    dz.append(lathe('tb', 'fixed', DARK, [(.001, -.1), (.1, -.06), (.12, 0), (.1, .06), (.001, .1)], sub(O, (sx * 1.2, .7, .8)), 12, rot=(0, 0, math.pi / 2)))
    dz += ram(sub(O, (sx * .7, 1.5, 1.4)), sub(O, (sx * .7, 1.12, 2.45)), .08, hoses=False)
dz += ram(sub(O, (.95, .75, 1.3)), sub(O, (1.35, 1.3, 2.5)), .06, hoses=False)
# 松土器
dz.append(boxs('rp', 'fixed', 0x3a3b3d, sub(O, (0, .6, -2.2)), (.18, .9, .25), .03, (-.3, 0, 0), 1, 9))
dz.append(boxs('rt', 'fixed', 0x9a9c9e, sub(O, (0, .12, -2.4)), (.14, .25, .12), .02, (.4, 0, 0), 1, 9))
dz.append(boxs('rbm', 'fixed', YELD, sub(O, (0, 1.0, -2.1)), (1.4, .18, .22), .02, None, 1, .5))
for sx in (1, -1):
    dz.append(boxs('rl', 'fixed', YELD, sub(O, (sx * .55, .85, -1.98)), (.08, .3, .35), .01, None, 1, 9))
    dz += ram(sub(O, (sx * .45, 1.3, -1.92)), sub(O, (sx * .45, 1.06, -2.15)), .05, hoses=False)
done('V_dozer', dz, O, h1=1.0, amt=.6)


# ═════════ 自卸卡車與預拌車的底盤 ═════════
def truck_chassis(O, cab_role, cab_col):
    out = []
    for sx in (1, -1):
        out.append(boxs('ch', 'fixed', DARK, sub(O, (sx * .42, .85, 0)), (.12, .3, 7.0), .01, None, 1, .5))
    out.append(boxes('xm', 'fixed', DARK, [((0, .85, z), (.8, .18, .1)) for z in (3.1, 1.6, .2, -1.0, -2.0, -3.3)], O))
    for zz in (2.4, -1.4, -2.65):
        for sx in (1, -1):
            out += wheel(O, (sx * 1.02, .55, zz), .55, .42, lug='block', nlug=13)
        out.append(cyls('ax', 'fixed', 0x2a2b2c, [(sub(O, (-.85, .55, zz)), sub(O, (.85, .55, zz)), .07)], 10))
        out.append(ell('df', 'fixed', 0x2f3032, sub(O, (0, .55, zz)), (.22, .2, .24), 12, 8))
        for sx in (1, -1):
            out.append(boxes('lf', 'fixed', 0x262728, [((0, i * .035, 0), (.1, .03, 1.0 - i * .22)) for i in range(4)], sub(O, (sx * .62, .66, zz))))
    # 擋泥板：前輪圓弧 + 後輪平板 + 擋泥皮
    for sx in (1, -1):
        out.append(arc_fender(O, (sx * 1.02, .55, 2.4), .64, .5, -1.35, 1.35, 0x232426))
        out.append(boxs('mg', 'fixed', 0x222325, sub(O, (sx * 1.02, 1.15, -2.0)), (.5, .05, 1.35), .02, None, 1, .5))
        out.append(boxs('mf', 'fixed', 0x151516, sub(O, (sx * 1.02, .62, -3.27)), (.46, .6, .02), .005, None, 1, 9))
    out += cabin(O, (0, 1.05, 2.6), (2.3, 1.95, 1.7), (cab_role, cab_col), roof=None, door=(1, -1), lights=False)
    out += [boxs('bp', 'fixed', 0x333538, sub(O, (0, .7, 3.5)), (2.36, .3, .18), .04, None, 2, .4),
            boxs('vs', 'fixed', BLK, sub(O, (0, 2.95, 3.46)), (2.1, .06, .18), .02, (-.2, 0, 0), 1, .5)]
    out += grille(sub(O, (0, 1.2, 3.46)), 1.2, .5, 6, '+z', frame=0x9ba4a9, slat=0x2a2b2d)
    for sx in (1, -1):
        out += rlamp(sub(O, (sx * .85, 1.3, 3.46)), (.28, .16), '+z')
        out += rlamp(sub(O, (sx * 1.02, 1.3, 3.46)), (.07, .16), '+z', AMB)
        out += mirror(sub(O, (sx * 1.15, 2.4, 3.2)), sub(O, (sx * 1.35, 2.3, 3.1)), (.06, .35, .18))
        out.append(boxes('sp', 'fixed', 0x3a3b3d, [((0, .45, 0), (.3, .03, .2)), ((0, .78, 0), (.3, .03, .2))], sub(O, (sx * 1.0, 0, 1.72))))
        out.append(tube('gh', 'fixed', 0x9ba4a9, [sub(O, (sx * 1.17, 1.3, 1.95)), sub(O, (sx * 1.17, 2.5, 1.95))], .018, 6))
        out += rlamp(sub(O, (sx * .35, 3.02, 3.2)), (.08, .05), '+z', AMB)
    out += rlamp(sub(O, (0, 3.02, 3.2)), (.08, .05), '+z', AMB)
    out.append(cyls('ft', 'fixed', 0x9ba4a9, [(sub(O, (.75, .75, .9)), sub(O, (.75, .75, 1.6)), .28)], 20))
    out.append(boxes('fs', 'fixed', BLK, [((.75, .75, z), (.6, .6, .03)) for z in (1.05, 1.45)], (O[0], 0, O[2])))
    out.append(cyls('fc', 'fixed', 0x2a2b2c, [(sub(O, (.75, 1.03, 1.25)), sub(O, (.75, 1.07, 1.25)), .06)], 10))
    out.append(cyls('at', 'fixed', 0x6d7276, [(sub(O, (-.75, .72, .4)), sub(O, (-.75, .72, 1.1)), .15)], 14))
    out.append(boxs('bb', 'fixed', 0x2a2b2c, sub(O, (-.75, .8, 1.35)), (.4, .35, .35), .02, None, 1, 9))
    out += exhaust(sub(O, (-1.0, 1.1, 1.65)), sub(O, (-1.0, 3.2, 1.65)), .07)
    out.append(cyls('eh', 'fixed', 0xa8adb1, [(sub(O, (-1.0, 1.6, 1.65)), sub(O, (-1.0, 2.3, 1.65)), .095)], 14))
    out.append(boxs('rbp', 'fixed', 0x333538, sub(O, (0, .62, -3.45)), (2.1, .2, .1), .02, None, 1, .5))
    out.append(boxs('rlb', 'fixed', DARK, sub(O, (0, .9, -3.46)), (2.0, .14, .06), .01, None, 1, .5))
    for sx in (1, -1):
        out += rlamp(sub(O, (sx * .8, .9, -3.5)), (.2, .1), '-z', REDL)
    return out


# ═════════ 自卸卡車（車身 paint）═════════
O = (16, 0, 0)
dt = truck_chassis(O, 'paint', 0)
# 車斗高度對齊網頁碰撞盒：底板 1.25、側板與尾門 1.3..2.6、前板到 3.05，遮陽板伸到駕駛室上方
bed = [boxs('bf', 'paint', 0, sub(O, (0, 1.35, -1.3)), (2.4, .2, 4.6), .03, None, 1, .5),
       boxs('bl', 'paint', 0, sub(O, (1.16, 1.95, -1.3)), (.08, 1.3, 4.6), .03, None, 1, .45),
       boxs('br', 'paint', 0, sub(O, (-1.16, 1.95, -1.3)), (.08, 1.3, 4.6), .03, None, 1, .45),
       boxs('bb', 'paint', 0, sub(O, (0, 1.95, -3.56)), (2.4, 1.3, .1), .03, None, 1, .45),
       boxs('bc', 'paint', 0, sub(O, (0, 2.175, .95)), (2.4, 1.75, .12), .03, None, 1, .45),
       boxs('bv', 'paint', 0, sub(O, (0, 3.03, 1.35)), (2.4, .08, .75), .02, None, 1, .45)]
for sx in (1, -1):
    bed.append(boxs('tr', 'paint', 0, sub(O, (sx * 1.2, 2.58, -1.3)), (.12, .1, 4.62), .02, None, 1, .5))
    bed.append(boxs('lr', 'paint', 0, sub(O, (sx * 1.2, 1.32, -1.3)), (.1, .1, 4.62), .02, None, 1, .5))
    for i in range(5):
        bed.append(boxs('rb', 'paint', 0, sub(O, (sx * 1.22, 1.95, -3.3 + i * 1.1)), (.05, 1.2, .1), .01, None, 1, 9))
    bed.append(boxs('cvs', 'paint', 0, sub(O, (sx * 1.2, 2.95, 1.35)), (.04, .2, .7), .01, None, 1, 9))
bed.append(boxes('sf', 'fixed', DARK, [((sx * .45, 1.12, -1.3), (.14, .24, 4.4)) for sx in (1, -1)], O))
bed.append(boxes('bx', 'paint', 0, [((0, 1.2, z), (2.3, .1, .1)) for z in (-3.2, -2.3, -1.4, -.5, .4)], O))
bed.append(pin(sub(O, (0, 2.57, -3.58)), 2.3, .04))
bed += hazard(sub(O, (0, 1.62, -3.618)), 2.1, .3, DECAL['-z'], .3, cols=(0xd8261c, 0xf2f0ea))
bed.append(boxs('lp', 'fixed', 0xe9e6d8, sub(O, (0, .85, -3.52)), (.36, .16, .02), .005, None, 1, 9))
bed.append(cyls('hs', 'fixed', CHROME, [(sub(O, (0, .95, .75)), sub(O, (0, 1.28, .6)), .06)], 10, 0))
bed.append(cyls('hb', 'fixed', DARK, [(sub(O, (0, .9, .78)), sub(O, (0, 1.08, .7)), .1)], 12))
# 載土：頂點壓到 2.6（與側板同高），網頁的載土碰撞盒頂在 2.5，子彈與站上去的角色不會穿進土堆
sand = bm_ell((1.1, .28, 2.2), 24, 12)
for v in sand.verts:
    v.co.y = max(v.co.y, -.05) + noise.noise(Vector(v.co) * 3) * .035
bed.append(finish(sand, 'sd', 'fixed', 0xcbb07e, sub(O, (0, 2.28, -1.3)), var=.1))
done('V_dump', dt + bed, O, h1=.9, amt=.5)

# ═════════ 預拌車 ═════════
O = (24, 0, 0)
mx = truck_chassis(O, 'fixed', 0xe9e6df)
mx.append(boxs('st', 'fixed', 0xc03a2b, sub(O, (0, 1.55, 3.46)), (2.2, .14, .03), .005, None, 1, .5, var=0))
DR0 = [(.05, -1.7), (.55, -1.6), (1.1, -1.0), (1.28, -.2), (1.28, .4), (1.05, 1.0), (.6, 1.5), (.35, 1.65)]
DR = []
for (a, b) in zip(DR0, DR0[1:]):
    for i in range(4):
        t = i / 4
        DR.append((a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t))
DR.append(DR0[-1])
drum = lathe('dr', 'fixed', 0xe9e6df, DR, (0, 0, 0), 40, var=.02)


def drum_r(y):
    for (a, b) in zip(DR0, DR0[1:]):
        if a[1] <= y <= b[1]:
            return a[0] + (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1])
    return DR0[-1][0]


stripes = []
for k in range(2):
    pts = []
    for i in range(49):
        y = -1.35 + 2.7 * i / 48
        a = k * math.pi + (y + 1.35) / 2.7 * TAU * 1.1
        rr = drum_r(y) + .012
        pts.append((math.sin(a) * rr, y, math.cos(a) * rr))
    stripes.append(finish(bm_tube(pts, .014, 6, True, 7, up=(0, 1, 0)), 'ds', 'fixed', 0xc03a2b, var=.02))
ring = lathe('rg', 'fixed', 0x55585b, [(1.3, -.25), (1.34, -.22), (1.34, -.12), (1.3, -.09)], (0, 0, 0), 40, cap_top=False, cap_bot=False)
drum = join([drum, ring] + stripes, 'drum')
drum.rotation_euler = Euler((math.pi / 2 - .22, 0, 0), 'XYZ')
drum.location = V(*sub(O, (0, 2.35, -.7)))
bpy.context.view_layer.update()
mx += [drum,
       boxs('fr', 'fixed', DARK, sub(O, (0, 1.2, 1.1)), (1.6, 1.3, .2), .03, None, 1, .4),
       boxs('rr', 'fixed', DARK, sub(O, (0, 1.2, -2.6)), (1.4, 1.5, .25), .03, None, 1, .4),
       lathe('hp', 'fixed', 0x9ba4a9, [(.35, 0), (.5, .35), (.25, .5)], sub(O, (0, 2.95, -2.75)), 16, var=.02),
       lathe('hq', 'fixed', 0x8a9398, [(.18, 0), (.32, .25), (.3, .3)], sub(O, (0, 2.15, -2.95)), 14, var=.02, cap_top=False),
       boxs('ch1', 'fixed', 0x9ba4a9, sub(O, (.5, 1.6, -3.4)), (.35, .12, 1.1), .03, (.6, .5, 0), 1, .5),
       cyls('wt', 'fixed', 0x3e6b8e, [(sub(O, (-.8, 1.3, .6)), sub(O, (-.8, 2.0, .6)), .3)], 20)]
for sx in (1, -1):
    mx.append(cyls('dro', 'fixed', 0x3a3b3d, [(sub(O, (sx * .55, 1.72, -1.9)), sub(O, (sx * .35, 1.72, -1.9)), .14)], 14))
    mx.append(boxs('rs', 'fixed', DARK, sub(O, (sx * .55, 1.35, -2.2)), (.12, .7, .6), .02, None, 1, 9))
# 後梯與平台
lad = [((.85 + sx * .18, 2.2, -2.85), (.04, 2.2, .04)) for sx in (1, -1)] + [((.85, 1.2 + i * .3, -2.85), (.36, .03, .03)) for i in range(8)]
mx.append(boxes('ld', 'fixed', 0x9ba4a9, lad, O))
mx.append(boxs('pf', 'fixed', 0x5d6064, sub(O, (.55, 3.2, -2.55)), (.8, .04, .5), .01, None, 1, 9))
mx += handrail([sub(O, p) for p in [(.95, 3.2, -2.8), (.95, 3.2, -2.3)]], .5, 0x9ba4a9, .018)
mx += hazard(sub(O, (0, .62, -3.505)), 1.9, .16, DECAL['-z'], .3, cols=(0xd8261c, 0xf2f0ea))
done('V_mixer', mx, O, h1=.9, amt=.5)

# ═════════ 輪式裝載機 ═════════
O = (32, 0, 0)
ld = []
for zz in (1.2, -1.3):
    for sx in (1, -1):
        ld += wheel(O, (sx * 1.05, .75, zz), .75, .6, rim=YEL, lug='chevron', nlug=18)
    ld.append(cyls('ax', 'fixed', 0x2a2b2c, [(sub(O, (-.8, .75, zz)), sub(O, (.8, .75, zz)), .1)], 12))
    ld.append(ell('df', 'fixed', 0x2f3032, sub(O, (0, .75, zz)), (.3, .28, .3), 12, 8))
ld += [boxs('fr', 'fixed', YEL, sub(O, (0, .95, .9)), (1.3, .7, 1.6), .08, None, 2, .35),
       boxs('rr', 'fixed', YEL, sub(O, (0, 1.1, -1.35)), (1.75, 1.1, 2.2), .12, None, 2, .35),
       boxs('eh', 'fixed', YEL, sub(O, (0, 1.72, -1.75)), (1.5, .14, 1.4), .06, None, 2, .35),
       boxs('cw', 'fixed', YELD, sub(O, (0, .9, -2.5)), (1.8, .9, .35), .15, None, 3, .35),
       cyls('aj', 'fixed', DARK, [(sub(O, (0, .7, .05)), sub(O, (0, 1.25, .05)), .16)], 14)]
ld += grille(sub(O, (0, 1.1, -2.68)), 1.0, .4, 6, '-z')
ld += hazard(sub(O, (0, .72, -2.68)), 1.6, .22, DECAL['-z'])
for sx in (1, -1):
    ld += rlamp(sub(O, (sx * .64, 1.1, -2.68)), (.12, .2), '-z', REDL)
    ld += grille(sub(O, (sx * .878, 1.15, -1.5)), .9, .5, 6, '+x' if sx > 0 else '-x')
    ld.append(arc_fender(O, (sx * 1.05, .75, 1.2), .82, .62, -1.1, .9, YEL))
    ld.append(arc_fender(O, (sx * 1.05, .75, -1.3), .82, .62, -.6, 1.3, YEL))
    ld += ram(sub(O, (sx * .45, .95, -.35)), sub(O, (sx * .45, .95, .45)), .06, hoses=False)
ld.append(seams([(sub(O, (sx * .877, 1.1, z)), (.006, 1.0, .012)) for sx in (1, -1) for z in (-2.0, -.9)] + [(sub(O, (0, 1.795, z)), (1.4, .006, .012)) for z in (-1.3, -2.1)]))
ld += exhaust(sub(O, (.5, 1.79, -1.9)), sub(O, (.5, 2.7, -1.9)), .06)
ld.append(cyls('pc', 'fixed', 0x2d2e30, [(sub(O, (-.4, 1.79, -2.1)), sub(O, (-.4, 2.1, -2.1)), .09)], 14))
ld += cabin(O, (0, 1.8, -.25), (1.5, 1.55, 1.4), ('fixed', YEL), roof=0x2a2b2d, door=1, beacon_at=(-.45, 0, -.45))
for sx in (1, -1):
    ld += rlamp(sub(O, (sx * .45, 3.46, -.95)), (.14, .08), '-z')
    ld += mirror(sub(O, (sx * .76, 3.0, .35)), sub(O, (sx * .9, 3.05, .45)), (.05, .2, .12))
ld.append(boxes('st', 'fixed', 0x3a3b3d, [((.82, .35 + i * .38, -.25), (.3, .03, .22)) for i in range(4)], O))
ld += handrail([sub(O, p) for p in [(.95, 1.5, -.45), (.95, 1.5, -.05)]], .9, BLK, .02)
# 大臂 + Z 型連桿 + 鏟斗
for sx in (1, -1):
    ld.append(beam_path([sub(O, (sx * .55, 1.7, .6)), sub(O, (sx * .55, 1.35, 1.9)), sub(O, (sx * .55, .9, 2.7))], .2, .35, YEL))
    ld.append(pin(sub(O, (sx * .55, 1.7, .6)), .28, .1))
    ld.append(pin(sub(O, (sx * .55, .9, 2.7)), .28, .09))
    ld += ram(sub(O, (sx * .35, .75, 1.0)), sub(O, (sx * .45, 1.45, 1.75)), .075)
ld.append(boxs('bc', 'fixed', YELD, sub(O, (0, 1.72, 1.75)), (.16, .7, .3), .03, (-.6, 0, 0), 1, 9))
ld.append(pin(sub(O, (0, 1.55, 1.75)), .5, .08))
ld += ram(sub(O, (0, 1.2, .9)), sub(O, (0, 1.98, 1.6)), .09)
ld.append(boxs('tl', 'fixed', YELD, sub(O, (0, 1.22, 2.32)), (.12, .12, 1.0), .02, (.57, 0, 0), 1, 9))
LO = [(.52, -.28), (.1, -.38), (-.3, -.18), (-.43, .1), (-.43, .5)]
LI = [(.5, -.22), (.1, -.31), (-.25, -.14), (-.37, .1), (-.37, .45)]
ld.append(bucket(sub(O, (0, .45, 3.0)), 2.6, LO, LI, YELD))
for sx in (1, -1):
    ld.append(boxs('bs', 'fixed', YELD, sub(O, (sx * 1.3, .45, 3.05)), (.05, .82, .7), .01, None, 1, .5))
ld.append(boxs('be', 'fixed', 0x8a8c8e, sub(O, (0, .05, 3.47)), (2.6, .06, .16), .01, None, 1, .5))
ld.append(bolts([sub(O, (x * .3, .08, 3.5)) for x in range(-4, 5)], (0, 1, 0), .02, .015))
ld.append(boxs('sgd', 'fixed', YELD, sub(O, (0, .98, 2.66)), (2.3, .08, .12), .01, None, 1, .5))
done('V_loader', ld, O, h1=1.0, amt=.55)


# ═════════ 皮卡（可駕駛）：車身 paint、玻璃 glass、車內座椅與方向盤；輪子另外匯出 ═════════
def body_strips(zs, top, bot, x0, x1):
    """側面輪廓（每個 z 只有一段 bot..top）沿 x 擠出：全用四邊形，方便切片與烘焙"""
    bm = bmesh.new()
    T = [[bm.verts.new((x, top(z), z)) for z in zs] for x in (x0, x1)]
    B = [[bm.verts.new((x, bot(z), z)) for z in zs] for x in (x0, x1)]
    n = len(zs)
    for k in range(n - 1):
        for s_ in (0, 1):
            bm.faces.new((B[s_][k], B[s_][k + 1], T[s_][k + 1], T[s_][k]))
        bm.faces.new((T[0][k], T[0][k + 1], T[1][k + 1], T[1][k]))
        bm.faces.new((B[0][k], B[1][k], B[1][k + 1], B[0][k + 1]))
    for k in (0, n - 1):
        bm.faces.new((B[0][k], T[0][k], T[1][k], B[1][k]))
    return bm


def arch(zc, r, n=10, y0=.34):
    a0 = math.acos(max(-1, min(1, (y0 - .4) / r)))
    return [(zc + math.sin(a) * r, .4 + math.cos(a) * r) for a in [a0 - (2 * a0) * i / n for i in range(n + 1)]]


O = (40, 0, 0)
ARCH = [(zc, sorted(arch(zc, .47, 12), key=lambda p: p[0])) for zc in (-1.55, 1.55)]


def pk_bot(z):
    for zc, pts in ARCH:
        if pts[0][0] <= z <= pts[-1][0]:
            for (a, b) in zip(pts, pts[1:]):
                if a[0] <= z <= b[0]:
                    return a[1] + (b[1] - a[1]) * (z - a[0]) / max(b[0] - a[0], 1e-6)
    return .36 if z < 0 else .4


zs = sorted(set([-2.63, -2.3, 2.3, 2.63] + [round(p[0], 4) for zc, pts in ARCH for p in pts]))
lo = finish(slice_bm(body_strips(zs, lambda z: .98 - max(0, abs(z) - 2.45) * .6, pk_bot, -.93, .93), .28, (1, 2)), 'lo', 'paint', 0, O, None, False, .02)
pk = [lo]
# 引擎蓋（微拱）
hsecs = []
for k in range(7):
    t = k / 6
    zz = 2.6 - 1.2 * t
    top = .99 + .08 * t
    hsecs.append([sub(O, p) for p in rrect(0, top - .06, 1.84 - .06 * (1 - t), .12, .05, zz, 2)])
pk.append(loft('hd', 'paint', 0, hsecs, smooth=True))
# 格柵、頭燈、保險桿
pk += grille(sub(O, (0, .78, 2.645)), 1.06, .32, 3, '+z', frame=0xa7acb0, slat=0x9fa4a8)
pk.append(ell('bg', 'fixed', 0xc8ccd0, sub(O, (0, .78, 2.672)), (.1, .06, .015), 10, 4))
for sx in (1, -1):
    pk += rlamp(sub(O, (sx * .71, .82, 2.645)), (.3, .13), '+z')
    pk += rlamp(sub(O, (sx * .9, .62, 2.64)), (.07, .07), '+z', AMB)
    pk += rlamp(sub(O, (sx * .82, .88, -2.625)), (.14, .26), '-z', REDL)
pk += [boxs('bp1', 'fixed', 0x3a3b3d, sub(O, (0, .42, 2.62)), (1.9, .2, .14), .05, None, 2, .4),
       boxs('bp2', 'fixed', 0x3a3b3d, sub(O, (0, .42, -2.62)), (1.9, .2, .14), .05, None, 2, .4),
       boxs('ss', 'fixed', 0x26282a, sub(O, (0, .54, -2.68)), (.6, .03, .06), .01, None, 1, 9),
       boxs('pl', 'fixed', 0xe9e6d8, sub(O, (0, .7, -2.605)), (.34, .15, .02), .005, None, 1, 9)]
for sx in (1, -1):
    pk.append(boxes('th', 'fixed', 0x26282a, [((sx * .55, .36, 2.67), (.1, .06, .05))], (O[0], 0, O[2])))
# 輪拱內襯
for zz in (1.55, -1.55):
    for sx in (1, -1):
        pk.append(arc_fender(O, (sx * .8, .4, zz), .47, .3, -1.35, 1.35, 0x18191a, .03))
        pk.append(boxs('wa', 'fixed', 0x18191a, sub(O, (sx * .63, .6, zz)), (.03, .5, .9), .01, None, 1, 9))
# 駕駛室：斜擋風玻璃、柱、車頂、側窗、後窗
cz0, cz1, cy0 = -.5, 1.42, .98
pk.append(boxs('rf', 'paint', 0, sub(O, (0, 1.935, .22)), (1.72, .07, 1.36), .03, None, 2, .35))
pk.append(boxs('rw', 'paint', 0, sub(O, (0, 1.23, -.47)), (1.78, .5, .06), .03, None, 1, .4))
for sx in (1, -1):
    pk.append(tube('ap', 'paint', 0, [sub(O, (sx * .86, 1.0, 1.4)), sub(O, (sx * .85, 1.92, .9))], .045, 8))
    pk.append(boxs('bpl', 'paint', 0, sub(O, (sx * .86, 1.45, -.44)), (.07, .96, .1), .02, None, 1, .4))
    pk.append(boxs('bpm', 'paint', 0, sub(O, (sx * .86, 1.45, .3)), (.06, .9, .06), .015, None, 1, .4))
    pk.append(boxs('sl', 'paint', 0, sub(O, (sx * .88, 1.08, .45)), (.06, .24, 1.9), .02, None, 1, .4))
    pk.append(tube('rr', 'fixed', 0x26282a, [sub(O, (sx * .72, 1.98, -.35)), sub(O, (sx * .72, 1.98, .8))], .014, 6))
# 玻璃（glass 材質，網頁畫成半透明）
ws = bm_boxes([((0, 0, 0), (1.66, 1.02, .02))])
pk.append(finish(ws, 'GL_ws', 'glass', GLASS, sub(O, (0, 1.46, 1.16)), (-.5, 0, 0), False, 0))
pk.append(glass('rwg', sub(O, (0, 1.63, -.475)), (1.6, .5, .02), 'glass'))
for sx in (1, -1):
    sw = bmesh.new()
    poly = [(-.4, 1.2), (.26, 1.2), (.26, 1.9), (-.4, 1.9)]
    poly2 = [(.34, 1.2), (1.33, 1.2), (.9, 1.88), (.34, 1.88)]
    for pp in (poly, poly2):
        va = [sw.verts.new((-.01, y, z)) for (z, y) in pp]
        vb = [sw.verts.new((.01, y, z)) for (z, y) in pp]
        for i in range(4):
            j = (i + 1) % 4
            sw.faces.new((va[i], va[j], vb[j], vb[i]))
        sw.faces.new(list(reversed(va))); sw.faces.new(vb)
    pk.append(finish(sw, 'GL_sw', 'glass', GLASS, sub(O, (sx * .87, 0, 0)), None, False, 0))
# 門縫、門把、油箱蓋、雨刷、天線
for sx in (1, -1):
    X = sx * .932
    pk.append(seams([((X, .7, 1.33), (.006, .6, .01)), ((X, .7, -.42), (.006, .6, .01)), ((X, .41, .45), (.006, .01, 1.75))], 0x161616))
    pk[-1].location = V(*O); bpy.context.view_layer.update()
    pk.append(boxs('dh', 'fixed', 0x26282a, sub(O, (sx * .945, .9, -.18)), (.03, .04, .16), .01, None, 1, 9))
pk.append(seams([((-.932, .8, -1.92), (.006, .16, .01)), ((-.932, .8, -2.08), (.006, .16, .01)), ((-.932, .88, -2.0), (.006, .01, .16)), ((-.932, .72, -2.0), (.006, .01, .16))], 0x161616))
pk[-1].location = V(*O); bpy.context.view_layer.update()
for sx in (-.35, .3):
    pk.append(tube('wp', 'fixed', 0x161616, [sub(O, (sx, 1.03, 1.44)), sub(O, (sx - .25, 1.2, 1.3))], .01, 4))
pk.append(tube('an', 'fixed', 0x161616, [sub(O, (-.88, 1.0, 1.9)), sub(O, (-.9, 1.7, 1.85))], .005, 4))
# 車斗：內壁、邊蓋、地板肋條、尾門
pk += [boxs('bw1', 'paint', 0, sub(O, (.88, 1.0, -1.55)), (.08, .45, 2.0), .03, None, 1, .4),
       boxs('bw2', 'paint', 0, sub(O, (-.88, 1.0, -1.55)), (.08, .45, 2.0), .03, None, 1, .4),
       boxs('bw3', 'paint', 0, sub(O, (0, 1.0, -2.55)), (1.84, .45, .08), .03, None, 1, .4),
       boxs('bl', 'fixed', 0x2a2b2d, sub(O, (0, 1.0, -1.55)), (1.7, .02, 1.95), .01, None, 1, .4)]
pk.append(boxes('br', 'fixed', 0x222325, [((x, 1.02, -1.55), (.05, .025, 1.9)) for x in (-.6, -.3, 0, .3, .6)], O))
pk.append(boxes('bt', 'fixed', 0x26282a, [((sx * .88, 1.235, -1.55), (.1, .025, 2.02)) for sx in (1, -1)] + [((0, 1.235, -2.55), (1.84, .025, .1))], O))
pk.append(seams([((0, 1.0, -2.595), (1.7, .01, .006)), ((0, 1.12, -2.598), (.24, .05, .01))], 0x161616))
pk[-1].location = V(*O); bpy.context.view_layer.update()
pk.append(boxs('bc', 'fixed', 0xe8671d, sub(O, (0, 1.975, .45)), (.7, .09, .22), .03, None, 1, 9, var=0))
pk.append(boxes('bcl', 'fixed', 0xf6c343, [((x, 1.975, .56), (.12, .05, .01)) for x in (-.24, 0, .24)], O, None, 0))
# 後照鏡
for sx in (1, -1):
    pk += mirror(sub(O, (sx * .9, 1.36, 1.3)), sub(O, (sx * .99, 1.45, 1.35)), (.06, .12, .14))
# 車內：座椅、儀表板、方向盤、排檔、地毯、門板
for sx in (1, -1):
    pk.append(boxs('sc', 'fixed', 0x2e3033, sub(O, (sx * .42, 1.12, .18)), (.5, .12, .5), .04, None, 2, 9))
    pk.append(boxs('sb', 'fixed', 0x2e3033, sub(O, (sx * .42, 1.42, .05)), (.5, .5, .1), .04, (-.15, 0, 0), 2, 9))
    pk.append(boxs('hr', 'fixed', 0x2e3033, sub(O, (sx * .42, 1.8, .02)), (.26, .14, .08), .03, None, 2, 9))
    pk.append(boxs('dp', 'fixed', 0x3a3c3f, sub(O, (sx * .83, 1.2, .5)), (.04, .35, 1.6), .01, None, 1, .4))
pk += [boxs('db', 'fixed', 0x26282a, sub(O, (0, 1.38, .98)), (1.62, .2, .28), .04, None, 2, .4),
       boxs('dt', 'fixed', 0x1d1e20, sub(O, (0, 1.49, .99)), (1.5, .03, .22), .01, None, 1, .4),
       boxs('cc', 'fixed', 0x26282a, sub(O, (0, 1.12, .6)), (.22, .18, .7), .03, None, 1, 9),
       boxs('fl', 'fixed', 0x1f2022, sub(O, (0, 1.0, .5)), (1.6, .03, 1.7), .01, None, 1, .4),
       lathe('sw', 'fixed', 0x1a1a1a, [(.15, -.012), (.17, -.012), (.17, .012), (.15, .012), (.15, -.012)], sub(O, (.42, 1.6, .98)), 24, rot=(-1.1, 0, 0), cap_top=False, cap_bot=False),
       tube('sc', 'fixed', 0x1a1a1a, [sub(O, (.42, 1.6, .98)), sub(O, (.42, 1.48, 1.12))], .02, 8),
       tube('gs', 'fixed', 0x1a1a1a, [sub(O, (0, 1.2, .8)), sub(O, (0, 1.36, .75))], .012, 6)]
pk.append(boxes('sp', 'fixed', 0x1a1a1a, [((sx * .085, 0, 0), (.15, .02, .025)) for sx in (-1, 1)], sub(O, (.42, 1.6, .98)), (-1.1, 0, 0)))
for sx in (-1, 1):
    pk.append(cyls('gg', 'fixed', 0xd9d2b8, [(sub(O, (.42 + sx * .1, 1.4, .845)), sub(O, (.42 + sx * .1, 1.4, .835)), .045)], 12, 0))
# 底盤
pk.append(boxes('uf', 'fixed', 0x1c1d1e, [((sx * .45, .3, 0), (.1, .1, 4.8)) for sx in (1, -1)], O))
pk.append(cyls('ep', 'fixed', 0x3d3b39, [(sub(O, (-.3, .28, -1.0)), sub(O, (-.3, .28, -2.7)), .035)], 8))
done('V_pickup_body', pk, O, h1=.55, amt=.22)
W0 = (60, .4, 0)
done('V_wheel', wheel((60, 0, 0), (.0001, .4, 0), .4, .3, rim=0xb9bcbf, lug='block', nlug=16, spokes=6), W0, amt=0)

# ═════════ 堆高機 ═════════
O = (47, 0, 0)
FKO = 0xe8671d
fk = wheel(O, (.6, .3, .6), .3, .25, lug='block', nlug=11) + wheel(O, (-.6, .3, .6), .3, .25, lug='block', nlug=11) + \
    wheel(O, (.55, .25, -.7), .25, .2, lug=None) + wheel(O, (-.55, .25, -.7), .25, .2, lug=None)
fk += [boxs('bd', 'fixed', FKO, sub(O, (0, .55, -.05)), (1.1, .8, 1.9), .1, None, 2, .35),
       boxs('cw', 'fixed', 0x2c2d2f, sub(O, (0, .55, -.95)), (1.1, .9, .35), .15, None, 3, .35),
       boxs('hd', 'fixed', FKO, sub(O, (0, .98, -.45)), (.9, .08, .7), .03, None, 1, .4),
       boxs('se', 'fixed', 0x1f1f1f, sub(O, (0, 1.06, -.3)), (.5, .12, .5), .05, None, 2, 9),
       boxs('sb', 'fixed', 0x1f1f1f, sub(O, (0, 1.3, -.55)), (.5, .5, .1), .04, None, 2, 9),
       boxs('ro', 'fixed', 0x1f1f1f, sub(O, (0, 2.2, -.1)), (1.0, .05, 1.3), .02, None, 1, .5),
       boxs('dsh', 'fixed', FKO, sub(O, (0, 1.05, .45)), (.9, .25, .3), .05, None, 2, 9)]
fk.append(boxes('rs', 'fixed', 0x2a2b2d, [((0, 2.22, -.1 + (i - 3) * .18), (.92, .03, .05)) for i in range(7)], O))
fk += hazard(sub(O, (0, .6, -1.127)), .8, .18, DECAL['-z'], .2)
for sx in (1, -1):
    for zz in (.5, -.7):
        fk.append(tube('gp', 'fixed', 0x1f1f1f, [sub(O, (sx * .45, 1.0, zz)), sub(O, (sx * .45, 2.2, zz * .9))], .035, 8))
    fk.append(boxs('ms', 'fixed', 0x3a3b3d, sub(O, (sx * .3, 1.4, 1.12)), (.08, 2.7, .12), .02, None, 1, .5))
    fk.append(boxs('mi', 'fixed', 0x4a4b4d, sub(O, (sx * .22, 1.45, 1.2)), (.06, 2.5, .08), .015, None, 1, .5))
    fk.append(boxs('fo', 'fixed', 0x9a9c9e, sub(O, (sx * .3, .05, 1.65)), (.1, .05, 1.0), .01, None, 1, .5))
    fk.append(boxs('fu', 'fixed', 0x9a9c9e, sub(O, (sx * .3, .35, 1.17)), (.1, .6, .05), .01, None, 1, 9))
    fk.append(tube('chn', 'fixed', 0x2a2a2a, [sub(O, (sx * .12, .5, 1.24)), sub(O, (sx * .12, 2.45, 1.24))], .015, 4))
    fk += rlamp(sub(O, (sx * .45, 1.95, .56)), (.1, .08), '+z')
    fk += rlamp(sub(O, (sx * .45, .7, -1.13)), (.1, .12), '-z', REDL)
    fk += ram(sub(O, (sx * .45, .7, .3)), sub(O, (sx * .38, 1.0, 1.05)), .04, hoses=False)
fk.append(boxes('mc', 'fixed', 0x3a3b3d, [((0, 2.72, 1.12), (.68, .08, .12)), ((0, .12, 1.12), (.68, .1, .12))], O))
fk.append(boxs('cr', 'fixed', 0x3a3b3d, sub(O, (0, .6, 1.2)), (.85, .08, .08), .02, None, 1, 9))
fk.append(boxes('lr', 'fixed', 0x3a3b3d, [((0, 1.25, 1.2), (.85, .04, .04))] + [(((i - 3) * .135, .9, 1.2), (.03, .7, .03)) for i in range(7)], O))
fk.append(cyls('lc', 'fixed', 0x3a3b3d, [(sub(O, (0, .2, 1.05)), sub(O, (0, 1.4, 1.05)), .05)], 12))
fk.append(cyls('lcr', 'fixed', CHROME, [(sub(O, (0, 1.4, 1.05)), sub(O, (0, 2.4, 1.05)), .03)], 10, 0))
fk.append(cyls('lpg', 'fixed', 0xd9dcdf, [(sub(O, (-.38, 1.22, -.85)), sub(O, (.38, 1.22, -.85)), .17)], 16))
fk.append(boxes('lpb', 'fixed', 0x2a2b2d, [((sx * .25, 1.1, -.85), (.04, .2, .3)) for sx in (1, -1)], O))
fk.append(lathe('sw', 'fixed', 0x1a1a1a, [(.12, -.01), (.14, -.01), (.14, .01), (.12, .01), (.12, -.01)], sub(O, (0, 1.4, .25)), 20, rot=(-.9, 0, 0), cap_top=False, cap_bot=False))
fk.append(tube('sc', 'fixed', 0x1a1a1a, [sub(O, (0, 1.4, .25)), sub(O, (0, 1.15, .42))], .02, 6))
fk += beacon(sub(O, (.3, 2.225, -.6)), .06)
done('V_forklift', fk, O, h1=.6, amt=.45)


# ═════════ 雙旋翼起重直升機（機身原點 = 網頁 HELI 原點）═════════
O = (0, 0, 20)
OR, WH = 0xe8671d, 0xe9e6df


def fus_section(cy, w, h, z, bands, n=4):
    """圓角矩形截面：左右直邊另外插入色帶邊界點，保證每環點數固定"""
    r = min(w, h) * .38
    r = min(r, w / 2 - 1e-4, h / 2 - 1e-4)
    ylo, yhi = cy - (h / 2 - r), cy + (h / 2 - r)
    def side_pts():
        out = []
        for i, b in enumerate(bands):
            yy = min(max(b, ylo + .002 * (i + 1)), yhi - .002 * (len(bands) - i))
            out.append(yy)
        return sorted(out)
    ys = side_pts()
    pts = [(w / 2, y, z) for y in ys]
    quads = ((w / 2 - r, h / 2 - r, 0), (-(w / 2 - r), h / 2 - r, 90), (-(w / 2 - r), -(h / 2 - r), 180), (w / 2 - r, -(h / 2 - r), 270))
    for qi, (qx, qy, a0) in enumerate(quads):
        for i in range(n + 1):
            a = math.radians(a0 + 90 * i / n)
            pts.append((qx + math.cos(a) * r, cy + qy + math.sin(a) * r, z))
        if qi == 1:
            pts += [(-w / 2, y, z) for y in reversed(ys)]
    return pts


BANDS = [-1.07, -1.04, -.465, -.435, .035, .065]
keys = [(8.1, -.15, .5, .5), (7.7, -.05, 1.6, 1.5), (7.0, .05, 2.4, 2.3), (6.2, .1, 2.65, 2.7), (4.5, .1, 2.75, 2.85), (-4.0, .1, 2.75, 2.85), (-5.3, .35, 2.4, 2.6), (-6.4, .8, 1.5, 1.6), (-6.9, 1.0, .9, 1.0)]
SEAMZ = [6.2, 4.5, 3.0, 1.5, 0.0, -1.5, -3.0, -4.0, -5.3]


def key_at(z):
    for (a, b) in zip(keys, keys[1:]):
        if b[0] <= z <= a[0]:
            t = (a[0] - z) / (a[0] - b[0])
            return [a[j] + (b[j] - a[j]) * t for j in range(4)]
    return list(keys[-1])


zs = set()
for (a, b) in zip(keys, keys[1:]):
    for i in range(4):
        zs.add(round(a[0] + (b[0] - a[0]) * i / 4, 4))
zs.add(keys[-1][0])
for s in SEAMZ:
    zs.update((round(s - .02, 4), round(s + .02, 4)))
    zs.add(s)
zs = sorted(zs, reverse=True)
secs = []
for z in zs:
    _, cy, w, h = key_at(z)
    k = 1.0
    secs.append([sub(O, (p[0] * k, cy + (p[1] - cy) * k, p[2])) for p in fus_section(cy, w, h, z, BANDS)])
fus = loft('fu', 'fixed', OR, secs, var=.015)


def fus_col(p, n):
    y = p.y - O[1]
    z = p.z - O[2]
    if any(abs(z - s) < 1e-3 for s in SEAMZ):
        return hexrgb(0x3a2a20)
    if -.45 < y < .05 and -3.99 < z < 6.19:
        return hexrgb(WH)
    if y < -1.055:
        return hexrgb(0x6b6f73)
    return None


def recolor2(ob, fn):
    me = ob.data
    col = me.color_attributes['Col']
    a = np.zeros(len(me.vertices) * 4, dtype=np.float32)
    col.data.foreach_get('color', a)
    mw = ob.matrix_world
    for i, v in enumerate(me.vertices):
        r = fn(T(mw @ v.co), None)
        if r is not None:
            a[i * 4:i * 4 + 3] = [srgb2lin(x) for x in r]
    col.data.foreach_set('color', a)


recolor2(fus, fus_col)
hl = [fus]
for zz, top, ln in ((5.2, 1.6, 2.4), (-5.4, 3.0, 3.2)):
    s2 = []
    for k in range(6):
        t = k / 5
        s2.append([sub(O, p) for p in rrect(0, 1.25 + (top - 1.25) * .5, 1.3 - .3 * abs(t - .5), top - 1.1, .3, zz - ln / 2 + ln * t, 3)])
    hl.append(loft('py', 'fixed', OR, s2, var=.015))
    hl.append(cyls('mh', 'fixed', 0x3a3b3d, [(sub(O, (0, top, zz)), sub(O, (0, top + .35, zz)), .3)], 16))
    hl.append(cyls('mf', 'fixed', 0x2a2b2d, [(sub(O, (0, top - .02, zz)), sub(O, (0, top + .05, zz)), .42)], 16))
# 後塔兩側的渦軸引擎
for sx in (1, -1):
    ex = sub(O, (sx * 1.05, 2.35, -5.2))
    hl.append(cyls('en', 'fixed', 0x8e9296, [(sub(ex, (0, 0, 1.0)), sub(ex, (0, 0, -.8)), .34)], 18))
    hl.append(lathe('ei', 'fixed', 0x2a2b2d, [(.34, 0), (.36, .04), (.3, .08), (.001, .06)], sub(ex, (0, 0, 1.0)), 18, rot=(math.pi / 2, 0, 0)))
    hl.append(cyls('eo', 'fixed', 0x2b2a28, [(sub(ex, (0, 0, -.8)), sub(ex, (0, 0, -1.1)), .24)], 14))
    hl.append(boxs('ep', 'fixed', 0x6c7074, sub(ex, (-sx * .28, -.25, 0)), (.18, .2, 1.4), .03, None, 1, .5))
    hl.append(boxes('eb', 'fixed', 0x2a2b2d, [((0, 0, z), (.72, .72, .03)) for z in (.4, -.3)], ex))
# 駕駛艙玻璃：貼著機身表面長出來（取機身截面上半圈的點往外推），前擋風兩片、側窗兩片，底下墊一圈深色窗框
NB = len(BANDS)


def arch_pt(z, fi, off):
    """機身截面上半圈（右肩 0° → 頂 → 左肩 180°）的第 fi 點（可為小數），沿截面法線往外推 off"""
    _, cy, w, h = key_at(z)
    ring = fus_section(cy, w, h, z, BANDS)[NB:NB + 10]
    i = min(int(math.floor(fi)), 8)
    t = fi - i
    a, b = ring[i], ring[i + 1]
    x, y = a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t
    if fi <= 4:
        ang = math.radians(fi * 22.5)
    elif fi >= 5:
        ang = math.radians(90 + (fi - 5) * 22.5)
    else:
        ang = math.pi / 2
    return (O[0] + x + math.cos(ang) * off, O[1] + y + math.sin(ang) * off, O[2] + z)


def arch_sheet(name, col, z0, z1, f0, f1, off, nz=5):
    fis = sorted(set([f0, f1] + [float(k) for k in range(10) if f0 < k < f1] + [f0 + (f1 - f0) * k / 6 for k in range(1, 6)]))
    zs_ = [z0 + (z1 - z0) * k / nz for k in range(nz + 1)]
    if z0 < 7.0 < z1:
        zs_ = sorted(set(zs_ + [7.0]))
    bm = bmesh.new()
    rows = [[bm.verts.new(arch_pt(z, f, off)) for f in fis] for z in zs_]
    for k in range(len(rows) - 1):
        for i in range(len(fis) - 1):
            bm.faces.new((rows[k][i], rows[k][i + 1], rows[k + 1][i + 1], rows[k + 1][i]))
    ob = finish(bm, name, 'fixed', col, smooth=True, var=0)
    # 開放曲面：recalc 可能翻面，對照截面外法線修正
    me = ob.data
    zm, fm = (z0 + z1) / 2, (f0 + f1) / 2
    pc, po = Vector(arch_pt(zm, fm, 0)), Vector(arch_pt(zm, fm, 1))
    want = V(*(po - pc))
    if sum((p.normal.dot(want) for p in me.polygons)) < 0:
        me.flip_normals()
    return ob


def cockpit_glass(name, z0, z1, f0, f1):
    ob = arch_sheet('GL_' + name, GLASS, z0, z1, f0, f1, .026)
    ct, cb = hexrgb(0x7d97a6), hexrgb(0x1a2329)
    y0, y1 = O[1] + .2, O[1] + 1.25
    paint(ob, lambda p, n: lerp3(cb, ct, max(0, min(1, (p.y - y0) / (y1 - y0)))))
    return ob


FR = 0x1f2022
for (nm, z0, z1, f0, f1) in (('wsR', 7.08, 7.64, .35, 3.9), ('wsL', 7.08, 7.64, 5.1, 8.65), ('swR', 6.32, 6.96, .3, 2.55), ('swL', 6.32, 6.96, 6.45, 8.7)):
    hl.append(arch_sheet('cf', FR, z0 - .07, z1 + .06, max(0, f0 - .22), min(9, f1 + .22), .012))
    hl.append(cockpit_glass(nm, z0, z1, f0, f1))
hl.append(arch_sheet('cf', FR, 6.99, 7.08, .1, 8.9, .016, 1))     # 擋風與側窗之間的立柱
hl.append(arch_sheet('cf', FR, 7.04, 7.7, 3.9, 5.1, .016, 4))     # 擋風中柱
for sx in (1, -1):
    hl.append(tube('pt', 'fixed', 0x9ba4a9, [sub(O, (sx * .45, -.35, 7.9)), sub(O, (sx * .45, -.35, 8.22))], .015, 6))
    f0 = 1.6 if sx > 0 else 7.4
    hl.append(tube('wi', 'fixed', 0x161616, [arch_pt(7.6, f0, .05), arch_pt(7.22, f0 + (.9 if sx > 0 else -.9), .05)], .01, 4))
for i in range(8):
    for sx in (1, -1):
        hl.append(glass('wn', sub(O, (sx * 1.385, .5, 4.2 - i * 1.05)), (.02, .38, .45), 'fixed'))
        hl.append(boxs('wf', 'fixed', 0x3a3b3d, sub(O, (sx * 1.378, .5, 4.2 - i * 1.05)), (.02, .46, .53), 0, None, 1, 9))
# 右前艙門與後斜坡門的縫
hl.append(seams([(sub(O, (-1.39, .1, 5.55)), (.006, 1.6, .012)), (sub(O, (-1.39, .1, 4.75)), (.006, 1.6, .012)), (sub(O, (-1.39, .9, 5.15)), (.006, .012, .8))], 0x3a2a20))
hl.append(boxs('dh', 'fixed', 0x222325, sub(O, (-1.4, .2, 4.9)), (.03, .05, .14), .01, None, 1, 9))
for sx in (1, -1):
    hl += [boxs('sp', 'fixed', OR, sub(O, (sx * 1.55, -1.25, -.2)), (.5, .75, 6.4), .25, None, 3, 1.1, smooth=True),
           tube('gs', 'fixed', 0x3a3b3d, [sub(O, (sx * 1.3, -1.1, 4.0)), sub(O, (sx * 1.45, -1.75, 4.0))], .07, 8),
           tube('gs', 'fixed', 0x3a3b3d, [sub(O, (sx * 1.7, -1.3, -4.0)), sub(O, (sx * 1.75, -1.75, -4.0))], .07, 8),
           cyls('ol', 'fixed', CHROME, [(sub(O, (sx * 1.44, -1.55, 4.0)), sub(O, (sx * 1.45, -1.75, 4.0)), .045), (sub(O, (sx * 1.74, -1.55, -4.0)), sub(O, (sx * 1.75, -1.75, -4.0)), .045)], 8, 0)]
    hl.append(seams([(sub(O, (sx * 1.805, -1.25, z)), (.006, .5, .012)) for z in (-2.0, 1.4)], 0x3a2a20))
    hl += wheel(O, (sx * 1.45, -1.9, 4.0), .34, .24, rim=0x9ba4a9, lug=None)
    hl += wheel(O, (sx * 1.75, -1.9, -4.0), .34, .24, rim=0x9ba4a9, lug=None)
    hl += lamp(sub(O, (sx * 1.8, -1.1, -.4)), .05, '+x' if sx > 0 else '-x', 0xd9291c if sx > 0 else 0x2bb34a)
hl += beacon(sub(O, (0, 1.28, 6.7)), .05, 0xd9291c)
hl.append(boxes('at', 'fixed', 0x2a2b2d, [((0, 1.5, 1.5), (.03, .25, .35)), ((0, 1.48, -1.0), (.03, .2, .3))], O))
hl.append(boxs('st', 'fixed', 0x3a3b3d, sub(O, (-1.0, -1.05, 6.1)), (.3, .03, .2), .01, None, 1, 9))
# 吊掛：絞盤外殼 + 吊鉤 + 斜紋
hl += [boxs('wh', 'fixed', 0x3a3b3d, sub(O, (0, -1.33, 0)), (.8, .12, .8), .03, None, 1, .4),
       boxs('hk', 'fixed', 0x9ba4a9, sub(O, (0, -1.45, 0)), (.35, .25, .35), .05, None, 2, 9),
       boxs('ra', 'fixed', 0x2b2d30, sub(O, (0, -.2, -6.6)), (1.2, .06, .9), .02, None, 1, .5)]
hl += hazard(sub(O, (0, -1.395, 0)), .78, .78, (math.pi / 2, 0, 0), .18)
done('H_body', hl, O, 30, h1=.8, amt=.25, ground=O[1] - 2.25)

R = (0, 0, 40)
rt = [lathe('hub', 'fixed', 0x2c2d2f, [(.001, .25), (.28, .2), (.32, 0), (.25, -.2)], R, 16),
      lathe('swp', 'fixed', 0x55585b, [(.2, -.2), (.34, -.19), (.34, -.14), (.2, -.13)], R, 20, cap_top=False, cap_bot=False)]
for i in range(3):
    a = i * TAU / 3
    c, s = math.cos(a), math.sin(a)
    rt.append(cyls('gr', 'fixed', 0x3a3b3d, [(sub(R, (c * .25, .07, s * .25)), sub(R, (c * .85, .08, s * .85)), .085)], 12))
    rt.append(tube('pl', 'fixed', 0x9ba4a9, [sub(R, (c * .3 - s * .15, -.16, s * .3 + c * .15)), sub(R, (c * .45 - s * .16, .05, s * .45 + c * .16))], .015, 6))
    secs = []
    # 翼尖色帶的邊界各多一圈截面，白 / 黃色帶才會是俐落的一條而不是拉長的漸層
    rrs = sorted(set([round(.8 + k / 8 * 8.35, 4) for k in range(9)] + [7.88, 7.9, 8.2, 8.22, 8.53, 8.55]))
    for rr in rrs:
        k = (rr - .8) / 8.35 * 8
        ch = .45 - k / 8 * .1
        tw = .12 - k / 8 * .1
        pts = [(-ch / 2, .015), (-ch * .3, .035), (ch * .1, .03), (ch / 2, -.005), (ch * .1, -.015), (-ch * .3, -.012)]
        sec = []
        for (u, v) in pts:
            vy = v + u * tw
            sec.append(sub(R, (c * rr - s * u, .08 + vy, s * rr + c * u)))
        secs.append(sec)
    bl = loft('bl', 'fixed', 0x202224, secs, smooth=True)
    recolor2(bl, lambda p, n: hexrgb(0xf4b400) if math.hypot(p.x - R[0], p.z - R[2]) > 8.545 else (hexrgb(0xe9e6df) if 7.895 < math.hypot(p.x - R[0], p.z - R[2]) < 8.205 else None))
    rt.append(bl)
done('H_rotor', rt, R, 30, amt=0)

def ao_bake2(objs, samples=48, floor=.38):
    """同 lb_lib.ao_bake，另把埋在別的零件裡（AO≈0）的頂點改用鄰點平均，避免細長三角形拉出黑紋"""
    sc = bpy.context.scene
    sc.cycles.samples = samples
    for ob in objs:
        me = ob.data
        ao = me.color_attributes.new('AO', 'FLOAT_COLOR', 'POINT')
        me.color_attributes.active_color = ao
        for o in bpy.context.view_layer.objects:
            o.select_set(False)
        ob.select_set(True)
        bpy.context.view_layer.objects.active = ob
        bpy.ops.object.bake(type='AO', target='VERTEX_COLORS')
        n = len(me.vertices)
        a = np.zeros(n * 4, dtype=np.float32)
        ao.data.foreach_get('color', a)
        v = np.clip(a.reshape(-1, 4)[:, 0], 0, 1)
        ed = np.zeros(len(me.edges) * 2, dtype=np.int32)
        me.edges.foreach_get('vertices', ed)
        ed = ed.reshape(-1, 2)
        bad = v < .1
        for _ in range(8):
            if not bad.any():
                break
            good = ~bad
            s_ = np.zeros(n, np.float32); c_ = np.zeros(n, np.float32)
            for (i, j) in ((0, 1), (1, 0)):
                m = good[ed[:, j]]
                np.add.at(s_, ed[m, i], v[ed[m, j]]); np.add.at(c_, ed[m, i], 1)
            fix = bad & (c_ > 0)
            v[fix] = s_[fix] / c_[fix]
            bad &= ~fix
        v[bad] = .5
        b = np.zeros(n * 4, dtype=np.float32)
        me.color_attributes['Col'].data.foreach_get('color', b)
        b = b.reshape(-1, 4)
        b[:, :3] *= (floor + (1 - floor) * v)[:, None]
        me.color_attributes['Col'].data.foreach_set('color', b.ravel())
        me.color_attributes.remove(me.color_attributes['AO'])
        me.color_attributes.active_color = me.color_attributes['Col']


print('tris', tri_count(OUT))
# AO：臨時放一塊地面給地上的機具（直升機與單獨的輪子不在範圍內）
gp = bpy.data.objects.new('GroundTmp', bpy.data.meshes.new('GroundTmp'))
bm = bmesh.new()
for (x, z) in ((-4, -6), (51, -6), (51, 6), (-4, 6)):
    bm.verts.new(V(x, 0, z))
bm.faces.new(list(bm.verts))
bm.to_mesh(gp.data); bm.free()
bpy.context.scene.collection.objects.link(gp)
ao_bake2(BAKE, samples=int(os.environ.get('SAMPLES', '96')))
bpy.data.objects.remove(gp)
if PREVIEW:
    os.makedirs(PREVIEW, exist_ok=True)
    preview(os.path.join(PREVIEW, 'm_exc.png'), (0, 2.2, 1.5), 13, 40, 18)
    preview(os.path.join(PREVIEW, 'm_exc_close.png'), (0, 1.5, -1.0), 7, 150, 20)
    preview(os.path.join(PREVIEW, 'm_dozer.png'), (8, 1.4, .5), 9, 35, 15)
    preview(os.path.join(PREVIEW, 'm_trucks.png'), (20, 1.5, 0), 16, 50, 20)
    preview(os.path.join(PREVIEW, 'm_truck_rear.png'), (20, 1.5, -1), 13, 150, 15)
    preview(os.path.join(PREVIEW, 'm_loader.png'), (32, 1.5, .5), 9, 40, 15)
    preview(os.path.join(PREVIEW, 'm_pickup.png'), (40, 1.0, 0), 7.5, 35, 15)
    preview(os.path.join(PREVIEW, 'm_pickup_r.png'), (40, 1.0, 0), 7.5, 215, 20)
    preview(os.path.join(PREVIEW, 'm_fork.png'), (47, 1.2, .3), 5.5, 40, 15)
    preview(os.path.join(PREVIEW, 'm_wheel.png'), (60, .4, 0), 1.8, 70, 10)
    preview(os.path.join(PREVIEW, 'm_heli.png'), (0, .5, 20), 22, 55, 15)
    preview(os.path.join(PREVIEW, 'm_heli_b.png'), (0, .0, 20), 20, 215, -10)
    preview(os.path.join(PREVIEW, 'm_rotor.png'), (0, 0, 40), 5, 30, 40)
GLB_PATH = os.environ.get('GLB', os.path.join(HERE, 'machines.glb'))
export(GLB_PATH, OUT)
from world_lib import quantize_glb_colors
quantize_glb_colors(GLB_PATH)   # 頂點色改存 8 位元，檔案小約 0.5 MB
