# 190 封頂：工人（蒙皮網格 + 19 根骨頭）、臉、頭髮與鬍子變化、翼型降落傘、安全帽、防護背心、
#          四把槍（含可拆的彈匣、4 倍鏡）、第一人稱手臂、遠距離用的低面數身體與戰利品 → workers.glb
# 重建：/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P assets/190/build_workers.py
#   環境變數 PREVIEW=資料夾 會另存預覽圖（調色盤部位塗上示範顏色）；SAMPLES=烘焙取樣數；STAGE=body 只做身體
import sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lb_lib import *
from mathutils.bvhtree import BVHTree

HERE = os.path.dirname(os.path.abspath(__file__))
PREVIEW = os.environ.get('PREVIEW')
STAGE = os.environ.get('STAGE', '')
reset()
random.seed(190)

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

# ───────── 骨架：19 根骨頭，全部朝上、沒有滾轉（靜止旋轉是單位四元數，網頁直接轉 bone.rotation）─────────
# 手臂在靜止姿勢微微張開（約 12°），軀幹兩側和手臂內側之間留縫，權重才分得乾淨
BONES = [  # 名稱, 關節位置（three 世界座標）, 父骨
    ('hips', (0, .94, 0), None), ('torso', (0, 1.04, 0), 'hips'), ('chest', (0, 1.25, 0), 'torso'),
    ('neck', (0, 1.49, -.01), 'chest'), ('head', (0, 1.6, 0), 'neck'),
]
for sx, t in ((1, 'L'), (-1, 'R')):
    BONES += [('clav' + t, (sx * .03, 1.44, 0), 'chest'), ('up' + t, (sx * .185, 1.44, 0), 'clav' + t),
              ('fore' + t, (sx * .262, 1.15, 0), 'up' + t), ('hand' + t, (sx * .305, .9, .005), 'fore' + t)]
for sx, t in ((1, 'L'), (-1, 'R')):
    BONES += [('thigh' + t, (sx * .098, .9, 0), 'hips'), ('shin' + t, (sx * .103, .5, .004), 'thigh' + t), ('foot' + t, (sx * .105, .095, -.012), 'shin' + t)]
BP = {n: Vector(p) for (n, p, _) in BONES}
SEG = {  # 權重用的骨段
    'hips': ((0, .84, 0), (0, 1.0, 0)), 'torso': ((0, 1.05, 0), (0, 1.2, 0)), 'chest': ((0, 1.26, 0), (0, 1.42, 0)),
    'neck': ((0, 1.5, -.01), (0, 1.58, 0)), 'head': ((0, 1.64, 0), (0, 1.8, 0)),
}
for sx, t in ((1, 'L'), (-1, 'R')):
    SEG.update({
        'clav' + t: ((sx * .05, 1.45, 0), (sx * .15, 1.45, 0)), 'up' + t: ((sx * .19, 1.42, 0), (sx * .257, 1.17, 0)),
        'fore' + t: ((sx * .265, 1.13, 0), (sx * .302, .92, .005)), 'hand' + t: ((sx * .308, .88, .005), (sx * .32, .76, .01)),
        'thigh' + t: ((sx * .098, .86, 0), (sx * .103, .53, .004)), 'shin' + t: ((sx * .103, .47, .004), (sx * .105, .14, -.01)),
        'foot' + t: ((sx * .105, .06, -.01), (sx * .105, .03, .15)),
    })

def seg_d(p, a, b):
    a, b = Vector(a), Vector(b)
    ab = b - a
    t = max(0.0, min(1.0, (p - a).dot(ab) / ab.dot(ab)))
    return (p - (a + ab * t)).length

def side_ok(p, b):
    """左邊的點不能吃右邊骨頭的權重（反之亦然），走路時胯下、腋下才不會被扯"""
    if b.endswith('L') and p.x < -.02:
        return False
    if b.endswith('R') and p.x > .02:
        return False
    return True

def skin(ob, bones, power=6.0, fn=None):
    """距離式權重：只在允許的骨頭間分配；單一骨頭則整塊跟著動；fn(p) 可直接回傳 {骨頭: 權重}"""
    bpy.context.view_layer.update()
    mw = ob.matrix_world
    names = set(bones)
    groups = {}
    def G(b):
        if b not in groups:
            groups[b] = ob.vertex_groups.get(b) or ob.vertex_groups.new(name=b)
        return groups[b]
    for v in ob.data.vertices:
        p = T(mw @ v.co)
        if fn:
            ws = fn(p)
            if ws:
                s = sum(ws.values())
                for b, w in ws.items():
                    if w / s > .01:
                        G(b).add([v.index], w / s, 'REPLACE')
                continue
        if len(bones) == 1:
            G(bones[0]).add([v.index], 1.0, 'REPLACE'); continue
        cand = [b for b in bones if side_ok(p, b)] or bones
        ws = sorted(((1.0 / (seg_d(p, *SEG[b]) + .012) ** power, b) for b in cand), reverse=True)[:3]
        s = sum(w for w, _ in ws)
        for w, b in ws:
            if w / s > .01:
                G(b).add([v.index], w / s, 'REPLACE')
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

def limb(name, role, color, pts, radii, seg=18, caps=True, flat=1.0, step=.028):
    p2, r2 = resample(pts, radii, step)
    return finish(bm_tube(p2, r2, seg, caps, flat, up=(0, 0, 1)), name, role, color, var=.03)

def fabric(ob, amp=.0022, freq=38):
    """布料的細微起伏"""
    me = ob.data
    for v in me.vertices:
        v.co = v.co + v.normal * noise.noise(v.co * freq) * amp
    me.update()

def gauss(d, r):
    return math.exp(-(d / r) ** 2)

def orient(ob):
    """面的朝向：封閉網格 Σ 面積×(法線·(中心−參考點)) = 3×體積，負的就整個翻面（網頁只畫正面，翻反了會看穿）"""
    me = ob.data
    if not len(me.polygons):
        return ob
    c = sum((ob.matrix_world @ v.co for v in me.vertices), Vector()) / len(me.vertices)
    tot = 0.0
    for poly in me.polygons:
        tot += poly.area * poly.normal.dot(poly.center - c)
    if tot < 0:
        bm = bmesh.new(); bm.from_mesh(me)
        bmesh.ops.reverse_faces(bm, faces=bm.faces)
        bm.to_mesh(me); bm.free(); me.update()
    return ob

def orient_all(objs):
    for o in objs:
        if o is not None and o.type == 'MESH' and not o.name.startswith(('tv', 'ts', 'zip')):
            orient(o)
    return objs

BODY = []
def B_(ob, *bones, cloth=False, fn=None):
    orient_all([ob])
    if cloth:
        fabric(ob)
    skin(ob, list(bones), fn=fn)
    BODY.append(ob)
    return ob

# ───────── 身體：Skin 修改器從骨架線長出連續的衣服外形，再細分與雕塑 ─────────
SKG = []   # (名稱, 位置, 半徑(寬, 深), 父, 部位)
def SN(name, p, r, parent=None, pt='torso'):
    SKG.append((name, p, r, parent, pt))
SN('pelvis', (0, .9, -.004), (.172, .128), None, 'torso')
SN('hipt', (0, .99, -.004), (.166, .122), 'pelvis')
SN('waist', (0, 1.09, 0), (.162, .118), 'hipt')
SN('belly', (0, 1.19, .006), (.17, .124), 'waist')
SN('chest', (0, 1.3, .008), (.19, .13), 'belly')
SN('uch', (0, 1.39, -.002), (.19, .118), 'chest')
SN('shl', (0, 1.455, -.012), (.13, .09), 'uch')
SN('neck0', (0, 1.52, -.014), (.064, .06), 'shl', 'neck')
SN('neck1', (0, 1.64, -.008), (.056, .054), 'neck0', 'neck')
for sx, t in ((1, 'L'), (-1, 'R')):
    SN('sh' + t, (sx * .1, 1.43, -.004), (.085, .085), 'uch', 'arm' + t)
    SN('dl' + t, (sx * .185, 1.425, -.004), (.08, .078), 'sh' + t, 'arm' + t)
    SN('ua' + t, (sx * .222, 1.29, 0), (.064, .064), 'dl' + t, 'arm' + t)
    SN('el' + t, (sx * .262, 1.15, 0), (.055, .055), 'ua' + t, 'arm' + t)
    SN('fa' + t, (sx * .283, 1.03, .003), (.053, .049), 'el' + t, 'arm' + t)
    SN('wr' + t, (sx * .302, .925, .005), (.046, .041), 'fa' + t, 'arm' + t)
    SN('hp' + t, (sx * .1, .84, 0), (.112, .112), 'pelvis', 'leg' + t)
    SN('th' + t, (sx * .102, .68, .003), (.098, .098), 'hp' + t, 'leg' + t)
    SN('kn' + t, (sx * .103, .5, .006), (.082, .082), 'th' + t, 'leg' + t)
    SN('ca' + t, (sx * .104, .34, -.004), (.08, .08), 'kn' + t, 'leg' + t)
    SN('an' + t, (sx * .105, .14, -.004), (.07, .07), 'ca' + t, 'leg' + t)

def build_skin_body():
    idx = {}
    verts, edges = [], []
    for (n, p, r, par, pt) in SKG:
        idx[n] = len(verts); verts.append(V(*p))
        if par:
            edges.append((idx[par], idx[n]))
    me = bpy.data.meshes.new('skinbody')
    me.from_pydata(verts, edges, [])
    ob = bpy.data.objects.new('skinbody', me)
    bpy.context.scene.collection.objects.link(ob)
    ob.modifiers.new('Skin', 'SKIN')
    for (n, p, r, par, pt) in SKG:
        me.skin_vertices[0].data[idx[n]].radius = r
    me.skin_vertices[0].data[idx['pelvis']].use_root = True
    ss = ob.modifiers.new('Sub', 'SUBSURF'); ss.levels = 2
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.modifier_apply(modifier='Skin')
    bpy.ops.object.modifier_apply(modifier='Sub')
    return ob

# 骨架線段（給分部位與雕塑用）
SKSEG = []
_skp = {n: (Vector(p), r, pt) for (n, p, r, par, pt) in SKG}
for (n, p, r, par, pt) in SKG:
    if par:
        a, ra, _ = _skp[par]
        SKSEG.append((a, Vector(p), (ra[0] + ra[1]) / 2, (r[0] + r[1]) / 2, pt if pt != 'torso' or _skp[par][2] == 'torso' else pt))

def body_part(p):
    """依離哪條骨架線最近（以半徑正規化）決定是軀幹、脖子、哪隻手或腳"""
    best, bp = 1e9, 'torso'
    for (a, b, ra, rb, pt) in SKSEG:
        ab = b - a
        t = max(0.0, min(1.0, (p - a).dot(ab) / ab.dot(ab)))
        d = (p - (a + ab * t)).length / (ra + (rb - ra) * t)
        if d < best:
            best, bp = d, pt
    return bp

PART_BONES = {
    'torso': ['hips', 'torso', 'chest', 'clavL', 'clavR', 'thighL', 'thighR'],
    'neck': ['chest', 'neck', 'head'],
    'armL': ['chest', 'clavL', 'upL', 'foreL', 'handL'], 'armR': ['chest', 'clavR', 'upR', 'foreR', 'handR'],
    'legL': ['hips', 'thighL', 'shinL', 'footL'], 'legR': ['hips', 'thighR', 'shinR', 'footR'],
}

def body_weights(p):
    pt = body_part(p)
    cand = [b for b in PART_BONES[pt] if side_ok(p, b)]
    if pt == 'torso' and p.y > .9:
        cand = [b for b in cand if not b.startswith('thigh')]
    if pt == 'torso' and p.y < 1.4:
        cand = [b for b in cand if not b.startswith('clav')]
    pw = 4.5 if pt in ('torso', 'neck') else 6.0
    ws = sorted(((1.0 / (seg_d(p, *SEG[b]) + .012) ** pw, b) for b in cand), reverse=True)[:3]
    return {b: w for w, b in ws}

def sculpt_body(ob):
    """在細分後的外形上加肌肉與衣服的起伏：胸、肩胛、臀、小腿、三角肌，外套下擺與褶皺"""
    me = ob.data
    for v in me.vertices:
        p = T(v.co)
        n = T(v.normal).normalized()
        d = 0.0
        for sx in (1, -1):
            d += .016 * gauss((p - Vector((sx * .085, 1.34, .1))).length, .075) * max(0, n.z)       # 胸
            d += .012 * gauss((p - Vector((sx * .09, 1.36, -.1))).length, .08) * max(0, -n.z)      # 肩胛
            d += .018 * gauss((p - Vector((sx * .085, .88, -.1))).length, .085) * max(0, -n.z)     # 臀
            d += .012 * gauss((p - Vector((sx * .105, .36, -.06))).length, .07) * max(0, -n.z)     # 小腿
            d += .01 * gauss((p - Vector((sx * .205, 1.4, 0))).length, .06)                        # 三角肌
            d += .008 * gauss((p - Vector((sx * .225, 1.3, .03))).length, .05) * max(0, n.z)      # 二頭
            d -= .012 * gauss((p - Vector((sx * .1, .5, -.06))).length, .045) * max(0, -n.z)     # 膝窩
            d -= .01 * gauss((p - Vector((sx * .258, 1.15, .04))).length, .04) * max(0, n.z)      # 手肘內側
        d -= .01 * gauss(abs(p.y - 1.12), .05) * (1 if abs(p.x) < .2 else 0)                     # 腰身
        # 外套下擺：在 1.0 附近往外翻一圈
        if abs(p.x) < .2 and 1.0 < p.y < 1.035:
            d += .007 * math.sin((p.y - 1.0) / .035 * math.pi)
        # 手肘、膝蓋、腰的布料皺褶
        for sx in (1, -1):
            for (c, r, f) in (((sx * .262, 1.15, 0), .07, 120), ((sx * .103, .5, 0), .08, 90), ((sx * .1, .12, 0), .07, 110)):
                w = gauss((p - Vector(c)).length, r)
                if w > .05:
                    d += .004 * w * math.sin(p.y * f + noise.noise(p * 12) * 3)
        d += noise.noise(p * 22) * .0025
        v.co = V(*(p + n * d))
    me.update()

def split_roles(ob, fn):
    """把一個物件依面分給不同材質（部位）：fn(面中心) → 部位名稱"""
    me = ob.data
    names = []
    for poly in me.polygons:
        c = T(ob.matrix_world @ poly.center)
        r = fn(c)
        if r not in names:
            names.append(r)
    me.materials.clear()
    for r in names:
        me.materials.append(mat(r))
    for poly in me.polygons:
        poly.material_index = names.index(fn(T(ob.matrix_world @ poly.center)))

DEMO = {'shirt': 0x2f4a5a, 'pants': 0x283347, 'skin': 0xc98f6a, 'glove': 0xe0b33a, 'vis': 0xd9ea2b, 'hair': 0x2a211a, 'paint': 0x888888}
def tint_roles(objs, table=DEMO):
    """預覽用：把調色盤部位（白色）乘上示範顏色；匯出之後才呼叫"""
    for ob in objs:
        if ob.type != 'MESH':
            continue
        me = ob.data
        col = me.color_attributes.get('Col')
        if not col:
            continue
        a = np.zeros(len(me.vertices) * 4, dtype=np.float32)
        col.data.foreach_get('color', a)
        a = a.reshape(-1, 4)
        done = set()
        for poly in me.polygons:
            nm = me.materials[poly.material_index].name if me.materials else 'fixed'
            if nm not in table:
                continue
            c = [srgb2lin(x) for x in hexrgb(table[nm])]
            for vi in poly.vertices:
                if vi not in done:
                    a[vi, :3] *= c; done.add(vi)
        col.data.foreach_set('color', a.ravel())

body = build_skin_body()
sculpt_body(body)
def body_role(c):
    pt = body_part(c)
    if pt == 'neck':
        return 'skin' if c.y > 1.54 + (.02 if c.z < -.02 else 0) else 'shirt'
    if pt.startswith('leg'):
        return 'pants'
    if pt == 'torso':
        return 'pants' if c.y < 1.005 else 'shirt'
    return 'shirt'
split_roles(body, body_role)
paint(body, lambda p, n: (1, 1, 1))
# 衣服的接縫：肩線、側縫、褲子側縫與胯下，顏色壓暗一點（乘上調色盤後就是縫線）
def seams(p, n):
    k = 1.0
    ax = abs(p.x)
    for sx in (1, -1):
        k -= .16 * gauss(p.x - sx * .19, .006) * (1 if 1.1 < p.y < 1.42 and abs(p.z) < .03 else 0)
    k -= .14 * gauss(abs(p.z) - .0, .006) * (1 if ax > .14 and 1.0 < p.y < 1.4 else 0)
    k -= .14 * gauss(p.z + 0, .008) * (1 if ax > .13 and p.y < .95 else 0) * (1 if ax > .12 else 0)
    k -= .1 * gauss(p.y - 1.46, .01) * (1 if ax > .1 else 0)
    k -= .06 * gauss(p.y - 1.012, .008)
    k *= 1 + noise.noise(p * 60) * .03
    return (k, k, k)
recolor(body, lambda p, n: seams(p, n) if p.y < 1.54 else None)
B_(body, fn=body_weights)
for p in body.data.polygons:
    p.use_smooth = True


# ── 貼著身體表面放東西的工具（射線打在剛做好的身體上）──
bpy.context.view_layer.update()
_dg = bpy.context.evaluated_depsgraph_get()
BVH = BVHTree.FromObject(body, _dg)

def ray(o, d):
    o, d = Vector(o), Vector(d).normalized()
    loc, nor, i, dist = BVH.ray_cast(V(*o), V(*d))
    if loc is None:
        return None, None
    return T(loc), T(nor).normalized()

def near(p):
    loc, nor, i, dist = BVH.find_nearest(V(*p))
    return T(loc), T(nor).normalized()

def ss(e0, e1, x):
    t = max(0.0, min(1.0, (x - e0) / (e1 - e0)))
    return t * t * (3 - 2 * t)

def g2(dx, dy, rx, ry):
    return math.exp(-(dx / rx) ** 2 - (dy / ry) ** 2)

def ring_pts(c, y, off, n=48, zc=0.0):
    """在高度 y、繞垂直軸 (c.x, zc) 一圈打射線，回傳表面外推 off 的點"""
    pts = []
    for i in range(n):
        a = i / n * TAU
        p, nn = ray((c, y, zc), (math.sin(a), 0, math.cos(a)))
        pts.append(tuple(p + nn * off) if p else (c + math.sin(a) * .1, y, zc + math.cos(a) * .1))
    return pts

def band(name, role, color, y0, y1, off, cx=0.0, zc=0.0, n=48, th=.004, var=.03):
    """表面上的一圈帶子（腰帶、反光帶、綁帶）：外圈兩層 + 內圈，封成有厚度的環"""
    ya, yb = ring_pts(cx, y0, off, n, zc), ring_pts(cx, y1, off, n, zc)
    yi, yj = ring_pts(cx, y0, off - th, n, zc), ring_pts(cx, y1, off - th, n, zc)
    bm = bmesh.new()
    rows = [[bm.verts.new(p) for p in r] for r in (yi, ya, yb, yj)]
    for k in range(4):
        for i in range(n):
            j = (i + 1) % n
            bm.faces.new((rows[k][i], rows[k][j], rows[(k + 1) % 4][j], rows[(k + 1) % 4][i]))
    return finish(bm, name, role, color, var=var)

def on_surface(name, role, color, o, d, size, lift=0.0, bevel=.006, tilt=0.0, smooth=True, var=.04):
    """沿射線找到表面，放一個貼著表面的方塊（口袋、護膝、貼片）"""
    p, n = ray(o, d)
    if p is None:
        return None
    yaw = math.atan2(n.x, n.z)
    pitch = -math.asin(max(-1, min(1, n.y)))
    c = p + n * (size[2] / 2 + lift)
    return box(name, role, color, tuple(c), size, bevel, rot=(pitch + tilt, yaw, 0), smooth=smooth, var=var)

VC = Vector((0, 1.25, 0))
def sph_hit(th, ph, off, c=VC):
    d = Vector((math.sin(th) * math.cos(ph), math.sin(ph), math.cos(th) * math.cos(ph)))
    p, n = ray(c, d)
    if p is None:
        return tuple(c + d * .15)
    return tuple(p + n * off)

def patch(name, role, color, th0, th1, ph0, ph1, nth, nph, off, keep=None, var=.03, th_fn=None):
    """以軀幹中心的球座標 (θ, φ) 取一塊貼在表面的網格；keep(θ, φ) 決定哪些格子要留下"""
    bm = bmesh.new()
    G = []
    for i in range(nth + 1):
        th = th0 + (th1 - th0) * i / nth
        top = th_fn(th) if th_fn else ph1
        col = []
        for j in range(nph + 1):
            ph = ph0 + (top - ph0) * j / nph
            col.append(bm.verts.new(sph_hit(th, ph, off)))
        G.append(col)
    for i in range(nth):
        for j in range(nph):
            thc = th0 + (th1 - th0) * (i + .5) / nth
            topc = th_fn(thc) if th_fn else ph1
            phc = ph0 + (topc - ph0) * (j + .5) / nph
            if keep and not keep(thc, phc):
                continue
            bm.faces.new((G[i][j], G[i + 1][j], G[i + 1][j + 1], G[i][j + 1]))
    loose = [v for v in bm.verts if not v.link_faces]
    bmesh.ops.delete(bm, geom=loose, context='VERTS')
    return bm

def smooth_boundary(bm, off, it=6):
    """刪掉格子後邊緣會呈鋸齒：沿邊界做幾次平滑，再貼回表面"""
    for _ in range(it):
        newp = {}
        for v in bm.verts:
            be = [e for e in v.link_edges if e.is_boundary]
            if len(be) == 2:
                a, b = (e.other_vert(v).co for e in be)
                newp[v] = v.co * .5 + (a + b) * .25
        for v, p in newp.items():
            q, n = near(tuple(p))
            v.co = q + n * off

def solid(ob, th):
    m = ob.modifiers.new('Sol', 'SOLIDIFY'); m.thickness = th; m.offset = -1; m.use_even_offset = True
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.modifier_apply(modifier='Sol')
    return ob

TORSO_B = ('hips', 'torso', 'chest', 'clavL', 'clavR')
CHEST_B = ('torso', 'chest', 'clavL', 'clavR')

# ── 反光背心：球座標網格，V 領、袖口挖空，邊緣平滑 ──
D = math.radians
def vest_top(th):
    a = abs(math.degrees(th))
    v = math.cos(min(1, a / 30) * math.pi / 2) ** 2 if a < 30 else 0      # 前面 V 領
    b = max(0, 1 - abs(a - 180) / 40) ** 2                                 # 後領
    return D(71 - 33 * v - 6 * b)
def vest_keep(th, ph):
    a = abs(math.degrees(th))
    return ((a - 90) / 36) ** 2 + ((math.degrees(ph) - 28) / 27) ** 2 > 1
VPH0 = D(-53)
vb = patch('vest', 'vis', 0, -math.pi, math.pi, VPH0, 0, 72, 26, .011, keep=vest_keep, th_fn=vest_top)
smooth_boundary(vb, .011)
vest = finish(vb, 'vest', 'vis', 0)
solid(vest, .006)
fabric(vest, .0015, 30)
B_(vest, *TORSO_B)
# 反光條：兩圈橫帶 + 前後各兩條直帶 + 越過肩膀
for (y0, y1) in ((1.095, 1.135), (1.2, 1.24)):
    B_(band('tape', 'fixed', TAPE, y0, y1, .0185, n=72, th=.003, var=0), *TORSO_B)
for sx in (1, -1):
    for c in (D(31), D(149)):
        tb = patch('tv', 'fixed', TAPE, sx * c - D(3.2), sx * c + D(3.2), D(-40), D(64), 2, 26, .0185)
        B_(finish(tb, 'tv', 'fixed', TAPE, var=0), *TORSO_B)
    tb = patch('ts', 'fixed', TAPE, sx * D(28), sx * D(152), D(60), D(66.5), 30, 2, .0185)
    B_(finish(tb, 'ts', 'fixed', TAPE, var=0), *CHEST_B)
# 拉鍊、胸前口袋、對講機、名牌
zb = patch('zip', 'fixed', 0x2b2b2b, -D(1.1), D(1.1), VPH0, D(37), 1, 20, .0175)
B_(finish(zb, 'zip', 'fixed', 0x2b2b2b, var=0), *TORSO_B)
B_(on_surface('zp', 'fixed', 0x9a9c9e, (0, 1.36, 0), (0, 0, 1), (.012, .022, .006), .014, .002), 'chest')
for sx in (1, -1):
    B_(on_surface('vp', 'vis', 0, (sx * .07, 1.08, 0), (sx * .55, 0, 1), (.075, .085, .014), .012, .005), 'torso', 'hips')
    B_(on_surface('vpf', 'vis', 0, (sx * .07, 1.125, 0), (sx * .55, 0, 1), (.08, .022, .016), .014, .004), 'torso')
B_(on_surface('pk', 'vis', 0, (.075, 1.3, 0), (.5, 0, 1), (.07, .075, .014), .012, .005), 'chest')
B_(on_surface('pen', 'fixed', 0x1f4fa8, (.085, 1.345, 0), (.5, 0, 1), (.007, .05, .007), .02, .002), 'chest')
B_(on_surface('rd', 'fixed', 0x1f1f1f, (-.075, 1.31, 0), (-.5, 0, 1), (.042, .07, .024), .012, .006), 'chest')
B_(on_surface('rdb', 'fixed', 0x3a3a3a, (-.075, 1.35, 0), (-.5, 0, 1), (.044, .012, .026), .012, .003), 'chest')
p, n = ray((-.085, 1.35, 0), (-.5, 0, 1))
B_(tube('ra', 'fixed', 0x1f1f1f, [tuple(p + n * .03 + Vector((0, .01, 0))), tuple(p + n * .03 + Vector((0, .07, 0)))], .0045, 6), 'chest')
B_(on_surface('bd', 'fixed', 0xeeeeee, (-.07, 1.21, 0), (-.45, 0, 1), (.06, .032, .004), .02, .001, var=0), 'chest')
B_(on_surface('bdl', 'fixed', 0x1f4fa8, (-.07, 1.222, 0), (-.45, 0, 1), (.06, .008, .005), .02, .001, var=0), 'chest')
B_(on_surface('tk', 'fixed', 0x2d3a44, (0, 1.33, 0), (0, 0, -1), (.2, .07, .006), .02, .002), 'chest')

# ── 領子、袖口、肩章口袋 ──
nk = ring_pts(0, 1.51, .004, 40, -.012)
nk2 = ring_pts(0, 1.565, .01, 40, -.012)
col_bm = bmesh.new()
r0 = [col_bm.verts.new(p) for p in nk]
r1 = [col_bm.verts.new(p) for p in nk2]
r2 = [col_bm.verts.new(tuple(Vector(p) + (Vector(p) - Vector((0, 1.565, -.012))).normalized() * .02 + Vector((0, -.035, 0)))) for p in nk2]
for rr0, rr1 in ((r0, r1), (r1, r2)):
    for i in range(40):
        j = (i + 1) % 40
        if i in (0, 39) and rr0 is r1:
            continue          # 前面領口開叉
        col_bm.faces.new((rr0[i], rr0[j], rr1[j], rr1[i]))
collar = finish(col_bm, 'collar', 'shirt', 0)
solid(collar, .004)
B_(collar, 'chest', 'neck')
for sx, t in ((1, 'L'), (-1, 'R')):
    wr = Vector((sx * .302, .93, .005))
    B_(lathe('cu', 'shirt', 0, [(.047, -.03), (.051, -.022), (.052, .012), (.048, .02)], tuple(wr), 20, cap_top=False, cap_bot=False), 'fore' + t, 'hand' + t)
    B_(on_surface('sp', 'shirt', 0, (sx * .2, 1.33, 0), (sx, 0, .15), (.07, .08, .012), .004, .006), 'up' + t)
    B_(on_surface('spf', 'shirt', 0, (sx * .2, 1.37, 0), (sx, 0, .15), (.074, .02, .016), .004, .004), 'up' + t)
    if sx > 0:
        B_(on_surface('fl', 'fixed', 0x1b2a3a, (sx * .2, 1.335, 0), (sx, 0, .15), (.05, .035, .004), .012, .002, var=0), 'up' + t)
        B_(on_surface('fl2', 'fixed', 0xf4b400, (sx * .2, 1.335, 0), (sx, 0, .15), (.05, .008, .005), .012, .001, var=0), 'up' + t)

# ── 腰帶與工具袋 ──
B_(band('belt', 'fixed', BELT, .985, 1.03, .006, n=64, th=.006), 'hips')
B_(on_surface('bk', 'fixed', 0xb3a98c, (0, 1.007, 0), (0, 0, 1), (.052, .038, .01), .006, .004), 'hips')
B_(on_surface('bk2', 'fixed', 0x4a4a48, (0, 1.007, 0), (0, 0, 1), (.03, .018, .004), .016, .002), 'hips')
for a in (-1.2, -.5, .5, 1.2, 2.3, -2.3, math.pi):
    B_(on_surface('lp', 'pants', 0, (0, 1.007, 0), (math.sin(a), 0, math.cos(a)), (.016, .054, .006), .01, .003), 'hips')
# 右腰：皮革工具袋（有翻蓋、插著螺絲起子）；左腰：鐵鎚掛環與捲尺
p, n = ray((0, .96, 0), (-1, 0, .1))
pc = p + n * .035
B_(box('pp', 'fixed', LEATHER, tuple(pc), (.05, .13, .13), .016, smooth=True), 'hips', 'thighR')
B_(box('pf', 'fixed', 0x6a4c2a, tuple(pc + Vector((-.003, .05, 0))), (.056, .035, .136), .012), 'hips')
B_(box('ps', 'fixed', 0x4f371e, tuple(pc + Vector((0, -.02, -.07))), (.052, .09, .02), .006), 'hips')
for i, c in enumerate((0xc03a2b, 0xf2c230, 0x3e6b8e)):
    B_(cyl('sd', 'fixed', c, tuple(pc + Vector((0, .06, -.035 + i * .025))), tuple(pc + Vector((0, .11, -.035 + i * .025))), .007, 8), 'hips')
p, n = ray((0, .985, 0), (1, 0, .3))
hc = p + n * .02
B_(box('hh', 'fixed', STEEL, tuple(hc), (.03, .026, .05), .006), 'hips')
B_(tube('hm', 'fixed', 0x9a6a3a, [tuple(hc + Vector((0, .01, 0))), tuple(hc + Vector((.004, -.22, .012)))], .012, 8), 'hips', 'thighL')
B_(box('hmh', 'fixed', 0x5b5f63, tuple(hc + Vector((0, .03, 0))), (.03, .03, .1), .008), 'hips')
p, n = ray((0, .97, 0), (1, 0, -.7))
B_(box('tm', 'fixed', 0xf2c230, tuple(p + n * .025), (.04, .075, .075), .016, smooth=True), 'hips')
B_(box('tmc', 'fixed', 0x222222, tuple(p + n * .046), (.004, .03, .03), .002), 'hips')

# ── 工作褲：大腿外側的貨物口袋、後口袋、護膝 ──
for sx, t in ((1, 'L'), (-1, 'R')):
    th, sh = 'thigh' + t, 'shin' + t
    ax = (sx * .1, 0, 0)
    B_(on_surface('cp', 'pants', 0, (sx * .1, .66, 0), (sx, 0, .1), (.105, .13, .02), .002, .008), th)
    B_(on_surface('cpf', 'pants', 0, (sx * .1, .725, 0), (sx, 0, .1), (.11, .032, .024), .004, .006), th)
    B_(on_surface('cpb', 'fixed', 0x3a3a38, (sx * .1, .72, 0), (sx, 0, .1), (.018, .012, .005), .03, .002), th)
    B_(on_surface('bpk', 'pants', 0, (sx * .08, .9, 0), (sx * .2, 0, -1), (.1, .11, .012), .003, .005), 'hips', th)
    B_(on_surface('bpf', 'pants', 0, (sx * .08, .95, 0), (sx * .2, 0, -1), (.104, .025, .016), .004, .004), 'hips')
    # 護膝
    p, n = ray((sx * .103, .5, 0), (0, 0, 1))
    kc = p + n * .018
    B_(box('kp', 'fixed', 0x2f3133, tuple(kc), (.095, .12, .036), .016, smooth=True), sh)
    B_(box('kpi', 'fixed', 0x46484b, tuple(kc + Vector((0, 0, .02))), (.055, .07, .006), .004), sh)
    B_(band('ks', 'fixed', 0x26282a, .455, .475, .004, cx=sx * .103, zc=.004, n=32, th=.004), sh)
    B_(band('ks2', 'fixed', 0x26282a, .535, .555, .004, cx=sx * .103, zc=.004, n=32, th=.004), th)
    # 褲管下緣（蓋在靴筒外面）
    B_(band('hem', 'pants', 0, .16, .2, .004, cx=sx * .105, zc=-.004, n=32, th=.006), sh)

# ── 背包（小型水袋包）與肩帶、胸扣 ──
p, n = ray((0, 1.26, 0), (0, 0, -1))
bpc = p + Vector((0, 0, -.072))
B_(box('bp', 'fixed', 0x4b5240, tuple(bpc), (.25, .3, .085), .035, seg=3, smooth=True), 'chest', 'torso')
B_(box('bpt', 'fixed', 0x3f4536, tuple(bpc + Vector((0, .135, -.004))), (.255, .05, .09), .02, smooth=True), 'chest')
B_(box('bpq', 'fixed', 0x3f4536, tuple(bpc + Vector((0, -.06, -.045))), (.17, .11, .025), .01, smooth=True), 'chest', 'torso')
B_(box('bpz', 'fixed', 0x222222, tuple(bpc + Vector((0, -.012, -.058))), (.15, .005, .004), .001), 'chest')
B_(box('bpz2', 'fixed', 0x222222, tuple(bpc + Vector((0, .09, -.044))), (.2, .005, .004), .001), 'chest')
for i in range(4):
    B_(box('mol', 'fixed', 0x2f3328, tuple(bpc + Vector((0, .06 - i * .03, -.044))), (.2, .012, .004), .002), 'chest')
for sx in (1, -1):
    B_(box('bsp', 'fixed', 0x3f4536, tuple(bpc + Vector((sx * .125, 0, 0))), (.025, .22, .07), .01, smooth=True), 'chest')
    pts = [tuple(bpc + Vector((sx * .085, .13, .02)))]
    for ph in (62, 68, 66, 55, 40, 25):
        pts.append(sph_hit(sx * D(152 - (ph - 25) * 0 if ph < 60 else 150), D(ph), .026) if False else None)
    pts = [tuple(bpc + Vector((sx * .085, .13, .03))), sph_hit(sx * D(150), D(64), .024), sph_hit(sx * D(90), D(68), .024),
           sph_hit(sx * D(40), D(64), .024), sph_hit(sx * D(26), D(45), .022), sph_hit(sx * D(24), D(22), .022), sph_hit(sx * D(24), D(4), .02)]
    B_(tube('bs', 'fixed', 0x2f3328, pts, .017, 6, flat=.28), 'chest', 'clav' + ('L' if sx > 0 else 'R'))
    B_(box('bsb', 'fixed', 0x1f1f1f, sph_hit(sx * D(24), D(15), .026), (.03, .026, .012), .004), 'chest')
cs0, cs1 = Vector(sph_hit(D(24), D(30), .026)), Vector(sph_hit(-D(24), D(30), .026))
B_(box('cs', 'fixed', 0x2f3328, tuple((cs0 + cs1) / 2), ((cs0 - cs1).length, .014, .008), .003), 'chest')
B_(box('cb', 'fixed', 0x1f1f1f, tuple((cs0 + cs1) / 2 + Vector((0, 0, .004))), (.03, .022, .01), .003), 'chest')

# ───────── 頭：變形的橢球雕出臉（眼窩、眉骨、鼻、唇、下巴、顴骨、下顎），眼睛、眼皮、眉毛、耳朵 ─────────
HC = Vector((0, 1.7, .01))
hb = bm_ell((.085, .112, .103), 64, 48)
def face_disp(x, y, z):
    fz = ss(.02, .075, z)
    dz = 0.0
    for sx in (1, -1):
        dz -= .0065 * g2(x - sx * .031, y - .007, .016, .011)         # 眼窩
        dz += .008 * g2(x - sx * .029, y - .03, .024, .009)           # 眉骨
        dz += .005 * g2(x - sx * .05, y + .022, .018, .016)           # 顴骨
        dz += .0045 * g2(x - sx * .0135, y + .041, .0085, .0065)      # 鼻翼
        dz -= .003 * g2(x - sx * .026, y + .068, .006, .008)          # 嘴角
        dz -= .004 * g2(x - sx * .045, y + .045, .012, .02)           # 法令紋下的臉頰凹
    nb = .017 * ss(.022, -.036, y) * (1 - ss(-.034, -.047, y))
    dz += nb * math.exp(-(x / (.0125 + ss(.005, -.04, y) * .007)) ** 2)   # 鼻樑到鼻頭（寬一點、不要太挺）
    dz += .0045 * g2(x, y + .035, .012, .011)                        # 圓圓的鼻頭
    dz -= .0015 * g2(x, y + .051, .0035, .005)                       # 人中
    dz += .0045 * g2(x, y + .057, .021, .0055)                       # 上唇
    dz += .0055 * g2(x, y + .071, .019, .0065)                       # 下唇
    dz -= .003 * g2(x, y + .0645, .024, .0022)                       # 嘴縫
    dz -= .0025 * g2(x, y + .081, .016, .004)                        # 唇下凹
    dz += .007 * g2(x, y + .094, .026, .014)                         # 下巴
    return dz * fz
for v in hb.verts:
    x, y, z = v.co
    jaw = ss(-.02, -.104, y)
    x *= 1 - jaw * .24
    top = ss(.01, .1, y)
    x *= 1 + top * .1
    z *= 1 + top * .05
    if z < 0:
        z *= (1 - ss(-.02, -.1, y) * .22) * (1 + ss(-.01, .06, y) * .07)
    else:
        x *= 1 - ss(.035, .1, z) * .16
        z *= 1 - ss(.03, .11, y) * .1
        z *= 1 + jaw * .02
    for sx in (1, -1):
        w = g2(x - sx * .066, y + .06, .024, .026) * (1 if z < .05 else 0)
        x += sx * .01 * w                                           # 下顎角
    z += face_disp(x, y, z)
    v.co = Vector((x, y, z))
head = finish(hb, 'head', 'skin', 0, tuple(HC), var=0)
def skin_tone(p, n):
    q = p - HC
    x, y, z = q
    fz = ss(.02, .07, z)
    r, g, b = 1.0, 1.0, 1.0
    lip = g2(x, y + .064, .021, .0105) * fz
    r, g, b = r * (1 - .14 * lip), g * (1 - .3 * lip), b * (1 - .28 * lip)
    blush = sum(g2(x - sx * .05, y + .012, .02, .018) for sx in (1, -1)) * fz
    g *= 1 - .06 * blush; b *= 1 - .07 * blush
    stub = ss(-.035, -.07, y) * (1 - lip) * ss(-.03, .03, z) + g2(x, y + .05, .02, .006) * fz * .8
    k = 1 - .13 * min(1, stub)
    r, g, b = r * k, g * k, b * (k + .02 * stub)
    sock = sum(g2(x - sx * .031, y - .002, .015, .012) for sx in (1, -1)) * fz
    r, g, b = r * (1 - .16 * sock), g * (1 - .2 * sock), b * (1 - .16 * sock)
    nl = sum(g2(x - sx * .03, y + .05, .006, .018) for sx in (1, -1)) * fz
    r, g, b = r * (1 - .1 * nl), g * (1 - .12 * nl), b * (1 - .1 * nl)
    nos = sum(g2(x - sx * .009, y + .046, .004, .0028) for sx in (1, -1)) * (1 if n.y < -.2 else .3)
    r, g, b = r * (1 - .6 * nos), g * (1 - .65 * nos), b * (1 - .65 * nos)
    return (r, g, b)
recolor(head, skin_tone)
B_(head, 'head', 'neck', fn=lambda p: {'head': 1.0} if p.y > 1.64 else {'head': ss(1.59, 1.64, p.y) + .01, 'neck': 1 - ss(1.59, 1.64, p.y) + .01})

hbv = BVHTree.FromObject(head, bpy.context.evaluated_depsgraph_get())
def head_z(x, y):
    loc, nor, i, d = hbv.ray_cast(V(x, y, .5), V(0, 0, -1))
    return T(loc).z if loc else HC.z + .08

# 眼睛：極點朝前的球，一圈一圈上色成眼白、虹膜、瞳孔；上下眼皮是略大的球殼
ER = .0136
for sx in (1, -1):
    ex, ey = sx * .032, HC.y + .006
    ez = head_z(ex, ey) + .0015 - ER
    ec = Vector((ex, ey, ez))
    eb = bm_ell((ER, ER, ER), 18, 20)
    eye = finish(eb, 'eye', 'fixed', 0xe9e4dc, tuple(ec), rot=(math.pi / 2, 0, 0), var=0)
    def eye_col(p, n, ec=ec):
        d = (p - ec).normalized()
        a = math.degrees(math.acos(max(-1, min(1, d.z))))
        if a < 8.5:
            return hexrgb(0x0c0a09)
        if a < 22:
            k = .8 + .25 * noise.noise(d * 40)
            c = hexrgb(0x5a3d26)
            return tuple(x * k * (.7 if a > 19.5 else 1) for x in c)
        return tuple(x * (.85 if a > 45 else 1) for x in hexrgb(0xddd5ca))
    recolor(eye, eye_col)
    B_(eye, 'head')
    for (keep, col) in ((lambda c: c.y > .0062 and c.z > -.004, None), (lambda c: c.y < -.0088 and c.z > -.002, None)):
        lb = bm_ell((ER + .0016, ER + .0016, ER + .0016), 28, 18)
        bmesh.ops.delete(lb, geom=[f for f in lb.faces if not keep(f.calc_center_median())], context='FACES')
        lid = finish(lb, 'lid', 'skin', 0, tuple(ec), var=0)
        recolor(lid, lambda p, n, ec=ec: (.35, .28, .26) if abs(p.y - ec.y) < .0078 else (.97, .93, .92))
        B_(lid, 'head')
    # 眉毛（頭髮色）
    pts = []
    for i in range(7):
        t = i / 6
        x = sx * (.013 + t * .04)
        y = HC.y + .027 + math.sin(t * math.pi) * .006 - t * .004
        pts.append((x, y, head_z(x, y) + .0008))
    B_(tube('br', 'hair', 0, pts, [.0024, .003, .0031, .003, .0027, .0023, .0016], 8, flat=2.4), 'head')
    # 耳朵：扁橢球，外緣捲起、內側凹進去
    ea = add(tuple(HC), (sx * .074, -.006, -.012))
    ebm = bm_ell((.011, .031, .02), 20, 16)
    for v in ebm.verts:
        x, y, z = v.co
        rr = math.sqrt((y / .031) ** 2 + (z / .02) ** 2)
        if x > 0:
            v.co.x = x * (.35 + .9 * ss(.55, .95, rr))
        if y < -.012:
            v.co.z *= 1 - ss(-.012, -.031, y) * .35
    ear = finish(ebm, 'ear', 'skin', 0, ea, rot=(0, sx * .3, 0) if sx > 0 else (0, math.pi - .3, 0), var=0)
    recolor(ear, lambda p, n, ea=Vector(ea), sx=sx: (.85, .78, .78) if (p - ea).x * sx < .002 and math.sqrt(((p - ea).y / .031) ** 2 + ((p - ea).z / .02) ** 2) < .6 else (1, .96, .95))
    B_(ear, 'head')

# ── 手套：掌心、四指（放鬆微彎，握槍時也好看）、拇指、護指板 ──
def hand_bm(sx):
    W = Vector((sx * .305, .905, .006))
    out = []
    def sec(yo, w, t, dz=0.0, n=16):
        return [tuple(W + Vector((sx * (math.cos(a) * t / 2) - sx * .004, yo, math.sin(a) * w / 2 + dz))) for a in [i / n * TAU for i in range(n)]]
    out.append(loft('palm', 'glove', 0, [sec(.012, .058, .04), sec(-.02, .07, .038), sec(-.055, .086, .034), sec(-.085, .088, .03), sec(-.098, .082, .026)], var=.03))
    for i, (zo, L) in enumerate(((.03, .074), (.01, .08), (-.01, .076), (-.029, .062))):
        p = W + Vector((-sx * .004, -.094, zo))
        d = Vector((0, -1, 0))
        pts = [tuple(p)]
        A = 0.0
        for (f, c) in ((.45, .2), (.3, .38), (.25, .32)):
            A += c
            d = Vector((-sx * math.sin(A), -math.cos(A), (zo * .6) * math.sin(A)))
            p = p + d.normalized() * L * f
            pts.append(tuple(p))
        out.append(limb('fg', 'glove', 0, pts, [.0098, .0093, .0086, .0078], 10, step=.008))
        out.append(ell('kn', 'glove', 0, tuple(W + Vector((sx * .002, -.093, zo))), (.011, .01, .01), 10, 8))
    tp = [W + Vector((-sx * .012, -.032, .028))]
    for (dx, dy, dz, L) in ((-.3, -.85, .38, .036), (-.45, -.85, .16, .03), (-.55, -.8, .05, .024)):
        tp.append(tp[-1] + Vector((sx * dx, dy, dz)).normalized() * L)
    out.append(limb('th', 'glove', 0, [tuple(p) for p in tp], [.0125, .0112, .0102, .009], 10, step=.008))
    out.append(box('kg', 'fixed', 0x3a3c3e, tuple(W + Vector((sx * .016, -.08, 0))), (.008, .022, .064), .004, smooth=True))
    out.append(lathe('gc', 'glove', 0, [(.043, .0), (.049, .006), (.05, .03), (.046, .036)], tuple(W + Vector((0, -.006, 0))), 20))
    out.append(box('gs', 'fixed', 0x2e3032, tuple(W + Vector((sx * .036, .016, 0))), (.008, .016, .03), .003))
    return out
for sx, t in ((1, 'L'), (-1, 'R')):
    for o in hand_bm(sx):
        B_(o, 'hand' + t)

# ── 工作靴：楦頭、鞋舌、鞋帶、鞋底紋路；靴筒跟小腿、腳掌跟腳骨 ──
def boot_w(t):
    def f(p):
        k = ss(.1, .16, p.y) * ss(-.02, -.06, p.z - .0)
        k = max(k, ss(.12, .17, p.y))
        return {'shin' + t: k + .001, 'foot' + t: 1 - k + .001}
    return f
for sx, t in ((1, 'L'), (-1, 'R')):
    A = Vector((sx * .105, 0, -.012))
    def fs(z, yc, h, w, lift=0.0):
        return rrect(0, 0, w, h, min(w, h) * .45, 0)
    secs = []
    for (z, y0, y1, w) in ((-.085, .02, .13, .085), (-.06, .02, .14, .098), (-.02, .02, .145, .104), (.03, .02, .12, .108), (.08, .02, .095, .108), (.13, .02, .075, .104), (.17, .02, .06, .094), (.2, .025, .048, .075), (.215, .03, .04, .05)):
        h = y1 - y0
        secs.append([(A.x + px, y0 + h / 2 + py, A.z + z) for (px, py, _) in rrect(0, 0, w, h, min(w, h) * .45, 0)])
    bt = loft('boot', 'fixed', BOOT, secs, var=.06)
    recolor(bt, lambda p, n: tuple(x * (1.25 if p.z - A.z > .15 and n.z > .3 else 1) for x in hexrgb(BOOT)))
    B_(bt, fn=boot_w(t))
    B_(lathe('bs', 'fixed', BOOT, [(.058, .09), (.062, .12), (.062, .2), (.066, .215), (.064, .225)], tuple(A + Vector((0, 0, -.008))), 20, cap_bot=False), fn=boot_w(t))
    B_(lathe('bpad', 'fixed', 0x3a2818, [(.066, .205), (.07, .21), (.07, .228), (.066, .232)], tuple(A + Vector((0, 0, -.008))), 20, cap_top=False, cap_bot=False), fn=boot_w(t))
    B_(box('so', 'fixed', SOLE, tuple(A + Vector((0, .012, .06))), (.114, .026, .305), .01), fn=boot_w(t))
    B_(box('he', 'fixed', SOLE, tuple(A + Vector((0, .018, -.05))), (.1, .036, .08), .01), fn=boot_w(t))
    B_(box('ws', 'fixed', 0x8a6a3a, tuple(A + Vector((0, .028, .06))), (.117, .006, .3), .003), fn=boot_w(t))
    for i in range(7):
        B_(box('tr', 'fixed', 0x151515, tuple(A + Vector((0, -.001, -.07 + i * .045))), (.1, .005, .018), .002), fn=boot_w(t))
    # 鞋舌與鞋帶
    B_(box('tg', 'fixed', 0x4a3120, tuple(A + Vector((0, .135, .045))), (.05, .1, .02), .008, rot=(-.75, 0, 0), smooth=True), fn=boot_w(t))
    for i in range(5):
        y, z = .19 - i * .022, .035 + i * .016
        B_(box('la', 'fixed', 0xd8c9a0, tuple(A + Vector((0, y, z + .012))), (.05, .005, .007), .002, rot=(-.7, 0, (.35 if i % 2 else -.35))), fn=boot_w(t))
        for s2 in (1, -1):
            B_(cyl('ey', 'fixed', 0xb0a080, tuple(A + Vector((s2 * .027, y, z + .004))), tuple(A + Vector((s2 * .027, y, z + .012))), .004, 6), fn=boot_w(t))
    B_(box('pt', 'fixed', 0x3a2818, tuple(A + Vector((0, .2, -.07))), (.022, .04, .006), .002), 'shin' + t)

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
print('body tris', tri_count([BODYOB]))

def pose(P):
    for pb in RIG.pose.bones:
        pb.rotation_mode = 'ZYX'
        pb.rotation_euler = P.get(pb.name, (0, 0, 0))
    bpy.context.view_layer.update()

# 預覽用的姿勢（Euler 以 three 的軸寫：x 前後、y 扭轉、z 側抬；Blender 骨頭的 local 軸與 three 相同，因為骨頭朝 +y、不滾轉）
POSES = {
    'walk': {'thighL': (-.6, 0, .03), 'shinL': (.3, 0, 0), 'footL': (.3, 0, 0), 'thighR': (.45, 0, -.03), 'shinR': (.7, 0, 0), 'footR': (-.3, 0, 0),
             'upL': (.45, 0, .1), 'foreL': (-.3, 0, 0), 'upR': (-.5, 0, -.1), 'foreR': (-.6, 0, 0), 'torso': (.05, .15, 0), 'chest': (0, .1, 0)},
    'chute': {'upL': (-.1, 0, 2.75), 'foreL': (0, 0, .35), 'upR': (-.1, 0, -2.75), 'foreR': (0, 0, -.35), 'clavL': (0, 0, .25), 'clavR': (0, 0, -.25), 'thighL': (-.35, 0, .06), 'shinL': (.45, 0, 0), 'thighR': (-.2, 0, -.06), 'shinR': (.35, 0, 0)},
    'prone': {'upL': (-2.8, 0, -.3), 'foreL': (-.4, 0, 0), 'upR': (-2.8, 0, .3), 'foreR': (-.4, 0, 0), 'thighL': (-.15, .5, .5), 'shinL': (1.2, 0, 0), 'chest': (-.3, 0, 0), 'neck': (-.4, 0, 0), 'head': (-.4, 0, 0)},
    'crouch': {'thighL': (-1.25, 0, .05), 'shinL': (1.8, 0, 0), 'footL': (-.55, 0, 0), 'thighR': (-.95, 0, -.05), 'shinR': (1.55, 0, 0), 'footR': (-.6, 0, 0), 'upR': (-1.3, 0, .1), 'foreR': (-.5, 0, 0), 'upL': (-1.4, 0, -.5), 'foreL': (-.4, 0, 0)},
}
if STAGE == 'body':
    prev = PREVIEW or '/tmp'
    os.makedirs(prev, exist_ok=True)
    tint_roles([BODYOB])
    preview(os.path.join(prev, 'w_front.png'), (0, .95, 0), 4.6, 20, 6)
    preview(os.path.join(prev, 'w_side.png'), (0, .95, 0), 4.6, 90, 6)
    preview(os.path.join(prev, 'w_back.png'), (0, .95, 0), 4.6, 200, 6)
    preview(os.path.join(prev, 'w_head.png'), (0, 1.68, 0), .75, 25, 3)
    preview(os.path.join(prev, 'w_headf.png'), (0, 1.68, 0), .6, 0, 0)
    preview(os.path.join(prev, 'w_hand.png'), (.3, .85, .0), .55, 40, 5)
    preview(os.path.join(prev, 'w_boot.png'), (.1, .12, .05), .9, 40, 20)
    for k, P in POSES.items():
        pose(P)
        preview(os.path.join(prev, 'p_' + k + '.png'), (0, .95, 0), 4.6, 35, 8)
        preview(os.path.join(prev, 'p_' + k + '_s.png'), (0, .95, 0), 4.6, 100, 8)
    raise SystemExit

# ───────── 頭髮與鬍子（剛體，掛在 head 骨上；原點 = head 關節），網頁每個人挑一種 ─────────
VARIANTS = []
HEADJ = BP['head']
def hairline(a, style):
    """a：從正前方繞到後面的角度（度），回傳髮際線高度（相對頭中心）"""
    keys = [(0, .06), (30, .052), (55, .034), (72, .016), (78, -.028), (86, -.03), (90, .004), (104, .03), (118, .012), (135, -.035), (160, -.062), (180, -.07)]
    if style == 1:
        keys = [(0, .052), (30, .046), (55, .03), (72, .012), (78, -.034), (86, -.036), (90, .0), (104, .028), (118, .0), (135, -.06), (160, -.09), (180, -.1)]
    if style == 2:
        keys = [(0, .07), (22, .07), (38, .045), (55, .042), (72, .02), (78, -.01), (86, -.012), (90, .008), (104, .032), (118, .015), (135, -.03), (160, -.055), (180, -.06)]
    for (a0, y0), (a1, y1) in zip(keys, keys[1:]):
        if a <= a1:
            t = (a - a0) / (a1 - a0)
            t = t * t * (3 - 2 * t)
            return y0 + (y1 - y0) * t
    return keys[-1][1]

def head_shell(e, keep, seg=64, rings=40, amp=.0, freq=60):
    """從頭中心往外打射線，貼著頭皮外推 e 做一層殼；keep(相對頭中心的點) 決定保留哪些面"""
    bm = bm_ell((1, 1, 1), seg, rings)
    for v in bm.verts:
        d = Vector(v.co).normalized()
        loc, nor, i, dist = hbv.ray_cast(V(*(HC + d * .3)), V(*(-d)))
        p = T(loc) if loc else HC + d * .1
        n = T(nor).normalized() if loc else d
        q = p - HC
        clump = noise.noise(Vector((q.x * freq, q.y * freq * .35, q.z * freq))) if amp else 0
        v.co = p + n * (e + amp * clump)
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if not keep(f.calc_center_median() - HC)], context='FACES')
    loose = [v for v in bm.verts if not v.link_faces]
    bmesh.ops.delete(bm, geom=loose, context='VERTS')
    # 髮際線的鋸齒：沿邊界平滑幾次再貼回頭皮
    for _ in range(5):
        newp = {}
        for v in bm.verts:
            be = [ed for ed in v.link_edges if ed.is_boundary]
            if len(be) == 2:
                a, b = (ed.other_vert(v).co for ed in be)
                newp[v] = v.co * .5 + (a + b) * .25
        for v, q in newp.items():
            loc, nor, i, dist = hbv.find_nearest(V(*q))
            v.co = T(loc) + T(nor).normalized() * e
    return bm

def strand_col(p, n):
    q = p - HC
    k = .8 + .3 * noise.noise(Vector((q.x * 220, q.y * 18, q.z * 220))) + .1 * noise.noise(q * 500)
    return (max(.35, min(1, k)),) * 3

def variant(name, objs):
    o = join(orient_all(objs), name)
    for p in o.data.polygons:
        p.use_smooth = True
    origin_to(o, tuple(HEADJ))
    OUT.append(o); VARIANTS.append(o)
    return o

for style, (e, amp) in enumerate(((.006, .003), (.012, .006), (.003, .001))):
    bm = head_shell(e, lambda q, st=style: q.y > hairline(math.degrees(math.atan2(abs(q.x), q.z)), st) and not (abs(q.x) > .06 and -.03 < q.y < .028 and -.045 < q.z < .02 and math.degrees(math.atan2(abs(q.x), q.z)) > 90), amp=amp)
    h = finish(bm, 'hair', 'hair', 0, var=0)
    solid(h, .003)
    recolor(h, strand_col)
    variant('HAIR_%d' % style, [h])
# 鬍子：1 短鬍渣滿臉、2 八字鬍、3 山羊鬍 + 八字鬍
def mouth_hole(q):
    return g2(q.x, q.y + .064, .03, .017) > .35
def beard_keep(q):
    a = math.degrees(math.atan2(abs(q.x), q.z))
    return q.z > -.04 and a < 100 and (q.y < -.05 - max(0, a - 50) * .0005) and q.y > -.125 and not mouth_hole(q)
def stache(e):
    pts = []
    for i in range(9):
        t = i / 8 * 2 - 1
        x = t * .026
        y = HC.y - .054 - abs(t) ** 1.6 * .014
        pts.append((x, y, head_z(x, y) + e))
    m = tube('ms', 'hair', 0, pts, [.0025, .0045, .0058, .0062, .0055, .0062, .0058, .0045, .0025], 8, flat=.6)
    recolor(m, strand_col)
    return m
bm = head_shell(.004, beard_keep, amp=.0015, freq=90)
b1 = finish(bm, 'beard', 'hair', 0, var=0)
solid(b1, .002)
recolor(b1, strand_col)
variant('BEARD_1', [b1, stache(.002)])
variant('BEARD_2', [stache(.002)])
bm = head_shell(.005, lambda q: abs(q.x) < .026 - max(0, q.y + .09) * .2 and -.122 < q.y < -.076 and q.z > 0, amp=.002, freq=90)
b3 = finish(bm, 'goat', 'hair', 0, var=0)
solid(b3, .002)
recolor(b3, strand_col)
variant('BEARD_3', [b3, stache(.002)])

# ───────── 安全帽（原點 = 帽子掛點，head 骨上方 0.18），各自放遠一點避免 AO 互相遮蔽 ─────────
def dome_pts(prof, xo, sz):
    pts = []
    for (r, y) in prof:
        if r <= abs(xo):
            continue
        pts.append((xo, y, math.sqrt(r * r - xo * xo) * sz))
    back = [(p[0], p[1], -p[2]) for p in reversed(pts)]
    return pts + back[1:]

def bm_brim(ext, y, th, seg=48, a0=-math.pi, a1=math.pi, rx=.108, rz=.122):
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

SHELL = [(.108, -.035), (.111, 0), (.107, .03), (.094, .056), (.07, .074), (.04, .084), (.001, .088)]
HAT_Y = 1.78
def hat(lv, ox):
    P = (ox, HAT_Y, 0)
    col = [0x3b3a45, 0xeeeae0, 0xf08a1c, 0x26282b][lv]
    ob = []
    if lv == 0:
        prof = [(.087, -.05), (.092, -.034), (.092, -.016), (.089, -.008), (.088, .02), (.08, .05), (.06, .075), (.032, .088), (.001, .092)]
        ob.append(lathe('k', 'fixed', col, prof, P, 48, 1, 1.16,
                        rfn=lambda a, y: 1 + (.035 * math.sin(a * 44) if y < -.006 else .012 * math.sin(a * 60)), var=.08))
        ob.append(ell('kp', 'fixed', 0x55546a, add(P, (0, .096, 0)), (.02, .018, .02), 16, 12))
        ob.append(box('kl', 'fixed', 0xf4b400, add(P, (0, -.026, .106)), (.04, .016, .006), .002, rot=(-.08, 0, 0), var=0))
    else:
        ob.append(lathe('s', 'fixed', col, SHELL, P, 40, 1, 1.13, cap_bot=False, var=.015))
        ob.append(lathe('si', 'fixed', 0x2a2a2a, [(.001, -.03), (.104, -.03)], P, 40, 1, 1.12, cap_top=False, cap_bot=False, var=0))
        # 內襯頭箍
        ob.append(lathe('hb', 'fixed', 0x1f1f1f, [(.088, -.06), (.09, -.05), (.09, -.032), (.088, -.028)], P, 32, 1, 1.12, cap_top=False, cap_bot=False, var=0))
        if lv == 1:
            ob.append(finish(bm_brim(lambda a: .058 * max(0, math.cos(a)) ** 1.5 + .006, -.03, .007), 'b', 'fixed', col, P, var=.015))
        else:
            ob.append(finish(bm_brim(lambda a: .032 + .02 * abs(math.cos(a)), -.03, .007), 'b', 'fixed', col, P, var=.015))
        for xo in (-.034, 0, .034):
            pts = [(p[0], p[1] + .004, p[2] * 1.02) for p in dome_pts(SHELL[1:], xo, 1.13)]
            ob.append(tube('r', 'fixed', col, [add(P, p) for p in pts], .0065 if xo == 0 else .0045, 6))
        for sx in (1, -1):
            ob.append(box('c', 'fixed', 0x3a3a3a, add(P, (sx * .109, -.02, 0)), (.008, .02, .03), .003))
        ob.append(box('st', 'fixed', 0xdadada, add(P, (0, .045, -.118)), (.05, .03, .004), .002, rot=(.5, 0, 0), var=0))
        if lv == 3:
            # 面罩：跟著頭形彎的一片弧面，下緣中間低、兩側往上收成圓弧（停在鼻尖上面）
            vb = bm_lathe([(.133, -.1), (.134, -.08), (.131, -.055), (.125, -.032), (.117, -.02)], 36, 1, 1.07, cap_top=False, cap_bot=False, a0=-1.05, a1=1.05)
            for v in vb.verts:
                t = (math.atan2(v.co.x, v.co.z) / 1.05) ** 2
                if v.co.y < -.02:
                    v.co.y = -.02 + (v.co.y + .02) * (1 - .62 * t)
            vo = finish(vb, 'v', 'fixed', 0x3f5a6c, P, var=0)
            recolor(vo, lambda p, n: tuple(x * (1.25 - .55 * min(1, max(0, (P[1] - .02 - p.y) / .08))) for x in hexrgb(0x3f5a6c)))
            ob.append(vo)
            ob.append(tube('vr', 'fixed', 0x1b1b1b, [add(P, (math.sin(a) * .128, -.022, math.cos(a) * .128 * 1.07)) for a in [-1.05 + 2.1 * i / 20 for i in range(21)]], .004, 6))
            for sx in (1, -1):
                ob.append(finish(bm_ell((.018, .033, .03), 20, 14), 'e', 'fixed', 0xa8342a, add(P, (sx * .111, -.088, -.005)), None, True, .04))
                ob.append(cyl('ec', 'fixed', 0x1b1b1b, add(P, (sx * .1, -.088, -.005)), add(P, (sx * .106, -.088, -.005)), .026, 20))
                ob.append(tube('eb', 'fixed', 0x1b1b1b, [add(P, (sx * .112, -.056, -.005)), add(P, (sx * .111, -.02, -.005))], .007, 6))
            ob.append(box('lamp', 'fixed', 0xe8e4d4, add(P, (0, .025, .128)), (.03, .02, .012), .004, rot=(-.5, 0, 0)))
        if lv == 2:
            ob.append(box('logo', 'fixed', 0x1c1c1c, add(P, (0, .03, .125)), (.05, .018, .004), .002, rot=(-.4, 0, 0)))
            for sx in (1, -1):
                ob.append(box('rf', 'fixed', 0xdde2e6, add(P, (sx * .085, .0, -.075)), (.004, .015, .05), .001, rot=(0, sx * .8, 0), var=0))
    o = join(orient_all(ob), 'HAT_%d' % lv)
    smooth_by_angle(o, 50)
    origin_to(o, P)
    OUT.append(o); BAKE.append(o)

for lv in range(4):
    hat(lv, 3 + lv * 1.2)

# ───────── 防護背心（原點 = 1.02 的軀幹掛點；網頁掛在 chest 骨下 -0.23）：板子貼著身體曲面 ─────────
def armor(lv, ox):
    c = [0, 0x6d7355, 0x3d4a5c, 0x26292c][lv]
    d = [0, 0x5a5f46, 0x323d4c, 0x1a1c1e][lv]
    ob = []
    fr = finish(patch('af', 'fixed', c, -D(42), D(42), D(-38), D(46), 16, 14, .03), 'af', 'fixed', c, var=.05)
    solid(fr, .022); ob.append(fr)
    bk = finish(patch('ab', 'fixed', c, D(138), D(222), D(-36), D(52), 16, 14, .029), 'ab', 'fixed', c, var=.05)
    solid(bk, .02); ob.append(bk)
    ob.append(band('cm', 'fixed', d, 1.1, 1.19, .026, n=56, th=.012))
    for sx in (1, -1):
        pts = [sph_hit(sx * D(26), D(44), .04), sph_hit(sx * D(40), D(62), .036), sph_hit(sx * D(90), D(68), .034), sph_hit(sx * D(140), D(62), .036), sph_hit(sx * D(154), D(48), .04)]
        ob.append(tube('s', 'fixed', c, pts, .024, 8, flat=.3))
    for x in (-.075, 0, .075):
        p, n = ray((x, 1.19, 0), (x * 2, 0, 1))
        pc = p + n * .075
        ob.append(box('p', 'fixed', d, tuple(pc), (.068, .1, .04), .012, smooth=True))
        ob.append(box('pf', 'fixed', c, tuple(pc + Vector((0, .05, .002))), (.072, .025, .044), .008))
    for i in range(4):
        p, n = ray((0, 1.33 - i * .03, 0), (0, 0, 1))
        ob.append(box('m', 'fixed', d, tuple(p + n * .056), (.2, .008, .006), .002))
    if lv >= 2:
        p, n = ray((0, 1.25, 0), (1, 0, -.4))
        ob.append(box('r', 'fixed', d, tuple(p + n * .055), (.05, .13, .07), .012))
        ob.append(tube('ra', 'fixed', 0x111111, [tuple(p + n * .06 + Vector((0, .06, 0))), tuple(p + n * .06 + Vector((0, .16, 0)))], .005, 6))
    if lv == 3:
        ob.append(finish(bm_lathe([(.1, .5), (.112, .54), (.104, .58)], 24, 1, .9, cap_top=False, cap_bot=False, a0=-2.3, a1=2.3), 'n', 'fixed', c, (0, 1.0, -.01)))
        p, n = ray((0, 1.36, 0), (0, 0, 1))
        ob.append(box('t', 'fixed', 0xf4b400, tuple(p + n * .056), (.1, .03, .006), .003))
        for sx in (1, -1):
            ob.append(finish(bm_lathe([(.095, -.06), (.1, 0), (.07, .04)], 20, 1, 1, cap_top=False, cap_bot=False, a0=-1.2, a1=1.2), 'sp', 'fixed', c, (sx * .2, 1.42, 0), rot=(0, sx * math.pi / 2, 0)))
    o = join(orient_all(ob), 'ARM_%d' % lv)
    smooth_by_angle(o, 45)
    origin_to(o, (0, 1.02, 0))
    move(o, (ox, 0, 0))
    OUT.append(o); BAKE.append(o)

for lv in (1, 2, 3):
    armor(lv, 9 + lv * 1.2)

# ───────── 槍（原點 = 握把上方，槍口朝 +z）；彈匣另外匯出（M_*，原點 = 卡榫位置），換彈時可以拔出來 ─────────
BLK, BLK2, BLK3, WOOD = 0x3a3d40, 0x474b4f, 0x2a2d31, 0x7a4a26   # 槍身不要全黑：第一人稱時要看得出形狀
FDE = 0x8a7a5c

def grain(ob, base, amt=.18):
    c0 = hexrgb(base)
    recolor(ob, lambda p, n: tuple(max(0, min(1, x * (1 + math.sin(p.z * 90 + noise.noise(p * 14) * 5) * amt * .5 + noise.noise(p * 40) * amt * .4))) for x in c0))

def stipple(ob, base, amt=.22):
    c0 = hexrgb(base)
    recolor(ob, lambda p, n: tuple(max(0, min(1, x * (1 + noise.noise(p * 260) * amt))) for x in c0))

def wear(ob, amt=.35):
    """邊角磨出金屬亮色"""
    me = ob.data
    col = me.color_attributes['Col']
    a = np.zeros(len(me.vertices) * 4, dtype=np.float32)
    col.data.foreach_get('color', a)
    a = a.reshape(-1, 4)
    for i, v in enumerate(me.vertices):
        k = max(0, noise.noise(v.co * 90)) * amt
        a[i, :3] = a[i, :3] * (1 - k) + np.array([.12, .12, .13]) * k
    col.data.foreach_set('color', a.ravel())

def rail(z0, z1, y, w=.028, x=0.0, side=0):
    o = [box('rl', 'fixed', BLK3, (x, y, (z0 + z1) / 2), (w, .012, z1 - z0) if not side else (.012, w, z1 - z0), .002)]
    z = z0 + .01
    while z < z1 - .005:
        if side:
            o.append(box('rt', 'fixed', BLK3, (x + side * .008, y, z), (.006, w + .002, .011), .001))
        else:
            o.append(box('rt', 'fixed', BLK3, (x, y + .008, z), (w + .002, .006, .011), .001))
        z += .024
    return o

GUNS = {}
def gun(name, ox, parts, mag=None, mag_at=None):
    orient_all(parts); orient_all(mag or [])
    o = join(parts, name)
    smooth_by_angle(o, 35)
    origin_to(o, (0, 0, 0))
    move(o, (ox, 1, -4))
    OUT.append(o); BAKE.append(o)
    if mag:
        m = join(mag, 'M_' + name[2:])
        smooth_by_angle(m, 35)
        origin_to(m, mag_at)
        move(m, (ox, 1, -4.6))
        OUT.append(m); BAKE.append(m)
    GUNS[name] = o
    return o

def trig_guard(z0, z1, y=-.045):
    return [tube('tg', 'fixed', BLK3, [(0, y, z0), (0, y - .03, z0 + .015), (0, y - .033, (z0 + z1) / 2), (0, y - .03, z1 - .01), (0, y, z1)], .005, 6),
            box('tr', 'fixed', BLK3, (0, y - .01, (z0 + z1) / 2 - .005), (.006, .025, .006), .002, rot=(.3, 0, 0))]

def grip(c, rotx, col=BLK3, size=(.034, .12, .052)):
    g = box('pg', 'fixed', col, c, size, .012, rot=(-rotx, 0, 0), seg=3, smooth=True)
    stipple(g, col, .35)
    recolor(g, lambda p, n: tuple(x * (.7 if n.z > .5 and math.sin((p.y - c[1]) * 190) > .6 else 1) for x in hexrgb(col)))
    return g

def ring_z(name, color, c, r, w=.004, seg=24):
    pts = [(c[0] + math.sin(a) * r, c[1] + math.cos(a) * r, c[2]) for a in [i / seg * TAU for i in range(seg + 1)]]
    return tube(name, 'fixed', color, pts, w, 6, caps=False)

# M416：上下機匣、M-LOK 護木、全長滑軌、紅點鏡、伸縮托、制退器、QD 背帶環
mag = []
for k in range(9):
    y = -.005 - k * .021
    zc = .0 + .0018 * k * k
    mag.append([(-.013, y, zc - .032), (.013, y, zc - .032), (.013, y, zc + .032), (-.013, y, zc + .032)])
mgb = loft('mg', 'fixed', BLK, [[(x, y + .055 * 0, z + .175) for (x, y, z) in sec] for sec in [[(p[0], p[1] - .055, p[2]) for p in s] for s in mag]], smooth=False)
stipple(mgb, BLK, .12)
M416_MAG = [mgb, box('mfp', 'fixed', BLK3, (0, -.234, .175 + .0018 * 64), (.03, .014, .07), .004)]
for k in range(3):
    M416_MAG.append(box('mrb', 'fixed', BLK2, (.0135, -.1 - k * .04, .175 + .0018 * (2 + k * 2) ** 2), (.002, .03, .05), .001))
    M416_MAG.append(box('mrb', 'fixed', BLK2, (-.0135, -.1 - k * .04, .175 + .0018 * (2 + k * 2) ** 2), (.002, .03, .05), .001))
m416 = [
    box('ur', 'fixed', BLK, (0, .022, .1), (.052, .058, .26), .006),
    box('ep', 'fixed', 0x0e0e0e, (-.0265, .02, .1), (.004, .022, .066), .001),
    box('dc', 'fixed', BLK2, (-.0275, .012, .1), (.003, .01, .07), .001),
    cyl('fa', 'fixed', BLK2, (-.024, .036, .03), (-.034, .036, .018), .008, 10),
    box('chg', 'fixed', BLK2, (0, .052, -.036), (.05, .01, .02), .003),
    box('lr', 'fixed', BLK2, (0, -.028, .07), (.048, .052, .21), .006),
    box('mw', 'fixed', BLK2, (0, -.062, .175), (.044, .05, .076), .006),
    box('mr', 'fixed', 0x3a3d40, (-.026, -.04, .14), (.004, .012, .012), .002),
    box('sel', 'fixed', 0x3a3d40, (.026, -.02, .03), (.004, .01, .022), .002),
    grip((0, -.09, -.012), -.35),
    *trig_guard(.03, .11),
    finish(bm_tube([(0, .016, .205), (0, .016, .52)], .038, 8), 'hg', 'fixed', BLK2, smooth=False),
    *rail(-.045, .52, .057),
    cyl('br', 'fixed', BLK3, (0, .016, .52), (0, .016, .7), .0105, 12),
    cyl('gb', 'fixed', BLK3, (0, .016, .49), (0, .016, .52), .016, 12),
    lathe('mb', 'fixed', BLK3, [(.0145, 0), (.016, .005), (.016, .06), (.0135, .066)], (0, .016, .7), 14, rot=(math.pi / 2, 0, 0)),
    box('fs', 'fixed', BLK3, (0, .074, .5), (.012, .012, .03), .002),
    box('rs', 'fixed', BLK3, (0, .072, -.02), (.02, .01, .03), .002),
    cyl('bt', 'fixed', BLK2, (0, .014, -.05), (0, .014, -.21), .0155, 14),
    loft('st', 'fixed', BLK, [rrect(0, cy, w, h, min(w, h) * .4, z) for (z, cy, w, h) in ((-.12, .008, .036, .048), (-.17, -.004, .04, .07), (-.24, -.018, .044, .1), (-.31, -.026, .046, .118), (-.33, -.026, .046, .12))]),
    box('bpd', 'fixed', 0x111111, (0, -.026, -.34), (.048, .124, .02), .007),
    box('stl', 'fixed', BLK3, (0, -.035, -.16), (.012, .012, .05), .003),
    ring_z('qd', 0x3a3d40, (.03, -.03, -.26), .01, .0025),
    ring_z('qd2', 0x3a3d40, (.04, -.01, .44), .01, .0025),
    box('rdb', 'fixed', BLK3, (0, .072, .12), (.03, .016, .05), .003),
    # 紅點鏡：中空的鏡筒，第一人稱瞄準時可以從中間看出去
    lathe('rdh', 'fixed', BLK3, [(.0175, 0), (.022, 0), (.022, .07), (.0175, .07), (.0175, 0)], (0, .1, .09), 28, rot=(math.pi / 2, 0, 0), cap_top=False, cap_bot=False, var=0),
    lathe('rdf', 'fixed', 0x3d6f82, [(.0172, 0), (.0178, 0), (.0178, .004), (.0172, .004), (.0172, 0)], (0, .1, .157), 28, rot=(math.pi / 2, 0, 0), cap_top=False, cap_bot=False, var=0),
    box('rdk', 'fixed', BLK3, (.026, .1, .12), (.01, .012, .018), .002),
    cyl('rdk2', 'fixed', BLK3, (0, .122, .12), (0, .128, .12), .007, 10),
]
for sgn in (1, -1):
    for i in range(4):
        m416.append(box('ml', 'fixed', 0x101112, (sgn * .036, .012, .25 + i * .065), (.004, .01, .035), .002))
    m416 += rail(.3, .5, .016, .02, x=sgn * .041, side=sgn)
for i in range(4):
    m416.append(box('mlb', 'fixed', 0x101112, (0, -.021, .25 + i * .065), (.01, .004, .035), .002))
for i in range(4):
    m416.append(box('mbs', 'fixed', 0x050505, (0, .03, .72 + i * .012), (.02, .006, .006), .001))
wear(m416[0], .25)
gun('G_m416', 0, m416, M416_MAG, (0, -.055 + 1 * 0, .175))

# UMP45：方正的聚合物機匣、上/側滑軌、覘孔照門、摺疊托
UMP_MAG = [box('mg', 'fixed', BLK, (0, -.13, .2), (.032, .17, .058), .008, rot=(.12, 0, 0)),
           box('mfp', 'fixed', BLK3, (0, -.215, .21), (.036, .014, .064), .004, rot=(.12, 0, 0))]
stipple(UMP_MAG[0], BLK, .1)
ump = [
    box('rc', 'fixed', 0x2e3134, (0, 0, .12), (.056, .1, .34), .014),
    *rail(.0, .28, .057, .024),
    *rail(.16, .28, .0, .02, x=-.034, side=-1),
    cyl('br', 'fixed', BLK3, (0, .02, .29), (0, .02, .44), .012, 12),
    lathe('bn', 'fixed', BLK3, [(.016, 0), (.017, .01), (.017, .03), (.014, .034)], (0, .02, .41), 14, rot=(math.pi / 2, 0, 0)),
    box('fsb', 'fixed', BLK3, (0, .06, .27), (.03, .014, .03), .004),
    box('fs', 'fixed', BLK3, (0, .072, .272), (.004, .022, .006), .001),
    box('fe1', 'fixed', BLK3, (.013, .075, .272), (.004, .026, .012), .001),
    box('fe2', 'fixed', BLK3, (-.013, .075, .272), (.004, .026, .012), .001),
    box('rsb', 'fixed', BLK3, (0, .066, .0), (.024, .02, .03), .004),
    ring_z('rsr', BLK3, (0, .082, .0), .007, .0028, 18),
    box('mw', 'fixed', 0x1e2022, (0, -.06, .2), (.042, .04, .07), .008),
    grip((0, -.09, -.03), -.35, BLK3, (.036, .12, .05)),
    *trig_guard(.0, .08),
    box('ch', 'fixed', BLK3, (.032, .03, .2), (.012, .014, .04), .003),
    tube('s1', 'fixed', BLK2, [(0, .02, -.05), (0, .02, -.26)], .009, 8),
    tube('s2', 'fixed', BLK2, [(0, -.05, -.04), (0, -.035, -.26)], .009, 8),
    box('sb', 'fixed', 0x111111, (0, -.01, -.27), (.04, .1, .02), .006),
    box('sh', 'fixed', BLK2, (0, -.01, -.04), (.03, .06, .02), .005),
    ring_z('qd', 0x3a3d40, (.03, -.03, -.22), .01, .0025),
]
for i in range(6):
    for sgn in (1, -1):
        ump.append(box('rb', 'fixed', 0x16181a, (sgn * .0285, -.02, .17 + i * .02), (.003, .05, .008), .001))
gun('G_ump', .8, ump, UMP_MAG, (0, -.05, .19))

# KAR98K：胡桃木托（木紋）、槍機與彎柄、槍管箍、準星罩、4 倍鏡（鏡圈、調整鈕、物鏡與目鏡）
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

kst = loft('ks', 'fixed', WOOD, stock_sections([(-.43, -.068, .044, .15), (-.34, -.056, .042, .124), (-.24, -.04, .038, .085), (-.15, -.03, .034, .06), (-.09, -.036, .044, .098), (-.03, -.02, .048, .07), (.05, -.012, .048, .062), (.4, .0, .042, .046), (.62, .006, .036, .034)]))
grain(kst, WOOD)
SC = (0, .1)
kar = [
    kst,
    box('bp', 'fixed', 0x3a2a1c, (0, -.07, -.434), (.048, .152, .008), .003),
    tube('br', 'fixed', 0x232527, [(0, .035, .05), (0, .035, .9)], [.013, .009], 14),
    cyl('rc', 'fixed', BLK, (0, .035, -.08), (0, .035, .12), .018, 16),
    cyl('bb', 'fixed', 0x4a4d50, (0, .045, -.12), (0, .045, -.02), .012, 12),
    tube('bh', 'fixed', 0x3a3d40, [(-.012, .045, -.04), (-.045, .035, -.042), (-.06, .005, -.05)], .0055, 8),
    ell('bk', 'fixed', 0x3a3d40, (-.062, -.003, -.052), (.013, .013, .013), 12, 10),
    *trig_guard(-.07, -.01, -.04),
    box('fp', 'fixed', BLK, (0, -.045, .02), (.03, .012, .1), .003),
    tube('b1', 'fixed', BLK, [(0, .012, .3), (0, .012, .318)], .035, 16),
    tube('b2', 'fixed', BLK, [(0, .015, .55), (0, .015, .565)], .031, 16),
    box('fs', 'fixed', BLK, (0, .052, .885), (.004, .016, .01), .001),
    lathe('fh', 'fixed', BLK, [(.014, 0), (.016, .004), (.016, .03), (.014, .034)], (0, .045, .87), 14, rot=(math.pi / 2, 0, 0), a0=-1.9, a1=1.9, cap_top=False, cap_bot=False),
    box('rsr', 'fixed', BLK, (0, .058, .2), (.03, .01, .05), .003),
    ring_z('sw1', 0x3a3d40, (0, -.04, .5), .012, .0025),
    ring_z('sw2', 0x3a3d40, (0, -.09, -.26), .012, .0025),
    # 瞄準鏡
    cyl('sc', 'fixed', 0x2a2d31, (0, .1, -.07), (0, .1, .2), .0145, 20),
    lathe('so', 'fixed', 0x2a2d31, [(.0145, 0), (.0165, .01), (.024, .035), (.025, .085), (.023, .09), (.021, .09)], (0, .1, .2), 28, rot=(math.pi / 2, 0, 0), cap_top=False, cap_bot=False),
    lathe('se', 'fixed', 0x2a2d31, [(.0145, 0), (.0175, -.018), (.0195, -.045), (.0195, -.062), (.0172, -.064)], (0, .1, -.07), 28, rot=(math.pi / 2, 0, 0), cap_top=False, cap_bot=False),
    lathe('sr', 'fixed', 0x303336, [(.0195, -.062), (.021, -.066), (.021, -.07), (.0215, -.071), (.0215, -.08), (.021, -.081), (.021, -.084), (.0188, -.088), (.0172, -.086)], (0, .1, -.07), 48, rot=(math.pi / 2, 0, 0), cap_top=False, cap_bot=False, var=.08,
          rfn=lambda a, y: 1 + (.045 if -.0795 < y < -.0715 and math.sin(a * 36) > 0 else 0)),
    ring_z('sch', 0x5a5e62, (0, .1, -.157), .0185, .0016, 32),
    ring_z('sch2', 0x5a5e62, (0, .1, -.134), .0197, .0013, 32),
    cyl('sl', 'fixed', 0x2b4a5a, (0, .1, .286), (0, .1, .288), .021, 24, var=0),
    cyl('sli', 'fixed', 0x0c1218, (0, .1, -.152), (0, .1, -.15), .0172, 24, var=0),
    cyl('t1', 'fixed', 0x2a2d31, (0, .114, .065), (0, .135, .065), .0115, 16),
    cyl('t1c', 'fixed', 0x1f2022, (0, .135, .065), (0, .142, .065), .0125, 16),
    cyl('t2', 'fixed', 0x2a2d31, (-.014, .1, .065), (-.035, .1, .065), .0115, 16),
    cyl('t2c', 'fixed', 0x1f2022, (-.035, .1, .065), (-.042, .1, .065), .0125, 16),
    cyl('t3', 'fixed', 0x2a2d31, (.014, .1, .065), (.03, .1, .065), .0095, 14),
    box('tsd', 'fixed', 0x2a2d31, (0, .1, .065), (.034, .03, .036), .008),
    ring_z('r1', 0x1a1a1a, (0, .1, -.02), .0155, .0035, 24),
    ring_z('r2', 0x1a1a1a, (0, .1, .15), .0155, .0035, 24),
    box('m1', 'fixed', BLK, (0, .07, -.02), (.02, .045, .02), .004),
    box('m2', 'fixed', BLK, (0, .07, .15), (.02, .045, .02), .004),
]
for o in kar:
    if o.name.startswith(('t1c', 't2c')):
        recolor(o, lambda p, n: tuple(x * (.55 if math.sin(math.atan2(p.x, p.z) * 40 + math.atan2(p.y, p.z) * 40) > .3 else 1) for x in hexrgb(0x1f2022)))
wear(kar[3], .2)
gun('G_kar98', 1.8, kar)

# S686：雙管、鐫刻的銀色機匣、木托與護木、瞄準肋與金色準星珠
sst = loft('ss', 'fixed', WOOD, stock_sections([(-.4, -.07, .045, .135), (-.3, -.058, .043, .115), (-.2, -.042, .038, .075), (-.12, -.035, .036, .06), (-.06, -.03, .04, .075), (-.02, -.015, .042, .06)]))
grain(sst, WOOD)
fend = box('fe', 'fixed', WOOD, (0, -.006, .29), (.046, .036, .24), .014, rot=(.02, 0, 0), smooth=True)
grain(fend, WOOD)
rcv = box('rc', 'fixed', 0xb9bcbf, (0, -.005, .03), (.052, .075, .14), .012)
recolor(rcv, lambda p, n: tuple(x * (0.78 + .22 * (math.sin(p.x * 400 + math.sin(p.z * 200) * 3) * math.sin(p.z * 300 + math.sin(p.y * 250) * 2) > .15)) for x in hexrgb(0xb9bcbf)))
s686 = [
    sst, fend, rcv,
    box('bp', 'fixed', 0x1e1e1e, (0, -.075, -.405), (.048, .14, .014), .005),
    cyl('b1', 'fixed', 0x1f2123, (.0135, .026, .09), (.0135, .026, .72), .0135, 16),
    cyl('b2', 'fixed', 0x1f2123, (-.0135, .026, .09), (-.0135, .026, .72), .0135, 16),
    cyl('m1', 'fixed', 0x0a0a0a, (.0135, .026, .719), (.0135, .026, .7205), .009, 12, var=0),
    cyl('m2', 'fixed', 0x0a0a0a, (-.0135, .026, .719), (-.0135, .026, .7205), .009, 12, var=0),
    box('rb', 'fixed', 0x1f2123, (0, .043, .4), (.012, .005, .62), .002),
    box('rbm', 'fixed', 0x1f2123, (0, .0, .4), (.008, .01, .5), .002),
    ell('bd', 'fixed', 0xd4af37, (0, .048, .71), (.0035, .0035, .0035), 10, 8),
    box('tl', 'fixed', 0x9ea2a5, (0, .036, -.04), (.012, .01, .045), .003),
    box('sf', 'fixed', 0x9ea2a5, (0, .032, -.075), (.008, .006, .02), .002),
    *trig_guard(-.03, .03),
    ring_z('sw', 0x9ea2a5, (0, -.1, -.3), .01, .0025),
]
gun('G_s686', 2.6, s686)

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

# ───────── 戰利品（原點在地面）─────────
def item(name, ox, parts):
    o = join(orient_all(parts), name)
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


# ───────── 第一人稱手臂（手套 + 袖子；原點 = 握把中心 / 護木軸線），網頁依槍擺位置 ─────────
def fing(pts, r0, r1, n=10):
    rr = [r0 + (r1 - r0) * i / (len(pts) - 1) for i in range(len(pts))]
    return limb('vf', 'glove', 0, pts, rr, n, step=.006)

def vm_right():
    o = []
    # 握把局部座標：握把沿 y、前方 +z；右手手掌包在後方與右側，手指繞過前面到左側
    o.append(box('vp', 'glove', 0, (-.016, .012, -.036), (.036, .095, .05), .016, rot=(0, -.5, 0), seg=3, smooth=True))
    for i, y in enumerate((.022, -.004, -.03)):
        pts = []
        for k in range(8):
            th = math.radians(-115 + k * 26)
            rx, rz = .03, .038
            pts.append((rx * math.sin(th), y - k * .0012, rz * math.cos(th)))
        o.append(fing(pts, .0105, .0088))
    # 食指扣在扳機上、拇指壓在左側
    o.append(fing([(-.024, .05, -.012), (-.02, .056, .025), (-.008, .058, .055), (.0, .05, .068)], .0102, .0088))
    o.append(fing([(-.02, .052, -.05), (.0, .062, -.03), (.022, .06, -.005), (.03, .052, .02)], .0125, .0098))
    o.append(box('vk', 'fixed', 0x3a3c3e, (-.03, .03, -.045), (.012, .03, .05), .005, rot=(0, -.5, 0), smooth=True))
    # 手腕與前臂往右後下方延伸
    W = Vector((-.02, -.035, -.085))
    E = Vector((-.12, -.34, -.24))   # 前臂往下多、往後少：第一人稱時袖口會從畫面右下角出現
    o.append(lathe('vgc', 'glove', 0, [(.036, -.02), (.041, -.01), (.043, .03), (.04, .04)], (0, 0, 0), 20))
    o[-1].location = V(*W); bpy.context.view_layer.update()
    arm_bm = bm_tube([tuple(W + (E - W) * t) for t in (0, .1, 1)], [.036, .042, .05], 18)
    o.append(finish(arm_bm, 'vs', 'shirt', 0, var=.03))
    o.append(finish(bm_tube([tuple(W + (E - W) * .09), tuple(W + (E - W) * .16)], .046, 18), 'vcu', 'shirt', 0))
    return o

def vm_left():
    o = []
    # 護木沿 z、半徑約 0.038；左手托在下方，手指繞上左側，拇指在右側
    o.append(box('vp', 'glove', 0, (.01, -.05, 0), (.06, .03, .09), .014, rot=(0, 0, .35), seg=3, smooth=True))
    for i, z in enumerate((.03, .01, -.01, -.03)):
        pts = []
        for k in range(8):
            th = math.radians(-70 + k * 16 - i * 4)
            pts.append((.047 * math.cos(th), .047 * math.sin(th), z + k * .001))
        o.append(fing(pts, .0105, .0088))
    o.append(fing([(-.012, -.05, -.02), (-.035, -.035, .0), (-.046, -.012, .025), (-.046, .004, .045)], .0125, .0095))
    o.append(box('vk', 'fixed', 0x3a3c3e, (.045, -.03, 0), (.012, .03, .07), .005, rot=(0, 0, .6), smooth=True))
    W = Vector((.03, -.08, -.05))
    E = Vector((.15, -.38, -.2))     # 左前臂從畫面左下方伸上來托住護木
    arm_bm = bm_tube([tuple(W + (E - W) * t) for t in (0, .12, 1)], [.035, .041, .05], 18)
    o.append(finish(arm_bm, 'vs', 'shirt', 0, var=.03))
    o.append(finish(bm_tube([tuple(W + (E - W) * .1), tuple(W + (E - W) * .17)], .045, 18), 'vcu', 'shirt', 0))
    o.append(finish(bm_tube([tuple(W - (E - W).normalized() * .012), tuple(W + (E - W).normalized() * .02)], .04, 18), 'vgc', 'glove', 0))
    o.append(finish(bm_tube([tuple(W + (E - W) * .03), tuple(W + (E - W) * .055)], .043, 18), 'vw', 'fixed', 0x1b1b1b))
    return o

for name, fn, ox in (('VM_R', vm_right, -2), ('VM_L', vm_left, -2.6)):
    parts = orient_all(fn())
    o = join(parts, name)
    smooth_by_angle(o, 45)
    origin_to(o, (0, 0, 0))
    move(o, (ox, 1, -4))
    OUT.append(o); BAKE.append(o)

# ───────── 烘焙、遠距離用的低面數身體、匯出 ─────────
print('tris', tri_count([o for o in OUT if o.type == 'MESH']))
SAMPLES = int(os.environ.get('SAMPLES', '32'))
for o in VARIANTS:
    o.hide_render = True
ao_bake(BAKE, samples=SAMPLES)
for o in VARIANTS:
    o.hide_render = False
    ao_bake([o], samples=SAMPLES)
    o.hide_render = True
for o in VARIANTS:
    o.hide_render = False
# 低面數身體：同一副骨架與權重，面數約 1/5（60 m 外換成它）
LOD = BODYOB.copy(); LOD.data = BODYOB.data.copy(); LOD.name = 'W_lod'; LOD.data.name = 'W_lod'
bpy.context.scene.collection.objects.link(LOD)
for m in list(LOD.modifiers):
    LOD.modifiers.remove(m)
dm = LOD.modifiers.new('Dec', 'DECIMATE'); dm.ratio = float(os.environ.get('LODR', '.2'))
for o in bpy.context.view_layer.objects:
    o.select_set(False)
LOD.select_set(True); bpy.context.view_layer.objects.active = LOD
bpy.ops.object.modifier_apply(modifier='Dec')
LOD.parent = RIG
am = LOD.modifiers.new('Armature', 'ARMATURE'); am.object = RIG
OUT.append(LOD)
print('lod tris', tri_count([LOD]), 'body tris', tri_count([BODYOB]))
export(os.environ.get('GLB', os.path.join(HERE, 'workers.glb')), OUT)

if PREVIEW:
    os.makedirs(PREVIEW, exist_ok=True)
    for o in VARIANTS:
        o.hide_render = o.name not in ('HAIR_0', 'BEARD_1')
        o.hide_viewport = o.hide_render
    tint_roles([o for o in OUT if o.type == 'MESH'])
    LOD.hide_viewport = True
    preview(os.path.join(PREVIEW, 'worker.png'), (0, .95, 0), 4.4, 25, 6)
    preview(os.path.join(PREVIEW, 'worker_back.png'), (0, .95, 0), 4.4, 200, 6)
    preview(os.path.join(PREVIEW, 'head.png'), (0, 1.7, 0), .7, 25, 4)
    preview(os.path.join(PREVIEW, 'headf.png'), (0, 1.7, 0), .6, 0, 2)
    for k, P in POSES.items():
        pose(P)
        preview(os.path.join(PREVIEW, 'p_' + k + '.png'), (0, .95, 0), 4.4, 35, 8)
    pose({})
    LOD.hide_viewport = False; BODYOB.hide_viewport = True
    preview(os.path.join(PREVIEW, 'lod.png'), (0, .95, 0), 4.4, 25, 6)
    LOD.hide_viewport = True; BODYOB.hide_viewport = False
    for o in VARIANTS:
        o.hide_viewport = False
    preview(os.path.join(PREVIEW, 'hats.png'), (4.8, 1.8, 0), 4.2, 20, 20)
    preview(os.path.join(PREVIEW, 'armor.png'), (11.4, 1.3, 0), 3.2, 25, 12)
    preview(os.path.join(PREVIEW, 'guns.png'), (1.3, 1, -4), 2.6, 0, 55)
    preview(os.path.join(PREVIEW, 'guns_side.png'), (1.3, 1, -4.2), 3.4, 90, 5, lens=50)
    preview(os.path.join(PREVIEW, 'kar.png'), (1.8, 1.08, -3.95), .8, 60, 12)
    preview(os.path.join(PREVIEW, 'm416.png'), (0, 1.0, -3.8), 1.2, 70, 15)
    preview(os.path.join(PREVIEW, 'vm.png'), (-2.3, .95, -4.1), 1.0, 160, 25)
    preview(os.path.join(PREVIEW, 'chute.png'), (0, 3, -8), 12, 30, 25)
    preview(os.path.join(PREVIEW, 'items.png'), (24, .1, 3), 5.5, 10, 35)
