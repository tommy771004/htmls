# 上衣（short.md 的 T-02～T-15；T-01 寬版 T 在 wear.py 的 build_all）：wear.py 用 exec 載入，共用 shell 與它的切法
# 每件都是身體上衣區（＋袖子區、＋脖子的皮膚區）長出來的殼，用純量場切出領口、袖孔、長度與破洞（邊緣是平順的等值線），
# 口袋、領子、鈕扣、拉鍊是往外再推一層的貼片，插肩袖、假兩件的襯衫袖這類換色是 regions（沿邊界拆開頂點）


def armhole(F, xs, depth, jag=0.):
    """袖孔（無袖）：肩關節為中心的橢圓（x–z 平面），肩帶外緣在離中線 xs、往下挖到肩關節下 depth；jag 讓邊緣成鋸齒鬚邊"""
    ua = F.b('upperarm_l')
    cx, zc = ua.x - F.ox, ua.z
    rx = max(.02, cx - xs)
    def g(p, ctx):
        x = abs(p.x - F.ox)
        j = 1. + jag * math.sin(p.z * 520. + p.y * 300.) if jag else 1.
        if x >= cx:
            return p.z - (zc - depth * j)
        return (1. - math.hypot((x - cx) / (rx * j), (p.z - zc) / depth)) * depth   # 大約是公尺（滾邊的寬度才跟另一支一致）
    return g


def edge_band(g, w):
    """切口 g 往內 w 的一圈（≤ 0 在帶子裡）：滾邊、蕾絲、鬚邊"""
    return lambda p, ctx: -(g(p, ctx) + w)


def union(*gs):
    return lambda p, ctx: max(f(p, ctx) for f in gs)


def inside(g):
    """g 切掉的那一側（換色用：袖孔外是襯衫袖）"""
    return lambda p, ctx: -g(p, ctx)


def ball_f(c, r):
    c = Vector(c)
    return lambda p, ctx: (p - c).length - r


def sym_ball(F, c, r):
    """左右各一顆的球形範圍（c 是左邊的世界座標）"""
    def f(p, ctx):
        q = Vector((F.ox + abs(p.x - F.ox), p.y, p.z))
        return (q - Vector(c)).length - r
    return f


def stroke(pts, w):
    """折線（x, z）在前片的範圍：閃電標誌這種貼布"""
    def f(p, ctx):
        if p.y > -.04:
            return 1.
        d = 9.
        for (ax, az), (bx, bz) in zip(pts, pts[1:]):
            px, pz, dx, dz = p.x - ax, p.z - az, bx - ax, bz - az
            t = max(0., min(1., (px * dx + pz * dz) / (dx * dx + dz * dz)))
            d = min(d, math.hypot(px - dx * t, pz - dz * t))
        return d - w
    return f


def buttons(F, zs, y=-.1, s=.0055, x=0.):
    """前襟一排鈕扣（每顆一個小方塊範圍）"""
    def f(p, ctx):
        if p.y > -.03:
            return 1.
        return min(max(abs(p.x - F.ox - x) / s, abs(p.z - z) / s) for z in zs) - 1.
    return f


def build_tops(F, g):
    ox, M = F.ox, g == 'Male'
    pel, sp1, sp2, sp3, nk = F.b('pelvis'), F.b('spine_01'), F.b('spine_02'), F.b('spine_03'), F.b('neck_01')
    ua, la, hd = F.b('upperarm_l'), F.b('lowerarm_l'), F.b('hand_l')
    waist = pel.z + (.075 if M else .085)
    cx = ua.x - ox
    ax = lambda p: abs(p.x - ox)
    on_arm = lambda p, k=.02: max(0., min(1., (ax(p) - cx + k) / .05))     # 0 身體 → 1 手臂
    along = lambda p: max(0., min(1., (ax(p) - cx) / (hd.x - ox - cx)))  # 沿手臂 0 肩 → 1 手腕
    scoop = lambda D, B=.0: (lambda a: .004 + D * max(0., math.cos(a)) ** 2 + B * max(0., -math.cos(a)) ** 2)
    vneck = lambda D, W: (lambda a: .004 + D * max(0., 1 - abs(a) / W) ** 1.15)
    S = lambda name: f'W_{name}_{g}'

    # T-02 Y2K 露臍小可愛：貼身削肩、長度到肋骨下緣、下擺微弧，胸前蝴蝶水鑽
    hem2 = sp2.z + (.06 if M else .07)
    shell(F, S('crop_cami'), ['top'], off=lambda p: .006, smooth=4, rim=.004,
          fields=[neckline(scoop(.07, .03)), armhole(F, .085 if M else .08, .12),
                  below(lambda p: hem2 - .018 * (1 - min(1., (ax(p) / .14) ** 2)))])

    # T-03 古巴領夏威夷襯衫：深 V 開襟、往外攤的領片、寬鬆短袖、下擺兩側開衩，前襟兩顆釦
    hem3 = pel.z - .015
    hv3 = vneck(.17, .62)
    shell(F, S('cuban'), ['top', 'sleeve'], off=lambda p: .016 + .008 * on_arm(p) + .006 * max(0., min(1., (sp3.z - p.z) / .3)), smooth=6, rim=.007,
          fields=[neckline(hv3), arm_cut(F, .5), below(hem3),
                  holes([((ox + s * .17, .0, hem3), (.012, .3, .055)) for s in (-1, 1)])],
          patches=[(edge_band(neckline(hv3), .032), .004, .003, 'cloth'),
                   (buttons(F, [nk.z - .25, nk.z - .36]), .002, .001, 'pearl')])

    # T-04 機能戰術高領衫：拉鍊半高領、手臂立體口袋與魔鬼氈章、肩膀與手肘蜂巢紋拼接
    sh4 = Vector((ox + cx - .01, ua.y - .01, ua.z + .05))
    shell(F, S('tac_mock'), ['top', 'sleeve', 'skin'], off=lambda p: .006 + .002 * on_arm(p), smooth=5, rim=.005,
          fields=[collar_up(.05), arm_cut(F, .96, 'lowerarm', 'hand'), below(pel.z - .03)],
          regions=[(sym_ball(F, sh4, .075), 'hex'), (sym_ball(F, la, .05), 'hex')],
          patches=[(box(ox, -.1, nk.z - .02, .0045, .06, .1), .002, .001, 'silver'),
                   (box(cx + .1, ua.y - .045, ua.z, .04, .03, .04, sym=ox), .006, .003, 'cloth'),
                   (box(cx + .1, ua.y - .05, ua.z + .014, .025, .03, .012, sym=ox), .0085, .002, 'b')])

    # T-05 紅黑格紋法蘭絨：男生紮進褲頭（下擺在腰線）、女生下擺在前面打結；袖子挽到前臂、翻領、珍珠白鈕扣
    hem5 = waist - .01 if M else waist + .03
    cuff5 = arm_cut(F, .45, 'lowerarm', 'hand')
    pt5 = [(edge_band(cuff5, .03), .007, .004, 'cloth'), (near_neck(.03), .005, .004, 'cloth'),
           (buttons(F, [nk.z - k * .085 for k in range(1, 6) if nk.z - k * .085 > hem5 + .03]), .002, .001, 'pearl')]
    if not M:
        pt5.append((box(ox, -.12, hem5 + .03, .045, .06, .032), .012, .004, 'cloth'))      # 下擺打的結
    shell(F, S('flannel'), ['top', 'sleeve'], off=lambda p: .011 + .004 * on_arm(p), smooth=6, rim=.007,
          fields=[neckline(scoop(.02)), cuff5, below(hem5)], patches=pt5)

    # T-06 網紗高領長袖：第二層肌膚（4.5 mm）、長袖蓋到手背、半透明（網孔裡的皮膚是 CHAR_FS 畫的，底下的身體照樣藏）
    shell(F, S('sheer_mock'), ['top', 'sleeve', 'skin'], off=lambda p: .0045, smooth=3, rim=.002,
          fields=[collar_up(.065), arm_cut(F, 1.38, 'lowerarm', 'hand'), below(waist - .03)])

    # T-07 無袖籃球球衣：寬大的袖孔、雙層滾邊 V 領、加長下擺；胸前號碼是 CHAR_FS 畫的（num）
    hv7 = vneck(.1, .55)
    ah7 = armhole(F, .1 if M else .09, .14)
    shell(F, S('jersey'), ['top'], off=lambda p: .013 + .006 * max(0., min(1., (sp3.z - p.z) / .3)), smooth=6, rim=.006,
          fields=[neckline(hv7), ah7, below(pel.z - .06)],
          patches=[(edge_band(neckline(hv7), .018), .0025, .002, 'c'), (edge_band(ah7, .016), .0025, .002, 'c')])

    # T-08 單肩緞面緊身衣：左肩寬帶、右肩斜到腋下裸露，腰側放射狀抓皺與金屬環
    zl, xr0 = nk.z - .035, .07
    def diag(p, ctx):
        x = p.x - ox
        if x > xr0:
            return -1.
        return p.z - (zl - (xr0 - x) * (.85 if M else .9))
    gat = Vector((ox + .12, -.06, waist + .06))
    def off8(p):
        d = math.hypot(p.x - gat.x, p.z - gat.z)
        a = math.atan2(p.z - gat.z, p.x - gat.x)
        return .006 + .0045 * max(0., math.sin(a * 11.)) * max(0., 1 - d / .2) * (1 if p.y < .02 else .3)
    ah8 = armhole(F, .12, .1)
    shell(F, S('one_shoulder'), ['top'], off=off8, smooth=4, rim=.004, part='gloss',
          fields=[union(diag, lambda p, ctx: ah8(p, ctx) if p.x > ox else -1.), neckline(lambda a: .004),
                  below(pel.z - .02)],
          patches=[(ball_f(gat + Vector((0, -.03, 0)), .02), .006, .003, 'gold')])

    # T-09 龐克破壞背心：寬肩無袖、下擺與側腰不規則的撕裂破洞、鋸齒的毛邊下擺，胸前閃電樂團標誌
    rips = [((ox + .07, -.1, pel.z + .03), (.03, .2, .018)), ((ox - .05, -.1, pel.z + .09), (.022, .2, .014)), ((ox + .16, .0, waist + .05), (.02, .25, .03)),
            ((ox - .15, .02, pel.z + .02), (.018, .25, .025)), ((ox + .02, .12, pel.z + .06), (.035, .2, .016))]
    bolt = [(ox - .03, sp3.z + .07), (ox + .015, sp3.z + .02), (ox - .012, sp3.z + .015), (ox + .03, sp3.z - .045)]
    shell(F, S('punk_tank'), ['top'], off=lambda p: .011 + .006 * max(0., min(1., (sp3.z - p.z) / .3)), smooth=5, rim=.005,
          fields=[neckline(scoop(.03)), armhole(F, .13 if M else .115, .1), below(lambda p: pel.z - .02 + .008 * math.sin(p.x * 140.) + .005 * math.sin(p.x * 330.)),
                  holes(rips)],
          patches=[(stroke(bolt, .009), .0015, .001, 'c')])

    # T-10 學院麻花毛衣背心：V 領無袖針織（假兩件：袖孔外是白襯衫的短袖、V 領裡是襯衫前片與領子），領口與下擺綠白學院條紋
    hv10 = neckline(vneck(.15, .6))
    ah10 = armhole(F, .14 if M else .125, .12)
    shell(F, S('vest_shirt'), ['top'], off=lambda p: .009 + .005 * on_arm(p), smooth=5, rim=.006,
          fields=[neckline(lambda a: .004)],
          regions=[(inside(ah10), 'c'), (lambda p, ctx: max(hv10(p, ctx), -(hv10(p, ctx) + .014)), 'b'), (inside(hv10), 'c'),
                   (lambda p, ctx: p.z - (waist + .035), 'b')],
          patches=[(near_neck(.028), .004, .004, 'c')])

    # T-11 拉鍊連帽短版運動上衣：立領、長袖修身、衣長到肚臍上方、正中拉鍊、帽子垂在背後；胸線腰線的塑形暗紋
    shell(F, S('crop_zip'), ['top', 'sleeve', 'skin'], off=lambda p: .006 + .001 * on_arm(p), smooth=5, rim=.004,
          fields=[collar_up(.035), arm_cut(F, .97, 'lowerarm', 'hand'), below(sp1.z + .035)],
          patches=[(box(ox, -.1, (nk.z + sp1.z) / 2, .0035, .06, (nk.z - sp1.z) / 2 + .05), .0022, .001, 'silver'),
                   (box(ox, nk.y + .1, nk.z - .06, .1, .06, .065), .022, .006, 'cloth')])

    # T-12 滿版老花真絲襯衫：尖領、開兩顆金釦的領口、長袖收窄的袖口、圓弧下擺
    cuf12 = arm_cut(F, .94, 'lowerarm', 'hand')
    shell(F, S('silk_shirt'), ['top', 'sleeve'], off=lambda p: .01 + .004 * on_arm(p) * (1 - along(p) ** 3) - .003 * along(p) ** 6, smooth=6, rim=.006,
          fields=[neckline(vneck(.075, .5)), cuf12, below(lambda p: pel.z - .03 + .03 * min(1., (ax(p) / .16) ** 2))],
          patches=[(near_neck(.03), .005, .004, 'cloth'), (edge_band(cuf12, .04), .003, .002, 'cloth'),
                   (buttons(F, [nk.z - .17 - k * .085 for k in range(5)]), .002, .001, 'gold'),
                   (box(.055, -.12, nk.z - .06, .02, .05, .025, sym=ox), .005, .004, 'cloth')])

    # T-13 拉格蘭棒球衫：七分插肩袖（斜向從領口到腋下的換色）、圓弧微翹下擺、胸前復古號碼（num）
    zpit = ua.z - .1
    def raglan(p, ctx):
        if p.z < zpit:
            return 1.
        t = (p.z - zpit) / (nk.z - .02 - zpit)
        return (cx - .035) + (.06 - (cx - .035)) * t - ax(p)
    shell(F, S('raglan'), ['top', 'sleeve'], off=lambda p: .01 + .004 * on_arm(p), smooth=6, rim=.006,
          fields=[neckline(scoop(.012)), arm_cut(F, .45, 'lowerarm', 'hand'), below(lambda p: waist - .05 + .045 * min(1., (ax(p) / .17) ** 2))],
          regions=[(raglan, 'b')], patches=[(near_neck(.016), .0025, .002, 'b')])

    # T-14 哥德馬甲露肩宮廷衫：一字領露肩、白蕾絲泡泡袖（荷葉邊）、黑絲絨馬甲身（魚骨、正面交叉綁帶與雞眼是 corset 圖案）
    zb = ua.z - (.065 if M else .06)
    def bardot(p, ctx):
        x = ax(p)
        if x < cx:
            return p.z - zb
        return (cx + .035) - x
    sl14 = arm_cut(F, .55)
    shell(F, S('gothic'), ['top', 'sleeve'], off=lambda p: .006 + .02 * on_arm(p, 0.) * math.sin(math.pi * min(1., along(p) / .45)), smooth=5, rim=.004,
          fields=[bardot, sl14, below(pel.z + .02)],
          regions=[(lambda p, ctx: (cx + .01) - ax(p), 'mesh')],
          patches=[(edge_band(bardot, .022), .005, .004, 'mesh'), (edge_band(sl14, .025), .006, .004, 'mesh')])

    # T-15 重機切袖牛仔襯衫：剪掉雙袖（肩線留白色鬚邊）、翻領、前襟銀釦、胸前兩個有蓋口袋；背後老鷹火焰刺繡（num 100）
    ah15 = armhole(F, .15 if M else .13, .1, jag=.06)
    shell(F, S('denim_cutoff'), ['top'], off=lambda p: .012 + .006 * max(0., min(1., (sp3.z - p.z) / .3)), smooth=5, rim=.006,
          fields=[neckline(scoop(.02)), ah15, below(pel.z - .01)],
          regions=[(edge_band(ah15, .014), 'b')],
          patches=[(near_neck(.03), .005, .004, 'cloth'), (buttons(F, [nk.z - k * .09 for k in range(1, 6)]), .002, .001, 'silver'),
                   (box(.075, -.12, sp3.z + .07, .035, .06, .04, sym=ox), .004, .003, 'cloth'),
                   (box(.075, -.12, sp3.z + .105, .036, .06, .012, sym=ox), .0065, .002, 'cloth')])
