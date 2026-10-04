"""把 Quaternius 的 Universal Base Characters 男性底模＋ Universal Animation Library 動畫（皆 CC0）組成士兵，
輸出 ../../assets/199/models/soldier.glb。

    blender -b -P tools/build-soldier.py

素材包由 games/197-openworld/tools/fetch-quaternius.py 下載到 games/197-openworld/.cache/（或設 QUATERNIUS_CACHE）。
- 依每個面的主要骨頭把身體分成 skin（頭頸）、glove（手）、boot（腳踝以下）、uniform（其餘）四個材質，
  前端用物件空間的迷彩圖樣上色，再在骨頭上掛頭盔、背心與背包。
- 只留遊戲用到的動畫，貼圖縮成 512。
"""
import os
import bpy

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.environ.get('QUATERNIUS_CACHE') or os.path.normpath(os.path.join(ROOT, '../197-openworld/.cache'))
BODY = os.path.join(CACHE, 'ubc/Universal Base Characters[Standard]/Base Characters/Godot - UE/Superhero_Male_FullBody.gltf')
ANIMS = os.path.join(CACHE, 'ual/Universal Animation Library[Standard]/Unreal-Godot/UAL1_Standard.glb')
OUT = os.path.normpath(os.path.join(ROOT, '../../assets/199/models/soldier.glb'))
KEEP = ['Idle_Loop', 'Walk_Loop', 'Jog_Fwd_Loop', 'Sprint_Loop', 'Crouch_Idle_Loop', 'Crouch_Fwd_Loop', 'Jump_Loop', 'Jump_Land',
        'Pistol_Idle_Loop', 'Pistol_Aim_Neutral', 'Pistol_Aim_Up', 'Pistol_Aim_Down', 'Pistol_Shoot', 'Pistol_Reload', 'Death01', 'Hit_Chest', 'Swim_Idle_Loop']
SKIN = {'Head', 'neck_01'}
FEET = {'foot_l', 'foot_r', 'ball_l', 'ball_r', 'ball_leaf_l', 'ball_leaf_r'}


def import_gltf(path):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    return [o for o in bpy.data.objects if o not in before]


bpy.ops.wm.read_factory_settings(use_empty=True)
body = import_gltf(BODY)
arm = next(o for o in body if o.type == 'ARMATURE')
mesh = next(o for o in body if o.type == 'MESH' and o.name.lower().startswith('superhero'))
# 頭髮、眉毛之外的配件不需要
for o in body:
    if o.type == 'MESH' and o is not mesh and 'eye' not in o.name.lower():
        bpy.data.objects.remove(o, do_unlink=True)

base = mesh.data.materials[0]
mats = {}
for name in ('skin', 'uniform', 'glove', 'boot'):
    m = base.copy() if name == 'skin' else bpy.data.materials.new(name)
    m.name = name
    mats[name] = m
mesh.data.materials.clear()
for name in ('skin', 'uniform', 'glove', 'boot'):
    mesh.data.materials.append(mats[name])
order = ['skin', 'uniform', 'glove', 'boot']
groups = {g.index: g.name for g in mesh.vertex_groups}
me = mesh.data


def bone_of(vi):
    best, bw = None, 0
    for g in me.vertices[vi].groups:
        if g.weight > bw:
            best, bw = groups.get(g.group), g.weight
    return best or ''


vb = [bone_of(i) for i in range(len(me.vertices))]
for poly in me.polygons:
    votes = {'skin': 0, 'glove': 0, 'boot': 0, 'uniform': 0}
    for vi in poly.vertices:
        b = vb[vi]
        if b in SKIN:
            votes['skin'] += 1
        elif b in FEET:
            votes['boot'] += 1
        elif b.startswith(('hand_', 'index', 'middle', 'pinky', 'ring', 'thumb')):
            votes['glove'] += 1
        else:
            votes['uniform'] += 1
    poly.material_index = order.index(max(votes, key=votes.get))
# 非皮膚材質不用貼圖（前端自己上色）
for name in ('uniform', 'glove', 'boot'):
    m = mats[name]
    m.use_nodes = True
    nt = m.node_tree
    bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    bsdf.inputs['Base Color'].default_value = {'uniform': (0.35, 0.33, 0.24, 1), 'glove': (0.08, 0.07, 0.06, 1), 'boot': (0.12, 0.1, 0.08, 1)}[name]
    bsdf.inputs['Roughness'].default_value = 0.9
# 皮膚：拿掉粗糙度貼圖、縮圖
for m in bpy.data.materials:
    if not m.node_tree:
        continue
    bsdf = next((n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None)
    if bsdf:
        for sock_name, v in (('Roughness', 0.75), ('Metallic', 0.0)):
            s = bsdf.inputs[sock_name]
            for l in list(s.links):
                m.node_tree.links.remove(l)
            s.default_value = v
for img in bpy.data.images:
    if img.size[0] > 512:
        img.scale(512, 512)

# 動畫：匯入 UAL，保留要的 action，刪掉它的網格與骨架
anim_objs = import_gltf(ANIMS)
for a in list(bpy.data.actions):
    if any(a.name.startswith(k) for k in KEEP):
        a.use_fake_user = True
    else:
        bpy.data.actions.remove(a)
for o in anim_objs:
    bpy.data.objects.remove(o, do_unlink=True)
# 名稱統一（匯入器可能加上骨架名後綴）
for a in bpy.data.actions:
    for k in KEEP:
        if a.name.startswith(k):
            a.name = k
arm.animation_data_create()

# ---- 步槍姿勢：以手槍瞄準動畫為底，IK 把右手放到握把、左手放到護木（槍托抵右肩），烘焙成新動畫 ----
from mathutils import Vector
scene = bpy.context.scene
bpy.ops.object.select_all(action='DESELECT')
arm.select_set(True)
bpy.context.view_layer.objects.active = arm


def make_rifle(src_name, dst_name, reload=False):
    src = bpy.data.actions.get(src_name)
    if not src:
        return
    arm.animation_data.action = src
    # Blender 4.4 起的 action 有「slot」：沒指定 slot 動畫不會套用（會停在 T 字姿勢）
    if getattr(src, 'slots', None) and len(src.slots):
        arm.animation_data.action_slot = src.slots[0]
    f0, f1 = int(src.frame_range[0]), int(src.frame_range[1])
    tR = bpy.data.objects.new('tR', None); tL = bpy.data.objects.new('tL', None)
    pR = bpy.data.objects.new('pR', None); pL = bpy.data.objects.new('pL', None)
    for e in (tR, tL, pR, pL):
        scene.collection.objects.link(e)
    M = arm.matrix_world
    for f in range(f0, f1 + 1):
        scene.frame_set(f)
        pb = arm.pose.bones
        S = M @ pb['upperarm_r'].head
        Sl = M @ pb['upperarm_l'].head
        H = M @ pb['hand_r'].head
        Hl = M @ pb['hand_l'].head
        aim = ((H + Hl) / 2 - (S + Sl) / 2).normalized()   # 雙手持槍時兩手中點的方向就是瞄準方向
        axis = (Sl - S).normalized()
        aim = (aim - axis * aim.dot(axis)).normalized()      # 去掉左右分量：槍線跟身體正前方平行
        chest = (S + Sl) / 2
        inward = chest - S; inward.z = 0; inward.normalize()
        down = Vector((0, 0, -1))
        butt = S + aim * 0.02 + inward * 0.08
        grip = butt + aim * 0.24 + down * 0.07
        fore = butt + aim * 0.56 + down * 0.05 + inward * 0.06
        if reload:
            # 換彈：左手從護木到彈匣、拔下、換上、拍實、回護木（右手一直握著握把）
            u = (f - f0) / max(1, f1 - f0)
            mag = grip + aim * 0.06 + down * 0.16 + inward * 0.02
            low = mag + down * 0.22 + inward * 0.05
            def lerp(a, b, t):
                t = max(0.0, min(1.0, t)); t = t * t * (3 - 2 * t); return a + (b - a) * t
            if u < 0.15: fore = lerp(fore, mag, u / 0.15)
            elif u < 0.35: fore = lerp(mag, low, (u - 0.15) / 0.2)
            elif u < 0.55: fore = lerp(low, mag + down * 0.03, (u - 0.35) / 0.2)
            elif u < 0.68: fore = lerp(mag + down * 0.03, mag + aim * 0.02, (u - 0.55) / 0.13)
            else: fore = lerp(mag, butt + aim * 0.56 + down * 0.05 + inward * 0.06, (u - 0.68) / 0.32)
        side = -inward
        for e, loc in ((tR, grip), (tL, fore), (pR, S + side * 0.35 + down * 0.45 + aim * 0.1), (pL, Sl + down * 0.55 + aim * 0.2)):
            e.location = loc
            e.keyframe_insert('location', frame=f)
    for bone, t, pole in (('lowerarm_r', tR, pR), ('lowerarm_l', tL, pL)):
        c = arm.pose.bones[bone].constraints.new('IK')
        c.target = t; c.chain_count = 2; c.pole_target = pole; c.pole_angle = -1.5708
    scene.frame_set(f0)
    bpy.context.view_layer.update()
    pb = arm.pose.bones
    if False: print('dbg', dst_name, 'tR', tuple(round(v, 2) for v in tR.matrix_world.translation), 'hand_r', tuple(round(v, 2) for v in (M @ pb['hand_r'].head)), 'tL', tuple(round(v, 2) for v in tL.matrix_world.translation), 'hand_l', tuple(round(v, 2) for v in (M @ pb['hand_l'].head)))
    bpy.ops.object.mode_set(mode='POSE')
    bpy.ops.pose.select_all(action='SELECT')
    bpy.ops.nla.bake(frame_start=f0, frame_end=f1, only_selected=False, visual_keying=True, clear_constraints=True, use_current_action=False, bake_types={'POSE'})
    bpy.ops.object.mode_set(mode='OBJECT')
    new = arm.animation_data.action
    new.name = dst_name
    new.use_fake_user = True
    for e in (tR, tL, pR, pL):
        act = e.animation_data.action if e.animation_data else None
        bpy.data.objects.remove(e, do_unlink=True)
        if act:
            bpy.data.actions.remove(act)
    arm.animation_data.action = None
    print(f'rifle {dst_name} {f0}-{f1}')


for src, dst in (('Pistol_Idle_Loop', 'Rifle_Idle_Loop'), ('Pistol_Aim_Neutral', 'Rifle_Aim_Neutral'), ('Pistol_Aim_Up', 'Rifle_Aim_Up'), ('Pistol_Aim_Down', 'Rifle_Aim_Down'), ('Pistol_Shoot', 'Rifle_Shoot')):
    make_rifle(src, dst)
make_rifle('Pistol_Reload', 'Rifle_Reload', reload=True)

arm.animation_data.action = None
track_owner = arm.animation_data
for a in bpy.data.actions:
    t = track_owner.nla_tracks.new()
    t.name = a.name
    t.strips.new(a.name, 0, a)
    t.mute = True

os.makedirs(os.path.dirname(OUT), exist_ok=True)
bpy.ops.export_scene.gltf(
    filepath=OUT, export_format='GLB', export_animations=True, export_animation_mode='NLA_TRACKS',
    export_image_format='JPEG', export_jpeg_quality=80, export_yup=True, export_apply=False,
)
print(f'ok    soldier.glb  {os.path.getsize(OUT) / 1024:.0f} KB  動畫 {len(bpy.data.actions)}：{sorted(a.name for a in bpy.data.actions)}')
