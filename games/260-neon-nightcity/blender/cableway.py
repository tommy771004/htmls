# 霓虹夜城（260）北嶺纜車：城裡的山下站、線上的塔架、車廂（97-summit.js 擺進北嶺公園，取代原本的 Kit 方塊）
# 執行：/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P blender/cableway.py   → blender/out/cableway.glb，再 npm run build
# 慣例：1 單位 = 1 公尺，Z 朝上。站的局部座標和 97-summit.js 的 CS.f 一樣：+X 往山上（纜索出去的方向）、入口在 −X；Blender 的 Y = 遊戲局部的 −z（站左右對稱）。
#   cw_station：原點在站的地板面（遊戲的 fy）、站中心 (0, 0)；地板以下 1.2 m 的石砌裙邊埋進 Kit 的基座。迴轉輪中心 (3.6, 0, 6.2)，兩條索從輪的兩側 (Y = ±2.5) 往 +X 出去。
#   cw_tower：原點在地面（hillMeshH），鞍座上滑輪的頂在 Z = 28（索擱在上面），基礎往下 2 m。
#   cw_cabin：原點在握索器（索上），車身吊在下面：和山上 97-summit.js 的 cabin() 同一個外形（八角、寬 2.5、深 2.1、頂 −2.75、底 −5.25）。
# 材質名稱帶遊戲的材質代號（50-assets.js 的 matId）：tNN_ 是 07-kitx.js 的程式材質（43 板模清水混凝土、44 直向木格柵、45 洞石、46 層疊板岩、
#   48 落地玻璃（白天映天空、入夜是暖光的室內）、49 簷下天花（崁燈，入夜亮）、34 烤漆鋼、35 鍍鋅鋼），mNN_ 是通用材質（1 玻璃、2 霧面、10 光滑漆面、15 金屬、16 白天暗入夜亮的燈）。
# 顏色是頂點色的底色；細模倒 2.5 cm 斜角、每 2 m 切一刀，Cycles 烘 AO 進頂點色 ao（50-assets.js 的 bakeProp 乘上去）。
import math, os, random, sys
import bmesh, bpy
from mathutils import Vector
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *

reset()
M = {
    'board': mat('t43_board', '#bdb9b0', 0.85, 0.0), 'board_d': mat('t43_board_dark', '#8f8b82', 0.85, 0.0),
    'slat': mat('t44_slat', '#8e5c38', 0.6, 0.0), 'trav': mat('t45_trav', '#d8ccb4', 0.5, 0.0), 'ledge': mat('t46_ledge', '#8f8068', 0.9, 0.0),
    'vglass': mat('t48_vglass', '#ffffff', 0.05, 0.0), 'soffit': mat('t49_soffit', '#7a5a3c', 0.6, 0.0),
    'steel': mat('t34_steel', '#33363b', 0.4, 0.5), 'steel_l': mat('t34_steel_light', '#8a8e92', 0.4, 0.5), 'yellow': mat('t34_steel_yellow', '#d8a418', 0.4, 0.3),
    'galv': mat('t35_galv', '#9a9ea2', 0.5, 0.7), 'glass': mat('m1_glass', '#1c242c', 0.05, 0.0), 'dark': mat('m2_dark', '#26282c', 0.7, 0.0),
    'black': mat('m2_black', '#121214', 0.8, 0.0), 'line': mat('m2_line', '#e8c040', 0.6, 0.0), 'shrub': mat('m2_shrub', '#3d5a2a', 0.9, 0.0),
    'cream': mat('m10_cream', '#e4ddd0', 0.3, 0.0), 'red': mat('m10_red', '#a8261c', 0.3, 0.0),
    'metal': mat('m15_metal', '#5a5e64', 0.35, 0.8), 'lamp': mat('m16_lamp', '#ffc684', 0.4, 0.0, emit='#ffc684'),
    'screen': mat('m16_screen', '#9ccfff', 0.4, 0.0, emit='#9ccfff'),
}


def B(mb, x0, x1, y0, y1, z0, z1, m):
    if x1 - x0 > 1e-4 and y1 - y0 > 1e-4 and z1 - z0 > 1e-4: mb.box(x0, x1, y0, y1, z0, z1, m)


def beam(mb, a, b, h, m, h2=None):   # 兩點之間的方鋼（截面 2h × 2h2）
    a, b = Vector(a), Vector(b); d = (b - a).normalized()
    up = Vector((0, 0, 1)) if abs(d.z) < 0.95 else Vector((1, 0, 0))
    s1 = d.cross(up).normalized() * h; s2 = s1.cross(d).normalized() * (h2 or h)
    v = [p + i * s1 + j * s2 for p in (a, b) for i, j in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
    mb.add(v, [(0, 1, 2, 3), (7, 6, 5, 4), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)], m)


def tube(mb, a, b, r, m, seg=8):   # 圓管
    a, b = Vector(a), Vector(b); d = (b - a).normalized()
    up = Vector((0, 0, 1)) if abs(d.z) < 0.95 else Vector((1, 0, 0))
    s1 = d.cross(up).normalized(); s2 = s1.cross(d).normalized()
    ring = [s1 * math.cos(2 * math.pi * i / seg) * r + s2 * math.sin(2 * math.pi * i / seg) * r for i in range(seg)]
    v = [a + q for q in ring] + [b + q for q in ring]
    mb.add(v, [(i, (i + 1) % seg, seg + (i + 1) % seg, seg + i) for i in range(seg)] + [tuple(reversed(range(seg))), tuple(range(seg, 2 * seg))], m)


def cyl_y(mb, cx, cz, y0, y1, r, segs, m, side_m=None):   # 軸沿 Y 的圓柱（滑輪、車輪）
    ring = [(cx + r * math.cos(2 * math.pi * i / segs), cz + r * math.sin(2 * math.pi * i / segs)) for i in range(segs)]
    v = [(x, y0, z) for x, z in ring] + [(x, y1, z) for x, z in ring]
    f = [(i, (i + 1) % segs, segs + (i + 1) % segs, segs + i) for i in range(segs)]
    mb.add(v, f + [tuple(range(segs)), tuple(reversed(range(segs, 2 * segs)))], [side_m or m] * segs + [m, m])


def ring_z(mb, cx, cy, z0, z1, r0, r1, segs, m):   # 水平的圓環（迴轉輪的輪緣）
    pts = lambda r, z: [(cx + r * math.cos(2 * math.pi * i / segs), cy + r * math.sin(2 * math.pi * i / segs), z) for i in range(segs)]
    v = pts(r0, z0) + pts(r1, z0) + pts(r1, z1) + pts(r0, z1)
    f = []
    for k in range(4):
        a, b = k * segs, ((k + 1) % 4) * segs
        f += [(a + i, a + (i + 1) % segs, b + (i + 1) % segs, b + i) for i in range(segs)]
    mb.add(v, f, m)


def leafy(mb, x, y, z, r, m, seed, sub=2, squash=0.8):   # 灌木：細分的二十面體、表面照亂數起伏
    rnd = random.Random(seed); bm = bmesh.new(); bmesh.ops.create_icosphere(bm, subdivisions=sub, radius=r)
    bm.verts.index_update()
    for v in bm.verts:
        k = 0.82 + 0.36 * rnd.random(); v.co.x *= k; v.co.y *= k; v.co.z *= k * squash
    vs = [(x + v.co.x, y + v.co.y, z + v.co.z) for v in bm.verts]; fs = [tuple(v.index for v in f.verts) for f in bm.faces]; bm.free()
    mb.add(vs, fs, m)


def slab(mb, prof, y0, y1, th, m_top, m_bot, m_edge):
    """沿 X 折的厚板（屋頂）：prof = [(x, z下緣), …]，寬 y0..y1、厚 th。上面 m_top、下面 m_bot、四周 m_edge。"""
    n = len(prof)
    for k in range(n - 1):
        (xa, za), (xb, zb) = prof[k], prof[k + 1]
        lo = [(xa, y0, za), (xb, y0, zb), (xb, y1, zb), (xa, y1, za)]
        hi = [(x, y, z + th) for x, y, z in lo]
        mb.add(lo + hi, [(3, 2, 1, 0), (4, 5, 6, 7), (0, 1, 5, 4), (2, 3, 7, 6)], [m_bot, m_top, m_edge, m_edge])
    (xa, za), (xb, zb) = prof[0], prof[-1]
    mb.add([(xa, y0, za), (xa, y1, za), (xa, y1, za + th), (xa, y0, za + th)], [(0, 1, 2, 3)], m_edge)
    mb.add([(xb, y0, zb), (xb, y1, zb), (xb, y1, zb + th), (xb, y0, zb + th)], [(3, 2, 1, 0)], m_edge)


def roof_z(x, prof):   # 屋頂下緣在 x 的高度
    for (xa, za), (xb, zb) in zip(prof, prof[1:]):
        if xa <= x <= xb: return za + (zb - za) * (x - xa) / (xb - xa)
    return prof[-1][1]


# ─── 山下站 ───
XF, XB, HW = -9.2, 7.2, 5.5          # 正面、後牆、半寬
ROOF = [(-12.0, 6.5), (0.4, 6.95), (7.7, 8.45)]   # 屋頂下緣：入口雨遮往外伸 2.8 m，往山上那段翹起
WX, WZ, WR = 3.6, 6.2, 2.5          # 迴轉輪


def station():
    mb = MB(11)
    # 地板（洞石）與石砌裙邊
    B(mb, XF, XB, -HW + 0.2, HW - 0.2, -0.25, 0.0, M['trav'])
    B(mb, XF - 0.1, XB + 0.3, -HW - 0.15, HW + 0.15, -1.2, -0.25, M['ledge'])
    # 兩側：清水混凝土矮牆＋落地玻璃（48）＋直向木鰭；上下框是烤漆鋼
    for s in (-1, 1):
        y0, y1 = (HW - 0.3, HW + 0.05) if s > 0 else (-HW - 0.05, -HW + 0.3)
        B(mb, XF, XB, y0, y1, 0.0, 0.9, M['board'])
        B(mb, XF, XB, y0 - 0.02, y1 + 0.02, 0.9, 0.96, M['steel'])
        yg = s * (HW - 0.12)
        for i in range(11):
            xa, xb = XF + 0.25 + i * 1.47, XF + 0.25 + (i + 1) * 1.47 - 0.12
            zt = roof_z((xa + xb) / 2, ROOF) - 0.05
            B(mb, xa, xb, yg - 0.025, yg + 0.025, 0.96, zt, M['vglass'])
        for i in range(12):
            x = XF + 0.19 + i * 1.47
            zt = roof_z(x, ROOF)
            yo = s * (HW + 0.05)
            B(mb, x - 0.06, x + 0.06, min(yg, yo + s * 0.32), max(yg, yo + s * 0.32), 0.9, zt, M['slat'])   # 木鰭往外凸 32 cm
        B(mb, XF + 0.2, XB - 0.4, yg - 0.05, yg + 0.05, 3.1, 3.18, M['steel'])   # 中間的橫框
    # 後牆（山那側）：清水混凝土，上半中間開一個口讓纜索出去，口上是鋼梁
    zb = roof_z(XB, ROOF)
    for y0, y1 in ((-HW, -3.2), (3.2, HW)): B(mb, XB - 0.4, XB + 0.1, y0, y1, 0.0, zb + 0.1, M['board'])
    B(mb, XB - 0.4, XB + 0.1, -3.2, 3.2, 0.0, 4.4, M['board'])
    B(mb, XB - 0.45, XB + 0.15, -3.3, 3.3, 7.65, zb + 0.1, M['steel'])
    for s in (-1, 1): B(mb, XB - 0.45, XB + 0.15, s * 3.2 - 0.12, s * 3.2 + 0.12, 4.4, 7.65, M['steel'])
    # 屋頂：折板，上面是直立鎖縫的金屬板（每 0.55 m 一道縫肋）、下面是木格天花（49，崁燈）、四周鋼封邊
    slab(mb, ROOF, -HW - 0.6, HW + 0.6, 0.42, M['steel_l'], M['soffit'], M['steel'])
    for k in range(-11, 12):
        y = k * 0.55
        for (xa, za), (xb, zb2) in zip(ROOF, ROOF[1:]): beam(mb, (xa + 0.05, y, za + 0.45), (xb - 0.05, y, zb2 + 0.45), 0.018, M['steel_l'], 0.03)
    for (xa, za), (xb, zb2) in zip(ROOF, ROOF[1:]):   # 封邊下面一條燈（入夜亮）
        for s in (-1, 1): beam(mb, (xa, s * (HW + 0.62), za - 0.03), (xb, s * (HW + 0.62), zb2 - 0.03), 0.02, M['lamp'])
    B(mb, ROOF[0][0] - 0.05, ROOF[0][0] + 0.02, -HW - 0.6, HW + 0.6, ROOF[0][1] - 0.04, ROOF[0][1] - 0.0, M['lamp'])
    # 正面：中間 3.6 m 寬的門口（兩扇玻璃拉門推開、停在兩側玻璃後），兩側落地玻璃與木鰭，門上一段氣窗與招牌的背板
    zf = roof_z(XF, ROOF)
    for s in (-1, 1):
        for i in range(2):
            ya, yb = sorted((s * (1.9 + i * 1.75), s * (1.9 + (i + 1) * 1.75 - 0.08)))
            B(mb, XF - 0.03, XF + 0.03, ya, yb, 0.0, zf - 0.05, M['vglass'])
        for y in (s * 1.84, s * 3.61, s * 5.3): B(mb, XF - 0.25, XF + 0.06, y - 0.06, y + 0.06, 0.0, zf, M['slat'])
        B(mb, XF + 0.12, XF + 0.16, *sorted((s * 1.95, s * 3.7)), 0.02, 3.0, M['glass'])   # 推開的拉門
        B(mb, XF + 0.1, XF + 0.18, *sorted((s * 1.9, s * 3.75)), 2.98, 3.08, M['steel'])
    B(mb, XF - 0.06, XF + 0.06, -1.9, 1.9, 3.08, 3.22, M['steel'])          # 門楣
    B(mb, XF - 0.03, XF + 0.03, -1.84, 1.84, 3.22, zf - 0.05, M['vglass'])
    B(mb, XF - 0.12, XF - 0.06, -3.15, 3.15, 3.35, 4.8, M['steel'])         # 招牌的背板（字是遊戲裡的 v5Sign）
    B(mb, XF - 0.2, XF + 0.0, -1.85, 1.85, -0.02, 0.01, M['black'])        # 門口的刮泥墊
    # 室內：驗票閘門（4 道）、售票機、長椅、月台黃線與止滑條、吊燈
    for y in (-2.4, -0.8, 0.8, 2.4):
        B(mb, -7.25, -6.35, y - 0.13, y + 0.13, 0.0, 1.0, M['steel'])
        B(mb, -7.2, -6.4, y - 0.14, y + 0.14, 1.0, 1.04, M['metal'])
        B(mb, -6.95, -6.85, y - 0.15, y + 0.15, 1.04, 1.1, M['lamp'])        # 綠／白的指示燈（燈色在遊戲裡）
        for sd in (-1, 1): B(mb, -6.85, -6.8, y + sd * 0.13, y + sd * 0.5, 0.55, 0.95, M['glass'])   # 閘門的玻璃翼
    for s in (-1, 1):
        B(mb, -8.4, -7.6, s * 4.45 - 0.3, s * 4.45 + 0.3, 0.0, 1.75, M['steel'])   # 售票機
        B(mb, -8.45, -8.4, s * 4.45 - 0.22, s * 4.45 + 0.22, 1.0, 1.55, M['screen'])
        B(mb, -8.43, -8.4, s * 4.45 - 0.12, s * 4.45 + 0.12, 0.75, 0.9, M['black'])
        for x0 in (-4.6, -1.4):   # 靠牆的長椅：木條座面、鋼腳
            for k in range(5): ya = s * 4.62 - 0.21 + k * 0.09; B(mb, x0, x0 + 2.6, ya, ya + 0.07, 0.42, 0.47, M['slat'])
            for x in (x0 + 0.25, x0 + 2.35): B(mb, x - 0.04, x + 0.04, s * 4.62 - 0.2, s * 4.62 + 0.2, 0.0, 0.42, M['steel'])
        B(mb, -5.6, XB - 0.5, s * 3.45 - 0.06, s * 3.45 + 0.06, 0.0, 0.006, M['line'])   # 月台的黃線
        B(mb, -5.6, XB - 0.5, s * 1.55 - 0.06, s * 1.55 + 0.06, 0.0, 0.006, M['line'])
        for k in range(30): x = -5.4 + k * 0.4; B(mb, x, x + 0.25, s * 3.2 - 0.12, s * 3.2 + 0.12, 0.0, 0.008, M['black'])
    for y in (-3.0, 0.0, 3.0):   # 吊燈：細桿吊下來的長燈條
        B(mb, -8.2, -1.2, y - 0.08, y + 0.08, 4.9, 5.0, M['steel']); B(mb, -8.15, -1.25, y - 0.05, y + 0.05, 4.86, 4.9, M['lamp'])
        for x in (-7.6, -1.8): tube(mb, (x, y, 5.0), (x, y, roof_z(x, ROOF)), 0.012, M['steel'], 4)
    # 迴轉輪：輪緣、8 根輪輻、輪轂、往上的軸與齒輪箱（黃）、馬達，吊在兩道門型鋼架下；索從輪兩側往 +X 出去
    ring_z(mb, WX, 0, WZ - 0.16, WZ + 0.16, WR - 0.28, WR + 0.08, 64, M['steel'])
    for k in range(8):
        a = k / 8 * 2 * math.pi
        beam(mb, (WX, 0, WZ), (WX + math.cos(a) * (WR - 0.25), math.sin(a) * (WR - 0.25), WZ), 0.06, M['steel'], 0.1)
    mb.cyl_z(WX, 0, WZ - 0.25, WZ + 0.25, 0.42, 20, M['metal'])
    mb.cyl_z(WX, 0, WZ + 0.25, WZ + 0.9, 0.16, 12, M['metal'])
    mb.cyl_z(WX, 0, WZ + 0.9, WZ + 1.45, 0.75, 24, M['yellow'])
    B(mb, WX + 0.6, WX + 1.9, -0.45, 0.45, WZ + 0.95, WZ + 1.75, M['yellow'])
    mb.cyl_z(WX + 2.3, 0, WZ + 1.0, WZ + 1.7, 0.36, 16, M['steel'])   # 馬達（橫放的圓柱看起來像，簡化成直立）
    for x in (WX - 2.2, WX + 2.4):   # 門型鋼架（兩根柱到地、上面橫梁接屋頂）
        zr = roof_z(x, ROOF)
        for s in (-1, 1): B(mb, x - 0.15, x + 0.15, s * 4.7 - 0.15, s * 4.7 + 0.15, 0.0, zr, M['steel'])
        B(mb, x - 0.18, x + 0.18, -4.85, 4.85, WZ + 1.75, WZ + 2.1, M['steel'])
    beam(mb, (WX - 2.2, 0, WZ + 1.8), (WX + 2.4, 0, WZ + 1.8), 0.12, M['steel'], 0.18)
    for s in (-1, 1):   # 輪下的護欄（黃黑）圍住機械
        for k in range(9):
            a = (k - 4) / 8 * math.pi * 0.9 + (0 if s > 0 else math.pi)
            x, y = WX + math.cos(a) * 3.1, math.sin(a) * 3.1
            tube(mb, (x, y, 0.0), (x, y, 1.05), 0.03, M['yellow'], 6)
    # 室外：門口兩側的花台（板模混凝土＋灌木）、長椅、垃圾桶、指示牌、雨水管、地面燈柱
    for s in (-1, 1):
        B(mb, XF - 2.6, XF - 1.0, s * 4.3 - 0.7, s * 4.3 + 0.7, 0.0, 0.55, M['board'])
        for k in range(4): leafy(mb, XF - 2.25 + (k % 2) * 0.7, s * 4.3 + (k // 2 - 0.5) * 0.65, 0.75, 0.42, M['shrub'], 30 + k + (s > 0) * 10)
        tube(mb, (XB + 0.15, s * (HW + 0.25), -1.0), (XB + 0.15, s * (HW + 0.25), roof_z(XB, ROOF) + 0.3), 0.06, M['steel'], 8)
        B(mb, XF - 2.9, XF - 2.75, s * 2.95 - 0.08, s * 2.95 + 0.08, 0.0, 0.95, M['steel'])   # 燈柱
        B(mb, XF - 2.92, XF - 2.73, s * 2.95 - 0.1, s * 2.95 + 0.1, 0.7, 0.9, M['lamp'])
    for k in range(5): B(mb, XF - 0.55 - 0.42, XF - 0.55 + 0.42, -HW + 0.9 + k * 0.1, -HW + 0.97 + k * 0.1, 0.42, 0.47, M['slat'])   # 牆邊的戶外長椅（入口左邊）
    mb.cyl_z(XF - 0.55, HW - 1.0, 0.0, 0.85, 0.24, 14, M['steel'])   # 垃圾桶
    B(mb, XF - 0.58, XF - 0.52, -HW + 0.1, -HW + 0.4, 0.0, 2.0, M['steel'])   # 步道指示牌的立柱與牌面（入口右邊）
    B(mb, XF - 0.62, XF - 0.56, -HW - 0.4, -HW + 0.9, 1.1, 2.0, M['slat'])
    return mb.build('cw_station')


# ─── 塔架：四根往上收的鍍鋅角鋼柱、每 2.6 m 一圈橫材與交叉斜撐、內側的爬梯；頂上橫擔與兩組 6 輪的鞍座、維修走道 ───
TOP = 28.0


def tower():
    mb = MB(21)
    B(mb, -1.9, 1.9, -1.9, 1.9, -2.0, 0.25, M['board'])
    B(mb, -1.75, 1.75, -1.75, 1.75, 0.25, 0.35, M['board_d'])
    zt = TOP - 1.6
    leg = lambda sx, sy, z: (sx * (1.35 - 0.88 * z / zt), sy * (1.35 - 0.88 * z / zt), z)
    for sx in (-1, 1):
        for sy in (-1, 1):
            beam(mb, leg(sx, sy, 0.3), leg(sx, sy, zt), 0.09, M['galv'])
            B(mb, sx * 1.35 - 0.25, sx * 1.35 + 0.25, sy * 1.35 - 0.25, sy * 1.35 + 0.25, 0.3, 0.42, M['steel'])   # 底板
    zs = [0.4 + k * 2.6 for k in range(int((zt - 0.4) / 2.6) + 1)]
    for a, b in zip(zs, zs[1:] + [zt]):
        for (sx0, sy0), (sx1, sy1) in (((-1, -1), (1, -1)), ((1, -1), (1, 1)), ((1, 1), (-1, 1)), ((-1, 1), (-1, -1))):
            beam(mb, leg(sx0, sy0, a), leg(sx1, sy1, a), 0.04, M['galv'])
            beam(mb, leg(sx0, sy0, a), leg(sx1, sy1, b), 0.03, M['galv'])
            beam(mb, leg(sx1, sy1, a), leg(sx0, sy0, b), 0.03, M['galv'])
    for k in range(int((zt - 1) / 0.3)):   # 爬梯（−X 面的中間）
        z = 1.0 + k * 0.3; x = -(1.35 - 0.88 * z / zt) + 0.18
        beam(mb, (x, -0.22, z), (x, 0.22, z), 0.012, M['galv'])
    for y in (-0.22, 0.22): beam(mb, (-(1.35 - 0.88 * 1.0 / zt) + 0.18, y, 1.0), (-(1.35 - 0.88) + 0.18, y, zt), 0.02, M['galv'])
    # 橫擔（沿 Y）、兩側的鞍座：每組一根搖臂、6 顆滑輪（頂在 Z = TOP）
    B(mb, -0.35, 0.35, -3.5, 3.5, zt, zt + 0.5, M['steel'])
    for s in (-1, 1):
        y = s * 2.5
        B(mb, -0.2, 0.2, y - 0.2, y + 0.2, zt + 0.5, TOP - 0.55, M['steel'])
        B(mb, -1.7, 1.7, y - 0.16, y + 0.16, TOP - 0.62, TOP - 0.45, M['yellow'])
        for k in range(6):
            x = -1.45 + k * 0.58
            cyl_y(mb, x, TOP - 0.22, y - 0.07, y + 0.07, 0.22, 16, M['black'], M['black'])
            cyl_y(mb, x, TOP - 0.22, y - 0.1, y + 0.1, 0.06, 8, M['metal'])
    # 維修走道（+X 側）：格柵板、欄杆
    B(mb, 0.35, 1.35, -3.4, 3.4, zt + 0.4, zt + 0.45, M['steel'])
    for y in (-3.4, -1.7, 0.0, 1.7, 3.4): tube(mb, (1.33, y, zt + 0.45), (1.33, y, zt + 1.5), 0.025, M['yellow'], 6)
    for z in (zt + 1.0, zt + 1.5): tube(mb, (1.33, -3.4, z), (1.33, 3.4, z), 0.025, M['yellow'], 6)
    tube(mb, (0, 0, zt + 0.5), (0, 0, TOP + 1.6), 0.025, M['galv'], 6)   # 避雷針
    B(mb, -0.02, 0.02, -0.5, 0.5, 5.0, 5.6, M['red'])   # 塔號牌（紅底）
    return mb.build('cw_tower')


# ─── 車廂：八角（和山上的 cabin() 同尺寸），米白烤漆、窗帶、腰線的燈、車頂斜邊、吊臂、握索器與滑輪 ───
def cabin():
    mb = MB(31)
    Wc, Dc, ch, top, bot = 1.25, 1.05, 0.38, -2.75, -5.25
    P = [(Wc, Dc - ch), (Wc - ch, Dc), (-Wc + ch, Dc), (-Wc, Dc - ch), (-Wc, -Dc + ch), (-Wc + ch, -Dc), (Wc - ch, -Dc), (Wc, -Dc + ch)]
    inset = lambda k: [(x * k, y * k) for x, y in P]
    mb.prism(inset(0.86), bot - 0.12, bot, M['cream'])
    mb.prism(P, bot, bot + 1.02, M['cream'])
    mb.prism(inset(1.008), bot + 1.02, bot + 1.07, M['lamp'], cap0=False, cap1=False)
    mb.prism(inset(0.985), bot + 1.07, top - 0.3, M['glass'], cap0=False, cap1=False)
    for x, y in P: B(mb, x - 0.05, x + 0.05, y - 0.05, y + 0.05, bot + 1.07, top - 0.3, M['cream'])   # 窗框（八角的角柱）
    mb.prism(P, top - 0.3, top, M['cream'])
    mb.prism(inset(0.68), top, top + 0.22, M['cream'])
    v0 = len(mb.v)   # 車頂斜邊：外圈到內圈的斜面
    mb.add([(x, y, top) for x, y in P] + [(x * 0.68, y * 0.68, top + 0.22) for x, y in P], [(i, (i + 1) % 8, 8 + (i + 1) % 8, 8 + i) for i in range(8)], M['cream'])
    B(mb, -0.55, 0.55, -Dc - 0.01, -Dc + 0.01, bot + 0.05, top - 0.35, M['dark'])   # 車門的縫（−Y 側）
    B(mb, -0.02, 0.02, -Dc - 0.03, -Dc, bot + 0.05, top - 0.35, M['dark'])
    B(mb, -0.5, 0.5, -Dc - 0.02, -Dc + 0.0, bot + 0.6, bot + 0.75, M['metal'])   # 門下的踏板
    B(mb, -0.2, 0.2, Dc - 0.01, Dc + 0.02, bot + 0.55, bot + 0.8, M['red'])     # 車號牌
    tube(mb, (0, 0, top + 0.2), (0, 0, -1.1), 0.07, M['dark'], 10)
    tube(mb, (0, 0, -1.1), (0.25, 0, -0.28), 0.07, M['dark'], 10)
    B(mb, 0.0, 0.5, -0.12, 0.12, -0.26, 0.02, M['dark'])
    for x in (-0.12, 0.62): cyl_y(mb, x, 0.02, -0.16, 0.16, 0.13, 14, M['metal'])
    return mb.build('cw_cabin')


STEP = 2.0


def finish(o):   # 倒 2.5 cm 斜角、每 2 m 切一刀（烘 AO 的頂點色解析度）
    bm = bmesh.new(); bm.from_mesh(o.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    sharp = [e for e in bm.edges if len(e.link_faces) == 2 and e.calc_face_angle(0) > 0.49]
    bmesh.ops.bevel(bm, geom=sharp, offset=0.02, offset_type='OFFSET', segments=1, profile=0.5, affect='EDGES', clamp_overlap=True)
    lo = [min(v.co[k] for v in bm.verts) for k in range(3)]; hi = [max(v.co[k] for v in bm.verts) for k in range(3)]
    for k in range(3):
        c = math.floor(lo[k] / STEP) * STEP + STEP
        while c < hi[k]:
            co = [0.0, 0.0, 0.0]; no = [0.0, 0.0, 0.0]; co[k] = c; no[k] = 1.0
            bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], dist=1e-4, plane_co=co, plane_no=no)
            c += STEP
    bm.to_mesh(o.data); bm.free(); o.data.update()


def bake_ao(o, ground=None):
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = 64
    sc.render.bake.target = 'VERTEX_COLORS'
    if sc.world is None: sc.world = bpy.data.worlds.new('bake')
    sc.world.light_settings.distance = 2.5
    gnd = None
    if ground:
        x0, x1, y0, y1, z = ground
        bpy.ops.mesh.primitive_plane_add(size=1, location=(o.location.x + (x0 + x1) / 2, o.location.y + (y0 + y1) / 2, o.location.z + z))
        gnd = bpy.context.active_object; gnd.scale = (x1 - x0, y1 - y0, 1)
    ca = o.data.color_attributes.new('ao', 'BYTE_COLOR', 'CORNER')
    o.data.color_attributes.active_color = ca; o.data.color_attributes.render_color_index = o.data.color_attributes.active_color_index
    bpy.ops.object.select_all(action='DESELECT'); o.select_set(True); bpy.context.view_layer.objects.active = o
    bpy.ops.object.bake(type='AO')
    if gnd: bpy.data.objects.remove(gnd, do_unlink=True)
    n = len(ca.data); buf = [0.0] * (n * 4); ca.data.foreach_get('color', buf)
    for i in range(n):
        a = 0.3 + 0.7 * max(buf[i * 4], 0.0) ** 0.8; buf[i * 4] = buf[i * 4 + 1] = buf[i * 4 + 2] = a
    ca.data.foreach_set('color', buf)
    print(f'ao  {o.name}  {len(o.data.polygons)} faces')


objs = [(station(), (0, 0, 0), (-14, 9, -7, 7, -0.01)), (tower(), (40, 0, 0), (-4, 4, -4, 4, 0.0)), (cabin(), (60, 0, 0), None)]
for o, loc, gnd in objs: o.location = loc; finish(o)
for o, loc, gnd in objs:
    for p in objs:
        p[0].hide_render = p[0] is not o   # 一次只烘一個（不互相擋光）
    bake_ao(o, gnd)
for o, _, _ in objs: o.hide_render = False
export_glb('cableway.glb', export_vertex_color='ACTIVE')
