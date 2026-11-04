# 霓虹夜城（260）灰鷺角機場的地勤車：加油車、行李輸送帶車、推機車、地面電源車、照明燈塔、客梯車、三角錐、輪擋、空廚車、ULD 拖板（載 LD3 貨櫃）、接駁巴士、風向袋（52-air-gse.js 擺在機位旁）、機場消防車（52-air-fac.js 擺在消防站）、FOD 回收桶與推車式滅火器
# 執行：/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P blender/airgse.py   → blender/out/airgse.glb，再 npm run build
# 慣例：1 單位 = 1 公尺，Z 朝上，車頭朝 +X（遊戲的 +x），原點在地面、車身中心。glTF 匯出後 Blender 的 Y = 遊戲的 −z。
# 材質名稱帶遊戲的材質代號（50-assets.js 的 matId）：t34／t35 是 07-kitx.js 的烤漆鋼、鍍鋅鋼，mNN_ 是通用材質（1 玻璃、2 霧面、10 光滑漆面、15 金屬、16 白天暗入夜亮的燈）。
# 細模倒 2 cm 斜角、每 1 m 切一刀，Cycles 烘 AO 進頂點色（50-assets.js 的 bakeProp 乘上去）。
import math, os, random, sys
import bmesh, bpy
from mathutils import Vector
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *

reset()
M = {
    'yel': mat('m58_gse_yellow', '#d9a21a', 0.35, 0.1), 'white': mat('m58_gse_white', '#d6d6d0', 0.35, 0.0), 'orange': mat('m58_gse_orange', '#d2601c', 0.4, 0.0),
    'blue': mat('m58_gse_blue', '#21405a', 0.35, 0.1), 'red': mat('m58_gse_red', '#a8221a', 0.35, 0.0),
    'tank': mat('m15_tank', '#c3c7cb', 0.3, 0.85), 'metal': mat('m15_metal', '#6a6e74', 0.35, 0.8), 'galv': mat('t35_galv', '#9a9ea2', 0.5, 0.7),
    'steel': mat('t34_steel', '#2e3136', 0.45, 0.5), 'glass': mat('m1_glass', '#1a2028', 0.05, 0.0),
    'black': mat('m2_black', '#141416', 0.85, 0.0), 'rubber': mat('m2_rubber', '#1b1b1d', 0.9, 0.0), 'dark': mat('m2_dark', '#2a2c30', 0.7, 0.0),
    'belt': mat('m2_belt', '#1e1f21', 0.95, 0.0), 'tread': mat('m2_tread', '#4a4c50', 0.8, 0.0), 'refl': mat('m10_refl', '#e8e8e2', 0.2, 0.0),
    'lamp': mat('m16_lamp', '#fff1dc', 0.4, 0.0, emit='#fff1dc'), 'amber': mat('m16_amber', '#ffa020', 0.4, 0.0, emit='#ffa020'),
    'tail': mat('m16_tail', '#ff2a1c', 0.4, 0.0, emit='#ff2a1c'), 'flood': mat('m16_flood', '#fff6e8', 0.3, 0.0, emit='#fff6e8'),
    'panel': mat('m58_gse_panel', '#b9bbb7', 0.45, 0.0), 'alu': mat('m15_alu', '#a9adb1', 0.4, 0.8), 'curtain': mat('m2_curtain', '#34404c', 0.85, 0.0),
    'seat': mat('m2_seat', '#2b3440', 0.8, 0.0), 'grey': mat('m58_gse_grey', '#5c6168', 0.4, 0.1),
}


def B(mb, x0, x1, y0, y1, z0, z1, m):
    if x1 - x0 > 1e-4 and y1 - y0 > 1e-4 and z1 - z0 > 1e-4: mb.box(x0, x1, y0, y1, z0, z1, m)


def beam(mb, a, b, h, m, h2=None):
    a, b = Vector(a), Vector(b); d = (b - a).normalized()
    up = Vector((0, 0, 1)) if abs(d.z) < 0.95 else Vector((1, 0, 0))
    s1 = d.cross(up).normalized() * h; s2 = s1.cross(d).normalized() * (h2 or h)
    v = [p + i * s1 + j * s2 for p in (a, b) for i, j in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
    mb.add(v, [(0, 1, 2, 3), (7, 6, 5, 4), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)], m)


def tube(mb, a, b, r, m, seg=8):
    a, b = Vector(a), Vector(b); d = (b - a).normalized()
    up = Vector((0, 0, 1)) if abs(d.z) < 0.95 else Vector((1, 0, 0))
    s1 = d.cross(up).normalized(); s2 = s1.cross(d).normalized()
    ring = [s1 * math.cos(2 * math.pi * i / seg) * r + s2 * math.sin(2 * math.pi * i / seg) * r for i in range(seg)]
    v = [a + q for q in ring] + [b + q for q in ring]
    mb.add(v, [(i, (i + 1) % seg, seg + (i + 1) % seg, seg + i) for i in range(seg)] + [tuple(reversed(range(seg))), tuple(range(seg, 2 * seg))], m)


def cyl_y(mb, cx, cz, y0, y1, r, segs, m, side_m=None):
    ring = [(cx + r * math.cos(2 * math.pi * i / segs), cz + r * math.sin(2 * math.pi * i / segs)) for i in range(segs)]
    v = [(x, y0, z) for x, z in ring] + [(x, y1, z) for x, z in ring]
    f = [(i, (i + 1) % segs, segs + (i + 1) % segs, segs + i) for i in range(segs)]
    mb.add(v, f + [tuple(range(segs)), tuple(reversed(range(segs, 2 * segs)))], [side_m or m] * segs + [m, m])


def wheel(mb, x, y, r, w, rim=None, side=1):
    """輪胎（胎面有溝）、輪圈、輪轂；side 是輪子在車的哪一側（輪圈朝外）"""
    y0, y1 = (y - w / 2, y + w / 2)
    cyl_y(mb, x, r, y0, y1, r, 24, M['rubber'])
    for k in range(12):   # 胎面的橫溝
        a = 2 * math.pi * k / 12; cx, cz = x + math.cos(a) * r, r + math.sin(a) * r
        beam(mb, (cx, y0 + .02, cz), (cx, y1 - .02, cz), .018, M['black'])
    yo = y1 if side > 0 else y0
    def span(a, b): return (yo + a * side, yo + b * side) if side > 0 else (yo + b * side, yo + a * side)
    cyl_y(mb, x, r, *span(-.01, .02), r * .62, 18, rim or M['galv'])   # 輪圈（比胎壁凸出一點）
    cyl_y(mb, x, r, *span(.02, .06), r * .22, 10, M['metal'])            # 輪轂
    for k in range(6):   # 輪圈螺帽
        a = 2 * math.pi * k / 6; cyl_y(mb, x + math.cos(a) * r * .32, r + math.sin(a) * r * .32, *span(.02, .045), .025, 6, M['metal'])


def hazard(mb, x0, x1, y0, y1, z0, z1, n=6):
    """黃黑相間的保險桿（沿 Y 分段）"""
    for i in range(n):
        a, b = y0 + (y1 - y0) * i / n, y0 + (y1 - y0) * (i + 1) / n
        B(mb, x0, x1, a, b, z0, z1, M['yel'] if i % 2 == 0 else M['black'])


def cab(mb, x0, x1, hw, z0, z1, body, roof=True, beacon=True):
    """平頭駕駛室（卡車式）：前角倒圓的下半車身、往上內收的車窗（tumblehome）、前傾的擋風玻璃、帶斜邊的車頂與遮陽板、
    A／B／C 柱、門縫與門窗框、上車踏階、後照鏡、凹進去的水箱罩、頭燈與方向燈、黑色保險桿、雨刷、車頂的示廓燈與旋轉燈"""
    win0 = z0 + (z1 - z0) * .45; zt = z1 - .16; rake = min(.42, (zt - win0) * .38); ch = min(.22, hw * .18)
    # 下半車身：平面上前角倒斜角
    mb.prism([(x0, -hw), (x1 - ch, -hw), (x1, -hw + ch), (x1, hw - ch), (x1 - ch, hw), (x0, hw)], z0, win0, body)
    # 車窗：底圈與頂圈之間放樣（前面往後傾、兩側往內收）
    bx0, bx1, by = x0 + .03, x1 - .04, hw - .03
    tx0, tx1, ty = x0 + .07, x1 - .04 - rake, hw - .13
    v = [(bx0, -by, win0), (bx1, -by, win0), (bx1, by, win0), (bx0, by, win0), (tx0, -ty, zt), (tx1, -ty, zt), (tx1, ty, zt), (tx0, ty, zt)]
    mb.add(v, [(0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)], M['glass'])
    def lerp(p, q, t): return tuple(p[i] + (q[i] - p[i]) * t for i in range(3))
    for k in range(4): beam(mb, v[k], v[k + 4], .045, body)                                   # A 柱與 C 柱
    for s in (-1, 1):                                                                          # B 柱
        xm = (x0 + x1) / 2 - .05
        beam(mb, (xm, s * by, win0), (xm, s * ty, zt), .04, body)
    B(mb, bx1 - .06, x1 + .005, -hw + ch, hw - ch, win0 - .02, win0 + .06, body)              # 擋風玻璃下的飾條
    # 車頂：比頂圈大一點、四邊斜切；前面一道深色遮陽板
    if roof:
        rx0, rx1, ry = tx0 - .05, tx1 + .07, ty + .06
        rv = [(rx0, -ry, zt), (rx1, -ry, zt), (rx1, ry, zt), (rx0, ry, zt), (rx0 + .06, -ry + .06, z1), (rx1 - .08, -ry + .06, z1), (rx1 - .08, ry - .06, z1), (rx0 + .06, ry - .06, z1)]
        mb.add(rv, [(0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7), (4, 5, 6, 7), (3, 2, 1, 0)], body)
        mb.add([(rx1, -ry + .04, zt + .02), (rx1 + .14, -ry + .04, zt - .04), (rx1 + .14, ry - .04, zt - .04), (rx1, ry - .04, zt + .02),
                (rx1, -ry + .04, zt + .05), (rx1 + .14, -ry + .04, zt - .01), (rx1 + .14, ry - .04, zt - .01), (rx1, ry - .04, zt + .05)],
               [(0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7), (4, 5, 6, 7), (3, 2, 1, 0)], M['dark'])
        for y in (-.35, 0, .35): B(mb, rx1 - .14, rx1 - .04, y - .06, y + .06, z1 - .01, z1 + .04, M['amber'])   # 示廓燈
    # 雨刷
    for y in (-hw * .45, hw * .15):
        p0 = (bx1 + .02, y, win0 + .08); p1 = lerp((bx1, y, win0), (tx1, y + hw * .3, zt), .55)
        beam(mb, p0, (p1[0] + .02, p1[1], p1[2]), .012, M['black'])
    for s in (-1, 1):
        dx0, dx1 = (x0 + x1) / 2 - .02, x1 - ch - .1
        yy = s * hw
        for xx in (dx0, dx1): B(mb, xx - .012, xx + .012, yy - .008, yy + .008, z0 + .12, win0, M['dark'])   # 門縫（前後）
        B(mb, dx0, dx1, yy - .008, yy + .008, z0 + .12, z0 + .14, M['dark'])                                    # 門縫（下）
        B(mb, dx1 - .32, dx1 - .18, s * (hw + .005), s * (hw + .022), win0 - .22, win0 - .17, M['metal'])    # 門把
        for i in range(2): B(mb, dx0 + .32, dx1 - .1, s * (hw + .02) - .1, s * (hw + .02) + .1, z0 - .35 + i * .22, z0 - .31 + i * .22, M['tread'])   # 踏階（避開前輪）
        B(mb, dx0 + .32, dx0 + .36, s * (hw + .02) - .1, s * (hw + .02) + .1, z0 - .35, z0, M['dark'])
        beam(mb, (x1 - .3, s * hw, win0 + .25), (x1 - .1, s * (hw + .3), win0 + .4), .02, M['dark'])        # 後照鏡支臂
        B(mb, x1 - .16, x1 - .06, s * (hw + .26) - .06, s * (hw + .26) + .06, win0 + .15, win0 + .55, M['dark'])
        B(mb, x1 - .175, x1 - .155, s * (hw + .26) - .05, s * (hw + .26) + .05, win0 + .17, win0 + .53, M['glass'])
        B(mb, x1 - .01, x1 + .03, s * (hw - ch - .25) - .17, s * (hw - ch - .25) + .17, z0 + .3, z0 + .5, M['dark'])   # 頭燈座
        B(mb, x1 + .02, x1 + .035, s * (hw - ch - .25) - .14, s * (hw - ch - .25) + .14, z0 + .32, z0 + .48, M['lamp'])
        B(mb, x1 - ch * .5, x1 - ch * .5 + .03, s * (hw - ch * .5) - .05, s * (hw - ch * .5) + .05, z0 + .32, z0 + .48, M['amber'])
    # 水箱罩：凹進去的黑網＋金屬外框
    gw = hw - ch - .5
    B(mb, x1 - .02, x1 + .02, -gw - .05, gw + .05, z0 + .52, win0 - .12, M['metal'])
    B(mb, x1 - .03, x1 + .025, -gw, gw, z0 + .56, win0 - .16, M['black'])
    for i in range(int((win0 - z0 - .72) / .07)): B(mb, x1 + .0, x1 + .028, -gw, gw, z0 + .58 + i * .07, z0 + .6 + i * .07, M['dark'])
    B(mb, x1 - .05, x1 + .12, -hw + .05, hw - .05, z0 + .02, z0 + .24, M['black'])                    # 保險桿
    if beacon:
        mb.cyl_z((x0 + x1) / 2 - .1, 0, z1, z1 + .06, .12, 14, M['dark']); mb.cyl_z((x0 + x1) / 2 - .1, 0, z1 + .06, z1 + .2, .09, 14, M['amber'])


# ─── 加油車（機翼下方加油的油罐車）：三軸、橢圓鋁罐、罐頂走道與欄杆、後面的油管捲盤櫃與升降平台 ───
def fuel():
    mb = MB(11); L0, L1, hw = -5.4, 5.0, 1.25
    B(mb, L0, L1 - .3, -.48, -.32, .55, .8, M['steel']); B(mb, L0, L1 - .3, .32, .48, .55, .8, M['steel'])   # 大樑
    for x in (3.6, -2.6, -3.95):
        for s in (-1, 1): wheel(mb, x, s * 1.02, .52, .36, side=s)
        B(mb, x - .5, x + .5, -1.25, 1.25, 1.06, 1.12, M['black'])   # 擋泥板
    cab(mb, 2.6, L1, hw, .8, 2.85, M['white'])
    hazard(mb, L1 - .05, L1 + .14, -hw, hw, .45, .62, 8)
    # 油罐：橢圓斷面放樣（兩端圓頂）
    def ell(rx, rz, cz, n=36): return [(rx * math.cos(2 * math.pi * i / n), cz + rz * math.sin(2 * math.pi * i / n)) for i in range(n)]
    secs = []
    for k, x in enumerate((-4.95, -4.85, -4.6, 2.1, 2.35, 2.45)):
        f = (.72, .92, 1, 1, .92, .72)[k]
        secs.append((x, [(y * f, z) for y, z in ell(1.18, .82, 1.95)]))
    sec = secs   # 沿 X 放樣：每個斷面是 (y, z) 的橢圓，兩端縮小成圓頂
    n = len(sec[0][1]); v = []; f = []
    for x, prof in sec:
        for y, z in prof: v.append((x, y, 1.95 + (z - 1.95) * (1 if abs(x) < 4.5 else .95)))
    for k in range(len(sec) - 1):
        for i in range(n): f.append((k * n + i, (k + 1) * n + i, (k + 1) * n + (i + 1) % n, k * n + (i + 1) % n))
    f.append(tuple(range(n))); f.append(tuple(reversed(range((len(sec) - 1) * n, len(sec) * n))))
    mb.add(v, f, M['tank'])
    for x in (-3.6, -1.4, .8):   # 罐身的加強環（橢圓，略大於罐）
        ring = [(1.2 * math.cos(2 * math.pi * i / 36), 1.95 + .84 * math.sin(2 * math.pi * i / 36)) for i in range(36)]
        vv = [(x - .05, y, z) for y, z in ring] + [(x + .05, y, z) for y, z in ring]
        mb.add(vv, [(i, 36 + i, 36 + (i + 1) % 36, (i + 1) % 36) for i in range(36)], M['metal'])
    B(mb, -4.9, 2.3, -.12, .12, 1.02, 1.12, M['steel'])                                   # 罐下的托架
    for s in (-1, 1): B(mb, -4.7, 2.1, s * 1.175 - .01, s * 1.175 + .01, 1.86, 2.02, M['red'])   # 罐身兩側的紅帶
    # 罐頂走道、人孔蓋、折疊欄杆（黃）
    B(mb, -4.4, 1.8, -.42, .42, 2.76, 2.8, M['tread'])
    for x in (-3.0, -.6, 1.2): mb.cyl_z(x, 0, 2.77, 2.86, .32, 14, M['galv'])
    for s in (-1, 1):
        for x in (-4.3, -2.7, -1.1, .5, 1.7): tube(mb, (x, s * .45, 2.8), (x, s * .45, 3.32), .022, M['yel'])
        tube(mb, (-4.3, s * .45, 3.32), (1.7, s * .45, 3.32), .025, M['yel'])
    for i in range(7): B(mb, -5.42, -5.36, -.25, .25, .9 + i * .3, .93 + i * .3, M['galv'])   # 後梯
    for s in (-1, 1): B(mb, -5.45, -5.37, s * .28 - .03, s * .28 + .03, .8, 2.9, M['galv'])
    # 後段：油管捲盤櫃（捲門）、升降平台（收起）、尾燈與反光條
    B(mb, -5.4, -4.95, -1.2, 1.2, .8, 1.55, M['white'])
    for i in range(6): B(mb, -5.42, -5.4, -1.1, 1.1, .85 + i * .11, .88 + i * .11, M['dark'])
    B(mb, -5.2, -4.6, -1.25, 1.25, 1.2, 1.24, M['dark'])
    for s in (-1, 1):
        B(mb, -5.43, -5.4, s * 1.0 - .12, s * 1.0 + .12, .62, .74, M['tail'])
        B(mb, -5.43, -5.41, s * .6 - .25, s * .6 + .25, .5, .56, M['refl'])
        B(mb, -1.0, 1.0, s * 1.255, s * 1.26, .7, .76, M['refl'])
        mb.cyl_x(-4.3, -3.7, s * 1.05, 1.0, .22, 14, M['dark'])   # 側邊的油管捲盤
    hazard(mb, -5.55, -5.42, -1.0, 1.0, .5, .6, 8)
    mb.cyl_z(-4.2, 0, 2.86, 2.92, .1, 10, M['dark']); mb.cyl_z(-4.2, 0, 2.92, 3.05, .08, 10, M['amber'])
    return mb.build('gse_fuel')


# ─── 行李輸送帶車：低底盤四輪、斜的輸送帶（黑色皮帶、橫條）、兩側黃色扶手、右後方的開放式駕駛座 ───
def belt():
    mb = MB(12); hw = .95
    B(mb, -3.6, 3.0, -hw, hw, .35, .72, M['yel'])
    for x in (2.2, -2.6):
        for s in (-1, 1): wheel(mb, x, s * .82, .34, .26, side=s)
    hazard(mb, 3.0, 3.12, -hw, hw, .38, .55, 6); hazard(mb, -3.72, -3.6, -hw, hw, .38, .55, 6)
    # 駕駛座：座椅、方向盤、頂棚與四根柱
    B(mb, -3.3, -2.0, .1, hw, .72, .85, M['yel'])
    B(mb, -3.15, -2.6, .3, .8, .85, 1.25, M['dark']); B(mb, -3.25, -3.1, .3, .8, 1.1, 1.75, M['dark'])
    tube(mb, (-2.2, .55, .9), (-2.45, .55, 1.4), .03, M['dark']); mb.cyl_z(-2.45, .55, 1.38, 1.42, .18, 14, M['black'])
    for x in (-3.3, -2.05):
        for y in (.15, hw - .05): tube(mb, (x, y, .85), (x, y, 2.2), .03, M['yel'])
    B(mb, -3.4, -1.95, .05, hw + .05, 2.2, 2.28, M['yel'])
    mb.cyl_z(-2.7, .55, 2.28, 2.33, .09, 10, M['dark']); mb.cyl_z(-2.7, .55, 2.33, 2.45, .07, 10, M['amber'])
    # 輸送帶：從 (−3.4, .95) 斜升到 (3.9, 1.95)（客機的貨艙門檻約 1.8 m）
    a, b = Vector((-3.4, 0, .95)), Vector((3.9, 0, 1.95)); d = (b - a).normalized(); nrm = Vector((-d.z, 0, d.x))
    L = (b - a).length; bw = .42
    def P(t, y, h=0.0): q = a + d * t + nrm * h; return (q.x, y, q.z)
    for s in (-1, 1):   # 側框（槽鋼）
        mb.add([P(0, s * bw, -.18), P(L, s * bw, -.18), P(L, s * bw, .08), P(0, s * bw, .08), P(0, s * (bw + .06), -.18), P(L, s * (bw + .06), -.18), P(L, s * (bw + .06), .08), P(0, s * (bw + .06), .08)],
               [(0, 1, 2, 3), (7, 6, 5, 4), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)], M['yel'])
    mb.add([P(0, -bw, 0), P(L, -bw, 0), P(L, bw, 0), P(0, bw, 0)], [(0, 1, 2, 3)], M['belt'])
    mb.add([P(0, -bw, -.12), P(L, -bw, -.12), P(L, bw, -.12), P(0, bw, -.12)], [(3, 2, 1, 0)], M['belt'])
    t = .2
    while t < L - .1:   # 皮帶上的橫條
        mb.add([P(t, -bw + .02, 0), P(t + .05, -bw + .02, 0), P(t + .05, bw - .02, 0), P(t, bw - .02, 0), P(t, -bw + .02, .03), P(t + .05, -bw + .02, .03), P(t + .05, bw - .02, .03), P(t, bw - .02, .03)],
               [(4, 5, 6, 7), (0, 1, 5, 4), (2, 3, 7, 6)], M['dark']); t += .35
    for s in (-1, 1):   # 扶手（立柱＋上緣）
        pts = [P(L * k / 5, s * (bw + .03), .08) for k in range(6)]
        for p in pts: tube(mb, p, (p[0], p[1], p[2] + .55), .022, M['yel'])
        tube(mb, (pts[0][0], pts[0][1], pts[0][2] + .55), (pts[-1][0], pts[-1][1], pts[-1][2] + .55), .026, M['yel'])
    B(mb, b.x, b.x + .14, -bw - .06, bw + .06, b.z - .2, b.z + .05, M['rubber'])   # 端頭的橡膠護墊
    # 升降油壓缸（兩組）
    for x0, t0 in ((-1.0, 2.0), (1.6, 5.0)):
        for s in (-1, 1): tube(mb, (x0, s * .5, .72), P(t0, s * .5, -.18), .05, M['metal']); tube(mb, (x0, s * .5, .72), (x0 + (P(t0, 0)[0] - x0) * .5, s * .5, .72 + (P(t0, 0, -.18)[2] - .72) * .5), .07, M['steel'])
    return mb.build('gse_belt')


# ─── 推機車（傳統拖桿式）：低而寬的車身、中間凸起的玻璃駕駛艙、大輪胎、前後拖鉤與保險桿 ───
def xzprism(mb, prof, y0, y1, m):
    """側面輪廓（X, Z）沿 Y 擠出"""
    n = len(prof); v = [(x, y0, z) for x, z in prof] + [(x, y1, z) for x, z in prof]
    mb.add(v, [(i, (i + 1) % n, n + (i + 1) % n, n + i) for i in range(n)] + [tuple(reversed(range(n))), tuple(range(n, 2 * n))], m)


def push():
    """傳統式推機車（拖桿式）：6.3 m 長、2.6 m 寬的低矮車身，兩端是斜面＋黑色橡膠撞墊與拖鉤，四輪的黑色輪拱，
    偏左、半沉進車身的駕駛艙（前後都是斜玻璃），兩側的散熱格柵與配重塊、車頂的旋轉燈"""
    mb = MB(13); hw = 1.3; L = 3.15
    prof = [(-L, .38), (L, .38), (L, .78), (L - .45, 1.28), (-L + .45, 1.28), (-L, .78)]
    xzprism(mb, prof, -hw + .06, hw - .06, M['yel'])
    xzprism(mb, [(x * .985, z) for x, z in prof[:2]] + [(L * .985, .78), (L * .985 - .43, 1.26), (-L * .985 + .43, 1.26), (-L * .985, .78)], -hw, hw, M['yel'])
    for x in (1.85, -1.85):                                                                   # 輪子與輪拱
        for sd in (-1, 1):
            wheel(mb, x, sd * 1.0, .55, .44, side=sd)
            arc = [(x + .78 * math.cos(math.pi * i / 10), .55 + .7 * math.sin(math.pi * i / 10)) for i in range(11)]
            arc2 = [(x + .66 * math.cos(math.pi * i / 10), .55 + .58 * math.sin(math.pi * i / 10)) for i in range(11)]
            for (ax, az), (bx, bz), (cx, cz), (dx, dz) in zip(arc, arc[1:], arc2[1:], arc2):
                mb.add([(ax, sd * hw, az), (bx, sd * hw, bz), (cx, sd * hw, cz), (dx, sd * hw, dz), (ax, sd * (hw + .06), az), (bx, sd * (hw + .06), bz), (cx, sd * (hw + .06), cz), (dx, sd * (hw + .06), dz)],
                       [(0, 1, 2, 3), (7, 6, 5, 4), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)], M['black'])
            B(mb, x - .66, x + .66, sd * hw - .5 if sd > 0 else -hw, sd * hw if sd > 0 else -hw + .5, .9, .92, M['black'])
    for x, d in ((L, 1), (-L, -1)):                                                           # 撞墊、拖鉤、保險桿的斜紋
        xa, xb = sorted((x, x + d * .22))
        B(mb, xa, xb, -hw + .1, hw - .1, .42, .74, M['rubber'])
        for i in range(5): B(mb, xa - .005, xb + .005, -hw + .2 + i * .5, -hw + .3 + i * .5, .44, .72, M['black'])
        xc0, xc1 = sorted((x + d * .22, x + d * .55)); B(mb, xc0, xc1, -.16, .16, .48, .64, M['steel'])
        mb.cyl_z(x + d * .45, 0, .4, .72, .05, 8, M['metal'])
    # 頂面：防滑板、兩側的散熱格柵、配重塊、加油口
    B(mb, -L + .55, L - .55, -hw + .1, hw - .1, 1.28, 1.3, M['tread'])
    for sd in (-1, 1):
        for i in range(9): B(mb, -2.6 + i * .12, -2.55 + i * .12, sd * (hw - .4) - .3, sd * (hw - .4) + .3, 1.29, 1.33, M['dark'])
        for i in range(6): B(mb, 2.0 + i * .12, 2.05 + i * .12, sd * (hw - .4) - .3, sd * (hw - .4) + .3, 1.29, 1.33, M['dark'])
        B(mb, -.9, 2.6, sd * (hw + .005), sd * (hw + .015), .62, .7, M['refl'])
        B(mb, -2.2, -.9, sd * (hw + .005), sd * (hw + .015), .62, .7, M['refl'])
    B(mb, .55, 1.75, .3, 1.15, 1.3, 1.62, M['steel'])                                         # 配重塊
    for i in range(3): B(mb, .6 + i * .4, .62 + i * .4, .3, 1.15, 1.32, 1.64, M['dark'])
    mb.cyl_z(-2.2, .8, 1.3, 1.36, .1, 10, M['metal'])
    # 駕駛艙：偏左（−y），下半沉進車身，前後的斜玻璃、車頂、柱
    cx0, cx1, cy0, cy1, cz0, cz1 = -1.35, .35, -1.22, -.12, 1.28, 2.18
    B(mb, cx0, cx1, cy0, cy1, cz0, cz0 + .22, M['yel'])
    bv = [(cx0, cy0, cz0 + .22), (cx1, cy0, cz0 + .22), (cx1, cy1, cz0 + .22), (cx0, cy1, cz0 + .22),
          (cx0 + .22, cy0 + .06, cz1), (cx1 - .25, cy0 + .06, cz1), (cx1 - .25, cy1 - .06, cz1), (cx0 + .22, cy1 - .06, cz1)]
    mb.add(bv, [(0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)], M['glass'])
    for k in range(4): beam(mb, bv[k], bv[k + 4], .035, M['yel'])
    xm = (cx0 + cx1) / 2
    for a_, b_ in ((cy0, cy0 + .06), (cy1, cy1 - .06)): beam(mb, (xm, a_, cz0 + .22), (xm - .015, b_, cz1), .03, M['yel'])   # 中柱
    rv = [(cx0 + .14, cy0 - .02, cz1), (cx1 - .17, cy0 - .02, cz1), (cx1 - .17, cy1 + .02, cz1), (cx0 + .14, cy1 + .02, cz1),
          (cx0 + .2, cy0 + .04, cz1 + .1), (cx1 - .23, cy0 + .04, cz1 + .1), (cx1 - .23, cy1 - .04, cz1 + .1), (cx0 + .2, cy1 - .04, cz1 + .1)]
    mb.add(rv, [(0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7), (4, 5, 6, 7), (3, 2, 1, 0)], M['yel'])
    mb.cyl_z(-.5, -.67, cz1 + .1, cz1 + .16, .1, 12, M['dark']); mb.cyl_z(-.5, -.67, cz1 + .16, cz1 + .3, .08, 12, M['amber'])
    for i in range(3): B(mb, -1.0 + i * .15, -.9 + i * .15, cy0 - .04, cy0, .7 + i * .2, .74 + i * .2, M['tread'])   # 上車踏階
    for sd in (-1, 1):   # 頭燈（凹在斜面裡）、尾燈
        B(mb, L - .3, L - .1, sd * .95 - .16, sd * .95 + .16, .86, 1.0, M['dark']); B(mb, L - .12, L - .08, sd * .95 - .13, sd * .95 + .13, .88, .98, M['lamp'])
        B(mb, -L + .1, -L + .3, sd * .95 - .14, sd * .95 + .14, .86, .98, M['dark']); B(mb, -L + .08, -L + .12, sd * .95 - .11, sd * .95 + .11, .88, .96, M['tail'])
    return mb.build('gse_push')


# ─── 地面電源車（拖車式）：有百葉的機箱、操作面板、電纜捲在側邊的掛架、拖桿、四個小輪 ───
def gpu():
    mb = MB(14); hw = .7
    B(mb, -1.3, 1.3, -hw, hw, .45, 1.75, M['white'])
    B(mb, -1.32, 1.32, -hw - .02, hw + .02, 1.75, 1.82, M['dark'])
    for s in (-1, 1):
        for i in range(9): B(mb, -1.0 + i * .2, -.9 + i * .2, s * (hw + .005), s * (hw + .015), .8, 1.55, M['dark'])   # 百葉
        wheel(mb, .85, s * .6, .2, .14, side=s); wheel(mb, -.85, s * .6, .2, .14, side=s)
    B(mb, 1.3, 1.33, -.45, .45, .9, 1.55, M['dark']); B(mb, 1.33, 1.34, -.3, .1, 1.2, 1.45, M['refl'])   # 操作面板
    mb.cyl_x(1.33, 1.35, .3, 1.3, .05, 8, M['tail']); mb.cyl_x(1.33, 1.35, .3, 1.15, .05, 8, M['lamp'])
    tube(mb, (1.3, 0, .55), (2.4, 0, .4), .04, M['steel']); mb.cyl_z(2.45, 0, .32, .46, .08, 10, M['steel'])   # 拖桿
    mb.cyl_x(-1.5, -1.3, 0, 1.15, .36, 18, M['black'])   # 電纜捲在後面的掛架上
    mb.cyl_x(-1.52, -1.5, 0, 1.15, .42, 18, M['dark']); mb.cyl_x(-1.32, -1.3, 0, 1.15, .42, 18, M['dark'])
    B(mb, -1.38, -1.3, -.1, .1, .9, 1.4, M['steel'])
    B(mb, -1.3, 1.3, -hw, hw, .38, .45, M['steel'])
    return mb.build('gse_gpu')


# ─── 照明燈塔（拖車式發電機）：機箱、兩輪、四支外撐腳、三節伸縮桅桿、頂上橫桿掛四具投光燈（朝下斜） ───
def tower():
    mb = MB(15); hw = .65
    B(mb, -1.1, 1.1, -hw, hw, .5, 1.55, M['yel'])
    B(mb, -1.12, 1.12, -hw - .02, hw + .02, 1.55, 1.6, M['dark'])
    for s in (-1, 1):
        wheel(mb, 0, s * .8, .3, .2, side=s)
        for i in range(6): B(mb, -.9 + i * .2, -.82 + i * .2, s * (hw + .005), s * (hw + .015), .8, 1.35, M['dark'])
        for x in (-1.0, 1.0):   # 外撐腳
            beam(mb, (x, s * .5, .6), (x * 1.4, s * 1.4, .1), .04, M['yel']); mb.cyl_z(x * 1.4, s * 1.4, 0, .06, .1, 8, M['steel'])
    tube(mb, (1.1, 0, .6), (2.1, 0, .45), .04, M['steel'])
    for k, (r, z0, z1) in enumerate(((.11, 1.6, 4.4), (.085, 4.3, 6.9), (.065, 6.8, 9.0))): mb.cyl_z(0, 0, z0, z1, r, 10, M['galv'])
    B(mb, -.08, .08, -1.0, 1.0, 9.0, 9.12, M['steel'])
    for y in (-.85, -.3, .3, .85):   # 投光燈：殼、發光面朝下前方
        cx, cz = .15, 9.0
        mb.add([(cx - .2, y - .2, cz), (cx + .25, y - .2, cz - .05), (cx + .25, y + .2, cz - .05), (cx - .2, y + .2, cz), (cx - .2, y - .2, cz + .18), (cx + .25, y - .2, cz + .13), (cx + .25, y + .2, cz + .13), (cx - .2, y + .2, cz + .18)],
               [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)], [M['flood'], M['dark'], M['dark'], M['dark'], M['dark'], M['dark']])
    return mb.build('gse_tower')


# ─── 客梯車：卡車底盤、往後上的樓梯（踏板、兩側扶手與護板）、頂上有遮棚的平台 ───
def stairs():
    mb = MB(16); hw = 1.15
    B(mb, -3.6, 3.3, -.45, .45, .55, .78, M['steel'])
    for x in (2.4, -2.5):
        for s in (-1, 1): wheel(mb, x, s * .95, .45, .3, side=s)
    cab(mb, 1.6, 3.4, hw, .8, 2.7, M['white'])
    hazard(mb, 3.38, 3.52, -hw, hw, .45, .6, 8)
    B(mb, -3.6, 1.5, -hw, hw, .78, 1.0, M['white'])
    # 樓梯：從 (1.2, 1.05) 往後上到 (-2.4, 2.85)（客機前門門檻約 2.85 m）
    n = 11; xa, za, xb, zb = 1.2, 1.05, -2.4, 2.85
    for i in range(n):
        x = xa + (xb - xa) * i / n; z = za + (zb - za) * (i + 1) / n
        B(mb, x - .3, x, -.62, .62, z - .04, z, M['tread'])
    for s in (-1, 1):
        mb.add([(xa, s * .66, za - .2), (xb, s * .66, zb - .2), (xb, s * .66, zb + .05), (xa, s * .66, za + .05)], [(0, 1, 2, 3)], M['white'])
        mb.add([(xa, s * .7, za - .2), (xb, s * .7, zb - .2), (xb, s * .7, zb + .05), (xa, s * .7, za + .05)], [(3, 2, 1, 0)], M['white'])
        for k in range(6):
            t = k / 5; x, z = xa + (xb - xa) * t, za + (zb - za) * t
            tube(mb, (x, s * .68, z), (x, s * .68, z + 1.0), .022, M['galv'])
        tube(mb, (xa, s * .68, za + 1.0), (xb, s * .68, zb + 1.0), .03, M['galv'])
    # 平台與遮棚
    B(mb, -3.7, -2.4, -.75, .75, 2.75, 2.85, M['tread'])
    for x in (-3.65, -2.45):
        for s in (-1, 1): tube(mb, (x, s * .72, 2.85), (x, s * .72, 4.9), .035, M['galv'])
    B(mb, -3.85, -2.3, -.85, .85, 4.9, 5.0, M['white'])
    B(mb, -3.65, -2.45, -.72, -.7, 2.85, 3.9, M['glass']); B(mb, -3.65, -2.45, .7, .72, 2.85, 3.9, M['glass'])
    for s in (-1, 1): beam(mb, (-1.4, s * .5, 1.0), (-3.0, s * .5, 2.7), .06, M['steel'])
    B(mb, -3.85, -3.7, -.75, .75, 2.5, 2.85, M['rubber'])
    mb.cyl_z(2.5, 0, 2.7, 2.76, .1, 10, M['dark']); mb.cyl_z(2.5, 0, 2.76, 2.9, .08, 10, M['amber'])
    return mb.build('gse_stairs')


# ─── 三角錐（橘、兩圈反光帶、黑色方底座）與輪擋（黃色楔形、成對、中間的繩） ───
M['plastic_o'] = mat('m10_gse_cone', '#d2601c', 0.4, 0.0); M['plastic_y'] = mat('m10_gse_chock', '#d9a21a', 0.45, 0.0)   # 三角錐、輪擋是塑膠：不用 m58 的掉漆與鏽


def cone():
    mb = MB(17)
    B(mb, -.2, .2, -.2, .2, 0, .04, M['black'])
    n = 16
    def ring(r, z): return [(r * math.cos(2 * math.pi * i / n), r * math.sin(2 * math.pi * i / n), z) for i in range(n)]
    zs = [(.04, .15, 'plastic_o'), (.24, .125, 'refl'), (.33, .105, 'plastic_o'), (.47, .075, 'refl'), (.54, .06, 'plastic_o'), (.72, .025, 'plastic_o')]
    prev = ring(.15, .04)
    for (z0, r0, _), (z1, r1, m) in zip(zs, zs[1:]):
        v = ring(r0, z0) + ring(r1, z1)
        mb.add(v, [(i, (i + 1) % n, n + (i + 1) % n, n + i) for i in range(n)], M[m])
    mb.add(ring(.025, .72), [tuple(range(n))], M['plastic_o'])
    return mb.build('gse_cone')


def chock():
    mb = MB(18)
    for s in (-1, 1):
        mb.add([(-.2, s * .3 - .12, 0), (.2, s * .3 - .12, 0), (.2, s * .3 - .12, .02), (-.2, s * .3 - .12, .2), (-.2, s * .3 + .12, 0), (.2, s * .3 + .12, 0), (.2, s * .3 + .12, .02), (-.2, s * .3 + .12, .2)],
               [(0, 1, 2, 3), (7, 6, 5, 4), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)], M['plastic_y'])
    tube(mb, (-.15, -.2, .12), (-.15, .2, .12), .012, M['dark'], 6)
    return mb.build('gse_chock')


# ─── 空廚車：雙軸卡車、剪式升降架、白色保溫車廂（側面加強肋、藍帶、後捲門、頂上冷氣）、車廂前伸過駕駛室的平台（欄杆、橡膠緩衝、黃黑邊）、四支穩定腳 ───
# 停在客機右後門：車廂升到門檻高（2.85 m），平台前緣（+X 4.05）頂著機身
def cater():
    mb = MB(19); hw = 1.22
    for s in (-1, 1): B(mb, -4.3, 3.2, s * .42 - .08, s * .42 + .08, .55, .82, M['steel'])   # 大樑
    for s in (-1, 1):
        wheel(mb, 2.3, s * 1.0, .5, .32, side=s)
        wheel(mb, -2.7, s * 1.0, .5, .3, side=s); wheel(mb, -2.7, s * .66, .5, .28, side=s)   # 後軸雙輪
    for x in (2.3, -2.7): B(mb, x - .62, x + .62, -1.24, 1.24, 1.08, 1.14, M['black'])   # 擋泥板
    cab(mb, 1.7, 3.4, hw, .8, 2.45, M['white'], beacon=False)
    hazard(mb, 3.38, 3.52, -hw, hw, .45, .6, 8)
    B(mb, -4.3, 1.65, -hw, hw, .82, 1.0, M['steel'])                                         # 車斗底盤
    for s in (-1, 1): B(mb, -1.0, .6, s * hw - .02, s * hw + .04, .45, .8, M['dark'])        # 側邊工具箱
    # 剪式升降架（兩側各一組 X、中間銷軸）與兩支油壓缸
    zl, zh = 1.0, 2.55
    for s in (-1, 1):
        y = s * .9
        beam(mb, (-3.9, y, zl + .1), (.9, y, zh - .1), .075, M['galv']); beam(mb, (.9, y + s * .1, zl + .1), (-3.9, y + s * .1, zh - .1), .075, M['galv'])
        cyl_y(mb, -1.5, (zl + zh) / 2, min(y, y + s * .14), max(y, y + s * .14), .07, 10, M['metal'])
        for x, z in ((-3.9, zl + .1), (.9, zh - .1)): cyl_y(mb, x, z, y - .08, y + .08, .09, 10, M['metal'])
        for x in (-3.9, .9): B(mb, x - .25, x + .25, y - .1, y + .1, zl, zl + .08, M['steel']); B(mb, x - .25, x + .25, y - .1, y + .1, zh - .08, zh, M['steel'])
        tube(mb, (-.4, s * .45, zl + .05), (-1.4, s * .45, (zl + zh) / 2 + .1), .06, M['yel']); tube(mb, (-.9, s * .45, zl + .3), (-1.4, s * .45, (zl + zh) / 2 + .1), .035, M['metal'])
    # 車廂：副車架、白色保溫箱
    B(mb, -4.35, 1.65, -1.25, 1.25, zh, 2.85, M['steel'])
    X0, X1, Z0, Z1, W = -4.3, 1.6, 2.85, 5.3, 1.25
    B(mb, X0, X1, -W, W, Z0, Z1, M['white'])
    for s in (-1, 1):
        x = X0 + .3
        while x < X1 - .2:   # 側面的加強肋
            B(mb, x - .03, x + .03, s * W - .02 if s < 0 else W, s * W if s < 0 else W + .02, Z0 + .05, Z1 - .05, M['panel']); x += .6
        B(mb, X0 + .05, X1 - .05, s * W - .025 if s < 0 else W, s * W if s < 0 else W + .025, 3.35, 3.6, M['blue'])     # 藍帶
        B(mb, X0 + .05, X1 - .05, s * W - .02 if s < 0 else W, s * W if s < 0 else W + .02, 3.62, 3.66, M['orange'])   # 細橘線
        B(mb, X0 - .02, X1 + .02, s * W - .04 if s < 0 else W, s * W if s < 0 else W + .04, Z1 - .08, Z1, M['galv'])   # 頂緣
        B(mb, X0 - .02, X1 + .02, s * W - .04 if s < 0 else W, s * W if s < 0 else W + .04, Z0, Z0 + .08, M['galv'])
        B(mb, X1 - .12, X1, s * W - .03 if s < 0 else W - .09, s * W + .09 if s < 0 else W + .03, Z1 - .2, Z1 - .05, M['amber'])   # 角燈
        B(mb, X0, X0 + .12, s * W - .03 if s < 0 else W - .09, s * W + .09 if s < 0 else W + .03, Z1 - .2, Z1 - .05, M['tail'])
    # 後捲門（橫條）與門框、後面的梯子
    B(mb, X0 - .04, X0, -1.05, 1.05, Z0 + .1, Z1 - .2, M['panel'])
    for i in range(16): B(mb, X0 - .05, X0 - .04, -1.0, 1.0, Z0 + .18 + i * .13, Z0 + .2 + i * .13, M['grey'])
    B(mb, X0 - .08, X0 - .04, -.15, .15, Z0 + .2, Z0 + .3, M['dark'])
    for y in (-.25, .25): B(mb, X0 - .1, X0 - .06, y - .02, y + .02, .9, Z0, M['galv'])
    for i in range(5): B(mb, X0 - .1, X0 - .06, -.25, .25, 1.15 + i * .32, 1.18 + i * .32, M['galv'])
    # 前面：雙開門（深色玻璃窗）對著平台
    B(mb, X1, X1 + .03, -.75, .75, Z0 + .05, Z0 + 2.15, M['panel'])
    B(mb, X1 + .03, X1 + .04, -.7, -.02, Z0 + 1.1, Z0 + 1.95, M['glass']); B(mb, X1 + .03, X1 + .04, .02, .7, Z0 + 1.1, Z0 + 1.95, M['glass'])
    B(mb, X1 + .03, X1 + .045, -.01, .01, Z0 + .05, Z0 + 2.15, M['dark'])
    for y in (-.12, .12): B(mb, X1 + .03, X1 + .07, y - .015, y + .015, Z0 + .9, Z0 + 1.1, M['metal'])
    # 頂上的冷凍機組、旋轉燈
    B(mb, -.8, .9, -.7, .7, Z1, Z1 + .38, M['panel']); B(mb, -.75, .85, -.65, .65, Z1 + .38, Z1 + .42, M['grey'])
    for x in (-.4, .45): mb.cyl_z(x, 0, Z1 + .42, Z1 + .44, .26, 14, M['dark'])
    mb.cyl_z(X1 - .3, 0, Z1, Z1 + .06, .12, 10, M['dark']); mb.cyl_z(X1 - .3, 0, Z1 + .06, Z1 + .2, .09, 10, M['amber'])
    # 前平台：踏板、黃黑前緣、欄杆（兩側）、橡膠緩衝
    B(mb, X1, 4.0, -W, W, Z0 - .1, Z0, M['tread'])
    B(mb, X1, 4.0, -W, W, Z0 - .22, Z0 - .1, M['steel'])
    hazard(mb, 3.86, 4.0, -W, W, Z0 - .01, Z0 + .005, 10)
    B(mb, 4.0, 4.1, -.9, .9, Z0 - .3, Z0 + .05, M['rubber'])
    for s in (-1, 1):
        y = s * (W - .04)
        for x in (X1 + .1, 2.4, 3.2, 3.95): tube(mb, (x, y, Z0), (x, y, Z0 + 1.1), .025, M['yel'])
        tube(mb, (X1 + .1, y, Z0 + 1.1), (3.95, y, Z0 + 1.1), .03, M['yel']); tube(mb, (X1 + .1, y, Z0 + .55), (3.95, y, Z0 + .55), .022, M['yel'])
        B(mb, X1 + .1, 3.95, y - .01, y + .01, Z0, Z0 + .12, M['yel'])
    # 穩定腳（四角，放下）與腳墊
    for x in (-4.0, 1.4):
        for s in (-1, 1):
            B(mb, x - .08, x + .08, s * 1.15 - .08, s * 1.15 + .08, .1, .85, M['yel']); B(mb, x - .2, x + .2, s * 1.15 - .2, s * 1.15 + .2, .0, .1, M['steel'])
    # 尾燈、反光條
    for s in (-1, 1):
        B(mb, -4.33, -4.3, s * .95 - .12, s * .95 + .12, .6, .72, M['tail'])
        B(mb, -2.0, 1.0, s * 1.245 - .005 if s < 0 else 1.24, s * 1.24 if s < 0 else 1.25, .62, .68, M['refl'])
    hazard(mb, -4.42, -4.3, -1.0, 1.0, .5, .6, 8)
    return mb.build('gse_cater')


# ─── ULD 拖板＋LD3 貨櫃（鋁殼、一側斜肩、前面的帆布門與綁帶）───
def dolly():
    mb = MB(21); L, hw = 1.75, .95
    B(mb, -L, L, -hw, hw, .42, .52, M['steel'])
    for i in range(9): B(mb, -L + .2 + i * .38, -L + .26 + i * .38, -hw + .05, hw - .05, .52, .56, M['galv'])   # 滾輪條
    for s in (-1, 1): B(mb, -L, L, s * hw - .04 if s < 0 else hw, s * hw if s < 0 else hw + .04, .38, .62, M['yel'])   # 側欄
    for x in (1.2, -1.2):
        for s in (-1, 1): wheel(mb, x, s * .78, .2, .14, side=s)
    tube(mb, (L, 0, .45), (L + 1.1, 0, .4), .04, M['yel']); B(mb, L + 1.05, L + 1.2, -.08, .08, .35, .45, M['steel'])   # 拖桿
    B(mb, -L - .12, -L, -.1, .1, .38, .48, M['steel'])
    for s in (-1, 1): B(mb, -L - .02, -L, s * .7 - .06, s * .7 + .06, .44, .5, M['refl'])
    # LD3：x 方向 1.53 深，y 方向底 1.56、頂 2.01（+y 那側斜肩），高 1.63
    z0, x0, x1 = .56, -.77, .77
    prof = [(-.78, z0), (.78, z0), (1.23, z0 + .62), (1.23, z0 + 1.63), (-.78, z0 + 1.63)]
    v = [(x0, y, z) for y, z in prof] + [(x1, y, z) for y, z in prof]; n = len(prof)
    mb.add(v, [(i, (i + 1) % n, n + (i + 1) % n, n + i) for i in range(n)] + [tuple(reversed(range(n))), tuple(range(n, 2 * n))], M['alu'])
    for x in (x0 - .01, x1 + .01):   # 邊框（深色鋁擠型）
        for (ya, za), (yb, zb) in zip(prof, prof[1:] + prof[:1]): beam(mb, (x, ya, za), (x, yb, zb), .025, M['grey'])
    for x in (-.25, .25):           # 側壁的加強肋
        beam(mb, (x, -.79, z0 + .05), (x, -.79, z0 + 1.6), .015, M['grey'])
    B(mb, x1 + .005, x1 + .03, -.7, 1.15, z0 + .08, z0 + 1.55, M['curtain'])   # 帆布門
    for z in (z0 + .5, z0 + 1.0): B(mb, x1 + .03, x1 + .045, -.75, 1.2, z - .02, z + .02, M['yel'])   # 綁帶
    B(mb, x1 + .03, x1 + .045, -.5, -.2, z0 + 1.2, z0 + 1.4, M['white'])   # 貨櫃號牌
    return mb.build('gse_dolly')


# ─── 機坪接駁巴士：低地板、整圈大窗、兩側各三組雙開門、車內座椅與黃色扶桿、車頂冷氣 ───
def bus():
    mb = MB(22); L0, L1, hw, zf, zr = -6.9, 6.9, 1.5, .38, 2.9
    B(mb, L0, L1, -hw, hw, .3, 1.0, M['white'])              # 下半車身
    B(mb, L0, L1, -hw, hw, zr - .3, zr, M['white'])          # 車頂
    B(mb, L0 + .05, L1 - .05, -hw + .03, hw - .03, 1.0, zr - .3, M['glass'])
    doors = (-4.2, 0.0, 4.2)
    xs = [L0 + .1] + [d + e for d in doors for e in (-1.0, 1.0)] + [L1 - .1]
    for s in (-1, 1):
        y = s * hw
        for x in xs: B(mb, x - .07, x + .07, y - .03, y + .03, 1.0, zr - .3, M['white'])   # 窗柱
        for d in doors:   # 雙開門：玻璃到地、門框、門縫、黃邊
            B(mb, d - 1.0, d + 1.0, y - .035, y + .035, zf, 1.0, M['glass'])
            for e in (-.98, 0, .98): B(mb, d + e - .025, d + e + .025, y - .04, y + .04, zf, zr - .3, M['dark'])
            B(mb, d - 1.0, d + 1.0, y - .04, y + .04, zf, zf + .06, M['yel'])
        B(mb, L0 + .1, L1 - .1, y - .04 if s < 0 else y, y if s < 0 else y + .04, .55, .78, M['blue'])     # 藍帶
        B(mb, L0 + .1, L1 - .1, y - .04 if s < 0 else y, y if s < 0 else y + .04, .8, .84, M['orange'])
    for x in (4.6, -4.4):   # 輪子與輪拱（低地板，輪拱高出地板）
        for s in (-1, 1): wheel(mb, x, s * 1.22, .46, .3, side=s)
        B(mb, x - .62, x + .62, -hw - .01, hw + .01, .95, 1.02, M['dark'])
    # 車頭：大擋風玻璃、頭燈、雨刷、方向燈；車尾：燈與散熱格
    B(mb, L1, L1 + .04, -1.35, 1.35, 1.1, zr - .35, M['glass'])
    for s in (-1, 1):
        B(mb, L1, L1 + .05, s * 1.15 - .18, s * 1.15 + .18, .55, .72, M['lamp']); B(mb, L1, L1 + .05, s * 1.38 - .06, s * 1.38 + .06, .55, .72, M['amber'])
        tube(mb, (L1 + .05, s * .55, 1.12), (L1 + .05, s * .1, 1.65), .015, M['black'])
        B(mb, L0 - .05, L0, s * 1.2 - .12, s * 1.2 + .12, .7, 1.1, M['tail'])
        beam(mb, (L1 - .1, s * hw, 2.3), (L1 + .25, s * (hw + .25), 2.35), .025, M['dark']); B(mb, L1 + .2, L1 + .3, s * (hw + .2) - .08, s * (hw + .2) + .08, 1.8, 2.35, M['dark'])
    B(mb, L1, L1 + .06, -1.0, 1.0, .35, .5, M['black']); B(mb, L0 - .06, L0, -1.0, 1.0, .35, .5, M['black'])
    for i in range(6): B(mb, L0 - .05, L0 - .04, -.8, .8, 1.3 + i * .12, 1.34 + i * .12, M['dark'])
    B(mb, L1 + .01, L1 + .045, -.6, .6, zr - .33, zr - .12, M['amber'])   # 頭頂的路線燈箱
    # 車內：地板、側邊座椅、黃色扶桿、橫桿
    B(mb, L0 + .1, L1 - .1, -hw + .05, hw - .05, zf, zf + .04, M['tread'])
    for x0 in (-6.4, -2.8, 1.4, 5.2):
        for s in (-1, 1): B(mb, x0, x0 + 1.0, s * 1.2 - .25, s * 1.2 + .25, zf, zf + .45, M['seat']); B(mb, x0, x0 + 1.0, s * 1.42 - .04, s * 1.42 + .04, zf + .45, zf + 1.0, M['seat'])
    for x in (-5.0, -3.2, -1.4, 1.4, 3.2, 5.6):
        for y in (-.5, .5): tube(mb, (x, y, zf + .04), (x, y, zr - .3), .025, M['yel'], 6)
    for y in (-.5, .5): tube(mb, (L0 + .4, y, zr - .45), (L1 - .8, y, zr - .45), .02, M['galv'], 6)
    B(mb, 5.8, 6.6, .3, 1.2, zf, zf + .9, M['dark'])   # 駕駛座
    # 車頂冷氣兩組
    for x in (-3.0, 2.0): B(mb, x - 1.0, x + 1.0, -.8, .8, zr, zr + .25, M['panel']); B(mb, x - .9, x + .9, -.7, .7, zr + .25, zr + .28, M['grey'])
    mb.cyl_z(5.5, 0, zr, zr + .06, .12, 10, M['dark']); mb.cyl_z(5.5, 0, zr + .06, zr + .2, .09, 10, M['amber'])
    return mb.build('gse_bus')


# ─── 風向袋：6 m 鍍鋅桿（底座、維修鉸鏈）、頂端轉環與框、紅白相間五節布筒（往 +X 飄、尾端微垂）、頂燈 ───
def sock():
    mb = MB(23)
    B(mb, -.5, .5, -.5, .5, 0, .2, M['dark'])
    tube(mb, (0, 0, .2), (0, 0, 6.0), .06, M['galv'], 10)
    cyl_y(mb, 0, 1.4, -.1, .1, .1, 10, M['metal'])                 # 鉸鏈
    mb.cyl_z(0, 0, 5.95, 6.1, .1, 10, M['metal'])
    mb.cyl_z(0, 0, 6.1, 6.25, .06, 8, M['tail'])                   # 障礙燈
    # 框：轉環往 +X 伸出一個圓圈（r .45）
    beam(mb, (0, 0, 5.85), (.6, 0, 5.85), .025, M['galv'])
    n = 18
    def ring(cx, r, cz): return [(cx, r * math.cos(2 * math.pi * i / n), cz + r * math.sin(2 * math.pi * i / n)) for i in range(n)]
    secs = [(.6 + k * .72, .45 - k * .05, 5.85 - k * k * .03) for k in range(6)]
    for k, ((xa, ra, za), (xb, rb, zb)) in enumerate(zip(secs, secs[1:])):
        v = ring(xa, ra, za) + ring(xb, rb, zb)
        f = [(i, (i + 1) % n, n + (i + 1) % n, n + i) for i in range(n)]
        mb.add(v, f, M['orange' if k % 2 == 0 else 'white'])
        mb.add(v, [tuple(reversed(q)) for q in f], M['orange' if k % 2 == 0 else 'white'])   # 布筒兩面都看得到
    v = ring(.6, .47, 5.85) + ring(.64, .47, 5.85)
    mb.add(v, [(i, (i + 1) % n, n + (i + 1) % n, n + i) for i in range(n)], M['galv'])
    return mb.build('gse_sock')


# ─── 機場消防車（ARFF）：三軸 6×6、11.6 m、寬面駕駛室（大片擋風玻璃）、車身兩側的捲門櫃、車頂水砲與保險桿水砲、萊姆黃反光帶、後梯與水帶捲盤 ───
M['lime'] = mat('m58_gse_lime', '#b9cc22', 0.35, 0.0)
M['fire'] = mat('m58_gse_fire', '#b3201b', 0.3, 0.05)
M['blue_l'] = mat('m16_blue', '#2a6cff', 0.4, 0.0, emit='#2a6cff')


def arff():
    mb = MB(29); L0, L1, hw, R = -5.8, 5.8, 1.5, .72
    B(mb, L0 + .3, L1 - .4, -.55, -.35, .62, .9, M['steel']); B(mb, L0 + .3, L1 - .4, .35, .55, .62, .9, M['steel'])   # 大樑
    for x in (3.85, -1.45, -3.25):
        for s in (-1, 1): wheel(mb, x, s * 1.12, R, .56, side=s)
    # 駕駛室：比車身寬一點的平頭、擋風玻璃往下延伸，車頂的燈條
    cab(mb, 3.0, L1, hw, .95, 3.2, M['fire'], beacon=False)
    for s in (-1, 1):
        B(mb, 3.9, 4.0, s * hw - .01, s * hw + .01, 1.0, 2.9, M['dark'])                      # 第二道門縫（雙排座）
        for i in range(3): B(mb, 3.25 + i * .25, 3.45 + i * .25, s * (hw + .02) - .06, s * (hw + .02) + .06, .55 + i * .14, .6 + i * .14, M['tread'])   # 上車踏階
    B(mb, 4.0, 5.2, -1.1, 1.1, 3.2, 3.3, M['dark'])                                            # 燈條
    for i, y in enumerate((-.95, -.55, -.15, .25, .65)):
        B(mb, 4.05, 5.15, y, y + .3, 3.3, 3.42, M['tail'] if i % 2 == 0 else M['blue_l'])
    # 保險桿與保險桿水砲
    B(mb, L1 - .6, L1 + .02, -hw + .1, hw - .1, .55, .95, M['dark']); B(mb, 4.6, L1 - .6, -hw + .05, hw - .05, .8, .95, M['fire'])   # 駕駛室底下的保險桿座
    B(mb, L1 + .02, L1 + .25, -hw, hw, .5, .75, M['steel']); B(mb, L1 + .25, L1 + .27, -hw + .1, hw - .1, .58, .66, M['refl'])
    mb.cyl_z(L1 + .35, 0, .7, .85, .16, 12, M['galv']); tube(mb, (L1 + .35, 0, .85), (L1 + .95, 0, .95), .07, M['galv'], 10)
    mb.cyl_x(L1 + .95, L1 + 1.1, 0, .95, .09, 10, M['metal'])
    # 車身：紅、兩側捲門櫃（鋁）、輪拱（黑）、萊姆黃與白的反光帶
    # 車身（輪拱以上）：斷面上緣兩角斜切 0.22 m（方塊會像玩具），沿 X 擠出
    sec = [(-hw, 1.55), (hw, 1.55), (hw, 3.08), (hw - .22, 3.3), (-hw + .22, 3.3), (-hw, 3.08)]
    n_ = len(sec); vv = [(L0, y, z) for y, z in sec] + [(3.0, y, z) for y, z in sec]
    mb.add(vv, [(i, (i + 1) % n_, n_ + (i + 1) % n_, n_ + i) for i in range(n_)] + [tuple(reversed(range(n_))), tuple(range(n_, 2 * n_))], M['fire'])
    for s_ in (-1, 1): B(mb, L0 + .05, 2.95, s_ * (hw - .11) - .015, s_ * (hw - .11) + .015, 3.17, 3.21, M['refl'])   # 斜邊上的白色反光條
    for x0, x1 in ((L0, -4.05), (-2.45, -2.25), (-.65, 3.0)): B(mb, x0, x1, -hw, hw, .95, 1.55, M['fire'])   # 輪子之間的下半截
    B(mb, -4.05, -.65, -hw + .55, hw - .55, .95, 1.55, M['dark'])                                       # 輪拱裡
    for x0, x1 in ((-.55, 2.85), (-5.6, -4.25), (-4.05, -.65)):
        for s in (-1, 1):
            z0 = 1.65 if x1 < -.6 and x0 > -4.1 else 1.25
            B(mb, x0, x1, s * hw - .015, s * hw + .015, z0, 2.95, M['alu'])
            for i in range(int((2.9 - z0) / .12)): B(mb, x0 + .02, x1 - .02, s * (hw + .016) - .006, s * (hw + .016) + .006, z0 + .05 + i * .12, z0 + .06 + i * .12, M['metal'])
            B(mb, x0 + .2, x0 + .45, s * (hw + .02) - .02, s * (hw + .02) + .02, 1.28, 1.34, M['dark'])   # 捲門把手
    for x in (-1.45, -3.25):
        for s in (-1, 1): B(mb, x - .82, x + .82, s * hw - .03, s * hw + .03, 1.5, 1.6, M['black'])   # 輪拱的邊
    for s in (-1, 1):
        for x0, x1 in ((L0, -4.05), (-.65, 3.1), (4.6, L1 - .05)):   # 輪子之間
            B(mb, x0, x1, s * hw - .022, s * hw + .022, 1.05, 1.2, M['lime'])
        B(mb, -4.05, -.75, s * hw - .022, s * hw + .022, 3.0, 3.12, M['lime'])
        B(mb, L0, L1 - .05, s * hw - .021, s * hw + .021, 3.12, 3.16, M['refl'])
        B(mb, L0 + .2, L0 + .5, s * hw - .03, s * hw + .03, 2.6, 2.9, M['amber'])          # 側燈
        B(mb, 2.9, 3.0, s * hw - .03, s * hw + .03, 2.6, 3.0, M['blue_l'])                  # 側邊的警示燈
    # 車頂：水箱頂的走道、欄杆、車頂水砲（底座、彎管、噴嘴）、泡沫罐的人孔
    B(mb, L0 + .2, 2.6, -.6, .6, 3.3, 3.34, M['tread'])
    for s in (-1, 1):
        for x in (-5.4, -3.6, -1.8, 0, 1.8): tube(mb, (x, s * 1.35, 3.3), (x, s * 1.35, 3.75), .022, M['galv'])
        tube(mb, (-5.4, s * 1.35, 3.75), (1.8, s * 1.35, 3.75), .025, M['galv'])
    for x in (-3.8, -1.4): mb.cyl_z(x, 0, 3.3, 3.42, .3, 14, M['galv'])
    mb.cyl_z(2.4, 0, 3.3, 3.55, .32, 14, M['metal']); mb.cyl_z(2.4, 0, 3.55, 3.8, .18, 12, M['galv'])
    tube(mb, (2.4, 0, 3.75), (3.4, 0, 3.95), .11, M['galv'], 12); tube(mb, (3.4, 0, 3.95), (4.6, 0, 4.0), .09, M['galv'], 12)
    mb.cyl_x(4.6, 4.9, 0, 4.0, .12, 12, M['metal']); mb.cyl_x(4.9, 5.0, 0, 4.0, .08, 10, M['dark'])
    # 車尾：梯、水帶捲盤、尾燈、黃紅斜紋
    for i in range(8): B(mb, L0 - .06, L0 - .02, -.95, -.55, .7 + i * .32, .73 + i * .32, M['galv'])
    for y in (-.95, -.55): B(mb, L0 - .07, L0 - .02, y - .03, y + .03, .7, 3.3, M['galv'])
    mb.cyl_x(L0 - .4, L0 - .02, .5, 1.8, .42, 18, M['dark']); mb.cyl_x(L0 - .42, L0 - .38, .5, 1.8, .45, 18, M['galv'])
    for s in (-1, 1):
        B(mb, L0 - .03, L0, s * 1.25 - .15, s * 1.25 + .15, 1.0, 1.2, M['tail']); B(mb, L0 - .03, L0, s * 1.25 - .15, s * 1.25 + .15, 1.22, 1.32, M['amber'])
    for i in range(6): B(mb, L0 - .025, L0 - .005, -1.45 + i * .48, -1.45 + i * .48 + .24, .75, .95, M['lime'] if i % 2 == 0 else M['tail'])
    hazard(mb, L0 - .2, L0 - .02, -hw, hw, .45, .65, 8)
    return mb.build('gse_arff')



# ─── 機坪的小東西：藍色 FOD（外來物）回收桶（掀蓋、白色反光帶）、推車式滅火器（兩輪推車、紅色鋼瓶、黑色水帶與噴嘴、壓力表） ───
M['fodblue'] = mat('m58_gse_fod', '#1f4f9c', 0.4, 0.0)


def fod():
    mb = MB(31)
    B(mb, -.38, .38, -.3, .3, .05, .95, M['fodblue'])
    B(mb, -.4, .4, -.32, .32, .95, 1.02, M['fodblue']); B(mb, -.12, .12, -.33, -.31, .7, .92, M['dark'])   # 蓋、投入口
    for z in (.3, .6): B(mb, -.385, .385, -.305, .305, z, z + .06, M['refl'])
    for x in (-.3, .3):
        for y in (-.22, .22): B(mb, x - .04, x + .04, y - .04, y + .04, 0, .05, M['rubber'])
    return mb.build('gse_fod')


def ext():
    mb = MB(37)
    mb.cyl_z(0, 0, .18, 1.12, .24, 20, M['red']); mb.cyl_z(0, 0, 1.12, 1.2, .16, 16, M['red']); mb.cyl_z(0, 0, 1.2, 1.32, .06, 10, M['metal'])
    for s in (-1, 1): wheel(mb, -.12, s * .36, .2, .08, side=s)
    tube(mb, (-.12, -.36, .2), (-.12, .36, .2), .025, M['steel'])
    for s in (-1, 1): tube(mb, (-.12, s * .3, .2), (-.28, s * .26, 1.2), .022, M['steel']); tube(mb, (-.28, s * .26, 1.2), (-.42, s * .26, 1.25), .022, M['steel'])
    tube(mb, (-.42, -.26, 1.25), (-.42, .26, 1.25), .025, M['black'])
    for k in range(6):   # 捲在鋼瓶上的水帶
        a0, a1 = k * 1.05, (k + 1) * 1.05; tube(mb, (.27 * math.cos(a0), .27 * math.sin(a0), .55 + k * .05), (.27 * math.cos(a1), .27 * math.sin(a1), .55 + (k + 1) * .05), .022, M['black'])
    tube(mb, (.2, .15, .82), (.36, .1, .9), .03, M['black']); mb.cyl_x(.36, .52, .1, .9, .035, 8, M['metal'])
    cyl_y(mb, .1, 1.05, .2, .26, .05, 10, M['white'])
    B(mb, -.05, .05, -.245, -.235, .5, .9, M['white'])
    return mb.build('gse_ext')


STEP = 1.0


def finish(o):
    bm = bmesh.new(); bm.from_mesh(o.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    sharp = [e for e in bm.edges if len(e.link_faces) == 2 and e.calc_face_angle(0) > 0.49]
    res = bmesh.ops.bevel(bm, geom=sharp, offset=0.012, offset_type='OFFSET', segments=1, profile=0.5, affect='EDGES', clamp_overlap=True)
    nf = set(res['faces'])   # 倒角面預設是第 0 號材質（細管、輪胎溝會變成那個顏色）：改成相鄰原面的材質
    for f in nf:
        for e in f.edges:
            g = [q for q in e.link_faces if q not in nf]
            if g: f.material_index = g[0].material_index; break
    lo = [min(v.co[k] for v in bm.verts) for k in range(3)]; hi = [max(v.co[k] for v in bm.verts) for k in range(3)]
    for k in range(3):
        c = math.floor(lo[k] / STEP) * STEP + STEP
        while c < hi[k]:
            co = [0.0, 0.0, 0.0]; no = [0.0, 0.0, 0.0]; co[k] = c; no[k] = 1.0
            bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], dist=1e-4, plane_co=co, plane_no=no)
            c += STEP
    # 平滑著色＋硬邊：轉角超過 0.6 rad（約 34°）的邊是硬邊，方塊照樣是平的；圓罐、輪胎、彎管這類細分夠的曲面不會有一條條的稜
    for f in bm.faces: f.smooth = True
    for e in bm.edges: e.smooth = len(e.link_faces) == 2 and e.calc_face_angle(0) < 0.6
    bm.to_mesh(o.data); bm.free(); o.data.update()


def bake_ao(o, ground):
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = 48
    sc.render.bake.target = 'VERTEX_COLORS'
    if sc.world is None: sc.world = bpy.data.worlds.new('bake')
    sc.world.light_settings.distance = 1.5
    bpy.ops.mesh.primitive_plane_add(size=1, location=(o.location.x, o.location.y, o.location.z - .002))
    gnd = bpy.context.active_object; gnd.scale = (ground, ground, 1)
    ca = o.data.color_attributes.new('ao', 'BYTE_COLOR', 'CORNER')
    o.data.color_attributes.active_color = ca; o.data.color_attributes.render_color_index = o.data.color_attributes.active_color_index
    bpy.ops.object.select_all(action='DESELECT'); o.select_set(True); bpy.context.view_layer.objects.active = o
    bpy.ops.object.bake(type='AO')
    bpy.data.objects.remove(gnd, do_unlink=True)
    n = len(ca.data); buf = [0.0] * (n * 4); ca.data.foreach_get('color', buf)
    for i in range(n):
        a = 0.3 + 0.7 * max(buf[i * 4], 0.0) ** 0.8; buf[i * 4] = buf[i * 4 + 1] = buf[i * 4 + 2] = a
    ca.data.foreach_set('color', buf)
    print(f'ao  {o.name}  {len(o.data.polygons)} faces')


objs = [(fuel(), 14), (belt(), 12), (push(), 10), (gpu(), 6), (tower(), 8), (stairs(), 12), (cone(), 2), (chock(), 2),
        (cater(), 12), (dolly(), 6), (bus(), 18), (sock(), 4), (arff(), 16), (fod(), 2), (ext(), 2)]
for i, (o, _) in enumerate(objs): o.location = (i * 20, 0, 0); finish(o)
for o, g in objs:
    for p, _ in objs: p.hide_render = p is not o
    bake_ao(o, g)
for o, _ in objs: o.hide_render = False; o.location = (0, 0, 0)
export_glb('airgse.glb', export_vertex_color='ACTIVE')
