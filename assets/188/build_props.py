# 188 彩筆曠野：場景物件（樹、岩石、草、花、水晶祭壇、寶箱、遺跡入口、小屋、機關……）
# 重建：/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P assets/188/build_props.py
#   環境變數：OUT=輸出 glb（預設 assets/188/props.glb）、RENDER=1 預覽圖存到 PREV、AO=烘焙取樣數
# 每個物件的原點都在底部中心（寶箱蓋在鉸鏈），大小對齊網頁原本程式建模的尺寸。
# 材質名稱：fixed（頂點色就是顏色）、c1（網頁會乘上顏色，例如水晶、彈花）、glow（自發光）、flat（平面著色的寶石）
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


def finish(objs, name, ao=True, dec=None, floor=.6):
    """烘 AO、合併成一個物件、原點放在 (0,0,0)"""
    objs = [o for o in objs if o]
    if AO and ao:
        ao_bake(objs, samples=AO, strength=1.1, floor=floor)
    ob = join(objs, name) if len(objs) > 1 else objs[0]
    ob.name = name
    origin_to(ob, (0, 0, 0))
    if dec:
        decimate(ob, dec)
    ALL.append(ob)
    print(name, 'tris', tri_count([ob]))
    return ob


def nz(p, f=1.0, s=0):
    return noise.noise(Vector((p[0] * f + s, p[1] * f + s * .7, p[2] * f - s)))


def bark(p, n, base=0x6e4a30, dark=0x4a3020):
    k = .5 + .5 * math.sin(math.atan2(p[0], p[2]) * 9 + nz(p, 2) * 3)
    c = mix(dark, base, k * .8 + .2)
    if p[1] < 1.2 and n[2] + n[0] > .4:
        c = mix(c, 0x5d8a3a, sstep(1.2, .2, p[1]) * .7)
    return c


def canopy_col(lo, hi, spec):
    def fn(p, n):
        t = sstep(-.6, .8, n[1] * .8 + (n[0] + n[2]) * .15) * .8 + sstep(3.5, 8.5, p[1]) * .2
        c = mix(lo, hi, t + nz(p, 1.6) * .25)
        if nz(p, 3.2, 5) > .38:
            c = mix(c, spec, .45)
        return c
    return fn


def broadleaf(name, lo, hi, spec, trunk=0x6e4a30, seed=0):
    rnd = random.Random(seed)
    objs = []
    tr = tube(name + 'Trunk', [(0, -.3, 0), (0, 1.4, .06), (.08, 2.8, -.02), (.12, 4.1, .05)], [.56, .4, .32, .24], seg=12)
    objs.append(tr)
    for k in range(5):
        a = k / 5 * TAU + .3
        r = tube(name + 'Root', [(0, .6, 0), (math.cos(a) * .5, .15, math.sin(a) * .5), (math.cos(a) * .85, -.2, math.sin(a) * .85)], [.34, .26, .12], seg=8)
        objs.append(r)
    clumps = [((0, 5.9, 0), 2.35), ((1.5, 5.1, .5), 1.7), ((-1.4, 5.25, -.6), 1.75), ((.35, 5.2, -1.45), 1.6), ((-.5, 5.0, 1.35), 1.55), ((.2, 7.1, .1), 1.5)]
    for (c, r) in clumps:
        c = (c[0] + rnd.uniform(-.2, .2), c[1] + rnd.uniform(-.2, .2), c[2] + rnd.uniform(-.2, .2))
        if c[1] < 6.5:
            br = tube(name + 'Branch', [(c[0] * .1, 3.4, c[2] * .1), (c[0] * .6, c[1] - .6, c[2] * .6)], [.18, .08], seg=6)
            objs.append(br)
        cl = ellipsoid(name + 'Leaf', c, (r, r * .8, r), seg=20, rings=14)
        displace(cl, r * .2, 1.1 / r, seed=seed + len(objs))
        objs.append(cl)
    for o in objs:
        if 'Leaf' in o.name:
            paint(o, canopy_col(lo, hi, spec))
        else:
            paint(o, lambda p, n: bark(p, n, trunk))
    return finish(objs, name, dec=.34)


broadleaf('TreeRound', 0x2f6d2e, 0x8fd35a, 0xb9e36e, seed=1)
broadleaf('TreeAutumn', 0x9a3f1e, 0xf6b344, 0xffd66a, seed=2)

# 松樹：一層層往下垂的針葉
objs = [tube('PineTrunk', [(0, -.3, 0), (0, 2, 0), (0, 5.5, 0), (0, 8.4, 0)], [.36, .28, .18, .05], seg=10)]
for k, (y, r, h) in enumerate([(2.2, 2.7, 2.2), (3.6, 2.25, 2.0), (4.9, 1.8, 1.8), (6.1, 1.35, 1.6), (7.2, .9, 1.4)]):
    lay = lathe('PineLayer', [(.1, 0), (r * .55, .15), (r, -.15), (r * .92, .05), (r * .5, h * .55), (.05, h)], seg=16,
                pivot=(0, y, 0), wobble=lambda a, yy, k=k: .16 * math.sin(a * 8 + k) * sstep(.6, 0, yy))
    objs.append(lay)
for o in objs:
    if 'Trunk' in o.name:
        paint(o, lambda p, n: bark(p, n, 0x6a4a34, 0x3e2a1e))
    else:
        paint(o, lambda p, n: mix(0x1f5a44, 0x62a86a, sstep(-.3, .8, n[1]) * .6 + nz(p, 2) * .25 + sstep(.3, 1, (p[0] ** 2 + p[2] ** 2) ** .5 / 2.6) * .3))
finish(objs, 'Pine', dec=.8)

# 棕櫚樹：一節一節的彎樹幹、七片羽狀葉、椰子
pts = [(0, 0, 0), (.1, 1.5, 0), (.35, 3, 0), (.75, 4.4, 0), (1.25, 5.7, 0)]
objs = [tube('PalmTrunk', pts, [.32, .26, .23, .2, .18], seg=10)]
top = Vector(pts[-1])
for k in range(7):
    a = k / 7 * TAU
    d = Vector((math.cos(a), 0, math.sin(a)))
    fp = [top, top + d * 1.1 + Vector((0, .55, 0)), top + d * 2.2 + Vector((0, .35, 0)), top + d * 3.1 + Vector((0, -.35, 0)), top + d * 3.6 + Vector((0, -1.05, 0))]
    lf = tube('Frond', [tuple(q) for q in fp], [.08, .5, .5, .35, .02], seg=8, flat=.06, up=(0, 1, 0))
    each_vert(lf, lambda p, a=a: (p[0], p[1] + .12 * math.sin(p[0] * 9 + p[2] * 9), p[2]))
    objs.append(lf)
for k in range(3):
    a = k / 3 * TAU
    objs.append(ellipsoid('Coco', (top.x + math.cos(a) * .25, top.y - .25, top.z + math.sin(a) * .25), (.17, .19, .17), seg=10, rings=8))
for o in objs:
    if 'Trunk' in o.name:
        paint(o, lambda p, n: mix(0x8a6a44, 0xc9a26c, .5 + .5 * math.sin(p[1] * 9)))
    elif 'Coco' in o.name:
        paint(o, lambda p, n: 0x6b4a2a)
    else:
        paint(o, lambda p, n: mix(0x2f7a3a, 0x9ad25a, sstep(-.2, .9, n[1]) * .7 + nz(p, 3) * .2))
finish(objs, 'Palm', dec=.85)

# 仙人掌：有稜的柱子、兩隻手、頂上小花
rib = lambda a, y: .1 * math.cos(a * 10)
objs = [lathe('CactusBody', [(.55, -.2), (.62, .5), (.6, 3.2), (.5, 3.9), (.28, 4.3), (0, 4.4)], seg=30, wobble=rib)]
for s, y0, h in ((1, 1.6, 1.4), (-1, 2.2, 1.1)):
    objs.append(tube('CactusArm', [(0, y0, 0), (s * .9, y0 - .1, 0), (s * 1.15, y0 + .3, 0), (s * 1.15, y0 + h, 0)], [.34, .32, .3, .26], seg=12))
    objs.append(ellipsoid('CactusCap', (s * 1.15, y0 + h, 0), (.26, .2, .26), seg=12, rings=8))
for k in range(3):
    objs.append(ellipsoid('CactusFlower', (math.cos(k * 2.1) * .2, 4.35, math.sin(k * 2.1) * .2), (.14, .08, .14), seg=10, rings=6))
for o in objs:
    if 'Flower' in o.name:
        paint(o, lambda p, n: 0xff7ab8)
    else:
        paint(o, lambda p, n: mix(0x3f8a44, 0x86c460, .5 + .5 * math.cos(math.atan2(p[0], p[2]) * 10) * .6 + nz(p, 2) * .2) if abs(math.cos(math.atan2(p[0], p[2]) * 10 * 2)) < .95 else 0xf3eecb)
finish(objs, 'Cactus', dec=.75)

# 岩石三種
for k in range(3):
    rk = ico('Rock%d' % k, (0, .15, 0), (1, .72, 1.08), sub=4)
    displace(rk, .22, 1.3, seed=k * 11, octaves=4)
    each_vert(rk, lambda p: (p[0] + (.25 if p[1] > .3 else 0) * (k - 1) * .3, max(p[1], -.25), p[2]))
    paint(rk, lambda p, n, k=k: mix(mix(0x8d857a, 0xcfc4b2, .5 + nz(p, 2.2, k) * .6), 0x77a64a, sstep(.55, .85, n[1]) * .75 if p[1] > .2 else 0))
    for p in rk.data.polygons:
        p.use_smooth = k != 2
    finish([rk], 'Rock%d' % k, dec=.55)

# 草叢：七根彎彎的草葉，底深頂亮
bm = bmesh.new()
rnd = random.Random(7)
for b in range(7):
    a = b / 7 * TAU + rnd.uniform(-.3, .3)
    h = rnd.uniform(.7, 1.15)
    lean = Vector((math.cos(a), 0, math.sin(a))) * rnd.uniform(.15, .35)
    side = Vector((-math.sin(a), 0, math.cos(a))) * .045
    base = Vector((math.cos(a), 0, math.sin(a))) * .08
    prev = None
    for k in range(4):
        t = k / 3
        c = base + lean * t * t + Vector((0, h * t, 0))
        w = (1 - t) * .9 + .1
        v1 = bm.verts.new(V(*(c - side * w))); v2 = bm.verts.new(V(*(c + side * w)))
        if prev:
            bm.faces.new((prev[0], prev[1], v2, v1))
        prev = (v1, v2)
grass = obj_from_bm(bm, 'Grass')
paint(grass, lambda p, n: mix(0x2f6a2a, 0xb9e86e, sstep(0, 1.0, p[1])))
finish([grass], 'Grass', ao=False)

# 花：花瓣（網頁用每株顏色去乘）與莖分開
bm = bmesh.new()
for k in range(5):
    a = k / 5 * TAU
    c = V(math.cos(a) * .12, .5, math.sin(a) * .12)
    bmesh.ops.create_uvsphere(bm, u_segments=6, v_segments=4, radius=.09, matrix=Matrix.Translation(c) @ Matrix.Diagonal((1.2, 1.2, .35, 1)))
fh = obj_from_bm(bm, 'FlowerHead', slot='c1')
paint(fh, lambda p, n: (1, 1, 1))
fc = ellipsoid('FlowerEye', (0, .52, 0), (.06, .04, .06), seg=8, rings=5)
paint(fc, lambda p, n: 0xffe08a)
fc.data.materials[0] = mat('fixed')
finish([fh, fc], 'FlowerHead', ao=False)
st = tube('FlowerStem', [(0, 0, 0), (.03, .25, 0), (0, .48, 0)], .018, seg=5)
lf = ellipsoid('FlowerLeaf', (.08, .18, 0), (.08, .02, .035), seg=6, rings=4)
for o in (st, lf):
    paint(o, lambda p, n: 0x4e9a3e)
finish([st, lf], 'FlowerStem', ao=False)

# ── 水晶祭壇：八角石台、六根長苔的石柱、柱頂托座 ──
objs = []
plat = lathe('ShrineBase', [(6.6, -.8), (6.6, .05), (6.3, .25), (5.2, .25), (5.0, .4), (3.2, .4), (3.0, .55), (0, .55)], seg=8)
for p in plat.data.polygons:
    p.use_smooth = False
objs.append(plat)
for i in range(6):
    a = i / 6 * TAU
    x, z = math.cos(a) * 5.4, math.sin(a) * 5.4
    col = lathe('Pillar', [(.62, .2), (.62, .45), (.5, .5), (.46, 2.9), (.58, 3.05), (.62, 3.35), (.45, 3.45)], seg=8, pivot=(x, 0, z), wobble=lambda a_, y: .04 * math.sin(a_ * 3 + y * 4))
    for p in col.data.polygons:
        p.use_smooth = False
    objs.append(col)
    cup = lathe('Cup', [(.1, 3.4), (.3, 3.5), (.4, 3.75), (.32, 3.8)], seg=10, pivot=(x, 0, z), cap_top=False)
    objs.append(cup)
ring = lathe('ShrineRing', [(2.6, .54), (2.8, .6), (2.8, .66), (2.6, .66)], seg=32, cap_top=False, cap_bot=False)
objs.append(ring)
ped = lathe('GemSeat', [(1.6, .5), (1.5, .9), (1.1, 1.1), (1.2, 1.35), (.9, 1.45)], seg=8)
objs.append(ped)


def stone(p, n):
    c = mix(0xb8ad9a, 0xe8dfcc, .5 + nz(p, 1.3) * .5)
    if (n[1] > .5 and nz(p, .8, 3) > .05) or (p[1] < .9 and nz(p, 1.1, 9) > .25):
        c = mix(c, 0x6f9a44, .7)
    if abs(p[1] - 1.7) < .06 and ((p[0] ** 2 + p[2] ** 2) ** .5) > 4.9:
        c = mix(c, 0x6f6658, .8)
    return c


for o in objs:
    paint(o, stone if o.name.split('.')[0] not in ('ShrineRing',) else (lambda p, n: 0xd6c49a))
sh = finish(objs, 'Shrine')
for p in sh.data.polygons:
    p.use_smooth = False
# 寶石：多面、平面著色，顏色由網頁上
gem = lathe('Gem', [(0, 0), (.9, .9), (1.25, 2.1), (1.05, 3.3), (0, 4.4)], seg=7, slot='flat')
for p in gem.data.polygons:
    p.use_smooth = False
paint(gem, lambda p, n: mix((.55, .55, .6), (1, 1, 1), sstep(0, 4.4, p[1]) * .6 + max(0, n[0]) * .4))
finish([gem], 'Gem', ao=False)
cage = ico('GemShell', (0, 2.2, 0), (1.9, 2.9, 1.9), sub=1, slot='shell')
for p in cage.data.polygons:
    p.use_smooth = False
paint(cage, lambda p, n: 0x8d8799)
finish([cage], 'GemShell', ao=False)

# ── 寶箱：木板、鐵條、金扣；蓋子另一個物件，原點在鉸鏈 ──
objs = [rbox('ChestBox', (0, .55, 0), (2.0, 1.1, 1.4), bevel=.08, seg=2)]
dice(objs[0], 3)
for x in (-.62, .62):
    objs.append(rbox('ChestBand', (x, .56, 0), (.16, 1.14, 1.44), bevel=.03, seg=1))
objs.append(rbox('ChestLock', (0, 1.0, .72), (.36, .42, .1), bevel=.04, seg=2))


def wood(p, n):
    c = mix(0x7a4520, 0xb06a34, .55 + .45 * math.sin(p[1] * 22 + nz(p, 3) * 2))
    if abs((p[1] * 4.5) % 1 - .5) > .46:
        c = mix(c, 0x3e2210, .7)
    return c


for o in objs:
    nm = o.name
    paint(o, (lambda p, n: mix(0x5b5f68, 0x9aa1ac, .5 + n[1] * .3)) if 'Band' in nm else (lambda p, n: mix(0xc99a34, 0xffe07a, .5 + n[1] * .5)) if 'Lock' in nm else wood)
cb = finish(objs, 'Chest')
lid = tube('ChestLid', [(-1.0, 0, 0), (1.0, 0, 0)], .7, seg=16, flat=1.0, up=(0, 0, -1))
each_vert(lid, lambda p: (p[0], max(p[1], 0) * .85, p[2]))
paint(lid, wood)
lidband = [tube('LidBand', [(x - .08, 0, 0), (x + .08, 0, 0)], .72, seg=16) for x in (-.62, .62)]
for o in lidband:
    each_vert(o, lambda p: (p[0], max(p[1], 0) * .86, p[2]))
    paint(o, lambda p, n: mix(0x5b5f68, 0x9aa1ac, .5 + n[1] * .3))
ld = finish([lid] + lidband, 'ChestLid')
each_vert(ld, lambda p: (p[0], p[1], p[2] + .7))   # 讓原點落在後緣鉸鏈
ld.location = V(0, 1.1, -.7)

# ── 遺跡入口：兩根刻紋石柱、門楣、垂下的藤蔓、台階 ──
objs = []
for s in (-1, 1):
    for k in range(4):
        w = 1.8 - k * .08
        blk = rbox('ArchBlock', (s * 3.2 + random.uniform(-.05, .05), .9 + k * 1.75, 0), (w, 1.7, w), bevel=.12, seg=2)
        displace(blk, .05, 2.5, seed=k + s * 5)
        objs.append(blk)
objs.append(rbox('Lintel', (0, 7.6, 0), (9.2, 1.5, 2.2), bevel=.18, seg=2)); dice(objs[-1], 4)
objs.append(rbox('LintelTop', (0, 8.55, 0), (7.4, .5, 1.8), bevel=.12, seg=2))
objs.append(rbox('Step', (0, .12, 1.6), (6, .3, 1.4), bevel=.06, seg=1))
for k in range(7):
    x = -3.8 + k * 1.25 + random.uniform(-.3, .3)
    ln = random.uniform(1.2, 3.2)
    objs.append(tube('Vine', [(x, 6.9, 1.12), (x + .15, 6.9 - ln * .5, 1.18), (x - .1, 6.9 - ln, 1.15)], [.07, .06, .03], seg=5))


def ruin(p, n):
    c = mix(0x9c9384, 0xd6cdb8, .5 + nz(p, 1.1) * .6)
    if n[1] > .6 or nz(p, .7, 4) > .3:
        c = mix(c, 0x5f8a3a, .65)
    if abs(p[2] - 1.1) < .02 or (abs(p[1] - 7.6) < .25 and abs(p[0]) < 1.4 and p[2] > 1.05):
        c = mix(c, 0x4f4a42, .7)
    return c


for o in objs:
    paint(o, (lambda p, n: mix(0x3f7a30, 0x7ab84a, nz(p, 3) + .5)) if 'Vine' in o.name else ruin)
finish(objs, 'Arch')

# ── 畫室小屋 ──
objs = [rbox('HutWall', (0, 2.2, 0), (7, 4.4, 6), bevel=.12, seg=2)]
dice(objs[0], 6)
roof = lathe('HutRoof', [(5.4, 0), (5.3, .25), (0, 3.6)], seg=4, pivot=(0, 4.3, 0), wobble=lambda a, y: .03 * math.sin(y * 12))
roof.rotation_euler = (0, 0, math.pi / 4)
objs.append(roof)
objs.append(rbox('Chimney', (2, 6.3, -1.2), (.9, 2.4, .9), bevel=.08, seg=1))
objs.append(rbox('HutDoor', (0, 1.3, 3.02), (1.6, 2.6, .18), bevel=.06, seg=1))
for x in (-2.2, 2.2):
    objs.append(rbox('Window', (x, 2.6, 3.04), (1.3, 1.1, .14), bevel=.05, seg=1))
    objs.append(rbox('FlowerBox', (x, 1.9, 3.15), (1.4, .3, .35), bevel=.04, seg=1))
    for k in range(5):
        objs.append(ellipsoid('BoxFlower', (x - .5 + k * .25, 2.12, 3.18), (.1, .1, .1), seg=8, rings=5))
for k in range(4):
    objs.append(tube('Beam', [(-3.52, .1 + k * 1.45, 3.02), (3.52, .1 + k * 1.45, 3.02)], .09, seg=4) if k in (0, 3) else None)
objs = [o for o in objs if o]
for o in objs:
    nm = o.name
    if 'Roof' in nm:
        paint(o, lambda p, n: mix(0xa8382e, 0xf06a4e, .5 + .5 * math.sin(p[1] * 14)))
    elif 'Chimney' in nm:
        paint(o, lambda p, n: mix(0x8a7a6a, 0xb8a894, nz(p, 4) + .5))
    elif 'Door' in nm or 'Beam' in nm:
        paint(o, wood)
    elif 'Window' in nm:
        paint(o, lambda p, n: 0x7fc4e8 if n[2] > .8 and abs(p[0] - round(p[0] / 2.2) * 2.2) < .5 else 0x7a4a2a)
    elif 'FlowerBox' in nm:
        paint(o, lambda p, n: 0x6a8a3a)
    elif 'BoxFlower' in nm:
        c = random.choice([0xff5a4e, 0x3aa7ff, 0xffd23f, 0xf7f3ff])
        paint(o, lambda p, n, c=c: c)
    else:
        spl = [(random.choice([0xff5a4e, 0x3aa7ff, 0xffd23f, 0x5bd46a]), Vector((random.uniform(-3, 3), random.uniform(.4, 3.6), 3.0)), random.uniform(.15, .3)) for _ in range(9)]
        paint(o, lambda p, n, spl=spl: next((c for c, q, r in spl if n[2] > .8 and (Vector(p) - q).length < r), mix(0xe9dcc4, 0xfff6e6, nz(p, 1.5) + .5)))
finish(objs, 'Hut')

# 畫架、告示牌
objs = []
for s in (-1, 1):
    objs.append(tube('EaselLeg', [(s * .7, 0, .15), (s * .2, 3.1, 0)], .06, seg=6))
objs.append(tube('EaselBack', [(0, 0, -.8), (0, 2.8, 0)], .05, seg=6))
objs.append(rbox('EaselBar', (0, 1.35, .12), (1.8, .1, .12), bevel=.02, seg=1))
cv = rbox('Canvas', (0, 2.2, .16), (2.2, 1.7, .08), bevel=.02, seg=1)
objs.append(cv)
for o in objs:
    if o.name.startswith('Canvas'):
        bl = [(c, Vector((random.uniform(-.8, .8), random.uniform(1.6, 2.9), .2)), random.uniform(.12, .3)) for c in (0xff5a4e, 0x3aa7ff, 0xffd23f, 0x5bd46a, 0x3aa7ff, 0x5bd46a)]
        paint(o, lambda p, n, bl=bl: next((c for c, q, r in bl if n[2] > .5 and (Vector(p) - q).length < r), 0xfffaf0))
    else:
        paint(o, wood)
subsurf(cv, 1)
paint(cv, lambda p, n, bl=bl: next((c for c, q, r in bl if n[2] > .5 and (Vector(p) - q).length < r), 0xfffaf0))
finish(objs, 'Easel')
objs = [tube('SignPost', [(0, 0, 0), (0, 2.2, 0)], .09, seg=8), rbox('SignBoard', (0, 2.2, .1), (2.2, 1.2, .15), bevel=.05, seg=2)]
paint(objs[0], wood)
paint(objs[1], lambda p, n: 0x4a3322 if n[2] > .8 and abs((p[1] - 2.2) * 5 % 1 - .5) < .12 and abs(p[0]) < .8 else mix(0xd8b98a, 0xf2dcb0, nz(p, 3) + .5))
subsurf(objs[1], 1)
paint(objs[1], lambda p, n: 0x4a3322 if n[2] > .8 and abs((p[1] - 2.2) * 5 % 1 - .5) < .12 and abs(p[0]) < .8 else mix(0xd8b98a, 0xf2dcb0, nz(p, 3) + .5))
finish(objs, 'Sign')

# ── 地城機關 ──
objs = [lathe('TorchPost', [(.55, 0), (.5, .3), (.38, .45), (.34, 2.3), (.5, 2.45), (.66, 2.9), (.6, 3.05), (.4, 3.0)], seg=10, cap_top=True, wobble=lambda a, y: .03 * math.sin(a * 4))]
paint(objs[0], lambda p, n: (mix(0x5b4e46, 0x8f8474, nz(p, 3) + .5)) if p[1] < 2.3 else mix(0x3a302c, 0x6a5a50, n[1] * .5 + .5))
finish(objs, 'Torch')
objs = [rbox('CrateBox', (0, 1.1, 0), (2.6, 2.2, 2.6), bevel=.1, seg=2)]
dice(objs[0], 3)
for y in (.25, 1.95):
    objs.append(rbox('CrateRim', (0, y, 0), (2.72, .32, 2.72), bevel=.05, seg=1))
for s in (-1, 1):
    objs.append(tube('CrateX', [(-1.15, .35, s * 1.31), (1.15, 1.85, s * 1.31)], .1, seg=4, flat=.4))
for o in objs:
    paint(o, (lambda p, n: mix(0x6e4020, 0x8e5a30, nz(p, 3) + .5)) if 'Rim' in o.name or 'X' in o.name else (lambda p, n: mix(0xa06a38, 0xd09656, .5 + .5 * math.sin(p[1] * 9 + nz(p, 2)))))
finish(objs, 'Crate')
door = rbox('DoorSlab', (0, 4, 0), (4, 8, 1.2), bevel=.12, seg=2)
dice(door, 3)
subsurf(door, 1)
paint(door, lambda p, n: 0xffd23f if (abs(p[2]) > .5 and ((p[0] ** 2 + (p[1] - 4.6) ** 2) ** .5 < .55) and ((p[0] ** 2 + (p[1] - 4.6) ** 2) ** .5 > .35)) else
      mix(0x6f6252, 0x9d8f7c, nz(p, 1.2) + .5) if not (abs(p[2]) > .5 and abs((p[1] * 1.2) % 1 - .5) > .45) else 0x4a4036)
finish([door], 'Door')
objs = [lathe('SpringPad', [(0, 0), (1.45, 0), (1.5, .2), (1.3, .38), (0, .42)], seg=24, slot='c2')]
for k in range(8):
    a = k / 8 * TAU
    pet = tube('Petal', [(math.cos(a) * .6, .35, math.sin(a) * .6), (math.cos(a) * 1.5, .5, math.sin(a) * 1.5), (math.cos(a) * 2.1, .32, math.sin(a) * 2.1)], [.16, .42, .05], seg=8, flat=.25, slot='c1')
    objs.append(pet)
for o in objs:
    paint(o, lambda p, n: mix((.72, .72, .72), (1, 1, 1), sstep(-.2, .9, n[1]) * .7 + sstep(.4, 2, (p[0] ** 2 + p[2] ** 2) ** .5) * .3))
finish(objs, 'Spring', floor=.6)
objs = [ellipsoid('SeedPod', (0, .55, 0), (.9, .72, .9), seg=16, rings=12), tube('Sprout', [(0, 1.1, 0), (.1, 1.5, 0), (-.05, 1.9, .05)], [.08, .06, .02], seg=6)]
for k in range(2):
    objs.append(ellipsoid('SproutLeaf', ((-1) ** k * .22, 1.65, 0), (.22, .05, .1), seg=8, rings=6))
paint(objs[0], lambda p, n: mix(0x5a3a22, 0x9a6a3a, .5 + .5 * math.sin(math.atan2(p[0], p[2]) * 6)))
for o in objs[1:]:
    paint(o, lambda p, n: 0x5bd46a)
finish(objs, 'Seed')
objs = []
for k in range(5):
    a = k / 5 * TAU
    pts = [(math.cos(a + t * 2.2) * (1.2 - t * .6), .3 + t * 2.6, math.sin(a + t * 2.2) * (1.2 - t * .6)) for t in (0, .25, .5, .75, 1)]
    objs.append(tube('Thorn', pts, [.26, .22, .18, .13, .04], seg=7))
for k in range(18):
    a = random.uniform(0, TAU); y = random.uniform(.5, 2.6); r = 1.2 - (y - .3) / 2.6 * .5
    d = Vector((math.cos(a), random.uniform(-.2, .4), math.sin(a)))
    b = Vector((math.cos(a) * r, y, math.sin(a) * r))
    objs.append(tube('Spike', [tuple(b), tuple(b + d * .45)], [.07, .005], seg=5))
for o in objs:
    paint(o, (lambda p, n: 0xe6d6a0) if 'Spike' in o.name else (lambda p, n: mix(0x2e5a24, 0x5a8a3a, nz(p, 3) + .5)))
finish(objs, 'Bramble')
ped = lathe('OrbPedestal', [(.9, 0), (.9, .2), (.6, .3), (.5, 1.0), (.75, 1.15), (.78, 1.3)], seg=10)
for p in ped.data.polygons:
    p.use_smooth = False
paint(ped, lambda p, n: mix(0xd8ccb2, 0xf2ead8, nz(p, 2) + .5))
finish([ped], 'OrbPedestal')

# ── 排列預覽 ──
if RENDER:
    layout = {'TreeRound': (-12, -6), 'TreeAutumn': (-5, -8), 'Pine': (2, -8), 'Palm': (9, -7), 'Cactus': (14, -4), 'Rock0': (-13, 3), 'Rock1': (-10, 3), 'Rock2': (-7, 3),
              'Grass': (-4, 4), 'FlowerHead': (-3, 4.5), 'FlowerStem': (-3, 4.5), 'Shrine': (4, 3), 'Gem': (4, 3), 'Chest': (-10, 9), 'ChestLid': (-10, 9), 'Arch': (13, 6),
              'Hut': (-18, 4), 'Easel': (-4, 9), 'Sign': (-1, 9), 'Torch': (2, 11), 'Crate': (5, 11), 'Door': (9, 13), 'Spring': (-7, 13), 'Seed': (-3, 13), 'Bramble': (0, 14),
              'OrbPedestal': (-13, 12)}
    saved = {o.name: o.matrix_world.copy() for o in ALL + [ld]}
    for o in ALL:
        k = o.name if o.name in layout else None
        if k:
            x, z = layout[k]
            o.location = V(x, 0, z) + (V(0, 1.1, -.7) if k == 'ChestLid' else Vector((0, 0, 0))) + (V(0, 1.45, 0) if k == 'Gem' else Vector((0, 0, 0)))
    bpy.data.objects['GemShell'].hide_render = True
    preview(os.path.join(PREV, 'props_a.png'), target=(0, 3, 3), dist=38, yaw=0, pitch=22, res=(1200, 700))
    preview(os.path.join(PREV, 'props_b.png'), target=(-6, 2, 4), dist=14, yaw=-25, pitch=18, res=(900, 600))
    preview(os.path.join(PREV, 'props_c.png'), target=(-3, 3, 6), dist=30, yaw=180, pitch=15, res=(1200, 600))
    for o in ALL:
        if o.name in saved:
            o.matrix_world = saved[o.name]
    bpy.data.objects['GemShell'].hide_render = False
ld.location = V(0, 1.1, -.7)
cb_lid = bpy.data.objects['ChestLid']
set_parent(cb_lid, bpy.data.objects['Chest'])
export(OUT, [o for o in ALL if o.parent is None])
