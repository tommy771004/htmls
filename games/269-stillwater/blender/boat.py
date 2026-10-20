# 靜水釣遊（269）：木製雙尖頭划艇 → blender/out/boat.glb
# 執行：/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P blender/boat.py
# 契約見 SPEC.md：根節點 boat（船殼網格），子節點 Oar_L／Oar_R（原點＝槳架支點）、lantern_mount、lantern、
# creel（含 creel_lid）、rod_stowed、wake_L／wake_R。材質 hull_paint 與 lamp_glow 是遊戲取用的名稱。
# 這裡的座標一律先寫成 three 的船本地座標 (x, y, z)，再用 B() 換成 Blender 的 (x, −z, y)。
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *
import rowing
import math
from mathutils import Vector, Matrix

scene = reset()


def B(p):
    """three (x, y, z) → Blender (x, −z, y)"""
    return Vector((p[0], -p[2], p[1]))


# ---------------- 材質 ----------------
PAINT = mat('hull_paint', '#a5473a', rough=0.8)
VARN = mat('varnish', '#c08a55', rough=0.7)
VARN_D = mat('varnish_dark', '#94643c', rough=0.75)
WOOD_D = mat('dockwood_old', '#6e5541', rough=0.85)
BRASS = mat('lamp_brass', '#b08a4a', rough=0.45, metal=0.3)
GLOW = mat('lamp_glow', '#f6dca0', rough=0.4, emit='#ffc46b')
STRAW = mat('creel_straw', '#d9b46a', rough=0.9)
STRAW_D = mat('creel_straw_dark', '#b08f52', rough=0.9)
CORK = mat('rod_cork', '#c7a173', rough=0.9)
ROD = mat('rod_cane', '#d8b878', rough=0.6)
INK = mat('ink', '#2a2620', rough=0.6)
ROPE = mat('rope', '#cdb68a', rough=0.95)

# ---------------- 船殼尺寸 ----------------
L2 = 1.80          # 半長
BEAM2 = 0.65       # 半寬
KEEL = -0.12       # 吃水
SHEER0 = 0.34      # 舷緣高（中段）
T = 0.028          # 板厚
NZ = 15            # 縱向站數（含兩端）
NS = 6             # 半邊截面點數（龍骨 → 舷緣）


def half_width(z):
    u = min(1.0, abs(z) / L2)
    return BEAM2 * (1 - u ** 2.2) ** 0.75


def sheer(z):
    u = abs(z) / L2
    return SHEER0 + 0.11 * u ** 2.4


def keel(z):
    u = abs(z) / L2
    return KEEL + 0.07 * u ** 3


def section(z, inner=False):
    """半邊截面（x ≥ 0），由龍骨到舷緣：superellipse 象限。回傳 [(x, y), ...]。"""
    w, h, k = half_width(z), sheer(z), keel(z)
    if inner:
        w, k, h = max(0.0, w - T), k + T * 1.4, h
    pts = []
    top = h - 0.045                       # 最上面 4.5 cm 是暗色防撞條
    for i in range(NS):
        a = (i + 1) / NS * math.pi / 2 if i else 0.0
        a = i / (NS - 1) * math.pi / 2
        x = w * math.sin(a) ** 0.75
        y = k + (top - k) * (1 - math.cos(a)) ** 0.9
        pts.append((x, y))
    pts.append((w * 1.01, h))
    return pts


def zs():
    out = []
    for i in range(NZ):
        u = -1 + 2 * i / (NZ - 1)
        out.append(L2 * math.copysign(abs(u) ** 0.85, u))
    return out


def hull():
    """外殼（hull_paint）、內殼（varnish）、舷緣頂（dark）與外側防撞條（dark），一個網格多材質。"""
    Z = zs()
    verts, faces, mats = [], [], []
    rings_o, rings_i = [], []
    for z in Z:
        so, si = section(z), section(z, inner=True)
        # 全截面：右舷（−x）由舷緣 → 龍骨 → 左舷（+x）舷緣
        ro, ri = [], []
        for x, y in reversed(so[1:]):
            ro.append(len(verts)); verts.append(B((-x, y, z)))
        ro.append(len(verts)); verts.append(B((0, so[0][1], z)))
        for x, y in so[1:]:
            ro.append(len(verts)); verts.append(B((x, y, z)))
        for x, y in reversed(si[1:]):
            ri.append(len(verts)); verts.append(B((-x, y, z)))
        ri.append(len(verts)); verts.append(B((0, si[0][1], z)))
        for x, y in si[1:]:
            ri.append(len(verts)); verts.append(B((x, y, z)))
        rings_o.append(ro); rings_i.append(ri)
    n = 2 * NS + 1
    for k in range(NZ - 1):
        a, b = rings_o[k], rings_o[k + 1]
        ai, bi = rings_i[k], rings_i[k + 1]
        for j in range(n - 1):
            # 外殼：最上一圈當作暗色防撞條
            m = 2 if j in (0, n - 2) else 0
            faces.append((a[j], a[j + 1], b[j + 1], b[j])); mats.append(m)
            faces.append((ai[j + 1], ai[j], bi[j], bi[j + 1])); mats.append(1)
        # 舷緣頂：外緣 ↔ 內緣（暫用 3，定向後換成 2）
        for e in (0, n - 1):
            faces.append((a[e], ai[e], bi[e], b[e])); mats.append(3)
    # 定向：外殼與防撞條朝外（離開「船中線、舷緣上方」那條軸）、內殼朝內、舷緣頂朝上
    def nrm(f):
        P = [verts[i] for i in f]
        c = sum(P, Vector()) / len(P)
        nv = Vector()
        for i in range(len(P)):
            nv += P[i].cross(P[(i + 1) % len(P)])
        return c, nv
    for fi, f in enumerate(faces):
        c, nv = nrm(f)
        m = mats[fi]
        if m == 3:
            want = Vector((0, 0, 1))
        else:
            out = Vector((c.x, 0, c.z - 0.5))
            want = out if m in (0, 2) else -out
        if nv.dot(want) < 0:
            faces[fi] = tuple(reversed(f))
    mats = [2 if m == 3 else m for m in mats]
    o = mesh_from('boat', verts, faces, PAINT)
    o.data.materials.append(VARN)
    o.data.materials.append(VARN_D)
    for p, m in zip(o.data.polygons, mats):
        p.material_index = m
    # 兩端截面寬度為 0：合併重複頂點（退化的面一併清掉）
    import bmesh
    bm = bmesh.new(); bm.from_mesh(o.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.002)
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.calc_area() < 1e-7], context='FACES')
    bm.to_mesh(o.data); bm.free()
    return o


def box3(name, material, c, half, rot=(0, 0, 0)):
    """c、half 以 three 座標給（half 為 three 的 x/y/z 半寬），rot 為 Blender 軸的度數。"""
    return prim('cube', name, material, loc=tuple(B(c)), scale=(half[0], half[2], half[1]), rot=rot, size=2)


def tube3(name, material, p0, p1, r0, r1=None, sides=6):
    p0, p1 = B(p0), B(p1)
    r1 = r0 if r1 is None else r1
    d = (p1 - p0)
    o = prim('cylinder', name, material, vertices=sides, radius=1, depth=1)
    o.data.transform(Matrix.Translation((0, 0, 0.5)))
    # 錐度：上面的頂點縮放
    for v in o.data.vertices:
        rr = r0 if v.co.z < 0.5 else r1
        v.co.x *= rr; v.co.y *= rr
    q = Vector((0, 0, 1)).rotation_difference(d.normalized())
    o.data.transform(Matrix.Diagonal((1, 1, d.length, 1)))
    o.data.transform(q.to_matrix().to_4x4())
    o.data.transform(Matrix.Translation(p0))
    o.data.update()
    return o


def ball3(name, material, c, r, sub=1):
    r = (r, r, r) if isinstance(r, (int, float)) else (r[0], r[2], r[1])
    return prim('ico', name, material, loc=tuple(B(c)), scale=r, subdivisions=sub, radius=1)


def fin(o, j=0.004, seed=3):
    jitter(o, j, seed)
    flat(o)
    return o


boat = fin(hull(), 0.003, 1)
parts = []


def part(o, j=0.004):
    fin(o, j, len(parts) + 11)
    parts.append(o)
    return o


def inner_x(z, y):
    """內殼在高度 y 的半寬（線性內插截面）。"""
    s = section(z, inner=True)
    for (x0, y0), (x1, y1) in zip(s, s[1:]):
        if y0 <= y <= y1:
            return x0 + (x1 - x0) * (y - y0) / max(1e-6, y1 - y0)
    return s[-1][0]


# 坐板：中央（z = 0，頂 0.30）、船頭小坐板、船尾小坐板
for nm, z, top, wz in (('thwart_mid', 0.0, 0.30, 0.12), ('thwart_bow', 1.18, 0.30, 0.10), ('thwart_stern', -1.20, 0.29, 0.13)):
    w = min(inner_x(z - wz, top - 0.02), inner_x(z + wz, top - 0.02)) - 0.005
    part(box3(nm, VARN, (0, top - 0.02, z), (w, 0.02, wz)), 0.002)
    # 坐板下的托木（沿舷內側）
    for s in (1, -1):
        part(box3(f'{nm}_cleat{s}', VARN_D, (s * (w - 0.02), top - 0.055, z), (0.025, 0.015, wz + 0.03)), 0.001)
# 中央坐板下的立柱
part(box3('thwart_post', VARN_D, (0, 0.10, 0), (0.03, 0.18, 0.03)), 0.001)

# 底板（三條，船內地板 y ≈ −0.05）
for k, x in enumerate((-0.17, 0.0, 0.17)):
    part(box3(f'floor_{k}', VARN, (x, -0.055, -0.05), (0.07, 0.012, 1.05)), 0.002)
# 肋材（每隔 0.45 m 一條，沿內殼由龍骨爬到舷緣下）
for k, z in enumerate((-1.35, -0.9, -0.45, 0.45, 0.9, 1.35)):
    s = section(z, inner=True)
    pts = [(x - 0.012, y + 0.01) for x, y in s[1:-1]]
    for sgn in (1, -1):
        for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
            part(tube3(f'rib_{k}_{sgn}_{x0:.2f}', VARN_D, (sgn * x0, y0, z), (sgn * x1, y1, z), 0.016, 0.016, 4), 0.0)

# 船頭與船尾柱（stem / sternpost）
for nm, s in (('stem', 1), ('sternpost', -1)):
    z0 = s * (L2 - 0.02)
    part(tube3(nm, VARN_D, (0, keel(z0) - 0.01, z0), (0, sheer(z0) + 0.07, z0 + s * 0.06), 0.035, 0.03, 6), 0.002)
    part(box3(nm + '_cap', VARN_D, (0, sheer(z0) - 0.02, s * (L2 - 0.16)), (0.07, 0.022, 0.14)), 0.002)   # 船首尖端的三角甲板

# 槳架：舷緣上的墊木＋銅 U 形叉（支點在 rowing.PIVOT）
for side in ('L', 'R'):
    px, py, pz = rowing.PIVOT[side]
    sx = 1 if px > 0 else -1
    part(box3(f'riser_{side}', VARN_D, (px, SHEER0 + 0.02, pz), (0.04, 0.03, 0.12)), 0.001)
    part(tube3(f'lock_stem_{side}', BRASS, (px, SHEER0 + 0.04, pz), (px, py - 0.015, pz), 0.009, 0.009, 5), 0.0)
    for dz in (-0.035, 0.035):
        part(tube3(f'lock_horn_{side}{dz}', BRASS, (px, py - 0.02, pz + dz * 0.4), (px, py + 0.035, pz + dz), 0.007, 0.006, 4), 0.0)

# 船頭提燈柱（stem 頂再加一根細柱與掛鉤）
MOUNT = (0, sheer(L2 - 0.12) + 0.32, L2 - 0.10)
part(tube3('lamp_post', VARN_D, (0, sheer(L2 - 0.12), L2 - 0.12), (0, MOUNT[1] + 0.02, L2 - 0.12), 0.018, 0.015, 5), 0.0)
part(tube3('lamp_hook', BRASS, (0, MOUNT[1] + 0.02, L2 - 0.12), (0, MOUNT[1] + 0.02, MOUNT[2] + 0.02), 0.007, 0.007, 4), 0.0)

# 船尾繫船繩圈
part(tube3('painter', ROPE, (0.05, sheer(-1.6) - 0.01, -1.62), (0.12, sheer(-1.4) - 0.06, -1.40), 0.012, 0.012, 4), 0.0)

boat = join([boat] + parts, 'boat')
set_origin(boat, (0, 0, 0))

# ---------------- 子節點 ----------------

def child(o, name, origin_three):
    """把物件原點設到 origin_three（three 座標），掛在 boat 底下。"""
    o.name = name
    set_origin(o, tuple(B(origin_three)))
    o.parent = boat
    return o


# 槳：以支點為原點，本地 +X（L）／−X（R）是槳葉方向；長 2.30（內 0.58、外 1.72），槳柄中心 −0.52、槳葉中心 1.50
def oar(side):
    px, py, pz = rowing.PIVOT[side]
    s = 1 if side == 'L' else -1
    P = lambda d, y=0.0, z=0.0: (px + s * d, py + y, pz + z)
    ps = []
    # 槳柄（握把，暗木）
    ps.append(fin(tube3('grip', VARN_D, P(-rowing.INBOARD), P(-0.45), 0.022, 0.020, 6), 0.0))
    ps.append(fin(ball3('grip_end', VARN_D, P(-rowing.INBOARD), (0.024, 0.024, 0.024)), 0.0))
    # 槳桿
    ps.append(fin(tube3('loom', VARN, P(-0.45), P(-0.06), 0.020, 0.022, 6), 0.0))
    ps.append(fin(tube3('leather', WOOD_D, P(-0.06), P(0.10), 0.025, 0.025, 6), 0.0))   # 支點處的皮套
    ps.append(fin(tube3('button', WOOD_D, P(-0.075), P(-0.06), 0.034, 0.034, 6), 0.0))  # 擋圈
    ps.append(fin(tube3('shaft', VARN, P(0.10), P(1.24), 0.021, 0.017, 6), 0.0))
    # 槳葉：垂直平面（含槳軸與 Y），寬 0.15、長 0.48、厚 0.022，頸部收窄
    bl = []
    for d, hw in ((1.18, 0.022), (1.30, 0.062), (1.42, 0.074), (1.56, 0.076), (1.68, 0.07), (rowing.OUTBOARD, 0.05)):
        bl.append((d, hw))
    verts, faces = [], []
    for d, hw in bl:
        for yy, zz in ((-hw, -0.011), (hw, -0.011), (hw, 0.011), (-hw, 0.011)):
            verts.append(B(P(d, yy, zz)))
    for k in range(len(bl) - 1):
        for j in range(4):
            a, b = k * 4 + j, k * 4 + (j + 1) % 4
            faces.append((a, b, b + 4, a + 4))
    faces.append((0, 1, 2, 3)[::-1])
    n = (len(bl) - 1) * 4
    faces.append((n, n + 1, n + 2, n + 3))
    bo = mesh_from('blade', verts, faces, VARN)
    import bmesh
    bm = bmesh.new(); bm.from_mesh(bo.data); bmesh.ops.recalc_face_normals(bm, faces=bm.faces); bm.to_mesh(bo.data); bm.free()
    ps.append(fin(bo, 0.0))
    # 槳葉尖端一圈漆（和船殼同色）
    ps.append(fin(box3('blade_tip', PAINT, P(1.66), (0.06, 0.079, 0.0125)), 0.0))
    o = join(ps, 'Oar_' + side)
    return child(o, 'Oar_' + side, rowing.PIVOT[side])


oar_L = oar('L')
oar_R = oar('R')

# 提燈掛點（空節點）與提燈
mount = bpy.data.objects.new('lantern_mount', None)
link(mount)
mount.location = B(MOUNT)
mount.parent = boat


def lantern():
    c = Vector(MOUNT) - Vector((0, 0.16, 0))   # 燈體中心在掛鉤下 16 cm
    c = tuple(c)
    ps = []
    ps.append(tube3('lan_base', BRASS, (c[0], c[1] - 0.09, c[2]), (c[0], c[1] - 0.07, c[2]), 0.055, 0.055, 8))
    ps.append(tube3('lan_glass', GLOW, (c[0], c[1] - 0.07, c[2]), (c[0], c[1] + 0.05, c[2]), 0.042, 0.04, 8))
    ps.append(tube3('lan_cap', BRASS, (c[0], c[1] + 0.05, c[2]), (c[0], c[1] + 0.10, c[2]), 0.055, 0.02, 8))
    for k in range(4):
        a = k * math.pi / 2 + math.pi / 4
        x, z = c[0] + math.cos(a) * 0.05, c[2] + math.sin(a) * 0.05
        ps.append(tube3(f'lan_bar{k}', BRASS, (x, c[1] - 0.07, z), (x, c[1] + 0.05, z), 0.006, 0.006, 4))
    ps.append(tube3('lan_bail', BRASS, (c[0], c[1] + 0.10, c[2]), (MOUNT[0], MOUNT[1], MOUNT[2]), 0.005, 0.005, 4))
    for p in ps:
        fin(p, 0.0)
    o = join(ps, 'lantern')
    o = child(o, 'lantern', MOUNT)
    return o


lan = lantern()

# 魚簍：船尾坐板前的竹編簍（蓋子 creel_lid 以後緣為軸）
CREEL = (0.22, -0.05, -0.82)         # 底部中心（坐在底板上）


def creel():
    cx, cy, cz = CREEL
    W, D, H = 0.21, 0.15, 0.26        # 半寬（x）、半深（z）、高
    ps = []
    # 簍身：上寬下窄的八角筒，縱向編紋用兩種草色交錯
    N = 10
    verts, faces, mts = [], [], []
    for r, (sx, y) in enumerate(((0.86, 0.0), (1.0, H * 0.55), (0.96, H))):
        for i in range(N):
            a = (i + 0.5) / N * math.tau
            verts.append(B((cx + math.cos(a) * W * sx, cy + y, cz + math.sin(a) * D * sx)))
    for r in range(2):
        for i in range(N):
            j = (i + 1) % N
            faces.append((r * N + i, r * N + j, (r + 1) * N + j, (r + 1) * N + i)); mts.append(i % 2)
    faces.append(tuple(reversed(range(N)))); mts.append(1)
    o = mesh_from('creel_body', verts, faces, STRAW)
    o.data.materials.append(STRAW_D)
    for p, m in zip(o.data.polygons, mts):
        p.material_index = m
    import bmesh
    bm = bmesh.new(); bm.from_mesh(o.data); bmesh.ops.recalc_face_normals(bm, faces=bm.faces); bm.to_mesh(o.data); bm.free()
    ps.append(o)
    # 口緣與兩道箍
    for k, y in enumerate((H - 0.005, H * 0.3)):
        ps.append(tube3(f'creel_hoop{k}', STRAW_D, (cx, cy + y - 0.012, cz), (cx, cy + y + 0.012, cz), 1.0, 1.0, N))
        hp = ps[-1]
        sx = 0.98 if k == 0 else 0.92
        for v in hp.data.vertices:   # 圓筒換成橢圓箍
            v.co.x = cx + (v.co.x - cx) * W * sx * 1.03
            v.co.y = -cz + (v.co.y + cz) * D * sx * 1.03
    # 背帶
    ps.append(tube3('creel_strap', WOOD_D, (cx - W * 0.9, cy + H, cz), (cx + W * 0.9, cy + H, cz), 0.012, 0.012, 4))
    for p in ps:
        fin(p, 0.0)
    body = join(ps, 'creel')
    body = child(body, 'creel', CREEL)
    # 蓋子：以後緣（−z 側，靠船尾）為軸
    hinge = (cx, cy + H + 0.004, cz - D * 0.96)
    lid_pts = []
    verts = []
    for i in range(N):
        a = (i + 0.5) / N * math.tau
        verts.append(B((cx + math.cos(a) * W * 0.98, cy + H + 0.004, cz + math.sin(a) * D * 0.98)))
    for i in range(N):
        a = (i + 0.5) / N * math.tau
        verts.append(B((cx + math.cos(a) * W * 0.9, cy + H + 0.03, cz + math.sin(a) * D * 0.9)))
    faces = [tuple(range(N)), ]
    faces = [tuple(reversed(range(N)))]
    for i in range(N):
        j = (i + 1) % N
        faces.append((i, j, N + j, N + i))
    faces.append(tuple(range(N, 2 * N)))
    lid = mesh_from('creel_lid', verts, faces, STRAW_D)
    import bmesh
    bm = bmesh.new(); bm.from_mesh(lid.data); bmesh.ops.recalc_face_normals(bm, faces=bm.faces); bm.to_mesh(lid.data); bm.free()
    knob = ball3('lid_knob', WOOD_D, (cx, cy + H + 0.04, cz + D * 0.6), (0.02, 0.015, 0.02))
    fin(lid, 0.0); fin(knob, 0.0)
    lid = join([lid, knob], 'creel_lid')
    lid.name = 'creel_lid'
    set_origin(lid, tuple(B(hinge)))
    lid.parent = body
    lid.matrix_parent_inverse = body.matrix_world.inverted()
    return body


cr = creel()

# 收在船內左舷（+X）的釣竿：橫躺在三條坐板上
def rod_stowed():
    x, y = 0.40, 0.322
    z0, z1 = -1.25, 0.95
    ps = [
        tube3('rs_butt', CORK, (x, y, z0), (x, y, z0 + 0.30), 0.017, 0.015, 6),
        tube3('rs_reel', INK, (x + 0.0, y - 0.03, z0 + 0.36), (x, y - 0.03, z0 + 0.42), 0.03, 0.03, 8),
        tube3('rs_cane', ROD, (x, y, z0 + 0.30), (x, y, z1), 0.013, 0.005, 5),
    ]
    for k, zz in enumerate((-0.4, 0.15, 0.6)):
        ps.append(tube3(f'rs_node{k}', VARN_D, (x, y, zz - 0.01), (x, y, zz + 0.01), 0.013, 0.013, 5))
    for p in ps:
        fin(p, 0.0)
    o = join(ps, 'rod_stowed')
    return child(o, 'rod_stowed', (x, y, z0))


rs = rod_stowed()

# 船尾兩側水花發射點
for side, x in (('L', 0.35), ('R', -0.35)):
    e = bpy.data.objects.new('wake_' + side, None)
    link(e)
    e.location = B((x, 0.0, -1.55))
    e.parent = boat

# 子節點的 parent inverse：boat 在原點且無旋轉，保持單位矩陣即可
bpy.context.view_layer.update()

# 檢查：槳葉中心與槳柄中心（從網格實際量）
def oar_check(o, side):
    s = 1 if side == 'L' else -1
    vs = [o.matrix_world @ v.co for v in o.data.vertices]
    xs = [v.x for v in vs]
    piv = B(rowing.PIVOT[side])
    print(f'  {o.name}: origin {tuple(round(c, 3) for c in o.matrix_world.translation)}  pivot {tuple(round(c, 3) for c in piv)}'
          f'  x 範圍 {min(xs) - piv.x:+.3f} … {max(xs) - piv.x:+.3f}')


oar_check(oar_L, 'L'); oar_check(oar_R, 'R')
xs = [(boat.matrix_world @ v.co) for v in boat.data.vertices]
print(f'  boat 包圍盒 x {min(v.x for v in xs):.3f}…{max(v.x for v in xs):.3f}  y {min(v.y for v in xs):.3f}…{max(v.y for v in xs):.3f}'
      f'  z {min(v.z for v in xs):.3f}…{max(v.z for v in xs):.3f}')

export_glb('boat.glb')

if os.environ.get('BOAT_PREVIEW') == '1':
    for v in ('three', 'top', 'side'):
        render(f'boat-{v}', target=(0, 0, 0.2), view=v, ortho=4.4)
