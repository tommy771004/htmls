# 珊瑚灣垂釣（201）的 Blender 共用工具：所有資產腳本都 `from common import *`。
# 執行：/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P blender/<腳本>.py
# 慣例（詳見 SPEC.md）：1 單位 = 1 公尺；Blender Z 朝上、角色與魚面向 -Y（匯出後是 glTF +Z）。
import bpy, bmesh, math, os, subprocess, sys, shutil, tempfile
from mathutils import Vector, Euler, Matrix

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'out')
PREVIEW = os.path.join(HERE, '..', 'dist', 'preview')


def reset():
    """清空場景（含孤兒資料），單位設成公尺。"""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    s = bpy.context.scene
    s.unit_settings.system = 'METRIC'
    s.render.fps = 30
    return s


def hexrgb(h):
    h = h.lstrip('#')
    srgb = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple((c / 12.92) if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in srgb)


_mats = {}


def mat(name, color, rough=0.85, metal=0.0, emit=None):
    """Principled 材質，color 為 sRGB 十六進位字串。同名重複呼叫會回傳同一個材質。"""
    if name in _mats and _mats[name].name in bpy.data.materials:
        return _mats[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes.get('Principled BSDF')
    b.inputs['Base Color'].default_value = (*hexrgb(color), 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    if emit:
        b.inputs['Emission Color'].default_value = (*hexrgb(emit), 1)
        b.inputs['Emission Strength'].default_value = 1.0
    m.diffuse_color = (*hexrgb(color), 1)   # Workbench 預覽用
    _mats[name] = m
    return m


def link(obj):
    bpy.context.scene.collection.objects.link(obj)
    return obj


def mesh_from(name, verts, faces, material=None):
    me = bpy.data.meshes.new(name)
    me.from_pydata([Vector(v) for v in verts], [], faces)
    me.update()
    o = link(bpy.data.objects.new(name, me))
    if material:
        o.data.materials.append(material)
    return o


def _active(o):
    bpy.ops.object.select_all(action='DESELECT')
    o.select_set(True)
    bpy.context.view_layer.objects.active = o


def prim(kind, name, material=None, loc=(0, 0, 0), rot=(0, 0, 0), scale=(1, 1, 1), **kw):
    """kind：cube / cylinder / cone / ico / uv / torus / plane / circle。rot 以度為單位。回傳已套用變換的物件。"""
    ops = {
        'cube': bpy.ops.mesh.primitive_cube_add, 'cylinder': bpy.ops.mesh.primitive_cylinder_add,
        'cone': bpy.ops.mesh.primitive_cone_add, 'ico': bpy.ops.mesh.primitive_ico_sphere_add,
        'uv': bpy.ops.mesh.primitive_uv_sphere_add, 'torus': bpy.ops.mesh.primitive_torus_add,
        'plane': bpy.ops.mesh.primitive_plane_add, 'circle': bpy.ops.mesh.primitive_circle_add,
    }
    ops[kind](**kw)
    o = bpy.context.active_object
    o.name = name
    o.location = loc
    o.rotation_euler = [math.radians(a) for a in rot]
    o.scale = scale
    apply(o)
    if material:
        o.data.materials.clear()
        o.data.materials.append(material)
    return o


def apply(o, loc=True, rot=True, scale=True):
    _active(o)
    bpy.ops.object.transform_apply(location=loc, rotation=rot, scale=scale)
    return o


def modifiers_apply(o):
    _active(o)
    for m in list(o.modifiers):
        bpy.ops.object.modifier_apply(modifier=m.name)
    return o


def jitter(o, amount=0.02, seed=1):
    """低多邊形的手作感：把頂點隨機推一點點（同位置的頂點推同樣的量，不會裂開）。"""
    import random
    rnd = random.Random(seed)
    cache = {}
    for v in o.data.vertices:
        k = tuple(round(c, 4) for c in v.co)
        if k not in cache:
            cache[k] = Vector((rnd.uniform(-1, 1), rnd.uniform(-1, 1), rnd.uniform(-1, 1))) * amount
        v.co += cache[k]
    return o


def flat(o):
    """平面著色（低多邊形的硬邊），匯出時會拆頂點法線。"""
    for p in o.data.polygons:
        p.use_smooth = False
    return o


def join(objs, name):
    objs = [o for o in objs if o]
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    o = bpy.context.active_object
    o.name = name
    o.data.name = name
    return o


def set_origin(o, point):
    """把物件原點移到 point（世界座標），幾何不動。"""
    p = Vector(point)
    o.data.transform(Matrix.Translation(o.location - p))
    o.location = p
    return o


# ---------- 骨架與綁定 ----------

def armature(name, bones):
    """bones：[(骨名, head, tail, parent 或 None, roll 度數=0), ...]，座標為世界座標。回傳骨架物件（姿勢模式旋轉用 XYZ 尤拉角）。"""
    ad = bpy.data.armatures.new(name)
    arm = link(bpy.data.objects.new(name, ad))
    _active(arm)
    bpy.ops.object.mode_set(mode='EDIT')
    eb = ad.edit_bones
    for b in bones:
        n, h, t, parent = b[:4]
        roll = b[4] if len(b) > 4 else 0
        e = eb.new(n)
        e.head, e.tail, e.roll = Vector(h), Vector(t), math.radians(roll)
        if parent:
            e.parent = eb[parent]
            e.use_connect = False
    bpy.ops.object.mode_set(mode='OBJECT')
    for pb in arm.pose.bones:
        pb.rotation_mode = 'XYZ'
    return arm


def bind_rigid(parts, arm, name):
    """parts：[(物件, 骨名), ...]。每個零件 100% 綁在一根骨頭上（低多邊形最穩），合併成一個蒙皮網格。"""
    for o, bone in parts:
        vg = o.vertex_groups.new(name=bone)
        vg.add(list(range(len(o.data.vertices))), 1.0, 'REPLACE')
    body = join([o for o, _ in parts], name)
    body.parent = arm
    m = body.modifiers.new('Armature', 'ARMATURE')
    m.object = arm
    return body


def bind_auto(o, arm):
    """用 Blender 的自動權重（熱擴散）綁定，適合魚身、海草這類要平滑彎曲的單一網格。"""
    bpy.ops.object.select_all(action='DESELECT')
    o.select_set(True)
    arm.select_set(True)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.parent_set(type='ARMATURE_AUTO')
    return o


def attach(o, arm, bone):
    """把剛體物件（斗笠、釣竿）掛在骨頭上：匯出時成為骨頭的子節點。"""
    mw = o.matrix_world.copy()
    o.parent = arm
    o.parent_type = 'BONE'
    o.parent_bone = bone
    bpy.context.view_layer.update()
    o.matrix_world = mw
    return o


# ---------- 動作（Blender 4.4+ 的 action 要指定 slot 才會套用） ----------

def begin_action(arm, name):
    """建立新的 action 並指定給骨架。接著用 pose() 打關鍵影格。"""
    arm.animation_data_create()
    act = bpy.data.actions.new(name)
    act.use_fake_user = True
    arm.animation_data.action = act
    for pb in arm.pose.bones:   # 每個動作都從靜止姿勢開始
        pb.location = (0, 0, 0)
        pb.rotation_euler = (0, 0, 0)
        pb.scale = (1, 1, 1)
    return act


def pose(arm, frame, rots=None, locs=None, interp=None):
    """rots：{骨名: (x, y, z) 度數，骨頭本地軸}；locs：{骨名: (x, y, z) 公尺，骨頭本地軸}。
    沒列出的骨頭不打關鍵影格（會沿用前一個值）。"""
    for n, r in (rots or {}).items():
        pb = arm.pose.bones[n]
        pb.rotation_euler = [math.radians(a) for a in r]
        pb.keyframe_insert('rotation_euler', frame=frame)
    for n, l in (locs or {}).items():
        pb = arm.pose.bones[n]
        pb.location = l
        pb.keyframe_insert('location', frame=frame)
    act = arm.animation_data.action
    if act and getattr(act, 'slots', None) and len(act.slots) and arm.animation_data.action_slot is None:
        arm.animation_data.action_slot = act.slots[0]


def _fcurves(act):
    """Blender 5 的 layered action：fcurves 在 layers[].strips[].channelbag(slot) 裡。"""
    if hasattr(act, 'fcurves'):
        try:
            return list(act.fcurves)
        except Exception:
            pass
    out = []
    for layer in getattr(act, 'layers', []):
        for strip in layer.strips:
            for slot in act.slots:
                cb = strip.channelbag(slot)
                if cb:
                    out.extend(cb.fcurves)
    return out


def end_action(arm, cyclic=False, interp='BEZIER'):
    """收尾：設定插值，cyclic=True 時加上循環修改器讓頭尾銜接（匯出時會烘焙）。"""
    act = arm.animation_data.action
    for fc in _fcurves(act):
        for k in fc.keyframe_points:
            k.interpolation = interp
        if cyclic:
            fc.modifiers.new('CYCLES')
    return act


def stash_actions(obj, names=None):
    """把 action 推進 NLA 軌（靜音），匯出模式用 NLA_TRACKS，每條軌成為一段 glTF 動畫，名稱＝軌名＝action 名。"""
    ad = obj.animation_data or obj.animation_data_create()
    ad.action = None
    for a in bpy.data.actions:
        if names is not None and a.name not in names:
            continue
        t = ad.nla_tracks.new()
        t.name = a.name
        s = t.strips.new(a.name, int(a.frame_range[0]), a)
        if getattr(a, 'slots', None) and len(a.slots):
            try:
                s.action_slot = a.slots[0]
            except Exception:
                pass
        t.mute = True


def export_glb(name, use_selection=False):
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, name)
    bpy.ops.export_scene.gltf(
        filepath=path, export_format='GLB', use_selection=use_selection,
        export_animations=True, export_animation_mode='NLA_TRACKS', export_force_sampling=True,
        export_yup=True, export_apply=False, export_cameras=False, export_lights=False,
        export_extras=False, export_texcoords=False, export_normals=True, export_materials='EXPORT',
    )
    print(f'ok  {name}  {os.path.getsize(path) / 1024:.0f} KB')
    return path


# ---------- 預覽算圖（Workbench，CPU 也很快） ----------

def _camera(target, direction, dist, ortho):
    cam = bpy.data.objects.get('__cam') or link(bpy.data.objects.new('__cam', bpy.data.cameras.new('__cam')))
    cam.data.type = 'ORTHO'
    cam.data.ortho_scale = ortho
    t = Vector(target)
    d = Vector(direction).normalized()
    cam.location = t + d * dist
    cam.rotation_euler = (-d).to_track_quat('-Z', 'Y').to_euler()
    bpy.context.scene.camera = cam
    return cam


def _setup_render(size):
    s = bpy.context.scene
    s.render.engine = 'BLENDER_WORKBENCH'
    s.display.shading.light = 'STUDIO'
    s.display.shading.color_type = 'MATERIAL'
    s.display.shading.show_shadows = True
    s.display.shading.show_cavity = True
    s.display.shading.show_object_outline = True
    s.render.resolution_x, s.render.resolution_y = size
    s.render.film_transparent = False
    s.world = s.world or bpy.data.worlds.new('w')
    s.world.color = (0.82, 0.86, 0.84)
    s.render.image_settings.file_format = 'PNG'


VIEWS = {
    'front': (0, -1, 0.15), 'side': (1, 0, 0.15), 'back': (0, 1, 0.15),
    'top': (0, -0.02, 1), 'three': (0.8, -1, 0.75), 'game': (0, 0.55, 1),   # game＝遊戲鏡頭的方向（俯視、略朝 -Y 看）
}


def render(path, target=(0, 0, 0.8), view='three', ortho=2.5, size=(512, 512), frame=None):
    """算一張預覽圖到 dist/preview/<path>.png。view 可為 VIEWS 的鍵或方向向量。"""
    os.makedirs(PREVIEW, exist_ok=True)
    _setup_render(size)
    _camera(target, VIEWS.get(view, view) if isinstance(view, str) else view, 30, ortho)
    if frame is not None:
        bpy.context.scene.frame_set(frame)
    out = os.path.join(PREVIEW, path + '.png')
    bpy.context.scene.render.filepath = out
    bpy.ops.render.render(write_still=True)
    return out


def sheet(path, arm, action, frames, target=(0, 0, 0.8), view='side', ortho=2.5, cell=256, cols=None):
    """把一個動作的多個影格排成一張接觸表（ffmpeg tile），檢查動畫用。"""
    os.makedirs(PREVIEW, exist_ok=True)
    act = bpy.data.actions[action]
    ad = arm.animation_data or arm.animation_data_create()
    prev = ad.action
    ad.action = act
    if getattr(act, 'slots', None) and len(act.slots):
        ad.action_slot = act.slots[0]
    tmp = tempfile.mkdtemp()
    for i, f in enumerate(frames):
        render(os.path.relpath(os.path.join(tmp, f'{i:03d}'), PREVIEW), target, view, ortho, (cell, cell), f)
    cols = cols or len(frames)
    rows = math.ceil(len(frames) / cols)
    out = os.path.join(PREVIEW, path + '.png')
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', os.path.join(tmp, '%03d.png'),
                    '-vf', f'tile={cols}x{rows}:padding=4:color=white', '-frames:v', '1', out], check=True)
    shutil.rmtree(tmp, ignore_errors=True)
    ad.action = prev
    return out
