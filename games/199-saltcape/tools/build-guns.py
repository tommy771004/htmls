"""用 Blender 建六把槍，輸出 ../../assets/199/models/guns.glb（物件名 p9 / smg / ar / sg / dmr / sr）。

    blender -b -P tools/build-guns.py

座標與前端 gunGeometry 一致：原點在握把上緣，-Z 朝槍口、+Y 朝上，單位公尺；匯出時不轉軸（Y 已朝上）。
槍托、握把、彈匣、滑套等用側面輪廓擠出再倒角，管件用圓柱，瞄具用車床輪廓旋轉。
材質名對應前端：metal（槍管與金屬件）、poly（聚合物）、wood（迷彩護木／槍托）、tan（沙色槍身）、glass（鏡片）。
"""
import math
import os
import bpy
import bmesh
from mathutils import Matrix, Vector

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.normpath(os.path.join(ROOT, '../../assets/199/models/guns.glb'))
bpy.ops.wm.read_factory_settings(use_empty=True)


def mat(name, color, rough, metal=0.0):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    b = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    b.inputs['Base Color'].default_value = (*color, 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    return m


METAL = mat('metal', (0.07, 0.07, 0.07), 0.35, 0.8)
POLY = mat('poly', (0.1, 0.1, 0.09), 0.7)
WOOD = mat('wood', (0.3, 0.4, 0.22), 0.6)
TAN = mat('tan', (0.5, 0.43, 0.3), 0.7)
GLASS = mat('glass', (0.6, 0.15, 0.05), 0.08)


def finish(o, material, bevel=0.0, smooth=False):
    o.data.materials.append(material)
    if bevel:
        md = o.modifiers.new('bv', 'BEVEL'); md.width = bevel; md.segments = 2; md.limit_method = 'ANGLE'; md.angle_limit = math.radians(40)
    if smooth:
        for p in o.data.polygons:
            p.use_smooth = True
    return o


def new_obj(name, bm):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    return o


def profile(pts, thick, material, x=0.0, bevel=0.004):
    """側面輪廓（z, y）在 YZ 平面成面，沿 X 擠出 thick"""
    bm = bmesh.new()
    vs = [bm.verts.new((x - thick / 2, y, z)) for z, y in pts]
    f = bm.faces.new(vs)
    bmesh.ops.recalc_face_normals(bm, faces=[f])
    r = bmesh.ops.extrude_face_region(bm, geom=[f])
    moved = [e for e in r['geom'] if isinstance(e, bmesh.types.BMVert)]
    bmesh.ops.translate(bm, verts=moved, vec=(thick, 0, 0))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return finish(new_obj('p', bm), material, bevel)


def box(sx, sy, sz, loc, material, bevel=0.003):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1)
    for v in bm.verts:
        v.co = Vector((v.co.x * sx + loc[0], v.co.y * sy + loc[1], v.co.z * sz + loc[2]))
    return finish(new_obj('b', bm), material, bevel)


def tube(r, z0, z1, y, material, x=0.0, seg=20, r2=None, bevel=0.0):
    """沿 Z 的圓柱（z0→z1）"""
    bm = bmesh.new()
    L = abs(z1 - z0)
    bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=r, radius2=r if r2 is None else r2, depth=L)
    # create_cone 本來就沿 Z 軸
    bmesh.ops.translate(bm, verts=bm.verts, vec=(x, y, (z0 + z1) / 2))
    o = finish(new_obj('t', bm), material, bevel, True)
    return o


def lathe(prof, y, material, x=0.0, seg=28):
    """車床：prof = [(z, 半徑)…]，繞 Z 軸旋轉成實體（瞄準鏡）"""
    bm = bmesh.new()
    rings = []
    for z, r in prof:
        ring = [bm.verts.new((x + r * math.cos(a), y + r * math.sin(a), z)) for a in [i / seg * math.pi * 2 for i in range(seg)]]
        rings.append(ring)
    for i in range(len(rings) - 1):
        for k in range(seg):
            bm.faces.new((rings[i][k], rings[i][(k + 1) % seg], rings[i + 1][(k + 1) % seg], rings[i + 1][k]))
    bm.faces.new(rings[0][::-1]); bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return finish(new_obj('l', bm), material, 0, True)


def join(name, parts):
    bpy.ops.object.select_all(action='DESELECT')
    for p in parts:
        bpy.context.view_layer.objects.active = p
        p.select_set(True)
        for md in list(p.modifiers):
            bpy.ops.object.modifier_apply(modifier=md.name)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    o = bpy.context.view_layer.objects.active
    o.name = name; o.data.name = name
    return o


def rail(z0, z1, y, parts, w=0.026):
    parts.append(box(w, 0.008, z1 - z0, (0, y, (z0 + z1) / 2), METAL, 0.001))
    n = int((z1 - z0) / 0.012)
    for i in range(n):
        parts.append(box(w + 0.004, 0.006, 0.006, (0, y + 0.006, z0 + 0.006 + i * 0.012), METAL, 0.0))


def scope(z0, z1, y, r, parts):
    L = z1 - z0
    parts.append(lathe([(z0, r * 1.45), (z0 + L * 0.12, r * 1.45), (z0 + L * 0.2, r), (z1 - L * 0.22, r), (z1 - L * 0.12, r * 1.25), (z1, r * 1.25)], y, POLY))
    parts.append(box(r * 0.9, r * 0.7, r * 0.9, (0, y + r * 1.1, (z0 + z1) / 2), POLY, 0.002))
    parts.append(box(r * 0.7, r * 0.9, r * 0.9, (r * 1.15, y, (z0 + z1) / 2), POLY, 0.002))
    parts.append(lathe([(z0 - 0.002, r * 1.3), (z0 + 0.003, r * 1.3)], y, GLASS))
    for zz in (z0 + L * 0.3, z1 - L * 0.3):
        parts.append(box(0.012, y - 0.07, 0.02, (0, (y + 0.07) / 2, zz), METAL, 0.001))


made = []

# ---- 鐵砧-74（AK 系） ----
P = []
P.append(profile([(0.11, -0.005), (-0.27, -0.005), (-0.29, 0.02), (-0.29, 0.068), (0.09, 0.068), (0.12, 0.05)], 0.046, METAL, 0, 0.003))
P.append(tube(0.024, -0.26, 0.09, 0.066, METAL, 0, 24))                    # 防塵蓋
P.append(tube(0.011, -0.29, -0.58, 0.035, METAL, 0, 16))                    # 槍管
P.append(tube(0.012, -0.29, -0.47, 0.066, METAL, 0, 16))                    # 導氣管
P.append(box(0.03, 0.05, 0.03, (0, 0.05, -0.48), METAL))                    # 導氣座
P.append(tube(0.017, -0.56, -0.625, 0.035, METAL, 0, 16))                   # 槍口制退器
for i in range(3):
    P.append(box(0.036, 0.006, 0.006, (0, 0.035, -0.575 - i * 0.015), POLY, 0))
P.append(profile([(-0.52, 0.04), (-0.54, 0.04), (-0.545, 0.09), (-0.515, 0.09)], 0.008, METAL, 0, 0.001))  # 準星
P.append(profile([(-0.29, -0.022), (-0.47, -0.018), (-0.48, 0.022), (-0.29, 0.03)], 0.058, WOOD, 0, 0.006))  # 下護木
P.append(profile([(-0.3, 0.052), (-0.45, 0.054), (-0.45, 0.082), (-0.3, 0.082)], 0.044, WOOD, 0, 0.006))     # 上護木
for i in range(4):
    P.append(box(0.06, 0.004, 0.012, (0, -0.012 + i * 0.012, -0.35 - (i % 2) * 0.05), POLY, 0))
P.append(profile([(-0.035, -0.005), (-0.005, -0.005), (0.035, -0.12), (0.025, -0.255), (-0.005, -0.25), (-0.065, -0.11)], 0.03, METAL, 0, 0.003))  # 彎彈匣
for i in range(5):
    P.append(box(0.032, 0.004, 0.04, (0, -0.04 - i * 0.04, -0.03 + i * 0.012), METAL, 0))
P.append(profile([(0.035, -0.005), (0.075, -0.005), (0.1, -0.12), (0.07, -0.125), (0.045, -0.03)], 0.032, POLY, 0, 0.005))   # 握把
P.append(profile([(0.0, -0.008), (0.045, -0.008), (0.045, -0.045), (0.0, -0.045), (0.0, -0.038), (0.038, -0.038), (0.038, -0.015), (0.0, -0.015)], 0.008, METAL, 0, 0.001))  # 扳機護弓
P.append(profile([(0.11, 0.06), (0.12, -0.0), (0.42, -0.085), (0.43, -0.03), (0.42, 0.045), (0.2, 0.06)], 0.042, WOOD, 0, 0.007))  # 槍托
P.append(box(0.046, 0.012, 0.012, (0, 0.022, 0.43), POLY, 0.002))
rail(-0.16, -0.04, 0.09, P)
P.append(tube(0.02, -0.08, -0.02, 0.122, POLY, 0, 20))                       # 紅點鏡
P.append(box(0.026, 0.024, 0.06, (0, 0.104, -0.05), POLY, 0.002))
P.append(lathe([(-0.081, 0.017), (-0.079, 0.017)], 0.122, GLASS))
P.append(box(0.012, 0.012, 0.03, (0.03, 0.05, -0.02), METAL, 0.002))         # 拉柄
made.append(join('ar', P))

# ---- 黃蜂 SMG（MP5 系） ----
P = []
P.append(tube(0.024, 0.07, -0.24, 0.04, METAL, 0, 24))
P.append(profile([(0.07, 0.01), (-0.12, 0.01), (-0.12, 0.04), (0.07, 0.04)], 0.044, METAL, 0, 0.003))
P.append(profile([(-0.13, -0.025), (-0.3, -0.02), (-0.31, 0.05), (-0.13, 0.055)], 0.054, POLY, 0, 0.008))
P.append(tube(0.01, -0.3, -0.36, 0.035, METAL, 0, 14))
P.append(tube(0.015, -0.355, -0.385, 0.035, METAL, 0, 14))
P.append(tube(0.009, -0.05, -0.3, 0.075, METAL, 0, 12))                      # 拉柄管
P.append(profile([(-0.05, 0.01), (-0.02, 0.01), (0.0, -0.17), (-0.035, -0.175)], 0.026, METAL, 0, 0.003))
P.append(profile([(0.03, 0.0), (0.07, 0.0), (0.085, -0.115), (0.055, -0.12), (0.04, -0.02)], 0.03, POLY, 0, 0.005))
P.append(profile([(0.0, -0.005), (0.04, -0.005), (0.04, -0.04), (0.0, -0.04), (0.0, -0.033), (0.033, -0.033), (0.033, -0.012), (0.0, -0.012)], 0.008, METAL, 0, 0.001))
for xx in (-0.018, 0.018):
    P.append(tube(0.006, 0.07, 0.28, 0.035, METAL, xx, 10))
P.append(profile([(0.27, 0.06), (0.29, 0.06), (0.29, -0.02), (0.27, -0.02)], 0.05, POLY, 0, 0.004))
P.append(tube(0.015, -0.08, -0.03, 0.08, METAL, 0, 16))                      # 鼓形照門
P.append(profile([(-0.27, 0.05), (-0.29, 0.05), (-0.29, 0.085), (-0.27, 0.085)], 0.022, METAL, 0, 0.002))
made.append(join('smg', P))

# ---- 短號 P9 手槍 ----
P = []
P.append(profile([(0.025, 0.026), (-0.165, 0.026), (-0.17, 0.05), (-0.16, 0.065), (0.02, 0.065), (0.03, 0.055)], 0.03, METAL, 0, 0.003))  # 滑套
for i in range(6):
    P.append(box(0.032, 0.03, 0.003, (0, 0.047, 0.0 + i * 0.006 - 0.02), POLY, 0))
P.append(profile([(0.02, 0.026), (-0.15, 0.026), (-0.15, 0.008), (-0.03, 0.0), (0.02, 0.0)], 0.028, POLY, 0, 0.003))       # 槍身
P.append(profile([(0.0, 0.002), (0.04, 0.004), (0.06, -0.1), (0.022, -0.106), (0.004, -0.02)], 0.03, POLY, 0, 0.006))    # 握把
P.append(profile([(-0.005, 0.0), (-0.055, 0.0), (-0.055, -0.03), (-0.005, -0.03), (-0.005, -0.024), (-0.049, -0.024), (-0.049, -0.006), (-0.005, -0.006)], 0.007, POLY, 0, 0.001))
P.append(box(0.006, 0.01, 0.008, (0, 0.07, -0.155), METAL, 0.001))
P.append(box(0.02, 0.01, 0.008, (0, 0.07, 0.015), METAL, 0.001))
P.append(tube(0.007, -0.17, -0.175, 0.04, POLY, 0, 12))
made.append(join('p9', P))

# ---- 碎浪 12 泵動霰彈槍 ----
P = []
P.append(profile([(0.1, -0.01), (-0.16, -0.01), (-0.17, 0.02), (-0.16, 0.07), (0.08, 0.07), (0.11, 0.05)], 0.05, METAL, 0, 0.004))
P.append(tube(0.014, -0.17, -0.68, 0.055, METAL, 0, 18))
P.append(tube(0.012, -0.17, -0.6, 0.022, METAL, 0, 16))
P.append(tube(0.004, -0.672, -0.682, 0.072, METAL, 0, 8))
P.append(profile([(-0.3, -0.008), (-0.48, -0.008), (-0.49, 0.045), (-0.3, 0.045)], 0.058, WOOD, 0, 0.008))
for i in range(6):
    P.append(box(0.062, 0.004, 0.008, (0, -0.002 + 0.008 * (i % 2), -0.32 - i * 0.028), POLY, 0))
P.append(profile([(0.035, -0.01), (0.075, -0.01), (0.1, -0.11), (0.07, -0.115), (0.045, -0.03)], 0.032, POLY, 0, 0.005))
P.append(profile([(0.0, -0.008), (0.045, -0.008), (0.045, -0.045), (0.0, -0.045), (0.0, -0.038), (0.038, -0.038), (0.038, -0.015), (0.0, -0.015)], 0.008, METAL, 0, 0.001))
P.append(profile([(0.1, 0.06), (0.11, -0.005), (0.42, -0.09), (0.44, -0.03), (0.43, 0.05), (0.2, 0.065)], 0.045, WOOD, 0, 0.008))
P.append(box(0.05, 0.08, 0.02, (0, -0.02, 0.44), POLY, 0.004))
made.append(join('sg', P))

# ---- 長弓 DMR ----
P = []
P.append(profile([(0.12, -0.005), (-0.3, -0.005), (-0.31, 0.02), (-0.31, 0.072), (0.1, 0.072), (0.13, 0.05)], 0.05, TAN, 0, 0.004))
P.append(tube(0.012, -0.31, -0.72, 0.04, METAL, 0, 16))
P.append(tube(0.018, -0.7, -0.76, 0.04, METAL, 0, 16))
for i in range(4):
    P.append(box(0.04, 0.005, 0.005, (0, 0.04, -0.71 - i * 0.012), POLY, 0))
P.append(profile([(-0.31, -0.025), (-0.55, -0.02), (-0.56, 0.06), (-0.31, 0.065)], 0.056, TAN, 0, 0.008))
for i in range(5):
    P.append(box(0.06, 0.012, 0.03, (0, 0.022, -0.34 - i * 0.045), POLY, 0.002))
P.append(profile([(-0.06, -0.005), (-0.01, -0.005), (0.0, -0.13), (-0.05, -0.135)], 0.03, METAL, 0, 0.003))
P.append(profile([(0.035, -0.005), (0.075, -0.005), (0.1, -0.12), (0.07, -0.125), (0.045, -0.03)], 0.032, POLY, 0, 0.005))
P.append(profile([(0.12, 0.065), (0.13, -0.005), (0.44, -0.07), (0.45, 0.06), (0.25, 0.075)], 0.046, TAN, 0, 0.008))
P.append(profile([(0.22, 0.075), (0.38, 0.07), (0.38, 0.09), (0.22, 0.095)], 0.04, POLY, 0, 0.006))  # 頰托
rail(-0.3, 0.08, 0.077, P)
scope(-0.2, 0.02, 0.118, 0.02, P)
made.append(join('dmr', P))

# ---- 信天翁 .338 栓動狙擊槍 ----
P = []
P.append(tube(0.024, 0.08, -0.22, 0.045, METAL, 0, 24))
P.append(tube(0.013, -0.22, -0.84, 0.045, METAL, 0, 18, 0.011))
P.append(tube(0.021, -0.82, -0.9, 0.045, METAL, 0, 18))
for i in range(3):
    P.append(box(0.048, 0.006, 0.008, (0, 0.045, -0.835 - i * 0.02), POLY, 0))
P.append(profile([(0.1, 0.03), (-0.5, 0.025), (-0.52, -0.02), (-0.2, -0.04), (0.0, -0.04), (0.04, -0.13), (0.09, -0.125), (0.12, -0.03), (0.46, -0.08), (0.47, 0.06), (0.24, 0.07), (0.16, 0.035)], 0.058, TAN, 0, 0.008))  # 一體槍托
P.append(profile([(0.2, 0.07), (0.36, 0.068), (0.36, 0.098), (0.2, 0.1)], 0.042, POLY, 0, 0.006))
P.append(box(0.05, 0.05, 0.08, (0, -0.06, -0.06), METAL, 0.003))               # 彈匣
P.append(box(0.06, 0.012, 0.012, (0.035, 0.05, 0.035), METAL, 0.003))         # 槍機拉柄
P.append(tube(0.012, 0.03, 0.04, 0.05, METAL, 0.065, 14))
scope(-0.24, 0.08, 0.13, 0.026, P)
made.append(join('sr', P))

os.makedirs(os.path.dirname(OUT), exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=True, export_apply=True, export_yup=False)
print(f'ok    guns.glb  {os.path.getsize(OUT) / 1024:.0f} KB  {[o.name for o in made]}')
