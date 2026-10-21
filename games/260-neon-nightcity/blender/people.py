"""霓虹夜城（260）的人物，改自 268 TERRA 的同名腳本：Quaternius Universal Base Characters 男女底模＋ Universal Animation Library 動畫（皆 CC0），
輸出 blender/out/people.glb（打包時以 gzip＋base64 內嵌）。

    /Applications/Blender.app/Contents/MacOS/Blender -b -P blender/people.py

素材包由 games/197-openworld/tools/fetch-quaternius.py 下載到 games/197-openworld/.cache/（或設 QUATERNIUS_CACHE）。
- 依每個面的主要骨頭與高度把身體分成 skin／top（上衣）／sleeve（前臂：長袖或露手）／bottom（短褲到膝）／
  shin（小腿：長褲或露腿）／shoe 六個材質，衣物頂點沿法線外推一點做出厚度；前端依路人編號換色、換髮型。
- 男女各掛三種髮型（男：旁分、平頭、平頭＋鬍子；女：長髮、包頭、短髮），眉毛與眼睛沿用底模。
- 動畫：從 UAL 挑出待機、說話、行走、慢跑、衝刺、坐、坐著聊天、駕駛、跳舞與出拳（見 KEEP）；
  板子與單車的 IK 烘焙函式沿用 268 的寫法，260 目前沒有用到。
- 貼圖縮成 512、皮膚存 JPEG；法線與粗糙度貼圖不輸出。
"""
import math
import os

import bpy
from mathutils import Quaternion, Vector

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.environ.get('QUATERNIUS_CACHE') or os.path.normpath(os.path.join(ROOT, '../197-openworld/.cache'))
UBC = os.path.join(CACHE, 'ubc/Universal Base Characters[Standard]')
BODY = os.path.join(UBC, 'Base Characters/Godot - UE/Superhero_{}_FullBody.gltf')
HAIR = os.path.join(UBC, 'Hairstyles/Rigged to Head Bone/glTF (Godot -Unreal)/{}.gltf')
ANIMS = os.path.join(CACHE, 'ual/Universal Animation Library[Standard]/Unreal-Godot/UAL1_Standard.glb')
OUT = os.path.join(ROOT, 'blender/out/people.glb')
HAIRS = {'Male': ['Hair_SimpleParted', 'Hair_Buzzed', 'Hair_Beard'], 'Female': ['Hair_Long', 'Hair_Buns', 'Hair_BuzzedFemale']}
# 夜城用得到的動作；調酒、DJ、撐傘、抽菸、抱胸由前端在這些動作上覆寫骨頭旋轉（40-people.js）
KEEP = ['Idle_Loop', 'Idle_Talking_Loop', 'Walk_Loop', 'Walk_Formal_Loop', 'Jog_Fwd_Loop', 'Sprint_Loop', 'Sitting_Idle_Loop',
        'Sitting_Talking_Loop', 'Driving_Loop', 'Dance_Loop', 'Punch_Jab', 'Punch_Cross']
SLOTS = ['skin', 'top', 'sleeve', 'bottom', 'shin', 'shoe']
SLIM = {
    'Male': {'upperarm_': 0.78, 'lowerarm_': 0.84, 'thigh_': 0.9, 'calf_': 0.93, 'spine_0': 0.9, 'clavicle_': 0.88, 'neck_01': 0.86},
    'Female': {'upperarm_': 0.88, 'lowerarm_': 0.9, 'thigh_': 0.95, 'spine_0': 0.95, 'neck_01': 0.92},
}
PUFF = {'top': 0.012, 'sleeve': 0.01, 'bottom': 0.011, 'shin': 0.008, 'shoe': 0.022}


def import_gltf(path):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    return [o for o in bpy.data.objects if o not in before]


def plain(name, rgb):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    b.inputs['Base Color'].default_value = (*rgb, 1)
    b.inputs['Roughness'].default_value = 0.88
    return m


def strip_maps(m):
    """只留底色貼圖：拔掉法線、粗糙度、金屬度的連線"""
    if not m or not m.node_tree:
        return
    nt = m.node_tree
    b = next((n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED'), None)
    if not b:
        return
    for sock, v in (('Roughness', 0.7), ('Metallic', 0.0), ('Normal', None)):
        s = b.inputs[sock]
        for l in list(s.links):
            nt.links.remove(l)
        if v is not None:
            s.default_value = v


bpy.ops.wm.read_factory_settings(use_empty=True)
CLOTH = {}
for gi, g in enumerate(('Male', 'Female')):
    objs = import_gltf(BODY.format(g))
    arm = next(o for o in objs if o.type == 'ARMATURE')
    arm.name = g
    arm.data.name = g
    body = next(o for o in objs if o.type == 'MESH' and o.name.lower().startswith('superhero'))
    for o in objs:
        if o.type == 'MESH' and o.parent is None:
            bpy.data.objects.remove(o, do_unlink=True)  # 匯入器帶進來的 Icosphere
    body.name = f'{g}_Body'
    for o in arm.children:
        if o.type == 'MESH' and o is not body:
            o.name = f'{g}_{"Eyes" if "eye" in o.name.lower() and "brow" not in o.name.lower() else "Brows"}'
    bones = arm.data.bones
    P = {n: arm.matrix_world @ bones[n].head_local for n in ('pelvis', 'Head', 'neck_01', 'upperarm_l', 'calf_l', 'foot_l')}
    knee = P['calf_l'].z
    # 材質：skin 沿用底模（帶貼圖），其餘是前端會換色的素色
    skin = body.data.materials[0]
    skin.name = f'{g}_skin'
    strip_maps(skin)
    # 匯入的是深膚色貼圖，換成淺膚色（前端用乘色做出不同膚色）
    light = os.path.join(UBC, 'Base Characters/Textures', 'T_Superhero_Male_Ligh.png' if g == 'Male' else 'T_Superhero_Female_Light_BaseColor.png')
    tex = next((n for n in skin.node_tree.nodes if n.type == 'TEX_IMAGE' and n.image and 'normal' not in n.image.name.lower() and 'rough' not in n.image.name.lower()), None)
    if tex:
        tex.image = bpy.data.images.load(light)
    me = body.data
    me.materials.clear()
    mats = {'skin': skin}
    for s in SLOTS[1:]:
        mats[s] = plain(f'{g}_{s}', {'top': (0.8, 0.35, 0.12), 'sleeve': (0.8, 0.35, 0.12), 'bottom': (0.22, 0.25, 0.3), 'shin': (0.22, 0.25, 0.3), 'shoe': (0.3, 0.3, 0.32)}[s])
    for s in SLOTS:
        me.materials.append(mats[s])
    groups = {vg.index: vg.name for vg in body.vertex_groups}

    def bone_of(v):
        best, bw = '', 0
        for gr in v.groups:
            if gr.weight > bw:
                best, bw = groups.get(gr.group, ''), gr.weight
        return best

    vb = [bone_of(v) for v in me.vertices]
    nk = P['neck_01']

    def neck_cut(c):
        front = max(0.0, min(1.0, (nk.y - c.y) / 0.08))  # 模型面向 -Y
        return nk.z + 0.01 - 0.04 * front
    sx = abs(P['upperarm_l'].x)
    for poly in me.polygons:
        c = body.matrix_world @ poly.center
        votes = {}
        for vi in poly.vertices:
            b = vb[vi]
            if b == 'Head':
                k = 'skin'
            elif b in ('neck_01', 'spine_03') or b.startswith('clavicle_'):
                # 圓領：頸部範圍內依高度切（前面低一點），比依骨頭權重切的邊緣平整
                k = 'skin' if c.z > nk.z + 0.05 or (c.z > neck_cut(c) and ((c.x - nk.x) / 0.1) ** 2 + ((c.y - nk.y) / 0.12) ** 2 < 1) else 'top'
            elif b.startswith(('hand_', 'index', 'middle', 'pinky', 'ring', 'thumb')):
                k = 'skin'
            elif b.startswith(('foot_', 'ball_')):
                k = 'shoe'
            elif b.startswith(('thigh_', 'calf_')):
                k = 'shoe' if c.z < P['foot_l'].z + 0.07 else 'bottom' if c.z > knee + 0.03 else 'shin'
            elif b.startswith('lowerarm_'):
                k = 'sleeve'
            elif b.startswith('upperarm_'):
                k = 'top' if abs(c.x) - sx < 0.17 else 'sleeve'
            elif b in ('pelvis', 'root', 'spine_01') and c.z < P['pelvis'].z + 0.07:
                k = 'bottom'
            else:
                k = 'top'
            votes[k] = votes.get(k, 0) + 1
        poly.material_index = SLOTS.index(max(votes, key=votes.get))
    # 超級英雄底模太壯：依骨頭權重把頂點往骨頭軸線收（手臂、大腿、胸腹），權重混合避免關節出現斷層
    slim = SLIM[g]
    segs = {}
    inv = body.matrix_world.inverted() @ arm.matrix_world
    for b in bones:
        k = next((v for p, v in slim.items() if b.name.startswith(p)), None)
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
    # 衣物厚度：只要有一個相鄰面是衣物，頂點就沿法線往外推
    push = [0.0] * len(me.vertices)
    for poly in me.polygons:
        d = PUFF.get(SLOTS[poly.material_index], 0)
        for vi in poly.vertices:
            push[vi] = max(push[vi], d)
    # 底模在 UV 接縫有重複頂點：同位置的頂點用同一個平均法線與推距，不然會裂出細縫
    spot = {}
    for v in me.vertices:
        key = (round(v.co.x, 4), round(v.co.y, 4), round(v.co.z, 4))
        n, d = spot.get(key, (Vector((0, 0, 0)), 0.0))
        spot[key] = (n + v.normal, max(d, push[v.index]))
    for v in me.vertices:
        n, d = spot[(round(v.co.x, 4), round(v.co.y, 4), round(v.co.z, 4))]
        if d:
            v.co += n.normalized() * d
    # 髮型：綁到同性別骨架（Rigged to Head Bone 版本的骨架與底模一致）
    for hn in HAIRS[g]:
        hobjs = import_gltf(HAIR.format(hn))
        harm = next(o for o in hobjs if o.type == 'ARMATURE')
        hmesh = next(o for o in hobjs if o.type == 'MESH' and o.parent is harm)
        hmesh.parent = arm
        hmesh.matrix_parent_inverse.identity()
        for mod in hmesh.modifiers:
            if mod.type == 'ARMATURE':
                mod.object = arm
        hmesh.name = f'{g}_{hn}'
        for o in hobjs:
            if o is not hmesh:
                bpy.data.objects.remove(o, do_unlink=True)
    arm.location.x = gi * 1.2  # 兩副骨架並排（前端各自複製，位置無關）

for m in bpy.data.materials:
    strip_maps(m)
# 髮型匯入時複製出來的 MI_Hair_1.001 之類，併回同一份材質
for o in bpy.data.objects:
    if o.type == 'MESH':
        for i, m in enumerate(o.data.materials):
            if m and '.' in m.name and m.name.split('.')[0] in bpy.data.materials:
                o.data.materials[i] = bpy.data.materials[m.name.split('.')[0]]
for img in list(bpy.data.images):
    if img.users == 0 or 'normal' in img.name.lower() or 'rough' in img.name.lower() or 'Dark' in img.name:
        bpy.data.images.remove(img)
        continue
    if img.size[0] > 256:
        img.scale(256, 256)
    print('image', img.name, img.size[:], 'channels', img.channels, 'alpha', img.alpha_mode)
for m in bpy.data.materials:
    print('material', m.name, getattr(m, 'blend_method', ''), getattr(m, 'surface_render_method', ''))

# ---- 動畫 ----
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
scene = bpy.context.scene
bpy.ops.object.select_all(action='DESELECT')
arm.select_set(True)
bpy.context.view_layer.objects.active = arm
M = arm.matrix_world
REST = {b.name: (M @ b.head_local) for b in arm.data.bones}
FWD = Vector((0, -1, 0))  # 角色面向 -Y，左手在 +X


def set_action(act):
    arm.animation_data.action = act
    if getattr(act, 'slots', None) and len(act.slots):
        arm.animation_data.action_slot = act.slots[0]


def empty(name, loc=(0, 0, 0)):
    e = bpy.data.objects.new(name, None)
    e.location = loc
    scene.collection.objects.link(e)
    return e


def local_axis(bone, world_axis):
    """世界軸在骨頭靜止座標裡的方向（給 Copy Rotation 的 LOCAL 空間用）"""
    return (arm.data.bones[bone].matrix_local.to_3x3().inverted() @ world_axis).normalized()


def bake(src, dst, frames, setup):
    """以 src 動畫為底，setup(f0, f1) 加上約束與目標的關鍵影格，烘焙成 dst"""
    set_action(bpy.data.actions[src])
    f0, f1 = frames
    created = setup(f0, f1)
    scene.frame_set(f0)
    bpy.ops.object.mode_set(mode='POSE')
    bpy.ops.pose.select_all(action='SELECT')
    bpy.ops.nla.bake(frame_start=f0, frame_end=f1, only_selected=False, visual_keying=True, clear_constraints=True, use_current_action=False, bake_types={'POSE'})
    bpy.ops.object.mode_set(mode='OBJECT')
    new = arm.animation_data.action
    new.name = dst
    new.use_fake_user = True
    for e in created:
        act = e.animation_data.action if e.animation_data else None
        bpy.data.objects.remove(e, do_unlink=True)
        if act:
            bpy.data.actions.remove(act)
    arm.animation_data.action = None
    print(f'baked {dst} {f0}-{f1}')


def lean(bone, axis_world, ang):
    """在骨頭上疊一個額外旋轉（Copy Rotation，Before Original）"""
    e = empty(f'lean_{bone}')
    e.rotation_mode = 'QUATERNION'
    e.rotation_quaternion = Quaternion(local_axis(bone, axis_world), ang)
    c = arm.pose.bones[bone].constraints.new('COPY_ROTATION')
    c.target = e
    c.mix_mode = 'BEFORE'
    c.owner_space = 'LOCAL'
    c.target_space = 'LOCAL'
    return e


def ik(bone, target, pole, chain=2, pole_angle=-math.pi / 2):
    c = arm.pose.bones[bone].constraints.new('IK')
    c.target = target
    c.pole_target = pole
    c.chain_count = chain
    c.pole_angle = pole_angle


def board(kind):
    """側站：雙腳沿身體左右軸（板子方向）張開、膝蓋彎、骨盆下沉；kind = ride / crouch / push / grab"""
    drop = {'ride': 0.1, 'crouch': 0.3, 'push': 0.12, 'grab': 0.36}[kind]

    def setup(f0, f1):
        made = []
        hip = REST['pelvis']
        pel = empty('pel', hip + Vector((0, 0.03, -drop)))
        c = arm.pose.bones['pelvis'].constraints.new('COPY_LOCATION')
        c.target = pel
        made.append(pel)
        fl = empty('fl', (0.25, -0.02, REST['foot_l'].z))
        fr = empty('fr', (-0.25, -0.02, REST['foot_l'].z))
        pl = empty('pl', (0.45, -0.9, 0.5))
        pr = empty('pr', (-0.45, -0.9, 0.5))
        made += [fl, fr, pl, pr]
        ik('calf_l', fl, pl)
        ik('calf_r', fr, pr)
        # 上身：微前傾、轉頭看行進方向（左手側 +X）、手臂張開保持平衡
        made.append(lean('spine_02', Vector((1, 0, 0)), 0.12 + drop * 0.5))
        made.append(lean('neck_01', Vector((0, 0, 1)), 0.55))
        made.append(lean('Head', Vector((0, 0, 1)), 0.45))
        made.append(lean('upperarm_l', Vector((0, 1, 0)), -0.45))
        made.append(lean('upperarm_r', Vector((0, 1, 0)), 0.45))
        if kind == 'push':
            # 後腳（右）離板，在板子後方地面往後蹬，循環
            n = f1 - f0
            for f in range(f0, f1 + 1):
                u = (f - f0) / n
                a = u * 2 * math.pi
                x = -0.3 - 0.28 * (0.5 - 0.5 * math.cos(a))
                z = REST['foot_l'].z + max(0.0, math.sin(a)) * 0.12 - 0.11
                fr.location = (x, -0.2, z)
                fr.keyframe_insert('location', frame=f)
                pel.location = hip + Vector((0, 0.03, -drop - 0.04 * math.sin(a) ** 2))
                pel.keyframe_insert('location', frame=f)
        if kind == 'grab':
            # 右手往下抓板緣（腳尖側）
            h = empty('hand', (0.02, -0.17, 0.2))
            hp = empty('hp', (-0.5, 0.3, 0.9))
            made += [h, hp]
            ik('lowerarm_r', h, hp)
        return made
    return setup


def bike(f0, f1):
    """坐在座墊上、雙手握把、腳踩在繞曲柄轉動的踏板上（前端單車：座墊 y 0.96、曲柄 y 0.36、握把 y 1.04 前方 0.45）"""
    made = []
    pel = empty('pel', (0, 0.17, 1.02))
    c = arm.pose.bones['pelvis'].constraints.new('COPY_LOCATION')
    c.target = pel
    made.append(pel)
    made.append(lean('spine_01', Vector((1, 0, 0)), 0.38))
    made.append(lean('spine_03', Vector((1, 0, 0)), 0.12))
    made.append(lean('Head', Vector((1, 0, 0)), -0.35))
    hl = empty('hl', (0.25, -0.43, 1.05))
    hr = empty('hr', (-0.25, -0.43, 1.05))
    hpl = empty('hpl', (0.7, 0.2, 1.2))
    hpr = empty('hpr', (-0.7, 0.2, 1.2))
    fl = empty('fl', (0.13, 0, 0))
    fr = empty('fr', (-0.13, 0, 0))
    pl = empty('pl', (0.2, -1.0, 0.8))
    pr = empty('pr', (-0.2, -1.0, 0.8))
    made += [hl, hr, hpl, hpr, fl, fr, pl, pr]
    n = f1 - f0
    for f in range(f0, f1 + 1):
        a = (f - f0) / n * 2 * math.pi
        for e, ph in ((fl, 0.0), (fr, math.pi)):
            # 踏板（腳踝高出踏板約 7 cm）
            e.location = (e.location.x, 0.05 - math.cos(a + ph) * 0.17, 0.36 + math.sin(a + ph) * 0.17 + 0.07)
            e.keyframe_insert('location', frame=f)
    ik('calf_l', fl, pl)
    ik('calf_r', fr, pr)
    ik('lowerarm_l', hl, hpl)
    ik('lowerarm_r', hr, hpr)
    return made


def frames(name):
    a = bpy.data.actions[name]
    return int(a.frame_range[0]), int(a.frame_range[1])



# 每個動作一條 NLA 軌（glTF 匯出器依軌道輸出動畫）
arm.animation_data.action = None
for a in bpy.data.actions:
    if a.name not in KEEP and not a.name.startswith(('Board_', 'Bike_')):
        continue
    t = arm.animation_data.nla_tracks.new()
    t.name = a.name
    s = t.strips.new(a.name, int(a.frame_range[0]), a)
    if getattr(a, 'slots', None) and len(a.slots):
        try:
            s.action_slot = a.slots[0]
        except Exception:
            pass
print('actions', sorted(a.name for a in bpy.data.actions))

os.makedirs(os.path.dirname(OUT), exist_ok=True)
bpy.ops.export_scene.gltf(
    filepath=OUT, export_format='GLB', export_animation_mode='NLA_TRACKS', export_image_format='WEBP',
    export_image_quality=80, export_texcoords=True, export_normals=True, export_skins=True, export_morph=False,
    export_force_sampling=True, export_optimize_animation_size=True, export_def_bones=False, export_frame_step=2,
)
print('wrote', OUT, os.path.getsize(OUT))
