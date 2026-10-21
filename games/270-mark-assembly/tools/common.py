# 270 共用：選出裝甲物件、套用修改器、算出正規化座標。
# 來源檔放在 ../.cache/（Blend Swap 的 .blend 與 Sketchfab 的 .glb），見 README。
import bpy, bmesh, mathutils, math, os

CACHE = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '.cache')

MODELS = {
    # CC0，2iemniak；Blender 2.49 舊檔，沒有修改器，A 字站姿
    'mk3': dict(file='2iemniak-mk3.blend', keep=lambda o: True, subsurf=0),
    # CC-BY 3.0，2iemniak；同檔三套 Mark 7（灰／紅金／迷彩），以 x 中心切開
    'mk7': dict(file='2iemniak-mk7.blend', keep=lambda o: abs(center(o).x) < 1.6, subsurf=1),
    'mk7s': dict(file='2iemniak-mk7.blend', keep=lambda o: center(o).x < -1.6, subsurf=1),
    'mk7c': dict(file='2iemniak-mk7.blend', keep=lambda o: center(o).x > 1.6, subsurf=1),
    # CC-BY-SA 3.0，BrunoIkari；Collection 15／18／20 是放大的複本與散件，只留 Collection 1 裡實際尺寸的物件
    'bruno': dict(file='bruno-mk3.blend', keep=lambda o: any(c.name == 'Collection 1' for c in o.users_collection) and max(o.dimensions) < 6 and not any(c.name in ('Collection 15', 'Collection 18', 'Collection 20') for c in o.users_collection), subsurf=1, decimate=.4),
    # 以下是 Sketchfab 的 GLB（glb= 時 bake.py 不必先開 .blend）；predecimate 在分類前減面，decimate 在拆件後減面
    # CC BY-NC-SA 4.0，Nathang30；A 字站姿，30 張 4K 貼圖不沿用
    # share：一塊裡同部位的面積佔多少以上就整塊歸過去（硬殼模型放低，少切鋸齒）
    'mk1': dict(glb='nathang30-mk1.glb', keep=lambda o: True, subsurf=0, split=True, share=.5),
    # CC-BY 4.0，JorelPaul；Object_20 是地板
    'mk38': dict(glb='jorelpaul-mk38.glb', keep=lambda o: o.name != 'Object_20', subsurf=0, split=True, share=.3),
    # CC-BY 4.0，Gource；T 字站姿、綁了 swat_ 骨架，依權重分部位並把手臂放下；Icosphere 是沒綁骨架的雜物
    'mk46': dict(glb='gource-mk46.glb', keep=lambda o: o.name != 'Icosphere', subsurf=0, bones=True, arms=64, decimate=.5),
    'mk47': dict(glb='gource-mk47.glb', keep=lambda o: o.name != 'Icosphere', subsurf=0, bones=True, arms=64, decimate=.45),
    # CC-BY 4.0，LLIypuk（Harlow fx）；225 萬面，先減到約 30 萬
    'mk85': dict(glb='lliypuk-mk85.glb', keep=lambda o: True, subsurf=0, split=True, predecimate=.14),
    # CC-BY 4.0，Shreyash；浩克毀滅者，約 26 萬三角形、330 個網格
    'mk44': dict(glb='shreyash-mk44.glb', keep=lambda o: True, subsurf=0, split=True),
}


def center(o):
    ws = [o.matrix_world @ mathutils.Vector(c) for c in o.bound_box]
    return sum(ws, mathutils.Vector()) / 8


def load(key):
    """GLB 來源：清空場景後匯入；.blend 來源已由命令列開啟。"""
    cfg = MODELS[key]
    if 'glb' in cfg:
        bpy.ops.wm.read_factory_settings(use_empty=True)
        bpy.ops.import_scene.gltf(filepath=os.path.join(CACHE, cfg['glb']))


def suit_objects(key):
    cfg = MODELS[key]
    sc = bpy.data.scenes[0]
    return [o for o in sc.objects if o.type == 'MESH' and not o.hide_render and cfg['keep'](o)]


def evaluated_meshes(key):
    """回傳 [(name, bmesh(世界座標), [材質名], 權重)]，修改器已套用（細分上限依 MODELS 設定）。
    權重是每個頂點的 {骨頭名: w}（bones=True 時才有，否則 None）；arms= 會把 T 字站姿的手臂往下轉幾度。"""
    cfg = MODELS[key]
    load(key)
    objs = suit_objects(key)
    for o in objs:
        if cfg.get('predecimate'):
            md = o.modifiers.new('pre', 'DECIMATE'); md.ratio = cfg['predecimate']; md.use_collapse_triangulate = True
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
        wts = None
        if cfg.get('bones'):
            # 只有骨架修改器，頂點順序和原網格一致
            names = {g.index: g.name for g in o.vertex_groups}
            wts = [{names[g.group]: g.weight for g in v.groups if g.weight > 0} for v in o.data.vertices]
            assert len(wts) == len(bm.verts)
        out.append((o.name, bm, mats, wts))
        bpy.data.meshes.remove(me)
    if cfg.get('arms'):
        lower_arms(out, cfg['arms'])
    return out


def bone_key(name):
    """swat_LeftForeArm_010 → LeftForeArm"""
    n = name.split('_', 1)[1] if name.startswith('swat_') else name
    head, _, tail = n.rpartition('_')
    return head if head and tail.isdigit() else n


ARM_CHAIN = ('Arm', 'ForeArm', 'Hand')


def lower_arms(meshes, deg):
    """T 字站姿 → 手臂下垂：手臂鏈的頂點依權重混合「繞肩關節旋轉」與「不動」（自己做一次線性蒙皮）。
    肩關節取 Shoulder 與 Arm 權重交界的頂點平均。"""
    for side, sg in (('Left', 1), ('Right', -1)):
        acc = mathutils.Vector(); n = 0
        for _, bm, _, wts in meshes:
            bm.verts.ensure_lookup_table()
            for i, w in enumerate(wts):
                a = sum(v for k, v in w.items() if bone_key(k) == side + 'Shoulder'); b = sum(v for k, v in w.items() if bone_key(k) == side + 'Arm')
                if a > .2 and b > .2: acc += bm.verts[i].co; n += 1
        j = acc / max(n, 1)
        R = mathutils.Matrix.Rotation(math.radians(deg) * sg, 3, 'Y')
        print('SHOULDER', side, [round(x, 3) for x in j], n)
        for _, bm, _, wts in meshes:
            for i, w in enumerate(wts):
                t = sum(v for k, v in w.items() if any(bone_key(k).startswith(side + c) for c in ARM_CHAIN) and not bone_key(k).endswith('Shoulder'))
                if t <= 0: continue
                co = bm.verts[i].co
                co += (j + R @ (co - j) - co) * min(t, 1)


def bounds(meshes):
    mn = mathutils.Vector((1e9,) * 3); mx = -mn
    for _, bm, *_ in meshes:
        for v in bm.verts:
            mn = mathutils.Vector(map(min, mn, v.co)); mx = mathutils.Vector(map(max, mx, v.co))
    return mn, mx
