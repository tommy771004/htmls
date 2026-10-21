# 六名英雄的造型（七龍珠 FighterZ 同人致敬，全部以程式建模，不使用原作素材）。
# 每個 build_xxx 回傳 dict：body（蒙皮部件）、proxy（算骨熱用的封閉主體）、heads{base,ssj}、extras、allow、custom、palette、faceRect。
# 座標＝three.js 空間（+Y 上、面向 +Z、角色左手在 +X）、A 字綁定姿勢（rig.json 的骨頭位置）。
import math

import bmesh
import bpy
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree

import kit
import realbody
from kit import S, V, ang_bump, bump, lerp, smooth

PI = math.pi
FRONT = PI / 2   # loft 的 theta：0＝側向（+X）、pi/2＝前方（+Z）
BACK = -PI / 2

# 綁骨群組 → 允許的骨頭
(G_FREE, G_TORSO, G_ARM_L, G_ARM_R, G_HAND_L, G_HAND_R, G_LEG_L, G_LEG_R, G_FOOT_L, G_FOOT_R,
 G_PELVIS, G_BELT, G_NECK, G_UPPER_L, G_UPPER_R, G_FORE_L, G_FORE_R, G_SHIN_L, G_SHIN_R, G_CHEST) = range(20)
# 肩甲（弗利沙的紫色肩墊）：整塊跟著上臂，不分給胸與鎖骨
G_DELT_L, G_DELT_R = 48, 49
# 第三版骨架：手指每節一個群組（剛性綁到對應的骨頭），左 40～43、右 44～47
G_FA_L, G_FB_L, G_FC_L, G_TB_L, G_FA_R, G_FB_R, G_FC_R, G_TB_R = range(40, 48)
FINGER_BONE = {G_FA_L: 'faL', G_FB_L: 'fbL', G_FC_L: 'fcL', G_TB_L: 'tbL', G_FA_R: 'faR', G_FB_R: 'fbR', G_FC_R: 'fcR', G_TB_R: 'tbR'}
G_CHAIN = 30
G_SKIRT = 31  # 長下襬：骨熱同骨盆群組，再由 skirt_chain_weights 把後片分給擺動鏈
G_RIDE = 32   # 貼在軀幹衣物表面的貼片（悟空的圓章）：build_heroes 最後照最近的 G_TORSO 頂點抄權重，和底下的布一起變形
ALLOW = {
    G_TORSO: {'hips', 'torso', 'ribs', 'clL', 'clR', 'shL', 'shR', 'neck'},
    G_ARM_L: {'torso', 'ribs', 'clL', 'shL', 'elL'}, G_ARM_R: {'torso', 'ribs', 'clR', 'shR', 'elR'},
    G_UPPER_L: {'ribs', 'clL', 'shL'}, G_UPPER_R: {'ribs', 'clR', 'shR'},
    G_FORE_L: {'elL'}, G_FORE_R: {'elR'},
    G_HAND_L: {'wrL'}, G_HAND_R: {'wrR'},
    G_LEG_L: {'hips', 'thL', 'knL'}, G_LEG_R: {'hips', 'thR', 'knR'},
    G_SHIN_L: {'knL'}, G_SHIN_R: {'knR'},
    G_FOOT_L: {'knL', 'anL'}, G_FOOT_R: {'knR', 'anR'},   # 實際權重由 build_heroes 依高度在小腿與腳踝之間分配
    G_PELVIS: {'hips', 'torso', 'thL', 'thR'},
    G_BELT: {'hips', 'torso'},
    G_NECK: {'ribs', 'neck', 'head'},
    G_CHEST: {'torso', 'ribs'},
    G_DELT_L: {'shL'}, G_DELT_R: {'shR'},
    # 貼在真人手臂上的環帶：實際權重由 realbody.hug_weights 照底下皮膚指定，這裡只是骨熱的暫時範圍
    realbody.G_HUG_L: {'clL', 'shL', 'elL', 'wrL'}, realbody.G_HUG_R: {'clR', 'shR', 'elR', 'wrR'},
}
ALLOW[G_SKIRT] = ALLOW[G_PELVIS]
ALLOW[G_RIDE] = ALLOW[G_TORSO]
MIRROR_GRP = {G_ARM_L: G_ARM_R, G_HAND_L: G_HAND_R, G_LEG_L: G_LEG_R, G_FOOT_L: G_FOOT_R, G_UPPER_L: G_UPPER_R, G_FORE_L: G_FORE_R, G_SHIN_L: G_SHIN_R,
              G_FA_L: G_FA_R, G_FB_L: G_FB_R, G_FC_L: G_FC_R, G_TB_L: G_TB_R, G_DELT_L: G_DELT_R, realbody.G_HUG_L: realbody.G_HUG_R}


# FighterZ 式的造型強調（全體英雄共用）：手腳加大、肌肉起伏更深、道服褲更蓬、髮束有稜線（每撮各自分出亮暗面）
FZ = {'hand': 1.16, 'foot': 1.1, 'muscle': 1.35, 'bag': 1.07, 'blouse': 1.1, 'hair_p': 1.22, 'hair_th': 1.22}


# ================================================================ 骨架地標
class Fig:
    def __init__(self, R):
        self.R = R
        self.b = {b['name']: (V(b['head']), V(b['tail'])) for b in R['bones']}
        self.L = R['L']
        self.T = R['torso']
        self.yT = self.L + 0.02
        self.cx, self.cy, self.cz = R['chest']
        self.w = R['waist']
        self.hr = R['hr']
        self.sh = self.b['shL'][0]
        self.da = (self.b['shL'][1] - self.sh).normalized()
        self.up, self.lo = R['upper'], R['lower']
        self.th = self.b['thL'][0]
        self.dl = (self.b['thL'][1] - self.th).normalized()
        self.tl, self.sl = R['thighLen'], R['shinLen']
        self.sole = self.b['knL'][1]
        self.hp = self.b['head'][0]
        self.c = self.hp + V((0, self.hr * 0.9, 0))   # 頭心
        self.k_arm = R['arm'] / 0.068
        self.k_fore = R['fore'] / 0.062
        self.k_leg = R['thigh'] / 0.112
        self.k_shin = R['shin'] / 0.08

    def y(self, u):
        return self.yT + u * self.T

    def arm_pt(self, s):
        return self.sh + self.da * s

    def leg_pt(self, s):
        return self.th + self.dl * s


def mirror(ob):
    o2 = kit.mirror_x(ob)
    g = o2.data.attributes.get('grp')
    if g:
        vals = [0] * len(o2.data.vertices)
        g.data.foreach_get('value', vals)
        g.data.foreach_set('value', [MIRROR_GRP.get(x, x) for x in vals])
    if 'paint_id' in ob:
        o2['paint_mx'] = 1 - ob.get('paint_mx', 0)   # realbody.paint() 的色塊場：鏡射的部件要把 x 反過來算
    return o2


def limb(name, h, d, stations, n=10, cap0='pole', cap1='pole', front=V((0, 0, 1)), side=V((1, 0, 0))):
    """沿方向 d 從 h 出發放樣：stations＝[(s, a, b, mod, p)]，s 為沿骨距離。"""
    sts = []
    for st in stations:
        s, a, b = st[0], st[1], st[2]
        mod = st[3] if len(st) > 3 else None
        p = st[4] if len(st) > 4 else 2.0
        sts.append(S(h + d * s, a, b, p=p, mod=mod))
    return kit.loft(name, sts, n=n, cap0=cap0, cap1=cap1, front=front, side=side)


def path_loft(name, pts, radii, n=8, p=2.0, front=V((0, 0, 1)), side=V((1, 0, 0)), cap0='pole', cap1='pole', flat=1.0):
    sts = [S(c, r, r * flat, p=p) for c, r in zip(pts, radii)]
    return kit.loft(name, sts, n=n, cap0=cap0, cap1=cap1, front=front, side=side)


def bezier(p0, p1, p2, k=8):
    return [p0 * (1 - t) ** 2 + p1 * 2 * t * (1 - t) + p2 * t * t for t in [i / (k - 1) for i in range(k)]]


def tree_of(ob):
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    t = BVHTree.FromBMesh(bm)
    bm.free()
    return t


def mods(*fs):
    fs = [f for f in fs if f]
    return (lambda th: math.prod(f(th) for f in fs)) if fs else None


# ================================================================ 軀幹
# 以 u＝(y−yT)/T 描述的男性英雄軀幹（皮膚層）：半寬相對胸寬 cx（腰段用腰寬 w）、半深相對胸深 cz
TORSO_ROWS = [  # u, (基準, a 倍率), b(×cz), z(×cz)
    (0.06, ('w', 1.1), 0.81, 0.0),
    (0.21, ('w', 1.13), 0.82, 0.02),
    (0.38, ('c', 0.86), 0.87, 0.05),
    (0.54, ('c', 0.96), 0.95, 0.07),
    (0.67, ('c', 1.04), 1.0, 0.08),
    (0.8, ('c', 1.1), 0.96, 0.05),
    (0.9, ('c', 1.0), 0.81, -0.02),
    (0.96, ('c', 0.84), 0.68, -0.04),
    (1.02, ('c', 0.58), 0.55, -0.04),   # 斜方肌：從肩頭往脖子斜上去，不是一條水平的平台
    (1.07, ('c', 0.34), 0.44, -0.02),
]


def torso_rows(F, e=0.0, u0=None, u1=None, pec=0.05, lat=0.04, p=2.3, bust=0.0, rows=TORSO_ROWS, scale_a=1.0):
    sts = []
    for u, (kind, fa), fb, fz in rows:
        if (u0 is not None and u < u0) or (u1 is not None and u > u1):
            continue
        ee = e(u) if callable(e) else e
        a = (F.w if kind == 'w' else F.cx) * fa * scale_a + ee
        b = F.cz * fb + ee

        def mod(th, t=u):
            m = 1.0
            m += pec * (ang_bump(th, FRONT - 0.55, 0.5) + ang_bump(th, FRONT + 0.55, 0.5)) * bump(t, 0.68, 0.2)
            m += lat * (ang_bump(th, BACK - 0.7, 0.6) + ang_bump(th, BACK + 0.7, 0.6)) * bump(t, 0.55, 0.3)
            m += bust * (ang_bump(th, FRONT - 0.5, 0.55) + ang_bump(th, FRONT + 0.5, 0.55)) * bump(t, 0.66, 0.16)
            return m
        sts.append(S(V((0, F.y(u), F.cz * fz)), a, b, p=p, mod=mod))
    return sts


def neck(F, pal, r=0.062, top=None):
    y0 = F.y(0.86)
    y1 = top if top is not None else F.hp.y + F.hr * 0.25
    o = limb('neck', V((0, y0, -0.006)), V((0, 1, 0)), [(0, r * 1.05, r), ((y1 - y0) * 0.45, r * 0.94, r * 0.9), ((y1 - y0) * 0.85, r * 0.88, r * 0.86), (y1 - y0, r * 0.65, r * 0.65)], n=12)
    o = kit.subsurf(o, 1)
    o['proj_y0'] = F.y(1.0)
    return realbody.skin(kit.tag(o, pal, mat=4, grp=G_NECK))


# ================================================================ 四肢
def arm_skin(F, pal, muscle=1.0, k=1.0, s0=-0.07, name='armL', grp=G_ARM_L, mat=4):
    """肩到手腕的手臂（左）：三角肌、二頭／三頭肌、前臂肌群、扁的手腕。"""
    up, lo = F.up, F.lo
    ka, kf = F.k_arm * k, F.k_fore * k
    mu = muscle * FZ['muscle']
    # 肌肉起伏參考 GK 雕像：二頭、三頭、三角肌與前臂肌群都明顯隆起。
    # FighterZ 式加強只加在二頭、三頭：三角肌在袖子底下、前臂在護腕底下，加粗會從衣物裡穿出來
    bic = lambda th: 1 + 0.16 * mu * ang_bump(th, FRONT, 0.95)
    tri = lambda th: 1 + 0.12 * mu * ang_bump(th, BACK, 1.05)
    delt = lambda th: 1 + 0.11 * muscle * ang_bump(th, 0, 1.3)
    fore = lambda th: 1 + 0.13 * muscle * ang_bump(th, 0.4, 0.9)
    st = [
        (s0, 0.074 * ka, 0.072 * ka),
        (0.0, 0.084 * ka, 0.082 * ka, delt),
        (0.06, 0.088 * ka, 0.084 * ka, delt),
        (0.098, 0.071 * ka, 0.074 * ka),                 # 三角肌與上臂之間的凹線，避免整隻手臂像吹氣球
        (0.14, 0.077 * ka, 0.082 * ka, mods(bic, tri)),
        (0.2, 0.07 * ka, 0.077 * ka, mods(bic, tri)),
        (up - 0.045, 0.06 * ka, 0.063 * ka),
        (up, 0.056 * ka, 0.058 * ka),
        (up + 0.05, 0.065 * kf, 0.06 * kf, fore),
        (up + 0.13, 0.059 * kf, 0.053 * kf, fore),
        (up + 0.21, 0.049 * kf, 0.042 * kf),
        (up + lo - 0.01, 0.043 * kf, 0.034 * kf),
    ]
    o = limb(name, F.sh, F.da, st, n=14)
    o = kit.subsurf(o, 1)
    kit.tag(o, pal, mat=mat, grp=grp)
    # 手腕端外框漸細：前臂的反向殼比手掌厚，會從手上穿出黑塊
    se = up + lo
    kit.paint_ol(o, lambda co: 1.0 - smooth(((co - F.sh).dot(F.da) - (se - 0.07)) / 0.05))
    return realbody.skin(o)


def place_left_hand(F, ob):
    """把手的局部座標（+Y 指尖、+X 手背、+Z 拇指側）放到左前臂末端。"""
    d = F.da
    z = V((0, 0, 1))
    x = z.cross(d).normalized()
    M = Matrix(((x.x, d.x, z.x, 0), (x.y, d.y, z.y, 0), (x.z, d.z, z.z, 0), (0, 0, 0, 1)))
    wrist = F.arm_pt(F.up + F.lo - 0.005)
    kit.transform(ob, Matrix.Translation(wrist) @ M)
    kit.recalc_normals(ob)
    return ob


def fist(F, pal, mat=4, scale=1.0, glove=False):
    """手：以攤平的手建模（綁定姿勢），四指每節一段直的膠囊、各自剛性綁到 fa／fb／fc，拇指綁到 tb；
    遊戲裡由骨頭彎成握拳、手刀或張掌。幾何參數來自 models.js 的 HAND_GEO（rig.json 的 handGeo），scale 參數已改由 PROPS.handK 決定。"""
    H = F.R['handGeo']
    k = H['k']
    parts = []
    palm = kit.box_cage('palm', 0.052 * k, 0.086 * k, 0.09 * k, cuts=(1, 1, 1))
    kit.deform(palm, lambda p: V((p.x * (1 - 0.15 * (p.y / (0.043 * k)) ** 2), p.y + 0.042 * k, p.z * (1 - 0.1 * max(0, -p.y) / (0.043 * k)))))
    palm = kit.subsurf(palm, 2)
    kit.tag(palm, pal, mat=mat, grp=G_HAND_L, ol=0.3)
    parts.append(palm)
    kx, ky, L = H['kx'] * k, H['ky'] * k, [x * k for x in H['L']]
    joints = [ky, ky + L[0], ky + L[0] + L[1], ky + L[0] + L[1] + L[2]]
    for i, (fz, fr) in enumerate(zip(H['fz'], H['fr'])):
        z = fz * k
        rr = fr * k * (1.12 if glove else 1)
        for j, grp in enumerate((G_FA_L, G_FB_L, G_FC_L)):
            # 每節往兩端多伸出半個半徑，彎到 90 度時關節處仍然接得起來（像球關節）
            y0 = joints[j] - (rr * 0.55 if j else rr * 0.9)
            y1 = joints[j + 1] + (rr * 0.5 if j < 2 else 0)
            r0, r1 = rr * (1.02 - 0.03 * j), rr * (0.98 - 0.05 * j) * (0.9 if j == 2 else 1)
            f = path_loft('f%d%d' % (i, j), [V((kx, y0, z)), V((kx, (y0 + y1) * 0.5, z)), V((kx, y1, z))], [r0, (r0 + r1) * 0.52, r1], n=8, front=V((0, 0, 1)), side=V((1, 0, 0)))
            f = kit.subsurf(f, 1)
            kit.tag(f, pal, mat=mat, grp=grp, ol=0.3)
            parts.append(f)
    tb = H['thumb']
    b0 = V(tb['base']) * k
    td = V(tb['dir']).normalized()
    tl0, tl1 = tb['L'][0] * k, tb['L'][1] * k
    pts = [b0 - td * 0.006 * k, b0 + td * tl0 * 0.5, b0 + td * tl0, b0 + td * (tl0 + tl1 * 0.55), b0 + td * (tl0 + tl1)]
    rs = [tb['r'][0] * k * 1.05, tb['r'][0] * k, tb['r'][1] * k * 1.02, tb['r'][1] * k, tb['r'][1] * k * 0.8]
    if glove:
        rs = [r * 1.1 for r in rs]
    t = path_loft('th', pts, rs, n=8, front=V((1, 0, 0)), side=V((0, 0, 1)))
    t = kit.subsurf(t, 1)
    kit.tag(t, pal, mat=mat, grp=G_TB_L, ol=0.3)
    parts.append(t)
    for o in parts:
        # 掌心側（局部 −X）不描外框：握拳時四指的掌心面貼著手掌，反向殼會在指縫露出黑點
        kit.paint_ol(o, lambda co: 0.0 if co.x < kx - 0.004 * k else None)
    hand = kit.join(parts, 'handL')
    return realbody.skin(place_left_hand(F, hand))


def armhole(F, r, s0=-0.03, s1=0.3):
    """袖孔的場（＜0 在孔內）：離上臂骨軸（s0..s1 段，左右對稱）r 以內。"""
    def f(co):
        p = V((abs(co.x), co.y, co.z))
        s = max(s0, min(s1, (p - F.sh).dot(F.da)))
        return (p - F.arm_pt(s)).length - r
    return f


def arm_region(F, s1, inset=0.015, rise=0.016, r=0.1, both=True):
    """真人身體上「手臂」的場（＜0 在手臂上，左右對稱）：給 realbody.paint() 在底模上切袖孔、袖子花紋用。
    底模的手臂垂成 A 字，肩下的斷面前後很厚（三角肌與腋窩的皺褶），離骨軸的距離分不開手臂和腋下的軀幹；
    量水平斷面，軀幹側緣在 |x|≈sh.x−1.5 cm，所以用 |x| 的鉛直切面（從腋窩往肩頂外移 rise 到接近肩關節），
    再限制離手臂骨軸（s 夾在 0..s1）r 以內，免得骨盆、大腿這些 |x| 也大的地方被當成手臂。
    both=False 只算左臂（＋x）：登錄在會被鏡射的手臂部件上時要用這個，否則鏡射那一份的色塊會連另一隻手臂一起蓋掉。"""
    def f(co):
        p = V((abs(co.x), co.y, co.z)) if both else V(co)
        s = max(0.0, min(s1, (p - F.sh).dot(F.da)))
        cut = F.sh.x - inset + rise * smooth((co.y - F.sh.y + 0.07) / 0.1)
        return max(cut - p.x, (p - F.arm_pt(s)).length - r)
    return f


def cut_armholes(ob, F, r, s0=-0.03, s1=0.3):
    """在軀幹的殼（胸甲、外套，加厚之前）挖袖孔：沿等值線切開再刪掉孔內的面，孔緣平滑。
    軀幹的殼一路包到肩關節外時，手臂（或袖子）往前抬、往內收就會從殼的側面穿出來，或是殼從袖子裡穿出來。"""
    f = armhole(F, r, s0, s1)
    kit.iso_cut(ob, f)
    return kit.cut(ob, lambda co, n: f(co) < 0)


def band(name, h, d, s0, s1, r0, r1, pal, grp, thick=0.008, n=14, rb=None, front=V((0, 0, 1)), side=V((1, 0, 0)), mat=0, ol=0.8, bulge=1.02):
    """套在肢體上的環帶（護腕、靴口、腰帶）：開口短管＋厚度。"""
    rb = rb or 1.0
    o = limb(name, h, d, [(s0, r0, r0 * rb), ((s0 + s1) / 2, (r0 + r1) / 2 * bulge, (r0 + r1) / 2 * bulge * rb), (s1, r1, r1 * rb)], n=n, cap0=None, cap1=None, front=front, side=side)
    o = kit.subsurf(o, 2, solidify=thick)
    return kit.tag(o, pal, mat=mat, grp=grp, ol=ol)


def sleeve(F, pal, s1=0.11, r=0.1, flare=1.0, grp=G_ARM_L, thick=0.008, name='sleeveL', s0=-0.05):
    o = limb(name, F.sh, F.da, [(s0, r * 0.98, r * 0.96), (0.03, r, r * 0.98), (s1, r * 0.94 * flare, r * 0.94 * flare)], n=14, cap0=None, cap1=None)
    o = kit.subsurf(o, 2, solidify=thick)
    return kit.tag(o, pal, grp=grp, ol=0.8)


def pelvis(F, pal, e=0.0, top_u=0.15, grp=G_PELVIS, p=2.2, closed=False):
    """骨盆（褲頭到襠）。"""
    hw = F.R['hip']
    o = kit.loft('pelvis', [
        S(V((0, F.y(top_u), 0.0)), F.w * 1.12 + e, F.cz * 0.82 + e, p=p),
        S(V((0, F.L + 0.05, -0.004)), hw * 1.47 + e, F.cz * 0.88 + e, p=p),
        S(V((0, F.L - 0.02, -0.008)), hw * 1.46 + e, F.cz * 0.85 + e, p=p),
        S(V((0, F.L - 0.08, -0.006)), hw * 1.05 + e, F.cz * 0.7 + e, p=2.0),
    ], n=18, cap0='pole' if closed else None, cap1='pole')
    o = kit.subsurf(o, 1)
    return kit.tag(o, pal, grp=grp)


def leg_tube(F, pal, rows, n=14, name='legL', grp=G_LEG_L, cap1='pole', mat=0):
    """rows：[(s, a, b, mod)]，a、b 已含倍率。"""
    o = limb(name, F.th, F.dl, rows, n=n, cap1=cap1)
    o = kit.subsurf(o, 1)
    return kit.tag(o, pal, grp=grp, mat=mat)


def baggy_leg(F, pal, bag=1.0, blouse=1.0, s_end=None):
    """燈籠褲管（道服）：大腿寬、膝下鼓起、收進靴口。"""
    tl = F.tl
    kl = F.k_leg
    s_end = s_end if s_end is not None else tl + 0.25
    if bag > 1.0:
        bag *= FZ['bag']
    if blouse > 1.0:
        blouse *= FZ['blouse']
    bg = lambda th: 1 + 0.08 * bag * ang_bump(th, FRONT, 1.2) + 0.045 * bag * ang_bump(th, 0, 1.0)
    return leg_tube(F, pal, [
        (-0.07, 0.125 * kl, 0.125 * kl),
        (0.02, 0.13 * kl * bag, 0.134 * kl * bag),
        (0.14, 0.125 * kl * bag, 0.128 * kl * bag, bg),
        (0.28, 0.108 * kl * bag, 0.112 * kl * bag, bg),
        (tl - 0.02, 0.094 * kl * bag, 0.098 * kl * bag),
        (tl + 0.09, 0.103 * kl * blouse, 0.106 * kl * blouse, bg),
        (tl + 0.165, 0.106 * kl * blouse, 0.106 * kl * blouse, bg),
        (s_end - 0.035, 0.088 * kl, 0.09 * kl),
        (s_end, 0.062 * kl, 0.064 * kl),
    ])


def boot(F, pal, top_s, r_top, pal_sole=None, toe=1.0, name='bootL', grp=G_FOOT_L, p_foot=2.7, toe_len=0.0):
    """靴筒（沿小腿）＋腳掌（朝前）。回傳 [筒, 腳]。"""
    tl, sl = F.tl, F.sl
    ks = F.k_shin
    r_top *= F.k_shin
    shaft = limb(name, F.th, F.dl, [
        (top_s - 0.01, r_top * 0.95, r_top * 0.95),
        (top_s + 0.03, r_top, r_top * 1.03),
        (top_s + 0.12, r_top * 0.9, r_top * 0.95),
        (tl + sl - 0.075, 0.057 * ks, 0.063 * ks),
        (tl + sl - 0.03, 0.06 * ks, 0.07 * ks),
    ], n=14, cap0='pole', cap1='pole')
    shaft = kit.subsurf(shaft, 1)
    kit.tag(shaft, pal, grp=grp)
    fx = F.sole.x + 0.004
    s = ks * 1.05 * FZ['foot']
    tz = toe_len
    foot = kit.loft('foot', [
        S(V((fx, 0.06 * s, -0.078 * s)), 0.046 * s, 0.05 * s, p=p_foot),
        S(V((fx, 0.066 * s, -0.02 * s)), 0.058 * s, 0.064 * s, p=p_foot),
        S(V((fx + 0.004, 0.058 * s, 0.062 * s)), 0.06 * s * toe, 0.052 * s, p=p_foot),
        S(V((fx + 0.006, 0.046 * s, 0.135 * s + tz * 0.5)), 0.054 * s * toe, 0.04 * s, p=p_foot),
        S(V((fx + 0.006, 0.036 * s, 0.18 * s + tz)), 0.042 * s * toe, 0.031 * s, p=2.5),
    ], n=14, front=V((0, 1, 0)), side=V((1, 0, 0)))
    kit.deform(foot, lambda p: V((p.x, max(p.y, 0.012), p.z)))
    foot = kit.subsurf(foot, 1)
    kit.tag(foot, pal, grp=grp)
    if pal_sole is not None:
        kit.paint_field(foot, lambda co: co.y - 0.021, pal_sole, 0)
    return [shaft, foot]


# ================================================================ 頭
def pointed_ear_pt(c, hr, sx, p, scale=1.0):
    """尖耳（比克，參考 SHF 02 正側背三視圖）：葉片形，耳根貼在頭側眼睛高度，耳尖往外上方約 50°、略往後，長約 0.75 hr。
    葉面朝前外側（法線偏外 35°）：正面與俯視的遊戲鏡頭看到的是整片三角形的耳朵，側面只看到斜斜的一片；
    耳根寬、往耳尖收尖，兩側邊緣往前捲一點成淺碗。舊版是葉面朝正外側的扁橢球（長 1.1 hr），側面看像一支船槳、正面只剩一條線。
    p：quad_sphere 的點（各軸 −1..1）：p.y 沿耳長、p.x 沿葉寬、p.z 是厚度。"""
    u = (p.y + 1) * 0.5
    L = hr * 0.75 * scale
    ld = V((sx * 0.62, 0.74, -0.26)).normalized()           # 耳長方向：外、上、略後
    nrm = V((sx * 0.57, 0.0, 0.82)).normalized()            # 葉面法線：朝前外
    wd = nrm.cross(ld).normalized()                         # 葉寬方向
    root = c + V((sx * hr * 0.66, -hr * 0.1, -hr * 0.1))
    hw = hr * 0.2 * (1 - u) ** 0.8 * (0.62 + 0.38 * smooth(u / 0.3))   # 耳根略收、中前段最寬、耳尖收成尖
    th = hr * (0.045 * (1 - u) + 0.01)                      # 耳根厚、耳尖薄
    q = root + ld * (u * L) + V((0, 0, -hr * 0.08 * u * u))   # 耳尖再往後彎一點
    return q + wd * (p.x * hw) + nrm * (p.z * th + hr * 0.05 * p.x * p.x * (1 - u))


def anime_head(name, F, pal_skin, ears=True, jaw=1.0, chin=1.0, cheek=1.0, ear_scale=1.0, pointed_ears=False, cranium=(0.8, 0.9, 0.88), nose=1.0, brow=0.0, extra=(), face_len=1.0, square=0.0, egg=0.0, occ=0.0, taper=0.0, relax=0, muzzle=0.0, soft=0, recede=0.0):
    """動畫臉：顱骨＋往前下收尖的下顎＋小鼻子＋耳朵，體素聯集後平滑。
    face_len 拉長／縮短下半臉；square＞0 讓下顎角更方（下顎斷面的超橢圓指數變大）。
    egg（只在換成底模的頭時有用）：眼線以上的顱骨往橢球靠攏的程度，0＝照底模原本偏方的頭頂，1＝光滑的蛋形頭殼（弗利沙）。
    occ（只在換成底模的頭時有用）：後腦勺往後鼓的程度（眼線下 0.3 hr 附近的後腦往後推，頸部接縫不動），0＝照底模。
    taper（只在換成底模的頭時有用）：臉的前半部從眼睛到下巴直線收窄成尖下巴的程度（0＝照底模的 S 形收窄，1＝完全直線）。
    relax（只在換成底模的頭時有用）：眼線以下的臉頰與下顎 Taubin 平滑幾輪（0＝不平滑，保留底模的真人五官起伏）。
    muzzle（只在換成底模的頭時有用）：底模的人中與上下唇一起壓平的程度（0＝只照 nose 壓鼻子，1＝鼻子到下巴之間鬆成一片光滑的面）。
    soft（只在換成底模的頭時有用）：整顆頭的法線在網格上平滑幾輪（0＝不平滑；頸部接縫那圈不動，之後和身體對齊）。
    recede（只在換成底模的頭時有用）：下半臉往頭心收的比例（下巴收最多；0＝照底模垂直的臉）。"""
    c, hr = F.c, F.hr
    face_len *= 0.86  # 照設定圖：眼睛到下巴的距離較短，下巴不要拉得太尖太長
    parts = []
    cr = kit.quad_sphere(name + '_cr', 1.0, cuts=8)
    kx, ky, kz = cranium
    kit.deform(cr, lambda p: c + V((p.x * hr * kx, p.y * hr * ky + hr * 0.08, p.z * hr * kz - hr * 0.04)))
    parts.append(cr)
    sts = [
        S(c + V((0, -hr * 0.05, hr * 0.06)), hr * 0.76 * cheek, hr * 0.7, p=2.2),
        S(c + V((0, -hr * 0.38 * face_len, hr * 0.16)), hr * 0.66 * cheek * jaw, hr * 0.6, p=2.2 + square),
        S(c + V((0, -hr * 0.62 * face_len, hr * 0.28)), hr * 0.46 * jaw * (1 + square * 0.25), hr * 0.46, p=2.0 + square * 1.5),
        S(c + V((0, -hr * 0.82 * face_len, hr * 0.42)), hr * 0.24 * chin * (1 + square * 0.4), hr * 0.3, p=2.0 + square),
        S(c + V((0, -hr * 0.9 * face_len, hr * 0.5)), hr * 0.1 * chin * (1 + square * 0.6), hr * 0.14, p=2.0),
    ]
    jw = kit.loft(name + '_jaw', sts, n=12, cap0='pole', cap1='pole')
    parts.append(kit.subsurf(jw, 1))
    if nose:
        ns = path_loft(name + '_nose', [c + V((0, -hr * 0.12, hr * 0.78)), c + V((0, -hr * 0.34, hr * (0.84 + 0.05 * nose))), c + V((0, -hr * 0.41, hr * 0.82))],
                       [hr * 0.035, hr * 0.045 * nose, hr * 0.02], n=6, front=V((0, 0, 1)), side=V((1, 0, 0)))
        parts.append(kit.subsurf(ns, 1))
    if brow:
        br = kit.quad_sphere(name + '_brow', 1.0, cuts=4)
        kit.deform(br, lambda p: c + V((p.x * hr * 0.55, hr * 0.2 + p.y * hr * 0.1, hr * 0.62 + p.z * hr * 0.2 * brow)))
        parts.append(br)
    if ears:
        for sx in (1, -1):
            e = kit.quad_sphere(name + '_ear', 1.0, cuts=3)
            if pointed_ears:
                kit.deform(e, lambda p, sx=sx: pointed_ear_pt(c, hr, sx, p, ear_scale))
            else:
                kit.deform(e, lambda p, sx=sx: c + V((sx * (hr * 0.78 + p.x * hr * 0.1), -hr * 0.12 + p.y * hr * 0.2 * ear_scale, -hr * 0.04 + p.z * hr * 0.1)))
            parts.append(e)
    if realbody.head_enabled(F.R.get('id')):
        # 換成底模的頭時用得到的參數；尖耳與額外部件（比克的額頭隆起）另外複製一份，之後接到底模的頭上
        keep = [kit.duplicate(o, name + '_keep') for o in extra]
        for o, k in zip(extra, keep):
            if 'hole' in o:
                k['hole'] = list(o['hole'])   # duplicate 不複製物件屬性
        if ears and pointed_ears:
            for o in parts[-2:]:
                e = kit.duplicate(o, name + '_ear')
                e['ear'] = 1
                keep.append(e)
        hargs = {'cranium': cranium, 'face_len': face_len, 'jaw': jaw, 'cheek': cheek, 'chin': chin, 'nose': nose, 'egg': egg, 'occ': occ, 'taper': taper, 'relax': relax,
                 'muzzle': muzzle, 'soft': soft, 'recede': recede, 'ears': ears and not pointed_ears, 'pal': pal_skin, 'keep': keep}
    head = kit.join(parts + list(extra), name)
    if realbody.head_enabled(F.R.get('id')):
        realbody.HEAD_ARGS[head.name] = hargs
    m = head.modifiers.new('rm', 'REMESH')
    m.mode = 'VOXEL'
    m.voxel_size = hr * 0.02
    kit.bake(head)
    sm = head.modifiers.new('sm', 'SMOOTH')
    sm.factor = 0.8
    sm.iterations = 6
    kit.bake(head)
    kit.decimate(head, 3600)
    kit.tag(head, pal_skin, mat=4, grp=G_FREE, ol=0.55)
    # 鼻子附近外框變細，避免鼻頭被描成一圈
    kit.paint_ol(head, lambda co: 0.12 if (co - (c + V((0, -hr * 0.3, hr * 0.85)))).length < hr * 0.22 else None)
    return head


def hair_cap(name, F, pal, scale=1.07, hairline=0.3, temple=0.0, nape=-0.55, side_cut=True, mat=1, thick=0.08, peak=None, fit=None, side_y=-0.05):
    """髮帽：顱骨放大一點的殼，前額依 hairline 開口。
    peak＝(深度, 半寬[, 指數])：額頭中央的美人尖（貝吉塔的 M 字髮際）。指數 1 是直邊的寬 V 字，越大尖端越細。有 peak 時前額開口改沿等值線切開，
    髮際線是平滑的曲線；只刪頂點的話，球面網格約 0.15 hr 一格，V 字邊緣會切成一階一階的鋸齒。
    fit＝間隙（公尺）：換成底模的頭時，埋進頭顱的部分沿頭心往外推到貼著表面（底模的額頭比動畫頭顱高、往前凸，
    髮帽的前緣整段埋在額頭裡看不到，只剩外框的反殼從皮膚裡穿出幾道黑線）。由 finish() 在換好頭之後處理。
    side_y：side_cut 在頭側（耳朵附近）切掉的高度上限（單位球的 y）；預設 −0.05 只開到耳垂，悟空加大到露出整個耳朵。"""
    c, hr = F.c, F.hr
    # 有美人尖時網格加密一倍：尖端只有 0.2 hr 寬，10 等分的球面切出來是一塊平底的方塊
    cap = kit.quad_sphere(name, 1.0, cuts=20 if peak is not None else 10)
    if peak is not None:
        pd, pw = peak[:2]
        pe = peak[2] if len(peak) > 2 else 1.3

        def front(p):   # ＞0：前額開口（要刪掉的地方）
            hl = hairline + temple * abs(p.x) - pd * max(0.0, 1.0 - abs(p.x) / pw) ** pe
            return min(p.z - 0.2, hl - p.y)
        kit.iso_cut(cap, front)
        kit.cut(cap, lambda co, n: front(co) > 0)
    bm = bmesh.new()
    bm.from_mesh(cap.data)
    kill = []
    for v in bm.verts:
        x, y, z = v.co
        hl = hairline + temple * abs(x)
        if (peak is None and z > 0.2 and y < hl) or y < nape or (side_cut and abs(x) > 0.7 and y < side_y and z > -0.35):
            kill.append(v)
    bmesh.ops.delete(bm, geom=kill, context='VERTS')
    bm.to_mesh(cap.data)
    bm.free()
    kit.deform(cap, lambda p: c + V((p.x * hr * 0.8 * scale, p.y * hr * 0.9 * scale + hr * 0.08, p.z * hr * 0.88 * scale - hr * 0.04)))
    cap = kit.subsurf(cap, 1, solidify=hr * thick)
    if fit is not None:
        cap['fit_skull'] = (fit, hr * thick)
    cap = kit.tag(cap, pal, mat=mat, grp=G_FREE, ol=0.9)
    if peak is not None:
        # 髮際線不描外框：髮帽有 0.08 hr 厚，前緣的切面加上外框的反殼，在額頭上是一條黑線貼著一條黑線（雙層描邊），
        # 太陽穴兩側的切口（z＝0.2 的鉛直切面）也各拉出一條往下的細黑線，看起來像裂痕。髮際線靠黑髮與膚色的色差就清楚了，
        # 外框倍率從開口邊往髮帽裡 0.15（單位球）漸變回原值；頭頂、後腦的輪廓照舊描
        def unit(co):
            return V(((co.x - c.x) / (hr * 0.8 * scale), (co.y - c.y - hr * 0.08) / (hr * 0.9 * scale), (co.z - c.z + hr * 0.04) / (hr * 0.88 * scale)))
        kit.paint_ol(cap, lambda co: 0.9 * smooth(-front(unit(co)) / 0.15))
    return cap


def bob_cap(name, F, pal, hairline=0.45, length=0.85, flare=0.22, scale=1.12, part=0.0, mat=1, thick=0.09):
    """鮑伯頭：一整片包住頭的髮殼，往下延伸到下巴（length，單位 hr），下緣往外蓬（flare）；前方挖出臉的開口。"""
    c, hr = F.c, F.hr
    cap = kit.quad_sphere(name, 1.0, cuts=12)
    # 臉的開口：原本逐頂點刪（z＞0.18 且在髮際斜線下、或 z＞0.55 且在髮際上 0.15 下），開口邊緣沿四邊形格子成階梯，
    # 兩頰階梯的最下一格還會留下一片四個頂點都沒被刪、四周的面全刪掉的孤立方塊，掛在下巴旁像一個浮空的耳環（18號）。
    # 改成同一個區域的場（＜0 在開口裡）沿等值線切開再刪面，開口邊緣是平滑的直線，也不會留下孤島
    def opening(co):
        return min(max(0.18 - co.z, co.y - (hairline - 0.25 * abs(co.x - part))), max(0.55 - co.z, co.y - (hairline + 0.15)))
    kit.iso_cut(cap, opening)
    kit.cut(cap, lambda co, n: opening(co) < 0)

    def dfm(p):
        y = p.y if p.y > 0 else p.y * (1 + length)       # 下半往下拉長
        k = 1 + flare * smooth(-p.y / 1.0)                 # 越往下越蓬
        return c + V((p.x * hr * 0.82 * scale * k, y * hr * 0.9 * scale + hr * 0.1, p.z * hr * 0.9 * scale * k - hr * 0.06))
    kit.deform(cap, dfm)
    cap = kit.subsurf(cap, 1, solidify=hr * thick)
    return kit.tag(cap, pal, mat=mat, grp=G_FREE, ol=0.9)


def clump(name, F, root, tip, width, thick, bend=(0, 0, 0), n=8, segs=8, p=FZ['hair_p'], taper=1.0, twist=0.0):
    """一撮髮束（頭心相對、單位 hr）：根部貼著頭皮、片狀、尖端收成一點。"""
    c, hr = F.c, F.hr
    r0 = V(root)
    rd = r0.normalized()
    p0 = c + r0 * hr
    p2 = c + V(tip) * hr
    p1 = (p0 + p2) * 0.5 + V(bend) * hr
    pts = bezier(p0, p1, p2, segs)
    sts = []
    for i, q in enumerate(pts):
        t = i / (segs - 1)
        w = width * hr * (1 - t) ** (0.85 * taper) + 0.0012
        th = thick * hr * (1 - t) ** 0.6 + 0.0012
        sts.append(S(q, w, th, p=p, tw=twist * t))
    seg_dir = (p2 - p0).normalized()
    side = seg_dir.cross(rd)
    if side.length < 1e-4:
        side = V((1, 0, 0))
    o = kit.loft(name, sts, n=n, cap0='pole', cap1='pole', front=rd, side=side.normalized(), cap_len=0.002)
    return kit.subsurf(o, 1)


HAIR_GROW, HAIR_W = 1.15, 1.08  # GK 式的大份量頭髮（頭縮小了，髮束反而放大）


def hair(F, pal, clumps, mat=1, ol=0.85, grow=1.0, wmul=1.0):
    out = []
    grow *= HAIR_GROW
    for i, cl in enumerate(clumps):
        root, tip, w = cl[0], cl[1], cl[2] * HAIR_W * wmul
        if grow != 1.0:
            tip = tuple(r + (t - r) * grow for r, t in zip(root, tip))
        th = (cl[3] * HAIR_W * wmul if len(cl) > 3 else w * 0.45) * FZ['hair_th']
        bend = cl[4] if len(cl) > 4 else (0, 0, 0)
        taper = cl[5] if len(cl) > 5 else 1.0  # ＜1：髮尖較鈍、較粗
        o = clump('cl%d' % i, F, root, tip, w, th, bend=bend, taper=taper)
        out.append(kit.tag(o, pal, mat=mat, grp=G_FREE, ol=ol))
    return out


def mx(cl):
    """鏡射一撮髮的定義（x 取負）。"""
    f = lambda v: (-v[0], v[1], v[2])
    out = [f(cl[0]), f(cl[1])] + list(cl[2:4])
    if len(cl) > 4:
        out.append(f(cl[4]))
    if len(cl) > 5:
        out.append(cl[5])
    return tuple(out)


def sym(lst):
    out = []
    for cl in lst:
        out.append(cl)
        if abs(cl[0][0]) > 0.02:
            out.append(mx(cl))
    return out


def is_closed(ob):
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    ok = all(len(e.link_faces) == 2 for e in bm.edges)
    bm.free()
    return ok


def core_proxy(F):
    """算骨熱用的封閉軀幹與骨盆替身（開口的衣服殼會讓骨熱亂掉）。"""
    tor = kit.loft('px_torso', torso_rows(F, e=0.01, u0=0.06, pec=0.03, lat=0.02), n=16, cap0='pole', cap1='pole')
    tor = kit.subsurf(tor, 1)
    pel = pelvis(F, 0, e=0.01, closed=True)
    return [tor, pel]


def finish(F, P, body, proxy, heads, extras=None, custom=None):
    proxy = [p for p in proxy if is_closed(p)] + core_proxy(F)
    real = None
    skull = None
    hargs = realbody.HEAD_ARGS.get(heads['base'][0].name) if realbody.head_enabled(F.R.get('id')) else None
    if realbody.enabled(F.R.get('id')) and any(o.get('skin') for o in body):
        ob, lookup, body, skull = realbody.make(F, body, hargs=hargs)
        real = (ob, lookup)
    # 頭部橫向比例（照參考圖量的臉寬）：頭顱、髮型與頭上配件一起以頭心為軸縮放
    hx = F.R.get('hx', 1.0)
    if hx != 1.0:
        c = F.c
        for objs in heads.values():
            for o in objs:
                kit.deform(o, lambda p: V((c.x + (p.x - c.x) * hx, p.y, c.z + (p.z - c.z) * (0.5 + 0.5 * hx))))
        for o in (hargs or {}).get('keep', []):
            kit.deform(o, lambda p: V((c.x + (p.x - c.x) * hx, p.y, c.z + (p.z - c.z) * (0.5 + 0.5 * hx))))
    if skull is not None:
        # 底模的頭（擬合時已經套過 hx）取代動畫頭顱：顏色從動畫頭顱投影過來（弗利沙的圓頂、比克的綠皮膚）
        old = heads['base'][0]
        skull = realbody.dress_head(skull, old, F, hargs)
        heads['base'][0] = skull
        bpy.data.objects.remove(old, do_unlink=True)
        for objs in heads.values():
            for o in objs[1:]:
                if o.get('fit_skull'):
                    realbody.fit_cap(o, skull, F.c, *o['fit_skull'])
    return {
        'body': body, 'proxy': proxy, 'heads': heads, 'extras': extras or {}, 'real': real,
        'allow': ALLOW, 'custom': custom or {}, 'palette': P, 'head_center': F.c, 'hr': F.hr,
        'faceRect': [0, F.hr * 0.9 - F.hr * 0.12, F.hr * 1.9 * F.R.get('hx', 1.0), F.hr * 1.9],
        'real_head': skull is not None,
    }


def pair_add(body, proxy, objs, proxy_set=()):
    """把左側部件與鏡射後的右側一起加入。"""
    for o in objs:
        m = mirror(o)
        body += [o, m]
        if o in proxy_set:
            proxy += [o, m]


def sash_chain_weights(F, chain):
    """垂帶：依高度在 hips → chain0 → chain1 之間漸變。"""
    h0, t0 = F.b[chain + '0']
    h1, t1 = F.b[chain + '1']

    def fn(co):
        y = co.y
        if y > h0.y:
            return [('hips', 1.0)]
        if y > h1.y:
            k = smooth((h0.y - y) / (h0.y - h1.y) * 1.6)
            return [(chain + '0', k), ('hips', 1 - k)]
        k = smooth(0.3 + (h1.y - y) / (h1.y - t1.y))
        return [(chain + '1', k), (chain + '0', 1 - k)]
    return fn




def skirt_chain_weights(F, chain):
    """長下襬：後片依高度讓一部分權重給擺動鏈（chain0 → chain1），前片與側邊保留原本跟著雙腿的骨熱權重。"""
    h0, _ = F.b[chain + '0']
    _, t1 = F.b[chain + '1']

    def fn(co, old):
        t = (h0.y - co.y) / (h0.y - t1.y)
        k = 0.85 * smooth(-co.z / (F.cz * 1.1)) * smooth(t * 3.0)
        if k <= 0.001:
            return old
        c1 = smooth(t * 1.6 - 0.5)
        return [(b, w * (1 - k)) for b, w in old] + [(chain + '0', k * (1 - c1)), (chain + '1', k * c1)]
    fn.blend = True
    return fn


# ================================================================ 悟空
def build_goku(R):
    F = Fig(R)
    P = kit.Palette()
    skin = P(0xf6c9a0)
    gi = P(0xff7d1f)
    # 內衣、腰帶、護腕、靴子：FighterZ 立繪是偏灰的深藍（取樣約 #3b4a75～#2c367a），舊版 0x22409e 經材質的彩度加強後
    # 亮成寶藍色（#2242a0 → 畫面 #002bb0），這裡先降彩度
    blue = P(0x464e78)
    gold = P(0xc09a4a)   # 靴子正面中線與鞋底邊的金褐色（立繪 #9f824c，受光後偏亮）
    white, ink = P(0xf4f1ea), P(0x15110e)
    team = P(-1)
    body, proxy = [], []
    # 腰帶中線：參考腰帶在頭頂下 2.5（FighterZ 立繪）～2.9 頭（S.H.Figuarts）；舊版 L＋0.085 低在 3.1 頭，上身顯得長、腰帶和手腕一樣高。
    # 抬到頭頂下約 2.8 頭（L＋0.175），褲頭（骨盆部件的上緣）跟著抬到腰帶裡；擺動鏈 sash 的掛點（models.js chainSpecs）同步抬高
    yb = F.L + 0.175

    # ---- 內衣（藍）：從 V 領露出，領口是貼著頸根的圓領（脖子的 proj_y0 抬高，見下方 neck）
    under = kit.loft('under', torso_rows(F, e=0.004, u0=0.3), n=16, cap0=None, cap1=None)
    under = kit.subsurf(under, 2)
    kit.tag(under, blue, grp=G_TORSO)
    # 內衣整件包在道服裡（只從 V 領露出），離道服約 1.4 cm、比外框殼還薄：領口以下不描外框，腋下擠壓時才不會從道服穿出黑點
    kit.paint_ol(under, lambda co: 0.0 if co.y < F.y(0.9) else None)
    body.append(realbody.skin(under))
    proxy.append(under)

    # ---- 道服上衣：V 領開口（開口弧放樣，邊緣乾淨）
    # 參考（FighterZ 立繪）：衣襬塞在腰帶裡，只在兩側腰帶下露出約 0.2 頭（舊版垂到腰帶下 13 cm，正面像一塊圍裙）；
    # 腰帶上方蓬起一圈（blouse）；V 領尖在肩線下約 0.75 頭，領口兩側的道服蓋到頸側。
    # 腰帶（u 約 0.22～0.37）那段收在腰帶裡（半寬比腰帶小 1 cm 以上），腰帶上緣以上才張開成胸寬
    rows = [(0.06, ('w', 1.3), 0.98, 0.02), (0.14, ('w', 1.22), 0.92, 0.01), (0.22, ('w', 1.16), 0.86, 0.02), (0.3, ('w', 1.2), 0.84, 0.03),
            (0.36, ('w', 1.28), 0.86, 0.04)] + TORSO_ROWS[2:]
    # 胸口以上每兩列中間再插一列：下面的肩線披覆（drape）要把肩頭的布往外推到三角肌上，原本 u 0.8～1.07 只有 5 列，推出來是一階一階的
    dense = []
    for r0, r1 in zip(rows, rows[1:]):
        dense.append(r0)
        if r0[0] >= 0.6 and r0[1][0] == r1[1][0]:
            dense.append(((r0[0] + r1[0]) / 2, (r0[1][0], (r0[1][1] + r1[1][1]) / 2), (r0[2] + r1[2]) / 2, (r0[3] + r1[3]) / 2))
    rows = dense + [rows[-1]]
    sts = torso_rows(F, e=lambda u: 0.018 + 0.008 * bump(u, 0.46, 0.1), rows=rows, pec=0.075, lat=0.09)
    uv0 = 0.56
    us = [r[0] for r in rows]
    # 開口緣離中線的距離（公尺）照立繪：V 尖往上張開，到頸根約 ±0.15（藍色內衣在領口露出約 1.15 頭寬），往後頸收成貼著頸根的領圈。
    # 換算成開口半角（超橢圓 p＝2.3：|x|＝a·sin(g)^(2/p)）。舊版半角隨 u 線性增加，最上兩圈（斜方肌往脖子收窄）的開口反而往內縮 3～6 cm，
    # 領口兩側各折出一個往內指的尖角，像西裝的缺角領
    xt = [(uv0, 0.0), (0.67, 0.05), (0.8, 0.105), (0.9, 0.145), (0.96, 0.15), (1.02, 0.136), (1.07, 0.09)]

    def gapf(i):
        if us[i] <= uv0:
            return 0.0
        x = next(x0 + (x1 - x0) * (us[i] - u0) / (u1 - u0) for (u0, x0), (u1, x1) in zip(xt, xt[1:]) if u0 <= us[i] <= u1)
        return math.asin(min(0.985, (x / sts[i].a) ** (2.3 / 2)))
    top = kit.loft('gi_top', sts, n=28, cap0=None, cap1=None, gap=gapf)
    # 肩線披覆：參考（三視圖 03、S.H.Figuarts 04）的道服肩線從軀幹的布直接往外下斜、蓋住三角肌，沒有另外一顆肩罩。
    # 道服軀幹原本只到肩關節內側，三角肌從肩頂冒出來（上一版另外罩一顆封頂的圓殼：俯視是兩顆橘色半球、背面和背片之間一道凹縫）。
    # 這裡把肩頭附近、在上臂骨軸上方與前後的布沿骨軸徑向推到 r_drape 外（平滑的 max，不會折出稜線），往脖子漸弱；
    # 骨軸下方（腋下）不推，布在那裡斜斜地穿進手臂、被下面的短袖蓋住
    r_sl = 0.1 * F.k_arm + 0.005   # 藍袖貼著三角肌（舊版 +0.012，再罩一層肩罩就像墊了肩墊）
    r_c = r_sl + 0.005             # 道服短袖（橘）的半徑：比藍袖大一點（再大，甩臂時肩頭像一顆氣球）
    r_drape = r_c + 0.005
    up_dir = V((0, 0, 1)).cross(F.da).normalized()   # 垂直上臂、朝上外

    def drape_w(q):
        """肩線披覆的權重與骨軸資料（q 已取 |x|）。"""
        s = (q - F.sh).dot(F.da)
        a = F.arm_pt(max(-0.05, min(0.03, s)))
        rv = q - a
        d = rv.length
        if d < 1e-5:
            return 0.0, a, rv, d
        # 只推骨軸上方（往前後各約 70 度內漸弱）：前後也推的話，胸前與肩胛的布被推離身體 5 cm，跑步甩臂時胸前鼓成一塊大墊肩
        w = smooth((rv.dot(up_dir) / d + 0.15) / 0.5) * smooth((s + 0.09) / 0.05)
        return w, a, rv, d

    def drape(p):
        q = V((abs(p.x), p.y, p.z))
        w, a, rv, d = drape_w(q)
        if w <= 0.0:
            return p
        sm = 0.5 * (d + r_drape + math.sqrt((d - r_drape) ** 2 + 0.02 ** 2))
        q = a + rv * ((d + (sm - d) * w) / d)
        return V((math.copysign(q.x, p.x) if p.x else q.x, q.y, q.z))
    kit.deform(top, drape)
    # 衣襬：前後中央收在腰帶裡（剛好在腰帶下緣上方），兩側垂出腰帶下約 4 cm（立繪的衣襬只在兩側露出一點）。
    # 舊版整圈平平垂到腰帶下 7 cm，正面在垂帶兩側各是一塊方形的衣襬，下緣一條橫線，像褲子的口袋
    hem = lambda co: co.y - (yb - 0.034 - 0.045 * smooth(abs(co.x) / (F.w * 1.25)))
    kit.iso_cut(top, hem)
    kit.cut(top, lambda co, nn: hem(co) < 0)
    top = kit.subsurf(top, 2, solidify=0.011)
    kit.tag(top, gi, grp=G_TORSO)
    # 推到三角肌上的那片布改照底下皮膚綁骨（realbody.hug_weights 抄最近的真人皮膚頂點，和短袖 capL 同一套）：
    # 留在道服的骨熱權重時，跑步往後甩臂，三角肌連同短袖轉到後面，那片布還留在原地，肩頭鼓成一顆橘色的大包
    G = top.data.attributes['grp'].data
    for v in top.data.vertices:
        q = V((abs(v.co.x), v.co.y, v.co.z))
        w, a, rv, d = drape_w(q)
        # 只限真的蓋在三角肌上的那片（離上臂骨軸 r_drape＋1.5 cm 內、在骨軸上方）：範圍再大，胸前的布也抄到上臂的權重，往前甩臂時胸口整片跟著鼓出來
        if w > 0.5 and (q - F.sh).dot(F.da) > -0.04 and d < r_drape + 0.015 and rv.dot(up_dir) > 0.3 * d:
            G[v.index].value = realbody.G_HUG_L if v.co.x >= 0 else realbody.G_HUG_R
    body.append(top)
    proxy.append(top)
    body += goku_emblem(F, top, white, ink)
    # 衣襟：道服開口的厚邊（solidify）加上外框就是一條清楚的領緣。舊版另外沿邊界頂點分前後兩段放樣一條滾邊，
    # 前後交接處（肩頸之間）折出一塊三角形，正面看像西裝的缺角領

    # 脖子：參考的脖子粗（約 0.6 頭寬）、幾乎被內衣的圓領蓋住（露出 0.1～0.2 頭）。
    # 圓領用解析場在底模上切一條水平的領口線（脖子周圍 10 cm 內：y(1.06) 以下藍、以上膚色，同 18 號的做法）；
    # 舊版靠逐頂點投影（脖子部件 y(1.0) 以下不當顏色來源），內衣上緣是一條低在鎖骨下的弧線，下巴到內衣之間露出一大片脖子與上胸，
    # 交界還沿底模頸根的大面成鋸齒
    # 領口是圓領：立繪的領口線貼著頸根、前方中央往下彎（約低 0.07 頭），兩側往後頸升高；上一版是一條水平的直線（像塗色的分界）。
    # 前方下彎 0.03 時正面可見的脖子從 0.17 頭變 0.25 頭（立繪內衣領口高、脖子短粗），收到 0.018
    nk_y = lambda co: F.y(1.075) - 0.018 * smooth(max(0.0, co.z + 0.01) / 0.09) ** 1.4
    nk_r = lambda co: math.hypot(co.x, co.z + 0.006) - 0.1
    realbody.paint(under, F, lambda co: max(nk_r(co), co.y - nk_y(co), F.y(0.85) - co.y) / 0.01, blue, 0, refine=1)
    realbody.paint(under, F, lambda co: max(nk_r(co), nk_y(co) - co.y) / 0.01, skin, 4, refine=1)
    # 脖子粗一點：參考的頸寬約 0.6 頭高（realbody 的 NECK_W 上限），0.074 時只到 0.55
    body.append(neck(F, skin, r=0.082))
    proxy.append(body[-1])

    # ---- 手臂、袖、護腕、拳
    arm_mu, arm_k = 1.25, 1.12
    arm = arm_skin(F, skin, muscle=arm_mu, k=arm_k)
    # 道服無袖，肩頭露出藍色內衣的短袖。參考（FighterZ 立繪、三視圖）：道服的肩線落在三角肌上，軟布包著肩頭往下垂，
    # 藍袖只在道服肩口下露出約 0.3 頭。舊版把藍袖靠肩的一段塗成橘色當道服肩口：同一個筒子上下兩色、上緣是筒子的平切口，
    # 正面看是兩層方形的硬殼肩墊。改成另一層道服的肩罩（比藍袖粗一圈、往外張），藍袖整條藍色，從肩罩下緣露出 8 cm
    slv = sleeve(F, blue, s1=0.13, r=r_sl, flare=1.02, thick=0.006, s0=-0.015)   # 上端藏在肩罩的圓頂裡（從 −0.06 起會從圓頂上緣穿出一條藍線）
    # 袖根朝向身體的那一側（腋下）埋在道服裡，舉手時兩層外框殼互相穿出黑點：那一圈不描外框（肩頂的輪廓保留）
    kit.paint_ol(slv, lambda co: 0.0 if (co - F.sh).dot(F.da) < 0.02 and (co - F.sh).dot(up_dir) < -0.02 else None)
    # 道服的短袖：兩端開口的短筒（不封頂），上半截的根部藏在上面推出來的肩線布底下，只露出蓋住三角肌下半、往外下斜的袖口。
    # 斷面中段最粗、下緣往手臂收一點（布往內垂），不是往外張的平切口
    capL = limb('gi_capL', F.sh, F.da, [(-0.045, r_c * 0.8, r_c * 0.78), (-0.01, r_c * 0.97, r_c * 0.95), (0.03, r_c * 1.01, r_c * 0.98), (0.06, r_c * 0.97, r_c * 0.95)],
                n=16, cap0=None, cap1=None)
    capL = kit.subsurf(capL, 2, solidify=0.007)
    # 綁骨照底下的皮膚（realbody.hug_weights 抄最近的真人皮膚頂點）：骨熱把整個圓頂都給上臂骨，跑步甩臂時圓頂的內端跟著手臂轉出來，
    # 肩上像頂著一顆橘色的球；照皮膚的權重，內端跟著鎖骨與胸廓、外端跟著上臂，和肩膀的皮膚一起變形
    kit.tag(capL, gi, grp=realbody.G_HUG_L, ol=0.8)
    # 短袖的根部埋在道服軀幹裡：出拳、舉手時兩層的外框殼在交界互相穿出黑刺，外框從肩關節往袖口才漸漸描上
    kit.paint_ol(capL, lambda co: 0.8 * smooth(((co - F.sh).dot(F.da) + 0.0) / 0.04))
    # 護腕：前臂肌群（k＝1.12、肌肉 1.25）在靠肘端比原本的環帶粗，起點往腕側挪、半徑加大，皮膚才不會穿出來
    wb_s0 = F.up + 0.16
    wb = band('wristL', F.sh, F.da, wb_s0, F.up + F.lo - 0.005, 0.068 * F.k_fore, 0.055 * F.k_fore, blue, G_FORE_L, thick=0.009, rb=0.92)
    wb['hug'] = 0.0015   # 護腕直接套在前臂皮膚上：換真人身體時內壁重新貼到新的前臂外 1.5 mm（realbody.hug_fit）
    # 被袖子、護腕蓋住的皮膚不描外框：外框殼（遊戲鏡頭下約 1.5 cm）會從布料外面穿出黑刺
    arm_s = lambda co: (co - F.sh).dot(F.da)
    kit.paint_ol(arm, lambda co: 0.0 if arm_s(co) < 0.05 or arm_s(co) > wb_s0 + 0.012 else None)
    # 袖子底下的肩頭皮膚塗成內衣的藍：側平舉、前平舉時道服肩口和袖口之間會被拉開一條縫，露出來的是「內衣」而不是一塊皮膚
    kit.paint(arm, lambda co, n: (blue, 0) if arm_s(co) < 0.045 else None)
    hand = fist(F, skin, scale=1.08)
    pair_add(body, proxy, [arm, slv, capL, wb, hand], proxy_set=(arm, hand))
    body.append(goku_team_band(F, team, arm_mu, arm_k))

    # ---- 褲子、靴
    pel = pelvis(F, gi, e=0.012, top_u=0.33)   # 上端開口，不進骨熱替身（finish 只收封閉部件，替身用 core_proxy 的骨盆）
    # 褲頭在腰帶高度往內收（燈籠褲在腰帶下才鼓起來）：原本最寬處正好在腰帶下緣，兩側會把腰帶整段蓋掉
    kit.deform(pel, lambda p: V((p.x * (1 - 0.16 * smooth((p.y - (yb - 0.077)) / 0.04)), p.y, p.z)))
    # 襠底往後上收：骨盆的圓底比褲管頂端往前凸 2 cm，正面在兩條褲管之間是一顆鼓起的圓底，加上褲管交界的線，像一件三角褲
    # 只收前半：後半也往上收的話，背面兩條褲管之間的襠底露出底下真人身體的胯下（塗成內衣的藍，背面是一個藍色的小倒三角）
    kit.deform(pel, lambda p: V((p.x, p.y + 0.5 * max(0.0, F.L + 0.01 - p.y) * smooth(0.5 + p.z / 0.08), p.z * (1 - 0.18 * smooth((F.L + 0.04 - p.y) / 0.1)))))
    # 腰帶與上衣下襬蓋住的褲頭不描外框；褲襠底（褲管之間、往下收成圓底的那段）也不描外框：背面看褲頭底緣的外框是一圈 U 字形的黑線，像一件內褲
    kit.paint_ol(pel, lambda co: (1.0 - smooth((co.y - (yb - 0.06)) / 0.03)) * smooth((co.y - (F.L - 0.075)) / 0.05))
    body.append(pel)
    leg = goku_pants(F, gi)
    # 褲管頂端藏在褲頭裡：外框漸細，踢腿時才不會從褲頭穿出黑刺
    kit.paint_ol(leg, lambda co: 1.0 - smooth((co.y - (F.th.y + 0.0)) / 0.05))
    bt = goku_boot(F, blue, gold)
    pair_add(body, proxy, [leg] + bt, proxy_set=[leg] + bt)

    # ---- 腰帶、結、垂帶
    # 參考腰帶寬約 1.33 頭（FighterZ）：舊版 F.w×1.5（1.1 頭）。下緣放寬成繫在胯上的錐形，罩住收進來的褲頭
    belt = limb('belt', V((0, yb - 0.04, 0)), V((0, 1, 0)), [(0.0, F.w * 1.64, F.cz * 1.04, None, 2.3), (0.04, F.w * 1.63, F.cz * 1.07, None, 2.3), (0.08, F.w * 1.6, F.cz * 1.04, None, 2.3)], n=18, cap0=None, cap1=None)
    belt = kit.subsurf(belt, 2, solidify=0.014)
    kit.tag(belt, blue, grp=G_BELT)
    body.append(belt)
    kz = F.cz * 1.07 + 0.008
    knot = kit.quad_sphere('knot', 1, cuts=3)
    kx = -0.035  # 結打在正前方偏角色右側（參考 3D 實機影片）
    kit.deform(knot, lambda p: V((kx + p.x * 0.036, yb + p.y * 0.032, kz + p.z * 0.022)))
    knot = kit.subsurf(knot, 1)
    kit.tag(knot, blue, grp=G_BELT)
    body.append(knot)
    # 垂帶：參考立繪兩條帶尾從結垂到大腿中段（約 1.4 頭、一長一短），貼著褲子前面往下
    for k, (dx, w0, ln, dz) in enumerate(((-0.014, 0.034, 0.34, -0.004), (0.03, 0.03, 0.28, 0.0))):
        # 垂帶離上衣下襬前緣留 0.5 cm 以上（原本有一段埋進下襬裡）
        t0 = V((kx + dx, yb - 0.01, kz + 0.006 + 0.006 * k))
        f = kit.loft('flap%d' % k, [S(t0, w0, 0.007), S(t0 + V((-0.004, -ln * 0.5, dz + 0.004)), w0 * 1.1, 0.007), S(t0 + V((-0.006 + 0.016 * k, -ln, dz)), w0 * 0.95, 0.006)], n=8)
        f = kit.subsurf(f, 2)
        kit.tag(f, blue, grp=G_CHAIN, ol=0.7)
        body.append(f)

    # ---- 頭
    heads = {}
    for form in ('base', 'ssj'):
        # 成熟的方下巴；鼻子與嘴唇壓平：底模真人嘴唇的唇縫（遮蔽與明暗都是一條黑線）在貼花的嘴下方 1 cm 外又一條，
        # 兩條線加上嘴角的凹點，遠看像咬著牙
        # face_len 0.88：立繪的臉寬約是眼睛到下巴的 2.6 倍（舊版 1.6 倍，下半臉長、臉窄），下半臉縮短、頭寬 hx 加大（PROPS）
        # 第三輪：正面量眼睛到下巴 1、眼高處臉寬（不含耳朵）1.52，立繪約 1.9（含耳朵約 2.6）。下半臉再縮短（face_len 0.8）、
        # 下顎與下巴放寬（jaw 1.2：下半臉寬度從眼線往下巴漸增到 cheek×jaw 倍），頭寬 hx 1.04（PROPS）；
        # relax 2：底模臉頰的法令紋凹線讓外框的反殼從嘴角兩側穿出兩撇黑色鋸齒（nool 時消失），把眼線以下的臉頰平滑兩輪
        h = anime_head('head_' + form, F, skin, jaw=1.2, cheek=1.04, square=0.5, chin=1.2, nose=0.75, muzzle=0.75, face_len=0.8, relax=2)
        # 嘴（貼花在頭心下約 0.6 hr）附近的外框變細：底模嘴唇的凹線讓外框的反殼從嘴縫透出來，正面是一撇黑鬍子似的黑塊。
        # 外框倍率由 realbody.dress_head 從這顆動畫頭顱投影到底模的頭
        c0, hr0 = F.c, F.hr
        kit.paint_ol(h, lambda co: 0.0 if abs(co.x - c0.x) < hr0 * 0.42 and abs(co.y - (c0.y - hr0 * 0.6)) < hr0 * 0.2 and co.z > c0.z + hr0 * 0.3 else None)
        hc = P(0x17130f) if form == 'base' else P(0xffd447)
        # 頭髮的尖端位置直接照參考量（單位 hr），不再放大：頭（hr）加大到 7.2 頭身後，舊的 1.12 倍會讓頭髮高出頭頂 1.25 頭（參考約 1.0）
        # 髮尖的 x 照 hx＝0.88 量的：頭寬改成 0.94 後尖端往內收回同樣的絕對位置（髮根照頭寬走）
        hx = F.R.get('hx', 1.0)
        # 往外伸的長尖刺（|x|＞1.4）尖端乘 kx／hx：頭寬 hx 只放大髮根，尖端留在原本的絕對位置（finish 會再乘 hx）；
        # 貼著頭的瀏海、鬢角（|x|＜0.9）跟著頭寬一起放大，中間漸變（只乘 1／hx 的話鬢角尖端會陷進臉頰）
        kx = 0.8 if form == 'base' else 0.88
        tipx = lambda x: x * lerp(1.0, kx / hx, smooth((abs(x) - 0.9) / 0.5))
        cl = [(c[0], (tipx(c[1][0]),) + tuple(c[1][1:])) + tuple(c[2:]) for c in goku_hair(form)]
        heads[form] = [h, hair_cap('cap_' + form, F, hc, hairline=0.42, temple=0.15, side_y=0.15 if form == 'base' else -0.05)] + hair(F, hc, cl, grow=1.0 / HAIR_GROW if form == 'base' else 0.95, wmul=1.05)
    W = goku_waist_weights(F, yb)
    custom = {G_CHAIN: sash_chain_weights(F, 'sash'), G_PELVIS: W['pelvis'], G_BELT: W['belt'], G_TORSO: W['top'], G_LEG_L: W['legL'], G_LEG_R: W['legR'], realbody.G_REAL: W['real']}
    return finish(F, P, body, proxy, heads, custom=custom)


def goku_waist_weights(F, yb):
    """悟空腰部（褲頭、上衣下襬、腰帶與結、褲管頂端）的權重：垂帶骨 sash0 就在褲頭正前方，骨熱把前片幾乎全分給它，
    過濾掉以後下襬前片沒剩任何允許的骨頭、退回鎖骨（抬手時下襬整片翹起來），褲頭則一路到腰帶都跟著大腿。
    改成依高度指定、各部件共用同一個函式，彼此貼著一起動：腰帶以上 hips／torso，往下漸漸交給大腿，襠部中線左右各半。"""
    y_hi, y_lo = yb - 0.045, F.L - 0.09     # 腰帶下緣附近開始分給大腿，到襠底全給大腿

    def thigh(co):
        return smooth((y_hi - co.y) / (y_hi - y_lo))

    def base(co):
        u = 0.5 * smooth((co.y - (yb - 0.047)) / 0.09)   # 腰帶上緣約一半跟著上身（和上衣在那裡的骨熱相近）
        return [('hips', 1 - u), ('torso', u)]

    def pelvis_fn(co, k=1.0):
        t = thigh(co) * k
        s = smooth(0.5 + co.x / 0.06)
        return [(b, w * (1 - t)) for b, w in base(co)] + [('thL', t * s), ('thR', t * (1 - s))]

    def top_fn(co, old):
        m = smooth((yb + 0.05 - co.y) / 0.045)   # 腰帶裡面（上緣以下）漸漸換成腰部權重，腰帶以上維持原本的骨熱
        if m <= 0.001:
            return old
        # 下襬垂在大腿前後約 5 cm：整片跟著大腿轉，抬腿時會繞髖關節翹成一片立起來的板子。
        # 只給一部分：抬腿 45 度內下襬仍蓋在大腿前面，抬得更高時整片沒入大腿，不會露出半截翹起的下緣
        k = lerp(0.5, 0.6, smooth(0.5 + co.z / 0.12))
        return [(b, w * (1 - m)) for b, w in old] + [(b, w * m) for b, w in pelvis_fn(co, k)]
    top_fn.blend = True

    def leg_fn(side):
        def fn(co, old):
            m = smooth((co.y - (F.L - 0.12)) / 0.08)   # 褲管頂端（藏在褲頭裡）和褲頭用同一套，往下交回骨熱
            if m <= 0.001:
                return old
            t = thigh(co)
            new = [(b, w * (1 - t)) for b, w in base(co)] + [('th' + side, t)]
            return [(b, w * (1 - m)) for b, w in old] + [(b, w * m) for b, w in new]
        fn.blend = True
        return fn
    def real_fn(co, old):
        # 道服底下的真人軀幹（腰帶上緣附近）和道服用同一套腰部權重：只有道服換成腰部權重、底下的皮膚（塗成藍色內衣）
        # 還是骨熱時，扭腰出拳兩者錯開 1～2 cm，內衣的藍從道服腰帶上方一塊塊穿出來
        if abs(co.x) > F.w * 1.7 or co.y < yb - 0.05 or co.y > yb + 0.1:
            return old
        return top_fn(co, old)
    real_fn.blend = True
    return {'pelvis': pelvis_fn, 'belt': lambda co: base(co), 'top': top_fn, 'legL': leg_fn('L'), 'legR': leg_fn('R'), 'real': real_fn}


def goku_pants(F, pal):
    """燈籠褲管（左）。參考（FighterZ 立繪、S.H.Figuarts）：褲頭到大腿上段收窄，膝下到小腿最寬（單腳約 1.2 頭），在靴口收緊、蓋住靴口。
    舊版（共用的 baggy_leg）最寬處在胯下、往下一路變細，雙腳的內側從胯下到膝蓋整段交疊，正面看褲襠垂到膝上（胯下 2.5 頭高）。
    這裡每個斷面分開給內側／外側半寬（中心往外移），內側緣離中線至少 1 cm，雙腿從胯下就分開；外側往外鼓。"""
    tl = F.tl
    bg = lambda th: 1 + 0.05 * ang_bump(th, FRONT, 1.1) + 0.04 * ang_bump(th, BACK, 1.1)
    # 參考雙腿合寬：FighterZ 2.8 頭、S.H.Figuarts 3.0 頭（舊版 2.1 頭，從腰往下幾乎線性變寬）。
    # 第三輪：上一版最寬 2.58 頭，外側半寬再加到 0.25（膝下）；膝蓋抬到約 2.2 頭（PROPS thighK 0.4）。
    # 褲管末端：上一版從最寬處 3.5 cm 內收到靴口，側面看像一截圓柱被切掉；改成多三列、圓圓地往下收進靴口（布垂在靴口上）
    rows = [  # s, 內側半寬, 外側半寬, 前後半徑
        (-0.07, 0.085, 0.12, 0.13),
        (0.04, 0.077, 0.13, 0.142),
        (0.14, 0.082, 0.15, 0.15),
        (0.26, 0.09, 0.18, 0.152),
        (tl - 0.04, 0.1, 0.215, 0.16),
        (tl + 0.03, 0.11, 0.245, 0.17),
        (tl + 0.08, 0.11, 0.25, 0.172),
        (tl + 0.125, 0.1, 0.228, 0.16),
        (tl + 0.15, 0.088, 0.18, 0.136),
        (tl + 0.168, 0.074, 0.13, 0.106),
        (tl + 0.185, 0.064, 0.086, 0.08),
    ]
    # 每 1.8 cm 一個斷面（線性內插）：下面的橫向皺褶要靠斷面的密度才刻得出來（再密的話身體超過 build_heroes 的減面上限，圓章的字會被減面打碎）
    dense = []
    for r0, r1 in zip(rows, rows[1:]):
        k = max(1, round((r1[0] - r0[0]) / 0.018))
        dense += [tuple(x0 + (x1 - x0) * j / k for x0, x1 in zip(r0, r1)) for j in range(k)]
    rows = dense + [rows[-1]]
    side = V((1, 0, 0))
    u = (side - F.dl * side.dot(F.dl)).normalized()
    sts = [S(F.leg_pt(s) + u * ((o - i) / 2), (o + i) / 2, b, p=2.2, mod=bg if 0.1 < s < tl + 0.13 else None) for s, i, o, b in rows]
    o = kit.loft('legL', sts, n=16, cap0='pole', cap1='pole')
    # 橫向大皺褶（立繪 01、S.H.Figuarts 02、05 的燈籠褲一層層往下疊）：沿褲管的徑向起伏，波長約 9 cm、相位隨方位角偏移成斜斜的摺，
    # 深淺也隨方位角變（不是一圈圈等深的環，那樣像輪胎人）；大腿上段沒有，膝下到靴口上方最深（布在那裡堆起來），收進靴口的最後幾列不動
    fw = u.cross(F.dl).normalized()
    if fw.z < 0:
        fw = -fw
    ss = [r[0] for r in rows]
    ctr = lambda t: F.leg_pt(t) + u * lerp_rows(rows, t, 2, 1)

    def lerp_rows(rs, t, io, ii):
        t = max(rs[0][0], min(rs[-1][0], t))
        for r0, r1 in zip(rs, rs[1:]):
            if t <= r1[0]:
                k = (t - r0[0]) / max(1e-6, r1[0] - r0[0])
                return ((r0[io] + (r1[io] - r0[io]) * k) - (r0[ii] + (r1[ii] - r0[ii]) * k)) / 2
        return (rs[-1][io] - rs[-1][ii]) / 2

    def folds(p):
        t = (p - F.th).dot(F.dl)
        if t < ss[0] or t > ss[-1]:
            return p
        a = ctr(t)
        r = p - a - F.dl * (p - a).dot(F.dl)
        d = r.length
        if d < 1e-5:
            return p
        th = math.atan2(r.dot(fw), r.dot(u))
        amp = 0.0095 * smooth((t - 0.2) / 0.12) * (1 - smooth((t - (tl + 0.13)) / 0.035)) * (1 + 0.4 * smooth((t - tl) / 0.1))
        amp *= 0.55 + 0.45 * math.sin(th * 2.0 + t * 25.0)
        ph = (t + 0.035 * math.cos(th * 1.5) + 0.02 * math.sin(th * 3.0 + 1.0)) / 0.09
        return p + r / d * (amp * math.sin(2 * math.pi * ph))
    kit.deform(o, folds)
    o = kit.subsurf(o, 1)
    return kit.tag(o, pal, grp=G_LEG_L)


def goku_boot(F, pal, trim):
    """靴子（左）：參考立繪的靴子寬口、平頂、筒身直，露出約 1.4 頭高，
    正面中線一條金褐色直線、鞋底邊一圈同色。共用的 boot() 筒身往腳踝收到 5 cm 半徑，這裡把中段往外撐成直筒，腳踝處再收回去接腳掌。"""
    tl, sl = F.tl, F.sl
    top_s = tl + 0.16   # 靴口離地約 1.4 頭（thighK 0.43 讓膝蓋抬高後，靴口在膝下 16 cm）
    bt = boot(F, pal, top_s, 0.104, toe=1.06)

    def widen(p):
        s = (p - F.th).dot(F.dl)
        a = F.leg_pt(s)
        k = 1 + 0.26 * smooth((s - top_s - 0.04) / 0.14) * (1 - 0.55 * smooth((s - (tl + sl - 0.1)) / 0.06))
        return a + (p - a) * k
    kit.deform(bt[0], widen)
    # 正面中線：沿小腿的中心線（腳掌段沿腳背中線），寬 1.6 cm；鞋底邊 1.6 cm 高
    fx = F.sole.x + 0.004

    def line(co):
        s = max(0.0, min(F.tl + F.sl, (co - F.th).dot(F.dl)))
        cx = F.leg_pt(s).x if co.y > 0.1 else fx + 0.005
        return abs(co.x - cx) - 0.008 if co.z > 0.03 else 1.0
    for o in bt:
        kit.paint_field(o, line, trim, 0)
    kit.paint_field(bt[1], lambda co: co.y - 0.017, trim, 0)
    return bt


def goku_patch(name, top, cx, cy, R, back=False, n=26):
    """貼在道服表面的圓形貼片：XY 平面上的細格子（約 2 mm），切成半徑 R 的圓，再沿 z 射線投影到道服外層、往外浮一點。
    直接在道服上切色界的話，道服的面約 1.7 cm，圓章只切成一個六角形；把道服局部細分再切，細分邊緣的法線不連續，
    外框的反殼從圓章旁邊穿出一道道黑刮痕。貼片不描外框（黑框本身就是顏色），換真人身體時跟著道服一起挪（ride_on）；
    浮 4 mm：道服被 retarget 平滑挪動，貼片照最近頂點挪，弧面兩側差 1～2 mm，扭腰時布摺起來又差 1～2 mm，浮太低會被道服蓋掉一角。"""
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=n, y_segments=n, size=R * 1.1)
    ob = kit.to_object(name, bm)
    xs = [v.co.x for v in ob.data.vertices]
    k = R * 1.1 / max(abs(min(xs)), abs(max(xs)))   # create_grid 的 size 在不同版本是半寬或全寬：量出來再縮放
    kit.deform(ob, lambda p: V((cx + p.x * k * (-1 if back else 1), cy + p.y * k, 0.0)))
    f = lambda co: math.hypot(co.x - cx, co.y - cy) - R
    kit.iso_cut(ob, f)
    kit.cut(ob, lambda co, nn: f(co) > 0)
    tree = tree_of(top)
    sgn = -1 if back else 1

    def proj(p):
        hit = tree.ray_cast(V((p.x, p.y, sgn * 0.5)), V((0, 0, -sgn)), 1.0)
        if hit[0] is None:
            return p
        nrm = hit[1] if hit[1].z * sgn > 0 else -hit[1]
        return hit[0] + nrm * 0.004
    kit.deform(ob, proj)
    # 開放的面片沒有內外之分，recalc 會隨機翻面：一律朝外（正面朝 +z、背面朝 −z）
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bm.normal_update()
    if sum(f.normal.z for f in bm.faces) * sgn < 0:
        bmesh.ops.reverse_faces(bm, faces=bm.faces[:])
    bm.to_mesh(ob.data)
    bm.free()
    ob.data.update()
    return ob


def goku_emblem(F, top, white, ink):
    """胸前的「亀」字圓章（角色左胸）與背後的「界王」圓章：白底、黑框。字用膠囊筆畫的場畫在白底上（單位＝圓章半徑）。
    亀：上方的「ク」（撇＋橫折）和下面的「田」分開留一道空隙，中間的直筆只在田裡、往下接右勾的「乚」；
    舊版的直筆從田的上緣再往上伸、ク又小，整個字讀起來像「电」。
    界王（FighterZ 版悟空背後）：上下疊兩個字，界＝田＋人字頂＋兩隻腳，王＝三橫一直。回傳要加進身體的貼片。"""
    kame = [((-0.06, 0.9), (-0.4, 0.6)), ((-0.2, 0.76), (0.26, 0.76)), ((0.26, 0.76), (0.04, 0.52)),
            ((-0.38, 0.4), (0.38, 0.4)), ((-0.38, 0.4), (-0.38, -0.16)), ((0.38, 0.4), (0.38, -0.16)), ((-0.38, -0.16), (0.38, -0.16)),
            ((-0.38, 0.12), (0.38, 0.12)), ((0.0, 0.4), (0.0, -0.5)), ((0.0, -0.5), (0.42, -0.5)), ((0.42, -0.5), (0.5, -0.32))]
    k = 0.86
    kaio = [((-0.3, 0.84), (0.3, 0.84)), ((-0.3, 0.84), (-0.3, 0.5)), ((0.3, 0.84), (0.3, 0.5)), ((-0.3, 0.5), (0.3, 0.5)),
            ((-0.3, 0.67), (0.3, 0.67)), ((0.0, 0.84), (0.0, 0.5)),
            ((0.0, 0.45), (-0.5, 0.2)), ((0.0, 0.45), (0.5, 0.2)), ((-0.15, 0.28), (-0.3, 0.02)), ((0.17, 0.28), (0.17, 0.02)),
            ((-0.38, -0.12), (0.38, -0.12)), ((-0.3, -0.44), (0.3, -0.44)), ((-0.46, -0.76), (0.46, -0.76)), ((0.0, -0.12), (0.0, -0.76))]
    kaio = [((a[0] * k, a[1] * k), (b[0] * k, b[1] * k)) for a, b in kaio]

    def glyph(strokes, cx, cy, R, w, flip):
        def f(co):
            p = V(((co.x - cx) / R * flip, (co.y - cy) / R))
            d = 9.0
            for a, b in strokes:
                a, b = V(a), V(b)
                ab = b - a
                t = max(0.0, min(1.0, (p - a).dot(ab) / ab.length_squared))
                d = min(d, (p - (a + ab * t)).length)
            return d - w
        return f
    out = []
    cx, cy = 0.118, F.y(0.5)
    # 背章：立繪 04 與 FighterZ 背面的圓章大（約背寬的 0.45）、在上背中央；上一版半徑 0.075 m（背寬的 0.29）、圓心在肩線與腰帶之間 55% 的高度，又小又低。
    # 貼片格子：字的邊界是沿等值線切的（kit.paint_field），格子只要比筆畫細就好；上一版 44×44、64×64 讓悟空的面數是其他角色的 1.5 倍
    for nm, x, y, r, back, strokes, w, n in (('emblemF', cx, cy, 0.046, False, kame, 0.07, 26), ('emblemB', 0.0, F.y(0.73), 0.11, True, kaio, 0.06, 34)):
        o = goku_patch(nm, top, x, y, r, back=back, n=n)
        # 綁骨群組 G_RIDE：權重抄底下道服最近的頂點。和道服各自從骨熱代理體轉移的話，貼片的頂點比道服密，兩者內插出來的權重
        # 差一點點，扭腰出拳時道服從圓章的邊緣穿出橘紅色的斑點
        kit.tag(o, ink, grp=G_RIDE, ol=0.0)
        kit.paint_field(o, lambda co, x=x, y=y, r=r: math.hypot(co.x - x, co.y - y) - (r - 0.0055), white, 0)
        # 背面從背後看：畫面的右邊是角色的 −x，字的 x 要反過來
        kit.paint_field(o, glyph(strokes, x, y, r, w, -1 if back else 1), ink, 0)
        o['ride_on'] = top.name
        o['trim'] = 1
        out.append(o)
    return out


def goku_team_band(F, pal, muscle, k):
    """上臂的隊伍色臂章：沿用 arm_skin 的二頭／三頭肌起伏（打了折扣，細分後的皮膚會比解析式小），前後才不會被肌肉蓋掉、只剩兩側一小塊。"""
    mu = muscle * FZ['muscle']
    ka = F.k_arm * k
    bic = lambda th: 1 + 0.7 * 0.16 * mu * ang_bump(th, FRONT, 0.95)
    tri = lambda th: 1 + 0.7 * 0.12 * mu * ang_bump(th, BACK, 1.05)
    m = mods(bic, tri)
    # arm_skin 在 s＝0.14 與 0.2 的半徑之間內插
    ab = lambda s: (lerp(0.077, 0.07, (s - 0.14) / 0.06) * ka, lerp(0.082, 0.077, (s - 0.14) / 0.06) * ka)
    st = []
    for s in (0.152, 0.168, 0.184):
        a, b = ab(s)
        st.append((s, a + 0.004, b + 0.004, m))
    o = limb('teamL', F.sh, F.da, st, n=16, cap0=None, cap1=None)
    o = kit.subsurf(o, 2, solidify=0.006)
    # 臂章直接貼在皮膚上：換真人身體時內壁重新貼到新的上臂外 1.5 mm（realbody.hug_fit；arm_skin 的上臂比底模粗 2～3 cm，
    # 底模上臂又偏在骨軸下方，照位移平移的話臂章一側懸空）。套在袖子外的環帶不能這樣做：皮膚縮進袖子裡，環帶會跟著陷進袖子
    o['hug'] = 0.0015
    return kit.tag(o, pal, mat=5, grp=G_UPPER_L, ol=0.5)


def goku_hair(form):
    if form == 'base':
        # 照 FighterZ 立繪（正面）量的尖端位置（單位 hr，頭心相對；+x 是角色左側＝正面畫面右側）。尖端的 x 在 build_goku 裡再乘 0.8／hx
        # （頭寬 hx 只放大髮根，尖端留在同樣的絕對位置；第三輪從 0.88 收到 0.8：整團寬 2.59 頭 → 約 2.4 頭）。
        # 左右不對稱：頭頂最高的一撮往角色右上斜；角色右側三根長尖刺在額頭到眼睛的高度幾乎水平往外伸，角色左側兩根較短。
        # 第三輪：
        # - 頭頂最高的尖端 2.6 → 2.35：含髮總高 8.3～8.6 頭，立繪約 8.2（髮尖高出頭頂約 1 頭）。
        # - 耳朵露出來：立繪兩耳明顯露在臉側，上一版耳朵高度有一對往正側方伸的髮束（側面看是一團 C 字形的圓鼓黑髮）和粗鬢角整片蓋住。
        #   耳朵高度的髮束拿掉，改成根部在耳後上方、往後下方伸的短尖刺；眼睛高度的長尖刺根部抬高到耳朵上緣、尖端往後收（側面才不是一個正對鏡頭的圓錐）；
        #   鬢角改成耳前細細的一撮。
        # - 太陽穴的瀏海尖端原本伸到臉前 0.7 hr（側面看是一片蓋在眼睛與顴骨前的黑色楔形），收回貼著太陽穴。
        # - 後腦：原本三撮的根部擠在後腦中央、尖端正對後方，背面看是一顆圓鈕放射出一圈髮束（像一朵花）。
        #   參考 03、04 是幾排往後下方垂的尖刺：根部沿後腦分三排（上排往後、中排往後下、下排往下貼著後頸），每排左右散開
        return [
            # (根部, 尖端, 半寬, 半厚, 彎曲)
            ((-0.05, 0.95, 0.1), (-0.9, 2.35, -0.25), 0.6, 0.24, (0.15, 0.05, 0)),        # 頭頂最高的一撮，根部寬、往角色右上
            ((0.3, 0.9, 0.0), (0.85, 1.45, -0.3), 0.46, 0.2, (0.05, 0.05, 0)),            # 頭頂偏左：從大尖刺往右下的斜坡
            ((-0.45, 0.85, 0.05), (-1.95, 2.0, -0.35), 0.56, 0.23, (0, 0.2, 0)),          # 角色右上方的長尖刺
            ((-0.72, 0.6, -0.05), (-2.55, 1.15, -0.5), 0.52, 0.22, (0, 0.12, 0)),         # 角色右側，最遠的一根
            ((-0.78, 0.48, -0.22), (-2.15, 0.4, -0.85), 0.32, 0.17, (0, 0.06, 0)),         # 角色右側，眉眼高度（根部在耳朵上方、根部窄，尖端往後）
            ((0.7, 0.6, -0.05), (2.05, 0.95, -0.45), 0.48, 0.21, (0, 0.1, 0)),            # 角色左側，較平
            ((0.78, 0.48, -0.22), (2.1, 0.45, -0.85), 0.32, 0.17, (0, 0.06, 0)),
            ((-0.68, 0.05, -0.5), (-1.3, -0.3, -1.05), 0.28, 0.14, (0, 0.02, 0)),        # 耳後上方，往後下方的短尖刺
            ((0.68, 0.05, -0.5), (1.2, -0.35, -1.0), 0.28, 0.14, (0, 0.02, 0)),
            ((-0.3, 0.8, -0.45), (-1.0, 1.15, -1.35), 0.46, 0.21, (0, 0.1, 0)),           # 頭頂往後
            ((0.3, 0.8, -0.45), (0.95, 0.95, -1.35), 0.44, 0.2, (0, 0.1, 0)),
            # 後腦上排：往後、略往下
            # （中央不放：正中往後的一撮從背面看是正對鏡頭的圓錐，又成了一顆圓鈕）
            ((-0.4, 0.58, -0.62), (-1.1, 0.05, -1.7), 0.42, 0.19, (0, 0.06, 0)),
            ((0.4, 0.58, -0.62), (1.05, 0.0, -1.65), 0.42, 0.19, (0, 0.06, 0)),
            # 後腦中排：往後下
            ((-0.55, 0.15, -0.72), (-1.05, -0.5, -1.6), 0.36, 0.17, (0, 0.03, 0)),
            ((-0.18, 0.2, -0.82), (-0.3, -0.5, -1.75), 0.36, 0.17, (0, 0.03, 0)),
            ((0.18, 0.2, -0.82), (0.32, -0.55, -1.7), 0.36, 0.17, (0, 0.03, 0)),
            ((0.55, 0.15, -0.72), (1.0, -0.55, -1.55), 0.36, 0.17, (0, 0.03, 0)),
            # 後腦下排：往下貼著後頸
            ((-0.35, -0.3, -0.75), (-0.62, -1.1, -1.25), 0.3, 0.15, (0, 0, 0)),
            ((0.0, -0.32, -0.8), (0.0, -1.15, -1.3), 0.3, 0.15, (0, 0, 0)),
            ((0.35, -0.3, -0.75), (0.62, -1.1, -1.25), 0.3, 0.15, (0, 0, 0)),
            # 瀏海：四撮垂到眉上，往兩側散開
            ((0.08, 0.82, 0.56), (0.0, 0.2, 1.0), 0.3, 0.14, (0, 0.05, 0.12)),
            ((-0.3, 0.8, 0.52), (-0.44, 0.16, 0.95), 0.28, 0.14, (0, 0.05, 0.1)),
            ((0.42, 0.76, 0.5), (0.56, 0.26, 0.92), 0.26, 0.13, (0, 0.05, 0.1)),
            # 太陽穴：尖端貼著太陽穴往下（眼尾外側），不伸到臉前
            ((-0.64, 0.62, 0.38), (-0.84, 0.2, 0.28), 0.2, 0.1, (0, 0.03, 0.04)),
            ((0.66, 0.62, 0.36), (0.84, 0.24, 0.27), 0.18, 0.1, (0, 0.03, 0.04)),
            # 鬢角：耳前細細一撮
            ((0.74, 0.3, 0.34), (0.82, -0.2, 0.38), 0.09, 0.045, (0, 0, 0.02)),
            ((-0.74, 0.3, 0.34), (-0.82, -0.2, 0.38), 0.09, 0.045, (0, 0, 0.02)),
        ]
    return sym([
        ((0.0, 0.92, 0.25), (0.1, 2.9, 0.0), 0.56, 0.25, (0, 0, 0)),
        ((0.38, 0.85, 0.1), (0.95, 2.7, -0.2), 0.54, 0.25, (0, 0, 0)),
        ((0.7, 0.55, -0.05), (1.75, 2.0, -0.35), 0.5, 0.24, (0, 0, 0)),
        ((0.82, 0.12, -0.25), (1.95, 0.75, -0.6), 0.46, 0.22, (0, 0, 0)),
        ((0.28, 0.78, -0.5), (0.55, 2.5, -1.1), 0.54, 0.25, (0, 0, 0)),
        ((0.0, 0.55, -0.8), (0.05, 1.9, -1.7), 0.55, 0.25, (0, 0, 0)),
        ((0.45, 0.2, -0.82), (1.2, 0.6, -1.7), 0.5, 0.23, (0, 0, 0)),
        ((0.0, -0.15, -0.92), (0.05, -0.5, -1.7), 0.45, 0.22, (0, 0, 0)),
        ((0.6, 0.62, 0.38), (1.3, 1.85, 0.3), 0.38, 0.2, (0, 0, 0)),
        ((0.1, 0.8, 0.56), (0.0, 0.18, 1.04), 0.3, 0.15, (0, 0.05, 0.14)),
        ((0.4, 0.75, 0.5), (0.62, 0.95, 0.9), 0.26, 0.13, (0, 0, 0)),
        ((0.72, 0.4, 0.32), (0.9, -0.2, 0.5), 0.18, 0.09, (0, 0, 0.04)),
        # 第二層：夾在大髮束之間的短尖刺，讓金髮像影片裡一樣蓬成一大團
        ((0.2, 0.9, -0.2), (0.5, 2.35, -0.6), 0.42, 0.2, (0, 0, 0)),
        ((0.55, 0.72, 0.15), (1.45, 2.2, 0.05), 0.4, 0.2, (0, 0, 0)),
        ((0.62, 0.35, -0.5), (1.6, 1.25, -1.3), 0.42, 0.2, (0, 0, 0)),
        ((0.25, 0.3, -0.85), (0.6, 1.1, -2.0), 0.44, 0.21, (0, 0, 0)),
    ])


def build(hid, R):
    import cast
    B = {'goku': build_goku, 'vegeta': cast.build_vegeta, 'trunks': cast.build_trunks, 'piccolo': cast.build_piccolo, 'frieza': cast.build_frieza, 'a18': cast.build_a18}
    # 客串角色：有專屬建模就用，否則暫時借用體型相近的身體
    try:
        import crossover
        B.update(crossover.BUILDERS)
    except ImportError:
        pass
    R['id'] = hid
    for k, v in {'naruto': cast.build_trunks, 'luffy': cast.build_trunks, 'zoro': cast.build_trunks, 'sasuke': cast.build_trunks, 'kakashi': cast.build_trunks, 'sanji': cast.build_trunks, 'sakura': cast.build_a18, 'nami': cast.build_a18}.items():
        B.setdefault(k, v)
    return B[hid](R)
