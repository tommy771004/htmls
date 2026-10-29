# 裙子（short.md 的 S-01～S-15）：wear.py 用 exec 載入（排在 wear_pants.py 之後，用它的 leg_y、surf_y、chain）
# 一件裙子＝腰臀的殼（身體褲子區＋上衣區下緣長出來，切到胯下 3 cm 的安全短褲）＋裙身的放樣（一圈圈的環，從臀部垂到下擺）。
# 裙身不能照身體做殼（兩條腿是分開的）：每一圈的半徑照身體在那個高度的截面凸包（兩條腿之間補起來）再放鬆；
# 權重不從身體表面取（前後中線會被分到某一條腿，跨步就撕開）：臀部以上照身體，往下漸漸換成左右大腿 50% / 50% 的漸層，長裙的下擺再換到小腿。


def _smooth(e0, e1, x):
    t = max(0., min(1., (x - e0) / (e1 - e0)))
    return t * t * (3. - 2. * t)


def _hull(pts):
    pts = sorted(set(pts))
    if len(pts) < 3:
        return pts
    def cross(o, a, b):
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
    lo, hi = [], []
    for p in pts:
        while len(lo) >= 2 and cross(lo[-2], lo[-1], p) <= 0:
            lo.pop()
        lo.append(p)
    for p in reversed(pts):
        while len(hi) >= 2 and cross(hi[-2], hi[-1], p) <= 0:
            hi.pop()
        hi.append(p)
    return lo[:-1] + hi[:-1]


SK_NA = 180     # 截面半徑的角度格數（每 2°）


class SkirtBody:
    """一個性別的下半身截面：每 1 cm 一層，那一層身體（退回皮膚）的凸包、從中心線往每個角度的半徑；胯下高度"""

    def __init__(self, F):
        tree, co, polys, _ = _body_bvh(F)
        self.F, self.ox = F, F.ox
        self.cy = F.b('pelvis').y - .005
        self.z0, self.dz = .04, .01
        self.nz = int((F.b('pelvis').z + .24 - self.z0) / self.dz) + 1
        pts = [[] for _ in range(self.nz)]
        for poly in polys:
            n = len(poly)
            for k in range(n):
                a, b = co[poly[k]], co[poly[(k + 1) % n]]
                lo, hi = (a, b) if a.z < b.z else (b, a)
                if hi.z - lo.z < 1e-9 or abs(lo.x - self.ox) > .35:
                    continue
                i0, i1 = max(0, math.ceil((lo.z - self.z0) / self.dz)), min(self.nz - 1, math.floor((hi.z - self.z0) / self.dz))
                for i in range(i0, i1 + 1):
                    t = (self.z0 + i * self.dz - lo.z) / (hi.z - lo.z)
                    pts[i].append((round(lo.x + (hi.x - lo.x) * t - self.ox, 5), round(lo.y + (hi.y - lo.y) * t - self.cy, 5)))
        self.r = []
        for i in range(self.nz):
            h = _hull(pts[i])
            row = []
            for j in range(SK_NA):
                a = j / SK_NA * 2 * math.pi
                dx, dy = math.sin(a), -math.cos(a)
                best = 0.
                for k in range(len(h)):
                    p, q = h[k], h[(k + 1) % len(h)]
                    ex, ey = q[0] - p[0], q[1] - p[1]
                    den = dx * ey - dy * ex
                    if abs(den) < 1e-12:
                        continue
                    t = (p[0] * ey - p[1] * ex) / den
                    s = (p[0] * dy - p[1] * dx) / den
                    if t > 0 and -1e-6 <= s <= 1 + 1e-6:
                        best = max(best, t)
                row.append(best)
            self.r.append(row)
        hit = tree.ray_cast(Vector((self.ox, F.b('pelvis').y, .5)), Vector((0, 0, 1)), 1.)
        self.zc = hit[0].z if hit[0] is not None else F.b('thigh_l').z - .08     # 胯下

    def H(self, a, z):
        """角度 a（0 正前方、往 +X 轉）、高度 z 的身體截面半徑"""
        fi = max(0., min(self.nz - 1.001, (z - self.z0) / self.dz))
        fj = (a / (2 * math.pi) % 1.) * SK_NA
        i, j = int(fi), int(fj)
        u, w = fi - i, fj - j
        r0, r1 = self.r[i], self.r[i + 1]
        j1 = (j + 1) % SK_NA
        return (r0[j] * (1 - w) + r0[j1] * w) * (1 - u) + (r1[j] * (1 - w) + r1[j1] * w) * u

    def Hm(self, a, z, top):
        """top 到 z 之間的最大半徑（A 字裙往下不會比上面窄）"""
        m, zz = self.H(a, z), z
        while zz < top:
            m = max(m, self.H(a, zz))
            zz += self.dz
        return m

    def at(self, a, r, z):
        return Vector((self.ox + math.sin(a) * r, self.cy - math.cos(a) * r, z))

    def ang(self, p):
        return math.atan2(p.x - self.ox, -(p.y - self.cy)) % (2 * math.pi)


def _sk(F):
    if not getattr(F, '_skb', None):
        F._skb = SkirtBody(F)
    return F._skb


def _near_w(F, p):
    """身體表面最近那一點的權重（同 _reweight）：{骨頭群組編號: 權重}"""
    from mathutils.interpolate import poly_3d_calc
    tree, co, polys, wts = _body_bvh(F)
    hit = tree.find_nearest(p)
    acc = {}
    if hit[2] is None:
        return acc
    idx = polys[hit[2]]
    for i, w in zip(idx, poly_3d_calc([co[i] for i in idx], hit[0])):
        for g, gw in wts[i]:
            acc[g] = acc.get(g, 0.) + gw * w
    return acc


def _skirt_weights(F, bm, wd=.75, pw=.05):
    """裙身的權重：胯下以上照身體表面；往下換成骨盆＋左右大腿（左右 50% / 50% 的漸層，wd 是漸層的寬度，以大腿到中線的距離為 1），
    膝蓋以下換到小腿；pw 是一直留給骨盆的比例（貼身的裙子要 0：膝蓋往前 25 cm 時，留 12% 就落後 3 cm，腿會穿出來）。最多 4 根骨頭、正規化"""
    K = _sk(F)
    gi = {vg.name: vg.index for vg in F.body.vertex_groups}
    ox, lx, kn = F.ox, F.b('thigh_l').x - F.ox, F.b('calf_l').z
    dl = bm.verts.layers.deform.verify()
    for v in bm.verts:
        p = v.co
        u = _smooth(K.zc + .13, K.zc - .03, p.z)    # 上緣就開始跟著大腿（抬腿時大腿前面才不會從裙身上緣穿出來；底下是同色的短褲）
        acc = {g: w * (1 - u) for g, w in _near_w(F, p).items()} if u < 1 else {}
        if u > 0:
            sl = _smooth(-wd, wd, (p.x - ox) / lx)
            c = _smooth(kn + .08, kn - .06, p.z)
            q = 1. - pw
            for bn, w in (('pelvis', pw), ('thigh_l', q * sl * (1 - c)), ('calf_l', q * sl * c), ('thigh_r', q * (1 - sl) * (1 - c)), ('calf_r', q * (1 - sl) * c)):
                if w > 0:
                    acc[gi[bn]] = acc.get(gi[bn], 0.) + w * u
        top = sorted(acc.items(), key=lambda t: -t[1])[:4]
        tot = sum(w for _, w in top)
        dv = v[dl]
        dv.clear()
        for g, w in top:
            dv[g] = w / tot


class Loft:
    """裙身放樣的參數：prof(a, z, t, K) → 半徑（t 0 上緣 → 1 下擺），hem(a) → 下擺高度；angles 不給就是 segs 等分"""

    def __init__(self, zj, hem, prof, segs=96, dz=.013, angles=None, clear=.007, fields=(), patches=(), regions=(), rim=.003, part=0,
                 lining=.003, inner=None, extra=None, z=None, top_fold=True, rows_d=(), cols=(), wd=.75, pw=.05):
        self.__dict__.update(locals())
        del self.__dict__['self']

    def R(self, a, z, K):
        """裙身在角度 a、高度 z 的外表面半徑（鈕扣、流蘇、羽毛貼著它放）"""
        h = self.hem(a) if callable(self.hem) else self.hem
        t = max(0., min(1., (z - self.zj) / (h - self.zj)))
        return max(self.prof(a, z, t, K), K.H(a, z) + self.clear)


def _axis(uni, extra, keep=.3):
    """均分的格點 uni 加上一定要有的 extra（線條、開衩、口袋的邊界）；離 extra 不到 keep 格的均分點拿掉（不留細長三角形）"""
    if not extra:
        return list(uni)
    step = min(b - a for a, b in zip(uni, uni[1:])) if len(uni) > 1 else 1.
    out = [u for u in uni if all(abs(u - e) > step * keep for e in extra)] + list(extra)
    return sorted(out)


def _grid(bm, K, L, angs, ts, ds, rad):
    """一圈圈的環：ts 是 0..1 的比例（上緣 → 下擺），ds 是離下擺多高的固定高度（線條剛好落在環上）；面朝外"""
    hem = L.hem if callable(L.hem) else (lambda a, h=L.hem: h)
    rows = []
    specs = [('t', t) for t in ts] + [('d', d) for d in ds]
    def zat(sp, a):
        zz = L.zj + (hem(a) - L.zj) * sp[1] if sp[0] == 't' else hem(a) + sp[1]
        if L.z:
            zz += L.z(a, (L.zj - zz) / max(1e-6, L.zj - hem(a)))
        return zz
    specs.sort(key=lambda sp: -zat(sp, 0.))
    for sp in specs:
        row = []
        for a in angs:
            zz = zat(sp, a)
            t = (L.zj - zz) / max(1e-6, L.zj - hem(a))
            r = max(rad(a, zz, t, K), K.H(a, zz) + L.clear)
            row.append(bm.verts.new(K.at(a, r, zz)))
        rows.append(row)
    n = len(angs)
    return [bm.faces.new((rows[k][i], rows[k + 1][i], rows[k + 1][(i + 1) % n], rows[k][(i + 1) % n])) for k in range(len(rows) - 1) for i in range(n)]


def _cut_all(bm, fields, ctx):
    for g in fields:
        _cut_field(bm, lambda p: g(p, ctx))
        bmesh.ops.delete(bm, geom=[f for f in bm.faces if sum(g(v.co, ctx) for v in f.verts) / len(f.verts) > 0], context='FACES')
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')


def _append(bm, other):
    me = bpy.data.meshes.new('_tmp')
    other.to_mesh(me)
    other.free()
    bm.from_mesh(me)
    bpy.data.meshes.remove(me)


def _loft_bm(F, L, ctx):
    K = _sk(F)
    lb = bmesh.new()
    trim = lb.verts.layers.float.new('_trim')
    hem = L.hem if callable(L.hem) else (lambda a, h=L.hem: h)
    uni = L.angles or [i / L.segs * 2 * math.pi for i in range(L.segs)]
    angs = _axis(uni, sorted(c % (2 * math.pi) for c in L.cols))
    nr = max(2, math.ceil((L.zj - min(hem(a) for a in angs)) / L.dz))
    span = L.zj - min(hem(a) for a in angs)
    ts = _axis([k / nr for k in range(nr + 1)], sorted(1. - d / span for d in L.rows_d))
    ts = [t for t in ts if not any(abs((1. - t) * span - d) < 1e-6 for d in L.rows_d)]    # 固定高度的那幾圈另外給
    _grid(lb, K, L, angs, ts, L.rows_d, L.prof)
    bmesh.ops.triangulate(lb, faces=lb.faces[:])
    _cut_all(lb, L.fields, ctx)
    for f, *_ in L.patches:
        _cut_field(lb, lambda p: f(p, ctx))
    for f, _ in L.regions:
        _cut_field(lb, lambda p: f(p, ctx))
    lb.normal_update()
    pre = {v: v.co.copy() for v in lb.verts}
    nrm = {v: v.normal.copy() for v in lb.verts}
    amt = {v: .004 for v in lb.verts}
    edges = [e for e in lb.edges if e.is_boundary and (L.top_fold or min(v.co.z for v in e.verts) < L.zj - .004)]
    _fold_rim(lb, edges, nrm, amt, L.rim)
    pt = PART[L.part] if isinstance(L.part, str) else L.part
    for v in lb.verts:
        v[trim] = pt
    base = [fc for fc in lb.faces if all(v in pre for v in fc.verts)]
    _dress(lb, trim, base, pre, nrm, amt, L.patches, L.regions, ctx)
    # 裡布：粗一半的格子往內 lining，面朝內（從下面、從開衩看進去不會是空的）；同樣的場切掉開衩（另外一份網格切完再併進來）
    if L.lining:
        ib = bmesh.new()
        it = ib.verts.layers.float.new('_trim')
        inner = L.inner or (lambda a, z, t, K: L.prof(a, z, t, K) - L.lining)
        ia = _axis([i / (L.segs // 2) * 2 * math.pi for i in range(L.segs // 2)], sorted(c % (2 * math.pi) for c in L.cols))
        fs = _grid(ib, K, L, ia, [k / max(2, nr // 2) for k in range(max(2, nr // 2) + 1)], (),
                   lambda a, z, t, K: max(inner(a, z, t, K), K.H(a, z) + L.clear - L.lining))
        bmesh.ops.reverse_faces(ib, faces=fs)
        bmesh.ops.triangulate(ib, faces=ib.faces[:])
        _cut_all(ib, L.fields, ctx)
        for v in ib.verts:
            v[it] = pt
        _append(lb, ib)
    if L.extra:
        L.extra(lb, trim, ctx)
    bmesh.ops.dissolve_degenerate(lb, dist=2e-5, edges=lb.edges[:])
    _skirt_weights(F, lb, L.wd, L.pw)
    return lb


def skirt(F, name, waist, lofts, briefs=.03, yoke_off=.005, patches=(), regions=(), fields=(), slots=('bottom', 'top'), extra=None, smooth=4):
    """腰臀的殼（waist 以上切掉、胯下 briefs 以下切掉：一件同色的安全短褲）＋ lofts 裡每一層裙身；extra 加在殼上（取身體的權重）"""
    K = _sk(F)
    def merge(bm, trim, ctx):
        if extra:
            extra(bm, trim, ctx)
        old = set(bm.verts)
        for L in lofts:
            lb = _loft_bm(F, L, ctx)
            _append(bm, lb)
        return {v for v in bm.verts if v not in old}
    hem = K.zc - briefs
    return shell(F, name, list(slots), cov=2, off=lambda p: yoke_off, smooth=smooth, rim=.004,
                 fields=[above(waist), below(hem)] + list(fields), patches=patches, regions=regions, extra=merge)


def pleats(n, depth, k=5):
    """刀摺的角度（每一摺 k 欄，最後一欄貼著下一摺的起點：摺邊）與半徑的加量 depth(t) × 鋸齒"""
    angs, us = [], [i / (k - 1) * .94 for i in range(k)]
    for p in range(n):
        for u in us:
            angs.append((p + u) / n * 2 * math.pi)
    def saw(a):
        return (a / (2 * math.pi) * n) % 1.
    return angs, lambda a, t: depth(t) * saw(a) / .94



def ad(a, b):
    """兩個角度的差（-π..π）"""
    return (a - b + math.pi) % (2 * math.pi) - math.pi


def slit(K, a0, w, ztop):
    """開衩（> 0 切掉）：角度 a0 那一條、半寬 w 公尺，從下擺切到 ztop"""
    return lambda p, ctx: min(w - abs(ad(K.ang(p), a0)) * .16, ztop - p.z)


def zband(z0, z1):
    """z0..z1 之間的一圈（≤ 0 在裡面）"""
    return lambda p, ctx: max(z0 - p.z, p.z - z1)


def ribbon(bm, pts, side, w, th=.0012):
    """沿折線的一條扁帶（流蘇、羽毛、垂下來的織帶）：side(i) 是寬度方向，兩面都有（正反各一層，中間隔 th）"""
    n = len(pts)
    rows = []
    for i, p in enumerate(pts):
        t = (pts[min(i + 1, n - 1)] - pts[max(i - 1, 0)]).normalized()
        s = side(i) if callable(side) else side
        nn = t.cross(s).normalized()
        ww = w(i) if callable(w) else w
        rows.append([bm.verts.new(p + s * ww * .5 + nn * th * .5), bm.verts.new(p - s * ww * .5 + nn * th * .5),
                     bm.verts.new(p - s * ww * .5 - nn * th * .5), bm.verts.new(p + s * ww * .5 - nn * th * .5)])
    for i in range(n - 1):
        a, b = rows[i], rows[i + 1]
        bm.faces.new((a[0], a[1], b[1], b[0]))
        bm.faces.new((a[3], b[3], b[2], a[2]))
    bm.faces.new((rows[-1][0], rows[-1][1], rows[-1][2], rows[-1][3]))


def star(K, a0, z0, r0, R, rin=.42):
    """裙面上的五角星（≤ 0 在裡面）：中心在角度 a0、高度 z0（裙面半徑約 r0），外半徑 R；尖角朝上"""
    def f(p, ctx):
        u, v = ad(K.ang(p), a0) * r0, p.z - z0
        fr = (math.atan2(u, v) / (2 * math.pi) * 5) % 1.
        return math.hypot(u, v) - R * (rin + (1 - rin) * abs(fr - .5) * 2)
    return f


def build_skirts(F, g):
    ox, M = F.ox, g == 'Male'
    K = _sk(F)
    pel, th, kn = F.b('pelvis'), F.b('thigh_l'), F.b('calf_l')
    zc = K.zc
    S = lambda name: f'W_{name}_{g}'
    zj = zc + .045           # 裙身從這裡開始（上面是殼）
    tan = math.tan

    # S-01 學院風高腰百褶格紋短裙：高腰、A 字、24 道刀摺（往下摺得越深），腰側銀色皮帶扣
    angs, pl = pleats(24, lambda t: .004 + .009 * t, k=4)
    w1 = pel.z + .1
    def buckle1(bm, trim, ctx):
        x = ox + K.H(math.pi / 2, w1 - .02) + .011
        with _part(bm, trim, 'silver'):
            cube(bm, (x, K.cy - .02, w1 - .02), (.006, .03, .022))
    skirt(F, S('pleat_plaid'), w1, [Loft(zj, zc - .2, lambda a, z, t, K: K.Hm(a, z, zj) + .008 + tan(math.radians(13)) * (zj - z) + pl(a, t),
                                        angles=angs, inner=lambda a, z, t, K: K.Hm(a, z, zj) + .006 + tan(math.radians(13)) * (zj - z), extra=buckle1)],
          patches=[(lambda p, ctx: (w1 - .032) - p.z, .0025, .002, 'cloth')])

    an = F.b('foot_l')
    sp3 = F.b('spine_03')
    PI = math.pi
    A = lambda deg: tan(math.radians(deg))
    def around(L, a, z, out=.0):
        """裙面上那一點（往外 out）與那裡的法線方向（水平）"""
        r = L.R(a, z, K) + out
        return K.at(a, r, z), Vector((math.sin(a), -math.cos(a), 0.))

    # S-02 千禧低腰金屬大環牛仔迷你裙：低腰、包臀直筒、極短，下擺抽鬚（白線＋鋸齒），超寬雙排圓孔皮帶、星星貼布、水鑽鉚釘
    w2 = pel.z + .025
    hem2 = lambda a: zc - .115 + .004 * math.sin(a * 37.) + .003 * math.sin(a * 91. + 1.)
    prof2 = lambda a, z, t, K: K.Hm(a, z, zj) + .007
    L2 = Loft(zj, hem2, prof2, segs=80, dz=.015, rows_d=(.011,))
    def studs2(bm, trim, ctx):
        with _part(bm, trim, 'silver'):
            for i in range(14):
                a = -.9 + i * .14 + .05 * math.sin(i * 2.3)
                z = zj - .03 - .07 * ((i * .37) % 1.)
                p, n = around(L2, a, z, .0015)
                ball(bm, p, .0028, u=6, v=4)
    L2.extra = studs2
    L2.patches = [(star(K, a0, z0, .2, R0), .0016, .001, 'c') for a0, z0, R0 in ((-.55, zj - .05, .022), (.42, zj - .07, .017), (2.7, zj - .04, .02))]
    L2.regions = [(lambda p, ctx: (p.z - hem2(K.ang(p))) - .011, 'c')]
    def belt2(bm, trim, ctx):
        with _part(bm, trim, 'silver'):
            for row, z in enumerate((w2 - .013, w2 - .032)):
                for i in range(16):
                    a = (i + row * .5) / 16 * 2 * PI
                    p = K.at(a, K.H(a, z) + .0115, z)
                    ring(bm, p, .0055, .0013, rot=(PI / 2, 0, a), seg=10, sseg=3)
    skirt(F, S('y2k_denim'), w2, [L2], extra=belt2,
          patches=[(zband(w2 - .045, w2), .0045, .003, 'b')])

    # S-03 高訂側開衩絲緞魚尾中長裙：高腰貼合臀腿到膝上，下擺散開成波浪荷葉邊（中小腿），左大腿高開衩
    w3, zf3, hem3 = pel.z + .09, kn.z + .04, kn.z - .2
    def prof3(a, z, t, K):
        s = max(0., (zf3 - z) / (zf3 - hem3))
        return K.H(a, z) + .01 + .1 * s ** 1.6 + .018 * s ** 1.3 * math.sin(a * 13.)
    skirt(F, S('satin_mermaid'), w3, [Loft(zj, lambda a: hem3 + .012 * math.sin(a * 13. + 1.2), prof3, segs=88, dz=.02,
                                           fields=[slit(K, PI / 2, .02, th.z - .2)], cols=(PI / 2 - .125, PI / 2 + .125), wd=.3, pw=0.,
                                           inner=lambda a, z, t, K: prof3(a, z, t, K) - .003 - .018 * max(0., (zf3 - z) / (zf3 - hem3)) ** 1.3)],
          patches=[(zband(w3 - .03, w3), .002, .0015, 'cloth')])

    # S-04 龐克黑色漆皮拉鍊不對稱短裙：左長右短的斜下擺、正面斜貫的粗齒拉鍊、腰間懸掛銀色十字架
    w4 = pel.z + .05
    hem4 = lambda a: zc - .17 - .085 * math.sin(a)
    prof4 = lambda a, z, t, K: K.Hm(a, z, zj) + .009 + A(8) * (zj - z)
    def zipf(p, ctx):
        a = ad(K.ang(p), 0.)
        t = (zj - .005 - p.z) / (zj - .005 - hem4(.62))
        return abs(a - (-.55 + 1.17 * t)) * .2 - .0055 if -.02 < t < 1.02 else 1.
    L4 = Loft(zj, hem4, prof4, segs=80, dz=.015, wd=.5, patches=[(zipf, .0022, .0012, 'c')])
    def cross4(bm, trim, ctx):
        a0 = .95
        top = K.at(a0, K.H(a0, w4 - .03) + .012, w4 - .03)
        p1 = K.at(a0 + .08, L4.R(a0 + .08, zj - .05, K) + .006, zj - .05)
        chain(bm, [top, top.lerp(p1, .5) + Vector((0, -.004, -.006)), p1], R=.0035, r=.0009)
        with _part(bm, trim, 'silver'):
            c = p1 + Vector((0, 0, -.022))
            cube(bm, c, (.004, .004, .034), rot=(0, 0, a0))
            cube(bm, c + Vector((0, 0, .006)), (.018, .004, .004), rot=(0, 0, a0))
        with _part(bm, trim, 'silver'):
            zp = K.at(-.55, L4.R(-.55, zj - .01, K) + .004, zj - .012)
            cube(bm, zp, (.008, .004, .016), rot=(0, 0, -.55))
    L4.extra = cross4
    skirt(F, S('patent_asym'), w4, [L4], patches=[(zband(w4 - .028, w4), .002, .0015, 'cloth')])

    # S-05 機能工裝多口袋插扣 A 字裙：硬挺 A 字（外擴 18°）、兩側立體翻蓋大口袋、下垂的尼龍織帶與插扣、橘色車縫線
    w5, hem5 = pel.z + .06, zc - .3
    prof5 = lambda a, z, t, K: K.Hm(a, z, zj) + .01 + A(18) * (zj - z)
    def pocket(a0, zm, hw, hh, rr=.18):
        return lambda p, ctx: max(abs(ad(K.ang(p), a0)) * rr - hw, abs(p.z - zm) - hh)
    pk = [pocket(s * PI / 2, zc - .14, .055, .06) for s in (-1, 1)]
    fl = [pocket(s * PI / 2, zc - .072, .058, .012) for s in (-1, 1)]
    stitch = [(lambda p, ctx: abs(p.z - (hem5 + .013)) - .0016, 'c')]
    L5 = Loft(zj, hem5, prof5, segs=80, dz=.016, rows_d=(.0114, .0146, .1, .216, .22, .24),
              cols=[s * PI / 2 + d for s in (-1, 1) for d in (-.3222, -.3056, .3056, .3222)], patches=[(f, .006, .003, 'cloth') for f in pk] + [(f, .0095, .003, 'cloth') for f in fl], regions=stitch)
    def straps5(bm, trim, ctx):
        for a0 in (.62, .78, -2.4):
            pts = []
            for k in range(9):
                z = zj - .01 - k * (zj - hem5 + .05) / 8
                p, n = around(L5, a0, z, .004)
                pts.append(p)
            with _part(bm, trim, 'b'):
                ribbon(bm, pts, lambda i, a0=a0: Vector((math.cos(a0), math.sin(a0), 0.)), .022, .0018)
            with _part(bm, trim, 'b'):
                p, n = around(L5, a0, zj - .04, .008)
                cube(bm, p, (.03, .008, .02), rot=(0, 0, a0))
    L5.extra = straps5
    skirt(F, S('cargo_aline'), w5, [L5], patches=[(zband(w5 - .04, w5), .003, .002, 'cloth')],
          regions=[(lambda p, ctx: abs(p.z - (w5 - .043)) - .0012, 'c')])

    # S-06 溫柔風雙層蛋糕荷葉雪紡短裙：鬆緊高腰、三層由內而外的波浪荷葉（每層往外 3 mm），櫻花粉底白色小波點
    w6 = pel.z + .1
    base6 = lambda a, z: K.Hm(a, z, zj) + .009 + A(15) * (zj - z)
    tiers = ((zj, zj - .11, 17), (zj - .075, zj - .2, 21), (zj - .165, zj - .29, 25))
    L6 = []
    for i, (z0, z1, n) in enumerate(tiers):
        def pr(a, z, t, K, n=n, i=i):
            return base6(a, z) + .003 * (2 - i) - .004 + .016 * t + .011 * t * (.5 + .5 * math.sin(a * n + i))
        L6.append(Loft(z0, lambda a, z1=z1, n=n, i=i: z1 + .006 * math.sin(a * n + i + 1.5), pr, segs=96, dz=.015))
    skirt(F, S('tier_ruffle'), w6, L6, patches=[(zband(w6 - .035, w6), .0035, .002, 'cloth')],
          regions=[(lambda p, ctx: abs(p.z - (w6 - .012)) - .0012, 'b'), (lambda p, ctx: abs(p.z - (w6 - .024)) - .0012, 'b')])

    # S-07 狂野斑馬紋包臀針織鉛筆裙：長到膝下的包臀窄裙、後中開衩 15 cm
    w7, hem7 = pel.z + .07, kn.z - .075
    skirt(F, S('zebra_pencil'), w7, [Loft(zj, hem7, lambda a, z, t, K: K.H(a, z) + .009 + .004 * _smooth(zc - .05, zc - .2, z), segs=80, dz=.02,
                                          fields=[slit(K, PI, .012, hem7 + .15)], cols=(PI - .075, PI + .075), rows_d=(.15,), wd=.3, pw=0.)],
          patches=[(zband(w7 - .025, w7), .0018, .0012, 'cloth')])

    # S-08 運動風百褶網球褲裙：一圈細百褶、內層一體成型的平角褲（安全短褲加長）、腰頭藍紅兩道羅紋
    w8, hem8 = pel.z + .06, zc - .2
    angs8, pl8 = pleats(36, lambda t: .003 + .005 * t, k=4)
    skirt(F, S('tennis_skort'), w8, [Loft(zj, hem8, lambda a, z, t, K: K.Hm(a, z, zj) + .008 + A(11) * (zj - z) + pl8(a, t), angles=angs8,
                                          inner=lambda a, z, t, K: K.Hm(a, z, zj) + .006 + A(11) * (zj - z))],
          briefs=.06, patches=[(zband(w8 - .03, w8), .0025, .0015, 'b'), (zband(w8 - .018, w8 - .012), .0032, .001, 'c')])

    # S-09 波希米亞圖騰流蘇不規則長裙：前短（膝）後長（腳踝上）的波浪下擺，裙緣一圈棉線小流蘇
    w9 = pel.z + .08
    zf9, zb9 = kn.z - .03, an.z + .13
    hem9 = lambda a: zf9 + (zb9 - zf9) * (.5 - .5 * math.cos(a)) + .01 * math.sin(a * 9.)
    prof9 = lambda a, z, t, K: K.Hm(a, z, zj) + .012 + A(9) * (zj - z) + .012 * t * math.sin(a * 9. + .5)
    L9 = Loft(zj, hem9, prof9, segs=96, dz=.022, inner=lambda a, z, t, K: prof9(a, z, t, K) - .003 - .012 * t)
    def fringe9(bm, trim, ctx):
        with _part(bm, trim, 'c'):
            n = 66
            for i in range(n):
                a = i / n * 2 * PI
                z0 = hem9(a) + .003
                p0, nr = around(L9, a, z0, .001)
                ln = .03 + .008 * math.sin(i * 1.7)
                pts = [p0 + Vector((0, 0, -ln * k / 2)) + nr * .003 * k for k in range(3)]
                ribbon(bm, pts, Vector((math.cos(a), math.sin(a), 0.)), .005)
    L9.extra = fringe9
    skirt(F, S('boho_maxi'), w9, [L9], patches=[(zband(w9 - .035, w9), .0025, .0015, 'cloth')])

    # S-10 哥德風黑蕾絲馬甲蓬蓬紗裙：高腰束腹馬甲（直到肋下）、三層硬網紗撐起的鐘形蓬裙（離大腿 25 mm 以上）、下擺黑玫瑰花邊
    w10, hem10 = pel.z + .17, zc - .17
    bell = lambda a, z, t, K, d=0.: K.Hm(a, z, zj) + .026 + d + .075 * math.sin(min(1., t * 1.15) * PI / 2) ** .8
    L10 = [Loft(zj - .01, hem10 - .028, lambda a, z, t, K: bell(a, z, t, K, -.012) + .006 * math.sin(a * 15.), segs=72, dz=.022, part='mesh', lining=0),
           Loft(zj - .005, hem10 - .014, lambda a, z, t, K: bell(a, z, t, K, -.006) + .005 * math.sin(a * 19. + 1.), segs=72, dz=.022, part='mesh', lining=0),
           Loft(zj, hem10, bell, segs=88, dz=.018)]
    def roses10(bm, trim, ctx):
        with _part(bm, trim, 'b'):
            n = 26
            for i in range(n):
                a = (i + .5) / n * 2 * PI
                p, nr = around(L10[2], a, hem10 + .008, .004)
                ball(bm, p, .009, s=(1, 1, .8), u=7, v=4, rot=(.3 * math.sin(i), 0, a))
    L10[2].extra = roses10
    corset = lambda p, ctx: (zj + .035) - p.z
    skirt(F, S('goth_tutu'), w10, L10, yoke_off=.006,
          regions=[(corset, 'b'), (lambda p, ctx: 1. if p.z < zj + .035 or p.y > K.cy else abs(abs(p.x - ox) - .018 - .006 * math.sin((p.z - zj) * 160.)) - .0018, 'c')],
          patches=[(zband(w10 - .02, w10), .002, .0015, 'b'), (zband(zj + .025, zj + .045), .003, .002, 'b')])

    # S-11 辦公室 OL 千鳥格排釦高腰窄裙：高腰收腰包臀、正面雙排金色獅頭釦、左大腿前側微開衩
    w11, hem11 = pel.z + .11, kn.z + .03
    L11 = Loft(zj, hem11, lambda a, z, t, K: K.H(a, z) + .009, segs=80, dz=.018, fields=[slit(K, .3, .01, hem11 + .09)], cols=(.3 - .0625, .3 + .0625), rows_d=(.09,), wd=.3, pw=0.)
    def buttons11(bm, trim, ctx):
        with _part(bm, trim, 'gold'):
            for s in (-1, 1):
                for k in range(3):
                    z = w11 - .035 - k * .045
                    a = s * .17
                    r = (L11.R(a, z, K) if z < zj else K.H(a, z) + .005) + .006
                    p = K.at(a, r, z)
                    cyl(bm, p, .0075, .0065, .004, rot=(PI / 2, 0, a), seg=14)
                    ball(bm, K.at(a, r + .002, z), .004, s=(1, .6, 1), u=8, v=5, rot=(0, 0, a))
    skirt(F, S('hounds_pencil'), w11, [L11], extra=buttons11, patches=[(zband(w11 - .03, w11), .002, .0015, 'cloth')])

    # S-12 賽博反光銀太空棉氣球蓬蓬裙：花苞形（中段鼓、下擺往內收），液態鏡面銀，接縫壓螢光藍導光條
    w12, hem12 = pel.z + .06, zc - .2
    def prof12(a, z, t, K):
        return K.Hm(a, z, zj) + .014 + .055 * math.sin(min(1., t * 1.05) * PI * .78) ** .9
    seams12 = [(lambda p, ctx, k=k: abs(ad(K.ang(p), k * PI / 3 + PI / 6)) * .2 - .0022, 'glow') for k in range(6)]
    skirt(F, S('balloon_silver'), w12, [Loft(zj, hem12, prof12, segs=90, dz=.016, rim=.012, rows_d=(.0045, .0075), cols=[k * PI / 3 + PI / 6 + d for k in range(6) for d in (-.011, .011)], regions=seams12 + [(lambda p, ctx: abs(p.z - (hem12 + .006)) - .0015, 'glow')])],
          patches=[(zband(w12 - .03, w12), .003, .002, 'cloth')], regions=[(lambda p, ctx: abs(p.z - (w12 - .033)) - .0014, 'glow')])

    # S-13 美式復古吊帶丹寧 A 字中裙：胸前口袋的護胸與雙肩吊帶（背後交叉）、黃銅工字釦、橘黃車縫線、及膝前開衩 A 字
    w13, hem13 = pel.z + .06, kn.z - .02
    bib_top = sp3.z - .02
    def keep13(p, ctx):
        x = abs(p.x - ox)
        waist = p.z - w13
        bib = max(x - .095, p.z - bib_top, p.y - K.cy) if p.y < K.cy else 1.
        if p.y < K.cy:
            strap = abs(x - .075) - .017 if p.z > bib_top - .02 else 1.
        else:
            xs = .03 + .05 * _smooth(w13, sp3.z + .1, p.z)       # 背後的兩條往下收成 V
            strap = abs(x - xs) - .016
        return min(waist, bib, strap)
    L13 = Loft(zj, hem13, lambda a, z, t, K: K.Hm(a, z, zj) + .01 + A(10) * (zj - z), segs=96, dz=.018, fields=[slit(K, 0., .012, hem13 + .12)],
               rows_d=(.0104, .0136, .12), cols=(-.075, .075), wd=.45,
               regions=[(lambda p, ctx: abs(p.z - (hem13 + .012)) - .0016, 'c')])
    def brass13(bm, trim, ctx):
        with _part(bm, trim, 'gold'):
            for s in (-1, 1):
                x = ox + s * .08
                y = surf_y(F, x, bib_top - .008) - .009
                cyl(bm, (x, y, bib_top - .008), .008, .007, .005, rot=(PI / 2, 0, 0), seg=14)
            for s in (-1, 1):
                a = s * (PI / 2 + .1)
                cyl(bm, K.at(a, K.H(a, w13 - .02) + .012, w13 - .02), .006, .005, .004, rot=(PI / 2, 0, a), seg=12)
    skirt(F, S('overall_denim'), sp3.z + .3, [L13], fields=[keep13], extra=brass13,
          patches=[(box(.0, -.15, bib_top - .07, .05, .1, .04, sym=ox), .0025, .0015, 'cloth'), (zband(w13 - .035, w13), .003, .002, 'cloth')])

    # S-14 沙漠廢土做舊撕裂繃帶裹身裙：寬窄不一的布帶斜著一圈圈纏上去（每條的下緣翹出來）、粗麻與做舊皮革拼接、破損的下擺
    w14, hem14 = pel.z + .05, zc - .2
    def band14(a, z):
        return (z - hem14) / .042 + a / (2 * PI) * 2.
    hem14f = lambda a: hem14 + .008 * math.sin(a * 23.) + .006 * math.sin(a * 57. + 2.) + .004 * math.sin(a * 131.)
    def prof14(a, z, t, K):
        return K.H(a, z) + .009 + .0055 * (1. - (band14(a, z) % 1.)) ** 2
    leather = lambda p, ctx: abs((band14(K.ang(p), p.z) % 3.) - .5) - .5
    L14 = Loft(zj, hem14f, prof14, segs=88, dz=.011, wd=.4, regions=[(leather, 'b')], inner=lambda a, z, t, K: K.H(a, z) + .006)
    def tatters(bm, trim, ctx):
        for i, a0 in enumerate((-.7, .3, 1.9, 3.4, 4.6)):
            pts = []
            for k in range(5):
                z = hem14f(a0) + .02 - k * .018
                p, n = around(L14, a0, min(z, hem14f(a0) + .005), .002 + .002 * k)
                pts.append(Vector((p.x, p.y, z)))
            ribbon(bm, pts, Vector((math.cos(a0), math.sin(a0), 0.)), .018 - .002 * i)
    L14.extra = tatters
    skirt(F, S('wasteland_wrap'), w14, [L14], patches=[(zband(w14 - .03, w14), .003, .002, 'b')])

    # S-15 華麗羽毛流蘇亮片派對短裙：合身迷你、整片魚鱗亮片，下擺一圈往外微翹的白色鴕鳥毛
    w15, hem15 = pel.z + .05, zc - .14
    L15 = Loft(zj, hem15, lambda a, z, t, K: K.Hm(a, z, zj) + .008 + A(5) * (zj - z), segs=80, dz=.015)
    def feathers15(bm, trim, ctx):
        with _part(bm, trim, 'c'):
            for row, (n, dz, ln) in enumerate(((34, .018, .065), (30, .002, .085))):
                for i in range(n):
                    a = (i + row * .5) / n * 2 * PI
                    p0, nr = around(L15, a, hem15 + dz, .002 + row * .002)
                    pts = [p0 + Vector((0, 0, -ln * k / 3)) + nr * (.006 * k + .005 * k * k) for k in range(4)]
                    ribbon(bm, pts, Vector((math.cos(a), math.sin(a), 0.)), lambda k: .014 + .016 * math.sin(k / 3 * PI * .9), .0015)
    L15.extra = feathers15
    skirt(F, S('sequin_feather'), w15, [L15], patches=[(zband(w15 - .022, w15), .002, .0015, 'cloth')])
