# 火影忍者、海賊王的客串角色（同人致敬，全部以程式建模，不使用原作素材）。
# 介面與 heroes.build_goku 相同：build_xxx(R) 回傳 finish(...) 的 dict。座標＝three.js 空間（+Y 上、面向 +Z、角色左手在 +X）。
import math

from mathutils import Matrix

import kit
from kit import S, V, ang_bump, bump, lerp, smooth
from heroes import (
    BACK, FRONT, G_ARM_L, G_BELT, G_CHEST, G_FOOT_L, G_FORE_L, G_FREE, G_LEG_L, G_NECK, G_PELVIS, G_TORSO, G_UPPER_L, PI, TORSO_ROWS,
    Fig, anime_head, arm_skin, band, boot, finish, fist, hair, hair_cap, leg_tube, limb, neck, pair_add, path_loft, pelvis, sleeve, sym,
    torso_rows, baggy_leg,
)
from cast import FEMALE_ROWS, arm_s, belt_ring, strap_around, team_band


# ================================================================ 共用配件
def head_band(F, cloth, metal, y=0.3, h=0.36, tilt=0.0, tails=True, plate=True, name='hb'):
    """忍者護額：繞頭一圈的布帶＋額前金屬板（單位 hr）。tilt＞0 往角色左側斜（卡卡西遮左眼）。"""
    c, hr = F.c, F.hr
    y0 = c.y + hr * y
    ring = limb(name, V((c.x, y0, c.z - hr * 0.04)), V((0, 1, 0)), [(0, hr * 0.86, hr * 0.94), (hr * h * 0.5, hr * 0.88, hr * 0.96), (hr * h, hr * 0.86, hr * 0.94)], n=20, cap0=None, cap1=None)
    ring = kit.subsurf(ring, 2, solidify=hr * 0.03)
    kit.tag(ring, cloth, grp=G_FREE, ol=0.7)
    parts = [ring]
    if plate:
        pl = kit.box_cage(name + 'p', hr * 0.9, hr * h * 0.92, hr * 0.08, cuts=(4, 1, 1))
        kit.deform(pl, lambda p: V((p.x, p.y, p.z - (p.x / (hr * 0.5)) ** 2 * hr * 0.12)))
        kit.transform(pl, Matrix.Translation(V((c.x, y0 + hr * h * 0.5, c.z + hr * 0.92))))
        pl = kit.subsurf(pl, 1)
        kit.tag(pl, metal, mat=2, grp=G_FREE, ol=0.6)
        parts.append(pl)
        # 板上的刻紋（漩渦意象的簡化線條，不是原作徽記）
        mark = path_loft(name + 'm', [V((c.x - hr * 0.18, y0 + hr * h * 0.62, c.z + hr * 0.985)), V((c.x, y0 + hr * h * 0.38, c.z + hr * 0.99)), V((c.x + hr * 0.18, y0 + hr * h * 0.62, c.z + hr * 0.985))],
                         [hr * 0.018] * 3, n=6, flat=0.4)
        kit.tag(mark, cloth, grp=G_FREE, ol=0.0)
        parts.append(mark)
    if tails:
        for sx in (1, -1):
            t = path_loft(name + 't', [V((c.x + sx * hr * 0.12, y0 + hr * h * 0.5, c.z - hr * 0.95)), V((c.x + sx * hr * 0.22, y0 - hr * 0.3, c.z - hr * 1.25)), V((c.x + sx * hr * 0.34, y0 - hr * 0.85, c.z - hr * 1.38))],
                          [hr * 0.1, hr * 0.1, hr * 0.08], n=6, flat=0.18)
            t = kit.subsurf(t, 1)
            kit.tag(t, cloth, grp=G_FREE, ol=0.7)
            parts.append(t)
    if tilt:
        M = Matrix.Translation(c) @ Matrix.Rotation(tilt, 4, 'Z') @ Matrix.Rotation(-tilt * 0.4, 4, 'X') @ Matrix.Translation(-c)
        for o in parts:
            kit.transform(o, M)
    return parts


def straw_hat(F, straw, ribbon):
    """草帽：淺圓頂帽身＋寬帽簷＋紅帶，往後腦斜戴。"""
    c, hr = F.c, F.hr
    y0 = c.y + hr * 0.62
    crown = kit.loft('crown', [S(V((0, y0, 0)), hr * 0.95, hr * 0.95, p=2), S(V((0, y0 + hr * 0.3, 0)), hr * 0.92, hr * 0.92, p=2), S(V((0, y0 + hr * 0.55, 0)), hr * 0.72, hr * 0.72, p=2.2),
                              S(V((0, y0 + hr * 0.66, 0)), hr * 0.3, hr * 0.3, p=2)], n=24, cap0=None, cap1='pole')
    crown = kit.subsurf(crown, 1, solidify=hr * 0.04)
    kit.tag(crown, straw, grp=G_FREE, ol=0.8)
    rb = limb('ribbon', V((0, y0 + hr * 0.02, 0)), V((0, 1, 0)), [(0, hr * 0.965, hr * 0.965), (hr * 0.13, hr * 0.955, hr * 0.955), (hr * 0.26, hr * 0.94, hr * 0.94)], n=24, cap0=None, cap1=None)
    rb = kit.subsurf(rb, 1, solidify=hr * 0.025)
    kit.tag(rb, ribbon, grp=G_FREE, ol=0.6)
    brim = kit.loft('brim', [S(V((0, y0 - hr * 0.02, 0)), hr * 2.05, hr * 2.05, p=2), S(V((0, y0 + hr * 0.02, 0)), hr * 2.0, hr * 2.0, p=2)], n=32, cap0='pole', cap1='pole')
    kit.deform(brim, lambda p: V((p.x, p.y - ((p.x * p.x + p.z * p.z) ** 0.5 / (hr * 2.0)) ** 3 * hr * 0.1, p.z)))
    brim = kit.subsurf(brim, 1)
    kit.tag(brim, straw, grp=G_FREE, ol=0.8)
    parts = [crown, rb, brim]
    M = Matrix.Translation(V((0, -hr * 0.06, -hr * 0.1))) @ Matrix.Translation(c) @ Matrix.Rotation(-0.22, 4, 'X') @ Matrix.Translation(-c)
    for o in parts:
        kit.transform(o, M)
    return parts


def katana(P, grip_c, guard_c, sheath_c, length=1.0, name='kat'):
    """日本刀：刀柄在原點、刀身沿 +y 微彎（劍座局部座標，和特南克斯的劍同一規格）。回傳 (刀, 鞘)。"""
    steel = P(0xe6ecf2)
    grip = limb(name + 'g', V((0, -0.2, 0)), V((0, 1, 0)), [(0, 0.016, 0.014), (0.1, 0.017, 0.015), (0.2, 0.016, 0.014)], n=8, cap0='pole', cap1=None)
    grip = kit.subsurf(grip, 1)
    kit.tag(grip, grip_c, ol=0.6)
    # 柄卷：交錯的菱形用細環表現
    wraps = []
    for i in range(5):
        w = band(name + 'w', V((0, -0.19, 0)), V((0, 1, 0)), 0.02 + i * 0.036, 0.034 + i * 0.036, 0.018, 0.018, steel, G_FREE, thick=0.003, n=8, ol=0.0)
        wraps.append(w)
    tsuba = kit.loft(name + 't', [S(V((0, 0.0, 0)), 0.042, 0.036, p=2), S(V((0, 0.012, 0)), 0.042, 0.036, p=2)], n=16, cap0='pole', cap1='pole')
    kit.tag(tsuba, guard_c, mat=2, ol=0.6)
    L = 0.95 * length
    curve = lambda t: V((0, 0.02 + t * L, -0.035 * t * t))
    blade = kit.loft(name + 'b', [S(curve(0), 0.016, 0.004, p=1.3), S(curve(0.5), 0.015, 0.0038, p=1.3), S(curve(0.92), 0.013, 0.0034, p=1.3), S(curve(1.0) + V((0, 0.02, -0.006)), 0.002, 0.001, p=1.2)],
                     n=8, cap0='pole', cap1=None, front=V((0, 0, 1)), side=V((1, 0, 0)))
    kit.split_sharp(blade, 35)
    kit.tag(blade, steel, mat=2, ol=0.45)
    sh = kit.loft(name + 's', [S(curve(0.0) + V((0, 0.012, 0)), 0.021, 0.013, p=1.8), S(curve(0.5), 0.02, 0.012, p=1.8), S(curve(1.0) + V((0, 0.03, -0.006)), 0.016, 0.01, p=1.8)],
                  n=10, cap0='pole', cap1='pole')
    sh = kit.subsurf(sh, 1)
    kit.tag(sh, sheath_c, ol=0.7)
    return [grip, tsuba, blade] + wraps, [sh]


def open_jacket(F, pal, rows, e=0.02, gap0=0.3, gap1=0.55, name='jacket', thick=0.01, pec=0.07):
    """前襟敞開的上衣（gap 由下往上漸寬）。"""
    us = [r[0] for r in rows]
    jk = kit.loft(name, torso_rows(F, e=e, rows=rows, pec=pec), n=20, cap0=None, cap1=None, gap=lambda i: gap0 + (gap1 - gap0) * smooth((us[i] - 0.5) / 0.5))
    jk = kit.subsurf(jk, 2, solidify=thick)
    return kit.tag(jk, pal, grp=G_TORSO)


def long_sleeve(F, pal, s_end=None, k=1.0, name='sleeveL', thick=0.007, e=0.008, cuff=1.0):
    """貼合手臂的長袖：照 arm_skin 的斷面（三角肌→上臂→手肘→前臂收細）外擴 e，不是一根等粗的管子。
    起點在肩關節內側、半徑接近三角肌，開口藏進軀幹殼裡，手臂放下時不會露出方形袖口。"""
    ka, kf = F.k_arm * k, F.k_fore * k
    up, lo = F.up, F.lo
    s_end = s_end if s_end is not None else up + lo - 0.05
    st = [
        (-0.11, 0.035 * ka, 0.035 * ka),
        (-0.085, 0.068 * ka + e * 0.5, 0.066 * ka + e * 0.5),
        (-0.04, 0.086 * ka + e, 0.084 * ka + e),
        (0.0, 0.09 * ka + e, 0.088 * ka + e),
        (0.07, 0.09 * ka + e, 0.088 * ka + e),
        (0.15, 0.082 * ka + e, 0.086 * ka + e),
        (up - 0.04, 0.068 * ka + e, 0.07 * ka + e),
        (up + 0.02, 0.068 * kf + e * 1.1, 0.066 * kf + e * 1.1),
        (up + 0.12, 0.064 * kf + e * 1.1, 0.058 * kf + e * 1.1),
        (s_end - 0.03, 0.056 * kf * cuff + e * 1.2, 0.05 * kf * cuff + e * 1.2),
        (s_end, 0.055 * kf * cuff + e * 1.2, 0.049 * kf * cuff + e * 1.2),
    ]
    sl = limb(name, F.sh, F.da, st, n=14, cap0='pole', cap1=None)  # 肩頭收成圓頂封口
    sl = kit.subsurf(sl, 2, solidify=thick)
    return kit.tag(sl, pal, grp=G_ARM_L)


def straight_leg(F, pal, k=1.0, s_end=None, flare=1.0, name='legL'):
    kl = F.k_leg * k
    s_end = s_end if s_end is not None else F.tl + F.sl - 0.04
    return leg_tube(F, pal, [(-0.07, 0.122 * kl, 0.122 * kl), (0.04, 0.124 * kl, 0.128 * kl), (0.2, 0.11 * kl, 0.114 * kl), (F.tl - 0.02, 0.092 * kl, 0.096 * kl),
                             (F.tl + 0.1, 0.09 * kl, 0.092 * kl), (s_end - 0.05, 0.086 * kl * flare, 0.088 * kl * flare), (s_end, 0.07 * kl * flare, 0.072 * kl * flare)], name=name)


def bare_torso(F, skin, pec=0.12, lat=0.1, abs_=True):
    """露出的軀幹皮膚（魯夫、索隆敞開的胸口）：胸肌、腹肌分塊用遮蔽刻出來。"""
    sts = torso_rows(F, e=0.0, u0=0.0, pec=pec, lat=lat)
    if abs_:
        for st in sts:
            pass
    tor = kit.loft('chest', sts, n=20, cap0=None, cap1=None)
    tor = kit.subsurf(tor, 2)
    return kit.tag(tor, skin, mat=4, grp=G_TORSO)


def sandal(F, skin, sole, name='footL'):
    """赤腳穿夾腳拖：小腿與腳都是皮膚，加一片鞋底。"""
    parts = boot(F, skin, F.tl + F.sl - 0.12, 0.052, pal_sole=sole, toe=0.95, name=name)
    for o in parts:
        kit.tag(o, skin, mat=4, grp=G_FOOT_L)
    kit.paint_field(parts[1], lambda co: co.y - 0.016, sole, 0)
    return parts


# ================================================================ 鳴人
def build_naruto(R):
    F = Fig(R)
    P = kit.Palette()
    skin = P(0xf6c9a0)
    orange, orangeD = P(0xff7a1a), P(0xd85a0c)
    black = P(0x1c1c24)
    zip_c = P(0xd8d8e0)
    wrap = P(0xeeeae0)
    sandal_c = P(0x23263a)
    cloth, metal = P(0x23263a), P(0xb9c2cc)
    team = P(-1)
    body, proxy = [], []

    # 運動外套：上半身黑色肩片、下半身橘色，拉鍊立領
    rows = [(0.02, ('w', 1.2), 0.9, 0.0)] + [r for r in TORSO_ROWS if r[0] > 0.1]
    jk = kit.loft('jacket', torso_rows(F, e=0.016, rows=rows, pec=0.1, lat=0.08), n=20, cap0=None, cap1=None)
    jk = kit.subsurf(jk, 2, solidify=0.01)
    kit.tag(jk, orange, grp=G_TORSO)
    kit.paint_field(jk, lambda co: F.y(0.72) - co.y, black, 0)
    body.append(jk)
    proxy.append(jk)
    zp = path_loft('zip', [V((0, F.y(0.04), F.cz * 0.93 + 0.022)), V((0, F.y(0.5), F.cz * 1.02 + 0.02)), V((0, F.y(0.95), F.cz * 0.8 + 0.02))], [0.008, 0.008, 0.008], n=6, flat=0.5)
    body.append(kit.tag(kit.subsurf(zp, 1), zip_c, mat=2, grp=G_TORSO, ol=0.3))
    col = kit.loft('collar', [S(V((0, F.y(0.93), -0.01)), F.cx * 0.6, F.cz * 0.74), S(V((0, F.y(1.05), -0.015)), F.cx * 0.52, F.cz * 0.66), S(V((0, F.y(1.12), -0.02)), F.cx * 0.5, F.cz * 0.64)],
                   n=16, cap0=None, cap1=None)
    col = kit.subsurf(col, 2, solidify=0.008)
    body.append(kit.tag(col, black, grp=G_NECK, ol=0.8))
    body.append(neck(F, skin, r=0.054))
    proxy.append(body[-1])
    sl = long_sleeve(F, orange, k=1.05)
    kit.paint_field(sl, lambda co: arm_s(F, co) - 0.11, black, 0)
    cuff = band('cuffL', F.sh, F.da, F.up + F.lo - 0.075, F.up + F.lo - 0.04, 0.072 * F.k_arm, 0.07 * F.k_arm, orangeD, G_FORE_L, thick=0.008)
    arm = arm_skin(F, skin, muscle=0.8)
    kit.paint_field(arm, lambda co: arm_s(F, co) - (F.up + F.lo - 0.06), orange, 0)
    hand = fist(F, skin, scale=1.0)
    body.append(pelvis(F, orange, e=0.012))
    proxy.append(body[-1])
    leg = baggy_leg(F, orange, bag=1.0, blouse=0.95, s_end=F.tl + F.sl - 0.1)
    wr = band('wrapL', F.th, F.dl, F.tl + F.sl - 0.16, F.tl + F.sl - 0.08, 0.07 * F.k_shin, 0.062 * F.k_shin, wrap, G_LEG_L, thick=0.006)
    bt = boot(F, sandal_c, F.tl + F.sl - 0.09, 0.056, pal_sole=sandal_c, toe=0.95)
    pair_add(body, proxy, [sl, cuff, arm, hand, leg, wr] + bt, proxy_set=[arm, hand, leg] + bt)
    body.append(team_band(F, team, 1.25))
    # 腿上的忍具包（右大腿）
    pouch = kit.box_cage('pouch', 0.07, 0.09, 0.05, cuts=(1, 1, 1))
    kit.transform(pouch, Matrix.Translation(F.leg_pt(0.16) + V((0.12 * F.k_leg + 0.02, 0, 0.02))))
    body.append(kit.tag(kit.subsurf(pouch, 2), sandal_c, grp=G_LEG_L, ol=0.6))

    h = anime_head('head_base', F, skin, jaw=0.95, chin=0.9, cheek=1.0, nose=0.8)
    hc = P(0xf6c93a)
    heads = {'base': [h, hair_cap('cap', F, hc, hairline=0.6, temple=0.1, scale=1.06, nape=-0.55)] + hair(F, hc, naruto_hair()) + head_band(F, cloth, metal, y=0.38, h=0.34)}
    return finish(F, P, body, proxy, heads)


def naruto_hair():
    return sym([
        ((0.0, 0.98, 0.1), (0.1, 2.0, 0.2), 0.5, 0.22, (0, 0.1, 0.1)),
        ((0.45, 0.85, 0.1), (1.3, 1.7, 0.0), 0.46, 0.21, (0.1, 0.2, 0)),
        ((0.75, 0.5, -0.1), (1.75, 0.9, -0.25), 0.42, 0.2, (0, 0.15, 0)),
        ((0.8, 0.1, -0.35), (1.6, -0.25, -0.65), 0.38, 0.18, (0, 0.05, 0)),
        ((0.3, 0.78, -0.5), (0.9, 1.6, -1.2), 0.48, 0.22, (0, 0.1, 0)),
        ((0.0, 0.5, -0.82), (0.1, 1.0, -1.75), 0.48, 0.22, (0, 0.1, 0)),
        ((0.45, 0.1, -0.85), (1.0, -0.2, -1.55), 0.42, 0.2, (0, 0.05, 0)),
        ((0.0, -0.2, -0.9), (0.05, -0.65, -1.45), 0.38, 0.18, (0, 0, 0)),
        ((0.15, 0.85, 0.5), (0.1, 0.55, 1.12), 0.3, 0.14, (0, 0.1, 0.1)),
        ((0.5, 0.75, 0.45), (0.75, 0.45, 1.0), 0.28, 0.13, (0, 0.08, 0.1)),
        ((0.78, 0.45, 0.3), (1.0, -0.2, 0.62), 0.22, 0.11, (0, 0, 0.06)),
    ])


# ================================================================ 佐助
def build_sasuke(R):
    F = Fig(R)
    P = kit.Palette()
    skin = P(0xf5d6bc)
    white, whiteD = P(0xf2f0ea), P(0xc8c6c2)
    navy, navyD = P(0x262a46), P(0x1a1d30)
    rope = P(0x7a4fc0)
    guard = P(0x30344e)
    sw_grip, sw_guard, sw_sheath = P(0x2a2a30), P(0x9aa0aa), P(0x18181e)
    team = P(-1)
    body, proxy = [], []

    chest = kit.loft('chest', torso_rows(F, e=0.0, u0=0.0, pec=0.12, lat=0.08), n=18, cap0=None, cap1=None)
    chest = kit.subsurf(chest, 2)
    kit.tag(chest, skin, mat=4, grp=G_TORSO)
    body.append(chest)
    proxy.append(chest)
    # 白色和服上衣：胸前大 V 開口、寬袖
    rows = [(0.02, ('w', 1.22), 0.92, 0.0)] + [r for r in TORSO_ROWS if r[0] > 0.1]
    us = [r[0] for r in rows]
    top = kit.loft('gi_top', torso_rows(F, e=0.02, rows=rows, pec=0.1, lat=0.06), n=20, cap0=None, cap1=None, gap=lambda i: 0.0 if us[i] <= 0.3 else min(1.2, 0.1 + (us[i] - 0.3) * 1.7))
    top = kit.subsurf(top, 2, solidify=0.011)
    kit.tag(top, white, grp=G_TORSO)
    body.append(top)
    body.append(neck(F, skin, r=0.054))
    proxy.append(body[-1])
    slv = sleeve(F, white, s1=0.2, r=0.098 * F.k_arm + 0.01, flare=1.16, s0=-0.06)
    arm = arm_skin(F, skin, muscle=0.9)
    kit.paint_field(arm, lambda co: arm_s(F, co) - 0.15, white, 0)
    ag = band('guardL', F.sh, F.da, F.up + 0.06, F.up + F.lo - 0.02, 0.07 * F.k_fore, 0.058 * F.k_fore, guard, G_FORE_L, thick=0.01)
    hand = fist(F, skin, scale=1.0)
    # 腰間的紫色粗繩＋深藍腰布（前開）
    body.append(pelvis(F, navy, e=0.012))
    proxy.append(body[-1])
    yb = F.L + 0.09
    rp = belt_ring(F, yb, 0.06, rope, e=0.03, thick=0.022)
    body.append(rp)
    for sx in (1, -1):
        bow = path_loft('bow', [V((sx * 0.02, yb, -F.cz * 1.0)), V((sx * 0.12, yb + 0.03, -F.cz * 1.1)), V((sx * 0.06, yb - 0.08, -F.cz * 1.08))], [0.026, 0.03, 0.022], n=8)
        body.append(kit.tag(kit.subsurf(bow, 1), rope, grp=G_BELT, ol=0.7))
    hw = F.R['hip']
    apron = kit.loft('apron', [S(V((0, yb - 0.02, 0)), F.w * 1.3 + 0.03, F.cz * 0.98 + 0.03, p=2.2), S(V((0, F.L - 0.1, 0)), hw * 1.8, F.cz * 1.12, p=2.1),
                               S(V((0, F.L - 0.3, 0)), hw * 1.95, F.cz * 1.22, p=2.0)], n=22, cap0=None, cap1=None, gap=lambda i: 0.35)
    apron = kit.subsurf(apron, 2, solidify=0.009)
    body.append(kit.tag(apron, navyD, grp=G_PELVIS))
    leg = straight_leg(F, navy, k=1.0, s_end=F.tl + F.sl - 0.08)
    bt = boot(F, navyD, F.tl + 0.1, 0.07, pal_sole=navyD)
    pair_add(body, proxy, [slv, arm, ag, hand, leg] + bt, proxy_set=[arm, hand, leg] + bt)
    body.append(team_band(F, team, 1.2))

    h = anime_head('head_base', F, skin, jaw=0.95, chin=0.92, cheek=0.96, nose=0.75)
    hc = P(0x1a1c2e)
    heads = {'base': [h, hair_cap('cap', F, hc, hairline=0.42, temple=0.05, scale=1.07, nape=-0.65)] + hair(F, hc, sasuke_hair())}
    blade, sheath = katana(P, sw_grip, sw_guard, sw_sheath, length=1.0)
    return finish(F, P, body, proxy, heads, extras={'sword': blade, 'sheath': sheath})


def sasuke_hair():
    # 後腦往後上方翹起的髮束，前方兩側長瀏海垂到下巴
    return sym([
        ((0.0, 0.7, -0.6), (0.1, 1.5, -1.6), 0.5, 0.22, (0, 0.3, 0)),
        ((0.4, 0.6, -0.6), (0.95, 1.2, -1.55), 0.46, 0.21, (0, 0.25, 0)),
        ((0.7, 0.3, -0.55), (1.35, 0.5, -1.3), 0.42, 0.2, (0, 0.15, 0)),
        ((0.2, 0.2, -0.88), (0.5, 0.5, -1.75), 0.44, 0.2, (0, 0.1, 0)),
        ((0.0, 0.95, 0.0), (0.05, 1.4, -0.9), 0.48, 0.2, (0, 0.2, 0)),
        ((0.35, 0.85, 0.4), (0.85, -0.55, 0.78), 0.3, 0.12, (0.2, 0.3, 0.15)),
        ((0.12, 0.9, 0.5), (0.1, 0.25, 1.0), 0.26, 0.11, (0, 0.15, 0.15)),
    ])


# ================================================================ 卡卡西
def build_kakashi(R):
    F = Fig(R)
    P = kit.Palette()
    skin = P(0xf2d2b4)
    navy, navyD = P(0x283048), P(0x1c2236)
    vest, vestD = P(0x5f7a3c), P(0x4a6230)
    red = P(0xc8443a)
    wrap = P(0xeeeae0)
    cloth, metal = P(0x283048), P(0xb9c2cc)
    team = P(-1)
    body, proxy = [], []

    sh = kit.loft('shirt', torso_rows(F, e=0.004, u0=0.0, pec=0.08), n=18, cap0=None, cap1=None)
    sh = kit.subsurf(sh, 2)
    kit.tag(sh, navy, grp=G_TORSO)
    body.append(sh)
    proxy.append(sh)
    # 綠色戰術背心：厚、前方雙排口袋
    vs = kit.loft('vest', torso_rows(F, e=lambda u: 0.02 - 0.012 * smooth((u - 0.85) / 0.12), u0=0.12, u1=0.97, pec=0.06, lat=0.05, p=2.35), n=20, cap0=None, cap1=None)
    vs = kit.subsurf(vs, 2, solidify=0.014)
    kit.tag(vs, vest, grp=G_TORSO)
    body.append(vs)
    from heroes import tree_of
    vt = tree_of(vs)
    def on_vest(name, x, u, w, h, d):
        """貼在背心表面的口袋：從前方往後打射線取表面點與法線，口袋沿法線貼上。"""
        hit = vt.ray_cast(V((x, F.y(u), 1.0)), V((0, 0, -1)), 2)
        p, n = (hit[0], hit[1]) if hit[0] is not None else (V((x, F.y(u), F.cz * 1.05)), V((0, 0, 1)))
        pk = kit.box_cage(name, w, h, d, cuts=(1, 1, 1))
        rot = V((0, 0, 1)).rotation_difference(n).to_matrix().to_4x4()
        kit.transform(pk, Matrix.Translation(p + n * (d * 0.35)) @ rot)
        return kit.tag(kit.subsurf(pk, 2), vestD, grp=G_TORSO, ol=0.45)
    for sx in (1, -1):
        for u in (0.34, 0.5):
            body.append(on_vest('pocket', sx * F.cx * 0.42, u, 0.082, 0.07, 0.018))
        body.append(on_vest('scroll', sx * F.cx * 0.5, 0.7, 0.05, 0.1, 0.022))
    col = kit.loft('collar', [S(V((0, F.y(0.92), -0.01)), F.cx * 0.62, F.cz * 0.78), S(V((0, F.y(1.03), -0.015)), F.cx * 0.56, F.cz * 0.7)], n=16, cap0=None, cap1=None)
    col = kit.subsurf(col, 2, solidify=0.012)
    body.append(kit.tag(col, vest, grp=G_NECK, ol=0.8))
    body.append(neck(F, navy, r=0.056))
    proxy.append(body[-1])
    sl = long_sleeve(F, navy, k=1.0)
    arm = arm_skin(F, skin, muscle=0.8)
    kit.paint_field(arm, lambda co: arm_s(F, co) - (F.up + F.lo - 0.06), navy, 0)  # 袖子下的手臂染成衣服色：彎肘時戳出來也不會露膚色
    glove = band('gloveL', F.sh, F.da, F.up + F.lo - 0.05, F.up + F.lo + 0.01, 0.062 * F.k_fore, 0.058 * F.k_fore, navyD, G_FORE_L, thick=0.008)
    hand = fist(F, skin, scale=1.0)
    body.append(pelvis(F, navy, e=0.012))
    proxy.append(body[-1])
    body.append(belt_ring(F, F.L + 0.08, 0.035, navyD, e=0.016))
    leg = straight_leg(F, navy)
    wr = band('wrapL', F.th, F.dl, F.tl + F.sl - 0.17, F.tl + F.sl - 0.08, 0.07 * F.k_shin, 0.062 * F.k_shin, wrap, G_LEG_L, thick=0.006)
    bt = boot(F, navyD, F.tl + F.sl - 0.09, 0.056, pal_sole=navyD)
    pair_add(body, proxy, [sl, arm, glove, hand, leg, wr] + bt, proxy_set=[arm, hand, leg] + bt)
    body.append(team_band(F, team, 1.2))
    # 左臂的紅色漩渦臂章（簡化成紅色細環）
    body.append(band('mark', F.sh, F.da, 0.06, 0.09, 0.102 * F.k_arm, 0.1 * F.k_arm, red, G_UPPER_L, thick=0.004, ol=0.4))

    h = anime_head('head_base', F, skin, jaw=0.98, chin=0.95, nose=0.6)
    hc = P(0xd8dbe6)
    heads = {'base': [h, hair_cap('cap', F, hc, hairline=0.55, temple=0.0, scale=1.07, nape=-0.6)] + hair(F, hc, kakashi_hair())
             + head_band(F, cloth, metal, y=0.3, h=0.38, tilt=0.42, tails=True)}
    return finish(F, P, body, proxy, heads)


def kakashi_hair():
    # 銀髮整片往角色右上方（−X）斜沖
    cl = [
        ((0.0, 0.95, 0.2), (-1.1, 2.1, 0.0), 0.5, 0.22, (-0.2, 0.2, 0)),
        ((0.4, 0.85, 0.1), (-0.5, 2.3, -0.3), 0.48, 0.21, (0, 0.2, 0)),
        ((-0.4, 0.85, 0.1), (-1.6, 1.7, -0.2), 0.46, 0.21, (-0.2, 0.1, 0)),
        ((0.7, 0.55, -0.1), (0.3, 1.9, -0.7), 0.44, 0.2, (0.1, 0.2, 0)),
        ((-0.7, 0.55, -0.1), (-1.85, 1.0, -0.5), 0.42, 0.2, (0, 0.1, 0)),
        ((0.0, 0.6, -0.75), (-0.6, 1.6, -1.6), 0.48, 0.22, (0, 0.2, 0)),
        ((0.5, 0.3, -0.75), (0.2, 1.1, -1.65), 0.44, 0.2, (0.1, 0.1, 0)),
        ((-0.5, 0.3, -0.75), (-1.3, 0.6, -1.4), 0.42, 0.2, (0, 0.1, 0)),
        ((0.0, -0.1, -0.92), (-0.3, -0.4, -1.5), 0.4, 0.18, (0, 0, 0)),
        ((0.3, 0.8, 0.5), (0.05, 0.45, 1.05), 0.28, 0.13, (0, 0.1, 0.1)),
    ]
    return cl


# ================================================================ 小櫻
def build_sakura(R):
    F = Fig(R)
    P = kit.Palette()
    skin = P(0xf9dac4)
    red, redD = P(0xc8303a), P(0x962028)
    white = P(0xf4f0ea)
    skirt_c = P(0xe8b4c8)
    black = P(0x1e1e26)
    pink = P(0xf2a0c0)
    cloth, metal = P(0xc8303a), P(0xb9c2cc)
    team = P(-1)
    body, proxy = [], []

    # 紅色無袖上衣（立領、前襟拉鍊）
    top = kit.loft('top', torso_rows(F, e=0.006, u0=0.0, pec=0, lat=0, bust=0.13, rows=FEMALE_ROWS), n=18, cap0=None, cap1=None)
    top = kit.subsurf(top, 2)
    kit.tag(top, red, grp=G_TORSO)
    body.append(top)
    proxy.append(top)
    zp = path_loft('zip', [V((0, F.y(0.3), F.cz * 0.9 + 0.012)), V((0, F.y(0.65), F.cz * 1.04 + 0.012)), V((0, F.y(0.97), F.cz * 0.7 + 0.012))], [0.006] * 3, n=6, flat=0.5)
    body.append(kit.tag(kit.subsurf(zp, 1), white, grp=G_TORSO, ol=0.3))
    col = kit.loft('collar', [S(V((0, F.y(0.94), -0.01)), F.cx * 0.6, F.cz * 0.76), S(V((0, F.y(1.06), -0.015)), F.cx * 0.52, F.cz * 0.66)], n=16, cap0=None, cap1=None)
    body.append(kit.tag(kit.subsurf(col, 2, solidify=0.008), red, grp=G_NECK, ol=0.8))
    body.append(neck(F, skin, r=0.046))
    proxy.append(body[-1])
    arm = arm_skin(F, skin, muscle=0.35, k=1.02)
    pad = band('padL', F.sh, F.da, F.up - 0.03, F.up + 0.04, 0.06 * F.k_arm, 0.06 * F.k_arm, pink, G_ARM_L, thick=0.01, ol=0.6)
    glove = band('gloveL', F.sh, F.da, F.up + F.lo - 0.09, F.up + F.lo + 0.005, 0.052 * F.k_fore, 0.05 * F.k_fore, black, G_FORE_L, thick=0.008)
    hand = fist(F, black, mat=0, scale=1.0, glove=True)
    # 粉色開衩短裙＋黑色短褲＋長靴
    body.append(pelvis(F, black, e=0.004))
    proxy.append(body[-1])
    yb = F.y(0.12)
    hw = F.R['hip']
    sk = kit.loft('skirt', [S(V((0, yb, 0)), F.w * 1.24 + 0.01, F.cz * 0.88 + 0.01, p=2.2), S(V((0, F.L + 0.02, 0)), hw * 1.62, F.cz * 1.0, p=2.2),
                            S(V((0, F.L - 0.14, 0.005)), hw * 1.86, F.cz * 1.15, p=2.1)], n=22, cap0=None, cap1=None, gap=lambda i: 0.18)
    sk = kit.subsurf(sk, 2, solidify=0.008)
    body.append(kit.tag(sk, skirt_c, grp=G_PELVIS))
    kl = F.k_leg
    calf = lambda th: 1 + 0.09 * ang_bump(th, BACK, 1.0)
    leg = leg_tube(F, skin, [(-0.07, 0.112 * kl, 0.112 * kl), (0.05, 0.11 * kl, 0.114 * kl), (0.22, 0.094 * kl, 0.098 * kl), (F.tl - 0.03, 0.068 * kl, 0.074 * kl),
                             (F.tl + 0.07, 0.064 * kl, 0.07 * kl, calf), (F.tl + 0.14, 0.05 * kl, 0.054 * kl)], mat=4)
    kit.paint_field(leg, lambda co: (co - F.th).dot(F.dl) - 0.14, black, 0)  # 黑色短褲
    bt = boot(F, black, F.tl + 0.07, 0.066, pal_sole=black, toe=0.9)
    kp = band('kneeL', F.th, F.dl, F.tl - 0.045, F.tl + 0.045, 0.08 * kl, 0.082 * kl, pink, G_LEG_L, thick=0.016, ol=0.7, bulge=1.08)
    pair_add(body, proxy, [arm, pad, glove, hand, leg, kp] + bt, proxy_set=[arm, hand, leg] + bt)
    body.append(team_band(F, team, 1.0))

    h = anime_head('head_base', F, skin, jaw=0.88, chin=0.84, cheek=0.96, nose=0.65)
    hc = P(0xf4a6c4)
    heads = {'base': [h, hair_cap('cap', F, hc, hairline=0.72, temple=0.0, scale=1.08, nape=-0.75, side_cut=False)] + hair(F, hc, sakura_hair())
             + head_band(F, cloth, metal, y=0.56, h=0.3, tails=False)}
    return finish(F, P, body, proxy, heads)


def sakura_hair():
    # 及肩短髮、額頭露出（中分）
    return sym([
        ((0.3, 0.9, 0.35), (0.78, -0.4, 0.62), 0.38, 0.13, (0.3, 0.3, 0.2)),
        ((0.4, 0.85, 0.0), (1.0, -0.62, 0.12), 0.44, 0.15, (0.4, 0.25, 0.05)),
        ((0.34, 0.82, -0.32), (0.96, -0.66, -0.45), 0.46, 0.16, (0.4, 0.25, -0.05)),
        ((0.18, 0.8, -0.6), (0.6, -0.72, -0.95), 0.46, 0.16, (0.25, 0.25, -0.25)),
        ((0.03, 0.78, -0.75), (0.14, -0.74, -1.08), 0.46, 0.16, (0.08, 0.25, -0.3)),
    ])


# ================================================================ 魯夫
def build_luffy(R):
    F = Fig(R)
    P = kit.Palette()
    skin = P(0xedb88e)
    red, redD = P(0xd8242e), P(0xa8161e)
    denim, denimD = P(0x3f62b8), P(0x2c4890)
    sash = P(0xf2c43a)
    sole = P(0x6a4a2a)
    scar = P(0xb87a5a)
    straw, ribbon = P(0xf0d27a), P(0xd8242e)
    team = P(-1)
    body, proxy = [], []

    chest = bare_torso(F, skin, pec=0.13, lat=0.1)
    # 胸口的 X 形疤
    for a in (0.6, -0.6):
        d = V((math.sin(a), math.cos(a), 0))
        c0 = V((0, F.y(0.68), F.cz * 1.08 + 0.004))
        sc = path_loft('scar', [c0 - d * 0.08, c0, c0 + d * 0.08], [0.006, 0.008, 0.006], n=6, flat=0.4)
        body.append(kit.tag(kit.subsurf(sc, 1), scar, mat=4, grp=G_TORSO, ol=0.0))
    body.append(chest)
    proxy.append(chest)
    # 紅色無袖背心：前襟整片敞開
    rows = [(0.08, ('w', 1.18), 0.9, 0.0)] + [r for r in TORSO_ROWS if r[0] > 0.15]
    vest = open_jacket(F, red, rows, e=0.018, gap0=0.55, gap1=0.75, name='vest', pec=0.1)
    body.append(vest)
    body.append(neck(F, skin, r=0.054))
    proxy.append(body[-1])
    arm = arm_skin(F, skin, muscle=1.0, k=1.0)
    hand = fist(F, skin, scale=1.08)
    # 黃色腰帶、反摺的牛仔短褲到膝蓋、赤腳拖鞋
    body.append(pelvis(F, denim, e=0.012))
    proxy.append(body[-1])
    yb = F.L + 0.08
    body.append(belt_ring(F, yb, 0.07, sash, e=0.02, thick=0.012))
    knot = path_loft('knot', [V((F.w * 1.0, yb, F.cz * 0.6)), V((F.w * 1.25, yb - 0.08, F.cz * 0.62)), V((F.w * 1.3, yb - 0.22, F.cz * 0.55))], [0.03, 0.028, 0.022], n=8, flat=0.35)
    body.append(kit.tag(kit.subsurf(knot, 1), sash, grp=G_BELT, ol=0.7))
    kl = F.k_leg
    shorts = leg_tube(F, denim, [(-0.07, 0.128 * kl, 0.128 * kl), (0.04, 0.132 * kl, 0.136 * kl), (0.2, 0.124 * kl, 0.126 * kl), (F.tl - 0.02, 0.11 * kl, 0.112 * kl),
                                 (F.tl + 0.04, 0.108 * kl, 0.11 * kl)], cap1=None, name='shortsL')
    cuff = band('cuffL', F.th, F.dl, F.tl - 0.02, F.tl + 0.05, 0.114 * kl, 0.116 * kl, denimD, G_LEG_L, thick=0.01)
    calf = lambda th: 1 + 0.1 * ang_bump(th, BACK, 1.0)
    shin = leg_tube(F, skin, [(F.tl - 0.06, 0.086 * kl, 0.088 * kl), (F.tl + 0.1, 0.08 * kl, 0.086 * kl, calf), (F.tl + 0.2, 0.064 * kl, 0.068 * kl, calf), (F.tl + F.sl - 0.06, 0.05 * kl, 0.054 * kl)],
                    name='shinL', mat=4)
    ft = sandal(F, skin, sole)
    pair_add(body, proxy, [arm, hand, shorts, cuff, shin] + ft, proxy_set=[arm, hand, shorts] + ft)
    body.append(team_band(F, team, 1.2))

    h = anime_head('head_base', F, skin, jaw=0.95, chin=0.9, cheek=1.02, nose=0.7)
    hc = P(0x18161e)
    heads = {'base': [h, hair_cap('cap', F, hc, hairline=0.28, temple=0.1, scale=1.06, nape=-0.6)] + hair(F, hc, luffy_hair()) + straw_hat(F, straw, ribbon)}
    return finish(F, P, body, proxy, heads)


def luffy_hair():
    return sym([
        ((0.0, 0.7, 0.62), (-0.04, 0.36, 1.0), 0.34, 0.09, (0, 0.04, 0.1)),
        ((0.24, 0.68, 0.6), (0.3, 0.32, 0.96), 0.32, 0.09, (0.02, 0.04, 0.09)),
        ((0.46, 0.62, 0.54), (0.6, 0.26, 0.86), 0.3, 0.09, (0.04, 0.04, 0.08)),
        ((0.64, 0.5, 0.42), (0.82, 0.0, 0.66), 0.26, 0.09, (0.04, 0.02, 0.06)),
        ((0.76, 0.34, 0.2), (0.9, -0.2, 0.34), 0.24, 0.09, (0.04, 0, 0.03)),
        ((0.82, 0.2, -0.2), (0.96, -0.24, -0.28), 0.24, 0.09, (0.04, 0, 0)),
        ((0.45, 0.2, -0.8), (0.62, -0.32, -1.02), 0.28, 0.12, (0.04, 0, -0.06)),
        ((0.0, 0.1, -0.92), (0.05, -0.38, -1.12), 0.28, 0.12, (0, 0, -0.06)),
    ])


# ================================================================ 索隆
def build_zoro(R):
    F = Fig(R)
    P = kit.Palette()
    skin = P(0xdcab7c)
    coat, coatD = P(0x2e5a3a), P(0x203f29)
    red = P(0xb8262e)
    black = P(0x1a1a20)
    scar = P(0xa8704e)
    sw_grip, sw_guard, sw_sheath = P(0xf0eee8), P(0xc8a040), P(0x18181e)
    gold = P(0xe8c050)
    team = P(-1)
    body, proxy = [], []

    chest = bare_torso(F, skin, pec=0.14, lat=0.12)
    c0 = V((0, F.y(0.6), F.cz * 1.08 + 0.004))
    d = V((math.sin(0.75), math.cos(0.75), 0))
    sc = path_loft('scar', [c0 - d * 0.2, c0, c0 + d * 0.2], [0.006, 0.009, 0.006], n=6, flat=0.4)
    body.append(kit.tag(kit.subsurf(sc, 1), scar, mat=4, grp=G_TORSO, ol=0.0))
    body.append(chest)
    proxy.append(chest)
    # 深綠長大衣：胸口大開、下襬到大腿，腰間紅色腰帶
    rows = [(-0.32, ('w', 1.6), 1.12, 0.0), (-0.12, ('w', 1.34), 0.98, 0.0), (0.04, ('w', 1.2), 0.9, 0.0)] + [r for r in TORSO_ROWS if r[0] > 0.1]
    us = [r[0] for r in rows]
    cs = torso_rows(F, e=0.022, rows=rows, pec=0.1, lat=0.08)
    ct = kit.loft('coat', cs, n=22, cap0=None, cap1=None, gap=lambda i: 0.42 if us[i] < 0.1 else min(1.1, 0.25 + (us[i] - 0.2) * 1.2))
    ct = kit.subsurf(ct, 2, solidify=0.012)
    kit.tag(ct, coat, grp=G_TORSO)
    body.append(ct)
    yb = F.L + 0.1
    body.append(belt_ring(F, yb, 0.08, red, e=0.04, thick=0.014))
    body.append(neck(F, skin, r=0.06))
    proxy.append(body[-1])
    arm = arm_skin(F, skin, muscle=1.3, k=1.08)
    kit.paint_field(arm, lambda co: arm_s(F, co) - 0.17, coat, 0)
    slv = sleeve(F, coat, s1=0.2, r=0.094 * F.k_arm + 0.008, flare=1.08, s0=-0.06)
    bandana = band('bandL', F.sh, F.da, 0.1, 0.17, 0.11 * F.k_arm, 0.105 * F.k_arm, black, G_UPPER_L, thick=0.008)
    hand = fist(F, skin, scale=1.08)
    body.append(pelvis(F, black, e=0.012))
    proxy.append(body[-1])
    leg = straight_leg(F, black, k=1.05)
    bt = boot(F, black, F.tl + 0.08, 0.078, pal_sole=black)
    pair_add(body, proxy, [arm, hand, leg] + bt, proxy_set=[arm, hand, leg] + bt)
    from heroes import mirror
    body += [slv, mirror(slv), bandana]
    body.append(team_band(F, team, 1.3))

    h = anime_head('head_base', F, skin, jaw=1.02, chin=0.98, nose=0.75)
    hc = P(0x4fa860)
    hairs = hair(F, hc, zoro_hair())
    # 左耳的三個金耳環
    for i in range(3):
        e = kit.quad_sphere('ear', 1.0, cuts=3)
        kit.deform(e, lambda p, i=i: F.c + V((F.hr * 0.86, -F.hr * (0.2 + i * 0.1), -F.hr * 0.05)) + p * F.hr * 0.045)
        hairs.append(kit.tag(e, gold, mat=2, grp=G_FREE, ol=0.4))
    heads = {'base': [h, hair_cap('cap', F, hc, hairline=0.5, temple=0.05, scale=1.08, nape=-0.55, thick=0.1)] + hairs}
    blade, sheath = katana(P, sw_grip, sw_guard, sw_sheath, length=1.0)
    # 腰間三把刀鞘並排
    sh3 = []
    for k, col in enumerate((sw_sheath, P(0x8a2a30), P(0x2a2a40))):
        b2, s2 = katana(P, sw_grip, sw_guard, col, length=1.0, name='k%d' % k)
        for o in b2 + s2:
            kit.transform(o, Matrix.Translation(V((k * 0.03 - 0.03, 0, k * 0.035))) @ Matrix.Rotation((k - 1) * 0.08, 4, 'X'))
        sh3 += b2[:2] + s2
        for o in b2[2:]:
            import bpy
            bpy.data.objects.remove(o, do_unlink=True)
    return finish(F, P, body, proxy, heads, extras={'sword': blade, 'sheath': sh3})


def zoro_hair():
    # 短刺的綠髮：很多撮小而尖的短髮，只比髮帽高一點
    out = []
    for k in range(14):
        a = k / 14 * 2 * math.pi
        for lv, (y, r, h) in enumerate(((0.92, 0.38, 0.16), (0.6, 0.78, 0.1))):
            if lv == 1 and math.sin(a) > 0.55:
                continue
            x, z = math.cos(a) * r, math.sin(a) * r
            out.append(((x, y, z), (x * 1.2, y + h, z * 1.2 + 0.05), 0.26, 0.1, (0, 0.02, 0)))
    out.append(((0.0, 1.0, 0.1), (0.04, 1.14, 0.26), 0.28, 0.1, (0, 0.02, 0)))
    return out


# ================================================================ 香吉士
def build_sanji(R):
    F = Fig(R)
    P = kit.Palette()
    skin = P(0xf5d3b4)
    suit, suitD = P(0x1c1e26), P(0x101116)
    shirt = P(0x5a84d8)
    tie = P(0x14151a)
    team = P(-1)
    body, proxy = [], []

    sh = kit.loft('shirt', torso_rows(F, e=0.004, u0=0.0, pec=0.07), n=18, cap0=None, cap1=None)
    sh = kit.subsurf(sh, 2)
    kit.tag(sh, shirt, grp=G_TORSO)
    body.append(sh)
    proxy.append(sh)
    tie_s = path_loft('tie', [V((0, F.y(0.95), F.cz * 0.78 + 0.012)), V((0, F.y(0.7), F.cz * 1.06 + 0.012)), V((0, F.y(0.42), F.cz * 1.02 + 0.014))], [0.016, 0.024, 0.03], n=6, flat=0.25)
    body.append(kit.tag(kit.subsurf(tie_s, 1), tie, grp=G_TORSO, ol=0.5))
    rows = [(-0.12, ('w', 1.32), 0.98, 0.0), (0.02, ('w', 1.2), 0.9, 0.0)] + [r for r in TORSO_ROWS if r[0] > 0.1]
    jk = open_jacket(F, suit, rows, e=0.02, gap0=0.28, gap1=0.62, pec=0.06)
    body.append(jk)
    body.append(neck(F, skin, r=0.052))
    proxy.append(body[-1])
    sl = long_sleeve(F, suit, k=1.0)
    arm = arm_skin(F, skin, muscle=0.7)
    kit.paint_field(arm, lambda co: arm_s(F, co) - (F.up + F.lo - 0.06), suit, 0)
    hand = fist(F, skin, scale=1.0)
    body.append(pelvis(F, suit, e=0.012))
    proxy.append(body[-1])
    leg = straight_leg(F, suit, k=1.0, flare=1.05)
    bt = boot(F, suitD, F.tl + F.sl - 0.1, 0.06, pal_sole=suitD, toe=0.95, toe_len=0.02)
    pair_add(body, proxy, [sl, arm, hand, leg] + bt, proxy_set=[arm, hand, leg] + bt)
    body.append(team_band(F, team, 1.2))

    h = anime_head('head_base', F, skin, jaw=0.98, chin=0.96, nose=0.75)
    hc = P(0xf2d46a)
    hairs = hair(F, hc, sanji_hair())
    # 叼著的菸
    cig = path_loft('cig', [F.c + V((-F.hr * 0.18, -F.hr * 0.62, F.hr * 0.86)), F.c + V((-F.hr * 0.42, -F.hr * 0.66, F.hr * 1.08))], [F.hr * 0.035, F.hr * 0.035], n=6)
    hairs.append(kit.tag(cig, P(0xf4f2ee), grp=G_FREE, ol=0.4))
    tip = kit.quad_sphere('tip', 1.0, cuts=2)
    kit.deform(tip, lambda p: F.c + V((-F.hr * 0.43, -F.hr * 0.665, F.hr * 1.09)) + p * F.hr * 0.04)
    hairs.append(kit.tag(tip, P(0xff7a3a), mat=3, grp=G_FREE, ol=0.0))
    heads = {'base': [h, hair_cap('cap', F, hc, hairline=0.5, temple=0.0, scale=1.07, nape=-0.65, side_cut=False)] + hairs}
    return finish(F, P, body, proxy, heads)


def sanji_hair():
    # 金髮側分：一大片瀏海斜蓋住角色左眼（＋X），右側短髮貼著臉，後腦收短
    return [
        ((0.1, 0.96, 0.55), (0.46, -0.42, 1.1), 0.5, 0.1, (0.2, 0.3, 0.32)),
        ((0.36, 0.9, 0.5), (0.74, -0.38, 0.98), 0.42, 0.1, (0.25, 0.25, 0.28)),
        ((0.62, 0.72, 0.15), (0.92, -0.4, 0.38), 0.3, 0.1, (0.3, 0.2, 0.05)),
        ((-0.16, 0.95, 0.45), (-0.42, 0.6, 0.92), 0.24, 0.08, (-0.12, 0.18, 0.15)),
        ((-0.42, 0.86, 0.32), (-0.78, 0.2, 0.62), 0.24, 0.08, (-0.25, 0.18, 0.1)),
        ((-0.66, 0.66, 0.0), (-0.92, -0.05, 0.12), 0.26, 0.09, (-0.25, 0.15, 0.0)),
        ((-0.5, 0.75, -0.42), (-0.82, -0.25, -0.6), 0.3, 0.1, (-0.3, 0.15, -0.05)),
        ((0.5, 0.75, -0.42), (0.82, -0.25, -0.6), 0.3, 0.1, (0.3, 0.15, -0.05)),
        ((0.0, 0.78, -0.72), (0.04, -0.35, -1.0), 0.36, 0.11, (0, 0.18, -0.2)),
        ((0.0, 0.98, 0.0), (0.06, 1.05, 0.32), 0.38, 0.12, (0, 0.08, 0.12)),
    ]


# ================================================================ 娜美
def build_nami(R):
    F = Fig(R)
    P = kit.Palette()
    skin = P(0xf3c8a4)
    top_c, top_l = P(0x2c7ad8), P(0xf2f0ea)
    denim, denimD = P(0x3a5ea8), P(0x284682)
    sole = P(0x8a5a32)
    belt_c = P(0x7a4a28)
    staff_c, staff_l = P(0x2a6ad0), P(0xd8e4f2)
    team = P(-1)
    body, proxy = [], []

    tor = kit.loft('skinTop', torso_rows(F, e=0.0, u0=0.0, pec=0, lat=0, bust=0.38, rows=FEMALE_ROWS), n=18, cap0=None, cap1=None)
    tor = kit.subsurf(tor, 2)
    kit.tag(tor, skin, mat=4, grp=G_TORSO)
    body.append(tor)
    proxy.append(tor)
    # 比基尼上衣（只包胸口一圈）＋藍白相間
    # 平口抹胸：一圈貼著胸型的布（bust 和皮膚層一致，所以不會浮起來）
    bk = kit.loft('bandeau', torso_rows(F, e=0.007, u0=0.5, u1=0.8, pec=0, lat=0, bust=0.38, rows=FEMALE_ROWS), n=22, cap0=None, cap1=None)
    bk = kit.subsurf(bk, 2, solidify=0.006)
    kit.tag(bk, top_c, grp=G_TORSO, ol=0.7)
    body.append(bk)
    body.append(neck(F, skin, r=0.045))
    proxy.append(body[-1])
    arm = arm_skin(F, skin, muscle=0.25, k=1.0)
    bracelet = band('logL', F.sh, F.da, F.up + F.lo - 0.07, F.up + F.lo - 0.03, 0.05 * F.k_fore, 0.048 * F.k_fore, belt_c, G_FORE_L, thick=0.008, ol=0.5)
    hand = fist(F, skin, scale=0.98)
    # 低腰牛仔褲＋高跟涼鞋
    body.append(pelvis(F, denim, e=0.006))
    proxy.append(body[-1])
    body.append(belt_ring(F, F.L + 0.05, 0.03, belt_c, e=0.014, thick=0.008))
    kl = F.k_leg
    leg = leg_tube(F, denim, [(-0.07, 0.114 * kl, 0.114 * kl), (0.05, 0.112 * kl, 0.116 * kl), (0.22, 0.096 * kl, 0.1 * kl), (F.tl - 0.03, 0.074 * kl, 0.078 * kl),
                              (F.tl + 0.1, 0.072 * kl, 0.076 * kl), (F.tl + F.sl - 0.1, 0.066 * kl, 0.068 * kl), (F.tl + F.sl - 0.06, 0.06 * kl, 0.062 * kl)])
    ft = sandal(F, skin, sole)
    pair_add(body, proxy, [arm, bracelet, hand, leg] + ft, proxy_set=[arm, hand, leg] + ft)
    body.append(team_band(F, team, 1.0))

    h = anime_head('head_base', F, skin, jaw=0.88, chin=0.84, cheek=0.96, nose=0.65)
    hc = P(0xf28a3a)
    heads = {'base': [h, hair_cap('cap', F, hc, hairline=0.6, temple=0.0, scale=1.08, nape=-0.9, side_cut=False)] + hair(F, hc, nami_hair())}
    # 天候棒：三節藍色棍子（握在手上；平常斜背在背後）
    segs = []
    for k in range(3):
        sg = limb('st%d' % k, V((0, -0.2 + k * 0.33, 0)), V((0, 1, 0)), [(0, 0.016, 0.016), (0.3, 0.016, 0.016)], n=8, cap0='pole', cap1='pole')
        segs.append(kit.tag(kit.subsurf(sg, 1), staff_c, mat=2, ol=0.6))
        jt = kit.quad_sphere('jt', 1.0, cuts=2)
        kit.deform(jt, lambda p, k=k: V((0, -0.2 + k * 0.33 + 0.3, 0)) + p * 0.024)
        segs.append(kit.tag(jt, staff_l, mat=2, ol=0.5))
    return finish(F, P, body, proxy, heads, extras={'sword': segs})


def nami_hair():
    # 中分長波浪：兩撮細瀏海框住臉、鬢髮垂到胸前、背後幾片寬而扁的長髮
    cl = sym([
        ((0.12, 0.94, 0.45), (0.42, 0.25, 0.95), 0.18, 0.07, (0.15, 0.15, 0.15)),
        ((0.6, 0.72, 0.28), (0.82, -0.9, 0.42), 0.2, 0.08, (0.2, 0.1, 0.12)),
        ((0.72, 0.5, -0.05), (0.9, -1.7, 0.1), 0.26, 0.09, (0.25, -0.1, 0.1)),
        ((0.5, 0.7, -0.5), (0.72, -2.2, -0.75), 0.34, 0.1, (0.3, 0.0, -0.15)),
        ((0.15, 0.72, -0.7), (0.24, -2.45, -0.95), 0.36, 0.1, (0.12, 0.0, -0.22)),
    ])
    return cl


BUILDERS = {
    'naruto': build_naruto, 'sasuke': build_sasuke, 'kakashi': build_kakashi, 'sakura': build_sakura,
    'luffy': build_luffy, 'zoro': build_zoro, 'sanji': build_sanji, 'nami': build_nami,
}
