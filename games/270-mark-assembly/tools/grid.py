# 除錯：把裝甲畫成正交前視／側視圖，疊上正規化座標格線（高度比例 u、x/H、y/H），用來量關節位置。
# blender -b ../.cache/<file> --python grid.py -- <model> <out-prefix>
import bpy, sys, os, math, mathutils
sys.path.insert(0, os.path.dirname(__file__))
from common import evaluated_meshes, bounds

argv = sys.argv[sys.argv.index('--') + 1:]
key, out = argv[0], argv[1]
meshes = evaluated_meshes(key)
mn, mx = bounds(meshes)
H = mx.z - mn.z
cx, cy = (mn.x + mx.x) / 2, (mn.y + mx.y) / 2
print('BOUNDS', key, [round(v, 3) for v in mn], [round(v, 3) for v in mx], 'H', round(H, 3))

sc = bpy.data.scenes.new('grid'); bpy.context.window.scene = sc
for name, bm, mats in meshes:
    me = bpy.data.meshes.new(name); bm.to_mesh(me)
    for m in mats: me.materials.append(bpy.data.materials.get(m))
    sc.collection.objects.link(bpy.data.objects.new(name, me))
line = bpy.data.materials.new('gridline'); line.diffuse_color = (0.1, 0.6, 1, 1)
line2 = bpy.data.materials.new('gridline2'); line2.diffuse_color = (1, 0.3, 0.1, 1)


def bar(p, size, mat):
    me = bpy.data.meshes.new('b'); o = bpy.data.objects.new('b', me); sc.collection.objects.link(o)
    import bmesh
    b = bmesh.new(); bmesh.ops.create_cube(b, size=1); b.to_mesh(me); me.materials.append(mat)
    o.location = p; o.scale = size


def label(txt, p, rot):
    cu = bpy.data.curves.new('t', 'FONT'); cu.body = txt; cu.size = H * .018
    o = bpy.data.objects.new('t', cu); o.location = p; o.rotation_euler = rot; o.data.materials.append(line2); sc.collection.objects.link(o)


# 前視：x–z 平面放在模型後方；側視：y–z 平面放在模型左方
for k in range(0, 21):
    u = k / 20; z = mn.z + u * H; w = H * (.0012 if k % 5 else .0025); m = line2 if k % 5 == 0 else line
    bar((cx, mx.y + H * .2, z), (H * 1.2, w, w), m)
    bar((mx.x + H * .3, cy, z), (w, H * 1.2, w), m)
    label(f'{u:.2f}', (cx - H * .55, mx.y + H * .19, z + w), (math.pi / 2, 0, 0))
for k in range(-12, 13):
    v = k / 20; w = H * (.0012 if k % 5 else .0025); m = line2 if k % 5 == 0 else line
    bar((cx + v * H, mx.y + H * .2, mn.z + H / 2), (w, w, H * 1.1), m)
    bar((mx.x + H * .3, cy + v * H, mn.z + H / 2), (w, w, H * 1.1), m)
    label(f'{v:+.2f}', (cx + v * H, mx.y + H * .19, mn.z - H * .03), (math.pi / 2, 0, 0))
    label(f'{v:+.2f}', (mx.x + H * .29, cy + v * H, mn.z - H * .03), (math.pi / 2, 0, -math.pi / 2))

sc.render.engine = 'BLENDER_WORKBENCH'
sh = sc.display.shading; sh.light = 'STUDIO'; sh.color_type = 'MATERIAL'; sh.show_cavity = True
sc.render.resolution_x = sc.render.resolution_y = 1100
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam
cam.data.type = 'ORTHO'; cam.data.ortho_scale = H * 1.25
for tag, loc, rot in [('front', (cx, mn.y - H * 3, mn.z + H / 2), (math.pi / 2, 0, 0)), ('side', (mn.x - H * 3, cy, mn.z + H / 2), (math.pi / 2, 0, -math.pi / 2))]:
    cam.location = loc; cam.rotation_euler = rot; cam.data.clip_end = H * 10
    sc.render.filepath = f'{out}_{tag}.png'; bpy.ops.render.render(write_still=True)
