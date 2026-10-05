# 珊瑚灣垂釣（201）：戴斗笠的漁夫 → blender/out/fisher.glb
# 執行：/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P blender/fisher.py
# 契約見 SPEC.md：骨架 fisher_rig、蒙皮網格 fisher（含斗笠與釣竿，全部 bind_rigid）、八個動作。
#
# 動作的做法：每個動作是「時間 → 姿勢規格」的函數，每一影格用自己的解算器求出各骨頭的旋轉後打關鍵影格
# （匯出本來就逐格取樣，逐格打鍵沒有額外成本，也不會有貝茲過衝造成的滑步）。
#  - 軀幹、頭：以「世界軸」的尤拉角（度）描述相對父骨的轉動（+X 前傾、+Y 往角色左倒、+Z 往角色左轉）。
#  - 手臂、腿：兩節 IK。手的目標點與手肘方向用「胸部靜止座標」描述（跟著身體走），腳踝用世界座標。
#  - 釣竿：rod_0 直接給竿的方向（胸部座標），rod_1～rod_3 往下彎的角度；左手可以貼在竿上的某一點（捲線器把手）。
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *
import math, random
from mathutils import Vector, Matrix, Quaternion, Euler

FPS = 30
scene = reset()

# ---------------- 材質（SPEC 調色盤） ----------------
SHIRT = mat('fisher_shirt', '#e9967a')
PANTS = mat('fisher_pants', '#56717f')
SKIN = mat('fisher_skin', '#e7b58f')
BELT = mat('fisher_belt', '#7d5f45')
STRAW = mat('fisher_straw', '#e8c983')
STRAW_D = mat('fisher_straw_dark', '#c9a35f')
INK = mat('fisher_ink', '#3b3732')
TOWEL = mat('fisher_towel', '#fbf3e2')
BLUSH = mat('fisher_blush', '#f4a196')
WOOD = mat('fisher_wood', '#c49a6c')
WOOD_D = mat('fisher_wood_dark', '#7d5f45')
STRIPE = mat('fisher_stripe', '#8fc9c0')
for m_ in (STRAW, STRAW_D, TOWEL):
    m_.use_backface_culling = False

# ---------------- 骨架（靜止姿勢：雙臂自然下垂，竿從右手往正前方 -Y 水平伸出） ----------------
SH_L, EL_L, WR_L = Vector((0.20, 0, 1.19)), Vector((0.222, 0, 0.92)), Vector((0.236, 0, 0.67))
HAND_OFF = 0.045                       # 手腕 → 手掌中心（沿前臂方向）
def mirror(v): return Vector((-v.x, v.y, v.z))
SH_R, EL_R, WR_R = mirror(SH_L), mirror(EL_L), mirror(WR_L)
HC_L = WR_L + (WR_L - EL_L).normalized() * HAND_OFF
HC_R = mirror(HC_L)                     # 右手掌中心＝握把＝rod_0 的 head
HIP_L, KNEE_L, ANK_L = Vector((0.10, 0, 0.80)), Vector((0.10, 0, 0.44)), Vector((0.10, 0, 0.08))
TOE = Vector((0, -0.115, -0.08))        # 腳踝 → 腳尖著地點
G = HC_R.copy()
ROD_SEG = [0.0, 0.55, 1.05, 1.55, 2.0]  # 握把往前的距離；握把後還有 0.2 m 竿尾，總長 2.2 m
BUTT = 0.20


def rp(d):   # 竿上距握把 d（往前為正）的靜止座標
    return G + Vector((0, -d, 0))


# 捲線器（掛在竿下、握把前方；把手在角色左側 +X）。把手臂與把手球綁在 reel_crank 骨上，繞 +X 軸轉。
RC = Vector((0, -0.065, -0.075))         # 捲線器中心（相對握把，竿的靜止座標）＝ reel_crank 的 head
KNOB = Vector((0.072, -0.065, -0.12))    # 把手球（crank = 0 時在正下方）


BONES = [
    ('root', (0, 0, 0), (0, 0, 0.2), None),
    ('hips', (0, 0, 0.82), (0, 0, 0.92), 'root'),
    ('spine', (0, 0, 0.92), (0, 0, 1.06), 'hips'),
    ('chest', (0, 0, 1.06), (0, 0, 1.24), 'spine'),
    ('neck', (0, 0, 1.24), (0, 0, 1.32), 'chest'),
    ('head', (0, 0, 1.32), (0, 0, 1.62), 'neck'),
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

# ---------------- 網格工具 ----------------

def _perp(axis):
    a = axis.normalized()
    ref = Vector((1, 0, 0)) if abs(a.x) < 0.9 else Vector((0, 1, 0))
    u = (ref - a * ref.dot(a)).normalized()
    return u, a.cross(u).normalized()


def loft(name, material, rings, sides=8, axis=None, caps=(True, True), phase=0.5):
    """rings：[(中心, rx, ry), ...]；環面垂直於 axis（預設為相鄰中心的連線）。"""
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


def _fix_normals(o):
    import bmesh
    bm = bmesh.new()
    bm.from_mesh(o.data)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(o.data)
    bm.free()


def finish(o, j=0.006, seed=1):
    jitter(o, j, seed)
    flat(o)
    return o


parts = []


def add(o, bone, j=0.006):
    finish(o, j, len(parts) + 7)
    parts.append((o, bone))
    return o


# ---------------- 身體 ----------------
# 骨盆與褲頭
add(loft('pelvis', PANTS, [((0, 0.005, 0.70), 0.12, 0.10), ((0, 0.005, 0.80), 0.15, 0.115),
                           ((0, 0, 0.92), 0.148, 0.115)], 8), 'hips')
# 上衣：腰 → 胸 → 肩（往上略寬），衣襬蓋住腰帶上緣
add(loft('shirt_low', SHIRT, [((0, 0, 0.83), 0.163, 0.128), ((0, 0, 0.95), 0.158, 0.122),
                              ((0, 0, 1.08), 0.160, 0.122)], 8), 'spine')
add(loft('shirt_up', SHIRT, [((0, 0, 1.03), 0.160, 0.122), ((0, 0, 1.16), 0.180, 0.125),
                             ((0, 0.005, 1.25), 0.135, 0.105)], 8), 'chest')
# V 領露出的胸口
add(loft('collar_skin', SKIN, [((0, -0.095, 1.17), 0.045, 0.02), ((0, -0.085, 1.245), 0.07, 0.03)], 6,
         axis=(0, 0.15, 1)), 'chest')
# 腰帶與前面的結
add(loft('belt', BELT, [((0, 0, 0.855), 0.170, 0.134), ((0, 0, 0.905), 0.170, 0.134)], 10), 'hips')
add(box('belt_knot', BELT, (0.06, -0.135, 0.88), (0.028, 0.018, 0.03), rot=(0, 0, 8)), 'hips')
add(box('belt_tail', BELT, (0.075, -0.14, 0.83), (0.016, 0.008, 0.045), rot=(0, 12, 8)), 'hips')
# 脖子與毛巾
add(tube('neck', SKIN, (0, 0, 1.20), (0, 0, 1.36), 0.055, 0.05, 7), 'neck')
towel = loft('towel_ring', TOWEL, [((0, 0.01, 1.235), 0.115, 0.10), ((0, 0.01, 1.285), 0.095, 0.085)], 10)
add(towel, 'chest', 0.004)
add(loft('towel_end_l', TOWEL, [((0.07, -0.09, 1.27), 0.034, 0.014), ((0.085, -0.122, 1.17), 0.032, 0.012),
                                 ((0.09, -0.13, 1.08), 0.03, 0.011)], 6), 'chest', 0.003)
add(loft('towel_end_r', TOWEL, [((-0.07, -0.09, 1.27), 0.032, 0.014), ((-0.08, -0.124, 1.18), 0.03, 0.012)], 6),
    'chest', 0.003)
add(loft('towel_stripe', STRIPE, [((0.088, -0.128, 1.115), 0.035, 0.0135), ((0.089, -0.129, 1.095), 0.034, 0.0135)], 6),
    'chest', 0.0)

# ---------------- 頭 ----------------
HEAD_C = Vector((0, 0.0, 1.465))
add(ball('head', SKIN, HEAD_C, (0.172, 0.162, 0.158), 2), 'head', 0.004)
# 頭髮：貼在頭殼外的經緯網格殼（後腦與兩側，斗笠下露出一圈）。髮際線是依方位角插值的平滑曲線：
# 前額藏在帽箍裡、耳朵上方繞過、耳後往下收到後頸最低；最後一圈收進頭皮裡形成髮緣，
# 不用刪面切口，所以後腦下緣不會有鋸齒或露出膚色的缺口。厚度後腦 2.6 cm、兩側約 1.6 cm（耳朵露在髮際下）。
HEAD_R = Vector((0.172, 0.162, 0.158))
HAIRLINE = [(0, -46), (30, -42), (48, -32), (60, -14), (67, 8), (73, 17), (112, 17), (140, 24), (180, 38)]


def hair_shell(ns=24, nr=6):
    def line(a):                        # a：離後腦中線的方位角（度，0＝正後方 +Y，180＝正前方）→ 髮際仰角（度）
        for (a0, e0), (a1, e1) in zip(HAIRLINE, HAIRLINE[1:]):
            if a <= a1:
                return e0 + (e1 - e0) * (a - a0) / (a1 - a0)
        return HAIRLINE[-1][1]

    def thick(a):
        return 0.010 + 0.016 * (0.5 + 0.5 * math.cos(math.radians(a))) ** 1.5

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
        for k in range(1, nr + 1):     # 主殼：從頂點到髮際上方 5°
            col.append(len(verts)); verts.append(pt(th, 90 - (85 - e) * k / nr, t))
        col.append(len(verts)); verts.append(pt(th, e, -0.006))   # 髮緣：收進頭皮 6 mm
        cols.append(col)
    faces = []
    for i in range(ns):
        a, b = cols[i], cols[(i + 1) % ns]
        faces.append((0, a[0], b[0]))
        for k in range(nr):
            faces.append((a[k], a[k + 1], b[k + 1], b[k]))
    o = mesh_from('hair', verts, faces, INK)
    _fix_normals(o)
    return o


add(hair_shell(), 'head', 0.004)
add(ball('bun', INK, HEAD_C + Vector((0, 0.16, -0.02)), (0.05, 0.045, 0.045), 1), 'head', 0.003)
for s in (1, -1):
    add(ball(f'ear_{s}', SKIN, HEAD_C + Vector((0.165 * s, 0.01, -0.01)), (0.025, 0.035, 0.04), 1), 'head', 0.002)
    add(ball(f'eye_{s}', INK, HEAD_C + Vector((0.058 * s, -0.141, 0.002)), (0.016, 0.009, 0.024), 1), 'head', 0.0)
    add(ball(f'blush_{s}', BLUSH, HEAD_C + Vector((0.098 * s, -0.128, -0.045)), (0.026, 0.01, 0.016), 1), 'head', 0.0)
add(ball('nose', SKIN, HEAD_C + Vector((0, -0.158, -0.03)), (0.018, 0.016, 0.016), 1), 'head', 0.0)
add(box('mouth', INK, HEAD_C + Vector((0, -0.136, -0.075)), (0.016, 0.006, 0.0035)), 'head', 0.0)

# ---------------- 斗笠（外殼＋內殼＋帽緣；下半圈深淺交錯的放射竹編、頂尖、內圈頭箍與下巴繫繩） ----------------
HAT_Z, HAT_R, HAT_H, HAT_T = 1.545, 0.45, 0.30, 0.022


def hat():
    N = 16
    verts, faces, mats = [], [], []
    def ring(r, z):
        base = len(verts)
        for i in range(N):
            a = (i + 0.5) / N * math.tau
            verts.append((math.cos(a) * r, math.sin(a) * r, z))
        return base
    o0 = ring(HAT_R, HAT_Z)
    o1 = ring(HAT_R * 0.5, HAT_Z + HAT_H * 0.5)
    oa = len(verts); verts.append((0, 0, HAT_Z + HAT_H))
    i0 = ring(HAT_R - 0.012, HAT_Z - HAT_T)
    i1 = ring(HAT_R * 0.5 - 0.01, HAT_Z + HAT_H * 0.5 - HAT_T)
    ia = len(verts); verts.append((0, 0, HAT_Z + HAT_H - HAT_T * 1.5))
    for i in range(N):
        j = (i + 1) % N
        faces.append((o0 + i, o0 + j, o1 + j, o1 + i)); mats.append(i % 2)
        faces.append((o1 + i, o1 + j, oa)); mats.append(0)
        faces.append((i0 + j, i0 + i, i1 + i, i1 + j)); mats.append(1)
        faces.append((i1 + j, i1 + i, ia)); mats.append(1)
        faces.append((o0 + j, o0 + i, i0 + i, i0 + j)); mats.append(1)
    o = mesh_from('hat', [Vector(v) + Vector((0, 0, 0)) for v in verts], faces, STRAW)
    o.data.materials.append(STRAW_D)
    for p, m_ in zip(o.data.polygons, mats):
        p.material_index = m_
    _fix_normals(o)
    return o


add(hat(), 'head', 0.007)
# 帽緣下的一圈深色編邊
add(loft('hat_rim', STRAW_D, [((0, 0, HAT_Z - 0.024), HAT_R + 0.008, HAT_R + 0.008),
                              ((0, 0, HAT_Z + 0.006), HAT_R + 0.006, HAT_R + 0.006)], 16, caps=(False, False)), 'head', 0.004)
# 頂尖
add(loft('hat_tip', WOOD_D, [((0, 0, HAT_Z + HAT_H - 0.03), 0.04, 0.04), ((0, 0, HAT_Z + HAT_H + 0.035), 0.004, 0.004)],
         6), 'head', 0.0)
# 帽內頭箍（讓斗笠看起來是戴在頭上，不是浮著）
add(loft('hat_band', STRAW_D, [((0, 0.005, 1.535), 0.162, 0.152), ((0, 0.005, 1.60), 0.15, 0.14)], 10), 'head', 0.003)
# 下巴繫繩：帽箍兩側 → 臉頰 → 下巴的小結
CHIN = HEAD_C + Vector((0, -0.118, -0.135))
for s in (1, -1):
    a = Vector((0.158 * s, -0.01, 1.545)); b = Vector((0.142 * s, -0.075, 1.40))
    add(tube(f'strap_a{s}', STRAW_D, a, b, 0.007, 0.007, 4), 'head', 0.0)
    add(tube(f'strap_b{s}', STRAW_D, b, CHIN, 0.007, 0.007, 4), 'head', 0.0)
add(ball('strap_knot', STRAW_D, CHIN, (0.016, 0.014, 0.014), 1), 'head', 0.0)

# ---------------- 手臂（短袖：袖口略寬，肩頭用球蓋住旋轉縫） ----------------
for s, sh, el, wr, hc in ((1, SH_L, EL_L, WR_L, HC_L), (-1, SH_R, EL_R, WR_R, HC_R)):
    side = 'L' if s > 0 else 'R'
    up, fo, ha = f'upperarm_{side}', f'forearm_{side}', f'hand_{side}'
    d = (el - sh).normalized()
    add(ball(f'shoulder_{side}', SHIRT, sh + Vector((0.008 * s, 0, -0.005)), (0.076, 0.072, 0.072), 1), up)
    add(tube(f'sleeve_{side}', SHIRT, sh, sh + d * 0.175, 0.066, 0.072, 7), up)
    add(tube(f'sleeve_hem_{side}', SHIRT, sh + d * 0.165, sh + d * 0.19, 0.075, 0.073, 7), up)
    add(tube(f'uarm_{side}', SKIN, sh + d * 0.12, el, 0.043, 0.04, 6), up)
    add(ball(f'elbow_{side}', SKIN, el, 0.041, 1), fo)
    add(tube(f'farm_{side}', SKIN, el, wr, 0.04, 0.034, 6), fo)
    add(ball(f'hand_{side}', SKIN, hc, (0.048, 0.044, 0.052), 1), ha, 0.004)
    add(ball(f'thumb_{side}', SKIN, hc + Vector((-0.012 * s, -0.035, 0.02)), (0.018, 0.02, 0.026), 1), ha, 0.002)

# ---------------- 腿（褲管捲到小腿，捲邊一圈；草鞋） ----------------
for s, hip, kn, an in ((1, HIP_L, KNEE_L, ANK_L), (-1, mirror(HIP_L), mirror(KNEE_L), mirror(ANK_L))):
    side = 'L' if s > 0 else 'R'
    th, sn, ft = f'thigh_{side}', f'shin_{side}', f'foot_{side}'
    add(tube(f'thighm_{side}', PANTS, hip + Vector((0, 0, 0.04)), kn, 0.082, 0.068, 7), th)
    add(ball(f'knee_{side}', PANTS, kn, 0.068, 1), sn)
    add(tube(f'shinp_{side}', PANTS, kn, kn + Vector((0, 0, -0.13)), 0.066, 0.064, 7), sn)
    add(tube(f'cuff_{side}', PANTS, kn + Vector((0, 0, -0.12)), kn + Vector((0, 0, -0.17)), 0.074, 0.074, 7), sn)
    add(tube(f'calf_{side}', SKIN, kn + Vector((0, 0, -0.15)), an + Vector((0, 0, 0.01)), 0.046, 0.034, 6), sn)
    add(ball(f'ankle_{side}', SKIN, an, 0.037, 1), ft)
    add(loft(f'footm_{side}', SKIN, [((an.x, 0.035, 0.035), 0.036, 0.026), ((an.x, -0.05, 0.04), 0.042, 0.03),
                                     ((an.x, -0.115, 0.03), 0.038, 0.014)], 7, axis=(0, -1, 0)), ft)
    add(box(f'sole_{side}', STRAW_D, (an.x, -0.04, 0.008), (0.05, 0.088, 0.009)), ft, 0.003)
    add(box(f'thong_{side}', WOOD_D, (an.x, -0.055, 0.05), (0.045, 0.012, 0.012), rot=(0, 0, 0)), ft, 0.002)

# ---------------- 釣竿（竹竿四節＋竹節環＋軟木握把＋捲線器） ----------------
add(tube('rod_grip', WOOD, rp(-BUTT), rp(0.10), 0.020, 0.018, 6), 'rod_0', 0.0)
add(ball('rod_butt', WOOD_D, rp(-BUTT), (0.022, 0.016, 0.022), 1), 'rod_0', 0.0)
add(tube('rod_seat', WOOD_D, rp(0.10), rp(0.13), 0.021, 0.019, 6), 'rod_0', 0.0)
RADII = [0.0155, 0.0125, 0.010, 0.0075, 0.0055]
for k in range(4):
    a, b = max(ROD_SEG[k], 0.12), ROD_SEG[k + 1]
    add(tube(f'rod_seg{k}', STRAW, rp(a), rp(b), RADII[k], RADII[k + 1], 5), f'rod_{k}', 0.0)
    if k:
        add(tube(f'rod_node{k}', STRAW_D, rp(ROD_SEG[k] - 0.012), rp(ROD_SEG[k] + 0.012), RADII[k] + 0.004,
                 RADII[k] + 0.004, 5), f'rod_{k}', 0.0)
add(ball('rod_tiptop', INK, rp(ROD_SEG[4]), 0.009, 1), 'rod_3', 0.0)
# 捲線器：本體與線軸綁 rod_0；軸、把手臂、把手球綁 reel_crank（reel 動作裡跟著左手轉）
add(tube('reel_stem', WOOD_D, G + Vector((0, -0.065, -0.012)), G + RC + Vector((0, 0, 0.02)), 0.008, 0.008, 5), 'rod_0', 0.0)
add(tube('reel_body', WOOD_D, G + RC + Vector((0, 0.03, 0)), G + RC + Vector((0, -0.03, 0)), 0.03, 0.03, 8), 'rod_0', 0.0)
add(tube('reel_spool', TOWEL, G + RC + Vector((0, -0.03, 0)), G + RC + Vector((0, -0.055, 0)), 0.026, 0.022, 8), 'rod_0', 0.0)
add(tube('reel_axle', INK, G + RC + Vector((0.03, 0, 0)), G + RC + Vector((0.06, 0, 0)), 0.006, 0.006, 5), 'reel_crank', 0.0)
add(tube('reel_arm', INK, G + RC + Vector((0.06, 0, 0)), G + KNOB + Vector((-0.012, 0, 0)), 0.006, 0.006, 4), 'reel_crank', 0.0)
add(ball('reel_knob', SHIRT, G + KNOB, (0.012, 0.012, 0.015), 1), 'reel_crank', 0.0)

body = bind_rigid(parts, arm, 'fisher')

# ---------------- 姿勢解算 ----------------
RH = {b.name: b.head_local.copy() for b in arm.data.bones}
RR = {b.name: b.matrix_local.to_3x3() for b in arm.data.bones}
PAR = {b.name: (b.parent.name if b.parent else None) for b in arm.data.bones}
LEN = {b.name: b.length for b in arm.data.bones}


def crank_rot(phi):
    """reel_crank 相對 rod_0 的轉動：繞捲線器軸（竿靜止座標 +X）轉 phi；phi 增加時把手球在下方往前、上方往後。"""
    return Matrix.Rotation(-phi, 3, 'X')


# 左手「拳心」：手掌球與拇指球的中點（手骨靜止座標），握竿或握把手球時讓它落在握點上
GRIP_L = HC_L + Vector((-0.006, -0.0175, 0.010))


def frame3(y, x):
    """以 y 為長軸、x 為參考側軸的正交基底（欄向量）。"""
    y = y.normalized()
    x = (x - y * x.dot(y)).normalized()
    return Matrix((x, y, x.cross(y))).transposed()


def limb_rest(sh, el, tgt, pole):
    u0 = (tgt - sh).normalized()
    w0 = (pole - u0 * pole.dot(u0)).normalized()
    n0 = u0.cross(w0).normalized()
    return dict(a=(el - sh).length, b=(tgt - el).length,
                fu=frame3(el - sh, n0).inverted(), fl=frame3(tgt - el, n0).inverted())


REST_LIMB = {
    'L': limb_rest(SH_L, EL_L, HC_L, Vector((0, 1, 0))), 'R': limb_rest(SH_R, EL_R, HC_R, Vector((0, 1, 0))),
    'lL': limb_rest(HIP_L, KNEE_L, ANK_L, Vector((0, -1, 0))),
    'lR': limb_rest(mirror(HIP_L), mirror(KNEE_L), mirror(ANK_L), Vector((0, -1, 0))),
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
    # 右手 → 竿
    ch('upperarm_R')
    D['upperarm_R'], D['forearm_R'] = ik(H['upperarm_R'], C(sp['handR']), Cd(sp['poleR']), REST_LIMB['R'], 'armR')
    ch('forearm_R'); ch('hand_R')
    D['hand_R'] = D['forearm_R']
    ch('rod_0')
    f, up = Cd(sp['rodDir']).normalized(), Cd(sp['rodUp'])
    D['rod_0'] = frame3(f, f.cross(up)) @ ROD_REST
    ch('reel_crank')
    D['reel_crank'] = D['rod_0'] @ crank_rot(sp['crank'])
    for k in (1, 2, 3):
        ch(f'rod_{k}')
        D[f'rod_{k}'] = D[f'rod_{k - 1}'] @ E((sp['bend'][k - 1], 0, 0))
    ch('rod_tip'); D['rod_tip'] = D['rod_3']
    # 左手：胸部座標的點與竿上某點（握點）之間混合。握在竿上時讓「拳心」GRIP_L 落在該點：
    # 先解一次 IK，量出掌心 → 拳心的偏移，再把掌心目標往回移，迭代幾次就收斂（手的朝向只隨前臂微變）。
    rodpt = H['rod_0'] + D['rod_0'] @ V(sp['offL'])
    ch('upperarm_L')
    off = Vector((0, 0, 0))
    for _ in range(4):
        tL = C(sp['handL']).lerp(rodpt - off, sp['wL'])
        D['upperarm_L'], D['forearm_L'] = ik(H['upperarm_L'], tL, Cd(sp['poleL']), REST_LIMB['L'], 'armL')
        ch('forearm_L'); ch('hand_L')
        D['hand_L'] = D['forearm_L']
        off = D['hand_L'] @ (GRIP_L - HC_L)
    # 局部旋轉
    loc = {}
    rot = {}
    for n in BN:
        Dp = D[PAR[n]] if PAR[n] else Matrix.Identity(3)
        rot[n] = (RR[n].inverted() @ Dp.inverted() @ D[n] @ RR[n]).to_quaternion()
    loc['root'] = RR['root'].inverted() @ V(sp['root'])
    return rot, loc, D, H, tL


# ---------------- 姿勢規格與插值 ----------------

def mix(a, b, u):
    if isinstance(a, dict):
        return {k: mix(a[k], b[k], u) for k in a}
    if isinstance(a, (tuple, list)):
        return tuple(x + (y - x) * u for x, y in zip(a, b))
    return a + (b - a) * u


def smooth(u):
    return u * u * (3 - 2 * u)


def tr(t, keys, ease=smooth):
    """keys：[(時間, 值), ...] 依時間插值（預設 smoothstep）。值可以是數字、tuple 或 dict。"""
    if t <= keys[0][0]:
        return keys[0][1]
    for (t0, a), (t1, b) in zip(keys, keys[1:]):
        if t <= t1:
            return mix(a, b, ease((t - t0) / (t1 - t0)))
    return keys[-1][1]


def step(t, t0, t1, a, b, h):
    """腳踝在 t0～t1 從 a 跨到 b：水平 smoothstep，同時抬高 h（sin 曲線，一開始就離地，不會貼地滑）。"""
    u = min(1.0, max(0.0, (t - t0) / (t1 - t0)))
    p = mix(a, b, smooth(u))
    return (p[0], p[1], p[2] + h * math.sin(math.pi * u))


def knob(phi):
    """捲線器把手轉到 phi（弧度）時，把手球在竿靜止座標（相對握把）的位置＝左手拳心要握的點。"""
    return tuple(RC + crank_rot(phi) @ (KNOB - RC))


IDLE = dict(
    root=(0, 0, -0.012), hips=(0, 0, 0), spine=(0, 0, 0), chest=(0, 0, 0), neck=(0, 0, 0), head=(0, 0, 0),
    ankL=(0.115, 0.0, 0.08), pitL=0, yawL=6, kpoleL=(0.15, -1, 0),
    ankR=(-0.115, 0.0, 0.08), pitR=0, yawR=-6, kpoleR=(-0.15, -1, 0),
    handR=(-0.215, -0.20, 1.17), poleR=(-0.25, 0.25, -1), rodDir=(-0.21, 0.86, 0.47), rodUp=(0.6, 0, 1),
    bend=(0, 0, 0),
    handL=(0.25, 0.01, 0.645), poleL=(0.2, 1, 0), wL=0.0, offL=knob(0), crank=0.0,
)


def P(base=IDLE, **kw):
    d = dict(base)
    d.update(kw)
    return d


WAIT = P(root=(0.0, 0.01, -0.035), spine=(3, 0, -4), chest=(2, 0, -6), neck=(2, 0, 4), head=(5, 0, 6),
         ankL=(0.13, -0.11, 0.08), yawL=10, ankR=(-0.12, 0.09, 0.08), yawR=-16,
         handR=(-0.11, -0.33, 1.0), poleR=(-0.6, 0.3, -1), rodDir=(0.16, -0.83, 0.54), rodUp=(0, 0, 1),
         handL=(0.10, -0.35, 0.93), poleL=(0.6, 0.2, -1), wL=1.0, offL=knob(0))
# 收線的站位和 WAIT 相同（腳不動，只靠身體後仰），hook、reel → stow 的交叉淡入與 cheer 開頭都不會滑步
REEL = P(WAIT, root=(0.0, 0.035, -0.055), spine=(-6, 0, -4), chest=(-4, 0, -6), neck=(4, 0, 4), head=(6, 0, 6),
         handR=(-0.10, -0.31, 1.06), rodDir=(0.15, -0.79, 0.60), bend=(7, 10, 14))


def key_action(name, n_frames, fn, cyclic):
    begin_action(arm, name)
    for pb in arm.pose.bones:
        pb.rotation_quaternion = (1, 0, 0, 0)
    prev = {}
    for f in range(n_frames + 1):
        t = f / FPS
        sp = fn(t)
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
        act = arm.animation_data.action
        if getattr(act, 'slots', None) and len(act.slots) and arm.animation_data.action_slot is None:
            arm.animation_data.action_slot = act.slots[0]
    end_action(arm, cyclic=cyclic, interp='LINEAR')
    return act


# ---------------- 八個動作 ----------------
T_IDLE, T_WALK, T_CAST, T_WAIT, T_HOOK, T_REEL, T_STOW, T_CHEER = 2.0, 0.9, 1.0, 2.4, 0.4, 0.6, 0.8, 1.2


def add3(a, b):
    return tuple(x + y for x, y in zip(a, b))


def idle(t):
    s = math.sin(t / T_IDLE * math.tau)
    c = math.cos(t / T_IDLE * math.tau)
    return P(root=(0, 0, -0.012 - 0.004 * (1 - c) / 2), chest=(-1.2 * s, 0, 0), neck=(0.8 * s, 0, 0),
             head=(0.6 * s, 0, 1.5 * math.sin(t / T_IDLE * math.tau * 0.5) * 0),
             handR=add3(IDLE['handR'], (0, 0, 0.004 * s)), handL=add3(IDLE['handL'], (0, 0.006 * s, 0.003 * s)))


# walk：原地走，支撐腳的腳尖以 1.6 m/s 往後退（一個循環 1.44 m＝兩步各 0.72 m），抬跟時以腳尖為支點
V_WALK = 1.6
CYC = V_WALK * T_WALK
STANCE = 0.47
TOE_C = -0.335                         # 著地時腳尖的 y（腳踝在 TOE_C + 0.115）
TOE_T = TOE_C + CYC * STANCE           # 離地時腳尖的 y
TOE_HO = -0.02                         # 腳尖過了這裡開始抬跟
PIT_OFF = 52


def foot_at(psi, x):
    """psi：這隻腳的相位（0＝著地）。回傳 (腳踝位置, 俯仰角)。"""
    back = Vector((0, -TOE.y, -TOE.z))   # 腳尖 → 腳踝
    if psi < STANCE:
        ty = TOE_C + CYC * psi
        pit = 0.0
        if ty > TOE_HO:
            pit = PIT_OFF * ((ty - TOE_HO) / (TOE_T - TOE_HO)) ** 1.6
        a = Vector((x, ty, 0)) + E((pit, 0, 0)) @ back
        return a, pit
    u = (psi - STANCE) / (1 - STANCE)
    a0 = Vector((x, TOE_T, 0)) + E((PIT_OFF, 0, 0)) @ back
    a1 = Vector((x, TOE_C, 0)) + back
    e = 0.5 - 0.5 * math.cos(math.pi * u)
    y = a0.y + (a1.y - a0.y) * e
    z = a0.z + (a1.z - a0.z) * u + 0.075 * math.sin(math.pi * min(1, u * 1.15)) ** 1.2
    if u < 0.55:
        pit = PIT_OFF + (-14 - PIT_OFF) * smooth(u / 0.55)
    else:
        pit = -14 + 14 * smooth((u - 0.55) / 0.45)
    return Vector((x, y, z)), pit


def walk(t):
    ph = t / T_WALK
    w = math.tau * ph
    aL, pL = foot_at(ph % 1.0, 0.11)
    aR, pR = foot_at((ph + 0.5) % 1.0, -0.11)
    bob = -0.058 + 0.03 * (0.5 - 0.5 * math.cos(2 * w - 2 * math.tau * 0.235))
    sway = 0.014 * math.sin(w - 0.4)
    swing = math.cos(w)                  # +1：左腳在前（左手在後）
    return P(root=(sway, 0, bob), hips=(0, -1.5 * math.sin(w), -7 * swing), spine=(5, 0, 3 * swing),
             chest=(1, 1.0 * math.sin(w), 4 * swing), neck=(-2, 0, 0), head=(-1 + 1.5 * math.cos(2 * w), 0, 0),
             ankL=tuple(aL), pitL=pL, yawL=4, ankR=tuple(aR), pitR=pR, yawR=-4,
             handR=add3(IDLE['handR'], (0, 0, 0.012 * math.cos(2 * w))),
             rodDir=add3(IDLE['rodDir'], (0, 0, 0.03 * math.cos(2 * w + 0.6))),
             handL=(0.255, 0.13 * swing, 0.655 + 0.03 * abs(swing)), poleL=(0.3, 1, 0.1))


BUTT_GRIP = (0.0, 0.20, 0.0)            # 甩竿時左手握竿尾（拳頭包住竿尾蓋，竿身不會從拳頭後方穿進前臂）
# cast：0～0.45 s 竿往右後上方舉起蓄力（側甩，竿從斗笠外側繞），0.45～0.65 s 往前甩，0.55 s 出線，1.0 s 停在 WAIT
CHARGE = P(WAIT, root=(-0.02, 0.05, -0.05), hips=(0, 0, -8), spine=(-4, -3, -12), chest=(-3, -2, -14),
           neck=(0, 0, 12), head=(2, 0, 14),
           handR=(-0.24, -0.14, 1.24), poleR=(-0.6, 0.2, -1), rodDir=(-0.62, 0.52, 0.58), rodUp=(-0.5, 0.4, 1),
           handL=(0.05, -0.30, 1.05), poleL=(0.6, -0.4, -1), wL=1.0, offL=BUTT_GRIP, bend=(-3, -4, -6))
SWING = P(WAIT, root=(0, 0.0, -0.045), spine=(3, 0, -2), chest=(3, 0, 0), neck=(0, 0, 2), head=(3, 0, 2),
          handR=(-0.22, -0.34, 1.18), poleR=(-0.6, 0.3, -1), rodDir=(-0.35, -0.55, 0.76), rodUp=(-0.3, 0.3, 1),
          handL=(0.05, -0.30, 1.0), poleL=(0.6, -0.4, -1), wL=1.0, offL=BUTT_GRIP, bend=(-5, -8, -11))
FOLLOW = P(WAIT, root=(0, -0.03, -0.05), spine=(7, 0, 2), chest=(5, 0, 4), neck=(0, 0, 0), head=(2, 0, 0),
           handR=(-0.15, -0.43, 1.05), rodDir=(0.10, -0.97, 0.24), bend=(5, 8, 11),
           poleL=(0.6, -0.4, -1), offL=BUTT_GRIP)


def cast(t):
    base = tr(t, [(0.0, IDLE), (0.45, CHARGE), (0.55, SWING), (0.65, FOLLOW), (1.0, WAIT)])
    # 左手：0.10～0.32 s 先往前外側抬（繞過腰帶與大腿）再從胸前握住竿尾，0.65～1.0 s 沿竿換到捲線器把手球。
    # 蓄力時右手收在右胸前、竿尾落在胸口正前方，左前臂從胸前橫過去，不會穿進軀幹（遊戲蓄力時定在 0.42 s）。
    wL = tr(t, [(0.10, 0.0), (0.32, 1.0)])
    handL = tr(t, [(0.0, IDLE['handL']), (0.14, (0.24, -0.22, 0.84)), (0.32, CHARGE['handL'])])
    offL = tr(t, [(0.65, BUTT_GRIP), (1.0, knob(0))])
    # 左腳往前踏半步（0.10～0.35 s），右腳在甩竿時往後踏一步（0.52～0.74 s）；都是抬腳跨步，腳轉向也只在離地時改
    ankL = step(t, 0.10, 0.35, IDLE['ankL'], WAIT['ankL'], 0.05)
    ankR = step(t, 0.52, 0.74, IDLE['ankR'], WAIT['ankR'], 0.035)
    pitR = tr(t, [(0.52, 0.0), (0.62, 6.0), (0.74, 0.0)])
    yawL = tr(t, [(0.10, IDLE['yawL']), (0.35, WAIT['yawL'])])
    yawR = tr(t, [(0.52, IDLE['yawR']), (0.74, WAIT['yawR'])])
    return dict(base, wL=wL, offL=offL, handL=handL if t < 0.32 else base['handL'], ankL=ankL, ankR=ankR, pitR=pitR, yawL=yawL, yawR=yawR)


def wait(t):
    w = math.tau * t / T_WAIT
    return P(WAIT, root=add3(WAIT['root'], (0.004 * math.sin(w), 0, -0.004 * (1 - math.cos(2 * w)) / 2)),
             chest=add3(WAIT['chest'], (-1.0 * math.sin(2 * w), 0, 0)),
             head=add3(WAIT['head'], (0, 0, 3 * math.sin(w))),
             rodDir=add3(WAIT['rodDir'], (0.012 * math.sin(w), 0, 0.018 * math.sin(2 * w))))


HOOK_UP = P(REEL, root=(0, 0.04, -0.05), spine=(-12, 0, -6), chest=(-8, 0, -10), neck=(4, 0, 4), head=(-2, 0, 6),
            handR=(-0.12, -0.27, 1.10), rodDir=(-0.24, -0.40, 0.88), bend=(10, 15, 20))


def hook(t):
    base = tr(t, [(0.0, WAIT), (0.15, HOOK_UP), (0.4, REEL)])
    return dict(base, wL=1.0)


def reel(t):
    phi = math.tau * t / T_REEL
    s, c = math.sin(phi), math.cos(phi)
    return P(REEL, offL=knob(phi), crank=phi, root=add3(REEL['root'], (0, 0.004 * (c - 1), 0.004 * s)),
             chest=add3(REEL['chest'], (0.8 * s, 0, 1.2 * (c - 1))),
             bend=add3(REEL['bend'], (1.0 * s, 1.5 * s, 2.0 * s)),
             rodDir=add3(REEL['rodDir'], (0.008 * (c - 1), 0, 0.012 * s)))


STOW_UP = P(IDLE, root=(0, 0.01, -0.03), spine=(0, 0, -3), chest=(0, 0, -6), neck=(0, 0, 4), head=(0, 0, 4),
            ankL=WAIT['ankL'], yawL=WAIT['yawL'], ankR=WAIT['ankR'], yawR=WAIT['yawR'],
            handR=(-0.33, -0.16, 1.24), poleR=(-0.5, 0.3, -1), rodDir=(-0.58, -0.12, 0.81), rodUp=(-0.3, 0.3, 1),
            handL=(0.25, -0.02, 0.66), wL=0.0)
STOW_BACK = P(STOW_UP, handR=(-0.30, -0.15, 1.17), rodDir=(-0.58, 0.60, 0.55), rodUp=(-0.2, -0.3, 1))


def stow(t):
    base = tr(t, [(0.0, WAIT), (0.28, STOW_UP), (0.5, STOW_BACK), (0.8, IDLE)])
    wL = tr(t, [(0.0, 1.0), (0.18, 0.0)])
    # 兩腳各踏一步回到 IDLE 站位（右腳 0.25～0.42、左腳 0.40～0.66），腳的轉向只在離地時改
    ankR = step(t, 0.25, 0.42, WAIT['ankR'], IDLE['ankR'], 0.035)
    ankL = step(t, 0.40, 0.66, WAIT['ankL'], IDLE['ankL'], 0.04)
    yawR = tr(t, [(0.25, WAIT['yawR']), (0.42, IDLE['yawR'])])
    yawL = tr(t, [(0.40, WAIT['yawL']), (0.66, IDLE['yawL'])])
    return dict(base, wL=wL, ankL=ankL, ankR=ankR, yawL=yawL, yawR=yawR)


# cheer：從收線姿勢（= reel 的首尾幀）開始；竿先往右上收、再扛到右後方，左手先往外再往上伸直高舉
# （遊戲把魚掛在 hand_L 下方，所以手要在帽緣圓外側，魚才不會被斗笠蓋住），跳一下，結束時手仍舉著。
# 肩高 1.19、手長 0.566，伸直時手腕最高約 1.71（靜止座標）；要留在帽緣外側，手臂需外展約 38°。
def reach_L(d, frac=0.985):
    """左手從肩膀沿方向 d 伸直（胸部座標）時，手掌中心的位置。"""
    d = Vector(d).normalized()
    return tuple(SH_L + d * (REST_LIMB['L']['a'] + REST_LIMB['L']['b']) * frac)


UP_L = reach_L((0.61, -0.12, 0.78), 0.97)
CH_UP = P(STOW_UP, root=REEL['root'], handL=(0.40, -0.18, 1.02), poleL=(1, 0.3, -0.6))
CH_BACK = P(STOW_BACK, root=(0, 0.02, -0.07), handL=(0.52, -0.15, 1.16), poleL=(1, 0.3, -0.6))
CROUCH = P(IDLE, root=(0, 0.01, -0.10), spine=(6, -2, 0), chest=(2, -1, 0), head=(-4, 0, 4),
           handL=(0.57, -0.12, 1.31), poleL=(1, 0.3, -0.6), wL=0.0, ankL=IDLE['ankL'], ankR=IDLE['ankR'],
           handR=(-0.24, -0.15, 1.16), rodDir=(-0.58, 0.58, 0.57))
AIR = P(CROUCH, root=(0, 0, 0.21), spine=(-4, -2, 0), chest=(-4, -1, 0), head=(-7, -3, 10), handL=UP_L)
LAND = P(AIR, root=(0, 0, -0.075), spine=(5, -2, 0), chest=(2, -1, 0), head=(-3, -2, 8))
HOLD = P(AIR, root=(-0.02, 0, -0.015), spine=(-2, -1, 0), chest=(-2, -1, 0), head=(-6, -4, 12))


def cheer(t):
    base = tr(t, [(0.0, REEL), (0.08, REEL), (0.28, CH_UP), (0.40, CH_BACK), (0.50, CROUCH), (0.64, AIR),
                  (0.80, LAND), (0.98, HOLD), (1.2, HOLD)])
    wL = tr(t, [(0.06, 1.0), (0.24, 0.0)])
    # 腳：0.5 前收成並腳，0.55～0.78 離地
    tuck = 0.05 * math.sin(math.pi * min(1, max(0, (t - 0.56) / 0.20)))
    jz = (max(0.0, base['root'][2] + 0.02) if t < 0.85 else 0.0) + tuck   # 落地後腳貼地（HOLD 的 root 只略低）
    # 腳只在離地時（約 0.56～0.75 s）收回 IDLE 站位
    aL = tr(t, [(0.0, REEL['ankL']), (0.57, REEL['ankL']), (0.72, IDLE['ankL'])])
    aR = tr(t, [(0.0, REEL['ankR']), (0.57, REEL['ankR']), (0.72, IDLE['ankR'])])
    yL = tr(t, [(0.57, REEL['yawL']), (0.72, IDLE['yawL'])])
    yR = tr(t, [(0.57, REEL['yawR']), (0.72, IDLE['yawR'])])
    pit = tr(t, [(0.52, 0.0), (0.63, 18.0), (0.76, 0.0)])
    shake = 0.0 if t < 1.0 else 0.02 * math.sin((t - 1.0) * math.tau * 2.5) * (1 - (t - 1.0) / 0.2)
    hL = add3(base['handL'], (shake, 0, abs(shake)))
    return dict(base, wL=wL, ankL=add3(aL, (0, 0, jz)), ankR=add3(aR, (0, 0, jz)), pitL=pit, pitR=pit,
                yawL=yL, yawR=yR, handL=hL)


ACTIONS = [
    ('idle', T_IDLE, idle, True), ('walk', T_WALK, walk, True), ('cast', T_CAST, cast, False),
    ('wait', T_WAIT, wait, True), ('hook', T_HOOK, hook, False), ('reel', T_REEL, reel, True),
    ('stow', T_STOW, stow, False), ('cheer', T_CHEER, cheer, False),
]

# ---------------- 檢查：斗笠碰撞、解算器與 Blender 一致、竿尖位置、滑步 ----------------

def hat_hits(D, H, pts):
    """把點轉到頭部靜止座標，檢查有沒有落在斗笠殼裡（帽緣下 3 cm 到錐面上 2 cm 之間）。"""
    out = []
    Dh = D['head'].inverted()
    for tag, p in pts:
        q = RH['head'] + Dh @ (p - H['head'])
        r = math.hypot(q.x, q.y)
        if r < HAT_R + 0.02:
            zc = HAT_Z + HAT_H * (1 - r / HAT_R)
            if HAT_Z - 0.04 < q.z < zc + 0.02 and not (r < 0.17 and q.z < 1.62):
                out.append(tag)
    return out


def rod_points(D, H):
    pts = []
    f = D['rod_0'] @ Vector((0, -1, 0))
    for k in range(9):
        pts.append((f'butt{k}', H['rod_0'] - f * (BUTT * k / 8)))
    for seg in range(4):
        n = f'rod_{seg}'
        fd = D[n] @ Vector((0, -1, 0))
        L = ROD_SEG[seg + 1] - ROD_SEG[seg]
        for k in range(6):
            pts.append((f'{n}', H[n] + fd * (L * k / 5)))
    return pts


def arm_points(D, H, side):
    pts = []
    for n, nxt in ((f'upperarm_{side}', f'forearm_{side}'), (f'forearm_{side}', f'hand_{side}')):
        for k in range(6):
            pts.append((n, H[n].lerp(H[nxt], k / 5)))
    pts.append((f'hand_{side}', H[f'hand_{side}'] + D[f'hand_{side}'] @ Vector((0, HAND_OFF + 0.05, 0))))
    return pts


report = {}
for name, dur, fn, cyc in ACTIONS:
    n = round(dur * FPS)
    WARN.clear()
    key_action(name, n, fn, cyc)
    hits = set()
    tips = []
    kd = []
    for f in range(n + 1):
        sp_ = fn(f / FPS)
        rot, loc, D, H, tL = solve(sp_)
        if sp_['wL'] > 0.999 and sp_['offL'] == knob(sp_['crank']):
            # 左手握把手：拳心 ↔ 把手球（reel_crank 上）的距離
            knobW = H['reel_crank'] + D['reel_crank'] @ (KNOB - RC)
            gripW = H['hand_L'] + D['hand_L'] @ (GRIP_L - WR_L)
            kd.append((gripW - knobW).length)
        h = hat_hits(D, H, rod_points(D, H) + arm_points(D, H, 'L') + arm_points(D, H, 'R'))
        if h:
            hits.add(f'{f}:{",".join(sorted(set(h)))}')
        tips.append(H['rod_tip'])
    # 和 Blender 的實際求值比對（竿尖、左右手、腳）
    maxerr = 0
    feet = []
    for f in range(0, n + 1):
        scene.frame_set(f)
        bpy.context.view_layer.update()
        rot, loc, D, H, tL = solve(fn(f / FPS))
        for bn in ('rod_tip', 'hand_L', 'hand_R', 'foot_L', 'head'):
            maxerr = max(maxerr, (arm.pose.bones[bn].head - H[bn]).length)
        feet.append((f, arm.pose.bones['foot_L'].head.copy(), arm.pose.bones['foot_R'].head.copy(),
                     arm.pose.bones['foot_L'].tail.copy()))
    if name == 'cheer':
        for f in range(0, n + 1, 3):
            rot, loc, D, H, tL = solve(fn(f / FPS))
            w = H['hand_L']
            brim = H['head'] + D['head'] @ (Vector((HAT_R, 0, HAT_Z)) - RH['head'])
            print(f'   cheer f{f:02d} wrist ({w.x:+.3f},{w.y:+.3f},{w.z:.3f})  L-brim ({brim.x:+.3f},{brim.z:.3f})'
                  f'  shoulder->palm {(tL - H["upperarm_L"]).length:.3f}')
    report[name] = dict(err=maxerr, warn=sorted(set(WARN)), hits=sorted(hits)[:12], tip0=tips[0], tipN=tips[-1], feet=feet)
    print(f'[{name}] frames 0..{n}  solver-vs-blender max err {maxerr * 1000:.2f} mm  IK clamps {sorted(set(WARN))[:6]}')
    print(f'   rod_tip f0 {tuple(round(c, 2) for c in tips[0])}  fN {tuple(round(c, 2) for c in tips[-1])}')
    if kd:
        print(f'   左手拳心↔把手球 {len(kd)} 格 最大 {max(kd) * 100:.2f} cm')
    if hits:
        print(f'   斗笠碰撞 {sorted(hits)[:12]}')

# 銜接檢查：動作的首尾姿勢要等於契約上接續的姿勢（比較所有骨頭 head 與骨尾的位置）
def pose_pts(sp):
    rot, loc, D, H, tL = solve(sp)
    return {n: (H[n], H[n] + D[n] @ (arm.data.bones[n].tail_local - RH[n])) for n in BN}


def pose_gap(a, b, names=BN):
    pa, pb = pose_pts(a), pose_pts(b)
    return max(max((pa[n][0] - pb[n][0]).length, (pa[n][1] - pb[n][1]).length) for n in names)


FN = {a[0]: (a[1], a[2]) for a in ACTIONS}
END = lambda n: FN[n][1](FN[n][0])
START = lambda n: FN[n][1](0.0)
for tag, a, b in (('idle 首尾', START('idle'), END('idle')), ('walk 首尾', START('walk'), END('walk')),
                  ('wait 首尾', START('wait'), END('wait')), ('reel 首尾', START('reel'), END('reel')),
                  ('cast 開頭＝idle', START('cast'), START('idle')), ('cast 結尾＝wait', END('cast'), START('wait')),
                  ('hook 開頭＝wait', START('hook'), START('wait')), ('hook 結尾＝reel', END('hook'), START('reel')),
                  ('stow 開頭＝wait', START('stow'), START('wait')), ('stow 結尾＝idle', END('stow'), START('idle')),
                  ('cheer 開頭＝reel', START('cheer'), START('reel'))):
    g = pose_gap(a, b)
    print(f'[銜接] {tag}: {g * 1000:.2f} mm' + ('' if g < 0.002 else '  ← 不連續'))
# reel → stow、reel ↔ hook 的交叉淡入：兩隻腳（foot 骨的頭尾）要在同一個位置，淡入時才不會滑步
for nm, ts in (('reel', (0.0, 0.3)), ('hook', (0.0, 0.2, 0.4)), ('cheer', (0.0, 0.5))):
    for t_ in ts:
        g = pose_gap(FN[nm][1](t_), START('stow'), ('foot_L', 'foot_R'))
        print(f'[站位] {nm} {t_:.2f}s 的腳 vs stow 開頭：{g * 1000:.2f} mm' + ('' if g < 0.002 else '  ← 換站位'))

# 滑步檢查：walk 的支撐腳腳尖（foot tail）每格應該往後 1.6/30 m，且高度貼地
print('[walk] 左腳 tail（腳尖）y/z 每格：')
for f, hl, hr, tl in report['walk']['feet']:
    print(f'   f{f:02d}  toeL y={tl.y:+.3f} z={tl.z:+.3f}   ankleL z={hl.z:.3f}')

stash_actions(arm, [a[0] for a in ACTIONS])
GLB = export_glb('fisher.glb')


def slim_glb(path, keep_translation=('root',)):
    """匯出後瘦身：拿掉所有骨頭的 scale 通道（恆為 1）與 root 以外的 translation 通道（恆為靜止值），
    重建 buffer。three 的 AnimationMixer 對沒有通道的屬性會保持節點原值，結果與原檔相同。"""
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
                (c['target']['path'] == 'translation' and names[c['target']['node']] in keep_translation)]
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


slim_glb(GLB)

# ---------------- 預覽 ----------------
def previews():
    ad = arm.animation_data
    for v in ('front', 'side', 'three', 'game'):
        render(f'fisher-rest-{v}', target=(0, -0.4, 1.0), view=v, ortho=3.2, size=(512, 512))
    sheet('fisher-walk-side', arm, 'walk', [0, 3, 6, 9, 12, 15, 18, 21, 24], target=(0, 0, 0.9), view='side', ortho=2.4, cell=220)
    sheet('fisher-cast-side', arm, 'cast', [0, 6, 10, 13, 15, 17, 20, 25, 30], target=(0, -0.5, 1.2), view='side', ortho=4.2, cell=220)
    sheet('fisher-cast-game', arm, 'cast', [0, 6, 10, 13, 15, 17, 20, 25, 30], target=(0, -0.5, 1.0), view='game', ortho=4.2, cell=220)
    for a_, fr in (('idle', [0, 30]), ('wait', [0, 36]), ('hook', [0, 4, 8, 12]), ('reel', [0, 5, 9, 14]),
                   ('stow', [0, 6, 9, 13, 16, 20, 24]), ('cheer', [0, 4, 9, 13, 16, 20, 24, 30, 36])):
        sheet(f'fisher-{a_}-side', arm, a_, fr, target=(0, -0.5, 1.1), view='side', ortho=4.0, cell=240)
        sheet(f'fisher-{a_}-three', arm, a_, fr, target=(0, -0.5, 1.1), view='three', ortho=4.0, cell=240)


# 預覽預設關閉（npm run assets 不需要）；要看接觸表時：FISHER_PREVIEW=1 Blender -b ... -P blender/fisher.py
if os.environ.get('FISHER_PREVIEW') == '1':
    try:
        previews()
    except Exception as e:
        print('預覽失敗（不影響 GLB）：', e)
