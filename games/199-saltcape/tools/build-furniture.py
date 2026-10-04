"""用 Blender 建室內家具，輸出 ../../assets/199/models/furniture.glb（每件一個具名物件）。

    blender -b -P tools/build-furniture.py

座標：Y 朝上、原點在地面中心、背面朝 -Z（靠牆那面），單位公尺；匯出不轉軸。
尺寸要和 src/core/map.js 的 FURN 表一致（碰撞用同一組長寬高）。
"""
import math
import os
import bpy
import bmesh
from mathutils import Vector

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.normpath(os.path.join(ROOT, '../../assets/199/models/furniture.glb'))
bpy.ops.wm.read_factory_settings(use_empty=True)


def mat(name, color, rough=0.7, metal=0.0):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    b = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    b.inputs['Base Color'].default_value = (*color, 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    return m


WOOD = mat('furnWood', (0.42, 0.27, 0.15), 0.55)
WOODL = mat('furnWoodLight', (0.66, 0.5, 0.32), 0.6)
FABRIC = mat('fabric', (0.32, 0.38, 0.42), 0.95)
BEDDING = mat('bedding', (0.85, 0.83, 0.78), 0.95)
METAL = mat('furnMetal', (0.55, 0.57, 0.58), 0.4, 0.8)
DARK = mat('furnDark', (0.06, 0.06, 0.06), 0.4)
WHITE = mat('furnWhite', (0.9, 0.9, 0.88), 0.4)
CARD = mat('cardboard', (0.6, 0.45, 0.28), 0.9)
PLANT = mat('plant', (0.22, 0.4, 0.16), 0.8)
CLAY = mat('clay', (0.6, 0.32, 0.2), 0.8)
SCREEN = mat('screen', (0.02, 0.03, 0.04), 0.1, 0.3)


def box(sx, sy, sz, loc, m, bevel=0.01, seg=2):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1)
    for v in bm.verts:
        v.co = Vector((v.co.x * sx + loc[0], v.co.y * sy + loc[1], v.co.z * sz + loc[2]))
    me = bpy.data.meshes.new('b'); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new('b', me); bpy.context.collection.objects.link(o); me.materials.append(m)
    if bevel:
        md = o.modifiers.new('bv', 'BEVEL'); md.width = bevel; md.segments = seg; md.limit_method = 'ANGLE'
    return o


def cyl(r, h, loc, m, seg=16, r2=None):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=r, radius2=r if r2 is None else r2, depth=h)
    for v in bm.verts:
        v.co = Vector((v.co.x + loc[0], v.co.z + loc[1], -v.co.y + loc[2]))  # 圓柱轉成沿 Y
    me = bpy.data.meshes.new('c'); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new('c', me); bpy.context.collection.objects.link(o); me.materials.append(m)
    for p in me.polygons:
        p.use_smooth = True
    return o


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


def legs(w, d, h, inset, m, r=0.025):
    return [box(r * 2, h, r * 2, (sx * (w / 2 - inset), h / 2, sz * (d / 2 - inset)), m, 0.004) for sx in (-1, 1) for sz in (-1, 1)]


made = []
# 床 2.0×0.55×1.5（長邊沿 X）
P = [box(2.0, 0.28, 1.5, (0, 0.2, 0), WOOD, 0.02), box(1.94, 0.18, 1.44, (0, 0.43, 0), BEDDING, 0.06, 3), box(0.08, 0.95, 1.5, (-0.98, 0.48, 0), WOOD, 0.02)]
P += [box(0.36, 0.12, 0.55, (-0.72, 0.56, sz * 0.36), WHITE, 0.05, 3) for sz in (-1, 1)]
P.append(box(1.1, 0.06, 1.46, (0.35, 0.53, 0), FABRIC, 0.03, 3))
made.append(join('bed', P))
# 沙發 1.9×0.85×0.85
P = [box(1.9, 0.42, 0.85, (0, 0.21, 0), FABRIC, 0.05, 3), box(1.9, 0.5, 0.2, (0, 0.62, -0.33), FABRIC, 0.06, 3)]
P += [box(0.18, 0.62, 0.85, (sx * 0.86, 0.31, 0), FABRIC, 0.06, 3) for sx in (-1, 1)]
P += [box(0.78, 0.14, 0.62, (sx * 0.4, 0.48, 0.08), FABRIC, 0.05, 3) for sx in (-1, 1)]
made.append(join('sofa', P))
# 餐桌 1.4×0.75×0.85 ＋ 兩張椅子（家具群組）
P = [box(1.4, 0.05, 0.85, (0, 0.73, 0), WOODL, 0.01)] + legs(1.4, 0.85, 0.71, 0.06, WOODL)
for sz in (-1, 1):
    for sx in (-0.35, 0.35):
        z = sz * 0.62
        P += [box(0.42, 0.04, 0.42, (sx, 0.45, z), WOOD, 0.008)] + [box(0.035, 0.45, 0.035, (sx + ax * 0.18, 0.225, z + az * 0.18), WOOD, 0.004) for ax in (-1, 1) for az in (-1, 1)]
        P.append(box(0.42, 0.42, 0.03, (sx, 0.68, z + sz * 0.2), WOOD, 0.008))
made.append(join('dining', P))
# 書櫃 1.0×1.9×0.35
P = [box(1.0, 1.9, 0.03, (0, 0.95, -0.16), WOOD, 0.005)] + [box(0.03, 1.9, 0.35, (sx * 0.485, 0.95, 0), WOOD, 0.005) for sx in (-1, 1)]
for i in range(6):
    P.append(box(0.97, 0.025, 0.33, (0, 0.02 + i * 0.37, 0), WOOD, 0.004))
import random
random.seed(4)
for i in range(5):
    x = -0.44
    while x < 0.4:
        w = 0.03 + random.random() * 0.04; h = 0.2 + random.random() * 0.1
        P.append(box(w, h, 0.22, (x + w / 2, 0.035 + i * 0.37 + h / 2, 0.02), mat(f'book{random.randint(0, 3)}', [(0.5, 0.15, 0.1), (0.15, 0.3, 0.45), (0.75, 0.65, 0.3), (0.2, 0.35, 0.2)][random.randint(0, 3)], 0.8), 0.003))
        x += w + 0.004
made.append(join('bookcase', P))
# 衣櫃 1.2×2.0×0.6
P = [box(1.2, 2.0, 0.6, (0, 1.0, 0), WOODL, 0.01)] + [box(0.58, 1.86, 0.02, (sx * 0.3, 1.02, 0.305), WOODL, 0.008) for sx in (-1, 1)]
P += [box(0.02, 0.25, 0.03, (sx * 0.04, 1.1, 0.33), METAL, 0.004) for sx in (-1, 1)]
made.append(join('wardrobe', P))
# 流理台 2.0×0.9×0.6（含水槽、上櫃）
P = [box(2.0, 0.86, 0.6, (0, 0.43, 0), WHITE, 0.008), box(2.02, 0.04, 0.62, (0, 0.88, 0.01), mat('counter', (0.3, 0.3, 0.29), 0.3), 0.004)]
P += [box(0.48, 0.7, 0.02, (-0.75 + i * 0.5, 0.42, 0.305), WHITE, 0.006) for i in range(4)]
P.append(box(0.5, 0.06, 0.4, (0.4, 0.88, 0.02), METAL, 0.01))
P.append(box(2.0, 0.7, 0.35, (0, 1.85, -0.12), WHITE, 0.008))
made.append(join('kitchen', P))
# 冰箱 0.7×1.8×0.7
P = [box(0.7, 1.8, 0.7, (0, 0.9, 0), WHITE, 0.03, 3), box(0.68, 0.01, 0.02, (0, 1.2, 0.355), DARK, 0), box(0.03, 0.35, 0.03, (0.28, 1.45, 0.37), METAL, 0.005)]
made.append(join('fridge', P))
# 電視櫃 1.6×0.5×0.45 ＋ 電視
P = [box(1.6, 0.48, 0.45, (0, 0.24, 0), WOOD, 0.01), box(1.1, 0.64, 0.05, (0, 0.86, -0.08), SCREEN, 0.01), box(0.3, 0.06, 0.18, (0, 0.51, -0.08), DARK, 0.01)]
made.append(join('tvstand', P))
# 書桌 1.2×0.75×0.6 ＋ 椅子與螢幕
P = [box(1.2, 0.04, 0.6, (0, 0.74, 0), WOODL, 0.006)] + legs(1.2, 0.6, 0.72, 0.04, METAL, 0.02)
P += [box(0.5, 0.32, 0.03, (0, 0.98, -0.2), SCREEN, 0.008), box(0.06, 0.18, 0.06, (0, 0.82, -0.2), DARK)]
P += [box(0.46, 0.06, 0.46, (0, 0.47, 0.52), FABRIC, 0.02), box(0.46, 0.5, 0.05, (0, 0.75, 0.74), FABRIC, 0.02), cyl(0.03, 0.44, (0, 0.22, 0.52), METAL), box(0.5, 0.03, 0.06, (0, 0.04, 0.52), DARK)]
made.append(join('desk', P))
# 鐵貨架 2.0×2.0×0.6（倉庫）
P = [box(0.05, 2.0, 0.05, (sx * 0.97, 1.0, sz * 0.27), METAL, 0.004) for sx in (-1, 1) for sz in (-1, 1)]
for i in range(4):
    P.append(box(2.0, 0.03, 0.6, (0, 0.15 + i * 0.6, 0), METAL, 0.004))
    for k in range(3):
        if random.random() < 0.8:
            s = 0.3 + random.random() * 0.2
            P.append(box(s * 1.2, s, s, (-0.6 + k * 0.6, 0.165 + i * 0.6 + s / 2, 0), CARD, 0.01))
made.append(join('rack', P))
# 紙箱堆 0.9×0.9×0.9
P = [box(0.6, 0.45, 0.5, (-0.12, 0.225, 0), CARD, 0.01), box(0.5, 0.4, 0.45, (0.18, 0.2, 0.1), CARD, 0.01), box(0.5, 0.38, 0.4, (-0.05, 0.64, 0.02), CARD, 0.01)]
made.append(join('boxes', P))
# 盆栽 0.5×1.1×0.5
P = [cyl(0.2, 0.35, (0, 0.175, 0), CLAY, 16, 0.16)]
for i in range(9):
    a = i / 9 * math.pi * 2
    leaf = box(0.06, 0.6, 0.02, (math.cos(a) * 0.08, 0.6, math.sin(a) * 0.08), PLANT, 0.01)
    leaf.rotation_euler = (math.sin(a) * 0.5, 0, -math.cos(a) * 0.5)
    P.append(leaf)
made.append(join('plant', P))

os.makedirs(os.path.dirname(OUT), exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=True, export_apply=True, export_yup=False)
print(f'ok    furniture.glb  {os.path.getsize(OUT) / 1024:.0f} KB  {[o.name for o in made]}')
