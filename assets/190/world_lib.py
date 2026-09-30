# 190 封頂：大地圖物件（build_world.py）用的建模工具
# 沿用 lb_lib 的 three 座標寫法（y 朝上、正面朝 +z），但材質名稱直接是「用途」並保留 UV：
#   leaf（葉片卡，UV 對到葉片圖集）、bark、paint（網頁可換色，頂點色 = 白 × AO）、glass、emit、rock、wood、metal、roof、plain
# 頂點色 = 底色 × 烘焙 AO；UV：葉片與招牌用自己的 UV（面屬性 kuv=1），其他面用「以公尺為單位的方盒投影」。
import bpy, bmesh, math, os, random
import numpy as np
from mathutils import Vector, Matrix, Euler, noise
from lb_lib import V, T, TAU, srgb2lin, hexrgb, mat, rot_m, bm_lathe, bm_ell, bm_box, bm_tube, bm_loft, rrect, join, smooth_by_angle, tri_count

WROLES = ('leaf', 'bark', 'paint', 'glass', 'emit', 'rock', 'wood', 'metal', 'roof', 'plain')


def _layers(bm):
    uv = bm.loops.layers.uv.verify()
    k = bm.faces.layers.int.get('kuv') or bm.faces.layers.int.new('kuv')
    return uv, k


def wfinish(bm, name, role, color, at=(0, 0, 0), rot=None, smooth=False, var=.05, seed=0, nscale=2.0, recalc=True):
    """bm 為 three 座標；轉成 Blender 物件、材質 = 用途名稱、頂點色 = 底色（paint 為白）帶一點雜訊"""
    assert role in WROLES, role
    _layers(bm)
    R = rot_m(rot)
    at = Vector(at)
    for v in bm.verts:
        v.co = V(*(R @ Vector(v.co) + at))
    bm.normal_update()   # 先更新法線，否則 recalc 會依舊法線判斷而把轉過的零件翻成朝內
    if role != 'leaf' and recalc:
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    me.materials.append(mat(role))
    for p in me.polygons:
        p.use_smooth = smooth
    base = (1.0, 1.0, 1.0) if role == 'paint' else hexrgb(color)
    col = me.color_attributes.new('Col', 'FLOAT_COLOR', 'POINT')
    me.color_attributes.active_color = col
    arr = np.zeros(len(me.vertices) * 4, dtype=np.float32)
    off = Vector((seed * 1.7, seed * 3.1, 5.3))
    for i, v in enumerate(me.vertices):
        p = T(v.co)
        k = 1 + noise.noise(p * nscale + off) * var if var else 1
        arr[i * 4:i * 4 + 4] = (srgb2lin(max(0, min(1, base[0] * k))), srgb2lin(max(0, min(1, base[1] * k))), srgb2lin(max(0, min(1, base[2] * k))), 1.0)
    col.data.foreach_set('color', arr)
    return ob


def slice_bm(bm, step, axes=(0, 1, 2)):
    for ax in axes:
        cs = [v.co[ax] for v in bm.verts]
        lo, hi = min(cs), max(cs)
        n = int((hi - lo) / step)
        no = [0, 0, 0]; no[ax] = 1
        for i in range(1, n + 1):
            co = [0, 0, 0]; co[ax] = lo + (hi - lo) * i / (n + 1)
            bmesh.ops.bisect_plane(bm, geom=list(bm.verts) + list(bm.edges) + list(bm.faces), dist=1e-5, plane_co=co, plane_no=no)
    return bm


def bm_boxes(lst):
    bm = bmesh.new()
    for (c, s) in lst:
        r = bmesh.ops.create_cube(bm, size=1.0)
        for v in r['verts']:
            v.co = Vector((v.co.x * s[0] + c[0], v.co.y * s[1] + c[1], v.co.z * s[2] + c[2]))
    return bm


def wbox(name, role, color, c, s, bevel=0.0, rot=None, step=0, var=.05, seg=1):
    bm = bm_box(s, bevel, seg)
    if step:
        slice_bm(bm, step)
    return wfinish(bm, name, role, color, c, rot, False, var)


def wboxes(name, role, color, lst, at=(0, 0, 0), rot=None, var=.05, step=0):
    bm = bm_boxes(lst)
    if step:
        slice_bm(bm, step)
    return wfinish(bm, name, role, color, at, rot, False, var)


def _align(a, b):
    a, b = Vector(a), Vector(b)
    d = b - a
    q = Vector((0, 0, 1)).rotation_difference(d.normalized())
    return Matrix.Translation((a + b) / 2) @ q.to_matrix().to_4x4(), d.length


def wcyls(name, role, color, lst, seg=10, var=.04, smooth=True, r2=None):
    bm = bmesh.new()
    for it in lst:
        a, b, r = it[:3]
        rb = it[3] if len(it) > 3 else r
        m, L = _align(a, b)
        bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=seg, radius1=r, radius2=rb, depth=L, matrix=m)
    return wfinish(bm, name, role, color, (0, 0, 0), None, smooth, var)


def wtube(name, role, color, pts, radii, seg=8, caps=True, var=.05, smooth=True):
    return wfinish(bm_tube(pts, radii, seg, caps), name, role, color, (0, 0, 0), None, smooth, var)


def wlathe(name, role, color, prof, at=(0, 0, 0), seg=16, rot=None, var=.04, smooth=True, **kw):
    return wfinish(bm_lathe(prof, seg, **kw), name, role, color, at, rot, smooth, var)


def wloft(name, role, color, sections, var=.04, smooth=False, cap=True):
    return wfinish(bm_loft(sections, cap), name, role, color, (0, 0, 0), None, smooth, var)


def prism(name, role, color, poly, a0, a1, axis='z', var=.04):
    """凸多邊形 poly（在另外兩軸的平面上）沿 axis 從 a0 擠到 a1。axis='z' 時 poly 是 (x, y)；'x' 時是 (z, y)"""
    bm = bmesh.new()
    def P(u, v, a):
        return (u, v, a) if axis == 'z' else (a, v, u)
    va = [bm.verts.new(P(u, v, a0)) for (u, v) in poly]
    vb = [bm.verts.new(P(u, v, a1)) for (u, v) in poly]
    n = len(poly)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((va[i], va[j], vb[j], vb[i]))
    bm.faces.new(list(reversed(va)))
    bm.faces.new(vb)
    return wfinish(bm, name, role, color, (0, 0, 0), None, False, var)


# ── 有開口的牆：自動拆成方塊，並記錄碰撞盒 ──
def aabb(c, s):
    return [round(c[0] - s[0] / 2, 3), round(c[1] - s[1] / 2, 3), round(c[2] - s[2] / 2, 3), round(c[0] + s[0] / 2, 3), round(c[1] + s[1] / 2, 3), round(c[2] + s[2] / 2, 3)]


def wall(COL, name, role, color, axis, fixed, a0, a1, y0, y1, t, holes=(), step=.7):
    """有開口的牆：一張焊接好的格子網格（內外兩面 + 開口側面），碰撞盒另外拆成方塊。
    axis='x'：牆沿 x（a0..a1）、位在 z=fixed；axis='z'：沿 z、位在 x=fixed。holes=[(u0, u1, y0, y1)]"""
    cuts = sorted(set([a0, a1] + [h[0] for h in holes] + [h[1] for h in holes]))
    for (u0, u1) in zip(cuts, cuts[1:]):
        if u1 - u0 < 1e-4:
            continue
        spans = [(y0, y1)]
        for h in holes:
            if h[0] <= u0 + 1e-6 and h[1] >= u1 - 1e-6:
                new = []
                for (s0, s1) in spans:
                    if h[3] <= s0 or h[2] >= s1:
                        new.append((s0, s1)); continue
                    if h[2] > s0: new.append((s0, h[2]))
                    if h[3] < s1: new.append((h[3], s1))
                spans = new
        for (s0, s1) in spans:
            if s1 - s0 > 1e-4:
                uc, yc = (u0 + u1) / 2, (s0 + s1) / 2
                c, sz = ((uc, yc, fixed), (u1 - u0, s1 - s0, t)) if axis == 'x' else ((fixed, yc, uc), (t, s1 - s0, u1 - u0))
                COL.append(aabb(c, sz))

    def refine(vals):
        out = []
        for (a, b) in zip(vals, vals[1:]):
            n = max(1, int(math.ceil((b - a) / step - 1e-6)))
            out += [a + (b - a) * k / n for k in range(n)]
        return out + [vals[-1]]
    us = refine(sorted(set(round(v, 5) for v in [a0, a1] + [h[0] for h in holes] + [h[1] for h in holes] if a0 - 1e-6 <= v <= a1 + 1e-6)))
    ys = refine(sorted(set(round(v, 5) for v in [y0, y1] + [h[2] for h in holes] + [h[3] for h in holes] if y0 - 1e-6 <= v <= y1 + 1e-6)))
    nu, ny = len(us) - 1, len(ys) - 1
    solid = [[not any(h[0] < (us[i] + us[i + 1]) / 2 < h[1] and h[2] < (ys[j] + ys[j + 1]) / 2 < h[3] for h in holes) for j in range(ny)] for i in range(nu)]
    bm = bmesh.new()
    VV = {}

    def vert(i, j, side):
        k = (i, j, side)
        if k not in VV:
            d = fixed + (t / 2 if side == 0 else -t / 2)
            VV[k] = bm.verts.new((us[i], ys[j], d) if axis == 'x' else (d, ys[j], us[i]))
        return VV[k]
    def S(i, j):
        return 0 <= i < nu and 0 <= j < ny and solid[i][j]
    for i in range(nu):
        for j in range(ny):
            if not solid[i][j]:
                continue
            for side in (0, 1):
                bm.faces.new((vert(i, j, side), vert(i + 1, j, side), vert(i + 1, j + 1, side), vert(i, j + 1, side)))
            if not S(i - 1, j):
                bm.faces.new((vert(i, j, 0), vert(i, j + 1, 0), vert(i, j + 1, 1), vert(i, j, 1)))
            if not S(i + 1, j):
                bm.faces.new((vert(i + 1, j, 0), vert(i + 1, j, 1), vert(i + 1, j + 1, 1), vert(i + 1, j + 1, 0)))
            if not S(i, j - 1):
                bm.faces.new((vert(i, j, 0), vert(i, j, 1), vert(i + 1, j, 1), vert(i + 1, j, 0)))
            if not S(i, j + 1):
                bm.faces.new((vert(i, j + 1, 0), vert(i + 1, j + 1, 0), vert(i + 1, j + 1, 1), vert(i, j + 1, 1)))
    return wfinish(bm, name, role, color, (0, 0, 0), None, False, .04)


def opening_trim(name, color, axis, fixed, t, h, w=.08, d=.04, sill=True, role='wood'):
    """開口四周的木框（內外兩面各一圈）"""
    u0, u1, y0, y1 = h
    lst = []
    for side in (-1, 1):
        f = fixed + side * (t / 2 + d / 2)
        for (uc, yc, du, dy) in (((u0 - w / 2), (y0 + y1) / 2, w, y1 - y0 + w * 2), ((u1 + w / 2), (y0 + y1) / 2, w, y1 - y0 + w * 2), ((u0 + u1) / 2, y1 + w / 2, u1 - u0, w)) + ((((u0 + u1) / 2, y0 - w / 2, u1 - u0 + w * 2, w),) if sill else ()):
            lst.append(((uc, yc, f), (du, dy, d)) if axis == 'x' else ((f, yc, uc), (d, dy, du)))
    return wboxes(name, role, color, lst)


def pane(name, axis, fixed, h, color=0x8fa9b8, th=.02):
    u0, u1, y0, y1 = h
    c, s = (((u0 + u1) / 2, (y0 + y1) / 2, fixed), (u1 - u0, y1 - y0, th)) if axis == 'x' else ((fixed, (y0 + y1) / 2, (u0 + u1) / 2), (th, y1 - y0, u1 - u0))
    return wbox(name, 'glass', color, c, s, var=0)


# ── 葉片卡 ──
ATLAS = 2   # 2×2 圖集


def leaf_cards(cards, name='lf', color=0x6f8f3a, var=.18, seed=0):
    """cards=[(中心, 大小, 法線, 旋轉角, 圖集格)]：每張卡一個四邊形，UV 對到圖集該格；頂點色帶明暗與色相變化"""
    bm = bmesh.new()
    uv, kuv = _layers(bm)
    rng = random.Random(seed)
    cols = []
    for (c, s, n, spin, cell) in cards:
        n = Vector(n).normalized()
        a = n.orthogonal().normalized()
        b = n.cross(a).normalized()
        ca, sa = math.cos(spin), math.sin(spin)
        a, b = a * ca + b * sa, b * ca - a * sa
        C = Vector(c)
        vs = [bm.verts.new(C + (a * du + b * dv) * s / 2) for (du, dv) in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
        f = bm.faces.new(vs)
        f[kuv] = 1
        u0 = (cell % ATLAS) / ATLAS
        v0 = (cell // ATLAS) / ATLAS
        e = .004
        # glTF 的 v 往下；Blender 的 v 往上，匯出時會翻成 1 - v
        for loop, (du, dv) in zip(f.loops, ((0, 1), (1, 1), (1, 0), (0, 0))):
            gu = u0 + e + du * (1 / ATLAS - 2 * e)
            gv = v0 + e + dv * (1 / ATLAS - 2 * e)
            loop[uv].uv = (gu, 1 - gv)
        cols.append(rng.uniform(-1, 1))
    ob = wfinish(bm, name, 'leaf', color, var=var, seed=seed, nscale=.8)
    return ob


def box_uv(ob):
    """kuv=0 的面：以物件座標（公尺）做方盒投影"""
    me = ob.data
    uvl = me.uv_layers[0] if len(me.uv_layers) else me.uv_layers.new(name='UVMap')
    uvl.name = 'UVMap'
    ka = me.attributes.get('kuv')
    keep = np.zeros(len(me.polygons), dtype=np.int32)
    if ka:
        ka.data.foreach_get('value', keep)
    co = np.zeros(len(me.vertices) * 3, dtype=np.float32)
    me.vertices.foreach_get('co', co)
    co = co.reshape(-1, 3)
    P3 = np.stack([co[:, 0], co[:, 2], -co[:, 1]], 1)    # three 座標
    lv = np.zeros(len(me.loops), dtype=np.int32)
    me.loops.foreach_get('vertex_index', lv)
    uvs = np.zeros(len(me.loops) * 2, dtype=np.float32)
    uvl.data.foreach_get('uv', uvs)
    uvs = uvs.reshape(-1, 2)
    for p in me.polygons:
        if keep[p.index]:
            continue
        n = p.normal
        n3 = (n.x, n.z, -n.y)
        ax = max(range(3), key=lambda i: abs(n3[i]))
        for li in p.loop_indices:
            x, y, z = P3[lv[li]]
            if ax == 1:
                uvs[li] = (x, -z if n3[1] > 0 else z)
            elif ax == 0:
                uvs[li] = (-z if n3[0] > 0 else z, y)
            else:
                uvs[li] = (x if n3[2] > 0 else -x, y)
    uvl.data.foreach_set('uv', uvs.ravel())


def canopy_normals(ob, center, radii, up=.35):
    """葉片面改用樹冠橢球的外法線（柔和的整團受光）；其他面保留原本法線"""
    me = ob.data
    leaf_idx = [i for i, m in enumerate(me.materials) if m and m.name.startswith('leaf')]
    C = Vector(center)
    try:
        cn = [Vector(c.vector) for c in me.corner_normals]
    except Exception:
        me.calc_normals_split()
        cn = [Vector(l.normal) for l in me.loops]
    out = []
    for p in me.polygons:
        is_leaf = p.material_index in leaf_idx
        for li in p.loop_indices:
            if is_leaf:
                q = T(me.vertices[me.loops[li].vertex_index].co)
                d = Vector(((q.x - C.x) / radii[0] ** 2, (q.y - C.y) / radii[1] ** 2, (q.z - C.z) / radii[2] ** 2)).normalized()
                d = (d + Vector((0, up, 0))).normalized()
                out.append(V(d.x, d.y, d.z))
            else:
                out.append(cn[li])
    try:
        me.normals_split_custom_set(out)
    except Exception as e:
        print('custom normals failed', e)


def ao_bake_w(objs, samples=32, floor=.35, dist=1.0, role_floor=None):
    """AO 烘焙到頂點色（同 lb_lib，另把被別的零件包住的頂點用鄰點平均）"""
    sc = bpy.context.scene
    sc.cycles.samples = samples
    sc.world.light_settings.distance = dist
    for ob in objs:
        me = ob.data
        ao = me.color_attributes.new('AO', 'FLOAT_COLOR', 'POINT')
        me.color_attributes.active_color = ao
        for o in bpy.context.view_layer.objects:
            o.select_set(False)
        ob.select_set(True)
        bpy.context.view_layer.objects.active = ob
        bpy.ops.object.bake(type='AO', target='VERTEX_COLORS')
        n = len(me.vertices)
        a = np.zeros(n * 4, dtype=np.float32)
        ao.data.foreach_get('color', a)
        v = np.clip(a.reshape(-1, 4)[:, 0], 0, 1)
        ed = np.zeros(len(me.edges) * 2, dtype=np.int32)
        me.edges.foreach_get('vertices', ed)
        ed = ed.reshape(-1, 2)
        bad = v < .08
        for _ in range(8):
            if not bad.any():
                break
            good = ~bad
            s_ = np.zeros(n, np.float32); c_ = np.zeros(n, np.float32)
            for (i, j) in ((0, 1), (1, 0)):
                m = good[ed[:, j]]
                np.add.at(s_, ed[m, i], v[ed[m, j]]); np.add.at(c_, ed[m, i], 1)
            fix = bad & (c_ > 0)
            v[fix] = s_[fix] / c_[fix]
            bad &= ~fix
        v[bad] = .6
        b = np.zeros(n * 4, dtype=np.float32)
        me.color_attributes['Col'].data.foreach_get('color', b)
        b = b.reshape(-1, 4)
        fl = np.full(n, floor, np.float32)
        if role_floor:   # 依材質用途給不同的 AO 下限（葉片、樹皮不要壓得太黑）
            for p in me.polygons:
                m = me.materials[p.material_index]
                f_ = role_floor.get(m.name.split('.')[0]) if m else None
                if f_ is not None:
                    for vi in p.vertices:
                        fl[vi] = f_
        b[:, :3] *= (fl + (1 - fl) * v)[:, None]
        me.color_attributes['Col'].data.foreach_set('color', b.ravel())
        me.color_attributes.remove(me.color_attributes['AO'])
        me.color_attributes.active_color = me.color_attributes['Col']


def shade_by(ob, fn, roles=None):
    """依位置乘上係數：fn(p) → 倍率（只作用在 roles 內的材質）"""
    me = ob.data
    col = me.color_attributes['Col']
    a = np.zeros(len(me.vertices) * 4, dtype=np.float32)
    col.data.foreach_get('color', a)
    a = a.reshape(-1, 4)
    ok = np.ones(len(me.vertices), dtype=bool)
    if roles:
        ok[:] = False
        idx = [i for i, m in enumerate(me.materials) if m and m.name.split('.')[0] in roles]
        for p in me.polygons:
            if p.material_index in idx:
                for vi in p.vertices:
                    ok[vi] = True
    for i, v in enumerate(me.vertices):
        if ok[i]:
            a[i, :3] *= fn(T(v.co))
    col.data.foreach_set('color', a.ravel())


def wexport(path, objs):
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    for o in objs:
        o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_vertex_color='ACTIVE',
                              export_animation_mode='ACTIONS', export_apply=False, export_yup=True, export_texcoords=True,
                              export_normals=True, export_materials='EXPORT', export_image_format='NONE', export_attributes=False)
    print('exported', path, os.path.getsize(path) // 1024, 'KB')


def quantize_glb_colors(path):
    """匯出後處理：COLOR_0 改存成正規化的 UNSIGNED_BYTE VEC4（glTF 核心規格允許，three 的 GLTFLoader 直接支援），
    並把用不到的 bufferView 一起丟掉重新打包。Blender 匯出器只會寫 float / unsigned short。"""
    import json, struct
    raw = open(path, 'rb').read()
    jl = struct.unpack('<I', raw[12:16])[0]
    j = json.loads(raw[20:20 + jl])
    o = 20 + jl
    bl = struct.unpack('<I', raw[o:o + 4])[0]
    binb = raw[o + 8:o + 8 + bl]
    CT = {5126: np.float32, 5123: np.uint16, 5121: np.uint8}
    NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}
    color_acc = set()
    for m in j['meshes']:
        for pr in m['primitives']:
            if 'COLOR_0' in pr['attributes']:
                color_acc.add(pr['attributes']['COLOR_0'])
    blobs = []      # (bytes, target)

    def view_bytes(bv):
        s = bv.get('byteOffset', 0)
        return binb[s:s + bv['byteLength']]
    remap = {}
    for ai, a in enumerate(j['accessors']):
        bv = j['bufferViews'][a['bufferView']]
        if ai in color_acc and a['componentType'] in (5126, 5123):
            dt, n = CT[a['componentType']], NC[a['type']]
            item = np.dtype(dt).itemsize
            stride = bv.get('byteStride', item * n)
            base = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
            arr = np.frombuffer(binb[base:base + stride * a['count']], dtype=np.uint8).reshape(a['count'], stride)[:, :item * n].copy().view(dt).reshape(a['count'], n).astype(np.float64)
            if a['componentType'] == 5123:
                arr /= 65535.0
            if n == 3:
                arr = np.concatenate([arr, np.ones((a['count'], 1))], 1)
            q = np.round(np.clip(arr, 0, 1) * 255).astype(np.uint8)
            blobs.append((q.tobytes(), 34962, 4))
            a['bufferView'] = len(blobs) - 1
            a.pop('byteOffset', None)
            a['componentType'] = 5121
            a['normalized'] = True
            a['type'] = 'VEC4'
            continue
        key = a['bufferView']
        if key not in remap:
            blobs.append((view_bytes(bv), bv.get('target'), bv.get('byteStride')))
            remap[key] = len(blobs) - 1
        a['bufferView'] = remap[key]
    out = bytearray()
    views = []
    for (data, target, stride) in blobs:
        while len(out) % 4:
            out += b'\0'
        v = {'buffer': 0, 'byteOffset': len(out), 'byteLength': len(data)}
        if target:
            v['target'] = target
        if stride and target == 34962:
            v['byteStride'] = stride
        views.append(v)
        out += data
    while len(out) % 4:
        out += b'\0'
    j['bufferViews'] = views
    j['buffers'] = [{'byteLength': len(out)}]
    js = json.dumps(j, separators=(',', ':')).encode()
    while len(js) % 4:
        js += b' '
    total = 12 + 8 + len(js) + 8 + len(out)
    with open(path, 'wb') as f:
        f.write(struct.pack('<III', 0x46546C67, 2, total))
        f.write(struct.pack('<II', len(js), 0x4E4F534A)); f.write(js)
        f.write(struct.pack('<II', len(out), 0x004E4942)); f.write(bytes(out))
    print('quantized colors', path, os.path.getsize(path) // 1024, 'KB')
