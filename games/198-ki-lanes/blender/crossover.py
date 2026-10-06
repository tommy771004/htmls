# 火影忍者、海賊王的客串角色（同人致敬，全部以程式建模，不使用原作素材）。
# 介面與 heroes.build_goku 相同：build_xxx(R) 回傳 finish(...) 的 dict。座標＝three.js 空間（+Y 上、面向 +Z、角色左手在 +X）。
import math

from mathutils import Matrix

import heroes as _H
import kit
from kit import S, V, ang_bump, bump, lerp, smooth
from heroes import (
    BACK, FRONT, G_ARM_L, G_ARM_R, G_BELT, G_CHEST, G_FOOT_L, G_FORE_L, G_FREE, G_LEG_L, G_NECK, G_PELVIS, G_TORSO, G_UPPER_L, PI, TORSO_ROWS,
    Fig, anime_head, arm_skin, band, boot, finish, fist, hair, hair_cap, leg_tube, limb, neck, pair_add, path_loft, pelvis, sleeve, sym,
    torso_rows, baggy_leg, bob_cap,
)
from heroes import G_CHAIN, G_SKIRT, sash_chain_weights, skirt_chain_weights
from cast import FEMALE_ROWS, arm_s, belt_ring, strap_around, team_band


# ================================================================ 共用配件
def head_band(F, cloth, metal, y=0.3, h=0.36, tilt=0.0, tails=True, plate=True, name='hb', scale=1.0):
    """忍者護額：繞頭一圈的布帶＋額前金屬板（單位 hr）。tilt＞0 往角色左側斜（卡卡西遮左眼）。"""
    c, hr0 = F.c, F.hr
    y0 = c.y + hr0 * y
    hr = hr0 * scale  # scale＞1：護額撐大一圈，壓在瀏海外面
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


def long_skirt(F, pal, y0, y1, rx0, rz0, rx1, rz1, gap=0.0, name='skirt', thick=0.009, n=24):
    """從腰往下的長下襬（大衣、圍裙）：斷面由 (rx0,rz0) 漸寬到 (rx1,rz1)，前方開衩 gap（弧度比例），綁在骨盆群組讓雙腿帶動。"""
    m = 5
    sts = [S(V((0, lerp(y0, y1, i / (m - 1)), 0.004 * i)), lerp(rx0, rx1, smooth(i / (m - 1))), lerp(rz0, rz1, smooth(i / (m - 1))), p=2.1) for i in range(m)]
    o = kit.loft(name, sts, n=n, cap0=None, cap1=None, gap=(lambda i: gap) if gap else None)
    o = kit.subsurf(o, 2, solidify=thick)
    return kit.tag(o, pal, grp=G_SKIRT)


def hang_tail(pal, pts, w0, w1, name='tail', grp=G_PELVIS, side=V((1, 0, 0)), flat=0.18):
    """垂下的布條（腰帶尾端）：沿點列放樣的扁帶；side 是布面寬度方向（掛在腰側時要順著腰的切線，側看才不會只剩一條線）。"""
    k = len(pts)
    side = side.normalized()
    o = path_loft(name, pts, [lerp(w0, w1, i / (k - 1)) for i in range(k)], n=8, flat=flat, side=side, front=V((side.z, 0, -side.x)))
    return kit.tag(kit.subsurf(o, 1), pal, grp=grp, ol=0.7)


def on_surface(target, x, y, z0=1.0):
    """從前方往後打射線，取 target 表面上 (x, y) 處的點與法線。"""
    from heroes import tree_of
    hit = tree_of(target).ray_cast(V((x, y, z0)), V((0, 0, -1)), 2)
    return (hit[0], hit[1]) if hit[0] is not None else (V((x, y, 0.1)), V((0, 0, 1)))


def stud(name, p, n, r, pal, grp=G_TORSO, flat=0.45):
    """貼在表面的小圓扣。"""
    o = kit.quad_sphere(name, 1.0, cuts=2)
    rot = V((0, 0, 1)).rotation_difference(n).to_matrix().to_4x4()
    kit.transform(o, Matrix.Translation(p + n * r * 0.3) @ rot @ Matrix.Diagonal((r, r, r * flat, 1)))
    return kit.tag(o, pal, mat=2, grp=grp, ol=0.3)


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
    # 拉鍊貼著外套表面走（從前方打射線取表面）：原本三點直線大半埋在胸口與下襬裡，只露出下端一截，彎腰踢腿時像穿出褲子的白條
    zpts = [on_surface(jk, 0, F.y(0.04 + 0.91 * i / 11))[0] + V((0, 0, 0.004)) for i in range(12)]
    zp = path_loft('zip', zpts, [0.008] * len(zpts), n=6, flat=0.5)
    body.append(kit.tag(kit.subsurf(zp, 1), zip_c, mat=2, grp=G_TORSO, ol=0.3))
    col = kit.loft('collar', [S(V((0, F.y(0.93), -0.01)), F.cx * 0.6, F.cz * 0.74), S(V((0, F.y(1.05), -0.015)), F.cx * 0.52, F.cz * 0.66), S(V((0, F.y(1.12), -0.02)), F.cx * 0.5, F.cz * 0.64)],
                   n=16, cap0=None, cap1=None)
    col = kit.subsurf(col, 2, solidify=0.008)
    body.append(kit.tag(col, black, grp=G_NECK, ol=0.8))
    body.append(neck(F, skin, r=0.054))
    proxy.append(body[-1])
    sl = long_sleeve(F, orange, k=1.05)
    kit.paint_field(sl, lambda co: arm_s(F, co) - (F.up + F.lo), black, 0)  # 參考圖：袖子整條黑色
    cuff = band('cuffL', F.sh, F.da, F.up + F.lo - 0.075, F.up + F.lo - 0.04, 0.056 * F.k_fore + 0.016, 0.054 * F.k_fore + 0.016, black, G_FORE_L, thick=0.008)
    arm = arm_skin(F, skin, muscle=0.8)
    kit.paint_field(arm, lambda co: arm_s(F, co) - (F.up + F.lo - 0.06), orange, 0)
    hand = fist(F, skin, scale=1.0)
    body.append(pelvis(F, orange, e=0.012))
    proxy.append(body[-1])
    # 褲子到小腿中段，下面是深色綁腿與露腳趾的忍者涼鞋；右大腿綁白色繃帶
    leg = baggy_leg(F, orange, bag=1.0, blouse=1.0, s_end=F.tl + 0.12)
    kl = F.k_leg
    # 小腿皮膚整段藏在綁腿裡：做細一點，綁腿再撐大一圈，膝蓋彎曲時皮膚不會從綁腿後面穿出來
    shin = leg_tube(F, skin, [(F.tl + 0.06, 0.064 * kl, 0.066 * kl), (F.tl + 0.2, 0.054 * kl, 0.056 * kl), (F.tl + F.sl - 0.06, 0.046 * kl, 0.048 * kl)], name='shinL', mat=4)
    wr = band('wrapL', F.th, F.dl, F.tl + 0.1, F.tl + F.sl - 0.1, 0.068 * kl + 0.012, 0.052 * kl + 0.01, sandal_c, G_LEG_L, thick=0.006)
    ft = sandal(F, skin, sandal_c)
    thw = band('thighWrap', F.th, F.dl, 0.16, 0.24, 0.112 * kl + 0.02, 0.106 * kl + 0.02, wrap, G_LEG_L, thick=0.008)
    pair_add(body, proxy, [sl, cuff, arm, hand, leg, shin, wr] + ft, proxy_set=[arm, hand, leg] + ft)
    from heroes import mirror
    body.append(mirror(thw))  # 只有右腿
    body.append(team_band(F, team, 1.25))
    # 腿上的忍具包（右大腿）
    pouch = kit.box_cage('pouch', 0.07, 0.09, 0.05, cuts=(1, 1, 1))
    kit.transform(pouch, Matrix.Translation(F.leg_pt(0.2) * V((-1, 1, 1)) + V((-0.12 * F.k_leg - 0.03, 0, 0.02))))
    body.append(kit.tag(kit.subsurf(pouch, 2), sandal_c, grp=G_N_POUCH, ol=0.6))  # 在右腿：整塊剛性跟著右大腿

    h = anime_head('head_base', F, skin, jaw=1.02, chin=0.95, cheek=1.07, nose=0.75, face_len=0.94, cranium=(0.83, 0.9, 0.9))
    hc = P(0xf6c93a)
    heads = {'base': [h, hair_cap('cap', F, hc, hairline=0.6, temple=0.1, scale=1.06, nape=-0.55)] + hair(F, hc, naruto_hair()) + head_band(F, cloth, metal, y=0.4, h=0.32, scale=1.13)}
    return finish(F, P, body, proxy, heads, custom={G_N_POUCH: lambda co: [('thR', 1.0)]})


G_N_POUCH = 68   # 鳴人專用群組（不在 ALLOW 裡：權重由自訂函式決定）


def naruto_hair():
    # 鳴人的亂翹短髮：很多撮中短的髮束往外、往後翹，頭頂不往上衝；前面三撮瀏海垂到護額下
    return sym([
        ((0.0, 0.98, 0.25), (0.05, 1.45, 0.62), 0.36, 0.15, (0, 0.12, 0.12), 0.45),
        ((0.3, 0.95, 0.15), (0.75, 1.42, 0.38), 0.34, 0.15, (0.05, 0.12, 0.05), 0.45),
        ((0.58, 0.8, 0.05), (1.22, 1.18, 0.2), 0.32, 0.14, (0.08, 0.12, 0.02), 0.45),
        ((0.78, 0.5, -0.05), (1.45, 0.6, 0.0), 0.3, 0.14, (0.1, 0.1, 0), 0.45),
        ((0.82, 0.18, -0.25), (1.38, -0.05, -0.35), 0.28, 0.13, (0.08, 0.05, 0), 0.45),
        ((0.25, 0.92, -0.25), (0.62, 1.48, -0.6), 0.36, 0.15, (0.04, 0.12, -0.05), 0.45),
        ((0.55, 0.7, -0.45), (1.05, 1.0, -1.0), 0.34, 0.15, (0.06, 0.1, -0.05), 0.45),
        ((0.0, 0.75, -0.62), (0.05, 1.25, -1.22), 0.36, 0.15, (0, 0.12, -0.08), 0.45),
        ((0.35, 0.35, -0.82), (0.72, 0.25, -1.42), 0.32, 0.14, (0.04, 0.05, -0.05), 0.45),
        ((0.0, 0.0, -0.92), (0.06, -0.3, -1.4), 0.3, 0.13, (0, 0, 0), 0.45),
        ((0.62, 0.0, -0.65), (1.08, -0.3, -1.08), 0.28, 0.13, (0.04, 0, 0), 0.45),
        ((0.1, 0.88, 0.5), (0.06, 0.42, 1.08), 0.26, 0.1, (0, 0.06, 0.1), 0.45),
        ((0.4, 0.8, 0.46), (0.52, 0.38, 1.0), 0.24, 0.1, (0.02, 0.06, 0.08), 0.45),
        ((0.68, 0.6, 0.34), (0.9, 0.1, 0.72), 0.22, 0.09, (0.03, 0.03, 0.05), 0.45),
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
    # 淡紫上衣：胸前 V 開口、高立領、袖子到手肘上方
    lav = P(0xb4b0d6)
    rows = [(0.02, ('w', 1.2), 0.9, 0.0)] + [r for r in TORSO_ROWS if r[0] > 0.1]
    us = [r[0] for r in rows]
    top = kit.loft('gi_top', torso_rows(F, e=0.016, rows=rows, pec=0.1, lat=0.06), n=20, cap0=None, cap1=None, gap=lambda i: 0.0 if us[i] <= 0.45 else min(0.9, 0.08 + (us[i] - 0.45) * 1.5))
    top = kit.subsurf(top, 2, solidify=0.01)
    kit.tag(top, lav, grp=G_TORSO)
    body.append(top)
    col = kit.loft('collar', [S(V((0, F.y(0.95), -0.012)), F.cx * 0.62, F.cz * 0.78), S(V((0, F.y(1.12), -0.02)), F.cx * 0.58, F.cz * 0.74), S(V((0, F.y(1.26), -0.03)), F.cx * 0.66, F.cz * 0.8)],
                   n=18, cap0=None, cap1=None, gap=lambda i: 0.35)
    body.append(kit.tag(kit.subsurf(col, 2, solidify=0.008), lav, grp=G_NECK, ol=0.8))
    body.append(neck(F, skin, r=0.054))
    proxy.append(body[-1])
    arm = arm_skin(F, skin, muscle=0.9)
    kit.paint_field(arm, lambda co: arm_s(F, co) - (F.up - 0.06), lav, 0)
    slv = long_sleeve(F, lav, s_end=F.up - 0.03, k=1.0, e=0.016, cuff=1.2)
    ag = band('guardL', F.sh, F.da, F.up + 0.02, F.up + F.lo - 0.02, 0.066 * F.k_fore + 0.01, 0.054 * F.k_fore + 0.008, navyD, G_FORE_L, thick=0.008)
    hand = fist(F, skin, scale=1.0)
    # 紫色粗繩（前方打結垂下）＋深藍長腰布到膝下、前開
    body.append(pelvis(F, navy, e=0.012))
    proxy.append(body[-1])
    yb = F.L + 0.09
    body.append(belt_ring(F, yb, 0.06, rope, e=0.035, thick=0.022))
    body.append(hang_tail(rope, [V((F.w * 0.7, yb - 0.02, F.cz * 1.05)), V((F.w * 0.85, yb - 0.2, F.cz * 1.2)), V((F.w * 0.75, yb - 0.36, F.cz * 1.15))], 0.035, 0.028, name='ropeTail'))
    hw = F.R['hip']
    body.append(long_skirt(F, navyD, yb - 0.02, F.L - 0.48, F.w * 1.32 + 0.035, F.cz * 1.0 + 0.035, hw * 2.2, F.cz * 1.45, gap=0.22, name='apron'))
    kl = F.k_leg
    leg = straight_leg(F, navy, k=1.05, s_end=F.tl + 0.2, flare=1.1)
    wrap = band('wrapL', F.th, F.dl, F.tl + 0.17, F.tl + F.sl - 0.07, 0.062 * F.k_shin + 0.008, 0.05 * F.k_shin + 0.008, P(0x8a8c96), G_LEG_L, thick=0.006)
    ft = sandal(F, skin, P(0x24262e))
    pair_add(body, proxy, [slv, arm, ag, hand, leg, wrap] + ft, proxy_set=[arm, hand, leg] + ft)
    body.append(team_band(F, team, 1.2))

    h = anime_head('head_base', F, skin, jaw=0.88, chin=0.78, cheek=0.93, nose=0.8, face_len=1.07)
    hc = P(0x1a1c2e)
    heads = {'base': [h, hair_cap('cap', F, hc, hairline=0.42, temple=0.05, scale=1.07, nape=-0.65)] + hair(F, hc, sasuke_hair())}
    blade, sheath = katana(P, sw_grip, sw_guard, sw_sheath, length=1.0)
    return finish(F, P, body, proxy, heads, extras={'sword': blade, 'sheath': sheath}, custom={G_SKIRT: skirt_chain_weights(F, 'skirt')})


def sasuke_hair():
    # 後腦的刺髮往後方翹（正面只露出一點刺），兩側長瀏海垂到下巴、中間幾撮瀏海蓋到眼睛上方
    return sym([
        ((0.0, 0.62, -0.62), (0.05, 1.05, -1.85), 0.5, 0.2, (0, 0.25, 0)),
        ((0.4, 0.55, -0.6), (0.85, 0.95, -1.7), 0.46, 0.2, (0, 0.2, 0)),
        ((0.68, 0.3, -0.55), (1.2, 0.45, -1.4), 0.42, 0.19, (0, 0.12, 0)),
        ((0.25, 0.15, -0.88), (0.6, 0.2, -1.8), 0.42, 0.19, (0, 0.08, 0)),
        ((0.0, 0.92, -0.2), (0.05, 1.2, -1.2), 0.48, 0.2, (0, 0.15, 0)),
        ((0.5, 0.82, 0.38), (0.9, -0.62, 0.62), 0.28, 0.1, (0.2, 0.25, 0.12)),
        ((0.22, 0.9, 0.48), (0.3, 0.08, 1.0), 0.24, 0.09, (0.05, 0.12, 0.12)),
    ]) + [((0.0, 0.92, 0.5), (-0.06, 0.2, 1.02), 0.24, 0.09, (0, 0.12, 0.12))]


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
    # 褲子到小腿上段，白色綁腿，深藍忍者涼鞋
    leg = straight_leg(F, navy, s_end=F.tl + 0.1, flare=1.1)
    wr = band('wrapL', F.th, F.dl, F.tl + 0.06, F.tl + F.sl - 0.1, 0.07 * F.k_shin + 0.01, 0.056 * F.k_shin + 0.008, wrap, G_LEG_L, thick=0.008)
    bt = boot(F, navyD, F.tl + F.sl - 0.11, 0.054, pal_sole=navyD)
    pair_add(body, proxy, [sl, arm, glove, hand, leg, wr] + bt, proxy_set=[arm, hand, leg] + bt)
    body.append(team_band(F, team, 1.2))
    # 左臂的紅色漩渦臂章（簡化成紅色細環）
    body.append(band('mark', F.sh, F.da, 0.06, 0.09, 0.102 * F.k_arm, 0.1 * F.k_arm, red, G_UPPER_L, thick=0.004, ol=0.4))

    h = anime_head('head_base', F, skin, jaw=0.96, chin=0.95, cheek=0.95, nose=0.6, face_len=1.12, cranium=(0.8, 0.92, 0.9))
    hc = P(0xd8dbe6)
    heads = {'base': [h, hair_cap('cap', F, hc, hairline=0.55, temple=0.0, scale=1.07, nape=-0.6)] + hair(F, hc, kakashi_hair()[0::2]) + hair(F, P(0xb4b8c6), kakashi_hair()[1::2])  # 兩種銀灰交錯，髮束分得出前後
             + head_band(F, cloth, metal, y=0.3, h=0.38, tilt=0.42, tails=True)}
    return finish(F, P, body, proxy, heads)


def kakashi_hair():
    # 銀髮整團往角色左上方（＋X，畫面右上）斜沖：幾撮寬而重疊的大髮束，不是一根根細刺
    return [
        ((0.0, 0.95, 0.3), (1.2, 2.0, 0.1), 0.72, 0.26, (0.2, 0.3, 0.05)),
        ((-0.4, 0.88, 0.15), (0.75, 2.2, -0.2), 0.72, 0.26, (0.1, 0.35, 0)),
        ((0.45, 0.8, 0.05), (1.75, 1.55, -0.15), 0.66, 0.24, (0.2, 0.2, 0)),
        ((-0.7, 0.6, -0.15), (0.2, 2.0, -0.6), 0.66, 0.24, (0, 0.3, 0)),
        ((0.7, 0.5, -0.25), (1.85, 0.95, -0.55), 0.6, 0.22, (0.15, 0.1, 0)),
        ((0.0, 0.62, -0.72), (0.9, 1.7, -1.3), 0.7, 0.26, (0.1, 0.25, 0)),
        ((-0.55, 0.3, -0.7), (-0.4, 1.1, -1.5), 0.6, 0.22, (0, 0.15, 0)),
        ((0.55, 0.25, -0.75), (1.4, 0.55, -1.35), 0.56, 0.22, (0.1, 0.05, 0)),
        ((0.0, -0.05, -0.92), (0.2, -0.3, -1.45), 0.5, 0.2, (0, 0, 0)),
        ((-0.62, 0.55, 0.38), (-0.9, -0.1, 0.62), 0.22, 0.09, (-0.05, 0.05, 0.05)),
    ]


# ================================================================ 小櫻
# 小櫻專屬綁骨群組：短裙、腰部（上衣與短褲頭；短褲頭在腰線以下和裙子同權重，上衣下襬只跟骨盆）
from heroes import ALLOW  # noqa: E402
G_SAK_SKIRT, G_SAK_WAIST = 72, 73
ALLOW[G_SAK_SKIRT] = ALLOW[G_PELVIS]
ALLOW[G_SAK_WAIST] = ALLOW[G_PELVIS] | ALLOW[G_TORSO]


def sakura_weights(F):
    """回傳 custom：短裙與腰部的權重。骨熱讓裙腰、上衣下襬、短褲頭各自分到不同比例的大腿，抬腿時互相穿出；
    這裡改成同一套依高度的漸變：腰線以上只跟骨盆，往裙襬漸漸交給同側大腿，裙子和底下的短褲頭一起變形。"""
    def skirt(co):
        # 骨熱在裙腰就給了大腿五～七成、髖關節以下馬上變成九成：腰頭被大腿拉出去、髖部一折就起皺。
        # 改成腰頭只跟骨盆、往裙襬漸漸交給同側大腿（後中線左右漸變；前方有開衩，兩片各跟各的腿）
        t = max(0.0, min(1.0, (F.L + 0.035 - co.y) / 0.175))
        k = smooth(t) ** 0.6
        sl = smooth(0.5 + co.x / 0.08)
        return [('hips', 1 - k), ('thL', k * sl), ('thR', k * (1 - sl))]

    def waist(co, old):
        # 短褲頭（骨盆）用和裙子完全相同的權重：在裙子裡面一起變形，抬腿時不會從側面頂穿；上衣下襬（腰線以上）只跟骨盆
        k = smooth((F.y(0.24) - co.y) / 0.04)
        return [(b, w * (1 - k)) for b, w in old] + [(b, w * k) for b, w in skirt(co)]
    waist.blend = True
    return {G_SAK_SKIRT: skirt, G_SAK_WAIST: waist}


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
    # 上衣跟著女性軀幹的曲線：胸部隆起、腰收細、下襬微微外擴；斷面較圓（p 小）不會像箱子
    top_rows = [(0.04, ('w', 1.16), 0.86, 0.0), (0.2, ('w', 0.9), 0.74, 0.0)] + [r for r in FEMALE_ROWS if r[0] > 0.3]
    top = kit.loft('top', torso_rows(F, e=0.006, rows=top_rows, pec=0, lat=0, bust=0.3, p=2.0), n=20, cap0=None, cap1=None)
    top = kit.subsurf(top, 2)
    kit.tag(top, red, grp=G_SAK_WAIST)
    body.append(top)
    proxy.append(top)
    zp = path_loft('zip', [V((0, F.y(0.3), F.cz * 0.9 + 0.012)), V((0, F.y(0.65), F.cz * 1.04 + 0.012)), V((0, F.y(0.97), F.cz * 0.7 + 0.012))], [0.006] * 3, n=6, flat=0.5)
    body.append(kit.tag(kit.subsurf(zp, 1), white, grp=G_TORSO, ol=0.3))
    col = kit.loft('collar', [S(V((0, F.y(0.94), -0.01)), F.cx * 0.6, F.cz * 0.76), S(V((0, F.y(1.06), -0.015)), F.cx * 0.52, F.cz * 0.66)], n=16, cap0=None, cap1=None)
    body.append(kit.tag(kit.subsurf(col, 2, solidify=0.008), red, grp=G_NECK, ol=0.8))
    body.append(neck(F, skin, r=0.046))
    proxy.append(body[-1])
    arm = arm_skin(F, skin, muscle=0.35, k=1.02)
    pad = band('padL', F.sh, F.da, F.up - 0.07, F.up + 0.08, 0.056 * F.k_arm + 0.014, 0.054 * F.k_fore + 0.014, pink, G_ARM_L, thick=0.01, ol=0.6)  # 粉色護肘
    # 手套口要比前臂（前臂肌群隆起處約 0.064kf、扁橢圓）大一圈，厚度往內長，否則皮膚從袖口鋸齒狀穿出
    glove = band('gloveL', F.sh, F.da, F.up + F.lo - 0.09, F.up + F.lo + 0.005, 0.064 * F.k_fore + 0.0045, 0.044 * F.k_fore + 0.0045, black, G_FORE_L, thick=0.004, rb=0.92)
    hand = fist(F, black, mat=0, scale=1.0, glove=True)
    # 粉色開衩短裙＋黑色短褲＋長靴
    pel = pelvis(F, black, e=0.004, grp=G_SAK_WAIST)
    # 褲頭往內收：上緣藏進上衣、臀部最寬處留在裙子裡面（原本褲頭比上衣下段與裙腰都寬，從腰線露出黑邊）
    kit.deform(pel, lambda p: (lambda f: V((p.x * f, p.y, p.z * f)))(1 - 0.07 * smooth((p.y - F.L + 0.02) / 0.04) - 0.14 * smooth((p.y - F.L - 0.04) / 0.04)))
    body.append(pel)
    proxy.append(pel)
    yb = F.y(0.12)
    hw = F.R['hip']
    # 裙腰貼著上衣下段（上衣在 u=0.12 約 1.03w × 0.8cz），不留一圈看得到裡面短褲的縫
    sk = kit.loft('skirt', [S(V((0, yb, 0)), F.w * 1.03 + 0.017, F.cz * 0.8 + 0.017, p=2.1), S(V((0, F.L + 0.05, 0)), hw * 1.55, F.cz * 1.0, p=2.2),
                            S(V((0, F.L + 0.02, 0)), hw * 1.64, F.cz * 1.04, p=2.2),
                            S(V((0, F.L - 0.14, 0.005)), hw * 1.86, F.cz * 1.15, p=2.1)], n=22, cap0=None, cap1=None, gap=lambda i: 0.18)
    sk = kit.subsurf(sk, 2, solidify=0.008)
    body.append(kit.tag(sk, skirt_c, grp=G_SAK_SKIRT))
    kl = F.k_leg
    calf = lambda th: 1 + 0.09 * ang_bump(th, BACK, 1.0)
    leg = leg_tube(F, skin, [(-0.07, 0.112 * kl, 0.112 * kl), (0.05, 0.11 * kl, 0.114 * kl), (0.22, 0.094 * kl, 0.098 * kl), (F.tl - 0.03, 0.068 * kl, 0.074 * kl),
                             (F.tl + 0.07, 0.064 * kl, 0.07 * kl, calf), (F.tl + 0.14, 0.05 * kl, 0.054 * kl)], mat=4)
    kit.paint_field(leg, lambda co: (co - F.th).dot(F.dl) - 0.14, black, 0)  # 黑色短褲
    bt = boot(F, P(0x4a4256), F.tl + 0.02, 0.066, pal_sole=black, toe=0.9)
    kp = band('kneeL', F.th, F.dl, F.tl - 0.045, F.tl + 0.045, 0.08 * kl, 0.082 * kl, pink, G_LEG_L, thick=0.016, ol=0.7, bulge=1.08)
    pair_add(body, proxy, [arm, pad, glove, hand, leg] + bt, proxy_set=[arm, hand, leg] + bt)
    body.append(team_band(F, team, 1.0))

    h = anime_head('head_base', F, skin, jaw=0.86, chin=0.78, cheek=0.98, nose=0.6, face_len=0.92, cranium=(0.85, 0.98, 0.93))
    hc = P(0xf4a6c4)
    heads = {'base': [h, bob_cap('bob', F, hc, hairline=0.72, length=0.8, flare=0.24, scale=1.12)] + hair(F, hc, sakura_hair()[:2])
             + head_band(F, cloth, metal, y=0.56, h=0.3, tails=False)}
    return finish(F, P, body, proxy, heads, custom=sakura_weights(F))


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
G_SHORTS_L, G_SHORTS_R = 74, 75   # 魯夫短褲管（自訂權重，見 shorts_w）
_H.ALLOW[G_SHORTS_L] = {'hips', 'thL'}
_H.ALLOW[G_SHORTS_R] = {'hips', 'thR'}
_H.MIRROR_GRP[G_SHORTS_L] = G_SHORTS_R


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
    # 紅色長袖襯衫：前襟整片敞開、袖子捲到前臂（袖口外翻），下襬在腰
    rows = [(0.06, ('w', 1.2), 0.9, 0.0)] + [r for r in TORSO_ROWS if r[0] > 0.12]
    shirt = open_jacket(F, red, rows, e=0.02, gap0=0.5, gap1=0.78, name='shirt', pec=0.1)
    body.append(shirt)
    body.append(neck(F, skin, r=0.054))
    proxy.append(body[-1])
    arm = arm_skin(F, skin, muscle=1.0, k=1.0)
    s_end = F.up + 0.16
    kit.paint_field(arm, lambda co: arm_s(F, co) - (s_end - 0.02), red, 0)
    slv = long_sleeve(F, red, s_end=s_end, k=1.0, e=0.016)
    roll = band('rollL', F.sh, F.da, s_end - 0.03, s_end + 0.015, 0.064 * F.k_fore + 0.024, 0.07 * F.k_fore + 0.03, red, G_FORE_L, thick=0.01, bulge=1.08)
    hand = fist(F, skin, scale=1.08)
    # 黃色腰帶（左腰垂下長布條）、到膝下的牛仔短褲配白色毛邊、赤腳拖鞋
    body.append(pelvis(F, denim, e=0.014))
    proxy.append(body[-1])
    yb = F.L + 0.08
    body.append(belt_ring(F, yb, 0.075, sash, e=0.025, thick=0.012))
    # 垂在左大腿外側（貼著短褲外緣再往外一點，跨步時不會穿進褲管）
    kl0 = F.k_leg
    body.append(hang_tail(sash, [V((F.w * 1.0, yb - 0.02, F.cz * 0.7)), F.th + F.dl * 0.18 + V((0.14 * kl0 + 0.05, 0, F.cz * 0.45)),
                                 F.th + F.dl * 0.42 + V((0.135 * kl0 + 0.065, 0, F.cz * 0.35))], 0.068, 0.058, name='sashTail', grp=G_CHAIN, side=V((-0.4, 0, 0.92)), flat=0.3))
    kl = F.k_leg
    s_sh = F.tl - 0.1  # 參考圖：短褲到膝蓋上方
    # 褲管上段內側收窄：兩根褲管在襠部不再互相穿過中線（原本在胯下交疊、z-fighting 成鋸齒），襠部中央交給骨盆部件
    def inseam(k):
        return lambda th: 1 - k * ang_bump(th, PI, 1.5)
    shorts = leg_tube(F, denim, [(-0.07, 0.13 * kl, 0.13 * kl, inseam(0.5)), (0.04, 0.138 * kl, 0.142 * kl, inseam(0.45)), (0.2, 0.134 * kl, 0.136 * kl, inseam(0.2)),
                                 (F.tl - 0.02, 0.122 * kl, 0.124 * kl), (s_sh, 0.124 * kl, 0.126 * kl)], cap1=None, name='shortsL')
    fur = band('furL', F.th, F.dl, s_sh - 0.03, s_sh + 0.03, 0.13 * kl, 0.13 * kl, P(0xf4f2ec), G_LEG_L, thick=0.02, bulge=1.12)
    calf = lambda th: 1 + 0.1 * ang_bump(th, BACK, 1.0)
    shin = leg_tube(F, skin, [(s_sh - 0.04, 0.088 * kl, 0.09 * kl), (F.tl, 0.08 * kl, 0.082 * kl), (F.tl + 0.12, 0.078 * kl, 0.084 * kl, calf), (F.tl + 0.22, 0.062 * kl, 0.066 * kl, calf), (F.tl + F.sl - 0.06, 0.05 * kl, 0.054 * kl)],
                    name='shinL', mat=4)
    ft = sandal(F, skin, sole)
    # 短褲管與毛邊：自訂權重（依沿大腿骨的距離，褲頭一小段交回骨盆），踢腿時整根褲管跟著大腿轉
    kit.tag(shorts, denim, grp=G_SHORTS_L)
    kit.tag(fur, P(0xf4f2ec), grp=G_SHORTS_L, ol=0.6)
    # 短褲管下端開口（不是封閉部件，會被 finish 濾掉），代理體另放一根從髖到腳踝的封閉腿，大腿與小腿才有骨熱
    px_leg = straight_leg(F, skin, k=0.95, name='pxLegL')
    pair_add(body, proxy, [arm, slv, roll, hand, shorts, fur, shin] + ft, proxy_set=[arm, hand] + ft)
    from heroes import mirror
    proxy += [px_leg, mirror(px_leg)]
    body.append(team_band(F, team, 1.2))

    h = anime_head('head_base', F, skin, jaw=1.04, chin=1.0, cheek=1.08, nose=0.7, face_len=0.95)
    hc = P(0x18161e)
    heads = {'base': [h, hair_cap('cap', F, hc, hairline=0.28, temple=0.1, scale=1.06, nape=-0.6)] + hair(F, hc, luffy_hair()) + straw_hat(F, straw, ribbon)}
    # 腰帶尾下段一半跟著左大腿（待機與跨步時大腿角度和綁定姿勢不同，只跟擺動鏈會被褲管穿出）
    chain_w = sash_chain_weights(F, 'sash')

    def tail_w(co):
        k = 0.5 * smooth((yb - 0.05 - co.y) / 0.3)
        return [(b, w * (1 - k)) for b, w in chain_w(co)] + [('thL', k)]
    return finish(F, P, body, proxy, heads, custom={G_CHAIN: tail_w, G_SHORTS_L: shorts_w(F, 'L'), G_SHORTS_R: shorts_w(F, 'R')})


def shorts_w(F, sd):
    """短褲管：沿大腿骨距離 s，褲頭（髖關節以上、藏在骨盆部件裡）漸漸交回 hips，其餘剛性跟著大腿。
    過渡帶整段放在關節上方：跨越關節的話，高踢腿時那幾圈會被線性混合壓扁、在胯下皺成尖角。"""
    h, t = F.b['th' + sd]
    d = (t - h).normalized()

    def fn(co):
        s = (co - h).dot(d)
        k = smooth((s + 0.07) / 0.05)
        return [('hips', 1 - k), ('th' + sd, k)]
    return fn


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
    # 疤沿胸口曲面貼著走（原本整條在同一個 z 平面上，胸口往兩側收進去之後兩端浮在皮膚外、壓到大衣前襟上）
    sp = []
    for i in range(7):
        q = c0 + d * (0.2 * (i / 3 - 1))
        hit, nrm = on_surface(chest, q.x, q.y)
        sp.append(hit + nrm * 0.0025)
    sc = path_loft('scar', sp, [0.005, 0.007, 0.0085, 0.009, 0.0085, 0.007, 0.005], n=6, flat=0.4)
    body.append(kit.tag(kit.subsurf(sc, 1), scar, mat=4, grp=G_TORSO, ol=0.0))
    body.append(chest)
    proxy.append(chest)
    # 深綠長大衣：胸口大開、長袖；腰帶以下另做一片長下襬垂到小腿，前方開衩
    rows = [(0.04, ('w', 1.24), 0.92, 0.0)] + [r for r in TORSO_ROWS if r[0] > 0.1]
    us = [r[0] for r in rows]
    ct = kit.loft('coat', torso_rows(F, e=0.02, rows=rows, pec=0.1, lat=0.08), n=22, cap0=None, cap1=None, gap=lambda i: 0.3 if us[i] < 0.3 else min(1.1, 0.3 + (us[i] - 0.3) * 1.3))
    ct = kit.subsurf(ct, 2, solidify=0.012)
    kit.tag(ct, coat, grp=G_TORSO)
    body.append(ct)
    hw = F.R['hip']
    body.append(long_skirt(F, coat, F.L + 0.1, F.L - 0.6, F.w * 1.32 + 0.03, F.cz * 1.0 + 0.03, hw * 2.3, F.cz * 1.55, gap=0.16, name='coatSkirt'))
    # 淺綠腹卷（從大衣開口露出）
    hara = kit.loft('hara', torso_rows(F, e=0.01, u0=0.12, u1=0.5, pec=0.06, lat=0.04), n=18, cap0=None, cap1=None)
    hara = kit.subsurf(hara, 2, solidify=0.008)
    kit.tag(hara, P(0x7ab84a), grp=G_TORSO, ol=0.6)
    kit.paint_field(hara, lambda co: 0.6 - math.sin(co.y * 140.0), P(0x5a9636), 0)
    body.append(hara)
    yb = F.L + 0.1
    body.append(belt_ring(F, yb, 0.085, red, e=0.045, thick=0.014))
    body.append(hang_tail(red, [V((F.w * 1.05, yb - 0.02, F.cz * 1.0)), V((F.w * 1.45, yb - 0.3, F.cz * 1.45)), V((F.w * 1.5, yb - 0.62, F.cz * 1.72))], 0.085, 0.072, name='sashTail', grp=G_CHAIN, side=V((-0.62, 0, 0.78)), flat=0.24))
    body.append(neck(F, skin, r=0.06))
    proxy.append(body[-1])
    arm = arm_skin(F, skin, muscle=0.9, k=1.08)  # 整條手臂都在袖子裡：肌肉起伏收小，前臂隆起才不會從袖口內壁穿出來
    # 袖子底下的手臂塗成大衣色，但交界收進袖口深處：從寬袖口斜看進去時看到的是皮膚，不是一圈綠色弧線
    kit.paint_field(arm, lambda co: arm_s(F, co) - (F.up + F.lo - 0.14), coat, 0)
    slv = long_sleeve(F, coat, k=1.08, e=0.014, cuff=0.88)
    bandana = band('bandL', F.sh, F.da, 0.1, 0.17, 0.1 * F.k_arm + 0.016, 0.096 * F.k_arm + 0.016, black, G_UPPER_L, thick=0.008)
    hand = fist(F, skin, scale=1.08)
    body.append(pelvis(F, black, e=0.012))
    proxy.append(body[-1])
    leg = straight_leg(F, black, k=1.05)
    bt = boot(F, black, F.tl + 0.02, 0.078, pal_sole=black)
    pair_add(body, proxy, [slv, arm, hand, leg] + bt, proxy_set=[arm, hand, leg] + bt)
    body.append(bandana)
    body.append(team_band(F, team, 1.3))

    h = anime_head('head_base', F, skin, jaw=1.1, chin=1.08, cheek=1.02, nose=0.8, brow=0.7, face_len=1.05, square=0.6)
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
    return finish(F, P, body, proxy, heads, extras={'sword': blade, 'sheath': sh3},
                  custom={G_CHAIN: sash_chain_weights(F, 'sash'), G_SKIRT: zoro_skirt_weights(F),
                          G_ARM_L: zoro_arm_weights(F), G_ARM_R: zoro_arm_weights(F),
                          G_UPPER_L: zoro_upper_weights(F)})


def zoro_arm_weights(F):
    """索隆的長袖與手臂：不分給胸腔／腰（骨熱在腋下給袖子底面 15～20% 的 ribs，手舉過頭時袖底會被扯回胸口皺成一團），
    肩頭由鎖骨沿手臂方向漸漸交給上臂，手肘以下保留骨熱的前臂權重。袖子與手臂皮膚用同一函式，變形一致。"""
    def fn(co, old):
        sd = 'L' if co.x >= 0 else 'R'
        s = arm_s(F, V((abs(co.x), co.y, co.z)))
        w = dict(old)
        el = w.get('el' + sd, 0.0) + w.get('wr' + sd, 0.0)
        t = smooth((s + 0.1) / 0.12)
        rest = 1.0 - el
        out = [('cl' + sd, rest * (1 - t)), ('sh' + sd, rest * t)]
        if el > 0:
            out.append(('el' + sd, el))
        return out
    fn.blend = True
    return fn


def zoro_upper_weights(F):
    """上臂的頭巾與隊伍色臂章：整圈剛性跟著上臂（骨熱分到的 ribs 會讓臂章在舉手時被拉歪）。"""
    def fn(co):
        return [('sh' + ('L' if co.x >= 0 else 'R'), 1.0)]
    return fn


def zoro_skirt_weights(F):
    """大衣長下襬：前片跟著各自的大腿；側邊與後面往下漸漸把大腿權重讓給骨盆（側）與擺動鏈（後）。
    原本側邊整片剛性跟著大腿，被打飛時抬高的大腿把側片整塊掀到肩膀高，和往下垂的後片之間拉出一大片三角帆。"""
    base = skirt_chain_weights(F, 'skirt')
    h0, _ = F.b['skirt0']
    _, t1 = F.b['skirt1']
    kn_y = F.b['knL'][0].y

    def fn(co, old):
        a = math.atan2(abs(co.x), co.z)              # 0＝正前方、pi/2＝側邊、pi＝正後方
        t = (h0.y - co.y) / (h0.y - t1.y)
        wt = 1.0 - 0.75 * smooth((a - 0.45) / 0.9) - 0.25 * smooth((a - 1.5) / 0.8)   # 大腿保留比例：前 1、側約 0.25、後 0
        wt *= 1.0 - 0.3 * smooth((kn_y + 0.24 - co.y) / 0.2)   # 大腿中段以下的前片也只跟七成：抬腿時下襬不會整片沿大腿立起
        m = 1.0 - (1.0 - wt) * smooth(t * 2.5)       # 腰頭附近維持骨熱
        w = dict(old)
        thl, thr = w.pop('thL', 0.0), w.pop('thR', 0.0)   # 左右分開縮放：後中線兩側的權重才會連續，不會沿中線裂開
        moved = (thl + thr) * (1 - m)
        cs = smooth((a - 1.45) / 1.0)                # 讓出的權重：側邊給骨盆、往後漸漸給擺動鏈
        c1 = smooth(t * 1.6 - 0.5)
        # 膝蓋以下的前片部分跟著小腿折下來：大腿抬高、膝蓋彎起時，下襬不會沿著大腿直直戳出去
        kq = 0.5 * smooth((1.9 - a) / 1.0) * smooth((kn_y + 0.05 - co.y) / 0.12)
        out = [(b, v) for b, v in w.items()] + [('thL', thl * m * (1 - kq)), ('knL', thl * m * kq), ('thR', thr * m * (1 - kq)), ('knR', thr * m * kq),
                                                ('hips', moved * (1 - cs)), ('skirt0', moved * cs * (1 - c1)), ('skirt1', moved * cs * c1)]
        acc = {}
        for b, v in out:
            if v > 1e-5:
                acc[b] = acc.get(b, 0.0) + v
        return base(co, list(acc.items()))
    fn.blend = True
    return fn


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
    kit.paint_field(sh, lambda co: 0.55 - math.sin(co.x * 160.0), P(0x3a62b0), 0)  # 細直條紋襯衫
    body.append(sh)
    proxy.append(sh)
    tie_s = path_loft('tie', [V((0, F.y(0.95), F.cz * 0.78 + 0.012)), V((0, F.y(0.82), F.cz * 0.98 + 0.012)), V((0, F.y(0.7), F.cz * 1.02 + 0.014))], [0.014, 0.02, 0.022], n=6, flat=0.25)
    body.append(kit.tag(kit.subsurf(tie_s, 1), tie, grp=G_TORSO, ol=0.5))
    # 合身的雙排扣西裝：前襟只在胸口開一個窄 V，下襬到臀部；兩排金扣
    rows = [(-0.14, ('w', 1.24), 0.94, 0.0), (0.02, ('w', 1.12), 0.86, 0.0)] + [r for r in TORSO_ROWS if r[0] > 0.1]
    us = [r[0] for r in rows]
    jk = kit.loft('jacket', torso_rows(F, e=0.012, rows=rows, pec=0.05, lat=0.04), n=22, cap0=None, cap1=None, gap=lambda i: 0.06 if us[i] < 0.6 else min(0.7, 0.06 + (us[i] - 0.6) * 1.6))
    jk = kit.subsurf(jk, 2, solidify=0.009)
    kit.tag(jk, suit, grp=G_TORSO)
    body.append(jk)
    gold = P(0xe8c050)
    for u in (0.2, 0.36, 0.52):
        for sx in (1, -1):
            p, n = on_surface(jk, sx * F.cx * 0.3, F.y(u))
            body.append(stud('btn', p, n, 0.011, gold))
    body.append(neck(F, skin, r=0.05))
    proxy.append(body[-1])
    sl = long_sleeve(F, suit, k=1.0, e=0.007)
    arm = arm_skin(F, skin, muscle=0.6)
    kit.paint_field(arm, lambda co: arm_s(F, co) - (F.up + F.lo - 0.06), suit, 0)
    hand = fist(F, skin, scale=1.0)
    body.append(pelvis(F, suit, e=0.01))
    proxy.append(body[-1])
    leg = straight_leg(F, suit, k=0.86, flare=1.08)
    bt = boot(F, suitD, F.tl + F.sl - 0.1, 0.055, pal_sole=suitD, toe=0.9, toe_len=0.06)
    pair_add(body, proxy, [sl, arm, hand, leg] + bt, proxy_set=[arm, hand, leg] + bt)
    body.append(team_band(F, team, 1.2))

    h = anime_head('head_base', F, skin, jaw=0.92, chin=0.9, cheek=0.94, nose=0.8, face_len=1.1)
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
    # 比基尼上衣：兩片扁平罩杯貼在胸口（藍白迷彩紋），頸後綁帶與背後細帶
    from cast import plate
    for sx in (1, -1):
        p, n = on_surface(tor, sx * F.cx * 0.42, F.y(0.66))
        cup = plate('cup', p + n * 0.004, V((1, 0, 0)), V((0, 1, 0)), n, F.cx * 0.5, F.cx * 0.44, 0.012, top_c, G_TORSO, mat=0, ol=0.6)
        kit.paint_field(cup, lambda co: 0.4 - math.sin(co.x * 90.0 + co.y * 60.0), top_l, 0)
        body.append(cup)
    # 背後細帶：和底下的皮膚同一個群組（可分到鎖骨／上臂），舉手時才會跟著背部皮膚走，不會浮出輪廓
    body.append(strap_around(F, tor, V((0, F.y(0.66), 0)), V((0, 1, 0)), 0.01, 0.004, top_c, off=0.004, arc=(PI * 0.7, PI * 2.3), grp=G_TORSO))
    body.append(neck(F, skin, r=0.045))
    proxy.append(body[-1])
    body += nami_halter(F, [tor, body[-1]], top_c)
    arm = arm_skin(F, skin, muscle=0.25, k=1.0)
    # 航海手環：前臂在這段是扁的（側寬約 0.056·kf、前後約 0.048·kf），環要比皮膚大一圈，不然會沉進前臂只露出一塊
    bracelet = band('logL', F.sh, F.da, F.up + F.lo - 0.075, F.up + F.lo - 0.03, 0.066 * F.k_fore, 0.058 * F.k_fore, belt_c, G_FORE_L, thick=0.008, ol=0.4, rb=0.9)
    hand = fist(F, skin, scale=0.98)
    # 咖啡色七分褲（到小腿中段）、金環皮帶、橘色綁帶高跟涼鞋
    capri = P(0x4a3226)
    body.append(pelvis(F, capri, e=0.006))
    proxy.append(body[-1])
    yb = F.L + 0.05
    body.append(belt_ring(F, yb, 0.032, belt_c, e=0.016, thick=0.008))
    for k in range(5):
        a = -0.7 + k * 0.35
        p, n = on_surface(body[-1], math.sin(a) * F.w * 1.3, yb)
        body.append(stud('ring', p, n, 0.012, P(0xe0b050), grp=G_BELT))
    kl = F.k_leg
    s_cap = F.tl + 0.08
    leg_rows = [(-0.07, 0.114 * kl, 0.114 * kl), (0.05, 0.114 * kl, 0.118 * kl), (0.22, 0.1 * kl, 0.104 * kl), (F.tl - 0.03, 0.08 * kl, 0.084 * kl),
                (F.tl + 0.08, 0.078 * kl, 0.082 * kl), (s_cap, 0.074 * kl, 0.076 * kl)]
    leg = leg_tube(F, capri, leg_rows, cap1=None)
    # 褲管下緣開口，不算封閉、不進骨熱代理體：代理體上整條大腿空著，褲管內側就近抓到骨盆（hips 權重到大腿中段還有七成），
    # 抬腿時兩腿之間拉出一大片三角形。另做一根封閉的大腿替身只給骨熱用（往下伸進小腿皮膚，接上膝蓋）
    thigh_px = leg_tube(F, skin, leg_rows[:-1] + [(F.tl + 0.14, 0.07 * kl, 0.074 * kl)], name='thighPx')
    from heroes import mirror
    proxy += [thigh_px, mirror(thigh_px)]
    calf = lambda th: 1 + 0.09 * ang_bump(th, BACK, 1.0)
    shin = leg_tube(F, skin, [(F.tl + 0.1, 0.066 * kl, 0.07 * kl, calf), (F.tl + 0.2, 0.054 * kl, 0.058 * kl, calf), (F.tl + F.sl - 0.06, 0.044 * kl, 0.048 * kl)], name='shinL', mat=4)
    bt = boot(F, P(0xd8783a), F.tl + 0.2, 0.05, pal_sole=P(0x8a4a22), toe=0.85)
    for o in bt:
        kit.paint_field(o, lambda co: 0.25 - math.sin(co.y * 120.0), skin, 4)  # 綁帶之間露出皮膚
    pair_add(body, proxy, [arm, bracelet, hand, leg, shin] + bt, proxy_set=[arm, hand, leg] + bt)
    body.append(team_band(F, team, 1.0))

    h = anime_head('head_base', F, skin, jaw=0.88, chin=0.8, cheek=1.0, nose=0.6, face_len=0.98)
    hc = P(0xf28a3a)
    heads = {'base': [h, hair_cap('cap', F, hc, hairline=0.6, temple=0.0, scale=1.08, nape=-0.6, side_cut=False)] + hair(F, hc, nami_hair()) + nami_ties(F, P(0xe8c050))}
    # 天候棒：三節藍色棍子（握在手上；平常斜背在背後）
    segs = []
    for k in range(3):
        sg = limb('st%d' % k, V((0, -0.2 + k * 0.33, 0)), V((0, 1, 0)), [(0, 0.016, 0.016), (0.3, 0.016, 0.016)], n=8, cap0='pole', cap1='pole')
        segs.append(kit.tag(kit.subsurf(sg, 1), staff_c, mat=2, ol=0.6))
        jt = kit.quad_sphere('jt', 1.0, cuts=2)
        kit.deform(jt, lambda p, k=k: V((0, -0.2 + k * 0.33 + 0.3, 0)) + p * 0.024)
        segs.append(kit.tag(jt, staff_l, mat=2, ol=0.5))
    return finish(F, P, body, proxy, heads, extras={'sword': segs})


def nami_halter(F, targets, pal):
    """比基尼的掛脖綁帶：從罩杯上緣沿胸口、鎖骨爬到脖子側面，繞到後頸打結。
    每個控制點都從身體外側往中軸打射線、取最外層的表面（軀幹與脖子交疊處不會被埋進斜方肌裡），再往外浮一點。"""
    import bpy
    from heroes import tree_of
    tmp = kit.join([kit.duplicate(t, 'tmp') for t in targets], 'tmp_halter')
    tr = tree_of(tmp)
    bpy.data.objects.remove(tmp, do_unlink=True)
    cx = F.cx
    yn = F.y(1.0)

    def onto(q, axis_z=0.0, off=0.0045):
        a = V((0, q.y, axis_z))
        d = V((q.x, 0, q.z - axis_z))
        d = d.normalized() if d.length > 1e-6 else V((0, 0, 1))
        hit = tr.ray_cast(a + d * 0.5, -d, 0.6)
        return (hit[0] + d * off) if hit[0] is not None else q

    out = []
    for sx in (1, -1):
        p, n = on_surface(targets[0], sx * cx * 0.42, F.y(0.66))
        ctrl = [
            (p + V((sx * cx * 0.08, cx * 0.36, 0.0)), 0.0),
            (V((sx * cx * 0.44, F.y(0.8), 0.1)), 0.0),
            (V((sx * cx * 0.38, F.y(0.9), 0.08)), 0.0),
            (V((sx * cx * 0.3, F.y(0.97), 0.05)), -0.01),
            (V((sx * 0.05, yn, 0.03)), -0.006),
            (V((sx * 0.05, yn + 0.008, -0.01)), -0.006),
            (V((sx * 0.035, yn + 0.012, -0.04)), -0.006),
            (V((sx * 0.008, yn + 0.014, -0.06)), -0.006),
        ]
        pts = [onto(q, az) for q, az in ctrl]
        o = path_loft('halter', pts, [0.0045] * len(pts), n=6, flat=0.6)
        out.append(kit.tag(kit.subsurf(o, 1), pal, grp=G_TORSO, ol=0.45))
    knot = kit.quad_sphere('halterKnot', 1.0, cuts=2)
    kp = onto(V((0, yn + 0.014, -0.06)), -0.006, off=0.006)
    kit.deform(knot, lambda q: kp + V((q.x * 0.011, q.y * 0.008, q.z * 0.006)))
    out.append(kit.tag(knot, pal, grp=G_TORSO, ol=0.4))
    return out


def nami_hair():
    # 中分、兩側瀏海框住臉，後面的頭髮在耳下綁成兩條低馬尾垂到肩上
    return sym([
        ((0.12, 0.94, 0.45), (0.42, 0.22, 0.95), 0.2, 0.07, (0.15, 0.15, 0.15)),
        ((0.55, 0.75, 0.3), (0.82, -0.55, 0.42), 0.2, 0.08, (0.2, 0.1, 0.12)),
        ((0.55, 0.65, -0.35), (0.78, -0.45, -0.55), 0.38, 0.12, (0.2, 0.15, -0.05)),
        ((0.12, 0.7, -0.7), (0.5, -0.5, -0.85), 0.4, 0.12, (0.1, 0.15, -0.1)),
        ((0.75, -0.4, -0.45), (1.0, -2.0, -0.35), 0.3, 0.16, (0.25, 0.0, 0.1)),   # 低馬尾
    ])


def nami_ties(F, pal):
    """綁馬尾的珠子髮圈。"""
    out = []
    for sx in (1, -1):
        b = kit.quad_sphere('tie', 1.0, cuts=3)
        kit.deform(b, lambda p, sx=sx: F.c + V((sx * F.hr * 0.78, -F.hr * 0.48, -F.hr * 0.46)) + p * F.hr * 0.11)
        out.append(kit.tag(b, pal, mat=2, grp=G_FREE, ol=0.5))
    return out


BUILDERS = {
    'naruto': build_naruto, 'sasuke': build_sasuke, 'kakashi': build_kakashi, 'sakura': build_sakura,
    'luffy': build_luffy, 'zoro': build_zoro, 'sanji': build_sanji, 'nami': build_nami,
}
