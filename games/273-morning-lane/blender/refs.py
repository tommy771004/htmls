# 第一步美術定調：渲染參考圖到 ../ref/。
# blender -b --factory-startup -P blender/refs.py -- <shot>
#   shot = morning | dusk | night | action | sheet | kit | sky-morning|sky-dusk|sky-night（只有天空，輸出到 dist/）
import bpy, sys, os, math, random
from mathutils import Vector
sys.path.insert(0, os.path.dirname(__file__))
import kit_common as K, kit_house as KH, kit_nature as KN, kit_street as KS, kit_rider as KR, kit_sky as KY
from kit_common import srgb, ST

shot = sys.argv[sys.argv.index('--') + 1] if '--' in sys.argv else 'morning'
OUT = os.path.join(os.path.dirname(__file__), '..', 'ref')
K.clear()
rng = random.Random(273)

from kit_lots import LOTS, LW

def block(dusk=False, y0=-40, y1=152, fade=lambda s, yc: False, only=None):
    drives = [(1, -1 * LW + LW / 2 + 5.5), (-1, 2 * LW + LW / 2 - 5.5)]
    KS.street(y0, y1, rng, drives)
    for s in (-1, 1): KS.lawn(s, y0, y1)
    for k, (s, i, spec, sub) in enumerate(LOTS):
        if only and (s, i) not in only: continue
        yc = i * LW + LW / 2
        _, door_u = KH.house(f'h{k}', s, yc, spec, dusk, fade(s, yc), seed=k + 1)
        dy = yc + s * door_u
        KS.fence(f'fence{k}', s, yc - LW / 2 + 0.1, yc + LW / 2 - 0.1, dy, rng, gate_open=0.5 + rng.random() * 0.8)
        # 步道石板、花圃、灌木、院子的樹
        st = K.Acc(500 + k); x = ST['fence'] + 0.2
        while x < ST['houseFront'] - 3.0:
            st.box((s * x, dy + rng.uniform(-0.12, 0.12), 0.15), (rng.uniform(0.45, 0.6), rng.uniform(0.7, 0.95), 0.05), (0, 0, rng.uniform(-0.2, 0.2))); x += 0.7
        st.obj(f'path{k}', K.mat('stone', var=0.25, brush=0.3, grime=0.2), coll=K.coll('props'), bevel=0.02)
        fx = s * (ST['houseFront'] - 0.6)
        for e in (-1, 1):
            y_a, y_b = dy + e * 1.6 * (1 if s > 0 else -1), yc + e * (spec['W'] / 2 - 0.4) * (1 if s > 0 else -1)
            ya, yb = min(y_a, y_b), max(y_a, y_b)
            if yb - ya > 1.0:
                KN.flower_bed(f'bed{k}{e}', fx - s * 0.5, fx + s * 0.5, ya, yb, rng)
                for j in range(int((yb - ya) / 1.4)):
                    KN.bush(f'bush{k}{e}{j}', (fx, ya + 0.7 + j * 1.4, 0.12), rng, rng.uniform(0.45, 0.65), rng.choice(['leaf1', 'leaf2']),
                            rng.choice([None, None, 'flowerPink', 'flowerWhite', 'flowerViolet']))
        tufts = [(s * (ST['fence'] + rng.uniform(0.0, 0.35)), yc + rng.uniform(-LW / 2, LW / 2), 0.14) for _ in range(160)]
        tufts += [(s * rng.uniform(ST['fence'] + 0.4, ST['houseFront'] - 0.5), yc + rng.uniform(-LW / 2, LW / 2), 0.14) for _ in range(140)]
        KN.grass_tufts(f'lawngrass{k}', tufts, rng)
        if k % 3 == 1:
            KN.tree(f'yard{k}', (s * (ST['houseFront'] + spec['D'] + 3.5), yc + rng.uniform(-3, 3), 0.12), rng, height=10.5, crown=4.2, leaf='leaf2', clumps=13)
        # 信箱在植栽帶、步道正對面
        KS.mailbox(f'mb{k}', s * ST['mailboxX'], dy + s * 1.3, s, sub, rng)
    # 行道樹（植栽帶，每塊地一棵，和信箱錯開）
    y = y0 + 3; alt = 0
    while y < y1:
        alt += 1
        for s in ((-1,) if alt % 2 else (1,)):
            KN.tree(f'st{s}_{int(y)}', (s * 4.62, y + rng.uniform(-0.8, 0.8), 0.14), rng, height=rng.uniform(9.5, 11.5), crown=rng.uniform(3.6, 4.4),
                    leaf=rng.choice(['leaf1', 'leaf2', 'leaf2']), clumps=12, cards=130, lean=rng.uniform(-1, 1))
        y += LW
    for i, y in enumerate(range(-8, int(y1), 32)):
        KS.lamp(f'lamp{i}', 4.62 * (1 if i % 2 == 0 else -1), y + 8, dusk)
    KS.utility_poles(-4.2, y0 + 6, y1 - 4)
    KS.hydrant('hyd', 4.35, 13.0)
    KS.car('car', 1 * (ST['houseFront'] - 2.5), -1 * LW + LW / 2 + 5.5, math.pi / 2 + 0.05, 'car')
    KS.car('car2', -2.45, 46, 0.0, 'carRed')
    KS.wheelie_bin('bin', 4.05, 30.5, 0.3)
    KS.wheelie_bin('bin2', -4.05, 18.0, -0.2, 'bin')
    KS.sprinkler('spr', 9.6, 22.5, rng)
    KS.dog('dog', -8.0, 4.0, -1.2)

def setup(w, h, look='day'):
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_EEVEE'; sc.render.resolution_x = w; sc.render.resolution_y = h
    sc.eevee.taa_render_samples = 64
    for attr, val in (('use_raytracing', True), ('use_shadows', True), ('shadow_ray_count', 2), ('shadow_step_count', 8)):
        if hasattr(sc.eevee, attr): setattr(sc.eevee, attr, val)
    # 色調映射用 Khronos PBR Neutral：保留飽和度（AgX 會把亮藍天洗白），與執行時 three 的 NeutralToneMapping 同一條曲線
    sc.view_settings.view_transform = 'Khronos PBR Neutral'; sc.view_settings.look = 'None'
    bpy.context.view_layer.use_pass_mist = True
    sc.view_settings.exposure = {'day': -0.1, 'dusk': -0.1, 'night': 0.0}.get(look, 0.0)
    if sc.world and sc.world.name != 'Sky':
        sc.world.mist_settings.start = 25; sc.world.mist_settings.depth = 140; sc.world.mist_settings.falloff = 'LINEAR'
    ng = bpy.data.node_groups.new('Comp', 'CompositorNodeTree')
    ng.interface.new_socket('Image', in_out='OUTPUT', socket_type='NodeSocketColor')
    N, L = ng.nodes, ng.links
    rl = N.new('CompositorNodeRLayers')
    # 大氣霧：遠處往天空色靠（降低「桌上模型」感）
    try:
        mx = N.new('ShaderNodeMix'); mx.data_type = 'RGBA'; fac, ia, ib, o = mx.inputs['Factor'], mx.inputs[6], mx.inputs[7], mx.outputs[2]
    except Exception:
        mx = N.new('CompositorNodeMixRGB'); fac, ia, ib, o = mx.inputs[0], mx.inputs[1], mx.inputs[2], mx.outputs[0]
    ib.default_value = srgb({'day': '#9fc9f2', 'dusk': '#f0b88a', 'night': '#27365e', 'sheet': '#c9c2b5', 'wide': '#9cc8f0'}[look])
    try:
        mm = N.new('ShaderNodeMath'); mm.operation = 'MULTIPLY'
        L.new(rl.outputs['Mist'], mm.inputs[0]); mm.inputs[1].default_value = {'day': 0.75, 'dusk': 0.7, 'night': 0.7, 'sheet': 0.0, 'wide': 0.18}[look]
        L.new(mm.outputs[0], fac)
    except Exception as e:
        print('mist', e); fac.default_value = 0.0
    L.new(rl.outputs['Image'], ia)
    ku = N.new('CompositorNodeKuwahara'); ku.inputs['Type'].default_value = 'Anisotropic'; ku.inputs['Size'].default_value = 3
    try: ku.inputs['Sharpness'].default_value = 0.75; ku.inputs['Eccentricity'].default_value = 1.0
    except Exception: pass
    gl = N.new('CompositorNodeGlare'); gl.inputs['Type'].default_value = 'Bloom'; gl.inputs['Threshold'].default_value = 0.9
    gl.inputs['Strength'].default_value = {'dusk': 0.5, 'night': 0.8}.get(look, 0.28); gl.inputs['Size'].default_value = 0.6
    cb = N.new('CompositorNodeColorBalance')
    hs = N.new('CompositorNodeHueSat'); hs.inputs['Saturation'].default_value = 1.08
    go = N.new('NodeGroupOutput')
    src = o
    if look in ('day', 'dusk', 'night'):
        # 霧只罩場景：透明底片 + 環境 pass，把天空（不加霧）疊回場景後面
        sc.render.film_transparent = True; bpy.context.view_layer.use_pass_environment = True
        sa = N.new('CompositorNodeSetAlpha'); L.new(o, sa.inputs['Image']); L.new(rl.outputs['Alpha'], sa.inputs['Alpha'])
        try: sa.inputs['Type'].default_value = 'Replace Alpha'
        except Exception: pass
        ao = N.new('CompositorNodeAlphaOver'); L.new(rl.outputs['Environment'], ao.inputs['Background']); L.new(sa.outputs[0], ao.inputs['Foreground'])
        src = ao.outputs[0]
    L.new(src, ku.inputs['Image']); L.new(ku.outputs[0], gl.inputs['Image']); L.new(gl.outputs[0], cb.inputs['Image'])
    L.new(cb.outputs[0], hs.inputs['Image']); L.new(hs.outputs[0], go.inputs[0])
    sc.compositing_node_group = ng; sc.render.use_compositing = True
    cols = [i for i in cb.inputs if i.type == 'RGBA' and i.name in ('Lift', 'Gain')]
    if look == 'dusk': cols[0].default_value = (1.0, 1.0, 1.02, 1); cols[1].default_value = (1.04, 1.0, 0.96, 1)
    else: cols[0].default_value = (0.99, 0.99, 1.03, 1); cols[1].default_value = (1.04, 1.0, 0.95, 1)
    return sc

def sky(top, horizon, strength):
    w = bpy.data.worlds.new('Sky'); bpy.context.scene.world = w; w.use_nodes = True
    nt = w.node_tree; bg = nt.nodes.get('Background')
    tc = nt.nodes.new('ShaderNodeTexCoord'); sep = nt.nodes.new('ShaderNodeSeparateXYZ'); nt.links.new(tc.outputs['Generated'], sep.inputs[0])
    ramp = nt.nodes.new('ShaderNodeValToRGB'); e = ramp.color_ramp.elements
    e[0].position = 0.0; e[0].color = srgb(horizon); e[1].position = 0.12; e[1].color = srgb(top)
    nt.links.new(sep.outputs['Z'], ramp.inputs[0]); nt.links.new(ramp.outputs[0], bg.inputs['Color'])
    bg.inputs['Strength'].default_value = strength
    return w

def sun(rot_deg, color, energy, angle=2.0):
    L = bpy.data.lights.new('Sun', 'SUN'); L.energy = energy; L.color = color; L.angle = math.radians(angle)
    o = bpy.data.objects.new('Sun', L); o.rotation_euler = tuple(math.radians(a) for a in rot_deg); bpy.context.scene.collection.objects.link(o)

def camera(target, pitch, yaw, dist, fov):
    """斜角俯視：鏡頭在騎士右後方高處（+X、−Y），往下俯 pitch°、往左偏 yaw°；街道在畫面裡由左下斜向右上。"""
    t = Vector(target); p, y = math.radians(pitch), math.radians(yaw)
    fwd = Vector((-math.sin(y) * math.cos(p), math.cos(y) * math.cos(p), -math.sin(p)))
    cam = bpy.data.cameras.new('Cam'); cam.angle = math.radians(fov); cam.sensor_fit = 'VERTICAL'; cam.clip_end = 600
    o = bpy.data.objects.new('Cam', cam); bpy.context.scene.collection.objects.link(o)
    o.location = t - fwd * dist; o.rotation_mode = 'QUATERNION'; o.rotation_quaternion = fwd.to_track_quat('-Z', 'Y')
    bpy.context.scene.camera = o
    return o

def chase_camera(rider, height=2.15, back=4.6, ahead=9.0, look_h=1.15, fov=56, yaw=0.0, side=0.0):
    """追車鏡頭（依參考影片）：騎士正後方 back 公尺、高 height 公尺，看向前方 ahead 公尺、離地 look_h 的點；垂直視角 fov°。"""
    r = Vector(rider); fw = Vector((math.sin(-yaw), math.cos(-yaw), 0)); rt = Vector((fw.y, -fw.x, 0))
    pos = r - fw * back + rt * side + Vector((0, 0, height)); tgt = r + fw * ahead + Vector((0, 0, look_h))
    cam = bpy.data.cameras.new('Cam'); cam.angle = math.radians(fov); cam.sensor_fit = 'VERTICAL'; cam.clip_end = 4000
    o = bpy.data.objects.new('Cam', cam); bpy.context.scene.collection.objects.link(o)
    o.location = pos; o.rotation_mode = 'QUATERNION'; o.rotation_quaternion = (tgt - pos).to_track_quat('-Z', 'Y')
    bpy.context.scene.camera = o
    return o

CHASE = dict(height=2.15, back=4.6, ahead=9.0, look_h=1.15, fov=56)   # 之後寫進 src/core/config.js 的 CAMERA
RIDER = Vector((1.7, 2.0, 0.12))

if shot in ('morning', 'dusk', 'night', 'action'):
    time = 'morning' if shot == 'action' else shot
    world, hor = KY.painted_sky(time, cover=0.55 if time != 'night' else 0.7)
    if time == 'morning': sun((52, 0, -32), (1.0, 0.9, 0.74), 6.0, 1.6)
    elif time == 'dusk': sun((79, 0, -48), (1.0, 0.6, 0.34), 6.0, 1.4)
    else: sun((50, 0, 200), (0.55, 0.65, 1.0), 1.1, 1.0)
    if time == 'night':
        # 可讀性用的兩盞燈（遊戲裡跟著騎士走）：車燈往前打一道暖光，頭頂後方一盞冷色補光讓剪影跳出來
        def lamp(kind, loc, rot, energy, color, size=0.2, spot=None):
            L = bpy.data.lights.new(kind, kind); L.energy = energy; L.color = color; L.shadow_soft_size = size
            if spot: L.spot_size = spot; L.spot_blend = 0.6
            o = bpy.data.objects.new(kind, L); o.location = loc; o.rotation_euler = rot; bpy.context.scene.collection.objects.link(o)
        lamp('SPOT', RIDER + Vector((0, 0.85, 0.95)), (math.radians(78), 0, 0), 900, (1.0, 0.86, 0.62), 0.05, math.radians(38))
        lamp('POINT', RIDER + Vector((0.4, -1.6, 3.2)), (0, 0, 0), 160, (0.62, 0.74, 1.0), 1.2)
    lamps_on = time != 'morning'
    block(lamps_on)
    KY.backdrop(rng, time)
    if shot == 'action':
        KR.rider('rider', RIDER + Vector((0.6, 4.0, 0)), 0.0, pedal=0.9, throw=True)
        KR.flying_paper('fly', RIDER + Vector((1.65, 4.45, 1.3)), 0.25)
        chase_camera(RIDER + Vector((0.6, 4.0, 0)), height=1.9, back=3.2, ahead=4.0, look_h=1.0, fov=50, side=-1.1)
        sc = setup(1500, 1000)
    else:
        KR.rider('rider', RIDER, -0.05, pedal=0.3)
        chase_camera(RIDER, **CHASE)
        sc = setup(1600, 900, {'morning': 'day', 'dusk': 'dusk', 'night': 'night'}[time])
elif shot == 'sheet':
    w = bpy.data.worlds.new('W'); bpy.context.scene.world = w; w.use_nodes = True
    w.node_tree.nodes['Background'].inputs[0].default_value = srgb('#c3bcae'); w.node_tree.nodes['Background'].inputs[1].default_value = 0.9
    fl = K.Acc(1); fl.box((0, 0, -0.01), (40, 20, 0.02)); fl.obj('floor', K.mat('concrete', color=srgb('#d6cfc1'), var=0.0, brush=0.05, grime=0.0))
    for i, rz in enumerate((math.pi, -math.pi / 2, 0, math.pi * 0.8)):
        KR.rider(f'r{i}', (-3.6 + i * 2.4, 0, 0), rz, pedal=0.6 if i != 1 else 0.2)
    keys = ['hoodie', 'hoodieDark', 'shorts', 'cap', 'skin', 'hair', 'bag', 'paper', 'frame', 'tire', 'sneaker', 'band']
    for i, k in enumerate(keys):
        sw = K.Acc(10 + i); sw.box((-3.85 + i * 0.7, 0.9, 2.62), (0.55, 0.05, 0.22)); sw.obj(f'sw{k}', K.mat(k, var=0.0, brush=0.0, grime=0.0))
    cam = bpy.data.cameras.new('Cam'); cam.type = 'ORTHO'; cam.ortho_scale = 9.2
    o = bpy.data.objects.new('Cam', cam); bpy.context.scene.collection.objects.link(o)
    o.location = (0, -14, 2.75); o.rotation_euler = (math.radians(84), 0, 0); bpy.context.scene.camera = o
    sun((52, 0, 28), (1.0, 0.94, 0.84), 3.8, 4)
    sc = setup(1500, 1000, 'sheet')
    for i, t in enumerate(('FRONT', 'SIDE', 'BACK', '3/4')):
        cu = bpy.data.curves.new(t, 'FONT'); cu.body = t; cu.size = 0.3; cu.align_x = 'CENTER'
        ob = bpy.data.objects.new(t, cu); ob.location = (-3.6 + i * 2.4, 0.8, 2.1); ob.rotation_euler = (math.radians(84), 0, 0)
        bpy.context.scene.collection.objects.link(ob); ob.data.materials.append(K.mat('tire', var=0.0, grime=0.0))
elif shot == 'kit':
    # 模組化地塊：三種房型＋柵欄＋信箱的組合，給之後換季、換路線時對照
    sky('#1f7de6', '#a9d4fb', 1.0); sun((58, 0, 128), (1.0, 0.9, 0.74), 4.4, 2)
    block(False, y0=-8, y1=56, only={(-1, 0), (-1, 1), (-1, 2)})
    w = bpy.context.scene.world; w.mist_settings.start = 80; w.mist_settings.depth = 400
    camera((-13, 24, 1.5), 34, 38, 66, 34); sc = setup(1600, 900, 'wide')

elif shot.startswith('sky-'):
    # 只有天空（對照執行時的天空 shader 用）：同一組追車鏡頭、同一套合成，輸出到 dist/
    time = shot[4:]
    KY.painted_sky(time, cover=0.55 if time != 'night' else 0.7)
    chase_camera(RIDER, **CHASE); sc = setup(1600, 900, {'morning': 'day', 'dusk': 'dusk', 'night': 'night'}[time])
    OUT = os.path.join(os.path.dirname(__file__), '..', 'dist')

name = {'sheet': 'ref-rider-sheet', 'action': 'ref-rider-action', 'morning': 'ref-street-morning', 'dusk': 'ref-street-dusk',
        'night': 'ref-street-night', 'kit': 'ref-lot-kit'}.get(shot, shot)
sc.render.filepath = os.path.abspath(os.path.join(OUT, name + '.png'))
bpy.ops.render.render(write_still=True)
print('ok', name)
