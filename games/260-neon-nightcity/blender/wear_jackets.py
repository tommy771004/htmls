# 外套（short.md 的 J-01～J-15）：wear.py 用 exec 載入（排在 wear_skirts.py 之後，用上衣的 armhole／edge_band／buttons／stroke、裙子的 Loft）
# 外套是第 3 層：身體上衣區＋袖子區（＋脖子、手腕的皮膚區）長出來的殼，推得比上衣遠（1.4～4.5 cm）；cov=1，穿上時身體原本的上衣退回皮膚。
# 底下的上衣、褲頭被外套蓋住的三角形由 40-people.js 的 wearUnder 整個丟掉，所以上衣再寬也不會穿出來；外套底下的身體只藏軀幹與手臂。
# 長大衣（J-06、J-13、J-15）＝腰以上的殼＋腰以下照裙子放樣的衣襬（權重往下換成左右大腿，跨步時衣襬跟著腿分開）；
# 殼在腰線附近推到衣襬的放樣面上，兩段接得起來。帽子是放下來的兜帽（extra 的立體件，權重照身體表面取）。


def jopen(F, ztop, zbot=-9., w=.012, wtop=None):
    """前襟的開口（> 0 切掉）：正面中線左右 w（往上漸寬到 wtop），從 zbot 到 ztop"""
    sy = F.b('spine_03').y
    wt = w if wtop is None else wtop
    def g(p, ctx):
        t = max(0., min(1., (p.z - zbot) / max(1e-6, ztop - zbot))) if zbot > -8 else 1.
        return min((w + (wt - w) * t) - abs(p.x - F.ox), ztop - p.z, p.z - zbot, sy - .03 - p.y)
    return g


def ring_above(dz=0.):
    """領口那圈往上 dz 以上（≤ 0 在裡面）：立領、羅紋領"""
    def f(p, ctx):
        z, r, d = _ring(ctx)(p)
        return (z + dz) - p.z if d < r + .06 else 1.
    return f


def zrange(z0, z1):
    return lambda p, ctx: max(z0 - p.z, p.z - z1)


def front(F, f):
    """只在正面（-Y 那一半）"""
    sy = F.b('spine_03').y
    return lambda p, ctx: f(p, ctx) if p.y < sy - .02 else 1.


def back(F, f):
    sy = F.b('spine_03').y
    return lambda p, ctx: f(p, ctx) if p.y > sy + .02 else 1.


def on_arm_f(F, k=.015):
    """手臂（從肩關節往外 k 開始；≤ 0 在手臂上）：插肩袖、拼色袖"""
    cx = F.b('upperarm_l').x - F.ox
    return lambda p, ctx: (cx - k) - abs(p.x - F.ox)


def _ray_r(F, cx, cy, a, z):
    """從脖子的中軸往角度 a 射到身體表面（退回皮膚的）的距離"""
    tree = _body_bvh(F)[0]
    hit = tree.ray_cast(Vector((cx, cy, z)), Vector((math.sin(a), -math.cos(a), 0.)), .45)
    return hit[3] if hit[0] is not None else .09


def hood_down(F, bm, trim, ctx, depth=.15, puff=.035, off=.02, span=1.95, th=.005, part=0, nu=26, nv=9):
    """放下來的兜帽：從領口那圈往後翻、垂在上背的一圈枕頭狀的布（外層＋往內 th 的內層，邊緣封起來）；
    兩端在脖子兩側收細，後中最深最鼓。每一點先照角度與深度在脖子外面取一個參考點，找身體表面最近的點、沿那裡的法線推出去
    （肩膀上面是平的，從脖子中軸水平射出去會打到很遠的肩頭，兜帽的兩端就飛出去）。權重照身體表面取（脖子與上背）"""
    R = _ring(ctx)
    tree = _body_bvh(F)[0]
    cx, cy = R.cx, R.cy
    out, inn = [], []
    for i in range(nu + 1):
        a = math.pi - span + 2 * span * i / nu
        k = math.cos((a - math.pi) / span * math.pi / 2)
        z0, r0, _ = R(Vector((cx + math.sin(a), cy - math.cos(a), 0.)))
        ro, ri = [], []
        for j in range(nv + 1):
            s = j / nv
            z = z0 + .012 - depth * (.2 + .8 * k) * s * s
            rr = r0 + .045 * s
            loc, nrm, _, _ = tree.find_nearest(Vector((cx + math.sin(a) * rr, cy - math.cos(a) * rr, z)))
            h = off + puff * (.3 + .7 * k) * math.sin(math.pi * s) ** .8
            ro.append(bm.verts.new(loc + nrm * h))
            ri.append(bm.verts.new(loc + nrm * max(off - .002, h - th)))
        out.append(ro)
        inn.append(ri)
    fs = []
    for i in range(nu):
        for j in range(nv):
            fs.append(bm.faces.new((out[i][j], out[i][j + 1], out[i + 1][j + 1], out[i + 1][j])))
            fs.append(bm.faces.new((inn[i][j], inn[i + 1][j], inn[i + 1][j + 1], inn[i][j + 1])))
    for i in range(nu):   # 垂在背上的那一緣
        fs.append(bm.faces.new((out[i][nv], inn[i][nv], inn[i + 1][nv], out[i + 1][nv])))
    for i, sg in ((0, 1), (nu, -1)):   # 兩端
        for j in range(nv):
            q = (out[i][j], inn[i][j], inn[i][j + 1], out[i][j + 1])
            fs.append(bm.faces.new(q if sg > 0 else q[::-1]))
    # 面的方向照頂點順序：外層朝外、內層朝身體、背上那一緣朝下、兩端朝外（不用 recalc：兩層開口的網格算不準）
    pt = PART[part] if isinstance(part, str) else part
    for row in out + inn:
        for v in row:
            v[trim] = pt
    bmesh.ops.triangulate(bm, faces=fs)
    return R


def cords(F, bm, trim, ctx, a0=.32, L=.2, off=.02, r=.0028, part='c', tip='silver', z0=None):
    """兜帽的抽繩：從領口兩側沿胸口垂下 L，末端的金屬頭"""
    R = _ring(ctx)
    cx, cy = R.cx, R.cy
    for sg in (1, -1):
        a = a0 * sg
        zt = (R(Vector((cx + math.sin(a), cy - math.cos(a), 0.)))[0] if z0 is None else z0) + .005
        pts = []
        for k in range(9):
            z = zt - L * k / 8
            rr = _ray_r(F, cx, cy, a, z) + off + r
            pts.append((cx + math.sin(a) * rr, cy - math.cos(a) * rr, z))
        with _part(bm, trim, part):
            tube(bm, pts, r, seg=6)
        with _part(bm, trim, tip):
            p = Vector(pts[-1])
            cyl(bm, (p.x, p.y, p.z - .008), r * 1.25, r * 1.1, .016, seg=8)


def coat_(F, name, slots, off, lofts, fields=(), patches=(), regions=(), extra=None, cov=None, smooth=6, rim=.007):
    """長大衣（build_jackets 裡的 coat 包上腋下的收量）：shell 的上半身＋lofts 的衣襬（同 skirt：extra 先加在殼上取身體的權重，衣襬自己帶權重）"""
    def merge(bm, trim, ctx):
        if extra:
            extra(bm, trim, ctx)
        old = set(bm.verts)
        for L in lofts:
            _append(bm, _loft_bm(F, L, ctx))
        return {v for v in bm.verts if v not in old}
    return shell(F, name, list(slots), off=off, smooth=smooth, rim=rim, fields=fields, patches=patches, regions=regions, extra=merge, cov=cov)


def to_hull(F, base, zt, clear, inset=.003, band=.06):
    """殼的推出量：腰線 zt 往上 band 以內漸漸推到衣襬放樣的那個面（截面凸包 + clear - inset），接縫才對得起來"""
    K = _sk(F)
    def off(p):
        b = base(p)
        w = _smooth(zt + band, zt, p.z)
        if w <= 0.:
            return b
        a = K.ang(p)
        d = math.hypot(p.x - K.ox, p.y - K.cy)
        return b * (1 - w) + max(b, K.H(a, p.z) - d + clear - inset) * w
    return off


def build_jackets(F, g):
    ox, M = F.ox, g == 'Male'
    K = _sk(F)
    pel, sp1, sp2, sp3, nk = F.b('pelvis'), F.b('spine_01'), F.b('spine_02'), F.b('spine_03'), F.b('neck_01')
    ua, la, hd = F.b('upperarm_l'), F.b('lowerarm_l'), F.b('hand_l')
    kn = F.b('calf_l').z
    waist = pel.z + (.075 if M else .085)
    cx = ua.x - ox
    ax = lambda p: abs(p.x - ox)
    on_arm = lambda p, k=.02: max(0., min(1., (ax(p) - cx + k) / .05))
    along = lambda p: max(0., min(1., (ax(p) - cx) / (hd.x - ox - cx)))
    chest = lambda p: max(0., min(1., (sp3.z - p.z) / .3))
    S = lambda name: f'W_{name}_{g}'
    JS = ['top', 'sleeve', 'skin']
    cuff = lambda t=1.0: arm_cut(F, t, 'lowerarm', 'hand')
    shoulder = Vector((ox + cx - .01, ua.y - .005, ua.z + .045))
    elbow = Vector((la.x, la.y, la.z))
    # 腋下是凹的：推得比上衣遠的外套在那裡內外面會交疊（手臂放下時袖子底面插進側身，看得到外套裡面），腋窩 8 cm 內的推出量收掉一半
    pits = [Vector((ox + s * (cx - .02), ua.y, ua.z - .07)) for s in (1, -1)]
    def pit(f):
        return lambda p: f(p) * (1. - .55 * max(0., 1. - min((p - q).length for q in pits) / .08))
    shell_ = globals()['shell']   # 下面的 shell 是包上腋下收量的這一版（名字在函式裡變成區域變數）
    def shell(F, name, slots, off=lambda p: .008, **k):
        return shell_(F, name, slots, off=pit(off), **k)
    def coat(F, name, slots, off, lofts, **k):
        return coat_(F, name, slots, pit(off), lofts, **k)
    print('jacket marks', g, dict(cx=round(cx, 3), hem3=round(pel.z - .02, 3), pel=round(pel.z, 3), sp1=round(sp1.z, 3), sp2=round(sp2.z, 3), sp3=round(sp3.z, 3), nk=round(nk.z, 3), waist=round(waist, 3)))

    # J-01 霓城冠軍刺繡棒球夾克：落肩寬鬆、羅紋立領／袖口／下擺、正面按釦半開（領口開到胸口），
    # 森林綠羊毛衣身、奶油白皮袖（regions），胸前與背後的毛巾繡字母（CHAR_FS 的 varsity）
    hem1, c1 = waist - .02, cuff(.98)
    snaps1 = buttons(F, [nk.z - .2 - k * .075 for k in range(4) if nk.z - .2 - k * .075 > hem1 + .06], s=.0045)
    shell(F, S('varsity'), JS, off=lambda p: .017 + .005 * on_arm(p) + .006 * chest(p), smooth=6, rim=.007,
          fields=[collar_up(.022), jopen(F, nk.z + .1, nk.z - .17, .004, .03), c1, below(hem1)],
          regions=[(on_arm_f(F), 'c'), (ring_above(-.004), 'b')],
          patches=[(edge_band(c1, .05), .005, .003, 'b'), (edge_band(below(hem1), .055), .005, .003, 'b'),
                   (snaps1, .0025, .001, 'silver')])

    # J-02 斜拉鍊重機翻領皮衣：不對稱大翻領、斜拉鍊、肩章、腰帶與銀扣（做舊的黑皮革，CHAR_FS 的 leather）
    hem2 = waist - .045
    zip2 = stroke([(ox + .075, nk.z - .03), (ox + .03, nk.z - .2), (ox - .045, hem2)], .0035)
    # 翻領：左右各一片往上變寬的三角（右邊的比較寬，跟著斜拉鍊）
    lap2 = front(F, lambda p, ctx: max(abs(p.x - ox - (.06 if p.x > ox else -.05)) - (.028 + .06 * max(0., min(1., (p.z - (nk.z - .2)) / .17))),
                                       (nk.z - .2) - p.z, p.z - (nk.z - .02)))
    c2 = cuff(.97)
    belt2 = zrange(hem2 + .004, hem2 + .038)
    shell(F, S('rider'), JS, off=lambda p: .015 + .004 * on_arm(p) + .004 * chest(p), smooth=6, rim=.007,
          fields=[collar_up(.012), c2, below(hem2)],
          patches=[(lap2, .0045, .003, 'cloth'), (zip2, .0035, .0015, 'silver'),
                   (box(cx - .045, ua.y, ua.z + .06, .05, .05, .011, sym=ox), .004, .002, 'cloth'),
                   (box(cx - .085, ua.y - .01, ua.z + .063, .005, .02, .005, sym=ox), .0065, .001, 'silver'),
                   (belt2, .0045, .002, 'cloth'), (box(ox + .17 if M else ox + .155, -.0, hem2 + .021, .015, .2, .014), .007, .002, 'silver'),
                   (edge_band(c2, .04), .0025, .002, 'cloth'),
                   (stroke([(ox + cx + .23, la.z + .025), (ox + cx + .33, la.z + .025)], .0025), .004, .0015, 'silver')])

    # J-03 北境亮面寬版羽絨外套：高領＋放下來的兜帽、橫向的充絨格（推出量照高度起伏）、抽繩下擺、左臂的矽膠徽章
    hem3 = pel.z - .02
    def off3(p):
        q = abs(math.sin(math.pi * (p.z - hem3) / .1)) ** .5 if ax(p) < cx - .01 else abs(math.sin(math.pi * (ax(p) - cx) / .085)) ** .5
        return .026 + .026 * q + .005 * chest(p)
    c3 = cuff(.98)
    shell(F, S('puffer'), JS, off=off3, smooth=5, rim=.01,
          fields=[collar_up(.07), c3, below(hem3)],
          patches=[(edge_band(c3, .03), .003, .003, 'b'), (edge_band(below(hem3), .03), .004, .003, 'b'),
                   (front(F, lambda p, ctx: abs(p.x - ox) - .004), .004, .001, 'silver'),
                   (box(ox + cx + .09, ua.y - .045, ua.z - .005, .024, .03, .02), .006, .002, 'c')],
          extra=lambda bm, trim, ctx: (hood_down(F, bm, trim, ctx, depth=.14, puff=.05, off=.05, th=.008),
                                       cords(F, bm, trim, ctx, a0=.18, L=.12, off=.055, part='b', z0=None)))

    # J-04 賽博高領發光裝甲夾克：高聳立領（往上張開，離下巴 1.5 cm）、短版、雙肩外掛裝甲；碳纖維黑拼電光藍，立領邊與脊椎的霓虹燈條
    hem4 = waist + .015
    c4 = cuff(.96)
    def off4b(p):
        R = F._ring4
        z = R(p)[0]
        return .014 + .004 * on_arm(p) + .003 * chest(p) + .018 * max(0., min(1., (p.z - z) / .085)) ** 1.4
    if not getattr(F, '_ring4', None):
        # 領口的高度要在推出去之前就知道：先用身體上衣區與皮膚區的交界量一次（同 shell 裡的 neck）
        me = F.body.data
        mw = F.body.matrix_world
        bmn = bmesh.new()
        bmn.from_mesh(me)
        bmesh.ops.remove_doubles(bmn, verts=bmn.verts, dist=1e-4)
        bmn.transform(mw)
        F._ring4 = neck_ring([v.co.copy() for v in bmn.verts if v.co.z > nk.z - .08 and abs(v.co.x - ox) < .13
                              and {f.material_index for f in v.link_faces} >= {SLOT['skin'], SLOT['top']}])
        bmn.free()
    shell(F, S('cyber_armor'), JS, off=off4b, smooth=6, rim=.006,
          fields=[collar_up(.085), c4, below(hem4)],
          regions=[(lambda p, ctx: (cx + .04) - ax(p) if p.z < ua.z + .03 else 1., 'c')],
          patches=[(sym_ball(F, shoulder + Vector((.01, 0, .01)), .085), .013, .006, 'gloss'),
                   (sym_ball(F, shoulder + Vector((.075, 0, -.005)), .05), .02, .005, 'gloss'),
                   (edge_band(collar_up(.085), .006), .0025, .001, 'glow'),
                   (back(F, lambda p, ctx: max(abs(p.x - ox) - .0045, (hem4 + .02) - p.z, p.z - (nk.z - .02))), .003, .001, 'glow'),
                   (front(F, lambda p, ctx: abs(p.x - ox - .02) - .003), .0035, .001, 'silver'),
                   (edge_band(below(hem4), .03), .004, .002, 'c')])

    # J-05 羊羔毛翻領丹寧外套：經典牛仔夾克（胸前兩個有蓋口袋、銅釦、腰頭），領子、前襟與袖口外翻的米白羊羔絨（fleece 部位）
    hem5 = waist - .015
    c5 = cuff(.95)
    pk5 = box(.085, -.1, nk.z - .2, .05, .06, .045, sym=ox)
    flap5 = box(.085, -.1, nk.z - .148, .052, .06, .014, sym=ox)
    shell(F, S('sherpa_denim'), JS, off=lambda p: .016 + .005 * on_arm(p) + .005 * chest(p), smooth=6, rim=.008,
          fields=[neckline(lambda a: .006 + .03 * max(0., math.cos(a)) ** 2), c5, below(hem5)],
          patches=[(near_neck(.065), .013, .007, 'fleece'), (front(F, lambda p, ctx: abs(p.x - ox) - .024 if p.z > hem5 + .045 else 1.), .009, .004, 'fleece'),
                   (edge_band(c5, .05), .012, .006, 'fleece'), (edge_band(below(hem5), .045), .004, .002, 'cloth'),
                   (pk5, .003, .002, 'cloth'), (flap5, .006, .002, 'cloth'),
                   (buttons(F, [nk.z - .148], x=.085, s=.005), .008, .001, 'gold'), (buttons(F, [nk.z - .148], x=-.085, s=.005), .008, .001, 'gold'),
                   (buttons(F, [hem5 + .022], x=.07, s=.005), .007, .001, 'gold'), (buttons(F, [hem5 + .022], x=-.07, s=.005), .007, .001, 'gold')])

    # J-06 雙排釦長版風衣：長到小腿肚、肩章、右胸槍擋、雙排深色釦、腰帶與金屬扣；衣襬是放樣的（前面開到胯下、後面開衩）
    zj6, hem6 = waist, kn - .15
    clr6 = .026
    prof6 = lambda a, z, t, K: K.Hm(a, z, zj6) + clr6 + .05 * t ** 1.2
    L6 = Loft(zj6, hem6, prof6, segs=80, dz=.02, clear=clr6, lining=.004, rim=.005, wd=.7,
              fields=[slit(K, 0., .026, K.zc + .02), slit(K, math.pi, .012, K.zc - .2)])
    zb6 = waist + .002
    belt6 = Loft(zb6 + .024, zb6 - .016, lambda a, z, t, K: K.H(a, z) + clr6 + .009, segs=72, dz=.02, clear=clr6 + .006, lining=0., rim=.003)
    def buckle6(bm, trim, ctx):
        p = K.at(-.42, K.H(-.42, zb6 + .004) + clr6 + .014, zb6 + .004)
        with _part(bm, trim, 'b'):
            cube(bm, p, (.028, .006, .03), rot=(0, 0, -.42))
    belt6.extra = buckle6
    c6 = cuff(.94)
    db6 = [nk.z - .2, nk.z - .29, nk.z - .38]
    shell_off6 = to_hull(F, lambda p: .016 + .006 * on_arm(p) + .004 * chest(p), waist, clr6)
    coat(F, S('trench'), JS, shell_off6, [L6, belt6],
         fields=[neckline(lambda a: .006 + .07 * max(0., math.cos(a)) ** 3), c6, below(waist - .012)],
         patches=[(near_neck(.05), .007, .004, 'cloth'),
                  (front(F, lambda p, ctx: max(abs(p.x - ox - (.035 if p.x > ox else -.035)) - .04, (nk.z - .14) - p.z) if p.z > nk.z - .22 else 1.), .005, .003, 'cloth'),
                  (box(cx - .05, ua.y, ua.z + .062, .055, .05, .011, sym=ox), .004, .002, 'cloth'),
                  (front(F, lambda p, ctx: max(abs(p.x - ox + .08) - .055, abs(p.z - (nk.z - .13)) - .055)), .004, .002, 'cloth'),
                  (buttons(F, db6, x=.06, s=.006), .007, .001, 'b'), (buttons(F, db6, x=-.06, s=.006), .007, .001, 'b'),
                  (edge_band(c6, .035), .004, .002, 'cloth'), (edge_band(c6, .075), .0025, .002, 'cloth')])

    # J-07 千禧天鵝絨水鑽短版連帽外套：長度到肋骨下緣、喇叭長袖（往手腕越來越寬）、拉鍊、兜帽；背後的水鑽皇冠（CHAR_FS 的 crown）
    hem7 = sp2.z - .025 if M else sp2.z - .015
    c7 = cuff(1.06)
    shell(F, S('velour_crop'), JS, off=lambda p: .011 + .004 * on_arm(p) + .038 * along(p) ** 2.2 + .003 * chest(p), smooth=6, rim=.006,
          fields=[collar_up(.012), c7, below(hem7)],
          patches=[(front(F, lambda p, ctx: abs(p.x - ox) - .0035), .003, .001, 'silver'), (edge_band(below(hem7), .028), .003, .002, 'cloth')],
          extra=lambda bm, trim, ctx: (hood_down(F, bm, trim, ctx, depth=.12, puff=.03, off=.016), cords(F, bm, trim, ctx, a0=.22, L=.13, off=.016, part='cloth')))

    # J-08 戰術防風多袋衝鋒衣：高領、放下來收在背上的兜帽、胸前斜向的防水拉鍊袋、肩膀與上臂深灰拼接、魔鬼氈袖口、反光標誌
    hem8 = pel.z - .02
    c8 = cuff(.98)
    zip8 = stroke([(ox - .12, nk.z - .26), (ox - .02, nk.z - .13)], .003)
    shell(F, S('tac_shell'), JS, off=lambda p: .017 + .006 * on_arm(p) + .005 * chest(p), smooth=6, rim=.007,
          fields=[collar_up(.055), c8, below(hem8)],
          regions=[(lambda p, ctx: max((sp3.z + .045) - p.z, ax(p) - (cx - .005)), 'b')],
          patches=[(front(F, lambda p, ctx: abs(p.x - ox) - .004), .004, .001, 'b'), (zip8, .004, .0015, 'b'),
                   (front(F, lambda p, ctx: max(abs(p.x - ox + .07) - .05, abs(p.z - (nk.z - .2)) - .065)), .0035, .002, 'cloth'),
                   (box(ox + .1, -.1, nk.z - .15, .02, .06, .008), .0045, .001, 'c'),
                   (edge_band(c8, .045), .004, .002, 'b'), (edge_band(below(hem8), .025), .0035, .002, 'cloth')],
          extra=lambda bm, trim, ctx: (hood_down(F, bm, trim, ctx, depth=.11, puff=.022, off=.022, th=.004),
                                       cords(F, bm, trim, ctx, a0=.3, L=.06, off=.022, part='b', tip='b')))

    # J-09 金龍橫須賀緞面夾克：圓領拉鍊飛行夾克、寶藍衣身配香檳金的袖子、黑色條紋羅紋；背後的龍與胸前的虎頭刺繡（CHAR_FS 的 dragon）
    hem9 = waist - .025
    c9 = cuff(.98)
    shell(F, S('sukajan'), JS, off=lambda p: .017 + .005 * on_arm(p) + .005 * chest(p), smooth=6, rim=.007,
          fields=[neckline(lambda a: .004 + .012 * max(0., math.cos(a)) ** 2), c9, below(hem9)],
          regions=[(on_arm_f(F, .0), 'c')],
          patches=[(near_neck(.03), .004, .003, 'b'), (edge_band(c9, .05), .005, .003, 'b'), (edge_band(below(hem9), .055), .005, .003, 'b'),
                   (front(F, lambda p, ctx: abs(p.x - ox) - .0035), .0035, .001, 'gold')])

    # J-10 假兩件連帽格紋法蘭絨外套：重磅格紋襯衫外套（雙胸袋、鈕扣）＋縫在裡面的灰色連帽前襟與兜帽（第三色）、抽繩
    hem10 = pel.z - .02
    c10 = cuff(.97)
    inner10 = front(F, lambda p, ctx: abs(p.x - ox) - (.045 + .02 * max(0., min(1., (p.z - (sp2.z)) / .2))) if p.z > sp2.z - .05 else 1.)
    shell(F, S('flannel_hood'), JS, off=lambda p: .02 + .006 * on_arm(p) + .006 * chest(p), smooth=6, rim=.008,
          fields=[neckline(lambda a: .006 + .015 * max(0., math.cos(a)) ** 2), c10, below(hem10)],
          regions=[(inner10, 'c')],
          patches=[(box(.1, -.1, nk.z - .2, .045, .06, .05, sym=ox), .004, .002, 'cloth'), (box(.1, -.1, nk.z - .145, .047, .06, .013, sym=ox), .007, .002, 'cloth'),
                   (buttons(F, [nk.z - .2 - k * .09 for k in range(5) if nk.z - .2 - k * .09 > hem10 + .04], x=.058, s=.0045), .004, .001, 'pearl'),
                   (edge_band(c10, .045), .004, .002, 'cloth')],
          extra=lambda bm, trim, ctx: (hood_down(F, bm, trim, ctx, depth=.14, puff=.034, off=.024, part='c'),
                                       cords(F, bm, trim, ctx, a0=.17, L=.17, off=.024, part='c', tip='silver')))

    # J-11 小香風金釦粗花呢短外套：無領圓領、合身短版、胸前四個對稱貼袋、流蘇滾邊（第二色）、珍珠鑲邊的金釦（CHAR_FS 的 tweed）
    hem11 = waist + .005
    c11 = cuff(.86)
    nl11 = neckline(lambda a: .01 + .04 * max(0., math.cos(a)) ** 2)
    shell(F, S('tweed'), JS, off=lambda p: .011 + .003 * on_arm(p) + .003 * chest(p), smooth=6, rim=.006,
          fields=[nl11, jopen(F, nk.z, -9., .006), c11, below(hem11)],
          patches=[(edge_band(nl11, .012), .0035, .002, 'b'), (edge_band(c11, .014), .0035, .002, 'b'), (edge_band(below(hem11), .014), .0035, .002, 'b'),
                   (front(F, lambda p, ctx: abs(p.x - ox) - .02 if p.z > hem11 else 1.), .002, .001, 'b'),
                   (box(.085, -.1, nk.z - .18, .04, .06, .035, sym=ox), .003, .002, 'cloth'),
                   (box(.085, -.1, hem11 + .06, .045, .06, .038, sym=ox), .003, .002, 'cloth'),
                   (buttons(F, [nk.z - .13, nk.z - .23, hem11 + .07], x=.035, s=.0058), .006, .001, 'gold'),
                   (buttons(F, [nk.z - .13, nk.z - .23, hem11 + .07], x=-.035, s=.0058), .006, .001, 'gold')])

    # J-12 幫派寬版連帽套頭衝鋒夾克（Anorak）：半拉鍊、腹前超大袋鼠蓋袋（袋蓋印哥德體字，CHAR_FS 的 gothic）、黑白撞色、兜帽
    hem12 = pel.z - .02
    c12 = cuff(.98)
    zf12 = sp1.z + .035
    shell(F, S('anorak'), JS, off=lambda p: .022 + .007 * on_arm(p) + .006 * chest(p) + .012 * max(0., min(1., (sp2.z - p.z) / .12)), smooth=7, rim=.008,
          fields=[collar_up(.03), c12, below(hem12)],
          regions=[(lambda p, ctx: min((sp3.z + .03) - p.z, (cx - .01) - ax(p)), 'c')],
          patches=[(front(F, lambda p, ctx: max(abs(p.x - ox) - .004, (nk.z - .19) - p.z)), .004, .001, 'silver'),
                   (front(F, lambda p, ctx: max(abs(p.x - ox) - .13, abs(p.z - (zf12 - .05)) - .06)), .006, .003, 'cloth'),
                   (front(F, lambda p, ctx: max(abs(p.x - ox) - .135, abs(p.z - zf12) - .025)), .011, .003, 'cloth'),
                   (edge_band(c12, .04), .004, .002, 'cloth'), (edge_band(below(hem12), .03), .005, .002, 'cloth')],
          extra=lambda bm, trim, ctx: (hood_down(F, bm, trim, ctx, depth=.15, puff=.04, off=.03), cords(F, bm, trim, ctx, a0=.2, L=.12, off=.03, part='b')))

    # J-13 銀狐皮草大翻領長大衣：落地長度、寬大的披肩領（皮草更厚）、加寬的肩袖；衣襬前面整片開到腰（底下的褲子、腿照畫），深色緞面裡布
    zj13, hem13 = waist, .1
    clr13 = .036
    prof13 = lambda a, z, t, K: K.Hm(a, z, zj13) + clr13 + .07 * t ** 1.1
    L13 = Loft(zj13, hem13, prof13, segs=84, dz=.03, clear=clr13, lining=.006, rim=.008, wd=.7,
               fields=[slit(K, 0., .05, zj13 - .03)], regions=[])
    c13 = cuff(.97)
    shell_off13 = to_hull(F, lambda p: .026 + .012 * on_arm(p) + .006 * chest(p), waist, clr13)
    lap13 = front(F, lambda p, ctx: abs(p.x - ox) - (.03 + .085 * max(0., min(1., (p.z - (waist + .05)) / (nk.z - waist - .05)))) if p.z > waist + .02 else 1.)
    coat(F, S('fur_coat'), JS, shell_off13, [L13],
         fields=[neckline(lambda a: .006 + .1 * max(0., math.cos(a)) ** 2.2), c13, below(waist - .012)],
         patches=[(near_neck(.075), .018, .008, 'cloth'), (lap13, .014, .007, 'cloth'), (edge_band(c13, .06), .014, .007, 'cloth')])

    # J-14 賽車手拼皮夾克：立領與魔鬼氈扣帶、預彎的袖子、肩膀與手肘的防摔塊；紅白黑三色拼接（側邊白、肩膀黑）、滿身虛構車隊的布章（CHAR_FS 的 sponsor）
    hem14 = waist - .03
    c14 = cuff(.98)
    shell(F, S('racer'), JS, off=lambda p: .015 + .005 * on_arm(p) + .004 * chest(p), smooth=6, rim=.007,
          fields=[collar_up(.035), c14, below(hem14)],
          regions=[(lambda p, ctx: max((.16 if M else .145) - ax(p), p.z - (sp3.z - .02), ax(p) - (cx - .02)), 'c'),
                   (lambda p, ctx: max((sp3.z + .055) - p.z, ax(p) - (cx + .1)), 'b')],
          patches=[(ring_above(.0), .003, .002, 'b'), (box(ox - .03, -.1, nk.z - .005, .025, .08, .012), .006, .002, 'b'),
                   (front(F, lambda p, ctx: abs(p.x - ox - .03) - .003), .0035, .001, 'silver'),
                   (sym_ball(F, shoulder + Vector((.03, 0, .005)), .05), .009, .004, 'silver'),
                   (sym_ball(F, elbow + Vector((0, .02, 0)), .04), .008, .004, 'silver'),
                   (edge_band(c14, .03), .003, .002, 'b'), (edge_band(below(hem14), .03), .004, .002, 'b')])

    # J-15 透明霓虹果凍防雨風衣：中長版連帽拉鍊、半透明煙燻紫（CHAR_FS 的 pvc：像素格的紗窗透出底下的衣服）、螢光綠包邊（第三色）。
    # see：底下的上衣與身體照畫（40-people.js 不藏、不丟），所以殼照身體鼓起來的表面做（cov=0）
    zj15, hem15 = waist, kn + .04
    clr15 = .03
    prof15 = lambda a, z, t, K: K.Hm(a, z, zj15) + clr15 + .045 * t
    L15 = Loft(zj15, hem15, prof15, segs=72, dz=.025, clear=clr15, lining=0., rim=.004, wd=.7, rows_d=(.012,),
               fields=[slit(K, 0., .02, zj15)], regions=[(lambda p, ctx: (p.z - hem15) - .012, 'c')])
    c15 = cuff(.99)
    shell_off15 = to_hull(F, lambda p: .02 + .006 * on_arm(p) + .006 * chest(p), waist, clr15)
    coat(F, S('pvc_rain'), JS, shell_off15, [L15], cov=0,
         fields=[collar_up(.035), c15, below(waist - .012)],
         patches=[(ring_above(.02), .002, .002, 'c'), (front(F, lambda p, ctx: abs(p.x - ox) - .006), .0025, .001, 'c'), (edge_band(c15, .02), .0025, .002, 'c')],
         extra=lambda bm, trim, ctx: hood_down(F, bm, trim, ctx, depth=.14, puff=.032, off=.03, th=.004))
