# 卡車：Super Off-Road 風格短斗小貨卡（車身）＋ 粗胎紋輪胎。
# Blender 座標：X 前、Y 左、Z 上；原點在底盤中心、車軸高度（地面在 z = -0.42）。
# 固定幾何（SPEC §4）：前軸 x=+0.85、後軸 x=-0.85、輪距半寬 ±0.78、輪半徑 0.42。
import math

import bmesh
from mathutils import Vector

from meshkit import Builder, material, join, link, A_PAINT, A_GLOW

AXLE_X = 0.85
TRACK_HALF = 0.78
WHEEL_R = 0.42


def mats():
    return dict(
        paint=material('paint', '#e8e8e8', A_PAINT, 0.45),
        paint_dk=material('paint_dk', '#a6a6a6', A_PAINT, 0.6),
        black=material('black', '#1f1d1c', rough=0.7),
        frame=material('frame', '#3a3634', rough=0.6),
        chrome=material('chrome', '#cfccc4', rough=0.25, metal=0.9),
        glass=material('glass', '#6c808c', A_GLOW, 0.1),
        head=material('headlight', '#fff1c6', A_GLOW, 0.2),
        tail=material('taillight', '#d8321e', A_GLOW, 0.3),
        lamp=material('lamp', '#fff6da', A_GLOW, 0.2),
        bone=material('bone', '#efe6d2', rough=0.6),
        tire=material('tire', '#262322', rough=0.9),
        tread=material('tread', '#2e2b29', rough=0.95),
        wall=material('sidewall', '#3b3734', rough=0.9),
        rim=material('rim', '#cfccc4', rough=0.3, metal=0.9),
        hub=material('hub', '#8c8882', rough=0.4, metal=0.6),
    )


def _flare(b, xc, m):
    # 輪拱擋泥板：輪子上方的弧形寬板（左側）
    n = 6
    R0, R1 = 0.53, 0.6
    y0, y1 = 0.56, 1.0
    top, side = [], []
    for k in range(n + 1):
        a = math.radians(18 + 144 * k / n)
        top.append((xc + R1 * math.cos(a), R1 * math.sin(a)))
        side.append((xc + R0 * math.cos(a), R0 * math.sin(a)))
    for k in range(n):
        (xa, za), (xb, zb) = top[k], top[k + 1]
        b.poly([(xa, y1, za), (xb, y1, zb), (xb, y0, zb), (xa, y0, za)], m['black'])
        (sa, ta), (sb, tb) = side[k], side[k + 1]
        b.poly([(sa, y1, ta), (sb, y1, tb), (xb, y1, zb), (xa, y1, za)], m['black'])
        b.poly([(sa, y1 - 0.12, ta), (sb, y1 - 0.12, tb), (sb, y1, tb), (sa, y1, ta)], m['black'])


def build_body():
    m = mats()
    # 外殼（烤漆＋玻璃）：之後加倒角與鏡射修改器
    sh = Builder('truck_shell')
    # 下半車身（深色塗裝）
    sh.box(-1.22, 1.22, 0, 0.56, 0.12, 0.48, m['paint_dk'], skip=('-y',))

    # 引擎蓋：前端往下斜
    def hood(v):
        if v.x > 1.0 and v.z > 0.6:
            v.z -= 0.1
        if v.x < 0.5 and v.z > 0.6:
            v.z += 0.02
        return v
    sh.box(0.45, 1.26, 0, 0.86, 0.46, 0.78, m['paint'], skip=('-y', '-z'), mats={'+x': m['black']}, shape=hood)
    # 駕駛室下半
    sh.box(-0.3, 0.46, 0, 0.86, 0.46, 0.88, m['paint'], skip=('-y', '-z'))

    # 車窗區：上緣內縮，前擋風斜
    def glasshouse(v):
        if v.z > 1.0:
            v.x = 0.1 if v.x > 0 else -0.25
            if v.y > 0.1:
                v.y = 0.66
        return v
    sh.box(-0.3, 0.44, 0, 0.76, 0.88, 1.26, m['glass'], skip=('-y', '-z'), mats={'+z': m['paint']}, shape=glasshouse)
    # 車斗
    sh.box(-1.26, -0.3, 0, 0.86, 0.46, 0.55, m['paint_dk'], skip=('-y', '-z'))
    sh.box(-1.26, -0.3, 0.74, 0.86, 0.55, 0.86, m['paint'], skip=('-z',))
    sh.box(-1.26, -1.16, 0, 0.74, 0.55, 0.82, m['paint'], skip=('-y', '-z'))
    shell = link(sh.finish())
    mir = shell.modifiers.new('mirror', 'MIRROR')
    mir.use_axis = (False, True, False)
    mir.use_mirror_merge = True
    mir.merge_threshold = 0.002
    bev = shell.modifiers.new('bevel', 'BEVEL')
    bev.width = 0.025
    bev.segments = 1
    bev.limit_method = 'ANGLE'
    bev.angle_limit = math.radians(50)
    bev.use_clamp_overlap = True

    # 細節（不倒角）
    d = Builder('truck_detail')
    d.box(-1.1, 1.1, 0, 0.45, -0.08, 0.14, m['black'], skip=('-y',))                 # 底盤
    d.box(1.26, 1.44, 0, 0.58, 0.06, 0.3, m['chrome'], skip=('-y',))                 # 前保險桿
    d.box(1.30, 1.36, 0, 0.5, 0.3, 0.52, m['chrome'], skip=('-y', '-z'))             # 防撞桿
    d.box(-1.44, -1.26, 0, 0.58, 0.12, 0.3, m['chrome'], skip=('-y',))               # 後保險桿
    d.box(1.245, 1.29, 0.52, 0.74, 0.55, 0.67, m['head'], skip=('-x',))               # 大燈
    d.box(-1.3, -1.25, 0.6, 0.8, 0.6, 0.76, m['tail'], skip=('+x',))                  # 尾燈
    d.box(-0.32, 0.32, 0.84, 0.98, 0.12, 0.22, m['black'])                           # 側踏桿
    d.box(-0.22, 0.34, 0.861, 0.874, 0.52, 0.82, m['bone'], skip=('-y',))            # 車門號碼牌
    d.box(0.02, 0.1, 0.874, 0.882, 0.57, 0.77, m['black'], skip=('-y',))             # 號碼（一劃）
    d.box(-0.2, 0.06, 0, 0.42, 1.26, 1.285, m['bone'], skip=('-y', '-z'))            # 車頂號碼牌
    d.box(0.34, 0.42, 0.86, 0.98, 0.9, 0.98, m['black'])                             # 後照鏡
    _flare(d, AXLE_X, m)
    _flare(d, -AXLE_X, m)
    # 防滾架＋燈架
    d.beam((-0.36, 0.62, 0.86), (-0.36, 0.6, 1.44), 0.07, m['chrome'])
    d.beam((-0.36, 0.0, 1.44), (-0.36, 0.64, 1.44), 0.07, m['chrome'])
    d.beam((-0.36, 0.6, 1.4), (-1.16, 0.66, 0.86), 0.06, m['chrome'])
    d.box(-0.44, -0.3, 0, 0.66, 1.48, 1.58, m['black'], skip=('-y',))
    for (y0, y1) in ((0.06, 0.26), (0.36, 0.56)):
        d.box(-0.3, -0.265, y0, y1, 1.5, 1.565, m['lamp'], skip=('-x',))
    # 排氣管
    d.beam((-0.34, 0.72, 0.5), (-0.34, 0.72, 1.12), 0.07, m['chrome'])
    det = link(d.finish())
    mir2 = det.modifiers.new('mirror', 'MIRROR')
    mir2.use_axis = (False, True, False)
    mir2.use_mirror_merge = True
    mir2.merge_threshold = 0.002
    body = join([shell, det], 'truck_body')
    return body


def build_wheel():
    m = mats()
    b = Builder('wheel')
    seg = 12
    # 輪胎剖面 (r, y)：內側胎壁 → 胎面 → 外側胎壁；沿 Blender Y（= 遊戲 Z）旋轉
    prof = [(0.25, -0.16), (0.30, -0.18), (0.37, -0.18), (0.395, -0.15), (0.395, 0.0),
            (0.395, 0.15), (0.37, 0.18), (0.30, 0.18), (0.25, 0.16)]
    band_mat = [m['wall'], m['tire'], m['tire'], m['tread'], m['tread'], m['tire'], m['tire'], m['wall']]
    rings = b.revolve(prof, seg, lambda i: band_mat[i], axis='Y')
    # 胎紋塊：兩圈交錯
    bm = b.bm
    bm.faces.ensure_lookup_table()
    tread = [f for f in bm.faces if f.material_index == b.mi(m['tread'])]
    pick = []
    for f in tread:
        c = f.calc_center_median()
        ang = math.atan2(c.z, c.x) % (2 * math.pi)
        k = int(round(ang / (2 * math.pi / seg) - 0.5)) % seg
        if (k % 2 == 0) == (c.y < 0):
            pick.append(f)
    res = bmesh.ops.extrude_discrete_faces(bm, faces=pick)
    for f in res['faces']:
        c = f.calc_center_median()
        n = Vector((c.x, 0, c.z)).normalized()
        for v in f.verts:
            v.co += n * 0.03
    # 輪框：兩側各一圈凹盤＋輪轂蓋
    for sgn in (-1, 1):
        rim = b.revolve([(0.25, 0.16 * sgn), (0.1, 0.09 * sgn)], seg, lambda i: m['rim'], axis='Y')
        ring = rim[-1] if sgn > 0 else list(reversed(rim[-1]))
        b.face(ring, m['hub'])
    ob = b.finish(recalc=True)
    # 最外半徑正好 0.42
    me = ob.data
    rmax = max(math.hypot(v.co.x, v.co.z) for v in me.vertices)
    for v in me.vertices:
        v.co.x *= WHEEL_R / rmax
        v.co.z *= WHEEL_R / rmax
    return ob
