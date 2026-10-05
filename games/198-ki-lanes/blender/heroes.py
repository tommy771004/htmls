# 六名英雄的造型（七龍珠 FighterZ 同人致敬，全部以程式建模，不使用原作素材）。
# 每個 build_xxx 回傳 dict：body（蒙皮部件）、proxy（算骨熱用的封閉主體）、heads{base,ssj}、extras、allow、custom、palette、faceRect。
# 座標＝three.js 空間（+Y 上、面向 +Z、角色左手在 +X）、A 字綁定姿勢（rig.json 的骨頭位置）。
import math

import bmesh
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree

import kit
from kit import S, V, ang_bump, bump, lerp, smooth

PI = math.pi
FRONT = PI / 2   # loft 的 theta：0＝側向（+X）、pi/2＝前方（+Z）
BACK = -PI / 2

# 綁骨群組 → 允許的骨頭
(G_FREE, G_TORSO, G_ARM_L, G_ARM_R, G_HAND_L, G_HAND_R, G_LEG_L, G_LEG_R, G_FOOT_L, G_FOOT_R,
 G_PELVIS, G_BELT, G_NECK, G_UPPER_L, G_UPPER_R, G_FORE_L, G_FORE_R, G_SHIN_L, G_SHIN_R, G_CHEST) = range(20)
G_CHAIN = 30
G_SKIRT = 31  # 長下襬：骨熱同骨盆群組，再由 skirt_chain_weights 把後片分給擺動鏈
ALLOW = {
    G_TORSO: {'hips', 'torso', 'ribs', 'shL', 'shR'},
    G_ARM_L: {'torso', 'ribs', 'shL', 'elL'}, G_ARM_R: {'torso', 'ribs', 'shR', 'elR'},
    G_UPPER_L: {'ribs', 'shL'}, G_UPPER_R: {'ribs', 'shR'},
    G_FORE_L: {'elL'}, G_FORE_R: {'elR'},
    G_HAND_L: {'wrL'}, G_HAND_R: {'wrR'},
    G_LEG_L: {'hips', 'thL', 'knL'}, G_LEG_R: {'hips', 'thR', 'knR'},
    G_SHIN_L: {'knL'}, G_SHIN_R: {'knR'},
    G_FOOT_L: {'knL', 'anL'}, G_FOOT_R: {'knR', 'anR'},   # 實際權重由 build_heroes 依高度在小腿與腳踝之間分配
    G_PELVIS: {'hips', 'torso', 'thL', 'thR'},
    G_BELT: {'hips', 'torso'},
    G_NECK: {'ribs', 'head'},
    G_CHEST: {'torso', 'ribs'},
}
ALLOW[G_SKIRT] = ALLOW[G_PELVIS]
MIRROR_GRP = {G_ARM_L: G_ARM_R, G_HAND_L: G_HAND_R, G_LEG_L: G_LEG_R, G_FOOT_L: G_FOOT_R, G_UPPER_L: G_UPPER_R, G_FORE_L: G_FORE_R, G_SHIN_L: G_SHIN_R}


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
    return kit.tag(o, pal, mat=4, grp=G_NECK)


# ================================================================ 四肢
def arm_skin(F, pal, muscle=1.0, k=1.0, s0=-0.07, name='armL', grp=G_ARM_L, mat=4):
    """肩到手腕的手臂（左）：三角肌、二頭／三頭肌、前臂肌群、扁的手腕。"""
    up, lo = F.up, F.lo
    ka, kf = F.k_arm * k, F.k_fore * k
    mu = muscle * FZ['muscle']
    # 肌肉起伏參考 GK 雕像：二頭、三頭、三角肌與前臂肌群都明顯隆起
    bic = lambda th: 1 + 0.16 * mu * ang_bump(th, FRONT, 0.95)
    tri = lambda th: 1 + 0.12 * mu * ang_bump(th, BACK, 1.05)
    delt = lambda th: 1 + 0.11 * mu * ang_bump(th, 0, 1.3)
    fore = lambda th: 1 + 0.13 * mu * ang_bump(th, 0.4, 0.9)
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
    return o


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
    """握拳：掌背塊＋四指捲曲＋拇指。"""
    k = F.R['fist'] * scale * (1.0 if F.R.get('style') in ('cool', 'medic', 'staff') else FZ['hand']) / 0.086  # 女性角色維持原本的手
    parts = []
    palm = kit.box_cage('palm', 0.052 * k, 0.086 * k, 0.09 * k, cuts=(1, 1, 1))
    kit.deform(palm, lambda p: V((p.x * (1 - 0.15 * (p.y / (0.043 * k)) ** 2), p.y + 0.042 * k, p.z * (1 - 0.1 * max(0, -p.y) / (0.043 * k)))))
    parts.append(kit.subsurf(palm, 2))
    for i in range(4):
        # 每指三節直的膠囊（彎折處交疊）：一條管子硬折會在內側自我穿插、翻面
        z = (0.031 - i * 0.0205) * k
        rr = (0.0128 - i * 0.0008) * k * (1.12 if glove else 1)
        a = V((0.012 * k, 0.08 * k, z))
        b = V((-0.003 * k, 0.103 * k, z * 1.02))
        c = V((-0.024 * k, 0.1 * k, z * 1.02))
        d = V((-0.02 * k, 0.08 * k, z))
        for j, (p0, p1, r0, r1) in enumerate(((a, b, rr, rr * 1.04), (b, c, rr * 1.02, rr * 0.98), (c, d, rr * 0.97, rr * 0.9))):
            f = path_loft('f%d%d' % (i, j), [p0, (p0 + p1) * 0.5, p1], [r0, (r0 + r1) * 0.52, r1], n=8, front=V((0, 0, 1)), side=V((1, 0, 0)), )
            parts.append(kit.subsurf(f, 1))
    t = path_loft('th', [V((-0.012 * k, 0.03 * k, 0.04 * k)), V((-0.027 * k, 0.06 * k, 0.051 * k)), V((-0.035 * k, 0.085 * k, 0.033 * k)), V((-0.035 * k, 0.091 * k, 0.012 * k))],
                  [0.0165 * k, 0.0155 * k, 0.0135 * k, 0.0115 * k], n=8, front=V((0, 0, 1)), side=V((1, 0, 0)))
    parts.append(kit.subsurf(t, 1))
    for o in parts:
        kit.tag(o, pal, mat=mat, grp=G_HAND_L, ol=0.3)
        # 掌心側（局部 −X）與指縫不描外框：反向殼在捲曲的手指與掌心之間會露出黑點
        kit.paint_ol(o, lambda co: 0.0 if co.x < 0.004 * k else None)
    hand = kit.join(parts, 'handL')
    return place_left_hand(F, hand)


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
def anime_head(name, F, pal_skin, ears=True, jaw=1.0, chin=1.0, cheek=1.0, ear_scale=1.0, pointed_ears=False, cranium=(0.8, 0.9, 0.88), nose=1.0, brow=0.0, extra=(), face_len=1.0, square=0.0):
    """動畫臉：顱骨＋往前下收尖的下顎＋小鼻子＋耳朵，體素聯集後平滑。
    face_len 拉長／縮短下半臉；square＞0 讓下顎角更方（下顎斷面的超橢圓指數變大）。"""
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
                kit.deform(e, lambda p, sx=sx: c + V((sx * (hr * 0.78 + p.x * hr * 0.1 + (p.y + 1) * hr * 0.16), -hr * 0.05 + p.y * hr * 0.42 * ear_scale, -hr * 0.1 + p.z * hr * 0.12 - (p.y + 1) * hr * 0.1)))
            else:
                kit.deform(e, lambda p, sx=sx: c + V((sx * (hr * 0.78 + p.x * hr * 0.1), -hr * 0.12 + p.y * hr * 0.2 * ear_scale, -hr * 0.04 + p.z * hr * 0.1)))
            parts.append(e)
    head = kit.join(parts + list(extra), name)
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


def hair_cap(name, F, pal, scale=1.07, hairline=0.3, temple=0.0, nape=-0.55, side_cut=True, mat=1, thick=0.08):
    """髮帽：顱骨放大一點的殼，前額依 hairline 開口。"""
    c, hr = F.c, F.hr
    cap = kit.quad_sphere(name, 1.0, cuts=10)
    bm = bmesh.new()
    bm.from_mesh(cap.data)
    kill = []
    for v in bm.verts:
        x, y, z = v.co
        hl = hairline + temple * abs(x)
        if (z > 0.2 and y < hl) or y < nape or (side_cut and abs(x) > 0.7 and y < -0.05 and z > -0.35):
            kill.append(v)
    bmesh.ops.delete(bm, geom=kill, context='VERTS')
    bm.to_mesh(cap.data)
    bm.free()
    kit.deform(cap, lambda p: c + V((p.x * hr * 0.8 * scale, p.y * hr * 0.9 * scale + hr * 0.08, p.z * hr * 0.88 * scale - hr * 0.04)))
    cap = kit.subsurf(cap, 1, solidify=hr * thick)
    return kit.tag(cap, pal, mat=mat, grp=G_FREE, ol=0.9)


def bob_cap(name, F, pal, hairline=0.45, length=0.85, flare=0.22, scale=1.12, part=0.0, mat=1, thick=0.09):
    """鮑伯頭：一整片包住頭的髮殼，往下延伸到下巴（length，單位 hr），下緣往外蓬（flare）；前方挖出臉的開口。"""
    c, hr = F.c, F.hr
    cap = kit.quad_sphere(name, 1.0, cuts=12)
    bm = bmesh.new()
    bm.from_mesh(cap.data)
    kill = [v for v in bm.verts if (v.co.z > 0.18 and v.co.y < hairline - 0.25 * abs(v.co.x - part)) or (v.co.z > 0.55 and v.co.y < hairline + 0.15)]
    bmesh.ops.delete(bm, geom=kill, context='VERTS')
    bm.to_mesh(cap.data)
    bm.free()

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
    # 頭部橫向比例（照參考圖量的臉寬）：頭顱、髮型與頭上配件一起以頭心為軸縮放
    hx = F.R.get('hx', 1.0)
    if hx != 1.0:
        c = F.c
        for objs in heads.values():
            for o in objs:
                kit.deform(o, lambda p: V((c.x + (p.x - c.x) * hx, p.y, c.z + (p.z - c.z) * (0.5 + 0.5 * hx))))
    return {
        'body': body, 'proxy': proxy, 'heads': heads, 'extras': extras or {},
        'allow': ALLOW, 'custom': custom or {}, 'palette': P, 'head_center': F.c, 'hr': F.hr,
        'faceRect': [0, F.hr * 0.9 - F.hr * 0.12, F.hr * 1.9 * F.R.get('hx', 1.0), F.hr * 1.9],
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
    blue, blueD = P(0x22409e), P(0x152a68)
    red, yellow = P(0xc8302a), P(0xf0c43a)
    team = P(-1)
    body, proxy = [], []

    # ---- 內衣（藍）：從 V 領露出
    under = kit.loft('under', torso_rows(F, e=0.004, u0=0.3), n=16, cap0=None, cap1=None)
    under = kit.subsurf(under, 2)
    kit.tag(under, blue, grp=G_TORSO)
    body.append(under)
    proxy.append(under)

    # ---- 道服上衣：腰帶下垂出一截衣襬、V 領開口（開口弧放樣，邊緣乾淨）
    rows = [(-0.2, ('w', 1.28), 0.98, 0.02), (-0.08, ('w', 1.2), 0.9, 0.01)] + TORSO_ROWS
    sts = torso_rows(F, e=0.018, rows=rows, pec=0.075, lat=0.09)
    uv0 = 0.48
    us = [r[0] for r in rows]
    gapf = lambda i: 0.0 if us[i] <= uv0 else min(1.25, 0.06 + (us[i] - uv0) * 1.9)
    top = kit.loft('gi_top', sts, n=20, cap0=None, cap1=None, gap=gapf)
    top = kit.subsurf(top, 2, solidify=0.011)
    kit.tag(top, gi, grp=G_TORSO)
    body.append(top)
    proxy.append(top)
    # 衣襟滾邊：沿開口邊界（前方 V 字＋後頸）
    yv = F.y(uv0)
    edge = kit.boundary_chains(top, lambda co: co.y > yv - 0.02)
    for sx in (1, -1):
        side = [p for p in edge if (p.x * sx > 0.0005 or p.z < 0) and p.z > -1]
        # 前方依高度排序，再接後頸（依角度）
        fr = sorted([p for p in side if p.z > F.cz * 0.2], key=lambda p: p.y)
        bk = sorted([p for p in side if p.z <= F.cz * 0.2 and p.y > F.y(0.93)], key=lambda p: -math.atan2(p.z, abs(p.x)))
        pts = fr[::3] + bk[::2]
        if len(pts) < 3:
            continue
        pts = [p + V((0, 0, 0.004)) for p in pts]
        col = path_loft('collar', pts, [0.015] * len(pts), n=6, flat=0.5, cap0='pole', cap1='pole')
        col = kit.subsurf(col, 1)
        kit.tag(col, gi, grp=G_TORSO, ol=0.6)
        body.append(col)

    body.append(neck(F, skin, r=0.064))
    proxy.append(body[-1])

    # ---- 手臂、袖、護腕、拳
    arm = arm_skin(F, skin, muscle=1.25, k=1.12)
    slv = sleeve(F, blue, s1=0.085, r=0.1 * F.k_arm + 0.01, flare=1.03)  # 道服無袖，肩頭露出藍色內衣的短袖（參考 3D 實機影片）
    wb = band('wristL', F.sh, F.da, F.up + 0.15, F.up + F.lo - 0.005, 0.064 * F.k_fore, 0.054 * F.k_fore, blue, G_FORE_L, thick=0.012, rb=0.9)
    hand = fist(F, skin, scale=1.08)
    pair_add(body, proxy, [arm, slv, wb, hand], proxy_set=(arm, hand))
    body.append(band('teamL', F.sh, F.da, 0.155, 0.18, 0.089 * F.k_arm, 0.087 * F.k_arm, team, G_UPPER_L, thick=0.006, mat=5, ol=0.5))

    # ---- 褲子、靴
    body.append(pelvis(F, gi, e=0.012))
    proxy.append(body[-1])
    leg = baggy_leg(F, gi, bag=1.06, blouse=1.12, s_end=F.tl + 0.1)  # 寬燈籠褲，褲管收進到小腿中段的靴子
    bt = boot(F, blue, F.tl + 0.04, 0.082, pal_sole=blueD)
    rim = band('bootRimL', F.th, F.dl, F.tl + 0.025, F.tl + 0.065, 0.086 * F.k_shin + 0.01, 0.084 * F.k_shin + 0.01, yellow, G_FOOT_L, thick=0.009)
    fx = F.sole.x + 0.004
    strap = kit.loft('strapL', [S(V((fx, 0.33, 0.072)), 0.022, 0.008), S(V((fx, 0.245, 0.078)), 0.024, 0.008), S(V((fx + 0.002, 0.15, 0.084)), 0.022, 0.008)], n=6)
    strap = kit.subsurf(strap, 1)
    kit.tag(strap, yellow, grp=G_FOOT_L, ol=0.5)
    pair_add(body, proxy, [leg] + bt + [rim, strap], proxy_set=[leg] + bt)

    # ---- 腰帶、結、垂帶
    yb = F.L + 0.085
    belt = limb('belt', V((0, yb - 0.04, 0)), V((0, 1, 0)), [(0.0, F.w * 1.25, F.cz * 0.95, None, 2.3), (0.04, F.w * 1.29, F.cz * 0.98, None, 2.3), (0.08, F.w * 1.24, F.cz * 0.94, None, 2.3)], n=18, cap0=None, cap1=None)
    belt = kit.subsurf(belt, 2, solidify=0.014)
    kit.tag(belt, blue, grp=G_BELT)
    body.append(belt)
    kz = F.cz * 0.98 + 0.008
    knot = kit.quad_sphere('knot', 1, cuts=3)
    kx = -0.035  # 結打在正前方偏角色右側（參考 3D 實機影片）
    kit.deform(knot, lambda p: V((kx + p.x * 0.036, yb + p.y * 0.032, kz + p.z * 0.022)))
    knot = kit.subsurf(knot, 1)
    kit.tag(knot, blue, grp=G_BELT)
    body.append(knot)
    for k, (dx, w0, ln) in enumerate(((-0.014, 0.032, 0.4), (0.03, 0.029, 0.34))):
        t0 = V((kx + dx, yb - 0.01, kz + 0.004 + 0.006 * k))
        f = kit.loft('flap%d' % k, [S(t0, w0, 0.007), S(t0 + V((0.004, -ln * 0.5, 0.004)), w0 * 1.12, 0.007), S(t0 + V((0.01, -ln, 0.006)), w0 * 0.92, 0.006)], n=8)
        f = kit.subsurf(f, 2)
        kit.tag(f, blue, grp=G_CHAIN, ol=0.7)
        body.append(f)

    # ---- 頭
    heads = {}
    for form in ('base', 'ssj'):
        h = anime_head('head_' + form, F, skin, jaw=1.06, cheek=1.0, square=0.4)  # 成熟的方下巴
        hc = P(0x17130f) if form == 'base' else P(0xffd447)
        heads[form] = [h, hair_cap('cap_' + form, F, hc, hairline=0.42, temple=0.15)] + hair(F, hc, goku_hair(form), grow=1.12 if form == 'base' else 1.05, wmul=1.3)
    return finish(F, P, body, proxy, heads, custom={G_CHAIN: sash_chain_weights(F, 'sash')})


def goku_hair(form):
    if form == 'base':
        return sym([
            # (根部 頭心相對, 尖端, 半寬, 半厚, 彎曲)  單位 hr
            ((0.0, 0.95, 0.15), (0.15, 2.45, -0.25), 0.58, 0.26, (0.05, 0.1, 0)),
            ((0.42, 0.85, 0.1), (1.55, 1.95, -0.25), 0.56, 0.25, (0, 0.18, 0)),
            ((0.72, 0.55, -0.05), (2.0, 1.0, -0.3), 0.52, 0.24, (0, 0.15, 0)),
            ((0.8, 0.12, -0.25), (1.85, -0.2, -0.6), 0.46, 0.22, (0, 0.1, 0)),
            ((0.3, 0.75, -0.55), (1.0, 1.7, -1.4), 0.55, 0.25, (0, 0.1, 0)),
            ((0.0, 0.55, -0.8), (0.1, 1.2, -2.0), 0.55, 0.25, (0, 0.1, 0)),
            ((0.45, 0.2, -0.82), (1.1, -0.15, -1.75), 0.5, 0.23, (0, 0.05, 0)),
            ((0.0, -0.15, -0.9), (0.05, -0.85, -1.55), 0.45, 0.22, (0, 0, 0)),
            ((0.65, 0.65, 0.35), (1.35, 1.35, 0.25), 0.4, 0.2, (0, 0.1, 0)),
            # 瀏海
            ((0.08, 0.82, 0.56), (-0.02, 0.32, 1.02), 0.34, 0.16, (0, 0.05, 0.12)),
            ((-0.3, 0.8, 0.52), (-0.42, 0.28, 0.98), 0.3, 0.15, (0, 0.05, 0.1)),
            ((0.42, 0.76, 0.5), (0.56, 0.3, 0.92), 0.28, 0.14, (0, 0.05, 0.1)),
            ((0.66, 0.6, 0.44), (0.84, 0.05, 0.72), 0.26, 0.13, (0, 0.03, 0.08)),
            ((0.78, 0.15, 0.2), (0.86, -0.4, 0.3), 0.16, 0.08, (0, 0, 0.04)),
        ])
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
    for k, v in {'naruto': cast.build_trunks, 'luffy': cast.build_trunks, 'zoro': cast.build_trunks, 'sasuke': cast.build_trunks, 'kakashi': cast.build_trunks, 'sanji': cast.build_trunks, 'sakura': cast.build_a18, 'nami': cast.build_a18}.items():
        B.setdefault(k, v)
    return B[hid](R)
