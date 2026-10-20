# 真人比例的身體：Quaternius「Universal Base Characters」Superhero 男／女底模（CC0，和 268 TERRA 的路人同一套），
# 取代以斷面放樣拼出來的皮膚與緊身衣部件，以及 anime_head 的頭顱。衣物、盔甲、靴子與頭髮仍由各英雄的腳本建模。
#   1. 底模（T 字）依骨段擬合到 rig.json 的 A 字綁定姿勢：每根底模骨頭一個「旋轉＋沿骨縮放＋徑向縮放」，以底模權重混合；
#      軀幹改用依高度的縱向重新對應＋橫向縮放，寬度照英雄自己的皮膚／緊身衣部件量出來。
#   2. 顏色：從被取代的部件（skin=1）就近投影 pal／mat／ol，所以袖子、手套、緊身衣的分色照舊。
#   3. 被衣物蓋住的地方：從骨軸往外射線，碰到衣物內壁就把皮膚收進去（留 3 mm），擺動時才不會穿出來。
#   4. 權重直接沿用底模（骨名對應到 198 的骨架），不經過骨熱。
#   5. 頭：和身體同一次擬合（head_map 對到動畫頭顱的顱骨橢球與貼花的眼線），眼窩填平，頸部接縫共用頂點、權重全給頭骨。
# 素材包由 games/197-openworld/tools/fetch-quaternius.py 下載到 games/197-openworld/.cache/（或設 QUATERNIUS_CACHE）。
import math
import os

import bmesh
import bpy
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree
from mathutils.kdtree import KDTree

import kit
from kit import smooth

V = Vector
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
CACHE = os.environ.get('QUATERNIUS_CACHE') or os.path.normpath(os.path.join(ROOT, '../197-openworld/.cache'))
BODY = os.path.join(CACHE, 'ubc/Universal Base Characters[Standard]/Base Characters/Godot - UE/Superhero_{}_FullBody.gltf')
G_REAL = 90
FEMALE = {'a18', 'sakura', 'nami'}
# 量不到皮膚部件時，四肢粗細以這兩名英雄的比例當作底模原本的體型
REF = {'Male': 'trunks', 'Female': 'a18'}
REF_R = {
    'trunks': {'arm': 0.05861, 'fore': 0.05522, 'thigh': 0.08237, 'shin': 0.0653},
    'a18': {'arm': 0.0373, 'fore': 0.03604, 'thigh': 0.06065, 'shin': 0.05386},
}
G_TORSO_SET = {1, 10, 11, 19}   # heroes 的 G_TORSO、G_PELVIS、G_BELT、G_CHEST

_SRC = {}
HEAD_ARGS = {}   # anime_head 的物件名 → 參數（換成底模的頭時用）


def enabled(hid):
    """REAL_BODY 環境變數：all（預設）／none／逗號分隔的英雄名單。"""
    v = os.environ.get('REAL_BODY', 'all')
    return v == 'all' or hid in v.split(',')


def skin(ob):
    """標記為要被真人身體取代的部件（皮膚與緊身衣）。"""
    ob['skin'] = 1
    return ob


def bone_map(q):
    s = 'L' if q.endswith('_l') else 'R' if q.endswith('_r') else ''
    b = q[:-2] if s else q
    if b == 'spine_02':
        return [('torso', 0.4), ('ribs', 0.6)]
    tbl = {'root': 'hips', 'pelvis': 'hips', 'spine_01': 'torso', 'spine_03': 'ribs', 'neck_01': 'neck', 'Head': 'head',
           'clavicle': 'cl', 'upperarm': 'sh', 'lowerarm': 'el', 'hand': 'wr', 'thigh': 'th', 'calf': 'kn', 'foot': 'an', 'ball': 'to', 'ball_leaf': 'to'}
    if b in tbl:
        return [(tbl[b] + s, 1.0)]
    for f in ('index', 'middle', 'ring', 'pinky'):
        if b.startswith(f):
            return [({'01': 'fa', '02': 'fb'}.get(b.split('_')[1], 'fc') + s, 1.0)]
    if b.startswith('thumb'):
        return [('tb' + s, 1.0)]
    return [('hips', 1.0)]


def head_enabled(hid):
    """REAL_HEAD 環境變數：all（預設）／none／逗號分隔的英雄名單。關掉時沿用 anime_head 的動畫頭顱。"""
    v = os.environ.get('REAL_HEAD', 'all')
    return enabled(hid) and (v == 'all' or hid in v.split(','))


def neighbors(n, polys):
    nb = [set() for _ in range(n)]
    for p in polys:
        for a, b in zip(p, p[1:] + p[:1]):
            nb[a].add(b)
            nb[b].add(a)
    return [list(s) for s in nb]


def fill_eyes(co, nb, eyes):
    """眼窩填平：底模的眼皮開口裡是凹進去的眼窩（眼球是另一個網格，不用）。開口裡的頂點往前推到
    周圍眼皮表面的高度，再在網格上平滑幾輪，動畫眼睛的貼花才畫在一片乾淨、朝前的面上。"""
    for (ex, ey, ez), (rx, ry) in eyes:
        def r2(c):
            return ((c.x - ex) / rx) ** 2 + ((c.y - ey) / ry) ** 2
        inner = [i for i, c in enumerate(co) if c.z > ez - 0.045 and r2(c) < 1.0]
        rim = [co[i] for i, c in enumerate(co) if c.z > ez - 0.012 and 1.0 <= r2(c) < 3.0]

        def zs(c):
            acc = tot = 0.0
            for q in rim:
                w = 1.0 / (((q.x - c.x) ** 2 + (q.y - c.y) ** 2) + 1e-7)
                acc += q.z * w
                tot += w
            return acc / tot
        for i in inner:
            c = co[i]
            co[i] = V((c.x, c.y, max(c.z, zs(c) - 0.0015)))
        # 平滑：開口內與眼皮一圈（r² < 1.8）一起放鬆，外圈固定
        soft = set(inner) | {i for i, c in enumerate(co) if c.z > ez - 0.02 and r2(c) < 1.8}
        for _ in range(8):
            nxt = {}
            for i in soft:
                if nb[i]:
                    m = sum((co[j] for j in nb[i]), V((0, 0, 0))) / len(nb[i])
                    nxt[i] = co[i].lerp(m, 0.6)
            for i, p in nxt.items():
                co[i] = p


def load(sex):
    """匯入底模（只取頂點、面與權重，座標轉成 three 空間：+Y 上、面向 +Z）。
    面分成身體（polys）與頭（hpolys：每個頂點的 Head 權重都 ≥ 0.55），兩者共用頂點，接縫是同一圈頂點。"""
    if sex in _SRC:
        return _SRC[sex]
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=BODY.format(sex), merge_vertices=True)
    objs = [o for o in bpy.data.objects if o not in before]
    arm = next(o for o in objs if o.type == 'ARMATURE')
    body = next(o for o in objs if o.type == 'MESH' and o.name.lower().startswith('superhero'))
    eyes_ob = next(o for o in objs if o.type == 'MESH' and o.name.lower().startswith('eyes'))
    T = lambda p: V((p.x, p.z, -p.y))
    J = {b.name: (T(arm.matrix_world @ b.head_local), T(arm.matrix_world @ b.tail_local)) for b in arm.data.bones}
    me = body.data
    mw = body.matrix_world
    gn = {g.index: g.name for g in body.vertex_groups}
    co = [T(mw @ v.co) for v in me.vertices]
    W = []
    for v in me.vertices:
        ws = [(gn[g.group], g.weight) for g in v.groups if g.weight > 1e-4]
        tot = sum(w for _, w in ws) or 1.0
        W.append([(n, w / tot) for n, w in ws])
    head = [sum(w for n, w in ws if n == 'Head') for ws in W]
    polys = [tuple(p.vertices) for p in me.polygons]
    is_head = [min(head[i] for i in p) >= 0.55 for p in polys]
    # 眼球網格只拿來量眼睛的位置（左右各一顆）
    ec = [T(eyes_ob.matrix_world @ v.co) for v in eyes_ob.data.vertices]
    eyes = []
    for s in (1, -1):
        e = [c for c in ec if c.x * s > 0]
        lo = V((min(c.x for c in e), min(c.y for c in e), min(c.z for c in e)))
        hi = V((max(c.x for c in e), max(c.y for c in e), max(c.z for c in e)))
        eyes.append((((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, hi.z), ((hi.x - lo.x) * 0.62, (hi.y - lo.y) * 0.45)))
    fill_eyes(co, neighbors(len(co), polys), eyes)
    hp = J['Head'][0]
    hv = [c - hp for i, c in enumerate(co) if head[i] > 0.55]
    eye_y = eyes[0][0][1] - hp.y
    crown = max(c.y for c in hv)
    # 下巴：臉中線、前方的頂點裡最低的（脖子在下巴後面，z 較小）
    chin = min(c.y for c in hv if abs(c.x) < 0.02 and c.z > eyes[0][0][2] - hp.z - 0.03)
    # 顱骨斷面：眼睛到頭頂之間（耳朵以上）的寬度與前後範圍
    ys = eye_y + (crown - eye_y) * 0.5
    sl = [c for c in hv if abs(c.y - ys) < 0.006]
    lm = {'eye': eye_y, 'eye_x': abs(eyes[0][0][0]), 'crown': crown, 'chin': chin, 'ys': ys,
          'ax': max(abs(c.x) for c in sl), 'az0': min(c.z for c in sl), 'az1': max(c.z for c in sl)}

    def piece(sel):
        ps = [p for p, k in zip(polys, is_head) if k == sel]
        used = sorted({i for p in ps for i in p})
        return used, ps
    bu, bp = piece(False)
    hu, hpp = piece(True)
    seam = set(bu) & set(hu)
    remap = {o: n for n, o in enumerate(bu)}
    src = {'J': J, 'co': co, 'W': W, 'lm': lm,
           'used': bu, 'polys': [tuple(remap[i] for i in p) for p in bp], 'seam': [i in seam for i in bu],
           'hused': hu, 'hpolys': hpp}
    for o in objs:
        bpy.data.objects.remove(o, do_unlink=True)
    _SRC[sex] = src
    return src


# ---------------------------------------------------------------- 骨段擬合
def seg_xf(hs, ts, ht, tt, rad=1.0):
    """把來源骨段 hs→ts 對到目標骨段 ht→tt：繞來源頭旋轉到目標方向、沿骨縮放到目標長度、垂直方向乘 rad。回傳 4×4 矩陣。"""
    ds, dt = ts - hs, tt - ht
    ls, lt = max(ds.length, 1e-6), max(dt.length, 1e-6)
    ds, dt = ds / ls, dt / lt
    S = Matrix.Identity(3) * rad + (lt / ls - rad) * Matrix(((ds.x * ds.x, ds.x * ds.y, ds.x * ds.z), (ds.y * ds.x, ds.y * ds.y, ds.y * ds.z), (ds.z * ds.x, ds.z * ds.y, ds.z * ds.z)))
    Rq = ds.rotation_difference(dt).to_matrix()
    M = (Rq @ S).to_4x4()
    return Matrix.Translation(ht) @ M @ Matrix.Translation(-hs)


def axis_dist(p, h, t):
    d = t - h
    L2 = max(d.length_squared, 1e-12)
    k = max(0.0, min(1.0, (p - h).dot(d) / L2))
    return (p - (h + d * k)).length, k


def median(xs):
    xs = sorted(xs)
    return xs[len(xs) // 2] if xs else None


class Fitter:
    def __init__(self, F, sex, parts, hargs=None):
        self.F, self.sex, self.hargs = F, sex, hargs
        self.S = load(sex)
        self.R = F.R
        self.B = F.b   # 198 骨頭：name → (head, tail)
        self.parts = parts
        self.pts = []   # 被取代部件的頂點（量粗細用）：(co, grp)
        for o in parts:
            g = o.data.attributes.get('grp')
            for i, v in enumerate(o.data.vertices):
                self.pts.append((V(v.co), g.data[i].value if g else 0))

    # 底模某根骨（依骨名）主導的頂點到骨軸的距離中位數
    def src_radius(self, qb, t0=0.3, t1=0.7):
        J, co, W = self.S['J'], self.S['co'], self.S['W']
        h, t = J[qb]
        ds = []
        for c, ws in zip(co, W):
            if any(n == qb and w > 0.7 for n, w in ws):
                d, k = axis_dist(c, h, t)
                if t0 <= k <= t1:
                    ds.append(d)
        return median(ds)

    # 被取代部件在 198 某骨段中段的粗細（沒有就回傳 None）
    def dst_radius(self, bone, t0=0.3, t1=0.7, maxd=0.16):
        h, t = self.B[bone]
        ds = []
        for c, g in self.pts:
            if g in G_TORSO_SET:
                continue
            d, k = axis_dist(c, h, t)
            if t0 <= k <= t1 and d < maxd:
                ds.append(d)
        return median(ds) if len(ds) > 20 else None

    def limb_rad(self, qb, bone, key, t=(0.3, 0.7)):
        rs = self.src_radius(qb, *t)
        rd = self.dst_radius(bone, *t)
        if rd and rs:
            return max(0.6, min(1.7, rd / rs))
        ref = REF_R[REF[self.sex]]
        return max(0.6, min(1.7, self.R[key] / ref[key])) if key else 1.0

    def torso_map(self):
        """軀幹的縱向對應（髖關節→頸根線性）與各高度的橫向縮放（左右、前後、前後中心）。"""
        J, B = self.S['J'], self.B
        ys0, ys1 = J['thigh_l'][0].y, J['neck_01'][0].y
        yt0, yt1 = B['thL'][0].y, B['neck'][0].y
        ky = (yt1 - yt0) / (ys1 - ys0)
        ymap = lambda y: yt0 + (y - ys0) * ky
        # 量底模軀幹斷面：只取權重主要在骨盆、脊椎的頂點
        tor = [c for c, ws in zip(self.S['co'], self.S['W']) if sum(w for n, w in ws if n in ('pelvis', 'spine_01', 'spine_02', 'spine_03')) > 0.6]
        tgt = [(c, g) for c, g in self.pts if g in G_TORSO_SET]
        F = self.F
        rows = []
        for u in (0.06, 0.21, 0.38, 0.54, 0.67, 0.8):
            yt = F.y(u)
            ys = ys0 + (yt - yt0) / ky
            a = [c for c in tor if abs(c.y - ys) < 0.02]
            b = [c for c, _ in tgt if abs(c.y - yt) < 0.02]
            if len(a) < 10:
                continue
            ax = max(abs(c.x) for c in a)
            az0, az1 = min(c.z for c in a), max(c.z for c in a)
            if len(b) >= 10:
                bx = max(abs(c.x) for c in b)
                bz0, bz1 = min(c.z for c in b), max(c.z for c in b)
            else:   # 沒有軀幹皮膚部件（整個軀幹都在衣服裡）：照斷面表估計
                bx = F.w * 1.12 if u < 0.3 else F.cx * (0.86 + 0.2 * (u - 0.38))
                bz0, bz1 = -F.cz * 0.85, F.cz * 0.9
            rows.append((ys, ax, (az0 + az1) / 2, (az1 - az0) / 2, bx, (bz0 + bz1) / 2, (bz1 - bz0) / 2))
        def at(y):
            if y <= rows[0][0]:
                r = rows[0]
                return r
            for r0, r1 in zip(rows, rows[1:]):
                if y <= r1[0]:
                    k = (y - r0[0]) / (r1[0] - r0[0])
                    return tuple(a + (b - a) * k for a, b in zip(r0, r1))
            return rows[-1]
        def xf(p):
            r = at(p.y)
            _, ax, azc, azh, bx, bzc, bzh = r
            sx = max(0.6, min(1.6, bx / ax))
            sz = max(0.6, min(1.6, bzh / azh))
            return V((p.x * sx, ymap(p.y), bzc + (p.z - azc) * sz))
        return xf, ymap, ky

    def head_map(self):
        """底模的頭（Head 骨的權重）對到動畫頭顱：頭髮、髮帽與臉部貼花都以頭心 F.c 與 hr 定位，所以頭頂與顱骨寬、前後
        對到 anime_head 的顱骨橢球（cranium），眼睛對到貼花的眼線高度（頭心上 0.01 hr），下巴對到動畫臉的下巴；
        眼睛以上、以下各自縱向縮放（交界 3 cm 內漸變）。下半臉的寬度乘上 cheek×jaw，最後套 hx（頭的橫向比例）。"""
        F, a, lm = self.F, self.hargs, self.S['lm']
        c, hr = F.c, F.hr
        hp = self.S['J']['Head'][0]
        kx, ky, kz = a['cranium']
        te = c.y + 0.01 * hr
        tcrown = c.y + hr * (0.9 * ky + 0.08)
        tchin = c.y - hr * (0.9 * 0.86 * a['face_len'] + 0.06)
        eye = lm['eye']
        su = (tcrown - te) / (lm['crown'] - eye)
        sd = (te - tchin) / (eye - lm['chin'])
        yt = te + (lm['ys'] - eye) * su
        k = math.sqrt(max(0.05, 1 - ((yt - (c.y + 0.08 * hr)) / (0.9 * ky * hr)) ** 2))
        sx = 0.8 * kx * hr * k / lm['ax']
        sz = 0.88 * kz * hr * k / ((lm['az1'] - lm['az0']) / 2)
        zc_s, zc_t = (lm['az0'] + lm['az1']) / 2, c.z - 0.04 * hr
        wf_low = a['cheek'] * a['jaw']
        hx = F.R.get('hx', 1.0)
        self.head_info = {'eye_y': te, 'chin_y': tchin}

        def fn(p):
            r = p - hp
            d = r.y - eye
            t = smooth((d + 0.015) / 0.03)
            y = te + d * (sd + (su - sd) * t)
            wf = 1 + (wf_low - 1) * smooth(-d / (eye - lm['chin']))
            x = c.x + r.x * sx * wf * hx
            z = zc_t + (r.z - zc_s) * sz
            return V((x, y, c.z + (z - c.z) * (0.5 + 0.5 * hx)))
        return fn

    def fit(self):
        J, B, F = self.S['J'], self.B, self.F
        tx, ymap, ky = self.torso_map()
        X = {}
        for s, q in (('L', 'l'), ('R', 'r')):
            arm_r = self.limb_rad('upperarm_' + q, 'sh' + s, 'arm')
            fore_r = self.limb_rad('lowerarm_' + q, 'el' + s, 'fore')
            th_r = self.limb_rad('thigh_' + q, 'th' + s, 'thigh')
            sh_r = self.limb_rad('calf_' + q, 'kn' + s, 'shin')
            X['upperarm_' + q] = seg_xf(J['upperarm_' + q][0], J['lowerarm_' + q][0], B['sh' + s][0], B['el' + s][0], arm_r)
            X['lowerarm_' + q] = seg_xf(J['lowerarm_' + q][0], J['hand_' + q][0], B['el' + s][0], B['wr' + s][0], fore_r)
            # 手：手腕→中指根對到 wr→fa；寬度照 198 手掌（四指張開的寬度）
            hk = self.R['handGeo']['k']
            fz = self.R['handGeo']['fz']
            palm_w = (fz[0] - fz[-1]) * hk + 2 * self.R['handGeo']['fr'][0] * hk
            q_w = (J['index_01_' + q][0] - J['pinky_01_' + q][0]).length + 0.02
            hand_r = max(0.7, min(1.8, palm_w / q_w))
            Hx = seg_xf(J['hand_' + q][0], J['middle_01_' + q][0], B['wr' + s][0], B['fa' + s][0], hand_r)
            X['hand_' + q] = Hx
            # 手指：每一節照中指的對應（fa／fb／fc 的關節位置），四指一起
            fj = [B['fa' + s][0], B['fb' + s][0], B['fc' + s][0], B['fc' + s][1]]
            mj = [J['middle_0%d_' % k + q][0] for k in (1, 2, 3)] + [J['middle_04_leaf_' + q][0]]
            for k in range(3):
                Mk = seg_xf(mj[k], mj[k + 1], fj[k], fj[k + 1], hand_r)
                for f in ('index', 'middle', 'ring', 'pinky'):
                    X['%s_0%d_%s' % (f, k + 1, q)] = Mk
                    if k == 2:
                        X['%s_04_leaf_%s' % (f, q)] = Mk
            # 拇指：整根對到 tb 骨段（樞紐對準 JS 的拇指關節）
            tb = seg_xf(J['thumb_01_' + q][0], J['thumb_04_leaf_' + q][1], B['tb' + s][0], B['tb' + s][1], hand_r)
            for k in ('01', '02', '03', '04_leaf'):
                X['thumb_%s_%s' % (k, q)] = tb
            X['clavicle_' + q] = seg_xf(J['clavicle_' + q][0], J['upperarm_' + q][0], B['cl' + s][0], B['sh' + s][0], 1.0)
            X['thigh_' + q] = seg_xf(J['thigh_' + q][0], J['calf_' + q][0], B['th' + s][0], B['kn' + s][0], th_r)
            X['calf_' + q] = seg_xf(J['calf_' + q][0], J['foot_' + q][0], B['kn' + s][0], B['an' + s][0], sh_r)
            # 腳：腳踝→腳掌對到 an→to；寬度照小腿的比例
            fr = max(0.8, min(1.4, (sh_r + 1) / 2 * self.R['toe']['s'] / 1.05))
            X['foot_' + q] = seg_xf(J['foot_' + q][0], J['ball_' + q][0], B['an' + s][0], B['to' + s][0], fr)
            bl = (J['ball_leaf_' + q][1] - J['ball_' + q][0]).length
            to_t = B['to' + s][0] + (B['to' + s][1] - B['to' + s][0]).normalized() * bl * (B['to' + s][0] - B['an' + s][0]).length / (J['ball_' + q][0] - J['foot_' + q][0]).length
            X['ball_' + q] = seg_xf(J['ball_' + q][0], J['ball_leaf_' + q][1], B['to' + s][0], to_t, fr)
            X['ball_leaf_' + q] = X['ball_' + q]
        # 脖子：頸根→頭根對到 198 的 neck 骨，粗細照被取代的脖子部件
        nr = None
        nh, nt = B['neck']
        ds = [axis_dist(c, nh, nt + (nt - nh) * 0.5) for c, g in self.pts if g == 12]
        ds = [d for d, k in ds if 0.1 < k < 0.6]
        src = self.src_radius('neck_01', 0.2, 0.8)
        if len(ds) > 20 and src:
            nr = max(0.8, min(1.6, median(ds) / src))
        X['neck_01'] = seg_xf(J['neck_01'][0], J['Head'][0], nh, nt, nr or 1.1)
        X['Head'] = X['neck_01']
        hf = self.head_map() if self.hargs is not None else None
        TORSO = {'root', 'pelvis', 'spine_01', 'spine_02', 'spine_03'}
        out = []
        for c, ws in zip(self.S['co'], self.S['W']):
            acc = V((0, 0, 0))
            tot = 0.0
            for n, w in ws:
                if n in TORSO:
                    p = tx(c)
                elif n == 'Head' and hf:
                    p = hf(c)
                else:
                    M = X.get(n)
                    p = (M @ c) if M is not None else tx(c)
                acc += p * w
                tot += w
            out.append(acc / (tot or 1.0))
        return out


# ---------------------------------------------------------------- 主流程
def make(F, body_parts, name='realbody', hargs=None):
    """body_parts：英雄的全部身體部件（含標記 skin=1 的）。hargs：anime_head 的參數（有就連頭一起換成底模的頭）。
    回傳 (真人身體物件, (KDTree, 每頂點權重 {198 骨名: w}, 被蓋住程度, 是否接縫), 其餘部件, 頭顱物件或 None)。"""
    hid = F.R.get('id', '')
    sex = 'Female' if hid in FEMALE else 'Male'
    skins = [o for o in body_parts if o.get('skin')]
    rest = [o for o in body_parts if not o.get('skin')]
    fitter = Fitter(F, sex, skins, hargs)
    S = fitter.S
    co_all = fitter.fit()
    skull = None
    if hargs is not None:
        hu = S['hused']
        hm = {o: n for n, o in enumerate(hu)}
        mh = bpy.data.meshes.new(name + '_head')
        mh.from_pydata([tuple(co_all[i]) for i in hu], [], [tuple(hm[i] for i in p) for p in S['hpolys']])
        mh.update()
        skull = bpy.data.objects.new(name + '_head', mh)
        bpy.context.scene.collection.objects.link(skull)
        skull['chin_y'] = fitter.head_info['chin_y']
        if not hargs['ears']:
            drop_ears(skull, [S['co'][i] - S['J']['Head'][0] for i in hu], S['lm'])
    used = S['used']
    co = [co_all[i] for i in used]
    # 有底模的頭時，接縫那一圈頂點整個跟著頭骨（頭顱是掛在頭骨上的剛體，兩邊的接縫才不會在轉頭時裂開）
    seam = list(S['seam']) if skull else [False] * len(used)
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(c) for c in co], [], S['polys'])
    me.update()
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    # 不重算法線：頭部挖空後是開口網格，重算可能整張翻面；底模原本的繞序就是朝外
    kit.tag(ob, 0, mat=4, grp=G_REAL, ol=1.0)
    weights = []
    for i in used:
        acc = {}
        for n, w in S['W'][i]:
            for b, k in bone_map(n):
                acc[b] = acc.get(b, 0.0) + w * k
        weights.append(acc)
    for i, s in enumerate(seam):
        if s:
            weights[i] = {'head': 1.0}
    dom = [max(w.items(), key=lambda kv: kv[1])[0] for w in weights]
    skin_tree = merged_tree(skins)
    real_tree = BVHTree.FromObject(ob, bpy.context.evaluated_depsgraph_get())
    kd0 = KDTree(len(me.vertices))
    for i, v in enumerate(me.vertices):
        kd0.insert(v.co, i)
    kd0.balance()
    retarget(rest, F, skin_tree, real_tree, kd0, dom)
    covered = conform(ob, rest, F, dom, seam)
    weights, dom, covered, seam = drop_covered(ob, skin_tree, covered, weights, dom, seam)
    cov = spread(ob, covered)
    # 權重查表要在上色切線之前建立（切線會在邊上插入新頂點，新頂點取最近的舊頂點權重）
    kd = KDTree(len(ob.data.vertices))
    for i, v in enumerate(ob.data.vertices):
        kd.insert(v.co, i)
    kd.balance()
    project(ob, skins, F, kd, dom)
    # 被取代的部件留在場景裡（骨熱替身可能還用到），只是不再併進身體
    return ob, (kd, weights, cov, seam), rest, skull


def drop_ears(skull, rel, lm, thr=0.058):
    """沒有耳朵（弗利沙）或另外接尖耳（比克）：拿掉底模的耳朵，洞補平。rel：每個頂點在底模裡相對 Head 骨的座標。"""
    eye = lm['eye']
    ear = [abs(c.x) > thr and eye - 0.085 < c.y < eye + 0.045 and -0.075 < c.z < 0.04 for c in rel]
    bm = bmesh.new()
    bm.from_mesh(skull.data)
    bm.verts.ensure_lookup_table()
    # 離頸部接縫三圈以內的不動：耳洞不能和頸部的開口連在一起
    near = {v for e in bm.edges if e.is_boundary for v in e.verts}
    for _ in range(3):
        near |= {u for v in list(near) for e in v.link_edges for u in e.verts}
    for v in near:
        ear[v.index] = False
    kill = [f for f in bm.faces if any(ear[v.index] for v in f.verts)]
    bmesh.ops.delete(bm, geom=kill, context='FACES_ONLY')
    bmesh.ops.delete(bm, geom=[e for e in bm.edges if not e.link_faces], context='EDGES')
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    # 頸部接縫也是開口，只補耳朵留下的洞（頭頂側、靠兩側的開口）
    hole = [e for e in bm.edges if e.is_boundary]
    # 每個洞：洞緣的中心加一個頂點，沿洞緣做扇形面（繞序照洞緣原本那一面反過來，法線才朝外），再細分、放鬆
    left = set(hole)
    bm.verts.index_update()
    n0 = len(bm.verts)   # 新頂點（扇形中心、細分）都接在後面
    new_f = []
    while left:
        e0 = left.pop()
        loop = [e0]
        v = e0.verts[1]
        while True:
            nxt = next((e for e in v.link_edges if e in left), None)
            if nxt is None:
                break
            left.discard(nxt)
            loop.append(nxt)
            v = nxt.other_vert(v)
        cen = sum((e.verts[0].co for e in loop), V((0, 0, 0))) / len(loop)
        if abs(cen.x) < 0.03:
            continue   # 頸部接縫的開口（在中線上）不補
        cen = bm.verts.new(cen)
        for e in loop:
            f0 = e.link_faces[0]
            lv = list(f0.verts)
            i = lv.index(e.verts[0])
            a_, b_ = (e.verts[0], e.verts[1]) if lv[(i + 1) % len(lv)] == e.verts[1] else (e.verts[1], e.verts[0])
            new_f.append(bm.faces.new((b_, a_, cen)))
    res = {'faces': new_f}
    hs = set(hole)
    bmesh.ops.subdivide_edges(bm, edges=list({e for f in new_f for e in f.edges if e not in hs}), cuts=2, use_grid_fill=True)
    # 洞緣不動，補上的內部頂點（扇形中心與細分出來的）放鬆成平順的一片
    bm.verts.index_update()
    ring = {v for v in bm.verts if v.index >= n0}
    for _ in range(25):
        nxt = {}
        for v in ring:
            nb = [e.other_vert(v) for e in v.link_edges]
            nxt[v] = v.co.lerp(sum((u.co for u in nb), V((0, 0, 0))) / len(nb), 0.5)
        for v, p in nxt.items():
            v.co = p
    bm.to_mesh(skull.data)
    bm.free()
    skull.data.update()
    print('  底模的頭：拿掉耳朵 %d 面、補 %d 面（洞邊 %d）' % (len(kill), len(res['faces']), len(hole)))


def dress_head(skull, old, F, hargs):
    """底模的頭上色：顏色與外框倍率從動畫頭顱（old）就近投影；鼻子附近外框變細。接上尖耳等額外部件。"""
    kit.tag(skull, hargs['pal'], mat=4, grp=0, ol=0.55)
    n = len(skull.data.vertices)
    kd = KDTree(n)
    for i, v in enumerate(skull.data.vertices):
        kd.insert(v.co, i)
    kd.balance()
    project(skull, [old], F, kd, ['head'] * n, center=F.c + V((0, -F.hr * 0.1, -F.hr * 0.1)), iters=16)
    hr = F.hr
    tip = max((V(v.co) for v in skull.data.vertices if abs(v.co.x - F.c.x) < 0.01 and v.co.y < F.c.y), key=lambda p: p.z)
    kit.paint_ol(skull, lambda co: 0.12 if (co - tip).length < hr * 0.3 else None)
    keep = hargs.get('keep') or []
    parts = []
    sk = [V(v.co) for v in skull.data.vertices]
    tree = BVHTree.FromObject(skull, bpy.context.evaluated_depsgraph_get())
    for o in keep:
        bm = bmesh.new()
        bm.from_mesh(o.data)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)   # 鏡射變形過的部件繞序是反的
        bm.to_mesh(o.data)
        bm.free()
        if o.get('ear'):
            # 尖耳：底模的頭比動畫頭顱窄，整隻耳朵往內挪到貼著頭側（耳根埋進去 4 mm）
            vs = [V(v.co) for v in o.data.vertices]
            sx = 1 if sum(p.x for p in vs) > 0 else -1
            root = min(vs, key=lambda p: (p.x - F.c.x) * sx)
            side = [p for p in sk if (p.x - F.c.x) * sx > 0 and abs(p.y - root.y) < hr * 0.35 and abs(p.z - root.z) < hr * 0.3]
            if side:
                wall = max((p.x - F.c.x) * sx for p in side)
                dx = (wall - 0.004 - (root.x - F.c.x) * sx) * sx
                kit.deform(o, lambda p, dx=dx: V((p.x + dx, p.y, p.z)))
        else:
            # 其他附加部件（比克的額頭隆起）：底模的額頭比較高，沿頭心往外推到貼著表面
            vs = [V(v.co) for v in o.data.vertices]
            cen = sum(vs, V((0, 0, 0))) / len(vs)
            d = cen - F.c
            dist = d.length
            d.normalize()
            hit = tree.ray_cast(F.c, d, hr * 3)
            if hit[0] is not None:
                rad = min((p - cen).length for p in vs)
                push = hit[3] + rad * 0.6 - dist
                if push > 0:
                    kit.deform(o, lambda p, m=d * push: p + m)
        o = kit.subsurf(o, 1)
        parts.append(kit.tag(o, hargs['pal'], mat=4, grp=0, ol=0.55))
    if parts:
        chin = skull['chin_y']
        skull = kit.join([skull] + parts, 'realhead')
        skull['chin_y'] = chin
    return skull


def seam_normals(body, skull):
    """頭顱與身體在頸部接縫的那圈頂點，兩邊各自只算到一側的面：平均兩邊的法線，明暗才接得上。"""
    nb_ = body.data.attributes['nrm'].data
    ns_ = skull.data.attributes['nrm'].data
    kd = KDTree(len(body.data.vertices))
    for i, v in enumerate(body.data.vertices):
        kd.insert(v.co, i)
    kd.balance()
    bm = bmesh.new()
    bm.from_mesh(skull.data)
    edge_v = {v.index for e in bm.edges if e.is_boundary for v in e.verts}
    bm.free()
    k = 0
    if os.environ.get('REAL_DEBUG'):
        ds = sorted(kd.find(skull.data.vertices[i].co)[2] for i in edge_v)
        print('  接縫距離（mm）：', len(ds), [round(d * 1000, 2) for d in ds[::max(1, len(ds) // 8)]])
    for i in edge_v:
        p = skull.data.vertices[i].co
        hits = kd.find_range(p, 1e-5)
        if not hits:
            continue
        nsum = V(ns_[i].vector) + sum((V(nb_[j].vector) for _c, j, _d in hits), V((0, 0, 0))) / len(hits)
        nsum.normalize()
        ns_[i].vector = nsum
        for _c, j, _d in hits:
            nb_[j].vector = nsum
        k += 1
    print('  頸部接縫：%d 頂點對齊法線' % k)


def spread(ob, covered, iters=6):
    """被衣物蓋住的程度（0..1）：蓋住的頂點 1，往外沿網格擴散幾圈漸變到 0。"""
    me = ob.data
    n = len(me.vertices)
    c = [1.0 if x else 0.0 for x in covered]
    nb = [[] for _ in range(n)]
    for e in me.edges:
        a, b = e.vertices
        nb[a].append(b)
        nb[b].append(a)
    for _ in range(iters):
        c = [max(c[i], 0.75 * max((c[j] for j in nb[i]), default=0.0)) for i in range(n)]
    return c


def merged_tree(objs):
    bm = bmesh.new()
    for o in objs:
        tmp = bmesh.new()
        tmp.from_mesh(o.data)
        m = bpy.data.meshes.new('tmp')
        tmp.to_mesh(m)
        tmp.free()
        bm.from_mesh(m)
        bpy.data.meshes.remove(m)
    t = BVHTree.FromBMesh(bm) if len(bm.faces) else None
    bm.free()
    return t


HAND_BONES = {n + s for n in ('wr', 'fa', 'fb', 'fc', 'tb') for s in 'LR'} | {'head'}


def axis_point(F, b, p):
    """頂點 p（主導骨 b）往外量距離用的骨軸點；手、手指與頭不處理（回傳 None）。"""
    B = F.b
    if b in ('hips', 'torso', 'ribs'):
        return V((0, p.y, F.cz * 0.03))
    if b in B and b[:2] in ('sh', 'el', 'th', 'kn', 'cl', 'an', 'to', 'ne'):
        h, t = B[b]
        d = t - h
        k = max(0.0, min(1.0, (p - h).dot(d) / max(d.length_squared, 1e-12)))
        return h + d * k
    return None


def retarget(garments, F, skin_tree, real_tree, kd, dom, reach=0.025, fade=0.03, lim=0.03, iters=12):
    """衣物跟著換身體：每個衣物頂點沿骨軸往外的射線上，原本的皮膚在 dp、真人皮膚在 dr，就把頂點挪 dr−dp。
    離原本皮膚越遠（寬鬆的部分）挪得越少；沒有原本皮膚的地方（例如整條腿都在褲管裡）不動。
    位移量在每個部件的網格上平滑幾輪（射線打不到的頂點只跟著鄰居），衣緣才不會一格一格參差。"""
    if skin_tree is None:
        return
    for o in garments:
        me = o.data
        n = len(me.vertices)
        D = [V((0, 0, 0))] * n
        hit = [False] * n
        for v in me.vertices:
            g = V(v.co)
            _c, j, _d = kd.find(g)
            a = axis_point(F, dom[j], g)
            if a is None:
                continue
            r = g - a
            dg = r.length
            if dg < 1e-4:
                continue
            r /= dg
            hp = skin_tree.ray_cast(a + r * 0.001, r, dg + 0.06)
            hr = real_tree.ray_cast(a + r * 0.001, r, dg + 0.06)
            if hp[0] is None or hr[0] is None:
                continue
            k = 1.0 - smooth((dg - hp[3] - reach) / fade)
            D[v.index] = r * (max(-lim, min(lim, hr[3] - hp[3])) * k)
            hit[v.index] = True
        if not any(hit):
            continue
        nb = [[] for _ in range(n)]
        for e in me.edges:
            a, b = e.vertices
            nb[a].append(b)
            nb[b].append(a)
        for _ in range(iters):
            D2 = list(D)
            for i in range(n):
                if nb[i]:
                    m = sum((D[j] for j in nb[i]), V((0, 0, 0))) / len(nb[i])
                    D2[i] = (D[i] + m) * 0.5 if hit[i] else m * 0.9
            D = D2
        for v in me.vertices:
            v.co = V(v.co) + D[v.index]
        me.update()
        if os.environ.get('REAL_DEBUG'):
            mv = [d.length for d in D if d.length > 1e-4]
            print('    %-14s %5d/%5d 頂點  平均 %.1f mm' % (o.name, len(mv), n, 1000 * sum(mv) / max(1, len(mv))))


def conform(ob, garments, F, dom, seam, gap=0.003):
    """被衣物蓋住的皮膚收進衣物內壁：從主導骨的骨軸往外射線，先碰到衣物就把頂點拉回碰撞點內側。手與手指不處理。
    回傳每個頂點是否被衣物蓋住。"""
    covered = [False] * len(ob.data.vertices)
    tree = merged_tree(garments)
    if tree is None:
        return covered
    moved = 0
    for i, v in enumerate(ob.data.vertices):
        if seam[i]:
            continue   # 和頭顱共用的接縫不動
        p = V(v.co)
        # 沿法線往外 8 cm 內碰到衣物：從外面看不到（胯下、腋下這種骨軸射線打不準的地方）
        if dom[i] not in HAND_BONES and tree.ray_cast(p + v.normal * 0.001, v.normal, 0.08)[0] is not None:
            covered[i] = True
        a = axis_point(F, dom[i], p)
        if a is None:
            continue
        r = p - a
        dist = r.length
        if dist < 1e-4:
            continue
        r /= dist
        hit = tree.ray_cast(a + r * 0.001, r, dist + 0.03)
        if hit[0] is None:
            continue
        covered[i] = True
        lim = hit[3] + 0.001 - gap
        if lim < dist and lim > dist * 0.45:
            v.co = a + r * lim
            moved += 1
    print('  真人身體：%d 頂點收進衣物' % moved)
    return covered


def drop_covered(ob, skin_tree, covered, weights, dom, seam, far=0.035):
    """完全被衣物蓋住、原本也沒有皮膚部件的地方（褲管裡的腿、靴子裡的腳）整塊刪掉：少面數，也不會在擺動時穿出來。"""
    me = ob.data
    keepv = [True] * len(me.vertices)
    for i, v in enumerate(me.vertices):
        if not covered[i] or seam[i]:
            continue
        if skin_tree is not None:
            hit = skin_tree.find_nearest(V(v.co), far)
            if hit[0] is not None:
                continue
        keepv[i] = False
    bm = bmesh.new()
    bm.from_mesh(me)
    bm.verts.ensure_lookup_table()
    kill = [f for f in bm.faces if not any(keepv[v.index] for v in f.verts)]
    bmesh.ops.delete(bm, geom=kill, context='FACES_ONLY')
    loose = [v for v in bm.verts if not v.link_faces]
    old = [v.index for v in bm.verts if v.link_faces]
    bmesh.ops.delete(bm, geom=loose, context='VERTS')
    bm.to_mesh(me)
    bm.free()
    me.update()
    print('  真人身體：刪掉 %d 面（被衣物蓋住）' % len(kill))
    return [weights[i] for i in old], [dom[i] for i in old], [covered[i] for i in old], [seam[i] for i in old]


def project(ob, skins, F, kd, dom, center=None, iters=6):
    """從被取代的部件投影顏色：從骨軸往外射線，打到原本部件的哪一塊顏色（pal, mat）就是哪一塊（手、手指沒有骨軸，取最近點）。
    各顏色沿網格邊的中點切開再上色，邊界平滑；ol 取最近的部件。"""
    if not skins:
        return
    vs, fs, keys, ols = [], [], [], []
    for o in skins:
        me = o.data
        FP, FM = me.attributes['fpal'].data, me.attributes['fmat'].data
        OL = me.attributes['ol'].data
        y0 = o.get('proj_y0', -1e9)   # 例如脖子：埋在軀幹裡的那一段不當顏色來源，否則胸口會被塗成一片皮膚
        for f in me.polygons:
            if f.center.y < y0:
                continue
            fs.append(list(range(len(vs), len(vs) + len(f.vertices))))
            vs.extend(V(me.vertices[k].co) for k in f.vertices)
            keys.append((FP[f.index].value, FM[f.index].value))
            ols.append(max(OL[k].value for k in f.vertices))
    tree = BVHTree.FromPolygons(vs, fs)
    cache = {}

    def label(co):
        key = (round(co.x, 5), round(co.y, 5), round(co.z, 5))
        if key in cache:
            return cache[key]
        _c, j, _d = kd.find(co)
        a = center if center is not None else axis_point(F, dom[j], co)
        k = None
        if a is not None:
            r = co - a
            d = r.length
            if d > 1e-4:
                r /= d
                h = tree.ray_cast(a + r * 0.001, r, d + 0.08)
                if h[0] is not None:
                    k = keys[h[2]]
        if k is None:
            h = tree.find_nearest(co)
            k = keys[h[2]] if h[0] is not None else keys[0]
        cache[key] = k
        return k
    me = ob.data
    n = len(me.vertices)
    lab = [label(V(v.co)) for v in me.vertices]
    order = sorted(set(lab), key=lambda k: -lab.count(k))
    if os.environ.get('REAL_DEBUG'):
        print('  投影顏色：', {k: lab.count(k) for k in order})
    # 每種顏色的指示值在網格上平滑幾輪：去掉零星的斑點，交界變成平滑的等值線
    nb = [[] for _ in range(n)]
    for e in me.edges:
        a, b = e.vertices
        nb[a].append(b)
        nb[b].append(a)
    # 小於 60 頂點的色塊島併進周圍的顏色
    seen = [False] * n
    for s0 in range(n):
        if seen[s0]:
            continue
        comp, stack = [], [s0]
        seen[s0] = True
        while stack:
            i = stack.pop()
            comp.append(i)
            for j in nb[i]:
                if not seen[j] and lab[j] == lab[s0]:
                    seen[j] = True
                    stack.append(j)
        if len(comp) < 60:
            cs = set(comp)
            border = [lab[j] for i in comp for j in nb[i] if j not in cs]
            if border:
                m = max(set(border), key=border.count)
                for i in comp:
                    lab[i] = m
    ind = {k: [1.0 if x == k else 0.0 for x in lab] for k in order}
    for k in order:
        x = ind[k]
        for _ in range(iters):
            x = [(x[i] + sum(x[j] for j in nb[i]) / len(nb[i])) * 0.5 if nb[i] else x[i] for i in range(n)]
        ind[k] = x
    kd2 = KDTree(n)
    for i, v in enumerate(me.vertices):
        kd2.insert(v.co, i)
    kd2.balance()

    def val(k, co):
        acc = tot = 0.0
        for _c, i, d in kd2.find_n(co, 3):
            w = 1.0 / (d + 1e-5)
            acc += ind[k][i] * w
            tot += w
        return acc / tot
    kit.tag(ob, order[0][0], mat=order[0][1], grp=G_REAL, ol=1.0)
    for k in order[1:]:
        others = [m for m in order if m != k]
        kit.paint_field(ob, lambda co, k=k, others=others: max(val(m, co) for m in others) - val(k, co), k[0], k[1])
    OL = me.attributes['ol'].data
    for v in me.vertices:
        h = tree.find_nearest(V(v.co))
        if h[0] is not None:
            OL[v.index].value = ols[h[2]]


def weights_for(body, real_lookup, bone_names, W):
    """build_heroes 算出的權重表 W（骨熱，和衣物同一套）中，屬於真人身體（grp＝G_REAL）的頂點：
    露在外面的地方換成底模權重；被衣物蓋住的地方保留骨熱權重（和衣物一起動，扭身時才不會從衣服穿出來），交界漸變。
    骨熱裡的擺動鏈（垂帶、尾巴等）不給身體。"""
    kd, weights, cov, seam = real_lookup
    bidx = {n: i for i, n in enumerate(bone_names)}
    main = {i for n, i in bidx.items() if not n[-1].isdigit()}
    G = body.data.attributes['grp'].data
    n = 0
    for i, v in enumerate(body.data.vertices):
        if G[i].value != G_REAL:
            continue
        _co, j, _d = kd.find(v.co)
        if seam[j] and 'head' in bidx:
            W[i] = [(bidx['head'], 1.0)]
            n += 1
            continue
        c = cov[j]
        acc = {}
        for b, w in weights[j].items():
            if b in bidx:
                acc[bidx[b]] = acc.get(bidx[b], 0.0) + w * (1 - c)
        heat = [(b, w) for b, w in W[i] if b in main]
        ht = sum(w for _, w in heat)
        if ht > 0:
            for b, w in heat:
                acc[b] = acc.get(b, 0.0) + w / ht * c
        ws = sorted(acc.items(), key=lambda bw: -bw[1])[:4]
        tot = sum(w for _, w in ws) or 1.0
        W[i] = [(b, w / tot) for b, w in ws]
        n += 1
    return n
