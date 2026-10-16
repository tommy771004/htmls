# 霓虹夜城（259）人物與骨架動作：human_rig + human（含 idle、walk、run、dance_groove、dance_hype、bartend 六段動作）→ blender/out/characters.glb
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *

reset()

M = {
    'jacket': mat('cyber_jacket', '#191d2b', rough=0.35, metal=0.45),
    'jacket_collar': mat('cyber_collar', '#252b3f', rough=0.32, metal=0.5),
    'neon_trim': mat('cyber_trim_cyan', '#00f0ff', rough=0.15, emit='#00e5ff', emit_strength=3.5),
    'neon_mag': mat('cyber_trim_mag', '#ff2bd6', rough=0.15, emit='#ff1ec8', emit_strength=3.5),
    'skin': mat('cyber_skin', '#e0ac8b', rough=0.65, metal=0.05),
    'hair': mat('cyber_hair', '#111522', rough=0.5, metal=0.2),
    'pants': mat('cyber_pants', '#141821', rough=0.6, metal=0.15),
    'boots': mat('cyber_boots', '#0c0e14', rough=0.4, metal=0.4),
}

# 15 根骨頭的人體骨架（面向 -Y，身高約 1.76 m）
BONES = [
    ('root',       (0.0, 0.0, 0.0),    (0.0, 0.0, 0.20),   None),
    ('hips',       (0.0, 0.0, 0.92),   (0.0, 0.0, 1.04),   'root'),
    ('spine',      (0.0, 0.0, 1.04),   (0.0, 0.0, 1.22),   'hips'),
    ('chest',      (0.0, 0.0, 1.22),   (0.0, 0.0, 1.44),   'spine'),
    ('neck',       (0.0, 0.0, 1.44),   (0.0, 0.0, 1.52),   'chest'),
    ('head',       (0.0, 0.0, 1.52),   (0.0, 0.0, 1.76),   'neck'),
    ('upperarm_L', (0.21, 0.0, 1.40),  (0.24, 0.0, 1.12),  'chest'),
    ('forearm_L',  (0.24, 0.0, 1.12),  (0.25, 0.0, 0.84),  'upperarm_L'),
    ('upperarm_R', (-0.21, 0.0, 1.40), (-0.24, 0.0, 1.12), 'chest'),
    ('forearm_R',  (-0.24, 0.0, 1.12), (-0.25, 0.0, 0.84), 'upperarm_R'),
    ('thigh_L',    (0.11, 0.0, 0.92),  (0.11, 0.0, 0.50),  'hips'),
    ('shin_L',     (0.11, 0.0, 0.50),  (0.11, 0.0, 0.08),  'thigh_L'),
    ('foot_L',     (0.11, 0.0, 0.08),  (0.11, -0.14, 0.02),'shin_L'),
    ('thigh_R',    (-0.11, 0.0, 0.92), (-0.11, 0.0, 0.50), 'hips'),
    ('shin_R',     (-0.11, 0.0, 0.50), (-0.11, 0.0, 0.08), 'thigh_R'),
    ('foot_R',     (-0.11, 0.0, 0.08), (-0.11, -0.14, 0.02),'shin_R'),
]

arm = armature('human_rig', BONES)
parts = []


def add_part(name, bone, fn):
    mb = MB()
    fn(mb)
    o = mb.build(name, origin=(0, 0, 0))
    parts.append((o, bone))


# 骨盆與戰術腰帶
add_part('p_hips', 'hips', lambda mb: (
    mb.chamfer_box(0, 0, 0.96, 0.16, 0.11, 0.08, 0.04, M['pants']),
    mb.box(-0.165, 0.165, -0.115, 0.115, 1.01, 1.045, M['neon_mag']),
))

# 腹部與胸甲夾克（武侍高領 + 發光青色肩線與背脊核心）
add_part('p_spine', 'spine', lambda mb: (
    mb.chamfer_box(0, 0, 1.13, 0.155, 0.105, 0.095, 0.04, M['jacket']),
))

add_part('p_chest', 'chest', lambda mb: (
    mb.chamfer_box(0, 0, 1.33, 0.19, 0.125, 0.12, 0.05, M['jacket']),
    # 高聳發光電馭立領
    mb.box(-0.14, 0.14, 0.02, 0.13, 1.43, 1.54, M['jacket_collar']),
    mb.box(-0.14, -0.10, -0.08, 0.12, 1.43, 1.53, M['jacket_collar']),
    mb.box(0.10, 0.14, -0.08, 0.12, 1.43, 1.53, M['jacket_collar']),
    mb.box(-0.145, 0.145, 0.12, 0.138, 1.48, 1.535, M['neon_trim']),
    # 背部發光脊椎條與前胸霓虹徽飾
    mb.box(-0.03, 0.03, 0.12, 0.135, 1.23, 1.44, M['neon_trim']),
    mb.box(-0.15, -0.05, -0.13, -0.12, 1.36, 1.39, M['neon_trim']),
    mb.box(0.05, 0.15, -0.13, -0.12, 1.36, 1.39, M['neon_trim']),
))

# 頸部與頭部（含全息電馭護目鏡 Cyber-Visor 與潮流短髮）
add_part('p_neck', 'neck', lambda mb: (
    mb.cyl_z(0, 0, 1.43, 1.53, 0.055, 10, M['skin']),
))

add_part('p_head', 'head', lambda mb: (
    mb.chamfer_box(0, -0.01, 1.63, 0.095, 0.105, 0.11, 0.045, M['skin']),
    # 賽博龐克非對稱髮型
    mb.chamfer_box(0, 0.01, 1.71, 0.102, 0.112, 0.055, 0.04, M['hair']),
    mb.box(-0.102, 0.102, 0.03, 0.115, 1.54, 1.72, M['hair']),
    # 發光護目鏡 Visor（面向 -Y）
    mb.box(-0.098, 0.098, -0.122, -0.085, 1.615, 1.662, M['neon_trim']),
    mb.box(-0.104, 0.104, -0.09, 0.05, 1.625, 1.65, M['jacket_collar']),
))

# 左右手臂（含發光手環與手掌）
for side, sx in (('L', 1), ('R', -1)):
    add_part(f'p_uarm_{side}', f'upperarm_{side}', lambda mb, sx=sx: (
        mb.chamfer_box(sx * 0.225, 0, 1.26, 0.058, 0.058, 0.145, 0.025, M['jacket']),
        mb.box(sx * 0.225 - 0.062, sx * 0.225 + 0.062, -0.062, 0.062, 1.36, 1.39, M['neon_trim']),
    ))
    add_part(f'p_farm_{side}', f'forearm_{side}', lambda mb, sx=sx: (
        mb.chamfer_box(sx * 0.245, 0, 0.99, 0.048, 0.048, 0.12, 0.02, M['jacket']),
        mb.box(sx * 0.245 - 0.052, sx * 0.245 + 0.052, -0.052, 0.052, 0.88, 0.91, M['neon_mag']),
        mb.chamfer_box(sx * 0.25, -0.01, 0.82, 0.042, 0.048, 0.05, 0.018, M['skin']),
    ))

# 左右腿與發光鞋底戰術靴
for side, sx in (('L', 1), ('R', -1)):
    add_part(f'p_thigh_{side}', f'thigh_{side}', lambda mb, sx=sx: (
        mb.chamfer_box(sx * 0.11, 0, 0.71, 0.072, 0.072, 0.21, 0.03, M['pants']),
    ))
    add_part(f'p_shin_{side}', f'shin_{side}', lambda mb, sx=sx: (
        mb.chamfer_box(sx * 0.11, 0, 0.29, 0.058, 0.058, 0.20, 0.025, M['pants']),
        mb.box(sx * 0.11 - 0.062, sx * 0.11 + 0.062, -0.064, 0.062, 0.44, 0.48, M['jacket_collar']),
    ))
    add_part(f'p_foot_{side}', f'foot_{side}', lambda mb, sx=sx: (
        mb.chamfer_box(sx * 0.11, -0.05, 0.055, 0.056, 0.11, 0.045, 0.02, M['boots']),
        mb.box(sx * 0.11 - 0.058, sx * 0.11 + 0.058, -0.162, 0.062, 0.005, 0.024, M['neon_trim']),
    ))

body = bind_rigid(parts, arm, 'human')


# ==================== 6 段細膩動作烘焙 ====================
def bake_clip(name, frames, fn):
    begin_action(arm, name)
    for f in range(frames + 1):
        t = f / frames
        rots, locs = fn(t)
        pose(arm, f, rots=rots, locs=locs)
    end_action(arm, cyclic=True, interp='LINEAR')


# 1. idle：呼吸起伏、重心微移、頭部環顧
def anim_idle(t):
    a = t * 2 * math.pi
    s = math.sin(a)
    c = math.cos(a)
    return {
        'hips': (0, 1.5 * s, 2.0 * c),
        'spine': (2.0 * s, -1.0 * s, 0),
        'chest': (2.5 * s, 0, -2.5 * c),
        'head': (-2.0 * s, 2.0 * c, 8.0 * s),
        'upperarm_L': (4.0 * s, 0, -4.0),
        'forearm_L': (-12.0 - 4.0 * s, 0, 0),
        'upperarm_R': (-4.0 * s, 0, 4.0),
        'forearm_R': (-12.0 + 4.0 * s, 0, 0),
        'thigh_L': (-2.0 * s, 0, 0),
        'shin_L': (4.0 * max(0, s), 0, 0),
        'thigh_R': (2.0 * s, 0, 0),
        'shin_R': (4.0 * max(0, -s), 0, 0),
    }, {'hips': (0.01 * s, 0, 0.012 * c)}


# 2. walk：自然街頭漫步（骨盆擺動、手臂前後擺、膝蓋抬屈）
def anim_walk(t):
    a = t * 2 * math.pi
    s, c = math.sin(a), math.cos(a)
    s2 = math.sin(2 * a)
    kL = max(0.0, -c) * 38.0 + 6.0
    kR = max(0.0, c) * 38.0 + 6.0
    return {
        'hips': (3.0, 3.5 * s, -5.0 * s),
        'spine': (3.0, -2.0 * s, 3.0 * s),
        'chest': (4.0, -1.5 * s, 5.0 * s),
        'head': (-3.0, 0, -3.5 * s),
        'upperarm_L': (-26.0 * s, 0, -3.0),
        'forearm_L': (-18.0 - 12.0 * max(0.0, s), 0, 0),
        'upperarm_R': (26.0 * s, 0, 3.0),
        'forearm_R': (-18.0 - 12.0 * max(0.0, -s), 0, 0),
        'thigh_L': (28.0 * s, 0, 0),
        'shin_L': (-kL, 0, 0),
        'foot_L': (-10.0 * s + 6.0, 0, 0),
        'thigh_R': (-28.0 * s, 0, 0),
        'shin_R': (-kR, 0, 0),
        'foot_R': (10.0 * s + 6.0, 0, 0),
    }, {'hips': (0.018 * s, 0, 0.025 * abs(c) - 0.012 + 0.005 * s2)}


# 3. run：夜城快跑衝刺（身體前傾、大幅度擺臂與高抬腿）
def anim_run(t):
    a = t * 2 * math.pi
    s, c = math.sin(a), math.cos(a)
    kL = max(0.0, -c) * 68.0 + 12.0
    kR = max(0.0, c) * 68.0 + 12.0
    return {
        'hips': (10.0, 5.0 * s, -8.0 * s),
        'spine': (8.0, -3.0 * s, 5.0 * s),
        'chest': (10.0, -2.0 * s, 8.0 * s),
        'head': (-12.0, 0, -5.0 * s),
        'upperarm_L': (-52.0 * s + 10.0, 0, -6.0),
        'forearm_L': (-65.0 - 20.0 * s, 0, 0),
        'upperarm_R': (52.0 * s + 10.0, 0, 6.0),
        'forearm_R': (-65.0 + 20.0 * s, 0, 0),
        'thigh_L': (48.0 * s + 8.0, 0, 0),
        'shin_L': (-kL, 0, 0),
        'foot_L': (-18.0 * s + 10.0, 0, 0),
        'thigh_R': (-48.0 * s + 8.0, 0, 0),
        'shin_R': (-kR, 0, 0),
        'foot_R': (18.0 * s + 10.0, 0, 0),
    }, {'hips': (0.025 * s, 0, 0.055 * abs(s) - 0.03)}


# 4. dance_groove：夜店律動熱舞（重拍Bounce、骨盆搖擺、雙手交替律動與點頭）
def anim_dance_groove(t):
    a = t * 2 * math.pi
    s, c = math.sin(a), math.cos(a)
    s2, c2 = math.sin(2 * a), math.cos(2 * a)
    return {
        'hips': (4.0 * s2, 10.0 * s, 12.0 * c),
        'spine': (-6.0 * s2, -6.0 * s, -8.0 * c),
        'chest': (10.0 * abs(s2), -5.0 * s, 14.0 * s),
        'head': (14.0 * s2, 6.0 * c, -10.0 * s),
        'upperarm_L': (-45.0 - 35.0 * s, -20.0 * c, -28.0 - 15.0 * s2),
        'forearm_L': (-75.0 - 25.0 * c2, 0, 15.0 * s),
        'upperarm_R': (-45.0 + 35.0 * s, 20.0 * c, 28.0 + 15.0 * s2),
        'forearm_R': (-75.0 + 25.0 * c2, 0, -15.0 * s),
        'thigh_L': (16.0 * abs(s2) + 8.0 * s, -5.0 * s, 0),
        'shin_L': (-28.0 * abs(s2) - 10.0 * max(0, s), 0, 0),
        'foot_L': (12.0 * abs(s2), 0, 0),
        'thigh_R': (16.0 * abs(s2) - 8.0 * s, -5.0 * s, 0),
        'shin_R': (-28.0 * abs(s2) - 10.0 * max(0, -s), 0, 0),
        'foot_R': (12.0 * abs(s2), 0, 0),
    }, {'hips': (0.055 * s, 0, -0.045 * abs(s2))}


# 5. dance_hype：雙手高舉電音狂歡舞（Rave Hands-Up Pump）
def anim_dance_hype(t):
    a = t * 2 * math.pi
    s, c = math.sin(a), math.cos(a)
    s2 = math.sin(2 * a)
    return {
        'hips': (6.0 * s2, 8.0 * c, 15.0 * s),
        'spine': (-8.0 * s2, -4.0 * c, -6.0 * s),
        'chest': (-10.0 + 12.0 * s2, 0, 12.0 * c),
        'head': (18.0 * s2, 8.0 * s, -8.0 * c),
        'upperarm_L': (-135.0 + 22.0 * s2, -15.0, -25.0 + 12.0 * s),
        'forearm_L': (-35.0 - 25.0 * s2, 0, 0),
        'upperarm_R': (-135.0 - 22.0 * s2, 15.0, 25.0 + 12.0 * s),
        'forearm_R': (-35.0 + 25.0 * s2, 0, 0),
        'thigh_L': (22.0 * max(0.0, s) + 10.0 * abs(s2), 0, 0),
        'shin_L': (-36.0 * max(0.0, s) - 14.0 * abs(s2), 0, 0),
        'thigh_R': (22.0 * max(0.0, -s) + 10.0 * abs(s2), 0, 0),
        'shin_R': (-36.0 * max(0.0, -s) - 14.0 * abs(s2), 0, 0),
    }, {'hips': (0.04 * c, 0, 0.05 * max(0.0, s2) - 0.025)}


# 6. bartend：調酒師搖雪克杯與擦吧台動作
def anim_bartend(t):
    a = t * 2 * math.pi
    s, c = math.sin(a), math.cos(a)
    s3 = math.sin(3 * a)
    return {
        'hips': (0, 2.0 * s, 4.0 * s),
        'spine': (4.0, 0, 4.0 * s),
        'chest': (6.0, 0, 8.0 * s),
        'head': (4.0 + 4.0 * s3, 0, -10.0 * s),
        'upperarm_R': (-65.0 + 18.0 * s3, 15.0, 20.0),
        'forearm_R': (-85.0 + 28.0 * s3, 0, -20.0),
        'upperarm_L': (-42.0 + 8.0 * s, -10.0, -14.0),
        'forearm_L': (-55.0 + 15.0 * c, 0, 12.0 * s),
        'thigh_L': (0, 0, 0),
        'thigh_R': (0, 0, 0),
    }, {'hips': (0.015 * s, 0, 0.008 * abs(s3))}


bake_clip('idle', 48, anim_idle)
bake_clip('walk', 30, anim_walk)
bake_clip('run', 22, anim_run)
bake_clip('dance_groove', 36, anim_dance_groove)
bake_clip('dance_hype', 32, anim_dance_hype)
bake_clip('bartend', 48, anim_bartend)

stash_actions(arm, ['idle', 'walk', 'run', 'dance_groove', 'dance_hype', 'bartend'])
export_glb('characters.glb')
