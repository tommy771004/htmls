# 188 彩筆曠野：場景物件（樹、岩石、草、花、水晶祭壇、寶箱、遺跡入口、小屋、機關……）
# 重建：/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P assets/188/build_props.py
#   環境變數：OUT=輸出 glb（預設 assets/188/props.glb）、RENDER=1 預覽圖存到 PREV、AO=烘焙取樣數
# 每個物件的原點都在底部中心（寶箱蓋在鉸鏈），大小對齊網頁原本程式建模的尺寸。
# 材質名稱：fixed（頂點色就是顏色）、c1 / c2（網頁會乘上顏色：花瓣、彈花的花瓣與花心）、flat（寶石，點亮時整個換材質，所以 Gem 必須是單一網格單一材質）、
#   shell（寶石外殼，半透明）、cloth2s（雙面：松針枝片、棕櫚羽葉、仙人掌刺、屋瓦）、leaf（帶 UV 的樹葉卡片，網頁貼一叢小葉的透明貼圖，頂點色是葉色，自訂法線從葉團中心往外）
# Grass 必須是單一 fixed 網格（密集草原的著色器只讀 position / color）。樹、草、花、岩石會被大量實例化，面數有上限。
# 其他環境變數：DBG=1 列出每個物件各零件的面數；TREECORE=1 讓闊葉樹的每個葉團多一顆深色的芯（預設不用）
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from bw_lib import *

OUT = os.environ.get('OUT', os.path.join(HERE, 'props.glb'))
PREV = os.environ.get('PREV', '/tmp/bw188')
RENDER = os.environ.get('RENDER', '1') == '1'
AO = int(os.environ.get('AO', '16'))
os.makedirs(PREV, exist_ok=True)
reset()
random.seed(1880)
ALL = []
PARK = {}
bpy.context.scene.world = bpy.data.worlds.new('W')


def world_ao(dist):
    bpy.context.scene.world.light_settings.distance = dist


def park(ob):
    """做好的物件先移到遠處，後面烘 AO 時才不會被疊在原點的其他物件遮到"""
    PARK[ob.name] = len(PARK) * 400 + 400
    ob.location.x += PARK[ob.name]


def unpark():
    for nm, dx in PARK.items():
        bpy.data.objects[nm].location.x -= dx
    PARK.clear()


def bake(objs, dist=1.5, strength=1.1, floor=.6):
    if AO:
        world_ao(dist)
        ao_bake(objs, samples=AO, strength=strength, floor=floor)


def finish(objs, name, ao=True, dec=None, floor=.6, dist=1.5, strength=1.1, keep=True):
    """合併成一個物件、烘 AO、原點放在 (0,0,0)"""
    objs = [o for o in objs if o]
    if os.environ.get('DBG'):
        agg = {}
        for o in objs:
            k = o.name.split('.')[0]
            agg[k] = agg.get(k, 0) + tri_count([o])
        print('  parts', name, sorted(agg.items(), key=lambda kv: -kv[1])[:12])
    ob = join(objs, name) if len(objs) > 1 else objs[0]
    ob.name = name
    ob.data.name = name
    if ao:
        bake([ob], dist, strength, floor)
    origin_to(ob, (0, 0, 0))
    if dec:
        decimate(ob, dec)
    ALL.append(ob)
    print(name, 'tris', tri_count([ob]))
    if keep:
        park(ob)
    return ob


def nz(p, f=1.0, s=0):
    return noise.noise(Vector((p[0] * f + s, p[1] * f + s * .7, p[2] * f - s)))


def fbm(p, f=1.0, s=0, oct=3):
    return noise.fractal(Vector((p[0] * f + s, p[1] * f + s * .7, p[2] * f - s)), .6, 2.0, oct, noise_basis='PERLIN_ORIGINAL')


def set_cols(ob, cols):
    """每個頂點一個 sRGB 顏色（依 bmesh 建立順序）"""
    me = ob.data
    col = me.color_attributes.get('Col') or me.color_attributes.new('Col', 'FLOAT_COLOR', 'POINT')
    me.color_attributes.active_color = col
    arr = np.zeros(len(me.vertices) * 4, dtype=np.float32)
    for i, c in enumerate(cols):
        c = hexrgb(c)
        arr[i * 4:i * 4 + 4] = (srgb2lin(c[0]), srgb2lin(c[1]), srgb2lin(c[2]), 1.0)
    col.data.foreach_set('color', arr)


def set_cn(ob, nrms):
    """把想要的法線（three 座標）先存成頂點屬性 cn，合併之後再用 apply_cn 寫成自訂法線"""
    me = ob.data
    a = me.attributes.new('cn', 'FLOAT_VECTOR', 'POINT')
    flat = []
    for n in nrms:
        b = V(*n).normalized()
        flat += [b.x, b.y, b.z]
    a.data.foreach_set('vector', flat)


def apply_cn(ob):
    me = ob.data
    a = me.attributes.get('cn')
    if not a:
        return
    cn = np.zeros(len(me.vertices) * 3, dtype=np.float32)
    a.data.foreach_get('vector', cn)
    cn = cn.reshape(-1, 3)
    cur = np.zeros(len(me.loops) * 3, dtype=np.float32)
    me.corner_normals.foreach_get('vector', cur)
    cur = cur.reshape(-1, 3)
    lv = np.zeros(len(me.loops), dtype=np.int32)
    me.loops.foreach_get('vertex_index', lv)
    c2 = cn[lv]
    use = np.linalg.norm(c2, axis=1) > .5
    cur[use] = c2[use]
    me.attributes.remove(me.attributes['cn'])
    me.normals_split_custom_set([tuple(v) for v in cur])


def ensure_uv(objs):
    for o in objs:
        if not o.data.uv_layers:
            o.data.uv_layers.new(name='UVMap')


class Cards:
    """樹葉卡片：3×3 頂點、中間往外拱，UV 0..1；顏色、法線由呼叫端給"""

    def __init__(self, name):
        self.name = name
        self.bm = bmesh.new()
        self.uv = self.bm.loops.layers.uv.new('UVMap')
        self.cols, self.nrms = [], []

    def add(self, P, F, h, roll=0.0, bend=.18, colfn=None, nfn=None, stretch=1.0):
        P, F = Vector(P), Vector(F).normalized()
        t0 = Vector((0, 1, 0)) if abs(F.y) < .9 else Vector((1, 0, 0))
        T = (t0 - F * t0.dot(F)).normalized()
        B = F.cross(T)
        T, B = T * math.cos(roll) + B * math.sin(roll), B * math.cos(roll) - T * math.sin(roll)
        c = P + F * bend * h
        cs = [P + (T * u + B * v * stretch) * h - F * bend * h * .35 for (u, v) in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
        vs = [self.bm.verts.new(V(*q)) for q in [c] + cs]
        for q in [c] + cs:
            self.cols.append(colfn(q) if colfn else (1, 1, 1))
            self.nrms.append(nfn(q) if nfn else F)
        uvs = [(.5, .5), (0, 0), (1, 0), (1, 1), (0, 1)]
        for i in range(4):
            j = 1 + (i + 1) % 4
            f = self.bm.faces.new((vs[0], vs[1 + i], vs[j]))
            for lp, k in zip(f.loops, (0, 1 + i, j)):
                lp[self.uv].uv = uvs[k]

    def build(self):
        ob = obj_from_bm(self.bm, self.name, slot='leaf')
        set_cols(ob, self.cols)
        set_cn(ob, self.nrms)
        return ob


def fib_dirs(n, rnd, jit=.25, ymin=-.8):
    """球面上大致均勻的 n 個方向（y 從 1 到 ymin），帶一點亂數"""
    out = []
    ga = math.pi * (3 - math.sqrt(5))
    for k in range(n):
        y = 1 - (k + .5) / n * (1 - ymin)
        r = math.sqrt(max(0, 1 - y * y))
        a = k * ga + rnd.uniform(-.3, .3)
        d = Vector((math.cos(a) * r, y, math.sin(a) * r)) + Vector((rnd.uniform(-1, 1), rnd.uniform(-1, 1), rnd.uniform(-1, 1))) * jit
        out.append(d.normalized())
    return out


def bark_fn(base, dark, moss=0x55632e, lite=None):
    lite = lite or mix(base, 0xd8cdb0, .35)

    def fn(p, n):
        ang = math.atan2(p[0], p[2])
        k = .5 + .5 * math.sin(ang * 7 + p[1] * .6 + fbm(p, 1.6) * 4)
        c = mix(dark, base, .25 + k * .75)
        c = mix(c, lite, max(0, n[1]) * .5 + sstep(.3, .8, fbm(p, 3.1, 7)) * .3)
        if p[1] < 1.6:
            c = mix(c, moss, sstep(1.6, .1, p[1]) * sstep(-.2, .5, fbm(p, 1.3, 3) + n[0] * .3) * .75)
        return c
    return fn


CORE = os.environ.get('TREECORE', '0') == '1'   # 葉團的深色芯：從樹下看會變成一顆顆球，預設不用，改由內圈卡片補密度


def broadleaf(name, lo, mid, hi, spec, trunk, clumps, fork, seed, sprigs=()):
    """扭曲的樹幹分岔成枝條，每個葉團是一顆凹凸的深色芯 + 一圈往外翹的葉片卡片"""
    rnd = random.Random(seed)
    wood, cores = [], []
    F = Vector(fork)
    # 樹幹與根部
    top = max(clumps, key=lambda c: c[0][1])
    rest = [c for c in clumps if c is not top]
    Ct = Vector(top[0])
    lead = Ct - Vector((0, top[1] * .15, 0))
    tp = [Vector((0, -.45, 0)), Vector((0, .35, 0)), Vector((F.x * .2, 1.2, F.z * .2)), Vector((F.x * .55, 2.1, F.z * .55)), F,
          F.lerp(lead, .5) + Vector((rnd.uniform(-.25, .25), 0, rnd.uniform(-.25, .25))), lead]
    tr = tube(name + 'Trunk', [tuple(q) for q in tp], [.8, .52, .42, .37, .32, .2, .08], seg=12)
    displace(tr, .06, .9, seed=seed)
    wood.append(tr)

    def on_trunk(y):
        for q0, q1 in zip(tp, tp[1:]):
            if q0.y <= y <= q1.y:
                return q0.lerp(q1, (y - q0.y) / (q1.y - q0.y))
        return tp[-1]
    for k in range(5):
        a = k / 5 * TAU + rnd.uniform(-.25, .25)
        d = Vector((math.cos(a), 0, math.sin(a)))
        L = rnd.uniform(.9, 1.25)
        pts = [d * .1 + Vector((0, 1.1, 0)), d * .42 + Vector((0, .5, 0)), d * .75 * L + Vector((0, .08, 0)), d * 1.02 * L + Vector((0, -.35, 0))]
        wood.append(tube(name + 'Root', [tuple(q) for q in pts], [.34, .3, .21, .12], seg=8))
    # 枝條：三根大枝在樹幹不同高度長出，每枝再分到各葉團；樹幹一路延伸到頂端葉團
    sectors = [[c for c in rest if int(((math.atan2(c[0][2], c[0][0]) + math.pi) / TAU * 3 + seed * .37) % 3) == s] for s in range(3)]
    for si, sec in enumerate(sectors):
        if not sec:
            continue
        m = sum((Vector(c[0]) for c in sec), Vector()) / len(sec)
        S0 = on_trunk(F.y - .55 + si * .5)
        T = S0 + (Vector((m.x, 0, m.z)) - Vector((S0.x, 0, S0.z))) * .55 + Vector((0, (m.y - S0.y) * .5, 0))
        mp = S0.lerp(T, .5) + Vector((0, .1, 0)) + Vector((rnd.uniform(-.2, .2), 0, rnd.uniform(-.2, .2)))
        lb = tube(name + 'Limb', [tuple(S0), tuple(mp), tuple(T)], [.25, .19, .14], seg=8)
        displace(lb, .03, 1.5, seed=seed + len(wood))
        wood.append(lb)
        for (c, R) in sec:
            C = Vector(c)
            e = C - (C - T).normalized() * R * .15
            q = T.lerp(e, .5) + Vector((0, .15, 0))
            wood.append(tube(name + 'Branch', [tuple(T - (e - T).normalized() * .08), tuple(q), tuple(e)], [.13, .09, .045], seg=6))
            s0 = T.lerp(q, .7)
            sd = (e - T).cross(Vector((0, 1, 0))).normalized() * rnd.choice((-1, 1))
            wood.append(tube(name + 'Twig', [tuple(s0), tuple(s0 + sd * .45 + Vector((0, .3, 0))), tuple(s0 + sd * .7 + Vector((0, .7, 0)))], [.06, .04, .02], seg=5))
    # 葉團
    ys = [c[0][1] for c in clumps]
    y0, y1 = min(ys) - 1.4, max(ys) + 1.6
    cen = sum((Vector(c[0]) * c[1] ** 2 for c in clumps), Vector()) / sum(c[1] ** 2 for c in clumps)
    cards = Cards(name + 'Leaves')
    sun = Vector((.35, 1, .25)).normalized()
    for ci, (c, R) in enumerate(clumps):
        C = Vector(c)
        co = ellipsoid(name + 'Core', tuple(C - Vector((0, R * .1, 0))), (R * .44, R * .36, R * .44), seg=8, rings=6)
        displace(co, R * .12, 1.6 / R, seed=seed * 10 + ci, octaves=2)

        def core_col(p, n, C=C, R=R):
            t = .3 + .3 * sstep(y0, y1, p[1]) + .25 * (n[1] * .5 + .5)
            return mix(lo, mid, t)
        paint(co, core_col)
        if CORE:
            cores.append(co)
        else:
            bpy.data.objects.remove(co)
        n = max(8, round(14 * (R / 1.6) ** 2))
        layers = [(d, R * rnd.uniform(.8, 1.0), R * rnd.uniform(.6, .75), 0) for d in fib_dirs(n, rnd, jit=.22, ymin=-.95)]
        layers += [(d, R * rnd.uniform(.42, .62), R * rnd.uniform(.5, .62), 1) for d in fib_dirs(max(3, round(n * (.6 if CORE else .85))), rnd, jit=.3, ymin=-.9)]
        for (d, dist, h, inner) in layers:
            P = C + d * dist
            Fc = (d + Vector((rnd.uniform(-1, 1), rnd.uniform(-.5, 1), rnd.uniform(-1, 1))) * .45).normalized()
            jitc = rnd.uniform(-.12, .12) - inner * .18
            sp = rnd.random() < .18 and d.y > .1 and not inner

            def nfn(q, C=C):
                a = (q - C).normalized()
                b = (q - cen).normalized()
                return (a * .8 + b * .35 + Vector((0, .12, 0))).normalized()

            def colfn(q, C=C, R=R, d=d, jitc=jitc, sp=sp):
                nn = nfn(q)
                o = sstep(.4, 1.2, (q - C).length / R)
                hg = sstep(y0, y1, q.y)
                t = .38 * o + .3 * hg + .32 * max(0, nn.dot(sun)) + jitc
                c = mix(lo, mid, t * 1.8) if t < .55 else mix(mid, hi, (t - .55) * 2.2)
                if d.y < -.25:
                    c = mix(c, lo, .45)
                if sp:
                    c = mix(c, spec, .35)
                return c
            cards.add(P, Fc, h, roll=rnd.uniform(0, TAU), bend=rnd.uniform(.06, .14), colfn=colfn, nfn=nfn)
    # 從葉團外掛下來的小枝葉
    for (a, b, R) in sprigs:
        A, Bv = Vector(a), Vector(b)
        wood.append(tube(name + 'Sprig', [tuple(A), tuple(A.lerp(Bv, .5) + Vector((0, .15, 0))), tuple(Bv)], [.05, .035, .015], seg=4))
        for k in range(2):
            P = Bv + Vector((rnd.uniform(-.2, .2), rnd.uniform(-.1, .2), rnd.uniform(-.2, .2)))
            Fc = ((Bv - A).normalized() + Vector((0, .8, 0)) + Vector((rnd.uniform(-.5, .5), 0, rnd.uniform(-.5, .5)))).normalized()
            cards.add(P, Fc, R * rnd.uniform(.8, 1), roll=rnd.uniform(0, TAU), bend=.2,
                      colfn=lambda q: mix(mid, hi, .35), nfn=lambda q, Fc=Fc: (Fc + Vector((0, .5, 0))).normalized())
    for o in wood:
        paint(o, bark_fn(*trunk))
    world_ao(2.5)
    bake(wood + cores, dist=2.2, strength=1.0, floor=.45)
    lv = cards.build()
    parts = wood + cores + [lv]
    ensure_uv(parts)
    ob = finish(parts, name, ao=False)
    apply_cn(ob)
    return ob


broadleaf('TreeRound', 0x243c1c, 0x51772a, 0x8fae46, 0xacc252, (0x6f604c, 0x3f352a),
          [((0, 7.15, .1), 1.75), ((1.6, 6.0, .7), 1.55), ((-1.5, 6.2, -.5), 1.6), ((.3, 6.1, -1.7), 1.5), ((-.6, 5.9, 1.6), 1.45),
           ((2.6, 4.75, -.9), 1.25), ((-2.5, 4.9, 1.0), 1.25), ((-1.1, 4.7, -2.4), 1.2), ((1.3, 4.55, 2.4), 1.15)],
          fork=(.15, 3.1, .05), seed=1,
          sprigs=[((2.4, 4.4, -.6), (3.4, 3.9, -.9), .55), ((-2.1, 4.6, .6), (-3.0, 3.8, 1.1), .5)])
broadleaf('TreeAutumn', 0x4f2414, 0xa55a26, 0xd9a456, 0xe6c46a, (0x6a5a4c, 0x3c3128),
          [((.1, 8.0, 0), 1.5), ((1.3, 6.9, .5), 1.45), ((-1.2, 7.0, -.4), 1.45), ((.2, 6.8, -1.4), 1.35), ((-.3, 6.7, 1.4), 1.35),
           ((1.9, 5.4, -.8), 1.2), ((-1.9, 5.5, .8), 1.2), ((.6, 5.3, 2.0), 1.1), ((-.7, 5.25, -2.0), 1.1)],
          fork=(-.1, 3.5, .1), seed=2)

# ── 共用：石頭、木頭的上色與造形 ──
def flat(ob, deg=50):
    """平滑著色，但夾角大於 deg 的稜線設為銳利：石面一塊塊分明，又不會把每個頂點都拆開（glb 小很多）"""
    me = ob.data
    bm = bmesh.new()
    bm.from_mesh(me)
    lim = math.radians(deg)
    for e in bm.edges:
        e.smooth = not (e.is_manifold and e.calc_face_angle(0) > lim) and e.is_manifold
    for f in bm.faces:
        f.smooth = True
    bm.to_mesh(me)
    bm.free()
    return ob


def plane_cut(ob, co, no):
    """把平面外側的頂點壓到平面上：切出一個平的斷面（崩角、岩面）"""
    no = Vector(no).normalized()
    co = Vector(co)

    def f(p):
        d = (p - co).dot(no)
        if d > 0:
            return p - no * d
    each_vert(ob, f)


def chip_block(name, c, s, bevel=.08, seed=0, chips=2, amp=.025, cuts=1, slot='fixed'):
    """有倒角、崩角、表面微凹凸的石塊"""
    rnd = random.Random(seed)
    ob = rbox(name, c, s, bevel=bevel, seg=1, slot=slot)
    if cuts:
        dice(ob, cuts)
    C = Vector(c)
    for k in range(chips):
        sg = Vector((rnd.choice((-1, 1)), rnd.choice((-1, 1)), rnd.choice((-1, 1))))
        corner = C + Vector((sg.x * s[0] / 2, sg.y * s[1] / 2, sg.z * s[2] / 2))
        n = (sg + Vector((rnd.uniform(-.5, .5), rnd.uniform(-.5, .5), rnd.uniform(-.5, .5)))).normalized()
        plane_cut(ob, corner - n * min(s) * rnd.uniform(.12, .28), n)
    if amp:
        displace(ob, amp, 1.8, seed=seed, octaves=2)
    return flat(ob)


def stone_fn(base=0x9a9282, lite=0xd2c8b2, dark=0x5f5a50, moss=0x66803a, mossk=1.0, lich=1.0, seed=0, mossy=None):
    def fn(p, n):
        m = fbm(p, 1.2, seed)
        c = mix(base, lite, .42 + m * .55 + max(0, n[1]) * .22)
        if n[1] < -.3:
            c = mix(c, dark, .35)
        if lich and nz(p, 4.2, seed + 3) > .45:
            c = mix(c, 0xc6c79c, .5 * lich)
        if lich and nz(p, 5.1, seed + 9) > .52:
            c = mix(c, 0xb68c56, .4 * lich)
        mk = sstep(.4, .85, n[1]) * sstep(-.15, .25, fbm(p, .8, seed + 5)) * mossk
        if mossy:
            mk = max(mk, mossy(p, n))
        c = mix(c, mix(moss, 0x8aa048, sstep(-.2, .4, nz(p, 3, seed + 1))), min(1, mk) * .85)
        return c
    return fn


def wood_fn(base=0x8a5c36, dark=0x4f3421, axis=1, lite=None, k=24):
    lite = lite or mix(base, 0xe0c498, .35)

    def fn(p, n):
        q = list(p)
        u = q.pop(axis)
        g = .5 + .5 * math.sin((q[0] + q[1]) * k + fbm(p, 1.5) * 4 + u * .3)
        c = mix(dark, base, .35 + .65 * g)
        c = mix(c, lite, max(0, n[1]) * .35 + max(0, fbm(p, 2.5, 4)) * .3)
        return c
    return fn


def iron(p, n):
    return mix(0x3e4046, 0x7c7f86, .45 + n[1] * .3 + fbm(p, 4, 2) * .4)


def gold(p, n):
    return mix(0xa0782c, 0xe6c46e, .55 + n[1] * .35 + fbm(p, 5) * .2)


def rivets(name, pts, r=.05, fn=iron):
    out = []
    for q in pts:
        e = ellipsoid(name, q, (r, r, r), seg=5, rings=3)
        paint(e, fn)
        out.append(e)
    return out


# ── 松樹：一層層往下垂的枝葉（每層一圈鋸齒狀的枝片 + 深色的芯） ──
def pine():
    rnd = random.Random(31)
    objs = []
    tr = tube('PineTrunk', [(0, -.4, 0), (0, .5, 0), (.05, 2.5, .03), (0, 5.5, 0), (0, 8.9, 0)], [.5, .34, .27, .17, .04], seg=10)
    displace(tr, .04, 1.2, seed=3)
    paint(tr, bark_fn(0x7a5438, 0x42291c, lite=0xa98260))
    objs.append(tr)
    for k in range(4):
        a = k / 4 * TAU + .4
        d = Vector((math.cos(a), 0, math.sin(a)))
        r = tube('PineRoot', [tuple(d * .1 + Vector((0, .7, 0))), tuple(d * .55 + Vector((0, .05, 0))), tuple(d * .95 + Vector((0, -.35, 0)))], [.2, .14, .05], seg=6)
        paint(r, bark_fn(0x7a5438, 0x42291c))
        objs.append(r)
    tiers = [(1.9, 2.75, 9), (3.05, 2.4, 9), (4.15, 2.05, 8), (5.2, 1.7, 8), (6.2, 1.35, 7), (7.1, 1.0, 6), (7.9, .65, 5)]
    bm = bmesh.new()
    cols = []
    for ti, (y, R, n) in enumerate(tiers):
        # 深色的芯：往下張開的錐
        core = lathe('PineCore', [(R * .72, y - .35), (R * .5, y + .1), (.12, y + 1.0)], seg=9, cap_top=False, wobble=lambda a_, yy: .08 * math.sin(a_ * 5))
        paint(core, lambda p, n_: mix(0x1d3528, 0x2e4d36, sstep(1.5, 8.5, p[1])))
        objs.append(core)
        for b in range(n):
            a = (b + rnd.uniform(-.2, .2)) / n * TAU + ti * .7
            d = Vector((math.cos(a), 0, math.sin(a)))
            sd = Vector((-d.z, 0, d.x))
            L = R * rnd.uniform(.9, 1.08)
            y0 = y + .55 + rnd.uniform(-.1, .1)
            # 枝片沿著長度：先微微上揚再往下垂；兩側鋸齒、中間拱起
            segs = 6
            rows = []
            for s in range(segs + 1):
                t = s / segs
                c = Vector((0, y0, 0)) + d * (.12 + L * t) + Vector((0, .25 * t - (t ** 1.8) * (1.05 + L * .12), 0))
                w = (math.sin(min(1, t * 1.25) * math.pi) * .75 + .25 * (1 - t)) * L * .3
                w *= 1.0 if s % 2 else .72
                ridge = .07 * L * (1 - t)
                rows.append([c - sd * w - Vector((0, ridge * .6, 0)), c + Vector((0, ridge, 0)), c + sd * w - Vector((0, ridge * .6, 0))])
            vs = []
            for row in rows:
                vr = []
                for q in row:
                    vr.append(bm.verts.new(V(*q)))
                    t = (q - Vector((0, y0, 0))).length / (L + .12)
                    tip = sstep(.4, 1.0, t)
                    lit = sstep(1.5, 8.6, q.y)
                    cols.append(mix(mix(0x223f2e, 0x4d7446, tip * .8 + lit * .25), 0x86a660, sstep(.75, 1, t) * .5 + rnd.uniform(0, .08)))
                vs.append(vr)
            for s in range(segs):
                for j in range(2):
                    bm.faces.new((vs[s][j], vs[s][j + 1], vs[s + 1][j + 1], vs[s + 1][j]))
    fr = obj_from_bm(bm, 'PineBough', slot='cloth2s')
    set_cols(fr, cols)
    objs.append(fr)
    bake(objs, dist=1.6, floor=.5)
    return finish(objs, 'Pine', ao=False)


pine()


# ── 棕櫚樹：一節一節的彎樹幹、羽狀葉（葉軸兩側一排排下垂的小葉）、椰子 ──
def palm():
    rnd = random.Random(41)
    objs = []
    top = Vector((1.25, 5.75, 0))
    path = [Vector((0, -.3, 0)), Vector((.08, 1.4, 0)), Vector((.32, 2.9, 0)), Vector((.72, 4.35, 0)), top]
    # 樹幹：每節一圈微微鼓起的環
    N = 22
    bm = bmesh.new()
    rings = []
    cols = []
    for k in range(N + 1):
        t = k / N
        f = t * (len(path) - 1)
        i = min(int(f), len(path) - 2)
        p = path[i].lerp(path[i + 1], f - i)
        tg = (path[i + 1] - path[i]).normalized()
        nx = Vector((0, 0, 1)).cross(tg).normalized()
        nz_ = tg.cross(nx)
        r = .33 - t * .13 + (.035 if k % 2 == 0 else 0) + (.12 * sstep(.12, 0, t))
        ring = []
        for s in range(10):
            a = s / 10 * TAU
            q = p + (nx * math.cos(a) + nz_ * math.sin(a)) * r
            ring.append(bm.verts.new(V(*q)))
            cols.append(mix(0x6a5238, 0xb89c70, (.55 if k % 2 == 0 else .15) + .25 * math.cos(a) + rnd.uniform(0, .12)))
        rings.append(ring)
    for k in range(N):
        for s in range(10):
            bm.faces.new((rings[k][s], rings[k][(s + 1) % 10], rings[k + 1][(s + 1) % 10], rings[k + 1][s]))
    bm.faces.new(list(reversed(rings[0])))
    trunk = obj_from_bm(bm, 'PalmTrunk')
    set_cols(trunk, cols)
    objs.append(trunk)
    # 樹冠底部的鞘
    cap = ellipsoid('PalmCrown', tuple(top + Vector((0, .05, 0))), (.3, .28, .3), seg=10, rings=6)
    paint(cap, lambda p, n: mix(0x5e5a30, 0x8a7c44, n[1] * .5 + .5))
    objs.append(cap)
    for k in range(4):
        a = k / 4 * TAU + .5
        objs.append(ellipsoid('Coco', (top.x + math.cos(a) * .24, top.y - .3, top.z + math.sin(a) * .24), (.17, .19, .17), seg=7, rings=5))
        paint(objs[-1], lambda p, n: mix(0x4a3a22, 0x7a6236, n[1] * .5 + .5))
    # 羽狀葉：葉軸 + 兩側小葉（雙面材質）
    bm = bmesh.new()
    cols = []
    for k in range(9):
        a = k / 9 * TAU + rnd.uniform(-.15, .15)
        d = Vector((math.cos(a), 0, math.sin(a)))
        sd = Vector((-d.z, 0, d.x))
        up = .55 + (k % 3) * .2
        L = rnd.uniform(3.3, 3.9)
        rach = []
        for s in range(9):
            t = s / 8
            rach.append(top + d * L * t + Vector((0, up * math.sin(t * 2.4) - t * t * 1.6, 0)))
        # 葉軸本身：窄的帶子
        for s in range(8):
            t = s / 8
            w = .06 * (1 - t) + .015
            q0, q1 = rach[s], rach[s + 1]
            v = [bm.verts.new(V(*(q0 - sd * w))), bm.verts.new(V(*(q0 + sd * w))), bm.verts.new(V(*(q1 + sd * w * .8))), bm.verts.new(V(*(q1 - sd * w * .8)))]
            bm.faces.new(v)
            cols += [0x9a9048] * 4
        # 小葉：每段兩側各一片，往外下垂
        for s in range(1, 8):
            t = s / 8
            q = rach[s]
            tg = (rach[s + 1] - rach[s - 1]).normalized()
            ll = (1 - abs(t - .4) * 1.2) * 1.05 + .15
            for side in (-1, 1):
                out = (sd * side * .85 + tg * .35 + Vector((0, -.55, 0))).normalized()
                tip = q + out * ll
                w = .11
                v = [bm.verts.new(V(*(q - tg * w))), bm.verts.new(V(*(q + tg * w))), bm.verts.new(V(*(tip + tg * .02 + Vector((0, -.05, 0))))),
                     bm.verts.new(V(*(q.lerp(tip, .5) + Vector((0, .05, 0)))))]
                bm.faces.new((v[0], v[3], v[1]))
                bm.faces.new((v[1], v[3], v[2]))
                bm.faces.new((v[0], v[2], v[3]))
                lt = rnd.uniform(0, .15)
                cols += [mix(0x2f5a2c, 0x4f7a34, lt), mix(0x2f5a2c, 0x4f7a34, lt), mix(0x8aaa4c, 0xb4b85c, t * .6 + lt), mix(0x4a7434, 0x6a9040, lt)]
    fr = obj_from_bm(bm, 'Frond', slot='cloth2s')
    set_cols(fr, cols)
    objs.append(fr)
    bake(objs, dist=1.2, floor=.55)
    return finish(objs, 'Palm', ao=False)


palm()


# ── 仙人掌：圓潤的稜、稜上一排刺、兩隻手、頂上小花 ──
def cactus():
    objs = []
    rib = lambda a, y: .09 * (abs(math.cos(a * 5)) * 2 - 1)
    prof = [(.5, -.25), (.6, .15), (.64, .7), (.645, 1.4), (.63, 2.1), (.61, 2.8), (.58, 3.35), (.52, 3.8), (.42, 4.12), (.27, 4.36), (.1, 4.48), (0, 4.5)]
    body = lathe('CactusBody', prof, seg=40, wobble=rib)
    objs.append(body)
    arms = []
    for s, y0, h in ((1, 1.6, 1.45), (-1, 2.3, 1.05)):
        pts = [(0, y0, 0), (s * .75, y0 - .12, 0), (s * 1.1, y0 + .15, 0), (s * 1.17, y0 + .7, 0), (s * 1.17, y0 + h, 0)]
        arm = tube('CactusArm', pts, [.3, .3, .3, .29, .27], seg=24)
        cap = ellipsoid('CactusCap', (s * 1.17, y0 + h, 0), (.27, .2, .27), seg=24, rings=5)
        for o in (arm, cap):
            def rb(p, s=s, y0=y0):
                if p[1] < y0 + .25 or abs(p[0]) < .9:
                    return None
                ax = Vector((s * 1.17, p[1], 0))
                d = Vector(p) - ax
                a = math.atan2(d.z, d.x)
                return tuple(Vector(p) + d.normalized() * .05 * (abs(math.cos(a * 4)) * 2 - 1) * min(1, d.length / .2))
            each_vert(o, rb)
            objs.append(o)
        arms.append((s, y0, h))

    def cac(p, n):
        if abs(p[0]) > .85:
            s = 1 if p[0] > 0 else -1
            a = math.atan2(p[2], p[0] - s * 1.17)
            k = abs(math.cos(a * 4))
        else:
            a = math.atan2(p[2], p[0])
            k = abs(math.cos(a * 5))
        c = mix(0x2f5a30, 0x6a9a4e, .2 + k * .6 + sstep(0, 4.5, p[1]) * .12 + fbm(p, 2.5) * .2)
        c = mix(c, 0x8a9a5a, sstep(.55, .95, fbm(p, 1.2, 4)) * .3)
        if p[1] < .45:
            c = mix(c, 0x6e5a3a, sstep(.45, -.1, p[1]) * .7)
        return c
    for o in objs:
        paint(o, cac)
    # 刺：沿著主幹的稜，一小撮一小撮
    bm = bmesh.new()
    cols = []
    for ri in range(10):
        a = ri / 10 * TAU
        for y in [.5 + j * .42 for j in range(9)]:
            r = .62 + .09
            if y > 3.3:
                r = .6 - (y - 3.3) * .35 + .09
            b = Vector((math.cos(a) * r, y + (ri % 2) * .2, math.sin(a) * r))
            out = Vector((math.cos(a), .15, math.sin(a)))
            for sp in (-.5, 0, .5):
                d = (out + Vector((-math.sin(a) * sp, .3 * abs(sp), math.cos(a) * sp))).normalized()
                v = [bm.verts.new(V(*(b + Vector((0, .02, 0))))), bm.verts.new(V(*(b - Vector((0, .02, 0))))), bm.verts.new(V(*(b + d * .16)))]
                bm.faces.new(v)
                cols += [0xd8cfa6, 0xd8cfa6, 0xf4efd8]
    sp = obj_from_bm(bm, 'CactusSpines', slot='cloth2s')
    set_cols(sp, cols)
    objs.append(sp)
    for k in range(3):
        a = k * 2.1
        fl = lathe('CactusFlower', [(.02, 0), (.14, .06), (.16, .14), (.08, .1), (0, .08)], seg=8, pivot=(math.cos(a) * .18, 4.38 + k * .03, math.sin(a) * .18), wobble=lambda a_, y: .25 * math.cos(a_ * 4))
        paint(fl, lambda p, n: mix(0xc0506e, 0xe89aa8, sstep(4.4, 4.55, p[1])))
        objs.append(fl)
    bake(objs, dist=1.0, floor=.55)
    return finish(objs, 'Cactus', ao=False)


cactus()


# ── 岩石三種：先做成凹凸的團塊，再用幾個平面削出大塊的岩面；稜線亮、凹縫暗、頂面長苔、零星地衣 ──
def rock(k, scale, cuts, seed, strata=0):
    rnd = random.Random(seed)
    rk = ico('Rock%d' % k, (0, .15, 0), scale, sub=4)
    displace(rk, .08, 1.0, seed=seed, octaves=3)
    for i in range(cuts):
        a = rnd.uniform(0, TAU)
        el = rnd.uniform(-.25, 1.1)
        n = Vector((math.cos(a) * math.cos(el), math.sin(el), math.sin(a) * math.cos(el)))
        ext = Vector((scale[0], scale[1], scale[2]))
        reach = abs(n.x) * ext.x + abs(n.y) * ext.y + abs(n.z) * ext.z
        plane_cut(rk, Vector((0, .15, 0)) + n * reach * rnd.uniform(.5, .72), n)
    each_vert(rk, lambda p: (p[0], max(p[1], -.3), p[2]))
    flat(rk, 14)
    # 稜線（凸）與凹縫：用鄰點相對於法線的高度估曲率
    me = rk.data
    bm = bmesh.new()
    bm.from_mesh(me)
    bm.normal_update()
    curv = []
    for v in bm.verts:
        s = 0
        for e in v.link_edges:
            o = e.other_vert(v)
            dv = o.co - v.co
            s += dv.dot(v.normal) / max(dv.length, 1e-4)
        curv.append(s / max(1, len(v.link_edges)))
    bm.free()
    sb = stone_fn(0x72706a, 0xb4ae9e, dark=0x4a4844, seed=seed, mossk=1.0)

    def base(p, n):
        c = sb(p, n)
        return mix(mix(c, 0x55524c, sstep(.1, -.6, n[1]) * .5), 0xd0c8b4, sstep(.35, .9, n[1]) * .3)

    def fn(p, n, _i=[0]):
        return base(p, n)
    paint(rk, base)
    col = me.color_attributes['Col']
    arr = np.zeros(len(me.vertices) * 4, dtype=np.float32)
    col.data.foreach_get('color', arr)
    arr = arr.reshape(-1, 4)
    for i, v in enumerate(me.vertices):
        c = curv[i]
        p = Vector(T(v.co))
        k_ = 1.0 + sstep(-.05, -.35, c) * .35 - sstep(.05, .4, c) * .45
        if strata:
            k_ *= 1 - .18 * sstep(.75, .95, abs(math.sin(p.y * strata + nz(p, 1.5) * 1.5)))
        if p.y < .02:
            k_ *= .75
        arr[i, :3] *= k_
    col.data.foreach_set('color', arr.ravel())
    bake([rk], dist=.9, strength=1.2, floor=.5)
    return finish([rk], 'Rock%d' % k, ao=False)


rock(0, (1.0, .74, 1.08), 13, 11)
rock(1, (1.2, .55, .95), 11, 23, strata=9)
rock(2, (.95, .85, 1.0), 18, 37)


# ── 草叢：十根細長草葉（兩節 + 尖端），根部深、尖端淡黃 ──
def grass():
    bm = bmesh.new()
    rnd = random.Random(7)
    cols = []
    for b in range(10):
        a = b / 10 * TAU + rnd.uniform(-.3, .3)
        h = rnd.uniform(.65, 1.2) if b % 3 else rnd.uniform(1.05, 1.35)
        out = Vector((math.cos(a), 0, math.sin(a)))
        lean = out * rnd.uniform(.12, .42) + Vector((rnd.uniform(-.1, .1), 0, rnd.uniform(-.1, .1)))
        sd = Vector((-out.z, 0, out.x))
        tw = rnd.uniform(-.5, .5)
        base = out * rnd.uniform(.02, .12)
        rows = []
        for k, t in enumerate((0, .45, .78)):
            c = base + lean * t * t + Vector((0, h * t, 0))
            w = .048 * (1 - t * .7)
            s2 = (sd + out * tw * t).normalized()
            rows.append((bm.verts.new(V(*(c - s2 * w))), bm.verts.new(V(*(c + s2 * w)))))
            cols += [mix(0x3a5a2e, 0x86a052, t * 1.2)] * 2
        tip = bm.verts.new(V(*(base + lean + Vector((0, h, 0)))))
        cols.append(0xdad890)
        for k in range(2):
            bm.faces.new((rows[k][0], rows[k][1], rows[k + 1][1], rows[k + 1][0]))
        bm.faces.new((rows[2][0], rows[2][1], tip))
    g = obj_from_bm(bm, 'Grass')
    set_cols(g, cols)
    return finish([g], 'Grass', ao=False)


grass()


# ── 花：六片杯狀花瓣（雙面，網頁用每株顏色去乘）、花心；莖上兩片葉 ──
def flower():
    bm = bmesh.new()
    cols = []
    for k in range(6):
        a = k / 6 * TAU
        d = Vector((math.cos(a), 0, math.sin(a)))
        sd = Vector((-d.z, 0, d.x))
        c0 = Vector((0, .5, 0))
        rows = [(0, 0, .0), (.07, .045, .04), (.13, .06, .075), (.17, 0, .085)]
        vv = []
        for (r, w, y) in rows:
            q = c0 + d * r + Vector((0, y, 0))
            if w == 0:
                vv.append([bm.verts.new(V(*q))])
            else:
                vv.append([bm.verts.new(V(*(q - sd * w))), bm.verts.new(V(*(q + Vector((0, -.012, 0))))), bm.verts.new(V(*(q + sd * w)))])
        for row, (r, w, y) in zip(vv, rows):
            for v in row:
                cols.append(mix((.62, .62, .62), (1, 1, 1), sstep(0, .12, r)))
        A, B, C, D = vv
        faces = [(A[0], B[1], B[0]), (A[0], B[2], B[1]), (B[0], B[1], C[1], C[0]), (B[1], B[2], C[2], C[1]), (C[0], C[1], D[0]), (C[1], C[2], D[0])]
        for f in faces:
            bm.faces.new(f)
    # 背面（反向複製）讓低角度看也有花瓣
    geom = bm.faces[:]
    ret = bmesh.ops.duplicate(bm, geom=geom)
    newf = [g for g in ret['geom'] if isinstance(g, bmesh.types.BMFace)]
    bmesh.ops.reverse_faces(bm, faces=newf)
    nv = [g for g in ret['geom'] if isinstance(g, bmesh.types.BMVert)]
    for v in nv:
        v.co.z -= .006
    cols = cols + cols[:len(nv)]
    fh = obj_from_bm(bm, 'FlowerHead', slot='c1')
    for p in fh.data.polygons:
        p.use_smooth = True
    set_cols(fh, cols)
    eye = ellipsoid('FlowerEye', (0, .525, 0), (.055, .03, .055), seg=8, rings=4)
    paint(eye, lambda p, n: mix(0xb07a2a, 0xf2cf5a, sstep(.5, .55, p[1])))
    fh2 = finish([fh, eye], 'FlowerHead', ao=False)
    st = tube('FlowerStem', [(0, 0, 0), (.03, .18, .01), (.01, .36, -.01), (0, .5, 0)], [.02, .017, .015, .014], seg=5)
    paint(st, lambda p, n: mix(0x3e6a2e, 0x6a9444, p[1] * 2))
    lb = bmesh.new()
    lc = []
    for (y, a, L) in ((.14, .4, .2), (.26, 3.5, .16)):
        d = Vector((math.cos(a), .35, math.sin(a))).normalized()
        sd = Vector((-math.sin(a), 0, math.cos(a)))
        b = Vector((.02, y, 0))
        pts = [b, b + d * L * .45 + sd * L * .22 + Vector((0, .02, 0)), b + d * L, b + d * L * .45 - sd * L * .22 + Vector((0, .02, 0)), b + d * L * .5 + Vector((0, -.01, 0))]
        vs = [lb.verts.new(V(*q)) for q in pts]
        for f in ((vs[0], vs[1], vs[4]), (vs[1], vs[2], vs[4]), (vs[2], vs[3], vs[4]), (vs[3], vs[0], vs[4])):
            lb.faces.new(f)
        lc += [0x3a6a2c, 0x6a9a44, 0x7aa84c, 0x6a9a44, 0x4f8036]
    lv = obj_from_bm(lb, 'FlowerLeaf', slot='fixed')
    set_cols(lv, lc)
    # 葉片兩面都要看得到：複製一份反向
    lv2 = lv.copy()
    lv2.data = lv.data.copy()
    bpy.context.scene.collection.objects.link(lv2)
    bm2 = bmesh.new()
    bm2.from_mesh(lv2.data)
    bmesh.ops.reverse_faces(bm2, faces=bm2.faces[:])
    bm2.to_mesh(lv2.data)
    bm2.free()
    return finish([st, lv, lv2], 'FlowerStem', ao=False)


flower()


def hull(name, pts, bevel=.04, cuts=1, slot='fixed'):
    bm = bmesh.new()
    vs = [bm.verts.new(V(*q)) for q in pts]
    bmesh.ops.convex_hull(bm, input=vs)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    if bevel:
        bmesh.ops.bevel(bm, geom=list(bm.edges), offset=bevel, segments=1, affect='EDGES', profile=.5)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    ob = obj_from_bm(bm, name, slot=slot)
    if cuts:
        dice(ob, cuts)
    return flat(ob)


def trap_block(name, r0, r1, y0, y1, a0, a1, gap=.035, bevel=.05, cuts=1, seed=0, chips=1):
    """八角環的一段梯形石塊（a0..a1 是八角形頂點的角度）"""
    pts = []
    for r in (r0, r1):
        pa, pb = Vector((math.cos(a0) * r, 0, math.sin(a0) * r)), Vector((math.cos(a1) * r, 0, math.sin(a1) * r))
        t = (pb - pa).normalized()
        pa, pb = pa + t * gap, pb - t * gap
        for q in (pa, pb):
            for y in (y0, y1):
                pts.append(Vector((q.x, y, q.z)))
    ob = hull(name, pts, bevel=bevel, cuts=cuts)
    rnd = random.Random(seed)
    for k in range(chips):
        am = rnd.uniform(a0, a1)
        n = Vector((math.cos(am), rnd.uniform(.4, 1.2), math.sin(am))).normalized()
        plane_cut(ob, Vector((math.cos(am) * r1, y1, math.sin(am) * r1)) - n * rnd.uniform(.08, .16), n)
    displace(ob, .015, 2.2, seed=seed, octaves=2)
    return ob


def crack_fn(fn, f=1.3, w=.035, seed=0, col=0x4a443a, where=None):
    """在底色上畫細細的裂縫（fbm 的等值線）"""
    def g(p, n):
        c = fn(p, n)
        if (where is None or where(p)) and abs(fbm(p, f, seed, 2)) < w:
            c = mix(c, col, .75)
        return c
    return g


# ── 水晶祭壇：八角石台（一塊塊有縫的石板）、六根分段石柱、柱頂托盤、嵌金屬環、中央蓮座 ──
def shrine():
    objs = []
    rnd = random.Random(88)
    oct_a = [k / 8 * TAU for k in range(9)]
    sfn = stone_fn(0xa39a88, 0xdcd2bc, seed=5, mossk=1.1)
    for k in range(8):
        b = trap_block('ShrineOuter', 5.02, 6.6, -.8, .25, oct_a[k], oct_a[k + 1], cuts=1, seed=k)
        am = (oct_a[k] + oct_a[k + 1]) / 2
        n = Vector((math.cos(am), 1.1, math.sin(am))).normalized()
        plane_cut(b, Vector((math.cos(am) * 5.85, .25, math.sin(am) * 5.85)), Vector((math.cos(am) * .2, .25, math.sin(am) * .2)))
        objs.append(b)
        # 內圈兩塊交錯
        am2 = oct_a[k] + math.pi / 8
        objs.append(trap_block('ShrineMid', 3.05, 5.02, -.4, .4, oct_a[k], am2, cuts=1, seed=20 + k))
        objs.append(trap_block('ShrineMid', 3.05, 5.02, -.4, .4, am2, oct_a[k + 1], cuts=1, seed=40 + k))
        objs.append(trap_block('ShrineDais', 1.55, 3.05, -.2, .55, oct_a[k], oct_a[k + 1], cuts=1, seed=60 + k, chips=0))
    hub = lathe('ShrineHub', [(1.6, -.2), (1.6, .5), (1.52, .55), (0, .55)], seg=8)
    objs.append(flat(hub))
    for o in objs:
        paint(o, crack_fn(sfn, seed=3))
    # 台階外緣的苔與小草
    # 六根石柱
    pil = []
    for i in range(6):
        a = i / 6 * TAU
        x, z = math.cos(a) * 5.4, math.sin(a) * 5.4
        P = Vector((x, 0, z))
        pil.append(chip_block('PillarBase', (x, .45, z), (1.15, .5, 1.15), bevel=.06, seed=100 + i, chips=2))
        y = .7
        hs = [.78, .74, .72]
        for d, h in enumerate(hs):
            r = .47 - d * .02
            dr = lathe('PillarDrum', [(r, 0), (r + .03, .05), (r - .02, .1), (r - .02, h - .12), (r + .02, h - .06), (r, h - .015)], seg=8,
                       pivot=(x + rnd.uniform(-.03, .03), y, z + rnd.uniform(-.03, .03)), wobble=lambda a_, yy: .03 * math.sin(a_ * 3 + yy * 5))
            dr.rotation_euler.z = rnd.uniform(0, 1)
            bpy.context.view_layer.update()
            dr.data.transform(dr.matrix_basis)
            dr.matrix_basis = Matrix.Identity(4)
            n = Vector((rnd.uniform(-1, 1), rnd.uniform(-.3, .5), rnd.uniform(-1, 1))).normalized()
            plane_cut(dr, P + Vector((0, y + h * rnd.uniform(.3, .8), 0)) + n * r * .88, n)
            pil.append(flat(dr))
            y += h + .012
        pil.append(chip_block('PillarCap', (x, y + .14, z), (1.12, .28, 1.12), bevel=.05, seed=130 + i, chips=2))
        cup = lathe('Cup', [(.2, y + .28), (.34, y + .36), (.44, y + .52), (.46, y + .6), (.38, y + .62), (.28, y + .52), (.12, y + .5)], seg=10, pivot=(x, 0, z), cap_top=True)
        paint(cup, lambda p, n: mix(0x5a4a38, 0x9c7c4a, n[1] * .4 + .5 + fbm(p, 4) * .3))
        pil.append(cup)
    pf = stone_fn(0xa1988a, 0xd8cfbb, seed=9, mossk=.9, mossy=lambda p, n: sstep(1.3, .5, p[1]) * sstep(0, .35, fbm(p, 1.4, 12)))
    for o in pil:
        if not o.name.startswith('Cup'):
            paint(o, crack_fn(pf, f=1.6, seed=7, w=.03))
    objs += pil
    ring = lathe('ShrineRing', [(2.6, .53), (2.62, .6), (2.66, .64), (2.74, .64), (2.78, .6), (2.8, .53)], seg=48, cap_top=False, cap_bot=False)
    paint(ring, lambda p, n: mix(0x8a6c3a, 0xd6bc84, .5 + n[1] * .4 + fbm(p, 3) * .3))
    objs.append(ring)
    seat = lathe('GemSeat', [(1.55, .5), (1.5, .72), (1.36, .78), (1.3, .92), (1.08, 1.02), (1.02, 1.12), (1.2, 1.22), (1.22, 1.34), (1.02, 1.42), (.6, 1.45), (0, 1.45)], seg=8)
    flat(seat)
    paint(seat, crack_fn(stone_fn(0xaaa08e, 0xe2d8c2, seed=4, mossk=.6, lich=.5), seed=11))
    objs.append(seat)
    # 刻紋：座台邊一圈凸起的方塊紋
    for k in range(16):
        a = (k + .5) / 16 * TAU
        c = (math.cos(a) * 1.38, .84, math.sin(a) * 1.38)
        g = rbox('Glyph', (0, 0, 0), (.18, .1, .06), bevel=0)
        g.data.transform(Matrix.Translation(V(*c)) @ Matrix.Rotation(-a + math.pi / 2, 4, 'Z'))
        paint(g, lambda p, n: mix(0x8a8272, 0xbdb39e, .5 + n[1] * .5))
        objs.append(g)
    # 散落的小石與苔
    for k in range(7):
        a = rnd.uniform(0, TAU)
        r = rnd.uniform(6.7, 7.4)
        sz = rnd.uniform(.25, .5)
        b = chip_block('Rubble', (math.cos(a) * r, sz * .3, math.sin(a) * r), (sz, sz * .7, sz * 1.2), bevel=.04, seed=200 + k, chips=2, cuts=0)
        paint(b, stone_fn(0x958d80, 0xcfc5b0, seed=k, mossk=1.3))
        objs.append(b)
    bake(objs, dist=1.2, floor=.5)
    return finish(objs, 'Shrine', ao=False)


shrine()


# ── 寶石：主晶柱 + 四根小晶柱（同一個網格、同一個 flat 材質：網頁點亮時會整個換材質） ──
def gem():
    parts = []
    main = lathe('Gem', [(0, 0), (.85, .75), (1.15, 1.5), (1.08, 3.05), (.5, 3.9), (0, 4.4)], seg=6)
    parts.append(main)
    rnd = random.Random(5)
    for k in range(4):
        a = k / 4 * TAU + .4
        h = rnd.uniform(1.1, 1.7)
        c = lathe('GemS', [(0, 0), (.32, .25), (.36, h * .7), (0, h)], seg=6)
        tilt = Matrix.Rotation(rnd.uniform(.35, .55), 4, Vector((math.sin(a), math.cos(a), 0)))
        c.data.transform(Matrix.Translation(V(math.cos(a) * .75, .15, math.sin(a) * .75)) @ tilt)
        parts.append(c)
    for o in parts:
        o.data.materials[0] = mat('flat')
        flat(o)
        paint(o, lambda p, n: mix((.55, .55, .62), (1, 1, 1), sstep(0, 4.4, p[1]) * .55 + max(0, n[0] * .7 + n[2] * .3) * .45))
    return finish(parts, 'Gem', ao=False)


gem()
cage = ico('GemShell', (0, 2.2, 0), (1.9, 2.9, 1.9), sub=2, slot='shell')
displace(cage, .12, .8, seed=4, octaves=2)
flat(cage)
paint(cage, lambda p, n: mix(0x6d6878, 0xa9a3b4, .5 + n[1] * .4))
finish([cage], 'GemShell', ao=False)


# ── 寶箱：一片片木板、角柱、鐵箍與鉚釘、角鐵、側提環、金鎖；蓋子另一個物件，原點在鉸鏈 ──
def chest():
    body, lidp = [], []
    wd = wood_fn(0x9a6436, 0x5a3418, axis=0, k=26)
    wdz = wood_fn(0x9a6436, 0x5a3418, axis=2, k=26)
    dk = wood_fn(0x6a4226, 0x3a2412, axis=1)
    inner = rbox('ChestInner', (0, .6, 0), (1.84, 1.0, 1.24), bevel=.02, seg=1)
    paint(inner, lambda p, n: 0x3a2616 if n[1] > .5 else 0x5a3a22)
    body.append(inner)
    for k in range(3):
        y = .08 + k * .345 + .17
        for zs in (-1, 1):
            b = rbox('Plank', (0, y, zs * .66), (1.86, .33, .1), bevel=.03, seg=1)
            dice(b, 1)
            paint(b, wd)
            body.append(b)
        for xs in (-1, 1):
            b = rbox('Plank', (xs * .95, y, 0), (.1, .33, 1.26), bevel=.03, seg=1)
            dice(b, 1)
            paint(b, wdz)
            body.append(b)
    bot = rbox('Bottom', (0, .05, 0), (1.9, .1, 1.36), bevel=.02, seg=1)
    paint(bot, dk)
    body.append(bot)
    for xs in (-1, 1):
        for zs in (-1, 1):
            p = rbox('Post', (xs * .96, .56, zs * .67), (.16, 1.12, .16), bevel=.03, seg=1)
            paint(p, dk)
            body.append(p)
            f = rbox('Foot', (xs * .9, -.02, zs * .6), (.22, .1, .22), bevel=.02, seg=1)
            paint(f, dk)
            body.append(f)
            for y in (.1, 1.02):
                for ax in (0, 1):
                    br = rbox('Bracket', (xs * (1.045 if ax == 0 else .88), y, zs * (.6 if ax == 0 else .755)), (.03 if ax == 0 else .26, .18, .26 if ax == 0 else .03), bevel=.008, seg=1)
                    paint(br, iron)
                    body.append(br)
    for x in (-.55, .55):
        for zs in (-1, 1):
            b = rbox('Band', (x, .56, zs * .74), (.16, 1.12, .035), bevel=.01, seg=1)
            paint(b, iron)
            body.append(b)
            body += rivets('Rivet', [(x, .15 + j * .21, zs * .765) for j in range(5)], r=.035)
    for xs in (-1, 1):
        h = tube('Handle', [(xs * 1.06, .78, -.22), (xs * 1.16, .66, -.18), (xs * 1.18, .56, 0), (xs * 1.16, .66, .18), (xs * 1.06, .78, .22)], .03, seg=6)
        paint(h, iron)
        body.append(h)
        for zz in (-.22, .22):
            pl = rbox('HandlePlate', (xs * 1.03, .8, zz), (.03, .14, .1), bevel=.01, seg=1)
            paint(pl, iron)
            body.append(pl)
    lock = rbox('ChestLock', (0, .88, .74), (.36, .36, .06), bevel=.03, seg=2)
    paint(lock, lambda p, n: 0x2a1e12 if (n[2] > .8 and abs(p[0]) < .04 and .8 < p[1] < .92) else gold(p, n))
    body.append(lock)
    body += rivets('LockRivet', [(sx * .13, .88 + sy * .13, .775) for sx in (-1, 1) for sy in (-1, 1)], r=.025, fn=gold)
    # 蓋子：實心的半圓拱（壓扁 .85），木板縫用顏色畫；兩端封板、兩道鐵箍、前緣鎖扣
    hc, Ry, Rz = Vector((0, 1.1, 0)), .6, .7
    lid = tube('LidStaves', [(-.99, 0, 0), (-.5, 0, 0), (0, 0, 0), (.5, 0, 0), (.99, 0, 0)], .7, seg=28, flat=1.0, up=(0, 0, -1))
    each_vert(lid, lambda p: (p[0], hc.y + max(p[1], 0) * Ry / .7, p[2]))

    def lidwood(p, n):
        c = wd(p, n)
        t = math.atan2(p[1] - hc.y, p[2] / Rz * Ry)
        if abs(p[0]) < .97 and abs(((t / math.pi) * 7) % 1 - .5) > .44 and p[1] > hc.y + .02:
            c = mix(c, 0x2e1a0c, .8)
        if abs(p[0]) > .97:
            c = dk(p, n)
        return c
    paint(lid, lidwood)
    lidp.append(lid)
    for x in (-.55, .55):
        pts = [(x, hc.y + math.sin(t) * (Ry + .025), hc.z + math.cos(t) * (Rz + .025)) for t in [i / 10 * math.pi for i in range(11)]]
        b = tube('LidBand', pts, .03, seg=6, flat=2.7, up=(1, 0, 0))
        paint(b, iron)
        lidp.append(b)
        lidp += rivets('LidRivet', [(x, hc.y + math.sin(t) * (Ry + .045), hc.z + math.cos(t) * (Rz + .045)) for t in (.3, .9, 1.57, 2.25, 2.85)], r=.03)
    has = rbox('Hasp', (0, 1.06, .745), (.2, .26, .04), bevel=.02, seg=1)
    paint(has, gold)
    lidp.append(has)
    world_ao(.6)
    cb = join(body, 'Chest')
    ld = join(lidp, 'ChestLid')
    if AO:
        ao_bake([cb, ld], samples=AO, strength=1.1, floor=.5)
    origin_to(cb, (0, 0, 0))
    origin_to(ld, (0, 1.1, -.7))
    ALL.append(cb)
    ALL.append(ld)
    print('Chest tris', tri_count([cb]), 'ChestLid tris', tri_count([ld]))
    set_parent(ld, cb)
    park(cb)
    return cb, ld


cb, ld = chest()


# ── 遺跡入口：崩角的石塊柱、刻紋門楣、斷裂的簷石、垂下的藤蔓與葉片、倒下的石塊與碎石、台階 ──
def arch():
    objs = []
    rnd = random.Random(64)
    sf = stone_fn(0x9a9282, 0xd6ccb6, seed=2, mossk=1.2, mossy=lambda p, n: sstep(1.2, .2, p[1]) * sstep(-.1, .3, fbm(p, 1.1, 6)))
    for s in (-1, 1):
        objs.append(chip_block('ArchPlinth', (s * 3.2, .3, 0), (2.25, .6, 2.25), bevel=.1, seed=s + 5, chips=3, cuts=2))
        y = .6
        for k in range(4):
            w = 1.82 - k * .06
            h = 1.56 + rnd.uniform(-.06, .06)
            if k == 3:
                h = 6.85 - y
            objs.append(chip_block('ArchBlock', (s * 3.2 + rnd.uniform(-.06, .06), y + h / 2, rnd.uniform(-.05, .05)), (w, h - .03, w), bevel=.1, seed=k * 7 + s * 3 + 20, chips=3, cuts=1, amp=.035))
            y += h
    lt = chip_block('Lintel', (0, 7.6, 0), (9.2, 1.5, 2.2), bevel=.14, seed=77, chips=4, cuts=5, amp=.03)
    objs.append(lt)
    for s in (-1, 1):
        md = lathe('Medallion', [(.5, 0), (.52, .06), (.44, .1), (.3, .09), (.26, .12), (0, .12)], seg=16)
        md.data.transform(Matrix.Translation(V(s * 2.65, 7.55, 1.08)) @ Matrix.Rotation(math.pi / 2, 4, 'X'))
        flat(md)
        objs.append(md)
        for k in range(6):
            a = k / 6 * TAU
            objs.append(rbox('Ray', (s * 2.65 + math.cos(a) * .72, 7.55 + math.sin(a) * .5, 1.12), (.18, .1, .06), bevel=.02, seg=1))
    for k in range(3):
        x = -2.9 + k * 2.4 + rnd.uniform(-.1, .1)
        if k == 2:
            continue
        objs.append(chip_block('LintelTop', (x, 8.6, rnd.uniform(-.05, .05)), (2.3, .5, 1.8), bevel=.08, seed=90 + k, chips=3, cuts=1))
    objs.append(chip_block('LintelTop', (3.0, 8.52, .1), (1.3, .36, 1.6), bevel=.08, seed=99, chips=4, cuts=1))
    # 倒下的簷石與碎石
    fb = chip_block('Fallen', (0, 0, 0), (2.2, .5, 1.7), bevel=.08, seed=95, chips=4, cuts=1)
    fb.data.transform(Matrix.Translation(V(5.6, .42, 1.4)) @ Matrix.Rotation(.5, 4, 'Z') @ Matrix.Rotation(.25, 4, 'Y'))
    objs.append(fb)
    for k in range(6):
        sz = rnd.uniform(.25, .55)
        a = rnd.choice((-1, 1))
        objs.append(chip_block('Rubble', (a * rnd.uniform(4.3, 5.4), sz * .3, rnd.uniform(-1.6, 1.8)), (sz * 1.2, sz * .7, sz), bevel=.04, seed=300 + k, chips=2, cuts=0))
    for k, x in enumerate((-1.6, 1.5)):
        st = chip_block('Step', (x, .12, 1.75), (2.9, .3, 1.3), bevel=.06, seed=400 + k, chips=3, cuts=2)
        objs.append(st)
    for o in objs:
        paint(o, crack_fn(sf, f=.9, w=.025, seed=8, where=lambda p: p[1] > 1))
    # 藤蔓：從門楣前緣垂下
    cards = Cards('ArchIvy')
    vines = []
    for k in range(9):
        x = -4.2 + k * 1.05 + rnd.uniform(-.25, .25)
        if abs(x) < 1.5:
            continue
        ln = rnd.uniform(1.3, 3.4)
        pts = [(x, 8.3, 1.02), (x + .05, 7.0, 1.2), (x + rnd.uniform(-.2, .2), 7.0 - ln * .5, 1.24), (x + rnd.uniform(-.3, .3), 7.0 - ln, 1.2)]
        v = tube('Vine', pts, [.06, .05, .04, .02], seg=5)
        paint(v, lambda p, n: mix(0x3e5a28, 0x6a7c3a, fbm(p, 3) + .5))
        vines.append(v)
        for j in range(int(ln * 2.2) + 2):
            t = j / (ln * 2.2 + 1)
            q = Vector(pts[1]).lerp(Vector(pts[3]), t) + Vector((rnd.uniform(-.2, .2), rnd.uniform(-.1, .1), .1))
            Fc = Vector((rnd.uniform(-.5, .5), rnd.uniform(-.2, .4), 1)).normalized()
            jc = rnd.uniform(-.1, .1)
            cards.add(q, Fc, rnd.uniform(.35, .5), roll=rnd.uniform(0, TAU), bend=.15,
                      colfn=lambda qq, t=t, jc=jc: mix(0x3a5a26, 0x86a04a, .6 - t * .4 + jc), nfn=lambda qq, Fc=Fc: (Fc + Vector((0, .4, 0))).normalized())
    # 門楣頂上長出來的一叢叢葉子
    for k in range(10):
        x = rnd.choice((-1, 1)) * rnd.uniform(2.6, 4.4)
        q = Vector((x, 8.85 + rnd.uniform(-.1, .2), rnd.uniform(-.8, 1.0)))
        Fc = Vector((rnd.uniform(-.6, .6), 1, rnd.uniform(-.6, .6))).normalized()
        jc = rnd.uniform(.2, .7)
        cards.add(q, Fc, rnd.uniform(.45, .7), roll=rnd.uniform(0, TAU), bend=.2, colfn=lambda qq, jc=jc: mix(0x4a6a2c, 0x9ab052, jc), nfn=lambda qq, Fc=Fc: Fc)
    bake(objs + vines, dist=1.2, floor=.5)
    iv = cards.build()
    parts = objs + vines + [iv]
    ensure_uv(parts)
    ob = finish(parts, 'Arch', ao=False)
    apply_cn(ob)
    return ob


arch()


def obox(name, a, b, w=.2, t=.16, normal=(0, 0, 1), bevel=.025, slot='fixed'):
    """從 a 到 b 的方木（寬 w 沿牆面、厚 t 沿 normal）"""
    a, b = Vector(a), Vector(b)
    X = (b - a)
    L = X.length
    X.normalize()
    Z = Vector(normal)
    Z = (Z - X * Z.dot(X)).normalized()
    Y = Z.cross(X)
    M = Matrix((
        (X.x, Y.x, Z.x), (X.y, Y.y, Z.y), (X.z, Y.z, Z.z)))
    ob = rbox(name, (0, 0, 0), (L, w, t), bevel=bevel, seg=1, slot=slot)
    mid = (a + b) / 2
    # rbox 以 three 座標建立；把 three 的局部軸換成 X/Y/Z，再轉回 Blender
    each_vert(ob, lambda p: tuple(mid + M @ Vector(p)))
    return ob


def splat_fn(fn, spl):
    def g(p, n):
        for (c, q, r, nd) in spl:
            if Vector(n).dot(nd) > .7 and (Vector(p) - q).length < r * (1 + .35 * nz(Vector(p) * 5)):
                return c
        return fn(p, n)
    return g


# ── 畫室小屋：石砌基座、灰泥牆與木構架、陶瓦兩坡屋頂（有厚度、屋脊瓦）、石砌煙囪、
#    木板門（鐵鉸鏈、門環）、窗框與百葉、窗台花箱、柴堆與木桶 ──
def hut():
    rnd = random.Random(188)
    objs = []
    X0, Z0 = 3.4, 2.9          # 牆面半寬
    sf = stone_fn(0x8a8276, 0xc4baa6, seed=12, mossk=1.3, mossy=lambda p, n: sstep(.35, -.1, p[1]) * sstep(-.2, .3, fbm(p, 1.3, 2)))
    # 石砌基座：一圈大小不一的石塊
    core = rbox('Plinth', (0, .15, 0), (2 * X0 + .1, .9, 2 * Z0 + .1), bevel=.02, seg=1)
    paint(core, lambda p, n: 0x5a554c)
    objs.append(core)
    for (ax, sgn) in ((0, 1), (0, -1), (2, 1), (2, -1)):
        half = X0 + .18 if ax == 0 else Z0 + .18
        u = -half
        while u < half - .1:
            L = min(rnd.uniform(.7, 1.3), half - u)
            for row, (y0, h) in enumerate(((-.3, .5), (.2, .42))):
                off = (.25 if row else 0)
                uu, LL = u + (off if row else 0), L
                if row and uu + LL > half:
                    LL = half - uu
                if LL < .2:
                    continue
                c = [0, y0 + h / 2, 0]
                if ax == 0:
                    c[0], c[2] = uu + LL / 2, sgn * (Z0 + .12)
                    sz = (LL - .04, h - .04, .36)
                else:
                    c[2], c[0] = uu + LL / 2, sgn * (X0 + .12)
                    sz = (.36, h - .04, LL - .04)
                objs.append(chip_block('PlinthStone', tuple(c), sz, bevel=.06, seed=rnd.randint(0, 9999), chips=1, cuts=0, amp=.02))
            u += L
    for o in objs[1:]:
        paint(o, sf)
    # 灰泥牆
    wall = rbox('HutWall', (0, 2.5, 0), (2 * X0, 3.8, 2 * Z0), bevel=.06, seg=1)
    dice(wall, 6)
    displace(wall, .025, 1.2, seed=5, octaves=2)
    spl = []
    for k in range(7):
        c = rnd.choice([0xc0584a, 0x4a82b8, 0xd8b04a, 0x5a9a5a, 0x8a5aa8])
        if k < 5:
            spl.append((c, Vector((rnd.uniform(-3, 3), rnd.uniform(.9, 2.2), Z0)), rnd.uniform(.12, .24), Vector((0, 0, 1))))
        else:
            spl.append((c, Vector((X0, rnd.uniform(.9, 2.4), rnd.uniform(-2, 2))), rnd.uniform(.12, .22), Vector((1, 0, 0))))

    def plaster(p, n):
        c = mix(0xdcd0b6, 0xf2e8d2, .5 + fbm(p, 1.4, 3) * .6)
        c = mix(c, 0xb8a888, sstep(1.4, .6, p[1]) * .6)
        if fbm(p, .9, 17) > .32 and p[1] < 3.8:
            c = mix(c, mix(0x9a8a74, 0xb8a48a, nz(p, 6) + .5), .75)
        return c
    paint(wall, splat_fn(plaster, spl))
    objs.append(wall)
    # 木構架
    dw = wood_fn(0x6e4a30, 0x3e2818, axis=1, k=30)
    tim = []
    for xs in (-1, 1):
        for zs in (-1, 1):
            tim.append(rbox('Post', (xs * (X0 + .02), 2.5, zs * (Z0 + .02)), (.3, 3.8, .3), bevel=.03, seg=1))
    for zs in (-1, 1):
        n = (0, 0, zs)
        tim.append(obox('Beam', (-X0, .72, zs * (Z0 + .04)), (X0, .72, zs * (Z0 + .04)), .22, .14, n))
        tim.append(obox('Beam', (-X0, 4.28, zs * (Z0 + .04)), (X0, 4.28, zs * (Z0 + .04)), .26, .16, n))
    for xs in (-1, 1):
        n = (xs, 0, 0)
        tim.append(obox('Beam', (xs * (X0 + .04), .72, -Z0), (xs * (X0 + .04), .72, Z0), .22, .14, n))
        tim.append(obox('Beam', (xs * (X0 + .04), 4.28, -Z0), (xs * (X0 + .04), 4.28, Z0), .26, .16, n))
        tim.append(obox('Beam', (xs * (X0 + .04), 2.5, -Z0), (xs * (X0 + .04), 2.5, Z0), .2, .12, n))
        for zs in (-1, 1):
            tim.append(obox('Brace', (xs * (X0 + .04), .82, zs * (Z0 - .1)), (xs * (X0 + .04), 2.42, zs * .9), .18, .12, n))
            tim.append(obox('Brace', (xs * (X0 + .04), 2.58, zs * .9), (xs * (X0 + .04), 4.18, zs * (Z0 - .1)), .18, .12, n))
    # 前牆：門框、窗下橫木、斜撐
    F = Z0 + .04
    for xs in (-1, 1):
        tim.append(obox('Beam', (xs * 1.05, .82, F), (xs * 1.05, 4.2, F), .22, .14, (0, 0, 1)))
        tim.append(obox('Beam', (xs * 1.05, 1.75, F), (xs * (X0 - .1), 1.75, F), .2, .12, (0, 0, 1)))
        tim.append(obox('Brace', (xs * 1.15, 3.35, F), (xs * 1.9, 4.18, F), .16, .12, (0, 0, 1)))
        tim.append(obox('Beam', (xs * 1.05, .82, -F), (xs * 1.05, 4.2, -F), .22, .14, (0, 0, -1)))
        tim.append(obox('Brace', (xs * 1.15, .82, -F), (xs * (X0 - .1), 2.5, -F), .18, .12, (0, 0, -1)))
    tim.append(obox('Beam', (-X0, 2.5, -F), (X0, 2.5, -F), .2, .12, (0, 0, -1)))
    tim.append(obox('Lintel', (-1.2, 3.05, F + .02), (1.2, 3.05, F + .02), .26, .18, (0, 0, 1)))
    for o in tim:
        paint(o, dw)
    objs += tim
    # 屋頂：兩坡，屋簷 y4.35、屋脊 y7.7；外挑 .7（前後）與 .55（兩側）
    ye, yr, ze, xe = 4.35, 7.7, Z0 + .75, X0 + .6
    L = math.hypot(ze, yr - ye)
    tiles = bmesh.new()
    tcols = []
    NR = 10
    for side in (1, -1):
        dn = Vector((0, -(yr - ye), side * ze)).normalized()     # 沿坡往下
        nrm = Vector((0, ze, side * (yr - ye))).normalized()     # 坡面法線
        top = Vector((0, yr + .12, 0))
        for r in range(NR):
            t0, t1 = r / NR, (r + 1.12) / NR
            NS = 34
            rowv = []
            for j in range(NS + 1):
                x = -xe + j / NS * 2 * xe
                bump = .07 if j % 2 else 0
                a_ = top + dn * L * t0 + Vector((x, 0, 0)) + nrm * (.2 + bump * .5)
                b_ = top + dn * L * min(t1, 1.02) + Vector((x, 0, 0)) + nrm * (.2 + bump + .06)
                c_ = b_ - nrm * .09
                rowv.append((tiles.verts.new(V(*a_)), tiles.verts.new(V(*b_)), tiles.verts.new(V(*c_))))
                tile = j // 2
                jt = (hash((r, tile, side)) % 1000) / 1000
                moss = sstep(.42, .75, fbm(Vector((x, r * .5, side * 3)), .7, 21)) * .55
                for q, k in ((a_, .55), (b_, 1.0), (c_, .45)):
                    cc = mix(0x8a4630, 0xc2704a, .25 + jt * .45 + (.2 if j % 2 else 0))
                    cc = mix(cc, 0x6c7a3a, moss * (1 if k > .5 else .5))
                    tcols.append(mix((0, 0, 0), cc, .55 + k * .45))
            for j in range(NS):
                A, B = rowv[j], rowv[j + 1]
                f1 = (A[0], B[0], B[1], A[1]) if side > 0 else (A[0], A[1], B[1], B[0])
                f2 = (A[1], B[1], B[2], A[2]) if side > 0 else (A[1], A[2], B[2], B[1])
                tiles.faces.new(f1)
                tiles.faces.new(f2)
    bmesh.ops.recalc_face_normals(tiles, faces=tiles.faces)
    rt = obj_from_bm(tiles, 'RoofTiles', slot='cloth2s')
    set_cols(rt, tcols)
    objs.append(rt)
    # 屋面底板（有厚度）與封簷板
    rw = wood_fn(0x5e4028, 0x38241a, axis=0)
    for side in (1, -1):
        deck = hull('RoofDeck', [Vector((x, yr + .02, 0)) for x in (-xe, xe)] + [Vector((x, ye - .02, side * ze)) for x in (-xe, xe)] +
                    [Vector((x, yr - .2, 0)) for x in (-xe, xe)] + [Vector((x, ye - .22, side * ze)) for x in (-xe, xe)], bevel=.02, cuts=0)
        paint(deck, rw)
        objs.append(deck)
        objs.append(obox('Fascia', (-xe - .05, ye - .05, side * (ze + .03)), (xe + .05, ye - .05, side * (ze + .03)), .3, .08, (0, 0, side)))
        for xs in (-1, 1):
            objs.append(obox('Barge', (xs * (xe + .04), ye - .05, side * (ze + .02)), (xs * (xe + .04), yr + .12, 0), .3, .1, (xs, 0, 0)))
    for o in objs[-8:]:
        paint(o, rw)
    ridge = tube('Ridge', [(-xe - .1, yr + .3, 0), (xe + .1, yr + .3, 0)], .2, seg=10, flat=1.0)
    each_vert(ridge, lambda p: (p[0], max(p[1], yr + .2), p[2]))
    paint(ridge, lambda p, n: mix(0x7a3c28, 0xb0664a, .4 + n[1] * .4 + (.2 if int((p[0] + 5) * 2.2) % 2 else 0)))
    objs.append(ridge)
    # 山牆：三角灰泥 + 中柱與橫木
    for xs in (-1, 1):
        g = hull('Gable', [Vector((xs * X0, ye, -Z0)), Vector((xs * X0, ye, Z0)), Vector((xs * X0, yr - .1, 0)),
                           Vector((xs * (X0 - .2), ye, -Z0)), Vector((xs * (X0 - .2), ye, Z0)), Vector((xs * (X0 - .2), yr - .1, 0))], bevel=0, cuts=3)
        paint(g, plaster)
        objs.append(g)
        n = (xs, 0, 0)
        gt = [obox('Beam', (xs * (X0 + .04), ye, 0), (xs * (X0 + .04), yr - .2, 0), .22, .14, n),
              obox('Beam', (xs * (X0 + .04), 5.9, -1.55), (xs * (X0 + .04), 5.9, 1.55), .2, .12, n)]
        for o in gt:
            paint(o, dw)
        objs += gt
        rw_ = lathe('GableWin', [(.34, 0), (.34, .1), (.26, .12), (0, .08)], seg=12)
        rw_.data.transform(Matrix.Translation(V(xs * (X0 + .02), 5.0, 0)) @ Matrix.Rotation(-xs * math.pi / 2, 4, 'Y'))
        paint(rw_, lambda p, n: 0x3e4e5a if abs(n[0]) > .9 else 0x5e4028)
        objs.append(rw_)
    # 煙囪：後坡上，一層層石塊 + 蓋石 + 煙囪帽
    cx, cz = 2.0, -1.45
    y = 5.3
    for k in range(6):
        h = .5
        objs.append(chip_block('Chimney', (cx + rnd.uniform(-.03, .03), y + h / 2, cz + rnd.uniform(-.03, .03)), (1.0 - k * .02, h - .03, 1.0 - k * .02), bevel=.05, seed=500 + k, chips=2, cuts=0))
        paint(objs[-1], stone_fn(0x8a8074, 0xc0b6a2, seed=k, mossk=.6))
        y += h
    objs.append(chip_block('ChimneyCap', (cx, y + .08, cz), (1.2, .16, 1.2), bevel=.04, seed=520, chips=2, cuts=1))
    paint(objs[-1], stone_fn(0x7e766a, 0xb2a894, seed=3, mossk=1.4))
    pot = lathe('ChimneyPot', [(.26, y + .1), (.26, y + .45), (.3, y + .5), (.3, y + .56), (.22, y + .56), (.2, y + .3)], seg=10, cap_top=False, cap_bot=False)
    paint(pot, lambda p, n: mix(0x7a4a34, 0xa86a4a, .5 + n[1] * .3) if p[1] < y + .5 else 0x2a2420)
    objs.append(pot)
    # 門：五片直木板 + 兩條橫檔 + 鐵鉸鏈 + 門環；門前兩級石階
    dz = Z0 + .08
    door = []
    for k in range(5):
        x = -.72 + k * .36
        pl = rbox('DoorPlank', (x, 1.93, dz), (.34, 2.2, .08), bevel=.02, seg=1)
        door.append(pl)
    for y in (1.2, 2.6):
        door.append(rbox('DoorBatten', (0, y, dz + .07), (1.7, .18, .06), bevel=.02, seg=1))
    for o in door:
        paint(o, wood_fn(0x8a5a34, 0x4e3220, axis=1, k=34))
    hw = []
    for y in (1.2, 2.6):
        hw.append(rbox('Hinge', (-.35, y, dz + .115), (1.1, .1, .025), bevel=.008, seg=1))
        hw += rivets('Nail', [(-.8 + j * .25, y, dz + .13) for j in range(4)], r=.025)
    ring = tube('DoorRing', [(.5 + .1 * math.cos(a), 1.85 + .1 * math.sin(a) - .1, dz + .14) for a in [i / 10 * TAU for i in range(11)]], .018, seg=5)
    hw.append(ring)
    hw.append(rbox('RingPlate', (.5, 1.85, dz + .115), (.14, .14, .02), bevel=.01, seg=1))
    for o in hw:
        paint(o, iron)
    objs += door + hw
    for k, (z, y, w) in enumerate(((Z0 + .55, .45, 1.9), (Z0 + 1.05, .2, 2.2))):
        st = chip_block('DoorStep', (rnd.uniform(-.05, .05), y - .15, z), (w, .32, .55), bevel=.05, seed=600 + k, chips=2, cuts=1)
        paint(st, sf)
        objs.append(st)
    # 窗：框、十字窗櫺、玻璃、百葉、花箱
    wz = Z0 + .05
    cards = Cards('HutLeaves')
    for wx in (-2.25, 2.25):
        wy = 2.6
        glass = rbox('Glass', (wx, wy, wz), (1.0, .95, .04), bevel=0)
        dice(glass, 2)
        paint(glass, lambda p, n, wx=wx: mix(0x44586a, 0x8ea8b8, sstep(-.05, .45, (p[1] - 2.6) - (p[0] - wx) * .6) * .45))
        objs.append(glass)
        fr = [obox('WinFrame', (wx - .6, wy - .55, wz + .05), (wx + .6, wy - .55, wz + .05), .14, .16, (0, 0, 1)),
              obox('WinFrame', (wx - .6, wy + .55, wz + .05), (wx + .6, wy + .55, wz + .05), .14, .12, (0, 0, 1)),
              obox('WinFrame', (wx - .55, wy - .5, wz + .05), (wx - .55, wy + .5, wz + .05), .12, .12, (0, 0, 1)),
              obox('WinFrame', (wx + .55, wy - .5, wz + .05), (wx + .55, wy + .5, wz + .05), .12, .12, (0, 0, 1)),
              obox('Mullion', (wx, wy - .48, wz + .04), (wx, wy + .48, wz + .04), .06, .06, (0, 0, 1)),
              obox('Mullion', (wx - .5, wy, wz + .04), (wx + .5, wy, wz + .04), .06, .06, (0, 0, 1))]
        for o in fr:
            paint(o, wood_fn(0xd8ccb0, 0xa89a80, axis=0))
        objs += fr
        for s in (-1, 1):
            sx = wx + s * .88
            sh = [rbox('Shutter', (sx - .1 + j * .1 - .0, wy, wz + .06), (.095, 1.08, .05), bevel=.012, seg=1) for j in range(3)]
            sh.append(obox('ShutterZ', (sx - .12, wy - .4, wz + .1), (sx + .12, wy + .4, wz + .1), .08, .03, (0, 0, 1)))
            for o in sh:
                paint(o, lambda p, n: mix(0x3e6a6e, 0x6a9a96, .5 + fbm(p, 3, 7) * .6 + n[1] * .2))
            objs += sh
        box = rbox('FlowerBox', (wx, 1.98, wz + .22), (1.3, .3, .34), bevel=.03, seg=1)
        dice(box, 1)
        paint(box, wood_fn(0x7a5234, 0x4a3020, axis=0))
        objs.append(box)
        soil = rbox('Soil', (wx, 2.12, wz + .22), (1.2, .04, .26), bevel=0)
        paint(soil, lambda p, n: 0x3a2a1c)
        objs.append(soil)
        for k in range(7):
            q = Vector((wx - .55 + k * .18 + rnd.uniform(-.04, .04), 2.28 + rnd.uniform(0, .12), wz + .22 + rnd.uniform(-.08, .12)))
            Fc = Vector((rnd.uniform(-.6, .6), 1, rnd.uniform(0, .8))).normalized()
            jc = rnd.uniform(0, .4)
            cards.add(q, Fc, rnd.uniform(.16, .24), roll=rnd.uniform(0, TAU), bend=.2, colfn=lambda qq, jc=jc: mix(0x3e6a2c, 0x86a84a, jc + .2), nfn=lambda qq, Fc=Fc: Fc)
        fc = rnd.choice([(0xc4504a, 0xe8d8c8), (0xd8a83a, 0x9a6ab8), (0xe8e0d0, 0xc4504a)])
        for k in range(6):
            q = (wx - .5 + k * .2 + rnd.uniform(-.04, .04), 2.4 + rnd.uniform(0, .14), wz + .2 + rnd.uniform(-.06, .1))
            fl = ellipsoid('BoxFlower', q, (.07, .05, .07), seg=6, rings=4)
            c = fc[k % 2]
            paint(fl, lambda p, n, c=c: mix(mix(c, 0x000000, .25), c, n[1] * .5 + .5))
            objs.append(fl)
    # 側牆小窗（右側）
    sw = rbox('Glass', (X0 + .05, 2.9, -.2), (.04, .7, .7), bevel=0)
    paint(sw, lambda p, n: mix(0x44586a, 0x7e98a8, sstep(2.7, 3.2, p[1])))
    objs.append(sw)
    for o in (obox('WinFrame', (X0 + .1, 2.52, -.62), (X0 + .1, 2.52, .22), .12, .14, (1, 0, 0)), obox('WinFrame', (X0 + .1, 3.28, -.62), (X0 + .1, 3.28, .22), .12, .12, (1, 0, 0)),
              obox('WinFrame', (X0 + .1, 2.52, -.58), (X0 + .1, 3.28, -.58), .1, .12, (1, 0, 0)), obox('WinFrame', (X0 + .1, 2.52, .18), (X0 + .1, 3.28, .18), .1, .12, (1, 0, 0))):
        paint(o, wood_fn(0xd8ccb0, 0xa89a80, axis=0))
        objs.append(o)
    # 柴堆（左側牆邊）與木桶（右前角）
    for row in range(3):
        for k in range(4 - row):
            z = -1.6 + k * .42 + row * .21 + 1.0
            y = .2 + row * .36
            lg2 = tube('Log', [(-X0 - .95, y, z), (-X0 - .15, y, z)], .18 + rnd.uniform(-.02, .02), seg=8)
            paint(lg2, lambda p, n: mix(0xc8a878, 0xe0c498, .5 + nz(Vector(p) * 8) * .4) if abs(n[0]) > .8 else bark_fn(0x6a5440, 0x3e3024)(p, n))
            objs.append(lg2)
    brl = lathe('Barrel', [(.42, 0), (.5, .15), (.56, .5), (.5, .85), (.42, 1.0), (.38, .98)], seg=14, pivot=(X0 + .75, 0, Z0 + .4), cap_top=True)
    paint(brl, lambda p, n: iron(p, n) if (abs(p[1] - .15) < .05 or abs(p[1] - .85) < .05) else (0x2e3a44 if p[1] > .97 else wood_fn(0x8a5a34, 0x4e3220, axis=1, k=40)(p, n)))
    objs.append(brl)
    for k in range(3):
        a = k * 2.1
        b = tube('Brush', [(X0 + .75 + math.cos(a) * .12, .9, Z0 + .4 + math.sin(a) * .12), (X0 + .75 + math.cos(a) * .3, 1.55, Z0 + .4 + math.sin(a) * .3)], [.03, .025], seg=5)
        paint(b, lambda p, n, k=k: [0xc4504a, 0x4a82b8, 0xd8b04a][k] if p[1] > 1.45 else 0x8a6a44)
        objs.append(b)
    bake(objs, dist=1.2, floor=.5)
    lv = cards.build()
    parts = objs + [lv]
    ensure_uv(parts)
    ob = finish(parts, 'Hut', ao=False)
    apply_cn(ob)
    return ob


hut()


# ── 畫架：三腳木架、托盤與夾條、畫布（背面看得到內框）上畫著一幅小風景、調色盤、腳邊的顏料罐 ──
def easel():
    objs = []
    lw = wood_fn(0xa2703e, 0x62401e, axis=1, k=40)
    for s in (-1, 1):
        objs.append(obox('EaselLeg', (s * .72, 0, .18), (s * .16, 3.25, 0), .1, .07, (0, 0, 1), bevel=.015))
    objs.append(obox('EaselBack', (0, 0, -.9), (0, 2.85, -.02), .09, .07, (1, 0, 0), bevel=.015))
    objs.append(obox('EaselBar', (-.95, 1.32, .12), (.95, 1.32, .12), .1, .16, (0, 1, 0), bevel=.015))
    objs.append(obox('EaselLip', (-.9, 1.4, .21), (.9, 1.4, .21), .08, .03, (0, 0, 1), bevel=.008))
    objs.append(obox('EaselClamp', (-.35, 3.08, .12), (.35, 3.08, .12), .1, .14, (0, 1, 0), bevel=.015))
    objs.append(obox('EaselCross', (-.5, .75, .12), (.5, .75, .12), .07, .06, (0, 0, 1), bevel=.01))
    for o in objs:
        paint(o, lw)
    # 畫布：內框 + 布面
    cz = .17
    fr = [obox('Stretcher', (-1.08, y, cz - .05), (1.08, y, cz - .05), .08, .08, (0, 0, 1), bevel=.01) for y in (1.44, 2.96)]
    fr += [obox('Stretcher', (x, 1.44, cz - .05), (x, 2.96, cz - .05), .08, .08, (0, 0, 1), bevel=.01) for x in (-1.06, 1.06)]
    for o in fr:
        paint(o, wood_fn(0xd8b888, 0xa88a60, axis=0))
    objs += fr
    cvb = rbox('CanvasBack', (0, 2.2, cz - .005), (2.2, 1.56, .03), bevel=.01, seg=1)
    paint(cvb, lambda p, n: 0xe8e0cc)
    objs.append(cvb)
    gb = bmesh.new()
    bmesh.ops.create_grid(gb, x_segments=22, y_segments=16, size=1.0)
    for v in gb.verts:
        x, y = v.co.x, v.co.y
        v.co = V(x * 1.09, 2.2 + y * .77, cz + .012)
    cv = obj_from_bm(gb, 'Canvas')
    for p_ in cv.data.polygons:
        p_.use_smooth = False

    def paintg(p, n):
        if n[2] < .5:
            return 0xe8e0cc
        x, y = p[0], p[1] - 1.42
        c = mix(0xa8c8d8, 0xe8e4d0, sstep(1.5, .9, y))
        hill = .75 + .18 * math.sin(x * 2.2 + .5) + .06 * math.sin(x * 6)
        if y < hill:
            c = mix(0x6a9a4a, 0x9ab85a, sstep(.3, hill, y))
        if y < .35 + .05 * math.sin(x * 5):
            c = mix(0x5a7a3a, 0x7a9a4a, nz(Vector(p) * 6) + .5)
        if (x - .55) ** 2 + (y - 1.2) ** 2 < .03:
            c = 0xe8c050
        if abs(x + .5) < .04 and .5 < y < .95:
            c = 0x6a4a2a
        if (x + .5) ** 2 + ((y - 1.0) * 1.2) ** 2 < .05:
            c = 0x4a7a3a
        if abs(p[0]) > 1.03 or abs(p[1] - 2.2) > .73:
            c = mix(c, 0xe8e0cc, .7)
        return c
    paint(cv, paintg)
    objs.append(cv)
    # 調色盤掛在托盤右邊，腳邊兩罐顏料
    pal = lathe('Palette', [(0, 0), (.3, 0), (.3, .02), (0, .02)], seg=14)
    pal.data.transform(Matrix.Translation(V(.72, 1.25, .3)) @ Matrix.Rotation(1.35, 4, 'X') @ Matrix.Diagonal((1.3, 1, 1, 1)))
    paint(pal, lambda p, n: 0xc8a070)
    objs.append(pal)
    for k, c in enumerate((0xc4504a, 0x4a82b8, 0xd8b04a, 0x5a9a5a, 0xe8e0d0)):
        a = k / 5 * 3.5 + .6
        dab = ellipsoid('Dab', (.72 + math.cos(a) * .2, 1.25 + math.sin(a) * .16, .33), (.045, .045, .02), seg=6, rings=3)
        paint(dab, lambda p, n, c=c: c)
        objs.append(dab)
    for k, (x, z, c) in enumerate(((.45, .55, 0xc4504a), (.1, .7, 0x4a82b8))):
        jar = lathe('Jar', [(0, 0), (.14, 0), (.15, .22), (.12, .26), (.13, .3), (0, .3)], seg=10, pivot=(x, 0, z))
        paint(jar, lambda p, n, c=c: c if p[1] > .28 or (p[1] > .08 and p[1] < .2 and n[1] < .5) else mix(0x8a9aa0, 0xd8e0e0, n[1] * .5 + .5))
        objs.append(jar)
    bake(objs, dist=.8, floor=.55)
    return finish(objs, 'Easel', ao=False)


easel()


# ── 告示牌：立柱（上端削尖）、三片釘在一起的木板、背後兩條橫檔、畫上的箭頭與字樣、麻繩綁紮 ──
def sign():
    objs = []
    post = obox('SignPost', (0, -.2, 0), (0, 2.75, 0), .18, .18, (0, 0, 1), bevel=.03)
    dice(post, 1)
    plane_cut(post, Vector((0, 2.72, .05)), Vector((0, .6, 1)))
    plane_cut(post, Vector((0, 2.72, -.05)), Vector((0, .6, -1)))
    paint(post, wood_fn(0x7a5634, 0x46301c, axis=1, k=30))
    objs.append(post)
    bw = wood_fn(0xc49a64, 0x8a6238, axis=0, k=22)
    for k, y in enumerate((1.82, 2.2, 2.58)):
        pl = rbox('SignBoard', (rnd_off := (k - 1) * .03, y, .17), (2.2 - abs(k - 1) * .06, .36, .09), bevel=.025, seg=1)
        dice(pl, 3)
        displace(pl, .008, 3, seed=k)

        def bfn(p, n, y=y):
            c = bw(p, n)
            if n[2] > .8:
                x, yy = p[0], p[1]
                if abs(yy - 2.2) < .045 and -.55 < x < .45:
                    c = mix(c, 0x3a2616, .85)
                if (x - .45 - (.1 - abs(yy - 2.2)) * 0) > .45 and abs(yy - 2.2) < .22 - (x - .45) * .9 and x < .75:
                    c = mix(c, 0x3a2616, .85)
                if abs(yy - 2.58) < .03 and -.7 < x < .6 and int((x + 1) * 9) % 3:
                    c = mix(c, 0x4a3020, .7)
                if abs(yy - 1.82) < .03 and -.6 < x < .2 and int((x + 1) * 11) % 4:
                    c = mix(c, 0x4a3020, .7)
            c = mix(c, 0x6a7a3a, sstep(1.75, 1.6, p[1]) * .6)
            return c
        paint(pl, bfn)
        objs.append(pl)
    for x in (-.7, .7):
        bt = rbox('Batten', (x, 2.2, .08), (.12, 1.1, .06), bevel=.015, seg=1)
        paint(bt, wood_fn(0x7a5634, 0x46301c, axis=1))
        objs.append(bt)
    objs += rivets('Nail', [(x, y, .225) for x in (-.7, .7) for y in (1.82, 2.2, 2.58)], r=.025)
    for y in (1.72, 2.68):
        rope = tube('Rope', [(.13 * math.cos(a), y + a * .012, .13 * math.sin(a) + .02) for a in [i / 12 * TAU for i in range(13)]], .025, seg=5)
        paint(rope, lambda p, n: mix(0x8a7448, 0xc8b07a, .5 + .5 * math.sin(p[1] * 90)))
        objs.append(rope)
    bake(objs, dist=.6, floor=.55)
    return finish(objs, 'Sign', ao=False)


sign()


# ── 地城機關 ──
# 火把台：方形石柱（底座、柱身、刻紋帶、柱頭）+ 鐵火盆（四爪）+ 炭塊；火焰由網頁加在 y≈3.8
def torch():
    objs = []
    sf = stone_fn(0x7a7064, 0xaea290, dark=0x4a443c, seed=21, mossk=.7, lich=.6)
    objs.append(chip_block('TorchBase', (0, .2, 0), (1.0, .4, 1.0), bevel=.06, seed=1, chips=2, cuts=1))
    objs.append(chip_block('TorchShaft', (0, 1.35, 0), (.62, 1.9, .62), bevel=.05, seed=2, chips=2, cuts=2))
    for y in (.7, 2.0):
        objs.append(chip_block('TorchBand', (0, y, 0), (.7, .12, .7), bevel=.02, seed=int(y * 10), chips=1, cuts=0))
    objs.append(chip_block('TorchCap', (0, 2.44, 0), (.86, .22, .86), bevel=.05, seed=3, chips=2, cuts=1))
    for o in objs:
        paint(o, crack_fn(sf, f=1.8, seed=4))
    bowl = lathe('Brazier', [(.16, 2.55), (.3, 2.62), (.5, 2.8), (.6, 3.02), (.56, 3.05), (.46, 2.86), (.28, 2.72), (0, 2.7)], seg=12)
    paint(bowl, iron)
    objs.append(bowl)
    for k in range(4):
        a = k / 4 * TAU + math.pi / 4
        cl = tube('Claw', [(math.cos(a) * .35, 2.56, math.sin(a) * .35), (math.cos(a) * .64, 2.9, math.sin(a) * .64), (math.cos(a) * .6, 3.18, math.sin(a) * .6)], [.05, .04, .015], seg=5)
        paint(cl, iron)
        objs.append(cl)
    rnd = random.Random(9)
    for k in range(7):
        a = rnd.uniform(0, TAU)
        r = rnd.uniform(0, .3)
        c = ico('Coal', (math.cos(a) * r, 2.86, math.sin(a) * r), (.13, .09, .12), sub=1)
        flat(c, 20)
        paint(c, lambda p, n: mix(0x1e1a18, 0x4a3a32, n[1] * .5 + .5))
        objs.append(c)
    bake(objs, dist=.6, floor=.5)
    return finish(objs, 'Torch', ao=False)


torch()


# 木箱：四周框木、每面一排直木板（略凹）、側面斜撐、釘子、鐵包角
def crate():
    objs = []
    W, H = 2.6, 2.2
    pw = wood_fn(0xb07a44, 0x6e4624, axis=1, k=28)
    fw = wood_fn(0x7a5030, 0x46301a, axis=1, k=28)
    inner = rbox('CrateCore', (0, H / 2, 0), (W - .2, H - .2, W - .2), bevel=0)
    paint(inner, lambda p, n: 0x3a2818)
    objs.append(inner)
    for face in range(4):
        a = face * math.pi / 2
        n = Vector((math.sin(a), 0, math.cos(a)))
        t = Vector((math.cos(a), 0, -math.sin(a)))
        for k in range(5):
            u = -1.0 + k * .5
            c = n * (W / 2 - .09) + t * u + Vector((0, H / 2, 0))
            pl = obox('CratePlank', c - Vector((0, H / 2 - .12, 0)), c + Vector((0, H / 2 - .12, 0)), .47, .08, tuple(n), bevel=.02)
            paint(pl, pw)
            objs.append(pl)
        br = obox('CrateX', n * (W / 2 - .02) + t * -.95 + Vector((0, .3, 0)), n * (W / 2 - .02) + t * .95 + Vector((0, H - .3, 0)), .2, .07, tuple(n), bevel=.02)
        paint(br, fw)
        objs.append(br)
        objs += rivets('Nail', [tuple(n * (W / 2 + .02) + t * u + Vector((0, y, 0))) for u in (-1.0, -.5, 0, .5, 1.0) for y in (.26, H - .26)], r=.028)
    for k in range(5):
        pl = obox('CrateTop', (-1.0 + k * .5, H - .06, -W / 2 + .12), (-1.0 + k * .5, H - .06, W / 2 - .12), .47, .08, (0, 1, 0), bevel=.02)
        paint(pl, pw)
        objs.append(pl)
    # 框木：十二條邊
    e = W / 2 - .03
    for xs in (-1, 1):
        for zs in (-1, 1):
            objs.append(obox('CrateEdge', (xs * e, 0, zs * e), (xs * e, H, zs * e), .22, .22, (xs, 0, zs), bevel=.03))
            cap = rbox('CrateCorner', (xs * (e + .02), H - .1, zs * (e + .02)), (.3, .22, .3), bevel=.02, seg=1)
            paint(cap, iron)
            objs.append(cap)
            cap = rbox('CrateCorner', (xs * (e + .02), .1, zs * (e + .02)), (.3, .22, .3), bevel=.02, seg=1)
            paint(cap, iron)
            objs.append(cap)
    for y in (.1, H - .1):
        for s in (-1, 1):
            objs.append(obox('CrateEdge', (-e, y, s * e), (e, y, s * e), .2, .22, (0, 0, s), bevel=.03))
            objs.append(obox('CrateEdge', (s * e, y, -e), (s * e, y, e), .2, .22, (s, 0, 0), bevel=.03))
    for o in objs:
        if o.name.startswith('CrateEdge'):
            paint(o, fw)
    bake(objs, dist=.8, floor=.5)
    return finish(objs, 'Crate', ao=False)


crate()


# 石門：厚石板、前後凸起的邊框、一層層石紋、中央刻紋圓盤與金環、放射紋
def door():
    objs = []
    sf = stone_fn(0x6f6454, 0x9d8f7a, dark=0x463e34, seed=31, mossk=.5, lich=.4)

    def courses(p, n):
        c = sf(p, n)
        if abs(n[2]) > .7 and abs(((p[1] + .2) * 1.05) % 1 - .5) > .47:
            c = mix(c, 0x3a3228, .6)
        return c
    slab = chip_block('DoorSlab', (0, 4, 0), (3.94, 7.96, .96), bevel=.06, seed=5, chips=2, cuts=6, amp=.015)
    paint(slab, crack_fn(courses, f=.9, seed=2))
    objs.append(slab)
    for zs in (-1, 1):
        z = zs * .54
        for (c, s) in (((0, 7.8, z), (3.98, .4, .14)), ((0, .2, z), (3.98, .4, .14)), ((-1.8, 4, z), (.38, 7.2, .14)), ((1.8, 4, z), (.38, 7.2, .14))):
            b = chip_block('DoorFrame', c, s, bevel=.05, seed=int(c[0] * 7 + c[1] * 3 + zs * 11 + 50), chips=2, cuts=1)
            paint(b, crack_fn(sf, f=1.2, seed=5))
            objs.append(b)
        md = lathe('DoorDisc', [(.95, 0), (1.0, .06), (.92, .12), (.62, .12), (.58, .18), (.3, .18), (.26, .22), (0, .22)], seg=24)
        md.data.transform(Matrix.Translation(V(0, 4.6, zs * .48)) @ Matrix.Rotation(zs * math.pi / 2, 4, 'X'))
        paint(md, lambda p, n: mix(0x7a6e5e, 0xb0a28c, .5 + fbm(p, 3) * .5))
        objs.append(md)
        rg = tube('DoorRing', [(.45 * math.cos(a), 4.6 + .45 * math.sin(a), zs * (.48 + .2)) for a in [i / 24 * TAU for i in range(25)]], .09, seg=6)
        paint(rg, gold)
        objs.append(rg)
        for k in range(8):
            a = k / 8 * TAU + math.pi / 8
            r0, r1 = 1.1, 1.55
            ray = obox('DoorRay', (math.cos(a) * r0, 4.6 + math.sin(a) * r0, zs * .5), (math.cos(a) * r1, 4.6 + math.sin(a) * r1, zs * .5), .16, .1, (0, 0, zs), bevel=.02)
            paint(ray, lambda p, n: mix(0x6a5e4e, 0xa0927c, .5 + n[1] * .3))
            objs.append(ray)
        for y in (1.2, 2.2):
            g = obox('DoorGroove', (-1.3, y, zs * .5), (1.3, y, zs * .5), .12, .06, (0, 0, zs), bevel=.01)
            paint(g, lambda p, n: 0x4a4034)
            objs.append(g)
    bake(objs, dist=.8, floor=.5)
    return finish(objs, 'Door', ao=False)


door()


# 彈花：花心墊（c2）有同心凹紋；外八片、內八片杯狀花瓣（c1，雙面、中脈、尖端上翹）
def spring():
    pad = lathe('SpringPad', [(0, 0), (1.42, 0), (1.5, .14), (1.42, .26), (1.2, .34), (1.05, .33), (.95, .38), (.72, .4), (.62, .37), (.45, .44), (.2, .48), (0, .5)], seg=32, slot='c2')
    paint(pad, lambda p, n: mix((.62, .62, .6), (1, 1, 1), sstep(-.3, .9, n[1]) * .6 + fbm(p, 3) * .15 + .2))
    objs = [pad]
    bm = bmesh.new()
    cols = []
    for layer, (NP, L, W, y0, lift, off) in enumerate(((8, 1.5, .62, .28, .4, 0), (8, 1.0, .46, .38, .6, math.pi / 8))):
        for k in range(NP):
            a = k / NP * TAU + off
            d = Vector((math.cos(a), 0, math.sin(a)))
            sd = Vector((-d.z, 0, d.x))
            rows = []
            NR = 5
            for i in range(NR + 1):
                t = i / NR
                w = W * (.3 + .7 * math.sin(math.pi * (t * .75 + .12)))
                if i == NR:
                    w = W * .12
                c = d * (.55 + L * t) + Vector((0, y0 + lift * t * t + .1 * math.sin(t * math.pi), 0))
                cup = .32 * w
                rows.append([c - sd * w + Vector((0, cup, 0)), c - Vector((0, .03 * (1 - t), 0)), c + sd * w + Vector((0, cup, 0))])
            vs = []
            for i, row in enumerate(rows):
                vr = []
                for j, q in enumerate(row):
                    vr.append(bm.verts.new(V(*q)))
                    t = i / NR
                    cols.append(mix((.6, .6, .6), (1, 1, 1), .35 + t * .65) if j != 1 else mix((.5, .5, .5), (.85, .85, .85), t))
                vs.append(vr)
            for i in range(NR):
                for j in range(2):
                    if i == NR - 1:
                        bm.faces.new((vs[i][j], vs[i][j + 1], vs[i + 1][1]))
                    else:
                        bm.faces.new((vs[i][j], vs[i][j + 1], vs[i + 1][j + 1], vs[i + 1][j]))
    geom = bm.faces[:]
    bmesh.ops.recalc_face_normals(bm, faces=geom)
    ret = bmesh.ops.duplicate(bm, geom=geom)
    newf = [g for g in ret['geom'] if isinstance(g, bmesh.types.BMFace)]
    bmesh.ops.reverse_faces(bm, faces=newf)
    nv = [g for g in ret['geom'] if isinstance(g, bmesh.types.BMVert)]
    for v in nv:
        v.co.z -= .02
    cols = cols + [(c[0] * .8, c[1] * .8, c[2] * .8) if isinstance(c, tuple) else c for c in cols[:len(nv)]]
    pet = obj_from_bm(bm, 'Petal', slot='c1')
    set_cols(pet, cols)
    objs.append(pet)
    bake(objs, dist=.6, floor=.6)
    return finish(objs, 'Spring', ao=False)


spring()


# 種子：有稜的堅果形種莢、殼頂的小帽、抽出的嫩芽與兩片有中脈的葉、捲起的新葉
def seed():
    objs = []
    pod = lathe('SeedPod', [(0, .02), (.45, .06), (.8, .3), (.92, .6), (.84, .9), (.6, 1.12), (.3, 1.24), (0, 1.27)], seg=24, wobble=lambda a, y: .06 * math.cos(a * 8))
    paint(pod, lambda p, n: mix(0x5e3c22, 0xa87848, .35 + .4 * abs(math.cos(math.atan2(p[2], p[0]) * 8)) + n[1] * .2 + fbm(p, 4) * .15))
    objs.append(pod)
    cap = lathe('SeedCap', [(.34, 1.18), (.36, 1.24), (.26, 1.32), (.08, 1.34), (0, 1.33)], seg=12)
    paint(cap, lambda p, n: mix(0x4a3420, 0x7a5a36, n[1] * .5 + .5))
    objs.append(cap)
    st = tube('Sprout', [(0, 1.25, 0), (.06, 1.5, 0), (-.02, 1.75, .04), (.04, 1.98, .02), (.14, 2.08, 0)], [.07, .06, .05, .035, .02], seg=7)
    paint(st, lambda p, n: mix(0x5a8a3a, 0x9ac65a, sstep(1.3, 2.0, p[1])))
    objs.append(st)
    bm = bmesh.new()
    cols = []
    for (b, a, L, W) in (((.02, 1.72, .03), .3, .62, .22), ((-.02, 1.82, .04), 3.4, .55, .2)):
        B = Vector(b)
        d = Vector((math.cos(a), .45, math.sin(a))).normalized()
        sd = Vector((-math.sin(a), 0, math.cos(a)))
        rows = []
        for i in range(6):
            t = i / 5
            w = W * math.sin(t * math.pi) * (1.1 - t * .3)
            c = B + d * L * t + Vector((0, -.18 * t * t, 0))
            rows.append([c - sd * w + Vector((0, .06 * w / W, 0)), c, c + sd * w + Vector((0, .06 * w / W, 0))])
        vs = [[bm.verts.new(V(*q)) for q in row] for row in rows]
        for i, row in enumerate(rows):
            for j in range(3):
                cols.append(mix(0x4f8a36, 0x9cc85a, .4 + i / 10) if j != 1 else 0x3e7030)
        for i in range(5):
            for j in range(2):
                bm.faces.new((vs[i][j], vs[i][j + 1], vs[i + 1][j + 1], vs[i + 1][j]))
    geom = bm.faces[:]
    ret = bmesh.ops.duplicate(bm, geom=geom)
    bmesh.ops.reverse_faces(bm, faces=[g for g in ret['geom'] if isinstance(g, bmesh.types.BMFace)])
    nv = [g for g in ret['geom'] if isinstance(g, bmesh.types.BMVert)]
    for v in nv:
        v.co.z -= .01
    cols = cols + cols[:len(nv)]
    lf = obj_from_bm(bm, 'SproutLeaf')
    set_cols(lf, cols)
    objs.append(lf)
    curl = ellipsoid('SproutCurl', (.16, 2.1, 0), (.07, .09, .06), seg=8, rings=5)
    paint(curl, lambda p, n: 0x8ab84e)
    objs.append(curl)
    bake(objs, dist=.5, floor=.55)
    return finish(objs, 'Seed', ao=False)


seed()


# 荊棘叢：六根互相纏繞的粗藤、藤上一根根彎刺（深紅底、象牙尖）、零星暗色葉片
def bramble():
    rnd = random.Random(13)
    objs = []
    vines = []
    for k in range(6):
        a0 = k / 6 * TAU
        pts = []
        for i in range(8):
            t = i / 7
            r = (1.25 - t * .55) * (1 + .15 * math.sin(t * 7 + k))
            a = a0 + t * (2.4 if k % 2 else -2.2)
            pts.append((math.cos(a) * r, .1 + t * 2.7 + .2 * math.sin(t * 9 + k), math.sin(a) * r))
        pts[0] = (pts[0][0] * 1.1, -.2, pts[0][2] * 1.1)
        v = tube('Thorn', pts, [.26, .23, .2, .17, .14, .11, .08, .03], seg=7)
        displace(v, .03, 3, seed=k)
        paint(v, lambda p, n: mix(mix(0x3a3222, 0x5a6230, sstep(.3, 2.6, p[1])), 0x6e5a3a, sstep(.3, .7, fbm(p, 2, 3))))
        objs.append(v)
        vines.append(pts)
    bm = bmesh.new()
    cols = []
    for pts in vines:
        P = [Vector(q) for q in pts]
        for i in range(1, 7):
            for j in range(3):
                t = rnd.random()
                q = P[i].lerp(P[i + 1], t)
                tg = (P[i + 1] - P[i]).normalized()
                out = Vector((rnd.uniform(-1, 1), rnd.uniform(-.3, 1), rnd.uniform(-1, 1)))
                out = (out - tg * out.dot(tg)).normalized()
                r = .22 - i * .025
                b = q + out * r * .8
                tip = b + (out + tg * .5).normalized() * rnd.uniform(.28, .45)
                s1 = tg.cross(out).normalized() * .05
                vs = [bm.verts.new(V(*(b - tg * .06))), bm.verts.new(V(*(b + s1))), bm.verts.new(V(*(b + tg * .06))), bm.verts.new(V(*(b - s1))), bm.verts.new(V(*tip))]
                for f in ((vs[0], vs[1], vs[4]), (vs[1], vs[2], vs[4]), (vs[2], vs[3], vs[4]), (vs[3], vs[0], vs[4])):
                    bm.faces.new(f)
                cols += [0x6a2e24] * 4 + [0xeadcb0]
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    sp = obj_from_bm(bm, 'Spike')
    set_cols(sp, cols)
    objs.append(sp)
    cards = Cards('BrambleLeaves')
    for k in range(12):
        pts = vines[k % 6]
        q = Vector(pts[rnd.randint(2, 6)]) + Vector((rnd.uniform(-.2, .2), rnd.uniform(-.1, .2), rnd.uniform(-.2, .2)))
        Fc = (Vector((q.x, .6, q.z)).normalized() + Vector((rnd.uniform(-.4, .4), rnd.uniform(0, .5), rnd.uniform(-.4, .4)))).normalized()
        jc = rnd.uniform(0, .5)
        cards.add(q, Fc, rnd.uniform(.35, .5), roll=rnd.uniform(0, TAU), bend=.15, colfn=lambda qq, jc=jc: mix(0x2e4424, 0x5e7236, jc), nfn=lambda qq, Fc=Fc: Fc)
    bake(objs, dist=.6, floor=.5)
    lv = cards.build()
    parts = objs + [lv]
    ensure_uv(parts)
    ob = finish(parts, 'Bramble', ao=False)
    apply_cn(ob)
    return ob


bramble()


# 寶珠台：八角石座（底座、有凹槽的柱身、刻紋帶、托碗）
def orb_pedestal():
    ped = lathe('OrbPedestal', [(.95, 0), (.95, .16), (.86, .2), (.8, .26), (.56, .32), (.52, .4), (.5, .9), (.54, .95), (.6, .98), (.6, 1.04), (.72, 1.1), (.8, 1.2), (.8, 1.28), (.62, 1.3), (.5, 1.26), (0, 1.24)], seg=16,
                wobble=lambda a, y: (.06 * (abs(math.cos(a * 4)) - .5) if .42 < y < .88 else 0))
    flat(ped, 30)
    sf = stone_fn(0xc4b89e, 0xece2cc, dark=0x8a8070, seed=8, mossk=.7, lich=.5)
    paint(ped, lambda p, n: mix(sf(p, n), 0x8a7a5a, .6) if abs(p[1] - .98) < .04 or abs(p[1] - 1.2) < .03 else sf(p, n))
    bake([ped], dist=.5, floor=.55)
    return finish([ped], 'OrbPedestal', ao=False)


orb_pedestal()

# ── 排列預覽 ──
unpark()
if RENDER:
    layout = {'TreeRound': (-12, -6), 'TreeAutumn': (-5, -8), 'Pine': (2, -8), 'Palm': (9, -7), 'Cactus': (14, -4), 'Rock0': (-13, 3), 'Rock1': (-10, 3), 'Rock2': (-7, 3),
              'Grass': (-4, 4), 'FlowerHead': (-3, 4.5), 'FlowerStem': (-3, 4.5), 'Shrine': (4, 3), 'Gem': (4, 3), 'Chest': (-10, 9), 'Arch': (13, 6),
              'Hut': (-18, 4), 'Easel': (-4, 9), 'Sign': (-1, 9), 'Torch': (2, 11), 'Crate': (5, 11), 'Door': (9, 13), 'Spring': (-7, 13), 'Seed': (-3, 13), 'Bramble': (0, 14),
              'OrbPedestal': (-13, 12)}
    saved = {o.name: o.matrix_world.copy() for o in ALL if o.parent is None}
    for o in ALL:
        if o.name in layout and o.parent is None:
            x, z = layout[o.name]
            o.location = V(x, 0, z) + (V(0, 1.45, 0) if o.name == 'Gem' else Vector((0, 0, 0)))
    bpy.data.objects['GemShell'].hide_render = True
    preview(os.path.join(PREV, 'props_a.png'), target=(0, 3, 3), dist=38, yaw=0, pitch=22, res=(1200, 700))
    preview(os.path.join(PREV, 'props_b.png'), target=(-6, 2, 4), dist=14, yaw=-25, pitch=18, res=(900, 600))
    preview(os.path.join(PREV, 'props_c.png'), target=(-3, 3, 6), dist=30, yaw=180, pitch=15, res=(1200, 600))
    for nm, m in saved.items():
        bpy.data.objects[nm].matrix_world = m
    bpy.data.objects['GemShell'].hide_render = False
export(OUT, [o for o in ALL if o.parent is None], uv=True)
