"""用 Blender 建鹽岬島的外觀模組，輸出 ../../assets/199/models/kit.glb（每個模組是一個具名物件）。

    blender -b -P tools/build-kit.py

全部以程式建模（倒角、細分、平滑著色），不用外部素材。單位是公尺；
門窗類模組以「牆外表面、開口中心」為原點，+Z 朝外、+Y 朝上，寬高做成 1，前端依開口尺寸縮放。
- ironbar  鐵窗（凸出式，含斜頂板）     - awning  浪板遮雨棚＋三角托架
- shutter  鐵捲門（捲軸箱＋門片，原點在上緣）- door    木門片（原點在鉸鏈下緣）
- porch    門廊（斜屋頂＋兩根柱）        - balcony 陽台欄杆
- tank     屋頂不鏽鋼水塔＋鐵架          - scooter 機車
- lamp     路燈                        - bench   長椅
"""
import math
import os
import bpy
import bmesh

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.normpath(os.path.join(ROOT, '../../assets/199/models/kit.glb'))

bpy.ops.wm.read_factory_settings(use_empty=True)
MATS = {}


def mat(name, color, rough=0.6, metal=0.0):
    if name in MATS:
        return MATS[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    b.inputs['Base Color'].default_value = (*color, 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    MATS[name] = m
    return m


def obj_from_bm(name, bm, material, smooth=False):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    me.materials.append(material)
    if smooth:
        for p in me.polygons:
            p.use_smooth = True
    return o


def box(name, sx, sy, sz, loc, material, bevel=0.0, seg=2):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co.x *= sx; v.co.y *= sy; v.co.z *= sz
        v.co.x += loc[0]; v.co.y += loc[1]; v.co.z += loc[2]
    o = obj_from_bm(name, bm, material)
    if bevel > 0:
        md = o.modifiers.new('bevel', 'BEVEL'); md.width = bevel; md.segments = seg; md.limit_method = 'ANGLE'
    return o


def cyl(name, r, depth, loc, material, axis='Z', seg=16, smooth=True, r2=None):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=r, radius2=r if r2 is None else r2, depth=depth)
    rot = {'X': (0, math.pi / 2, 0), 'Y': (math.pi / 2, 0, 0), 'Z': (0, 0, 0)}[axis]
    bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=__import__('mathutils').Euler(rot).to_matrix())
    bmesh.ops.translate(bm, verts=bm.verts, vec=loc)
    return obj_from_bm(name, bm, material, smooth)


def join(name, parts):
    bpy.ops.object.select_all(action='DESELECT')
    for p in parts:
        p.select_set(True)
        bpy.context.view_layer.objects.active = p
        for md in list(p.modifiers):
            bpy.ops.object.modifier_apply(modifier=md.name)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    o = bpy.context.view_layer.objects.active
    o.name = name
    o.data.name = name
    return o


IRON = mat('iron', (0.86, 0.86, 0.84), 0.45, 0.6)
IRON_D = mat('ironDark', (0.12, 0.12, 0.12), 0.5, 0.5)
STEEL = mat('steel', (0.62, 0.64, 0.66), 0.32, 0.9)
AWN = mat('awning', (0.55, 0.72, 0.62), 0.35, 0.2)
SHUT = mat('shutter', (0.72, 0.73, 0.72), 0.4, 0.75)
WOOD = mat('doorWood', (0.36, 0.2, 0.1), 0.5)
BRASS = mat('brass', (0.8, 0.6, 0.25), 0.25, 1.0)
ROOFM = mat('porchRoof', (0.32, 0.16, 0.1), 0.7)
POST = mat('postWhite', (0.92, 0.9, 0.86), 0.5)
BODY = mat('scooterBody', (0.82, 0.82, 0.8), 0.25, 0.1)
BLACK = mat('rubber', (0.05, 0.05, 0.05), 0.85)
CHROME = mat('chrome', (0.9, 0.9, 0.9), 0.12, 1.0)
LENS = mat('lens', (0.95, 0.92, 0.75), 0.05)
SEAT = mat('seat', (0.08, 0.07, 0.07), 0.6)
POLE = mat('pole', (0.45, 0.47, 0.48), 0.45, 0.7)
BENCHW = mat('benchWood', (0.5, 0.3, 0.16), 0.6)

made = []

# ---- 鐵窗：外框方管、直欄、兩道橫欄、斜頂板；凸出 0.16 ----
p = []
D = 0.16
for x in (-0.5, 0.5):
    p.append(box('a', 0.025, 1.0, 0.025, (x, 0, D), IRON, 0.004))
    p.append(box('a', 0.025, 0.025, D, (x, 0.5, D / 2), IRON, 0.004))
    p.append(box('a', 0.025, 0.025, D, (x, -0.5, D / 2), IRON, 0.004))
for y in (-0.5, 0.5, -0.12, 0.2):
    p.append(box('a', 1.0, 0.022, 0.022, (0, y, D), IRON, 0.004))
n = 9
for i in range(1, n):
    x = -0.5 + i / n
    p.append(box('a', 0.012, 1.0, 0.012, (x, 0, D), IRON))
p.append(box('a', 1.06, 0.012, D + 0.06, (0, 0.53, D / 2 + 0.02), IRON))
made.append(join('ironbar', p))

# ---- 浪板遮雨棚：沿 x 的波浪板，往外下斜，兩端三角托架 ----
bm = bmesh.new()
nx, nz = 48, 6
verts = []
for j in range(nz + 1):
    row = []
    for i in range(nx + 1):
        x = -0.5 + i / nx
        z = j / nz * 0.78
        y = -0.3 * (j / nz) + 0.012 * math.sin(i / nx * math.pi * 18)
        row.append(bm.verts.new((x, y, z)))
    verts.append(row)
for j in range(nz):
    for i in range(nx):
        bm.faces.new((verts[j][i], verts[j][i + 1], verts[j + 1][i + 1], verts[j + 1][i]))
o = obj_from_bm('aw', bm, AWN, True)
sol = o.modifiers.new('s', 'SOLIDIFY'); sol.thickness = 0.008
parts = [o]
for x in (-0.48, 0.48):
    parts.append(box('b', 0.02, 0.02, 0.8, (x, -0.16, 0.39), STEEL))
    br = box('b', 0.02, 0.5, 0.02, (x, -0.28, 0.02), STEEL)
    parts.append(br)
    diag = box('b', 0.018, 0.018, 0.62, (x, -0.33, 0.3), STEEL)
    diag.rotation_euler = (0.75, 0, 0)
    bpy.context.view_layer.objects.active = diag
    bpy.ops.object.select_all(action='DESELECT'); diag.select_set(True)
    bpy.ops.object.transform_apply(rotation=True)
    parts.append(diag)
made.append(join('awning', parts))

# ---- 鐵捲門：上緣捲軸箱，門片向下一單位（前端縮放成半開） ----
parts = [box('s', 1.06, 0.3, 0.3, (0, 0.15, 0.12), SHUT, 0.02)]
slats = 22
for i in range(slats):
    y = -i / slats - 0.5 / slats
    parts.append(box('s', 1.0, 1 / slats * 0.92, 0.03, (0, y, 0.02), SHUT, 0.006))
parts.append(box('s', 1.0, 0.05, 0.05, (0, -1.0, 0.03), IRON_D, 0.01))
made.append(join('shutter', parts))

# ---- 木門片：0.9×2.1，兩塊凸板、門把；原點在鉸鏈下緣 ----
parts = [box('d', 0.9, 2.1, 0.045, (0.45, 1.05, 0), WOOD, 0.008)]
for y in (0.55, 1.45):
    parts.append(box('d', 0.62, 0.7, 0.02, (0.45, y, 0.028), WOOD, 0.012))
    parts.append(box('d', 0.62, 0.7, 0.02, (0.45, y, -0.028), WOOD, 0.012))
parts.append(cyl('k', 0.03, 0.08, (0.8, 1.0, 0.05), BRASS, 'Y', 16))
parts.append(cyl('k', 0.03, 0.08, (0.8, 1.0, -0.05), BRASS, 'Y', 16))
made.append(join('door', parts))

# ---- 門廊：斜屋頂（寬 1、深 1.8）＋兩根柱，原點在牆面地上 ----
roof = box('p', 1.1, 0.08, 2.0, (0, 2.62, 0.95), ROOFM, 0.015)
roof.rotation_euler = (-0.18, 0, 0)
bpy.ops.object.select_all(action='DESELECT'); roof.select_set(True); bpy.context.view_layer.objects.active = roof
bpy.ops.object.transform_apply(rotation=True)
parts = [roof, box('p', 1.06, 0.14, 0.12, (0, 2.48, 1.78), POST, 0.01)]
for x in (-0.46, 0.46):
    parts.append(cyl('c', 0.07, 2.5, (x, 1.25, 1.75), POST, 'Y', 14))
    parts.append(box('c', 0.2, 0.08, 0.2, (x, 0.04, 1.75), POST, 0.01))
made.append(join('porch', parts))

# ---- 陽台欄杆：寬 1、深 0.9 ----
parts = [box('b', 1.0, 0.12, 0.9, (0, -0.06, 0.45), POST, 0.01)]
parts.append(box('b', 1.0, 0.05, 0.05, (0, 1.0, 0.88), IRON, 0.006))
for x in (-0.5, 0.5):
    parts.append(box('b', 0.05, 0.05, 0.9, (x, 1.0, 0.45), IRON, 0.006))
    parts.append(box('b', 0.04, 1.0, 0.04, (x, 0.5, 0.88), IRON))
for i in range(11):
    parts.append(box('b', 0.018, 0.95, 0.018, (-0.5 + i / 10, 0.5, 0.88), IRON))
made.append(join('balcony', parts))

# ---- 屋頂水塔：不鏽鋼直立圓筒＋鐵架 ----
parts = [cyl('t', 0.62, 1.25, (0, 0, 1.55), STEEL, 'Z', 28)]
parts.append(cyl('t', 0.6, 0.18, (0, 0, 2.27), STEEL, 'Z', 28, True, 0.18))
for z in (1.1, 1.55, 2.0):
    parts.append(cyl('r', 0.63, 0.03, (0, 0, z), STEEL, 'Z', 28))
for (x, y) in ((-0.5, -0.5), (0.5, -0.5), (-0.5, 0.5), (0.5, 0.5)):
    parts.append(box('l', 0.06, 0.06, 0.95, (x, y, 0.47), IRON_D))
parts.append(box('l', 1.1, 1.1, 0.06, (0, 0, 0.92), IRON_D))
tank = join('tank', parts)
tank.rotation_euler = (-math.pi / 2, 0, 0)  # Blender Z 朝上 → glTF Y 朝上由匯出器處理；這裡先轉回 Y 朝上座標的直立
bpy.ops.object.select_all(action='DESELECT'); tank.select_set(True); bpy.context.view_layer.objects.active = tank
bpy.ops.object.transform_apply(rotation=True)
made.append(tank)

# ---- 機車：長約 1.85，前輪在 -Z ----
parts = []
for z in (-0.68, 0.62):
    parts.append(cyl('w', 0.24, 0.1, (0, 0.24, z), BLACK, 'X', 24))
    parts.append(cyl('w', 0.14, 0.11, (0, 0.24, z), CHROME, 'X', 16))
body = box('b', 0.34, 0.32, 0.9, (0, 0.5, 0.22), BODY, 0.1, 4)
parts.append(body)
parts.append(box('b', 0.3, 0.1, 0.62, (0, 0.71, 0.3), SEAT, 0.05, 3))
parts.append(box('b', 0.36, 0.6, 0.16, (0, 0.62, -0.5), BODY, 0.06, 3))
parts.append(box('b', 0.26, 0.08, 0.42, (0, 0.28, -0.12), BODY, 0.03))
fork = box('f', 0.05, 0.7, 0.05, (0, 0.55, -0.66), CHROME)
fork.rotation_euler = (0.35, 0, 0)
bpy.ops.object.select_all(action='DESELECT'); fork.select_set(True); bpy.context.view_layer.objects.active = fork
bpy.ops.object.transform_apply(rotation=True)
parts.append(fork)
parts.append(box('h', 0.62, 0.035, 0.035, (0, 1.02, -0.58), CHROME))
parts.append(box('h', 0.2, 0.14, 0.12, (0, 0.95, -0.6), BODY, 0.04))
parts.append(cyl('l', 0.06, 0.04, (0, 0.95, -0.67), LENS, 'Z', 16))
for x in (-0.31, 0.31):
    parts.append(cyl('g', 0.025, 0.12, (x, 1.02, -0.58), BLACK, 'X', 10))
made.append(join('scooter', parts))

# ---- 路燈：7 公尺柱＋彎臂燈頭 ----
parts = [cyl('p', 0.09, 7.0, (0, 3.5, 0), POLE, 'Y', 12, True, 0.06)]
parts.append(cyl('p', 0.16, 0.6, (0, 0.3, 0), POLE, 'Y', 12))
arm = box('a', 0.06, 0.06, 1.6, (0, 6.95, -0.75), POLE)
parts.append(arm)
parts.append(box('h', 0.3, 0.12, 0.6, (0, 6.88, -1.5), POLE, 0.04, 3))
parts.append(box('h', 0.24, 0.02, 0.5, (0, 6.81, -1.5), LENS))
made.append(join('lamp', parts))

# ---- 長椅 ----
parts = []
for i in range(3):
    parts.append(box('s', 1.6, 0.035, 0.1, (0, 0.45, -0.12 + i * 0.12), BENCHW, 0.008))
for i in range(2):
    parts.append(box('s', 1.6, 0.1, 0.03, (0, 0.62 + i * 0.13, 0.2), BENCHW, 0.008))
for x in (-0.7, 0.7):
    parts.append(box('l', 0.05, 0.45, 0.05, (x, 0.22, -0.12), IRON_D))
    parts.append(box('l', 0.05, 0.85, 0.05, (x, 0.42, 0.2), IRON_D))
made.append(join('bench', parts))

# 匯出前：其他暫存物件都已合併；整理原點
os.makedirs(os.path.dirname(OUT), exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=True, export_apply=True, export_yup=False)
print(f'ok    kit.glb  {os.path.getsize(OUT) / 1024:.0f} KB  {[o.name for o in made]}')
