# 188 彩筆曠野：主角（小畫家）、巨大畫筆、老畫師帕布
# 重建：/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P assets/188/build_hero.py
#   環境變數：OUT=輸出 glb（預設 assets/188/hero.glb）、RENDER=1 另存預覽圖到 PREV（預設 /tmp/bw188）、AO=烘焙取樣數（0 不烘焙）
# 主角約 5.5 頭身、1.85 公尺；骨架 21 根骨頭，動作：Idle Run Jump Swing1 Swing2 Spin Shoot Fly Hurt
# 畫筆有三份：BrushHand（右手）、BrushBack（背上，沿斜背帶）、BrushFly（飛行時坐在上面），網頁依狀態切換；筆毛、貝雷帽、圍巾的材質 paint 會換成目前顏色
# 工具：spline/stube（樣條圓管）、ribbon（有厚度的帶子）、radial（沿軸皺褶）、reweight/wsmooth（自訂與平滑權重，避免關節撕裂）
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from bw_lib import *

OUT = os.environ.get('OUT', os.path.join(HERE, 'hero.glb'))
PREV = os.environ.get('PREV', '/tmp/bw188')
RENDER = os.environ.get('RENDER', '1') == '1'
AO = int(os.environ.get('AO', '24'))
os.makedirs(PREV, exist_ok=True)
reset()
random.seed(188)


# ── 骨架（three 座標，面向 +z；右手在 -x） ──
S = {'R': -1, 'L': 1}
bones = [
    ('hips', (0, .9, 0), (0, 1.04, 0), None),
    ('spine', (0, 1.04, 0), (0, 1.24, 0), 'hips'),
    ('chest', (0, 1.24, 0), (0, 1.44, 0), 'spine'),
    ('neck', (0, 1.44, 0), (0, 1.53, .005), 'chest'),
    ('head', (0, 1.53, .005), (0, 1.86, .01), 'neck'),
    ('scarf1', (0, 1.47, -.1), (.04, 1.3, -.16), 'chest'),
    ('scarf2', (.04, 1.3, -.16), (.07, 1.1, -.2), 'scarf1'),
]
J = {}
for side, s in S.items():
    J[side] = dict(sh0=(s * .05, 1.42, 0), sh=(s * .175, 1.405, -.005), el=(s * .325, 1.19, -.01), wr=(s * .445, .99, .02), hn=(s * .5, .9, .045),
                   hip=(s * .095, .9, 0), kn=(s * .1, .5, .015), an=(s * .1, .1, -.01), toe=(s * .1, .03, .13))
    j = J[side]
    bones += [
        ('shoulder.' + side, j['sh0'], j['sh'], 'chest'),
        ('upperarm.' + side, j['sh'], j['el'], 'shoulder.' + side),
        ('forearm.' + side, j['el'], j['wr'], 'upperarm.' + side),
        ('hand.' + side, j['wr'], j['hn'], 'forearm.' + side),
        ('thigh.' + side, j['hip'], j['kn'], 'hips'),
        ('shin.' + side, j['kn'], j['an'], 'thigh.' + side),
        ('foot.' + side, j['an'], j['toe'], 'shin.' + side),
    ]
rig = armature('HeroRig', bones)
parts = []  # (物件, 骨頭清單)


def add(ob, bl, bake=True):
    parts.append((ob, bl, bake))
    return ob


def vsub(a, b): return Vector(a) - Vector(b)


def lerp3(a, b, t): return tuple(a[i] + (b[i] - a[i]) * t for i in range(3))


# ── 共用小工具：樣條內插、沿軸的皺褶、自訂權重與權重平滑、帶狀布料 ──
from mathutils.bvhtree import BVHTree


def spline(pts, per=3):
    """Catmull-Rom 內插（per = 每段取幾個點）"""
    P = [Vector(p) for p in pts]
    if len(P) < 3 or per <= 1:
        return [tuple(p) for p in P]
    out = []
    for i in range(len(P) - 1):
        p0 = P[i - 1] if i > 0 else P[0] * 2 - P[1]
        p1, p2 = P[i], P[i + 1]
        p3 = P[i + 2] if i + 2 < len(P) else P[-1] * 2 - P[-2]
        for k in range(per):
            t = k / per
            out.append(tuple(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3)))
    out.append(tuple(P[-1]))
    return out


def rinterp(r, per):
    if not isinstance(r, (list, tuple)):
        return r
    out = []
    for i in range(len(r) - 1):
        for k in range(per):
            out.append(r[i] + (r[i + 1] - r[i]) * k / per)
    out.append(r[-1])
    return out


def stube(name, pts, radii, per=3, **kw):
    return tube(name, spline(pts, per), rinterp(radii, per) if len(pts) >= 3 else radii, **kw)


def radial(ob, a, b, fn, ref=(0, 0, 1)):
    """沿 a→b 軸把頂點往徑向推：fn(t, 角度, 半徑) → 位移（公尺）"""
    a, b = Vector(a), Vector(b)
    ax = b - a
    L = ax.length
    axn = ax / L
    e1 = Vector(ref) - axn * Vector(ref).dot(axn)
    e1.normalize()
    e2 = axn.cross(e1)

    def f(p):
        t = (p - a).dot(axn) / L
        r = p - a - axn * (t * L)
        if r.length < 1e-6:
            return None
        return tuple(p + r.normalized() * fn(t, math.atan2(r.dot(e2), r.dot(e1)), r.length))
    each_vert(ob, f)


def rot_about(ob, c, axis, deg):
    R = Matrix.Rotation(math.radians(deg), 3, Vector(axis))
    c = Vector(c)
    each_vert(ob, lambda p: tuple(c + R @ (p - c)))


def reweight(ob, fn):
    """fn(p, {骨頭: 權重}) → 新的權重表（會正規化）"""
    names = {g.index: g.name for g in ob.vertex_groups}
    mw = ob.matrix_world
    for v in ob.data.vertices:
        w = {names[g.group]: g.weight for g in v.groups}
        nw = fn(Vector(T(mw @ v.co)), w)
        if nw is None:
            continue
        s = sum(nw.values()) or 1
        for k in list(w.keys()):
            ob.vertex_groups[k].remove([v.index])
        for k, x in nw.items():
            if x <= 1e-4:
                continue
            g = ob.vertex_groups.get(k) or ob.vertex_groups.new(name=k)
            g.add([v.index], x / s, 'REPLACE')


def wsmooth(ob, factor=.5, repeat=4):
    """權重平滑（距離式權重在關節處容易撕裂，布料與四肢平滑幾次）"""
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    bpy.context.view_layer.objects.active = ob
    ob.select_set(True)
    try:
        bpy.ops.object.vertex_group_smooth(group_select_mode='ALL', factor=factor, repeat=repeat)
    except Exception:
        bpy.ops.object.mode_set(mode='WEIGHT_PAINT')
        bpy.ops.object.vertex_group_smooth(group_select_mode='ALL', factor=factor, repeat=repeat)
        bpy.ops.object.mode_set(mode='OBJECT')
    bpy.ops.object.vertex_group_limit_total(group_select_mode='ALL', limit=4)
    bpy.ops.object.vertex_group_normalize_all(group_select_mode='ALL', lock_active=False)


def ribbon(name, pts, widths, thick=.006, up=(0, 0, 1), per=3, cols=6, fold=0.0, nfold=2, fringe=0.0, slot='fixed', twist=None):
    """扁帶（圍巾尾、背帶、腰帶尾、圍裙）：截面是一條有厚度的波浪，fold 為橫向起伏，fringe 讓末端長短不齊"""
    P = [Vector(p) for p in spline(pts, per)]
    W = rinterp(widths, per) if isinstance(widths, (list, tuple)) else [widths] * len(P)
    if len(W) != len(P):
        W = [W[min(len(W) - 1, int(i * len(W) / len(P)))] for i in range(len(P))]
    bm = bmesh.new()
    rings = []
    prev = None
    upv = Vector(up)
    for k, p in enumerate(P):
        t = (P[min(k + 1, len(P) - 1)] - P[max(k - 1, 0)]).normalized()
        n = (prev if prev is not None else upv) - t * (prev if prev is not None else upv).dot(t)
        n.normalize()
        prev = n
        b = t.cross(n)
        if twist:
            ang = twist(k / (len(P) - 1))
            n, b = n * math.cos(ang) + b * math.sin(ang), b * math.cos(ang) - n * math.sin(ang)
        us = [-1 + 2 * i / (cols - 1) for i in range(cols)]
        top, bot = [], []
        for i, u in enumerate(us):
            off = fold * math.sin((u + 1) * math.pi * nfold / 2 + k * .15) * (1 - abs(u) ** 4)
            q = p + b * u * W[k] + n * off
            if fringe and k == len(P) - 1:
                q = q + t * fringe * (.3 + .7 * (i % 2)) * (1 - .4 * abs(u))
            top.append(bm.verts.new(V(*(q + n * thick))))
            bot.append(bm.verts.new(V(*(q - n * thick))))
        rings.append(top + list(reversed(bot)))
    m = len(rings[0])
    for k in range(len(rings) - 1):
        for i in range(m):
            bm.faces.new((rings[k][i], rings[k][(i + 1) % m], rings[k + 1][(i + 1) % m], rings[k + 1][i]))
    bm.faces.new(list(reversed(rings[0])))
    bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return obj_from_bm(bm, name, (0, 0, 0), slot)


def loop_pts(c, rx, rz, n, yfn=lambda a: 0, rfn=lambda a: 1.0):
    """水平的閉合環（圍巾、束帶用），回傳首尾相接的點"""
    out = []
    for i in range(n + 1):
        a = i / n * TAU
        r = rfn(a)
        out.append((c[0] + math.cos(a) * rx * r, c[1] + yfn(a), c[2] + math.sin(a) * rz * r))
    return out


def cavity(ob, base, dark, fn):
    """依位置混入暗色（縫線、凹槽）"""
    paint(ob, lambda p, n: mix(base(p, n) if callable(base) else base, dark, fn(p, n)))


def noisev(p, f=6.0, seed=0):
    return noise.noise(Vector(p) * f + Vector((seed * 3.1, seed * 1.7, seed * 5.3)))


# ── 頭：先把臉部加密，再雕眉骨、眼窩、顴骨、下巴；鼻子與嘴唇另外做再貼上 ──
SKIN, SKIN_SH, SKIN_W = 0xf2cfae, 0xd9a688, 0xeaa994
HC = (0, 1.625, 0)
HR = (.148, .168, .156)
head = ellipsoid('Head', HC, HR, seg=38, rings=28)
bm = bmesh.new(); bm.from_mesh(head.data)
fe = [e for e in bm.edges if all((lambda c: c[2] > .04 and 1.5 < c[1] < 1.7 and abs(c[0]) < .115)(T(v.co)) for v in e.verts)]
bmesh.ops.subdivide_edges(bm, edges=fe, cuts=1, use_grid_fill=True)
for v in bm.verts:  # 新點投影回橢球面
    x, y, z = T(v.co)
    q = Vector((x / HR[0], (y - HC[1]) / HR[1], z / HR[2]))
    if q.length > 1e-6:
        q.normalize()
        v.co = V(q.x * HR[0], HC[1] + q.y * HR[1], q.z * HR[2])
bm.to_mesh(head.data); bm.free()


def shape_head(p):
    x, y, z = p
    dy = HC[1] - y
    if dy > 0:
        t = min(1, dy / .168)
        x *= 1 - .44 * t ** 1.35
        z *= 1 - (.06 if z > 0 else .18) * t
    if z < 0:
        z *= 1.07
    if y > HC[1]:  # 頭頂稍微往後圓
        z -= .012 * sstep(HC[1], HC[1] + .17, y)
    return (x, y, z)


each_vert(head, shape_head)


def g2(dx, dy, rx, ry):
    return math.exp(-(dx / rx) ** 2 - (dy / ry) ** 2)


def face_d(x, y):
    d = 0
    for s in (-1, 1):
        d -= .017 * g2(x - s * .062, y - 1.622, .036, .027)   # 眼窩
        d -= .004 * g2(x - s * .072, y - 1.54, .026, .016)    # 顴骨下的凹面
        d += .0075 * g2(x - s * .062, y - 1.668, .04, .011)   # 眉骨
        d += .005 * g2(x - s * .074, y - 1.58, .026, .02)  # 顴骨／臉頰
        d -= .004 * g2(x - s * .108, y - 1.64, .018, .04)    # 太陽穴
        d -= .003 * g2(x - s * .05, y - 1.53, .03, .02)      # 下巴兩側收
    d += .012 * g2(x, y - 1.512, .026, .018)   # 下巴
    d += .0035 * g2(x, y - 1.646, .014, .014)  # 鼻根
    return d


def sculpt(p):
    if p.z < .005:
        return None
    n = Vector((p.x / HR[0] ** 2, (p.y - HC[1]) / HR[1] ** 2, p.z / HR[2] ** 2)).normalized()
    return tuple(p + n * face_d(p.x, p.y) * sstep(.005, .07, p.z))


each_vert(head, sculpt)
bpy.context.view_layer.update()
_hbvh = BVHTree.FromObject(head, bpy.context.evaluated_depsgraph_get())


def surf(x, y, off=0.0):
    """臉表面上 (x, y) 的點（three 座標），off 為沿法線外推"""
    loc, nor, i, d = _hbvh.ray_cast(V(x, y, .6), V(0, 0, -1))
    if loc is None:
        return Vector((x, y, .12))
    p, n = Vector(T(loc)), Vector(T(nor))
    return p + n * off


def skin_col(p, n):
    c = mix(SKIN_SH, SKIN, sstep(1.5, 1.6, p.y) * .7 + .3 * max(0, n.y + .3))
    for s in (-1, 1):
        d = Vector((p.x - s * .078, p.y - 1.585, (p.z - .125) * .6)).length
        c = mix(c, 0xe8a490, sstep(.045, 0, d) * .55)
    c = mix(c, 0xe89a80, sstep(.034, 0, Vector((p.x, p.y - 1.598)).length) * .45 * (p.z > .1))  # 鼻頭一圈偏暖
    c = mix(c, 0xc49680, sstep(1.56, 1.47, p.y) * .5 * (p.z < .12))  # 下顎陰影
    c = mix(c, 0xc28c72, sstep(-.25, -.6, n.y) * .6)                  # 下巴底面
    c = mix(c, SKIN_SH, sstep(.55, .9, abs(n.x)) * .35 * (p.z > .02))  # 臉側的面
    c = mix(c, 0xcf9478, math.exp(-(p.x / .014) ** 2 - ((p.y - 1.576) / .007) ** 2) * .55 * (p.z > .1))  # 鼻子投在上唇的影子
    return c


def hair_mask(p):
    ax = abs(p.x)
    if p.z > 0:
        hl = 1.708 - .045 * sstep(.03, .12, ax)
        if ax > .1:
            hl = min(hl, 1.6 + .08 * sstep(.03, .1, p.z))
    else:
        hl = 1.6 - .075 * sstep(0, -.09, p.z)
    return sstep(hl - .004, hl + .012, p.y)


paint(head, lambda p, n: mix(mix(skin_col(p, n), SKIN_SH, sstep(0, -.012, face_d(p.x, p.y)) * .55 * (p.z > .05)), mix(0x3a2215, 0x5a3620, sstep(1.6, 1.75, p.y)), hair_mask(p)))
add(head, ['head'], False)
neck = add(stube('Neck', [(0, 1.39, -.014), (0, 1.47, -.006), (0, 1.55, 0)], [.058, .052, .05], seg=16), ['chest', 'neck', 'head'])
paint(neck, lambda p, n: mix(SKIN_SH, SKIN, sstep(1.43, 1.54, p.y) * .8))

# 鼻子：鼻樑、鼻頭、鼻翼
# 鼻子是一塊楔形：上窄下寬、越往下越凸，底面壓平，讓側面和底面各自落在陰影裡
NCY, NHY = 1.62, .032


def nose_shape(p):
    u, v, w = p.x, p.y, p.z
    t = (1 - v) / 2
    y = NCY + v * NHY
    if v < -.55:
        y = NCY - NHY * .55 - (-v - .55) * NHY * .3
    z0 = surf(0, y).z - .004
    wx = .005 + .0125 * t ** .8
    pz = .004 + .021 * t ** 1.2
    return (u * wx, y, z0 + (w * pz if w > 0 else w * .004))


nose = [ellipsoid('Nose', (0, 0, 0), (1, 1, 1), seg=12, rings=12)]
each_vert(nose[0], nose_shape)



def nose_col(p, n):
    c = mix(skin_col(p, n), 0xe8977e, sstep(1.615, 1.595, p.y) * .4)
    c = mix(c, SKIN_SH, sstep(.35, .85, abs(n.x)) * .45)
    return mix(c, 0xc4886e, sstep(-.15, -.6, n.y) * .85)


for o in nose:
    paint(o, nose_col)
    add(o, ['head'], False)

# 嘴：上唇薄、下唇飽滿、中間一條嘴縫
ul = [tuple(surf(x, y, .0015)) for x, y in [(-.022, 1.561), (-.011, 1.5645), (0, 1.5625), (.011, 1.5645), (.022, 1.561)]]
upper = stube('LipU', ul, [.0018, .0042, .0042, .0042, .0018], per=2, seg=8, flat=.55, up=(0, 0, 1))
ll = [tuple(surf(x, y, .0018)) for x, y in [(-.017, 1.5515), (0, 1.5485), (.017, 1.5515)]]
lower = stube('LipL', ll, [.0025, .0056, .0025], per=3, seg=8, flat=.6, up=(0, 0, 1))
ml = [tuple(surf(x, y, .0022)) for x, y in [(-.025, 1.5585), (-.012, 1.557), (0, 1.5568), (.012, 1.557), (.025, 1.5585)]]
mline = stube('MouthLine', ml, [.0012, .0017, .0017, .0017, .0012], per=2, seg=6)
paint(upper, lambda p, n: 0xb8716a)
paint(lower, lambda p, n: mix(0xc98378, 0xdd9d8e, sstep(1.546, 1.552, p.y)))
paint(mline, lambda p, n: 0x6e3531)
for o in (upper, lower, mline):
    add(o, ['head'], False)

# 大眼睛：眼球嵌進眼窩，上眼瞼＋睫毛線、下眼瞼、雙眼皮摺，虹膜上深下淺
EYE_R = (.031, .036, .0095)
for s in (-1, 1):
    sp = surf(s * .058, 1.621, 0)
    ec = Vector((s * .058, 1.621, sp.z - .004))
    R = Matrix.Rotation(math.radians(s * 24), 3, 'Y') @ Matrix.Rotation(math.radians(-4), 3, 'X')  # three 座標：y 軸偏轉，x 軸俯仰

    def ep(u, v, w, ec=ec, R=R, s=s):
        return tuple(ec + R @ Vector((u * s, v, w)))

    def eyepart(name, c, r, col, seg=18, rings=12):
        o = ellipsoid(name, (0, 0, 0), r, seg=seg, rings=rings)
        each_vert(o, lambda p, c=c: ep(p.x * s + c[0], p.y + c[1], p.z + c[2]))
        paint(o, col)
        add(o, ['head'], False)
        return o
    eyepart('EyeW', (0, 0, 0), EYE_R, lambda p, n, ec=ec: mix(0xf3efe6, 0xc9bfb6, sstep(ec.y + .004, ec.y + .026, p.y)), seg=16, rings=12)
    eyepart('Iris', (-.001, -.003, .0046), (.021, .0265, .0052),
            lambda p, n, ec=ec: mix(mix(mix(0x243048, 0x4a78a6, sstep(ec.y + .02, ec.y - .004, p.y)), 0x8fb9d4, sstep(ec.y - .006, ec.y - .024, p.y) * .8), 0x1c2234,
                                    sstep(.8, .97, math.hypot((p.x - ec.x) / .021, (p.y - ec.y + .003) / .0265))), seg=14, rings=10)
    eyepart('Pupil', (-.001, -.002, .0086), (.0085, .0125, .003), lambda p, n: 0x0e1016, seg=10, rings=6)
    eyepart('Glint', (-.007, .006, .0104), (.0055, .0065, .0015), lambda p, n: 0xffffff, seg=10, rings=6)
    eyepart('Glint2', (.006, -.012, .0098), (.0028, .0028, .0012), lambda p, n: 0xe8f2ff, seg=8, rings=5)
    # 上眼瞼：沿眼眶上緣，深色睫毛線，外眼角往上翹
    th = [math.radians(a) for a in (192, 160, 125, 90, 55, 22, -4)]

    def lidv(u):
        return EYE_R[1] * (.12 + .5 * math.sqrt(max(0, 1 - (u / EYE_R[0]) ** 2)))

    def eyez(u, v):
        return EYE_R[2] * math.sqrt(max(0, 1 - (u / EYE_R[0]) ** 2 - (v / EYE_R[1]) ** 2))
    lid = [ep(math.cos(a) * EYE_R[0] * 1.02, lidv(math.cos(a) * EYE_R[0]) - .001, eyez(math.cos(a) * EYE_R[0], lidv(math.cos(a) * EYE_R[0])) + .0022) for a in th]
    lid.append(ep(EYE_R[0] * 1.28, lidv(EYE_R[0]) + .005, -.004))
    lc = ellipsoid('Lid', (0, 0, 0), (EYE_R[0] * 1.06, EYE_R[1] * 1.04, EYE_R[2] * 1.25), seg=16, rings=12)
    bm = bmesh.new(); bm.from_mesh(lc.data)
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if (lambda c: c[2] < -.002 or c[1] < lidv(c[0]) - .0012)(T(f.calc_center_median()))], context='FACES')
    bm.to_mesh(lc.data); bm.free()
    each_vert(lc, lambda p: ep(p.x * s, p.y, p.z + .0004))
    paint(lc, lambda p, n: mix(SKIN, SKIN_SH, .3))
    add(lc, ['head'], False)
    lash = stube('Lash', lid, [.0018, .0032, .0042, .0046, .0046, .0042, .0032, .0008], per=2, seg=6, flat=.55, up=(0, 0, 1))
    paint(lash, lambda p, n: 0x21161a)
    add(lash, ['head'], False)
    fold = [ep(math.cos(a) * EYE_R[0] * 1.1, math.sin(a) * EYE_R[1] * 1.02 + .006, .0035) for a in th[1:-1]]
    lidf = stube('LidFold', fold, [.002, .0045, .005, .0045, .002], per=2, seg=8, flat=.5, up=(0, 0, 1))
    paint(lidf, lambda p, n: mix(SKIN_SH, SKIN, .45))
    add(lidf, ['head'], False)
    bl = [ep(math.cos(a) * EYE_R[0] * 1.0, -math.sin(a) * EYE_R[1] * .95, .004) for a in [math.radians(x) for x in (170, 130, 90, 50, 12)]]
    blid = stube('LidLow', bl, [.001, .0024, .0028, .0024, .001], per=2, seg=6, flat=.6, up=(0, 0, 1))
    paint(blid, lambda p, n: mix(SKIN_SH, 0xb77a6a, .4))
    add(blid, ['head'], False)
    # 眉毛：沿眉骨，內粗外細
    bp = [tuple(surf(s * x, y, .0035)) for x, y in [(.024, 1.676), (.046, 1.685), (.07, 1.686), (.094, 1.676)]]
    brow = stube('Brow', bp, [.0055, .0068, .0052, .0018], seg=6, flat=.5, up=(0, 0, 1))
    paint(brow, lambda p, n: 0x4a2c1c)
    add(brow, ['head'], False)
    # 尖耳朵：外耳＋內凹（深一點的粉色）＋耳輪
    ep_ = [(s * .136, 1.616, -.004), (s * .178, 1.64, -.03), (s * .222, 1.668, -.052), (s * .258, 1.693, -.073)]
    ear = stube('Ear', ep_, [.036, .029, .016, .002], seg=10, flat=.32, up=(0, 0, 1))
    paint(ear, lambda p, n: mix(mix(SKIN, SKIN_W, .35), SKIN_SH, sstep(.15, .13, abs(p.x)) * .6))
    add(ear, ['head'])
    ein = stube('EarIn', [(x * .99, y - .002, z + .0045) for x, y, z in ep_[:3]] + [(s * .238, 1.68, -.054)], [.022, .018, .009, .002], seg=8, flat=.22, up=(0, 0, 1))
    paint(ein, lambda p, n: 0xd08c7a)
    add(ein, ['head'])
    rim = stube('EarRim', [(s * .15, 1.648, -.003), (s * .19, 1.667, -.02), (s * .232, 1.688, -.045), (s * .258, 1.697, -.07)], [.005, .006, .005, .001], seg=6)
    paint(rim, lambda p, n: mix(SKIN, SKIN_W, .3))
    add(rim, ['head'])

# ── 頭髮：頭皮底層＋一撮撮扁平髮束（瀏海、鬢角、後腦、馬尾），根深梢亮 ──
HAIR, HAIR_D, HAIR_L = 0x6a4128, 0x3a2215, 0x9a6a42
HS_C, HS_R = Vector((0, 1.637, -.006)), Vector((.156, .176, .167))


def shell_pt(p, infl):
    d = p - HS_C
    q = Vector((d.x / HS_R.x, d.y / HS_R.y, d.z / HS_R.z))
    L = q.length
    if L >= 1 + infl:
        return p
    q = q / max(L, 1e-6) * (1 + infl)
    return HS_C + Vector((q.x * HS_R.x, q.y * HS_R.y, q.z * HS_R.z))


def shell_n(p):
    d = p - HS_C
    return Vector((d.x / HS_R.x ** 2, d.y / HS_R.y ** 2, d.z / HS_R.z ** 2)).normalized()


def hair_col(p, n):
    c = mix(HAIR_D, HAIR, sstep(1.5, 1.7, p.y) * .8 + .2)
    c = mix(c, HAIR_L, sstep(.2, .8, n.y) * .45 + .12 * noisev(p, 30))
    return c


def lock(name, root, dirv, L, w, steps=6, grav=1.0, i0=.02, i1=.1, flick=.02, thick=.34, bones=('head',), taper=None, seg=6):
    p = shell_pt(Vector(root), i0)
    d = Vector(dirv).normalized()
    pts = [p.copy()]
    for k in range(steps):
        t = (k + 1) / steps
        d = (d + Vector((0, -1, 0)) * grav / steps).normalized()
        p = shell_pt(p + d * (L / steps), i0 + (i1 - i0) * t)
        nn = shell_n(p)
        d = (d - nn * max(0, d.dot(nn)) * .5).normalized()
        pts.append(p.copy())
    pts[-1] = pts[-1] + shell_n(pts[-1]) * flick
    pr = taper or [.8, 1, 1, .95, .82, .62, .1]
    pr = [w * pr[min(len(pr) - 1, int(round(k * (len(pr) - 1) / steps)))] for k in range(steps + 1)]
    o = stube(name, [tuple(q) for q in pts], pr, per=1, seg=seg, flat=thick, up=tuple(shell_n(Vector(root))))
    paint(o, hair_col)
    add(o, list(bones))
    return o



random.seed(7)
# 瀏海：從帽緣下往前、往側邊掃，右分
for i, (x, L, sw) in enumerate([(-.1, .15, -.2), (-.058, .148, -.05), (-.018, .14, .15), (.022, .14, .3), (.062, .15, .45), (.1, .15, .55)]):
    lock('Bang', (x * .8, 1.775, .075), (x * 1.8 + sw * .9, -.9, .55), L * (1 + .1 * math.sin(i * 2.7)), .06 - abs(x) * .1, steps=6, grav=1.5, i0=.018, i1=.018, flick=.012, thick=.3)
# 鬢角：臉兩側、耳朵前面
for s in (-1, 1):
    lock('SideLock', (s * .118, 1.73, .07), (s * .25, -1, .15), .2, .042, steps=6, grav=1.5, i0=.02, i1=.03, flick=.01, thick=.32)
for s in (-1, 1):
    for k in range(3):
        lock('SideBack', (s * .14, 1.745, .02 - k * .055), (s * .35, -1, -.1 - k * .12), .18 - k * .01, .058, steps=6, grav=1.2, i0=.02, i1=.04, flick=.02)
# 頭頂（帽子下探出來的一圈）
for k in range(7):
    a = math.radians(-150 + k * 50)
    lock('CrownLock', (math.sin(a) * .1, 1.79, -.02 + math.cos(a) * .09), (math.sin(a), -.3, math.cos(a)), .11, .052, steps=4, grav=1.5, i0=.035, i1=.05, flick=.015)
# 後腦往馬尾收攏
tieP = Vector((0, 1.605, -.182))
for k in range(7):
    a = math.radians(-84 + k * 28)
    r0 = Vector((math.sin(a) * .135, 1.745 - abs(math.sin(a)) * .03, -math.cos(a) * .135 - .01))
    d = (tieP - r0)
    lock('BackLock', tuple(r0), tuple(d), d.length * 1.05, .06, steps=5, grav=.2, i0=.03, i1=.02, flick=0, taper=[.85, 1, .95, .8, .55, .32])
# 頸背短髮
for k in range(5):
    a = math.radians(-72 + k * 36)
    r0 = (math.sin(a) * .14, 1.6, -math.cos(a) * .14 - .01)
    lock('NapeLock', r0, (math.sin(a) * .2, -1, -math.cos(a) * .3), .1, .052, steps=4, grav=1, i0=.02, i1=.035, flick=.02, bones=('head', 'neck'))
# 馬尾：五束扭在一起
tie = add(stube('HairTie', [(0, 1.612, -.176), (0, 1.604, -.19), (.001, 1.594, -.2)], [.03, .034, .03], seg=14), ['head'])
paint(tie, lambda p, n: mix(0xa84a3e, 0xc9665a, .5 + .5 * n.y))
for k in range(5):
    a = k / 5 * TAU
    o = Vector((math.cos(a) * .012, 0, math.sin(a) * .012))
    pts = [tieP + Vector((0, -.004, -.018)) + o, Vector((.004, 1.55, -.235)) + o * 1.6, Vector((.012 + math.cos(a + .8) * .014, 1.47, -.245 + math.sin(a + .8) * .01)),
           Vector((.022 + math.cos(a + 1.6) * .02, 1.4, -.228)), Vector((.03 + math.cos(a + 2.2) * .03, 1.35 - k * .01, -.2 + math.sin(a) * .015))]
    t = stube('Pony', [tuple(q) for q in pts], [.02, .026, .022, .014, .003], per=2, seg=7, flat=.7, up=(math.cos(a), 0, math.sin(a)))
    paint(t, lambda p, n: mix(mix(HAIR_D, HAIR, sstep(1.35, 1.58, p.y)), HAIR_L, sstep(.1, .9, n.y) * .35 + sstep(1.45, 1.36, p.y) * .25))
    add(t, ['head', 'neck', 'chest'])

# ── 貝雷帽（顏料材質）：帽身蓬鬆往一側垂、帽緣一圈滾邊、頂上一根小梗、六片縫線 ──
BP, BR = (.025, 1.758, -.02), (-9, 0, -15)
beret = lathe('Beret', [(.128, -.004), (.15, .006), (.19, .026), (.208, .05), (.203, .074), (.176, .096), (.122, .111), (.058, .118), (0, .12)], seg=32, pivot=BP,
              wobble=lambda a, y: -.03 * abs(math.cos(a * 3)) ** 10 * sstep(.02, .11, y) + .02 * math.sin(a * 5 + 1) * sstep(.05, .0, y))
beret.data.materials[0] = mat('paint')
each_vert(beret, lambda p: (p.x, p.y - .026 * sstep(0, .2, p.x) * sstep(.03, .07, p.y), p.z))  # 往左垂
band = tube('BeretBand', loop_pts((0, 0, 0), .133, .133, 32, rfn=lambda a: 1), .011, seg=6, pivot=BP, caps=False)
stem = stube('BeretStem', [(0, .115, 0), (.003, .135, .002), (.012, .149, .004)], [.009, .007, .004], seg=8, pivot=BP)
for o in (beret, band, stem):
    o.data.materials[0] = mat('paint')
    place(o, BP, BR)
bpy.context.view_layer.update()
paint(beret, lambda p, n: (lambda v: (v, v, v))(.62 + .3 * sstep(-.4, .7, n.y) - .06 * max(0, -n.y)))
paint(band, lambda p, n: (.5, .5, .5))
paint(stem, lambda p, n: (.55, .55, .55))
for o in (beret, band, stem):
    add(o, ['head'])

# ── 上衣：腰帶束起、下擺外張有大皺褶、腰帶上方微蓬、左右縫線、顏料污漬 ──
TUNIC, TUNIC_D, TUNIC_S = 0xe7dabf, 0xb9a585, 0xd3c3a3
STAINS = [0xcf5a4c, 0x4f8cc4, 0xdcb14a, 0x5da663]
tunic_prof = [(.215, .685), (.222, .71), (.212, .76), (.196, .82), (.18, .87), (.166, .91), (.158, .95), (.16, .99), (.172, 1.04), (.18, 1.1), (.182, 1.16),
              (.188, 1.22), (.194, 1.28), (.195, 1.33), (.188, 1.36), (.178, 1.39), (.162, 1.418), (.14, 1.443), (.115, 1.465), (.09, 1.484), (.066, 1.5)]
SZ = .74


def skirt_f(a):
    return .55 * math.sin(6 * a + .7) + .3 * math.sin(11 * a + 2.1) + .25 * math.sin(3 * a + .2)


tunic_prof = [(q[0], q[1]) for q in spline([(r, y, 0) for r, y in tunic_prof], 2)]
tunic = lathe('Tunic', tunic_prof, seg=34, sz=SZ, cap_top=False, cap_bot=False,
              wobble=lambda a, y: .1 * skirt_f(a) * sstep(.93, .69, y) + .035 * math.sin(9 * a + 1) * sstep(.99, 1.03, y) * sstep(1.12, 1.04, y))


def tunic_shape(p):
    x, y, z = p
    a = math.atan2(z / SZ, x)
    if y < .72:
        y += (.022 * math.sin(2 * a + .6) + .01 * math.sin(5 * a)) * sstep(.72, .686, y)
    if y > 1.15:  # 胸口略飽滿、背部平、肩膀往前一點
        z = z * (1.05 if z > 0 else .96) + .006 * sstep(1.15, 1.35, y)
    return (x, y, z)


each_vert(tunic, tunic_shape)
tunic.data.materials[0] = mat('cloth2s')
random.seed(21)
stains = []
for _ in range(6):
    q = Vector((random.uniform(-.15, .15), random.uniform(.74, .88), 1 if random.random() < .7 else -1))
    stains.append((random.choice(STAINS), q, random.uniform(.022, .034), random.uniform(0, 6)))


def tunic_col(p, n):
    a = math.atan2(p.z / SZ, p.x)
    c = mix(TUNIC_S, TUNIC, .55 + .45 * max(0, n.y * .5 + n.z * .3 + .3))
    c = mix(c, TUNIC_D, sstep(.72, .69, p.y) * .5)                       # 下擺縫邊
    c = mix(c, TUNIC_D, sstep(.018, .0, abs(abs(a) - math.pi / 2) * .18) * .35)  # 側縫
    c = mix(c, 0xc9b995, .25 * noisev(p, 9, 2) + .1)
    c = mix(c, TUNIC_D, sstep(1.07, .99, p.y) * sstep(.95, .99, p.y) * .45)            # 腰帶上方的蓬起處
    c = mix(c, TUNIC_D, sstep(.06, .0, abs(abs(p.x) - .17)) * sstep(1.2, 1.32, p.y) * sstep(1.4, 1.34, p.y) * .4)  # 腋下
    c = mix(c, TUNIC_D, sstep(.2, -1, math.sin(5 * a + 2.3 + p.y * 4)) * .18 * sstep(1.02, 1.12, p.y) * sstep(1.32, 1.2, p.y))  # 胸口直向淺摺
    c = mix(c, TUNIC_D, sstep(.1, -.9, skirt_f(a)) * .4 * sstep(.95, .74, p.y))
    c = mix(c, TUNIC_D, sstep(.2, -1, math.sin(9 * a + 1)) * .3 * sstep(.99, 1.03, p.y) * sstep(1.12, 1.04, p.y))
    for col, q, r, ph in ():
        if (p.z > 0) != (q.z > 0):
            continue
        dx, dy = p.x - q.x, p.y - q.y
        rr = r * (1 + .35 * math.sin(math.atan2(dy, dx) * 5 + ph))
        drip = r * .5 * sstep(0, -.05, dy) * sstep(r * .6, 0, abs(dx))  # 往下流一點
        if math.hypot(dx, dy * (.55 if dy < 0 else 1)) < rr + drip:
            c = mix(col, 0x8a8a8a, .12)
    if p.y > 1.46:
        c = mix(c, TUNIC_D, .5)
    return c


paint(tunic, tunic_col)
add(tunic, ['hips', 'spine', 'chest', 'shoulder.L', 'shoulder.R'])
bpy.context.view_layer.update()
_tb = BVHTree.FromObject(tunic, bpy.context.evaluated_depsgraph_get())

# ── 背心（第二層，灰綠色）：V 領、腰身收緊、腰帶下短裙擺外張、兩側開衩，邊緣滾皮邊 ──
VEST_C, VEST_D, VEST_L = 0x587c76, 0x37514d, 0x729690
vest_prof = [(.232, .79), (.215, .82), (.197, .855), (.18, .89), (.173, .92), (.17, .95), (.173, .99), (.185, 1.04), (.193, 1.1), (.196, 1.16), (.202, 1.22),
             (.208, 1.28), (.209, 1.33), (.204, 1.36), (.193, 1.39), (.176, 1.418), (.154, 1.443), (.128, 1.465), (.1, 1.487), (.08, 1.505)]
vest = lathe('Vest', vest_prof, seg=36, sz=SZ, cap_top=False, cap_bot=False, wobble=lambda a, y: .07 * skirt_f(a + 1.3) * sstep(.9, .79, y))
each_vert(vest, tunic_shape)


def vest_cut(c):
    x, y, z = c
    if z > 0 and abs(x) < .088 * sstep(1.2, 1.5, y) + .003:
        return True
    a = math.atan2(z, x)
    return y < .9 and min(abs(a), math.pi - abs(a)) < .16 * sstep(.9, .79, y)


bm = bmesh.new(); bm.from_mesh(vest.data)
bmesh.ops.delete(bm, geom=[f for f in bm.faces if vest_cut(T(f.calc_center_median()))], context='FACES')
bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
for v in bm.verts:  # V 領邊緣的頂點拉到同一條斜線上，免得鋸齒
    x, y, z = T(v.co)
    if v.is_boundary and z > 0 and 1.17 < y < 1.51 and abs(x) < .12:
        r = math.hypot(x, z / SZ)
        w = .088 * sstep(1.2, 1.5, y) + .003
        nx = math.copysign(min(w, r * .98), x if abs(x) > 1e-5 else 1)
        v.co = V(nx, y, SZ * math.sqrt(max(0, r * r - nx * nx)))
bm.to_mesh(vest.data); bm.free()
vest.data.materials[0] = mat('cloth2s')


def vest_col(p, n):
    a = math.atan2(p.z / SZ, p.x)
    c = mix(VEST_D, VEST_C, .5 + .5 * max(0, n.y * .5 + n.z * .3 + .3))
    c = mix(c, VEST_D, sstep(.1, -.9, skirt_f(a + 1.3)) * .45 * sstep(.92, .8, p.y))
    c = mix(c, VEST_L, .18 * noisev(p, 8, 4) + .04 + sstep(.5, .9, n.y) * .2)
    c = mix(c, VEST_D, sstep(1.07, .99, p.y) * sstep(.95, .99, p.y) * .35)
    return c


paint(vest, vest_col)
add(vest, ['hips', 'spine', 'chest', 'shoulder.L', 'shoulder.R'])
bpy.context.view_layer.update()
_vb = BVHTree.FromObject(vest, bpy.context.evaluated_depsgraph_get())


def on_vest(x, y, sd, off=.0):
    loc, nor, i, dd = _vb.ray_cast(V(x, y, sd * .6), V(0, 0, -sd))
    if loc is None:
        return None
    return Vector(T(loc)) + Vector(T(nor)) * off


# 滾邊：V 領兩側、下擺（開衩處斷開）
VT = 0x6a4630
for sg in (-1, 1):
    vp = [on_vest(sg * (.088 * sstep(1.2, 1.5, y) + .006), y, 1, .002) for y in [1.2 + k * .035 for k in range(9)]]
    vp = [tuple(q) for q in vp if q is not None]
    tr = stube('VestTrim', vp, .0065, per=2, seg=4)
    paint(tr, lambda p, n: mix(VT, 0x9a6e4a, .3 + .4 * max(0, n.y)))
    add(tr, ['spine', 'chest'])
chains, cur = [], []
for i in range(73):
    a = i / 72 * TAU
    loc, nor, k_, dd = _vb.ray_cast(V(math.cos(a) * .5, .797, math.sin(a) * .5), V(-math.cos(a), 0, -math.sin(a)))
    if loc is None or min(abs(a), abs(a - math.pi), abs(a - TAU)) < .2:
        if len(cur) > 1:
            chains.append(cur)
        cur = []
        continue
    cur.append(tuple(Vector(T(loc)) + Vector(T(nor)) * .002))
if len(cur) > 1:
    chains.append(cur)
for ch in chains:
    tr = stube('VestHem', ch, .0065, per=1, seg=4)
    paint(tr, lambda p, n: mix(VT, 0x9a6e4a, .3 + .4 * max(0, n.y)))
    add(tr, ['hips', 'thigh.L', 'thigh.R'])
# 顏料點：背心上幾點、下擺露出的上衣上兩點（少一點）
random.seed(5)
for k, (x, y, sd, r, col, bv) in enumerate([(-.1, 1.08, 1, .022, STAINS[2], _vb), (.11, 1.27, 1, .017, STAINS[0], _vb), (.06, 1.18, -1, .02, STAINS[1], _vb),
                                             (.03, .74, 1, .02, STAINS[1], _tb), (-.07, .73, -1, .017, STAINS[0], _tb)]):
    blobs = [(0, 0, r, r * .85, 12), (math.cos(k * 2.3) * r * 1.3, math.sin(k * 2.3) * r * 1.25, r * .26, r * .24, 6)]
    for bx, by, rx, ry, sg in blobs:
        loc, nor, i, dd = bv.ray_cast(V(x + bx, y + by, sd * .5), V(0, 0, -sd))
        if loc is None:
            continue
        p0, n0 = Vector(T(loc)), Vector(T(nor))
        sp_ = ellipsoid('Splat', (0, 0, 0), (rx, ry, .0022), seg=sg, rings=3)
        each_vert(sp_, lambda p, k=k: (p.x * (1 + .22 * math.sin(math.atan2(p.y, p.x) * 5 + k)), p.y * (1 + .22 * math.sin(math.atan2(p.y, p.x) * 5 + k)), p.z))
        q = Vector((0, 0, 1)).rotation_difference(n0)
        each_vert(sp_, lambda p, q=q, p0=p0, n0=n0: tuple(p0 + n0 * .0016 + q @ p))
        paint(sp_, lambda p, n, col=col: mix(col, 0x9a9a9a, .15))
        add(sp_, ['spine', 'chest'] if y > 1.02 else ['hips'], False)
# 下擺滾邊：沿著下擺邊緣重新取點
hp = []
for i in range(73):
    a = i / 72 * TAU
    r = .218 * (1 + .1 * skirt_f(a) * .98) - .004
    hp.append((math.cos(a) * r, .688 + .022 * math.sin(2 * a + .6) + .01 * math.sin(5 * a), math.sin(a) * r * SZ))
hem = tube('TunicHem', hp, .0075, seg=4, caps=False)
paint(hem, lambda p, n: mix(TUNIC_D, TUNIC_S, .35))
add(hem, ['hips', 'thigh.L', 'thigh.R'])

# ── 腰帶（有厚度、扣環、扣舌、皮帶尾）、兩個皮包、斜背帶（胸前插三支顏料管）、背後掛筆的皮環 ──
LEATHER, LEATHER_D, LEATHER_L = 0x7a5136, 0x4a2f1e, 0xa27550
BRASS = 0xc9a45a
belt = lathe('Belt', [(.172, .898), (.183, .905), (.186, .94), (.183, .978), (.172, .986)], seg=48, sz=.745, cap_top=False, cap_bot=False)
paint(belt, lambda p, n: mix(mix(LEATHER_D, LEATHER, .5 + .5 * abs(n.y) * 0 + .5 * sstep(.9, .91, p.y) * sstep(.985, .975, p.y)), LEATHER_L, sstep(.004, 0, abs(p.y - .9)) * .5 + sstep(.004, 0, abs(p.y - .984)) * .5))
add(belt, ['hips'])
bz = .745 * .186
buckle = tube('Buckle', [(-.028, .92, bz + .01), (-.028, .966, bz + .01), (.028, .966, bz + .01), (.028, .92, bz + .01), (-.028, .92, bz + .01)], .0055, seg=6, caps=False)
paint(buckle, lambda p, n: mix(0x8a6a34, BRASS, .5 + .5 * n.z))
add(buckle, ['hips'])
tongue = rbox('BuckleTongue', (0, .943, bz + .012), (.006, .05, .006), bevel=.002, seg=1)
paint(tongue, lambda p, n: BRASS)
add(tongue, ['hips'])
btail = ribbon('BeltTail', [(.03, .944, bz + .006), (.06, .94, bz - .003), (.078, .925, bz - .01), (.085, .89, bz - .012)], .019, thick=.004, up=(0, 0, 1), cols=4)
paint(btail, lambda p, n: mix(LEATHER, LEATHER_L, .3))
add(btail, ['hips'])


def pouch(name, c, sz, yaw):
    ps = []
    body = rbox(name, (0, 0, 0), sz, bevel=.014, seg=3)
    flap = rbox(name + 'Flap', (0, sz[1] * .2, sz[2] * .5 + .003), (sz[0] * 1.06, sz[1] * .62, .008), bevel=.004, seg=2)
    each_vert(flap, lambda p: (p.x, p.y, p.z - (p.x / sz[0]) ** 2 * .01 * (p.y < 0)))
    btn = ellipsoid(name + 'Btn', (0, -sz[1] * .05, sz[2] * .5 + .009), (.008, .008, .005), seg=10, rings=6)
    for o in (body, flap, btn):
        rot_about(o, (0, 0, 0), (0, 1, 0), yaw)
        each_vert(o, lambda p: tuple(p + Vector(c)))
    paint(body, lambda p, n: mix(LEATHER_D, LEATHER, sstep(c[1] - sz[1] * .5, c[1] + sz[1] * .3, p.y)))
    paint(flap, lambda p, n: mix(LEATHER, LEATHER_L, .35 + .3 * n.y))
    paint(btn, lambda p, n: BRASS)
    for o in (body, flap, btn):
        add(o, ['hips'])


pouch('Pouch', (.15, .885, .095), (.068, .082, .05), 48)
pouch('Pouch2', (-.13, .9, -.1), (.085, .09, .055), 215)
# 斜背帶：右肩 → 左腰，前後各一段
strap_f = [(-.158, 1.435, .03), (-.13, 1.39, .12), (-.075, 1.3, .148), (.0, 1.19, .146), (.075, 1.08, .138), (.14, .99, .105), (.172, .945, .06)]
strap_b = [(-.158, 1.435, .03), (-.15, 1.4, -.07), (-.1, 1.3, -.12), (-.02, 1.18, -.13), (.07, 1.06, -.125), (.14, .98, -.1), (.172, .945, .06)]


def strap_fit(pts, sd):
    out = [pts[0]]
    for x, y, z in pts[1:-1]:
        q = on_vest(x, y, sd, .006)
        out.append(tuple(q) if q is not None and abs(q.z) > abs(z) else (x, y, z))
    return out + [pts[-1]]


strap_f, strap_b = strap_fit(strap_f, 1), strap_fit(strap_b, -1)
_sbq = on_vest(-.093, 1.33, 1, .008)
for nm, pts, up in (('Strap', strap_f, (0, .3, 1)), ('StrapB', strap_b, (0, .3, -1))):
    st = ribbon(nm, pts, .02, thick=.0045, up=up, cols=5, per=3)
    paint(st, lambda p, n: mix(LEATHER, LEATHER_L, .25 + .2 * noisev(p, 20)))
    add(st, ['chest', 'spine', 'hips'])
# 背後掛筆：畫筆沿著背帶斜放，兩個皮環套住筆桿再縫到背帶上
_lo, _hi = Vector((.15, .95, -.2)), Vector((-.19, 1.45, -.178))
BACK_AX = (_hi - _lo).normalized()
BACK_GRIP = _lo - BACK_AX * .45
_sbp = [Vector(q) for q in spline(strap_b, 4)]
for yl in (.56, .98):
    c = BACK_GRIP + BACK_AX * yl
    e1 = Vector((0, 0, 1)); e1 = (e1 - BACK_AX * e1.dot(BACK_AX)).normalized(); e2 = BACK_AX.cross(e1)
    ring = tube('BrushLoop', [tuple(c + (e1 * math.cos(a) + e2 * math.sin(a)) * .037) for a in [k / 16 * TAU for k in range(17)]], .005, seg=4, caps=False, flat=2.2, up=tuple(BACK_AX))
    near = min(_sbp, key=lambda q: (q - c).length)
    tab = ribbon('BrushLoopTab', [tuple(c + e1 * .036), tuple((c + e1 * .036 + near) / 2 + Vector((0, 0, -.004))), tuple(near + Vector((0, 0, -.004)))], .012, thick=.003, up=tuple(e2), cols=3, per=2)
    for o in (ring, tab):
        paint(o, lambda p, n: mix(LEATHER_D, LEATHER, .5 + .4 * max(0, n.y)))
        add(o, ['chest'])
sb = rbox('StrapBuckle', tuple(_sbq), (.03, .03, .01), bevel=.004, seg=1)
rot_about(sb, tuple(_sbq), (0, 0, 1), 34)
paint(sb, lambda p, n: BRASS)
add(sb, ['chest'])
# 胸前背帶插著三支顏料管
for k, (col, t) in enumerate(((0xc4574a, .38), (0x4f86b8, .5), (0xd8ae48, .62))):
    base = Vector(spline(strap_f, 3)[int(t * 18)])
    d = Vector((.26, .9, 0)).normalized()
    tb = stube('PaintTube', [tuple(base - d * .035 + Vector((0, 0, .008))), tuple(base + d * .03 + Vector((0, 0, .01)))], [.0085, .0085], per=1, seg=8)
    capo = stube('PaintCap', [tuple(base + d * .03 + Vector((0, 0, .01))), tuple(base + d * .046 + Vector((0, 0, .01)))], [.0065, .005], per=1, seg=8)
    paint(tb, lambda p, n, col=col, base=base: mix(0xd8d4cc, col, sstep(-.01, .01, (p - base).dot(d))))
    paint(capo, lambda p, n: 0x3a3a40)
    add(tb, ['chest'])
    add(capo, ['chest'])

# ── 圍巾（顏料材質）：兩圈繞頸、後頸打結、兩條帶流蘇的尾巴 ──
sc_parts = []
w1 = tube('Scarf', loop_pts((0, 1.462, -.004), .102, .092, 30, yfn=lambda a: -.012 * math.sin(a), rfn=lambda a: 1 + .04 * math.sin(a * 3)), .03, seg=8, caps=False)
w2 = tube('ScarfWrap', loop_pts((.004, 1.494, -.008), .093, .086, 30, yfn=lambda a: -.008 * math.sin(a + .5), rfn=lambda a: 1 + .05 * math.sin(a * 4 + 1)), .026, seg=8, caps=False)
knot = [ellipsoid('ScarfKnot', (.045, 1.462, -.108), (.036, .032, .028), seg=14, rings=10), ellipsoid('ScarfKnot2', (.03, 1.44, -.118), (.026, .022, .022), seg=12, rings=8)]
tail1 = ribbon('ScarfTail', [(.05, 1.45, -.12), (.07, 1.36, -.155), (.088, 1.26, -.178), (.1, 1.16, -.19), (.108, 1.08, -.192)], [.03, .038, .042, .044, .045], thick=.006, up=(0, 0, -1), cols=8, fold=.008, nfold=3, fringe=.02)
tail2 = ribbon('ScarfTail2', [(.02, 1.45, -.125), (.0, 1.37, -.16), (-.012, 1.29, -.18), (-.018, 1.22, -.188)], [.028, .034, .037, .038], thick=.006, up=(0, 0, -1), cols=8, fold=.007, nfold=2, fringe=.018)
for o in [w1, w2] + knot + [tail1, tail2]:
    o.data.materials[0] = mat('paint')
    paint(o, lambda p, n: (lambda v: (v, v, v))(.72 + .22 * sstep(-.5, .8, n.y + n.z * .3) - (.14 if (p.y < 1.14 or 1.2 < p.y < 1.225) else 0) * (p.z < -.14)))
add(w1, ['neck', 'chest'])
add(w2, ['neck', 'chest'])
for o in knot:
    add(o, ['chest', 'neck'])
add(tail1, ['chest', 'scarf1', 'scarf2'])
add(tail2, ['chest', 'scarf1', 'scarf2'])

# ── 手臂：泡泡短袖（有皺褶、反摺袖口）、前臂、皮護腕（三道綁帶）、手（半指手套、四指、拇指） ──
HANDS = {}
for side, s in S.items():
    j = J[side]
    sh, el, wr, hn = Vector(j['sh']), Vector(j['el']), Vector(j['wr']), Vector(j['hn'])
    sl = stube('Sleeve' + side, [lerp3(j['sh0'], j['sh'], .25), lerp3(j['sh0'], j['sh'], .75), j['sh'], lerp3(j['sh'], j['el'], .35), lerp3(j['sh'], j['el'], .68)],
               [.056, .066, .07, .074, .076], per=2, seg=16)
    radial(sl, sh, el, lambda t, a, r: .006 * math.sin(a * 5 + t * 6) * sstep(.1, .5, t) + .004 * math.sin(a * 9 + 1), ref=(0, 1, 0))

    def droop(p, sh=sh, el=el):
        ax = el - sh
        L = ax.length
        axn = ax / L
        t = (p - sh).dot(axn) / L
        r = p - sh - axn * (t * L)
        if t < .1 or r.length < 1e-6:
            return None
        under = max(0, -r.normalized().y) ** 1.5
        k = sstep(.1, .75, t)
        return tuple(p + r.normalized() * (.014 * k * under) + Vector((0, -1, 0)) * (.034 * k * k * under))
    each_vert(sl, droop)
    paint(sl, lambda p, n: mix(TUNIC_S, TUNIC, .55 + .45 * max(0, n.y * .6 + .3)))
    add(sl, ['chest', 'shoulder.' + side, 'upperarm.' + side])
    d = (el - sh).normalized()
    c = sh + (el - sh) * .69
    cuff = stube('Cuff' + side, [tuple(c - d * .018), tuple(c - d * .004), tuple(c + d * .008)], [.074, .08, .076], per=1, seg=16)
    radial(cuff, sh, el, lambda t, a, r: .003 * math.sin(a * 6))
    each_vert(cuff, droop)
    paint(cuff, lambda p, n, c=c: mix(TUNIC_D, TUNIC_S, .45 + .4 * max(0, n.y)))
    add(cuff, ['upperarm.' + side])
    fa = stube('Forearm' + side, [lerp3(j['sh'], j['el'], .6), lerp3(j['sh'], j['el'], .9), j['el'], lerp3(j['el'], j['wr'], .35), lerp3(j['el'], j['wr'], .75), tuple(wr + (hn - wr).normalized() * .01)],
               [.046, .045, .045, .044, .037, .031], per=2, seg=14, flat=.86, up=(0, 0, 1))
    paint(fa, lambda p, n: mix(SKIN_SH, SKIN, .5 + .5 * max(0, n.y + n.z * .3)))
    add(fa, ['upperarm.' + side, 'forearm.' + side, 'hand.' + side])
    # 護腕
    br = stube('Bracer' + side, [lerp3(j['el'], j['wr'], .4), lerp3(j['el'], j['wr'], .7), tuple(wr + (hn - wr).normalized() * .005)], [.045, .041, .036], per=2, seg=14, flat=.88, up=(0, 0, 1))
    paint(br, lambda p, n: mix(LEATHER, LEATHER_L, .2 + .35 * max(0, n.y)))
    add(br, ['forearm.' + side, 'hand.' + side])
    for t in (.46, .66, .86):
        pc = Vector(lerp3(j['el'], j['wr'], t))
        dd = (wr - el).normalized()
        rr = [.045, .042, .038][[.46, .66, .86].index(t)] + .003
        ring = stube('BracerTie', [tuple(pc - dd * .005), tuple(pc + dd * .005)], [rr, rr], per=1, seg=10, flat=.88, up=(0, 0, 1))
        paint(ring, lambda p, n: LEATHER_D)
        add(ring, ['forearm.' + side])
    # 手：掌、四指、拇指（右手握筆，左手半握）
    hd = (hn - wr).normalized()
    inw = Vector((-s, 0, 0)); inw = (inw - hd * inw.dot(hd)).normalized()
    fwd = hd.cross(inw).normalized()
    if fwd.z < 0:
        fwd = -fwd
    outw = -inw
    grip = side == 'R'
    A = wr + hd * .06 + inw * (.034 if grip else .014)
    HANDS[side] = dict(A=A, fwd=fwd, hd=hd, inw=inw)
    GLOVE = 0x5e3e28
    palm = rbox('Palm' + side, (0, 0, 0), (.068, .078, .03), bevel=.013, seg=2)
    Mh = Matrix((fwd, hd, outw)).transposed()  # 區域軸：x=fwd（寬）、y=hd（長）、z=outw（厚）
    pc = wr + hd * .048 + outw * .002
    each_vert(palm, lambda p: tuple(pc + Mh @ Vector((p.x * (1 - .12 * (p.y < 0)), p.y, p.z * (1 + .2 * (p.x > 0)))) ))
    paint(palm, lambda p, n: mix(GLOVE, LEATHER_L, .25 + .3 * max(0, n.y)))
    add(palm, ['hand.' + side])
    e1, e2 = outw, hd
    for k, (fo, L) in enumerate(((.024, .074), (.008, .08), (-.008, .077), (-.023, .064))):
        K = wr + hd * .088 + outw * .003 + fwd * fo
        if True:  # 右手繞著筆桿握拳；左手沒拿東西，鬆鬆地握著
            r0 = K - A - fwd * (K - A).dot(fwd)
            ph0 = math.atan2(r0.dot(e2), r0.dot(e1))
            R0, R1 = r0.length, (.047 if grip else .028)
            tot = L * (1 if grip else .9) / ((R0 + R1) / 2)
            pts = [tuple(K - hd * .012)]
            for m in range(5):
                t = m / 4
                ph = ph0 + tot * t
                R_ = R0 + (R1 - R0) * sstep(0, .5, t)
                pts.append(tuple(A + fwd * (fo * 1.05) + e1 * math.cos(ph) * R_ + e2 * math.sin(ph) * R_))
        else:
            pts = [tuple(K - hd * .012)]
            for m in range(5):
                t = m / 4
                ang = .35 + t * 1.15
                pts.append(tuple(K + (hd * math.sin(ang) * .9 + inw * (1 - math.cos(ang)) * .8) * L * t * .95 + fwd * fo * .15 * t))
        f = stube('Finger' + side, pts, [.0112, .0112, .0106, .0102, .0094, .0078], per=2, seg=5)
        radial(f, pts[1], pts[-1], lambda t, a, r: .0012 * (math.exp(-((t - .02) / .06) ** 2) + math.exp(-((t - .45) / .06) ** 2)))
        paint(f, lambda p, n, K=K: mix(GLOVE, SKIN, sstep(.022, .03, (p - K).length)))
        add(f, ['hand.' + side])
    if grip:
        # 拳心墊一截：筆在手上時整個藏在筆桿裡；筆背在背上時把手指圍出來的洞補滿，看起來是握緊的拳頭
        core = stube('FistCore', [tuple(A + Vector((0, 0, 1)) * f_) for f_ in (-.043, -.04, -.035, -.029, 0, .029, .035, .04, .043)], [.012, .03, .0345, .026, .026, .026, .0345, .03, .012], per=1, seg=12, up=tuple(outw))
        paint(core, lambda p, n: mix(SKIN_SH, SKIN, .35))
        add(core, ['hand.' + side], False)
    # 拇指
    T0 = wr + hd * .022 + fwd * .03 + inw * .006
    if grip:
        pts = [T0, wr + hd * .042 + fwd * .05 + inw * .022, A + fwd * .045 + inw * .036 - hd * .004, A + fwd * .036 + inw * .042 + hd * .018]
    else:
        pts = [T0, wr + hd * .045 + fwd * .05 + inw * .02, A + fwd * .04 + inw * .03 - hd * .004, A + fwd * .03 + inw * .034 + hd * .012]
    th = stube('Thumb' + side, [tuple(q) for q in pts], [.0145, .0135, .0115, .0088], per=2, seg=8)
    paint(th, lambda p, n, T0=T0: mix(GLOVE, SKIN, sstep(.03, .04, (p - T0).length)))
    add(th, ['hand.' + side])

# ── 腿與靴子：褲管（膝蓋補丁、靴口上的堆疊皺褶）、長靴（反摺靴口、兩道扣帶、前面鞋帶、鞋底與鞋跟） ──
PANTS, PANTS_D = 0x4d465c, 0x302b3c
for side, s in S.items():
    j = J[side]
    leg = stube('Leg' + side, [lerp3(j['hip'], (s * .06, .98, 0), .5), j['hip'], lerp3(j['hip'], j['kn'], .5), j['kn'], lerp3(j['kn'], j['an'], .45), (s * .1, .33, .004)],
                [.086, .09, .08, .07, .066, .07], per=2, seg=16)
    radial(leg, (s * .1, .9, 0), (s * .1, .3, 0), lambda t, a, r: .007 * math.sin(a * 5 + t * 14) * sstep(.55, .75, t) + .006 * math.sin(t * 60) * sstep(.82, .95, t) + .004 * math.sin(a * 3 + t * 9), ref=(0, 0, 1))
    paint(leg, lambda p, n: mix(mix(PANTS_D, PANTS, sstep(.3, .9, p.y) * .6 + .4 * max(0, n.y + .4)), 0x5a5470, .2 * noisev(p, 14, 3)))
    add(leg, ['hips', 'thigh.' + side, 'shin.' + side])
    kp = ellipsoid('KneePatch' + side, (s * .1, .5, .058), (.042, .05, .016), seg=10, rings=6)
    paint(kp, lambda p, n: mix(0x5c5068, 0x6c6078, .5 + .5 * n.y))
    add(kp, ['thigh.' + side, 'shin.' + side])
    BC = (s * .1, 0, -.005)
    boot = lathe('Boot' + side, [(.054, .05), (.055, .08), (.052, .12), (.056, .17), (.063, .23), (.066, .28), (.068, .33)], seg=20, pivot=BC, cap_top=False, cap_bot=False)
    cuffb = lathe('BootCuff' + side, [(.07, .305), (.078, .315), (.086, .345), (.088, .372), (.08, .385), (.07, .38)], seg=20, pivot=BC, cap_top=False, cap_bot=False,
                  wobble=lambda a, y: .035 * math.sin(a * 4 + 1) * sstep(.33, .38, y))
    paint(boot, lambda p, n: mix(mix(LEATHER_D, LEATHER, sstep(.04, .2, p.y)), LEATHER_L, .25 * max(0, n.y + n.z * .4) + .15 * noisev(p, 18, 4)))
    paint(cuffb, lambda p, n: mix(LEATHER, 0xb08258, .35 + .4 * max(0, n.y)))
    add(boot, ['shin.' + side, 'foot.' + side])
    add(cuffb, ['shin.' + side])
    for yy, rr in ((.13, .054), (.235, .0645)):
        strap = tube('BootStrap', loop_pts((s * .1, yy, -.005), rr + .003, rr + .003, 12, yfn=lambda a, yy=yy: .005 * math.cos(a) * s), .0055, seg=4, caps=False)
        paint(strap, lambda p, n: LEATHER_D)
        add(strap, ['shin.' + side])
        bk = rbox('BootBuckle', (s * (.1 + rr + .006), yy + .005, -.005), (.006, .022, .02), bevel=.002, seg=1)
        paint(bk, lambda p, n: BRASS)
        add(bk, ['shin.' + side])
    for sg in (-1, 1):
        lp = []
        for k in range(6):
            yy = .075 + k * .034
            r_ = .0535 + .01 * sstep(.12, .28, yy)
            xx = (.017 if (k % 2) == (sg > 0) else -.017)
            lp.append((s * .1 + xx, yy, math.sqrt(max(0, r_ * r_ - xx * xx)) + .0015 - .005))
        lace = stube('Lace', lp, .003, per=1, seg=4)
        paint(lace, lambda p, n: 0xcfc0a0)
        add(lace, ['shin.' + side, 'foot.' + side])
    foot = rbox('Foot' + side, (s * .1, .055, .05), (.1, .09, .25), bevel=.04, seg=3)

    def fshape(p, s=s):
        z = p.z - .05
        x = p.x - s * .1
        x *= 1 - .22 * sstep(.02, .13, z)
        y = p.y
        if z > .06:
            y = .012 + (y - .012) * (1 - .35 * sstep(.06, .17, z)) + .006 * sstep(.1, .17, z)
        return (s * .1 + x, y, p.z)
    each_vert(foot, fshape)
    paint(foot, lambda p, n: mix(mix(LEATHER_D, LEATHER, sstep(.01, .07, p.y)), LEATHER_L, .3 * max(0, n.y) + .2 * sstep(.12, .17, p.z)))
    add(foot, ['shin.' + side, 'foot.' + side])
    sole = rbox('Sole' + side, (s * .1, .011, .052), (.108, .022, .262), bevel=.008, seg=2)
    each_vert(sole, lambda p, s=s: (s * .1 + (p.x - s * .1) * (1 - .2 * sstep(.08, .18, p.z)), p.y + .01 * sstep(.1, .18, p.z) * (p.y > .015), p.z))
    heel = rbox('Heel' + side, (s * .1, .016, -.045), (.085, .032, .065), bevel=.006, seg=1)
    for o in (sole, heel):
        paint(o, lambda p, n: mix(0x2e2018, 0x4a3426, .3 * max(0, n.y)))
        add(o, ['foot.' + side])


# ── AO 與權重、合併 ──
bpy.context.view_layer.update()
if AO:
    ao_bake([o for o, b, k in parts if k], samples=AO, strength=1.2, floor=.45)
SMOOTH = ('Tunic', 'TunicHem', 'Vest', 'Sleeve', 'Forearm', 'Leg', 'Neck', 'Scarf', 'Strap', 'Bracer', 'Boot', 'Foot', 'Pony', 'KneePatch')
for o, bl, k in parts:
    skin(o, rig, bl, power=4.5)
    if o.name.startswith(('Tunic', 'Vest')):
        # 下擺跟著大腿擺一點（最多四成五），其餘留在骨盆
        def tw(p, w):
            if p.y > .95:
                return None
            out = dict((k2, v) for k2, v in w.items() if not k2.startswith('thigh'))
            tot = sum(out.values()) or 1
            out = {k2: v / tot for k2, v in out.items()}
            f = .45 * sstep(.95, .7, p.y)
            for sd, sg in (('L', 1), ('R', -1)):
                a = sstep(-.06, .1, p.x * sg)
                out['thigh.' + sd] = f * a
            k3 = 1 - out['thigh.L'] - out['thigh.R']
            for k2 in list(out):
                if not k2.startswith('thigh'):
                    out[k2] *= k3
            return out
        reweight(o, tw)
    if o.name.startswith(SMOOTH):
        wsmooth(o, .5, 3)
    nm0 = o.name.split('.')[0]
    if nm0 in ('LegL', 'LegR', 'KneePatchL', 'KneePatchR'):
        # 膝蓋以下只跟小腿，免得彎膝時褲管戳出靴口
        def lw(p, w, sd=nm0[-1]):
            f = sstep(.47, .38, p.y)
            if f <= 0:
                return None
            w = dict(w)
            th = (w.get('thigh.' + sd, 0) + w.get('hips', 0)) * f
            w['thigh.' + sd] = w.get('thigh.' + sd, 0) * (1 - f)
            if 'hips' in w:
                w['hips'] *= (1 - f)
            w['shin.' + sd] = w.get('shin.' + sd, 0) + th
            return w
        reweight(o, lw)
_tc = {}
for o, b, k in parts:
    nm = o.name.split('.')[0].rstrip('LR') if o.name.split('.')[0][-1:] in 'LR' and len(o.name) > 3 else o.name.split('.')[0]
    _tc[nm] = _tc.get(nm, 0) + tri_count([o])
print('hero parts', sorted(_tc.items(), key=lambda x: -x[1]))
hero = join([o for o, b, k in parts], 'Hero')
bind(hero, rig)
print('hero tris', tri_count([hero]))


# ── 畫筆：握點在原點，筆桿朝 +y，筆毛在最上面（筆尖 2.42） ──
#   雕花木柄（握把纏皮繩、兩道雕環、洋蔥形柄頭加銅箍）、金屬筆箍（壓出三道環溝）、筆毛（根部一圈、主體分成幾束，外面再貼幾撮）
WOOD, WOOD_D, WOOD_L = 0x93602f, 0x5e3a1c, 0xb98450


def build_brush(name):
    objs = []
    prof = [(0, -.4), (.022, -.398), (.04, -.385), (.05, -.36), (.047, -.335), (.034, -.315), (.03, -.305), (.041, -.296), (.041, -.282), (.032, -.272),
            (.031, -.2), (.03, .1), (.031, .24), (.04, .255), (.042, .272), (.033, .29), (.031, .4), (.029, .8), (.029, 1.1), (.031, 1.3), (.033, 1.37),
            (.041, 1.385), (.042, 1.4), (.034, 1.415), (.035, 1.5)]
    handle = lathe(name + 'Handle', prof, seg=12, cap_top=False, wobble=lambda a, y: .04 * math.sin(a * 2 + y * 3) * sstep(.3, .5, y) * sstep(1.35, 1.2, y))

    def wood(p, n):
        a = math.atan2(p.x, p.z)
        g = .5 + .5 * math.sin(p.y * 26 + math.sin(a * 3 + p.y * 2) * 2.2)
        c = mix(WOOD, WOOD_L, g * .55)
        c = mix(c, WOOD_D, .35 if (-.3 < p.y < -.27 or 1.38 < p.y < 1.405 or .25 < p.y < .275) else 0)  # 雕環
        return c
    paint(handle, wood)
    objs.append(handle)
    capb = lathe(name + 'PommelCap', [(.0, -.412), (.018, -.41), (.028, -.4), (.026, -.392)], seg=12, cap_top=False)
    paint(capb, lambda p, n: mix(0x8a6a34, 0xd8b268, .5 + .5 * n.y))
    objs.append(capb)
    # 握把纏皮繩（螺旋）
    hel = []
    for k in range(55):
        t = k / 54
        a = t * TAU * 9
        y = -.26 + t * .5
        hel.append((math.sin(a) * .034, y, math.cos(a) * .034))
    wrap = tube(name + 'Wrap', hel, .0062, seg=4)
    paint(wrap, lambda p, n: mix(0x4a2e1e, 0x7a543a, .4 + .4 * max(0, n.y)))
    objs.append(wrap)
    fer = lathe(name + 'Ferrule', [(.033, 1.49), (.043, 1.5), (.046, 1.52), (.042, 1.532), (.048, 1.545), (.05, 1.6), (.046, 1.614), (.052, 1.628), (.055, 1.69),
                                   (.051, 1.7), (.057, 1.712), (.058, 1.735), (.053, 1.748)], seg=14, cap_bot=False)
    paint(fer, lambda p, n: mix(mix(0x7e8794, 0xdfe5ea, .45 + .5 * max(0, n.y * .5 + abs(n.x) * .5)), 0x4e5560, sstep(.052, .046, math.hypot(p.x, p.z)) * .6))
    objs.append(fer)
    root = lathe(name + 'Bristle', [(.05, 1.735), (.075, 1.78), (.094, 1.83)], seg=20, cap_bot=False, cap_top=False, wobble=lambda a, y: .07 * math.cos(a * 7))
    paint(root, lambda p, n: mix(0xcfc2a2, 0xeee4cc, sstep(1.74, 1.83, p.y)))
    objs.append(root)
    tip = lathe(name + 'Paint', [(.094, 1.825), (.113, 1.9), (.121, 1.99), (.116, 2.09), (.099, 2.19), (.07, 2.28), (.038, 2.355), (.013, 2.405), (0, 2.42)], seg=21, cap_bot=False,
                wobble=lambda a, y: .1 * math.cos(a * 7 + y * 2.5) * sstep(2.42, 1.95, y) * sstep(1.83, 1.9, y) + .04 * math.cos(a * 13 + 1))
    tip.data.materials[0] = mat('paint')
    paint(tip, lambda p, n: (lambda v: (v, v, v))(.62 + .3 * sstep(1.83, 2.05, p.y) + .06 * math.cos(math.atan2(p.x, p.z) * 7 + p.y * 2.5)))
    objs.append(tip)
    for k in range(6):  # 外面幾撮較亂的筆毛
        a = k / 6 * TAU + .3
        ca, sa = math.cos(a), math.sin(a)
        pts = [(ca * .08, 1.84, sa * .08), (ca * .118, 1.97, sa * .118), (ca * .108, 2.1, sa * .108), (ca * .07, 2.22 + .02 * math.sin(k), sa * .07), (ca * .03, 2.31 + .02 * math.cos(k * 2), sa * .03)]
        cl = stube(name + 'Clump', pts, [.02, .026, .024, .016, .003], per=2, seg=5, flat=.6, up=(ca, 0, sa))
        cl.data.materials[0] = mat('paint')
        paint(cl, lambda p, n: (lambda v: (v, v, v))(.66 + .28 * sstep(1.86, 2.1, p.y)))
        objs.append(cl)
    if AO:
        ao_bake(objs, samples=max(8, AO // 2), strength=1, floor=.55)
    b = join(objs, name)
    tipe = empty(name + 'Tip', (0, 2.42, 0))
    set_parent(tipe, b)
    return b


def place_axis(ob, grip, axis):
    """握點放在 grip，筆桿（+y）朝 axis（three 座標）"""
    q = V(*axis).normalized().to_track_quat('Z', 'Y')
    ob.matrix_world = Matrix.Translation(V(*grip)) @ q.to_matrix().to_4x4()


# 靜止姿勢下擺好三份畫筆，再掛到骨頭上：手上握在拳心；背上沿著斜背帶；飛行時橫在腰下
bh = build_brush('BrushHand'); place(bh, tuple(HANDS['R']['A']), (90, 0, 0)); parent_bone(bh, rig, 'hand.R')
bb = build_brush('BrushBack'); place_axis(bb, tuple(BACK_GRIP), tuple(BACK_AX)); parent_bone(bb, rig, 'chest')
bf = build_brush('BrushFly'); place(bf, (0, .52, .95), (-90, 0, 0)); parent_bone(bf, rig, 'hips')
print('brush tris', tri_count([bh]))

# ── 動作 ──
F = 30
relax = {'upperarm.R': (6, 0, 24), 'upperarm.L': (6, 0, -24), 'forearm.R': (-14, 0, 0), 'forearm.L': (-14, 0, 0), 'hand.R': (0, 0, 6), 'hand.L': (0, 0, -6)}


def pose(**kw):
    d = dict(relax)
    for k, v in kw.items():
        d[k.replace('_', '.')] = v
    return d


action(rig, 'Idle', {
    1: pose(chest=(0, 0, 0), head=(0, 0, 0), scarf1=(6, 0, 4), scarf2=(4, 0, 0)),
    30: pose(chest=(-2.5, 0, 0), head=(3, 4, 0), scarf1=(12, 0, -4), scarf2=(10, 0, 6), upperarm_R=(6, 0, 26), upperarm_L=(6, 0, -26)),
    60: pose(chest=(0, 0, 0), head=(0, 0, 0), scarf1=(6, 0, 4), scarf2=(4, 0, 0)),
}, {1: {'hips': (0, 0, 0)}, 30: {'hips': (0, -.012, 0)}, 60: {'hips': (0, 0, 0)}})


def run_pose(s):
    # s = 1：右腳在前
    return {
        'hips': (0, 10 * s, 0), 'spine': (10, -6 * s, 0), 'chest': (4, -8 * s, 0), 'head': (-8, 12 * s, 0),
        'thigh.R': (-42 * s if s > 0 else 34, 0, 0), 'shin.R': (14 if s > 0 else 62, 0, 0), 'foot.R': (-8 if s > 0 else 20, 0, 0),
        'thigh.L': (34 if s > 0 else -42, 0, 0), 'shin.L': (62 if s > 0 else 14, 0, 0), 'foot.L': (20 if s > 0 else -8, 0, 0),
        'upperarm.R': (40 if s > 0 else -38, 0, 18), 'forearm.R': (-50, 0, 0), 'upperarm.L': (-38 if s > 0 else 40, 0, -18), 'forearm.L': (-50, 0, 0),
        'scarf1': (40, 0, 0), 'scarf2': (30, 0, 8 * s),
    }


def run_mid(s):
    return {
        'hips': (0, 0, 0), 'spine': (10, 0, 0), 'chest': (4, 0, 0), 'head': (-8, 0, 0),
        'thigh.R': (-8 if s > 0 else 8, 0, 0), 'shin.R': (30 if s > 0 else 90, 0, 0), 'foot.R': (10, 0, 0),
        'thigh.L': (8 if s > 0 else -8, 0, 0), 'shin.L': (90 if s > 0 else 30, 0, 0), 'foot.L': (10, 0, 0),
        'upperarm.R': (0, 0, 18), 'forearm.R': (-55, 0, 0), 'upperarm.L': (0, 0, -18), 'forearm.L': (-55, 0, 0),
        'scarf1': (45, 0, 0), 'scarf2': (35, 0, 0),
    }


action(rig, 'Run', {1: run_pose(1), 6: run_mid(1), 11: run_pose(-1), 16: run_mid(-1), 21: run_pose(1)},
       {1: {'hips': (0, -.04, 0)}, 6: {'hips': (0, .03, 0)}, 11: {'hips': (0, -.04, 0)}, 16: {'hips': (0, .03, 0)}, 21: {'hips': (0, -.04, 0)}})
jump = {'spine': (6, 0, 0), 'head': (-6, 0, 0), 'thigh.R': (-60, 0, 0), 'shin.R': (80, 0, 0), 'thigh.L': (-20, 0, 0), 'shin.L': (40, 0, 0),
        'upperarm.R': (-20, 0, -30), 'forearm.R': (-30, 0, 0), 'upperarm.L': (-20, 0, 30), 'forearm.L': (-30, 0, 0), 'scarf1': (70, 0, 0), 'scarf2': (40, 0, 0)}
action(rig, 'Jump', {1: jump, 10: jump})
# 揮筆：右手向右平舉，筆朝前；整個上半身由右往左掃（Swing1），反手回來（Swing2），第三段轉一圈（Spin）
armR_out = lambda yaw, lift=-72, bend=-18: {'upperarm.R': (0, yaw, lift), 'forearm.R': (bend, 0, 0), 'hand.R': (0, 0, 0)}
legs_wide = {'thigh.R': (-18, 0, -10), 'shin.R': (22, 0, 0), 'thigh.L': (16, 0, 12), 'shin.L': (18, 0, 0)}
s1 = {
    1: {**legs_wide, 'hips': (0, -22, 0), 'spine': (4, -30, 0), 'chest': (0, -20, 0), 'head': (0, 45, 0), **armR_out(-40, -64, -40), 'upperarm.L': (-30, 0, -30), 'forearm.L': (-40, 0, 0), 'scarf1': (30, 0, 20)},
    4: {**legs_wide, 'hips': (0, -8, 0), 'spine': (8, -12, 0), 'chest': (4, -6, 0), 'head': (0, 20, 0), **armR_out(10, -76, -20), 'upperarm.L': (-20, 0, -40), 'forearm.L': (-40, 0, 0), 'scarf1': (40, 0, 10)},
    7: {**legs_wide, 'hips': (0, 14, 0), 'spine': (10, 20, 0), 'chest': (6, 16, 0), 'head': (0, -20, 0), **armR_out(70, -78, -6), 'upperarm.L': (10, 0, -50), 'forearm.L': (-30, 0, 0), 'scarf1': (40, 0, -20)},
    12: {**legs_wide, 'hips': (0, 22, 0), 'spine': (8, 30, 0), 'chest': (4, 18, 0), 'head': (0, -30, 0), **armR_out(100, -70, -10), 'upperarm.L': (20, 0, -40), 'forearm.L': (-30, 0, 0), 'scarf1': (30, 0, -30)},
}
action(rig, 'Swing1', s1)
s2 = {
    1: {**legs_wide, 'hips': (0, 20, 0), 'spine': (6, 30, 0), 'chest': (4, 18, 0), 'head': (0, -30, 0), **armR_out(105, -58, -30), 'upperarm.L': (20, 0, -40), 'forearm.L': (-30, 0, 0), 'scarf1': (30, 0, -30)},
    4: {**legs_wide, 'hips': (0, 8, 0), 'spine': (8, 12, 0), 'chest': (4, 8, 0), 'head': (0, -10, 0), **armR_out(60, -62, -14), 'upperarm.L': (0, 0, -45), 'forearm.L': (-30, 0, 0), 'scarf1': (40, 0, -10)},
    7: {**legs_wide, 'hips': (0, -12, 0), 'spine': (10, -18, 0), 'chest': (6, -14, 0), 'head': (0, 20, 0), **armR_out(-10, -66, -8), 'upperarm.L': (-20, 0, -35), 'forearm.L': (-40, 0, 0), 'scarf1': (40, 0, 20)},
    12: {**legs_wide, 'hips': (0, -22, 0), 'spine': (6, -28, 0), 'chest': (2, -16, 0), 'head': (0, 30, 0), **armR_out(-45, -60, -30), 'upperarm.L': (-30, 0, -30), 'forearm.L': (-40, 0, 0), 'scarf1': (30, 0, 25)},
}
action(rig, 'Swing2', s2)
spin = {}
spin_loc = {}
for k, f in enumerate([1, 4, 7, 10, 13, 16]):
    ang = [0, 0, 90, 180, 270, 360][k] if k else 0
    spin[f] = {'hips': (0, -30 + ang if k else -30, 0), 'spine': (6, 0, 0), 'thigh.R': (-30, 0, -8), 'shin.R': (50, 0, 0), 'thigh.L': (-10, 0, 8), 'shin.L': (30, 0, 0),
               **armR_out(20, -84, -4), 'upperarm.L': (0, 0, -70), 'forearm.L': (-10, 0, 0), 'scarf1': (70, 0, 20), 'scarf2': (40, 0, 20), 'head': (0, 10, 0)}
    spin_loc[f] = {'hips': (0, [0, .08, .22, .26, .18, 0][k], 0)}
action(rig, 'Spin', spin, spin_loc)
shoot = {'spine': (6, 22, 0), 'chest': (0, 18, 0), 'head': (0, -30, 0), 'upperarm.R': (-70, 16, -8), 'forearm.R': (-6, 0, 0), 'hand.R': (68, 0, 0),
         'upperarm.L': (-20, 0, -40), 'forearm.L': (-30, 0, 0), **legs_wide}
action(rig, 'Shoot', {1: shoot, 6: {**shoot, 'upperarm.R': (-86, 20, -10), 'spine': (2, 22, 0)}, 10: shoot})
fly = {'hips': (0, 0, 0), 'spine': (18, 0, 0), 'chest': (6, 0, 0), 'head': (-18, 0, 0), 'thigh.R': (-80, 0, -6), 'shin.R': (84, 0, 0), 'thigh.L': (-80, 0, 6), 'shin.L': (84, 0, 0),
       'foot.R': (20, 0, 0), 'foot.L': (20, 0, 0), 'upperarm.R': (-50, 0, 14), 'forearm.R': (-40, 0, 0), 'upperarm.L': (-50, 0, -14), 'forearm.L': (-40, 0, 0), 'scarf1': (85, 0, 10), 'scarf2': (20, 0, 20)}
action(rig, 'Fly', {1: fly, 20: {**fly, 'scarf1': (80, 0, -10), 'scarf2': (30, 0, -20), 'chest': (8, 0, 0)}, 40: fly})
hurt = {'spine': (-18, 0, 0), 'chest': (-10, 0, 0), 'head': (-20, 0, 0), 'upperarm.R': (-30, 0, -40), 'upperarm.L': (-30, 0, 40), 'forearm.R': (-30, 0, 0), 'forearm.L': (-30, 0, 0),
        'thigh.R': (-20, 0, 0), 'shin.R': (30, 0, 0), 'scarf1': (60, 0, 0)}
action(rig, 'Hurt', {1: pose(), 4: hurt, 10: pose()})

# ── 老畫師帕布（簡單骨架：身體、頭、雙臂，一段待機動作） ──
#   駝背的老人：大鼻子、濃眉、瞇眼、八字鬍、一撮撮長鬍子；軟畫家帽（帽帶插一支筆）、繞頸的兜帽領、
#   長外套（前襟敞開、滾邊、下擺皺褶）、內襯長衫、沾滿顏料的帆布圍裙、腰帶打結、斜背書包；右手拄雕花拐杖，左手托調色盤
prig = armature('PipRig', [('root', (0, 0, 0), (0, .9, 0), None), ('torso', (0, .9, 0), (0, 1.35, 0), 'root'), ('phead', (0, 1.35, 0), (0, 1.8, 0), 'torso'),
                           ('parm.R', (-.2, 1.3, 0), (-.34, .95, .08), 'torso'), ('parm.L', (.2, 1.3, 0), (.36, .98, .1), 'torso')])
pp = []


def padd(o, bl, bake=True):
    pp.append((o, bl, bake))
    return o


P_SKIN, P_SKIN_SH, P_RUDDY = 0xe6b596, 0xc58d70, 0xd98c72
COAT, COAT_D, COAT_L = 0x5d5069, 0x3b3246, 0x7a6c84
TRIM = 0xa89066
INNER = 0x86654a
APRON, APRON_D = 0xd2c5a4, 0xa8997a
BEARD, BEARD_D = 0xeae6de, 0xa9a298
P_HAT = 0x3c3246


def hunch(y):
    return .1 * sstep(.95, 1.42, y)


# 頭與臉
PH = Vector((0, 1.47, .1))
PR = (.118, .13, .122)
phd = ellipsoid('PipHead', tuple(PH), PR, seg=28, rings=20)


def p_face_d(x, y):
    d = 0
    for s in (-1, 1):
        d -= .013 * g2(x - s * .043, y - (PH.y + .012), .022, .016)
        d += .013 * g2(x - s * .047, y - (PH.y + .036), .034, .011)
        d += .013 * g2(x - s * .056, y - (PH.y - .028), .028, .024)
    d += .004 * g2(x, y - (PH.y + .03), .018, .02)
    return d


def p_sculpt(p):
    q = p - PH
    if q.z < .01:
        return None
    n = Vector((q.x / PR[0] ** 2, q.y / PR[1] ** 2, q.z / PR[2] ** 2)).normalized()
    return tuple(p + n * p_face_d(p.x, p.y) * sstep(.01, .07, q.z))


each_vert(phd, lambda p: (p.x * (1 - .12 * sstep(PH.y, PH.y - .12, p.y)), p.y, p.z))
each_vert(phd, p_sculpt)
bpy.context.view_layer.update()
_pbvh = BVHTree.FromObject(phd, bpy.context.evaluated_depsgraph_get())


def psurf(x, y, off=0.0):
    loc, nor, i, d = _pbvh.ray_cast(V(x, y, PH.z + .5), V(0, 0, -1))
    if loc is None:
        return Vector((x, y, PH.z + .1))
    return Vector(T(loc)) + Vector(T(nor)) * off


def pskin(p, n):
    c = mix(P_SKIN_SH, P_SKIN, .5 + .5 * max(0, n.y + n.z * .5))
    for s in (-1, 1):
        c = mix(c, P_RUDDY, sstep(.04, 0, Vector((p.x - s * .058, p.y - PH.y + .03, 0)).length) * .6)
    c = mix(c, P_SKIN_SH, sstep(0, -.012, p_face_d(p.x, p.y)) * .6)
    for k in range(3):  # 額頭皺紋
        c = mix(c, P_SKIN_SH, sstep(.0035, 0, abs(p.y - (PH.y + .062 + k * .014) - .004 * math.cos(p.x * 30))) * .55 * sstep(.07, .03, abs(p.x)))
    return c


paint(phd, pskin)
padd(phd, ['phead'], False)
pn_tip = psurf(0, PH.y - .012)
pnose = [ellipsoid('PipNose', (0, PH.y - .014, pn_tip.z + .016), (.026, .03, .026), seg=14, rings=9),
         stube('PipNoseBridge', [tuple(psurf(0, PH.y + .03)), (0, PH.y + .005, pn_tip.z + .012), (0, PH.y - .012, pn_tip.z + .02)], [.012, .016, .02], seg=10)]
for s in (-1, 1):
    pnose.append(ellipsoid('PipNostril', tuple(psurf(s * .018, PH.y - .03, .004)), (.011, .009, .01), seg=10, rings=6))
for o in pnose:
    paint(o, lambda p, n: mix(mix(P_SKIN, P_RUDDY, .55), 0xe7a58a, max(0, n.y * .5 + n.z * .3)))
    padd(o, ['phead'], False)
for s in (-1, 1):
    ec = psurf(s * .043, PH.y + .012, -.001)
    eye = ellipsoid('PipEye', tuple(ec), (.011, .0075, .005), seg=10, rings=6)
    paint(eye, lambda p, n: 0x1e1a1e)
    padd(eye, ['phead'], False)
    gl = ellipsoid('PipGlint', tuple(ec + Vector((-s * .003, .002, .004))), (.0025, .0025, .0012), seg=6, rings=4)
    paint(gl, lambda p, n: 0xfaf6ee)
    padd(gl, ['phead'], False)
    lid = stube('PipLid', [tuple(psurf(s * x, PH.y + .012 + y, .003)) for x, y in ((.026, .002), (.036, .008), (.05, .008), (.062, -.001))], [.004, .0065, .0065, .003], seg=8, flat=.6, up=(0, 0, 1))
    paint(lid, lambda p, n: mix(P_SKIN_SH, P_SKIN, .5))
    padd(lid, ['phead'], False)
    bag = stube('PipBag', [tuple(psurf(s * x, PH.y + .012 + y, .0015)) for x, y in ((.03, -.008), (.043, -.012), (.056, -.008))], [.002, .004, .002], seg=6)
    paint(bag, lambda p, n: P_SKIN_SH)
    padd(bag, ['phead'], False)
    # 濃眉：一撮撮往外上翹
    for k in range(4):
        y0 = PH.y + .036 + k * .003
        bp = [tuple(psurf(s * (.018 + k * .006), y0, .006)), tuple(psurf(s * (.045 + k * .005), y0 + .008, .011)), tuple(psurf(s * (.07 + k * .004), y0 + .012 + k * .004, .008) + Vector((s * .012, .006, 0)))]
        br = stube('PipBrow', bp, [.007, .009, .002], per=2, seg=6, flat=.6, up=(0, .4, 1))
        paint(br, lambda p, n: mix(BEARD_D, BEARD, .5 + .5 * max(0, n.y)))
        padd(br, ['phead'])
    ear = ellipsoid('PipEar', (s * .116, PH.y - .005, PH.z - .015), (.018, .042, .03), seg=12, rings=8)
    rot_about(ear, (s * .116, PH.y - .005, PH.z - .015), (0, 1, 0), s * -20)
    paint(ear, lambda p, n: mix(P_SKIN, P_RUDDY, .35))
    padd(ear, ['phead'])
    # 八字鬍：兩撮往兩側垂
    for k in range(2):
        mp = [tuple(psurf(s * .006, PH.y - .045 - k * .004, .012)), tuple(psurf(s * .035, PH.y - .052 - k * .006, .016)), tuple(psurf(s * .062, PH.y - .07 - k * .01, .01)),
              tuple(psurf(s * .072, PH.y - .1 - k * .012, .004))]
        mu = stube('PipMoustache', mp, [.012 - k * .002, .016 - k * .002, .012, .003], per=2, seg=7, flat=.65, up=(0, .3, 1))
        paint(mu, lambda p, n: mix(BEARD_D, BEARD, .45 + .55 * max(0, n.y * .7 + n.z * .3)))
        padd(mu, ['phead'])
# 頭髮：耳上後腦一圈白髮
for k in range(9):
    a = math.radians(-100 + k * 25)
    r0 = PH + Vector((math.sin(a) * .116, .03, -math.cos(a) * .116 - .01))
    hp_ = [tuple(r0), tuple(r0 + Vector((math.sin(a) * .018, -.035, -math.cos(a) * .015))), tuple(r0 + Vector((math.sin(a) * .028, -.065, -math.cos(a) * .012)))]
    hl = stube('PipHair', hp_, [.024, .022, .008], per=2, seg=6, flat=.45, up=(math.sin(a), 0, -math.cos(a)))
    paint(hl, lambda p, n: mix(BEARD_D, BEARD, .4 + .5 * max(0, n.y)))
    padd(hl, ['phead'])
# 長鬍子：沿下顎一圈往下收成尖
for k in range(11):
    t = k / 10
    a = math.radians(-95 + t * 190)
    x0 = math.sin(a) * .1
    root = Vector((x0, PH.y - .04 - .03 * (1 - abs(math.sin(a))), PH.z + math.cos(a) * .085 - .005))
    L = .2 + .14 * (1 - abs(t - .5) * 2)
    end = Vector((x0 * .25, root.y - L, PH.z + .17 - .03 * abs(math.sin(a))))
    mid = (root + end) / 2 + Vector((x0 * .35, 0, .05 * math.cos(a) + .035))
    bp = [tuple(root), tuple(root + (mid - root) * .5 + Vector((0, 0, .015))), tuple(mid), tuple(end + Vector((0, .05, .01))), tuple(end)]
    bd = stube('PipBeard', bp, [.03, .04, .042, .026, .004], per=2, seg=7, flat=.55, up=(math.sin(a), 0, math.cos(a)))
    paint(bd, lambda p, n: mix(mix(BEARD_D, BEARD, .35 + .6 * max(0, n.y * .5 + n.z * .6)), 0xcfc6b8, sstep(PH.y - .05, PH.y - .2, p.y) * .25))
    padd(bd, ['phead', 'torso'])
for k, x0 in enumerate((-.03, .0, .032)):  # 前面再蓋一層，把下巴底下的縫補滿
    root = Vector((x0, PH.y - .062, PH.z + .115))
    end = Vector((x0 * .4, PH.y - .3 + abs(x0) * 1.5, PH.z + .175))
    bp = [tuple(root), tuple(root + Vector((x0 * .3, -.06, .03))), tuple((root + end) / 2 + Vector((x0 * .3, 0, .035))), tuple(end)]
    bd = stube('PipBeard', bp, [.03, .038, .03, .004], per=2, seg=7, flat=.55, up=(x0 * 3, 0, 1))
    paint(bd, lambda p, n: mix(BEARD_D, BEARD, .45 + .55 * max(0, n.y * .5 + n.z * .6)))
    padd(bd, ['phead', 'torso'])
bfill = ellipsoid('PipBeardMass', (0, PH.y - .13, PH.z + .085), (.092, .12, .062), seg=14, rings=10)
each_vert(bfill, lambda p: (p.x * (1 - .5 * sstep(PH.y - .12, PH.y - .28, p.y)), p.y, p.z + .02 * sstep(PH.y - .1, PH.y - .25, p.y)))
paint(bfill, lambda p, n: mix(BEARD_D, 0xd5cfc4, .5 + .4 * max(0, n.z)))
padd(bfill, ['phead', 'torso'], False)
# 軟畫家帽：寬、垂向一側，帽帶插一支小畫筆
HP_ = (PH.x + .01, PH.y + .1, PH.z - .025)
hat = lathe('PipHat', [(.1, -.005), (.13, .0), (.19, .02), (.215, .045), (.205, .07), (.16, .09), (.09, .1), (0, .104)], seg=28, pivot=HP_,
            wobble=lambda a, y: .03 * math.sin(a * 4 + 1) * sstep(.03, .07, y))
each_vert(hat, lambda p: (p.x, p.y - .045 * sstep(.02, .21, p.x) * sstep(.03, .08, p.y) - .012 * sstep(.05, .2, -p.z), p.z))
hband = tube('PipHatBand', loop_pts((0, .008, 0), .122, .122, 24), .012, seg=5, pivot=HP_, caps=False)
hstem = stube('PipHatStem', [(0, .1, 0), (.004, .12, .003), (.014, .132, .002)], [.009, .007, .004], seg=6, pivot=HP_)
hbr = stube('PipHatBrush', [(-.13, -.02, -.06), (-.08, .05, -.1), (-.02, .13, -.12)], [.006, .006, .005], per=1, seg=6, pivot=HP_)
hbt = stube('PipHatBrushTip', [(-.02, .13, -.12), (-.005, .16, -.125), (.005, .18, -.126)], [.009, .01, .001], per=1, seg=6, pivot=HP_)
for o in (hat, hband, hstem, hbr, hbt):
    place(o, HP_, (-10, 0, -12))
bpy.context.view_layer.update()
paint(hat, lambda p, n: mix(P_HAT, 0x5a4c66, max(0, n.y) * .6))
paint(hband, lambda p, n: 0x7a4a3a)
paint(hstem, lambda p, n: P_HAT)
paint(hbr, lambda p, n: WOOD)
paint(hbt, lambda p, n: 0x4f86b8)
for o in (hat, hband, hstem, hbr, hbt):
    padd(o, ['phead'])

# 外套：前襟敞開（露出內襯與圍裙）、駝背、背上隆起、下擺皺褶
coat_prof = [(.285, .19), (.284, .26), (.272, .42), (.255, .6), (.238, .78), (.222, .9), (.214, .96), (.222, 1.03), (.234, 1.12), (.238, 1.2), (.232, 1.27),
             (.216, 1.32), (.19, 1.355), (.15, 1.38), (.11, 1.395)]
coat_prof = [(q[0], q[1]) for q in spline([(r, y, 0) for r, y in coat_prof], 2)]
CSZ = .84


def coat_fold(a):
    return .5 * math.sin(7 * a + .4) + .3 * math.sin(12 * a + 1.7) + .2 * math.sin(4 * a)


coat = lathe('Coat', coat_prof, seg=36, sz=CSZ, cap_top=False, cap_bot=False, wobble=lambda a, y: .07 * coat_fold(a) * sstep(.85, .2, y))


def coat_shape(p):
    x, y, z = p
    a = math.atan2(z / CSZ, x)
    z += hunch(y)
    if p.z < 0:
        z -= .05 * math.exp(-((y - 1.2) / .12) ** 2) * (-p.z / .2)
    y += .015 * math.sin(3 * a + 1) * sstep(.3, .19, y)
    return (x, y, z)


each_vert(coat, coat_shape)
bm = bmesh.new(); bm.from_mesh(coat.data)
bmesh.ops.delete(bm, geom=[f for f in bm.faces if (lambda c: c[2] > 0 and abs(math.atan2(c[2], c[0]) - math.pi / 2) < math.radians(24 - 10 * sstep(.2, .95, c[1])) and c[1] < .96)(T(f.calc_center_median()))], context='FACES')
bm.to_mesh(coat.data); bm.free()
coat.data.materials[0] = mat('cloth2s')


def coat_col(p, n):
    a = math.atan2(p.z, p.x)
    c = mix(COAT_D, COAT, .45 + .55 * max(0, n.y * .5 + .5))
    c = mix(c, COAT_D, sstep(.1, -.9, coat_fold(math.atan2((p.z - hunch(p.y)) / CSZ, p.x))) * .45 * sstep(.85, .25, p.y))
    c = mix(c, COAT_L, .15 * noisev(p, 7, 11) + .05)
    return c


paint(coat, coat_col)
padd(coat, ['root', 'torso'])
# 前襟滾邊：沿開口兩側往上到領口
for s in (-1, 1):
    ep_ = []
    for k in range(9):
        y = .2 + k * .095
        a = math.pi / 2 - s * math.radians(24 - 10 * sstep(.2, .95, y))
        r = .285 - (.285 - .214) * sstep(.19, .96, y)
        r *= 1 + .07 * coat_fold(a) * sstep(.85, .2, y)
        ep_.append((math.cos(a) * r, y, math.sin(a) * r * CSZ + hunch(y)))
    ep_ += [(s * .1, 1.1, .2 + hunch(1.1)), (s * .12, 1.3, .15 + hunch(1.3))]
    tr = ribbon('PipTrim', ep_, .014, thick=.005, up=(s, 0, .3), cols=3, per=1)
    paint(tr, lambda p, n: mix(TRIM, 0xc8b288, max(0, n.y) * .5))
    padd(tr, ['root', 'torso'])
# 內襯長衫與圍裙
inner = lathe('PipInner', [(.19, .3), (.2, .5), (.2, .75), (.196, .96), (.2, 1.1), (.19, 1.25)], seg=24, sz=.8, cap_top=False, cap_bot=False, wobble=lambda a, y: .05 * math.sin(a * 6) * sstep(.7, .3, y))
each_vert(inner, lambda p: (p.x, p.y, p.z + hunch(p.y)))
paint(inner, lambda p, n: mix(mix(0x5e4432, INNER, .5 + .5 * max(0, n.y + .5)), 0x6e503a, sstep(.3, -.8, math.sin(math.atan2(p.z, p.x) * 6)) * .4 * sstep(.7, .35, p.y)))
padd(inner, ['root', 'torso'])
apron = bmesh.new()
A_rows, A_cols = 14, 11
grid = []
for i in range(A_rows):
    y = .36 + i / (A_rows - 1) * .86
    row = []
    wv = .62 - .22 * sstep(.95, 1.2, y)
    for j in range(A_cols):
        u = -1 + 2 * j / (A_cols - 1)
        a = math.pi / 2 + u * wv
        r = (.208 if y < 1.1 else .205) + .008 + .012 * math.sin(u * 7 + y * 3) * sstep(.9, .4, y)
        row.append(apron.verts.new(V(math.cos(a) * r, y + .01 * math.sin(u * 5) * sstep(.5, .36, y), math.sin(a) * r * .82 + hunch(y) + .012)))
    grid.append(row)
for i in range(A_rows - 1):
    for j in range(A_cols - 1):
        apron.faces.new((grid[i][j], grid[i][j + 1], grid[i + 1][j + 1], grid[i + 1][j]))
apo = obj_from_bm(apron, 'PipApron', slot='cloth2s')
random.seed(41)
aspl = [(random.choice([0xc4574a, 0x4f86b8, 0xd8ae48, 0x5d9e5e, 0x8a5aa8]), Vector((random.uniform(-.12, .12), random.uniform(.45, 1.15))), random.uniform(.018, .035)) for _ in range(12)]


def apron_col(p, n):
    c = mix(APRON_D, APRON, .5 + .5 * max(0, n.y * .3 + n.z * .7))
    c = mix(c, APRON_D, sstep(.012, .0, abs(p.y - .98)) * .5)  # 腰線
    for col, q, r in aspl:
        if math.hypot(p.x - q.x, (p.y - q.y) * (.6 if p.y < q.y else 1)) < r:
            c = mix(col, APRON, .25)
    return c


paint(apo, apron_col)
padd(apo, ['root', 'torso'])
# 圍裙口袋插兩支筆
pk = rbox('PipPocket', (.06, .74, 0), (.13, .1, .012), bevel=.004, seg=1)
each_vert(pk, lambda p: (p.x, p.y, math.sin(math.pi / 2 + (p.x) / .215 * .8) * .222 * .82 + hunch(p.y) + .018 + p.z))
paint(pk, lambda p, n: mix(APRON_D, APRON, .45))
padd(pk, ['root', 'torso'])
for k, (x, col) in enumerate(((.035, 0xc4574a), (.075, 0x5d9e5e))):
    zb = .222 * .82 + .028
    pb = stube('PipPocketBrush', [(x, .72, zb), (x + .01 * k, .9, zb + .005)], [.005, .005], per=1, seg=5)
    pt = stube('PipPocketBrushTip', [(x + .01 * k, .9, zb + .005), (x + .012 * k, .93, zb + .006), (x + .013 * k, .95, zb + .006)], [.008, .008, .001], per=1, seg=5)
    paint(pb, lambda p, n: WOOD)
    paint(pt, lambda p, n, col=col: col)
    padd(pb, ['root', 'torso'])
    padd(pt, ['root', 'torso'])
# 腰帶（布條打結，兩條垂尾）
sash = tube('PipSash', loop_pts((0, .955, hunch(.955)), .222, .222 * CSZ, 26, yfn=lambda a: .01 * math.sin(a * 2)), .022, seg=5, caps=False)
paint(sash, lambda p, n: mix(0x6e3a2e, 0x9a5a44, .5 + .5 * max(0, n.y)))
padd(sash, ['root', 'torso'])
sk = ellipsoid('PipSashKnot', (-.1, .95, .2), (.03, .028, .022), seg=10, rings=6)
paint(sk, lambda p, n: 0x8a4c3a)
padd(sk, ['root', 'torso'])
for k in range(2):
    se = ribbon('PipSashEnd', [(-.1, .94, .205), (-.11 - k * .02, .85, .215), (-.115 - k * .03, .74 + k * .04, .21)], .018, thick=.004, up=(0, 0, 1), cols=4, fringe=.012)
    paint(se, lambda p, n: mix(0x6e3a2e, 0x9a5a44, .5))
    padd(se, ['root'])
# 繞頸兜帽領
cowl = tube('PipCowl', loop_pts((0, 1.335, .045), .17, .135, 26, yfn=lambda a: -.07 * max(0, math.sin(a)) ** 2 + .01 * math.sin(a * 5), rfn=lambda a: 1 + .06 * math.sin(a * 5) - .14 * max(0, math.sin(a)) ** 3), .042, seg=6, caps=False)
paint(cowl, lambda p, n: mix(COAT_D, COAT_L, .3 + .5 * max(0, n.y)))
padd(cowl, ['torso'])
hood = ellipsoid('PipHood', (0, 1.3, -.1), (.17, .1, .08), seg=16, rings=8)
each_vert(hood, lambda p: (p.x * (1 + .15 * math.sin(p.y * 40)), p.y, p.z - .02 * sstep(1.3, 1.22, p.y)))
paint(hood, lambda p, n: mix(COAT_D, COAT, .5 + .5 * max(0, n.y)))
padd(hood, ['torso'])
# 斜背書包：左肩 → 右臀
bag_s = ribbon('PipBagStrap', [(.15, 1.33, .1), (.05, 1.2, .21), (-.08, 1.02, .23), (-.2, .9, .16), (-.25, .84, .06)], .02, thick=.004, up=(0, 0, 1), cols=4)
paint(bag_s, lambda p, n: 0x5a3a26)
padd(bag_s, ['torso', 'root'])
bagb = rbox('PipBag', (-.275, .76, .0), (.07, .16, .2), bevel=.025, seg=2)
bagf = rbox('PipBagFlap', (-.31, .8, .0), (.016, .1, .205), bevel=.008, seg=2)
bagk = rbox('PipBagBuckle', (-.322, .77, 0), (.008, .026, .02), bevel=.003, seg=1)
paint(bagb, lambda p, n: mix(0x5a3a26, 0x7a5236, .5 + .5 * max(0, n.y)))
paint(bagf, lambda p, n: mix(0x6a4630, 0x8a6040, max(0, n.y)))
paint(bagk, lambda p, n: BRASS)
for o in (bagb, bagf, bagk):
    padd(o, ['root'])
# 褲管與鞋
for s in (-1, 1):
    lg = stube('PipLeg', [(s * .1, .36, .05), (s * .105, .2, .07), (s * .11, .08, .08)], [.06, .058, .052], seg=10)
    paint(lg, lambda p, n: 0x3a3642)
    padd(lg, ['root'])
    sh_ = rbox('PipShoe', (s * .11, .045, .12), (.1, .08, .22), bevel=.035, seg=2)
    each_vert(sh_, lambda p, s=s: (s * .11 + (p.x - s * .11) * (1 - .25 * sstep(.14, .23, p.z)), p.y + .03 * sstep(.17, .23, p.z) * sstep(.02, .06, p.y) + .02 * sstep(.19, .24, p.z), p.z))
    so_ = rbox('PipSole', (s * .11, .008, .12), (.104, .016, .22), bevel=.006, seg=1)
    paint(sh_, lambda p, n: mix(0x3e2a1e, 0x6a4a34, .3 + .5 * max(0, n.y)))
    paint(so_, lambda p, n: 0x241812)
    padd(sh_, ['root'])
    padd(so_, ['root'])


# 手臂：寬袖（反摺袖口）、手
def p_fist(name, A, ax, e1, bone, radius=.03, turn=3.4, width=.07):
    """握住沿 ax 方向的圓棒；e1 為手背方向"""
    ax = Vector(ax).normalized()
    e1 = (Vector(e1) - ax * Vector(e1).dot(ax)).normalized()
    e2 = ax.cross(e1)
    palm = rbox(name + 'Palm', (0, 0, 0), (.032, width, .075), bevel=.012, seg=2)
    M = Matrix((e1, ax, e2)).transposed()
    pc = A + e1 * (radius + .012)
    each_vert(palm, lambda p: tuple(pc + M @ Vector((p.x, p.y, p.z * .9))))
    paint(palm, lambda p, n: mix(P_SKIN_SH, P_SKIN, .5 + .4 * max(0, n.y)))
    padd(palm, [bone])
    for k in range(4):
        off = (k - 1.5) * width * .26
        pts = []
        for m in range(6):
            ph = -.3 + m / 5 * turn
            pts.append(tuple(A + ax * off + (e1 * math.cos(ph) + e2 * math.sin(ph)) * (radius + .01)))
        f = stube(name + 'Finger', pts, [.0115, .012, .011, .0105, .0095, .008], per=2, seg=6)
        paint(f, lambda p, n: mix(P_SKIN_SH, P_SKIN, .5 + .4 * max(0, n.y)))
        padd(f, [bone])
    th = stube(name + 'Thumb', [tuple(pc + ax * width * .55 + e2 * .03), tuple(A + ax * (width * .6) + e2 * (radius + .012)), tuple(A + ax * (width * .5) - e1 * (radius * .6) + e2 * .02)], [.014, .012, .009], seg=6)
    paint(th, lambda p, n: P_SKIN)
    padd(th, [bone])


for s, bn in ((-1, 'parm.R'), (1, 'parm.L')):
    sp0 = Vector((s * .17, 1.34, .02 + hunch(1.3)))
    sp1 = Vector((s * .25, 1.2, .07))
    sp2 = Vector((s * .33, 1.03, .11))
    sp3 = Vector((s * .35, .99, .12))
    sl = stube('PipSleeve', [tuple(sp0), tuple(sp1), tuple(sp2), tuple(sp3)], [.07, .072, .08, .092], per=3, seg=14)
    radial(sl, sp0, sp3, lambda t, a, r: .007 * math.sin(a * 5 + t * 8) * sstep(.2, .6, t))
    paint(sl, lambda p, n: mix(COAT_D, COAT, .45 + .55 * max(0, n.y * .5 + .5)))
    padd(sl, [bn])
    d = (sp3 - sp2).normalized()
    cf = stube('PipCuff', [tuple(sp3 - d * .03), tuple(sp3 + d * .005)], [.097, .1], per=1, seg=14)
    paint(cf, lambda p, n: mix(TRIM, 0xc8b288, max(0, n.y) * .5))
    padd(cf, [bn])
    wrist = stube('PipWrist', [tuple(sp3 - d * .02), tuple(sp3 + d * .045)], [.04, .036], per=1, seg=10)
    paint(wrist, lambda p, n: P_SKIN)
    padd(wrist, [bn])
# 右手握拐杖
CANE_TOP, CANE_BOT = Vector((-.372, 1.06, .112)), Vector((-.42, .02, .2))
cax = (CANE_TOP - CANE_BOT).normalized()
p_fist('PipR', CANE_BOT + cax * ((.925 - CANE_BOT.y) / cax.y), cax, (-1, 0, -.4), 'parm.R', radius=.022, turn=3.6)
cn_pts = [tuple(CANE_BOT + cax * t * (CANE_TOP - CANE_BOT).length + Vector((.006 * math.sin(t * 17), 0, .006 * math.cos(t * 13)))) for t in [k / 10 for k in range(11)]]
cane = stube('Cane', cn_pts, [.018, .019, .02, .018, .02, .019, .021, .019, .02, .022, .024], per=2, seg=8)
radial(cane, CANE_BOT, CANE_TOP, lambda t, a, r: .006 * math.exp(-((t - .35) / .02) ** 2) + .005 * math.exp(-((t - .62) / .02) ** 2) + .002 * math.sin(a * 2 + t * 40) * sstep(.75, .8, t))
paint(cane, lambda p, n: mix(mix(0x6a4428, 0x9a6a40, .5 + .5 * math.sin(p.y * 70 + math.atan2(p.x + .4, p.z - .15) * 2)), 0x3e2616, .5 if int(p.y * 50) % 3 == 0 and p.y > .82 else 0))
padd(cane, ['parm.R'])
knob = stube('CaneKnob', [tuple(CANE_TOP - cax * .01), tuple(CANE_TOP + cax * .03 + Vector((.01, 0, .01))), tuple(CANE_TOP + cax * .06 + Vector((.04, 0, .02))), tuple(CANE_TOP + cax * .055 + Vector((.07, 0, .025))),
                                  tuple(CANE_TOP + cax * .03 + Vector((.075, 0, .02)))], [.026, .03, .026, .02, .012], per=2, seg=8)
paint(knob, lambda p, n: mix(0x7a5030, 0xa87848, .5 + .5 * max(0, n.y)))
padd(knob, ['parm.R'])
cf_ = stube('CaneFerrule', [tuple(CANE_BOT - cax * .005), tuple(CANE_BOT + cax * .04)], [.02, .02], per=1, seg=8)
paint(cf_, lambda p, n: 0x5e646e)
padd(cf_, ['parm.R'])
# 左手托調色盤
PC = Vector((.41, 1.0, .19))
pal = bmesh.new()
outline = []
for k in range(26):
    a = k / 26 * TAU
    r = 1 - .28 * math.exp(-((a - 3.5) / .35) ** 2)
    outline.append((math.cos(a) * .125 * r, math.sin(a) * .09 * r))
vs_t = [pal.verts.new(V(PC.x + x, PC.y + .006, PC.z + z)) for x, z in outline]
vs_b = [pal.verts.new(V(PC.x + x, PC.y - .006, PC.z + z)) for x, z in outline]
pal.faces.new(vs_t)
pal.faces.new(list(reversed(vs_b)))
for k in range(26):
    pal.faces.new((vs_b[k], vs_b[(k + 1) % 26], vs_t[(k + 1) % 26], vs_t[k]))
bmesh.ops.triangulate(pal, faces=pal.faces[:2])
bmesh.ops.recalc_face_normals(pal, faces=pal.faces)
palette = obj_from_bm(pal, 'Palette')
hole = Vector((PC.x - .075, PC.z - .012))
paint(palette, lambda p, n: 0x2a1e16 if math.hypot(p.x - hole.x, p.z - hole.y) < .016 and p.y > PC.y else mix(0xa87848, 0xcaa070, .5 + .5 * math.sin(p.x * 90 + p.z * 20)))
rot_about(palette, PC, (0, 1, 0), 25)
rot_about(palette, PC, (1, 0, 0), -12)
padd(palette, ['parm.L'])
for k, (col, u, v, r) in enumerate(((0xc4574a, .07, .03, .02), (0xd8ae48, .035, .06, .018), (0x5d9e5e, -.01, .065, .018), (0x4f86b8, -.05, .05, .02), (0xf0ece0, .08, -.02, .017), (0x8a5aa8, .02, -.05, .015))):
    bl = ellipsoid('PaintBlob', (PC.x + u, PC.y + .01, PC.z + v), (r, .007, r * .9), seg=10, rings=5)
    each_vert(bl, lambda p: (p.x, p.y + .004 * noisev(p, 60, k), p.z))
    rot_about(bl, PC, (0, 1, 0), 25)
    rot_about(bl, PC, (1, 0, 0), -12)
    paint(bl, lambda p, n, col=col: mix(col, 0xffffff, .15 * max(0, n.y)))
    padd(bl, ['parm.L'], False)
for k, (col, dx) in enumerate(((0xc4574a, 0), (0x4f86b8, .02))):
    b0 = Vector((PC.x - .09 + dx, PC.y + .012, PC.z - .06))
    b1 = b0 + Vector((.02, .03, .2))
    pb = stube('PipPalBrush', [tuple(b0), tuple(b1)], [.005, .004], per=1, seg=5)
    pt = stube('PipPalBrushTip', [tuple(b1), tuple(b1 + Vector((.004, .006, .025))), tuple(b1 + Vector((.006, .008, .04)))], [.007, .007, .001], per=1, seg=5)
    for o in (pb, pt):
        rot_about(o, PC, (0, 1, 0), 25)
    paint(pb, lambda p, n: WOOD)
    paint(pt, lambda p, n, col=col: col)
    padd(pb, ['parm.L'])
    padd(pt, ['parm.L'])
# 托盤的左手：掌心朝上，拇指從洞穿上來
lpalm = rbox('PipLPalm', (PC.x - .06, PC.y - .03, PC.z - .04), (.075, .03, .085), bevel=.012, seg=2)
rot_about(lpalm, PC, (0, 1, 0), 25)
paint(lpalm, lambda p, n: mix(P_SKIN_SH, P_SKIN, .5 + .4 * max(0, n.y)))
padd(lpalm, ['parm.L'])
for k in range(4):
    x0 = PC.x - .09 + k * .02
    f = stube('PipLFinger', [(x0, PC.y - .03, PC.z - .005), (x0 + .005, PC.y - .022, PC.z + .03), (x0 + .008, PC.y - .012, PC.z + .055)], [.011, .01, .008], seg=6)
    rot_about(f, PC, (0, 1, 0), 25)
    paint(f, lambda p, n: P_SKIN)
    padd(f, ['parm.L'])
th = stube('PipLThumb', [(PC.x - .1, PC.y - .02, PC.z - .04), (hole.x - .002, PC.y - .005, hole.y), (hole.x + .01, PC.y + .018, hole.y + .012)], [.013, .012, .009], seg=6)
rot_about(th, PC, (0, 1, 0), 25)
paint(th, lambda p, n: P_SKIN)
padd(th, ['parm.L'])
print('pip parts', sorted(((o.name, tri_count([o])) for o, b, k in pp), key=lambda x: -x[1])[:40])
if AO:
    ao_bake([o for o, b, k in pp if k], samples=AO, strength=1.1, floor=.5)
for o, bl, k in pp:
    skin(o, prig, bl)
    if o.name.startswith(('PipBeard', 'PipBeardMass')):
        reweight(o, lambda p, w: {'phead': sstep(PH.y - .2, PH.y - .06, p.y), 'torso': 1 - sstep(PH.y - .2, PH.y - .06, p.y)})
    if o.name.startswith(('Coat', 'PipInner', 'PipApron', 'PipTrim')):
        wsmooth(o, .5, 3)
pip = join([o for o, b, k in pp], 'Pip')
bind(pip, prig)
print('pip tris', tri_count([pip]))
action(prig, 'PipIdle', {1: {'torso': (0, 0, 0), 'phead': (0, 0, 0), 'parm.L': (0, 0, 0)}, 45: {'torso': (-3, 4, 0), 'phead': (6, -10, 0), 'parm.L': (-8, 0, -6)}, 90: {'torso': (0, 0, 0), 'phead': (0, 0, 0), 'parm.L': (0, 0, 0)}})
action(prig, 'PipTalk', {1: {'phead': (0, 0, 0), 'parm.L': (0, 0, 0)}, 8: {'phead': (-8, 6, 0), 'parm.L': (-30, 0, -20)}, 16: {'phead': (4, -4, 0), 'parm.L': (-10, 0, -10)}, 24: {'phead': (0, 0, 0), 'parm.L': (0, 0, 0)}})
place(prig, (0, 0, 0))

# ── 預覽 ──
if RENDER:
    for t in list(rig.animation_data.nla_tracks) + list(prig.animation_data.nla_tracks):
        t.mute = True
    prig.location = V(1.3, 0, 0)
    for name, fr in [('Idle', 1), ('Run', 1), ('Swing1', 1), ('Swing1', 7), ('Spin', 10), ('Shoot', 1), ('Fly', 1), ('Jump', 1)]:
        rig.animation_data.action = bpy.data.actions[name]
        bpy.context.scene.frame_set(fr)
        mode = 'fly' if name == 'Fly' else 'back' if name in ('Idle', 'Run', 'Jump') else 'hand'
        bb.hide_render, bh.hide_render, bf.hide_render = mode != 'back', mode != 'hand', mode != 'fly'
        preview(os.path.join(PREV, 'hero_%s_%d.png' % (name, fr)), target=(0, 1.1, 0), dist=5.2, yaw=35, pitch=10, res=(480, 480))
    rig.animation_data.action = None
    for pb in rig.pose.bones:
        pb.rotation_quaternion = (1, 0, 0, 0); pb.location = (0, 0, 0)
    bpy.context.scene.frame_set(1)
    bb.hide_render = False; bh.hide_render = True; bf.hide_render = True
    preview(os.path.join(PREV, 'hero_face.png'), target=(0, 1.62, 0), dist=.9, yaw=15, pitch=4, res=(600, 600))
    preview(os.path.join(PREV, 'hero_face2.png'), target=(0, 1.62, 0), dist=.9, yaw=70, pitch=4, res=(600, 600))
    preview(os.path.join(PREV, 'hero_hair.png'), target=(0, 1.6, 0), dist=1.0, yaw=160, pitch=15, res=(600, 600))
    preview(os.path.join(PREV, 'hero_torso.png'), target=(0, 1.1, 0), dist=2.0, yaw=25, pitch=6, res=(600, 600))
    bh.hide_render = False
    preview(os.path.join(PREV, 'hero_handR.png'), target=(-.47, .95, .05), dist=.55, yaw=-60, pitch=10, res=(500, 500))
    preview(os.path.join(PREV, 'hero_handR2.png'), target=(-.47, .95, .05), dist=.55, yaw=30, pitch=-10, res=(500, 500))
    bh.hide_render = True
    preview(os.path.join(PREV, 'hero_handL.png'), target=(.47, .95, .05), dist=.55, yaw=60, pitch=10, res=(500, 500))
    preview(os.path.join(PREV, 'hero_boot.png'), target=(.1, .2, 0), dist=.9, yaw=40, pitch=12, res=(500, 500))
    preview(os.path.join(PREV, 'hero_back.png'), target=(0, 1.2, 0), dist=5, yaw=200, pitch=8, res=(480, 480))
    prig.location = V(0, 0, 0)
    rig.location = V(-3, 0, 0)
    preview(os.path.join(PREV, 'pip.png'), target=(0, 1.0, 0), dist=3.4, yaw=25, pitch=8, res=(480, 480))
    preview(os.path.join(PREV, 'pip_face.png'), target=(0, 1.44, .1), dist=.8, yaw=20, pitch=5, res=(600, 600))
    preview(os.path.join(PREV, 'pip_back.png'), target=(0, 1.0, 0), dist=3.4, yaw=200, pitch=8, res=(480, 480))
    preview(os.path.join(PREV, 'pip_side.png'), target=(0, 1.0, 0), dist=3.4, yaw=90, pitch=8, res=(480, 480))
    preview(os.path.join(PREV, 'pip_hands.png'), target=(0, 1.0, .1), dist=1.4, yaw=10, pitch=15, res=(600, 600))
    rig.location = V(0, 0, 0)
    prig.location = V(0, 0, 0)

rig.animation_data.action = None
for t in list(rig.animation_data.nla_tracks) + list(prig.animation_data.nla_tracks):
    t.mute = False
bpy.context.scene.frame_set(1)
export(OUT, [rig, prig])
print('pip tris', tri_count([pip]), 'brush tris', tri_count([bh]))
