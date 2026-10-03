"""把 Quaternius 的底模頭部＋服裝＋髮型組成三個 NPC，輸出 assets/197/models/q/npc_*.glb。

    blender -b -P tools/build-characters.py

素材先用 tools/fetch-quaternius.py 下載到 .cache/。四包共用同一副 65 根骨頭的人形骨架，
所以服裝與髮型只要改綁到底模的 armature 上，就能直接播 Universal Animation Library 的動畫（build-anims.mjs）。
- 底模只留頭與脖子（依骨頭權重切），身體由服裝負責；全身留著會從衣服底下穿出來
- 貼圖從 4K PNG 縮成 1K JPEG，拿掉粗糙度／金屬度貼圖（遠看分不出來，檔案小很多）
"""
import os
import bpy
import bmesh

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, '.cache')
OUT = os.path.normpath(os.path.join(ROOT, '../../assets/197/models/q'))

UBC = os.path.join(CACHE, 'ubc/Universal Base Characters[Standard]')
BODY = os.path.join(UBC, 'Base Characters/Godot - UE/Superhero_{}_FullBody.gltf')
HAIR = os.path.join(UBC, 'Hairstyles/Rigged to Head Bone/glTF (Godot -Unreal)/{}.gltf')
MCO = os.path.join(CACHE, 'mco/Modular Character Outfits - Fantasy[Standard]')
OUTFIT = os.path.join(MCO, 'Exports/glTF (Godot-Unreal)/Outfits/{}.gltf')
TEX = os.path.join(MCO, 'Textures')

# name：輸出檔名；drop：服裝裡不要的零件（名稱包含即刪）；retex：換成另一組顏色的貼圖
CHARACTERS = [
    # 營地的阿哲：遊俠的外套與靴子，拿掉兜帽與護肩，露出旁分短髮
    dict(name='npc_camper', sex='Male', outfit='Male_Ranger', hair=['Hair_SimpleParted'], drop=['Head_Hood', 'Pauldron']),
    # 碼頭的老陳：農民裝（第二組配色）、大鬍子、平頭
    dict(name='npc_fisher', sex='Male', outfit='Male_Peasant', hair=['Hair_Buzzed', 'Hair_Beard'], drop=[], retex={'T_Peasant_BaseColor': 'Peasant/T_Peasant_2_BaseColor.png'}),
    # 繞湖健行的小安：遊俠裝戴兜帽，拿掉護肩
    dict(name='npc_hiker', sex='Female', outfit='Female_Ranger', hair=[], drop=['Pauldrons']),
]
KEEP_BONES = {'Head', 'neck_01'}
TEXTURE_SIZE = 1024


def import_gltf(path):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    return [o for o in bpy.data.objects if o not in before]


def head_only(mesh_obj):
    """只留主要受 Head／neck_01 影響的頂點（脖子底下交給衣領蓋住）"""
    groups = {g.index: g.name for g in mesh_obj.vertex_groups}
    bm = bmesh.new()
    bm.from_mesh(mesh_obj.data)
    deform = bm.verts.layers.deform.active
    doomed = []
    for v in bm.verts:
        keep = sum(w for gi, w in v[deform].items() if groups.get(gi) in KEEP_BONES)
        if keep < 0.5:
            doomed.append(v)
    bmesh.ops.delete(bm, geom=doomed, context='VERTS')
    bm.to_mesh(mesh_obj.data)
    bm.free()


def rebind(objs, armature):
    """把其他檔案匯入的網格改綁到 armature，再刪掉它們自帶的骨架"""
    for o in objs:
        if o.type == 'MESH':
            for m in o.modifiers:
                if m.type == 'ARMATURE':
                    m.object = armature
            world = o.matrix_world.copy()
            o.parent = armature
            o.matrix_world = world
    for o in objs:
        if o.type == 'ARMATURE' and o != armature:
            bpy.data.objects.remove(o, do_unlink=True)
    for o in list(bpy.data.objects):
        if o.type == 'EMPTY' and not o.children:
            bpy.data.objects.remove(o, do_unlink=True)


def relink_missing():
    """有些 gltf 指向 *_png.png，實際檔案在 Textures/ 底下叫 *.png；找同名檔接回去"""
    for img in bpy.data.images:
        if not img.filepath or os.path.exists(bpy.path.abspath(img.filepath)):
            continue
        want = os.path.basename(img.filepath).replace('_png.png', '.png')
        for folder, _, files in os.walk(UBC):
            if want in files:
                img.filepath = os.path.join(folder, want)
                img.reload()
                break


def drop_helpers():
    """匯入器替骨頭顯示形狀建的 Icosphere 不是模型的一部分"""
    for o in list(bpy.data.objects):
        if o.type == 'MESH' and o.name.startswith('Icosphere') and not any(m.type == 'ARMATURE' for m in o.modifiers):
            bpy.data.objects.remove(o, do_unlink=True)


def simplify_materials():
    """拿掉粗糙度／金屬度貼圖（改常數），貼圖縮成 1K"""
    for mat in bpy.data.materials:
        if not mat.node_tree:
            continue
        bsdf = next((n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None)
        if not bsdf:
            continue
        for name, value in (('Roughness', 0.82), ('Metallic', 0.0)):
            sock = bsdf.inputs[name]
            for link in list(sock.links):
                mat.node_tree.links.remove(link)
            sock.default_value = value
        occl = [n for n in mat.node_tree.nodes if n.type == 'TEX_IMAGE' and not n.outputs['Color'].links and not n.outputs['Alpha'].links]
        for n in occl:
            mat.node_tree.nodes.remove(n)
    for img in bpy.data.images:
        if img.size[0] > TEXTURE_SIZE:
            img.scale(TEXTURE_SIZE, TEXTURE_SIZE)


def build(spec):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    body = import_gltf(BODY.format(spec['sex']))
    armature = next(o for o in body if o.type == 'ARMATURE')
    for o in body:
        # 底模的主網格叫 SuperHero_*；眼睛、眉毛整個保留
        if o.type == 'MESH' and o.name.lower().startswith('superhero'):
            head_only(o)

    parts = import_gltf(OUTFIT.format(spec['outfit']))
    for o in list(parts):
        if o.type == 'MESH' and any(d in o.name for d in spec['drop']):
            parts.remove(o)
            bpy.data.objects.remove(o, do_unlink=True)
    rebind(parts, armature)
    for hair in spec['hair']:
        rebind(import_gltf(HAIR.format(hair)), armature)

    for old, new in spec.get('retex', {}).items():
        for img in bpy.data.images:
            if img.name.startswith(old):
                img.filepath = os.path.join(TEX, new)
                img.reload()
    relink_missing()
    drop_helpers()
    simplify_materials()

    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, spec['name'] + '.glb')
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format='GLB',
        export_animations=False,
        export_image_format='JPEG',
        export_jpeg_quality=82,
        export_apply=False,
        export_yup=True,
    )
    tris = sum(len(o.data.polygons) for o in bpy.data.objects if o.type == 'MESH')
    print(f'ok    {spec["name"]}.glb  {os.path.getsize(path) / 1024:.0f} KB  約 {tris} 面  網格：{[o.name for o in bpy.data.objects if o.type == "MESH"]}')


for spec in CHARACTERS:
    build(spec)
