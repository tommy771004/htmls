"""赭線 278 的士兵與第一人稱手臂。

    blender -b -P tools/build-soldier.py -- [--stage geo|bake|anim|all] [--team atk|def] [--preview path]

來源：Quaternius UBC 底模＋UAL 動畫（CC0）、Military Character Kit 1.1 的靜態裝備（作者 britdawgmasterfunk）。
素材借 games/197-openworld/.cache 與 games/266-eternauta-plaza/.cache/sketchfab，只讀不改。
不用 ww2_panzergrenadier（二戰德軍服裝），也不用套件裡的英國國旗布章與醫療十字包。

流程：
1. 身體：把 UBC 的肌肉修平、依部位外推成衣服，分高模（細分＋布褶位移）與低模（維持原拓撲與 UV）。
2. 裝備：套件零件是 1:5 擺在 XZ 平面的靜態網格，依部位縮放定位，高模全保留，低模減面重新攤 UV。
3. 烘焙：兩隊各一張圖集（同一材質，一個士兵一個 draw），高模烘到低模的法線、底色、粗糙度、AO。
4. 動畫：把 UAL 取樣成每格每骨的數值陣列，再用解析 IK 把手放到槍上，寫回 action。
5. 匯出後處理 GLB：剝屬性、加 hand_R_socket、量命中膠囊。
"""
import bmesh
import bpy
import json
import math
import os
import random
import struct
import sys
import numpy as np
from mathutils import Matrix, Quaternion, Vector, kdtree, bvhtree

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REPO = os.path.normpath(os.path.join(ROOT, '../..'))
CACHE = os.path.join(REPO, 'games/197-openworld/.cache')
BODY = os.path.join(CACHE, 'ubc/Universal Base Characters[Standard]/Base Characters/Godot - UE/Superhero_Male_FullBody.gltf')
ANIMS = os.path.join(CACHE, 'ual/Universal Animation Library[Standard]/Unreal-Godot/UAL1_Standard.glb')
KIT = os.path.join(REPO, 'games/266-eternauta-plaza/.cache/sketchfab/military_character_kit_1.1_cc0.glb')
OUT_DIR = os.path.join(REPO, 'assets/278/models')
DIST = os.path.join(ROOT, 'dist')
WORK = os.path.join(DIST, 'soldier-work')

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []


def arg(name, dflt=None):
    return argv[argv.index(name) + 1] if name in argv else dflt


STAGE = arg('--stage', 'all')
TEAMS = [arg('--team')] if arg('--team') else ['atk', 'def']
PREVIEW = arg('--preview')

HEIGHT = 1.80
KIT_SCALE = 0.192        # 套件約 1:5

# ------------------------------------------------------------------ 基礎工具


def clear():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def import_gltf(path):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    return [o for o in bpy.data.objects if o not in before]


def verts_np(me):
    a = np.zeros(len(me.vertices) * 3, dtype=np.float64)
    me.vertices.foreach_get('co', a)
    return a.reshape(-1, 3)


def set_verts(me, P):
    me.vertices.foreach_set('co', P.reshape(-1).astype(np.float32))
    me.update()


def vnormals_np(me):
    a = np.zeros(len(me.vertices) * 3, dtype=np.float64)
    me.vertex_normals.foreach_get('vector', a)
    return a.reshape(-1, 3)


def adjacency(me):
    e = np.zeros(len(me.edges) * 2, dtype=np.int32)
    me.edges.foreach_get('vertices', e)
    return e.reshape(-1, 2)


def laplacian(P, E, mask, it, lam=0.6):
    n = len(P)
    P = P.copy()
    deg = np.bincount(E.reshape(-1), minlength=n).astype(np.float64)
    deg[deg == 0] = 1
    for _ in range(it):
        acc = np.zeros_like(P)
        np.add.at(acc, E[:, 0], P[E[:, 1]])
        np.add.at(acc, E[:, 1], P[E[:, 0]])
        acc /= deg[:, None]
        P += (acc - P) * (lam * mask)[:, None]
    return P


def lap_scalar(v, E, it):
    """純量場在網格上擴散（用於讓區域邊界柔和）"""
    n = len(v)
    v = v.copy()
    deg = np.bincount(E.reshape(-1), minlength=n).astype(np.float64)
    deg[deg == 0] = 1
    for _ in range(it):
        acc = np.zeros(n)
        np.add.at(acc, E[:, 0], v[E[:, 1]])
        np.add.at(acc, E[:, 1], v[E[:, 0]])
        v = v * 0.4 + acc / deg * 0.6
    return v


def smoothstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def sine_noise(P, seed, freq, oct=4, warp=0.0):
    """以隨機方向的正弦和當 3D 噪聲（numpy 向量化，無接縫）"""
    rng = np.random.RandomState(seed)
    h = np.zeros(len(P))
    Q = P
    if warp:
        Q = P + warp * np.stack([sine_noise(P, seed + 11 + i, freq * 0.5, 3) for i in range(3)], 1)
    amp, tot = 1.0, 0.0
    for o in range(oct):
        for _ in range(4):
            d = rng.normal(size=3)
            d /= np.linalg.norm(d)
            f = freq * 2 ** o * (0.8 + rng.rand() * 0.4)
            h += amp * np.sin(Q @ d * f * 2 * math.pi + rng.rand() * 6.28)
            tot += amp
        amp *= 0.55
    return h / tot * 2.2


def dist_seg(P, a, b):
    ab = b - a
    t = np.clip(((P - a) @ ab) / (ab @ ab), 0, 1)
    q = a + t[:, None] * ab
    return np.linalg.norm(P - q, axis=1), t

# ------------------------------------------------------------------ 身體


class Rig:
    pass


def load_body():
    clear()
    objs = import_gltf(BODY)
    arm = next(o for o in objs if o.type == 'ARMATURE')
    body = next(o for o in objs if o.type == 'MESH' and o.name.startswith('SuperHero'))
    eyes = next(o for o in objs if o.type == 'MESH' and o.name == 'Eyes')
    for o in objs:
        if o.type == 'MESH' and o not in (body, eyes):
            bpy.data.objects.remove(o, do_unlink=True)
    # 高度標準化：頭頂在 1.80
    zs = verts_np(body.data)[:, 2]
    s = HEIGHT / (zs.max() - zs.min())
    z0 = zs.min() * s
    r = Rig()
    r.scale, r.arm, r.body, r.eyes = s, arm, body, eyes
    for o in (body, eyes):
        P = verts_np(o.data) * s
        P[:, 2] -= z0
        set_verts(o.data, P)
    bpy.context.view_layer.objects.active = arm
    arm.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    for b in list(arm.data.edit_bones):
        if 'leaf' in b.name:
            arm.data.edit_bones.remove(b)
    for b in arm.data.edit_bones:
        b.head = b.head * s - Vector((0, 0, z0))
        b.tail = b.tail * s - Vector((0, 0, z0))
    bpy.ops.object.mode_set(mode='OBJECT')
    r.z0 = z0
    uv = body.data.uv_layers
    while len(uv) > 1:
        uv.remove(uv[-1])
    r.J = {b.name: Vector(b.head_local) for b in arm.data.bones}
    return r


def dominant(obj):
    me = obj.data
    names = {g.index: g.name for g in obj.vertex_groups}
    dom = []
    for v in me.vertices:
        best, bw = '', 0
        for g in v.groups:
            if g.weight > bw and names[g.group] not in ('root',):
                best, bw = names[g.group], g.weight
        dom.append(best)
    return dom


LEFTRIGHT = ('_l', '_r')


def zones(r):
    """每個頂點的區域遮罩（0..1）"""
    dom = dominant(r.body)
    n = len(dom)
    z = {k: np.zeros(n) for k in ('head', 'neck', 'hand', 'foot', 'torso', 'uarm', 'farm', 'thigh', 'calf')}
    for i, b in enumerate(dom):
        if b == 'Head':
            z['head'][i] = 1
        elif b == 'neck_01':
            z['neck'][i] = 1
        elif b.startswith(('hand_', 'index', 'middle', 'pinky', 'ring', 'thumb')):
            z['hand'][i] = 1
        elif b.startswith(('foot_', 'ball_')):
            z['foot'][i] = 1
        elif b.startswith(('spine', 'pelvis', 'clavicle')):
            z['torso'][i] = 1
        elif b.startswith('upperarm'):
            z['uarm'][i] = 1
        elif b.startswith('lowerarm'):
            z['farm'][i] = 1
        elif b.startswith('thigh'):
            z['thigh'][i] = 1
        elif b.startswith('calf'):
            z['calf'][i] = 1
    return z, dom


class Weld:
    """UBC 的 UV 接縫把頂點拆成 24 個島；平滑與外推都要在焊接後的拓撲上做，否則接縫裂開"""

    def __init__(self, me):
        P = verts_np(me)
        k = np.round(P / 2e-4).astype(np.int64)
        _, self.first, self.inv = np.unique(k, axis=0, return_index=True, return_inverse=True)
        self.inv = self.inv.reshape(-1)
        E = self.inv[adjacency(me)]
        E = E[E[:, 0] != E[:, 1]]
        self.E = np.unique(np.sort(E, 1), axis=0)
        self.n = len(self.first)
        self.me = me
        lp = np.zeros(len(me.loops), dtype=np.int32)
        me.loops.foreach_get('vertex_index', lp)
        self.tris = None

    def down(self, x):
        """頂點量 -> 焊接量（取平均）"""
        s = np.zeros((self.n,) + x.shape[1:])
        c = np.zeros(self.n)
        np.add.at(s, self.inv, x)
        np.add.at(c, self.inv, 1)
        return s / (c if x.ndim == 1 else c[:, None])

    def normals(self, Pw):
        """以目前位置算焊接後的頂點法線"""
        me = self.me
        me.calc_loop_triangles()
        T = np.zeros(len(me.loop_triangles) * 3, dtype=np.int32)
        me.loop_triangles.foreach_get('vertices', T)
        T = self.inv[T.reshape(-1, 3)]
        a, b, c = Pw[T[:, 0]], Pw[T[:, 1]], Pw[T[:, 2]]
        fn = np.cross(b - a, c - a)
        N = np.zeros((self.n, 3))
        for i in range(3):
            np.add.at(N, T[:, i], fn)
        return N / np.maximum(np.linalg.norm(N, axis=1, keepdims=True), 1e-12)


# 衣服厚度（公尺）。參考圖是寬鬆戰術服，不是緊身衣：袖子、褲管要有份量，腰不能收。
BULK = {
    'atk': dict(torso=0.025, uarm=0.02, farm=0.012, thigh=0.024, calf=0.03, neck=0.015, lat=0.0, waist=0.04, fold=0.0095),
    'def': dict(torso=0.02, uarm=0.017, farm=0.012, thigh=0.026, calf=0.03, neck=0.014, lat=0.0, waist=0.04, fold=0.008),
}


# 手臂徑向收窄（|x| -> 倍率）：底模前臂靠手肘鼓起、手腕過細（T 姿勢手臂沿 x 軸）
ARM_RAD = ((0.16, 1.0), (0.23, 0.92), (0.30, 0.90), (0.40, 0.95), (0.458, 1.0), (0.50, 0.88), (0.56, 0.9), (0.64, 1.0))
SHOULDER_CAP = (1.47, 0.55)    # 肩關節上方的肌肉堆：z 超過 1.47 的部分壓成 55%
HEAD_K = 1.08


def body_shape(P):
    """把超級英雄底模改成寫實比例。位置函式，焊接點不裂；只動網格不動骨架，Pose／IK／socket 都不受影響"""
    P = P.copy()
    a = np.abs(P[:, 0])
    tab = np.array(ARM_RAD)
    k = np.interp(a, tab[:, 0], tab[:, 1])
    m = np.maximum(smoothstep(0.16, 0.23, a) * smoothstep(1.33, 1.41, P[:, 2]), smoothstep(0.24, 0.28, a))
    k = 1 - (1 - k) * m
    yc = np.interp(a, (0.2097, 0.458, 0.6989), (0.0647, 0.0722, 0.0647))
    zc = 1.4492
    P[:, 1] = yc + (P[:, 1] - yc) * k
    P[:, 2] = zc + (P[:, 2] - zc) * k
    z0, kc = SHOULDER_CAP
    z = P[:, 2]
    m = smoothstep(0.06, 0.12, a) * (1 - smoothstep(0.30, 0.38, a)) * (z > z0) * (1 - smoothstep(1.545, 1.585, z))
    P[:, 2] = z + (z0 + (z - z0) * kc - z) * m
    # 下顎到耳下偏窄：xy 放大、z 不動，頭頂留在 1.80
    k = 1 + (HEAD_K - 1) * smoothstep(1.575, 1.625, P[:, 2]) * (1 - smoothstep(0.14, 0.17, a))
    P[:, 0] *= k
    P[:, 1] = 0.0172 + (P[:, 1] - 0.0172) * k
    return P


def cloth_base(r, team=None):
    """把肌肉修平、依部位外推，回傳低模頂點（原拓撲）"""
    me = r.body.data
    W = Weld(me)
    r.weld = W
    P0 = W.down(verts_np(me))
    if team in BULK:
        P0 = body_shape(P0)
    E = W.E
    z, dom = zones(r)
    r.zone, r.dom = z, dom
    zw = {k: W.down(v) for k, v in z.items()}
    # 平滑只作用在衣服區，頭手保留；次數要少，否則整個人會糊成一團
    cloth = zw['torso'] + zw['uarm'] + zw['farm'] + zw['thigh'] + zw['calf'] + zw['foot'] * 0.5
    mask = lap_scalar(cloth, E, 2)
    P = laplacian(P0, E, mask, 9, 0.5)
    # 超級英雄的倒三角收窄：背闊肌一帶往內 10%（只動軀幹，上臂不動）
    lat = zw['torso'] * smoothstep(0.95, 1.12, P[:, 2]) * (1 - smoothstep(1.42, 1.5, P[:, 2]))
    lat = lap_scalar(lat, E, 4)
    B = BULK.get(team)
    P[:, 0] *= 1 - (B['lat'] if B else 0.11) * lat
    # 厚度（公尺）
    if B:
        t = (zw['torso'] * B['torso'] + zw['uarm'] * B['uarm'] + zw['farm'] * B['farm'] + zw['thigh'] * B['thigh'] + zw['calf'] * B['calf']
             + zw['hand'] * 0.0035 + zw['neck'] * B['neck'] + zw['head'] * 0.003 + zw['foot'] * 0.03)
        t += zw['torso'] * B['waist'] * smoothstep(1.40, 1.26, P[:, 2]) * smoothstep(1.02, 1.10, P[:, 2])
        t += zw['farm'] * 0.006 * smoothstep(0.60, 0.66, np.abs(P[:, 0]))     # 袖口：底模手腕太細
    else:
        t = (zw['torso'] * 0.011 + zw['uarm'] * 0.012 + zw['farm'] * 0.011 + zw['thigh'] * 0.015 + zw['calf'] * 0.018
             + zw['hand'] * 0.0035 + zw['neck'] * 0.007 + zw['head'] * 0.003 + zw['foot'] * 0.03)
    # 褲管束進靴口：褲腳鬆鼓蓋住靴筒
    t += zw['calf'] * (0.004 if B else 0.016) * smoothstep(0.30, 0.2, P[:, 2]) + (zw['foot'] + zw['calf']) * 0.008 * smoothstep(0.24, 0.17, P[:, 2])
    t = lap_scalar(t, E, 6)
    N = W.normals(P)
    P = P + N * t[:, None]
    return P, N


def low_folds(P, N, r, amp=0.0055):
    """低頻布褶進低模，讓輪廓不像緊身衣（在焊接空間運算）"""
    z = {k: r.weld.down(v) for k, v in r.zone.items()}
    cloth = z['torso'] + z['uarm'] + z['farm'] + z['thigh'] + z['calf']
    h = sine_noise(P, 3, 5.0, 2) * amp
    return P + N * (h * cloth)[:, None]


def limb_axes(r):
    J = r.J
    return [
        ('thigh', J['thigh_l'], J['calf_l']), ('thigh', J['thigh_r'], J['calf_r']),
        ('calf', J['calf_l'], J['foot_l']), ('calf', J['calf_r'], J['foot_r']),
        ('uarm', J['upperarm_l'], J['lowerarm_l']), ('uarm', J['upperarm_r'], J['lowerarm_r']),
        ('farm', J['lowerarm_l'], J['hand_l']), ('farm', J['lowerarm_r'], J['hand_r']),
        ('torso', J['pelvis'], J['neck_01']),
    ]


def cloth_folds(P, r, kinds, k=None):
    """高模布褶位移：沿肢段環向的皺褶（關節附近強）。回傳 位移(m)、接縫遮罩"""
    J = r.J
    out = np.zeros(len(P))
    seam = np.zeros(len(P))
    for i, (kind, a, b) in enumerate(limb_axes(r)):
        a = np.array(a)
        b = np.array(b)
        d, t = dist_seg(P, a, b)
        w = (kinds[kind] > 0.5)
        if not w.any():
            continue
        ax = (b - a) / np.linalg.norm(b - a)
        u = (P - a) @ ax
        perp = (P - a) - u[:, None] * ax
        # 斜向的環形皺褶：相位隨角度偏移
        wr = sine_noise(P, 40 + i, 6.0, 2) * 0.05
        h = 0
        rng = np.random.RandomState(70 + i)
        for j in range(5):
            tilt = rng.normal(size=3) * (0.55 + 0.3 * j)
            f = (7 + j * 6) * (0.85 + 0.3 * rng.rand())
            ph = (u + perp @ tilt + wr) * f * 2 * math.pi + rng.rand() * 6.28
            h = h + (1 - np.abs(np.sin(ph))) ** 2.2 * (1.0 / (1 + j * 0.45))
        h = h / 3.2
        # 關節強度：上臂腋下與手肘、大腿根與膝蓋
        tw = 0.45 + 0.75 * np.exp(-(t / 0.2) ** 2) + 0.95 * np.exp(-((1 - t) / 0.2) ** 2)
        amp = {'thigh': 0.0105, 'calf': 0.0095, 'uarm': 0.0095, 'farm': 0.0085, 'torso': 0.0075}[kind]
        patch = smoothstep(-0.4, 0.5, sine_noise(P, 90 + i, 3.0, 2))
        out[w] = np.maximum(out[w], (h * tw * amp * (0.4 + 0.6 * patch))[w])
    fine = sine_noise(P, 7, 22.0, 3, 0.012) * 0.0011
    return out + fine

# ------------------------------------------------------------------ 裝備


KIT_GROUPS = {
    'vestA': ['plate_carrier_01_main_117', 'molle_loops_mpc01_116', 'velcro_mpc01_112', 'grabhandle_mpc01_113',
              'padding_mpc01_114', 'lable_mpc01_115', 'plate_carrier_01_main.002_153'],
    'vestB': ['Cube_129', 'Cube.001_130', 'Cube.002_131', 'Cube.003_132', 'Cube.004_133'],
    'belt': ['molle_belt_main_94', 'molle_loops_mlb_93', 'padding_belt_95', 'strap_belt_96'],
    'mag2': ['556_mag_pouch_02_main_106', 'molle_loops_mgp02_107', '556_mag_pouch_02_elastic_108', '556_mag_pouch_02_poppers_109', '556_mag_02a_110', '556_mag_02b_111'],
    'mag1': ['molle_loops_mgp01_97', '556_mag_pouch_01_bungy_98', '556_mag_pouch_01_main_99', 'pull_tap_mag_pouch_100', '556_mag_01_101'],
    'util': ['util_pouch_main_63', 'zip_utp_64', 'molle_loops_utp_65', 'util_pouch_poppers_66', 'zipper_utp_67'],
    'radio': ['radio_pouch_main_69', 'molle_strapiing_rdp_70'],
    'dump': ['dump_pouch_main_41', 'molle_loops_dmp_42', 'dump_pouch_poppers_124'],
    'groin': ['groin_pouch_main_17', 'zipper_gnp_18', 'molle_loops_gnp_19', 'zip_gnp_20', 'groin_pouch_poppers_127'],
    'knee': ['knee_pad_front_71', 'knee_pad_main_72', 'knee_pad_clips_74', 'knee_padding_75', 'strap_nuts_knp_76', 'rivets_knp_77'],
    'bootB': ['heel.001_165', 'laces.001_166', 'rim.001_167', 'tongue.001_168', 'upper.001_169', 'horn_loop.001_170'],
    'bootA': ['heel_84', 'laces_85', 'rim_86', 'sole_87', 'toe_88', 'tongue_89', 'upper_90', 'boot_main_91', 'horn_loop_92'],
    'helmet': ['Sphere_140', 'Plane.001_141', 'Sphere.001_142', 'Sphere.002_164', 'frontmount.001_139', 'chinstrap.001_134',
               'adjuster_pad.001_135', 'chinstrap_buckle.001_136', 'adjuster_nut.001_137', 'chinstrap_adjustment.001_138',
               'microd.001_155', 'mic.001_156', 'speakers.001_159', 'active_mics.001_160', 'headset_body.001_161',
               'earpads.001_162', 'rubber_gromets.001_163'],
    'cargo': ['trouser_side_pocket_main_121', 'trouser_side_pocket_seams_122'],
    'delt': ['shirt_deltoid_pocket_main_118', 'pocket_velcro_119'],
}


def load_kit():
    """回傳 名稱 -> Mesh 物件（世界座標已寫進頂點）"""
    objs = import_gltf(KIT)
    bpy.context.view_layer.update()
    kit = {}
    for o in objs:
        if o.type != 'MESH':
            continue
        name = o.parent.name if o.parent else o.name
        me = o.data.copy()
        me.transform(o.matrix_world)
        if o.matrix_world.determinant() < 0:      # 節點負縮放（鏡像那隻靴子）：繞序跟著翻
            me.flip_normals()
        for a in list(me.attributes):
            if a.name in ('Col', 'Color', 'COLOR_0', 'custom_normal', 'sharp_face'):
                me.attributes.remove(a)
        kit.setdefault(name, []).append(me)
    for o in objs:
        bpy.data.objects.remove(o, do_unlink=True)
    return kit


def srgb(h):
    h = h.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple((x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4) for x in c)


# 兩隊色票：(底色, 粗糙度)。輪廓要在淺砂岩上清楚，整體都壓在中暗。
TEAM = {
    'atk': {   # 歹徒：鼠尾草橄欖連帽外套、深橄欖工作褲、炭色頭套、棕皮靴
        'shirt': '#5a5644', 'pants': '#413f30', 'hood': '#26241f', 'glove': '#1c1c1a', 'band': None,
        'shell': '#423e2d', 'strap': '#2d2a1f', 'pad': '#383527', 'plastic': '#1e1d19', 'hard': '#45452f',
        'leather': '#604830', 'sole': '#2b251c', 'lace': '#403323', 'mag': '#23221c', 'velcro': '#4f4a33', 'ear': '#1c1c19', 'jacket': '#5a5644',
    },
    'def': {   # 警察：海軍藍制服、黑色護具與面罩
        'shirt': '#2b3246', 'pants': '#272d40', 'hood': '#15161b', 'glove': '#17181c', 'band': None,
        'shell': '#1d1f26', 'strap': '#15171b', 'pad': '#1b1d23', 'plastic': '#131418', 'hard': '#222a40',
        'leather': '#1a1b1e', 'sole': '#131314', 'lace': '#18191c', 'mag': '#16171b', 'velcro': '#24262c', 'ear': '#16181c', 'jacket': '#2b3246',
    },
}
TEAM['fp'] = dict(TEAM['atk'], shirt='#303136', pants='#303136', hood='#222226', glove='#17181b', band='#303136', strap='#232427')
ROUGH = {'shell': 0.82, 'strap': 0.88, 'pad': 0.9, 'plastic': 0.5, 'hard': 0.62, 'leather': 0.55, 'sole': 0.8, 'lace': 0.9,
         'mag': 0.55, 'velcro': 0.95, 'ear': 0.7, 'lens': 0.1, 'skin': 0.6, 'cloth': 0.9, 'eye': 0.3, 'jacket': 0.9}
PAL_KEYS = ['shell', 'strap', 'pad', 'plastic', 'hard', 'leather', 'sole', 'lace', 'mag', 'velcro', 'ear', 'lens', 'eye', 'jacket']


def pal_of(mat_name, group):
    n = mat_name.lower()
    if group.startswith('helmet'):
        if 'plastictan' in n or 'camo' in n or 'olive' in n:
            return 'hard'
        if 'green' in n:
            return 'ear'
        if 'zip' in n or 'kneepad' in n:
            return 'strap'
        return 'plastic'
    if group.startswith('boot'):
        if 'laces' in n or n == 'material.005' or 'strapping_black' in n:
            return 'lace'
        if 'rubber' in n or 'dark_plastic' in n:
            return 'sole'
        return 'leather'
    if group.startswith('mag') and 'dark_plastic' in n:
        return 'mag'
    if 'camo' in n:
        return 'shell'
    if 'stapping' in n or 'strapping' in n or 'kneepad' in n:
        return 'strap'
    if 'mesh_padding' in n or 'fabric' in n:
        return 'pad'
    if 'velcro' in n:
        return 'velcro'
    if 'plastictan' in n or 'ziptan' in n or 'olive' in n:
        return 'hard' if group == 'knee' else 'strap'
    return 'plastic'


def bbox(meshes):
    a = np.concatenate([verts_np(m) for m in meshes])
    return a.min(0), a.max(0)


LOW_SKIP = ('molle_loops', 'molle_strapiing', 'zip', 'popper', 'popers', 'rivets', 'strap_nuts', 'clips', 'elastic', 'seams',
            'lable', 'velcro_mpc', 'horn_loop', 'laces', 'buckle', 'adjuster', 'microd', 'active_mics', 'gromets', 'bungy', 'pull_tap')


def push_field(P, bvh, clear, cell=0.018):
    """把穿進身體的頂點推到體表外。位移先寫進 3D 格點再擴散，同一區的內外層一起動，厚度不被壓扁"""
    push = np.zeros_like(P)
    for i, p in enumerate(P):
        loc, nor, idx, d = bvh.find_nearest(Vector(p))
        if loc is None or d > 0.09:
            continue
        v = Vector(p) - loc
        sd = v.dot(nor)
        if sd < clear and abs(nor.z) < 0.97 or sd < clear and d < 0.05:
            push[i] = np.array(nor) * (clear - sd)
    if not push.any():
        return P
    mn = P.min(0) - cell * 2
    idx = np.floor((P - mn) / cell).astype(int)
    dims = idx.max(0) + 3
    F = np.zeros((*dims, 3))
    M = np.zeros(dims)
    mag = np.linalg.norm(push, axis=1)
    for i in np.argsort(mag):
        if mag[i] > 0:
            F[tuple(idx[i])] = push[i]
            M[tuple(idx[i])] = mag[i]
    # 擴散：往鄰格取最大位移，再做一次平均
    for _ in range(2):
        F2, M2 = F.copy(), M.copy()
        for ax in range(3):
            for sgn in (1, -1):
                Fr = np.roll(F, sgn, ax)
                Mr = np.roll(M, sgn, ax)
                m = Mr > M2
                F2[m] = Fr[m]
                M2[m] = Mr[m]
        F, M = F2, M2
    Fb = F.copy()
    for ax in range(3):
        Fb = (np.roll(Fb, 1, ax) + 2 * Fb + np.roll(Fb, -1, ax)) / 4
    # 三線性內插
    g = (P - mn) / cell - 0.5
    i0 = np.clip(np.floor(g).astype(int), 0, np.array(dims) - 2)
    t = np.clip(g - i0, 0, 1)
    out = np.zeros_like(P)
    for dx in (0, 1):
        for dy in (0, 1):
            for dz in (0, 1):
                w = (t[:, 0] if dx else 1 - t[:, 0]) * (t[:, 1] if dy else 1 - t[:, 1]) * (t[:, 2] if dz else 1 - t[:, 2])
                out += Fb[i0[:, 0] + dx, i0[:, 1] + dy, i0[:, 2] + dz] * w[:, None]
    return P + out


def gear(kit, group, center, scale=1.0, rot=(0, 0, 0), mirror=False, tris=400, name=None, voxel=0.006, push=None, clear=0.005, min_area=0.0012, clip=None):
    """把一組零件擺到身體上。回傳 (高模 mesh, 低模 mesh)"""
    nodes = KIT_GROUPS[group]
    meshes = []
    for n in nodes:
        meshes += [(n, m) for m in kit[n]]
    mn, mx = bbox([m for _, m in meshes])
    c = (mn + mx) / 2
    sc = (scale, scale, scale) if not isinstance(scale, (tuple, list)) else scale
    M = (Matrix.Translation(center)
         @ Matrix.Rotation(math.radians(rot[2]), 4, 'Z') @ Matrix.Rotation(math.radians(rot[1]), 4, 'Y') @ Matrix.Rotation(math.radians(rot[0]), 4, 'X')
         @ Matrix.Diagonal((KIT_SCALE * sc[0] * (-1 if mirror else 1), KIT_SCALE * sc[1], KIT_SCALE * sc[2], 1))
         @ Matrix.Translation(-Vector(c)))
    hi = bmesh.new()
    pal_layer = hi.faces.layers.int.new('pal')
    for n, m in meshes:
        me = m.copy()
        me.transform(M)
        if mirror:
            me.flip_normals()
        keys = [PAL_KEYS.index(pal_of(mt.name if mt else '', group)) for mt in me.materials] or [0]
        base = len(hi.faces)
        hi.from_mesh(me)
        hi.faces.ensure_lookup_table()
        for f in hi.faces[base:]:
            f[pal_layer] = keys[min(f.material_index, len(keys) - 1)]
            f.material_index = 0
        bpy.data.meshes.remove(me)
    if clip:
        kill = [f for f in hi.faces if clip(f.calc_center_median())]
        bmesh.ops.delete(hi, geom=kill, context='FACES')
        bmesh.ops.delete(hi, geom=[v for v in hi.verts if not v.link_faces], context='VERTS')
    # 銳角邊保留硬邊（套件自訂法線在合併時會壞，改由角度決定）
    for e in hi.edges:
        if e.is_manifold and e.calc_face_angle(0) > math.radians(42):
            e.smooth = False
    for f in hi.faces:
        f.smooth = True
    hme = bpy.data.meshes.new((name or group) + '_hi')
    hi.to_mesh(hme)
    hi.free()
    if push is not None:
        set_verts(hme, push_field(verts_np(hme), push, clear))
    # 低模：先體素重建成連續外殼（CAD 式的零件直接減面會破洞），再減到目標三角數
    lme = hme.copy()
    obj = bpy.data.objects.new('tmp', lme)
    bpy.context.scene.collection.objects.link(obj)
    rm = obj.modifiers.new('r', 'REMESH')
    rm.mode = 'VOXEL'
    rm.voxel_size = voxel
    rm.use_smooth_shade = True
    dg = bpy.context.evaluated_depsgraph_get()
    vme = bpy.data.meshes.new_from_object(obj.evaluated_get(dg))
    obj.modifiers.clear()
    obj.data = vme
    tri_now = sum(len(p.vertices) - 2 for p in vme.polygons)
    mod = obj.modifiers.new('d', 'DECIMATE')
    mod.ratio = min(1.0, tris / max(1, tri_now))
    mod.use_collapse_triangulate = True
    dg = bpy.context.evaluated_depsgraph_get()
    dme = bpy.data.meshes.new_from_object(obj.evaluated_get(dg))
    dme.name = (name or group) + '_lo'
    bpy.data.objects.remove(obj, do_unlink=True)
    bpy.data.meshes.remove(lme)
    bpy.data.meshes.remove(vme)
    drop_islands(dme, min_area)
    transfer_pal(hme, dme)
    return hme, dme


def drop_islands(me, min_area):
    """減面後的碎片（細帶子被體素切斷的片段）刪掉"""
    bm = bmesh.new()
    bm.from_mesh(me)
    bm.verts.ensure_lookup_table()
    seen = set()
    kill = []
    for f0 in bm.faces:
        if f0.index in seen:
            continue
        stack, isl = [f0], []
        seen.add(f0.index)
        while stack:
            f = stack.pop()
            isl.append(f)
            for v in f.verts:
                for g in v.link_faces:
                    if g.index not in seen:
                        seen.add(g.index)
                        stack.append(g)
        if sum(f.calc_area() for f in isl) < min_area:
            kill += isl
    bmesh.ops.delete(bm, geom=kill, context='FACES')
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    bm.to_mesh(me)
    bm.free()


def transfer_pal(hme, lme):
    """低模每面取最近高模面的 pal（只用於預覽）"""
    bvh = bvhtree.BVHTree.FromPolygons([tuple(v.co) for v in hme.vertices], [tuple(p.vertices) for p in hme.polygons])
    hp = np.zeros(len(hme.polygons), dtype=np.int32)
    hme.attributes['pal'].data.foreach_get('value', hp)
    a = lme.attributes.new('pal', 'INT', 'FACE')
    vals = []
    for p in lme.polygons:
        loc, nor, idx, d = bvh.find_nearest(p.center)
        vals.append(int(hp[idx]) if idx is not None else 0)
    a.data.foreach_set('value', vals)


def goggles(r, team_hi, center, width=0.158):
    """自建護目鏡：包覆式鏡片＋框＋頭帶，回傳 (hi, lo)。"""
    def make(seg, name):
        bm = bmesh.new()
        pal = bm.faces.layers.int.new('pal')
        hw = width / 2
        hh = 0.03
        rows = 10
        cols = seg

        def sheet(off, scale, key, flip=False):
            vs = []
            for j in range(rows + 1):
                for i in range(cols + 1):
                    u = i / cols * 2 - 1
                    v = j / rows * 2 - 1
                    # 超橢圓輪廓，中央鼻梁下凹
                    h = hh * (1 - abs(u) ** 3.2) ** 0.34 * scale
                    if v < 0:
                        h = h * (1 - 0.42 * math.exp(-(u / 0.2) ** 2))
                    x = u * hw * scale
                    z = v * h
                    # 水平沿臉包覆，垂直微彎
                    y = -(0.018 - 0.07 * u * u) + off + 0.008 * v * v
                    vs.append(bm.verts.new((center[0] + x, center[1] + y, center[2] + z)))
            for j in range(rows):
                for i in range(cols):
                    a = i + j * (cols + 1)
                    q = [vs[a], vs[a + 1], vs[a + cols + 2], vs[a + cols + 1]]
                    f = bm.faces.new(q if not flip else q[::-1])
                    f[pal] = PAL_KEYS.index(key)
        sheet(-0.002, 1.0, 'lens')
        # 框：比鏡片大一圈的外殼
        sheet(0.0035, 1.2, 'plastic', False)
        sheet(0.016, 1.26, 'pad', True)
        me = bpy.data.meshes.new(name)
        bm.to_mesh(me)
        bm.free()
        return me
    return make(22, 'gog_hi'), make(10, 'gog_lo')


def band_strap(r, center, radius, width, y0, key, n=40, name='strap', arc=(40, 320)):
    """繞頭的帶子（用在護目鏡）"""
    bm = bmesh.new()
    pal = bm.faces.layers.int.new('pal')
    rows = []
    for i in range(n + 1):
        a = math.radians(arc[0] + (arc[1] - arc[0]) * i / n)
        x, y = math.sin(a) * radius[0], math.cos(a) * radius[1]
        rows.append([bm.verts.new((center[0] + x, center[1] + y0 + y, center[2] + d)) for d in (-width / 2, width / 2)])
    for i in range(n):
        f = bm.faces.new([rows[i][0], rows[i + 1][0], rows[i + 1][1], rows[i][1]])
        f[pal] = PAL_KEYS.index(key)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    return me


def shoulder_strap(r, bvh, x, width, y_f, y_b, key='strap'):
    """前後背板之間繞過肩膀的肩帶：從肩上方沿圓弧往體表打射線貼合"""
    n = 14
    cy, cz = (y_f + y_b) / 2, 1.33
    rows = []
    for i in range(n + 1):
        th = math.radians(-82 + 164 * i / n)
        d = Vector((0, math.sin(th), math.cos(th)))
        row = []
        for w in (-1, 0, 1):
            px = x + w * width / 2
            o = Vector((px, cy, cz)) + d * 0.6
            hit, nor, idx, dist = bvh.ray_cast(o, -d, 0.7)
            row.append(np.array(hit if hit else o - d * 0.42))
        rows.append(row)
    R = np.array(rows)
    # 三點取平均，帶子不跟著肩胛起伏
    for _ in range(3):
        R[1:-1] = (R[:-2] + 2 * R[1:-1] + R[2:]) / 4
    bm = bmesh.new()
    pal = bm.faces.layers.int.new('pal')
    A, B = [], []
    for i in range(n + 1):
        th = math.radians(-82 + 164 * i / n)
        d = np.array((0, math.sin(th), math.cos(th)))
        A.append([bm.verts.new(R[i][j] + d * 0.005) for j in range(3)])
        B.append([bm.verts.new(R[i][j] + d * 0.012) for j in range(3)])
    k = PAL_KEYS.index(key)
    for i in range(n):
        for j in range(2):
            for V, fl in ((A, True), (B, False)):
                q = [V[i][j], V[i][j + 1], V[i + 1][j + 1], V[i + 1][j]]
                bm.faces.new(q[::-1] if fl else q)[pal] = k
        for j, fl in ((0, True), (2, False)):
            q = [A[i][j], A[i + 1][j], B[i + 1][j], B[i][j]]
            bm.faces.new(q[::-1] if fl else q)[pal] = k
    hi = bpy.data.meshes.new('shstrap_hi')
    bm.to_mesh(hi)
    bm.free()
    lo = hi.copy()
    return hi, lo


def solids(spec, name):
    """用方塊與圓柱拼小零件（夜視鏡座、槍套），回傳 (hi, lo)。spec: (box|cyl, 中心, 尺寸, 旋轉度, 色票)"""
    def make(seg, nm):
        bm = bmesh.new()
        pal = bm.faces.layers.int.new('pal')
        for kind, c, sz, rot, key in spec:
            M = Matrix.Translation(c) @ Matrix.Rotation(math.radians(rot[2]), 4, 'Z') @ Matrix.Rotation(math.radians(rot[1]), 4, 'Y') @ Matrix.Rotation(math.radians(rot[0]), 4, 'X')
            if kind == 'box':
                vs = bmesh.ops.create_cube(bm, size=1.0, matrix=M @ Matrix.Diagonal((sz[0], sz[1], sz[2], 1)))['verts']
            else:
                vs = bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=sz[0], radius2=sz[1], depth=sz[2], matrix=M)['verts']
            for f in {f for v in vs for f in v.link_faces}:
                f[pal] = PAL_KEYS.index(key)
                f.smooth = kind != 'box'
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        me = bpy.data.meshes.new(nm)
        bm.to_mesh(me)
        bm.free()
        return me
    return make(18, name + '_hi'), make(8, name + '_lo')


def holster(r, s, side):
    """腿掛槍套：大腿外側一塊硬殼加手槍握把，配兩條腿帶"""
    P = r.lo_P
    z0 = 0.76
    m = (np.abs(P[:, 2] - z0) < 0.014) & (P[:, 0] * side > 0)
    x = float(np.abs(P[m, 0]).max()) * side + side * 0.01
    y = float(P[m, 1].mean())
    c = Vector((x, y, z0))
    spec = [
        ('box', (x, y, c.z - 0.005), (0.032, 0.066, 0.17), (0, 0, 0), 'hard'),
        ('box', (x + side * 0.004, y + 0.004, c.z + 0.1), (0.034, 0.05, 0.04), (0, 0, 0), 'strap'),
        ('box', (x + side * 0.002, y + 0.016, c.z + 0.135), (0.026, 0.03, 0.06), (14, 0, 0), 'plastic'),
        ('box', (x - side * 0.016, y, c.z + 0.04), (0.012, 0.05, 0.11), (0, 0, 0), 'strap'),
    ]
    return solids(spec, 'holster' + s)


def hood_collar(r):
    """連帽外套的帽子：放下時堆在頸後與肩上的一圈厚布，回傳 (hi, lo)"""
    C = Vector((0, 0.045, 1.485))

    def make(nu, wob, nm):
        bm = bmesh.new()
        pal = bm.faces.layers.int.new('pal')
        prof = [  # rx, rx 後, ry, ry 後, z, z 後
            (0.075, 0.0, 0.075, 0.0, 0.02, 0.02),
            (0.088, 0.014, 0.096, 0.022, 0.052, 0.09),
            (0.116, 0.022, 0.118, 0.03, 0.026, 0.05),
            (0.142, 0.026, 0.136, 0.03, -0.022, -0.012),
            (0.142, 0.026, 0.126, 0.02, -0.065, -0.07),
        ]
        rows = []
        for j, (rx, rxb, ry, ryb, zf, zb) in enumerate(prof):
            row = []
            for i in range(nu):
                u = 2 * math.pi * i / nu
                b = ((1 - math.cos(u)) / 2) ** 1.25
                w = 1 + wob * math.sin(3 * u + j * 1.7) * (0.4 + 0.6 * b) + wob * 0.5 * math.sin(7 * u - j)
                x = math.sin(u) * (rx + rxb * b) * w
                y = -math.cos(u) * (ry + ryb * b) * w
                z = zf + (zb - zf) * b
                row.append(bm.verts.new((C.x + x, C.y + y, C.z + z)))
            rows.append(row)
        for a, b_ in zip(rows, rows[1:]):
            for i in range(nu):
                k = (i + 1) % nu
                f = bm.faces.new([a[i], a[k], b_[k], b_[i]])
                f[pal] = PAL_KEYS.index('jacket')
                f.smooth = True
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        me = bpy.data.meshes.new(nm)
        bm.to_mesh(me)
        bm.free()
        return me
    return make(64, 0.035, 'hood_hi'), make(24, 0.02, 'hood_lo')


def nvg_mount(r):
    """頭盔前緣的夜視鏡座與上掀的鏡筒，兩側導軌"""
    h = r.J['Head']
    y, z = h.y - 0.118, h.z + 0.16
    spec = [
        ('box', (0, y, z), (0.05, 0.016, 0.04), (0, 0, 0), 'plastic'),
        ('box', (0, y - 0.022, z + 0.012), (0.03, 0.034, 0.03), (20, 0, 0), 'hard'),
        ('cyl', (0.02, y - 0.01, z + 0.05), (0.0135, 0.0155, 0.055), (-14, 0, 0), 'plastic'),
        ('cyl', (-0.02, y - 0.01, z + 0.05), (0.0135, 0.0155, 0.055), (-14, 0, 0), 'plastic'),
        ('box', (0, y - 0.012, z + 0.03), (0.07, 0.024, 0.018), (0, 0, 0), 'hard'),
    ]
    for sx in (1, -1):
        spec.append(('box', (sx * 0.112, h.y + 0.005, h.z + 0.12), (0.01, 0.11, 0.022), (8, 0, 0), 'plastic'))
    return solids(spec, 'nvg')


def team_gear(team, r, kit, bvh):
    """回傳 [(名稱, 高模, 低模, 允許的骨頭)]"""
    J = r.J
    G = []
    spine = ['spine_01', 'spine_02', 'spine_03', 'pelvis']

    def add(nm, parts, bones):
        G.append((nm, parts[0], parts[1], bones))
    if team == 'atk':
        add('vest', gear(kit, 'vestB', (0, 0.012, 1.315), (1.3, 1.1, 1.12), tris=1500, push=bvh, clip=lambda c: abs(c.x) > 0.245 or c.z > 1.465), spine + ['clavicle_l', 'clavicle_r'])
        for sx in (1, -1):
            add('shstrap', shoulder_strap(r, bvh, sx * 0.108, 0.046, -0.12, 0.15), spine + ['clavicle_l', 'clavicle_r'])
        for k, x in enumerate((-0.072, 0.072)):
            add('mag', gear(kit, 'mag2', (x, -0.183, 1.18), 0.92, tris=330, name=f'mag{k}'), spine)
        add('util', gear(kit, 'util', (-0.185, 0.03, 1.0), 0.8, rot=(0, 0, 90), tris=320, push=bvh, clear=0.012), ['pelvis', 'spine_01'])
    else:
        add('vest', gear(kit, 'vestA', (0, 0.012, 1.3), (1.26, 1.08, 1.14), tris=2100, push=bvh), spine + ['clavicle_l', 'clavicle_r'])
        for k, x in enumerate((-0.085, 0.0, 0.085)):
            add('mag', gear(kit, 'mag1', (x, -0.205, 1.165), (0.92, 0.92, 0.9), tris=260, name=f'mag{k}'), spine)
        add('radio', gear(kit, 'radio', (-0.2, 0.03, 1.27), 0.9, rot=(0, 0, 90), tris=300, voxel=0.0045, push=bvh, clear=0.022, min_area=0.004), spine)
        add('util', gear(kit, 'util', (0.185, 0.03, 1.0), 0.8, rot=(0, 0, -90), tris=320, push=bvh, clear=0.012), ['pelvis', 'spine_01'])
    # 腰帶、護膝、靴子、口袋兩隊都有（配色不同）
    add('belt', gear(kit, 'belt', (0, 0.012, 1.02), (0.96, 0.95, 0.92), tris=520, push=bvh, clear=0.006), ['pelvis', 'spine_01'])
    for side, m in ((1, False), (-1, True)):
        s = '_l' if side > 0 else '_r'
        kn = J['calf' + s]
        add('knee' + s, gear(kit, 'knee', (kn.x * 1.06, kn.y - 0.078, kn.z + 0.012), 0.92, mirror=m, tris=300, name='knee' + s, push=bvh, clear=0.012), ['calf' + s, 'thigh' + s])
        ft = J['foot' + s]
        add('boot' + s, gear(kit, 'bootB', (ft.x, ft.y - 0.083, 0.104), (1.14, 1.06, 1.14), mirror=side > 0, tris=720, name='boot' + s), ['foot' + s, 'ball' + s, 'calf' + s])
        th = J['thigh' + s]
        if side < 0:   # 右腿掛槍套，不放側袋
            add('holster', holster(r, s, side), ['thigh' + s])
            continue
        add('cargo' + s, gear(kit, 'cargo', (th.x + side * 0.088, th.y - 0.004, 0.72), (1, 1, 0.92), mirror=m, tris=120, name='cargo' + s, push=bvh, clear=0.004), ['thigh' + s])
    if team == 'def':
        add('helmet', gear(kit, 'helmet', (0, 0.008, 1.683), 0.93, tris=2300, voxel=0.0042, push=bvh, clear=0.003), ['Head'])
        eyez = r.eyec
        hi, lo = goggles(r, None, (0, eyez[1] - 0.041, eyez[2] - 0.002))
        add('goggles', (hi, lo), ['Head'])
        add('nvg', nvg_mount(r), ['Head'])
        for side, m in ((1, False), (-1, True)):
            s = '_l' if side > 0 else '_r'
            e = r.J['lowerarm' + s]
            add('elbow' + s, gear(kit, 'knee', (e.x, e.y + 0.052, e.z + 0.012), (0.72, 0.8, 0.62), rot=(0, 90, 180), mirror=m, tris=240, name='elbow' + s, push=bvh, clear=0.005), ['upperarm' + s, 'lowerarm' + s])
    if team == 'atk':
        add('hood', hood_collar(r), ['spine_03', 'clavicle_l', 'clavicle_r'])
    else_eyes = None
    return G


def merge(meshes, name):
    bm = bmesh.new()
    for m in meshes:
        bm.from_mesh(m)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    return me


def obj_of(me, name):
    o = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(o)
    return o


def preview_mat(team):
    """gear 面依 pal 屬性上色"""
    mats = []
    for k in PAL_KEYS:
        m = bpy.data.materials.new(f'{team}_{k}')
        hexv = {'lens': '#0a0d10', 'eye': '#807a72'}.get(k) or TEAM[team][k]
        m.diffuse_color = (*srgb(hexv), 1)
        mats.append(m)
    return mats


def body_lo(team, r):
    """低模身體（原拓撲），回傳新物件"""
    P, N = cloth_base(r, team)
    Pw = low_folds(P, N, r, BULK[team]['fold'] if team in BULK else 0.0055)
    Pw = head_shape(team, Pw, r)
    me = r.body.data.copy()
    set_verts(me, Pw[r.weld.inv])
    o = obj_of(me, f'lo_body_{team}')
    groups = {g.index: g.name for g in r.body.vertex_groups}
    for g in r.body.vertex_groups:
        o.vertex_groups.new(name=g.name)
    for v in r.body.data.vertices:
        for g in v.groups:
            o.vertex_groups[groups[g.group]].add([v.index], g.weight, 'REPLACE')
    return o


def head_shape(team, Pw, r):
    """頭部：赤沙把耳鼻抹平成面罩，留眼縫（焊接空間）"""
    W = r.weld
    c = r.eyec
    z = {k: W.down(v) for k, v in r.zone.items()}
    head = z['head'] + z['neck']
    if team not in ('atk', 'def'):
        return Pw
    slot = eye_slot(Pw, c) if team == 'atk' else np.zeros(len(Pw))   # 警察戴全罩，眼睛在護目鏡後面
    m = lap_scalar(z['head'] * (1 - smoothstep(0.4, 1.0, slot)), W.E, 1)
    P2 = laplacian(Pw, W.E, m, 7, 0.5)
    N = W.normals(P2)
    t = lap_scalar(head * (1 - smoothstep(0.3, 0.9, slot)) * 0.0055, W.E, 3)
    return P2 + N * t[:, None]


def eye_slot(P, c):
    """眼縫遮罩：1 在眼縫內。c 是兩眼中點"""
    dx = (P[:, 0] - c[0]) / 0.074
    dz = (P[:, 2] - (c[2] + 0.002)) / 0.0235
    front = smoothstep(c[1] + 0.05, c[1] + 0.0, P[:, 1])
    d = (np.abs(dx) ** 3 + np.abs(dz) ** 3) ** (1 / 3)
    return (1 - smoothstep(0.82, 1.0, d)) * front


def cut_feet(o, r):
    """靴子裡的腳與小腿下段刪掉，褲腳切平、往內收進靴口上方"""
    bm = bmesh.new()
    bm.from_mesh(o.data)
    kill = [f for f in bm.faces if max(v.co.z for v in f.verts) < 0.165]
    bmesh.ops.delete(bm, geom=kill, context='FACES')
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    for v in bm.verts:
        if v.is_boundary and v.co.z < 0.3:
            s = 1 if v.co.x > 0 else -1
            cx, cy = r.J['foot_l'].x * s, r.J['foot_l'].y - 0.015
            v.co.z = 0.172
            v.co.x = cx + (v.co.x - cx) * 0.84
            v.co.y = cy + (v.co.y - cy) * 0.84
    bm.to_mesh(o.data)
    bm.free()


def weld_normals(me):
    """UBC 帶的自訂法線已失效；接縫兩側共用焊接法線，打光時看不到 UV 接縫"""
    for a in ('custom_normal',):
        if a in me.attributes:
            me.attributes.remove(me.attributes[a])
    W = Weld(me)
    N = W.normals(W.down(verts_np(me)))
    me.polygons.foreach_set('use_smooth', [True] * len(me.polygons))
    me.normals_split_custom_set_from_vertices([tuple(n) for n in N[W.inv]])
    me.update()


def bvh_of(me):
    return bvhtree.BVHTree.FromPolygons([tuple(v.co) for v in me.vertices], [tuple(p.vertices) for p in me.polygons])


def build_geo(team):
    r = load_body()
    Pe = verts_np(r.eyes.data)
    if team in BULK:
        Pe = body_shape(Pe)
        set_verts(r.eyes.data, Pe)
    r.eyec = Vector(Pe.mean(0))
    kit = load_kit()
    lo = body_lo(team, r)
    cut_feet(lo, r)
    weld_normals(lo.data)
    r.bvh = bvh_of(lo.data)
    r.lo_P = verts_np(lo.data)
    G = team_gear(team, r, kit, r.bvh)
    return r, lo, G


def preview(path, team):
    r, lo, G = build_geo(team)
    r.body.hide_render = True
    r.eyes.hide_render = True
    mats = preview_mat(team)
    cloth = bpy.data.materials.new('cloth')
    cloth.diffuse_color = (*srgb(TEAM[team]['shirt']), 1)
    lo.data.materials.append(cloth)
    use = 'hi' if '--hi' in argv else 'lo'
    tot = len(lo.data.polygons)
    for nm, h, l, bones in G:
        me = h if use == 'hi' else l
        o = obj_of(me, nm)
        for m in mats:
            me.materials.append(m)
        pal = me.attributes.get('pal')
        if pal:
            vals = np.zeros(len(me.polygons), dtype=np.int32)
            pal.data.foreach_get('value', vals)
            me.polygons.foreach_set('material_index', vals)
        tot += len(me.polygons)
    print('faces', tot)
    s = bpy.context.scene
    s.render.engine = 'BLENDER_WORKBENCH'
    sh = s.display.shading
    sh.light = 'STUDIO'
    sh.color_type = 'MATERIAL'
    sh.show_cavity = True
    sh.show_shadows = False
    sh.background_type = 'VIEWPORT'
    sh.background_color = (0.72, 0.67, 0.58)
    s.render.resolution_x, s.render.resolution_y = 900, 1000
    cam = bpy.data.cameras.new('c')
    cam.type = 'ORTHO'
    co = bpy.data.objects.new('c', cam)
    s.collection.objects.link(co)
    s.camera = co
    views = {'f': ((0, -4, 1.0), (90, 0, 0), 2.0), 's': ((4, 0, 1.0), (90, 0, 90), 2.0), 'b': ((0, 4, 1.0), (90, 0, 180), 2.0),
             'tf': ((0, -4, 1.38), (90, 0, 0), 0.95), 'ts': ((4, 0, 1.38), (90, 0, 90), 0.95), 'h': ((0.35, -2, 1.68), (90, 0, 10), 0.45)}
    for k, (l, e, oz) in views.items():
        cam.ortho_scale = oz
        co.location = l
        co.rotation_euler = tuple(math.radians(x) for x in e)
        s.render.filepath = f'{path}{team}_{k}.png'
        bpy.ops.render.render(write_still=True)



# ------------------------------------------------------------------ 高模衣服與上色


def lo_zones(lo, r):
    """低模（已切腳）的主要骨頭 -> 區域名"""
    dom = dominant(lo)
    names = []
    for b in dom:
        if b == 'Head':
            names.append('head')
        elif b == 'neck_01':
            names.append('neck')
        elif b.startswith(('hand_', 'index', 'middle', 'pinky', 'ring', 'thumb')):
            names.append('hand')
        elif b.startswith(('foot_', 'ball_', 'calf')):
            names.append('calf')
        elif b.startswith(('spine', 'pelvis', 'clavicle')):
            names.append('torso')
        elif b.startswith('upperarm'):
            names.append('uarm')
        elif b.startswith('lowerarm'):
            names.append('farm')
        elif b.startswith('thigh'):
            names.append('thigh')
        else:
            names.append('torso')
    return names


def make_hi_body(team, lo, r):
    """細分＋布褶位移＋頂點色的衣服高模"""
    bm = bmesh.new()
    bm.from_mesh(lo.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=2e-4)
    me = bpy.data.meshes.new(f'hi_body_{team}')
    bm.to_mesh(me)
    bm.free()
    for a in list(me.attributes):
        if a.name.startswith(('COLOR', 'Col')):
            me.attributes.remove(a)
    obj = obj_of(me, f'hi_body_{team}')
    sub = obj.modifiers.new('s', 'SUBSURF')
    sub.levels = sub.render_levels = 3
    sub.uv_smooth = 'PRESERVE_BOUNDARIES'
    dg = bpy.context.evaluated_depsgraph_get()
    hm = bpy.data.meshes.new_from_object(obj.evaluated_get(dg))
    obj.modifiers.clear()
    obj.data = hm
    bpy.data.meshes.remove(me)
    hm.name = f'hi_body_{team}'
    P = verts_np(hm)
    # 區域：取最近低模頂點
    zn = lo_zones(lo, r)
    kd = kdtree.KDTree(len(lo.data.vertices))
    for v in lo.data.vertices:
        kd.insert(v.co, v.index)
    kd.balance()
    near = np.array([kd.find(Vector(p))[1] for p in P])
    zarr = np.array(zn)[near]
    zones_ = {k: (zarr == k).astype(np.float64) for k in ('head', 'neck', 'hand', 'torso', 'uarm', 'farm', 'thigh', 'calf')}
    N = np.zeros(len(P) * 3)
    hm.vertex_normals.foreach_get('vector', N)
    N = N.reshape(-1, 3)
    z = P[:, 2]
    J = r.J
    disp = cloth_folds(P, r, zones_)
    # 手、頭不要皺褶
    disp *= 1 - zones_['hand']
    disp *= 1 - zones_['head']
    head = zones_['head'] + zones_['neck']
    pal = TEAM[team]
    n = len(P)
    col = np.zeros((n, 3))
    rough = np.full(n, 0.9)
    skin = np.zeros(n)

    def paint(mask, hexv, r_=None):
        c = np.array(srgb(hexv))
        col[:] = col * (1 - mask[:, None]) + c * mask[:, None]
        if r_ is not None:
            rough[:] = rough * (1 - mask) + r_ * mask

    lower = (zones_['thigh'] + zones_['calf'] + zones_['torso'] * (z < 1.03)).clip(0, 1)
    upper = (zones_['torso'] * (z >= 1.03) + zones_['uarm'] + zones_['farm']).clip(0, 1)
    paint(upper, pal['shirt'], 0.88)
    paint(lower, pal['pants'], 0.9)
    # 素色布料：低頻明暗，不再用迷彩
    m = sine_noise(P, 203, 7.0, 3) * 0.5 + 0.5
    col[:] = col * (0.9 + 0.17 * m[:, None])

    def limb_t(a, b):
        return dist_seg(P, np.array(a), np.array(b))[1]

    # 臂章（雙上臂中段）＋布邊凸起
    for s in ('_l', '_r'):
        t = limb_t(J['upperarm' + s], J['lowerarm' + s])
        arm = zones_['uarm'] * (np.sign(P[:, 0]) == (1 if s == '_l' else -1))
        m = arm * smoothstep(0.38, 0.39, t) * (1 - smoothstep(0.66, 0.67, t))
        if pal['band']:
            paint(m, pal['band'], 0.8)
            disp += m * 0.0024
        # 袖口
        t = limb_t(J['lowerarm' + s], J['hand' + s])
        farm = zones_['farm'] * (np.sign(P[:, 0]) == (1 if s == '_l' else -1))
        m = farm * smoothstep(0.86, 0.875, t)
        disp += m * 0.003
        if team == 'atk':   # 羅紋袖口
            paint(m, '#4a4739', 0.92)
            disp += m * 0.0012 * np.sin(np.arctan2(P[:, 1] - J['hand' + s].y, P[:, 2] - J['hand' + s].z) * 44)
        # 膝蓋上下的護膝鬆緊帶
        k = J['calf' + s]
        leg = (zones_['thigh'] + zones_['calf']) * (np.sign(P[:, 0]) == (1 if s == '_l' else -1))
        for dz in (0.1, -0.09):
            m = leg * (1 - smoothstep(0.014, 0.017, np.abs(z - (k.z + dz))))
            paint(m, pal['strap'], 0.85)
            disp += m * 0.004
        if s == '_r' and team in BULK:   # 槍套腿帶
            for zb in (0.84, 0.68):
                m = leg * (1 - smoothstep(0.016, 0.019, np.abs(z - zb)))
                paint(m, pal['strap'], 0.8)
                disp += m * 0.006
    # 腰帶內襯與防彈衣側帶（縫隙不露身體）
    tor = zones_['torso']
    m = tor * smoothstep(0.985, 0.992, z) * (1 - smoothstep(1.052, 1.06, z))
    paint(m, pal['strap'], 0.85)
    disp += m * 0.004
    if team == 'atk':
        # 外套前襟拉鍊與兩側縫線
        front = smoothstep(0.02, -0.02, P[:, 1] - J['spine_02'].y) * tor * smoothstep(1.03, 1.04, z)
        m = front * (1 - smoothstep(0.0055, 0.0085, np.abs(P[:, 0])))
        paint(m, '#3f3d2a', 0.7)
        disp += m * 0.003
        m = front * (1 - smoothstep(0.0085, 0.012, np.abs(P[:, 0]))) * smoothstep(0.0055, 0.0085, np.abs(P[:, 0]))
        disp -= m * 0.0018
        # 下擺羅紋
        m = tor * smoothstep(1.03, 1.035, z) * (1 - smoothstep(1.075, 1.08, z))
        paint(m, '#4a4739', 0.92)
        disp += m * 0.0012 * np.sin(np.arctan2(P[:, 0], P[:, 1] - J['pelvis'].y) * 60)
        for a, b in ((1.13, 1.18), (1.2, 1.25)):
            m = tor * smoothstep(a, a + 0.005, z) * (1 - smoothstep(b, b + 0.005, z))
            paint(m, pal['strap'], 0.8)
            disp += m * 0.005
    else:
        m = tor * smoothstep(1.11, 1.116, z) * (1 - smoothstep(1.28, 1.286, z))
        paint(m, pal['shell'], 0.82)
        disp += m * 0.007
    # 手套：指節與手腕帶
    paint(zones_['hand'], pal['glove'], 0.6)
    for s in ('_l', '_r'):
        for f in ('index', 'middle', 'ring', 'pinky'):
            d = np.linalg.norm(P - np.array(J[f'{f}_01{s}']), axis=1)
            disp += zones_['hand'] * 0.0028 * (1 - smoothstep(0.012, 0.02, d))
        d = np.linalg.norm(P - np.array(J['hand' + s]), axis=1)
        m = zones_['hand'] * (1 - smoothstep(0.03, 0.04, d))
        disp += m * 0.003
        paint(m, pal['strap'], 0.7)
    if team == 'fp':
        # 第一人稱近看：手背硬殼、指節接縫、掌心止滑布
        for s in ('_l', '_r'):
            H = np.array(J['hand' + s])
            side = np.sign(P[:, 0]) == (1 if s == '_l' else -1)
            fa = np.array(J['middle_01' + s]) - H
            L = np.linalg.norm(fa)
            fa = fa / L
            t = (P - H) @ fa
            back = N[:, 2] > 0.25        # T 字姿勢手背朝上
            palm = N[:, 2] < -0.3
            hand = zones_['hand'] * side
            m = hand * back * smoothstep(0.32 * L, 0.38 * L, t) * (1 - smoothstep(0.86 * L, 0.92 * L, t))
            disp += m * 0.0026
            paint(m, '#232428', 0.42)
            paint(hand * palm * smoothstep(0.1 * L, 0.2 * L, t), '#2b2a29', 0.82)
            for f in ('index', 'middle', 'ring', 'pinky', 'thumb'):
                for k in ('02', '03'):
                    d = np.linalg.norm(P - np.array(J[f'{f}_{k}{s}']), axis=1)
                    disp -= hand * 0.0009 * (1 - smoothstep(0.0028, 0.0052, np.abs(d - 0.0095)))
    # 頭
    c = r.eyec
    if team == 'def':
        # 全罩式面罩：下巴到頸部都是黑布，鼻梁一道縫線
        paint(head, pal['hood'], 0.9)
        disp += head * sine_noise(P, 8, 60.0, 2) * 0.0006
    elif team == 'atk':
        paint(head, pal['hood'], 0.95)
        slot = eye_slot(P, c)
        skin = np.maximum(skin, smoothstep(0.55, 0.75, slot) * head)
        # 面罩眼縫厚邊
        rim = head * (1 - smoothstep(0.55, 0.75, slot)) * smoothstep(0.05, 0.4, slot)
        disp += rim * 0.0035
        disp += head * (1 - skin) * sine_noise(P, 7, 60.0, 2) * 0.0007
    else:
        # 頸套到下巴；耳後與後腦算頭套，只露正臉
        y0 = J['Head'].y
        face = zones_['head'] * smoothstep(1.552, 1.562, z) * smoothstep(y0 + 0.012, y0 - 0.012, P[:, 1])
        wrap = (head - face).clip(0, 1)
        paint(wrap, pal['hood'], 0.92)
        disp += wrap * zones_['neck'] * 0.0022 * (0.5 + 0.5 * np.sin(z * 420 + sine_noise(P, 9, 8.0, 2) * 3.0))
        skin = np.maximum(skin, face)
    # 灰塵：褲腳與膝蓋沾砂
    dust = lower * (smoothstep(0.5, 0.17, z) * 0.17 + 0.07 * (1 - np.abs(z - 0.55) / 0.08).clip(0, 1)) * (0.2 + 0.8 * smoothstep(0.1, 0.9, (sine_noise(P, 11, 11.0, 3) * 0.5 + 0.5).clip(0, 1)))
    sand = np.array(srgb('#a08a6c'))
    col[:] = col * (1 - dust[:, None]) + sand * dust[:, None]
    disp *= 1 - skin
    Pn = P + N * disp[:, None]
    set_verts(hm, Pn)
    a = hm.attributes.new('Col', 'FLOAT_COLOR', 'POINT')
    rgba = np.concatenate([col, skin[:, None]], 1)
    a.data.foreach_set('color', rgba.reshape(-1).astype(np.float32))
    b = hm.attributes.new('Aux', 'FLOAT_COLOR', 'POINT')
    aux = np.stack([rough, rough, rough, np.ones(n)], 1)
    b.data.foreach_set('color', aux.reshape(-1).astype(np.float32))
    hm.polygons.foreach_set('use_smooth', [True] * len(hm.polygons))
    hm.update()
    return obj


def skin_material(base_mat):
    """從 UBC 原材質抓皮膚貼圖"""
    return next(n.image for n in base_mat.node_tree.nodes if n.type == 'TEX_IMAGE' and 'Dark' in n.image.name)


def mat_hi_body(team, skin_img):
    m = bpy.data.materials.new(f'hibody_{team}')
    m.use_nodes = True
    nt = m.node_tree
    b = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    a = nt.nodes.new('ShaderNodeVertexColor')
    a.layer_name = 'Col'
    x = nt.nodes.new('ShaderNodeVertexColor')
    x.layer_name = 'Aux'
    t = nt.nodes.new('ShaderNodeTexImage')
    t.image = skin_img
    br = nt.nodes.new('ShaderNodeBrightContrast')
    br.inputs['Bright'].default_value = 0.08
    nt.links.new(t.outputs['Color'], br.inputs['Color'])
    mx = nt.nodes.new('ShaderNodeMixRGB')
    nt.links.new(a.outputs['Alpha'], mx.inputs[0])
    nt.links.new(a.outputs['Color'], mx.inputs[1])
    nt.links.new(br.outputs['Color'], mx.inputs[2])
    nt.links.new(mx.outputs['Color'], b.inputs['Base Color'])
    nt.links.new(x.outputs['Color'], b.inputs['Roughness'])
    return m


def mat_hi_gear(team):
    """裝備高模：每個 pal 一個材質，底色上加低頻磨損"""
    ms = []
    for k in PAL_KEYS:
        m = bpy.data.materials.new(f'hg_{team}_{k}')
        m.use_nodes = True
        nt = m.node_tree
        b = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
        hexv = {'lens': '#0b0f12', 'eye': '#807a72'}.get(k) or TEAM[team][k]
        c = srgb(hexv)
        tc = nt.nodes.new('ShaderNodeTexCoord')
        ns = nt.nodes.new('ShaderNodeTexNoise')
        ns.inputs['Scale'].default_value = 22
        ns.inputs['Detail'].default_value = 6
        nt.links.new(tc.outputs['Object'], ns.inputs['Vector'])
        rp = nt.nodes.new('ShaderNodeValToRGB')
        rp.color_ramp.elements[0].position = 0.35
        rp.color_ramp.elements[1].position = 0.65
        rp.color_ramp.elements[0].color = (*[x * 0.8 for x in c], 1)
        rp.color_ramp.elements[1].color = (*[min(1, x * 1.28 + 0.008) for x in c], 1)
        nt.links.new(ns.outputs['Fac'], rp.inputs['Fac'])
        nt.links.new(rp.outputs['Color'], b.inputs['Base Color'])
        b.inputs['Roughness'].default_value = ROUGH[k]
        ms.append(m)
    return ms


# ------------------------------------------------------------------ 圖集：攤 UV、烘焙


def uv_atlas(lo, gear_lo):
    """身體 UV 縮到左下、鎖住；裝備用 smart project，再讓 pack 繞開身體"""
    BODY_SCALE = 0.74
    me = lo.data
    uv = np.zeros(len(me.loops) * 2)
    me.uv_layers[0].data.foreach_get('uv', uv)
    me.uv_layers[0].data.foreach_set('uv', uv * BODY_SCALE)
    # 合併後一起 pack
    bpy.ops.object.select_all(action='DESELECT')
    gear_lo.select_set(True)
    bpy.context.view_layer.objects.active = gear_lo
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(58), island_margin=0.004, area_weight=0.6, correct_aspect=True)
    bpy.ops.object.mode_set(mode='OBJECT')
    lo.select_set(True)
    bpy.context.view_layer.objects.active = lo
    bpy.ops.object.mode_set(mode='EDIT')
    bm_b = bmesh.from_edit_mesh(lo.data)
    uvl = bm_b.loops.layers.uv.active
    for f in bm_b.faces:
        for l in f.loops:
            l[uvl].pin_uv = True
    bmesh.update_edit_mesh(lo.data)
    bpy.ops.mesh.select_all(action='SELECT')
    bm_g = bmesh.from_edit_mesh(gear_lo.data)
    bpy.ops.uv.select_all(action='SELECT')
    bpy.ops.uv.pack_islands(udim_source='CLOSEST_UDIM', rotate=True, scale=True, merge_overlap=False, margin_method='ADD',
                            margin=0.0025, pin=True, pin_method='LOCKED', shape_method='CONCAVE')
    bpy.ops.object.mode_set(mode='OBJECT')


def cycles_setup(samples=8):
    s = bpy.context.scene
    s.render.engine = 'CYCLES'
    s.cycles.samples = samples
    s.cycles.use_denoising = False
    try:
        pr = bpy.context.preferences.addons['cycles'].preferences
        pr.compute_device_type = 'METAL'
        pr.get_devices()
        for d in pr.devices:
            d.use = d.type == 'METAL'
        s.cycles.device = 'GPU'
    except Exception as e:
        print('cycles cpu', e)
    w = bpy.data.worlds.new('w') if not s.world else s.world
    s.world = w
    w.light_settings.distance = 0.22


def new_image(name, w, h, data=True):
    img = bpy.data.images.new(name, w, h, alpha=False, float_buffer=False)
    img.colorspace_settings.name = 'Non-Color' if data else 'sRGB'
    return img


def bake_one(kind, img, pairs, samples, margin=10, first=True):
    """pairs: [(低模, 高模)]，同一張圖依序烘"""
    s = bpy.context.scene
    s.cycles.samples = samples
    s.cycles.bake_type = kind
    for lo, hi in pairs:
        for ms in lo.data.materials:
            tn = ms.node_tree.nodes.get('bakeT')
            tn.image = img
            ms.node_tree.nodes.active = tn
    for i, (lo, hi) in enumerate(pairs):
        bpy.ops.object.select_all(action='DESELECT')
        hi.select_set(True)
        lo.select_set(True)
        bpy.context.view_layer.objects.active = lo
        kw = {}
        if kind == 'DIFFUSE':
            kw = dict(pass_filter={'COLOR'})
        if kind == 'NORMAL':
            kw = dict(normal_space='TANGENT', normal_r='POS_X', normal_g='POS_Y', normal_b='POS_Z')
        bpy.ops.object.bake(type=kind, use_selected_to_active=True, cage_extrusion=0.012, max_ray_distance=0.03, margin=margin,
                            margin_type='EXTEND', use_clear=(i == 0), target='IMAGE_TEXTURES', **kw)


def bake_team(team):
    os.makedirs(WORK, exist_ok=True)
    r, lo, G = build_geo(team)
    # 眼睛（赤沙才看得到）
    pal_eye = PAL_KEYS.index('eye')
    hg = merge([g[1] for g in G], f'hi_gear_{team}')
    lows = []
    bones_of = {}
    for g in G:
        tag = g[2]
        n = len(tag.polygons)
        a = tag.attributes.get('gi') or tag.attributes.new('gi', 'INT', 'FACE')
        a.data.foreach_set('value', [len(lows)] * n)
        lows.append(g)
    lg = merge([g[2] for g in G], f'lo_gear_{team}')
    if team == 'atk':
        eme = r.eyes.data.copy()
        eo = obj_of(eme, 'eyestmp')
        mod = eo.modifiers.new('d', 'DECIMATE')
        mod.ratio = 0.35
        dg = bpy.context.evaluated_depsgraph_get()
        el = bpy.data.meshes.new_from_object(eo.evaluated_get(dg))
        el.materials.clear()
        bpy.data.objects.remove(eo, do_unlink=True)
        for m_ in (el,):
            a = m_.attributes.new('gi', 'INT', 'FACE')
            a.data.foreach_set('value', [len(lows)] * len(m_.polygons))
            b = m_.attributes.new('pal', 'INT', 'FACE')
            b.data.foreach_set('value', [pal_eye] * len(m_.polygons))
        lows.append(('eyes', None, None, ['Head']))
        lg2 = merge([lg, el], f'lo_gear_{team}')
        hg2 = merge([hg, el], f'hi_gear_{team}')
        lg, hg = lg2, hg2
    for uvn in list(lg.uv_layers):
        lg.uv_layers.remove(uvn)
    lg.uv_layers.new(name='UVMap')
    hi_g = obj_of(hg, f'hi_gear_{team}')
    lo_g = obj_of(lg, f'lo_gear_{team}')
    gmats = mat_hi_gear(team)
    hg.materials.clear()
    for m in gmats:
        hg.materials.append(m)
    pv = np.zeros(len(hg.polygons), dtype=np.int32)
    hg.attributes['pal'].data.foreach_get('value', pv)
    hg.polygons.foreach_set('material_index', pv)
    hg.polygons.foreach_set('use_smooth', [True] * len(hg.polygons))
    lg.polygons.foreach_set('use_smooth', [True] * len(lg.polygons))
    hg.update()
    lg.update()
    # 高模衣服
    base_mat = r.body.data.materials[0]
    skin_img = skin_material(base_mat)
    hi_b = make_hi_body(team, lo, r)
    hmat = mat_hi_body(team, skin_img)
    hi_b.data.materials.clear()
    hi_b.data.materials.append(hmat)
    # 低模
    lo.data.polygons.foreach_set('use_smooth', [True] * len(lo.data.polygons))
    lo.data.materials.clear()
    lg.materials.clear()
    bk = bpy.data.materials.new(f'soldier_{team}')
    bk.use_nodes = True
    tn = bk.node_tree.nodes.new('ShaderNodeTexImage')
    tn.name = 'bakeT'
    lo.data.materials.append(bk)
    lg.materials.append(bk)
    uv_atlas(lo, lo_g)
    cycles_setup()
    print('tris lo', sum(len(p.vertices) - 2 for p in lo.data.polygons), sum(len(p.vertices) - 2 for p in lg.polygons), 'hi', len(hi_b.data.polygons), len(hg.polygons), flush=True)
    r.body.hide_render = True
    r.eyes.hide_render = True
    r.body.hide_viewport = True
    r.eyes.hide_viewport = True
    R = int(arg('--res', '2048'))
    R2 = max(512, R // 2)
    pairs = [(lo, hi_b), (lo_g, hi_g)]
    # 法線不要互相遮擋：另一組高模隱藏
    def only(pair):
        for x in (hi_b, hi_g):
            x.hide_render = x is not pair
    imgs = {}
    for kind, nm, res, data, spp in (('DIFFUSE', 'a', R, False, 2), ('NORMAL', 'n', R, True, 4), ('ROUGHNESS', 'r', R2, True, 1), ('AO', 'o', R2, True, int(arg('--aospp', '48')))):
        img = new_image(f'{team}_{nm}', res, res, data)
        for i, pr in enumerate(pairs):
            if kind != 'AO':
                only(pr[1])
            else:
                hi_b.hide_render = hi_g.hide_render = False
            bake_one(kind, img, [pr], spp, margin=int(10 * res / 2048) + 2) if i == 0 else bake_second(kind, img, pr, spp, res)
        img.filepath_raw = os.path.join(WORK, f'{team}_{nm}.png')
        img.file_format = 'PNG'
        img.save()
        imgs[nm] = img
        print('baked', nm, flush=True)
    finish_maps(team)
    # 存低模
    for o in list(bpy.data.objects):
        if o not in (lo, lo_g):
            bpy.data.objects.remove(o, do_unlink=True)
    meta = {'groups': [(g[0], g[3]) for g in lows]}
    json.dump(meta, open(os.path.join(WORK, f'{team}.json'), 'w'))
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(WORK, f'{team}.blend'))


def bake_second(kind, img, pr, spp, res):
    lo, hi = pr
    s = bpy.context.scene
    s.cycles.samples = spp
    tn = lo.data.materials[0].node_tree.nodes['bakeT']
    tn.image = img
    bpy.ops.object.select_all(action='DESELECT')
    hi.select_set(True)
    lo.select_set(True)
    bpy.context.view_layer.objects.active = lo
    kw = {}
    if kind == 'DIFFUSE':
        kw = dict(pass_filter={'COLOR'})
    if kind == 'NORMAL':
        kw = dict(normal_space='TANGENT', normal_r='POS_X', normal_g='POS_Y', normal_b='POS_Z')
    bpy.ops.object.bake(type=kind, use_selected_to_active=True, cage_extrusion=0.012, max_ray_distance=0.03, margin=int(10 * res / 2048) + 2,
                        margin_type='EXTEND', use_clear=False, target='IMAGE_TEXTURES', **kw)


def load_png(path):
    img = bpy.data.images.load(path)
    w, h = img.size
    a = np.zeros(w * h * 4, dtype=np.float32)
    img.pixels.foreach_get(a)
    return img, a.reshape(h, w, 4), w, h


def finish_maps(team):
    """合成最終貼圖：底色乘一點 AO 並加布紋，ORM 打包"""
    print('finish', team, flush=True)
    a_img, A, w, h = load_png(os.path.join(WORK, f'{team}_a.png'))
    _, R, rw, rh = load_png(os.path.join(WORK, f'{team}_r.png'))
    o_img, O, _, _ = load_png(os.path.join(WORK, f'{team}_o.png'))
    # 細布紋（高頻）乘到底色
    yy, xx = np.mgrid[0:h, 0:w]
    weave = (np.sin(xx * 1.9) * np.sin(yy * 1.9) * 0.5 + 0.5)
    rng = np.random.RandomState(4)
    grain = rng.normal(0, 1, (h, w))
    tone = 0.97 + 0.05 * weave + 0.022 * grain
    # AO 放大到底色尺寸
    ao = O[..., 0]
    if ao.shape[0] != h:
        k = h // ao.shape[0]
        ao = np.repeat(np.repeat(ao, k, 0), k, 1)
    aoA = 1 - 0.45 * (1 - ao)
    A[..., :3] = np.clip(A[..., :3] * tone[..., None] * aoA[..., None], 0, 1)
    A[..., 3] = 1
    out = bpy.data.images.new(f'{team}_albedo', w, h, alpha=False)
    out.colorspace_settings.name = 'sRGB'
    out.pixels.foreach_set(A.reshape(-1))
    out.filepath_raw = os.path.join(WORK, f'{team}_albedo.png')
    out.file_format = 'PNG'
    out.save()
    orm = np.zeros((rh, rw, 4), dtype=np.float32)
    orm[..., 0] = O[..., 0]
    orm[..., 1] = R[..., 0]
    orm[..., 2] = 0
    orm[..., 3] = 1
    img = bpy.data.images.new(f'{team}_orm', rw, rh, alpha=False)
    img.colorspace_settings.name = 'Non-Color'
    img.pixels.foreach_set(orm.reshape(-1))
    img.filepath_raw = os.path.join(WORK, f'{team}_orm.png')
    img.file_format = 'PNG'
    img.save()


# ------------------------------------------------------------------ 最終材質與檢視


def final_material(team, res_tex=None):
    m = bpy.data.materials.new(f'soldier_{team}')
    m.use_nodes = True
    nt = m.node_tree
    b = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    def tex(path, data):
        i = bpy.data.images.load(path, check_existing=True)
        i.colorspace_settings.name = 'Non-Color' if data else 'sRGB'
        t = nt.nodes.new('ShaderNodeTexImage')
        t.image = i
        return t
    A = tex(os.path.join(WORK, f'{team}_albedo.png'), False)
    N = tex(os.path.join(WORK, f'{team}_n.png'), True)
    O = tex(os.path.join(WORK, f'{team}_orm.png'), True)
    nm = nt.nodes.new('ShaderNodeNormalMap')
    sp = nt.nodes.new('ShaderNodeSeparateColor')
    nt.links.new(A.outputs['Color'], b.inputs['Base Color'])
    nt.links.new(N.outputs['Color'], nm.inputs['Color'])
    nt.links.new(nm.outputs['Normal'], b.inputs['Normal'])
    nt.links.new(O.outputs['Color'], sp.inputs['Color'])
    nt.links.new(sp.outputs['Green'], b.inputs['Roughness'])
    nt.links.new(sp.outputs['Blue'], b.inputs['Metallic'])
    return m


def studio(s, res=(900, 1100)):
    """砂岩色背景＋曬太陽的主光，看輪廓對比"""
    s.render.engine = 'CYCLES'
    s.cycles.samples = 48
    s.cycles.use_denoising = False
    s.view_settings.view_transform = 'Standard'
    s.render.resolution_x, s.render.resolution_y = res
    w = bpy.data.worlds.new('w2')
    w.use_nodes = True
    nt = w.node_tree
    nt.nodes.clear()
    bg = nt.nodes.new('ShaderNodeBackground')
    wo = nt.nodes.new('ShaderNodeOutputWorld')
    nt.links.new(bg.outputs[0], wo.inputs[0])
    bg.inputs[0].default_value = (0.62, 0.53, 0.42, 1)
    bg.inputs[1].default_value = 0.9
    s.world = w
    sun = bpy.data.lights.new('sun', 'SUN')
    sun.energy = 3.4
    sun.color = (1.0, 0.93, 0.82)
    sun.angle = math.radians(3)
    so = bpy.data.objects.new('sun', sun)
    s.collection.objects.link(so)
    so.rotation_euler = (math.radians(55), 0, math.radians(30))
    fl = bpy.data.lights.new('fill', 'SUN')
    fl.energy = 0.5
    fl.color = (0.65, 0.75, 1.0)
    fo = bpy.data.objects.new('fill', fl)
    s.collection.objects.link(fo)
    fo.rotation_euler = (math.radians(70), 0, math.radians(-120))
    cam = bpy.data.cameras.new('c')
    cam.type = 'ORTHO'
    co = bpy.data.objects.new('c', cam)
    s.collection.objects.link(co)
    s.camera = co
    return cam, co


def look(team, path):
    bpy.ops.wm.open_mainfile(filepath=os.path.join(WORK, f'{team}.blend'))
    s = bpy.context.scene
    cycles_setup()
    m = final_material(team)
    for o in list(s.objects):
        if o.type == 'MESH':
            o.data.materials.clear()
            o.data.materials.append(m)
    cam, co = studio(s)
    views = {'f': ((0, -4, 0.95), (90, 0, 0), 2.1), 's': ((4, 0, 0.95), (90, 0, 90), 2.1), 'b': ((0, 4, 0.95), (90, 0, 180), 2.1),
             'tf': ((0, -4, 1.34), (90, 0, 0), 1.0), 'ts': ((4, 0, 1.34), (90, 0, 90), 1.0), 'h': ((0.5, -2, 1.68), (90, 0, 14), 0.45)}
    for k, (l, e, oz) in views.items():
        cam.ortho_scale = oz
        co.location = l
        co.rotation_euler = tuple(math.radians(x) for x in e)
        s.render.filepath = f'{path}{team}_{k}.png'
        bpy.ops.render.render(write_still=True)


# ------------------------------------------------------------------ 動畫：取樣成數值、解析 IK、寫回 action

FWD = Vector((0, -1, 0))     # 角色面向（Blender 座標）
UP = Vector((0, 0, 1))
FPS = 24


class Pose:
    """rest 與 FK：每根骨頭的 basis（loc, quat）-> 骨架空間矩陣"""

    def __init__(self, arm):
        self.arm = arm
        self.names = [b.name for b in arm.data.bones]
        self.parent = {b.name: (b.parent.name if b.parent else None) for b in arm.data.bones}
        self.B = {b.name: b.matrix_local.copy() for b in arm.data.bones}
        self.Binv = {n: m.inverted() for n, m in self.B.items()}
        self.L = {}
        for n in self.names:
            p = self.parent[n]
            self.L[n] = (self.Binv[p] @ self.B[n]) if p else self.B[n].copy()
        self.Linv = {n: m.inverted() for n, m in self.L.items()}
        self.kids = {n: [] for n in self.names}
        for n, p in self.parent.items():
            if p:
                self.kids[p].append(n)

    def fk(self, fr):
        M = {}
        for n in self.names:          # bones 依父子順序
            p = self.parent[n]
            loc, q = fr[n]
            bas = Matrix.Translation(loc) @ q.to_matrix().to_4x4()
            M[n] = (M[p] @ self.L[n] @ bas) if p else (self.L[n] @ bas)
        return M

    def set_world(self, fr, M, n, mat):
        """把骨頭 n 的骨架空間矩陣改成 mat，更新 fr（子孫的 M 需重算）"""
        p = self.parent[n]
        par = M[p] if p else Matrix.Identity(4)
        bas = self.Linv[n] @ par.inverted() @ mat
        fr[n] = (bas.to_translation(), bas.to_quaternion())
        M[n] = mat
        self.refresh(fr, M, n)

    def refresh(self, fr, M, n):
        for k in self.kids[n]:
            loc, q = fr[k]
            bas = Matrix.Translation(loc) @ q.to_matrix().to_4x4()
            M[k] = M[n] @ self.L[k] @ bas
            self.refresh(fr, M, k)


def sample_actions(arm, names, scale):
    """把 UAL 的 action 取樣成 [ {骨頭: (loc, quat)} ]"""
    s = bpy.context.scene
    arm.animation_data_create()
    out = {}
    bones = [b.name for b in arm.data.bones]
    for name in names:
        act = bpy.data.actions[name]
        arm.animation_data.action = act
        if len(act.slots):
            arm.animation_data.action_slot = act.slots[0]
        f0, f1 = int(act.frame_range[0]), int(act.frame_range[1])
        fr = []
        for f in range(f0, f1 + 1):
            s.frame_set(f)
            d = {}
            for b in bones:
                pb = arm.pose.bones[b]
                d[b] = (pb.location.copy() * scale, pb.rotation_quaternion.copy())
            fr.append(d)
        out[name] = fr
    arm.animation_data.action = None
    return out


def rot_about(mat, pivot, q):
    """矩陣繞 pivot 做世界旋轉 q"""
    return Matrix.Translation(pivot) @ q.to_matrix().to_4x4() @ Matrix.Translation(-pivot) @ mat


def add_yaw(P, fr, M, bone, deg, axis=UP):
    q = Quaternion(axis, math.radians(deg))
    P.set_world(fr, M, bone, rot_about(M[bone], M[bone].translation, q))


def frame3(d, h):
    d = d.normalized()
    h = (h - d * h.dot(d)).normalized()
    return Matrix((d, h, d.cross(h))).transposed()


class Hands:
    """手部解剖軸與握持矩陣（rest 骨架空間）"""

    def __init__(self, P):
        self.P = P
        self.ax = {}
        for s in ('_r', '_l'):
            H = P.B['hand' + s].translation
            fa = (P.B['middle_01' + s].translation - H).normalized()
            lat = (P.B['pinky_01' + s].translation - P.B['index_01' + s].translation)
            lat = (lat - fa * lat.dot(fa)).normalized()
            n = fa.cross(lat) * (1 if s == '_r' else -1)    # 掌心方向
            self.ax[s] = (fa, lat, n)
        self.size = (P.B['middle_01_r'].translation - P.B['hand_r'].translation).length

    def grip_right(self, rake=16):
        """回傳 X_R：手骨局部 -> 槍框架（grip 原點）的固定矩陣。槍框架 +X 左、+Y 上、+Z 槍口"""
        fa, lat, n = self.ax['_r']
        t = math.radians(rake)
        c, s_ = math.cos(t), math.sin(t)
        gx = n
        gy = lat * -c + fa * -s_
        gz = lat * -s_ + fa * c
        o = self.P.B['hand_r'].translation + fa * (self.size * 0.82) + n * 0.03 + lat * 0.012
        F = Matrix((gx, gy, gz)).transposed().to_4x4()
        F.translation = o
        return self.P.Binv['hand_r'] @ F, F

    def support_left(self, n_g, fa_g, palm_off=0.032):
        """左手：掌心 n_g、手指 fa_g（都在槍框架），回傳 手骨局部 <- 接觸點 的矩陣 XL"""
        fa, lat, n = self.ax['_l']
        n_g = Vector(n_g).normalized()
        fa_g = Vector(fa_g)
        fa_g = (fa_g - n_g * fa_g.dot(n_g)).normalized()
        lat_g = fa_g.cross(n_g)
        # 手的三軸對應到槍框架：R 把手的 rest 軸轉到槍框架
        hand_basis = Matrix((fa, lat, n)).transposed()
        gun_basis = Matrix((fa_g, lat_g, n_g)).transposed()
        R = hand_basis @ gun_basis.inverted()        # 槍框架向量 -> rest 骨架
        o = self.P.B['hand_l'].translation + fa * (self.size * 0.72) + n * palm_off
        F = R.to_4x4()
        F.translation = o
        return self.P.Binv['hand_l'] @ F

    def thumb_lay(self, XL, dirs):
        """左手拇指貼槍面：dirs 是三節在接觸框架（+X 左、+Y 上、+Z 槍口）的方向，回傳 {骨頭: basis 四元數}。
        finger_pose 只會往掌心彎，托護木時掌心朝上，拇指彎多少就翹多高，所以這裡直接指定每節方向"""
        P = self.P
        Fr = (P.B['hand_l'] @ XL).to_3x3()
        tail = {1: P.B['thumb_02_l'].translation, 2: P.B['thumb_03_l'].translation, 3: P.arm.data.bones['thumb_03_l'].tail_local}
        par = Quaternion()
        out = {}
        for i, d in enumerate(dirs, 1):
            b = f'thumb_0{i}_l'
            d0 = par @ (tail[i] - P.B[b].translation).normalized()
            w = d0.rotation_difference((Fr @ Vector(d)).normalized()) @ par
            rel = par.inverted() @ w
            Br = P.B[b].to_3x3()
            out[b] = (Br.inverted() @ rel.to_matrix() @ Br).to_quaternion()
            par = w
        return out


def two_bone(P, fr, M, s, wrist_mat, pole):
    """解析兩段 IK：把手骨放到 wrist_mat，手肘朝 pole"""
    S = M['upperarm' + s].translation.copy()
    W = wrist_mat.translation.copy()
    L1 = (P.B['lowerarm' + s].translation - P.B['upperarm' + s].translation).length
    L2 = (P.B['hand' + s].translation - P.B['lowerarm' + s].translation).length
    d = W - S
    D = min(d.length, (L1 + L2) * 0.999)
    u = d.normalized()
    W = S + u * D
    a = (L1 * L1 - L2 * L2 + D * D) / (2 * D)
    b = math.sqrt(max(0.0, L1 * L1 - a * a))
    v = pole - S
    v = (v - u * v.dot(u)).normalized()
    E = S + u * a + v * b
    sign = 1 if s == '_r' else -1
    d0u = (P.B['lowerarm' + s].translation - P.B['upperarm' + s].translation).normalized()
    d0f = (P.B['hand' + s].translation - P.B['lowerarm' + s].translation).normalized()
    h0 = UP * sign
    du, df = (E - S).normalized(), (W - E).normalized()
    h = du.cross(df)
    if h.length < 1e-4:
        h = v.cross(du)
    h.normalize()
    # 上臂
    R = frame3(du, h) @ frame3(d0u, h0).inverted()
    mu = (R @ P.B['upperarm' + s].to_3x3()).to_4x4()
    mu.translation = S
    P.set_world(fr, M, 'upperarm' + s, mu)
    # 前臂：手肘鉸鏈與手腕各吃一半扭轉（沒有扭轉骨）
    R2 = frame3(df, h) @ frame3(d0f, h0).inverted()
    q_h = (R2 @ P.B['lowerarm' + s].to_3x3()).to_quaternion()
    Hr = wrist_mat.to_3x3() @ P.B['hand' + s].to_3x3().inverted()     # 手相對 rest 的旋轉
    fwd_after = Hr @ d0f
    q_w = (fwd_after.rotation_difference(df).to_matrix() @ Hr @ P.B['lowerarm' + s].to_3x3()).to_quaternion()
    ql = q_h.slerp(q_w, 0.55)
    # 只留繞前臂軸的差異，方向一定要對
    cur = (ql.to_matrix() @ P.Binv['lowerarm' + s].to_3x3() @ d0f)
    ql = cur.rotation_difference(df) @ ql
    ml = ql.to_matrix().to_4x4()
    ml.translation = E
    P.set_world(fr, M, 'lowerarm' + s, ml)
    wm = wrist_mat.copy()
    wm.translation = W
    P.set_world(fr, M, 'hand' + s, wm)


def finger_pose(P, fr, side, curl, thumb):
    """curl: {指名: (a1,a2,a3)} 度。繞手部側向軸往掌心彎；用 rest 基底寫 basis（蓋掉來源動畫）"""
    H = P.B['hand' + side].translation
    fa = (P.B['middle_01' + side].translation - H).normalized()
    lat = P.B['pinky_01' + side].translation - P.B['index_01' + side].translation
    lat = (lat - fa * lat.dot(fa)).normalized()
    n = fa.cross(lat) * (1 if side == '_r' else -1)
    axis = fa.cross(n).normalized()
    for f, ang in curl.items():
        for i, a in enumerate(ang):
            b = f'{f}_0{i + 1}{side}'
            loc = fr[b][0]
            ax = P.Binv[b].to_3x3() @ axis
            fr[b] = (loc, Quaternion(ax, math.radians(a)))
    # 拇指：往掌心與手指方向收
    ta = (P.B['thumb_02' + side].translation - P.B['thumb_01' + side].translation).normalized()
    tax = ta.cross(n).normalized()
    for i, a in enumerate(thumb):
        b = f'thumb_0{i + 1}{side}'
        ax = P.Binv[b].to_3x3() @ tax
        fr[b] = (fr[b][0], Quaternion(ax, math.radians(a)))


GRIP_R = {'index': (28, 38, 20), 'middle': (72, 88, 52), 'ring': (74, 88, 52), 'pinky': (76, 86, 50)}
SUPPORT_L = {'index': (52, 62, 36), 'middle': (60, 70, 42), 'ring': (64, 72, 44), 'pinky': (68, 74, 46)}
THUMB_GRIP = (30, 46, 36)
THUMB_SUP = (38, 50, 38)
THUMB_FORE = ((-0.36, -0.02, 0.93), (-0.08, 0.08, 0.99), (-0.05, 0.05, 0.99))   # 步槍左手拇指：沿護木左側往槍口貼，見 Hands.thumb_lay
RELAX = {'index': (12, 16, 8), 'middle': (16, 20, 10), 'ring': (20, 22, 12), 'pinky': (24, 24, 12)}


def aim_basis(pitch, yaw, roll=0):
    """槍框架的旋轉：+Z_gun 朝角色前方，再加俯仰偏航（度）。偏航正值＝槍口往角色左"""
    gx, gy, gz = Vector((1, 0, 0)), Vector((0, 0, 1)), FWD
    R = Matrix.Rotation(math.radians(yaw), 3, 'Z')
    R2 = Matrix.Rotation(math.radians(-pitch), 3, gx)
    Q = Matrix((gx, gy, gz)).transposed()
    Rr = Matrix.Rotation(math.radians(roll), 3, gz)
    return R @ R2 @ Rr @ Q


class Hold:
    """持槍姿態設定。cp：鎖骨前收度數（肩關節到背心前緣有 29 cm，不收前臂一定穿背心）；po：右肘往外的量；face：頭的俯仰，None 表示不修"""

    def __init__(self, twist, lean, pitch=0.0, yaw=0.0, off=(0.05, 0.28, -0.03), fore=0.31, roll=0.0, pelvis=0.0, face=-5.0, fy=0.075, cp=0.0, po=0.18):
        self.__dict__.update(locals())


LOW = dict(pitch=-10, off=(0.03, 0.35, -0.19), fore=0.22, cp=22, po=0.22)      # 低持貼胸，手肘下垂
RIFLE = Hold(twist=14, lean=5, yaw=10, pelvis=10, face=-5, **LOW)
RIFLE_WALK = Hold(twist=28, lean=3, yaw=12, pelvis=0, face=-5, **LOW)
RIFLE_AIM = Hold(twist=24, lean=4, pitch=0, yaw=6, off=(0.04, 0.34, -0.08), fore=0.22, pelvis=10, face=-2, cp=18, po=0.35)
RIFLE_KNEEL = Hold(twist=24, lean=2, pitch=0, yaw=6, off=(0.04, 0.34, -0.08), fore=0.22, pelvis=0, face=-2, cp=18, po=0.35)
RIFLE_CROUCH = Hold(twist=24, lean=4, pitch=0, yaw=6, off=(0.04, 0.34, -0.08), fore=0.22, pelvis=0, face=-3, cp=18, po=0.35)
RIFLE_RUN = Hold(twist=26, lean=0, pitch=-30, yaw=28, off=(0.12, 0.27, -0.24), fore=0.22, roll=10, pelvis=0, face=-6, cp=16, po=0.3)
RIFLE_JUMP = Hold(twist=30, lean=2, pitch=-16, yaw=14, off=(0.06, 0.33, -0.2), fore=0.22, pelvis=10, face=-6, cp=22, po=0.35)
PISTOL = Hold(twist=-6, lean=5, pitch=-14, yaw=0, off=(0.14, 0.42, -0.20), fore=0.0, pelvis=0, face=-5, cp=10, po=0.3)
PISTOL_WALK = Hold(twist=10, lean=4, pitch=-14, yaw=0, off=(0.14, 0.40, -0.20), fore=0.0, pelvis=0, face=-5, cp=10, po=0.3)
PISTOL_AIM = Hold(twist=-6, lean=4, pitch=0, yaw=0, off=(0.13, 0.46, -0.07), fore=0.0, pelvis=0, face=-2, cp=10, po=0.3)
PISTOL_RUN = Hold(twist=8, lean=0, pitch=-30, yaw=8, off=(0.17, 0.32, -0.26), fore=0.0, pelvis=0, face=-6, cp=10, po=0.3)


def apply_hold(P, HA, fr, h, XRinv, XL_rifle, XL_pistol, anchor=None, pin=False, face=None):
    """anchor：槍錨定點（None 用當格右肩）；pin：骨盆轉完把腳釘回原位，走路類不要釘；face 蓋掉 h.face。回傳當格右肩"""
    M = P.fk(fr)
    if pin:
        feet = {s: M['foot' + s].copy() for s in ('_l', '_r')}
        knees = {s: M['calf' + s].translation.copy() for s in ('_l', '_r')}
    if h.pelvis:
        add_yaw(P, fr, M, 'pelvis', -h.pelvis)
        if pin:
            for s in ('_l', '_r'):
                leg_to(P, fr, M, s, feet[s], knees[s])
    n = 3
    for b in ('spine_01', 'spine_02', 'spine_03'):
        # 繞脊椎自身的軸扭：繞世界 UP 扭已前傾的脊椎會把前傾轉成側傾
        add_yaw(P, fr, M, b, -(h.twist - h.pelvis) / n, M[b].to_3x3().col[1].normalized())
        ax = (Matrix.Rotation(math.radians(-(h.twist) * 0.5), 3, 'Z') @ Vector((1, 0, 0)))
        add_yaw(P, fr, M, b, h.lean / n, ax)
    # 頭先把扭轉補回來，手解完再用 head_look 定俯仰
    for b, k in (('neck_01', 0.5), ('Head', 0.5)):
        add_yaw(P, fr, M, b, h.twist * k)
    if h.cp:
        add_yaw(P, fr, M, 'clavicle_r', h.cp)
        add_yaw(P, fr, M, 'clavicle_l', -h.cp)
    SR = M['upperarm_r'].translation.copy()
    SL = M['upperarm_l'].translation.copy()
    # 槍框架：以右肩為基準（角色座標：x 左、y 前、z 上）
    A = aim_basis(h.pitch, h.yaw, h.roll)
    o = (anchor if anchor is not None else SR) + Vector((h.off[0], 0, 0)) + FWD * h.off[1] + UP * h.off[2]
    F = A.to_4x4()
    F.translation = o
    hand_r = F @ XRinv
    two_bone(P, fr, M, '_r', hand_r, SR + UP * -0.6 + FWD * -0.25 + Vector((-h.po, 0, 0)))
    if h.fore > 0:
        # 左手托護木：接觸點在槍框架 (0, fy, fore)；fy 取 ar5／ks 護木下緣的折衷，寫進 meta 的 arms.thirdPersonLeft
        C = F @ Matrix.Translation((0.0, h.fy, h.fore))
        hand_l = C @ XL_rifle
        two_bone(P, fr, M, '_l', hand_l, SL + UP * -0.6 + FWD * -0.12 + Vector((0.12, 0, 0)))
    else:
        C = F @ Matrix.Translation((0.03, -0.035, 0.015))
        hand_l = C @ XL_pistol
        two_bone(P, fr, M, '_l', hand_l, SL + UP * -0.6 + FWD * -0.2 + Vector((0.2, 0, 0)))
    finger_pose(P, fr, '_r', GRIP_R, THUMB_GRIP)
    finger_pose(P, fr, '_l', SUPPORT_L, THUMB_SUP)
    if h.fore > 0:
        for b, q in HA.thumb_fore.items():
            fr[b] = (fr[b][0], q)
    pitch = h.face if face is None else face
    if pitch is not None:
        head_look(P, fr, M, pitch=pitch)
    return SR


def leg_to(P, fr, M, s, foot_mat, knee):
    """把腳踝放到 foot_mat，膝蓋朝 knee 目標點"""
    T = M['thigh' + s].translation.copy()
    L1 = (P.B['calf' + s].translation - P.B['thigh' + s].translation).length
    L2 = (P.B['foot' + s].translation - P.B['calf' + s].translation).length
    F = foot_mat.translation.copy()
    d = F - T
    D = min(d.length, (L1 + L2) * 0.999)
    u = d.normalized()
    a = (L1 * L1 - L2 * L2 + D * D) / (2 * D)
    b = math.sqrt(max(0, L1 * L1 - a * a))
    v = Vector(knee) - T
    v = (v - u * v.dot(u)).normalized()
    E = T + u * a + v * b
    F = T + u * D
    K = M['calf' + s].translation.copy()
    q = (K - T).rotation_difference(E - T)
    P.set_world(fr, M, 'thigh' + s, rot_about(M['thigh' + s], T, q))
    q = (M['foot' + s].translation - E).rotation_difference(F - E)
    P.set_world(fr, M, 'calf' + s, rot_about(M['calf' + s], E, q))
    nm = foot_mat.copy()
    nm.translation = F
    P.set_world(fr, M, 'foot' + s, nm)


def foot_mat(P, s, pos, pitch=0.0, yaw=0.0):
    """rest 腳掌 + 繞 X 俯仰（正＝腳尖往下）+ 繞 Z 偏航（正＝腳尖往左）"""
    m = Matrix.Rotation(math.radians(yaw), 3, 'Z') @ Matrix.Rotation(math.radians(pitch), 3, 'X') @ P.B['foot' + s].to_3x3()
    m = m.to_4x4()
    m.translation = Vector(pos)
    return m


def face_of(P, M):
    """頭的面向向量：rest 面向 FWD"""
    return (M['Head'].to_3x3() @ P.Binv['Head'].to_3x3() @ FWD).normalized()


def head_look(P, fr, M, target=None, pitch=None, k=(0.45, 0.55)):
    """target：看向一點；pitch：沿目前水平面向的俯仰（度，負＝朝下）"""
    for _ in range(3):
        f = face_of(P, M)
        if target is not None:
            w = (Vector(target) - M['Head'].translation).normalized()
        else:
            hor = Vector((f.x, f.y, 0)).normalized()
            w = (hor * math.cos(math.radians(pitch)) + UP * math.sin(math.radians(pitch))).normalized()
        q = f.rotation_difference(w)
        for b, kk in (('neck_01', k[0]), ('Head', k[1])):
            qq = Quaternion(q.axis, q.angle * kk)
            P.set_world(fr, M, b, rot_about(M[b], M[b].translation, qq))


def hand_target(P, HA, s, wrist, fa_t, n_t):
    """手骨世界矩陣：手腕位置、手指方向 fa_t、掌心方向 n_t"""
    fa, lat, n = HA.ax[s]
    fa_t = Vector(fa_t).normalized()
    n_t = Vector(n_t)
    n_t = (n_t - fa_t * n_t.dot(fa_t)).normalized()
    sgn = 1 if fa.cross(lat).dot(n) > 0 else -1
    lat_t = n_t.cross(fa_t) * sgn
    R = Matrix((fa_t, lat_t, n_t)).transposed() @ Matrix((fa, lat, n)).transposed().inverted()
    m = (R @ P.B['hand' + s].to_3x3()).to_4x4()
    m.translation = Vector(wrist)
    return m


def shoulder_pose(P, fr, M, s, fwd_deg, down_deg):
    """鎖骨：往前收 fwd_deg、往下沉 down_deg（度）"""
    sgn = 1 if s == '_l' else -1
    add_yaw(P, fr, M, 'clavicle' + s, sgn * fwd_deg, UP)
    add_yaw(P, fr, M, 'clavicle' + s, sgn * down_deg, Vector((0, 1, 0)))


def mirror_clip(P, frames):
    """左右鏡像（骨架空間算差量，對骨頭 roll 不敏感）"""
    S3 = Matrix.Diagonal((-1, 1, 1))
    S4 = Matrix.Diagonal((-1, 1, 1, 1))
    swap = lambda n: n[:-2] + ('_r' if n.endswith('_l') else '_l') if n.endswith(('_l', '_r')) else n
    out = []
    for fr in frames:
        M = P.fk(fr)
        D = {}
        for n in P.names:
            D[swap(n)] = S4 @ M[n] @ P.Binv[n] @ S4
        nf = {}
        M2 = {}
        for n in P.names:
            p = P.parent[n]
            m = D[n] @ P.B[n]
            par = M2[p] if p else Matrix.Identity(4)
            bas = P.Linv[n] @ par.inverted() @ m
            nf[n] = (bas.to_translation(), bas.to_quaternion())
            M2[n] = m
        out.append(nf)
    return out


def copy_clip(fr):
    return [{k: (v[0].copy(), v[1].copy()) for k, v in f.items()} for f in fr]


def blend_fr(a, b, t):
    return {k: (a[k][0].lerp(b[k][0], t), a[k][1].slerp(b[k][1], t)) for k in a}


def resample(frames, n):
    """等距重取樣到 n 格"""
    out = []
    m = len(frames) - 1
    for i in range(n):
        x = i / (n - 1) * m
        k = min(int(x), m - 1)
        out.append(blend_fr(frames[k], frames[k + 1], x - k))
    return out


def write_action(arm, name, frames, P):
    """用 layered action API 直接寫曲線"""
    act = bpy.data.actions.new(name)
    act.use_fake_user = True
    slot = act.slots.new('OBJECT', arm.name)
    layer = act.layers.new('L')
    strip = layer.strips.new(type='KEYFRAME')
    bag = strip.channelbag(slot, ensure=True)
    n = len(frames)
    ts = np.arange(n, dtype=np.float32)
    for b in P.names:
        q = np.array([[*f[b][1]] for f in frames], dtype=np.float32)
        # 四元數同號，避免內插繞遠路
        for i in range(1, n):
            if np.dot(q[i], q[i - 1]) < 0:
                q[i] = -q[i]
        for i in range(4):
            fc = bag.fcurves.new(f'pose.bones["{b}"].rotation_quaternion', index=i, group_name=b)
            fc.keyframe_points.add(n)
            co = np.stack([ts, q[:, i]], 1).reshape(-1)
            fc.keyframe_points.foreach_set('co', co)
            fc.keyframe_points.foreach_set('interpolation', [1] * n)
            fc.update()
        if b in ('pelvis', 'root'):
            lc = np.array([[*f[b][0]] for f in frames], dtype=np.float32)
            for i in range(3):
                fc = bag.fcurves.new(f'pose.bones["{b}"].location', index=i, group_name=b)
                fc.keyframe_points.add(n)
                co = np.stack([ts, lc[:, i]], 1).reshape(-1)
                fc.keyframe_points.foreach_set('co', co)
                fc.keyframe_points.foreach_set('interpolation', [1] * n)
                fc.update()
    return act


def height_of(P, fr, head_top_rest):
    M = P.fk(fr)
    d = head_top_rest - P.B['Head'].translation
    return (M['Head'] @ P.Binv['Head'] @ head_top_rest).z


def leg_ik(P, fr, drop, sink=0.0, off=None):
    """骨盆往下 drop，腳留在原位（兩段 IK）；sink 把腳再往下壓，補來源動畫的懸空。
    off：{'_l': (位移, 繞 X 的腳尖下壓度數)}，用來擺跨步、跪姿、收腿"""
    M = P.fk(fr)
    targets = {s: M['foot' + s].copy() for s in ('_l', '_r')}
    for t in targets.values():
        t.translation = t.translation - UP * sink
    for s, (d, deg) in (off or {}).items():
        loc = targets[s].translation + Vector(d)
        targets[s] = Matrix.Rotation(math.radians(deg), 4, 'X') @ targets[s]
        targets[s].translation = loc
    m = M['pelvis'].copy()
    m.translation = m.translation - UP * drop
    P.set_world(fr, M, 'pelvis', m)
    for s in ('_l', '_r'):
        T = M['thigh' + s].translation.copy()
        K = M['calf' + s].translation.copy()
        F = targets[s].translation
        L1 = (P.B['calf' + s].translation - P.B['thigh' + s].translation).length
        L2 = (P.B['foot' + s].translation - P.B['calf' + s].translation).length
        d = F - T
        D = min(d.length, (L1 + L2) * 0.999)
        u = d.normalized()
        a = (L1 * L1 - L2 * L2 + D * D) / (2 * D)
        b = math.sqrt(max(0, L1 * L1 - a * a))
        v = K - T
        v = v - u * v.dot(u)
        if v.length < 1e-4:
            v = FWD.copy()
        v.normalize()
        E = T + u * a + v * b
        # 大腿與小腿都用最小旋轉轉到新方向
        m0 = M['thigh' + s]
        q = (K - T).rotation_difference(E - T)
        P.set_world(fr, M, 'thigh' + s, rot_about(m0, T, q))
        m1 = M['calf' + s]
        q = (M['foot' + s].translation - E).rotation_difference(F - E)
        P.set_world(fr, M, 'calf' + s, rot_about(m1, E, q))
        m2 = M['foot' + s]
        nm = targets[s].copy()
        P.set_world(fr, M, 'foot' + s, nm)


DEVICE = (0.0, -0.34, 0.03)    # 裝藥在骨架空間的位置：根前方 .34，要和 round.js 的 showCharge 一致
DEVICE_WZ = 0.20               # 手腕在裝置上方的高度
LOOP_FROM = {}                 # 片段名 -> 循環起點秒數（前段是下跪，只播一次）

SOURCE = ['Idle_Loop', 'Walk_Loop', 'Jog_Fwd_Loop', 'Crouch_Idle_Loop', 'Crouch_Fwd_Loop', 'Jump_Start', 'Jump_Loop', 'Jump_Land',
          'Hit_Chest', 'Death01', 'Fixing_Kneeling', 'Pistol_Idle_Loop']


def build_anims(arm):
    """回傳 meta 與已建立的 action（名稱依 SPEC）"""
    P = Pose(arm)
    r_scale = arm['fit_scale']
    objs = import_gltf(ANIMS)
    for a in list(bpy.data.actions):
        if not any(a.name.startswith(k) for k in SOURCE):
            bpy.data.actions.remove(a)
    for o in objs:
        bpy.data.objects.remove(o, do_unlink=True)
    for a in bpy.data.actions:
        for k in SOURCE:
            if a.name.startswith(k):
                a.name = k
    for b in arm.pose.bones:
        b.rotation_mode = 'QUATERNION'
    src = sample_actions(arm, SOURCE, r_scale)
    HA = Hands(P)
    XR, F_rest = HA.grip_right(8)
    XRinv = XR.inverted()
    # 左手：托護木（掌心朝上略偏右、手指朝前右）／手槍副手（掌心朝右包住握把）
    XL_r = HA.support_left((-0.5, 0.86, 0.05), (-0.62, -0.25, 0.74))
    XL_p = HA.support_left((-0.9, 0.3, 0.1), (0.0, -0.45, 0.9), 0.03)
    XL_rifle = XL_r.inverted() if False else XL_r.inverted()
    XL_pistol = XL_p.inverted()
    HA.thumb_fore = HA.thumb_lay(XL_r, THUMB_FORE)

    meta = {}
    head_top = Vector((0, P.B['Head'].translation.y, HEIGHT))

    def holdc(frames, h, pin=False, damp=0.0):
        """damp：槍錨定在右肩的循環平均，當格肩膀偏移只跟 1-damp，跑步時槍才不會跟著肩晃"""
        anchors = [None] * len(frames)
        if damp:
            SR = [apply_hold(P, HA, f, h, XRinv, XL_rifle, XL_pistol, face=None) for f in copy_clip(frames)]
            mean = Vector(np.mean([tuple(v) for v in SR], axis=0))
            anchors = [mean + (v - mean) * (1 - damp) for v in SR]
        out = copy_clip(frames)
        for fr, an in zip(out, anchors):
            apply_hold(P, HA, fr, h, XRinv, XL_rifle, XL_pistol, anchor=an, pin=pin)
        return out

    def relax(frames):
        out = copy_clip(frames)
        for fr in out:
            finger_pose(P, fr, '_r', RELAX, (6, 10, 8))
            finger_pose(P, fr, '_l', RELAX, (6, 10, 8))
        return out

    def strafe(frames, deg):
        out = copy_clip(frames)
        for fr in out:
            M = P.fk(fr)
            add_yaw(P, fr, M, 'pelvis', deg)
            for b in ('spine_01', 'spine_02', 'spine_03'):
                add_yaw(P, fr, M, b, -deg / 3)
            # 兩腳張開些、膝蓋內收減少：把左右大腿外旋補回來由腰部承擔
        return out

    def upright(frames):
        # 原動畫是彎腰潛行：上身扳直，校正多放在脊椎，頸部只補一點
        X = Vector((1, 0, 0))
        for fr in frames:
            M = P.fk(fr)
            for b, d in (('spine_01', -13), ('spine_02', -13), ('spine_03', -10), ('neck_01', -4), ('Head', -2)):
                add_yaw(P, fr, M, b, d, X)
    # 蹲走：頭頂約 1.25–1.30
    crouch_w = copy_clip(src['Crouch_Fwd_Loop'])
    upright(crouch_w)
    h1 = np.mean([height_of(P, f, head_top) for f in crouch_w])
    print('crouch walk head', round(h1, 3), flush=True)
    for f in crouch_w:
        leg_ik(P, f, h1 - 1.285, 0.046)

    X_ = Vector((1, 0, 0))

    def kneel_rest(pel, tilt, spine):
        """全身歸零，骨盆放到 pel（Blender：x 左、-y 前、z 上）、前傾 tilt，脊椎再加 spine"""
        fr = {k: (Vector((0, 0, 0)), Quaternion()) for k in P.names}
        M = P.fk(fr)
        m3 = (Quaternion(X_, math.radians(tilt)).to_matrix() @ M['pelvis'].to_3x3()).to_4x4()
        m3.translation = Vector(pel)
        P.set_world(fr, M, 'pelvis', m3)
        for b, d in zip(('spine_01', 'spine_02', 'spine_03'), spine):
            add_yaw(P, fr, M, b, d, X_)
        return fr, M

    def kneel_legs(fr, M, knee_x, lf, ky=None):
        """右膝觸地、腳尖點地，左腳平踩"""
        Lt = (P.B['calf_r'].translation - P.B['thigh_r'].translation).length
        Lc = (P.B['foot_r'].translation - P.B['calf_r'].translation).length
        hip = M['thigh_r'].translation
        if ky is None:
            ky = hip.y + math.sqrt(max(0, Lt * Lt - (hip.z - 0.055) ** 2)) * 0.55
        kw = Vector((knee_x, ky, 0.055))
        fm = foot_mat(P, '_r', (knee_x + 0.01, ky + math.sqrt(Lc * Lc - 0.11 ** 2), 0.165), 62, -8)
        fm.translation.z += P.B['ball_r'].translation.z - (fm @ P.Binv['foot_r'] @ P.B['ball_r'].translation).z    # 腳尖點地，不穿地
        leg_to(P, fr, M, '_r', fm, kw + Vector((0, -0.25, 0)))
        lf = Vector(lf)
        leg_to(P, fr, M, '_l', foot_mat(P, '_l', lf, 0, 10), lf + Vector((0.03, -0.1, 0.45)))

    def kneel_aim(i, N):
        fr, M = kneel_rest((0.02, -0.10, 0.432 + 0.004 * math.sin(2 * math.pi * i / N)), 10, (3, 3, 2))
        kneel_legs(fr, M, -0.17, (0.19, -0.35, 0.095))
        apply_hold(P, HA, fr, RIFLE_KNEEL, XRinv, XL_rifle, XL_pistol)
        return fr

    def kneel_low(fr, M, knee_x, lf):
        """操作地上裝置的低跪：右膝在身前觸地、腳尖點地坐在右腳跟上，左腳平踩。骨盆比 kneel_legs 低，手才搆得到地面而不用折腰"""
        Lt = (P.B['calf_r'].translation - P.B['thigh_r'].translation).length
        Lc = (P.B['foot_r'].translation - P.B['calf_r'].translation).length
        hip = M['thigh_r'].translation
        ky = hip.y - math.sqrt(max(0, Lt * Lt - (hip.z - 0.055) ** 2 - (knee_x - hip.x) ** 2))
        kw = Vector((knee_x, ky, 0.055))
        fx = knee_x * 0.45
        fy = ky + math.sqrt(max(0, Lc * Lc - 0.11 ** 2 - (fx - knee_x) ** 2))
        fm = foot_mat(P, '_r', (fx, fy, 0.165), 62, 6)
        fm.translation.z += P.B['ball_r'].translation.z - (fm @ P.Binv['foot_r'] @ P.B['ball_r'].translation).z    # 腳尖點地，不穿地
        leg_to(P, fr, M, '_r', fm, kw + Vector((-0.1, -0.25, 0.1)))
        lf = Vector(lf)
        leg_to(P, fr, M, '_l', foot_mat(P, '_l', lf, 0, 16), lf + Vector((0.5, -0.1, 0.4)))

    def kneel_task(i, N, mode):
        """單膝低跪操作地上的裝置。plant：左手按住裝置，右手食指依序按鍵盤。defuse：左手捏線提起，右手捏工具來回撥。
        上身前傾 tilt＋spine 合計 KNEEL_LEAN 度，彎腰大多在髖，脊椎只分一點，背心才不會被擠變形"""
        ph = 2 * math.pi * i / N
        plant = mode == 'plant'
        sway = 0.006 * math.sin(ph)
        tilt, sp = (29, (5, 5, 4))
        fr, M = kneel_rest((0.0 + (sway if not plant else 0), -0.05, 0.275 + 0.004 * math.sin(ph * 2)), tilt, sp)
        kneel_low(fr, M, -0.2, (0.25, -0.18, 0.095))
        # 鎖骨沿軀幹的軸前送（肩往裝置靠、肩距才不塌），再往下沉
        tx = M['spine_03'].to_3x3().col[1].normalized()
        add_yaw(P, fr, M, 'clavicle_r', 14, tx)
        add_yaw(P, fr, M, 'clavicle_l', -14, tx)
        shoulder_pose(P, fr, M, '_l', 0, 8)
        shoulder_pose(P, fr, M, '_r', 0, 8)
        c = Vector(DEVICE)
        if plant:
            # 三下按鍵：每個 1/3 循環換一個位置，往下壓 1.5 cm
            k = (i * 3 // N) % 3
            u = (i * 3 / N) % 1
            press = math.sin(math.pi * u) ** 2
            key = (-0.022, 0.0, 0.022)[k]
            wR = c + Vector((key - 0.065, 0.04, DEVICE_WZ + 0.018 - 0.016 * press))
            wL = c + Vector((0.1, 0.04, DEVICE_WZ))
            faR, nR = (0.42, -0.6, -0.68), (0.1, -0.68, -0.72)
            faL, nL = (-0.46, -0.6, -0.64), (-0.14, -0.66, -0.74)
        else:
            a = math.sin(ph)
            wR = c + Vector((-0.07 + 0.016 * a, 0.04, DEVICE_WZ + 0.008 * math.sin(ph * 2)))
            wL = c + Vector((0.1 - 0.008 * a, 0.03 - 0.01 * a, DEVICE_WZ + 0.012 + 0.016 * max(0.0, math.sin(ph + 1))))
            r = math.radians(14 * a)
            faR, nR = (0.42 + 0.2 * math.sin(r), -0.6, -0.68), (0.32 * math.sin(r) + 0.14, -0.68, -0.72)
            faL, nL = (-0.5, -0.62, -0.6), (0.1, -0.62, -0.78)
        # 手肘朝後收在身側；往外翻的話正面看手臂會像垂到地上
        two_bone(P, fr, M, '_l', hand_target(P, HA, '_l', wL, faL, nL), M['upperarm_l'].translation + Vector((0.06, 0.5, 0.1)))
        two_bone(P, fr, M, '_r', hand_target(P, HA, '_r', wR, faR, nR), M['upperarm_r'].translation + Vector((-0.14, 0.5, 0.1)))
        head_look(P, fr, M, pitch=-26 if plant else -24, k=(0.3, 0.7))
        if plant:
            finger_pose(P, fr, '_l', {'index': (10, 14, 8), 'middle': (12, 16, 8), 'ring': (14, 16, 8), 'pinky': (16, 16, 8)}, (10, 14, 10))
            finger_pose(P, fr, '_r', {'index': (8, 12, 8), 'middle': (52, 66, 40), 'ring': (58, 68, 40), 'pinky': (60, 68, 40)}, (30, 40, 26))
        else:
            finger_pose(P, fr, '_l', {'index': (34, 44, 26), 'middle': (40, 48, 28), 'ring': (46, 52, 30), 'pinky': (50, 54, 30)}, (24, 32, 22))
            finger_pose(P, fr, '_r', {'index': (30, 42, 26), 'middle': (46, 58, 34), 'ring': (54, 62, 36), 'pinky': (58, 62, 36)}, (28, 36, 24))
        return fr

    def kneel_clip(fk, n_in, n, mode):
        """前段用來源的下跪混到跪姿，之後循環；loopFrom 寫進 meta"""
        K = [kneel_task(i, n, mode) for i in range(n + 1)]
        intro = []
        for i in range(n_in):
            t = smoothstep(0.0, 1.0, np.array([i / n_in]))[0]
            f = blend_fr(fk[i], K[0], float(t))
            M = P.fk(f)
            low = min(M[b].translation.z for b in ('ball_l', 'ball_r', 'foot_l', 'foot_r'))
            rest = min(P.B['ball_l'].translation.z, P.B['ball_r'].translation.z)
            if low < rest:      # 內插中途腳會穿地，整個人抬起來
                m = M['pelvis'].copy()
                m.translation = m.translation + UP * (rest - low)
                P.set_world(f, M, 'pelvis', m)
            intro.append(f)
        return intro + K, (n_in) / FPS

    def stance(frames, drop, lf, rf):
        """備戰站姿：左腳在前、右腳在後，膝蓋微彎朝前（leg_ik 保留來源膝向，腳收窄後會變 O 型腿）"""
        out = copy_clip(frames)
        for f in out:
            leg_ik(P, f, drop, 0.0, {'_l': (lf, 0), '_r': (rf, 0)})
            M = P.fk(f)
            for s, sx in (('_l', 1), ('_r', -1)):
                ft = M['foot' + s].copy()
                T = M['thigh' + s].translation
                leg_to(P, f, M, s, ft, (T + ft.translation) * 0.5 + FWD * 0.5 + Vector((sx * 0.06, 0, 0)))
        return out

    def steady(frames, bounce=0.4, swing=0.55, up=-9.0):
        """奔跑：骨盆彈跳壓到 bounce，肩線擺幅收 swing，上身扶直 up 度。頭和槍才穩"""
        out = copy_clip(frames)
        zs = [P.fk(f)['pelvis'].translation.z for f in out]
        zm = float(np.mean(zs))
        tgt = zm + 0.035
        for f, z in zip(out, zs):
            leg_ik(P, f, z - (tgt + (z - zm) * bounce))
        yaws = []
        for f in out:
            M = P.fk(f)
            ls = M['upperarm_l'].translation - M['upperarm_r'].translation
            yaws.append(math.degrees(math.atan2(-ls.y, ls.x)))
        ym = float(np.mean(yaws))
        for f, y in zip(out, yaws):
            M = P.fk(f)
            for b in ('spine_01', 'spine_02', 'spine_03'):
                add_yaw(P, f, M, b, (y - ym) * swing / 3, M[b].to_3x3().col[1].normalized())
                add_yaw(P, f, M, b, up / 3, Vector((1, 0, 0)))
        return out

    def calm(frames, k, bones=('spine_01', 'spine_02', 'spine_03', 'clavicle_l', 'clavicle_r')):
        out = copy_clip(frames)
        for b in bones:
            q0 = frames[0][b][1]
            s = [0, 0, 0, 0]
            for f in frames:
                q = f[b][1]
                sg = 1 if q.dot(q0) >= 0 else -1
                for i in range(4):
                    s[i] += q[i] * sg
            avg = Quaternion(s).normalized()
            for f in out:
                f[b] = (f[b][0], f[b][1].slerp(avg, k))
        return out

    clips = {}
    idle = stance(src['Idle_Loop'], 0.03, (-0.07, 0.0, 0), (0.06, -0.12, 0))
    clips['idle_rifle'] = holdc(idle, RIFLE, pin=True)
    clips['aim_rifle'] = holdc(idle, RIFLE_AIM, pin=True)
    walk = calm(src['Walk_Loop'], .7)
    clips['walk_rifle'] = holdc(walk, RIFLE_WALK)
    jog = steady(calm(src['Jog_Fwd_Loop'], .8))
    clips['run_rifle'] = holdc(jog, RIFLE_RUN, damp=0.7)
    clips['back_rifle'] = holdc(calm(list(reversed(src['Walk_Loop'])), .7), RIFLE_WALK)
    clips['strafe_l_rifle'] = holdc(strafe(walk, 62), RIFLE_WALK)
    clips['strafe_r_rifle'] = holdc(strafe(walk, -62), RIFLE_WALK)
    N = 36
    clips['crouch_idle'] = [kneel_aim(i, N) for i in range(N + 1)]
    clips['crouch_walk'] = holdc(crouch_w, RIFLE_CROUCH)
    # 跳躍在遊戲裡只有離地的半秒，整段都用空中收腿的姿勢
    jump = copy_clip(src['Jump_Loop'])
    for f in jump:
        leg_ik(P, f, 0.0, 0.0, {'_l': ((0.03, -0.12, 0.03), 12), '_r': ((-0.03, 0.10, 0.12), 12)})
    clips['jump'] = holdc(jump, RIFLE_JUMP)
    # 受擊：先後仰再解手，槍才不會跟著上身翹起來
    hit = copy_clip(src['Hit_Chest'])
    for i, f in enumerate(hit):
        w = math.sin(math.pi * min(1.0, (i + 1) / len(hit)))
        M = P.fk(f)
        for b, d in (('spine_01', -9), ('spine_02', -12), ('spine_03', -12)):
            add_yaw(P, f, M, b, d * w, X_)
        apply_hold(P, HA, f, RIFLE, XRinv, XL_rifle, XL_pistol, face=-6 + 24 * w)
    clips['hit'] = hit
    clips['death_a'] = relax(src['Death01'])
    clips['death_b'] = relax(mirror_clip(P, src['Death01']))
    fk = src['Fixing_Kneeling']
    clips['plant'], LOOP_FROM['plant'] = kneel_clip(fk, 10, 48, 'plant')
    clips['defuse'], LOOP_FROM['defuse'] = kneel_clip(fk, 10, 48, 'defuse')
    clips['idle_pistol'] = holdc(src['Pistol_Idle_Loop'], PISTOL)
    clips['aim_pistol'] = holdc(src['Pistol_Idle_Loop'], PISTOL_AIM)
    clips['walk_pistol'] = holdc(walk, PISTOL_WALK, damp=0.7)
    clips['run_pistol'] = holdc(jog, PISTOL_RUN, damp=0.7)
    # 清掉來源 action，寫新 action
    for a in list(bpy.data.actions):
        bpy.data.actions.remove(a)
    acts = {}
    for k, fr in clips.items():
        acts[k] = write_action(arm, k, fr, P)
        # 腳底接觸檢查：整段裡最低的腳掌骨高度，和 T 姿勢比
        rest_z = min(P.B['ball_l'].translation.z, P.B['ball_r'].translation.z)
        low = []
        for f in fr:
            M = P.fk(f)
            low.append(min(M[b].translation.z for b in ('ball_l', 'ball_r', 'foot_l', 'foot_r')))
        tops = [height_of(P, f, head_top) for f in fr]
        arm_len = (P.B['lowerarm_r'].translation - P.B['upperarm_r'].translation).length + (P.B['hand_r'].translation - P.B['lowerarm_r'].translation).length
        reach = [max((M['hand' + s].translation - M['upperarm' + s].translation).length for s in ('_l', '_r')) / arm_len for M in map(P.fk, fr)]
        if k in ('plant', 'defuse', 'crouch_idle'):
            print('kneel', k, kneel_metrics(P, fr[-7]), flush=True)
        print('clip', k, len(fr), 'foot', round(min(low) - rest_z, 3), round(float(np.mean(low)) - rest_z, 3), 'head', round(min(tops), 3), round(max(tops), 3), 'reach', round(max(reach), 3), flush=True)
    return P, XR, F_rest, XL_rifle, XL_pistol, {k: len(v) for k, v in clips.items()}


def kneel_metrics(P, fr):
    """跪姿量測：軀幹前傾、頸軸前傾、雙肘內角、肩距、Head 高出肩線、臉俯角、骨盆高"""
    M = P.fk(fr)
    ang = lambda a, b: math.degrees(a.angle(b))
    SL, SR = M['upperarm_l'].translation, M['upperarm_r'].translation
    Sm = (SL + SR) * 0.5
    pel = M['pelvis'].translation
    head = M['Head'].translation
    nk = M['neck_01'].translation
    elbow = [round(ang(M['upperarm' + s].translation - M['lowerarm' + s].translation, M['hand' + s].translation - M['lowerarm' + s].translation)) for s in ('_l', '_r')]
    f = face_of(P, M)
    return dict(lean=round(ang(Sm - pel, UP)), neck=round(ang(head - nk, UP)), elbow=elbow, sh=round((SL - SR).length, 3), headup=round(head.z - Sm.z, 3),
                face=round(math.degrees(math.asin(f.z))), pel=round(pel.z, 3), Sz=round(Sm.z, 3), Sy=round(Sm.y, 3),
                wr=[round(x, 3) for x in M['hand_r'].translation], wl=[round(x, 3) for x in M['hand_l'].translation])


# ------------------------------------------------------------------ 組裝：蒙皮、合併


VEST_PARTS = ('vest', 'shstrap', 'mag', 'radio')     # 掛在胸腹上的硬裝備，權重走 torso_field


def torso_field(co, J):
    """胸腹裝備的權重場，只看 rest 位置：沿脊椎高度在 pelvis／spine_01–03 間線性內插，肩頂帶一點鎖骨。
    背心與底下的身體共用這個場（見 bind_under_vest），兩者怎麼彎都走一樣的路，身體不會穿出來"""
    x, z = co
    zs = [J['pelvis'].z, (J['spine_01'].z + J['spine_02'].z) / 2, (J['spine_02'].z + J['spine_03'].z) / 2, (J['spine_03'].z + J['neck_01'].z) / 2]
    bones = ['pelvis', 'spine_01', 'spine_02', 'spine_03']
    w = {}
    for i, b in enumerate(bones):
        tab = [1.0 if k == i else 0.0 for k in range(4)]
        v = float(np.interp(z, zs, tab))
        if v > 0:
            w[b] = v
    cl = float(smoothstep(1.38, 1.47, np.array([z]))[0] * smoothstep(0.08, 0.16, np.array([abs(x)]))[0]) * 0.7
    if cl > 0:
        w = {k: v * (1 - cl) for k, v in w.items()}
        w['clavicle_l' if x > 0 else 'clavicle_r'] = cl
    return w


def bind_under_vest(body, gr, part_of_face, J):
    """背心覆蓋區的身體改走 torso_field：原權重帶 upperarm，手臂一動胸側就穿出背心"""
    me = gr.data
    gi = np.zeros(len(me.polygons), dtype=np.int32)
    me.attributes['gi'].data.foreach_get('value', gi)
    vs = [v.co.copy() for v in me.vertices]
    tris = [tuple(p.vertices) for p in me.polygons if part_of_face[gi[p.index]] in VEST_PARTS]
    bvh = bvhtree.BVHTree.FromPolygons(vs, tris)
    names = {g.index: g.name for g in body.vertex_groups}
    n = 0
    for v in body.data.vertices:
        c = v.co
        if c.z > 1.52 or c.z < 0.98 or abs(c.x) > 0.25:
            continue
        hit = bvh.find_nearest(c)
        if hit[0] is None:
            continue
        m = float(smoothstep(0.08, 0.035, np.array([hit[3]]))[0] * (1 - smoothstep(0.175, 0.24, np.array([abs(c.x)]))[0]) * (1 - smoothstep(1.48, 1.52, np.array([c.z]))[0]))
        if m <= 0:
            continue
        acc = {names[g.group]: g.weight * (1 - m) for g in v.groups}
        for b, w in torso_field((c.x, c.z), J).items():
            acc[b] = acc.get(b, 0) + w * m
        for g in list(v.groups):
            body.vertex_groups[g.group].remove([v.index])
        for b, w in sorted(acc.items(), key=lambda x: -x[1])[:4]:
            g = body.vertex_groups.get(b) or body.vertex_groups.new(name=b)
            g.add([v.index], w, 'REPLACE')
        n += 1
    print('bind_under_vest', body.name, n, flush=True)


def transfer_weights(lo_g, src, allowed_by_face, parts=None, J=None):
    """裝備頂點取原始身體最近 8 個頂點的權重（只留允許的骨頭），最多四根。VEST_PARTS 走 torso_field：
    背心離身體遠，最近頂點的權重互相跳動，再濾掉 upperarm 就成碎片"""
    me = src.data
    names = {g.index: g.name for g in src.vertex_groups}
    kd = kdtree.KDTree(len(me.vertices))
    for v in me.vertices:
        kd.insert(v.co, v.index)
    kd.balance()
    W = [[(names[g.group], g.weight) for g in v.groups] for v in me.vertices]
    gm = lo_g.data
    # 眼睛網格帶著 UBC 原本的骨頭索引，物件的群組又是空的，留著會對到錯的骨頭
    bm = bmesh.new()
    bm.from_mesh(gm)
    lay = bm.verts.layers.deform.active
    if lay:
        bm.verts.layers.deform.remove(lay)
    bm.to_mesh(gm)
    bm.free()
    # 每頂點屬於哪個零件群
    allowed = [None] * len(gm.vertices)
    field = [False] * len(gm.vertices)
    gi = np.zeros(len(gm.polygons), dtype=np.int32)
    gm.attributes['gi'].data.foreach_get('value', gi)
    for p in gm.polygons:
        a = allowed_by_face[gi[p.index]]
        for v in p.vertices:
            allowed[v] = a
            field[v] = bool(parts) and parts[gi[p.index]] in VEST_PARTS
    for v in gm.vertices:
        if field[v.index]:
            for b, w in torso_field((v.co.x, v.co.z), J).items():
                g = lo_g.vertex_groups.get(b) or lo_g.vertex_groups.new(name=b)
                g.add([v.index], w, 'REPLACE')
            continue
        al = allowed[v.index] or ['pelvis']
        acc = {}
        for co, idx, d in kd.find_n(v.co, 10):
            w0 = 1 / (0.02 + d)
            for b, w in W[idx]:
                if b in al:
                    acc[b] = acc.get(b, 0) + w * w0
        if not acc:
            acc = {al[0]: 1.0}
        top = sorted(acc.items(), key=lambda x: -x[1])[:4]
        t = sum(x[1] for x in top)
        for b, w in top:
            g = lo_g.vertex_groups.get(b) or lo_g.vertex_groups.new(name=b)
            g.add([v.index], w / t, 'REPLACE')


def assemble(team, r, tex_ready=True):
    path = os.path.join(WORK, f'{team}.blend')
    with bpy.data.libraries.load(path) as (src, dst):
        dst.objects = [f'lo_body_{team}', f'lo_gear_{team}']
    body, gr = dst.objects
    s = bpy.context.scene
    s.collection.objects.link(body)
    s.collection.objects.link(gr)
    meta = json.load(open(os.path.join(WORK, f'{team}.json')))
    allowed = [g[1] for g in meta['groups']]
    parts = [g[0] for g in meta['groups']]
    transfer_weights(gr, r.body, allowed, parts, r.J)
    bind_under_vest(body, gr, parts, r.J)
    weld_normals(gr.data)
    for o in (body, gr):
        o.data.materials.clear()
    m = final_material(team)
    body.data.materials.append(m)
    gr.data.materials.append(m)
    bpy.ops.object.select_all(action='DESELECT')
    gr.select_set(True)
    body.select_set(True)
    bpy.context.view_layer.objects.active = body
    bpy.ops.object.join()
    body.name = f'body_{team}'
    body.data.name = f'body_{team}'
    me = body.data
    for a in list(me.attributes):
        if a.name.startswith(('Color', 'gi', 'pal')):
            me.attributes.remove(a)
    leaf_to_parent(body)
    # 每個頂點只留權重最大的四根
    for v in me.vertices:
        gs = sorted(v.groups, key=lambda g: -g.weight)
        for g in gs[4:]:
            body.vertex_groups[g.group].remove([v.index])
    bpy.ops.object.vertex_group_normalize_all(lock_active=False) if False else None
    body.parent = r.arm
    mod = body.modifiers.new('Armature', 'ARMATURE')
    mod.object = r.arm
    return body


def leaf_to_parent(o):
    """指尖、腳尖的 leaf 骨已刪：權重併給上一節，否則那些頂點會留在 T 字位置"""
    rename = {}
    for g in list(o.vertex_groups):
        n = g.name
        if 'leaf' in n:
            rename[n] = (n.replace('_04_leaf_', '_03_') if '_04_leaf_' in n else n.replace('ball_leaf', 'ball'))
    for src_n, dst_n in rename.items():
        gs = o.vertex_groups[src_n]
        gd = o.vertex_groups.get(dst_n) or o.vertex_groups.new(name=dst_n)
        idx = gs.index
        for v in o.data.vertices:
            for g in v.groups:
                if g.group == idx and g.weight > 0:
                    gd.add([v.index], g.weight, 'ADD')
        o.vertex_groups.remove(gs)


def proxy_rifle():
    """檢查握持用的代用步槍（原點在握把，槍口 +Z_gun），不匯出"""
    bm = bmesh.new()

    def box(c, sz):
        M = Matrix.Translation(c) @ Matrix.Diagonal((sz[0], sz[1], sz[2], 1))
        bmesh.ops.create_cube(bm, size=1.0, matrix=M)
    box((0, 0.075, 0.1), (0.03, 0.05, 0.3))      # 機匣
    box((0, 0.075, 0.33), (0.042, 0.05, 0.24))   # 護木
    box((0, 0.08, 0.6), (0.014, 0.014, 0.34))    # 槍管
    box((0, -0.0, 0.0), (0.028, 0.11, 0.045))    # 握把
    box((0, -0.03, 0.12), (0.024, 0.15, 0.05))   # 彈匣
    box((0, 0.06, -0.2), (0.03, 0.09, 0.3))      # 槍托
    me = bpy.data.meshes.new('proxy')
    bm.to_mesh(me)
    bm.free()
    return me


def pose_arm(arm, act, f):
    arm.animation_data.action = act
    if len(act.slots):
        arm.animation_data.action_slot = act.slots[0]
    bpy.context.scene.frame_set(int(f))
    bpy.context.view_layer.update()


# 匯入的 glb 頂點已是 Blender 座標 (x, -z, y)，這個矩陣把它們轉回槍座標 (x, y, z)
GUN_FROM_BL = Matrix(((1, 0, 0, 0), (0, 0, 1, 0), (0, -1, 0, 0), (0, 0, 0, 1)))


def load_guns():
    """檢查用：匯入真正的 guns.glb，只在預覽算圖時出現，不匯出"""
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(OUT_DIR, 'guns.glb'))
    guns = {}
    for o in bpy.data.objects:
        if o not in before and o.type == 'MESH':
            guns[o.name.split('.')[0]] = o
            o.hide_render = True
        elif o not in before:
            o.hide_render = True
    return guns


def contact_sheet(path, arm, bodies, XR, clips, res=(420, 700)):
    """正側背＋持槍影格＋各動作，拼成一張"""
    s = bpy.context.scene
    cam, co = studio(s, res)
    s.cycles.samples = 32
    guns = load_guns()
    # 地板陰影
    bpy.ops.mesh.primitive_plane_add(size=30)
    fl = bpy.context.object
    fm = bpy.data.materials.new('fl')
    fm.use_nodes = True
    b = next(n for n in fm.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    b.inputs['Base Color'].default_value = (0.62, 0.53, 0.42, 1)
    fl.data.materials.append(fm)
    arm.animation_data_create()
    shots = []
    dist = 4
    views = {'f': ((0, -dist, 0.95), (90, 0, 0)), 's': ((dist, 0, 0.95), (90, 0, 90)), 'b': ((0, dist, 0.95), (90, 0, 180)), 'q': ((dist * 0.6, -dist * 0.8, 1.0), (88, 0, 37))}
    out = []
    for team, body in bodies.items():
        for o in bodies.values():
            o.hide_render = o is not body
        for clip, fr, vw in clips:
            act = bpy.data.actions[clip] if clip else None
            if act:
                pose_arm(arm, act, fr)
            else:
                arm.animation_data.action = None
                for b_ in arm.pose.bones:
                    b_.location = (0, 0, 0)
                    b_.rotation_quaternion = (1, 0, 0, 0)
                bpy.context.view_layer.update()
            rifle = clip and ('rifle' in clip or clip.startswith('crouch') or clip in ('jump', 'hit'))
            wid = 'ar5' if rifle else 'p9' if clip and 'pistol' in clip else None
            for k, o in guns.items():
                o.hide_render = k != wid
            if wid:
                # H 的欄就是槍座標軸
                guns[wid].matrix_world = arm.matrix_world @ arm.pose.bones['hand_r'].matrix @ XR @ GUN_FROM_BL
            l, e = views[vw]
            cam.ortho_scale = 2.2 if clip != '' else 2.2
            co.location = l
            co.rotation_euler = tuple(math.radians(x) for x in e)
            f = f'{path}_{team}_{clip or "rest"}_{fr}_{vw}.png'
            s.render.filepath = f
            bpy.ops.render.render(write_still=True)
            out.append(f)
    return out


# ------------------------------------------------------------------ 第一人稱手臂


# 換彈時左手抓彈匣的姿勢（槍座標，c 是彈匣中心）。手掌貼 +x 面，手指繞過彈匣前緣，拇指扣後緣
MAG_FORE, MAG_UP = (-0.35, 0.2, 0.92), (-0.4, -0.3, 0.87)
RELOAD_POSE = {
    'ks': dict(c=(0.0, -0.085, 0.165), n=(-0.92, -0.3, 0.2), fa=(-0.15, 0.1, 0.98), fore=MAG_FORE, upper=MAG_UP, thumb=dict(out=(1, -0.3, 0), y=-0.095, z=0.153, dir=(0, -0.2, 1), top=-0.025, hug=(0, 1, 2))),
    'ar5': dict(c=(0.0, -0.095, 0.145), n=(-0.92, -0.3, 0.2), fa=(-0.15, 0.1, 0.98), fore=MAG_FORE, upper=MAG_UP, thumb=dict(out=(1, -0.3, 0), y=-0.105, z=0.133, dir=(0, -0.2, 1), top=-0.035, hug=(0, 1, 2))),
    'l40': dict(c=(0.0, 0.0, 0.15), n=(-0.92, -0.3, 0.2), fa=(-0.15, 0.1, 0.98), fore=MAG_FORE, upper=MAG_UP, thumb=dict(out=(1, -0.3, 0), y=-0.010, z=0.138, dir=(0, -0.2, 1), top=0.060, hug=(0, 1, 2))),
    'v11': dict(c=(0.0, -0.12, 0.0), n=(-0.92, -0.3, 0.2), fa=(-0.15, 0.1, 0.98), fore=MAG_FORE, upper=MAG_UP, thumb=dict(out=(1, -0.3, 0), y=-0.130, z=-0.012, dir=(0, -0.2, 1), top=-0.060, hug=(0, 1, 2))),
    # 手槍的彈匣藏在握把裡，只有底板露出來：手掌朝上從底部把彈匣拍進去
    'p9': dict(c=(0.0, -0.09, -0.03), n=(-0.12, 0.97, 0.1), fa=(-0.2, 0.1, 0.97), fore=MAG_FORE, upper=MAG_UP, palm=0.02),
    'r50': dict(c=(0.0, -0.064, -0.01), n=(-0.12, 0.97, 0.1), fa=(-0.2, 0.1, 0.97), fore=MAG_FORE, upper=MAG_UP, palm=0.02),
}

WEAPON_POSE = {
    # kind: rifle（右手握把、左手托）、pistol（右手握把，左手執行時隱藏）、one（單手）、both（雙手托）
    # r／l：手掌的起始位置與方向（槍座標），實際貼合由 fit_hand 量真實槍面決定
    #   grip：seat_grip 的設定。ys 量握把後緣的高度（rake 由這條線算，手掌貼它），z0 射線起點，mcp 食指根部相對扳機的高度
    #   yaw：掌心窩朝槍口轉的起始角，掌面才會斜貼握把的右後方，握把後緣落在大小魚際之間
    #   trigger：食指指尖中心，等於扳機面往前一個指尖半徑，要在 trigger_window 量得到的護弓窗口內。沒有 trigger 的武器食指和其他手指一起收
    #   fore／upper：直接指定前臂與上臂方向（槍座標），不指定就用 shoulder + pole
    #   thumb：指尖最遠處的 y、z（x 由槍面量）、dir 末節方向、out 第二關節往哪鼓、top 不得超過的高度
    #   握把、扳機、護木的數字都從 guns_hd.glb／guns.glb 的真實網格量來的，改槍要重量
    # 刀柄沿槍座標 z，掌心得斜放（手軸與刀柄約 40°）：手從右下方伸過來托在刀柄左下，手指繞到鏡頭這一側
    'knife': dict(kind='one', r=dict(n=(0.95, -0.05, -0.1), fa=(0.05, 0.92, 0.38), fore=(-0.1, 0.6, 0.8), c=(-0.03, -0.012, -0.012), seat=(('palm', (0.95, -0.05, -0.1)),), thumb=dict(out=(-1, -0.4, -0.3), y=-0.016, z=0.03, dir=(0.3, 0.1, 1), side=0.25))),
    'p9': dict(kind='pistol', r=dict(rake=-6, yaw=24, fore=(-0.1, 0.27, 0.95), upper=(0.25, 0.0, 0.97), c=(0.0, -0.03, -0.008), grip=dict(ys=(0.02, -0.005), ys45=(-0.025, -0.045), mcp=-.014, span=.072, back=1.4), trigger=(0.003, 0.007, 0.06), spread=dict(middle=-4, ring=-6, pinky=-9), thumb=dict(out=(0.7, 0.0, -0.7), y=0.017, z=0.022, dir=(0, -0.3, 0.95)))),
    'r50': dict(kind='pistol', r=dict(rake=-6, yaw=24, fore=(-0.1, 0.27, 0.95), upper=(0.25, 0.0, 0.97), c=(0.0, -0.01, -0.008), grip=dict(ys=(0.026, 0.01), ys45=(-0.005, -0.02), mcp=-.024, span=.076, back=.8, ceil=.044), trigger=(0.003, 0.035, 0.067), spread=dict(middle=-4, ring=-6, pinky=-9), thumb=dict(out=(0.7, 0.0, -0.7), y=0.032, z=0.012, dir=(0, -0.3, 0.95)))),
    'v11': dict(kind='pistol', r=dict(rake=-14, yaw=24, fore=(-0.1, 0.27, 0.95), upper=(0.25, 0.0, 0.97), c=(0.0, 0.003, -0.012), grip=dict(ys=(0.04, 0.02), ys45=(0.0, -0.02), z0=-0.08, mcp=-.018, span=.076, ceil=.046, back=.9), trigger=(0.003, 0.043, 0.041), spread=dict(middle=-4, ring=-6, pinky=-9), thumb=dict(out=(0.7, 0.0, -0.7), y=0.04, z=0.0, dir=(0, -0.3, 0.95)))),
    's8': dict(kind='rifle', shoulder_l=(0.2, -0.2, 0.08), r=dict(rake=14, yaw=14, fore=(0.1, -0.14, 0.98), upper=(0.3, 0.0, 0.95), c=(-0.02, -0.018, 0.02), grip=dict(top=(0.0,), side=((-0.012, -0.01), (-0.03, -0.01)), reach=-0.056, span=.074, back=.3, mcp=.006), trigger=(0.003, -0.031, 0.091), spread=dict(middle=-4, ring=-6, pinky=-9), thumb=dict(out=(0.7, 0.3, -0.5), y=-0.012, z=0.03, dir=(0, -0.8, 0.6))),
               l=dict(guard=dict(y=-0.025, xl=0.018, xr=-0.018, z=0.44, ty=0.022, tx=0.01, wrist=22), yaw=30, roll=24, fore=(-0.25, 0.3, 0.92), upper=(-0.4, -0.3, 0.87), thumb=dict(out=(1, -0.3, 0), y=0.012, z=0.51, dir=(0, 0.05, 1), top=0.03, hug=(0, 1, 2)))),
    'ks': dict(kind='rifle', r=dict(rake=-8, yaw=24, fore=(-0.1, 0.27, 0.95), upper=(0.25, 0.0, 0.97), c=(0.0, -0.03, -0.012), grip=dict(ys=(0.02, -0.005), ys45=(-0.03, -0.044), reach=-0.054, mcp=-.016, span=.074), trigger=(0.0, 0.009, 0.066), spread=dict(middle=-4, ring=-6, pinky=-9), thumb=dict(out=(0.7, 0.0, -0.7), y=0.012, z=0.022, dir=(0, -0.3, 0.95))),
               l=dict(guard=dict(y=0.034, xl=0.025, xr=-0.025, z=0.3, ty=0.03, tx=0.01, wrist=22), pitch=8, yaw=30, roll=24, fore=(-0.25, 0.3, 0.92), upper=(-0.4, -0.3, 0.87), thumb=dict(out=(1, -0.3, 0), y=0.072, z=0.35, dir=(0, 0.05, 1), top=0.09, hug=(0, 1, 2)))),
    'ar5': dict(kind='rifle', r=dict(rake=-8, yaw=24, fore=(-0.1, 0.27, 0.95), upper=(0.25, 0.0, 0.97), c=(0.0, -0.03, -0.01), grip=dict(ys=(0.02, -0.005), ys45=(-0.03, -0.048), web=.015, span=.074, back=.8, ceil=.03, mcp=-.014), trigger=(-0.002, 0.008, 0.072), spread=dict(middle=-4, ring=-6, pinky=-9), thumb=dict(out=(0.7, 0.0, -0.7), y=0.012, z=0.022, dir=(0, -0.3, 0.95))),
                l=dict(guard=dict(y=0.038, xl=0.03, xr=-0.03, z=0.27, ty=0.03, tx=0.01, wrist=22), yaw=30, roll=24, fore=(-0.25, 0.3, 0.92), upper=(-0.4, -0.3, 0.87), thumb=dict(out=(1, -0.3, 0), y=0.078, z=0.335, dir=(0, 0.05, 1), top=0.098, hug=(0, 1, 2)))),
    'l40': dict(kind='rifle', shoulder_l=(0.2, -0.2, -0.04), r=dict(rake=-8, yaw=24, fore=(-0.1, 0.36, 0.93), upper=(0.25, 0.0, 0.97), c=(0.0, -0.04, -0.006), grip=dict(ys=(0.0, -0.015), ys45=(-0.03, -0.05), mcp=-.01, span=.068, reach=-.05, back=1.6), trigger=(-0.002, 0.002, 0.073), spread=dict(middle=-4, ring=-6, pinky=-9), thumb=dict(out=(0.7, 0.0, -0.7), y=0.0, z=0.022, dir=(0, -0.3, 0.95))),
                l=dict(guard=dict(y=0.03, z=0.235, xl=.033, xr=-.033, ty=0.03, tx=0.01, wrist=22), pitch=8, yaw=30, roll=24, fore=(-0.25, 0.3, 0.92), upper=(-0.4, -0.3, 0.87), thumb=dict(out=(1, -0.3, 0), y=.08, z=.3, dir=(0, 0.05, 1), top=0.12, hug=(0, 1, 2)))),
    'frag': dict(kind='one', r=dict(rake=0, yaw=14, fore=(-0.1, 0.3, 0.95), c=(0.0, 0.008, -0.006), seat=(('palm', (1, 0, 0)), ('web', (0, 0, 1))), thumb=dict(out=(0.7, 0.0, -0.7), y=0.012, z=0.012, dir=(0, -0.2, 1)))),
    'smoke': dict(kind='one', r=dict(rake=0, yaw=14, fore=(-0.1, 0.3, 0.95), c=(0.0, -0.012, -0.006), seat=(('palm', (1, 0, 0)), ('web', (0, 0, 1))), thumb=dict(out=(0.7, 0.0, -0.7), y=0.03, z=0.012, dir=(0, -0.2, 1)))),
    'flash': dict(kind='one', r=dict(rake=0, yaw=14, fore=(-0.1, 0.3, 0.95), c=(0.0, -0.012, -0.006), seat=(('palm', (1, 0, 0)), ('web', (0, 0, 1))), thumb=dict(out=(0.7, 0.0, -0.7), y=0.03, z=0.012, dir=(0, -0.2, 1)))),
    # 炸藥包：兩手從下方托，拇指扣在外側
    'charge': dict(kind='both', r=dict(lift=(-0.0018, -0.0024, 0.0), n=(0.6, 0.8, 0.0), fa=(0.1, 0.1, 0.99), fore=(0.15, 0.45, 0.88), c=(-0.062, -0.04, -0.07), seat=(('palm', (0.6, 0.8, 0)),), thumb=dict(out=(-1, -0.3, 0), y=0.012, z=-0.02, dir=(0, 0.2, 1), side=-0.25)),
                   l=dict(lift=(0.0018, -0.0024, 0.0), n=(-0.6, 0.8, 0.0), fa=(-0.1, 0.1, 0.99), fore=(-0.15, 0.45, 0.88), upper=(-0.3, -0.5, 0.8), c=(0.062, -0.04, -0.07), seat=(('palm', (-0.6, 0.8, 0)),), thumb=dict(out=(1, -0.3, 0), y=0.012, z=-0.02, dir=(0, 0.2, 1)))),
}
SHOULDER_R = {'rifle': (-0.12, -0.2, -0.49), 'pistol': (-0.11, -0.22, -0.46), 'one': (-0.13, -0.22, -0.48), 'both': (-0.13, -0.22, -0.46)}
SHOULDER_L = {'rifle': (0.2, -0.2, -0.17), 'pistol': (0.17, -0.22, -0.44), 'both': (0.22, -0.2, -0.42)}


CYCLE_POSE = {}   # 手動上膛：右手抓栓柄的姿勢，格式同 RELOAD_POSE，輸出 arms_<id>_RB，頂點順序與 arms_<id> 相同


def load_new_poses():
    """新槍的握持寫在 tools/guns/<id>.py 的 POSE／RELOAD，併進上面兩張表。回傳新槍 id。"""
    import importlib.util
    d = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'guns')
    ids = []
    for f in sorted(os.listdir(d)) if os.path.isdir(d) else []:
        gid, ext = os.path.splitext(f)
        if ext != '.py' or gid.startswith('_'):
            continue
        spec = importlib.util.spec_from_file_location('gun_' + gid, os.path.join(d, f))
        m = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(m)
        WEAPON_POSE[gid] = m.POSE
        if getattr(m, 'RELOAD', None):
            RELOAD_POSE[gid] = m.RELOAD
        if getattr(m, 'CYCLE_HAND', None):
            CYCLE_POSE[gid] = m.CYCLE_HAND
        ids.append(gid)
    return ids


NEW_GUN_IDS = load_new_poses()


def gun_to_bl(p):
    """槍座標（glTF +X 左 +Y 上 +Z 槍口）-> Blender：(x, -z, y)"""
    return Vector((p[0], -p[2], p[1]))


def arm_mesh(r):
    lo = body_lo('fp', r)
    zn = lo_zones(lo, r)
    J = r.J
    me = lo.data
    Pv = verts_np(me)
    keep = np.zeros(len(zn), dtype=bool)
    for i, z in enumerate(zn):
        keep[i] = z in ('hand', 'farm')
    for s, sg in (('_l', 1), ('_r', -1)):
        a, b = np.array(J['upperarm' + s]), np.array(J['lowerarm' + s])
        t = ((Pv - a) @ (b - a)) / ((b - a) @ (b - a))
        keep |= np.array([z == 'uarm' for z in zn]) & (t > 0.34) & (np.sign(Pv[:, 0]) == sg)
    bm = bmesh.new()
    bm.from_mesh(me)
    bm.verts.ensure_lookup_table()
    kill = [f for f in bm.faces if not all(keep[v.index] for v in f.verts)]
    bmesh.ops.delete(bm, geom=kill, context='FACES')
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    # 手要近看：先焊接再細分一次手部（UV 接縫不會裂開）
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=2e-4)
    # 袖口切口：沿上臂橫切成一圈平整的邊，不留鋸齒
    for s, sg in (('_l', 1), ('_r', -1)):
        a, b = Vector(J['upperarm' + s]), Vector(J['lowerarm' + s])
        side = [v for v in bm.verts if v.co.x * sg > 0]
        es = list({e for v in side for e in v.link_edges})
        fs = list({f for v in side for f in v.link_faces})
        bmesh.ops.bisect_plane(bm, geom=side + es + fs, plane_co=a.lerp(b, 0.42), plane_no=(b - a).normalized(), dist=1e-5, clear_inner=True)
    dl = bm.verts.layers.deform.active
    hbones = {i for i, g in enumerate(lo.vertex_groups) if g.name.startswith(('hand_', 'index', 'middle', 'pinky', 'ring', 'thumb'))}
    def is_hand(v):
        d = v[dl]
        return bool(d) and max(d.items(), key=lambda kv: kv[1])[0] in hbones
    edges = [e for e in bm.edges if all(is_hand(v) for v in e.verts)]
    bmesh.ops.subdivide_edges(bm, edges=edges, cuts=1, smooth=0.7, use_grid_fill=True, use_smooth_even=False)
    bmesh.ops.triangulate(bm, faces=[f for f in bm.faces if len(f.verts) > 4])
    bm.to_mesh(me)
    bm.free()
    leaf_to_parent(lo)
    return lo


def bake_arms():
    r = load_body()
    r.eyec = Vector(verts_np(r.eyes.data).mean(0))
    lo = arm_mesh(r)
    hi = make_hi_body('fp', lo, r)
    base_mat = r.body.data.materials[0]
    skin_img = skin_material(base_mat)
    hi.data.materials.clear()
    hi.data.materials.append(mat_hi_body('fp', skin_img))
    r.body.hide_render = r.eyes.hide_render = True
    weld_normals(lo.data)
    lo.data.materials.clear()
    bk = bpy.data.materials.new('arms')
    bk.use_nodes = True
    tn = bk.node_tree.nodes.new('ShaderNodeTexImage')
    tn.name = 'bakeT'
    lo.data.materials.append(bk)
    bpy.ops.object.select_all(action='DESELECT')
    lo.select_set(True)
    bpy.context.view_layer.objects.active = lo
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.select_all(action='SELECT')
    bpy.ops.uv.pack_islands(rotate=True, scale=True, merge_overlap=False, margin_method='ADD', margin=0.01, shape_method='CONCAVE')
    bpy.ops.object.mode_set(mode='OBJECT')
    cycles_setup()
    R = 1024
    for kind, nm, res, data, spp in (('DIFFUSE', 'a', R, False, 2), ('NORMAL', 'n', R, True, 4), ('ROUGHNESS', 'r', R // 2, True, 1), ('AO', 'o', R // 2, True, 32)):
        img = new_image(f'fp_{nm}', res, res, data)
        bake_one(kind, img, [(lo, hi)], spp, margin=8)
        img.filepath_raw = os.path.join(WORK, f'fp_{nm}.png')
        img.file_format = 'PNG'
        img.save()
    finish_maps('fp')
    for o in list(bpy.data.objects):
        if o is not lo:
            bpy.data.objects.remove(o, do_unlink=True)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(WORK, 'fp.blend'))
    print('arms bake ok', len(lo.data.polygons), flush=True)


def slim_hand(P, me, gnames, side):
    """第一人稱的手縮到真人比例：骨頭位置與蒙皮頂點一起改，只動 stage_arms 自己那份，第三人稱不受影響。
    手指沿中線收細，比例照蒙皮權重走，手腕和指根才不會有接縫"""
    H = np.array(P.B['hand' + side].translation)
    chains = {f: [f'{f}_0{i}{side}' for i in (1, 2, 3)] for f in ('index', 'middle', 'ring', 'pinky')}
    chains['thumb'] = [f'thumb_0{i}{side}' for i in (2, 3)]
    kid = [b for f in ('thumb', 'index', 'middle', 'ring', 'pinky') for b in [f'{f}_0{i}{side}' for i in (1, 2, 3)]]
    hset = set(kid) | {'hand' + side}
    Pv = verts_np(me)
    lines = {}
    which = {b: f for f, c in chains.items() for b in c}
    for f, c in chains.items():
        pts = [np.array(P.B[b].translation) for b in c]
        d = pts[-1] - pts[-2]
        d /= np.linalg.norm(d)
        idx = [i for i, v in enumerate(me.vertices) if v.groups and gnames[max(v.groups, key=lambda e: e.weight).group] == c[-1]]
        t = (Pv[idx] - pts[-1]) @ d
        lines[f] = np.array(pts + [pts[-1] + d * max(t.max() - 0.012, 0.004)])
    out = Pv.copy()
    for i, v in enumerate(me.vertices):
        tot, wh, wf = 0.0, 0.0, {}
        for g in v.groups:
            n, w = gnames[g.group], g.weight
            tot += w
            if n in hset:
                wh += w
            if n in which:
                wf[which[n]] = wf.get(which[n], 0.0) + w
        if tot <= 0:
            continue
        p = Pv[i]
        if wf:
            f = max(wf, key=wf.get)
            L = lines[f]
            best, q = 1e9, p
            for a, b in zip(L[:-1], L[1:]):
                t = min(1.0, max(0.0, (p - a) @ (b - a) / ((b - a) @ (b - a))))
                c = a + (b - a) * t
                e = (p - c) @ (p - c)
                if e < best:
                    best, q = e, c
            k = THUMB_K if f == 'thumb' else FINGER_K
            p = q + (p - q) * (1 - (1 - k) * min(1.0, wf[f] / tot))
        out[i] = H + (p - H) * (1 - (1 - HAND_K) * min(1.0, wh / tot))
    # 前臂到手腕收細：第一人稱袖子離鏡頭近，粗的前臂會蓋掉整隻手
    A, W = np.array(P.B['lowerarm' + side].translation), H
    u = W - A
    L = np.linalg.norm(u)
    u /= L
    arm = {'lowerarm' + side} | hset
    for i, v in enumerate(me.vertices):
        if not any(gnames[g.group] in arm and g.weight > 0.3 for g in v.groups):
            continue
        q = Pv[i] - A
        t = (q @ u) / L
        if 0.3 < t < 1.2:
            k = 1 - WRIST_TAPER * smoothstep(0.3, 0.95, t) * (1 - smoothstep(1.0, 1.2, t))
            q0 = out[i] - A
            a = u * (q0 @ u)
            out[i] = A + a + (q0 - a) * k
    set_verts(me, out)
    for b in kid:
        m = P.B[b]
        m.translation = Vector(H + (np.array(m.translation) - H) * HAND_K)
        P.B[b] = m
        P.Binv[b] = m.inverted()
    for b in kid:
        P.L[b] = P.Binv[P.parent[b]] @ P.B[b]
        P.Linv[b] = P.L[b].inverted()


def lbs(me, group_names, P, M):
    """numpy 線性蒙皮：回傳新頂點"""
    Pv = verts_np(me)
    S = {n: np.array(M[n] @ P.Binv[n]) for n in P.names}
    out = np.zeros_like(Pv)
    idx = {i: n for i, n in enumerate(group_names)}
    for i, v in enumerate(me.vertices):
        tot = 0
        acc = np.zeros(3)
        h = np.array([*v.co, 1.0])
        for g in v.groups:
            n = idx[g.group]
            if n not in S or g.weight <= 0:
                continue
            acc += (S[n] @ h)[:3] * g.weight
            tot += g.weight
        out[i] = acc / tot if tot > 0 else Pv[i]
    return out


# ---- 握持求解：手貼著真實槍面收，不靠固定角度


VOX = 0.0015             # 槍實體體素的邊長
GRIP_GAP = 0.0010        # 頂點離槍面這麼近就算接觸
CONTACT_CAP = 0.004      # soft_contact 只處理這麼淺的穿透，再深就是手放錯位置
HAND_K = 0.88            # 來源手長 22 cm、手指粗 30 mm，比例給第三人稱遠看用；第一人稱縮到真人大小，手指才進得了護弓
FINGER_K = 0.76          # 四指半徑再收細
THUMB_K = 0.84
WRIST_TAPER = 0.2
FLEX_LIM = {'index': (88, 100, 72), 'middle': (92, 104, 76), 'ring': (92, 104, 76), 'pinky': (92, 104, 76)}
FLEX_RATE = (1.0, 1.1, 0.75)


def solid_grid(V, T):
    """槍的實體體素：先把三角面點成表面格，再看每格往軸向打不打得到殼：左右都有，其餘四向至少三向，就算實體。
    組合件的殼是中空又有開口，面法線與奇偶都會騙人；護弓窗口、彈匣與握把之間、握把旁這些凹處左右總有一側是空的，不會被算進去"""
    A = np.array(V)
    lo = A.min(0) - 0.012
    dims = np.ceil((A.max(0) + 0.012 - lo) / VOX).astype(np.int64) + 1
    S = np.zeros(dims, dtype=bool)
    tri = A[np.array(T)]
    a, b, c = tri[:, 0], tri[:, 1], tri[:, 2]
    L = np.max([np.linalg.norm(a - b, axis=1), np.linalg.norm(b - c, axis=1), np.linalg.norm(c - a, axis=1)], axis=0)
    N = np.minimum(np.ceil(L / (VOX * 0.7)).astype(np.int64), 400)
    for n in np.unique(N):
        m = N == n
        i, j = np.meshgrid(np.arange(n + 1), np.arange(n + 1), indexing='ij')
        k = i + j <= n
        u, v = i[k] / max(n, 1), j[k] / max(n, 1)
        p = a[m][:, None] * (1 - u - v)[:, None] + b[m][:, None] * u[:, None] + c[m][:, None] * v[:, None]
        q = np.floor((p.reshape(-1, 3) - lo) / VOX).astype(np.int64)
        S[q[:, 0], q[:, 1], q[:, 2]] = True
    C = np.zeros(dims, dtype=np.int8)
    X = np.ones(dims, dtype=bool)
    reach = int(0.07 / VOX)
    for ax in range(3):
        for flip in (False, True):
            A_ = np.flip(S, ax) if flip else S
            if ax == 1:                  # Blender y 是槍管方向：機匣、護木的中空很長，不限距離
                H = np.logical_or.accumulate(A_, axis=ax)
            else:                        # 橫向與上下只算 7 cm 內：遠處的握把底座、彈匣不算把這裡包住
                c = np.cumsum(A_, axis=ax, dtype=np.int32)
                d = c.copy()
                sl = [slice(None)] * 3
                sl[ax] = slice(reach, None)
                sl2 = [slice(None)] * 3
                sl2[ax] = slice(None, -reach)
                d[tuple(sl)] = c[tuple(sl)] - c[tuple(sl2)]
                H = d > 0
            H = np.flip(H, ax) if flip else H
            if ax == 0:
                X &= H                   # 左右兩側一定要有殼：真正的中空只會往槍口、槍托或握把底開口
            else:
                C += H
    return lo, (X & (C >= 3)) | S


class GunBody:
    """一把武器的真實網格（Blender 座標，與 gun_to_bl 同框架）。查距離、掃掠、內外判斷都在這裡"""

    def __init__(self, V, T, grid=None):
        self.V, self.T = V, T
        self.bvh = bvhtree.BVHTree.FromPolygons(V, T, all_triangles=True)
        self.grid = grid or solid_grid(V, T)

    def plus(self, pos, tris):
        """槍＋另一隻手：後擺的手要把先擺好的手也當成障礙"""
        n = len(self.V)
        return GunBody(self.V + [tuple(p) for p in pos], self.T + [(a + n, b + n, c + n) for a, b, c in tris], self.grid)

    def enc(self, pts):
        """體素判定（向量化）：點被槍殼六向包圍。殼內中空也算實體，這是手不能進去的範圍"""
        lo, G = self.grid
        i = np.floor((np.asarray(pts) - lo) / VOX).astype(np.int64)
        ok = ((i >= 0) & (i < np.array(G.shape))).all(1)
        out = np.zeros(len(i), dtype=bool)
        out[ok] = G[i[ok, 0], i[ok, 1], i[ok, 2]]
        return out

    def depth(self, pts):
        """每點陷進實體多深（m，外面是 0）：到最近殼壁的距離，貼面 2 mm 內用面法線定正負，避開體素的鋸齒"""
        out = np.zeros(len(pts))
        f = self.bvh.find_nearest
        for k in np.nonzero(self.enc(pts))[0]:
            v = Vector(pts[k])
            h = f(v, 0.06)
            if h[0] is None:
                out[k] = 0.06
            elif h[3] > 0.002 or (v - h[0]).dot(h[1]) < 0:
                out[k] = h[3]
        return out

    def nearest(self, p, lim=0.3):
        return self.bvh.find_nearest(p, lim)

    def dist(self, pts):
        f = self.bvh.find_nearest
        out = np.full(len(pts), 9.0)
        for i, p in enumerate(pts):
            h = f(Vector(p), 0.3)
            if h[0] is not None:
                out[i] = h[3]
        return out

    def inside(self, p):
        """六方向第一個命中是背面的票數過半就算在實體裡（網格有開口、疊件時比法線可靠）"""
        p = Vector(p)
        n = 0
        for d in ((1, 0, 0), (-1, 0, 0), (0, 1, 0), (0, -1, 0), (0, 0, 1), (0, 0, -1)):
            d = Vector(d)
            h = self.bvh.ray_cast(p, d, 0.5)
            if h[0] is not None and h[1].dot(d) > 0:
                n += 1
        return n >= 4

    def solid(self, p):
        """單點版的 depth：在實體裡（含殼內中空）"""
        return bool(self.depth(np.array([tuple(p)]))[0] > 0)

    def sweep(self, pts, d, tmax):
        """pts 沿 d 平移多遠會碰到槍面（只算正面命中）"""
        d = Vector(d).normalized()
        best = None
        for p in pts:
            h = self.bvh.ray_cast(Vector(p), d, tmax)
            if h[0] is not None and h[1].dot(d) < 0 and (best is None or h[3] < best):
                best = h[3]
        return best

    def face(self, y, z, x0=0.25):
        """x0 那一側的槍面 x：從外往內打（槍座標 y、z）"""
        p = gun_to_bl((x0, y, z))
        d = Vector((-1 if x0 > 0 else 1, 0, 0))
        h = self.bvh.ray_cast(p, d, abs(x0) * 2)
        return h[0].x if h[0] is not None else None


def load_gun_bodies():
    """讀真正的槍模。先高模後標準，匯入的東西當場刪光，否則 use_selection=False 會把槍一起匯出"""
    out = {}
    only = arg('--only')
    files = [('guns_hd.glb', ('ks', 'ar5', 'l40', 'p9')), ('guns.glb', ('v11', 's8', 'r50', 'frag', 'smoke', 'flash', 'knife', 'charge'))]
    if only:   # 新槍一把一檔；只載這次要烘的
        files = [(f, i) for f, i in files if set(i) & set(only.split(','))]
        files += [(f'guns/{g}.glb', (g,)) for g in only.split(',') if g in NEW_GUN_IDS and os.path.exists(os.path.join(OUT_DIR, 'guns', g + '.glb'))]
    for fn, ids in files:
        before = {k: set(getattr(bpy.data, k)) for k in ('objects', 'meshes', 'materials', 'images', 'textures')}
        bpy.ops.import_scene.gltf(filepath=os.path.join(OUT_DIR, fn))
        dg = bpy.context.evaluated_depsgraph_get()
        for wid in ids:
            root = bpy.data.objects[wid]
            V, T = [], []
            mag = bpy.data.objects.get(wid + '_mag') if wid in NEW_GUN_IDS else None   # 新槍的彈匣是獨立節點，手要碰得到它
            for o in [root] + list(root.children_recursive) + ([mag] if mag else []):
                if o.type != 'MESH':
                    continue
                e = o.evaluated_get(dg)
                m = e.to_mesh()
                m.calc_loop_triangles()
                n = len(V)
                V += [tuple(o.matrix_world @ v.co) for v in m.vertices]
                T += [tuple(n + i for i in t.vertices) for t in m.loop_triangles]
                e.to_mesh_clear()
            out[wid] = GunBody(V, T)
        for k, old in before.items():
            col = getattr(bpy.data, k)
            for x in [x for x in col if x not in old]:
                col.remove(x)
    return out


class HandRig:
    """一隻手的線性蒙皮（與 lbs 同算法）＋各連桿的頂點分組，查接觸時不用整隻手臂重算"""

    def __init__(self, P, me, gnames, side):
        self.P, self.side = P, side
        hb = ['hand' + side] + [f'{f}_0{i}{side}' for f in ('thumb', 'index', 'middle', 'ring', 'pinky') for i in (1, 2, 3)]
        keep, dom = [], {b: [] for b in hb}
        for i, v in enumerate(me.vertices):
            if not v.groups:
                continue
            b = gnames[max(v.groups, key=lambda e: e.weight).group]
            if b in dom:
                dom[b].append(len(keep))
                keep.append(i)
        self.bones = sorted({gnames[g.group] for i in keep for g in me.vertices[i].groups if gnames[g.group] in P.B})
        bi = {n: k for k, n in enumerate(self.bones)}
        vi, bo, wt = [], [], []
        for k, i in enumerate(keep):
            for g in me.vertices[i].groups:
                n = gnames[g.group]
                if n in bi and g.weight > 0:
                    vi.append(k)
                    bo.append(bi[n])
                    wt.append(g.weight)
        self.vi, self.bo, self.wt = np.array(vi), np.array(bo), np.array(wt)
        self.tot = np.bincount(self.vi, self.wt, len(keep))[:, None]
        self.keep = np.array(keep)
        self.h = np.c_[verts_np(me)[keep], np.ones(len(keep))]
        self.dom = {b: np.array(ix, dtype=np.int64) for b, ix in dom.items()}
        self.parts = {}

    def part(self, name, idx):
        """快取一組頂點的蒙皮切片"""
        if name not in self.parts:
            m = np.full(len(self.h), -1, dtype=np.int64)
            m[idx] = np.arange(len(idx))
            s = m[self.vi] >= 0
            self.parts[name] = (m[self.vi][s], self.bo[s], self.wt[s], self.h[idx], self.tot[idx], len(idx))
        return self.parts[name]

    def skin(self, M, part=None):
        vi, bo, wt, h, tot, n = part if part else (self.vi, self.bo, self.wt, self.h, self.tot, len(self.h))
        S = np.stack([np.array(M[b] @ self.P.Binv[b]) if b in M else np.eye(4) for b in self.bones])
        v = np.einsum('nij,nj->ni', S[bo], h[vi])[:, :3] * wt[:, None]
        out = np.zeros((n, 3))
        np.add.at(out, vi, v)
        return out / tot

    def link(self, f, j, skip=0.0, stride=1):
        """手指第 j 節的頂點；skip 略過靠近關節的那段（根部本來就貼著手掌，不能算接觸）"""
        b = f'{f}_0{j + 1}{self.side}'
        idx = self.dom[b]
        if skip:
            a = np.array(self.P.B[b].translation)
            d = np.array(self.P.B[b].col[1][:3])
            t = (self.h[idx, :3] - a) @ d
            idx = idx[t > skip * max(t.max(), 1e-6)]
        return idx[::stride]

    def tip(self, f):
        """指尖：末節靠前四成"""
        return self.link(f, 2, skip=0.55)

    def flexed_palm(self, HA):
        """座掌用的手掌形狀：手指先彎到握東西的角度，指根皮膚被拉過去之後的樣子。回傳 (頂點索引, rest 座標)"""
        P, s = self.P, self.side
        fr = {n: (Vector((0, 0, 0)), Quaternion()) for n in P.names}
        M = P.fk(fr)
        axis = flex_axes(P, s)[0]
        for f, a in (('index', (45, 20, 10)), ('middle', (48, 52, 36)), ('ring', (48, 52, 36)), ('pinky', (46, 50, 34))):
            for j in range(3):
                set_rot(P, fr, f'{f}_0{j + 1}{s}', axis, a[j])
            rebone(P, fr, M, f'{f}_01{s}')
        hv = np.concatenate([self.solid_palm()] + [self.dom[f'{f}_01{s}'] for f in ('index', 'middle', 'ring', 'pinky')])
        return hv, self.skin(M, self.part('flexpalm', hv))

    def solid_palm(self):
        """座掌時當成剛體的頂點：手掌＋拇指根靠近掌根的那半段（大魚際）。末端會跟拇指走，不算"""
        b = 'thumb_01' + self.side
        idx = self.dom[b]
        q = self.h[idx, :3] - np.array(self.P.B[b].translation)
        d = np.array(self.P.B[b].col[1][:3])
        return np.concatenate([self.dom['hand' + self.side], idx[q @ d < 0.02]])

    def patch(self, HA, kind):
        """貼槍用的手掌分區（rest 手部座標）。palm 掌心；web 虎口。不含大魚際與拇指，拇指動了也不影響"""
        side = self.side
        fa, lat, n = HA.ax[side]
        idx = self.dom['hand' + side]
        q = (self.h[idx, :3] - np.array(self.P.B['hand' + side].translation)) / HAND_K
        u, v, w = q @ np.array(fa), q @ np.array(lat), q @ np.array(n)
        if kind == 'palm':
            m = (w > 0.0) & (u > 0.055) & (u < 0.13) & (v > -0.02) & (v < 0.05)
        else:
            m = (w > 0.0) & (u > 0.05) & (u < 0.115) & (v < -0.012)
        return idx[m]


def rebone(P, fr, M, b):
    """改了 fr[b] 之後更新 b 與子孫"""
    loc, q = fr[b]
    M[b] = M[P.parent[b]] @ P.L[b] @ (Matrix.Translation(loc) @ q.to_matrix().to_4x4())
    P.refresh(fr, M, b)


def hand_mat(HA, side, fa_g, n_g, c_h, c_g):
    """手骨的目標矩陣：手的 fa／n 對到槍座標的 fa_g／n_g，手上的點 c_h 對到槍座標 c_g"""
    P = HA.P
    fa, lat, n = HA.ax[side]
    n_g = Vector(n_g).normalized()
    fa_g = Vector(fa_g)
    fa_g = (fa_g - n_g * fa_g.dot(n_g)).normalized()
    lat_g = n_g.cross(fa_g) if side == '_r' else fa_g.cross(n_g)
    Rt = Matrix((gun_to_bl(fa_g), gun_to_bl(lat_g), gun_to_bl(n_g))).transposed() @ Matrix((fa, lat, n)).transposed().inverted()
    B = P.B['hand' + side]
    W = (Rt @ B.to_3x3()).to_4x4()
    W.translation = gun_to_bl(c_g) + Rt @ (B.translation - c_h)
    return W


def hand_axes_r(rake, yaw):
    """右手握把方向（槍座標）：rake 跟握把後傾，yaw 繞握把軸把掌心轉向前，虎口才會包到握把正後方"""
    t, w = math.radians(rake), math.radians(yaw)
    s, c = math.sin(t), math.cos(t)
    fa0, n0 = Vector((0, -s, c)), Vector((1, 0, 0))
    return fa0 * math.cos(w) - n0 * math.sin(w), n0 * math.cos(w) + fa0 * math.sin(w)


def flex_axes(P, side):
    """手部 rest 的手指彎曲軸、拇指方向、掌心方向"""
    H = P.B['hand' + side].translation
    fa = (P.B['middle_01' + side].translation - H).normalized()
    lat = P.B['pinky_01' + side].translation - P.B['index_01' + side].translation
    lat = (lat - fa * lat.dot(fa)).normalized()
    n = fa.cross(lat) * (1 if side == '_r' else -1)
    ta = (P.B['thumb_02' + side].translation - P.B['thumb_01' + side].translation).normalized()
    return fa.cross(n).normalized(), ta, n


def set_rot(P, fr, b, axis, deg):
    fr[b] = (fr[b][0], Quaternion(P.Binv[b].to_3x3() @ axis, math.radians(deg)))


def close_finger(rig, body, fr, M, f, axis, spread=None, lim=None, step=1.0):
    """自動抓握：三個關節按比例一起收。哪一節（或它之後的節）碰到槍面，那個關節就鎖住，後面的繼續收到貼上。
    回傳實際角度。到上限還沒碰到不算錯，報告會顯示指尖距離"""
    P, side = rig.P, rig.side
    lim = lim or FLEX_LIM[f]
    bn = [f'{f}_0{j + 1}{side}' for j in range(3)]
    q_sp = spread or Quaternion()
    parts = []
    for j in range(3):
        idx = rig.link(f, j, skip=0.45 if j == 0 else 0.0, stride=1 if j else 2)
        parts.append(rig.part(f'{f}{j}', idx))

    def put(j, a):
        ax = P.Binv[bn[j]].to_3x3() @ axis
        q = Quaternion(ax, math.radians(a))
        fr[bn[j]] = (fr[bn[j]][0], (q_sp @ q) if j == 0 else q)
        rebone(P, fr, M, bn[j])

    def clear(j):
        return min(body.dist(rig.skin(M, parts[k])).min() for k in range(j, 3))

    ang = [0.0, 0.0, 0.0]
    for j in range(3):
        put(j, 0.0)
    locked = [False] * 3
    while not all(locked):
        for j in range(3):
            if locked[j]:
                continue
            a = ang[j] + step * FLEX_RATE[j]
            if a > lim[j]:
                locked[j] = True
                continue
            d0 = clear(j)
            put(j, a)
            d1 = clear(j)
            if d1 < GRIP_GAP and d1 < d0 - 1e-5:
                put(j, ang[j])
                locked[j] = True
            else:
                ang[j] = a
    return ang


def descend(cost, x, steps=(16, 8, 4, 2, 1), sweeps=5):
    """座標式圖樣搜尋：食指的 cost 有碰撞項，不可微，這個最省事"""
    c = cost(x)
    for st in steps:
        for _ in range(sweeps):
            moved = False
            for i in range(len(x)):
                for sg in (1, -1):
                    y = list(x)
                    y[i] += sg * st
                    cy = cost(y)
                    if cy < c - 1e-7:
                        x, c = y, cy
                        moved = True
                        break
            if not moved:
                break
    return x, c


def thumb_chain(C, P3, L1, L2, out):
    """兩段 IK：掌根 C 到 P3，第二關節往 out 那一側鼓。回傳第二關節位置"""
    u = P3 - C
    D = min(u.length, (L1 + L2) * 0.999)
    u = u.normalized()
    a = (L1 * L1 - L2 * L2 + D * D) / (2 * D)
    h = math.sqrt(max(0.0, L1 * L1 - a * a))
    v = out - u * out.dot(u)
    return C + u * a + v.normalized() * h


def solve_thumb(rig, body, fr, M, t):
    """拇指：先在槍面上定出指尖線，再用解析 IK 把三節骨頭擺上去（方向＋扭轉，都是多軸），最後末節貼到接觸為止。
    t: y／z 指尖目標（z 是最遠處）、dir 末節方向、out 第二關節往哪鼓、side 指尖在哪一側"""
    P, s = rig.P, rig.side
    ta = flex_axes(P, s)[1]
    b1, b2, b3 = [f'thumb_0{i}{s}' for i in (1, 2, 3)]
    h1, h2, h3 = [P.B[b].translation for b in (b1, b2, b3)]
    L1, L2 = (h2 - h1).length, (h3 - h2).length
    tip_p = rig.part('thtip', rig.tip('thumb'))
    L3 = (Vector(rig.h[rig.tip('thumb'), :3].mean(0)) - h3).dot(ta)
    side = t.get('side', 0.25)
    sg = 1.0 if side > 0 else -1.0
    dg = Vector(t['dir']).normalized()
    C = M[b1].translation.copy()
    Cg = Vector((C.x, C.z, -C.y))

    def on_face(p, r):
        fx = body.face(p.y, p.z, side)
        return None if fx is None else Vector((fx + sg * r, p.y, p.z))

    # 從最遠端沿指尖線往回找，第一個搆得到的點（掌根到末節根不超過兩段總長的九成多）：拇指微彎貼著，不繃直也不捲
    best = None
    for k in range(0, 60):
        T = Vector((0, t['y'], t['z'])) - dg * (0.002 * k)
        Tf = on_face(T, 0.0115)
        if Tf is None:
            continue
        P3f = on_face(T - dg * L3, 0.0135) or Vector((Tf.x + sg * 0.002, *(T - dg * L3).yz))   # 末節根已經繞出槍面（越過握把頂）
        best = (Tf, P3f)
        if (P3f - Cg).length <= 0.94 * (L1 + L2):
            break
    assert best, f'拇指目標打不到槍面 {t}'
    Tf, P3f = best
    P3w, Tw = gun_to_bl(P3f), gun_to_bl(Tf)
    P2w = thumb_chain(C, P3w, L1, L2, gun_to_bl(Vector(t['out']).normalized()))
    h = body.nearest(Tw)
    n = h[1].normalized() if h[0] is not None else Vector((sg, 0, 0))
    if n.dot(gun_to_bl(Vector((sg, 0, 0)))) < 0:
        n = -n

    def aim(b, d):
        # 最小旋轉：不加額外扭轉，蒙皮才不會在關節擠出皺褶
        cur = M[b].col[1].to_3d().normalized()
        P.set_world(fr, M, b, rot_about(M[b], M[b].translation, cur.rotation_difference(d.normalized())))

    aim(b1, P2w - C)
    aim(b2, P3w - M[b2].translation)
    aim(b3, Tw - M[b3].translation)
    # 末節貼面：繞「方向 × 法線」轉，先退開再收到接觸
    d3 = (Tw - M[b3].translation).normalized()
    hinge = n.cross(d3).normalized()
    m3 = M[b3].copy()

    def turn(a):
        q = Quaternion(hinge, math.radians(a))
        P.set_world(fr, M, b3, rot_about(m3, m3.translation, q))

    a = -22.0
    turn(a)
    d0 = body.dist(rig.skin(M, tip_p)).min()
    while a < 26:
        turn(a + 1.0)
        d1 = body.dist(rig.skin(M, tip_p)).min()
        if d1 < GRIP_GAP or d1 > d0 + 1e-5 and d0 < 0.004:
            break
        a += 1.0
        d0 = d1
    turn(a)
    refine_thumb(rig, body, fr, M, t, Tw)
    return Tf


def refine_thumb(rig, body, fr, M, t, Tw):
    """拇指精修：三節骨頭各兩軸（垂直骨頭）一起搜尋。實體穿透是硬條件，指尖向目標、各節往槍面貼，末節方向要對。
    t: hug 要貼面的節（0 起算）、top 不得超過的高度（槍座標 y）"""
    P, s = rig.P, rig.side
    bn = [f'thumb_0{i}{s}' for i in (1, 2, 3)]
    base = [fr[b] for b in bn]
    dom = [rig.dom[b] for b in bn]
    every = rig.part('thall', np.concatenate(dom + [rig.dom['hand' + s]])[::2])
    tip_p = rig.part('thtip', rig.tip('thumb'))
    links = [rig.part(f'thl{j}', dom[j][::3]) for j in range(3)]
    dg = gun_to_bl(Vector(t['dir']).normalized())
    hug = t.get('hug', (1, 2))
    top = t.get('top')
    ta = flex_axes(P, s)[1]

    def apply(x):
        for j in range(3):
            q = Quaternion((1, 0, 0), math.radians(x[j * 2])) @ Quaternion((0, 0, 1), math.radians(x[j * 2 + 1]))
            fr[bn[j]] = (base[j][0], base[j][1] @ q)
        rebone(P, fr, M, bn[0])

    def cost(x):
        apply(x)
        Q = rig.skin(M, every)
        dep = body.depth(Q)
        over = np.maximum(0.0, dep - 0.0004)
        e = float((over * over).sum() / (0.0008 * 0.0008))
        tip = Vector(rig.skin(M, tip_p).mean(0))
        e += ((tip - Tw).length / 0.005) ** 2
        for j in hug:
            d = float(body.dist(rig.skin(M, links[j])).min())
            e += (max(0.0, d - 0.0012) / 0.001) ** 2
        if top is not None:
            e += (max(0.0, float(Q[:, 2].max()) - top) / 0.0015) ** 2
        d3 = (M[bn[2]].to_3x3() @ P.Binv[bn[2]].to_3x3() @ ta).normalized()
        e += 8 * (1 - d3.dot(dg))
        return e + sum(v * v for v in x) / (30 * 30)
    x, e = descend(cost, [0.0] * 6, steps=(8, 4, 2, 1), sweeps=4)
    apply(x)
    return x, e


def trigger_window(body, T):
    """扳機前的護弓窗口（槍座標）：從目標點往四向打，量出扳機面、護弓前緣、下緣與機匣底。目標不在窗口裡就直接報錯"""
    tv = gun_to_bl((0.0, T.y, T.z))    # 扳機很薄，要沿中線量

    def hit(d):
        h = body.bvh.ray_cast(tv, gun_to_bl(d), 0.07)
        return None if h[0] is None else h[3]
    zb, zf, yd, yu = hit((0, 0, -1)), hit((0, 0, 1)), hit((0, -1, 0)), hit((0, 1, 0))
    assert not body.inside(tv), f'扳機目標 {tuple(T)} 在實體裡'
    assert None not in (zb, zf, yd, yu), f'扳機目標 {tuple(T)} 不在護弓裡 {zb} {zf} {yd} {yu}'
    assert zb < 0.018, f'扳機目標 {tuple(T)} 離扳機面 {zb:.3f}'
    return dict(blade=T.z - zb, front=T.z + zf, low=T.y - yd, up=T.y + yu)


def solve_index(rig, body, fr, M, axis, nax, T):
    """食指：指尖中心抵達 T（扳機前面、護弓窗口內）。四個自由度：側擺＋三節彎曲。
    碰撞用手指中線對槍面的有號距離（膠囊），護弓與扳機都很薄，法線正負判斷不可靠。
    只用單一起點會卡在護弓下緣外面，所以先掃一輪起點再局部收斂。回傳 (角度, 抵達誤差)"""
    P, s = rig.P, rig.side
    bn = [f'index_0{j + 1}{s}' for j in range(3)]
    tip_p = rig.part('ixtip', rig.tip('index'))
    skin_p = rig.part('ixskin', np.concatenate([rig.dom[bn[1]], rig.dom[bn[2]]])[::3])
    tv = gun_to_bl(T)
    hd = [np.array(P.B[b].translation) for b in bn]
    ax = [np.array(P.B[b].col[1][:3]) for b in bn]
    rad, tail = [], []
    for j, b in enumerate(bn):
        q = rig.h[rig.dom[b], :3] - hd[j]
        t = q @ ax[j]
        rad.append(float(np.sqrt(((q - np.outer(t, ax[j])) ** 2).sum(1)).mean()))
        tail.append(float(t.max()))
    L3 = tail[2] - rad[2]

    def apply(x):
        a0 = P.Binv[bn[0]].to_3x3()
        fr[bn[0]] = (fr[bn[0]][0], Quaternion(a0 @ nax, math.radians(x[0])) @ Quaternion(a0 @ axis, math.radians(x[1])))
        for j in (1, 2):
            fr[bn[j]] = (fr[bn[j]][0], Quaternion(P.Binv[bn[j]].to_3x3() @ axis, math.radians(x[j + 1])))
        rebone(P, fr, M, bn[0])

    def spine():
        a, b, c = [M[n].translation for n in bn]
        d = c + M[bn[2]].col[1].to_3d().normalized() * L3
        return [(a.lerp(b, t), rad[0]) for t in (0.3, 0.65, 1.0)] + [(b.lerp(c, t), rad[1]) for t in (0.5, 1.0)] + [(c.lerp(d, t), rad[2]) for t in (0.5, 1.0)]

    def cost(x):
        if not (-34 <= x[0] <= 34 and -6 <= x[1] <= 80 and 0 <= x[2] <= 95 and 0 <= x[3] <= 70):
            return 1e9
        apply(x)
        c = ((Vector(rig.skin(M, tip_p).mean(0)) - tv).length / 0.003) ** 2
        for p, r in spine():
            h = body.nearest(p, 0.03)
            if h[0] is None:
                continue
            sd = -h[3] if body.enc(np.array([tuple(p)]))[0] else h[3]
            e = r - 0.001 - sd
            if e > 0:
                c += (e / 0.0012) ** 2
        c += (float(body.depth(rig.skin(M, skin_p)).max()) / 0.0012) ** 2
        d = M[bn[2]].col[1].to_3d().normalized()      # 末節橫過扳機：朝槍的左邊
        c += 6 * (1 - d.dot(gun_to_bl((1, 0, 0)))) ** 2
        return c + 0.1 * (x[1] ** 2 + x[2] ** 2 + x[3] ** 2) / 3600
    seeds = sorted(((cost(x), x) for x in ([a, b, c, d] for a in (-24, -12, 0, 12) for b in (10, 30, 50, 70) for c in (20, 45, 70) for d in (10, 30, 50))), key=lambda e: e[0])
    best = None
    for _, x0 in seeds[:6]:
        x, c = descend(cost, list(x0), steps=(8, 4, 2, 1), sweeps=6)
        if best is None or c < best[1]:
            best = (x, c)
    x = best[0]
    apply(x)
    return x, (Vector(rig.skin(M, tip_p).mean(0)) - tv).length


def to_gun(a):
    """Blender 座標陣列 -> 槍座標"""
    a = np.asarray(a)
    return np.c_[a[:, 0], a[:, 2], -a[:, 1]]


def grip_rays(body, g):
    """握把貼合的量測線（槍座標）：從握把表面往外打，打到手皮膚的距離就是空隙。
    一般握把：x=0 上從後方往槍口找到後緣，再由後緣往後打。ys 是量的高度，z0 是起點（要在槍托前面）。
    s8 這種沒有握把的槍托腕部：top 從腕部上緣往上打，side 從右面往右打"""
    rays = []
    for y in g.get('ys', ()):
        h = body.bvh.ray_cast(gun_to_bl((0.0, y, g.get('z0', -0.125))), gun_to_bl((0, 0, 1)), 0.25)
        if h[0] is None:
            raise AssertionError(f'握把高度 {y} 量不到後緣')
        rays.append(((0.0, y, -h[0].y), (0.0, 0.0, -1.0)))
    for y in g.get('ys45', ()):
        # 握把下半段：手掌跟斜貼在右後方，從右後往握把打到表面，再由表面往右後量
        b = body.bvh.ray_cast(gun_to_bl((0.0, y, g.get('z0', -0.125))), gun_to_bl((0, 0, 1)), 0.25)
        zc = -b[0].y + g.get('zc', 0.02)
        d = Vector((0.7071, 0.0, 0.7071))
        h = body.bvh.ray_cast(gun_to_bl(Vector((0.0, y, zc)) - d * 0.2), gun_to_bl(d), 0.25)
        q = h[0]
        rays.append(((q.x, q.z, -q.y), tuple(-d)))
    for z in g.get('top', ()):
        h = body.bvh.ray_cast(gun_to_bl((0.0, 0.07, z)), gun_to_bl((0, -1, 0)), 0.2)
        rays.append(((0.0, h[0].z, z), (0.0, 1.0, 0.0)))
    for y, z in g.get('side', ()):
        h = body.bvh.ray_cast(gun_to_bl((-0.1, y, z)), gun_to_bl((1, 0, 0)), 0.2)
        rays.append(((h[0].x, y, z), (-1.0, 0.0, 0.0)))
    return rays


def grip_rake(rays):
    """由後緣兩端的高差算握把後傾角（度）"""
    r = [o for o, d in rays if d[2] < 0 and d[0] == 0]
    if len(r) < 2:
        return None
    a, b = r[0], r[-1]
    return math.degrees(math.atan2(a[2] - b[2], a[1] - b[1]))


def ray_gap(G, o, d, wid=0.0065, miss=0.04):
    """點雲（槍座標）沿量測線的最近距離，搜尋時用；報告用真正的皮膚三角形"""
    v = G - np.array(o)
    t = v @ np.array(d)
    q = v - np.outer(t, d)
    m = ((q * q).sum(1) < wid * wid) & (t > -0.004)
    return miss if not m.any() else max(0.0, float(t[m].min()))


def seat_grip(HA, rig, body, cfg, c_h):
    """右手座掌：手掌是一塊剛體，只能退到握把外面貼住，不能埋進去。
    在 rake、yaw、握把中心五個自由度上搜尋：實體穿透是硬條件，掌心貼握把右後方，後緣空隙只是偏好。
    食指根部到扳機只給提示：食指有四個自由度，夠得到就好，不能為了它把手掌推進握把。回傳時印出各項，調參才有依據"""
    P = HA.P
    g = cfg['grip']
    rays = grip_rays(body, g)
    rake0 = cfg.get('rake', -4)
    yaw0 = cfg.get('yaw', 24)
    T = Vector(cfg['trigger'])
    hv, rest = rig.flexed_palm(HA)
    B3 = P.Binv['hand_r']
    mcp0 = P.B['index_01_r'].translation
    my = T.y + g.get('mcp', -0.003)
    mz = T.z + g.get('reach', -0.058)   # 食指根部到扳機的前後距離：三節總長約 75 mm，要留彎曲的餘裕
    mx = -g.get('side_x', 0.03)
    pm = np.isin(hv, rig.patch(HA, 'palm'))
    palm_only = np.isin(hv, rig.solid_palm())   # 虎口不能頂進機匣：ceil 是機匣底面的高度

    def pose(x):
        rake, yaw = x[0], x[1]
        c = Vector((x[2] * 5e-4, x[3] * 5e-4, x[4] * 5e-4))
        fa_g, n_g = hand_axes_r(rake, yaw)
        return fa_g, n_g, c, hand_mat(HA, '_r', fa_g, n_g, c_h, c)

    def terms(x):
        W = pose(x)[3]
        A = np.array(W @ B3)
        pts = rest @ A[:3, :3].T + A[:3, 3]
        G = to_gun(pts)
        dep = body.depth(pts)
        over = np.maximum(0.0, dep - 0.0012)
        pen = float((over * over).sum() / (0.0015 * 0.0015)) + (float(dep.max()) / 0.002) ** 4
        free = pts[pm & (dep == 0)][::3]
        near = float(body.dist(free).min()) if len(free) else 0.0
        back = g.get('back', 0.6) * sum((max(0.0, ray_gap(G, o, d) - 0.003) / 0.006) ** 2 for o, d in rays)
        m = W @ (B3 @ mcp0)
        mcp = ((m.z - my) ** 2 + (-m.y - mz) ** 2) / (0.006 * 0.006)
        mcp += (max(0.0, (Vector((m.x, m.z, -m.y)) - T).length - g.get('span', 0.066)) / 0.001) ** 2
        side = (max(0.0, m.x - mx) / 0.002) ** 2
        ceil = float((np.maximum(0.0, G[:, 1][palm_only] - g.get('ceil', 9.0)) ** 2).sum() / (0.001 * 0.001)) * 0.1
        return dict(pen=pen, near=(near / 0.003) ** 2, back=back, mcp=mcp, side=side, ceil=ceil, yaw=((x[1] - yaw0) / 10) ** 2, rake=((x[0] - rake0) / 6) ** 2, deep=float(dep.max()))

    def cost(x):
        if abs(x[0] - rake0) > 8 or abs(x[1] - yaw0) > 10:
            return 1e9
        t = terms(x)
        return sum(v for k, v in t.items() if k != 'deep')
    c0 = Vector(cfg['c'])
    best = None
    # 手掌離槍太遠時沒有梯度，多給幾個起點
    for dx, dz in ((-30, -30), (-40, 0), (-20, -50), (-50, -30)):
        x0 = [rake0, yaw0, c0.x / 5e-4 + dx, c0.y / 5e-4, c0.z / 5e-4 + dz]
        x, e = descend(cost, x0, steps=(12, 6, 3, 1.5), sweeps=8)
        if best is None or e < best[1]:
            best = (x, e)
    t = terms(best[0])
    print('  座掌', ' '.join(f'{k}={v:.2f}' for k, v in t.items()), 'x', [round(v, 1) for v in best[0]], flush=True)
    return pose(best[0])[:3], rays, grip_rake(rays) or 0.0


def support_axes(yaw, pitch, roll):
    """左手托護木的方向（槍座標）：yaw 手指由槍口往右偏，pitch 上仰，roll 掌心往右上轉"""
    y, p, r = (math.radians(v) for v in (yaw, pitch, roll))
    fa = Vector((-math.sin(y) * math.cos(p), math.sin(p), math.cos(y) * math.cos(p)))
    n0 = Vector((0, 1, 0))
    n0 = (n0 - fa * n0.dot(fa)).normalized()
    return fa, n0 * math.cos(r) + fa.cross(n0) * math.sin(r)


def seat_support(HA, rig, body, cfg):
    """左手托護木：手掌貼護木底面，拇指根（大魚際）頂住左下角，手指根在底面偏右，手指才繞得上右壁。
    guard: y 底面、xl／xr 左右面、z 掌心目標。手掌剛體不准埋進實體，手腕由 yaw、pitch 對 fore 的夾角限制"""
    P = HA.P
    g = cfg['guard']
    fa, lat, n = HA.ax['_l']
    H = P.B['hand_l'].translation
    B3 = P.Binv['hand_l']
    hv, rest = rig.flexed_palm(HA)
    pm = np.isin(hv, rig.patch(HA, 'palm'))
    th0 = P.B['thumb_01_l'].translation
    mid0 = P.B['middle_01_l'].translation
    ring0 = [P.B['ring_01_l'].translation, P.B['pinky_01_l'].translation]
    pc0 = H + (fa * 0.07 + n * 0.02) * HAND_K
    fore = Vector(cfg['fore']).normalized()
    y0, p0, r0 = cfg.get('yaw', 38), cfg.get('pitch', 8), cfg.get('roll', 12)
    xm = (g['xl'] + g['xr']) / 2

    def pose(x):
        fa_g, n_g = support_axes(x[0], x[1], x[2])
        c = Vector((x[3] * 5e-4, x[4] * 5e-4, x[5] * 5e-4))
        return fa_g, n_g, c, hand_mat(HA, '_l', fa_g, n_g, pc0, c)

    def terms(x):
        fa_g, n_g, c, W = pose(x)
        A = W @ B3
        M3 = np.array(A)
        pts = rest @ M3[:3, :3].T + M3[:3, 3]
        dep = body.depth(pts)
        over = np.maximum(0.0, dep - 0.0012)
        pen = float((over * over).sum() / (0.0015 * 0.0015)) + (float(dep.max()) / 0.002) ** 4
        free = pts[pm & (dep == 0)][::2]
        d = np.sort(body.dist(free)) if len(free) else np.array([0.04])
        under = (float(d[len(d) // 2]) / 0.004) ** 2 + (float(d[0]) / 0.003) ** 2
        th = A @ th0
        thg = Vector((th.x, th.z, -th.y))
        mid = A @ mid0
        ang = math.degrees(fa_g.angle(fore))
        far = 0.0
        for q0 in ring0:
            h = body.nearest(A @ q0, 0.2)
            far += (max(0.0, h[3] - g.get('reach', 0.028)) / 0.005) ** 2
        return dict(pen=pen, under=under, thx=((thg.x - g['xl'] - g.get('tx', 0.012)) / 0.004) ** 2, thy=((thg.y - g['y'] - g.get('ty', 0.01)) / 0.005) ** 2,
                    mid=((mid.x - (xm + g.get('mx', -0.012))) / 0.008) ** 2, z=((c.z - g['z']) / 0.008) ** 2, far=far, wrist=(max(0.0, ang - g.get('wrist', 15)) / 3) ** 2,
                    reg=((x[0] - y0) / 10) ** 2 + ((x[1] - p0) / 20) ** 2 + ((x[2] - r0) / 25) ** 2, deep=float(dep.max()), ang=ang)

    def cost(x):
        if not (0 <= x[0] <= 80 and -20 <= x[1] <= 35 and -35 <= x[2] <= 60):
            return 1e9
        t = terms(x)
        return sum(v for k, v in t.items() if k not in ('deep', 'ang'))
    c0 = Vector((xm, g['y'] - 0.02, g['z']))
    best = None
    for dx, dy, dyaw in ((0, 0, 0), (30, -20, 0), (-20, -20, 0), (20, 10, 0), (0, 0, 14), (20, -10, -12)):
        x0 = [y0 + dyaw, p0, r0, c0.x / 5e-4 + dx, c0.y / 5e-4 + dy, c0.z / 5e-4]
        x, e = descend(cost, x0, steps=(12, 6, 3, 1.5), sweeps=8)
        if best is None or e < best[1]:
            best = (x, e)
    t = terms(best[0])
    print('  托掌', ' '.join(f'{k}={v:.2f}' for k, v in t.items()), 'x', [round(v, 1) for v in best[0]], flush=True)
    return pose(best[0])[:3], pc0


def seat(rig, body, M, pts_idx, name, d_g, back, reach=0.08):
    """把手沿槍座標方向 d_g 推到貼上槍面，回傳位移量（從退開 back 處算起）"""
    pts = rig.skin(M, rig.part(name, pts_idx))
    d = gun_to_bl(Vector(d_g).normalized())
    t = body.sweep(pts - np.array(d) * back, d, reach + back)
    return None if t is None else t - back


def soft_contact(me, pos, body, rigs):
    """手壓在槍上是軟組織被壓扁：只處理幾毫米內的淺穿透。算出每個穿透頂點退回槍面的位移，再把位移場往外擴散，
    整片皮膚一起退，不會把單一頂點拉成尖刺。比 CONTACT_CAP 深的不推，那是手的位置錯了，要讓報告擋下來。回傳推回前的最深量"""
    E = adjacency(me)
    keep = np.concatenate([r.keep for r in rigs])
    deep = 0.0
    for it in range(4):
        hit = np.zeros(len(pos), dtype=bool)
        D = np.zeros_like(pos)
        dep = body.depth(pos[keep])
        if it == 0:
            deep = float(dep.max())
        for i in keep[(dep > 0) & (dep <= CONTACT_CAP)]:
            p = Vector(pos[i])
            h = body.nearest(p, 0.03)
            if h[0] is not None:
                D[i] = h[0] + h[1] * 0.0006 - p
                hit[i] = True
        if not hit.any():
            break
        ring = hit.copy()
        for _ in range(4):
            g = ring.copy()
            g[E[:, 0]] |= ring[E[:, 1]]
            g[E[:, 1]] |= ring[E[:, 0]]
            ring = g
        pos += laplacian(D, E, ring & ~hit, 6, 0.6)
    return deep


def conform_palm(me, pos, body, rig, HA, reach=0.009):
    """手掌托東西時掌心會壓平貼上去（手掌只有一塊剛體，蒙皮做不到）：掌側皮膚離槍面幾毫米內的往槍面貼，位移場往外擴散，整片一起動。
    只動掌側，手背不動；太遠的不拉，那是手沒放好，留給報告"""
    s = rig.side
    fa, lat, n = HA.ax[s]
    H = np.array(rig.P.B['hand' + s].translation)
    idx = np.concatenate([rig.dom['hand' + s], rig.dom['thumb_01' + s]])
    w = (rig.h[idx, :3] - H) @ np.array(n)
    D = np.zeros_like(pos)
    hit = np.zeros(len(pos), dtype=bool)
    for k in idx[w > 0.006]:
        i = rig.keep[k]
        v = Vector(pos[i])
        h = body.nearest(v, reach)
        if h[0] is None or h[3] < 0.0012 or (v - h[0]).dot(h[1]) < 0:
            continue
        a = smoothstep(reach, reach * 0.5, h[3])
        if a > 0:
            D[i] = (h[0] - v).normalized() * (h[3] - 0.0008) * a
            hit[i] = True
    if hit.any():
        E = adjacency(me)
        ring = hit.copy()
        for _ in range(6):
            g = ring.copy()
            g[E[:, 0]] |= ring[E[:, 1]]
            g[E[:, 1]] |= ring[E[:, 0]]
            ring = g
        D = laplacian(D, E, ring & ~hit, 8, 0.6)
        pos += laplacian(D, E, hit, 2, 0.5)
    return int(hit.sum())


def arm_islands(me, pos):
    """依 keepRightArm 的規則（0.5 mm 格子焊接後找連通塊）數手臂塊數，兩手姿勢要有兩塊以上"""
    up = list(range(len(pos)))

    def root(i):
        while up[i] != i:
            up[i] = up[up[i]]
            i = up[i]
        return i

    seen = {}
    for i, k in enumerate(map(tuple, np.round(pos * 2000).astype(np.int64))):
        if k in seen:
            up[root(i)] = root(seen[k])
        else:
            seen[k] = i
    for a, b in adjacency(me):
        up[root(int(a))] = root(int(b))
    return len({root(i) for i in range(len(pos))})


def skin_bvh(pos, tris):
    return bvhtree.BVHTree.FromPolygons([tuple(p) for p in pos], [tuple(t) for t in tris], all_triangles=True)


def parity(bvh, p, d):
    """沿 d 數穿過幾層皮膚：奇數表示在網格內"""
    o, n = Vector(p), 0
    for _ in range(40):
        h = bvh.ray_cast(o, d, 1.0)
        if h[0] is None:
            break
        n += 1
        o = h[0] + d * 1e-5
    return n % 2 == 1


PARITY_DIRS = [Vector(v).normalized() for v in ((0.31, 0.53, 0.79), (-0.71, 0.2, 0.67), (0.4, -0.9, -0.17))]


def hand_overlap(bvh_a, pts_b):
    """b 的頂點跑進 a 網格：回傳 (點數, 最深 m)。手臂網格在袖口開著，要三向奇偶過半且最近面是背面才算"""
    n, deep = 0, 0.0
    for p in pts_b:
        v = Vector(p)
        h = bvh_a.find_nearest(v, 0.03)
        if h[0] is None or (v - h[0]).dot(h[1]) >= 0:
            continue
        if sum(parity(bvh_a, v, d) for d in PARITY_DIRS) >= 2:
            n += 1
            deep = max(deep, h[3])
    return n, deep


def ray_skin(bvh, o, d, reach=0.05):
    """量測線打到手皮膚的距離。起點先退回槍面裡 6 mm：皮膚壓在槍面上或略微陷入時才不會打過頭，這些情況都算 0"""
    p, dv = gun_to_bl(o), gun_to_bl(d)
    back = 0.006
    h = bvh.ray_cast(p - dv * back, dv, reach + back)
    if h[0] is None:
        return None
    return 0.0 if h[1].dot(dv) > 0 else max(0.0, h[3] - back)


def wrist_angle(P, M, s):
    """前臂軸與手軸的夾角：手腕折多少"""
    f = (M['hand' + s].translation - M['lowerarm' + s].translation).normalized()
    h = (M['middle_01' + s].translation - M['hand' + s].translation).normalized()
    h0 = (P.B['middle_01' + s].translation - P.B['hand' + s].translation).normalized()
    f0 = (P.B['hand' + s].translation - P.B['lowerarm' + s].translation).normalized()
    return math.degrees(f.angle(h)), math.degrees(f0.angle(h0))


GATE = dict(arrive=5.0, arrive_touch=7.5, blade=3.5, back=6.0, hands=1.0, wrist_r=26.0, wrist_l=22.0, side=26.0, deep0=4.0, skin_deep=2.5, skin_area=60.0, enc_area=120.0, enc_dist=2.5,
            under=8.0, thumb_seg=(2.5, 4.5, 2.5), muzzle=25.0, arm=1.5, fold=3, sliver=8)
BARY = np.array(((1 / 3, 1 / 3, 1 / 3), (0.6, 0.2, 0.2), (0.2, 0.6, 0.2), (0.2, 0.2, 0.6), (0.45, 0.45, 0.1), (0.45, 0.1, 0.45), (0.1, 0.45, 0.45)))


def skin_samples(pos, tris):
    """皮膚三角面取樣：每面七點。穿透要看面，不是看頂點，頂點都在外面的三角形可以整片橫過槍體"""
    t = pos[tris]
    area = np.linalg.norm(np.cross(t[:, 1] - t[:, 0], t[:, 2] - t[:, 0]), axis=1) / 2
    return np.einsum('kj,nji->nki', BARY, t).reshape(-1, 3), np.repeat(area / len(BARY), len(BARY))


def enclosed_grip(body, P, W):
    """握把區的四向包圍測試：±X、±Z 都打得到槍殼（5 cm 內）的皮膚，殼內中空也算。回傳面積 mm²、離最近殼壁的最大距離 mm、最深處槍座標"""
    G = to_gun(P)
    box = (np.abs(G[:, 0]) < 0.03) & (G[:, 2] > -0.09) & (G[:, 2] < 0.03) & (G[:, 1] > -0.08) & (G[:, 1] < 0.07)
    area, far, at = 0.0, 0.0, None
    rays = [gun_to_bl(d) for d in ((1, 0, 0), (-1, 0, 0), (0, 0, 1), (0, 0, -1))]
    for k in np.nonzero(box)[0]:
        v = Vector(P[k])
        m = 1.0
        for d in rays:
            h = body.bvh.ray_cast(v, d, 0.05)
            if h[0] is None:
                m = None
                break
            m = min(m, h[3])
        if m is not None:
            area += W[k]
            if m > far:
                far, at = m, G[k]
    return area * 1e6, far * 1000, at


def fold_edges(rest, pos, tris):
    """列出翻折的邊（頂點對）與被壓扁的三角形"""
    def nrm(p):
        t = p[tris]
        c = np.cross(t[:, 1] - t[:, 0], t[:, 2] - t[:, 0])
        a = np.linalg.norm(c, axis=1)
        return c / np.maximum(a, 1e-12)[:, None], a
    n0, a0 = nrm(rest)
    n1, a1 = nrm(pos)
    edges = {}
    for i, t in enumerate(tris.tolist()):
        for a, b in ((t[0], t[1]), (t[1], t[2]), (t[2], t[0])):
            edges.setdefault((min(a, b), max(a, b)), []).append(i)
    out = [e for e, fs in edges.items() if len(fs) == 2 and n1[fs[0]] @ n1[fs[1]] < -0.5 and n0[fs[0]] @ n0[fs[1]] > 0.3]
    return out, tris[a1 < 0.1 * a0]


def unfold(me, pos, tris, rest):
    """線性蒙皮在指根、虎口彎很大時會把皮膚擠出折痕：只抹平折痕附近幾圈"""
    E = adjacency(me)
    for _ in range(6):
        ed, sl = fold_edges(rest, pos, tris)
        if not ed and not len(sl):
            return
        hit = np.zeros(len(pos), dtype=bool)
        if ed:
            hit[np.array(ed).ravel()] = True
        if len(sl):
            hit[sl.ravel()] = True
        for _ in range(2):
            g = hit.copy()
            g[E[:, 0]] |= hit[E[:, 1]]
            g[E[:, 1]] |= hit[E[:, 0]]
            hit = g
        pos[:] = laplacian(pos, E, hit, 4, 0.6)


SKY = [Vector((a, b, c)).normalized() for a in (-1, 0, 1) for b in (-1, 0, 1) for c in (-1, 0, 1) if a or b or c]


def exposed(bvh, gbvh, p):
    """看得到外面嗎：往 26 個方向打，半數以上被手或槍擋住就算夾在指縫／掌紋裡。折痕夾在裡面時玩家看不到，只有露在外面的才算破面"""
    p = Vector(p)
    free = 0
    for d in SKY:
        o = p + d * 0.002
        if bvh.ray_cast(o, d, 0.04)[0] is None and gbvh.ray_cast(o, d, 0.04)[0] is None:
            free += 1
    return free >= 8


def skin_quality(rest, pos, tris, bvh, gbvh):
    """網格品質：相鄰三角形折角比 rest 大很多（翻折），或面積被壓到一成以下（壓扁）的數量。
    回傳 (翻折, 壓扁, 露在外面的翻折, 露在外面的壓扁, 第一個露在外面的位置)"""
    ed, sl = fold_edges(rest, pos, tris)
    ep = [(pos[a] + pos[b]) / 2 for a, b in ed if exposed(bvh, gbvh, (pos[a] + pos[b]) / 2)]
    sp = [pos[t].mean(axis=0) for t in sl if exposed(bvh, gbvh, pos[t].mean(axis=0))]
    return len(ed), len(sl), len(ep), len(sp), (ep + sp + [None])[0]


def under_gaps(body, bvh, zs, y0, xs=(0.0, -0.015, 0.015)):
    """護木底面到手掌的距離（mm）：從槍底沿 -y 打到皮膚。射線穿進槽孔（打到底面以上）的不算。回傳 {(x, z): gap}，打不到手的不列"""
    out, valid = {}, 0
    for x in xs:
        for z in zs:
            h = body.bvh.ray_cast(gun_to_bl((x, -0.2, z)), gun_to_bl((0, 1, 0)), 0.5)
            if h[0] is None or h[0].z > y0 + 0.006:
                continue
            valid += x == 0.0
            g = ray_skin(bvh, (x, h[0].z, z), (0.0, -1.0, 0.0), 0.06)
            if g is not None:
                out[(x, z)] = g * 1000
    return out, valid


def wrist_parts(P, M, s):
    """手腕分解成側偏（往小指側 +）與屈伸（往掌心 +），都已扣掉 rest 的角度"""
    def parts(f, fa, lat, n):
        return math.degrees(math.atan2(f.dot(lat), f.dot(fa))), math.degrees(math.atan2(f.dot(n), f.dot(fa)))
    fa, lat, n = hand_frame(P, P.B, s)
    f0 = (P.B['hand' + s].translation - P.B['lowerarm' + s].translation).normalized()
    a0 = parts(f0, fa, lat, n)
    fa, lat, n = hand_frame(P, M, s)
    f1 = (M['hand' + s].translation - M['lowerarm' + s].translation).normalized()
    a1 = parts(f1, fa, lat, n)
    return a1[0] - a0[0], a1[1] - a0[1]


def hand_frame(P, M, s):
    H = M['hand' + s].translation
    fa = (M['middle_01' + s].translation - H).normalized()
    lat = M['pinky_01' + s].translation - M['index_01' + s].translation
    lat = (lat - fa * lat.dot(fa)).normalized()
    return fa, lat, fa.cross(lat) * (1 if s == '_r' else -1)


def grip_report(wid, kind, rig_r, rig_l, body, M, Rres, Lres, pos_all, deep0, tri_r, tri_l, rest_pos, cfg):
    """逐指接觸與穿透，加上握對位置的量測。穿透看皮膚三角面（含殼內中空），不看頂點；另有手掌到護木底面、拇指根到槍面、
    手到槍口、手腕分解、手臂穿透與網格品質。距離單位 mm；不過門檻的項目標「失敗」並收進 fails，bake 結束時報錯"""
    A3 = aim_basis(0, 0).to_3x3().inverted()
    fails = []

    def gate(ok, what):
        if not ok:
            fails.append(f'{wid} {what}')
        return '' if ok else ' 失敗'
    out = [f'== {wid} ({kind})  接觸前最深 {deep0 * 1000:.1f} mm' + gate(deep0 * 1000 <= GATE['deep0'], f'接觸前最深 {deep0 * 1000:.1f}')]
    bvh_r = skin_bvh(pos_all, tri_r)
    bvh_l = skin_bvh(pos_all, tri_l) if Lres else None
    zm = float(max(v[1] * -1 for v in body.V[:]))
    for rig, res, nm, bvh, tri in ((rig_r, Rres, '右手', bvh_r, tri_r), (rig_l, Lres, '左手', bvh_l, tri_l)):
        if rig is None or res is None:
            continue
        s = rig.side
        pos = pos_all[rig.keep]
        line = []
        for f in ('thumb', 'index', 'middle', 'ring', 'pinky'):
            tip = body.dist(pos[rig.tip(f)]).min()
            link = body.dist(pos[rig.link(f, 2)]).min()
            line.append(f'{f} {tip * 1000:.1f}/{link * 1000:.1f}')
        out.append(f' {nm} 指尖/末節到槍面 mm: ' + ' '.join(line))
        out.append(f' {nm} 彎曲角: ' + ' '.join(f'{f}{tuple(round(v) for v in a)}' for f, a in res['curl'].items()) + f' 手掌中心 {tuple(res["c"])}' + (f' 食指側擺 {res.get("swing", 0):.0f}°' if 'swing' in res else '') + (f' yaw {res["yaw"]:.0f}° rake {res["rake"]:.0f}°（槍面 {res["rake0"]:.0f}°）' if 'yaw' in res else ''))
        a, a0 = wrist_angle(rig.P, M, s)
        sd, fl = wrist_parts(rig.P, M, s)
        lim = GATE['wrist_r'] if s == '_r' else GATE['wrist_l']
        strict = 'grip' in res or 'guard' in res
        out.append(f' {nm} 手腕折角 {a:.0f}°（rest {a0:.0f}°）側偏 {sd:+.0f}° 屈伸 {fl:+.0f}°' + (gate(a <= lim, f'{nm}手腕折角 {a:.0f}') + gate(abs(sd) <= GATE['side'], f'{nm}手腕側偏 {sd:.0f}') if strict else ''))
        if res.get('win'):
            w, T = res['win'], res['T']
            tips = to_gun(pos[rig.tip('index')])
            tc = tips.mean(0)
            err = np.linalg.norm(tc - np.array(T))
            blade = min(np.linalg.norm(tips - np.array((0.0, T.y, w['blade'])), axis=1).min(), np.abs(tips[:, 2] - w['blade']).min() if (np.abs(tips[:, 0]) < 0.01).any() else 1.0)
            m = (np.abs(tips[:, 0]) < 0.010) & (tips[:, 1] > w['low']) & (tips[:, 1] < w['up']) & (tips[:, 2] > w['blade'] - 0.002) & (tips[:, 2] < w['front'])
            jt = [A3 @ M[f'index_0{j}{s}'].translation for j in (1, 2, 3)]
            out.append(f' {nm} 食指關節 ' + ' '.join(f'({v.x:.3f},{v.y:.3f},{v.z:.3f})' for v in jt) + f' 手腕 ({(A3 @ M["hand" + s].translation).x:.3f},{(A3 @ M["hand" + s].translation).y:.3f},{(A3 @ M["hand" + s].translation).z:.3f})')
            out.append(f' {nm} 扳機: 目標({T.x:.3f},{T.y:.3f},{T.z:.3f}) 指尖中心({tc[0]:.3f},{tc[1]:.3f},{tc[2]:.3f}) 抵達誤差 {err * 1000:.1f}'
                       + gate(err * 1000 <= GATE['arrive'] or (err * 1000 <= GATE['arrive_touch'] and blade * 1000 <= 0.5), f'食指抵達誤差 {err * 1000:.1f}') + f'；求解 {res["reach"] * 1000:.1f}；指尖皮膚到扳機面 {blade * 1000:.1f}' + gate(blade * 1000 <= GATE['blade'], f'指尖到扳機 {blade * 1000:.1f}')
                       + f'；窗口 z({w["blade"]:.3f},{w["front"]:.3f}) y({w["low"]:.3f},{w["up"]:.3f}) 內指尖頂點 {int(m.sum())}/{len(tips)}' + gate(m.sum() > 0, '食指不在護弓窗口內'))
        if res.get('rays'):
            lab, ok = [], True
            for o, d in res['rays']:
                g = ray_skin(bvh, o, d)
                bad = (g is None or g * 1000 > GATE['back']) and o[1] <= res.get('web', 9.0)   # web：虎口高度，以上那條射線已在手外，只列數字
                ok &= not bad
                tag = f'斜y={o[1]:.3f}' if d[0] > 0 and d[2] else f'y={o[1]:.3f}' if d[2] else f'上緣z={o[2]:.3f}' if d[1] else f'右側(y={o[1]:.3f},z={o[2]:.3f})'
                lab.append(f'{tag}:' + ('打不到' if g is None else f'{g * 1000:.1f}'))
            gp = to_gun(pos[rig.dom['hand' + s]])
            mid = np.abs(gp[:, 0]) < 0.012
            heel = f'；中線上手掌下緣 y={gp[mid, 1].min():.3f}' if mid.any() else '；手掌不跨中線'
            out.append(f' {nm} 握把貼合（皮膚到{"後緣，由上到下" if res["rays"][0][1][2] else "腕部"} mm）: ' + ' '.join(lab) + heel + gate(ok, '握把貼合 ' + ' '.join(lab)))
        if res.get('guard'):
            gd = res['guard']
            pz = to_gun(pos[rig.patch_idx])[:, 2]
            zs = np.arange(pz.min() + 0.005, pz.max(), 0.01)
            g, valid = under_gaps(body, bvh, zs, gd['y'])
            mid = [v for (x, z), v in g.items() if x == 0.0]
            sidev = [v for (x, z), v in g.items() if x != 0.0]
            mx = max(mid) if mid else None
            cov = len(mid) / max(valid, 1)
            out.append(f' {nm} 手掌到護木底面: 掌區 z {pz.min():.3f}～{pz.max():.3f}，中線 ' + ' '.join(f'{z:.2f}:{v:.1f}' for (x, z), v in sorted(g.items(), key=lambda e: e[0][1]) if x == 0.0)
                       + f'；±15 mm 最多 {max(sidev) if sidev else -1:.1f}；涵蓋 {cov * 100:.0f}%' + gate(mx is not None and mx <= GATE['under'] and cov >= 0.5, f'手掌到護木底面 {mx}（涵蓋 {cov * 100:.0f}%）'))
            ht = to_gun(pos)[:, 2].max()
            tb = [body.dist(pos[rig.dom[f'thumb_0{i}{s}']]).min() * 1000 for i in (1, 2, 3)]
            out.append(f' {nm} 拇指各節到槍面 mm: ' + ' / '.join(f'{v:.1f}' for v in tb) + gate(all(v <= t_ for v, t_ in zip(tb, GATE['thumb_seg'])), '拇指貼合 ' + '/'.join(f'{v:.1f}' for v in tb))
                       + f'；手部最前緣 z={ht:.3f}，距槍口 {(zm - ht) * 1000:.0f} mm' + gate((zm - ht) * 1000 >= GATE['muzzle'], f'手距槍口 {(zm - ht) * 1000:.0f}'))
        b3 = 'thumb_03' + s
        d = (M[b3].to_3x3() @ rig.P.Binv[b3].to_3x3() @ flex_axes(rig.P, s)[1]).normalized()
        dg = A3 @ d
        tips = A3 @ Vector(pos[rig.tip('thumb')].mean(0))
        ang = math.degrees(math.acos(max(-1, min(1, dg.z))))
        gun_y = pos[np.concatenate([rig.dom[f'thumb_0{i}{s}'] for i in (1, 2, 3)]), 2].max()
        over = res.get('top') and gun_y > res['top']
        out.append(f' {nm} 拇指: 末節方向({dg.x:.2f},{dg.y:.2f},{dg.z:.2f}) 對槍管 {ang:.0f}° 指尖({tips.x:.3f},{tips.y:.3f},{tips.z:.3f}) 拇指最高 y={gun_y:.3f}' + (f' 限高 {res["top"]:.3f}' + gate(not over, '拇指超過限高') if res.get('top') else ''))
        ht = tri[np.isin(tri[:, 0], rig.keep) & np.isin(tri[:, 1], rig.keep) & np.isin(tri[:, 2], rig.keep)]
        Pt, Wt = skin_samples(pos_all, ht)
        dp = body.depth(Pt)
        area = float(Wt[dp > 0.001].sum() * 1e6)
        k = int(dp.argmax())
        at = to_gun(Pt[k:k + 1])[0]
        back = np.full(len(pos_all), -1, dtype=np.int64)
        names = list(rig.dom)
        for ib, b in enumerate(names):
            back[rig.keep[rig.dom[b]]] = ib
        who = np.repeat(back[ht[:, 0]], len(BARY))
        by = sorted(((float(Wt[(dp > 0.001) & (who == ib)].sum() * 1e6), float(dp[who == ib].max() * 1000) if (who == ib).any() else 0.0, names[ib]) for ib in range(len(names))), reverse=True)
        out.append(f' {nm} 皮膚三角面穿透: 最深 {dp[k] * 1000:.1f} mm 在 ({at[0]:.3f},{at[1]:.3f},{at[2]:.3f})，深於 1 mm 面積 {area:.0f} mm²（' + ' '.join(f'{b.rsplit("_", 1)[0]}:{a_:.0f}/{d_:.1f}' for a_, d_, b in by[:4] if a_ > 0) + '）'
                   + gate(dp[k] * 1000 <= GATE['skin_deep'], f'{nm}皮膚最深 {dp[k] * 1000:.1f}') + gate(area <= GATE['skin_area'], f'{nm}皮膚穿透面積 {area:.0f}'))
        if s == '_r':
            ea, ed, eat = enclosed_grip(body, Pt, Wt)
            out.append(f' {nm} 四向包圍（握把殼內）: 面積 {ea:.0f} mm²，離殼壁最遠 {ed:.1f} mm' + (f' 在 ({eat[0]:.3f},{eat[1]:.3f},{eat[2]:.3f})' if eat is not None else '')
                       + (gate(ea <= GATE['enc_area'], f'四向包圍面積 {ea:.0f}') + gate(ed <= GATE['enc_dist'], f'四向包圍深度 {ed:.1f}') if kind != 'one' or wid != 'knife' else '（刀柄有溝槽，只列數字）'))
        fold0, sliver0, fold, sliver, fat = skin_quality(rest_pos, pos_all, ht, bvh, body.bvh)
        out.append(f' {nm} 網格品質: 翻折邊 {fold0}（露在外面 {fold}），壓扁三角形 {sliver0}（露在外面 {sliver}）' + (f' 例 ({to_gun([fat])[0][0]:.3f},{to_gun([fat])[0][1]:.3f},{to_gun([fat])[0][2]:.3f})' if fat is not None else '')
                   + gate(fold <= GATE['fold'], f'{nm}外露翻折邊 {fold}') + gate(sliver <= GATE['sliver'], f'{nm}外露壓扁三角形 {sliver}'))
    keep = set(rig_r.keep.tolist()) | (set(rig_l.keep.tolist()) if Lres else set())
    others = np.array([i for i in range(len(pos_all)) if i not in keep and not (pos_all[i][0] > 0 and not Lres)])
    dep = body.depth(pos_all[others])
    k = int(dep.argmax())
    at = to_gun(pos_all[others[k:k + 1]])[0]
    out.append(f' 手臂穿透（手以外）: 槍內頂點 {int((dep > 0).sum())}，最深 {dep[k] * 1000:.1f} mm ({at[0]:.3f},{at[1]:.3f},{at[2]:.3f})' + gate(dep[k] * 1000 <= GATE['arm'], f'手臂穿透 {dep[k] * 1000:.1f}'))
    if Lres:
        pr, pl = pos_all[rig_r.keep], pos_all[rig_l.keep]
        n1, d1 = hand_overlap(bvh_l, pr)
        n2, d2 = hand_overlap(bvh_r, pl)
        gap = min(bvh_l.find_nearest(Vector(p))[3] for p in pr[::4])
        dd = max(d1, d2) * 1000
        out.append(f' 手對手: 右手頂點在左手內 {n1}（最深 {d1 * 1000:.1f} mm），左手頂點在右手內 {n2}（最深 {d2 * 1000:.1f} mm），兩手最近 {gap * 1000:.1f} mm' + gate(dd <= GATE['hands'], f'手對手穿透 {dd:.1f}'))
    return out, fails


def wid_tag(cfg):
    return 'r' if 'grip' in cfg else 'l'


def fit_hand(HA, rig, body, fr, M, side, cfg, pole):
    """整隻手貼上武器：座掌 -> 拇指 IK -> 再貼一次手掌 -> 四指自動抓握 -> 食指進護弓。cfg 見 WEAPON_POSE 的 r／l"""
    P = HA.P
    fa, lat, n = HA.ax[side]
    H = P.B['hand' + side].translation
    L1 = (P.B['lowerarm' + side].translation - P.B['upperarm' + side].translation).length
    L2 = (P.B['hand' + side].translation - P.B['lowerarm' + side].translation).length
    if side == '_r':
        c_h = H + (fa * 0.107 + n * 0.032 + lat * 0.012) * HAND_K   # 握把截面中心在手上的位置：虎口貼握把後緣、掌心貼右面
    else:
        c_h = H + fa * (HA.size * 0.72) + n * cfg.get('palm', 0.032) * HAND_K
    res = {'curl': {}}
    if 'trigger' in cfg:
        res['T'] = Vector(cfg['trigger'])
        res['win'] = trigger_window(body, res['T'])
    if 'grip' in cfg:
        (fa_g, n_g, c_g), rays, rake0 = seat_grip(HA, rig, body, cfg, c_h)
        res.update(rays=rays, rake0=rake0, web=cfg['grip'].get('web', 9.0))
    elif 'guard' in cfg:
        (fa_g, n_g, c_g), c_h = seat_support(HA, rig, body, cfg)
        res['guard'] = cfg['guard']
        rig.patch_idx = rig.patch(HA, 'palm')
    elif 'rake' in cfg:
        fa_g, n_g = hand_axes_r(cfg['rake'], cfg.get('yaw', 0))
        c_g = Vector(cfg['c'])
    else:
        fa_g, n_g = Vector(cfg['fa']), Vector(cfg['n'])
        c_g = Vector(cfg['c'])
    axis = flex_axes(P, side)[0]
    for f in ('index', 'middle', 'ring', 'pinky'):
        for j in range(3):
            set_rot(P, fr, f'{f}_0{j + 1}{side}', axis, 0.0)

    def place():
        W = hand_mat(HA, side, fa_g, n_g, c_h, c_g)
        if 'fore' in cfg:
            # 指定前臂方向：手腕不折，肩膀（畫面外）跟著手走
            E = W.translation - gun_to_bl(Vector(cfg['fore']).normalized()) * L2
            m = M['upperarm' + side].copy()
            m.translation = E - gun_to_bl(Vector(cfg.get('upper', (0.3, -0.8, 0.5))).normalized()) * L1
            P.set_world(fr, M, 'upperarm' + side, m)
            two_bone(P, fr, M, side, W, E)
        else:
            two_bone(P, fr, M, side, W, pole)

    t = cfg.get('thumb')
    patches = {'palm': rig.patch(HA, 'palm'), 'web': rig.patch(HA, 'web')}
    seats = cfg.get('seat', ()) if side == '_r' or 'guard' in cfg else cfg.get('seat', (('palm', n_g),))
    nax = flex_axes(P, side)[2]
    fingers = ('middle', 'ring', 'pinky') if 'trigger' in cfg else ('middle', 'ring', 'pinky', 'index')
    root = np.concatenate([rig.dom['hand' + side], rig.dom['thumb_01' + side]] + [rig.dom[f'{f}_01{side}'] for f in ('index', 'middle', 'ring', 'pinky')])[::2]
    root_p = rig.part('root', root)
    back_off = Vector(cfg.get('lift', (0, 0, 0)))
    for rnd in range(3):
        place()
        for it in range(3):
            moved = 0.0
            for pa, d in seats:
                d = Vector(d)
                s = seat(rig, body, M, patches[pa], f'{pa}{side}', d, 0.03)
                if s is None:
                    print('  手掌', pa, '沿', tuple(round(v, 2) for v in d), '碰不到槍面', tuple(round(v, 3) for v in c_g), it, flush=True)
                    continue
                s += 0.001
                c_g += d.normalized() * s
                moved = max(moved, abs(s))
                place()
            if moved < 0.0008:
                break
        if seats and back_off.length:
            c_g += back_off   # 貼面會把上一輪退的距離吃掉，貼完再退一次
            place()
        if t:
            res['thumb_tip'] = solve_thumb(rig, body, fr, M, t)
            res['top'] = t.get('top')
        sps = {}
        for f in fingers:
            d = cfg.get('spread', {}).get(f)
            sps[f] = Quaternion(P.Binv[f'{f}_01{side}'].to_3x3() @ nax, math.radians(d)) if d else Quaternion()
            res['curl'][f] = close_finger(rig, body, fr, M, f, axis, sps[f])
        # 手比握把長，小指常超出握把底：摸不到東西的手指跟著隔壁彎，別捲成拳頭
        for f, ref in (('ring', 'middle'), ('pinky', 'ring'), ('index', 'middle')):
            if f not in fingers:
                continue
            if min(body.dist(rig.skin(M, rig.part(f'{f}all', np.concatenate([rig.link(f, j) for j in range(3)])))) ) > 0.006:
                b = res['curl'][ref]
                res['curl'][f] = [b[j] + 6 for j in range(3)]
                for j in range(3):
                    bn = f'{f}_0{j + 1}{side}'
                    q = Quaternion(P.Binv[bn].to_3x3() @ axis, math.radians(res['curl'][f][j]))
                    fr[bn] = (fr[bn][0], (sps[f] @ q) if j == 0 else q)
                rebone(P, fr, M, f'{f}_01{side}')
        if 'trigger' in cfg:
            x, res['reach'] = solve_index(rig, body, fr, M, axis, nax, res['T'])
            res['curl']['index'] = x[1:]
            res['swing'] = x[0]
        # 手掌是剛體，但手指根的皮膚被手指拉著走，收完才知道有沒有陷進去：往外退，重來一輪
        Q = rig.skin(M, root_p)
        dep = body.depth(Q)
        if dep.max() < 0.0022 or rnd == 2:
            break
        d = Vector((0, 0, 0))
        for k in np.nonzero(dep > 0.0012)[0]:
            v = Vector(Q[k])
            h = body.nearest(v, 0.06)
            if h[0] is not None:
                d += (h[0] - v).normalized() * float(dep[k])
        dg = Vector((d.x, d.z, -d.y))
        if dg.length < 1e-9:
            break
        if seats:
            back_off += dg.normalized() * (float(dep.max()) - 0.001)
        else:
            c_g += dg.normalized() * (float(dep.max()) - 0.001)
        print('  退掌', wid_tag(cfg), rnd, f'{dep.max() * 1000:.1f} mm', tuple(round(v, 2) for v in dg.normalized()), flush=True)
    res['c'] = [round(v, 4) for v in c_g]
    if 'grip' in cfg:
        res['yaw'] = math.degrees(math.atan2(-fa_g.x, fa_g.z))
        res['rake'] = math.degrees(math.atan2(-fa_g.y, math.hypot(fa_g.x, fa_g.z)))
    return res


def stage_arms():
    r = load_body()
    with bpy.data.libraries.load(os.path.join(WORK, 'fp.blend')) as (src, dst):
        dst.objects = ['lo_body_fp']
    base = dst.objects[0]
    bpy.context.scene.collection.objects.link(base)
    P = Pose(r.arm)
    gnames = [g.name for g in base.vertex_groups]
    slim_hand(P, base.data, gnames, '_r')
    slim_hand(P, base.data, gnames, '_l')
    # 網格換成高模手套與袖子（arms_hd.py），骨架沿用：握持求解只看骨頭與頂點權重
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import arms_hd
    bpy.data.objects.remove(base, do_unlink=True)
    base = arms_hd.build(P, WORK)
    gnames = [g.name for g in base.vertex_groups]
    HA = Hands(P)
    mat = final_material('fph')
    XL_pistol = HA.support_left((-0.9, 0.3, 0.1), (0.0, -0.45, 0.9), 0.03).inverted()
    bodies = load_gun_bodies()
    rig_r, rig_l = HandRig(P, base.data, gnames, '_r'), HandRig(P, base.data, gnames, '_l')
    report, fails = [], []
    meta = {}
    obs = []
    base.data.calc_loop_triangles()
    tri = np.array([t.vertices for t in base.data.loop_triangles], dtype=np.int64)
    Pv0 = verts_np(base.data)
    tri_r = tri[Pv0[tri[:, 0], 0] <= 0]
    tri_l = tri[Pv0[tri[:, 0], 0] > 0]
    only = arg('--only')
    new_out = arg('--arms-out')   # 新槍的手臂單獨輸出，不碰 arms.glb：--only m7 --arms-out <path>
    for wid, cfg in WEAPON_POSE.items():
        if only and wid not in only.split(','):
            continue
        if not only and wid in NEW_GUN_IDS:
            continue
        kind = cfg['kind']
        body = bodies[wid]
        rest = {n: (Vector((0, 0, 0)), Quaternion()) for n in P.names}
        M = P.fk(rest)
        two = kind != 'one'
        grip = Vector((0, 0, 0))   # 槍的原點就是握把（build-guns.py 的 origin）
        A = aim_basis(0, 0).to_4x4()
        SR = gun_to_bl(cfg.get('shoulder_r', SHOULDER_R[kind])) + gun_to_bl(grip)
        m = M['upperarm_r'].copy()
        m.translation = SR
        P.set_world(rest, M, 'upperarm_r', m)
        Rres = fit_hand(HA, rig_r, body, rest, M, '_r', cfg['r'], SR + gun_to_bl((-0.3, -0.6, 0.0)))
        Lres = None
        left = None
        if two:
            SL = gun_to_bl(cfg.get('shoulder_l', SHOULDER_L[kind])) + gun_to_bl(grip)
            m = M['upperarm_l'].copy()
            m.translation = SL
            P.set_world(rest, M, 'upperarm_l', m)
            pole = SL + gun_to_bl((0.35, -0.6, 0.0))
            if 'l' in cfg:
                # 右手已定位，左手的手指要把右手也當障礙
                Lres = fit_hand(HA, rig_l, body.plus(lbs(base.data, gnames, P, M), tri_r.tolist()), rest, M, '_l', cfg['l'], pole)
                left = Vector(Lres['c'])
            else:
                # 手槍的左手在 viewmodel 的 keepRightArm 會被丟掉，放遠一點，兩隻手才不會焊成一塊
                left = Vector((0.13, -0.11, -0.05))
                two_bone(P, rest, M, '_l', Matrix.Translation(gun_to_bl(left)) @ A @ XL_pistol, pole)
                finger_pose(P, rest, '_l', SUPPORT_L, THUMB_SUP)
                P.refresh(rest, M, 'hand_l')
        pos = lbs(base.data, gnames, P, M)
        rigs = [rig_r] + ([rig_l] if Lres else [])
        for rig, c_ in ((rig_r, cfg['r']), (rig_l, cfg.get('l'))):
            if rig in rigs and ('grip' in c_ or 'guard' in c_):
                conform_palm(base.data, pos, body, rig, HA)
        deep0 = soft_contact(base.data, pos, body, rigs)
        for rig, tri_s in ((rig_r, tri_r), (rig_l, tri_l)):
            if rig in rigs:
                unfold(base.data, pos, tri_s[np.isin(tri_s[:, 0], rig.keep) & np.isin(tri_s[:, 1], rig.keep) & np.isin(tri_s[:, 2], rig.keep)], Pv0)
        rep, bad = grip_report(wid, kind, rig_r, rig_l, body, M, Rres, Lres, pos, deep0, tri_r, tri_l, Pv0, cfg)
        # 換彈：左手再解一次，抓在彈匣上。只留左手網格，頂點順序與持握姿勢相同，執行時在兩者之間內插
        pos_mag = None
        if wid in RELOAD_POSE:
            rest2 = {n: (v[0].copy(), v[1].copy()) for n, v in rest.items()}
            M2 = {n: m.copy() for n, m in M.items()}
            fit_hand(HA, rig_l, body.plus(lbs(base.data, gnames, P, M), tri_r.tolist()), rest2, M2, '_l', RELOAD_POSE[wid], SL + gun_to_bl((0.35, -0.6, 0.0)))
            pos_mag = lbs(base.data, gnames, P, M2)
            soft_contact(base.data, pos_mag, body, [rig_l])
            print(f'{wid} 換彈手 手腕 {M2["hand_l"].translation}', flush=True)
        pos_bolt = None
        if wid in CYCLE_POSE:
            rest3 = {n: (v[0].copy(), v[1].copy()) for n, v in rest.items()}
            M3 = {n: m.copy() for n, m in M.items()}
            fit_hand(HA, rig_r, body, rest3, M3, '_r', CYCLE_POSE[wid], SR + gun_to_bl((-0.3, -0.6, 0.0)))
            pos_bolt = lbs(base.data, gnames, P, M3)
            print(f'{wid} 上膛手 手腕 {M3["hand_r"].translation}', flush=True)
        fails += bad
        if arg('--dump'):
            np.savez(os.path.join(arg('--dump'), wid + '.npz'), pos=pos_mag if arg('--lr') and pos_mag is not None else pos, tri_r=tri_r, tri_l=tri_l)
        print('\n'.join(rep), flush=True)
        report += rep
        def part(xyz, name, drop):
            """drop: 'l' 刪左手、'r' 刪右手、None 兩手都留"""
            me = base.data.copy()
            set_verts(me, xyz)
            for a in list(me.attributes):
                if a.name.startswith(('Color', 'pal', 'gi')):
                    me.attributes.remove(a)
            if drop:
                bm = bmesh.new()
                bm.from_mesh(me)
                kill = [f for f in bm.faces if (base.data.vertices[f.verts[0].index].co.x > 0) == (drop == 'l')]
                bmesh.ops.delete(bm, geom=kill, context='FACES')
                bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
                bm.to_mesh(me)
                bm.free()
            weld_normals(me)
            me.materials.clear()
            me.materials.append(mat)
            ob = obj_of(me, name)
            ob.data.name = name
            obs.append(ob)
        part(pos, f'arms_{wid}', 'l' if (not two or not Lres or pos_mag is not None) else None)   # 單手武器：左手不匯出
        if pos_mag is not None:
            if Lres:
                part(pos, f'arms_{wid}_L', 'r')
            part(pos_mag, f'arms_{wid}_LR', 'r')
        if pos_bolt is not None:
            part(pos_bolt, f'arms_{wid}_RB', 'l')
        meta[wid] = {'right': list(grip), 'left': list(left) if two else None, 'kind': kind}
    report += ['', f'未過門檻 {len(fails)} 項（門檻 {GATE}）'] + [' ' + f for f in fails]
    rp = arg('--report', os.path.join(DIST, 'grip-report.txt' if not new_out else f'grip-{only}.txt'))
    with open(rp, 'w', encoding='utf-8') as f:
        f.write('\n'.join(report) + '\n')
    print('grip report', rp, flush=True)
    print('\n'.join(report[-len(fails) - 1:]), flush=True)
    if only and not new_out:
        return
    bpy.data.objects.remove(base, do_unlink=True)
    bpy.data.objects.remove(r.body, do_unlink=True)
    bpy.data.objects.remove(r.eyes, do_unlink=True)
    bpy.data.objects.remove(r.arm, do_unlink=True)
    raw = os.path.join(WORK, f'arms_raw_{only}.glb' if new_out else 'arms_raw.glb')
    export_glb(raw)
    g = Glb(raw)
    post_common(g)
    if new_out:
        # 手套貼圖在 arms.glb，新槍只帶幾何，載入時換成同一個材質
        j = g.j
        j['materials'] = [{'name': 'soldier_fph'}]
        for k in ('textures', 'images', 'samplers', 'extensionsUsed', 'extensionsRequired'):
            j.pop(k, None)
        tmp = os.path.join(WORK, f'arms_tmp_{only}.glb')
        g.rebuild(tmp, {})
        os.replace(tmp, new_out)   # 同時有別的 agent 在跑遊戲時讀不到半個檔
        print(f'OK {new_out} {os.path.getsize(new_out)}', flush=True)
        return
    out = os.path.join(OUT_DIR, 'arms.glb')
    g.rebuild(out, {})
    path = os.path.join(DIST, 'soldier-meta.json')
    old = json.load(open(path)) if os.path.exists(path) else {}
    old['arms'] = {'frame': '節點座標即槍座標（glTF）：+Z 槍口、+Y 上、握把在原點；arms_<id> 與槍共用同一變換', 'poses': meta,
                   'thirdPersonLeft': [0.0, RIFLE.fy, RIFLE.fore]}
    json.dump(old, open(path, 'w'), ensure_ascii=False, indent=1)
    print('OK arms.glb', os.path.getsize(out), flush=True)
    if PREVIEW:
        arms_shots(PREVIEW, obs)
    assert not fails, f'握持驗收有 {len(fails)} 項未過，見 {rp}'


def arms_shots(path, obs):
    """粗略第一人稱鏡位檢查"""
    s = bpy.context.scene
    cam, co = studio(s, (1280, 800))
    cam.type = 'PERSP'
    cam.lens = 24
    guns = load_guns()
    for g in guns.values():
        g.matrix_world = aim_basis(0, 0).to_4x4() @ GUN_FROM_BL
    for o in obs:
        o.hide_render = True
    for o in obs:
        o.hide_render = False
        for k, g in guns.items():
            g.hide_render = f'arms_{k}' != o.name
        # 第一人稱：相機在握把左後上方（槍座標 左 .13 上 .17 後 .42）
        cam.type = 'PERSP'
        co.location = gun_to_bl((0.13, 0.17, -0.42))
        co.rotation_euler = (math.radians(90), 0, math.radians(180))
        s.render.filepath = f'{path}{o.name}.png'
        bpy.ops.render.render(write_still=True)
        # 右側面正交
        cam.type = 'ORTHO'
        cam.ortho_scale = 0.9
        co.location = gun_to_bl((-1.5, 0.0, 0.1))
        co.rotation_euler = (math.radians(90), 0, math.radians(-90))
        s.render.filepath = f'{path}{o.name}_s.png'
        bpy.ops.render.render(write_still=True)
        # 左側面特寫（看右手握把）
        cam.ortho_scale = 0.32
        co.location = gun_to_bl((1.5, 0.0, 0.0))
        co.rotation_euler = (math.radians(90), 0, math.radians(90))
        s.render.filepath = f'{path}{o.name}_c.png'
        bpy.ops.render.render(write_still=True)
        o.hide_render = True
    print('arms shots ok')


def stage_export():
    r = load_body()
    r.arm['fit_scale'] = r.scale
    P, XR, F_rest, XLr, XLp, counts = build_anims(r.arm)
    bodies = {}
    for t in TEAMS:
        bodies[t] = assemble(t, r)
    r.body.hide_render = r.eyes.hide_render = True
    r.body.hide_viewport = r.eyes.hide_viewport = True
    cycles_setup()
    for o in bodies.values():
        o.hide_render = False
    if STAGE == 'pose':
        names = (arg('--clips') or 'idle_rifle:10:q,idle_rifle:10:s,walk_rifle:8:q,run_rifle:5:q,crouch_idle:5:q').split(',')
        cl = [(c.split(':')[0], int(c.split(':')[1]), c.split(':')[2]) for c in names]
        fs = contact_sheet(PREVIEW, r.arm, {k: v for k, v in bodies.items()}, XR, cl)
        print('SHOTS', ' '.join(fs))
        return
    return r, P, XR, F_rest, XLr, XLp, counts, bodies


def finish_soldier():
    r, P, XR, F_rest, XLr, XLp, counts, bodies = stage_export()
    nla_all(r.arm)
    bpy.data.objects.remove(r.body, do_unlink=True)
    bpy.data.objects.remove(r.eyes, do_unlink=True)
    os.makedirs(OUT_DIR, exist_ok=True)
    raw = os.path.join(WORK, 'soldier_raw.glb')
    export_glb(raw)
    g = Glb(raw)
    post_common(g)
    extra = compress_anims(g)
    caps, joints = capsules(g)
    G = g.world()
    sock = add_socket(g, 'hand_R_socket', 'hand_r', to_gltf_axes(F_rest), G)
    out = os.path.join(OUT_DIR, 'soldier.glb')
    g.rebuild(out, extra)
    tris = {m['name']: int(sum(g.j['accessors'][p['indices']]['count'] for p in m['primitives']) / 3) for m in g.j['meshes']}
    meta = {
        'units': 'm', 'height': HEIGHT, 'crouchHeight': 1.25,
        'coords': 'glTF：角色面向 +Z、上 +Y。命中膠囊 a/b 在骨頭局部座標（glTF 節點空間，不受 Babylon 根節點翻轉影響）',
        'bones': joints,
        'socket': dict(sock, name='hand_R_socket', note='槍框架：原點在握把、+Z 槍口、+Y 上；掛在這個節點下的槍以 grip=原點 對齊；Babylon 要把槍的內層網格（不含 __root__）直接接到 socket、局部變換歸零，才不會翻轉兩次'),
        'hitbox': caps,
        'clips': {k: dict({'frames': v, 'seconds': round((v - 1) / FPS, 3)}, **({'loopFrom': round(LOOP_FROM[k], 3)} if k in LOOP_FROM else {})) for k, v in counts.items()},
        'loops': ['idle_rifle', 'walk_rifle', 'run_rifle', 'strafe_l_rifle', 'strafe_r_rifle', 'back_rifle', 'crouch_idle', 'crouch_walk', 'defuse', 'idle_pistol', 'run_pistol'],
        'tris': tris,
    }
    path = os.path.join(DIST, 'soldier-meta.json')
    old = json.load(open(path)) if os.path.exists(path) else {}
    old.update(meta)
    json.dump(old, open(path, 'w'), ensure_ascii=False, indent=1)
    print('OK soldier.glb', os.path.getsize(out), tris, flush=True)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(WORK, 'rigged.blend'))


# ------------------------------------------------------------------ 匯出與 GLB 後處理


def export_glb(path):
    a = dict(
        filepath=path, export_format='GLB', use_selection=False, export_animations=True, export_animation_mode='NLA_TRACKS',
        export_image_format='WEBP', export_image_quality=int(arg('--q', '84')), export_image_add_webp=False, export_image_webp_fallback=False,
        export_yup=True, export_apply=False, export_tangents=False, export_vertex_color='NONE', export_all_vertex_colors=False,
        export_morph=False, export_extras=False, export_all_influences=False, export_force_sampling=True, export_optimize_animation_size=True,
        export_optimize_animation_keep_anim_armature=True, export_cameras=False, export_lights=False, export_def_bones=False,
        export_skins=True, export_texcoords=True, export_normals=True, export_materials='EXPORT',
    )
    bpy.ops.export_scene.gltf(**a)


def nla_all(arm):
    arm.animation_data_create()
    ad = arm.animation_data
    ad.action = None
    for t in list(ad.nla_tracks):
        ad.nla_tracks.remove(t)
    for a in bpy.data.actions:
        t = ad.nla_tracks.new()
        t.name = a.name
        st = t.strips.new(a.name, 0, a)
        st.action = a
        if len(a.slots):
            st.action_slot = a.slots[0]
        t.mute = True


COMP = {5120: ('b', 1), 5121: ('B', 1), 5122: ('h', 2), 5123: ('H', 2), 5125: ('I', 4), 5126: ('f', 4)}
NUMC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}


class Glb:
    def __init__(self, path):
        d = open(path, 'rb').read()
        jl = struct.unpack('<I', d[12:16])[0]
        self.j = json.loads(d[20:20 + jl])
        o = 20 + jl
        bl = struct.unpack('<I', d[o:o + 4])[0]
        self.bin = d[o + 8:o + 8 + bl]

    def acc(self, i):
        a = self.j['accessors'][i]
        bv = self.j['bufferViews'][a['bufferView']]
        c, s = COMP[a['componentType']]
        n = NUMC[a['type']]
        off = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
        st = bv.get('byteStride', s * n)
        dt = np.dtype('<' + c)
        if st == s * n:
            arr = np.frombuffer(self.bin, dt, a['count'] * n, off).reshape(a['count'], n)
        else:
            arr = np.stack([np.frombuffer(self.bin, dt, n, off + i_ * st) for i_ in range(a['count'])])
        return arr

    def node_by(self, name):
        for i, n in enumerate(self.j['nodes']):
            if n.get('name') == name:
                return i
        return None

    def rest(self, i):
        n = self.j['nodes'][i]
        if 'matrix' in n:
            return np.array(n['matrix'], dtype=np.float64).reshape(4, 4).T
        t = n.get('translation', [0, 0, 0])
        r = n.get('rotation', [0, 0, 0, 1])
        s = n.get('scale', [1, 1, 1])
        q = Quaternion((r[3], r[0], r[1], r[2]))
        M = np.eye(4)
        M[:3, :3] = np.array(q.to_matrix()) * np.array(s)
        M[:3, 3] = t
        return M

    def world(self):
        par = {}
        for i, n in enumerate(self.j['nodes']):
            for c in n.get('children', []):
                par[c] = i
        G = {}

        def g(i):
            if i in G:
                return G[i]
            m = self.rest(i)
            if i in par:
                m = g(par[i]) @ m
            G[i] = m
            return m
        for i in range(len(self.j['nodes'])):
            g(i)
        return G

    def rebuild(self, path, extra):
        """依 accessor 與圖片重建 BIN，extra 是 {accessor 索引: (bytes)} 新資料"""
        j = self.j
        out = bytearray()
        views = []

        def push(data, target=None, align=4):
            pad = (-len(out)) % align
            out.extend(b'\0' * pad)
            v = {'buffer': 0, 'byteOffset': len(out), 'byteLength': len(data)}
            if target:
                v['target'] = target
            out.extend(data)
            views.append(v)
            return len(views) - 1

        used = set()

        def mark(x):
            if x is not None:
                used.add(x)
        for m in j['meshes']:
            for p in m['primitives']:
                for v in p['attributes'].values():
                    mark(v)
                mark(p.get('indices'))
        for s in j.get('skins', []):
            mark(s.get('inverseBindMatrices'))
        for a in j.get('animations', []):
            for sm in a['samplers']:
                mark(sm['input'])
                mark(sm['output'])
        remap = {}
        new_acc = []
        for i in sorted(used):
            a = dict(j['accessors'][i])
            if i in extra:
                data = extra[i]
                a.pop('byteOffset', None)
            else:
                c, s = COMP[a['componentType']]
                n = NUMC[a['type']]
                bv = j['bufferViews'][a['bufferView']]
                off = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
                st = bv.get('byteStride', s * n)
                if st == s * n:
                    data = self.bin[off:off + a['count'] * s * n]
                else:
                    data = b''.join(self.bin[off + k * st:off + k * st + s * n] for k in range(a['count']))
                a.pop('byteOffset', None)
            tgt = j['bufferViews'][a['bufferView']].get('target') if 'bufferView' in a else None
            a['bufferView'] = push(data, tgt)
            remap[i] = len(new_acc)
            new_acc.append(a)
        for im in j.get('images', []):
            bv = j['bufferViews'][im['bufferView']]
            off = bv.get('byteOffset', 0)
            im['bufferView'] = push(self.bin[off:off + bv['byteLength']])
        for m in j['meshes']:
            for p in m['primitives']:
                p['attributes'] = {k: remap[v] for k, v in p['attributes'].items()}
                if 'indices' in p:
                    p['indices'] = remap[p['indices']]
        for s in j.get('skins', []):
            s['inverseBindMatrices'] = remap[s['inverseBindMatrices']]
        for a in j.get('animations', []):
            for sm in a['samplers']:
                sm['input'] = remap[sm['input']]
                sm['output'] = remap[sm['output']]
        j['accessors'] = new_acc
        j['bufferViews'] = views
        j['buffers'] = [{'byteLength': len(out)}]
        js = json.dumps(j, separators=(',', ':'), ensure_ascii=False).encode('utf8')
        js += b' ' * ((-len(js)) % 4)
        out.extend(b'\0' * ((-len(out)) % 4))
        with open(path, 'wb') as f:
            f.write(struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(out)))
            f.write(struct.pack('<II', len(js), 0x4E4F534A))
            f.write(js)
            f.write(struct.pack('<II', len(out), 0x004E4942))
            f.write(out)


def strip_extras(o):
    if isinstance(o, dict):
        o.pop('extras', None)
        for v in o.values():
            strip_extras(v)
    elif isinstance(o, list):
        for v in o:
            strip_extras(v)


def post_common(g):
    j = g.j
    strip_extras(j)
    j['asset'] = {'version': '2.0', 'generator': 'games/278-ochre-line/tools/build-soldier.py'}
    KEEP = {'POSITION', 'NORMAL', 'TEXCOORD_0', 'JOINTS_0', 'WEIGHTS_0'}
    for m in j['meshes']:
        for p in m['primitives']:
            p['attributes'] = {k: v for k, v in p['attributes'].items() if k in KEEP}
            p.pop('targets', None)
    for mt in j.get('materials', []):
        pb = mt.get('pbrMetallicRoughness', {})
        mr = pb.get('metallicRoughnessTexture')
        if mr:
            mt['occlusionTexture'] = {'index': mr['index']}
        mt.pop('doubleSided', None)


def compress_anims(g, skip=('hit',)):
    """丟掉 scale 與常數軌道、旋轉改 int16、12 fps（短動作留 24 fps）"""
    j = g.j
    extra = {}
    shared = {}
    for an in j.get('animations', []):
        step = 1 if an['name'] in skip else 2
        keep_ch, keep_sm = [], []
        for ch in an['channels']:
            sm = an['samplers'][ch['sampler']]
            path = ch['target']['path']
            if path == 'scale':
                continue
            node = j['nodes'][ch['target']['node']]
            T = g.acc(sm['input']).reshape(-1)
            V = g.acc(sm['output']).astype(np.float64)
            if path == 'rotation':
                rest = np.array(node.get('rotation', [0, 0, 0, 1]))
                d = np.minimum(np.abs(V - rest).max(1), np.abs(V + rest).max(1))
                const = d.max() < 6e-4
            else:
                rest = np.array(node.get('translation', [0, 0, 0]))
                const = np.abs(V - rest).max() < 3e-4
            if const:
                continue
            idx = list(range(0, len(T), step))
            if idx[-1] != len(T) - 1:
                idx.append(len(T) - 1)
            key = (an['name'], tuple(idx))
            if key not in shared:
                ta = dict(j['accessors'][sm['input']])
                ai = len(j['accessors'])
                j['accessors'].append(ta)
                Tn = T[idx].astype(np.float32)
                ta['count'] = len(idx)
                ta['min'] = [float(Tn.min())]
                ta['max'] = [float(Tn.max())]
                extra[ai] = Tn.tobytes()
                shared[key] = ai
            inp = shared[key]
            vals = V[idx]
            oa = dict(j['accessors'][sm['output']])
            ai = len(j['accessors'])
            j['accessors'].append(oa)
            oa['count'] = len(idx)
            oa.pop('min', None)
            oa.pop('max', None)
            if path == 'rotation':
                for i in range(1, len(vals)):
                    if np.dot(vals[i], vals[i - 1]) < 0:
                        vals[i] = -vals[i]
                vals = vals / np.linalg.norm(vals, axis=1, keepdims=True)
                oa['componentType'] = 5122
                oa['normalized'] = True
                extra[ai] = np.round(vals * 32767).astype('<i2').tobytes()
            else:
                extra[ai] = vals.astype(np.float32).tobytes()
            keep_sm.append({'input': inp, 'output': ai, 'interpolation': 'LINEAR'})
            keep_ch.append({'sampler': len(keep_sm) - 1, 'target': ch['target']})
        an['channels'] = keep_ch
        an['samplers'] = keep_sm
    return extra


def fit_capsule(pts):
    """pts: 骨頭局部座標的頂點。試幾個軸向，取表面誤差最小的膠囊（半徑取距離的 62 百分位，略貼在外）"""
    c = np.median(pts, 0)
    Q = pts - pts.mean(0)
    _, _, Vt = np.linalg.svd(Q, full_matrices=False)
    best = None

    def seg_dist(a, b):
        ab = b - a
        L = ab @ ab
        if L < 1e-10:
            return np.linalg.norm(pts - a, axis=1)
        t = np.clip(((pts - a) @ ab) / L, 0, 1)
        return np.linalg.norm(pts - (a + t[:, None] * ab), axis=1)

    for ax in list(Vt[:2]) + [np.array((0, 1.0, 0))]:
        ax = ax / np.linalg.norm(ax)
        t = (pts - c) @ ax
        t0, t1 = float(np.percentile(t, 1)), float(np.percentile(t, 99))
        # 軸線穿過截面中心
        mid = pts[(t > t0 + (t1 - t0) * 0.2) & (t < t1 - (t1 - t0) * 0.2)]
        if len(mid) > 8:
            m = mid.mean(0)
            c2 = m - ax * ((m - c) @ ax)
        else:
            c2 = c
        r = float(np.percentile(np.linalg.norm((pts - c2) - np.outer((pts - c2) @ ax, ax), axis=1), 60))
        for _ in range(4):
            a_, b_ = t0 + r, t1 - r
            if a_ > b_:
                a_ = b_ = (t0 + t1) / 2
            A, B = c2 + ax * a_, c2 + ax * b_
            d = seg_dist(A, B)
            r = float(np.percentile(d, 62))
        err = float(np.mean(np.abs(d - r)))
        if best is None or err < best[0]:
            best = (err, A, B, r)
    return best[1], best[2], best[3]


PARTS = {
    'Head': ('Head', ['Head']),
    'Chest': ('spine_03', ['spine_03', 'spine_02', 'clavicle_l', 'clavicle_r']),
    'Stomach': ('spine_01', ['spine_01', 'pelvis']),
    'UpperArm_L': ('upperarm_l', ['upperarm_l']),
    'UpperArm_R': ('upperarm_r', ['upperarm_r']),
    'Forearm_L': ('lowerarm_l', ['lowerarm_l', 'hand_l']),
    'Forearm_R': ('lowerarm_r', ['lowerarm_r', 'hand_r']),
    'Thigh_L': ('thigh_l', ['thigh_l']),
    'Thigh_R': ('thigh_r', ['thigh_r']),
    'Calf_L': ('calf_l', ['calf_l', 'foot_l']),
    'Calf_R': ('calf_r', ['calf_r', 'foot_r']),
}


def capsules(g):
    j = g.j
    idx = g.node_by('body_atk')
    node = j['nodes'][idx]
    m = j['meshes'][node['mesh']]
    prim = m['primitives'][0]
    skin = j['skins'][node['skin']]
    P = g.acc(prim['attributes']['POSITION']).astype(np.float64)
    Jn = g.acc(prim['attributes']['JOINTS_0'])
    Wt = g.acc(prim['attributes']['WEIGHTS_0']).astype(np.float64)
    if Wt.max() > 2:
        Wt /= 255.0
    names = [j['nodes'][i]['name'] for i in skin['joints']]
    IBM = g.acc(skin['inverseBindMatrices']).astype(np.float64).reshape(-1, 4, 4).transpose(0, 2, 1)
    dom = np.array([names[Jn[i, np.argmax(Wt[i])]] for i in range(len(P))])
    out = {}
    H = np.c_[P, np.ones(len(P))]
    for part, (bone, bones) in PARTS.items():
        mask = np.isin(dom, bones)
        k = names.index(bone)
        L = (IBM[k] @ H[mask].T).T[:, :3]
        a, b, r = fit_capsule(L)
        out[part] = {'bone': bone, 'a': [round(float(x), 4) for x in a], 'b': [round(float(x), 4) for x in b], 'r': round(r, 4), 'verts': int(mask.sum())}
    return out, names


def to_gltf_axes(M):
    """Blender 骨架空間矩陣（欄為軸）-> glTF 世界"""
    C = np.array([[1, 0, 0, 0], [0, 0, 1, 0], [0, -1, 0, 0], [0, 0, 0, 1]], dtype=np.float64)
    return C @ np.array(M)


def add_socket(g, name, parent_name, Fworld_gltf, G):
    j = g.j
    p = g.node_by(parent_name)
    L = np.linalg.inv(G[p]) @ Fworld_gltf
    q = Matrix(L[:3, :3].tolist()).to_quaternion()
    t = L[:3, 3]
    node = {'name': name, 'translation': [float(x) for x in t], 'rotation': [q.x, q.y, q.z, q.w]}
    j['nodes'].append(node)
    i = len(j['nodes']) - 1
    j['nodes'][p].setdefault('children', []).append(i)
    return {'bone': parent_name, 'pos': [round(float(x), 5) for x in t], 'quat': [round(v, 5) for v in (q.x, q.y, q.z, q.w)]}


if __name__ == '__main__':
    if STAGE == 'geo':
        for t in TEAMS:
            preview(PREVIEW, t)
    if STAGE == 'bake':
        for t in TEAMS:
            bake_team(t)
    if STAGE == 'look':
        for t in TEAMS:
            look(t, PREVIEW)
    if STAGE == 'pose':
        stage_export()
    if STAGE == 'all':
        finish_soldier()
    if STAGE == 'armsbake':
        bake_arms()
    if STAGE == 'arms':
        stage_arms()
