# 霓虹夜城（259）街道道具：street_lamp、neon_sign_kanji、vending_machine、holo_projector、steam_vent、bollards_barrier → blender/out/street_props.glb
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *

reset()

M = {
    'steel_dark': mat('steel_dark', '#161b26', rough=0.38, metal=0.75),
    'steel_mid': mat('steel_mid', '#252e40', rough=0.32, metal=0.8),
    'concrete': mat('concrete', '#20242c', rough=0.82, metal=0.08),
    'hazard_yellow': mat('hazard_yellow', '#f5b800', rough=0.45, metal=0.2),
    'neon_cyan': mat('prop_neon_cyan', '#00f2ff', rough=0.1, emit='#00e5ff', emit_strength=4.2),
    'neon_magenta': mat('prop_neon_mag', '#ff2bd6', rough=0.1, emit='#ff1ec8', emit_strength=4.2),
    'neon_amber': mat('prop_neon_amber', '#ffaa00', rough=0.1, emit='#ff9500', emit_strength=4.0),
    'neon_green': mat('prop_neon_green', '#00ff88', rough=0.1, emit='#00f078', emit_strength=3.8),
    'panel_screen': mat('panel_screen', '#0a1929', rough=0.15, metal=0.3, emit='#0e385c', emit_strength=1.5),
}


# 1. 雙懸臂電馭路燈 street_lamp（高 6.6 m）
def build_street_lamp():
    mb = MB()
    # 八角重型底座與配電箱
    mb.cyl_z(0, 0, 0.0, 0.55, 0.22, 8, M['steel_dark'])
    mb.chamfer_box(0, -0.18, 1.35, 0.16, 0.12, 0.35, 0.03, M['steel_mid'])
    mb.box(-0.10, 0.10, -0.31, -0.29, 1.32, 1.48, M['neon_amber'])
    # 主燈柱与高空橫臂
    mb.cyl_z(0, 0, 0.55, 6.20, 0.095, 10, M['steel_dark'])
    mb.box(-0.07, 0.07, -1.85, 0.45, 6.08, 6.24, M['steel_mid'])
    # 斜撐桿與雙發光燈頭（朝向路面 -Y）
    mb.box(-0.04, 0.04, -1.10, 0.0, 5.45, 6.10, M['steel_dark'])
    mb.chamfer_box(0, -1.55, 6.04, 0.28, 0.42, 0.07, 0.04, M['steel_mid'])
    mb.box(-0.24, 0.24, -1.92, -1.18, 5.94, 5.98, M['neon_cyan'])
    # 副側行人投光燈（琥珀光）
    mb.box(-0.14, 0.14, 0.18, 0.52, 4.35, 4.44, M['steel_mid'])
    mb.box(-0.12, 0.12, 0.22, 0.50, 4.31, 4.35, M['neon_amber'])
    return mb.build('street_lamp', origin=(0, 0, 0))


# 2. 直立懸掛式霓虹漢字招牌架 neon_sign_kanji
def build_neon_sign():
    mb = MB()
    # 外框鐵架與牆面固定桁架
    mb.chamfer_box(0, 0, 2.20, 0.68, 0.12, 2.10, 0.06, M['steel_dark'])
    for z in (0.65, 2.20, 3.75):
        mb.box(-0.95, -0.66, -0.06, 0.06, z - 0.05, z + 0.05, M['steel_mid'])
    # 雙面發光邊框與幾何霓虹字劃（「夜」「電」「脈」）
    for sy in (-0.135, 0.135):
        y0, y1 = (sy - 0.02, sy + 0.02)
        mb.box(-0.62, 0.62, y0, y1, 4.18, 4.25, M['neon_magenta'])
        mb.box(-0.62, 0.62, y0, y1, 0.15, 0.22, M['neon_magenta'])
        mb.box(-0.62, -0.55, y0, y1, 0.15, 4.25, M['neon_cyan'])
        mb.box(0.55, 0.62, y0, y1, 0.15, 4.25, M['neon_cyan'])
        # 上字：幾何「夜」
        mb.box(-0.42, 0.42, y0, y1, 3.68, 3.76, M['neon_cyan'])
        mb.box(-0.05, 0.05, y0, y1, 3.72, 3.92, M['neon_cyan'])
        mb.box(-0.36, -0.18, y0, y1, 2.95, 3.62, M['neon_magenta'])
        mb.box(0.02, 0.38, y0, y1, 3.42, 3.50, M['neon_magenta'])
        mb.box(0.08, 0.32, y0, y1, 2.95, 3.45, M['neon_amber'])
        # 中字：幾何「電」
        mb.box(-0.40, 0.40, y0, y1, 2.48, 2.55, M['neon_amber'])
        mb.box(-0.36, 0.36, y0, y1, 1.92, 2.38, M['neon_cyan'])
        mb.box(-0.04, 0.04, y0, y1, 1.62, 2.52, M['neon_magenta'])
        mb.box(-0.04, 0.42, y0, y1, 1.58, 1.66, M['neon_magenta'])
        # 下字：幾何「城」
        mb.box(-0.42, -0.12, y0, y1, 0.95, 1.03, M['neon_green'])
        mb.box(-0.30, -0.22, y0, y1, 0.48, 1.32, M['neon_green'])
        mb.box(-0.02, 0.40, y0, y1, 1.12, 1.20, M['neon_magenta'])
        mb.box(0.08, 0.16, y0, y1, 0.45, 1.35, M['neon_cyan'])
    o = mb.build('neon_sign_kanji', origin=(0, 0, 0))
    o.location = Vector((3.0, 0, 0))
    return o


# 3. 街角全息自動販賣機 vending_machine
def build_vending_machine():
    mb = MB()
    mb.chamfer_box(0, 0, 1.10, 0.58, 0.44, 1.10, 0.05, M['steel_dark'])
    # 頂部霓虹燈箱
    mb.box(-0.54, 0.54, -0.46, -0.42, 1.88, 2.12, M['neon_magenta'])
    # 三排發光飲品展示窗
    mb.box(-0.48, 0.22, -0.45, -0.42, 0.72, 1.78, M['panel_screen'])
    for r, m_col in enumerate((M['neon_cyan'], M['neon_magenta'], M['neon_amber'], M['neon_green'])):
        z0 = 0.80 + r * 0.24
        for c in range(4):
            x0 = -0.42 + c * 0.15
            mb.box(x0, x0 + 0.09, -0.465, -0.44, z0, z0 + 0.16, m_col)
    # 右側觸控螢幕與下方取物口
    mb.box(0.28, 0.48, -0.46, -0.43, 1.15, 1.68, M['neon_cyan'])
    mb.box(-0.42, 0.18, -0.46, -0.38, 0.24, 0.52, M['steel_mid'])
    o = mb.build('vending_machine', origin=(0, 0, 0))
    o.location = Vector((6.0, 0, 0))
    return o


# 4. 全息廣告投影基座 holo_projector
def build_holo_projector():
    mb = MB()
    mb.cyl_z(0, 0, 0.0, 0.45, 0.65, 12, M['steel_dark'])
    mb.cyl_z(0, 0, 0.45, 0.72, 0.46, 12, M['steel_mid'])
    mb.cyl_z(0, 0, 0.72, 0.82, 0.36, 16, M['neon_cyan'])
    # 懸浮雙層能量環
    mb.cyl_z(0, 0, 1.35, 1.43, 0.58, 16, M['neon_magenta'], cap0=False, cap1=False)
    mb.cyl_z(0, 0, 2.10, 2.18, 0.48, 16, M['neon_cyan'], cap0=False, cap1=False)
    o = mb.build('holo_projector', origin=(0, 0, 0))
    o.location = Vector((9.0, 0, 0))
    return o


# 5. 地下蒸氣排氣井與防撞柱 steam_vent & bollards_barrier
def build_steam_vent():
    mb = MB()
    mb.chamfer_box(0, 0, 0.08, 0.75, 0.55, 0.08, 0.06, M['steel_dark'])
    for i in range(6):
        y = -0.40 + i * 0.16
        mb.box(-0.62, 0.62, y - 0.03, y + 0.03, 0.15, 0.18, M['steel_mid'])
    mb.box(-0.55, 0.55, -0.38, 0.38, 0.12, 0.145, M['neon_amber'])
    o = mb.build('steam_vent', origin=(0, 0, 0))
    o.location = Vector((12.0, 0, 0))
    return o


def build_bollards():
    mb = MB()
    for sx in (-0.65, 0.0, 0.65):
        mb.cyl_z(sx, 0, 0.0, 0.88, 0.11, 10, M['steel_dark'])
        mb.cyl_z(sx, 0, 0.68, 0.80, 0.118, 10, M['neon_amber'])
        mb.cyl_z(sx, 0, 0.0, 0.16, 0.14, 10, M['hazard_yellow'])
    o = mb.build('bollards_barrier', origin=(0, 0, 0))
    o.location = Vector((15.0, 0, 0))
    return o


build_street_lamp()
build_neon_sign()
build_vending_machine()
build_holo_projector()
build_steam_vent()
build_bollards()
export_glb('street_props.glb')
