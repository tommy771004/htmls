# 190 封頂：工人（蒙皮網格 + 19 根骨頭）、臉、頭髮與鬍子變化、翼型降落傘、安全帽、防護背心、
#          四把槍（含可拆的彈匣、4 倍鏡）、第一人稱手臂、遠距離用的低面數身體與戰利品 → workers.glb
# 重建：/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P assets/190/build_workers.py
#   匯出後最後一步由 glb_draco.py 把網格改存 KHR_draco_mesh_compression（網頁用 DRACOLoader 解碼）；DRACO=0 輸出未壓縮的 glb
#   環境變數 PREVIEW=資料夾 會另存預覽圖（調色盤部位塗上示範顏色）；SAMPLES=烘焙取樣數；STAGE=body 只做身體；
#   VMDEV=資料夾 只做到第一人稱手臂：印出手指跟槍的穿插檢查、存每把槍的視角圖，不烘焙也不匯出
import sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lb_lib import *
import lb_lib
lb_lib.ROLES = ROLES = ROLES + ('gear',)     # gear：手套的袖口、護墊（跟手套同色壓暗，徒手時收起來）
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

def ss(e0, e1, x):
    t = max(0.0, min(1.0, (x - e0) / (e1 - e0)))
    return t * t * (3 - 2 * t)

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
    # 皺褶最深的手肘、膝蓋再細分一次（腰、胯下、褲管的淺褶用原本的點就夠，省面數給一群人同框的時候）
    def fold_zone(c):
        for sx in (1, -1):
            if (c - Vector((sx * .262, 1.15, 0))).length < .085 or (c - Vector((sx * .103, .5, 0))).length < .095:
                return True
        return False
    bm = bmesh.new(); bm.from_mesh(ob.data)
    fs = [f for f in bm.faces if fold_zone(T(f.calc_center_median()))]
    bmesh.ops.subdivide_edges(bm, edges=list({e for f in fs for e in f.edges}), cuts=1, use_grid_fill=True, smooth=1.0)
    ng = [f for f in bm.faces if len(f.verts) > 4]
    if ng:
        bmesh.ops.triangulate(bm, faces=ng)
    bm.to_mesh(ob.data); bm.free(); ob.data.update()
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
        # 布料皺褶：折痕窄、布面寬（|cos| 的形狀）；手肘前面、膝蓋後面較深
        for sx in (1, -1):
            for (c, r, f, amp, inner) in (((sx * .262, 1.15, 0), .075, 175, .012, 1), ((sx * .103, .5, 0), .085, 150, .013, -1)):
                w = gauss((p - Vector(c)).length, r)
                if w > .04:
                    u = p.y * f + (p.x * sx) * 40 * inner + noise.noise(p * 14) * 2.2
                    d += amp * w * (abs(math.cos(u)) - .62) * (.55 + .45 * max(0, n.z * inner))
            # 腋下往胸口斜的皺褶
            w = gauss((p - Vector((sx * .165, 1.34, .03))).length, .07) * max(0, n.z)
            if w > .04:
                d += .008 * w * (abs(math.cos((p.y - 1.34) * 150 + (p.x * sx) * 110 + noise.noise(p * 16) * 1.5)) - .62)
            # 褲管下緣堆在靴子上：一圈圈斜的波浪
            w = ss(.31, .25, p.y) * ss(.15, .19, p.y) * (1 if abs(p.x - sx * .105) < .1 else 0)
            if w > 0:
                a = math.atan2(p.x - sx * .105, p.z)
                d += .01 * w * (abs(math.cos(p.y * 105 + a * 1.6 + noise.noise(p * 13) * 2)) - .55)
        # 衣服紮進褲子：皮帶上方鼓起一圈，有幾道直的褶子
        w = ss(1.03, 1.045, p.y) * ss(1.12, 1.07, p.y) * (1 if abs(p.x) < .2 else 0)
        if w > 0:
            a = math.atan2(p.x, p.z)
            d += w * (.005 + .007 * (abs(math.cos(a * 7 + noise.noise(p * 10) * 1.8)) - .6))
        # 胯下往大腿的斜褶
        for sx in (1, -1):
            w = gauss((p - Vector((sx * .06, .8, .07))).length, .06) * max(0, n.z)
            if w > .04:
                d += .007 * w * (abs(math.cos((p.y - .8) * 130 - (p.x * sx) * 150 + noise.noise(p * 15))) - .6)
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

DEMO = {'shirt': 0x2f4a5a, 'pants': 0x283347, 'skin': 0xc98f6a, 'glove': 0xa88a62, 'gear': 0x6e5a40, 'vis': 0xd9ea2b, 'hair': 0x2a211a, 'paint': 0x888888}
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
# 衣服接縫的顏色：袖子、袖籠、褲子、軀幹側縫已經是幾何（下面的 welt），這裡只剩腰線（被腰帶蓋住，只在腰帶縫隙露出）壓暗一點
def seams(p, n):
    k = 1.0
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

def tag_welt(ob):
    """標記成縫線（做遠距離身體時刪掉）"""
    g = ob.vertex_groups.get('welt') or ob.vertex_groups.new(name='welt')
    g.add(list(range(len(ob.data.vertices))), 1.0, 'REPLACE')

def on_surface(name, role, color, o, d, size, lift=0.0, bevel=.006, tilt=0.0, smooth=True, var=.04, st=0.0, top=True):
    """沿射線找到表面，放一個貼著表面的方塊（口袋、護膝、貼片）；st>0 時在正面離邊 st 處加一圈凸起的車縫線（細條幾何，遠距離身體會刪掉）"""
    p, n = ray(o, d)
    if p is None:
        return None
    yaw = math.atan2(n.x, n.z)
    pitch = -math.asin(max(-1, min(1, n.y)))
    c = p + n * (size[2] / 2 + lift)
    ob = box(name, role, color, tuple(c), size, bevel, rot=(pitch + tilt, yaw, 0), smooth=smooth, var=var)
    if st:
        Ri = rot_m((pitch + tilt, yaw, 0)).inverted()
        def sc(q, nn, base=hexrgb(color) if role not in ROLES else (1, 1, 1)):
            l = Ri @ (q - c)
            if l.z < size[2] / 2 - .002:
                return None
            e = min(size[0] / 2 - abs(l.x), size[1] / 2 - abs(l.y))
            k = .74 if abs(e - st) < .0012 else 1.0
            return tuple(x * k for x in base)
        recolor(ob, sc)
        # 車縫的細稜：三角斷面（寬 1.6 mm、比布面高 1.2 mm，硬邊才吃得到光），底面貼著口袋不做；上緣被袋蓋蓋住的不做（top=False）
        R = rot_m((pitch + tilt, yaw, 0))
        z, hx, hy = size[2] / 2 - .0002, size[0] / 2 - st, size[1] / 2 - st
        bm = bmesh.new()
        def ridge(a, b, sd):
            a, b, sd = Vector(a), Vector(b), Vector(sd)
            up = Vector((0, 0, .0014))
            vs = [bm.verts.new(tuple(c + R @ q)) for q in (a - sd, a + up, a + sd, b - sd, b + up, b + sd)]
            bm.faces.new((vs[0], vs[3], vs[4], vs[1])); bm.faces.new((vs[1], vs[4], vs[5], vs[2]))      # 兩端 1.6 mm 的小三角形看不到，不做
        w = .0008
        if top:
            ridge((-hx, hy, z), (hx, hy, z), (0, w, 0))
        ridge((hx, -hy, z), (-hx, -hy, z), (0, -w, 0))
        ridge((-hx, -hy, z), (-hx, hy, z), (-w, 0, 0))
        ridge((hx, hy, z), (hx, -hy, z), (w, 0, 0))
        bars = finish(bm, name + 'st', role, color, var=0, smooth=False)
        # 開放的細條：recalc 可能把整條翻反，跟口袋正面的方向比，反了就整條（2 面）翻回來
        Nb = V(*(R @ Vector((0, 0, 1))))
        b2 = bmesh.new(); b2.from_mesh(bars.data); b2.faces.ensure_lookup_table(); b2.normal_update()
        for k in range(0, len(b2.faces), 2):
            if b2.faces[k].normal.dot(Nb) + b2.faces[k + 1].normal.dot(Nb) < 0:
                bmesh.ops.reverse_faces(b2, faces=b2.faces[k:k + 2])
        b2.to_mesh(bars.data); b2.free(); bars.data.update()
        recolor(bars, lambda q, nn, base=hexrgb(color) if role not in ROLES else (1, 1, 1): tuple(x * .8 for x in base))
        tag_welt(bars)
        ob = join([ob, bars], name)
    return ob

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
def boundary_loops(ob):
    """網格的開放邊界（只接一個面的邊）串成一圈一圈，回傳 three 座標"""
    me = ob.data
    cnt = {}
    for poly in me.polygons:
        for ek in poly.edge_keys:
            cnt[ek] = cnt.get(ek, 0) + 1
    nb = {}
    for (a, b), c in sorted(cnt.items()):
        if c == 1:
            nb.setdefault(a, []).append(b); nb.setdefault(b, []).append(a)
    loops, seen = [], set()
    for v0 in sorted(nb):
        if v0 in seen:
            continue
        lp, prev, v = [v0], None, v0
        seen.add(v0)
        while True:
            nx = [u for u in nb[v] if u != prev and u not in seen]
            if not nx:
                break
            prev, v = v, nx[0]
            seen.add(v); lp.append(v)
        loops.append([T(ob.matrix_world @ me.vertices[i].co) for i in lp])
    return loops
VEST_LOOPS = boundary_loops(vest)
solid(vest, .006)
fabric(vest, .0015, 30)
B_(vest, *TORSO_B)
# 反光條：兩圈橫帶 + 前後各兩條直帶 + 越過肩膀
for (y0, y1) in ((1.095, 1.135), (1.2, 1.24)):
    B_(band('tape', 'fixed', TAPE, y0, y1, .0185, n=72, th=.003, var=0), *TORSO_B)
def ribbon(name, role, color, pts, w, off, th=.0025, sm=0):
    """沿著身體表面的一條等寬帶子：中心線每點取表面法線與切線，兩側邊點各自再貼回表面（邊緣不會鋸齒）"""
    P = [Vector(q) for q in pts]
    def hit(q):          # 跟背心一樣從軀幹中心打射線（背心也是這樣貼的），肩膀上才不會一個貼手臂、一個貼軀幹
        c, n = ray(VC, q - VC)
        return (c, n) if c is not None else near(tuple(q))
    bm = bmesh.new()
    rows = []
    for i, q in enumerate(P):
        tg = (P[min(i + 1, len(P) - 1)] - P[max(i - 1, 0)]).normalized()
        c, n = hit(q)
        sd = n.cross(tg).normalized()
        row = []
        for k in (-1, 1):
            e, n2 = hit(c + sd * (k * w / 2))
            row.append(e + n2 * off)
        rows.append(row)
    # 肩膀上射線幾乎擦過表面，點會跳：沿著帶子方向平滑幾次
    for _ in range(sm):
        rows = [rows[0]] + [[rows[i][k] * .5 + (rows[i - 1][k] + rows[i + 1][k]) * .25 for k in (0, 1)] for i in range(1, len(rows) - 1)] + [rows[-1]]
    rows = [[bm.verts.new(tuple(q)) for q in r] for r in rows]
    for i in range(len(rows) - 1):
        bm.faces.new((rows[i][0], rows[i + 1][0], rows[i + 1][1], rows[i][1]))
    ob = finish(bm, name, role, color, var=0)
    solid(ob, th)
    return ob
for sx in (1, -1):
    # 前面的直條跟背帶保持固定間距：胸口在 39°，上胸跟著背帶往外彎到 52° 接上肩帶（原本在 31° 被背帶斜斜壓過，兩側都露出白色碎片）
    B_(ribbon('rv', 'fixed', TAPE, [sph_hit(sx * D(39 + 13 * ss(40, 64, -40 + 104 * i / 40)), D(-40 + 104 * i / 40), 0) for i in range(41)], .03, .0205, sm=2), *TORSO_B)
    B_(ribbon('rv', 'fixed', TAPE, [sph_hit(sx * D(149), D(-40 + 104 * i / 40), 0) for i in range(41)], .03, .0205, sm=2), *TORSO_B)
    B_(ribbon('rs', 'fixed', TAPE, [sph_hit(sx * D(42 + 110 * i / 40), D(63.2), 0) for i in range(41)], .032, .0215, sm=10), *CHEST_B)   # 從前面直條的中線（41°）起：再往內會凸出直條、浮在 V 領外
# 拉鍊、胸前口袋、對講機、名牌
zb = patch('zip', 'fixed', 0x2b2b2b, -D(1.1), D(1.1), VPH0, D(37), 1, 20, .0175)
B_(finish(zb, 'zip', 'fixed', 0x2b2b2b, var=0), *TORSO_B)
B_(on_surface('zp', 'fixed', 0x9a9c9e, (0, 1.36, 0), (0, 0, 1), (.012, .022, .006), .014, .002), 'chest')
for sx in (1, -1):
    B_(on_surface('vp', 'vis', 0, (sx * .07, 1.08, 0), (sx * .55, 0, 1), (.075, .085, .014), .012, .005, st=.005, top=False), 'torso', 'hips')
    B_(on_surface('vpf', 'vis', 0, (sx * .07, 1.125, 0), (sx * .55, 0, 1), (.08, .022, .016), .014, .004), 'torso')
B_(on_surface('pk', 'vis', 0, (.075, 1.3, 0), (.5, 0, 1), (.07, .075, .014), .012, .005, st=.005), 'chest')
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
    B_(on_surface('sp', 'shirt', 0, (sx * .2, 1.33, 0), (sx, 0, .15), (.07, .08, .012), .004, .006, st=.005, top=False), 'up' + t)
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
    B_(on_surface('cp', 'pants', 0, (sx * .1, .66, 0), (sx, 0, .1), (.105, .13, .02), .002, .008, st=.006, top=False), th)
    B_(on_surface('cpf', 'pants', 0, (sx * .1, .725, 0), (sx, 0, .1), (.11, .032, .024), .004, .006, st=.005), th)
    for dz in (-.012, .026):               # 蓋子上兩顆壓扣、口袋中間一道風琴褶
        B_(on_surface('cpb', 'fixed', 0x3a3a38, (sx * .1, .716, dz), (sx, 0, .1), (.014, .012, .005), .0345, .002), th)
    B_(on_surface('cpl', 'pants', 0, (sx * .1, .655, 0), (sx, 0, .1), (.01, .115, .024), .002, .0), th)
    B_(on_surface('bpk', 'pants', 0, (sx * .08, .9, 0), (sx * .2, 0, -1), (.1, .11, .012), .003, .005, st=.006, top=False), 'hips', th)
    B_(on_surface('bpf', 'pants', 0, (sx * .08, .95, 0), (sx * .2, 0, -1), (.104, .025, .016), .004, .004, st=.005), 'hips')
    # 護膝
    p, n = ray((sx * .103, .5, 0), (0, 0, 1))
    kc = p + n * .018
    B_(box('kp', 'fixed', 0x2f3133, tuple(kc), (.095, .12, .036), .016, smooth=True), sh)
    B_(box('kpi', 'fixed', 0x46484b, tuple(kc + Vector((0, 0, .02))), (.055, .07, .006), .004), sh)
    B_(band('ks', 'fixed', 0x26282a, .455, .475, .004, cx=sx * .103, zc=.004, n=32, th=.004), sh)
    B_(band('ks2', 'fixed', 0x26282a, .535, .555, .004, cx=sx * .103, zc=.004, n=32, th=.004), th)
    # 褲管下緣（蓋在靴筒外面）
    B_(band('hem', 'pants', 0, .16, .2, .004, cx=sx * .105, zc=-.004, n=32, th=.006), sh)

# ── 立體的縫線：袖子內側、袖籠、褲子外側縫與內側縫、褲襠，做成貼著布面的細稜（中間凸起、兩邊沒入布面），會吃光；
#    背心的邊緣包一圈滾邊。網格很省（每段 4 個三角形），遠距離的 W_lod 不帶這些 ──
def welt(name, role, pts, w=.007, h=.0015):
    """沿著布面的一條稜：pts = [(表面點, 法線)]；兩側邊點浮在布面上 0.3 mm，中線抬高 h"""
    # 皺褶比點距短：兩點中間的布面比連線凸出 0.25 mm 以上就在中間補一個貼著布面的點（最多再分 3 層），
    # 稜線才不會一段段沉進布裡（看起來像一截截的黑縫）
    def seg(a, b, d):
        (p, n), (q, m) = a, b
        if d == 0 or (q - p).length < .0025:
            return [b]
        mid = (p + q) / 2
        c = near(tuple(mid))
        if (c[0] - mid).dot((n + m).normalized()) > .00025:
            return seg(a, c, d - 1) + seg(c, b, d - 1)
        return [b]
    dense = pts[:1]
    for a, b in zip(pts, pts[1:]):
        dense += seg(a, b, 3)
    pts = dense
    bm = bmesh.new()
    rows = []
    for i, (p, n) in enumerate(pts):
        tg = (pts[min(i + 1, len(pts) - 1)][0] - pts[max(i - 1, 0)][0]).normalized()
        sd = n.cross(tg).normalized()
        hk = h * min(1.0, i / 2, (len(pts) - 1 - i) / 2)       # 兩端收進布面
        row = []
        for k in (-1, 0, 1):
            if k:
                q, n2 = near(tuple(p + sd * (k * w / 2)))
                row.append(bm.verts.new(tuple(q + n2 * .0003)))
            else:
                row.append(bm.verts.new(tuple(p + n * max(hk, .0005))))
        rows.append(row)
    for i in range(len(rows) - 1):
        for k in (0, 1):
            bm.faces.new((rows[i][k], rows[i + 1][k], rows[i + 1][k + 1], rows[i][k + 1]))
    ob = finish(bm, name, role, 0, var=0)
    # 開放的細條：法線方向不能靠 recalc 猜，跟布面法線比一下，反了就翻
    me = ob.data
    if sum(p.normal.dot(V(*near(tuple(T(p.center)))[1])) for p in me.polygons) < 0:
        b2 = bmesh.new(); b2.from_mesh(me); bmesh.ops.reverse_faces(b2, faces=b2.faces); b2.to_mesh(me); b2.free(); me.update()
    recolor(ob, lambda p, n: (1, 1, 1) if (p - near(tuple(p))[0]).length > .0009 else (.9, .9, .9))   # 稜線亮、兩邊稍暗（車縫的陰影）
    B_(ob, fn=body_weights)
    tag_welt(ob)
    return ob

def axis_path(nodes, y0, y1, step):
    """沿著骨架線（SKG 節點）取等距點，y0..y1 之間"""
    P = [_skp[n][0] for n in nodes]
    out = []
    for a, b in zip(P, P[1:]):
        L = (b - a).length
        for i in range(max(1, int(L / step))):
            q = a.lerp(b, i * step / L)
            if y1 <= q.y <= y0:
                out.append(q)
    q = P[-1]
    if y1 <= q.y <= y0:
        out.append(q)
    return out

# 被背心蓋住的那幾段不做（看不到，省面數）：從布面沿法線往外 3.5 cm 內打到背心就算蓋住；剩下連續的幾段各做一條
bpy.context.view_layer.update()
VBVH = BVHTree.FromObject(vest, bpy.context.evaluated_depsgraph_get())
def covered(p, n):
    loc, nor, i, dist = VBVH.ray_cast(V(*(p + n * .0015)), V(*n))
    return loc is not None and dist < .035
def welt_vis(name, role, pts, *a):
    run = []
    for pn in pts + [None]:
        if pn is not None and not covered(*pn):
            run.append(pn)
            continue
        if len(run) >= 4:
            welt(name, role, run, *a)
        run = []

def cast_line(axis_pts, d):
    """從骨架線往 d 方向打射線，取表面上的點"""
    out = []
    for q in axis_pts:
        p, n = ray(tuple(q), d)
        if p is not None:
            out.append((p, n))
    return out

for sx, t in ((1, 'L'), (-1, 'R')):
    # 袖子內側縫：腋下到袖口，偏後一點；每 9 mm 取一點，皺褶處 welt() 再自己補點
    welt_vis('tseam', 'shirt', cast_line(axis_path(['dl' + t, 'ua' + t, 'el' + t, 'fa' + t, 'wr' + t], 1.31, .965, .009), (-sx * .7, -.1, -.75)))
    # 袖籠：手臂根部一圈（上面被背心蓋住的部分也一起做，接得起來）
    c, nrm = Vector((sx * .17, 1.39, -.004)), Vector((sx, .42, 0)).normalized()
    e1 = Vector((0, 0, 1)); e2 = nrm.cross(e1).normalized()
    ring = []
    for i in range(41):
        a = i / 40 * TAU
        p, n = ray(tuple(c), tuple(e1 * math.cos(a) + e2 * math.sin(a)))
        if p is not None:
            ring.append((p, n))
    welt_vis('tseam', 'shirt', ring)
    # 軀幹側縫：腰帶上緣到腋下（背心蓋住的那段自動略過，只剩背心下襬與袖籠之間露出的部分）
    welt_vis('tseam', 'shirt', cast_line([Vector((0, 1.046 + i * .0065, -.004)) for i in range(56)], (sx, 0, 0)))
    # 褲子外側縫（腰帶下到褲管）、內側縫（胯下到褲管）
    welt('tseam', 'pants', cast_line(axis_path(['pelvis', 'hp' + t, 'th' + t, 'kn' + t, 'ca' + t, 'an' + t], .975, .205, .019), (sx, 0, -.06)), .008, .0018)
    welt('tseam', 'pants', cast_line(axis_path(['hp' + t, 'th' + t, 'kn' + t, 'ca' + t, 'an' + t], .76, .205, .019), (-sx, 0, -.04)), .008, .0018)
# 褲頭上緣：腰帶上面露出 1 cm 的褲頭，一圈車縫的稜（背心蓋住的前後兩段略過）
wb = []
for i in range(57):
    a = i / 56 * TAU
    p, n = ray((0, 1.04, -.004), (math.sin(a), 0, math.cos(a)))
    if p is not None:
        wb.append((p, n))
welt_vis('tseam', 'pants', wb, .008, .0018)
# 褲襠：前面從腰帶下繞過胯下到後面
crotch = []
for i in range(19):
    a = math.radians(70 - 140 * i / 18)
    p, n = ray((0, .9, -.004), (0, -math.cos(a), math.sin(a)))
    if p is not None and p.y < .975:
        crotch.append((p, n))
welt('tseam', 'pants', crotch, .008, .0018)
# 背心的滾邊：沿背心的邊緣（V 領、袖口、下襬）一圈 4 邊形的細管，包住布邊
def loop_tube(name, role, pts, r, step=.014):
    keep, acc = [pts[0]], 0.0
    for a, b in zip(pts, pts[1:]):
        acc += (b - a).length
        if acc >= step:
            keep.append(b); acc = 0.0
    P = keep
    bm = bmesh.new()
    rings = []
    m = len(P)
    for i in range(m):
        tg = (P[(i + 1) % m] - P[i - 1]).normalized()
        q, n = near(tuple(P[i]))
        n = (n - tg * n.dot(tg)).normalized()
        b = tg.cross(n)
        c = P[i] - n * .003
        rings.append([bm.verts.new(tuple(c + (n * math.cos(k * TAU / 4) + b * math.sin(k * TAU / 4)) * r)) for k in range(4)])
    for i in range(m):
        for k in range(4):
            bm.faces.new((rings[i][k], rings[i][(k + 1) % 4], rings[(i + 1) % m][(k + 1) % 4], rings[(i + 1) % m][k]))
    return finish(bm, name, role, 0, var=0)
for lp in VEST_LOOPS:
    if len(lp) > 8:
        B_(loop_tube('vbind', 'vis', lp, .0042), *TORSO_B)
        recolor(BODY[-1], lambda p, n: (.86, .86, .86))
        tag_welt(BODY[-1])

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
    pts = [tuple(bpc + Vector((sx * .085, .13, .03))), sph_hit(sx * D(150), D(64), .03), sph_hit(sx * D(90), D(68), .03),
           sph_hit(sx * D(40), D(64), .03), sph_hit(sx * D(26), D(45), .029), sph_hit(sx * D(24), D(22), .029), sph_hit(sx * D(24), D(4), .027)]
    B_(tube('bs', 'fixed', 0x2f3328, pts, .017, 6, flat=.28), *TORSO_B)       # 跟反光條同一組骨頭，舉槍時兩者才不會錯開、反光條從背帶邊戳出來
    B_(box('bsb', 'fixed', 0x1f1f1f, sph_hit(sx * D(24), D(15), .032), (.03, .026, .012), .004), *TORSO_B)
cs0, cs1 = Vector(sph_hit(D(24), D(30), .026)), Vector(sph_hit(-D(24), D(30), .026))
B_(box('cs', 'fixed', 0x2f3328, tuple((cs0 + cs1) / 2), ((cs0 - cs1).length, .014, .008), .003), 'chest')
B_(box('cb', 'fixed', 0x1f1f1f, tuple((cs0 + cs1) / 2 + Vector((0, 0, .004))), (.03, .022, .01), .003), 'chest')

# ───────── 頭：單位球在臉部加密（眼睛、鼻嘴再加密一次），塑形成前臉較平、太陽穴轉折明顯的頭形，
#           雕出眉骨、眼窩、鼻根鼻樑鼻頭鼻翼與鼻孔、人中、上下唇、下巴、顴骨、下顎；
#           眼裂挖空讓眼球露出來、眼皮包著眼球；耳朵有耳輪、對耳輪、耳甲與耳垂 ─────────
HC = Vector((0, 1.7, .01))
ER = .0122                    # 眼球半徑
EX, EY = .0315, .005          # 眼球中心（相對頭中心，x 取絕對值）
AW = .0116                    # 眼裂半寬

def lid_top(u):
    """眼裂上緣（u：往外為正、相對眼球中心），外眼角略高"""
    s = max(-1.0, min(1.0, (u + .0012) / AW))
    return .0009 * u / AW + .0001 + .0044 * (1 - s * s) ** .8

def lid_bot(u):
    s = max(-1.0, min(1.0, (u - .0008) / AW))
    return .0009 * u / AW + .0001 - .0034 * (1 - s * s) ** .9

def in_eye(u, v):
    return -AW < u < AW and lid_bot(u) < v < lid_top(u)

def refine(bm, pick):
    fs = [f for f in bm.faces if pick(f.calc_center_median())]
    es = list({e for f in fs for e in f.edges})
    bmesh.ops.subdivide_edges(bm, edges=es, cuts=1, use_grid_fill=True)
    for v in bm.verts:
        v.co.normalize()

def interp(t, keys):
    if t >= keys[0][0]:
        return keys[0][1]
    for (a0, y0), (a1, y1) in zip(keys, keys[1:]):
        if t >= a1:
            k = (t - a0) / (a1 - a0)
            k = k * k * (3 - 2 * k)
            return y0 + (y1 - y0) * k
    return keys[-1][1]

def seg_dist(px, py, ax, ay, bx, by):
    dx, dy = bx - ax, by - ay
    t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
    return math.hypot(px - ax - dx * t, py - ay - dy * t)

def nose(x, y):
    """鼻子：高度與半寬沿 y 變化（鼻根 → 鼻樑 → 鼻頭 → 鼻小柱），截面頂端較平"""
    H = interp(y, [(.022, 0), (.012, .0045), (-.004, .0098), (-.02, .016), (-.03, .0208), (-.036, .0214), (-.041, .016), (-.046, .0055), (-.05, 0)])
    W = interp(y, [(.022, .0085), (.004, .0072), (-.02, .0084), (-.033, .0102), (-.043, .0088), (-.05, .008)])
    h = .8 * H * math.exp(-abs(x / W) ** 2.4)
    h += .003 * g2(x, y + .0335, .0082, .0075)                               # 圓鼻頭
    return h

def face_disp(x, y, z):
    fz = ss(.02, .075, z)
    ax = abs(x)
    dz = 0.0
    dz -= .0105 * g2(ax - .031, y - .003, .0175, .0125)                       # 眼窩
    dz -= .003 * g2(ax - .028, y - .014, .013, .005)                          # 眉骨下的凹
    dz += .0075 * g2(ax - .029, y - .027, .026, .0085)                        # 眉骨
    dz += .003 * g2(x, y - .02, .009, .01)                                    # 眉心
    dz += .0055 * g2(ax - .047, y + .017, .017, .012)                         # 顴骨
    dz -= .0025 * g2(ax - .052, y + .047, .016, .02)                          # 顴骨下的凹
    dz += nose(x, y)
    dz += .0098 * g2(ax - .0145, y + .0405, .0074, .0066)                     # 鼻翼
    ring = math.hypot(ax - .0145, (y + .0405) * 1.1) - .0098
    dz -= .003 * math.exp(-(ring / .0022) ** 2) * ss(.011, .02, ax + max(0, y + .036) * 2)   # 鼻翼溝
    dz -= .0055 * g2(ax - .0072, y + .0452, .0033, .0021)                     # 鼻孔
    nl = seg_dist(ax, y, .022, -.037, .034, -.072)
    dz -= .0022 * math.exp(-(nl / .0034) ** 2)                               # 法令紋
    dz += .0016 * math.exp(-((nl - .0065) / .005) ** 2) * (1 if ax > .025 else ss(.018, .025, ax))
    dz -= .0014 * g2(x, y + .051, .0028, .006)                                # 人中
    dz += .0008 * g2(ax - .0048, y + .051, .002, .0065)                       # 人中兩條脊
    dz += .0062 * math.exp(-(x / .019) ** 4) * math.exp(-((y + .0585 - .0007 * g2(ax - .0055, 0, .004, 1)) / .0042) ** 2)   # 上唇（唇峰）
    dz += .0072 * math.exp(-(x / .0165) ** 4) * math.exp(-((y + .0708) / .005) ** 2)      # 下唇
    ym = -.0648 + .0006 * (x / .02) ** 2
    dz -= .0045 * math.exp(-(x / .0235) ** 6) * math.exp(-((y - ym) / .0013) ** 2)       # 嘴縫
    dz -= .0028 * g2(ax - .0245, y + .0648, .0035, .004)                      # 嘴角
    dz -= .003 * g2(x, y + .0815, .015, .0038)                                # 唇下凹
    dz += .0085 * g2(x, y + .095, .019, .0125)                                # 下巴
    return dz * fz

def head_shape(ux, uy, uz):
    x, y, z = ux * .085, uy * .112, uz * .103
    jaw = ss(-.02, -.104, y)
    x *= 1 - jaw * .2
    top = ss(.01, .1, y)
    x *= 1 + top * .1
    z *= 1 + top * .05
    if z < 0:
        z *= (1 - ss(-.02, -.1, y) * .22) * (1 + ss(-.01, .06, y) * .07)
    else:
        # 前臉較平：水平截面 45° 附近往外推，臉頰與太陽穴的轉折更明顯
        a = math.atan2(abs(x), z)
        band = ss(-.11, -.06, y) * (1 - ss(.03, .08, y))
        k = math.sin(2 * a) ** 2 * band
        z *= 1 + .07 * k
        x *= 1 + .02 * k
        x *= 1 - ss(.035, .1, z) * .16
        z *= 1 - ss(.03, .11, y) * .1
        z *= 1 + jaw * .02
        # 口鼻往前：上下顎在臉的正面，側面看臉才不會往後倒
        z += .014 * ss(.005, -.04, y) * (1 - ss(-.095, -.125, y)) * math.cos(min(a, 1.5)) ** 3
    sx = 1 if x >= 0 else -1
    x += sx * .01 * g2(abs(x) - .066, y + .06, .024, .026) * ss(.07, .035, z)                  # 下顎角
    x -= sx * .0035 * g2(y - .028, z - .04, .02, .025)                                       # 太陽穴
    z += face_disp(x, y, z)
    return Vector((x, y, z))

hb = bm_ell((1, 1, 1), 48, 36)
refine(hb, lambda c: c.normalized().z > .28 and -.86 < c.normalized().y < .5)
refine(hb, lambda c: (lambda d: ((abs(d.x) - .37) / .26) ** 2 + ((d.y - .045) / .17) ** 2 < 1 and d.z > 0)(c.normalized()))
refine(hb, lambda c: (lambda d: abs(d.x) < .36 and -.74 < d.y < -.22 and d.z > 0)(c.normalized()))
for v in hb.verts:
    v.co = head_shape(*v.co)
# 眼球的位置：眼窩表面往前 3.8 mm 是眼球最前緣
_hbvt = BVHTree.FromBMesh(hb)
def _hz(x, y):
    loc, nor, i, d = _hbvt.ray_cast(Vector((x, y, .5)), Vector((0, 0, -1)))
    return loc.z if loc else .08
EZ = _hz(EX, EY) + .0038 - ER
# 眼皮包著眼球：眼球投影範圍內的皮膚推到眼球外 1.6 mm，外面一點是雙眼皮的摺
RL = ER + .0016
for v in hb.verts:
    x, y, z = v.co
    if z < .03:
        continue
    u, w = abs(x) - EX, y - EY
    d = math.hypot(u, w)
    if d < RL:
        ze = EZ + math.sqrt(RL * RL - d * d)
        k = ss(RL, RL * .72, d)
        if ze > z:
            z += (ze - z) * k
    z -= .0011 * g2(u + .001, w - .0088, .011, .0018)
    v.co.z = z
# 輕輕平滑兩次：加密邊界的三角形、鼻翼溝這種急轉的地方不會有鋸齒
bmesh.ops.smooth_vert(hb, verts=[v for v in hb.verts if v.co.z > -.02], factor=.35, use_axis_x=True, use_axis_y=True, use_axis_z=True)
bmesh.ops.smooth_vert(hb, verts=[v for v in hb.verts if v.co.z > -.02], factor=.35, use_axis_x=True, use_axis_y=True, use_axis_z=True)
# 挖眼裂：面中心在杏仁形裡的刪掉，邊界點貼到杏仁形的曲線上、落在眼球表面外 0.3 mm
dead = []
for f in hb.faces:
    c = f.calc_center_median()
    if c.z > .03 and in_eye(abs(c.x) - EX, c.y - EY):
        dead.append(f)
bmesh.ops.delete(hb, geom=dead, context='FACES')
bmesh.ops.delete(hb, geom=[v for v in hb.verts if not v.link_faces], context='VERTS')
for v in hb.verts:
    if v.co.z < .03 or not any(e.is_boundary for e in v.link_edges):
        continue
    u, w = abs(v.co.x) - EX, v.co.y - EY
    u = max(-AW, min(AW, u))
    t, b = lid_top(u), lid_bot(u)
    w = t if w > (t + b) / 2 else b
    d2 = u * u + w * w
    R2 = (ER + .0003) ** 2
    v.co = Vector(((EX + u) * (1 if v.co.x >= 0 else -1), EY + w, EZ + math.sqrt(max(0, R2 - d2))))
head = finish(hb, 'head', 'skin', 0, tuple(HC), var=0)

def skin_tone(p, n):
    q = p - HC
    x, y, z = q
    ax = abs(x)
    fz = ss(.02, .07, z)
    r, g, b = 1.0, 1.0, 1.0
    lip = (math.exp(-(x / .019) ** 4) * math.exp(-((y + .0585) / .0036) ** 2) + math.exp(-(x / .0168) ** 4) * math.exp(-((y + .0708) / .0046) ** 2)) * fz
    lip = min(1.0, lip * 1.15)
    r, g, b = r * (1 - .08 * lip), g * (1 - .3 * lip), b * (1 - .27 * lip)
    ml = math.exp(-(x / .0235) ** 6) * math.exp(-((y + .0648 - .0006 * (x / .02) ** 2) / .0011) ** 2) * fz
    r, g, b = r * (1 - .45 * ml), g * (1 - .5 * ml), b * (1 - .48 * ml)
    red = (g2(x, y + .032, .012, .01) + .8 * sum(g2(x - sx * .046, y + .02, .018, .015) for sx in (1, -1))) * fz
    g, b = g * (1 - .07 * red), b * (1 - .08 * red)
    sock = sum(g2(x - sx * .031, y - .001, .016, .011) for sx in (1, -1)) * fz
    r, g, b = r * (1 - .1 * sock), g * (1 - .14 * sock), b * (1 - .1 * sock)
    crease = sum(g2(x - sx * .031, y - .0135, .012, .0022) for sx in (1, -1)) * fz
    r, g, b = r * (1 - .12 * crease), g * (1 - .14 * crease), b * (1 - .12 * crease)
    nl = sum(g2(x - sx * .03, y + .052, .006, .018) for sx in (1, -1)) * fz
    r, g, b = r * (1 - .06 * nl), g * (1 - .08 * nl), b * (1 - .07 * nl)
    nos = g2(ax - .0072, y + .0452, .0034, .0023) * (1 if n.y < -.1 else .35) * fz
    r, g, b = r * (1 - .7 * nos), g * (1 - .74 * nos), b * (1 - .72 * nos)
    # 眼裂邊：上緣是睫毛線（深色）、下緣粉一點，內眼角偏紅
    u, w = ax - EX, y - EY
    if z > .03 and -AW - .002 < u < AW + .002:
        tt, bb = lid_top(max(-AW, min(AW, u))), lid_bot(max(-AW, min(AW, u)))
        up = math.exp(-((w - tt) / .0011) ** 2) * (1 if w > (tt + bb) / 2 else 0)
        lo = math.exp(-((w - bb) / .0009) ** 2) * (1 if w <= (tt + bb) / 2 else 0)
        r, g, b = r * (1 - .78 * up), g * (1 - .8 * up), b * (1 - .78 * up)
        r, g, b = r * (1 - .02 * lo), g * (1 - .12 * lo), b * (1 - .1 * lo)
        inner = ss(-AW * .55, -AW, u) * (up + lo + .6 * math.exp(-((w - (tt + bb) / 2) / .002) ** 2))
        g, b = g * (1 - .18 * min(1, inner)), b * (1 - .14 * min(1, inner))
    return (r, g, b)
recolor(head, skin_tone)
B_(head, 'head', 'neck', fn=lambda p: {'head': 1.0} if p.y > 1.64 else {'head': ss(1.59, 1.64, p.y) + .01, 'neck': 1 - ss(1.59, 1.64, p.y) + .01})

hbv = BVHTree.FromObject(head, bpy.context.evaluated_depsgraph_get())
def head_z(x, y):
    loc, nor, i, d = hbv.ray_cast(V(x, y, .5), V(0, 0, -1))
    return T(loc).z if loc else HC.z + .08

# 眼球：極點朝前的球，一圈一圈上色成眼白、虹膜（外圈深、內圈亮、放射紋）、瞳孔
for sx in (1, -1):
    ec = Vector((sx * EX, HC.y + EY, HC.z + EZ))
    ebm = bm_ell((ER, ER, ER), 18, 18)
    bmesh.ops.delete(ebm, geom=[f for f in ebm.faces if f.calc_center_median().y < -.25 * ER], context='FACES')    # 後半球看不到
    bmesh.ops.delete(ebm, geom=[v for v in ebm.verts if not v.link_faces], context='VERTS')
    eye = finish(ebm, 'eye', 'fixed', 0xe9e4dc, tuple(ec), rot=(math.pi / 2, 0, 0), var=0)
    def eye_col(p, n, ec=ec, sx=sx):
        d = (p - ec).normalized()
        a = math.degrees(math.acos(max(-1, min(1, d.z))))
        if a < 11:
            return hexrgb(0x0b0908)
        if a < 27:
            ph = math.atan2(d.y, d.x)
            k = .82 + .22 * noise.noise(Vector((ph * 6, a * .3, 0))) + .1 * math.sin(ph * 23)
            c = hexrgb(0x8a6440) if a < 17 else hexrgb(0x5c3f27)
            k *= .55 if a > 24.5 else 1
            return tuple(x * k for x in c)
        side = abs(d.x) * (1 if d.x * sx < 0 else .6)                  # 內眼角那側帶點紅
        return (.9 - .02 * side, .87 - .1 * side, .83 - .1 * side) if a < 70 else (.72, .66, .64)
    recolor(eye, eye_col)
    B_(eye, 'head')
    # 眉毛（頭髮色）：順著眉骨，內側粗、尾巴細
    # 眉毛：貼著眉骨皮膚的一片（沿著眉形取格子，每點打到皮膚上再外推），內側寬、眉尾細
    bb = bmesh.new()
    NU, NV = 18, 4
    G = []
    for i in range(NU + 1):
        t = i / NU
        cx = .011 + t * .043
        cy = .0205 + math.sin(min(1, t * 1.25) * math.pi * .85) * .006 - t * .0045
        hh = .0046 * (1 - t) ** .6 + .0012
        col = []
        for j in range(NV + 1):
            y = cy + hh * (j / NV * 2 - 1) - .0012 * (j / NV * 2 - 1) ** 2 * (1 - t)
            x = sx * cx
            col.append(bb.verts.new((x, HC.y + y, head_z(x, HC.y + y) + .00045 + .0005 * (1 - abs(j / NV * 2 - 1)) - HC.z)))
        G.append(col)
    for i in range(NU):
        for j in range(NV):
            bb.faces.new((G[i][j], G[i + 1][j], G[i + 1][j + 1], G[i][j + 1]))
    brw = finish(bb, 'br', 'hair', 0, (0, 0, HC.z), var=0)
    solid(brw, .0005)
    recolor(brw, lambda p, n: (max(.45, min(1, .8 + .4 * noise.noise(Vector((p.x * 1400, p.y * 260, p.z * 1400))))),) * 3)
    B_(brw, 'head')

# 耳朵：耳甲為中心的極座標網格，耳輪往外捲、對耳輪隆起、耳甲凹下、耳垂較厚；後緣往外張
def ear_bm():
    N, M = 6, 24
    def outline(th):
        c, s = math.cos(th), math.sin(th)
        rx = .019 if c > 0 else .0095
        ry = .026 if s > 0 else .031
        return 1 / math.sqrt((c / rx) ** 2 + (s / ry) ** 2)
    def height(r, th):
        deg = math.degrees(th) % 360
        rimw = 1 - ss(215, 250, deg) * (1 - ss(300, 330, deg))            # 耳垂沒有耳輪
        h = .0042 * math.exp(-((r - .9) / .075) ** 2) * rimw
        h -= .0018 * math.exp(-((r - .74) / .06) ** 2) * rimw               # 耳舟
        anti = 1 - ss(150, 190, deg) * (1 - ss(330, 350, deg))
        h += .0032 * math.exp(-((r - .55) / .08) ** 2) * anti * (1 - ss(200, 230, deg))
        h -= .0055 * max(0, 1 - (r / .4) ** 2)                              # 耳甲
        h += .003 * math.exp(-((r - .78) / .1) ** 2) * math.exp(-((deg - 185) / 18) ** 2)   # 耳屏
        h += .0015 * (1 - rimw) * ss(.3, .7, r)                               # 耳垂
        return h
    bm = bmesh.new()
    rows = []
    for i in range(1, N + 1):
        r = i / N
        row = []
        for j in range(M):
            th = j / M * TAU
            R = outline(th) * r
            s, t = math.cos(th) * R, math.sin(th) * R
            h = height(r, th) + max(0, s) * .38                                # 後緣往外張約 20°
            if r > .96:
                h -= .0012                                                     # 耳輪邊往內捲
            row.append(bm.verts.new((h, t, -s)))
        rows.append(row)
    cen = bm.verts.new((height(0, 0), 0, 0))
    for j in range(M):
        bm.faces.new((cen, rows[0][j], rows[0][(j + 1) % M]))
    for i in range(N - 1):
        for j in range(M):
            bm.faces.new((rows[i][j], rows[i + 1][j], rows[i + 1][(j + 1) % M], rows[i][(j + 1) % M]))
    return bm
for sx in (1, -1):
    _l, _n, _i, _d = _hbvt.ray_cast(Vector((sx * .2, -.005, -.008)), Vector((-sx, 0, 0)))
    ea = add(tuple(HC), ((_l.x - sx * .0025) if _l else sx * .08, -.005, -.008))
    ebm = ear_bm()
    if sx < 0:
        for v in ebm.verts:
            v.co.x = -v.co.x
    ear = finish(ebm, 'ear', 'skin', 0, ea, var=0)
    solid(ear, .0035)
    recolor(ear, lambda p, n, ea=Vector(ea), sx=sx: (.97, .86, .84) if math.hypot((p - ea).y, (p - ea).z) < .012 else (1, .95, .94))
    B_(ear, 'head')

# ── 手套：圓角方形截面的手掌（手背微凸、掌心微凹）、四指各三節（關節處略粗、指尖圓）、拇指兩節與拇指球；
#    袖口、魔鬼氈帶與指節護墊是「gear」部位：顏色跟手套走（壓暗），徒手的人在網頁裡整組收起來 ──
def rsec(c, w, t, n=20, p=3.2, bow=0.0, sx=1):
    """y 固定的圓角方形截面：t 為 x 方向厚度、w 為 z 方向寬度；bow>0 時手背（+sx 側）中間鼓起"""
    pts = []
    for i in range(n):
        a = i / n * TAU
        ca, sa = math.cos(a), math.sin(a)
        x = math.copysign(abs(ca) ** (2 / p), ca) * t / 2
        z = math.copysign(abs(sa) ** (2 / p), sa) * w / 2
        if x * sx > 0:
            x += sx * bow * (1 - (2 * z / w) ** 2)
        pts.append(tuple(c + Vector((x, 0, z))))
    return pts

def hand_bm(sx):
    W = Vector((sx * .305, .905, .006))
    out = []
    C = lambda yo, dz=0.0: W + Vector((-sx * .004, yo, dz))
    out.append(loft('palm', 'glove', 0, [rsec(C(.014), .056, .038, sx=sx), rsec(C(-.012), .066, .035, bow=.002, sx=sx), rsec(C(-.045, .002), .082, .032, bow=.003, sx=sx),
                                        rsec(C(-.078, .001), .086, .029, bow=.0025, sx=sx), rsec(C(-.094), .08, .025, bow=.001, sx=sx)], var=.02))
    # 四指：掌指、近端、遠端三節，關節處略粗；稍微張開、往掌心彎
    for i, (zo, L, spread) in enumerate(((.029, .074, .05), (.0095, .081, .01), (-.0095, .077, -.03), (-.028, .062, -.07))):
        p = W + Vector((-sx * .005, -.092, zo))
        pts, rad = [tuple(p)], [.0092]
        A = 0.0
        for k, (f, c) in enumerate(((.44, .22), (.31, .42), (.25, .34))):
            A += c
            d = Vector((-sx * math.sin(A), -math.cos(A), spread * math.cos(A) + zo * .5 * math.sin(A)))
            mid = p + d.normalized() * L * f * .5
            p = p + d.normalized() * L * f
            pts += [tuple(mid), tuple(p)]
            rad += [(.0086, .0081, .0074)[k], (.0089, .0082, .0071)[k]]
        out.append(limb('fg', 'glove', 0, pts, rad, 10, step=.0065, flat=.9))
        out.append(ell('ft', 'glove', 0, pts[-1], (.0071, .0071, .0071), 8, 5))
        # 指節上的小護墊（gear）
        out.append(ell('kp', 'gear', 0, tuple(W + Vector((sx * .0092, -.092, zo))), (.0032, .0095, .0086), 6, 4))
        recolor(out[-1], lambda p, n: (.86, .86, .86))
    # 拇指：從掌根內側往前下方伸，兩節；拇指球把手掌和拇指接起來
    tp = [W + Vector((-sx * a, b, c)) for (a, b, c) in ((.011, -.034, .026), (.014, -.06, .039), (.018, -.074, .043), (.022, -.087, .044), (.027, -.099, .041))]
    trad = [.0122, .0112, .0102, .0096, .0088]
    out.append(limb('th', 'glove', 0, [tuple(p) for p in tp], trad, 10, step=.0065, flat=.9))
    out.append(ell('tt', 'glove', 0, tuple(tp[-1]), (.0086, .0086, .0086), 8, 6))
    out.append(ell('tpad', 'glove', 0, tuple(W + Vector((-sx * .016, -.035, .018))), (.013, .024, .016), 14, 10))
    # 手背護板（gear，薄、有兩道分節）
    for k in range(2):
        out.append(box('kg', 'gear', 0, tuple(W + Vector((sx * (.0152 - k * .002), -.05 - k * .0165, .003))), (.0034, .0145, .052 - k * .004), .0016, smooth=True))
        recolor(out[-1], lambda p, n: (.9, .9, .9))
    # 袖口：厚一點的鬆緊口 + 魔鬼氈帶
    out.append(lathe('gc', 'gear', 0, [(.04, -.004), (.0445, .002), (.0452, .022), (.0425, .033), (.038, .036)], tuple(W + Vector((0, -.008, 0))), 24, sz=1.04, cap_top=False, cap_bot=False))
    recolor(out[-1], lambda p, n: (.88, .88, .88) if abs(p.y - W.y - .007) > .012 else (1, 1, 1))
    out.append(box('gs', 'gear', 0, tuple(W + Vector((sx * .0445, .004, .004))), (.006, .022, .038), .0025, smooth=True))
    recolor(out[-1], lambda p, n: (.84, .84, .84))
    out.append(box('gsb', 'gear', 0, tuple(W + Vector((sx * .048, .004, .012))), (.003, .012, .012), .0015))
    recolor(out[-1], lambda p, n: (.5, .5, .5))
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
    def boot_col(p, n):
        z, y = p.z - A.z, p.y
        k = 1.0
        cap = .118 + .02 * (abs(p.x - A.x) / .054) ** 2                          # 鞋頭護皮的邊線（往兩側往後彎）
        k *= .82 if z > cap else 1
        k *= 1 - .35 * math.exp(-((z - cap) / .003) ** 2) - .2 * math.exp(-((z - cap - .006) / .0015) ** 2)   # 車縫
        k *= .86 if z < -.045 and y < .105 else 1                               # 後跟包覆
        k *= 1 + (.18 if z > .15 and n.z > .3 else 0)                           # 鞋頭磨亮
        return tuple(x * k for x in hexrgb(BOOT))
    recolor(bt, boot_col)
    B_(bt, fn=boot_w(t))
    BS = lathe('bs', 'fixed', BOOT, [(.058, .09), (.062, .12), (.062, .2), (.066, .215), (.064, .225)], tuple(A + Vector((0, 0, -.008))), 20, cap_bot=False)
    B_(BS, fn=boot_w(t))
    B_(lathe('bpad', 'fixed', 0x3a2818, [(.066, .205), (.07, .21), (.07, .228), (.066, .232)], tuple(A + Vector((0, 0, -.008))), 20, cap_top=False, cap_bot=False), fn=boot_w(t))
    B_(box('so', 'fixed', SOLE, tuple(A + Vector((0, .012, .06))), (.114, .026, .305), .01), fn=boot_w(t))
    B_(box('he', 'fixed', SOLE, tuple(A + Vector((0, .018, -.05))), (.1, .036, .08), .01), fn=boot_w(t))
    B_(box('ws', 'fixed', 0x8a6a3a, tuple(A + Vector((0, .028, .06))), (.117, .006, .3), .003), fn=boot_w(t))
    for i in range(7):
        B_(box('tr', 'fixed', 0x151515, tuple(A + Vector((0, -.001, -.07 + i * .045))), (.1, .005, .018), 0), fn=boot_w(t))
    # 鞋舌與鞋帶：打射線找靴面，鞋舌貼著靴面，鞋帶在兩排鞋眼之間交叉
    bpy.context.view_layer.update()
    _dgb = bpy.context.evaluated_depsgraph_get()
    BV = [BVHTree.FromObject(o, _dgb) for o in (bt, BS)]
    def bz(x, y):
        best = None
        for bv in BV:
            loc, nor, i, d = bv.ray_cast(V(A.x + x, y, .5), V(0, 0, -1))
            if loc is not None and (best is None or T(loc).z > best):
                best = T(loc).z
        return best if best is not None else A.z + .06
    ys = [.212 - i * .019 for i in range(6)]
    tpts = [(A.x, y, bz(0, y) + .0035) for y in ys + [.1]]
    B_(finish(bm_tube(tpts, [.0032] * len(tpts), 10, True, 6.5, up=(1, 0, 0)), 'tg', 'fixed', 0x4a3120, var=.05), fn=boot_w(t))
    EY_ = [[(A.x + s2 * .022, y, bz(s2 * .022, y) + .0028) for y in ys] for s2 in (1, -1)]
    for i in range(len(ys)):
        for s2 in (0, 1):
            e = Vector(EY_[s2][i])
            B_(finish(bm_tube([tuple(e + Vector((0, 0, -.002))), tuple(e + Vector((0, 0, .0015)))], .0034, 6), 'ey', 'fixed', 0xb8a47a, var=0), fn=boot_w(t))
        if i < len(ys) - 1:
            for s2 in (0, 1):
                a, b = Vector(EY_[s2][i]), Vector(EY_[1 - s2][i + 1])
                m = (a + b) / 2 + Vector((0, 0, .0045))
                B_(tube('la', 'fixed', 0xd8c9a0, [tuple(a), tuple(m), tuple(b)], .0021, 6, var=.05), fn=boot_w(t))

    B_(box('pt', 'fixed', 0x3a2818, tuple(A + Vector((0, .2, -.07))), (.022, .04, .006), .002), 'shin' + t)

BODYOB = join(BODY, 'W_body')
smooth_by_angle(BODYOB, 55)
# 臉上的嘴縫、鼻孔、眼皮這些急轉處不要被角度判成硬邊：頭部一律平滑法線
_sh = BODYOB.data.attributes.get('sharp_edge')
if _sh is not None:
    _vs = BODYOB.data.vertices
    for e in BODYOB.data.edges:
        if _sh.data[e.index].value and all((T(_vs[i].co) - HC).length < .135 and T(_vs[i].co).y > 1.595 for i in e.vertices):
            _sh.data[e.index].value = False
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
    preview(os.path.join(prev, 'w_heads.png'), (0, 1.68, 0), .6, 90, 0)
    preview(os.path.join(prev, 'w_head3.png'), (0, 1.68, 0), .55, 35, 8)
    preview(os.path.join(prev, 'w_eye.png'), (.031, 1.705, .09), .16, 15, 5)
    preview(os.path.join(prev, 'w_mouth.png'), (0, 1.655, .1), .2, 30, -5)
    preview(os.path.join(prev, 'w_ear.png'), (.08, 1.695, 0), .22, 80, 5)
    preview(os.path.join(prev, 'w_hand.png'), (.3, .85, .0), .55, 40, 5)
    preview(os.path.join(prev, 'w_handb.png'), (.3, .84, .0), .3, 95, 5)
    preview(os.path.join(prev, 'w_handp.png'), (-.3, .84, .0), .3, 80, 5)
    preview(os.path.join(prev, 'w_handf.png'), (.3, .84, .0), .3, 10, 5)
    preview(os.path.join(prev, 'w_boot.png'), (.1, .12, .05), .9, 40, 20)
    preview(os.path.join(prev, 'w_vest.png'), (0, 1.25, 0), .8, 20, 8)
    preview(os.path.join(prev, 'w_vestb.png'), (0, 1.25, 0), .8, 160, 8)
    preview(os.path.join(prev, 'w_shoulder.png'), (.12, 1.42, 0), .45, 50, 35)
    preview(os.path.join(prev, 'w_legs.png'), (0, .6, 0), 1.3, 25, 5)
    preview(os.path.join(prev, 'w_elbow.png'), (.26, 1.15, 0), .5, 20, 5)
    preview(os.path.join(prev, 'w_kneeb.png'), (.1, .45, 0), .6, 160, 5)
    preview(os.path.join(prev, 'w_waist.png'), (0, 1.05, 0), .6, 30, 5)
    preview(os.path.join(prev, 'w_ankle.png'), (.1, .25, 0), .5, 30, 5)
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
    # 下緣停在下顎線（下巴前面低一點），不要包到下巴底下，側面看才不會像一塊楔子
    return q.z > -.04 and a < 100 and (q.y < -.05 - max(0, a - 50) * .0005) and q.y > -.102 - .014 * ss(.02, .08, q.z) and not mouth_hole(q)
def stache(e):
    pts = []
    for i in range(9):
        t = i / 8 * 2 - 1
        x = t * .026
        y = HC.y - .054 - abs(t) ** 1.6 * .014
        pts.append((x, y, head_z(x, y) + e))
    m = tube('ms', 'hair', 0, pts, [.0016, .0028, .0036, .0039, .0035, .0039, .0036, .0028, .0016], 8, flat=.8)
    recolor(m, strand_col)
    return m
bm = head_shell(.0024, beard_keep, amp=.0008, freq=120)       # 短鬍子：薄薄一層貼著下巴
b1 = finish(bm, 'beard', 'hair', 0, var=0)
solid(b1, .0012)
recolor(b1, strand_col)
variant('BEARD_1', [b1, stache(.0012)])
variant('BEARD_2', [stache(.0012)])
bm = head_shell(.005, lambda q: abs(q.x) < .026 - max(0, q.y + .09) * .2 and -.122 < q.y < -.076 and q.z > 0, amp=.002, freq=90)
b3 = finish(bm, 'goat', 'hair', 0, var=0)
solid(b3, .002)
recolor(b3, strand_col)
variant('BEARD_3', [b3, stache(.0012)])

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


# ───────── 第一人稱手臂（每把槍各一組，原點 = 槍的原點，網頁直接掛在槍上）─────────
# 手套跟第三人稱的工人同一套比例：圓角截面的手掌、四指三節、拇指兩節與拇指球、指節護墊、手背護板、袖口與魔鬼氈（gear）。
# 手掌先貼到握把或護木旁邊，手指再像真的握東西一樣一節一節往內彎，碰到槍的表面就停（槍的網格做成 BVH 來量距離），
# 前臂朝「鏡頭座標」裡固定的手肘方向伸出去，每把槍的瞄準距離不同，手肘在畫面上的位置還是一樣。
VMEYE = {'m416': (.1, .16, .34), 'ump': (.082, 0, .3), 'kar98': (.1, -.152, .08), 's686': (.062, .1, .5)}   # 同網頁 SIGHT 的 y、z、d（改了要兩邊一起改）
GUNOX = {'m416': 0, 'ump': .8, 'kar98': 1.8, 's686': 2.6}
D_ = math.radians
def eye_dir(gid, c):
    """鏡頭座標（x 右、y 上、z 往後）的方向 → 槍的座標（槍口 +z、槍的左邊 +x）"""
    return Vector((-c[0], c[1], -c[2])).normalized()

def gun_bvh(gid):
    vs, fs = [], []
    for nm, off in (('G_' + gid, (GUNOX[gid], 1, -4)), ('M_' + gid, (GUNOX[gid], 1, -4.6))):
        ob = bpy.data.objects.get(nm)
        if ob is None:
            continue
        mw, b, o = ob.matrix_world, len(vs), Vector(off)
        vs += [T(mw @ v.co) - o for v in ob.data.vertices]
        fs += [tuple(b + i for i in p.vertices) for p in ob.data.polygons]
    return BVHTree.FromPolygons(vs, fs)

def gdist(bv, p):
    """到槍表面的距離；在槍裡面是負的"""
    loc, nor, i, d = bv.find_nearest(p)
    if loc is None:
        return 1.0
    return -d if (p - loc).dot(nor) < 0 else d

# 手的座標 (a, b, c)：a 手腕→指根、b 往拇指那側、c 手背；Hand.g() 轉成槍的座標
FINGERS = (  # 指根 (a, b, c)、往拇指側張開的角度、三節長度、每節頭尾半徑
    ((.088, .0265, .001), .07, (.042, .025, .019), ((.0098, .0093), (.009, .0085), (.0083, .0075))),
    ((.092, .0085, .002), .015, (.046, .028, .02), ((.01, .0095), (.0092, .0086), (.0084, .0076))),
    ((.089, -.0105, .001), -.04, (.043, .027, .02), ((.0096, .0091), (.0089, .0083), (.0081, .0074))),
    ((.081, -.0275, -.002), -.11, (.034, .021, .017), ((.0088, .0083), (.0081, .0076), (.0074, .0068))),
)
THUMB = ((.016, .024, -.013), (.032, .03, .025), ((.0118, .0109), (.0107, .0099), (.0095, .0086)))

class Hand:
    def __init__(self, gid, right, F, D, W):
        self.gid, self.right, self.bv = gid, right, gun_bvh(gid)
        F, D = Vector(F).normalized(), Vector(D)
        D = (D - F * D.dot(F)).normalized()
        self.F, self.D = F, D
        self.B = D.cross(F) if right else F.cross(D)       # 拇指那側
        self.W = Vector(W)
        self.ymax, self.cup = 9.0, 0.0      # ymax：手指不要越過的高度（托住細的護木時指尖停在側面上緣）
    def g(self, p):
        return self.W + self.F * p[0] + self.B * p[1] + self.D * p[2]
    def gv(self, v):
        return self.F * v[0] + self.B * v[1] + self.D * v[2]

def palm_secs(cup=0.0):
    """手掌截面（手的座標）：手腕到指根，手背微凸；cup 是手掌往掌心捲的曲率（握圓的東西時兩側包過去）"""
    out = []
    for (a, w, t, bow, bc) in ((-.014, .058, .04, 0, 0), (.004, .064, .037, .0015, .001), (.03, .077, .034, .0025, .002), (.058, .085, .031, .003, .001), (.082, .087, .029, .0025, -.001), (.097, .08, .025, .001, -.002)):
        pts = []
        for i in range(22):
            q = i / 22 * TAU
            cq, sq = math.cos(q), math.sin(q)
            c = math.copysign(abs(cq) ** (2 / 3.2), cq) * t / 2
            b = math.copysign(abs(sq) ** (2 / 3.2), sq) * w / 2
            if c > 0:
                c += bow * (1 - (2 * b / w) ** 2)
            pts.append((a, b + bc, c - cup * (b + bc) ** 2 / 2 * ss(-.02, .03, a)))
        out.append(pts)
    return out

def place(bm, c, X, Y, Z, name, role, color=0, var=0.0):
    """bmesh 的局部座標 (x, y, z) 對到 c + X·x + Y·y + Z·z（槍的座標）"""
    for v in bm.verts:
        q = Vector(v.co)
        v.co = c + X * q.x + Y * q.y + Z * q.z
    return finish(bm, name, role, color, var=var)

def chain(base, d0, k, L, th):
    """一根手指的關節點：每個關節繞 k 軸往掌心彎 th[j]"""
    pts, p, A = [Vector(base)], Vector(base), 0.0
    for j in range(len(L)):
        A += th[j]
        p = p + Matrix.Rotation(A, 3, k) @ d0 * L[j]
        pts.append(p.copy())
    return pts

def fillet(pts, rads, rr=.006, n=3):
    """關節處用小圓弧接起來（不然管子在折角會被擠扁）；半徑跟著插值"""
    P, R = [pts[0]], [rads[0][0]]
    for j in range(1, len(pts) - 1):
        a, b, c = pts[j - 1], pts[j], pts[j + 1]
        r = min(rr, (b - a).length * .4, (c - b).length * .4)
        p0, p1 = b + (a - b).normalized() * r, b + (c - b).normalized() * r
        P.append(p0); R.append(rads[j - 1][1])
        for i in range(1, n):
            t = i / n
            P.append(p0 * (1 - t) ** 2 + b * 2 * t * (1 - t) + p1 * t * t); R.append(rads[j - 1][1] * (1 - t) + rads[j][0] * t + .0006 * math.sin(t * math.pi))
        P.append(p1); R.append(rads[j][0])
    P.append(pts[-1]); R.append(rads[-1][1])
    return P, R

def seg_hit(H, pts, rads, j0, gap, skip0=0.0):
    """哪一節最先碰到槍（第 j 節的取樣點離表面小於半徑＋間隙）；skip0：第一節靠根部埋在手掌裡的比例不算"""
    for j in range(j0, len(pts) - 1):
        a, b = H.g(pts[j]), H.g(pts[j + 1])
        n = max(2, int((b - a).length / .0025))
        for i in range(n + 1):
            t = i / n
            if j == 0 and t < skip0:
                continue
            r = rads[j][0] * (1 - t) + rads[j][1] * t
            q = a.lerp(b, t)
            if gdist(H.bv, q) < r + gap or q.y > H.ymax:
                return j
    return None

def grasp(H, base, d0, k, L, rads, th0, vel, mx, gap=.002, skip0=0.0):
    """像機械手一樣握：每個關節以各自的速度彎，某一節碰到槍就停住它和它之前的關節，後面的繼續彎"""
    th, act = list(th0), [True] * len(L)
    for it in range(240):
        if not any(act):
            break
        prev = th[:]
        for j in range(len(L)):
            if act[j]:
                th[j] = min(mx[j], th[j] + math.radians(.75) * vel[j])
                if th[j] >= mx[j]:
                    act[j] = False
        hit = seg_hit(H, chain(base, d0, k, L, th), rads, 0, gap, skip0)
        if hit is not None:
            th = prev
            for j in range(hit + 1):
                act[j] = False
    return th

def flexax(d0, toward):
    """d0 往 toward 方向彎時的旋轉軸（正角度就是往那邊彎）"""
    return d0.cross(toward).normalized()

def vm_hand(H, pose):
    """回傳手（手套）的物件清單；pose：每根手指的起始角、速度、上限，拇指的方向"""
    o = []
    cup = pose.get('cup', 0.0)
    secs = [[tuple(H.g(p)) for p in s] for s in palm_secs(cup)]
    o.append(loft('vpalm', 'glove', 0, secs, var=.02))
    recolor(o[-1], lambda p, n: (.93, .93, .93) if n.dot(H.D) < -.55 else None)      # 掌心的補強皮比較深
    for fi, (base, sp, L, rads) in enumerate(FINGERS):
        base = (base[0], base[1], base[2] - cup * base[1] ** 2 / 2)
        sp *= pose.get('spread', .45)          # 握東西時手指併攏
        d0 = Vector((math.cos(sp), math.sin(sp), 0))
        k = flexax(d0, Vector((0, 0, -1)))
        th0, vel, mx = pose['f'][fi]
        # 伸直時就碰到槍（扣扳機的食指常這樣）：往上下擺開一點再握
        for ds in [0] + [x * D_(2) * sg for x in range(1, 16) for sg in (-1, 1)]:
            d1 = Matrix.Rotation(ds, 3, Vector((0, 0, 1))) @ d0
            k1 = flexax(d1, Vector((0, 0, -1)))
            if seg_hit(H, chain(Vector(base), d1, k1, L, th0), rads, 0, .001, .25) is None:
                d0, k = d1, k1
                break
        th = grasp(H, Vector(base), d0, k, L, rads, th0, vel, mx)
        # 關節的圓弧比折線更靠內側：整根手指稍微張開，直到圓弧也不碰到槍
        for it in range(25):
            P, R = fillet(chain(Vector(base), d0, k, L, th), rads)
            m = 1.0
            for j in range(len(P) - 1):
                n = max(1, int((P[j + 1] - P[j]).length / .002))
                m = min([m] + [gdist(H.bv, H.g(P[j].lerp(P[j + 1], i / n))) - (R[j] + (R[j + 1] - R[j]) * i / n) for i in range(n + 1)])
            if m > .0008:
                break
            th = [max(0.0, t - D_(1)) for t in th]
        pts = chain(Vector(base), d0, k, L, th)
        P, R = fillet(pts, rads)
        Pg = [H.g(p) for p in P]
        up = H.gv(Matrix.Rotation(th[0] * .5, 3, k) @ Vector((0, 0, 1)))
        o.append(finish(bm_tube([tuple(p) for p in Pg], R, 8, True, .9, up=tuple(up)), 'vf', 'glove', 0, var=.02))
        # 指節的折痕：關節處掌心那面壓暗
        J = [H.g(p) for p in pts[1:3]]
        recolor(o[-1], lambda p, n, J=J: (.8, .8, .8) if any((p - q).length < .0075 and n.dot(H.D) < 0 for q in J) else None)
        tip = H.g(pts[-1])
        o.append(ell('vft', 'glove', 0, tuple(tip), (rads[2][1], rads[2][1], rads[2][1]), 8, 4))
        # 近端指節上的護墊（gear）
        mid = H.g(pts[0].lerp(pts[1], .45))
        dn = H.gv(Matrix.Rotation(th[0], 3, k) @ Vector((0, 0, 1)))
        dl = H.gv(Matrix.Rotation(th[0], 3, k) @ d0)
        pad = finish(bm_tube([tuple(mid - dl * .011 + dn * rads[0][0] * .82), tuple(mid + dl * .011 + dn * rads[0][0] * .82)], .0042, 8, True, .55, up=tuple(dn)), 'vkp', 'gear', 0, var=0)
        recolor(pad, lambda p, n: (.86, .86, .86))
        o.append(pad)
        # 指根的指節（手背上鼓起一點）
        o.append(ell('vkn', 'glove', 0, tuple(H.g(Vector(base) + Vector((-.003, 0, .0045)))), (.009, .009, .007), 6, 4))
    # 拇指：掌根內側的拇指球 + 兩節，往食指那側彎
    tb, tL, trad = THUMB
    td = Vector(pose['td']).normalized()
    if pose.get('tgt'):          # 拇指指向槍上的一個點（槍的座標）
        q = Vector(pose['tgt']) - H.W
        td = (Vector((q.dot(H.F), q.dot(H.B), q.dot(H.D))) - Vector(tb)).normalized()
    tk = flexax(td, Vector(pose.get('tt', (.2, -.5, -.8))))
    th0, vel, mx = pose['t']
    # 起始姿勢就碰到槍的話，把拇指往外張開（繞彎曲軸反方向轉）直到離開
    for i in range(30):
        if seg_hit(H, chain(Vector(tb), td, tk, tL, th0), trad, 0, .0015, .45) is None:
            break
        td = Matrix.Rotation(-D_(3), 3, tk) @ td
        tk = flexax(td, Vector(pose.get('tt', (.2, -.5, -.8))))
    tth = grasp(H, Vector(tb), td, tk, tL, trad, th0, vel, mx, skip0=.45)
    tp = chain(Vector(tb), td, tk, tL, tth)
    P, R = fillet(tp, trad)
    o.append(finish(bm_tube([tuple(H.g(p)) for p in P], R, 10, True, .92, up=tuple(H.gv(Vector((0, 0, 1))))), 'vth', 'glove', 0, var=.02))
    o.append(ell('vtt', 'glove', 0, tuple(H.g(tp[-1])), (trad[2][1],) * 3, 8, 6))
    # 拇指球：從掌根鼓到拇指第一節，長軸跟著拇指的掌骨
    ax = H.gv(tp[1] - Vector(tb)).normalized()
    ay = H.D.cross(ax).normalized()
    az = ax.cross(ay)
    tc = H.g((Vector(tb) + tp[1]) * .5 + Vector((-.006, -.005, .002)))
    o.append(place(bm_ell((.026, .015, .012), 12, 8), tc, ax, ay, az, 'vtp', 'glove'))
    # 手背護板（gear，兩片分節）
    for kk in range(2):
        c = H.g((.05 + kk * .0175, .002, .0175 - kk * .0015))
        bb = place(bm_box((.0145, .052 - kk * .004, .0034), .0016, 1), c, H.F, H.B, H.D, 'vkg', 'gear')
        recolor(bb, lambda p, n: (.9, .9, .9))
        o.append(bb)
    return o

def eye_pt(gid, c):
    """鏡頭座標的點 → 槍的座標"""
    y, z, d = VMEYE[gid]
    return Vector((-c[0], y + c[1], z - d - c[2]))

def vm_forearm(H, gid, edir, shoulder, length=.27, seed=0):
    """手套袖口（gear＋魔鬼氈）、工作服袖子（袖口、扣子、往上堆的褶子）；edir：鏡頭座標的手肘方向"""
    o = []
    Wc = H.g((-.008, 0, .0))
    u = eye_dir(gid, edir)
    # 前臂截面的「手背」方向：手背法線去掉沿前臂的分量
    nd = (H.D - u * H.D.dot(u)).normalized()
    sd = u.cross(nd).normalized()
    def ring(s, r, n, fn=None, flat=.9):
        c = Wc + u * s
        pts = []
        for i in range(n):
            q = i / n * TAU
            rr = r + (fn(s, q) if fn else 0)
            pts.append(tuple(c + nd * math.cos(q) * rr * flat + sd * math.sin(q) * rr))
        return pts
    # 手套的長袖口：從手腕包到前臂，末端塞進袖子
    gc = [ring(s, r, 24) for (s, r) in ((-.012, .036), (.0, .04), (.016, .0435), (.034, .0445), (.05, .0435))]
    o.append(loft('vgc', 'gear', 0, gc, var=.02, cap=False))
    recolor(o[-1], lambda p, n: (.85, .85, .85) if abs((p - Wc).dot(u) - .002) < .0035 else (.9, .9, .9))
    # 魔鬼氈帶（手背那側）
    vs = Wc + u * .02 + nd * .0445
    vb = place(bm_box((.006, .026, .034), .0025, 1), vs, nd, sd, u, 'vgs', 'gear')
    recolor(vb, lambda p, n: (.78, .78, .78))
    o.append(vb)
    # 袖子：袖口一圈布邊（雙車縫）＋往手肘逐漸變粗的袖管，袖口上方堆幾圈褶子、前臂有斜的拉扯褶
    def folds(s, q):
        d = 0.0
        w = ss(.06, .075, s) * ss(.15, .1, s)
        d += .0032 * w * math.sin((s - .06) * 160 + math.sin(q * 2 + seed) * 1.6 + q * .5)
        d += .0024 * ss(.08, .13, s) * (abs(math.cos(q * 1.5 + s * 22 + seed + noise.noise(Vector((s * 30, q, seed))) * 1.2)) - .55)
        d += .0015 * noise.noise(Vector((math.cos(q) * 3, math.sin(q) * 3, s * 40 + seed)))
        return d
    cu = [ring(s, r, 28) for (s, r) in ((.026, .0455), (.028, .0485), (.034, .05), (.06, .05), (.066, .0485), (.068, .046))]
    cuo = loft('vcu', 'shirt', 0, cu, var=.02, cap=False)
    recolor(cuo, lambda p, n: (.8, .8, .8) if any(abs((p - Wc).dot(u) - s0) < .0018 for s0 in (.031, .063)) else (.97, .97, .97))
    o.append(cuo)
    # 袖口開衩上的扣子
    bt = Wc + u * .046 - sd * .0505 + nd * .012
    o.append(finish(bm_tube([tuple(bt - sd * .0015), tuple(bt + sd * .003)], .0055, 10), 'vbt', 'fixed', 0x2e2b26, var=0))
    sl = []
    S = [.062 + i * .0104 for i in range(10)] + [.17 + i * .025 for i in range(int((length - .1) / .025))]     # 袖口附近（離鏡頭近、褶子多）密一點
    for s in S:
        r = .048 + .008 * ss(.06, length, s)
        sl.append(ring(s, r, 20, folds))
    sv = loft('vs', 'shirt', 0, sl, var=.03, cap=True)
    # 袖子下面的接縫：一條壓暗的線＋兩邊車縫
    recolor(sv, lambda p, n: (.78, .78, .78) if abs(n.dot(sd) + .97) < .02 or (n.dot(sd) < -.9 and abs((p - Wc).dot(nd)) < .004) else None)
    o.append(sv)
    # 上臂：從手肘往鏡頭後下方的肩膀，到眼睛後面 3 cm 就截斷封口（再後面永遠看不到）；袖管末端不會在畫面邊緣露出空心的切口
    E, Sh = Wc + u * (S[-1] - .012), eye_pt(gid, shoulder)
    zc = eye_pt(gid, (0, 0, .03)).z
    if Sh.z < zc < E.z:
        Sh = E.lerp(Sh, (E.z - zc) / (E.z - Sh.z))
    o.append(finish(bm_tube([tuple(E), tuple(E.lerp(Sh, .5)), tuple(Sh)], [.054, .058, .06], 14, True, .92, up=tuple(nd)), 'vua', 'shirt', 0, var=.03))
    return o

FCL = ((D_(4), D_(6), D_(4)), (1.0, 1.15, .8), (D_(100), D_(105), D_(75)))     # 一般手指：起始角、速度、上限
def grip_r(gid, gc, r=.35, back=.07, up=-.016, yaw=0.0, tgt=None, roll=0.0):
    """右手握握把（手槍握把或槍托的握頸）：手掌貼右側面、四指從下前方繞到左側、食指伸進護弓扣扳機、拇指從後上方繞到左側；
    r 是手掌往下斜的角度（手槍握把 0.35，步槍握頸更斜）"""
    F = Vector((math.sin(yaw), -math.sin(r) * math.cos(yaw), math.cos(r) * math.cos(yaw)))     # yaw>0：手腕離槍身遠一點（槍托的握頸比較粗、手腕要在外側）
    H = Hand(gid, True, F, (-math.cos(roll), math.sin(roll), 0), Vector(gc) + F * -back + Vector((0, math.cos(r), math.sin(r))) * up + Vector((-.036, 0, 0)))     # roll>0：手背轉向上（從眼睛看得到指節）
    H.cup = 4
    return H, {'cup': 4, 'f': [((D_(2), D_(8), D_(4)), (.25, 1.0, .8), (D_(14), D_(60), D_(40))), FCL, FCL, FCL], 'td': (.45, .55, -.7), 'tgt': tgt, 'tt': (.3, -.2, -.9), 't': ((0, D_(5), D_(5)), (1, 1, .8), (D_(35), D_(50), D_(45)))}
def guard_l(gid, c, F=(-.8, .1, .55), D=(.15, -.98, .2), back=.05, cup=18, ymax=9.0, tgt=None):
    """左手托住木頭護木：手掌在左下方，四指從下面繞到右側，拇指沿著左側往前；ymax 讓指尖停在護木側面的上緣"""
    H = Hand(gid, False, F, D, Vector(c))
    H.W = Vector(c) + H.D * .07 - H.F * back
    H.cup, H.ymax = cup, ymax
    return H, {'cup': cup, 'f': [FCL] * 4, 'td': (.75, .62, -.15), 'tgt': tgt, 'tt': (.1, -.3, -.9), 't': ((0, D_(4), D_(4)), (.6, 1, .8), (D_(25), D_(40), D_(35)))}
def settle(H):
    """手掌沿 −D 靠過去，直到離槍 1.5 mm"""
    pts = [Vector(p) for s in palm_secs(H.cup) for p in s]
    while min(gdist(H.bv, H.g(p)) for p in pts) < .006:
        H.W = H.W + H.D * .002
    for i in range(400):
        W1 = H.W - H.D * .0005
        H2 = H.W
        H.W = W1
        if min(gdist(H.bv, H.g(p)) for p in pts) < .0015:
            H.W = H2
            break
    return H
EDIR = {'R': (.5, -.62, .6), 'L': (-.55, -.68, .48)}       # 鏡頭座標的手肘方向：右手往右下後、左手往左下後
SHOULDER = {'R': (.2, -.24, .12), 'L': (-.2, -.26, .1)}    # 鏡頭座標的肩膀
VMPOSE = {
    'm416': (grip_r('m416', (0, -.09, -.012), roll=.3, tgt=(.03, -.052, -.056)), guard_l('m416', (0, .016, .33), D=(.55, -.8, .15), tgt=(.05, .03, .43))),
    'ump': (grip_r('ump', (0, -.09, -.03), roll=.3, tgt=(.032, -.085, -.068)), guard_l('ump', (0, -.02, .262), D=(.55, -.8, .15), tgt=(.04, .01, .34))),
    'kar98': (grip_r('kar98', (0, -.04, -.115), .65, yaw=.35, roll=.4, tgt=(.03, .028, -.125)), guard_l('kar98', (0, -.006, .13), ymax=.012, tgt=(.03, .004, .21))),
    's686': (grip_r('s686', (0, -.035, -.085), .6, yaw=.35, roll=.45, tgt=(.03, .022, -.095)), guard_l('s686', (0, -.006, .3), ymax=.006, tgt=(.03, .0, .38))),
}
VMS = []
for gid, ((HR, PR), (HL, PL_)) in VMPOSE.items():
    for (H, P, side) in ((HR, PR, 'R'), (HL, PL_, 'L')):
        settle(H)
        objs = vm_hand(H, P) + vm_forearm(H, gid, EDIR[side], SHOULDER[side])
        if os.environ.get('VMDEV'):
            for ob in objs:
                bpy.context.view_layer.update()
                ds = [gdist(H.bv, T(ob.matrix_world @ v.co)) for v in ob.data.vertices]
                if min(ds) < -.0005:
                    print('  clip', gid, side, ob.name, sum(1 for d in ds if d < -.0005), 'min %.4f' % min(ds))
        nm = 'VM_' + side + ('' if gid == 'm416' else '_' + gid)
        o = join(orient_all(objs), nm)
        smooth_by_angle(o, 50)
        origin_to(o, (0, 0, 0))
        move(o, (GUNOX[gid], 1, -4))
        OUT.append(o); VMS.append(o)
        print('vm', nm, 'tris', tri_count([o]))

def vm_clip_report():
    for o in VMS:
        gid = next((g for g in GUNOX if o.name.endswith('_' + g)), 'm416')
        bv, off = gun_bvh(gid), Vector((GUNOX[gid], 1, -4))
        ds = [gdist(bv, T(o.matrix_world @ v.co) - off) for v in o.data.vertices]
        print('vmclip', o.name, 'inside', sum(1 for d in ds if d < -.0005), 'min %.4f' % min(ds))

def vm_cam(path, gid, pos, look, vfov, res=(960, 600)):
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_WORKBENCH'
    sc.display.shading.light = 'STUDIO'
    sc.display.shading.color_type = 'VERTEX'
    sc.display.shading.show_shadows = False
    sc.render.resolution_x, sc.render.resolution_y = res
    cam = bpy.data.objects.get('VmCam')
    if not cam:
        cam = bpy.data.objects.new('VmCam', bpy.data.cameras.new('VmCam'))
        sc.collection.objects.link(cam)
    off = Vector((GUNOX[gid], 1, -4))
    cam.location = V(*(Vector(pos) + off))
    d = (V(*(Vector(pos) + Vector(look) + off)) - cam.location).normalized()
    cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    cam.data.sensor_fit = 'VERTICAL'
    cam.data.angle = math.radians(vfov)
    cam.data.clip_start = .005
    sc.camera = cam
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)
    sc.render.engine = 'CYCLES'

VMDEV = os.environ.get('VMDEV')
if VMDEV:
    os.makedirs(VMDEV, exist_ok=True)
    vm_clip_report()
    tint_roles([o for o in OUT if o.type == 'MESH' and o.name.startswith(('VM_', 'G_', 'M_'))], dict(DEMO, glove=0x9c8460, shirt=0x3d6468))
    ZOOM = {'m416': 1.45, 'ump': 1.35, 'kar98': 1.25, 's686': 1.2}
    for gid in VMPOSE:
        y, z, d = VMEYE[gid]
        e = (0, y, z - d)
        vm_cam(os.path.join(VMDEV, gid + '-ads.png'), gid, e, (0, 0, 1), 72 / ZOOM[gid])
        vm_cam(os.path.join(VMDEV, gid + '-wide.png'), gid, e, (0, -.35, 1), 100)
        vm_cam(os.path.join(VMDEV, gid + '-right.png'), gid, (-.55, -.05, .12), (1, 0, 0), 45)
        vm_cam(os.path.join(VMDEV, gid + '-left.png'), gid, (.55, -.05, .12), (-1, 0, 0), 45)
        vm_cam(os.path.join(VMDEV, gid + '-below.png'), gid, (.25, -.55, .5), (-.25, .5, -.35), 50)
        vm_cam(os.path.join(VMDEV, gid + '-front.png'), gid, (0, -.05, .95), (0, 0, -1), 40)
        vm_cam(os.path.join(VMDEV, gid + '-eye75.png'), gid, e, (0, -.25, 1), 75)
        for side, (HH, PP) in zip('RL', VMPOSE[gid]):
            c = HH.g((.07, 0, 0))
            for k, dv in (('xn', Vector((-1, 0, 0))), ('xp', Vector((1, 0, 0))), ('yn', Vector((0, -1, .001))), ('zp', Vector((0, 0, 1))), ('zn', Vector((.0, .0, -1)))):
                vm_cam(os.path.join(VMDEV, gid + '-' + side + k + '.png'), gid, tuple(c + dv * .4), tuple(-dv), 36, (640, 480))
    sys.exit(0)

# ───────── 烘焙、遠距離用的低面數身體、匯出 ─────────
print('tris', tri_count([o for o in OUT if o.type == 'MESH']))
SAMPLES = int(os.environ.get('SAMPLES', '32'))
for o in VARIANTS + VMS:
    o.hide_render = True
_col0 = np.zeros(len(BODYOB.data.vertices) * 4, dtype=np.float32)
BODYOB.data.color_attributes['Col'].data.foreach_get('color', _col0)
ao_bake(BAKE, samples=SAMPLES)
# 縫線、滾邊離布面不到 1 mm，烘出來被布面遮得很黑（看起來像割開的黑縫）：改用旁邊布面的遮蔽量
def welt_ao(ob, c0):
    from mathutils import kdtree
    g = ob.vertex_groups.get('welt')
    me = ob.data
    c1 = np.zeros_like(c0)
    me.color_attributes['Col'].data.foreach_get('color', c1)
    c0, c1 = c0.reshape(-1, 4), c1.reshape(-1, 4)
    k = c1[:, 0] / np.maximum(c0[:, 0], 1e-4)
    isw = np.zeros(len(me.vertices), dtype=bool)
    for v in me.vertices:
        isw[v.index] = any(e.group == g.index for e in v.groups)
    kd = kdtree.KDTree(int((~isw).sum()))
    for v in me.vertices:
        if not isw[v.index]:
            kd.insert(v.co, v.index)
    kd.balance()
    for i in np.nonzero(isw)[0]:
        near_k = [k[j] for (co, j, d) in kd.find_n(me.vertices[i].co, 6)]
        c1[i, :3] = c0[i, :3] * max(near_k)
    me.color_attributes['Col'].data.foreach_set('color', c1.ravel())
welt_ao(BODYOB, _col0)
for o in VARIANTS:
    o.hide_render = False
    ao_bake([o], samples=SAMPLES)
    o.hide_render = True
# 第一人稱手臂一組一組烘：只跟自己的槍互相遮（手指貼著槍的地方會暗），槍本身不會被手臂壓暗
for o in VMS:
    o.hide_render = False
    ao_bake([o], samples=SAMPLES)
    o.hide_render = True
for o in VARIANTS + VMS:
    o.hide_render = False
# 低面數身體：同一副骨架與權重，面數約 1/5（60 m 外換成它）
LOD = BODYOB.copy(); LOD.data = BODYOB.data.copy(); LOD.name = 'W_lod'; LOD.data.name = 'W_lod'
bpy.context.scene.collection.objects.link(LOD)
for m in list(LOD.modifiers):
    LOD.modifiers.remove(m)
# 縫線與滾邊只給近距離：遠距離的身體先刪掉它們再減面（細條減面後會變成尖刺）
def drop_welt(ob, delete):
    g = ob.vertex_groups.get('welt')
    if g is None:
        return
    if delete:
        bm = bmesh.new(); bm.from_mesh(ob.data)
        dl = bm.verts.layers.deform.active
        bmesh.ops.delete(bm, geom=[v for v in bm.verts if g.index in v[dl]], context='VERTS')
        bm.to_mesh(ob.data); bm.free(); ob.data.update()
    ob.vertex_groups.remove(g)
drop_welt(LOD, True)
drop_welt(BODYOB, False)
dm = LOD.modifiers.new('Dec', 'DECIMATE'); dm.ratio = min(float(os.environ.get('LODR', '.2')), 8400 / tri_count([LOD]))
for o in bpy.context.view_layer.objects:
    o.select_set(False)
LOD.select_set(True); bpy.context.view_layer.objects.active = LOD
bpy.ops.object.modifier_apply(modifier='Dec')
LOD.data.validate(clean_customdata=False)          # 減面後偶爾留下退化的面，匯出前清掉（不然 glTF 匯出會警告網格無效）
LOD.parent = RIG
am = LOD.modifiers.new('Armature', 'ARMATURE'); am.object = RIG
OUT.append(LOD)
print('lod tris', tri_count([LOD]), 'body tris', tri_count([BODYOB]))
# 蒙皮身體（W_body、W_lod）的權重與頂點色改存 8 位元（glTF 核心規格允許 UNSIGNED_BYTE normalized）：權重每個頂點從 16 bytes 降到 4 bytes，
# 四個權重加起來剛好 255；頂點色（烘焙的遮蔽）從 8 bytes 降到 4 bytes。網頁 mergeSkin 讀的時候會換回浮點數
def quantize_weights(path):
    import struct, json
    b = open(path, 'rb').read()
    jl = struct.unpack_from('<I', b, 12)[0]
    J = json.loads(b[20:20 + jl])
    BIN = b[28 + jl:28 + jl + struct.unpack_from('<I', b, 20 + jl)[0]]
    uses = {}
    for a in J['accessors']:
        if 'bufferView' in a:
            uses[a['bufferView']] = uses.get(a['bufferView'], 0) + 1
    new = {}
    skinned = [pr['attributes'] for m in J['meshes'] for pr in m['primitives'] if 'WEIGHTS_0' in pr['attributes']]
    for ai in sorted({at[k] for at in skinned for k in ('WEIGHTS_0', 'COLOR_0') if k in at}):
        a = J['accessors'][ai]
        bv = J['bufferViews'][a['bufferView']]
        wt = a['componentType'] == 5126
        if a['type'] != 'VEC4' or a['componentType'] not in (5126, 5123) or uses[a['bufferView']] > 1 or bv.get('byteStride', 16 if wt else 8) != (16 if wt else 8):
            continue
        n = a['count']
        f = struct.unpack_from('<%d%s' % (4 * n, 'f' if wt else 'H'), BIN, bv.get('byteOffset', 0) + a.get('byteOffset', 0))
        out = bytearray(4 * n)
        for i in range(n):
            w = f[4 * i:4 * i + 4]
            if wt:
                s = sum(w) or 1.0
                q = [int(round(x / s * 255)) for x in w]
                q[max(range(4), key=lambda j: q[j])] += 255 - sum(q)
            else:
                q = [(x * 255 + 32767) // 65535 for x in w]
            out[4 * i:4 * i + 4] = bytes(q)
        new[a['bufferView']] = bytes(out)
        a['componentType'], a['normalized'] = 5121, True
        for k in ('byteOffset', 'min', 'max'):
            a.pop(k, None)
        bv.pop('byteStride', None)
    nb = bytearray()
    for i, bv in enumerate(J['bufferViews']):
        o = bv.get('byteOffset', 0)
        d = new.get(i, BIN[o:o + bv['byteLength']])
        nb += bytes(-len(nb) % 4)
        bv['byteOffset'], bv['byteLength'] = len(nb), len(d)
        nb += d
    nb += bytes(-len(nb) % 4)
    J['buffers'][0]['byteLength'] = len(nb)
    js = json.dumps(J, separators=(',', ':')).encode()
    js += b' ' * (-len(js) % 4)
    open(path, 'wb').write(struct.pack('<III', 0x46546C67, 2, 28 + len(js) + len(nb)) + struct.pack('<II', len(js), 0x4E4F534A) + js + struct.pack('<II', len(nb), 0x004E4942) + nb)
    print('quantized', len(new), 'accessors ->', os.path.getsize(path) // 1024, 'KB')

GLBOUT = os.environ.get('GLB', os.path.join(HERE, 'workers.glb'))
export(GLBOUT, OUT)
quantize_weights(GLBOUT)
from glb_draco import draco_glb
draco_glb(GLBOUT)   # 最後一步：頂點與索引改存 Draco（見 glb_draco.py）

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
    preview(os.path.join(PREVIEW, 'vm.png'), (0, .95, -3.85), 1.1, 200, 22)        # M416 的第一人稱手臂（跟槍放在一起）
    preview(os.path.join(PREVIEW, 'chute.png'), (0, 3, -8), 12, 30, 25)
    preview(os.path.join(PREVIEW, 'items.png'), (24, .1, 3), 5.5, 10, 35)
