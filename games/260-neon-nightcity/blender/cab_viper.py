# 霓虹夜城（260）viper 重做的車內 → blender/out/cab_viper.glb ＋ cab_viper.json（材質表），tools/cab-swap.mjs 換進 assets/260/viper.glb
# 執行：/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P blender/cab_viper.py
# 先跑 node tools/cab-tex.mjs 產生 blender/out/cab_tex/ 的貼圖。
# 參考：2013–17 SRT Viper GTS 紅黑內裝（紅色皮椅與門板、黑色縫紅線的儀表板與中央通道、圓形出風口配銀圈、平底三輻方向盤）。
# 座標直接用車身座標建模（+x 左＝駕駛側、+y 上、+z 車頭），最後掛在轉 90° 的根節點下，匯出就是 glTF 的車身座標。
# 位置對齊原模型（tools/cab-swap.mjs 的剖面）：地板 y .12、方向盤 sw、門框多邊形 door.ps（門板要在 |x| > xi .55 才跟著門走）。
import bpy, bmesh, math, os, json
from collections import defaultdict
from mathutils import Vector, Matrix

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'out')
TEX = os.path.join(OUT, 'cab_tex')
NAME = 'cab_viper'

bpy.ops.wm.read_factory_settings(use_empty=True)
SC = bpy.context.scene

# 材質表：col 是 sRGB 底色、r 粗糙、m 金屬、tex 貼圖（atlas 不重複，perf／carbon 重複，rep 是一格幾公尺）、emi 自發光強度
PAL = {
    'leather_red': dict(col='#a8281d', r=.55),
    'perf_red': dict(col='#962218', r=.62, tex='perf', rep=.05),
    'leather_blk': dict(col='#222225', r=.58),
    'leather_blk2': dict(col='#222225', r=.58),
    'perf_blk': dict(col='#1d1d20', r=.62, tex='perf', rep=.04),
    'dash_top': dict(col='#1b1b1d', r=.78),
    'dash_top2': dict(col='#1b1b1d', r=.78),
    'plastic_blk': dict(col='#161618', r=.82),
    'gloss_blk': dict(col='#0b0b0d', r=.12),
    'satin_alu': dict(col='#9a9ca2', r=.3, m=.9),
    'dark_alu': dict(col='#4c4e54', r=.35, m=.85),
    'carbon': dict(col='#d8d8dc', r=.22, tex='carbon', rep=.06),
    'carpet': dict(col='#1d1d1f', r=1.0),
    'mat': dict(col='#151516', r=1.0),
    'stitch_red': dict(col='#d02a1e', r=.6),
    'stitch_dk': dict(col='#2a2a2c', r=.7),
    'rubber': dict(col='#0f0f10', r=.9),
    'gauge': dict(col='#ffffff', r=.3, tex='atlas', emi=.5),
    'screen': dict(col='#ffffff', r=.15, tex='atlas', emi=.55),
    'badge': dict(col='#ffffff', r=.3, tex='atlas'),
    'keys': dict(col='#ffffff', r=.4, tex='atlas', emi=.3),
    'led_red': dict(col='#ff2a1f', r=.3, emi=1.0),
    'start_red': dict(col='#c4211a', r=.25),
}


def lin(h):
    h = h.lstrip('#')
    return tuple(((c / 255) / 12.92) if c / 255 <= .04045 else (((c / 255) + .055) / 1.055) ** 2.4 for c in (int(h[i:i + 2], 16) for i in (0, 2, 4)))


MAT = {}
for k, p in PAL.items():
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
    MAT[k] = m

ROOT = bpy.data.objects.new('cab_root', None)
SC.collection.objects.link(ROOT)
ROOT.rotation_euler = (math.pi / 2, 0, 0)   # 車身座標 (x, y, z) → Blender (x, -z, y)，匯出 Y-up 後還原
OBJS = []


def V3(*a):
    return Vector(a[0] if len(a) == 1 else a)


def mk(name, V, F, FM, UV=None, sub=0, smooth=True, solid=0, bevel=0, bseg=2, recalc=True):
    """V：車身座標頂點，F：面，FM：每個面的材質名，UV：每個頂點的 (u, v)（Blender 的 v 朝上）"""
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(v) for v in V], [], [tuple(f) for f in F])
    me.update()
    names = list(dict.fromkeys(FM))
    for k in names:
        me.materials.append(MAT[k])
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
    SC.collection.objects.link(o)
    o.parent = ROOT
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
    OBJS.append(o)
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


# ═══════════════ 座椅（Sabelt 式桶椅：高側翼、打孔中段、碳纖椅背殼、肩帶孔） ═══════════════
def seat(xc, tag):
    W0 = .25
    # 椅墊：沿 z 放樣，剖面是帶兩側翼的 U 形；(z, 椅面高 vs, 側翼加高 bh, 半寬 W, 縮放 s)
    st = [(.035, .29, .02, .23, .72), (.012, .30, .03, .245, 1), (-.10, .285, .05, W0, 1), (-.25, .262, .06, W0, 1), (-.40, .242, .06, W0, 1), (-.52, .228, .05, W0, 1), (-.60, .222, .04, W0, 1), (-.62, .222, .035, .24, .85)]
    rings, loc = [], []
    for z, vs, bh, W, s in st:
        pts = [(-W, .15), (-W, vs + bh - .035), (-W + .022, vs + bh), (-W + .07, vs + bh - .004), (-W + .11, vs + .006), (-.06, vs), (.06, vs), (W - .11, vs + .006), (W - .07, vs + bh - .004), (W - .022, vs + bh), (W, vs + bh - .035), (W, .15)]
        cy = (vs + .15) / 2
        rings.append([(xc + u * s, cy + (v - cy) * s, z) for u, v in pts])
        loc.append([(u, z) for u, v in pts])

    def cm(i, j):
        if j == 11:
            return 'plastic_blk'
        if j in (4, 5, 6) and 1 <= i <= 5:
            return 'perf_red'
        return 'leather_red'
    V, F, FM, UV = loft(rings, cm, caps=('leather_red', 'leather_blk'), uvf=lambda l, p: (l[0] / .05, l[1] / .05), local=loc)
    mk('seat_cush_' + tag, V, F, FM, UV, sub=2)

    # 椅背：區域座標 (u 橫向, h 沿椅背往上, d 往前)；後傾 24°，底部接在椅墊後緣
    tilt = math.radians(24)
    T = frame((xc, .205, -.585), (1, 0, 0), (0, math.cos(tilt), -math.sin(tilt)), (0, math.sin(tilt), math.cos(tilt)))
    bs = [(0, .245, .07), (.06, .255, .10), (.25, .25, .115), (.44, .235, .095), (.54, .195, .055), (.62, .165, .032), (.71, .152, .026), (.785, .14, .022), (.815, .118, .0)]
    rings, loc = [], []
    for h, W, f in bs:
        pts = [(-W, -.075), (-W, f - .02), (-W + .025, f), (-W + .07, f - .006), (-W + .11, .018), (-.06, 0), (.06, 0), (W - .11, .018), (W - .07, f - .006), (W - .025, f), (W, f - .02), (W, -.075), (W - .05, -.11), (-W + .05, -.11)]
        if h > .8:
            pts = [(u * .8, d * .6 - .03) for u, d in pts]
        rings.append([T(u, h, d) for u, d in pts])
        loc.append([(u, h) for u, d in pts])

    def bm(i, j):
        if j in (11, 12, 13):
            return 'carbon'
        if j in (4, 5, 6) and 1 <= i <= 3:
            return 'perf_red'
        return 'leather_red'
    V, F, FM, UV = loft(rings, bm, caps=('plastic_blk', 'leather_red'), uvf=lambda l, p: (l[0] / .05, l[1] / .05), local=loc)
    mk('seat_back_' + tag, V, F, FM, UV, sub=2)
    # 肩帶孔（黑色亮面嵌框）
    for su in (-.075, .075):
        rbox('seat_slot_%s_%d' % (tag, su > 0), T(su, .585, .012), (.014, .03, .008), 'gloss_blk', X=(1, 0, 0), Y=(0, math.cos(tilt), -math.sin(tilt)), Z=(0, math.sin(tilt), math.cos(tilt)), bevel=.005)
    # 底座與滑軌
    rbox('seat_base_' + tag, (xc, .158, -.30), (.2, .018, .27), 'plastic_blk', bevel=.006)
    for su in (-.15, .15):
        rbox('seat_rail_%s_%d' % (tag, su > 0), (xc + su, .133, -.28), (.012, .008, .34), 'dark_alu', bevel=.002)


# ═══════════════ 方向盤（平底三輻、打孔握把、紅縫線、銀色下輻、按鍵面板、中央徽章） ═══════════════
SW_C, SW_T = Vector((.376, .725, -.086)), math.radians(22)
SX, SY, SZ = Vector((-1, 0, 0)), Vector((0, math.cos(SW_T), math.sin(SW_T))), Vector((0, math.sin(SW_T), -math.cos(SW_T)))   # SZ 朝駕駛
SWF = frame(SW_C, SX, SY, SZ)


def steering():
    R, segs, rs = .158, 96, 12
    cl = []
    for k in range(segs):
        t = 2 * math.pi * k / segs
        x, y = R * math.cos(t), R * math.sin(t)
        if y < -.128:
            y = -.128 + (y + .128) * .12
        cl.append((x, y, t))
    rings, loc = [], []
    for k in range(segs):
        x, y, t = cl[k]
        xn, yn, _ = cl[(k + 1) % segs]
        xp, yp, _ = cl[k - 1]
        tx, ty = xn - xp, yn - yp
        L = math.hypot(tx, ty)
        nx, ny = ty / L, -tx / L   # 往外
        grip = math.cos(t) ** 2 > .67
        a, b = (.0165, .0175) if grip else (.0135, .016)
        ring = []
        for q in range(rs):
            p = 2 * math.pi * q / rs
            ring.append(SWF(x + nx * a * math.cos(p), y + ny * a * math.cos(p), b * math.sin(p)))
        rings.append(ring)
        loc.append([(k * 2 * math.pi * R / segs, q / rs * .1) for q in range(rs)])
    rings.append(rings[0])
    loc.append([(segs * 2 * math.pi * R / segs, q / rs * .1) for q in range(rs)])

    def rm(i, j):
        t = cl[i % segs][2]
        return 'perf_blk' if math.cos(t) ** 2 > .67 else 'leather_blk'
    V, F, FM, UV = loft(rings, rm, uvf=lambda l, p: (l[0] / .04, l[1] / .04), local=loc)
    mk('sw_rim', V, F, FM, UV)
    # 內圈紅縫線（輪圈內側中線）
    pts = []
    for k in range(segs):
        x, y, t = cl[k]
        L = math.hypot(x, y)
        a = .0165 if math.cos(t) ** 2 > .67 else .0135
        pts.append(SWF(x - x / L * (a + .0006), y - y / L * (a + .0006), 0))
    tube('sw_stitch', pts, .0014, 'stitch_red', sides=4, closed=True)
    # 左右輻：圓角長條，從中央往外
    for sgn in (-1, 1):
        rings = []
        for r, hh, th in ((.05, .028, .013), (.08, .026, .013), (.12, .021, .012), (.15, .018, .011)):
            ring = []
            for q in range(8):
                p = 2 * math.pi * q / 8
                ring.append(SWF(sgn * r, -.012 + hh * math.sin(p), -.004 + th * math.cos(p)))
            rings.append(ring)
        V, F, FM, _ = loft(rings, lambda i, j: 'leather_blk', caps=('leather_blk', 'leather_blk'))
        mk('sw_spoke_%d' % (sgn > 0), V, F, FM, sub=1)
        # 按鍵面板（銀框＋2×2 按鍵貼圖）
        cx = sgn * .098
        rbox('sw_bezel_%d' % (sgn > 0), SWF(cx, -.008, .008), (.03, .025, .004), 'satin_alu', X=SX, Y=SY, Z=SZ, bevel=.003)
        px0 = 256 if sgn < 0 else 384
        V = [SWF(cx + a * .026, -.008 + b * .021, .0125) for b in (-1, 1) for a in (-1, 1)]
        UV = [((px0 + (a + 1) / 2 * 128) / 1024, 1 - (512 + (1 - b) / 2 * 128) / 1024) for b in (-1, 1) for a in (-1, 1)]
        # 從駕駛看，區域 +x 是右手邊（SX＝車身 -x），貼圖左邊對 a=-1
        mk('sw_keys_%d' % (sgn > 0), V, [(0, 1, 3, 2)], ['keys'], UV, smooth=False, recalc=False)
    # 下輻：銀色 V 形兩條
    for sgn in (-1, 1):
        rings = []
        for r, ang in ((.045, -90 + sgn * 16), (.10, -90 + sgn * 24), (.148, -90 + sgn * 30)):
            a = math.radians(ang)
            cx, cy = r * math.cos(a), max(r * math.sin(a), -.124)
            ring = []
            for q in range(6):
                p = 2 * math.pi * q / 6
                tx, ty = -math.sin(a), math.cos(a)
                ring.append(SWF(cx + tx * .007 * math.cos(p), cy + ty * .007 * math.cos(p), -.004 + .009 * math.sin(p)))
            rings.append(ring)
        V, F, FM, _ = loft(rings, lambda i, j: 'satin_alu', caps=('satin_alu', 'satin_alu'))
        mk('sw_low_%d' % (sgn > 0), V, F, FM, sub=1)
    # 中央氣囊：圓角方形（超橢圓），前緣收圓
    rings = []
    for c, s in ((-.03, .86), (-.012, 1.0), (.008, 1.0), (.016, .94), (.019, .82)):
        ring = []
        for q in range(32):
            p = 2 * math.pi * q / 32
            cs, sn = math.cos(p), math.sin(p)
            ring.append(SWF(.066 * s * math.copysign(abs(cs) ** .7, cs), .004 + .060 * s * math.copysign(abs(sn) ** .7, sn), c))
        rings.append(ring)
    V, F, FM, _ = loft(rings, lambda i, j: 'leather_blk', caps=('leather_blk', 'leather_blk'))
    mk('sw_hub', V, F, FM, sub=1)
    # 徽章圓片＋銀圈
    V, F, UV = [SWF(0, .004, .0205)], [], [(128 / 1024, 1 - 640 / 1024)]
    for q in range(32):
        p = 2 * math.pi * q / 32
        V.append(SWF(.03 * math.cos(p), .004 + .03 * math.sin(p), .0205))
        UV.append(((128 - 120 * math.cos(p)) / 1024, 1 - (640 - 120 * math.sin(p)) / 1024))
        F.append((0, 1 + q, 1 + (q + 1) % 32))
    mk('sw_badge', V, F, ['badge'] * 32, UV, smooth=False, recalc=False)
    torus('sw_badge_ring', SWF(0, .004, .0195), SZ, SY, .031, .0022, 'satin_alu', segs=40, rs=6)


def column():
    # 轉向柱護蓋（往儀表板方向變粗）與左右撥桿
    cyl('sw_column', SWF(0, -.012, -.035), -SZ, SY, .042, 0, .24, 'plastic_blk', segs=24, r1=.055)
    for sgn in (-1, 1):
        a = SWF(sgn * .045, -.005, -.10)
        b = a + SX * sgn * .12 + SY * -.012 + SZ * .02
        tube('sw_stalk_%d' % (sgn > 0), [a, (a + b) / 2, b], .0065, 'plastic_blk', sides=8)
        cyl('sw_stalk_tip_%d' % (sgn > 0), b, b - a, SY, .0072, 0, .018, 'satin_alu', segs=12)


# ═══════════════ 儀表（液晶儀表＋儀表罩） ═══════════════
def cluster():
    t = math.radians(12)
    X, Y, Z = Vector((-1, 0, 0)), Vector((0, math.cos(t), math.sin(t))), Vector((0, math.sin(t), -math.cos(t)))
    T = frame((.376, .735, .046), X, Y, Z)   # 儀表板前臉（z .08）前面，罩子往駕駛方向伸
    w, h = .30, .15
    V = [T(a * w / 2, b * h / 2, 0) for b in (-1, 1) for a in (-1, 1)]
    UV = [((a + 1) / 2 * 512 / 1024, 1 - (1 - b) / 2 * 256 / 1024) for b in (-1, 1) for a in (-1, 1)]
    mk('cluster_lcd', V, [(0, 1, 3, 2)], ['gauge'], UV, smooth=False, recalc=False)
    rbox('cluster_frame', T(0, 0, -.006), (w / 2 + .012, h / 2 + .012, .005), 'gloss_blk', X=X, Y=Y, Z=Z, bevel=.004)
    # 儀表罩：拱形殼沿著往駕駛方向放樣，外面皮革、裡面黑色塑膠，罩緣縫紅線
    rings = []
    for c, sc in ((-.04, 1.0), (.012, 1.0), (.045, .97), (.052, .93)):
        ring = []
        for q in range(17):
            p = math.pi * q / 16
            ring.append(T(-math.cos(p) * .19 * sc, -.025 + math.sin(p) * .145 * sc, c))
        for q in range(16, -1, -1):
            p = math.pi * q / 16
            ring.append(T(-math.cos(p) * .174 * sc, -.025 + math.sin(p) * .129 * sc, c))
        rings.append(ring)
    V, F, FM, _ = loft(rings, lambda i, j: 'dash_top' if j < 16 else ('leather_blk' if j == 16 or j == 33 else 'plastic_blk'), caps=('dash_top', 'leather_blk'))
    o = mk('cluster_hood', V, F, FM, sub=1)
    # 罩緣的紅縫線：沿外弧、離罩緣 1 cm
    tube('cluster_stitch', [T(-math.cos(p) * .1915, -.025 + math.sin(p) * .1465, .036) for p in (math.pi * q / 40 for q in range(1, 40))], .0013, 'stitch_red', sides=4)
    return o


# ═══════════════ 儀表板（上蓋＋前臉＋中控台面板、出風口、螢幕、旋鈕） ═══════════════
def dash():
    xs = [-.735, -.725, -.70, -.5, -.3, -.1, .1, .3, .5, .70, .725, .735]
    prof = [(.47, .80), (.47, .836), (.32, .857), (.16, .866), (.10, .862), (.072, .845), (.064, .825), (.075, .806), (.11, .80)]
    rings = []
    xmax = lambda z: .72 - max(0, z - .07) * .25   # 擋風玻璃下緣（z .47）兩側只到 |x| .62，後緣 .72
    for x in xs:
        s = 1 if abs(x) < .72 else .9
        cz, cy = .27, .83
        rings.append([(math.copysign(min(abs(x), xmax(cz + (z - cz) * s)), x), cy + (y - cy) * s, cz + (z - cz) * s) for z, y in prof])
    pad = mk('dash_top', *loft(rings, lambda i, j: ('dash_top2' if j < 2 else 'dash_top') if j < 4 else ('leather_blk' if j < 7 else 'plastic_blk'), caps=('dash_top2', 'dash_top2'))[:3], sub=2)
    # 前臉：上段皮革、膝蓋護板塑膠，兩側各一塊（中間是中控台面板）
    prof = [(.11, .80), (.08, .80), (.082, .72), (.095, .66), (.13, .60), (.21, .535), (.36, .475), (.52, .445), (.60, .445), (.60, .66), (.40, .80)]
    faces = []
    for side in (-1, 1):
        xs = [side * v for v in (.165, .18, .30, .45, .60, .70, .725)]
        if side < 0:
            xs = xs[::-1]
        rings = [[(math.copysign(min(abs(x), xmax(z) if y > .7 else 9), x), y, z) for z, y in prof] for x in xs]
        faces.append(mk('dash_face_%d' % (side > 0), *loft(rings, lambda i, j: 'leather_blk2' if j < 3 else 'plastic_blk', caps=('plastic_blk', 'plastic_blk'))[:3], sub=1))
    # 副駕前方碳纖飾條
    rbox('dash_carbon', (-.42, .742, .084), (.24, .022, .004), 'carbon', X=(1, 0, 0), Y=(0, .996, -.09), Z=(0, .09, .996), bevel=.002, uv_rep=.06)
    tube('dash_trim', [(-.66, .717, .085), (-.18, .717, .085)], .0028, 'satin_alu', sides=6)
    # 中控台面板（鋼琴黑）：從儀表板上緣斜到排檔座
    prof = [(.10, .80), (.075, .80), (.082, .70), (.10, .62), (.15, .53), (.24, .47), (.34, .44), (.34, .80)]
    xs = [-.168, -.16, -.12, .12, .16, .168]
    rings = [[(x, y, z) for z, y in prof] for x in xs]
    stack = mk('dash_stack', *loft(rings, lambda i, j: 'gloss_blk' if 0 < i < 4 and 0 < j < 5 else 'leather_blk', caps=('leather_blk', 'leather_blk'))[:3], sub=1)
    # 螢幕（8.4 吋，16:9）＋外框
    t = math.radians(8)
    X, Y, Z = Vector((-1, 0, 0)), Vector((0, math.cos(t), math.sin(t))), Vector((0, math.sin(t), -math.cos(t)))
    T = frame((0, .668, .068), X, Y, Z)
    w, h = .186, .105
    V = [T(a * w / 2, b * h / 2, 0) for b in (-1, 1) for a in (-1, 1)]
    UV = [((512 + (a + 1) / 2 * 512) / 1024, 1 - (1 - b) / 2 * 288 / 1024) for b in (-1, 1) for a in (-1, 1)]
    mk('screen', V, [(0, 1, 3, 2)], ['screen'], UV, smooth=False, recalc=False)
    rbox('screen_frame', T(0, 0, -.009), (w / 2 + .01, h / 2 + .01, .007), 'gloss_blk', X=X, Y=Y, Z=Z, bevel=.003)
    # 出風口：中間一對、兩端各一個（銀圈＋黑色筒＋水平葉片＋中間調整鈕）
    for (vx, vy, vz) in ((.072, .768, .066), (-.072, .768, .066), (.632, .762, .074), (-.632, .762, .074)):
        vent((vx, vy, vz))
    # 空調旋鈕（三個）與一排按鍵、紅色啟動鈕
    t = math.radians(30)
    X, Y, Z = Vector((-1, 0, 0)), Vector((0, math.cos(t), math.sin(t))), Vector((0, math.sin(t), -math.cos(t)))
    T = frame((0, .575, .118), X, Y, Z)
    for a in (-.072, 0, .072):
        cyl('hvac_knob_%d' % round(a * 100), T(a, 0, 0), Z, Y, .021, 0, .02, 'dark_alu', segs=28, mat_cap='plastic_blk', r1=.019)
        torus('hvac_ring_%d' % round(a * 100), T(a, 0, .0015), Z, Y, .0215, .0025, 'satin_alu', segs=32, rs=6)
        rbox('hvac_tick_%d' % round(a * 100), T(a, .012, .0205), (.0016, .0055, .0012), 'led_red', X=X, Y=Y, Z=Z, bevel=0)
    for k in range(5):
        rbox('btn_%d' % k, T(-.08 + k * .04, .042, .004), (.016, .007, .004), 'plastic_blk', X=X, Y=Y, Z=Z, bevel=.002)
        rbox('btn_led_%d' % k, T(-.08 + k * .04, .046, .0085), (.006, .0012, .0008), 'led_red' if k == 2 else 'stitch_dk', X=X, Y=Y, Z=Z, bevel=0)
    T2 = frame((0, .508, .19), X, Y, Z)
    cyl('start_btn', T2(0, 0, 0), Z, Y, .0165, 0, .012, 'start_red', segs=28)
    torus('start_ring', T2(0, 0, .002), Z, Y, .019, .0028, 'satin_alu', segs=32, rs=6)
    torus('start_led', T2(0, 0, .011), Z, Y, .0125, .0011, 'led_red', segs=28, rs=4)
    return pad, faces, stack


def vent(c):
    t = math.radians(12)
    Z = Vector((0, math.sin(t), -math.cos(t)))
    Y = Vector((0, math.cos(t), math.sin(t)))
    X = Y.cross(Z)
    T = frame(c, X, Y, Z)
    torus('vent_ring', T(0, 0, .004), Z, Y, .036, .0065, 'satin_alu', segs=40, rs=8, sq=1.3)
    cyl('vent_barrel', T(0, 0, -.03), Z, Y, .033, 0, .032, 'plastic_blk', segs=28, mat_cap='rubber')
    for k in range(-2, 3):
        hy = k * .012
        hw = math.sqrt(max(.031 ** 2 - hy ** 2, 0))
        rbox('vent_blade', T(0, hy, -.004), (hw, .0012, .007), 'gloss_blk', X=X, Y=(Y * .94 + Z * .34).normalized(), Z=(Z * .94 - Y * .34).normalized(), bevel=0)
    cyl('vent_knob', T(0, 0, -.002), Z, Y, .007, 0, .006, 'satin_alu', segs=16)


# ═══════════════ 中央通道（皮革側板縫紅線、排檔頭與護套、手煞車、窗戶開關） ═══════════════
def console():
    st = [(.36, .44, .9), (.30, .47, 1), (.10, .487, 1), (-.10, .49, 1), (-.30, .505, 1), (-.50, .53, 1), (-.68, .555, 1), (-.80, .56, 1), (-.86, .55, .9)]
    rings = []
    for z, yt, s in st:
        pts = [(-.205, .125), (-.185, .33), (-.15, yt - .03), (-.125, yt), (.125, yt), (.15, yt - .03), (.185, .33), (.205, .125)]
        rings.append([(x * s, y, z) for x, y in pts])

    def m(i, j):
        if j == 3:
            return 'leather_blk'
        if j in (1, 2, 4, 5):
            return 'leather_blk2'
        return 'plastic_blk'
    o = mk('console', *loft(rings, m, caps=('plastic_blk', 'plastic_blk'))[:3], sub=2)
    # 排檔：銀圈底座、皺摺皮套、排檔桿與球頭
    zs = -.02
    rbox('shift_plate', (0, .493, zs), (.07, .006, .075), 'gloss_blk', bevel=.008)
    torus('shift_ring', (0, .5, zs), (0, 1, 0), (0, 0, 1), .056, .0075, 'satin_alu', segs=40, rs=8)
    rings = []
    for k in range(7):
        f = k / 6
        y = .5 + f * .10
        r = .052 * (1 - f) + .016 * f
        rings.append([(r * (1 + .07 * math.sin(10 * p + k)) * math.cos(p), y, zs + r * (1 + .07 * math.sin(10 * p + k)) * math.sin(p)) for p in (2 * math.pi * q / 24 for q in range(24))])
    mk('shift_boot', *loft(rings, lambda i, j: 'leather_blk', caps=('', 'leather_blk'))[:3], sub=1)
    cyl('shift_rod', (0, .6, zs), (0, 1, 0), (0, 0, 1), .009, 0, .03, 'dark_alu', segs=12)
    # 球頭：下半皮革、上半鋁
    rings = []
    for k in range(1, 12):
        a = math.pi * k / 12
        rings.append([(.027 * math.sin(a) * math.cos(p), .655 - .027 * math.cos(a), zs + .027 * math.sin(a) * math.sin(p)) for p in (2 * math.pi * q / 24 for q in range(24))])
    mk('shift_knob', *loft(rings, lambda i, j: 'leather_blk' if i < 5 else 'satin_alu', caps=('leather_blk', 'satin_alu'))[:3], sub=1)
    # 手煞車：通道上的長拉桿（皮革包覆＋鋁按鈕）
    p0, p1 = Vector((0, .5, -.19)), Vector((0, .585, -.49))
    d = (p1 - p0).normalized()
    up = Vector((0, 1, 0))
    up = (up - d * up.dot(d)).normalized()
    sd = d.cross(up)
    rings = []
    for f, w, hh in ((0, .022, .02), (.08, .024, .022), (.6, .022, .02), (.95, .019, .018), (1, .015, .014)):
        c = p0 + (p1 - p0) * f
        rings.append([c + sd * w * math.cos(p) + up * hh * math.sin(p) for p in (2 * math.pi * q / 12 for q in range(12))])
    mk('ebrake', *loft(rings, lambda i, j: 'leather_blk', caps=('leather_blk', 'leather_blk'))[:3], sub=1)
    cyl('ebrake_btn', p1, d, up, .009, 0, .012, 'satin_alu', segs=16)
    rbox('ebrake_slot', (0, .5, -.25), (.03, .004, .09), 'gloss_blk', bevel=.004)
    # 窗戶開關
    for sgn in (-1, 1):
        rbox('win_sw_%d' % (sgn > 0), (sgn * .07, .495, -.36), (.03, .005, .045), 'gloss_blk', bevel=.004)
        for k in (-1, 1):
            rbox('win_btn_%d_%d' % (sgn > 0, k > 0), (sgn * .07 + k * .013, .502, -.36), (.009, .005, .02), 'plastic_blk', bevel=.003)
    return o


# ═══════════════ 門板（紅色皮革上段、黑色扶手與下段、銀色門把與開門撥桿、喇叭網） ═══════════════
def door_card(sgn):
    zs = [-.775, -.765, -.70, -.58, -.45, -.30, -.15, 0, .10, .18, .245, .255]
    rings = []
    for z in zs:
        arm = max(0, min(1, (z + .66) / .1, (.16 - z) / .1))   # 扶手 z -.66..0.16
        e = 1 if -.77 < z < .25 else .5
        pts = [(.80, .29), (.762, .305), (.752, .40), (.742, .44), (.742 - .045 * arm, .455), (.742 - .068 * arm, .487), (.742 - .042 * arm, .506), (.738, .522), (.742, .62), (.746, .70), (.762, .742), (.80, .752)]
        rings.append([(sgn * (.80 - (.80 - x) * e), y, z) for x, y in pts])

    def m(i, j):
        z = (zs[i] + zs[i + 1]) / 2
        if j in (7, 8) and -.62 < z < .12:
            return 'leather_red'
        if j in (3, 4, 5, 6):
            return 'leather_blk'
        if j in (9, 10):
            return 'leather_blk2'
        return 'plastic_blk'
    o = mk('door_card_%d' % (sgn > 0), *loft(rings, m, caps=('plastic_blk', 'plastic_blk'))[:3], sub=1)
    # 門把（扶手上方的銀色拉環）
    pts = [(sgn * .70, .515, -.05), (sgn * .676, .528, -.09), (sgn * .672, .53, -.17), (sgn * .69, .52, -.22)]
    tube('door_pull_%d' % (sgn > 0), pts, .0065, 'satin_alu', sides=8)
    # 開門撥桿（凹槽＋鋁桿）
    rbox('door_rel_rec_%d' % (sgn > 0), (sgn * .738, .63, .14), (.006, .022, .05), 'gloss_blk', bevel=.004)
    rbox('door_rel_%d' % (sgn > 0), (sgn * .728, .632, .135), (.006, .006, .04), 'satin_alu', bevel=.003)
    # 喇叭網
    cyl('door_spk_%d' % (sgn > 0), (sgn * .752, .372, .09), (-sgn, 0, 0), (0, 1, 0), .056, 0, .006, 'perf_blk', segs=32)
    torus('door_spk_ring_%d' % (sgn > 0), (sgn * .748, .372, .09), (-sgn, 0, 0), (0, 1, 0), .058, .0035, 'satin_alu', segs=40, rs=6)
    # 扶手上的窗戶開關
    rbox('door_sw_%d' % (sgn > 0), (sgn * .694, .505, .04), (.022, .005, .035), 'gloss_blk', X=(1, 0, 0), Y=(0, 1, 0), Z=(0, 0, 1), bevel=.004)
    return o


# ═══════════════ 地板、踏板、前圍、側踢板、門檻、A 柱下段 ═══════════════
def floor():
    for sgn in (-1, 1):
        rbox('carpet_%d' % (sgn > 0), (sgn * .44, .126, -.08), (.27, .006, .55), 'carpet', bevel=.004)
        # 腳踏墊（黑色包邊）
        rbox('floormat_%d' % (sgn > 0), (sgn * .42, .136, .2), (.19, .004, .22), 'mat', bevel=.003)
        tube('floormat_edge_%d' % (sgn > 0), [(sgn * (.42 + a * .19), .14, .2 + b * .22) for a, b in ((-1, -1), (1, -1), (1, 1), (-1, 1))], .0035, 'leather_blk', sides=6, closed=True)
        # 斜板（往前圍）
        rbox('toeboard_%d' % (sgn > 0), (sgn * .44, .20, .52), (.27, .006, .11), 'carpet', Y=(0, .76, -.65), Z=(0, .65, .76), bevel=.004)
        # 側踢板與門檻（門檻上緣低於門框 y .27，才不會被切進門裡）
        rbox('kick_%d' % (sgn > 0), (sgn * .73, .44, .45), (.012, .30, .15), 'plastic_blk', bevel=.006)
        rbox('sill_%d' % (sgn > 0), (sgn * .74, .20, -.25), (.06, .055, .58), 'plastic_blk', bevel=.008)
        rbox('sill_plate_%d' % (sgn > 0), (sgn * .74, .257, -.25), (.055, .004, .5), 'carbon', bevel=.002, uv_rep=.06)
        # A 柱下段飾板（窗線到 y .98，上面接原模型）
        p = [Vector((sgn * .645, .80, .465)), Vector((sgn * .755, .79, .40)), Vector((sgn * .62, .98, .12)), Vector((sgn * .72, .99, .07))]
        n = Vector((-sgn * .9, -.3, -.2)).normalized() * .014
        V = p + [q + n for q in p]
        F = [(0, 1, 3, 2), (4, 6, 7, 5), (0, 2, 6, 4), (1, 5, 7, 3), (0, 4, 5, 1), (2, 3, 7, 6)]
        mk('apillar_%d' % (sgn > 0), V, F, ['leather_blk'] * 6, sub=1)
    rbox('firewall', (0, .33, .615), (.72, .2, .012), 'carpet', bevel=.004)
    # 踏板（左駕：離合、煞車、油門），鋁踏面＋黑色止滑條
    t = math.radians(38)
    Y, Z = Vector((0, math.cos(t), -math.sin(t))), Vector((0, math.sin(t), math.cos(t)))
    for x, w, h in ((.47, .03, .04), (.37, .036, .036), (.27, .022, .055)):
        c = Vector((x, .25, .50))
        rbox('pedal_%d' % round(x * 100), c, (w, h, .005), 'satin_alu', X=(1, 0, 0), Y=Y, Z=Z, bevel=.003)
        for k in (-1, 0, 1):
            rbox('pedal_grip_%d_%d' % (round(x * 100), k), c + Y * k * h * .55 - Z * .006, (w * .85, .0025, .0015), 'rubber', X=(1, 0, 0), Y=Y, Z=Z, bevel=0)
        tube('pedal_arm_%d' % round(x * 100), [c + Z * .008, c + Vector((0, .1, .04)), c + Vector((0, .2, .05))], .006, 'dark_alu', sides=6)
    rbox('dead_pedal', (.585, .19, .44), (.04, .06, .005), 'satin_alu', Y=Y, Z=Z, bevel=.003)


# ═══════════════ 建模、烘焙修改器、沿材質交界加縫線、匯出 ═══════════════
seat(.376, 'L')
seat(-.376, 'R')
steering()
column()
cluster()
dash()
console()
door_card(1)
door_card(-1)
floor()
# 門框前端的擋板：原模型沒做葉子板內側，開門會看到破碎的面；擋板在門框多邊形前緣（z ≤ .385）之前，不跟著門走，門關著時藏在葉子板裡
for sgn in (1, -1):
    rbox('jamb_%d' % (sgn > 0), (sgn * .71, .41, .40), (.13, .21, .004), 'rubber', bevel=.002)

dg = bpy.context.evaluated_depsgraph_get()
for o in OBJS:
    if not o.modifiers:
        continue
    me = bpy.data.meshes.new_from_object(o.evaluated_get(dg))
    o.modifiers.clear()
    o.data = me


def seams(o, pairs, smat, rows=(-.0035, .0035), off=.0011, r=.0012, step=.012):
    """o 網格上 pairs 兩種材質的交界邊串成折線，沿表面法線抬一點、左右各一排細管當縫線"""
    names = [m.name[4:] for m in o.data.materials]
    bm = bmesh.new()
    bm.from_mesh(o.data)
    bm.normal_update()
    E = [e for e in bm.edges if len(e.link_faces) == 2 and (names[e.link_faces[0].material_index], names[e.link_faces[1].material_index]) in pairs]
    adj = defaultdict(list)
    for e in E:
        for v in e.verts:
            adj[v.index].append(e)
    used = set()
    out = 0
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
        # 重新取樣成約 step 一段
        S = [P[0]]
        acc = 0
        for i in range(1, len(P)):
            acc += (P[i][0] - P[i - 1][0]).length
            if acc >= step or i == len(P) - 1:
                S.append(P[i])
                acc = 0
        if len(S) < 2:
            continue
        for dr in rows:
            pts = []
            for i, (c, n) in enumerate(S):
                t = (S[min(i + 1, len(S) - 1)][0] - S[max(i - 1, 0)][0])
                sd = t.cross(n).normalized() if t.length > 1e-6 else Vector((0, 0, 0))
                pts.append(c + n * off + sd * dr)
            tube('%s_st' % o.name, pts, r, smat, sides=3)
            out += 1
    bm.free()
    return out


def both(a, b):
    return {(a, b), (b, a)}


for o in list(OBJS):
    n = o.name
    if n.startswith('seat_'):
        seams(o, both('perf_red', 'leather_red'), 'stitch_dk')
    elif n.startswith('dash_top'):
        seams(o, both('dash_top', 'leather_blk'), 'stitch_red', rows=(0,))
        seams(o, both('dash_top', 'dash_top2'), 'stitch_red')
    elif n.startswith('dash_face'):
        seams(o, both('leather_blk2', 'plastic_blk'), 'stitch_red', rows=(0,))
    elif n == 'console':
        seams(o, both('leather_blk', 'leather_blk2'), 'stitch_red')
    elif n.startswith('door_card'):
        seams(o, both('leather_red', 'leather_blk') | both('leather_red', 'leather_blk2'), 'stitch_dk')
    elif n == 'ebrake':
        pass

path = os.path.join(OUT, NAME + '.glb')
bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=False, export_animations=False, export_yup=True, export_apply=True,
                          export_cameras=False, export_lights=False, export_extras=False, export_texcoords=True, export_normals=True, export_materials='EXPORT')
json.dump({'pal': PAL}, open(os.path.join(OUT, NAME + '.json'), 'w'), indent=1)
tris = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in bpy.data.objects if o.type == 'MESH')
print('ok', path, '%d KB' % (os.path.getsize(path) / 1024), 'tris', tris)
