# 貝吉塔、特南克斯、比克、弗利沙、18 號（悟空與共用工具在 heroes.py）。
import math

from mathutils import Matrix

import kit
from kit import S, V, ang_bump, bump, lerp, smooth
from heroes import (
    ALLOW, BACK, FRONT, G_ARM_L, G_BELT, G_CHAIN, G_FOOT_L, G_FORE_L, G_FREE, G_HAND_L, G_LEG_L, G_NECK, G_PELVIS, G_TORSO,
    G_UPPER_L, G_CHEST, PI, TORSO_ROWS, Fig, anime_head, arm_skin, band, boot, finish, fist, hair, hair_cap, leg_tube,
    limb, mirror, neck, pair_add, path_loft, pelvis, sash_chain_weights, sleeve, sym, torso_rows, tree_of, baggy_leg,
)


def team_band(F, team, k=1.0):
    return band('teamL', F.sh, F.da, 0.155, 0.18, 0.085 * F.k_arm * k, 0.083 * F.k_arm * k, team, G_UPPER_L, thick=0.006, mat=5, ol=0.5)


def arm_s(F, co):
    """頂點沿手臂的距離（從肩關節起）。"""
    return (co - F.sh).dot(F.da)


def arm_out(F, co, n):
    """法線朝手臂外側（遠離身體）的程度。"""
    side = V((0, 0, 1)).cross(F.da).normalized()
    return n.dot(side)


def belt_ring(F, y, h, pal, e=0.0, n=18, thick=0.012, mat=0, a=None, b=None):
    a = a or F.w * 1.18 + e
    b = b or F.cz * 0.9 + e
    o = limb('belt', V((0, y - h / 2, 0)), V((0, 1, 0)), [(0.0, a, b, None, 2.3), (h / 2, a * 1.02, b * 1.02, None, 2.3), (h, a, b, None, 2.3)], n=n, cap0=None, cap1=None)
    o = kit.subsurf(o, 2, solidify=thick)
    return kit.tag(o, pal, grp=G_BELT, mat=mat)


def strap_around(F, target, center, normal, width, thick, pal, name='strap', grp=G_CHEST, off=0.006, steps=28, arc=None):
    """沿傾斜平面繞身體一圈的帶子（以射線貼合 target 表面）。arc＝(φ0, φ1) 只取一段。"""
    if isinstance(target, (list, tuple)):
        tmp = kit.join([kit.duplicate(t, 'tmp') for t in target], 'tmp_target')
        tr = tree_of(tmp)
        import bpy
        bpy.data.objects.remove(tmp, do_unlink=True)
    else:
        tr = tree_of(target)
    nrm = V(normal).normalized()
    u = V((0, 0, 1)).cross(nrm).normalized()
    w = nrm.cross(u).normalized()
    pts = []
    a0, a1 = arc if arc else (0, 2 * PI)
    for i in range(steps + 1):
        f = lerp(a0, a1, i / steps)
        d = u * math.cos(f) + w * math.sin(f)
        o = V(center) + d * 1.0
        hit = tr.ray_cast(o, -d, 2)
        if hit[0] is not None:
            pts.append(hit[0] + hit[1] * off)
    ob = path_loft(name, pts, [width] * len(pts), n=6, flat=thick / width, front=nrm, side=u, cap0='pole', cap1='pole')
    ob = kit.subsurf(ob, 1)
    return kit.tag(ob, pal, grp=grp, ol=0.6)


def plate(name, center, ax_u, ax_v, ax_n, ru, rv, rn, pal, grp, mat=2, ol=0.7):
    """貼在身上的橢圓甲片（弗利沙的紫色圓頂、甲片）。"""
    o = kit.quad_sphere(name, 1.0, cuts=4)
    au, av, an = V(ax_u).normalized(), V(ax_v).normalized(), V(ax_n).normalized()
    kit.deform(o, lambda p: V(center) + au * p.x * ru + av * p.y * rv + an * p.z * rn)
    o = kit.subsurf(o, 1)
    kit.recalc_normals(o)
    return kit.tag(o, pal, mat=mat, grp=grp, ol=ol)


# ================================================================ 貝吉塔
def build_vegeta(R):
    F = Fig(R)
    P = kit.Palette()
    skin = P(0xf2c69e)
    suit, suitD = P(0x2a4cc0), P(0x1d3790)
    white = P(0xf5f2e8)
    gold, goldD = P(0xe6ae2e), P(0xb98418)
    team = P(-1)
    body, proxy = [], []

    # 緊身衣：軀幹＋骨盆＋腿
    st = kit.loft('suit', torso_rows(F, e=0.004, u0=0.0, pec=0.108, lat=0.09), n=18, cap0=None, cap1=None)
    st = kit.subsurf(st, 2)
    kit.tag(st, suit, grp=G_TORSO)
    body.append(st)
    proxy.append(st)
    # 高領
    col = limb('collar', V((0, F.y(0.93), -0.008)), V((0, 1, 0)), [(0, 0.075, 0.07), (0.05, 0.068, 0.064), (0.085, 0.066, 0.062)], n=14, cap0=None, cap1=None)
    col = kit.subsurf(col, 2, solidify=0.006)
    kit.tag(col, suit, grp=G_NECK, ol=0.7)
    body.append(col)
    body.append(neck(F, skin, r=0.06))
    proxy.append(body[-1])
    body.append(pelvis(F, suit, e=0.004))
    proxy.append(body[-1])
    kl = F.k_leg
    quad = lambda th: 1 + 0.06 * ang_bump(th, FRONT - 0.3, 1.0)
    calf = lambda th: 1 + 0.08 * ang_bump(th, BACK, 1.0)
    leg = leg_tube(F, suit, [
        (-0.07, 0.122 * kl, 0.122 * kl),
        (0.03, 0.118 * kl, 0.122 * kl, quad),
        (0.18, 0.106 * kl, 0.11 * kl, quad),
        (F.tl - 0.04, 0.078 * kl, 0.084 * kl),
        (F.tl + 0.06, 0.074 * kl, 0.08 * kl, calf),
        (F.tl + 0.14, 0.066 * kl, 0.07 * kl, calf),
        (F.tl + 0.2, 0.05 * kl, 0.052 * kl),
    ])
    # 戰鬥服胸甲：一體成形，胸口白色、腹部金色分節（亮面），肩上金色背帶
    ar = kit.loft('armor', torso_rows(F, e=lambda u: 0.028 - 0.02 * smooth((u - 0.8) / 0.13) - 0.008 * smooth((0.3 - u) / 0.15), u0=0.15, u1=0.93, pec=0.126, lat=0.054, p=2.5), n=20, cap0=None, cap1=None)
    ar = kit.subsurf(ar, 2, solidify=0.014)
    kit.tag(ar, white, grp=G_CHEST, mat=2)
    yab = F.y(0.47)
    kit.paint_field(ar, lambda co: co.y - yab, gold, 2)
    # 分節溝：細到比三角形還窄，用兩道單邊切割（先塗深色到溝上緣，再把溝下緣以下塗回金色），由上往下
    for u in (0.36, 0.25):
        yy = F.y(u)
        kit.paint_field(ar, lambda co, yy=yy: co.y - (yy + 0.0045), goldD, 2)
        kit.paint_field(ar, lambda co, yy=yy: co.y - (yy - 0.0045), gold, 2)
    body.append(ar)
    for sx in (1, -1):
        s_ = strap_around(F, [ar, st], V((sx * F.cx * 0.62, F.y(0.72), 0)), V((1, 0, 0)), 0.026, 0.01, gold, off=0.004, steps=20, arc=(1.25, -1.25))
        kit.tag(s_, gold, grp=G_CHEST, mat=2, ol=0.6)
        body.append(s_)
    # 手臂：短袖（同色緊身衣）、白手套
    arm = arm_skin(F, skin, muscle=1.3, k=1.1)
    kit.paint_field(arm, lambda co: arm_s(F, co) - 0.15, suit, 0)
    hem = band('hemL', F.sh, F.da, 0.14, 0.155, 0.085 * F.k_arm * 1.1, 0.084 * F.k_arm * 1.1, suit, G_UPPER_L, thick=0.005, ol=0.6)
    glove = band('gloveL', F.sh, F.da, F.up + 0.1, F.up + F.lo - 0.005, 0.072 * F.k_fore, 0.054 * F.k_fore, white, G_FORE_L, thick=0.012, rb=0.92, bulge=1.06)
    hand = fist(F, white, mat=0, scale=1.1, glove=True)
    # 白靴、金色靴尖與靴口
    bt = boot(F, white, F.tl + 0.06, 0.078, toe=1.04)
    kit.paint_field(bt[1], lambda co: 0.085 - co.z, gold, 2)
    ytop = F.leg_pt(F.tl + 0.085).y
    kit.paint_field(bt[0], lambda co: ytop - co.y + 0.012 * abs(co.x - F.sole.x) / 0.07 - 0.02 * max(0, co.z) / 0.07, gold, 2)
    pair_add(body, proxy, [arm, hem, glove, hand, leg] + bt, proxy_set=[arm, hand, leg] + bt)
    body.append(team_band(F, team, 1.12))

    heads = {}
    for form in ('base', 'ssj'):
        h = anime_head('head_' + form, F, skin, jaw=1.06, chin=0.95, brow=0.6)
        hc = P(0x17130f) if form == 'base' else P(0xffd447)
        heads[form] = [h, hair_cap('cap_' + form, F, hc, hairline=0.22, temple=0.55, scale=1.06)] + hair(F, hc, vegeta_hair(form))
    return finish(F, P, body, proxy, heads)


def vegeta_hair(form):
    k = 1.0 if form == 'base' else 1.1
    return sym([
        ((0.0, 0.95, 0.25), (0.05, 3.0 * k, -0.15), 0.56, 0.26, (0, 0, 0.1)),
        ((0.28, 0.9, 0.18), (0.42, 2.85 * k, -0.25), 0.5, 0.24, (0.05, 0, 0.05)),
        ((0.55, 0.75, 0.05), (0.95, 2.45 * k, -0.3), 0.48, 0.23, (0.1, 0, 0)),
        ((0.75, 0.45, -0.1), (1.3, 1.85 * k, -0.4), 0.45, 0.22, (0.1, 0, 0)),
        ((0.8, 0.1, -0.3), (1.25, 1.0 * k, -0.7), 0.4, 0.2, (0.1, 0, 0)),
        ((0.3, 0.75, -0.55), (0.42, 2.7 * k, -0.85), 0.5, 0.24, (0, 0, 0)),
        ((0.0, 0.6, -0.8), (0.0, 2.45 * k, -1.05), 0.52, 0.24, (0, 0, 0)),
        ((0.5, 0.4, -0.75), (0.85, 2.05 * k, -1.0), 0.45, 0.22, (0, 0, 0)),
        ((0.0, 0.1, -0.95), (0.0, 1.45 * k, -1.3), 0.45, 0.22, (0, 0, 0)),
        ((0.62, 0.62, 0.38), (0.95, 1.9 * k, 0.15), 0.32, 0.16, (0, 0, 0)),
    ])


# ================================================================ 特南克斯
def build_trunks(R):
    F = Fig(R)
    P = kit.Palette()
    skin = P(0xf7cfa8)
    jacket, jacketL = P(0x1e2648), P(0x2c3866)
    tank = P(0x17171b)
    pants = P(0x787c88)
    bootc, bootD = P(0xd2a64a), P(0x6a5028)
    blk = P(0x1a1a1a)
    brass = P(0xb8a060)
    strapc = P(0x6a4a2a)
    team = P(-1)
    body, proxy = [], []

    tk = kit.loft('tank', torso_rows(F, e=0.003, u0=0.0, pec=0.09), n=18, cap0=None, cap1=None)
    tk = kit.subsurf(tk, 2)
    kit.tag(tk, tank, grp=G_TORSO)
    body.append(tk)
    proxy.append(tk)
    # 外套：前襟敞開、立領
    rows = [(0.02, ('w', 1.24), 0.9, 0.0)] + [r for r in TORSO_ROWS if r[0] > 0.1]
    us = [r[0] for r in rows]
    jk = kit.loft('jacket', torso_rows(F, e=0.02, rows=rows, pec=0.072), n=20, cap0=None, cap1=None, gap=lambda i: 0.3 + 0.25 * smooth((us[i] - 0.5) / 0.5))
    jk = kit.subsurf(jk, 2, solidify=0.01)
    kit.tag(jk, jacket, grp=G_TORSO)
    body.append(jk)
    proxy.append(jk)
    cl = kit.loft('jcollar', [S(V((0, F.y(0.95), -0.01)), F.cx * 0.5, F.cz * 0.66), S(V((0, F.y(1.03), -0.015)), F.cx * 0.47, F.cz * 0.62), S(V((0, F.y(1.1), -0.02)), F.cx * 0.48, F.cz * 0.62)],
                  n=16, cap0=None, cap1=None, gap=lambda i: 0.55)
    cl = kit.subsurf(cl, 2, solidify=0.008)
    kit.tag(cl, jacket, grp=G_NECK, ol=0.8)
    body.append(cl)
    body.append(neck(F, skin, r=0.056))
    proxy.append(body[-1])
    # 劍帶：左肩斜到右腰
    body.append(strap_around(F, jk, V((0, F.y(0.62), 0)), V((-0.55, 1, 0)), 0.024, 0.008, strapc, off=0.008))
    # 長袖外套＋袖口
    ka = F.k_arm
    from crossover import long_sleeve
    sl = long_sleeve(F, jacket, k=1.0, e=0.01)  # 貼合手臂的長袖（和客串角色同一個函式）
    cuff = band('cuffL', F.sh, F.da, F.up + F.lo - 0.085, F.up + F.lo - 0.045, 0.058 * F.k_fore + 0.016, 0.056 * F.k_fore + 0.016, jacketL, G_FORE_L, thick=0.008)
    arm = arm_skin(F, skin, muscle=0.9, k=1.0)
    kit.paint_field(arm, lambda co: arm_s(F, co) - (F.up + F.lo - 0.06), jacket, 0)
    hand = fist(F, skin, scale=1.05)
    # 褲、腰帶、靴
    body.append(pelvis(F, pants, e=0.01))
    proxy.append(body[-1])
    kl = F.k_leg
    leg = leg_tube(F, pants, [(-0.07, 0.12 * kl, 0.12 * kl), (0.04, 0.122 * kl, 0.126 * kl), (0.2, 0.108 * kl, 0.112 * kl), (F.tl - 0.02, 0.09 * kl, 0.094 * kl),
                              (F.tl + 0.1, 0.088 * kl, 0.09 * kl), (F.tl + 0.17, 0.08 * kl, 0.082 * kl), (F.tl + 0.21, 0.062 * kl, 0.064 * kl)])
    bt = boot(F, bootc, F.tl + 0.15, 0.076, pal_sole=bootD)
    rim = band('bootRimL', F.th, F.dl, F.tl + 0.135, F.tl + 0.165, 0.082, 0.083, bootD, G_FOOT_L, thick=0.008)
    pair_add(body, proxy, [sl, cuff, arm, hand, leg, rim] + bt, proxy_set=[arm, hand, leg] + bt)
    body.append(team_band(F, team, 1.25))
    yb = F.L + 0.08
    body.append(belt_ring(F, yb, 0.04, blk, e=0.014))
    bk = kit.box_cage('buckle', 0.05, 0.036, 0.012, cuts=(1, 1, 1))
    kit.transform(bk, Matrix.Translation(V((0, yb, F.cz * 0.92 + 0.026))))
    bk = kit.subsurf(bk, 2)
    body.append(kit.tag(bk, brass, grp=G_BELT, mat=2, ol=0.5))

    heads = {}
    for form in ('base', 'ssj'):
        h = anime_head('head_' + form, F, skin, jaw=0.98, chin=0.95)
        hc = P(0xb9a6e8) if form == 'base' else P(0xffd447)
        if form == 'base':
            parts = [h, hair_cap('cap_' + form, F, hc, hairline=0.5, temple=0.0, scale=1.08, nape=-0.75, side_cut=False)] + hair(F, hc, trunks_hair())
        else:
            parts = [h, hair_cap('cap_' + form, F, hc, hairline=0.4, temple=0.2)] + hair(F, hc, trunks_ssj())
        heads[form] = parts
    extras = trunks_sword(P, brass)
    return finish(F, P, body, proxy, heads, extras=extras)


def trunks_hair():
    return sym([
        ((0.12, 0.95, 0.35), (0.78, -0.15, 0.78), 0.4, 0.15, (0.35, 0.35, 0.25)),
        ((0.32, 0.9, 0.12), (1.02, -0.5, 0.35), 0.44, 0.16, (0.45, 0.25, 0.1)),
        ((0.36, 0.88, -0.2), (1.02, -0.62, -0.32), 0.46, 0.17, (0.45, 0.25, 0.0)),
        ((0.26, 0.85, -0.5), (0.78, -0.72, -0.88), 0.46, 0.17, (0.35, 0.25, -0.25)),
        ((0.06, 0.82, -0.7), (0.26, -0.78, -1.08), 0.46, 0.17, (0.12, 0.25, -0.35)),
        ((0.1, 0.96, 0.42), (0.5, 0.42, 0.98), 0.4, 0.13, (0.15, 0.25, 0.2)),
    ])


def trunks_ssj():
    return sym([
        ((0.0, 0.92, 0.25), (0.1, 2.6, -0.1), 0.52, 0.24, (0, 0, 0)),
        ((0.38, 0.85, 0.1), (0.9, 2.4, -0.3), 0.5, 0.23, (0, 0, 0)),
        ((0.7, 0.55, -0.05), (1.55, 1.7, -0.4), 0.46, 0.22, (0, 0, 0)),
        ((0.82, 0.12, -0.25), (1.6, 0.6, -0.7), 0.42, 0.2, (0, 0, 0)),
        ((0.28, 0.78, -0.5), (0.5, 2.2, -1.1), 0.5, 0.23, (0, 0, 0)),
        ((0.0, 0.55, -0.8), (0.05, 1.7, -1.6), 0.5, 0.23, (0, 0, 0)),
        ((0.45, 0.2, -0.82), (1.0, 0.5, -1.5), 0.46, 0.22, (0, 0, 0)),
        ((0.12, 0.85, 0.5), (0.2, 0.3, 1.02), 0.28, 0.13, (0, 0.05, 0.12)),
        ((0.55, 0.65, 0.4), (0.82, 0.05, 0.75), 0.24, 0.12, (0, 0, 0.06)),
    ])


def trunks_sword(P, brass):
    steel, hilt, sheath = P(0xe3e9f0), P(0x3a2a1e), P(0x6a5430)
    # 劍：握把在原點、刃沿 +y（在 JS 的劍座局部座標）
    grip = limb('grip', V((0, -0.1, 0)), V((0, 1, 0)), [(0, 0.016, 0.016), (0.2, 0.019, 0.019)], n=8, cap0='pole', cap1='pole')
    grip = kit.subsurf(grip, 1)
    kit.tag(grip, hilt, ol=0.6)
    pom = kit.quad_sphere('pommel', 0.024, cuts=3)
    kit.transform(pom, Matrix.Translation(V((0, -0.112, 0))))
    kit.tag(pom, brass, mat=2, ol=0.6)
    guard = kit.box_cage('guard', 0.13, 0.024, 0.044, cuts=(1, 1, 1))
    kit.transform(guard, Matrix.Translation(V((0, 0.112, 0))))
    guard = kit.subsurf(guard, 1)
    kit.tag(guard, brass, mat=2, ol=0.6)
    blade = kit.loft('blade', [S(V((0, 0.13, 0)), 0.022, 0.0045, p=1.2), S(V((0, 0.6, 0)), 0.022, 0.0045, p=1.2), S(V((0, 1.0, 0)), 0.021, 0.004, p=1.2), S(V((0, 1.085, 0)), 0.002, 0.001, p=1.2)],
                     n=8, cap0='pole', cap1=None, front=V((0, 0, 1)), side=V((1, 0, 0)))
    kit.split_sharp(blade, 35)
    kit.tag(blade, steel, mat=2, ol=0.5)
    sw = [grip, pom, guard, blade]
    # 鞘
    sh = kit.box_cage('sheath', 0.064, 0.94, 0.032, cuts=(1, 4, 1))
    kit.transform(sh, Matrix.Translation(V((0, 0.6, 0))))
    sh = kit.subsurf(sh, 1)
    kit.tag(sh, sheath, ol=0.7)
    caps = []
    for y, hh in ((0.16, 0.044), (1.05, 0.05)):
        c = kit.box_cage('cap', 0.076, hh, 0.04, cuts=(1, 1, 1))
        kit.transform(c, Matrix.Translation(V((0, y, 0))))
        c = kit.subsurf(c, 1)
        caps.append(kit.tag(c, brass, mat=2, ol=0.6))
    return {'sword': sw, 'sheath': [sh] + caps}


# ================================================================ 比克
def build_piccolo(R):
    F = Fig(R)
    P = kit.Palette()
    gskin, pink = P(0x66b83e), P(0xe6909e)
    gi = P(0x5d3a94)
    sash = P(0x5fb8e8)
    shoe, shoeD = P(0x6e4428), P(0x3e2614)
    wrist = P(0xb3322e)
    team = P(-1)
    body, proxy = [], []

    chest = kit.loft('chest', torso_rows(F, e=0.0, u0=0.3, pec=0.144), n=18, cap0=None, cap1=None)
    chest = kit.subsurf(chest, 2)
    kit.tag(chest, gskin, grp=G_TORSO, mat=4)
    body.append(chest)
    proxy.append(chest)
    rows = [(-0.2, ('w', 1.3), 1.0, 0.02), (-0.08, ('w', 1.2), 0.9, 0.01)] + TORSO_ROWS
    us = [r[0] for r in rows]
    uv0 = 0.42
    top = kit.loft('gi_top', torso_rows(F, e=0.018, rows=rows, pec=0.09, lat=0.108), n=20, cap0=None, cap1=None,
                   gap=lambda i: 0.0 if us[i] <= uv0 else min(1.35, 0.1 + (us[i] - uv0) * 2.2))
    top = kit.subsurf(top, 2, solidify=0.012)
    kit.tag(top, gi, grp=G_TORSO)
    body.append(top)
    proxy.append(top)
    body.append(neck(F, gskin, r=0.07))
    proxy.append(body[-1])
    # 手臂：粉紅肌肉紋、紅護腕
    arm = arm_skin(F, gskin, muscle=1.35, k=1.15)

    side = V((0, 0, 1)).cross(F.da).normalized()

    def patches(co):
        # 粉紅肌肉紋：上臂外側與前臂外側各一塊橢圓（以手臂局部的 s 與繞軸角度判斷）
        s = arm_s(F, co)
        r = co - F.arm_pt(s)
        phi = math.atan2(r.dot(V((0, 0, 1))), r.dot(side))
        return min(((s - s0) / ls) ** 2 + ((phi - p0) / lp) ** 2 - 1 for s0, ls, p0, lp in ((0.11, 0.085, 0.35, 0.95), (F.up + 0.1, 0.075, 0.2, 0.85)))
    kit.paint_field(arm, patches, pink, 4)
    sl = sleeve(F, gi, s1=0.035, r=0.118 * F.k_arm, s0=-0.06)
    wb = band('wristL', F.sh, F.da, F.up + 0.17, F.up + F.lo - 0.005, 0.068 * F.k_fore, 0.057 * F.k_fore, wrist, G_FORE_L, thick=0.012, rb=0.9)
    hand = fist(F, gskin, scale=1.12)
    body.append(pelvis(F, gi, e=0.014))
    proxy.append(body[-1])
    leg = baggy_leg(F, gi, bag=1.1, blouse=1.08, s_end=F.tl + F.sl - 0.05)
    shoe_ = boot(F, shoe, F.tl + F.sl - 0.09, 0.07, pal_sole=shoeD, toe_len=0.04, toe=0.95)
    pair_add(body, proxy, [arm, sl, wb, hand, leg] + shoe_, proxy_set=[arm, hand, leg] + shoe_)
    body.append(team_band(F, team, 1.2))
    # 天藍腰帶＋結＋垂帶
    yb = F.L + 0.09
    body.append(belt_ring(F, yb, 0.085, sash, e=0.024, thick=0.014))
    kz = F.cz * 0.92 + 0.03
    knot = kit.quad_sphere('knot', 1, cuts=3)
    kit.deform(knot, lambda p: V((0.13 + p.x * 0.04, yb + p.y * 0.036, kz + p.z * 0.024)))
    knot = kit.subsurf(knot, 1)
    body.append(kit.tag(knot, sash, grp=G_BELT))
    for k, (dx, w0, ln) in enumerate(((-0.014, 0.04, 0.34), (0.03, 0.035, 0.28))):
        t0 = V((0.13 + dx, yb - 0.01, kz + 0.004 + 0.006 * k))
        f = kit.loft('flap%d' % k, [S(t0, w0, 0.008), S(t0 + V((0.004, -ln * 0.5, 0.004)), w0 * 1.12, 0.008), S(t0 + V((0.01, -ln, 0.006)), w0 * 0.92, 0.007)], n=8)
        f = kit.subsurf(f, 2)
        body.append(kit.tag(f, sash, grp=G_CHAIN, ol=0.7))

    # 頭：光頭、尖耳、觸角、額頭隆起
    c, hr = F.c, F.hr
    ridges = []
    for sx in (1, -1):
        for k in range(2):
            rid = path_loft('ridge', [c + V((sx * 0.1 * hr, (0.42 + k * 0.2) * hr, 0.8 * hr - k * 0.08 * hr)), c + V((sx * 0.4 * hr, (0.56 + k * 0.2) * hr, 0.64 * hr - k * 0.1 * hr))],
                            [0.06 * hr, 0.035 * hr], n=6)
            ridges.append(kit.subsurf(rid, 1))
    h = anime_head('head_base', F, gskin, pointed_ears=True, ear_scale=1.3, jaw=1.04, brow=1.0, cranium=(0.82, 0.95, 0.9), extra=ridges)
    parts = [h]
    for sx in (1, -1):
        pts = [c + V((sx * 0.22 * hr, 0.75 * hr, 0.45 * hr)), c + V((sx * 0.3 * hr, 1.25 * hr, 0.3 * hr)), c + V((sx * 0.42 * hr, 1.65 * hr, -0.05 * hr)), c + V((sx * 0.5 * hr, 1.85 * hr, -0.45 * hr))]
        an = path_loft('ant', pts, [0.07 * hr, 0.055 * hr, 0.045 * hr, 0.06 * hr], n=6)
        an = kit.subsurf(an, 1)
        parts.append(kit.tag(an, gskin, mat=4, ol=0.6))
    heads = {'base': parts}
    return finish(F, P, body, proxy, heads, custom={G_CHAIN: sash_chain_weights(F, 'sash')})


# ================================================================ 弗利沙
def build_frieza(R):
    F = Fig(R)
    P = kit.Palette()
    skin = P(0xf7f4f0)
    dome = P(0x7a3cc4)
    team = P(-1)
    body, proxy = [], []

    # 白色身體：軀幹、骨盆、腿、手臂、脖子 → 體素融成一張皮
    tor = kit.subsurf(kit.loft('torso', torso_rows(F, e=0.0, u0=0.0, pec=0.108, lat=0.09), n=18, cap0='pole', cap1='pole'), 2)
    pel = pelvis(F, skin, e=0.0, closed=True)
    kl, ks = F.k_leg, F.k_shin
    calf = lambda th: 1 + 0.1 * ang_bump(th, BACK, 1.0)
    leg = limb('legL', F.th, F.dl, [(-0.07, 0.11 * kl, 0.11 * kl), (0.05, 0.112 * kl, 0.116 * kl), (0.22, 0.096 * kl, 0.1 * kl), (F.tl - 0.03, 0.07 * kl, 0.076 * kl),
                                    (F.tl + 0.06, 0.07 * ks / 0.75 * 0.75, 0.076 * kl, calf), (F.tl + 0.17, 0.06 * kl, 0.062 * kl, calf), (F.tl + F.sl - 0.08, 0.045 * kl, 0.05 * kl), (F.tl + F.sl - 0.03, 0.05 * kl, 0.06 * kl)], n=12)
    leg = kit.subsurf(leg, 2)
    fx = F.sole.x
    s = ks * 1.1
    foot = kit.loft('foot', [S(V((fx, 0.05 * s, -0.06 * s)), 0.04 * s, 0.045 * s, p=2.3), S(V((fx, 0.055 * s, 0.0)), 0.048 * s, 0.055 * s, p=2.3), S(V((fx + 0.004, 0.04 * s, 0.09 * s)), 0.045 * s, 0.038 * s, p=2.4), S(V((fx + 0.006, 0.025 * s, 0.17 * s)), 0.02 * s, 0.02 * s)], n=12, front=V((0, 1, 0)))
    kit.deform(foot, lambda p: V((p.x, max(p.y, 0.008), p.z)))
    foot = kit.subsurf(foot, 2)
    arm = arm_skin(F, skin, muscle=0.9, k=1.05)
    nk = neck(F, skin, r=0.05)
    parts = [tor, pel, leg, mirror(leg), foot, mirror(foot), arm, mirror(arm), nk]
    for o in parts:
        kit.tag(o, skin, mat=4, grp=G_FREE)
    skin_body = kit.fuse(parts, 'skin', voxel=0.0055, iters=10, factor=0.6, tris=9000)
    kit.tag(skin_body, skin, mat=4, grp=G_FREE)
    body.append(skin_body)
    proxy.append(skin_body)
    hand = fist(F, skin, scale=1.15)
    pair_add(body, proxy, [hand], proxy_set=[hand])
    # 紫色甲片：肩、前臂、小腿
    side = V((0, 0, 1)).cross(F.da).normalized()
    shp = plate('shoulderL', F.sh + V((0.016, 0.03, 0)), V((0.8, -0.6, 0)), V((0, 0, 1)), V((0.6, 0.8, 0)), 0.076, 0.072, 0.05, dome, G_UPPER_L)
    fa = F.arm_pt(F.up + 0.12) + side * 0.036 * F.k_fore
    fap = plate('foreL', fa, F.da, V((0, 0, 1)), side, 0.085, 0.034, 0.018, dome, G_FORE_L)
    sp = F.leg_pt(F.tl + 0.15) + V((0, 0, 0.05 * kl))
    shn = plate('shinL', sp, F.dl, V((1, 0, 0)), V((0, 0, 1)), 0.1, 0.038, 0.02, dome, G_FOOT_L)
    pair_add(body, proxy, [shp, fap, shn])
    body.append(band('teamL', F.sh, F.da, 0.155, 0.175, 0.07 * F.k_arm, 0.068 * F.k_arm, team, G_UPPER_L, thick=0.005, mat=5, ol=0.5))
    # 尾巴（5 節擺動鏈，綁定姿勢筆直下垂）
    h0 = F.b['tail0'][0]
    tail = limb('tail', h0 + V((0, 0.06, 0.02)), V((0, -1, 0)), [(0, 0.06, 0.06), (0.1, 0.066, 0.066), (0.3, 0.056, 0.056), (0.5, 0.045, 0.045), (0.7, 0.034, 0.034), (0.88, 0.022, 0.022), (1.04, 0.01, 0.01)], n=10)
    tail = kit.subsurf(tail, 2)
    body.append(kit.tag(tail, skin, mat=4, grp=G_CHAIN))
    tb = [F.b['tail%d' % i] for i in range(5)]

    seg = R['bones'][[x['name'] for x in R['bones']].index('tail0')]
    ln = (V(seg['head']) - V(seg['tail'])).length

    def tail_w(co):
        t = (tb[0][0].y - co.y) / ln
        if t < 0.5:
            k = smooth((t + 0.3) / 0.8)
            return [('tail0', k), ('hips', 1 - k)]
        x = t - 0.5
        i = int(math.floor(x))
        f = smooth(x - i)
        a, b = min(i, 4), min(i + 1, 4)
        return [('tail%d' % a, 1 - f), ('tail%d' % b, f)]

    c, hr = F.c, F.hr
    h = anime_head('head_base', F, skin, ears=False, jaw=0.95, chin=0.9, cranium=(0.8, 0.92, 0.9), nose=0.6)
    # 紫色圓頂：直接在頭顱上切出區域上色（平貼、無接縫）
    def dome_f(co):
        p = (co - c) / hr
        return (0.2 - 0.5 * max(0.0, -p.z) - 0.1 * abs(p.x) + 0.12 * max(0.0, p.z - 0.5)) - p.y
    kit.paint_field(h, dome_f, dome, 2)
    heads = {'base': [h]}
    return finish(F, P, body, proxy, heads, custom={G_CHAIN: tail_w})


# ================================================================ 18 號
FEMALE_ROWS = [
    (0.06, ('w', 1.22), 0.86, 0.0),
    (0.2, ('w', 1.0), 0.78, 0.0),
    (0.36, ('c', 0.8), 0.8, 0.02),
    (0.52, ('c', 0.92), 0.9, 0.06),
    (0.65, ('c', 0.98), 0.98, 0.1),
    (0.78, ('c', 1.0), 0.88, 0.04),
    (0.89, ('c', 0.95), 0.78, -0.02),
    (0.97, ('c', 0.64), 0.6, -0.04),
    (1.01, ('c', 0.36), 0.45, 0.0),
]


def build_a18(R):
    F = Fig(R)
    P = kit.Palette()
    skin = P(0xf9d6bd)
    shirt, stripe = P(0x1d1d23), P(0xf0eee8)
    denim, denimD = P(0x4274bc), P(0x2c5290)
    legging = P(0x1b1b20)
    bootc, bootD = P(0x7c4c2c), P(0x4a2c18)
    beltc = P(0x5a3a22)
    team = P(-1)
    body, proxy = [], []

    sh = kit.loft('shirt', torso_rows(F, e=0.003, u0=0.0, pec=0, lat=0, bust=0.14, rows=FEMALE_ROWS), n=18, cap0=None, cap1=None)
    sh = kit.subsurf(sh, 2)
    kit.tag(sh, shirt, grp=G_TORSO)
    body.append(sh)
    proxy.append(sh)
    us = [r[0] for r in FEMALE_ROWS if r[0] >= 0.3]
    vest = kit.loft('vest', torso_rows(F, e=0.016, u0=0.3, pec=0, lat=0, bust=0.12, rows=FEMALE_ROWS), n=20, cap0=None, cap1=None,
                    gap=lambda i: 0.42 + 0.35 * smooth((us[i] - 0.55) / 0.45))
    vest = kit.subsurf(vest, 2, solidify=0.009)
    kit.tag(vest, denim, grp=G_TORSO)
    body.append(vest)
    body.append(neck(F, skin, r=0.048))
    proxy.append(body[-1])
    # 長袖條紋上衣
    arm = arm_skin(F, skin, muscle=0.3, k=1.04)

    s_end = F.up + F.lo - 0.03
    kit.paint_field(arm, lambda co: arm_s(F, co) - s_end, shirt, 0)
    kit.paint_field(arm, lambda co: max(0.2 - math.sin(2 * PI * arm_s(F, co) / 0.046), arm_s(F, co) - s_end + 0.01, 0.03 - arm_s(F, co)), stripe, 0)
    hand = fist(F, skin, scale=1.0)
    # 裙、內搭褲、短靴
    body.append(pelvis(F, legging, e=0.004))
    proxy.append(body[-1])
    yb = F.y(0.15)
    hw = F.R['hip']
    sk = kit.loft('skirt', [S(V((0, yb, 0.0)), F.w * 1.22 + 0.01, F.cz * 0.86 + 0.01, p=2.2), S(V((0, F.L + 0.03, 0)), hw * 1.6, F.cz * 0.98, p=2.2),
                            S(V((0, F.L - 0.12, 0.005)), hw * 1.85, F.cz * 1.15, p=2.1), S(V((0, F.L - 0.24, 0.01)), hw * 2.0, F.cz * 1.28, p=2.0)], n=22, cap0=None, cap1=None)
    sk = kit.subsurf(sk, 2, solidify=0.009)
    kit.tag(sk, denim, grp=G_PELVIS)
    body.append(sk)
    body.append(belt_ring(F, yb + 0.005, 0.026, beltc, e=0.02, thick=0.008))
    kl = F.k_leg
    calf = lambda th: 1 + 0.09 * ang_bump(th, BACK, 1.0)
    leg = leg_tube(F, legging, [(-0.07, 0.112 * kl, 0.112 * kl), (0.05, 0.11 * kl, 0.114 * kl), (0.22, 0.094 * kl, 0.098 * kl), (F.tl - 0.03, 0.068 * kl, 0.074 * kl),
                                (F.tl + 0.07, 0.068 * kl, 0.074 * kl, calf), (F.tl + 0.17, 0.056 * kl, 0.06 * kl, calf), (F.tl + 0.26, 0.042 * kl, 0.046 * kl)])
    bt = boot(F, bootc, F.tl + F.sl - 0.13, 0.058, pal_sole=bootD, toe=0.92)
    pair_add(body, proxy, [arm, hand, leg] + bt, proxy_set=[arm, hand, leg] + bt)
    body.append(team_band(F, team, 1.0))

    h = anime_head('head_base', F, skin, jaw=0.9, chin=0.85, cheek=0.96, nose=0.7)
    hc = P(0xf3d77a)
    heads = {'base': [h, hair_cap('cap', F, hc, hairline=0.48, temple=0.0, scale=1.08, nape=-0.85, side_cut=False)] + hair(F, hc, a18_hair())}
    return finish(F, P, body, proxy, heads)


def a18_hair():
    cl = [
        ((0.3, 0.95, 0.3), (-0.55, 0.3, 1.0), 0.42, 0.14, (-0.1, 0.35, 0.3)),     # 側分瀏海掃向右
        ((0.0, 0.98, 0.3), (-0.82, -0.2, 0.75), 0.4, 0.14, (-0.3, 0.3, 0.25)),
        ((0.4, 0.9, 0.25), (0.88, -0.3, 0.68), 0.38, 0.14, (0.35, 0.3, 0.2)),
    ]
    cl += sym([
        ((0.35, 0.88, 0.0), (1.02, -0.6, 0.15), 0.46, 0.16, (0.45, 0.25, 0.05)),
        ((0.34, 0.86, -0.3), (1.0, -0.72, -0.4), 0.48, 0.17, (0.45, 0.25, -0.05)),
        ((0.22, 0.84, -0.55), (0.72, -0.8, -0.92), 0.48, 0.17, (0.3, 0.25, -0.25)),
        ((0.05, 0.8, -0.72), (0.22, -0.84, -1.08), 0.48, 0.17, (0.1, 0.25, -0.35)),
    ])
    return cl
