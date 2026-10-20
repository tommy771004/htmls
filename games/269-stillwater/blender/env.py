# 靜水釣遊（269）：河谷環境物件 → blender/out/env.glb
# 根節點（SPEC）：cabin（子節點 noticeboard）、dock（子節點 bollard）、buoy（子節點 buoy_flag）、bridge、
#   rock_L / rock_M / rock_S、boulder、cliff、pine_tall / pine_short / pine_dense、log_sunken、log_drift、reeds、lily、stump
# 座標：Blender Z 朝上；three 的 +Z（門、崖壁正面朝向）＝ Blender −Y；dock 往 three −Z ＝ Blender +Y 延伸。
# 執行：/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P blender/env.py
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *
from meshkit import MB, jitter_obj
import random

reset()


def M(name, color, rough=0.9, two_sided=False, emit=None):
    m = mat(name, color, rough, emit=emit)
    m.use_backface_culling = not two_sided
    return m


# ---------- 調色盤（SPEC） ----------
varnish, varnish_d = M('varnish', '#c08a55'), M('varnish_dark', '#94643c')
dock_w, dock_old = M('dockwood', '#8c6a4a'), M('dockwood_old', '#6e5541')
log_m, log_end = M('log', '#8a5a3b'), M('log_end', '#c7a173')
log_d = M('log_dark', '#6f4a33')
shingle, shingle_d = M('shingle', '#4b5a48'), M('shingle_dark', '#3d4a3b')
stone, stone_d = M('stone', '#8f8b80'), M('stone_dark', '#6f6c64')
stone_top = M('stone_top', '#a19c8c')
moss = M('moss', '#5f7a52')
granite, granite_d = M('granite', '#a39f95'), M('granite_dark', '#7c786f')
cobble = M('cobble', '#9a9283')
pine1, pine2, pine3 = M('pine_1', '#2f5a3f'), M('pine_2', '#3d6b48'), M('pine_3', '#4f7d4f')
trunk = M('pine_trunk', '#6b4a36')
reed_m, reed_head = M('reed', '#a9a35a', two_sided=True), M('reed_head', '#8a6a3e')
reed_d = M('reed_dark', '#8c8a48', two_sided=True)
lily_m, lily_rim = M('lily', '#5f8a4a'), M('lily_rim', '#6f9a56')
petal, petal_c = M('lily_flower', '#f0d6d0', two_sided=True), M('lily_center', '#e8c45a')
brass = M('brass', '#b08a4a', rough=0.5)
lamp = M('lamp_glow', '#ffc46b', rough=0.4, emit='#ffc46b')
win = M('win_glow', '#ffc46b', rough=0.4, emit='#ffc46b')
win_frame = M('win_frame', '#e8dcc4')
paper1, paper2, paper3 = M('paper', '#efe6cf'), M('paper_aged', '#e2cf9f'), M('paper_blue', '#cfdde0')
pin_red = M('pin_red', '#a5473a')
flag_m = M('flag', '#c9573b', two_sided=True)
flower_r = M('flower_red', '#b8483a')
leaf = M('leaf', '#5f8a4a')
rope = M('rope', '#c9b48a')
iron = M('iron', '#3a3833', rough=0.6)


def finish(mb, name, jit=0.0, seed=1, keep_floor=True):
    o = mb.build(name)
    if jit:
        jitter_obj(o, jit, seed, keep_z_below=0.02 if keep_floor else None)
    return o


def child(o, parent):
    o.parent = parent
    o.matrix_parent_inverse = Matrix.Identity(4)
    return o


def face_normal(mb, fi):
    pts = [mb.v[i] for i in mb.f[fi]]
    n = Vector((0, 0, 0))
    for i in range(len(pts)):
        a, b = pts[i], pts[(i + 1) % len(pts)]
        n += Vector(((a.y - b.y) * (a.z + b.z), (a.z - b.z) * (a.x + b.x), (a.x - b.x) * (a.y + b.y)))
    return n.normalized() if n.length > 1e-9 else n


def recolor(mb, start, fn):
    """start 之後的面依法線改材質：fn(normal, face_index) → 材質或 None（不改）。"""
    for fi in range(start, len(mb.f)):
        m = fn(face_normal(mb, fi), fi)
        if m is not None:
            mb.fm[fi] = mb.mi(m)


# ================= 木屋 cabin =================
def cabin():
    rnd = random.Random(7)
    mb = MB()
    W, D = 7.0, 6.0
    hx, hy = W / 2, D / 2
    base = 0.32
    lr, step, rows = 0.15, 0.29, 9
    # 石基
    for side in range(4):
        n = 9 if side < 2 else 8
        for k in range(n):
            t = (k + 0.5) / n
            if side < 2:
                c = (-hx + t * W, -hy if side == 0 else hy, base / 2)
                s = (W / n * 0.96, 0.42, base)
            else:
                c = (-hx if side == 2 else hx, -hy + t * D, base / 2)
                s = (0.42, D / n * 0.96, base)
            mb.box(c, (s[0] * rnd.uniform(0.9, 1.0), s[1], s[2] * rnd.uniform(0.85, 1.0)), stone if rnd.random() < 0.6 else stone_d)
    # 原木牆：前後牆與側牆半根錯開（鞍形榫），兩端伸出牆角，端面淺色
    ov = 0.32
    for k in range(rows):
        z = base + lr + k * step
        for y in (-hy, hy):
            mb.tube((-hx - ov, y, z), (hx + ov, y, z), lr, lr * 0.97, 7, log_m if k % 2 else log_d if k == 4 else log_m, m_cap=log_end, phase=rnd.random())
        zs = z + step / 2
        if zs + lr < base + rows * step + 0.05:
            for x in (-hx, hx):
                mb.tube((x, -hy - ov, zs), (x, hy + ov, zs), lr, lr * 0.97, 7, log_m, m_cap=log_end, phase=rnd.random())
    zt = base + rows * step   # 牆頂 ≈ 2.93
    ridge = 5.0
    # 山牆：直向木板＋壓條
    for y, sgn in ((-hy - 0.02, 1), (hy + 0.02, -1)):
        pts = [Vector((-hx - 0.1, y, zt)), Vector((hx + 0.1, y, zt)), Vector((0, y, ridge))]
        if sgn < 0:
            pts = [pts[1], pts[0], pts[2]]
        mb.ngon_fan(pts, varnish_d)
        mb.ngon_fan(pts, varnish_d, flip=True)
        for bx in (-2.4, -1.2, 0, 1.2, 2.4):
            top = ridge - abs(bx) * (ridge - zt) / (hx + 0.1) - 0.08
            if top > zt + 0.15:
                mb.box((bx, y - 0.04 * sgn, (zt + top) / 2), (0.1, 0.06, top - zt), dock_old)
        # 山牆小窗（閣樓）
        mb.box((0, y - 0.05 * sgn, zt + 0.95), (0.62, 0.08, 0.62), win_frame)
        mb.box((0, y - 0.09 * sgn, zt + 0.95), (0.46, 0.04, 0.46), win)
    # 屋頂：兩坡、每坡 6 排木瓦，每排分 7 片、略為翹起，深淺交錯
    slope = (ridge - zt) / hx
    eave_x = hx + 0.6
    nrow, nseg = 6, 7
    Ly = D + 1.1
    for sx in (-1, 1):
        for r in range(nrow):
            x0 = eave_x * (1 - r / nrow)
            x1 = eave_x * (1 - (r + 1) / nrow) - 0.12
            xc = (x0 + x1) / 2
            zc = ridge - slope * xc + 0.07 + 0.02 * r
            run = (x0 - x1)
            L = math.hypot(run, run * slope)
            ang = math.degrees(math.atan(slope))
            for s in range(nseg):
                y = -Ly / 2 + (s + 0.5) * Ly / nseg
                tilt = ang + rnd.uniform(1.0, 3.5)
                m = shingle if (r + s) % 3 else shingle_d
                mb.box((sx * xc, y + rnd.uniform(-0.03, 0.03), zc), (L, Ly / nseg * 0.97, 0.07), m, ry=sx * tilt)
    mb.box((0, 0, ridge + 0.1), (0.36, Ly + 0.1, 0.16), shingle_d, )
    # 窗：前牆兩扇、兩側各一扇（框＋發光玻璃＋十字窗櫺）＋前窗花箱
    def window(cx, cy, cz, normal_axis, sgn):
        if normal_axis == 'y':
            mb.box((cx, cy, cz), (1.05, 0.12, 1.0), win_frame)
            mb.box((cx, cy - 0.04 * sgn, cz), (0.85, 0.06, 0.8), win)
            mb.box((cx, cy - 0.08 * sgn, cz), (0.06, 0.04, 0.8), win_frame)
            mb.box((cx, cy - 0.08 * sgn, cz), (0.85, 0.04, 0.06), win_frame)
        else:
            mb.box((cx, cy, cz), (0.12, 1.05, 1.0), win_frame)
            mb.box((cx + 0.04 * sgn, cy, cz), (0.06, 0.85, 0.8), win)
            mb.box((cx + 0.08 * sgn, cy, cz), (0.04, 0.06, 0.8), win_frame)
            mb.box((cx + 0.08 * sgn, cy, cz), (0.04, 0.85, 0.06), win_frame)
    fy = -hy - lr - 0.02
    for wx in (-2.1, 2.1):
        window(wx, fy, 1.65, 'y', 1)
        mb.box((wx, fy - 0.2, 1.05), (1.0, 0.3, 0.22), dock_old)
        for k in range(5):
            mb.box((wx - 0.4 + k * 0.2, fy - 0.2, 1.22), (0.14, 0.14, 0.12), flower_r if k % 2 else leaf, rz=rnd.uniform(0, 40))
    window(hx + lr + 0.02, 0.6, 1.65, 'x', -1)
    window(-hx - lr - 0.02, -0.4, 1.65, 'x', 1)
    window(0.8, hy + lr + 0.02, 1.65, 'y', -1)
    # 門：直板門＋橫檔＋門把
    mb.box((0, fy - 0.03, base + 1.02), (1.1, 0.1, 2.05), win_frame)
    for k in range(5):
        mb.box((-0.38 + k * 0.19, fy - 0.08, base + 1.0), (0.18, 0.06, 1.92), varnish if k % 2 else varnish_d)
    for zz in (0.55, 1.45):
        mb.box((0, fy - 0.12, base + zz), (0.92, 0.04, 0.12), varnish_d)
    mb.box((0.32, fy - 0.16, base + 1.0), (0.06, 0.06, 0.06), brass)
    # 門廊：平台＋階梯＋柱子＋單坡雨遮＋欄杆
    py0, py1, ph = -hy - 0.2, -hy - 1.9, 0.38
    for k in range(9):
        y = py0 + (py1 - py0) * (k + 0.5) / 9
        mb.box((0, y, ph - 0.04), (W + 0.4, abs(py1 - py0) / 9 * 0.94, 0.08), dock_w if k % 2 else dock_old)
    mb.box((0, (py0 + py1) / 2, ph / 2 - 0.05), (W + 0.3, abs(py1 - py0), ph - 0.1), stone_d)
    for k, (dz, dy) in enumerate(((0.25, -0.35), (0.12, -0.7))):
        mb.box((0, py1 + dy + 0.17, dz / 2 + 0.01), (1.5, 0.36, dz), dock_w)
    z_eave_porch = 2.25
    for px in (-hx + 0.1, -0.95, 0.95, hx - 0.1):
        mb.box((px, py1 + 0.15, (ph + z_eave_porch) / 2), (0.16, 0.16, z_eave_porch - ph), varnish_d)
    for px0, px1 in ((-hx + 0.1, -0.95), (0.95, hx - 0.1)):
        mb.box(((px0 + px1) / 2, py1 + 0.15, ph + 0.75), (abs(px1 - px0), 0.08, 0.08), varnish_d)
        mb.box(((px0 + px1) / 2, py1 + 0.15, ph + 0.4), (abs(px1 - px0), 0.06, 0.06), varnish_d)
    pr_slope = math.degrees(math.atan((2.75 - z_eave_porch) / abs(py1 - py0 + 0.3)))
    for s in range(6):
        x = -hx - 0.2 + (s + 0.5) * (W + 0.4) / 6
        mb.box((x, (py0 + py1) / 2 - 0.15, (2.75 + z_eave_porch) / 2 + 0.06), ((W + 0.4) / 6 * 0.97, abs(py1 - py0) + 0.6, 0.07), shingle if s % 2 else shingle_d, rx=pr_slope)
    # 門廊燈（黃昏點亮）
    mb.box((1.0, fy - 0.12, 2.25), (0.06, 0.2, 0.06), iron)
    mb.box((1.0, fy - 0.3, 2.05), (0.2, 0.2, 0.28), brass)
    mb.box((1.0, fy - 0.3, 2.05), (0.15, 0.22, 0.2), lamp)
    # 石煙囪（側牆 +x）：石塊逐層收窄，凸出屋頂
    cx0 = hx + 0.55
    z = 0
    k = 0
    while z < ridge + 1.2:
        h = rnd.uniform(0.3, 0.42)
        w = 1.0 if z < 2.4 else 0.78
        mb.box((cx0 + rnd.uniform(-0.03, 0.03), 0.6, z + h / 2), (w + rnd.uniform(-0.05, 0.05), w + rnd.uniform(-0.05, 0.05), h), stone if k % 2 else stone_d)
        z += h
        k += 1
    mb.box((cx0, 0.6, z + 0.05), (0.9, 0.9, 0.1), stone_d)
    # 柴堆（側牆 −x）與水桶
    for r in range(3):
        for c in range(4 - r):
            x = -hx - 0.6
            yy, zz = -1.6 + c * 0.24 + r * 0.12, 0.12 + r * 0.21
            mb.tube((x - 0.25, yy, zz), (x + 0.25, yy, zz), 0.11, 0.11, 6, log_m, m_cap=log_end, phase=rnd.random())
    mb.tube((-hx - 0.7, -2.6, 0), (-hx - 0.7, -2.6, 0.5), 0.26, 0.24, 8, varnish_d, m_cap=varnish)
    mb.tube((-hx - 0.7, -2.6, 0.18), (-hx - 0.7, -2.6, 0.22), 0.265, 0.265, 8, iron, cap0=False, cap1=False)
    o = finish(mb, 'cabin', jit=0.012, seed=3)

    # ---- 佈告欄 noticeboard（子節點，原點在底部中心，面向 −Y）----
    nb = MB()
    for px in (-0.72, 0.72):
        nb.box((px, 0, 1.0), (0.12, 0.12, 2.0), varnish_d)
    nb.box((0, 0, 1.3), (1.56, 0.08, 1.05), dock_old)
    nb.box((0, -0.05, 1.3), (1.4, 0.04, 0.9), dock_w)
    for (x, z, w, h, pm, rz) in ((-0.42, 1.48, 0.42, 0.5, paper1, -3), (0.12, 1.5, 0.36, 0.28, paper2, 4),
                                 (0.45, 1.2, 0.34, 0.46, paper3, -2), (-0.05, 1.08, 0.4, 0.3, paper1, 2), (-0.48, 1.0, 0.3, 0.24, paper2, 6)):
        nb.box((x, -0.085, z), (w, 0.01, h), pm, ry=rz)
        nb.box((x, -0.095, z + h / 2 - 0.04), (0.035, 0.02, 0.035), pin_red)
    nb.box((0, 0, 1.9), (1.8, 0.5, 0.06), shingle_d, rx=0)
    nb.box((0, -0.12, 1.95), (1.8, 0.28, 0.06), shingle, rx=22)
    nb.box((0, 0.12, 1.95), (1.8, 0.28, 0.06), shingle, rx=-22)
    # 小提燈掛在左柱
    nb.box((-0.86, -0.1, 1.7), (0.16, 0.06, 0.04), iron)
    nb.box((-0.92, -0.16, 1.55), (0.14, 0.14, 0.2), brass)
    nb.box((-0.92, -0.16, 1.55), (0.1, 0.16, 0.14), lamp)
    n = finish(nb, 'noticeboard', jit=0.006, seed=4)
    child(n, o)
    n.location = (2.6, py1 - 1.15, 0)
    return o


# ================= 碼頭 dock =================
def dock():
    rnd = random.Random(11)
    mb = MB()
    top = 0.55
    Lw, W = 11.4, 2.4
    # 走道橫板
    y = 0.0
    while y < Lw:
        w = rnd.uniform(0.22, 0.27)
        mb.box((rnd.uniform(-0.03, 0.03), y + w / 2, top - 0.04), (W + rnd.uniform(-0.06, 0.04), w - 0.025, 0.08), dock_w if rnd.random() < 0.6 else dock_old, rz=rnd.uniform(-1.2, 1.2))
        y += w
    # T 形平台
    Tw, T0, T1 = 5.2, Lw, 14.0
    yy = T0
    while yy < T1:
        w = rnd.uniform(0.22, 0.27)
        mb.box((0, yy + w / 2, top - 0.04), (Tw, w - 0.025, 0.08), dock_w if rnd.random() < 0.6 else dock_old, rz=rnd.uniform(-0.8, 0.8))
        yy += w
    # 縱樑
    for x in (-0.95, 0.95):
        mb.box((x, Lw / 2, top - 0.17), (0.14, Lw, 0.18), dock_old)
    for x in (-2.3, -0.95, 0.95, 2.3):
        mb.box((x, (T0 + T1) / 2, top - 0.17), (0.14, T1 - T0, 0.18), dock_old)
    # 木樁（水下深色）
    piles = [(sx * 1.25, y) for y in (0.4, 3.2, 6.0, 8.8, 11.5) for sx in (-1, 1)]
    piles += [(x, y) for x in (-2.55, 2.55) for y in (11.6, 13.9)] + [(0, 13.95)]
    for (x, py) in piles:
        h_top = top + rnd.uniform(0.2, 0.38)
        mb.tube((x, py, -2.2), (x, py, -0.05), 0.15, 0.15, 7, dock_old, cap0=False, cap1=False, phase=rnd.random())
        mb.tube((x, py, -0.05), (x, py, h_top), 0.15, 0.145, 7, dock_w, cap0=False, m_cap=log_end, phase=rnd.random())
        mb.tube((x, py, 0.1), (x, py, 0.2), 0.158, 0.158, 7, rope, cap0=False, cap1=False)
    # 梯子（T 平台右側往水裡）
    for x in (2.15, 2.6):
        mb.box((x, T1 + 0.08, -0.25), (0.07, 0.07, 1.6), varnish_d)
    for k in range(4):
        mb.box((2.375, T1 + 0.08, top - 0.2 - k * 0.35), (0.5, 0.06, 0.05), varnish_d)
    # 燈柱（T 平台左端）
    lx, ly = -2.4, T1 - 0.4
    mb.box((lx, ly, top + 1.0), (0.14, 0.14, 2.0), varnish_d)
    mb.box((lx + 0.25, ly, top + 1.95), (0.55, 0.08, 0.08), varnish_d)
    mb.box((lx + 0.45, ly, top + 1.72), (0.2, 0.2, 0.3), brass)
    mb.box((lx + 0.45, ly, top + 1.72), (0.15, 0.22, 0.22), lamp)
    # 盤繩、魚簍木箱
    mb.tube((1.6, T1 - 0.6, top), (1.6, T1 - 0.6, top + 0.1), 0.25, 0.25, 9, rope, m_cap=dock_old)
    mb.box((-0.6, 2.0, top + 0.22), (0.6, 0.45, 0.4), varnish, m_top=varnish_d)
    o = finish(mb, 'dock', jit=0.008, seed=5)
    # 繫船柱（子節點，兩根合一）
    bm = MB()
    for x in (-2.2, 2.2):
        bm.tube((x, 0, 0), (x, 0, 0.32), 0.12, 0.11, 8, iron, cap0=False)
        bm.tube((x, 0, 0.32), (x, 0, 0.38), 0.16, 0.16, 8, iron)
    b = finish(bm, 'bollard')
    child(b, o)
    b.location = (0, 12.6, top)
    return o


# ================= 燈樁檢查點 buoy =================
def buoy():
    rnd = random.Random(21)
    mb = MB()
    mb.tube((0, 0, -2.5), (0, 0, -0.05), 0.16, 0.16, 8, dock_old, cap0=False, cap1=False)
    mb.tube((0, 0, -0.05), (0, 0, 2.3), 0.16, 0.14, 8, dock_w, cap0=False, m_cap=log_end)
    mb.tube((0, 0, 0.6), (0, 0, 0.75), 0.17, 0.17, 8, rope, cap0=False, cap1=False)
    mb.tube((0, 0, 1.55), (0, 0, 1.65), 0.155, 0.155, 8, rope, cap0=False, cap1=False)
    # 橫臂＋吊燈
    mb.box((-0.32, 0, 2.18), (0.75, 0.1, 0.1), varnish_d)
    mb.box((-0.62, 0, 2.06), (0.02, 0.02, 0.18), iron)
    lz = 1.82
    mb.tube((-0.62, 0, lz - 0.17), (-0.62, 0, lz - 0.12), 0.13, 0.13, 6, brass)
    mb.tube((-0.62, 0, lz - 0.12), (-0.62, 0, lz + 0.1), 0.1, 0.1, 6, lamp, cap0=False, cap1=False)
    for a in range(3):
        an = a * 2 * math.pi / 3 + 0.3
        mb.box((-0.62 + math.cos(an) * 0.11, math.sin(an) * 0.11, lz - 0.01), (0.025, 0.025, 0.24), brass)
    mb.tube((-0.62, 0, lz + 0.1), (-0.62, 0, lz + 0.22), 0.14, 0.0, 6, brass, cap0=True)
    # 旗桿
    mb.box((0.22, 0, 1.75), (0.05, 0.05, 2.3), varnish_d)
    mb.box((0.11, 0, 1.0), (0.22, 0.04, 0.04), iron)
    mb.box((0.11, 0, 2.6), (0.22, 0.04, 0.04), iron)
    # 浮木環（八段短木）
    for k in range(8):
        a0, a1 = 2 * math.pi * k / 8, 2 * math.pi * (k + 1) / 8
        r = 0.95
        mb.tube((math.cos(a0) * r, math.sin(a0) * r, 0.02), (math.cos(a1) * r, math.sin(a1) * r, 0.02), 0.09, 0.09, 6, log_m if k % 2 else log_d, m_cap=log_end, phase=rnd.random())
    for k in range(4):
        a = 2 * math.pi * k / 4 + 0.4
        mb.box((math.cos(a) * 0.55, math.sin(a) * 0.55, 0.05), (0.8, 0.05, 0.05), rope, rz=math.degrees(a))
    o = finish(mb, 'buoy', jit=0.006, seed=6, keep_floor=False)
    # 旗子（子節點，原點在旗桿上的掛點；遊戲把 three y 從 1.2 升到 2.4）
    fb = MB()
    fb.ngon_fan([Vector((0.0, 0, 0.0)), Vector((0.55, 0.0, -0.13)), Vector((0.0, 0, -0.3))], flag_m)
    fb.ngon_fan([Vector((0.0, 0, 0.0)), Vector((0.0, 0, -0.3)), Vector((0.55, 0.0, -0.13))], flag_m)
    fb.box((0.0, 0, -0.15), (0.06, 0.06, 0.34), brass)
    f = finish(fb, 'buoy_flag')
    child(f, o)
    f.location = (0.25, 0, 1.2)
    return o


# ================= 石拱橋 bridge =================
def strip_solid(mb, xs, _bot, _top, y0, y1, m_side, m_top, m_bot, m_end=None):
    """沿 x 的封閉實體：每個取樣 (x, 底, 頂)，同 x 相鄰兩點形成垂直面（橋墩側面）。"""
    pts = xs
    V = []
    for (x, b, t) in pts:
        V.append((mb.vert((x, y0, b)), mb.vert((x, y1, b)), mb.vert((x, y0, t)), mb.vert((x, y1, t))))
    for i in range(len(pts) - 1):
        a, c = V[i], V[i + 1]
        same = abs(pts[i][0] - pts[i + 1][0]) < 1e-6
        if not same:
            mb.face((a[0], c[0], c[2], a[2]), m_side)   # y0 面（−Y）
            mb.face((a[1], a[3], c[3], c[1]), m_side)   # y1 面
            mb.face((a[2], c[2], c[3], a[3]), m_top)
        mb.face((a[0], a[1], c[1], c[0]), m_bot)
    a, c = V[0], V[-1]
    mb.face((a[0], a[2], a[3], a[1]), m_end or m_side)
    mb.face((c[0], c[1], c[3], c[2]), m_end or m_side)


def bridge():
    rnd = random.Random(31)
    mb = MB()
    HS = 17.0
    deck = lambda x: 1.5 + 2.9 * (1 - (x / HS) ** 2)
    arches = [(0.0, 5.0, 3.8), (-10.6, 3.0, 2.7), (10.6, 3.0, 2.7)]   # 中心、半跨、拱高（起拱 −0.4）
    spring = -0.4
    # 取樣：各拱 16 段＋拱間橋墩
    xs = []
    def arch_pts(c, hs, rise, n=16):
        out = []
        for k in range(n + 1):
            th = math.pi * (1 - k / n)
            out.append((c + hs * math.cos(th), spring + rise * math.sin(th)))
        return out
    seq = [(-HS, -2.0)]
    for c, hs, rise in sorted(arches):
        ap = arch_pts(c, hs, rise)
        seq.append((ap[0][0], -2.0))
        seq.extend(ap)
        seq.append((ap[-1][0], -2.0))
    seq.append((HS, -2.0))
    # 在平坦段補點讓橋面曲線平順
    dense = []
    for i, (x, b) in enumerate(seq):
        dense.append((x, b))
        if i + 1 < len(seq):
            x2, b2 = seq[i + 1]
            if b == -2.0 and b2 == -2.0 and x2 - x > 1.2:
                n = int((x2 - x) / 1.0)
                for k in range(1, n):
                    dense.append((x + (x2 - x) * k / n, -2.0))
    pts = [(x, b, deck(x)) for x, b in dense]
    strip_solid(mb, pts, None, None, -2.0, 2.0, stone, cobble, stone_d)
    # 女兒牆＋壓頂
    xs2 = [-HS + k * (2 * HS) / 34 for k in range(35)]
    for y0, y1 in ((-2.0, -1.68), (1.68, 2.0)):
        strip_solid(mb, [(x, deck(x) - 0.02, deck(x) + 0.62) for x in xs2], None, None, y0, y1, stone_d, stone, stone_d)
        strip_solid(mb, [(x, deck(x) + 0.62, deck(x) + 0.72) for x in xs2], None, None, y0 - 0.05, y1 + 0.05, stone_top, stone_top, stone_top)
    # 拱石：沿拱腹在前後立面各一圈，略凸出
    for c, hs, rise in arches:
        n = 15
        for k in range(n):
            th = math.pi * (k + 0.5) / n
            px, pz = c + hs * math.cos(th), spring + rise * math.sin(th)
            nx, nz = math.cos(th) / hs, math.sin(th) / rise
            ln = math.hypot(nx, nz)
            nx, nz = nx / ln, nz / ln
            ry = math.degrees(math.atan2(nx, nz))
            seg = math.pi * math.hypot(hs, rise) / math.sqrt(2) / n
            for y in (-2.04, 2.04):
                mb.box((px + nx * 0.3, y, pz + nz * 0.3), (seg * 0.92, 0.1, 0.6), stone_top if k % 2 else stone, ry=ry)
        # 拱心石
        for y in (-2.06, 2.06):
            mb.box((c, y, spring + rise + 0.38), (0.5, 0.14, 0.78), stone_top)
    # 分水尖（橋墩上下游）
    for c in (-6.3, 6.3):
        for s in (-1, 1):
            y0 = s * 2.0
            mb.hull([Vector((c - 1.3, y0, -2.0)), Vector((c + 1.3, y0, -2.0)), Vector((c, y0 + s * 1.0, -2.0)),
                     Vector((c - 1.3, y0, 1.1)), Vector((c + 1.3, y0, 1.1)), Vector((c, y0 + s * 1.0, 0.9)),
                     Vector((c, y0 + s * 0.05, 1.9))], lambda n, cc: stone_top if n.z > 0.4 else stone_d)
    # 橋面兩端各一對石柱頭
    for x in (-HS + 0.4, HS - 0.4):
        for y in (-1.84, 1.84):
            mb.box((x, y, deck(x) + 0.5), (0.5, 0.5, 1.0), stone_d, m_top=stone_top)
    o = finish(mb, 'bridge', jit=0.02, seed=8, keep_floor=False)
    return o


# ================= 岩石 =================
def rock(name, size, h, seed, mats=(stone, stone_d, stone_top), n=26, flat=0.0):
    rnd = random.Random(seed)
    pts = []
    for i in range(n):
        u, v = rnd.uniform(0, 2 * math.pi), rnd.uniform(0.05, 1.0)
        rr = math.sqrt(1 - v * v)
        k = rnd.uniform(0.82, 1.0)
        pts.append(Vector((math.cos(u) * rr * size / 2 * k, math.sin(u) * rr * size / 2 * 0.8 * k, v * h * k * (1 - flat))))
    for i in range(9):
        a = 2 * math.pi * i / 9 + rnd.uniform(-0.2, 0.2)
        k = rnd.uniform(0.85, 1.0)
        pts.append(Vector((math.cos(a) * size / 2 * k, math.sin(a) * size / 2 * 0.8 * k, 0)))
    mb = MB()
    a, b, top = mats
    mb.hull(pts, lambda nrm, c: top if nrm.z > 0.5 else (a if (int(c.x * 7 + c.y * 5 + c.z * 3) % 3) else b))
    return finish(mb, name)


def cliff():
    rnd = random.Random(41)
    mb = MB()
    Wd, H, T = 12.0, 9.0, 3.0
    z = 0.0
    k = 0
    while z < H - 0.3:
        h = min(rnd.uniform(1.1, 1.8), H - z)
        front = -T / 2 + rnd.uniform(-0.35, 0.45)
        pts = []
        for i in range(14):
            x = rnd.uniform(-Wd / 2, Wd / 2)
            pts.append(Vector((x, front + rnd.uniform(-0.25, 0.25), rnd.choice((z, z + h)) + rnd.uniform(-0.05, 0.05))))
        for x in (-Wd / 2, Wd / 2):
            for zz in (z, z + h):
                pts.append(Vector((x * rnd.uniform(0.93, 1.0), front + rnd.uniform(0, 0.4), zz)))
                pts.append(Vector((x * rnd.uniform(0.93, 1.0), T / 2, zz)))
        pts.append(Vector((0, T / 2, z)))
        pts.append(Vector((0, T / 2, z + h)))
        top_mat = moss if z + h >= H - 0.35 else (granite if k % 2 else granite_d)
        side = granite_d if k % 2 else granite
        mb.hull(pts, lambda n, c, side=side, top_mat=top_mat: top_mat if n.z > 0.7 else side)
        z += h * 0.96
        k += 1
    return finish(mb, 'cliff', jit=0.05, seed=9)


# ================= 松樹 =================
def pine(name, H, tiers, rbase, rtop, trunk_r, seed, cols):
    rnd = random.Random(seed)
    mb = MB()
    mb.tube((0, 0, 0), (0, 0, H * 0.32), trunk_r, trunk_r * 0.8, 6, trunk, cap0=False, cap1=False)
    z0 = H * 0.16
    span = H - z0
    for i in range(tiers):
        t = i / max(1, tiers - 1)
        R = rbase + (rtop - rbase) * t
        zb = z0 + span * (i / tiers) * 0.92
        th = span / tiers * (1.9 if i < tiers - 1 else 1.6)
        sides = 7
        m = cols[min(len(cols) - 1, i * len(cols) // tiers)]
        ring = []
        ph = rnd.uniform(0, 6.28)
        for s in range(sides):
            a = ph + 2 * math.pi * s / sides
            rr = R * (1.12 if s % 2 == 0 else 0.86) * rnd.uniform(0.94, 1.04)
            ring.append(mb.vert((math.cos(a) * rr, math.sin(a) * rr, zb - (0.18 * R if s % 2 == 0 else 0))))
        tip = mb.vert((rnd.uniform(-0.05, 0.05) * R, rnd.uniform(-0.05, 0.05) * R, zb + th))
        for s in range(sides):
            mb.face((ring[s], ring[(s + 1) % sides], tip), m)
        mb.face(tuple(reversed(ring)), m)
    return finish(mb, name)


# ================= 木頭、蘆葦、睡蓮、樹墩 =================
def log_sunken():
    rnd = random.Random(51)
    mb = MB()
    r = 0.28
    s0 = len(mb.f)
    mb.tube((-3.5, 0, r), (3.4, 0.1, r * 0.92), r, r * 0.85, 8, log_d, m_cap=log_end)
    recolor(mb, s0, lambda n, fi: moss if n.z > 0.55 else None)
    for (x, a, L) in ((-1.6, 40, 0.9), (0.7, -55, 0.7), (2.2, 120, 0.6)):
        d = Vector((math.cos(math.radians(a)), math.sin(math.radians(a)), 0.35)).normalized()
        p0 = Vector((x, 0, r * 1.1))
        mb.tube(p0, p0 + d * L, 0.08, 0.04, 5, log_d, m_cap=log_end)
    # 斷口
    mb.hull([Vector((3.4 + rnd.uniform(0, 0.25), rnd.uniform(-0.2, 0.3), rnd.uniform(0.05, 0.5))) for _ in range(9)], lambda n, c: log_end)
    return finish(mb, 'log_sunken', jit=0.02, seed=10)


def log_drift():
    mb = MB()
    mb.tube((-1.25, 0, 0), (1.25, 0, 0), 0.16, 0.14, 7, log_m, m_cap=log_end)
    mb.tube((0.3, 0, 0.1), (0.55, 0.3, 0.3), 0.05, 0.03, 5, log_m, m_cap=log_end)
    return finish(mb, 'log_drift', jit=0.012, seed=12, keep_floor=False)


def reeds():
    rnd = random.Random(61)
    mb = MB()
    for k in range(16):
        a, rr = rnd.uniform(0, 6.28), math.sqrt(rnd.random()) * 0.7
        bx, by = math.cos(a) * rr, math.sin(a) * rr
        H = rnd.uniform(0.9, 1.5)
        lean = Vector((rnd.uniform(-1, 1), rnd.uniform(-1, 1), 0)).normalized() * rnd.uniform(0.08, 0.3)
        yaw = rnd.uniform(0, math.pi)
        side = Vector((math.cos(yaw), math.sin(yaw), 0)) * 0.035
        m = reed_m if k % 3 else reed_d
        prev = None
        segs = 3
        for s in range(segs + 1):
            t = s / segs
            c = Vector((bx, by, 0)) + lean * (t * t) * H + Vector((0, 0, H * t))
            w = side * (1 - t * 0.85)
            if s == segs:
                tip = mb.vert(c)
                mb.face((prev[0], prev[1], tip), m)
            else:
                cur = (mb.vert(c - w), mb.vert(c + w))
                if prev:
                    mb.face((prev[0], prev[1], cur[1], cur[0]), m)
                prev = cur
        if k % 4 == 0:
            c = Vector((bx, by, 0)) + lean * 0.7 * H + Vector((0, 0, H * 0.82))
            mb.tube(c, c + Vector((0, 0, 0.18)) + lean * 0.05, 0.035, 0.03, 5, reed_head)
    return finish(mb, 'reeds')


def lily():
    mb = MB()
    n, R = 14, 0.25
    notch = 0.42
    c = mb.vert((0, 0, 0.012))
    ring = []
    for s in range(n + 1):
        a = notch / 2 + (2 * math.pi - notch) * s / n
        ring.append(mb.vert((math.cos(a) * R * (1 + 0.04 * (s % 2)), math.sin(a) * R, 0.0)))
    for s in range(n):
        mb.face((c, ring[s], ring[s + 1]), lily_m if s % 2 else lily_rim)
    # 小葉
    c2 = mb.vert((0.3, 0.16, 0.008))
    ring2 = []
    for s in range(9):
        a = 3.6 + 0.35 + (2 * math.pi - 0.7) * s / 8
        ring2.append(mb.vert((0.3 + math.cos(a) * 0.12, 0.16 + math.sin(a) * 0.12, 0.0)))
    for s in range(8):
        mb.face((c2, ring2[s], ring2[s + 1]), lily_rim)
    # 小花
    fc = Vector((-0.06, -0.08, 0.02))
    for k in range(7):
        a = 2 * math.pi * k / 7
        d = Vector((math.cos(a), math.sin(a), 0))
        s = Vector((-d.y, d.x, 0)) * 0.03
        p0 = fc + d * 0.015
        p1 = fc + d * 0.075 + Vector((0, 0, 0.05))
        mb.face((mb.vert(p0 - s), mb.vert(p0 + s), mb.vert(p1 + s * 0.6), mb.vert(p1 - s * 0.6)), petal)
    mb.tube(fc, fc + Vector((0, 0, 0.04)), 0.022, 0.018, 6, petal_c)
    return finish(mb, 'lily')


def stump():
    rnd = random.Random(71)
    mb = MB()
    mb.tube((0, 0, 0), (0, 0, 0.55), 0.42, 0.36, 9, log_d, cap0=False, m_cap=log_end)
    for k in range(5):
        a = 2 * math.pi * k / 5 + rnd.uniform(-0.3, 0.3)
        d = Vector((math.cos(a), math.sin(a), 0))
        sd = Vector((-d.y, d.x, 0))
        mb.hull([d * 0.28 + sd * 0.16, d * 0.28 - sd * 0.16, d * 0.3 + Vector((0, 0, 0.36)),
                 d * 0.5 + sd * 0.12 + Vector((0, 0, 0.12)), d * 0.5 - sd * 0.12 + Vector((0, 0, 0.12)),
                 d * 0.66 + sd * 0.07, d * 0.66 - sd * 0.07, d * 0.6 + Vector((0, 0, 0.05))],
                lambda n, c: log_d if n.z < 0.7 else moss)
    return finish(mb, 'stump', jit=0.015, seed=13)


cabin()
dock()
buoy()
bridge()
rock('rock_L', 3.2, 1.9, 101)
rock('rock_M', 1.6, 1.0, 102)
rock('rock_S', 0.7, 0.42, 103, n=18)
rock('boulder', 2.4, 1.8, 104, mats=(granite, granite_d, M('granite_top', '#b4b0a5')), n=44)
cliff()
pine('pine_tall', 11.0, 5, 2.6, 0.9, 0.24, 201, [pine1, pine2, pine2, pine3])
pine('pine_short', 6.0, 3, 2.3, 1.0, 0.2, 202, [pine2, pine3])
pine('pine_dense', 8.0, 7, 2.5, 0.8, 0.22, 203, [pine1, pine1, pine2, pine3])
log_sunken()
log_drift()
reeds()
lily()
stump()
export_glb('env.glb')
