# 霓虹夜城（259）室內道具（夜店與酒吧）：dj_booth、speaker_stack、laser_rig、club_table、bar_counter、bottle_rack、bar_stool、arcade_cab、jukebox → blender/out/interior_props.glb
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *

reset()

M = {
    'dark_metal': mat('int_dark_metal', '#141822', rough=0.32, metal=0.78),
    'chrome': mat('int_chrome', '#8fa0b8', rough=0.18, metal=0.92),
    'leather_red': mat('int_leather_red', '#4d1222', rough=0.48, metal=0.1),
    'leather_dark': mat('int_leather_dark', '#1d1628', rough=0.50, metal=0.1),
    'wood_warm': mat('int_wood_warm', '#382218', rough=0.40, metal=0.12),
    'neon_cyan': mat('int_neon_cyan', '#00f2ff', rough=0.1, emit='#00e5ff', emit_strength=4.2),
    'neon_magenta': mat('int_neon_mag', '#ff2bd6', rough=0.1, emit='#ff1ec8', emit_strength=4.2),
    'neon_amber': mat('int_neon_amber', '#ffaa00', rough=0.1, emit='#ff9500', emit_strength=3.8),
    'neon_lime': mat('int_neon_lime', '#00ff88', rough=0.1, emit='#00f078', emit_strength=3.8),
    'neon_purple': mat('int_neon_purple', '#9d4edd', rough=0.1, emit='#9d4edd', emit_strength=3.6),
}


# 1. 夜店 DJ 主控台 dj_booth
def build_dj_booth():
    mb = MB()
    # 高台階梯底座與斜切裝甲前牆
    mb.chamfer_box(0, 0, 0.22, 2.20, 1.25, 0.22, 0.14, M['dark_metal'])
    mb.chamfer_box(0, -0.38, 0.92, 1.65, 0.45, 0.48, 0.10, M['dark_metal'])
    # 前方 EQ 發光條矩陣
    for i in range(-6, 7):
        x = i * 0.22
        h = 0.22 + (abs(i * 37 % 5) + 1) * 0.09
        col = M['neon_cyan'] if i % 2 == 0 else M['neon_magenta']
        mb.box(x - 0.06, x + 0.06, -0.85, -0.82, 0.52, 0.52 + h, col)
    # 桌面雙黑膠唱盤與混音器
    for sx in (-0.62, 0.62):
        mb.cyl_z(sx, -0.35, 1.40, 1.45, 0.28, 16, M['chrome'])
        mb.cyl_z(sx, -0.35, 1.45, 1.47, 0.22, 16, M['neon_cyan'])
    mb.box(-0.24, 0.24, -0.55, -0.15, 1.40, 1.46, M['neon_magenta'])
    # 後方全息視覺拱門框
    mb.box(-1.85, -1.65, 0.55, 0.75, 0.44, 3.20, M['dark_metal'])
    mb.box(1.65, 1.85, 0.55, 0.75, 0.44, 3.20, M['dark_metal'])
    mb.box(-1.85, 1.85, 0.55, 0.75, 3.00, 3.22, M['dark_metal'])
    mb.box(-1.62, 1.62, 0.52, 0.56, 2.96, 3.04, M['neon_cyan'])
    return mb.build('dj_booth', origin=(0, 0, 0))


# 2. 夜店重低音音箱塔 speaker_stack
def build_speaker_stack():
    mb = MB()
    mb.chamfer_box(0, 0, 1.35, 0.58, 0.52, 1.35, 0.06, M['dark_metal'])
    for z in (0.48, 1.22, 1.96):
        mb.cyl_z(0, -0.53, z - 0.26, z + 0.26, 0.34, 14, M['chrome'])
        mb.cyl_z(0, -0.55, z - 0.18, z + 0.18, 0.26, 14, M['neon_magenta'])
    o = mb.build('speaker_stack', origin=(0, 0, 0))
    o.location = Vector((5.0, 0, 0))
    return o


# 3. 舞池頂部環形雷射燈架 laser_rig
def build_laser_rig():
    mb = MB()
    mb.cyl_z(0, 0, -0.12, 0.12, 2.60, 16, M['dark_metal'], cap0=False, cap1=False)
    for i in range(8):
        a = i * math.pi / 4
        cx, cy = math.cos(a) * 2.55, math.sin(a) * 2.55
        col = M['neon_cyan'] if i % 2 == 0 else M['neon_magenta']
        mb.cyl_z(cx, cy, -0.28, 0.02, 0.16, 10, col)
    o = mb.build('laser_rig', origin=(0, 0, 0))
    o.location = Vector((10.0, 0, 0))
    return o


# 4. 夜店 VIP 卡座沙發與發光桌 club_table
def build_club_table():
    mb = MB()
    # U 型環繞沙發與發光茶几
    mb.chamfer_box(0, 0.85, 0.42, 1.35, 0.38, 0.42, 0.06, M['leather_dark'])
    mb.chamfer_box(0, 1.12, 0.78, 1.35, 0.14, 0.36, 0.05, M['leather_red'])
    mb.chamfer_box(-1.15, 0.15, 0.42, 0.32, 0.65, 0.42, 0.05, M['leather_dark'])
    mb.chamfer_box(1.15, 0.15, 0.42, 0.32, 0.65, 0.42, 0.05, M['leather_dark'])
    # 中央懸浮霓虹桌
    mb.chamfer_box(0, 0.05, 0.46, 0.68, 0.42, 0.05, 0.06, M['dark_metal'], top_m=M['neon_cyan'])
    mb.cyl_z(0, 0.05, 0.0, 0.42, 0.18, 10, M['chrome'])
    o = mb.build('club_table', origin=(0, 0, 0))
    o.location = Vector((16.0, 0, 0))
    return o


# 5. 餘燼酒吧 L 型發光吧台 bar_counter
def build_bar_counter():
    mb = MB()
    # 正面長吧台與側面折角
    mb.chamfer_box(0, 0, 0.56, 2.60, 0.48, 0.56, 0.06, M['wood_warm'])
    mb.chamfer_box(0, 0, 1.12, 2.68, 0.54, 0.05, 0.06, M['dark_metal'])
    mb.box(-2.55, 2.55, -0.50, -0.47, 0.92, 1.02, M['neon_amber'])
    mb.box(-2.55, 2.55, -0.50, -0.47, 0.12, 0.20, M['neon_magenta'])
    # 吧台上的發光生啤柱與調酒杯
    for sx in (-1.20, 0.0, 1.20):
        mb.cyl_z(sx, -0.10, 1.17, 1.56, 0.06, 10, M['chrome'])
        mb.cyl_z(sx, -0.18, 1.46, 1.54, 0.04, 8, M['neon_cyan'])
    o = mb.build('bar_counter', origin=(0, 0, 0))
    o.location = Vector((22.0, 0, 0))
    return o


# 6. 後方發光酒架牆 bottle_rack
def build_bottle_rack():
    mb = MB()
    mb.chamfer_box(0, 0, 1.35, 2.20, 0.24, 1.35, 0.04, M['dark_metal'])
    cols = (M['neon_amber'], M['neon_cyan'], M['neon_magenta'], M['neon_lime'], M['neon_purple'])
    for r in range(3):
        z0 = 0.85 + r * 0.56
        mb.box(-2.05, 2.05, -0.26, 0.20, z0 - 0.04, z0, M['neon_amber'])
        for b in range(9):
            bx = -1.76 + b * 0.44
            col = cols[(r * 3 + b) % len(cols)]
            mb.cyl_z(bx, -0.05, z0, z0 + 0.34, 0.065, 8, col)
            mb.cyl_z(bx, -0.05, z0 + 0.34, z0 + 0.44, 0.025, 8, M['chrome'])
    o = mb.build('bottle_rack', origin=(0, 0, 0))
    o.location = Vector((28.0, 0, 0))
    return o


# 7. 高腳吧台椅 bar_stool
def build_bar_stool():
    mb = MB()
    mb.cyl_z(0, 0, 0.0, 0.05, 0.24, 12, M['chrome'])
    mb.cyl_z(0, 0, 0.05, 0.74, 0.045, 10, M['chrome'])
    mb.cyl_z(0, 0, 0.28, 0.31, 0.18, 12, M['neon_amber'])
    mb.cyl_z(0, 0, 0.74, 0.84, 0.22, 14, M['leather_red'])
    o = mb.build('bar_stool', origin=(0, 0, 0))
    o.location = Vector((33.0, 0, 0))
    return o


# 8. 復古街機與全息點唱機 arcade_cab & jukebox
def build_arcade_cab():
    mb = MB()
    mb.chamfer_box(0, 0, 0.98, 0.44, 0.46, 0.98, 0.04, M['dark_metal'])
    mb.box(-0.38, 0.38, -0.48, -0.42, 1.15, 1.65, M['neon_cyan'])
    mb.box(-0.40, 0.40, -0.50, -0.42, 1.72, 1.92, M['neon_magenta'])
    mb.box(-0.40, 0.40, -0.56, -0.35, 0.92, 1.02, M['chrome'])
    o = mb.build('arcade_cab', origin=(0, 0, 0))
    o.location = Vector((36.0, 0, 0))
    return o


def build_jukebox():
    mb = MB()
    mb.chamfer_box(0, 0, 0.85, 0.54, 0.38, 0.85, 0.08, M['wood_warm'])
    mb.cyl_z(0, 0, 1.45, 1.85, 0.52, 14, M['neon_amber'])
    mb.box(-0.48, -0.40, -0.40, -0.36, 0.20, 1.55, M['neon_magenta'])
    mb.box(0.40, 0.48, -0.40, -0.36, 0.20, 1.55, M['neon_cyan'])
    mb.box(-0.34, 0.34, -0.40, -0.36, 0.75, 1.38, M['neon_purple'])
    o = mb.build('jukebox', origin=(0, 0, 0))
    o.location = Vector((39.0, 0, 0))
    return o


build_dj_booth()
build_speaker_stack()
build_laser_rig()
build_club_table()
build_bar_counter()
build_bottle_rack()
build_bar_stool()
build_arcade_cab()
build_jukebox()
export_glb('interior_props.glb')
