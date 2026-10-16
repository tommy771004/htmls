# 霓虹夜城（259）車輛資產：player_car（含四輪子節點 wheel_FL/FR/RL/RR）、traffic_car、hover_spinner → blender/out/vehicles.glb
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *

reset()

M = {
    'body_gunmetal': mat('body_gunmetal', '#181c26', rough=0.22, metal=0.82),
    'body_trim': mat('body_trim', '#0d1017', rough=0.45, metal=0.6),
    'body_accent': mat('body_accent', '#283044', rough=0.28, metal=0.75),
    'corp_body': mat('corp_body', '#1f192b', rough=0.26, metal=0.78),
    'spinner_body': mat('spinner_body', '#141b29', rough=0.25, metal=0.85),
    'glass_dark': mat('glass_dark', '#080d18', rough=0.08, metal=0.15),
    'tire_rubber': mat('tire_rubber', '#101216', rough=0.85, metal=0.05),
    'rim_chrome': mat('rim_chrome', '#99a8bf', rough=0.18, metal=0.9),
    'headlight_cyan': mat('headlight_cyan', '#d8fbff', rough=0.1, emit='#00f2ff', emit_strength=4.5),
    'taillight_red': mat('taillight_red', '#ff2a55', rough=0.1, emit='#ff1744', emit_strength=4.2),
    'neon_cyan': mat('neon_cyan', '#00f0ff', rough=0.15, emit='#00e5ff', emit_strength=3.6),
    'neon_magenta': mat('neon_magenta', '#ff2bd6', rough=0.15, emit='#ff1ec8', emit_strength=3.6),
    'neon_amber': mat('neon_amber', '#ffaa00', rough=0.15, emit='#ff9900', emit_strength=3.4),
    'exhaust_plasma': mat('exhaust_plasma', '#66f7ff', rough=0.1, emit='#00d8ff', emit_strength=5.0),
}


def make_wheel(name, x, y, z, r=0.35, w=0.26, is_left=True):
    mb = MB()
    x0, x1 = (-w / 2, w / 2)
    # 輪胎本體與胎肩
    mb.cyl_x(x0, x1, 0, 0, r, 18, M['tire_rubber'], side_m=M['tire_rubber'])
    # 輪框與發光霓虹外環
    rim_x = -w * 0.48 if is_left else w * 0.48
    rim_x2 = -w * 0.52 if is_left else w * 0.52
    mb.cyl_x(min(rim_x, rim_x2), max(rim_x, rim_x2), 0, 0, r * 0.68, 14, M['rim_chrome'])
    mb.cyl_x(min(rim_x, rim_x2) - 0.01, max(rim_x, rim_x2) + 0.01, 0, 0, r * 0.76, 16, M['neon_cyan'], cap0=False, cap1=False)
    # 五輻輪爪
    for i in range(5):
        a = i * 2 * math.pi / 5
        cy, cz = math.cos(a) * r * 0.32, math.sin(a) * r * 0.32
        mb.box(min(rim_x, rim_x2) - 0.015, max(rim_x, rim_x2) + 0.015, cy - 0.04, cy + 0.04, cz - 0.04, cz + 0.04, M['rim_chrome'])
    o = mb.build(name, origin=(0, 0, 0))
    o.location = Vector((x, y, z))
    return o


# ==================== 1. 玩家座駕：V-TECH QUADRA // 2088 ====================
def build_player_car():
    mb = MB()
    # 楔形超跑車體放樣（面向 -Y：車頭 y=-2.28，車尾 y=+2.22）
    sections = [
        (-2.28, [(-0.82, 0.16), (0.82, 0.16), (0.76, 0.42), (-0.76, 0.42)]),   # 前擾流鼻端
        (-1.85, [(-0.96, 0.15), (0.96, 0.15), (0.92, 0.64), (-0.92, 0.64)]),   # 前輪拱前緣
        (-0.95, [(-1.02, 0.16), (1.02, 0.16), (0.95, 0.78), (-0.95, 0.78)]),   # 擋風玻璃底座
        (-0.20, [(-1.00, 0.16), (1.00, 0.16), (0.74, 1.18), (-0.74, 1.18)]),   # 座艙前頂
        (0.75,  [(-1.02, 0.17), (1.02, 0.17), (0.76, 1.16), (-0.76, 1.16)]),   # 座艙後頂
        (1.65,  [(-1.04, 0.19), (1.04, 0.19), (0.94, 0.86), (-0.94, 0.86)]),   # 後輪拱與引擎蓋
        (2.22,  [(-0.94, 0.22), (0.94, 0.22), (0.88, 0.78), (-0.88, 0.78)]),   # 車尾截斷面
    ]
    face_mats = {
        (2, 2): M['glass_dark'],
        (3, 2): M['glass_dark'],
        (3, 1): M['glass_dark'],
        (3, 3): M['glass_dark'],
    }
    mb.loft_y(sections, M['body_gunmetal'], face_mats=face_mats)

    # 寬體前後輪拱外擴裝甲
    for sx in (-1, 1):
        mb.chamfer_box(sx * 0.98, -1.38, 0.44, 0.11, 0.52, 0.24, 0.05, M['body_accent'])
        mb.chamfer_box(sx * 1.00, 1.32, 0.48, 0.12, 0.56, 0.26, 0.05, M['body_accent'])
        # 側裙與底盤青色霓虹燈條
        mb.box(sx * 1.03 - 0.02, sx * 1.03 + 0.02, -0.82, 0.76, 0.14, 0.22, M['body_trim'])
        mb.box(sx * 1.04 - 0.015, sx * 1.04 + 0.015, -0.78, 0.72, 0.12, 0.15, M['neon_cyan'])
        # 車門未來感導光飾條
        mb.box(sx * 1.01 - 0.01, sx * 1.01 + 0.01, -0.65, 0.65, 0.58, 0.61, M['neon_cyan'])
        # 後視鏡小翼
        mb.box(sx * 0.98 - 0.06, sx * 0.98 + 0.06, -0.72, -0.58, 0.82, 0.87, M['body_accent'])

    # 前下巴分流器與青色進氣刃
    mb.box(-0.92, 0.92, -2.35, -2.18, 0.11, 0.16, M['body_trim'])
    mb.box(-0.86, 0.86, -2.36, -2.32, 0.12, 0.145, M['neon_cyan'])

    # 雙側四眼賽博頭燈（Quad LED Headlights）
    for sx in (-1, 1):
        mb.box(sx * 0.62 - 0.22, sx * 0.62 + 0.22, -2.30, -2.23, 0.34, 0.41, M['headlight_cyan'])
        mb.box(sx * 0.62 - 0.20, sx * 0.62 + 0.20, -2.29, -2.22, 0.26, 0.30, M['neon_cyan'])

    # 引擎蓋散熱百葉（斜向百葉窗）與中央動力隆起
    mb.chamfer_box(0.0, -1.45, 0.68, 0.36, 0.42, 0.05, 0.06, M['body_trim'])
    for k in range(5):
        yk = 0.88 + k * 0.20
        zk = 1.08 - k * 0.055
        mb.box(-0.62, 0.62, yk, yk + 0.11, zk, zk + 0.04, M['body_trim'])
    # 後窗旁洋紅導光肋條
    for sx in (-1, 1):
        mb.box(sx * 0.68 - 0.025, sx * 0.68 + 0.025, 0.82, 1.85, 0.88, 1.08, M['neon_magenta'])

    # 車尾貫穿式尾燈組（Quadra 經典雙層紅光帶 + 尾翼 + 雙離子排氣管）
    mb.box(-0.90, 0.90, 2.18, 2.25, 0.56, 0.68, M['taillight_red'])
    mb.box(-0.86, 0.86, 2.19, 2.26, 0.44, 0.49, M['taillight_red'])
    # 尾翼支架與雙層擾流尾翼
    for sx in (-0.68, 0.68):
        mb.box(sx - 0.04, sx + 0.04, 1.92, 2.16, 0.76, 1.02, M['body_trim'])
    mb.box(-0.98, 0.98, 1.90, 2.24, 1.00, 1.05, M['body_gunmetal'])
    mb.box(-0.98, 0.98, 2.22, 2.26, 1.01, 1.04, M['neon_magenta'])
    # 後下擴散器與雙離子推進排氣口
    mb.box(-0.82, 0.82, 2.14, 2.25, 0.16, 0.34, M['body_trim'])
    for sx in (-0.36, -0.16, 0.16, 0.36):
        mb.cyl_z(sx, 2.24, 0.24, 0.30, 0.055, 10, M['exhaust_plasma'])

    car = mb.build('player_car', origin=(0, 0, 0))
    # 四顆獨立車輪子節點
    wheels = [
        ('wheel_FL', -0.96, -1.38, 0.35, True),
        ('wheel_FR',  0.96, -1.38, 0.35, False),
        ('wheel_RL', -0.98,  1.32, 0.37, True),
        ('wheel_RR',  0.98,  1.32, 0.37, False),
    ]
    for wn, wx, wy, wz, is_l in wheels:
        w_obj = make_wheel(wn, wx, wy, wz, r=wz, w=0.28, is_left=is_l)
        w_obj.parent = car
    return car


# ==================== 2. AI 街車：CORP CRUISER ====================
def build_traffic_car():
    mb = MB()
    sections = [
        (-2.10, [(-0.78, 0.18), (0.78, 0.18), (0.74, 0.46), (-0.74, 0.46)]),
        (-1.20, [(-0.90, 0.18), (0.90, 0.18), (0.86, 0.76), (-0.86, 0.76)]),
        (-0.35, [(-0.88, 0.18), (0.88, 0.18), (0.72, 1.22), (-0.72, 1.22)]),
        (0.85,  [(-0.88, 0.18), (0.88, 0.18), (0.72, 1.20), (-0.72, 1.20)]),
        (1.95,  [(-0.84, 0.22), (0.84, 0.22), (0.80, 0.78), (-0.80, 0.78)]),
    ]
    mb.loft_y(sections, M['corp_body'], face_mats={(1, 2): M['glass_dark'], (2, 2): M['glass_dark']})
    # 車頂企業識別燈條與前後貫穿燈
    mb.box(-0.72, 0.72, -2.12, -2.06, 0.34, 0.42, M['neon_amber'])
    mb.box(-0.76, 0.76, 1.92, 1.98, 0.52, 0.64, M['taillight_red'])
    mb.box(-0.42, 0.42, -0.15, 0.45, 1.21, 1.27, M['neon_magenta'])
    for sx in (-0.88, 0.88):
        for sy in (-1.25, 1.22):
            mb.cyl_x(sx - 0.12, sx + 0.12, sy, 0.33, 0.33, 14, M['tire_rubber'])
    o = mb.build('traffic_car', origin=(0, 0, 0))
    o.location = Vector((6.0, 0, 0))
    return o


# ==================== 3. 空中巡邏飛車：AV-9 SPINNER ====================
def build_hover_spinner():
    mb = MB()
    sections = [
        (-2.35, [(-0.55, 0.30), (0.55, 0.30), (0.45, 0.62), (-0.45, 0.62)]),
        (-0.90, [(-1.10, 0.22), (1.10, 0.22), (0.82, 0.98), (-0.82, 0.98)]),
        (0.65,  [(-1.18, 0.24), (1.18, 0.24), (0.78, 1.06), (-0.78, 1.06)]),
        (2.10,  [(-0.72, 0.36), (0.72, 0.36), (0.58, 0.86), (-0.58, 0.86)]),
    ]
    mb.loft_y(sections, M['spinner_body'], face_mats={(0, 2): M['glass_dark'], (1, 2): M['glass_dark']})
    # 左右向量懸浮推進器（Vector Thruster Nacelles）
    for sx in (-1.32, 1.32):
        mb.chamfer_box(sx, -0.45, 0.48, 0.26, 0.62, 0.18, 0.06, M['body_accent'])
        mb.cyl_z(sx, -0.45, 0.26, 0.32, 0.20, 14, M['exhaust_plasma'])
        mb.chamfer_box(sx * 0.95, 1.25, 0.54, 0.22, 0.48, 0.16, 0.05, M['body_accent'])
        mb.cyl_z(sx * 0.95, 1.25, 0.34, 0.40, 0.17, 14, M['exhaust_plasma'])
    # 底部探照燈艙與紅藍警示霓虹
    mb.cyl_z(0, -1.25, 0.08, 0.26, 0.18, 12, M['headlight_cyan'])
    mb.box(-0.55, -0.05, -0.10, 0.30, 1.05, 1.12, M['taillight_red'])
    mb.box(0.05, 0.55, -0.10, 0.30, 1.05, 1.12, M['neon_cyan'])
    o = mb.build('hover_spinner', origin=(0, 0, 0))
    o.location = Vector((12.0, 0, 0))
    return o


build_player_car()
build_traffic_car()
build_hover_spinner()
export_glb('vehicles.glb')
