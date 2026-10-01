# 190 封頂：1 公里島嶼用的樹木、岩石、紅砂岩台地、房屋、加油站與路邊設施 → world.glb
# 重建：/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P assets/190/build_world.py
#   匯出後最後一步由 glb_draco.py 把網格改存 KHR_draco_mesh_compression（網頁用 DRACOLoader 解碼）；DRACO=0 輸出未壓縮的 glb
#   PREVIEW=資料夾 另存預覽圖；GLB=路徑 改寫到別處；META=路徑 輸出碰撞盒 / 門 / 樓板等 JSON（寫清單用）
# 每個物件一個節點、節點位移為 0；原點在地面中心（PIER 在甲板面、BOAT 在吃水線），正面朝 +z，公尺。
# 材質名稱 = 用途（leaf / bark / paint / glass / emit / rock / wood / metal / roof / plain），頂點色 = 底色 × AO，保留 UV。
# 葉片圖集 2×2（glTF UV，v 朝下）：格 0 = (0..0.5, 0..0.5) 大闊葉、格 1 = (0.5..1, 0..0.5) 密葉、
#   格 2 = (0..0.5, 0.5..1) 小葉灌木、格 3 = (0.5..1, 0.5..1) 稀疏細葉；圖集畫白 / 淺灰葉形 + alpha，綠色來自頂點色。
import sys, os, math, random, json
sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lb_lib import reset, preview, origin_to
from world_lib import *

HERE = os.path.dirname(os.path.abspath(__file__))
PREVIEW = os.environ.get('PREVIEW')
reset()

OUT, META, GROUP = [], {}, {}
LAYOUT = {}


def interior(ob, box, role, tint):
    """牆內側：在外牆內圈（box = x0, x1, z0, z1, 內縮, y 上限）裡的 paint 面改成 role / tint，網頁換外牆色時室內不會跟著變色。
    先沿材質交界把頂點拆開，頂點色才不會和外側共用。"""
    x0, x1, z0, z1, ins, ytop = box
    me = ob.data
    names = [m.name.split('.')[0] for m in me.materials]
    if 'paint' not in names:
        return
    ip = names.index('paint')
    if role not in names:
        me.materials.append(mat(role))
        names.append(role)
    ir = names.index(role)
    hit = set()
    for p in me.polygons:
        c = T(p.center)
        if p.material_index == ip and x0 + ins < c.x < x1 - ins and z0 + ins < c.z < z1 - ins and c.y < ytop:
            hit.add(p.index)
    if not hit:
        return
    bm = bmesh.new()
    bm.from_mesh(me)
    bm.faces.ensure_lookup_table()
    for i in hit:
        bm.faces[i].material_index = ir
    edges = [e for e in bm.edges if len({f.material_index for f in e.link_faces}) > 1]
    bmesh.ops.split_edges(bm, edges=edges)
    cl = bm.verts.layers.float_color.get('Col')
    tl = [srgb2lin(c) for c in hexrgb(tint)]
    for f in bm.faces:
        if f.material_index == ir:
            for v in f.verts:
                c = v[cl]
                v[cl] = (tl[0], tl[1], tl[2], 1.0) if role != 'paint' else c
    bm.to_mesh(me)
    bm.free()


def asset(name, parts, at, dist=1.2, col=None, doors=None, floors=None, notes='', canopy=None, smooth=40, grime=0.0, extra=None, inside=None):
    ob = join([p for p in parts if p], name)
    if inside:
        interior(ob, *inside)
    smooth_by_angle(ob, smooth)
    box_uv(ob)
    if grime:
        shade_by(ob, lambda p: 1 - grime * max(0, min(1, 1 - p.y / .6)) ** 1.5, ('paint', 'wood', 'plain', 'metal', 'rock'))
    ob.location = V(*at)
    bpy.context.view_layer.update()
    OUT.append(ob)
    GROUP.setdefault(dist, []).append(ob)
    META[name] = dict(col=col or [], doors=doors or [], floors=floors or [], notes=notes, canopy=canopy, extra=extra or {})
    LAYOUT[name] = at
    return ob


def rng_for(s):
    return random.Random(s)


# ═════════ 樹 ═════════
def grow(rng, p, d, L, r, depth, spec, segs, tips, nodes):
    pts, rad = [Vector(p)], [r]
    cur, dv = Vector(p), Vector(d).normalized()
    n = 4
    for i in range(n):
        dv = (dv + Vector((rng.uniform(-1, 1) * spec['wig'], rng.uniform(-.04, .1), rng.uniform(-1, 1) * spec['wig']))).normalized()
        cur = cur + dv * (L / n)
        pts.append(cur.copy())
        rad.append(r * (1 - .38 * (i + 1) / n))
    segs.append((pts, rad))
    if depth == 0:
        tips.append((cur.copy(), dv.copy()))
        return
    nodes.append(cur.copy())
    k = spec['fork'][depth - 1]
    phi0 = rng.uniform(0, TAU)
    for c in range(k):
        phi = phi0 + TAU * c / k + rng.uniform(-.4, .4)
        spread = math.radians(spec['spread'][depth - 1] + rng.uniform(-8, 8))
        h = Vector((math.cos(phi), 0, math.sin(phi)))
        nd = (dv * math.cos(spread) + h * math.sin(spread) + Vector((0, spec['up'], 0))).normalized()
        grow(rng, cur, nd, L * spec['ls'] * rng.uniform(.85, 1.15), rad[-1] * .82, depth - 1, spec, segs, tips, nodes)


def clump_cards(rng, c, radii, n, size, cells, up=.35, tilt=.8):
    cards = []
    C = Vector(c)
    for i in range(n):
        while True:
            q = Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), rng.uniform(-1, 1)))
            if q.length <= 1:
                break
        q *= q.length ** -.35 if q.length > 1e-3 else 1
        pos = C + Vector((q.x * radii[0], q.y * radii[1], q.z * radii[2]))
        out = (pos - C).normalized() if (pos - C).length > 1e-3 else Vector((0, 1, 0))
        nrm = (out * .6 + Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), rng.uniform(-1, 1))) * tilt + Vector((0, up, 0))).normalized()
        cards.append((tuple(pos), size * rng.uniform(.8, 1.2), tuple(nrm), rng.uniform(0, TAU), rng.choice(cells)))
    return cards


def tree(name, seed, spec, at):
    rng = rng_for(seed)
    segs, tips, nodes = [], [], []
    base = Vector((0, 0, 0))
    lean = Vector((spec.get('lean', (0, 0))[0], 1, spec.get('lean', (0, 0))[1])).normalized()
    # 樹幹（底部加粗）
    tpts, trad = [base], [spec['r'] * 1.45]
    cur = base.copy()
    dv = lean.copy()
    for i in range(5):
        dv = (dv + Vector((rng.uniform(-1, 1) * .05, 0, rng.uniform(-1, 1) * .05))).normalized()
        cur = cur + dv * (spec['trunk'] / 5)
        tpts.append(cur.copy())
        trad.append(spec['r'] * (1 - .25 * (i + 1) / 5) * (1.12 if i == 0 else 1))
    parts = [wtube('tr', 'bark', spec['bark'], [tuple(p) for p in tpts], trad, 10, True, .12)]
    phi0 = rng.uniform(0, TAU)
    k = spec['limbs']
    for c in range(k):
        phi = phi0 + TAU * c / k + rng.uniform(-.3, .3)
        sp = math.radians(spec['limb_spread'] + rng.uniform(-6, 6))
        h = Vector((math.cos(phi), 0, math.sin(phi)))
        nd = (dv * math.cos(sp) + h * math.sin(sp)).normalized()
        grow(rng, cur, nd, spec['L'] * rng.uniform(.9, 1.1), trad[-1] * .78, spec['depth'], spec, segs, tips, nodes)
    for (pts, rad) in segs:
        parts.append(wtube('br', 'bark', spec['bark'], [tuple(p) for p in pts], rad, 7, True, .12))
    cards = []
    cen = []
    for (p, d) in tips:
        c = p + Vector((0, spec['clump'][1] * .35, 0))
        cen.append(c)
        cards += clump_cards(rng, c, spec['clump'], spec['cards'], spec['card'], spec['cells'], spec.get('cup', .35))
    for p in nodes[::spec.get('node_every', 2)]:
        c = p + Vector((0, .2, 0))
        cards += clump_cards(rng, c, [x * .7 for x in spec['clump']], spec['cards'] // 2, spec['card'] * .9, spec['cells'], spec.get('cup', .35))
    parts.append(leaf_cards(cards, 'lf', spec['leaf'], .22, seed))
    xs = [c.x for c in cen]; ys = [c.y for c in cen]; zs = [c.z for c in cen]
    C = (sum(xs) / len(xs), sum(ys) / len(ys), sum(zs) / len(zs))
    Rr = (max(max(abs(x - C[0]) for x in xs) + spec['clump'][0], 1.0), max(max(abs(y - C[1]) for y in ys) + spec['clump'][1], .8), max(max(abs(z - C[2]) for z in zs) + spec['clump'][2], 1.0))
    r0 = round(spec['r'] * 1.45 + .05, 3)
    ob = asset(name, parts, at, 1.5, col=[[-r0, 0, -r0, r0, round(spec['trunk'], 2), r0]], canopy=dict(center=[round(x, 2) for x in C], radii=[round(x, 2) for x in Rr]),
               notes='trunk collision only; canopy is walk-through. Leaf cards: use the leaf material recipe (DoubleSide + alphaTest + vNormal fix).', smooth=60)
    return ob


TREES = {
    'TREE_A': dict(seed=11, trunk=3.1, r=.24, limbs=3, limb_spread=38, L=2.6, depth=2, fork=[2, 2], spread=[34, 30], ls=.72, up=.12, wig=.14,
                   clump=(1.7, .7, 1.7), cards=30, card=1.35, cells=[0, 3], leaf=0x8ea449, bark=0x6e5d4b, cup=.55, node_every=3),
    # TREE_B 整體 ×0.9（樹高約 11.7 m）：只縮長度類參數，亂數順序不變，外形不變
    'TREE_B': dict(seed=23, trunk=3.6, r=.27, limbs=4, limb_spread=24, L=2.61, depth=2, fork=[2, 2], spread=[30, 28], ls=.74, up=.3, wig=.12,
                   clump=(1.26, 1.08, 1.26), cards=26, card=1.17, cells=[0, 1], leaf=0x6a9a3e, bark=0x655543, cup=.3, node_every=2),
    'TREE_C': dict(seed=37, trunk=2.5, r=.13, limbs=2, limb_spread=30, L=2.0, depth=1, fork=[2], spread=[32], ls=.75, up=.25, wig=.16, lean=(.18, .05),
                   clump=(1.1, .9, 1.1), cards=30, card=1.1, cells=[1, 2], leaf=0x97b64c, bark=0x7a6752, cup=.35, node_every=1),
}
x = 0
for nm, sp in TREES.items():
    tree(nm, sp['seed'], sp, (x, 0, 0))
    x += 14


def bush(name, seed, n, rad, h, ncards, card, color, at):
    rng = rng_for(seed)
    parts = []
    cards = []
    for i in range(n):
        a = TAU * i / n + rng.uniform(-.4, .4)
        rr = rad * .45 * rng.uniform(.3, 1)
        c = (math.cos(a) * rr, h * rng.uniform(.45, .62), math.sin(a) * rr)
        parts.append(wtube('st', 'bark', 0x6a5843, [(c[0] * .2, 0, c[2] * .2), (c[0] * .7, c[1] * .6, c[2] * .7), c], [.035, .025, .015], 5, True, .1))
        cards += clump_cards(rng, c, (rad * .42, h * .42, rad * .42), ncards // n, card, [2, 2, 1], .45, .9)
    parts.append(leaf_cards(cards, 'lf', color, .2, seed))
    return asset(name, parts, at, .8, canopy=dict(center=[0, round(h * .5, 2), 0], radii=[rad / 2, h / 2, rad / 2]), notes='no collision (walk-through), or a soft slow-down zone', smooth=60)


bush('BUSH_A', 51, 3, 1.6, 1.1, 72, .75, 0x6b8f3a, (x, 0, 0)); x += 6
bush('BUSH_B', 52, 5, 2.4, 1.4, 115, .85, 0x7c9b42, (x, 0, 0)); x += 7


# ═════════ 岩石 ═════════
def rock(name, size, seed, sub, col, at, flat=0):
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=sub, radius=1.0)
    off = Vector((seed * 1.3, seed * 2.1, seed * .7))
    for v in bm.verts:
        p = Vector(v.co)
        k = 1 + .28 * noise.noise(p * 1.2 + off) + .09 * noise.noise(p * 3.5 + off)
        p = p * k
        # 切出幾個平的斷面
        for (nx, ny, nz, d) in ((.7, .2, .5, .78), (-.5, .3, -.6, .8), (.1, .9, -.2, .7 + flat * .2)):
            nn = Vector((nx, ny, nz)).normalized()
            e = p.dot(nn) - d
            if e > 0:
                p -= nn * e
        v.co = Vector((p.x * size[0] / 2, p.y * size[1] / 2, p.z * size[2] / 2))
    ys = [v.co.y for v in bm.verts]
    lo = min(ys)
    for v in bm.verts:
        v.co.y -= lo + size[1] * .12
        v.co.y = max(v.co.y, -size[1] * .12)
    ob = wfinish(bm, 'rk', 'rock', col, (0, 0, 0), None, False, .12, seed, .9)
    # 朝上的面帶一點苔綠與塵土
    me = ob.data
    ca = me.color_attributes['Col']
    moss = [srgb2lin(c) for c in hexrgb(0x7d8246)]
    for p in me.polygons:
        if p.normal.z > .75:
            for vi in p.vertices:
                c = ca.data[vi].color
                ca.data[vi].color = (c[0] * .6 + moss[0] * .4, c[1] * .6 + moss[1] * .4, c[2] * .6 + moss[2] * .4, 1)
    ys = [v.co.z for v in me.vertices]
    top = max(ys)
    return asset(name, [ob], at, .9, col=[[-size[0] * .42, 0, -size[2] * .42, size[0] * .42, round(top * .92, 2), size[2] * .42]], smooth=35, notes='AABB is a conservative inner box')


rock('ROCK_A', (1.4, .8, 1.0), 3, 3, 0x9a9184, (x, 0, 0)); x += 5
rock('ROCK_B', (3.0, 1.6, 2.4), 5, 3, 0x8f8578, (x, 0, 0)); x += 7
rock('ROCK_C', (5.0, 2.8, 4.0), 8, 4, 0xa08d7a, (x, 0, 0), 1); x += 9


# ═════════ 紅砂岩台地 ═════════
BANDC = [0xa3503a, 0xb45e3e, 0xc7845c, 0x9e4a33, 0xb86a45, 0x94452f, 0xc27a52, 0xaa5538, 0xbb6f48, 0x9a4b34]


def mesa(name, W, D, bands, seed, at, N=128, quarry=None, ledges=None, crown=4.0):
    """紅砂岩台地：近乎垂直的崖壁 + 垂直溝槽（高頻、隨高度慢慢飄移）+ 軟岩層內凹；只有 ledges 指定的層界有連續平台。
    頂緣高低起伏（幾個凸起的岩塊）。quarry=(半角度, 每層退縮的 z 平面)：前方（+z）開一個階梯狀採石場，
    兩側壁在固定角度上切齊，最上層的切面一路到頂。"""
    rng = rng_for(seed)
    H = bands[-1]
    parts = []
    sd = seed * 1.7
    ledges = ledges or {}

    def Rb(a):
        n1 = noise.noise(Vector((math.cos(a) * 1.2 + sd, math.sin(a) * 1.2, sd)))
        n2 = noise.noise(Vector((math.cos(a) * 3.5, math.sin(a) * 3.5, sd + 5)))
        return 1 + .22 * n1 + .07 * n2

    def flute(a, y):
        """-1..1：正值是凸出的岩柱（稜線尖）、負值是溝"""
        n = noise.noise(Vector((math.cos(a) * 6.5 + sd, math.sin(a) * 6.5, y * .012 + sd * .3)))
        m = noise.noise(Vector((math.cos(a) * 15 + sd, math.sin(a) * 15, y * .03 + sd)))
        return max(-1, min(1, (1 - 2.2 * abs(n)) * .75 + m * .35))

    def crown_at(x, z):
        """頂面凸起的岩塊（平面上的 2D 雜訊）：崖頂輪廓高低錯落，頂面上是幾塊抬高的平台，不是放射狀的稜"""
        n = noise.noise(Vector((x / W * 3.2 + sd, z / D * 3.2, sd + 21)))
        t = max(0, min(1, (n + .02) / .3))
        return crown * t * t * (3 - 2 * t)

    ang = [TAU * i / N for i in range(N)]
    qa0 = qa1 = None
    if quarry:
        half, zplane = quarry
        qa0, qa1 = math.pi / 2 - half, math.pi / 2 + half
        ang = sorted(set([a for a in ang if abs(a - qa0) > .02 and abs(a - qa1) > .02] + [qa0, qa0 + .004, qa1 - .004, qa1]))
    N = len(ang)
    base = [Rb(a) for a in ang]
    incut = [bool(quarry) and qa0 < a < qa1 for a in ang]

    def ring(y, s, k, recess=0.0, top=False):
        pts, fl, cut = [], [], []
        for i, a in enumerate(ang):
            f = flute(a, y)
            r = base[i] * s * (1 + .065 * f - recess)
            px, pz = math.cos(a) * r * W / 2, math.sin(a) * r * D / 2
            c = False
            if incut[i]:
                zc = zplane(k)
                if pz > zc:
                    px, pz, c = zc * math.cos(a) / math.sin(a), zc, True
            pts.append((px, y + (crown_at(px, pz) if top else 0), pz))
            fl.append(f)
            cut.append(c)
        return pts, fl, cut

    def band_obj(rows, k):
        bm = bmesh.new()
        vr = [[bm.verts.new(p) for p in r[0]] for r in rows]
        for j in range(len(rows) - 1):
            for i in range(N):
                ii = (i + 1) % N
                bm.faces.new((vr[j][i], vr[j + 1][i], vr[j + 1][ii], vr[j][ii]))
        ob = wfinish(bm, 'mb', 'rock', BANDC[k % len(BANDC)], (0, 0, 0), None, False, .06, seed + k, .05, recalc=False)
        me = ob.data
        ca = me.color_attributes['Col']
        fresh = [srgb2lin(c) for c in hexrgb(0xdcae84)]
        flat_f = [f for r in rows for f in r[1]]
        flat_c = [c for r in rows for c in r[2]]
        for vi in range(len(me.vertices)):
            c = ca.data[vi].color
            if flat_c[vi]:   # 採石場的新鮮切面
                ca.data[vi].color = (c[0] * .35 + fresh[0] * .65, c[1] * .35 + fresh[1] * .65, c[2] * .35 + fresh[2] * .65, 1)
            else:            # 溝槽暗、岩柱亮
                k_ = .82 + .26 * (flat_f[vi] * .5 + .5)
                ca.data[vi].color = (c[0] * k_, c[1] * k_, c[2] * k_, 1)
        return ob

    def ledge_obj(lo, hi, k):
        """下層頂圈 → 上層底圈的平台（只建有面積的四邊形）"""
        bm = bmesh.new()
        a_ = [bm.verts.new(p) for p in lo]
        b_ = [bm.verts.new(p) for p in hi]
        nf = 0
        for i in range(N):
            ii = (i + 1) % N
            d = sum((Vector(lo[j]) - Vector(hi[j])).length for j in (i, ii))
            if d > .02:
                bm.faces.new((a_[i], b_[i], b_[ii], a_[ii]))
                nf += 1
        if not nf:
            bm.free()
            return None
        bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
        return wfinish(bm, 'ml', 'rock', 0xc7916a, (0, 0, 0), None, False, .08, seed + 40 + k, .08, recalc=False)

    shrink = 1.0
    prev_top = None
    meta_bands = []
    for k in range(len(bands) - 1):
        y0, y1 = bands[k], bands[k + 1]
        if k and k in ledges:
            shrink *= 1 - ledges[k]
        elif k:
            shrink *= .996
        s0 = shrink
        s1 = s0 * (1 - (y1 - y0) / H * .05)
        soft = (k % 2 == 1) and rng.random() < .7
        top = k == len(bands) - 2
        rows = [ring(y0, s0, k), ring((y0 + y1) / 2, (s0 + s1) / 2, k, .02 if soft else -.006), ring(y1, s1, k, 0, top)]
        if prev_top is not None:
            parts.append(ledge_obj(prev_top, rows[0][0], k))
        parts.append(band_obj(rows, k))
        prev_top = rows[-1][0]
        shrink = s1
        meta_bands.append(dict(y0=round(y0, 2), y1=round(y1, 2), poly=[[round(rows[0][0][i][0], 1), round(rows[0][0][i][2], 1)] for i in range(0, N, max(1, N // 24))]))
    # 頂面：外圈（高低起伏）→ 幾圈往內收的環（凸起的岩塊保持平頂，往中心慢慢攤平）→ 中心
    top = prev_top
    yt = bands[-1]
    bm = bmesh.new()
    rings_ = [[bm.verts.new(p) for p in top]]
    for sc in (.93, .72, .46, .2):
        rr_ = []
        for i, p in enumerate(top):
            if incut[i]:    # 採石場缺口：沿用切面點往內縮
                qx, qz = p[0] * sc, p[2] * sc
            else:           # 其他：用平滑外形（不帶崖壁溝槽），頂面才不會出現放射狀的皺褶
                qx, qz = math.cos(ang[i]) * base[i] * shrink * sc * W / 2, math.sin(ang[i]) * base[i] * shrink * sc * D / 2
            rr_.append(bm.verts.new((qx, yt + crown_at(qx, qz) + .25 + noise.noise(Vector((qx * .07 + sd, 0, qz * .07))) * .6, qz)))
        rings_.append(rr_)
    cv = bm.verts.new((0, yt + crown_at(0, 0) + .4, 0))
    for j in range(len(rings_) - 1):
        for i in range(N):
            ii = (i + 1) % N
            bm.faces.new((rings_[j][i], rings_[j + 1][i], rings_[j + 1][ii], rings_[j][ii]))
    for i in range(N):
        bm.faces.new((rings_[-1][i], cv, rings_[-1][(i + 1) % N]))
    parts.append(wfinish(bm, 'mt', 'rock', 0xb98460, (0, 0, 0), None, True, .12, seed + 70, .04, recalc=False))
    # 山腳碎石坡
    bot = ring(0, 1.0, 0)[0]
    bm = bmesh.new()
    a_ = [bm.verts.new((p[0], p[1] + 2.5, p[2])) for p in bot]
    b_ = [bm.verts.new((p[0] * 1.13, -.6, p[2] * 1.13)) for p in bot]
    for i in range(N):
        ii = (i + 1) % N
        bm.faces.new((b_[i], a_[i], a_[ii], b_[ii]))
    parts.append(wfinish(bm, 'ms', 'rock', 0xbd865d, (0, 0, 0), None, True, .1, seed + 90, .08, recalc=False))
    return asset(name, parts, at, 12, col=[[round(-W / 2 * 1.1, 1), 0, round(-D / 2 * 1.1, 1), round(W / 2 * 1.1, 1), round(H + crown, 1), round(D / 2 * 1.1, 1)]],
                 notes='backdrop / landmark. Near-vertical fluted cliff, continuous ledges only at a few strata, uneven crown (top up to +%.0f m). Per-band footprint polygons are in extra.bands for finer collision.' % crown,
                 smooth=24, extra=dict(bands=meta_bands, quarry=dict(half_angle_deg=round(math.degrees(quarry[0]), 1), benches=[dict(y0=bands[k], y1=bands[k + 1], face_z=round(quarry[1](k), 2)) for k in range(len(bands) - 1)]) if quarry else None))


# MESA_A / MESA_B 不再輸出：台地、採石場的崖與遠景孤丘都改在頁面裡程式建模（butteGeo / buildMesaCliff），省掉約 0.7 MB 的下載。
# mesa() 留著備用：mesa('MESA_A', 132, 88, [0, 4, 11, 15, 23, 28, 37, 41, 49, 55], 7, (0, 0, 320), 168, ledges={3: .035, 6: .045}, crown=5.0)


# ═════════ 建築 ═════════
WALLC, TRIM, WOODC, ROOFC, FLOORC = 0xffffff, 0xe6e1d4, 0x7a5a3c, 0x5c5f63, 0x9c9a92


def gable_roof(COL, span, depth, ye, yr, over=.4, th=.14, cx=0, col=ROOFC, ridge_axis='z'):
    """人字屋頂（屋脊沿 ridge_axis）；span = 牆外寬，ye = 簷口高、yr = 屋脊高"""
    half = span / 2 + over
    slope = (yr - ye) / (span / 2)
    ang = math.atan(slope)
    ye2 = ye - over * slope
    L = math.hypot(half, yr - ye2) + .15
    parts = []
    for sx in (1, -1):
        mx, my = sx * half / 2, (yr + ye2) / 2
        n = (sx * math.sin(ang), math.cos(ang))
        c = (mx + n[0] * th / 2, my + n[1] * th / 2)
        if ridge_axis == 'z':
            parts.append(wbox('rf', 'roof', col, (cx + c[0], c[1], 0), (L, th, depth + over * 2), rot=(0, 0, -sx * ang), step=1.2))
        else:
            parts.append(wbox('rf', 'roof', col, (0, c[1], cx + c[0]), (depth + over * 2, th, L), rot=(sx * ang, 0, 0), step=1.2))
    if ridge_axis == 'z':
        parts.append(wbox('rc', 'roof', 0x45484c, (cx, yr + th * .9, 0), (.3, .1, depth + over * 2)))
        COL.append([round(cx - half, 2), round(ye2, 2), round(-(depth / 2 + over), 2), round(cx + half, 2), round(yr + th, 2), round(depth / 2 + over, 2)])
    else:
        parts.append(wbox('rc', 'roof', 0x45484c, (0, yr + th * .9, cx), (depth + over * 2, .1, .3)))
        COL.append([round(-(depth / 2 + over), 2), round(ye2, 2), round(cx - half, 2), round(depth / 2 + over, 2), round(yr + th, 2), round(cx + half, 2)])
    return parts


def house_a(at):
    COL = []
    P = []
    W, D, FY, WH, t = 7.0, 9.0, .3, 3.1, .2
    x0, x1, z0, z1 = -W / 2, W / 2, -D / 2, D / 2
    P.append(wbox('fd', 'plain', FLOORC, (0, (FY - .02) / 2, 0), (W + .1, FY - .02, D + .1), step=1.5)); COL.append(aabb((0, FY / 2, 0), (W + .1, FY, D + .1)))
    P.append(wbox('fl', 'wood', 0x8a6a4a, (0, FY - .01, 0), (W - .4, .02, D - .4), step=1.5))
    door = (-.55, .55, FY, FY + 2.15)
    wins_f = [(1.3, 2.5, 1.2, 2.3), (-2.5, -1.3, 1.2, 2.3)]
    P.append(wall(COL, 'wf', 'paint', WALLC, 'x', z1 - t / 2, x0, x1, FY, WH, t, [door] + wins_f))
    wins_b = [(-1.0, 1.0, 1.3, 2.3)]
    P.append(wall(COL, 'wb', 'paint', WALLC, 'x', z0 + t / 2, x0, x1, FY, WH, t, wins_b))
    wins_r = [(1.2, 2.4, 1.2, 2.3), (-3.0, -1.8, 1.2, 2.3)]
    P.append(wall(COL, 'wr', 'paint', WALLC, 'z', x1 - t / 2, z0 + t, z1 - t, FY, WH, t, wins_r))
    wins_l = [(-.5, .7, 1.2, 2.3), (-3.3, -2.1, 1.2, 2.3)]
    P.append(wall(COL, 'wl', 'paint', WALLC, 'z', x0 + t / 2, z0 + t, z1 - t, FY, WH, t, wins_l))
    idoor = (1.0, 1.95, FY, FY + 2.1)
    P.append(wall(COL, 'wi', 'paint', 0xf2eee6, 'x', -1.2, x0 + t, x1 - t, FY, WH, .12, [idoor]))
    for h in [door] + wins_f:
        P.append(opening_trim('tf', TRIM, 'x', z1 - t / 2, t, h, sill=h is not door, role='plain'))
    for h in wins_b:
        P.append(opening_trim('tb', TRIM, 'x', z0 + t / 2, t, h, role='plain'))
    for h in wins_r:
        P.append(opening_trim('tr', TRIM, 'z', x1 - t / 2, t, h, role='plain'))
    for h in wins_l:
        P.append(opening_trim('tl', TRIM, 'z', x0 + t / 2, t, h, role='plain'))
    for h in wins_f:
        P.append(pane('gf', 'x', z1 - t / 2, h))
    for h in wins_b:
        P.append(pane('gb', 'x', z0 + t / 2, h))
    for h in wins_r:
        P.append(pane('gr', 'z', x1 - t / 2, h))
    for h in wins_l:
        P.append(pane('gl', 'z', x0 + t / 2, h))
    P.append(wbox('ce', 'plain', 0xefece4, (0, WH - .03, 0), (W - 2 * t, .04, D - 2 * t)))
    # 門扇（向內開 90°）與窗格
    P.append(wbox('dr', 'wood', 0x6e4a2f, (-.55 + .03, FY + 1.05, z1 - t - .5), (.05, 2.1, 1.0))); COL.append(aabb((-.52, FY + 1.05, z1 - t - .5), (.05, 2.1, 1.0)))
    mull = []
    for (u0, u1, y0, y1) in wins_f:
        mull += [(((u0 + u1) / 2, (y0 + y1) / 2, z1 - t / 2), (.04, y1 - y0, .05)), (((u0 + u1) / 2, (y0 + y1) / 2, z1 - t / 2), (u1 - u0, .04, .05))]
    P.append(wboxes('mu', 'plain', TRIM, mull))
    # 山牆、屋頂、煙囪
    for zz in (z1 - t / 2, z0 + t / 2):
        P.append(prism('gw', 'paint', WALLC, [(x0, WH), (x1, WH), (0, 5.0)], zz - t / 2, zz + t / 2))
    P += gable_roof(COL, W, D, WH, 5.0)
    P.append(wbox('ch', 'rock', 0x8e6f5c, (-2.0, 4.4, -2.4), (.6, 2.6, .6), step=.8)); COL.append(aabb((-2.0, 4.4, -2.4), (.6, 2.6, .6)))
    P.append(wbox('chc', 'plain', 0x6a6a66, (-2.0, 5.75, -2.4), (.7, .1, .7)))
    # 門廊：木平台、柱、小屋簷、台階
    P.append(wbox('pd', 'wood', 0x8b6c4c, (0, .14, z1 + .75), (2.8, .28, 1.5), step=1.0)); COL.append(aabb((0, .14, z1 + .75), (2.8, .28, 1.5)))
    P.append(wbox('ps', 'wood', 0x8b6c4c, (0, .07, z1 + 1.7), (1.4, .14, .4))); COL.append(aabb((0, .07, z1 + 1.7), (1.4, .14, .4)))
    for sx in (1, -1):
        P.append(wbox('pp', 'wood', 0xe0dace, (sx * 1.25, 1.5, z1 + 1.35), (.12, 2.45, .12))); COL.append(aabb((sx * 1.25, 1.5, z1 + 1.35), (.12, 2.45, .12)))
    P.append(wbox('pr', 'roof', ROOFC, (0, 2.85, z1 + .8), (3.0, .1, 1.9), rot=(.18, 0, 0)))
    # 屋內：桌子、櫃子、床
    P.append(wbox('tb', 'wood', 0x7b5a3a, (-1.6, FY + .74, 1.6), (1.2, .06, .8)))
    P.append(wboxes('tl', 'wood', 0x6b4a2e, [((-1.6 + sx * .52, FY + .36, 1.6 + sz * .32), (.06, .72, .06)) for sx in (1, -1) for sz in (1, -1)]))
    COL.append(aabb((-1.6, FY + .385, 1.6), (1.2, .77, .8)))
    P.append(wbox('cb', 'wood', 0x5e4430, (2.9, FY + .9, 3.2), (.6, 1.8, 1.4))); COL.append(aabb((2.9, FY + .9, 3.2), (.6, 1.8, 1.4)))
    P.append(wbox('bd', 'plain', 0xd8d2c4, (-2.3, FY + .3, -3.2), (1.6, .45, 2.0))); COL.append(aabb((-2.3, FY + .25, -3.2), (1.6, .5, 2.0)))
    P.append(wbox('bh', 'wood', 0x6b4a2e, (-2.3, FY + .55, -4.15), (1.6, 1.1, .1)))
    return asset('HOUSE_A', P, at, 1.5, COL,
                 doors=[dict(name='front', center=[0, FY, round(z1 - t / 2, 2)], width=1.1, height=2.15, facing='+z', note='open doorway; door leaf is swung inside against the left jamb'),
                        dict(name='inner', center=[1.475, FY, -1.2], width=.95, height=2.1, facing='+z', note='bedroom doorway in partition')],
                 floors=[dict(y=FY, area=[x0 + t, z0 + t, x1 - t, z1 - t], note='interior floor'), dict(y=.28, area=[-1.4, z1, 1.4, z1 + 1.5], note='porch deck; step top .14 at z≈5.9')],
                 notes='single storey, gable roof (ridge along z, 5.0 m). Walls 0.2 m; windows are glass panes (use see-through material). Interior wall faces are role plain (off-white), so tinting paint only changes the outside.',
                 grime=.25, inside=((x0, x1, z0, z1, t * .75, WH + .01), 'plain', 0xefeae0))


def house_b(at):
    COL = []
    P = []
    W, D, FY, H2, WH, t = 8.0, 7.0, .2, 3.2, 5.9, .2
    x0, x1, z0, z1 = -W / 2, W / 2, -D / 2, D / 2
    P.append(wbox('fd', 'plain', FLOORC, (0, FY / 2, 0), (W + .1, FY, D + .1), step=1.5)); COL.append(aabb((0, FY / 2, 0), (W + .1, FY, D + .1)))
    door = (-2.9, -1.8, FY, FY + 2.15)
    wf = [(.2, 1.6, 1.1, 2.2), (2.3, 3.4, 1.1, 2.2), (-2.9, -1.7, 4.1, 5.2), (-.4, .9, 4.1, 5.2), (2.2, 3.4, 4.1, 5.2)]
    wb = [(-1.0, 1.0, 1.1, 2.2), (-2.5, -1.3, 4.1, 5.2), (1.3, 2.5, 4.1, 5.2)]
    udoor = (-3.0, -1.95, H2, H2 + 2.15)
    wr = [(.3, 1.5, 1.1, 2.2), (.3, 1.5, 4.1, 5.2)]
    wl = [(-1.2, 0, 1.1, 2.2), (-1.2, 0, 4.1, 5.2), (1.5, 2.5, 4.1, 5.2)]
    P.append(wall(COL, 'wf', 'paint', WALLC, 'x', z1 - t / 2, x0, x1, FY, WH, t, [door] + wf))
    P.append(wall(COL, 'wb', 'paint', WALLC, 'x', z0 + t / 2, x0, x1, FY, WH, t, wb))
    P.append(wall(COL, 'wr', 'paint', WALLC, 'z', x1 - t / 2, z0 + t, z1 - t, FY, WH, t, [udoor] + wr))
    P.append(wall(COL, 'wl', 'paint', WALLC, 'z', x0 + t / 2, z0 + t, z1 - t, FY, WH, t, wl))
    for h in [door] + wf:
        P.append(opening_trim('t', TRIM, 'x', z1 - t / 2, t, h, sill=h is not door, role='plain'))
    for h in wb:
        P.append(opening_trim('t', TRIM, 'x', z0 + t / 2, t, h, role='plain'))
    for h in [udoor] + wr:
        P.append(opening_trim('t', TRIM, 'z', x1 - t / 2, t, h, sill=h is not udoor, role='plain'))
    for h in wl:
        P.append(opening_trim('t', TRIM, 'z', x0 + t / 2, t, h, role='plain'))
    for h in wf:
        P.append(pane('g', 'x', z1 - t / 2, h))
    for h in wb:
        P.append(pane('g', 'x', z0 + t / 2, h))
    for h in wr:
        P.append(pane('g', 'z', x1 - t / 2, h))
    for h in wl:
        P.append(pane('g', 'z', x0 + t / 2, h))
    # 二樓樓板與腰線
    P.append(wbox('f2', 'wood', 0x7e5f42, (0, H2 - .1, 0), (W - 2 * t, .2, D - 2 * t), step=1.5)); COL.append(aabb((0, H2 - .1, 0), (W - 2 * t, .2, D - 2 * t)))
    P.append(wboxes('bc', 'plain', TRIM, [((0, H2 - .1, z1 + .02), (W + .06, .14, .06)), ((0, H2 - .1, z0 - .02), (W + .06, .14, .06)), ((x0 - .02, H2 - .1, 0), (.06, .14, D + .06)), ((x1 + .02, H2 - .1, 0), (.06, .14, D + .06))]))
    P.append(wbox('ce', 'plain', 0xefece4, (0, WH - .03, 0), (W - 2 * t, .04, D - 2 * t)))
    P.append(wbox('c1', 'plain', 0xefece4, (0, H2 - .21, 0), (W - 2 * t, .02, D - 2 * t)))
    # 屋頂（屋脊沿 x）與山牆
    P += gable_roof(COL, D, W, WH, 7.3, ridge_axis='x')
    for xx in (x1 - t / 2, x0 + t / 2):
        P.append(prism('gw', 'paint', WALLC, [(z0, WH), (z1, WH), (0, 7.3)], xx - t / 2, xx + t / 2, axis='x'))
    # 戶外樓梯（沿 +x 牆，從前往後爬到二樓平台）
    n, rise, run = 16, H2 / 16, .28
    zb = z1 - .2
    sx0, sx1 = x1 + .05, x1 + 1.25
    tr = []
    for k in range(1, n + 1):
        zc = zb - run * (k - .5)
        tr.append(((sx0 + sx1) / 2, rise * k - .03, zc))
        COL.append([round(sx0, 2), 0, round(zb - run * k, 2), round(sx1, 2), round(rise * k, 2), round(zb - run * (k - 1), 2)])
    P.append(wboxes('st', 'wood', 0x8a6a48, [(c, (sx1 - sx0, .06, run + .02)) for c in tr]))
    ztop = zb - run * n
    for xs in (sx0 + .04, sx1 - .04):
        P.append(wbox('sg', 'wood', 0x6f5238, (xs, H2 / 2 - .15, (zb + ztop) / 2), (.07, .3, math.hypot(zb - ztop, H2) + .2), rot=(math.atan2(H2, zb - ztop), 0, 0)))
    P.append(wbox('ld', 'wood', 0x8a6a48, ((sx0 + sx1) / 2, H2 - .1, (ztop + z0) / 2), (sx1 - sx0, .2, ztop - z0), step=1.0)); COL.append(aabb(((sx0 + sx1) / 2, H2 - .1, (ztop + z0) / 2), (sx1 - sx0, .2, ztop - z0)))
    posts = [(sx1 - .04, zb - .1), (sx1 - .04, (zb + ztop) / 2), (sx1 - .04, ztop), (sx1 - .04, z0 + .05)]
    lp = []
    for (px, pz) in posts:
        yb_ = H2 * max(0, min(1, (zb - pz) / (zb - ztop)))
        lp.append(((px, yb_ + .5, pz), (.07, 1.0, .07)))
    P.append(wboxes('lp', 'wood', 0x6f5238, lp))
    P.append(wtube('hr', 'wood', 0x6f5238, [(sx1 - .04, 1.0, zb - .1), (sx1 - .04, H2 + 1.0, ztop), (sx1 - .04, H2 + 1.0, z0 + .05), (x1 + .05, H2 + 1.0, z0 + .05)], .035, 6, True, .05, False))
    P.append(wboxes('lu', 'wood', 0x6f5238, [((sx1 - .04, H2 / 2, ztop - .05), (.12, H2, .12)), ((sx1 - .04, H2 / 2, z0 + .1), (.12, H2, .12))]))
    COL.append([round(sx1 - .1, 2), 0, round(z0, 2), round(sx1 + .02, 2), round(H2 + 1.0, 2), round(ztop, 2)])
    return asset('HOUSE_B', P, at, 1.5, COL,
                 doors=[dict(name='ground', center=[-2.35, FY, round(z1 - t / 2, 2)], width=1.1, height=2.15, facing='+z', note='open doorway'),
                        dict(name='upper', center=[round(x1 - t / 2, 2), H2, -2.475], width=1.05, height=2.15, facing='+x', note='from the outdoor landing')],
                 floors=[dict(y=FY, area=[x0 + t, z0 + t, x1 - t, z1 - t], note='ground floor'), dict(y=H2, area=[x0 + t, z0 + t, x1 - t, z1 - t], note='upper floor (no inside stair)'),
                         dict(y=H2, area=[round(sx0, 2), round(z0, 2), round(sx1, 2), round(ztop, 2)], note='outdoor landing'),
                         dict(ramp=dict(x0=round(sx0, 2), x1=round(sx1, 2), z_bottom=round(zb, 2), y_bottom=0, z_top=round(ztop, 2), y_top=H2), note='outdoor stair: 16 steps 0.2 rise × 0.28 run climbing toward -z (step boxes are also in col)')],
                 notes='two storeys; gable roof ridge along x (7.3 m). Stair and landing stick out on +x (x 4.05..5.25). Interior wall faces are role plain.',
                 grime=.25, inside=((x0, x1, z0, z1, t * .75, WH + .01), 'plain', 0xece6da))


def corr_sheet(name, role, color, O, U, Wv, N, ulen, wlen, pitch=.16, amp=.028, th=.012):
    """浪板：沿 U 方向起伏、W 方向延伸，N 為外側法線"""
    O, U, Wv, N = Vector(O), Vector(U).normalized(), Vector(Wv).normalized(), Vector(N).normalized()
    n = max(2, int(ulen / (pitch / 2)))
    bm = bmesh.new()
    rows = []
    for side in (0, 1):
        for w in (0, wlen):
            rows.append([bm.verts.new(O + U * (ulen * i / n) + Wv * w + N * ((amp if i % 2 else -amp) - side * th)) for i in range(n + 1)])
    fo0, fo1, bk0, bk1 = rows
    flip = U.cross(Wv).dot(N) < 0
    for i in range(n):
        f = (fo0[i], fo0[i + 1], fo1[i + 1], fo1[i])
        b = (bk0[i], bk1[i], bk1[i + 1], bk0[i + 1])
        bm.faces.new(tuple(reversed(f)) if flip else f)
        bm.faces.new(tuple(reversed(b)) if flip else b)
    return wfinish(bm, name, role, color, (0, 0, 0), None, False, .06, recalc=False)


def shed(at):
    COL, P = [], []
    x0, x1, z0, z1 = -2.0, 2.0, -2.5, 2.5
    yf, yb = 3.0, 2.6
    P.append(wbox('fl', 'plain', 0x8f8c84, (0, .05, 0), (4.1, .1, 5.1), step=1.2)); COL.append(aabb((0, .05, 0), (4.1, .1, 5.1)))
    for (px, pz) in ((x0, z0), (x1, z0), (x0, z1), (x1, z1)):
        h = yf if pz > 0 else yb
        P.append(wbox('po', 'wood', 0x6a5540, (px, h / 2, pz), (.12, h, .12))); COL.append(aabb((px, h / 2, pz), (.12, h, .12)))
    P.append(wboxes('gt', 'wood', 0x6a5540, [((0, yf - .08, z1), (4.1, .14, .12)), ((0, yb - .08, z0), (4.1, .14, .12)), ((x0 + .02, 1.2, 0), (.06, .1, 5.0)), ((x1 - .02, 1.2, 0), (.06, .1, 5.0))]))   # 橫檔縮在浪板內側，不會從波谷穿出去
    P.append(corr_sheet('bw', 'metal', 0x9ea3a6, (x0, 0, z0 - .07), (1, 0, 0), (0, 1, 0), (0, 0, -1), 4.0, yb - .05))
    COL.append([x0, 0, z0 - .1, x1, yb, z0 - .04])
    for sx in (1, -1):
        xx = sx * (x1 + .07)
        # 側牆：上緣跟著屋頂斜
        bm = bmesh.new()
        n = 32
        rows = []
        for side in (0, 1):
            r = []
            for i in range(n + 1):
                zz = z0 + (z1 - z0) * i / n
                top = yb + (yf - yb) * i / n - .12
                off = (.028 if i % 2 else -.028) - side * .012
                r.append((bm.verts.new((xx + sx * off, 0, zz)), bm.verts.new((xx + sx * off, top, zz))))
            rows.append(r)
        for i in range(n):
            a, b = rows[0][i], rows[0][i + 1]
            f = (a[0], b[0], b[1], a[1])
            bm.faces.new(tuple(reversed(f)) if sx > 0 else f)
            a, b = rows[1][i], rows[1][i + 1]
            f = (a[0], a[1], b[1], b[0])
            bm.faces.new(tuple(reversed(f)) if sx > 0 else f)
        P.append(wfinish(bm, 'sw', 'metal', 0x9aa0a3, (0, 0, 0), None, False, .06, recalc=False))
        COL.append([round(min(xx, xx + sx * .06), 2), 0, z0, round(max(xx, xx + sx * .06), 2), yf, z1])
    ang = math.atan2(yf - yb, z1 - z0)
    L = math.hypot(z1 - z0, yf - yb) + .6
    P.append(corr_sheet('rf', 'roof', 0x8e9396, (x0 - .25, yb + .06 - .3 * math.sin(ang), z0 - .3 * math.cos(ang)), (1, 0, 0), (0, math.sin(ang), math.cos(ang)), (0, math.cos(ang), -math.sin(ang)), 4.5, L))
    COL.append([x0 - .25, yb, z0 - .3, x1 + .25, yf + .12, z1 + .3])
    # 收邊板：牆頂到屋頂下緣之間補一條平板，浪板的起伏不會露出天空
    tg = math.tan(ang)
    yroof = lambda z: yb + .06 + (z - z0) * tg - .025
    for sx in (1, -1):
        xx = sx * (x1 + .07)
        wt = lambda z: yb + (yf - yb) * (z - z0) / (z1 - z0) - .18
        P.append(prism('fl', 'metal', 0x8a8f92, [(z0 - .02, wt(z0 - .02)), (z1 + .02, wt(z1 + .02)), (z1 + .02, yroof(z1 + .02)), (z0 - .02, yroof(z0 - .02))], xx - .045, xx + .045, axis='x'))
    zb_ = z0 - .07
    P.append(prism('fb', 'metal', 0x8a8f92, [(x0 - .06, yb - .11), (x1 + .06, yb - .11), (x1 + .06, yroof(zb_)), (x0 - .06, yroof(zb_))], zb_ - .045, zb_ + .045))
    # 工作台、油桶
    P.append(wbox('wb', 'wood', 0x7d5d3e, (0, .9, z0 + .45), (2.2, .08, .7)))
    P.append(wboxes('wl', 'wood', 0x6a4c32, [((sx * 1.0, .45, z0 + .45 + sz * .28), (.07, .9, .07)) for sx in (1, -1) for sz in (1, -1)]))
    COL.append(aabb((0, .47, z0 + .45), (2.2, .94, .7)))
    for (bx, bz, c) in ((1.4, 1.5, 0x3d6b8e), (1.45, .8, 0xb8452c)):
        P.append(wlathe('br', 'metal', c, [(.29, 0), (.3, .02), (.3, .86), (.29, .88), (.001, .88)], (bx, .1, bz), 14, cap_bot=True))
        COL.append(aabb((bx, .54, bz), (.6, .88, .6)))
    return asset('SHED', P, at, 1.2, COL, floors=[dict(y=.1, area=[x0, z0, x1, z1])], notes='open front (+z); mono-pitch roof 3.0 m front → 2.6 m back; corrugated sheets (metal / roof).', grime=.3)


def barn(at):
    COL, P = [], []
    W, D, t, WH = 10.0, 14.0, .2, 4.5
    x0, x1, z0, z1 = -W / 2, W / 2, -D / 2, D / 2
    RED = 0xffffff
    P.append(wbox('fl', 'plain', 0x8a7f6e, (0, .05, 0), (W, .1, D), step=2.0)); COL.append(aabb((0, .05, 0), (W, .1, D)))
    big = (-2.2, 2.2, .1, 4.3)
    P.append(wall(COL, 'wf', 'paint', RED, 'x', z1 - t / 2, x0, x1, .1, WH, t, [big], 1.0))
    back = (-1.0, 1.0, .1, 2.4)
    P.append(wall(COL, 'wb', 'paint', RED, 'x', z0 + t / 2, x0, x1, .1, WH, t, [back], 1.0))
    wins = [(-5.0, -4.0, 2.4, 3.2), (-.5, .5, 2.4, 3.2), (4.0, 5.0, 2.4, 3.2)]
    for sx in (1, -1):
        P.append(wall(COL, 'ws', 'paint', RED, 'z', sx * (x1 - t / 2), z0 + t, z1 - t, .1, WH, t, wins, 1.0))
        for h in wins:
            P.append(opening_trim('t', TRIM, 'z', sx * (x1 - t / 2), t, h, role='plain'))
            P.append(pane('g', 'z', sx * (x1 - t / 2), h, 0x6c7f88))
    P.append(opening_trim('t', TRIM, 'x', z1 - t / 2, t, big, .14, sill=False, role='plain'))
    P.append(opening_trim('t', TRIM, 'x', z0 + t / 2, t, back, sill=False, role='plain'))
    # 腳線、轉角白框
    P.append(wboxes('ct', 'plain', TRIM, [((sx * (x1 + .02), WH / 2, sz * (z1 + .02)), (.16, WH, .16)) for sx in (1, -1) for sz in (1, -1)]))
    # 雙斜折線屋頂（gambrel）與山牆
    prof = [(-5.4, 4.3), (-3.6, 6.9), (0, 8.3), (3.6, 6.9), (5.4, 4.3)]
    th = .16
    for (a, b) in zip(prof, prof[1:]):
        ang = math.atan2(b[1] - a[1], b[0] - a[0])
        L = math.hypot(b[0] - a[0], b[1] - a[1]) + .1
        n = (-math.sin(ang), math.cos(ang))
        P.append(wbox('rf', 'roof', 0x4f5357, ((a[0] + b[0]) / 2 + n[0] * th / 2, (a[1] + b[1]) / 2 + n[1] * th / 2, 0), (L, th, D + .8), rot=(0, 0, ang), step=1.5))
    COL.append([-5.4, 4.3, -(D / 2 + .4), 5.4, 8.45, D / 2 + .4])
    gpoly = [(-5.0, WH), (5.0, WH), (3.45, 6.75), (0, 8.1), (-3.45, 6.75)]
    for zz in (z1 - t / 2, z0 + t / 2):
        P.append(prism('gw', 'paint', RED, gpoly, zz - t / 2, zz + t / 2))
    # 拉門（推到兩側）與 X 形白框、草料門、屋頂通風塔
    for sx in (1, -1):
        cx = sx * (2.2 + 1.15 + .05)
        P.append(wbox('dl', 'paint', RED, (cx, 2.2, z1 + .1), (2.3, 4.2, .08)))
        L = math.hypot(2.1, 4.0)
        P.append(wboxes('dx', 'plain', TRIM, [((cx, 2.2, z1 + .15), (2.3, .12, .03)), ((cx, 4.24, z1 + .15), (2.3, .12, .03)), ((cx, .16, z1 + .15), (2.3, .12, .03)), ((cx - 1.1, 2.2, z1 + .15), (.12, 4.2, .03)), ((cx + 1.1, 2.2, z1 + .15), (.12, 4.2, .03))]))
        P.append(wbox('dxd', 'plain', TRIM, (cx, 2.2, z1 + .16), (.1, L, .03), rot=(0, 0, math.atan2(2.1, 4.0))))
        COL.append(aabb((cx, 2.2, z1 + .12), (2.3, 4.2, .12)))
    P.append(wboxes('rl', 'metal', 0x3a3c3e, [((0, 4.45, z1 + .12), (9.4, .08, .08))]))
    P.append(opening_trim('hl', TRIM, 'x', z1 - t / 2, t, (-.9, .9, 5.2, 6.7), .12, role='plain'))
    P.append(wbox('hd', 'wood', 0x6b4a33, (0, 5.95, z1 - t / 2 + .09), (1.8, 1.5, .04)))
    P.append(wbox('cu', 'paint', RED, (0, 8.75, 0), (1.2, .9, 1.2)))
    P.append(wboxes('cul', 'plain', 0x2a2a2a, [((0, 8.8, sz * .61), (.8, .45, .02)) for sz in (1, -1)] + [((sx * .61, 8.8, 0), (.02, .45, .8)) for sx in (1, -1)]))
    P.append(wlathe('cur', 'roof', 0x4f5357, [(.95, 0), (.001, .6)], (0, 9.2, 0), 4, rot=(0, math.pi / 4, 0), cap_bot=True, smooth=False))
    # 草捆
    hay = [((-3.5, .55, -5.5), (1.1, .9, 2.0)), ((-3.5, 1.45, -5.2), (1.1, .9, 2.0)), ((-2.3, .55, -5.6), (1.1, .9, 2.0)), ((3.6, .55, -4.8), (1.1, .9, 2.0))]
    P.append(wboxes('hy', 'plain', 0xc9b26e, hay))
    for (c, s) in hay:
        COL.append(aabb(c, s))
    return asset('BARN', P, at, 1.5, COL,
                 doors=[dict(name='main', center=[0, .1, round(z1 - t / 2, 2)], width=4.4, height=4.2, facing='+z', note='sliding doors pushed open to the sides'),
                        dict(name='back', center=[0, .1, round(z0 + t / 2, 2)], width=2.0, height=2.3, facing='-z')],
                 floors=[dict(y=.1, area=[x0 + t, z0 + t, x1 - t, z1 - t])],
                 notes="walls are role 'paint' outside (suggest barn red 0x9b2f24); inside faces are role wood (raw boards); gambrel roof ridge 8.3 m + cupola to 9.8 m.",
                 grime=.3, inside=((x0, x1, z0, z1, t * .75, 8.2), 'wood', 0x9a7b58))


def gas_canopy(at):
    COL, P = [], []
    for (px, pz) in ((-4.5, -2.5), (4.5, -2.5), (-4.5, 2.5), (4.5, 2.5)):
        P.append(wbox('co', 'metal', 0xd9dad6, (px, 2.5, pz), (.45, 5.0, .45), step=1.5)); COL.append(aabb((px, 2.5, pz), (.45, 5.0, .45)))
        P.append(wbox('cb', 'plain', 0x8f8d88, (px, .3, pz), (.7, .6, .7))); COL.append(aabb((px, .3, pz), (.7, .6, .7)))
    P.append(wbox('ck', 'plain', 0xe7e6e2, (0, 5.45, 0), (13.8, .8, 8.8), step=2.0)); COL.append(aabb((0, 5.45, 0), (14.0, .9, 9.0)))
    P.append(wboxes('fa', 'paint', 0xffffff, [((0, 5.45, 4.45), (14.0, .9, .1)), ((0, 5.45, -4.45), (14.0, .9, .1)), ((7.0, 5.45, 0), (.1, .9, 9.0)), ((-7.0, 5.45, 0), (.1, .9, 9.0))], step=2.0))
    P.append(wboxes('fs', 'plain', 0x2b2c2e, [((0, 5.1, 4.51), (14.0, .08, .02)), ((0, 5.1, -4.51), (14.0, .08, .02)), ((7.06, 5.1, 0), (.02, .08, 9.0)), ((-7.06, 5.1, 0), (.02, .08, 9.0))]))
    P.append(wboxes('lt', 'emit', 0xfff3d6, [((x, 5.04, z), (1.3, .03, .6)) for x in (-4.0, 0, 4.0) for z in (-1.8, 1.8)]))
    P.append(wboxes('lr', 'metal', 0x9a9c9e, [((x, 5.055, z), (1.45, .03, .75)) for x in (-4.0, 0, 4.0) for z in (-1.8, 1.8)]))
    return asset('GAS_CANOPY', P, at, 1.2, COL, notes="fascia is role 'paint' (brand colour); lamp panels are role 'emit' on the underside at y≈5.0. Drive-through clearance 5.0 m.", grime=.2)


def gas_pump(at):
    COL, P = [], []
    P.append(wbox('is', 'plain', 0xa9a79f, (0, .09, 0), (2.6, .18, 1.0), .03)); COL.append(aabb((0, .09, 0), (2.6, .18, 1.0)))
    P.append(wbox('pb', 'paint', 0xffffff, (0, .98, 0), (.75, 1.6, .45), .03, step=.6)); COL.append(aabb((0, 1.03, 0), (.8, 1.7, .5)))
    P.append(wbox('ph', 'plain', 0x2b2d30, (0, 1.83, 0), (.8, .1, .5), .02))
    P.append(wbox('pp', 'metal', 0xb7bbbe, (0, .55, 0), (.77, .5, .47), .02))
    for sz in (1, -1):
        P.append(wbox('sc', 'emit', 0x9fd8ff, (0, 1.45, sz * .232), (.36, .2, .01)))
        P.append(wbox('kp', 'plain', 0x303235, (.18, 1.18, sz * .232), (.16, .18, .01)))
        P.append(wbox('lg', 'plain', 0xf4f2ec, (0, 1.72, sz * .232), (.6, .12, .01)))
    for sx in (1, -1):
        P.append(wbox('ho', 'metal', 0x3a3c3f, (sx * .4, 1.1, 0), (.06, .3, .16)))
        P.append(wtube('hs', 'plain', 0x151617, [(sx * .38, 1.55, .0), (sx * .55, 1.3, .12), (sx * .5, .6, .15), (sx * .44, .95, .05), (sx * .42, 1.12, 0)], .02, 6, True, .02))
        P.append(wcyls('bo', 'metal', 0xe6b422, [((sx * 1.15, .18, 0), (sx * 1.15, 1.05, 0), .09)], 12))
        P.append(wcyls('bot', 'plain', 0x1f1f1f, [((sx * 1.15, .7, 0), (sx * 1.15, .8, 0), .092)], 12))
        COL.append(aabb((sx * 1.15, .6, 0), (.2, 1.05, .2)))
    return asset('GAS_PUMP', P, at, .8, COL, notes="pump body role 'paint'; screens role 'emit'. Island top is y 0.18.", grime=.2)


def gas_shop(at):
    COL, P = [], []
    W, D, t, WH, FY = 10.0, 8.0, .2, 4.0, .2
    x0, x1, z0, z1 = -W / 2, W / 2, -D / 2, D / 2
    P.append(wbox('fd', 'plain', 0xb5b2aa, (0, FY / 2, 0), (W + .1, FY, D + .1), step=1.5)); COL.append(aabb((0, FY / 2, 0), (W + .1, FY, D + .1)))
    P.append(wbox('sw', 'plain', 0xa9a79f, (0, .06, z1 + 1.0), (W + .1, .12, 2.0), step=1.5)); COL.append(aabb((0, .06, z1 + 1.0), (W + .1, .12, 2.0)))
    front = (-4.4, 4.4, FY, 3.3)
    P.append(wall(COL[:0] if False else COL, 'wf', 'paint', WALLC, 'x', z1 - t / 2, x0, x1, FY, WH, t, [front]))
    bdoor = (2.9, 3.9, FY, FY + 2.1)
    P.append(wall(COL, 'wb', 'paint', WALLC, 'x', z0 + t / 2, x0, x1, FY, WH, t, [bdoor]))
    for sx in (1, -1):
        P.append(wall(COL, 'ws', 'paint', WALLC, 'z', sx * (x1 - t / 2), z0 + t, z1 - t, FY, WH, t, []))
    # 店面：鋁框、下踢板、玻璃；門口（x -0.65..0.65）開著
    zf = z1 - t / 2
    fr = [((0, 3.3 - .04, zf), (8.8, .08, .12)), ((0, .7, zf), (8.8, .06, .12))]
    for xm in (-4.4, -3.0, -1.6, -.7, .7, 1.6, 3.0, 4.4):
        fr.append(((xm, (FY + 3.3) / 2, zf), (.08, 3.3 - FY, .12)))
    fr.append(((0, 2.55, zf), (1.4, .08, .12)))
    P.append(wboxes('mf', 'metal', 0x3b3f44, fr))
    kick = [((-2.55, .45, zf), (3.7, .5, .08)), ((2.55, .45, zf), (3.7, .5, .08))]
    P.append(wboxes('kk', 'metal', 0x4a4e53, kick))
    for (c, s) in kick:
        COL.append(aabb(c, s))
    gl = [((-2.55, 2.0, zf), (3.7, 2.55, .02)), ((2.55, 2.0, zf), (3.7, 2.55, .02)), ((0, 2.93, zf), (1.3, .7, .02))]
    P.append(wboxes('gf', 'glass', 0x8fa9b8, gl, var=0))
    for (c, s) in gl[:2]:
        COL.append(aabb(c, (s[0], s[1], .12)))
    P.append(opening_trim('t', 0xd8d8d4, 'x', z0 + t / 2, t, bdoor, sill=False, role='plain'))
    P.append(wbox('bd', 'metal', 0x6d7176, (3.4, FY + 1.05, z0 + .06), (.98, 2.08, .05)))
    # 招牌帶（正面 UV 0..1，網頁可以畫店名）、平屋頂、女兒牆、冷氣
    sign = wbox('sg', 'paint', 0xffffff, (0, 3.65, z1 + .08), (W + .2, .7, .16))
    me = sign.data
    uvl = me.uv_layers[0]
    ka = me.attributes['kuv']
    for p in me.polygons:
        if p.normal.y < -.9:      # Blender -y = three +z
            ka.data[p.index].value = 1
            for li in p.loop_indices:
                q = me.vertices[me.loops[li].vertex_index].co
                uvl.data[li].uv = ((q.x + (W + .2) / 2) / (W + .2), (q.z - 3.3) / .7)
    P.append(sign)
    P.append(wbox('rf', 'roof', 0x55585c, (0, WH + .15, 0), (W + .3, .3, D + .3), step=2.0)); COL.append(aabb((0, WH + .15, 0), (W + .3, .3, D + .3)))
    P.append(wboxes('pa', 'paint', 0xe9e6de, [((0, WH + .55, z1 + .05), (W + .3, .5, .2)), ((0, WH + .55, z0 - .05), (W + .3, .5, .2)), ((x1 + .05, WH + .55, 0), (.2, .5, D + .3)), ((x0 - .05, WH + .55, 0), (.2, .5, D + .3))]))
    P.append(wbox('ac', 'metal', 0xb5b8ba, (-2.5, WH + .75, -1.5), (1.6, .9, 1.1), .03))
    P.append(wcyls('af', 'plain', 0x2a2b2d, [((-2.5, WH + 1.2, -1.5), (-2.5, WH + 1.22, -1.5), .4)], 16))
    P.append(wbox('ip', 'plain', 0xefede7, (0, WH - .05, 0), (W - .4, .06, D - .4)))
    # 店內：櫃台、兩排貨架、飲料冰箱
    P.append(wbox('ct', 'wood', 0x7c5b3d, (-3.2, FY + .5, -1.8), (2.6, 1.0, .8), .02)); COL.append(aabb((-3.2, FY + .5, -1.8), (2.6, 1.0, .8)))
    P.append(wbox('ctt', 'plain', 0xd9d4c8, (-3.2, FY + 1.02, -1.8), (2.7, .05, .9)))
    for zz in (-.2, 1.6):
        P.append(wbox('sh', 'metal', 0xc6c8ca, (1.2, FY + .75, zz), (3.4, 1.5, .5))); COL.append(aabb((1.2, FY + .75, zz), (3.4, 1.5, .5)))
        rng = rng_for(int(zz * 10) + 99)
        goods = []
        for lvl in (.45, .95, 1.4):
            xg = -.45
            while xg < 2.8:
                w = rng.uniform(.15, .3)
                goods.append(((xg + w / 2, FY + lvl + .09, zz), (w * .9, .18, .56)))
                xg += w
        P.append(wboxes('gd', 'plain', 0xd7b04a, goods, var=.5))
    P.append(wbox('fr', 'metal', 0xdadcdd, (4.3, FY + 1.0, -2.8), (1.0, 2.0, .9), .02)); COL.append(aabb((4.3, FY + 1.0, -2.8), (1.0, 2.0, .9)))
    P.append(wbox('frg', 'glass', 0x9fc2d4, (4.3, FY + 1.1, -2.34), (.8, 1.6, .02), var=0))
    return asset('GAS_SHOP', P, at, 1.5, COL,
                 doors=[dict(name='front', center=[0, FY, round(zf, 2)], width=1.3, height=2.3, facing='+z', note='open doorway in the glass storefront'),
                        dict(name='back', center=[3.4, FY, round(z0 + t / 2, 2)], width=1.0, height=2.1, facing='-z', note='closed metal door (visual only)')],
                 floors=[dict(y=FY, area=[x0 + t, z0 + t, x1 - t, z1 - t]), dict(y=.12, area=[x0, z1, x1, z1 + 2.0], note='front sidewalk')],
                 notes="sign band front face has 0..1 UVs (kuv) for a canvas-drawn shop name; storefront glass is role 'glass'; interior wall faces are role plain.",
                 grime=.2, inside=((x0, x1, z0, z1, t * .75, WH + .01), 'plain', 0xeeece6))


x = 0
for fn, w in ((house_a, 12), (house_b, 13), (shed, 8), (barn, 15), (gas_canopy, 17), (gas_pump, 6), (gas_shop, 14)):
    fn((x, 0, 40))
    x += w


# ═════════ 路邊設施 ═════════
def guardrail(at):
    COL, P = [], []
    for px in (-1.0, 1.0):
        P.append(wboxes('po', 'metal', 0x9ea3a6, [((px, .42, -.05), (.1, .84, .15)), ((px, .62, .06), (.08, .2, .12))])); COL.append([px - .06, 0, -.13, px + .06, .84, .12])
    sec = [(.155, 0), (.12, .04), (.06, .045), (.02, .012), (-.02, .012), (-.06, .045), (-.12, .04), (-.155, 0)]
    th = .006
    ring = [(y, z) for (y, z) in sec] + [(y, z - th) for (y, z) in reversed(sec)]
    secs = [[(xx, .62 + y, .12 + z) for (y, z) in ring] for xx in (-2.0, 2.0)]
    P.append(wloft('wb', 'metal', 0xb3b8bb, secs, .03, False, True))
    COL.append([-2.0, .45, .1, 2.0, .8, .18])
    P.append(wboxes('bt', 'metal', 0x7d8286, [((px, .62, .19), (.06, .06, .02)) for px in (-1.0, 1.0)]))
    return asset('GUARDRAIL', P, at, .8, COL, notes='4 m segment along x, posts at x=±1 (tile every 4 m for 2 m post spacing); road side is +z.', grime=.2)


def pole(at):
    COL, P = [], []
    P.append(wcyls('pl', 'wood', 0x5d4a38, [((0, 0, 0), (0, 9.2, 0), .15, .11)], 12))
    COL.append([-.16, 0, -.16, .16, 9.2, .16])
    P.append(wbox('ca', 'wood', 0x5d4a38, (0, 8.45, 0), (2.4, .1, .12)))
    P.append(wboxes('bb', 'wood', 0x4d3d2e, [((sx * .35, 8.2, 0), (.05, .5, .05)) for sx in (1, -1)], rot=None))
    ins = []
    for xx in (-1.05, -.45, .45, 1.05):
        P.append(wlathe('in', 'plain', 0x9aa89a, [(.05, 0), (.07, .04), (.05, .07), (.07, .11), (.04, .15), (.001, .16)], (xx, 8.5, 0), 10, cap_bot=True))
        ins.append([xx, 8.66, 0])
    P.append(wcyls('tf', 'metal', 0x8b9095, [((0, 6.5, .38), (0, 7.3, .38), .28)], 14))
    P.append(wcyls('tfc', 'metal', 0x6d7276, [((0, 7.3, .38), (0, 7.36, .38), .3)], 14))
    P.append(wbox('tfb', 'metal', 0x4a4e52, (0, 6.9, .14), (.2, .5, .1)))
    return asset('POLE', P, at, .8, COL, notes='crossarm along x; wires run along z between poles.', extra=dict(wire_points=ins))


def streetlight(at):
    COL, P = [], []
    P.append(wbox('bp', 'metal', 0x6a6e72, (0, .05, 0), (.45, .1, .45)))
    P.append(wcyls('pl', 'metal', 0x8c9196, [((0, .1, 0), (0, 7.5, 0), .1, .065)], 12))
    COL.append([-.12, 0, -.12, .12, 7.6, .12])
    P.append(wtube('ar', 'metal', 0x8c9196, [(0, 7.2, 0), (0, 7.62, .15), (0, 7.83, .6), (0, 7.9, 1.2), (0, 7.9, 1.75)], [.06, .055, .05, .045, .045], 8, True, .03))
    P.append(wbox('hd', 'metal', 0x6f7478, (0, 7.9, 2.0), (.42, .14, .75), .04))
    P.append(wbox('lg', 'emit', 0xfff1c8, (0, 7.82, 2.02), (.32, .03, .56)))
    return asset('STREETLIGHT', P, at, .8, COL, notes="arm reaches toward +z; lamp glass (role 'emit') faces down at (0, 7.8, 2.0) — put a light there.", extra=dict(light=[0, 7.8, 2.0]))


def sign(at):
    COL, P = [], []
    P.append(wcyls('po', 'metal', 0x9aa0a4, [((0, 0, -.04), (0, 2.5, -.04), .045)], 10))
    COL.append([-.06, 0, -.1, .06, 2.5, .02])
    pl = wbox('pl', 'paint', 0xffffff, (0, 2.05, .0), (1.2, .8, .03), .005)
    me = pl.data
    uvl = me.uv_layers[0]
    ka = me.attributes['kuv']
    for p in me.polygons:
        if p.normal.y < -.9:
            ka.data[p.index].value = 1
            for li in p.loop_indices:
                q = me.vertices[me.loops[li].vertex_index].co
                uvl.data[li].uv = ((q.x + .6) / 1.2, (q.z - 1.65) / .8)
    P.append(pl)
    P.append(wboxes('rm', 'metal', 0xb9bdc0, [((0, 2.45, -.005), (1.24, .04, .03)), ((0, 1.65, -.005), (1.24, .04, .03)), ((.61, 2.05, -.005), (.04, .84, .03)), ((-.61, 2.05, -.005), (.04, .84, .03))]))
    P.append(wboxes('bk', 'metal', 0x7d8286, [((0, 2.05, -.035), (1.18, .78, .01)), ((0, 2.25, -.06), (.2, .06, .05)), ((0, 1.85, -.06), (.2, .06, .05))]))
    COL.append([-.62, 1.63, -.05, .62, 2.47, .03])
    return asset('SIGN', P, at, .8, COL, notes="plate 1.2×0.8 m centred at y 2.05, face +z; front face UV 0..1 (u→+x, v down in glTF) for a canvas-drawn sign.")


def fence(at):
    COL, P = [], []
    rng = rng_for(71)
    for px in (-1.45, 1.45):
        P.append(wbox('po', 'wood', 0x7f6a52, (px, .62, 0), (.12, 1.25, .12))); COL.append(aabb((px, .62, 0), (.12, 1.25, .12)))
        P.append(wlathe('pc', 'wood', 0x6f5c46, [(.085, 0), (.001, .08)], (px, 1.245, 0), 4, rot=(0, math.pi / 4, 0), cap_bot=True, smooth=False))
    P.append(wboxes('rl', 'wood', 0x8c765c, [((0, y + rng.uniform(-.02, .02), .09), (3.02, .11, .05)) for y in (.35, .7, 1.05)], var=.12))
    COL.append([-1.5, 0, -.07, 1.5, 1.2, .12])
    return asset('FENCE_WOOD', P, at, .8, COL, notes='3 m segment along x (posts at x=±1.45); rails on the +z face.', grime=.2)


def pier(at):
    COL, P = [], []
    rng = rng_for(81)
    planks = []
    n = 24
    for i in range(n):
        z = -2.5 + 5.0 * (i + .5) / n
        planks.append(((rng.uniform(-.02, .02), -.025, z), (2.4 + rng.uniform(-.05, .05), .05, 5.0 / n - .018)))
    P.append(wboxes('pk', 'wood', 0x8f7352, planks, var=.18))
    P.append(wboxes('sg', 'wood', 0x5f4a36, [((x, -.15, 0), (.12, .2, 5.0)) for x in (-1.0, 0, 1.0)]))
    pil = []
    for (px, pz) in ((-1.15, -2.3), (1.15, -2.3), (-1.15, 2.3), (1.15, 2.3)):
        pil.append(((px, .25, pz), (px, -3.2, pz), .13))
    P.append(wcyls('pl', 'wood', 0x5a4735, pil, 10))
    P.append(wboxes('xb', 'wood', 0x5a4735, [((0, -.45, pz), (2.3, .12, .08)) for pz in (-2.3, 2.3)]))
    P.append(wcyls('cl', 'metal', 0x3a3c3e, [((1.1, 0, 0), (1.1, .12, 0), .04)], 8))
    P.append(wbox('clt', 'metal', 0x3a3c3e, (1.1, .13, 0), (.06, .04, .3)))
    COL += [[-1.25, -.05, -2.5, 1.25, 0, 2.5]] + [[px - .14, -3.2, pz - .14, px + .14, .25, pz + .14] for (px, pz) in ((-1.15, -2.3), (1.15, -2.3), (-1.15, 2.3), (1.15, 2.3))]
    ob = asset('PIER', P, at, .8, COL, floors=[dict(y=0, area=[-1.2, -2.5, 1.2, 2.5], note='deck top is the origin')],
               notes='5 m segment along z, 2.4 m wide; ORIGIN = deck top centre, pilings reach y -3.2 (set water ~1 m below the deck). Tile along z every 5 m.')
    shade_by(ob, lambda p: .55 if p.y < -1.3 else 1.0, ('wood',))
    return ob


def water_tower(at):
    COL, P = [], []
    legs = []
    for sx in (1, -1):
        for sz in (1, -1):
            legs.append(((sx * 2.3, 0, sz * 2.3), (sx * 1.75, 12, sz * 1.75), .14))
            COL.append([round(sx * 2.3 - .2, 2) if sx > 0 else round(sx * 2.3 - .2, 2), 0, round(sz * 2.3 - .2, 2), round(sx * 2.3 + .2, 2), 12, round(sz * 2.3 + .2, 2)])
    P.append(wcyls('lg', 'metal', 0x8f9498, legs, 6))
    P.append(wboxes('ft', 'plain', 0x9a978f, [((sx * 2.3, .2, sz * 2.3), (.7, .4, .7)) for sx in (1, -1) for sz in (1, -1)]))
    br = []
    for y in (4.0, 8.0):
        s = 2.3 - .55 * y / 12
        for (a, b) in (((-s, s), (s, s)), ((s, s), (s, -s)), ((s, -s), (-s, -s)), ((-s, -s), (-s, s))):
            br.append(((a[0], y, a[1]), (b[0], y, b[1]), .06))
    for (y0, y1) in ((0.3, 4.0), (4.0, 8.0), (8.0, 11.8)):
        s0, s1 = 2.3 - .55 * y0 / 12, 2.3 - .55 * y1 / 12
        for (ax, az, bx, bz) in ((-1, 1, 1, 1), (1, 1, 1, -1), (1, -1, -1, -1), (-1, -1, -1, 1)):
            br.append(((ax * s0, y0, az * s0), (bx * s1, y1, bz * s1), .025))
            br.append(((bx * s0, y0, bz * s0), (ax * s1, y1, az * s1), .025))
    P.append(wcyls('br', 'metal', 0x7f8488, br, 4, smooth=False))
    P.append(wlathe('tk', 'paint', 0xffffff, [(.001, 11.3), (1.6, 11.45), (2.6, 11.8), (3.0, 12.3), (3.0, 16.0), (3.1, 16.1), (2.0, 16.9), (.4, 17.5), (.001, 17.6)], (0, 0, 0), 20))
    P.append(wlathe('fn', 'metal', 0x6f7478, [(.12, 17.5), (.08, 17.8), (.001, 18.1)], (0, 0, 0), 8))
    P.append(wlathe('wk', 'metal', 0x6f7478, [(2.95, 12.2), (3.75, 12.2), (3.75, 12.3), (2.95, 12.3), (2.95, 12.2)], (0, 0, 0), 12, cap_top=False, cap_bot=False, smooth=False))
    rail = []
    for i in range(8):
        a = TAU * i / 8
        rail.append(((math.cos(a) * 3.7, 12.3, math.sin(a) * 3.7), (math.cos(a) * 3.7, 13.3, math.sin(a) * 3.7), .025))
    P.append(wcyls('rp', 'metal', 0x6f7478, rail, 4, smooth=False))
    ring = [(math.cos(TAU * i / 12) * 3.7, 13.3, math.sin(TAU * i / 12) * 3.7) for i in range(13)]
    P.append(wtube('rr', 'metal', 0x6f7478, ring, .03, 4, True, .03))
    lad = [((1.95 + sx * .2, 6.1, 2.2), (.04, 12.2, .04)) for sx in (1, -1)] + [((1.95, .6 + i * .6, 2.2), (.4, .03, .03)) for i in range(19)]
    P.append(wboxes('ld', 'metal', 0x6f7478, lad, rot=None))
    COL.append([-3.1, 11.3, -3.1, 3.1, 17.6, 3.1])
    COL.append([-3.75, 12.2, -3.75, 3.75, 12.3, 3.75])
    return asset('WATER_TOWER', P, at, 1.5, COL, floors=[dict(y=12.3, ring=[3.0, 3.75], note='walkway ring around the tank (railing at r 3.7)')],
                 notes="tank role 'paint'; ladder on the +x/+z leg side at (1.95, *, 2.2).", grime=.15)


def boat(at):
    COL, P = [], []
    secs = []
    N = 9
    for k in range(N):
        t = k / (N - 1)
        z = -2.1 + 4.2 * t
        w = .78 * (1 - max(0, (t - .55) / .45) ** 1.6) + .02 if t > .55 else .7 + .08 * math.sin(t / .55 * math.pi / 2)
        top = .5 + .18 * max(0, t - .6) ** 2 * 6
        bot = -.25 + .2 * max(0, (t - .7) / .3) ** 2
        secs.append((z, w, top, bot))
    def prof(w, top, bot, inset=0):
        ww = max(w - inset, .005)
        b = bot + inset
        return [(-ww, top), (-ww * .96, top - (top - b) * .45), (-ww * .7, b + .06), (0, b), (ww * .7, b + .06), (ww * .96, top - (top - b) * .45), (ww, top)]
    def shell(inset, flip):
        bm = bmesh.new()
        rows = [[bm.verts.new((x, y, z)) for (x, y) in prof(w, top, bot, inset)] for (z, w, top, bot) in secs]
        for k in range(N - 1):
            for i in range(6):
                f = (rows[k][i], rows[k][i + 1], rows[k + 1][i + 1], rows[k + 1][i])
                bm.faces.new(f if not flip else tuple(reversed(f)))
        return bm
    def fin(bm, name, role, col):
        # 開放曲面不要讓 recalc 亂翻：先轉座標，再直接建物件
        for v in bm.verts:
            v.co = V(*v.co)
        _l = bm.loops.layers.uv.verify(); (bm.faces.layers.int.get('kuv') or bm.faces.layers.int.new('kuv'))
        me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
        ob = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(ob)
        me.materials.append(mat(role))
        c = [srgb2lin(x) for x in hexrgb(col)] if role != 'paint' else [1, 1, 1]
        ca = me.color_attributes.new('Col', 'FLOAT_COLOR', 'POINT')
        ca.data.foreach_set('color', np.tile(np.array(c + [1], np.float32), len(me.vertices)))
        me.color_attributes.active_color = ca
        return ob
    P.append(fin(shell(0, False), 'ho', 'paint', 0xffffff))
    P.append(fin(shell(.04, True), 'hi', 'wood', 0x9c8466))
    # 船緣
    bm = bmesh.new()
    rim = []
    for (z, w, top, bot) in secs:
        o = prof(w, top, bot, 0); i_ = prof(w, top, bot, .04)
        rim.append((o[0], i_[0], o[-1], i_[-1], z))
    for sgn in (0, 1):
        vs = [[bm.verts.new((r[2 * sgn][0], r[2 * sgn][1] + .03, r[4])), bm.verts.new((r[2 * sgn + 1][0], r[2 * sgn + 1][1] + .03, r[4])),
               bm.verts.new((r[2 * sgn + 1][0], r[2 * sgn + 1][1] - .03, r[4])), bm.verts.new((r[2 * sgn][0], r[2 * sgn][1] - .03, r[4]))] for r in rim]
        for k in range(N - 1):
            for i in range(4):
                bm.faces.new((vs[k][i], vs[k][(i + 1) % 4], vs[k + 1][(i + 1) % 4], vs[k + 1][i]))
        bm.faces.new(vs[0]); bm.faces.new(list(reversed(vs[-1])))
    P.append(wfinish(bm, 'gw', 'wood', 0x6b5038, var=.06))
    P.append(wbox('tr', 'wood', 0x8a6e4e, (0, .13, -2.07), (1.38, .72, .05)))
    P.append(wboxes('th', 'wood', 0x9a7b56, [((0, .28, -.3), (1.46, .05, .3)), ((0, .3, .95), (1.3, .05, .28)), ((0, .26, -1.75), (1.38, .05, .4))]))
    P.append(wbox('mo', 'metal', 0x2b2d30, (0, .72, -2.3), (.32, .42, .42), .05))
    P.append(wbox('mc', 'metal', 0xd2d4d6, (0, .96, -2.3), (.3, .08, .4), .03))
    P.append(wcyls('ms', 'metal', 0x3a3c3e, [((0, .5, -2.38), (0, -.45, -2.38), .04)], 8))
    P.append(wbox('mp', 'metal', 0x3a3c3e, (0, -.45, -2.38), (.05, .1, .3)))
    COL = [[-.8, -.25, -2.2, .8, .6, 2.1]]
    return asset('BOAT', P, at, .8, COL, floors=[dict(y=.28, area=[-.6, -1.9, .6, 1.2], note='inside the hull (thwarts at .28–.3)')],
                 notes="ORIGIN = waterline centre; hull outside role 'paint'; bow +z; outboard motor at the stern.")


x = 0
for fn, w in ((guardrail, 6), (pole, 5), (streetlight, 5), (sign, 4), (fence, 5), (water_tower, 12)):
    fn((x, 0, 80))
    x += w
pier((-240, 0, 0))
boat((-230, 0, 0))


# ═════════ 室內陳設（穀倉、工具棚、工寮、民房）：一件一個節點，網頁用 InstancedMesh 依距離顯示；排在 z = 130 一列烘 AO ═════════
IPX = [0.0]


def iprop(name, P, COL=None, dist=.6, notes='', grime=0.0, w=4.0, wall=False):
    at = (IPX[0], 0, 130)
    IPX[0] += w + 4
    ob = asset(name, P, at, dist, COL or [], notes=notes, grime=grime, smooth=35)
    # 看不到的面拿掉（檔案小一點）：貼地的底面；掛牆的道具貼牆的背面
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    dead = []
    for f in bm.faces:
        c, n = T(f.calc_center_median()), T(f.normal)
        if (n.y < -.95 and c.y < .015) or (wall and n.z < -.95 and c.z < .012):
            dead.append(f)
    bmesh.ops.delete(bm, geom=dead, context='FACES')
    bm.to_mesh(ob.data)
    bm.free()
    return ob


def lumpy(name, role, color, c, s, amp, seed, bevel=.06, seg=1, cuts=2, var=.08, rot=None):
    """有點鼓、表面不平的方塊（草捆、麻袋、帆布）：細分後沿法線用雜訊推"""
    bm = bm_box(s, bevel, seg)
    if cuts:
        bmesh.ops.subdivide_edges(bm, edges=list(bm.edges), cuts=cuts, use_grid_fill=True)
    off = Vector((seed * 3.7, seed * 1.3, seed * 5.1))
    for v in bm.verts:
        p = Vector(v.co)
        k = noise.noise(p * 3.1 + off) * amp + noise.noise(p * 9.0 + off) * amp * .35
        n = Vector((p.x / max(s[0], 1e-3), p.y / max(s[1], 1e-3), p.z / max(s[2], 1e-3)))
        v.co = p + n.normalized() * k
    return wfinish(bm, name, role, color, c, rot, False, var, seed)


def cyl_y(name, role, color, c, r, h, seg=12, var=.04, r2=None):
    x, y, z = c
    return wcyls(name, role, color, [((x, y, z), (x, y + h, z), r, r if r2 is None else r2)], seg, var)


def strands(name, color, cx, cz, rx, rz, y0, n, seed, L=(.12, .35)):
    """散落的乾草稈：細長的平面（雙面），躺在地上"""
    rng = rng_for(seed)
    bm = bmesh.new()
    for i in range(n):
        a = rng.uniform(0, TAU)
        r = math.sqrt(rng.random())
        x, z = cx + math.cos(a) * r * rx, cz + math.sin(a) * r * rz
        l, w, t = rng.uniform(*L), rng.uniform(.006, .014), rng.uniform(0, math.pi)
        dx, dz = math.cos(t) * l / 2, math.sin(t) * l / 2
        ox, oz = -math.sin(t) * w, math.cos(t) * w
        y = y0 + rng.uniform(0, .015)
        vs = [bm.verts.new((x - dx - ox, y, z - dz - oz)), bm.verts.new((x + dx - ox, y + rng.uniform(0, .03), z + dz - oz)), bm.verts.new((x + dx + ox, y + rng.uniform(0, .03), z + dz + oz)), bm.verts.new((x - dx + ox, y, z - dz + oz))]
        bm.faces.new(list(reversed(vs)))
    return wfinish(bm, name, 'plain', color, var=.18, seed=seed, recalc=False)


HAYC, BOARD, BOARDD, STEELC = 0xcdb36a, 0x8a6a48, 0x5e4430, 0x5b6067


# ── 穀倉 ──
def hay_bale():
    P = [lumpy('hb', 'plain', HAYC, (0, .21, 0), (.52, .42, 1.0), .012, 3, .05, 1, 2, .14)]
    P.append(wboxes('tw', 'plain', 0x6b5a3c, [((0, .21, z), (.535, .435, .025)) for z in (-.25, .25)], var=.1))
    P.append(strands('st', 0xd9c27a, 0, 0, .22, .45, .425, 14, 5, (.08, .2)))
    return iprop('HAY_BALE', P, [aabb((0, .21, 0), (.52, .42, 1.0))], .6, 'small square bale 0.52 × 0.42 × 1.0; stack in the page')


def hay_loose():
    bm = bm_ell((.85, .42, .62), 14, 6)
    off = Vector((1.3, 2.2, .7))
    for v in bm.verts:
        p = Vector(v.co)
        if p.y < 0:
            p.y = 0
        k = 1 + noise.noise(p * 2.4 + off) * .22 + noise.noise(p * 7 + off) * .08
        v.co = Vector((p.x * k, p.y * k, p.z * k))
    P = [wfinish(bm, 'hl', 'plain', 0xc2a95f, smooth=True, var=.16, seed=7)]
    P.append(strands('st', 0xd4bd74, 0, 0, 1.2, .95, .005, 40, 9))
    P.append(strands('su', 0xcdb36a, 0, 0, .6, .45, .3, 16, 11, (.1, .25)))
    return iprop('HAY_LOOSE', P, None, .6, 'loose hay heap 1.7 × 0.45 × 1.25, walk-through')


def trough():
    P, COL = [], []
    L, Wd, H = 1.6, .5, .55
    P.append(wboxes('tb', 'wood', BOARD, [((0, .2, 0), (L, .05, Wd)), ((0, .38, Wd / 2 - .025), (L, .36, .05)), ((0, .38, -Wd / 2 + .025), (L, .36, .05)),
                                          ((L / 2 - .025, .38, 0), (.05, .36, Wd - .1)), ((-L / 2 + .025, .38, 0), (.05, .36, Wd - .1))], var=.08))
    P.append(wboxes('tl', 'wood', BOARDD, [((sx * (L / 2 - .1), .1, sz * (Wd / 2 - .06)), (.08, .2, .08)) for sx in (1, -1) for sz in (1, -1)], var=.06))
    P.append(wboxes('tr', 'metal', 0x4a4d50, [((0, H - .012, sz * (Wd / 2 - .02)), (L + .01, .025, .06)) for sz in (1, -1)], var=.04))
    P.append(lumpy('tf', 'plain', 0x8f7a46, (0, .3, 0), (L - .14, .12, Wd - .14), .02, 4, .03, 1, 2, .14))
    COL.append(aabb((0, H / 2, 0), (L, H, Wd)))
    return iprop('TROUGH', P, COL, .6, 'wooden feed trough on legs, long axis x')


def stall():
    """一格畜欄（沿走道寬 3 m，往後 3.2 m）：+x 側一片隔板（高 1.05，在閣樓底下第三人稱鏡頭才不會被擠到人身上）、正面（+z）右段半牆 + 左邊往內開 60° 的柵門；原點在正面中間地面"""
    P, COL = [], []
    zb, H = -3.2, 1.05
    # 隔板：直柱 + 橫木 + 木板
    P.append(wboxes('sp', 'wood', BOARDD, [((1.5, H / 2 + .05, z), (.14, H + .1, .14)) for z in (-.07, -1.6, zb + .07)] + [((-1.5, H / 2 + .05, -.07), (.14, H + .1, .14)), ((.15, H / 2 + .05, -.07), (.12, H + .1, .12))], var=.06))
    pl = [((1.5, .12 + i * .19 + .09, (zb + 0) / 2), (.05, .18, -zb - .1)) for i in range(5)]
    P.append(wboxes('sb', 'wood', BOARD, pl, var=.12))
    P.append(wboxes('sr', 'wood', BOARDD, [((1.5, H + .07, zb / 2), (.12, .07, -zb)), ((.82, H + .07, -.07), (1.4, .07, .12))], var=.06))
    # 正面右段半牆
    P.append(wboxes('fb', 'wood', BOARD, [((.82, .12 + i * .19 + .09, -.04), (1.28, .18, .05)) for i in range(5)], var=.12))
    COL.append([1.43, 0, zb, 1.57, H + .1, 0])
    COL.append([.09, 0, -.14, 1.57, H + .1, .0])
    COL.append([-1.57, 0, -.14, -1.43, H + .1, 0])
    # 柵門：鉸鏈在 x = .1（右邊的柱子），門往格子裡（-z）開 60°；先在門自己的座標（u 沿門寬、往 -x）做，再轉過去
    gw = 1.5
    bm = bm_boxes([((gw / 2, y, 0), (gw, .09, .05)) for y in (.22, .6, .95)] + [((u, .58, 0), (.09, .9, .055)) for u in (.05, gw - .05)])
    r = bmesh.ops.create_cube(bm, size=1.0)
    Rb = Matrix.Translation((gw / 2, .58, 0)) @ Matrix.Rotation(math.atan2(.73, gw - .1), 4, 'Z') @ Matrix.Diagonal((math.hypot(gw - .1, .73), .08, .045, 1))
    for v in r['verts']:
        v.co = Rb @ v.co
    P.append(wfinish(bm, 'gt', 'wood', 0x7a5a3c, (.1, 0, -.07), (0, 2.094, 0), False, .08))
    P.append(wboxes('gh', 'metal', 0x3a3c3e, [((.12, y, -.07), (.06, .12, .1)) for y in (.28, .9)], var=.04))
    # 地上的稻草
    P.append(strands('st', 0xc9b16b, 0, zb / 2, 1.3, 1.3, .002, 46, 13))
    return iprop('STALL', P, COL, .8, 'one stall bay: x in [-1.5, 1.5] along the aisle, z from 0 (front, gate) to -3.2 (back); divider on +x; gate hinged at x=.1, open 120° into the bay', w=5)


def loft():
    """穀倉右側的乾草閣樓（穀倉座標：x 1.5..4.8、z -6.8..1.0、樓板頂 2.2）＋ 往 -z 上去的直梯式樓梯（x 1.65..2.5、z 3.0 → 1.0）"""
    P, COL = [], []
    x0, x1, z0, z1, Y = 1.5, 4.8, -6.8, 1.0, 2.2
    posts = [(1.6, z) for z in (-6.6, -3.6, -.6, .9)]
    P.append(wboxes('lp', 'wood', BOARDD, [((x, (Y - .1) / 2 + .05, z), (.16, Y - .1, .16)) for (x, z) in posts], var=.06))
    for (x, z) in posts:
        COL.append(aabb((x, (Y - .1) / 2 + .05, z), (.16, Y - .1, .16)))
    P.append(wbox('lb', 'wood', BOARDD, (1.6, Y - .17, (z0 + z1) / 2), (.16, .16, z1 - z0), var=.06))
    js = []
    z = z0 + .15
    while z < z1:
        js.append(((3.2, Y - .17, z), (3.2, .14, .07)))
        z += .65
    P.append(wboxes('lj', 'wood', 0x6b4e34, js, var=.08))
    pk, n = [], 11
    for i in range(n):
        xa = x0 + (x1 - x0) * i / n
        pk.append(((xa + (x1 - x0) / n / 2, Y - .05, (z0 + z1) / 2), ((x1 - x0) / n - .012, .1, z1 - z0)))
    P.append(wboxes('lk', 'wood', 0x9a7a52, pk, var=.12))
    COL.append([x0, Y - .24, z0, x1, Y, z1])
    # 欄杆：走道邊（x = 1.55）與樓梯口旁（z = 1.0，x 2.55..4.8）
    rp = [((1.56, Y + .5, z), (.08, 1.0, .08)) for z in (-6.7, -5.1, -3.6, -2.1, -.6, .94)] + [((x, Y + .5, .96), (.08, 1.0, .08)) for x in (2.58, 3.7, 4.74)]
    rr = [((1.56, Y + y, (z0 + z1) / 2), (.07, .07, z1 - z0)) for y in (.5, .98)] + [(((2.55 + x1) / 2, Y + y, .96), (x1 - 2.55, .07, .07)) for y in (.5, .98)]
    P.append(wboxes('lr', 'wood', BOARDD, rp + rr, var=.06))
    COL.append([1.5, Y, z0, 1.62, Y + 1.0, z1])
    COL.append([2.55, Y, .92, x1, Y + 1.0, 1.0])
    # 樓梯：六階、每階高 .35；實心的踏階碰撞（樓梯底下不能鑽）
    xs0, xs1, zs0, zs1 = 1.65, 2.5, 3.0, 1.0
    k = 6
    d = (zs0 - zs1) / k
    tr = []
    for i in range(k):
        top = .1 + .35 * (i + 1)
        za, zb_ = zs0 - d * (i + 1), zs0 - d * i
        tr.append((((xs0 + xs1) / 2, top - .025, (za + zb_) / 2), (xs1 - xs0 - .1, .05, d + .02)))
        COL.append([xs0, 0, round(za, 3), xs1, round(top, 3), round(zb_, 3)])
    P.append(wboxes('st', 'wood', 0x9a7a52, tr, var=.1))
    L = math.hypot(zs0 - zs1 + .1, Y - .1)
    ang = math.atan2(Y - .1, zs0 - zs1)
    for x in (xs0 + .03, xs1 - .03):
        P.append(wbox('sg', 'wood', BOARDD, (x, (Y + .1) / 2 - .12, (zs0 + zs1) / 2), (.06, .26, L), rot=(ang, 0, 0), var=.06))
    # 扶手（走道那一側）
    P.append(wboxes('hp', 'wood', BOARDD, [((xs0 - .02, .55, zs0 - .05), (.06, .9, .06))], var=.06))
    P.append(wbox('hr', 'wood', BOARDD, (xs0 - .02, (Y + .1) / 2 + .9, (zs0 + zs1) / 2), (.06, .06, L), rot=(ang, 0, 0), var=.06))
    COL.append([xs0 - .06, .1, zs1, xs0 + .02, Y + 1.0, zs0])
    return iprop('LOFT', P, COL, 1.0, 'barn-local hay loft (place at the barn origin, ry 0): deck top 2.2 over x 1.5..4.8, z -6.8..1.0; 6-step stair x 1.65..2.5 rising toward -z from z 3.0', w=8)


def tractor():
    P, COL = [], []
    RED, DK, TY = 0xb33a2a, 0x2c2d2f, 0x1e1f21
    # 後輪（大）與前輪：胎面一圈凸紋用輪廓的鋸齒做
    def wheel(nm, x, y, z, r, w, seg):
        prof = [(r * .62, -w / 2), (r * .9, -w / 2), (r, -w * .38), (r, w * .38), (r * .9, w / 2), (r * .62, w / 2)]
        rf = lambda a, yy: 1 + (.04 if (int(round(a / TAU * seg)) % 2 == 0 and abs(yy) < w * .4) else 0)
        P.append(wlathe(nm, 'plain', TY, prof, (x, y, z), seg, rot=(0, 0, math.pi / 2), rfn=rf, smooth=False, cap_bot=False, cap_top=False))
        P.append(wlathe(nm + 'h', 'metal', 0xd8b23a, [(r * .63, -w * .42), (r * .3, -w * .3), (r * .12, -w * .5), (.001, -w * .5)], (x, y, z), 10, rot=(0, 0, math.pi / 2 * (1 if x > 0 else -1)), cap_bot=False))
    for sx in (1, -1):
        wheel('rw', sx * .72, .62, -.75, .62, .34, 14)
        wheel('fw', sx * .62, .34, 1.05, .34, .18, 10)
    P.append(wcyls('ax', 'metal', DK, [((-.62, .34, 1.05), (.62, .34, 1.05), .05), ((-.72, .62, -.75), (.72, .62, -.75), .07)], 8))
    # 車身：引擎蓋、散熱格柵、引擎、變速箱、擋泥板、座椅、方向盤、排氣管、燈
    P.append(wbox('hd', 'metal', RED, (0, .98, .55), (.62, .5, 1.25), bevel=.06, seg=1))
    P.append(wbox('gr', 'metal', 0x9aa0a4, (0, .95, 1.19), (.5, .42, .04), var=.03))
    P.append(wboxes('gl', 'metal', DK, [((0, .78 + i * .07, 1.215), (.46, .025, .02)) for i in range(6)], var=.02))
    P.append(wbox('en', 'metal', 0x3a3c3e, (0, .62, .45), (.5, .36, 1.1), var=.04))
    P.append(wbox('tb', 'metal', RED, (0, .72, -.55), (.6, .5, .9), bevel=.05, seg=1))
    for sx in (1, -1):
        P.append(wlathe('fd', 'metal', RED, [(.7, -.15), (.7, .15)], (sx * .72, .62, -.75), 14, rot=(0, 0, math.pi / 2), a0=math.radians(15), a1=math.radians(190), cap_bot=False, cap_top=False, smooth=True))
        P.append(wbox('fp', 'metal', RED, (sx * .48, .98, -.75), (.12, .04, .95), var=.03))
    P.append(wbox('se', 'plain', DK, (0, 1.08, -.9), (.46, .08, .42), bevel=.03, seg=1))
    P.append(wbox('sb', 'plain', DK, (0, 1.32, -1.12), (.46, .42, .07), bevel=.03, seg=1, rot=(-.2, 0, 0)))
    P.append(wcyls('sc', 'metal', DK, [((0, .78, -.9), (0, 1.04, -.9), .05), ((0, 1.1, -.3), (0, 1.5, -.48), .025)], 6))
    P.append(wlathe('sw', 'plain', DK, [(.19, -.015), (.2, 0), (.19, .015), (.17, 0)], (0, 1.52, -.5), 14, rot=(-.6, 0, 0), cap_bot=False, cap_top=False))
    P.append(wcyls('ex', 'metal', 0x2a2b2c, [((.18, 1.2, .9), (.18, 1.95, .9), .035)], 8))
    P.append(cyl_y('ec', 'metal', 0x2a2b2c, (.18, 1.95, .9), .045, .06, 8))
    P.append(wcyls('lt', 'metal', DK, [((sx * .22, 1.12, 1.18), (sx * .22, 1.12, 1.24), .055) for sx in (1, -1)], 10))
    P.append(wcyls('lg', 'emit', 0xfff2c8, [((sx * .22, 1.12, 1.24), (sx * .22, 1.12, 1.25), .045) for sx in (1, -1)], 10, var=0))
    P.append(wbox('hk', 'metal', DK, (0, .55, -1.12), (.3, .12, .2), var=.03))
    COL.append(aabb((0, .62, -.75), (1.8, 1.25, 1.25)))
    COL.append(aabb((0, .75, .45), (.75, 1.1, 1.65)))
    COL.append(aabb((0, .34, 1.05), (1.45, .68, .4)))
    return iprop('TRACTOR', P, COL, .8, 'small vintage tractor, front +z, 1.8 wide × 2.6 long', w=6)


def workbench():
    P, COL = [], []
    L, Dp, H = 2.0, .7, .9
    P.append(wbox('tp', 'wood', 0x9a7650, (0, H - .03, 0), (L, .06, Dp), var=.1))
    P.append(wboxes('lg', 'wood', 0x6b4a2e, [((sx * (L / 2 - .06), (H - .06) / 2, sz * (Dp / 2 - .06)), (.08, H - .06, .08)) for sx in (1, -1) for sz in (1, -1)], var=.06))
    P.append(wbox('sh', 'wood', 0x8a6a48, (0, .2, 0), (L - .1, .03, Dp - .1), var=.1))
    P.append(wbox('bk', 'wood', 0x7a5a3c, (0, H + .15, -Dp / 2 + .02), (L, .3, .03), var=.08))
    # 抽屜櫃（右）
    P.append(wbox('dr', 'wood', 0x7a5a3c, (.6, .55, .02), (.6, .5, Dp - .1), var=.06))
    P.append(wboxes('dh', 'metal', 0x9aa0a4, [((.6, .45 + i * .2, Dp / 2 - .02), (.18, .025, .03)) for i in range(2)], var=.02))
    P.append(wboxes('dl', 'wood', 0x5e4430, [((.6, .55 + i * .2 - .1, Dp / 2 - .025), (.58, .01, .01)) for i in range(3)], var=.02))
    # 虎鉗（左前角）
    VC = 0x3d5a6e
    P.append(wboxes('vs', 'metal', VC, [((-.75, H + .04, .22), (.16, .08, .22)), ((-.75, H + .12, .3), (.2, .14, .06)), ((-.75, H + .12, .17), (.2, .14, .06))], var=.04))
    P.append(wcyls('vh', 'metal', 0x9aa0a4, [((-.75, H + .1, .33), (-.75, H + .1, .5), .015), ((-.86, H + .1, .5), (-.64, H + .1, .5), .012)], 6))
    # 檯面上的東西：鎚子、鋸子、罐子、木塊
    P.append(wbox('hm', 'wood', 0x8a6440, (-.2, H + .015, .1), (.3, .025, .03), rot=(0, .4, 0)))
    P.append(wbox('hh', 'metal', 0x3a3c3e, (-.06, H + .03, .16), (.04, .05, .11), rot=(0, .4, 0)))
    P.append(wbox('sa', 'metal', 0xb8bcbe, (.15, H + .005, -.15), (.5, .006, .14), rot=(0, -.15, 0)))
    P.append(wbox('sg', 'wood', 0x7a3a2c, (.43, H + .02, -.11), (.12, .04, .1), rot=(0, -.15, 0)))
    P.append(cyl_y('cn', 'metal', 0x8a8f94, (-.45, H, -.18), .06, .14, 10))
    P.append(wboxes('wk', 'wood', 0xc49a64, [((.0, H + .03, -.22), (.35, .06, .09)), ((-.1, H + .09, -.22), (.25, .06, .09))], var=.1))
    COL.append(aabb((0, H / 2, 0), (L, H, Dp)))
    return iprop('WORKBENCH', P, COL, .6, 'wooden workbench 2.0 × 0.7 × 0.9, back against the wall at -z; top at 0.9 (loot on top is fine)')


def tool_rack():
    P = []
    W, H = 1.8, 1.0
    P.append(wbox('pb', 'wood', 0xb8986a, (0, 1.45, -.015), (W, H, .03), var=.06))
    P.append(wboxes('pf', 'wood', 0x6b4a2e, [((0, 1.45 + sy * H / 2, 0), (W + .06, .05, .05)) for sy in (1, -1)] + [((sx * W / 2, 1.45, 0), (.05, H + .05, .05)) for sx in (1, -1)], var=.06))
    # 長柄工具：草叉、鏟子、耙子（掛在板子下緣、斜靠在地上）
    def long_tool(x, head):
        P.append(wcyls('th', 'wood', 0x8a6440, [((x, .05, .12), (x + .03, 1.6, .03), .018)], 6))
        if head == 'fork':
            P.append(wboxes('tf', 'metal', 0x7d8387, [((x - .1 + i * .067, -.12 + .25, .13), (.012, .32, .012)) for i in range(4)] + [((x, .26 + .16, .13), (.22, .03, .02))], var=.03))
        elif head == 'shovel':
            P.append(wbox('ts', 'metal', 0x6f7478, (x, .18, .13), (.24, .3, .02), bevel=.02, seg=1))
        else:
            P.append(wbox('tr', 'metal', 0x6f7478, (x, .08, .14), (.36, .03, .03)))
            P.append(wboxes('tt', 'metal', 0x6f7478, [((x - .16 + i * .053, .03, .16), (.01, .07, .01)) for i in range(7)], var=.02))
    long_tool(-.75, 'fork'); long_tool(-.48, 'shovel'); long_tool(.72, 'rake')
    # 掛在板上的：鋸子、鎚子、扳手、繩子一圈、鉗子
    P.append(wbox('sw', 'metal', 0xb8bcbe, (-.05, 1.5, .01), (.55, .14, .008), rot=(0, 0, .05)))
    P.append(wbox('sg', 'wood', 0x7a3a2c, (.25, 1.53, .02), (.12, .12, .04)))
    P.append(wboxes('hm', 'wood', 0x8a6440, [((.45, 1.35, .02), (.035, .32, .03)), ((.6, 1.38, .02), (.035, .28, .03))], var=.06))
    P.append(wboxes('hh', 'metal', 0x3a3c3e, [((.45, 1.53, .03), (.14, .05, .05)), ((.6, 1.54, .03), (.12, .05, .05))], var=.03))
    P.append(wboxes('wr', 'metal', 0x9aa0a4, [((-.42 + i * .07, 1.72, .01), (.025, .2 - i * .02, .012)) for i in range(4)], var=.03))
    P.append(wlathe('ro', 'plain', 0xb59a6a, [(.14, -.03), (.16, 0), (.14, .03), (.12, 0)], (.15, 1.2, .05), 14, rot=(math.pi / 2, 0, 0), cap_bot=False, cap_top=False))
    P.append(wboxes('pg', 'metal', 0x2a2b2d, [((x, 1.6, .02), (.015, .015, .05)) for x in (-.6, -.3, 0, .3, .6)], var=0))
    return iprop('TOOL_RACK', P, None, .6, 'wall tool board 1.8 wide (board face at z=0, against wall), long tools leaning to the floor in front (z ≤ .16)', wall=True)


def barrel():
    prof = [(.25, 0), (.29, .2), (.31, .45), (.29, .7), (.25, .9)]
    P = [wlathe('bb', 'wood', 0x8a6440, prof, (0, 0, 0), 14, smooth=True, var=.08)]
    P.append(wlathe('bt', 'wood', 0x7a5a3c, [(.24, .885), (.001, .885)], (0, 0, 0), 14, cap_bot=False))
    for y in (.1, .32, .58, .8):
        r = .25 + (.31 - .25) * math.sin(y / .9 * math.pi) * 1.0 + .006
        P.append(wlathe('bh', 'metal', 0x3a3c3e, [(r, y - .025), (r + .006, y), (r, y + .025)], (0, 0, 0), 14, cap_bot=False, cap_top=False, smooth=True))
    return iprop('BARREL', P, [aabb((0, .45, 0), (.6, .9, .6))], .6, 'wooden barrel r .31 h .9')


def sacks():
    P = [wbox('pl', 'wood', 0x9a7a52, (0, .06, 0), (1.1, .12, .8), var=.1)]
    rng = rng_for(21)
    sk = []
    for i, (x, y, z, ry) in enumerate(((-.27, .22, -.05, .05), (.27, .22, .02, -.08), (0, .42, 0, 1.52))):
        L = .88 if ry > 1 else .75
        P.append(lumpy('sk', 'plain', 0xb59a6a if i != 1 else 0xc8b48a, (x, y, z), (.5, .2, L), .03, 30 + i, .08, 1, 1, .1, rot=(0, ry, 0)))
    P.append(lumpy('sk', 'plain', 0xd8d0b8, (.3, .17, .3), (.42, .18, .35), .02, 40, .07, 1, 1, .08, rot=(0, .9, 0)))
    return iprop('SACKS', P, [aabb((0, .3, 0), (1.1, .6, .85))], .6, 'feed sacks on a pallet 1.1 × 0.6 × 0.8')


def lantern():
    P = [wlathe('lc', 'metal', 0x2f3a36, [(.09, 0), (.1, .03), (.06, .06), (.03, .1), (.001, .12)], (0, -.12, 0), 10, cap_bot=False)]
    P.append(wlathe('lg', 'emit', 0xffe6b0, [(.045, -.2), (.07, -.15), (.07, -.07), (.05, -.02)], (0, -.12, 0), 10, var=0))
    P.append(wlathe('lb', 'metal', 0x2f3a36, [(.08, -.27), (.09, -.24), (.07, -.2), (.001, -.2)], (0, -.12, 0), 10, cap_bot=False))
    P.append(wcyls('lw', 'metal', 0x2a2b2d, [((sx * .065, -.33, 0), (sx * .065, -.13, 0), .006) for sx in (1, -1)] + [((0, -.12, 0), (0, 0, 0), .006)], 4))
    return iprop('LANTERN', P, None, .3, 'hanging kerosene lantern, origin at the hook (hangs .4 below)')


def ladder():
    P = []
    L, Wd, a = 3.1, .46, .28
    ca, sa = math.cos(a), math.sin(a)
    def at(u, x, d=0):
        return (x, u * ca, -u * sa + d)
    for sx in (1, -1):
        P.append(wbox('lr', 'wood', 0x9a7a52, at(L / 2, sx * Wd / 2), (.05, L, .07), rot=(-a, 0, 0), var=.08))
    P.append(wboxes('rg', 'wood', 0x8a6a48, [(at(.25 + i * .3, 0), (Wd, .035, .035)) for i in range(10)], var=.08))
    return iprop('LADDER', P, None, .6, 'wooden ladder leaning back (top toward -z by 0.85 m), feet at z=0')


# ── 工具棚 ──
def shelf():
    P, COL = [], []
    W, Dp, H = 1.2, .45, 1.9
    P.append(wboxes('up', 'metal', STEELC, [((sx * (W / 2 - .02), H / 2, sz * (Dp / 2 - .02)), (.035, H, .035)) for sx in (1, -1) for sz in (1, -1)], var=.04))
    ys = (.1, .62, 1.14, 1.66)
    P.append(wboxes('sv', 'metal', 0x6f7478, [((0, y, 0), (W, .025, Dp)) for y in ys] + [((0, y - .03, sz * (Dp / 2 - .01)), (W, .05, .015)) for y in ys for sz in (1, -1)], var=.05))
    rng = rng_for(61)
    bx, cans, pc = [], [], []
    for y in ys:
        x = -W / 2 + .06
        while x < W / 2 - .12:
            r = rng.random()
            if r < .45:
                w, h, d = rng.uniform(.22, .36), rng.uniform(.14, .3), rng.uniform(.26, .38)
                if x + w > W / 2 - .04: break
                bx.append(((x + w / 2, y + .0125 + h / 2, rng.uniform(-.03, .03)), (w, h, d)))
                x += w + .03
            elif r < .8:
                n = rng.randint(1, 3)
                for k in range(n):
                    if x + .17 > W / 2 - .04: break
                    c = rng.choice((0xc03a2b, 0xe8ad18, 0x3d6a8e, 0xe9e6df, 0x4d7a48, 0x2f2f2f))
                    pc.append((x + .085, y + .0125, rng.uniform(-.1, .1), c))
                    x += .18
            else:
                x += rng.uniform(.08, .18)
    P.append(wboxes('cb', 'wood', 0xc49a64, bx, var=.16))
    P.append(wboxes('ct', 'plain', 0x8f6f45, [((b[0][0], b[0][1] + b[1][1] / 2 + .004, b[0][2]), (.06, .01, b[1][2] * 1.01)) for b in bx], var=.05))
    for (x, y, z, c) in pc:
        P.append(cyl_y('pc', 'metal', c, (x, y, z), .075, .18, 7, .05))
    COL.append(aabb((0, H / 2, 0), (W, H, Dp)))
    return iprop('SHELF', P, COL, .6, 'steel shelving 1.2 × 0.45 × 1.9 with cartons and paint cans; long axis x')


def toolbox_kit():
    """放在工作台面上的一組（原點在檯面）：紅色工具箱、虎鉗、扳手、手電筒、咖啡罐裝螺絲"""
    P = []
    P.append(wbox('tb', 'metal', 0xb8342a, (-.35, .1, 0), (.5, .2, .24), bevel=.015, seg=1))
    P.append(wbox('tl', 'metal', 0x9a2a22, (-.35, .21, 0), (.5, .03, .24), var=.03))
    P.append(wcyls('tg', 'metal', 0x2a2b2d, [((-.5, .26, 0), (-.2, .26, 0), .012)], 6))
    P.append(wboxes('tp', 'metal', 0x2a2b2d, [((x, .235, 0), (.02, .05, .02)) for x in (-.5, -.2)], var=0))
    VC = 0x3d5a6e
    P.append(wboxes('vs', 'metal', VC, [((.45, .04, -.02), (.16, .08, .22)), ((.45, .13, .08), (.2, .14, .06)), ((.45, .13, -.06), (.2, .14, .06))], var=.04))
    P.append(wcyls('vh', 'metal', 0x9aa0a4, [((.45, .11, .11), (.45, .11, .26), .014), ((.36, .11, .26), (.54, .11, .26), .011)], 6))
    P.append(wbox('wr', 'metal', 0x9aa0a4, (0, .008, .12), (.28, .012, .035), rot=(0, .3, 0)))
    P.append(wcyls('fl', 'metal', 0xe8ad18, [((.05, .03, -.08), (.25, .03, -.04), .028)], 8))
    P.append(cyl_y('cc', 'metal', 0x8a8f94, (.2, 0, .1), .055, .13, 10))
    return iprop('TOOLBOX', P, None, .4, 'bench-top kit, origin on the bench top; spans x -.6..+.6')


def generator():
    P, COL = [], []
    FR = 0x2a2b2d
    W, Dp, H = .7, .5, .55
    fr = []
    for sz in (1, -1):
        z = sz * Dp / 2
        pts = [(-W / 2, .04, z), (-W / 2, H - .05, z), (-W / 2 + .05, H, z), (W / 2 - .05, H, z), (W / 2, H - .05, z), (W / 2, .04, z)]
        P.append(wtube('ft', 'metal', FR, pts, .018, 6, True, .03))
    P.append(wcyls('fx', 'metal', FR, [((x, .04, -Dp / 2), (x, .04, Dp / 2), .018) for x in (-W / 2, W / 2)] + [((0, H, -Dp / 2), (0, H, Dp / 2), .016)], 6))
    P.append(wbox('tk', 'metal', 0xe8ad18, (.06, H - .12, 0), (.48, .16, .38), bevel=.04, seg=1))
    P.append(cyl_y('tc', 'metal', 0x2a2b2d, (.2, H - .05, .05), .035, .04, 8))
    P.append(wbox('en', 'metal', 0x3a3c3e, (-.08, .22, 0), (.36, .3, .32), bevel=.02, seg=1))
    P.append(wlathe('mf', 'metal', 0x6f7478, [(.06, -.07), (.07, -.06), (.07, .06), (.06, .07)], (.2, .2, .1), 10, rot=(0, 0, math.pi / 2)))
    P.append(wbox('pn', 'metal', 0xd8b23a, (.24, .25, -.14), (.18, .18, .02), var=.03))
    P.append(wboxes('so', 'plain', 0x1c1c1c, [((.2 + i * .07, .25, -.152), (.035, .05, .01)) for i in range(-1, 1)], var=0))
    P.append(wcyls('pu', 'plain', 0x1c1c1c, [((-.24, .32, -.17), (-.24, .32, -.24), .02)], 6))
    COL.append(aabb((0, H / 2, 0), (W + .04, H, Dp + .04)))
    return iprop('GENERATOR', P, COL, .4, 'portable generator in a tube frame .7 × .55 × .5')


def gas_can():
    P = [wbox('gc', 'metal', 0xb8342a, (0, .22, 0), (.17, .44, .34), bevel=.025, seg=1)]
    P.append(wboxes('gx', 'metal', 0x9a2a22, [((sx * .086, .22, 0), (.006, .3, .24)) for sx in (1, -1)], var=.02))
    P.append(wboxes('gh', 'metal', 0x9a2a22, [((0, .46, z), (.03, .04, .04)) for z in (-.1, 0, .1)] + [((0, .5, 0), (.05, .03, .26))], var=.02))
    P.append(wcyls('gs', 'metal', 0x2a2b2d, [((0, .42, .13), (0, .52, .2), .025)], 6))
    return iprop('GAS_CAN', P, None, .3, 'red jerry can .17 × .5 × .34 (no collision; step over)')


def wheelbarrow():
    P, COL = [], []
    T0, T1 = 0x3d6b4a, 0x2f5a3c
    secs = []
    for (z, w, h, y) in ((-.35, .48, .02, .42), (-.33, .52, .3, .42), (.15, .62, .32, .4), (.45, .5, .28, .38), (.5, .3, .03, .5)):
        secs.append([(-w / 2, y, z), (w / 2, y, z), (w / 2 * 1.15, y + h, z + .04), (-w / 2 * 1.15, y + h, z + .04)])
    bm = bm_loft([[(p[0], p[1], p[2]) for p in s] for s in secs], True)
    P.append(wfinish(bm, 'tr', 'metal', T0, smooth=False, var=.05))
    P.append(wcyls('hn', 'wood', 0x8a6440, [((sx * .3, .55, -1.05), (sx * .2, .3, .62), .022) for sx in (1, -1)], 6))
    P.append(wcyls('lg', 'metal', 0x2a2b2d, [((sx * .22, .42, -.3), (sx * .26, 0, -.38), .016) for sx in (1, -1)], 6))
    P.append(wlathe('wh', 'plain', 0x1e1f21, [(.1, -.05), (.17, -.05), (.19, -.02), (.19, .02), (.17, .05), (.1, .05)], (0, .19, .7), 12, rot=(0, 0, math.pi / 2), cap_bot=False, cap_top=False))
    P.append(wcyls('wa', 'metal', 0xb8bcbe, [((-.07, .19, .7), (.07, .19, .7), .1), ((-.2, .19, .7), (.2, .19, .7), .015)], 8))
    P.append(wcyls('ws', 'metal', 0x2a2b2d, [((sx * .06, .19, .7), (sx * .2, .42, .45), .015) for sx in (1, -1)], 6))
    COL.append(aabb((0, .45, 0), (.7, .9, 1.0)))
    return iprop('WHEELBARROW', P, COL, .5, 'wheelbarrow, wheel at +z, handles at -z (≈1.9 long)')


def tarp():
    bm = bm_box((1.3, .75, .95), .12, 1)
    bmesh.ops.subdivide_edges(bm, edges=list(bm.edges), cuts=2, use_grid_fill=True)
    off = Vector((5.1, 1.7, 2.3))
    for v in bm.verts:
        p = Vector(v.co)
        y = p.y + .375
        k = noise.noise(p * 2.6 + off) * .06
        drop = max(0, (.75 - y)) * .1
        v.co = Vector((p.x * (1 + drop) + k, max(-.375, p.y + k * .6 - (.08 if abs(p.x) > .5 and abs(p.z) > .3 else 0)), p.z * (1 + drop) + k))
    P = [wfinish(bm, 'tp', 'plain', 0x3f7fb0, (0, .375, 0), None, False, .1, 3)]
    P.append(wlathe('ty', 'plain', 0x1f2022, [(.14, -.06), (.25, -.06), (.27, 0), (.25, .06), (.14, .06)], (.4, .8, .1), 12, cap_bot=False, cap_top=False))
    return iprop('TARP', P, [aabb((0, .4, 0), (1.35, .8, 1.0))], .6, 'blue tarp over a pile, a tyre on top; 1.35 × 0.85 × 1.0')


# ── 工寮 ──
def bunk():
    P, COL = [], []
    W, L, H = .95, 2.0, 1.75
    FR = 0x4f5a66
    P.append(wboxes('fp', 'metal', FR, [((sx * (W / 2 - .025), H / 2, sz * (L / 2 - .025)), (.05, H, .05)) for sx in (1, -1) for sz in (1, -1)], var=.04))
    rails = []
    for y in (.32, 1.22):
        rails += [((sx * (W / 2 - .025), y, 0), (.04, .06, L)) for sx in (1, -1)] + [((0, y, sz * (L / 2 - .025)), (W, .06, .04)) for sz in (1, -1)]
    rails += [((0, y, sz * (L / 2 - .025)), (W, .04, .03)) for sz in (1, -1) for y in (.6, 1.55, H - .03)]
    P.append(wboxes('fr', 'metal', FR, rails, var=.04))
    P.append(wboxes('lr', 'metal', FR, [((W / 2 - .025, .32 + k * .3, L / 2 - .03), (.06, .03, .06)) for k in range(1, 4)], var=.04))
    P.append(wboxes('gr', 'metal', FR, [((-W / 2 + .025, 1.42, z), (.035, .03, 1.2)) for z in (-.15,)], var=.04))
    for y in (.35, 1.25):
        P.append(wbox('mt', 'plain', 0xd8d2c0, (0, y + .07, 0), (W - .08, .13, L - .08), var=.05))
        P.append(lumpy('bl', 'paint', 0xffffff, (0, y + .15, .2), (W - .04, .06, 1.35), .012, 5 + int(y * 10), .025, 1, 1, .04))
        P.append(lumpy('pw', 'plain', 0xf1efe8, (0, y + .2, -.72), (.6, .1, .32), .015, 9 + int(y * 10), .04, 1, 0, .04))
    COL.append(aabb((0, H / 2, 0), (W, H, L)))
    return iprop('BUNK', P, COL, .6, 'steel bunk bed .95 × 1.75 × 2.0 (long axis z, pillows at -z); blankets are role paint (instance colour)')


def locker():
    P, COL = [], []
    W, Dp, H = .9, .5, 1.85
    P.append(wbox('lb', 'paint', 0xffffff, (0, H / 2, 0), (W, H, Dp), var=.03))
    P.append(wboxes('ld', 'plain', 0x2a2b2d, [((0, H / 2, Dp / 2 + .002), (.008, H - .1, .004))] + [((0, .05, Dp / 2 + .002), (W, .006, .004))], var=0))
    for sx in (1, -1):
        P.append(wboxes('lv', 'plain', 0x3a3c3e, [((sx * W / 4, 1.55 + k * .05, Dp / 2 + .003), (.22, .018, .004)) for k in range(4)] + [((sx * W / 4, .25 + k * .05, Dp / 2 + .003), (.22, .018, .004)) for k in range(3)], var=0))
        P.append(wbox('lh', 'metal', 0xb8bcbe, (sx * .05, 1.0, Dp / 2 + .015), (.025, .14, .025)))
        P.append(wbox('ln', 'plain', 0xf2efe8, (sx * W / 4, 1.32, Dp / 2 + .003), (.12, .05, .004), var=0))
    P.append(wbox('lt', 'paint', 0xffffff, (0, H + .01, 0), (W + .02, .02, Dp + .02), var=.03))
    COL.append(aabb((0, H / 2, 0), (W, H, Dp)))
    return iprop('LOCKER', P, COL, .5, 'double steel locker .9 × 1.85 × .5, doors at +z; body role paint (instance colour)')


def ftable():
    P, COL = [], []
    L, Dp, H = 1.8, .75, .74
    P.append(wbox('tt', 'plain', 0xe8e6df, (0, H - .02, 0), (L, .04, Dp), bevel=.015, seg=1, var=.02))
    P.append(wbox('te', 'plain', 0x8a8f94, (0, H - .055, 0), (L - .06, .03, Dp - .06), var=.02))
    P.append(wcyls('tl', 'metal', 0x6f7478, [((sx * (L / 2 - .15), H - .07, sz * (Dp / 2 - .08)), (sx * (L / 2 - .15), 0, sz * (Dp / 2 - .05)), .015) for sx in (1, -1) for sz in (1, -1)], 6))
    P.append(wcyls('tb', 'metal', 0x6f7478, [((sx * (L / 2 - .15), .08, -Dp / 2 + .05), (sx * (L / 2 - .15), .08, Dp / 2 - .05), .012) for sx in (1, -1)], 6))
    COL.append(aabb((0, H / 2, 0), (L, H, Dp)))
    return iprop('FTABLE', P, COL, .5, 'folding table 1.8 × 0.75, top 0.74')


def fchair():
    P = []
    S = .44
    P.append(wbox('cs', 'plain', 0x3d5a6e, (0, .45, .02), (S, .03, S * .95), bevel=.01, seg=1))
    P.append(wbox('cb', 'plain', 0x3d5a6e, (0, .74, -.21), (S, .2, .025), bevel=.008, seg=1, rot=(-.1, 0, 0)))
    P.append(wcyls('cf', 'metal', 0x9aa0a4, [((sx * .2, 0, .22), (sx * .2, .44, -.12), .011) for sx in (1, -1)] + [((sx * .2, 0, -.2), (sx * .2, .85, -.24), .011) for sx in (1, -1)] + [((-.2, .2, .1), (.2, .2, .1), .008)], 6))
    return iprop('FCHAIR', P, None, .4, 'folding chair, seat .45, facing +z (no collision)')


def kitchen():
    P, COL = [], []
    L, Dp, H = 1.4, .6, .9
    P.append(wbox('kc', 'plain', 0xd9d5cb, (0, (H - .04) / 2, 0), (L, H - .04, Dp), var=.03))
    P.append(wbox('kt', 'plain', 0x5d5a55, (0, H - .02, 0), (L + .04, .04, Dp + .03), var=.03))
    P.append(wboxes('kd', 'plain', 0x9a958a, [((x, .45, Dp / 2 + .002), (.006, .78, .004)) for x in (-.23, .23)], var=0))
    P.append(wboxes('kh', 'metal', 0x9aa0a4, [((x, .7, Dp / 2 + .015), (.12, .02, .02)) for x in (-.4, 0, .4)], var=0))
    P.append(wbox('sk', 'metal', 0xb8bcbe, (.4, H - .03, .02), (.42, .02, .36)))
    P.append(wbox('si', 'metal', 0x8a8f94, (.4, H - .02, .02), (.36, .012, .3)))
    P.append(wcyls('ft', 'metal', 0xb8bcbe, [((.4, H, -.2), (.4, H + .25, -.2), .012), ((.4, H + .25, -.2), (.4, H + .23, -.05), .012)], 6))
    # 微波爐
    P.append(wbox('mw', 'plain', 0xeeece6, (-.35, H + .14, -.05), (.48, .28, .36), bevel=.012, seg=1, var=.02))
    P.append(wbox('mg', 'plain', 0x1c1d1f, (-.4, H + .14, .132), (.32, .2, .004), var=0))
    P.append(wbox('mp', 'plain', 0x6f7478, (-.17, H + .14, .132), (.08, .22, .004), var=0))
    # 電熱水壺、杯子
    P.append(wlathe('kt2', 'metal', 0xc8ccce, [(.075, 0), (.085, .05), (.08, .18), (.06, .22), (.001, .22)], (.05, H, -.12), 12, cap_bot=False))
    P.append(wbox('kh2', 'plain', 0x2a2b2d, (.05, H + .14, -.21), (.03, .12, .04)))
    for i, c in enumerate((0xc03a2b, 0xe8e6df, 0x3d6a8e)):
        P.append(cyl_y('mg', 'plain', c, (.0 + i * .1, H, .15), .035, .09, 8))
    COL.append(aabb((0, H / 2, 0), (L, H, Dp)))
    return iprop('KITCHEN', P, COL, .5, 'kitchenette counter 1.4 × 0.6 × 0.9 with sink, microwave and kettle; back at -z')


def hooks():
    """牆上的掛鉤橫板：三頂安全帽、兩件反光背心（原點在地面、靠牆 z = 0）"""
    P = []
    P.append(wbox('hb', 'wood', 0x7a5a3c, (0, 1.75, .015), (1.6, .1, .03), var=.06))
    P.append(wboxes('hk', 'metal', 0x2a2b2d, [((x, 1.72, .06), (.02, .02, .08)) for x in (-.65, -.35, -.05, .3, .62)], var=0))
    for i, (x, c) in enumerate(((-.65, 0xf1efe8), (-.35, 0xe8ad18), (.62, 0xe8671d))):
        P.append(wlathe('hh', 'plain', c, [(.001, .14), (.07, .13), (.11, .08), (.125, .02), (.13, 0)], (x, 1.5, .13), 10, smooth=True, var=.03))
        P.append(wlathe('hr', 'plain', c, [(.13, 0), (.17, -.005), (.17, -.015), (.12, -.01)], (x, 1.5, .13), 10, smooth=True, cap_bot=False, cap_top=False, var=.03, sx=1, sz=1.15))
    for (x, c) in ((-.05, 0xd8e33a), (.3, 0xe8671d)):
        secs = []
        for (y, w) in ((1.68, .16), (1.62, .32), (1.4, .44), (1.1, .46), (.95, .44)):
            secs.append([(x - w / 2, y, .07), (x + w / 2, y, .07), (x + w / 2, y, .1), (x - w / 2, y, .1)])
        P.append(wfinish(bm_loft(secs, True), 'vs', 'plain', c, smooth=False, var=.05))
        P.append(wboxes('vr', 'plain', 0xd9dde0, [((x, y, .102), (.44, .04, .006)) for y in (1.05, 1.2)], var=0))
    return iprop('HOOKS', P, None, .5, 'wall hook rail at 1.75 m with hard hats and hi-vis vests (wall at z=0, items stick out to z .25)', wall=True)


def notice():
    P = [wbox('nb', 'wood', 0x6b4a2e, (0, 1.5, .02), (1.2, .85, .04), var=.06), wbox('nc', 'plain', 0xb08a5a, (0, 1.5, .042), (1.12, .77, .006), var=.08)]
    rng = rng_for(77)
    pp, pins = [], []
    for i in range(7):
        w, h = rng.uniform(.16, .26), rng.uniform(.2, .3)
        x, y = rng.uniform(-.42, .42), rng.uniform(1.25, 1.75)
        pp.append(((x, y, .048 + i * .001), (w, h, .002)))
        pins.append(((x, y + h / 2 - .03, .052 + i * .001), (.015, .015, .006)))
    P.append(wboxes('np', 'plain', 0xf2efe6, pp, var=.04))
    P.append(wbox('nw', 'plain', 0xe8ad18, (.3, 1.82, .051), (.3, .1, .002), var=0))
    P.append(wboxes('nt', 'plain', 0xc03a2b, pins, var=0))
    return iprop('NOTICE', P, None, .4, 'cork notice board 1.2 × 0.85 at 1.5 m (wall at z=0)', wall=True)


def fan():
    P = [wlathe('fb', 'plain', 0x2a2b2d, [(.2, 0), (.2, .03), (.06, .05), (.001, .05)], (0, 0, 0), 12, cap_bot=True)]
    P.append(wcyls('fp', 'metal', 0xb8bcbe, [((0, .05, 0), (0, 1.15, 0), .018)], 6))
    P.append(wlathe('fm', 'plain', 0xeeece6, [(.001, -.12), (.06, -.1), (.07, 0), (.05, .06), (.001, .07)], (0, 1.22, -.02), 10, rot=(math.pi / 2, 0, 0)))
    # 葉片與護網
    for k in range(3):
        a = k * TAU / 3
        P.append(wbox('bl', 'plain', 0x8fb4c8, (math.cos(a) * .12, 1.22 + math.sin(a) * .12, .08), (.2, .09, .006), rot=(0, .3, a), var=.03))
    for (r, z) in ((.25, .1), (.17, .13), (.25, .02)):
        P.append(wlathe('fg', 'metal', 0xd8dcde, [(r - .006, -.004), (r, 0), (r - .006, .004)], (0, 1.22, z), 18, rot=(math.pi / 2, 0, 0), cap_bot=False, cap_top=False))
    P.append(wcyls('fs', 'metal', 0xd8dcde, [((math.cos(k * TAU / 8) * .25, 1.22 + math.sin(k * TAU / 8) * .25, .02), (math.cos(k * TAU / 8) * .05, 1.22 + math.sin(k * TAU / 8) * .05, .14), .003) for k in range(8)], 3))
    return iprop('FAN', P, None, .4, 'pedestal fan 1.45 tall, blowing +z (no collision)')


def water():
    P, COL = [], []
    P.append(wbox('wd', 'plain', 0xeeece6, (0, .5, 0), (.32, 1.0, .32), bevel=.02, seg=1, var=.02))
    P.append(wbox('wp', 'plain', 0x3a3c3e, (0, .78, .14), (.24, .2, .06), var=.02))
    P.append(wboxes('wt', 'plain', 0x2a2b2d, [((sx * .05, .82, .18), (.03, .05, .04)) for sx in (1, -1)], var=0))
    P.append(wboxes('wn', 'plain', 0xc03a2b, [((-.05, .86, .182), (.02, .01, .01))] + [((.05, .86, .182), (.02, .01, .01))], var=0))
    P.append(wlathe('wb', 'glass', 0x6fa8d6, [(.001, 1.0), (.04, 1.0), (.04, 1.04), (.13, 1.1), (.135, 1.38), (.12, 1.42), (.001, 1.43)], (0, 0, 0), 12, cap_bot=False, var=0))
    COL.append(aabb((0, .7, 0), (.34, 1.4, .34)))
    return iprop('WATER', P, COL, .4, 'water dispenser with 19 L bottle, front +z')


def clothes():
    P, COL = [], []
    S = 3.4
    for sx in (1, -1):
        x = sx * S / 2
        P.append(wcyls('cp', 'metal', 0x6f7478, [((x, 0, 0), (x, 1.95, 0), .03), ((x, 1.9, -.35), (x, 1.9, .35), .02)], 6))
        COL.append(aabb((x, .98, 0), (.08, 1.95, .1)))
    P.append(wcyls('cl', 'plain', 0xe8e6df, [((-S / 2, 1.88, z), (S / 2, 1.88, z), .004) for z in (-.3, .3)], 3, var=0))
    rng = rng_for(91)
    items = [(-1.2, -.3, 'shirt', 0x3d6a8e), (-.55, -.3, 'towel', 0xe8e6df), (.15, -.3, 'vest', 0xd8e33a), (.85, -.3, 'pants', 0x3a4a5c),
             (-.9, .3, 'towel', 0xc03a2b), (-.2, .3, 'shirt', 0xe8671d), (.6, .3, 'shirt', 0x8a8f94), (1.2, .3, 'towel', 0x4d7a48)]
    for (x, z, kind, c) in items:
        sway = rng.uniform(-.04, .04)
        if kind == 'shirt':
            secs = [[(x - w / 2, y, z - .01 + sway * (1.88 - y)), (x + w / 2, y, z - .01 + sway * (1.88 - y)), (x + w / 2, y, z + .01 + sway * (1.88 - y)), (x - w / 2, y, z + .01 + sway * (1.88 - y))] for (y, w) in ((1.88, .5), (1.78, .56), (1.6, .42), (1.25, .4))]
        elif kind == 'vest':
            secs = [[(x - w / 2, y, z - .01), (x + w / 2, y, z - .01), (x + w / 2, y, z + .01), (x - w / 2, y, z + .01)] for (y, w) in ((1.88, .36), (1.6, .44), (1.3, .44))]
        elif kind == 'pants':
            secs = [[(x - w / 2, y, z - .01), (x + w / 2, y, z - .01), (x + w / 2, y, z + .01), (x - w / 2, y, z + .01)] for (y, w) in ((1.88, .38), (1.5, .4), (1.0, .44))]
        else:
            secs = [[(x - w / 2, y, z - .008 + sway * (1.88 - y)), (x + w / 2, y, z - .008 + sway * (1.88 - y)), (x + w / 2, y, z + .008 + sway * (1.88 - y)), (x - w / 2, y, z + .008 + sway * (1.88 - y))] for (y, w) in ((1.88, .38), (1.6, .38), (1.32, .37))]
        P.append(wfinish(bm_loft(secs, True), 'ct', 'plain', c, smooth=False, var=.06, seed=int(x * 10)))
        if kind == 'vest':
            P.append(wboxes('cr', 'plain', 0xd9dde0, [((x, y, z), (.44, .035, .024)) for y in (1.4, 1.5)], var=0))
        P.append(wboxes('cg', 'plain', 0xd8b640, [((x + sx * .15, 1.89, z), (.02, .05, .025)) for sx in (1, -1)], var=0))
    return iprop('CLOTHES', P, COL, .6, 'outdoor clothesline: two T-posts 3.4 m apart along x, two lines at z ±.3 with laundry', w=5)


def picnic():
    P, COL = [], []
    L = 1.8
    P.append(wboxes('pt', 'wood', 0xa3825c, [((0, .74, z), (L, .045, .13)) for z in (-.29, -.145, 0, .145, .29)], var=.1))
    P.append(wboxes('pb', 'wood', 0x9a7a52, [((0, .44, sz * (.62 + dz)), (L, .045, .13)) for sz in (1, -1) for dz in (-.07, .07)], var=.1))
    legs = []
    for sx in (1, -1):
        x = sx * (L / 2 - .25)
        for sz in (1, -1):
            legs.append(((x, 0, sz * .62), (x, .74, sz * .06)))
        P.append(wbox('pc', 'wood', 0x7a5a3c, (x, .42, 0), (.06, .06, 1.62), var=.06))
        P.append(wbox('pu', 'wood', 0x7a5a3c, (x, .7, 0), (.06, .06, .72), var=.06))
    P.append(wcyls('pl', 'wood', 0x7a5a3c, [(a, b, .035) for (a, b) in legs], 4, var=.06))
    COL.append(aabb((0, .38, 0), (L, .76, .74)))
    COL.append(aabb((0, .23, 0), (L, .46, 1.5)))
    return iprop('PICNIC', P, COL, .6, 'picnic table with attached benches 1.8 × 1.5, top at 0.76')


# ── 民房 ──
def fridge():
    P = [wbox('fb', 'plain', 0xeeece6, (0, .88, 0), (.68, 1.76, .66), bevel=.03, seg=1, var=.02)]
    P.append(wbox('fs', 'plain', 0x9a958a, (0, 1.2, .332), (.66, .008, .004), var=0))
    P.append(wboxes('fh', 'metal', 0xb8bcbe, [((-.27, 1.45, .35), (.025, .3, .03)), ((-.27, .9, .35), (.025, .35, .03))], var=0))
    P.append(wboxes('fm', 'plain', 0xe8ad18, [((.1, 1.55, .333), (.06, .06, .006)), ((-.05, 1.4, .333), (.1, .14, .004))], var=.02))
    return iprop('FRIDGE', P, [aabb((0, .88, 0), (.68, 1.76, .66))], .5, 'fridge .68 × 1.76 × .66, door at +z')


def bookshelf():
    P, COL = [], []
    W, Dp, H = 1.0, .34, 1.9
    WC = 0x7b5a3a
    P.append(wboxes('bs', 'wood', WC, [((sx * (W / 2 - .015), H / 2, 0), (.03, H, Dp)) for sx in (1, -1)] + [((0, y, 0), (W - .06, .025, Dp)) for y in (.06, .5, .92, 1.34, H - .015)] + [((0, H / 2, -Dp / 2 + .006), (W, H, .012))], var=.06))
    rng = rng_for(33)
    bk = []
    for y in (.0725, .5125, .9325, 1.3525):
        x = -W / 2 + .05
        while x < W / 2 - .06:
            if rng.random() < .12:
                x += rng.uniform(.05, .12)
                continue
            t, h = rng.uniform(.025, .05), rng.uniform(.2, .33)
            if x + t > W / 2 - .04:
                break
            bk.append(((x + t / 2, y + h / 2, rng.uniform(-.02, .02)), (t, h, rng.uniform(.18, .24)), rng.choice((0x8a2c22, 0x2f4a6e, 0x3d6a3a, 0xc8a24a, 0x6b4a6e, 0xe0d8c4, 0x2a2b2d))))
            x += t + .004
    for c in sorted(set(b[2] for b in bk)):
        bm = bmesh.new()
        for ((x, y, z), (t, h, d), cc) in bk:
            if cc != c:
                continue
            x0, x1, y0, y1, z1 = x - t / 2, x + t / 2, y - h / 2, y + h / 2, z + d / 2
            q = [bm.verts.new(p) for p in ((x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1), (x0, y1, z1 - d), (x1, y1, z1 - d))]
            bm.faces.new((q[0], q[1], q[2], q[3]))
            bm.faces.new((q[3], q[2], q[5], q[4]))
        P.append(wfinish(bm, 'bk', 'plain', c, var=.08, recalc=False))
    COL.append(aabb((0, H / 2, 0), (W, H, Dp)))
    return iprop('BOOKSHELF', P, COL, .5, 'wooden bookshelf 1.0 × 1.9 × .34 full of books, front +z')


def tv_unit():
    P, COL = [], []
    L, Dp, H = 1.5, .42, .5
    P.append(wbox('tc', 'wood', 0x5e4430, (0, H / 2, 0), (L, H, Dp), var=.05))
    P.append(wboxes('td', 'wood', 0x4a3424, [((x, .22, Dp / 2 + .002), (.004, .36, .004)) for x in (-.25, .25)], var=0))
    P.append(wboxes('tk', 'metal', 0x9aa0a4, [((x, .3, Dp / 2 + .012), (.1, .015, .015)) for x in (-.5, .5)], var=0))
    P.append(wbox('tv', 'plain', 0x1a1b1d, (0, H + .42, -.05), (1.05, .62, .04), var=.01))
    P.append(wbox('ts', 'plain', 0x0c0d0e, (0, H + .43, -.028), (.99, .56, .004), var=0))
    P.append(wboxes('tf', 'plain', 0x2a2b2d, [((0, H + .05, -.05), (.3, .03, .18)), ((0, H + .1, -.06), (.06, .1, .03))], var=0))
    P.append(wboxes('sp', 'plain', 0x2a2b2d, [((sx * .62, H + .14, -.02), (.12, .28, .14)) for sx in (1, -1)], var=.03))
    P.append(wbox('bx', 'plain', 0x3a3c3e, (-.3, .06, .02), (.36, .06, .26), var=.02))
    COL.append(aabb((0, H / 2, 0), (L, H, Dp)))
    return iprop('TV_UNIT', P, COL, .5, 'low TV cabinet 1.5 × 0.5 × 0.42 with a flat TV and speakers, front +z')


def chair():
    P = []
    WC = 0x7b5a3a
    P.append(wbox('cs', 'wood', WC, (0, .45, 0), (.44, .04, .42), var=.06))
    P.append(wboxes('cl', 'wood', 0x6b4a2e, [((sx * .19, .215, sz * .18), (.04, .43, .04)) for sx in (1, -1) for sz in (1, -1)] + [((sx * .19, .72, -.18), (.04, .5, .04)) for sx in (1, -1)], var=.06))
    P.append(wboxes('cb', 'wood', WC, [((0, .95, -.18), (.42, .07, .03))] + [((x, .72, -.18), (.03, .42, .02)) for x in (-.08, 0, .08)] + [((0, .15, sz * .18), (.36, .025, .025)) for sz in (1, -1)], var=.06))
    return iprop('CHAIR', P, None, .4, 'wooden dining chair, seat .47, back at -z (no collision)')


def wardrobe():
    P, COL = [], []
    W, Dp, H = 1.2, .58, 2.0
    WC = 0x8a6a48
    P.append(wbox('wb', 'wood', WC, (0, H / 2 + .05, 0), (W, H - .1, Dp), var=.06))
    P.append(wbox('wt', 'wood', 0x6b4a2e, (0, H + .02, 0), (W + .06, .06, Dp + .04), var=.06))
    P.append(wbox('wf', 'wood', 0x5e4430, (0, .05, .0), (W - .04, .1, Dp - .04), var=.06))
    P.append(wbox('wl', 'wood', 0x5e4430, (0, 1.05, Dp / 2 + .002), (.006, H - .2, .004), var=0))
    P.append(wboxes('wp', 'wood', 0x7b5a3a, [((sx * W / 4, y, Dp / 2 + .006), (W / 2 - .14, h, .012)) for sx in (1, -1) for (y, h) in ((1.5, .7), (.62, .7))], var=.06))
    P.append(wboxes('wh', 'metal', 0xc8a24a, [((sx * .06, 1.1, Dp / 2 + .02), (.02, .12, .02)) for sx in (1, -1)], var=0))
    COL.append(aabb((0, H / 2 + .02, 0), (W, H + .05, Dp)))
    return iprop('WARDROBE', P, COL, .5, 'wooden wardrobe 1.2 × 2.05 × .58, doors at +z')


def strip_glb_attrs(path, names, drop=('NORMAL', 'TEXCOORD_0')):
    """匯出後處理：names 這些節點的網格拿掉法線與 UV（網頁照面重算法線、用方盒投影補 UV），沒人用的 accessor / bufferView 一起丟掉；其他物件的資料不變"""
    import json, struct
    raw = open(path, 'rb').read()
    jl = struct.unpack('<I', raw[12:16])[0]
    j = json.loads(raw[20:20 + jl])
    o = 20 + jl
    bl = struct.unpack('<I', raw[o:o + 4])[0]
    binb = raw[o + 8:o + 8 + bl]
    meshes = {j['nodes'][i]['mesh'] for i in range(len(j['nodes'])) if j['nodes'][i].get('name') in names and 'mesh' in j['nodes'][i]}
    for mi in meshes:
        for pr in j['meshes'][mi]['primitives']:
            for k in drop:
                pr['attributes'].pop(k, None)
    used = []
    for m in j['meshes']:
        for pr in m['primitives']:
            used += list(pr['attributes'].values()) + ([pr['indices']] if 'indices' in pr else [])
    used = sorted(set(used))
    amap = {a: i for i, a in enumerate(used)}
    for m in j['meshes']:
        for pr in m['primitives']:
            pr['attributes'] = {k: amap[v] for k, v in pr['attributes'].items()}
            if 'indices' in pr:
                pr['indices'] = amap[pr['indices']]
    accs = [j['accessors'][a] for a in used]
    out, views, vmap = bytearray(), [], {}
    for a in accs:
        bi = a['bufferView']
        if bi not in vmap:
            bv = j['bufferViews'][bi]
            while len(out) % 4:
                out += b'\0'
            v = dict(bv, byteOffset=len(out))
            s0 = bv.get('byteOffset', 0)
            out += binb[s0:s0 + bv['byteLength']]
            vmap[bi] = len(views)
            views.append(v)
        a['bufferView'] = vmap[bi]
    while len(out) % 4:
        out += b'\0'
    j['accessors'], j['bufferViews'], j['buffers'] = accs, views, [{'byteLength': len(out)}]
    js = json.dumps(j, separators=(',', ':')).encode()
    while len(js) % 4:
        js += b' '
    with open(path, 'wb') as f:
        f.write(struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(out)))
        f.write(struct.pack('<II', len(js), 0x4E4F534A)); f.write(js)
        f.write(struct.pack('<II', len(out), 0x004E4942)); f.write(bytes(out))
    print('stripped normals / uv', len(meshes), 'meshes', os.path.getsize(path) // 1024, 'KB')


IPROPS = []
for fn in (hay_bale, hay_loose, trough, stall, loft, tractor, workbench, tool_rack, barrel, sacks, lantern, ladder,
           shelf, toolbox_kit, generator, gas_can, wheelbarrow, tarp,
           bunk, locker, ftable, fchair, kitchen, hooks, notice, fan, water, clothes, picnic,
           fridge, bookshelf, tv_unit, chair, wardrobe):
    IPROPS.append(fn().name)

print('tris', {o.name: tri_count([o]) for o in OUT})
# AO：地面（碼頭與船不在範圍內）＋ 依大小分組的距離
gp = bpy.data.objects.new('GroundTmp', bpy.data.meshes.new('GroundTmp'))
bm = bmesh.new()
for (xx, zz) in ((-80, -60), (600, -60), (600, 600), (-80, 600)):
    bm.verts.new(V(xx, 0, zz))
bm.faces.new(list(bm.verts))
bm.to_mesh(gp.data); bm.free()
bpy.context.scene.collection.objects.link(gp)
for dist, objs in sorted(GROUP.items()):
    ao_bake_w(objs, int(os.environ.get('SAMPLES', '128')), .42 if dist < 5 else .5, dist, role_floor={'leaf': .58, 'bark': .5})
bpy.data.objects.remove(gp)
# 樹冠：葉片改用橢球法線、內部與下方較暗
for nm, m in META.items():
    if m['canopy']:
        ob = bpy.data.objects[nm]
        C, Rr = Vector(m['canopy']['center']), m['canopy']['radii']
        def dark(p, C=C, Rr=Rr):
            q = Vector(((p.x - C.x) / Rr[0], (p.y - C.y) / Rr[1], (p.z - C.z) / Rr[2]))
            return (.8 + .3 * min(1, q.length) ** 1.3) * (.92 + .1 * max(-1, min(1, q.y)))
        shade_by(ob, dark, ('leaf',))
        canopy_normals(ob, C, Rr)
if PREVIEW:
    os.makedirs(PREVIEW, exist_ok=True)
    preview(os.path.join(PREVIEW, 'w_trees.png'), (22, 3.5, 0), 34, 20, 8, (1200, 600))
    preview(os.path.join(PREVIEW, 'w_rocks.png'), (52, 1, 0), 12, 20, 15)
    preview(os.path.join(PREVIEW, 'w_houses.png'), (14, 3, 40), 26, 25, 18, (1200, 600))
    preview(os.path.join(PREVIEW, 'w_gas.png'), (68, 3, 40), 30, 30, 18, (1200, 600))
    preview(os.path.join(PREVIEW, 'w_props.png'), (18, 4, 80), 26, 25, 15, (1200, 600))
    preview(os.path.join(PREVIEW, 'w_mesa.png'), (110, 25, 320), 260, 20, 10, (1200, 600))
    preview(os.path.join(PREVIEW, 'w_water.png'), (-235, 0, 0), 10, 35, 20)
for ob in OUT:
    ob.location = (0, 0, 0)
bpy.context.view_layer.update()
if os.environ.get('META'):
    info = {}
    for ob in OUT:
        bb = [T(ob.matrix_world @ Vector(c)) for c in ob.bound_box]
        mn = [min(getattr(p, a) for p in bb) for a in 'xyz']
        mx = [max(getattr(p, a) for p in bb) for a in 'xyz']
        info[ob.name] = dict(META[ob.name], tris=tri_count([ob]), min=[round(v, 2) for v in mn], max=[round(v, 2) for v in mx],
                             materials=sorted(set(m.name for m in ob.data.materials)))
    json.dump(info, open(os.environ['META'], 'w'), ensure_ascii=False, indent=1)
GLB_PATH = os.environ.get('GLB', os.path.join(HERE, 'world.glb'))
wexport(GLB_PATH, OUT)
quantize_glb_colors(GLB_PATH)
strip_glb_attrs(GLB_PATH, set(IPROPS))   # 室內陳設：法線與 UV 由網頁補（見 worldGeo）
from glb_draco import draco_glb
draco_glb(GLB_PATH)   # 最後一步：頂點與索引改存 Draco（見 glb_draco.py）
