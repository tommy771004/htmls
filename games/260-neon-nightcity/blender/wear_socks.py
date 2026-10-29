# 襪子（short.md 的 K-01～K-15）：wear.py 用 exec 載入（排在 wear_jackets.py 之後，用褲子的 leg_y／above、上衣的 edge_band）
# 襪子是第 1 層：身體小腿區（過膝的再加褲子區）長出來的殼，只推 0.8～2.5 mm；cov=2，殼照退回皮膚的腿做。
# 腳掌不做（鞋子蓋著；short.md 的「下半部腳掌網格自動隱藏」），襪口下緣就是小腿區和鞋子的交界，那圈是 people.py 的鞋口滾邊（鼓出 1.15 cm），
# 用 shell 的 collar 往內收，襪子塞進鞋口。小腿區的邊長 3 cm，堆堆襪的皺褶、綁帶這些要細分（sub）。
# 長褲穿在外面時，被褲管蓋住的襪子三角形由 40-people.js 的 wearUnder 丟掉（堆堆襪、護脛、毛口才不會穿出窄管褲）。
# 圖案多半在 CHAR_FS（WEAR_PAT 60 以後）：繞著腿的角度 legA 和 leg_a 同一套（0 外側、π/2 正面、-π/2 後面，接縫在內側）。


def leg_a(F, p):
    """p 繞著那條腿的角度：0 外側、π/2 正面、-π/2 後面、±π 內側（接縫藏在兩腿之間）"""
    lx = F.b('thigh_l').x - F.ox
    return math.atan2(-(p.y - leg_y(p.z)), abs(p.x - F.ox) - lx)


def leg_out(F, p):
    """p 離開腿中心的水平方向（皺褶、護脛往外推用；腿接近圓柱，比身體面的法線平順）"""
    lx = F.b('thigh_l').x - F.ox
    s = 1. if p.x >= F.ox else -1.
    d = Vector((p.x - (F.ox + s * lx), p.y - leg_y(p.z), 0.))
    return d.normalized() if d.length > 1e-6 else Vector((s, 0., 0.))


def band_top(top, w):
    """襪口往下 w 的一圈（≤ 0 在帶子裡）：羅紋、反摺、蕾絲邊；top 可以是 top(p)"""
    return lambda p, ctx: ((top(p) if callable(top) else top) - w) - p.z


def build_socks(F, g):
    ox, M = F.ox, g == 'Male'
    pel, th, kn, an = F.b('pelvis'), F.b('thigh_l'), F.b('calf_l'), F.b('foot_l')
    lx = th.x - ox
    S = lambda name: f'W_{name}_{g}'
    zb = an.z + (.047 if M else .049)        # 小腿區的下緣（鞋口）
    CL = .0095                               # 襪口塞進鞋口的量（鞋口滾邊 1.15 cm − 襪子 2 mm）
    sock = lambda name, slots, **k: shell(F, S(name), slots, collar=CL, **k)

    # K-01 美式雙槓運動中筒襪：小腿肚下緣、上半段立體羅紋（紅藍雙槓是 CHAR_FS 的 sockstripe）、毛巾底稍厚
    top1 = an.z + .21
    sock('crew_stripe', ['shin'], off=lambda p: .0018, smooth=3, rim=.002, sub=1,
         fields=[above(top1)],
         patches=[(band_top(top1, .055), .0012, .001, 'cloth')])

    # K-02 原宿泡泡堆堆襪：膝下一路堆到腳踝的橫向厚皺褶（越往下越厚，最下面 4 cm 收一點才不會蓋住鞋口），上緣 4 cm 羅紋
    top2 = kn.z - .04
    def ruffle2(bm, trim, ctx):
        for v in bm.verts:
            p = v.co
            if p.z > top2 - .042 or p.z < zb - .004:
                continue
            t = max(0., min(1., (top2 - .042 - p.z) / (top2 - .042 - zb)))
            a = leg_a(F, p)
            wav = .5 + .5 * math.cos((p.z - zb) / .038 * 2 * math.pi + .9 * math.sin(a * 2. + 1.) + .5 * math.sin(a * 3.7))
            low = max(0., min(1., (p.z - zb) / .04))
            v.co += leg_out(F, p) * (.0035 + .013 * t ** .55 * wav ** 1.5) * (.35 + .65 * low) * min(1., (top2 - .042 - p.z) / .02)
    sock('slouch', ['shin'], off=lambda p: .004, smooth=4, rim=.003, sub=2,
         fields=[above(top2)], extra=ruffle2,
         patches=[(band_top(top2, .042), .0014, .001, 'cloth')])

    # K-03 哥德大網眼破洞漁網連褲襪：腰到腳踝、大腿與膝蓋前面不規則的撕裂大洞（網眼是 CHAR_FS 的 fishnet，孔裡畫皮膚），黑色腰頭
    rips3 = [((ox + .1, -.085, th.z - .17), (.03, .045, .045)), ((ox + .12, -.08, th.z - .205), (.022, .045, .028)),
             ((ox + .085, -.078, th.z - .24), (.016, .045, .02)), ((ox - .115, -.078, th.z - .28), (.026, .045, .05)),
             ((ox - .1, -.07, th.z - .32), (.018, .045, .024)), ((ox + .118, -.045, kn.z + .005), (.03, .045, .034)),
             ((ox - .108, -.045, kn.z - .015), (.022, .045, .026)), ((ox + .132, .085, th.z - .3), (.02, .04, .03))]
    sock('fishnet', ['bottom', 'shin'], off=lambda p: .0012, smooth=3, rim=.0015,
         fields=[above(pel.z + .04), holes(rips3)],
         patches=[(band_top(pel.z + .04, .016), .0015, .001, 'b')])

    # K-04 學院風過膝三槓大腿襪：大腿中段、頂端 4 cm 防滑羅紋束口，底下三道白色織帶（regions）
    top4 = kn.z + .17
    sock('over_knee', ['bottom', 'shin'], off=lambda p: .0014 + .0008 * max(0., min(1., (p.z - (top4 - .06)) / .06)), smooth=6, rim=.002, sub=1,
         fields=[above(top4)],
         regions=[(lambda p, ctx, d=d: abs(p.z - (top4 - d)) - .0035, 'c') for d in (.05, .063, .076)],
         patches=[(band_top(top4, .04), .0015, .001, 'cloth')])

    # K-05 西岸滑板火焰長襪：小腿中上段、緊身包小腿肚（加密一輪），火焰緹花在 CHAR_FS 的 flame
    top5 = an.z + .3
    sock('skate_flame', ['shin'], off=lambda p: .0016, smooth=3, rim=.002, sub=1,
         fields=[above(top5)],
         patches=[(band_top(top5, .035), .0012, .001, 'cloth')])

    # K-06 甜酷蕾絲蝴蝶結白絲過膝襪：大腿中段、波浪花邊的襪口（一圈 9 個弧），兩腿外側各一個黑緞蝴蝶結（綁在大腿表面）
    top6 = kn.z + .2
    t6 = lambda p: top6 + .007 * abs(math.sin(leg_a(F, p) * 4.5))
    def bows6(bm, trim, ctx):
        tree = _body_bvh(F)[0]
        z = top6 - .05
        with _part(bm, trim, 'gloss'):
            for s in (-1, 1):
                hit = tree.ray_cast(Vector((ox + s * (lx + .3), leg_y(z), z)), Vector((-s, 0, 0)), .5)
                if hit[0] is None:
                    continue
                c = hit[0] + Vector((s * .006, 0, 0))
                ball(bm, c, .0055, s=(.7, 1., 1.))
                for k in (-1, 1):
                    # 兩邊的耳：躺平貼著大腿的扁環（環軸朝外），往前後斜上
                    ring(bm, c + Vector((0., k * .016, .005)), .011, .0028, rot=(math.pi / 2 + k * .5, 0., math.pi / 2), seg=16, sseg=6)
                    tube(bm, [tuple(c), tuple(c + Vector((s * .001, k * .007, -.02))), tuple(c + Vector((0., k * .012, -.042)))], .0024, seg=6)
    sock('lace_bow', ['bottom', 'shin'], off=lambda p: .0013, smooth=6, rim=.0015, sub=1,
         fields=[above(t6)], extra=bows6,
         patches=[(band_top(t6, .03), .0013, .001, 'cloth')])

    # K-07 機能壓縮船型短襪：只露出鞋口上 2.4 cm、後跟往上加厚的凸耳（第二色），X 型支撐暗紋在 CHAR_FS 的 compress
    back = lambda p: max(0., -math.sin(leg_a(F, p)))
    t7 = lambda p: zb + .024 + .024 * back(p) ** 6
    sock('ankle_tab', ['shin'], off=lambda p: .0015, smooth=2, rim=.0015, sub=1,
         fields=[above(t7)],
         patches=[(lambda p, ctx: .5 - back(p) ** 6 if p.z > zb + .012 else 1., .0022, .0015, 'b')])

    # K-08 滿版老花黑絲連褲襪：腰到腳踝、只推 0.8 mm（像第二層皮膚），黑色腰頭；大腿根的蕾絲暗邊與老花在 CHAR_FS 的 monosheer
    sock('sheer_mono', ['bottom', 'shin'], off=lambda p: .0008, smooth=3, rim=.001,
         fields=[above(pel.z + .045)],
         patches=[(band_top(pel.z + .045, .022), .0012, .0008, 'b')])

    # K-09 菱格紋紳士長襪：膝下 7 cm、細平針（菱格與金線在 CHAR_FS 的 argyle），上緣 3 cm 羅紋
    top9 = kn.z - .07
    sock('argyle', ['shin'], off=lambda p: .0012, smooth=3, rim=.0015, sub=1,
         fields=[above(top9)],
         patches=[(band_top(top9, .03), .001, .0008, 'cloth')])

    # K-10 賽博反光小腿護腿套：腳踝上 6.5 cm 到膝下 4 cm、沒有腳掌，上下兩圈羅紋（第二色）；反光刻度與字樣在 CHAR_FS 的 reflect
    top10, bot10 = kn.z - .04, an.z + .065
    shell(F, S('calf_sleeve'), ['shin'], off=lambda p: .0022, smooth=3, rim=.002, sub=1,
          fields=[above(top10), below(bot10)],
          patches=[(band_top(top10, .025), .0012, .001, 'b'), (lambda p, ctx: p.z - (bot10 + .022), .0012, .001, 'b')])

    # K-11 紮染漩渦滑板襪：小腿中段、厚棉羅紋（左右腳的漩渦不一樣，CHAR_FS 的 tiedye）
    top11 = an.z + .27
    sock('tiedye', ['shin'], off=lambda p: .002, smooth=3, rim=.002, sub=1,
         fields=[above(top11)],
         patches=[(band_top(top11, .035), .0012, .001, 'cloth')])

    # K-12 龐克不對稱橫條紋長襪：左腳（+x）過膝、右腳到小腿肚，右邊襪口抽絲（襪口邊緣不平）；寬橫條紋在 CHAR_FS 的 bwstripe
    def t12(p):
        if p.x >= ox:
            return kn.z + .12
        return an.z + .25 + .0035 * math.sin(leg_a(F, p) * 23.) + .0025 * math.sin(leg_a(F, p) * 41. + 1.)
    sock('asym_stripe', ['bottom', 'shin'], off=lambda p: .0013, smooth=3, rim=.0015, sub=1,
         fields=[above(t12)],
         patches=[(band_top(t12, .025), .0012, .001, 'cloth')])

    # K-13 條紋足球長筒襪：膝下 3 cm、往下反摺 7 cm 的厚襪口（金白條紋在 CHAR_FS 的 soccer），小腿前側內藏護脛板的隆起
    top13 = kn.z - .03
    def off13(p):
        a = leg_a(F, p)
        fr = max(0., math.sin(a)) ** 2.5 * math.exp(-((p.z - (an.z + .25)) / .12) ** 2)
        return .0018 + .0065 * fr
    sock('soccer', ['shin'], off=off13, smooth=4, rim=.002, sub=1,
         fields=[above(top13)],
         patches=[(band_top(top13, .07), .003, .002, 'cloth')])

    # K-14 芭蕾綁帶小腿襪：小腿肚長度的細羅紋，兩條緞帶從腳踝反方向螺旋往上交叉（一片貼片，交叉處不疊兩層），正面上緣打結垂下兩段
    top14 = an.z + .26
    def strap14(p, ctx):
        if p.z > top14 - .012 or p.z < zb + .012:
            return 1.
        u = leg_a(F, p) / (2 * math.pi)
        h = (p.z - zb) / .11
        return min(abs(((u + h) % 1.) - .5), abs(((-u + h) % 1.) - .5)) * 2. - .1
    def knot14(bm, trim, ctx):
        tree = _body_bvh(F)[0]
        z = top14 - .02
        with _part(bm, trim, 'gloss'):
            for s in (-1, 1):
                x = ox + s * lx
                hit = tree.ray_cast(Vector((x, -.5, z)), Vector((0, 1, 0)), 1.)
                if hit[0] is None:
                    continue
                c = hit[0] + Vector((0, -.004, 0))
                ball(bm, c, .005, s=(1.2, .7, 1.))
                for k in (-1, 1):
                    tube(bm, [tuple(c), tuple(c + Vector((k * .006, -.002, -.018))), tuple(c + Vector((k * .01, -.0005, -.04)))], .0022, seg=6)
    sock('ballet_wrap', ['shin'], off=lambda p: .0013, smooth=3, rim=.0015, sub=1,
         fields=[above(top14)], extra=knot14,
         patches=[(strap14, .0016, .001, 'gloss'), (band_top(top14, .012), .001, .0008, 'cloth')])

    # K-15 豹紋珊瑚絨半筒襪：小腿下段、厚絨（推 2.5 mm），襪口外翻一圈 3 cm 的蓬鬆短毛（部位 fleece，第三色），蓋得到短靴的靴口
    top15 = an.z + .14
    sock('leopard_fuzz', ['shin'], off=lambda p: .0025, smooth=3, rim=.0025, sub=1,
         fields=[above(top15)],
         patches=[(band_top(top15, .03), .0035, .0025, 'fleece')])
