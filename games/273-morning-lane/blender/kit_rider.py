# 騎士與腳踏車。身體與衣服用 skin modifier 從骨架長出來；腿與手臂用兩段 IK 擺到踏板與握把。
# 腳踏車：26 吋城市車（輻條、鏈條、擋泥板、後架、前籃），車架薄荷綠。座標：車頭朝 +Y。
import bpy, math, random
from mathutils import Matrix, Vector
from kit_common import Acc, mat, srgb, coll, parent_all, skin_mesh, prim_sphere

def ik2(a, target, L1, L2, pole):
    a, target, pole = Vector(a), Vector(target), Vector(pole)
    d = target - a; dist = min(d.length, L1 + L2 - 1e-3); dn = d.normalized()
    x = (L1 * L1 - L2 * L2 + dist * dist) / (2 * dist); h = math.sqrt(max(L1 * L1 - x * x, 0))
    side = (pole - dn * pole.dot(dn)).normalized()
    return a + dn * x + side * h, a + dn * dist

def _arc(acc, c, R, a0, a1, width, thick, axis_x=0.0, n=18):
    """擋泥板：在 YZ 平面上以 c 為圓心的弧帶。"""
    for i in range(n):
        t0 = a0 + (a1 - a0) * i / n; t1 = a0 + (a1 - a0) * (i + 1) / n
        p0 = c + Vector((0, math.cos(t0) * R, math.sin(t0) * R)); p1 = c + Vector((0, math.cos(t1) * R, math.sin(t1) * R))
        m = (p0 + p1) / 2; tang = (p1 - p0)
        acc.tube(p0, p1, width / 2, n=6)

# 轉向軸：頭管下端 → 上端（和 bike() 的 ht_bot／ht_top 一樣）；執行時前叉＋龍頭＋把手繞這條軸轉 −steer × STEER_RAD（src/view/rider.js）
HT_BOT, HT_TOP, STEER_RAD = Vector((0, 0.45, 0.76)), Vector((0, 0.40, 0.90)), 0.3
SKEL = {}   # rider() 最後一次呼叫時，手臂相關零件的骨架：{物件名: (節點, 邊, 半徑)}；export.py 用它把回正姿勢的網格蒙皮到轉向姿勢
def steer_pt(p, steer):
    return HT_BOT + Matrix.Rotation(-steer * STEER_RAD, 3, (HT_TOP - HT_BOT).normalized()) @ (p - HT_BOT)

def bike(name, pedal=0.0, C=None):
    fr = Acc(1); dk = Acc(2); ti = Acc(3); sp = Acc(4); ch = Acc(5); br = Acc(6); bk = Acc(7)
    rear, front = Vector((0, -0.53, 0.34)), Vector((0, 0.55, 0.34))
    bb = Vector((0, -0.06, 0.30)); st_top = Vector((0, -0.23, 0.84)); ht_top = Vector((0, 0.40, 0.90)); ht_bot = Vector((0, 0.45, 0.76))
    for a, b, r in ((bb, st_top, 0.019), (bb, ht_bot, 0.022), (st_top + Vector((0, 0.02, -0.06)), ht_top + Vector((0, 0.01, -0.05)), 0.018), (ht_bot, ht_top, 0.024)):
        fr.tube(a, b, r, n=10)
    for e in (-1, 1):
        fr.tube(bb + Vector((e * 0.03, 0, 0)), rear + Vector((e * 0.06, 0, 0)), 0.011, n=8)
        fr.tube(st_top + Vector((e * 0.02, -0.01, -0.06)), rear + Vector((e * 0.06, 0, 0)), 0.01, n=8)
        mid = ht_bot + Vector((e * 0.04, 0.05, -0.2))
        fr.tube(ht_bot + Vector((e * 0.02, 0, 0)), mid, 0.014, n=8); fr.tube(mid, front + Vector((e * 0.05, 0, 0)), 0.012, n=8)
    # 輪子：外胎、輪框、花鼓、32 根輻條
    for c in (rear, front):
        ti_t = 0.026
        for k in range(28):
            t0, t1 = k / 28 * math.tau, (k + 1) / 28 * math.tau
            ti.tube(c + Vector((0, math.cos(t0) * 0.31, math.sin(t0) * 0.31)), c + Vector((0, math.cos(t1) * 0.31, math.sin(t1) * 0.31)), ti_t, n=8)
            dk.tube(c + Vector((0, math.cos(t0) * 0.285, math.sin(t0) * 0.285)), c + Vector((0, math.cos(t1) * 0.285, math.sin(t1) * 0.285)), 0.009, n=5)
        dk.tube(c + Vector((-0.045, 0, 0)), c + Vector((0.045, 0, 0)), 0.022, n=10)
        for k in range(32):
            t = k / 32 * math.tau + (0.1 if k % 2 else -0.1); e = 1 if k % 2 else -1
            sp.tube(c + Vector((e * 0.03, math.cos(t + e * 0.35) * 0.025, math.sin(t + e * 0.35) * 0.025)),
                    c + Vector((0, math.cos(t) * 0.28, math.sin(t) * 0.28)), 0.0022, n=3)
    # 擋泥板
    _arc(fr, rear, 0.36, math.radians(15), math.radians(175), 0.05, 0.01)
    _arc(fr, front, 0.36, math.radians(5), math.radians(150), 0.05, 0.01)
    # 座管、坐墊
    seat = Vector((0, -0.26, 0.97))
    dk.tube(st_top, seat, 0.013, n=8)
    saddle = prim_sphere(f'{name}_saddle', (0, -0.25, 0.995), 1.0, mat('saddle', var=0.0, brush=0.1, rough=0.6), (0.085, 0.14, 0.03), 3, C)
    # 龍頭與後掠把手
    stem_top = Vector((0, 0.37, 1.03)); dk.tube(ht_top, stem_top, 0.014, n=8)
    pts = [Vector((-0.3, 0.24, 1.05)), Vector((-0.22, 0.33, 1.05)), Vector((-0.08, 0.38, 1.04)), Vector((0.08, 0.38, 1.04)), Vector((0.22, 0.33, 1.05)), Vector((0.3, 0.24, 1.05))]
    for a, b in zip(pts, pts[1:]): dk.tube(a, b, 0.011, n=8)
    for e in (-1, 1):
        br.tube(Vector((e * 0.3, 0.24, 1.05)), Vector((e * 0.32, 0.14, 1.045)), 0.017, n=8)
    dk.tube(Vector((-0.17, 0.35, 1.055)), Vector((-0.17, 0.35, 1.08)), 0.02, n=10)   # 鈴
    # 曲柄、踏板、齒盤、鏈條
    ch.tube(bb + Vector((0.06, 0, 0)), bb + Vector((0.07, 0, 0)), 0.1, n=24)
    pd = {}
    for e, ph in ((1, pedal), (-1, pedal + math.pi)):
        p = bb + Vector((e * 0.1, math.cos(ph) * 0.17, math.sin(ph) * 0.17)); pd[e] = p
        dk.tube(bb + Vector((e * 0.08, 0, 0)), p, 0.012, n=6)
        bk.box(p + Vector((e * 0.05, 0, 0)), (0.1, 0.09, 0.025))
    ch.tube(rear + Vector((0.065, 0, 0)), rear + Vector((0.07, 0, 0)), 0.05, n=16)
    for dz in (0.1, -0.1):
        ch.tube(bb + Vector((0.067, 0, dz)), rear + Vector((0.067, 0, dz * 0.5)), 0.006, n=4)
    # 後架與前籃
    for e in (-1, 1):
        fr.tube(rear + Vector((e * 0.07, 0, 0)), Vector((e * 0.08, -0.6, 0.72)), 0.008, n=6)
        fr.tube(Vector((e * 0.08, -0.32, 0.72)), Vector((e * 0.08, -0.72, 0.72)), 0.009, n=6)
    for k in range(4): fr.tube(Vector((-0.08, -0.36 - k * 0.11, 0.725)), Vector((0.08, -0.36 - k * 0.11, 0.725)), 0.006, n=5)
    bc = Vector((0, 0.68, 0.9))
    for z in (0.0, 0.09, 0.18):    # 籃子：編織橫帶
        for a, b in (((-0.19, -0.14), (0.19, -0.14)), ((0.19, -0.14), (0.19, 0.14)), ((0.19, 0.14), (-0.19, 0.14)), ((-0.19, 0.14), (-0.19, -0.14))):
            bk.tube(bc + Vector((a[0], a[1], z)), bc + Vector((b[0], b[1], z)), 0.012, n=5)
    for k in range(9):
        x = -0.19 + k * 0.0475
        bk.tube(bc + Vector((x, -0.14, 0)), bc + Vector((x, -0.14, 0.19)), 0.008, n=4); bk.tube(bc + Vector((x, 0.14, 0)), bc + Vector((x, 0.14, 0.19)), 0.008, n=4)
    bk.box(bc + Vector((0, 0, -0.005)), (0.38, 0.28, 0.02))
    fr.tube(ht_bot + Vector((0, 0.02, 0.02)), bc + Vector((0, -0.14, 0.05)), 0.008, n=5)
    lamp = prim_sphere(f'{name}_lamp', (0, 0.5, 0.82), 0.04, mat('trim', color=srgb('#fff6dc'), var=0.0, rough=0.2), (1, 1.2, 1), 2, C)
    objs = [fr.obj(f'{name}_frame', mat('frame', var=0.0, brush=0.05, rough=0.35, grime=0.0), coll=C, smooth=True),
            dk.obj(f'{name}_metal', mat('chrome', var=0.0, rough=0.3, grime=0.0), coll=C, smooth=True),
            ti.obj(f'{name}_tires', mat('tire', var=0.0, rough=0.85, grime=0.0), coll=C, smooth=True),
            sp.obj(f'{name}_spokes', mat('chrome', var=0.0, rough=0.3, grime=0.0), coll=C),
            ch.obj(f'{name}_chain', mat('tire', color=srgb('#3a3a3d'), var=0.0, rough=0.4, grime=0.0), coll=C, smooth=True),
            br.obj(f'{name}_grips', mat('saddle', var=0.0, rough=0.7), coll=C, smooth=True),
            bk.obj(f'{name}_basket', mat('bag', color=srgb('#b58e57'), var=0.2, brush=0.3, rough=0.9), coll=C, smooth=True),
            saddle, lamp]
    return objs, pd

def papers(acc, band, base, n, rng, axis=Vector((0, 0, 1)), spread=0.06, length=0.3):
    for k in range(n):
        off = Vector((rng.uniform(-spread, spread), rng.uniform(-spread, spread), 0))
        tilt = Vector((rng.uniform(-0.25, 0.25), rng.uniform(-0.25, 0.25), 0))
        d = (axis + tilt).normalized()
        a = base + off; b = a + d * length
        acc.tube(a, b, 0.038, n=10)
        mid = a.lerp(b, 0.55); band.tube(mid - d * 0.025, mid + d * 0.025, 0.04, n=10)

def rider(name, loc=(0, 0, 0), rz=0.0, pedal=0.6, throw=False, C=None, seed=7, steer=0.0):
    """steer：把手轉向（−1～1，× STEER_RAD 繞頭管軸轉；只影響手握的位置，車本身由執行時轉）"""
    C = C or coll('rider'); rng = random.Random(seed); SKEL.clear()
    objs, pd = bike(name + '_bike', pedal, C)
    M = lambda k, **kw: mat(k, **{'var': 0.0, 'brush': 0.12, 'rough': 0.8, 'grime': 0.0, **kw})
    # 骨架
    pelvis = Vector((0, -0.24, 1.03)); lumbar = Vector((0, -0.15, 1.2)); chest = Vector((0, -0.04, 1.36))
    neck = Vector((0, 0.02, 1.47)); headc = Vector((0, 0.07, 1.62))
    hips = {e: pelvis + Vector((e * 0.09, 0.02, -0.03)) for e in (-1, 1)}
    knees, ankles = {}, {}
    for e in (-1, 1):
        tgt = pd[e] + Vector((e * 0.0, -0.04, 0.075))
        knees[e], ankles[e] = ik2(hips[e], tgt, 0.43, 0.42, Vector((e * 0.05, 1, 0.4)))
    sh = {e: chest + Vector((e * 0.17, 0.0, 0.06)) for e in (-1, 1)}
    grip = {e: Vector((e * 0.3, 0.2, 1.06)) for e in (-1, 1)}
    elbows, wrists = {}, {}
    for e in (-1, 1):
        if throw and e == 1:
            wrists[e] = sh[e] + Vector((0.5, 0.18, 0.1)); elbows[e] = sh[e] + Vector((0.26, 0.02, 0.02))
        else:
            elbows[e], wrists[e] = ik2(sh[e], steer_pt(grip[e] + Vector((0, -0.05, 0.02)), steer), 0.27, 0.25, Vector((e * 1, -0.3, -0.6)))
    # 皮膚：頸、前臂＋手（含拇指）、小腿
    skin = M('skin', brush=0.06, rough=0.6)
    out = []
    out.append(skin_mesh(f'{name}_neck', [neck + Vector((0, -0.01, -0.03)), headc + Vector((0, -0.02, -0.1))], [(0, 1)], [0.05, 0.048], skin, c=C))
    for e in (-1, 1):
        wdir = (wrists[e] - elbows[e]).normalized()
        palm = wrists[e] + wdir * 0.07; tip = palm + wdir * 0.06 + Vector((0, 0, -0.025))
        thumb = wrists[e] + wdir * 0.04 + Vector((-e * 0.035 if not (throw and e == 1) else 0, 0, 0.03))
        av, ae, ar = [elbows[e], wrists[e], palm, tip, thumb], [(0, 1), (1, 2), (2, 3), (1, 4)], [0.042, 0.032, (0.042, 0.022), (0.036, 0.02), 0.014]
        out.append(skin_mesh(f'{name}_arm{e}', av, ae, ar, skin, c=C)); SKEL[f'{name}_arm{e}'] = (av, ae, ar)
        out.append(skin_mesh(f'{name}_shin{e}', [knees[e], knees[e].lerp(ankles[e], 0.4), ankles[e]], [(0, 1), (1, 2)], [0.05, 0.048, 0.033], skin, c=C))
    # 帽 T：連帽衫（軀幹＋上臂，袖子捲到手肘）
    hood_m = M('hoodie', brush=0.25, rough=0.95)
    hv = [pelvis + Vector((0, 0.01, 0.0)), lumbar, chest, neck + Vector((0, -0.01, -0.02)), sh[-1], elbows[-1], sh[1], elbows[1]]
    he = [(0, 1), (1, 2), (2, 3), (2, 4), (4, 5), (2, 6), (6, 7)]
    hr = [(0.15, 0.115), (0.15, 0.11), (0.165, 0.12), (0.075, 0.07), 0.07, 0.055, 0.07, 0.055]
    out.append(skin_mesh(f'{name}_hoodie', hv, he, hr, hood_m, root=0, c=C)); SKEL[f'{name}_hoodie'] = (hv, he, hr)
    for e in (-1, 1):   # 捲起的袖口
        d = (elbows[e] - sh[e]).normalized(); a = Acc(30 + e); a.tube(elbows[e] - d * 0.035, elbows[e] + d * 0.005, 0.06, n=12)
        SKEL[f'{name}_cuff{e}'] = ([sh[e], elbows[e] - d * 0.035, elbows[e] + d * 0.005], [(0, 1), (1, 2)], [0.06, 0.06, 0.06])
        out.append(a.obj(f'{name}_cuff{e}', M('hoodieDark', brush=0.2), coll=C, smooth=True, subsurf=1))
    hood = prim_sphere(f'{name}_hood', neck + Vector((0, -0.1, 0.02)), 0.12, M('hoodieDark', brush=0.3), (1.15, 0.7, 0.55), 3, C, displace=0.02)
    out.append(hood)
    det = Acc(40)
    det.box(chest.lerp(lumbar, 0.75) + Vector((0, 0.115, -0.03)), (0.2, 0.025, 0.12))      # 口袋
    for e in (-1, 1): det.tube(neck + Vector((e * 0.035, 0.06, -0.02)), neck + Vector((e * 0.04, 0.1, -0.2)), 0.006, n=5)   # 帽繩
    out.append(det.obj(f'{name}_hoodDet', M('hoodieDark', brush=0.2), coll=C, bevel=0.01))
    # 短褲
    sv = [pelvis + Vector((0, 0.0, 0.02)), hips[-1], knees[-1].lerp(hips[-1], 0.18), hips[1], knees[1].lerp(hips[1], 0.18)]
    out.append(skin_mesh(f'{name}_shorts', sv, [(0, 1), (1, 2), (0, 3), (3, 4)], [(0.15, 0.12), 0.095, 0.08, 0.095, 0.08], M('shorts', brush=0.3, rough=0.9), c=C))
    # 襪子與球鞋
    for e in (-1, 1):
        fwd = Vector((0, 1, 0)); a = ankles[e]
        so = Acc(50 + e); so.tube(a + Vector((0, 0, -0.01)), a + Vector((0, 0, 0.06)), 0.04, n=10)
        out.append(so.obj(f'{name}_sock{e}', M('sock'), coll=C, smooth=True))
        heel = a + Vector((0, -0.05, -0.045)); ball = a + Vector((0, 0.09, -0.06)); toe = a + Vector((0, 0.16, -0.055))
        out.append(skin_mesh(f'{name}_shoe{e}', [heel, a + Vector((0, 0.02, -0.03)), ball, toe], [(0, 1), (1, 2), (2, 3)],
                             [(0.045, 0.04), (0.05, 0.045), (0.05, 0.034), (0.04, 0.028)], M('sneaker', rough=0.6), c=C))
        sl = Acc(60 + e); sl.box((a + Vector((0, 0.05, -0.095))), (0.1, 0.27, 0.025))
        out.append(sl.obj(f'{name}_sole{e}', M('sole'), coll=C, bevel=0.01))
        st = Acc(70 + e); st.box(a + Vector((e * 0.05, 0.04, -0.06)), (0.008, 0.12, 0.025), (0, 0.0, 0.0))
        out.append(st.obj(f'{name}_stripe{e}', M('sneakerAccent'), coll=C))
    # 頭：臉形（頭骨＋下巴）、耳、鼻、眼、眉、嘴
    face = M('skin', brush=0.05, rough=0.55)
    out.append(prim_sphere(f'{name}_skull', headc, 1.0, face, (0.1, 0.112, 0.12), 4, C))
    out.append(prim_sphere(f'{name}_jaw', headc + Vector((0, 0.035, -0.06)), 1.0, face, (0.078, 0.075, 0.07), 3, C))
    for e in (-1, 1):
        out.append(prim_sphere(f'{name}_ear{e}', headc + Vector((e * 0.098, -0.005, -0.01)), 1.0, face, (0.018, 0.03, 0.04), 2, C))
        out.append(prim_sphere(f'{name}_eye{e}', headc + Vector((e * 0.04, 0.1, 0.005)), 1.0, M('eye', rough=0.2), (0.014, 0.01, 0.02), 2, C))
        out.append(prim_sphere(f'{name}_spark{e}', headc + Vector((e * 0.04 + 0.005, 0.108, 0.012)), 0.004, M('trim', emit=0.5), sub=1, c=C))
        br = Acc(80 + e); br.box(headc + Vector((e * 0.042, 0.105, 0.04)), (0.04, 0.01, 0.009), (0, 0, 0), )
        out.append(br.obj(f'{name}_brow{e}', M('hair'), coll=C, bevel=0.003))
        out.append(prim_sphere(f'{name}_cheek{e}', headc + Vector((e * 0.06, 0.088, -0.035)), 1.0, M('lip', color=srgb('#e7907a')), (0.022, 0.008, 0.016), 2, C))
    out.append(prim_sphere(f'{name}_nose', headc + Vector((0, 0.115, -0.02)), 1.0, face, (0.016, 0.022, 0.02), 2, C))
    mo = Acc(90); mo.box(headc + Vector((0, 0.104, -0.065)), (0.035, 0.01, 0.007)); out.append(mo.obj(f'{name}_mouth', M('lip'), coll=C, bevel=0.003))
    # 頭髮（帽子下露出的鬢角與後腦）與反戴的棒球帽
    hair = M('hair', brush=0.4, rough=0.9)
    for k, off in enumerate([(0, -0.05, 0.02), (-0.05, -0.07, -0.04), (0.05, -0.07, -0.04), (0, -0.085, -0.05)]):
        out.append(prim_sphere(f'{name}_hair{k}', headc + Vector(off), 1.0, hair, (0.06, 0.06, 0.07), 2, C, displace=0.01))
    capm = M('cap', brush=0.2, rough=0.85)
    crown = prim_sphere(f'{name}_cap', headc + Vector((0, -0.01, 0.045)), 1.0, capm, (0.108, 0.118, 0.085), 3, C)
    out.append(crown)
    cb = Acc(91); cb.box(headc + Vector((0, -0.15, 0.03)), (0.17, 0.11, 0.012), (-0.18, 0, 0))   # 帽簷朝後
    cb.box(headc + Vector((0, 0.0, 0.135)), (0.025, 0.025, 0.015))
    out.append(cb.obj(f'{name}_brim', M('capDark'), coll=C, bevel=0.02))
    # 斜背報袋（右臀）＋ 背帶 ＋ 露出的報紙卷
    bag = Acc(92); bag.box(pelvis + Vector((0.2, 0.0, 0.0)), (0.13, 0.36, 0.3))
    out.append(bag.obj(f'{name}_bag', M('bag', brush=0.35, rough=0.95), coll=C, bevel=0.035, subsurf=1))
    flap = Acc(93); flap.box(pelvis + Vector((0.27, 0.0, 0.08)), (0.03, 0.37, 0.16))
    out.append(flap.obj(f'{name}_flap', M('bagDark', brush=0.3), coll=C, bevel=0.012))
    strap = Acc(94)
    sp = [pelvis + Vector((0.2, -0.05, 0.14)), lumbar + Vector((0.12, 0.1, 0.05)), chest + Vector((0.0, 0.13, 0.02)), sh[-1] + Vector((0.02, 0.02, 0.06)),
          chest + Vector((-0.05, -0.13, 0.04)), lumbar + Vector((0.1, -0.12, 0.0)), pelvis + Vector((0.2, -0.04, 0.12))]
    for a, b in zip(sp, sp[1:]): strap.tube(a, b, 0.018, n=6)
    out.append(strap.obj(f'{name}_strap', M('strap', rough=0.7), coll=C, smooth=True))
    pp = Acc(95); band = Acc(96)
    papers(pp, band, pelvis + Vector((0.2, 0.0, 0.05)), 5, rng, Vector((0, 0, 1)), 0.05, 0.26)
    papers(pp, band, Vector((0, 0.68, 0.92)), 4, rng, Vector((0, 0.3, 1)), 0.08, 0.3)
    if throw:
        held = wrists[1] + Vector((0.06, 0.0, 0.0))
        pp.tube(held - Vector((0.0, 0.14, -0.04)), held + Vector((0.0, 0.16, 0.0)), 0.04, n=10)
    out.append(pp.obj(f'{name}_papers', newsprint_mat(), coll=C, smooth=True))
    out.append(band.obj(f'{name}_bands', M('band'), coll=C, smooth=True))
    return parent_all(name, objs + out, loc, rz)

def newsprint_mat():
    """報紙：米白底＋細密的灰色文字欄（波紋條帶）。"""
    if 'newsprint' in bpy.data.materials: return bpy.data.materials['newsprint']
    m = bpy.data.materials.new('newsprint'); m.use_nodes = True; nt = m.node_tree; nt.nodes.clear(); N, L = nt.nodes, nt.links
    out = N.new('ShaderNodeOutputMaterial'); tc = N.new('ShaderNodeTexCoord')
    wv = N.new('ShaderNodeTexWave'); wv.wave_type = 'BANDS'; wv.bands_direction = 'Z'; wv.inputs['Scale'].default_value = 60; wv.inputs['Distortion'].default_value = 2
    L.new(tc.outputs['Object'], wv.inputs['Vector'])
    mx = N.new('ShaderNodeMix'); mx.data_type = 'RGBA'; mx.inputs[6].default_value = srgb('#ebe5d5'); mx.inputs[7].default_value = srgb('#9a978f')
    gt = N.new('ShaderNodeMath'); gt.operation = 'GREATER_THAN'; L.new(wv.outputs['Fac'], gt.inputs[0]); gt.inputs[1].default_value = 0.72
    sc = N.new('ShaderNodeMath'); sc.operation = 'MULTIPLY'; L.new(gt.outputs[0], sc.inputs[0]); sc.inputs[1].default_value = 0.6
    L.new(sc.outputs[0], mx.inputs['Factor'])
    pb = N.new('ShaderNodeBsdfPrincipled'); pb.inputs['Roughness'].default_value = 0.85
    L.new(mx.outputs[2], pb.inputs['Base Color']); L.new(pb.outputs[0], out.inputs['Surface'])
    return m

def flying_paper(name, loc, rz):
    a = Acc(97); b = Acc(98); s = Acc(99)
    a.tube(Vector((-0.17, 0, 0)), Vector((0.17, 0, 0)), 0.04, n=12); b.tube(Vector((-0.03, 0, 0)), Vector((0.03, 0, 0)), 0.042, n=12)
    for k in range(4): s.box(Vector((-0.45 - k * 0.05, (k - 1.5) * 0.06, (k % 2) * 0.04)), (0.5 - k * 0.08, 0.008, 0.008))
    C = coll('rider')
    objs = [a.obj(name + '_r', newsprint_mat(), coll=C, smooth=True), b.obj(name + '_b', mat('band', var=0.0), coll=C, smooth=True),
            s.obj(name + '_s', mat('trim', emit=0.8, alpha=0.6, var=0.0, grime=0.0), coll=C)]
    return parent_all(name, objs, loc, rz)
