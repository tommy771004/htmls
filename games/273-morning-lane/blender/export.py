# 把參考圖用的那批模型匯出給遊戲：blender -b --factory-startup -P blender/export.py -- [houses nature props rider]
# 程序化材質沒辦法進 glTF，這裡把它們「烘」成頂點色：底色 ×（每面色差）×（近地面髒污）；筆刷條紋留給執行時的 shader。
# 葉片卡的法線改成「從樹冠中心往外」（自訂法線），整團樹冠受光才像參考圖那樣是一顆柔軟的體積。
# 輸出 out/<組>.glb，每個資產是一個頂層物件（名稱＝資產名）；材質名是給執行時辨識用的標籤：
#   paint_b<筆刷>_r<粗糙度>[_e<自發光>]、glass、leaf、grass
# 房子另外輸出 ../src/core/houses.json（尺寸、門、正面窗戶），遊戲的判定與畫面用同一份。
import bpy, sys, os, math, json, random, zlib
from mathutils import Vector, Matrix
sys.path.insert(0, os.path.dirname(__file__))
import kit_common as K, kit_house as KH, kit_nature as KN, kit_street as KS, kit_rider as KR
from kit_common import Acc, mat, srgb, ST, PAL
from kit_lots import LOTS

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True)
groups = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else ['houses', 'housesLod', 'nature', 'props', 'rider']

# ---------- 材質 → 標籤＋每面顏色 ----------
def _group(m):
    if not m or not m.node_tree: return None
    for n in m.node_tree.nodes:
        if n.type == 'GROUP' and n.node_tree and n.node_tree.name.startswith('Painted'): return n
    return None

def _ramp(m):
    for n in m.node_tree.nodes:
        if n.type == 'VALTORGB': return n
    return None

def classify(m):
    """回傳 (標籤, 取色函式(rnd, objr, z, uv) → linear RGB)"""
    name = m.name if m else ''
    g = _group(m)
    if g:
        I = g.inputs
        base = Vector(I['Color'].default_value[:3]); var, brush, rough = I['Var'].default_value, I['Brush'].default_value, I['Rough'].default_value
        emit, grime = I['Emit'].default_value, I['Grime'].default_value
        tag = f'paint_b{brush:.2f}_r{rough:.2f}' + (f'_e{emit:.1f}' if emit > 0 else '')
        def col(rnd, objr, z, uv):
            k = 1 + (((rnd + objr) % 1.0) - 0.5) * var
            gk = 1 - grime * (1 - min(1, max(0, z / 0.6)))
            return base * (k * gk)
        return tag, col
    if name.startswith('glass'): return 'glass', lambda *a: Vector((1, 1, 1))
    if name.startswith('leaf|'):
        r = _ramp(m)
        return 'leaf', lambda rnd, objr, z, uv: Vector(r.color_ramp.evaluate(rnd)[:3])
    if name == 'grassblade':
        r = _ramp(m)
        return 'grass', lambda rnd, objr, z, uv: Vector(r.color_ramp.evaluate(rnd)[:3]) * (0.45 + 0.55 * uv[1])
    if name == 'newsprint':
        c = Vector(srgb('#ebe5d5')[:3]); return 'paint_b0.00_r0.85', lambda *a: c
    # 其他：Principled 的底色
    c = Vector((0.8, 0.8, 0.8))
    if m and m.node_tree:
        for n in m.node_tree.nodes:
            if n.type == 'BSDF_PRINCIPLED': c = Vector(n.inputs['Base Color'].default_value[:3])
    return 'paint_b0.10_r0.80', lambda *a: c

# ---------- 烘焙：把一組物件（含修改器）壓成陣列 ----------
def bake(objs, skip=None):
    """objs：要烘的 mesh 物件。回傳 {物件名: 資料}，資料是世界座標的頂點、面、每角的法線/顏色/UV、每面的標籤"""
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    out = {}
    for ob in objs:
        if ob.type != 'MESH' or (skip and skip(ob)): continue
        ev = ob.evaluated_get(dg)
        me = bpy.data.meshes.new_from_object(ev, preserve_all_data_layers=True, depsgraph=dg)
        M = ob.matrix_world.copy(); N = M.to_3x3().inverted().transposed()
        center = M.translation.copy()
        objr = (zlib.crc32(ob.name.split('.')[0].encode()) % 10000) / 10000
        rnd = me.attributes.get('rnd')
        uvl = me.uv_layers.active
        cn = me.corner_normals
        verts = [M @ v.co for v in me.vertices]
        faces, tags, lnorm, lcol, luv = [], [], [], [], []
        mats = [classify(s.material) for s in ob.material_slots] or [classify(None)]
        for p in me.polygons:
            tag, colf = mats[min(p.material_index, len(mats) - 1)]
            r = rnd.data[p.index].value if (rnd and rnd.domain == 'FACE') else 0.5
            faces.append([me.loops[li].vertex_index for li in p.loop_indices]); tags.append(tag)
            for li in p.loop_indices:
                vi = me.loops[li].vertex_index; w = verts[vi]
                uv = tuple(uvl.data[li].uv) if uvl else (0.0, 0.0)
                if tag == 'leaf': n = (w - center).normalized()
                else: n = (N @ Vector(cn[li].vector)).normalized()
                lnorm.append(n); lcol.append(colf(r, objr, w.z, uv)); luv.append(uv)
        out[ob.name] = dict(verts=verts, faces=faces, tags=tags, norm=lnorm, col=lcol, uv=luv)
        bpy.data.meshes.remove(me)
    return out

_tagmats = {}
def tag_mat(tag):
    if tag in _tagmats: return _tagmats[tag]
    m = bpy.data.materials.new(tag); m.use_nodes = True; nt = m.node_tree
    pb = nt.nodes.get('Principled BSDF'); ca = nt.nodes.new('ShaderNodeVertexColor'); ca.layer_name = 'Col'
    nt.links.new(ca.outputs['Color'], pb.inputs['Base Color'])
    if tag.startswith('paint'):
        pb.inputs['Roughness'].default_value = float(tag.split('_r')[1].split('_')[0])
    elif tag == 'glass':
        pb.inputs['Roughness'].default_value = 0.12; pb.inputs['Metallic'].default_value = 0.0
    else:
        pb.inputs['Roughness'].default_value = 0.9
    if tag in ('leaf', 'grass'): m.blend_method = 'CLIP' if hasattr(m, 'blend_method') else None
    _tagmats[tag] = m
    return m

def assemble(name, baked, coll):
    """把多個烘好的物件合成一個 mesh 物件（材質依標籤分槽）"""
    V, F, T, NN, CC, UU = [], [], [], [], [], []
    for d in baked:
        off = len(V); V += d['verts']; F += [[i + off for i in f] for f in d['faces']]; T += d['tags']; NN += d['norm']; CC += d['col']; UU += d['uv']
    me = bpy.data.meshes.new(name); me.from_pydata([tuple(v) for v in V], [], F); me.update()
    tags = sorted(set(T)); idx = {t: i for i, t in enumerate(tags)}
    for t in tags: me.materials.append(tag_mat(t))
    for p, t in zip(me.polygons, T): p.material_index = idx[t]; p.use_smooth = True
    ca = me.color_attributes.new('Col', 'FLOAT_COLOR', 'CORNER')
    for i, c in enumerate(CC): ca.data[i].color = (c.x, c.y, c.z, 1.0)
    me.color_attributes.active_color = ca
    uvl = me.uv_layers.new(name='UVMap')
    for i, u in enumerate(UU): uvl.data[i].uv = u
    me.normals_split_custom_set([tuple(n) for n in NN])
    ob = bpy.data.objects.new(name, me); coll.objects.link(ob)
    keys = sorted({k for d in baked for k in d.get('keys', {})})
    if keys:   # 形狀鍵 → glTF morph target（沒有這個鍵的零件就填原位置）
        ob.shape_key_add(name='Basis')
        for k in keys:
            kb = ob.shape_key_add(name=k, from_mix=False)
            co = [c for d in baked for v in d.get('keys', {}).get(k, d['verts']) for c in v]
            kb.data.foreach_set('co', co)
    return ob

def export(group, assets):
    """assets：[(名稱, 烘好的資料清單, 額外屬性)]"""
    for o in list(bpy.data.objects): bpy.data.objects.remove(o, do_unlink=True)
    C = bpy.data.collections.new('exp_' + group); bpy.context.scene.collection.children.link(C)
    obs = []
    for name, baked, extra in assets:
        ob = assemble(name, baked, C)
        for k, v in (extra or {}).items(): ob[k] = v
        obs.append(ob)
    bpy.ops.object.select_all(action='DESELECT')
    for o in obs: o.select_set(True)
    path = os.path.join(OUT, '_' + group + '.glb')   # 原檔；tools/pack.mjs 壓縮成 out/<組>.glb
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_apply=True, export_yup=True,
                              export_normals=True, export_texcoords=True, export_materials='EXPORT', export_vertex_color='ACTIVE', export_morph=True, export_morph_normal=False,
                              export_extras=True, export_animations=False, export_cameras=False, export_lights=False)
    tris = sum(sum(len(f) - 2 for f in d['faces']) for _, b, _ in assets for d in b)
    print(f'ok {group}.glb：{len(assets)} 個資產、{tris} 三角形、{os.path.getsize(path) // 1024} KB')

def scene_meshes():
    return [o for o in bpy.data.objects if o.type == 'MESH']

def fresh():
    K.clear()
    K._mats.clear()
    for m in list(bpy.data.materials): bpy.data.materials.remove(m)
    _tagmats.clear()

# ---------- 各組資產 ----------
def build_houses(lod=False):
    """lod：遠景版（屋瓦一排一條，見 kit_house.LOD），輸出 housesLod，房型與名稱和近景版一樣"""
    KH.LOD = lod
    fresh(); assets = []; meta = []
    for k, (s, i, spec, sub) in enumerate(LOTS[:12]):
        root, door_u = KH.house(f'house{k}', 1, 0.0, spec, False, False, seed=k + 1)
        root.location = (0, 0, 0)          # 正面在 x = 0、朝 −x；寬度沿 y；地基底在 z = 0
        objs = [o for o in root.children_recursive if o.type == 'MESH']
        assets.append((f'house{k}', list(bake(objs).values()), None))
        mt = dict(KH.house.meta); mt['id'] = k; mt['color'] = spec['color']; meta.append(mt)
        for o in [root] + list(root.children_recursive): bpy.data.objects.remove(o, do_unlink=True)
    if lod: export('housesLod', assets); KH.LOD = False; return
    with open(os.path.join(HERE, '..', 'src', 'core', 'houses.json'), 'w') as f:
        json.dump([{k: (round(v, 4) if isinstance(v, float) else v) for k, v in m.items()} for m in meta], f, ensure_ascii=False, indent=1)
    export('houses', assets)

def build_nature():
    fresh(); assets = []; rng = random.Random(51)
    for k, (h, cr, leaf) in enumerate(((10.5, 4.0, 'leaf2'), (9.8, 3.7, 'leaf1'), (11.2, 4.3, 'leaf2'))):
        KN.tree(f't{k}', (0, 0, 0), rng, height=h, crown=cr, leaf=leaf, clumps=12, cards=130, lean=rng.uniform(-1, 1))
        assets.append((f'tree{k}', list(bake(scene_meshes()).values()), None)); K.clear()
    KN.tree('ty', (0, 0, 0), rng, height=10.5, crown=4.2, leaf='leaf2', clumps=13)
    assets.append(('treeYard', list(bake(scene_meshes()).values()), None)); K.clear()
    for k, (r, leaf, fl) in enumerate(((0.55, 'leaf1', None), (0.6, 'leaf2', 'flowerPink'), (0.5, 'leaf1', 'flowerWhite'))):
        KN.bush(f'b{k}', (0, 0, 0), rng, r, leaf, fl)
        assets.append((f'bush{k}', list(bake(scene_meshes()).values()), None)); K.clear()
    KN.flower_bed('fb', -0.5, 0.5, -1.2, 1.2, rng)
    assets.append(('flowerBed', list(bake(scene_meshes()).values()), None)); K.clear()
    pts = [(rng.uniform(-1.5, 1.5), rng.uniform(-1.5, 1.5), 0.0) for _ in range(70)]
    KN.grass_tufts('tf', pts, rng)
    assets.append(('tufts', list(bake(scene_meshes()).values()), None)); K.clear()
    pts = [(rng.uniform(-0.12, 0.12), rng.uniform(-1.5, 1.5), 0.0) for _ in range(40)]
    KN.grass_tufts('tl', pts, rng, h=(0.18, 0.38))
    assets.append(('tuftsLine', list(bake(scene_meshes()).values()), None)); K.clear()
    export('nature', assets)

def build_props():
    fresh(); assets = []; rng = random.Random(77)
    def take(name):
        assets.append((name, list(bake(scene_meshes()).values()), None)); K.clear()
    KS.mailbox('mb', 0, 0, 1, True, rng); take('mailboxSub')
    KS.mailbox('mb', 0, 0, 1, False, rng); take('mailboxNo')
    KS.lamp('lp', 0.001, 0, False); take('lamp')
    KS.hydrant('hy', 0, 0); take('hydrant')
    KS.wheelie_bin('bn', 0, 0, 0.0); take('bin')
    KS.car('cr', 0, 0, 0.0, 'car'); take('car')
    KS.car('cr', 0, 0, 0.0, 'carRed'); take('carRed')
    # 電線桿（單根；電線在執行時依桿子位置拉）
    a = Acc(18); x = 0; y = 0
    a.tube(Vector((x, y, 0.1)), Vector((x, y, 9.0)), 0.13, 0.1, n=10)
    a.box((x, y, 8.4), (2.2, 0.12, 0.12)); a.box((x, y, 7.6), (1.4, 0.1, 0.1))
    for dx in (-0.95, 0.0, 0.95): a.tube(Vector((x + dx, y, 8.46)), Vector((x + dx, y, 8.62)), 0.04, n=6)
    a.tube(Vector((x + 0.3, y, 6.6)), Vector((x + 0.3, y, 7.3)), 0.22, n=12)
    a.obj('pole', mat('post', color=srgb('#6e5843'), var=0.1, brush=0.4, rough=0.9), smooth=True); take('pole')
    # 柵欄零件：尖頭木樁、柱（含柱帽）、1 m 橫木；執行時依每塊地的門口位置排
    w, h, t = 0.075, 1.0, 0.022
    prof = [(-w / 2, 0.08), (w / 2, 0.08), (w / 2, h - 0.05), (0, h), (-w / 2, h - 0.05)]
    fm = mat('fence', var=0.08, brush=0.15, grime=0.45)
    a = Acc(31); a.poly_prism(prof, -t / 2, t / 2, lambda u, v, tt: Vector((tt, u, v))); a.obj('pk', fm); take('picket')
    a = Acc(32); a.box((0, 0, 0.6), (0.1, 0.1, 1.2)); a.box((0, 0, 1.23), (0.14, 0.14, 0.05)); a.obj('po', fm); take('post')
    a = Acc(33); a.box((0, 0, 0), (0.035, 1.0, 0.08)); a.obj('ra', fm); take('rail')
    KS.dog('dg', 0, 0, 0.0); take('dog')
    KS.mailbox('mb', 0, 0, 1, True, rng, vip=True); take('mailboxVip')
    KS.bundle('bu', 0, 0, rng); take('bundle')
    KS.ramp('rp', 0, 0); take('ramp')
    KS.sprinkler('sp', 0, 0, rng, water=False); take('sprinkler')     # 水柱在執行時用水珠畫（會擺動）
    export('props', assets)

def split_faces(d, pick):
    """把烘好的資料依面拆成 (被挑中的, 其餘)；pick(面的頂點座標清單) → bool"""
    out = [dict(verts=[], faces=[], tags=[], norm=[], col=[], uv=[]) for _ in range(2)]
    maps = [{}, {}]; li = 0
    for f, t in zip(d['faces'], d['tags']):
        k = 0 if pick([d['verts'][i] for i in f]) else 1
        o, mp = out[k], maps[k]
        nf = []
        for i in f:
            if i not in mp: mp[i] = len(o['verts']); o['verts'].append(d['verts'][i])
            nf.append(mp[i])
        o['faces'].append(nf); o['tags'].append(t)
        for j in range(len(f)):
            o['norm'].append(d['norm'][li + j]); o['col'].append(d['col'][li + j]); o['uv'].append(d['uv'][li + j])
        li += len(f)
    return out

def shifted(d, off):
    return dict(d, verts=[v - off for v in d['verts']])

HUBS = {'R': Vector((0, -0.53, 0.34)), 'F': Vector((0, 0.55, 0.34))}   # 和 kit_rider.bike() 一樣

def take_wheels(frame):
    """從外胎／輪框＋花鼓／輻條三個物件拆出兩個輪子（離輪軸 0.345 m 以內、x 在 ±0.1 內）；回傳 {R: [...], F: [...]}，原 frame 就地改掉"""
    wheels = {'R': [], 'F': []}
    for n in [n for n in frame if n.endswith(('_bike_tires', '_bike_metal', '_bike_spokes'))]:
        for k, hub in HUBS.items():
            near = lambda vs, hub=hub: all(abs(v.x) < 0.1 and math.hypot(v.y - hub.y, v.z - hub.z) < 0.345 for v in vs)
            got, rest = split_faces(frame[n], near)
            if got['faces']: wheels[k].append(shifted(got, hub))
            frame[n] = rest
    return wheels

# 轉向組件（照 151 的拆法：前叉、龍頭＋把手各是一組，都掛在轉向軸上）：
# 車架裡頭管下端（Blender (0, 0.45, 0.76)）以下往前輪去的叉腳、金屬件裡頭管上端以上的龍頭／把手／鈴、整副握把；執行時繞頭管軸轉
HT_BOT, HT_TOP = KR.HT_BOT, KR.HT_TOP
def take_fork(frame):
    fork = []
    picks = {'_bike_frame': lambda vs: all(v.y > 0.42 and v.z < 0.79 for v in vs),
             '_bike_metal': lambda vs: all(v.y > 0.2 and v.z > 0.85 for v in vs),
             '_bike_grips': lambda vs: True}
    for n in list(frame):
        pick = next((f for k, f in picks.items() if n.endswith(k)), None)
        if not pick: continue
        got, rest = split_faces(frame[n], pick)
        if got['faces']: fork.append(shifted(got, HT_BOT))
        frame[n] = rest
    return fork

# 手臂跟著把手：skin modifier 重長的網格拓樸會變（分支點），不能直接當 morph target。
# 改用回正姿勢的網格，依骨架做線性混合蒙皮：每段骨頭算一個「最小旋轉＋平移」，頂點依（到骨段距離／該段半徑）加權
def seg_dist(p, a, b):
    ab = b - a; t = max(0.0, min(1.0, (p - a).dot(ab) / max(ab.length_squared, 1e-12)))
    return (a + ab * t - p).length

def follow(verts, sk0, sk1):
    (n0, edges, rad), (n1, _, _) = sk0, sk1
    r = [max(x) if isinstance(x, (tuple, list)) else x for x in rad]
    bones = [(n0[i], n0[j], (r[i] + r[j]) / 2, (n0[j] - n0[i]).rotation_difference(n1[j] - n1[i]), n1[i]) for i, j in edges]
    out = []
    for v in verts:
        acc, ws = Vector(), 0.0
        for a0, b0, rr, q, a1 in bones:
            w = 1.0 / ((seg_dist(v, a0, b0) / rr) ** 4 + 1e-4)
            acc += (a1 + q @ (v - a0)) * w; ws += w
        out.append(acc / ws)
    return out

def steer_skel(throw):
    """轉向打滿（−1／+1）時各零件的骨架"""
    out = {}
    for s in (-1.0, 1.0):
        KR.rider('r', (0, 0, 0), 0.0, pedal=0.0, throw=throw, steer=s); out[s] = {n: (list(v), e, r) for n, (v, e, r) in KR.SKEL.items()}; K.clear()
    return out

def with_steer_keys(d, n, sk0, sks):
    if n not in sk0: return d
    return dict(d, keys={'steerNeg': follow(d['verts'], sk0[n], sks[-1.0][n]), 'steerPos': follow(d['verts'], sk0[n], sks[1.0][n])})

def build_rider():
    """騎士＋腳踏車：靜態部分一份；隨踏板角度變的零件（腿、曲柄）8 格；丟報姿勢的手臂另一份（兩份手臂都帶轉向的 morph target）；兩個輪子拆出來（以輪軸為原點，執行時轉）；前叉＋龍頭＋把手拆出來（以頭管下端為原點，執行時繞頭管軸轉）"""
    fresh()
    frames = []
    for k in range(8):
        KR.rider('r', (0, 0, 0), 0.0, pedal=k / 8 * math.tau); frames.append(bake(scene_meshes())); K.clear()
        if k == 0: sk0 = {n: (list(v), e, r) for n, (v, e, r) in KR.SKEL.items()}
    KR.rider('r', (0, 0, 0), 0.0, pedal=0.0, throw=True); thr = bake(scene_meshes()); K.clear()
    skT = {n: (list(v), e, r) for n, (v, e, r) in KR.SKEL.items()}
    sks0, sksT = steer_skel(False), steer_skel(True)
    def differs(a, b):
        return len(a['verts']) != len(b['verts']) or any((p - q).length > 1e-4 for p, q in zip(a['verts'], b['verts']))
    wheels = take_wheels(frames[0])
    for f in frames[1:] + [thr]: take_wheels(f)
    fork = take_fork(frames[0])
    for f in frames[1:] + [thr]: take_fork(f)
    f0 = frames[0]
    dyn = {n for n in f0 if any(n in f and differs(f0[n], f[n]) for f in frames[1:])}
    moves = lambda sk, sks, n: any((p - q).length > 1e-5 for s in (-1.0, 1.0) for p, q in zip(sk[n][0], sks[s][n][0]))
    steerable = {n for n in sk0 if moves(sk0, sks0, n)} | {n for n in skT if moves(skT, sksT, n)}
    arm = {n for n in f0 if n in thr and (differs(f0[n], thr[n]) or n in steerable) and n not in dyn}
    static = [d for n, d in f0.items() if n not in dyn and n not in arm and d['faces']]
    print('rider 動態零件', sorted(dyn), '丟報零件', sorted(arm))
    assets = [('rider', static, None)]
    assets += [(f'pedal{k}', [f[n] for n in sorted(dyn) if n in f and f[n]['faces']], None) for k, f in enumerate(frames)]
    assets += [('wheel' + k, wheels[k], dict(hub=[HUBS[k].x, HUBS[k].z, -HUBS[k].y])) for k in ('R', 'F')]   # hub：遊戲座標（y 上、−z 前）
    axis = (HT_TOP - HT_BOT).normalized()
    assets.append(('fork', fork, dict(pivot=[HT_BOT.x, HT_BOT.z, -HT_BOT.y], axis=[axis.x, axis.z, -axis.y], rad=KR.STEER_RAD)))   # 頭管下端、頭管軸（遊戲座標）、打滿的角度
    # 手臂：morph target steerNeg／steerPos＝把手打滿 −1／+1 時的位置
    assets.append(('armsIdle', [with_steer_keys(f0[n], n, sk0, sks0) for n in sorted(arm)], None))
    assets.append(('armsThrow', [with_steer_keys(thr[n], n, skT, sksT) for n in sorted(arm)], None))
    KR.flying_paper('fp', (0, 0, 0), 0.0)
    assets.append(('paper', list(bake([o for o in scene_meshes() if not o.name.endswith('_s')]).values()), None)); K.clear()
    export('rider', assets)

for g in groups:
    {'houses': build_houses, 'housesLod': lambda: build_houses(True), 'nature': build_nature, 'props': build_props, 'rider': build_rider}[g]()
