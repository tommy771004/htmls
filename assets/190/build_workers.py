# 190 封頂：工人（蒙皮網格 + 骨架）、翼型降落傘、安全帽、防護背心、四把槍與戰利品 → workers.glb
# 重建：/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P assets/190/build_workers.py
#   環境變數 PREVIEW=資料夾 會另存預覽圖
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lb_lib import *

HERE = os.path.dirname(os.path.abspath(__file__))
PREVIEW = os.environ.get('PREVIEW')
reset()

def add(p, d):
    return (p[0] + d[0], p[1] + d[1], p[2] + d[2])

OUT = []           # 要匯出的物件
BAKE = []          # 要烘焙 AO 的物件

def part(name, objs, pivot):
    ob = join(objs, name)
    smooth_by_angle(ob, 50)
    origin_to(ob, pivot)
    OUT.append(ob); BAKE.append(ob)
    return ob

BOOT, SOLE, BELT, LEATHER, STEEL = 0x5a3d24, 0x1e1e1e, 0x3a2a1c, 0x7c5c34, 0x5b5f63
TAPE = 0xdde2e6

# ───────── 工人：一整塊蒙皮網格 + 11 根骨頭 ─────────
# 骨頭的位置就是網頁動畫的關節（見 web/190-last-beam.html 的 makeWorker），而且全部朝上、沒有滾轉，
# 匯出後每根骨頭的靜止旋轉是單位四元數，網頁直接改 bone.rotation 就能沿用原本的動畫程式。
BONES = [  # 名稱, 關節位置（three 世界座標）, 父骨
    ('hips', (0, .94, 0), None), ('torso', (0, 1.02, 0), 'hips'), ('head', (0, 1.58, 0), 'torso'),
    ('upL', (.27, 1.47, 0), 'torso'), ('foreL', (.27, 1.18, 0), 'upL'), ('upR', (-.27, 1.47, 0), 'torso'), ('foreR', (-.27, 1.18, 0), 'upR'),
    ('thighL', (.1, .89, 0), 'hips'), ('shinL', (.1, .45, 0), 'thighL'), ('thighR', (-.1, .89, 0), 'hips'), ('shinR', (-.1, .45, 0), 'thighR'),
]
SEG = {  # 權重用的骨段
    'hips': ((0, .78, 0), (0, 1.0, 0)), 'torso': ((0, 1.06, 0), (0, 1.47, 0)), 'head': ((0, 1.63, 0), (0, 1.86, 0)),
    'upL': ((.27, 1.46, 0), (.27, 1.21, 0)), 'foreL': ((.27, 1.15, 0), (.27, .78, 0)),
    'upR': ((-.27, 1.46, 0), (-.27, 1.21, 0)), 'foreR': ((-.27, 1.15, 0), (-.27, .78, 0)),
    'thighL': ((.1, .86, 0), (.1, .49, 0)), 'shinL': ((.1, .42, 0), (.1, -.05, .05)),
    'thighR': ((-.1, .86, 0), (-.1, .49, 0)), 'shinR': ((-.1, .42, 0), (-.1, -.05, .05)),
}

def seg_d(p, a, b):
    a, b = Vector(a), Vector(b)
    ab = b - a
    t = max(0.0, min(1.0, (p - a).dot(ab) / ab.dot(ab)))
    return (p - (a + ab * t)).length

def skin(ob, bones, power=6.0):
    """距離式權重：只在允許的骨頭間分配；單一骨頭則整塊跟著動"""
    bpy.context.view_layer.update()
    mw = ob.matrix_world
    groups = {b: (ob.vertex_groups.get(b) or ob.vertex_groups.new(name=b)) for b in bones}
    for v in ob.data.vertices:
        if len(bones) == 1:
            groups[bones[0]].add([v.index], 1.0, 'REPLACE'); continue
        p = T(mw @ v.co)
        ws = sorted(((1.0 / (seg_d(p, *SEG[b]) + .012) ** power, b) for b in bones), reverse=True)[:3]
        s = sum(w for w, _ in ws)
        for w, b in ws:
            if w / s > .01:
                groups[b].add([v.index], w / s, 'REPLACE')
    return ob

def sk(ob, *bones):
    return skin(ob, list(bones))

def resample(pts, radii, step=.028):
    """把折線切細，讓關節附近有足夠的環數可以平順彎曲"""
    P = [Vector(p) for p in pts]
    out, rr = [], []
    for i in range(len(P) - 1):
        n = max(1, int((P[i + 1] - P[i]).length / step))
        for k in range(n):
            t = k / n
            out.append(tuple(P[i].lerp(P[i + 1], t))); rr.append(radii[i] + (radii[i + 1] - radii[i]) * t)
    out.append(tuple(P[-1])); rr.append(radii[-1])
    return out, rr

def limb(name, role, color, pts, radii, seg=18, caps=True, flat=1.0):
    p2, r2 = resample(pts, radii)
    return finish(bm_tube(p2, r2, seg, caps, flat, up=(0, 0, 1)), name, role, color, var=.03)

def fabric(ob, amp=.0025, freq=38):
    """布料的細微起伏"""
    me = ob.data
    for v in me.vertices:
        v.co = v.co + v.normal * noise.noise(v.co * freq) * amp
    me.update()

BODY = []
def B_(ob, *bones, cloth=False):
    if cloth:
        fabric(ob)
    sk(ob, *bones)
    BODY.append(ob)
    return ob

# 骨盆與褲頭
H = (0, .94, 0)
B_(lathe('p1', 'pants', 0, [(.148, -.14), (.166, -.08), (.172, 0), (.17, .06), (.166, .095)], H, 28, 1, .72), 'hips', cloth=True)
B_(ell('p2', 'pants', 0, add(H, (0, -.12, 0)), (.13, .07, .1), 20, 12), 'hips', 'thighL', 'thighR')
B_(lathe('p3', 'fixed', BELT, [(.176, .045), (.18, .05), (.18, .085), (.176, .09)], H, 32, 1, .73, cap_top=False, cap_bot=False), 'hips')
B_(box('p4', 'fixed', 0xb3a98c, add(H, (0, .067, .133)), (.055, .038, .012), .004), 'hips')
B_(box('p4b', 'fixed', 0x4a4a48, add(H, (0, .067, .14)), (.035, .02, .004), .002), 'hips')
for a in (-1.1, -.45, .45, 1.1, 2.3, -2.3):
    B_(box('lp', 'pants', 0, add(H, (math.sin(a) * .176, .066, math.cos(a) * .128)), (.018, .05, .012), .004, rot=(0, a, 0)), 'hips')
B_(box('pp', 'fixed', LEATHER, add(H, (-.175, -.01, .02)), (.05, .12, .12), .014), 'hips')
B_(box('pf', 'fixed', 0x6a4c2a, add(H, (-.176, .04, .02)), (.055, .03, .125), .01), 'hips')
for i, c in enumerate((0xc03a2b, 0xf2c230, 0x3e6b8e)):
    B_(cyl('sd', 'fixed', c, add(H, (-.176, .05, -.01 + i * .025)), add(H, (-.176, .1, -.01 + i * .025)), .007, 8), 'hips')
B_(tube('hm', 'fixed', 0x9a6a3a, [add(H, (.19, .03, .05)), add(H, (.195, -.2, .065))], .012, 8), 'hips')
B_(box('hh', 'fixed', STEEL, add(H, (.19, .045, .05)), (.035, .03, .11), .006), 'hips')
B_(box('tm', 'fixed', 0xf2c230, add(H, (.183, 0, -.06)), (.04, .075, .075), .016), 'hips')
B_(box('bpk', 'pants', 0, add(H, (.08, -.03, -.125)), (.09, .1, .012), .005, rot=(0, .3, 0)), 'hips')
B_(box('bpk', 'pants', 0, add(H, (-.08, -.03, -.125)), (.09, .1, .012), .005, rot=(0, -.3, 0)), 'hips')

# 軀幹（襯衫）與肩頭
S = (0, 1.02, 0)
B_(lathe('t1', 'shirt', 0, [(.158, -.06), (.168, 0), (.176, .1), (.19, .2), (.2, .32), (.204, .41), (.19, .48), (.15, .53), (.09, .56), (.06, .58)], S, 32, 1, .6, cap_top=False), 'hips', 'torso', cloth=True)
for sx, up in ((1, 'upL'), (-1, 'upR')):
    B_(ell('sh', 'shirt', 0, add(S, (sx * .19, .47, 0)), (.07, .06, .075), 20, 12), 'torso', up, cloth=True)
B_(lathe('cl', 'shirt', 0, [(.066, .545), (.086, .56), (.088, .605), (.078, .612)], S, 24, 1, .95, cap_top=False, cap_bot=False), 'torso', 'head')
for sx in (1, -1):
    B_(box('cf', 'shirt', 0, add(S, (sx * .04, .575, .07)), (.05, .006, .05), .004, rot=(.5, 0, sx * .35)), 'torso')
# 反光背心
vest_bm = bm_lathe([(r, y) for (y, r) in [(.04, .176), (.14, .19), (.24, .2), (.34, .21), (.42, .213), (.485, .197)]], 36, 1, .64, cap_top=False, cap_bot=False)
bmesh.ops.delete(vest_bm, geom=[f for f in vest_bm.faces if (lambda c: c.z > 0 and c.y > .33 and abs(c.x) < .02 + (c.y - .33) * .9)(f.calc_center_median())], context='FACES')
B_(finish(vest_bm, 't5', 'vis', 0, S), 'hips', 'torso')
def vr(y):
    pr = [(.04, .176), (.14, .19), (.24, .2), (.34, .21), (.42, .213), (.485, .197)]
    for (y0, r0), (y1, r1) in zip(pr, pr[1:]):
        if y <= y1:
            return r0 + (r1 - r0) * max(0, (y - y0)) / (y1 - y0)
    return pr[-1][1]
for (y0, y1) in ((.17, .215), (.29, .33)):
    B_(lathe('tb', 'fixed', TAPE, [(vr(y0) + .003, y0), (vr(y0) + .005, y0 + .004), (vr(y1) + .005, y1 - .004), (vr(y1) + .003, y1)], S, 36, 1, .655, cap_top=False, cap_bot=False, var=0), 'hips', 'torso')
for sx in (1, -1):
    B_(tube('ts', 'fixed', TAPE, [add(S, (sx * .1, .3, .137)), add(S, (sx * .115, .43, .115)), add(S, (sx * .125, .5, 0)), add(S, (sx * .115, .43, -.12)), add(S, (sx * .1, .3, -.137))], .016, 6, flat=.3, var=0), 'torso')
    B_(box('vp', 'vis', 0, add(S, (sx * .12, .1, .1)), (.075, .08, .012), .005, rot=(0, sx * .5, 0)), 'hips', 'torso')
    B_(box('vpf', 'vis', 0, add(S, (sx * .12, .145, .102)), (.078, .02, .014), .004, rot=(0, sx * .5, 0)), 'torso')
B_(box('tz', 'fixed', 0x2b2b2b, add(S, (0, .2, vr(.2) * .64 + .003)), (.01, .3, .006), .002), 'hips', 'torso')
B_(box('zp', 'fixed', 0x9a9c9e, add(S, (0, .32, vr(.32) * .64 + .006)), (.012, .02, .006), .002), 'torso')
B_(box('tp', 'vis', 0, add(S, (.095, .29, .122)), (.07, .07, .012), .004), 'torso')
B_(cyl('tn', 'fixed', 0x1f4fa8, add(S, (.113, .3, .128)), add(S, (.113, .365, .128)), .005, 8), 'torso')
B_(box('rd', 'fixed', 0x1f1f1f, add(S, (-.1, .36, .118)), (.035, .06, .02), .006), 'torso')
B_(tube('ra', 'fixed', 0x1f1f1f, [add(S, (-.11, .39, .118)), add(S, (-.11, .45, .114))], .004, 6), 'torso')
B_(box('bd', 'fixed', 0xeeeeee, add(S, (-.1, .27, .124)), (.06, .035, .004), .002, var=0), 'torso')
B_(box('tk', 'fixed', 0x2d3a44, add(S, (0, .3, -.135)), (.2, .07, .006), .003), 'torso')
for sx in (1, -1):  # 背後的反光 X
    B_(tube('bx', 'fixed', TAPE, [add(S, (sx * .15, .1, -.125)), add(S, (0, .25, -.137)), add(S, (-sx * .15, .42, -.12))], .014, 6, flat=.3, var=0), 'torso', 'hips')
# 背包
B_(box('bp', 'fixed', 0x4b5240, add(S, (0, .3, -.245)), (.26, .3, .1), .03), 'torso')
B_(box('bf', 'fixed', 0x3f4536, add(S, (0, .43, -.245)), (.265, .06, .106), .02), 'torso')
B_(box('bq', 'fixed', 0x3f4536, add(S, (0, .2, -.3)), (.18, .1, .025), .008), 'torso')
B_(box('bz', 'fixed', 0x222222, add(S, (0, .25, -.314)), (.16, .006, .004), .001), 'torso')
for sx in (1, -1):
    B_(box('bsp', 'fixed', 0x3f4536, add(S, (sx * .135, .28, -.245)), (.03, .16, .08), .01), 'torso')
    B_(tube('bs', 'fixed', 0x2f3328, [add(S, (sx * .09, .42, -.2)), add(S, (sx * .1, .51, -.07)), add(S, (sx * .105, .5, .07)), add(S, (sx * .1, .37, .14)), add(S, (sx * .095, .26, .14))], .016, 6, flat=.3), 'torso')
B_(box('cs', 'fixed', 0x2f3328, add(S, (0, .34, .142)), (.19, .014, .008), .003), 'torso')
B_(box('cb', 'fixed', 0x1f1f1f, add(S, (0, .34, .148)), (.03, .02, .008), .003), 'torso')

# 脖子與頭
HD = (0, 1.58, 0)
B_(lathe('nk', 'skin', 0, [(.05, -.06), (.053, .0), (.055, .05), (.052, .1)], HD, 20, cap_top=False, cap_bot=False), 'torso', 'head')
hb = bm_ell((.092, .117, .104), 28, 20)
for v in hb.verts:
    y = v.co.y
    if y < -.02:
        k = 1 - (-.02 - y) * 1.35
        v.co.x *= k
        v.co.z = v.co.z * (1 - (-.02 - y) * .45)
    if v.co.z > .05:
        v.co.x *= 1 - (v.co.z - .05) * .9
    for sx in (1, -1):  # 顴骨
        d = (Vector(v.co) - Vector((sx * .058, -.01, .07))).length
        if d < .035:
            v.co = Vector(v.co) * (1 + (.035 - d) * .25)
    d = (Vector(v.co) - Vector((0, .05, .09))).length  # 眉骨
    if d < .05:
        v.co.z += (.05 - d) * .12
B_(finish(hb, 'h2', 'skin', 0, add(HD, (0, .14, .005))), 'head')
B_(tube('ns', 'skin', 0, [add(HD, (0, .165, .1)), add(HD, (0, .135, .114)), add(HD, (0, .118, .122))], [.008, .012, .014], 10), 'head')
B_(ell('nt', 'skin', 0, add(HD, (0, .114, .112)), (.02, .011, .013)), 'head')
B_(ell('ch', 'skin', 0, add(HD, (0, .052, .075)), (.032, .022, .025)), 'head')
for yy, zz, r in ((.079, .097, .0035), (.071, .095, .0042)):
    B_(tube('lp', 'skin', 0, [add(HD, (-.019, yy + .002, zz - .007)), add(HD, (0, yy, zz)), add(HD, (.019, yy + .002, zz - .007))], r, 8), 'head')
B_(tube('lm', 'fixed', 0x5a2e26, [add(HD, (-.017, .075, .093)), add(HD, (0, .075, .097)), add(HD, (.017, .075, .093))], .0012, 6), 'head')
for sx in (1, -1):
    B_(ell('er', 'skin', 0, add(HD, (sx * .091, .13, -.005)), (.012, .031, .022)), 'head')
    B_(ell('ei', 'fixed', 0x7a4a3a, add(HD, (sx * .097, .13, 0)), (.004, .016, .01)), 'head')
    B_(box('eb', 'hair', 0, add(HD, (sx * .034, .174, .094)), (.036, .009, .012), .003, rot=(0, 0, -sx * .12)), 'head')
glass = [(math.sin(a) * .1, .15, math.cos(a) * .113) for a in [math.radians(d) for d in range(-70, 71, 10)]]
B_(tube('gl', 'fixed', 0x1c2a33, [add(HD, p) for p in glass], .0055, 8, flat=2.2, var=0), 'head')
B_(tube('gf', 'fixed', 0x3a3a3a, [add(HD, (p[0] * 1.02, .164, p[2] * 1.02)) for p in glass], .0025, 6, var=0), 'head')
for sx in (1, -1):
    B_(tube('gt', 'fixed', 0x1c2a33, [add(HD, (sx * .1, .152, .035)), add(HD, (sx * .101, .152, -.05))], .004, 6), 'head')
hair_bm = bm_ell((.098, .121, .109), 28, 16)
bmesh.ops.delete(hair_bm, geom=[f for f in hair_bm.faces if (lambda c: (c.z > .015 and c.y < .08) or c.y < -.08)(f.calc_center_median())], context='FACES')
B_(finish(hair_bm, 'hc', 'hair', 0, add(HD, (0, .145, -.004)), var=.12), 'head')

# 手臂、手套與手指
for sx, tag in ((1, 'L'), (-1, 'R')):
    up, fo = 'up' + tag, 'fore' + tag
    B_(limb('arm', 'shirt', 0, [(sx * .25, 1.545, 0), (sx * .268, 1.5, 0), (sx * .27, 1.47, 0), (sx * .275, 1.33, 0), (sx * .272, 1.18, .004), (sx * .27, 1.05, .004), (sx * .27, .96, 0)], [.058, .07, .07, .066, .06, .055, .05]), 'torso', up, fo)
    B_(lathe('cu', 'shirt', 0, [(.052, -.02), (.056, -.01), (.056, .01), (.052, .02)], (sx * .27, .965, 0), 18, cap_top=False, cap_bot=False), fo)
    B_(box('ep', 'shirt', 0, (sx * .272, 1.18, -.055), (.07, .06, .012), .006), up, fo)
    W = (sx * .27, .95, 0)
    B_(lathe('gc', 'glove', 0, [(.05, -.005), (.057, 0), (.058, .03), (.052, .035)], add(W, (0, -.02, 0)), 18), fo)
    B_(box('pm', 'glove', 0, add(W, (0, -.07, .006)), (.076, .085, .036), .016, smooth=True), fo)
    B_(box('kn', 'fixed', 0x3a3c3e, add(W, (0, -.1, .024)), (.07, .02, .01), .005), fo)
    for i in range(4):
        fx = -.027 + i * .018
        L = [.95, 1.0, .96, .82][i]
        B_(tube('fg', 'glove', 0, [add(W, (fx, -.108, .008)), add(W, (fx, -.108 - .038 * L, .014)), add(W, (fx, -.108 - .06 * L, .034))], [.0095, .009, .0082], 8), fo)
    B_(tube('th', 'glove', 0, [add(W, (-sx * .03, -.05, .018)), add(W, (-sx * .045, -.085, .036)), add(W, (-sx * .042, -.105, .05))], [.012, .0105, .009], 8), fo)

# 腿、護膝與工作靴
for sx, tag in ((1, 'L'), (-1, 'R')):
    th, sh = 'thigh' + tag, 'shin' + tag
    B_(limb('leg', 'pants', 0, [(sx * .095, .97, 0), (sx * .1, .89, 0), (sx * .102, .72, .004), (sx * .1, .5, .008), (sx * .1, .45, .01), (sx * .1, .3, 0), (sx * .1, .12, -.004)], [.09, .094, .091, .08, .078, .073, .07], seg=20), 'hips', th, sh)
    HP = (sx * .1, .89, 0)
    B_(box('cp', 'pants', 0, add(HP, (sx * .088, -.22, 0)), (.024, .13, .11), .008), th)
    B_(box('cpf', 'pants', 0, add(HP, (sx * .092, -.152, 0)), (.028, .03, .116), .006), th)
    B_(box('cpb', 'fixed', 0x3a3a38, add(HP, (sx * .105, -.152, 0)), (.004, .012, .018), .002), th)
    KN = (sx * .1, .45, 0)
    B_(box('kp', 'fixed', 0x2f3133, add(KN, (0, -.02, .072)), (.1, .12, .04), .018, smooth=True), sh)
    B_(box('kpi', 'fixed', 0x46484b, add(KN, (0, -.02, .094)), (.06, .07, .006), .004), sh)
    B_(lathe('ks', 'fixed', 0x26282a, [(.078, -.06), (.08, -.055), (.08, -.035), (.078, -.03)], KN, 20, cap_top=False, cap_bot=False), sh)
    B_(lathe('pc', 'pants', 0, [(.076, -.33), (.081, -.31), (.08, -.26)], KN, 20, cap_top=False, cap_bot=False), sh)
    B_(lathe('bs', 'fixed', BOOT, [(.07, -.27), (.077, -.3), (.08, -.35)], KN, 20), sh)
    B_(box('ft', 'fixed', BOOT, add(KN, (0, -.388, .04)), (.1, .08, .245), .035, smooth=True), sh)
    B_(ell('tc', 'fixed', 0x4a3120, add(KN, (0, -.392, .145)), (.052, .04, .056)), sh)
    B_(box('so', 'fixed', SOLE, add(KN, (0, -.437, .045)), (.108, .026, .28), .008), sh)
    B_(box('he', 'fixed', SOLE, add(KN, (0, -.43, -.06)), (.1, .04, .08), .008), sh)
    for i in range(5):
        B_(box('tr', 'fixed', 0x151515, add(KN, (0, -.451, -.06 + i * .05)), (.1, .006, .02), .002), sh)
    for i in range(4):
        y, z = -.335 - i * .014, .065 + i * .018
        B_(box('la', 'fixed', 0xd8c9a0, add(KN, (0, y, z)), (.052, .005, .008), .002, rot=(-.6, 0, (.3 if i % 2 else -.3))), sh)
    B_(box('pt', 'fixed', 0x3a2818, add(KN, (0, -.27, -.075)), (.025, .04, .006), .002), sh)

BODYOB = join(BODY, 'W_body')
smooth_by_angle(BODYOB, 55)
# 骨架：每根骨頭朝上 0.08m（three 的 +y），靜止旋轉才會是單位矩陣
arm = bpy.data.armatures.new('WorkerRig')
RIG = bpy.data.objects.new('WorkerRig', arm)
bpy.context.scene.collection.objects.link(RIG)
bpy.context.view_layer.objects.active = RIG
bpy.ops.object.mode_set(mode='EDIT')
for (n, p, par) in BONES:
    b = arm.edit_bones.new(n)
    b.head = V(*p)
    b.tail = V(p[0], p[1] + .08, p[2])
    b.roll = 0
    if par:
        b.parent = arm.edit_bones[par]
bpy.ops.object.mode_set(mode='OBJECT')
BODYOB.parent = RIG
mod = BODYOB.modifiers.new('Armature', 'ARMATURE')
mod.object = RIG
OUT += [RIG, BODYOB]; BAKE.append(BODYOB)

# ───────── 翼型降落傘（原點 = 雙手握的操縱帶位置，網頁從這裡拉傘繩）─────────
CH = (0, 0, -8)
CR, CT, CSPAN, NCELL, CHORD = 5.4, 5.6, .74, 9, 2.7
def canopy_pt(phi, u, top):
    """phi：展向角度；u：弦向 0（前緣）..1（後緣）；top：上表面或下表面"""
    z = CHORD * (.42 - u)
    th = .34 * (4 * u * (1 - u)) ** .8 * (1 - .5 * u)
    r = CR + (th * .62 if top else -th * .38)
    if not top:
        r += (u < .06) * .02
    return (math.sin(phi) * r, CT - CR + math.cos(phi) * r, z)
cells = []
SPC, NCH = 4, 14
def cell_color(ci, top):
    c = 0xe8671d if ci % 2 == 0 else 0x2d3035
    if ci == NCELL // 2:
        c = 0xf4b400
    return c if top else ((c >> 16 & 255) * 7 // 10) << 16 | ((c >> 8 & 255) * 7 // 10) << 8 | (c & 255) * 7 // 10
for ci in range(NCELL):
    for top in (True, False):
        bm = bmesh.new()
        rows = []
        for i in range(SPC + 1):
            phi = -CSPAN + 2 * CSPAN * (ci * SPC + i) / (NCELL * SPC)
            f = i / SPC
            bulge = math.sin(f * math.pi) * (.07 if top else -.03)
            row = []
            for k in range(NCH + 1):
                u = (k / NCH) ** 1.2
                x, y, z = canopy_pt(phi, u, top)
                n = Vector((math.sin(phi), math.cos(phi), 0))
                q = Vector((x, y, z)) + n * bulge * (4 * u * (1 - u)) ** .5
                row.append(bm.verts.new(q))
            rows.append(row)
        for i in range(SPC):
            for k in range(NCH):
                if not top and k == 0:
                    continue
                bm.faces.new((rows[i][k], rows[i + 1][k], rows[i + 1][k + 1], rows[i][k + 1]))
        ob = finish(bm, 'cn', 'fixed', cell_color(ci, top), CH, var=.03)
        recolor(ob, lambda p, n: hexrgb(0xeeeae0) if (p.z - CH[2]) > CHORD * .42 - .14 else None)
        cells.append(ob)
ribs = []
for i in range(NCELL + 1):
    phi = -CSPAN + 2 * CSPAN * i / NCELL
    secs = [canopy_pt(phi, (k / 10) ** 1.2, True) for k in range(11)] + [canopy_pt(phi, (k / 10) ** 1.2, False) for k in range(10, -1, -1)]
    bm = bmesh.new()
    vs = [bm.verts.new(p) for p in secs]
    bm.faces.new(vs)
    ribs.append(finish(bm, 'rb', 'fixed', 0xd9d4c6 if i in (0, NCELL) else 0x3a3d40, CH, var=0))
chute = join(cells + ribs, 'CHUTE')
for p in chute.data.polygons:
    p.use_smooth = True
origin_to(chute, CH)
OUT.append(chute); BAKE.append(chute)
# 傘繩接點（給網頁用）：每根肋在弦向四個位置，寫成自訂屬性
pts = []
for i in range(NCELL + 1):
    phi = -CSPAN + 2 * CSPAN * i / NCELL
    for u in (.08, .32, .58, .86):
        pts.append(canopy_pt(phi, u, False))
print('CHUTE_LINES', [tuple(round(x, 3) for x in p) for p in pts[:2]], len(pts))

# ───────── 安全帽（原點 = 頭上 0.22 的掛點），各自放遠一點避免 AO 互相遮蔽 ─────────
def dome_pts(prof, xo, sz):
    pts = []
    for (r, y) in prof:
        if r <= abs(xo):
            continue
        pts.append((xo, y, math.sqrt(r * r - xo * xo) * sz))
    back = [(p[0], p[1], -p[2]) for p in reversed(pts)]
    return pts + back[1:]

def bm_brim(ext, y, th, seg=40, a0=-math.pi, a1=math.pi, rx=.108, rz=.122):
    bm = bmesh.new()
    rows = []
    for i in range(seg + 1):
        a = a0 + (a1 - a0) * i / seg
        e = ext(a)
        ix, iz = math.sin(a) * rx, math.cos(a) * rz
        ox, oz = math.sin(a) * (rx + e), math.cos(a) * (rz + e)
        rows.append([bm.verts.new((ix, y, iz)), bm.verts.new((ox, y - e * .15, oz)), bm.verts.new((ox, y - e * .15 - th, oz)), bm.verts.new((ix, y - th, iz))])
    for i in range(seg):
        for k in range(4):
            a, b = rows[i][k], rows[i][(k + 1) % 4]
            c, d = rows[i + 1][(k + 1) % 4], rows[i + 1][k]
            if len({a, b, c, d}) == 4:
                bm.faces.new((a, b, c, d))
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    return bm

SHELL = [(.108, -.035), (.111, 0), (.105, .035), (.086, .064), (.05, .082), (.001, .088)]
def hat(lv, ox):
    P = (ox, 1.80, 0)
    col = [0x3b3a45, 0xeeeae0, 0xf08a1c, 0x26282b][lv]
    ob = []
    if lv == 0:
        ob.append(lathe('k', 'fixed', col, [(.097, -.066), (.102, -.046), (.102, -.03), (.098, -.02), (.09, .015), (.072, .042), (.038, .058), (.001, .062)], P, 40, 1, 1.1,
                        rfn=lambda a, y: 1 + (.03 * math.sin(a * 40) if y < -.025 else .012 * math.sin(a * 60)), var=.08))
        ob.append(ell('kp', 'fixed', 0x55546a, add(P, (0, .066, 0)), (.022, .02, .022)))
    else:
        ob.append(lathe('s', 'fixed', col, SHELL, P, 32, 1, 1.13, cap_bot=False, var=.015))
        ob.append(lathe('si', 'fixed', 0x2a2a2a, [(.001, -.03), (.104, -.03)], P, 32, 1, 1.12, cap_top=False, cap_bot=False, var=0))
        if lv == 1:
            ob.append(finish(bm_brim(lambda a: .055 * max(0, math.cos(a)) ** 1.5 + .004, -.03, .007), 'b', 'fixed', col, P, var=.015))
        else:
            ob.append(finish(bm_brim(lambda a: .03 + .018 * abs(math.cos(a)), -.03, .007), 'b', 'fixed', col, P, var=.015))
        for xo in (-.032, 0, .032):
            pts = [(p[0], p[1] + .004, p[2] * 1.02) for p in dome_pts(SHELL[1:], xo, 1.13)]
            ob.append(tube('r', 'fixed', col, [add(P, p) for p in pts], .0065 if xo == 0 else .0045, 6))
        for sx in (1, -1):
            ob.append(box('c', 'fixed', 0x3a3a3a, add(P, (sx * .109, -.02, 0)), (.008, .02, .03), .003))
        if lv == 3:
            ob.append(finish(bm_lathe([(.132, -.11), (.13, -.06), (.122, -.025)], 24, 1, 1.07, cap_top=False, cap_bot=False, a0=-1.15, a1=1.15), 'v', 'fixed', 0x5d7f96, P, var=0))
            for sx in (1, -1):
                ob.append(ell('e', 'fixed', 0xc0392b, add(P, (sx * .118, -.09, -.005)), (.028, .045, .04)))
                ob.append(tube('eb', 'fixed', 0x1b1b1b, [add(P, (sx * .116, -.05, -.005)), add(P, (sx * .112, -.02, -.005))], .008, 6))
            ob.append(box('lamp', 'fixed', 0xe8e4d4, add(P, (0, .025, .128)), (.03, .02, .012), .004, rot=(-.5, 0, 0)))
        if lv == 2:
            ob.append(box('logo', 'fixed', 0x1c1c1c, add(P, (0, .03, .125)), (.05, .018, .004), .002, rot=(-.4, 0, 0)))
    o = join(ob, 'HAT_%d' % lv)
    smooth_by_angle(o, 50)
    origin_to(o, P)
    OUT.append(o); BAKE.append(o)

for lv in range(4):
    hat(lv, 3 + lv * 1.2)

# ───────── 防護背心（原點 = 軀幹掛點）─────────
def armor(lv, ox):
    P = (ox, 1.02, 0)
    c = [0, 0x6d7355, 0x3d4a5c, 0x26292c][lv]
    d = [0, 0x5a5f46, 0x323d4c, 0x1a1c1e][lv]
    ob = [
        box('f', 'fixed', c, add(P, (0, .31, .155)), (.3, .3, .045), .02),
        box('b', 'fixed', c, add(P, (0, .32, -.165)), (.31, .32, .045), .02),
        lathe('w', 'fixed', d, [(.212, .15), (.217, .16), (.217, .25), (.212, .26)], P, 32, 1, .72, cap_top=False, cap_bot=False),
    ]
    for sx in (1, -1):
        ob.append(tube('s', 'fixed', c, [add(P, (sx * .1, .44, .16)), add(P, (sx * .115, .52, .05)), add(P, (sx * .115, .52, -.06)), add(P, (sx * .1, .44, -.17))], .022, 6, flat=.35))
    for x in (-.09, 0, .09):
        ob.append(box('p', 'fixed', d, add(P, (x, .23, .195)), (.075, .11, .04), .012))
        ob.append(box('pf', 'fixed', c, add(P, (x, .29, .197)), (.078, .025, .044), .008))
    for i in range(4):
        ob.append(box('m', 'fixed', d, add(P, (0, .38 - i * .03, .18)), (.2, .008, .006), .002))
    if lv >= 2:
        ob.append(box('r', 'fixed', d, add(P, (.19, .25, -.05)), (.05, .13, .07), .012))
        ob.append(tube('ra', 'fixed', 0x111111, [add(P, (.2, .31, -.06)), add(P, (.2, .42, -.07))], .005, 6))
    if lv == 3:
        ob.append(lathe('n', 'fixed', c, [(.1, .52), (.11, .56), (.1, .6)], P, 24, 1, .9, cap_top=False, cap_bot=False, a0=-2.3, a1=2.3))
        ob.append(box('t', 'fixed', 0xf4b400, add(P, (0, .44, .179)), (.1, .03, .006), .003))
    o = join(ob, 'ARM_%d' % lv)
    smooth_by_angle(o, 45)
    origin_to(o, P)
    OUT.append(o); BAKE.append(o)

for lv in (1, 2, 3):
    armor(lv, 9 + lv * 1.2)

# ───────── 槍（原點 = 握把上方，槍口朝 +z）─────────
BLK, BLK2, BLK3, WOOD = 0x2a2c2e, 0x34373a, 0x151618, 0x7a4a26

def grain(ob, base, amt=.18):
    c0 = hexrgb(base)
    recolor(ob, lambda p, n: tuple(max(0, min(1, x * (1 + math.sin(p.z * 90 + noise.noise(p * 14) * 5) * amt * .5 + noise.noise(p * 40) * amt * .4))) for x in c0))

def rail(z0, z1, y, w=.028):
    o = [box('rl', 'fixed', BLK3, (0, y, (z0 + z1) / 2), (w, .012, z1 - z0), .002)]
    z = z0 + .01
    while z < z1 - .005:
        o.append(box('rt', 'fixed', BLK3, (0, y + .008, z), (w + .002, .006, .011), .001))
        z += .024
    return o

def gun(name, ox, parts):
    o = join(parts, name)
    smooth_by_angle(o, 35)
    origin_to(o, (0, 0, 0))
    move(o, (ox, 1, -4))
    OUT.append(o); BAKE.append(o)
    return o

def trig_guard(z0, z1):
    return [tube('tg', 'fixed', BLK3, [(0, -.045, z0), (0, -.075, z0 + .015), (0, -.078, (z0 + z1) / 2), (0, -.075, z1 - .01), (0, -.045, z1)], .005, 6),
            box('tr', 'fixed', BLK3, (0, -.055, (z0 + z1) / 2 - .005), (.006, .025, .006), .002, rot=(.3, 0, 0))]

mag = []
for k in range(8):
    y = -.055 - k * .021
    zc = .175 + .0016 * k * k
    mag.append([(-.013, y, zc - .032), (.013, y, zc - .032), (.013, y, zc + .032), (-.013, y, zc + .032)])
gun('G_m416', 0, [
    box('ur', 'fixed', BLK, (0, .02, .12), (.05, .058, .33), .006),
    box('lr', 'fixed', BLK2, (0, -.028, .07), (.046, .05, .2), .006),
    box('mw', 'fixed', BLK2, (0, -.06, .17), (.04, .04, .07), .005),
    loft('mg', 'fixed', BLK, mag, smooth=False),
    box('pg', 'fixed', BLK3, (0, -.09, 0), (.034, .12, .05), .01, rot=(-.35, 0, 0)),
    *trig_guard(.02, .1),
    finish(bm_tube([(0, .015, .285), (0, .015, .52)], .037, 8), 'hg', 'fixed', BLK2, smooth=False),
    box('sr1', 'fixed', BLK3, (.04, .015, .4), (.012, .02, .22), .003),
    box('sr2', 'fixed', BLK3, (-.04, .015, .4), (.012, .02, .22), .003),
    *rail(-.02, .52, .056),
    cyl('br', 'fixed', BLK3, (0, .015, .52), (0, .015, .7), .011, 12),
    cyl('mb', 'fixed', BLK3, (0, .015, .7), (0, .015, .765), .016, 10),
    box('fs', 'fixed', BLK3, (0, .075, .5), (.012, .03, .012), .002),
    box('ch', 'fixed', BLK2, (0, .045, -.01), (.04, .012, .03), .003),
    box('ep', 'fixed', 0x111111, (-.026, .025, .1), (.004, .02, .06), .001),
    cyl('bt', 'fixed', BLK2, (0, .012, -.05), (0, .012, -.2), .016, 12),
    box('st', 'fixed', BLK, (0, -.005, -.25), (.042, .085, .14), .012, rot=(.08, 0, 0)),
    box('bpd', 'fixed', 0x111111, (0, -.012, -.325), (.046, .1, .02), .006),
    box('rdb', 'fixed', BLK3, (0, .076, .12), (.03, .014, .05), .003),
    # 紅點鏡：中空的鏡筒，第一人稱瞄準時可以從中間看出去
    lathe('rdh', 'fixed', BLK3, [(.0175, 0), (.022, 0), (.022, .07), (.0175, .07), (.0175, 0)], (0, .1, .09), 24, rot=(math.pi / 2, 0, 0), cap_top=False, cap_bot=False, var=0),
    lathe('rdf', 'fixed', 0x3d6f82, [(.0172, 0), (.0178, 0), (.0178, .004), (.0172, .004), (.0172, 0)], (0, .1, .157), 24, rot=(math.pi / 2, 0, 0), cap_top=False, cap_bot=False, var=0),
    box('rdk', 'fixed', BLK3, (.026, .1, .12), (.01, .012, .018), .002),
])

gun('G_ump', .8, [
    box('rc', 'fixed', 0x1e2022, (0, 0, .12), (.056, .1, .34), .014),
    *rail(.0, .28, .057, .024),
    cyl('br', 'fixed', BLK3, (0, .02, .29), (0, .02, .44), .012, 12),
    box('fs', 'fixed', BLK3, (0, .07, .27), (.02, .03, .014), .004),
    box('rs', 'fixed', BLK3, (0, .07, .0), (.024, .02, .02), .004),
    box('mg', 'fixed', BLK, (0, -.13, .2), (.034, .17, .06), .008, rot=(.12, 0, 0)),
    box('pg', 'fixed', BLK3, (0, -.09, -.02), (.036, .12, .05), .01, rot=(-.35, 0, 0)),
    *trig_guard(.0, .08),
    box('ch', 'fixed', BLK3, (-.032, .03, .2), (.012, .014, .04), .003),
    tube('s1', 'fixed', BLK2, [(0, .02, -.05), (0, .02, -.26)], .009, 8),
    tube('s2', 'fixed', BLK2, [(0, -.05, -.04), (0, -.035, -.26)], .009, 8),
    box('sb', 'fixed', 0x111111, (0, -.01, -.27), (.04, .1, .02), .006),
])

def stock_sections(keys, n=4):
    secs = []
    for (a, b) in zip(keys, keys[1:]):
        for i in range(n):
            t = i / n
            z, cy, w, h = [a[j] + (b[j] - a[j]) * t for j in range(4)]
            secs.append(rrect(0, cy, w, h, min(w, h) * .42, z))
    z, cy, w, h = keys[-1]
    secs.append(rrect(0, cy, w, h, min(w, h) * .42, z))
    return secs

kst = loft('ks', 'fixed', WOOD, stock_sections([(-.43, -.065, .046, .15), (-.3, -.048, .043, .11), (-.18, -.028, .036, .066), (-.08, -.032, .046, .095), (.05, -.012, .048, .062), (.4, .0, .042, .046), (.62, .006, .036, .034)]))
grain(kst, WOOD)
gun('G_kar98', 1.8, [
    kst,
    box('bp', 'fixed', 0x3a2a1c, (0, -.07, -.432), (.048, .15, .008), .003),
    tube('br', 'fixed', 0x232527, [(0, .035, .05), (0, .035, .9)], [.013, .009], 12),
    cyl('rc', 'fixed', BLK, (0, .035, -.08), (0, .035, .12), .018, 14),
    tube('bh', 'fixed', 0x3a3d40, [(.015, .04, -.03), (.05, .03, -.03), (.068, .0, -.04)], .006, 8),
    ell('bk', 'fixed', 0x3a3d40, (.07, -.005, -.04), (.014, .014, .014)),
    *trig_guard(-.07, -.01),
    tube('b1', 'fixed', BLK, [(0, .012, .3), (0, .012, .315)], .036, 14),
    tube('b2', 'fixed', BLK, [(0, .015, .55), (0, .015, .565)], .032, 14),
    box('fs', 'fixed', BLK, (0, .056, .88), (.01, .022, .012), .002),
    cyl('sc', 'fixed', 0x121314, (0, .1, -.06), (0, .1, .22), .017, 14),
    tube('so', 'fixed', 0x121314, [(0, .1, .2), (0, .1, .26)], [.018, .026], 16),
    tube('se', 'fixed', 0x121314, [(0, .1, -.11), (0, .1, -.05)], [.022, .018], 16),
    cyl('sl', 'fixed', 0x4d6f82, (0, .1, .259), (0, .1, .262), .022, 16, var=0),
    cyl('t1', 'fixed', 0x121314, (0, .11, .08), (0, .13, .08), .011, 10),
    cyl('t2', 'fixed', 0x121314, (.012, .1, .08), (.036, .1, .08), .011, 10),
    box('m1', 'fixed', BLK, (0, .07, 0), (.02, .045, .022), .004),
    box('m2', 'fixed', BLK, (0, .07, .16), (.02, .045, .022), .004),
])

sst = loft('ss', 'fixed', WOOD, stock_sections([(-.4, -.07, .045, .135), (-.26, -.05, .042, .1), (-.14, -.035, .036, .06), (-.06, -.03, .04, .075), (-.02, -.015, .042, .06)]))
grain(sst, WOOD)
fend = box('fe', 'fixed', WOOD, (0, -.006, .29), (.046, .036, .24), .014, rot=(.02, 0, 0), smooth=True)
grain(fend, WOOD)
rcv = box('rc', 'fixed', 0xb9bcbf, (0, -.005, .03), (.052, .075, .14), .012)
recolor(rcv, lambda p, n: tuple(x * (0.82 + .18 * (math.sin(p.x * 400) * math.sin(p.z * 300) > .2)) for x in hexrgb(0xb9bcbf)))
gun('G_s686', 2.6, [
    sst, fend, rcv,
    cyl('b1', 'fixed', 0x1f2123, (.0135, .026, .09), (.0135, .026, .72), .0135, 14),
    cyl('b2', 'fixed', 0x1f2123, (-.0135, .026, .09), (-.0135, .026, .72), .0135, 14),
    box('rb', 'fixed', 0x1f2123, (0, .042, .4), (.012, .005, .62), .002),
    ell('bd', 'fixed', 0xd4af37, (0, .047, .71), (.004, .004, .004)),
    box('tl', 'fixed', 0x9ea2a5, (0, .036, -.04), (.012, .01, .045), .003),
    *trig_guard(-.03, .03),
])

# ───────── 戰利品（原點在地面）─────────
def item(name, ox, parts):
    o = join(parts, name)
    smooth_by_angle(o, 40)
    origin_to(o, (ox, 0, 3))
    OUT.append(o); BAKE.append(o)

for i, (cal, band) in enumerate((('556', 0x7bbf4a), ('762', 0xd9a441), ('12', 0xc0392b), ('45', 0x4a7bbf))):
    ox, z = 20 + i * .8, 3
    item('I_a' + cal, ox, [
        box('c', 'fixed', 0x56603f, (ox, .075, z), (.26, .14, .14), .01),
        box('l', 'fixed', 0x4b5437, (ox, .152, z), (.268, .016, .148), .004),
        tube('h', 'fixed', 0x2b2b2b, [(ox - .06, .16, z), (ox - .06, .185, z), (ox + .06, .185, z), (ox + .06, .16, z)], .007, 6),
        box('la', 'fixed', 0x8a8f94, (ox + .131, .12, z), (.01, .04, .05), .003),
        box('b', 'fixed', band, (ox, .075, z + .0705), (.2, .035, .004), .002, var=0),
        box('b2', 'fixed', band, (ox, .075, z - .0705), (.2, .035, .004), .002, var=0),
        box('s', 'fixed', 0xeeeeee, (ox - .06, .11, z + .071), (.07, .01, .003), .001, var=0),
    ])
ox = 24
item('I_bandage', ox, [
    lathe('r1', 'fixed', 0xf2eee6, [(.012, 0), (.05, 0), (.05, .1), (.012, .1)], (ox - .06, .05, 3), 18, rot=(0, 0, math.pi / 2), var=.05),
    lathe('r2', 'fixed', 0xf2eee6, [(.012, 0), (.045, 0), (.045, .09), (.012, .09)], (ox + .07, .045, 3.02), 18, rot=(0, .6, math.pi / 2), var=.05),
    box('st', 'fixed', 0xe8e2d4, (ox - .01, .003, 3.05), (.09, .004, .05), .001, rot=(0, .3, 0)),
])
ox = 25
item('I_firstaid', ox, [
    box('b', 'fixed', 0xefece4, (ox, .045, 3), (.3, .085, .21), .016, smooth=True),
    box('l', 'fixed', 0xd8d3c6, (ox, .0875, 3), (.302, .006, .212), .003),
    box('c1', 'fixed', 0xd0342c, (ox, .091, 3), (.16, .004, .05), .001, var=0),
    box('c2', 'fixed', 0xd0342c, (ox, .091, 3), (.05, .004, .16), .001, var=0),
    box('lt', 'fixed', 0x8a8f94, (ox, .06, 3.107), (.05, .02, .008), .002),
])
ox = 26
item('I_medkit', ox, [
    box('b', 'fixed', 0xc0392b, (ox, .1, 3), (.48, .18, .28), .06, seg=3, smooth=True),
    box('c1', 'fixed', 0xf2eee6, (ox, .191, 3), (.26, .004, .08), .002, var=0),
    box('c2', 'fixed', 0xf2eee6, (ox, .191, 3), (.08, .004, .22), .002, var=0),
    tube('h', 'fixed', 0x222222, [(ox - .08, .19, 3), (ox - .06, .225, 3), (ox + .06, .225, 3), (ox + .08, .19, 3)], .012, 8),
    box('z', 'fixed', 0x333333, (ox, .15, 3.141), (.4, .008, .004), .001),
])
ox = 27
CAN = [(.001, 0), (.028, 0), (.034, .008), (.034, .115), (.027, .13), (.029, .133), (.001, .133)]
c1 = lathe('c1', 'fixed', 0xf4b400, CAN, (ox - .05, 0, 3), 20, var=0)
c2 = lathe('c2', 'fixed', 0x1a1a1a, CAN, (ox + .05, 0, 3.02), 20, var=0)
for c, band in ((c1, 0x1a1a1a), (c2, 0xf4b400)):
    recolor(c, lambda p, n, band=band: hexrgb(0xb8bcc0) if p.y > .118 or p.y < .01 else (hexrgb(band) if .05 < p.y < .075 else None))
item('I_drink', ox, [c1, c2])
ox = 28
fb = bm_ell((.046, .056, .046), 20, 14)
for v in fb.verts:
    a = math.atan2(v.co.x, v.co.z)
    k = 1 + .06 * max(math.cos(a * 8) ** 8, math.cos((v.co.y + .056) * 90) ** 8)
    v.co.x *= k; v.co.z *= k
item('I_frag', ox, [
    finish(fb, 'b', 'fixed', 0x4d5a3a, (ox, .058, 3), var=.05),
    cyl('f', 'fixed', 0x8a8f94, (ox, .105, 3), (ox, .128, 3), .016, 12),
    box('lv', 'fixed', 0x8a8f94, (ox, .09, 3.04), (.016, .07, .006), .002, rot=(-.25, 0, 0)),
    tube('rg', 'fixed', 0xb0b4b8, [(ox + .016 + .016 * math.cos(a), .12 + .016 * math.sin(a), 3) for a in [i / 12 * TAU for i in range(13)]], .0025, 6, caps=False),
])

print('tris', tri_count([o for o in OUT if o.type == 'MESH']))
ao_bake(BAKE, samples=int(os.environ.get('SAMPLES', '32')))
if PREVIEW:
    os.makedirs(PREVIEW, exist_ok=True)
    preview(os.path.join(PREVIEW, 'worker.png'), (0, 1, 0), 3.2, 35, 10)
    for pb in RIG.pose.bones:
        pb.rotation_mode = 'ZYX'
    POSE = {'upL': (.2, 0, 1.35), 'foreL': (0, 0, 1.45), 'upR': (.2, 0, -1.35), 'foreR': (0, 0, -1.45), 'thighL': (-.9, 0, .1), 'shinL': (1.4, 0, 0), 'thighR': (.3, 0, -.1), 'shinR': (.4, 0, 0), 'torso': (.1, .3, 0), 'head': (-.3, 0, 0)}
    for n, r in POSE.items():
        RIG.pose.bones[n].rotation_euler = r
    bpy.context.view_layer.update()
    preview(os.path.join(PREVIEW, 'posed.png'), (0, 1.1, 0), 3.0, 20, 10)
    preview(os.path.join(PREVIEW, 'posed_side.png'), (0, 1.1, 0), 3.0, 90, 10)
    for pb in RIG.pose.bones:
        pb.rotation_euler = (0, 0, 0)
    bpy.context.view_layer.update()
    preview(os.path.join(PREVIEW, 'chute.png'), (0, 3, -8), 12, 30, 25)
    preview(os.path.join(PREVIEW, 'hand.png'), (.27, .9, .05), .5, 30, 5)
    preview(os.path.join(PREVIEW, 'worker_back.png'), (0, 1.2, 0), 2.6, 200, 10)
    preview(os.path.join(PREVIEW, 'head.png'), (0, 1.72, 0), .9, 25, 5)
    preview(os.path.join(PREVIEW, 'hats.png'), (4.8, 1.8, 0), 4.2, 20, 20)
    preview(os.path.join(PREVIEW, 'guns.png'), (1.3, 1, -4), 2.6, 0, 55)
    preview(os.path.join(PREVIEW, 'items.png'), (24, .1, 3), 5.5, 10, 35)
    preview(os.path.join(PREVIEW, 'armor.png'), (11.4, 1.3, 0), 3.2, 25, 12)
export(os.environ.get('GLB', os.path.join(HERE, 'workers.glb')), OUT)
