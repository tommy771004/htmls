# 霓虹夜城（260）山坡別墅的室內家具：把下載的 Sketchfab 室內場景（.cache/villa-sf/，CC BY，作者見 assets/260/CREDITS.md）拆成單件，
# 統一成公尺、正面朝 −Y（匯出後是 glTF 的 +z）、底面中心在原點，沿 x 每 8 m 排一件，存成 .cache/villa-furn/furn.glb（帶原檔貼圖）。
# 之後 node tools/props.mjs villa_furn 壓成 assets/260/props/villa_furn.glb，27-props.js 照 villa_plans.json 的 furniture 擺進每棟別墅。
# 執行：/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P blender/villa_furn.py
import bpy, math, os, re
from mathutils import Vector, Matrix

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, '..', '.cache', 'villa-sf')
OUT = os.path.join(HERE, '..', '.cache', 'villa-furn')
# id：檔名、要的節點（正規式）、縮放（scale 固定倍數，或 h 整件的目標高）、rot 繞 z 轉幾度讓正面朝 −Y（從 −Y 看的截圖判斷：沙發座面、馬桶座、床尾、
# 廚房的檯面朝 −Y，高櫃與床頭靠 +Y 的牆）、dec 減面比例（照節點名）
ITEMS = [
    ('sofa_l', 'white_modern_living_room', r'^(Sofa|Pillows)_', dict(scale=1.0, rot=180)),
    ('coffee', 'white_modern_living_room', r'^CoffeeTable_', dict(scale=1.0, rot=0)),
    ('tv', 'white_modern_living_room', r'^(TV|TVStand)_', dict(scale=1.0, rot=0)),
    ('lamp', 'white_modern_living_room', r'^Lamp_', dict(scale=1.0, rot=0, dec={'Lamp': 0.3})),
    ('plant', 'modern_bathroom_1k', r'^Tree_', dict(scale=1.0, rot=0, dec={'Tree': 0.15})),
    ('kitchen', 'modern_kitchen', r'^(Cupboards|Trim|Counters|Ovens|Hob|Sink|Fridge|Stools|LightSupport|Lightbulbs|LightsGlass)_', dict(scale=0.45, rot=90, dec={'Lightbulbs': 0.2})),
    ('bed', 'cozy_modern_bedroom', r'_(Bed|EndTables)_', dict(scale=1.0, rot=-90, neutral='material.005')),
    ('vanity', 'modern_bathroom_1k', r'^Bathroom_(Cabinet|Mirror|MirrorTrim|MirrorLight)_', dict(scale=1.0, rot=0)),
    ('toilet', 'modern_bathroom_1k', r'^Bathroom_(Toilet|ToiletFlushButton)_', dict(scale=1.0, rot=180)),
    ('dining', 'modern_dining_room_table_set', r'.', dict(h=1.12, rot=0)),
    ('lounge', 'couch_complete_set', r'.', dict(h=0.85, rot=180)),
]

# neutral：把這個材質的底色貼圖去色（床單原檔是藍綠色）。有彩度的像素（床單）改成灰階再提亮到平均 0.8，黑床架、白枕頭照舊；
# 遊戲裡 27-props.js 的 VILLA_PAL 再乘上每型別墅的床組顏色
def neutral(o, pre):
    import numpy as np
    for m in o.data.materials:
        if not m or not m.name.startswith(pre) or not m.use_nodes: continue
        for n in m.node_tree.nodes:
            if n.type != 'TEX_IMAGE' or not n.image or not any(l.to_socket.name == 'Base Color' for l in n.outputs[0].links): continue
            im = n.image.copy(); im.name = n.image.name + '_neutral'
            px = np.empty(len(im.pixels), dtype=np.float32); im.pixels.foreach_get(px); px = px.reshape(-1, 4)
            rgb = px[:, :3]; L = rgb @ np.array([.2126, .7152, .0722], dtype=np.float32)
            sat = rgb.max(1) - rgb.min(1); col = sat > .08
            k = .8 / max(float(L[col].mean()) if col.any() else 1., .05)
            out = np.where(col, np.clip(L * k, 0, 1), L)
            px[:, 0] = px[:, 1] = px[:, 2] = out
            im.pixels.foreach_set(px.ravel()); im.pack(); n.image = im
            print(f'NEUTRAL {m.name} {n.image.name}: {int(col.sum())}/{len(L)} 像素去色，提亮 {k:.2f} 倍')

bpy.ops.wm.read_factory_settings(use_empty=True)
done = []
for i, (iid, fn, pat, o_) in enumerate(ITEMS):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(SRC, fn + '.glb'))
    new = [o for o in bpy.data.objects if o not in before]
    bpy.context.view_layer.update()
    keep = []
    for o in new:
        if o.type != 'MESH' or not re.search(pat, o.name): continue
        me = o.data.copy(); me.transform(o.matrix_world)
        n = bpy.data.objects.new(o.name + '_w', me); bpy.context.scene.collection.objects.link(n)
        for k, r in (o_.get('dec') or {}).items():
            if o.name.startswith(k + '_') or ('_' + k + '_') in o.name:
                m = n.modifiers.new('dec', 'DECIMATE'); m.ratio = r
                bpy.context.view_layer.objects.active = n; bpy.ops.object.modifier_apply(modifier='dec')
        keep.append(n)
    for o in new: bpy.data.objects.remove(o, do_unlink=True)
    bpy.ops.object.select_all(action='DESELECT')
    for o in keep: o.select_set(True)
    bpy.context.view_layer.objects.active = keep[0]
    if len(keep) > 1: bpy.ops.object.join()
    o = bpy.context.view_layer.objects.active; o.name = iid; o.data.name = iid
    v = [p.co for p in o.data.vertices]
    lo = Vector([min(p[k] for p in v) for k in range(3)]); hi = Vector([max(p[k] for p in v) for k in range(3)])
    s = o_['h'] / (hi.z - lo.z) if 'h' in o_ else o_['scale']
    a = math.radians(o_.get('rot', 0))
    T = Matrix.Rotation(a, 4, 'Z') @ Matrix.Scale(s, 4) @ Matrix.Translation(Vector(((lo.x + hi.x) / -2, (lo.y + hi.y) / -2, -lo.z)))
    o.data.transform(T)
    v = [p.co for p in o.data.vertices]
    lo = Vector([min(p[k] for p in v) for k in range(3)]); hi = Vector([max(p[k] for p in v) for k in range(3)])
    o.data.transform(Matrix.Translation(Vector(((lo.x + hi.x) / -2 + i * 8.0, (lo.y + hi.y) / -2, 0))))
    o.data.update()
    if o_.get('neutral'): neutral(o, o_['neutral'])
    tri = sum(len(p.vertices) - 2 for p in o.data.polygons)
    print(f'FURN {iid:8s} x={i * 8:3d}  {hi.x - lo.x:.2f} × {hi.y - lo.y:.2f} × {hi.z - lo.z:.2f} m  scale {s:.4f}  {tri} tri  {len(o.data.materials)} mats')
    done.append(o)
for o in list(bpy.data.objects):
    if o not in done: bpy.data.objects.remove(o, do_unlink=True)
os.makedirs(OUT, exist_ok=True)
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, 'furn.glb'), export_format='GLB', export_apply=True)
