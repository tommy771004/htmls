"""六器鏢行（274）人物底模建置腳本 → blender/out/actors.glb

素材：Quaternius Universal Base Characters 男女底模、髮型，與 Universal Animation Library 1 的動作（皆 CC0），
放在 ../197-openworld/.cache/。

這裡只處理「形」：
- 收窄四肢與軀幹，改成修長的人形；衣著覆蓋的部位做 Taubin 平滑，抹掉底模的肌肉刻線，再沿法線外推一點布料厚度。
- 身體只留一個材質（皮膚貼圖）。衣著分區、配色、綁腿紋路全部交給前端著色器，依綁定姿勢座標（positionGeometry）上色。
- 髮型各自量過頭骨位置後對齊到該副骨架（女性髮型直接套在男性頭上會低 5 公分）。
- 上衣下襬做成前後兩片布（短打到大腿中段的 _Tails、長衫到膝下的 _Robe），貼著身體最外緣垂下，
  兩側開衩；權重上緣跟骨盆、往下漸漸分給左右大腿。前端依裝扮決定顯示哪一組。
- 兩副骨架都放在原點（前端讀 positionGeometry 做分區，不能有平移）。

座標：輸出的 glTF 是 Y 朝上、人物面向 +Z、左手在 +X。
"""
import math
import os
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.environ.get('QUATERNIUS_CACHE') or os.path.normpath(os.path.join(ROOT, '../197-openworld/.cache'))
UBC = os.path.join(CACHE, 'ubc/Universal Base Characters[Standard]')
BODY = os.path.join(UBC, 'Base Characters/Godot - UE/Superhero_{}_FullBody.gltf')
HAIR = os.path.join(UBC, 'Hairstyles/Rigged to Head Bone/glTF (Godot -Unreal)/{}.gltf')
ANIMS = os.path.join(CACHE, 'ual/Universal Animation Library[Standard]/Unreal-Godot/UAL1_Standard.glb')
OUT = os.path.join(ROOT, 'blender/out/actors.glb')

# 前端 look.hair 0..2 依序對應；鬍子另外開關
HAIRS = {
    'Male': ['Hair_SimpleParted', 'Hair_Long', 'Hair_Buns', 'Hair_Beard'],
    'Female': ['Hair_Buns', 'Hair_Long', 'Hair_BuzzedFemale'],
}
KEEP = [
    'Idle_Loop', 'Sword_Idle', 'Walk_Loop', 'Jog_Fwd_Loop', 'Sprint_Loop',
    'Sword_Attack', 'Punch_Cross', 'Spell_Simple_Shoot', 'Roll',
    'Sitting_Idle_Loop', 'Hit_Chest',
]
# 骨頭收窄比例（相對骨軸的半徑）
SLIM = {
    'Male': {'upperarm_': 0.80, 'lowerarm_': 0.86, 'thigh_': 0.90, 'calf_': 0.92, 'spine_0': 0.90, 'clavicle_': 0.86, 'neck_01': 0.86},
    'Female': {'upperarm_': 0.88, 'lowerarm_': 0.90, 'thigh_': 0.93, 'calf_': 0.94, 'spine_0': 0.94, 'neck_01': 0.90},
}
# 布料厚度（公尺），依骨頭權重混合；頭、手為 0
PUFF = {
    'pelvis': 0.022, 'spine_01': 0.024, 'spine_02': 0.02, 'spine_03': 0.015, 'clavicle_': 0.012,
    'upperarm_': 0.02, 'lowerarm_': 0.018, 'thigh_': 0.018, 'calf_': 0.017, 'foot_': 0.008, 'ball_': 0.006,
}
SKIN_BONES = ('Head', 'hand_', 'index', 'middle', 'pinky', 'ring', 'thumb')


def import_gltf(path, **kw):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path, **kw)
    return [o for o in bpy.data.objects if o not in before]


def strip_maps(m):
    """只留底色貼圖：拆掉法線、粗糙度貼圖，粗糙度改常數"""
    if not m or not m.node_tree:
        return
    nt = m.node_tree
    b = next((n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED'), None)
    if not b:
        return
    for sock, v in (('Roughness', 0.7), ('Metallic', 0.0), ('Normal', None)):
        s = b.inputs[sock]
        for link in list(s.links):
            nt.links.remove(link)
        if v is not None:
            s.default_value = v


def prefix_val(table, name, default=None):
    return next((v for p, v in table.items() if name.startswith(p)), default)


def shape_body(body, arm, g):
    me = body.data
    groups = {vg.index: vg.name for vg in body.vertex_groups}
    bones = arm.data.bones
    inv = body.matrix_world.inverted() @ arm.matrix_world

    # 1. 收窄：把頂點往所屬骨軸拉近
    segs = {}
    for b in bones:
        k = prefix_val(SLIM[g], b.name)
        if k is not None:
            segs[b.name] = (inv @ b.head_local, inv @ b.tail_local, k)
    for v in me.vertices:
        acc = Vector((0, 0, 0))
        tw = 0.0
        for gr in v.groups:
            name = groups.get(gr.group, '')
            w = gr.weight
            if w <= 0:
                continue
            tw += w
            sg = segs.get(name)
            if not sg:
                acc += v.co * w
                continue
            a, b2, k = sg
            ab = b2 - a
            t = max(0.0, min(1.0, (v.co - a).dot(ab) / max(ab.length_squared, 1e-9)))
            c = a + ab * t
            acc += (c + (v.co - c) * k) * w
        if tw > 0:
            v.co = acc / tw

    # 每個頂點的「布料遮罩」與厚度：頭、手的權重越高越接近 0
    skin_w = [0.0] * len(me.vertices)
    puff = [0.0] * len(me.vertices)
    for v in me.vertices:
        tw = sum(gr.weight for gr in v.groups) or 1.0
        s = 0.0
        p = 0.0
        for gr in v.groups:
            name = groups.get(gr.group, '')
            w = gr.weight / tw
            if name.startswith(SKIN_BONES):
                s += w
            elif name == 'neck_01':
                s += w * 0.85
            p += w * prefix_val(PUFF, name, 0.0)
        skin_w[v.index] = min(1.0, s)
        puff[v.index] = p * (1.0 - min(1.0, s))

    # 2. 衣著部位做 Taubin 平滑（λ／μ 交替，不會整體縮小），抹掉腹肌與胸肌刻線
    nbr = [[] for _ in me.vertices]
    for e in me.edges:
        a, b = e.vertices
        nbr[a].append(b)
        nbr[b].append(a)
    mask = [(1.0 - s) ** 2 for s in skin_w]
    co = [v.co.copy() for v in me.vertices]
    for it in range(24):
        lam = 0.5 if it % 2 == 0 else -0.53
        nxt = []
        for i, c in enumerate(co):
            n = nbr[i]
            if not n or mask[i] <= 0:
                nxt.append(c)
                continue
            avg = Vector((0, 0, 0))
            for j in n:
                avg += co[j]
            avg /= len(n)
            nxt.append(c + (avg - c) * (lam * mask[i]))
        co = nxt
    # 腳：再多抹幾輪，把腳趾併成布鞋的鞋頭
    foot = []
    for v in me.vertices:
        tw = sum(gr.weight for gr in v.groups) or 1.0
        fw = sum(gr.weight for gr in v.groups if groups.get(gr.group, '').startswith(('ball_', 'foot_'))) / tw
        low = max(0.0, min(1.0, (0.075 - v.co.z) / 0.03)) if body.matrix_world.is_identity else 1.0
        foot.append(min(1.0, fw * 1.4) * low)
    for it in range(30):
        nxt = []
        for i, c in enumerate(co):
            n = nbr[i]
            if not n or foot[i] <= 0:
                nxt.append(c)
                continue
            avg = Vector((0, 0, 0))
            for j in n:
                avg += co[j]
            avg /= len(n)
            nxt.append(c + (avg - c) * (0.5 * foot[i]))
        co = nxt
    for v, c in zip(me.vertices, co):
        v.co = c
    me.update()

    # 3. 沿（平滑後的）法線外推布料厚度
    normals = [v.normal.copy() for v in me.vertices]
    for v in me.vertices:
        d = puff[v.index]
        if d > 0:
            v.co += normals[v.index] * d
    for p in me.polygons:
        p.use_smooth = True
    me.update()


def build_tails(arm, body, g, name, length, flare):
    """上衣下襬：前後兩片布，沿身體最外緣下垂（不貼進胯下），有厚度，兩側開衩"""
    me_b = body.data
    mw = body.matrix_world
    verts = [mw @ v.co for v in me_b.vertices]
    bvh = BVHTree.FromPolygons(verts, [tuple(p.vertices) for p in me_b.polygons])
    bones = arm.data.bones
    pel = arm.matrix_world @ bones['pelvis'].head_local
    sp1 = arm.matrix_world @ bones['spine_01'].head_local
    belt = pel.z + (sp1.z - pel.z) * 0.55
    z0 = belt - 0.015
    z1 = pel.z - length
    cx, cy = 0.0, pel.y + 0.01
    rows, cols = (9, 15) if length < 0.3 else (14, 15)
    panels = [(-math.radians(80), math.radians(80), 0.85), (math.radians(100), math.radians(260), 0.55)]
    me = bpy.data.meshes.new(f'{g}_{name}Mesh')
    vs, fs, wts = [], [], []
    for a0, a1, legmax in panels:
        grid = []
        for c in range(cols):
            phi = a0 + (a1 - a0) * c / (cols - 1)
            d = Vector((math.sin(phi), -math.cos(phi), 0.0))
            rmax = 0.0
            col = []
            for r in range(rows):
                t = r / (rows - 1)
                z = z0 + (z1 - z0) * t
                o = Vector((cx, cy, z)) + d * 0.6
                hit = bvh.ray_cast(o, -d, 0.6)
                rb = (Vector((hit[0].x - cx, hit[0].y - cy, 0)).length) if hit[0] is not None else 0.0
                rmax = max(rmax, rb)
                rr = rmax + 0.012 + flare * t * t
                col.append((Vector((cx, cy, z)) + d * rr, d, t))
            grid.append(col)
        # 外層與內層（往內 5 mm、面朝內）
        base = len(vs)
        for shell, off in ((0, 0.0), (1, -0.005)):
            for c in range(cols):
                for r in range(rows):
                    pnt, d, t = grid[c][r]
                    vs.append(pnt + d * off)
                    wts.append((t, pnt.x, legmax))
        idx = lambda shell, c, r: base + shell * cols * rows + c * rows + r
        for c in range(cols - 1):
            for r in range(rows - 1):
                fs.append((idx(0, c, r), idx(0, c, r + 1), idx(0, c + 1, r + 1), idx(0, c + 1, r)))
                fs.append((idx(1, c, r), idx(1, c + 1, r), idx(1, c + 1, r + 1), idx(1, c, r + 1)))
        # 下緣與兩側的布邊
        for c in range(cols - 1):
            fs.append((idx(0, c, rows - 1), idx(1, c, rows - 1), idx(1, c + 1, rows - 1), idx(0, c + 1, rows - 1)))
        for r in range(rows - 1):
            fs.append((idx(0, 0, r), idx(1, 0, r), idx(1, 0, r + 1), idx(0, 0, r + 1)))
            fs.append((idx(0, cols - 1, r), idx(0, cols - 1, r + 1), idx(1, cols - 1, r + 1), idx(1, cols - 1, r)))
    me.from_pydata([tuple(v) for v in vs], [], fs)
    uvl = me.uv_layers.new(name='UVMap')  # 與身體同一個材質，著色器會取 uv；全設 0，免得匯出時頂點被拆開
    for lp in uvl.data:
        lp.uv = (0.0, 0.0)
    me.update()
    # 面的繞序在上面已逐一排成朝外（外層朝外、內層朝內、布邊朝外），不交給自動重算：開口網格會被翻錯
    for p in me.polygons:
        p.use_smooth = True
    me.materials.append(body.data.materials[0])
    obj = bpy.data.objects.new(f'{g}_{name}', me)
    bpy.context.scene.collection.objects.link(obj)
    obj.parent = arm
    mod = obj.modifiers.new('Armature', 'ARMATURE')
    mod.object = arm
    vp = obj.vertex_groups.new(name='pelvis')
    vl = obj.vertex_groups.new(name='thigh_l')
    vr = obj.vertex_groups.new(name='thigh_r')
    for i, (t, x, legmax) in enumerate(wts):
        k = max(0.0, min(1.0, (t - 0.12) / 0.88))
        leg = legmax * k * k * (3 - 2 * k)
        sl = max(0.0, min(1.0, 0.5 + x / 0.09))
        sl = sl * sl * (3 - 2 * sl)
        vp.add([i], 1.0 - leg, 'REPLACE')
        if leg * sl > 1e-3:
            vl.add([i], leg * sl, 'REPLACE')
        if leg * (1 - sl) > 1e-3:
            vr.add([i], leg * (1 - sl), 'REPLACE')
    return obj


bpy.ops.wm.read_factory_settings(use_empty=True)

for g in ('Male', 'Female'):
    objs = import_gltf(BODY.format(g), merge_vertices=True)
    arm = next(o for o in objs if o.type == 'ARMATURE')
    arm.name = g
    arm.data.name = g
    body = next(o for o in objs if o.type == 'MESH' and o.name.lower().startswith('superhero'))
    for o in objs:
        if o.type == 'MESH' and o.parent is None:
            bpy.data.objects.remove(o, do_unlink=True)
    body.name = f'{g}_Body'
    for o in arm.children:
        if o.type == 'MESH' and o is not body:
            o.name = f'{g}_{"Eyes" if "eye" in o.name.lower() and "brow" not in o.name.lower() else "Brows"}'

    # 皮膚：換成淺膚色底圖，拆掉其他貼圖；全身只留這一個材質
    skin = body.data.materials[0]
    skin.name = f'{g}_skin'
    strip_maps(skin)
    light = os.path.join(UBC, 'Base Characters/Textures', 'T_Superhero_Male_Ligh.png' if g == 'Male' else 'T_Superhero_Female_Light_BaseColor.png')
    tex = next((n for n in skin.node_tree.nodes if n.type == 'TEX_IMAGE' and n.image and 'normal' not in n.image.name.lower() and 'rough' not in n.image.name.lower()), None)
    if tex:
        tex.image = bpy.data.images.load(light)
    me = body.data
    me.materials.clear()
    me.materials.append(skin)
    for p in me.polygons:
        p.material_index = 0

    # 合併頂點後原本的自訂法線已失效，清掉改用平滑著色
    bpy.context.view_layer.objects.active = body
    body.select_set(True)
    try:
        bpy.ops.mesh.customdata_custom_splitnormals_clear()
    except Exception as e:  # noqa: BLE001
        print('clear custom normals failed:', e)
    body.select_set(False)

    shape_body(body, arm, g)
    build_tails(arm, body, g, 'Tails', 0.2, 0.03)
    build_tails(arm, body, g, 'Robe', 0.5, 0.07)

    head_bone = arm.data.bones['Head']
    head_at = arm.matrix_world @ head_bone.head_local

    # 髮型：各自的骨架量出頭骨位置，平移到這副骨架的頭上
    for hn in HAIRS[g]:
        hobjs = import_gltf(HAIR.format(hn))
        harm = next(o for o in hobjs if o.type == 'ARMATURE')
        hmesh = next(o for o in hobjs if o.type == 'MESH' and o.parent is harm)
        hb = harm.data.bones.get('Head')
        delta = head_at - (harm.matrix_world @ hb.head_local) if hb else Vector((0, 0, 0))
        mw = hmesh.matrix_world.copy()
        hmesh.parent = arm
        hmesh.matrix_parent_inverse.identity()
        hmesh.matrix_world = mw
        if delta.length > 1e-4:
            print(f'{g} {hn}: shift hair by {tuple(round(x, 4) for x in delta)}')
            for v in hmesh.data.vertices:
                v.co += hmesh.matrix_world.inverted().to_3x3() @ delta
        for mod in hmesh.modifiers:
            if mod.type == 'ARMATURE':
                mod.object = arm
        hmesh.name = f'{g}_{hn}'
        for o in hobjs:
            if o is not hmesh:
                bpy.data.objects.remove(o, do_unlink=True)

    # 量測用：印出綁定姿勢的關節位置（glTF 座標：x, z, -y）
    for bn in ('pelvis', 'spine_01', 'spine_02', 'spine_03', 'neck_01', 'Head', 'upperarm_l', 'lowerarm_l', 'hand_l', 'thigh_l', 'calf_l', 'foot_l', 'ball_l'):
        p = arm.matrix_world @ arm.data.bones[bn].head_local
        print(f'BONE {g} {bn} {p.x:.3f} {p.z:.3f} {-p.y:.3f}')

for m in bpy.data.materials:
    strip_maps(m)
for o in bpy.data.objects:
    if o.type == 'MESH':
        for i, m in enumerate(o.data.materials):
            if m and '.' in m.name and m.name.split('.')[0] in bpy.data.materials:
                o.data.materials[i] = bpy.data.materials[m.name.split('.')[0]]

for img in list(bpy.data.images):
    if img.users == 0 or 'normal' in img.name.lower() or 'rough' in img.name.lower() or 'Dark' in img.name:
        bpy.data.images.remove(img)
        continue
    if img.size[0] > 512:
        img.scale(512, 512)

# 動作庫：只留要用的動作
anim_objs = import_gltf(ANIMS)
for a in list(bpy.data.actions):
    if any(a.name.startswith(k) for k in KEEP):
        a.use_fake_user = True
    else:
        bpy.data.actions.remove(a)
for o in anim_objs:
    bpy.data.objects.remove(o, do_unlink=True)
for a in bpy.data.actions:
    for k in KEEP:
        if a.name.startswith(k):
            a.name = k

arm = bpy.data.objects['Male']
arm.animation_data_create()
arm.animation_data.action = None
for a in bpy.data.actions:
    if a.name not in KEEP:
        continue
    t = arm.animation_data.nla_tracks.new()
    t.name = a.name
    s = t.strips.new(a.name, int(a.frame_range[0]), a)
    if getattr(a, 'slots', None) and len(a.slots):
        try:
            s.action_slot = a.slots[0]
        except Exception:  # noqa: BLE001
            pass

print('Exported actions:', sorted(a.name for a in bpy.data.actions))

os.makedirs(os.path.dirname(OUT), exist_ok=True)
bpy.ops.export_scene.gltf(
    filepath=OUT,
    export_format='GLB',
    export_animation_mode='NLA_TRACKS',
    export_image_format='WEBP',
    export_image_quality=82,
    export_texcoords=True,
    export_normals=True,
    export_skins=True,
    export_morph=False,
    export_force_sampling=True,
    export_optimize_animation_size=True,
    export_def_bones=False,
    export_frame_step=2,
)
print('Wrote GLB:', OUT, os.path.getsize(OUT), 'bytes')
