"""把 Quaternius 的 CC0 動物（.cache/，由 tools/fetch-quaternius.py 下載）轉成 assets/197/models/q/*.glb。

    blender -b -P tools/build-animals.py

FBX 匯入後只留網格、骨架與動畫，輸出 GLB。動物模型是平面著色的低多邊形、用頂點色或單色材質，沒有貼圖。
"""
import os
import bpy

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, '.cache')
OUT = os.path.normpath(os.path.join(ROOT, '../../assets/197/models/q'))

# 輸出檔名 → 來源（相對 .cache/）
ANIMALS = {
    'horse': 'farm/FBX/Horse.fbx',  # Farm Animals Animated（2018）
}


def build(name, rel):
    src = os.path.join(CACHE, rel)
    if not os.path.exists(src):
        print(f'skip  {name}（沒有 {rel}）')
        return
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.fbx(filepath=src, automatic_bone_orientation=True)
    for o in list(bpy.data.objects):
        if o.type not in {'MESH', 'ARMATURE'}:
            bpy.data.objects.remove(o, do_unlink=True)
    # FBX 的 TransparencyFactor 匯入後會把 Alpha 變成 0，匯出成 MASK 就整隻透明了
    for mat in bpy.data.materials:
        bsdf = next((n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None) if mat.node_tree else None
        if bsdf:
            for link in list(bsdf.inputs['Alpha'].links):
                mat.node_tree.links.remove(link)
            bsdf.inputs['Alpha'].default_value = 1.0
            bsdf.inputs['Roughness'].default_value = 0.85
        mat.surface_render_method = 'DITHERED'
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, name + '.glb')
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format='GLB',
        export_animations=True,
        export_animation_mode='ACTIONS',
        export_apply=False,
        export_yup=True,
    )
    tris = sum(len(o.data.polygons) for o in bpy.data.objects if o.type == 'MESH')
    print(f'ok    {name}.glb  {os.path.getsize(path) / 1024:.0f} KB  約 {tris} 面  動畫：{[a.name for a in bpy.data.actions]}')


for name, rel in ANIMALS.items():
    build(name, rel)
