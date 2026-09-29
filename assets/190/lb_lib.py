# 190 封頂：Blender 建模共用工具（給 build_*.py 匯入）
# 座標一律用 three.js 的寫法（y 朝上、角色與車頭面向 +z），V() 轉成 Blender 座標；glTF 匯出時轉回 y 朝上。
# 材質名稱就是「部位角色」：shirt / vis / pants / skin / glove / hair / paint 由網頁依調色盤上色（這裡塗白色 × AO），
# 其他一律叫 fixed，頂點色就是最終顏色。
import bpy, bmesh, math, os
import numpy as np
from mathutils import Vector, Matrix, Euler, noise

TAU = math.pi * 2
ROLES = ('shirt', 'vis', 'pants', 'skin', 'glove', 'hair', 'paint')


def V(x, y, z):
    return Vector((x, -z, y))


def T(v):
    return Vector((v.x, v.z, -v.y))


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.cycles.samples = 32
    sc.world = bpy.data.worlds.new('W')
    sc.world.light_settings.distance = 0.35
    return sc


def srgb2lin(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def hexrgb(h):
    return ((h >> 16 & 255) / 255, (h >> 8 & 255) / 255, (h & 255) / 255)


_MATS = {}


def mat(name):
    if name in _MATS:
        return _MATS[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes.get('Principled BSDF')
    ca = nt.nodes.new('ShaderNodeVertexColor')
    ca.layer_name = 'Col'
    nt.links.new(ca.outputs['Color'], bsdf.inputs['Base Color'])
    bsdf.inputs['Roughness'].default_value = 0.75
    _MATS[name] = m
    return m


# ── 以 three 座標建 bmesh，最後套變換並轉成物件 ──
def rot_m(r):
    # 與 three 的 Euler 'XYZ' 相同：先 z、再 y、最後 x
    return Euler(r, 'ZYX').to_matrix() if r else Matrix.Identity(3)


def finish(bm, name, role, color, at=(0, 0, 0), rot=None, smooth=True, var=0.0, seed=0):
    """bm 的頂點座標是 three 座標；轉成 Blender 物件並塗上顏色（role 為調色盤部位時塗白）"""
    R = rot_m(rot)
    at = Vector(at)
    for v in bm.verts:
        v.co = V(*(R @ Vector(v.co) + at))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    me.materials.append(mat(role if role in ROLES or role == 'glass' else 'fixed'))
    for p in me.polygons:
        p.use_smooth = smooth
    c = (1.0, 1.0, 1.0) if role in ROLES else hexrgb(color)
    paint(ob, lambda p, n: tuple(max(0, min(1, x * (1 + noise.noise(p * 9 + Vector((seed, seed * 2, 3))) * var))) for x in c))
    return ob


def bm_lathe(prof, seg=20, sx=1.0, sz=1.0, cap_top=True, cap_bot=True, a0=0.0, a1=TAU, rfn=None):
    """繞 y 軸的輪廓 prof=[(半徑, 高度)…]；a0..a1 可只做一段弧（不閉合）"""
    bm = bmesh.new()
    full = abs(a1 - a0 - TAU) < 1e-6
    n = seg if full else seg + 1
    rings = []
    for (r, y) in prof:
        ring = []
        for i in range(n):
            a = a0 + (a1 - a0) * i / seg
            rr = r * (rfn(a, y) if rfn else 1)
            ring.append(bm.verts.new((math.sin(a) * rr * sx, y, math.cos(a) * rr * sz)))
        rings.append(ring)
    for k in range(len(rings) - 1):
        for i in range(seg):
            j = (i + 1) % n
            bm.faces.new((rings[k][i], rings[k][j], rings[k + 1][j], rings[k + 1][i]))
    if full:
        if cap_bot and prof[0][0] > 1e-4:
            bm.faces.new(list(reversed(rings[0])))
        if cap_top and prof[-1][0] > 1e-4:
            bm.faces.new(rings[-1])
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    return bm


def bm_ell(r, seg=16, rings=10):
    prof = []
    for k in range(rings + 1):
        ang = -math.pi / 2 + k / rings * math.pi
        prof.append((max(1e-5, math.cos(ang)), math.sin(ang)))
    bm = bm_lathe([(p[0], p[1]) for p in prof], seg, cap_top=False, cap_bot=False)
    for v in bm.verts:
        v.co = Vector((v.co.x * r[0], v.co.y * r[1], v.co.z * r[2]))
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    return bm


def bm_box(s, bevel=0.0, seg=2):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co = Vector((v.co.x * s[0], v.co.y * s[1], v.co.z * s[2]))
    if bevel > 0:
        b = min(bevel, min(s) * 0.49)
        bmesh.ops.bevel(bm, geom=list(bm.verts) + list(bm.edges), offset=b, segments=seg, affect='EDGES', profile=0.5)
    return bm


def bm_tube(pts, radii, seg=10, caps=True, flat=1.0, up=(0, 1, 0)):
    P = [Vector(p) for p in pts]
    if not isinstance(radii, (list, tuple)):
        radii = [radii] * len(P)
    bm = bmesh.new()
    rings = []
    prev = None
    for k, p in enumerate(P):
        if k == 0:
            t = (P[1] - P[0]).normalized()
        elif k == len(P) - 1:
            t = (P[-1] - P[-2]).normalized()
        else:
            t = ((P[k + 1] - P[k]).normalized() + (P[k] - P[k - 1]).normalized()).normalized()
        if prev is None:
            u = Vector(up)
            n = u - t * u.dot(t)
            if n.length < 1e-4:
                n = Vector((1, 0, 0)) - t * t.x
        else:
            n = prev - t * prev.dot(t)
        n.normalize()
        prev = n
        b = t.cross(n)
        ring = [bm.verts.new(p + (n * math.cos(i / seg * TAU) * flat + b * math.sin(i / seg * TAU)) * radii[k]) for i in range(seg)]
        rings.append(ring)
    for k in range(len(rings) - 1):
        for i in range(seg):
            bm.faces.new((rings[k][i], rings[k][(i + 1) % seg], rings[k + 1][(i + 1) % seg], rings[k + 1][i]))
    if caps:
        bm.faces.new(list(reversed(rings[0])))
        bm.faces.new(rings[-1])
    return bm


def bm_loft(sections, cap=True):
    """sections：每段同點數的截面（three 座標、依序環繞）"""
    bm = bmesh.new()
    rings = [[bm.verts.new(Vector(p)) for p in sec] for sec in sections]
    n = len(sections[0])
    for k in range(len(rings) - 1):
        for i in range(n):
            bm.faces.new((rings[k][i], rings[k][(i + 1) % n], rings[k + 1][(i + 1) % n], rings[k + 1][i]))
    if cap:
        bm.faces.new(list(reversed(rings[0])))
        bm.faces.new(rings[-1])
    return bm


def rrect(cx, cy, w, h, r, z, n=3):
    """圓角矩形截面（xy 平面、位於 z）"""
    pts = []
    r = min(r, w / 2 - 1e-4, h / 2 - 1e-4)
    for (qx, qy, a0) in ((w / 2 - r, h / 2 - r, 0), (-(w / 2 - r), h / 2 - r, 90), (-(w / 2 - r), -(h / 2 - r), 180), (w / 2 - r, -(h / 2 - r), 270)):
        for i in range(n + 1):
            a = math.radians(a0 + 90 * i / n)
            pts.append((cx + qx + math.cos(a) * r, cy + qy + math.sin(a) * r, z))
    return pts


# 方便的包裝：直接得到物件
def box(name, role, color, c, s, bevel=0.01, rot=None, seg=2, smooth=False, var=0.04):
    return finish(bm_box(s, bevel, seg), name, role, color, c, rot, smooth, var)


def lathe(name, role, color, prof, at=(0, 0, 0), seg=20, sx=1, sz=1, rot=None, var=0.04, **kw):
    return finish(bm_lathe(prof, seg, sx, sz, **kw), name, role, color, at, rot, True, var)


def ell(name, role, color, c, r, seg=16, rings=10, rot=None, var=0.04):
    return finish(bm_ell(r, seg, rings), name, role, color, c, rot, True, var)


def tube(name, role, color, pts, radii, seg=10, caps=True, flat=1.0, var=0.04, smooth=True):
    return finish(bm_tube(pts, radii, seg, caps, flat), name, role, color, (0, 0, 0), None, smooth, var)


def cyl(name, role, color, a, b, r, seg=16, var=0.03):
    return tube(name, role, color, [a, b], r, seg, True, 1.0, var, smooth=True)


def loft(name, role, color, sections, var=0.04, smooth=True, cap=True):
    return finish(bm_loft(sections, cap), name, role, color, (0, 0, 0), None, smooth, var)


# ── 上色 ──
def paint(ob, fn):
    me = ob.data
    col = me.color_attributes.get('Col') or me.color_attributes.new('Col', 'FLOAT_COLOR', 'POINT')
    me.color_attributes.active_color = col
    mw = ob.matrix_world
    arr = np.zeros(len(me.vertices) * 4, dtype=np.float32)
    for i, v in enumerate(me.vertices):
        p = T(mw @ v.co)
        n = T((mw.to_3x3() @ v.normal).normalized())
        c = fn(p, n)
        arr[i * 4:i * 4 + 4] = (srgb2lin(c[0]), srgb2lin(c[1]), srgb2lin(c[2]), 1.0)
    col.data.foreach_set('color', arr)


def recolor(ob, fn):
    """依位置改顏色（保留原本的材質角色）：fn(p, n, 原色 sRGB) → sRGB 或 None"""
    me = ob.data
    col = me.color_attributes['Col']
    a = np.zeros(len(me.vertices) * 4, dtype=np.float32)
    col.data.foreach_get('color', a)
    mw = ob.matrix_world
    for i, v in enumerate(me.vertices):
        p = T(mw @ v.co)
        n = T((mw.to_3x3() @ v.normal).normalized())
        r = fn(p, n)
        if r is not None:
            a[i * 4:i * 4 + 3] = [srgb2lin(x) for x in r]
    col.data.foreach_set('color', a)


def ao_bake(objs, samples=32, floor=0.38, strength=1.0):
    sc = bpy.context.scene
    sc.cycles.samples = samples
    for ob in objs:
        me = ob.data
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
            k = floor + (1 - floor) * np.clip(a.reshape(-1, 4)[:, :3], 0, 1) ** strength
            b = b.reshape(-1, 4)
            b[:, :3] *= k
            me.color_attributes['Col'].data.foreach_set('color', b.ravel())
        except Exception as e:
            print('AO bake failed', ob.name, e)
        me.color_attributes.remove(me.color_attributes['AO'])
        me.color_attributes.active_color = me.color_attributes['Col']


def join(objs, name):
    objs = [o for o in objs if o]
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    if len(objs) > 1:
        bpy.ops.object.join()
    ob = bpy.context.active_object
    ob.name = name
    ob.data.name = name
    return ob


def smooth_by_angle(ob, deg=40):
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    try:
        bpy.ops.object.shade_smooth_by_angle(angle=math.radians(deg))
    except Exception:
        try:
            bpy.ops.object.shade_auto_smooth(angle=math.radians(deg))
        except Exception as e:
            print('smooth by angle unavailable', e)


def origin_to(ob, pos):
    """原點移到 pos（three 世界座標），網格不動"""
    bpy.context.view_layer.update()
    target = V(*pos)
    delta = ob.matrix_world.inverted() @ target
    ob.data.transform(Matrix.Translation(-delta))
    ob.matrix_world = ob.matrix_world @ Matrix.Translation(delta)


def move(ob, d):
    ob.location = ob.location + V(*d)
    bpy.context.view_layer.update()


def tri_count(objs):
    n = 0
    for o in objs:
        o.data.calc_loop_triangles()
        n += len(o.data.loop_triangles)
    return n


def export(path, objs):
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    for o in objs:
        o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_vertex_color='ACTIVE',
                              export_animation_mode='ACTIONS', export_apply=False, export_yup=True, export_texcoords=False,
                              export_normals=True, export_materials='EXPORT', export_image_format='NONE')
    print('exported', path, os.path.getsize(path) // 1024, 'KB')


def preview(path, target=(0, 1, 0), dist=5.0, yaw=30, pitch=12, res=(900, 600), lens=50):
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_WORKBENCH'
    sc.display.shading.light = 'STUDIO'
    sc.display.shading.color_type = 'VERTEX'
    sc.display.shading.show_shadows = True
    sc.render.resolution_x, sc.render.resolution_y = res
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
    cam.data.lens = lens
    sc.camera = cam
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)
    sc.render.engine = 'CYCLES'
