# 建模工具：以斷面放樣（loft）與細分曲面組出角色部件，再合併、綁骨、算遮蔽、輸出。
# 座標系直接沿用 three.js：+Y 向上、角色面向 +Z、角色左手在 +X。
import math

import bmesh
import bpy
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree

V = Vector


def reset():
    for ob in list(bpy.data.objects):
        bpy.data.objects.remove(ob, do_unlink=True)
    for coll in (bpy.data.meshes, bpy.data.armatures, bpy.data.materials, bpy.data.cameras, bpy.data.lights, bpy.data.images):
        for x in list(coll):
            coll.remove(x)


def lerp(a, b, t):
    return a + (b - a) * t


def smooth(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)


def bump(x, c, w):
    """以 c 為中心、半寬 w 的平滑隆起（0..1）。"""
    d = abs(x - c) / w
    return 0.0 if d >= 1 else (1 - d * d) ** 2


def ang_bump(th, c, w):
    """角度版 bump：th 與 c 的環狀差距。"""
    d = (th - c + math.pi) % (2 * math.pi) - math.pi
    return bump(d, 0, w)


# ---------------------------------------------------------------- 放樣
class S:
    """一個斷面：中心 c、側向半徑 a、前後半徑 b、超橢圓指數 p、徑向調變 mod(theta)→倍率、中心偏移 off(theta)"""

    def __init__(self, c, a, b=None, p=2.0, mod=None, tw=0.0):
        self.c = V(c)
        self.a = a
        self.b = a if b is None else b
        self.p = p
        self.mod = mod
        self.tw = tw  # 斷面扭轉（弧度）


def _se(t, p):
    c, s = math.cos(t), math.sin(t)
    e = 2.0 / p
    return math.copysign(abs(c) ** e, c), math.copysign(abs(s) ** e, s)


def loft(name, stations, n=12, cap0='pole', cap1='pole', side=V((1, 0, 0)), front=V((0, 0, 1)), cap_len=None, closed_loop=False, gap=None):
    """沿斷面序列建四邊形籠（未細分）。theta=0 在側向（side），theta=pi/2 在前方（front）。
    cap：'pole'＝以中心點封口、None＝開口。"""
    bm = bmesh.new()
    m = len(stations)
    cs = [s.c for s in stations]
    rings = []
    for i, s in enumerate(stations):
        if m == 1:
            T = V((0, 1, 0))
        elif i == 0:
            T = (cs[1] - cs[0])
        elif i == m - 1:
            T = (cs[-1] - cs[-2])
        else:
            T = (cs[i + 1] - cs[i - 1])
        T.normalize()
        f = front - T * front.dot(T)
        if f.length < 1e-5:
            f = V((0, 1, 0)) - T * T.y
        f.normalize()
        u = side - T * side.dot(T) - f * side.dot(f)
        if u.length < 1e-5:
            u = T.cross(f)
        u.normalize()
        ring = []
        g = gap(i) if gap else 0.0
        for k in range(n + (1 if gap else 0)):
            # gap：前方開口的半角（弧度），斷面改成從 前方+g 繞到 前方+2π−g 的開口弧
            th = (math.pi / 2 + g + (2 * math.pi - 2 * g) * k / n) if gap else (2 * math.pi * k / n + s.tw)
            cx, sy = _se(th, s.p)
            r = s.mod(th) if s.mod else 1.0
            p = s.c + u * (s.a * cx * r) + f * (s.b * sy * r)
            ring.append(bm.verts.new(p))
        rings.append((ring, T))
    for i in range(m - 1):
        a, b = rings[i][0], rings[i + 1][0]
        for k in range(n):
            k2 = (k + 1) if gap else (k + 1) % n
            bm.faces.new((a[k], a[k2], b[k2], b[k]))
    if gap:
        bmesh.ops.remove_doubles(bm, verts=bm.verts[:], dist=1e-6)
        cap0 = cap1 = None

    def cap(ring, T, c, s, sign):
        if cap_len is None:
            ln = min(s.a, s.b) * 0.35
        else:
            ln = cap_len
        pole = bm.verts.new(c + T * (ln * sign))
        for k in range(n):
            k2 = (k + 1) % n
            bm.faces.new((ring[k], ring[k2], pole) if sign < 0 else (ring[k2], ring[k], pole))

    if cap0 == 'pole':
        cap(rings[0][0], rings[0][1], cs[0], stations[0], -1)
    if cap1 == 'pole':
        cap(rings[-1][0], rings[-1][1], cs[-1], stations[-1], 1)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    # 開口管的法線方向不確定：以第一個斷面檢查，朝內就整體翻轉
    if m > 1:
        f0 = bm.faces[0]
        if f0.normal.dot(f0.calc_center_median() - cs[0]) < 0:
            bmesh.ops.reverse_faces(bm, faces=bm.faces)
    return to_object(name, bm)


def to_object(name, bm):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    return ob


def quad_sphere(name, r=1.0, cuts=6):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=2.0)
    bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=cuts, use_grid_fill=True)
    for v in bm.verts:
        v.co = v.co.normalized() * r
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return to_object(name, bm)


def box_cage(name, sx, sy, sz, cuts=(1, 1, 1)):
    """細分過的方塊籠，之後以 deform 塑形。"""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=V((sx, sy, sz)), verts=bm.verts)
    c = max(cuts)
    if c > 0:
        bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=c, use_grid_fill=True)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return to_object(name, bm)


def deform(ob, fn):
    for v in ob.data.vertices:
        v.co = fn(V(v.co))
    ob.data.update()
    return ob


def transform(ob, mat):
    ob.data.transform(mat)
    ob.data.update()
    return ob


def subsurf(ob, levels=2, solidify=None, crease_open=False):
    """細分；有 solidify（布料殼）時先細分 levels−1 次再加厚（殼的面數只有直接細分的四分之一）。"""
    if solidify:
        if levels > 1:
            m = ob.modifiers.new('sub0', 'SUBSURF')
            m.levels = levels - 1
            m.quality = 3
            bake(ob)
        m = ob.modifiers.new('sol', 'SOLIDIFY')
        m.thickness = solidify
        m.offset = -1.0
        m.use_even_offset = True
        m.use_rim = True
        return bake(ob)
    if levels:
        m = ob.modifiers.new('sub', 'SUBSURF')
        m.levels = levels
        m.render_levels = levels
        m.quality = 3
    return bake(ob)


def bake(ob):
    if not ob.modifiers:
        return ob
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
    old = ob.data
    ob.modifiers.clear()
    ob.data = me
    bpy.data.meshes.remove(old)
    return ob


def shade_smooth(ob):
    for p in ob.data.polygons:
        p.use_smooth = True


def split_sharp(ob, angle_deg=40):
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    lim = math.radians(angle_deg)
    edges = [e for e in bm.edges if len(e.link_faces) == 2 and e.calc_face_angle(0) > lim]
    if edges:
        bmesh.ops.split_edges(bm, edges=edges)
    bm.to_mesh(ob.data)
    bm.free()
    return ob


def mirror_x(ob, name=None):
    """複製並沿 X 鏡射（左右對稱部件）。"""
    me = ob.data.copy()
    me.transform(Matrix.Scale(-1, 4, V((1, 0, 0))))
    me.flip_normals()
    o2 = bpy.data.objects.new(name or ob.name + '_m', me)
    bpy.context.scene.collection.objects.link(o2)
    for k, v in ob.items():
        o2[k] = v
    return o2


# ---------------------------------------------------------------- 調色盤與屬性
class Palette:
    def __init__(self):
        self.cols = []

    def __call__(self, hexcol):
        if hexcol not in self.cols:
            self.cols.append(hexcol)
        return self.cols.index(hexcol)


def _layer(me, name, typ='INT'):
    a = me.attributes.get(name)
    if a is None:
        a = me.attributes.new(name, typ, 'POINT')
    return a


def tag(ob, pal, mat=0, grp=0, ol=1.0):
    """整個部件塗單色：pal＝調色盤索引，mat＝材質碼（0 一般、1 頭髮、2 亮面、3 發光、4 皮膚），grp＝綁骨群組，ol＝外框粗細倍率。"""
    me = ob.data
    n = len(me.vertices)
    _layer(me, 'pal').data.foreach_set('value', [pal] * n)
    _layer(me, 'mat').data.foreach_set('value', [mat] * n)
    _layer(me, 'grp').data.foreach_set('value', [grp] * n)
    _layer(me, 'ol', 'FLOAT').data.foreach_set('value', [ol] * n)
    nf = len(me.polygons)
    _flayer(me, 'fpal').data.foreach_set('value', [pal] * nf)
    _flayer(me, 'fmat').data.foreach_set('value', [mat] * nf)
    shade_smooth(ob)
    return ob


def _flayer(me, name):
    a = me.attributes.get(name)
    if a is None:
        a = me.attributes.new(name, 'INT', 'FACE')
    return a


def paint(ob, fn):
    """fn(co, normal) → None 或 (pal, mat)：以面中心判斷重新上色（邊界沿著三角形，粗略用）。"""
    me = ob.data
    FP = _flayer(me, 'fpal').data
    FM = _flayer(me, 'fmat').data
    for f in me.polygons:
        r = fn(V(f.center), V(f.normal))
        if r is not None:
            FP[f.index].value = r[0]
            if len(r) > 1 and r[1] is not None:
                FM[f.index].value = r[1]
    _face_to_vert(ob)
    return ob


def _face_to_vert(ob):
    """預覽用：把面顏色抄回頂點（交界頂點取最後一個）。"""
    me = ob.data
    FP, FM = me.attributes['fpal'].data, me.attributes['fmat'].data
    P, M = me.attributes['pal'].data, me.attributes['mat'].data
    for f in me.polygons:
        for vi in f.vertices:
            P[vi].value = FP[f.index].value
            M[vi].value = FM[f.index].value


def iso_cut(ob, field):
    """沿純量場 field(co)=0 的等值線切開網格（在邊上插點、把面分開），讓上色邊界平滑、不受三角形大小影響。"""
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    fv = {v: field(V(v.co)) for v in bm.verts}
    cut = set(v for v in bm.verts if abs(fv[v]) < 1e-12)
    for e in list(bm.edges):
        a, b = e.verts
        fa, fb = fv[a], fv[b]
        if fa * fb < 0:
            t = fa / (fa - fb)
            if t < 0.02 or t > 0.98:
                # 太靠近端點：直接把端點挪到等值線上，避免產生碎面
                v = a if t < 0.5 else b
                v.co = a.co.lerp(b.co, t)
                fv[v] = 0.0
                cut.add(v)
                continue
            _ne, nv = bmesh.utils.edge_split(e, a, t)
            fv[nv] = 0.0
            cut.add(nv)
    for f in list(bm.faces):
        cv = [v for v in f.verts if v in cut]
        if len(cv) == 2 and not any(set(e.verts) == set(cv) for e in f.edges):
            try:
                bmesh.utils.face_split(f, cv[0], cv[1])
            except Exception:  # noqa: BLE001
                pass
    bm.to_mesh(ob.data)
    bm.free()
    ob.data.update()
    return ob


def paint_field(ob, field, pal, mat=None):
    """field(co) < 0 的區域塗成 pal（先沿等值線切開，邊界平滑銳利）。"""
    iso_cut(ob, field)
    me = ob.data
    FP = _flayer(me, 'fpal').data
    FM = _flayer(me, 'fmat').data
    for f in me.polygons:
        if field(V(f.center)) < 0:
            FP[f.index].value = pal
            if mat is not None:
                FM[f.index].value = mat
    _face_to_vert(ob)
    return ob


def join(objs, name):
    objs = [o for o in objs if o is not None]
    base = objs[0]
    with bpy.context.temp_override(active_object=base, object=base, selected_objects=objs, selected_editable_objects=objs):
        bpy.ops.object.join()
    base.name = name
    base.data.name = name
    return base


def duplicate(ob, name):
    o2 = bpy.data.objects.new(name, ob.data.copy())
    bpy.context.scene.collection.objects.link(o2)
    return o2


# ---------------------------------------------------------------- 骨架與權重
def build_armature(bones):
    """bones：[(name, head, tail, parent)]，座標為 three.js 空間。"""
    ad = bpy.data.armatures.new('rig')
    arm = bpy.data.objects.new('rig', ad)
    bpy.context.scene.collection.objects.link(arm)
    bpy.context.view_layer.objects.active = arm
    arm.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    eb = {}
    for name, h, t, par in bones:
        b = ad.edit_bones.new(name)
        b.head = V(h)
        b.tail = V(t)
        if par:
            b.parent = eb[par]
        eb[name] = b
    bpy.ops.object.mode_set(mode='OBJECT')
    arm.select_set(False)
    return arm


def heat_weights(mesh_ob, arm):
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    mesh_ob.select_set(True)
    arm.select_set(True)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.parent_set(type='ARMATURE_AUTO')
    mesh_ob.select_set(False)
    arm.select_set(False)


def capsule_weights(mesh_ob, bones, radius):
    """後備：以「到骨段的距離減去該段半徑」計算權重。"""
    me = mesh_ob.data
    groups = {name: mesh_ob.vertex_groups.get(name) or mesh_ob.vertex_groups.new(name=name) for name, *_ in bones}
    for v in me.vertices:
        p = V(v.co)
        ws = []
        for name, h, t, _ in bones:
            h, t = V(h), V(t)
            d = t - h
            k = max(0.0, min(1.0, (p - h).dot(d) / max(d.length_squared, 1e-9)))
            dist = (p - (h + d * k)).length - radius.get(name, 0.05)
            ws.append((max(dist, 0.004), name))
        ws.sort()
        tot = 0
        out = []
        for dist, name in ws[:4]:
            w = (ws[0][0] / dist) ** 6
            out.append((name, w))
            tot += w
        for name, w in out:
            groups[name].add([v.index], w / tot, 'REPLACE')


def transfer_weights(src, dst, names):
    for nm in names:
        if dst.vertex_groups.get(nm) is None:
            dst.vertex_groups.new(name=nm)
    m = dst.modifiers.new('dt', 'DATA_TRANSFER')
    m.object = src
    m.use_vert_data = True
    m.data_types_verts = {'VGROUP_WEIGHTS'}
    m.vert_mapping = 'POLYINTERP_NEAREST'
    m.layers_vgroup_select_src = 'ALL'
    m.layers_vgroup_select_dst = 'NAME'
    bpy.context.view_layer.objects.active = dst
    with bpy.context.temp_override(object=dst, active_object=dst):
        bpy.ops.object.modifier_apply(modifier=m.name)


def read_weights(ob, bone_names, allowed_by_grp=None, maxw=4):
    """回傳每個頂點 [(bone_index, weight)]（最多 4 個，總和 1）。allowed_by_grp：grp→允許骨名集合。"""
    me = ob.data
    gi = {g.index: g.name for g in ob.vertex_groups}
    bidx = {n: i for i, n in enumerate(bone_names)}
    grp = me.attributes['grp'].data if 'grp' in me.attributes else None
    out = []
    for v in me.vertices:
        allow = allowed_by_grp.get(grp[v.index].value) if (allowed_by_grp and grp) else None
        ws = []
        for g in v.groups:
            nm = gi.get(g.group)
            if nm in bidx and g.weight > 1e-4 and (allow is None or nm in allow):
                ws.append((g.weight, bidx[nm]))
        ws.sort(reverse=True)
        ws = ws[:maxw]
        if not ws:
            # 沒有可用權重：取允許清單裡的第一根骨
            fb = (sorted(allow)[0] if allow else bone_names[0])
            ws = [(1.0, bidx[fb])]
        tot = sum(w for w, _ in ws)
        out.append([(b, w / tot) for w, b in ws])
    return out


# ---------------------------------------------------------------- 遮蔽
def _hemi_dirs(n=32):
    dirs = []
    ga = math.pi * (3 - math.sqrt(5))
    for i in range(n):
        z = 1 - (i + 0.5) / n          # 均勻高度 → 餘弦加權近似
        r = math.sqrt(max(0, 1 - z * z))
        a = i * ga
        dirs.append(V((math.cos(a) * r, math.sin(a) * r, z)))
    return dirs


def ambient_occlusion(targets, blockers, dist=0.09, rays=28):
    """對 targets 的每個頂點沿法線半球射線，回傳 {ob.name: [ao 0..1]}。"""
    bm = bmesh.new()
    for o in blockers:
        tmp = bmesh.new()
        tmp.from_mesh(o.data)
        tmp.transform(o.matrix_world)
        me = bpy.data.meshes.new('tmp')
        tmp.to_mesh(me)
        tmp.free()
        bm.from_mesh(me)
        bpy.data.meshes.remove(me)
    tree = BVHTree.FromBMesh(bm)
    bm.free()
    H = _hemi_dirs(rays)
    res = {}
    for o in targets:
        vals = []
        na = o.data.attributes.get('nrm')
        for v in o.data.vertices:
            n = V(na.data[v.index].vector) if na else V(v.normal)
            p = V(v.co) + n * 0.0015
            t = V((1, 0, 0)) if abs(n.x) < 0.9 else V((0, 1, 0))
            b1 = n.cross(t).normalized()
            b2 = n.cross(b1)
            occ = 0.0
            for d in H:
                dd = b1 * d.x + b2 * d.y + n * d.z
                hit = tree.ray_cast(p, dd, dist)
                if hit[0] is not None:
                    occ += 1.0 - (hit[3] / dist) ** 0.7
            vals.append(max(0.0, 1.0 - occ / len(H) * 1.6))
        res[o.name] = vals
    return res


# ---------------------------------------------------------------- 匯出
def triangles(ob):
    me = ob.data
    me.calc_loop_triangles()
    idx = []
    for t in me.loop_triangles:
        idx.extend(t.vertices)
    return idx


def tri_count(ob):
    ob.data.calc_loop_triangles()
    return len(ob.data.loop_triangles)


def decimate(ob, target_tris):
    n = tri_count(ob)
    if n <= target_tris:
        return ob
    m = ob.modifiers.new('dec', 'DECIMATE')
    m.ratio = target_tris / n
    m.use_collapse_triangulate = True
    return bake(ob)


def recalc_normals(ob):
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(ob.data)
    bm.free()
    ob.data.update()
    return ob


def cut(ob, fn):
    """刪掉面中心滿足 fn(center, normal) 的面（開領口、袖口等）。"""
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    kill = [f for f in bm.faces if fn(f.calc_center_median(), f.normal)]
    bmesh.ops.delete(bm, geom=kill, context='FACES')
    loose = [v for v in bm.verts if not v.link_faces]
    bmesh.ops.delete(bm, geom=loose, context='VERTS')
    bm.to_mesh(ob.data)
    bm.free()
    ob.data.update()
    return ob


def boundary_chains(ob, pred):
    """回傳滿足 pred(co) 的邊界頂點座標。"""
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    pts = [V(v.co) for v in bm.verts if any(len(e.link_faces) == 1 for e in v.link_edges) and pred(v.co)]
    bm.free()
    return pts


def paint_ol(ob, fn):
    """fn(co) → 外框倍率或 None。"""
    me = ob.data
    O = me.attributes['ol'].data
    for i, v in enumerate(me.vertices):
        r = fn(V(v.co))
        if r is not None:
            O[i].value = r
    return ob


def fuse(objs, name, voxel=0.006, iters=8, factor=0.7, tris=None):
    """體素聯集＋平滑：把交疊的部件融成一張無接縫的皮膚（保留第一個部件的屬性值）。"""
    o = join(objs, name)
    m = o.modifiers.new('rm', 'REMESH')
    m.mode = 'VOXEL'
    m.voxel_size = voxel
    bake(o)
    if iters:
        sm = o.modifiers.new('sm', 'SMOOTH')
        sm.factor = factor
        sm.iterations = iters
        bake(o)
    if tris:
        decimate(o, tris)
    return o


def reproject_attrs(dst, src, names=('pal', 'mat', 'grp', 'ol')):
    """減面會把整數屬性內插糊掉：從減面前的網格（src）找最近點，把屬性複製回來。"""
    tree = BVHTree.FromObject(src, bpy.context.evaluated_depsgraph_get())
    sme = src.data
    dme = dst.data
    sv = sme.vertices
    for nm in names:
        if nm not in sme.attributes:
            continue
        typ = sme.attributes[nm].data_type
        sa = sme.attributes[nm].data
        da = _layer(dme, nm, typ).data
        for i, v in enumerate(dme.vertices):
            loc, _n, fi, _d = tree.find_nearest(V(v.co))
            if fi is None:
                continue
            poly = sme.polygons[fi]
            best = min(poly.vertices, key=lambda k: (V(sv[k].co) - loc).length_squared)
            da[i].value = sa[best].value


def decimate_keep(ob, target_tris):
    """減面並保留部件屬性。"""
    if tri_count(ob) <= target_tris:
        return ob
    src = bpy.data.objects.new(ob.name + '_src', ob.data.copy())
    bpy.context.scene.collection.objects.link(src)
    decimate(ob, target_tris)
    reproject_attrs(ob, src)
    bpy.data.meshes.remove(src.data)
    return ob


def crisp_split(ob):
    """讓顏色交界銳利：沿面顏色（fpal／fmat）不同的邊切開，再把面顏色寫回頂點。先把平滑法線存進 nrm，切開後不會出現摺痕。"""
    me = ob.data
    nrm = me.attributes.get('nrm') or me.attributes.new('nrm', 'FLOAT_VECTOR', 'POINT')
    for i, v in enumerate(me.vertices):
        nrm.data[i].vector = v.normal
    bm = bmesh.new()
    bm.from_mesh(me)
    lp = bm.verts.layers.int.get('pal')
    lm = bm.verts.layers.int.get('mat')
    fp = bm.faces.layers.int.get('fpal')
    fm = bm.faces.layers.int.get('fmat')
    key = lambda f: (f[fp], f[fm])
    edges = [e for e in bm.edges if len(e.link_faces) == 2 and key(e.link_faces[0]) != key(e.link_faces[1])]
    if edges:
        bmesh.ops.split_edges(bm, edges=edges)
    for f in bm.faces:
        for v in f.verts:
            v[lp] = f[fp]
            v[lm] = f[fm]
    bm.to_mesh(me)
    bm.free()
    me.update()
    return ob


def face_normals(ob, c, hr, k=0.75):
    """動畫臉的平滑陰影：皮膚（mat 4）頂點的法線往「頭心後方一點」的放射方向靠，臉上不會出現破碎的明暗塊。"""
    me = ob.data
    nrm = me.attributes['nrm'].data
    M = me.attributes['mat'].data
    o = V(c) + V((0, -hr * 0.15, -hr * 0.45))
    for i, v in enumerate(me.vertices):
        if M[i].value != 4:
            continue
        p = V(v.co)
        rad = V(((p.x - o.x) * 1.0, (p.y - o.y) * 0.8, (p.z - o.z) * 1.0)).normalized()
        n = V(nrm[i].vector)
        # 只處理正面（臉）；耳後與後腦維持原法線
        w = k * smooth((p.z - (c[2] - hr * 0.1)) / (hr * 0.5))
        nrm[i].vector = n.lerp(rad, w).normalized()
