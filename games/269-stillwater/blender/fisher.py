# 靜水釣遊（269）：坐在划艇中央坐板上的寬簷草帽漁夫 → blender/out/fisher.glb
# 執行：/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P blender/fisher.py
# 契約見 SPEC.md：骨架 fisher_rig、蒙皮網格 fisher（含草帽與釣竿，全部 bind_rigid）、九個動作。
#
# 座標：先在「角色座標」建模與解算（和 201 相同：角色面向 Blender −Y、左手在 +X，原點＝船的吃水線中心），
# 全部動作打完關鍵影格後，把骨架靜止姿勢與網格一起繞 Z 轉 180°，角色就面向 Blender +Y＝three −Z（船尾）。
# 骨頭的動畫是相對靜止姿勢的局部轉動，整副骨架一起轉不影響動畫。
# 船上的點（three 船本地座標）換到角色座標：TC(x, y, z) = (−x, z, y)。
#
# 動作的做法沿用 201：每個動作是「時間 → 姿勢規格」的函數，每一影格解一次（軀幹尤拉角＋兩節 IK＋竿的方向）後打鍵。
#  - 軀幹、頭：世界軸尤拉角（度）描述相對父骨的轉動（+X 前傾、+Y 往角色左倒、+Z 往角色左轉）。
#  - 手：IK 目標可以是「胸部靜止座標」的點（跟著身體走）、竿上的點（左手握捲線器）或世界座標的點（槳柄）。
#    握東西時讓「拳心」落在目標上（迭代修正掌心 → 拳心的偏移）。
#  - 腳：坐姿，腳踝固定在船底板上（世界座標），膝蓋往前上方。
#  - 划船動作的槳柄位置用 rowing.py（SPEC 的划槳公式），所以和遊戲裡由程式轉動的槳一致。
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *
import rowing
import math
from mathutils import Vector, Matrix, Quaternion, Euler

FPS = 30
scene = reset()

# ---------------- 材質（SPEC 調色盤） ----------------
SHIRT = mat('fisher_shirt', '#b5582f')
SHIRT_D = mat('fisher_shirt_dark', '#8f4426')
PANTS = mat('fisher_overalls', '#2f3f55')
PANTS_D = mat('fisher_overalls_dark', '#243245')
BOOT = mat('fisher_boots', '#3b4a3a')
BOOT_D = mat('fisher_boots_sole', '#2a3329')
SKIN = mat('fisher_skin', '#e2b08a')
BLUSH = mat('fisher_blush', '#dc8f72')
HAIR = mat('fisher_hair', '#4a3528')
INK = mat('fisher_ink', '#2a2620')
STRAW = mat('fisher_straw', '#d9b46a')
STRAW_D = mat('fisher_straw_dark', '#bf9853')
RIBBON = mat('hat_ribbon', '#7a2f2a')
BRASS = mat('fisher_brass', '#b08a4a', rough=0.45, metal=0.3)
CORK = mat('fisher_cork', '#c7a173')
CANE = mat('fisher_cane', '#d8b878', rough=0.6)
CANE_D = mat('fisher_cane_node', '#94643c')
SPOOL = mat('fisher_spool', '#e8e0cc')
for m_ in (STRAW, STRAW_D, RIBBON):
    m_.use_backface_culling = False


def TC(p):
    """three 船本地座標 → 角色座標（轉 180° 之前）。"""
    return Vector((-p[0], p[2], p[1]))


def mirror(v):
    return Vector((-v.x, v.y, v.z))


# ---------------- 骨架（靜止姿勢：坐在坐板上，雙臂自然下垂，竿從右手往正前方 −Y 水平伸出） ----------------
# 坐板頂 z = 0.30（three y），骨盆底貼坐板；身體比例沿用 201（Q 版），只是整體坐低 0.40。
DZ = -0.40
SH_L, EL_L, WR_L = Vector((0.20, 0.02, 1.19 + DZ)), Vector((0.222, 0.02, 0.92 + DZ)), Vector((0.236, 0.02, 0.67 + DZ))
HAND_OFF = 0.045
SH_R, EL_R, WR_R = mirror(SH_L), mirror(EL_L), mirror(WR_L)
HC_L = WR_L + (WR_L - EL_L).normalized() * HAND_OFF
HC_R = mirror(HC_L)                      # 右手掌中心＝握把＝rod_0 的 head
HIP_L = Vector((0.11, 0.02, 0.40))
KNEE_L = Vector((0.14, -0.33, 0.37))
ANK_L = Vector((0.155, -0.46, 0.035))
TOE = Vector((0, -0.12, -0.075))         # 腳踝 → 腳尖著地點（膠靴）
G = HC_R.copy()
ROD_SEG = [0.0, 0.50, 0.98, 1.43, 1.88]  # 握把往前的距離；握把後還有 0.22 m 竿尾，總長 2.1 m
BUTT = 0.22


def rp(d):
    return G + Vector((0, -d, 0))


RC = Vector((0, -0.065, -0.07))           # 捲線器中心（相對握把）＝ reel_crank 的 head
KNOB = Vector((0.068, -0.065, -0.112))    # 把手球（crank = 0 時在正下方）

BONES = [
    ('root', (0, 0, 0), (0, 0, 0.2), None),
    ('hips', (0, 0.02, 0.42), (0, 0.02, 0.52), 'root'),
    ('spine', (0, 0.02, 0.52), (0, 0.02, 0.66), 'hips'),
    ('chest', (0, 0.02, 0.66), (0, 0.02, 0.84), 'spine'),
    ('neck', (0, 0.02, 0.84), (0, 0.02, 0.92), 'chest'),
    ('head', (0, 0.02, 0.92), (0, 0.02, 1.22), 'neck'),
    ('upperarm_L', SH_L, EL_L, 'chest'), ('forearm_L', EL_L, WR_L, 'upperarm_L'),
    ('hand_L', WR_L, WR_L + (WR_L - EL_L).normalized() * 0.09, 'forearm_L'),
    ('upperarm_R', SH_R, EL_R, 'chest'), ('forearm_R', EL_R, WR_R, 'upperarm_R'),
    ('hand_R', WR_R, WR_R + (WR_R - EL_R).normalized() * 0.09, 'forearm_R'),
    ('thigh_L', HIP_L, KNEE_L, 'hips'), ('shin_L', KNEE_L, ANK_L, 'thigh_L'),
    ('foot_L', ANK_L, ANK_L + TOE, 'shin_L'),
    ('thigh_R', mirror(HIP_L), mirror(KNEE_L), 'hips'), ('shin_R', mirror(KNEE_L), mirror(ANK_L), 'thigh_R'),
    ('foot_R', mirror(ANK_L), mirror(ANK_L) + TOE, 'shin_R'),
    ('rod_0', rp(0), rp(ROD_SEG[1]), 'hand_R'), ('rod_1', rp(ROD_SEG[1]), rp(ROD_SEG[2]), 'rod_0'),
    ('rod_2', rp(ROD_SEG[2]), rp(ROD_SEG[3]), 'rod_1'), ('rod_3', rp(ROD_SEG[3]), rp(ROD_SEG[4]), 'rod_2'),
    ('rod_tip', rp(ROD_SEG[4]), rp(ROD_SEG[4] + 0.05), 'rod_3'),
    ('reel_crank', G + RC, G + RC + Vector((0.05, 0, 0)), 'rod_0'),
]
arm = armature('fisher_rig', [(n, tuple(h), tuple(t), p) for n, h, t, p in BONES])
for pb in arm.pose.bones:
    pb.rotation_mode = 'QUATERNION'
BN = [b[0] for b in BONES]

# ---------------- 網格工具（同 201） ----------------

def _perp(axis):
    a = axis.normalized()
    ref = Vector((1, 0, 0)) if abs(a.x) < 0.9 else Vector((0, 1, 0))
    u = (ref - a * ref.dot(a)).normalized()
    return u, a.cross(u).normalized()


def _fix_normals(o):
    import bmesh
    bm = bmesh.new()
    bm.from_mesh(o.data)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(o.data)
    bm.free()


def loft(name, material, rings, sides=8, axis=None, caps=(True, True), phase=0.5):
    """rings：[(中心, rx, ry), ...]；環面垂直於 axis（預設為頭尾中心的連線）。"""
    verts, faces = [], []
    cs = [Vector(c) for c, _, _ in rings]
    ax = Vector(axis) if axis else (cs[-1] - cs[0])
    u, v = _perp(ax)
    for c, (_, rx, ry) in zip(cs, rings):
        for i in range(sides):
            a = (i + phase) / sides * math.tau
            verts.append(c + u * (math.cos(a) * rx) + v * (math.sin(a) * ry))
    for k in range(len(rings) - 1):
        for i in range(sides):
            j = (i + 1) % sides
            faces.append((k * sides + i, k * sides + j, (k + 1) * sides + j, (k + 1) * sides + i))
    if caps[0]:
        faces.append(tuple(reversed(range(sides))))
    if caps[1]:
        n = len(rings) - 1
        faces.append(tuple(n * sides + i for i in range(sides)))
    o = mesh_from(name, verts, faces, material)
    _fix_normals(o)
    return o


def tube(name, material, p0, p1, r0, r1=None, sides=6, caps=(True, True)):
    return loft(name, material, [(p0, r0, r0), (p1, r1 if r1 is not None else r0, r1 if r1 is not None else r0)],
                sides, axis=Vector(p1) - Vector(p0), caps=caps)


def ball(name, material, c, r, sub=1):
    r = (r, r, r) if isinstance(r, (int, float)) else r
    return prim('ico', name, material, loc=tuple(c), scale=r, subdivisions=sub, radius=1)


def box(name, material, c, half, rot=(0, 0, 0)):
    return prim('cube', name, material, loc=tuple(c), scale=half, rot=rot, size=2)


parts = []


def add(o, bone, j=0.005):
    jitter(o, j, len(parts) + 7)
    flat(o)
    parts.append((o, bone))
    return o


# ---------------- 身體 ----------------
# 吊帶褲的褲頭與臀部（坐在坐板上，底部略扁）
add(loft('pelvis', PANTS, [((0, 0.03, 0.305), 0.13, 0.12), ((0, 0.025, 0.37), 0.158, 0.135),
                           ((0, 0.02, 0.48), 0.152, 0.12)], 8), 'hips')
# 上衣（鐵鏽紅）：腰 → 胸 → 肩
add(loft('shirt_low', SHIRT, [((0, 0.02, 0.44), 0.156, 0.122), ((0, 0.02, 0.56), 0.158, 0.122),
                              ((0, 0.02, 0.68), 0.160, 0.122)], 8), 'spine')
add(loft('shirt_up', SHIRT, [((0, 0.02, 0.63), 0.160, 0.122), ((0, 0.02, 0.76), 0.178, 0.125),
                             ((0, 0.025, 0.85), 0.132, 0.104)], 8), 'chest')
# 襯衫領（兩片翻領）與領口
add(loft('collar_skin', SKIN, [((0, -0.075, 0.775), 0.04, 0.02), ((0, -0.068, 0.845), 0.06, 0.028)], 6,
         axis=(0, 0.15, 1)), 'chest')
for s in (1, -1):
    add(box(f'collar_{s}', SHIRT_D, (0.05 * s, -0.085, 0.835), (0.045, 0.012, 0.03), rot=(-20, 18 * s, -25 * s)), 'chest', 0.002)
# 吊帶褲的胸片（前）與腰圍、兩條背帶、銅扣
add(loft('bib_waist', PANTS, [((0, 0.02, 0.43), 0.166, 0.133), ((0, 0.02, 0.50), 0.164, 0.131)], 8), 'hips')
add(box('bib', PANTS, (0, -0.118, 0.60), (0.105, 0.016, 0.11), rot=(4, 0, 0)), 'spine', 0.003)
add(box('bib_pocket', PANTS_D, (0, -0.136, 0.63), (0.06, 0.006, 0.045), rot=(4, 0, 0)), 'spine', 0.002)
for s in (1, -1):
    # 背帶：胸片上角 → 肩上 → 背後交叉到腰
    a, b, c = Vector((0.085 * s, -0.128, 0.70)), Vector((0.10 * s, -0.02, 0.86)), Vector((-0.06 * s, 0.13, 0.50))
    add(tube(f'strap_f{s}', PANTS, a, b, 0.022, 0.02, 4), 'chest', 0.0)
    add(tube(f'strap_b{s}', PANTS, b, c, 0.02, 0.02, 4), 'chest', 0.0)
    add(ball(f'button_{s}', BRASS, (0.085 * s, -0.138, 0.698), (0.016, 0.008, 0.016)), 'chest', 0.0)
# 脖子
add(tube('neck', SKIN, (0, 0.02, 0.80), (0, 0.02, 0.96), 0.055, 0.05, 7), 'neck')

# ---------------- 頭 ----------------
HEAD_C = Vector((0, 0.02, 1.065))
HEAD_R = Vector((0.172, 0.162, 0.158))
add(ball('head', SKIN, HEAD_C, tuple(HEAD_R), 2), 'head', 0.004)
# 頭髮：帽子下露出的後腦與鬢角（經緯殼，髮際線依方位角插值；同 201 做法，顏色改深棕、短髮）
HAIRLINE = [(0, -40), (30, -36), (50, -26), (62, -10), (68, 6), (75, 14), (110, 14), (140, 22), (180, 34)]


def hair_shell(ns=24, nr=6):
    def line(a):
        for (a0, e0), (a1, e1) in zip(HAIRLINE, HAIRLINE[1:]):
            if a <= a1:
                return e0 + (e1 - e0) * (a - a0) / (a1 - a0)
        return HAIRLINE[-1][1]

    def thick(a):
        return 0.008 + 0.012 * (0.5 + 0.5 * math.cos(math.radians(a))) ** 1.5

    def pt(th, el, t):
        ce, se = math.cos(math.radians(el)), math.sin(math.radians(el))
        return HEAD_C + Vector((math.sin(th) * ce * (HEAD_R.x + t), math.cos(th) * ce * (HEAD_R.y + t),
                                se * (HEAD_R.z + t)))

    verts = [HEAD_C + Vector((0, 0, HEAD_R.z + thick(90)))]
    cols = []
    for i in range(ns):
        th = i / ns * math.tau
        a = abs(math.degrees(math.atan2(math.sin(th), math.cos(th))))
        e, t = line(a), thick(a)
        col = []
        for k in range(1, nr + 1):
            col.append(len(verts)); verts.append(pt(th, 90 - (85 - e) * k / nr, t))
        col.append(len(verts)); verts.append(pt(th, e, -0.006))
        cols.append(col)
    faces = []
    for i in range(ns):
        a, b = cols[i], cols[(i + 1) % ns]
        faces.append((0, a[0], b[0]))
        for k in range(nr):
            faces.append((a[k], a[k + 1], b[k + 1], b[k]))
    o = mesh_from('hair', verts, faces, HAIR)
    _fix_normals(o)
    return o


add(hair_shell(), 'head', 0.004)
for s in (1, -1):
    add(ball(f'ear_{s}', SKIN, HEAD_C + Vector((0.165 * s, 0.01, -0.01)), (0.025, 0.035, 0.04), 1), 'head', 0.002)
    add(ball(f'eye_{s}', INK, HEAD_C + Vector((0.058 * s, -0.141, -0.004)), (0.016, 0.009, 0.024), 1), 'head', 0.0)
    add(ball(f'brow_{s}', HAIR, HEAD_C + Vector((0.062 * s, -0.145, 0.045)), (0.03, 0.008, 0.008), 1), 'head', 0.0)
    add(ball(f'blush_{s}', BLUSH, HEAD_C + Vector((0.098 * s, -0.128, -0.05)), (0.026, 0.01, 0.016), 1), 'head', 0.0)
add(ball('nose', SKIN, HEAD_C + Vector((0, -0.16, -0.03)), (0.02, 0.018, 0.018), 1), 'head', 0.0)
# 落腮短鬍：下巴一圈深棕（俯視看不到，正面看得到的小特徵）
add(loft('beard', HAIR, [(HEAD_C + Vector((0, -0.02, -0.10)), 0.15, 0.13), (HEAD_C + Vector((0, -0.035, -0.15)), 0.11, 0.10),
                         (HEAD_C + Vector((0, -0.05, -0.165)), 0.05, 0.05)], 10), 'head', 0.003)
add(box('mouth', INK, HEAD_C + Vector((0, -0.142, -0.082)), (0.018, 0.006, 0.0035)), 'head', 0.0)

# ---------------- 寬簷草帽（平簷直徑 0.62 m、帽緣微微下垂；低帽冠；帽帶 hat_ribbon） ----------------
HAT_Z = HEAD_C.z + 0.085            # 帽簷內緣高度（頭的上半部）
BRIM_R, CROWN_R0, CROWN_R1, CROWN_H = 0.31, 0.158, 0.135, 0.12


def brim():
    """帽簷：內圈 → 外圈，外緣下垂 3 cm；上下兩面，深淺交錯的放射草編。"""
    N = 20
    verts, faces, mats = [], [], []
    rings = [(CROWN_R0 - 0.004, 0.0), (0.22, -0.006), (BRIM_R, -0.03)]
    top, bot = [], []
    for r, dz in rings:
        t_, b_ = [], []
        for i in range(N):
            a = (i + 0.5) / N * math.tau
            x, y = math.cos(a) * r, math.sin(a) * r * 0.97
            t_.append(len(verts)); verts.append(HEAD_C.xy.to_3d() + Vector((x, y, HAT_Z + dz)))
            b_.append(len(verts)); verts.append(HEAD_C.xy.to_3d() + Vector((x, y, HAT_Z + dz - 0.012)))
        top.append(t_); bot.append(b_)
    for k in range(len(rings) - 1):
        for i in range(N):
            j = (i + 1) % N
            faces.append((top[k][i], top[k + 1][i], top[k + 1][j], top[k][j])); mats.append(i % 2)
            faces.append((bot[k][j], bot[k + 1][j], bot[k + 1][i], bot[k][i])); mats.append(1)
    k = len(rings) - 1
    for i in range(N):
        j = (i + 1) % N
        faces.append((top[k][i], bot[k][i], bot[k][j], top[k][j])); mats.append(1)   # 外緣
    o = mesh_from('brim', verts, faces, STRAW)
    o.data.materials.append(STRAW_D)
    for p, m in zip(o.data.polygons, mats):
        p.material_index = m
    _fix_normals(o)
    return o


add(brim(), 'head', 0.004)
CR0 = HEAD_C.xy.to_3d() + Vector((0, 0, HAT_Z - 0.01))
add(loft('crown', STRAW, [(CR0, CROWN_R0, CROWN_R0 * 0.97), (CR0 + Vector((0, 0, CROWN_H * 0.75)), CROWN_R1 + 0.006, CROWN_R1),
                          (CR0 + Vector((0, 0, CROWN_H)), CROWN_R1 * 0.82, CROWN_R1 * 0.8)], 14), 'head', 0.004)
# 帽頂中央的凹痕（深色小橢圓）
add(loft('crown_dent', STRAW_D, [(CR0 + Vector((0, 0, CROWN_H - 0.004)), 0.07, 0.035),
                                 (CR0 + Vector((0, 0, CROWN_H + 0.004)), 0.055, 0.025)], 10), 'head', 0.0)
# 帽帶與蝴蝶結（角色左側）
add(loft('ribbon', RIBBON, [(CR0 + Vector((0, 0, 0.008)), CROWN_R0 + 0.004, CROWN_R0 * 0.97 + 0.004),
                            (CR0 + Vector((0, 0, 0.042)), CROWN_R0 - 0.004, CROWN_R0 * 0.97 - 0.006)], 14,
         caps=(False, False)), 'head', 0.0)
add(box('ribbon_bow', RIBBON, CR0 + Vector((CROWN_R0 + 0.008, 0.03, 0.026)), (0.01, 0.035, 0.02), rot=(0, 0, 8)), 'head', 0.0)
add(box('ribbon_tail', RIBBON, CR0 + Vector((CROWN_R0 + 0.012, 0.055, -0.01)), (0.006, 0.014, 0.03), rot=(14, 0, 0)), 'head', 0.0)
# 帽內頭箍（讓帽子看起來戴在頭上）
add(loft('hat_band', STRAW_D, [(HEAD_C + Vector((0, 0.005, 0.07)), 0.165, 0.155), (HEAD_C + Vector((0, 0.005, 0.12)), 0.152, 0.142)], 10),
    'head', 0.003)

# ---------------- 手臂（長袖捲到前臂；手是圓手套狀） ----------------
for s, sh, el, wr, hc in ((1, SH_L, EL_L, WR_L, HC_L), (-1, SH_R, EL_R, WR_R, HC_R)):
    side = 'L' if s > 0 else 'R'
    up, fo, ha = f'upperarm_{side}', f'forearm_{side}', f'hand_{side}'
    d = (el - sh).normalized()
    df = (wr - el).normalized()
    add(ball(f'shoulder_{side}', SHIRT, sh + Vector((0.008 * s, 0, -0.005)), (0.074, 0.07, 0.07), 1), up)
    add(tube(f'sleeve_{side}', SHIRT, sh, el, 0.064, 0.056, 7), up)
    add(ball(f'elbow_{side}', SHIRT, el, 0.054, 1), fo)
    add(tube(f'sleeve_lo_{side}', SHIRT, el, el + df * 0.08, 0.054, 0.052, 7), fo)
    add(tube(f'cuff_{side}', SHIRT_D, el + df * 0.075, el + df * 0.115, 0.06, 0.058, 7), fo)   # 捲起的袖口
    add(tube(f'farm_{side}', SKIN, el + df * 0.10, wr, 0.039, 0.033, 6), fo)
    add(ball(f'hand_{side}', SKIN, hc, (0.048, 0.044, 0.052), 1), ha, 0.004)
    add(ball(f'thumb_{side}', SKIN, hc + Vector((-0.012 * s, -0.035, 0.02)), (0.018, 0.02, 0.026), 1), ha, 0.002)

# ---------------- 腿（坐姿；吊帶褲管塞進膠靴） ----------------
for s, hip, kn, an in ((1, HIP_L, KNEE_L, ANK_L), (-1, mirror(HIP_L), mirror(KNEE_L), mirror(ANK_L))):
    side = 'L' if s > 0 else 'R'
    th, sn, ft = f'thigh_{side}', f'shin_{side}', f'foot_{side}'
    dk = (kn - hip).normalized()
    ds = (an - kn).normalized()
    add(tube(f'thighm_{side}', PANTS, hip - dk * 0.03, kn, 0.084, 0.07, 7), th)
    add(ball(f'knee_{side}', PANTS, kn, 0.069, 1), sn)
    add(tube(f'shinp_{side}', PANTS, kn, kn + ds * 0.14, 0.066, 0.062, 7), sn)
    # 膠靴：靴筒（上緣反摺一圈）→ 腳背
    add(tube(f'boot_top_{side}', BOOT, kn + ds * 0.12, kn + ds * 0.16, 0.074, 0.072, 7), sn)
    add(tube(f'boot_leg_{side}', BOOT, kn + ds * 0.15, an + ds * 0.01, 0.064, 0.056, 7), sn)
    add(ball(f'ankle_{side}', BOOT, an, 0.058, 1), ft)
    add(loft(f'bootf_{side}', BOOT, [(an + Vector((0, 0.04, -0.035)), 0.05, 0.04), (an + Vector((0, -0.05, -0.04)), 0.055, 0.04),
                                     (an + Vector((0, -0.125, -0.05)), 0.046, 0.026)], 7, axis=(0, -1, 0)), ft)
    add(box(f'sole_{side}', BOOT_D, an + Vector((0, -0.045, -0.083)), (0.058, 0.11, 0.012)), ft, 0.002)

# ---------------- 釣竿（藤竿四節＋竹節環＋軟木握把＋捲線器） ----------------
add(tube('rod_grip', CORK, rp(-BUTT), rp(0.10), 0.020, 0.018, 6), 'rod_0', 0.0)
add(ball('rod_butt', CANE_D, rp(-BUTT), (0.022, 0.016, 0.022), 1), 'rod_0', 0.0)
add(tube('rod_seat', CANE_D, rp(0.10), rp(0.13), 0.021, 0.019, 6), 'rod_0', 0.0)
RADII = [0.0155, 0.0125, 0.010, 0.0075, 0.0055]
for k in range(4):
    a, b = max(ROD_SEG[k], 0.12), ROD_SEG[k + 1]
    add(tube(f'rod_seg{k}', CANE, rp(a), rp(b), RADII[k], RADII[k + 1], 5), f'rod_{k}', 0.0)
    if k:
        add(tube(f'rod_node{k}', CANE_D, rp(ROD_SEG[k] - 0.012), rp(ROD_SEG[k] + 0.012), RADII[k] + 0.004,
                 RADII[k] + 0.004, 5), f'rod_{k}', 0.0)
for k, d in enumerate((0.7, 1.2, 1.65)):    # 導線環
    seg = 1 if d < 0.98 else (2 if d < 1.43 else 3)
    add(tube(f'rod_guide{k}', BRASS, rp(d) + Vector((0, 0, -0.004)), rp(d) + Vector((0, 0, -0.03)), 0.004, 0.004, 4), f'rod_{seg}', 0.0)
add(ball('rod_tiptop', INK, rp(ROD_SEG[4]), 0.009, 1), 'rod_3', 0.0)
add(tube('reel_stem', CANE_D, G + Vector((0, -0.065, -0.012)), G + RC + Vector((0, 0, 0.02)), 0.008, 0.008, 5), 'rod_0', 0.0)
add(tube('reel_body', INK, G + RC + Vector((0, 0.028, 0)), G + RC + Vector((0, -0.028, 0)), 0.03, 0.03, 8), 'rod_0', 0.0)
add(tube('reel_spool', SPOOL, G + RC + Vector((0, -0.028, 0)), G + RC + Vector((0, -0.05, 0)), 0.025, 0.021, 8), 'rod_0', 0.0)
add(tube('reel_axle', BRASS, G + RC + Vector((0.03, 0, 0)), G + RC + Vector((0.056, 0, 0)), 0.006, 0.006, 5), 'reel_crank', 0.0)
add(tube('reel_arm', BRASS, G + RC + Vector((0.056, 0, 0)), G + KNOB + Vector((-0.012, 0, 0)), 0.006, 0.006, 4), 'reel_crank', 0.0)
add(ball('reel_knob', SHIRT, G + KNOB, (0.012, 0.012, 0.015), 1), 'reel_crank', 0.0)

body = bind_rigid(parts, arm, 'fisher')

# ---------------- 姿勢解算（沿用 201，加上世界座標的握點與縮放竿） ----------------
RH = {b.name: b.head_local.copy() for b in arm.data.bones}
RR = {b.name: b.matrix_local.to_3x3() for b in arm.data.bones}
PAR = {b.name: (b.parent.name if b.parent else None) for b in arm.data.bones}


def crank_rot(phi):
    return Matrix.Rotation(-phi, 3, 'X')


# 「拳心」：手掌球與拇指球的中點（手骨靜止座標）
GRIP_L = HC_L + Vector((-0.006, -0.0175, 0.010))
GRIP_R = HC_R + Vector((0.006, -0.0175, 0.010))


def frame3(y, x):
    y = y.normalized()
    x = (x - y * x.dot(y)).normalized()
    return Matrix((x, y, x.cross(y))).transposed()


def limb_rest(sh, el, tgt, pole):
    u0 = (tgt - sh).normalized()
    w0 = (pole - u0 * pole.dot(u0)).normalized()
    n0 = u0.cross(w0).normalized()
    return dict(a=(el - sh).length, b=(tgt - el).length,
                fu=frame3(el - sh, n0).inverted(), fl=frame3(tgt - el, n0).inverted())


LEG_POLE = Vector((0, -0.6, 0.8))
REST_LIMB = {
    'L': limb_rest(SH_L, EL_L, HC_L, Vector((0, 1, 0))), 'R': limb_rest(SH_R, EL_R, HC_R, Vector((0, 1, 0))),
    'lL': limb_rest(HIP_L, KNEE_L, ANK_L, LEG_POLE),
    'lR': limb_rest(mirror(HIP_L), mirror(KNEE_L), mirror(ANK_L), LEG_POLE),
}
ROD_REST = frame3(Vector((0, -1, 0)), Vector((-1, 0, 0))).inverted()
WARN = []


def ik(S, T, pole, rest, tag):
    a, b = rest['a'], rest['b']
    v = T - S
    d = v.length
    hi = (a + b) * 0.998
    if d > hi:
        WARN.append(f'{tag} 伸不到 {d / (a + b):.3f}')
        d = hi
    d = max(d, abs(a - b) + 0.01)
    u = v.normalized()
    w = (pole - u * pole.dot(u)).normalized()
    ca = max(-1, min(1, (a * a + d * d - b * b) / (2 * a * d)))
    E_ = S + (u * ca + w * math.sqrt(1 - ca * ca)) * a
    n = u.cross(w).normalized()
    return frame3(E_ - S, n) @ rest['fu'], frame3(S + u * d - E_, n) @ rest['fl']


def E(deg):
    return Euler([math.radians(a) for a in deg], 'XYZ').to_matrix()


def V(t):
    return Vector(t)


def solve(sp):
    D, H = {}, {}

    def ch(n):
        p = PAR[n]
        H[n] = H[p] + D[p] @ (RH[n] - RH[p])

    D['root'] = Matrix.Identity(3)
    H['root'] = RH['root'] + V(sp['root'])
    for n in ('hips', 'spine', 'chest', 'neck', 'head'):
        ch(n)
        D[n] = D[PAR[n]] @ E(sp[n])
    C = lambda x: H['chest'] + D['chest'] @ (V(x) - RH['chest'])
    Cd = lambda v: D['chest'] @ V(v)
    for s in 'LR':
        th, sn, ft = f'thigh_{s}', f'shin_{s}', f'foot_{s}'
        ch(th)
        D[th], D[sn] = ik(H[th], V(sp['ank' + s]), V(sp['kpole' + s]), REST_LIMB['l' + s], 'leg' + s)
        ch(sn); ch(ft)
        D[ft] = E((sp['pit' + s], 0, sp['yaw' + s]))

    def arm_to(side, target_fn, pole, grip):
        """target_fn(off) → 掌心目標；grip=True 時迭代讓拳心落在目標上。"""
        up, fo, ha = f'upperarm_{side}', f'forearm_{side}', f'hand_{side}'
        hc, gp = (HC_L, GRIP_L) if side == 'L' else (HC_R, GRIP_R)
        ch(up)
        off = Vector((0, 0, 0))
        for _ in range(5 if grip else 1):
            t = target_fn(off)
            D[up], D[fo] = ik(H[up], t, pole, REST_LIMB[side], 'arm' + side)
            ch(fo); ch(ha)
            D[ha] = D[fo]
            if grip:
                off = D[ha] @ (gp - hc)
        return t

    # 右手：胸部座標的點 ↔ 世界座標的握點（槳柄）
    wR = sp.get('wRw', 0.0)
    tR = arm_to('R', lambda off: C(sp['handR']).lerp(V(sp['tgtR']) - off, wR) if wR > 0 else C(sp['handR']),
                Cd(sp['poleR']), wR > 0)
    ch('rod_0')
    f, up = Cd(sp['rodDir']).normalized(), Cd(sp['rodUp'])
    D['rod_0'] = frame3(f, f.cross(up)) @ ROD_REST
    ch('reel_crank')
    D['reel_crank'] = D['rod_0'] @ crank_rot(sp['crank'])
    for k in (1, 2, 3):
        ch(f'rod_{k}')
        D[f'rod_{k}'] = D[f'rod_{k - 1}'] @ E((sp['bend'][k - 1], 0, 0))
    ch('rod_tip'); D['rod_tip'] = D['rod_3']
    # 左手：胸部座標的點、竿上某點（wL）、世界座標的握點（wLw）三者混合
    rodpt = H['rod_0'] + D['rod_0'] @ V(sp['offL'])
    wLw = sp.get('wLw', 0.0)

    def tl(off):
        t = C(sp['handL']).lerp(rodpt - off, sp['wL'])
        if wLw > 0:
            t = t.lerp(V(sp['tgtL']) - off, wLw)
        return t

    tL = arm_to('L', tl, Cd(sp['poleL']), sp['wL'] > 0 or wLw > 0)
    rot = {}
    for n in BN:
        Dp = D[PAR[n]] if PAR[n] else Matrix.Identity(3)
        rot[n] = (RR[n].inverted() @ Dp.inverted() @ D[n] @ RR[n]).to_quaternion()
    loc = {'root': RR['root'].inverted() @ V(sp['root'])}
    return rot, loc, D, H, tL


# ---------------- 姿勢規格與插值 ----------------

def mix(a, b, u):
    if isinstance(a, dict):
        return {k: mix(a[k], b[k], u) for k in a}
    if isinstance(a, (tuple, list)):
        return tuple(x + (y - x) * u for x, y in zip(a, b))
    if isinstance(a, Vector):
        return a.lerp(b, u)
    return a + (b - a) * u


def smooth(u):
    return u * u * (3 - 2 * u)


def tr(t, keys, ease=smooth):
    if t <= keys[0][0]:
        return keys[0][1]
    for (t0, a), (t1, b) in zip(keys, keys[1:]):
        if t <= t1:
            return mix(a, b, ease((t - t0) / (t1 - t0)))
    return keys[-1][1]


def knob(phi):
    return tuple(RC + crank_rot(phi) @ (KNOB - RC))


def add3(a, b):
    return tuple(x + y for x, y in zip(a, b))


def lowered(p):
    """201 的胸部座標點（站姿）→ 本作坐姿（整體低 0.40）。"""
    return (p[0], p[1], p[2] + DZ)


def oar_grip(side, sweep, lift):
    """槳柄中心（three 船本地）→ 角色座標。"""
    return tuple(TC(rowing.handle(side, sweep, lift)))


REST_GRIP_L = oar_grip('L', *rowing.REST)    # Oar_L：角色右手握
REST_GRIP_R = oar_grip('R', *rowing.REST)    # Oar_R：角色左手握

SIT = dict(
    root=(0, 0, 0), hips=(6, 0, 0), spine=(2, 0, 0), chest=(0, 0, 0), neck=(0, 0, 0), head=(-6, 0, 0),
    ankL=tuple(ANK_L), pitL=0, yawL=4, kpoleL=(0.2, -0.6, 0.8),
    ankR=tuple(mirror(ANK_L)), pitR=0, yawR=-4, kpoleR=(-0.2, -0.6, 0.8),
    handR=lowered((-0.20, -0.30, 1.02)), poleR=(-0.7, 0.4, -0.6), wRw=1.0, tgtR=REST_GRIP_L,
    rodDir=(-0.3, -0.2, 0.93), rodUp=(1, 0, 0), bend=(0, 0, 0), rodScale=0.001,
    handL=lowered((0.20, -0.30, 1.02)), poleL=(0.7, 0.4, -0.6), wL=0.0, offL=knob(0), crank=0.0,
    wLw=1.0, tgtL=REST_GRIP_R,
)


def P(base=SIT, **kw):
    d = dict(base)
    d.update(kw)
    return d


def lean_pose(lean, base):
    """前傾角 lean（度）分給骨盆、腰、胸；頭反向轉回來保持看前方。"""
    return dict(base, hips=(lean * 0.55, 0, 0), spine=(lean * 0.25, 0, 0), chest=(lean * 0.2, 0, 0),
                head=(-lean * 0.75 - 4, 0, 0))


T_SIT, T_ROW, T_CAST, T_WAIT, T_HOOK, T_REEL, T_CHEER = 2.0, rowing.T, 1.0, 2.4, 0.4, 0.6, 1.4


def sit(t):
    w = math.tau * t / T_SIT
    s = math.sin(w)
    return P(lean_pose(8 + 1.2 * s, SIT), neck=(0.6 * s, 0, 0))


ROW_POLE_R, ROW_POLE_L = (-0.8, 0.7, -0.5), (0.8, 0.7, -0.5)


def lean_curve(phi, catch, finish):
    phi %= 1.0
    if phi < rowing.DRIVE:
        return rowing.lerp(catch, finish, rowing.ease(phi / rowing.DRIVE))
    return rowing.lerp(finish, catch, rowing.ease((phi - rowing.DRIVE) / (1 - rowing.DRIVE)))


def row(t):
    phi = t / T_ROW
    sw, li = rowing.oar_pose(phi)
    lean = lean_curve(phi, 27.0, -14.0)
    return P(lean_pose(lean, SIT), tgtR=oar_grip('L', sw, li), tgtL=oar_grip('R', sw, li),
             poleR=ROW_POLE_R, poleL=ROW_POLE_L)


def row_L(t):
    """只划 Oar_L（角色右手），左手握著停住的 Oar_R；身體往划的那側（角色右）稍微扭。"""
    phi = t / T_ROW
    sw, li = rowing.oar_pose(phi)
    lean = lean_curve(phi, 24.0, 4.0)
    tw = lean_curve(phi, 9.0, -4.0)
    base = lean_pose(lean, SIT)
    return P(base, chest=add3(base['chest'], (0, 0, tw)), tgtR=oar_grip('L', sw, li), tgtL=REST_GRIP_R,
             poleR=ROW_POLE_R, poleL=(0.7, 0.4, -0.6))


def row_R(t):
    phi = t / T_ROW
    sw, li = rowing.oar_pose(phi)
    lean = lean_curve(phi, 24.0, 4.0)
    tw = lean_curve(phi, -9.0, 4.0)
    base = lean_pose(lean, SIT)
    return P(base, chest=add3(base['chest'], (0, 0, tw)), tgtL=oar_grip('R', sw, li), tgtR=REST_GRIP_L,
             poleL=ROW_POLE_L, poleR=(-0.7, 0.4, -0.6))


# ---- 釣魚姿勢（201 的站姿數值整體降 0.40；腳固定坐姿，不跨步；根骨不動） ----
FISH = P(SIT, wRw=0.0, wLw=0.0, rodScale=1.0)
WAIT = P(FISH, hips=(4, 0, 0), spine=(3, 0, -4), chest=(2, 0, -6), neck=(2, 0, 4), head=(-2, 0, 6),
         handR=lowered((-0.085, -0.33, 1.0)), poleR=(-0.6, 0.3, -1), rodDir=(0.16, -0.83, 0.54), rodUp=(0, 0, 1),
         handL=lowered((0.10, -0.35, 0.93)), poleL=(0.6, 0.2, -1), wL=1.0, offL=knob(0))
REEL = P(WAIT, hips=(-2, 0, 0), spine=(-6, 0, -4), chest=(-4, 0, -6), neck=(4, 0, 4), head=(2, 0, 6),
         handR=lowered((-0.08, -0.31, 1.06)), rodDir=(0.15, -0.79, 0.60), bend=(7, 10, 14))
BUTT_GRIP = (0.0, 0.20, 0.0)
CHARGE = P(WAIT, hips=(0, 0, -8), spine=(-4, -3, -12), chest=(-3, -2, -14), neck=(0, 0, 12), head=(-2, 0, 14),
           handR=lowered((-0.24, -0.14, 1.24)), poleR=(-0.6, 0.2, -1), rodDir=(-0.62, 0.52, 0.58), rodUp=(-0.5, 0.4, 1),
           handL=lowered((0.05, -0.30, 1.05)), poleL=(0.6, -0.4, -1), wL=1.0, offL=BUTT_GRIP, bend=(-3, -4, -6))
SWING = P(WAIT, hips=(6, 0, 0), spine=(3, 0, -2), chest=(3, 0, 0), neck=(0, 0, 2), head=(-1, 0, 2),
          handR=lowered((-0.22, -0.34, 1.18)), poleR=(-0.6, 0.3, -1), rodDir=(-0.35, -0.55, 0.76), rodUp=(-0.3, 0.3, 1),
          handL=lowered((0.05, -0.30, 1.0)), poleL=(0.6, -0.4, -1), wL=1.0, offL=BUTT_GRIP, bend=(-5, -8, -11))
FOLLOW = P(WAIT, hips=(10, 0, 0), spine=(7, 0, 2), chest=(5, 0, 4), neck=(0, 0, 0), head=(-4, 0, 0),
           handR=lowered((-0.15, -0.43, 1.05)), rodDir=(0.10, -0.97, 0.24), bend=(5, 8, 11),
           poleL=(0.6, -0.4, -1), offL=BUTT_GRIP)
# 甩竿從坐著握槳的姿勢開始：0～0.15 s 雙手離開槳柄、竿長出來（縮放 0.001 → 1）
LIFT = P(WAIT, hips=(4, 0, -4), spine=(0, 0, -8), chest=(0, 0, -8), head=(-2, 0, 8),
         handR=lowered((-0.22, -0.22, 1.12)), poleR=(-0.6, 0.2, -1), rodDir=(-0.45, 0.1, 0.89), rodUp=(-0.5, 0.4, 1),
         handL=lowered((0.10, -0.28, 0.98)), wL=1.0, offL=BUTT_GRIP, bend=(0, 0, 0))


def cast(t):
    base = tr(t, [(0.0, P(lean_pose(8, SIT), rodScale=0.001)), (0.18, LIFT), (0.45, CHARGE), (0.55, SWING),
                  (0.65, FOLLOW), (1.0, WAIT)])
    wRw = tr(t, [(0.0, 1.0), (0.14, 0.0)])
    wLw = tr(t, [(0.0, 1.0), (0.16, 0.0)])
    wL = tr(t, [(0.08, 0.0), (0.30, 1.0)])
    sc = tr(t, [(0.02, 0.001), (0.16, 1.0)])
    offL = tr(t, [(0.65, BUTT_GRIP), (1.0, knob(0))])
    return dict(base, wRw=wRw, wLw=wLw, wL=wL, rodScale=sc, offL=offL,
                tgtR=REST_GRIP_L, tgtL=REST_GRIP_R)


def wait(t):
    w = math.tau * t / T_WAIT
    return P(WAIT, chest=add3(WAIT['chest'], (-1.0 * math.sin(2 * w), 0, 0)),
             head=add3(WAIT['head'], (0, 0, 3 * math.sin(w))),
             rodDir=add3(WAIT['rodDir'], (0.012 * math.sin(w), 0, 0.018 * math.sin(2 * w))))


HOOK_UP = P(REEL, hips=(-8, 0, 0), spine=(-10, 0, -6), chest=(-8, 0, -10), neck=(4, 0, 4), head=(4, 0, 6),
            handR=lowered((-0.12, -0.27, 1.10)), rodDir=(-0.24, -0.40, 0.88), bend=(10, 15, 20))


def hook(t):
    return dict(tr(t, [(0.0, WAIT), (0.15, HOOK_UP), (0.4, REEL)]), wL=1.0)


def reel(t):
    phi = math.tau * t / T_REEL
    s, c = math.sin(phi), math.cos(phi)
    return P(REEL, offL=knob(phi), crank=phi,
             chest=add3(REEL['chest'], (0.8 * s, 0, 1.2 * (c - 1))),
             bend=add3(REEL['bend'], (1.0 * s, 1.5 * s, 2.0 * s)),
             rodDir=add3(REEL['rodDir'], (0.008 * (c - 1), 0, 0.012 * s)))


# cheer：從收線姿勢開始，竿往右上收再扛到右後方，左手往外上方伸直高舉（遊戲把魚掛在 hand_L），在坐板上小跳一下
def reach_L(d, frac=0.985):
    d = Vector(d).normalized()
    return tuple(SH_L + d * (REST_LIMB['L']['a'] + REST_LIMB['L']['b']) * frac)


UP_L = reach_L((0.68, -0.20, 0.70), 0.97)
STOW_UP = P(FISH, spine=(0, 0, -3), chest=(0, 0, -6), neck=(0, 0, 4), head=(-4, 0, 4),
            handR=lowered((-0.33, -0.16, 1.24)), poleR=(-0.5, 0.3, -1), rodDir=(-0.58, -0.12, 0.81), rodUp=(-0.3, 0.3, 1),
            handL=lowered((0.25, -0.02, 0.66)), wL=0.0)
STOW_BACK = P(STOW_UP, handR=lowered((-0.30, -0.15, 1.17)), rodDir=(-0.58, 0.60, 0.55), rodUp=(-0.2, -0.3, 1))
CH_UP = P(STOW_UP, handL=lowered((0.40, -0.18, 1.02)), poleL=(1, 0.3, -0.6))
CH_BACK = P(STOW_BACK, handL=lowered((0.52, -0.15, 1.16)), poleL=(1, 0.3, -0.6))
CROUCH = P(FISH, hips=(10, 0, 0), spine=(6, -2, 0), chest=(2, -1, 0), head=(-10, 0, 4),
           handL=lowered((0.57, -0.12, 1.31)), poleL=(1, 0.3, -0.6), wL=0.0,
           handR=lowered((-0.24, -0.15, 1.16)), poleR=(-0.5, 0.3, -1), rodDir=(-0.58, 0.58, 0.57), rodUp=(-0.2, -0.3, 1))
AIR = P(CROUCH, root=(0, 0, 0.07), hips=(0, 0, 0), spine=(-4, -2, 0), chest=(-4, -1, 0), head=(-4, -3, 10), handL=UP_L)
LAND = P(AIR, root=(0, 0, -0.01), hips=(6, 0, 0), spine=(5, -2, 0), chest=(2, -1, 0), head=(-8, -2, 8))
HOLD = P(AIR, root=(0, 0, 0), hips=(2, 0, 0), spine=(-2, -1, 0), chest=(-2, -1, 0), head=(-6, -4, 12))


def cheer(t):
    base = tr(t, [(0.0, REEL), (0.08, REEL), (0.30, CH_UP), (0.44, CH_BACK), (0.56, CROUCH), (0.72, AIR),
                  (0.88, LAND), (1.08, HOLD), (1.4, HOLD)])
    wL = tr(t, [(0.06, 1.0), (0.26, 0.0)])
    shake = 0.0 if t < 1.15 else 0.02 * math.sin((t - 1.15) * math.tau * 2.5) * (1 - (t - 1.15) / 0.25)
    return dict(base, wL=wL, handL=add3(base['handL'], (shake, 0, abs(shake))))


ACTIONS = [
    ('sit', T_SIT, sit, True), ('row', T_ROW, row, True), ('row_L', T_ROW, row_L, True), ('row_R', T_ROW, row_R, True),
    ('cast', T_CAST, cast, False), ('wait', T_WAIT, wait, True), ('hook', T_HOOK, hook, False),
    ('reel', T_REEL, reel, True), ('cheer', T_CHEER, cheer, False),
]


def key_action(name, n_frames, fn, cyclic):
    begin_action(arm, name)
    for pb in arm.pose.bones:
        pb.rotation_quaternion = (1, 0, 0, 0)
    prev = {}
    for f in range(n_frames + 1):
        sp = fn(f / FPS)
        rot, loc, D, H, tL = solve(sp)
        for n in BN:
            pb = arm.pose.bones[n]
            q = rot[n]
            if n in prev and q.dot(prev[n]) < 0:
                q.negate()
            prev[n] = q
            pb.rotation_quaternion = q
            pb.keyframe_insert('rotation_quaternion', frame=f)
        pb = arm.pose.bones['root']
        pb.location = loc['root']
        pb.keyframe_insert('location', frame=f)
        pr = arm.pose.bones['rod_0']
        sc = sp['rodScale']
        pr.scale = (sc, sc, sc)
        pr.keyframe_insert('scale', frame=f)
        act = arm.animation_data.action
        if getattr(act, 'slots', None) and len(act.slots) and arm.animation_data.action_slot is None:
            arm.animation_data.action_slot = act.slots[0]
    end_action(arm, cyclic=cyclic, interp='LINEAR')
    return act


# ---------------- 檢查 ----------------

def grip_err(sp, D, H, side):
    """拳心 ↔ 目標握點的距離（只在世界握點權重 = 1 時有意義）。"""
    ha = f'hand_{side}'
    hc, gp = (HC_L, GRIP_L) if side == 'L' else (HC_R, GRIP_R)
    wr = WR_L if side == 'L' else WR_R
    fist = H[ha] + D[ha] @ (gp - wr)
    tgt = V(sp['tgtL'] if side == 'L' else sp['tgtR'])
    return (fist - tgt).length


def brim_hits(D, H, pts):
    """點落在帽簷板（頭部靜止座標，帽簷高度 ±3 cm、半徑 < 帽簷 + 2 cm）裡面就算撞到。"""
    out = []
    Dh = D['head'].inverted()
    for tag, p in pts:
        q = RH['head'] + Dh @ (p - H['head'])
        r = math.hypot(q.x - HEAD_C.x, q.y - HEAD_C.y)
        if CROWN_R0 < r < BRIM_R + 0.02 and HAT_Z - 0.06 < q.z < HAT_Z + 0.03:
            out.append(tag)
    return out


def seg_points(D, H, names):
    pts = []
    for n, nxt in names:
        for k in range(6):
            pts.append((n, H[n].lerp(H[nxt], k / 5)))
    return pts


def rod_points(D, H):
    pts = []
    f = D['rod_0'] @ Vector((0, -1, 0))
    for seg in range(4):
        n = f'rod_{seg}'
        fd = D[n] @ Vector((0, -1, 0))
        L = ROD_SEG[seg + 1] - ROD_SEG[seg]
        for k in range(6):
            pts.append((n, H[n] + fd * (L * k / 5)))
    return pts


def knee_clear(D, H):
    """拳心離膝蓋球心的最近距離（膝蓋半徑 0.069 + 拳頭半徑約 0.05）。"""
    out = 9
    for side in 'LR':
        fist = H[f'hand_{side}'] + D[f'hand_{side}'] @ ((GRIP_L - WR_L) if side == 'L' else (GRIP_R - WR_R))
        for k in 'LR':
            out = min(out, (fist - H[f'shin_{k}']).length)
    return out


for name, dur, fn, cyc in ACTIONS:
    n = round(dur * FPS)
    WARN.clear()
    key_action(name, n, fn, cyc)
    errs = {'L': [], 'R': []}
    hits = set()
    kc = 9
    for f in range(n + 1):
        sp_ = fn(f / FPS)
        rot, loc, D, H, tL = solve(sp_)
        if sp_.get('wLw', 0) > 0.999:
            errs['L'].append(grip_err(sp_, D, H, 'L'))
        if sp_.get('wRw', 0) > 0.999:
            errs['R'].append(grip_err(sp_, D, H, 'R'))
        pts = seg_points(D, H, (('upperarm_L', 'forearm_L'), ('forearm_L', 'hand_L'), ('upperarm_R', 'forearm_R'),
                                ('forearm_R', 'hand_R')))
        if sp_['rodScale'] > 0.5:
            pts += rod_points(D, H)
        h = brim_hits(D, H, pts)
        if h:
            hits.add(f'{f}:{",".join(sorted(set(h)))}')
        kc = min(kc, knee_clear(D, H))
    maxerr = 0
    for f in range(0, n + 1, 3):
        scene.frame_set(f)
        bpy.context.view_layer.update()
        rot, loc, D, H, tL = solve(fn(f / FPS))
        for bn in (('rod_tip',) if fn(f / FPS)['rodScale'] > 0.999 else ()) + ('hand_L', 'hand_R', 'foot_L', 'head'):
            maxerr = max(maxerr, (arm.pose.bones[bn].head - H[bn]).length)
    ge = ' '.join(f'{s}:{max(v) * 100:.2f}cm' for s, v in errs.items() if v)
    print(f'[{name}] 0..{n}  solver↔blender {maxerr * 1000:.2f} mm  IK {sorted(set(WARN))[:4]}  拳心↔槳柄 {ge or "-"}'
          f'  拳心↔膝 最近 {kc:.3f} m')
    if hits:
        print(f'   帽簷碰撞 {sorted(hits)[:10]}')

# 銜接
def pose_gap(a, b):
    ra, rb = solve(a), solve(b)
    return max((ra[3][n] - rb[3][n]).length for n in BN if n not in ('rod_0', 'rod_1', 'rod_2', 'rod_3', 'rod_tip', 'reel_crank'))


FN = {a[0]: (a[1], a[2]) for a in ACTIONS}
END = lambda n: FN[n][1](FN[n][0])
START = lambda n: FN[n][1](0.0)
for tag, a, b in (('sit 首尾', START('sit'), END('sit')), ('row 首尾', START('row'), END('row')),
                  ('row_L 首尾', START('row_L'), END('row_L')), ('row_R 首尾', START('row_R'), END('row_R')),
                  ('wait 首尾', START('wait'), END('wait')), ('reel 首尾', START('reel'), END('reel')),
                  ('cast 結尾＝wait', END('cast'), START('wait')), ('hook 開頭＝wait', START('hook'), START('wait')),
                  ('hook 結尾＝reel', END('hook'), START('reel')), ('cheer 開頭＝reel', START('cheer'), START('reel'))):
    g = pose_gap(a, b)
    print(f'[銜接] {tag}: {g * 1000:.2f} mm' + ('' if g < 0.002 else '  ← 不連續'))

# 竿尖位置（遊戲接釣線用）：wait 開頭，three 船本地座標
rot, loc, D, H, tL = solve(START('wait'))
tip = H['rod_tip']
print(f'[竿尖] wait 開頭 three 船本地 ({-tip.x:+.3f}, {tip.z:.3f}, {tip.y:+.3f})（面向船尾，未轉向）')

stash_actions(arm, [a[0] for a in ACTIONS])

# ---------------- 轉 180°：角色面向船尾（Blender +Y＝three −Z） ----------------
RZ = Matrix.Rotation(math.pi, 4, 'Z')
bpy.ops.object.select_all(action='DESELECT')
arm.select_set(True)
bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode='EDIT')
for eb in arm.data.edit_bones:
    eb.matrix = RZ @ eb.matrix
bpy.ops.object.mode_set(mode='OBJECT')
body.data.transform(RZ)
body.data.update()
# 驗證：每根骨頭的靜止矩陣 ＝ RZ @ 原矩陣
def _mdiff(b):
    m = b.matrix_local - RZ @ Matrix.Translation(RH[b.name]) @ RR[b.name].to_4x4()
    return max(abs(x) for r_ in m for x in r_)


bad = [b.name for b in arm.data.bones if _mdiff(b) > 1e-4]
print('[轉向] 靜止矩陣不符：', bad or '無')
# 動畫中的點也要跟著轉：抽查 row 的槳柄
arm.animation_data.action = bpy.data.actions['row']
arm.animation_data.action_slot = bpy.data.actions['row'].slots[0]
for f in (0, 9, 18, 27):
    scene.frame_set(f)
    bpy.context.view_layer.update()
    pb = arm.pose.bones['hand_R']
    sw, li = rowing.oar_pose(f / FPS / T_ROW)
    hb = rowing.handle('L', sw, li)              # three 船本地
    hand = arm.matrix_world @ pb.head                # Blender 世界
    print(f'   row f{f}: hand_R 腕 three ({hand.x:+.3f}, {hand.z:.3f}, {-hand.y:+.3f})  Oar_L 槳柄 ({hb[0]:+.3f}, {hb[1]:.3f}, {hb[2]:+.3f})')
arm.animation_data.action = None


def slim_glb(path, keep_translation=('root',), keep_scale=('rod_0',)):
    """匯出後瘦身（同 201）：拿掉恆為靜止值的通道；保留 root 的位移與 rod_0 的縮放。"""
    import json, struct
    data = open(path, 'rb').read()
    jl = struct.unpack_from('<I', data, 12)[0]
    g = json.loads(data[20:20 + jl])
    bo = 20 + jl
    bl = struct.unpack_from('<I', data, bo)[0]
    binb = data[bo + 8:bo + 8 + bl]
    names = [n.get('name') for n in g['nodes']]
    for a in g.get('animations', []):
        keep = [c for c in a['channels'] if c['target']['path'] == 'rotation' or
                (c['target']['path'] == 'translation' and names[c['target']['node']] in keep_translation) or
                (c['target']['path'] == 'scale' and names[c['target']['node']] in keep_scale)]
        used = sorted({c['sampler'] for c in keep})
        rm = {o: i for i, o in enumerate(used)}
        a['samplers'] = [a['samplers'][o] for o in used]
        for c in keep:
            c['sampler'] = rm[c['sampler']]
        a['channels'] = keep
    acc_used = set()
    for m in g.get('meshes', []):
        for p in m['primitives']:
            acc_used |= set(p['attributes'].values())
            if 'indices' in p:
                acc_used.add(p['indices'])
    for sk in g.get('skins', []):
        if 'inverseBindMatrices' in sk:
            acc_used.add(sk['inverseBindMatrices'])
    for a in g.get('animations', []):
        for sm in a['samplers']:
            acc_used |= {sm['input'], sm['output']}
    acc_map = {o: i for i, o in enumerate(sorted(acc_used))}
    new_acc = [g['accessors'][o] for o in sorted(acc_used)]
    bv_used = sorted({a['bufferView'] for a in new_acc})
    bv_map, new_bv, out = {}, [], bytearray()
    for o in bv_used:
        bv = dict(g['bufferViews'][o])
        chunk = binb[bv.get('byteOffset', 0):bv.get('byteOffset', 0) + bv['byteLength']]
        while len(out) % 4:
            out += b'\0'
        bv['byteOffset'] = len(out)
        out += chunk
        bv_map[o] = len(new_bv)
        new_bv.append(bv)
    for a in new_acc:
        a['bufferView'] = bv_map[a['bufferView']]
    for m in g.get('meshes', []):
        for p in m['primitives']:
            p['attributes'] = {k: acc_map[v] for k, v in p['attributes'].items()}
            if 'indices' in p:
                p['indices'] = acc_map[p['indices']]
    for sk in g.get('skins', []):
        if 'inverseBindMatrices' in sk:
            sk['inverseBindMatrices'] = acc_map[sk['inverseBindMatrices']]
    for a in g.get('animations', []):
        for sm in a['samplers']:
            sm['input'], sm['output'] = acc_map[sm['input']], acc_map[sm['output']]
    g['accessors'], g['bufferViews'] = new_acc, new_bv
    while len(out) % 4:
        out += b'\0'
    g['buffers'] = [{'byteLength': len(out)}]
    js = json.dumps(g, separators=(',', ':')).encode()
    js += b' ' * ((4 - len(js) % 4) % 4)
    total = 12 + 8 + len(js) + 8 + len(out)
    with open(path, 'wb') as fo:
        fo.write(struct.pack('<III', 0x46546C67, 2, total))
        fo.write(struct.pack('<II', len(js), 0x4E4F534A)); fo.write(js)
        fo.write(struct.pack('<II', len(out), 0x004E4942)); fo.write(out)
    print(f'slim  {os.path.basename(path)}  {len(data) / 1024:.0f} KB -> {total / 1024:.0f} KB')


GLB = export_glb('fisher.glb')
slim_glb(GLB)
