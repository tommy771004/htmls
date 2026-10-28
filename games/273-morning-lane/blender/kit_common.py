# 參考圖與之後資產共用：手繪感材質、網格累積器、幾何小工具。
# 座標：Blender X = 遊戲 x（騎士右手邊）、Blender Y = 遊戲 −z（北，前進方向）、Z 朝上。
import bpy, math, random
from mathutils import Vector, Matrix, Euler

ST = dict(roadHalf=3.6, curb=0.15, gutter=0.4, stripOut=5.0, walkOut=6.8, fence=7.0, houseFront=12.0, lotWidth=16, mailboxX=4.3)

def srgb(h):
    h = h.lstrip('#'); c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple((x / 12.92) if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c) + (1.0,)

# 色票（ART.md 列同一組）
PAL = {
    'asphalt': '#55585e', 'asphaltDark': '#3f4247', 'lane': '#e9c75a', 'concrete': '#cfc8b8', 'concreteDark': '#a9a294',
    'grass': '#5d9c39', 'grassDry': '#8fae4a', 'grassDeep': '#3f7a2a', 'mulch': '#5a3d2b', 'soil': '#6b4a35',
    'honey': '#d4954c', 'terracotta': '#c0603f', 'butter': '#e8c063', 'sage': '#93ad78', 'cream': '#ece0c0', 'robin': '#8fb8b5',
    'trim': '#f6f2e8', 'fence': '#f7f4ec', 'shingleBrown': '#6f4636', 'shingleSlate': '#4e5763', 'shingleRust': '#87503a',
    'glass': '#2f4a63', 'brick': '#9b4f3a', 'stone': '#9d978a', 'door1': '#2e5f52', 'door2': '#a8413a', 'door3': '#2c4a72',
    'shutter1': '#3c5a48', 'shutter2': '#2f3f5a', 'shutter3': '#7a3a32',
    'leaf1': '#2e6f2f', 'leaf2': '#3f8a36', 'leaf3': '#5aa040', 'leafDark': '#1f4f25', 'bark': '#5e4532',
    'mailbox': '#3a3d42', 'mailboxSub': '#f2efe6', 'flag': '#d8402c', 'tube': '#e8b730', 'post': '#7a5a3e',
    'bin': '#3b6253', 'binLid': '#2e4e42', 'car': '#4f8fa3', 'carRed': '#b8493c', 'tire': '#232326', 'chrome': '#c9ccd0',
    'water': '#cfeaff', 'dog': '#c48a4d', 'dogLight': '#ecd3ad', 'dogDark': '#6d4a30', 'lampPole': '#30353a', 'lampGlow': '#ffd58a',
    'flowerPink': '#e88aa8', 'flowerWhite': '#f6f1e6', 'flowerYellow': '#f2c94a', 'flowerViolet': '#9a7ad0',
    'skin': '#e5ad87', 'skinShadow': '#c98a68', 'hoodie': '#e5aa35', 'hoodieDark': '#b88220', 'shirt': '#f2ede2', 'shorts': '#2f4c6e',
    'cap': '#d8402c', 'capDark': '#9c2a1c', 'hair': '#3a271d', 'sneaker': '#f3f0e8', 'sole': '#d9d3c4', 'sneakerAccent': '#d8402c', 'sock': '#f3f0e8',
    'bag': '#c7ad7c', 'bagDark': '#94784b', 'strap': '#7d6340', 'paper': '#ebe5d5', 'paperInk': '#6b6a66', 'band': '#d8402c',
    'frame': '#79b8a2', 'frameDark': '#4f8a76', 'saddle': '#5a3e2c', 'eye': '#2a1d17', 'lip': '#c8705e',
}

_mats = {}

def _node_group():
    """手繪感底材：Principled（高粗糙）＋ 筆刷條紋 ＋ 逐面隨機色差 ＋ 近地面髒污 ＋ AO。"""
    if 'Painted' in bpy.data.node_groups: return bpy.data.node_groups['Painted']
    g = bpy.data.node_groups.new('Painted', 'ShaderNodeTreeGroup' if False else 'ShaderNodeTree')
    I = g.interface
    for n, t in (('Color', 'NodeSocketColor'), ('Var', 'NodeSocketFloat'), ('Brush', 'NodeSocketFloat'), ('Rough', 'NodeSocketFloat'),
                 ('Emit', 'NodeSocketFloat'), ('Alpha', 'NodeSocketFloat'), ('Grime', 'NodeSocketFloat')):
        I.new_socket(n, in_out='INPUT', socket_type=t)
    I.new_socket('Shader', in_out='OUTPUT', socket_type='NodeSocketShader')
    N, L = g.nodes, g.links
    gi = N.new('NodeGroupInput'); go = N.new('NodeGroupOutput')
    tc = N.new('ShaderNodeTexCoord')
    # 筆刷：沿一個方向拉長的雜訊
    mp = N.new('ShaderNodeMapping'); mp.inputs['Scale'].default_value = (1.0, 1.0, 6.0)
    L.new(tc.outputs['Object'], mp.inputs['Vector'])
    nz = N.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 2.4; nz.inputs['Detail'].default_value = 6; nz.inputs['Roughness'].default_value = 0.62
    L.new(mp.outputs['Vector'], nz.inputs['Vector'])
    br = N.new('ShaderNodeMapRange'); L.new(nz.outputs['Fac'], br.inputs['Value'])
    br.inputs['From Min'].default_value = 0.3; br.inputs['From Max'].default_value = 0.7
    # 亮度變化量 = 1 + (noise−0.5)·Brush
    sub = N.new('ShaderNodeMath'); sub.operation = 'SUBTRACT'; L.new(br.outputs[0], sub.inputs[0]); sub.inputs[1].default_value = 0.5
    mul = N.new('ShaderNodeMath'); mul.operation = 'MULTIPLY'; L.new(sub.outputs[0], mul.inputs[0]); L.new(gi.outputs['Brush'], mul.inputs[1])
    # 逐面隨機（Acc 寫入的 rnd 屬性）
    at = N.new('ShaderNodeAttribute'); at.attribute_name = 'rnd'; at.attribute_type = 'GEOMETRY'
    oi = N.new('ShaderNodeObjectInfo')
    rsum = N.new('ShaderNodeMath'); rsum.operation = 'ADD'; L.new(at.outputs['Fac'], rsum.inputs[0]); L.new(oi.outputs['Random'], rsum.inputs[1])
    rfr = N.new('ShaderNodeMath'); rfr.operation = 'FRACT'; L.new(rsum.outputs[0], rfr.inputs[0])
    rs = N.new('ShaderNodeMath'); rs.operation = 'SUBTRACT'; L.new(rfr.outputs[0], rs.inputs[0]); rs.inputs[1].default_value = 0.5
    rm = N.new('ShaderNodeMath'); rm.operation = 'MULTIPLY'; L.new(rs.outputs[0], rm.inputs[0]); L.new(gi.outputs['Var'], rm.inputs[1])
    tot = N.new('ShaderNodeMath'); tot.operation = 'ADD'; L.new(mul.outputs[0], tot.inputs[0]); L.new(rm.outputs[0], tot.inputs[1])
    one = N.new('ShaderNodeMath'); one.operation = 'ADD'; L.new(tot.outputs[0], one.inputs[0]); one.inputs[1].default_value = 1.0
    # 近地面髒污：世界座標 z < 0.5 m 逐漸變暗
    geo = N.new('ShaderNodeNewGeometry'); sep = N.new('ShaderNodeSeparateXYZ'); L.new(geo.outputs['Position'], sep.inputs[0])
    gm = N.new('ShaderNodeMapRange'); L.new(sep.outputs['Z'], gm.inputs['Value'])
    gm.inputs['From Min'].default_value = 0.0; gm.inputs['From Max'].default_value = 0.6; gm.inputs['To Min'].default_value = 0.0; gm.inputs['To Max'].default_value = 1.0
    gin = N.new('ShaderNodeMath'); gin.operation = 'SUBTRACT'; gin.inputs[0].default_value = 1.0; L.new(gm.outputs[0], gin.inputs[1])
    gw = N.new('ShaderNodeMath'); gw.operation = 'MULTIPLY'; L.new(gin.outputs[0], gw.inputs[0]); L.new(gi.outputs['Grime'], gw.inputs[1])
    gk = N.new('ShaderNodeMath'); gk.operation = 'SUBTRACT'; gk.inputs[0].default_value = 1.0; L.new(gw.outputs[0], gk.inputs[1])
    f1 = N.new('ShaderNodeMath'); f1.operation = 'MULTIPLY'; L.new(one.outputs[0], f1.inputs[0]); L.new(gk.outputs[0], f1.inputs[1])
    col = N.new('ShaderNodeVectorMath'); col.operation = 'SCALE'; L.new(gi.outputs['Color'], col.inputs[0]); L.new(f1.outputs[0], col.inputs['Scale'])
    # AO 加深縫隙
    ao = N.new('ShaderNodeAmbientOcclusion'); ao.inputs['Distance'].default_value = 0.6; ao.samples = 8
    aom = N.new('ShaderNodeMapRange'); L.new(ao.outputs['AO'], aom.inputs['Value']); aom.inputs['To Min'].default_value = 0.62
    col2 = N.new('ShaderNodeVectorMath'); col2.operation = 'SCALE'; L.new(col.outputs[0], col2.inputs[0]); L.new(aom.outputs[0], col2.inputs['Scale'])
    pb = N.new('ShaderNodeBsdfPrincipled')
    L.new(col2.outputs[0], pb.inputs['Base Color']); L.new(gi.outputs['Rough'], pb.inputs['Roughness'])
    pb.inputs['Specular IOR Level'].default_value = 0.25
    L.new(gi.outputs['Color'], pb.inputs['Emission Color']); L.new(gi.outputs['Emit'], pb.inputs['Emission Strength'])
    L.new(gi.outputs['Alpha'], pb.inputs['Alpha'])
    L.new(pb.outputs[0], go.inputs['Shader'])
    return g

def mat(key, var=0.12, brush=0.18, rough=0.85, emit=0.0, alpha=1.0, grime=0.25, color=None, blend=False):
    name = f'{key}|{var}|{brush}|{rough}|{emit}|{alpha}|{grime}|{color}'
    if name in _mats: return _mats[name]
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    gn = nt.nodes.new('ShaderNodeGroup'); gn.node_tree = _node_group()
    gn.inputs['Color'].default_value = color or srgb(PAL[key])
    for k, v in (('Var', var), ('Brush', brush), ('Rough', rough), ('Emit', emit), ('Alpha', alpha), ('Grime', grime)):
        gn.inputs[k].default_value = v
    nt.links.new(gn.outputs['Shader'], out.inputs['Surface'])
    if blend or alpha < 1: m.surface_render_method = 'BLENDED'
    _mats[name] = m
    return m

def glass_mat(dusk=False):
    """窗玻璃：上方反射天空、下方偏暗；黃昏時一部分窗亮暖光（窗簾半掩）。"""
    key = f'glass|{dusk}'
    if key in _mats: return _mats[key]
    m = bpy.data.materials.new(key); m.use_nodes = True; nt = m.node_tree; nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    pb = nt.nodes.new('ShaderNodeBsdfPrincipled'); pb.inputs['Roughness'].default_value = 0.12
    pb.inputs['Base Color'].default_value = srgb(PAL['glass'])
    lw = nt.nodes.new('ShaderNodeLayerWeight'); lw.inputs['Blend'].default_value = 0.35
    mix = nt.nodes.new('ShaderNodeMix'); mix.data_type = 'RGBA'
    mix.inputs[6].default_value = srgb('#24384d'); mix.inputs[7].default_value = srgb('#9fc4e0')
    nt.links.new(lw.outputs['Facing'], mix.inputs['Factor']); nt.links.new(mix.outputs[2], pb.inputs['Base Color'])
    if dusk:
        pb.inputs['Emission Color'].default_value = srgb('#ffc477'); pb.inputs['Emission Strength'].default_value = 3.2
    nt.links.new(pb.outputs[0], out.inputs['Surface'])
    _mats[key] = m
    return m

def leaf_mat(key, center_normal=True):
    """葉片卡：程序化葉形 alpha、法線改用「從樹冠中心往外」的方向，讓整團樹冠受光像一顆柔軟的體積。"""
    name = f'leaf|{key}'
    if name in _mats: return _mats[name]
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree; nt.nodes.clear(); N, L = nt.nodes, nt.links
    out = N.new('ShaderNodeOutputMaterial')
    uv = N.new('ShaderNodeUVMap')
    sep = N.new('ShaderNodeSeparateXYZ'); L.new(uv.outputs['UV'], sep.inputs[0])
    # 葉形：兩頭尖的葉片，|u−.5|·2 < 0.85·sin(πv)^0.9
    du = N.new('ShaderNodeMath'); du.operation = 'SUBTRACT'; L.new(sep.outputs['X'], du.inputs[0]); du.inputs[1].default_value = 0.5
    ab = N.new('ShaderNodeMath'); ab.operation = 'ABSOLUTE'; L.new(du.outputs[0], ab.inputs[0])
    a2 = N.new('ShaderNodeMath'); a2.operation = 'MULTIPLY'; L.new(ab.outputs[0], a2.inputs[0]); a2.inputs[1].default_value = 2.0
    vp = N.new('ShaderNodeMath'); vp.operation = 'MULTIPLY'; L.new(sep.outputs['Y'], vp.inputs[0]); vp.inputs[1].default_value = math.pi
    sn = N.new('ShaderNodeMath'); sn.operation = 'SINE'; L.new(vp.outputs[0], sn.inputs[0])
    pw = N.new('ShaderNodeMath'); pw.operation = 'POWER'; L.new(sn.outputs[0], pw.inputs[0]); pw.inputs[1].default_value = 0.9
    wd = N.new('ShaderNodeMath'); wd.operation = 'MULTIPLY'; L.new(pw.outputs[0], wd.inputs[0]); wd.inputs[1].default_value = 0.85
    lt = N.new('ShaderNodeMath'); lt.operation = 'LESS_THAN'; L.new(a2.outputs[0], lt.inputs[0]); L.new(wd.outputs[0], lt.inputs[1])
    # 顏色：每片葉子隨機深淺（rnd 屬性）＋ 外側較亮
    at = N.new('ShaderNodeAttribute'); at.attribute_name = 'rnd'
    ramp = N.new('ShaderNodeValToRGB'); e = ramp.color_ramp.elements
    e[0].color = srgb(PAL['leaf1']); e[1].color = srgb(PAL['leaf3']); e[0].position = 0.0; e[1].position = 1.0
    mid = e.new(0.45); mid.color = srgb(PAL[key])
    L.new(at.outputs['Fac'], ramp.inputs[0])
    df = N.new('ShaderNodeBsdfDiffuse'); L.new(ramp.outputs[0], df.inputs['Color'])
    tl = N.new('ShaderNodeBsdfTranslucent'); L.new(ramp.outputs[0], tl.inputs['Color'])
    mx = N.new('ShaderNodeMixShader'); mx.inputs[0].default_value = 0.25; L.new(df.outputs[0], mx.inputs[1]); L.new(tl.outputs[0], mx.inputs[2])
    if center_normal:
        tc = N.new('ShaderNodeTexCoord')
        nrm = N.new('ShaderNodeVectorMath'); nrm.operation = 'NORMALIZE'; L.new(tc.outputs['Object'], nrm.inputs[0])
        vt = N.new('ShaderNodeVectorTransform'); vt.vector_type = 'NORMAL'; vt.convert_from = 'OBJECT'; vt.convert_to = 'WORLD'
        L.new(nrm.outputs[0], vt.inputs[0])
        L.new(vt.outputs[0], df.inputs['Normal']); L.new(vt.outputs[0], tl.inputs['Normal'])
    tr = N.new('ShaderNodeBsdfTransparent')
    mx2 = N.new('ShaderNodeMixShader'); L.new(lt.outputs[0], mx2.inputs[0]); L.new(tr.outputs[0], mx2.inputs[1]); L.new(mx.outputs[0], mx2.inputs[2])
    L.new(mx2.outputs[0], out.inputs['Surface'])
    _mats[name] = m
    return m

def grass_mat():
    """草葉卡：細長三角 alpha，根部偏暗。"""
    if 'grassblade' in _mats: return _mats['grassblade']
    m = bpy.data.materials.new('grassblade'); m.use_nodes = True; nt = m.node_tree; nt.nodes.clear(); N, L = nt.nodes, nt.links
    out = N.new('ShaderNodeOutputMaterial'); uv = N.new('ShaderNodeUVMap'); sep = N.new('ShaderNodeSeparateXYZ'); L.new(uv.outputs['UV'], sep.inputs[0])
    at = N.new('ShaderNodeAttribute'); at.attribute_name = 'rnd'
    ramp = N.new('ShaderNodeValToRGB'); e = ramp.color_ramp.elements
    e[0].color = srgb(PAL['grassDeep']); e[1].color = srgb(PAL['grassDry']); mid = e.new(0.55); mid.color = srgb(PAL['grass'])
    L.new(at.outputs['Fac'], ramp.inputs[0])
    hv = N.new('ShaderNodeMapRange'); L.new(sep.outputs['Y'], hv.inputs['Value']); hv.inputs['To Min'].default_value = 0.45
    cm = N.new('ShaderNodeVectorMath'); cm.operation = 'SCALE'; L.new(ramp.outputs[0], cm.inputs[0]); L.new(hv.outputs[0], cm.inputs['Scale'])
    df = N.new('ShaderNodeBsdfDiffuse'); L.new(cm.outputs[0], df.inputs['Color'])
    df_n = N.new('ShaderNodeCombineXYZ'); df_n.inputs['Z'].default_value = 1.0; L.new(df_n.outputs[0], df.inputs['Normal'])
    # 三角形：|u−.5|·2 < 1−v
    du = N.new('ShaderNodeMath'); du.operation = 'SUBTRACT'; L.new(sep.outputs['X'], du.inputs[0]); du.inputs[1].default_value = 0.5
    ab = N.new('ShaderNodeMath'); ab.operation = 'ABSOLUTE'; L.new(du.outputs[0], ab.inputs[0])
    a2 = N.new('ShaderNodeMath'); a2.operation = 'MULTIPLY'; L.new(ab.outputs[0], a2.inputs[0]); a2.inputs[1].default_value = 2.0
    iv = N.new('ShaderNodeMath'); iv.operation = 'SUBTRACT'; iv.inputs[0].default_value = 1.0; L.new(sep.outputs['Y'], iv.inputs[1])
    lt = N.new('ShaderNodeMath'); lt.operation = 'LESS_THAN'; L.new(a2.outputs[0], lt.inputs[0]); L.new(iv.outputs[0], lt.inputs[1])
    tr = N.new('ShaderNodeBsdfTransparent'); mx = N.new('ShaderNodeMixShader')
    L.new(lt.outputs[0], mx.inputs[0]); L.new(tr.outputs[0], mx.inputs[1]); L.new(df.outputs[0], mx.inputs[2])
    L.new(mx.outputs[0], out.inputs['Surface'])
    _mats['grassblade'] = m
    return m

def ground_mat(key, base_hex=None, stripes=False, cracks=False, scale=0.6):
    """地面：大尺度斑駁（草地的深淺塊、柏油的補丁）＋ 可選割草條紋或裂縫。"""
    name = f'ground|{key}|{stripes}|{cracks}'
    if name in _mats: return _mats[name]
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree; nt.nodes.clear(); N, L = nt.nodes, nt.links
    out = N.new('ShaderNodeOutputMaterial'); tc = N.new('ShaderNodeTexCoord')
    pos = N.new('ShaderNodeNewGeometry')
    nz = N.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = scale; nz.inputs['Detail'].default_value = 8; nz.inputs['Roughness'].default_value = 0.6
    L.new(pos.outputs['Position'], nz.inputs['Vector'])
    nz2 = N.new('ShaderNodeTexNoise'); nz2.inputs['Scale'].default_value = 9.0; nz2.inputs['Detail'].default_value = 4
    L.new(pos.outputs['Position'], nz2.inputs['Vector'])
    ramp = N.new('ShaderNodeValToRGB'); e = ramp.color_ramp.elements
    base = srgb(base_hex or PAL[key])
    e[0].color = tuple(c * 0.78 for c in base[:3]) + (1,); e[1].color = tuple(min(1, c * 1.18) for c in base[:3]) + (1,)
    e[0].position = 0.3; e[1].position = 0.72
    mixn = N.new('ShaderNodeMath'); mixn.operation = 'MULTIPLY_ADD'; L.new(nz2.outputs['Fac'], mixn.inputs[0]); mixn.inputs[1].default_value = 0.3; L.new(nz.outputs['Fac'], mixn.inputs[2])
    sh = N.new('ShaderNodeMath'); sh.operation = 'SUBTRACT'; L.new(mixn.outputs[0], sh.inputs[0]); sh.inputs[1].default_value = 0.15
    L.new(sh.outputs[0], ramp.inputs[0])
    col = ramp.outputs[0]
    if stripes:   # 割草條紋：沿 Y 每 1.2 m 深淺交替
        sep = N.new('ShaderNodeSeparateXYZ'); L.new(pos.outputs['Position'], sep.inputs[0])
        wv = N.new('ShaderNodeTexWave'); wv.wave_type = 'BANDS'; wv.bands_direction = 'Y'; wv.inputs['Scale'].default_value = 0.035
        wv.wave_profile = 'SIN'; L.new(pos.outputs['Position'], wv.inputs['Vector'])
        wm = N.new('ShaderNodeMapRange'); L.new(wv.outputs['Fac'], wm.inputs['Value']); wm.inputs['To Min'].default_value = 0.9; wm.inputs['To Max'].default_value = 1.08
        cs = N.new('ShaderNodeVectorMath'); cs.operation = 'SCALE'; L.new(col, cs.inputs[0]); L.new(wm.outputs[0], cs.inputs['Scale']); col = cs.outputs[0]
    if cracks:
        vr = N.new('ShaderNodeTexVoronoi'); vr.feature = 'DISTANCE_TO_EDGE'; vr.inputs['Scale'].default_value = 0.9
        L.new(pos.outputs['Position'], vr.inputs['Vector'])
        dn = N.new('ShaderNodeTexNoise'); dn.inputs['Scale'].default_value = 1.4; L.new(pos.outputs['Position'], dn.inputs['Vector'])
        ck = N.new('ShaderNodeMath'); ck.operation = 'LESS_THAN'; L.new(vr.outputs['Distance'], ck.inputs[0]); ck.inputs[1].default_value = 0.006
        gate = N.new('ShaderNodeMath'); gate.operation = 'GREATER_THAN'; L.new(dn.outputs['Fac'], gate.inputs[0]); gate.inputs[1].default_value = 0.66
        cg = N.new('ShaderNodeMath'); cg.operation = 'MULTIPLY'; L.new(ck.outputs[0], cg.inputs[0]); L.new(gate.outputs[0], cg.inputs[1])
        cm = N.new('ShaderNodeMix'); cm.data_type = 'RGBA'; L.new(cg.outputs[0], cm.inputs['Factor']); L.new(col, cm.inputs[6]); cm.inputs[7].default_value = srgb('#2b2b2e')
        col = cm.outputs[2]
    ao = N.new('ShaderNodeAmbientOcclusion'); ao.inputs['Distance'].default_value = 1.0; ao.samples = 8
    aom = N.new('ShaderNodeMapRange'); L.new(ao.outputs['AO'], aom.inputs['Value']); aom.inputs['To Min'].default_value = 0.55
    fc = N.new('ShaderNodeVectorMath'); fc.operation = 'SCALE'; L.new(col, fc.inputs[0]); L.new(aom.outputs[0], fc.inputs['Scale'])
    pb = N.new('ShaderNodeBsdfPrincipled'); pb.inputs['Roughness'].default_value = 0.92; pb.inputs['Specular IOR Level'].default_value = 0.2
    L.new(fc.outputs[0], pb.inputs['Base Color']); L.new(pb.outputs[0], out.inputs['Surface'])
    _mats[name] = m
    return m

# ── 網格累積器 ──
class Acc:
    """把很多小零件累積成一個網格；每個零件寫入一個隨機值 rnd（材質用來做逐片色差）。"""
    def __init__(self, seed=0):
        self.v, self.f, self.r, self.uv = [], [], [], []
        self.rng = random.Random(seed)
    def _push(self, verts, faces, rnd=None, uvs=None):
        o = len(self.v); self.v += [Vector(p) for p in verts]
        r = self.rng.random() if rnd is None else rnd
        for i, f in enumerate(faces):
            self.f.append(tuple(o + k for k in f)); self.r.append(r)
            self.uv.append(uvs[i] if uvs else None)
        return self
    def box(self, c, s, rot=(0, 0, 0), rnd=None):
        hx, hy, hz = s[0] / 2, s[1] / 2, s[2] / 2
        R = Euler(rot).to_matrix()
        vs = [Vector(c) + R @ Vector((dx * hx, dy * hy, dz * hz)) for dx, dy, dz in
              [(-1,-1,-1),(1,-1,-1),(1,1,-1),(-1,1,-1),(-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1)]]
        return self._push(vs, [(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)], rnd)
    def poly_prism(self, pts2d, axis_from, axis_to, plane, rnd=None):
        """二維斷面 pts2d 沿 axis_from→axis_to 擠出。plane(u,v,t) 回傳 3D 點。"""
        n = len(pts2d); vs = [plane(u, v, axis_from) for u, v in pts2d] + [plane(u, v, axis_to) for u, v in pts2d]
        faces = [tuple(range(n - 1, -1, -1)), tuple(range(n, 2 * n))] + [(i, (i + 1) % n, n + (i + 1) % n, n + i) for i in range(n)]
        return self._push(vs, faces, rnd)
    def quad(self, a, b, c, d, rnd=None):
        return self._push([a, b, c, d], [(0, 1, 2, 3)], rnd, [((0, 0), (1, 0), (1, 1), (0, 1))])
    def tube(self, a, b, r0, r1=None, n=8, rnd=None):
        a, b = Vector(a), Vector(b); r1 = r0 if r1 is None else r1; d = (b - a)
        if d.length < 1e-6: return self
        q = d.normalized().to_track_quat('Z', 'Y'); vs = []
        for p, r in ((a, r0), (b, r1)):
            for i in range(n):
                t = i / n * math.tau; vs.append(p + q @ Vector((math.cos(t) * r, math.sin(t) * r, 0)))
        faces = [(i, (i + 1) % n, n + (i + 1) % n, n + i) for i in range(n)] + [tuple(range(n - 1, -1, -1)), tuple(range(n, 2 * n))]
        return self._push(vs, faces, rnd)
    def obj(self, name, m, loc=(0, 0, 0), bevel=0.0, smooth=False, coll=None, subsurf=0):
        if not self.v: return None
        me = bpy.data.meshes.new(name); me.from_pydata([tuple(p) for p in self.v], [], self.f); me.update()
        at = me.attributes.new('rnd', 'FLOAT', 'FACE')
        for i, r in enumerate(self.r): at.data[i].value = r
        if any(u is not None for u in self.uv):
            uvl = me.uv_layers.new(name='UVMap'); li = 0
            for fi, poly in enumerate(me.polygons):
                us = self.uv[fi]
                for k in range(poly.loop_total):
                    uvl.data[poly.loop_start + k].uv = us[k] if us else (0, 0)
        if smooth:
            for p in me.polygons: p.use_smooth = True
        ob = bpy.data.objects.new(name, me); ob.location = loc
        (coll or bpy.context.collection).objects.link(ob)
        if isinstance(m, (list, tuple)):
            for mm in m: ob.data.materials.append(mm)
        else: ob.data.materials.append(m)
        if bevel > 0:
            md = ob.modifiers.new('bev', 'BEVEL'); md.width = bevel; md.segments = 2; md.limit_method = 'ANGLE'; md.harden_normals = False
        if subsurf:
            md = ob.modifiers.new('sub', 'SUBSURF'); md.levels = subsurf; md.render_levels = subsurf
        return ob

def coll(name):
    c = bpy.data.collections.get(name)
    if not c: c = bpy.data.collections.new(name); bpy.context.scene.collection.children.link(c)
    return c

def prim_sphere(name, loc, r, m, scale=(1, 1, 1), sub=3, c=None, displace=0.0, seed=0):
    me = bpy.data.meshes.new(name)
    import bmesh
    bm = bmesh.new(); bmesh.ops.create_icosphere(bm, subdivisions=sub, radius=1.0); bm.to_mesh(me); bm.free()
    for p in me.polygons: p.use_smooth = True
    ob = bpy.data.objects.new(name, me); ob.location = loc; ob.scale = (r * scale[0], r * scale[1], r * scale[2])
    (c or bpy.context.collection).objects.link(ob); ob.data.materials.append(m)
    if displace:
        tx = bpy.data.textures.new(name + 'tx', 'CLOUDS'); tx.noise_scale = 0.6; tx.noise_depth = 2
        md = ob.modifiers.new('disp', 'DISPLACE'); md.texture = tx; md.strength = displace; md.mid_level = 0.5
        md.texture_coords = 'GLOBAL' if seed == 0 else 'LOCAL'
    return ob

def skin_mesh(name, verts, edges, radii, m, loc=(0, 0, 0), root=0, levels=2, c=None):
    """skin modifier：用骨架點與半徑長出有肉感的形體（四肢、身體、衣服、狗）。"""
    me = bpy.data.meshes.new(name); me.from_pydata([tuple(v) for v in verts], edges, []); me.update()
    ob = bpy.data.objects.new(name, me); ob.location = loc; (c or bpy.context.collection).objects.link(ob)
    sk = ob.modifiers.new('skin', 'SKIN'); sk.use_smooth_shade = True; sk.branch_smoothing = 0.6
    sv = me.skin_vertices[0].data
    for i, r in enumerate(radii):
        sv[i].radius = r if isinstance(r, (tuple, list)) else (r, r)
        sv[i].use_root = (i == root)
    sub = ob.modifiers.new('sub', 'SUBSURF'); sub.levels = levels; sub.render_levels = levels
    ob.data.materials.append(m)
    return ob

def parent_all(name, objs, loc=(0, 0, 0), rz=0.0):
    root = bpy.data.objects.new(name, None); bpy.context.collection.objects.link(root)
    for o in objs:
        if o is not None: o.parent = root
    root.location = loc; root.rotation_euler = (0, 0, rz)
    return root

def clear():
    for ob in list(bpy.data.objects): bpy.data.objects.remove(ob, do_unlink=True)
