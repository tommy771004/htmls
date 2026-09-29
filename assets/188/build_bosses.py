# 188 彩筆曠野：三隻頭目（荊棘樹精、熔岩蠑螈、灰寂巨像）；雷羽鳥沿用 enemies.glb 的鳥類模板放大
# 重建：/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P assets/188/build_bosses.py
#   環境變數：OUT=輸出 glb（預設 assets/188/bosses.glb）、RENDER=1 預覽圖存到 PREV、AO=烘焙取樣數
# 零件名稱對應網頁的頭目程式（名稱後面的 __序號 會被去掉）：
#   B_thornmaw：Face（EyeL、EyeR）、Armor（16 根荊棘）、ArmL、ArmR
#   B_magmander：Skin 類零件用 c1 材質（熱／冷換色）、Leg0~3、Tail0~4、Spot0~5、Crack
#   B_colossus：LegA、LegB、Torso（Head、ArmA、ArmB）；A 在 -x、B 在 +x
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from bw_lib import *

OUT = os.environ.get('OUT', os.path.join(HERE, 'bosses.glb'))
PREV = os.environ.get('PREV', '/tmp/bw188')
RENDER = os.environ.get('RENDER', '1') == '1'
AO = int(os.environ.get('AO', '16'))
os.makedirs(PREV, exist_ok=True)
reset()
random.seed(4)
ROOTS = []
_n = [0]


def nz(p, f=1.0, s=0):
    return noise.noise(Vector((p[0] * f + s, p[1] * f + s * .7, p[2] * f - s)))


def C(ob, fn):
    paint(ob, fn if callable(fn) else (lambda p, n: fn))
    return ob


def M(ob, slot):
    ob.data.materials[0] = mat(slot)
    return ob


def group(name, pos, children):
    e = empty(name, pos)
    for c in children:
        set_parent(c, e)
    return e


def boss(name, build):
    before = set(o.name for o in bpy.context.scene.objects)
    build()
    objs = [o for o in bpy.context.scene.objects if o.name not in before]
    meshes = [o for o in objs if o.type == 'MESH']
    if AO:
        ao_bake(meshes, samples=AO, strength=1.0, floor=.55)
    for o in objs:
        o.name = o.name.split('.')[0] + '__%d' % _n[0]
        _n[0] += 1
    root = empty('B_' + name, (0, 0, 0))
    for o in objs:
        if o.parent is None:
            set_parent(o, root)
    print(name, 'tris', tri_count(meshes))
    ROOTS.append(root)
    root.location = V(len(ROOTS) * 40, 0, 0)
    return root


def bark(p, n):
    k = .5 + .5 * math.sin(math.atan2(p[0], p[2]) * 14 + nz(p, 1.5) * 3)
    c = mix(0x4a3020, 0x7a5238, k)
    if n[1] > .5 or (p[1] < .8 and nz(p, .9, 3) > .1):
        c = mix(c, 0x5d8a3a, .6)
    return c


def thornmaw():
    stump = lathe('Stump', [(2.9, -.2), (2.7, .4), (2.45, 1.2), (2.35, 3.0), (2.25, 4.2), (2.0, 4.45), (.3, 4.5)], seg=32,
                  wobble=lambda a, y: .06 * math.sin(a * 9 + y * 2) + .04 * math.sin(a * 23))
    C(stump, bark)
    roots = []
    for k in range(7):
        a = k / 7 * TAU + .2
        roots.append(C(tube('Root', [(math.cos(a) * 2.2, 1.0, math.sin(a) * 2.2), (math.cos(a) * 3.2, .3, math.sin(a) * 3.2), (math.cos(a) * 4.2, -.2, math.sin(a) * 4.2)], [.7, .45, .12], seg=10), bark))
    crown = []
    for (c, r) in [((0, 5.0, 0), 2.9), ((1.6, 5.8, .5), 1.8), ((-1.4, 5.6, -.7), 1.9), ((.3, 6.4, -1.2), 1.5), ((-.4, 6.2, 1.2), 1.4)]:
        cl = ellipsoid('Crown', c, (r, r * .62, r), seg=20, rings=12)
        displace(cl, r * .22, 1.1 / r, seed=len(crown))
        crown.append(C(cl, lambda p, n: mix(0x2f6d2e, 0x8fd35a, sstep(-.5, .9, n[1]) * .8 + nz(p, 1.3) * .2)))
    # 臉：凹下去的樹洞眼睛與嘴
    eyes_ = []
    for s, nm in ((-1, 'EyeL'), (1, 'EyeR')):
        e = M(C(ellipsoid(nm, (s * .8, 3.1, 2.3), (.46, .34, .2), seg=16, rings=10), (1, 1, 1)), 'glow')
        brow = C(tube('Brow', [(s * 1.35, 3.65, 2.15), (s * .35, 3.45, 2.42)], [.16, .12], seg=6), 0x3a2618)
        eyes_ += [e, brow]
    mouth = C(ellipsoid('Mouth', (0, 2.0, 2.28), (1.05, .42, .2), seg=18, rings=10), 0x1a0e0a)
    fangs = [C(tube('Fang', [(x, 2.3, 2.36), (x, 1.95, 2.42)], [.12, .01], seg=5), 0xe8dcc0) for x in (-.6, -.2, .2, .6)]
    group('Face', (0, 2.8, 2.25), eyes_ + [mouth] + fangs)
    thorns = []
    for i in range(16):
        a = i / 16 * TAU
        y = 1 + (i % 4) * .9
        b = Vector((math.cos(a) * 2.35, y, math.sin(a) * 2.35))
        d = Vector((math.cos(a), .35, math.sin(a))).normalized()
        vine = tube('ThornVine', [tuple(b + Vector((math.sin(a) * .5, -.3, -math.cos(a) * .5))), tuple(b), tuple(b + Vector((-math.sin(a) * .5, .3, math.cos(a) * .5)))], .14, seg=6)
        sp = tube('Spike', [tuple(b), tuple(b + d * .7), tuple(b + d * 1.35 + Vector((0, .25, 0)))], [.2, .1, .01], seg=7)
        C(vine, lambda p, n: mix(0x2e5a24, 0x4f8a3a, nz(p, 3) + .5))
        C(sp, lambda p, n: mix(0x3f7a2a, 0xd8cf9a, sstep(0, 1.4, (Vector(p) - b).length)))
        t = join([vine, sp], 'Thorn')
        thorns.append(t)
    group('Armor', (0, 0, 0), thorns)
    for s, nm in ((-1, 'ArmL'), (1, 'ArmR')):
        pts = [(s * (2.4 + i * .8), 3 - i * .15 + math.sin(i) * .15, math.cos(i * 1.3) * .2) for i in range(7)]
        arm = C(tube(nm + 'M', pts, [.55, .5, .45, .4, .34, .26, .1], seg=10), lambda p, n: mix(0x3e6a2e, 0x6a9a44, nz(p, 2) + .5))
        leaves = [C(ellipsoid('ArmLeaf', (pts[k][0], pts[k][1] + .45, pts[k][2]), (.35, .08, .2), seg=8, rings=5), 0x6fbf4a) for k in (1, 3, 5)]
        a = join([arm] + leaves, nm)
        origin_to(a, (s * 2.4, 3, 0))


boss('thornmaw', thornmaw)


def magmander():
    def skin(ob):
        paint(ob, lambda p, n: (lambda k: (k, k, k))(.75 + .25 * (.5 + .4 * n[1] + .2 * nz(p, 1.5))))
        return M(ob, 'c1')
    body = skin(ellipsoid('Body', (0, 1.6, 0), (2.1, 1.25, 3.1), seg=28, rings=18))
    each_vert(body, lambda p: (p[0], p[1] + max(0, 1 - abs(p[0]) / 1.2) * .25 * (p[1] > 1.6), p[2]))
    ridge = [skin(tube('Ridge', [(0, 2.7, z), (0, 3.25, z - .3)], [.28, .02], seg=6)) for z in (-1.8, -1.0, -.2, .6, 1.4)]
    hd = skin(ellipsoid('HeadM', (0, 2.0, 3.35), (1.35, 1.0, 1.55), seg=22, rings=14))
    each_vert(hd, lambda p: (p[0] * (1 + max(0, p[2] - 3.5) * .15), p[1], p[2]))
    jaw = skin(ellipsoid('Jaw', (0, 1.55, 3.6), (1.15, .45, 1.3), seg=18, rings=10))
    horns = [skin(tube('Horn', [(s * .7, 2.7, 3.0), (s * 1.1, 3.3, 2.6), (s * 1.2, 3.6, 2.0)], [.2, .12, .02], seg=7)) for s in (-1, 1)]
    ey = []
    for s in (-1, 1):
        ey.append(C(ellipsoid('EyeW', (s * .55, 2.45, 4.45), (.3, .28, .15), seg=12, rings=8), 0xfff6c0))
        ey.append(C(ellipsoid('Pupil', (s * .55, 2.43, 4.56), (.1, .2, .06), seg=8, rings=6), 0x1a0a0a))
    teeth = [C(tube('Tooth', [(x, 1.9, 4.75), (x, 1.62, 4.8)], [.08, .005], seg=4), 0xfff0d0) for x in (-.5, -.2, .2, .5)]
    group('Head', (0, 2.0, 3.35), [hd, jaw] + horns + ey + teeth)
    for i in range(4):
        x, z = (1.9 if i % 2 else -1.9), (1.6 if i < 2 else -1.4)
        lg = skin(tube('LegM', [(x * .8, 1.2, z), (x * 1.15, .8, z + .1), (x * 1.25, .12, z + .35)], [.55, .45, .38], seg=10))
        cl = [C(tube('Claw', [(x * 1.25 + k * .15, .1, z + .55), (x * 1.25 + k * .2, .02, z + .85)], [.08, .01], seg=4), 0x2a1a14) for k in (-1, 0, 1)]
        L = join([lg] + cl, 'Leg%d' % i)
        origin_to(L, (x * .8, 1.2, z))
    for i in range(5):
        s = 1 - i * .15
        t = skin(ellipsoid('Tail%d' % i, (0, 1.4 - i * .15, -3.2 - i * 1.1), (s, .8 * s, s * 1.15), seg=16, rings=10))
        origin_to(t, (0, 1.4 - i * .15, -3.2 - i * 1.1))
    for i in range(6):
        x, z = random.uniform(-1.2, 1.2), random.uniform(-2, 2)
        M(C(ellipsoid('Spot%d' % i, (x, 2.78 + (1.2 - abs(x)) * .1, z), (.35, .12, .35), seg=12, rings=6), (1, .85, .4)), 'glow')
    cracks = []
    for i in range(9):
        x, z = random.uniform(-1.5, 1.5), random.uniform(-2.2, 2.2)
        a = random.uniform(0, math.pi)
        cracks.append(M(C(tube('CrackLine', [(x - math.cos(a) * .6, 2.86, z - math.sin(a) * .6), (x, 2.9, z), (x + math.cos(a) * .7, 2.84, z + math.sin(a) * .7 + .2)], .06, seg=4), (1, .8, .3)), 'glow'))
    group('Crack', (0, 0, 0), cracks)


boss('magmander', magmander)


def colossus():
    def stone(p, n, dark=False):
        c = mix(0x6f6982, 0xa9a2bc, .5 + nz(p, .35) * .6)
        if dark:
            c = mix(c, 0x4f4a60, .45)
        if n[1] > .6 and nz(p, .5, 3) > .15:
            c = mix(c, 0x6f8a52, .55)
        return c

    def carve(ob, dark=False):
        dice(ob, 1)
        paint(ob, lambda p, n: stone(p, n, dark))
        return ob

    def glow_line(name, pts, r=.12):
        return M(C(tube(name, pts, r, seg=5), (.8, .95, 1)), 'glow')
    for s, nm in ((-1, 'LegA'), (1, 'LegB')):
        x = s * 3.2
        thigh = carve(rbox('Thigh', (x, 6.4, 0), (3.2, 5.2, 3.2), bevel=.4, seg=2))
        knee = carve(rbox('Knee', (x, 4.2, .1), (3.5, 1.4, 3.5), bevel=.35, seg=2), True)
        shin = carve(rbox('Shin', (x, 2.2, 0), (2.9, 3.6, 2.9), bevel=.35, seg=2))
        foot = carve(rbox('Foot', (x, .45, .5), (3.6, .9, 4.4), bevel=.3, seg=2), True)
        lines = [glow_line('Rune', [(x - 1.0, 7.8, 1.62), (x, 7.2, 1.62), (x + 1.0, 7.8, 1.62)]), glow_line('Rune', [(x, 3.6, 1.47), (x, 1.2, 1.47)])]
        L = join([thigh, knee, shin, foot] + lines, nm)
        origin_to(L, (x, 9, 0))
    torso_parts = [carve(rbox('Chest', (0, 14.2, 0), (11, 8.5, 6), bevel=.8, seg=2)), carve(rbox('Waist', (0, 10, 0), (8, 2.2, 6.4), bevel=.5, seg=2), True)]
    for s in (-1, 1):
        torso_parts.append(carve(rbox('Shoulder', (s * 6.3, 17.3, 0), (3.4, 2.4, 4.2), bevel=.6, seg=2), True))
    torso_parts += [glow_line('Rune', [(-3, 15.5, 3.02), (-1.5, 13.5, 3.02), (0, 15, 3.02), (1.5, 13.5, 3.02), (3, 15.5, 3.02)], .16),
                    glow_line('Rune', [(-2.2, 11.6, 3.05), (2.2, 11.6, 3.05)], .14)]
    moss = [C(ellipsoid('Moss', (x, 18.3, z), (1.8, .35, 1.4), seg=12, rings=6), 0x6f9a44) for x, z in [(-4, 0), (3.5, .5)]]
    torso = join(torso_parts + moss, 'TorsoM')
    headm = carve(rbox('HeadM', (0, 20.5, .5), (4.4, 4.0, 4.0), bevel=.6, seg=2))
    crest = carve(rbox('Crest', (0, 22.9, 0), (1.2, 1.4, 3.2), bevel=.3, seg=2), True)
    eyeg = [M(C(rbox('Eye', (s * 1.0, 20.8, 2.52), (1.0, .45, .15), bevel=.08, seg=2), (1, 1, 1)), 'glow') for s in (-1, 1)]
    head = group('Head', (0, 20.5, .5), [headm, crest] + eyeg)
    arms = []
    for s, nm in ((-1, 'ArmA'), (1, 'ArmB')):
        x = s * 7
        up = carve(rbox('Upper', (x, 13.5, 0), (2.6, 5.5, 2.6), bevel=.35, seg=2))
        lo = carve(rbox('Lower', (x, 9.3, 0), (2.4, 3.6, 2.4), bevel=.3, seg=2), True)
        fist = carve(rbox('Fist', (x, 6.4, 0), (3.6, 3.2, 3.6), bevel=.6, seg=2))
        rune = glow_line('Rune', [(x - .8, 7.2, 1.82), (x, 6.2, 1.82), (x + .8, 7.2, 1.82)])
        a = join([up, lo, fist, rune], nm)
        origin_to(a, (x, 17, 0))
        arms.append(a)
    tg = group('Torso', (0, 9, 0), [torso, head] + arms)


boss('colossus', colossus)

if RENDER:
    for i, r in enumerate(ROOTS):
        r.location = V([-14, 0, 22][i], 0, 0)
    preview(os.path.join(PREV, 'bosses.png'), target=(4, 8, 0), dist=58, yaw=10, pitch=10, res=(1400, 700))
for r in ROOTS:
    r.location = V(0, 0, 0)
export(OUT, ROOTS)
