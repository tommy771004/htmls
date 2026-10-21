# 把 Blend Swap 的鋼鐵人模型烘成 assets/270/<key>.glb：
#   1. 套用修改器（細分上限見 common.MODELS），拆成相連的零件塊；
#   2. 每塊依中心點歸到最近的「骨段」，得到語意部位（helmet、chestplate、upperArm.L…）；
#   3. 材質依 ROLE_MAP 換成塗裝角色 p 主色／s 副色／t 金屬／k 關節／g 發光，頁面再依 Mark 上色；
#   4. 正面朝 −Y（匯出後是 three 的 +Z）、腳底 z = 0、身高 1.95 m。
# blender -b ../.cache/<file> --python bake.py -- <key> <out.glb> [debug.png]
# GLB 來源不必開 .blend：blender -b --factory-startup --python bake.py -- mk46 <out.glb>
import bpy, bmesh, sys, os, math, mathutils
import numpy as np
from collections import defaultdict, Counter
sys.path.insert(0, os.path.dirname(__file__))
from common import evaluated_meshes, bounds, bone_key, MODELS

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
LM.update({
    # Mark 1：右手（−x）掛著噴火器，兩側不對稱
    'mk1': dict(neck=(0, .03, .86), top=(0, .04, 1), chestTop=(0, 0, .84), chestLow=(0, 0, .62), waist=(0, 0, .56), pelvis=(0, 0, .5),
                side=dict(L=dict(shoulder=(.21, 0, .8), elbow=(.26, 0, .66), wrist=(.29, 0, .55), tip=(.31, -.01, .48),
                                 hip=(.08, 0, .48), knee=(.1, 0, .3), ankle=(.12, 0, .05), toe=(.12, -.05, .01)),
                          R=dict(shoulder=(-.2, 0, .8), elbow=(-.24, 0, .66), wrist=(-.29, 0, .53), tip=(-.3, -.01, .47),
                                 hip=(-.08, 0, .48), knee=(-.1, 0, .3), ankle=(-.12, 0, .05), toe=(-.12, -.05, .01)))),
    # Mark 38 Igor：頭前傾、手臂掛在大肩箱下方
    'mk38': dict(neck=(0, -.13, .76), top=(0, -.17, .93), chestTop=(0, .03, .8), chestLow=(0, .03, .58), waist=(0, .03, .5), pelvis=(0, .03, .44),
                 shoulder=(.31, .05, .8), elbow=(.32, .05, .66), wrist=(.33, .05, .4), tip=(.33, .03, .28), pad=(.335, .05, .84),
                 hip=(.11, 0, .42), knee=(.13, 0, .25), ankle=(.14, .02, .08), toe=(.14, -.08, .01)),
    'mk46': dict(neck=(0, 0, .87), top=(0, 0, 1), chestTop=(0, 0, .84), chestLow=(0, 0, .66), waist=(0, 0, .6), pelvis=(0, 0, .52),
                 shoulder=(.1, 0, .8), elbow=(.15, 0, .64), wrist=(.19, 0, .52), tip=(.2, -.01, .45),
                 hip=(.05, 0, .5), knee=(.055, 0, .29), ankle=(.06, 0, .05), toe=(.06, -.05, .01)),
    'mk85': dict(neck=(0, 0, .85), top=(0, 0, 1), chestTop=(0, 0, .82), chestLow=(0, 0, .64), waist=(0, 0, .58), pelvis=(0, 0, .5),
                 shoulder=(.12, 0, .8), elbow=(.16, 0, .65), wrist=(.19, 0, .53), tip=(.2, -.01, .45),
                 hip=(.05, 0, .48), knee=(.06, 0, .28), ankle=(.07, 0, .05), toe=(.07, -.05, .01)),
})
LM['mk47'] = LM['mk46']
RSCALE = {'mk1': 1.4, 'mk38': 2}  # 體型粗壯的模型骨段半徑放大
FLIP = {'bruno': True}  # 原檔面向 +Y，轉 180°

ROLE_MAP = {
    'mk3': {'gold': 's', 'red': 'p', 'silver': 't', 'light': 'g'},
    'mk7': {'RedMetal': 'p', 'true gold': 's', 'sliver': 't', 'steel': 't', 'gray': 'k', 'joints': 'k', 'pads': 'k', 'glass': 'g', 'light': 'g', 'redlight': 'g', 'camo': 'p'},
}
ROLE_MAP['mk7s'] = ROLE_MAP['mk7c'] = ROLE_MAP['mk7']
ROLE_MAP.update({
    # Mark 1：鑄鐵外殼是主色，皮革內襯、帶子、手套是關節，管線與箱子是金屬
    'mk1': {'second_protection_Iron': 'p', 'first_protection_leather': 'k', 'strap': 'k', 'glove': 'k', 'Plastic': 'k', 'pipe': 't', 'metal_box': 't',
            'gas_cylinder': 's', 'material': 't', 'Reactor': 'g'},
    'mk38': {'Material.003': 'p', 'Material.008': 's', 'Material.005': 't', 'Material.010': 't', 'Material.009': 'k', 'Material.011': 'k', 'Material.007': 'g'},
    'mk46': {'RS_Material_1': 'p', 'RS_Material': 's', 'material_0': 's', 'Metal': 't', 'Body': 'k', 'emmision': 'g'},
    'mk47': {'RS_Material_1': 'p', 'Material.003': 'p', 'RS_Material': 's', 'Metal': 'k', 'Body': 'k', 'Material': 'k', 'Material.005': 'k', 'emmision': 'g', 'Material.001': 'g'},
    # 右手套的六顆寶石保留原色：角色寫成 g_<色碼>，頁面讀材質名 role_g_<色碼>
    'mk85': {'Mat.1': 'p', 'Mat.2': 's', 'material': 'k', 'material_3': 'g', 'material_4': 'g', 'material_5': 'g_30ff70', 'material_6': 'g_ffd030',
             'material_7': 'g_ff3030', 'material_8': 'g_a040ff', 'material_9': 'g_3080ff', 'material_10': 'g_ff8a20'},
})
# swat_ 骨架（Mixamo 命名）→ 部位
BONE_PART = {'Hips': 'pelvis', 'rootJoint': 'pelvis', '': 'pelvis', 'Spine': 'abdomen', 'Spine1': 'chest', 'Spine2': 'chest', 'Neck': 'helmet', 'Neck1': 'helmet', 'Head': 'helmet',
             'Head_end': 'helmet'}
for _s, _S in (('Left', 'L'), ('Right', 'R')):
    BONE_PART.update({_s + 'Shoulder': 'pauldron.' + _S, _s + 'Arm': 'upperArm.' + _S, _s + 'ForeArm': 'forearm.' + _S, _s + 'UpLeg': 'thigh.' + _S,
                      _s + 'Leg': 'shin.' + _S, _s + 'Foot': 'boot.' + _S, _s + 'ToeBase': 'boot.' + _S, _s + 'ToeBase_end': 'boot.' + _S})


def bone_part(name):
    k = bone_key(name).lstrip('_')
    if k in BONE_PART: return BONE_PART[k]
    for s, S in (('Left', 'L'), ('Right', 'R')):
        if k.startswith(s + 'Hand'): return 'hand.' + S
    return None


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
RS = RSCALE.get(key, 1)
for s, sg in (('L', 1), ('R', -1)):
    if 'side' in L:
        J = {k: V(v) for k, v in L['side'][s].items()}
    else:
        J = {k: V((v[0] * sg, v[1], v[2])) for k, v in L.items() if k in ('shoulder', 'elbow', 'wrist', 'tip', 'hip', 'knee', 'ankle', 'toe')}
    out_dir = V((.03 * sg, 0, .015))
    pad = V((L['pad'][0] * sg, *L['pad'][1:])) if 'pad' in L else J['shoulder'] + out_dir
    segs += [('pauldron.' + s, pad, pad, .045),
             ('upperArm.' + s, J['shoulder'], J['elbow'], .035), ('forearm.' + s, J['elbow'], J['wrist'], .035), ('hand.' + s, J['wrist'], J['tip'], .025),
             ('thigh.' + s, J['hip'], J['knee'], .05), ('shin.' + s, J['knee'], J['ankle'], .045), ('boot.' + s, J['ankle'], J['toe'], .045)]
segs = [(p, a, b, r * RS) for p, a, b, r in segs]


def seg_dist(p, a, b):
    ab = b - a; l2 = ab.length_squared
    t = 0 if l2 == 0 else max(0, min(1, (p - a).dot(ab) / l2))
    return (p - (a + ab * t)).length


SA = np.array([a for _, a, _, _ in segs]); SB = np.array([b for _, _, b, _ in segs]); SR = np.array([r for *_, r in segs])


def classify_many(pts):
    """pts (N,3) 正規化座標 → 每點最近骨段的部位名（numpy 分批）"""
    out = []
    ab = SB - SA; l2 = np.maximum((ab ** 2).sum(1), 1e-12)
    for i in range(0, len(pts), 40000):
        p = pts[i:i + 40000, None, :]
        t = np.clip(((p - SA) * ab).sum(2) / l2, 0, 1)
        d = np.linalg.norm(p - (SA + ab * t[..., None]), axis=2) - SR
        out += [segs[j][0] for j in d.argmin(1)]
    return out


def classify(c):
    best, bd = None, 1e9
    for part, a, b, r in segs:
        d = seg_dist(c, a, b) - r
        if d < bd: best, bd = part, d
    return best


# 拆成相連塊並分類
parts = defaultdict(list)   # part -> [(face verts world co list, role)]
stat = Counter(); rstat = Counter()
cfg = MODELS[key]
for name, bm, mats, wts in meshes:
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
        # 逐面部位：有骨架看權重，split 模型看最近骨段；整塊有八成以上屬於同一部位就整塊歸過去，否則逐面切開
        fparts = None
        if cfg.get('bones'):
            fparts = []
            for f in faces:
                acc = Counter()
                for v in f.verts:
                    for b, w in wts[v.index].items():
                        acc[bone_part(b)] += w
                acc.pop(None, None)
                fp = acc.most_common(1)[0][0] if acc else classify(norm(f.calc_center_median()))
                # Mixamo 的 Shoulder 權重只到斜方肌，三角肌上的護甲分給 Arm：上臂靠肩的三成改成肩甲
                if fp.startswith('upperArm'):
                    sd = fp[-1]; sg = 1 if sd == 'L' else -1
                    a = V((L['shoulder'][0] * sg, *L['shoulder'][1:])); b = V((L['elbow'][0] * sg, *L['elbow'][1:]))
                    if (norm(f.calc_center_median()) - a).dot(b - a) / (b - a).length_squared < .28: fp = 'pauldron.' + sd
                fparts.append(fp)
        elif cfg.get('split'):
            fparts = classify_many(np.array([tuple(norm(f.calc_center_median())) for f in faces]))
        if fparts:
            share = Counter()
            for f, fp in zip(faces, fparts): share[fp] += f.calc_area()
            part, top = share.most_common(1)[0]
            if top >= cfg.get('share', .8) * sum(share.values()): fparts = None
        else:
            part = classify(nc)
        # 胸口的發光小件是反應爐
        if part == 'chest' and roles.most_common(1)[0][0] in ('g', 't') and abs(nc.x) < .03 and nc.y < -.01 and area < (H * .06) ** 2:
            part = 'reactor'; fparts = None
        zs = [norm(v.co).z for f in faces for v in f.verts]
        # 骨盆和大腿連成一塊的舊模型：逐面分到骨盆或左右大腿
        split = part == 'pelvis' and max(zs) - min(zs) > .1 and not cfg.get('bones') and not cfg.get('split')
        for fi, f in enumerate(faces):
            r = role_of(mats[f.material_index] if f.material_index < len(mats) else '')
            if fparts:
                part = fparts[fi]
            elif split:
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
    used = sorted({f[1] for f in faces}, key=lambda r: ('pstkg'.index(r[0]), r))
    for r in used:
        if r not in ROLE_MATS:
            m = bpy.data.materials.new('role_' + r); m.diffuse_color = ROLE_MATS['g'].diffuse_color; ROLE_MATS[r] = m
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
