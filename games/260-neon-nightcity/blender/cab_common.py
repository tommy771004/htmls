# 霓虹夜城（260）重做實車車內的共用工具：blender/cab_<id>.py 以 exec 或 import 使用
# 執行：/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P blender/cab_<id>.py（先跑 node tools/cab-tex.mjs）
# 座標直接用車身座標建模（+x 左＝左駕的駕駛側、+y 上、+z 車頭），最後掛在轉 90° 的根節點下，匯出就是 glTF 的車身座標。
# 產出 blender/out/cab_<id>.glb（每個面的材質名對到材質表）與 cab_<id>.json（材質表），tools/cab-swap.mjs 轉成頂點屬性換進實車。
# 材質表 PAL：col 是 sRGB 底色、r 粗糙、m 金屬、tex 貼圖（atlas* 不重複、其他重複，rep 是一格幾公尺）、emi 自發光強度。
# 對齊車身的規則：方向盤的每個零件要整塊在 cars.json sw 的圓柱裡（半徑 r+1.5 cm、沿軸 ±7 cm）才會跟著轉，撥桿要放在圓柱外；
# 門板要在 door 的多邊形裡、|x| 大於 xi 才會跟著門切走；門檻上緣要低於門框下緣。
import bpy, bmesh, math, os, json
from collections import defaultdict
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'out')
TEX = os.path.join(OUT, 'cab_tex')
S = dict(name='', pal={}, mat={}, root=None, objs=[])


def lin(h):
    h = h.lstrip('#')
    return tuple(((c / 255) / 12.92) if c / 255 <= .04045 else (((c / 255) + .055) / 1.055) ** 2.4 for c in (int(h[i:i + 2], 16) for i in (0, 2, 4)))


def setup(name, pal):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    S.update(name=name, pal=pal, mat={}, objs=[])
    for k, p in pal.items():
        m = bpy.data.materials.new('cab_' + k)
        try:
            m.use_nodes = True
        except Exception:
            pass
        b = m.node_tree.nodes.get('Principled BSDF')
        b.inputs['Base Color'].default_value = (*lin(p['col']), 1)
        b.inputs['Roughness'].default_value = p.get('r', .5)
        b.inputs['Metallic'].default_value = p.get('m', 0)
        if p.get('tex'):
            n = m.node_tree.nodes.new('ShaderNodeTexImage')
            n.image = bpy.data.images.load(os.path.join(TEX, p['tex'] + '.png'))
            m.node_tree.links.new(n.outputs['Color'], b.inputs['Base Color'])
        S['mat'][k] = m
    root = bpy.data.objects.new('cab_root', None)
    bpy.context.scene.collection.objects.link(root)
    root.rotation_euler = (math.pi / 2, 0, 0)   # 車身座標 (x, y, z) → Blender (x, -z, y)，匯出 Y-up 後還原
    S['root'] = root


def mk(name, V, F, FM, UV=None, sub=0, smooth=True, solid=0, bevel=0, bseg=2, recalc=True):
    """V：車身座標頂點，F：面，FM：每個面的材質名，UV：每個頂點的 (u, v)（Blender 的 v 朝上）"""
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(v) for v in V], [], [tuple(f) for f in F])
    me.update()
    names = list(dict.fromkeys(FM))
    for k in names:
        me.materials.append(S['mat'][k])
    for p, k in zip(me.polygons, FM):
        p.material_index = names.index(k)
        p.use_smooth = smooth
    if UV:
        L = me.uv_layers.new(name='UVMap')
        for p in me.polygons:
            for li in p.loop_indices:
                L.data[li].uv = UV[me.loops[li].vertex_index]
    if recalc:   # 封閉的實體讓法線朝外；單片的面（螢幕、貼圖片）照頂點順序（從正面看逆時針）
        bm = bmesh.new()
        bm.from_mesh(me)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        bm.to_mesh(me)
        bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(o)
    o.parent = S['root']
    if solid:
        md = o.modifiers.new('solid', 'SOLIDIFY')
        md.thickness = solid
        md.offset = 0
    if bevel:
        md = o.modifiers.new('bevel', 'BEVEL')
        md.width = bevel
        md.segments = bseg
        md.limit_method = 'ANGLE'
    if sub:
        md = o.modifiers.new('sub', 'SUBSURF')
        md.levels = sub
        md.render_levels = sub
    S['objs'].append(o)
    return o


def loft(rings, matf, closed=True, caps=('', ''), uvf=None, local=None):
    """rings：每圈一串頂點（同數量）；matf(i, j)：第 i 圈到 i+1 圈、第 j 段的材質名；caps：兩端封口的材質（'' 不封）
    local：和 rings 對應的區域座標（算 UV 用），uvf(區域座標, 車身座標) → (u, v)"""
    n = len(rings[0])
    V, F, FM, UV = [], [], [], []
    for i, r in enumerate(rings):
        for j, p in enumerate(r):
            V.append(Vector(p))
            if uvf:
                UV.append(uvf(local[i][j] if local else p, p))
    m = n if closed else n - 1
    for i in range(len(rings) - 1):
        for j in range(m):
            a, b, c, d = i * n + j, i * n + (j + 1) % n, (i + 1) * n + (j + 1) % n, (i + 1) * n + j
            F.append((a, b, c, d))
            FM.append(matf(i, j))
    if caps[0]:
        F.append(tuple(reversed(range(n))))
        FM.append(caps[0])
    if caps[1]:
        k = (len(rings) - 1) * n
        F.append(tuple(range(k, k + n)))
        FM.append(caps[1])
    return V, F, FM, (UV if uvf else None)


def frame(o, X, Y, Z):
    o, X, Y, Z = Vector(o), Vector(X), Vector(Y), Vector(Z)
    return lambda a, b, c: o + X * a + Y * b + Z * c


def cave(x, c, half, ramp):
    """x 在 c ± half 裡是 1，往外 ramp 內平滑降到 0（儀表板後緣在儀表前面往前退用）"""
    d = abs(x - c) - half
    if d <= 0:
        return 1.0
    if d >= ramp:
        return 0.0
    t = 1 - d / ramp
    return t * t * (3 - 2 * t)


def tilt_axes(deg):
    """面向駕駛（-z）、上緣往前傾 deg 度的平面：X 是駕駛的右手邊（車身 -x），Y 上，Z 朝駕駛"""
    t = math.radians(deg)
    return Vector((-1, 0, 0)), Vector((0, math.cos(t), math.sin(t))), Vector((0, math.sin(t), -math.cos(t)))


def rbox(name, c, s, mat, X=(1, 0, 0), Y=(0, 1, 0), Z=(0, 0, 1), bevel=.004, uv_rep=None):
    """中心 c、半尺寸 s 的盒子（區域軸 X Y Z），倒角"""
    T = frame(c, X, Y, Z)
    V = [T(sx * s[0], sy * s[1], sz * s[2]) for sz in (-1, 1) for sy in (-1, 1) for sx in (-1, 1)]
    F = [(0, 2, 3, 1), (4, 5, 7, 6), (0, 1, 5, 4), (2, 6, 7, 3), (0, 4, 6, 2), (1, 3, 7, 5)]
    UV = [((v.x + v.z) / uv_rep, v.y / uv_rep) for v in V] if uv_rep else None
    return mk(name, V, F, [mat] * 6, UV, smooth=False, bevel=bevel, bseg=2 if bevel else 0)


def cyl(name, c, axis, up, r, h0, h1, mat, segs=24, mat_cap=None, r1=None, smooth=True, bevel=0):
    """軸 axis 的圓柱（或圓錐 r→r1），h0..h1 沿軸"""
    ax = Vector(axis).normalized()
    u = Vector(up)
    u = (u - ax * u.dot(ax)).normalized()
    w = ax.cross(u)
    c = Vector(c)
    r1 = r if r1 is None else r1
    rings = [[c + ax * h + (u * math.cos(t) + w * math.sin(t)) * rr for t in (2 * math.pi * k / segs for k in range(segs))] for h, rr in ((h0, r), (h1, r1))]
    V, F, FM, _ = loft(rings, lambda i, j: mat, caps=(mat_cap or mat, mat_cap or mat))
    return mk(name, V, F, FM, smooth=smooth, bevel=bevel)


def torus(name, c, axis, up, R, r, mat, segs=48, rs=10, sq=1.0):
    ax = Vector(axis).normalized()
    u = Vector(up)
    u = (u - ax * u.dot(ax)).normalized()
    w = ax.cross(u)
    c = Vector(c)
    rings = []
    for k in range(segs):
        t = 2 * math.pi * k / segs
        d = u * math.cos(t) + w * math.sin(t)
        rings.append([c + d * (R + r * math.cos(p)) + ax * (r * sq * math.sin(p)) for p in (2 * math.pi * q / rs for q in range(rs))])
    rings.append(rings[0])
    V, F, FM, _ = loft(rings, lambda i, j: mat)
    return mk(name, V, F, FM)


def tube(name, pts, r, mat, sides=4, closed=False):
    """沿折線的細管（縫線、拉桿）"""
    P = [Vector(p) for p in pts]
    if closed:
        P.append(P[0])
    rings = []
    prev = None
    for i, p in enumerate(P):
        t = (P[min(i + 1, len(P) - 1)] - P[max(i - 1, 0)]).normalized()
        a = prev if prev is not None else (Vector((0, 1, 0)) if abs(t.y) < .9 else Vector((1, 0, 0)))
        a = (a - t * a.dot(t)).normalized()
        prev = a
        b = t.cross(a)
        rings.append([p + (a * math.cos(2 * math.pi * k / sides) + b * math.sin(2 * math.pi * k / sides)) * r for k in range(sides)])
    V, F, FM, _ = loft(rings, lambda i, j: mat, caps=('', '') if closed else (mat, mat))
    return mk(name, V, F, FM, smooth=True)


def quad(name, T, w, h, mat, uv):
    """區域平面 T(a, b, 0) 上 w×h 的貼圖片；uv＝(px, py, pw, ph) 是 1024² atlas 的像素範圍（左上原點）"""
    px, py, pw, ph = uv
    V = [T(a * w / 2, b * h / 2, 0) for b in (-1, 1) for a in (-1, 1)]
    UV = [((px + (a + 1) / 2 * pw) / 1024, 1 - (py + (1 - b) / 2 * ph) / 1024) for b in (-1, 1) for a in (-1, 1)]
    return mk(name, V, [(0, 1, 3, 2)], [mat], UV, smooth=False, recalc=False)


def disc(name, T, r, mat, uv, segs=32):
    """區域平面上的圓形貼圖片；uv＝(cx, cy, rr) atlas 像素的圓心與半徑"""
    cx, cy, rr = uv
    V, F, UV = [T(0, 0, 0)], [], [(cx / 1024, 1 - cy / 1024)]
    for q in range(segs):
        p = 2 * math.pi * q / segs
        V.append(T(r * math.cos(p), r * math.sin(p), 0))
        UV.append(((cx + rr * math.cos(p)) / 1024, 1 - (cy - rr * math.sin(p)) / 1024))   # 區域 +X 是駕駛的右手邊＝圖的右邊
        F.append((0, 1 + q, 1 + (q + 1) % segs))
    return mk(name, V, F, [mat] * segs, UV, smooth=False, recalc=False)


# ═══════════════ 座椅（桶椅：高側翼、中段另一種材質、椅背殼、肩帶孔） ═══════════════
def seat(xc, tag, z0, z1, vsF, vsR, W=.25, base=None, tilt=24, H=.815, main='leather_red', insert='perf_red', shell='carbon',
         bottom='plastic_blk', side=None, slots=True, rep=.05, head_insert=False, floor_y=.12, wing=1.0):
    """z0 椅墊前緣、z1 後緣（z0 > z1），vsF／vsR 前後的椅面高度；base＝(y, z) 椅背底部，tilt 後傾角，H 椅背高"""
    side = side or main
    cb = floor_y + .03
    fr = [0, .035, .2, .43, .66, .85, .97, 1.0]
    bhs = [.02, .03, .05, .06, .06, .05, .04, .035]
    rings, loc = [], []
    for k, f in enumerate(fr):
        z = z0 + (z1 - z0) * f
        vs = vsF + (vsR - vsF) * f ** .8
        bh = bhs[k] * wing
        Wk = W * (.92 if k == 0 else .96 if k == 7 else 1)
        s = .72 if k == 0 else .85 if k == 7 else 1
        pts = [(-Wk, cb), (-Wk, vs + bh - .035), (-Wk + .022, vs + bh), (-Wk + .07, vs + bh - .004), (-Wk + .11, vs + .006), (-.06, vs), (.06, vs), (Wk - .11, vs + .006), (Wk - .07, vs + bh - .004), (Wk - .022, vs + bh), (Wk, vs + bh - .035), (Wk, cb)]
        cy = (vs + cb) / 2
        rings.append([(xc + u * s, cy + (v - cy) * s, z) for u, v in pts])
        loc.append([(u, z) for u, v in pts])

    def cm(i, j):
        if j == 11:
            return bottom
        if j in (4, 5, 6) and 1 <= i <= 5:
            return insert
        return main if j in (2, 3, 7, 8) else side
    V, F, FM, UV = loft(rings, cm, caps=(main, bottom), uvf=lambda l, p: (l[0] / rep, l[1] / rep), local=loc)
    mk('seat_cush_' + tag, V, F, FM, UV, sub=2)
    by, bz = base if base else (vsR - .02, z1 + .035)
    t = math.radians(tilt)
    Yb, Zb = (0, math.cos(t), -math.sin(t)), (0, math.sin(t), math.cos(t))
    T = frame((xc, by, bz), (1, 0, 0), Yb, Zb)
    k = H / .815
    bs = [(0, .245, .07), (.06, .255, .10), (.25, .25, .115), (.44, .235, .095), (.54, .195, .055), (.62, .165, .032), (.71, .152, .026), (.785, .14, .022), (.815, .118, .0)]
    rings, loc = [], []
    for h, Wb, f in bs:
        Wb *= W / .25
        f *= wing
        pts = [(-Wb, -.075), (-Wb, f - .02), (-Wb + .025, f), (-Wb + .07, f - .006), (-Wb + .11, .018), (-.06, 0), (.06, 0), (Wb - .11, .018), (Wb - .07, f - .006), (Wb - .025, f), (Wb, f - .02), (Wb, -.075), (Wb - .05, -.11), (-Wb + .05, -.11)]
        if h > .8:
            pts = [(u * .8, d * .6 - .03) for u, d in pts]
        rings.append([T(u, h * k, d) for u, d in pts])
        loc.append([(u, h * k) for u, d in pts])

    def bm(i, j):
        if j in (11, 12, 13):
            return shell
        if j in (4, 5, 6) and (1 <= i <= 3 or head_insert and i == 6):
            return insert
        return main if j in (2, 3, 7, 8, 4, 5, 6) else side
    V, F, FM, UV = loft(rings, bm, caps=(bottom, main), uvf=lambda l, p: (l[0] / rep, l[1] / rep), local=loc)
    mk('seat_back_' + tag, V, F, FM, UV, sub=2)
    if slots:
        for su in (-.075, .075):
            rbox('seat_slot_%s_%d' % (tag, su > 0), T(su, .585 * k, .012), (.014, .03, .008), 'gloss_blk', X=(1, 0, 0), Y=Yb, Z=Zb, bevel=.005)
    zc, zl = (z0 + z1) / 2, (z0 - z1) / 2
    rbox('seat_base_' + tag, (xc, floor_y + .038, zc), (W * .8, .018, zl * .82), 'plastic_blk', bevel=.006)
    for su in (-.15, .15):
        rbox('seat_rail_%s_%d' % (tag, su > 0), (xc + su * W / .25, floor_y + .013, zc + .02), (.012, .008, zl * 1.04), 'dark_alu', bevel=.002)


# ═══════════════ 方向盤 ═══════════════
class Wheel:
    def __init__(self, c, t):
        self.c, self.t = Vector(c), math.radians(t)
        self.X, self.Y, self.Z = Vector((-1, 0, 0)), Vector((0, math.cos(self.t), math.sin(self.t))), Vector((0, math.sin(self.t), -math.cos(self.t)))   # Z 朝駕駛
        self.F = frame(self.c, self.X, self.Y, self.Z)


def steering(W, R=.158, flat=-.128, rim='leather_blk', grip='perf_blk', stitch='stitch_red', a=(.0135, .016), ag=(.0165, .0175), grip_cos=.67,
             spokes='viper', hub='leather_blk', badge_uv=(128, 640, 120), keys_uv=((256, 512), (384, 512)), stripe=None, trim='satin_alu', hub_size=(.066, .060)):
    """W：Wheel(中心, 傾角)；R 輪圈中心線半徑；flat 平底高度（None 是正圓）；a／ag 輪圈與握把的截面半徑（徑向、沿軸）
    spokes：'viper' 左右輻＋按鍵面板＋銀色 V 形下輻、'r8' 左右輻＋下方兩個衛星按鈕、'momo' 三條細鋁輻（f40）"""
    F = W.F
    segs, rs = 96, 12
    cl = []
    for k in range(segs):
        t = 2 * math.pi * k / segs
        x, y = R * math.cos(t), R * math.sin(t)
        if flat is not None and y < flat:
            y = flat + (y - flat) * .12
        cl.append((x, y, t))
    isg = lambda t: math.cos(t) ** 2 > grip_cos and grip != rim
    isstripe = lambda t: stripe and abs(math.sin(t) - 1) < .004
    rings, loc = [], []
    for k in range(segs):
        x, y, t = cl[k]
        xn, yn, _ = cl[(k + 1) % segs]
        xp, yp, _ = cl[k - 1]
        tx, ty = xn - xp, yn - yp
        L = math.hypot(tx, ty)
        nx, ny = ty / L, -tx / L
        ra, rb = ag if isg(t) else a
        rings.append([F(x + nx * ra * math.cos(p), y + ny * ra * math.cos(p), rb * math.sin(p)) for p in (2 * math.pi * q / rs for q in range(rs))])
        loc.append([(k * 2 * math.pi * R / segs, q / rs * .1) for q in range(rs)])
    rings.append(rings[0])
    loc.append([(segs * 2 * math.pi * R / segs, q / rs * .1) for q in range(rs)])

    def rm(i, j):
        t = cl[i % segs][2]
        if isstripe(t):
            return stripe
        return grip if isg(t) else rim
    V, F2, FM, UV = loft(rings, rm, uvf=lambda l, p: (l[0] / .04, l[1] / .04), local=loc)
    mk('sw_rim', V, F2, FM, UV)
    if stitch:
        pts = []
        for x, y, t in cl:
            L = math.hypot(x, y)
            ra = (ag if isg(t) else a)[0]
            pts.append(F(x - x / L * (ra + .0006), y - y / L * (ra + .0006), 0))
        tube('sw_stitch', pts, .0014, stitch, sides=4, closed=True)
    hw, hh = hub_size
    if spokes in ('viper', 'r8', 'svj'):
        for sgn in (-1, 1):
            rings = []
            for r, h2, th in ((hw * .75, .028, .013), (.08, .026, .013), (.12, .021, .012), (R - .008, .018, .011)):
                rings.append([F(sgn * r, -.012 + h2 * math.sin(p), -.004 + th * math.cos(p)) for p in (2 * math.pi * q / 8 for q in range(8))])
            V, F2, FM, _ = loft(rings, lambda i, j: 'carbon' if spokes == 'svj' and j in (1, 2, 3) else rim, caps=(rim, rim))
            mk('sw_spoke_%d' % (sgn > 0), V, F2, FM, sub=1)
            cx = sgn * (hw + .032)
            rbox('sw_bezel_%d' % (sgn > 0), F(cx, -.008, .008), (.03, .025, .004), trim, X=W.X, Y=W.Y, Z=W.Z, bevel=.003)
            px0, py0 = keys_uv[0] if sgn < 0 else keys_uv[1]
            quad('sw_keys_%d' % (sgn > 0), lambda a2, b2, c2, cx=cx: F(cx + a2, -.008 + b2, .0125 + c2), .052, .042, 'keys', (px0, py0, 128, 128))
    if spokes == 'viper':
        for sgn in (-1, 1):
            rings = []
            for r, ang in ((.045, -90 + sgn * 16), (.10, -90 + sgn * 24), (R - .01, -90 + sgn * 30)):
                q = math.radians(ang)
                cx, cy = r * math.cos(q), max(r * math.sin(q), (flat or -R) + .004)
                tx, ty = -math.sin(q), math.cos(q)
                rings.append([F(cx + tx * .007 * math.cos(p), cy + ty * .007 * math.cos(p), -.004 + .009 * math.sin(p)) for p in (2 * math.pi * k / 6 for k in range(6))])
            V, F2, FM, _ = loft(rings, lambda i, j: trim, caps=(trim, trim))
            mk('sw_low_%d' % (sgn > 0), V, F2, FM, sub=1)
    if spokes in ('r8', 'svj'):
        # 下輻：一條寬的往下，r8 在下輻兩側加衛星按鈕（左駕駛模式、右紅色啟動）
        rings = []
        for r, w2 in ((hh * .8, .022), (.10, .016), (min(R - .01, -(flat if flat is not None else -R) - .004), .02)):
            rings.append([F(w2 * math.cos(p), -r, -.004 + .010 * math.sin(p)) for p in (2 * math.pi * k / 8 for k in range(8))])
        V, F2, FM, _ = loft(rings, lambda i, j: trim if spokes == 'r8' else 'carbon', caps=(rim, rim))
        mk('sw_low', V, F2, FM, sub=1)
        if spokes == 'r8':
            for sgn in (-1, 1):
                c = F(sgn * .045, -.088, .006)
                cyl('sw_sat_%d' % (sgn > 0), c, W.Z, W.Y, .019, -.012, .004, rim, segs=24)
                disc('sw_satk_%d' % (sgn > 0), lambda a2, b2, c2, c=c: c + W.X * a2 + W.Y * b2 + W.Z * (.0045 + c2), .015, 'keys', (320 if sgn < 0 else 448, 576, 58), segs=24)
    if spokes == 'momo':
        # 三條細鋁輻（3、9、6 點），中間小圓喇叭鈕
        for ang in (0, 180, 270):
            q = math.radians(ang)
            d, n = Vector((math.cos(q), math.sin(q))), Vector((-math.sin(q), math.cos(q)))
            rings = []
            for r, w2 in ((.03, .016), (.09, .011), (R - .006, .013)):
                rings.append([F(d.x * r + n.x * w2 * u2, d.y * r + n.y * w2 * u2, -.006 + .003 * v2) for u2, v2 in ((-1, -1), (1, -1), (1, 1), (-1, 1))])
            V, F2, FM, _ = loft(rings, lambda i, j: trim, caps=(trim, trim))
            mk('sw_spoke_%d' % ang, V, F2, FM, bevel=.0015)
        cyl('sw_hub', F(0, 0, -.025), W.Z, W.Y, .034, 0, .03, rim, segs=32, r1=.03)
        disc('sw_badge', lambda a2, b2, c2: F(a2, b2, .0052 + c2), .029, 'badge', badge_uv)
        torus('sw_badge_ring', F(0, 0, .005), W.Z, W.Y, .03, .0022, trim, segs=40, rs=6)
        return
    rings = []
    for c, s in ((-.03, .86), (-.012, 1.0), (.008, 1.0), (.016, .94), (.019, .82)):
        ring = []
        for q in range(32):
            p = 2 * math.pi * q / 32
            cs, sn = math.cos(p), math.sin(p)
            ring.append(F(hw * s * math.copysign(abs(cs) ** .7, cs), .004 + hh * s * math.copysign(abs(sn) ** .7, sn), c))
        rings.append(ring)
    V, F2, FM, _ = loft(rings, lambda i, j: hub, caps=(hub, hub))
    mk('sw_hub', V, F2, FM, sub=1)
    disc('sw_badge', lambda a2, b2, c2: F(a2, .004 + b2, .0205 + c2), .03, 'badge', badge_uv)
    torus('sw_badge_ring', F(0, .004, .0195), W.Z, W.Y, .031, .0022, trim, segs=40, rs=6)


def column(W, length=.24, r0=.042, r1=.055, mat='plastic_blk', tip='satin_alu'):
    F = W.F
    cyl('sw_column', F(0, -.012, -.035), -W.Z, W.Y, r0, 0, length, mat, segs=24, r1=r1)
    for sgn in (-1, 1):
        a = F(sgn * .045, -.005, -.10)
        b = a + W.X * sgn * .12 + W.Y * -.012 + W.Z * .02
        tube('sw_stalk_%d' % (sgn > 0), [a, (a + b) / 2, b], .0065, mat, sides=8)
        cyl('sw_stalk_tip_%d' % (sgn > 0), b, b - a, W.Y, .0072, 0, .018, tip, segs=12)


# ═══════════════ 儀表（貼圖片＋外框＋拱形儀表罩） ═══════════════
def cluster(c, tilt, w, h, uv, hood=(.19, .145, -.04, .052), mat='gauge', frame_mat='gloss_blk', hood_out='dash_top', hood_in='plastic_blk', stitch='stitch_red', lip='leather_blk'):
    """c 儀表中心、tilt 上緣往前傾的角度、w×h 尺寸、uv atlas 像素範圍；hood＝(半寬, 高, 往後起點, 往駕駛的深度)"""
    X, Y, Z = tilt_axes(tilt)
    T = frame(c, X, Y, Z)
    quad('cluster_lcd', T, w, h, mat, uv)
    rbox('cluster_frame', T(0, 0, -.006), (w / 2 + .012, h / 2 + .012, .005), frame_mat, X=X, Y=Y, Z=Z, bevel=.004)
    if not hood:
        return T
    hx, hy, c0, c1 = hood
    rings = []
    for cc, sc in ((c0, 1.0), (c1 * .23, 1.0), (c1 * .87, .97), (c1, .93)):
        ring = [T(-math.cos(p) * hx * sc, -.025 + math.sin(p) * hy * sc, cc) for p in (math.pi * q / 16 for q in range(17))]
        ring += [T(-math.cos(p) * (hx - .016) * sc, -.025 + math.sin(p) * (hy - .016) * sc, cc) for p in (math.pi * q / 16 for q in range(16, -1, -1))]
        rings.append(ring)
    V, F, FM, _ = loft(rings, lambda i, j: hood_out if j < 16 else (lip if j == 16 or j == 33 else hood_in), caps=(hood_out, lip))
    mk('cluster_hood', V, F, FM, sub=1)
    if stitch:
        tube('cluster_stitch', [T(-math.cos(p) * (hx + .0015), -.025 + math.sin(p) * (hy + .0015), c1 * .7) for p in (math.pi * q / 40 for q in range(1, 40))], .0013, stitch, sides=4)
    return T


def vent(c, R=.036, tilt=12, ring='satin_alu', barrel='plastic_blk', blade='gloss_blk', knob='satin_alu', n=5):
    X, Y, Z = tilt_axes(tilt)
    T = frame(c, X, Y, Z)
    torus('vent_ring', T(0, 0, .004), Z, Y, R, R * .18, ring, segs=40, rs=8, sq=1.3)
    cyl('vent_barrel', T(0, 0, -.03), Z, Y, R * .92, 0, .032, barrel, segs=28, mat_cap='rubber')
    for k in range(-(n // 2), n // 2 + 1):
        hy = k * R * .33
        hw = math.sqrt(max((R * .86) ** 2 - hy ** 2, 0))
        rbox('vent_blade', T(0, hy, -.004), (hw, .0012, .007), blade, X=X, Y=(Y * .94 + Z * .34).normalized(), Z=(Z * .94 - Y * .34).normalized(), bevel=0)
    if knob:
        cyl('vent_knob', T(0, 0, -.002), Z, Y, R * .2, 0, .006, knob, segs=16)


def slot_vent(c, w, h, tilt=12, frame_mat='satin_alu', blade='gloss_blk', n=4):
    """長方形出風口（框＋水平葉片）"""
    X, Y, Z = tilt_axes(tilt)
    T = frame(c, X, Y, Z)
    rbox('svent_frame', T(0, 0, -.004), (w / 2 + .006, h / 2 + .006, .006), frame_mat, X=X, Y=Y, Z=Z, bevel=.003)
    rbox('svent_hole', T(0, 0, -.002), (w / 2, h / 2, .006), 'rubber', X=X, Y=Y, Z=Z, bevel=0)
    for k in range(n):
        rbox('svent_blade', T(0, -h / 2 + h * (k + .5) / n, .002), (w / 2 - .002, .0012, .006), blade, X=X, Y=(Y * .94 + Z * .34).normalized(), Z=(Z * .94 - Y * .34).normalized(), bevel=0)


# ═══════════════ 門板 ═══════════════
def door_card(sgn, za, zb, xi, xo, y0, ya, y1, arm=(-.66, .16), upper='leather_red', arm_mat='leather_blk', lower='plastic_blk', ledge='leather_blk2',
              insert_z=None, pull=True, release=True, speaker=True, switch=True, armw=1.0):
    """za..zb 門板前後（za 後、zb 前），xi 內面 |x|、xo 外緣，y0 底、ya 扶手、y1 窗線；arm 扶手的 z 範圍"""
    n = 12
    zs = [za, za + .01] + [za + .02 + (zb - za - .04) * k / (n - 1) for k in range(n)] + [zb - .01, zb]
    rings = []
    for z in zs:
        ar = max(0, min(1, (z - arm[0]) / .1, (arm[1] - z) / .1)) * armw
        e = 1 if za + .005 < z < zb - .005 else .5
        pts = [(xo, y0), (xi + .02, y0 + .015), (xi + .01, y0 + .11), (xi, ya - .015), (xi - .045 * ar, ya), (xi - .068 * ar, ya + .032), (xi - .042 * ar, ya + .051), (xi - .004, ya + .067), (xi, ya + .165), (xi + .004, y1 - .05), (xi + .02, y1 - .01), (xo, y1)]
        rings.append([(sgn * (xo - (xo - x) * e), y, z) for x, y in pts])
    iz = insert_z or (arm[0] + .04, arm[1] - .04)

    def m(i, j):
        z = (zs[i] + zs[i + 1]) / 2
        if j in (7, 8) and iz[0] < z < iz[1]:
            return upper
        if j in (3, 4, 5, 6):
            return arm_mat
        if j in (9, 10):
            return ledge
        return lower
    o = mk('door_card_%d' % (sgn > 0), *loft(rings, m, caps=(lower, lower))[:3], sub=1)
    zm = (arm[0] + arm[1]) / 2
    if pull:
        tube('door_pull_%d' % (sgn > 0), [(sgn * (xi - .042), ya + .06, zm + .07), (sgn * (xi - .066), ya + .073, zm + .03), (sgn * (xi - .07), ya + .075, zm - .05), (sgn * (xi - .052), ya + .065, zm - .10)], .0065, 'satin_alu', sides=8)
    if release:
        rbox('door_rel_rec_%d' % (sgn > 0), (sgn * (xi - .004), ya + .175, zb - .11), (.006, .022, .05), 'gloss_blk', bevel=.004)
        rbox('door_rel_%d' % (sgn > 0), (sgn * (xi - .014), ya + .177, zb - .115), (.006, .006, .04), 'satin_alu', bevel=.003)
    if speaker:
        cyl('door_spk_%d' % (sgn > 0), (sgn * (xi + .01), y0 + .082, zb - .16), (-sgn, 0, 0), (0, 1, 0), .056, 0, .006, 'perf_blk', segs=32)
        torus('door_spk_ring_%d' % (sgn > 0), (sgn * (xi + .006), y0 + .082, zb - .16), (-sgn, 0, 0), (0, 1, 0), .058, .0035, 'satin_alu', segs=40, rs=6)
    if switch:
        rbox('door_sw_%d' % (sgn > 0), (sgn * (xi - .048), ya + .05, arm[1] - .12), (.022, .005, .035), 'gloss_blk', bevel=.004)
    return o


# ═══════════════ 地板、踏板、前圍、側踢板、門檻、A 柱下段 ═══════════════
def floor(fy, fx=(.16, .70), fz=(-.62, .47), toe=(.47, .60, .30), fw=(.615, .72, .50), kick=None, sill=None, pedals=None, apillar=None,
          carpet='carpet', mat='mat', sill_mat='carbon', kick_mat='plastic_blk', mats=True, xc=.42):
    """fy 地板高；fx、fz 地毯範圍；toe＝(斜板起點 z, 終點 z, 終點 y)；fw＝(前圍 z, 半寬, 頂高)；
    kick＝(x, z0, z1, y1)；sill＝(x, 半寬, y 上緣, z0, z1)；pedals＝(z, y, [(x, 半寬, 半高)…], 死踏板 x)；apillar＝四點（下內、下外、上內、上外，左側）"""
    xm, xw = (fx[0] + fx[1]) / 2, (fx[1] - fx[0]) / 2
    for sgn in (-1, 1):
        rbox('carpet_%d' % (sgn > 0), (sgn * xm, fy + .006, (fz[0] + fz[1]) / 2), (xw, .006, (fz[1] - fz[0]) / 2), carpet, bevel=.004)
        if mats:
            zc = fz[1] - .27
            rbox('floormat_%d' % (sgn > 0), (sgn * xc, fy + .016, zc), (.19, .004, .22), mat, bevel=.003)
            tube('floormat_edge_%d' % (sgn > 0), [(sgn * (xc + a * .19), fy + .02, zc + b * .22) for a, b in ((-1, -1), (1, -1), (1, 1), (-1, 1))], .0035, 'leather_blk', sides=6, closed=True)
        z0, z1, ty = toe
        d = Vector((0, ty - fy, z1 - z0))
        L = d.length
        d.normalize()
        rbox('toeboard_%d' % (sgn > 0), (sgn * xm, (fy + ty) / 2, (z0 + z1) / 2), (xw, .006, L / 2), carpet, Y=(0, d.z, -d.y), Z=(0, d.y, d.z), bevel=.004)
        if kick:
            kx, kz0, kz1, ky1 = kick
            rbox('kick_%d' % (sgn > 0), (sgn * kx, (fy + ky1) / 2, (kz0 + kz1) / 2), (.012, (ky1 - fy) / 2, (kz1 - kz0) / 2), kick_mat, bevel=.006)
        if sill:
            sx, sw, sy, sz0, sz1 = sill
            rbox('sill_%d' % (sgn > 0), (sgn * sx, (fy + sy) / 2, (sz0 + sz1) / 2), (sw, (sy - fy) / 2, (sz1 - sz0) / 2), kick_mat, bevel=.008)
            rbox('sill_plate_%d' % (sgn > 0), (sgn * sx, sy + .003, (sz0 + sz1) / 2), (sw * .92, .004, (sz1 - sz0) / 2 - .06), sill_mat, bevel=.002, uv_rep=.06)
        if apillar:
            p = [Vector((sgn * v[0], v[1], v[2])) for v in apillar]
            n = Vector((-sgn * .9, -.3, -.2)).normalized() * .014
            V = p + [q + n for q in p]
            F = [(0, 1, 3, 2), (4, 6, 7, 5), (0, 2, 6, 4), (1, 5, 7, 3), (0, 4, 5, 1), (2, 3, 7, 6)]
            mk('apillar_%d' % (sgn > 0), V, F, ['leather_blk'] * 6, sub=1)
    if fw:
        wz, ww, wy = fw
        rbox('firewall', (0, (fy + wy) / 2, wz), (ww, (wy - fy) / 2, .012), carpet, bevel=.004)
    if pedals:
        pz, py, L, dead = pedals
        t = math.radians(38)
        Y, Z = Vector((0, math.cos(t), -math.sin(t))), Vector((0, math.sin(t), math.cos(t)))
        for x, w, h in L:
            c = Vector((x, py, pz))
            rbox('pedal_%d' % round(x * 100), c, (w, h, .005), 'satin_alu', X=(1, 0, 0), Y=Y, Z=Z, bevel=.003)
            for k in (-1, 0, 1):
                rbox('pedal_grip_%d_%d' % (round(x * 100), k), c + Y * k * h * .55 - Z * .006, (w * .85, .0025, .0015), 'rubber', X=(1, 0, 0), Y=Y, Z=Z, bevel=0)
            tube('pedal_arm_%d' % round(x * 100), [c + Z * .008, c + Vector((0, .1, .04)), c + Vector((0, .2, .05))], .006, 'dark_alu', sides=6)
        if dead:
            rbox('dead_pedal', (dead, py - .06, pz - .06), (.04, .06, .005), 'satin_alu', Y=Y, Z=Z, bevel=.003)


# ═══════════════ 烘焙修改器、縫線、匯出 ═══════════════
def seams(o, pairs, smat, rows=(-.0035, .0035), off=.0011, r=.0012, step=.012, xlim=None):
    """o 網格上 pairs 兩種材質的交界邊串成折線，沿表面法線抬一點、左右各一排細管當縫線；xlim：只做 |x| 小於它的邊（避開端面）"""
    names = [m.name[4:] for m in o.data.materials]
    bm = bmesh.new()
    bm.from_mesh(o.data)
    bm.normal_update()
    E = [e for e in bm.edges if len(e.link_faces) == 2 and (names[e.link_faces[0].material_index], names[e.link_faces[1].material_index]) in pairs
         and (xlim is None or max(abs(v.co.x) for v in e.verts) < xlim)]
    adj = defaultdict(list)
    for e in E:
        for v in e.verts:
            adj[v.index].append(e)
    used = set()
    for e in E:
        if e.index in used:
            continue
        used.add(e.index)
        ch = [e.verts[0], e.verts[1]]
        for end in (1, 0):
            while True:
                v = ch[-1] if end else ch[0]
                nx = [x for x in adj[v.index] if x.index not in used]
                if not nx:
                    break
                used.add(nx[0].index)
                w = nx[0].other_vert(v)
                if end:
                    ch.append(w)
                else:
                    ch.insert(0, w)
        P = [(v.co.copy(), v.normal.copy()) for v in ch]
        Sx = [P[0]]
        acc = 0
        for i in range(1, len(P)):
            acc += (P[i][0] - P[i - 1][0]).length
            if acc >= step or i == len(P) - 1:
                Sx.append(P[i])
                acc = 0
        if len(Sx) < 2:
            continue
        for dr in rows:
            pts = []
            for i, (c, n) in enumerate(Sx):
                t = (Sx[min(i + 1, len(Sx) - 1)][0] - Sx[max(i - 1, 0)][0])
                sd = t.cross(n).normalized() if t.length > 1e-6 else Vector((0, 0, 0))
                pts.append(c + n * off + sd * dr)
            tube('%s_st' % o.name, pts, r, smat, sides=3)
    bm.free()


def both(a, b):
    return {(a, b), (b, a)}


def finish(rules):
    """rules：[(物件名開頭, 材質對集合, 縫線材質, rows)…]；烘焙修改器、長縫線、匯出 glb 與材質表"""
    dg = bpy.context.evaluated_depsgraph_get()
    for o in S['objs']:
        if not o.modifiers:
            continue
        me = bpy.data.meshes.new_from_object(o.evaluated_get(dg))
        o.modifiers.clear()
        o.data = me
    for o in list(S['objs']):
        for pre, pairs, smat, rows, *kw in rules:   # 第五項（選用）：seams 的其他參數，例如 dict(xlim=.68)
            if o.name.startswith(pre):
                seams(o, pairs, smat, rows=rows, **(kw[0] if kw else {}))
    path = os.path.join(OUT, S['name'] + '.glb')
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=False, export_animations=False, export_yup=True, export_apply=True,
                              export_cameras=False, export_lights=False, export_extras=False, export_texcoords=True, export_normals=True, export_materials='EXPORT')
    json.dump({'pal': S['pal']}, open(os.path.join(OUT, S['name'] + '.json'), 'w'), indent=1)
    tris = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in bpy.data.objects if o.type == 'MESH')
    print('ok', path, '%d KB' % (os.path.getsize(path) / 1024), 'tris', tris)
