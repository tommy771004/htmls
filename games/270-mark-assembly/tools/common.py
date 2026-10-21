# 270 共用：選出裝甲物件、套用修改器、算出正規化座標。
# 三個來源檔（Blend Swap）放在 ../.cache/，見 README。
import bpy, bmesh, mathutils

MODELS = {
    # CC0，2iemniak；Blender 2.49 舊檔，沒有修改器，A 字站姿
    'mk3': dict(file='2iemniak-mk3.blend', keep=lambda o: True, subsurf=0),
    # CC-BY 3.0，2iemniak；同檔三套 Mark 7（灰／紅金／迷彩），以 x 中心切開
    'mk7': dict(file='2iemniak-mk7.blend', keep=lambda o: abs(center(o).x) < 1.6, subsurf=1),
    'mk7s': dict(file='2iemniak-mk7.blend', keep=lambda o: center(o).x < -1.6, subsurf=1),
    'mk7c': dict(file='2iemniak-mk7.blend', keep=lambda o: center(o).x > 1.6, subsurf=1),
    # CC-BY-SA 3.0，BrunoIkari；Collection 15／18／20 是放大的複本與散件，只留 Collection 1 裡實際尺寸的物件
    'bruno': dict(file='bruno-mk3.blend', keep=lambda o: any(c.name == 'Collection 1' for c in o.users_collection) and max(o.dimensions) < 6 and not any(c.name in ('Collection 15', 'Collection 18', 'Collection 20') for c in o.users_collection), subsurf=1, decimate=.4),
}


def center(o):
    ws = [o.matrix_world @ mathutils.Vector(c) for c in o.bound_box]
    return sum(ws, mathutils.Vector()) / 8


def suit_objects(key):
    cfg = MODELS[key]
    sc = bpy.data.scenes[0]
    return [o for o in sc.objects if o.type == 'MESH' and not o.hide_render and cfg['keep'](o)]


def evaluated_meshes(key):
    """回傳 [(name, bmesh(世界座標), [材質名])]，修改器已套用（細分上限依 MODELS 設定）。"""
    cfg = MODELS[key]
    objs = suit_objects(key)
    for o in objs:
        for m in o.modifiers:
            if m.type == 'SUBSURF':
                m.levels = min(m.levels, cfg['subsurf']); m.render_levels = m.levels
            if m.type == 'BOOLEAN' and (m.object is None):
                m.show_viewport = False
    dg = bpy.context.evaluated_depsgraph_get()
    out = []
    for o in objs:
        ev = o.evaluated_get(dg)
        me = bpy.data.meshes.new_from_object(ev, preserve_all_data_layers=False, depsgraph=dg)
        bm = bmesh.new(); bm.from_mesh(me)
        bm.transform(o.matrix_world)
        if o.matrix_world.determinant() < 0:
            bmesh.ops.reverse_faces(bm, faces=bm.faces)
        mats = [s.material.name if s.material else '' for s in o.material_slots]
        out.append((o.name, bm, mats))
        bpy.data.meshes.remove(me)
    return out


def bounds(meshes):
    mn = mathutils.Vector((1e9,) * 3); mx = -mn
    for _, bm, _ in meshes:
        for v in bm.verts:
            mn = mathutils.Vector(map(min, mn, v.co)); mx = mathutils.Vector(map(max, mx, v.co))
    return mn, mx
