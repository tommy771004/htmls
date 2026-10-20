# Groundline（267）Blender 低多邊形機場停機坪資產生成腳本
# 執行：/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P games/267-groundline/blender/build_apron.py
# 輸出：games/267-groundline/blender/out/groundline.glb
# 慣例：1 單位 = 1 公尺；Blender Z 朝上，車輛與飛機面向 +Y（匯出 glTF +Y up 後為面向 -Z 或由 Three.js 統一轉向）。

import bpy
import bmesh
import math
import os
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.path.join(HERE, 'out')


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = 'METRIC'
    return scene


def hex_to_linear(h):
    h = h.lstrip('#')
    srgb = [int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4)]
    return tuple((c / 12.92) if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in srgb)


_MATS = {}


def mat(name, color_hex, rough=0.55, metal=0.08, emit_hex=None, emit_strength=1.5):
    if name in _MATS and _MATS[name].name in bpy.data.materials:
        return _MATS[name]
    m = bpy.data.materials.new(name)
    bsdf = m.node_tree.nodes.get('Principled BSDF') if m.node_tree else None
    if bsdf:
        bsdf.inputs['Base Color'].default_value = (*hex_to_linear(color_hex), 1.0)
        bsdf.inputs['Roughness'].default_value = rough
        bsdf.inputs['Metallic'].default_value = metal
        if emit_hex:
            bsdf.inputs['Emission Color'].default_value = (*hex_to_linear(emit_hex), 1.0)
            bsdf.inputs['Emission Strength'].default_value = emit_strength
    m.diffuse_color = (*hex_to_linear(color_hex), 1.0)
    _MATS[name] = m
    return m


class MeshBuilder:
    """低多邊形多材質網格建構器（直接組頂點、面與材質索引）。"""

    def __init__(self):
        self.v = []
        self.f = []
        self.fm = []
        self.mats = []

    def _mi(self, m):
        if m not in self.mats:
            self.mats.append(m)
        return self.mats.index(m)

    def add(self, verts, faces, material):
        base = len(self.v)
        self.v.extend(Vector(p) for p in verts)
        mats = material if isinstance(material, list) else [material] * len(faces)
        for fc, m in zip(faces, mats):
            self.f.append([base + i for i in fc])
            self.fm.append(self._mi(m))
        return base

    def prism_z(self, outline_xy, z0, z1, m, side_m=None, cap0=True, cap1=True):
        n = len(outline_xy)
        verts = [(x, y, z0) for x, y in outline_xy] + [(x, y, z1) for x, y in outline_xy]
        faces, mats = [], []
        for i in range(n):
            j = (i + 1) % n
            faces.append((i, j, n + j, n + i))
            mats.append(side_m or m)
        if cap0:
            faces.append(tuple(reversed(range(n))))
            mats.append(m)
        if cap1:
            faces.append(tuple(range(n, 2 * n)))
            mats.append(m)
        return self.add(verts, faces, mats)

    def box(self, x0, x1, y0, y1, z0, z1, m, side_m=None):
        return self.prism_z([(x0, y0), (x1, y0), (x1, y1), (x0, y1)], z0, z1, m, side_m=side_m)

    def chamfer_box(self, cx, cy, cz, hx, hy, hz, ch, m, top_m=None, side_m=None):
        c = min(ch, hx * 0.45, hy * 0.45)
        pts = [
            (cx - hx + c, cy - hy), (cx + hx - c, cy - hy),
            (cx + hx, cy - hy + c), (cx + hx, cy + hy - c),
            (cx + hx - c, cy + hy), (cx - hx + c, cy + hy),
            (cx - hx, cy + hy - c), (cx - hx, cy - hy + c),
        ]
        n = len(pts)
        z0, z1 = cz - hz, cz + hz
        verts = [(x, y, z0) for x, y in pts] + [(x, y, z1) for x, y in pts]
        faces, mats = [], []
        for i in range(n):
            j = (i + 1) % n
            faces.append((i, j, n + j, n + i))
            mats.append(side_m or m)
        faces.append(tuple(reversed(range(n))))
        mats.append(m)
        faces.append(tuple(range(n, 2 * n)))
        mats.append(top_m or m)
        return self.add(verts, faces, mats)

    def cyl_z(self, cx, cy, z0, z1, r, segs, m, side_m=None, cap0=True, cap1=True, rot=0.0):
        pts = [
            (cx + r * math.cos(rot + 2 * math.pi * i / segs),
             cy + r * math.sin(rot + 2 * math.pi * i / segs))
            for i in range(segs)
        ]
        return self.prism_z(pts, z0, z1, m, side_m=side_m, cap0=cap0, cap1=cap1)

    def cyl_x(self, x0, x1, cy, cz, r, segs, m, side_m=None, cap0=True, cap1=True):
        ring = [
            (cy + r * math.cos(2 * math.pi * i / segs),
             cz + r * math.sin(2 * math.pi * i / segs))
            for i in range(segs)
        ]
        verts = [(x0, y, z) for y, z in ring] + [(x1, y, z) for y, z in ring]
        faces, mats = [], []
        for i in range(segs):
            j = (i + 1) % segs
            faces.append((i, segs + i, segs + j, j))
            mats.append(side_m or m)
        if cap0:
            faces.append(tuple(range(segs)))
            mats.append(m)
        if cap1:
            faces.append(tuple(reversed(range(segs, 2 * segs))))
            mats.append(m)
        return self.add(verts, faces, mats)

    def cyl_y(self, cx, y0, y1, cz, r, segs, m, side_m=None, cap0=True, cap1=True, scale_x=1.0):
        ring = [
            (cx + r * scale_x * math.cos(2 * math.pi * i / segs),
             cz + r * math.sin(2 * math.pi * i / segs))
            for i in range(segs)
        ]
        verts = [(x, y0, z) for x, z in ring] + [(x, y1, z) for x, z in ring]
        faces, mats = [], []
        for i in range(segs):
            j = (i + 1) % segs
            faces.append((i, segs + i, segs + j, j))
            mats.append(side_m or m)
        if cap0:
            faces.append(tuple(range(segs)))
            mats.append(m)
        if cap1:
            faces.append(tuple(reversed(range(segs, 2 * segs))))
            mats.append(m)
        return self.add(verts, faces, mats)

    def loft_y(self, sections, m, cap0=True, cap1=True, face_mats=None):
        """sections: [(y, [(x, z), ...]), ...]"""
        n = len(sections[0][1])
        verts = []
        for y, prof in sections:
            for x, z in prof:
                verts.append((x, y, z))
        faces, mats = [], []
        for k in range(len(sections) - 1):
            for i in range(n):
                j = (i + 1) % n
                faces.append((k * n + i, (k + 1) * n + i, (k + 1) * n + j, k * n + j))
                mats.append(face_mats.get((k, i), m) if face_mats else m)
        if cap0:
            faces.append(tuple(range(n)))
            mats.append(m)
        if cap1:
            last = (len(sections) - 1) * n
            faces.append(tuple(reversed(range(last, last + n))))
            mats.append(m)
        return self.add(verts, faces, mats)

    def build(self, name, location=(0, 0, 0)):
        me = bpy.data.meshes.new(name)
        me.from_pydata(self.v, [], self.f)
        for m in self.mats:
            me.materials.append(m)
        for poly, mi in zip(me.polygons, self.fm):
            poly.material_index = mi
            poly.use_smooth = False
        bm = bmesh.new()
        bm.from_mesh(me)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        bm.to_mesh(me)
        bm.free()
        me.update()
        obj = bpy.data.objects.new(name, me)
        obj.location = Vector(location)
        bpy.context.scene.collection.objects.link(obj)
        return obj


def palette():
    return {
        'stone': mat('StoneWarm', '#ece7df', rough=0.65, metal=0.05),
        'stone_dark': mat('StoneDark', '#d2cbc0', rough=0.7, metal=0.05),
        'steel_light': mat('SteelLight', '#f4f2ed', rough=0.4, metal=0.25),
        'steel_mid': mat('SteelMid', '#8b96a3', rough=0.45, metal=0.35),
        'steel_dark': mat('SteelDark', '#3c4552', rough=0.5, metal=0.35),
        'glass_roof': mat('GlassRoof', '#8ab8ce', rough=0.22, metal=0.15),
        'glass_wall': mat('GlassWall', '#618ea6', rough=0.2, metal=0.2),
        'glass_cockpit': mat('GlassCockpit', '#273442', rough=0.18, metal=0.25),
        'fuselage': mat('FuselageWhite', '#f7f5f0', rough=0.35, metal=0.12),
        'wing_gray': mat('WingGray', '#dfe3e8', rough=0.42, metal=0.18),
        'livery_teal': mat('LiveryTeal', '#2d8a8a', rough=0.38, metal=0.12),
        'livery_coral': mat('LiveryCoral', '#e0634e', rough=0.38, metal=0.12),
        'livery_cobalt': mat('LiveryCobalt', '#2f65b0', rough=0.38, metal=0.12),
        'livery_gold': mat('LiveryGold', '#e8a838', rough=0.4, metal=0.15),
        'tire': mat('TireDark', '#25292e', rough=0.8, metal=0.05),
        'yellow_safety': mat('SafetyYellow', '#f0be3c', rough=0.45, metal=0.1),
        'orange_fuel': mat('FuelOrange', '#e6783a', rough=0.42, metal=0.12),
        'mint_cater': mat('CaterMint', '#48a694', rough=0.42, metal=0.1),
        'tank_white': mat('TankWhite', '#f0eee9', rough=0.45, metal=0.15),
        'tank_band': mat('TankBand', '#7ba7be', rough=0.42, metal=0.15),
        'bag_blue': mat('BagBlue', '#4c86c6', rough=0.55, metal=0.05),
        'bag_coral': mat('BagCoral', '#de6b58', rough=0.55, metal=0.05),
        'bag_sage': mat('BagSage', '#68a882', rough=0.55, metal=0.05),
        'beacon': mat('BeaconAmber', '#ffaa2b', rough=0.25, metal=0.1, emit_hex='#ffaa2b', emit_strength=2.2),
        'win_warm': mat('WinWarm', '#ffe3a8', rough=0.3, metal=0.05, emit_hex='#ffd98e', emit_strength=1.2),
    }


def build_terminal(P):
    """低多邊形、柔和配色的航廈（含 5 跨弧形玻璃屋頂、五座登機門候機室與塔台）。"""
    mb = MeshBuilder()
    # 主航廈基座與玻璃帷幕 (-62..+62, y: -12..+12, z: 0..7.5)
    mb.chamfer_box(0, 0, 0.4, 63.0, 12.5, 0.4, 1.5, P['stone_dark'])
    mb.chamfer_box(0, 0, 4.0, 61.0, 10.8, 3.2, 1.2, P['stone'], side_m=P['glass_wall'])
    # 上下邊樑與遮陽挑簷
    mb.chamfer_box(0, 0, 7.3, 62.2, 11.8, 0.35, 1.2, P['steel_light'])
    mb.chamfer_box(0, 0, 3.8, 61.4, 11.1, 0.18, 1.0, P['stone'])

    # 5 座登機門突出候機室 (G1..G5 at x = -48, -24, 0, 24, 48)
    gate_xs = [-48.0, -24.0, 0.0, 24.0, 48.0]
    for gx in gate_xs:
        mb.chamfer_box(gx, -12.2, 3.5, 5.2, 2.8, 3.1, 0.6, P['stone'], side_m=P['glass_wall'])
        mb.chamfer_box(gx, -12.2, 6.8, 5.6, 3.1, 0.25, 0.6, P['steel_light'])
        # 候機室暖光條
        mb.box(gx - 3.6, gx + 3.6, -15.05, -14.85, 5.4, 5.9, P['win_warm'])

    # 結構立柱（南側面向停機坪）
    for ix in range(-60, 61, 12):
        mb.cyl_z(ix, -11.0, 0.8, 7.2, 0.38, 8, P['steel_light'])
        mb.cyl_z(ix, 11.0, 0.8, 7.2, 0.38, 8, P['steel_light'])

    # 弧形玻璃屋頂（5 座大跨度波浪拱頂 + 白色鋼拱肋）
    segs_x = 40
    segs_y = 10
    x_min, x_max = -62.0, 62.0
    y_min, y_max = -12.2, 12.2
    for ix in range(segs_x):
        x0 = x_min + (x_max - x_min) * (ix / segs_x)
        x1 = x_min + (x_max - x_min) * ((ix + 1) / segs_x)
        xm = 0.5 * (x0 + x1)
        # 5 個波拱起伏
        wave0 = 1.35 * math.cos((x0 / 24.0) * math.pi * 2.0) + 1.35
        wave1 = 1.35 * math.cos((x1 / 24.0) * math.pi * 2.0) + 1.35
        is_rib = (ix % 4 == 0)
        roof_mat = P['steel_light'] if is_rib else P['glass_roof']
        for iy in range(segs_y):
            u0 = iy / segs_y
            u1 = (iy + 1) / segs_y
            y0 = y_min + (y_max - y_min) * u0
            y1 = y_min + (y_max - y_min) * u1
            # 橫斷面拋物線拱形
            arch0 = math.sin(u0 * math.pi) * 3.4
            arch1 = math.sin(u1 * math.pi) * 3.4
            z00 = 7.4 + arch0 + wave0 * 0.45 * math.sin(u0 * math.pi)
            z10 = 7.4 + arch0 + wave1 * 0.45 * math.sin(u0 * math.pi)
            z11 = 7.4 + arch1 + wave1 * 0.45 * math.sin(u1 * math.pi)
            z01 = 7.4 + arch1 + wave0 * 0.45 * math.sin(u1 * math.pi)
            thick = 0.32 if is_rib else 0.18
            verts = [
                (x0, y0, z00), (x1, y0, z10), (x1, y1, z11), (x0, y1, z01),
                (x0, y0, z00 + thick), (x1, y0, z10 + thick), (x1, y1, z11 + thick), (x0, y1, z01 + thick),
            ]
            faces = [
                (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7),
                (3, 2, 1, 0), (4, 5, 6, 7),
            ]
            mb.add(verts, faces, roof_mat)

    # 西側航管塔台 (Control Tower at x = -54, y = 4)
    tx, ty = -54.0, 4.0
    mb.cyl_z(tx, ty, 7.5, 19.5, 2.3, 8, P['stone'])
    mb.cyl_z(tx, ty, 19.5, 20.4, 3.4, 8, P['steel_light'])
    mb.cyl_z(tx, ty, 20.4, 23.2, 3.1, 8, P['steel_light'], side_m=P['glass_wall'])
    mb.cyl_z(tx, ty, 23.2, 24.0, 3.6, 8, P['steel_light'])
    mb.cyl_z(tx, ty, 24.0, 27.5, 0.18, 6, P['steel_mid'])
    mb.cyl_z(tx, ty, 27.5, 28.1, 0.42, 8, P['beacon'])

    return mb.build('Terminal', location=(0, 0, 0))


def build_jetbridges(P):
    """5 座空橋（Jetbridge_1..5）與可獨立旋轉伸縮的單座空橋模組（JetbridgeUnit）。"""
    objs = []
    gate_xs = [-48.0, -24.0, 0.0, 24.0, 48.0]

    def make_bridge_mesh(name, loc):
        mb = MeshBuilder()
        # 固定圓形轉盤塔座 (Rotunda at origin 0,0)
        mb.cyl_z(0, 0, 0.0, 4.2, 1.35, 10, P['stone_dark'])
        mb.cyl_z(0, 0, 4.2, 6.2, 1.65, 10, P['steel_light'], side_m=P['glass_wall'])
        mb.cyl_z(0, 0, 6.2, 6.6, 1.75, 10, P['steel_light'])
        # 伸縮走廊（沿 -Y 方向伸向停機坪飛機 L1 艙門，長約 11m）
        mb.box(-0.95, 0.95, -10.8, -1.2, 4.3, 6.0, P['steel_light'], side_m=P['glass_wall'])
        # 空橋外框波紋肋條
        for ry in [-2.8, -4.8, -6.8, -8.8, -10.4]:
            mb.box(-1.05, 1.05, ry - 0.18, ry + 0.18, 4.2, 6.15, P['steel_mid'])
        # 底部行走輪柱 (Bogie)
        mb.cyl_z(0, -9.2, 0.45, 4.3, 0.22, 8, P['steel_mid'])
        mb.box(-1.1, 1.1, -9.5, -8.9, 0.35, 0.65, P['steel_dark'])
        mb.cyl_x(-1.25, -0.85, -9.2, 0.42, 0.42, 10, P['tire'])
        mb.cyl_x(0.85, 1.25, -9.2, 0.42, 0.42, 10, P['tire'])
        # 前端風琴式艙門遮罩 (Docking Cab)
        mb.box(-1.1, 1.1, -12.1, -10.8, 4.15, 6.05, P['steel_dark'])
        mb.box(-1.15, 1.15, -12.35, -12.05, 4.1, 6.1, P['yellow_safety'])
        return mb.build(name, location=loc)

    # 匯出 5 座對應登機門的空橋 + 固定轉盤座與可擺動伸縮臂
    for idx, gx in enumerate(gate_xs):
        objs.append(make_bridge_mesh(f'Jetbridge_{idx + 1}', (gx, -15.0, 0.0)))
    objs.append(make_bridge_mesh('JetbridgeUnit', (0.0, 0.0, 0.0)))

    mb_rot = MeshBuilder()
    mb_rot.cyl_z(0, 0, 0.0, 4.2, 1.38, 10, P['stone_dark'])
    mb_rot.cyl_z(0, 0, 4.2, 6.2, 1.68, 10, P['steel_light'], side_m=P['glass_wall'])
    mb_rot.cyl_z(0, 0, 6.2, 6.65, 1.78, 10, P['steel_light'])
    objs.append(mb_rot.build('JetbridgeRotunda', (0.0, 0.0, 0.0)))

    mb_arm = MeshBuilder()
    mb_arm.box(-0.95, 0.95, -10.8, -1.0, 4.3, 6.0, P['steel_light'], side_m=P['glass_wall'])
    for ry in [-2.6, -4.6, -6.6, -8.6, -10.3]:
        mb_arm.box(-1.05, 1.05, ry - 0.18, ry + 0.18, 4.2, 6.15, P['steel_mid'])
    mb_arm.cyl_z(0, -9.2, 0.45, 4.3, 0.22, 8, P['steel_mid'])
    mb_arm.box(-1.1, 1.1, -9.5, -8.9, 0.35, 0.65, P['steel_dark'])
    mb_arm.cyl_x(-1.25, -0.85, -9.2, 0.42, 0.42, 10, P['tire'])
    mb_arm.cyl_x(0.85, 1.25, -9.2, 0.42, 0.42, 10, P['tire'])
    mb_arm.box(-1.1, 1.1, -12.1, -10.8, 4.15, 6.05, P['steel_dark'])
    mb_arm.box(-1.15, 1.15, -12.35, -12.05, 4.1, 6.1, P['yellow_safety'])
    objs.append(mb_arm.build('JetbridgeArm', (0.0, 0.0, 0.0)))
    return objs


def build_aircraft_a320(P, name='Aircraft_A320', tail_mat_key='livery_teal', stripe_mat_key='livery_coral'):
    """低多邊形 A320 客機（機頭朝 +Y，機翼沿 X 軸展開，原點在地面中心）。"""
    mb = MeshBuilder()
    fus = P['fuselage']
    tail_m = P[tail_mat_key]
    stripe_m = P[stripe_mat_key]
    wing_m = P['wing_gray']

    # 機身放樣斷面 (y from -13.5 tail to +13.5 nose, center z = 2.65)
    def ring(rx, rz, cz, n=12):
        return [
            (rx * math.cos(2 * math.pi * i / n), cz + rz * math.sin(2 * math.pi * i / n))
            for i in range(n)
        ]

    sections = [
        (-13.8, ring(0.22, 0.25, 3.05)),
        (-11.5, ring(0.95, 1.05, 2.90)),
        (-8.0, ring(1.68, 1.78, 2.72)),
        (-2.0, ring(1.75, 1.82, 2.70)),
        (5.5, ring(1.75, 1.82, 2.70)),
        (9.5, ring(1.55, 1.62, 2.62)),
        (11.8, ring(1.02, 1.05, 2.42)),
        (13.2, ring(0.32, 0.32, 2.22)),
    ]
    face_mats = {}
    # 駕駛艙擋風玻璃面
    for i in [2, 3]:
        face_mats[(5, i)] = P['glass_cockpit']
    # 機身腰線塗裝
    for k in range(1, 6):
        for i in [0, 5, 6, 11]:
            face_mats[(k, i)] = stripe_m
    mb.loft_y(sections, fus, face_mats=face_mats)

    # 主翼（後掠低多邊形機翼 + 翼尖小翼 Sharklets）
    for side in (-1, 1):
        s = float(side)
        w_verts = [
            (s * 1.6, 1.8, 2.15), (s * 1.6, -2.4, 2.05),
            (s * 13.8, -4.6, 2.55), (s * 13.8, -2.5, 2.62),
            (s * 1.6, 1.8, 2.48), (s * 1.6, -2.4, 2.32),
            (s * 13.8, -4.6, 2.75), (s * 13.8, -2.5, 2.82),
        ]
        if side == 1:
            w_faces = [(0, 1, 2, 3), (7, 6, 5, 4), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)]
        else:
            w_faces = [(3, 2, 1, 0), (4, 5, 6, 7), (1, 5, 4, 0), (2, 6, 5, 1), (3, 7, 6, 2), (0, 4, 7, 3)]
        mb.add(w_verts, w_faces, wing_m)

        # 翼尖小翼 (Sharklet)
        sl_verts = [
            (s * 13.5, -2.6, 2.7), (s * 13.5, -4.6, 2.65),
            (s * 14.3, -4.9, 4.15), (s * 14.3, -3.7, 4.18),
            (s * 13.7, -2.6, 2.7), (s * 13.7, -4.6, 2.65),
            (s * 14.48, -4.9, 4.15), (s * 14.48, -3.7, 4.18),
        ]
        mb.add(sl_verts, w_faces, tail_m)

        # 翼下雙渦扇發動機 (Engine Nacelle at x = ±4.9)
        ex = s * 4.9
        mb.cyl_y(ex, -0.8, 2.3, 1.45, 0.88, 10, fus, side_m=fus)
        mb.cyl_y(ex, 2.15, 2.38, 1.45, 0.72, 10, P['steel_dark'])
        mb.cyl_y(ex, -1.45, -0.8, 1.45, 0.58, 10, P['steel_mid'])
        # 發動機派龍架
        mb.box(min(ex - 0.18, ex + 0.18), max(ex - 0.18, ex + 0.18), -0.6, 1.6, 1.95, 2.35, wing_m)

    # 垂直尾翼 (Vertical Stabilizer)
    v_verts = [
        (-0.22, -7.8, 3.8), (-0.22, -13.2, 3.4), (-0.14, -14.2, 8.2), (-0.14, -11.4, 8.25),
        (0.22, -7.8, 3.8), (0.22, -13.2, 3.4), (0.14, -14.2, 8.2), (0.14, -11.4, 8.25),
    ]
    v_faces = [(0, 1, 2, 3), (7, 6, 5, 4), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)]
    mb.add(v_verts, v_faces, tail_m)

    # 水平尾翼 (Horizontal Stabilizers)
    for side in (-1, 1):
        s = float(side)
        h_verts = [
            (s * 0.4, -10.2, 3.35), (s * 0.4, -13.1, 3.28),
            (s * 4.8, -13.9, 3.55), (s * 4.8, -12.2, 3.58),
            (s * 0.4, -10.2, 3.55), (s * 0.4, -13.1, 3.48),
            (s * 4.8, -13.9, 3.72), (s * 4.8, -12.2, 3.75),
        ]
        if side == 1:
            h_faces = [(0, 1, 2, 3), (7, 6, 5, 4), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)]
        else:
            h_faces = [(3, 2, 1, 0), (4, 5, 6, 7), (1, 5, 4, 0), (2, 6, 5, 1), (3, 7, 6, 2), (0, 4, 7, 3)]
        mb.add(h_verts, h_faces, wing_m)

    # 起落架（前輪 + 左右主輪）
    mb.cyl_z(0, 9.8, 0.42, 1.75, 0.14, 8, P['steel_mid'])
    mb.cyl_x(-0.32, 0.32, 9.8, 0.42, 0.42, 10, P['tire'])
    for side in (-1, 1):
        gx = side * 2.65
        mb.cyl_z(gx, -1.2, 0.52, 2.05, 0.18, 8, P['steel_mid'])
        mb.cyl_x(gx - 0.45, gx + 0.45, -1.2, 0.52, 0.52, 10, P['tire'])

    return mb.build(name, location=(0, 0, 0))


def build_fuel_truck(P):
    """低多邊形加油車（FuelTruck，面向 +Y）。"""
    mb = MeshBuilder()
    # 底盤
    mb.box(-1.15, 1.15, -3.6, 3.4, 0.45, 0.85, P['steel_dark'])
    # 車頭駕駛室
    mb.chamfer_box(0, 2.35, 1.55, 1.12, 0.95, 0.78, 0.18, P['tank_white'], top_m=P['orange_fuel'])
    mb.box(-0.98, 0.98, 2.85, 3.35, 1.45, 2.08, P['glass_cockpit'])
    mb.cyl_z(0, 2.35, 2.33, 2.55, 0.18, 8, P['beacon'])
    # 橢圓油罐車體
    mb.cyl_y(0, -3.3, 1.15, 1.75, 0.95, 12, P['steel_light'], side_m=P['tank_white'], scale_x=1.18)
    # 橘色安全識別帶
    mb.cyl_y(0, -1.8, -0.3, 1.75, 0.98, 12, P['orange_fuel'], scale_x=1.18)
    # 頂部檢修步道與後方泵浦箱
    mb.box(-0.38, 0.38, -3.1, 0.9, 2.68, 2.82, P['steel_mid'])
    mb.chamfer_box(0, -3.35, 1.35, 0.95, 0.35, 0.55, 0.1, P['orange_fuel'])
    # 車輪
    for wy in [-2.5, -1.2, 2.2]:
        mb.cyl_x(-1.28, -0.92, wy, 0.48, 0.48, 10, P['tire'])
        mb.cyl_x(0.92, 1.28, wy, 0.48, 0.48, 10, P['tire'])
    return mb.build('FuelTruck', location=(0, 0, 0))


def build_baggage_tug(P):
    """低多邊形行李拖車與兩節行李拖斗（BaggageTug，面向 +Y）。"""
    mb = MeshBuilder()
    # 拖車頭 (y: 1.2 .. 3.6)
    mb.chamfer_box(0, 2.4, 0.75, 0.88, 1.15, 0.42, 0.16, P['yellow_safety'])
    mb.chamfer_box(0, 3.0, 1.18, 0.78, 0.52, 0.32, 0.12, P['yellow_safety'])
    # 頂棚與警示燈
    for px, py in [(-0.72, 1.45), (0.72, 1.45), (-0.72, 2.55), (0.72, 2.55)]:
        mb.cyl_z(px, py, 1.15, 2.05, 0.06, 6, P['steel_dark'])
    mb.box(-0.82, 0.82, 1.35, 2.65, 2.02, 2.15, P['tank_white'])
    mb.cyl_z(0, 2.0, 2.15, 2.32, 0.14, 8, P['beacon'])
    for wy in [1.65, 3.1]:
        mb.cyl_x(-0.98, -0.72, wy, 0.36, 0.36, 10, P['tire'])
        mb.cyl_x(0.72, 0.98, wy, 0.36, 0.36, 10, P['tire'])

    # 兩節行李拖斗 (Cart 1 at y = -0.6, Cart 2 at y = -3.4)
    for cy, bag_mats in [(-0.6, [P['bag_blue'], P['bag_coral'], P['bag_sage']]),
                         (-3.4, [P['bag_coral'], P['bag_sage'], P['bag_blue']])]:
        # 連結桿
        mb.box(-0.1, 0.1, cy + 1.0, cy + 1.8, 0.42, 0.52, P['steel_dark'])
        # 拖斗底板與前後護欄
        mb.box(-0.85, 0.85, cy - 1.05, cy + 1.05, 0.38, 0.55, P['steel_mid'])
        mb.box(-0.85, 0.85, cy + 0.92, cy + 1.05, 0.55, 1.35, P['yellow_safety'])
        mb.box(-0.85, 0.85, cy - 1.05, cy - 0.92, 0.55, 1.35, P['yellow_safety'])
        # 彩色低多邊形行李箱
        mb.chamfer_box(-0.32, cy - 0.35, 0.85, 0.38, 0.45, 0.32, 0.06, bag_mats[0])
        mb.chamfer_box(0.34, cy - 0.25, 0.82, 0.36, 0.48, 0.28, 0.06, bag_mats[1])
        mb.chamfer_box(0.0, cy + 0.42, 0.88, 0.52, 0.35, 0.34, 0.06, bag_mats[2])
        mb.chamfer_box(-0.12, cy - 0.1, 1.35, 0.36, 0.38, 0.22, 0.05, P['orange_fuel'])
        for wy in [cy - 0.68, cy + 0.68]:
            mb.cyl_x(-0.95, -0.75, wy, 0.28, 0.28, 8, P['tire'])
            mb.cyl_x(0.75, 0.95, wy, 0.28, 0.28, 8, P['tire'])

    return mb.build('BaggageTug', location=(0, 0, 0))


def build_catering_truck(P):
    """低多邊形剪刀式升降餐車（CateringTruck，面向 +Y）。"""
    mb = MeshBuilder()
    # 底盤
    mb.box(-1.1, 1.1, -3.2, 3.1, 0.45, 0.82, P['steel_dark'])
    # 低頂駕駛室
    mb.chamfer_box(0, 2.25, 1.35, 1.08, 0.85, 0.58, 0.15, P['tank_white'], top_m=P['mint_cater'])
    mb.box(-0.95, 0.95, 2.7, 3.12, 1.25, 1.78, P['glass_cockpit'])
    # 剪刀升降架
    mb.box(-0.75, 0.75, -2.4, 0.8, 0.82, 1.35, P['yellow_safety'])
    # 冷藏餐廂 (Box Body)
    mb.chamfer_box(0, -0.85, 2.25, 1.15, 2.25, 0.95, 0.12, P['tank_white'], side_m=P['tank_white'])
    mb.box(-1.18, 1.18, -3.05, 1.35, 2.05, 2.45, P['mint_cater'])
    # 前伸對接平台 (High-loader bridge)
    mb.box(-0.88, 0.88, 1.35, 2.85, 2.15, 2.38, P['steel_light'])
    mb.box(-0.92, 0.92, 1.4, 2.82, 2.38, 2.68, P['yellow_safety'])
    mb.cyl_z(0, 1.1, 3.2, 3.4, 0.16, 8, P['beacon'])
    for wy in [-2.1, 2.15]:
        mb.cyl_x(-1.22, -0.88, wy, 0.46, 0.46, 10, P['tire'])
        mb.cyl_x(0.88, 1.22, wy, 0.46, 0.46, 10, P['tire'])
    return mb.build('CateringTruck', location=(0, 0, 0))


def build_cleaning_van(P):
    """低多邊形客艙清潔服務車（CleaningVan，面向 +Y）。"""
    mb = MeshBuilder()
    mb.chamfer_box(0, 0, 1.15, 0.98, 2.15, 0.72, 0.18, P['tank_white'])
    mb.box(-1.01, 1.01, -2.05, 2.05, 0.95, 1.32, P['livery_cobalt'])
    mb.box(-0.88, 0.88, 1.55, 2.18, 1.22, 1.72, P['glass_cockpit'])
    mb.box(-0.65, 0.65, -1.4, 1.1, 1.87, 2.02, P['steel_light'])
    mb.cyl_z(0, 1.3, 1.88, 2.08, 0.15, 8, P['beacon'])
    for wy in [-1.35, 1.35]:
        mb.cyl_x(-1.08, -0.78, wy, 0.38, 0.38, 10, P['tire'])
        mb.cyl_x(0.78, 1.08, wy, 0.38, 0.38, 10, P['tire'])
    return mb.build('CleaningVan', location=(0, 0, 0))


def build_pushback_tug(P):
    """低多邊形重型飛機後推車（PushbackTug，面向 +Y）。"""
    mb = MeshBuilder()
    mb.chamfer_box(0, 0, 0.68, 1.35, 2.25, 0.38, 0.25, P['tank_white'], top_m=P['yellow_safety'])
    mb.box(-1.38, 1.38, 1.85, 2.32, 0.32, 0.95, P['livery_coral'])
    mb.box(-1.38, 1.38, -2.32, -1.85, 0.32, 0.95, P['livery_coral'])
    mb.chamfer_box(0, 0.55, 1.32, 0.92, 0.78, 0.36, 0.14, P['glass_cockpit'], top_m=P['tank_white'])
    mb.cyl_z(0, 0.55, 1.68, 1.88, 0.16, 8, P['beacon'])
    for wy in [-1.35, 1.35]:
        mb.cyl_x(-1.48, -1.08, wy, 0.52, 0.52, 10, P['tire'])
        mb.cyl_x(1.08, 1.48, wy, 0.52, 0.52, 10, P['tire'])
    return mb.build('PushbackTug', location=(0, 0, 0))


def build_fuel_tank_farm(P):
    """低多邊形航空油槽區（FuelTankFarm：3 座儲油槽、防溢堤、輸油管廊與灌裝島）。"""
    mb = MeshBuilder()
    # 防溢底座與圍堰
    mb.chamfer_box(0, 0, 0.25, 14.5, 9.5, 0.25, 0.8, P['stone_dark'])
    # 四周矮防溢牆
    mb.box(-14.2, 14.2, -9.2, -8.6, 0.5, 1.35, P['stone'])
    mb.box(-14.2, 14.2, 8.6, 9.2, 0.5, 1.35, P['stone'])
    mb.box(-14.2, -13.6, -9.2, 9.2, 0.5, 1.35, P['stone'])
    mb.box(13.6, 14.2, -9.2, 9.2, 0.5, 1.35, P['stone'])

    # 3 座大型圓筒航空儲油槽
    tank_xs = [-8.2, 0.0, 8.2]
    for tx in tank_xs:
        mb.cyl_z(tx, 1.2, 0.5, 7.2, 3.35, 16, P['tank_white'], side_m=P['tank_white'])
        # 柔和藍與橘色安全環帶
        mb.cyl_z(tx, 1.2, 4.4, 5.5, 3.40, 16, P['tank_band'], side_m=P['tank_band'])
        mb.cyl_z(tx, 1.2, 5.5, 5.85, 3.41, 16, P['orange_fuel'], side_m=P['orange_fuel'])
        # 錐形槽頂
        cone_ring = [
            (tx + 3.45 * math.cos(2 * math.pi * i / 16), 1.2 + 3.45 * math.sin(2 * math.pi * i / 16))
            for i in range(16)
        ]
        c_verts = [(x, y, 7.2) for x, y in cone_ring] + [(tx, 1.2, 8.65)]
        c_faces = [(i, (i + 1) % 16, 16) for i in range(16)]
        mb.add(c_verts, c_faces, P['steel_light'])
        # 頂部呼吸閥
        mb.cyl_z(tx, 1.2, 8.5, 9.2, 0.28, 8, P['steel_mid'])

    # 頂部連通空橋步道
    mb.box(-8.5, 8.5, 0.8, 1.6, 7.25, 7.55, P['steel_mid'])
    # 地面輸油管線與灌裝棚 (Fuel Loading Gantry at y = -5.8)
    mb.box(-9.5, 9.5, -3.5, -2.9, 0.9, 1.35, P['steel_mid'])
    mb.chamfer_box(0, -5.8, 3.8, 6.2, 2.1, 0.22, 0.3, P['steel_light'], top_m=P['orange_fuel'])
    for gx in [-4.8, 0.0, 4.8]:
        mb.cyl_z(gx, -5.8, 0.5, 3.6, 0.22, 8, P['steel_mid'])
    return mb.build('FuelTankFarm', location=(0, 0, 0))


def export_all():
    os.makedirs(OUT_DIR, exist_ok=True)
    glb_path = os.path.join(OUT_DIR, 'groundline.glb')
    bpy.ops.export_scene.gltf(
        filepath=glb_path,
        export_format='GLB',
        use_selection=False,
        export_yup=True,
        export_apply=True,
        export_cameras=False,
        export_lights=False,
        export_normals=True,
        export_materials='EXPORT',
    )
    print(f'ok groundline.glb {os.path.getsize(glb_path) / 1024:.1f} KB')


def main():
    reset_scene()
    P = palette()
    build_terminal(P)
    build_jetbridges(P)
    build_aircraft_a320(P, 'Aircraft_A320', 'livery_teal', 'livery_coral')
    build_aircraft_a320(P, 'Aircraft_B738', 'livery_cobalt', 'livery_gold')
    build_aircraft_a320(P, 'Aircraft_A321', 'livery_coral', 'livery_gold')
    build_aircraft_a320(P, 'Aircraft_E190', 'bag_sage', 'livery_teal')
    build_fuel_truck(P)
    build_baggage_tug(P)
    build_catering_truck(P)
    build_cleaning_van(P)
    build_pushback_tug(P)
    build_fuel_tank_farm(P)
    export_all()


if __name__ == '__main__':
    main()
