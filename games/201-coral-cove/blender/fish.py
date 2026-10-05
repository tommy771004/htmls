# 珊瑚灣垂釣（201）：六種魚 → blender/out/fish.glb
# 每個魚種一副骨架 <id>_rig（骨頭 <id>_b0 頭 → <id>_b3 尾鰭）＋蒙皮網格 <id>，動作 <id>_swim（0.8 s）、<id>_flop（0.4 s）。
# 魚身＝沿長度方向的低多邊形截面環放樣；花紋用逐面材質，圓斑、橢圓與鱗紋用投影到魚身上的貼花（見 DECALS）；鰭是關掉背面剔除的薄片。
# 面向 Blender -Y（glTF +Z），頭在前；原點在身體中心。權重依長度位置手動算漸層，身體平順彎曲。
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *
import random
from math import sin, cos, pi, radians, copysign, sqrt
from mathutils.bvhtree import BVHTree

INK, PAPER = '#3b3732', '#fbf3e2'

# ---------- 魚種定義（長度相關的數值都是全長 L 的比例） ----------
# rings：(s, 半寬, 上半高, 下半高)，s 是魚身（吻端→尾柄）的比例位置。
# tail：尾鰭外緣，(往後比例 0..1, 高度 / L) 由上到下；fins：鰭的色帶 [(t, 色)]。
# pat(s, j)：魚身第 j 面（8 邊時 0,7 背、1,6 上側、2,5 下側、3,4 腹）的顏色，回傳 (外框色, 內色) 會把面內縮成斑點。

def _bands(*ranges):
    return lambda s: any(a <= s <= b for a, b in ranges)


def clown_pat(s, j):
    if _bands((0.16, 0.30), (0.46, 0.62), (0.88, 1.0))(s):
        return 'white'
    return 'orange'


def tang_pat(s, j):
    up = j in (1, 6)
    low = j in (2, 5)
    if s > 0.9:
        return 'yellow'
    if up and 0.08 <= s <= 0.82:
        return 'ink'
    if low and 0.6 <= s <= 0.9:
        return 'ink'
    if j in (3, 4):
        return 'blue_lt'
    return 'blue'


def snapper_pat(s, j):
    return {0: 'back', 7: 'back', 1: 'pink', 6: 'pink', 2: 'light', 5: 'light'}.get(j, 'belly')


def puffer_pat(s, j):
    return 'belly' if j in (3, 4) else 'cream'      # 褐斑另外以貼花圓點加上（見 puffer_spots）


def parrot_pat(s, j):
    if s < 0.04:
        return 'beak'
    if j in (3, 4):
        return 'belly'
    if s < 0.16:
        return 'pink' if j in (2, 5) else 'mint'     # 嘴角一道粉紅
    return 'mint'                                   # 鱗紋另外以貼花弧線加上（見 parrot_scales）


def sardine_pat(s, j):
    return {0: 'back', 5: 'back', 1: 'silver', 4: 'silver'}.get(j, 'belly')


SPECIES = [
    dict(id='clown', L=0.30, Lb=0.78, sides=8, n=2.2, nose_z=-0.01,
         rings=[(0.06, .05, .06, .05), (0.16, .085, .14, .11), (0.30, .115, .19, .14), (0.46, .12, .20, .14),
                (0.62, .105, .17, .12), (0.76, .08, .125, .09), (0.88, .055, .085, .06), (1.0, .035, .055, .045)],
         colors=dict(orange='#ee9a62', white=PAPER, fin='#ee9a62', fin_ink=INK),
         pat=clown_pat, fin_bands=[(0.62, 'fin'), (1.0, 'fin_ink')],
         tail=[(0.55, .13), (0.9, .10), (1.0, 0.0), (0.9, -.10), (0.55, -.13)],
         dorsal=[(0.22, 0), (0.30, .07), (0.42, .075), (0.52, .045), (0.60, .10), (0.72, .10), (0.82, 0)],
         anal=[(0.58, 0), (0.64, .08), (0.76, .07), (0.82, 0)],
         pect=dict(s=0.26, z=-0.25, len=.15), eye=dict(s=0.11, z=0.3, r=.032),
         swim=(5, 6, 14, 26)),
    dict(id='tang', flop=0.65, L=0.40, Lb=0.80, sides=8, n=1.8, nose_z=0.0, decals='oval',
         rings=[(0.05, .04, .07, .06), (0.15, .07, .17, .15), (0.28, .095, .24, .21), (0.44, .10, .26, .22),
                (0.60, .09, .23, .19), (0.74, .07, .16, .13), (0.88, .045, .08, .07), (1.0, .03, .05, .045)],
         colors=dict(blue='#6f9bd1', blue_lt='#a9c3e3', ink=INK, yellow='#f2cf6e', fin='#6f9bd1', fin_ink=INK, fin_y='#f2cf6e'),
         pat=tang_pat, fin_bands=[(0.75, 'fin_ink'), (1.0, 'fin')],
         tail_bands=[(0.8, 'fin_y'), (1.0, 'fin_ink')],
         tail=[(1.0, .16), (0.72, .08), (0.60, 0), (0.72, -.08), (1.0, -.15)],
         dorsal=[(0.14, 0), (0.24, .06), (0.44, .07), (0.66, .07), (0.82, .05), (0.90, 0)],
         anal=[(0.40, 0), (0.50, .06), (0.70, .06), (0.88, 0)],
         pect=dict(s=0.28, z=-0.1, len=.13, bands=[(0.6, 'fin'), (1.0, 'fin_y')]), eye=dict(s=0.12, z=0.35, r=.028),
         swim=(4, 5, 12, 24)),
    dict(id='snapper', L=0.55, Lb=0.72, sides=8, n=2.1, nose_z=0.01,
         rings=[(0.05, .035, .045, .045), (0.14, .07, .10, .09), (0.28, .095, .145, .125), (0.44, .10, .155, .125),
                (0.60, .088, .135, .105), (0.75, .068, .095, .075), (0.88, .045, .06, .05), (1.0, .03, .042, .036)],
         colors=dict(back='#d9837a', pink='#eb9c90', light='#f3bdae', belly='#fbeee4', fin='#eb9c90', fin_lt='#f3bdae'),
         pat=snapper_pat, fin_bands=[(0.6, 'fin'), (1.0, 'fin_lt')],
         tail_bands=[(1.0, 'fin')],
         tail=[(0.45, .15), (1.0, .24), (0.64, .10), (0.40, 0), (0.64, -.10), (1.0, -.23), (0.45, -.14)],
         dorsal=[(0.24, 0), (0.30, .06), (0.50, .055), (0.62, .04), (0.74, .045), (0.84, 0)],
         anal=[(0.62, 0), (0.68, .05), (0.80, .04), (0.86, 0)],
         pect=dict(s=0.26, z=-0.2, len=.12), eye=dict(s=0.10, z=0.4, r=.026),
         swim=(4, 5, 12, 22)),
    # 尾柄短、尾鰭是圓扇（X 形兩片，見 tail_sheets），俯視才讀得出魚尾
    dict(id='puffer', flop=0.65, L=0.36, Lb=0.82, sides=8, n=2.0, nose_z=-0.01, decals='spots', tail_x=42,
         rings=[(0.04, .08, .08, .07), (0.12, .16, .16, .14), (0.24, .22, .215, .19), (0.38, .245, .235, .20),
                (0.52, .235, .225, .19), (0.66, .19, .18, .15), (0.80, .125, .12, .10), (0.91, .07, .07, .06), (1.0, .045, .05, .045)],
         colors=dict(cream='#f2d98f', belly=PAPER, spot='#9b7a55', fin='#e8c983', fin_dk='#c9a35f'),
         pat=puffer_pat, fin_bands=[(0.7, 'fin'), (1.0, 'fin_dk')],
         tail=[(0.40, .11), (0.78, .18), (0.96, .11), (1.0, 0.0), (0.96, -.11), (0.78, -.18), (0.40, -.11)],
         dorsal=[(0.70, 0), (0.76, .06), (0.84, .05), (0.88, 0)],
         anal=[(0.72, 0), (0.78, .05), (0.86, .04), (0.89, 0)],
         pect=dict(s=0.30, z=0.0, len=.09), eye=dict(s=0.14, z=0.45, r=.036),
         swim=(3, 3, 9, 26)),
    dict(id='parrot', L=0.62, Lb=0.80, sides=8, n=2.3, nose_z=-0.015, decals='scales',
         rings=[(0.04, .045, .045, .035), (0.10, .07, .095, .075), (0.22, .10, .14, .11), (0.38, .115, .16, .12),
                (0.54, .11, .155, .115), (0.70, .09, .12, .09), (0.84, .06, .08, .06), (1.0, .04, .055, .045)],
         colors=dict(mint='#8fd1b4', pink='#efa3b0', belly='#cdeee0', beak='#f1ead2', fin='#efa3b0', fin_m='#8fd1b4'),
         pat=parrot_pat, fin_bands=[(0.65, 'fin'), (1.0, 'fin_m')],
         tail_bands=[(0.75, 'fin_m'), (1.0, 'fin')],
         tail=[(1.0, .13), (0.88, .05), (0.84, 0), (0.88, -.05), (1.0, -.13)],
         dorsal=[(0.20, 0), (0.26, .045), (0.60, .045), (0.82, .04), (0.88, 0)],
         anal=[(0.64, 0), (0.70, .04), (0.84, .035), (0.88, 0)],
         pect=dict(s=0.24, z=-0.15, len=.11), eye=dict(s=0.13, z=0.4, r=.024),
         beak=True, swim=(4, 5, 12, 22)),
    dict(id='sardine', L=0.16, Lb=0.80, sides=6, n=2.0, nose_z=0.005,
         rings=[(0.06, .035, .045, .04), (0.18, .06, .08, .075), (0.34, .07, .095, .085), (0.52, .065, .09, .08),
                (0.70, .05, .07, .06), (0.86, .035, .045, .04), (1.0, .022, .03, .028)],
         colors=dict(back='#5f84a0', silver='#c9d6dc', belly='#f3f5f1', fin='#c9d6dc', fin_b='#86a3b8'),
         pat=sardine_pat, fin_bands=[(1.0, 'fin')],
         tail_bands=[(0.7, 'fin'), (1.0, 'fin_b')],
         tail=[(1.0, .15), (0.6, .06), (0.40, 0), (0.6, -.06), (1.0, -.14)],
         dorsal=[(0.38, 0), (0.44, .06), (0.56, .03), (0.60, 0)],
         anal=[(0.74, 0), (0.78, .03), (0.86, .02), (0.88, 0)],
         pect=dict(s=0.24, z=-0.3, len=.10), eye=dict(s=0.12, z=0.3, r=.030),
         swim=(5, 6, 15, 28)),
]


# ---------- 貼花 ----------

def decal_poly(bm, pts, m, lift, fan=False):
    """pts＝[(位置, 法線)]；fan=True 時第一點是中心、其餘是外圈。面朝外（鰭以外的材質有背面剔除）。"""
    vs = [bm.verts.new(p + n * lift) for p, n in pts]
    out = sum((n for _, n in pts), Vector()).normalized()
    if fan:
        c, ring = vs[0], vs[1:]
        faces = [add_face(bm, [c, ring[k], ring[(k + 1) % len(ring)]], m) for k in range(len(ring))]
    else:
        faces = [add_face(bm, vs, m)]
    for f in faces:
        if f:
            f.normal_update()
            if f.normal.dot(out) < 0:
                f.normal_flip()
    return faces


def puffer_spots(sp, bm, mi, surf, Lb):
    """10～14 顆大小不一、位置隨機的圓角褐斑，只在背面與上側。"""
    L = sp['L']
    rnd = random.Random(2011)
    want = 13
    placed = []
    tries = 0
    while len(placed) < want and tries < 4000:
        tries += 1
        s = rnd.uniform(0.13, 0.80)
        th = rnd.uniform(-1.95, 1.95)
        rad = rnd.uniform(0.022, 0.046) * L
        c = surf(s, th)
        if not c:
            continue
        r_loc = c[2]
        ok = True
        for (s2, th2, rad2, r2) in placed:
            ds = (s - s2) * Lb
            dth = (th - th2) * (r_loc + r2) / 2
            if sqrt(ds * ds + dth * dth) < rad + rad2 + 0.03 * L:
                ok = False
                break
        if ok:
            placed.append((s, th, rad, r_loc))
    for (s, th, rad, r_loc) in placed:
        pts = [surf(s, th)[:2]]
        k = 8
        ph0 = rnd.uniform(0, pi)
        sq = rnd.uniform(0.8, 1.0)                  # 略扁的圓
        for i in range(k):
            ph = ph0 + 2 * pi * i / k
            ds = rad * cos(ph) / Lb
            dth = rad * sq * sin(ph) / r_loc
            h = surf(s + ds, th + dth)
            if h:
                pts.append(h[:2])
        decal_poly(bm, pts, mi['spot'], 0.005 * L, fan=True)


def parrot_scales(sp, bm, mi, surf, Lb):
    """鱗紋：隔行錯半格（磚砌），每片鱗只在後緣畫一道往尾巴凸的細粉紅弧線。"""
    L = sp['L']
    rows = [0.20 + 0.085 * i for i in range(9)]     # 每一行鱗的後緣位置（s）
    dth = 2 * pi / 10
    w = 0.016 * L                                   # 弧線寬
    for r, s_back in enumerate(rows):
        off = dth / 2 if r % 2 else 0.0
        th = -2.1 + off
        while th <= 2.1:
            n = 5
            inner, outer = [], []
            for i in range(n):
                f = -1 + 2 * i / (n - 1)
                t = th + f * dth * 0.39            # 弧線比格子窄，鱗與鱗之間留縫
                sb = s_back - 0.045 * f * f        # 中間最靠後：往尾巴凸的弧
                ww = w * (1 - 0.45 * f * f)
                a = surf(sb, t)
                b = surf(sb - ww / Lb, t)
                if not (a and b):
                    break
                outer.append(a[:2])
                inner.append(b[:2])
            else:
                for i in range(n - 1):
                    decal_poly(bm, [outer[i], outer[i + 1], inner[i + 1], inner[i]], mi['pink'], 0.004 * L)
            th += dth


def tang_oval(sp, bm, mi, surf, Lb):
    """藍倒吊黑紋裡的藍色橢圓（兩側各一）：中心＋內外兩圈的扇形貼花，沿魚身拉長。"""
    s0, th0 = 0.385, 0.95            # 中心：身體前段、黑紋的中間高度（th 是從背脊量的繞身角）
    a, b = 0.034, 0.016              # 半長軸（沿魚身）、半短軸（繞身），公尺
    k = 12
    for side in (1, -1):
        c = surf(s0, side * th0)
        r_loc = c[2]
        rings = []
        for f in (0.55, 1.0):
            ring = []
            for i in range(k):
                ph = 2 * pi * i / k
                h = surf(s0 + f * a * cos(ph) / Lb, side * (th0 + f * b * sin(ph) / r_loc))
                ring.append(h[:2])
            rings.append(ring)
        lift = 0.006 * sp['L']
        decal_poly(bm, [c[:2]] + rings[0], mi['blue'], lift, fan=True)
        inn, out = rings
        for i in range(k):
            j = (i + 1) % k
            decal_poly(bm, [inn[i], out[i], out[j], inn[j]], mi['blue'], lift)


DECALS = dict(spots=puffer_spots, scales=parrot_scales, oval=tang_oval)


# ---------- 建模 ----------

def interp_ring(sp, s):
    """在 s 處內插 (半寬, 上半高, 下半高)，單位公尺。"""
    rs = sp['rings']
    L = sp['L']
    if s <= rs[0][0]:
        a = s / rs[0][0]
        return tuple(v * a * L for v in rs[0][1:])
    for (s0, *a), (s1, *b) in zip(rs, rs[1:]):
        if s0 <= s <= s1:
            t = (s - s0) / (s1 - s0)
            return tuple((x + (y - x) * t) * L for x, y in zip(a, b))
    return tuple(v * L for v in rs[-1][1:])


def add_face(bm, vs, mi):
    u = []
    for v in vs:
        if v not in u:
            u.append(v)
    if len(u) < 3:
        return None
    f = bm.faces.new(u)
    f.material_index = mi
    return f


def sheet_fin(bm, R, E, bands, mi):
    """薄片鰭：R 根部點列、E 外緣點列（等長），bands=[(t, 色鍵)] 由根往外分色帶。"""
    ts = [0.0] + [b[0] for b in bands]
    cols = []
    for r, e in zip(R, E):
        if (e - r).length < 1e-6:
            v = bm.verts.new(r)
            cols.append([v] * len(ts))
        else:
            cols.append([bm.verts.new(r.lerp(e, t)) for t in ts])
    for k in range(len(cols) - 1):
        for b in range(len(bands)):
            add_face(bm, [cols[k][b], cols[k + 1][b], cols[k + 1][b + 1], cols[k][b + 1]], mi[bands[b][1]])


def tail_sheets(sp, R, E):
    """尾鰭的薄片：回傳 [(根部點列, 外緣點列)]。R、E 是垂直平面（x = 0）上的尾鰭輪廓。
    做成兩片同形的尾鰭，各自繞身體軸往兩側斜轉 ±tail_x 度（從後面看是 X 形）：
    俯視時兩片的投影重合成一個叉尾／圓扇；側面（舉魚）時兩片也重合，只略矮；
    扭動翻滾時總有一片接近正對鏡頭，不會像單片斜轉那樣整片側對鏡頭變成一根針。"""
    out = []
    for sgn in (1, -1):
        M = Matrix.Rotation(radians(sgn * sp.get('tail_x', 36)), 4, 'Y')
        out.append(([M @ p for p in R], [M @ p for p in E]))
    return out


def build_fish(sp):
    fid, L, n = sp['id'], sp['L'], sp['sides']
    Lb = sp['Lb'] * L
    T = L - Lb
    y0 = -L / 2
    keys = list(sp['colors'].keys())
    mats = []
    for k in keys:
        fin_mat = k.startswith('fin')
        m = mat(f'{fid}_{k}', sp['colors'][k], rough=0.6)
        m.use_backface_culling = not fin_mat      # 鰭是薄片：雙面
        mats.append(m)
    mats.append(mat('fish_eye', INK, rough=0.3))
    mats[-1].use_backface_culling = True
    mats.append(mat('fish_glint', PAPER, rough=0.3))
    mats[-1].use_backface_culling = True
    mi = {k: i for i, k in enumerate(keys)}
    mi['eye'], mi['glint'] = len(keys), len(keys) + 1

    bm = bmesh.new()
    rnd = random.Random(sum(map(ord, fid)))   # 固定種子：每次重建結果相同
    jit = 0.012 * L
    e = 2.0 / sp['n']

    def ring_pt(s, j, w, ht, hb):
        th = 2 * pi * j / n
        sx, cz = sin(th), cos(th)
        x = w * copysign(abs(sx) ** e, sx)
        z = (ht if cz >= 0 else hb) * copysign(abs(cz) ** e, cz)
        return Vector((x, y0 + s * Lb, z))

    rings = []
    for (s, w, ht, hb) in sp['rings']:
        ring = []
        for j in range(n):
            p = ring_pt(s, j, w * L, ht * L, hb * L)
            if 0.03 < s < 0.97:
                p += Vector((rnd.uniform(-1, 1), rnd.uniform(-1, 1) * 0.5, rnd.uniform(-1, 1))) * jit
            ring.append(bm.verts.new(p))
        rings.append(ring)
    tip = bm.verts.new((0, y0, sp['nose_z'] * L))
    last_s = sp['rings'][-1][0]
    tail_c = bm.verts.new((0, y0 + Lb + 0.02 * L, 0))

    body_faces, inset = [], []

    def color(s, j):
        c = sp['pat'](s, j)
        return c if isinstance(c, tuple) else (c, None)

    # 吻端
    s_mid = sp['rings'][0][0] / 2
    for j in range(n):
        c, _ = color(s_mid, j)
        body_faces.append(add_face(bm, [tip, rings[0][(j + 1) % n], rings[0][j]], mi[c]))
    # 魚身
    for i in range(len(rings) - 1):
        s_mid = (sp['rings'][i][0] + sp['rings'][i + 1][0]) / 2
        for j in range(n):
            c, inner = color(s_mid, j)
            f = add_face(bm, [rings[i][j], rings[i][(j + 1) % n], rings[i + 1][(j + 1) % n], rings[i + 1][j]], mi[c])
            body_faces.append(f)
            if inner:
                inset.append((f, mi[inner]))
    # 尾柄封口
    for j in range(n):
        c, _ = color(1.0, j)
        body_faces.append(add_face(bm, [tail_c, rings[-1][j], rings[-1][(j + 1) % n]], mi[c]))
    bmesh.ops.recalc_face_normals(bm, faces=body_faces)
    # 斑點／鱗片：把面內縮，內面換色
    for f, m_in in inset:
        el = min(ed.calc_length() for ed in f.edges)
        bmesh.ops.inset_individual(bm, faces=[f], thickness=el * sp.get('inset', 0.22), depth=0.004 * L, use_even_offset=True)
        f.material_index = m_in

    # 貼花（河豚斑點、鸚哥魚鱗紋）：在 (s, 繞身角) 參數上取點，射線投到真正的魚身面上再略微浮起
    if sp.get('decals'):
        bvh = BVHTree.FromBMesh(bm)

        def surf(s, th):
            d = Vector((sin(th), 0, cos(th)))
            o = Vector((0, y0 + s * Lb, 0))
            loc, nor, _, dist = bvh.ray_cast(o + d * L, -d)
            if loc is None:
                return None
            if nor.dot(d) < 0:
                nor = -nor
            return loc, nor, L - dist

        DECALS[sp['decals']](sp, bm, mi, surf, Lb)

    fin_bands = sp['fin_bands']

    # 尾鰭（見 tail_sheets）
    _, ht_p, hb_p = interp_ring(sp, 1.0)
    ty = y0 + Lb - 0.03 * L
    tail = sp['tail']
    K = len(tail)
    R = [Vector((0, ty, ht_p * 0.8 - (ht_p * 0.8 + hb_p * 0.8) * k / (K - 1))) for k in range(K)]
    E = [Vector((0, y0 + Lb + dy * T, dz * L)) for dy, dz in tail]
    for R2, E2 in tail_sheets(sp, R, E):
        sheet_fin(bm, R2, E2, sp.get('tail_bands', fin_bands), mi)

    # 背鰭／臀鰭：沿背脊、腹脊
    def ridge_fin(spec, top):
        R, E = [], []
        for s, h in spec:
            w, ht, hb = interp_ring(sp, s)
            z = (ht * 0.9) if top else (-hb * 0.9)
            r = Vector((0, y0 + s * Lb, z))
            R.append(r)
            E.append(r + Vector((0, 0.35 * h * L, (h * L) if top else (-h * L))) if h > 0 else r.copy())
        sheet_fin(bm, R, E, fin_bands, mi)
    ridge_fin(sp['dorsal'], True)
    ridge_fin(sp['anal'], False)

    # 胸鰭：往外、往後、略往下的小翼，俯視看得到
    pc = sp['pect']
    for side in (1, -1):
        s = pc['s']
        w, ht, hb = interp_ring(sp, s)
        zc = pc['z'] * (ht if pc['z'] > 0 else hb)
        R, E = [], []
        for k, (ds, ang, ln) in enumerate(((-0.035, 72, 0.7), (0.0, 52, 1.0), (0.035, 30, 0.85))):
            ww, _, _ = interp_ring(sp, s + ds)
            r = Vector((side * ww * 0.85, y0 + (s + ds) * Lb, zc + (0.01 - 0.01 * k) * L))
            a = radians(ang)
            d = Vector((side * sin(a) * cos(radians(22)), cos(a), -sin(a) * sin(radians(22))))
            R.append(r)
            E.append(r + d * pc['len'] * L * ln)
        sheet_fin(bm, R, E, pc.get('bands', fin_bands), mi)

    # 眼睛：小黑點＋一點高光，略凸出好讓俯視也看得到
    ec = sp['eye']
    w, ht, hb = interp_ring(sp, ec['s'])
    zf = ec['z']
    for side in (1, -1):
        x = side * w * sqrt(max(0.0, 1 - zf * zf)) * 0.9
        c = Vector((x, y0 + ec['s'] * Lb, zf * ht))
        r = ec['r'] * L
        ret = bmesh.ops.create_icosphere(bm, subdivisions=1, radius=r,
                                         matrix=Matrix.Translation(c) @ Matrix.Diagonal((0.75, 1, 1, 1)))
        for f in {f for v in ret['verts'] for f in v.link_faces}:
            f.material_index = mi['eye']
        g = c + Vector((side * r * 0.55, -r * 0.35, r * 0.45))
        ret = bmesh.ops.create_icosphere(bm, subdivisions=1, radius=r * 0.32, matrix=Matrix.Translation(g))
        for f in {f for v in ret['verts'] for f in v.link_faces}:
            f.material_index = mi['glint']

    # 鸚哥魚的鳥喙：吻端前面一顆上下兩片的楔形
    if sp.get('beak'):
        bw, bh = 0.062 * L, 0.045 * L
        by = y0 + 0.085 * L
        for zs, zz in ((1, 0.004 * L), (-1, -0.004 * L)):
            vs = [bm.verts.new(p) for p in (
                (-bw, by, zz), (bw, by, zz), (bw * 0.9, by, zz + zs * bh), (-bw * 0.9, by, zz + zs * bh),
                (0, y0, zz + zs * bh * 0.2))]
            fs = [add_face(bm, [vs[0], vs[1], vs[4]], mi['beak']), add_face(bm, [vs[1], vs[2], vs[4]], mi['beak']),
                  add_face(bm, [vs[2], vs[3], vs[4]], mi['beak']), add_face(bm, [vs[3], vs[0], vs[4]], mi['beak']),
                  add_face(bm, [vs[0], vs[3], vs[2], vs[1]], mi['beak'])]
            bmesh.ops.recalc_face_normals(bm, faces=[f for f in fs if f])

    # 原點：身體上下置中（y 已經以全長置中）
    zs = [v.co.z for f in body_faces for v in f.verts]
    zoff = (max(zs) + min(zs)) / 2
    for v in bm.verts:
        v.co.z -= zoff

    me = bpy.data.meshes.new(fid)
    bm.to_mesh(me)
    bm.free()
    o = link(bpy.data.objects.new(fid, me))
    for m in mats:
        o.data.materials.append(m)
    flat(o)
    return o


# ---------- 骨架、權重、動作 ----------

def rig_fish(sp, o):
    fid, L = sp['id'], sp['L']
    y0 = -L / 2
    Lb = sp['Lb']
    u = lambda f: y0 + f * L       # 全長比例 → y
    up, u1 = 0.36, 0.58
    ub = Lb * 0.98
    b = [f'{fid}_b{k}' for k in range(4)]
    arm = armature(f'{fid}_rig', [
        (b[0], (0, u(up), 0), (0, u(0.04), 0), None),          # 頭：從身體樞紐指向吻端
        (b[1], (0, u(up), 0), (0, u(u1), 0), b[0]),
        (b[2], (0, u(u1), 0), (0, u(ub), 0), b[1]),
        (b[3], (0, u(ub), 0), (0, u(1.0), 0), b[2]),          # 尾鰭
    ])
    # 依長度位置的分段線性權重（每根骨頭一個中心點）
    knots = [0.18, (up + u1) / 2, (u1 + ub) / 2, ub + (1 - ub) * 0.25]
    vgs = [o.vertex_groups.new(name=n) for n in b]
    for v in o.data.vertices:
        f = (v.co.y - y0) / L
        if f <= knots[0]:
            w = {0: 1.0}
        elif f >= knots[-1]:
            w = {3: 1.0}
        else:
            for k in range(3):
                if knots[k] <= f <= knots[k + 1]:
                    t = (f - knots[k]) / (knots[k + 1] - knots[k])
                    t = t * t * (3 - 2 * t)
                    w = {k: 1 - t, k + 1: t}
                    break
        for k, x in w.items():
            if x > 1e-4:
                vgs[k].add([v.index], x, 'REPLACE')
    o.parent = arm
    m = o.modifiers.new('Armature', 'ARMATURE')
    m.object = arm
    return arm


def animate(sp, arm):
    fid = sp['id']
    b = [f'{fid}_b{k}' for k in range(4)]
    A = sp['swim']

    def key(f, world, roll=0.0):
        loc = [world[0]] + [world[k] - world[k - 1] for k in range(1, 4)]
        rots = {b[k]: (0, 0, loc[k]) for k in range(4)}
        rots[b[0]] = (0, roll, loc[0])
        pose(arm, f, rots)

    # swim：0.8 s＝24 格，尾巴大幅左右擺、波往後傳，頭小幅反向
    begin_action(arm, f'{fid}_swim')
    for f in range(25):
        ph = 2 * pi * f / 24
        key(f, [A[0] * sin(ph), A[1] * sin(ph - 0.5), A[2] * sin(ph - 1.1), A[3] * sin(ph - 1.8)])
    end_action(arm, cyclic=True, interp='LINEAR')

    # flop：0.4 s＝12 格，被釣起時左右甩成 C 字、帶一點翻滾。
    # 尾端最多甩 42°：再大的話舉魚鏡頭（偏向魚頭斜看）會有好幾格順著尾鰭方向看過去，尾巴只剩一小截。
    def snap(x):
        return copysign(abs(x) ** 0.55, x)
    begin_action(arm, f'{fid}_flop')
    for f in range(13):
        ph = 2 * pi * f / 12
        k = sp.get('flop', 1.0)      # 寬身／高身的魚彎小一點，避免內側擠進身體
        key(f, [26 * k * snap(cos(ph)), -10 * k * snap(cos(ph - 0.3)), -28 * k * snap(cos(ph - 0.6)), -42 * k * snap(cos(ph - 1.0))],
            roll=14 * sin(ph))
    end_action(arm, cyclic=True, interp='LINEAR')


def main():
    reset()
    arms = []
    for i, sp in enumerate(SPECIES):
        o = build_fish(sp)
        arm = rig_fish(sp, o)
        animate(sp, arm)
        arms.append((sp, arm))
    for sp, arm in arms:
        stash_actions(arm, names=[f"{sp['id']}_swim", f"{sp['id']}_flop"])
    export_glb('fish.glb')          # 全部在原點匯出（根節點位置由遊戲重設）
    if '--no-preview' in sys.argv:
        return
    # 預覽排版：沿 x 排開
    x = 0.0
    for sp, arm in arms:
        arm.location.x = x
        x += 0.75
    bpy.context.view_layer.update()
    mid = (x - 0.75) / 2
    render('fish_top', target=(mid, 0, 0), view='top', ortho=4.6, size=(1400, 360))
    render('fish_front', target=(mid, 0, 0), view='front', ortho=4.6, size=(1400, 360))
    render('fish_three', target=(mid, 0, 0), view='three', ortho=4.6, size=(1400, 600))
    # 側視：改成沿 z 疊放
    for i, (sp, arm) in enumerate(arms):
        arm.location = (0, 0, -i * 0.4)
    bpy.context.view_layer.update()
    render('fish_side', target=(0, 0, -1.0), view='side', ortho=2.6, size=(600, 900))
    for i, (sp, arm) in enumerate(arms):
        arm.location = (i * 0.75, 0, 0)
    bpy.context.view_layer.update()
    for sp, arm in arms:
        fid = sp['id']
        sheet(f'fish_{fid}_swim_top', arm, f'{fid}_swim', [0, 4, 8, 12, 16, 20], target=(arm.location.x, 0, 0),
              view='top', ortho=sp['L'] * 1.6, cell=200)


main()
