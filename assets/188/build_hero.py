# 188 彩筆曠野：主角（小畫家）、巨大畫筆、老畫師帕布
# 重建：/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P assets/188/build_hero.py
#   環境變數：OUT=輸出 glb（預設 assets/188/hero.glb）、RENDER=1 另存預覽圖到 PREV（預設 /tmp/bw188）、AO=烘焙取樣數（0 不烘焙）
# 主角約 5.5 頭身、1.85 公尺；骨架 21 根骨頭，動作：Idle Run Jump Swing1 Swing2 Spin Shoot Fly Hurt
# 畫筆有三份：BrushHand（右手）、BrushBack（背上）、BrushFly（飛行時坐在上面），網頁依狀態切換；筆毛材質 paint 會換成目前顏色
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from bw_lib import *

OUT = os.environ.get('OUT', os.path.join(HERE, 'hero.glb'))
PREV = os.environ.get('PREV', '/tmp/bw188')
RENDER = os.environ.get('RENDER', '1') == '1'
AO = int(os.environ.get('AO', '24'))
os.makedirs(PREV, exist_ok=True)
reset()
random.seed(188)

SKIN, SKIN_SH = 0xf3cfae, 0xe0a88a
HAIR, HAIR_D = 0x6a4128, 0x3e2416
TUNIC, TUNIC_D = 0xf1e6cf, 0xcdbd9c
PANTS = 0x4b4561
LEATHER, LEATHER_D = 0x7b5134, 0x4e321f
STAINS = [0xff5a4e, 0x3aa7ff, 0xffd23f, 0x5bd46a]

# ── 骨架（three 座標，面向 +z；右手在 -x） ──
S = {'R': -1, 'L': 1}
bones = [
    ('hips', (0, .9, 0), (0, 1.04, 0), None),
    ('spine', (0, 1.04, 0), (0, 1.24, 0), 'hips'),
    ('chest', (0, 1.24, 0), (0, 1.44, 0), 'spine'),
    ('neck', (0, 1.44, 0), (0, 1.53, .005), 'chest'),
    ('head', (0, 1.53, .005), (0, 1.86, .01), 'neck'),
    ('scarf1', (0, 1.47, -.1), (.04, 1.3, -.16), 'chest'),
    ('scarf2', (.04, 1.3, -.16), (.07, 1.1, -.2), 'scarf1'),
]
J = {}
for side, s in S.items():
    J[side] = dict(sh0=(s * .05, 1.42, 0), sh=(s * .175, 1.405, -.005), el=(s * .325, 1.19, -.01), wr=(s * .445, .99, .02), hn=(s * .5, .9, .045),
                   hip=(s * .095, .9, 0), kn=(s * .1, .5, .015), an=(s * .1, .1, -.01), toe=(s * .1, .03, .13))
    j = J[side]
    bones += [
        ('shoulder.' + side, j['sh0'], j['sh'], 'chest'),
        ('upperarm.' + side, j['sh'], j['el'], 'shoulder.' + side),
        ('forearm.' + side, j['el'], j['wr'], 'upperarm.' + side),
        ('hand.' + side, j['wr'], j['hn'], 'forearm.' + side),
        ('thigh.' + side, j['hip'], j['kn'], 'hips'),
        ('shin.' + side, j['kn'], j['an'], 'thigh.' + side),
        ('foot.' + side, j['an'], j['toe'], 'shin.' + side),
    ]
rig = armature('HeroRig', bones)
parts = []  # (物件, 骨頭清單)


def add(ob, bl, bake=True):
    parts.append((ob, bl, bake))
    return ob


def vsub(a, b): return Vector(a) - Vector(b)


def lerp3(a, b, t): return tuple(a[i] + (b[i] - a[i]) * t for i in range(3))


# ── 頭 ──
HC = (0, 1.625, 0)
head = ellipsoid('Head', HC, (.148, .168, .156), seg=32, rings=24)


def shape_head(p):
    x, y, z = p
    dy = HC[1] - y
    if dy > 0:
        t = min(1, dy / .168)
        x *= 1 - .3 * t ** 1.6
        if z > 0:
            z *= 1 - .08 * t
        else:
            z *= 1 - .18 * t
    if z < 0:
        z *= 1.07
    return (x, y, z)


each_vert(head, shape_head)


def skin_col(p, n):
    c = SKIN
    for s in (-1, 1):
        d = Vector((p.x - s * .078, p.y - 1.588, p.z - .125)).length
        if d < .045:
            c = mix(c, 0xf2a595, (1 - d / .045) * .75)
    return c


paint(head, skin_col)
add(head, ['head'])
nose = add(ellipsoid('Nose', (0, 1.598, .155), (.013, .017, .013), seg=12, rings=8), ['head'])
paint(nose, lambda p, n: 0xf0c3a0)
mouth = add(tube('Mouth', [(-.022, 1.557, .139), (0, 1.552, .146), (.022, 1.557, .139)], .0045, seg=6), ['head'], False)
paint(mouth, lambda p, n: 0x9a4a44)
# 大眼睛：眼白、虹膜（上深下淺）、瞳孔、亮點
for s in (-1, 1):
    ex, ey, ez = s * .06, 1.623, .128
    sc_ = ellipsoid('EyeW', (ex, ey, ez), (.035, .043, .013), seg=16, rings=10)
    paint(sc_, lambda p, n: 0xfbfaf4)
    iris = ellipsoid('Iris', (ex + s * .002, ey - .002, ez + .007), (.025, .034, .009), seg=16, rings=10)
    paint(iris, lambda p, n, ey=ey: mix(0x2a3a5e, 0x5a9ad0, sstep(ey + .025, ey - .03, p.y)))
    pup = ellipsoid('Pupil', (ex + s * .002, ey - .002, ez + .012), (.012, .018, .005), seg=10, rings=6)
    paint(pup, lambda p, n: 0x10121a)
    hl = ellipsoid('Glint', (ex - s * .008, ey + .014, ez + .016), (.007, .008, .003), seg=8, rings=6)
    paint(hl, lambda p, n: 0xffffff)
    for o in (sc_, iris, pup, hl):
        o.rotation_euler = (0, 0, 0)
        each_vert(o, lambda p, s=s: (p[0], p[1], p[2] - abs(p[0] - s * .06) * .25))
        add(o, ['head'], False)
    brow = tube('Brow', [(s * .028, 1.678, .146), (s * .06, 1.684, .142), (s * .092, 1.674, .124)], [.006, .007, .004], seg=6)
    paint(brow, lambda p, n: HAIR_D)
    add(brow, ['head'], False)
    lash = tube('Lash', [(s * .025, 1.652, .142), (s * .06, 1.664, .143), (s * .094, 1.652, .128)], [.004, .006, .003], seg=6, flat=.5)
    paint(lash, lambda p, n: 0x1a1216)
    add(lash, ['head'], False)
    # 尖耳朵
    ear = tube('Ear', [(s * .142, 1.618, -.01), (s * .18, 1.64, -.03), (s * .22, 1.668, -.052), (s * .25, 1.69, -.07)], [.034, .026, .013, .002], seg=10, flat=.32, up=(0, 0, 1))
    paint(ear, lambda p, n: mix(SKIN, 0xf0b096, .3))
    add(ear, ['head'])

# ── 頭髮 ──
cap = ellipsoid('HairCap', (0, 1.64, -.008), (.162, .178, .168), seg=32, rings=24)
bm = bmesh.new(); bm.from_mesh(cap.data)
kill = [f for f in bm.faces if (lambda c: (c[2] > .02 and c[1] < 1.705) or (c[1] < 1.585 and c[2] > -.07) or c[1] < 1.5)(T(f.calc_center_median()))]
bmesh.ops.delete(bm, geom=kill, context='FACES')
bm.to_mesh(cap.data); bm.free()
paint(cap, lambda p, n: mix(HAIR_D, HAIR, sstep(1.5, 1.72, p.y)))
add(cap, ['head'])
for i, x in enumerate([-.11, -.07, -.03, .01, .05, .09, .12]):
    sw = .035 if x < 0 else .03
    lock = tube('Bang', [(x * .8, 1.78, .06), (x * .95 + sw * .3, 1.745, .15), (x + sw, 1.69, .162), (x + sw * 1.4, 1.648 - abs(x) * .2, .152)], [.034, .03, .02, .003], seg=8, flat=.4)
    paint(lock, lambda p, n: mix(HAIR_D, HAIR, sstep(1.62, 1.76, p.y)))
    add(lock, ['head'])
for s in (-1, 1):
    side = tube('SideLock', [(s * .128, 1.72, .07), (s * .15, 1.64, .1), (s * .148, 1.55, .1), (s * .14, 1.5, .09)], [.03, .026, .016, .003], seg=8, flat=.45)
    paint(side, lambda p, n: mix(HAIR_D, HAIR, sstep(1.5, 1.72, p.y)))
    add(side, ['head'])
for k in range(5):
    a = -.9 + k * .45
    spike = tube('BackLock', [(math.sin(a) * .1, 1.72, -.12 + math.cos(a) * .02), (math.sin(a) * .15, 1.62, -.17), (math.sin(a) * .16, 1.53, -.14)], [.04, .03, .003], seg=8, flat=.5)
    paint(spike, lambda p, n: mix(HAIR_D, HAIR, sstep(1.5, 1.72, p.y)))
    add(spike, ['head'])
pony = tube('Pony', [(0, 1.62, -.17), (.005, 1.55, -.22), (.02, 1.46, -.23), (.03, 1.38, -.2)], [.045, .04, .026, .004], seg=10)
paint(pony, lambda p, n: mix(HAIR_D, HAIR, sstep(1.38, 1.6, p.y)))
add(pony, ['head', 'neck', 'chest'])
tie = add(tube('HairTie', [(0, 1.6, -.185), (.002, 1.585, -.196)], .048, seg=12), ['head'])
paint(tie, lambda p, n: 0xff5a4e)

# ── 貝雷帽（顏色跟著目前的顏料走） ──
beret = lathe('Beret', [(0, 0), (.12, 0), (.172, .018), (.19, .042), (.165, .068), (.09, .084), (0, .088)], seg=28, pivot=(.025, 1.762, -.02))
place(beret, (.025, 1.762, -.02), (-8, 0, -16))
stem = tube('BeretStem', [(0, .085, 0), (.005, .12, 0)], [.012, .006], seg=8, pivot=(.025, 1.762, -.02))
place(stem, (.025, 1.762, -.02), (-8, 0, -16))
for o in (beret, stem):
    o.data.materials[0] = mat('paint')
    paint(o, lambda p, n: (0.9, 0.9, 0.9) if n.y > -.2 else (0.62, 0.62, 0.62))
    add(o, ['head'])

# ── 脖子、上衣 ──
neck = add(tube('Neck', [(0, 1.42, -.01), (0, 1.5, 0), (0, 1.56, .005)], [.052, .05, .05], seg=14), ['chest', 'neck', 'head'])
paint(neck, lambda p, n: mix(SKIN_SH, SKIN, sstep(1.44, 1.55, p.y)))
tunic_prof = [(.212, .7), (.205, .76), (.19, .86), (.172, .95), (.158, 1.05), (.166, 1.17), (.182, 1.29), (.18, 1.37), (.156, 1.43), (.1, 1.48), (.064, 1.5)]
tunic = lathe('Tunic', tunic_prof, seg=36, sz=.72, cap_top=False, cap_bot=False, wobble=lambda a, y: .035 * math.sin(a * 7) * sstep(.9, .7, y))
tunic.data.materials[0] = mat('cloth2s')
subsurf(tunic, 1)
stains = [(random.choice(STAINS), Vector((random.uniform(-.14, .14), random.uniform(.78, 1.34), .2 if random.random() < .75 else -.2)), random.uniform(.018, .04)) for _ in range(11)]


def tunic_col(p, n):
    c = mix(TUNIC_D, TUNIC, sstep(.7, .78, p.y) * .6 + .4)
    c = mix(c, 0xe7d8b8, .5 * (.5 + .5 * math.sin(p.x * 60 + p.y * 20)) * sstep(.9, .72, p.y))
    for col, q, r in stains:
        d = Vector((p.x - q.x, p.y - q.y, (p.z - q.z) * .3)).length
        if d < r:
            c = col
    if p.y > 1.46:
        c = mix(c, TUNIC_D, .6)
    return c


paint(tunic, tunic_col)
add(tunic, ['hips', 'spine', 'chest', 'thigh.L', 'thigh.R', 'shoulder.L', 'shoulder.R'])
# 皮帶、扣環、腰包、斜背帶
belt = lathe('Belt', [(.176, .905), (.182, .925), (.182, .965), (.176, .985)], seg=36, sz=.74, cap_top=False, cap_bot=False)
paint(belt, lambda p, n: LEATHER)
add(belt, ['hips'])
buckle = rbox('Buckle', (0, .945, .136), (.07, .06, .02), bevel=.008, seg=2)
paint(buckle, lambda p, n: 0xd9b25a)
add(buckle, ['hips'])
pouch = rbox('Pouch', (.155, .9, .07), (.07, .09, .06), bevel=.018, seg=3)
paint(pouch, lambda p, n: mix(LEATHER_D, LEATHER, sstep(.86, .95, p.y)))
add(pouch, ['hips'])
strap = tube('Strap', [(-.15, 1.42, .08), (-.08, 1.3, .135), (.02, 1.16, .128), (.11, 1.02, .12), (.17, .95, .07)], .02, seg=6, flat=.3, up=(0, 0, 1))
paint(strap, lambda p, n: LEATHER)
add(strap, ['chest', 'spine', 'hips'])
strapb = tube('StrapB', [(-.15, 1.42, -.06), (-.06, 1.28, -.13), (.05, 1.12, -.125), (.15, .98, -.08), (.17, .95, .07)], .02, seg=6, flat=.3, up=(0, 0, 1))
paint(strapb, lambda p, n: LEATHER)
add(strapb, ['chest', 'spine', 'hips'])

# ── 圍巾（顏色跟著顏料） ──
collar = lathe('Scarf', [(.088, 1.43), (.112, 1.45), (.114, 1.49), (.098, 1.515), (.078, 1.52)], seg=24, sz=.88, cap_top=False, cap_bot=False, wobble=lambda a, y: .06 * math.sin(a * 5))
tail1 = tube('ScarfTail', [(.02, 1.46, -.085), (.045, 1.36, -.14), (.07, 1.24, -.175), (.09, 1.12, -.19)], [.05, .048, .045, .04], seg=10, flat=.22, up=(0, 0, -1))
tail2 = tube('ScarfTail2', [(-.02, 1.46, -.09), (-.01, 1.38, -.15), (.01, 1.28, -.18)], [.045, .042, .036], seg=10, flat=.22, up=(0, 0, -1))
for o in (collar, tail1, tail2):
    o.data.materials[0] = mat('paint')
    paint(o, lambda p, n: (0.95, 0.95, 0.95) if (int(p.y * 60) % 4) else (0.8, 0.8, 0.8))
add(collar, ['neck', 'chest'])
add(tail1, ['chest', 'scarf1', 'scarf2'])
add(tail2, ['chest', 'scarf1', 'scarf2'])

# ── 手臂 ──
for side, s in S.items():
    j = J[side]
    sl = tube('Sleeve' + side, [lerp3(j['sh0'], j['sh'], .45), j['sh'], lerp3(j['sh'], j['el'], .55), lerp3(j['sh'], j['el'], .8)], [.07, .072, .06, .056], seg=16)
    paint(sl, lambda p, n: mix(TUNIC_D, TUNIC, .75))
    add(sl, ['chest', 'shoulder.' + side, 'upperarm.' + side])
    d = vsub(j['el'], j['sh']).normalized()
    c = Vector(lerp3(j['sh'], j['el'], .86))
    roll = tube('Cuff' + side, [tuple(c - d * .022), tuple(c), tuple(c + d * .022)], [.056, .066, .056], seg=16)
    paint(roll, lambda p, n: TUNIC_D)
    add(roll, ['upperarm.' + side])
    fa = tube('Forearm' + side, [lerp3(j['sh'], j['el'], .84), j['el'], lerp3(j['el'], j['wr'], .6), j['wr']], [.05, .047, .042, .036], seg=14)
    wr = Vector(j['wr'])
    paint(fa, lambda p, n, wr=wr: mix(SKIN, LEATHER, sstep(.09, .06, (p - wr).length)))
    add(fa, ['upperarm.' + side, 'forearm.' + side, 'hand.' + side])
    hd = vsub(j['hn'], j['wr']).normalized()
    w = Vector(j['wr'])
    side_v = Vector((0, 0, 1)).cross(hd).normalized() * s
    palm = tube('Hand' + side, [tuple(w + hd * .01), tuple(w + hd * .05), tuple(w + hd * .1), tuple(w + hd * .125)], [.037, .047, .042, .01], seg=12, flat=.62, up=(0, 0, 1))
    paint(palm, lambda p, n, w=w: mix(LEATHER, SKIN, sstep(.07, .1, (p - w).length)))
    add(palm, ['hand.' + side])
    th = tube('Thumb' + side, [tuple(w + hd * .03 + Vector((0, 0, .025))), tuple(w + hd * .06 + Vector((0, 0, .05))), tuple(w + hd * .085 + Vector((0, 0, .05)))], [.016, .014, .01], seg=8)
    paint(th, lambda p, n: SKIN)
    add(th, ['hand.' + side])

# ── 腿與靴子 ──
for side, s in S.items():
    j = J[side]
    leg = tube('Leg' + side, [lerp3(j['hip'], (s * .06, .98, 0), .5), j['hip'], lerp3(j['hip'], j['kn'], .5), j['kn'], lerp3(j['kn'], j['an'], .5), (s * .1, .3, 0)], [.085, .088, .075, .066, .06, .058], seg=16)
    paint(leg, lambda p, n: mix(0x39344b, PANTS, sstep(.3, .9, p.y)))
    add(leg, ['hips', 'thigh.' + side, 'shin.' + side])
    boot = lathe('Boot' + side, [(.058, .07), (.064, .15), (.066, .26), (.072, .32), (.084, .35), (.08, .37), (.064, .36)], seg=18, pivot=(s * .1, 0, -.005), cap_top=False)
    paint(boot, lambda p, n: mix(LEATHER, 0xa0714a, sstep(.31, .35, p.y)))
    add(boot, ['shin.' + side, 'foot.' + side])
    foot = rbox('Foot' + side, (s * .1, .055, .045), (.11, .1, .25), bevel=.045, seg=3)
    each_vert(foot, lambda p: (p[0], p[1] + max(0, p[2] - .1) * -.15 * (p[1] > .05), p[2]))
    paint(foot, lambda p, n: 0x3a2618 if p.y < .02 else LEATHER)
    add(foot, ['shin.' + side, 'foot.' + side])

# ── AO 與權重、合併 ──
bpy.context.view_layer.update()
if AO:
    ao_bake([o for o, b, k in parts if k], samples=AO, strength=1.2, floor=.45)
for o, bl, k in parts:
    skin(o, rig, bl, power=4.5)
hero = join([o for o, b, k in parts], 'Hero')
bind(hero, rig)
print('hero tris', tri_count([hero]))


# ── 畫筆：握點在原點，筆桿朝 +y，筆毛在最上面 ──
def build_brush(name):
    objs = []
    handle = tube(name + 'Handle', [(0, -.32, 0), (0, .2, 0), (0, .9, 0), (0, 1.52, 0)], [.036, .034, .032, .036], seg=14)
    paint(handle, lambda p, n: mix(0x9a6232, 0xc68e52, .5 + .5 * math.sin(p.y * 40 + math.sin(math.atan2(p.x, p.z) * 3) * 2)) if not (-.18 < p.y < .22 and (int((p.y + math.atan2(p.x, p.z) * .02) * 38) % 2)) else 0x8a3a30)
    objs.append(handle)
    pom = ellipsoid(name + 'Pommel', (0, -.35, 0), (.05, .05, .05), seg=14, rings=10)
    paint(pom, lambda p, n: 0xc9a14a)
    objs.append(pom)
    fer = lathe(name + 'Ferrule', [(.04, 1.5), (.056, 1.53), (.058, 1.58), (.05, 1.6), (.058, 1.62), (.062, 1.7), (.052, 1.74)], seg=18)
    paint(fer, lambda p, n: mix(0x9aa3b0, 0xe6ebf0, .5 + .5 * n.y) if abs(p.y - 1.6) > .012 else 0x6c7480)
    objs.append(fer)
    root = lathe(name + 'Bristle', [(.052, 1.73), (.085, 1.8), (.1, 1.88)], seg=24, cap_bot=False, cap_top=False,
                 wobble=lambda a, y: .06 * math.cos(a * 11))
    paint(root, lambda p, n: mix(0xe8dcc0, 0xf6efe0, sstep(1.73, 1.88, p.y)))
    objs.append(root)
    tip = lathe(name + 'Paint', [(.1, 1.88), (.118, 1.98), (.118, 2.1), (.1, 2.22), (.066, 2.32), (.03, 2.39), (0, 2.42)], seg=24, cap_bot=False,
                wobble=lambda a, y: .07 * math.cos(a * 11 + y * 6) * sstep(2.4, 1.9, y))
    tip.data.materials[0] = mat('paint')
    paint(tip, lambda p, n: (0.72, 0.72, 0.72) if p.y < 1.93 else (.92 + .08 * math.cos(math.atan2(p.x, p.z) * 11), ) * 3)
    objs.append(tip)
    if AO:
        ao_bake(objs, samples=max(8, AO // 2), strength=1, floor=.55)
    b = join(objs, name)
    tipe = empty(name + 'Tip', (0, 2.42, 0))
    set_parent(tipe, b)
    return b


# 靜止姿勢下擺好三份畫筆，再掛到骨頭上
wr, hn = Vector(J['R']['wr']), Vector(J['R']['hn'])
grip = tuple(wr + (hn - wr) * .5 + Vector((0, 0, .01)))
bh = build_brush('BrushHand'); place(bh, grip, (90, 0, 0)); parent_bone(bh, rig, 'hand.R')
bb = build_brush('BrushBack'); place(bb, (-.2, .62, -.19), (-6, 0, -33)); parent_bone(bb, rig, 'chest')
bf = build_brush('BrushFly'); place(bf, (0, .52, .95), (-90, 0, 0)); parent_bone(bf, rig, 'hips')

# ── 動作 ──
F = 30
relax = {'upperarm.R': (6, 0, 24), 'upperarm.L': (6, 0, -24), 'forearm.R': (-14, 0, 0), 'forearm.L': (-14, 0, 0), 'hand.R': (0, 0, 6), 'hand.L': (0, 0, -6)}


def pose(**kw):
    d = dict(relax)
    for k, v in kw.items():
        d[k.replace('_', '.')] = v
    return d


action(rig, 'Idle', {
    1: pose(chest=(0, 0, 0), head=(0, 0, 0), scarf1=(6, 0, 4), scarf2=(4, 0, 0)),
    30: pose(chest=(-2.5, 0, 0), head=(3, 4, 0), scarf1=(12, 0, -4), scarf2=(10, 0, 6), upperarm_R=(6, 0, 26), upperarm_L=(6, 0, -26)),
    60: pose(chest=(0, 0, 0), head=(0, 0, 0), scarf1=(6, 0, 4), scarf2=(4, 0, 0)),
}, {1: {'hips': (0, 0, 0)}, 30: {'hips': (0, -.012, 0)}, 60: {'hips': (0, 0, 0)}})


def run_pose(s):
    # s = 1：右腳在前
    return {
        'hips': (0, 10 * s, 0), 'spine': (10, -6 * s, 0), 'chest': (4, -8 * s, 0), 'head': (-8, 12 * s, 0),
        'thigh.R': (-42 * s if s > 0 else 34, 0, 0), 'shin.R': (14 if s > 0 else 62, 0, 0), 'foot.R': (-8 if s > 0 else 20, 0, 0),
        'thigh.L': (34 if s > 0 else -42, 0, 0), 'shin.L': (62 if s > 0 else 14, 0, 0), 'foot.L': (20 if s > 0 else -8, 0, 0),
        'upperarm.R': (40 if s > 0 else -38, 0, 18), 'forearm.R': (-50, 0, 0), 'upperarm.L': (-38 if s > 0 else 40, 0, -18), 'forearm.L': (-50, 0, 0),
        'scarf1': (40, 0, 0), 'scarf2': (30, 0, 8 * s),
    }


def run_mid(s):
    return {
        'hips': (0, 0, 0), 'spine': (10, 0, 0), 'chest': (4, 0, 0), 'head': (-8, 0, 0),
        'thigh.R': (-8 if s > 0 else 8, 0, 0), 'shin.R': (30 if s > 0 else 90, 0, 0), 'foot.R': (10, 0, 0),
        'thigh.L': (8 if s > 0 else -8, 0, 0), 'shin.L': (90 if s > 0 else 30, 0, 0), 'foot.L': (10, 0, 0),
        'upperarm.R': (0, 0, 18), 'forearm.R': (-55, 0, 0), 'upperarm.L': (0, 0, -18), 'forearm.L': (-55, 0, 0),
        'scarf1': (45, 0, 0), 'scarf2': (35, 0, 0),
    }


action(rig, 'Run', {1: run_pose(1), 6: run_mid(1), 11: run_pose(-1), 16: run_mid(-1), 21: run_pose(1)},
       {1: {'hips': (0, -.04, 0)}, 6: {'hips': (0, .03, 0)}, 11: {'hips': (0, -.04, 0)}, 16: {'hips': (0, .03, 0)}, 21: {'hips': (0, -.04, 0)}})
jump = {'spine': (6, 0, 0), 'head': (-6, 0, 0), 'thigh.R': (-60, 0, 0), 'shin.R': (80, 0, 0), 'thigh.L': (-20, 0, 0), 'shin.L': (40, 0, 0),
        'upperarm.R': (-20, 0, -30), 'forearm.R': (-30, 0, 0), 'upperarm.L': (-20, 0, 30), 'forearm.L': (-30, 0, 0), 'scarf1': (70, 0, 0), 'scarf2': (40, 0, 0)}
action(rig, 'Jump', {1: jump, 10: jump})
# 揮筆：右手向右平舉，筆朝前；整個上半身由右往左掃（Swing1），反手回來（Swing2），第三段轉一圈（Spin）
armR_out = lambda yaw, lift=-72, bend=-18: {'upperarm.R': (0, yaw, lift), 'forearm.R': (bend, 0, 0), 'hand.R': (0, 0, 0)}
legs_wide = {'thigh.R': (-18, 0, -10), 'shin.R': (22, 0, 0), 'thigh.L': (16, 0, 12), 'shin.L': (18, 0, 0)}
s1 = {
    1: {**legs_wide, 'hips': (0, -22, 0), 'spine': (4, -30, 0), 'chest': (0, -20, 0), 'head': (0, 45, 0), **armR_out(-40, -64, -40), 'upperarm.L': (-30, 0, -30), 'forearm.L': (-40, 0, 0), 'scarf1': (30, 0, 20)},
    4: {**legs_wide, 'hips': (0, -8, 0), 'spine': (8, -12, 0), 'chest': (4, -6, 0), 'head': (0, 20, 0), **armR_out(10, -76, -20), 'upperarm.L': (-20, 0, -40), 'forearm.L': (-40, 0, 0), 'scarf1': (40, 0, 10)},
    7: {**legs_wide, 'hips': (0, 14, 0), 'spine': (10, 20, 0), 'chest': (6, 16, 0), 'head': (0, -20, 0), **armR_out(70, -78, -6), 'upperarm.L': (10, 0, -50), 'forearm.L': (-30, 0, 0), 'scarf1': (40, 0, -20)},
    12: {**legs_wide, 'hips': (0, 22, 0), 'spine': (8, 30, 0), 'chest': (4, 18, 0), 'head': (0, -30, 0), **armR_out(100, -70, -10), 'upperarm.L': (20, 0, -40), 'forearm.L': (-30, 0, 0), 'scarf1': (30, 0, -30)},
}
action(rig, 'Swing1', s1)
s2 = {
    1: {**legs_wide, 'hips': (0, 20, 0), 'spine': (6, 30, 0), 'chest': (4, 18, 0), 'head': (0, -30, 0), **armR_out(105, -58, -30), 'upperarm.L': (20, 0, -40), 'forearm.L': (-30, 0, 0), 'scarf1': (30, 0, -30)},
    4: {**legs_wide, 'hips': (0, 8, 0), 'spine': (8, 12, 0), 'chest': (4, 8, 0), 'head': (0, -10, 0), **armR_out(60, -62, -14), 'upperarm.L': (0, 0, -45), 'forearm.L': (-30, 0, 0), 'scarf1': (40, 0, -10)},
    7: {**legs_wide, 'hips': (0, -12, 0), 'spine': (10, -18, 0), 'chest': (6, -14, 0), 'head': (0, 20, 0), **armR_out(-10, -66, -8), 'upperarm.L': (-20, 0, -35), 'forearm.L': (-40, 0, 0), 'scarf1': (40, 0, 20)},
    12: {**legs_wide, 'hips': (0, -22, 0), 'spine': (6, -28, 0), 'chest': (2, -16, 0), 'head': (0, 30, 0), **armR_out(-45, -60, -30), 'upperarm.L': (-30, 0, -30), 'forearm.L': (-40, 0, 0), 'scarf1': (30, 0, 25)},
}
action(rig, 'Swing2', s2)
spin = {}
spin_loc = {}
for k, f in enumerate([1, 4, 7, 10, 13, 16]):
    ang = [0, 0, 90, 180, 270, 360][k] if k else 0
    spin[f] = {'hips': (0, -30 + ang if k else -30, 0), 'spine': (6, 0, 0), 'thigh.R': (-30, 0, -8), 'shin.R': (50, 0, 0), 'thigh.L': (-10, 0, 8), 'shin.L': (30, 0, 0),
               **armR_out(20, -84, -4), 'upperarm.L': (0, 0, -70), 'forearm.L': (-10, 0, 0), 'scarf1': (70, 0, 20), 'scarf2': (40, 0, 20), 'head': (0, 10, 0)}
    spin_loc[f] = {'hips': (0, [0, .08, .22, .26, .18, 0][k], 0)}
action(rig, 'Spin', spin, spin_loc)
shoot = {'spine': (6, 22, 0), 'chest': (0, 18, 0), 'head': (0, -30, 0), 'upperarm.R': (-70, 16, -8), 'forearm.R': (-6, 0, 0), 'hand.R': (68, 0, 0),
         'upperarm.L': (-20, 0, -40), 'forearm.L': (-30, 0, 0), **legs_wide}
action(rig, 'Shoot', {1: shoot, 6: {**shoot, 'upperarm.R': (-86, 20, -10), 'spine': (2, 22, 0)}, 10: shoot})
fly = {'hips': (0, 0, 0), 'spine': (18, 0, 0), 'chest': (6, 0, 0), 'head': (-18, 0, 0), 'thigh.R': (-80, 0, -6), 'shin.R': (84, 0, 0), 'thigh.L': (-80, 0, 6), 'shin.L': (84, 0, 0),
       'foot.R': (20, 0, 0), 'foot.L': (20, 0, 0), 'upperarm.R': (-50, 0, 14), 'forearm.R': (-40, 0, 0), 'upperarm.L': (-50, 0, -14), 'forearm.L': (-40, 0, 0), 'scarf1': (85, 0, 10), 'scarf2': (20, 0, 20)}
action(rig, 'Fly', {1: fly, 20: {**fly, 'scarf1': (80, 0, -10), 'scarf2': (30, 0, -20), 'chest': (8, 0, 0)}, 40: fly})
hurt = {'spine': (-18, 0, 0), 'chest': (-10, 0, 0), 'head': (-20, 0, 0), 'upperarm.R': (-30, 0, -40), 'upperarm.L': (-30, 0, 40), 'forearm.R': (-30, 0, 0), 'forearm.L': (-30, 0, 0),
        'thigh.R': (-20, 0, 0), 'shin.R': (30, 0, 0), 'scarf1': (60, 0, 0)}
action(rig, 'Hurt', {1: pose(), 4: hurt, 10: pose()})

# ── 老畫師帕布（簡單骨架：身體、頭、雙臂，一段待機動作） ──
prig = armature('PipRig', [('root', (0, 0, 0), (0, .9, 0), None), ('torso', (0, .9, 0), (0, 1.35, 0), 'root'), ('phead', (0, 1.35, 0), (0, 1.8, 0), 'torso'),
                           ('parm.R', (-.2, 1.3, 0), (-.34, .95, .08), 'torso'), ('parm.L', (.2, 1.3, 0), (.36, .98, .1), 'torso')])
pp = []
robe = lathe('Robe', [(.3, .02), (.29, .2), (.25, .6), (.21, .95), (.2, 1.15), (.16, 1.32), (.08, 1.4)], seg=28, sz=.85, cap_bot=True, cap_top=False,
             wobble=lambda a, y: .03 * math.sin(a * 9) * sstep(.6, 0, y))
paint(robe, lambda p, n: mix(0x6a5aa8, 0x8c7ae6, sstep(0, 1.3, p.y)) if abs(p.x) > .035 or p.z < 0 else 0xd8c89a)
pp.append((robe, ['root', 'torso']))
phd = ellipsoid('PipHead', (0, 1.52, .02), (.14, .15, .145), seg=24, rings=18)
paint(phd, lambda p, n: mix(0xf0c8a4, 0xf2a595, .6 if abs(abs(p.x) - .07) < .03 and 1.47 < p.y < 1.51 and p.z > .08 else 0))
pp.append((phd, ['phead']))
beard = lathe('Beard', [(0, 1.18), (.05, 1.2), (.1, 1.3), (.12, 1.4), (.11, 1.47), (.05, 1.5)], seg=18, sz=.7, off=(0, 0, .09), wobble=lambda a, y: .1 * math.sin(a * 6 + y * 20))
paint(beard, lambda p, n: mix(0xd9d4cc, 0xffffff, sstep(1.2, 1.45, p.y)))
pp.append((beard, ['phead']))
brows = [tube('PipBrow', [(s * .03, 1.575, .13), (s * .075, 1.585, .12), (s * .11, 1.57, .09)], [.014, .016, .008], seg=6) for s in (-1, 1)]
for b in brows:
    paint(b, lambda p, n: 0xf4f1ea)
    pp.append((b, ['phead']))
for s in (-1, 1):
    e = ellipsoid('PipEye', (s * .05, 1.54, .128), (.014, .018, .008), seg=10, rings=6)
    paint(e, lambda p, n: 0x1a1a22)
    pp.append((e, ['phead']))
pnose = ellipsoid('PipNose', (0, 1.5, .145), (.03, .035, .03), seg=12, rings=8)
paint(pnose, lambda p, n: 0xe9a88a)
pp.append((pnose, ['phead']))
hat = lathe('PipHat', [(0, 0), (.16, 0), (.2, .03), (.19, .06), (.12, .09), (0, .1)], seg=24, pivot=(.02, 1.66, -.01))
place(hat, (.02, 1.655, -.01), (-6, 0, -12))
paint(hat, lambda p, n: 0x2a2238)
pp.append((hat, ['phead']))
for s, bn in ((-1, 'parm.R'), (1, 'parm.L')):
    arm_ = tube('PipArm', [(s * .2, 1.3, 0), (s * .3, 1.1, .05), (s * .36, .96, .1)], [.07, .065, .06], seg=12)
    paint(arm_, lambda p, n: 0x7a6ac0)
    pp.append((arm_, [bn]))
    hnd = ellipsoid('PipHand', (s * .37, .92, .11), (.045, .05, .045), seg=12, rings=8)
    paint(hnd, lambda p, n: 0xf0c8a4)
    pp.append((hnd, [bn]))
cane = tube('Cane', [(-.38, .92, .12), (-.4, .45, .16), (-.42, .02, .2)], .022, seg=8)
paint(cane, lambda p, n: 0x8a5a3c)
pp.append((cane, ['parm.R']))
palette = rbox('Palette', (.4, 1.0, .18), (.22, .02, .16), bevel=.02, seg=2)
paint(palette, lambda p, n: ([0xff5a4e, 0x3aa7ff, 0xffd23f, 0x5bd46a][int((p.x - .3) * 20) % 4] if p.y > 1.005 and ((p.x * 37 + p.z * 53) % 1) < .35 else 0xc99a62))
pp.append((palette, ['parm.L']))
if AO:
    ao_bake([o for o, b in pp], samples=AO, strength=1.1, floor=.5)
for o, bl in pp:
    skin(o, prig, bl)
pip = join([o for o, b in pp], 'Pip')
bind(pip, prig)
action(prig, 'PipIdle', {1: {'torso': (0, 0, 0), 'phead': (0, 0, 0), 'parm.L': (0, 0, 0)}, 45: {'torso': (-3, 4, 0), 'phead': (6, -10, 0), 'parm.L': (-8, 0, -6)}, 90: {'torso': (0, 0, 0), 'phead': (0, 0, 0), 'parm.L': (0, 0, 0)}})
action(prig, 'PipTalk', {1: {'phead': (0, 0, 0), 'parm.L': (0, 0, 0)}, 8: {'phead': (-8, 6, 0), 'parm.L': (-30, 0, -20)}, 16: {'phead': (4, -4, 0), 'parm.L': (-10, 0, -10)}, 24: {'phead': (0, 0, 0), 'parm.L': (0, 0, 0)}})
place(prig, (0, 0, 0))

# ── 預覽 ──
if RENDER:
    for t in list(rig.animation_data.nla_tracks) + list(prig.animation_data.nla_tracks):
        t.mute = True
    prig.location = V(1.3, 0, 0)
    for name, fr in [('Idle', 1), ('Run', 1), ('Swing1', 1), ('Swing1', 7), ('Spin', 10), ('Shoot', 1), ('Fly', 1), ('Jump', 1)]:
        rig.animation_data.action = bpy.data.actions[name]
        bpy.context.scene.frame_set(fr)
        mode = 'fly' if name == 'Fly' else 'back' if name in ('Idle', 'Run', 'Jump') else 'hand'
        bb.hide_render, bh.hide_render, bf.hide_render = mode != 'back', mode != 'hand', mode != 'fly'
        preview(os.path.join(PREV, 'hero_%s_%d.png' % (name, fr)), target=(0, 1.1, 0), dist=5.2, yaw=35, pitch=10, res=(480, 480))
    rig.animation_data.action = None
    bpy.context.scene.frame_set(1)
    bb.hide_render = False; bh.hide_render = True; bf.hide_render = True
    preview(os.path.join(PREV, 'hero_face.png'), target=(0, 1.6, 0), dist=1.3, yaw=15, pitch=4, res=(480, 480))
    preview(os.path.join(PREV, 'hero_back.png'), target=(0, 1.2, 0), dist=5, yaw=200, pitch=8, res=(480, 480))
    prig.location = V(0, 0, 0)
    rig.location = V(-3, 0, 0)
    preview(os.path.join(PREV, 'pip.png'), target=(0, 1.0, 0), dist=3.4, yaw=25, pitch=8, res=(480, 480))
    rig.location = V(0, 0, 0)
    prig.location = V(0, 0, 0)

rig.animation_data.action = None
for t in list(rig.animation_data.nla_tracks) + list(prig.animation_data.nla_tracks):
    t.mute = False
bpy.context.scene.frame_set(1)
export(OUT, [rig, prig])
print('pip tris', tri_count([pip]), 'brush tris', tri_count([bh]))
