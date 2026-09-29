# 190 封頂：雙旋翼起重直升機與七種工地機具 → machines.glb
# 重建：/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P assets/190/build_machines.py
#   環境變數 PREVIEW=資料夾 會另存預覽圖
# 車輛原點在地面中心、車頭朝 +z，外形尺寸對齊網頁裡的碰撞盒。材質叫 paint 的部分由網頁換車身色。
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lb_lib import *

HERE = os.path.dirname(os.path.abspath(__file__))
PREVIEW = os.environ.get('PREVIEW')
reset()
bpy.context.scene.world.light_settings.distance = 0.8

OUT, BAKE = [], []
YEL, YELD, DARK, RUB, CHROME, GLASS = 0xe8ad18, 0xb8860f, 0x2c2d2f, 0x1c1d1f, 0xc9cdd0, 0x2e3b44

def sub(p, o):
    return (p[0] + o[0], p[1] + o[1], p[2] + o[2])

def done(name, parts, origin, deg=35):
    ob = join(parts, name)
    smooth_by_angle(ob, deg)
    origin_to(ob, origin)
    OUT.append(ob); BAKE.append(ob)
    return ob

def wheel(O, c, r, w, rim=0x8c8f91, dual=False):
    x, y, z = sub(O, c)
    prof = [(r * .58, -w / 2), (r * .93, -w / 2), (r, -w / 2 + .04), (r, w / 2 - .04), (r * .93, w / 2), (r * .58, w / 2)]
    tread = lambda a, yy: 1 + (.025 if (math.sin(a * 26 + (yy > 0) * 1.6) > 0 and abs(yy) < w / 2 - .02) else 0)
    out = [lathe('tire', 'fixed', RUB, prof, (x, y, z), 40, rot=(0, 0, math.pi / 2), cap_top=False, cap_bot=False, rfn=tread, var=.05)]
    s = 1 if x > 0 else -1
    out.append(lathe('rim', 'fixed', rim, [(r * .6, 0), (r * .5, .02), (r * .2, .05), (.001, .06)], (x + s * (w / 2 - .06), y, z), 16, rot=(0, 0, -s * math.pi / 2), var=.02))
    for i in range(6):
        a = i / 6 * TAU
        out.append(ell('nut', 'fixed', 0x55585b, (x + s * (w / 2 - .005), y + math.sin(a) * r * .28, z + math.cos(a) * r * .28), (.018, .018, .018), 8, 6))
    return out

def stadium(x, cy, cz, L, h, n=8):
    r = h / 2
    pts = []
    for i in range(n + 1):
        a = -math.pi / 2 + math.pi * i / n
        pts.append((x, cy + math.sin(a) * r, cz + L / 2 - r + math.cos(a) * r))
    for i in range(n + 1):
        a = math.pi / 2 + math.pi * i / n
        pts.append((x, cy + math.sin(a) * r, cz - L / 2 + r + math.cos(a) * r))
    return pts

def track(O, x, w, L, h):
    out = [loft('trk', 'fixed', RUB, [stadium(sub(O, (x - w / 2, 0, 0))[0], O[1] + h / 2, O[2], L, h), stadium(sub(O, (x + w / 2, 0, 0))[0], O[1] + h / 2, O[2], L, h)], smooth=False)]
    n = int(L / .19)
    for i in range(n):
        z = -L / 2 + h / 2 + (L - h) * i / (n - 1)
        out.append(box('sh', 'fixed', 0x2a2b2d, sub(O, (x, h + .012, z)), (w + .02, .03, .1), .006))
        out.append(box('sh', 'fixed', 0x2a2b2d, sub(O, (x, -.012, z)), (w + .02, .03, .1), .006))
    out.append(box('tf', 'fixed', DARK, sub(O, (x, h / 2, 0)), (w * .5, h * .55, L - h * .9), .04))
    for i in range(5):
        z = -L / 2 + h * .6 + (L - h * 1.2) * i / 4
        out.append(cyl('rl', 'fixed', 0x3a3b3d, sub(O, (x - w * .52, h * .3, z)), sub(O, (x + w * .52, h * .3, z)), h * .17, 12))
    for zz in (L / 2 - h / 2, -L / 2 + h / 2):
        out.append(cyl('sp', 'fixed', 0x46484b, sub(O, (x - w * .53, h / 2, zz)), sub(O, (x + w * .53, h / 2, zz)), h * .36, 16))
    return out

def cabin(O, c, s, body, bevel=.06, roof=None, glass_sides=(1, 1, 1, 1)):
    """車廂：外殼 + 四面嵌入的玻璃（前、後、左、右）"""
    x, y, z = sub(O, c)
    w, h, d = s
    out = [box('cb', body[0], body[1], (x, y + h * .22, z), (w, h * .44, d), bevel),
           box('cr', body[0], body[1], (x, y + h - .04, z), (w, .08, d), bevel * .6)]
    for sx in (1, -1):
        for sz in (1, -1):
            out.append(box('pl', body[0], body[1], (x + sx * (w / 2 - .04), y + h * .72, z + sz * (d / 2 - .04)), (.08, h * .56, .08), .02))
    gy, gh = y + h * .72, h * .52
    f, b, l, r = glass_sides
    if f: out.append(box('gf', 'fixed', GLASS, (x, gy, z + d / 2 - .03), (w - .1, gh, .03), .01, var=0))
    if b: out.append(box('gb', 'fixed', GLASS, (x, gy, z - d / 2 + .03), (w - .1, gh, .03), .01, var=0))
    if l: out.append(box('gl', 'fixed', GLASS, (x + w / 2 - .03, gy, z), (.03, gh, d - .1), .01, var=0))
    if r: out.append(box('gr', 'fixed', GLASS, (x - w / 2 + .03, gy, z), (.03, gh, d - .1), .01, var=0))
    if roof:
        out.append(box('rf', 'fixed', roof, (x, y + h + .02, z), (w + .06, .05, d + .06), .02))
    return out

def cylinder_ram(a, b, r, body=YEL):
    m = [(a[i] + (b[i] - a[i]) * .55) for i in range(3)]
    return [tube('rb', 'fixed', body, [a, m], r, 12), tube('rr', 'fixed', CHROME, [m, b], r * .55, 10, var=0)]

def beam_path(pts, w, h, color, role='fixed'):
    secs = []
    for k, p in enumerate(pts):
        t = (Vector(pts[min(k + 1, len(pts) - 1)]) - Vector(pts[max(k - 1, 0)])).normalized()
        up = Vector((0, 1, 0))
        n = (up - t * up.dot(t)).normalized()
        side = t.cross(n).normalized()
        ww, hh = (w[k], h[k]) if isinstance(w, list) else (w, h)
        P = Vector(p)
        secs.append([tuple(P + side * sx * ww / 2 + n * sy * hh / 2) for (sx, sy) in ((-1, -1), (1, -1), (1, 1), (-1, 1))])
    return loft('bm', role, color, secs, smooth=False)

def railings(O, pts, h=.9):
    out = []
    for p in pts:
        out.append(tube('hp', 'fixed', 0x1f1f1f, [sub(O, p), sub(O, (p[0], p[1] + h, p[2]))], .02, 6))
    out.append(tube('hr', 'fixed', 0x1f1f1f, [sub(O, (p[0], p[1] + h, p[2])) for p in pts], .022, 6))
    return out

# ───────── 挖土機（下部 + 可旋轉的上部，上部原點在迴轉中心 y=1）─────────
O = (0, 0, 0)
done('V_exc_base', track(O, 1.25, .62, 4.6, .85) + track(O, -1.25, .62, 4.6, .85) + [
    box('cb', 'fixed', DARK, (0, .5, 0), (1.9, .5, 1.7), .08),
    cyl('sr', 'fixed', 0x3a3b3d, (0, .75, 0), (0, 1.0, 0), .8, 24),
], O)
U = (0, 1, 0)
up = [
    box('bd', 'fixed', YEL, sub(U, (0, .55, -.35)), (2.5, 1.1, 3.0), .12),
    box('cw', 'fixed', YELD, sub(U, (0, .6, -1.9)), (2.5, 1.2, .55), .25, seg=4, smooth=True),
    box('hd', 'fixed', YEL, sub(U, (-.35, 1.12, -.9)), (1.7, .12, 1.6), .05),
    cyl('ex', 'fixed', 0x3a3b3d, sub(U, (-.8, 1.1, -1.2)), sub(U, (-.8, 1.55, -1.2)), .06, 10),
]
for i in range(6):
    up.append(box('gr', 'fixed', DARK, sub(U, (-1.255, .5, -1.5 + i * .22)), (.02, .45, .12), .005))
up += cabin(U, (.72, 1.1, .55), (1.0, 1.65, 1.35), ('fixed', YEL), roof=0x2a2b2d)
up += railings(U, [(-1.1, 1.2, -1.6), (-1.1, 1.2, 0), (-.2, 1.2, .9)], .7)
up.append(beam_path([sub(U, (-.3, 1.0, 1.0)), sub(U, (-.3, 2.6, 2.4)), sub(U, (-.3, 3.6, 3.5)), sub(U, (-.3, 3.9, 4.3))], [.52, .5, .46, .42], [.7, .62, .56, .5], YEL))
up.append(beam_path([sub(U, (-.3, 3.95, 4.2)), sub(U, (-.3, 3.1, 5.4)), sub(U, (-.3, 1.7, 6.5))], [.38, .36, .32], [.46, .42, .36], YEL))
up += cylinder_ram(sub(U, (-.3, .6, .9)), sub(U, (-.3, 2.6, 2.7)), .1)
up += cylinder_ram(sub(U, (-.3, 3.1, 3.2)), sub(U, (-.3, 4.4, 4.5)), .085)
bk = sub(U, (-.3, 1.3, 6.6))
up += [
    box('bk', 'fixed', 0x3a3b3d, sub(bk, (0, -.25, .1)), (1.05, .75, .55), .08, rot=(.5, 0, 0)),
    box('bs1', 'fixed', 0x3a3b3d, sub(bk, (.52, -.2, .1)), (.04, .8, .75), .02, rot=(.5, 0, 0)),
    box('bs2', 'fixed', 0x3a3b3d, sub(bk, (-.52, -.2, .1)), (.04, .8, .75), .02, rot=(.5, 0, 0)),
]
for i in range(5):
    up.append(box('tt', 'fixed', 0x9a9c9e, sub(bk, (-.4 + i * .2, -.66, .35)), (.08, .16, .08), .015, rot=(.9, 0, 0)))
done('V_exc_upper', up, U)

# ───────── 推土機 ─────────
O = (8, 0, 0)
dz = track(O, 1.2, .65, 3.8, .9) + track(O, -1.2, .65, 3.8, .9) + [
    box('bd', 'fixed', YEL, sub(O, (0, .95, .6)), (1.8, 1.0, 2.3), .1),
    box('hd', 'fixed', YEL, sub(O, (0, 1.45, .7)), (1.5, .25, 2.0), .1),
    box('gr', 'fixed', DARK, sub(O, (0, 1.05, 1.76)), (1.5, .8, .04), .01),
    box('rr', 'fixed', YELD, sub(O, (0, .9, -1.35)), (2.2, 1.0, 1.1), .1),
    cyl('ex', 'fixed', 0x3a3b3d, sub(O, (.5, 1.65, 1.2)), sub(O, (.5, 2.25, 1.2)), .06, 10),
]
dz += cabin(O, (0, 1.9, -1.15), (1.8, 1.55, 1.3), ('fixed', YEL), roof=YEL)
arc = [(math.sin(t) * .35, .15 + (1 - math.cos(t)) * .0 + t * .85, 2.85 - (1 - math.cos(t)) * .45) for t in [i / 8 * 1.6 for i in range(9)]]
blade = []
for x in (-1.72, 1.72):
    front = [sub(O, (x, p[1], p[2])) for p in arc]
    back = [sub(O, (x, p[1], p[2] - .14)) for p in reversed(arc)]
    blade.append(front + back)
dz.append(loft('bl', 'fixed', YELD, blade, smooth=False))
dz.append(box('ce', 'fixed', 0x8a8c8e, sub(O, (0, .12, 2.92)), (3.44, .1, .12), .01))
for sx in (1, -1):
    dz.append(beam_path([sub(O, (sx * 1.2, .7, .8)), sub(O, (sx * 1.2, .55, 2.6))], .18, .22, YEL))
    dz += cylinder_ram(sub(O, (sx * .7, 1.5, 1.4)), sub(O, (sx * .7, 1.1, 2.55)), .08)
dz += [box('rp', 'fixed', 0x3a3b3d, sub(O, (0, .6, -2.2)), (.18, .9, .25), .03, rot=(-.3, 0, 0)),
       box('rt', 'fixed', 0x9a9c9e, sub(O, (0, .12, -2.4)), (.14, .25, .12), .02, rot=(.4, 0, 0))]
done('V_dozer', dz, O)

# ───────── 自卸卡車（車身 paint）─────────
def truck_chassis(O, cab_role, cab_col):
    out = [box('ch', 'fixed', DARK, sub(O, (0, .85, 0)), (1.1, .3, 7.0), .03)]
    for zz in (2.4, -1.4, -2.65):
        for sx in (1, -1):
            out += wheel(O, (sx * 1.02, .55, zz), .55, .42)
    for zz in (2.4, -2.0):
        for sx in (1, -1):
            out.append(box('mg', 'fixed', 0x222325, sub(O, (sx * 1.02, 1.12 if zz > 0 else 1.15, zz)), (.48, .05, 1.25 if zz < 0 else 1.1), .02))
    out += cabin(O, (0, 1.05, 2.6), (2.3, 1.95, 1.7), (cab_role, cab_col), roof=None)
    out += [box('bp', 'fixed', 0x333538, sub(O, (0, .7, 3.5)), (2.36, .3, .18), .04),
            box('gl', 'fixed', 0x2a2b2d, sub(O, (0, 1.2, 3.46)), (1.2, .45, .04), .01)]
    for sx in (1, -1):
        out.append(box('hl', 'fixed', 0xf1efe4, sub(O, (sx * .85, 1.3, 3.47)), (.28, .16, .03), .02, var=0))
        out.append(box('mr', 'fixed', 0x1f1f1f, sub(O, (sx * 1.35, 2.3, 3.1)), (.06, .35, .18), .02))
        out.append(tube('ma', 'fixed', 0x1f1f1f, [sub(O, (sx * 1.15, 2.4, 3.2)), sub(O, (sx * 1.33, 2.4, 3.12))], .015, 6))
    out.append(cyl('ft', 'fixed', 0x9ba4a9, sub(O, (.75, .75, .9)), sub(O, (.75, .75, 1.6)), .28, 16))
    out.append(cyl('ex', 'fixed', 0x3a3b3d, sub(O, (-1.0, 1.1, 1.65)), sub(O, (-1.0, 3.2, 1.65)), .07, 10))
    return out

O = (16, 0, 0)
dt = truck_chassis(O, 'paint', 0)
bed = [box('bf', 'paint', 0, sub(O, (0, 1.3, -1.3)), (2.4, .12, 4.6), .03),
       box('bl', 'paint', 0, sub(O, (1.16, 1.3, -1.3)), (.08, 1.3, 4.6), .03),
       box('br', 'paint', 0, sub(O, (-1.16, 1.3, -1.3)), (.08, 1.3, 4.6), .03),
       box('bb', 'paint', 0, sub(O, (0, 1.3, -3.56)), (2.4, 1.3, .1), .03),
       box('bc', 'paint', 0, sub(O, (0, 1.3, 1.0)), (2.4, 1.75, .12), .03),
       box('bv', 'paint', 0, sub(O, (0, 2.95, 1.35)), (2.4, .08, .7), .02)]
for i in range(5):
    for sx in (1, -1):
        bed.append(box('rb', 'paint', 0, sub(O, (sx * 1.22, 1.35, -3.3 + i * 1.1)), (.05, 1.2, .1), .01))
sand = bm_ell((1.1, .55, 2.2), 20, 10)
for v in sand.verts:
    v.co.y = max(v.co.y, -.05) + noise.noise(Vector(v.co) * 3) * .08
done('V_dump', dt + bed + [finish(sand, 'sd', 'fixed', 0xcbb07e, sub(O, (0, 2.1, -1.3)), var=.08)], O)

# ───────── 預拌車 ─────────
O = (24, 0, 0)
mx = truck_chassis(O, 'fixed', 0xe9e6df)
mx.append(box('st', 'fixed', 0xc03a2b, sub(O, (0, 1.55, 3.46)), (2.2, .14, .03), .005, var=0))
DR0 = [(.05, -1.7), (.55, -1.6), (1.1, -1.0), (1.28, -.2), (1.28, .4), (1.05, 1.0), (.6, 1.5), (.35, 1.65)]
DR = []
for (a, b) in zip(DR0, DR0[1:]):
    for i in range(4):
        t = i / 4
        DR.append((a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t))
DR.append(DR0[-1])
drum = lathe('dr', 'fixed', 0xe9e6df, DR, (0, 0, 0), 64, var=.02)
# 兩條螺旋紅帶：在滾筒自己的座標裡依角度與軸向位置上色，再擺到車上
def drum_r(y):
    for (a, b) in zip(DR0, DR0[1:]):
        if a[1] <= y <= b[1]:
            return a[0] + (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1])
    return DR0[-1][0]
stripes = []
for k in range(2):
    pts = []
    for i in range(49):
        y = -1.35 + 2.7 * i / 48
        a = k * math.pi + (y + 1.35) / 2.7 * TAU * 1.1
        rr = drum_r(y) + .012
        pts.append((math.sin(a) * rr, y, math.cos(a) * rr))
    st = finish(bm_tube(pts, .014, 6, True, 7, up=(0, 1, 0)), 'ds', 'fixed', 0xc03a2b, var=.02)
    stripes.append(st)
drum = join([drum] + stripes, 'drum')
drum.rotation_euler = Euler((math.pi / 2 - .22, 0, 0), 'XYZ')
drum.location = V(*sub(O, (0, 2.35, -.7)))
bpy.context.view_layer.update()
mx += [drum,
       box('fr', 'fixed', DARK, sub(O, (0, 1.2, 1.1)), (1.6, 1.3, .2), .03),
       box('rr', 'fixed', DARK, sub(O, (0, 1.2, -2.6)), (1.4, 1.5, .25), .03),
       lathe('hp', 'fixed', 0x9ba4a9, [(.35, 0), (.5, .35), (.25, .5)], sub(O, (0, 2.95, -2.75)), 16, var=.02),
       box('ch1', 'fixed', 0x9ba4a9, sub(O, (.5, 1.6, -3.4)), (.35, .12, 1.1), .03, rot=(.6, .5, 0)),
       cyl('wt', 'fixed', 0x3e6b8e, sub(O, (-.8, 1.3, .6)), sub(O, (-.8, 2.0, .6)), .3, 16)]
mx += railings(O, [(.95, 1.1, -2.8), (.95, 3.3, -2.8)], .0)
done('V_mixer', mx, O)

# ───────── 輪式裝載機 ─────────
O = (32, 0, 0)
ld = []
for zz in (1.2, -1.3):
    for sx in (1, -1):
        ld += wheel(O, (sx * 1.05, .75, zz), .75, .6, rim=YEL)
ld += [box('fr', 'fixed', YEL, sub(O, (0, .95, .9)), (1.3, .7, 1.6), .08),
       box('rr', 'fixed', YEL, sub(O, (0, 1.1, -1.35)), (1.75, 1.1, 2.2), .12),
       box('cw', 'fixed', YELD, sub(O, (0, .9, -2.5)), (1.8, .9, .35), .15),
       box('gr', 'fixed', DARK, sub(O, (0, 1.2, -2.68)), (1.2, .6, .03), .01),
       cyl('ex', 'fixed', 0x3a3b3d, sub(O, (.5, 2.2, -1.9)), sub(O, (.5, 2.7, -1.9)), .06, 10)]
ld += cabin(O, (0, 1.8, -.25), (1.5, 1.55, 1.4), ('fixed', YEL), roof=0x2a2b2d)
for sx in (1, -1):
    ld.append(beam_path([sub(O, (sx * .55, 1.7, .6)), sub(O, (sx * .55, 1.35, 1.9)), sub(O, (sx * .55, .9, 2.7))], .2, .35, YEL))
ld += cylinder_ram(sub(O, (0, 1.1, 1.2)), sub(O, (0, 1.2, 2.5)), .09)
ld += [box('bk', 'fixed', YELD, sub(O, (0, .35, 3.05)), (2.6, .85, .5), .06, rot=(-.2, 0, 0)),
       box('bs1', 'fixed', YELD, sub(O, (1.28, .3, 2.95)), (.05, .9, .9), .02),
       box('bs2', 'fixed', YELD, sub(O, (-1.28, .3, 2.95)), (.05, .9, .9), .02),
       box('be', 'fixed', 0x8a8c8e, sub(O, (0, .08, 3.45)), (2.6, .06, .2), .01)]
done('V_loader', ld, O)

# ───────── 皮卡（車身 paint）─────────
O = (40, 0, 0)
pk = []
for zz in (1.55, -1.55):
    for sx in (1, -1):
        pk += wheel(O, (sx * .82, .4, zz), .4, .3, rim=0xb9bcbf)
pk += [box('lo', 'paint', 0, sub(O, (0, .45, 0)), (1.85, .55, 5.2), .15),
       box('hd', 'paint', 0, sub(O, (0, .95, 2.0)), (1.8, .22, 1.3), .12, rot=(.08, 0, 0)),
       box('bw1', 'paint', 0, sub(O, (.88, 1.0, -1.55)), (.08, .45, 2.0), .03),
       box('bw2', 'paint', 0, sub(O, (-.88, 1.0, -1.55)), (.08, .45, 2.0), .03),
       box('bw3', 'paint', 0, sub(O, (0, 1.0, -2.55)), (1.84, .45, .08), .03),
       box('bl', 'fixed', 0x2a2b2d, sub(O, (0, 1.0, -1.55)), (1.7, .02, 1.95), .01),
       box('bp1', 'fixed', 0x3a3b3d, sub(O, (0, .35, 2.62)), (1.9, .22, .14), .05),
       box('bp2', 'fixed', 0x3a3b3d, sub(O, (0, .35, -2.62)), (1.9, .22, .14), .05),
       box('gr', 'fixed', 0x2a2b2d, sub(O, (0, .75, 2.6)), (1.0, .25, .04), .02)]
pk += cabin(O, (0, 1.0, .45), (1.75, .95, 1.9), ('paint', 0), bevel=.1, roof=None)
pk.append(box('bc', 'fixed', 0xe8671d, sub(O, (0, 1.97, .45)), (.7, .1, .22), .03, var=0))
for sx in (1, -1):
    pk.append(box('hl', 'fixed', 0xf1efe4, sub(O, (sx * .7, .8, 2.61)), (.3, .12, .03), .02, var=0))
    pk.append(box('tl', 'fixed', 0xc03a2b, sub(O, (sx * .8, .9, -2.61)), (.12, .25, .03), .02, var=0))
    pk.append(box('mr', 'fixed', 0x1f1f1f, sub(O, (sx * .98, 1.45, 1.35)), (.14, .12, .06), .02))
done('V_pickup', pk, O)

# ───────── 堆高機 ─────────
O = (47, 0, 0)
fk = wheel(O, (.6, .3, .6), .3, .25) + wheel(O, (-.6, .3, .6), .3, .25) + wheel(O, (.55, .25, -.7), .25, .2) + wheel(O, (-.55, .25, -.7), .25, .2)
fk += [box('bd', 'fixed', 0xe8671d, sub(O, (0, .25, -.05)), (1.1, .75, 1.9), .12),
       box('cw', 'fixed', 0x2c2d2f, sub(O, (0, .3, -.95)), (1.1, .8, .35), .15),
       box('se', 'fixed', 0x1f1f1f, sub(O, (0, 1.0, -.3)), (.5, .12, .5), .05),
       box('sb', 'fixed', 0x1f1f1f, sub(O, (0, 1.1, -.55)), (.5, .5, .1), .04),
       box('ro', 'fixed', 0x1f1f1f, sub(O, (0, 2.2, -.1)), (1.0, .05, 1.3), .02)]
for sx in (1, -1):
    for zz in (.5, -.7):
        fk.append(tube('gp', 'fixed', 0x1f1f1f, [sub(O, (sx * .45, 1.0, zz)), sub(O, (sx * .45, 2.2, zz * .9))], .035, 8))
    fk.append(box('ms', 'fixed', 0x3a3b3d, sub(O, (sx * .3, .1, 1.12)), (.08, 2.7, .12), .02))
    fk.append(box('fo', 'fixed', 0x9a9c9e, sub(O, (sx * .3, .05, 1.65)), (.1, .05, 1.0), .01))
    fk.append(box('fu', 'fixed', 0x9a9c9e, sub(O, (sx * .3, .05, 1.17)), (.1, .6, .05), .01))
fk.append(box('cr', 'fixed', 0x3a3b3d, sub(O, (0, .6, 1.2)), (.85, .08, .08), .02))
done('V_forklift', fk, O)

# ───────── 雙旋翼起重直升機（機身原點 = 網頁 HELI 原點）─────────
O = (0, 0, 20)
OR, WH = 0xe8671d, 0xe9e6df
keys = [(8.1, -.15, .5, .5), (7.7, -.05, 1.6, 1.5), (7.0, .05, 2.4, 2.3), (6.2, .1, 2.65, 2.7), (4.5, .1, 2.75, 2.85), (-4.0, .1, 2.75, 2.85), (-5.3, .35, 2.4, 2.6), (-6.4, .8, 1.5, 1.6), (-6.9, 1.0, .9, 1.0)]
secs = []
for (a, b) in zip(keys, keys[1:]):
    for i in range(4):
        t = i / 4
        z, cy, w, h = [a[j] + (b[j] - a[j]) * t for j in range(4)]
        secs.append([sub(O, p) for p in rrect(0, cy, w, h, min(w, h) * .38, z, 4)])
z, cy, w, h = keys[-1]
secs.append([sub(O, p) for p in rrect(0, cy, w, h, min(w, h) * .38, z, 4)])
fus = loft('fu', 'fixed', OR, secs, var=.015)
recolor(fus, lambda p, n: hexrgb(WH) if -.45 < p.y - O[1] < .05 else (hexrgb(0x2b2d30) if p.y - O[1] < -1.05 else None))
hl = [fus]
pyl = []
for zz, top, ln in ((5.2, 1.6, 2.4), (-5.4, 3.0, 3.2)):
    s2 = []
    for k in range(6):
        t = k / 5
        s2.append([sub(O, p) for p in rrect(0, 1.25 + (top - 1.25) * .5, 1.3 - .3 * abs(t - .5), top - 1.1, .3, zz - ln / 2 + ln * t, 3)])
    hl.append(loft('py', 'fixed', OR, s2, var=.015))
    hl.append(cyl('mh', 'fixed', 0x3a3b3d, sub(O, (0, top, zz)), sub(O, (0, top + .35, zz)), .3, 14))
hl += [box('ck', 'fixed', GLASS, sub(O, (0, .45, 7.2)), (2.0, .75, .9), .2, rot=(-.5, 0, 0), var=0),
       box('cs1', 'fixed', GLASS, sub(O, (1.3, .55, 6.6)), (.04, .6, 1.0), .05, var=0),
       box('cs2', 'fixed', GLASS, sub(O, (-1.3, .55, 6.6)), (.04, .6, 1.0), .05, var=0)]
for i in range(8):
    for sx in (1, -1):
        hl.append(box('wn', 'fixed', GLASS, sub(O, (sx * 1.385, .5, 4.2 - i * 1.05)), (.02, .38, .45), .06, var=0))
for sx in (1, -1):
    hl += [box('sp', 'fixed', OR, sub(O, (sx * 1.55, -1.25, -.2)), (.5, .75, 6.4), .25, seg=3, smooth=True),
           tube('gs', 'fixed', 0x3a3b3d, [sub(O, (sx * 1.3, -1.1, 4.0)), sub(O, (sx * 1.45, -1.75, 4.0))], .07, 8),
           tube('gs', 'fixed', 0x3a3b3d, [sub(O, (sx * 1.7, -1.3, -4.0)), sub(O, (sx * 1.75, -1.75, -4.0))], .07, 8)]
    hl += wheel(O, (sx * 1.45, -1.9, 4.0), .34, .24, rim=0x9ba4a9)
    hl += wheel(O, (sx * 1.75, -1.9, -4.0), .34, .24, rim=0x9ba4a9)
hl += [box('hk', 'fixed', 0x9ba4a9, sub(O, (0, -1.45, 0)), (.35, .25, .35), .05),
       box('ra', 'fixed', 0x2b2d30, sub(O, (0, -.2, -6.6)), (1.2, .06, .9), .02)]
done('H_body', hl, O, 30)
R = (0, 0, 40)
rt = [lathe('hub', 'fixed', 0x2c2d2f, [(.001, .25), (.28, .2), (.32, 0), (.25, -.2)], R, 16)]
for i in range(3):
    a = i * TAU / 3
    secs = []
    for k in range(7):
        rr = .35 + k / 6 * 8.9
        ch = .45 - k / 6 * .12
        tw = .12 - k / 6 * .1
        c, s = math.cos(a), math.sin(a)
        pts = [(-ch / 2, .02), (ch / 2, -.02), (ch / 2 - .02, -.035), (-ch / 2 + .02, .0)]
        sec = []
        for (u, v) in pts:
            vy = v + u * tw
            sec.append(sub(R, (c * rr - s * u, .1 + vy, s * rr + c * u)))
        secs.append(sec)
    bl = loft('bl', 'fixed', 0x202224, secs, smooth=False)
    recolor(bl, lambda p, n: hexrgb(0xf4b400) if math.hypot(p.x - R[0], p.z - R[2]) > 8.6 else None)
    rt.append(bl)
done('H_rotor', rt, R, 30)

print('tris', tri_count(OUT))
ao_bake(BAKE, samples=int(os.environ.get('SAMPLES', '32')))
if PREVIEW:
    os.makedirs(PREVIEW, exist_ok=True)
    preview(os.path.join(PREVIEW, 'm_exc.png'), (0, 2.2, 1.5), 13, 40, 18)
    preview(os.path.join(PREVIEW, 'm_trucks.png'), (20, 1.5, 0), 16, 50, 20)
    preview(os.path.join(PREVIEW, 'm_more.png'), (39, 1.2, 0), 14, 40, 20)
    preview(os.path.join(PREVIEW, 'm_heli.png'), (0, .5, 20), 22, 55, 15)
export(os.environ.get('GLB', os.path.join(HERE, 'machines.glb')), OUT)
