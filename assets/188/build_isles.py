# 188 彩筆曠野：浮空島套件（岩壁、垂岩下緣、遺跡、遠景島群與遠山）
# 重建：/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P assets/188/build_isles.py
#   環境變數：OUT=輸出 glb（預設 assets/188/isles.glb）、RENDER=1 預覽圖存到 PREV、AO=烘焙取樣數
# 參考：王國之淚預告與實機影片的空島——平頂、方塊狀層疊岩壁、往下收尖的垂岩、邊緣長著草根與藤蔓、頂上有石造遺跡。
#
# IsleUnder0–2：單位半徑的島體下半部。原點在島頂邊緣高度（y=0），岩壁頂環半徑 1，往下約 1.5 深。
#   網頁會把每個頂點的 x/z 乘上該角度的島緣半徑、y 乘上 I.r，讓外形貼齊程式產生的草地表面（碰撞仍用 isleTop）。
# Ruin*：遺跡零件，公尺尺寸，原點在底部中心。
# FarIsle0–2、FarMount0–2：遠景剪影（單位大小，網頁放在 700 公尺外，霧化成空氣透視）。
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from bw_lib import *

OUT = os.environ.get('OUT', os.path.join(HERE, 'isles.glb'))
PREV = os.environ.get('PREV', '/tmp/bw188')
RENDER = os.environ.get('RENDER', '1') == '1'
AO = int(os.environ.get('AO', '16'))
os.makedirs(PREV, exist_ok=True)
reset()
random.seed(1888)
ALL = []


# 一律匯出共用頂點（檔案小一半），網頁端用 flatShading 算出面法線，看起來仍是一塊塊的岩面
def finish(objs, name, ao=True, floor=.5):
    objs = [o for o in objs if o]
    if AO and ao:
        ao_bake(objs, samples=AO, strength=1.1, floor=floor)
    ob = join(objs, name) if len(objs) > 1 else objs[0]
    ob.name = name
    origin_to(ob, (0, 0, 0))
    ALL.append(ob)
    print(name, 'tris', tri_count([ob]))
    return ob


def nz(p, f=1.0, s=0):
    return noise.noise(Vector((p[0] * f + s, p[1] * f + s * .7, p[2] * f - s)))


# ── 顏色：岩壁偏暖灰、下緣偏深褐灰，頂面長青苔 ──
MOSS, MOSS_D = 0x7fa84a, 0x55793a
def cliff_col(p, n, dark=0.0):
    t = .5 + nz(p, 5.5) * .6
    c = mix(0x9b917f, 0xc9bea6, t)
    band = .5 + .5 * math.sin(p[1] * 70 + nz(p, 3, 2) * 4)
    c = mix(c, 0x857a69, band * .25)
    if n[1] > .55:
        c = mix(c, mix(MOSS_D, MOSS, .5 + nz(p, 9, 5) * .8), .85)
    elif p[1] > -.1 and nz(p, 7, 3) > .1:
        c = mix(c, MOSS_D, .45)
    return mix(c, 0x3e3830, dark)


def under_col(p, n):
    depth = sstep(-.25, -1.45, p[1])
    c = mix(0x8a7d6b, 0x5a4f45, depth)
    band = .5 + .5 * math.sin(p[1] * 46 + nz(p, 2.5, 7) * 3)
    c = mix(c, 0xa39480, band * .22 * (1 - depth))
    c = mix(c, 0x463d35, max(0, nz(p, 4, 11)) * .5)
    if n[1] > .45:
        c = mix(c, MOSS_D, .6)
    return c


# ── 島體下半部 ──
def cliff_ring(ytop, h, rad, seed):
    random.seed(seed)
    out = []
    a0 = random.uniform(0, TAU)
    a = 0.0
    while a < TAU - .02:
        w = random.uniform(.1, .26)
        if a + w / rad > TAU:
            w = (TAU - a) * rad
        ang = a0 + a + w / 2 / rad
        dep = random.uniform(.08, .2)
        hh = h * random.uniform(.8, 1.3)
        r = rad - dep / 2 + random.uniform(-.022, .02)
        b = rbox('blk', (0, 0, 0), (dep, hh, w * .97), bevel=0)
        place(b, (math.cos(ang) * r, ytop - hh / 2 + random.uniform(-.008, .008), math.sin(ang) * r), (0, -math.degrees(ang) + random.uniform(-2, 2), 0))
        bpy.context.view_layer.update()
        b.data.transform(b.matrix_world)
        b.matrix_world = Matrix.Identity(4)
        out.append(b)
        a += w / rad
    return out


def isle_under(name, seed, lobes=3, depth=1.5, n_spikes=8):
    random.seed(seed)
    parts = []
    courses = [(0.0, .095, 1.0), (-.095, .09, .985), (-.185, .085, .962), (-.27, .08, .935)]
    for ci, (ytop, h, rad) in enumerate(courses):
        parts += cliff_ring(ytop, h, rad, seed * 10 + ci)
    random.seed(seed + 1)
    ph = [random.uniform(0, TAU) for _ in range(3)]
    def wob(a, y):
        t = sstep(-.3, -depth, y)
        lobe = .16 * math.sin(a * lobes + ph[0]) + .08 * math.sin(a * (lobes + 2) + ph[1])
        return lobe * t + .1 * noise.noise(Vector((math.cos(a) * 2, y * 3, math.sin(a) * 2 + seed)))
    prof = []
    N = 16
    for k in range(N + 1):
        t = k / N
        y = -depth + t * (depth - .3)
        r = .93 * (t ** .75) * (1 - .12 * math.sin(t * 9 + seed))
        prof.append((max(r, .004), y))
    body = lathe('body', prof, seg=40, wobble=wob, cap_bot=False)
    off = Vector((random.uniform(-.15, .15), 0, random.uniform(-.15, .15)))
    each_vert(body, lambda p: p + off * sstep(-.4, -depth, p[1]))
    displace(body, .045, 4.0, seed=seed)
    parts.append(body)
    for k in range(n_spikes):
        a = random.uniform(0, TAU)
        y = random.uniform(-.45, -1.0)
        t = (y + depth) / (depth - .3)
        r = .93 * (max(t, .05) ** .75) * .8
        L = random.uniform(.18, .55)
        rb = random.uniform(.06, .14)
        base = (math.cos(a) * r, y + .05, math.sin(a) * r)
        sp = lathe('spk', [(.002, -L), (rb * .35, -L * .6), (rb * .8, -L * .25), (rb, 0)], seg=7, off=base, cap_bot=False)
        displace(sp, .02, 6.0, seed=seed + k)
        parts.append(sp)
    roots = []
    for k in range(22):
        a = random.uniform(0, TAU)
        L = random.uniform(.06, .3)
        pts, rads = [], []
        for j in range(6):
            s = j / 5
            pts.append((math.cos(a) * 1.006 + math.sin(s * 5 + k) * .006, -.01 - s * L, math.sin(a) * 1.006 + math.cos(s * 4 + k) * .006))
            rads.append(.006 * (1 - s * .8))
        roots.append(tube('root', pts, rads, seg=4, caps=False))
    for o in parts:
        if o.name.startswith('blk'):
            paint(o, lambda p, n: cliff_col(p, n, dark=sstep(-.1, -.36, p[1]) * .25))
        else:
            paint(o, under_col)
    for o in roots:
        paint(o, lambda p, n: mix(0x5d8a3a, 0x3f6a2c, .5 + nz(p, 20) * .8))
    return finish(parts + roots, name, floor=.45)


isle_under('IsleUnder0', 11, lobes=3, depth=1.5, n_spikes=9)
isle_under('IsleUnder1', 23, lobes=2, depth=1.7, n_spikes=7)
isle_under('IsleUnder2', 37, lobes=4, depth=1.35, n_spikes=11)


# ── 遺跡零件（公尺） ──
def ruin_col(p, n, teal=None):
    c = mix(0x8f887a, 0xcdc4b0, .5 + nz(p, .9) * .7)
    c = mix(c, 0x6d6658, max(0, nz(p, 3.1, 4)) * .6)
    if n[1] > .6 or (nz(p, .45, 8) > .28 and p[1] < 2.5):
        c = mix(c, mix(MOSS_D, MOSS, .5 + nz(p, 4, 2) * .8), .75)
    if teal and teal(p, n):
        c = mix(c, 0x4fc2ad, .8)
    return c


def jag_top(ob, y_cut, amp, seed):
    """把高過 y_cut 的頂點往下壓成不規則的斷口"""
    def fn(p):
        if p[1] > y_cut:
            d = (.5 + .5 * noise.noise(Vector((p[0] * 2.3 + seed, p[2] * 2.3, seed)))) * amp
            return (p[0], max(y_cut - amp * .2, p[1] - d), p[2])
        return None
    each_vert(ob, fn)


def pillar(name, h=7.0, broken=False, seed=0):
    o = []
    o.append(rbox('base', (0, .3, 0), (1.8, .6, 1.8), bevel=.06, seg=1))
    o.append(rbox('base2', (0, .75, 0), (1.5, .3, 1.5), bevel=.04, seg=1))
    shaft = rbox('shaft', (0, .9 + (h - 1.6) / 2, 0), (1.15, h - 1.6, 1.15), bevel=.08, seg=1)
    dice(shaft, 3)
    if broken:
        jag_top(shaft, .9 + (h - 1.6) * .75, 1.4, seed)
    o.append(shaft)
    if not broken:
        o.append(rbox('cap', (0, h - .45, 0), (1.6, .3, 1.6), bevel=.04, seg=1))
        o.append(rbox('cap2', (0, h - .15, 0), (1.9, .3, 1.9), bevel=.05, seg=1))
    for ob in o:
        paint(ob, lambda p, n: ruin_col(p, n, teal=lambda p, n: abs(p[1] - 2.2) < .07 and abs(n[1]) < .5))
    return finish(o, name)


pillar('RuinPillar', 7.0)
pillar('RuinPillarBroken', 5.2, broken=True, seed=3)

# 拱門
o = []
for sd in (-1, 1):
    o.append(rbox('leg', (sd * 2.6, 3.2, 0), (1.3, 6.4, 1.3), bevel=.07, seg=1))
    o.append(rbox('foot', (sd * 2.6, .3, 0), (1.8, .6, 1.8), bevel=.05, seg=1))
lin = rbox('lintel', (0, 6.9, 0), (7.4, 1.0, 1.5), bevel=.07, seg=1)
dice(lin, 3)
jag_top(lin, 7.2, .5, 9)
o.append(lin)
o.append(rbox('key', (0, 6.9, .78), (1.1, .7, .12), bevel=.02, seg=1))
for ob in o:
    paint(ob, lambda p, n: ruin_col(p, n, teal=lambda p, n: p[2] > .8 and abs(p[1] - 6.9) < .3))
finish(o, 'RuinArch')

# 斷牆：一排石塊，頂端參差
o = []
random.seed(5)
for row in range(4):
    x = -3.2 + (row % 2) * .5
    while x < 3.0:
        w = random.uniform(.9, 1.6)
        top = 3.4 - abs(x) * random.uniform(.2, .6)
        yc = .4 + row * .8
        if yc < top:
            o.append(rbox('st', (x + w / 2, yc, random.uniform(-.05, .05)), (w * .96, .76, 1.0), bevel=.05, seg=1))
        x += w
for ob in o:
    paint(ob, ruin_col)
finish(o, 'RuinWall')

# 方石：刻著圓紋的大石塊
o = [rbox('blk', (0, 1.2, 0), (2.4, 2.4, 2.4), bevel=.12, seg=1)]
disc = lathe('rune', [(0, 0), (.8, 0), (.8, .06), (0, .06)], seg=20, off=(0, 1.2, 1.2))
disc.rotation_euler = Euler((0, 0, 0))
each_vert(disc, lambda p: (p[0], 1.2 + (p[2] - 1.2), 1.2 + (p[1] - 1.2)))
o.append(disc)
for ob in o:
    paint(ob, lambda p, n: ruin_col(p, n, teal=lambda p, n: p[2] > 1.21 and (p[0] ** 2 + (p[1] - 1.2) ** 2) ** .5 > .55))
finish(o, 'RuinBlock')

# 階梯平台
o = []
for k in range(4):
    s = 5.2 - k * 1.1
    o.append(rbox('step', (0, .25 + k * .5, 0), (s, .5, s * .8), bevel=.04, seg=1))
for ob in o:
    paint(ob, ruin_col)
finish(o, 'RuinStairs')

# 高塔：參考圖裡浮島上的細長石塔
o = []
o.append(rbox('tb', (0, .6, 0), (4.2, 1.2, 4.2), bevel=.08, seg=1))
sh = lathe('tshaft', [(1.6, 1.2), (1.45, 6), (1.3, 11), (1.2, 14)], seg=4)
sh.rotation_euler = Euler((0, 0, math.radians(45)))
bpy.context.view_layer.update(); sh.data.transform(sh.matrix_world); sh.matrix_world = Matrix.Identity(4)
dice(sh, 3)
o.append(sh)
o.append(rbox('tring', (0, 8.5, 0), (2.6, .45, 2.6), bevel=.05, seg=1))
o.append(rbox('tplat', (0, 14.2, 0), (3.6, .5, 3.6), bevel=.06, seg=1))
for sd in range(4):
    a = sd * TAU / 4 + TAU / 8
    o.append(rbox('tpost', (math.cos(a) * 1.4, 15.3, math.sin(a) * 1.4), (.45, 1.8, .45), bevel=.03, seg=1))
o.append(rbox('troof', (0, 16.4, 0), (3.2, .4, 3.2), bevel=.05, seg=1))
sp = lathe('tspire', [(1.3, 16.6), (.2, 19.8), (.01, 20.6)], seg=4)
sp.rotation_euler = Euler((0, 0, math.radians(45)))
bpy.context.view_layer.update(); sp.data.transform(sp.matrix_world); sp.matrix_world = Matrix.Identity(4)
o.append(sp)
for ob in o:
    paint(ob, lambda p, n: ruin_col(p, n, teal=lambda p, n: abs(p[1] - 8.5) < .25 and abs(n[1]) < .5))
finish(o, 'RuinTower')


# ── 遠景：整座小島剪影與遠山（面數很低） ──
def far_isle(name, seed):
    """遠景整座小島：兩層大石塊岩壁＋瓣狀垂岩＋草頂與樹冠，面數約千面"""
    random.seed(seed)
    o = []
    for ci, (ytop, h, rad) in enumerate([(0.0, .12, 1.0), (-.12, .11, .97)]):
        random.seed(seed * 10 + ci)
        a0, a = random.uniform(0, TAU), 0.0
        while a < TAU - .02:
            w = min(random.uniform(.22, .4), (TAU - a) * rad)
            ang = a0 + a + w / 2 / rad
            dep, hh = random.uniform(.1, .22), h * random.uniform(.8, 1.3)
            b = rbox('fblk', (0, 0, 0), (dep, hh, w * .97), bevel=0)
            place(b, (math.cos(ang) * (rad - dep / 2), ytop - hh / 2, math.sin(ang) * (rad - dep / 2)), (0, -math.degrees(ang), 0))
            bpy.context.view_layer.update(); b.data.transform(b.matrix_world); b.matrix_world = Matrix.Identity(4)
            o.append(b)
            a += w / rad
    random.seed(seed + 5)
    ph = random.uniform(0, TAU)
    und = lathe('fund', [(.01, -1.45), (.2, -1.15), (.5, -.8), (.78, -.45), (.93, -.22)], seg=16, cap_bot=False,
                wobble=lambda a, y: (.2 * math.sin(a * 3 + ph) + .08 * math.sin(a * 5 + ph * 2)) * sstep(-.25, -1.2, y))
    displace(und, .07, 3, seed=seed + 1)
    o.append(und)
    for k in range(4):
        a = random.uniform(0, TAU); t = random.uniform(.3, .7); r = .85 * t
        L = random.uniform(.25, .5)
        o.append(lathe('fspk', [(.002, -L), (.08, -L * .4), (.12, 0)], seg=5, off=(math.cos(a) * r, -1.15 + t * .9, math.sin(a) * r), cap_bot=False))
    top = lathe('ftop', [(1.0, -.01), (.9, .03), (.0, .05)], seg=18, cap_bot=False)
    o.append(top)
    for k in range(random.randint(6, 10)):
        a, d = random.uniform(0, TAU), random.uniform(.1, .78)
        s = random.uniform(.06, .12)
        x, z = math.cos(a) * d, math.sin(a) * d
        o.append(ico('fcan', (x, .05 + s * 1.7, z), (s * 1.1, s * .8, s * 1.1), sub=1))
        o.append(rbox('ftr', (x, .05 + s * .6, z), (.02, s * 1.2, .02), bevel=0))
    if random.random() < .8:
        a = random.uniform(0, TAU)
        o.append(rbox('fpil', (math.cos(a) * .55, .25, math.sin(a) * .55), (.07, .42, .07), bevel=0))
        o.append(rbox('fpil', (math.cos(a + .25) * .55, .18, math.sin(a + .25) * .55), (.07, .28, .07), bevel=0))
    gold = seed % 2 == 1
    for ob in o:
        if ob.name.startswith('fcan'):
            paint(ob, lambda p, n: mix(0xd9a83a, 0xf2d060, .5 + nz(p, 8) * .6) if gold else mix(0x5f9040, 0x8fbd55, .5 + nz(p, 8) * .6))
        elif ob.name.startswith('ftop'):
            paint(ob, lambda p, n: mix(0x7fa84a, 0xa5b86a, .5 + nz(p, 6) * .5))
        elif ob.name.startswith('ftr'):
            solid(ob, 0x5a4a38)
        elif ob.name.startswith('fblk') or ob.name.startswith('fpil'):
            paint(ob, lambda p, n: cliff_col(p, n, dark=sstep(0, -.23, p[1]) * .2))
        else:
            paint(ob, under_col)
    return finish(o, name, ao=False)


for k in range(3):
    far_isle('FarIsle%d' % k, 60 + k)


def far_mount(name, seed, peaks):
    random.seed(seed)
    ph = random.uniform(0, 100)
    def h(x, z):
        v = 0
        for (px, pz, ph_, pr) in peaks:
            d = ((x - px) ** 2 + (z - pz) ** 2) ** .5 / pr
            v = max(v, ph_ * max(0, 1 - d) ** 1.4)
        v *= 1 + .25 * noise.noise(Vector((x * 3 + ph, z * 3, ph)))
        return v
    bm = bmesh.new()
    N = 34
    grid = []
    for j in range(N + 1):
        row = []
        for i in range(N + 1):
            x, z = -1 + 2 * i / N, -1 + 2 * j / N
            edge = max(abs(x), abs(z))
            y = h(x, z) * (1 - sstep(.8, 1, edge)) - .02
            row.append(bm.verts.new(V(x, y, z)))
        grid.append(row)
    for j in range(N):
        for i in range(N):
            bm.faces.new((grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    ob = obj_from_bm(bm, 'fm')
    decimate(ob, .45)
    paint(ob, lambda p, n: mix(mix(0x6b8a5a, 0x8e8a78, sstep(.12, .35, p[1])), 0xf2f0ea, sstep(.42, .5, p[1] + nz(p, 9) * .03)))
    return finish([ob], name, ao=False)


far_mount('FarMount0', 1, [(0, 0, .55, .7), (-.4, .2, .35, .5), (.45, -.1, .4, .55)])
far_mount('FarMount1', 2, [(-.2, 0, .7, .8), (.4, .3, .3, .45)])
far_mount('FarMount2', 3, [(0, 0, .3, .9), (.5, .1, .42, .5), (-.55, -.2, .25, .5)])


# ── 預覽 ──
if RENDER:
    lay = {'IsleUnder0': (-26, 0, 10), 'IsleUnder1': (0, 0, 10), 'IsleUnder2': (26, 0, 10),
           'RuinPillar': (-18, 18, 1), 'RuinPillarBroken': (-13, 18, 1), 'RuinArch': (-5, 18, 1), 'RuinWall': (5, 18, 1),
           'RuinBlock': (12, 18, 1), 'RuinStairs': (18, 18, 1), 'RuinTower': (26, 18, 1),
           'FarIsle0': (-20, -18, 5), 'FarIsle1': (-8, -18, 5), 'FarIsle2': (4, -18, 5),
           'FarMount0': (16, -18, 5), 'FarMount1': (26, -18, 5), 'FarMount2': (36, -18, 5)}
    saved = {o.name: o.matrix_world.copy() for o in ALL}
    for o in ALL:
        x, y, s = lay[o.name]
        o.location = V(x, 0 if o.name.startswith('Ruin') else 12, y)
        o.scale = (s, s, s)
    preview(os.path.join(PREV, 'isles_a.png'), target=(0, 4, 0), dist=70, yaw=0, pitch=12, res=(1400, 800))
    preview(os.path.join(PREV, 'isles_b.png'), target=(0, 6, 10), dist=26, yaw=10, pitch=-8, res=(1200, 700))
    preview(os.path.join(PREV, 'isles_c.png'), target=(5, 5, 18), dist=30, yaw=0, pitch=10, res=(1200, 600))
    for o in ALL:
        o.matrix_world = saved[o.name]
        o.scale = (1, 1, 1)
export(OUT, ALL)
