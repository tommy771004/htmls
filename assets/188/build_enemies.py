# 188 彩筆曠野：敵人外型模板（37 種敵人共用 22 個模板，顏色由網頁依種類上色）
# 重建：/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P assets/188/build_enemies.py
#   環境變數：OUT=輸出 glb（預設 assets/188/enemies.glb）、RENDER=1 預覽圖存到 PREV、AO=烘焙取樣數、
#            ONLY=humanoid,blob…（只建這幾個模板，迭代用；網頁對缺少的模板會退回程序化外型）
# 每個模板是一個空物件 E_<名稱>，底下是具名零件，網頁的動畫程式依名稱驅動：
#   Leg* 腳（原點在關節）、WingL/WingR 翅膀、Arm* 手臂、Weapon 武器掛點（底下 W_club 等擇一顯示）、Shield 盾、
#   Squash 會壓扁的身體、Head 會脈動的頭、Gear 齒輪、Lid 寶箱蓋、Teeth/Tongue、Seg0~6 蛇身、opt_*／x_* 依種類顯示的配件
#   （同名的 opt_*／x_* 可以有好幾組，例如掛在手臂、腿上的護具，網頁比對時去掉「__序號」一起切換）
# 材質：c1、c2 會乘上種類顏色（頂點色只存明暗細節）；fixed 是固定顏色；glow 自發光（乘 c1）
# 有機形體用 metaball 融合再轉網格（mball），眼睛是眼白、虹膜、瞳孔畫在同一顆眼球上，眼皮壓低做出表情
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from bw_lib import *

OUT = os.environ.get('OUT', os.path.join(HERE, 'enemies.glb'))
PREV = os.environ.get('PREV', '/tmp/bw188')
RENDER = os.environ.get('RENDER', '1') == '1'
AO = int(os.environ.get('AO', '32'))
ONLY = [s for s in os.environ.get('ONLY', '').split(',') if s]
os.makedirs(PREV, exist_ok=True)
reset()
random.seed(37)
_sc = bpy.context.scene
if not _sc.world:
    _sc.world = bpy.data.worlds.new('W')
_sc.world.light_settings.distance = .8
ROOTS = []
_track = []

# ── 固定色盤（偏灰、偏土，BOTW 那種霧霧的顏色）──
BONE = 0xe6dcc2
BONE_D = 0xb3a584
WOOD = 0x8a6242
WOOD_D = 0x5c3e28
ROPE = 0xc4ac7e
LINEN = 0xd8ccb0
IRON = 0x6f717a
IRON_L = 0xa3a5ad
BRASS = 0xc2a050
MOUTH = 0x46202a
TONGUE = 0xb05a64
PUPIL = 0x161219
SCLERA = 0xf2ede2
AMBER = 0xcf8a2c
SNOUT = 0xb8878a
INK = 0x221d2a


def nz(p, f=1.0, s=0):
    return noise.noise(Vector((p[0] * f + s, p[1] * f + s * .7, p[2] * f - s)))


def fb(p, f=1.0, s=0, o=3):
    return noise.fractal(Vector((p[0] * f + s, p[1] * f + s * .7, p[2] * f - s)), .6, 2.0, o, noise_basis='PERLIN_ORIGINAL')


def clamp01(x):
    return max(0.0, min(1.0, x))


def shade(c, k):
    c = hexrgb(c)
    return tuple(clamp01(x * k) for x in c)


def G(ob, lo=.78, hi=1.0, f=3.0, s=0):
    """c1／c2 用的灰階細節：朝上亮、朝下暗，加一點雜訊"""
    paint(ob, lambda p, n: (lambda k: (k, k, k))(lo + (hi - lo) * (.55 + .35 * n[1] + .15 * nz(p, f, s))))
    return ob


def Vp(ob, fn):
    """灰階明暗：fn(p, n) → 0..1"""
    paint(ob, lambda p, n: (lambda k: (k, k, k))(clamp01(fn(p, n))))
    return ob


def C(ob, fn_or_hex):
    paint(ob, fn_or_hex if callable(fn_or_hex) else (lambda p, n: hexrgb(fn_or_hex)))
    return ob


def Cg(ob, lo, hi, f=5.0, s=0, up=.35):
    """固定色：lo→hi 依朝上程度與雜訊漸層"""
    return C(ob, lambda p, n: mix(lo, hi, .5 + up * n[1] + .25 * nz(p, f, s)))


def paint_idx(ob, fn):
    """依頂點序號上色（管子一圈一圈建，可做繩索斜紋）：fn(i, p) → rgb"""
    me = ob.data
    col = me.color_attributes.get('Col') or me.color_attributes.new('Col', 'FLOAT_COLOR', 'POINT')
    me.color_attributes.active_color = col
    mw = ob.matrix_world
    arr = np.zeros(len(me.vertices) * 4, dtype=np.float32)
    for i, v in enumerate(me.vertices):
        c = hexrgb(fn(i, Vector(T(mw @ v.co))))
        arr[i * 4:i * 4 + 4] = (srgb2lin(c[0]), srgb2lin(c[1]), srgb2lin(c[2]), 1.0)
    col.data.foreach_set('color', arr)
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


def J(objs, name):
    """合併成一個網格，並把旋轉／縮放烘進頂點（第一塊若帶旋轉，匯出後的包圍盒會被撐大，網頁算血條高度與碰撞半徑會失準）"""
    objs = [o for o in objs if o is not None]
    if len(objs) == 1:
        ob = objs[0]
        ob.name = name
    else:
        ob = join(objs, name)
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    return ob


# ── metaball：把橢球、膠囊融在一起再轉成網格；neg=True 是往內挖（眼窩、鼻孔、嘴） ──
_mbn = [0]


def _kr(s):
    # 門檻 .6 時，單顆元素的表面半徑 ＝ radius × _kr(stiffness)
    return math.sqrt(1 - (0.6 / s) ** (1 / 3))


def Bm(c, r, s=2.0, neg=False):
    return ('BALL', c, r, None, None, s, neg)


def Em(c, rr, s=2.0, neg=False, rot=None, axes=None):
    """rr = three 座標三軸半徑；rot = 角度（同 place）；axes = (X, Y, Z) 三個 three 向量，rr 依序沿這三軸"""
    return ('ELLIPSOID', c, 1.0, rr, (rot, axes), s, neg)


def Km(a, b, r, s=2.0, neg=False):
    return ('CAPSULE', (a, b), r, None, None, s, neg)


def _rotq(rot):
    Q = Matrix.Rotation(math.radians(rot[1]), 3, 'Z') @ Matrix.Rotation(math.radians(rot[0]), 3, 'X') @ Matrix.Rotation(math.radians(-rot[2]), 3, 'Y')
    return Q.to_quaternion()


def mball(name, els, res=.05, slot='c1', target=None, thr=.6, sm=3):
    for attempt in range(6):
        _mbn[0] += 1
        nm = 'mbz%dq' % _mbn[0]
        mb = bpy.data.metaballs.new(nm)
        mb.resolution = res
        mb.render_resolution = res
        mb.threshold = thr
        ob = bpy.data.objects.new(nm, mb)
        bpy.context.scene.collection.objects.link(ob)
        for (typ, c, r, rr, rot, s, neg) in els:
            e = mb.elements.new()
            e.type = typ
            e.stiffness = s
            e.use_negative = neg
            k = _kr(s)
            if typ == 'BALL':
                e.co = V(*c)
                e.radius = r / k
            elif typ == 'ELLIPSOID':
                e.co = V(*c)
                e.radius = 1.0 / k
                rt, axes = rot
                if axes:
                    X, Y, Z = [V(*a).normalized() for a in axes]
                    m3 = Matrix((X, Y, Z)).transposed()
                    e.rotation = m3.to_quaternion()
                    e.size_x, e.size_y, e.size_z = rr[0], rr[1], rr[2]
                else:
                    e.size_x, e.size_y, e.size_z = rr[0], rr[2], rr[1]
                    if rt:
                        e.rotation = _rotq(rt)
            else:
                a, b = V(*c[0]), V(*c[1])
                d = b - a
                e.co = (a + b) / 2
                e.radius = r / k
                e.size_x = max(d.length / 2, 1e-4)
                e.rotation = Vector((1, 0, 0)).rotation_difference(d.normalized())
        bpy.context.view_layer.update()
        for o in bpy.context.view_layer.objects:
            o.select_set(False)
        bpy.context.view_layer.objects.active = ob
        ob.select_set(True)
        bpy.ops.object.convert(target='MESH')
        m = bpy.context.active_object
        m.data.calc_loop_triangles()
        nt = len(m.data.loop_triangles)
        if target and attempt < 5 and (nt > target * 1.15 or nt < target * .6):
            res *= math.sqrt(nt / target)
            bpy.data.objects.remove(m)
            bpy.context.view_layer.update()
            continue
        break
    m.name = name
    m.data.name = name
    if sm:
        # 抹平 metaball 的階梯感（Laplacian 保體積）
        md = m.modifiers.new('ls', 'LAPLACIANSMOOTH')
        md.iterations = sm
        md.lambda_factor = .6
        md.use_volume_preserve = True
        apply_mods(m)
    m.data.materials.clear()
    m.data.materials.append(mat(slot))
    for p in m.data.polygons:
        p.use_smooth = True
    return m


def basis(fwd):
    f = Vector(fwd).normalized()
    x = Vector((0, 1, 0)).cross(f)
    if x.length < 1e-4:
        x = Vector((1, 0, 0))
    x.normalize()
    return x, f.cross(x), f


def polar(name, c, r, fwd, angs, seg=14, slot='fixed', sc=(1, 1, 1)):
    """極軸朝 fwd 的球，angs 是各圈的極角（度），方便依極角畫同心圓（眼睛的瞳孔、虹膜）"""
    X, Y, F = basis(fwd)
    C0 = Vector(c)
    bm = bmesh.new()
    rings = []
    for a in angs:
        t = math.radians(a)
        if a <= 0 or a >= 180:
            rings.append([bm.verts.new(V(*(C0 + F * (r * sc[2] * math.cos(t)))))])
            continue
        ring = []
        for i in range(seg):
            ph = i / seg * TAU
            q = C0 + X * (math.sin(t) * math.cos(ph) * r * sc[0]) + Y * (math.sin(t) * math.sin(ph) * r * sc[1]) + F * (math.cos(t) * r * sc[2])
            ring.append(bm.verts.new(V(*q)))
        rings.append(ring)
    for k in range(len(rings) - 1):
        A, B = rings[k], rings[k + 1]
        if len(A) == 1:
            for i in range(seg):
                bm.faces.new((A[0], B[i], B[(i + 1) % seg]))
        elif len(B) == 1:
            for i in range(seg):
                bm.faces.new((A[i], B[0], A[(i + 1) % seg]))
        else:
            for i in range(seg):
                bm.faces.new((A[i], B[i], B[(i + 1) % seg], A[(i + 1) % seg]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return obj_from_bm(bm, name, slot=slot)


def eyeball(c, r, fwd=(0, 0, 1), iris=AMBER, pa=15, ia=33, seg=11, glint=True, sclera=SCLERA, pupil=PUPIL, name='EyeBall'):
    """一顆眼球：瞳孔、虹膜（上暗下亮）、深色虹膜外圈、眼白往後漸暗；亮點另做一小顆"""
    angs = [0, pa, pa + 2.5, ia - 5, ia, ia + 3, 65, 120, 180]
    ob = polar(name, c, r, fwd, angs, seg=seg)
    X, Y, F = basis(fwd)
    C0 = Vector(c)

    def fn(p, n):
        d = (p - C0).normalized()
        th = math.degrees(math.acos(max(-1, min(1, d.dot(F)))))
        up = d.dot(Y)
        if th < pa + .5:
            return hexrgb(pupil)
        if th < ia + .5:
            k = (th - pa) / (ia - pa)
            return shade(iris, (.75 + .45 * k) * (1 - .25 * max(0, up)))
        if th < ia + 3.5:
            return shade(iris, .35)
        return mix(sclera, shade(sclera, .78), sstep(60, 140, th) + .25 * max(0, up))
    C(ob, fn)
    out = [ob]
    if glint:
        g = ellipsoid('Glint', tuple(C0 + (F * .88 + Y * .38 - X * .28).normalized() * r * .97), (r * .16, r * .16, r * .1), seg=6, rings=3)
        out.append(C(g, 0xffffff))
    return out


def eyelid(c, r, sd, tilt=20, off=.2, slot='c1', k=1.14, fwd=(0, 0, 1), val=.9, name='EyeLid'):
    """眼皮：比眼球略大的球，低於斜切面的頂點壓到切面上 → 平底的帽子蓋住上半顆眼睛。
    tilt>0 內眼角較低（兇），tilt<0 外眼角低（哀）；off 是切面高度（眼球半徑的倍數，越小蓋越多）"""
    ob = ellipsoid(name, c, (r * k, r * k, r * k), seg=11, rings=7, slot=slot)
    t = math.radians(tilt)
    X, Y, F = basis(fwd)
    n = (Y * math.cos(t) - Vector((1, 0, 0)) * (sd * math.sin(t))).normalized()
    C0 = Vector(c)

    def fn(p):
        d = (p - C0).dot(n) - off * r
        if d < 0:
            return p - n * d
        return p
    each_vert(ob, fn)
    Vp(ob, lambda p, nn: (val - .38) if (p - C0).dot(n) - off * r < r * .06 else val + .06 * nn[1])
    return ob


def eye_pair(c, sp, r, conv=.12, tilt=20, off=.2, lidslot='c1', iris=AMBER, pa=15, ia=33, lidk=1.14, lidval=.9, down=0.0, lower=None):
    out = []
    for sd in (1, -1):
        cc = (c[0] + sd * sp, c[1], c[2])
        fwd = (sd * conv, -down, 1)
        out += eyeball(cc, r, fwd, iris=iris, pa=pa, ia=ia)
        if tilt is not None:
            out.append(eyelid(cc, r, sd, tilt=tilt, off=off, slot=lidslot, k=lidk, fwd=fwd, val=lidval))
        if lower is not None:
            lo = eyelid(cc, r, sd, tilt=0, off=lower, slot=lidslot, k=lidk * .98, fwd=fwd, val=lidval)
            each_vert(lo, lambda p, cy=cc[1]: (p[0], 2 * cy - p[1], p[2]))
            lo.data.flip_normals()
            out.append(lo)
    return out


def fm(X, Y, Z):
    """4x4：物件區域（three 座標）的 x、y、z 軸轉到 X、Y、Z（three 向量）"""
    return Matrix((V(*X), -V(*Z), V(*Y))).transposed().to_4x4()


def leafy(name, L, W, th, cup=.0, bend=.0, taper=.8, seg=10, rings=8, slot='fixed', root_w=.5):
    """葉片／耳朵形：沿 x 從根部 (0) 長到尖端 (L)，寬 W、厚 th；cup>0 往 +z 凹成杯狀，bend>0 尖端往 -z 彎"""
    ob = ellipsoid(name, (0, 0, 0), (W, L / 2, th), seg=seg, rings=rings, slot=slot)

    def fn(p):
        x, y, z = p[1], p[0], p[2]
        u = min(1.0, max(0.0, (x + L / 2) / L))
        w = (root_w + (1 - root_w) * sstep(0, .35, u)) * min(1.0, ((1 - u) / .65) ** taper) / max(1e-3, math.sqrt(max(1e-4, 1 - (2 * u - 1) ** 2)))
        w = min(w, 3.0)
        y *= w
        z += cup * (y / W) ** 2 * W - bend * u * u * L
        return (x + L / 2, y, z)
    each_vert(ob, fn)
    bm = bmesh.new(); bm.from_mesh(ob.data); bmesh.ops.recalc_face_normals(bm, faces=bm.faces); bm.to_mesh(ob.data); bm.free()
    return ob


def dec(ob, ratio):
    """collapse 減面（保留頂點色）；給配件用，避免超過三角形預算"""
    if ratio < 1:
        m = ob.modifiers.new('dec', 'DECIMATE')
        m.ratio = ratio
        apply_mods(ob)
    return ob


def surf(ob, origin, d):
    """從 origin 沿 d 打射線到 ob 表面，回傳 (點, 法線)（three 座標）；打不到回傳 (None, None)"""
    bpy.context.view_layer.update()
    mw = ob.matrix_world
    mi = mw.inverted()
    o = mi @ V(*origin)
    dd = (mi.to_3x3() @ V(*d)).normalized()
    ok, loc, nrm, idx = ob.ray_cast(o, dd)
    if not ok:
        return None, None
    return Vector(T(mw @ loc)), Vector(T((mw.to_3x3() @ nrm).normalized()))


def cone(name, a, b, r, seg=5, r2=.002):
    return tube(name, [a, b], [r, r2], seg=seg)


def curve_cone(name, pts, r0, seg=6, r1=.002):
    n = len(pts)
    return tube(name, pts, [r0 + (r1 - r0) * (k / (n - 1)) ** .9 for k in range(n)], seg=seg)


def orient(ob, pos, up, spin=0):
    """把物件（網格建在原點附近）移到 pos，並讓區域 +y 對齊 up"""
    q = Vector((0, 0, 1)).rotation_difference(V(*up).normalized())
    R = q.to_matrix().to_4x4() @ Matrix.Rotation(math.radians(spin), 4, 'Z')
    ob.matrix_world = Matrix.Translation(V(*pos)) @ R
    bpy.context.view_layer.update()
    return ob


def bump(name, pos, up, r, h, col, seg=8, rings=5, slot='fixed', wob=0.0, spin=0):
    b = ellipsoid(name, (0, 0, 0), (r, h, r * (1 + wob)), seg=seg, rings=rings, slot=slot)
    orient(b, pos, up, spin)
    if isinstance(col, (int, tuple)):
        C(b, col)
    return b


def band(name, a, b, r, col, seg=10, bulge=1.06, stripes=0, slot='fixed', dark=.72):
    """纏在肢體上的繩帶／布條：兩端收進肢體裡；stripes>0 畫斜紋"""
    A, B = Vector(a), Vector(b)
    n = 4
    pts = [tuple(A + (B - A) * (k / (n - 1))) for k in range(n)]
    rad = [r, r * bulge, r * bulge, r]
    ob = tube(name, pts, rad, seg=seg, slot=slot)
    if slot == 'fixed':
        paint_idx(ob, lambda i, p: shade(col, 1.0 if not stripes else (dark + (1 - dark) * (.5 + .5 * math.sin((i % seg) / seg * TAU * stripes + (i // seg) * 2.2)))))
    else:
        paint_idx(ob, lambda i, p: (lambda k: (k, k, k))(1.0 if not stripes else (dark + (1 - dark) * (.5 + .5 * math.sin((i % seg) / seg * TAU * stripes + (i // seg) * 2.2)))))
    return ob


def ring(name, c, rx, rz, r, col, seg=8, n=32, y_fn=None, stripes=0, slot='fixed', dark=.7):
    """水平的一圈繩子／皮帶（腰帶、帽帶）"""
    pts = []
    for i in range(n + 1):
        a = i / n * TAU
        pts.append((c[0] + math.cos(a) * rx, c[1] + (y_fn(a) if y_fn else 0), c[2] + math.sin(a) * rz))
    ob = tube(name, pts, r, seg=seg, slot=slot, caps=False)
    base = hexrgb(col) if slot == 'fixed' else (1, 1, 1)
    paint_idx(ob, lambda i, p: shade(base, 1.0 if not stripes else dark + (1 - dark) * (.5 + .5 * math.sin((i % seg) / seg * TAU + (i // seg) * stripes))))
    return ob


def rag_hem(ob, y0, depth, teeth, seed=0, below=.02):
    """布料下擺剪成不規則的鋸齒：y0 以下的頂點依角度往下拉"""
    def fn(p):
        if p[1] > y0 + below:
            return None
        a = math.atan2(p[2], p[0])
        tri = abs(((a / TAU * teeth + .5 * nz((a, 0, 0), 3, seed)) % 1) - .5) * 2
        return (p[0], p[1] - depth * (tri * .8 + .2 * (.5 + .5 * nz((a * 3, seed, 0), 2, seed))), p[2])
    each_vert(ob, fn)


def ao_smooth(objs, samples=32, floor=.5, iters=3):
    """同 bw_lib.ao_bake，但烘好的 AO 先沿網格邊做幾次平均：少量取樣的顆粒雜訊在卡通著色下會變成一塊塊的斑"""
    sc = bpy.context.scene
    sc.cycles.samples = samples
    for ob in objs:
        me = ob.data
        if not me.color_attributes.get('Col'):
            solid(ob, 0xffffff, 0)
        ao = me.color_attributes.new('AO', 'FLOAT_COLOR', 'POINT')
        me.color_attributes.active_color = ao
        for o in bpy.context.view_layer.objects:
            o.select_set(False)
        ob.select_set(True)
        bpy.context.view_layer.objects.active = ob
        try:
            bpy.ops.object.bake(type='AO', target='VERTEX_COLORS')
            nv = len(me.vertices)
            a = np.zeros(nv * 4, dtype=np.float32)
            ao.data.foreach_get('color', a)
            a = a.reshape(-1, 4)[:, 0].astype(np.float64)
            ev = np.zeros(len(me.edges) * 2, dtype=np.int64)
            me.edges.foreach_get('vertices', ev)
            ev = ev.reshape(-1, 2)
            deg = np.bincount(ev.ravel(), minlength=nv).astype(np.float64)
            for _ in range(iters):
                acc = np.zeros(nv)
                np.add.at(acc, ev[:, 0], a[ev[:, 1]])
                np.add.at(acc, ev[:, 1], a[ev[:, 0]])
                a = np.where(deg > 0, .4 * a + .6 * acc / np.maximum(deg, 1), a)
            k = floor + (1 - floor) * np.clip(a, 0, 1)
            b = np.zeros(nv * 4, dtype=np.float32)
            me.color_attributes['Col'].data.foreach_get('color', b)
            b = b.reshape(-1, 4)
            b[:, :3] *= k[:, None]
            me.color_attributes['Col'].data.foreach_set('color', b.ravel())
        except Exception as e:
            print('AO bake failed for', ob.name, e)
        me.color_attributes.remove(me.color_attributes['AO'])
        me.color_attributes.active_color = me.color_attributes['Col']


def template(name, build):
    if ONLY and name not in ONLY:
        return None
    before = begin()
    build()
    objs = new_objs(before)
    # Blender 的名稱全域唯一，同名零件會變成 xxx.001；統一改成「名稱__序號」，網頁比對時去掉後綴
    for o in objs:
        o.name = o.name.split('.')[0] + '__%d' % len(_track)
        _track.append(o.name)
        # 多材質網格匯出後，three 會把各材質拆成子 Mesh 並以「網格資料名」命名；
        # 資料名若跟物件同名（例如 Leg0），子網格也會被網頁當成 Leg0 再轉一次 → 改成不會撞名的資料名
        if o.type == 'MESH':
            o.data.name = 'm_' + o.name.split('__')[0] + '_%d' % len(_track)
    meshes = [o for o in objs if o.type == 'MESH']
    if AO:
        ao_smooth(meshes, samples=AO, floor=.5)
    root = empty('E_' + name, (0, 0, 0))
    for o in objs:
        if o.parent is None:
            set_parent(o, root)
    ROOTS.append(root)
    print(name, 'tris', tri_count(meshes), 'objs', len(meshes))
    for o in sorted(meshes, key=lambda o: -tri_count([o])):
        print('   tris', o.name, tri_count([o]))
    # 挪開，免得擋到下一個模板的 AO
    root.location = V(len(ROOTS) * 30, 0, 0)
    return root


# ═════════ 人形（哥布林體型）：帽盔、臉部特徵與服裝都放在 opt_* 裡，依種類切換 ═════════
HR = (-.52, .66, .15)  # 右手（武器掛點）
HL = (.52, .66, .15)


def skin_val(belly=True, spots=0.0, s=0):
    def fn(p, n):
        v = .86 + .07 * n[1] + .05 * fb(p, 3.0, s)
        if belly:
            fr = sstep(-.02, .16, p[2]) * sstep(.3, .1, abs(p[0])) * sstep(1.2, 1.0, p[1]) * sstep(.45, .6, p[1])
            v = v * (1 - fr) + 1.0 * fr
        bk = sstep(.0, -.2, p[2])
        v -= .07 * bk
        if spots and nz(p, 6.0, s + 3) > .28:
            v -= spots * bk
        return v
    return fn


def humanoid():
    # 軀幹：骨盆、肚子、胸、肩、脖子，微駝
    torso = mball('Body', [
        Em((0, .64, -.02), (.27, .17, .21)),
        Em((0, .84, .05), (.3, .25, .25)),
        Em((0, 1.05, -.01), (.32, .2, .22)),
        Km((-.27, 1.16, -.04), (.27, 1.16, -.04), .1),
        Bm((0, 1.1, -.14), .17),
        Km((0, 1.18, -.03), (0, 1.4, .03), .11),
    ], slot='c1', target=570)
    Vp(torso, skin_val(spots=.05))
    # 頭：顱、臉頰下巴、眉骨、眼窩
    head = mball('HeadMesh', [
        Em((0, 1.62, 0), (.38, .35, .36)),
        Em((0, 1.5, .12), (.33, .2, .27)),
        Km((-.2, 1.73, .25), (.2, 1.73, .25), .07, s=3),
        Bm((.155, 1.64, .37), .08, s=4, neg=True), Bm((-.155, 1.64, .37), .08, s=4, neg=True),
    ], slot='c1', target=480)
    Vp(head, lambda p, n: .87 + .08 * n[1] + .05 * fb(p, 4, 2) - .1 * sstep(1.45, 1.3, p[1]) * sstep(.1, -.1, p[2]))
    ey = eye_pair((0, 1.64, .305), .155, .092, tilt=22, off=.18)
    headm = J([head] + ey, 'HeadMesh')

    # 腿：大腿、小腿、腳掌三趾與爪
    legs = []
    for s, nm in ((1, 'LegL'), (-1, 'LegR')):
        x = s * .17
        hip, kn, an = (s * .16, .6, 0), (x * 1.08, .33, .06), (x * 1.1, .13, -.01)
        lg = mball('LegMesh', [
            Km(hip, kn, .12), Km(kn, an, .085), Bm((x * 1.1, .27, -.03), .095),
            Em((x * 1.1, .07, .09), (.12, .07, .16)), Bm((x * 1.1, .08, -.05), .075),
        ] + [Bm((x * 1.1 + dx, .055, .23), .052, s=3) for dx in (-.075, 0, .075)], slot='c1', target=320)
        Vp(lg, lambda p, n: .86 + .08 * n[1] + .04 * fb(p, 4) - .1 * sstep(.05, 0, p[1]))
        cl = [Cg(cone('Claw', (x * 1.1 + dx, .05, .26), (x * 1.1 + dx * 1.1, .015, .33), .03, seg=5), BONE_D, BONE) for dx in (-.075, 0, .075)]
        lg = J([lg] + cl, nm)
        pivot(lg, hip)
        legs.append(lg)

    # 手臂：長臂垂到大腿，握拳（武器從拳頭穿過）
    arms = []
    for s, nm in ((1, 'ArmL'), (-1, 'ArmR')):
        S, E, W, H = (s * .3, 1.17, -.03), (s * .45, .9, -.03), (s * .5, .74, .09), (s * .52, .66, .15)
        ar = mball('ArmMesh', [
            Km(S, E, .085), Bm((s * .33, 1.12, -.02), .11), Km(E, W, .07),
            Em((s * .48, .82, .03), (.08, .1, .08)),
            Em(H, (.09, .095, .095)),
            Km((s * .46, .69, .225), (s * .59, .69, .2), .042, s=3),
            Km((s * .45, .72, .13), (s * .44, .665, .22), .033, s=3),
        ], slot='c1', target=360)
        Vp(ar, lambda p, n: .87 + .08 * n[1] + .04 * fb(p, 4, 5))
        cl = [Cg(cone('Claw', (s * (.475 + .055 * k), .675, .245), (s * (.48 + .058 * k), .64, .28), .018, seg=4), BONE_D, BONE) for k in range(3)]
        ar = J([ar] + cl, nm)
        pivot(ar, S)
        arms.append(ar)

    # ── 武器（在右手的區域座標裡建，再整組移到手上） ──
    W = []
    # 棍棒：粗樹枝、樹瘤、骨刺、握把纏繩
    club = lathe('Club', [(.001, -.17), (.04, -.16), (.05, -.12), (.05, .1), (.058, .3), (.08, .5), (.115, .7), (.14, .84), (.13, .95), (.08, 1.02), (.001, 1.05)], seg=10,
                 wobble=lambda a, y: .12 * nz((math.cos(a), y * 3, math.sin(a)), 1.5, 4) * sstep(.2, .6, y))
    C(club, lambda p, n: mix(WOOD_D, WOOD, .45 + .35 * math.sin(math.atan2(p[2], p[0]) * 5 + nz(p, 6) * 3) * sstep(.1, .3, p[1]) + .2 * n[1]) if p[1] < 1.0 else hexrgb(0xb89468))
    grip = [band('Grip', (0, -.1, 0), (0, .16, 0), .056, 0x6b4a30, stripes=3)]
    spikes = []
    for k, (a, y) in enumerate([(0.3, .78), (2.2, .86), (4.1, .74), (5.4, .9), (1.2, .62)]):
        d = Vector((math.cos(a), .25, math.sin(a))).normalized()
        base = Vector((math.cos(a) * .1, y, math.sin(a) * .1))
        spikes.append(Cg(cone('Spike', tuple(base), tuple(base + d * (.16 if k != 4 else .12)), .035, seg=4), BONE_D, BONE))
    W.append(group('W_club', (0, 0, 0), [J([club] + grip + spikes, 'ClubM')]))
    # 弓：反曲弓、握把纏布、弓弦
    bp = [(0, -.55, -.06), (0, -.42, .02), (0, -.2, .1), (0, 0, .13), (0, .2, .1), (0, .42, .02), (0, .55, -.06), (0, .6, -.02)]
    bow = tube('Bow', [(0, -.6, -.02)] + bp[:-1] + [bp[-1]], [.02, .03, .036, .04, .045, .04, .036, .03, .02], seg=6, flat=.7)
    Cg(bow, WOOD_D, WOOD)
    bstr = C(tube('String', [(0, -.56, -.05), (0, .56, -.05)], .007, seg=4), LINEN)
    bgrip = band('Grip', (0, -.08, .125), (0, .09, .125), .05, 0x7a3a30, stripes=2)
    tips = [Cg(cone('Tip', (0, sy * .55, -.06), (0, sy * .66, -.0), .03, seg=4), BONE_D, BONE) for sy in (-1, 1)]
    W.append(group('W_bow', (0, 0, 0), [J([bow, bstr, bgrip] + tips, 'BowM')]))
    # 投石索：皮繩、皮兜、石頭
    sl = tube('Sling', [(0, .02, 0), (.02, -.15, .04), (.05, -.3, .02), (.08, -.42, 0)], .016, seg=5)
    C(sl, 0x6b4a30)
    pouch = C(ellipsoid('Pouch', (.08, -.48, 0), (.1, .06, .08), seg=10, rings=6), 0x5a3a26)
    stone = Cg(ico('Stone', (.08, -.44, .0), (.075, .07, .075), sub=1), 0x6a6670, 0x9a96a0)
    W.append(group('W_sling', (0, 0, 0), [J([sl, pouch, stone], 'SlingM')]))
    # 盾＋劍：褪色的鳶形盾（鐵邊、盾心、褪掉的紋章），劍有血槽、護手、纏柄
    bm = bmesh.new()
    NU, NV = 6, 8
    grid = []
    for j in range(NV):
        t = j / (NV - 1)
        y = .42 - t * .9
        hw = .34 * (1 - sstep(.35, 1.0, t) ** 1.3) + .01
        row = []
        for i in range(NU):
            u = (i / (NU - 1)) * 2 - 1
            x = u * hw
            z = .08 * (1 - u * u) + .03 * (1 - (2 * t - 1) ** 2)
            row.append(bm.verts.new(V(x, y, z)))
        grid.append(row)
    back = []
    for j in range(NV):
        row = []
        for i in range(NU):
            p = Vector(T(grid[j][i].co))
            row.append(bm.verts.new(V(p.x, p.y, p.z - .045)))
        back.append(row)
    for j in range(NV - 1):
        for i in range(NU - 1):
            bm.faces.new((grid[j][i], grid[j + 1][i], grid[j + 1][i + 1], grid[j][i + 1]))
            bm.faces.new((back[j][i], back[j][i + 1], back[j + 1][i + 1], back[j + 1][i]))
    edge = [grid[0][i] for i in range(NU)] + [grid[j][NU - 1] for j in range(1, NV)] + [grid[NV - 1][i] for i in range(NU - 2, -1, -1)] + [grid[j][0] for j in range(NV - 2, 0, -1)]
    edgeb = [back[0][i] for i in range(NU)] + [back[j][NU - 1] for j in range(1, NV)] + [back[NV - 1][i] for i in range(NU - 2, -1, -1)] + [back[j][0] for j in range(NV - 2, 0, -1)]
    for k in range(len(edge)):
        a, b = edge[k], edge[(k + 1) % len(edge)]
        c, d = edgeb[(k + 1) % len(edge)], edgeb[k]
        if a != b:
            try:
                bm.faces.new((a, b, c, d))
            except ValueError:
                pass
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    sh = obj_from_bm(bm, 'ShieldFace')

    def shield_col(p, n):
        # 褪色的藍灰底、斜向的淡紅帶紋章、刮痕
        base = mix(0x6a6f86, 0x8a8ea4, .5 + .3 * n[1] + .2 * nz(p, 7))
        dd = abs(p[0] * .8 + (p[1] - .02) * .6)
        if dd < .07:
            base = mix(0x9a5a4e, 0xb0766a, .5 + .5 * nz(p, 9))
        if n[2] < .2:
            base = hexrgb(0x4a4238)
        return mix(base, 0xb8b6c0, .35 * sstep(.35, .6, nz(p, 14, 3)))
    C(sh, shield_col)
    # 鐵邊沿外框走一圈
    def sh_pt(u, t):
        y = .42 - t * .9
        hw = .34 * (1 - sstep(.35, 1.0, t) ** 1.3) + .01
        return (u * hw, y, .08 * (1 - u * u) + .03 * (1 - (2 * t - 1) ** 2) - .02)
    path = [sh_pt(-1 + 2 * i / 4, 0) for i in range(5)] + [sh_pt(1, j / 7) for j in range(1, 8)] + [sh_pt(-1, 1 - j / 7) for j in range(1, 8)]
    rim = tube('Rim', path, .028, seg=4, caps=False)
    Cg(rim, IRON, IRON_L)
    boss = C(ellipsoid('Boss', (0, .06, .12), (.085, .085, .05), seg=7, rings=4), lambda p, n: mix(IRON, IRON_L, .5 + .5 * n[1]))
    rivets = [Cg(ellipsoid('Rivet', sh_pt(u, t)[:2] + (sh_pt(u, t)[2] + .025,), (.022, .022, .015), seg=5, rings=3), IRON, IRON_L) for u, t in [(-.8, .05), (.8, .05), (0, .02)]]
    shield = J([sh, rim, boss] + rivets, 'Shield')
    place(shield, (.02, .12, .2), (0, -25, 0))
    blade = tube('Blade', [(0, .02, 0), (0, .5, 0), (0, .88, 0), (0, 1.0, 0)], [.05, .048, .038, .002], seg=4, flat=.18)
    C(blade, lambda p, n: mix(0x9aa0aa, 0xd4d8de, .5 + .5 * n[1]) if abs(p[0]) > .012 else hexrgb(0x7c8290))
    guard = C(tube('Guard', [(-.13, 0, 0), (-.05, .01, 0), (.05, .01, 0), (.13, 0, 0)], [.02, .028, .028, .02], seg=6), BRASS)
    hilt = band('Hilt', (0, -.2, 0), (0, -.01, 0), .03, 0x4a3024, stripes=3)
    pom = C(ellipsoid('Pommel', (0, -.22, 0), (.04, .04, .04), seg=8, rings=5), BRASS)
    sword = J([blade, guard, hilt, pom], 'Sword')
    W.append(group('W_shield', (0, 0, 0), [shield, sword]))
    # 大畫筆：漆木筆桿、金屬箍、墨色筆毛（尖端滴下）
    bh = tube('BrushH', [(0, -.35, 0), (0, .5, 0), (0, 1.22, 0)], [.028, .033, .04], seg=6)
    C(bh, lambda p, n: mix(0x3a2a4a, 0x5a4a6e, .5 + .4 * n[1]) if p[1] > -.25 else hexrgb(0x2a2030))
    fer = C(lathe('Ferrule', [(.042, 1.2), (.05, 1.24), (.05, 1.34), (.056, 1.38)], seg=10), lambda p, n: mix(0x8a8a92, 0xc8c6cc, .5 + .5 * n[1]))
    tuft = lathe('Bristle', [(.056, 1.36), (.085, 1.45), (.092, 1.56), (.075, 1.7), (.035, 1.82), (.001, 1.9)], seg=9,
                 wobble=lambda a, y: .1 * math.sin(a * 7 + y * 6) * sstep(1.4, 1.8, y))
    C(tuft, lambda p, n: mix(0x2e2838, 0x0e0c14, sstep(1.45, 1.8, p[1])))
    drip = C(ellipsoid('Drip', (.02, 1.86, .01), (.035, .06, .035), seg=8, rings=5), 0x0e0c14)
    W.append(group('W_brush', (0, 0, 0), [J([bh, fer, tuft, drip], 'BrushM')]))
    # 法杖：扭曲木杖、頂端枝條爪抱著發光寶珠、垂掛護符
    stp = [(0, -.45, 0), (.02, 0, .01), (-.02, .5, 0), (.02, 1.0, -.01), (0, 1.42, 0)]
    st = tube('Staff', stp, [.032, .036, .036, .04, .05], seg=6)
    C(st, lambda p, n: mix(0x4e3c30, 0x7a6450, .5 + .35 * math.sin(p[1] * 18 + math.atan2(p[2], p[0]) * 2) * .5 + .2 * n[1]))
    claws = []
    for k in range(4):
        a = k / 4 * TAU + .4
        claws.append(curve_cone('Twig', [(0, 1.4, 0), (math.cos(a) * .12, 1.5, math.sin(a) * .12), (math.cos(a) * .13, 1.66, math.sin(a) * .13), (math.cos(a) * .05, 1.76, math.sin(a) * .05)], .026, seg=5))
    for c_ in claws:
        Cg(c_, 0x4e3c30, 0x7a6450)
    gem = M(C(ico('StaffGem', (0, 1.6, 0), (.1, .13, .1), sub=1), lambda p, n: (lambda k: (k, k, k))(.8 + .2 * n[1])), 'glow')
    charm = [C(tube('Cord', [(.03, 1.4, .02), (.06, 1.3, .06), (.07, 1.18, .07)], .008, seg=4), 0x3a3040),
             Cg(ellipsoid('Charm', (.07, 1.13, .07), (.035, .05, .012), seg=8, rings=5), BONE_D, BONE)]
    W.append(group('W_staff', (0, 0, 0), [J([st] + claws + charm, 'StaffM'), gem]))
    wg = group('Weapon', HR, [])
    for w in W:
        w.location = V(*HR)
        set_parent(w, wg)

    # ════ opt_ears：灰墨哥布林（豬鼻、大耳、獠牙、角、斑點腰布、繩腰帶、骨項鍊、手腕纏布）════
    snout = mball('Snout', [
        Em((0, 1.5, .41), (.16, .125, .12)),
        Km((0, 1.6, .36), (0, 1.53, .47), .07, s=3),
        Bm((.058, 1.51, .545), .036, s=5, neg=True), Bm((-.058, 1.51, .545), .036, s=5, neg=True),
    ], slot='fixed', target=300)
    C(snout, lambda p, n: mix(shade(SNOUT, .45), mix(SNOUT, 0xd6aca8, .4 + .4 * n[1] + .2 * nz(p, 9)), sstep(.49, .53, p[2]) if min(abs(p[0] - .058), abs(p[0] + .058)) < .05 and p[2] > .5 else 1.0))
    maw = C(ellipsoid('Maw', (0, 1.385, .33), (.2, .075, .09), seg=10, rings=6), lambda p, n: mix(MOUTH, TONGUE, sstep(1.36, 1.33, p[1]) * .6))
    jaw = mball('Jaw', [Em((0, 1.34, .27), (.22, .075, .15)), Km((-.15, 1.35, .33), (.15, 1.35, .33), .045, s=3)], slot='c1', target=180)
    Vp(jaw, lambda p, n: .82 + .1 * n[1])
    teeth = []
    for k in range(5):
        x = -.1 + k * .05
        teeth.append(Cg(cone('ToothU', (x, 1.425, .43 - abs(x) * .4), (x, 1.37, .44 - abs(x) * .4), .018, seg=4), BONE_D, BONE))
    for s in (-1, 1):
        teeth.append(Cg(curve_cone('Tusk', [(s * .13, 1.34, .36), (s * .15, 1.44, .4), (s * .13, 1.52, .41)], .035, seg=6), BONE_D, BONE))
    ears = []
    for s in (1, -1):
        root = Vector((s * .3, 1.68, -.03))
        tip = Vector((s * .95, 1.84, -.22))
        X = (tip - root).normalized()
        Z = Vector((s * .35, .15, 1)).normalized()
        Z = (Z - X * Z.dot(X)).normalized()
        Y = Z.cross(X)
        L = (tip - root).length
        er = leafy('EarM', L, .17, .045, cup=.35, bend=.12, taper=.9, seg=10, rings=9, slot='c1', root_w=.55)
        er.matrix_world = Matrix.Translation(V(*root)) @ fm(X, Y, Z)
        bpy.context.view_layer.update()
        Vp(er, lambda p, n: .86 + .08 * n[1] + .05 * fb(p, 5))
        inner = leafy('EarIn', L * .82, .12, .012, cup=.3, bend=.1, taper=.9, seg=8, rings=6, root_w=.5)
        inner.matrix_world = Matrix.Translation(V(*(root + X * .06 + Z * .035))) @ fm(X, Y, Z)
        bpy.context.view_layer.update()
        C(inner, lambda p, n: mix(0x94707a, 0xc49a98, .5 + .4 * n[1]))
        ears.append(J([er, inner], 'Ear'))
    horn = tube('Horn', [(0, 1.88, .16), (.0, 2.0, .16), (.02, 2.1, .12), (.0, 2.17, .05)], [.06, .05, .03, .004], seg=8)
    paint_idx(horn, lambda i, p: shade(BONE, .78 + .22 * ((i // 8) % 2)) if p[1] < 2.1 else hexrgb(BONE))
    # 腰布：前後長、兩側短，下擺剪成鋸齒，畫豹紋斑點
    cloth = lathe('Loin', [(.29, .7), (.31, .62), (.34, .54), (.36, .47), (.37, .44)], seg=24, sz=.86, cap_top=False, cap_bot=False,
                  wobble=lambda a, y: .05 * math.sin(a * 6) * sstep(.62, .36, y))
    each_vert(cloth, lambda p: (p[0], p[1] - .16 * (math.sin(math.atan2(p[2], p[0])) ** 4) * sstep(.6, .44, p[1]), p[2]))
    rag_hem(cloth, .44, .06, 9, seed=2, below=.2)
    Vp(cloth, lambda p, n: (.95 + .05 * n[1]) * (.55 if abs(nz(p, 9, 7)) > .32 and abs(nz(p, 9, 7)) < .5 else 1.0) - .1 * sstep(.4, .2, p[1]))
    M(cloth, 'c2')
    belt = ring('RopeBelt', (0, .72, .02), .31, .27, .03, ROPE, seg=4, n=18, stripes=2.4, y_fn=lambda a: .015 * math.sin(a * 2))
    knot = Cg(ellipsoid('Knot', (.12, .7, .27), (.05, .045, .04), seg=6, rings=4), shade(ROPE, .7), ROPE)
    tails = [Cg(tube('RopeEnd', [(.12, .69, .28), (.13 + k * .03, .56, .3), (.12 + k * .05, .46, .29)], .018, seg=5), shade(ROPE, .7), ROPE) for k in (0, 1)]
    neck = ring('Cord', (0, 1.3, .02), .15, .16, .012, 0x3a2e28, seg=3, n=12, y_fn=lambda a: -.08 * max(0, math.sin(a)) ** 2)
    fangs = [Cg(cone('NeckTooth', (x, 1.22, .19 - abs(x) * .3), (x * 1.1, 1.12, .2 - abs(x) * .3), .026, seg=4), BONE_D, BONE) for x in (-.07, 0, .07)]
    face_g = dec(J([snout, maw, jaw] + teeth + ears + [horn], 'GoblinHead'), 0.64)
    gear_g = dec(J([cloth, belt, knot] + tails + [neck] + fangs, 'GoblinGear'), 0.75)
    group('opt_ears', (0, 0, 0), [face_g, gear_g])
    for ar, s in ((arms[0], 1), (arms[1], -1)):
        wr = band('Wrap', (s * .465, .86, -.01), (s * .505, .74, .09), .082, LINEN, stripes=3, dark=.75)
        g = group('opt_ears', (0, 0, 0), [wr])
        set_parent(g, ar)

    # ════ opt_cap：蘑菇兵（大菌傘、疣點、菌褶、腮紅、小嘴、葉片裙、斜背帶）════
    cap = lathe('Cap', [(.001, 2.24), (.18, 2.23), (.38, 2.16), (.54, 2.04), (.64, 1.9), (.68, 1.8), (.66, 1.75), (.6, 1.74)], seg=26, cap_bot=False,
                wobble=lambda a, y: .045 * math.sin(a * 5 + 1) * sstep(1.95, 1.75, y))
    Vp(cap, lambda p, n: .78 + .2 * sstep(1.8, 2.2, p[1]) + .05 * fb(p, 4, 1) - .12 * sstep(1.8, 1.74, p[1]))
    M(cap, 'c2')
    gill = lathe('Gills', [(.62, 1.745), (.45, 1.78), (.3, 1.84), (.24, 1.88)], seg=36, cap_top=False, cap_bot=False)
    each_vert(gill, lambda p: (p[0], p[1] - .012 * math.cos(math.atan2(p[2], p[0]) * 24), p[2]))
    gill.data.flip_normals()
    Vp(gill, lambda p, n: .8 + .12 * math.cos(math.atan2(p[2], p[0]) * 24))
    M(gill, 'c1')
    warts = []
    for a, t, r in [(0, .3, .1), (1.2, .55, .085), (2.3, .25, .07), (3.1, .6, .1), (4.2, .4, .09), (5.3, .62, .075), (2.8, .82, .06), (0, 0, .09)]:
        rr = .66 * t
        # 菌傘表面高度（沿輪廓內插）
        prof = [(.001, 2.24), (.18, 2.23), (.38, 2.16), (.54, 2.04), (.64, 1.9), (.68, 1.8)]
        y = prof[-1][1]
        for k in range(len(prof) - 1):
            if prof[k][0] <= rr <= prof[k + 1][0]:
                u = (rr - prof[k][0]) / (prof[k + 1][0] - prof[k][0])
                y = prof[k][1] + (prof[k + 1][1] - prof[k][1]) * u
        up = Vector((math.cos(a) * t * 1.2, 1, math.sin(a) * t * 1.2)).normalized()
        warts.append(bump('Wart', (math.cos(a) * rr, y - .005, math.sin(a) * rr), tuple(up), r, r * .35, None, seg=7, rings=4, wob=.2, spin=a * 40))
    for w in warts:
        Cg(w, 0xd8ccb4, 0xf6efe0)
    mouth = C(tube('MouthLine', [(-.08, 1.47, .4), (-.03, 1.455, .415), (.03, 1.455, .415), (.08, 1.47, .4)], .016, seg=5), MOUTH)
    blush = [C(bump('Blush', (s * .24, 1.52, .33), (s * .6, 0, 1), .06, .012, None, seg=8, rings=3), 0xd89a88) for s in (-1, 1)]
    leaves = []
    for k in range(8):
        a = k / 8 * TAU + .3
        out_ = Vector((math.cos(a), -.35, math.sin(a))).normalized()
        dn = Vector((math.cos(a) * .35, -1, math.sin(a) * .35)).normalized()
        side = dn.cross(out_).normalized()
        out_ = side.cross(dn).normalized()
        lf = leafy('LeafSkirt', .34 + .05 * (k % 2), .12, .016, cup=.25, bend=-.08, taper=.7, seg=6, rings=6, root_w=.6)
        C(lf, lambda p, n, k=k: mix(0x4e6634, 0x8a9a52, .35 + .35 * sstep(.0, .03, abs(p[1])) + .2 * (p[0] / .3) + .1 * (k % 2)))
        lf.matrix_world = Matrix.Translation(V(math.cos(a) * .28, .72, math.sin(a) * .245)) @ fm(dn, side, out_)
        bpy.context.view_layer.update()
        leaves.append(lf)
    mbelt = ring('Belt', (0, .72, .02), .3, .265, .035, 0x6b4a30, seg=4, n=18, y_fn=lambda a: .01 * math.sin(a * 2))
    buckle = C(rbox('Buckle', (0, .72, .3), (.1, .08, .03), bevel=.012, seg=1), BRASS)
    strap = C(tube('Strap', [(.27, 1.16, .02), (.18, 1.1, .24), (0, .96, .3), (-.18, .8, .28), (-.28, .72, .1)], .03, seg=5, flat=.4), 0x6b4a30)
    cap_g = dec(J([cap, gill] + warts, 'MushCap'), 0.65)
    body_g = dec(J([mouth] + blush + leaves + [mbelt, buckle, strap], 'MushGear'), 0.7)
    group('opt_cap', (0, 0, 0), [cap_g, body_g])

    # ════ opt_helmet：褪色騎士（豬臉盔、面甲縫、盔冠、褪色羽飾、胸甲、腰甲片、破罩袍、肩甲、臂甲、脛甲）════
    helm = lathe('Helm', [(.001, 2.17), (.1, 2.12), (.25, 2.02), (.38, 1.9), (.44, 1.74), (.45, 1.58), (.44, 1.44), (.42, 1.36)], seg=24, off=(0, 0, .0), cap_bot=False)
    each_vert(helm, lambda p: (p[0], p[1], p[2] - .12 * sstep(1.9, 2.17, p[1])))
    Vp(helm, lambda p, n: .82 + .14 * n[1] + .05 * fb(p, 5) + .08 * sstep(.3, .55, nz(p, 12, 5)))
    M(helm, 'c2')
    VPR = [(.001, .0), (.22, .03), (.25, .1), (.2, .24), (.1, .38), (.035, .45), (.001, .46)]
    visor = lathe('Visor', VPR, seg=18)
    place(visor, (0, 1.55, .2), (90, 0, 0))
    bpy.context.view_layer.update()
    Vp(visor, lambda p, n: .86 + .12 * n[1] + .05 * fb(p, 6, 2))
    M(visor, 'c2')

    def vr(L):
        for k in range(len(VPR) - 1):
            if VPR[k][1] <= L <= VPR[k + 1][1]:
                u = (L - VPR[k][1]) / (VPR[k + 1][1] - VPR[k][1])
                return VPR[k][0] + (VPR[k + 1][0] - VPR[k][0]) * u
        return 0

    def vpt(L, phi, out=.004):
        r = vr(L) + out
        return (r * math.sin(phi), 1.55 + r * math.cos(phi), .2 + L)
    slits = [C(tube('Slit', [vpt(L, sd * math.radians(42)) for L in (.06, .13, .2, .26)], .02, seg=5), 0x14101a) for sd in (-1, 1)]
    holes = [C(ellipsoid('Breath', vpt(L, math.radians(180 + a), .0), (.016, .016, .016), seg=5, rings=3), 0x14101a) for L in (.26, .32) for a in (-35, -12, 12, 35)]
    comb = mball('Comb', [Em((0, 2.0, -.02), (.03, .1, .3), rot=(-25, 0, 0))], slot='c2', target=110)
    Vp(comb, lambda p, n: .9 + .1 * n[1])
    rv = [Cg(ellipsoid('Rivet', (math.cos(a) * .46, 1.4, math.sin(a) * .46 + .02), (.024, .024, .024), seg=5, rings=3), IRON, IRON_L) for a in [k / 10 * TAU for k in range(10)] if math.sin(a) < .6]
    plume = [tube('Plume', [(0, 2.12, -.08), (0, 2.22, -.18), (0, 2.2, -.36), (0, 2.06, -.52), (0, 1.84, -.6), (0, 1.66, -.58)], [.05, .085, .09, .08, .06, .01], seg=8, flat=.4)]
    for pl in plume:
        C(pl, lambda p, n: mix(0x6a3028, 0xb06a56, .45 + .3 * n[1] + .25 * math.sin(p[0] * 90)))
    breast = mball('Breast', [Em((0, 1.02, .06), (.34, .25, .26)), Km((0, 1.2, .3), (0, .86, .33), .03, s=4)], slot='c2', target=320)
    Vp(breast, lambda p, n: .8 + .15 * n[1] + .1 * n[2] * sstep(.2, .3, p[2]) + .05 * fb(p, 6, 3))
    fauld = [lathe('Fauld', [(.34 + k * .02, .82 - k * .1), (.37 + k * .025, .72 - k * .1), (.365 + k * .025, .7 - k * .1)], seg=20, sz=.88, cap_top=False, cap_bot=False) for k in range(2)]
    for f_ in fauld:
        Vp(f_, lambda p, n: .78 + .15 * n[1])
        M(f_, 'c2')
    tabard = mball('Tabard', [Em((0, .55, .27), (.2, .3, .04)), Em((0, .8, .26), (.22, .08, .05))], slot='c1', target=200)
    rag_hem(tabard, .35, .08, 5, seed=5, below=.08)
    Vp(tabard, lambda p, n: (.92 + .05 * n[1]) * (.62 if math.hypot(p[0], p[1] - .6) < .1 and math.hypot(p[0], p[1] - .6) > .055 else 1.0) - .12 * sstep(.35, .22, p[1]))
    brow = ring('HelmBand', (0, 1.4, 0), .435, .435, .035, (1, 1, 1), seg=4, n=24, slot='c2')
    Vp(brow, lambda p, n: .7 + .2 * n[1])
    helm_g = dec(J([helm, brow, visor, comb] + slits + holes + rv + plume, 'KnightHelm'), 0.55)
    body_k = dec(J([breast] + fauld + [tabard], 'KnightPlate'), 0.65)
    group('opt_helmet', (0, 0, 0), [helm_g, body_k])
    for ar, s in ((arms[0], 1), (arms[1], -1)):
        pa_ = lathe('Pauldron', [(.001, .2), (.12, .18), (.17, .1), (.18, .02)], seg=12, cap_bot=False)
        pa2 = lathe('Pauldron', [(.13, .06), (.19, .02), (.2, -.04)], seg=12, cap_bot=False, cap_top=False)
        for q in (pa_, pa2):
            place(q, (s * .34, 1.12, -.03), (0, 0, -s * 30))
            Vp(q, lambda p, n: .8 + .16 * n[1])
            M(q, 'c2')
        gnt = lathe('Gauntlet', [(.075, 0), (.085, .08), (.095, .16)], seg=10, cap_top=False, cap_bot=False)
        E_, W_ = Vector((s * .45, .9, -.03)), Vector((s * .5, .74, .09))
        orient(gnt, tuple(W_ + (E_ - W_) * .05), tuple(E_ - W_))
        Vp(gnt, lambda p, n: .82 + .15 * n[1])
        M(gnt, 'c2')
        g = group('opt_helmet', (0, 0, 0), [J([pa_, pa2, gnt], 'ArmPlate')])
        set_parent(g, ar)
    for lg, s in ((legs[0], 1), (legs[1], -1)):
        x = s * .17
        gr = lathe('Greave', [(.1, .14), (.105, .22), (.1, .3)], seg=10, cap_top=False, cap_bot=False, off=(x * 1.09, 0, .03), sz=.95)
        kc = ellipsoid('KneeCop', (x * 1.08, .34, .13), (.085, .08, .05), seg=8, rings=5)
        for q in (gr, kc):
            Vp(q, lambda p, n: .8 + .16 * n[1])
            M(q, 'c2')
        g = group('opt_helmet', (0, 0, 0), [J([gr, kc], 'LegPlate')])
        set_parent(g, lg)

    # ════ opt_beret：影子畫匠（歪戴貝雷帽、長尖鼻、捲八字鬍、領巾、沾滿顏料的罩衫、調色盤）════
    beret = lathe('Beret', [(.001, 0), (.3, 0), (.42, .03), (.46, .07), (.4, .12), (.2, .15), (.001, .155)], seg=24)
    nub = lathe('Nub', [(.02, .14), (.02, .19), (.001, .2)], seg=6)
    bb = J([beret, nub], 'Beret')
    place(bb, (.06, 1.9, -.02), (-10, 0, -16))
    Vp(bb, lambda p, n: .82 + .15 * n[1] + .04 * fb(p, 6))
    M(bb, 'c2')
    bband = ring('BeretBand', (0, 0, 0), .3, .3, .022, (1, 1, 1), seg=4, n=16, slot='c2')
    place(bband, (.055, 1.895, -.02), (-10, 0, -16))
    Vp(bband, lambda p, n: .62)
    nose = tube('Nose', [(0, 1.6, .36), (0, 1.56, .47), (0, 1.52, .6), (0, 1.5, .66)], [.065, .055, .03, .005], seg=10)
    Vp(nose, lambda p, n: .9 + .08 * n[1])
    M(nose, 'c1')
    stache = []
    for s in (-1, 1):
        stache.append(tube('Stache', [(0, 1.48, .5), (s * .08, 1.46, .48), (s * .16, 1.47, .44), (s * .2, 1.52, .41), (s * .18, 1.56, .41)], [.02, .03, .025, .015, .004], seg=6))
    for st_ in stache:
        Cg(st_, 0x16121c, 0x3a3444)
    grin = C(tube('Grin', [(-.12, 1.42, .38), (-.05, 1.39, .42), (.05, 1.39, .42), (.12, 1.43, .38)], .015, seg=5), MOUTH)
    kerch = mball('Kerchief', [Em((0, 1.3, .04), (.2, .07, .18)), Em((0, 1.2, .18), (.1, .1, .05)), Bm((0, 1.27, .2), .05)], slot='c2', target=200)
    Vp(kerch, lambda p, n: .84 + .14 * n[1])
    ktail = [M(Vp(tube('KTail', [(0, 1.24, .22), (s * .05, 1.12, .25), (s * .08, 1.0, .22)], [.05, .045, .025], seg=6, flat=.35), lambda p, n: .8 + .12 * n[1]), 'c2') for s in (-1, 1)]
    smock = lathe('Smock', [(.3, 1.2), (.35, 1.05), (.36, .85), (.38, .62), (.43, .42), (.47, .3)], seg=32, sz=.88, cap_top=False, cap_bot=False,
                  wobble=lambda a, y: .06 * math.sin(a * 7) * sstep(.9, .3, y))
    rag_hem(smock, .3, .03, 12, seed=8, below=.02)
    SPL = [0xa84a3e, 0xc8983a, 0x4a6a9a, 0x5a8a4a, 0x8a5a9a]

    def smock_col(p, n):
        base = mix(0xa8a092, 0xd4ccbc, .55 + .35 * n[1] + .1 * nz(p, 5))
        base = mix(base, shade(base, .7), sstep(.0, -.2, p[2]) * .5)
        k = nz(p, 5.5, 11)
        if k > .3:
            base = hexrgb(SPL[int((nz(p, 1.3, 4) + 1) * 2.5) % 5])
        if abs(math.sin(p[0] * 40)) > .96 and p[2] > 0 and nz((p[0], 0, 0), 9, 2) > .1 and p[1] > .45:
            base = hexrgb(SPL[int(abs(p[0]) * 30) % 5])
        return base
    C(smock, smock_col)
    btn = [C(ellipsoid('Button', (0, y, .3 + (1.0 - y) * .05), (.022, .022, .012), seg=6, rings=4), 0x2a2230) for y in (1.0, .85, .7)]
    pocket = rbox('Pocket', (0, 0, 0), (.16, .14, .03), bevel=.012, seg=1)
    place(pocket, (.17, .6, .36), (0, 25, 0))
    C(pocket, lambda p, n: mix(0x9a9284, 0xc4bcac, .5 + .3 * n[1]))
    pbr = [C(tube('PBrush', [(.14 + k * .05, .6, .36 - k * .02), (.12 + k * .06, .82, .36 - k * .02)], .014, seg=4), [0x6a3a2a, 0x3a4a6a][k]) for k in range(2)]
    ptip = [C(cone('PTip', (.12 + k * .06, .81, .36 - k * .02), (.12 + k * .06, .88, .36 - k * .02), .022, seg=5), [0xa84a3e, 0x2e2838][k]) for k in range(2)]
    bh_g = dec(J([bb, bband, nose] + stache + [grin, kerch] + ktail, 'PainterHead'), 0.62)
    bs_g = dec(J([smock] + btn + [pocket] + pbr + ptip, 'PainterSmock'), 0.8)
    group('opt_beret', (0, 0, 0), [bh_g, bs_g])
    pal = lathe('Palette', [(.001, -.012), (.2, -.012), (.21, 0), (.2, .012), (.001, .012)], seg=12, wobble=lambda a, y: .18 * max(0, math.cos(a - 2.6)) ** 6)
    Cg(pal, 0x8a6a48, 0xb08a60)
    dabs = [C(bump('Dab', (math.cos(a) * .12, .015, math.sin(a) * .12), (0, 1, 0), .035, .014, None, seg=6, rings=3), c_) for a, c_ in zip([0, 1.1, 2.2, 3.6, 4.7], SPL)]
    palm = J([pal] + dabs, 'PaletteM')
    place(palm, (.58, .56, .28), (70, -20, 20))
    g = group('opt_beret', (0, 0, 0), [palm])
    set_parent(g, arms[0])

    # ════ opt_hood：灰寂祭司（尖兜帽、面具、長袍、披肩、聖帶、繩腰帶、寬袖）════
    hood = mball('Hood', [
        Em((0, 1.64, -.03), (.48, .5, .48)),
        Bm((0, 2.02, -.16), .2), Bm((0, 2.2, -.3), .12), Bm((0, 2.3, -.42), .065),
        Em((0, 1.28, -.02), (.42, .12, .36)),
        Em((0, 1.58, .42), (.3, .34, .26), s=3, neg=True),
    ], slot='c1', target=650)
    Vp(hood, lambda p, n: .8 + .14 * n[1] + .04 * fb(p, 4) - .3 * sstep(.25, .12, p[2]) * sstep(-.1, .1, p[2]) * sstep(.3, .1, abs(p[0])) * sstep(1.3, 1.45, p[1]))
    mask = mball('Mask', [Em((0, 1.58, .4), (.25, .3, .09)), Bm((.1, 1.64, .47), .045, s=5, neg=True), Bm((-.1, 1.64, .47), .045, s=5, neg=True)], slot='c2', target=240)
    Vp(mask, lambda p, n: (.92 + .07 * n[1]) * (.45 if abs(p[0]) < .018 and p[1] > 1.7 else 1.0) * (.55 if abs(p[1] - 1.44 - .02 * math.cos(p[0] * 12)) < .012 else 1.0))
    glows = [C(ellipsoid('SlitEye', (s * .1, 1.64, .455), (.04, .018, .02), seg=8, rings=4), 0xf6e8a8) for s in (-1, 1)]
    robe = lathe('Robe', [(.3, 1.26), (.34, 1.1), (.36, .8), (.42, .5), (.5, .2), (.54, .04)], seg=30, cap_top=False, cap_bot=False,
                 wobble=lambda a, y: .07 * math.sin(a * 9 + y * 2) * sstep(1.0, .1, y))
    rag_hem(robe, .05, .03, 14, seed=3, below=.01)
    each_vert(robe, lambda p: (p[0], max(p[1], .0), p[2]))
    Vp(robe, lambda p, n: .82 + .1 * n[1] + .05 * fb(p, 4, 9) - .12 * sstep(.25, .0, p[1]) + .06 * math.sin(math.atan2(p[2], p[0]) * 9 + p[1] * 2))
    M(robe, 'c1')
    mantle = lathe('Mantle', [(.2, 1.4), (.34, 1.3), (.46, 1.14), (.5, 1.04)], seg=24, cap_top=False, cap_bot=False, wobble=lambda a, y: .05 * math.sin(a * 6))
    rag_hem(mantle, 1.05, .05, 10, seed=4, below=.02)
    Vp(mantle, lambda p, n: .86 + .12 * n[1] - .15 * sstep(1.12, 1.02, p[1]))
    M(mantle, 'c2')
    stole = []
    for s in (-1, 1):
        so = tube('Stole', [(s * .13, 1.12, .3), (s * .14, .8, .36), (s * .15, .45, .43), (s * .16, .12, .5)], [.07, .075, .08, .085], seg=6, flat=.2)
        Vp(so, lambda p, n: .88 + .1 * n[1] - (.35 if (p[1] * 10) % 1.0 < .18 else 0))
        M(so, 'c2')
        stole.append(so)
    rbelt = ring('Cincture', (0, .78, .02), .37, .33, .028, ROPE, seg=4, n=18, stripes=2.4)
    tass = [Cg(tube('Tassel', [(.2, .76, .28), (.22, .6, .32), (.23, .42, .33)], [.02, .02, .045], seg=6), shade(ROPE, .75), ROPE)]
    hood_g = dec(J([hood, mask] + glows, 'PriestHood'), 0.65)
    robe_g = dec(J([robe, mantle] + stole + [rbelt] + tass, 'PriestRobe'), 0.68)
    group('opt_hood', (0, 0, 0), [hood_g, robe_g])
    for ar, s in ((arms[0], 1), (arms[1], -1)):
        E_, W_ = Vector((s * .45, .9, -.03)), Vector((s * .5, .72, .1))
        sv = lathe('Sleeve', [(.1, 0), (.13, .12), (.17, .24), (.19, .28)], seg=14, cap_top=False, cap_bot=False)
        orient(sv, tuple(E_ + (E_ - W_).normalized() * .12), tuple(W_ - E_))
        Vp(sv, lambda p, n: .82 + .12 * n[1])
        M(sv, 'c1')
        up_ = tube('SleeveU', [(s * .3, 1.17, -.03), (s * .45, .9, -.03)], [.13, .12], seg=12)
        Vp(up_, lambda p, n: .82 + .12 * n[1])
        M(up_, 'c1')
        g = group('opt_hood', (0, 0, 0), [J([sv, up_], 'SleeveM')])
        set_parent(g, ar)


template('humanoid', humanoid)





# ── 史萊姆 ──
def slime_body(name, c, R, H, target, drips=True, seed=0, extra=()):
    els = [Em((c[0], c[1] + H * .5, c[2]), (R, H * .5, R * .96)),
           Em((c[0], c[1] + H * .16, c[2]), (R * 1.1, H * .17, R * 1.06)),
           Em((c[0] - R * .05, c[1] + H * .8, c[2] - R * .1), (R * .55, H * .25, R * .5))] + list(extra)
    if drips:
        for k in range(6):
            a = k / 6 * TAU + .5
            if 1.2 < a < 1.95:
                continue
            p0 = (c[0] + math.cos(a) * R * .9, c[1] + H * .55, c[2] + math.sin(a) * R * .88)
            p1 = (c[0] + math.cos(a) * R * 1.02, c[1] + H * (.25 + .08 * (k % 3)), c[2] + math.sin(a) * R * 1.0)
            els.append(Km(p0, p1, R * .12, s=3))
    ob = mball(name, els, slot='c1', target=target)
    each_vert(ob, lambda p: (p[0], max(p[1], c[1] + .03), p[2]))

    def v(p, n):
        h = (p[1] - c[1]) / (H * 1.15)
        k = .76 + .2 * sstep(.05, .85, h) + .05 * fb(p, 3 / R, seed)
        k += .1 * sstep(.35, .6, nz(p, 5 / R, seed + 4))  # 體內的亮斑（氣泡）
        return k - .12 * sstep(.12, 0, h)
    return Vp(ob, v)


def blob():
    body = slime_body('SquashM', (0, 0, 0), .8, 1.12, 1700, extra=[Em((0, .45, .8), (.22, .1, .14), s=3, neg=True)])
    ey = eye_pair((0, .78, .66), .27, .15, conv=.18, tilt=14, off=.28, lidk=1.12, lidval=.92, iris=0x4a3a2e, pa=19, ia=36)
    # 張開的嘴：往內挖的暗色口腔、舌頭、一顆小尖牙
    maw = C(ellipsoid('Maw', (0, .45, .66), (.2, .1, .1), seg=12, rings=6), lambda p, n: mix(MOUTH, shade(MOUTH, .6), sstep(.46, .4, p[1])))
    tongue = C(ellipsoid('TongueS', (.04, .4, .72), (.1, .04, .07), seg=8, rings=5), TONGUE)
    fang = Cg(cone('Fang', (.1, .53, .75), (.1, .46, .77), .035, seg=5), BONE_D, 0xffffff)
    shine = []
    for d, r in [((-.5, .75, .45), .13), ((-.28, .9, .35), .05)]:
        p, nn = surf(body, (0, .5, 0), d)
        if p is not None:
            shine.append(C(bump('Shine', tuple(p), tuple(nn), r, r * .25, None, seg=10, rings=4, wob=-.4, spin=30), (1, 1, 1)))
    sq = J([body] + ey + [maw, tongue, fang] + shine, 'Squash')
    pivot(sq, (0, 0, 0))
    # 霜晶：頭頂一叢六角冰晶
    fr = []
    for i, (a, t, h, r) in enumerate([(0, .15, .55, .1), (1.3, .38, .42, .08), (2.5, .33, .36, .07), (3.8, .4, .45, .085), (5.0, .3, .32, .065), (.7, .5, .26, .055)]):
        base = Vector((math.cos(a) * t, 1.02 - t * .3, math.sin(a) * t - .05))
        up = Vector((math.cos(a) * t * 1.4, 1, math.sin(a) * t * 1.4)).normalized()
        cr = lathe('Ice', [(r * .7, -.1), (r, 0), (r, h * .7), (.001, h)], seg=6)
        orient(cr, tuple(base), tuple(up), spin=a * 30)
        C(cr, lambda p, n: mix(0x9ec8dc, 0xf0fbff, .45 + .45 * n[1] + .1 * nz(p, 12)))
        fr.append(cr)
    rim = []
    for k in range(10):
        a = k / 10 * TAU
        rim.append(C(cone('Frost', (math.cos(a) * .72, .7, math.sin(a) * .7), (math.cos(a) * .86, .52 + .06 * (k % 2), math.sin(a) * .84), .06, seg=4), 0xdaf2fc))
    g = group('x_frost', (0, 0, 0), [J(fr + rim, 'FrostM')])
    set_parent(g, sq)
    # 雷光：頭頂一道鋸齒閃電＋兩顆電珠
    bm = bmesh.new()
    pts2 = [(-.05, 1.05), (.14, 1.05), (.04, 1.32), (.2, 1.32), (-.08, 1.78), (.0, 1.46), (-.16, 1.46)]
    fv = [bm.verts.new(V(x, y, .05)) for x, y in pts2]
    bv = [bm.verts.new(V(x, y, -.05)) for x, y in pts2]
    bm.faces.new(fv)
    bm.faces.new(list(reversed(bv)))
    for k in range(len(pts2)):
        bm.faces.new((fv[k], bv[k], bv[(k + 1) % len(pts2)], fv[(k + 1) % len(pts2)]))
    bmesh.ops.triangulate(bm, faces=bm.faces[:])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bolt = obj_from_bm(bm, 'Bolt', slot='glow')
    Vp(bolt, lambda p, n: .85 + .15 * n[2])
    orbs = [M(Vp(ico('Orb', (x, y, z), (.06, .06, .06), sub=1), lambda p, n: 1.0), 'glow') for x, y, z in [(-.35, 1.1, .2), (.38, 1.0, .1)]]
    g = group('x_spark', (0, 0, 0), [J([bolt] + orbs, 'SparkM')])
    set_parent(g, sq)
    # 火花：頭頂三股扭動的火舌
    fl = []
    for k, (x, z, h, r) in enumerate([(0, -.05, .8, .24), (-.2, .08, .5, .15), (.22, .02, .56, .16)]):
        f_ = lathe('Flame', [(r * .8, 0), (r, .12), (r * .75, h * .5), (r * .3, h * .85), (.001, h)], seg=10,
                   wobble=lambda a, y, k=k: .18 * math.sin(a * 3 + y * 7 + k) * sstep(.1, .5, y))
        each_vert(f_, lambda p, k=k, h=h: (p[0] + .1 * math.sin(p[1] * 5 + k) * p[1] / h, p[1], p[2]))
        place(f_, (x, 1.0, z))
        Vp(f_, lambda p, n: .7 + .3 * sstep(1.0, 1.6, p[1]))
        fl.append(M(f_, 'glow'))
    g = group('x_ember', (0, 0, 0), [J(fl, 'EmberM')])
    set_parent(g, sq)
    # 雙生：頭上疊一隻小泥偶
    tw = slime_body('TwinHead', (0, 1.08, -.02), .42, .62, 700, drips=False, seed=3)
    tk = eye_pair((0, 1.45, .32), .14, .085, conv=.2, tilt=-10, off=.35, lidk=1.12, lidval=.92, iris=0x4a3a2e, pa=19, ia=36)
    tm = C(ellipsoid('TwinMouth', (0, 1.3, .39), (.06, .04, .03), seg=8, rings=4), MOUTH)
    g = group('x_twin', (0, 0, 0), [J([tw] + tk + [tm], 'TwinM')])
    set_parent(g, sq)


template('blob', blob)


# ── 四足獸 ──
def hoofed_leg(nm, hip, x, z, r0=.14, r1=.09, kind='boar', slot='c1'):
    knee = (x * 1.04, .42, z + .03)
    fet = (x * 1.05, .15, z + .05)
    els = [Km(hip, knee, r0), Km(knee, fet, r1), Bm(knee, r1 * 1.15)]
    if kind == 'mole':
        els = [Km(hip, (x * 1.1, .3, z + .05), r0), Km((x * 1.1, .3, z + .05), (x * 1.12, .14, z + .1), r1)]
    lg = mball('LegMesh', els, slot=slot, target=300)
    Vp(lg, lambda p, n: .84 + .1 * n[1] + .05 * fb(p, 5) - .08 * sstep(.3, .1, p[1]))
    parts = [lg]
    if kind == 'boar':
        for dx in (-.045, .045):
            parts.append(Cg(ellipsoid('Hoof', (x * 1.05 + dx, .06, z + .1), (.048, .07, .075), seg=8, rings=5), 0x2a2020, 0x5a4a44))
        parts.append(Cg(cone('Dewclaw', (x * 1.05, .14, z - .02), (x * 1.05, .06, z - .07), .03, seg=4), 0x2a2020, 0x5a4a44))
        for k in range(5):
            a = k / 5 * TAU
            t = cone('Fetlock', (x * 1.05 + math.cos(a) * .07, .2, z + .05 + math.sin(a) * .07), (x * 1.05 + math.cos(a) * .12, .1, z + .05 + math.sin(a) * .12), .04, seg=3)
            parts.append(M(Vp(t, lambda p, n: .72), 'c1'))
    else:
        paw = mball('Paw', [Em((x * 1.08, .07, z + .14), (.12, .06, .12))], slot=slot if kind != 'mole' else 'c2', target=120)
        Vp(paw, lambda p, n: .85 + .1 * n[1])
        parts.append(paw)
        for k in range(3 if kind != 'mole' else 5):
            dx = (k - (1 if kind != 'mole' else 2)) * (.055 if kind != 'mole' else .05)
            ln = .12 if kind != 'mole' else .2
            parts.append(Cg(curve_cone('Claw', [(x * 1.08 + dx, .08, z + .2), (x * 1.08 + dx * 1.3, .07, z + .2 + ln * .6), (x * 1.08 + dx * 1.4, .02, z + .2 + ln)], .03, seg=4), BONE_D, BONE))
    return parts


def quad(kind):
    def b():
        pos = {'boar': [(.36, .58), (.36, -.58)], 'shell': [(.42, .6), (.42, -.55)], 'mole': [(.48, .55), (.46, -.45)]}[kind]
        if kind == 'boar':
            body = mball('Body', [
                Em((0, .98, -.1), (.54, .5, .8)), Bm((0, 1.2, .36), .44), Em((0, .8, .28), (.46, .34, .46)),
                Em((0, .96, -.62), (.44, .42, .36)),
                Em((.33, .82, .55), (.2, .28, .24)), Em((-.33, .82, .55), (.2, .28, .24)),
                Em((.32, .82, -.56), (.22, .3, .26)), Em((-.32, .82, -.56), (.22, .3, .26)),
            ], slot='c1', target=1800)

            def boarv(p, n):
                v = .82 + .06 * n[1] + .05 * fb(p, 3)
                v += .16 * sstep(-.2, -.6, n[1])  # 肚子亮
                side = sstep(.3, .7, abs(n[0]))
                if math.sin(p[1] * 16 + 2.5 * nz(p, 2)) > .45 and -.85 < p[2] < .6:
                    v += .13 * side  # 幼豬的縱向淡條紋
                v -= .1 * sstep(.6, .95, n[1])
                return v
            Vp(body, boarv)
            head = mball('HeadMesh', [
                Em((0, 1.02, .98), (.34, .34, .38)),
                Km((0, .98, 1.12), (0, .89, 1.42), .19),
                Em((.19, .87, 1.14), (.14, .13, .2)), Em((-.19, .87, 1.14), (.14, .13, .2)),
                Km((-.2, 1.2, 1.12), (.2, 1.2, 1.12), .075, s=3),
                Bm((.19, 1.12, 1.24), .07, s=4, neg=True), Bm((-.19, 1.12, 1.24), .07, s=4, neg=True),
            ], slot='c1', target=900)
            Vp(head, lambda p, n: .84 + .1 * n[1] + .04 * fb(p, 4) + .12 * sstep(-.2, -.6, n[1]))
            pad = lathe('Snout', [(.001, 0), (.16, 0), (.185, .04), (.17, .09), (.001, .1)], seg=16, sx=1.15)
            place(pad, (0, .89, 1.43), (90, 0, 0))
            Vp(pad, lambda p, n: .82 + .15 * n[2])
            M(pad, 'c2')
            parts = [body, head, pad]
            parts += [C(ellipsoid('Nostril', (s * .075, .9, 1.54), (.035, .045, .02), seg=6, rings=4), 0x2a1a1a) for s in (-1, 1)]
            for s in (-1, 1):
                parts.append(Cg(curve_cone('Tusk', [(s * .15, .8, 1.34), (s * .25, .83, 1.44), (s * .3, .98, 1.5), (s * .25, 1.12, 1.46)], .06, seg=7), BONE_D, BONE))
                parts.append(C(tube('MouthL', [(s * .12, .78, 1.4), (s * .22, .8, 1.26), (s * .3, .86, 1.06)], .018, seg=4), MOUTH))
                root = Vector((s * .24, 1.3, .86)); tip = Vector((s * .52, 1.54, .66))
                X = (tip - root).normalized(); Z = Vector((s * .3, .2, 1)); Z = (Z - X * Z.dot(X)).normalized(); Y = Z.cross(X)
                er = leafy('Ear', (tip - root).length, .12, .035, cup=.3, bend=.05, taper=.8, seg=8, rings=7, slot='c1')
                er.matrix_world = Matrix.Translation(V(*root)) @ fm(X, Y, Z)
                Vp(er, lambda p, n: .8 + .1 * n[1])
                ei = leafy('EarIn', (tip - root).length * .75, .08, .01, cup=.25, seg=6, rings=5)
                ei.matrix_world = Matrix.Translation(V(*(root + X * .04 + Z * .025))) @ fm(X, Y, Z)
                C(ei, 0xb88a80)
                parts += [er, ei]
            parts += eye_pair((0, 1.12, 1.19), .19, .07, conv=.55, tilt=28, off=.05, iris=0xb0482e, pa=16, ia=34)
            # 背脊骨刺與鬃毛
            for i in range(9):
                z = .78 - i * .17
                p, nn = surf(body, (0, .8, z), (0, 1, -.15))
                if p is None:
                    continue
                h = .18 + .16 * math.exp(-((z - .35) / .5) ** 2)
                parts.append(Cg(curve_cone('Spike', [tuple(p - Vector((0, .04, 0))), tuple(p + Vector((0, h * .6, -h * .2))), tuple(p + Vector((0, h, -h * .55)))], .075, seg=5), BONE_D, BONE))
                for s in (-1, 1):
                    t = cone('Mane', tuple(p + Vector((s * .08, -.05, 0))), tuple(p + Vector((s * .2, .08, -.18))), .06, seg=3)
                    parts.append(M(Vp(t, lambda p_, n: .62), 'c1'))
            tail = M(Vp(tube('Tail', [(0, 1.0, -.95), (.02, .9, -1.1), (.06, .72, -1.14)], [.05, .04, .025], seg=6), lambda p, n: .8), 'c1')
            tuft = M(Vp(cone('TailTuft', (.06, .74, -1.14), (.08, .56, -1.12), .06, seg=5), lambda p, n: .6), 'c1')
            parts += [tail, tuft]
            J(parts, 'BodyM')
        elif kind == 'shell':
            body = mball('Body', [Em((0, .78, -.05), (.56, .42, .85)), Em((0, .6, .3), (.42, .3, .4))], slot='c1', target=900)
            Vp(body, lambda p, n: .8 + .12 * n[1] + .1 * sstep(-.2, -.6, n[1]) + .04 * fb(p, 4))
            head = mball('HeadMesh', [
                Em((0, .72, .92), (.25, .22, .3)), Km((0, .68, 1.05), (0, .58, 1.42), .09), Bm((0, .57, 1.44), .06),
                Bm((.13, .77, 1.08), .05, s=4, neg=True), Bm((-.13, .77, 1.08), .05, s=4, neg=True)], slot='c1', target=600)
            Vp(head, lambda p, n: .84 + .1 * n[1] + .1 * sstep(-.2, -.6, n[1]))
            parts = [body, head]
            parts.append(C(ellipsoid('Nose', (0, .59, 1.49), (.05, .04, .03), seg=8, rings=5), 0x2a1e20))
            hp = mball('HeadPlate', [Em((0, .86, .96), (.2, .07, .26), rot=(-10, 0, 0))], slot='c2', target=160)
            Vp(hp, lambda p, n: .85 + .12 * n[1] - (.2 if (p[2] * 12) % 1 < .2 else 0))
            parts.append(hp)
            parts += eye_pair((0, .78, 1.06), .13, .055, conv=.5, tilt=18, off=.15, iris=0x3a2a22, pa=18, ia=36)
            for s in (-1, 1):
                root = Vector((s * .12, .9, .86)); tip = Vector((s * .22, 1.22, .78))
                X = (tip - root).normalized(); Z = Vector((s * .2, 0, 1)); Z = (Z - X * Z.dot(X)).normalized(); Y = Z.cross(X)
                er = leafy('Ear', (tip - root).length, .1, .025, cup=.35, taper=.6, seg=8, rings=6, slot='c1', root_w=.7)
                er.matrix_world = Matrix.Translation(V(*root)) @ fm(X, Y, Z)
                Vp(er, lambda p, n: .85 + .1 * n[1])
                parts.append(er)
            # 帶狀甲殼：前後各一片大甲，中間七條環帶
            bands = []
            for i in range(9):
                z0 = -.88 + i * .21
                big = i in (0, 8)
                wz = .27 if not big else .32
                R = .6 * math.sqrt(max(.15, 1 - ((z0 + .05) / 1.0) ** 2)) + .06
                bm = bmesh.new()
                NA, NZ = 16, 3
                lay = []
                for layer, off in ((0, 0.0), (1, -.05)):
                    rows = []
                    for ia in range(NA + 1):
                        a = -1.95 + 3.9 * ia / NA
                        row = []
                        for iz in range(NZ):
                            z = z0 + wz * iz / (NZ - 1)
                            lip = .03 * (iz == NZ - 1)
                            rr = R + off + lip + .02 * (1 - abs(a) / 2)
                            row.append(bm.verts.new(V(math.sin(a) * rr * 1.02, .72 + math.cos(a) * rr * .85, z)))
                        rows.append(row)
                    lay.append(rows)
                for L_, flip in ((lay[0], False), (lay[1], True)):
                    for ia in range(NA):
                        for iz in range(NZ - 1):
                            f_ = (L_[ia][iz], L_[ia + 1][iz], L_[ia + 1][iz + 1], L_[ia][iz + 1])
                            bm.faces.new(tuple(reversed(f_)) if flip else f_)
                for ia in range(NA):
                    for iz in (0, NZ - 1):
                        try:
                            bm.faces.new((lay[0][ia][iz], lay[1][ia][iz], lay[1][ia + 1][iz], lay[0][ia + 1][iz]))
                        except ValueError:
                            pass
                for ia in (0, NA):
                    for iz in range(NZ - 1):
                        try:
                            bm.faces.new((lay[0][ia][iz], lay[0][ia][iz + 1], lay[1][ia][iz + 1], lay[1][ia][iz]))
                        except ValueError:
                            pass
                bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
                bd = obj_from_bm(bm, 'Plate', slot='c2')
                Vp(bd, lambda p, n, z0=z0, wz=wz: .72 + .2 * n[1] * .5 + .18 * sstep(.7, 1.0, (p[2] - z0) / wz) - (.14 if (math.atan2(p[0], p[1] - .72) * 3.2) % 1 < .12 else 0) + .04 * nz(p, 9))
                bands.append(bd)
            parts += bands
            tail = []
            for k in range(6):
                z = -.9 - k * .11
                r = .13 - k * .018
                tl = lathe('TailRing', [(r * .8, 0), (r, .02), (r * .95, .1)], seg=10, cap_top=False, cap_bot=False)
                place(tl, (0, .55 - k * .06, z), (-80 + k * 4, 0, 0))
                Vp(tl, lambda p, n: .8 + .15 * n[1])
                M(tl, 'c2')
                tail.append(tl)
            parts += tail
            J(parts, 'BodyM')
        else:
            body = mball('Body', [Em((0, .72, -.05), (.72, .56, .76)), Bm((0, .92, -.2), .45), Em((0, .8, .62), (.4, .36, .36)),
                                  Km((0, .76, .8), (0, .8, 1.1), .12), Bm((.12, .98, 1.0), .03, s=5, neg=True), Bm((-.12, .98, 1.0), .03, s=5, neg=True)],
                         slot='c1', target=1600)

            def fur(p, n):
                v = .82 + .1 * n[1] + .06 * fb(p, 6, 3) + .12 * sstep(-.2, -.6, n[1])
                return v + .06 * math.sin(p[0] * 30 + nz(p, 4) * 4) * sstep(.2, .6, n[1])
            Vp(body, fur)
            parts = [body]
            nose = lathe('Nose', [(.001, 0), (.1, 0), (.12, .04), (.1, .07), (.001, .08)], seg=12)
            place(nose, (0, .8, 1.14), (90, 0, 0))
            Vp(nose, lambda p, n: .85 + .12 * n[2])
            parts.append(M(nose, 'c2'))
            for k in range(10):
                a = k / 10 * TAU
                d = Vector((math.cos(a), math.sin(a) * .9, .35))
                t = cone('Feeler', (math.cos(a) * .08, .8 + math.sin(a) * .07, 1.2), tuple(Vector((0, .8, 1.2)) + d * .17), .03, seg=4)
                parts.append(M(Vp(t, lambda p, n: .9), 'c2'))
            parts += [C(ellipsoid('Nostril', (s * .035, .81, 1.225), (.015, .02, .01), seg=5, rings=3), 0x5a2a3a) for s in (-1, 1)]
            parts += eye_pair((0, .98, .96), .12, .035, conv=.4, tilt=5, off=-.25, lidk=1.3, lidval=.8, iris=0x2a1e2a, pa=30, ia=45)
            for s in (-1, 1):
                for k in range(3):
                    parts.append(C(tube('Whisker', [(s * .1, .8, 1.08), (s * .3, .82 + (k - 1) * .05, 1.16), (s * .46, .8 + (k - 1) * .09, 1.16)], .006, seg=3), 0x2a2238))
            for i in range(14):
                a = random.uniform(-1.2, 1.2)
                z = random.uniform(-.7, .6)
                p, nn = surf(body, (0, .8, z * .9), (math.sin(a), math.cos(a), 0))
                if p is None:
                    continue
                t = cone('Tuft', tuple(p - nn * .03), tuple(p + nn * .06 + Vector((0, .02, -.1))), .06, seg=3)
                parts.append(M(Vp(t, lambda p_, n: .86), 'c1'))
            tail = M(Vp(tube('Tail', [(0, .7, -.72), (0, .62, -.9), (.03, .5, -.98)], [.05, .04, .02], seg=6), lambda p, n: .9), 'c2')
            parts.append(tail)
            J(parts, 'BodyM')
        legs = []
        for i, (x, z) in enumerate([(pos[0][0], pos[0][1]), (-pos[0][0], pos[0][1]), (pos[1][0], pos[1][1]), (-pos[1][0], pos[1][1])]):
            hip = (x, .75, z)
            lg = J(hoofed_leg('LegMesh', hip, x, z, kind=kind, r0=.14 if kind != 'mole' else .15), 'Leg%d' % i)
            pivot(lg, hip)
            legs.append(lg)
    return b


template('beast_boar', quad('boar'))
template('beast_shell', quad('shell'))
template('beast_mole', quad('mole'))


def scarecrow():
    """巫毒稻草人：木樁、麻布袋頭（縫線嘴、不對稱鈕扣眼）、破草帽、補丁破衫、袖口與腰間的稻草、巫毒大頭針、帽上停一隻墨鴉"""
    def wood(p, n):
        return mix(WOOD_D, WOOD, .5 + .3 * math.sin(math.atan2(p[2], p[0]) * 4 + p[1] * 3 + nz(p, 5) * 2) + .2 * n[1])
    pole = C(tube('Pole', [(0, 0, 0), (.02, .8, 0), (-.01, 1.6, .01), (0, 2.25, 0)], [.085, .08, .075, .07], seg=8), wood)
    bar = C(tube('Bar', [(-.95, 1.55, -.02), (0, 1.57, -.02), (.95, 1.54, -.02)], [.055, .06, .055], seg=6), wood)
    lash = [C(tube('Lash', [(-.1, 1.62 - k * .05, .06), (.1, 1.5 + k * .05, .06)], .016, seg=4), ROPE) for k in range(2)]
    # 麻布袋頭：歪一邊、上面鼓、脖子處收緊
    sack = mball('Sack', [
        Em((0, 2.0, 0), (.34, .33, .31)), Bm((.08, 2.14, -.04), .22), Bm((-.1, 1.86, .05), .2),
        Em((0, 1.74, 0), (.14, .08, .13)),
        Km((-.14, 1.94, .31), (.14, 1.95, .31), .03, s=5, neg=True),
    ], slot='c1', target=620)

    def burlap(p, n):
        w = .06 * math.sin(p[0] * 70) * math.sin(p[1] * 70) + .05 * fb(p, 6, 2)
        seam = .2 if abs(p[0] + .02 * math.sin(p[1] * 9)) < .02 and p[2] < 0 else 0
        return .86 + .08 * n[1] + w - seam - .12 * sstep(1.8, 1.72, p[1])
    Vp(sack, burlap)
    tie = ring('NeckRope', (0, 1.76, 0), .15, .14, .025, ROPE, seg=4, n=14, stripes=2)
    tuft = []
    for k in range(9):
        a = k / 9 * TAU
        tuft.append(cone('Straw', (math.cos(a) * .1, 1.72, math.sin(a) * .09), (math.cos(a) * .22, 1.56 + .04 * math.sin(k * 2.3), math.sin(a) * .2), .025, seg=3))
    for t_ in tuft:
        Vp(t_, lambda p, n: .8 + .2 * sstep(1.72, 1.58, p[1]))
        M(t_, 'c1')
    # 臉：大四孔鈕扣眼＋一邊縫成 X，鋸齒縫線嘴
    btn = C(lathe('BtnEye', [(.001, 0), (.085, 0), (.09, .02), (.07, .03), (.001, .025)], seg=12), lambda p, n: mix(0x5a2a2e, 0x8a4a48, .5 + .5 * n[1]))
    place(btn, (.13, 2.04, .29), (72, 12, 0))
    holes = [C(ellipsoid('BtnHole', (.13 + dx, 2.05 + dy, .325), (.014, .014, .01), seg=5, rings=3), 0x1a1216) for dx, dy in [(-.025, .02), (.025, .02), (-.025, -.02), (.025, -.02)]]
    xs = [C(tube('XStitch', [(-.2, 2.08 + d * .06, .28), (-.08, 2.0 - d * .06, .31)], .016, seg=4), INK) for d in (-1, 1)]
    mz = [(-.16 + k * .04, 1.94 + (.035 if k % 2 else -.035), .315 - abs(-.16 + k * .04) * .15) for k in range(9)]
    mouth = C(tube('Stitch', mz, .013, seg=4), INK)
    slit = C(ellipsoid('MouthSlit', (0, 1.945, .29), (.17, .025, .03), seg=10, rings=4), MOUTH)
    # 破草帽：寬邊、有一道裂口、帽帶
    hat = lathe('StrawHat', [(.001, 2.27), (.52, 2.24), (.62, 2.22), (.64, 2.25), (.3, 2.3), (.27, 2.46), (.2, 2.53), (.001, 2.55)], seg=24,
                wobble=lambda a, y: .06 * math.sin(a * 3 + 1) * sstep(2.28, 2.23, y) - (.12 if abs(a - 1.2) < .18 and y < 2.27 else 0))
    place(hat, (.03, 0, 0), (0, 0, 8))
    C(hat, lambda p, n: mix(0x9a7a3e, 0xd8b870, .5 + .25 * math.sin(math.atan2(p[2], p[0]) * 40 + p[1] * 30) + .25 * n[1]))
    hband = ring('HatBand', (.03, 2.33, 0), .29, .29, .025, 0x6a3a30, seg=4, n=16)
    place(hband, (0, 0, 0), (0, 0, 8))
    # 破衫（c2）：鋸齒下擺、補丁、腰間稻草
    shirt = lathe('Shirt', [(.2, 1.68), (.3, 1.6), (.36, 1.4), (.34, 1.15), (.37, .95), (.42, .78)], seg=26, sz=.72, cap_top=False, cap_bot=False,
                  wobble=lambda a, y: .05 * math.sin(a * 5 + y * 9))
    rag_hem(shirt, .8, .12, 7, seed=6, below=.03)
    Vp(shirt, lambda p, n: .8 + .15 * n[1] + .06 * fb(p, 5, 1) - .1 * sstep(.95, .75, p[1]))
    M(shirt, 'c2')
    patches = []
    for (x, y, col, rot) in [(.14, 1.3, 0x5a6a8a, 12), (-.16, 1.05, 0xa88a4a, -8)]:
        pt = rbox('Patch', (0, 0, 0), (.16, .15, .02), bevel=.01, seg=1)
        place(pt, (x, y, .27), (0, 0, rot))
        C(pt, lambda p, n, col=col: mix(shade(col, .75), col, .5 + .4 * n[2]))
        patches.append(pt)
    pst = [C(tube('PatchStitch', [(x - .07, y + .07 - k * .045, .285), (x - .085, y + .05 - k * .045, .285)], .008, seg=3), INK) for (x, y) in [(.14, 1.3), (-.16, 1.05)] for k in range(3)]
    hay = []
    for k in range(11):
        a = k / 11 * TAU + .2
        hay.append(cone('Hay', (math.cos(a) * .3, .88, math.sin(a) * .22), (math.cos(a) * .4, .56 + .06 * math.sin(k * 1.7), math.sin(a) * .3), .035, seg=3))
    for t_ in hay:
        Vp(t_, lambda p, n: .78 + .22 * sstep(.85, .6, p[1]))
        M(t_, 'c1')
    belt = ring('WaistRope', (0, .95, 0), .345, .25, .025, ROPE, seg=4, n=16, stripes=2)
    # 巫毒大頭針
    pins = []
    for (a, b, col) in [((.05, 2.25, .12), (.18, 2.0, .05), 0xb04a3e), ((-.3, 1.5, .1), (-.12, 1.35, .12), 0xc8a040), ((.25, 1.2, .15), (.08, 1.12, .18), 0x5a7aa8)]:
        A, B = Vector(a), Vector(b)
        d = (A - B).normalized()
        pins.append(C(tube('Pin', [tuple(B), tuple(A)], .012, seg=4), IRON_L))
        pins.append(C(ellipsoid('PinHead', tuple(A + d * .03), (.045, .045, .045), seg=7, rings=5), lambda p, n, col=col: mix(shade(col, .7), col, .5 + .5 * n[1])))
    # 帽上的小墨鴉
    crow = mball('CrowM', [Em((-.22, 2.6, -.05), (.1, .09, .13)), Bm((-.22, 2.7, .07), .07), Km((-.22, 2.6, -.14), (-.22, 2.56, -.3), .04)], slot='fixed', target=220)
    C(crow, lambda p, n: mix(0x1e1a26, 0x4a4458, .4 + .4 * n[1]))
    beak = C(cone('CrowBeak', (-.22, 2.7, .12), (-.22, 2.68, .22), .03, seg=4), 0xc88a3a)
    ceye = [C(ellipsoid('CrowEye', (-.22 + s * .045, 2.72, .11), (.014, .014, .01), seg=5, rings=3), 0xf0d060) for s in (-1, 1)]
    legs_ = [C(tube('CrowLeg', [(-.22 + s * .04, 2.53, -.03), (-.22 + s * .04, 2.5, .0)], .008, seg=3), 0xc88a3a) for s in (-1, 1)]
    J([pole, bar] + lash, 'Post')
    J([sack, tie] + tuft + [btn] + holes + xs + [mouth, slit], 'SackHead')
    J([hat, hband, crow, beak] + ceye + legs_, 'HatM')
    J([shirt] + patches + pst + hay + [belt] + pins, 'ShirtM')
    for s, nm in ((1, 'ArmL'), (-1, 'ArmR')):
        sl = tube('SleeveM', [(s * .2, 1.56, 0), (s * .5, 1.55, -.01), (s * .8, 1.53, -.02)], [.13, .12, .13], seg=12)
        each_vert(sl, lambda p: (p[0], p[1] + .025 * math.sin(abs(p[0]) * 18), p[2]))
        cuff = lathe('Cuff', [(.12, 0), (.15, .08), (.17, .12)], seg=12, cap_top=False, cap_bot=False, wobble=lambda a, y: .15 * math.sin(a * 5) * sstep(0, .12, y))
        orient(cuff, (s * .78, 1.53, -.02), (s, 0, 0))
        for q in (sl, cuff):
            Vp(q, lambda p, n: .78 + .16 * n[1] + .05 * fb(p, 6, 4))
            M(q, 'c2')
        st = []
        for k in range(6):
            a = k / 6 * TAU
            st.append(cone('ArmStraw', (s * .86, 1.53 + math.cos(a) * .06, -.02 + math.sin(a) * .06), (s * 1.08, 1.53 + math.cos(a) * .14, -.02 + math.sin(a) * .13), .03, seg=3))
        for t_ in st:
            Vp(t_, lambda p, n: .8 + .2 * sstep(.9, 1.05, abs(p[0])))
            M(t_, 'c1')
        pa = C(rbox('ElbowPatch', (s * .5, 1.6, .03), (.14, .1, .12), bevel=.02, seg=1), 0x5a6a5a if s > 0 else 0xa06a4a)
        sl = J([sl, cuff, pa] + st, nm)
        pivot(sl, (s * .2, 1.55, 0))


template('scarecrow', scarecrow)


# ── 飛行類 ──
def membrane(name, pts, thick=.022, cuts=1, slot='c2'):
    """一片薄膜（翅膜、風箏布）：外框多邊形三角化後細分，再加厚"""
    bm = bmesh.new()
    vs = [bm.verts.new(V(*p)) for p in pts]
    f_ = bm.faces.new(vs)
    bmesh.ops.triangulate(bm, faces=[f_], quad_method='BEAUTY', ngon_method='BEAUTY')
    if cuts:
        bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=cuts, use_grid_fill=True)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    ob = obj_from_bm(bm, name, slot=slot)
    sol = ob.modifiers.new('s', 'SOLIDIFY')
    sol.thickness = thick
    sol.offset = 0
    apply_mods(ob)
    return ob


def bat():
    """紙鳶蝙蝠：毛茸茸的圓身、大耳、獠牙；翅膀是竹骨撐開的風箏布，尾巴拖著風箏尾帶"""
    body = mball('Body', [Em((0, 0, 0), (.36, .38, .34)), Bm((0, -.07, .26), .15), Bm((0, .22, .05), .22)], slot='c1', target=700)
    Vp(body, lambda p, n: .82 + .12 * n[1] + .06 * fb(p, 8) + .1 * sstep(.1, .3, p[2]) * sstep(.1, -.2, p[1]))
    parts = [body]
    for s in (-1, 1):
        root = Vector((s * .14, .26, 0)); tip = Vector((s * .3, .72, -.06))
        X = (tip - root).normalized(); Z = Vector((s * .2, 0, 1)); Z = (Z - X * Z.dot(X)).normalized(); Y = Z.cross(X)
        er = leafy('Ear', (tip - root).length, .12, .03, cup=.4, taper=.9, seg=8, rings=7, slot='c1', root_w=.7)
        er.matrix_world = Matrix.Translation(V(*root)) @ fm(X, Y, Z)
        Vp(er, lambda p, n: .85 + .1 * n[1])
        ei = leafy('EarIn', (tip - root).length * .75, .08, .01, cup=.3, seg=6, rings=5, slot='c2')
        ei.matrix_world = Matrix.Translation(V(*(root + X * .05 + Z * .03))) @ fm(X, Y, Z)
        Vp(ei, lambda p, n: .8)
        parts += [er, ei]
        parts.append(C(cone('Fang', (s * .06, -.14, .33), (s * .06, -.25, .33), .025, seg=4), 0xffffff))
        parts.append(C(tube('Foot', [(s * .1, -.3, -.05), (s * .12, -.44, -.08)], .025, seg=4), 0x3a3040))
    parts += eye_pair((0, .08, .27), .13, .085, conv=.3, tilt=25, off=.12, iris=0xc84a3a, pa=17, ia=35)
    parts.append(C(ellipsoid('NoseB', (0, -.04, .4), (.05, .035, .03), seg=7, rings=4), 0x3a2a30))
    parts.append(C(tube('MouthB', [(-.1, -.13, .33), (0, -.15, .37), (.1, -.13, .33)], .012, seg=4), MOUTH))
    for k in range(5):
        a = k / 5 * math.pi
        t = cone('Fluff', (math.cos(a) * .08, .3, -.05), (math.cos(a) * .16, .44, -.1 + .05 * math.sin(a)), .05, seg=3)
        parts.append(M(Vp(t, lambda p, n: .92), 'c1'))
    # 風箏尾帶
    tpts = [(0, -.25, -.28), (.05, -.45, -.4), (-.04, -.7, -.5), (.06, -.95, -.58), (0, -1.2, -.64)]
    tail = tube('KiteTail', tpts, .045, seg=4, flat=.15)
    parts.append(M(Vp(tail, lambda p, n: .9), 'c2'))
    for k, (x, y, z) in enumerate(tpts[1:]):
        for sd in (-1, 1):
            bw = membrane('Bow', [(x, y, z), (x + sd * .14, y + .06, z), (x + sd * .14, y - .06, z)], thick=.015, cuts=0, slot='c1' if k % 2 else 'c2')
            Vp(bw, lambda p, n: .9)
            parts.append(bw)
    J(parts, 'BodyM')
    for s, nm in ((1, 'WingL'), (-1, 'WingR')):
        sh = (s * .25, .05, 0)
        tips = [(s * .8, .5, -.05), (s * 1.5, .28, -.1), (s * 1.62, -.2, -.1), (s * 1.12, -.12, -.06), (s * .82, -.38, -.04), (s * .45, -.2, 0)]
        outline = [sh, tips[0], tips[1], tips[2]]
        # 扇貝形後緣：在骨架末端之間往內凹
        for a, b_ in ((tips[2], tips[3]), (tips[3], tips[4]), (tips[4], tips[5])):
            m = Vector(a) + (Vector(b_) - Vector(a)) * .5
            outline.append(tuple(m + (Vector(sh) - m).normalized() * .12))
            outline.append(b_)
        w = membrane(nm + 'M', outline, cuts=2)

        def kite(p, n, s=s):
            d = Vector(p) - Vector(sh)
            a = math.atan2(d[1], abs(d[0]))
            band = .72 if int((a + 1.6) * 2.2) % 2 else 1.0
            edge = .78 if d.length > 1.15 else 1.0
            return band * edge * (.95 + .05 * n[1])
        Vp(w, kite)
        struts = []
        for t_ in (tips[0], tips[1], tips[2], tips[4]):
            st = tube('Strut', [sh, tuple(Vector(sh) + (Vector(t_) - Vector(sh)) * .5 + Vector((0, 0, .02))), t_], [.028, .022, .012], seg=5)
            C(st, lambda p, n: mix(0x9a7a44, 0xd8b878, .5 + .3 * n[1] - (.3 if (Vector(p) - Vector(sh)).length % .3 < .03 else 0)))
            struts.append(st)
        claw = C(cone('WingClaw', tips[0], (tips[0][0] + s * .02, tips[0][1] + .12, tips[0][2]), .03, seg=4), 0x3a3040)
        wg = J([w] + struts + [claw], nm)
        pivot(wg, sh)


template('bat', bat)


def bird():
    """墨鴉／風暴鷹：尖喙、怒眉、冠羽、一片片的飛羽、扇形尾羽、黃爪"""
    body = mball('Body', [Em((0, 0, -.08), (.38, .36, .58)), Bm((0, -.04, .28), .3), Em((0, .3, .48), (.26, .26, .28)), Bm((0, .18, .3), .22)], slot='c1', target=900)
    Vp(body, lambda p, n: .78 + .1 * n[1] + .18 * sstep(.0, .35, p[2]) * sstep(.1, -.25, p[1]) + .04 * fb(p, 6)
       - (.08 if math.sin(p[2] * 30 + abs(p[0]) * 10) > .6 and p[1] > 0 else 0))
    parts = [body]
    up = lathe('BeakU', [(.1, 0), (.09, .1), (.05, .22), (.001, .32)], seg=10)
    each_vert(up, lambda p: (p[0], p[1], p[2] * (1.0 if p[2] > 0 else .5)))
    place(up, (0, .3, .7), (100, 0, 0))
    lo = lathe('BeakL', [(.07, 0), (.05, .12), (.001, .2)], seg=8)
    place(lo, (0, .23, .7), (84, 0, 0))
    for q in (up, lo):
        Vp(q, lambda p, n: .8 + .2 * n[1])
        parts.append(M(q, 'c2'))
    parts.append(Cg(cone('BeakHook', (0, .21, .98), (0, .15, 1.0), .03, seg=4), 0x3a3030, 0x6a5a50))
    parts += eye_pair((0, .38, .66), .13, .07, conv=.7, tilt=30, off=.02, iris=0xe0b040, pa=20, ia=38)
    for k in range(4):
        cr = leafy('Crest', .32 - k * .04, .05, .015, cup=.1, bend=.05, taper=.7, seg=6, rings=5, slot='c1')
        X = Vector((0, .6 - k * .1, -1)).normalized(); Z = Vector((1, 0, 0)); Y = Z.cross(X)
        cr.matrix_world = Matrix.Translation(V(0, .5, .48 - k * .07)) @ fm(X, Y, Z)
        Vp(cr, lambda p, n: .72)
        parts.append(cr)
    for i in range(5):
        a = (i - 2) * .32
        L_ = .6 - abs(i - 2) * .05
        tf = leafy('TailF', L_, .1, .018, cup=.15, bend=-.05, taper=.4, seg=6, rings=6, slot='c1', root_w=.6)
        Vp(tf, lambda p, n, L_=L_: .85 - .3 * sstep(.5, 1.0, p[0] / L_) - (.12 if abs(p[1]) < .012 else 0))
        X = Vector((math.sin(a) * .8, -.12, -1)).normalized(); Z = Vector((0, 1, -.1)).normalized(); Z = (Z - X * Z.dot(X)).normalized(); Y = Z.cross(X)
        tf.matrix_world = Matrix.Translation(V(0, .02, -.5)) @ fm(X, Y, Z)
        parts.append(tf)
    for s in (-1, 1):
        parts.append(C(tube('Shin', [(s * .14, -.28, .02), (s * .15, -.46, .08)], .035, seg=5), 0xd8a040))
        for k in range(3):
            a = (k - 1) * .5
            parts.append(Cg(curve_cone('Talon', [(s * .15, -.46, .08), (s * .15 + math.sin(a) * .1, -.5, .08 + math.cos(a) * .1), (s * .15 + math.sin(a) * .13, -.56, .08 + math.cos(a) * .11)], .03, seg=4), 0x2a2228, 0x5a4a50))
    J(parts, 'BodyM')
    for s, nm in ((1, 'WingL'), (-1, 'WingR')):
        sh = Vector((s * .3, .08, 0))
        wrist = Vector((s * .95, .14, -.1))
        arm = mball('WingArm', [Km(tuple(sh), tuple(wrist), .1), Em(tuple(sh + (wrist - sh) * .45 + Vector((0, 0, -.1))), (.3, .06, .2))], slot='c1', target=260)
        Vp(arm, lambda p, n: .78 + .15 * n[1])
        fe = [arm]
        for k in range(8):
            t = k / 7
            root = sh + (wrist - sh) * (.25 + .75 * t) if k < 6 else wrist
            L_ = .5 + .35 * t if k < 6 else .72 + .06 * (k - 5)
            ang = -1.35 + 1.2 * t
            X = Vector((s * math.cos(ang) * (1 if k < 6 else 1.1), -.02, math.sin(ang))).normalized()
            if k >= 6:
                X = Vector((s * .95, -.05, -.25 * (k - 5))).normalized()
            Z = Vector((0, 1, 0)); Z = (Z - X * Z.dot(X)).normalized(); Y = Z.cross(X)
            f_ = leafy('Feather', L_, .14, .016, cup=.1, bend=.04, taper=.35, seg=6, rings=6, slot='c1' if k < 7 else 'c2', root_w=.7)
            Vp(f_, lambda p, n, L_=L_: .9 - .32 * sstep(.45, 1.0, p[0] / L_) - (.1 if abs(p[1]) < .012 else 0))
            f_.matrix_world = Matrix.Translation(V(*(root + Vector((0, -.02 - .005 * k, 0))))) @ fm(X, Y, Z)
            fe.append(f_)
        wg = J(fe, nm)
        pivot(wg, tuple(sh))


template('bird', bird)


def manta():
    """天空魟魚：菱形扁身、捲起的頭鰭、白肚、背上的斑點、腮裂、長鞭尾與尾刺"""
    body = mball('Body', [Em((0, 0, 0), (.85, .22, 1.0)), Em((0, .08, .2), (.5, .16, .6)), Km((0, 0, -.8), (0, 0, -1.1), .12)], slot='c1', target=1100)
    each_vert(body, lambda p: (p[0], p[1] - (p[0] ** 2) * .1, p[2] + abs(p[0]) * .15 if p[2] > 0 else p[2]))

    def skin(p, n):
        if n[1] < -.2:
            return 1.0
        v = .8 + .12 * n[1] + .04 * fb(p, 4)
        if nz(p, 5.5, 2) > .3:
            v += .18
        return v
    Vp(body, skin)
    belly = mball('Belly', [Em((0, -.05, 0), (.72, .16, .88))], slot='c2', target=500)
    each_vert(belly, lambda p: (p[0], min(p[1], -.05 - (p[0] ** 2) * .1), p[2] + abs(p[0]) * .15 if p[2] > 0 else p[2]))
    Vp(belly, lambda p, n: .9 - (.25 if any(abs(p[2] - (.35 - k * .1)) < .015 for k in range(5)) and abs(p[0]) > .2 else 0))
    parts = [body, belly]
    parts += eye_pair((0, .1, .86), .34, .085, conv=1.2, tilt=15, off=.2, iris=0x2a4a6a, pa=18, ia=36)
    for s in (-1, 1):
        lobe = tube('HeadFin', [(s * .3, 0, .92), (s * .38, .02, 1.15), (s * .42, .1, 1.3), (s * .38, .2, 1.32)], [.1, .09, .06, .02], seg=7, flat=.4)
        parts.append(M(Vp(lobe, lambda p, n: .8 + .15 * n[1]), 'c1'))
    parts.append(C(tube('MouthM', [(-.2, -.1, 1.02), (0, -.12, 1.08), (.2, -.1, 1.02)], .02, seg=4), MOUTH))
    tail = tube('TailW', [(0, 0, -1.0), (0, .05, -1.6), (.05, .12, -2.2), (0, .2, -2.7)], [.09, .06, .03, .01], seg=6)
    parts.append(M(Vp(tail, lambda p, n: .85 + .1 * n[1] - (.2 if (p[2] * 5) % 1 < .2 else 0)), 'c1'))
    parts.append(M(Vp(curve_cone('Stinger', [(0, .08, -1.8), (0, .18, -1.95), (0, .2, -2.1)], .05, seg=5), lambda p, n: .9), 'c2'))
    J(parts, 'BodyM')
    for s, nm in ((1, 'WingL'), (-1, 'WingR')):
        w = mball(nm + 'M', [Em((s * 1.3, 0, -.1), (.9, .055, .7)), Em((s * .75, 0, 0), (.3, .1, .68)), Em((s * 2.0, 0, -.45), (.25, .03, .2))], slot='c1', target=700)
        each_vert(w, lambda p, s=s: (p[0], p[1] - (abs(p[0]) - .6) ** 2 * .15, p[2] - max(0, abs(p[0]) - .6) * .45 * (1 if p[2] < .3 else .4)))
        Vp(w, lambda p, n: 1.0 if n[1] < -.2 else (.78 + .12 * n[1] + (.18 if nz(p, 5.5, 2) > .3 else 0) - .12 * sstep(1.6, 2.2, abs(p[0]))))
        pivot(w, (s * .6, 0, 0))


template('manta', manta)


# ── 植物 ──
def pot():
    """陶盆：外擴盆身、厚唇、裂紋、盆裡的土"""
    def terra(p, n):
        c = mix(0x8a4a2c, 0xc07a4a, .45 + .35 * n[1] + .15 * nz(p, 6))
        if abs(p[0] - .35 * math.sin(p[1] * 6)) < .02 and p[2] > 0 and p[1] < .5:
            c = hexrgb(0x4a2a1e)
        return mix(c, 0x6a3a26, sstep(.15, 0, p[1]) * .5)
    body = C(lathe('Pot', [(.001, 0), (.46, 0), (.5, .04), (.6, .5), (.62, .55)], seg=20, cap_top=False), terra)
    lip = C(lathe('PotLip', [(.6, .52), (.7, .56), (.72, .64), (.68, .72), (.55, .72), (.55, .6)], seg=20, cap_top=False, cap_bot=False), lambda p, n: mix(0x9a5634, 0xd08a58, .5 + .4 * n[1]))
    soil = C(lathe('Soil', [(.56, .62), (.3, .67), (.001, .68)], seg=16, cap_top=False, cap_bot=False, wobble=lambda a, y: .0), lambda p, n: mix(0x2e2420, 0x4a3a30, .5 + .5 * nz(p, 12)))
    return [body, lip, soil]


def plant_flower():
    """砲台花：陶盆、彎莖、有中肋的葉、兩層杯狀花瓣＋花萼、種子紋的花盤中央伸出砲管"""
    parts = pot()
    stem = M(Vp(tube('Stem', [(0, .6, 0), (.08, 1.1, -.02), (-.04, 1.65, .02), (0, 2.08, .05)], [.1, .085, .075, .07], seg=8),
                  lambda p, n: .8 + .12 * n[1] - (.1 if math.sin(math.atan2(p[2], p[0]) * 4) > .7 else 0)), 'c1')
    parts.append(stem)
    for s, y, L_ in ((1, 1.0, .55), (-1, 1.35, .5), (1, 1.7, .36)):
        lf = leafy('Leaf', L_, .15, .025, cup=.25, bend=.12, taper=.6, seg=8, rings=8, slot='c1', root_w=.3)
        Vp(lf, lambda p, n: .85 + .12 * n[1] - (.2 if abs(p[1]) < .015 else 0) - .08 * (p[0] / .55))
        X = Vector((s, .35, .15)).normalized(); Z = Vector((0, 1, 0)); Z = (Z - X * Z.dot(X)).normalized(); Y = Z.cross(X)
        lf.matrix_world = Matrix.Translation(V(s * .05, y, 0)) @ fm(X, Y, Z)
        parts.append(lf)
    J(parts, 'PotM')
    hc = Vector((0, 2.2, .05))
    head = []
    for layer, (n_, L_, W_, tilt, slot) in enumerate([(9, .5, .2, 25, 'c2'), (7, .38, .17, 45, 'c2')]):
        for i in range(n_):
            a = i / n_ * TAU + layer * .35
            out = Vector((math.cos(a), math.sin(a), 0))
            X = (out * math.cos(math.radians(tilt)) + Vector((0, 0, 1)) * math.sin(math.radians(tilt))).normalized()
            Z = Vector((0, 0, 1)); Z = (Z - X * Z.dot(X)).normalized(); Y = Z.cross(X)
            pt = leafy('Petal', L_, W_, .025, cup=.35, bend=-.06, taper=.35, seg=8, rings=7, slot=slot, root_w=.35)
            Vp(pt, lambda p, n, L_=L_: .7 + .3 * sstep(.1, .7, p[0] / L_) - (.12 if abs(p[1]) < .015 else 0))
            pt.matrix_world = Matrix.Translation(V(*(hc + out * .18 + Vector((0, 0, -.04 + layer * .04))))) @ fm(X, Y, Z)
            head.append(pt)
    for i in range(5):
        a = i / 5 * TAU + .3
        out = Vector((math.cos(a), math.sin(a), 0))
        X = (out * .6 + Vector((0, 0, -.8))).normalized(); Z = Vector((0, 0, -1)); Z = (Z - X * Z.dot(X)).normalized(); Y = Z.cross(X)
        sp = leafy('Sepal', .26, .08, .02, cup=.2, taper=.5, seg=6, rings=5, slot='c1')
        Vp(sp, lambda p, n: .75)
        sp.matrix_world = Matrix.Translation(V(*(hc + out * .1 + Vector((0, 0, -.08))))) @ fm(X, Y, Z)
        head.append(sp)
    disc = ellipsoid('Face', tuple(hc + Vector((0, 0, .04))), (.34, .34, .13), seg=20, rings=12)

    def seeds(p, n):
        d = Vector(p) - hc
        r = math.hypot(d[0], d[1])
        k = math.sin(math.atan2(d[1], d[0]) * 13 + r * 60) * math.sin(r * 55)
        return mix(0xa8782a, 0xe0b048, .5 + .35 * k + .2 * n[2])
    C(disc, seeds)
    head.append(disc)
    barrel = C(lathe('Muzzle', [(.001, 0), (.14, 0), (.13, .2), (.16, .23), (.17, .3), (.11, .3), (.1, .15), (.001, .15)], seg=14),
               lambda p, n: mix(0x3a3a44, 0x7a7a88, .5 + .5 * n[1]) if p[2] < 2.4 or True else 0)
    place(barrel, tuple(hc + Vector((0, -.1, .1))), (90, 0, 0))
    head.append(barrel)
    head.append(C(ellipsoid('Bore', tuple(hc + Vector((0, -.1, .38))), (.1, .1, .03), seg=10, rings=4), 0x0e0c12))
    head += eye_pair(tuple(hc + Vector((0, .13, .14))), .13, .075, conv=.3, tilt=28, off=.05, iris=0x7a3a2a, pa=16, ia=34)
    hm = J(head, 'HeadFlower')
    group('Head', tuple(hc), [hm])


template('plant_flower', plant_flower)


def plant_cactus():
    """仙人掌砲手：陶盆、八道稜的柱身與雙臂、稜上的刺座與刺、頭頂的花、斜背彈帶"""
    parts = pot()
    J(parts, 'PotM')
    rib = lambda a, y: .1 * (math.cos(a * 8) ** 2) - .05
    body = lathe('Cactus', [(.001, .6), (.42, .62), (.5, .9), (.5, 1.6), (.48, 2.2), (.38, 2.55), (.2, 2.72), (.001, 2.78)], seg=32, wobble=rib)
    Vp(body, lambda p, n: .78 + .12 * n[1] + .12 * (math.cos(math.atan2(p[2], p[0]) * 8) ** 2) + .04 * fb(p, 4))
    M(body, 'c1')
    arms = []
    for s, (y0, h) in ((1, (1.35, 2.05)), (-1, (1.6, 2.2))):
        pts = [(s * .35, y0, 0), (s * .7, y0 - .02, 0), (s * .86, y0 + .12, 0), (s * .88, h - .2, 0), (s * .86, h, 0)]
        ar = tube('CArm', pts, [.17, .17, .16, .15, .1], seg=16)
        each_vert(ar, lambda p: p)
        Vp(ar, lambda p, n: .8 + .15 * n[1] + .04 * fb(p, 5))
        arms.append(M(ar, 'c1'))
    sp = []
    for k in range(8):
        a = k / 8 * TAU
        for y in (.85, 1.2, 1.55, 1.9, 2.25):
            if 1.2 < a < 1.95 and 1.6 < y < 2.3:
                continue
            r = .6 if y < 2.3 else .48
            base = (math.cos(a) * r * .95, y + .08 * (k % 2), math.sin(a) * r * .95)
            sp.append(C(ellipsoid('Areole', base, (.035, .035, .035), seg=5, rings=3), 0xf0e6c8))
            for j in range(2):
                d = Vector((math.cos(a + (j - .5) * .6), .3 * (j - .5), math.sin(a + (j - .5) * .6)))
                sp.append(C(cone('Spine', base, tuple(Vector(base) + d * .13), .012, seg=3), 0xf6ecd0))
    bloom = []
    for i in range(7):
        a = i / 7 * TAU
        out = Vector((math.cos(a), 0, math.sin(a)))
        X = (out * .7 + Vector((0, .7, 0))).normalized(); Z = Vector((0, 1, 0)); Z = (Z - X * Z.dot(X)).normalized(); Y = Z.cross(X)
        pt = leafy('Blossom', .24, .09, .02, cup=.3, taper=.4, seg=6, rings=5, slot='c2')
        Vp(pt, lambda p, n: .75 + .25 * (p[0] / .24))
        pt.matrix_world = Matrix.Translation(V(*(Vector((0, 2.74, 0)) + out * .05))) @ fm(X, Y, Z)
        bloom.append(pt)
    bloom.append(C(ellipsoid('Pistil', (0, 2.8, 0), (.07, .05, .07), seg=8, rings=4), 0xc88a3a))
    face = eye_pair((0, 1.98, .44), .16, .085, conv=.3, tilt=26, off=.08, iris=0x5a3a1e, pa=16, ia=34)
    face.append(C(ellipsoid('MouthC', (0, 1.72, .47), (.16, .06, .06), seg=10, rings=5), MOUTH))
    face += [Cg(cone('ToothC', (x, 1.76, .52), (x, 1.7, .53), .025, seg=4), BONE_D, BONE) for x in (-.08, .08)]
    band = tube('Bandolier', [(.45, 1.95, .15), (.3, 1.6, .45), (0, 1.3, .54), (-.32, 1.0, .45), (-.5, .8, .1)], .045, seg=5, flat=.35)
    C(band, lambda p, n: mix(0x4a3020, 0x7a5236, .5 + .5 * n[1]))
    shells = []
    for t in (.2, .35, .5, .65, .8):
        pts_ = [Vector(q) for q in [(.45, 1.95, .15), (.3, 1.6, .45), (0, 1.3, .54), (-.32, 1.0, .45), (-.5, .8, .1)]]
        seg_i = min(3, int(t * 4))
        u = t * 4 - seg_i
        p = pts_[seg_i] + (pts_[seg_i + 1] - pts_[seg_i]) * u
        nrm = Vector((p.x, 0, p.z)).normalized()
        shells.append(C(tube('Shell', [tuple(p + nrm * .03), tuple(p + nrm * .03 + Vector((0, .12, 0)))], .03, seg=6), lambda p_, n: mix(0x9a7a3a, 0xe0c060, .5 + .5 * n[1]) if True else 0))
    hd = J([body] + arms + sp + bloom + face + [band] + shells, 'CactusM')
    group('Head', (0, 0, 0), [hd])


template('plant_cactus', plant_cactus)


def plant_shroom():
    """炸彈菇：菌柄上的臉、菌環、菌托；會壓扁的圓菌傘像顆炸彈，頂上有引信與火星"""
    stem = lathe('Stem', [(.001, 0), (.42, 0), (.46, .08), (.38, .2), (.34, .5), (.3, .82), (.24, .9)], seg=18, wobble=lambda a, y: .04 * math.sin(a * 3) * sstep(.1, 0, y))
    Vp(stem, lambda p, n: .86 + .08 * n[1] + .04 * fb(p, 6) - .12 * sstep(.15, 0, p[1]) - (.06 if math.sin(math.atan2(p[2], p[0]) * 14) > .6 else 0))
    M(stem, 'c1')
    skirt = lathe('Annulus', [(.3, .72), (.44, .64), (.46, .6), (.42, .6), (.3, .66)], seg=20, cap_top=False, cap_bot=False, wobble=lambda a, y: .08 * math.sin(a * 7) * sstep(.66, .6, y))
    Vp(skirt, lambda p, n: .92 - .15 * sstep(.62, .6, p[1]))
    M(skirt, 'c1')
    face = eye_pair((0, .44, .33), .13, .085, conv=.3, tilt=20, off=.12, iris=0x5a3a2a, pa=17, ia=35)
    face.append(C(ellipsoid('MouthS', (0, .26, .37), (.09, .045, .04), seg=8, rings=4), MOUTH))
    J([stem, skirt] + face, 'StemM')
    cap = lathe('CapM', [(.25, .78), (.55, .8), (.7, .9), (.74, 1.05), (.68, 1.25), (.5, 1.42), (.25, 1.5), (.001, 1.52)], seg=26)
    Vp(cap, lambda p, n: .76 + .2 * n[1] + .05 * fb(p, 5) - .12 * sstep(.95, .8, p[1]) - (.25 if abs(nz(p, 7, 5)) < .03 and p[1] > 1.0 else 0))
    M(cap, 'c2')
    gill = lathe('Gills', [(.7, .88), (.5, .8), (.3, .8), (.25, .82)], seg=40, cap_top=False, cap_bot=False)
    each_vert(gill, lambda p: (p[0], p[1] - .012 * math.cos(math.atan2(p[2], p[0]) * 20), p[2]))
    gill.data.flip_normals()
    Vp(gill, lambda p, n: .78 + .12 * math.cos(math.atan2(p[2], p[0]) * 20))
    M(gill, 'c1')
    dots = []
    for a, t, r in [(0, .35, .13), (1.5, .45, .1), (3, .38, .12), (4.4, .5, .1), (.8, .1, .09), (2.3, .7, .08), (5.3, .7, .09)]:
        p, nn = surf(cap, (0, 1.0, 0), (math.cos(a) * t * 1.6, 1, math.sin(a) * t * 1.6))
        if p is not None:
            dots.append(C(bump('Dot', tuple(p), tuple(nn), r, r * .3, None, seg=8, rings=4, wob=.15, spin=a * 50), lambda p_, n: mix(0xd8ccb8, 0xfcf6ea, .5 + .5 * n[1])))
    fcap = C(lathe('FuseCap', [(.09, 0), (.1, .06), (.07, .1)], seg=8), BRASS)
    place(fcap, (0, 1.49, 0))
    fuse = C(tube('Fuse', [(0, 1.55, 0), (.04, 1.66, 0), (.1, 1.75, .02), (.14, 1.8, .03)], .03, seg=5), lambda p, n: mix(0x3a3040, 0x6a5a5a, (p[1] * 24) % 1))
    spark = C(ico('Spark', (.15, 1.83, .03), (.07, .07, .07), sub=1), 0xffd070)
    rays = [C(cone('SparkRay', (.15, 1.83, .03), (.15 + math.cos(a) * .16, 1.83 + math.sin(a) * .16, .03), .025, seg=3), 0xffe8a0) for a in [k / 5 * TAU + .3 for k in range(5)]]
    cm = J([cap, gill] + dots + [fcap, fuse, spark] + rays, 'CapBomb')
    group('Squash', (0, .75, 0), [cm])


template('plant_shroom', plant_shroom)


# ── 蟲 ──
CHITIN = 0x2a2432
CHITIN_L = 0x5a5068


def insect_leg(i, hip, knee, foot, r=.055, mech=False):
    """昆蟲腳：股節、脛節、關節球、跗節爪；mech=True 是齒輪蜘蛛的金屬腳（鋼管＋黃銅關節＋活塞）"""
    H, K, F = Vector(hip), Vector(knee), Vector(foot)
    mid = K + (F - K) * .55 + Vector((0, .04, 0))
    col_lo, col_hi = (IRON, IRON_L) if mech else (CHITIN, CHITIN_L)
    fem = Cg(tube('Femur', [tuple(H), tuple(H + (K - H) * .5 + Vector((0, .03, 0))), tuple(K)], [r * 1.15, r * 1.3, r], seg=6), col_lo, col_hi)
    tib = Cg(tube('Tibia', [tuple(K), tuple(mid), tuple(F + Vector((0, .05, 0)))], [r * .95, r * .8, r * .5], seg=6), col_lo, col_hi)
    parts = [fem, tib]
    jc = BRASS if mech else CHITIN_L
    parts.append(C(ellipsoid('Joint', tuple(K), (r * 1.3, r * 1.3, r * 1.3), seg=7, rings=5), lambda p, n: mix(shade(jc, .6), jc, .5 + .5 * n[1])))
    parts.append(Cg(cone('TarsusClaw', tuple(F + Vector((0, .06, 0))), tuple(F + (F - H).normalized() * .06 * Vector((1, 0, 1)).length - Vector((0, .01, 0))), r * .6, seg=4), shade(col_lo, .7), col_lo))
    if mech:
        a = H + (K - H) * .25 + Vector((0, .06, 0))
        parts.append(C(tube('Piston', [tuple(a), tuple(K + (F - K) * .35 + Vector((0, .05, 0)))], r * .35, seg=4), IRON_L))
    else:
        for k in range(2):
            t = K + (F - K) * (.3 + .3 * k)
            parts.append(Cg(cone('Spur', tuple(t), tuple(t + Vector((0, -.02, 0)) + (H - K).normalized() * -.0 + Vector((0, 0, -.06))), r * .4, seg=3), col_lo, col_hi))
    lg = J(parts, 'Leg%d' % i)
    pivot(lg, hip)
    return lg


def bug(kind):
    def b():
        if kind == 'beetle':
            body = mball('Body', [Em((0, .56, -.05), (.48, .32, .7)), Em((0, .6, .5), (.36, .26, .24)), Em((0, .42, -.05), (.42, .18, .6))], slot='c1', target=700)
            Vp(body, lambda p, n: .78 + .15 * n[1] + .05 * fb(p, 5) - (.12 if (p[2] * 8) % 1 < .25 and n[1] < 0 else 0))
            pron = mball('Pronotum', [Em((0, .72, .5), (.4, .2, .26)), Em((0, .8, .62), (.12, .08, .12))], slot='c1', target=320)
            Vp(pron, lambda p, n: .8 + .2 * n[1] + .05 * fb(p, 6))
            parts = [body, pron]
            for s in (-1, 1):
                el = ellipsoid('Elytron', (s * .24, .74, -.12), (.3, .24, .74), seg=18, rings=14)
                each_vert(el, lambda p, s=s: (p[0] if s * p[0] > .02 else s * .02 + (p[0] - s * .02) * .2, max(p[1], .55), p[2]))
                Vp(el, lambda p, n, s=s: .8 + .18 * n[1] + .05 * fb(p, 5) - (.12 if abs(math.sin((p[0] - s * .24) * 22)) > .9 else 0)
                   - (.22 if nz(p, 6, 3 + s) > .35 else 0) - .12 * sstep(.62, .55, p[1]))
                parts.append(M(el, 'c2'))
            parts += eye_pair((0, .66, .84), .16, .075, conv=.6, tilt=24, off=.1, iris=0xd8602a, pa=16, ia=34)
            head = mball('HeadMesh', [Em((0, .58, .8), (.26, .2, .18)), Bm((.16, .66, .86), .06, s=4, neg=True), Bm((-.16, .66, .86), .06, s=4, neg=True)], slot='c1', target=300)
            Vp(head, lambda p, n: .8 + .15 * n[1])
            parts.append(head)
            parts.append(Cg(curve_cone('Horn', [(0, .7, .9), (0, .82, 1.02), (0, 1.02, 1.08), (0, 1.14, 1.0)], .08, seg=7), CHITIN, CHITIN_L))
            for s in (-1, 1):
                parts.append(Cg(curve_cone('Mandible', [(s * .12, .5, .92), (s * .16, .48, 1.04), (s * .06, .46, 1.12)], .045, seg=5), CHITIN, CHITIN_L))
                parts.append(C(tube('Antenna', [(s * .12, .74, .92), (s * .26, .95, 1.05), (s * .34, 1.02, 1.0)], [.018, .014, .012], seg=4), CHITIN))
                parts.append(C(ellipsoid('AntClub', (s * .35, 1.03, .99), (.04, .05, .04), seg=6, rings=4), CHITIN_L))
            # 背上的火藥引信（點燃的火星）
            fuse = C(tube('Fuse', [(0, .95, -.55), (.02, 1.12, -.66), (.1, 1.26, -.62), (.14, 1.32, -.52)], .028, seg=5), lambda p, n: mix(0x3a3040, 0x6a5a5a, (p[1] * 20) % 1))
            cap = C(lathe('FuseCap', [(.07, 0), (.09, .05), (.06, .09)], seg=8), BRASS)
            place(cap, (0, .9, -.54), (-20, 0, 0))
            spark = C(ico('Spark', (.15, 1.35, -.5), (.06, .06, .06), sub=1), 0xffd070)
            parts += [fuse, cap, spark]
            J(parts, 'BodyM')
            for i in range(6):
                sd = 1 if i % 2 else -1
                k = i // 2
                z = .35 - k * .35
                hip = (sd * .32, .45, z)
                insect_leg(i, hip, (sd * .62, .66, z * 1.1 + .03), (sd * .82, 0, z * 1.35 - .05), r=.055)
        elif kind == 'spider':
            body = mball('Body', [Em((0, .85, -.25), (.52, .42, .5)), Em((0, .78, .32), (.36, .28, .32)), Em((0, .66, -.2), (.4, .16, .4))], slot='c1', target=800)

            def brass(p, n):
                seam = .2 if abs(math.sin(math.atan2(p[0], p[2] + .25) * 4)) < .08 or abs(p[2] - .08) < .015 else 0
                return .78 + .2 * n[1] + .05 * fb(p, 6) - seam
            Vp(body, brass)
            parts = [body]
            for k in range(14):
                a = k / 14 * TAU
                p, nn = surf(body, (0, .85, -.25), (math.cos(a), .15, math.sin(a)))
                if p is not None:
                    parts.append(C(bump('Rivet', tuple(p), tuple(nn), .03, .018, None, seg=5, rings=3), lambda p_, n: mix(0x6a5230, 0xd8b868, .5 + .5 * n[1])))
            # 多顆鏡頭眼：兩大四小
            for (x, y, z, r) in [(.1, .86, .6, .075), (-.1, .86, .6, .075), (.2, .8, .52, .045), (-.2, .8, .52, .045), (.07, .98, .5, .04), (-.07, .98, .5, .04)]:
                parts += eyeball((x, y, z), r, (x * 2, .1, 1), iris=0xd05030, pa=22, ia=40, sclera=0x2a2a34, pupil=0x1a0a0a)
                parts.append(C(lathe('LensRim', [(r * 1.05, -r * .3), (r * 1.25, 0), (r * 1.1, r * .25)], seg=10, cap_top=False, cap_bot=False), BRASS))
                orient(parts[-1], (x, y, z - r * .1), (x * 2, .1, 1))
            for s in (-1, 1):
                parts.append(C(curve_cone('Fang', [(s * .08, .64, .6), (s * .1, .52, .66), (s * .05, .42, .64)], .035, seg=5), IRON_L))
            chim = C(lathe('Chimney', [(.07, 0), (.07, .22), (.1, .25), (.1, .3), (.06, .3)], seg=10, cap_top=False), IRON)
            place(chim, (-.2, 1.1, -.55), (-15, 0, 10))
            parts.append(chim)
            J(parts, 'BodyM')
            # 齒輪：軸心朝 +z，網頁轉 rotation.z
            bm = bmesh.new()
            NT = 12
            outer, inner = [], []
            for k in range(NT * 4):
                a = k / (NT * 4) * TAU
                r = .62 if (k % 4) in (1, 2) else .5
                outer.append((math.cos(a) * r, math.sin(a) * r))
            rings_ = []
            for zz in (.06, -.06):
                rings_.append([bm.verts.new(V(x, y, zz)) for x, y in outer])
                rings_.append([bm.verts.new(V(math.cos(k / (NT * 4) * TAU) * .36, math.sin(k / (NT * 4) * TAU) * .36, zz)) for k in range(NT * 4)])
            of, inf_, ob_, ib_ = rings_
            N_ = NT * 4
            for k in range(N_):
                k2 = (k + 1) % N_
                bm.faces.new((of[k], of[k2], inf_[k2], inf_[k]))
                bm.faces.new((ob_[k], ib_[k], ib_[k2], ob_[k2]))
                bm.faces.new((of[k], ob_[k], ob_[k2], of[k2]))
                bm.faces.new((inf_[k], inf_[k2], ib_[k2], ib_[k]))
            bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
            gr = obj_from_bm(bm, 'GearRim', slot='c2')
            for p_ in gr.data.polygons:
                p_.use_smooth = False
            Vp(gr, lambda p, n: .78 + .2 * abs(n[2]) + .05 * nz(p, 8))
            spokes = [M(Vp(rbox('Spoke', (0, 0, 0), (.72, .08, .08), bevel=.015, seg=1), lambda p, n: .85), 'c2') for _ in range(3)]
            for k, sp in enumerate(spokes):
                sp.matrix_world = Matrix.Rotation(k * math.pi / 3, 4, 'Y')
            hub = M(Vp(lathe('Hub', [(.001, -.1), (.12, -.1), (.12, .1), (.001, .1)], seg=10), lambda p, n: .7), 'c2')
            place(hub, (0, 0, 0), (90, 0, 0))
            gear = J([gr] + spokes + [hub], 'Gear')
            gear.location = V(0, 1.3, -.28)
            bpy.context.view_layer.update()
            for i in range(8):
                sd = 1 if i % 2 else -1
                k = i // 2
                z = (.35 - k * (.7 / 3)) * 1.2
                hip = (sd * .35, .7, z)
                insect_leg(i, hip, (sd * 1.3 * .75, .7 + .45, z * 1.2), (sd * 1.3, 0, z * 1.4), r=.05, mech=True)
        else:
            body = mball('Body', [Em((0, .42, 0), (.42, .38, .44)), Bm((0, .82, -.05), .18), Bm((0, 1.0, -.12), .09), Bm((.02, 1.1, -.2), .05)], slot='c1', target=700)
            Vp(body, lambda p, n: .8 + .18 * n[1] + .04 * fb(p, 6) + .15 * sstep(-.3, -.7, n[1]))
            parts = [body]
            parts += eye_pair((0, .52, .33), .16, .13, conv=.3, tilt=-8, off=.42, iris=0x6a5aa0, pa=24, ia=42, lidk=1.1, lidval=.95)
            parts.append(C(ellipsoid('MouthM', (0, .3, .4), (.07, .035, .03), seg=8, rings=4), MOUTH))
            for s in (-1, 1):
                a = M(Vp(tube('Antenna', [(s * .1, .74, .15), (s * .2, .92, .22), (s * .26, 1.0, .16)], [.02, .016, .012], seg=4), lambda p, n: .9), 'c1')
                tip = M(Vp(ellipsoid('AntTip', (s * .27, 1.02, .15), (.045, .045, .045), seg=7, rings=5), lambda p, n: .9 + .1 * n[1]), 'c2')
                parts += [a, tip]
            shine = C(bump('Shine', (-.2, .68, .26), (-.4, .7, .5), .07, .015, None, seg=8, rings=3), (1, 1, 1))
            parts += [shine]
            J(parts, 'BodyM')
            for i in range(6):
                sd = 1 if i % 2 else -1
                k = i // 2
                z = .35 - k * .35
                hip = (sd * .35, .3, z)
                insect_leg(i, hip, (sd * .46, .3, z * 1.05), (sd * .52, 0, z * 1.1), r=.045)
    return b


template('bug_beetle', bug('beetle'))
template('bug_spider', bug('spider'))
template('bug_mite', bug('mite'))


def ghost():
    """藍磷鬼火：往上竄的多股火舌、身體下緣捲成尾巴、內亮外暗、飄在旁邊的小火星"""
    body = lathe('Wisp', [(.001, .1), (.2, .25), (.5, .7), (.64, 1.15), (.6, 1.55), (.45, 1.9), (.25, 2.15), (.001, 2.35)], seg=20,
                 wobble=lambda a, y: .1 * math.sin(a * 3 + y * 5) * sstep(1.3, .2, y) + .06 * math.sin(a * 5 - y * 4) * sstep(1.4, 2.2, y))
    each_vert(body, lambda p: (p[0] + .15 * math.sin(p[1] * 3) * sstep(.9, .1, p[1]), p[1], p[2] - .25 * sstep(.8, .1, p[1])))
    Vp(body, lambda p, n: .65 + .35 * sstep(-.3, .6, n[2]) * sstep(.3, 1.2, p[1]) + .05 * nz(p, 5))
    M(body, 'glow')
    parts = [body]
    for k in range(5):
        a = k / 5 * TAU + .4
        r0 = .3
        pts = [(math.cos(a) * r0, 1.8, math.sin(a) * r0 * .8), (math.cos(a) * .42, 2.2, math.sin(a) * .35), (math.cos(a + .6) * .3, 2.55 + .1 * (k % 2), math.sin(a + .6) * .25), (math.cos(a + 1.1) * .12, 2.8 + .15 * (k % 3), math.sin(a + 1.1) * .1)]
        fl = tube('Flame', pts, [.16, .13, .07, .005], seg=7)
        parts.append(M(Vp(fl, lambda p, n: .6 + .4 * sstep(2.0, 2.8, p[1])), 'glow'))
    parts += eye_pair((0, 1.55, .5), .2, .12, conv=.2, tilt=-12, off=.3, lidslot='glow', lidval=.75, iris=0x1a3a5a, pa=22, ia=40, lidk=1.1)
    parts.append(C(ellipsoid('MouthG', (0, 1.2, .58), (.12, .15, .05), seg=10, rings=6), 0x1a1a3a))
    for k, (x, y, z) in enumerate([(.8, 1.6, .2), (-.75, 2.1, -.1), (.55, 2.6, -.3), (-.6, 1.1, .3)]):
        parts.append(M(Vp(ico('Ember', (x, y, z), (.07 - k * .008,) * 3, sub=1), lambda p, n: 1.0), 'glow'))
    J(parts, 'WispM')


template('ghost', ghost)


def rock(name, c, half, seed=0, sub=2, sq=.6, amp=.05, slot='c1'):
    """近似方塊的岩塊：icosphere 推向立方體、加雜訊凹凸、平面著色（BOTW 岩石的切面感）"""
    ob = ico(name, (0, 0, 0), (1, 1, 1), sub=sub, slot=slot)

    def fn(p):
        q = Vector([math.copysign(abs(x) ** sq, x) for x in p])
        d = 1 + amp * fb(p, 1.6, seed) / max(.3, max(half))
        return (c[0] + q[0] * half[0] * d, c[1] + q[1] * half[1] * d, c[2] + q[2] * half[2] * d)
    each_vert(ob, fn)
    for p_ in ob.data.polygons:
        p_.use_smooth = False
    return ob


def stone_val(seed=0, runes=False):
    def fn(p, n):
        v = .78 + .14 * n[1] + .07 * fb(p, 2.2, seed)
        if abs(nz(p, 2.5, seed + 1)) < .05:
            v -= .22
        if nz(p, 5, seed + 2) > .42:
            v += .1
        if runes and p[2] > .45:
            r = math.hypot(p[0], p[1] - 2.0)
            if abs(r - .34) < .045 or (abs(p[0]) < .035 and abs(p[1] - 2.0) < .5) or (abs(p[1] - 2.0 - abs(p[0]) * .6) < .035 and abs(p[0]) < .34):
                v = .42
        return v
    return fn


def golem():
    body = rock('Body', (0, 1.9, 0), (.92, .82, .66), seed=3, sub=3, sq=.55, amp=.06)
    Vp(body, stone_val(3, runes=True))
    belly = rock('Belly', (0, 1.25, .12), (.66, .32, .5), seed=5, sub=2)
    hip = rock('Hip', (0, 1.08, 0), (.72, .22, .52), seed=6, sub=2)
    for q in (belly, hip):
        Vp(q, stone_val(5))
    head = rock('HeadMesh', (0, 3.02, .1), (.5, .42, .46), seed=7, sub=2, sq=.6)
    brow = rock('Brow', (0, 3.22, .42), (.52, .1, .14), seed=8, sub=1, sq=.7)
    jaw = rock('Jaw', (0, 2.72, .3), (.36, .14, .22), seed=9, sub=1)
    for q in (head, brow, jaw):
        Vp(q, stone_val(7))
    sock = C(ellipsoid('Socket', (0, 3.06, .5), (.3, .17, .1), seg=12, rings=6), 0x1e1a22)
    bodym = J([body, belly, hip, head, brow, jaw, sock], 'BodyM')
    eye = ellipsoid('Eye', (0, 3.06, .52), (.2, .15, .1), seg=14, rings=8, slot='c2')
    Vp(eye, lambda p, n: .45 if math.hypot(p[0], p[1] - 3.06) < .05 else (.95 if math.hypot(p[0], p[1] - 3.06) < .12 else .7))
    glint = C(ellipsoid('EyeGlint', (-.06, 3.12, .61), (.03, .025, .01), seg=6, rings=3), (1, 1, 1))
    group('x_eye', (0, 0, 0), [J([eye, glint], 'EyeM')])
    ey = eye_pair((0, 3.06, .5), .19, .1, conv=.2, tilt=26, off=.05, iris=0xd8a040, pa=16, ia=34)
    group('x_eyes', (0, 0, 0), [J(ey, 'EyesM')])
    for s, nm in ((1, 'ArmL'), (-1, 'ArmR')):
        sh = rock('Shoulder', (s * 1.22, 2.45, 0), (.44, .36, .42), seed=10 + s, sub=2)
        up = rock('Upper', (s * 1.26, 1.75, 0), (.3, .45, .3), seed=12 + s, sub=2)
        fist = rock('Fist', (s * 1.3, .85, .05), (.4, .34, .4), seed=14 + s, sub=2, sq=.55)
        kn = [rock('Knuckle', (s * 1.3 + dx, .78, .42), (.1, .1, .1), seed=16 + k, sub=1) for k, dx in enumerate((-.2, 0, .2))]
        for q in [sh, up, fist] + kn:
            Vp(q, stone_val(10 + s))
        a = J([sh, up, fist] + kn, nm)
        pivot(a, (s * 1.2, 2.3, 0))
    legs = []
    for s, nm in ((1, 'LegL'), (-1, 'LegR')):
        th = rock('Thigh', (s * .5, .72, 0), (.36, .4, .36), seed=20 + s, sub=2)
        ft = rock('Foot', (s * .52, .16, .1), (.4, .17, .46), seed=22 + s, sub=2)
        for q in (th, ft):
            Vp(q, stone_val(20 + s))
        lg = J([th, ft], nm)
        pivot(lg, (s * .5, 1.1, 0))
        legs.append(lg)
    # 苔蘚：沿頂面長出的苔墊、垂下的藤蔓與小葉
    mossy = []
    tgt = bodym
    for k in range(16):
        x = random.uniform(-.8, .8); z = random.uniform(-.5, .5)
        p, nn = surf(tgt, (x, 4.2, z), (0, -1, 0))
        if p is None or nn[1] < .3 or p[1] > 3.5:
            continue
        mossy.append(bump('Moss', tuple(p), tuple(nn), random.uniform(.18, .3), .08, None, seg=9, rings=4, wob=.3, spin=k * 40, slot='c2'))
    for s in (-1, 1):
        mossy.append(bump('Moss', (s * 1.22, 2.8, 0), (s * .3, 1, 0), .38, .1, None, seg=10, rings=4, wob=.2, slot='c2'))
    for m_ in mossy:
        Vp(m_, lambda p, n: .8 + .15 * n[1] + .1 * nz(p, 9))
    vines = []
    for x in (-.55, -.1, .35, .7):
        top = (x, 2.62, .68)
        pts = [top, (x + .06, 2.2, .72), (x - .04, 1.75, .7), (x + .03, 1.4, .66)]
        vn = M(Vp(tube('Vine', pts, [.04, .035, .03, .02], seg=5), lambda p, n: .7), 'c2')
        vines.append(vn)
        for k in range(3):
            q = Vector(pts[k + 1])
            lf = leafy('VineLeaf', .16, .06, .012, cup=.2, taper=.5, seg=5, rings=4, slot='c2')
            Vp(lf, lambda p, n: .95)
            X = Vector(((-1) ** k, -.3, .4)).normalized(); Z = Vector((0, 0, 1)); Z = (Z - X * Z.dot(X)).normalized(); Y = Z.cross(X)
            lf.matrix_world = Matrix.Translation(V(*q)) @ fm(X, Y, Z)
            vines.append(lf)
    group('x_moss', (0, 0, 0), [J(mossy + vines, 'MossM')])


template('golem', golem)


def crab():
    body = mball('Body', [Em((0, .85, 0), (1.02, .42, .76)), Em((0, 1.0, -.05), (.7, .3, .55)),
                          Em((0, .62, .05), (.8, .2, .6))] + [Bm((x, .9, .8), .1, s=4, neg=True) for x in (-.62, -.32, .32, .62)],
                  slot='c1', target=1400)

    def shellv(p, n):
        if n[1] < -.3:
            return .95
        v = .78 + .16 * n[1] + .05 * fb(p, 4)
        if nz(p, 4.5, 3) > .35:
            v -= .14
        return v + .1 * sstep(.6, .78, math.hypot(p[0] / 1.02, p[2] / .76))
    Vp(body, shellv)
    parts = [body]
    for x, z, r in [(-.4, .1, .12), (.3, -.1, .14), (0, .3, .1), (-.1, -.32, .12), (.55, .2, .09), (-.6, -.2, .1)]:
        p, nn = surf(body, (x, 2, z), (0, -1, 0))
        if p is not None:
            parts.append(M(Vp(bump('Bump', tuple(p), tuple(nn), r, r * .55, None, seg=8, rings=5), lambda p_, n: .7 + .25 * n[1]), 'c2'))
    for s in (-1, 1):
        parts.append(M(Vp(tube('Stalk', [(s * .22, 1.08, .55), (s * .26, 1.32, .6), (s * .3, 1.5, .6)], [.06, .05, .05], seg=6), lambda p, n: .85), 'c1'))
        parts += eyeball((s * .3, 1.6, .62), .1, (s * .4, .1, 1), iris=0x2a2a2a, pa=24, ia=40)
        lid = eyelid((s * .3, 1.6, .62), .1, s, tilt=30, off=.05, fwd=(s * .4, .1, 1))
        parts.append(lid)
        parts.append(M(Vp(cone('Maxilla', (s * .12, .7, .74), (s * .08, .52, .85), .06, seg=5), lambda p, n: .8), 'c2'))
    parts.append(C(tube('MouthCr', [(-.14, .76, .77), (0, .72, .8), (.14, .76, .77)], .02, seg=4), MOUTH))
    J(parts, 'BodyM')
    for s, nm in ((1, 'ArmL'), (-1, 'ArmR')):
        up = mball('ClawArm', [Km((s * .8, .9, .35), (s * 1.05, 1.0, .62), .14), Km((s * 1.05, 1.0, .62), (s * 1.18, 1.02, .82), .12),
                               Em((s * 1.22, 1.05, 1.02), (.3, .24, .36)), Km((s * 1.14, 1.12, 1.2), (s * 1.08, 1.2, 1.55), .09, s=3)], slot='c1', target=700)
        Vp(up, lambda p, n: .8 + .15 * n[1] + (-.12 if nz(p, 5, 2) > .35 else 0))
        dact = M(Vp(curve_cone('Dactyl', [(s * 1.28, .98, 1.18), (s * 1.3, .96, 1.38), (s * 1.24, 1.02, 1.55)], .09, seg=6), lambda p, n: .75 + .2 * n[1]), 'c2')
        tip = M(Vp(cone('PincerTip', (s * 1.08, 1.2, 1.52), (s * 1.08, 1.17, 1.66), .05, seg=5), lambda p, n: .7), 'c2')
        teeth = [Cg(cone('ClawTooth', (s * (1.18 + .03 * k), 1.08, 1.25 + k * .1), (s * (1.2 + .03 * k), 1.02, 1.28 + k * .1), .025, seg=3), BONE_D, BONE) for k in range(3)]
        a = J([up, dact, tip] + teeth, nm)
        pivot(a, (s * .8, .9, .35))
    for i in range(6):
        sd = 1 if i % 2 else -1
        z = .25 - (i // 2) * .3
        H, K, F = Vector((sd * .8, .75, z)), Vector((sd * 1.3, .95, z - .05)), Vector((sd * 1.5, 0, z - .1))
        seg1 = M(Vp(tube('LegA', [tuple(H), tuple(K)], [.08, .07], seg=6), lambda p, n: .82 + .12 * n[1]), 'c1')
        seg2 = M(Vp(tube('LegB', [tuple(K), tuple(K + (F - K) * .55 + Vector((sd * .04, .02, 0))), tuple(F + Vector((0, .1, 0)))], [.07, .055, .035], seg=6), lambda p, n: .8 + .12 * n[1]), 'c1')
        kn = M(Vp(ellipsoid('Knee', tuple(K), (.08, .08, .08), seg=7, rings=5), lambda p, n: .7), 'c2')
        tp = M(Vp(cone('LegTip', tuple(F + Vector((0, .12, 0))), tuple(F), .04, seg=4), lambda p, n: .6), 'c2')
        lg = J([seg1, seg2, kn, tp], 'Leg%d' % i)
        pivot(lg, tuple(H))
    ic = []
    for x, z, h in [(-.35, -.1, .5), (0, -.2, .62), (.35, -.1, .46), (-.15, .15, .34), (.2, .12, .3)]:
        cr = lathe('Icicle', [(.07, -.08), (.1, 0), (.09, h * .6), (.001, h)], seg=6)
        place(cr, (x, 1.2, z), (random.uniform(-12, 12), random.uniform(0, 60), random.uniform(-12, 12)))
        C(cr, lambda p, n: mix(0x9ec8dc, 0xf0fbff, .45 + .45 * n[1] + .1 * nz(p, 12)))
        ic.append(cr)
    group('x_icicle', (0, 0, 0), [J(ic, 'IcicleM')])


template('crab', crab)


def snake():
    """蛇頭（Seg0）、沙蟲頭（Seg0W）與六節身體；網頁每幀設定每節位置，所以每節的網格都繞著自己的原點"""
    head = mball('HeadS', [
        Em((0, .56, .02), (.34, .26, .44)), Km((0, .54, .25), (0, .5, .56), .2), Em((0, .44, .16), (.3, .12, .42)),
        Km((.17, .72, .22), (.13, .68, .48), .07, s=3), Km((-.17, .72, .22), (-.13, .68, .48), .07, s=3),
        Bm((.2, .66, .38), .06, s=4, neg=True), Bm((-.2, .66, .38), .06, s=4, neg=True),
    ], slot='c1', target=800)
    Vp(head, lambda p, n: (.95 if n[1] < -.3 else .8 + .12 * n[1]) - (.12 if nz(p, 7, 4) > .35 and n[1] > 0 else 0))
    parts = [head]
    for s in (-1, 1):
        parts += eyeball((s * .2, .65, .37), .075, (s * .9, .1, .6), iris=0xd8b030, pa=14, ia=40)
        parts.append(eyelid((s * .2, .65, .37), .075, s, tilt=30, off=.1, fwd=(s * .9, .1, .6)))
        parts.append(C(ellipsoid('Nostril', (s * .07, .6, .66), (.02, .015, .015), seg=5, rings=3), 0x1a1420))
        parts.append(C(tube('MouthS', [(s * .05, .45, .7), (s * .2, .46, .5), (s * .3, .5, .2)], .014, seg=4), MOUTH))
    tg = [C(tube('SnakeTongue', [(0, .45, .6), (0, .44, .85)], [.022, .018], seg=4), 0xc04a54)]
    for s in (-1, 1):
        tg.append(C(cone('Fork', (0, .44, .84), (s * .06, .45, .98), .016, seg=4), 0xc04a54))
    hm = J(parts + tg, 'HeadSM')
    group('Seg0', (0, .55, 0), [hm])
    wh = lathe('HeadW', [(.44, -.35), (.5, -.1), (.5, .15), (.46, .35), (.4, .48)], seg=20, cap_top=False, cap_bot=False)
    each_vert(wh, lambda p: (p[0] * (1 + .04 * math.cos(p[1] * 30)), p[1], p[2] * (1 + .04 * math.cos(p[1] * 30))))
    place(wh, (0, .55, 0), (90, 0, 0))
    Vp(wh, lambda p, n: .8 + .12 * n[1] - (.14 if math.cos(p[2] * 30) > .5 else 0))
    M(wh, 'c1')
    lip = lathe('Lip', [(.4, .46), (.43, .52), (.36, .56), (.3, .52)], seg=20, cap_top=False, cap_bot=False)
    place(lip, (0, .55, 0), (90, 0, 0))
    Vp(lip, lambda p, n: .9)
    M(lip, 'c2')
    maw = C(lathe('Maw', [(.33, .52), (.26, .46), (.14, .32), (.001, .2)], seg=18, cap_top=False, cap_bot=False), lambda p, n: mix(0x2a1018, 0x6a2a36, sstep(.25, .5, p[2])))
    place(maw, (0, .55, 0), (90, 0, 0))
    teeth = []
    for ring_, (r0, z0, n_) in enumerate([(.3, .52, 12), (.21, .42, 9), (.12, .3, 6)]):
        for k in range(n_):
            a = (k + .5 * ring_) / n_ * TAU
            b_ = (math.cos(a) * r0, .55 + math.sin(a) * r0, z0)
            c_ = (math.cos(a) * r0 * .55, .55 + math.sin(a) * r0 * .55, z0 + .05)
            teeth.append(Cg(cone('Tooth', b_, c_, .035 - ring_ * .008, seg=4), BONE_D, BONE))
    feel = [M(Vp(curve_cone('Feeler', [(math.cos(a) * .42, .55 + math.sin(a) * .42, .45), (math.cos(a) * .55, .55 + math.sin(a) * .55, .6), (math.cos(a) * .58, .55 + math.sin(a) * .6, .8)], .04, seg=4), lambda p, n: .8), 'c2') for a in (.6, 2.5, 4.5)]
    wm = J([wh, lip, maw] + teeth + feel, 'HeadWM')
    group('Seg0W', (0, .55, 0), [wm])
    for k in range(1, 7):
        sc = 1 - k / 7 * .55
        sg = ellipsoid('Seg%d' % k, (0, .55, 0), (.42 * sc, .38 * sc, .48 * sc), seg=16, rings=12, slot='c1' if k % 2 else 'c2')

        def segv(p, n, sc=sc):
            if n[1] < -.35:
                return .98 - (.12 if (p[2] * 10) % 1 < .25 else 0)
            v = .8 + .12 * n[1] + .04 * fb(p, 6)
            if (abs(p[0]) + abs(((p[2] / sc) * 2.2) % 1 - .5)) < .35 and n[1] > .3:
                v -= .15
            return v
        Vp(sg, segv)
        pivot(sg, (0, .55, 0))


template('snake', snake)


def jelly():
    """雲朵水母：一團團雲朵鼓起的傘、下緣波浪傘膜、肚子下發光的核心、緞帶狀觸手（Leg0~5）與中央口腕"""
    els = [Em((0, 1.9, 0), (.8, .45, .8), s=3)]
    for k in range(10):
        a = k / 10 * TAU
        els.append(Bm((math.cos(a) * .72, 1.85 + .08 * (k % 2), math.sin(a) * .72), .32 + .05 * (k % 3), s=4))
    for k in range(6):
        a = k / 6 * TAU + .4
        els.append(Bm((math.cos(a) * .4, 2.3, math.sin(a) * .4), .3, s=4))
    els += [Bm((0, 2.5, 0), .36, s=4)]
    dome = mball('Dome', els, slot='c1', target=2000)
    each_vert(dome, lambda p: (p[0], max(p[1], 1.45 + .05 * math.sin(math.atan2(p[2], p[0]) * 8)), p[2]))
    Vp(dome, lambda p, n: .8 + .2 * sstep(-.2, .8, n[1]) + .04 * fb(p, 4) - .15 * sstep(1.6, 1.45, p[1]))
    frill = lathe('Frill', [(.98, 1.52), (1.02, 1.42), (.96, 1.3), (.9, 1.24)], seg=32, cap_top=False, cap_bot=False,
                  wobble=lambda a, y: .06 * math.sin(a * 10) * sstep(1.45, 1.25, y))
    each_vert(frill, lambda p: (p[0], p[1] - .05 * (1 + math.sin(math.atan2(p[2], p[0]) * 10)) * sstep(1.45, 1.25, p[1]), p[2]))
    Vp(frill, lambda p, n: .85)
    M(frill, 'c2')
    core = M(Vp(ellipsoid('Core', (0, 1.38, 0), (.5, .22, .5), seg=16, rings=8), lambda p, n: .7 + .3 * sstep(1.2, 1.45, p[1])), 'glow')
    ep, _ = surf(dome, (0, 1.9, 0), (0, 0, 1))
    ez = ep[2] - .06 if ep is not None else 1.0
    ey = eye_pair((0, 1.9, ez), .3, .13, conv=.3, tilt=16, off=.22, iris=0x5a4a8a, pa=18, ia=36, lidk=1.12, lidval=.95)
    mouth = C(tube('MouthJ', [(-.1, 1.66, ez + .02), (0, 1.63, ez + .06), (.1, 1.66, ez + .02)], .018, seg=4), MOUTH)
    oral = []
    for k in range(3):
        a = k / 3 * TAU + .5
        pts = [(math.cos(a) * .15, 1.3, math.sin(a) * .15), (math.cos(a) * .2 + .05, 1.0, math.sin(a) * .2), (math.cos(a) * .12 - .05, .75, math.sin(a) * .12), (math.cos(a) * .18, .5, math.sin(a) * .18)]
        o_ = tube('OralArm', pts, [.12, .1, .08, .02], seg=8, flat=.35)
        each_vert(o_, lambda p: (p[0] + .03 * math.sin(p[1] * 25), p[1], p[2]))
        oral.append(M(Vp(o_, lambda p, n: .92), 'c2'))
    J([dome, frill, core] + ey + [mouth] + oral, 'DomeM')
    for i in range(6):
        a = i / 6 * TAU
        pts = [(math.cos(a) * .62, 1.4, math.sin(a) * .62)]
        for k in range(1, 7):
            t = k / 6
            w = .12 * math.sin(t * 7 + i)
            pts.append((math.cos(a) * (.66 + .1 * t) + w * -math.sin(a), 1.4 - t * 1.2, math.sin(a) * (.66 + .1 * t) + w * math.cos(a)))
        tn = tube('Tent', pts, [.1 - .085 * (k / 6) for k in range(7)], seg=6, flat=.35)
        Vp(tn, lambda p, n: .9 - (.18 if (p[1] * 6) % 1 < .3 else 0))
        M(tn, 'c2')
        tn.name = 'Leg%d' % i
        pivot(tn, pts[0])


template('jelly', jelly)


def chest():
    """顏料擬態寶箱：木板箱（板縫、木紋）、鐵箍與鉚釘、金色包角與鎖；箱蓋（Lid）裡藏著眼睛，箱口有牙、舌頭"""
    box = rbox('Box', (0, .55, 0), (2.0, 1.1, 1.4), bevel=.06, seg=2)
    dice(box, 3)

    def plank(p, n):
        v = .84 + .1 * n[1] + .06 * math.sin(p[0] * 9 + nz(p, 3) * 3) * .6
        if abs(n[2]) > .5 and (p[1] * 3.6) % 1 < .07:
            v -= .3
        if abs(n[0]) > .5 and (p[1] * 3.6) % 1 < .07:
            v -= .3
        return v - .1 * sstep(.2, 0, p[1])
    Vp(box, plank)
    M(box, 'c1')
    parts = [box]
    for x in (-.62, .62):
        bd = rbox('Band', (x, .56, 0), (.16, 1.14, 1.44), bevel=.03, seg=1)
        Cg(bd, IRON, IRON_L)
        parts.append(bd)
        for y in (.2, .55, .9):
            for z in (.73, -.73):
                parts.append(Cg(ellipsoid('Rivet', (x, y, z), (.03, .03, .02), seg=5, rings=3), IRON, IRON_L))
    for x in (-1, 1):
        for z in (-1, 1):
            cb = rbox('Corner', (x * .96, .1, z * .66), (.14, .22, .14), bevel=.03, seg=1)
            parts.append(M(Vp(cb, lambda p, n: .8 + .2 * n[1]), 'c2'))
    lock = rbox('Lock', (0, 1.0, .73), (.34, .4, .1), bevel=.04, seg=2)
    Vp(lock, lambda p, n: .78 + .2 * n[1] + .1 * n[2])
    parts.append(M(lock, 'c2'))
    parts.append(C(ellipsoid('Keyhole', (0, .98, .79), (.04, .07, .02), seg=6, rings=4), 0x1a1210))
    J(parts, 'BoxM')
    lid = tube('LidM', [(-1.0, 1.1, 0), (1.0, 1.1, 0)], .7, seg=20, up=(0, 0, -1))
    each_vert(lid, lambda p: (p[0], 1.1 + max(p[1] - 1.1, 0) * .85, p[2]))
    dice(lid, 1)

    def lidv(p, n):
        a = math.atan2(p[1] - 1.1, p[2])
        v = .82 + .12 * n[1] + .05 * math.sin(p[0] * 9 + nz(p, 3) * 3)
        if (a * 4.5 / math.pi) % 1 < .08:
            v -= .28
        return v
    Vp(lid, lidv)
    M(lid, 'c1')
    lp = [lid]
    for x in (-.62, .62):
        bnd = tube('LidBand', [(x, 1.1, .72), (x, 1.1 + .6, .38), (x, 1.1 + .72 * .85, 0), (x, 1.1 + .6, -.38), (x, 1.1, -.72)], .03, seg=4, flat=3.0)
        Cg(bnd, IRON, IRON_L)
        lp.append(bnd)
    for x in (-.97, .97):
        rim = tube('LidTrim', [(x, 1.1, .72), (x, 1.1 + .6, .38), (x, 1.1 + .72 * .85, 0), (x, 1.1 + .6, -.38), (x, 1.1, -.72)], .045, seg=5)
        lp.append(M(Vp(rim, lambda p, n: .8 + .15 * n[1]), 'c2'))
    lm = J(lp, 'LidMesh')
    ey = eye_pair((0, 1.52, .62), .38, .14, conv=.2, tilt=24, off=.1, lidslot='c1', iris=0xd8a030, pa=18, ia=36)
    xe = group('x_eyes', (0, 1.1, -.7), [J(ey, 'MimicEyes')])
    group('Lid', (0, 1.1, -.7), [lm, xe])
    teeth = []
    for k in range(9):
        x = -.84 + k * .21
        teeth.append(Cg(cone('T', (x, 1.08, .64), (x + .02, .88 + .05 * (k % 2), .68), .09 - .02 * (k % 2), seg=4), BONE_D, 0xffffff))
    for s in (-1, 1):
        for k in range(3):
            z = .35 - k * .35
            teeth.append(Cg(cone('T', (s * .92, 1.08, z), (s * .95, .92, z), .07, seg=4), BONE_D, 0xffffff))
    group('Teeth', (0, 0, 0), [J(teeth, 'TeethM')])
    tg = mball('TongueM', [Em((0, 1.08, .35), (.42, .09, .45)), Km((0, 1.08, .6), (.1, .85, 1.05), .15), Bm((.12, .7, 1.1), .14)], slot='fixed', target=500)
    C(tg, lambda p, n: mix(0x9a3a4a, 0xd87a8a, .5 + .4 * n[1]) if abs(p[0] - .02) > .025 else hexrgb(0x7a2a38))
    group('Tongue', (0, 0, 0), [tg])


template('chest', chest)


def snail():
    """晶殼蝸牛：真正螺旋的殼（生長紋、螺帶）、殼上長出發光水晶、黏滑的腹足、眼柄與觸角"""
    foot = mball('Foot', [Em((0, .26, -.15), (.5, .24, 1.05)), Em((0, .1, 0), (.62, .1, 1.15)), Km((0, .35, .55), (0, .8, 1.05), .27), Bm((0, .9, 1.12), .26)], slot='c1', target=1200)
    Vp(foot, lambda p, n: .82 + .12 * n[1] + .05 * fb(p, 5) + .1 * sstep(.15, .05, p[1]) - (.1 if math.sin(p[2] * 18 + p[0] * 4) > .7 and n[1] > .2 else 0))
    parts = [foot]
    for s in (-1, 1):
        st = M(Vp(tube('Stalk', [(s * .1, 1.05, 1.05), (s * .16, 1.3, 1.1), (s * .22, 1.48, 1.08)], [.06, .045, .04], seg=6), lambda p, n: .85), 'c1')
        parts.append(st)
        parts += eyeball((s * .23, 1.54, 1.1), .09, (s * .4, .2, 1), iris=0x2a2230, pa=26, ia=42)
        parts.append(eyelid((s * .23, 1.54, 1.1), .09, s, tilt=20, off=.15, fwd=(s * .4, .2, 1)))
        parts.append(M(Vp(tube('Feeler', [(s * .12, .82, 1.3), (s * .2, .7, 1.45), (s * .24, .62, 1.52)], [.05, .035, .02], seg=5), lambda p, n: .85), 'c1'))
    parts.append(C(tube('MouthSn', [(-.08, .74, 1.36), (0, .72, 1.38), (.08, .74, 1.36)], .014, seg=4), MOUTH))
    J(parts, 'FootM')
    # 螺旋殼：在 yz 平面（側面）捲起，往 +x 偏一點成螺塔
    pts, rad = [], []
    cy, cz = 1.2, -.35
    for k in range(34):
        t = k / 33 * 2.4 * TAU
        r = .8 * math.exp(-.2 * t)
        pts.append((.04 * t, cy + math.cos(t + .3) * r, cz - math.sin(t + .3) * r))
        rad.append(.52 * math.exp(-.2 * t) + .03)
    shell = tube('ShellM', pts, rad, seg=14, flat=1.35, up=(1, 0, 0))
    paint_idx(shell, lambda i, p: (lambda k: (k, k, k))(.72 + .22 * (math.sin((i % 14) / 14 * TAU) * .5 + .5) - (.14 if (i // 14) % 3 == 0 else 0)))
    M(shell, 'c2')
    cr = []
    for (x, y, z, h, r, tx, tz) in [(0, 2.02, -.35, .6, .12, 0, 0), (.22, 1.95, -.15, .45, .09, 20, 25), (-.22, 1.93, -.5, .5, .1, -15, -20), (.1, 1.92, -.65, .38, .08, 10, -30), (-.12, 1.98, -.08, .32, .07, -20, 30)]:
        c_ = lathe('Crystal', [(r * .7, -.1), (r, 0), (r, h * .65), (.001, h)], seg=6)
        place(c_, (x, y, z), (tz, 0, tx))
        cr.append(M(Vp(c_, lambda p, n: .75 + .25 * sstep(-.2, .8, n[1])), 'glow'))
    J([shell], 'ShellMesh')
    J(cr, 'Crystals')


template('snail', snail)

# ── 預覽：排成一列 ──
if RENDER:
    for i, r in enumerate(ROOTS):
        r.location = V((i % 8) * 4.2 - 15, 0, (i // 8) * -5)
    preview(os.path.join(PREV, 'enemies.png'), target=(0, 1.0, -4), dist=26, yaw=0, pitch=18, res=(1600, 900))
for r in ROOTS:
    r.location = V(0, 0, 0)
export(OUT, ROOTS)
