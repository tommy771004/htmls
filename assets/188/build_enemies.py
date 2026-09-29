# 188 彩筆曠野：敵人外型模板（37 種敵人共用 22 個模板，顏色由網頁依種類上色）
# 重建：/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P assets/188/build_enemies.py
#   環境變數：OUT=輸出 glb（預設 assets/188/enemies.glb）、RENDER=1 預覽圖存到 PREV、AO=烘焙取樣數
# 每個模板是一個空物件 E_<名稱>，底下是具名零件，網頁的動畫程式依名稱驅動：
#   Leg* 腳（原點在關節）、WingL/WingR 翅膀、Arm* 手臂、Weapon 武器掛點（底下 W_club 等擇一顯示）、Shield 盾、
#   Squash 會壓扁的身體、Head 會脈動的頭、Gear 齒輪、Lid 寶箱蓋、Teeth/Tongue、Seg0~6 蛇身、opt_*／x_* 依種類顯示的配件
# 材質：c1、c2 會乘上種類顏色（頂點色只存明暗細節）；fixed 是固定顏色；glow 自發光（乘 c1）
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from bw_lib import *

OUT = os.environ.get('OUT', os.path.join(HERE, 'enemies.glb'))
PREV = os.environ.get('PREV', '/tmp/bw188')
RENDER = os.environ.get('RENDER', '1') == '1'
AO = int(os.environ.get('AO', '16'))
os.makedirs(PREV, exist_ok=True)
reset()
random.seed(37)
ROOTS = []
_track = []


def nz(p, f=1.0, s=0):
    return noise.noise(Vector((p[0] * f + s, p[1] * f + s * .7, p[2] * f - s)))


def G(ob, lo=.78, hi=1.0, f=3.0, s=0):
    """c1／c2 用的灰階細節：朝上亮、朝下暗，加一點雜訊"""
    paint(ob, lambda p, n: (lambda k: (k, k, k))(lo + (hi - lo) * (.55 + .35 * n[1] + .15 * nz(p, f, s))))
    return ob


def C(ob, fn_or_hex):
    paint(ob, fn_or_hex if callable(fn_or_hex) else (lambda p, n: fn_or_hex))
    return ob


def M(ob, slot):
    ob.data.materials[0] = mat(slot)
    return ob


def new_objs(before):
    return [o for o in bpy.context.scene.objects if o.name not in before]


def begin():
    return set(o.name for o in bpy.context.scene.objects)


def pivot(ob, p):
    origin_to(ob, p)
    return ob


def group(name, pos, children):
    e = empty(name, pos)
    for c in children:
        set_parent(c, e)
    return e


def eyes(c, sp, s=.12, depth=.05, angry=False, yaw=0, pupil=.55):
    """一對卡通眼睛：眼白、黑眼珠、亮點（fixed 材質）"""
    out = []
    for sd in (-1, 1):
        x, y, z = c[0] + sd * sp, c[1], c[2]
        w = ellipsoid('EyeW', (x, y, z), (s, s * 1.15, s * .55), seg=14, rings=10)
        C(w, 0xfbfaf4)
        pu = ellipsoid('Pupil', (x + sd * s * .05, y - s * .1, z + s * .38), (s * pupil, s * pupil * 1.2, s * .3), seg=12, rings=8)
        C(pu, 0x15121c)
        hl = ellipsoid('Glint', (x - sd * s * .2, y + s * .3, z + s * .5), (s * .18, s * .2, s * .1), seg=8, rings=6)
        C(hl, 0xffffff)
        out += [w, pu, hl]
        if angry:
            br = tube('Brow', [(x - sd * s * .9, y + s * 1.5, z + s * .2), (x + sd * s * 1.0, y + s * 1.05, z + s * .45)], s * .22, seg=6)
            C(br, 0x1e1824)
            out.append(br)
    return out


def template(name, build):
    before = begin()
    build()
    objs = new_objs(before)
    # Blender 的名稱全域唯一，同名零件會變成 xxx.001；統一改成「名稱__序號」，網頁比對時去掉後綴
    for o in objs:
        o.name = o.name.split('.')[0] + '__%d' % len(_track)
        _track.append(o.name)
    meshes = [o for o in objs if o.type == 'MESH']
    if AO:
        ao_bake(meshes, samples=AO, strength=1.0, floor=.5)
    root = empty('E_' + name, (0, 0, 0))
    for o in objs:
        if o.parent is None:
            set_parent(o, root)
    ROOTS.append(root)
    print(name, 'tris', tri_count(meshes))
    # 挪開，免得擋到下一個模板的 AO
    root.location = V(len(ROOTS) * 9, 0, 0)
    return root


# ── 史萊姆 ──
def blob():
    sq = G(ellipsoid('Squash', (0, .62, 0), (.82, .66, .82), seg=28, rings=18), .8, 1)
    each_vert(sq, lambda p: (p[0], max(p[1], .06) if p[1] < .15 else p[1], p[2]))
    sq = M(sq, 'c1')
    kids = eyes((0, .78, .62), .26, .17)
    mouth = C(tube('Mouth', [(-.12, .5, .78), (0, .45, .8), (.12, .5, .78)], .025, seg=6), 0x3a1a24)
    hl1 = C(ellipsoid('Shine', (-.38, 1.0, .45), (.14, .08, .06), seg=10, rings=6), (1, 1, 1))
    hl2 = C(ellipsoid('Shine', (-.2, 1.12, .38), (.06, .04, .03), seg=8, rings=5), (1, 1, 1))
    for k in kids + [mouth, hl1, hl2]:
        set_parent(k, sq)
    pivot(sq, (0, 0, 0))
    # 依種類的配件
    fr = []
    for i in range(5):
        a = i * 1.3
        fr.append(C(tube('Ice', [(math.cos(a) * .45, .95, math.sin(a) * .35), (math.cos(a) * .6, 1.45, math.sin(a) * .45)], [.12, .01], seg=6), 0xe8f8ff))
    group('x_frost', (0, 0, 0), fr)
    set_parent(bpy.data.objects['x_frost'], sq)
    sp = M(C(lathe('Gem', [(0, 1.18), (.18, 1.35), (0, 1.62)], seg=6), (1, 1, .85)), 'glow')
    group('x_spark', (0, 0, 0), [sp])
    set_parent(bpy.data.objects['x_spark'], sq)
    fl = M(C(lathe('Flame', [(.24, 1.1), (.22, 1.35), (.1, 1.62), (0, 1.8)], seg=12, wobble=lambda a, y: .15 * math.sin(a * 3 + y * 8)), (1, .7, .3)), 'glow')
    group('x_ember', (0, 0, 0), [fl])
    set_parent(bpy.data.objects['x_ember'], sq)
    tw = M(G(ellipsoid('TwinHead', (0, 1.5, 0), (.45, .4, .45), seg=18, rings=12)), 'c1')
    tk = eyes((0, 1.55, .36), .15, .1)
    group('x_twin', (0, 0, 0), [tw] + tk)
    set_parent(bpy.data.objects['x_twin'], sq)


template('blob', blob)


# ── 四足獸 ──
def quad(kind):
    def b():
        if kind == 'shell':
            body = M(G(ellipsoid('Body', (0, .9, -.05), (.75, .6, 1.05), seg=24, rings=16), .8, 1), 'c1')
        else:
            body = M(G(ellipsoid('Body', (0, .95, 0), (.62, .55, .95), seg=24, rings=16), .78, 1), 'c1')
        if kind == 'mole':
            each_vert(body, lambda p: (p[0] * 1.15, p[1], p[2] * .85))
        head_c = {'boar': (0, 1.05, .95), 'shell': (0, .7, 1.05), 'mole': (0, .95, .78)}[kind]
        hr = {'boar': (.44, .42, .46), 'shell': (.3, .28, .36), 'mole': (.46, .4, .4)}[kind]
        head = M(G(ellipsoid('HeadMesh', head_c, hr, seg=20, rings=14)), 'c1')
        parts = [body, head]
        if kind == 'boar':
            snout = M(G(lathe('Snout', [(.2, 0), (.22, .18), (.18, .26)], seg=14, pivot=(0, 0, 0), off=(0, 0, 0)), .7, .9), 'c2')
            place(snout, (0, .98, 1.3), (90, 0, 0))
            parts.append(snout)
            for s in (-1, 1):
                parts.append(C(tube('Tusk', [(s * .15, .92, 1.25), (s * .24, .96, 1.42), (s * .22, 1.12, 1.5)], [.05, .04, .008], seg=7), 0xf4ead0))
                parts.append(C(ellipsoid('Nostril', (s * .07, .98, 1.56), (.03, .04, .02), seg=6, rings=4), 0x2a1a1a))
                parts.append(M(G(tube('Ear', [(s * .28, 1.35, .82), (s * .42, 1.58, .74)], [.1, .01], seg=8, flat=.4)), 'c1'))
            spikes = []
            for i in range(7):
                z = -.6 + i * .22
                spikes.append(M(G(tube('Bristle', [(0, 1.38 - abs(z) * .2, z), (0, 1.75 - abs(z) * .3, z - .12)], [.09, .005], seg=6), .55, .75), 'c1'))
            parts += spikes
            parts += eyes((0, 1.18, 1.28), .19, .085, angry=True)
            parts.append(M(G(tube('Tail', [(0, 1.0, -.92), (0, .9, -1.1), (.05, .8, -1.15)], [.05, .04, .02], seg=6)), 'c1'))
        if kind == 'shell':
            for i in range(5):
                z = -.75 + i * .38
                band = M(G(lathe('Plate', [(.001, -.02), (.8 - abs(z) * .25, 0), (.82 - abs(z) * .25, .08), (.001, .12)], seg=22, sz=1, off=(0, 0, 0)), .75, 1, 6), 'c2')
                place(band, (0, .95, z), (90, 0, 0))
                each_vert(band, lambda p: (p[0], p[1], max(p[2], -.15)))
                parts.append(band)
            parts += eyes((0, .78, 1.3), .12, .06)
            for s in (-1, 1):
                parts.append(M(G(ellipsoid('Ear', (s * .18, 1.0, .95), (.08, .12, .05), seg=8, rings=6)), 'c1'))
            parts.append(M(G(tube('Tail', [(0, .8, -1.05), (0, .6, -1.4), (0, .4, -1.55)], [.12, .08, .02], seg=8), .7, .9), 'c2'))
        if kind == 'mole':
            parts.append(M(C(ellipsoid('Nose', (0, .9, 1.2), (.12, .1, .1), seg=12, rings=8), (1, 1, 1)), 'c2'))
            parts += eyes((0, 1.1, 1.06), .16, .05, pupil=.9)
            for s in (-1, 1):
                for k in range(3):
                    parts.append(C(tube('Claw', [(s * (.45 + k * .07), .32, 1.0), (s * (.5 + k * .08), .18, 1.22)], [.035, .006], seg=5), 0xf4ead0))
                for k in range(3):
                    parts.append(C(tube('Whisker', [(s * .1, .9, 1.22), (s * .45, .92 + (k - 1) * .06, 1.3)], .006, seg=4), 0x2a2238))
        legs = []
        pos = {'boar': [(.36, .58), (.36, -.58)], 'shell': [(.42, .6), (.42, -.55)], 'mole': [(.48, .55), (.46, -.45)]}[kind]
        for i, (x, z) in enumerate([(pos[0][0], pos[0][1]), (-pos[0][0], pos[0][1]), (pos[1][0], pos[1][1]), (-pos[1][0], pos[1][1])]):
            hip = (x, .75, z)
            lg = M(G(tube('LegMesh', [hip, (x, .35, z + .02), (x, .06, z + .08)], [.17, .13, .12], seg=10)), 'c1')
            hoof = C(ellipsoid('Hoof', (x, .07, z + .12), (.13, .08, .16), seg=10, rings=6), 0x3a2a24)
            lg = join([lg, hoof], 'Leg%d' % i)
            pivot(lg, hip)
            legs.append(lg)
    return b


template('beast_boar', quad('boar'))
template('beast_shell', quad('shell'))
template('beast_mole', quad('mole'))


# ── 人形（哥布林體型），帽盔與武器都是可切換的配件 ──
def humanoid():
    torso = M(G(lathe('Body', [(.22, .5), (.34, .62), (.38, .82), (.33, 1.08), (.27, 1.22), (.16, 1.3)], seg=22, sz=.85), .78, 1), 'c1')
    head = M(G(ellipsoid('HeadMesh', (0, 1.58, .02), (.4, .36, .38), seg=24, rings=16)), 'c1')
    snout = M(G(ellipsoid('Snout', (0, 1.47, .33), (.2, .14, .14), seg=14, rings=10), .7, .92), 'c1')
    mouth = C(tube('Mouth', [(-.16, 1.36, .34), (0, 1.33, .4), (.16, 1.36, .34)], .03, seg=6), 0x2a1420)
    fang = [C(tube('Fang', [(s * .09, 1.37, .38), (s * .09, 1.45, .4)], [.03, .004], seg=5), 0xfff6e0) for s in (-1, 1)]
    ey = eyes((0, 1.66, .3), .15, .1, angry=True)
    cloth = M(G(lathe('Cloth', [(.36, .5), (.4, .58), (.38, .72), (.34, .76)], seg=22, sz=.9, cap_top=False, cap_bot=False, wobble=lambda a, y: .06 * math.sin(a * 6)), .7, .95), 'c2')
    belt = C(lathe('Belt', [(.345, .72), (.352, .75), (.345, .79)], seg=22, sz=.88, cap_top=False, cap_bot=False), 0x6b4428)
    legs = []
    for s, nm in ((1, 'LegL'), (-1, 'LegR')):
        lg = M(G(tube('LegMesh', [(s * .16, .56, 0), (s * .18, .3, .02), (s * .18, .08, .02)], [.13, .11, .1], seg=10)), 'c1')
        ft = M(G(ellipsoid('Foot', (s * .18, .06, .1), (.12, .07, .18), seg=10, rings=6), .6, .85), 'c1')
        lg = join([lg, ft], nm)
        pivot(lg, (s * .16, .56, 0))
        legs.append(lg)
    arms = []
    for s, nm in ((1, 'ArmL'), (-1, 'ArmR')):
        ar = M(G(tube('ArmMesh', [(s * .3, 1.16, 0), (s * .44, .92, .04), (s * .5, .72, .12)], [.09, .075, .07], seg=10)), 'c1')
        fs = M(G(ellipsoid('Fist', (s * .52, .66, .15), (.1, .1, .1), seg=10, rings=8)), 'c1')
        ar = join([ar, fs], nm)
        pivot(ar, (s * .3, 1.16, 0))
        arms.append(ar)
    # 武器掛在右手附近，原點在肩膀讓揮擊有弧度
    W = []
    club = [C(tube('Club', [(0, -.1, 0), (0, .5, .02), (0, .9, .05)], [.05, .09, .15], seg=10), 0x8a5a3c)]
    for k in range(5):
        a = k * 1.25
        club.append(C(tube('Nail', [(math.cos(a) * .12, .78 + k * .03, math.sin(a) * .12 + .05), (math.cos(a) * .22, .82 + k * .03, math.sin(a) * .22 + .05)], [.025, .003], seg=4), 0xb8bcc4))
    W.append(group('W_club', (0, 0, 0), club))
    bow = tube('Bow', [(0, -.5, -.1), (0, -.25, .08), (0, 0, .14), (0, .25, .08), (0, .5, -.1)], .035, seg=6)
    string = tube('String', [(0, -.5, -.1), (0, .5, -.1)], .008, seg=4)
    W.append(group('W_bow', (0, 0, 0), [C(bow, 0x8a5a3c), C(string, 0xf0e6d0)]))
    W.append(group('W_sling', (0, 0, 0), [C(tube('Sling', [(0, 0, 0), (0, -.25, .05), (.05, -.4, 0)], .02, seg=4), 0x6b4428), C(ellipsoid('Stone', (.05, -.45, 0), (.09, .08, .09), seg=8, rings=6), 0x8a8494)]))
    sh = lathe('Shield', [(0, 0), (.42, 0), (.46, .05), (.44, .1), (0, .14)], seg=18)
    place(sh, (.28, .05, .12), (0, 0, 90))
    boss_ = ellipsoid('Boss', (0, 0, 0), (.1, .1, .1), seg=8, rings=6)
    place(boss_, (.43, .05, .12))
    sword = tube('Sword', [(0, -.05, 0), (0, .9, 0), (0, 1.0, 0)], [.05, .04, .005], seg=4, flat=.3)
    guard = tube('Guard', [(-.12, -.02, 0), (.12, -.02, 0)], .025, seg=5)
    C(sh, lambda p, n: mix(0x8f8aa8, 0xc2bed6, .5 + .5 * n[1])), C(boss_, 0xffd23f), C(sword, 0xdfe4ea), C(guard, 0xc9a14a)
    shield = join([sh, boss_], 'Shield')
    W.append(group('W_shield', (0, 0, 0), [shield, sword, guard]))
    br = [C(tube('BrushH', [(0, -.3, 0), (0, 1.3, 0)], .03, seg=6), 0x5a4a6a), C(lathe('BrushT', [(.06, 1.3), (.1, 1.45), (.08, 1.65), (0, 1.8)], seg=10), 0x2a2238)]
    W.append(group('W_brush', (0, 0, 0), br))
    staff = [C(tube('Staff', [(0, -.4, 0), (0, 1.5, 0)], .035, seg=6), 0x6a5a4a), M(C(lathe('StaffGem', [(0, 1.5), (.14, 1.65), (0, 1.9)], seg=6), (.8, .75, 1)), 'glow')]
    W.append(group('W_staff', (0, 0, 0), staff))
    wg = group('Weapon', (-.52, .66, .15), [])
    for w in W:
        w.location = V(-.52, .66, .15)
        set_parent(w, wg)
    # 帽盔等配件
    cap = M(G(lathe('Cap', [(.001, 1.72), (.5, 1.78), (.62, 1.86), (.55, 2.0), (.3, 2.12), (.001, 2.16)], seg=26), .8, 1), 'c2')
    dots = [C(ellipsoid('Dot', (math.cos(a) * r, 2.0 + (.55 - r) * .3, math.sin(a) * r), (.08, .03, .08), seg=8, rings=5), 0xfffaf0) for a, r in [(0, .35), (1.4, .42), (2.6, .3), (3.9, .4), (5.1, .25), (.7, .12)]]
    group('opt_cap', (0, 0, 0), [cap] + dots)
    ears = [M(G(tube('EarL' if s > 0 else 'EarR', [(s * .34, 1.62, 0), (s * .55, 1.72, -.08), (s * .78, 1.84, -.15)], [.13, .08, .01], seg=8, flat=.35)), 'c1') for s in (-1, 1)]
    horn = C(tube('Horn', [(0, 1.9, .1), (.03, 2.08, .12), (0, 2.2, .06)], [.07, .04, .005], seg=6), 0xe8dcc0)
    group('opt_ears', (0, 0, 0), ears + [horn])
    helm = M(G(lathe('Helm', [(.001, 1.55), (.43, 1.55), (.44, 1.75), (.36, 1.95), (.001, 2.02)], seg=22, cap_bot=False), .75, 1), 'c2')
    visor = C(rbox('Visor', (0, 1.66, .4), (.5, .06, .06), bevel=.02, seg=1), 0x1e1824)
    plume = C(tube('Plume', [(0, 1.98, 0), (0, 2.25, -.1), (0, 2.3, -.4), (0, 2.1, -.55)], [.06, .09, .07, .01], seg=8, flat=.5), 0xff5a4e)
    plate = M(G(lathe('Armor', [(.3, .85), (.37, .95), (.36, 1.15), (.24, 1.28)], seg=22, sz=.9, cap_top=False, cap_bot=False), .78, 1), 'c2')
    group('opt_helmet', (0, 0, 0), [helm, visor, plume, plate])
    beret = M(G(lathe('Beret', [(.001, 0), (.35, 0), (.44, .05), (.36, .12), (.001, .14)], seg=22)), 'c2')
    place(beret, (.05, 1.88, 0), (-8, 0, -14))
    group('opt_beret', (0, 0, 0), [beret])
    hood = M(G(lathe('Hood', [(.44, 1.3), (.48, 1.5), (.46, 1.75), (.34, 1.98), (.1, 2.12), (.001, 2.18)], seg=22, off=(0, 0, -.05), cap_bot=False), .7, .95), 'c1')
    robe = M(G(lathe('Robe', [(.46, .05), (.42, .4), (.38, .8), (.34, 1.15)], seg=22, cap_bot=False, cap_top=False, wobble=lambda a, y: .05 * math.sin(a * 7)), .72, .95), 'c1')
    group('opt_hood', (0, 0, 0), [hood, robe])


template('humanoid', humanoid)


def scarecrow():
    pole = C(tube('Pole', [(0, 0, 0), (0, 2.3, 0)], .08, seg=8), 0x7a5238)
    bar = C(tube('Bar', [(-.9, 1.55, 0), (.9, 1.55, 0)], .06, seg=6), 0x7a5238)
    shirt = M(G(lathe('Shirt', [(.32, .75), (.36, .95), (.34, 1.35), (.24, 1.6), (.1, 1.65)], seg=18, sz=.7, wobble=lambda a, y: .07 * math.sin(a * 5 + y * 9)), .75, 1), 'c2')
    sack = M(G(ellipsoid('Sack', (0, 1.98, 0), (.34, .38, .32), seg=18, rings=12), .8, 1), 'c1')
    stitches = [C(tube('Stitch', [(x, 1.85, .31), (x + .04, 1.82, .31)], .012, seg=4), 0x3a2a24) for x in (-.14, -.07, 0, .07, .14)]
    ey = [C(ellipsoid('Button', (s * .12, 2.03, .3), (.07, .07, .03), seg=10, rings=6), 0x2a2238) for s in (-1, 1)]
    hat = C(lathe('StrawHat', [(.001, 2.18), (.6, 2.2), (.62, 2.24), (.28, 2.28), (.26, 2.5), (.001, 2.52)], seg=24), lambda p, n: mix(0xc9a55a, 0xeed08a, .5 + .5 * math.sin(math.atan2(p[0], p[2]) * 30)))
    straw = [C(tube('Straw', [(s * .88, 1.55, 0), (s * 1.05, 1.5 + k * .05, k * .05)], .02, seg=4), 0xe8c97a) for s in (-1, 1) for k in (-1, 0, 1)]
    arms = []
    for s, nm in ((1, 'ArmL'), (-1, 'ArmR')):
        sl = M(G(tube(nm, [(s * .2, 1.55, 0), (s * .85, 1.52, 0)], [.13, .1], seg=10), .72, .95), 'c2')
        pivot(sl, (s * .2, 1.55, 0))
        arms.append(sl)


template('scarecrow', scarecrow)


# ── 飛行類 ──
def bat():
    body = M(G(ellipsoid('Body', (0, 0, 0), (.36, .38, .34), seg=18, rings=12), .75, .95), 'c1')
    ears = [M(G(tube('Ear', [(s * .15, .28, 0), (s * .24, .6, -.02)], [.1, .01], seg=6, flat=.4)), 'c1') for s in (-1, 1)]
    ey = eyes((0, .08, .28), .13, .1, angry=True)
    fangs = [C(tube('Fang', [(s * .06, -.12, .3), (s * .06, -.22, .31)], [.025, .003], seg=4), 0xffffff) for s in (-1, 1)]
    for s, nm in ((1, 'WingL'), (-1, 'WingR')):
        bm = bmesh.new()
        pts = [(s * .25, .05, 0), (s * .8, .45, -.05), (s * 1.45, .25, -.1), (s * 1.6, -.2, -.1), (s * 1.2, -.05, -.05), (s * .95, -.35, -.05), (s * .6, -.15, 0)]
        vs = [bm.verts.new(V(*p)) for p in pts]
        bm.faces.new(vs)
        w = obj_from_bm(bm, nm + 'M', slot='c2')
        sol = w.modifiers.new('s', 'SOLIDIFY'); sol.thickness = .03
        apply_mods(w)
        G(w, .85, 1)
        struts = [C(tube('Strut', [(s * .25, .05, .02), pts[k]], .02, seg=4), 0x8a5a3c) for k in (1, 2, 3)]
        wg = join([w] + struts, nm)
        pivot(wg, (s * .25, .05, 0))


template('bat', bat)


def bird():
    body = M(G(ellipsoid('Body', (0, 0, 0), (.42, .4, .62), seg=20, rings=14), .75, 1), 'c1')
    head = M(G(ellipsoid('HeadMesh', (0, .32, .5), (.3, .3, .3), seg=16, rings=12), .78, 1), 'c1')
    beak = M(G(lathe('Beak', [(.1, 0), (.08, .12), (0, .3)], seg=10), .8, 1), 'c2')
    place(beak, (0, .27, .75), (90, 0, 0))
    crest = [M(G(tube('Crest', [(0, .56, .45 - k * .08), (0, .82 - k * .05, .3 - k * .12)], [.05, .005], seg=5, flat=.4)), 'c2') for k in range(3)]
    ey = eyes((0, .4, .72), .13, .08, angry=True)
    tail = [M(G(tube('Tail', [(0, 0, -.5), ((k - 1) * .15, -.05, -1.0)], [.12, .03], seg=6, flat=.2), .7, .95), 'c1') for k in range(3)]
    for s, nm in ((1, 'WingL'), (-1, 'WingR')):
        fe = []
        for k in range(4):
            fe.append(M(G(tube('Feather', [(s * .3, .08, .1 - k * .1), (s * (.9 + k * .1), .12, -.05 - k * .12), (s * (1.5 - k * .05), .06, -.2 - k * .12)], [.14, .16, .03], seg=6, flat=.2), .75, 1), 'c1' if k < 3 else 'c2'))
        wg = join(fe, nm)
        pivot(wg, (s * .3, .08, 0))
    talons = [C(tube('Talon', [(s * .15, -.35, .05), (s * .15, -.5, .12)], [.03, .01], seg=4), 0x3a2a24) for s in (-1, 1)]


template('bird', bird)


def manta():
    body = M(G(ellipsoid('Body', (0, 0, 0), (.9, .22, 1.0), seg=24, rings=12), .75, 1), 'c1')
    each_vert(body, lambda p: (p[0], p[1] - (p[0] ** 2) * .1, p[2] + abs(p[0]) * .15 if p[2] > 0 else p[2]))
    ey = eyes((0, .12, .82), .32, .09)
    horns = [M(G(tube('Horn', [(s * .35, 0, .9), (s * .45, 0, 1.25)], [.1, .03], seg=6, flat=.4)), 'c1') for s in (-1, 1)]
    for s, nm in ((1, 'WingL'), (-1, 'WingR')):
        w = M(G(ellipsoid(nm, (s * 1.4, 0, -.1), (.95, .1, .75), seg=18, rings=10), .72, 1), 'c1')
        each_vert(w, lambda p, s=s: (p[0], p[1] - (abs(p[0]) - .6) ** 2 * .15, p[2] - (abs(p[0]) - .6) * .35))
        pivot(w, (s * .6, 0, 0))
    tail = M(G(tube('TailW', [(0, 0, -.9), (0, .05, -1.8), (0, .15, -2.6)], [.1, .05, .01], seg=6), .8, 1), 'c2')


template('manta', manta)


# ── 植物 ──
def pot():
    return C(lathe('Pot', [(.5, 0), (.62, .55), (.68, .62), (.66, .72), (.55, .72)], seg=18, cap_top=True), lambda p, n: mix(0xa85a34, 0xd98a52, .5 + .5 * n[1]) if p[1] < .6 else 0x8a4a2a)


def plant_flower():
    pot()
    C(tube('Stem', [(0, .6, 0), (.05, 1.3, 0), (0, 2.0, .05)], [.1, .08, .07], seg=8), 0x3f9e4a)
    for s in (-1, 1):
        C(ellipsoid('Leaf', (s * .35, 1.1, 0), (.35, .05, .15), seg=10, rings=6), 0x4fae4a)
    parts = []
    for i in range(8):
        a = i / 8 * TAU
        pt = M(G(ellipsoid('Petal', (.52, 0, -.03), (.28, .16, .06), seg=10, rings=6), .8, 1), 'c2')
        pt.rotation_euler = (0, a, 0)
        bpy.context.view_layer.update()
        parts.append(pt)
    face = C(ellipsoid('Face', (0, 0, .05), (.38, .38, .18), seg=18, rings=12), 0xffd23f)
    muzzle = C(lathe('Muzzle', [(.14, 0), (.16, .08), (.12, .1), (.08, .02)], seg=14, cap_top=False), 0x3a2020)
    place(muzzle, (0, -.12, .2), (90, 0, 0))
    ey = eyes((0, .14, .2), .14, .08, angry=True)
    for o in parts + [face, muzzle] + ey:
        o.location += V(0, 2.2, .05)
    hd = group('Head', (0, 2.2, .05), parts + [face, muzzle] + ey)


template('plant_flower', plant_flower)


def plant_cactus():
    pot()
    body = M(G(lathe('Cactus', [(.001, .6), (.45, .65), (.52, 1.0), (.5, 2.2), (.38, 2.6), (.001, 2.75)], seg=24, wobble=lambda a, y: .1 * math.cos(a * 8)), .8, 1), 'c1')
    arms = [M(G(tube('CArm', [(s * .4, 1.5, 0), (s * .8, 1.45, 0), (s * .85, 2.0, 0)], [.2, .18, .16], seg=10)), 'c1') for s in (-1, 1)]
    spines = [C(tube('Spine', [(math.cos(a) * .5, y, math.sin(a) * .5), (math.cos(a) * .66, y + .05, math.sin(a) * .66)], [.02, .002], seg=3), 0xfff6d0) for a, y in [(random.uniform(0, TAU), random.uniform(.8, 2.4)) for _ in range(22)]]
    fl = M(G(ellipsoid('Blossom', (0, 2.75, 0), (.22, .12, .22), seg=12, rings=8)), 'c2')
    ey = eyes((0, 1.95, .46), .15, .09, angry=True)
    group('Head', (0, 0, 0), [body] + arms + spines + [fl] + ey)


template('plant_cactus', plant_cactus)


def plant_shroom():
    stem = M(G(lathe('Stem', [(.3, 0), (.36, .3), (.34, .7), (.28, .9)], seg=18), .82, 1), 'c1')
    ey = eyes((0, .55, .32), .13, .09)
    cap = M(G(lathe('CapM', [(.001, .75), (.6, .8), (.72, .9), (.62, 1.15), (.35, 1.35), (.001, 1.42)], seg=26), .78, 1), 'c2')
    dots = [C(ellipsoid('Dot', (math.cos(a) * r, 1.2 + (.6 - r) * .25, math.sin(a) * r), (.1, .04, .1), seg=8, rings=5), 0xfffaf0) for a, r in [(0, .45), (1.5, .5), (3, .4), (4.4, .5), (.8, .15)]]
    fuse = C(tube('Fuse', [(0, 1.4, 0), (.05, 1.6, 0), (.12, 1.72, .02)], .03, seg=5), 0x3a3350)
    spark = M(C(ellipsoid('Spark', (.13, 1.76, .02), (.06, .06, .06), seg=8, rings=6), (1, .85, .3)), 'glow')
    sq = group('Squash', (0, .75, 0), [cap] + dots + [fuse, spark])


template('plant_shroom', plant_shroom)


# ── 蟲 ──
def bug(kind):
    def b():
        if kind == 'beetle':
            body = M(G(ellipsoid('Body', (0, .6, 0), (.55, .38, .75), seg=20, rings=14)), 'c1')
            for s in (-1, 1):
                sh = M(G(ellipsoid('Shell', (s * .28, .78, -.05), (.34, .28, .75), seg=18, rings=12), .75, 1), 'c2')
            fuse = C(tube('Fuse', [(0, .95, -.5), (0, 1.2, -.6), (.05, 1.35, -.55)], .03, seg=5), 0x3a3350)
            head = M(G(ellipsoid('HeadMesh', (0, .6, .72), (.3, .26, .24), seg=14, rings=10)), 'c1')
            eyes((0, .66, .9), .13, .08, angry=True)
            for s in (-1, 1):
                C(tube('Antenna', [(s * .1, .8, .85), (s * .25, 1.05, 1.0), (s * .35, 1.1, .95)], [.025, .015, .01], seg=4), 0x2a2238)
            n, ly, spread = 3, .45, .9
        elif kind == 'spider':
            body = M(G(ellipsoid('Body', (0, .85, 0), (.55, .45, .6), seg=20, rings=14)), 'c1')
            gear = lathe('GearM', [(.45, -.06), (.62, -.06), (.62, .06), (.45, .06)], seg=48, cap_top=False, cap_bot=False, wobble=lambda a, y: .12 * (1 if math.cos(a * 12) > 0 else 0))
            M(G(gear, .7, 1), 'c2')
            pivot(gear, (0, 0, 0))
            place(gear, (0, 1.22, 0), (90, 0, 0))
            gear.name = 'Gear'
            for i in range(3):
                eyes((0, .95 + i * .06, .52 - i * .06), .07 + i * .07, .05 - i * .008)
            n, ly, spread = 4, .7, 1.3
        else:
            body = M(G(ellipsoid('Body', (0, .42, 0), (.42, .38, .45), seg=16, rings=12)), 'c1')
            each_vert(body, lambda p: (p[0], p[1] + max(0, p[1] - .6) * .8, p[2]))
            eyes((0, .5, .36), .15, .12, pupil=.6)
            n, ly, spread = 3, .3, .7
        for i in range(n * 2):
            sd = 1 if i % 2 else -1
            k = i // 2
            z = (.35 - k * (.7 / max(1, n - 1))) * (1.2 if kind == 'spider' else 1)
            hip = (sd * .35, ly, z)
            if kind == 'spider':
                pts = [hip, (sd * spread * .75, ly + .45, z * 1.2), (sd * spread, 0, z * 1.4)]
            else:
                pts = [hip, (sd * spread * .6, ly + .1, z), (sd * spread * .8, 0, z * 1.1)]
            lg = C(tube('LegMesh', pts, [.06, .05, .02], seg=6), 0x2a2238)
            lg.name = 'Leg%d' % i
            pivot(lg, hip)
    return b


template('bug_beetle', bug('beetle'))
template('bug_spider', bug('spider'))
template('bug_mite', bug('mite'))


def ghost():
    body = M(G(lathe('Wisp', [(.001, .1), (.3, .35), (.62, .9), (.66, 1.35), (.5, 1.8), (.25, 2.1), (.001, 2.3)], seg=22, wobble=lambda a, y: .12 * math.sin(a * 3 + y * 5) * sstep(1.2, .2, y)), .85, 1), 'glow')
    for k in range(3):
        a = k * 2.1
        M(G(tube('Flame', [(math.cos(a) * .2, 2.1, math.sin(a) * .2), (math.cos(a) * .3, 2.5, math.sin(a) * .25), (math.cos(a) * .15, 2.8, math.sin(a) * .15)], [.14, .08, .01], seg=6), .9, 1), 'glow')
    eyes((0, 1.55, .55), .2, .14, pupil=.7)
    C(ellipsoid('Mouth', (0, 1.2, .62), (.12, .14, .05), seg=10, rings=6), 0x1a1a2e)


template('ghost', ghost)


def golem():
    body = M(G(rbox('Body', (0, 1.9, 0), (1.8, 1.6, 1.3), bevel=.18, seg=2), .7, 1, 2), 'c1')
    displace(body, .06, 1.5, seed=3)
    head = M(G(rbox('HeadMesh', (0, 3.05, .1), (1.0, .85, .9), bevel=.14, seg=2), .7, 1, 2), 'c1')
    eyeg = M(C(ellipsoid('Eye', (0, 3.08, .56), (.22, .22, .08), seg=14, rings=10), (1, 1, 1)), 'glow')
    group('x_eye', (0, 0, 0), [eyeg])
    group('x_eyes', (0, 0, 0), eyes((0, 3.1, .52), .22, .11, angry=True))
    cracks = [C(tube('Crack', [(x, y, .66), (x + .15, y - .2, .66), (x + .05, y - .45, .66)], .025, seg=4), 0x3a3530) for x, y in [(-.5, 2.4), (.35, 2.1)]]
    for s, nm in ((1, 'ArmL'), (-1, 'ArmR')):
        ar = M(G(rbox(nm + 'M', (s * 1.25, 1.55, 0), (.62, 1.55, .62), bevel=.12, seg=2), .7, 1, 2), 'c1')
        fs = M(G(rbox('Fist', (s * 1.28, .72, .05), (.72, .55, .72), bevel=.14, seg=2), .7, 1, 2), 'c1')
        a = join([ar, fs], nm)
        pivot(a, (s * 1.2, 2.3, 0))
    for s, nm in ((1, 'LegL'), (-1, 'LegR')):
        lg = M(G(rbox(nm, (s * .5, .55, 0), (.68, 1.1, .68), bevel=.12, seg=2), .7, 1, 2), 'c1')
        pivot(lg, (s * .5, 1.1, 0))
    moss = [M(G(ellipsoid('Moss', (x, y, z), r, seg=12, rings=8), .7, 1), 'c2') for x, y, z, r in [(0, 2.75, 0, (1.0, .3, .72)), (0, 3.5, .1, (.55, .18, .5)), (.9, 2.45, 0, (.4, .2, .4))]]
    vines = [M(G(tube('Vine', [(x, 2.7, .68), (x + .05, 2.2, .7), (x - .05, 1.7, .68)], .05, seg=5), .7, 1), 'c2') for x in (-.4, .1, .5)]
    group('x_moss', (0, 0, 0), moss + vines)


template('golem', golem)


def crab():
    body = M(G(ellipsoid('Body', (0, .85, 0), (1.05, .5, .78), seg=24, rings=14), .75, 1), 'c1')
    each_vert(body, lambda p: (p[0], p[1] + math.sin(p[0] * 6) * .03, p[2]))
    bumps = [M(G(ellipsoid('Bump', (x, 1.28, z), (.12, .08, .12), seg=8, rings=6)), 'c2') for x, z in [(-.4, .1), (.3, -.1), (0, .3), (-.1, -.3)]]
    for s in (-1, 1):
        C(tube('Stalk', [(s * .25, 1.2, .5), (s * .3, 1.55, .55)], .045, seg=5), 0xd9c7b0)
    eyes((0, 1.62, .58), .3, .1, angry=True)
    for s, nm in ((1, 'ArmL'), (-1, 'ArmR')):
        up = M(G(tube('Up', [(s * .8, .9, .35), (s * 1.15, 1.0, .7)], [.15, .12], seg=8)), 'c1')
        cl = M(G(ellipsoid('Claw', (s * 1.2, 1.05, 1.0), (.3, .24, .38), seg=14, rings=10)), 'c1')
        tip = M(G(tube('Pincer', [(s * 1.12, 1.18, 1.2), (s * 1.08, 1.25, 1.55)], [.1, .01], seg=6), .8, 1), 'c2')
        a = join([up, cl, tip], nm)
        pivot(a, (s * .8, .9, .35))
    for i in range(6):
        sd = 1 if i % 2 else -1
        z = .25 - (i // 2) * .3
        lg = M(G(tube('LegMesh', [(sd * .8, .75, z), (sd * 1.3, .85, z - .05), (sd * 1.5, 0, z - .1)], [.07, .06, .02], seg=6)), 'c1')
        lg.name = 'Leg%d' % i
        pivot(lg, (sd * .8, .75, z))
    ic = [C(tube('Icicle', [(x, 1.25, z), (x, 1.75, z - .05)], [.1, .01], seg=6), 0xe8f8ff) for x, z in [(-.35, -.1), (0, -.2), (.35, -.1)]]
    group('x_icicle', (0, 0, 0), ic)


template('crab', crab)


def snake():
    # 蛇頭（Seg0）、沙蟲頭（Seg0W）與六節身體；網頁每幀設定每節位置
    hd = M(G(ellipsoid('HeadS', (0, .55, .1), (.42, .36, .55), seg=18, rings=12)), 'c1')
    ey = eyes((0, .75, .45), .22, .1, angry=True)
    tg = C(tube('Tongue', [(0, .45, .62), (0, .45, .95), (.06, .45, 1.05)], [.03, .02, .005], seg=4), 0xff5a4e)
    s0 = group('Seg0', (0, .55, 0), [hd, tg] + ey)
    wh = M(G(lathe('HeadW', [(.45, -.3), (.5, .1), (.45, .4), (.36, .55)], seg=18, cap_top=False), .75, 1), 'c1')
    place(wh, (0, .55, 0), (90, 0, 0))
    mouth = C(lathe('Maw', [(.36, .5), (.3, .52), (.2, .45), (.05, .3)], seg=18, cap_top=False, cap_bot=False), 0x5a2030)
    place(mouth, (0, .55, 0), (90, 0, 0))
    teeth = [C(tube('Tooth', [(math.cos(a) * .34, .55 + math.sin(a) * .34, .52), (math.cos(a) * .2, .55 + math.sin(a) * .2, .55)], [.05, .005], seg=4), 0xfff6e0) for a in [k / 8 * TAU for k in range(8)]]
    group('Seg0W', (0, .55, 0), [wh, mouth] + teeth)
    for k in range(1, 7):
        s = 1 - k / 7 * .55
        sg = M(G(ellipsoid('Seg%d' % k, (0, .55, 0), (.42 * s, .38 * s, .42 * s), seg=16, rings=10), .72 if k % 2 else .9, 1), 'c1' if k % 2 else 'c2')
        pivot(sg, (0, .55, 0))


template('snake', snake)


def jelly():
    dome = M(G(lathe('Dome', [(.001, 1.3), (.95, 1.35), (1.1, 1.65), (.95, 2.2), (.5, 2.55), (.001, 2.62)], seg=28, wobble=lambda a, y: .06 * math.sin(a * 8) * sstep(1.6, 1.3, y)), .85, 1), 'c1')
    core = M(C(ellipsoid('Core', (0, 1.95, 0), (.6, .45, .6), seg=16, rings=10), (1, 1, 1)), 'glow')
    eyes((0, 2.0, .95), .3, .13)
    for i in range(6):
        a = i / 6 * TAU
        pts = [(math.cos(a) * .6, 1.4, math.sin(a) * .6), (math.cos(a) * .7 + .1, 1.0, math.sin(a) * .7), (math.cos(a) * .6 - .1, .6, math.sin(a) * .6), (math.cos(a) * .7, .25, math.sin(a) * .7)]
        tn = M(G(tube('Tent', pts, [.09, .07, .05, .01], seg=6), .8, 1), 'c2')
        tn.name = 'Leg%d' % i
        pivot(tn, pts[0])


template('jelly', jelly)


def chest():
    box = M(G(rbox('Box', (0, .55, 0), (2.0, 1.1, 1.4), bevel=.08, seg=2), .7, 1, 5), 'c1')
    for x in (-.62, .62):
        C(rbox('Band', (x, .56, 0), (.16, 1.14, 1.44), bevel=.03, seg=1), 0x7a7f88)
    lock = M(G(rbox('Lock', (0, 1.0, .72), (.36, .42, .1), bevel=.04, seg=2)), 'c2')
    lid = M(G(tube('LidM', [(-1.0, 1.1, 0), (1.0, 1.1, 0)], .7, seg=16, up=(0, 0, -1)), .72, 1, 5), 'c1')
    each_vert(lid, lambda p: (p[0], 1.1 + max(p[1] - 1.1, 0) * .85, p[2]))
    ey = eyes((0, 1.5, .55), .38, .15, angry=True)
    xe = group('x_eyes', (0, 1.1, -.7), ey)
    L = group('Lid', (0, 1.1, -.7), [lid, xe])
    teeth = [C(tube('T', [(x, 1.12, .66), (x, .92, .68)], [.08, .005], seg=4), 0xffffff) for x in (-.7, -.35, 0, .35, .7)]
    group('Teeth', (0, 0, 0), teeth)
    tg = C(ellipsoid('TongueM', (0, 1.12, .55), (.45, .1, .6), seg=12, rings=8), 0xff6b8a)
    group('Tongue', (0, 0, 0), [tg])


template('chest', chest)


def snail():
    foot = M(G(tube('Foot', [(0, .25, -.9), (0, .3, 0), (0, .45, .75), (0, .8, 1.05)], [.3, .45, .38, .28], seg=16, flat=.7), .8, 1), 'c1')
    shell = M(G(lathe('ShellM', [(.001, .3), (.8, .4), (1.05, .9), (1.0, 1.4), (.7, 1.85), (.3, 2.05), (.001, 2.1)], seg=26, off=(0, 0, -.3), wobble=lambda a, y: .06 * math.sin(a * 2 + y * 4)), .7, 1, 4), 'c2')
    spiral = C(tube('Spiral', [(math.cos(t) * (.9 - t * .1), .9 + t * .12, -.3 + math.sin(t) * (.9 - t * .1) * 0 + .85) for t in [k * .5 for k in range(12)]], .05, seg=5), 0x3a2a44)
    crystals = [M(C(lathe('Crystal', [(0, 0), (.12, .15), (0, .6)], seg=6, pivot=(x, 1.95, z)), (.9, .85, 1)), 'glow') for x, z in [(0, -.3), (.25, -.1), (-.22, -.45), (.1, -.6)]]
    for s in (-1, 1):
        C(tube('Stalk', [(s * .1, .95, 1.05), (s * .2, 1.4, 1.1)], .04, seg=5), 0xd9c7a0)
        C(ellipsoid('EyeBall', (s * .2, 1.45, 1.1), (.09, .09, .09), seg=10, rings=8), 0x1a1a22)
        C(ellipsoid('EyeGl', (s * .19, 1.49, 1.17), (.03, .03, .02), seg=6, rings=4), 0xffffff)


template('snail', snail)

# ── 預覽：排成一列 ──
if RENDER:
    for i, r in enumerate(ROOTS):
        r.location = V((i % 8) * 4.2 - 15, 0, (i // 8) * -5)
    preview(os.path.join(PREV, 'enemies.png'), target=(0, 1.0, -4), dist=26, yaw=0, pitch=18, res=(1600, 900))
for r in ROOTS:
    r.location = V(0, 0, 0)
export(OUT, ROOTS)
