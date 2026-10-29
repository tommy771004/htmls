# 墨鏡（short.md 的 G-01～G-15）：wear.py 用 exec 載入，共用它的工具（_skin、_part、tube、ball、cube、cyl、ring、PART、EYES…）
# 全部綁在 Head。座標：X 往角色的左（+）右（-）、-Y 是正前方、Z 朝上；女性骨架在檔案裡平移了 1.2 m（fig.ox）
# 一副眼鏡的量法：瞳孔（EYES 的 px、z）、鏡片平面在眼球前 15 mm（但至少在眉骨前 4 mm，眉毛才不會穿出鏡框）、
# 鏡片往兩側微微包向太陽穴（WRAP）、鏡腳沿頭側的寬度往後再多 5.5 mm、掛在耳朵根部後往下彎
WRAP = 2.2


def eye_frame(fig):
    if getattr(fig, '_E', None):
        return fig._E
    E = dict(EYES[fig.g])
    E['x'] = fig.ox
    E['ly'] = min(E['ey'] - .015, E['by'] - .004)
    mw = fig.body.matrix_world
    P = [mw @ v.co for v in fig.body.data.vertices]
    # 頭側的寬度（眼睛到眼睛上 2 cm 的高度、耳朵以前）
    side = []
    for k in range(10):
        yy = -.085 + k * .01
        q = [abs(p.x - fig.ox) for p in P if abs(p.z - E['z'] - .01) < .014 and abs(p.y - yy) < .006]
        side.append([yy, max(q) if q else None])
    for i in range(len(side)):            # 量不到的用前一格；往後只會更寬
        if side[i][1] is None:
            side[i][1] = side[i - 1][1] if i else .05
        if i:
            side[i][1] = max(side[i][1], side[i - 1][1])
    E['side'] = side
    # 耳朵：眼睛高度上下 3 cm 內最外側的點；耳朵頂是那附近往外突出的頂點最高的
    ear = max((p for p in P if abs(p.z - E['z']) < .03 and p.y > -.02), key=lambda p: abs(p.x - fig.ox))
    top = [p.z for p in P if abs(p.x - fig.ox) > abs(ear.x - fig.ox) - .008 and abs(p.y - ear.y) < .025 and p.z > ear.z]
    E['ear'] = (ear.y, abs(ear.x - fig.ox), max(top) if top else ear.z + .015)
    fig._E = E
    return E


def side_at(E, y):
    s = E['side']
    if y <= s[0][0]:
        return s[0][1]
    for (y0, x0), (y1, x1) in zip(s, s[1:]):
        if y <= y1:
            return x0 + (x1 - x0) * (y - y0) / (y1 - y0)
    return s[-1][1]


def gw(E, X, v, dy=0., wrap=WRAP):
    """X：離中線的距離（帶正負號），v：離瞳孔的高度，dy：往後（+）往前（-）"""
    return Vector((E['x'] + X, E['ly'] + wrap * X * X + dy, E['z'] + v))


def gp(E, s, u, v, dy=0., wrap=WRAP):
    """一邊鏡片的座標：s 是哪一邊（+1 左、-1 右），u 從瞳孔往太陽穴，v 往上"""
    return gw(E, s * (E['px'] + u), v, dy, wrap)


# ─── 鏡片外形：(u, v) 一圈，逆時針（從外側中間開始，先往上）───
def outline(f, n=48):
    return [f(i / n * 2 * math.pi) for i in range(n)]


def sup(w, h, e, a):
    c, s = math.cos(a), math.sin(a)
    return (w * math.copysign(abs(c) ** (2 / e), c), h * math.copysign(abs(s) ** (2 / e), s))


def poly(corners, n=48):
    """多邊形的角（逆時針）沿周長重新取 n 個點（鏡片的扇形三角才不會太尖）"""
    segs = list(zip(corners, corners[1:] + corners[:1]))
    L = [math.hypot(b[0] - a[0], b[1] - a[1]) for a, b in segs]
    tot, out = sum(L), []
    for i in range(n):
        d = i / n * tot
        for (a, b), l in zip(segs, L):
            if d <= l:
                t = d / l
                out.append((a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t))
                break
            d -= l
    return out


def _n2(pts, i):
    (u0, v0), (u1, v1) = pts[i - 1], pts[(i + 1) % len(pts)]
    tx, ty = u1 - u0, v1 - v0
    L = math.hypot(tx, ty) or 1.
    return ty / L, -tx / L        # 逆時針一圈的外法線


def off(pts, d):
    """外形往外（d > 0）或往內推；d 可以是 d(u, v)"""
    out = []
    for i, (u, v) in enumerate(pts):
        nu, nv = _n2(pts, i)
        dd = d(u, v) if callable(d) else d
        out.append((u + nu * dd, v + nv * dd))
    return out


def rrect(w, h, r=.38, k=2):
    """圓角矩形的截面（w 寬、h 高，r 是圓角佔短邊的比例），中心在原點"""
    rr = min(w, h) * r
    pts = []
    for cx, cy, a0 in ((w / 2 - rr, h / 2 - rr, 0), (-w / 2 + rr, h / 2 - rr, 90), (-w / 2 + rr, -h / 2 + rr, 180), (w / 2 - rr, -h / 2 + rr, 270)):
        for j in range(k + 1):
            a = math.radians(a0 + 90 * j / k)
            pts.append((cx + rr * math.cos(a), cy + rr * math.sin(a)))
    return pts


def circ(r, seg=8):
    return [(r * math.cos(k / seg * 2 * math.pi), r * math.sin(k / seg * 2 * math.pi)) for k in range(seg)]


def sweep(bm, pts, prof, ref=(0, 0, 1), loop=False, scale=None):
    """沿折線掃一個截面 prof [(側, 上)]；ref 是「上」的參考方向（鏡框一圈用 Y，鏡腳、帶子用 Z）；scale(t) → (側, 上) 的縮放"""
    pts = [Vector(p) for p in pts]
    n, R, rows = len(pts), Vector(ref), []
    for i, p in enumerate(pts):
        t = (pts[(i + 1) % n] - pts[i - 1]) if loop else (pts[min(i + 1, n - 1)] - pts[max(i - 1, 0)])
        t.normalize()
        sd = t.cross(R)
        if sd.length < 1e-5:
            sd = t.cross(Vector((1, 0, 0)))
        sd.normalize()
        up = sd.cross(t)
        k = scale(i / (n if loop else n - 1)) if scale else (1., 1.)
        rows.append([bm.verts.new(p + sd * a * k[0] + up * b * k[1]) for a, b in prof])
    f0 = len(bm.faces)
    if loop:
        rows.append(rows[0])
    _skin(bm, rows)
    if not loop:
        bm.faces.new(rows[0][::-1])
        bm.faces.new(rows[-1])
    bm.faces.ensure_lookup_table()
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[f0:])


def lens(bm, trim, E, s, pts, th=.0014, dy=0., wrap=WRAP, grad=True, part='lens'):
    """一片鏡片：前後兩面的扇形＋側邊；鏡片的頂點在部位上加 0～.8 的漸層（上 → 下），40-people.js 的 lg"""
    vs = [v for _, v in pts]
    vt, vb = max(vs), min(vs)
    cu, cv = sum(u for u, _ in pts) / len(pts), sum(vs) / len(vs)
    f0, n0 = len(bm.faces), len(bm.verts)
    fr = [bm.verts.new(gp(E, s, u, v, dy - th / 2, wrap)) for u, v in pts]
    bk = [bm.verts.new(gp(E, s, u, v, dy + th / 2, wrap)) for u, v in pts]
    cf, cb = bm.verts.new(gp(E, s, cu, cv, dy - th / 2 - .0005, wrap)), bm.verts.new(gp(E, s, cu, cv, dy + th / 2 - .0005, wrap))
    n = len(pts)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((fr[i], fr[j], cf))
        bm.faces.new((bk[j], bk[i], cb))
        bm.faces.new((fr[j], fr[i], bk[i], bk[j]))
    bm.faces.ensure_lookup_table()
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[f0:])
    bm.verts.ensure_lookup_table()
    for k in range(n0, len(bm.verts)):
        v = bm.verts[k]
        t = (E['z'] + vt - v.co.z) / max(1e-4, vt - vb)
        v[trim] = PART[part] + (.8 * min(1., max(0., t)) if grad and part == 'lens' else 0.)


def rim(bm, E, s, pts, w, d, dy=0., wrap=WRAP, inset=.0008, r=.38):
    """板材鏡框：沿鏡片外緣一圈圓角矩形截面（w 寬可以是 w(u, v)、d 深）；內緣蓋住鏡片邊 inset"""
    n = len(pts)
    ws = [w(u, v) if callable(w) else w for u, v in pts]
    W = max(ws)
    mid = off(pts, lambda u, v: (w(u, v) if callable(w) else w) / 2 - inset)
    path = [gp(E, s, u, v, dy, wrap) for u, v in mid]
    sweep(bm, path, rrect(W, d, r), ref=(0, 1, 0), loop=True, scale=lambda t: (ws[min(n - 1, int(round(t * n)) % n)] / W, 1.))


def wire(bm, E, s, pts, r, dy=0., wrap=WRAP, gap=.0008, seg=6):
    """金屬細框：鏡片外緣一圈細管"""
    path = [gp(E, s, u, v, dy, wrap) for u, v in off(pts, gap)]
    sweep(bm, path, circ(r, seg), ref=(0, 1, 0), loop=True)


def inner_edge(pts, v0, dv=.006):
    """鏡片內側（靠鼻子）在高度 v0 附近的 u"""
    q = [u for u, v in pts if abs(v - v0) < dv]
    return min(q) if q else min(u for u, _ in pts)


def outer_pt(pts):
    """鏡片最外側、偏上半的那一點（鏡腳的鉸鏈接在這裡）"""
    up = [p for p in pts if p[1] > -.004] or pts
    return max(up, key=lambda p: p[0])


def bridge(bm, E, X, v, dy, prof, arc=.003, ref=(0, 0, 1), n=9, wrap=WRAP):
    """鼻橋：從右鏡片內緣（-X）到左鏡片內緣（+X），中間往上拱 arc"""
    pts = [gw(E, -X + 2 * X * i / (n - 1), v + arc * (1 - ((2 * i / (n - 1)) - 1) ** 2), dy, wrap) for i in range(n)]
    sweep(bm, pts, prof, ref=ref)


def pads(bm, trim, E, v=-.012, dy=.007, X=.0095):
    """金屬框的鼻墊：銀色的托臂＋透明感的小橢圓墊"""
    with _part(bm, trim, 'silver'):
        for s in (-1, 1):
            tube(bm, [gw(E, s * (X + .006), v + .006, .0015), gw(E, s * (X + .002), v + .001, dy - .002)], .0005, seg=5)
    with _part(bm, trim, 'gloss'):
        for s in (-1, 1):
            ball(bm, gw(E, s * X, v, dy), 1., s=(.0018, .0032, .005), u=10, v=6, rot=(0, 0, -s * .5))


def temple_path(E, s, X0, v0, dy0=0., out=0., wrap=WRAP, tip=True):
    """鏡腳：從鉸鏈（X0, v0）往後沿頭側（多 5.5 mm＋out），到耳朵根部時降到耳朵頂下 4 mm，再往下彎掛在耳後"""
    y0 = E['ly'] + wrap * X0 * X0 + dy0
    ey, ex, et = E['ear']
    ye = ey + .004
    z0, ze = E['z'] + v0, et - .004
    pts, xm = [], X0
    for k in range(11):
        t = k / 10
        y = y0 + (ye - y0) * t
        xm = max(xm, side_at(E, min(y, .0)) + .0055 + out, X0 + (.004 + out) * t)
        pts.append(Vector((E['x'] + s * xm, y, z0 + (ze - z0) * (t ** 1.6))))
    if tip:
        pts += [Vector((E['x'] + s * (xm - .002), ye + .011, ze - .007)), Vector((E['x'] + s * (xm - .005), ye + .019, ze - .022)),
                Vector((E['x'] + s * (xm - .007), ye + .021, ze - .033))]
    return pts


def temple(bm, E, s, X0, v0, prof, dy0=0., out=0., taper=None, wrap=WRAP):
    pts = temple_path(E, s, X0, v0, dy0, out, wrap)
    sweep(bm, pts, prof, ref=(0, 0, 1), scale=taper)


def cone_to(bm, p, d, r, h, seg=6):
    """尖刺、鉚釘：底在 p、往 d 的方向長 h"""
    d = Vector(d).normalized()
    q = d.to_track_quat('Z', 'Y').to_matrix().to_4x4()
    from mathutils import Matrix
    bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=r, radius2=0, depth=h, matrix=Matrix.Translation(Vector(p) + d * h / 2) @ q)


def screw(bm, E, s, u, v, dy=0., r=.0011, L=.004):
    p = gp(E, s, u, v, dy - L / 2)
    bmesh.ops.create_cone(bm, cap_ends=True, segments=8, radius1=r, radius2=r, depth=L, matrix=_mat(p, (math.pi / 2, 0, 0)))


def _both(fn):
    for s in (-1, 1):
        fn(s)


# ─── 十五款 ───
def g_aviator(bm, fig, trim):
    """G-01 淚滴飛行員：雙鼻樑細金框、往鼻側下垂的大水滴鏡片、細鏡腳尾端包塑膠套"""
    E = eye_frame(fig)
    pts = outline(lambda a: (.028 * math.cos(a) - .004 * max(0., -math.sin(a)) * max(0., -math.cos(a)),
                             (.0185 * math.sin(a) ** .9 if math.sin(a) > 0 else -.027 * abs(math.sin(a)) ** 1.05 * (1 + .12 * max(0., -math.cos(a)))) - .003), 56)
    for s in (-1, 1):
        lens(bm, trim, E, s, pts)
    xi_t, xi_b = E['px'] + inner_edge(pts, .012), E['px'] + inner_edge(pts, -.004)
    uo, vo = outer_pt(pts)
    with _part(bm, trim, 'gold'):
        for s in (-1, 1):
            wire(bm, E, s, pts, .0011)
        bridge(bm, E, xi_t + .001, .0135, -.0004, circ(.001, 6), arc=0.)           # 上面一根直的
        bridge(bm, E, xi_b + .0005, -.002, -.0004, circ(.0011, 6), arc=.004)       # 下面一根往上拱
        for s in (-1, 1):
            tube(bm, [gp(E, s, uo + .0008, vo), gp(E, s, uo + .004, vo, .003)], .0012, seg=6)
            pts_t = temple_path(E, s, E['px'] + uo + .004, vo, .003)
            tube(bm, pts_t[:9], .0011, seg=6)
    with _part(bm, trim, 'b'):
        for s in (-1, 1):
            sweep(bm, temple_path(E, s, E['px'] + uo + .004, vo, .003)[8:], circ(.0017, 8))
    pads(bm, trim, E)


def g_wayfarer(bm, fig, trim):
    """G-02 粗黑框鉚釘：上寬下窄的方圓板材框、鋼琴黑、兩端的銀色菱形鉚釘、寬鏡腳"""
    E = eye_frame(fig)

    def f(a):
        u, v = sup(.026, .0195, 4.2, a)
        c, s_ = math.cos(a), math.sin(a)
        return (u + .001 - .0035 * max(0., -c) * max(0., -s_), v + .0035 * max(0., c) * max(0., s_) - .001)
    pts = outline(f, 56)
    W, D = .0062, .0066
    for s in (-1, 1):
        lens(bm, trim, E, s, pts, dy=.0006)
    uo, vo = outer_pt(off(pts, W))
    xi = E['px'] + inner_edge(pts, .004)
    with _part(bm, trim, 'gloss'):
        for s in (-1, 1):
            rim(bm, E, s, pts, W, D)
            temple(bm, E, s, E['px'] + uo - .002, vo - .003, rrect(.0028, .0085, .3), dy0=.002, taper=lambda t: (1., 1. - .4 * t))
        bridge(bm, E, xi + .002, .004, 0., rrect(D, .0075, .35), arc=.0035)
    with _part(bm, trim, 'silver'):
        for s in (-1, 1):
            for dv in (.004, -.002):
                cone_to(bm, gp(E, s, uo - .0055, vo - .004 + dv, -D / 2), (0, -1, 0), .0021, .0011, seg=4)
            cone_to(bm, temple_path(E, s, E['px'] + uo - .002, vo - .003, .002)[2] + Vector((s * .0014, 0, 0)), (s, 0, 0), .0018, .0009, seg=4)


def g_rimless(bm, fig, trim):
    """G-03 千禧無框切角方鏡：只有螺絲鎖住鏡橋與鏡腳、蜜桃粉果凍鏡片、角落一顆星芒水鑽、外擴的弧形鏡腳"""
    E = eye_frame(fig)
    w, h, c = .027, .0165, .0065
    pts = poly([(w, -h + c), (w, h - c), (w - c, h), (-w + c * .6, h), (-w, h - c * .6), (-w, -h + c), (-w + c, -h), (w - c, -h)][::1], 56)
    for s in (-1, 1):
        lens(bm, trim, E, s, pts, th=.0018)
    xi = E['px'] - w + .004
    with _part(bm, trim, 'silver'):
        bridge(bm, E, xi, .006, -.0012, circ(.0009, 6), arc=.003)
        for s in (-1, 1):
            screw(bm, E, s, -w + .004, .006, .0009)
            screw(bm, E, s, w - .004, .006, .0009)
            tube(bm, [gp(E, s, w - .004, .006, -.0012), gp(E, s, w + .003, .006, .002)], .0009, seg=6)
            tube(bm, temple_path(E, s, E['px'] + w + .003, .006, .002, out=.004), .001, seg=6)
            # 星芒：兩個轉 45° 的菱形疊成八角星
            p = gp(E, s, w - .0075, h - .004, -.0015)
            for rz in (0, math.pi / 4):
                ball(bm, p, 1., s=(.0032, .0008, .0032), u=4, v=2, rot=(0, rz, 0))
    pads(bm, trim, E, v=-.008)


def g_cateye(bm, fig, trim):
    """G-04 貓眼：外上角誇張挑起（往外後傾 8°）的玳瑁板材框，深茶色鏡片"""
    E = eye_frame(fig)
    tipf = lambda a: math.exp(-((((a + math.pi) % (2 * math.pi)) - math.pi - .62) / .3) ** 2)

    def f(a):
        u, v = sup(.026, .0172, 3.4, a)
        t = tipf(a)
        return (u + .0105 * t, v + .0085 * t - .0015 * max(0., -math.cos(a)) * max(0., -math.sin(a)))
    pts = outline(f, 64)
    for s in (-1, 1):
        lens(bm, trim, E, s, pts, dy=.0005)
    tw = lambda u, v: .0034 + .0062 * max(0., min(1., (u - .016) / .02)) * max(0., min(1., (v + .002) / .014))
    D = .0058
    uo, vo = max(pts, key=lambda p: p[0] - p[1] * .3)
    xi = E['px'] + inner_edge(pts, .004)
    with _part(bm, trim, 'cloth'):
        for s in (-1, 1):
            rim(bm, E, s, pts, tw, D)
            temple(bm, E, s, E['px'] + .028, .003, rrect(.0026, .0062, .3), dy0=.003, taper=lambda t: (1., 1. - .3 * t))
        bridge(bm, E, xi + .0015, .005, 0., rrect(D, .0055, .35), arc=.003)
    with _part(bm, trim, 'gold'):
        for s in (-1, 1):
            ball(bm, gp(E, s, .029, .009, -D / 2 - .0002), .0011, u=8, v=5)


def g_shield(bm, fig, trim):
    """G-05 一體式運動風鏡：環繞半張臉的單片大鏡片、底部外側鋸齒導風口、鼻樑凹口、霧黑橡膠上樑與鏡腳"""
    E = eye_frame(fig)
    wrap, X1, th = 3.4, .074, .0016
    top = lambda X: .022 - .006 * (abs(X) / X1) ** 3
    def bot(X):
        a = abs(X) / X1
        tooth = .0026 * abs(((abs(X) * 420) % 2) - 1) if .58 < a < .9 else 0.
        return -.024 + .018 * math.exp(-(X / .011) ** 2) + .012 * a ** 4 + tooth
    cols, NX, NV = [], 41, 6
    n0, f0 = len(bm.verts), len(bm.faces)
    for i in range(NX):
        X = -X1 + 2 * X1 * i / (NX - 1)
        cols.append([(X, bot(X) + (top(X) - bot(X)) * j / (NV - 1)) for j in range(NV)])
    fr = [[bm.verts.new(gw(E, X, v, -.004 - th / 2, wrap)) for X, v in c] for c in cols]
    bk = [[bm.verts.new(gw(E, X, v, -.004 + th / 2, wrap)) for X, v in c] for c in cols]
    for i in range(NX - 1):
        for j in range(NV - 1):
            bm.faces.new((fr[i][j], fr[i + 1][j], fr[i + 1][j + 1], fr[i][j + 1]))
            bm.faces.new((bk[i][j], bk[i][j + 1], bk[i + 1][j + 1], bk[i + 1][j]))
        for j in (0, NV - 1):
            q = (fr[i][j], fr[i + 1][j], bk[i + 1][j], bk[i][j])
            bm.faces.new(q if j == NV - 1 else q[::-1])
    for i in (0, NX - 1):
        for j in range(NV - 1):
            q = (fr[i][j], fr[i][j + 1], bk[i][j + 1], bk[i][j])
            bm.faces.new(q if i == 0 else q[::-1])
    bm.faces.ensure_lookup_table()
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[f0:])
    bm.verts.ensure_lookup_table()
    for k in range(n0, len(bm.verts)):
        v = bm.verts[k]
        v[trim] = PART['lens'] + .8 * min(1., max(0., (E['z'] + .022 - v.co.z) / .046))
    with _part(bm, trim, 'plain'):     # 霧黑橡膠用主色（第二色留給鏡片的漸層）
        sweep(bm, [gw(E, X, top(X) + .0016, -.004, wrap) for X in [-X1 - .002 + (2 * X1 + .004) * i / 30 for i in range(31)]], rrect(.0065, .005, .4), ref=(0, 0, 1))
        for s in (-1, 1):
            ball(bm, gw(E, s * .009, -.011, .004, wrap), 1., s=(.0022, .005, .0065), u=10, v=6, rot=(0, 0, -s * .45))
            temple(bm, E, s, X1 + .001, .016, rrect(.0032, .0075, .45), dy0=-.004, wrap=wrap, taper=lambda t: (1., 1. - .25 * t))


def g_shutter(bm, fig, trim):
    """G-06 LED 百葉窗：消光黑方框、沒有鏡片，框裡一排橫條格柵（青藍色自發光）"""
    E = eye_frame(fig)
    w, h = .028, .0185
    pts = outline(lambda a: sup(w, h, 6, a), 56)
    W, D = .0052, .0062
    uo, vo = outer_pt(off(pts, W))
    with _part(bm, trim, 'b'):
        for s in (-1, 1):
            rim(bm, E, s, pts, W, D)
            temple(bm, E, s, E['px'] + uo - .002, vo - .004, rrect(.0028, .0075, .3), dy0=.002, taper=lambda t: (1., 1. - .35 * t))
        bridge(bm, E, E['px'] - w + .002, .004, 0., rrect(D, .0065, .35), arc=.002)
    with _part(bm, trim, 'glow'):
        for s in (-1, 1):
            for k in range(6):
                v = -h + .002 + (2 * h - .004) * (k + .5) / 6
                q = [u for u, vv in pts if abs(vv - v) < .004]
                u0, u1 = min(q) + .0006, max(q) - .0006
                n = 6
                path = [gp(E, s, u0 + (u1 - u0) * i / (n - 1), v, .0005) for i in range(n)]
                sweep(bm, path, rrect(.0028, .0024, .3), ref=(0, 0, 1))


def g_lennon(bm, fig, trim):
    """G-07 圓框文藝：正圓細金屬框對準瞳孔、拱形鼻橋、檸檬黃淺色鏡片、鏡腳尾端彈簧捲"""
    E = eye_frame(fig)
    R = .0205
    pts = outline(lambda a: (R * math.cos(a), R * math.sin(a)), 48)
    for s in (-1, 1):
        lens(bm, trim, E, s, pts, grad=False)
    with _part(bm, trim, 'metal'):
        for s in (-1, 1):
            wire(bm, E, s, pts, .00105)
            tube(bm, [gp(E, s, R + .0008, .003), gp(E, s, R + .004, .003, .003)], .0011, seg=6)
            P = temple_path(E, s, E['px'] + R + .004, .003, .003, tip=False)
            tube(bm, P, .00095, seg=6)
            # 彈簧捲：耳後往下彎的那段繞一圈圈的螺旋
            ey, ex, et = E['ear']
            base = [P[-1] + Vector((-s * .003 * t, .02 * math.sin(t * 1.4), -.034 * t)) for t in [i / 70 for i in range(71)]]
            coil = []
            for i, p in enumerate(base):
                tg = (base[min(i + 1, 70)] - base[max(i - 1, 0)]).normalized()
                n1 = tg.cross(Vector((1, 0, 0))).normalized()
                n2 = tg.cross(n1)
                a = i / 70 * 2 * math.pi * 9
                coil.append(p + (n1 * math.cos(a) + n2 * math.sin(a)) * .0019)
            tube(bm, coil, .00055, seg=5)
        bridge(bm, E, E['px'] - R - .0006, .006, 0., circ(.00105, 6), arc=.0045)
    pads(bm, trim, E, v=-.009)


def g_baroque(bm, fig, trim):
    """G-08 巴洛克巨框：平頂超大方框、象牙白板材、寬鏡腿上金色的回紋浮雕、深灰漸層鏡片"""
    E = eye_frame(fig)

    def f(a):
        u, v = sup(.032, .027, 5, a)
        return (u + .002, min(v, .0225) - .002)
    pts = outline(f, 60)
    W, D = .0082, .0072
    for s in (-1, 1):
        lens(bm, trim, E, s, pts, dy=.0006)
    uo, vo = outer_pt(off(pts, W))
    xi = E['px'] + inner_edge(pts, .004)
    with _part(bm, trim, 'plain'):
        for s in (-1, 1):
            rim(bm, E, s, pts, W, D)
            temple(bm, E, s, E['px'] + uo - .003, .008, rrect(.0032, .0135, .25), dy0=.002, out=.0015, taper=lambda t: (1., 1. - .5 * t ** 2))
        bridge(bm, E, xi + .003, .006, 0., rrect(D, .008, .35), arc=.003)
    with _part(bm, trim, 'gold'):
        for s in (-1, 1):
            # 回紋：沿鏡腳外側前 45% 的一條方形折線（每格 6 mm）
            P = temple_path(E, s, E['px'] + uo - .003, .008, .002, out=.0015)
            A, B = P[0], P[5]
            L = (B - A).length
            dirv = (B - A).normalized()
            up = Vector((0, 0, 1))
            o = Vector((s * .0019, 0, 0))
            key, cell = [], .006
            for k in range(int(L / cell)):
                b = k * cell
                for da, dz in ((0, -.0045), (0, .0045), (.0045, .0045), (.0045, -.0015), (.0015, -.0015), (.0015, .0015), (.003, .0015), (.003, -.0045), (.006, -.0045)):
                    key.append(A + dirv * (b + da) + up * dz + o)
            tube(bm, key, .0006, seg=5)
            ball(bm, gp(E, s, uo - .004, vo - .004, -D / 2), 1., s=(.0028, .001, .0028), u=8, v=4)


def g_matrix(bm, fig, trim):
    """G-09 極窄黑客鏡：高 18 mm 的銳利長方鏡片、低掛在鼻樑中段（往前、往下）、槍灰細框、高反射鏡面"""
    E = eye_frame(fig)
    dz, dyl = -.0065, -.006
    pts = [(u, v + dz) for u, v in outline(lambda a: sup(.0215, .009, 9, a), 48)]
    for s in (-1, 1):
        lens(bm, trim, E, s, pts, dy=dyl, th=.0012)
    with _part(bm, trim, 'metal'):
        for s in (-1, 1):
            wire(bm, E, s, pts, .0009, dy=dyl)
            tube(bm, [gp(E, s, .0215 + .0008, dz + .006, dyl), gp(E, s, .026, dz + .006, dyl + .003)], .001, seg=6)
            tube(bm, temple_path(E, s, E['px'] + .026, dz + .006, dyl + .003), .00095, seg=6)
        bridge(bm, E, E['px'] - .0215, dz + .004, dyl, circ(.0009, 6), arc=.002)
    pads(bm, trim, E, v=dz - .006, dy=dyl + .007)


def g_steampunk(bm, fig, trim):
    """G-10 蒸汽龐克護目鏡：皮革眼罩筒、齒輪外框的黃銅圈、翠綠焊工鏡片、上翻的第二層深色鏡片、側邊排氣孔、皮帶繞頭一圈"""
    E = eye_frame(fig)
    H = head_frame(fig)
    R = .0215
    pts = outline(lambda a: (R * math.cos(a), R * math.sin(a)), 40)
    y_f, y_b = -.012, .012
    for s in (-1, 1):
        lens(bm, trim, E, s, pts, dy=y_f + .002, grad=False)
    with _part(bm, trim, 'b'):
        for s in (-1, 1):
            # 皮革眼罩：前小後大的筒（貼到眼窩）
            rows = []
            for j in range(5):
                t = j / 4
                rr = R + .002 + .004 * t
                rows.append([bm.verts.new(gp(E, s, rr * math.cos(k / 24 * 6.2832), rr * math.sin(k / 24 * 6.2832) * (1 + .08 * t), y_f + (y_b - y_f) * t)) for k in range(24)])
            f0 = len(bm.faces)
            _skin(bm, rows)
            bm.faces.ensure_lookup_table()
            _inner(bm, bm.faces[f0:], .0015)
        # 皮帶：從兩個眼罩的外側沿頭側往後，繞過後腦，後面比前面高 3 cm
        ring_ = []
        for i in range(25):
            phi = -math.pi / 2 + math.pi * i / 24          # 右側 → 後腦 → 左側
            ring_.append(Vector((H['x'] + math.sin(phi) * H['rx'] * 1.05, H['cy'] + math.cos(phi) * H['ry'] * 1.07 + .004, E['z'] + .008 + .03 * max(0., math.cos(phi)) ** .7)))
        ends = {s: [gp(E, s, R + .006, 0., .002), Vector((E['x'] + s * (side_at(E, -.02) + .007), -.02, E['z'] + .006))] for s in (-1, 1)}
        sweep(bm, ends[-1] + ring_[1:-1] + ends[1][::-1], rrect(.003, .016, .3), ref=(0, 0, 1))
    with _part(bm, trim, 'gold'):
        for s in (-1, 1):
            # 齒輪外框：12 齒
            gear = [(math.cos(a) * r_, math.sin(a) * r_) for a, r_ in [(k / 96 * 6.2832, R + .0035 + (.0028 if (k // 4) % 2 else 0.)) for k in range(96)]]
            rim(bm, E, s, gear, .002, .0045, dy=y_f + .001)
            wire(bm, E, s, pts, .0016, dy=y_f + .0015, gap=.0003)
            # 側邊排氣孔：外側兩個小螺紋筒
            for dv in (-.006, .006):
                c = gp(E, s, R + .006, dv, .002)
                bmesh.ops.create_cone(bm, cap_ends=True, segments=10, radius1=.0028, radius2=.0028, depth=.006, matrix=_mat(c, (0, math.pi / 2, 0)))
            # 上翻的第二層：鉸鏈在眼罩上緣，翻起來約 110°
            hinge = gp(E, s, 0., R + .004, y_f)
            from mathutils import Matrix
            M = Matrix.Translation(hinge) @ Matrix.Rotation(-1.9, 4, 'X') @ Matrix.Translation(-hinge)
            n0 = len(bm.verts)
            ring(bm, gp(E, s, 0., 0., y_f - .003), R + .002, .0016, rot=(math.pi / 2, 0, 0), seg=28, sseg=6)
            bm.verts.ensure_lookup_table()
            for v in bm.verts[n0:]:
                v.co = M @ v.co
            cube(bm, hinge + Vector((0, -.002, .0015)), (.012, .004, .004))
        with _part(bm, trim, 'silver'):
            cube(bm, Vector((E['x'] + side_at(E, -.02) + .008, -.02, E['z'] + .006)), (.003, .014, .02))
    with _part(bm, trim, 'lens'):
        for s in (-1, 1):
            hinge = gp(E, s, 0., R + .004, y_f)
            from mathutils import Matrix
            M = Matrix.Translation(hinge) @ Matrix.Rotation(-1.9, 4, 'X') @ Matrix.Translation(-hinge)
            n0 = len(bm.verts)
            cyl(bm, gp(E, s, 0., 0., y_f - .003), R + .001, R + .001, .0012, rot=(math.pi / 2, 0, 0), seg=28)
            bm.verts.ensure_lookup_table()
            for v in bm.verts[n0:]:
                v.co = M @ v.co


def g_heart(bm, fig, trim):
    """G-11 愛心框：兩顆飽滿的愛心（底尖往外傾 12°）、火焰紅亮面框、紅轉粉漸層鏡片、往下凹的鼻橋"""
    E = eye_frame(fig)
    th = math.radians(12)

    def f(a):
        t = -a + math.pi / 2          # 心形參數：t = 0 是上面的凹口，逆時針一圈
        x, y = 16 * math.sin(t) ** 3, 13 * math.cos(t) - 5 * math.cos(2 * t) - 2 * math.cos(3 * t) - math.cos(4 * t)
        x, y = x * .0275 / 16, (y + 2.5) * .0235 / 15
        return (x * math.cos(th) - y * math.sin(th), x * math.sin(th) + y * math.cos(th))
    pts = outline(f, 72)
    pts = pts[::-1] if sum(pts[i][0] * pts[(i + 1) % 72][1] - pts[(i + 1) % 72][0] * pts[i][1] for i in range(72)) < 0 else pts
    W, D = .0042, .0058
    for s in (-1, 1):
        lens(bm, trim, E, s, pts, dy=.0005)
    uo, vo = outer_pt(off(pts, W))
    xi = E['px'] + inner_edge(pts, .004)
    with _part(bm, trim, 'plain'):
        for s in (-1, 1):
            rim(bm, E, s, pts, W, D)
            temple(bm, E, s, E['px'] + uo - .002, min(vo, .01), rrect(.0026, .0062, .3), dy0=.002)
        bridge(bm, E, xi + .002, .003, 0., rrect(D, .005, .35), arc=-.003)


def g_flattop(bm, fig, trim):
    """G-12 西岸厚框：平直粗眉框（頂部往後縮 2 mm，壓在帽簷下）、碳纖維編織紋、超寬的側面遮光鏡腿、全黑鏡片"""
    E = eye_frame(fig)

    def f(a):
        u, v = sup(.029, .0205, 4.6, a)
        return (u + .001, min(v, .014) - .002)
    pts = outline(f, 60)
    tw = lambda u, v: .0045 + .0048 * max(0., min(1., (v - .004) / .006))
    D = .0068
    for s in (-1, 1):
        lens(bm, trim, E, s, pts, dy=.0008)
    xi = E['px'] + inner_edge(pts, .004)
    with _part(bm, trim, 'cloth'):
        for s in (-1, 1):
            rim(bm, E, s, pts, tw, D, dy=.0005)
            temple(bm, E, s, E['px'] + .033, .004, rrect(.003, .02, .2), dy0=.003, taper=lambda t: (1., 1. - .62 * t ** .7))
        bridge(bm, E, xi + .003, .008, .0005, rrect(D, .0105, .3), arc=0.)


def g_hexagon(bm, fig, trim):
    """G-13 六角形金屬框：鑽石切割的六邊形鏡片（1.2 mm 薄）、玫瑰金雙線鏤空框（六個角用短柱連起來）、薰衣草紫鏡片"""
    E = eye_frame(fig)
    w, h = .027, .0215
    cs = [(w * math.cos(k * math.pi / 3), h * math.sin(k * math.pi / 3)) for k in range(6)]
    pts = poly(cs, 60)
    for s in (-1, 1):
        lens(bm, trim, E, s, pts, th=.0012)
    with _part(bm, trim, 'metal'):
        for s in (-1, 1):
            wire(bm, E, s, pts, .0007, gap=.0008)
            wire(bm, E, s, pts, .0007, gap=.0036)
            for u, v in cs:
                L = math.hypot(u, v)
                tube(bm, [gp(E, s, u + u / L * .0008, v + v / L * .0008), gp(E, s, u + u / L * .0036, v + v / L * .0036)], .0007, seg=5)
            tube(bm, [gp(E, s, w + .0036, 0.), gp(E, s, w + .006, .002, .003)], .0009, seg=6)
            tube(bm, temple_path(E, s, E['px'] + w + .006, .002, .003), .0009, seg=6)
        bridge(bm, E, E['px'] - w * .5 - .002, h * .87 + .0005, 0., circ(.0008, 6), arc=.001)
        bridge(bm, E, E['px'] - w * .75, h * .45, 0., circ(.0008, 6), arc=.004)
    pads(bm, trim, E, v=-.011)


def g_labgoggle(bm, fig, trim):
    """G-14 透明防護鏡：上下全包的透明聚碳酸酯罩、灰色軟膠貼臉邊、側邊百葉透氣孔、下緣白色的刻度、鬆緊帶"""
    E = eye_frame(fig)
    H = head_frame(fig)
    wrap = 3.0
    base = outline(lambda a: sup(.071, .027, 5, a), 72)
    def loop_at(k, dy):
        out = []
        for X, v in base:
            if v < 0:
                v = v + .019 * math.exp(-(X / .016) ** 2) * min(1., -v / .02)    # 鼻樑的凹口
            out.append(gw(E, X * k, v * k + .001, dy, wrap))
        return out
    with _part(bm, trim, 'lens'):
        rings_ = [loop_at(1.05, .016), loop_at(1.035, .004), loop_at(1.0, -.006)]
        rows = [[bm.verts.new(p) for p in r] for r in rings_]
        f0 = len(bm.faces)
        _skin(bm, rows)
        c = bm.verts.new(gw(E, 0., .003, -.0075, wrap))
        last = rows[-1]
        for i in range(len(last)):
            bm.faces.new((last[i], last[(i + 1) % len(last)], c))
        bm.faces.ensure_lookup_table()
        fs = bm.faces[f0:]
        bmesh.ops.recalc_face_normals(bm, faces=fs)
        bm.normal_update()
        # 法線要朝外（往前）：前面中心的面朝 -Y
        if c.link_faces[0].normal.y > 0:
            bmesh.ops.reverse_faces(bm, faces=fs)
        _inner(bm, fs, .0015)
    with _part(bm, trim, 'b'):
        sweep(bm, loop_at(1.06, .017), circ(.003, 8), ref=(0, 1, 0), loop=True)
        for s in (-1, 1):
            for k in range(4):
                v = -.012 + k * .0075
                p = gw(E, s * .0735, v, .006, wrap)
                cube(bm, p + Vector((s * .0015, 0, 0)), (.003, .012, .0028), rot=(0, 0, s * .45))
    with _part(bm, trim, 'plain'):
        for s in (-1, 1):
            for k in range(9):
                X = s * (.018 + k * .0052)
                v = -.0245 + .0045 * (abs(X) / .071) ** 4
                cube(bm, gw(E, X, v + (.0012 if k % 3 == 0 else 0), -.0075 + wrap * 0 - .0006, wrap), (.0007, .0006, .0035 if k % 3 == 0 else .0022))
    with _part(bm, trim, 'c'):
        band_pts = []
        for i in range(31):
            t = i / 30
            phi = -math.pi / 2 - .35 + (math.pi + .7) * t
            band_pts.append(Vector((H['x'] + math.sin(phi) * H['rx'] * 1.06, H['cy'] + math.cos(phi) * H['ry'] * 1.08 + .004, E['z'] + .004 + .03 * max(0., math.cos(phi)) ** .7)))
        sweep(bm, band_pts, rrect(.0025, .018, .3), ref=(0, 0, 1))


def g_flame(bm, fig, trim):
    """G-15 火焰無框：鏡片外緣直接切成往外後方竄的火舌（尖端圓滑）、紅橙黃漸層、銀色荊棘鏡腳"""
    E = eye_frame(fig)

    def f(a):
        u, v = sup(.025, .0175, 3, a)
        aa = (a + math.pi) % (2 * math.pi) - math.pi
        reg = max(0., math.cos(aa - .7)) ** 1.4 if -.9 < aa < 2.3 else 0.
        ph = .5 + .5 * math.cos(aa * 7.5 - .4)
        ext = .0115 * reg * ph ** 2.2
        L = math.hypot(u, v) or 1.
        return (u + (u / L * .5 + .7) * ext, v + (v / L) * ext * .9)
    pts = outline(f, 144)
    for s in (-1, 1):
        lens(bm, trim, E, s, pts, th=.0018)
    with _part(bm, trim, 'silver'):
        bridge(bm, E, E['px'] - .025 + .003, .005, -.0012, circ(.0009, 6), arc=.003)
        for s in (-1, 1):
            screw(bm, E, s, -.022, .005, .0009)
            screw(bm, E, s, .022, .008, .0009)
            tube(bm, [gp(E, s, .022, .008, -.0012), gp(E, s, .031, .008, .002)], .001, seg=6)
            P = temple_path(E, s, E['px'] + .031, .008, .002, out=.003)
            tube(bm, P, .00105, seg=6)
            # 荊棘：沿鏡腳前 3/4 交錯往外上、外下長出的小刺
            for k in range(1, 9):
                p = P[k]
                cone_to(bm, p, (s * .8, .2, .5 if k % 2 else -.5), .0011, .0045, seg=5)
    pads(bm, trim, E, v=-.008)


GLASSES = dict(aviator=g_aviator, wayfarer=g_wayfarer, rimless=g_rimless, cateye=g_cateye, shield=g_shield, shutter=g_shutter,
               lennon=g_lennon, baroque=g_baroque, matrix=g_matrix, steampunk=g_steampunk, heart=g_heart, flattop=g_flattop,
               hexagon=g_hexagon, labgoggle=g_labgoggle, flame=g_flame)
