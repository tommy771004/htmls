# 褲子（short.md 的 P-01～P-15；P-03 工裝短褲在 wear.py 的 build_all）：wear.py 用 exec 載入，共用 shell 與它的切法
# 每件都是身體褲子區（＋小腿區；高腰的再加上衣區下緣）長出來的殼，cov=2：穿上時退回皮膚的只有褲裙那組（39-wear-items.js 照類別給）。
# 褲長、斜切、開衩、破洞是純量場切的；腰頭、反摺、護膝、口袋是貼片；側邊條紋、刺繡線、拼色是 regions；抽繩、鐵鍊、D 環是 extra 的立體件


def above(z):
    """腰頭：z 以上切掉（高腰褲吃進上衣區）"""
    return lambda p, ctx: p.z - (z(p) if callable(z) else z)


# 褲管中心的前後位置（-Y 是正面）：大腿在前、膝蓋、小腿肚往後（兩個性別量起來差不到 1 cm）
_LY = ((.1, .09), (.42, .077), (.54, .045), (.89, .02), (1.2, .02))


def leg_y(z):
    for (z0, y0), (z1, y1) in zip(_LY, _LY[1:]):
        if z <= z1:
            t = max(0., min(1., (z - z0) / (z1 - z0)))
            return y0 + (y1 - y0) * t
    return _LY[-1][1]


def outer_line(F, lx, dy=0., w=.003, z0=0., z1=9.):
    """褲管外側沿長邊的一道線（≤ 0 在線上）：側邊條紋、拉鍊、反光線；dy 往前（-）往後（+）挪"""
    def f(p, ctx):
        if not z0 <= p.z <= z1:
            return 1.
        return max(abs(p.y - leg_y(p.z) - dy) - w, lx + .03 - abs(p.x - F.ox))
    return f


def side_slit(F, lx, hem, h, w):
    """褲管外側從褲口往上開的衩（> 0 切掉）：hem(p) 是褲口高度"""
    def g(p, ctx):
        hz = hem(p) if callable(hem) else hem
        return min(w - abs(p.y - leg_y(p.z)), hz + h - p.z, abs(p.x - F.ox) - (lx + .03))
    return g


def rips(lst):
    """刷破的範圍（≤ 0 在裡面，regions／patches 用）：[(中心, 半徑)]，同 holes"""
    h = holes(lst)
    return lambda p, ctx: -h(p, ctx)


def back_stroke(F, pts, w):
    """後片（臀部）上的折線（|x| 對稱，x 相對中線, z）：後口袋的塗鴉刺繡"""
    def f(p, ctx):
        if p.y < .05:
            return 1.
        x = abs(p.x - F.ox)
        d = 9.
        for (ax, az), (bx, bz) in zip(pts, pts[1:]):
            px, pz, dx, dz = x - ax, p.z - az, bx - ax, bz - az
            t = max(0., min(1., (px * dx + pz * dz) / (dx * dx + dz * dz)))
            d = min(d, math.hypot(px - dx * t, pz - dz * t))
        return d - w
    return f


def surf_y(F, x, z, front=True):
    """身體（退回皮膚後）在 (x, z) 的正面或背面 y（抽繩、鐵鍊的錨點用）"""
    tree = _body_bvh(F)[0]
    o, d = (Vector((x, -1., z)), Vector((0, 1, 0))) if front else (Vector((x, 1., z)), Vector((0, -1, 0)))
    hit = tree.ray_cast(o, d, 2.)
    return hit[0].y if hit[0] is not None else (-.1 if front else .1)


def chain(bm, pts, R=.0055, r=.0014):
    """一串鏈條：沿折線每 1.8R 一節，前後兩節轉 90°"""
    pts = [Vector(p) for p in pts]
    acc = []
    for a, b in zip(pts, pts[1:]):
        n = max(1, int((b - a).length / (R * 1.8)))
        acc += [a.lerp(b, k / n) for k in range(n)]
    acc.append(pts[-1])
    for i, p in enumerate(acc):
        t = (acc[min(i + 1, len(acc) - 1)] - acc[max(i - 1, 0)]).normalized()
        q = t.to_track_quat('X', 'Z').to_euler()
        rot = (q.x + (math.pi / 2 if i % 2 else 0.), q.y, q.z)
        ring(bm, p, R, r, rot=rot, seg=10, sseg=5)


def build_pants(F, g):
    ox, M = F.ox, g == 'Male'
    pel, th, kn, an = F.b('pelvis'), F.b('thigh_l'), F.b('calf_l'), F.b('foot_l')
    lx = th.x - ox
    ax = lambda p: abs(p.x - ox)
    down = lambda p, a, b: max(0., min(1., (a - p.z) / (a - b)))          # a → b 由 0 漸到 1（往下）
    out = lambda p: max(-1., min(1., (ax(p) - lx) / .06))                  # 褲管內側 -1 → 外側 1
    S = lambda name: f'W_{name}_{g}'

    # P-01 高腰毛邊刷破牛仔熱褲：高腰到肚臍下、褲管極短（外側比內側高的斜切）、毛邊白線流蘇、大腿前側割破
    hem1 = lambda p: th.z - .125 + .03 * max(0., out(p)) + .004 * math.sin(p.x * 900.) + .003 * math.sin(p.y * 1300.)
    shell(F, S('cutoff_hot'), ['bottom', 'top'], cov=2, off=lambda p: .006 + .004 * max(0., min(1., (p.y - .02) / .08)), smooth=4, rim=.004,
          fields=[above(pel.z + .085), below(hem1),
                  holes([((ox + s * .095, -.08, th.z - .07), (.016, .04, .007)) for s in (-1, 1)] + [((ox + .12, -.07, th.z - .1), (.012, .04, .005))])],
          regions=[(edge_band(below(hem1), .009), 'c')],
          patches=[(lambda p, ctx: (pel.z + .045) - p.z, .0025, .002, 'cloth'),
                   (box(.0, -.12, pel.z + .03, .01, .05, .045, sym=ox), .002, .001, 'gold')])

    # P-02 街頭雙層抽繩網眼籃球短褲：及膝的寬褲管、鬆緊寬腰頭、長垂的白色編織抽繩、褲口黑底白邊、側邊徽章
    hem2 = kn.z - .035
    bl2 = below(hem2)
    def cords2(bm, trim, ctx):
        with _part(bm, trim, 'c'):
            for s in (-1, 1):
                x = ox + s * .014
                y = surf_y(F, x, pel.z + .01) - .012
                tube(bm, [(x, y, pel.z + .012), (x + s * .004, y - .004, pel.z - .03), (x + s * .01, y + .002, pel.z - .09), (x + s * .012, y + .006, pel.z - .15)], .0022, seg=6)
    shell(F, S('bball_mesh'), ['bottom', 'shin'], off=lambda p: .012 + .03 * down(p, th.z, hem2), smooth=5, rim=.008,
          fields=[bl2], extra=cords2,
          regions=[(edge_band(bl2, .034), 'b'), (lambda p, ctx: max(.014 + bl2(p, ctx), -bl2(p, ctx) - .021), 'c')],
          patches=[(lambda p, ctx: (pel.z - .016) - p.z, .0045, .003, 'b'),
                   (lambda p, ctx: 1. if ax(p) < lx + .04 else math.hypot(p.y - leg_y(p.z) - .01, p.z - (hem2 + .11)) - .017, .002, .001, 'c')])

    # P-04 高彈力塑形單車短褲：高腰寬腰頭、長度到大腿中段、整件貼著皮膚，外側兩道反光銀線
    hem4 = th.z - .21
    shell(F, S('biker'), ['bottom', 'top'], cov=2, off=lambda p: .0045, smooth=3, rim=.003,
          fields=[above(pel.z + .1), below(hem4)],
          regions=[(outer_line(F, lx, -.011, .0022, hem4 + .02, th.z - .02), 'c'), (outer_line(F, lx, -.003, .0022, hem4 + .02, th.z - .06), 'c')],
          patches=[(lambda p, ctx: (pel.z + .035) - p.z, .002, .0015, 'cloth')])

    # P-05 熱帶印花衝浪海灘褲：大腿中段、直筒微寬（褲口多 8 mm 裕度）、腰前魔鬼氈門襟與撞色綁帶、側邊小開衩
    hem5 = th.z - .2
    def tie5(bm, trim, ctx):
        y = surf_y(F, ox, pel.z) - .016
        with _part(bm, trim, 'c'):
            for s in (-1, 1):
                tube(bm, [(ox, y, pel.z + .004), (ox + s * .022, y - .006, pel.z + .012), (ox + s * .03, y - .003, pel.z - .002), (ox + s * .006, y - .002, pel.z)], .0026, seg=6)
                tube(bm, [(ox, y, pel.z), (ox + s * .01, y - .004, pel.z - .05), (ox + s * .016, y - .001, pel.z - .085)], .0024, seg=6)
    shell(F, S('boardshort'), ['bottom'], off=lambda p: .01 + .012 * down(p, th.z, hem5), smooth=5, rim=.007,
          fields=[below(hem5), side_slit(F, lx, hem5, .045, .007)], extra=tie5,
          regions=[(lambda p, ctx: (pel.z - .002) - p.z, 'b')],
          patches=[(box(.0, -.12, pel.z - .035, .022, .06, .04, sym=ox), .003, .002, 'b')])

    # P-06 刷破膝上丹寧五分褲：膝蓋上 3 cm、修身直筒、褲口反摺一大圈、大腿貓鬚、潑漆點、橫向刀割破洞（露出白色緯線）
    hem6 = kn.z + .056
    slash6 = [((ox + s * (.1 + .012 * k), -.07, th.z - .1 - .055 * k), (.024 - .004 * k, .045, .0045)) for s in (-1, 1) for k in range(3)]
    shell(F, S('denim_knee'), ['bottom'], off=lambda p: .007 + .005 * down(p, th.z, hem6), smooth=4, rim=.006,
          fields=[below(hem6)],
          regions=[(rips(slash6), 'c')],
          patches=[(edge_band(below(hem6), .038), .007, .005, 'cloth'), (lambda p, ctx: (pel.z - .008) - p.z, .0025, .002, 'cloth')])

    # P-07 泰拳緞面搏擊短褲：超寬鬆、八道車線的寬腰頭、褲管外側高開衩、前片金色圖騰（CHAR_FS 的 muay）、褲口金色滾邊
    hem7 = th.z - .19
    shell(F, S('muay_thai'), ['bottom'], off=lambda p: .02 + .035 * down(p, th.z, hem7), smooth=6, rim=.008,
          fields=[below(hem7), side_slit(F, lx, hem7, .085, .011)],
          regions=[(edge_band(below(hem7), .01), 'gold'), (edge_band(side_slit(F, lx, hem7, .085, .011), .008), 'gold')],
          patches=[(lambda p, ctx: (pel.z - .03) - p.z, .005, .003, 'gloss')])

    # P-08 毛巾布休閒短褲：大腿中上、兩側往上弧的褲口（海豚褲）、第二色滾邊、前面的斜插口袋
    def hem8(p):
        side = math.exp(-((p.y - leg_y(p.z)) / .04) ** 2) * max(0., out(p))
        return th.z - .2 + .055 * side
    pocket8 = lambda p, ctx: 1. if p.y > -.02 or ax(p) < .07 else abs((p.z - (pel.z - .015)) + (ax(p) - .12) * 1.3) - .0035
    shell(F, S('terry'), ['bottom'], off=lambda p: .01 + .008 * down(p, th.z, th.z - .2), smooth=5, rim=.006,
          fields=[below(hem8)],
          regions=[(edge_band(below(hem8), .009), 'b'), (pocket8, 'b')],
          patches=[(lambda p, ctx: (pel.z - .006) - p.z, .003, .002, 'cloth')])

    # P-09 賽博機能束口工裝長褲：上寬下窄、小腿羅紋束口、膝蓋立體護膝、螢光黃飄帶繞著褲管、金屬 D 環
    hem9 = an.z + .07
    def spiral9(p, ctx):
        if not hem9 + .07 < p.z < th.z - .04:
            return 1.
        a = math.atan2(p.y - leg_y(p.z), ax(p) - lx) / (2 * math.pi)
        return abs(((a + p.z * 2.6) % 1.) - .5) * 2. - .045
    def rings9(bm, trim, ctx):
        with _part(bm, trim, 'silver'):
            for s in (-1, 1):
                x = ox + s * (lx + .082)
                ring(bm, (x, leg_y(kn.z + .2) - .01, kn.z + .2), .009, .0018, rot=(0, math.pi / 2, 0), seg=14, sseg=5)
    shell(F, S('cyber_jogger'), ['bottom', 'shin'], off=lambda p: .007 + .012 * max(0., min(1., (p.z - an.z) / (th.z - an.z))), smooth=5, rim=.005,
          fields=[below(hem9)], extra=rings9,
          regions=[(spiral9, 'glow')],
          patches=[(edge_band(below(hem9), .045), .0035, .003, 'b'),
                   (box(lx, -.03, kn.z + .015, .045, .045, .06, sym=ox), .007, .004, 'b'),
                   (lambda p, ctx: (pel.z - .01) - p.z, .003, .002, 'b')])

    # P-10 90 年代超寬鬆牛仔褲：褲管越往下越寬、褲口蓋到鞋面（後跟往上拱的切口不踩到鞋底）、超大後口袋與金色塗鴉刺繡
    hem10 = lambda p: an.z + .015 + .04 * max(0., min(1., (p.y - leg_y(p.z) - .01) / .04))
    tag10 = [[(.035, pel.z - .05), (.05, pel.z - .085), (.07, pel.z - .06), (.09, pel.z - .1), (.11, pel.z - .07)],
             [(.04, pel.z - .12), (.065, pel.z - .105), (.085, pel.z - .13), (.105, pel.z - .115)]]
    shell(F, S('baggy_jeans'), ['bottom', 'shin'], off=lambda p: .02 + .036 * down(p, th.z - .05, an.z), smooth=6, rim=.009,
          fields=[below(hem10)],
          patches=[(box(.075, .12, pel.z - .085, .058, .07, .07, sym=ox), .0035, .002, 'cloth'),
                   (lambda p, ctx: min(back_stroke(F, t, .0028)(p, ctx) for t in tag10), .0052, .001, 'c'),
                   (lambda p, ctx: (pel.z - .01) - p.z, .003, .002, 'cloth')])

    # P-11 高腰微喇西裝長褲：高腰包臀、大腿合身、膝蓋以下往外散開、褲口內側小開衩、壓燙的褲線（CHAR_FS 的 crease）
    hem11 = an.z + .055
    shell(F, S('flare_trouser'), ['bottom', 'shin', 'top'], cov=2, off=lambda p: .007 + .048 * down(p, kn.z, hem11) ** 1.5, smooth=5, rim=.006,
          fields=[above(pel.z + .11), below(hem11),
                  lambda p, ctx: min(.008 - abs(p.y - leg_y(p.z)), hem11 + .04 - p.z, (lx - .03) - ax(p))],     # 褲口內側的衩
          patches=[(lambda p, ctx: (pel.z + .07) - p.z, .003, .002, 'cloth'),
                   (box(.0, -.12, pel.z + .09, .006, .05, .006, sym=ox), .002, .001, 'gold')])

    # P-12 重機風琴褶皮褲：貼腿窄管、膝蓋上方前側的橫向風琴褶（CHAR_FS 的 moto）、大腿外側銀色雙排拉鍊、腰邊鉚釘
    hem12 = an.z + .06
    shell(F, S('moto_leather'), ['bottom', 'shin'], off=lambda p: .0065 + .002 * max(0., min(1., (p.y - .02) / .08)), smooth=4, rim=.005,
          fields=[below(hem12)],
          patches=[(outer_line(F, lx, -.012, .0025, kn.z + .1, th.z - .05), .0018, .001, 'silver'),
                   (outer_line(F, lx, .006, .0025, kn.z + .1, th.z - .05), .0018, .001, 'silver'),
                   (lambda p, ctx: (pel.z - .01) - p.z, .0025, .002, 'cloth'),
                   (lambda p, ctx: 1. if p.y > -.02 else min(math.hypot(ax(p) - x, p.z - (pel.z + .005)) for x in (.05, .085, .12)) - .0045, .0045, .001, 'silver')])

    # P-13 龐克格紋鐵鍊褲：直筒、左右褲管不同格紋（CHAR_FS 的 punkplaid）、膝蓋綁帶、後腰的臀布、外側兩層垂掛的銀色鐵鍊
    hem13 = an.z + .06
    def chains13(bm, trim, ctx):
        R = .095     # 褲管中心到鐵鍊（大腿半徑 7 cm＋殼＋鍊子）；只掛左腿
        with _part(bm, trim, 'silver'):
            for drop in (.11, .17):
                pts = []
                for k in range(13):
                    a = -1.1 + 2.2 * k / 12
                    z = pel.z - .015 - drop * math.cos(a * 1.35)
                    pts.append((ox + lx + R * math.cos(a), leg_y(z) + R * math.sin(a), z))
                chain(bm, pts)
    shell(F, S('punk_tartan'), ['bottom', 'shin'], off=lambda p: .011 + .004 * down(p, th.z, an.z), smooth=5, rim=.006,
          fields=[below(hem13)], extra=chains13,
          patches=[(lambda p, ctx: abs(p.z - (kn.z + .035)) - .012, .004, .003, 'b'),
                   (box(.0, .12, pel.z - .07, .12, .06, .075, sym=ox), .009, .006, 'b'),
                   (lambda p, ctx: (pel.z - .01) - p.z, .003, .002, 'b')])

    # P-14 側邊排釦復古運動寬褲：直筒落地、外側三條米白織帶、整排金屬按釦（褲口那兩顆打開成衩）、絲絨布（CHAR_FS 的 velour）
    hem14 = an.z + .05
    snaps14 = [pel.z - .03 - k * .075 for k in range(12) if pel.z - .03 - k * .075 > hem14 + .09]
    def snap14(p, ctx):
        if abs(p.y - leg_y(p.z)) > .03 or ax(p) < lx + .03:
            return 1.
        return min(math.hypot(p.y - leg_y(p.z) - .0, p.z - z) for z in snaps14) - .0045
    shell(F, S('snap_track'), ['bottom', 'shin'], off=lambda p: .015 + .007 * down(p, th.z, an.z), smooth=5, rim=.007,
          fields=[below(hem14), side_slit(F, lx, hem14, .07, .008)],
          regions=[(outer_line(F, lx, d, .0033, hem14 + .075, pel.z), 'c') for d in (-.016, -.007, .016)],
          patches=[(snap14, .0025, .001, 'silver'), (lambda p, ctx: (pel.z - .012) - p.z, .003, .002, 'cloth')])

    # P-15 迷彩空降傘兵寬褲：超寬褲身、膝蓋打褶膨起、褲口抽繩束起（拉繩與金屬扣）、大腿側邊的軍綠拼色口袋
    hem15 = an.z + .065
    knee15 = lambda p: math.exp(-((p.z - kn.z) / .07) ** 2)
    cinch15 = lambda p: max(0., min(1., (hem15 + .11 - p.z) / .09))
    def cords15(bm, trim, ctx):
        for s in (-1, 1):
            x = ox + s * (lx + .058)
            y = leg_y(hem15 + .02)
            with _part(bm, trim, 'c'):
                tube(bm, [(x, y - .01, hem15 + .025), (x + s * .008, y - .012, hem15 - .005), (x + s * .01, y - .008, hem15 - .03)], .0018, seg=6)
            with _part(bm, trim, 'silver'):
                cyl(bm, (x + s * .009, y - .011, hem15 - .012), .0045, .0045, .012, seg=10)
    shell(F, S('para_camo'), ['bottom', 'shin'], off=lambda p: .028 + .018 * knee15(p) - .02 * cinch15(p), smooth=6, rim=.008,
          fields=[below(hem15)], extra=cords15,
          patches=[(box(lx + .07, .0, kn.z + .19, .03, .07, .065, sym=ox), .007, .004, 'c'),
                   (box(lx + .07, .0, kn.z + .262, .031, .07, .012, sym=ox), .0095, .003, 'c'),
                   (edge_band(below(hem15), .022), .004, .003, 'cloth'),
                   (lambda p, ctx: (pel.z - .012) - p.z, .0035, .002, 'cloth')])
