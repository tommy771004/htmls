# 珊瑚灣垂釣（201）道具：pier、boat、crate、creel、bobber、bread、bread_loaf、hook → blender/out/props.glb
# 執行：/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P blender/props.py
# 規格見 SPEC.md「props.glb」：名稱、原點與尺寸是遊戲碰撞與擺放的依據。
# 幾何全部以 MB（mesh builder）直接寫頂點與面，每個道具是一個物件（多材質），根節點名＝物件名。
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *
import random

reset()

# ---------- 材質（照 SPEC 調色盤） ----------
M = {
    'wood': mat('wood', '#c49a6c'),
    'wood_mid': mat('wood_mid', '#b38b62'),
    'wood_old': mat('wood_old', '#a5805c'),
    'wood_dark': mat('wood_dark', '#7d5f45'),
    'wet': mat('wood_wet', '#6a5240'),
    'slime': mat('slime', '#5e9670'),
    'rope': mat('rope', '#d9bd84'),
    'straw': mat('straw_weave', '#e8c983'),
    'straw_d': mat('straw_weave_dark', '#c9a35f'),
    'straw_rim': mat('straw_rim', '#b38c50'),
    'leather': mat('leather', '#7d5f45'),
    'hull': mat('hull_wood', '#c49a6c'),
    'hull_old': mat('hull_wood_old', '#a5805c'),
    'paint': mat('paint_coral', '#e9967a'),
    'bob_red': mat('bobber_red', '#e8806d', rough=0.5),
    'bob_white': mat('bobber_white', '#fbf3e2', rough=0.5),
    'ink': mat('ink', '#3b3732'),
    'metal': mat('hook_metal', '#a7aeb0', rough=0.4, metal=0.25),
    'crust': mat('bread_crust', '#d29a5a'),
    'crust_top': mat('bread_crust_top', '#b97b47'),
    'crumb': mat('bread_crumb', '#f6e6c2'),
}
# 薄片／單面殼：關掉背面剔除（glTF doubleSided）
for k in ('straw', 'straw_d', 'hull', 'hull_old', 'leather'):
    M[k].use_backface_culling = False


class MB:
    """直接累積頂點／面／材質的網格建構器。每個 add_* 都可帶 jit=(ax, ay, az) 做手作抖動。"""

    def __init__(self, seed=1):
        self.v, self.f, self.fm, self.mats = [], [], [], []
        self.rnd = random.Random(seed)

    def _mi(self, m):
        if m not in self.mats:
            self.mats.append(m)
        return self.mats.index(m)

    def add(self, verts, faces, material, jit=None):
        base = len(self.v)
        if jit:
            cache = {}
            out = []
            for p in verts:
                k = tuple(round(c, 5) for c in p)
                if k not in cache:
                    cache[k] = tuple(self.rnd.uniform(-1, 1) * a for a in jit)
                out.append(tuple(p[i] + cache[k][i] for i in range(3)))
            verts = out
        self.v.extend(Vector(p) for p in verts)
        mats = material if isinstance(material, list) else [material] * len(faces)
        for fc, m in zip(faces, mats):
            self.f.append([base + i for i in fc])
            self.fm.append(self._mi(m))
        return base

    # 柱體：outline（逆時針 XY）從 z0 擠到 z1
    def prism(self, outline, z0, z1, m, jit=None, cap0=True, cap1=True, side_m=None):
        n = len(outline)
        verts = [(x, y, z0) for x, y in outline] + [(x, y, z1) for x, y in outline]
        faces, mats = [], []
        for i in range(n):
            j = (i + 1) % n
            faces.append((i, j, n + j, n + i)); mats.append(side_m or m)
        if cap0:
            faces.append(tuple(reversed(range(n)))); mats.append(m)
        if cap1:
            faces.append(tuple(range(n, 2 * n))); mats.append(m)
        return self.add(verts, faces, mats, jit)

    def box(self, x0, x1, y0, y1, z0, z1, m, jit=None):
        return self.prism([(x0, y0), (x1, y0), (x1, y1), (x0, y1)], z0, z1, m, jit)

    def cyl(self, cx, cy, z0, z1, r, segs, m, jit=None, rot=0.0, cap0=True, cap1=True):
        o = [(cx + r * math.cos(rot + 2 * math.pi * i / segs), cy + r * math.sin(rot + 2 * math.pi * i / segs)) for i in range(segs)]
        return self.prism(o, z0, z1, m, jit, cap0, cap1)

    def lathe(self, prof, segs, matfn, center=(0, 0, 0), jit=None, rot=0.0, cap0=True, cap1=True):
        """prof：[(r, z), ...] 由下往上；r=0 的端點收成極點。matfn(z 中點) → 材質。"""
        cx, cy, cz = center
        verts, rings = [], []
        for r, z in prof:
            if r == 0:
                rings.append([len(verts)] * segs)
                verts.append((cx, cy, cz + z))
            else:
                ring = []
                for i in range(segs):
                    a = rot + 2 * math.pi * i / segs
                    ring.append(len(verts))
                    verts.append((cx + r * math.cos(a), cy + r * math.sin(a), cz + z))
                rings.append(ring)
        faces, mats = [], []
        for k in range(len(rings) - 1):
            a, b = rings[k], rings[k + 1]
            zm = (prof[k][1] + prof[k + 1][1]) / 2
            for i in range(segs):
                j = (i + 1) % segs
                q = [a[i], a[j], b[j], b[i]]
                q = [x for idx, x in enumerate(q) if x not in q[:idx]]
                faces.append(tuple(q)); mats.append(matfn(zm))
        if prof[0][0] > 0 and cap0:
            faces.append(tuple(reversed(rings[0]))); mats.append(matfn(prof[0][1]))
        if prof[-1][0] > 0 and cap1:
            faces.append(tuple(rings[-1])); mats.append(matfn(prof[-1][1]))
        return self.add(verts, faces, mats, jit)

    def sweep(self, pts, a, b, m, upref=(0, 0, 1), sides=4, caps=True, closed=False, jit=None, twist=0.0):
        """沿折線掃出斷面（sides 邊形，半徑 a 沿 side 軸、b 沿 up 軸）。"""
        P = [Vector(p) for p in pts]
        n = len(P)
        U = Vector(upref)
        verts = []
        for i in range(n):
            if closed:
                t = P[(i + 1) % n] - P[i - 1]
            else:
                t = P[min(i + 1, n - 1)] - P[max(i - 1, 0)]
            t.normalize()
            s = t.cross(U)
            if s.length < 1e-6:
                s = t.cross(Vector((1, 0, 0)))
            s.normalize()
            u = s.cross(t).normalized()
            for k in range(sides):
                ang = twist + math.pi / 4 + 2 * math.pi * k / sides if sides == 4 else twist + 2 * math.pi * k / sides
                verts.append(tuple(P[i] + s * (a * math.cos(ang) * (1.42 if sides == 4 else 1)) + u * (b * math.sin(ang) * (1.42 if sides == 4 else 1))))
        faces = []
        segN = n if closed else n - 1
        for i in range(segN):
            i2 = (i + 1) % n
            for k in range(sides):
                k2 = (k + 1) % sides
                faces.append((i * sides + k, i2 * sides + k, i2 * sides + k2, i * sides + k2))
        if caps and not closed:
            faces.append(tuple(range(sides)))
            faces.append(tuple(reversed([(n - 1) * sides + k for k in range(sides)])))
        return self.add(verts, faces, m, jit)

    def torus(self, c, R, r, segU, segV, m, jit=None, zscale=1.0):
        pts = []
        for i in range(segU):
            a = 2 * math.pi * i / segU
            pts.append((c[0] + R * math.cos(a), c[1] + R * math.sin(a), c[2]))
        # 圓環：以 sweep 掃 segV 邊形
        return self.sweep(pts, r, r * zscale, m, sides=segV, closed=True, jit=jit)

    def grid(self, rows, m_fn, closed_u=False, jit=None, flip=False):
        """rows：[[p, ...], ...] 每列點數相同；面 (i,j)-(i+1,j)-(i+1,j+1)-(i,j+1)。"""
        R, C = len(rows), len(rows[0])
        verts = [p for row in rows for p in row]
        faces, mats = [], []
        cols = C if closed_u else C - 1
        for i in range(R - 1):
            for j in range(cols):
                j2 = (j + 1) % C
                q = (i * C + j, (i + 1) * C + j, (i + 1) * C + j2, i * C + j2)
                faces.append(tuple(reversed(q)) if flip else q); mats.append(m_fn(i, j))
        return self.add(verts, faces, mats, jit)

    def build(self, name, origin_shift=(0, 0, 0)):
        o = mesh_from(name, [v + Vector(origin_shift) for v in self.v], self.f)
        for m in self.mats:
            o.data.materials.append(m)
        for p, mi in zip(o.data.polygons, self.fm):
            p.material_index = mi
        flat(o)
        o.data.update()
        return o


def place(o, loc):
    """排版位置（只影響預覽，遊戲會重設根節點位置）。"""
    o.location = loc
    return o


# =====================================================================
# pier：原點＝岸端中心、橋面頂 z=0；走道 x∈[-1.2,1.2]、y∈[0,13]（glTF z∈[-13,0]）；
#       平台 x∈[-3,3]、y∈[13,18]；木樁到 z=-4；水面在 z=-0.8（遊戲把棧橋放在 y=0.8）。
# =====================================================================
def build_pier():
    mb = MB(seed=11)
    rnd = random.Random(7)
    T = 0.07        # 板厚
    WATER = -0.8

    def plank(x0, x1, y0, y1, color, chip=None, lift=0.0, lift_end=1):
        """一片橫鋪木板。chip=(角, dx, dy) 缺角；lift>0 時一端翹起。"""
        if chip:
            corner, dx, dy = chip
            o = {
                0: [(x0 + dx, y0), (x1, y0), (x1, y1), (x0, y1), (x0, y0 + dy)],
                1: [(x0, y0), (x1 - dx, y0), (x1, y0 + dy), (x1, y1), (x0, y1)],
                2: [(x0, y0), (x1, y0), (x1, y1 - dy), (x1 - dx, y1), (x0, y1)],
                3: [(x0, y0), (x1, y0), (x1, y1), (x0 + dx, y1), (x0, y1 - dy)],
            }[corner]
        else:
            o = [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]
        base = mb.prism(o, -T, 0.0, color, jit=(0.006, 0.004, 0.003), cap0=False)
        if lift:
            for i in range(base, len(mb.v)):
                v = mb.v[i]
                k = (v.x - x0) / (x1 - x0)
                k = k if lift_end == 1 else 1 - k
                v.z += lift * max(0.0, k - 0.55) / 0.45

    def color_pick():
        r = rnd.random()
        return M['wood'] if r < 0.48 else M['wood_mid'] if r < 0.78 else M['wood_old']

    # --- 走道木板：50 片，間距 0.26（板寬 0.225、縫 0.035）---
    pitch, wid = 0.26, 0.22
    for k in range(50):
        y0 = k * pitch + (pitch - wid) / 2
        y1 = y0 + wid
        x0 = -1.2 + rnd.uniform(0, 0.03)
        x1 = 1.2 - rnd.uniform(0, 0.03)
        chip = None
        lift = 0.0
        r = rnd.random()
        if r < 0.08:
            chip = (rnd.randrange(4), rnd.uniform(0.12, 0.2), rnd.uniform(0.08, 0.12))
        elif r < 0.14:
            lift = rnd.uniform(0.035, 0.05)
        plank(x0, x1, y0, y1, color_pick(), chip, lift, rnd.choice((0, 1)))

    # --- 平台木板：19 排，每排兩片、接縫錯開 ---
    rows = 19
    pitch2 = 5.0 / rows
    wid2 = pitch2 - 0.04
    for k in range(rows):
        y0 = 13.0 + k * pitch2 + 0.02
        y1 = y0 + wid2
        xj = (1.0 if k % 2 else -1.0) + rnd.uniform(-0.25, 0.25)
        for (a, b) in ((-3.0 + rnd.uniform(0, 0.02), xj - 0.018), (xj + 0.018, 3.0 - rnd.uniform(0, 0.02))):
            chip = None
            lift = 0.0
            r = rnd.random()
            if r < 0.07:
                chip = (rnd.randrange(4), rnd.uniform(0.12, 0.2), rnd.uniform(0.08, 0.12))
            elif r < 0.11:
                lift = rnd.uniform(0.03, 0.045)
            plank(a, b, y0, y1, color_pick(), chip, lift, rnd.choice((0, 1)))

    # --- 木樁（水上舊木、水下濕木、水線海藻綠） ---
    def pile(x, y, r, top, segs=6):
        rot = rnd.uniform(0, 1)
        w0, w1 = WATER - 0.14, WATER + 0.1
        prof = [(r * 0.97, -4.0), (r + 0.01, w0), (r + 0.01, w1), (r, top)]   # 水下濕木｜水線海藻｜水上舊木
        fn = lambda z: M['wet'] if z < w0 else M['slime'] if z < w1 else M['wood_old']
        mb.lathe(prof, segs, fn, center=(x, y, 0), jit=(0.008, 0.008, 0.0), rot=rot, cap0=False, cap1=top > 0)
        if top > 0:   # 柱頭蓋
            mb.cyl(x, y, top, top + 0.035, r + 0.015, segs, M['wood_dark'], rot=rot, cap0=False)

    PY = [0.2 + 2 * i for i in range(7)]           # 0.2 … 12.2，每 2 m 一對
    PX = 1.08
    for y in PY:
        for x in (-PX, PX):
            pile(x, y, 0.09, 0.52)                 # 走道兩側的木樁伸出橋面當護欄柱
    for x in (-PX, PX):                            # 走道盡頭的短護欄柱（只在橋面上）
        mb.cyl(x, 12.92, -0.27, 0.52, 0.075, 7, M['wood_old'], jit=(0.006, 0.006, 0))
        mb.cyl(x, 12.92, 0.52, 0.55, 0.09, 7, M['wood_dark'])

    for y in (13.18, 15.5, 17.82):
        for x in (-2.82, 0.0, 2.82):
            pile(x, y, 0.12, -T - 0.01)

    # --- 底下結構：縱樑、橫樑、平台邊樑 ---
    D = M['wood_dark']
    for x in (-0.94, 0.0, 0.94):
        mb.box(x - 0.06, x + 0.06, 0.0, 13.0, -0.27, -T, D, jit=(0.004, 0.0, 0.004))
    for y in PY:
        mb.box(-1.19, 1.19, y - 0.07, y + 0.07, -0.42, -0.27, D, jit=(0.0, 0.004, 0.006))
    mb.box(-1.2, 1.2, 0.0, 0.1, -0.34, -T, D)        # 岸端封板（擋住橋面下的結構）
    for x in (-2.0, -1.0, 0.0, 1.0, 2.0):
        mb.box(x - 0.06, x + 0.06, 13.0, 18.0, -0.27, -T, D)
    for y in (13.18, 15.5, 17.82):
        mb.box(-2.95, 2.95, y - 0.07, y + 0.07, -0.42, -0.27, D)
    mb.box(-3.0, -2.9, 13.0, 18.0, -0.32, -T, D)
    mb.box(2.9, 3.0, 13.0, 18.0, -0.32, -T, D)
    mb.box(-3.0, 3.0, 17.9, 18.0, -0.32, -T, D)
    mb.box(-3.0, -1.2, 13.0, 13.1, -0.32, -T, D)
    mb.box(1.2, 3.0, 13.0, 13.1, -0.32, -T, D)

    # --- 矮護欄（只在走道兩側）：上扶手＋中橫條，每段各自略歪 ---
    ys = PY + [12.92]
    for side in (-1, 1):
        x = side * PX
        for a, b in zip(ys[:-1], ys[1:]):
            dz = rnd.uniform(-0.012, 0.012)
            mb.box(x - 0.055, x + 0.055, a - 0.04, b + 0.04, 0.48 + dz, 0.55 + dz, M['wood'], jit=(0.006, 0.0, 0.006))
            mb.box(x - 0.035, x + 0.035, a, b, 0.22 + dz, 0.27 + dz, M['wood_mid'], jit=(0.004, 0.0, 0.008))

    # --- 平台四角繫船柱（纏繩） ---
    for x in (-2.68, 2.68):
        for y in (13.32, 17.68):
            mb.cyl(x, y, 0.0, 0.3, 0.1, 8, M['wood_old'], jit=(0.006, 0.006, 0.0))
            mb.cyl(x, y, 0.3, 0.36, 0.13, 8, D)
            mb.torus((x, y, 0.1), 0.112, 0.024, 8, 4, M['rope'])
            mb.torus((x, y, 0.16), 0.112, 0.024, 8, 4, M['rope'])
    # 東側一捆盤起來的繩子（繩頭繞到繫船柱）
    for i, R in enumerate((0.1, 0.16, 0.22)):
        mb.torus((2.25, 17.15, 0.022 + 0.004 * i), R, 0.022, 9 + 2 * i, 3, M['rope'], zscale=0.8)
    mb.sweep([(2.47, 17.15, 0.02), (2.58, 17.4, 0.03), (2.62, 17.6, 0.12)], 0.022, 0.022, M['rope'], sides=5)

    # --- 西側下水梯（掛在平台外緣，扶手彎回橋面） ---
    for y in (15.22, 15.82):
        mb.sweep([(-3.06, y, -1.75), (-3.06, y, 0.42), (-3.02, y, 0.56), (-2.9, y, 0.6), (-2.8, y, 0.5), (-2.8, y, -0.01)],
                 0.035, 0.035, M['wood_old'], upref=(0, 1, 0), jit=(0.004, 0.0, 0.004))
        mb.cyl(-3.06, y, WATER - 0.1, WATER + 0.08, 0.05, 5, M['slime'], cap0=False, cap1=False)
    for z in (-0.32, -0.62, -0.92, -1.22, -1.52):
        mb.box(-3.1, -3.02, 15.22, 15.82, z - 0.028, z + 0.028, M['wood'], jit=(0.003, 0.0, 0.004))

    return mb.build('pier')


# =====================================================================
# boat：長 3.2、寬 1.3，船頭朝 Blender −Y（glTF +Z），原點在吃水線中心，船底約 −0.3
# =====================================================================
def build_boat():
    mb = MB(seed=21)
    L = 3.14
    # (s, 半寬, 龍骨 z, 舷緣 z)；s=0 船頭、s=1 船尾板
    KEY = [(0.0, 0.03, -0.04, 0.44), (0.08, 0.23, -0.16, 0.36), (0.2, 0.44, -0.25, 0.3), (0.35, 0.575, -0.29, 0.265),
           (0.5, 0.62, -0.3, 0.25), (0.65, 0.61, -0.3, 0.255), (0.8, 0.575, -0.285, 0.27), (0.92, 0.53, -0.265, 0.29),
           (1.0, 0.48, -0.24, 0.31)]

    def interp(s):
        for a, b in zip(KEY[:-1], KEY[1:]):
            if a[0] <= s <= b[0]:
                k = (s - a[0]) / (b[0] - a[0])
                return tuple(a[i] + (b[i] - a[i]) * k for i in range(1, 4))
        return KEY[-1][1:]

    def section(s, inset=0.0):
        w, d, g = interp(s)
        y = -L / 2 + s * L
        half = [(w, g), (0.93 * w, g + (d - g) * 0.45), (0.72 * w, d + 0.07), (0.36 * w, d + 0.012), (0.0, d)]
        right = [(max(x - inset, 0.0) if x > 0 else 0.0, z + inset) for x, z in half]
        left = [(-x, z) for x, z in right[:-1]]           # 左舷：舷緣→龍骨前
        row = left + right[::-1]                          # 左舷緣 … 龍骨 … 右舷緣
        return [(x, y, z) for x, z in row]

    stations = [k[0] for k in KEY]
    rows = [section(s) for s in stations]
    # 兩色木板：由舷緣往龍骨四條帶交錯
    band = lambda j: (j if j < 4 else 7 - j)
    mb.grid(rows, lambda i, j: M['hull'] if band(j) % 2 == 0 else M['hull_old'], flip=False, jit=(0.006, 0.0, 0.006))
    # 船尾板（法線朝 +Y）
    tr = rows[-1]
    mb.add(tr, [tuple(reversed(range(len(tr))))], M['hull_old'])
    # 舷緣扶手、船尾板頂、龍骨、船首柱（暗木）
    for side in (0, -1):
        g = [r[side] for r in rows]
        g = [(p[0], p[1], p[2] + 0.012) for p in g]
        mb.sweep(g, 0.03, 0.022, M['wood_dark'], jit=(0.004, 0.0, 0.003))
    mb.sweep([(-0.48, L / 2 + 0.005, 0.32), (0.48, L / 2 + 0.005, 0.32)], 0.03, 0.022, M['wood_dark'], upref=(0, 1, 0))
    keel = [r[4] for r in rows]
    mb.sweep([(p[0], p[1], p[2] - 0.015) for p in keel], 0.03, 0.02, M['wood_dark'])
    mb.sweep([(0, -L / 2 - 0.015, 0.47), (0, -L / 2 - 0.005, 0.15), (0, -L / 2 + 0.05, -0.06), (0, -L / 2 + 0.25, -0.17)],
             0.03, 0.03, M['wood_dark'], upref=(1, 0, 0))
    # 肋條
    for s in (0.22, 0.36, 0.5, 0.64, 0.78, 0.9):
        pts = section(s, inset=0.03)[1:-1]
        mb.sweep(pts, 0.012, 0.028, M['wood_dark'], upref=(0, 1, 0))
    # 船底踏板
    for x in (-0.2, 0.0, 0.2):
        mb.box(x - 0.085, x + 0.085, -0.62, 1.0, -0.245, -0.225, M['wood'], jit=(0.004, 0.006, 0.002))
    # 座板＋兩側托木
    mb.box(-0.58, 0.58, -0.13, 0.13, 0.06, 0.11, M['wood_old'], jit=(0.004, 0.004, 0.003))
    # 槳架
    for x in (-0.62, 0.62):
        mb.box(x - 0.025, x + 0.025, -0.03, 0.03, 0.26, 0.34, M['wood_dark'])
    # 兩支槳：擱在座板上，槳葉朝船尾、葉尖漆成珊瑚橘
    for sx, rz in ((-1, 4.0), (1, -3.0)):
        ox = sx * 0.24
        a = math.radians(rz)
        def rp(px, py, pz):
            return (ox + px * math.cos(a) - py * math.sin(a), px * math.sin(a) + py * math.cos(a), pz)
        y0, y1 = -0.98, 0.72
        mb.sweep([rp(0, y0, 0.135), rp(0, y1, 0.14)], 0.022, 0.022, M['wood'], sides=6)
        mb.sweep([rp(0, y0 - 0.14, 0.135), rp(0, y0 + 0.02, 0.135)], 0.03, 0.03, M['wood_dark'], sides=6)
        blade = [(-0.035, 0.0), (0.035, 0.0), (0.075, 0.12), (0.075, 0.42), (0.04, 0.5), (-0.04, 0.5), (-0.075, 0.42), (-0.075, 0.12)]
        o = [rp(bx, y1 - 0.02 + by, 0)[:2] for bx, by in blade]
        mb.prism(o, 0.128, 0.146, M['wood'])
        tip = [(-0.075, 0.36), (0.075, 0.36), (0.075, 0.42), (0.04, 0.5), (-0.04, 0.5), (-0.075, 0.42)]
        o2 = [rp(bx, y1 - 0.02 + by, 0)[:2] for bx, by in tip]
        mb.prism(o2, 0.145, 0.149, M['paint'])
    # 船首小甲板＋繩圈
    deck = []
    for s in (0.02, 0.08, 0.16, 0.24):
        w, d, g = interp(s)
        deck.append((0.86 * w, -L / 2 + s * L))
    outline = [(x, y) for x, y in deck] + [(-x, y) for x, y in deck[::-1]]
    outline = outline[::-1]                               # 逆時針
    mb.prism(outline, 0.27, 0.3, M['wood_old'], jit=(0.003, 0.003, 0.002))
    for i, (R, z) in enumerate(((0.12, 0.322), (0.115, 0.36), (0.085, 0.39))):
        mb.torus((0.0, -1.0, z), R, 0.024, 10, 4, M['rope'])
    mb.sweep([(0.1, -1.04, 0.33), (0.08, -1.3, 0.35), (0.0, -1.55, 0.42), (0.0, -1.63, 0.38), (0.0, -1.64, 0.2)],
             0.018, 0.018, M['rope'], sides=5)
    mb.torus((0.0, -1.6, 0.36), 0.05, 0.014, 8, 4, M['wood_dark'])   # 船首繩環
    return mb.build('boat')


# =====================================================================
# crate：0.6 m 木箱，原點底部中心
# =====================================================================
def build_crate():
    mb = MB(seed=31)
    h = 0.3
    D, W, O = M['wood_dark'], M['wood'], M['wood_old']
    mb.box(-0.27, 0.27, -0.27, 0.27, 0.01, 0.58, O)                    # 內箱
    e = 0.055
    for x in (-h, h - e):                                              # 四根角柱
        for y in (-h, h - e):
            mb.box(x, x + e, y, y + e, 0.0, 0.6, D, jit=(0.003, 0.003, 0.0))
    for z0 in (0.0, 0.6 - e):                                          # 上下框
        mb.box(-h, h, -h, -h + e, z0, z0 + e, D, jit=(0.003, 0.0, 0.003))
        mb.box(-h, h, h - e, h, z0, z0 + e, D, jit=(0.003, 0.0, 0.003))
        mb.box(-h, -h + e, -h + e, h - e, z0, z0 + e, D, jit=(0.0, 0.003, 0.003))
        mb.box(h - e, h, -h + e, h - e, z0, z0 + e, D, jit=(0.0, 0.003, 0.003))
    # 四面橫條（三條，有縫）
    for k in range(3):
        z0 = 0.075 + k * 0.155
        z1 = z0 + 0.13
        c = (W, M['wood_mid'], W)[k]
        mb.box(-h + e, h - e, -h + 0.012, -h + 0.04, z0, z1, c, jit=(0.002, 0.0, 0.004))
        mb.box(-h + e, h - e, h - 0.04, h - 0.012, z0, z1, c, jit=(0.002, 0.0, 0.004))
        mb.box(-h + 0.012, -h + 0.04, -h + e, h - e, z0, z1, c, jit=(0.0, 0.002, 0.004))
        mb.box(h - 0.04, h - 0.012, -h + e, h - e, z0, z1, c, jit=(0.0, 0.002, 0.004))
    # 前後面斜撐
    for sy in (-1, 1):
        y = sy * (h + 0.0)
        p0 = Vector((-h + e, y, e)); p1 = Vector((h - e, y, 0.6 - e))
        mb.sweep([tuple(p0), tuple(p1)], 0.035, 0.01, O, upref=(0, 1, 0), caps=True)
    # 蓋板：三片
    for k, c in enumerate((W, M['wood_mid'], W)):
        y0 = -h + e + k * 0.165
        mb.box(-h + e, h - e, y0, y0 + 0.15, 0.56, 0.592, c, jit=(0.003, 0.002, 0.003))
    return mb.build('crate')


# =====================================================================
# creel：竹編魚簍，高 0.45、口徑 0.35，背帶、蓋子向後掀開；原點底部中心
# =====================================================================
def build_creel():
    mb = MB(seed=41)
    SEG = 12
    prof = [(0.125, 0.0), (0.15, 0.035), (0.19, 0.11), (0.205, 0.2), (0.198, 0.29), (0.182, 0.37), (0.175, 0.43)]
    half = math.pi / SEG
    rows = []
    for i, (r, z) in enumerate(prof):
        rows.append([(r * math.cos(2 * math.pi * j / SEG + i * half), r * math.sin(2 * math.pi * j / SEG + i * half), z) for j in range(SEG)])
    # 斜向交錯：每圈扭轉半格，格子材質交錯 → 斜條帶的編織感
    mb.grid(rows, lambda i, j: M['straw'] if (j + (i // 1)) % 2 == 0 else M['straw_d'], closed_u=True, flip=True, jit=(0.003, 0.003, 0.002))
    mb.add([rows[0][j] for j in range(SEG)][::-1], [tuple(range(SEG))], M['straw_d'])   # 底（朝下）
    mb.cyl(0, 0, 0.012, 0.02, 0.13, SEG, M['straw_rim'], cap0=False)                    # 簍內底
    # 口緣與底圈
    mb.torus((0, 0, 0.432), 0.178, 0.016, SEG, 4, M['straw_rim'])
    mb.torus((0, 0, 0.012), 0.135, 0.014, SEG, 4, M['straw_rim'])
    mb.torus((0, 0, 0.2), 0.207, 0.009, SEG, 3, M['straw_rim'])                     # 腰箍
    # 蓋子：扁錐＋邊圈，鉸鏈在後緣（+Y），往後掀開約 110°
    lid = MB(seed=42)
    lid.lathe([(0.0, 0.05), (0.07, 0.042), (0.15, 0.018), (0.185, 0.0)], SEG, lambda z: M['straw'], center=(0, 0, 0))
    lid.lathe([(0.185, 0.0), (0.0, -0.005)], SEG, lambda z: M['straw_d'])
    lid.torus((0, 0, 0.0), 0.185, 0.012, SEG, 4, M['straw_rim'])
    lid.cyl(0, 0, 0.05, 0.075, 0.02, 6, M['leather'])                                   # 提鈕
    hinge = Vector((0, 0.185, 0.445))
    R = Matrix.Rotation(math.radians(-145), 4, 'X')
    vs = [tuple(hinge + (R @ (v + Vector((0, -0.185, 0))))) for v in lid.v]
    mb.add(vs, lid.f, [lid.mats[i] for i in lid.fm])
    # 背帶：兩側耳環之間的皮帶弧，往前傾
    pts = []
    for k in range(13):
        u = math.pi * k / 12
        x = -0.215 * math.cos(u)
        pts.append((x, -0.03 - 0.13 * math.sin(u), 0.3 + 0.27 * math.sin(u)))
    mb.sweep(pts, 0.006, 0.02, M['leather'], upref=(0, 1, 0))
    for x in (-0.21, 0.21):
        mb.box(x - 0.012, x + 0.012, -0.05, -0.01, 0.27, 0.33, M['leather'])
    return mb.build('creel')


# =====================================================================
# bobber：總高 0.14，原點在吃水線（身體中段）；上半珊瑚紅、下半白、頂端細天線
# =====================================================================
def build_bobber():
    mb = MB(seed=51)
    prof = [(0.0, -0.05), (0.006, -0.036), (0.022, -0.027), (0.034, -0.011), (0.036, 0.0),
            (0.032, 0.014), (0.019, 0.029), (0.0035, 0.036), (0.0035, 0.082), (0.0, 0.082)]
    mb.lathe(prof, 8, lambda z: M['bob_red'] if z > 0.0 and z < 0.04 else M['bob_white'] if z <= 0 else M['bob_white'])
    mb.lathe([(0.0, 0.08), (0.0065, 0.085), (0.0, 0.09)], 5, lambda z: M['bob_red'])   # 天線頂珠
    mb.torus((0, 0, 0.0), 0.0362, 0.0022, 8, 3, M['ink'])                                       # 中線
    return mb.build('bobber')


# =====================================================================
# bread：麵包丁 0.05（原點在中心）；bread_loaf：小吐司 0.3（原點底部中心）
# =====================================================================
def build_bread():
    bpy.ops.mesh.primitive_cube_add(size=0.05)
    o = bpy.context.active_object
    o.name = 'bread'
    o.data.name = 'bread'
    bm = bmesh.new()
    bm.from_mesh(o.data)
    bmesh.ops.bevel(bm, geom=list(bm.edges), offset=0.007, segments=1, affect='EDGES')
    bm.to_mesh(o.data)
    bm.free()
    jitter(o, 0.0025, seed=5)
    o.data.materials.append(M['crumb'])
    o.data.materials.append(M['crust'])
    for p in o.data.polygons:
        n = p.normal
        p.material_index = 1 if (n.z > 0.9 or n.x > 0.9) else 0
    flat(o)
    return o


def build_loaf():
    mb = MB(seed=61)
    # 斷面（YZ），山形吐司：側面直、頂部膨起外翻
    sec = [(0.062, 0.0), (0.064, 0.085), (0.072, 0.1), (0.07, 0.125), (0.05, 0.148), (0.022, 0.158),
           (-0.022, 0.158), (-0.05, 0.148), (-0.07, 0.125), (-0.072, 0.1), (-0.064, 0.085), (-0.062, 0.0)]
    xs = [-0.15, -0.11, -0.075, -0.04, 0.0, 0.04, 0.075, 0.11, 0.15]
    rows = []
    for x in xs:
        bump = 0.86 + 0.14 * abs(math.sin(math.pi * (x + 0.15) / 0.15)) if abs(x) < 0.149 else 0.82
        row = []
        for y, z in sec:
            zz = z if z <= 0.1 else 0.1 + (z - 0.1) * bump
            row.append((x, y, zz))
        rows.append(row)
    top = lambda i, j: M['crust_top'] if 3 <= j <= 7 else M['crust']
    mb.grid(rows, top, closed_u=True, flip=True, jit=(0.002, 0.002, 0.002))
    n = len(sec)
    mb.add(rows[0], [tuple(reversed(range(n)))], M['crust'])         # −X 端（外皮）
    mb.add(rows[-1], [tuple(range(n))], M['crumb'])                  # +X 端切口（白色內裡）
    # 切下的一片靠在切口旁
    sl = MB(seed=62)
    sl.prism(list(sec), 0.0, 0.018, M['crumb'], side_m=M['crust'])
    vs = []
    for v in sl.v:
        p = Vector((v.z, v.x, v.y))     # 斷面 (y,z) 平面朝 X 擠出 → 立起來的一片
        p = Matrix.Rotation(math.radians(-14), 3, 'Y') @ p
        vs.append(tuple(p + Vector((0.168, 0.0, 0.004))))
    mb.add(vs, sl.f, [sl.mats[i] for i in sl.fm])
    return mb.build('bread_loaf')


# =====================================================================
# hook：小魚鉤 0.04，原點在線結（鉤眼頂端）
# =====================================================================
def build_hook():
    mb = MB(seed=71)
    r = 0.0012
    c = -0.0035
    mb.torus((0, 0, c), 0.0028, 0.0009, 8, 3, M['metal'])
    # 鉤眼轉成直立（XZ 平面）：(x, y, z) → (x, z − c, y + c)
    for i in range(len(mb.v)):
        v = mb.v[i]
        mb.v[i] = Vector((v.x, v.z - c, v.y + c))
    pts = [(0, 0, -0.0062), (0, 0, -0.018), (0, 0, -0.028)]
    for k in range(1, 8):
        a = math.pi + math.pi * k / 7
        pts.append((0.0065 + 0.0065 * math.cos(a), 0, -0.028 + 0.0075 * math.sin(a)))
    pts.append((0.0128, 0, -0.022))
    pts.append((0.0122, 0, -0.0175))
    mb.sweep(pts, r, r, M['metal'], upref=(0, 1, 0), sides=5)
    mb.sweep([(0.0124, 0, -0.0178), (0.0088, 0, -0.0222)], 0.0007, 0.0007, M['metal'], upref=(0, 1, 0), sides=3)  # 倒鉤
    return mb.build('hook')


objs = {
    'pier': place(build_pier(), (0, 0, 0)),
    'boat': place(build_boat(), (5.0, 15.5, -0.8)),
    'crate': place(build_crate(), (-1.9, 16.6, 0)),
    'creel': place(build_creel(), (-2.3, 15.4, 0)),
    'bread_loaf': place(build_loaf(), (-1.9, 16.6, 0.6)),
    'bobber': place(build_bobber(), (6.0, 6.0, 0)),
    'bread': place(build_bread(), (6.2, 6.0, 0.03)),
    'hook': place(build_hook(), (6.4, 6.0, 0.05)),
}
for o in objs.values():
    for p in o.data.polygons:
        p.use_smooth = False

export_glb('props.glb')

if '--no-preview' not in sys.argv:
    render('props-overview', target=(1.5, 12, -0.5), view='three', ortho=16, size=(1024, 768))
    render('props-pier-top', target=(0, 9, 0), view='top', ortho=20, size=(768, 1024))
    render('props-pier-side', target=(0, 9, -1.8), view='side', ortho=20, size=(1024, 512))
    render('props-dock', target=(0, 15.5, 0), view='three', ortho=9, size=(1024, 768))
    render('props-boat', target=(5.0, 15.5, -0.7), view='three', ortho=4, size=(768, 640))
    render('props-small', target=(-2.0, 16.0, 0.35), view='three', ortho=1.8, size=(768, 640))
    render('props-tiny', target=(6.2, 6.0, 0.02), view='three', ortho=0.28, size=(768, 512))
