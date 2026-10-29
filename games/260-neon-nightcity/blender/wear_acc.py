# 配件（short.md 的 A-01～A-15）：wear.py 用 exec 載入（排在 wear_shoes.py 之後，用上衣的 armhole、neckline、scoop）
# 全部照退回皮膚的身體（_body_bvh）做，離皮膚只留自己的間隙。穿在衣服外面的（項鍊、背帶、背心、包、領帶、方巾、耳機、手套的袖口）由
# 40-people.js 的 wearLift 照當時穿的上衣、外套、褲裙往外推：_grp 是推的單位（≥ 1 的整組一起推、0 逐點推）。
# 耳環、耳掛、面罩只跟著頭（沒有 _grp，不推）。權重：_wb 標了骨頭的整塊綁那根骨頭；其餘照身體表面最近那一點，
# 整組的照組的中心取（一節鍊子、一顆珍珠不會被兩根骨頭扭彎）
from mathutils.interpolate import poly_3d_calc

ACC_BONES = ['', 'Head', 'spine_03', 'lowerarm_l', 'spine_02', 'pelvis', 'hand_l', 'hand_r']


def _skinw(F, p):
    """身體表面離 p 最近那一點的權重（那個面的角按重心座標內插，最多 4 根骨頭）"""
    tree, co, polys, wts = _body_bvh(F)
    hit = tree.find_nearest(p)
    idx = polys[hit[2]]
    bw = poly_3d_calc([co[i] for i in idx], hit[0])
    acc = {}
    for i, w in zip(idx, bw):
        for g, gw in wts[i]:
            acc[g] = acc.get(g, 0.) + gw * w
    top = sorted(acc.items(), key=lambda t: -t[1])[:4]
    tot = sum(w for _, w in top)
    return [(F.body.vertex_groups[g].name, w / tot) for g, w in top]


class _tag:
    """之後新加的頂點（或面）在 layer 標上 val：with _tag(bm, bm.verts.layers.float['_grp'], 3): …（同 wear.py 的 _part，記下原本有哪些）"""
    def __init__(self, seq, layer, val):
        self.seq, self.layer, self.val = seq, layer, val

    def __enter__(self):
        self.old = set(self.seq)

    def __exit__(self, *a):
        for v in self.seq:
            if v not in self.old:
                v[self.layer] = self.val


class Acc:
    """一件配件的建模狀態：A.grp() 開一個新的推移群組、A.bone('Head') 整塊綁骨頭、A.part('gold') 部位、A.flat() 平面著色（稜角）"""
    def __init__(self, bm, trim, lift):
        self.bm, self.trim, self.n = bm, trim, 0
        self.gl = bm.verts.layers.float.new('_grp') if lift else None
        self.wl = bm.verts.layers.int.new('_wb')
        self.fl = bm.faces.layers.int.new('_flat')

    def grp(self):
        self.n += 1
        return _tag(self.bm.verts, self.gl, self.n) if self.gl else _tag(self.bm.verts, self.wl, 0)

    def bone(self, name):
        return _tag(self.bm.verts, self.wl, ACC_BONES.index(name))

    def part(self, p):
        return _part(self.bm, self.trim, p)

    def flat(self):
        return _tag(self.bm.faces, self.fl, 1)


def acc_obj(F, name, build, bone=None, lift=True):
    """build(bm, F, A)：建模（世界座標）。bone：整件綁這根骨頭（頭上的、手錶）；lift：要不要 _grp（穿在衣服外面）"""
    bm = bmesh.new()
    trim = bm.verts.layers.float.new('_trim')
    A = Acc(bm, trim, lift)
    build(bm, F, A)
    # 每一塊都是封閉的（管子、方塊、帶子兩端有封口）：面的方向照每塊重算朝外，不必每個建模函式自己排頂點順序
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    bm.verts.index_update()
    gl, wl = A.gl, A.wl
    cen = {}
    if gl:
        for v in bm.verts:
            g = int(round(v[gl]))
            if g > 0:
                cen.setdefault(g, []).append(v.co.copy())
    gw = {g: _skinw(F, sum(c, Vector()) / len(c)) for g, c in cen.items()}
    W = []
    for v in bm.verts:
        b = v[wl]
        if b:
            W.append([(ACC_BONES[b], 1.)])
        elif bone:
            W.append([(bone, 1.)])
        elif gl and v[gl] > .5:
            W.append(gw[int(round(v[gl]))])
        else:
            W.append(_skinw(F, v.co))
    flat = [f[A.fl] for f in bm.faces]
    bm.verts.layers.int.remove(wl)
    bm.faces.layers.int.remove(A.fl)
    me = bpy.data.meshes.new(name)
    bm.normal_update()
    bm.to_mesh(me)
    bm.free()
    for p, fl in zip(me.polygons, flat):
        p.use_smooth = not fl
    o = new_obj(name, me, F)
    for i, ws in enumerate(W):
        for bn, w in ws:
            if w > 1e-4:
                o.vertex_groups[bn].add([i], w, 'REPLACE')
    return o


# ─── 量身體 ───
def _tree(F):
    return _body_bvh(F)[0]


def snap(F, p, off):
    """身體表面離 p 最近那一點沿法線往外 off"""
    loc, n, _, _ = _tree(F).find_nearest(Vector(p))
    return loc + n * off, n


def hit(F, o, d, L=1.):
    loc, n, _, _ = _tree(F).ray_cast(Vector(o), Vector(d).normalized(), L)
    return (loc, n) if loc is not None else (None, None)


def neck_collar(F, n=48):
    """身體上衣的領口那圈（people.py 切的圓領：皮膚區與上衣區交界的頂點，退回皮膚的位置），照繞脖子的角度排好（0 = 正前方，往 +X 繞）；
    回傳 n 個點與中心（x, y）。領帶圈、頸圈、鍊子的起始位置都照這圈：它是脖子根部的自然曲線（前面低在頸窩、兩側高到脖子上）"""
    F._collar = getattr(F, '_collar', {})
    if n in F._collar:
        return F._collar[n]
    me, mw = F.body.data, F.body.matrix_world
    co = _body_bvh(F)[1]
    nkz = F.b('neck_01').z
    # glTF 依材質拆開了頂點：同一個位置（原始座標四捨五入到 0.1 mm）同時出現在皮膚區與上衣區的面上，就是領口
    mats, key = {}, lambda i: tuple(round(c, 4) for c in me.vertices[i].co)
    for p in me.polygons:
        for i in p.vertices:
            mats.setdefault(key(i), (set(), i))[0].add(p.material_index)
    vs = [co[i] for m, i in mats.values() if m >= {SLOT['skin'], SLOT['top']} and co[i].z > nkz - .1 and abs(co[i].x - F.ox) < .13]
    cx, cy = F.ox, sum(p.y for p in vs) / len(vs)
    bins = [[] for _ in range(n)]
    for p in vs:
        a = math.atan2(p.x - cx, -(p.y - cy)) % (2 * math.pi)
        bins[int(a / (2 * math.pi) * n) % n].append(p)
    P = []
    for i, b in enumerate(bins):
        k = 1
        while not b:
            b = bins[(i - k) % n] + bins[(i + k) % n]
            k += 1
        P.append(sum(b, Vector()) / len(b))
    for _ in range(3):
        P = [(P[i - 1] + P[i] * 2 + P[(i + 1) % n]) / 4 for i in range(n)]
    # 左右對稱
    for i in range(1, n // 2):
        a, b = P[i], P[n - i]
        m = Vector(((a.x - cx - (b.x - cx)) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2))
        P[i], P[n - i] = Vector((cx + m.x, m.y, m.z)), Vector((cx - m.x, m.y, m.z))
    P[0].x = P[n // 2].x = cx
    F._collar[n] = (P, cx, cy)
    return F._collar[n]


def acc_neck(F, dz, off, n=48, tilt=0.):
    """領口那圈往上 dz（正前方再往下 tilt，正後方往上 tilt）貼到脖子表面外 off：頸圈、領帶圈"""
    P, cx, cy = neck_collar(F, n)
    out, N = [], []
    for i, p in enumerate(P):
        a = i / n * 2 * math.pi
        q = p + Vector((0, 0, dz - tilt * math.cos(a)))
        # 往脖子中軸收一點再找最近點：領口在斜方肌上，直接往上抬會離脖子很遠
        d = Vector((q.x - cx, q.y - cy, 0.))
        q = q - d.normalized() * .01
        loc, nr = snap(F, q, 0.)
        nr = Vector((nr.x, nr.y, nr.z * .3)).normalized()
        out.append(loc + nr * off)
        N.append(nr)
    return out, N


def neck_axis(F):
    """脖子的中軸（x, y：領口那圈的中心）與前後、左右的半徑（領口往上 4 cm 那圈）"""
    if getattr(F, '_neck', None):
        return F._neck
    P, cx, cy = neck_collar(F)
    R, _ = acc_neck(F, .04, 0., n=48)
    F._neck = (cx, cy, (R[0] - R[24]).length / 2, abs(R[12].x - R[36].x) / 2)
    return F._neck


def ear(F, side=1):
    """耳垂（耳朵最外緣那一圈最低的點，side 1 是左耳 +X）與耳朵外緣的範圍"""
    co, hd = _body_bvh(F)[1], F.b('Head')
    vs = [p for p in co if hd.z < p.z < hd.z + .13 and (p.x - F.ox) * side > .06]
    xm = max((p.x - F.ox) * side for p in vs)
    ev = [p for p in vs if (p.x - F.ox) * side > xm - .012]
    lo = min(ev, key=lambda p: p.z)
    return dict(lobe=lo.copy(), xm=xm, z0=min(p.z for p in ev), z1=max(p.z for p in ev), y0=min(p.y for p in ev), y1=max(p.y for p in ev))


# ─── 線、帶子、鍊子 ───
def resample(P, step, closed=False):
    """折線照弧長每 step 重新取樣"""
    P = [Vector(p) for p in P]
    if closed:
        P = P + [P[0]]
    L = [0.]
    for a, b in zip(P, P[1:]):
        L.append(L[-1] + (b - a).length)
    n = max(2, int(round(L[-1] / step)))
    out, j = [], 0
    for k in range(n if closed else n + 1):
        s = L[-1] * k / n
        while j < len(P) - 2 and L[j + 1] < s:
            j += 1
        t = (s - L[j]) / max(1e-9, L[j + 1] - L[j])
        out.append(P[j].lerp(P[j + 1], min(1., max(0., t))))
    return out


def catmull(P, k=8):
    """導引點之間補 k 個點（Catmull-Rom），背帶的轉彎才是圓的"""
    P = [Vector(p) for p in P]
    out = []
    for i in range(len(P) - 1):
        p0, p1, p2, p3 = P[max(i - 1, 0)], P[i], P[i + 1], P[min(i + 2, len(P) - 1)]
        for j in range(k):
            t = j / k
            out.append(.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3))
    out.append(P[-1])
    return out


def lay(F, guide, off, step=.008, it=10, closed=False):
    """背帶、腰帶：導引點連成平順的線、照 step 重新取樣，貼到身體外 off；再抹平幾輪（只往外推：帶子跨過鎖骨下、腋下的凹處，不陷進去）"""
    P = resample(catmull(guide + [guide[0]] if closed else guide), step, closed)
    P = [snap(F, p, off)[0] for p in P]
    n = len(P)
    for _ in range(it):
        Q = list(P)
        for i in range(n):
            if not closed and i in (0, n - 1):
                continue
            Q[i] = P[i] * .5 + (P[i - 1] + P[(i + 1) % n]) * .25
        P = []
        for q in Q:
            loc, nr = snap(F, q, 0.)
            h = (q - loc).dot(nr)
            P.append(q + nr * (off - h) if h < off else q)
    return P, [snap(F, p, 0.)[1] for p in P]


def drape(F, L, off, n=120, heavy=None, it=420, lean=.3):
    """閉合的鍊子掛在脖子上（位置式物理）：周長 L 的一圈從脖子上方放下來，受重力往下（往前傾 lean），碰到身體就推回表面外 off；
    heavy：正前方那一點的質量倍數（墜子、識別證把多出來的長度拉到胸前）。回傳 n 個點（0 在正前方）與每一點的身體法線"""
    tree = _tree(F)
    cx, cy, ry, rx = neck_axis(F)
    # 起點：領口那圈往上 2 cm、照周長放大成 L（鍊子比領口長的部分在模擬裡垂到胸前）
    C, _, _ = neck_collar(F, n)
    C = [c + Vector((0, 0, .02)) for c in C]
    k = L / sum((C[i] - C[i - 1]).length for i in range(n))
    P = [Vector((cx + (c.x - cx) * k, cy + (c.y - cy) * k, c.z)) for c in C]
    prev = [p.copy() for p in P]
    wi = [1.] * n
    if heavy:
        wi[0] = 1. / heavy
    rest = L / n
    g = Vector((0., -lean, -1.)).normalized() * 9.8 * (1 / 120) ** 2
    def collide(i):
        loc, nr, _, _ = tree.find_nearest(P[i])
        h = (P[i] - loc).dot(nr)
        if h < off:
            P[i] += nr * (off - h)
            prev[i] = prev[i].lerp(P[i], .5)   # 碰到身體有摩擦
    for step in range(it):
        for i in range(n):
            v = (P[i] - prev[i]) * .97
            prev[i] = P[i].copy()
            P[i] += v + g
        for _ in range(6):
            for i in range(n):
                j = (i + 1) % n
                d = P[j] - P[i]
                l = d.length
                if l < 1e-9:
                    continue
                c = (l - rest) / l / (wi[i] + wi[j])
                P[i] += d * c * wi[i]
                P[j] -= d * c * wi[j]
            for i in range(n):
                collide(i)
    # 左右對稱（模擬的數值誤差會讓墜子偏一點點）
    for i in range(1, n // 2 + 1):
        a, b = P[i], P[(n - i) % n]
        m = Vector(((a.x - cx - (b.x - cx)) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2))
        P[i] = Vector((cx + m.x, m.y, m.z))
        P[(n - i) % n] = Vector((cx - m.x, m.y, m.z))
    P[0].x = cx
    return P, [snap(F, p, 0.)[1] for p in P]


def frames(P, N, closed=True):
    """每一點的切線、平貼表面的法線（扣掉切線方向）、側向（n × t）"""
    out, n = [], len(P)
    for i in range(n):
        a = P[(i - 1) % n] if closed or i > 0 else P[i]
        b = P[(i + 1) % n] if closed or i < n - 1 else P[i]
        t = (b - a).normalized()
        nr = (N[i] - t * N[i].dot(t)).normalized()
        out.append((t, nr, nr.cross(t)))
    return out


def strap(bm, P, N, w, th, closed=False, wf=None, cap=True):
    """扁平的帶子：沿中心線 P（已經在表面外 off，off 含半個厚度）寬 w、厚 th，平貼在 N 的切平面上；wf(s) 照弧長比例改寬度"""
    rows = []
    fr = frames(P, N, closed)
    m = len(P)
    for i, (p, (t, nr, b)) in enumerate(zip(P, fr)):
        ww = (wf(i / max(1, m - 1)) if wf else w) / 2
        h = th / 2
        # 順序同 wear.py 的 tube（繞切線右手方向），_skin 出來的面朝外
        rows.append([bm.verts.new(p + nr * h + b * ww), bm.verts.new(p - nr * h + b * ww), bm.verts.new(p - nr * h - b * ww), bm.verts.new(p + nr * h - b * ww)])
    if closed:
        rows.append(rows[0])
    _skin(bm, rows)
    if cap and not closed:
        bm.faces.new(rows[0][::-1])
        bm.faces.new(rows[-1])
    return rows


def clear_width(F, P, N, w, off, it=4, closed=False):
    """帶子的兩緣也要離身體 off：中心線在凹處（女性的乳溝、鎖骨下）時，平貼的帶子兩緣會切進胸口；兩緣量到的不夠就把那一點往外推"""
    for _ in range(it):
        fr = frames(P, N, closed)
        m = len(P)
        for i in range(m):
            t, nr, b = fr[i]
            ww = (w(i / max(1, m - 1)) if callable(w) else w) / 2
            need = 0.
            for s in (-1, -.5, .5, 1):
                q = P[i] + b * (s * ww)
                loc, n2 = snap(F, q, 0.)
                h = (q - loc).dot(n2)
                need = max(need, off - h)
            if need > 0:
                P[i] = P[i] + nr * need
    return P


def link(bm, c, t, n, L, W, r, tw=0., seg=12, sseg=6, flat=.75):
    """一節鍊子：中心 c、長軸 t（半長 L）、寬 W、管徑 r 的橢圓環，平放在 n 的切平面上（往 n 方向壓扁 flat）；tw 繞長軸轉（古巴鍊交扣的斜度）"""
    b = n.cross(t)
    b, n = b * math.cos(tw) + n * math.sin(tw), n * math.cos(tw) - b * math.sin(tw)
    rows = []
    for i in range(seg):
        a = i / seg * 2 * math.pi
        cc = c + t * (L * math.cos(a)) + b * (W * math.sin(a))
        e = (t * (W * math.cos(a)) + b * (L * math.sin(a))).normalized()
        rows.append([bm.verts.new(cc + e * (r * math.cos(k / sseg * 2 * math.pi)) + n * (r * flat * math.sin(k / sseg * 2 * math.pi))) for k in range(sseg)])
    rows.append(rows[0])
    _skin(bm, rows)


def chain_links(bm, A, P, N, step, L, W, r, tw=.35, seg=12, sseg=6, flat=.75, skip=None):
    """沿閉合的線每 step 一節（每節自己一組，各自推、各自取權重），交替繞長軸 ±tw；skip(s)：弧長比例 s 那一節不做（墜子的扣環位置）"""
    Q = resample(P, step, closed=True)
    NQ = [snap_n for snap_n in _near_n(P, N, Q)]
    fr = frames(Q, NQ)
    for i, (q, (t, nr, b)) in enumerate(zip(Q, fr)):
        if skip and skip(i / len(Q)):
            continue
        with A.grp():
            link(bm, q, t, nr, L, W, r, tw * (1 if i % 2 else -1), seg, sseg, flat)
    return Q, NQ


def _near_n(P, N, Q):
    out = []
    for q in Q:
        i = min(range(len(P)), key=lambda k: (P[k] - q).length_squared)
        out.append(N[i])
    return out


def extrude2d(bm, outline, o, u, v, n, th):
    """平面的外形（u, v 座標的折線，可以是凹的）往 n 方向做出厚度 th：十字架這類片狀的東西；o 是中心、u v n 是三個軸"""
    front = [bm.verts.new(o + u * x + v * y + n * (th / 2)) for x, y in outline]
    back = [bm.verts.new(o + u * x + v * y - n * (th / 2)) for x, y in outline]
    m = len(outline)
    es = [bm.edges.new((front[i], front[(i + 1) % m])) for i in range(m)]
    eb = [bm.edges.new((back[i], back[(i + 1) % m])) for i in range(m)]
    f1 = bmesh.ops.triangle_fill(bm, use_beauty=True, use_dissolve=False, edges=es, normal=n)['geom']
    f2 = bmesh.ops.triangle_fill(bm, use_beauty=True, use_dissolve=False, edges=eb, normal=-n)['geom']
    for f in [g for g in f1 if isinstance(g, bmesh.types.BMFace)]:
        if f.normal.dot(n) < 0:
            f.normal_flip()
    for f in [g for g in f2 if isinstance(g, bmesh.types.BMFace)]:
        if f.normal.dot(n) > 0:
            f.normal_flip()
    for i in range(m):
        j = (i + 1) % m
        q = (front[i], back[i], back[j], front[j])
        f = bm.faces.new(q)
        f.normal_update()
        mid = (front[i].co + front[j].co) / 2 - o
        if f.normal.dot(mid - n * mid.dot(n)) < 0:
            f.normal_flip()
    return front, back


def box_at(bm, c, ax, ay, az, hx, hy, hz, r=0.):
    """斜放的方塊（ax、ay、az 是三個軸的單位向量）；r > 0 的話八個角各倒一點圓角（bevel）"""
    from mathutils import Matrix
    m = Matrix((ax * hx * 2, ay * hy * 2, az * hz * 2)).transposed().to_4x4()
    m.translation = c
    ret = bmesh.ops.create_cube(bm, size=1, matrix=m)
    if r > 0:
        vs = ret['verts']
        es = list({e for v in vs for e in v.link_edges})
        bmesh.ops.bevel(bm, geom=vs + es, offset=r, segments=2, affect='EDGES', profile=.5)
    return ret


def cyl_at(bm, c, ax, r1, r2, h, seg=16):
    """沿 ax 的圓柱、圓錐（c 是中心）"""
    from mathutils import Matrix
    z = ax.normalized()
    x = z.orthogonal().normalized()
    y = z.cross(x)
    m = Matrix((x, y, z)).transposed().to_4x4()
    m.translation = c
    bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=r1, radius2=r2, depth=h, matrix=m)


def torus_at(bm, c, ax, R, r, seg=24, sseg=8):
    """環（耳環、扣環）：中心 c、環面的法線 ax"""
    z = ax.normalized()
    x = z.orthogonal().normalized()
    link(bm, c, x, z, R, R, r, 0., seg, sseg, 1.)


def hang_frame(F, p, n, drop, off):
    """墜子、識別證：從鍊子最低那一點 p 往下垂 drop，貼到身體外 off；回傳中心與 (橫, 上, 外) 三個軸"""
    up = Vector((0., 0., 1.))
    v = (up - n * up.dot(n)).normalized()
    c, n2 = snap(F, p - v * drop, off)
    v = (up - n2 * up.dot(n2)).normalized()
    return c, v.cross(n2), v, n2


def neck_front(F):
    """胸骨上的頸窩：脖子正前方往下射，打到身體的那一點（項鍊、領帶的參考高度）"""
    cx, cy, ry, rx = neck_axis(F)
    loc, _ = hit(F, (cx, cy - ry - .012, F.b('neck_01').z + .02), (0, 0, -1), .3)
    return loc


# ─── A-01 古巴鍊：寬版交扣的鍊節（每節自己一組），胸前垂一個滿鑽的錢字墜（S 形加一直槓） ───
def acc_cuban(bm, F, A):
    M = F.g == 'Male'
    P, N = drape(F, .53 if M else .49, .0052, heavy=14, lean=.12)
    with A.part('metal'):
        chain_links(bm, A, P, N, .0082, .0062, .0052, .0026, tw=.42, flat=.62, skip=lambda s: s < .008 or s > .992)
        c, u, v, n = hang_frame(F, P[0], N[0], .034, .0062)
        a, R = .0118, .0029
        with A.grp():
            torus_at(bm, P[0] - v * .002 + n * .001, u, .0048, .0014, seg=14, sseg=6)                  # 扣環
            S = [(a * math.cos(math.radians(t)), a + a * math.sin(math.radians(t))) for t in range(25, 271, 10)]
            S += [(a * math.cos(math.radians(t)), -a + a * math.sin(math.radians(t))) for t in range(90, -156, -10)][1:]
            tube(bm, [c + u * x + v * y for x, y in S], R, seg=8)
            tube(bm, [c + v * (2.55 * a) + n * .0005, c - v * (2.55 * a) + n * .0005], .0021, seg=8)
            tube(bm, [c + v * (2.55 * a), P[0] - v * .006], .0013, seg=6)                                # 墜頭接到扣環


# ─── A-09 三層項鍊：短的珍珠鍊、中長的荊棘銀繩、長的十字架鍊；三條離身體的距離不同，在後頸疊著也不會交錯 ───
def gothic_cross(h, w):
    """哥德十字架的外形（u 橫、v 上，順時針）：四臂等寬，末端外擴成平頭；上臂短、下臂長"""
    a, t, e = w / 2, .0045, .0075
    hu, hd = h * .3, h * .7
    return [(-t, t), (-t, hu - .008), (-e, hu - .002), (-e * .7, hu), (e * .7, hu), (e, hu - .002), (t, hu - .008),
            (t, t), (a - .008, t), (a - .002, e), (a, e * .7), (a, -e * .7), (a - .002, -e), (a - .008, -t),
            (t, -t), (t, -(hd - .008)), (e, -(hd - .002)), (e * .7, -hd), (-e * .7, -hd), (-e, -(hd - .002)), (-t, -(hd - .008)),
            (-t, -t), (-(a - .008), -t), (-(a - .002), -e), (-a, -e * .7), (-a, e * .7), (-(a - .002), e), (-(a - .008), t)]


def acc_layers(bm, F, A):
    M = F.g == 'Male'
    P1, N1 = drape(F, .42 if M else .39, .0058)
    with A.part('pearl'):
        for q in resample(P1, .0096, closed=True):
            with A.grp():
                ball(bm, q, .0043, u=10, v=7)
    P2, N2 = drape(F, .5 if M else .47, .0115)
    Q = resample(P2, .0035, closed=True)
    fr = frames(Q, _near_n(P2, N2, Q))
    with A.part('metal'):
        for k in (0, 1):   # 兩股絞在一起的銀繩
            pts = [q + (nr * math.cos(i * .9 + k * math.pi) + b * math.sin(i * .9 + k * math.pi)) * .0011 for i, (q, (t, nr, b)) in enumerate(zip(Q, fr))]
            tube(bm, pts + pts[:1], .00095, seg=5, close=False)
        for i in range(0, len(Q), 5):   # 荊棘：每 1.75 cm 一根往外斜的小刺
            q, (t, nr, b) = Q[i], fr[i]
            sd = 1 if (i // 5) % 2 else -1
            with A.grp():
                cyl_at(bm, q + (b * sd * .8 + nr * .6).normalized() * .0028, (b * sd * .8 + nr * .6), .001, .0001, .0042, seg=5)
    P3, N3 = drape(F, .68 if M else .64, .0165, heavy=12)
    with A.part('metal'):
        chain_links(bm, A, P3, N3, .0058, .0037, .0024, .00085, tw=math.pi / 4, seg=8, sseg=4, flat=1., skip=lambda s: s < .006 or s > .994)
        c, u, v, n = hang_frame(F, P3[0], N3[0], .036, .0185)
        with A.grp():
            torus_at(bm, P3[0] - v * .002, u, .0038, .0011, seg=12, sseg=5)
            extrude2d(bm, gothic_cross(.058, .04), c + v * .006, u, v, n, .0045)
            tube(bm, [c + v * (.006 + .058 * .3), P3[0] - v * .005], .0012, seg=6)
        with A.grp(), A.part('c'):
            ball(bm, c + v * .006 + n * .0026, .0042, s=(1, 1, .55), u=10, v=6)   # 中間的石榴石


# ─── A-05 尖刺頸圈：脖子中段一圈皮帶，外圈一整圈長尖刺（正前方 ±40° 不放：低頭時下巴不碰），正中一個 D 環 ───
def acc_choker(bm, F, A):
    M = F.g == 'Male'
    nk = F.b('neck_01')
    P, N = acc_neck(F, .034 if M else .03, .0042, n=48)
    strap(bm, P, N, .028, .0032, closed=True)
    with A.part('silver'):
        for i, (p, nr) in enumerate(zip(P, N)):
            a = i / 48 * 2 * math.pi
            if i % 3 or abs(math.atan2(math.sin(a), math.cos(a))) < math.radians(40):
                continue
            with A.grp():
                cyl_at(bm, p + nr * .0024, nr, .0058, .0058, .0012, seg=12)                  # 鉚釘底座
                cyl_at(bm, p + nr * (.0030 + .0085), nr, .0046, .0002, .017, seg=12)        # 尖刺
        with A.grp():
            torus_at(bm, P[0] + N[0] * .0028 - Vector((0, 0, .009)), N[0], .0085, .0016, seg=16, sseg=6)


# ─── A-10 貓耳耳機（掛在脖子上）：耳罩翻平靠在鎖骨上方、頭樑繞過後頸、頭樑頂上一對貓耳；耳罩側面與貓耳內圈發光 ───
def acc_catphones(bm, F, A):
    M = F.g == 'Male'
    C, cx, cy = neck_collar(F, 48)
    cups = []
    for sd in (1, -1):
        # 耳罩靠在鎖骨上：領口那圈離正前方 ±55° 的地方往外 2.5 cm（鎖骨的上面），貼著那裡的表面平放
        p = C[(sd * 7) % 48]
        d = Vector((p.x - cx, p.y - cy, 0.)).normalized()
        loc, nr = snap(F, p + d * .028 + Vector((0, 0, .01)), 0.)
        cups.append((loc, nr.normalized()))
    Rc, Hc = (.041, .03) if M else (.037, .027)
    with A.grp():
        ends = []
        for (loc, nr), sd in zip(cups, (1, -1)):
            c = loc + nr * (Hc / 2 + .004)
            with A.part('cloth'):
                cyl_at(bm, c, nr, Rc, Rc * .96, Hc, seg=28)
            with A.part('glow'):
                torus_at(bm, c, nr, Rc + .0006, .0022, seg=28, sseg=6)                     # 側面的燈環
            with A.part('b'):
                torus_at(bm, c + nr * (Hc / 2 + .004), nr, Rc * .62, .0065, seg=24, sseg=8)  # 朝外的耳墊
            # 耳罩靠脖子那側接頭樑的軸
            d = Vector((cx - c.x, cy - c.y, 0.))
            d = (d - nr * d.dot(nr)).normalized()
            with A.part('silver'):
                cyl_at(bm, c + d * (Rc + .004), d, .0042, .0042, .012, seg=8)
            ends.append(c + d * (Rc + .01))
        # 頭樑：從兩個耳罩靠脖子那側，沿領口往上 1.5 cm 繞過後頸（離皮膚 1.2 cm 起）
        R, NR = acc_neck(F, .016, .0, n=48)
        back = [R[k % 48] + NR[k % 48] * (.012 + .006 * math.sin((k - 12) / 24 * math.pi)) for k in range(12, 37)]
        path = resample(catmull([ends[0]] + back[1:-1] + [ends[1]], 4), .006)
        NN = [snap(F, p, 0.)[1] for p in path]
        NN = [Vector((n.x, n.y, n.z * .3)).normalized() for n in NN]
        with A.part('cloth'):
            strap(bm, path, NN, .03 if M else .027, .009)
        # 貓耳：頭樑正後方兩側往上立起的三角錐（外殼白、內圈發光）
        k0 = len(path) // 2
        for sd in (1, -1):
            j = k0 + sd * max(3, len(path) // 9)
            p, nn = path[j], NN[j]
            up = Vector((0, 0, 1))
            t = up.cross(nn).normalized()
            base = [p + t * .016 + up * .004, p + nn * .007 + up * .004, p - t * .016 + up * .004, p - nn * .007 + up * .004]
            tip = p + up * .036 + nn * .006
            with A.part('cloth'):
                vs = [bm.verts.new(q) for q in base]
                tv = bm.verts.new(tip)
                for a_ in range(4):
                    bm.faces.new((vs[a_], vs[(a_ + 1) % 4], tv))
                bm.faces.new(vs)
            with A.part('glow'):   # 內圈：薄薄一片（兩面），貼在朝外那面
                for dd in (.0004, -.0004):
                    inner = [p + t * .009 + up * .009 + nn * (.0072 + dd), p - t * .009 + up * .009 + nn * (.0072 + dd), p + up * .029 + nn * (.0079 + dd)]
                    fv = [bm.verts.new(q) for q in inner]
                    f = bm.faces.new(fv)


def front_pt(F, x, z, off=0.):
    loc, nr = hit(F, (F.ox + x, -.6, z), (0, 1, 0), 1.2)
    while loc is None and abs(x) > .01:   # 女性的軀幹比較窄：射不到身體就往中線收
        x *= .9
        loc, nr = hit(F, (F.ox + x, -.6, z), (0, 1, 0), 1.2)
    return loc + nr * off


def back_pt(F, x, z, off=0.):
    loc, nr = hit(F, (F.ox + x, .6, z), (0, -1, 0), 1.2)
    while loc is None and abs(x) > .01:   # 腰比較窄：射不到身體就往中線收
        x *= .9
        loc, nr = hit(F, (F.ox + x, .6, z), (0, -1, 0), 1.2)
    return loc + nr * off


def top_pt(F, x, y, z=2.2, off=0.):
    loc, nr = hit(F, (F.ox + x, y, z), (0, 0, -1), 2.)
    return loc + nr * off


def side_pt(F, sd, y, z, off=0.):
    loc, nr = hit(F, (F.ox + sd * .6, y, z), (-sd, 0, 0), .6)
    return loc + nr * off


def trunk_ring(F, z, off, n=64):
    """腰、胸的一圈：從身體中軸（這個高度的前後中點）水平往外射"""
    co = _body_bvh(F)[1]
    vs = [p for p in co if abs(p.z - z) < .01 and abs(p.x - F.ox) < .2]
    cy = (min(p.y for p in vs) + max(p.y for p in vs)) / 2
    P, N = [], []
    for i in range(n):
        a = i / n * 2 * math.pi
        loc, nr = hit(F, (F.ox, cy, z), (math.sin(a), -math.cos(a), 0.), .6)
        nr = Vector((nr.x, nr.y, 0.)).normalized()
        P.append(loc + nr * off)
        N.append(nr)
    return P, N, cy


# ─── A-15 領帶與識別證：領帶圈繞在領口、領結、往下漸寬到皮帶的領帶（+4 mm）；外面一條編織掛繩垂一張透明卡套的識別證（+5.5 mm 以外） ───
def acc_tiebadge(bm, F, A):
    M = F.g == 'Male'
    pel = F.b('pelvis')
    cx, cy, ry, rx = neck_axis(F)
    P, N = acc_neck(F, .016, .0028, n=48)
    strap(bm, P, N, .011, .0022, closed=True)                                   # 領帶圈（襯衫領子的位置）
    zk = P[0].z
    kc, kn = snap(F, (F.ox, P[0].y - .01, zk - .014), .009)
    with A.grp():                                                                 # 領結：上寬下窄的梯形塊
        up = Vector((0, 0, 1))
        u = up.cross(kn).normalized()
        v = kn.cross(u)
        pts = []
        for sv, hw in ((1, .021), (-1, .012)):
            for su in (1, -1):
                for sn in (1, -1):
                    pts.append(kc + v * (sv * .021) + u * (su * hw) + kn * (sn * .0075 * (1 if sv > 0 else .8)))
        vs = [bm.verts.new(p) for p in pts]
        # 0 上右外、1 上右內、2 上左外、3 上左內、4 下右外、5 下右內、6 下左外、7 下左內（面的方向 acc_obj 會重算）
        for q in ((0, 2, 6, 4), (1, 5, 7, 3), (0, 4, 5, 1), (2, 3, 7, 6), (0, 1, 3, 2), (4, 6, 7, 5)):
            bm.faces.new([vs[i] for i in q])
    # 領帶：從領結下緣沿前中線往下到腰帶，寬 3.6 → 8.4 cm，末端是尖的
    z0, z1 = zk - .036, pel.z + (.075 if M else .085)
    guide = [front_pt(F, 0., z0 + (z1 - z0) * t) for t in (0, .25, .5, .75, 1)]
    TP, TN = lay(F, guide, .0062, step=.008)
    ln = len(TP)
    def tw(s):
        w = .036 + .048 * s ** 1.3
        return w * min(1., (1 - s) * ln / 4.5 + .05)
    TP = clear_width(F, TP, TN, tw, .0045)
    strap(bm, TP, TN, .04, .0036, wf=tw)
    # 掛繩：比領帶外一層，正前方垂一張卡（卡套是透明的鏡片部位，卡在裡面）
    LP, LN = drape(F, .56 if M else .52, .0122, heavy=18)
    Q = resample(LP, .006, closed=True)
    keep = [q for i, q in enumerate(Q) if .035 < i / len(Q) < .965]
    with A.part('b'):
        tube(bm, keep, .0019, seg=6, close=True)
        c, u, v, n = hang_frame(F, LP[0], LN[0], .068, .0148)
    with A.grp():
        with A.part('silver'):
            box_at(bm, LP[0] - v * .006, u, v, n, .006, .008, .002)                 # 夾子
            tube(bm, [keep[0], LP[0] - v * .003, keep[-1]], .0016, seg=6)
        with A.part('lens'):
            box_at(bm, c, u, v, n, .029, .045, .0022)
        cv = set(bm.verts)
        box_at(bm, c, u, v, n, .0265, .042, .0009)
        for vv in bm.verts:
            if vv not in cv:
                vv[A.trim] = PART['c'] + .8 * max(0., min(1., ((vv.co - c).dot(v) + .042) / .084))   # 卡面的上下座標（40-people.js 印字用）


# ─── A-03 斜背胸包：左肩繞過背後到右腰的寬背帶（逐點貼著推）、胸前斜放的多夾層小包（整組推）、金屬眼鏡扣與螢光橘飄帶 ───
def acc_sling(bm, F, A):
    M = F.g == 'Male'
    sp1, sp2, sp3 = F.b('spine_01'), F.b('spine_02'), F.b('spine_03')
    cy = sp3.y
    fA = front_pt(F, .07, sp3.z + .075)
    fB = front_pt(F, -.12, sp1.z + .03)
    guide = [fA, top_pt(F, .1, cy - .005), back_pt(F, .085, sp3.z + .05), back_pt(F, 0., sp2.z + .01), back_pt(F, -.11, sp1.z + .02),
             side_pt(F, -1, cy, sp1.z + .03), fB, front_pt(F, -.03, (fA.z + fB.z) / 2 - .01)]
    P, N = lay(F, guide, .0021, step=.008, closed=True)
    P = clear_width(F, P, N, .038 if M else .034, .0021, closed=True)
    with A.part('b'):
        strap(bm, P, N, .038 if M else .034, .0034, closed=True)
    # 小包：沿前面那段的方向斜放
    mid = (fA + fB) / 2
    c0, n = snap(F, mid + Vector((0, 0, .01)), 0.)
    t = (fA - fB)
    t = (t - n * t.dot(n)).normalized()
    b = n.cross(t)
    hx, hy, hz = (.11, .062, .028) if M else (.1, .056, .026)
    c = c0 + n * (.0045 + hz)
    with A.grp():
        with A.part('cloth'):
            box_at(bm, c, t, b, n, hx, hy, hz, r=.012)
            box_at(bm, c + n * (hz + .006) - b * .012, t, b, n, hx * .82, hy * .55, .007, r=.005)        # 前面的拉鍊小袋
        with A.part('silver'):
            tube(bm, [c + n * (hz + .0005) + b * (hy * .78) + t * (hx * .9 * s) for s in (-1, 1)], .0012, seg=5)   # 主拉鍊
            tube(bm, [c + n * (hz + .0135) + b * (hy * .1) + t * (hx * .7 * s) for s in (-1, 1)], .001, seg=5)
            box_at(bm, c + n * (hz + .002) + b * (hy * .78) + t * (hx * .55), t, b, n, .004, .0025, .0018)      # 拉鍊頭
            torus_at(bm, c + n * (hz + .0035) + t * (hx * .55) - b * (hy * .35), n, .0085, .0016, seg=16)        # 眼鏡扣
        with A.part('c'):
            box_at(bm, c + n * (hz + .003) + b * (hy * .78) + t * (hx * .55) - b * .016, t, b, n, .005, .014, .0009)   # 螢光飄帶
    # 背帶上的調節扣（左肩前）
    k = min(range(len(P)), key=lambda i: (P[i] - (fA + Vector((0, .0, .06)))).length)
    with A.grp(), A.part('silver'):
        tq, nq, bq = frames(P, N)[k]
        box_at(bm, P[k] + nq * .0028, tq, bq, nq, .011, (.042 if M else .038) / 2, .0018)


# ─── A-12 滑板後背包：飽滿的包身（背面貼著背的弧度）、正面兩條魔鬼氈綁帶固定一塊塗鴉滑板；肩帶 +8.5 mm 繞過肩膀、腋下回到包底 ───
def acc_skatepack(bm, F, A):
    M = F.g == 'Male'
    sp1, sp2, sp3 = F.b('spine_01'), F.b('spine_02'), F.b('spine_03')
    W, H, D = (.3, .42, .13) if M else (.27, .38, .12)
    ztop = sp3.z + (.105 if M else .095)
    zbot = ztop - H
    off = .013
    nz, ns = 12, 32
    rows = []
    ys = {}
    def yb(x, z):
        k = (round(x, 3), round(z, 3))
        if k not in ys:
            ys[k] = back_pt(F, x, z).y + off
        return ys[k]
    ym = sum(yb(x, (ztop + zbot) / 2) for x in (-W / 3, 0, W / 3)) / 3
    def sec(v):
        """包身第 v（0 底 → 1 頂）圈的頂點座標"""
        k = (1 - abs(2 * v - 1) ** 5) ** .2
        z = zbot + H * v
        Wz, Dz = W * (.86 + .14 * k), D * k
        out = []
        for i in range(ns):
            ph = i / ns * 2 * math.pi
            c, s = math.cos(ph), math.sin(ph)
            ex = math.copysign(abs(c) ** .5, c)
            ey = math.copysign(abs(s) ** .5, s)
            x = ex * Wz / 2
            y0 = max(yb(x, z), ym - .01)
            yf = ym + .006 + Dz * (1 - .12 * ex * ex)
            out.append(Vector((F.ox + x, y0 + (ey + 1) / 2 * max(.004, yf - y0), z)))
        return out
    with A.grp():
        with A.part('cloth'):
            rr = []
            for j in range(nz + 1):
                v = .02 + .96 * j / nz
                rr.append([bm.verts.new(p) for p in sec(v)])
            _skin(bm, rr, cap=(F.ox, ym + D * .45, ztop))
            bc = bm.verts.new((F.ox, ym + D * .45, zbot))
            for i in range(ns):
                bm.faces.new((rr[0][(i + 1) % ns], rr[0][i], bc))
        yfr = ym + .006 + D * .98
        with A.part('b'):
            box_at(bm, Vector((F.ox, yfr - .02, zbot + .07)), Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1)), W * .34, .03, .055, r=.012)   # 前面的小袋
            tube(bm, [Vector((F.ox + x, ym + D * .55, ztop + .004 + .028 * math.sin((x / .045 + 1) / 2 * math.pi))) for x in [-.045 + .009 * i for i in range(11)]], .0055, seg=8)   # 提把
        # 滑板：直立在包的正面，板底（塗鴉）朝外、輪架與輪子在外面；兩端往外翹
        Ld, Wd = (.58, .155) if M else (.52, .145)
        zc = (ztop + zbot) / 2 - .02
        yd = yfr + .008
        dl, dw = 26, 6
        top, bot = [], []
        for i in range(dl + 1):
            s = i / dl
            z = zc - Ld / 2 + Ld * s
            e = abs(2 * s - 1)
            kick = .034 * max(0., (e - .74) / .26) ** 1.6
            wz = Wd / 2 * (1 - max(0., (e - .9) / .1) ** 2 * .55)
            rt, rb = [], []
            for j in range(dw + 1):
                x = -wz + 2 * wz * j / dw
                cup = .004 * (2 * j / dw - 1) ** 2
                y = yd + kick + cup
                frac = PART['c'] + .8 * s
                vt = bm.verts.new((F.ox + x, y, z)); vt[A.trim] = PART['c']     # 砂紙面（貼著包）
                vb = bm.verts.new((F.ox + x, y + .011, z)); vb[A.trim] = frac   # 板底（塗鴉，40-people.js 照上下座標畫）
                rt.append(vt); rb.append(vb)
            top.append(rt); bot.append(rb)
        for i in range(dl):
            for j in range(dw):
                bm.faces.new((top[i][j], top[i + 1][j], top[i + 1][j + 1], top[i][j + 1]))
                bm.faces.new((bot[i][j], bot[i][j + 1], bot[i + 1][j + 1], bot[i + 1][j]))
        for i in range(dl):
            bm.faces.new((top[i][0], bot[i][0], bot[i + 1][0], top[i + 1][0]))
            bm.faces.new((top[i][dw], top[i + 1][dw], bot[i + 1][dw], bot[i][dw]))
        for j in range(dw):
            bm.faces.new((top[0][j], top[0][j + 1], bot[0][j + 1], bot[0][j]))
            bm.faces.new((top[dl][j], bot[dl][j], bot[dl][j + 1], top[dl][j + 1]))
        for sz in (-1, 1):
            zt = zc + sz * Ld * .3
            ya = yd + .011
            with A.part('silver'):
                box_at(bm, Vector((F.ox, ya + .004, zt)), Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1)), .028, .004, .022)
                box_at(bm, Vector((F.ox, ya + .016, zt)), Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1)), .012, .01, .009)
                cyl_at(bm, Vector((F.ox, ya + .026, zt)), Vector((1, 0, 0)), .0075, .0075, Wd * .92, seg=12)
            with A.part('pearl'):
                for sx in (-1, 1):
                    cyl_at(bm, Vector((F.ox + sx * (Wd * .46 + .014), ya + .026, zt)), Vector((1, 0, 0)), .026, .026, .028, seg=20)
        # 兩條魔鬼氈綁帶：繞過滑板正面，兩端收進包的側面
        with A.part('b'):
            for sz in (-1, 1):
                zt = zc + sz * Ld * .12
                pts = [Vector((F.ox + x, yd + .0135 + .003 * (1 - (x / (Wd * .6)) ** 2), zt)) for x in [-Wd * .6 + Wd * 1.2 * i / 10 for i in range(11)]]
                pts = [Vector((F.ox - W * .44, ym + D * .6, zt))] + pts + [Vector((F.ox + W * .44, ym + D * .6, zt))]
                strap(bm, pts, [Vector((0, 1, 0))] * len(pts), .032, .003)
    # 肩帶：從包頂繞過肩膀到胸前、腋下，再回到包底的側角（逐點貼著推；兩端插進包裡）
    for sd in (1, -1):
        guide = [Vector((F.ox + sd * .07, ym + .03, ztop - .03)), top_pt(F, sd * .1, sp3.y + .005), front_pt(F, sd * .105, sp3.z + .03),
                 front_pt(F, sd * .125, sp3.z - .045), side_pt(F, sd, sp3.y + .03, sp3.z - .085), back_pt(F, sd * .135, zbot + .1),
                 Vector((F.ox + sd * .12, ym + .025, zbot + .045))]
        P, N = lay(F, guide[1:-1], .0068, step=.008)
        P = clear_width(F, P, N, .05, .0068)
        P = [guide[0]] + P + [guide[-1]]
        N = [N[0]] + N + [N[-1]]
        with A.part('b'):
            strap(bm, P, N, .055, .0095, wf=lambda s: .05 - .016 * max(0., s - .45) / .55)


# ─── A-08 老花腰包：繫在腰上的皮帶（中間嵌一條黃銅鏈）、肚子前面一個彎月形的貼身腰包（背面照肚子的弧度內凹），上緣雙頭拉鍊 ───
def acc_monobag(bm, F, A):
    M = F.g == 'Male'
    pel = F.b('pelvis')
    zb = pel.z + (.125 if M else .13)
    P, N, cy = trunk_ring(F, zb, .0022, n=72)
    with A.part('b'):
        strap(bm, P, N, .03, .0032, closed=True)
    with A.part('gold'):
        C = [p + nr * .002 for p, nr in zip(P, N)]
        Q = resample(C, .0095, closed=True)
        fr = frames(Q, _near_n(C, N, Q))
        for i, (q, (t, nr, b)) in enumerate(zip(Q, fr)):
            a = math.atan2(q.x - F.ox, -(q.y - cy))
            if abs(a) < .62:      # 包的後面不做鏈子
                continue
            with A.grp():
                link(bm, q + nr * .0008, t, nr, .0062, .0042, .0013, .45 * (1 if i % 2 else -1), 10, 5, .7)
    # 包身：沿腰的角度 -0.6 → 0.6（約 30 cm）的彎月，中間高 12 cm、厚 7 cm，兩端收尖、往上翹（笑臉的弧度）
    nu, nv = 24, 20
    rows = []
    zc = zb + .004
    for i in range(nu + 1):
        u = -1 + 2 * i / nu
        a = u * .62
        k = (1 - abs(u) ** 2.2) ** .55
        h, d = .12 * max(.06, k), .07 * max(.05, k ** 1.3)
        z0 = zc + .03 * u * u
        row = []
        for j in range(nv):
            ph = j / nv * 2 * math.pi
            ez, ed = math.cos(ph), math.sin(ph)
            ez = math.copysign(abs(ez) ** .75, ez)
            loc, nr = hit(F, (F.ox, cy, z0 + ez * h / 2), (math.sin(a), -math.cos(a), 0.), .6)
            nr = Vector((nr.x, nr.y, 0.)).normalized()
            row.append(loc + nr * (.006 + .0035 + (ed + 1) / 2 * d * (1 - .25 * abs(ez) ** 2)))
        rows.append(row)
    with A.grp():
        with A.part('cloth'):
            vs = [[bm.verts.new(p) for p in r] for r in rows]
            for i in range(nu):
                for j in range(nv):
                    jn = (j + 1) % nv
                    bm.faces.new((vs[i][j], vs[i][jn], vs[i + 1][jn], vs[i + 1][j]))
            for r, sg in ((vs[0], -1), (vs[-1], 1)):
                c = bm.verts.new(sum((v.co for v in r), Vector()) / nv)
                for j in range(nv):
                    bm.faces.new((r[j], r[(j + 1) % nv], c))
        # 上緣的皮革滾邊與拉鍊、兩個拉鍊頭
        j_top = 0
        seam = [rows[i][j_top] for i in range(1, nu)]
        with A.part('b'):
            tube(bm, seam, .0028, seg=6)
            tube(bm, [rows[i][nv // 2] for i in range(1, nu)], .0026, seg=6)
        with A.part('gold'):
            for i in (nu // 2 - 3, nu // 2 + 3):
                p = rows[i][1]
                n2 = (rows[i][2] - rows[i][0]).normalized()
                tt = (rows[i + 1][1] - rows[i - 1][1]).normalized()
                box_at(bm, p + n2 * .002, tt, n2.cross(tt).normalized(), n2, .004, .007, .002)
                torus_at(bm, p + n2 * .003 - Vector((0, 0, .012)), n2, .0035, .001, seg=10, sseg=4)
            # 正面的金屬銘牌
            pm = rows[nu // 2][nv // 4]
            nm = (rows[nu // 2][nv // 4] - rows[nu // 2][nv * 3 // 4]).normalized()
            box_at(bm, pm + nm * .001, Vector((1, 0, 0)), Vector((0, 0, 1)), nm, .018, .006, .0012)


# ─── A-14 腰間方巾：右前褲耳綁一個結，對折的三角方巾垂在右大腿外側（權重照身體：上面跟骨盆、下面跟右大腿，邁步時跟著擺） ───
def acc_bandana(bm, F, A):
    M = F.g == 'Male'
    pel = F.b('pelvis')
    zk = pel.z + (.06 if M else .07)
    xk = -(.115 if M else .11)
    kp = front_pt(F, xk, zk)
    L, W0 = (.25, .15) if M else (.23, .14)
    nl, nw = 18, 9
    tip = side_pt(F, -1, kp.y + .035, zk - L, 0.)
    out, inn = [], []
    for i in range(nl + 1):
        s = i / nl
        c = kp.lerp(tip, s)
        w = W0 * (1 - s) ** .9 + .004
        ro, ri = [], []
        c0, n0 = snap(F, c, 0.)
        across = (tip - kp).normalized().cross(n0).normalized()
        for j in range(nw + 1):
            t = -1 + 2 * j / nw
            q = c0 + across * (t * w / 2)
            p, nr = snap(F, q, 0.)
            h = .0055 + .0028 * math.sin(t * math.pi * 2.5 + s * 4) * (1 - abs(t)) + .006 * (1 - s) ** 3
            ro.append(p + nr * h)
            ri.append(p + nr * (h - .0018))
        out.append(ro)
        inn.append(ri)
    with A.part('cloth'):
        vo = [[bm.verts.new(p) for p in r] for r in out]
        vi = [[bm.verts.new(p) for p in r] for r in inn]
        for i in range(nl):
            for j in range(nw):
                bm.faces.new((vo[i][j], vo[i][j + 1], vo[i + 1][j + 1], vo[i + 1][j]))
                bm.faces.new((vi[i][j], vi[i + 1][j], vi[i + 1][j + 1], vi[i][j + 1]))
        for i in range(nl):
            bm.faces.new((vo[i][0], vo[i + 1][0], vi[i + 1][0], vi[i][0]))
            bm.faces.new((vo[i][nw], vi[i][nw], vi[i + 1][nw], vo[i + 1][nw]))
        for j in range(nw):
            bm.faces.new((vo[0][j], vi[0][j], vi[0][j + 1], vo[0][j + 1]))
            bm.faces.new((vo[nl][j], vo[nl][j + 1], vi[nl][j + 1], vi[nl][j]))
    # 結：褲耳上一團（兩顆壓扁的球）加兩條短的角
    c, nr = snap(F, kp, .011)
    with A.grp(), A.part('cloth'):
        ball(bm, c, .014, s=(1, .8, .75), u=12, v=8)
        ball(bm, c + Vector((0, 0, -.012)) + nr * .002, .011, s=(.9, .75, .8), u=10, v=7)
    for sd in (1, -1):
        p0 = c + Vector((sd * .012, 0, -.004))
        pts = [snap(F, p0 + Vector((sd * .012 * k, 0, -.018 * k)), .0075 + .002 * (1 - k))[0] for k in (0, .5, 1)]
        tube(bm, pts, .0045, seg=7)


# ─── A-02 八角錶：綁在左前臂靠手腕（整塊硬的），八角錶圈與八顆六角螺絲、一體式金屬錶帶（一節一節）、鏤空錶盤看得到齒輪與陀飛輪、藍寶石鏡面 ───
def acc_octawatch(bm, F, A):
    M = F.g == 'Male'
    hd, la = F.b('hand_l'), F.b('lowerarm_l')
    xw = hd.x - (.032 if M else .029)
    co = _body_bvh(F)[1]
    s = [p for p in co if abs(p.x - xw) < .004 and abs(p.y - hd.y) < .06 and abs(p.z - hd.z) < .06]
    cyw, czw = (min(p.y for p in s) + max(p.y for p in s)) / 2, (min(p.z for p in s) + max(p.z for p in s)) / 2
    ax = Vector((1, 0, 0))
    nseg = 24
    R = []
    for i in range(nseg):
        a = i / nseg * 2 * math.pi           # 0 = 手背（+Z），往 -Y（拇指那側）繞
        d = Vector((0, -math.sin(a), math.cos(a)))
        loc, nr = hit(F, (xw, cyw, czw), d, .2)
        R.append((loc - Vector((xw, cyw, czw))).length)
    cen = Vector((xw, cyw, czw))
    gap = .0019
    with A.grp():
        with A.part('metal'):
            for i in range(nseg):
                a = (i + .5) / nseg * 2 * math.pi
                if math.cos(a) > .93:        # 錶殼正下方不做錶帶
                    continue
                d = Vector((0, -math.sin(a), math.cos(a)))
                r = (R[i] + R[(i + 1) % nseg]) / 2 + gap + .0019
                tg = ax.cross(d)
                seg = 2 * math.pi * r / nseg
                wb = (.0105 if M else .0092) * (1 - .18 * (1 - math.cos(a)) / 2)
                box_at(bm, cen + d * r, tg, ax, d, seg / 2 - .00035, wb, .0019)
                box_at(bm, cen + d * (r + .0021), tg, ax, d, seg / 2 - .0012, wb * .45, .0004)          # 中間那排拋光的節
            # 錶殼：八角柱（高 8.5 mm），上面一圈八角錶圈與八顆六角螺絲
            Rc = .02 if M else .0175
            top_r = R[0] + gap + .0038
            c0 = cen + Vector((0, 0, top_r))
            def octa(r, rot=math.pi / 8):
                return [(r * math.cos(rot + k * math.pi / 4), r * math.sin(rot + k * math.pi / 4)) for k in range(8)]
            z = Vector((0, 0, 1))
            u, v = Vector((1, 0, 0)), Vector((0, 1, 0))
            extrude2d(bm, octa(Rc * 1.04), c0 + z * .003, u, v, z, .006)
            extrude2d(bm, octa(Rc * .98), c0 + z * .0068, u, v, z, .0016)
            cyl_at(bm, c0 + z * .003 + u * (Rc * 1.06 + .0015), u, .0021, .0021, .004, seg=10)            # 錶冠（朝手那側）
        with A.part('silver'):
            for k in range(8):
                a = math.pi / 8 + k * math.pi / 4
                cyl_at(bm, c0 + z * .0078 + (u * math.cos(a) + v * math.sin(a)) * Rc * .82, z, .0013, .0013, .0007, seg=6)
        with A.part('c'):
            cyl_at(bm, c0 + z * .0046, z, Rc * .78, Rc * .78, .0008, seg=24)                                 # 鏤空錶盤的底板
        with A.part('gold'):
            for (gx, gy, gr, nt) in ((-.35, .3, .3, 14), (.38, .22, .24, 12), (0, -.42, .26, 0)):
                gc = c0 + z * .0054 + (u * gx + v * gy) * Rc
                torus_at(bm, gc, z, Rc * gr, .00045, seg=20, sseg=4)
                for k in range(nt):
                    aa = k / max(1, nt) * 2 * math.pi
                    dd = u * math.cos(aa) + v * math.sin(aa)
                    box_at(bm, gc + dd * Rc * (gr + .045), dd, dd.cross(z), z, .00045, .00035, .0003)
                if nt == 0:   # 陀飛輪的框：三支臂
                    for k in range(3):
                        aa = k / 3 * 2 * math.pi
                        dd = u * math.cos(aa) + v * math.sin(aa)
                        box_at(bm, gc + dd * Rc * gr * .5 + z * .0006, dd, dd.cross(z), z, Rc * gr * .5, .00035, .00025)
            for k in range(12):   # 時標
                aa = k / 12 * 2 * math.pi
                dd = u * math.cos(aa) + v * math.sin(aa)
                box_at(bm, c0 + z * .0056 + dd * Rc * .68, dd, dd.cross(z), z, .0016, .0004, .0003)
            box_at(bm, c0 + z * .0062 + v * Rc * .2, v, -u, z, Rc * .32, .0005, .0002)
            box_at(bm, c0 + z * .0064 + u * Rc * .26, u, v, z, Rc * .45, .00045, .0002)
        with A.part('lens'):
            extrude2d(bm, octa(Rc * .8), c0 + z * .0072, u, v, z, .0009)


# ─── A-04 超大圈圈金耳環：直徑 6.5 cm 的細環，從耳垂穿過、往外偏 10°（只綁頭） ───
def acc_hoops(bm, F, A):
    for sd in (1, -1):
        e = ear(F, sd)
        lobe = e['lobe'] + Vector((-sd * .002, 0, .003))
        R = .0325
        tl = math.radians(10)
        d = Vector((sd * math.sin(tl), 0, -math.cos(tl)))
        c = lobe + d * R
        n = d.cross(Vector((0, 1, 0))).normalized()
        with A.part('metal'):
            torus_at(bm, c, n, R, .0017, seg=64, sseg=8)


# ─── A-13 水鑽流蘇耳掛：左耳的耳骨夾（沿耳朵上緣到後緣的一道彎，鑲一排小鑽），下緣垂五條長短交錯的梨形水鑽流蘇；
#     最長那條的末端比肩膀高 3 cm（量耳朵正下方肩膀的高度），轉頭、歪頭時不碰肩膀 ───
def acc_earcuff(bm, F, A):
    e = ear(F, 1)
    co = _body_bvh(F)[1]
    ev = [p for p in co if F.b('Head').z < p.z < F.b('Head').z + .13 and p.x - F.ox > e['xm'] - .012]
    yc, zc = (e['y0'] + e['y1']) / 2, (e['z0'] + e['z1']) / 2
    xr = F.ox + e['xm'] - .002
    outline = []
    for k in range(40):
        a = math.radians(115 - 160 * k / 39)     # 從前上緣（115°）經過正上方、後緣，到後下（-45°）；0° 朝後（+Y）
        dy, dz = math.cos(a), math.sin(a)
        rmax = max((((p.y - yc) * dy + (p.z - zc) * dz) for p in ev if abs((p.y - yc) * dz - (p.z - zc) * dy) < .004), default=.012)
        outline.append(Vector((xr, yc + dy * (rmax + .0012), zc + dz * (rmax + .0012))))
    for _ in range(3):
        outline = [outline[0]] + [(outline[i - 1] + outline[i] * 2 + outline[i + 1]) / 4 for i in range(1, len(outline) - 1)] + [outline[-1]]
    with A.part('silver'):
        tube(bm, outline[4:], .0021, seg=8)
        tube(bm, [p + Vector((-.0045, 0, 0)) for p in outline[4:30]], .0015, seg=6)    # 夾在耳後的那一道
    with A.part('cloth'):
        for p in outline[5::2]:
            ball(bm, p + Vector((.0016, 0, 0)), .0017, u=8, v=5)
    sh, _ = hit(F, (xr + .006, yc, e['z0'] - .01), (0, 0, -1), .4)
    zmin = (sh.z if sh is not None else e['z0'] - .2) + .03
    tops = outline[-12::3][:5]
    for k, p0 in enumerate(tops):
        L = (e['z0'] - zmin) * (.5, .78, 1., .7, .42)[k]
        p0 = Vector((xr + .004, p0.y, min(p0.z, e['z0'] + .004)))
        n = max(2, int(L / .0095))
        with A.part('silver'):
            tube(bm, [p0, p0 - Vector((0, 0, L - .006))], .00045, seg=4)
        with A.part('cloth'):
            for i in range(1, n):
                q = p0 - Vector((0, 0, L * i / n))
                big = i == n - 1
                r = .0034 if big else .0019
                ball(bm, q - Vector((0, 0, r * .4)), r, s=(1, 1, 1.45), u=8, v=6)
                cyl_at(bm, q + Vector((0, 0, r * .55)), Vector((0, 0, 1)), r * .75, .0003, r * 1.2, seg=6)


# ─── A-07 賽博半面罩：包住鼻樑到下巴的稜角呼吸器（平面著色的大塊面）、兩側往下斜的圓柱濾罐（外緣紫紅燈環）、正前方六角呼氣閥、
#     繞到後腦的細綁帶；上緣在墨鏡的鼻墊以下，帽子、墨鏡一起戴都不碰 ───
def acc_cybermask(bm, F, A):
    M = F.g == 'Male'
    E = EYES[F.g]
    hd = F.b('Head')
    H = head_frame(F)
    cx, cyh = F.ox, H['cy']
    zt = E['z'] - (.024 if M else .022)
    # 下巴的下緣：從正前方往後射，前臉的 y 突然往後跳（打到脖子）的那個高度
    zc, prev = None, None
    for i in range(80):
        z = zt - .02 - i * .0015
        loc, _ = hit(F, (cx, -.6, z), (0, 1, 0), 1.)
        if prev is not None and loc is not None and loc.y - prev > .025:   # 下唇下的凹溝只有 1 cm
            zc = z
            break
        prev = loc.y if loc is not None else prev
    zc = zc if zc is not None else zt - .09
    zb = zc - .006
    na, nz = 11, 7
    amax = math.radians(64)
    # 細取樣臉的表面（離中軸多遠），每個粗格點取鄰近細樣本的最大值：大塊面也蓋得住鼻尖
    def rad(a, z):
        loc, _ = hit(F, (cx, cyh, z), (math.sin(a), -math.cos(a), 0.), .3)
        return (Vector((loc.x - cx, loc.y - cyh, 0))).length if loc is not None else .05
    rows = []
    for j in range(nz + 1):
        v = j / nz
        z = zb + (zt - zb) * v
        row = []
        for i in range(na + 1):
            a = -amax + 2 * amax * i / na
            amx = amax / na
            hz = (zt - zb) / nz
            zs = [max(zc + .002, z + dz * hz) for dz in (-.5, -.25, 0, .25, .5)]
            edge = i in (0, na) or j == nz
            if edge:   # 邊緣貼著臉（側邊靠著顴骨與下顎、上緣壓在鼻樑上）
                r = rad(a, max(zc + .002, z)) + .0032
            else:
                r = max(rad(a + da * amx, zz) for da in (-.5, -.25, 0, .25, .5) for zz in zs)
                r += .0065 + .004 * math.cos(a) ** 4 * (1 - abs(2 * v - .9))     # 正面再鼓一點（口鼻前的空間）
            if z < zc + .004:
                r -= (zc + .004 - z) * 2.2
            row.append(Vector((cx + math.sin(a) * r, cyh - math.cos(a) * r, z)))
        rows.append(row)
    with A.flat(), A.part('cloth'):
        out = [[bm.verts.new(p) for p in r] for r in rows]
        inn = [[bm.verts.new((cx + (p.x - cx) * (1 - .004 / max(.01, math.hypot(p.x - cx, p.y - cyh))), cyh + (p.y - cyh) * (1 - .004 / max(.01, math.hypot(p.x - cx, p.y - cyh))), p.z)) for p in r] for r in rows]
        for j in range(nz):
            for i in range(na):
                bm.faces.new((out[j][i], out[j][i + 1], out[j + 1][i + 1], out[j + 1][i]))
                bm.faces.new((inn[j][i], inn[j + 1][i], inn[j + 1][i + 1], inn[j][i + 1]))
        for j in range(nz):
            bm.faces.new((out[j][0], out[j + 1][0], inn[j + 1][0], inn[j][0]))
            bm.faces.new((out[j][na], inn[j][na], inn[j + 1][na], out[j + 1][na]))
        for i in range(na):
            bm.faces.new((out[0][i], inn[0][i], inn[0][i + 1], out[0][i + 1]))
            bm.faces.new((out[nz][i], out[nz][i + 1], inn[nz][i + 1], inn[nz][i]))
    # 濾罐：兩頰下方，往外、往前、往下斜
    zm = zc + (zt - zc) * .35
    for sd in (1, -1):
        a = sd * math.radians(42)
        r0 = (rows[2][int((a + amax) / (2 * amax) * na)] - Vector((cx, cyh, rows[2][0].z))).length
        d = Vector((math.sin(a) * .8, -math.cos(a) * .8, -.4)).normalized()
        base = Vector((cx + math.sin(a) * (r0 - .004), cyh - math.cos(a) * (r0 - .004), zm))
        with A.part('b'):
            cyl_at(bm, base + d * .012, d, .0175, .0175, .024, seg=16)
        with A.part('cloth'):
            cyl_at(bm, base + d * .032, d, .0205, .0205, .018, seg=16)
        with A.part('glow'):
            torus_at(bm, base + d * .0415, d, .0185, .0017, seg=20, sseg=6)
            cyl_at(bm, base + d * .0405, d, .011, .011, .0012, seg=12)
    with A.part('b'):
        r0 = (rows[3][na // 2] - Vector((cx, cyh, rows[3][0].z))).length
        c = Vector((cx, cyh - r0 - .003, zc + (zt - zc) * .4))
        cyl_at(bm, c, Vector((0, -1, 0)), .012, .0105, .007, seg=6)
    with A.part('glow'):
        cyl_at(bm, c + Vector((0, -.0038, 0)), Vector((0, -1, 0)), .0045, .0045, .0008, seg=6)
    # 綁帶：從面罩兩側往後繞過後腦（耳垂下面）
    zs = ear(F, 1)['z0'] - .006
    pts = []
    for k in range(25):
        a = amax - .05 + (2 * math.pi - 2 * amax + .1) * k / 24
        loc, nr = hit(F, (cx, cyh, zs + (zt - zs) * .0), (math.sin(a), -math.cos(a), 0), .3)
        pts.append(loc + Vector((nr.x, nr.y, 0)).normalized() * .0025)
    with A.part('b'):
        strap(bm, pts, [Vector((p.x - cx, p.y - cyh, 0)).normalized() for p in pts], .011, .0016)


# ─── A-11 露指皮手套：手掌、手背與五指的第一節是身體表面長出來的殼（往外 2.2 mm、邊緣往內折），第二節以後露出來；
#     手背兩個透氣圓孔、指根一排金屬護塊、手腕的魔鬼氈扣帶（配色） ───
FAR_FINGER = ('index_02', 'index_03', 'index_04', 'middle_02', 'middle_03', 'middle_04', 'ring_02', 'ring_03', 'ring_04',
              'pinky_02', 'pinky_03', 'pinky_04', 'thumb_03', 'thumb_04')   # 前綴：指尖那根是 *_04_leaf_l


def acc_gloves(F, name):
    from mathutils.bvhtree import BVHTree
    src = F.body
    me = src.data.copy()
    me.name = name
    bm = bmesh.new()
    bm.from_mesh(me)
    lu, lm = bm.verts.layers.float_vector.get('_UNPUFF'), bm.verts.layers.float.get('_PMASK')
    for v in bm.verts:
        if v[lm] > .5:
            v.co -= v[lu]
    for k in ('_UNPUFF', '_UNORM'):
        if bm.verts.layers.float_vector.get(k):
            bm.verts.layers.float_vector.remove(bm.verts.layers.float_vector[k])
    if bm.verts.layers.float.get('_PMASK'):
        bm.verts.layers.float.remove(bm.verts.layers.float['_PMASK'])
    bm.transform(src.matrix_world)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    dl = bm.verts.layers.deform.verify()
    vg = src.vertex_groups
    far = {g.index for g in vg if g.name.startswith(FAR_FINGER)}
    hx = abs(F.b('hand_l').x - F.ox)
    # 先粗切：離手太遠的面整片丟掉
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if all(abs(v.co.x - F.ox) < hx - .06 for v in f.verts)], context='FACES')
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    tree = BVHTree.FromBMesh(bm)
    wfar = {v: sum(w for g, w in v[dl].items() if g in far) for v in bm.verts}
    kd = None
    from mathutils.kdtree import KDTree
    kd = KDTree(len(bm.verts))
    for i, v in enumerate(bm.verts):
        kd.insert(v.co, i)
    kd.balance()
    vl = list(bm.verts)
    ww = [wfar[v] for v in vl]
    zt = F.b('hand_l').z
    vents = [(F.b('hand_l').x - F.ox + d, F.b('middle_01_l').y + dy) for d, dy in ((.05, -.012), (.05, .014))]
    def g(p):
        acc = tot = 0.
        for _, i, d in kd.find_n(p, 4):
            w = 1 / (d + 1e-4)
            acc += ww[i] * w
            tot += w
        x = abs(p.x - F.ox)
        cut = max(acc / tot - .5, (hx - .032) - x)
        # 手背的透氣孔（手背朝 +Z）
        for vx, vy in vents:
            if p.z > zt - .005:
                cut = max(cut, .0062 - math.hypot(x - vx, p.y - vy))
        return cut
    bmesh.ops.triangulate(bm, faces=bm.faces[:])
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if all(g(v.co) > .05 for v in f.verts)], context='FACES')
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    _cut_field(bm, g)
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if sum(g(v.co) for v in f.verts) / len(f.verts) > 0], context='FACES')
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    bm.normal_update()
    trim = bm.verts.layers.float.new('_trim')
    gl = bm.verts.layers.float.new('_grp')
    pre = {v: v.co.copy() for v in bm.verts}
    nrm = {v: v.normal.copy() for v in bm.verts}
    amt = {v: .0022 for v in bm.verts}
    for v in bm.verts:
        v.co += nrm[v] * amt[v]
    _fold_rim(bm, [e for e in bm.edges if e.is_boundary], nrm, amt, .0015)
    # 手腕的扣帶（配色）：手腕往上 1.2～3.0 cm 那圈再貼一層
    base = [f for f in bm.faces if all(v in pre for v in f.verts)]
    band = [f for f in base if all(hx - .03 < abs(pre[v].x - F.ox) < hx - .012 for v in f.verts)]
    _patch(bm, band, .0018, .001, trim, PART['b'], nrm)
    _reweight(F, bm, pre)
    # 指根的金屬護塊：每根手指（食指到小指）根部的手背上一塊圓角方塊，綁手掌那根骨頭
    for sd, s in (('l', 1), ('r', -1)):
        hb = vg['hand_' + sd].index
        for fn in ('index', 'middle', 'ring', 'pinky'):
            b0 = F.b(f'{fn}_01_{sd}')
            p = Vector((b0.x - s * .011, b0.y, b0.z + .03))
            loc, nr, _, _ = tree.ray_cast(p, Vector((0, 0, -1)), .06)
            if loc is None:
                continue
            old = set(bm.verts)
            box_at(bm, loc + Vector((0, 0, .0022 + .0032)), Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1)), .0055, .0082, .0028, r=.0018)
            for v in bm.verts:
                if v not in old:
                    v[trim] = PART['silver']
                    d = v[dl]
                    d.clear()
                    d[hb] = 1.
    bm.normal_update()
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = True
    return new_obj(name, me, F)


# ─── A-06 防彈戰術背心：身體上衣區長出來的無袖殼（往外 1.2 cm，40-people.js 再推到外套外面），前胸三個步槍彈匣袋、
#     左胸對講機、右側震撼彈、胸前一排黃銅彈殼；MOLLE 織帶是布面的圖案 ───
def acc_vest(F, g):
    M = g == 'Male'
    pel, sp3 = F.b('pelvis'), F.b('spine_03')
    waist = pel.z + (.075 if M else .085)
    sc = lambda D, B=.0: (lambda a: .004 + D * max(0., math.cos(a)) ** 2 + B * max(0., -math.cos(a)) ** 2)
    def extra(bm, trim, ctx):
        A = Acc(bm, trim, True)
        def pouch(x, z, hx, hz, d, part='b', side=None):
            p = front_pt(F, x, z) if side is None else side_pt(F, side, sp3.y, z)
            c, n = snap(F, p, .0125 + d + .0015)
            t = Vector((0, 0, 1))
            t = (t - n * t.dot(n)).normalized()
            b = t.cross(n)
            with A.grp(), A.part(part):
                box_at(bm, c, b, t, n, hx, hz, d, r=.004)
                box_at(bm, c + t * (hz - .006) + n * (d + .0012), b, t, n, hx * 1.02, .011, .0015, r=.001)   # 袋蓋
            return c, b, t, n
        for x in (-.075, 0., .075):
            c, b, t, n = pouch(x * (1 if M else .92), waist + (.11 if M else .1), .031, .058, .016)
        c, b, t, n = pouch(.09 if M else .085, sp3.z + .05, .022, .036, .014)          # 對講機
        with A.grp(), A.part('c'):
            cyl_at(bm, c + t * (.036 + .03) + b * .01, t, .0028, .0022, .06, seg=8)
        c, b, t, n = pouch(0, waist + .06, .025, .025, .019, side=-1)                     # 右側的震撼彈
        with A.grp(), A.part('c'):
            cyl_at(bm, c + n * .005 + t * .02, t, .019, .019, .07, seg=14)
        with A.grp(), A.part('gold'):
            for k in range(6):
                p, n = snap(F, front_pt(F, -.1 + .014 * k if M else -.095 + .013 * k, sp3.z + .03), .0125 + .006)
                cyl_at(bm, p, Vector((0, 0, 1)), .0052, .0052, .032, seg=10)
        for k in ('_wb',):
            bm.verts.layers.int.remove(bm.verts.layers.int[k])
        bm.faces.layers.int.remove(bm.faces.layers.int['_flat'])
    shell(F, f'W_plate_vest_{g}', ['top'], cov=1, off=lambda p: .0125, smooth=5, rim=.007,
          fields=[neckline(sc(.06, .02)), armhole(F, .14 if M else .125, .115), below(waist + .012)],
          patches=[(lambda p, ctx: abs(abs(p.x - F.ox) - (.11 if M else .1)) - .035 if p.z > sp3.z + .09 else 1., .003, .002, 'b')],   # 肩墊
          extra=extra)


def build_acc(F, g):
    S = lambda k: f'W_{k}_{g}'
    acc_obj(F, S('cuban_link'), acc_cuban)
    acc_obj(F, S('octawatch'), acc_octawatch, bone='lowerarm_l')
    acc_obj(F, S('sling'), acc_sling)
    acc_obj(F, S('hoops'), acc_hoops, bone='Head', lift=False)
    acc_obj(F, S('choker'), acc_choker)
    acc_vest(F, g)
    acc_obj(F, S('cybermask'), acc_cybermask, bone='Head', lift=False)
    acc_obj(F, S('monobag'), acc_monobag)
    acc_obj(F, S('cross_layers'), acc_layers)
    acc_obj(F, S('catphones'), acc_catphones, bone='spine_03')
    acc_gloves(F, S('biker_gloves'))
    acc_obj(F, S('skatepack'), acc_skatepack)
    acc_obj(F, S('earcuff'), acc_earcuff, bone='Head', lift=False)
    acc_obj(F, S('bandana'), acc_bandana)
    acc_obj(F, S('tiebadge'), acc_tiebadge)
