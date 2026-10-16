# 霓虹夜城（259）Blender 共用建模與骨架動畫工具
# 執行：/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P blender/<腳本>.py
# 慣例：1 單位 = 1 公尺；Blender Z 朝上，角色與車輛面向 -Y（匯出 glTF 為 +Z 朝前，Y 朝上）。
import bpy, bmesh, math, os, random
from mathutils import Vector, Euler, Matrix, Quaternion

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'out')


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    s = bpy.context.scene
    s.unit_settings.system = 'METRIC'
    s.render.fps = 30
    return s


def hexrgb(h):
    h = h.lstrip('#')
    srgb = [int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4)]
    return tuple((c / 12.92) if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in srgb)


_mats = {}


def mat(name, color, rough=0.45, metal=0.2, emit=None, emit_strength=2.5, double_sided=False):
    if name in _mats and _mats[name].name in bpy.data.materials:
        return _mats[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    m.use_backface_culling = not double_sided
    b = m.node_tree.nodes.get('Principled BSDF')
    b.inputs['Base Color'].default_value = (*hexrgb(color), 1.0)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    if emit:
        b.inputs['Emission Color'].default_value = (*hexrgb(emit), 1.0)
        b.inputs['Emission Strength'].default_value = emit_strength
    m.diffuse_color = (*hexrgb(color), 1.0)
    _mats[name] = m
    return m


def link(obj):
    bpy.context.scene.collection.objects.link(obj)
    return obj


def _active(o):
    bpy.ops.object.select_all(action='DESELECT')
    o.select_set(True)
    bpy.context.view_layer.objects.active = o


class MB:
    """直接累積頂點／面／多材質的網格建構器，支援盒體、斜切柱體、旋轉體、燈條與車身放樣。"""

    def __init__(self, seed=1):
        self.v, self.f, self.fm, self.mats = [], [], [], []
        self.rnd = random.Random(seed)

    def _mi(self, m):
        if m not in self.mats:
            self.mats.append(m)
        return self.mats.index(m)

    def add(self, verts, faces, material):
        base = len(self.v)
        self.v.extend(Vector(p) for p in verts)
        mats = material if isinstance(material, list) else [material] * len(faces)
        for fc, m in zip(faces, mats):
            self.f.append([base + i for i in fc])
            self.fm.append(self._mi(m))
        return base

    def prism(self, outline, z0, z1, m, cap0=True, cap1=True, side_m=None):
        n = len(outline)
        verts = [(x, y, z0) for x, y in outline] + [(x, y, z1) for x, y in outline]
        faces, mats = [], []
        for i in range(n):
            j = (i + 1) % n
            faces.append((i, j, n + j, n + i))
            mats.append(side_m or m)
        if cap0:
            faces.append(tuple(reversed(range(n))))
            mats.append(m)
        if cap1:
            faces.append(tuple(range(n, 2 * n)))
            mats.append(m)
        return self.add(verts, faces, mats)

    def box(self, x0, x1, y0, y1, z0, z1, m, side_m=None):
        return self.prism([(x0, y0), (x1, y0), (x1, y1), (x0, y1)], z0, z1, m, side_m=side_m)

    def chamfer_box(self, cx, cy, cz, hx, hy, hz, ch, m, top_m=None):
        """帶水平斜切角的賽博龐克方塊。"""
        c = min(ch, hx * 0.45, hy * 0.45)
        pts = [
            (cx - hx + c, cy - hy), (cx + hx - c, cy - hy),
            (cx + hx, cy - hy + c), (cx + hx, cy + hy - c),
            (cx + hx - c, cy + hy), (cx - hx + c, cy + hy),
            (cx - hx, cy + hy - c), (cx - hx, cy - hy + c),
        ]
        n = len(pts)
        z0, z1 = cz - hz, cz + hz
        verts = [(x, y, z0) for x, y in pts] + [(x, y, z1) for x, y in pts]
        faces, mats = [], []
        for i in range(n):
            j = (i + 1) % n
            faces.append((i, j, n + j, n + i))
            mats.append(m)
        faces.append(tuple(reversed(range(n))))
        mats.append(m)
        faces.append(tuple(range(n, 2 * n)))
        mats.append(top_m or m)
        return self.add(verts, faces, mats)

    def cyl_z(self, cx, cy, z0, z1, r, segs, m, cap0=True, cap1=True, side_m=None, rot=0.0):
        o = [(cx + r * math.cos(rot + 2 * math.pi * i / segs), cy + r * math.sin(rot + 2 * math.pi * i / segs)) for i in range(segs)]
        return self.prism(o, z0, z1, m, cap0=cap0, cap1=cap1, side_m=side_m)

    def cyl_x(self, x0, x1, cy, cz, r, segs, m, cap0=True, cap1=True, side_m=None):
        """沿 X 軸延伸的圓柱（例如車輪）。"""
        ring = [(cy + r * math.cos(2 * math.pi * i / segs), cz + r * math.sin(2 * math.pi * i / segs)) for i in range(segs)]
        verts = [(x0, y, z) for y, z in ring] + [(x1, y, z) for y, z in ring]
        faces, mats = [], []
        for i in range(segs):
            j = (i + 1) % segs
            faces.append((i, n_idx := segs + i, segs + j, j))
            mats.append(side_m or m)
        if cap0:
            faces.append(tuple(range(segs)))
            mats.append(m)
        if cap1:
            faces.append(tuple(reversed(range(segs, 2 * segs))))
            mats.append(m)
        return self.add(verts, faces, mats)

    def loft_y(self, sections, m, cap0=True, cap1=True, face_mats=None):
        """沿 Y 軸放樣：sections = [(y, [(x, z), ...]), ...]，每個斷面點數相同（逆時針）。"""
        n = len(sections[0][1])
        verts = []
        for y, prof in sections:
            for x, z in prof:
                verts.append((x, y, z))
        faces, mats = [], []
        for k in range(len(sections) - 1):
            for i in range(n):
                j = (i + 1) % n
                faces.append((k * n + i, k * n + j, (k + 1) * n + j, (k + 1) * n + i))
                mats.append(face_mats.get((k, i), m) if face_mats else m)
        if cap0:
            faces.append(tuple(reversed(range(n))))
            mats.append(m)
        if cap1:
            last = (len(sections) - 1) * n
            faces.append(tuple(range(last, last + n)))
            mats.append(m)
        return self.add(verts, faces, mats)

    def build(self, name, origin=(0, 0, 0), smooth=False):
        me = bpy.data.meshes.new(name)
        ox, oy, oz = origin
        verts = [Vector((v.x - ox, v.y - oy, v.z - oz)) for v in self.v]
        me.from_pydata(verts, [], self.f)
        for m in self.mats:
            me.materials.append(m)
        for poly, mi in zip(me.polygons, self.fm):
            poly.material_index = mi
            poly.use_smooth = smooth
        bm = bmesh.new()
        bm.from_mesh(me)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        bm.to_mesh(me)
        bm.free()
        me.update()
        o = link(bpy.data.objects.new(name, me))
        o.location = Vector(origin)
        return o


def armature(name, bones):
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


def bind_rigid(parts, arm, name):
    for o, bone in parts:
        vg = o.vertex_groups.new(name=bone)
        vg.add(list(range(len(o.data.vertices))), 1.0, 'REPLACE')
    body = join([o for o, _ in parts], name)
    body.parent = arm
    m = body.modifiers.new('Armature', 'ARMATURE')
    m.object = arm
    return body


def begin_action(arm, name):
    arm.animation_data_create()
    act = bpy.data.actions.new(name)
    act.use_fake_user = True
    arm.animation_data.action = act
    for pb in arm.pose.bones:
        pb.location = (0, 0, 0)
        pb.rotation_euler = (0, 0, 0)
        pb.scale = (1, 1, 1)
    return act


def pose(arm, frame, rots=None, locs=None):
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
    act = arm.animation_data.action
    for fc in _fcurves(act):
        for k in fc.keyframe_points:
            k.interpolation = interp
        if cyclic:
            fc.modifiers.new('CYCLES')
    return act


def stash_actions(obj, names=None):
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
