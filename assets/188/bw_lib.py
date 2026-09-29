# 188 彩筆曠野：Blender 建模共用工具（給 build_*.py 匯入）
# 一律用 three.js 的座標寫（y 朝上、角色面向 +z），V() 轉成 Blender 座標；匯出時 glTF 會轉回 y 朝上。
import bpy, bmesh, math, os, random
import numpy as np
from mathutils import Vector, Matrix, Quaternion, Euler, noise

HERE = os.path.dirname(os.path.abspath(__file__))
TAU = math.pi * 2


def V(x, y, z):
    return Vector((x, -z, y))


def T(v):  # Blender → three
    return (v.x, v.z, -v.y)


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.cycles.samples = 24
    sc.render.fps = 30
    return sc


def srgb2lin(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def hexrgb(h):
    if isinstance(h, (tuple, list)):
        return tuple(h)
    return ((h >> 16 & 255) / 255, (h >> 8 & 255) / 255, (h & 255) / 255)


def mix(a, b, t):
    a, b = hexrgb(a), hexrgb(b)
    t = max(0.0, min(1.0, t))
    return tuple(a[i] + (b[i] - a[i]) * t for i in range(3))


def sstep(a, b, x):
    t = max(0.0, min(1.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


# ── 材質：只有名稱與預覽用的頂點色節點，網頁端會依名稱換成自己的材質 ──
def mat(name):
    m = bpy.data.materials.get(name)
    if m:
        return m
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes.get('Principled BSDF')
    ca = nt.nodes.new('ShaderNodeVertexColor')
    ca.layer_name = 'Col'
    nt.links.new(ca.outputs['Color'], bsdf.inputs['Base Color'])
    bsdf.inputs['Roughness'].default_value = 0.8
    return m


# ── 網格建構 ──
def obj_from_bm(bm, name, pivot=(0, 0, 0), slot='fixed'):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    ob.location = V(*pivot)
    me.materials.append(mat(slot))
    for p in me.polygons:
        p.use_smooth = True
    return ob


def lathe(name, prof, seg=24, sx=1.0, sz=1.0, pivot=(0, 0, 0), off=(0, 0, 0), slot='fixed', cap_top=True, cap_bot=True, wobble=None):
    """繞 y 軸旋轉的輪廓：prof = [(半徑, 高度), …] 由下往上；sx/sz 讓截面變橢圓。座標相對 pivot。"""
    bm = bmesh.new()
    rings = []
    for (r, y) in prof:
        ring = []
        for i in range(seg):
            a = i / seg * TAU
            rr = r * (1 + (wobble(a, y) if wobble else 0))
            ring.append(bm.verts.new(V(off[0] + math.cos(a) * rr * sx, off[1] + y, off[2] + math.sin(a) * rr * sz)))
        rings.append(ring)
    for k in range(len(rings) - 1):
        for i in range(seg):
            a, b = rings[k][i], rings[k][(i + 1) % seg]
            c, d = rings[k + 1][(i + 1) % seg], rings[k + 1][i]
            bm.faces.new((a, d, c, b))
    if cap_bot and prof[0][0] > 1e-4:
        bm.faces.new(list(reversed(rings[0])))
    if cap_top and prof[-1][0] > 1e-4:
        bm.faces.new(rings[-1])
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return obj_from_bm(bm, name, pivot, slot)


def ellipsoid(name, c, r, seg=20, rings=14, pivot=(0, 0, 0), slot='fixed'):
    """c 與 r 都是 three 座標（中心相對 pivot、三軸半徑）"""
    prof = []
    for k in range(rings + 1):
        t = k / rings
        ang = -math.pi / 2 + t * math.pi
        prof.append((math.cos(ang), math.sin(ang)))
    bm = bmesh.new()
    rs = []
    for (cr, sy) in prof:
        ring = []
        n = 1 if cr < 1e-6 else seg
        for i in range(n):
            a = i / seg * TAU
            ring.append(bm.verts.new(V(c[0] + math.cos(a) * cr * r[0], c[1] + sy * r[1], c[2] + math.sin(a) * cr * r[2])))
        rs.append(ring)
    for k in range(len(rs) - 1):
        A, B = rs[k], rs[k + 1]
        if len(A) == 1:
            for i in range(seg):
                bm.faces.new((A[0], B[(i + 1) % seg], B[i]))
        elif len(B) == 1:
            for i in range(seg):
                bm.faces.new((A[i], A[(i + 1) % seg], B[0]))
        else:
            for i in range(seg):
                bm.faces.new((A[i], A[(i + 1) % seg], B[(i + 1) % seg], B[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return obj_from_bm(bm, name, pivot, slot)


def tube(name, pts, radii, seg=12, pivot=(0, 0, 0), slot='fixed', caps=True, flat=1.0, up=(0, 1, 0)):
    """沿折線掃出圓管；pts 為 three 座標（相對 pivot），radii 可為常數或每點半徑"""
    P = [Vector(p) for p in pts]
    if not isinstance(radii, (list, tuple)):
        radii = [radii] * len(P)
    bm = bmesh.new()
    rings = []
    upv = Vector(up)
    prev_n = None
    for k, p in enumerate(P):
        if k == 0:
            t = (P[1] - P[0]).normalized()
        elif k == len(P) - 1:
            t = (P[-1] - P[-2]).normalized()
        else:
            t = ((P[k + 1] - P[k]).normalized() + (P[k] - P[k - 1]).normalized()).normalized()
        if prev_n is None:
            n = upv - t * upv.dot(t)
            if n.length < 1e-4:
                n = Vector((1, 0, 0)) - t * t.x
            n.normalize()
        else:
            n = prev_n - t * prev_n.dot(t)
            n.normalize()
        prev_n = n
        b = t.cross(n)
        ring = []
        for i in range(seg):
            a = i / seg * TAU
            q = p + (n * math.cos(a) * flat + b * math.sin(a)) * radii[k]
            ring.append(bm.verts.new(V(*q)))
        rings.append(ring)
    for k in range(len(rings) - 1):
        for i in range(seg):
            bm.faces.new((rings[k][i], rings[k][(i + 1) % seg], rings[k + 1][(i + 1) % seg], rings[k + 1][i]))
    if caps:
        if radii[0] > 1e-4:
            bm.faces.new(list(reversed(rings[0])))
        if radii[-1] > 1e-4:
            bm.faces.new(rings[-1])
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return obj_from_bm(bm, name, pivot, slot)


def rbox(name, c, s, bevel=0.1, seg=3, pivot=(0, 0, 0), slot='fixed'):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        x, y, z = T(v.co)
        v.co = V(c[0] + x * s[0], c[1] + y * s[1], c[2] + z * s[2])
    if bevel > 0:
        bmesh.ops.bevel(bm, geom=list(bm.verts) + list(bm.edges), offset=bevel, segments=seg, affect='EDGES', profile=0.5)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return obj_from_bm(bm, name, pivot, slot)


def ico(name, c, r, sub=2, pivot=(0, 0, 0), slot='fixed'):
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=sub, radius=1.0)
    for v in bm.verts:
        x, y, z = T(v.co)
        v.co = V(c[0] + x * r[0], c[1] + y * r[1], c[2] + z * r[2])
    return obj_from_bm(bm, name, pivot, slot)


# ── 形變 ──
def each_vert(ob, fn):
    """fn(p) 以 three 座標（物件區域）傳入，回傳新座標"""
    me = ob.data
    for v in me.vertices:
        p = Vector(T(v.co))
        q = fn(p)
        if q is not None:
            v.co = V(*q)
    me.update()


def displace(ob, amp, freq, seed=0, octaves=3):
    me = ob.data
    me.calc_loop_triangles()
    nrm = [v.normal.copy() for v in me.vertices]
    for i, v in enumerate(me.vertices):
        p = v.co * freq + Vector((seed * 7.1, seed * 3.3, seed * 1.7))
        d = noise.fractal(p, 0.6, 2.0, octaves, noise_basis='PERLIN_ORIGINAL')
        v.co = v.co + nrm[i] * d * amp
    me.update()


def subsurf(ob, levels=1):
    m = ob.modifiers.new('sub', 'SUBSURF')
    m.levels = levels
    m.render_levels = levels
    apply_mods(ob)


def apply_mods(ob):
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    bpy.context.view_layer.objects.active = ob
    ob.select_set(True)
    for m in list(ob.modifiers):
        bpy.ops.object.modifier_apply(modifier=m.name)


def decimate(ob, ratio):
    m = ob.modifiers.new('dec', 'DECIMATE')
    m.ratio = ratio
    apply_mods(ob)


def smooth(ob, angle=None):
    for p in ob.data.polygons:
        p.use_smooth = True


# ── 上色 ──
def paint(ob, fn):
    """fn(p_three, n_three) → sRGB (r,g,b)；寫進 POINT 網域的 Col"""
    me = ob.data
    col = me.color_attributes.get('Col') or me.color_attributes.new('Col', 'FLOAT_COLOR', 'POINT')
    me.color_attributes.active_color = col
    mw = ob.matrix_world
    arr = np.zeros(len(me.vertices) * 4, dtype=np.float32)
    for i, v in enumerate(me.vertices):
        p = Vector(T(mw @ v.co))
        n = Vector(T((mw.to_3x3() @ v.normal).normalized()))
        c = fn(p, n)
        c = hexrgb(c) if not isinstance(c, tuple) else c
        arr[i * 4:i * 4 + 4] = (srgb2lin(c[0]), srgb2lin(c[1]), srgb2lin(c[2]), 1.0)
    col.data.foreach_set('color', arr)


def solid(ob, h, var=0.03, seed=1):
    c = hexrgb(h)

    def fn(p, n):
        k = 1 + (noise.noise(p * 6 + Vector((seed, seed, seed)))) * var * 2
        return tuple(max(0, min(1, x * k)) for x in c)
    paint(ob, fn)


def ao_bake(objs, samples=24, strength=1.0, floor=0.35):
    """Cycles AO 烘焙到第二組頂點色，再乘回 Col（保留 floor 以上的亮度，避免死黑）"""
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
            a = np.zeros(len(me.vertices) * 4, dtype=np.float32)
            ao.data.foreach_get('color', a)
            b = np.zeros_like(a)
            me.color_attributes['Col'].data.foreach_get('color', b)
            a = a.reshape(-1, 4)[:, :3]
            k = floor + (1 - floor) * np.clip(a, 0, 1) ** strength
            b = b.reshape(-1, 4)
            b[:, :3] *= k
            me.color_attributes['Col'].data.foreach_set('color', b.ravel())
        except Exception as e:
            print('AO bake failed for', ob.name, e)
        me.color_attributes.remove(me.color_attributes['AO'])
        me.color_attributes.active_color = me.color_attributes['Col']


def join(objs, name):
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    ob = bpy.context.active_object
    ob.name = name
    ob.data.name = name
    return ob


def set_parent(child, parent, keep=True):
    bpy.context.view_layer.update()
    mw = child.matrix_world.copy()
    child.parent = parent
    if keep:
        child.matrix_world = mw


def empty(name, pos=(0, 0, 0), parent=None):
    e = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(e)
    e.location = V(*pos)
    bpy.context.view_layer.update()
    if parent:
        set_parent(e, parent)
    return e


def origin_to(ob, pos):
    """把物件原點移到 pos（three 世界座標），網格不動"""
    bpy.context.view_layer.update()
    target = V(*pos)
    delta = ob.matrix_world.inverted() @ target
    ob.data.transform(Matrix.Translation(-delta))
    ob.matrix_world = ob.matrix_world @ Matrix.Translation(delta)


def tri_count(objs):
    n = 0
    for o in objs:
        if o.type == 'MESH':
            o.data.calc_loop_triangles()
            n += len(o.data.loop_triangles)
    return n


# ── 骨架與權重 ──
def armature(name, bones):
    """bones = [(名稱, head, tail, parent)]，座標為 three 座標"""
    arm = bpy.data.armatures.new(name)
    ob = bpy.data.objects.new(name, arm)
    bpy.context.scene.collection.objects.link(ob)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.mode_set(mode='EDIT')
    for (n, h, t, par) in bones:
        b = arm.edit_bones.new(n)
        b.head = V(*h)
        b.tail = V(*t)
        if par:
            b.parent = arm.edit_bones[par]
            if (arm.edit_bones[par].tail - b.head).length < 1e-4:
                b.use_connect = True
    bpy.ops.object.mode_set(mode='OBJECT')
    return ob


def seg_dist(p, a, b):
    ab = b - a
    t = max(0.0, min(1.0, (p - a).dot(ab) / max(ab.dot(ab), 1e-9)))
    return (p - (a + ab * t)).length


def skin(ob, rig, bones, power=5.0, top=3):
    """距離式權重：每個頂點依到骨段的距離，只在允許的骨頭間分配（bones 為 [名稱…]，單一名稱則整塊跟著動）"""
    bpy.context.view_layer.update()
    mw = ob.matrix_world
    arm = rig.data
    segs = {b: (rig.matrix_world @ arm.bones[b].head_local, rig.matrix_world @ arm.bones[b].tail_local) for b in bones}
    groups = {b: (ob.vertex_groups.get(b) or ob.vertex_groups.new(name=b)) for b in bones}
    for v in ob.data.vertices:
        p = mw @ v.co
        if len(bones) == 1:
            groups[bones[0]].add([v.index], 1.0, 'REPLACE')
            continue
        ws = []
        for b in bones:
            d = seg_dist(p, *segs[b])
            ws.append((1.0 / (d + 0.012) ** power, b))
        ws.sort(reverse=True)
        ws = ws[:top]
        s = sum(w for w, _ in ws)
        for w, b in ws:
            if w / s > 0.01:
                groups[b].add([v.index], w / s, 'REPLACE')


def bind(ob, rig):
    mw = ob.matrix_world.copy()
    ob.parent = rig
    ob.matrix_world = mw
    m = ob.modifiers.new('Armature', 'ARMATURE')
    m.object = rig


# ── 動作：旋轉以 three 座標軸（角度）表示，相對靜止姿勢，由父骨帶動 ──
def _local_q(rig, bone, rx, ry, rz, order='XYZ'):
    b = rig.data.bones[bone]
    Rb = b.matrix_local.to_3x3()
    # three 的 x/y/z 軸 → Blender 的 X/Z/-Y；先轉 z（側傾）再 x（前後）最後 y（左右轉）
    Q = Matrix.Rotation(math.radians(ry), 3, 'Z') @ Matrix.Rotation(math.radians(rx), 3, 'X') @ Matrix.Rotation(math.radians(-rz), 3, 'Y')
    L = Rb.inverted() @ Q @ Rb
    return L.to_quaternion()


def action(rig, name, keys, loc_keys=None, loop=True):
    """keys = {frame: {bone: (rx, ry, rz)}}；loc_keys = {frame: {bone: (dx, dy, dz)}}（three 座標位移）"""
    act = bpy.data.actions.new(name)
    act.use_fake_user = True
    rig.animation_data_create()
    rig.animation_data.action = act
    # 每段動作都記錄全部骨頭，網頁切換動作時才不會殘留上一段的姿勢
    bones_used = set(pb.name for pb in rig.pose.bones)
    for pb in rig.pose.bones:
        pb.rotation_mode = 'QUATERNION'
        pb.rotation_quaternion = (1, 0, 0, 0)
        pb.location = (0, 0, 0)
    frames = sorted(set(list(keys.keys()) + list((loc_keys or {}).keys())))
    for fr in frames:
        for bn in bones_used:
            pb = rig.pose.bones[bn]
            r = keys.get(fr, {}).get(bn)
            if r is None and fr in keys:
                r = (0, 0, 0)
            if r is not None:
                pb.rotation_quaternion = _local_q(rig, bn, *r)
                pb.keyframe_insert('rotation_quaternion', frame=fr)
            if fr in keys or (loc_keys and fr in loc_keys):
                d = (loc_keys or {}).get(fr, {}).get(bn, (0, 0, 0))
                b = rig.data.bones[bn]
                Rb = b.matrix_local.to_3x3()
                pb.location = Rb.inverted() @ V(*d)
                pb.keyframe_insert('location', frame=fr)
    tr = rig.animation_data.nla_tracks.new()
    tr.name = name
    tr.strips.new(name, int(frames[0]), act)
    rig.animation_data.action = None
    return act


# ── 匯出與預覽 ──
def export(path, objs):
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    sel = set()

    def add(o):
        sel.add(o)
        for c in o.children:
            add(c)
    for o in objs:
        add(o)
    for o in sel:
        o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_vertex_color='ACTIVE',
                              export_animation_mode='ACTIONS', export_apply=False, export_yup=True, export_texcoords=False,
                              export_normals=True, export_materials='EXPORT', export_image_format='NONE')
    print('exported', path, os.path.getsize(path) // 1024, 'KB')


def preview(path, target=(0, 1, 0), dist=5.0, yaw=30, pitch=12, res=(640, 640), ortho=None):
    sc = bpy.context.scene
    old = sc.render.engine
    sc.render.engine = 'BLENDER_WORKBENCH'
    sc.display.shading.light = 'STUDIO'
    sc.display.shading.color_type = 'VERTEX'
    sc.display.shading.show_shadows = True
    sc.display.shading.show_cavity = False
    sc.render.resolution_x, sc.render.resolution_y = res
    sc.render.film_transparent = False
    if not sc.world:
        sc.world = bpy.data.worlds.new('W')
    cam = bpy.data.objects.get('PreviewCam')
    if not cam:
        cam = bpy.data.objects.new('PreviewCam', bpy.data.cameras.new('PreviewCam'))
        sc.collection.objects.link(cam)
    t = Vector(target)
    a, p = math.radians(yaw), math.radians(pitch)
    pos = t + Vector((math.sin(a) * math.cos(p), math.sin(p), math.cos(a) * math.cos(p))) * dist
    cam.location = V(*pos)
    d = (V(*t) - V(*pos)).normalized()
    cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    cam.data.lens = 50
    if ortho:
        cam.data.type = 'ORTHO'
        cam.data.ortho_scale = ortho
    else:
        cam.data.type = 'PERSP'
    sc.camera = cam
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)
    sc.render.engine = old


def place(ob, pos, rot=(0, 0, 0)):
    """以 three 座標設定物件位置與旋轉（rot 為三軸角度，順序同動作）"""
    Q = Matrix.Rotation(math.radians(rot[1]), 3, 'Z') @ Matrix.Rotation(math.radians(rot[0]), 3, 'X') @ Matrix.Rotation(math.radians(-rot[2]), 3, 'Y')
    ob.matrix_world = Matrix.Translation(V(*pos)) @ Q.to_4x4()


def parent_bone(ob, rig, bone):
    mw = ob.matrix_world.copy()
    ob.parent = rig
    ob.parent_type = 'BONE'
    ob.parent_bone = bone
    bpy.context.view_layer.update()
    ob.matrix_world = mw


def dice(ob, cuts=3):
    """平均切細（不平滑），讓大平面的頂點色與 AO 有足夠的取樣點"""
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=cuts, use_grid_fill=True)
    bm.to_mesh(ob.data)
    bm.free()
