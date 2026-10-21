# 把 Blend Swap 的鋼鐵人模型烘成 assets/270/<key>.glb：
#   1. 套用修改器（細分上限見 common.MODELS），拆成相連的零件塊；
#   2. 每塊依中心點歸到最近的「骨段」，得到語意部位（helmet、chestplate、upperArm.L…）；
#   3. 材質依 ROLE_MAP 換成塗裝角色 p 主色／s 副色／t 金屬／k 關節／g 發光，頁面再依 Mark 上色；
#   4. 正面朝 −Y（匯出後是 three 的 +Z）、腳底 z = 0、身高 1.95 m。
# blender -b ../.cache/<file> --python bake.py -- <key> <out.glb> [debug.png]
import bpy, bmesh, sys, os, math, mathutils
from collections import defaultdict, Counter
sys.path.insert(0, os.path.dirname(__file__))
from common import evaluated_meshes, bounds, MODELS

argv = sys.argv[sys.argv.index('--') + 1:]
key, out = argv[0], argv[1]
debug = argv[2] if len(argv) > 2 else None
HEIGHT = 1.95

# 骨架地標：正規化座標 (x/H 角色左為 +, y/H 正面為 −, 高度比例 u)；L 側寫一次，R 側鏡射
LM = {
    'mk3': dict(neck=(0, 0, .855), top=(0, 0, 1), chestTop=(0, 0, .82), chestLow=(0, 0, .64), waist=(0, 0, .58), pelvis=(0, 0, .5),
                shoulder=(.12, 0, .79), elbow=(.15, 0, .63), wrist=(.155, 0, .505), tip=(.155, -.01, .43),
                hip=(.05, 0, .48), knee=(.05, 0, .31), ankle=(.05, 0, .06), toe=(.05, -.06, .01)),
    'mk7': dict(neck=(0, 0, .87), top=(0, 0, 1), chestTop=(0, 0, .84), chestLow=(0, 0, .65), waist=(0, 0, .59), pelvis=(0, 0, .51),
                shoulder=(.13, 0, .8), elbow=(.15, 0, .65), wrist=(.165, 0, .52), tip=(.17, -.01, .45),
                hip=(.055, 0, .49), knee=(.06, 0, .3), ankle=(.07, 0, .06), toe=(.075, -.06, .01)),
    # Bruno 擺姿勢：角色右手前伸、左手垂在腰側，左右各自寫
    'bruno': dict(neck=(0, 0, .85), top=(0, 0, 1), chestTop=(0, 0, .82), chestLow=(0, 0, .64), waist=(0, 0, .58), pelvis=(0, 0, .5),
                  side=dict(L=dict(shoulder=(.12, 0, .8), elbow=(.15, 0, .66), wrist=(.13, 0, .53), tip=(.115, -.02, .48),
                                   hip=(.05, 0, .48), knee=(.08, 0, .3), ankle=(.1, 0, .05), toe=(.11, -.06, .01)),
                            R=dict(shoulder=(-.12, 0, .8), elbow=(-.14, .0, .67), wrist=(-.13, -.08, .69), tip=(-.11, -.15, .7),
                                   hip=(-.05, 0, .48), knee=(-.05, 0, .31), ankle=(-.07, 0, .04), toe=(-.08, -.06, .01)))),
}
LM['mk7s'] = LM['mk7c'] = LM['mk7']
FLIP = {'bruno': True}  # 原檔面向 +Y，轉 180°

ROLE_MAP = {
    'mk3': {'gold': 's', 'red': 'p', 'silver': 't', 'light': 'g'},
    'mk7': {'RedMetal': 'p', 'true gold': 's', 'sliver': 't', 'steel': 't', 'gray': 'k', 'joints': 'k', 'pads': 'k', 'glass': 'g', 'light': 'g', 'redlight': 'g', 'camo': 'p'},
}
ROLE_MAP['mk7s'] = ROLE_MAP['mk7c'] = ROLE_MAP['mk7']


def role_by_color(name):
    m = bpy.data.materials.get(name)
    if not m: return 'k'
    r, g, b = m.diffuse_color[:3]
    lum = .3 * r + .59 * g + .11 * b
    if b > r * 1.3 and b > .3: return 'g'
    if lum > .8: return 'g'
    if r > .15 and r > g * 2.2: return 'p'
    if r > .25 and g > .18 and b < g * .8: return 's'
    if lum > .3: return 't'
    return 'k'


def role_of(name):
    mp = ROLE_MAP.get(key)
    if mp and name in mp: return mp[name]
    return role_by_color(name)


meshes = evaluated_meshes(key)
mn, mx = bounds(meshes)
H = mx.z - mn.z
cx, cy = (mn.x + mx.x) / 2, (mn.y + mx.y) / 2
flip = -1 if FLIP.get(key) else 1


def norm(co):
    return mathutils.Vector(((co.x - cx) / H * flip, (co.y - cy) / H * flip, (co.z - mn.z) / H))


# 骨段
L = LM[key]
segs = []  # (part, a, b, radius)
V = lambda t: mathutils.Vector(t)
segs += [('helmet', V(L['neck']), V(L['top']), .06), ('chest', V(L['chestLow']), V(L['chestTop']), .1),
         ('abdomen', V(L['waist']), V(L['chestLow']), .085), ('pelvis', V(L['pelvis']) - V((0, 0, .03)), V(L['waist']), .085)]
for s, sg in (('L', 1), ('R', -1)):
    if 'side' in L:
        J = {k: V(v) for k, v in L['side'][s].items()}
    else:
        J = {k: V((v[0] * sg, v[1], v[2])) for k, v in L.items() if k in ('shoulder', 'elbow', 'wrist', 'tip', 'hip', 'knee', 'ankle', 'toe')}
    out_dir = V((.03 * sg, 0, .015))
    segs += [('pauldron.' + s, J['shoulder'] + out_dir, J['shoulder'] + out_dir, .045),
             ('upperArm.' + s, J['shoulder'], J['elbow'], .035), ('forearm.' + s, J['elbow'], J['wrist'], .035), ('hand.' + s, J['wrist'], J['tip'], .025),
             ('thigh.' + s, J['hip'], J['knee'], .05), ('shin.' + s, J['knee'], J['ankle'], .045), ('boot.' + s, J['ankle'], J['toe'], .045)]


def seg_dist(p, a, b):
    ab = b - a; l2 = ab.length_squared
    t = 0 if l2 == 0 else max(0, min(1, (p - a).dot(ab) / l2))
    return (p - (a + ab * t)).length


def classify(c):
    best, bd = None, 1e9
    for part, a, b, r in segs:
        d = seg_dist(c, a, b) - r
        if d < bd: best, bd = part, d
    return best


# 拆成相連塊並分類
parts = defaultdict(list)   # part -> [(face verts world co list, role)]
stat = Counter(); rstat = Counter()
for name, bm, mats in meshes:
    bm.faces.ensure_lookup_table(); bm.verts.ensure_lookup_table()
    parent = list(range(len(bm.verts)))
    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]; i = parent[i]
        return i
    for e in bm.edges:
        a, b = find(e.verts[0].index), find(e.verts[1].index)
        if a != b: parent[a] = b
    comps = defaultdict(list)
    for f in bm.faces: comps[find(f.verts[0].index)].append(f)
    for faces in comps.values():
        area = sum(f.calc_area() for f in faces) or 1
        c = sum((f.calc_center_median() * f.calc_area() for f in faces), mathutils.Vector()) / area
        nc = norm(c)
        roles = Counter()
        for f in faces: roles[role_of(mats[f.material_index] if f.material_index < len(mats) else '')] += f.calc_area()
        part = classify(nc)
        # 胸口的發光小件是反應爐
        if part == 'chest' and roles.most_common(1)[0][0] in ('g', 't') and abs(nc.x) < .03 and nc.y < -.01 and area < (H * .06) ** 2:
            part = 'reactor'
        zs = [norm(v.co).z for f in faces for v in f.verts]
        # 骨盆和大腿連成一塊的舊模型：逐面分到骨盆或左右大腿
        split = part == 'pelvis' and max(zs) - min(zs) > .1
        for f in faces:
            r = role_of(mats[f.material_index] if f.material_index < len(mats) else '')
            if split:
                fc = norm(f.calc_center_median())
                part = 'pelvis' if fc.z > .455 or abs(fc.x) < .015 else ('thigh.L' if fc.x > 0 else 'thigh.R')
            parts[part].append(([v.co.copy() for v in f.verts], r, f.smooth))
            stat[part] += 1; rstat[(mats[f.material_index] if f.material_index < len(mats) else '', r)] += 1
print('PARTS', dict(stat))
print('ROLES', rstat.most_common(40))

# 建立新場景，每個部位一個物件
sc = bpy.data.scenes.new('bake'); bpy.context.window.scene = sc
s = HEIGHT / H
ROLE_MATS = {}
for r, col in {'p': (.55, .05, .05), 's': (.8, .6, .25), 't': (.6, .62, .65), 'k': (.08, .08, .09), 'g': (.85, .95, 1)}.items():
    m = bpy.data.materials.new('role_' + r); m.diffuse_color = (*col, 1); ROLE_MATS[r] = m
DEBUG_COL = {}
objs = []
for part, faces in parts.items():
    me = bpy.data.meshes.new(part); bm = bmesh.new()
    vmap = {}
    order = ['p', 's', 't', 'k', 'g']
    used = [r for r in order if any(f[1] == r for f in faces)]
    for vs, r, sm in faces:
        vv = []
        for co in vs:
            k = (round(co.x, 5), round(co.y, 5), round(co.z, 5))
            if k not in vmap:
                n = co.copy(); n.x = (co.x - cx) * flip * s; n.y = (co.y - cy) * flip * s; n.z = (co.z - mn.z) * s
                vmap[k] = bm.verts.new(n)
            vv.append(vmap[k])
        if len(set(vv)) < 3: continue
        try:
            f = bm.faces.new(vv)
        except ValueError:
            continue
        f.material_index = used.index(r); f.smooth = True
    bm.to_mesh(me); bm.free()
    for r in used: me.materials.append(ROLE_MATS[r])
    o = bpy.data.objects.new(part, me); sc.collection.objects.link(o); objs.append(o)
    dec = MODELS[key].get('decimate')
    if dec:
        md = o.modifiers.new('dec', 'DECIMATE'); md.ratio = dec; md.use_collapse_triangulate = True
        dg = bpy.context.evaluated_depsgraph_get()
        nm = bpy.data.meshes.new_from_object(o.evaluated_get(dg), depsgraph=dg)
        o.modifiers.clear(); o.data = nm; me = nm
    for poly in me.polygons: poly.use_smooth = True
    me.set_sharp_from_angle(angle=math.radians(38))

tot = sum(len(o.data.polygons) for o in objs)
print('TOTAL_FACES', tot, 'objects', len(objs))

os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
# 原始場景的物件也可能是選取狀態，只匯出 bake 場景
for s2 in list(bpy.data.scenes):
    if s2 != sc: bpy.data.scenes.remove(s2)
bpy.ops.object.select_all(action='DESELECT')
for o in objs: o.select_set(True)
bpy.context.view_layer.objects.active = objs[0]
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', use_selection=True, use_active_scene=True, export_texcoords=False, export_normals=True,
                          export_materials='EXPORT', export_yup=True, export_apply=False, export_extras=False, export_cameras=False, export_lights=False,
                          export_meshopt_compression_enable=True, export_meshopt_extension='EXT_meshopt_compression')
print('WROTE', out, os.path.getsize(out))

if debug:
    PAL = {'helmet': (.9, .1, .1), 'chest': (.95, .85, .1), 'abdomen': (1, .5, 0), 'pelvis': (.45, .25, .1), 'pauldron': (0, .9, .9), 'upperArm': (.1, .3, 1),
           'forearm': (.6, .1, .9), 'hand': (1, .4, .7), 'thigh': (.1, .8, .1), 'shin': (0, .45, .4), 'boot': (.95, .95, .95), 'reactor': (1, 0, 1)}
    for o in objs:
        base, _, side = o.name.partition('.')
        c = PAL.get(base, (.3, .3, .3)); k = .45 if side == 'R' else 1
        m = bpy.data.materials.new('dbg_' + o.name); m.diffuse_color = (c[0] * k, c[1] * k, c[2] * k, 1)
        o.data.materials.clear(); o.data.materials.append(m)
    sc.render.engine = 'BLENDER_WORKBENCH'
    sh = sc.display.shading; sh.light = 'STUDIO'; sh.color_type = 'MATERIAL'
    sc.render.resolution_x, sc.render.resolution_y = 1400, 900
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam
    cam.data.type = 'ORTHO'; cam.data.ortho_scale = 3.3
    # 前視與 3/4 後視拼在一起：用兩台相機分兩張
    for tag, loc, rot in [('front', (0, -6, .98), (math.pi / 2, 0, 0)), ('back', (4.2, 4.2, .98), (math.pi / 2, 0, math.radians(135)))]:
        cam.location = loc; cam.rotation_euler = rot
        sc.render.filepath = debug.replace('.png', '_' + tag + '.png'); bpy.ops.render.render(write_still=True)
