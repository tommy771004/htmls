# 天空與遠景：手繪感積雲天空（世界著色器）、遠山、山坡上的小鎮、遠方林帶。
# 世界座標的 Generated 在 world 著色器裡就是視線方向（z = 仰角的正弦），雲投影在一片高空平面上。
import bpy, math, random
from mathutils import Vector
from kit_common import Acc, mat, srgb, coll, prim_sphere

TIMES = {
    #        天頂        地平線       雲亮面       雲暗面       強度
    'morning': ('#1a63db', '#6fb2f2', '#fffaf0', '#8ea7cf', 1.0),
    'dusk':    ('#3c5aa0', '#ffb877', '#ffd6a8', '#8a6f9c', 0.7),
    'night':   ('#0b1430', '#26355c', '#3a4b78', '#141d3a', 0.6),
}

# 環境光的一半換成中性偏暖的灰，影子才不會偏藍、把暖色衣服染成橄欖綠
AMB_GREY = {'morning': '#c9c4ba', 'dusk': '#b9a49a', 'night': '#3a4260'}

def painted_sky(time='morning', cover=0.5, seed=3.0):
    top, hor, lit, shade, strength = TIMES[time]
    w = bpy.data.worlds.new('Sky'); bpy.context.scene.world = w; w.use_nodes = True
    nt = w.node_tree; N, L = nt.nodes, nt.links; bg = N.get('Background')
    tc = N.new('ShaderNodeTexCoord'); sep = N.new('ShaderNodeSeparateXYZ'); L.new(tc.outputs['Generated'], sep.inputs[0])
    def m(op, a, b=None, v=None):
        n = N.new('ShaderNodeMath'); n.operation = op
        L.new(a, n.inputs[0]) if not isinstance(a, (int, float)) else n.inputs.__getitem__(0).__setattr__('default_value', a)
        if b is not None:
            L.new(b, n.inputs[1]) if not isinstance(b, (int, float)) else setattr(n.inputs[1], 'default_value', b)
        return n.outputs[0]
    z = sep.outputs['Z']
    zc = m('ADD', m('MAXIMUM', z, 0.02), 0.07)
    u = m('DIVIDE', sep.outputs['X'], zc); v = m('DIVIDE', sep.outputs['Y'], zc)
    def cloud(ox, oy):
        cmb = N.new('ShaderNodeCombineXYZ'); L.new(m('ADD', u, ox), cmb.inputs['X']); L.new(m('ADD', v, oy), cmb.inputs['Y']); cmb.inputs['Z'].default_value = seed
        nz = N.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 0.24; nz.inputs['Detail'].default_value = 7; nz.inputs['Roughness'].default_value = 0.58
        nz.inputs['Distortion'].default_value = 0.25
        L.new(cmb.outputs[0], nz.inputs['Vector'])
        return nz.outputs['Fac']
    n1 = cloud(0.0, 0.0); n2 = cloud(-0.35, -0.25)        # 第二次取樣往太陽反方向偏移，用差值做亮暗面
    rm = N.new('ShaderNodeMapRange'); L.new(n1, rm.inputs['Value'])
    rm.inputs['From Min'].default_value = 0.6 - cover * 0.16; rm.inputs['From Max'].default_value = 0.67 - cover * 0.16
    rm.interpolation_type = 'SMOOTHSTEP'
    hz = N.new('ShaderNodeMapRange'); L.new(z, hz.inputs['Value']); hz.inputs['From Min'].default_value = 0.01; hz.inputs['From Max'].default_value = 0.09
    hz.interpolation_type = 'SMOOTHSTEP'
    mask = m('MULTIPLY', rm.outputs[0], hz.outputs[0])
    sh = N.new('ShaderNodeMapRange'); L.new(m('SUBTRACT', n1, n2), sh.inputs['Value'])
    sh.inputs['From Min'].default_value = -0.08; sh.inputs['From Max'].default_value = 0.05; sh.interpolation_type = 'SMOOTHSTEP'
    cc = N.new('ShaderNodeMix'); cc.data_type = 'RGBA'; L.new(sh.outputs[0], cc.inputs['Factor'])
    cc.inputs[6].default_value = srgb(shade); cc.inputs[7].default_value = srgb(lit)
    # 天空漸層
    sg = N.new('ShaderNodeMapRange'); L.new(z, sg.inputs['Value']); sg.inputs['From Min'].default_value = 0.0; sg.inputs['From Max'].default_value = 0.24
    sg.interpolation_type = 'SMOOTHSTEP'
    sk = N.new('ShaderNodeMix'); sk.data_type = 'RGBA'; L.new(sg.outputs[0], sk.inputs['Factor'])
    sk.inputs[6].default_value = srgb(hor); sk.inputs[7].default_value = srgb(top)
    fin = N.new('ShaderNodeMix'); fin.data_type = 'RGBA'; L.new(mask, fin.inputs['Factor']); L.new(sk.outputs[2], fin.inputs[6]); L.new(cc.outputs[2], fin.inputs[7])
    # 照明用較暗、偏天空色的版本：避免雲把整個場景打得太亮
    lp = N.new('ShaderNodeLightPath')
    amb = N.new('ShaderNodeMix'); amb.data_type = 'RGBA'; L.new(lp.outputs['Is Camera Ray'], amb.inputs['Factor'])
    amb.inputs[6].default_value = tuple(((a + b) * 0.25 + g * 0.5) * 0.85 for a, b, g in zip(srgb(top)[:3], srgb(hor)[:3], srgb(AMB_GREY[time])[:3])) + (1,); L.new(fin.outputs[2], amb.inputs[7])
    L.new(amb.outputs[2], bg.inputs['Color']); bg.inputs['Strength'].default_value = strength
    w.mist_settings.start = 30; w.mist_settings.depth = 520; w.mist_settings.falloff = 'QUADRATIC'
    return w, hor

def backdrop(rng, time='morning'):
    """遠景：一圈遠山（越遠越藍）、山坡上的小鎮、遠方林帶、近一點的丘陵。"""
    C = coll('backdrop')
    hills = [('#4f7f52', 700, 160, 0.22), ('#557a6a', 1100, 260, 0.26), ('#5f7897', 1700, 420, 0.24)]
    for k, (col, dist, rad, sz) in enumerate(hills):
        for i in range(9):
            ang = math.radians(-70 + i * 17 + rng.uniform(-5, 5))
            p = Vector((math.sin(ang) * dist, math.cos(ang) * dist, -rad * (1 - sz) * 0.85))
            prim_sphere(f'hill{k}_{i}', p, rad * rng.uniform(0.8, 1.2), mat('grass', color=srgb(col), var=0.0, brush=0.35, rough=1.0, grime=0.0),
                        (1.6, 1.0, sz * 2.2), 3, C, displace=0.12)
    # 近丘與林帶
    forest = Acc(200)
    for i in range(260):
        ang = math.radians(rng.uniform(-75, 75)); d = rng.uniform(320, 620)
        p = Vector((math.sin(ang) * d, math.cos(ang) * d, rng.uniform(-14, 2)))
        r = rng.uniform(5, 11)
        forest.box(p + Vector((0, 0, r * 0.6)), (r * 2, r * 2, r * 1.6), (0, 0, rng.random()))
    fo = forest.obj('forest', mat('leaf1', color=srgb('#3f6e3c'), var=0.3, brush=0.4, rough=1.0, grime=0.0), coll=C, bevel=2.0)
    if fo: fo.modifiers['bev'].segments = 3
    # 小鎮：山坡上一片暖色牆、紅屋頂的小房子
    walls = Acc(201); roofs = Acc(202); lit = Acc(203)
    for i in range(320):
        ang = math.radians(rng.gauss(-18, 9)); d = rng.uniform(760, 980)
        base = Vector((math.sin(ang) * d, math.cos(ang) * d, (d - 760) * 0.18 - 8 + rng.uniform(-3, 3)))
        wdt, dep, h = rng.uniform(5, 9), rng.uniform(5, 9), rng.uniform(4, 9)
        rz = rng.uniform(-0.4, 0.4)
        walls.box(base + Vector((0, 0, h / 2)), (wdt, dep, h), (0, 0, rz))
        roofs.box(base + Vector((0, 0, h + 1.0)), (wdt + 0.6, dep + 0.6, 2.0), (0, 0, rz))
        if time == 'night' and rng.random() < 0.55:
            lit.box(base + Vector((0, 0, h * 0.5)), (wdt + 0.05, dep * 0.3, 1.2), (0, 0, rz))
    walls.obj('townWalls', mat('cream', var=0.35, brush=0.2, rough=1.0, grime=0.0), coll=C)
    roofs.obj('townRoofs', mat('terracotta', color=srgb('#b8483a'), var=0.35, brush=0.2, rough=1.0, grime=0.0), coll=C, bevel=0.8)
    if time == 'night': lit.obj('townLights', mat('lampGlow', emit=6.0, var=0.2, grime=0.0), coll=C)
    # 教堂尖塔（小鎮的視覺錨點）
    sp = Acc(204); b = Vector((math.sin(math.radians(-14)) * 840, math.cos(math.radians(-14)) * 840, 10))
    sp.box(b + Vector((0, 0, 12)), (7, 7, 24)); sp.poly_prism([(-4, 0), (4, 0), (0, 16)], -4, 4, lambda u, v, t: b + Vector((u, t, 24 + v)))
    sp.obj('steeple', mat('cream', var=0.0, grime=0.0), coll=C)
    # 地面延伸到遠方
    g = Acc(205); g.box((0, 340, -0.1), (900, 560, 0.2)); g.obj('farGround', mat('grass', color=srgb('#5a9440'), var=0.0, brush=0.4, grime=0.0), coll=C)
