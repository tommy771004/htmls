# 珊瑚灣垂釣（201）：海底與島嶼自然物 → blender/out/reef.glb
# 靜態網格：coral_branch / coral_brain / coral_fan / coral_tube / coral_plate / rock_a / rock_b / rock_c /
#           shell / starfish / palm / grass（原點在底部中心）
# 骨架：seaweed_rig + 蒙皮網格 seaweed（骨頭 seaweed_0～3，動作 seaweed_sway 3.0 s 循環）
# 執行：/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P blender/reef.py
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *
from common import _active
import random

reset()

# ---------- 調色盤（SPEC） ----------
PINK, APRICOT, LILAC, CREAM = '#f4a196', '#f7c08f', '#c8a9d6', '#f6e3a1'
KELP, KELP_D = '#7fb58a', '#5e9670'
WOOD, WOOD_OLD, WOOD_D = '#c49a6c', '#a5805c', '#7d5f45'
STRAW, STRAW_D = '#e8c983', '#c9a35f'


def M(name, color, rough=0.9, two_sided=False):
    m = mat(name, color, rough)
    m.use_backface_culling = not two_sided
    return m


# 珊瑚：主色＋略深的陰影色＋淺色尖端。珊瑚只會出現在水下，src/underwater.js 的吸收染色把紅色乘到
# 約 0.6～0.7、綠藍約 0.9，再混一層青色散射與水面，SPEC 原色直接用會變成橄欖綠／灰褐／藍灰。
# 所以底色是「預先補償」過的：以水深約 1.8 m 的吸收係數反除 SPEC 色（同族一起正規化，保留深淺層次），
# 再在遊戲裡逐色量測微調（粉、杏加藍壓綠，深處才不會轉成灰綠；丁香加重紅藍，扇珊瑚是細格網、混到的水色最多）。
# 乾燥環境（tools/view.mjs）看起來會偏暖偏豔，水下才是 SPEC 的粉 #f4a196／杏 #f7c08f／丁香 #c8a9d6／奶油 #f6e3a1。
m_pink = M('reef_pink', '#ff8090')           # 目標 PINK
m_pink_d = M('reef_pink_deep', '#e87080')    # 目標 #e08c85
m_apri = M('reef_apricot', '#ff9a7a')        # 目標 APRICOT
m_apri_d = M('reef_apricot_deep', '#f8886a') # 目標 #e3a57a
m_brain_hi = M('reef_brain_ridge', '#ffa880')  # 目標 #f9cf9c
m_lilac = M('reef_lilac', '#e68cf0', two_sided=True)  # 目標 LILAC
m_lilac_d = M('reef_lilac_deep', '#cc74dc')  # 目標 #b392c4
m_cream = M('reef_cream', '#ffc092')         # 目標 CREAM（管壁、桌珊瑚內圈）
m_tip = M('reef_tip', '#ffd6ba')             # 目標 #fbeed0
# 礁石：暖灰＋暗苔（水下會被染青、提亮，淺色會變成半透明海玻璃，所以壓一階、不帶青）
m_rock = M('reef_rock', '#8f8a7e')
m_rock_d = M('reef_rock_shade', '#767064')
m_moss = M('reef_moss', '#6b7e66')
# 小物
m_shell = M('reef_shell', '#f8e6cf')
m_shell_s = M('reef_shell_stripe', '#eab3a4')
m_star = M('reef_star', '#f2a88a')
# 椰子樹／草／海草
m_trunk = M('reef_trunk', WOOD)
m_trunk_d = M('reef_trunk_ring', WOOD_OLD)
m_nut = M('reef_coconut', '#8a6a4c')
m_leaf = M('reef_leaf', KELP, two_sided=True)
m_leaf_d = M('reef_leaf_dark', KELP_D, two_sided=True)
m_straw = M('reef_straw', STRAW_D, two_sided=True)
m_weed = M('reef_weed', '#93c49a', two_sided=True)
m_weed_d = M('reef_weed_dark', '#78ad86', two_sided=True)
m_hold = M('reef_holdfast', '#a99f8e')


# ---------- 網格組裝器 ----------
class MB:
    """累積頂點與面（每面帶材質索引），最後一次建成一個物件。"""

    def __init__(self):
        self.v, self.f, self.mi = [], [], []

    def vert(self, p):
        self.v.append(tuple(p))
        return len(self.v) - 1

    def face(self, idx, mi=0):
        self.f.append(list(idx))
        self.mi.append(mi)

    def build(self, name, mats, fix_normals=True):
        o = mesh_from(name, self.v, self.f)
        for m in mats:
            o.data.materials.append(m)
        for p, mi in zip(o.data.polygons, self.mi):
            p.material_index = mi
        o.data.validate()
        if fix_normals:
            _active(o)
            bpy.ops.object.mode_set(mode='EDIT')
            bpy.ops.mesh.select_all(action='SELECT')
            bpy.ops.mesh.normals_make_consistent(inside=False)
            bpy.ops.object.mode_set(mode='OBJECT')
        return o


def frames(path):
    """沿路徑的平行傳輸座標框（t, n, b）。"""
    P = [Vector(p) for p in path]
    T = []
    for i in range(len(P)):
        a, b = P[max(i - 1, 0)], P[min(i + 1, len(P) - 1)]
        T.append((b - a).normalized())
    up = Vector((0, 0, 1)) if abs(T[0].z) < 0.9 else Vector((1, 0, 0))
    n = T[0].cross(up).cross(T[0]).normalized()
    out = []
    for i, t in enumerate(T):
        if i:
            n = T[i - 1].rotation_difference(t) @ n
            n = (n - t * n.dot(t)).normalized()
        out.append((P[i], t, n, t.cross(n)))
    return out


def loft(mb, path, radii, sides, mi, cap0=True, cap1='point', mi_cap=None, phase=0.0, squash=1.0):
    """沿 path 擠出低多邊形管子。cap1：'point'（尖端）/'flat'/None。回傳尾端環的頂點索引。"""
    rings = []
    for (p, t, n, b), r in zip(frames(path), radii):
        ring = []
        for j in range(sides):
            a = phase + 2 * math.pi * j / sides
            ring.append(mb.vert(p + (n * math.cos(a) * squash + b * math.sin(a)) * r))
        rings.append(ring)
    for i in range(len(rings) - 1):
        A, B = rings[i], rings[i + 1]
        for j in range(sides):
            k = (j + 1) % sides
            mb.face([A[j], A[k], B[k], B[j]], mi)
    mc = mi if mi_cap is None else mi_cap
    if cap0:
        mb.face(list(reversed(rings[0])), mi)
    if cap1 == 'point':
        p, t, _, _ = frames(path)[-1]
        tip = mb.vert(p + t * radii[-1] * 1.2)
        R = rings[-1]
        for j in range(sides):
            mb.face([R[j], R[(j + 1) % sides], tip], mc)
    elif cap1 == 'flat':
        mb.face(rings[-1], mc)
    return rings[-1]


def blob(mb, center, radius, mi, subdiv=1, scale=(1, 1, 1), seed=0, rough=0.12):
    """小顆低多邊形球（icosphere 頂點直接寫進 MB）。"""
    rnd = random.Random(seed)
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=subdiv, radius=radius)
    base = len(mb.v)
    cache = {}
    for v in bm.verts:
        k = tuple(round(c, 5) for c in v.co)
        if k not in cache:
            cache[k] = 1 + rnd.uniform(-rough, rough)
        c = v.co * cache[k]
        mb.vert(Vector(center) + Vector((c.x * scale[0], c.y * scale[1], c.z * scale[2])))
    for f in bm.faces:
        mb.face([base + v.index for v in f.verts], mi)
    bm.free()


def finish(o, loc, jit=0.0, seed=1):
    """平面著色、抖動、原點在底部中心（物件本身已在原點建模），再搬到排版位置。"""
    if jit:
        jitter(o, jit, seed)
    flat(o)
    o.location = loc
    o.data.name = o.name
    return o


rnd = random.Random(201)

# =====================================================================
# coral_branch：鹿角珊瑚（高 0.7 m）。粉色分枝、奶油色尖端，俯視看到一簇亮點。
# =====================================================================


def coral_branch():
    """粗短的鹿角分枝：每枝兩段、四角截面，末段是奶油色尖端（不另加小球，省面數）。"""
    mb = MB()
    r = random.Random(7)

    def grow(p0, d, length, rad, depth):
        d = d.normalized()
        path, radii = [p0], [rad]
        p = p0.copy()
        for s in range(2):
            d = (d + Vector((r.uniform(-0.1, 0.1), r.uniform(-0.1, 0.1), 0.12))).normalized()
            p = p + d * (length / 2)
            path.append(p.copy())
            radii.append(rad * (1 - 0.16 * (s + 1)))
        if depth == 0:
            # 尖端：最後一小段換奶油色，圓鈍收尾
            loft(mb, path, radii, 5, 0, cap0=True, cap1=None, phase=r.uniform(0, 1))
            tip = [p, p + d * rad * 1.1]
            loft(mb, tip, [radii[-1] * 1.08, radii[-1] * 0.85], 5, 1, cap0=False, cap1='point', phase=r.uniform(0, 1))
            return
        loft(mb, path, radii, 5, 0, cap0=True, cap1='flat', phase=r.uniform(0, 1))
        n = 2
        a0 = r.uniform(0, math.pi)
        for k in range(n):
            a = a0 + math.pi * k + r.uniform(-0.4, 0.4)
            side = Vector((math.cos(a), math.sin(a), 0))
            nd = (d * 0.7 + side * 0.6 + Vector((0, 0, 0.2))).normalized()
            grow(p - d * 0.02, nd, length * 0.8, radii[-1] * 0.92, depth - 1)

    # 底座小丘（較深的粉色）
    blob(mb, (0, 0, 0.02), 0.15, 2, subdiv=1, scale=(1.25, 1.2, 0.45), seed=3)
    for k in range(5):
        a = 2 * math.pi * k / 5 + r.uniform(-0.3, 0.3)
        tilt = 0.55 if k else 0.1
        d = Vector((math.cos(a) * tilt, math.sin(a) * tilt, 1))
        grow(Vector((math.cos(a) * 0.06, math.sin(a) * 0.06, 0.03)), d, 0.26 if k else 0.3, 0.06 if k else 0.07, 2 if k < 3 else 1)
    o = mb.build('coral_branch', [m_pink, m_tip, m_pink_d])
    # 把整體縮放到高 0.7 m
    zmax = max(v.co.z for v in o.data.vertices)
    zmin = min(v.co.z for v in o.data.vertices)
    for v in o.data.vertices:
        v.co.z -= zmin
    s = 0.7 / (zmax - zmin)
    o.data.transform(Matrix.Scale(s, 4))
    return o


# =====================================================================
# coral_brain：腦珊瑚（直徑 0.8 m）。單一杏色深的低面數圓頂，上面貼四條連續蜿蜒的淺色脊（三角截面、
# 實際凸起），俯視是幾道平行的波浪長溝，不再是逐面交錯的雙色格。
# =====================================================================


def coral_brain():
    mb = MB()
    R, H = 0.4, 0.31
    NR, NA = 5, 18

    def surf(x, y):
        rr = min(math.hypot(x, y), R * 0.999)
        z = H * max(0.0, 1 - (rr / R) ** 2) ** 0.5
        n = Vector((x / R ** 2, y / R ** 2, z / H ** 2)).normalized()
        return Vector((x, y, z)), n

    def face_out(idx, mi, inside):
        """依內部參考點決定繞序，確保面朝外（開口網格不靠自動修正）。"""
        a, b, c = (Vector(mb.v[i]) for i in idx[:3])
        cen = sum((Vector(mb.v[i]) for i in idx), Vector()) / len(idx)
        if (b - a).cross(c - a).dot(cen - Vector(inside)) < 0:
            idx = list(reversed(idx))
        mb.face(idx, mi)

    # 圓頂：環越靠外越密，側面是圓弧
    grid = {}
    for i in range(1, NR + 1):
        rr = R * math.sin(0.5 * math.pi * i / NR)
        for j in range(NA):
            th = 2 * math.pi * (j + (0.5 if i % 2 else 0)) / NA
            grid[i, j] = mb.vert(surf(math.cos(th) * rr, math.sin(th) * rr)[0] * Vector((1, 1, 1 if i < NR else 0)))   # 最外圈 z=0 貼地
    top = mb.vert((0, 0, H))
    O = (0, 0, 0.02)
    for j in range(NA):
        face_out([top, grid[1, j], grid[1, (j + 1) % NA]], 1, O)
    for i in range(1, NR):
        for j in range(NA):
            k = (j + 1) % NA
            if i % 2 == 0:
                t1, t2 = [grid[i, j], grid[i + 1, j], grid[i, k]], [grid[i, k], grid[i + 1, j], grid[i + 1, k]]
            else:
                t1, t2 = [grid[i, j], grid[i + 1, k], grid[i, k]], [grid[i, j], grid[i + 1, j], grid[i + 1, k]]
            face_out(t1, 1, O)
            face_out(t2, 1, O)

    W, HT, SINK = 0.062, 0.04, 0.012   # 脊寬、脊高、底邊埋進圓頂的深度（低面數圓頂的弦會凹進去）

    def ridge(pts, closed):
        """沿曲線貼一條三角截面的凸脊：左底、脊頂、右底。"""
        n = len(pts)
        rows = []
        for j in range(n):
            p, nr = surf(*pts[j])
            e = 1.0 if closed else min(1.0, 0.25 + 0.75 * min(j, n - 1 - j) / 2)   # 開口端漸細沒入圓頂
            q0 = surf(*pts[(j - 1) % n if closed else max(j - 1, 0)])[0]
            q1 = surf(*pts[(j + 1) % n if closed else min(j + 1, n - 1)])[0]
            side = (q1 - q0).cross(nr).normalized()
            rows.append((mb.vert(p + side * W / 2 * e - nr * SINK), mb.vert(p + nr * (HT * e - SINK * (1 - e))), mb.vert(p - side * W / 2 * e - nr * SINK), p - nr * 0.03))
        for j in range(n if closed else n - 1):
            a, b = rows[j], rows[(j + 1) % n]
            inside = (a[3] + b[3]) / 2
            face_out([a[0], b[0], b[1], a[1]], 0, inside)
            face_out([a[1], b[1], b[2], a[2]], 0, inside)
        if not closed:
            for e, nb in ((rows[0], rows[1]), (rows[-1], rows[-2])):   # 端蓋：參考點取往曲線內側的鄰列
                face_out([e[0], e[1], e[2]], 0, nb[3])

    # 四條平行的蜿蜒脊：橫越圓頂，同一波長、相位逐條微移（彼此不相撞），再整體弓成弧，
    # 像腦珊瑚一道道長溝；兩端停在圓頂側面。
    RL = 0.35
    for c, ph in ((-0.225, 0.0), (-0.075, 0.55), (0.075, 1.1), (0.225, 1.65)):
        half = math.sqrt(max(RL * RL - c * c, 0.0)) - 0.03
        n = max(10, int(half * 2 / 0.02))
        pts = []
        for j in range(n + 1):
            x = -half + 2 * half * j / n
            y = c + 0.036 * math.sin(2 * math.pi * x / 0.27 + ph) + 0.05 * (x / RL) ** 2
            if math.hypot(x, y) > RL:   # 弓起後若跑出範圍就往內收
                k = RL / math.hypot(x, y)
                x, y = x * k, y * k
            pts.append((x, y))
        ridge(pts, False)

    return mb.build('coral_brain', [m_brain_hi, m_apri_d], fix_normals=False)


# =====================================================================
# coral_fan：扇珊瑚（高 0.9 m）。彎曲的網狀薄片＋放射主肋，兩片錯開，俯視是兩道弧。
# =====================================================================


def fan_sheet(mb, origin, yaw, height, spread, curve, tilt, seed):
    """極座標格：每格內縮挖洞，留下網目框。薄片沿著水平彎曲（curve＝彎曲半徑倒數）。"""
    r = random.Random(seed)
    NR, NA = 5, 8
    rot = Matrix.Rotation(math.radians(yaw), 3, 'Z')
    tilt_m = Matrix.Rotation(math.radians(tilt), 3, 'X')

    def P(rho, ang):
        # 扇面在 xz 平面，x 方向沿弧彎向 -y（往前凹）
        x = rho * math.sin(ang) * spread
        z = rho * math.cos(ang) * height
        y = curve * x * x
        return origin + rot @ (tilt_m @ Vector((x, y, z)))

    grid = {}
    for i in range(NR + 1):
        rho = 0.12 + (1 - 0.12) * i / NR
        for j in range(NA + 1):
            ang = math.radians(-62 + 124 * j / NA)
            # 邊緣不規則：外緣半徑抖一點
            edge = 1 - 0.08 * r.random() if i == NR else 1
            grid[i, j] = P(rho * edge, ang)
    for i in range(NR):
        for j in range(NA):
            q = [grid[i, j], grid[i, j + 1], grid[i + 1, j + 1], grid[i + 1, j]]
            c = sum(q, Vector()) / 4
            ins = 0.62 if (i + j) % 3 else 0.5
            inner = [c + (p - c) * ins for p in q]
            ov = [mb.vert(p) for p in q]
            iv = [mb.vert(p) for p in inner]
            for k in range(4):
                mb.face([ov[k], ov[(k + 1) % 4], iv[(k + 1) % 4], iv[k]], 0)
    # 放射主肋（深色、略粗），從基部長出
    for j in (0, 2, 4, 6, 8):
        ang = math.radians(-62 + 124 * j / NA)
        path = [P(rho, ang) for rho in (0.0, 0.35, 0.7, 0.98)]
        loft(mb, path, [0.022, 0.016, 0.012, 0.008], 4, 1, cap0=False, cap1='point')


def coral_fan():
    mb = MB()
    fan_sheet(mb, Vector((0, 0, 0.0)), 0, 0.9, 0.62, -0.55, 8, 11)
    fan_sheet(mb, Vector((0.08, 0.06, 0.0)), 55, 0.62, 0.42, -0.6, -10, 12)
    blob(mb, (0.02, 0.02, 0.02), 0.08, 1, subdiv=1, scale=(1.3, 1.1, 0.6), seed=5)
    return mb.build('coral_fan', [m_lilac, m_lilac_d], fix_normals=False)


# =====================================================================
# coral_tube：管珊瑚叢（高 0.5 m）。奶油色開口管，管口內側是粉色，俯視是一圈圈的環。
# =====================================================================


def coral_tube():
    mb = MB()
    r = random.Random(21)
    tubes = [(0, 0, 0.5, 0.075)]
    for k in range(8):
        a = 2 * math.pi * k / 8 + r.uniform(-0.25, 0.25)
        d = 0.13 + r.uniform(0, 0.07)
        tubes.append((math.cos(a) * d, math.sin(a) * d, 0.22 + 0.22 * r.random(), 0.05 + 0.02 * r.random()))
    S = 7
    for x, y, h, rad in tubes:
        base = Vector((x, y, 0))
        lean = Vector((x, y, 0)) * 0.7
        top = base + Vector((0, 0, h)) + lean
        mid = base.lerp(top, 0.5) + lean * -0.2
        path = [base, mid, top]
        radii = [rad * 0.85, rad * 0.95, rad * 1.08]
        fr = frames(path)
        outer = []
        for (p, t, n, b), rr in zip(fr, radii):
            outer.append([mb.vert(p + (n * math.cos(2 * math.pi * j / S) + b * math.sin(2 * math.pi * j / S)) * rr) for j in range(S)])
        for i in range(len(outer) - 1):
            for j in range(S):
                k = (j + 1) % S
                mb.face([outer[i][j], outer[i][k], outer[i + 1][k], outer[i + 1][j]], 0)
        # 管口：外緣→內緣（平面環）→ 往內下凹的內壁 → 深處底
        p, t, n, b = fr[-1]
        inner_r = radii[-1] * 0.62
        inner = [mb.vert(p + (n * math.cos(2 * math.pi * j / S) + b * math.sin(2 * math.pi * j / S)) * inner_r) for j in range(S)]
        deep = [mb.vert(p - t * 0.07 + (n * math.cos(2 * math.pi * j / S) + b * math.sin(2 * math.pi * j / S)) * inner_r * 0.85) for j in range(S)]
        for j in range(S):
            k = (j + 1) % S
            mb.face([outer[-1][j], outer[-1][k], inner[k], inner[j]], 2)
            mb.face([inner[j], inner[k], deep[k], deep[j]], 1)
        mb.face(deep, 1)   # 管底朝上（從管口往下看得到）
    blob(mb, (0, 0, 0.0), 0.2, 3, subdiv=1, scale=(1.2, 1.2, 0.3), seed=8)
    o = mb.build('coral_tube', [m_cream, m_pink, m_tip, m_apri_d], fix_normals=False)
    # 管口內壁面朝內是預期的，不跑 normals_make_consistent；外壁方向由環序保證朝外
    return o


# =====================================================================
# coral_plate：桌珊瑚（直徑 1.0 m）。短柄＋寬平台，頂面同心色帶與奶油色小水螅。
# =====================================================================


def coral_plate():
    mb = MB()
    r = random.Random(33)
    N = 13
    # 柄
    loft(mb, [(0, 0, 0), (0.02, 0, 0.14), (0.0, 0.01, 0.27)], [0.11, 0.075, 0.09], 6, 2, cap0=True, cap1=None)

    def plate(cx, cy, z, R, mi_top, mi_top2, seed):
        rr = random.Random(seed)
        rad = [R * (0.86 + 0.14 * rr.random()) for _ in range(N)]
        ang = [2 * math.pi * k / N for k in range(N)]
        rings = []
        # 頂面：中心點 → 0.35R → 0.7R → 外緣（略往上翹）；底面：外緣下方 → 中心
        prof = [(0.35, 0.03), (0.7, 0.045), (1.0, 0.07)]
        c_top = mb.vert((cx, cy, z + 0.02))
        for f, dz in prof:
            rings.append([mb.vert((cx + math.cos(a) * rd * f, cy + math.sin(a) * rd * f, z + dz)) for a, rd in zip(ang, rad)])
        under = [mb.vert((cx + math.cos(a) * rd * 0.98, cy + math.sin(a) * rd * 0.98, z + 0.02)) for a, rd in zip(ang, rad)]
        under2 = [mb.vert((cx + math.cos(a) * rd * 0.4, cy + math.sin(a) * rd * 0.4, z - 0.05)) for a, rd in zip(ang, rad)]
        c_bot = mb.vert((cx, cy, z - 0.06))
        for k in range(N):
            j = (k + 1) % N
            mb.face([c_top, rings[0][k], rings[0][j]], mi_top)
            mb.face([rings[0][k], rings[1][k], rings[1][j], rings[0][j]], mi_top2)
            mb.face([rings[1][k], rings[2][k], rings[2][j], rings[1][j]], mi_top)
            mb.face([rings[2][k], under[k], under[j], rings[2][j]], 2)
            mb.face([under[k], under2[k], under2[j], under[j]], 2)
            mb.face([under2[k], c_bot, under2[j]], 2)
        # 頂面小水螅
        for k in range(10):
            a = rr.uniform(0, 2 * math.pi)
            d = rr.uniform(0.15, 0.8) * R
            blob(mb, (cx + math.cos(a) * d, cy + math.sin(a) * d, z + 0.045 + 0.02 * d / R), 0.022, 3, subdiv=1, scale=(1, 1, 0.7), seed=k + seed)

    plate(0.0, 0.0, 0.3, 0.5, 0, 1, 41)
    plate(0.24, -0.18, 0.16, 0.24, 1, 0, 42)
    return mb.build('coral_plate', [m_pink, m_apri, m_pink_d, m_cream])


# =====================================================================
# rock_a / rock_b / rock_c：低多邊形礁石，頂面局部長苔。
# =====================================================================


def rock(name, size, height, seed, subdiv=2):
    r = random.Random(seed)
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=subdiv, radius=1.0)
    ph = [r.uniform(0, 6) for _ in range(6)]
    for v in bm.verts:
        c = v.co
        n = 1 + 0.13 * math.sin(2.3 * c.x + ph[0]) * math.sin(2.1 * c.y + ph[1]) + 0.09 * math.sin(4.1 * c.z + ph[2]) \
            + 0.06 * math.sin(5.3 * (c.x + c.y) + ph[3])
        p = c * n
        z = (p.z + 0.35) / 1.35          # 底部切平
        v.co = Vector((p.x * size[0] / 2, p.y * size[1] / 2, max(z, 0) * height))
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.004)
    # 一刀斜切的平面讓它像碎岩
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = link(bpy.data.objects.new(name, me))
    for m in (m_rock, m_rock_d, m_moss):
        o.data.materials.append(m)
    for p in o.data.polygons:
        nz = p.normal.z
        cz = p.center.z / height
        if nz > 0.7 and cz > 0.5 and math.sin(p.center.x * 7 + ph[4]) + math.sin(p.center.y * 6 + ph[5]) > -0.1:
            p.material_index = 2
        elif cz < 0.3 or (nz < 0.2 and r.random() < 0.35):
            p.material_index = 1
    jitter(o, 0.015 * max(size), seed)
    for v in o.data.vertices:
        v.co.z = max(v.co.z, 0)
    return o


# =====================================================================
# shell：扇貝（0.15 m）；starfish：海星（0.25 m）
# =====================================================================


def shell():
    mb = MB()
    NA, NR = 9, 3
    R = 0.075
    g = {}
    center = mb.vert((0, -0.035, 0.012))
    for i in range(1, NR + 1):
        rho = i / NR
        for j in range(NA + 1):
            a = math.radians(-72 + 144 * j / NA)
            rib = 0.006 * (1 if j % 2 == 0 else -0.3) * rho
            x = math.sin(a) * R * rho
            y = -0.035 + math.cos(a) * R * rho * 1.15
            z = 0.012 + 0.03 * (1 - rho * rho) + rib + 0.01 * rho
            g[i, j] = mb.vert((x, y, z))
    rim = {j: mb.vert((math.sin(math.radians(-72 + 144 * j / NA)) * R * 1.02, -0.035 + math.cos(math.radians(-72 + 144 * j / NA)) * R * 1.17, 0)) for j in range(NA + 1)}
    for j in range(NA):
        st = j % 2
        mb.face([center, g[1, j + 1], g[1, j]], st)
        for i in range(1, NR):
            mb.face([g[i, j], g[i, j + 1], g[i + 1, j + 1], g[i + 1, j]], st)
        mb.face([g[NR, j], g[NR, j + 1], rim[j + 1], rim[j]], st)
    # 側邊與底
    mb.face([center, g[1, 0], g[2, 0], g[3, 0], rim[0]], 0)
    mb.face([rim[NA], g[3, NA], g[2, NA], g[1, NA], center], 0)
    # 鉸合處的兩片小耳
    for sx in (-1, 1):
        a = mb.vert((0, -0.04, 0.006)); b = mb.vert((sx * 0.02, -0.043, 0.005)); c = mb.vert((sx * 0.017, -0.026, 0.012)); d = mb.vert((0, -0.03, 0.015))
        mb.face([a, b, c, d] if sx > 0 else [d, c, b, a], 0)
    o = mb.build('shell', [m_shell, m_shell_s], fix_normals=False)
    for v in o.data.vertices:
        v.co.y += 0.012
    return o


def starfish():
    mb = MB()
    R, r_in = 0.125, 0.04
    top = mb.vert((0, 0, 0.042))
    outer, ridge = [], []
    for k in range(10):
        a = math.pi / 2 + 2 * math.pi * k / 10
        rad = R if k % 2 == 0 else r_in
        z = 0.008 if k % 2 == 0 else 0.012
        outer.append(mb.vert((math.cos(a) * rad, math.sin(a) * rad, z)))
        if k % 2 == 0:
            ridge.append(mb.vert((math.cos(a) * R * 0.55, math.sin(a) * R * 0.55, 0.03)))
    bottom = [mb.vert((mb.v[i][0] * 0.97, mb.v[i][1] * 0.97, 0)) for i in outer]
    for k in range(10):
        j = (k + 1) % 10
        if k % 2 == 0:
            rg = ridge[k // 2]
            mb.face([top, rg, outer[j]], 0)
            mb.face([rg, outer[k], outer[j]], 0)
            prev = (k - 1) % 10
            mb.face([top, outer[prev], rg], 0)
            mb.face([outer[prev], outer[k], rg], 0)
        mb.face([outer[k], bottom[k], bottom[j], outer[j]], 0)
    mb.face(list(reversed(bottom)), 0)
    # 背上的小疣點
    for k in range(5):
        a = math.pi / 2 + 2 * math.pi * k / 5
        for f in (0.35, 0.72):
            blob(mb, (math.cos(a) * R * f, math.sin(a) * R * f, 0.036 - 0.02 * f), 0.009, 1, subdiv=1, seed=k)
    blob(mb, (0, 0, 0.044), 0.012, 1, subdiv=1, seed=9)
    o = mb.build('starfish', [m_star, m_tip])
    return o


# =====================================================================
# palm：椰子樹（約 5 m）。分節彎曲樹幹、7 片羽狀葉、3 顆椰子。
# =====================================================================


def palm():
    mb = MB()
    H, NSEG = 4.45, 9
    lean = 0.85

    def trunk_pt(t):
        return Vector((lean * (2 * t - t * t), 0.12 * math.sin(t * 3), H * t))

    for s in range(NSEG):
        t0, t1 = s / NSEG, (s + 1) / NSEG
        r0 = 0.17 - 0.06 * t0
        r1 = 0.17 - 0.06 * t1
        path = [trunk_pt(t0), trunk_pt(t0 + 0.25 / NSEG), trunk_pt(t1)]
        # 每節下緣外擴（節環），上緣收細，做出一節一節的輪廓
        loft(mb, path, [r0 * 1.16, r0 * 1.02, r1 * 0.9], 6, 1 if s % 2 else 0, cap0=True, cap1='flat', phase=0.3 * s)
    crown = trunk_pt(1.0)
    blob(mb, crown + Vector((0, 0, 0.05)), 0.2, 1, subdiv=1, scale=(1, 1, 0.8), seed=4)
    # 椰子
    for k, a in enumerate((0.3, 2.4, 4.4)):
        blob(mb, crown + Vector((math.cos(a) * 0.17, math.sin(a) * 0.17, -0.16 - 0.04 * k)), 0.11, 2, subdiv=1, seed=10 + k)

    r = random.Random(5)
    NL = 7
    for L_i in range(NL):
        az = 2 * math.pi * L_i / NL + r.uniform(-0.2, 0.2)
        d = Vector((math.cos(az), math.sin(az), 0))
        side = d.cross(Vector((0, 0, 1)))
        L = r.uniform(1.75, 2.15)
        rise = r.uniform(0.45, 0.6)
        mi = 3 if L_i % 2 else 4
        NS = 11
        pts = []
        for i in range(NS + 1):
            s = i / NS
            pts.append(crown + Vector((0, 0, 0.12)) + d * (L * s) + Vector((0, 0, L * (rise * s - 0.85 * s * s))))
        # 中肋（細條）
        for i in range(NS):
            a, b = pts[i], pts[i + 1]
            w = 0.022 * (1 - i / NS) + 0.006
            va, vb = mb.vert(a + side * w), mb.vert(a - side * w)
            vc, vd = mb.vert(b - side * w * 0.8), mb.vert(b + side * w * 0.8)
            mb.face([va, vb, vc, vd], 4)
        # 羽狀小葉：每段兩側各一片，向下垂成 V 字，往葉尖方向斜掃
        for i in range(1, NS):
            s = i / NS
            w = 0.42 * (math.sin(math.pi * min(1, s * 1.05)) ** 0.6) + 0.05
            a, b = pts[i], pts[min(i + 1, NS)]
            fwd = (b - a).normalized()
            for sg in (1, -1):
                tip = (a + b) / 2 + side * sg * w + fwd * w * 0.45 - Vector((0, 0, w * 0.45))
                v0, v1, v2 = mb.vert(a), mb.vert(b), mb.vert(tip)
                mb.face([v0, v1, v2] if sg > 0 else [v1, v0, v2], mi)
        # 葉尖
        mb.face([mb.vert(pts[-2] + side * 0.03), mb.vert(pts[-2] - side * 0.03), mb.vert(pts[-1] + d * 0.15 - Vector((0, 0, 0.05)))], mi)
    o = mb.build('palm', [m_trunk, m_trunk_d, m_nut, m_leaf, m_leaf_d], fix_normals=False)
    # 樹根（原點）在樹幹底中心：已經是 (0,0,0)
    return o


# =====================================================================
# grass：沙灘草叢（0.4 m），細長葉片從中心散開，夾雜幾根乾草色。
# =====================================================================


def grass():
    mb = MB()
    r = random.Random(17)
    NB = 13
    for k in range(NB):
        a = 2 * math.pi * k / NB + r.uniform(-0.25, 0.25)
        d = Vector((math.cos(a), math.sin(a), 0))
        side = d.cross(Vector((0, 0, 1)))
        h = r.uniform(0.26, 0.42)
        bend = r.uniform(0.25, 0.65)
        base = d * r.uniform(0.01, 0.05)
        w = r.uniform(0.022, 0.032)
        segs = 3
        verts = []
        for i in range(segs + 1):
            s = i / segs
            p = base + d * (bend * h * s * s) + Vector((0, 0, h * s - 0.25 * bend * h * s ** 3))
            if i == segs:
                verts.append([mb.vert(p)])
            else:
                ww = w * (1 - s * 0.7)
                verts.append([mb.vert(p - side * ww), mb.vert(p + side * ww)])
        mi = 2 if k in (3, 9) else (k % 2)
        for i in range(segs - 1):
            A, B = verts[i], verts[i + 1]
            mb.face([A[0], A[1], B[1], B[0]], mi)
        A = verts[segs - 1]
        mb.face([A[0], A[1], verts[segs][0]], mi)
    o = mb.build('grass', [m_leaf, m_leaf_d, m_straw], fix_normals=False)
    return o


# =====================================================================
# seaweed：海草（1.2 m，4 片細長葉），骨頭 seaweed_0～3，手動漸層權重，seaweed_sway 3.0 s 循環。
# =====================================================================


SW_H = 1.2
SW_BONES = 4


def seaweed_mesh():
    mb = MB()
    r = random.Random(23)
    blades = [(0.0, 1.18, 0.05), (1.7, 1.0, 0.045), (3.3, 0.88, 0.042), (4.8, 1.1, 0.048)]
    for k, (a, h, w) in enumerate(blades):
        base = Vector((math.cos(a) * 0.05, math.sin(a) * 0.05, 0.02))
        face_dir = a + math.pi / 2 + r.uniform(-0.4, 0.4)
        NS = 9
        rows = []
        for i in range(NS + 1):
            s = i / NS
            # 葉片微微外傾、帶一點蛇行，寬度中段最寬
            off = Vector((math.cos(a), math.sin(a), 0)) * (0.16 * s - 0.05 * s * s + 0.03 * math.sin(s * 7 + k))
            p = base + off + Vector((0, 0, h * s))
            tw = face_dir + 0.6 * s
            sd = Vector((math.cos(tw), math.sin(tw), 0))
            ww = w * (0.45 + 0.9 * math.sin(math.pi * min(s * 1.15, 1)) ** 0.7) * (1 - 0.85 * s ** 3)
            if i == NS:
                rows.append([mb.vert(p)])
            else:
                rows.append([mb.vert(p - sd * ww), mb.vert(p + sd * ww)])
        mi = k % 2
        for i in range(NS - 1):
            A, B = rows[i], rows[i + 1]
            mb.face([A[0], A[1], B[1], B[0]], mi)
        mb.face([rows[NS - 1][0], rows[NS - 1][1], rows[NS][0]], mi)
    blob(mb, (0, 0, 0.02), 0.07, 2, subdiv=1, scale=(1.3, 1.2, 0.6), seed=2)
    o = mb.build('seaweed', [m_weed, m_weed_d, m_hold], fix_normals=False)
    flat(o)
    return o


def seaweed():
    seg = SW_H / SW_BONES
    bones = []
    for i in range(SW_BONES):
        bones.append((f'seaweed_{i}', (0, 0, i * seg), (0, 0, (i + 1) * seg), f'seaweed_{i - 1}' if i else None))
    arm = armature('seaweed_rig', bones)
    o = seaweed_mesh()
    # 手動漸層權重：以骨頭中點為節點，沿高度線性內插
    vgs = [o.vertex_groups.new(name=f'seaweed_{i}') for i in range(SW_BONES)]
    centers = [(i + 0.5) * seg for i in range(SW_BONES)]
    for v in o.data.vertices:
        z = v.co.z
        if z <= centers[0]:
            w = {0: 1.0}
        elif z >= centers[-1]:
            w = {SW_BONES - 1: 1.0}
        else:
            i = int((z - centers[0]) // seg)
            f = (z - centers[i]) / seg
            w = {i: 1 - f, i + 1: f}
        for i, wt in w.items():
            if wt > 0:
                vgs[i].add([v.index], wt, 'REPLACE')
    o.parent = arm
    m = o.modifiers.new('Armature', 'ARMATURE')
    m.object = arm

    # 擺動：越往上擺幅越大，相位往上遞延（像波從底部傳上去），X 主擺、Z 副擺畫出橢圓。
    begin_action(arm, 'seaweed_sway')
    AX = [6, 10, 15, 20]
    AZ = [4, 7, 10, 13]
    N = 90
    for f in range(0, N + 1, 6):
        ph = 2 * math.pi * f / N
        rots = {}
        for i in range(SW_BONES):
            x = 2.0 + AX[i] * math.sin(ph - 0.55 * i)
            z = AZ[i] * math.sin(ph + 1.4 - 0.55 * i) + 2.5 * math.sin(2 * ph - 0.8 * i) * (i / 3)
            rots[f'seaweed_{i}'] = (x, 0, z)
        pose(arm, f, rots)   # 從第 0 格開始：glTF 時間 0～3.0 s，不會多出 1 格
    end_action(arm, cyclic=True)
    stash_actions(arm, ['seaweed_sway'])
    return arm, o


# =====================================================================
# 組裝與匯出（排版位置只為了預覽，遊戲會重設根節點）
# =====================================================================

objs = {}
objs['coral_branch'] = finish(coral_branch(), (8.0, 0, 0), 0.006, 1)
objs['coral_brain'] = finish(coral_brain(), (1.5, 0, 0), 0.003, 2)
objs['coral_fan'] = finish(coral_fan(), (3.0, 0, 0), 0.004, 3)
objs['coral_tube'] = finish(coral_tube(), (4.5, 0, 0), 0.004, 4)
objs['coral_plate'] = finish(coral_plate(), (6.2, 0, 0), 0.008, 5)
objs['rock_a'] = finish(rock('rock_a', (1.4, 1.1), 0.75, 61, subdiv=3), (0, 2.5, 0))
objs['rock_b'] = finish(rock('rock_b', (0.95, 0.8), 0.72, 62, subdiv=3), (1.8, 2.5, 0))
objs['rock_c'] = finish(rock('rock_c', (0.66, 0.52), 0.34, 63, subdiv=2), (3.2, 2.5, 0))
objs['shell'] = finish(shell(), (4.3, 2.5, 0), 0.001, 6)
objs['starfish'] = finish(starfish(), (5.0, 2.5, 0), 0.002, 7)
objs['grass'] = finish(grass(), (6.0, 2.5, 0), 0.004, 8)
objs['palm'] = finish(palm(), (9.5, 1.0, 0), 0.01, 9)
for v in objs['palm'].data.vertices:   # 樹幹起點沿傾斜方向，底環會一邊入沙一邊懸空：壓平到 z=0
    if v.co.z < 0.12:
        v.co.z = 0.0
arm, weed = seaweed()
# 骨架留在原點：蒙皮網格的頂點才會是骨架本地座標（不帶排版位移）

for n, o in objs.items():
    zs = [v.co.z for v in o.data.vertices]
    xs = [v.co.x for v in o.data.vertices]
    ys = [v.co.y for v in o.data.vertices]
    print(f'{n:14s} x {min(xs):.2f}..{max(xs):.2f}  y {min(ys):.2f}..{max(ys):.2f}  z {min(zs):.2f}..{max(zs):.2f}  tris {sum(len(p.vertices) - 2 for p in o.data.polygons)}')

export_glb('reef.glb')

if os.environ.get('REEF_PREVIEW', '1') == '1':
  try:   # 預覽失敗（例如沒有 ffmpeg）不影響已匯出的 GLB，也不擋 npm run assets 的其他腳本
    render('reef-all-three', target=(4.5, 1.2, 0.5), view='three', ortho=10, size=(1200, 800))
    render('reef-all-game', target=(4.5, 1.2, 0.3), view='game', ortho=10, size=(1200, 800))
    sheet('reef-seaweed-sway', arm, 'seaweed_sway', [0, 15, 30, 45, 60, 75], target=(0, 0, 0.6), view='front', ortho=1.8, cell=220)
  except Exception as e:
    print('preview skipped:', e)
