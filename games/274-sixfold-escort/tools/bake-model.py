# 高模（逐片瓦、掃描）→ 單一材質的低模：tools/prep-models.mjs 呼叫，不直接跑。
# blender -b --factory-startup --python tools/bake-model.py -- <src.glb> <dst.glb> <tris> <texPx> <voxel> <solid> <extrusion> <maxRay>
#
# 做法：低模是高模的複本 → （solid>0）先加厚，薄屋面、板牆才不會在體素化時破洞 → 體素重建（voxel>0）成封閉外殼
# → collapse 減面到 tris → Smart UV Project 重新展 UV → Cycles 把高模的底色（DIFFUSE 只留 COLOR）烘到一張 texPx 的圖
# → 輸出只有一個材質、一張貼圖的 GLB。meshoptimizer 直接減面時，逐片瓦的屋頂與多材質的 UV 縫會碎掉（見 models.json 的 reason）。
import bpy, sys, math

a = sys.argv[sys.argv.index('--') + 1:]
src, dst = a[0], a[1]
tris, px = int(a[2]), int(a[3])
voxel, solid, ext, ray = (float(v) for v in a[4:8])
UV_ANGLE = float(a[8]) if len(a) > 8 else 66  # Smart UV Project 的分島角度：越大島越少、UV 縫（重複頂點）越少，拉伸越多
SMOOTH_ANGLE = float(a[9]) if len(a) > 9 else 35

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
for o in list(bpy.context.scene.objects):
    if o.type in ('CAMERA', 'LIGHT'):
        bpy.data.objects.remove(o, do_unlink=True)
meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
bpy.ops.object.select_all(action='DESELECT')
for o in meshes:
    o.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
if len(meshes) > 1:
    bpy.ops.object.join()
hi = bpy.context.view_layer.objects.active
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
hi.name = 'HI'
n0 = sum(len(p.vertices) - 2 for p in hi.data.polygons)


def apply(o, name):
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.modifier_apply(modifier=name)


def edit(fn):
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    fn()
    bpy.ops.object.mode_set(mode='OBJECT')


lo = hi.copy()
lo.data = hi.data.copy()
lo.name = 'LO'
bpy.context.scene.collection.objects.link(lo)
bpy.ops.object.select_all(action='DESELECT')
lo.select_set(True)
bpy.context.view_layer.objects.active = lo
lo.data.materials.clear()
edit(lambda: (bpy.ops.mesh.remove_doubles(threshold=0.0005), bpy.ops.mesh.quads_convert_to_tris()))
if solid > 0:
    m = lo.modifiers.new('so', 'SOLIDIFY'); m.thickness = solid; m.offset = 0.0
    apply(lo, 'so')
if voxel > 0:
    m = lo.modifiers.new('rm', 'REMESH'); m.mode = 'VOXEL'; m.voxel_size = voxel; m.adaptivity = 0.0
    apply(lo, 'rm')
    edit(lambda: bpy.ops.mesh.quads_convert_to_tris())
m = lo.modifiers.new('dec', 'DECIMATE'); m.decimate_type = 'COLLAPSE'; m.ratio = min(1.0, tris / max(1, len(lo.data.polygons))); m.use_collapse_triangulate = True
apply(lo, 'dec')
for uv in list(lo.data.uv_layers):
    lo.data.uv_layers.remove(uv)
lo.data.uv_layers.new(name='UVMap')
edit(lambda: (bpy.ops.mesh.normals_make_consistent(inside=False), bpy.ops.uv.smart_project(angle_limit=math.radians(UV_ANGLE), island_margin=0.003, area_weight=0.0, scale_to_bounds=False)))
# 平滑著色、只在大於 SMOOTH_ANGLE 的折角分開法線：減面後預設是逐面平面著色，輸出時每個三角形三個獨立頂點（頂點數＝3×面數），
# 檔案大一倍以上；平滑後頂點只在 UV 縫與折角處分開
bpy.ops.object.select_all(action='DESELECT')
lo.select_set(True)
bpy.context.view_layer.objects.active = lo
bpy.ops.object.shade_smooth_by_angle(angle=math.radians(SMOOTH_ANGLE))
n2 = len(lo.data.polygons)

img = bpy.data.images.new('baked', px, px, alpha=False)
mat = bpy.data.materials.new('baked')
nt = mat.node_tree
bsdf = nt.nodes.get('Principled BSDF')
tn = nt.nodes.new('ShaderNodeTexImage')
tn.image = img
nt.links.new(tn.outputs['Color'], bsdf.inputs['Base Color'])
bsdf.inputs['Roughness'].default_value = 0.85
bsdf.inputs['Metallic'].default_value = 0.0
lo.data.materials.append(mat)
nt.nodes.active = tn

sc = bpy.context.scene
sc.render.engine = 'CYCLES'
sc.cycles.device = 'CPU'
sc.cycles.samples = 1
b = sc.render.bake
b.use_selected_to_active = True
b.cage_extrusion = ext
b.max_ray_distance = ray
b.margin = 8
b.use_clear = True
bpy.ops.object.select_all(action='DESELECT')
hi.select_set(True)
lo.select_set(True)
bpy.context.view_layer.objects.active = lo
bpy.ops.object.bake(type='DIFFUSE', pass_filter={'COLOR'})
img.filepath_raw = dst[:-4] + '.png'
img.file_format = 'PNG'
img.save()

bpy.data.objects.remove(hi, do_unlink=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=dst, export_format='GLB', use_selection=True, export_apply=True, export_yup=True, export_image_format='AUTO', export_tangents=False)
print(f'BAKED {n0} -> {n2} tris, {px} px: {dst}')
