# 188 彩筆曠野：三隻頭目（荊棘樹精、熔岩蠑螈、灰寂巨像）；雷羽鳥沿用 enemies.glb 的鳥類模板放大
# 重建：/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P assets/188/build_bosses.py
#   環境變數：OUT=輸出 glb（預設 assets/188/bosses.glb）、RENDER=1 預覽圖存到 PREV、AO=烘焙取樣數
# 零件名稱對應網頁的頭目程式（名稱後面的 __序號 會被去掉）：
#   B_thornmaw：Face（EyeL、EyeR；原點 (0,2.8,2.25)，被打暈時繞 z 轉）、Armor（正好 16 個子物件＝16 段荊棘藤，
#     網頁依序號由後往前隱藏，所以 0 號在最下面、15 號在最上面，燒的時候由上往下燒光）、ArmL、ArmR（原點在肩膀 (±2.4,3,0)）
#     樹冠用 leaf 材質的葉叢卡片（要 UV，所以匯出時 uv=True），法線朝外讓樹冠像一整團體積
#   B_magmander：Skin 類零件用 c1 材質（熱／冷換色，頂點色只放明暗）、Leg0~3、Tail0~4（網頁直接指定 position.x，
#     原點 x 必須是 0）、Spot0~5（熔岩池，冷卻時隱藏）、Crack（石殼碎裂的發光裂紋，貼著背上的石甲表面）
#     背上的黑曜石甲片是 fixed 材質（熱的時候像黑曜石、冷卻後像玄武岩）
#   B_colossus：LegA、LegB（原點 (±3.2,9,0)，網格往下長；跪下時會壓扁 y）、Torso（原點 (0,9,0)；Head 原點 (0,20.5,.5)、
#     ArmA、ArmB 原點 (±7,17,0)）；A 在 -x、B 在 +x。網頁把顏色核心掛在手臂區域座標 (0,.5,1.5)（肩膀正面）與
#     腿區域座標 (0,-4.6,1.8)（膝蓋正面），頭頂 (0,3,0) 是彩虹核心，所以這幾處做成凹進去的礦石插座
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from bw_lib import *
from mathutils.bvhtree import BVHTree

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


def boss(name, build, floor=.55):
    before = set(o.name for o in bpy.context.scene.objects)
    build()
    objs = [o for o in bpy.context.scene.objects if o.name not in before]
    meshes = [o for o in objs if o.type == 'MESH']
    if AO:
        ao_bake(meshes, samples=AO, strength=1.0, floor=floor)
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


# ── 共用小工具 ──
def lerp(a, b, t):
    return a + (b - a) * t


def curve(ctrl, n):
    """Catmull-Rom 把控制點補成 n 個點（three 座標）"""
    P = [Vector(p) for p in ctrl]
    out = []
    for k in range(n):
        t = k / (n - 1) * (len(P) - 1)
        i = min(int(t), len(P) - 2)
        u = t - i
        p0, p1, p2, p3 = P[max(i - 1, 0)], P[i], P[i + 1], P[min(i + 2, len(P) - 1)]
        q = 0.5 * ((2 * p1) + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u + (-p0 + 3 * p1 - 3 * p2 + p3) * u * u * u)
        out.append(tuple(q))
    return out


def radii(rs, n):
    out = []
    for k in range(n):
        t = k / (n - 1) * (len(rs) - 1)
        i = min(int(t), len(rs) - 2)
        out.append(lerp(rs[i], rs[i + 1], t - i))
    return out


def basis(nrm, hint=(0, 0, 1)):
    """回傳 3x3：區域 y 軸對齊 nrm（three 座標），區域 z 盡量朝 hint"""
    y = Vector(nrm).normalized()
    h = Vector(hint)
    x = y.cross(h)
    if x.length < 1e-4:
        x = y.cross(Vector((1, 0, 0)))
    x.normalize()
    z = x.cross(y).normalized()
    return Matrix((x, y, z)).transposed()


def rot3(axis, ang):
    return Matrix.Rotation(ang, 3, Vector(axis))


def flat(ob):
    for p in ob.data.polygons:
        p.use_smooth = False
    return ob


def rock(name, c, r, n=34, seed=0, box=.62, B=None, cuts=1, slot='fixed', smooth_=False):
    """凸包石塊：在超橢球面上撒點取凸包，面是一塊塊平的（曠野之息的岩石），再切細給頂點色與 AO 用"""
    rnd = random.Random(seed * 7919 + 13)
    bm = bmesh.new()
    B = B or Matrix.Identity(3)
    for i in range(n):
        d = Vector((rnd.gauss(0, 1), rnd.gauss(0, 1), rnd.gauss(0, 1))).normalized()
        q = Vector([math.copysign(abs(x) ** box, x) for x in d])
        q = Vector((q.x * r[0], q.y * r[1], q.z * r[2])) * rnd.uniform(.88, 1.02)
        w = Vector(c) + B @ q
        bm.verts.new(V(*w))
    res = bmesh.ops.convex_hull(bm, input=bm.verts[:])
    kill = list({g for g in res['geom_interior'] + res['geom_unused'] if isinstance(g, bmesh.types.BMVert)})
    if kill:
        bmesh.ops.delete(bm, geom=kill, context='VERTS')
    if cuts:
        bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=cuts, use_grid_fill=True)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    ob = obj_from_bm(bm, name, slot=slot)
    if not smooth_:
        flat(ob)
    return ob


def paint_e(ob, fn):
    """fn(p, n, e)：e 是這個頂點所在稜角的銳利度（0 平面～1 很尖），給磨亮的邊緣用"""
    me = ob.data
    bm = bmesh.new()
    bm.from_mesh(me)
    bm.verts.ensure_lookup_table()
    E = []
    for v in bm.verts:
        fs = v.link_faces
        m = 1.0
        for a in fs:
            for b in fs:
                m = min(m, a.normal.dot(b.normal))
        E.append(max(0.0, min(1.0, (1 - m) * 1.6)))
    bm.free()
    col = me.color_attributes.get('Col') or me.color_attributes.new('Col', 'FLOAT_COLOR', 'POINT')
    me.color_attributes.active_color = col
    mw = ob.matrix_world
    arr = np.zeros(len(me.vertices) * 4, dtype=np.float32)
    for i, v in enumerate(me.vertices):
        p = Vector(T(mw @ v.co))
        n = Vector(T((mw.to_3x3() @ v.normal).normalized()))
        c = hexrgb(fn(p, n, E[i]))
        arr[i * 4:i * 4 + 4] = (srgb2lin(c[0]), srgb2lin(c[1]), srgb2lin(c[2]), 1.0)
    col.data.foreach_set('color', arr)
    return ob


def bvh_of(objs):
    bpy.context.view_layer.update()
    verts, polys = [], []
    for o in objs:
        mw = o.matrix_world
        off = len(verts)
        verts += [mw @ v.co for v in o.data.vertices]
        polys += [[off + i for i in p.vertices] for p in o.data.polygons]
    return BVHTree.FromPolygons(verts, polys)


def cast(bvh, p, d):
    hit = bvh.ray_cast(V(*p), V(*d))
    if hit[0] is None:
        return None, None
    n = Vector(T(hit[1]))
    if n.dot(Vector(d)) > 0:
        n = -n
    return Vector(T(hit[0])), n


def leaf_cards(name, clumps, tint, seed=0, per=15, size=1.0):
    """葉叢卡片：clumps = [(中心, 半徑)]；每片卡片 UV 0..1，法線從葉叢中心往外，讓整團像一顆體積"""
    rnd = random.Random(seed)
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new('UVMap')
    nrm = []
    for (c, r) in clumps:
        c = Vector(c)
        k = max(5, int(per * r))
        for i in range(k):
            # 均勻一點的球面分布，偏上
            u = (i + rnd.random() * .6) / k
            yy = lerp(-.45, .98, u ** .8)
            a = i * 2.39996 + rnd.random() * .5
            d = Vector((math.cos(a) * math.sqrt(1 - yy * yy), yy, math.sin(a) * math.sqrt(1 - yy * yy))).normalized()
            q = c + d * r * rnd.uniform(.55, .78)
            f = (d + Vector((rnd.uniform(-.4, .4), rnd.uniform(-.2, .5), rnd.uniform(-.4, .4)))).normalized()
            Bm = basis(f, (rnd.uniform(-1, 1), 0, rnd.uniform(-1, 1)))
            tx, tz = Bm.col[0], Bm.col[2]
            w = r * size * rnd.uniform(.95, 1.25)
            vs = []
            for (sx, sz, uu, vv) in ((-1, -1, 0, 0), (1, -1, 1, 0), (1, 1, 1, 1), (-1, 1, 0, 1)):
                pt = q + tx * sx * w * .5 + tz * sz * w * .5
                vs.append(bm.verts.new(V(*pt)))
                nn = (pt - c).normalized() * .8 + Vector((0, .35, 0))
                nrm.append(V(*nn.normalized()))
            f_ = bm.faces.new(vs[::-1])  # 正面朝外（雙面材質的背面會被翻法線、吃滿邊光）
            for l, (uu, vv) in zip(f_.loops, ((0, 1), (1, 1), (1, 0), (0, 0))):
                l[uv].uv = (uu, vv)
    ob = obj_from_bm(bm, name, slot='leaf')
    ob.data.normals_split_custom_set_from_vertices(nrm)
    cl = [(Vector(c), r) for c, r in clumps]

    def fn(p, n):
        best = min(cl, key=lambda q: (Vector(p) - q[0]).length / q[1])
        d = (Vector(p) - best[0]) / best[1]
        return tint(p, d)
    paint(ob, fn)
    return ob


# ════════════════ 1. 荊棘樹精 ════════════════
TR_PROF = [(-.35, 3.05), (.15, 2.9), (.7, 2.6), (1.4, 2.42), (2.3, 2.33), (3.2, 2.3), (4.0, 2.22), (4.5, 2.05), (4.85, 1.8)]


def tr_prof(y):
    P = TR_PROF
    if y <= P[0][0]:
        return P[0][1]
    for (y0, r0), (y1, r1) in zip(P, P[1:]):
        if y <= y1:
            t = (y - y0) / (y1 - y0)
            t = t * t * (3 - 2 * t)
            return lerp(r0, r1, t)
    return P[-1][1]


EYE_Y, MOUTH_Y = 3.05, 1.98


def face_fields(phi, y):
    """臉部的形變場（臉朝 +z，phi=0）：回傳 (半徑增量, 眼窩, 嘴洞)"""
    u = math.atan2(math.sin(phi), math.cos(phi)) * 2.3
    if abs(u) > 3.2:
        return 0.0, 0.0, 0.0
    dr = 0.0
    sock = 0.0
    for s in (-1, 1):
        d2 = ((u - s * .8) / .52) ** 2 + ((y - EYE_Y + (u * s - .8) * .12) / .38) ** 2
        k = math.exp(-d2 * 1.3)
        sock = max(sock, k)
        dr -= .5 * k
    # 眉骨：內低外高的怒眉
    yb = 3.42 + .22 * min(abs(u), 1.4) / 1.4
    dr += .26 * math.exp(-((y - yb) / .2) ** 2) * sstep(1.75, 1.2, abs(u)) * sstep(.02, .22, abs(u))
    # 眉心的疙瘩與鼻樑
    dr += .2 * math.exp(-(u / .26) ** 2 - ((y - 2.62) / .34) ** 2)
    dr += .1 * math.exp(-(u / .2) ** 2 - ((y - 3.2) / .5) ** 2)
    # 顴骨
    for s in (-1, 1):
        dr += .16 * math.exp(-((u - s * 1.2) / .38) ** 2 - ((y - 2.55) / .3) ** 2)
    # 嘴：寬、下緣比較平、邊緣不規則，外圈一道翻起的樹皮唇
    jag = .08 * math.sin(u * 9) + .05 * math.sin(u * 17 + 1)
    d = math.sqrt((u / 1.15) ** 2 + ((y - MOUTH_Y - jag) / (.4 if y > MOUTH_Y else .32)) ** 2)
    mouth = math.exp(-(d ** 4) * 1.3)
    dr -= .55 * mouth
    dr += .1 * math.exp(-((d - 1.12) / .16) ** 2)
    return dr, sock, mouth


def tr_r(phi, y):
    p = Vector((math.sin(phi) * 2.3, y, math.cos(phi) * 2.3))
    front = sstep(1.6, .6, abs(math.atan2(math.sin(phi), math.cos(phi)))) * sstep(1.2, 1.8, y) * sstep(4.2, 3.8, y)
    amp = .75 + .5 * nz(p, .9, 8)
    ridge = (.06 * amp * math.sin(phi * 11 + y * 1.1 + 2.2 * nz(p, .5)) + .025 * math.sin(phi * 27 - y * 1.7 + nz(p, 1.3, 2) * 2)) * (1 - front * .85)
    lump = .06 * nz(p, .55, 2) + .03 * nz(p, 1.6, 5)
    dr, _, _ = face_fields(phi, y)
    root = 0.0
    if y < 1.4:  # 根部隆起接到根腳
        for k in range(7):
            a = k / 7 * TAU + .2
            da = math.atan2(math.sin(phi - (math.pi / 2 - a)), math.cos(phi - (math.pi / 2 - a)))
            root += .3 * math.exp(-(da / .22) ** 2) * sstep(1.4, .2, y)
    return tr_prof(y) * (1 + ridge + lump) + dr + root


def bark_col(p, n, furrow=None):
    phi = math.atan2(p[0], p[2])
    y = p[1]
    if furrow is None:
        q = Vector((math.sin(phi) * 2.3, y, math.cos(phi) * 2.3))
        furrow = .5 + .5 * math.sin(phi * 11 + y * 1.1 + 2.2 * nz(q, .5))
    c = mix(0x4a3a2e, 0x9a8468, furrow ** 1.2)
    c = mix(c, 0xa89a82, .3 * sstep(.15, .6, nz(p, .8, 7)))  # 低頻的淺色樹皮
    c = mix(c, 0x2c211b, sstep(1.0, -.2, y) * .45)  # 地面附近濕黑
    moss = sstep(.4, .85, n[1]) * .9 + sstep(1.1, .1, y) * sstep(.0, .4, nz(p, .9, 3)) * .8
    moss *= sstep(-.35, .05, nz(p, 1.3, 11))
    c = mix(c, mix(0x55702e, 0x9aa84a, sstep(-.3, .6, nz(p, 2.2, 4) + n[1] * .3)), min(1, moss) * .85)
    return c


def thornmaw():
    # 樹幹：旋轉面，直接用形變場（樹皮縱紋、根部隆起、刻出來的臉）
    seg, ys = 60, [-.35 + k * .115 for k in range(46)]
    bm = bmesh.new()
    rings = []
    for y in ys:
        rings.append([bm.verts.new(V(math.sin(i / seg * TAU) * tr_r(i / seg * TAU, y), y, math.cos(i / seg * TAU) * tr_r(i / seg * TAU, y))) for i in range(seg)])
    for k in range(len(rings) - 1):
        for i in range(seg):
            bm.faces.new((rings[k][i], rings[k][(i + 1) % seg], rings[k + 1][(i + 1) % seg], rings[k + 1][i]))
    top = bm.verts.new(V(0, ys[-1] + .25, 0))
    for i in range(seg):
        bm.faces.new((rings[-1][i], rings[-1][(i + 1) % seg], top))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    trunk = obj_from_bm(bm, 'Trunk')

    def trunk_col(p, n):
        phi = math.atan2(p[0], p[2])
        _, sock, mouth = face_fields(phi, p[1])
        c = bark_col(p, n)
        c = mix(c, 0x201510, sstep(.35, .8, sock))
        c = mix(c, 0x160d09, sstep(.25, .7, mouth))
        return c
    C(trunk, trunk_col)
    parts = [trunk]
    # 根腳：七條拱起再扎進土裡的粗根
    for k in range(7):
        a = k / 7 * TAU + .2
        ca, sa = math.cos(a), math.sin(a)
        w = random.uniform(-.25, .25)
        ctrl = [(1.7, 1.35, 0), (2.7, 1.3, .1), (3.45, .85, w), (4.1, .2, -w), (4.6, -.25, 0)]
        pts = []
        for (r, y, t) in ctrl:
            pts.append((ca * r - sa * t, y, sa * r + ca * t))
        pts = curve(pts, 12)
        rt = tube('Root', pts, radii([.78, .66, .5, .34, .18, .06], 12), seg=14)
        displace(rt, .06, 1.8, seed=k)
        parts.append(C(rt, bark_col))
        # 細根
        for j in range(2):
            b = Vector(pts[5 + j * 3])
            side = (-sa * (1 if j else -1), 0, ca * (1 if j else -1))
            q = [tuple(b), tuple(b + Vector(side) * .6 + Vector((ca * .3, -.25, sa * .3))), tuple(b + Vector(side) * 1.0 + Vector((ca * .5, -.7, sa * .5)))]
            parts.append(C(tube('Rootlet', curve(q, 6), radii([.2, .12, .03], 6), seg=8), bark_col))
    # 斷口上長出來的枝幹
    branches = []
    for (ex, ey, ez) in [(1.8, 5.9, .7), (-1.7, 6.0, -.5), (.6, 6.3, -1.7), (-.6, 6.1, 1.5), (0, 6.8, 0)]:
        q = curve([(ex * .15, 4.5, ez * .15), (ex * .45, 5.2, ez * .45), (ex, ey, ez)], 7)
        branches.append(C(tube('Branch', q, radii([.55, .35, .12], 7), seg=10), bark_col))
    parts += branches
    body = join(parts, 'Stump')
    # 樹冠：葉叢卡片 + 裡面的暗色葉團（遮住縫隙）
    clumps = [((0, 6.35, 0), 1.6), ((1.75, 5.7, .65), 1.3), ((-1.7, 5.75, -.55), 1.35), ((.55, 5.8, -1.65), 1.25), ((-.6, 5.65, 1.5), 1.15),
              ((1.15, 6.85, -.45), 1.0), ((-1.0, 6.85, .45), 1.0), ((2.3, 5.1, -.95), .9), ((-2.25, 5.15, 1.0), .9), ((.55, 5.15, 1.95), .8),
              ((-1.4, 5.05, -1.6), .85), ((1.5, 5.0, 1.55), .75)]
    cores = []
    for i, (c, r) in enumerate(clumps):
        co = ellipsoid('LeafCore', c, (r * .62, r * .5, r * .62), seg=12, rings=8)
        displace(co, r * .18, 1.4 / r, seed=30 + i)
        cores.append(C(co, lambda p, n: mix(0x34501f, 0x6f8c34, sstep(-.6, .9, n[1]) * .7 + nz(p, 2.5) * .15)))
    crown = join(cores, 'Crown')

    def leaf_tint(p, d):
        t = sstep(-.7, .9, d[1]) * .75 + sstep(5.0, 7.6, p[1]) * .25 + nz(p, 1.7, 9) * .25
        c = mix(0x3e5a22, 0xa8bb50, t)
        return mix(c, 0xb7a84a, .25 * sstep(.2, .6, nz(p, .9, 12)))  # 少量偏黃的葉尖
    leaves = leaf_cards('Leaves', clumps, leaf_tint, seed=5, per=20, size=1.2)
    # 臉：刻進樹幹的眼窩（樹幹本身已經凹下去），發光的眼、怒眉、疙瘩鼻、參差的木牙
    fx = []
    for s, nm in ((-1, 'EyeL'), (1, 'EyeR')):
        ph = s * .8 / 2.3
        r0 = tr_r(ph, EYE_Y) + .1
        c = (math.sin(ph) * r0, EYE_Y, math.cos(ph) * r0)
        e = ellipsoid(nm, (0, 0, 0), (.44, .27, .2), seg=18, rings=10)
        each_vert(e, lambda p, s=s: (p[0], p[1] + p[0] * s * .28, p[2]))  # 內低外高的斜眼
        e.data.transform(Matrix.Rotation(ph, 4, 'Z'))  # three 的繞 y 轉 = Blender 繞 Z
        e.location = V(*c)
        bpy.context.view_layer.update()
        C(e, lambda p, n, c=c: mix((1, 1, .9), (1, .55, .12), sstep(.08, .36, (Vector(p) - Vector(c)).length)))
        fx.append(M(e, 'glow'))
        # 眉：兩三條擠在一起的樹皮稜
        for j in range(2):
            pts = []
            for k in range(6):
                u = s * lerp(.2, 1.45, k / 5)
                y = 3.3 + .36 * min(abs(u), 1.4) / 1.4 + j * .13 - .02 * k
                ph2 = u / 2.3
                rr = tr_r(ph2, y) + .08 - j * .05
                pts.append((math.sin(ph2) * rr, y, math.cos(ph2) * rr))
            br = tube('Brow', curve(pts, 11), radii([.12, .19, .15, .1, .04], 11), seg=8)
            displace(br, .035, 5, seed=j + s)
            fx.append(C(br, lambda p, n: mix(0x3e2e22, 0x9a8466, sstep(-.1, .8, n[1]))))
    # 木牙：上排往下、下排往上
    rnd2 = random.Random(3)
    for row, (yy, dy) in enumerate(((MOUTH_Y + .3, -1), (MOUTH_Y - .24, 1))):
        n_ = 6 if row == 0 else 5
        for k in range(n_):
            u = lerp(-.85, .85, (k + .5) / n_) + rnd2.uniform(-.06, .06)
            ph = u / 2.3
            y = yy - (abs(u) ** 2) * .12 * dy
            rr = tr_r(ph, y) - .02
            L = rnd2.uniform(.22, .42) * (1.25 if abs(u) < .5 and row == 0 else 1)
            b = Vector((math.sin(ph) * rr, y, math.cos(ph) * rr))
            tip = b + Vector((math.sin(ph) * .08 + rnd2.uniform(-.05, .05), dy * L, math.cos(ph) * .08))
            t = tube('Fang', [tuple(b), tuple((b + tip) / 2 + Vector((0, 0, .02))), tuple(tip)], [.1, .065, .005], seg=6)
            fx.append(C(t, lambda p, n, b=b: mix(0x5a4430, 0xe6d8b0, sstep(.02, .3, abs(p[1] - b[1])))))
    group('Face', (0, 2.8, 2.25), fx)
    # 16 段荊棘藤（Armor 的子物件，0 號最低）
    specs = []
    for band, (y0, phis) in enumerate(((.95, (.25, 1.85, 3.45, 5.05)), (1.85, (1.3, 2.45, 3.85, 5.0)), (2.75, (1.05, 2.9, 3.4, 5.25)), (3.7, (1.35, 2.55, 3.75, 4.95)))):
        for ph in phis:
            specs.append((y0 + random.uniform(-.12, .12), ph + random.uniform(-.1, .1), band))
    thorns = []
    for i, (y0, ph0, band) in enumerate(specs):
        span = .9 if band else 1.1
        dy = random.uniform(.35, .55) * (1 if i % 2 else -1)
        pts = []
        for k in range(11):
            t = k / 10
            ph = ph0 + (t - .5) * span
            y = y0 + (t - .5) * dy + .06 * math.sin(t * 12 + i)
            rr = tr_r(ph, y) + .26 + .05 * math.sin(t * 9 + i * 2)
            pts.append((math.sin(ph) * rr, y, math.cos(ph) * rr))
        vine = tube('ThornVine', pts, radii([.05, .12, .13, .12, .05], 11), seg=6)
        C(vine, lambda p, n: mix(0x2f3a1c, 0x6a7a36, sstep(-.2, .8, n[1]) * .6 + nz(p, 4) * .3 + .2))
        pieces = [vine]
        # 主刺：粗、往外往上彎、尖端骨白
        for (t, L, big) in ((.5, random.uniform(1.05, 1.35), True), (.18, .38, False), (.82, .4, False), (.66, .3, False)):
            b = Vector(pts[int(t * 10)])
            ph = math.atan2(b.x, b.z)
            out = Vector((math.sin(ph), 0, math.cos(ph)))
            up = Vector((0, 1, 0)) if big else Vector((0, random.choice((-1, 1)) * .6, 0))
            d = (out + up * .25).normalized()
            q = [tuple(b - out * .05), tuple(b + d * L * .5), tuple(b + d * L + up * L * .22)]
            sp = tube('Spike', curve(q, 5 if big else 3), radii([.21 if big else .08, .12 if big else .05, .003], 5 if big else 3), seg=8 if big else 6)
            C(sp, lambda p, n, b=b, L=L: mix(mix(0x3c3a1e, 0x6b5a34, .5), 0xe8dcb4, sstep(L * .25, L * .9, (Vector(p) - b).length)))
            pieces.append(sp)
        thorns.append(join(pieces, 'Thorn'))
    group('Armor', (0, 0, 0), thorns)
    # 手臂：糾結的樹枝，肘部長葉，末端三根爪狀枝
    for s, nm in ((-1, 'ArmL'), (1, 'ArmR')):
        ctrl = [(s * 1.8, 3.1, 0), (s * 2.6, 3.25, .1), (s * 3.4, 3.55, .35), (s * 4.25, 3.3, .55), (s * 5.0, 2.75, .8), (s * 5.45, 2.2, 1.05)]
        pts = curve(ctrl, 16)
        arm = tube(nm + 'M', pts, radii([.66, .6, .52, .46, .4, .33], 16), seg=14)
        displace(arm, .05, 2.2, seed=40 + s)
        C(arm, bark_col)
        ap = [arm]
        # 樹瘤
        for k in (4, 9):
            ap.append(C(ellipsoid('Knot', pts[k], (.3, .26, .3), seg=10, rings=6), bark_col))
        # 三根爪枝
        w = Vector(pts[-1])
        for j, (dx, dz) in enumerate(((.55, .55), (.15, .8), (-.2, .6))):
            q = [tuple(w), tuple(w + Vector((s * dx * .7, -.15, dz * .6))), tuple(w + Vector((s * dx * 1.2, -.55, dz * 1.1))), tuple(w + Vector((s * dx * 1.4, -1.0, dz * 1.2)))]
            ap.append(C(tube('Claw', curve(q, 7), radii([.24, .16, .08, .01], 7), seg=8), lambda p, n: mix(bark_col(p, n, .6), 0xcdbf98, sstep(1.9, 1.3, p[1]))))
        # 小刺
        for k in (3, 7, 11):
            b = Vector(pts[k])
            d = Vector((s * .3, random.uniform(.3, .9), random.uniform(-.6, .6))).normalized()
            ap.append(C(tube('ArmThorn', [tuple(b), tuple(b + d * .35), tuple(b + d * .6)], [.1, .05, .003], seg=6), lambda p, n, b=b: mix(0x4a4424, 0xe0d4ac, sstep(.1, .55, (Vector(p) - b).length))))
        a = join(ap, nm)
        origin_to(a, (s * 2.4, 3, 0))
        cl = [((s * 3.4, 4.05, .3), .62), ((s * 4.4, 3.8, .7), .5)]
        co = [C(ellipsoid('ArmLeafCore', c, (r * .7, r * .55, r * .7), seg=10, rings=7), 0x3b5a22) for c, r in cl]
        lv = leaf_cards(nm + 'Leaves', cl, leaf_tint, seed=60 + s, per=13, size=1.0)
        lc = join(co, nm + 'Core')
        set_parent(lc, a)
        set_parent(lv, a)


boss('thornmaw', thornmaw, floor=.5)


# ════════════════ 2. 熔岩蠑螈 ════════════════
def obsidian(p, n, e):
    c = mix(0x2a2427, 0x3b3438, .5 + nz(p, 1.3, 2) * .8)
    c = mix(c, 0x4c4a58, sstep(.3, .9, n[1]) * .35)  # 朝上的面帶一點冷色反光
    c = mix(c, 0x6e5f5a, e * .55)  # 磨亮的稜
    return c


def magmander():
    def skin(ob, belly=True):
        def fn(p, n):
            k = .74 + .1 * nz(p, 1.1, 3)
            if belly:
                k = lerp(k, 1.0, sstep(.15, -.55, n[1]))  # 肚子淺
            k -= .24 * sstep(.12, .4, nz(p, .8, 17)) * sstep(-.5, .1, n[1])  # 蠑螈斑
            k -= .14 * sstep(.35, 1, n[1])  # 背比較暗
            return (k, k, k)
        paint(ob, fn)
        return M(ob, 'c1')

    # 身體：寬扁、肚子貼地、肩膀與臀部鼓起，皮膚有細顆粒
    body = ellipsoid('Body', (0, 1.6, 0), (2.1, 1.25, 3.1), seg=44, rings=30)

    def bdef(p):
        x, y, z = p
        if y < 1.6:
            y = 1.6 - (1.6 - y) * .72
        x *= 1 + .14 * math.exp(-((z - 1.5) / .8) ** 2) + .12 * math.exp(-((z + 1.4) / .8) ** 2)
        y += .12 * math.exp(-(x / .5) ** 2) * (y > 1.6)
        return (x, y, z)
    each_vert(body, bdef)
    displace(body, .045, 3.2, seed=2, octaves=2)
    skin(body)
    bparts = [body]
    bvh = bvh_of([body])

    def on_back(x, z):
        return cast(bvh, (x, 6, z), (0, -1, 0))

    # 熔岩池（Spot0~5）先決定位置，甲片避開
    spots = [(.55, 1.25), (-.6, .55), (.62, -.35), (-.5, -1.25), (.35, -2.05), (-.25, 2.05)]
    # 黑曜石甲片：中線大而尖（背脊），兩側一排排往後疊
    plates = []
    rnd = random.Random(7)
    spot_hits = [on_back(sx, sz)[0] for sx, sz in spots]
    for row in range(11):
        z = 2.45 - row * .5
        cols = (-1.15, -.6, 0, .6, 1.15) if row % 2 == 0 else (-1.4, -.88, -.3, .3, .88, 1.4)
        for th in cols:
            th2 = th + rnd.uniform(-.05, .05)
            zz = z + rnd.uniform(-.06, .06)
            o = Vector((math.sin(th2) * 6, 1.6 + math.cos(th2) * 6, zz))
            hit, nrm = cast(bvh, tuple(o), tuple((Vector((0, 1.6, zz)) - o).normalized()))
            if hit is None:
                continue
            if any((hit - sh).length < .62 for sh in spot_hits):
                continue
            taper = 1 - max(0, abs(zz + .1) - 1.9) * .45
            spine = abs(th) < .05
            if spine:
                r = (.24 * taper, .5 * taper, .42 * taper)
                B = basis(nrm, (0, 0, 1)) @ rot3((1, 0, 0), -.35)
                pl = rock('Plate', hit + nrm * .12, r, n=16, seed=row * 13, box=1.1, B=B, cuts=0)
            else:
                r = (rnd.uniform(.4, .48) * taper * (1 - abs(th) * .15), rnd.uniform(.12, .16), rnd.uniform(.42, .5) * taper)
                B = basis(nrm, (0, 0, 1)) @ rot3((1, 0, 0), -.16)  # 後緣略翹，往後疊成一排排鱗甲
                pl = rock('Plate', hit + nrm * .03, r, n=18, seed=row * 13 + int(th * 10) + 50, box=.72, B=B, cuts=0)
            plates.append(paint_e(pl, obsidian))
    bparts += plates
    Body = join(bparts, 'Body')
    shell = [Body]
    # 熔岩池：貼著背，裡面亮外面橘
    for i, (sx, sz) in enumerate(spots):
        hit, nrm = on_back(sx, sz)
        sp = ellipsoid('Spot%d' % i, (0, 0, 0), (.36, .09, .44), seg=14, rings=7)
        displace(sp, .05, 4, seed=i)
        B = basis(nrm, (0, 0, 1))
        sp.data.transform(Matrix.Translation(V(*(hit + nrm * .01))) @ (Matrix(((1, 0, 0), (0, 0, -1), (0, 1, 0))) @ B @ Matrix(((1, 0, 0), (0, 0, 1), (0, -1, 0)))).to_4x4())
        C(sp, lambda p, n, c=hit: mix((1, .97, .75), (1, .5, .12), sstep(.05, .4, (Vector(p) - c).length)))
        M(sp, 'glow')
    # 頭：一整顆寬扁的鏟形頭，嘴是一道往兩側嘴角上揚、刻進去的深溝（不是兩片嘴唇）
    HC = Vector((0, 1.98, 3.5))

    def mouth_y(a):
        return 1.74 + .3 * sstep(1.0, 1.85, abs(a))

    def groove(x, y, z):
        a = math.atan2(x, z - 3.3)
        return math.exp(-((y - mouth_y(a)) / .075) ** 2) * sstep(2.0, 1.55, abs(a)), a
    hd = ellipsoid('HeadM', tuple(HC), (1.5, .92, 1.72), seg=44, rings=46)

    def hdef(p):
        x, y, z = p
        x *= 1 + max(0, z - 3.3) * .2
        if y > HC.y:
            y = HC.y + (y - HC.y) * (.85 - max(0, z - 4.3) * .28)
        else:
            y = HC.y - (y - HC.y) * -.62
        for s in (-1, 1):  # 眼丘
            y += .22 * math.exp(-((x - s * .85) / .32) ** 2 - ((z - 3.95) / .35) ** 2) * (y > 2.2)
        g, a = groove(x, y, z)
        if g > 1e-3:
            k = 1 - .3 * g / max(.4, math.hypot(x, z - 3.3))
            x, z = x * k, 3.3 + (z - 3.3) * k
        return (x, y, z)
    each_vert(hd, hdef)
    displace(hd, .025, 3.5, seed=5, octaves=2)

    def head_fn(p, n):
        k = .74 + .1 * nz(p, 1.1, 3)
        k = lerp(k, 1.0, sstep(.1, -.6, n[1]))
        k -= .14 * sstep(.35, 1, n[1])
        k -= .2 * sstep(.15, .42, nz(p, .9, 17)) * sstep(-.3, .2, n[1])
        g, _ = groove(*p)
        return (lerp(k, .12, sstep(.25, .75, g)),) * 3
    paint(hd, head_fn)
    M(hd, 'c1')
    hp = [hd]
    for s in (-1, 1):
        # 眼睛：琥珀色、直瞳，上面壓一片眉甲
        hit, _ = cast(bvh_of([hd]), (s * 1.0, 6, 4.0), (0, -1, 0))
        ec = hit + Vector((s * .04, -.02, 0))
        eye = C(ellipsoid('EyeW', tuple(ec), (.25, .22, .25), seg=16, rings=10), lambda p, n, ec=ec: mix(0xffe58a, 0xc9701a, sstep(.05, .22, abs(p[1] - ec.y))))
        pd = Vector((s * .45, .15, .88)).normalized()
        pu = C(ellipsoid('Pupil', tuple(ec + pd * .21), (.045, .17, .05), seg=8, rings=6), 0x1a0a08)
        brow = paint_e(rock('BrowPlate', tuple(ec + Vector((s * .05, .24, -.12))), (.36, .11, .3), n=16, seed=90 + s, box=.7, B=rot3((0, 0, 1), -s * .35) @ rot3((1, 0, 0), .25), cuts=0), obsidian)
        nh, _ = cast(bvh_of([hd]), (s * .34, 2.25, 9), (0, 0, -1))
        nos = C(ellipsoid('Nostril', tuple(nh - Vector((0, 0, .02))), (.1, .035, .05), seg=8, rings=5), 0x2a100a)
        hp += [eye, pu, brow, nos]
        # 角：往後掃的黑曜石角，旁邊再一根小的
        for j, (L, yo) in enumerate(((1.0, 0), (.55, -.3))):
            b = Vector((s * (.75 + j * .25), 2.55 + yo, 3.05 - j * .2))
            q = [tuple(b), tuple(b + Vector((s * .35, .3, -.45)) * L), tuple(b + Vector((s * .55, .45, -1.05)) * L)]
            h = tube('Horn', curve(q, 6), radii([.2 * L + .04, .13 * L, .01], 6), seg=7)
            hp.append(paint_e(flat(h), obsidian))
    # 頭頂甲片
    hb = bvh_of([hd])
    for k, (x, z) in enumerate(((0, 3.2), (-.45, 3.55), (.45, 3.55), (0, 3.9), (-.3, 2.8), (.3, 2.8))):
        hit, nrm = cast(hb, (x, 6, z), (0, -1, 0))
        if hit is not None:
            hp.append(paint_e(rock('HeadPlate', hit + nrm * .05, (.26, .1, .28), n=16, seed=200 + k, box=.7, B=basis(nrm) @ rot3((1, 0, 0), -.25), cuts=0), obsidian))
    # 牙：嘴溝上下緣交錯露出的尖牙
    tb_ = bvh_of([hd])
    for row, dy in enumerate((-1, 1)):
        for k in range(12):
            a = lerp(-1.45, 1.45, (k + (.5 if row else 0)) / 11.5)
            d = Vector((math.sin(a), 0, math.cos(a)))
            y0 = mouth_y(a) - dy * .1
            hit, _ = cast(tb_, tuple(Vector((0, y0, 3.3)) + d * 5), tuple(-d))
            if hit is None:
                continue
            b = hit - d * .05
            L = (.24 if abs(a) < .8 else .16) * (1.35 if k in (2, 9) else 1)
            hp.append(C(tube('Tooth', [tuple(b), tuple(b + Vector((0, dy * L * .5, 0)) + d * .03), tuple(b + Vector((0, dy * L, 0)) + d * .02)], [.07, .045, .004], seg=6),
                        lambda p, n, y=b.y: mix(0x6b4a3a, 0xf2e6c8, sstep(.03, .14, abs(p[1] - y)))))
    group('Head', (0, 2.0, 3.35), hp)
    # 腳：外八撐地的粗腿、肘上一片甲、四根腳趾與黑曜石爪
    for i in range(4):
        x, z = (1.9 if i % 2 else -1.9), (1.6 if i < 2 else -1.4)
        sx = 1 if x > 0 else -1
        fz = .25 if i < 2 else -.1
        ctrl = [(x * .7, 1.35, z), (x * 1.05, 1.3, z + .05), (x * 1.32, .95, z + fz * .5), (x * 1.4, .45, z + fz), (x * 1.42, .2, z + fz + .1)]
        pts = curve(ctrl, 12)
        lg = tube('LegM', pts, radii([.66, .6, .5, .42, .38], 12), seg=16)
        displace(lg, .03, 3, seed=i)
        skin(lg)
        foot_c = Vector((x * 1.45, .16, z + fz + .3))
        palm = skin(ellipsoid('Palm', tuple(foot_c), (.48, .17, .5), seg=16, rings=8))
        lp = [lg, palm]
        for k in range(4):
            a = (k - 1.5) * .42 + (.3 if i < 2 else .85)
            d = Vector((sx * math.sin(a), 0, math.cos(a)))
            b = foot_c + d * .3
            tip = b + d * .45 + Vector((0, -.08, 0))
            lp.append(skin(tube('Toe', [tuple(b + Vector((0, .04, 0))), tuple((b + tip) / 2 + Vector((0, .04, 0))), tuple(tip)], [.13, .11, .09], seg=10)))
            cb = tip
            q = [tuple(cb), tuple(cb + d * .18 + Vector((0, -.02, 0))), tuple(cb + d * .3 + Vector((0, -.14, 0)))]
            lp.append(paint_e(flat(tube('Claw', q, [.08, .05, .004], seg=6)), obsidian))
        eb = Vector(pts[5])
        lp.append(paint_e(rock('ElbowPlate', tuple(eb + Vector((sx * .38, .28, 0))), (.3, .16, .34), n=16, seed=300 + i, box=.7, B=rot3((0, 0, 1), -sx * .6), cuts=0), obsidian))
        L = join(lp, 'Leg%d' % i)
        origin_to(L, (x * .8, 1.2, z))
    # 尾巴：五節，每節頂上一兩片甲，越後越細、最後一節收尖
    for i in range(5):
        s = 1 - i * .15
        cy, cz = 1.4 - i * .15, -3.2 - i * 1.1
        t = ellipsoid('TailM', (0, cy, cz), (s * .98, .8 * s, .95), seg=24, rings=14)
        each_vert(t, lambda p, cz=cz, cy=cy: (p[0] * (1 + (p[2] - cz) * .1), cy + (p[1] - cy) * (1 + (p[2] - cz) * .1), p[2]))  # 前粗後細，接上一節
        if i == 4:
            each_vert(t, lambda p, cz=cz: (p[0] * (1 - sstep(cz + .2, cz - .75, p[2]) * .8), p[1] * 1, p[2] - sstep(cz, cz - .75, p[2]) * .5))
        displace(t, .03, 3.2, seed=10 + i, octaves=2)
        skin(t)
        tp = [t]
        tb = bvh_of([t])
        for k, dz in enumerate((.3, -.25) if i < 3 else (0,)):
            hit, nrm = cast(tb, (0, 5, cz + dz), (0, -1, 0))
            if hit is not None:
                r = (.3 * s + .06, .26 * s + .05, .34 * s + .06)
                tp.append(paint_e(rock('TailPlate', hit + nrm * r[1] * .3, r, n=16, seed=400 + i * 3 + k, box=.8, B=basis(nrm) @ rot3((1, 0, 0), -.3), cuts=0), obsidian))
        T_ = join(tp, 'Tail%d' % i)
        origin_to(T_, (0, cy, cz))
    # 石殼碎裂時的發光裂紋：沿背上（含甲片）的表面折來折去，偶爾分岔
    sb = bvh_of([Body])
    cracks = []
    rnd = random.Random(11)
    for i in range(10):
        x, z = rnd.uniform(-1.3, 1.3), rnd.uniform(-2.3, 2.3)
        a = rnd.uniform(0, TAU)
        path = []
        for k in range(9):
            hit, nrm = cast(sb, (x, 6, z), (0, -1, 0))
            if hit is None or nrm[1] < .2:
                break
            path.append((hit + nrm * .05, nrm))
            a += rnd.uniform(-.9, .9)
            x += math.cos(a) * .24
            z += math.sin(a) * .24
        if len(path) < 3:
            continue
        pts = [tuple(p) for p, _ in path]
        cracks.append(tube('CrackLine', pts, radii([.03, .075, .06, .02], len(pts)), seg=5, up=(0, 1, 0)))
        if len(path) > 5:  # 分岔
            b = path[len(path) // 2][0]
            a2 = a + rnd.choice((-1, 1)) * 1.2
            bp = [tuple(b)]
            xx, zz = b.x, b.z
            for k in range(3):
                xx += math.cos(a2) * .22
                zz += math.sin(a2) * .22
                hit, nrm = cast(sb, (xx, 6, zz), (0, -1, 0))
                if hit is None:
                    break
                bp.append(tuple(hit + nrm * .05))
            if len(bp) > 2:
                cracks.append(tube('CrackLine', bp, radii([.05, .03, .005], len(bp)), seg=5))
    for c in cracks:
        C(c, (1, .82, .4))
        M(c, 'glow')
    group('Crack', (0, 0, 0), [join(cracks, 'CrackNet')])


boss('magmander', magmander, floor=.5)


def colossus():
    # 灰寂巨像：一層層疊起來的岩板與巨石（像石頭怪），平面切面、青苔長在朝上的面，縫裡透出發光的礦脈
    def stone(p, n, e, dark=0.0, moss=1.0):
        c = mix(0x78728a, 0xaaa3b6, .5 + nz(p, .22, 1) * .9)
        c = mix(c, 0x625d74, dark)
        c = mix(c, 0xb3aa9e, sstep(.2, .9, n[1]) * .22)  # 受光面偏暖
        c = mix(c, 0x5a566e, sstep(0, -.8, n[1]) * .3)  # 背光面偏冷偏暗
        c = mix(c, 0x5c566c, .3 * sstep(.25, .6, nz(p, .9, 4)))  # 斑駁
        c = mix(c, 0xcfc8d2, e * .5)  # 稜角磨白
        m = sstep(.38, .75, n[1]) * sstep(-.3, .05, nz(p, .45, 5)) * moss
        c = mix(c, mix(0x5b6e3e, 0x97a460, sstep(-.4, .6, nz(p, 1.4, 6))), m * .92)
        return c

    def R(name, c, r, seed, dark=0.0, moss=1.0, n=34, box=.62, B=None, cuts=1):
        return paint_e(rock(name, c, r, n=n, seed=seed, box=box, B=B, cuts=cuts), lambda p, n_, e: stone(p, n_, e, dark, moss))

    def vein(name, pts, r=.12):
        t = tube(name, pts, radii([r * .3, r, r, r * .3], len(pts)) if len(pts) > 3 else r, seg=5)
        C(t, (.85, .95, 1))
        return M(t, 'glow')

    def on_front(objs, pts2, dz=-1, off=.04):
        """把 (x,y) 點從前方投影到零件表面"""
        bvh = bvh_of(objs)
        out = []
        for (x, y) in pts2:
            hit, nrm = cast(bvh, (x, y, 30 * -dz), (0, 0, dz))
            if hit is not None:
                out.append(tuple(hit + nrm * off))
        return out

    def crystal(name, base, d, L, r, seed):
        rnd = random.Random(seed)
        out = []
        for k in range(3):
            dd = (Vector(d) + Vector((rnd.uniform(-.35, .35), rnd.uniform(-.2, .3), rnd.uniform(-.35, .35)))).normalized()
            l = L * (1 if k == 0 else rnd.uniform(.5, .75))
            rr = r * (1 if k == 0 else .65)
            b = Vector(base) + Vector((rnd.uniform(-.3, .3), 0, rnd.uniform(-.3, .3))) * r * 2
            t = tube(name, [tuple(b - dd * .3), tuple(b + dd * l * .8), tuple(b + dd * l)], [rr, rr * .9, .01], seg=6)
            flat(t)
            C(t, lambda p, n, b=b, l=l: mix((.62, .78, .92), (1, 1, 1), sstep(0, l, (Vector(p) - b).length)))
            out.append(M(t, 'glow'))
        return out

    def socket(name, c, R_, seed, facing=(0, 0, 1)):
        """顏色核心的插座：一圈石塊圍成的凹座（核心球半徑 1.4 由網頁放上去）"""
        out = [R(name + 'Back', tuple(Vector(c) - Vector(facing) * .9), (1.25, 1.25, .5), seed, dark=.6, moss=0, n=24, box=.8, cuts=1)]
        for k in range(7):
            a = k / 7 * TAU + .3
            p = Vector(c) + Vector((math.cos(a) * R_, math.sin(a) * R_, 0)) - Vector(facing) * .15
            out.append(R(name + 'Rim', tuple(p), (.5, .5, .45), seed * 10 + k, dark=.15, moss=.4, n=14, box=.7, cuts=0,
                         B=rot3((0, 0, 1), a)))
        return out

    # ── 腿（原點在胯下 y=9，網格往下）──
    for s, nm in ((-1, 'LegA'), (1, 'LegB')):
        x = s * 3.2
        sd = 50 + (s + 1) * 20
        lp = []
        lp.append(R('Hip', (x, 8.2, 0), (2.0, 1.4, 2.0), sd + 1, dark=.3, moss=0))
        lp.append(R('Thigh', (x + s * .15, 6.55, -.25), (1.85, 1.75, 1.75), sd + 2, B=rot3((0, 0, 1), s * .08)))
        lp.append(R('ThighPlate', (x + s * 1.2, 6.9, .1), (.7, 1.5, 1.4), sd + 3, B=rot3((0, 0, 1), -s * .12)))
        lp.append(R('Knee', (x, 4.45, -.35), (1.75, 1.2, 1.55), sd + 4, dark=.35))
        lp += socket('KneeSock', (x, 4.4, .95), 1.55, sd + 5)
        lp.append(R('Shin', (x, 2.55, -.1), (1.55, 1.45, 1.55), sd + 6, B=rot3((0, 1, 0), .3 * s)))
        lp.append(R('ShinPlate', (x, 2.1, 1.15), (1.2, .9, .5), sd + 7, B=rot3((1, 0, 0), .15)))
        lp.append(R('Foot', (x + s * .1, .62, .45), (2.05, .72, 2.5), sd + 8, dark=.2, box=.55))
        for k in range(3):
            lp.append(R('Toe', (x + (k - 1) * 1.15, .45, 2.75 + (0 if k == 1 else -.2)), (.62, .5, .7), sd + 10 + k, dark=.1))
        lp.append(R('Heel', (x, .55, -1.7), (1.2, .6, .8), sd + 14, dark=.25))
        lp += [vein('Rune', on_front(lp[1:3], [(x - .9 * s, 7.6), (x - .2 * s, 6.8), (x + .1 * s, 6.1), (x + .6 * s, 5.5)]), .1)]
        L = join(lp, nm)
        origin_to(L, (x, 9, 0))
    # ── 軀幹（原點 (0,9,0)）──
    tp = []
    tp.append(R('Pelvis', (0, 9.9, -.1), (3.9, 1.35, 2.8), 101, dark=.45, moss=0))
    tp.append(R('Belly', (0, 11.7, .55), (3.2, 1.5, 2.5), 102, dark=.1))
    tp.append(R('Chest', (0, 14.6, -.2), (5.1, 3.4, 2.9), 103, n=44))
    for s in (-1, 1):
        tp.append(R('Pec', (s * 2.35, 15.1, 2.2), (2.35, 1.95, .95), 104 + s, B=rot3((0, 0, 1), s * .12) @ rot3((1, 0, 0), -.18)))
        tp.append(R('Yoke', (s * 4.9, 17.3, -.2), (1.9, 1.3, 2.3), 107 + s, dark=.1))
        tp.append(R('Flank', (s * 4.4, 12.8, 0), (1.1, 2.2, 2.2), 110 + s, dark=.25, B=rot3((0, 0, 1), -s * .15)))
    tp.append(R('Sternum', (0, 13.0, 2.45), (1.6, 1.5, .8), 113, dark=.2))
    tp.append(R('BackSlab', (0, 15.2, -2.7), (4.2, 2.8, 1.1), 114, B=rot3((1, 0, 0), .12)))
    tp.append(R('BackSlab', (0, 12.2, -2.4), (3.4, 1.4, .9), 115, dark=.2))
    tp.append(R('Neck', (0, 18.5, -.3), (1.9, .9, 1.7), 116, dark=.5, moss=0))
    # 背上的礦晶：頭目的剪影重點
    for k, (cx, cy, cz, dx, dy, dz, L_) in enumerate(((-1.8, 17.2, -2.4, -.3, .8, -.6, 4.4), (1.6, 16.4, -2.9, .35, .7, -.7, 3.6), (.2, 14.2, -3.4, 0, .45, -1, 2.8), (-3.6, 18.2, -1.6, -.5, 1, -.2, 2.4))):
        tp += crystal('Ore', (cx, cy, cz), (dx, dy, dz), L_, .62, 120 + k)
    # 胸前礦脈：從胸骨往上裂開
    front = [o for o in tp if o.name.split('.')[0] in ('Chest', 'Pec', 'Sternum', 'Belly')]
    tp.append(vein('Rune', on_front(front, [(-.1, 11.0), (.25, 12.1), (-.2, 13.2), (.1, 14.3), (-.4, 15.3), (-1.1, 16.0)]), .15))
    tp.append(vein('Rune', on_front(front, [(.1, 14.3), (.9, 15.0), (1.3, 16.2)]), .11))
    torso = join(tp, 'TorsoM')
    # ── 頭（原點 (0,20.5,.5)）：巨石頭顱、厚重的眉石、深陷的兩點光 ──
    hp = []
    hp.append(R('HeadM', (0, 20.55, .2), (2.2, 1.7, 1.95), 150, n=36))
    hp.append(R('BrowStone', (0, 21.35, 1.75), (2.45, .6, .95), 151, B=rot3((1, 0, 0), .2)))
    hp.append(R('Jaw', (0, 19.35, 1.2), (1.75, .6, 1.2), 152, dark=.45, moss=0))
    hp.append(R('Cheek', (-1.7, 20.3, 1.2), (.7, .9, .9), 153, dark=.2))
    hp.append(R('Cheek', (1.7, 20.3, 1.2), (.7, .9, .9), 154, dark=.2))
    hp.append(R('Crest', (-.4, 21.9, -.6), (1.3, .6, 1.4), 155, B=rot3((0, 0, 1), .2)))
    for s in (-1, 1):
        hp.append(R('EyeSock', (s * .85, 20.75, 2.0), (.62, .38, .25), 156 + s, dark=1, moss=0, n=16, cuts=0))
        e = ellipsoid('Eye', (s * .85, 20.75, 2.2), (.38, .2, .1), seg=14, rings=8)
        each_vert(e, lambda p, s=s: (p[0], p[1] - (p[0] - s * .85) * s * .25, p[2]))
        hp.append(M(C(e, (1, 1, 1)), 'glow'))
    head = group('Head', (0, 20.5, .5), hp)
    # ── 手臂（原點在肩 (±7,17,0)）：肩上是核心插座，末端是巨石拳頭 ──
    arms = []
    for s, nm in ((-1, 'ArmA'), (1, 'ArmB')):
        x = s * 7
        sd = 200 + (s + 1) * 30
        ap = []
        ap.append(R('Shoulder', (x, 17.5, -.9), (2.0, 1.9, 1.7), sd + 1))
        ap += socket('ShoulderSock', (x, 17.5, .75), 1.6, sd + 2)
        ap.append(R('Pauldron', (x + s * .6, 19.2, -.4), (1.9, .8, 2.0), sd + 3, B=rot3((0, 0, 1), -s * .25)))
        ap.append(R('Upper', (x + s * .2, 13.9, -.2), (1.5, 2.3, 1.5), sd + 4))
        ap.append(R('Elbow', (x, 11.5, -.1), (1.3, 1.0, 1.3), sd + 5, dark=.45, moss=0))
        fore = [R('Fore', (x, 9.4, .1), (1.65, 1.85, 1.65), sd + 6), R('ForePlate', (x + s * 1.1, 9.8, .2), (.6, 1.5, 1.3), sd + 7, B=rot3((0, 0, 1), -s * .1))]
        ap += fore
        ap.append(R('Fist', (x, 6.6, .15), (2.05, 1.75, 2.0), sd + 8, box=.55))
        for k in range(4):
            ap.append(R('Knuckle', (x - 1.15 * s + k * .77 * s, 5.35, 1.15), (.52, .62, .6), sd + 10 + k, dark=.1, n=18))
        ap.append(R('Thumb', (x - s * 1.6, 6.4, 1.3), (.6, .8, .65), sd + 15, dark=.1, n=18))
        ap.append(vein('Rune', on_front(fore, [(x + .7 * s, 10.6), (x - .1 * s, 9.9), (x + .2 * s, 8.9), (x - .5 * s, 8.2)]), .1))
        a = join(ap, nm)
        origin_to(a, (x, 17, 0))
        arms.append(a)
    group('Torso', (0, 9, 0), [torso, head] + arms)


boss('colossus', colossus, floor=.38)

if RENDER:
    for i, r in enumerate(ROOTS):
        r.location = V([-14, 0, 22][i], 0, 0)
    preview(os.path.join(PREV, 'bosses.png'), target=(4, 11, 0), dist=70, yaw=10, pitch=8, res=(1400, 800))
    for (x, ty, d, nm) in ((-14, 3.5, 17, 'thornmaw'), (0, 2, 17, 'magmander'), (22, 12, 50, 'colossus')):
        preview(os.path.join(PREV, nm + '.png'), target=(x, ty, 0), dist=d, yaw=30, pitch=12, res=(900, 900))
for r in ROOTS:
    r.location = V(0, 0, 0)
export(OUT, ROOTS, uv=True)
