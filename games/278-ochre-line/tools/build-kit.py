# 作品 278 赭線：城鎮組件 kit.glb 產生器（全部程式建模，不用下載模型）
#
# 用法（在任何目錄都可以跑）：
#   blender --background --python tools/build-kit.py -- [旗標]
#     （無旗標）    建全部組件 → ../../assets/278/models/kit.glb + dist/kit-meta.json
#     --tex         另外畫葉片圖集 ../../assets/278/tex/palm_a.webp（要 cwebp）
#     --sheet       匯出後算繪 dist/kit-sheet.png、dist/kit-detail.png
#     --only a,b    只建這幾件，輸出到 dist/kit-only.glb（迭代用，不動正式檔）
#     --tile N      contact sheet 單格邊長（預設 420）
#
# 座標：這裡在 Blender 空間建模，x 右、z 上、**-y 朝外**。glTF 匯出 (x,y,z)→(x,z,-y)，
# 所以 -y 就是 glb 的 +Z。節點一律留在原點、沒有 TRS，thin instance 矩陣可以直接乘。
# 原點：底部中心（AABB 的 x、z 置中，y 最低點 = 0）。牆類例外，見 Kit.done(anchor='grid')。
#
# 導角用 bmesh.ops.bevel 逐零件做，不用 boolean：開口牆是格子刪洞再把邊界頂點吸到曲線上。
# 不規則來自缺角（真的 bisect）、板條厚度與偏轉、石件低頻雜訊。
# 貼圖不進 glb。材質名 = 貼圖 id，清單見 MATS，kit-meta.json 也有一份。

import bpy, bmesh, math, os, random, sys, json, struct, subprocess, zlib
from mathutils import Vector, Matrix, Euler, noise

HERE = os.path.dirname(os.path.abspath(__file__))
PROJ = os.path.dirname(HERE)
ROOT = os.path.dirname(os.path.dirname(PROJ))
GLB = os.path.join(ROOT, 'assets/278/models/kit.glb')
TEX = os.path.join(ROOT, 'assets/278/tex')
DIST = os.path.join(PROJ, 'dist')
META = os.path.join(DIST, 'kit-meta.json')

ARGV = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
def flag(n): return n in ARGV
def opt(n, d=None): return ARGV[ARGV.index(n) + 1] if n in ARGV else d
ONLY = set(opt('--only').split(',')) if opt('--only') else None

TRI_MIN, TRI_MAX = 200, 3000
SIZE_MAX = 6 * 1024 * 1024

# 材質名 = 貼圖 id（assets/278/tex/<id>_{a,n,orm}.webp，見 credits/textures.md）。
# 同一張貼圖要兩種顏色時寫 <id>@<變體>，前端取 @ 前面當貼圖，albedo 再乘 tint（線性，存在 baseColorFactor）。
# m：貼圖對應的真實公尺數，網格 UV 依此縮放，所以 UV 1.0 = 貼圖重複一次。
# twoSided：布與葉片是單層面。alpha：palm_a 的 alpha 測試。glass 沒有貼圖，直接用因子。
MATS = {
    'sandstone':      dict(m=3,    r=.92, k=0),
    'ashlar':         dict(m=4,    r=.88, k=0),   # 貼圖實際 2 m；UV 放大一倍，一塊幾何石頭才不會包進好幾顆貼圖石頭的假縫
    'flag':           dict(m=2,    r=.85, k=0),
    'wood':           dict(m=1,    r=.82, k=0),
    'woodpaint':      dict(m=1,    r=.72, k=0),
    'metal':          dict(m=1.25, r=.78, k=.6),
    'metal@black':    dict(m=1.25, r=.62, k=.8, tint=(.2, .19, .18)),
    'whitewash':      dict(m=1,    r=.6,  k=0, tint=(.82, .8, .75)),    # 冷氣外殼：舊白漆，用實際尺寸，剝落才夠細
    'military':       dict(m=1,    r=.55, k=.4),
    'sand':           dict(m=1.8,  r=1.,  k=0),
    'sand@terracotta':dict(m=1.8,  r=.8,  k=0, tint=(1., .37, .26)),   # 沒有陶土貼圖，用砂土染色；baseColorFactor 不能超過 1
    'sand@bark':      dict(m=1.8,  r=.95, k=0, tint=(.42, .34, .30)),
    'canvas':         dict(m=.27,  r=.9,  k=0, twoSided=True),
    'canvas@red':     dict(m=.27,  r=.9,  k=0, twoSided=True, tint=(.72, .16, .15)),
    'canvas@burlap':  dict(m=.27,  r=.95, k=0, tint=(.78, .72, .72)),   # 沙包不需要雙面
    'glass':          dict(m=1,    r=.15, k=0, notex=True, c=(.03, .035, .035)),
    'ashlar@mono':    dict(m=12,   r=.88, k=0),   # 一體雕成的石面：UV 放大六倍，整面只看到一兩顆貼圖石頭
    'palm':           dict(m=1,    r=.75, k=0, twoSided=True, alpha=True),
}

# 木板貼圖的板縫位置（量 wood_a／woodpaint_a 的亮度剖面）。單片木板的 UV 落在兩縫之間，
# 一塊幾何板只看到一條貼圖板，縫才不會疊在板面中間。wood 板條走 V，woodpaint 走 U。
SEAMS = {'wood': (0, .121, .24, .35, .457, .559, .662, .775, .883, 1.),
         'woodpaint': (.059, .223, .387, .551, .719, .889, 1.059)}

# palm_a.webp 圖集分區（Blender UV：左下原點）。u0,v0,u1,v1
FROND_A = (0, .667, 1, 1)
FROND_B = (0, .334, 1, .665)
TWIG_A = (0, 0, .33, .33)
TWIG_B = (.335, 0, .665, .33)
GRASS = (.67, 0, 1, .33)

_mat_cache = {}
def get_mat(name):
    if name in _mat_cache: return _mat_cache[name]
    d = MATS[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    p = next((n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED'), None)
    if p is None:
        p = nt.nodes.new('ShaderNodeBsdfPrincipled')
        o = next((n for n in nt.nodes if n.type == 'OUTPUT_MATERIAL'), None) or nt.nodes.new('ShaderNodeOutputMaterial')
        nt.links.new(p.outputs[0], o.inputs[0])
    p.inputs['Base Color'].default_value = (*(d.get('c') or d.get('tint') or (1, 1, 1)), 1)
    p.inputs['Roughness'].default_value = d['r']
    p.inputs['Metallic'].default_value = d['k']
    m.use_backface_culling = not d.get('twoSided')
    _mat_cache[name] = m
    return m

# ---------------- 幾何基元（一律回傳 bmesh，z 上、-y 朝外） ----------------

def B(w, d, h):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1)
    for v in bm.verts:
        v.co.x *= w; v.co.y *= d; v.co.z *= h
    return bm

def prism(poly, L, axis='y'):
    """多邊形沿 axis 擠出、對中。poly：axis=y 時 (x,z)；axis=x 時 (y,z)；axis=z 時 (x,y)。"""
    def P(a, b, t):
        if axis == 'y': return (a, t, b)
        if axis == 'x': return (t, a, b)
        return (a, b, t)
    bm = bmesh.new()
    lo = [bm.verts.new(P(a, b, -L / 2)) for a, b in poly]
    hi = [bm.verts.new(P(a, b, L / 2)) for a, b in poly]
    n = len(poly)
    bm.faces.new(lo)
    bm.faces.new(list(reversed(hi)))
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((lo[i], lo[j], hi[j], hi[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm

def lathe(prof, seg=24, wob=None):
    """(r,z) 輪廓繞 z 旋轉。r=0 的端點收成一點。wob(a,z)→徑向倍率。"""
    bm = bmesh.new()
    rings = []
    for r, z in prof:
        if r <= 1e-6:
            rings.append(bm.verts.new((0, 0, z)))
            continue
        ring = []
        for i in range(seg):
            a = i / seg * math.tau
            k = wob(a, z) if wob else 1
            ring.append(bm.verts.new((r * k * math.cos(a), r * k * math.sin(a), z)))
        rings.append(ring)
    for p in range(len(rings) - 1):
        a, b = rings[p], rings[p + 1]
        for i in range(seg):
            j = (i + 1) % seg
            if isinstance(a, list) and isinstance(b, list):
                bm.faces.new((a[i], a[j], b[j], b[i]))
            elif isinstance(a, list):
                bm.faces.new((a[i], a[j], b))
            elif isinstance(b, list):
                bm.faces.new((a, b[j], b[i]))
    if isinstance(rings[0], list): bm.faces.new(rings[0])
    if isinstance(rings[-1], list): bm.faces.new(list(reversed(rings[-1])))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm

def tube(pts, r=.02, sides=6, cap=True):
    """沿折線掃圓管。r 可為 t→半徑的函式。"""
    pts = [Vector(p) for p in pts]
    bm = bmesh.new()
    n = len(pts)
    tan = []
    for i in range(n):
        a = pts[max(i - 1, 0)]; b = pts[min(i + 1, n - 1)]
        tan.append((b - a).normalized())
    ref = Vector((0, 0, 1)) if abs(tan[0].z) < .9 else Vector((1, 0, 0))
    u = tan[0].cross(ref).normalized()
    rings = []
    for i in range(n):
        u = (u - tan[i] * u.dot(tan[i])).normalized()
        w = tan[i].cross(u)
        rr = r(i / (n - 1)) if callable(r) else r
        rings.append([bm.verts.new(pts[i] + (u * math.cos(k / sides * math.tau) + w * math.sin(k / sides * math.tau)) * rr) for k in range(sides)])
    for i in range(n - 1):
        for k in range(sides):
            m = (k + 1) % sides
            bm.faces.new((rings[i][k], rings[i][m], rings[i + 1][m], rings[i + 1][k]))
    if cap:
        bm.faces.new(rings[0]); bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm

def sheet(fn, nu, nv, uv=None):
    """參數面。fn(s,t)→Vector。uv=(u0,v0,u1,v1) 時 UV 依 s,t 對應到圖集矩形。"""
    bm = bmesh.new()
    lay = bm.loops.layers.uv.new('UVMap')
    g = [[bm.verts.new(fn(i / nu, j / nv)) for j in range(nv + 1)] for i in range(nu + 1)]
    for i in range(nu):
        for j in range(nv):
            f = bm.faces.new((g[i][j], g[i + 1][j], g[i + 1][j + 1], g[i][j + 1]))
            for l, (a, b) in zip(f.loops, ((i, j), (i + 1, j), (i + 1, j + 1), (i, j + 1))):
                s, t = a / nu, b / nv
                if uv: l[lay].uv = (uv[0] + s * (uv[2] - uv[0]), uv[1] + t * (uv[3] - uv[1]))
                else:
                    c = g[a][b].co
                    l[lay].uv = (c.x, c.z)
    return bm

def wedge(r0, r1, a0, a1, z0, z1, seg=2):
    """環狀石塊。"""
    poly = []
    for i in range(seg + 1):
        a = a0 + (a1 - a0) * i / seg
        poly.append((r1 * math.cos(a), r1 * math.sin(a)))
    for i in range(seg, -1, -1):
        a = a0 + (a1 - a0) * i / seg
        poly.append((r0 * math.cos(a), r0 * math.sin(a)))
    bm = prism(poly, z1 - z0, 'z')
    bmesh.ops.translate(bm, vec=(0, 0, (z0 + z1) / 2), verts=bm.verts)
    return bm

def rounded(w, d, h, cuts=2, p=4.):
    """超橢球：布袋、枕狀石。"""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=2)
    bmesh.ops.subdivide_edges(bm, edges=bm.edges, cuts=cuts, use_grid_fill=True)
    for v in bm.verts:
        c = v.co
        l = (abs(c.x) ** p + abs(c.y) ** p + abs(c.z) ** p) ** (1 / p)
        v.co = Vector((c.x / l * w / 2, c.y / l * d / 2, c.z / l * h / 2))
    return bm

def rock(r, rng, sub=1, chops=5, sq=(1, 1, .7)):
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=sub, radius=r)
    o = Vector((rng.random() * 50, rng.random() * 50, rng.random() * 50))
    for v in bm.verts:
        v.co *= 1 + .3 * noise.noise(v.co / r * 1.2 + o)
        v.co = Vector((v.co.x * sq[0], v.co.y * sq[1], v.co.z * sq[2]))
    for _ in range(chops):
        chop(bm, rng, rng.uniform(.12, .32) * r)
    return bm

def chop(bm, rng, depth, dirn=None, co=None):
    """以斜面切掉 bm 朝 dirn（預設隨機）那一端 depth 深，切口補面。真的缺角，不是貼圖。
    co 有給時平面改過這一點（連續切同一個缺口時，才不會每刀都從新的最高點再往內吃）。"""
    d = (dirn or Vector((rng.gauss(0, 1), rng.gauss(0, 1), rng.gauss(0, 1)))).normalized()
    if co is None:
        top = max(v.co.dot(d) for v in bm.verts)
        co = d * (top - depth)
    geom = bm.verts[:] + bm.edges[:] + bm.faces[:]
    res = bmesh.ops.bisect_plane(bm, geom=geom, dist=1e-5, plane_co=co, plane_no=d, clear_outer=True, clear_inner=False)
    cut = [e for e in res['geom_cut'] if isinstance(e, bmesh.types.BMEdge) and e.is_valid]
    if cut:
        bmesh.ops.holes_fill(bm, edges=cut, sides=0)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)

def corner_dir(sx, sy, sz, rng):
    return Vector((sx + rng.uniform(-.35, .35), sy + rng.uniform(-.35, .35), sz + rng.uniform(-.35, .35)))

def bm_uv_box(bm, grain, rng, s=1., strip=None):
    """方塊投影。grain = 0/1/2 時木紋軸對到 V。strip='wood'/'woodpaint' 時整條板塞進貼圖的一條板。"""
    uv = bm.loops.layers.uv.get('UVMap') or bm.loops.layers.uv.new('UVMap')
    bm.normal_update()
    ou, ov = rng.random(), rng.random()
    if strip:
        se = SEAMS[strip]
        k = rng.randrange(len(se) - 1)
        c0, c1 = se[k] + (se[k + 1] - se[k]) * .14, se[k + 1] - (se[k + 1] - se[k]) * .14
    lo = [min(v.co[i] for v in bm.verts) for i in range(3)]
    hi = [max(v.co[i] for v in bm.verts) for i in range(3)]
    for f in bm.faces:
        n = f.normal
        a = max(range(3), key=lambda i: abs(n[i]))
        ax = [i for i in range(3) if i != a]
        if grain in ax: v = grain; u = ax[0] if ax[1] == grain else ax[1]
        elif 2 in ax: v = 2; u = ax[0]
        else: u, v = ax
        for l in f.loops:
            co = l.vert.co
            if strip and grain in ax:
                q = (co[u] - lo[u]) / max(hi[u] - lo[u], 1e-6)
                across = c0 + (c1 - c0) * q
                along = co[v] * s + ov
                l[uv].uv = (across, along) if strip == 'wood' else (along, across)
            else:
                l[uv].uv = (co[u] * s + ou, co[v] * s + ov)

def wobble(bm, amp, scale, off, pin=None):
    for v in bm.verts:
        k = pin(v.co) if pin else 1
        if k <= 0: continue
        v.co += noise.noise_vector(v.co / scale + off) * amp * k

def do_bevel(bm, w, seg, ang, skip=None):
    edges = []
    for e in bm.edges:
        if len(e.link_faces) != 2: continue
        if e.calc_face_angle(0) < ang: continue
        if skip and skip(e): continue
        edges.append(e)
    if not edges: return
    bmesh.ops.bevel(bm, geom=edges + list({v for e in edges for v in e.verts}), offset=w, offset_type='OFFSET',
                    segments=seg, profile=.5, affect='EDGES', clamp_overlap=True)

def Rz(a): return Matrix.Rotation(a, 4, 'Z')
def T(x=0, y=0, z=0): return Matrix.Translation((x, y, z))

def smooth(pts, sub=4):
    """Catmull-Rom 細分折線，支架、提把才是彎的不是折的。"""
    P = [Vector(p) for p in pts]
    out = []
    for i in range(len(P) - 1):
        a, b, c, d = P[max(i - 1, 0)], P[i], P[i + 1], P[min(i + 2, len(P) - 1)]
        for k in range(sub):
            t = k / sub
            out.append(((b * 2) + (c - a) * t + (a * 2 - b * 5 + c * 4 - d) * t * t + (b * 3 - a - c * 3 + d) * t ** 3) * .5)
    out.append(P[-1])
    return out

# ---------------- 組件 ----------------

KITS = {}

class Kit:
    def __init__(s, id, seed=None):
        s.id = id
        s.r = random.Random(zlib.crc32(id.encode()) if seed is None else seed)
        s.bm = bmesh.new()
        s.bm.loops.layers.uv.new('UVMap')
        s.mats = []
        s.foliage = None
        s.up = .35   # 葉片法線往上偏的量：越大越不會整片朝下變黑

    def add(s, bm, mat, at=(0, 0, 0), rot=(0, 0, 0), M=None, bevel=0, seg=1, ang=.45, grain=None,
            wob=0, wobs=.5, skip=None, pin=None, uv=True, strip=None):
        """幾何進組件。順序固定：UV → 導角 → 變換 → 雜訊，缺角要在呼叫前做。"""
        if mat not in s.mats: s.mats.append(mat)
        mi = s.mats.index(mat)
        k = 1 / MATS[mat]['m']
        if uv: bm_uv_box(bm, grain, s.r, k, strip)
        elif mat != 'palm':  # sheet() 等自帶公尺單位 UV 的零件
            lay = bm.loops.layers.uv.get('UVMap')
            for f in bm.faces:
                for l in f.loops: l[lay].uv *= k
        if bevel: do_bevel(bm, bevel, seg, ang, skip)
        m = M if M is not None else T(*at) @ Euler(rot).to_matrix().to_4x4()
        bmesh.ops.transform(bm, matrix=m, verts=bm.verts)
        if wob: wobble(bm, wob, wobs, Vector((s.r.random() * 40, s.r.random() * 40, s.r.random() * 40)), pin)
        for f in bm.faces: f.material_index = mi
        tmp = bpy.data.meshes.new('t')
        bm.to_mesh(tmp)
        s.bm.from_mesh(tmp)
        bpy.data.meshes.remove(tmp)
        bm.free()

    def stone(s, w, d, h, mat='ashlar', at=(0, 0, 0), rot=(0, 0, 0), M=None, bevel=.012, chips=1, chipd=.03, wob=.006, wobs=.35, seg=1, faces=None):
        """切石：隨機缺幾個角、導角、低頻雜訊。"""
        b = B(w, d, h)
        for _ in range(chips):
            c = s.r.choice([(1, 1, 1), (-1, 1, 1), (1, -1, 1), (-1, -1, 1), (1, -1, -1), (-1, -1, -1)])
            chop(b, s.r, s.r.uniform(.5, 1.3) * chipd, corner_dir(c[0] * w, c[1] * d, c[2] * h, s.r))
        s.add(b, mat, at=at, rot=rot, M=M, bevel=bevel, seg=seg, wob=wob, wobs=wobs)

    def plank(s, w, d, h, mat='wood', at=(0, 0, 0), rot=(0, 0, 0), M=None, grain=2, bevel=.004, jit=.012, ends=True):
        """板條：厚度、偏轉、端面都帶誤差。grain 軸走長邊（0=x 1=y 2=z）。"""
        r = s.r
        b = B(w, d, h)
        for v in b.verts:
            k = 1 if v.co.y < 0 else .3
            v.co.y += r.uniform(-jit, jit) * .18 * k
        if ends:
            sz = (w, d, h)
            for side in (-1, 1):
                if r.random() < .4:
                    dv = [0, 0, 0]
                    dv[grain] = side
                    dv[(grain + 1) % 3] = r.uniform(-.5, .5)
                    chop(b, r, r.uniform(.004, .02), Vector(dv))
        rr = (r.uniform(-jit, jit) * .25,) * 3
        m = M if M is not None else T(*at) @ Euler(rot).to_matrix().to_4x4()
        s.add(b, mat, M=m @ Euler((0, rr[0], 0)).to_matrix().to_4x4(), bevel=bevel, grain=grain,
              strip=mat if mat in SEAMS else None)

    def nail(s, at, M=None, n=4):
        b = B(.013, .004, .013)
        for v in b.verts:
            if v.co.y < 0: v.co.x *= .6; v.co.z *= .6
        s.add(b, 'metal@black', M=(M or Matrix()) @ T(*at), uv=True)

    def done(s, anchor='center', clamp=None):
        """clamp=((x0,x1),(y0,y1),(z0,z1))：雜訊頂點壓回界內，網格件的外廓才會剛好是模組尺寸。"""
        bm = s.bm
        if clamp:
            for v in bm.verts:
                for i, (a, b) in enumerate(clamp):
                    v.co[i] = max(a, min(b, v.co[i]))
        bmesh.ops.triangulate(bm, faces=bm.faces, quad_method='BEAUTY', ngon_method='BEAUTY')
        bmesh.ops.dissolve_degenerate(bm, dist=1e-5, edges=bm.edges)
        bmesh.ops.triangulate(bm, faces=[f for f in bm.faces if len(f.verts) > 3], quad_method='BEAUTY', ngon_method='BEAUTY')
        bm.normal_update()
        xs = [v.co.x for v in bm.verts]; ys = [v.co.y for v in bm.verts]; zs = [v.co.z for v in bm.verts]
        if anchor == 'center':
            d = Vector((-(min(xs) + max(xs)) / 2, -(min(ys) + max(ys)) / 2, -min(zs)))
        else:  # 網格件：作者座標就是對位座標，不動
            d = Vector((0, 0, 0))
        bmesh.ops.translate(bm, vec=d, verts=bm.verts)
        sharp = math.radians(58)
        for f in bm.faces: f.smooth = True
        hard = bm.edges.layers.int.get('hard')
        for e in bm.edges:
            e.smooth = not (len(e.link_faces) == 2 and e.calc_face_angle(0) > sharp or (hard and e[hard]))
        if hard: bm.edges.layers.int.remove(hard)
        me = bpy.data.meshes.new(s.id)
        bm.to_mesh(me)
        bm.free()
        for m in s.mats: me.materials.append(get_mat(m))
        ob = bpy.data.objects.new(s.id, me)
        bpy.context.scene.collection.objects.link(ob)
        wn = ob.modifiers.new('wn', 'WEIGHTED_NORMAL')
        wn.mode = 'FACE_AREA'; wn.weight = 50; wn.keep_sharp = True
        dg = bpy.context.evaluated_depsgraph_get()
        dg.update()
        m2 = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
        ob.modifiers.clear()
        ob.data = m2
        bpy.data.meshes.remove(me)
        m2.name = s.id
        if 'palm' in s.mats: fix_foliage_normals(ob, s.mats.index('palm'), s.foliage, s.up)
        KITS[s.id] = ob
        tris = len(m2.polygons)
        print(f'  {s.id:20s} tris={tris:5d} mats={s.mats}')
        return ob

def fix_foliage_normals(ob, mi, center, up):
    """葉片的法線改成從樹冠中心往外，打光才像一團葉子而不是一堆紙片。"""
    me = ob.data
    c = Vector(center) + Vector((0, 0, 0)) if center else None
    if c is None:
        bb = [Vector(v) for v in ob.bound_box]
        c = sum(bb, Vector()) / 8
    nl = [Vector(n.vector) for n in me.corner_normals]
    for p in me.polygons:
        if p.material_index != mi: continue
        for li in p.loop_indices:
            co = me.vertices[me.loops[li].vertex_index].co
            n = (co - c)
            n.z = n.z + n.length * up
            nl[li] = n.normalized()
    me.normals_split_custom_set(nl)

def COMP(fn):
    KITS.setdefault('__list', []).append(fn)
    return fn

# ---------------- 牆體 ----------------

WALL_T = .35  # 牆身厚，踢腳與貼石才到 0.40
WALL_BOX = ((-2, 2), (-.2, .2), (0, 4))
def wall_body(K, nx=16, nz=16, hole=None, snap=None, amp=.012, W=4., H=4., mat='sandstone'):
    """格子牆：刪掉洞內格子，再把洞緣頂點吸到輪廓上。不用 boolean，拓撲乾淨。"""
    off = Vector((K.r.random() * 30, K.r.random() * 30, 0))
    def disp(x, z, side):
        e = min(x + W / 2, W / 2 - x, z, H - z)
        p = max(0., min(1., e / .3))
        n = noise.noise(Vector((x * .9, z * .9, side * 7)) + off) + .5 * noise.noise(Vector((x * 2.1, z * 2.1, side * 7 + 3)) + off)
        return p * p * n * amp
    xs = [-W / 2 + W * i / nx for i in range(nx + 1)]
    zs = [H * j / nz for j in range(nz + 1)]
    kept = [[not (hole and hole((xs[i] + xs[i + 1]) / 2, (zs[j] + zs[j + 1]) / 2)) for j in range(nz)] for i in range(nx)]
    def k(i, j): return 0 <= i < nx and 0 <= j < nz and kept[i][j]
    bm = bmesh.new()
    F, Bk = {}, {}
    def v(i, j):
        if (i, j) not in F:
            x, z = xs[i], zs[j]
            cells = [k(i - a, j - b) for a in (0, 1) for b in (0, 1)]
            inner_edge = any(not c for c in cells) and 0 < i < nx and 0 < j < nz or (hole and j == 0 and not all(k(i - a, 0) or i - a < 0 or i - a >= nx for a in (0, 1)))
            if snap and inner_edge: x, z = snap(x, z)
            F[(i, j)] = bm.verts.new((x, -WALL_T / 2 - disp(x, z, 0), z))
            Bk[(i, j)] = bm.verts.new((x, WALL_T / 2 + disp(x, z, 1), z))
        return F[(i, j)], Bk[(i, j)]
    for i in range(nx):
        for j in range(nz):
            if not kept[i][j]: continue
            a, b, c, d = v(i, j), v(i + 1, j), v(i + 1, j + 1), v(i, j + 1)
            bm.faces.new((a[0], b[0], c[0], d[0]))
            bm.faces.new((d[1], c[1], b[1], a[1]))
            if not k(i, j - 1): bm.faces.new((b[0], a[0], a[1], b[1]))
            if not k(i, j + 1): bm.faces.new((d[0], c[0], c[1], d[1]))
            if not k(i - 1, j): bm.faces.new((a[0], d[0], d[1], a[1]))
            if not k(i + 1, j): bm.faces.new((c[0], b[0], b[1], c[1]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    K.add(bm, mat)

def skirt(K, x0, x1, side, h=.36, W=4.):
    """踢腳石帶。兩端切齊 x0,x1，相鄰模組接起來只多一條縫。"""
    x = x0
    y = (WALL_T / 2 + .0045) * side
    while x < x1 - .05:
        w = K.r.uniform(.55, 1.15)
        if x + w > x1 - .3: w = x1 - x
        hh = h + K.r.uniform(-.03, .03)
        K.stone(w - .008, .035, hh, at=(x + w / 2, y, hh / 2), bevel=.01, chips=1, chipd=.02, wob=.003)
        x += w

def spall_patch(K, cx, cz, n=8):
    """灰泥剝落露出的砌石（key.jpg 左牆）。凸出 1.5–2.5 cm，幾何上真的有陰影邊。"""
    r = K.r
    rows = [(cz + i * .24, r.uniform(-.1, .1)) for i in range(3)]
    placed = 0
    for i, (z, ox) in enumerate(rows):
        x = cx - .55 + ox + i * .12
        for j in range(3 if i < 2 else 2):
            w = r.uniform(.3, .48); h = r.uniform(.19, .24)
            pro = r.uniform(.012, .022)
            K.stone(w, .04, h, at=(x + w / 2, -WALL_T / 2 - pro + .02, z), bevel=.012, chips=1, chipd=.022, wob=.004, wobs=.2)
            x += w + r.uniform(.012, .03)
            placed += 1

def arch_ring(K, R, cz, depth, n, h0=.34, h1=.46, mat='ashlar', y=0, bevel=.012, proud=0):
    """拱石，每塊楔形、長短不一，貫穿牆厚當拱腹。"""
    gap = .006
    for i in range(n):
        a0 = math.pi * i / n + gap / R
        a1 = math.pi * (i + 1) / n - gap / R
        h = K.r.uniform(h0, h1) if i != n // 2 else h1 * 1.12
        ro = R + h
        pts = []
        for t in (0, .5, 1):
            a = a0 + (a1 - a0) * t
            pts.append((R * math.cos(a), cz + R * math.sin(a)))
        out = [(ro * math.cos(a0), cz + ro * math.sin(a0)), (ro * math.cos(a1), cz + ro * math.sin(a1))]
        poly = [pts[2], pts[1], pts[0], out[0], out[1]]
        b = prism(poly, depth + K.r.uniform(-.004, .004) * (proud > 0), 'y')
        K.add(b, mat, at=(0, y, 0), bevel=bevel, wob=.004, wobs=.3)

def jamb(K, x, z0, z1, depth, side, y=0, wide=(.3, .46), mat='ashlar', flush=None):
    """拱腳／門框的砌塊。內面對齊 x，往外長短交錯。"""
    z = z0
    i = 0
    hs = []
    while z < z1 - .08:
        h = K.r.uniform(.38, .55)
        if z + h > z1 - .22: h = z1 - z
        w = wide[i % 2] + K.r.uniform(-.03, .03)
        cx = x + side * w / 2
        K.stone(w, depth, h - .007, at=(cx, y, z + h / 2), bevel=.012, chips=1, chipd=.025)
        z += h; i += 1

@COMP
def wall_sandstone():
    K = Kit('wall_sandstone')
    wall_body(K, 16, 16)
    skirt(K, -2, 2, -1)
    skirt(K, -2, 2, 1)
    spall_patch(K, -.75, .78)
    K.done('grid', WALL_BOX)

@COMP
def wall_archway():
    K = Kit('wall_archway')
    R, sp = 1.1, 1.9
    Ro = R + .05
    def hole(x, z): return (abs(x) < Ro and z < sp) or (x * x + (z - sp) ** 2 < Ro * Ro)
    def snap(x, z):
        if z <= sp: return (math.copysign(Ro, x), z)
        d = math.hypot(x, z - sp) or 1
        return (x / d * Ro, sp + (z - sp) / d * Ro)
    wall_body(K, 14, 16, hole, snap)
    arch_ring(K, R, sp, .40, 13)
    jamb(K, -R, 0, sp, .40, -1)
    jamb(K, R, 0, sp, .40, 1)
    for side in (-1, 1):
        skirt(K, -2, -R - .46, side)
        skirt(K, R + .46, 2, side)
    K.done('grid', WALL_BOX)

def shutter_panel(K, w, h, slats, at, depth=.045, mat='wood', M=None):
    """百葉單扇：四框＋斜葉片。原點在面板中心，-y 朝外。"""
    r = K.r
    fw = .055
    P = (M or Matrix()) @ T(*at)
    for sx in (-1, 1):
        K.plank(fw, depth, h, mat, M=P @ T(sx * (w - fw) / 2, 0, 0), jit=.004, ends=False)
    for sz in (-1, 1):
        K.plank(w - fw * 2, depth, fw + .01, mat, M=P @ T(0, 0, sz * (h - fw) / 2), grain=0, jit=.004, ends=False)
    inner = h - fw * 2 - .01
    for i in range(slats):
        z = -inner / 2 + inner * (i + .5) / slats
        if r.random() < .05: continue
        K.plank(w - fw * 2 + .006, .05, .008, mat, M=P @ T(0, 0, z) @ Euler((math.radians(52 + r.uniform(-6, 6)), 0, 0)).to_matrix().to_4x4(), grain=0, bevel=.0015, jit=.003, ends=False)

@COMP
def wall_upper_window():
    K = Kit('wall_upper_window')
    W, Hh, z0 = 1.3, 1.7, 1.2
    z1 = z0 + Hh
    def hole(x, z): return abs(x) < W / 2 and z0 < z < z1
    def snap(x, z): return (max(-W / 2, min(W / 2, x)), max(z0, min(z1, z)))
    wall_body(K, 16, 16, hole, snap)
    # 窗台、楣石、側框
    K.stone(W + .44, .34, .1, at=(0, -.05, z0 - .05), bevel=.014, chips=2, chipd=.03, seg=2)
    K.stone(W + .3, .42 - .02, .2, at=(0, 0, z1 + .1), bevel=.014, chips=1)
    for s in (-1, 1):
        K.stone(.13, .39, Hh + .02, at=(s * (W / 2 + .05), 0, (z0 + z1) / 2), bevel=.012, chips=2, chipd=.02)
    # 內凹的百葉（內縮 0.17 m），兩扇關著，一扇葉片略開
    cw = W - .04
    for s in (-1, 1):
        shutter_panel(K, cw / 2 - .006, Hh - .04, 13, (s * cw / 4, .04, (z0 + z1) / 2))
    K.plank(.02, .03, Hh - .02, 'wood', at=(0, .03, (z0 + z1) / 2), jit=.002, ends=False)
    K.add(B(cw, .012, Hh), 'wood', at=(0, .075, (z0 + z1) / 2), grain=2)
    K.done('grid', ((-2, 2), (-.3, .2), (0, 4)))

# ---------------- 地面 ----------------

@COMP
def floor_limestone():
    """4×4×0.3 石板地。

    石板的縫在 flag 貼圖裡，幾何再切一次會和貼圖的縫打架，所以這裡只做週期性的低頻起伏與
    局部沉陷（±6 mm），四邊完全對得起來。真正的導角留給踏階與圍邊。
    """
    K = Kit('floor_limestone')
    r = K.r
    S = 4.; H = .3
    terms = [(r.randint(1, 3), r.randint(1, 3), r.random() * math.tau, r.uniform(.5, 1.)) for _ in range(7)]
    def raw(x, y):
        return sum(a * math.sin(math.tau * (p * x + q * y) / S + f) for p, q, f, a in terms)
    peak = max(abs(raw(i / 40 * S, j / 40 * S)) for i in range(40) for j in range(40))
    def h(x, y): return raw(x, y) / peak * .006
    n = 20
    def top(u, v):
        x, y = (u - .5) * S, (v - .5) * S
        return Vector((x, y, H - .006 + h(x, y)))
    bm = sheet(top, n, n)
    for f in bm.faces: f.normal_flip()
    K.add(bm, 'flag', uv=True)
    def side(a, b):
        return sheet(lambda u, v: a.lerp(b, u) + Vector((0, 0, (H - .006 + h(*a.lerp(b, u).xy) - a.z) * v)), n, 1)
    c = [Vector((-2, -2, 0)), Vector((2, -2, 0)), Vector((2, 2, 0)), Vector((-2, 2, 0))]
    for i in range(4):
        K.add(side(c[i], c[(i + 1) % 4]), 'flag', uv=True)
    K.done('grid')

@COMP
def steps_4m():
    """4 m 寬、4 m 深、上升 1.8 m（對齊手冊的 ΔY 1.8 陽台）。低端朝 +Z，往 -Z 上行。"""
    K = Kit('steps_4m')
    n = 10; rise = .18; tr = .4
    for i in range(n):
        z = rise * (i + 1)
        y = -2 + tr * (i + .5)  # Blender -y 朝外，低端在 -y
        x = -2
        while x < 2 - .02:
            w = K.r.uniform(1.05, 1.7)
            if x + w > 2 - .5: w = 2 - x
            h = z - K.r.uniform(0, .005)
            b = B(w - .006, tr + .02, h)
            # 踏面中段磨損下凹，前緣磨圓
            K.r.random()
            if K.r.random() < .55:
                chop(b, K.r, K.r.uniform(.012, .03), corner_dir(K.r.choice((-1, 1)) * w, -tr, h, K.r))
            K.add(b, 'ashlar', at=(x + w / 2, y + .01, h / 2), bevel=.012, seg=1, wob=.003, wobs=.3)
            x += w
    K.done('grid', ((-2, 2), (-2, 2), (0, 1.8)))

# ---------------- 外牆配件 ----------------

@COMP
def ac_unit():
    K = Kit('ac_unit')
    W, H, D = .86, .6, .32
    K.add(B(W, D, H), 'whitewash', bevel=.006, seg=2, at=(0, 0, H / 2 + .06))
    fr = .205
    fx = -.13; fz = H / 2 + .06; fy = -D / 2
    K.add(lathe([(fr + .018, 0), (fr + .018, .012), (fr + .002, .012), (fr + .002, -.03), (0, -.03)], 28), 'whitewash',
          at=(fx, fy, fz), rot=(math.pi / 2, 0, 0), uv=True)
    K.add(lathe([(0, -.03), (.052, -.03), (.052, -.052), (0, -.052)], 12), 'metal@black', at=(fx, fy + .002, fz), rot=(math.pi / 2, 0, 0))
    for i in range(5):  # 扇葉
        a = i / 5 * math.tau
        p = [(.045, -.008, -.01), (.09, -.03, 0), (.14, -.042, .012), (.178, -.03, .02), (.17, .03, .018), (.12, .028, .006), (.06, .012, -.006)]
        bm = bmesh.new()
        vs = [bm.verts.new(c) for c in p]
        bm.faces.new(vs)
        bmesh.ops.triangulate(bm, faces=bm.faces)
        bm.normal_update()
        ext = bmesh.ops.extrude_face_region(bm, geom=bm.faces[:] + bm.edges[:] + bm.verts[:])
        bmesh.ops.translate(bm, vec=(0, 0, .004), verts=[v for v in ext['geom'] if isinstance(v, bmesh.types.BMVert)])
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        K.add(bm, 'metal@black', M=T(fx, fy + .022, fz) @ Euler((math.pi / 2, 0, 0)).to_matrix().to_4x4() @ Rz(a))
    for ri in (.08, .12, .16, .2):  # 護網同心圓
        pts = [(fx + ri * math.cos(t / 22 * math.tau), fy - .016, fz + ri * math.sin(t / 22 * math.tau)) for t in range(23)]
        K.add(tube(pts, .0028, 4, cap=False), 'metal@black')
    for a in (0, math.pi / 2):
        pts = [(fx - .205 * math.cos(a), fy - .017, fz - .205 * math.sin(a)), (fx + .205 * math.cos(a), fy - .017, fz + .205 * math.sin(a))]
        K.add(tube(pts, .004, 4), 'metal@black')
    for i in range(9):  # 右側出風鰭片
        z = .13 + i * .052
        K.add(B(.19, .012, .007), 'whitewash', at=(.285, -D / 2 - .004, z), rot=(math.radians(25), 0, 0))
    for s in (-1, 1):  # 底腳與 L 支架
        K.add(B(.05, D + .08, .05), 'metal@black', at=(s * .3, .02, .025), bevel=.004)
        K.add(B(.05, .05, .36), 'metal@black', at=(s * .3, D / 2 + .05, .2), bevel=.004)
        K.add(tube([(s * .3, D / 2 + .03, .03), (s * .3, -.02, .3 - .28 + .12)], .009, 5), 'metal@black')
    K.add(tube(smooth([(.38, D / 2 - .02, .2), (.42, D / 2 - .02, .21), (.46, D / 2 + .06, .24), (.46, D / 2 + .08, .52)], 3), .011, 6), 'metal')
    K.add(tube(smooth([(.38, D / 2 - .02, .15), (.44, D / 2, .17), (.48, D / 2 + .06, .2), (.48, D / 2 + .08, .52)], 3), .008, 6), 'metal@black')
    K.done()

@COMP
def roof_trim():
    """赤陶簷口，4 m 寬可接續。U 形底瓦＋圓筒蓋瓦，底下一條石線腳。"""
    K = Kit('roof_trim')
    W = 4.; n = 12; pitch = W / n
    L = .55; drop = L * math.sin(math.radians(20))
    K.add(prism([(0, 0), (.1, 0), (.18, .1), (.18, .2), (0, .2)], W, 'x'), 'ashlar', at=(0, -.12, 0), bevel=.008, wob=.003,
          skip=lambda e: all(abs(abs(v.co.x) - W / 2) < 1e-3 for v in e.verts))
    tilt = math.radians(20)
    def arc(r0, r1, seg, cover):
        pts = []
        for i in range(seg + 1):
            a = math.pi * i / seg
            pts.append((r1 * math.cos(a), r1 * math.sin(a) * (1 if cover else -1)))
        for i in range(seg, -1, -1):
            a = math.pi * i / seg
            pts.append((r0 * math.cos(a), r0 * math.sin(a) * (1 if cover else -1)))
        return pts
    for i in range(n):
        x = -W / 2 + pitch * (i + .5)
        for row in range(2):
            y = -.34 + row * .4
            z = .27 + row * .4 * math.tan(tilt)
            for cover, ox, oz, r0, r1 in ((0, 0, 0, .118, .134), (1, pitch / 2, .03, .082, .098)):
                xx = x + ox
                if xx > W / 2 - .02: xx -= W
                M = T(xx + K.r.uniform(-.004, .004), y + (.0 if row else -.02), z + oz + K.r.uniform(-.005, .005)) @ Euler((tilt + K.r.uniform(-.015, .015), 0, 0)).to_matrix().to_4x4()
                b = prism(arc(r0, r1, 4, cover), L, 'y')
                if K.r.random() < .2:
                    chop(b, K.r, K.r.uniform(.015, .04), Vector((K.r.uniform(-1, 1), -2, K.r.uniform(-.4, .6))))
                K.add(b, 'sand@terracotta', M=M)
    K.done('grid', ((-9, 9), (-9, 9), (0, 9)))

def canvas_awning(K, W, D, H, stripes=0, val=.24, sag=.05, rib=True):
    """帆布棚：背高前低，肋條之間下垂，前緣波浪垂邊。stripes>0 時兩色相間。"""
    r = K.r
    off = r.random() * 30
    bays = 3 if rib else 1
    def roof(x, t):
        z = H - (H - val - .01) * t ** .92
        bay = abs(math.sin((x / W + .5) * bays * math.pi))
        z -= (sag * bay + .012) * math.sin(t * math.pi)
        z += .014 * noise.noise(Vector((x * 1.4, t * 2.6, off))) + .006 * noise.noise(Vector((x * 5, t * 7, off)))
        return z
    def S(s_, t):
        """s_∈[-.5,.5] 寬向，t 0→1 從牆到前緣，1→1.25 是垂邊。"""
        x = s_ * W
        if t <= 1:
            return Vector((x, D * .5 - D * t, roof(x, t)))
        q = (t - 1) / .25
        scal = .5 + .5 * math.cos(x / (W / max(stripes, 8)) * math.tau)
        drop = val - .02 - .09 * (1 - scal)
        return Vector((x, -D * .5 - .02 * q + .012 * noise.noise(Vector((x * 2.3, 1, off))), roof(x, 1) - q * drop))
    n = stripes or 1
    for i in range(n):
        a = -.5 + i / n; b = -.5 + (i + 1) / n
        mat = ('canvas' if i % 2 == 0 else 'canvas@red') if stripes else 'canvas'
        K.add(sheet(lambda u, v: S(a + (b - a) * u, v * 1.25), 6 if stripes else 22, 11), mat, uv=False)
    # 鐵架在帆布底下
    for f in ((-.5, 0, .5) if rib else (-.5, .5)):
        x = f * (W - .06)
        K.add(tube([(x, D * .5 - D * q / 6, roof(x, q / 6) - .03 - .02) for q in range(7)], .012, 6), 'metal@black')
    K.add(tube([(-W / 2, -D * .5 + .03, val - .03), (W / 2, -D * .5 + .03, val - .03)], .015, 6), 'metal@black')
    K.add(tube([(-W / 2, D * .5, H - .03), (W / 2, D * .5, H - .03)], .016, 6), 'metal@black')

@COMP
def awning_striped():
    K = Kit('awning_striped')
    canvas_awning(K, 3.2, 1.7, 1., stripes=8)
    K.done()

@COMP
def awning():
    K = Kit('awning')
    canvas_awning(K, 2.4, 1.3, .8, stripes=0, val=.2, sag=.07, rib=False)
    K.done()

# ---------------- 箱子 ----------------

def crate_face(K, S, side, style, tilt=False):
    """木箱一面。side 0..3 繞 z，局部 -y 朝外。style: 'h' 橫板、'v' 直板。"""
    r = K.r
    M = Rz(side * math.pi / 2) @ T(0, -S / 2, 0)
    fw = .095; ft = .026
    # 內層面板
    n = 6
    pt = .022
    span = S - fw * 2 + .02
    y = ft + pt / 2 - .002
    for i in range(n):
        q = (i + .5) / n - .5
        if style == 'h':
            k = 1 + r.uniform(-.06, .06)
            K.plank(span, pt, span / n * k - .008, 'wood', M=M @ T(0, y, q * span), grain=0, jit=.01)
        else:
            K.plank(span / n * (1 + r.uniform(-.06, .06)) - .008, pt, span, 'wood', M=M @ T(q * span, y, 0), grain=2, jit=.01)
    # 外框
    for sx in (-1, 1):
        K.plank(fw, ft, S, 'wood', M=M @ T(sx * (S - fw) / 2, ft / 2, 0), grain=2, jit=.006, ends=False)
    for sz in (-1, 1):
        K.plank(S - fw * 2, ft, fw, 'wood', M=M @ T(0, ft / 2, sz * (S - fw) / 2), grain=0, jit=.006, ends=False)
    # 斜撐
    a = math.atan2(S - fw * 2, S - fw * 2) * (1 if side % 2 == 0 else -1)
    L = math.hypot(S - fw * 2, S - fw * 2) - fw * .9
    K.plank(L, ft * .9, fw * .82, 'wood', M=M @ T(0, ft * .55, 0) @ Euler((0, a, 0)).to_matrix().to_4x4(), grain=0, jit=.006, ends=False)
    # 釘子
    for sx in (-1, 1):
        for sz in (-1, 1):
            K.nail((sx * (S / 2 - fw / 2), -.001, sz * (S / 2 - fw * 1.0)), M=M)
            K.nail((sx * (S / 2 - fw * 1.5), -.001, sz * (S / 2 - fw / 2)), M=M)

def crate_lid(K, S, n=6):
    r = K.r
    for i in range(n):
        q = (i + .5) / n - .5
        K.plank(S - .14, S / n * (1 + r.uniform(-.04, .04)) - .008, .024, 'wood', at=(0, q * (S - .14), S / 2 - .024), grain=0, jit=.008)
    for sx in (-1, 1):
        K.plank(.095, S, .026, 'wood', at=(sx * (S - .095) / 2, 0, S / 2 - .013), grain=1, jit=.006, ends=False)
    for sy in (-1, 1):
        K.plank(S - .19, .095, .026, 'wood', at=(0, sy * (S - .095) / 2, S / 2 - .013), grain=0, jit=.006, ends=False)

def notch(K, dirn, depth, mat='wood'):
    """整個組件沿斜面切掉一角（框、板、內箱一起斷），再補兩刀讓斷面不平。缺角要真的缺。"""
    r = K.r
    bm = K.bm
    before = set(bm.faces)
    d = Vector(dirn).normalized()
    top = max(v.co.dot(d) for v in bm.verts)
    p = next(v.co.copy() for v in bm.verts if v.co.dot(d) >= top - 1e-6)
    for k in range(3):
        e = d if k == 0 else (d + Vector((r.uniform(-.5, .5), r.uniform(-.5, .5), r.uniform(-.5, .5)))).normalized()
        chop(bm, r, 0, e, co=p - d * depth * (1 if k == 0 else r.uniform(1.1, 1.35)))
    mi = K.mats.index(mat)
    uv = bm.loops.layers.uv.get('UVMap')
    hard = bm.edges.layers.int.get('hard') or bm.edges.layers.int.new('hard')
    new = [f for f in bm.faces if f not in before]
    k = 1 / MATS[mat]['m']
    bm.normal_update()
    for f in new:
        f.material_index = mi
        a = max(range(3), key=lambda i: abs(f.normal[i]))
        ax = [i for i in range(3) if i != a]
        for l in f.loops:
            l[uv].uv = (l.vert.co[ax[0]] * k, l.vert.co[ax[1]] * k)
        for e in f.edges:
            e[hard] = 1

def crate_box(S): return ((-S / 2, S / 2),) * 3

def crate_core(K, S, mat='wood'):
    K.add(B(S - .1, S - .1, S - .1), mat, grain=2)

@COMP
def crate1():
    K = Kit('crate1')
    S = 1.25
    crate_core(K, S)
    for side in range(4): crate_face(K, S, side, 'h')
    crate_lid(K, S)
    notch(K, (1, -1, .9), .12)
    K.done(clamp=crate_box(S))

@COMP
def crate2():
    K = Kit('crate2')
    S = 1.4
    crate_core(K, S)
    for side in range(4): crate_face(K, S, side, 'v')
    crate_lid(K, S, 7)
    notch(K, (-1, -1, -.8), .11)
    notch(K, (1, 1, 1), .08)
    K.done(clamp=crate_box(S))

@COMP
def crate_wood():
    K = Kit('crate_wood')
    S = 1.25
    r = K.r
    crate_core(K, S)
    for side in range(4):
        M = Rz(side * math.pi / 2) @ T(0, -S / 2, 0)
        n = 7
        for i in range(n):
            q = (i + .5) / n - .5
            K.plank(S - .014, .03, S / n * (1 + r.uniform(-.05, .05)) - .007, 'wood', M=M @ T(0, .023, q * S), grain=0, jit=.012)
        for z in (-.36, .36):  # 鐵箍
            K.add(B(S + .002, .004, .06), 'metal@black', M=M @ T(0, .004, z), bevel=.0012)
            for x in (-.42, 0, .42):
                b = lathe([(.012, 0), (.009, .004), (0, .005)], 5)
                K.add(b, 'metal@black', M=M @ T(x, .002, z) @ Euler((math.pi / 2, 0, 0)).to_matrix().to_4x4())
    n = 7
    for i in range(n):
        q = (i + .5) / n - .5
        K.plank(S - .006, S / n * (1 + r.uniform(-.04, .04)) - .007, .03, 'wood', at=(0, q * S, S / 2 - .017), grain=0, jit=.01)
    for x in (-.36, .36):
        K.add(B(.06, S + .002, .004), 'metal@black', at=(x, 0, S / 2 - .002), bevel=.0012)
    for sx in (-1, 1):  # 上角包鐵
        for sy in (-1, 1):
            K.add(B(.14, .14, .004), 'metal@black', at=(sx * (S / 2 - .07), sy * (S / 2 - .07), S / 2 - .002), bevel=.0012)
    K.done(clamp=crate_box(S))

@COMP
def crate_mil():
    K = Kit('crate_mil')
    S = 1.25
    r = K.r
    K.add(B(S - .04, S - .04, S - .04), 'military', bevel=.012, seg=2, at=(0, 0, 0))
    for side in range(4):
        M = Rz(side * math.pi / 2) @ T(0, -S / 2, 0)
        for x in (-.2, .2):  # 壓筋
            K.add(B(.07, .018, S - .3), 'military', M=M @ T(x, .012, 0), bevel=.006)
        for z in (-1, 1):
            K.add(B(S - .22, .02, .07), 'military', M=M @ T(0, .01, z * (S / 2 - .035)), bevel=.004)
        for x in (-1, 1):  # 角鐵
            K.add(B(.1, .02, S), 'military', M=M @ T(x * (S / 2 - .05), .01, 0), bevel=.005)
        b = tube(smooth([(-.13, 0, .03), (-.13, -.05, 0), (-.08, -.055, -.02), (.08, -.055, -.02), (.13, -.05, 0), (.13, 0, .03)], 2), .012, 6)
        K.add(b, 'metal@black', M=M @ T(0, 0, .14))
        for x in (-.15, .15):
            K.add(B(.05, .012, .08), 'metal@black', M=M @ T(x, -.004, .17), bevel=.002)
        for x in (-.45, .45):
            for z in (-.59, .59):
                K.add(lathe([(.012, 0), (.009, .004), (0, .005)], 5), 'metal@black', M=M @ T(x, -.0, z) @ Euler((math.pi / 2, 0, 0)).to_matrix().to_4x4())
    K.add(B(S, S, .06), 'military', at=(0, 0, S / 2 - .03), bevel=.012, seg=2)  # 蓋
    K.add(B(S - .34, S - .34, .012), 'military', at=(0, 0, S / 2 + .004 - .004), bevel=.004)
    for sx in (-1, 1):  # 扣具
        M = T(sx * .32, -S / 2, S / 2 - .13)
        K.add(B(.08, .018, .12), 'metal@black', M=M, bevel=.003)
        K.add(tube([(-.028, -.012, .1), (-.028, -.014, .02), (.028, -.014, .02), (.028, -.012, .1)], .004, 4), 'metal@black', M=M)
    K.add(B(S - .02, S - .02, .05), 'military', at=(0, 0, -S / 2 + .025), bevel=.012)  # 底框
    K.done()

@COMP
def mil():
    """軍綠金屬彈藥箱 1.8×1.0×1.1，帶鉸鏈蓋與提把。"""
    K = Kit('mil')
    W, D, H = 1.8, 1., 1.1
    lid = .28
    bh = H - lid - .06
    K.add(B(W - .06, D - .06, bh), 'military', at=(0, 0, .06 + bh / 2), bevel=.012, seg=2)
    # 蓋子微開、略變形
    K.add(B(W, D, lid - .03), 'military', at=(0, 0, H - lid / 2 + .015 - .015), bevel=.016, seg=2, wob=.0035, wobs=.8)
    K.add(B(W + .0, D + .0, .05), 'military', at=(0, 0, H - lid - .0 + .0), bevel=.008)
    for sx in (-1, 1):  # 腳框
        K.add(B(.16, D, .06), 'military', at=(sx * (W / 2 - .2), 0, .03), bevel=.008)
    for k in range(5):  # 長邊壓筋
        x = -W / 2 + .3 + k * (W - .6) / 4
        for sy in (-1, 1):
            K.add(B(.08, .02, bh - .1), 'military', at=(x, sy * (D / 2 - .03), .06 + bh / 2), bevel=.007, seg=2)
    for k in (-1, 1):  # 短邊壓筋
        for sx in (-1, 1):
            K.add(B(.02, .08, bh - .1), 'military', at=(sx * (W / 2 - .03), k * .22, .06 + bh / 2), bevel=.007, seg=2)
    for x in (-.55, 0, .55):  # 扣具與鉸鏈
        M = T(x, -D / 2, H - lid - .03)
        K.add(B(.11, .022, .17), 'metal@black', M=M, bevel=.004)
        K.add(B(.06, .03, .05), 'metal@black', M=M @ T(0, -.008, .05), bevel=.004)
        K.add(tube([(0, -.015, -.11), (0, -.02, -.03)], .006, 6), 'metal@black', M=M)
        K.add(tube([(x - .07, D / 2 + .004, H - lid), (x + .07, D / 2 + .004, H - lid)], .016, 8), 'metal@black')
    for sx in (-1, 1):  # 提把
        M = T(sx * W / 2, 0, .56) @ Rz(sx * math.pi / 2)
        K.add(tube(smooth([(-.2, 0, .05), (-.2, -.06, .02), (-.15, -.07, -.02), (.15, -.07, -.02), (.2, -.06, .02), (.2, 0, .05)], 2), .013, 6), 'metal@black', M=M)
        for x in (-.2, .2):
            K.add(B(.07, .014, .1), 'metal@black', M=M @ T(x, -.004, .05), bevel=.003)
    K.done()

@COMP
def barrel():
    """鏽蝕鐵桶：捲邊、兩道滾筋、凹痕，r 0.32 h 0.95。"""
    K = Kit('barrel')
    R = .32; H = .95
    off = K.r.random() * 40
    def wob(a, z):
        n = noise.noise(Vector((math.cos(a) * .9, math.sin(a) * .9, z * 2.2 + off)))
        dent = max(0, 1 - ((a - 2.2) ** 2 / .22 + (z - .36) ** 2 / .03))
        return 1 + .006 * n - .05 * dent
    p = [(R - .03, H - .03), (R - .02, H - .015), (R - .012, H - .003), (R - .002, H), (R, H - .008), (R - .003, H - .022), (R - .012, H - .03)]
    z = H - .08
    prof = list(p)
    for zr in (.62, .32):
        prof += [(R - .012, zr + .05), (R - .01, zr + .022), (R + .0, zr + .008), (R + .0, zr - .008), (R - .01, zr - .022), (R - .012, zr - .05)]
    prof += [(R - .012, .03), (R - .003, .02), (R, .008), (R - .002, 0), (R - .02, .0), (R - .03, .02), (R - .03, .03), (0, .03)]
    prof = [(0, H - .03)] + prof
    K.add(lathe(prof, 30, wob), 'metal')
    b = lathe([(.03, 0), (.03, .014), (.022, .017), (0, .017)], 8)
    K.add(b, 'metal', at=(.17, .08, H - .03))
    b = lathe([(.024, 0), (.024, .01), (0, .01)], 6)
    K.add(b, 'metal', at=(-.16, -.1, H - .03))
    K.done()

@COMP
def cart():
    """木推車，2.6×1.5×1.3。"""
    K = Kit('cart')
    r = K.r
    bl, bw = 1.7, 1.1    # 車斗長（y）寬（x）
    z = .62
    for i in range(7):
        q = (i + .5) / 7 - .5
        K.plank(bw / 7 * (1 + r.uniform(-.05, .05)) - .008, bl, .03, 'wood', at=(q * bw, -.1, z), grain=1, jit=.012)
    for s in (-1, 1):  # 兩根長樑兼車把
        K.plank(.07, 2.6, .09, 'wood', at=(s * .4, -.0, z - .06), grain=1, jit=.008, ends=False, bevel=.008)
        for k in range(4):  # 側柱
            K.plank(.05, .05, .68, 'wood', at=(s * (bw / 2 - .03), -.1 - bl / 2 + .08 + k * (bl - .16) / 3, z + .34), grain=2, jit=.008, bevel=.005)
        for zz in (.18, .38, .58):  # 側欄板
            K.plank(.026, bl - .02, .17, 'wood', at=(s * (bw / 2 + .012), -.1, z + zz), grain=1, jit=.012)
    for zz in (.2, .38):  # 後擋
        K.plank(bw, .026, .13, 'wood', at=(0, -.1 + bl / 2, z + zz), grain=0, jit=.012)
    # 車軸與輪
    K.add(tube([(-.75, -.1, .56), (.75, -.1, .56)], .03, 8), 'metal@black')
    RW = .56
    for s in (-1, 1):
        M = T(s * .68, -.1, RW) @ Euler((0, math.pi / 2, 0)).to_matrix().to_4x4()
        K.add(lathe([(RW - .1, -.03), (RW - .02, -.03), (RW - .02, .03), (RW - .1, .03)], 28), 'wood', M=M, grain=None)
        K.add(lathe([(RW - .022, -.04), (RW, -.038), (RW, .038), (RW - .022, .04)], 28), 'metal@black', M=M)
        K.add(lathe([(0, -.07), (.075, -.07), (.09, -.04), (.09, .04), (.075, .07), (0, .07)], 12), 'wood', M=M, grain=None)
        for k in range(10):
            a = k / 10 * math.tau + r.uniform(-.01, .01)
            K.plank(.045, RW - .16, .028, 'wood', M=M @ Rz(a) @ T(0, (RW + .03) / 2, 0), grain=1, jit=.004, ends=False, bevel=0)
    # 撐腳
    K.plank(.05, .05, .5, 'wood', at=(0, 1.0, .29), grain=2, jit=.01)
    K.plank(.82, .06, .06, 'wood', at=(0, .98, .5), grain=0, jit=.008)
    # check-layout 的 COVER_DIMS 是 w（x）2.6、d 1.5，長邊要走 x
    bmesh.ops.rotate(K.bm, cent=(0, 0, 0), matrix=Matrix.Rotation(math.pi / 2, 3, 'Z'), verts=K.bm.verts)
    K.done()

# ---------------- 石件 ----------------

@COMP
def well():
    K = Kit('well')
    r = K.r
    Ro, Ri = 1., .72
    n = 10
    for c in range(2):
        z0 = c * .38 + .002; z1 = z0 + .375
        a = r.random()
        for i in range(n):
            a0 = (i + a) / n * math.tau + .006
            a1 = (i + 1 + a) / n * math.tau - .006
            b = wedge(Ri, Ro - .05 + r.uniform(-.008, .008), a0, a1, z0, z1, 2)
            K.add(b, 'ashlar', bevel=.014, ang=.6, wob=.008, wobs=.4)
    n = 8
    for i in range(n):  # 壓頂
        a0 = i / n * math.tau + .005
        a1 = (i + 1) / n * math.tau - .005
        b = wedge(Ri - .03, Ro, a0, a1, .76, 1., 3)
        K.add(b, 'ashlar', bevel=.016, ang=.6, seg=2, wob=.006, wobs=.4)
    K.add(lathe([(0, .2), (Ri + .02, .2), (Ri + .02, .22), (0, .22)], 18), 'glass')
    for x in (-.42, 0, .42):  # 鐵柵
        L = math.sqrt(max(.1, (Ri + .03) ** 2 - x * x)) * 2
        K.add(tube([(x, -L / 2, .985), (x, L / 2, .985)], .014, 6), 'metal@black')
    for y in (-.3, .3):
        L = math.sqrt((Ri + .03) ** 2 - y * y) * 2
        K.add(tube([(-L / 2, y, .975), (L / 2, y, .975)], .014, 6), 'metal@black')
    K.done()

@COMP
def stone():
    """碎裂石塊：一大塊崩角，貼著一塊剝落的石片。"""
    K = Kit('stone')
    r = K.r
    b = bmesh.new()
    bmesh.ops.create_cube(b, size=1)
    bmesh.ops.subdivide_edges(b, edges=b.edges, cuts=2, use_grid_fill=True)
    for v in b.verts:
        v.co = Vector((v.co.x * 1.0, v.co.y * 1.02, v.co.z * .84))
    for dirn, d in (((1, -1, 1), .24), ((-1, -1, 1), .1), ((-1, 1, 1), .16), ((1, 1, 1), .07), ((1, -.2, .2), .05), ((0, -1, .9), .05), ((-1, .1, .3), .05), ((.3, 1, .25), .04)):
        chop(b, r, d, corner_dir(*dirn, r))
    K.add(b, 'ashlar', at=(-.06, .03, .42), bevel=.015, ang=.5, wob=.022, wobs=.32)
    b = B(.5, .36, .4)
    for dirn, d in (((1, -1, 1), .12), ((-1, -1, 1), .06), ((1, 1, 1), .05), ((1, -1, -1), .05)):
        chop(b, r, d, corner_dir(*dirn, r))
    K.add(b, 'ashlar', at=(.34, -.42, .195), rot=(.05, -.1, .4), bevel=.012, ang=.5, wob=.012, wobs=.2)
    for _ in range(4):
        c = rock(r.uniform(.06, .12), r, 1, 3)
        K.add(c, 'ashlar', at=(r.uniform(-.55, .55), r.uniform(-.6, -.3), .05), rot=(r.random(), r.random(), r.random()))
    K.done()

@COMP
def rubble():
    K = Kit('rubble')
    r = K.r
    for i in range(22):
        a = r.random() * math.tau; d = r.random() ** .8 * .66
        x, y = math.cos(a) * d, math.sin(a) * d * .85
        k = 1 - d / .7
        s = r.uniform(.06, .14) + .1 * k
        K.add(rock(s, r, 1, 3), 'ashlar', at=(x, y, s * .6 + k * .2), rot=(r.random(), r.random(), r.random() * 6))
    for i in range(6):  # 砌塊殘片
        a = r.random() * math.tau; d = r.uniform(.05, .55)
        w, dd, h = r.uniform(.14, .32), r.uniform(.1, .2), r.uniform(.06, .14)
        b = B(w, dd, h)
        for _ in range(3):
            chop(b, r, r.uniform(.015, .05), corner_dir(r.choice((-1, 1)) * w, r.choice((-1, 1)) * dd, r.choice((-1, 1)) * h, r))
        K.add(b, 'ashlar', at=(math.cos(a) * d, math.sin(a) * d, h / 2 + (1 - d / .7) * .18), rot=(r.uniform(-.5, .5), r.uniform(-.5, .5), r.random() * 6), bevel=.006, ang=.5)
    # 底下的土丘
    b = lathe([(0, .25), (.2, .23), (.38, .16), (.54, .08), (.66, .02), (.74, -.01)], 16,
              lambda a, z: 1 + .22 * noise.noise(Vector((math.cos(a) * 1.5, math.sin(a) * 1.5, 3.))))
    K.add(b, 'sand', wob=.02, wobs=.2)
    K.done()

def cards(K, center, R, n, rects, size=(.5, .75), seed_up=.0, squash=.8, up_bias=.3):
    """葉片團：沿橢球面朝外的彎曲卡片。"""
    r = K.r
    c = Vector(center)
    for i in range(n):
        # 均勻球面（費波那契）
        t = (i + .5) / n
        z = 1 - t * 1.6
        a = i * 2.39996
        rr = math.sqrt(max(0, 1 - z * z))
        dirv = Vector((rr * math.cos(a), rr * math.sin(a), z))
        p = c + Vector((dirv.x * R[0], dirv.y * R[1], dirv.z * R[2])) * r.uniform(.45, .95)
        s = r.uniform(*size)
        out = (dirv + Vector((r.gauss(0, .3), r.gauss(0, .3), r.gauss(0, .3) + up_bias))).normalized()
        tan = out.cross(Vector((0, 0, 1)))
        if tan.length < .1: tan = Vector((1, 0, 0))
        tan.normalize()
        rotk = Matrix.Rotation(r.uniform(-1, 1), 3, out)
        tan = rotk @ tan
        bin_ = out.cross(tan).normalized()
        rect = r.choice(rects)
        def F(u, v, p=p, s=s, tan=tan, out=out, bin_=bin_):
            uu, vv = u - .5, v - .5
            return p + tan * uu * s + bin_ * vv * s - out * (uu * uu + vv * vv) * s * .55
        K.add(sheet(F, 2, 2, rect), 'palm', uv=False)

@COMP
def planter():
    """石花盆 1.6×0.7×0.8，上面長灌木（葉片超出花盆高度）。"""
    K = Kit('planter')
    W, D, H = 1.6, .7, .8
    t = .09
    K.stone(W, D, .09, at=(0, 0, .045), bevel=.015, chips=2, chipd=.03, seg=2)
    for s in (-1, 1):
        K.stone(W - .08, t, H - .19, at=(0, s * (D / 2 - .04 - t / 2 + .0), .09 + (H - .19) / 2), bevel=.012, chips=2, chipd=.025)
        K.stone(t, D - .08 - t * 2 + .02, H - .19, at=(s * (W / 2 - .04 - t / 2), 0, .09 + (H - .19) / 2), bevel=.012, chips=1, chipd=.02)
    for s in (-1, 1):  # 上緣
        K.stone(W, .12, .1, at=(0, s * (D / 2 - .06), H - .05), bevel=.014, chips=2, chipd=.035, seg=2)
        K.stone(.12, D - .24, .1, at=(s * (W / 2 - .06), 0, H - .05), bevel=.014, chips=1, chipd=.02)
    K.add(sheet(lambda s, tt: Vector(((s - .5) * (W - .2), (tt - .5) * (D - .2), H - .08 + .025 * noise.noise(Vector((s * 4, tt * 3, 2))))), 6, 3), 'sand', uv=False)
    for x in (-.35, .15, .4):
        pts = [(x, 0, H - .1), (x * 1.05, .02, H + .15), (x * 1.2, -.02, H + .36), (x * 1.3, .05, H + .55)]
        K.add(tube(pts, lambda q: .024 * (1 - q * .7), 5), 'wood')
    K.foliage = (0, 0, H + .1)
    cards(K, (0, 0, H + .46), (.72, .3, .42), 26, [TWIG_A, TWIG_B], (.42, .62), up_bias=.15)
    K.done()

@COMP
def sandbag():
    """沙包牆 1.8×0.6×0.75。"""
    K = Kit('sandbag')
    r = K.r
    bh = .155
    for c, backs in enumerate((3, 3, 2, 2, 1)):
        w = .6
        z = bh * .52 + c * bh * .93
        for row in (-1, 1):
            y = row * .15
            n = 3 if row < 0 else backs
            for i in range(n):
                x = -.58 + i * .58 + (-.13 if c % 2 else 0) + .03
                b = rounded(w * r.uniform(.94, 1.02), .32 * r.uniform(.94, 1.03), bh * r.uniform(.94, 1.05), 2, 3.2)
                for v in b.verts:  # 中段垮、封口收束
                    v.co.z *= 1 - .25 * (v.co.x / (w / 2)) ** 4
                    v.co.y *= 1 - .4 * max(0, (v.co.x / (w / 2)) ) ** 6
                    v.co.z += .01 * noise.noise(v.co * 7 + Vector((c * 3, i, row)))
                K.add(b, 'canvas@burlap', at=(x, y, z), rot=(r.uniform(-.03, .03), r.uniform(-.03, .03), r.uniform(-.09, .09)), grain=0)
    K.done()

@COMP
def bench():
    """石凳：厚石板架在兩塊墩石上。"""
    K = Kit('bench')
    K.stone(1.6, .44, .11, at=(0, 0, .395), bevel=.014, chips=3, chipd=.04, seg=2, wob=.006)
    for s in (-1, 1):
        K.stone(.22, .38, .34, at=(s * .56, .01, .17), rot=(0, 0, s * .03), bevel=.012, chips=2, chipd=.03)
    K.done()

@COMP
def pot():
    """陶甕：不規則手拉、唇緣崩一角、兩個耳。"""
    K = Kit('pot')
    r = K.r
    off = r.random() * 30
    prof = [(0, .0), (.095, 0), (.11, .012), (.13, .05), (.17, .16), (.205, .28), (.218, .38), (.205, .48), (.165, .56), (.11, .62), (.085, .655), (.08, .69), (.095, .72), (.115, .735), (.118, .75), (.105, .755), (.085, .745), (.072, .71), (.07, .6), (0, .59)]
    def wob(a, z): return 1 + .012 * noise.noise(Vector((math.cos(a) * 1.3, math.sin(a) * 1.3, z * 3 + off)))
    b = lathe(prof, 22, wob)
    chop(b, r, .05, Vector((.9, -.4, 1.5)))
    K.add(b, 'sand@terracotta', bevel=.003, ang=.9)
    for s in (-1, 1):
        pts = smooth([(s * .14, 0, .57), (s * .225, 0, .56), (s * .27, 0, .48), (s * .255, 0, .39), (s * .205, 0, .335)], 3)
        K.add(tube(pts, lambda q: .021 - .006 * math.sin(q * math.pi), 7), 'sand@terracotta')
    K.done()

# ---------------- 門窗 ----------------

@COMP
def shutter():
    """單扇百葉，鉸鏈在左（-x）。0.62×1.7。"""
    K = Kit('shutter')
    shutter_panel(K, .62, 1.7, 17, (0, 0, .85), depth=.05)
    K.plank(.5, .026, .09, 'wood', at=(0, .03, .85), grain=0, jit=.006, ends=False)
    for z in (.3, 1.4):
        K.add(B(.2, .006, .035), 'metal@black', at=(-.23, -.028, z), bevel=.0015)
        K.add(tube([(-.325, -.024, z - .03), (-.325, -.024, z + .03)], .009, 6), 'metal@black')
    K.done()

def stone_surround(K, W, H, depth=.22, t=.16, sill=True, lintel=.2):
    """窗框：側石、楣石、窗台。W、H 是淨開口。"""
    for s in (-1, 1):
        z = 0
        i = 0
        while z < H - .05:
            h = K.r.uniform(.42, .6)
            if z + h > H - .25: h = H - z
            w = t + (.05 if i % 2 else 0)
            K.stone(w, depth, h - .006, at=(s * (W / 2 + w / 2), 0, z + h / 2), bevel=.01, chips=1, chipd=.02)
            z += h; i += 1
    K.stone(W + t * 2 + .12, depth + .01, lintel, at=(0, 0, H + lintel / 2), bevel=.012, chips=1)
    if sill:
        K.stone(W + t * 2 + .2, depth + .08, .08, at=(0, -.05, -.04), bevel=.012, chips=2, chipd=.025, seg=2)

@COMP
def window_a():
    """木百葉窗框：深色木框內兩扇關閉百葉。1.1×1.6。"""
    K = Kit('window_a')
    W, H = 1.1, 1.6
    ft = .07
    y = .02
    for s in (-1, 1):
        K.plank(ft, .1, H + ft * 2, 'wood', at=(s * (W / 2 + ft / 2), y, H / 2), jit=.006, bevel=.005, ends=False)
    for z in (-ft / 2, H + ft / 2):
        K.plank(W, .1, ft, 'wood', at=(0, y, z), grain=0, jit=.006, bevel=.005, ends=False)
    for s in (-1, 1):
        shutter_panel(K, W / 2 - .008, H - .01, 12, (s * W / 4, y + .01, H / 2))
    K.add(B(W, .01, H), 'wood', at=(0, y + .045, H / 2), grain=2)
    K.stone(W + .34, .24, .07, at=(0, -.03, -ft - .035), bevel=.01, chips=2, chipd=.025, seg=2)
    K.add(B(.14, .012, .012), 'metal@black', at=(0, y - .03, H / 2), bevel=.002)
    K.done()

@COMP
def window_b():
    """鐵窗：石框、方鐵條、窗台。1.1×1.5。"""
    K = Kit('window_b')
    W, H = 1.1, 1.5
    stone_surround(K, W, H)
    K.add(B(W + .02, .012, H + .02), 'glass', at=(0, .08, H / 2))
    for i in range(5):
        x = -W / 2 + W * (i + .5) / 5
        K.add(B(.02, .02, H + .04), 'metal@black', at=(x, -.03, H / 2), rot=(0, 0, math.pi / 4), bevel=.0025)
    for z in (.32, H - .32):
        K.add(B(W + .04, .01, .05), 'metal@black', at=(0, -.052, z), bevel=.002)
    K.done()

@COMP
def window_c():
    """小方窗：薄石框＋十字木櫺。0.7×0.7。"""
    K = Kit('window_c')
    W = .7
    stone_surround(K, W, W, depth=.2, t=.13, lintel=.15)
    K.add(B(W, .01, W), 'glass', at=(0, .06, W / 2))
    K.plank(.04, .05, W, 'wood', at=(0, .03, W / 2), jit=.004, bevel=.003, ends=False)
    K.plank(W, .05, .04, 'wood', at=(0, .03, W / 2), grain=0, jit=.004, bevel=.003, ends=False)
    for s in (-1, 1):
        K.plank(.05, .06, W, 'wood', at=(s * (W / 2 - .025), .03, W / 2), jit=.004, bevel=.004, ends=False)
        K.plank(W - .1, .06, .05, 'wood', at=(0, .03, W / 2 + s * (W / 2 - .025)), grain=0, jit=.004, bevel=.004, ends=False)
    K.done()

def door_leaf(K, W, H, x, y, mat, n, ledges=(.3, 1.1, 1.9), hinge=-1, zc=0):
    r = K.r
    edge = -W / 2
    for i in range(n):
        w = W / n
        cx = -W / 2 + (i + .5) * w
        K.plank(w * r.uniform(.965, .995), .045, H - r.uniform(0, .014), mat, at=(x + cx, y, H / 2 + zc), grain=2, jit=.012, bevel=.005)
    for z in ledges:
        K.plank(W - .05, .03, .12, mat, at=(x, y + .034, z + zc), grain=0, jit=.006, ends=False)

def strap(K, x, y, z, L, side):
    """鐵帶鉸鏈，尾端漸尖。"""
    poly = [(0, -.03), (L * .85, -.022), (L, 0), (L * .85, .022), (0, .03)]
    b = prism(poly, .006, 'y')
    K.add(b, 'metal@black', at=(x, y, z), rot=(0, 0 if side > 0 else math.pi, 0), bevel=.0015)
    for t in (.15, .45, .75):
        K.add(lathe([(.011, 0), (.008, .005), (0, .006)], 6), 'metal@black', M=T(x + side * L * t, y - .002, z) @ Euler((math.pi / 2, 0, 0)).to_matrix().to_4x4())

def ring(K, x, y, z):
    K.add(lathe([(.05, 0), (.05, .006), (.038, .012), (0, .012)], 10), 'metal@black', M=T(x, y, z) @ Euler((math.pi / 2, 0, 0)).to_matrix().to_4x4())
    K.add(tube([(0, -.02, 0), (0, -.024, -.012)], .012, 5), 'metal@black', M=T(x, y, z))
    pts = [(x + .052 * math.sin(t / 12 * math.tau), y - .025, z - .058 + .058 * math.cos(t / 12 * math.tau)) for t in range(13)]
    K.add(tube(pts, .0065, 5, cap=False), 'metal@black')

@COMP
def door_a():
    """藍木門＋石框、鐵環（key.jpg 右側）。淨開口 1.1×2.2。"""
    K = Kit('door_a')
    W, H = 1.1, 2.2
    jamb_d = .26
    for s in (-1, 1):
        z = 0; i = 0
        while z < H - .05:
            h = K.r.uniform(.46, .68)
            if z + h > H - .28: h = H - z
            w = .2 + (.08 if i % 2 else 0)
            K.stone(w, jamb_d, h - .006, at=(s * (W / 2 + w / 2 + .045), 0, z + h / 2), bevel=.012, chips=1, chipd=.025)
            z += h; i += 1
    K.stone(W + .68, jamb_d + .01, .24, at=(0, 0, H + .1 + .12), bevel=.014, chips=2, chipd=.03)
    # 藍色外門框
    for s in (-1, 1):
        K.plank(.09, .08, H + .1, 'woodpaint', at=(s * (W / 2 + .045), .03, (H + .1) / 2), jit=.006, bevel=.005, ends=False)
    K.plank(W + .18, .08, .1, 'woodpaint', at=(0, .03, H + .05), grain=0, jit=.006, bevel=.005, ends=False)
    door_leaf(K, W - .01, H, 0, .05, 'woodpaint', 6)
    for z in (.4, 1.8):
        strap(K, -W / 2 + .01, .024, z, .62, 1)
    ring(K, W / 2 - .17, .022, 1.08)
    K.add(B(.06, .005, .1), 'metal@black', at=(W / 2 - .17, .024, .94), bevel=.0015)
    K.stone(W + .24, jamb_d + .04, .07, at=(0, -.01, -.035), bevel=.012, chips=2, chipd=.03, wob=.003)
    K.done()

@COMP
def door_b():
    """雙開木門，淨開口 1.8×2.2，木框。"""
    K = Kit('door_b')
    W, H = 1.8, 2.2
    for s in (-1, 1):
        K.plank(.13, .2, H + .12, 'wood', at=(s * (W / 2 + .065), 0, (H + .12) / 2), bevel=.008, jit=.008, ends=False)
    K.plank(W + .36, .22, .16, 'wood', at=(0, 0, H + .08), grain=0, bevel=.008, jit=.01)
    for s in (-1, 1):
        door_leaf(K, W / 2 - .006, H, s * W / 4, .03, 'wood', 4, ledges=(.42, 1.1, 1.8))
        for z in (.42, 1.1, 1.8):
            strap(K, s * (W / 2 - .03), .004, z, .68, -s)
        K.add(tube([(s * .08, -.022, 1.0), (s * .08, -.04, 1.03), (s * .08, -.04, 1.17), (s * .08, -.022, 1.2)], .008, 5), 'metal@black')
    K.add(tube([(-.14, -.05, 1.1), (.14, -.05, 1.1)], .009, 6), 'metal@black')
    K.stone(W + .3, .24, .06, at=(0, 0, -.03), bevel=.01, chips=2, chipd=.03)
    K.done()

@COMP
def gate_a():
    """大拱木門：淨寬 3 m，高 3.6 m，厚重雙扇木板＋鐵帶。"""
    K = Kit('gate_a')
    r = K.r
    R = 1.5; sp = 2.1
    D = .34
    arch_ring(K, R, sp, D, 13, .34, .44)
    jamb(K, -R, 0, sp, D, -1)
    jamb(K, R, 0, sp, D, 1)
    n = 12
    for i in range(n):
        x0 = -R + i * 2 * R / n + .004
        x1 = x0 + 2 * R / n - .008
        top = lambda x: sp + math.sqrt(max(0, R * R - x * x)) - .012
        poly = [(x0, 0), (x1, 0), (x1, top(x1)), ((x0 + x1) / 2, top((x0 + x1) / 2)), (x0, top(x0))]
        b = prism(poly, .06, 'y')
        for v in b.verts: v.co.y += r.uniform(-.003, .003)
        K.add(b, 'wood', at=(0, .06, 0), bevel=.006, grain=2)
    K.plank(.03, .07, sp + R - .03, 'wood', at=(0, .03, (sp + R - .03) / 2), jit=.002, ends=False)
    for z in (.5, 1.5, 2.45):
        Lz = R - .08
        for s in (-1, 1):
            strap(K, s * (R - .03), .022, z, Lz - .02, -s)
    for x, z in ((.0 - .12, 1.08), (.12, 1.08)):
        ring(K, x, .026, z)
    K.done()

@COMP
def arch_frame():
    """石拱門框：外寬 3 m。拱腳與拱分開做，非等比縮放時改變形比例要靠 y/x 分開縮。"""
    K = Kit('arch_frame')
    R = 1.2; sp = 2.0
    arch_ring(K, R, sp, .3, 11, .28, .3)
    jamb(K, -R, 0, sp, .3, -1, wide=(.3, .3))
    jamb(K, R, 0, sp, .3, 1, wide=(.3, .3))
    for s in (-1, 1):  # 拱腳線腳
        K.stone(.32, .34, .1, at=(s * (R + .14), 0, sp - .05), bevel=.012, chips=1, chipd=.02, seg=2)
    K.done()

# ---------------- 線腳 ----------------

def moulding(K, L, prof, joint=1., depth=None, mat='ashlar'):
    """沿 x 的線腳段，端面切齊可接續。prof：(y,z)，-y 朝外。"""
    x = -L / 2
    pts = [joint] * int(round(L / joint))
    for w in pts:
        b = prism(prof, w - .004, 'x')
        K.add(b, mat, at=(x + w / 2, 0, 0), bevel=.006, ang=.5, wob=.003, wobs=.25,
              skip=lambda e: all(abs(abs(v.co.x) - (w - .004) / 2) < 1e-3 for v in e.verts))
        x += w

@COMP
def ledge_2m():
    K = Kit('ledge_2m')
    q = [(.06, 0), (-.0, 0), (-.012, .004), (-.025, .018), (-.03, .03), (-.03, .05)]
    for i in range(1, 6):  # 反曲線
        t = i / 6
        q.append((-.03 - .09 * (.5 - .5 * math.cos(t * math.pi)), .05 + .05 * t))
    q += [(-.12, .1), (-.122, .105), (-.122, .15), (-.135, .155), (-.14, .165), (-.14, .21), (-.13, .22), (.06, .22)]
    moulding(K, 2., q, joint=2 / 3)
    K.done()

@COMP
def plinth_2m():
    K = Kit('plinth_2m')
    x = -1.
    while x < .95:
        w = K.r.uniform(.56, .9)
        if x + w > .7: w = 1 - x
        h = .55 + K.r.uniform(-.03, .03)
        K.stone(w - .006, .1, h, at=(x + w / 2, 0, h / 2), bevel=.014, chips=2, chipd=.03, wob=.006, seg=2)
        x += w
    K.stone(2., .12, .06, at=(0, -.005, .03 + .55 - .0), bevel=.01, chips=2, chipd=.02)
    K.done()

@COMP
def quoin():
    """轉角石：長短交錯，一層 x 向一層 y 向，高 4 m。"""
    K = Kit('quoin')
    z = 0; i = 0
    while z < 3.95:
        h = K.r.uniform(.46, .6)
        if z + h > 3.7: h = 4 - z
        l, s = (.72, .5) if i % 2 == 0 else (.5, .72)
        l += K.r.uniform(-.02, .02); s += K.r.uniform(-.02, .02)
        K.stone(l, s, h - .007, at=(-(.72 - l) / 2, (.72 - s) / 2, z + h / 2), bevel=.016, chips=2, chipd=.035, wob=.006, seg=2)
        z += h; i += 1
    K.done()

@COMP
def parapet_2m():
    K = Kit('parapet_2m')
    W = 2.; D = .3
    for c in range(2):
        z0 = c * .32
        x = -1.
        while x < .95:
            w = K.r.uniform(.5, .85)
            if x + w > .75: w = 1 - x
            K.stone(w - .006, D, .315, at=(x + w / 2, 0, z0 + .158), bevel=.012, chips=1, chipd=.025)
            x += w
    x = -1.
    while x < .95:
        w = K.r.uniform(.7, 1.1)
        if x + w > .6: w = 1 - x
        K.stone(w - .004, D + .06, .1, at=(x + w / 2, 0, .69), bevel=.016, chips=1, chipd=.02, seg=2)
        x += w
    K.done()

# ---------------- 小物 ----------------

@COMP
def lantern():
    """鐵壁燈（key.jpg 右上）：渦卷支架吊一只上寬下窄的四面玻璃燈籠。+Z（-y）朝外，壁板貼牆。"""
    K = Kit('lantern')
    wy = .24   # 壁板面
    K.add(B(.11, .014, .32), 'metal@black', at=(0, wy, 0), bevel=.003)
    for z in (-.12, .12):
        K.add(lathe([(.013, 0), (.009, .006), (0, .007)], 6), 'metal@black', M=T(0, wy - .007, z) @ Euler((math.pi / 2, 0, 0)).to_matrix().to_4x4())
    # 上弧：從壁板伸出，末端捲成鉤
    arm = [(0, wy, .1), (0, .12, .13), (0, -.02, .14), (0, -.13, .1), (0, -.17, .03), (0, -.14, -.0), (0, -.115, .03)]
    K.add(tube(smooth(arm, 3), lambda q: .012 - .005 * q, 6), 'metal@black')
    # 下撐：反向渦卷
    sc = []
    for i in range(22):
        t = i / 21
        a = 3.4 + t * 6.2
        r = .1 * (1 - t * .8)
        sc.append((0, .1 + r * math.cos(a), -.055 + r * math.sin(a)))
    K.add(tube(sc, lambda q: .008 - .004 * q, 5), 'metal@black')
    K.add(tube(smooth([(0, wy, -.12), (0, .19, -.09), (0, .1, .02), (0, .03, .135)], 3), .007, 5), 'metal@black')
    # 吊鏈兩環
    y0 = -.17
    K.add(tube([(0, y0, .01), (0, y0, -.05)], .0045, 4), 'metal@black')
    zt = -.11; h = .25; zb = zt - h
    w0, w1 = .062, .092
    d = lambda w: w * 1.4142
    M = T(0, y0, 0) @ Rz(math.pi / 4)
    # 頂蓋：四坡屋頂＋煙帽＋頂飾
    K.add(lathe([(0, zt + .13), (.009, zt + .13), (.016, zt + .115), (.01, zt + .105), (.03, zt + .1), (.036, zt + .075), (d(.05), zt + .058), (d(w1 + .028), zt + .005), (d(w1 + .03), zt - .008), (d(w1 + .012), zt - .014), (0, zt - .014)], 4),
          'metal@black', M=M, bevel=.002, ang=.7)
    K.add(lathe([(.009, zt + .13), (.013, zt + .14), (.009, zt + .16), (0, zt + .17)], 6), 'metal@black', at=(0, y0, 0))
    # 底座
    K.add(lathe([(d(w0 + .012), zb - .012), (d(w0 + .014), zb), (d(w0 + .004), zb + .01), (0, zb + .01), (0, zb - .012)], 4), 'metal@black', M=M, bevel=.002, ang=.7)
    K.add(lathe([(0, zb - .062), (.008, zb - .06), (.022, zb - .04), (.03, zb - .022), (.02, zb - .01), (0, zb - .01)], 8), 'metal@black', at=(0, y0, 0))
    # 四角立柱與中箍
    for sx in (-1, 1):
        for sy in (-1, 1):
            K.add(tube([(sx * w1, y0 + sy * w1, zt - .012), (sx * w0, y0 + sy * w0, zb + .008)], .0055, 5), 'metal@black')
    zm = zt - h * .34
    wm = w1 + (w0 - w1) * .34
    K.add(tube([(-wm, y0 - wm, zm), (wm, y0 - wm, zm), (wm, y0 + wm, zm), (-wm, y0 + wm, zm), (-wm, y0 - wm, zm)], .0036, 4), 'metal@black')
    # 玻璃（單層，內部不做燈泡）
    K.add(lathe([(d(w1 - .003), zt - .012), (d(w0 - .003), zb + .008)], 4), 'glass', M=M)
    K.done()

@COMP
def banner():
    """直掛布旗，頂端鐵桿，下緣破損。0.9×2.4。"""
    K = Kit('banner')
    r = K.r
    W, H = .9, 2.4
    off = r.random() * 30
    hem = [r.uniform(0, .07) * (1 if i % 3 else 2.2) for i in range(17)]
    def F(s, t):
        q = 1 - t
        amp = .03 + .06 * q
        y = amp * math.sin(s * 9 + q * 2.4 + off) + .03 * noise.noise(Vector((s * 3, q * 3, off)))
        i = s * 16; a = int(i); b = min(16, a + 1); f = i - a
        h = hem[a] * (1 - f) + hem[b] * f
        x = (s - .5) * W * (1 - .03 * q)
        return Vector((x + .01 * math.sin(q * 5 + off), y, H - (H - h) * q))
    K.add(sheet(F, 16, 14), 'canvas@red', uv=False)
    K.add(tube([(-W / 2 - .07, 0, H + .012), (W / 2 + .07, 0, H + .012)], .014, 8), 'metal@black')
    for s in (-1, 1):
        K.add(lathe([(0, 0), (.014, .005), (.023, .02), (.016, .04), (0, .05)], 8), 'metal@black', at=(s * (W / 2 + .07), 0, H + .012), rot=(0, s * math.pi / 2, 0))
    for i in range(6):
        x = -W / 2 + W * (i + .5) / 6
        K.add(tube([(x, 0, H + .0), (x, -.022, H + .012), (x, 0, H + .03), (x, .022, H + .012), (x, 0, H - .002)], .002, 3, cap=False), 'metal@black')
    K.done()

@COMP
def bush():
    """灌木：幾支木枝幹＋橄欖葉卡片，高 1.4 m。"""
    K = Kit('bush')
    r = K.r
    for i in range(6):
        a = i / 6 * math.tau + r.uniform(-.3, .3)
        rr = r.uniform(.25, .5)
        pts = [(math.cos(a) * .02, math.sin(a) * .02, 0), (math.cos(a) * rr * .3, math.sin(a) * rr * .3, .3), (math.cos(a) * rr * .7, math.sin(a) * rr * .7, .65), (math.cos(a) * rr, math.sin(a) * rr, 1.)]
        K.add(tube(pts, lambda q: .028 * (1 - q * .8), 5), 'wood')
    K.foliage = (0, 0, .3)
    cards(K, (0, 0, .88), (.75, .75, .56), 40, [TWIG_A, TWIG_B], (.55, .85), up_bias=.2)
    K.done()

@COMP
def weed():
    """石縫雜草：彎曲的細長卡片，高約 0.45 m。"""
    K = Kit('weed')
    r = K.r
    for i in range(16):
        a = i * 2.39996 + r.uniform(-.2, .2)
        s = r.uniform(.3, .46); w = s * r.uniform(.45, .7)
        lean = r.uniform(.1, .34)
        dx, dy = math.cos(a), math.sin(a)
        ox, oy = r.uniform(-.06, .06), r.uniform(-.06, .06)
        def F(u, v, dx=dx, dy=dy, ox=ox, oy=oy, s=s, w=w, lean=lean):
            uu = u - .5
            return Vector((ox - dy * uu * w + dx * lean * v * v * s, oy + dx * uu * w + dy * lean * v * v * s, v * s))
        K.add(sheet(F, 2, 4, GRASS), 'palm', uv=False)
    K.foliage = (0, 0, -.1)
    K.up = 1.6
    K.done()

@COMP
def palm():
    """棕櫚：S 形彎曲樹幹、每節一圈凸環、葉鞘殘樁、羽狀葉用 alpha 卡片。"""
    K = Kit('palm')
    r = K.r
    H = 8.6
    N = 44
    def spine(t):
        return Vector((.75 * math.sin(t * 2.0) + .28 * math.sin(t * 5.2),
                       .4 * math.sin(t * 1.4 + .5) - .2, t * H))
    seg = 9
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new('UVMap')
    rings = []
    L = 0
    for i in range(N + 1):
        t = i / N
        p = spine(t)
        q = spine(min(1, t + .01)) - spine(max(0, t - .01))
        q.normalize()
        u = q.cross(Vector((0, 1, 0))).normalized()
        w = q.cross(u)
        base = .21 + .17 * math.exp(-t * 16) - .045 * t
        node = .024 * (1 if i % 2 else -.1)
        ring = []
        for k in range(seg):
            a = k / seg * math.tau
            n = noise.noise(Vector((math.cos(a) * 1.2, math.sin(a) * 1.2, t * 22))) * .014
            rr = base + node + n
            ring.append(bm.verts.new(p + (u * math.cos(a) + w * math.sin(a)) * rr))
        rings.append(ring)
    for i in range(N):
        for k in range(seg):
            m = (k + 1) % seg
            f = bm.faces.new((rings[i][k], rings[i][m], rings[i + 1][m], rings[i + 1][k]))
            for l, (a, b) in zip(f.loops, ((k, i), (k + 1, i), (k + 1, i + 1), (k, i + 1))):
                l[uv].uv = (a / seg * 1.1, b / N * H)
    bm.faces.new(list(reversed(rings[0])))
    bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    K.add(bm, 'sand@bark', uv=False)
    top = spine(1)
    # 葉鞘殘樁
    for i in range(16):
        a = i * 2.39996
        d = Vector((math.cos(a), math.sin(a), 0))
        z = -.9 + i * .05
        p = spine(1 + z / H)
        K.add(tube([p + d * .08, p + d * .24 + Vector((0, 0, .1)), p + d * .36 + Vector((0, 0, .24))], lambda q: .05 * (1 - q * .8), 5), 'sand@bark')
    # 葉
    n = 20
    for i in range(n):
        lvl = i / (n - 1)
        a = i * 2.39996 + r.uniform(-.1, .1)
        d = Vector((math.cos(a), math.sin(a), 0))
        side = Vector((0, 0, 1)).cross(d).normalized()   # 繞序要朝上，雙面光照才不會把正面算成背面
        LL = r.uniform(3.7, 4.5)
        W = LL * .37
        e0 = math.radians(78 - 78 * lvl + r.uniform(-6, 6))
        droop = math.radians(62 + 44 * lvl + r.uniform(-8, 8))
        rect = FROND_A if i % 2 == 0 else FROND_B
        def S(u, v, a=a, d=d, side=side, LL=LL, W=W, e0=e0, droop=droop):
            x = 0; z = 0
            steps = 12
            ang = e0
            for q in range(int(u * steps)):
                ang = e0 - droop * (q / steps) ** 1.3
                x += math.cos(ang) * LL / steps; z += math.sin(ang) * LL / steps
            f = u * steps - int(u * steps)
            ang = e0 - droop * (int(u * steps) / steps) ** 1.3
            x += math.cos(ang) * LL / steps * f; z += math.sin(ang) * LL / steps * f
            vv = v - .5
            wing = abs(vv) * W
            p = top + d * (.12 + x) + Vector((0, 0, z - .1))
            return p + side * vv * W + Vector((0, 0, -wing * .38))
        K.add(sheet(S, 10, 2, (rect[0], rect[1], rect[2], rect[3])), 'palm', uv=False)
    K.foliage = (top.x, top.y, top.z - .4)
    K.up = 1.1
    K.done()

# ---------------- 日晷 ----------------

@COMP
def sundial():
    """日坊的地標：三階圓台、刻度環、斜置石晷針。直徑 7 m。"""
    K = Kit('sundial')
    r = K.r
    def ring_course(r0, r1, z0, z1, n, seg=3):
        a0 = r.random()
        for i in range(n):
            a = (i + a0) / n * math.tau + .012 * 0
            b = (i + 1 + a0) / n * math.tau
            K.add(wedge(r0, r1 + r.uniform(-.006, .006), a + .003, b - .003, z0, z1 + r.uniform(-.004, .004), seg), 'ashlar', bevel=.016, ang=.5, wob=.008, wobs=.5)
    ring_course(2.9, 3.5, 0, .22, 13, 2)
    ring_course(2.4, 3.0, 0.22, .44, 10, 2)
    # 刻度盤：lathe 輪廓刻兩圈溝
    z = .46
    prof = [(0, z + .09), (.3, z + .09), (.31, z + .11), (.34, z + .11), (.35, z + .09), (1.62, z + .09), (1.625, z + .07), (1.66, z + .07), (1.665, z + .09),
            (2.06, z + .09), (2.065, z + .07), (2.1, z + .07), (2.105, z + .09), (2.44, z + .09), (2.46, z + .07), (2.46, z - .03), (0, z - .03)]
    K.add(lathe(prof, 40), 'ashlar@mono')
    for i in range(24):  # 時標：長短交錯的凸起石條
        a = i / 24 * math.tau
        L = .34 if i % 2 == 0 else .2
        if i % 6 == 0: L = .4
        K.add(B(.075, L, .04), 'ashlar@mono', M=Rz(a) @ T(0, -1.86, z + .1))
    # 晷針：石楔＋鐵緣，指向南（-y）高起。緯度角 34°。
    La = 3.7; Hg = La * math.tan(math.radians(34)); t = .22
    poly = [(-1.9, 0), (1.8, 0), (1.8, Hg * .08), (-1.9 + La * .96, Hg * .08 + 1.0 * 0), (1.8 - .02, Hg), (1.62, Hg), (-1.9, .16)]
    poly = [(-1.9, 0), (1.8, 0), (1.8, Hg), (1.62, Hg), (-1.9, .14)]
    bm = prism([(y, zz) for y, zz in poly], t, 'x')
    K.add(bm, 'ashlar@mono', at=(0, 0, z + .08), bevel=.012, ang=.5, wob=.006, wobs=.5)
    pts = [(0, -1.9, z + .08 + .155), (0, 1.8, z + .08 + Hg + .012)]
    K.add(B(.05, math.hypot(3.7, Hg - .14) + .08, .03), 'metal@black', M=T(0, -.05, z + .08 + (Hg + .14) / 2 + .02) @ Euler((math.atan2(Hg - .14, 3.7), 0, 0)).to_matrix().to_4x4(), bevel=.004)
    K.done()

# ---------------- 葉片圖集 ----------------

def bake_palm_atlas(out_png):
    """葉片畫成幾何、平光投影到 1024 圖集。顏色是 albedo，不帶陰影。"""
    rng = random.Random(278)
    scn = bpy.data.scenes.new('atlas')
    me = bpy.data.meshes.new('leaves')
    verts, faces, cols = [], [], []
    def srgb(c): return tuple(x ** 2.2 for x in c)
    def leaf(pts, w, base, tip, z, curve=0.):
        """pts：中線；w(t)：半寬。"""
        n = len(pts)
        i0 = len(verts)
        for i, p in enumerate(pts):
            a = pts[max(i - 1, 0)]; b = pts[min(i + 1, n - 1)]
            dx, dy = b[0] - a[0], b[1] - a[1]
            l = math.hypot(dx, dy) or 1
            nx, ny = -dy / l, dx / l
            t = i / (n - 1)
            ww = w(t)
            c = tuple(base[k] * (1 - t) + tip[k] * t for k in range(3))
            verts.append((p[0] + nx * ww, p[1] + ny * ww, z)); cols.append(tuple(k * .86 for k in c))
            verts.append((p[0], p[1], z)); cols.append(tuple(min(1, k * 1.12) for k in c))
            verts.append((p[0] - nx * ww, p[1] - ny * ww, z)); cols.append(tuple(k * .78 for k in c))
        for i in range(n - 1):
            a = i0 + i * 3
            faces.append((a, a + 3, a + 4, a + 1))
            faces.append((a + 1, a + 4, a + 5, a + 2))
    def frond(rect, seed):
        r = random.Random(seed)
        x0, y0, x1, y1 = rect[0] * 3, rect[1] * 3, rect[2] * 3, rect[3] * 3
        yc = (y0 + y1) / 2
        hw = (y1 - y0) / 2 * .97
        lenx = x1 - x0 - .06
        stem = [(x0 + .02 + lenx * i / 24, yc) for i in range(25)]
        leaf(stem, lambda t: .013 * (1 - t) + .0035, srgb((.50, .47, .28)), srgb((.36, .38, .17)), .5)
        n = 92
        for side in (-1, 1):
            for i in range(n):
                t = max(.06, min(.995, (i + r.uniform(-.3, .3)) / n))
                x = x0 + .02 + t * lenx
                env = min(1, (t - .05) * 9) ** .6 * (1 - t ** 2.6) ** .75
                ang = math.radians(44 - 24 * t + r.uniform(-3.5, 3.5))
                L = min(hw / max(math.sin(ang), .2), .62) * env * r.uniform(.84, 1.03)
                droop = r.uniform(-.04, .12)
                pts = []
                for q in range(7):
                    s_ = q / 6
                    px = x + math.cos(ang) * L * s_
                    py = yc + side * (math.sin(ang) * L * s_ - droop * s_ * s_ * L * .5)
                    pts.append((px, py))
                g = r.uniform(.82, 1.12)
                base = srgb((.25 * g, .33 * g, .14 * g))
                tip = srgb((.34 * g, .39 * g, .16 * g))
                if r.random() < .07: tip = srgb((.50, .46, .22))
                wd = r.uniform(.0095, .0135)
                leaf(pts, lambda q, wd=wd: wd * min(1, q * 6 + .15) * (1 - q ** 2.4), base, tip, r.random() * .4)
    def twig(rect, seed, leaves):
        r = random.Random(seed)
        x0, y0, x1, y1 = rect[0] * 3, rect[1] * 3, rect[2] * 3, rect[3] * 3
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
        hw = (x1 - x0) / 2 * .9
        for b in range(15):
            a = r.random() * math.tau
            L = hw * r.uniform(.55, .95)
            bend = r.uniform(-.5, .5)
            pts = []
            for q in range(7):
                s_ = q / 6
                pts.append((cx + r.uniform(-.14, .14) * 0 + math.cos(a + bend * s_) * L * s_, cy + math.sin(a + bend * s_) * L * s_))
            leaf(pts, lambda t: .004 * (1 - t) + .0015, srgb((.30, .25, .17)), srgb((.28, .26, .16)), .1)
            for i in range(leaves):
                s_ = r.uniform(.2, 1.)
                k = int(s_ * 6)
                px, py = pts[k]
                la = a + bend * s_ + r.choice((-1, 1)) * r.uniform(.35, 1.)
                ll = r.uniform(.05, .085)
                q = [(px + math.cos(la) * ll * c / 5, py + math.sin(la) * ll * c / 5) for c in range(6)]
                g = r.uniform(.78, 1.18)
                silver = r.random() < .3
                bc = srgb((.37 * g, .40 * g, .29 * g)) if silver else srgb((.22 * g, .29 * g, .15 * g))
                tc = srgb((.43 * g, .46 * g, .34 * g)) if silver else srgb((.28 * g, .34 * g, .16 * g))
                leaf(q, lambda t: .0115 * math.sin(t * math.pi) ** .7 + .0006, bc, tc, .2 + r.random() * .4)
    def grass(rect, seed):
        r = random.Random(seed)
        x0, y0, x1, y1 = rect[0] * 3, rect[1] * 3, rect[2] * 3, rect[3] * 3
        cx = (x0 + x1) / 2
        W = x1 - x0; H = y1 - y0
        for i in range(90):
            bx = cx + r.gauss(0, W * .09)
            L = H * r.uniform(.4, .96)
            lean = max(-.85, min(.85, r.gauss(0, .5)))
            pts = []
            for q in range(9):
                s_ = q / 8
                pts.append((bx + lean * s_ * s_ * L * .42, y0 + .012 + L * (s_ - .12 * abs(lean) * s_ * s_)))
            g = r.uniform(.75, 1.15)
            dry = r.random() < .22
            bc = srgb((.25 * g, .31 * g, .13 * g))
            tc = srgb((.52 * g, .46 * g, .22 * g)) if dry else srgb((.34 * g, .39 * g, .16 * g))
            leaf(pts, lambda t: .006 * (1 - t ** 2) + .0012, bc, tc, r.random())
    frond(FROND_A, 1); frond(FROND_B, 2)
    twig(TWIG_A, 3, 9); twig(TWIG_B, 4, 15)
    grass(GRASS, 5)
    me.from_pydata(verts, [], faces)
    ca = me.color_attributes.new('Col', 'FLOAT_COLOR', 'POINT')
    for i, c in enumerate(cols): ca.data[i].color = (*c, 1)
    ob = bpy.data.objects.new('leaves', me)
    scn.collection.objects.link(ob)
    mat = bpy.data.materials.new('leafcol')
    mat.use_nodes = True
    nt = mat.node_tree
    for n in list(nt.nodes): nt.nodes.remove(n)
    o = nt.nodes.new('ShaderNodeOutputMaterial')
    e = nt.nodes.new('ShaderNodeEmission')
    c = nt.nodes.new('ShaderNodeVertexColor')
    c.layer_name = 'Col'
    nt.links.new(c.outputs[0], e.inputs[0])
    nt.links.new(e.outputs[0], o.inputs[0])
    me.materials.append(mat)
    cam = bpy.data.cameras.new('c')
    cam.type = 'ORTHO'; cam.ortho_scale = 3
    co = bpy.data.objects.new('c', cam)
    co.location = (1.5, 1.5, 5)
    scn.collection.objects.link(co)
    scn.camera = co
    scn.render.engine = 'CYCLES'
    scn.cycles.samples = 32
    scn.cycles.use_denoising = False
    scn.render.film_transparent = True
    scn.render.resolution_x = scn.render.resolution_y = 1024
    scn.render.resolution_percentage = 100
    scn.view_settings.view_transform = 'Standard'
    scn.view_settings.look = 'None'
    scn.render.image_settings.file_format = 'PNG'
    scn.render.image_settings.color_mode = 'RGBA'
    raw = out_png.replace('.png', '-raw.png')
    scn.render.filepath = raw
    bpy.ops.render.render(write_still=True, scene=scn.name)
    # 邊緣顏色外推：透明區填鄰近葉色，mip 才不會帶黑邊
    import numpy as np
    img = bpy.data.images.load(raw)
    img.alpha_mode = 'STRAIGHT'
    W, H = img.size
    px = np.array(img.pixels[:], dtype=np.float32).reshape(H, W, 4)
    rgb = px[..., :3].copy(); a = (px[..., 3] > .02).astype(np.float32)
    acc = rgb * a[..., None]; w = a.copy()
    for it in range(14):
        def blur(q):
            return (q + np.roll(q, 1, 0) + np.roll(q, -1, 0) + np.roll(q, 1, 1) + np.roll(q, -1, 1)) / 5
        acc2 = blur(acc); w2 = blur(w)
        mask = w < 1e-3
        fill = (w2 > 1e-4) & mask
        acc[fill] = acc2[fill]; w[fill] = w2[fill]
    out = np.where(w[..., None] > 1e-4, acc / np.maximum(w[..., None], 1e-4), .2)
    keep = a[..., None] > .5
    rgb = np.where(keep, rgb, out)
    res = np.dstack([rgb, px[..., 3]])
    o2 = bpy.data.images.new('atlas', W, H, alpha=True)
    o2.alpha_mode = 'STRAIGHT'
    o2.pixels.foreach_set(res.ravel().astype(np.float32).tolist())
    o2.filepath_raw = out_png
    o2.file_format = 'PNG'
    o2.save()
    bpy.data.scenes.remove(scn)
    return out_png

# ---------------- 匯出與自檢 ----------------

def export(path):
    bpy.ops.object.select_all(action='DESELECT') if bpy.context.view_layer.objects else None
    objs = [o for k, o in KITS.items() if k != '__list']
    bpy.ops.export_scene.gltf(
        filepath=path, export_format='GLB', use_selection=False, export_texcoords=True, export_normals=True,
        export_tangents=False, export_materials='EXPORT', export_image_format='NONE', export_vertex_color='NONE',
        export_attributes=False, export_cameras=False, export_lights=False, export_animations=False, export_skins=False,
        export_morph=False, export_yup=True, export_apply=False, export_draco_mesh_compression_enable=False,
        export_meshopt_compression_enable=False, export_extras=False, export_use_gltfpack=False,
        export_copyright='作品 278 赭線，程式建模，CC0')

def read_glb(path):
    with open(path, 'rb') as f: d = f.read()
    assert d[:4] == b'glTF'
    jl = struct.unpack_from('<I', d, 12)[0]
    j = json.loads(d[20:20 + jl])
    bin_ = d[20 + jl + 8:]
    return j, bin_

def write_glb(path, j, bin_):
    js = json.dumps(j, separators=(',', ':'), ensure_ascii=False).encode()
    js += b' ' * ((4 - len(js) % 4) % 4)
    bin_ += b'\0' * ((4 - len(bin_) % 4) % 4)
    tot = 12 + 8 + len(js) + 8 + len(bin_)
    with open(path, 'wb') as f:
        f.write(b'glTF' + struct.pack('<II', 2, tot))
        f.write(struct.pack('<I', len(js)) + b'JSON' + js)
        f.write(struct.pack('<I', len(bin_)) + b'BIN\0' + bin_)

def patch_and_meta(path, write_meta=True):
    """後處理：補 alphaMode／doubleSided。kit-meta.json 全部從 glb 算，不信 Blender 場景。"""
    j, b = read_glb(path)
    for m in j.get('materials', []):
        d = MATS[m['name']]
        if d.get('alpha'):
            m['alphaMode'] = 'MASK'; m['alphaCutoff'] = .5
        if d.get('twoSided'): m['doubleSided'] = True
        m.pop('extras', None)
    for k in ('extensionsUsed', 'extensionsRequired'):
        assert not j.get(k), f'{k}: {j.get(k)}'
    write_glb(path, j, b)
    j, b = read_glb(path)
    A = j['accessors']; Bv = j['bufferViews']
    fails = []
    def accessor_xyz(ai):
        a = A[ai]; v = Bv[a['bufferView']]
        return a['count'], (v.get('byteOffset', 0) + a.get('byteOffset', 0)), v.get('byteStride', 12)
    nodes = {}
    tris_total = 0
    for n in j['nodes']:
        if 'mesh' not in n: continue
        name = n['name']
        for bad in ('translation', 'rotation', 'scale', 'matrix'):
            if bad in n: fails.append(f'{name}: 節點帶 {bad}')
        me = j['meshes'][n['mesh']]
        lo = [1e9] * 3; hi = [-1e9] * 3; tris = 0; verts = 0; mats = []
        for p in me['primitives']:
            at = p['attributes']
            extra = set(at) - {'POSITION', 'NORMAL', 'TEXCOORD_0'}
            if extra: fails.append(f'{name}: 多餘屬性 {extra}')
            if 'TEXCOORD_0' not in at or 'NORMAL' not in at: fails.append(f'{name}: 缺 UV 或法線')
            pa = A[at['POSITION']]
            lo = [min(a, c) for a, c in zip(lo, pa['min'])]
            hi = [max(a, c) for a, c in zip(hi, pa['max'])]
            tris += A[p['indices']]['count'] // 3
            verts += pa['count']
            mats.append(j['materials'][p['material']]['name'])
        tris_total += tris
        nodes[name] = dict(aabb_min=[round(x, 4) for x in lo], aabb_max=[round(x, 4) for x in hi],
                           size=[round(h - l, 3) for l, h in zip(lo, hi)], tris=tris, verts=verts, materials=mats)
        if not TRI_MIN <= tris <= TRI_MAX: fails.append(f'{name}: {tris} 面超出 {TRI_MIN}–{TRI_MAX}')
        if abs(lo[1]) > 1e-3: fails.append(f'{name}: 底部 y={lo[1]:.4f}')
        if '.' in name: fails.append(f'{name}: 名稱帶點')
    size = os.path.getsize(path)
    if size > SIZE_MAX: fails.append(f'檔案 {size} 超過 {SIZE_MAX}')
    meta = dict(
        glb='assets/278/models/kit.glb', bytes=size, trisTotal=tris_total,
        convention=dict(
            coords='glTF 空間：+Y 上、+Z 朝外，單位公尺。Babylon 載入後 __root__ 帶左手系翻轉（x 鏡像），直接取幾何餵 thin instance 時沒有這層翻轉，門的鉸鏈邊與繞序要前端二選一處理。',
            origin='底部中心（AABB 的 x、z 置中）。anchor=grid 的件例外：牆身厚度中線 z=0、floor/steps 的 x、z 為模組中心，用來對 4 m 網格，所以 AABB 可能偏一邊。',
            uv='一組 TEXCOORD_0，已依 materials[].uvMetres 縮放，直接當網格 UV 用。木板零件的 UV 只落在貼圖的一條板內、ashlar 放大一倍，用世界座標 UV 會多出假縫，見 uvPolicy。palm 的 UV 直接對 palm_a.webp 圖集，不能用世界座標 UV。世界座標 UV 要用貼圖實際尺寸（credits/textures.md），不是 uvMetres。',
            materialName='<貼圖 id> 或 <貼圖 id>@<變體>。變體共用貼圖，albedo 乘 materials[].tint（線性，也在 baseColorFactor）。glass 沒有貼圖。',
            multiMaterial='多材質的節點在 Babylon 會拆成 <id>_primitiveN 子網格，每個材質一個 draw。'),
        materials={k: dict(tex=None if v.get('notex') else k.split('@')[0], uvMetres=v['m'], tint=v.get('tint', (1, 1, 1)),
                           twoSided=bool(v.get('twoSided')), alphaTest=bool(v.get('alpha'))) for k, v in MATS.items()},
        grid=sorted(GRID_NODES),
        uvPolicy=dict(meshRequired=['palm'], meshPreferred=['wood', 'woodpaint', 'ashlar', 'ashlar@mono'],
                      worldOk=['sandstone', 'flag', 'sand', 'sand@terracotta', 'sand@bark', 'canvas', 'canvas@red', 'canvas@burlap',
                               'military', 'metal', 'metal@black', 'whitewash']),
        nodes=nodes)
    if write_meta:
        with open(META, 'w') as f: json.dump(meta, f, ensure_ascii=False, indent=1)
    return meta, fails

GRID_NODES = {'wall_sandstone', 'wall_archway', 'wall_upper_window', 'floor_limestone', 'steps_4m', 'roof_trim'}

# ---------------- contact sheet ----------------

def preview_materials():
    """算繪用：把真實貼圖接到網格 UV 上，看到的就是進遊戲的樣子。匯出之後才改，不影響 glb。"""
    def load(id, kind, data):
        p = os.path.join(TEX, f'{id}_{kind}.webp')
        if not os.path.exists(p): return None
        im = bpy.data.images.load(p, check_existing=True)
        if data: im.colorspace_settings.name = 'Non-Color'
        return im
    for name, m in _mat_cache.items():
        d = MATS[name]
        if d.get('notex'): continue
        id = name.split('@')[0]
        nt = m.node_tree
        p = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
        a = nt.nodes.new('ShaderNodeTexImage'); a.image = load(id, 'a', False)
        tint = nt.nodes.new('ShaderNodeMixRGB'); tint.blend_type = 'MULTIPLY'
        tint.inputs[0].default_value = 1
        tint.inputs[2].default_value = (*d.get('tint', (1, 1, 1)), 1)
        nt.links.new(a.outputs[0], tint.inputs[1])
        nt.links.new(tint.outputs[0], p.inputs['Base Color'])
        if d.get('alpha'):
            nt.links.new(a.outputs[1], p.inputs['Alpha'])
            continue
        o = load(id, 'orm', True)
        if o:
            ot = nt.nodes.new('ShaderNodeTexImage'); ot.image = o
            sp = nt.nodes.new('ShaderNodeSeparateColor')
            nt.links.new(ot.outputs[0], sp.inputs[0])
            nt.links.new(sp.outputs[1], p.inputs['Roughness'])
            nt.links.new(sp.outputs[2], p.inputs['Metallic'])
        n = load(id, 'n', True)
        if n:
            nn = nt.nodes.new('ShaderNodeTexImage'); nn.image = n
            nm = nt.nodes.new('ShaderNodeNormalMap'); nm.inputs['Strength'].default_value = 1
            nt.links.new(nn.outputs[0], nm.inputs['Color'])
            nt.links.new(nm.outputs[0], p.inputs['Normal'])

_sheet = None
def sheet_scene():
    global _sheet
    if _sheet: return _sheet
    scn = bpy.context.scene
    scn.render.engine = 'CYCLES'
    scn.cycles.samples = 48
    scn.cycles.use_denoising = True
    scn.cycles.transparent_max_bounces = 48
    try:
        pr = bpy.context.preferences.addons['cycles'].preferences
        pr.compute_device_type = 'METAL'
        pr.get_devices()
        for d in pr.devices: d.use = True
        scn.cycles.device = 'GPU'
    except Exception as e:
        print('Metal 不可用，改 CPU', e)
    w = bpy.data.worlds.new('w')
    w.use_nodes = True
    bg = next(n for n in w.node_tree.nodes if n.type == 'BACKGROUND')
    bg.inputs[0].default_value = (.42, .56, .78, 1)
    bg.inputs[1].default_value = .55
    scn.world = w
    sun = bpy.data.lights.new('sun', 'SUN')
    sun.color = (1, .9, .74); sun.energy = 2.6; sun.angle = math.radians(2)
    so = bpy.data.objects.new('sun', sun)
    so.rotation_euler = Euler((math.radians(52), math.radians(8), math.radians(-38)))
    scn.collection.objects.link(so)
    g = bpy.data.meshes.new('g')
    g.from_pydata([(-200, -200, 0), (200, -200, 0), (200, 200, 0), (-200, 200, 0)], [], [(0, 1, 2, 3)])
    go = bpy.data.objects.new('ground', g)
    gm = bpy.data.materials.new('gm'); gm.use_nodes = True
    next(n for n in gm.node_tree.nodes if n.type == 'BSDF_PRINCIPLED').inputs['Base Color'].default_value = (.36, .30, .22, 1)
    g.materials.append(gm)
    scn.collection.objects.link(go)
    # 比例尺：1.8 m 人形（細膠囊）
    pm = bmesh.new()
    bmesh.ops.create_cone(pm, segments=12, radius1=.2, radius2=.2, depth=1.8, cap_ends=True)
    bmesh.ops.translate(pm, vec=(0, 0, .9), verts=pm.verts)
    fm = bpy.data.meshes.new('fig'); pm.to_mesh(fm); pm.free()
    fig = bpy.data.objects.new('fig', fm)
    fgm = bpy.data.materials.new('figm'); fgm.use_nodes = True
    next(n for n in fgm.node_tree.nodes if n.type == 'BSDF_PRINCIPLED').inputs['Base Color'].default_value = (.08, .09, .11, 1)
    fm.materials.append(fgm)
    scn.collection.objects.link(fig)
    cam = bpy.data.cameras.new('cam'); cam.lens = 45; cam.clip_end = 500
    co = bpy.data.objects.new('cam', cam)
    scn.collection.objects.link(co)
    scn.camera = co
    scn.view_settings.view_transform = 'AgX' if False else 'Standard'
    scn.view_settings.look = 'None'
    scn.render.image_settings.file_format = 'PNG'
    scn.render.image_settings.color_mode = 'RGB'
    _sheet = scn, co, fig
    return _sheet

def aim(co, target, dist, az, el):
    d = Vector((math.cos(el) * math.sin(az), -math.cos(el) * math.cos(az), math.sin(el)))
    co.location = Vector(target) + d * dist
    co.rotation_euler = (-d).to_track_quat('-Z', 'Y').to_euler()

def stamp(scn, text):
    r = scn.render
    r.use_stamp = True
    for a in ('use_stamp_date', 'use_stamp_time', 'use_stamp_render_time', 'use_stamp_frame', 'use_stamp_camera', 'use_stamp_lens', 'use_stamp_scene', 'use_stamp_marker', 'use_stamp_filename', 'use_stamp_sequencer_strip', 'use_stamp_memory', 'use_stamp_hostname', 'use_stamp_frame_range'):
        if hasattr(r, a): setattr(r, a, False)
    r.use_stamp_note = True
    r.use_stamp_labels = False
    r.stamp_note_text = text
    r.stamp_font_size = 15
    r.stamp_foreground = (1, 1, 1, 1)
    r.stamp_background = (0, 0, 0, .7)

def render_grid(ids, out, tile, cols, closeups=False):
    import numpy as np
    scn, co, fig = sheet_scene()
    scn.render.resolution_x = tile
    scn.render.resolution_y = int(tile * .8)
    scn.render.resolution_percentage = 100
    tiles = []
    tmp = os.path.join(DIST, 'kit-tiles')
    os.makedirs(tmp, exist_ok=True)
    objs = {k: v for k, v in KITS.items() if k != '__list'}
    for i, id in enumerate(ids):
        for k, o in objs.items(): o.hide_render = k != id
        ob = objs[id]
        bb = [Vector(c) for c in ob.bound_box]
        lo = Vector((min(c.x for c in bb), min(c.y for c in bb), min(c.z for c in bb)))
        hi = Vector((max(c.x for c in bb), max(c.y for c in bb), max(c.z for c in bb)))
        c = (lo + hi) / 2; rad = (hi - lo).length / 2
        fig.hide_render = rad < .7 or closeups
        fig.location = (hi.x + .45, c.y + .1, 0)
        if not fig.hide_render:
            c = (lo + hi) / 2 + Vector((.3, 0, 0))
            c.z = max(c.z, .9); rad = max(rad + .4, 1.2)
        aim(co, c, rad * (2.55 if closeups else 2.8), math.radians(-30), math.radians(16))
        stamp(scn, id)
        p = os.path.join(tmp, f'{id}{"_c" if closeups else ""}.png')
        scn.render.filepath = p
        bpy.ops.render.render(write_still=True)
        tiles.append(p)
        print('tile', id)
    h = int(tile * .8)
    rows = math.ceil(len(tiles) / cols)
    can = np.zeros((rows * (h + 2), cols * (tile + 2), 4), np.float32)
    can[..., 3] = 1
    for i, p in enumerate(tiles):
        im = bpy.data.images.load(p)
        a = np.array(im.pixels[:], np.float32).reshape(h, tile, im.channels)
        if a.shape[2] == 3: a = np.dstack([a, np.ones((h, tile))])
        y = (rows - 1 - i // cols) * (h + 2); x = (i % cols) * (tile + 2)
        can[y:y + h, x:x + tile] = a
        bpy.data.images.remove(im)
    o = bpy.data.images.new('sheet', can.shape[1], can.shape[0], alpha=False)
    o.pixels.foreach_set(can.ravel().tolist())
    o.filepath_raw = out
    o.file_format = 'PNG'
    o.save()
    print('寫入', out)

# ---------------- 主流程 ----------------

def main():
    random.seed(278)
    for o in list(bpy.data.objects): bpy.data.objects.remove(o)
    for m in list(bpy.data.meshes): bpy.data.meshes.remove(m)
    for m in list(bpy.data.materials): bpy.data.materials.remove(m)
    os.makedirs(DIST, exist_ok=True)
    os.makedirs(os.path.dirname(GLB), exist_ok=True)
    os.makedirs(TEX, exist_ok=True)
    if flag('--tex'):
        png = bake_palm_atlas(os.path.join(DIST, 'palm_a.png'))
        out = os.path.join(TEX, 'palm_a.webp')
        subprocess.check_call(['cwebp', '-quiet', '-q', '88', '-alpha_q', '100', '-exact', '-m', '6', png, '-o', out])
        print('寫入', out, os.path.getsize(out))
    for fn in KITS['__list']:
        if ONLY and fn.__name__ not in ONLY: continue
        fn()
    path = os.path.join(DIST, 'kit-only.glb') if ONLY else GLB
    export(path)
    meta, fails = patch_and_meta(path, write_meta=not ONLY)
    print(f'glb {os.path.getsize(path)} bytes，{meta["trisTotal"]} 面，{len(meta["nodes"])} 節點')
    for f in fails: print('不合格：', f)
    if flag('--sheet'):
        preview_materials()
        ids = [k for k in KITS if k != '__list']
        tile = int(opt('--tile', '420'))
        render_grid(ids, os.path.join(DIST, 'kit-sheet.png' if not ONLY else 'kit-only.png'), tile, 7 if not ONLY else min(4, len(ids)))
        if not ONLY:
            render_grid(['door_a', 'crate1', 'crate2', 'lantern', 'well', 'palm', 'sundial', 'awning_striped'],
                        os.path.join(DIST, 'kit-detail.png'), 620, 4, closeups=True)
    sys.stdout.flush()

main()
