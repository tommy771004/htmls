# Groundline（267）Blender 高細節機場停機坪 3D 資產生成腳本
# 執行：/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P games/267-groundline/blender/build_apron.py
# 輸出：games/267-groundline/blender/out/groundline.glb
# 慣例：1 單位 = 1 公尺；Blender Z 朝上，車輛與飛機面向 +Y（匯出 glTF +Y up）。

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


def mat(name, color_hex, rough=0.5, metal=0.08, emit_hex=None, emit_strength=1.5, alpha=1.0):
    if name in _MATS and _MATS[name].name in bpy.data.materials:
        return _MATS[name]
    m = bpy.data.materials.new(name)
    bsdf = m.node_tree.nodes.get('Principled BSDF') if m.node_tree else None
    if bsdf:
        bsdf.inputs['Base Color'].default_value = (*hex_to_linear(color_hex), 1.0)
        bsdf.inputs['Roughness'].default_value = rough
        bsdf.inputs['Metallic'].default_value = metal
        if alpha < 1.0 and 'Alpha' in bsdf.inputs:
            bsdf.inputs['Alpha'].default_value = alpha
            m.blend_method = 'BLEND'
        if emit_hex:
            bsdf.inputs['Emission Color'].default_value = (*hex_to_linear(emit_hex), 1.0)
            bsdf.inputs['Emission Strength'].default_value = emit_strength
    m.diffuse_color = (*hex_to_linear(color_hex), alpha)
    _MATS[name] = m
    return m


class MeshBuilder:
    """高細節低多邊形網格建構器（支援多材質、斜角、放樣、桁架與窗框細節）。"""

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

    def prism_z(self, outline_xy, z0, z1, m, side_m=None, top_m=None, cap0=True, cap1=True):
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
            mats.append(top_m or m)
        return self.add(verts, faces, mats)

    def box(self, x0, x1, y0, y1, z0, z1, m, side_m=None, top_m=None):
        verts = [
            (x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0),
            (x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1),
        ]
        sm = side_m or m
        tm = top_m or m
        faces = [
            (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7),
            (3, 2, 1, 0), (4, 5, 6, 7),
        ]
        mats = [sm, sm, sm, sm, m, tm]
        return self.add(verts, faces, mats)

    def strut(self, p0, p1, r, m, segs=6):
        """任意兩點間的立體結構圓桿／斜撐（用於屋頂桁架、Y型柱、空橋液壓桿）。"""
        v0 = Vector(p0)
        v1 = Vector(p1)
        axis = v1 - v0
        length = axis.length
        if length < 1e-4:
            return
        d = axis.normalized()
        up = Vector((0, 0, 1)) if abs(d.z) < 0.9 else Vector((1, 0, 0))
        u = d.cross(up).normalized()
        w = d.cross(u).normalized()
        verts = []
        for pt in (v0, v1):
            for i in range(segs):
                ang = 2 * math.pi * i / segs
                verts.append(tuple(pt + (u * math.cos(ang) + w * math.sin(ang)) * r))
        faces = []
        for i in range(segs):
            j = (i + 1) % segs
            faces.append((i, j, segs + j, segs + i))
        faces.append(tuple(reversed(range(segs))))
        faces.append(tuple(range(segs, 2 * segs)))
        self.add(verts, faces, m)

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

    def cyl_z(self, cx, cy, z0, z1, r, segs, m, side_m=None, top_m=None, cap0=True, cap1=True, rot=0.0):
        pts = [
            (cx + r * math.cos(rot + 2 * math.pi * i / segs),
             cy + r * math.sin(rot + 2 * math.pi * i / segs))
            for i in range(segs)
        ]
        return self.prism_z(pts, z0, z1, m, side_m=side_m, top_m=top_m, cap0=cap0, cap1=cap1)

    def cone_z(self, cx, cy, z0, z1, r0, r1, segs, m, side_m=None, cap0=True, cap1=True):
        ring0 = [
            (cx + r0 * math.cos(2 * math.pi * i / segs),
             cy + r0 * math.sin(2 * math.pi * i / segs), z0)
            for i in range(segs)
        ]
        ring1 = [
            (cx + r1 * math.cos(2 * math.pi * i / segs),
             cy + r1 * math.sin(2 * math.pi * i / segs), z1)
            for i in range(segs)
        ]
        verts = ring0 + ring1
        faces, mats = [], []
        for i in range(segs):
            j = (i + 1) % segs
            faces.append((i, j, segs + j, segs + i))
            mats.append(side_m or m)
        if cap0:
            faces.append(tuple(reversed(range(segs))))
            mats.append(m)
        if cap1:
            faces.append(tuple(range(segs, 2 * segs)))
            mats.append(m)
        return self.add(verts, faces, mats)

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

    def loft_y(self, sections, m, cap0=True, cap1=True, face_mats=None, cap0_m=None, cap1_m=None):
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
            mats.append(cap0_m or m)
        if cap1:
            last = (len(sections) - 1) * n
            faces.append(tuple(reversed(range(last, last + n))))
            mats.append(cap1_m or m)
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
        'stone': mat('StoneWarm', '#ece7df', rough=0.62, metal=0.05),
        'stone_dark': mat('StoneDark', '#cfc7ba', rough=0.68, metal=0.05),
        'terrazzo': mat('TerrazzoFloor', '#f3efe8', rough=0.45, metal=0.08),
        'wood_warm': mat('WoodWarm', '#c89b6e', rough=0.52, metal=0.04),
        'steel_light': mat('SteelLight', '#f4f3ef', rough=0.35, metal=0.28),
        'steel_mid': mat('SteelMid', '#8592a1', rough=0.42, metal=0.38),
        'steel_dark': mat('SteelDark', '#343d4b', rough=0.48, metal=0.42),
        'chrome': mat('ChromeBright', '#e2e8f0', rough=0.18, metal=0.82),
        'glass_roof': mat('GlassRoof', '#8ec2da', rough=0.18, metal=0.18),
        'glass_skylight': mat('GlassSkylight', '#b8e2f4', rough=0.14, metal=0.12, emit_hex='#d0effc', emit_strength=0.35),
        'glass_wall': mat('GlassWall', '#5889a4', rough=0.18, metal=0.22),
        'glass_cockpit': mat('GlassCockpit', '#1e2938', rough=0.12, metal=0.32),
        'fuselage': mat('FuselageWhite', '#faf8f5', rough=0.28, metal=0.14),
        'fuselage_belly': mat('FuselageBelly', '#dde2e8', rough=0.36, metal=0.18),
        'wing_gray': mat('WingGray', '#dfe4ea', rough=0.38, metal=0.20),
        'flap_gray': mat('FlapGray', '#bcc5d0', rough=0.44, metal=0.22),
        'livery_teal': mat('LiveryTeal', '#1e8288', rough=0.32, metal=0.15),
        'livery_coral': mat('LiveryCoral', '#e05a47', rough=0.32, metal=0.15),
        'livery_cobalt': mat('LiveryCobalt', '#255bb5', rough=0.32, metal=0.15),
        'livery_gold': mat('LiveryGold', '#e8a331', rough=0.34, metal=0.18),
        'tire': mat('TireDark', '#22262b', rough=0.82, metal=0.05),
        'yellow_safety': mat('SafetyYellow', '#f4c038', rough=0.40, metal=0.12),
        'orange_fuel': mat('FuelOrange', '#ea7334', rough=0.38, metal=0.14),
        'mint_cater': mat('CaterMint', '#3ea38f', rough=0.38, metal=0.12),
        'tank_white': mat('TankWhite', '#f2f0eb', rough=0.40, metal=0.16),
        'tank_band': mat('TankBand', '#6f9fb8', rough=0.38, metal=0.18),
        'bag_blue': mat('BagBlue', '#437fc2', rough=0.50, metal=0.06),
        'bag_coral': mat('BagCoral', '#de6552', rough=0.50, metal=0.06),
        'bag_sage': mat('BagSage', '#5ca379', rough=0.50, metal=0.06),
        'beacon': mat('BeaconAmber', '#ffaa2b', rough=0.2, metal=0.1, emit_hex='#ffaa2b', emit_strength=2.5),
        'nav_red': mat('NavRed', '#ff3b30', rough=0.2, metal=0.1, emit_hex='#ff3b30', emit_strength=2.4),
        'nav_green': mat('NavGreen', '#28cd41', rough=0.2, metal=0.1, emit_hex='#28cd41', emit_strength=2.4),
        'win_warm': mat('WinWarm', '#ffe5ad', rough=0.25, metal=0.05, emit_hex='#ffd88a', emit_strength=1.4),
        'win_cabin': mat('WinCabin', '#2e4358', rough=0.15, metal=0.2, emit_hex='#9ec9e8', emit_strength=0.45),
        'sign_dark': mat('SignDark', '#1b2430', rough=0.4, metal=0.2),
        'solar_blue': mat('SolarBlue', '#26466d', rough=0.22, metal=0.35),
    }


def build_terminal(P):
    """高細節航廈主體（含雙層內裝候機大廳、落地玻璃窗框格柵、Y型鋼構立柱、登機門標牌、機坪地勤車庫門與高聳航管塔台）。"""
    mb = MeshBuilder()

    # 1. 基座地坪與一樓／二樓磨石子樓板 (-63..+63, y: -12.5..+12.5)
    mb.chamfer_box(0, 0, 0.35, 63.5, 12.8, 0.35, 1.5, P['stone_dark'], top_m=P['terrazzo'])
    # 二樓出境候機大廳樓板 (z = 3.8..4.15)
    mb.chamfer_box(0, 0, 3.95, 61.5, 11.2, 0.22, 1.2, P['stone'], top_m=P['terrazzo'])

    # 2. 航廈內部細節（當切換「航廈透視」或從玻璃幕牆外觀看時清晰可見）
    # 中央木質報到櫃檯島與安檢門 (Check-in Islands & Security Gates at y = +4..+8)
    for cx in [-40.0, -20.0, 0.0, 20.0, 40.0]:
        mb.chamfer_box(cx, 5.8, 4.65, 4.2, 1.4, 0.48, 0.3, P['wood_warm'], top_m=P['steel_light'])
        mb.box(cx - 3.2, cx + 3.2, 5.6, 6.0, 5.1, 6.1, P['win_warm'])
        # 1F 行李分揀轉盤 (Baggage Carousels on ground floor)
        mb.cyl_z(cx, 2.0, 0.7, 1.25, 2.4, 12, P['steel_dark'], top_m=P['steel_mid'])
        mb.cyl_z(cx, 2.0, 1.25, 1.55, 1.1, 12, P['wood_warm'])

    # 候機室雙排座椅群與電動步道 (Waiting Lounge Seating & Moving Walkways at y = -8..+1)
    for gx in [-48.0, -24.0, 0.0, 24.0, 48.0]:
        for row_y in [-7.2, -5.2, -3.2]:
            mb.box(gx - 6.5, gx - 1.8, row_y - 0.35, row_y + 0.35, 4.2, 4.75, P['livery_cobalt'])
            mb.box(gx + 1.8, gx + 6.5, row_y - 0.35, row_y + 0.35, 4.2, 4.75, P['livery_teal'])
        # 登機門驗票櫃檯與暖光燈箱
        mb.box(gx - 1.6, gx + 1.6, -10.2, -9.2, 4.2, 5.15, P['wood_warm'], top_m=P['steel_light'])
        mb.box(gx - 1.4, gx + 1.4, -10.25, -10.1, 5.2, 5.8, P['win_warm'])

    # 中央電動步道 (Moving Walkways along X)
    for wx in [-36.0, -12.0, 12.0, 36.0]:
        mb.box(wx - 7.5, wx + 7.5, -0.6, 0.6, 4.18, 4.45, P['steel_mid'], top_m=P['steel_dark'])
        mb.box(wx - 7.5, wx + 7.5, -0.7, -0.55, 4.45, 4.85, P['glass_Roof'] if 'glass_Roof' in P else P['glass_roof'])
        mb.box(wx - 7.5, wx + 7.5, 0.55, 0.7, 4.45, 4.85, P['glass_roof'])

    # 3. 航廈主體玻璃幕牆與精緻金屬窗框格柵 (Curtain Wall & Mullions)
    mb.chamfer_box(0, 0, 3.9, 60.8, 10.6, 3.2, 1.1, P['stone'], side_m=P['glass_wall'])
    # 水平樓層橫樑與遮陽百葉 (Horizontal Louvers & Fascia Bands)
    for hz in [2.1, 3.95, 5.6, 7.25]:
        mb.chamfer_box(0, 0, hz, 61.4, 11.0, 0.14, 1.1, P['steel_light'])
    mb.chamfer_box(0, 0, 7.45, 62.4, 11.9, 0.28, 1.2, P['steel_light'])

    # 垂直窗框格柵與外側 Y 型斜撐建築鋼柱 (Architectural Y-Columns along South & North Facades)
    for ix in range(-60, 61, 4):
        # 細窗框肋條 (Mullions)
        mb.box(ix - 0.08, ix + 0.08, -10.75, -10.55, 0.7, 7.2, P['steel_mid'])
        mb.box(ix - 0.08, ix + 0.08, 10.55, 10.75, 0.7, 7.2, P['steel_mid'])
        if ix % 12 == 0:
            # 結構主柱 + Y 型雙斜撐托住挑簷屋頂
            for sy in (-1, 1):
                by = sy * 11.4
                mb.cyl_z(ix, by, 0.7, 4.6, 0.36, 8, P['steel_light'])
                mb.strut((ix, by, 4.4), (ix - 1.6, sy * 12.2, 7.35), 0.20, P['steel_light'])
                mb.strut((ix, by, 4.4), (ix + 1.6, sy * 12.2, 7.35), 0.20, P['steel_light'])
                mb.strut((ix, by, 4.4), (ix, sy * 10.6, 7.35), 0.20, P['steel_mid'])

    # 一樓機坪側地勤行李分揀車庫捲門與暖光照明帶 (Ground Level GSE & Baggage Bays)
    for bx in [-36.0, -12.0, 12.0, 36.0]:
        for dx in [-3.2, 0.0, 3.2]:
            mb.box(bx + dx - 1.1, bx + dx + 1.1, -10.78, -10.52, 0.7, 2.8, P['steel_dark'])
            mb.box(bx + dx - 1.0, bx + dx + 1.0, -10.82, -10.75, 2.65, 2.9, P['yellow_safety'])
        # 2F 觀景落地窗暖光帶
        mb.box(bx - 4.8, bx + 4.8, -10.76, -10.58, 4.3, 5.2, P['win_warm'])

    # 4. 5 座突出式登機門候機室 (Gate Holdrooms G1..G5 at x = -48, -24, 0, 24, 48)
    gate_xs = [-48.0, -24.0, 0.0, 24.0, 48.0]
    for idx, gx in enumerate(gate_xs):
        # 兩層突出式玻璃候機亭
        mb.chamfer_box(gx, -12.2, 3.6, 5.4, 2.9, 3.15, 0.65, P['stone'], side_m=P['glass_wall'])
        mb.chamfer_box(gx, -12.2, 3.9, 5.6, 3.05, 0.16, 0.65, P['steel_light'])
        mb.chamfer_box(gx, -12.2, 6.9, 5.8, 3.25, 0.26, 0.65, P['steel_light'])
        # 候機亭垂直窗框
        for mx in [gx - 3.6, gx - 1.8, gx, gx + 1.8, gx + 3.6]:
            mb.box(mx - 0.07, mx + 0.07, -15.18, -15.02, 0.7, 6.7, P['steel_light'])
        # 候機室暖光條與黑底黃字登機門大標牌 (Gate Sign Box)
        mb.box(gx - 4.0, gx + 4.0, -15.18, -14.95, 5.35, 5.95, P['win_warm'])
        mb.box(gx - 1.6, gx + 1.6, -15.35, -15.05, 6.2, 7.15, P['sign_dark'])
        mb.box(gx - 1.45, gx + 1.45, -15.40, -15.32, 6.35, 7.0, P['yellow_safety'])

    # 5. 西側高聳航管塔台 (ATC Control Tower at x = -54, y = 4)
    tx, ty = -54.0, 4.0
    # 塔身八角核心筒 + 4 根外露鋼骨垂直肋柱
    mb.cyl_z(tx, ty, 7.5, 18.8, 2.2, 12, P['stone'])
    for ang_i in range(4):
        ang = math.pi * 0.25 + ang_i * math.pi * 0.5
        rx = tx + 2.35 * math.cos(ang)
        ry = ty + 2.35 * math.sin(ang)
        mb.cyl_z(rx, ry, 7.5, 19.2, 0.28, 6, P['steel_mid'])
    # 中段設備環層與微波天線盤
    mb.cyl_z(tx, ty, 15.8, 16.5, 3.1, 12, P['steel_dark'])
    mb.cyl_z(tx, ty, 18.8, 19.6, 3.6, 12, P['steel_light'])
    # 360 度外傾式航管玻璃控制室 (Control Cab with angled mullions)
    mb.cone_z(tx, ty, 19.6, 22.8, 3.1, 3.75, 12, P['steel_dark'], side_m=P['glass_cockpit'])
    for ang_i in range(12):
        ang = 2 * math.pi * ang_i / 12
        p0 = (tx + 3.12 * math.cos(ang), ty + 3.12 * math.sin(ang), 19.6)
        p1 = (tx + 3.77 * math.cos(ang), ty + 3.77 * math.sin(ang), 22.8)
        mb.strut(p0, p1, 0.08, P['steel_light'], segs=4)
    # 塔頂遮陽盤、防撞燈與通訊桅杆
    mb.cone_z(tx, ty, 22.8, 23.6, 3.95, 3.2, 12, P['steel_light'])
    mb.cyl_z(tx, ty, 23.6, 24.4, 1.4, 10, P['steel_mid'])
    mb.cyl_z(tx - 1.2, ty + 0.8, 23.6, 27.8, 0.09, 6, P['steel_light'])
    mb.cyl_z(tx - 1.2, ty + 0.8, 27.8, 28.2, 0.25, 8, P['nav_red'])

    return mb.build('Terminal', location=(0, 0, 0))


def build_terminal_roof_and_radar(P):
    """可獨立互動切換透視的波浪拱形玻璃屋頂（TerminalRoof）與可旋轉塔台雷達（TowerRadar）。"""
    mb = MeshBuilder()
    segs_x = 48
    segs_y = 12
    x_min, x_max = -62.5, 62.5
    y_min, y_max = -12.6, 12.6

    for ix in range(segs_x):
        x0 = x_min + (x_max - x_min) * (ix / segs_x)
        x1 = x_min + (x_max - x_min) * ((ix + 1) / segs_x)
        wave0 = 1.4 * math.cos((x0 / 24.0) * math.pi * 2.0) + 1.4
        wave1 = 1.4 * math.cos((x1 / 24.0) * math.pi * 2.0) + 1.4
        is_main_rib = (ix % 4 == 0)
        for iy in range(segs_y):
            u0 = iy / segs_y
            u1 = (iy + 1) / segs_y
            y0 = y_min + (y_max - y_min) * u0
            y1 = y_min + (y_max - y_min) * u1
            arch0 = math.sin(u0 * math.pi) * 3.55
            arch1 = math.sin(u1 * math.pi) * 3.55
            z00 = 7.45 + arch0 + wave0 * 0.48 * math.sin(u0 * math.pi)
            z10 = 7.45 + arch0 + wave1 * 0.48 * math.sin(u0 * math.pi)
            z11 = 7.45 + arch1 + wave1 * 0.48 * math.sin(u1 * math.pi)
            z01 = 7.45 + arch1 + wave0 * 0.48 * math.sin(u1 * math.pi)

            is_skylight = (iy in (4, 5, 6, 7)) and (not is_main_rib) and (ix % 2 == 1)
            roof_mat = P['steel_light'] if is_main_rib else (P['glass_skylight'] if is_skylight else P['glass_roof'])
            thick = 0.36 if is_main_rib else 0.16
            verts = [
                (x0, y0, z00), (x1, y0, z10), (x1, y1, z11), (x0, y1, z01),
                (x0, y0, z00 + thick), (x1, y0, z10 + thick), (x1, y1, z11 + thick), (x0, y1, z01 + thick),
            ]
            faces = [
                (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7),
                (3, 2, 1, 0), (4, 5, 6, 7),
            ]
            mb.add(verts, faces, roof_mat)

    # 屋頂兩側空調冷卻塔與太陽能板陣列 (Rooftop HVAC & Solar Modules)
    for hx in [-48.0, -24.0, 0.0, 24.0, 48.0]:
        mb.chamfer_box(hx - 6.0, 7.2, 9.6, 1.8, 1.1, 0.45, 0.15, P['steel_mid'], top_m=P['steel_dark'])
        mb.chamfer_box(hx + 6.0, 7.2, 9.6, 1.8, 1.1, 0.45, 0.15, P['steel_mid'], top_m=P['solar_blue'])

    roof_obj = mb.build('TerminalRoof', location=(0, 0, 0))

    # 獨立旋轉的塔台雷達 (TowerRadar，中心位於原點，由 Three.js 擺放至塔頂 (-54, 24.6, -42))
    mb_rad = MeshBuilder()
    mb_rad.cyl_z(0, 0, 0.0, 0.85, 0.32, 8, P['steel_mid'])
    mb_rad.chamfer_box(0, 0, 1.15, 2.35, 0.28, 0.38, 0.08, P['steel_light'], side_m=P['orange_fuel'])
    mb_rad.box(-2.45, 2.45, -0.34, -0.22, 0.88, 1.42, P['chrome'])
    mb_rad.cyl_z(0, 0, 1.52, 1.82, 0.22, 8, P['beacon'])
    radar_obj = mb_rad.build('TowerRadar', location=(0, 0, 0))
    return [roof_obj, radar_obj]


def build_jetbridges(P):
    """5 座高細節透明玻璃空橋（含空調外機、波紋伸縮節、電纜管、雙輪升降柱與風琴艙門罩）。"""
    objs = []
    gate_xs = [-48.0, -24.0, 0.0, 24.0, 48.0]

    def populate_rotunda(mb):
        # 地面支撐立柱与圓形玻璃轉盤塔座
        mb.cyl_z(0, 0, 0.0, 4.1, 1.15, 12, P['stone_dark'])
        mb.cyl_z(0, 0, 4.1, 4.35, 1.75, 12, P['steel_light'])
        mb.cyl_z(0, 0, 4.35, 6.2, 1.68, 12, P['steel_light'], side_m=P['glass_wall'])
        for i in range(12):
            ang = 2 * math.pi * i / 12
            mb.strut((1.69 * math.cos(ang), 1.69 * math.sin(ang), 4.35),
                     (1.69 * math.cos(ang), 1.69 * math.sin(ang), 6.2), 0.05, P['steel_light'], segs=4)
        mb.cyl_z(0, 0, 6.2, 6.65, 1.80, 12, P['steel_light'])
        mb.cyl_z(0, 0, 6.65, 7.05, 0.85, 10, P['steel_mid'])

    def populate_arm(mb):
        # 第一節與第二節伸縮玻璃走廊（沿 -Y 伸向飛機 L1 艙門）
        mb.box(-1.02, 1.02, -6.2, -1.0, 4.25, 6.08, P['steel_light'], side_m=P['glass_wall'])
        mb.box(-0.92, 0.92, -11.0, -5.8, 4.32, 5.98, P['steel_light'], side_m=P['glass_wall'])
        # 走廊內部暖光地板條
        mb.box(-0.75, 0.75, -10.8, -1.2, 4.34, 4.42, P['win_warm'])
        # 結構鋼框肋條與窗框
        for ry in [-1.8, -3.2, -4.6, -6.0, -7.4, -8.8, -10.2]:
            mb.box(-1.08, 1.08, ry - 0.12, ry + 0.12, 4.18, 6.16, P['steel_light'])
        # 下方承重鋼樑與側邊電纜拖鏈 (Cable Carrier & Under-beam)
        mb.box(-0.7, 0.7, -11.2, -1.0, 3.92, 4.25, P['steel_dark'])
        mb.box(0.95, 1.18, -9.8, -2.0, 4.05, 4.38, P['yellow_safety'])
        # 空橋頂部空調外機與警示黃燈
        mb.chamfer_box(0, -4.2, 6.38, 0.68, 0.95, 0.24, 0.08, P['steel_light'], side_m=P['steel_mid'])
        mb.cyl_z(0, -11.2, 6.15, 6.42, 0.16, 8, P['beacon'])
        # 底部雙柱液壓升降轉向輪架 (Dual-Column Hydraulic Bogie)
        for sx in (-0.52, 0.52):
            mb.cyl_z(sx, -9.2, 0.55, 4.05, 0.18, 8, P['steel_mid'])
            mb.cyl_z(sx, -9.2, 1.2, 2.8, 0.24, 8, P['chrome'])
        mb.box(-1.18, 1.18, -9.6, -8.8, 0.35, 0.68, P['steel_dark'])
        mb.cyl_x(-1.35, -0.92, -9.2, 0.45, 0.45, 12, P['tire'])
        mb.cyl_x(0.92, 1.35, -9.2, 0.45, 0.45, 12, P['tire'])
        mb.cyl_x(-1.37, 1.37, -9.2, 0.45, 0.22, 8, P['chrome'])
        # 前端可轉向對接艙與黑色折疊風琴軟篷 (Accordion Canopy Hood)
        mb.chamfer_box(0, -11.55, 5.12, 1.12, 0.68, 0.96, 0.16, P['steel_light'], side_m=P['glass_wall'])
        for fy in [-12.15, -12.42, -12.68]:
            mb.box(-1.14, 1.14, fy - 0.10, fy + 0.10, 4.10, 6.12, P['steel_dark'])
        mb.box(-1.18, 1.18, -12.88, -12.68, 4.06, 6.14, P['yellow_safety'])

    for idx, gx in enumerate(gate_xs):
        mb = MeshBuilder()
        populate_rotunda(mb)
        populate_arm(mb)
        objs.append(mb.build(f'Jetbridge_{idx + 1}', (gx, -15.0, 0.0)))

    mb_unit = MeshBuilder()
    populate_rotunda(mb_unit)
    populate_arm(mb_unit)
    objs.append(mb_unit.build('JetbridgeUnit', (0.0, 0.0, 0.0)))

    mb_rot = MeshBuilder()
    populate_rotunda(mb_rot)
    objs.append(mb_rot.build('JetbridgeRotunda', (0.0, 0.0, 0.0)))

    mb_arm = MeshBuilder()
    populate_arm(mb_arm)
    objs.append(mb_arm.build('JetbridgeArm', (0.0, 0.0, 0.0)))
    return objs


def build_aircraft(P, name='Aircraft_A320', tail_mat_key='livery_teal', stripe_mat_key='livery_coral',
                   length_scale=1.0, wing_span=14.2, winglet_style='sharklet'):
    """高細節民航客機（機頭朝 +Y，含 20 段圓潤機身、駕駛艙六窗黑罩、客艙舷窗、艙門框、機背衛通天線、渦扇葉片與雙輪起落架）。"""
    mb = MeshBuilder()
    fus = P['fuselage']
    belly = P['fuselage_belly']
    tail_m = P[tail_mat_key]
    stripe_m = P[stripe_mat_key]
    wing_m = P['wing_gray']
    flap_m = P['flap_gray']

    n = 20
    # 角度 0 為右側 (+X)，pi/2 為機頂 (+Z)，pi 為左側 (-X)，3pi/2 為機腹 (-Z)
    def ring(rx, rz, cz):
        return [
            (rx * math.cos(2 * math.pi * i / n), cz + rz * math.sin(2 * math.pi * i / n))
            for i in range(n)
        ]

    L = length_scale
    sections = [
        (-14.2 * L, ring(0.18, 0.20, 3.08)),
        (-13.2 * L, ring(0.55, 0.62, 3.02)),
        (-11.2 * L, ring(1.18, 1.26, 2.90)),
        (-8.2 * L,  ring(1.68, 1.78, 2.75)),
        (-4.0 * L,  ring(1.78, 1.86, 2.72)),
        (0.0,       ring(1.78, 1.86, 2.72)),
        (4.5 * L,   ring(1.78, 1.86, 2.72)),
        (8.2 * L,   ring(1.72, 1.80, 2.68)),
        (10.2 * L,  ring(1.48, 1.54, 2.56)),
        (11.6 * L,  ring(1.08, 1.08, 2.38)),
        (12.8 * L,  ring(0.58, 0.56, 2.22)),
        (13.5 * L,  ring(0.20, 0.20, 2.14)),
    ]

    face_mats = {}
    for k in range(len(sections) - 1):
        for i in range(n):
            # 機腹灰銀色防擦塗裝 (indices 13..17)
            if i in (13, 14, 15, 16, 17) and 2 <= k <= 8:
                face_mats[(k, i)] = belly
            # 機身彩色腰線塗裝 (indices 0, 19 on right; 9, 10 on left)
            if i in (0, 19, 9, 10) and 1 <= k <= 8:
                face_mats[(k, i)] = stripe_m
            # 尾椎與機尾塗裝延續
            if k in (0, 1) and i in (3, 4, 5, 6):
                face_mats[(k, i)] = tail_m

    # 駕駛艙六窗黑玻面罩 (Cockpit Windscreen at section k = 8)
    for i in (2, 3, 4, 5, 6, 7):
        face_mats[(8, i)] = P['glass_cockpit']
    # 機鼻氣象雷達罩色環 (Nose Radome tip at k = 10)
    for i in range(n):
        face_mats[(10, i)] = P['stone']

    mb.loft_y(sections, fus, face_mats=face_mats, cap0_m=P['steel_dark'], cap1_m=P['stone'])

    # 機尾 APU 排氣尾管
    mb.cyl_y(0, -14.55 * L, -14.1 * L, 3.08, 0.22, 10, P['steel_dark'])

    # 兩側客艙舷窗列 (Cabin Windows) 與 L1/L2/R1/R2 登機艙門框
    win_count = int(16 * L)
    for side in (-1, 1):
        wx_outer = side * 1.79
        wx_inner = side * 1.72
        for wi in range(win_count):
            wy = (-7.2 + wi * 0.92) * L
            if abs(wy - 7.4 * L) < 0.8 or abs(wy + 7.8 * L) < 0.8:
                continue
            mb.box(min(wx_inner, wx_outer), max(wx_inner, wx_outer), wy - 0.16, wy + 0.16, 2.92, 3.24, P['win_cabin'])
        # 前後艙門 (L1/R1 at +7.5*L, L2/R2 at -7.8*L)
        for dy in (7.5 * L, -7.8 * L):
            mb.box(min(side * 1.71, side * 1.81), max(side * 1.71, side * 1.81),
                   dy - 0.48, dy + 0.48, 2.25, 3.55, P['steel_mid'], side_m=P['steel_light'])

    # 機背 SATCOM 衛星通訊天線罩、VHF 刀型天線與防撞紅閃燈
    mb.chamfer_box(0, 1.2 * L, 4.62, 0.42, 1.15, 0.16, 0.14, P['fuselage'], top_m= stripe_m)
    mb.box(-0.04, 0.04, 5.2 * L, 5.75 * L, 4.52, 4.92, P['steel_light'])
    mb.box(-0.04, 0.04, -3.5 * L, -2.95 * L, 4.52, 4.88, P['steel_light'])
    mb.cyl_z(0, 3.2 * L, 4.55, 4.78, 0.16, 8, P['nav_red'])

    # 機腹中央翼盒整流罩 (Belly Fairing)
    mb.chamfer_box(0, -0.3 * L, 1.22, 1.65, 3.8 * L, 0.48, 0.45, belly)

    # 後掠主翼、襟翼滑軌整流罩 (Flap Track Fairings) 與翼尖小翼
    W = wing_span
    for side in (-1, 1):
        s = float(side)
        w_verts = [
            (s * 1.55, 2.2, 1.95), (s * 1.55, -2.5, 1.85),
            (s * W, -4.8, 2.52), (s * W, -2.6, 2.60),
            (s * 1.55, 2.2, 2.38), (s * 1.55, -2.5, 2.22),
            (s * W, -4.8, 2.72), (s * W, -2.6, 2.80),
        ]
        if side == 1:
            w_faces = [(0, 1, 2, 3), (7, 6, 5, 4), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)]
        else:
            w_faces = [(3, 2, 1, 0), (4, 5, 6, 7), (1, 5, 4, 0), (2, 6, 5, 1), (3, 7, 6, 2), (0, 4, 7, 3)]
        mb.add(w_verts, w_faces, wing_m)

        # 前緣縫翼亮銀條 (Leading-Edge Slat)
        le_verts = [
            (s * 1.6, 2.25, 2.02), (s * 1.6, 1.75, 2.00),
            (s * (W - 0.2), -2.9, 2.62), (s * (W - 0.2), -2.52, 2.65),
            (s * 1.6, 2.25, 2.36), (s * 1.6, 1.75, 2.35),
            (s * (W - 0.2), -2.9, 2.78), (s * (W - 0.2), -2.52, 2.81),
        ]
        mb.add(le_verts, w_faces, P['chrome'])

        # 翼下 3 具襟翼滑軌整流罩 (Flap Track Canoes)
        for fx_ratio, fy_off, fz_off in [(0.34, -2.4, 1.85), (0.56, -3.2, 2.08), (0.76, -3.9, 2.28)]:
            cx = s * W * fx_ratio
            mb.chamfer_box(cx, fy_off, fz_off, 0.14, 1.15, 0.18, 0.06, flap_m, top_m=stripe_m)

        # 翼尖小翼（Sharklet 或 B738 Split-Scimitar 雙叉小翼）
        sl_verts = [
            (s * (W - 0.3), -2.65, 2.68), (s * (W - 0.3), -4.75, 2.62),
            (s * (W + 0.65), -5.15, 4.35), (s * (W + 0.65), -3.85, 4.38),
            (s * (W - 0.1), -2.65, 2.68), (s * (W - 0.1), -4.75, 2.62),
            (s * (W + 0.82), -5.15, 4.35), (s * (W + 0.82), -3.85, 4.38),
        ]
        mb.add(sl_verts, w_faces, tail_m)
        if winglet_style == 'scimitar':
            sc_verts = [
                (s * (W - 0.2), -3.2, 2.65), (s * (W - 0.2), -4.6, 2.60),
                (s * (W + 0.45), -4.95, 1.75), (s * (W + 0.45), -4.1, 1.78),
                (s * W, -3.2, 2.65), (s * W, -4.6, 2.60),
                (s * (W + 0.58), -4.95, 1.75), (s * (W + 0.58), -4.1, 1.78),
            ]
            mb.add(sc_verts, w_faces, stripe_m)

        # 翼尖紅／綠航行燈 (Red Port at -X, Green Starboard at +X)
        nav_m = P['nav_green'] if side == 1 else P['nav_red']
        mb.cyl_z(s * (W + 0.2), -2.75, 2.65, 2.90, 0.18, 8, nav_m)

        # 翼下高旁通比渦扇發動機 (High-Bypass Turbofan Engine Nacelle)
        ex = s * 4.85
        # 發動機外罩與亮銀進氣唇口 (Chrome Intake Lip)
        mb.cyl_y(ex, -0.85, 2.25, 1.42, 0.96, 14, fus, side_m=fus)
        mb.cyl_y(ex, 2.15, 2.52, 1.42, 0.92, 14, P['chrome'], side_m=P['chrome'])
        # 渦扇深色葉片盤與中心整流錐 (Fan Face & Spinner Cone)
        mb.cyl_y(ex, 2.05, 2.38, 1.42, 0.78, 14, P['steel_dark'])
        mb.cyl_y(ex, 2.25, 2.62, 1.42, 0.26, 10, P['chrome'])
        # 尾噴管與核心排氣錐
        mb.cyl_y(ex, -1.65, -0.80, 1.42, 0.68, 12, P['steel_mid'])
        mb.cyl_y(ex, -2.05, -1.55, 1.42, 0.42, 10, P['steel_dark'])
        # 發動機外側航空公司標誌色帶
        mb.box(min(ex - 0.98 * s, ex - 0.88 * s), max(ex - 0.98 * s, ex - 0.88 * s),
               -0.3, 1.8, 1.22, 1.62, stripe_m)
        # 發動機派龍架 (Pylon)
        mb.box(min(ex - 0.20, ex + 0.20), max(ex - 0.20, ex + 0.20), -0.5, 2.1, 1.95, 2.38, wing_m)

    # 垂直尾翼（含前緣背鰭、方向舵分線與雙色塗裝帶）
    v_verts = [
        (-0.24, -7.2 * L, 3.75), (-0.24, -13.4 * L, 3.35), (-0.14, -14.6 * L, 8.55), (-0.14, -11.5 * L, 8.62),
        (0.24, -7.2 * L, 3.75), (0.24, -13.4 * L, 3.35), (0.14, -14.6 * L, 8.55), (0.14, -11.5 * L, 8.62),
    ]
    v_faces = [(0, 1, 2, 3), (7, 6, 5, 4), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)]
    mb.add(v_verts, v_faces, tail_m)
    # 垂直尾翼亮色裝飾斜帶
    vs_verts = [
        (-0.26, -9.6 * L, 5.2), (-0.26, -12.8 * L, 5.0), (-0.18, -13.6 * L, 7.1), (-0.18, -11.1 * L, 7.2),
        (0.26, -9.6 * L, 5.2), (0.26, -12.8 * L, 5.0), (0.18, -13.6 * L, 7.1), (0.18, -11.1 * L, 7.2),
    ]
    mb.add(vs_verts, v_faces, stripe_m)

    # 水平尾翼（含銀色前緣與升降舵）
    for side in (-1, 1):
        s = float(side)
        h_verts = [
            (s * 0.35, -10.2 * L, 3.32), (s * 0.35, -13.3 * L, 3.25),
            (s * 5.1, -14.2 * L, 3.58), (s * 5.1, -12.3 * L, 3.62),
            (s * 0.35, -10.2 * L, 3.55), (s * 0.35, -13.3 * L, 3.48),
            (s * 5.1, -14.2 * L, 3.75), (s * 5.1, -12.3 * L, 3.78),
        ]
        if side == 1:
            h_faces = [(0, 1, 2, 3), (7, 6, 5, 4), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)]
        else:
            h_faces = [(3, 2, 1, 0), (4, 5, 6, 7), (1, 5, 4, 0), (2, 6, 5, 1), (3, 7, 6, 2), (0, 4, 7, 3)]
        mb.add(h_verts, h_faces, wing_m)

    # 起落架系統（雙輪鼻輪 + 雙輪主起落架 + 輪艙門與滑行燈）
    ny = 9.8 * L
    mb.cyl_z(0, ny, 0.38, 1.85, 0.14, 8, P['chrome'])
    mb.cyl_z(0, ny + 0.18, 1.15, 1.55, 0.18, 8, P['win_warm'])  # 鼻輪滑行頭燈
    for wx in (-0.28, 0.28):
        mb.cyl_x(wx - 0.10, wx + 0.10, ny, 0.38, 0.38, 12, P['tire'])
    mb.box(-0.52, -0.44, ny - 0.55, ny + 0.55, 1.15, 1.85, fus)
    mb.box(0.44, 0.52, ny - 0.55, ny + 0.55, 1.15, 1.85, fus)

    for side in (-1, 1):
        gx = side * 2.68
        mb.cyl_z(gx, -1.15, 0.50, 2.08, 0.18, 10, P['chrome'])
        mb.strut((gx, -1.15, 0.95), (side * 1.65, -1.15, 1.95), 0.10, P['steel_mid'])
        for w_off in (-0.36, 0.36):
            mb.cyl_x(gx + w_off - 0.14, gx + w_off + 0.14, -1.15, 0.52, 0.52, 12, P['tire'])
        # 主起落架輪艙門
        mb.box(min(side * 1.55, side * 1.68), max(side * 1.55, side * 1.68), -1.85, -0.45, 0.92, 1.85, belly)

    return mb.build(name, location=(0, 0, 0))


def build_fuel_truck(P):
    """高細節航空加油車（FuelTruck，面向 +Y，含後視鏡、泵浦控制艙、頂部安全護欄、加油軟管捲盤與升降加油平台）。"""
    mb = MeshBuilder()
    # 底盤大樑與前後保桿
    mb.box(-1.18, 1.18, -3.7, 3.5, 0.42, 0.85, P['steel_dark'])
    mb.box(-1.22, 1.22, 3.35, 3.62, 0.38, 0.78, P['yellow_safety'])
    # 車頭燈與水箱護罩
    mb.box(-0.75, 0.75, 3.48, 3.60, 0.82, 1.28, P['chrome'])
    mb.box(-1.12, -0.82, 3.48, 3.62, 0.85, 1.12, P['win_warm'])
    mb.box(0.82, 1.12, 3.48, 3.62, 0.85, 1.12, P['win_warm'])
    # 駕駛室與兩側後視鏡
    mb.chamfer_box(0, 2.42, 1.56, 1.14, 0.98, 0.78, 0.18, P['tank_white'], top_m=P['orange_fuel'])
    mb.box(-1.02, 1.02, 2.92, 3.42, 1.42, 2.12, P['glass_cockpit'])
    mb.box(-1.16, 1.16, 2.05, 2.85, 1.48, 2.05, P['glass_cockpit'])
    for sx in (-1, 1):
        mb.box(sx * 1.16, sx * 1.32, 2.95, 3.12, 1.55, 1.98, P['steel_dark'])
    mb.cyl_z(-0.45, 2.4, 2.34, 2.56, 0.16, 8, P['beacon'])
    mb.cyl_z(0.45, 2.4, 2.34, 2.56, 0.16, 8, P['beacon'])
    # 中段泵浦控制箱與黑色加油軟管捲盤 (Pump Module & Hose Reels)
    mb.chamfer_box(0, 0.95, 1.48, 1.12, 0.48, 0.65, 0.1, P['steel_mid'], side_m=P['steel_dark'])
    mb.cyl_x(-1.16, 1.16, 0.95, 1.45, 0.38, 10, P['tire'])
    # 橢圓不鏽鋼／白漆儲油罐與雙色安全帶 (JET A-1 Tanker)
    mb.cyl_y(0, -3.45, 0.42, 1.78, 0.98, 16, P['chrome'], side_m=P['tank_white'], scale_x=1.20)
    mb.cyl_y(0, -2.25, -0.65, 1.78, 1.01, 16, P['orange_fuel'], scale_x=1.20)
    mb.cyl_y(0, -0.65, -0.25, 1.78, 1.01, 16, P['tank_band'], scale_x=1.20)
    # 油罐頂部防滑步道、人孔蓋與折疊護欄
    mb.box(-0.42, 0.42, -3.25, 0.25, 2.74, 2.86, P['steel_mid'])
    for mh_y in [-2.6, -1.4, -0.2]:
        mb.cyl_z(0, mh_y, 2.84, 3.02, 0.26, 8, P['chrome'])
    mb.box(-0.52, -0.44, -3.2, 0.2, 2.85, 3.12, P['yellow_safety'])
    mb.box(0.44, 0.52, -3.2, 0.2, 2.85, 3.12, P['yellow_safety'])
    # 後方升降給油作業平台
    mb.chamfer_box(0, -3.55, 1.35, 0.98, 0.36, 0.58, 0.1, P['orange_fuel'], top_m=P['steel_mid'])
    # 三軸六輪與銀色輪圈
    for wy in [-2.65, -1.35, 2.35]:
        mb.cyl_x(-1.32, -0.94, wy, 0.48, 0.48, 12, P['tire'])
        mb.cyl_x(0.94, 1.32, wy, 0.48, 0.48, 12, P['tire'])
        mb.cyl_x(-1.35, 1.35, wy, 0.48, 0.22, 8, P['chrome'])
    return mb.build('FuelTruck', location=(0, 0, 0))


def build_baggage_tug(P):
    """高細節機場行李牽引車與兩節滿載行李拖斗（BaggageTug，面向 +Y）。"""
    mb = MeshBuilder()
    # 牽引車車體 (y: 1.2 .. 3.7)
    mb.chamfer_box(0, 2.45, 0.76, 0.92, 1.18, 0.44, 0.18, P['yellow_safety'])
    mb.chamfer_box(0, 3.12, 1.18, 0.80, 0.52, 0.34, 0.14, P['yellow_safety'], top_m=P['steel_dark'])
    mb.box(-0.88, 0.88, 3.55, 3.72, 0.45, 0.85, P['steel_dark'])
    mb.box(-0.78, -0.52, 3.62, 3.75, 0.88, 1.08, P['win_warm'])
    mb.box(0.52, 0.78, 3.62, 3.75, 0.88, 1.08, P['win_warm'])
    # 駕駛座、方向盤與防滾頂棚
    mb.box(-0.45, 0.45, 1.75, 2.35, 1.18, 1.58, P['steel_dark'])
    for px, py in [(-0.76, 1.45), (0.76, 1.45), (-0.76, 2.68), (0.76, 2.68)]:
        mb.cyl_z(px, py, 1.15, 2.12, 0.06, 6, P['steel_dark'])
    mb.chamfer_box(0, 2.06, 2.16, 0.86, 0.72, 0.08, 0.1, P['tank_white'])
    mb.cyl_z(0, 2.06, 2.24, 2.42, 0.14, 8, P['beacon'])
    for wy in [1.65, 3.15]:
        mb.cyl_x(-1.02, -0.74, wy, 0.38, 0.38, 12, P['tire'])
        mb.cyl_x(0.74, 1.02, wy, 0.38, 0.38, 12, P['tire'])
        mb.cyl_x(-1.04, 1.04, wy, 0.38, 0.18, 8, P['chrome'])

    # 兩節精密行李拖斗 (Cart 1 at y = -0.65, Cart 2 at y = -3.55)
    for cy, bag_mats in [(-0.65, [P['bag_blue'], P['bag_coral'], P['bag_sage'], P['livery_gold']]),
                         (-3.55, [P['bag_coral'], P['bag_sage'], P['bag_blue'], P['livery_teal']])]:
        # 三角拖車連結桿
        mb.strut((0, cy + 1.05, 0.45), (0, cy + 1.85, 0.45), 0.08, P['yellow_safety'])
        # 拖斗鋼製底盤與格柵護欄
        mb.box(-0.90, 0.90, cy - 1.08, cy + 1.08, 0.38, 0.56, P['steel_mid'], top_m=P['steel_dark'])
        mb.box(-0.90, 0.90, cy + 0.94, cy + 1.08, 0.56, 1.48, P['yellow_safety'])
        mb.box(-0.90, 0.90, cy - 1.08, cy - 0.94, 0.56, 1.48, P['yellow_safety'])
        mb.box(-0.90, -0.80, cy - 1.08, cy + 1.08, 0.56, 0.92, P['steel_light'])
        # 多層堆疊行李箱與航空貨箱細節
        mb.chamfer_box(-0.36, cy - 0.38, 0.86, 0.40, 0.46, 0.32, 0.06, bag_mats[0])
        mb.chamfer_box(0.36, cy - 0.28, 0.84, 0.38, 0.50, 0.30, 0.06, bag_mats[1])
        mb.chamfer_box(-0.28, cy + 0.42, 0.88, 0.44, 0.38, 0.34, 0.06, bag_mats[2])
        mb.chamfer_box(0.34, cy + 0.40, 0.84, 0.36, 0.36, 0.28, 0.06, bag_mats[3])
        mb.chamfer_box(0.0, cy - 0.05, 1.38, 0.45, 0.42, 0.24, 0.06, P['orange_fuel'])
        for wy in [cy - 0.70, cy + 0.70]:
            mb.cyl_x(-0.98, -0.76, wy, 0.28, 0.28, 10, P['tire'])
            mb.cyl_x(0.76, 0.98, wy, 0.28, 0.28, 10, P['tire'])
            mb.cyl_x(-1.00, 1.00, wy, 0.28, 0.13, 8, P['chrome'])

    return mb.build('BaggageTug', location=(0, 0, 0))


def build_catering_truck(P):
    """高細節剪刀式升降空廚餐車（CateringTruck，面向 +Y，含 X 型液壓剪刀架、冷藏機組與艙門對接廊橋）。"""
    mb = MeshBuilder()
    # 底盤與四組液壓穩定支腿 (Outriggers)
    mb.box(-1.14, 1.14, -3.3, 3.2, 0.42, 0.82, P['steel_dark'])
    for ox in (-1.22, 1.22):
        for oy in (-2.6, 1.1):
            mb.cyl_z(ox, oy, 0.15, 0.78, 0.10, 6, P['yellow_safety'])
    # 低頂前伸式駕駛艙
    mb.chamfer_box(0, 2.32, 1.36, 1.10, 0.88, 0.58, 0.16, P['tank_white'], top_m=P['mint_cater'])
    mb.box(-0.98, 0.98, 2.75, 3.22, 1.22, 1.80, P['glass_cockpit'])
    mb.box(-0.92, -0.62, 3.15, 3.26, 0.72, 0.96, P['win_warm'])
    mb.box(0.62, 0.92, 3.15, 3.26, 0.72, 0.96, P['win_warm'])
    # X 型剪刀式液壓升降架 (Scissor Lift Struts)
    for sx in (-0.78, 0.78):
        mb.strut((sx, -2.5, 0.82), (sx, 0.9, 1.55), 0.11, P['yellow_safety'])
        mb.strut((sx, 0.9, 0.82), (sx, -2.5, 1.55), 0.11, P['yellow_safety'])
        mb.strut((sx * 0.6, -1.8, 0.82), (sx * 0.6, -0.2, 1.52), 0.09, P['chrome'])
    # 白色保溫冷藏車廂 + 薄荷綠航空空廚塗裝帶 + 冷王壓縮機組 (Thermo King Unit)
    mb.chamfer_box(0, -0.88, 2.38, 1.18, 2.32, 0.96, 0.14, P['tank_white'], side_m=P['tank_white'])
    mb.box(-1.21, 1.21, -3.15, 1.38, 2.15, 2.58, P['mint_cater'])
    mb.box(-1.22, 1.22, -3.12, 1.35, 1.95, 2.08, P['yellow_safety'])
    mb.chamfer_box(0, 1.58, 2.95, 0.68, 0.28, 0.32, 0.08, P['steel_mid'], side_m=P['steel_dark'])
    # 前伸飛機艙門對接平台與安全護欄 (High-loader Docking Bridge)
    mb.box(-0.92, 0.92, 1.38, 2.95, 2.08, 2.32, P['steel_light'])
    mb.box(-0.96, -0.84, 1.42, 2.90, 2.32, 2.82, P['yellow_safety'])
    mb.box(0.84, 0.96, 1.42, 2.90, 2.32, 2.82, P['yellow_safety'])
    mb.box(-0.72, 0.72, 2.82, 3.05, 2.12, 3.12, P['steel_dark'])
    mb.cyl_z(0, 1.15, 3.34, 3.55, 0.16, 8, P['beacon'])
    for wy in [-2.15, 2.20]:
        mb.cyl_x(-1.26, -0.90, wy, 0.46, 0.46, 12, P['tire'])
        mb.cyl_x(0.90, 1.26, wy, 0.46, 0.46, 12, P['tire'])
        mb.cyl_x(-1.28, 1.28, wy, 0.46, 0.20, 8, P['chrome'])
    return mb.build('CateringTruck', location=(0, 0, 0))


def build_cleaning_van(P):
    """高細節客艙清潔與航勤服務車（CleaningVan，面向 +Y）。"""
    mb = MeshBuilder()
    mb.box(-1.02, 1.02, -2.25, 2.25, 0.38, 0.68, P['steel_dark'])
    mb.chamfer_box(0, -0.15, 1.22, 1.02, 2.18, 0.76, 0.18, P['tank_white'])
    mb.box(-1.05, 1.05, -2.18, 2.02, 0.96, 1.36, P['livery_cobalt'])
    mb.box(-1.06, 1.06, -2.15, 2.00, 0.82, 0.94, P['yellow_safety'])
    mb.box(-0.92, 0.92, 1.52, 2.24, 1.22, 1.78, P['glass_cockpit'])
    # 車頂行李架、清潔水箱與雙警示燈
    mb.chamfer_box(0, -0.35, 2.08, 0.72, 1.35, 0.14, 0.08, P['steel_light'], side_m=P['steel_mid'])
    mb.cyl_z(-0.42, 1.35, 1.98, 2.18, 0.14, 8, P['beacon'])
    mb.cyl_z(0.42, 1.35, 1.98, 2.18, 0.14, 8, P['beacon'])
    for wy in [-1.42, 1.42]:
        mb.cyl_x(-1.12, -0.80, wy, 0.38, 0.38, 12, P['tire'])
        mb.cyl_x(0.80, 1.12, wy, 0.38, 0.38, 12, P['tire'])
        mb.cyl_x(-1.14, 1.14, wy, 0.38, 0.18, 8, P['chrome'])
    return mb.build('CleaningVan', location=(0, 0, 0))


def build_pushback_tug(P):
    """高細節重型無桿式飛機後推車（PushbackTug，面向 +Y，含升降駕駛艙、防撞配重塊與鼻輪抱具）。"""
    mb = MeshBuilder()
    # 寬體低重心重型鋼製車體
    mb.chamfer_box(0, 0, 0.68, 1.42, 2.35, 0.40, 0.26, P['tank_white'], top_m=P['yellow_safety'])
    # 前後橘紅防撞重型配重保險桿
    mb.chamfer_box(0, 2.15, 0.62, 1.46, 0.32, 0.36, 0.12, P['livery_coral'])
    mb.chamfer_box(0, -2.15, 0.62, 1.46, 0.32, 0.36, 0.12, P['livery_coral'])
    # 前方鼻輪抱具平台 (Towbarless Cradle)
    mb.box(-0.75, 0.75, 2.35, 3.15, 0.25, 0.48, P['steel_dark'], top_m=P['yellow_safety'])
    # 全景玻璃升降駕駛艙
    mb.chamfer_box(0, 0.62, 1.36, 0.96, 0.84, 0.38, 0.16, P['glass_cockpit'], top_m=P['tank_white'])
    mb.cyl_z(-0.45, 0.62, 1.74, 1.95, 0.15, 8, P['beacon'])
    mb.cyl_z(0.45, 0.62, 1.74, 1.95, 0.15, 8, P['beacon'])
    # 4 顆巨型工程防滑輪胎
    for wy in [-1.38, 1.38]:
        mb.cyl_x(-1.56, -1.10, wy, 0.54, 0.54, 12, P['tire'])
        mb.cyl_x(1.10, 1.56, wy, 0.54, 0.54, 12, P['tire'])
        mb.cyl_x(-1.58, 1.58, wy, 0.54, 0.25, 8, P['yellow_safety'])
    return mb.build('PushbackTug', location=(0, 0, 0))


def build_fuel_tank_farm(P):
    """高細節航空油槽區（FuelTankFarm：3 座大型 JET A-1 儲油槽、盤旋檢修階梯、頂部連通橋、輸油管閥群與雙車位灌裝島）。"""
    mb = MeshBuilder()
    # 混凝土防溢底座與四周安全圍堰
    mb.chamfer_box(0, 0, 0.25, 14.8, 9.8, 0.25, 0.8, P['stone_dark'], top_m=P['stone'])
    mb.box(-14.4, 14.4, -9.4, -8.8, 0.5, 1.45, P['stone_dark'], top_m=P['yellow_safety'])
    mb.box(-14.4, 14.4, 8.8, 9.4, 0.5, 1.45, P['stone_dark'])
    mb.box(-14.4, -13.8, -9.4, 9.4, 0.5, 1.45, P['stone_dark'])
    mb.box(13.8, 14.4, -9.4, 9.4, 0.5, 1.45, P['stone_dark'])

    tank_xs = [-8.4, 0.0, 8.4]
    for tx in tank_xs:
        # 儲油槽主圓筒
        mb.cyl_z(tx, 1.4, 0.5, 7.4, 3.40, 20, P['tank_white'], side_m=P['tank_white'])
        # 藍／橘／紅危險品安全識別環帶
        mb.cyl_z(tx, 1.4, 4.5, 5.5, 3.45, 20, P['tank_band'], side_m=P['tank_band'])
        mb.cyl_z(tx, 1.4, 5.5, 5.95, 3.46, 20, P['orange_fuel'], side_m=P['orange_fuel'])
        # 外側盤旋檢修階梯 (Spiral Staircase Steps around tank)
        for st in range(12):
            ang = -math.pi * 0.65 + st * 0.22
            sx = tx + 3.62 * math.cos(ang)
            sy = 1.4 + 3.62 * math.sin(ang)
            sz = 0.8 + st * 0.55
            mb.box(sx - 0.28, sx + 0.28, sy - 0.28, sy + 0.28, sz, sz + 0.14, P['steel_mid'])
        # 錐形槽頂與安全護欄環
        mb.cone_z(tx, 1.4, 7.4, 8.8, 3.50, 0.35, 20, P['steel_light'])
        mb.cyl_z(tx, 1.4, 7.4, 7.95, 3.52, 16, P['yellow_safety'], cap0=False, cap1=False)
        # 頂部呼吸閥與防撞紅燈
        mb.cyl_z(tx, 1.4, 8.7, 9.45, 0.32, 10, P['chrome'])
        mb.cyl_z(tx, 1.4, 9.45, 9.72, 0.18, 8, P['nav_red'])

    # 槽頂連通空橋步道與護欄
    mb.box(-8.8, 8.8, 0.9, 1.9, 7.42, 7.68, P['steel_mid'])
    mb.box(-8.8, 8.8, 0.82, 0.92, 7.68, 8.22, P['yellow_safety'])
    mb.box(-8.8, 8.8, 1.88, 1.98, 7.68, 8.22, P['yellow_safety'])

    # 地面雙排不鏽鋼輸油管廊與紅閥門 (Fuel Pipeline Manifold)
    for pz in [0.95, 1.45]:
        mb.cyl_x(-11.5, 11.5, -3.2, pz, 0.18, 8, P['chrome'])
    for vx in [-8.4, -4.2, 0.0, 4.2, 8.4]:
        mb.cyl_z(vx, -3.2, 0.5, 1.75, 0.22, 8, P['livery_coral'])

    # 前方加油車灌裝棚島 (Fuel Loading Gantry at y = -5.8)
    mb.chamfer_box(0, -5.8, 0.45, 7.2, 2.4, 0.20, 0.35, P['stone_dark'], top_m=P['yellow_safety'])
    mb.chamfer_box(0, -5.8, 4.05, 6.8, 2.3, 0.25, 0.35, P['steel_light'], top_m=P['orange_fuel'])
    for gx in [-5.2, 0.0, 5.2]:
        mb.cyl_z(gx, -5.8, 0.65, 3.9, 0.24, 8, P['steel_mid'])
        # 灌裝計量機與黑色輸油懸臂
        mb.chamfer_box(gx, -5.8, 1.35, 0.48, 0.38, 0.65, 0.08, P['orange_fuel'], side_m=P['tank_white'])
        mb.strut((gx, -5.8, 3.6), (gx + 1.2, -6.8, 2.6), 0.09, P['steel_dark'])

    return mb.build('FuelTankFarm', location=(0, 0, 0))


def build_gse_depot(P):
    """西側地勤車維修調度棚廠與航空貨櫃站（GSEDepot，放置於 (-69, 0, -25)）。"""
    mb = MeshBuilder()
    # 棚廠混凝土地基
    mb.chamfer_box(0, 0, 0.22, 10.8, 4.8, 0.22, 0.5, P['stone_dark'], top_m=P['stone'])
    # 後牆與側面維修機具隔間
    mb.box(-10.2, 10.2, 2.6, 4.2, 0.4, 4.4, P['stone'], side_m=P['steel_light'])
    # 三座挑高車庫門框與內部暖光工作區
    for bx in [-6.4, 0.0, 6.4]:
        mb.box(bx - 2.3, bx + 2.3, 2.45, 2.65, 0.4, 3.6, P['win_warm'])
        mb.box(bx - 2.5, bx + 2.5, 2.40, 2.70, 3.55, 3.95, P['yellow_safety'])
    # 鋼結構懸挑斜屋頂與太陽能板
    for px in [-9.2, -3.2, 3.2, 9.2]:
        mb.cyl_z(px, -2.2, 0.4, 4.3, 0.24, 8, P['steel_mid'])
        mb.strut((px, -2.2, 3.2), (px, -4.2, 4.45), 0.14, P['steel_light'])
    mb.chamfer_box(0, -0.2, 4.55, 10.6, 4.5, 0.24, 0.4, P['steel_light'], top_m=P['glass_wall'])
    for sx in [-6.4, 0.0, 6.4]:
        mb.box(sx - 2.4, sx + 2.4, -3.2, 2.8, 4.80, 4.92, P['solar_blue'])
    # 旁側堆放的 LD3 航空鋁合金貨櫃 (ULD Containers)
    for ux, umat in [(-8.2, P['chrome']), (-6.2, P['bag_blue']), (8.2, P['orange_fuel'])]:
        mb.chamfer_box(ux, -3.2, 0.95, 0.78, 0.78, 0.55, 0.12, umat)
    return mb.build('GSEDepot', location=(0, 0, 0))


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
    build_terminal_roof_and_radar(P)
    build_jetbridges(P)
    # 4 款不同機身比例、翼展與塗裝的高細節客機
    build_aircraft(P, 'Aircraft_A320', 'livery_teal', 'livery_coral', length_scale=1.00, wing_span=14.2, winglet_style='sharklet')
    build_aircraft(P, 'Aircraft_B738', 'livery_cobalt', 'livery_gold', length_scale=1.04, wing_span=14.4, winglet_style='scimitar')
    build_aircraft(P, 'Aircraft_A321', 'livery_coral', 'livery_gold', length_scale=1.16, wing_span=14.6, winglet_style='sharklet')
    build_aircraft(P, 'Aircraft_E190', 'bag_sage', 'livery_teal', length_scale=0.88, wing_span=12.4, winglet_style='sharklet')
    build_fuel_truck(P)
    build_baggage_tug(P)
    build_catering_truck(P)
    build_cleaning_van(P)
    build_pushback_tug(P)
    build_fuel_tank_farm(P)
    build_gse_depot(P)
    export_all()


if __name__ == '__main__':
    main()
