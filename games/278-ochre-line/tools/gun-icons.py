# 武器剪影：assets/278/ui/<id>.webp，純白透明底，HUD 用 CSS mask 上色。
# blender -b -P tools/gun-icons.py [-- --only m7,n9]
import bpy, os, subprocess, math, sys
from mathutils import Vector
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
OUT = os.path.join(ROOT, 'assets', '278', 'ui'); os.makedirs(OUT, exist_ok=True)
FILES = {'guns_hd.glb': ['ks', 'ar5', 'l40', 'p9'], 'guns.glb': ['v11', 's8', 'r50', 'frag', 'smoke', 'flash', 'knife', 'charge']}
GD = os.path.join(ROOT, 'assets', '278', 'models', 'guns')
for f in sorted(os.listdir(GD)) if os.path.isdir(GD) else []:   # 新槍一把一檔
    if f.endswith('.glb') and not f.endswith('_arms.glb'): FILES['guns/' + f] = [f[:-4]]
a = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
if '--only' in a:
    want = a[a.index('--only') + 1].split(',')
    FILES = {f: [i for i in ids if i in want] for f, ids in FILES.items() if set(ids) & set(want)}
W, H = 320, 120
s = bpy.context.scene
for f, ids in FILES.items():
    bpy.ops.wm.read_factory_settings(use_empty=True); s = bpy.context.scene
    bpy.ops.import_scene.gltf(filepath=os.path.join(ROOT, 'assets', '278', 'models', f))
    s.render.engine = 'BLENDER_WORKBENCH'; sh = s.display.shading; sh.light = 'FLAT'; sh.color_type = 'SINGLE'; sh.single_color = (1, 1, 1)
    s.render.film_transparent = True; s.render.resolution_x = W; s.render.resolution_y = H; s.render.image_settings.file_format = 'PNG'; s.render.image_settings.color_mode = 'RGBA'
    cam = bpy.data.objects.new('c', bpy.data.cameras.new('c')); s.collection.objects.link(cam); s.camera = cam; cam.data.type = 'ORTHO'
    for i in ids:
        ob = bpy.data.objects.get(i)
        if ob is None: print('缺', i); continue
        keep = {ob} | set(ob.children_recursive)
        if f.startswith('guns/') and bpy.data.objects.get(i + '_mag'): keep.add(bpy.data.objects[i + '_mag'])   # 新槍的彈匣是獨立節點
        for o in s.objects:
            if o.type == 'MESH': o.hide_render = o not in keep
        pts = [o.matrix_world @ Vector(c) for o in keep if o.type == 'MESH' for c in o.bound_box]
        lo = Vector([min(p[k] for p in pts) for k in range(3)]); hi = Vector([max(p[k] for p in pts) for k in range(3)]); mid = (lo + hi) / 2
        length, height = hi.y - lo.y, hi.z - lo.z
        cam.data.ortho_scale = max(length * 1.04, height * 1.04 * W / H)
        cam.location = (mid.x + 2, mid.y, mid.z); cam.rotation_euler = (math.pi / 2, 0, math.pi / 2)   # 從 +X 看，槍口朝左
        p = os.path.join(OUT, i + '.png'); s.render.filepath = p; bpy.ops.render.render(write_still=True)
        subprocess.run(['cwebp', '-quiet', '-q', '80', '-alpha_q', '85', p, '-o', os.path.join(OUT, i + '.webp')]); os.remove(p)
        print('icon', i, round(length, 3), round(height, 3))
