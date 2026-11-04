# 霓虹夜城（260）灰鷺角機場的建築：航廈、空橋、塔台、機庫、第二航廈 T2、滑行道指示牌（52-air-bld.js 擺；取代原本下載的鯨魚航廈、AI 空橋、舊金山塔台、萊昂機庫）
# 執行：/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P blender/airbld.py   → blender/out/airbld.glb，再 npm run build
# 這個檔用「遊戲座標」寫：x 東、y 上、z 南（SEA_FR 框，原點在各建築的中心），G() 轉成 Blender（x, −z, y）＝匯出 glTF 後剛好回到遊戲座標（純旋轉，面的方向不變）。
# 材質名稱帶遊戲的材質代號（50-assets.js 的 matId）：t29 鋼板、t33 環氧地坪、t34 烤漆鋼板、t39 立邊鋼板屋頂、t43 清水混凝土、t49 簷下崁燈天花、
# t53 航廈帷幕玻璃（後面的大廳是 src/tsl/air-int.mjs 的 interior mapping）、t56 T2 的帷幕玻璃（hall2）、t23 木紋、t45 洞石、t54 小房間玻璃（空橋通道、塔台基座、機庫工作間）、t55 波浪鋼板、
# t57 內照式標誌牌（滑行道指示牌）、m1 玻璃、m2 霧面、m10 黃漆、m16 入夜亮的燈。不靠貼圖：細節都是幾何（竪框、橫框、肋、桁架）＋程式材質；字（招牌、登機門號、機庫號）是 Blender 內建字型轉成的網格。
# 大建築不倒角（2 cm 在 100 m 尺度看不到），只每 STEP 公尺切一刀讓烘的 AO 有頂點可以存；空橋 1 m。
import math, os, sys
import bmesh, bpy
from mathutils import Vector
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *

reset()
M = {
    'glass': mat('t53_tglass', '#0b1014', 0.05, 0.0), 'oglass': mat('t54_room', '#0b1014', 0.05, 0.0), 'cglass': mat('m1_cabglass', '#1b2a2c', 0.05, 0.0), 'dglass': mat('m1_door', '#111619', 0.05, 0.0),
    'roof': mat('t39_roof', '#a7acb1', 0.45, 0.3), 'soffit': mat('t49_soffit', '#c9c4bb', 0.6, 0.0), 'fascia': mat('t34_fascia', '#d9dbdd', 0.4, 0.1),
    'white': mat('t34_white', '#cfd2d4', 0.4, 0.1), 'grey': mat('t34_grey', '#7d8288', 0.45, 0.2), 'dark': mat('t34_dark', '#383b40', 0.5, 0.2),
    'clad': mat('t29_clad', '#8d939a', 0.5, 0.3), 'hclad': mat('t55_hangar', '#7c858e', 0.5, 0.3), 'wcorr': mat('t55_skirt', '#cfd2d4', 0.45, 0.2), 'door': mat('t29_door', '#4c5156', 0.5, 0.3),
    'conc': mat('t43_conc', '#a9a59e', 0.85, 0.0), 'tconc': mat('t43_tower', '#bdb8b0', 0.85, 0.0), 'floor': mat('t33_floor', '#8e9296', 0.5, 0.0),
    'galv': mat('t22_galv', '#9a9ea2', 0.5, 0.7), 'rubber': mat('m2_rubber', '#1b1b1d', 0.9, 0.0), 'black': mat('m2_black', '#141416', 0.85, 0.0),
    'redp': mat('t34_red', '#a3201a', 0.45, 0.1), 'yel': mat('m10_gse_yel', '#d9a21a', 0.35, 0.1), 'ysign': mat('m16_ysign', '#f2b51c', 0.4, 0.0, emit='#ffc233'),
    't2glass': mat('t56_t2glass', '#0b1014', 0.05, 0.0), 'wood': mat('t23_t2wood', '#7a5434', 0.7, 0.0), 'trav': mat('t45_trav', '#c8bca8', 0.6, 0.0),
    'fin': mat('m1_fin', '#2b3a40', 0.05, 0.0),
    'sy': mat('t57_sgn_yel', '#f0b81e', 0.3, 0.0), 'sr': mat('t57_sgn_red', '#c41a17', 0.3, 0.0), 'sw': mat('t57_sgn_wht', '#f4f2ec', 0.3, 0.0),   # 滑行道指示牌的面板與字（t57：入夜發光）
    'led': mat('m16_led', '#fff4e4', 0.4, 0.0, emit='#fff4e4'), 'red': mat('m16_red', '#ff2a1c', 0.4, 0.0, emit='#ff2a1c'), 'bay': mat('m16_bay', '#fff8ec', 0.3, 0.0, emit='#fff8ec'),
}


from airkit import *

# ════════ 航廈：長 156 m（x）、深 90 m（z）的弧形大屋頂，四周懸挑。南面（+z）是機坪：地面層是混凝土牆與捲門，4.2–5.4 m 樓板帶，以上是帷幕；
# 北面是出境大廳的落地帷幕；東端是跟著屋頂弧線的玻璃山牆，朝航廈前的廣場是入口（雨遮、旋轉門、自動門）；西端是金屬板。屋頂外是樹狀柱。
TW, TD = 78.0, 45.0          # 牆的半長、半深
EX, EZ = 82.0, 51.0          # 屋簷的半長、半深
R_T, Y_PK, Y_EV = 129.1, 27.0, 16.5
def roof_y(z): return Y_PK - R_T + math.sqrt(R_T * R_T - z * z)   # 屋頂上緣（沿 z 的圓弧）
RT = 1.2                      # 屋頂厚度
WALL_TOP = roof_y(TD) - RT    # 南北牆頂（屋頂底面）


def term():
    b = GB(21); zs = [-EZ + 2 * EZ * i / 34 for i in range(35)]; xs = [-EX + 2 * EX * i / 41 for i in range(42)]
    # 屋頂上面（立邊鋼板，接縫沿坡）與底面（簷下崁燈天花），沿 x 的每一段是一條帶
    for i in range(len(xs) - 1):
        x0, x1 = xs[i], xs[i + 1]
        b.strip([(x0, roof_y(z), z) for z in zs], [(x1, roof_y(z), z) for z in zs], M['roof'])
        b.strip([(x1, roof_y(z) - RT, z) for z in zs], [(x0, roof_y(z) - RT, z) for z in zs], M['soffit'])
    # 簷口：南北是直的、東西跟著弧線；下緣一條入夜亮的燈帶
    for s in (-1, 1):
        z = s * EZ; y = roof_y(z)
        b.poly([(-EX, y - RT, z), (EX, y - RT, z), (EX, y, z), (-EX, y, z)] if s > 0 else [(EX, y - RT, z), (-EX, y - RT, z), (-EX, y, z), (EX, y, z)], M['fascia'])
        b.box(-EX, EX, y - RT - .08, y - RT + .04, z - .3 if s > 0 else z, z if s > 0 else z + .3, M['led'])
        x = s * EX
        top = [(x, roof_y(z2), z2) for z2 in zs]; bot = [(x, roof_y(z2) - RT, z2) for z2 in zs]
        b.strip(top, bot, M['fascia']) if s > 0 else b.strip(bot, top, M['fascia'])
    # 天窗：三條沿 x 的帶，略高於屋面，兩側有矮框
    for zc in (-21.0, 0.0, 21.0):
        y = roof_y(zc) + .25
        b.box(-66, 66, y - .25, y + .02, zc - 1.9, zc + 1.9, M['grey'])
        b.box(-65.6, 65.6, y, y + .06, zc - 1.6, zc + 1.6, M['cglass'])
        for x in range(-64, 65, 4): b.box(x - .06, x + .06, y + .02, y + .14, zc - 1.6, zc + 1.6, M['grey'])
    # 屋頂上的空調機組（西端）
    for x, z in ((-62, -10), (-62, 8), (-50, -2)):
        y = roof_y(z); b.box(x - 3, x + 3, y - .4, y + 2.2, z - 2.2, z + 2.2, M['galv'])
        for k in range(5): b.box(x - 2.6 + k * 1.2, x - 2.0 + k * 1.2, y + 2.2, y + 2.3, z - 1.8, z + 1.8, M['dark'])
    # ── 南面（機坪側，z = +TD，面朝 +z）
    zf = TD
    b.box(-TW, TW, 0, 4.2, zf - .6, zf, M['conc'])
    for x in range(-65, 66, 26):   # 捲門與旁邊的小門
        b.box(x - 2.6, x + 2.6, 0, 3.6, zf, zf + .04, M['door'])
        for k in range(18): b.box(x - 2.6, x + 2.6, .1 + k * .2, .14 + k * .2, zf + .04, zf + .07, M['dark'])
        b.box(x - 2.9, x + 2.9, 3.6, 3.9, zf, zf + .25, M['grey'])
        b.box(x + 4, x + 5, 0, 2.2, zf, zf + .05, M['grey'])
        b.box(x + 4.2, x + 4.8, 2.4, 2.5, zf, zf + .3, M['led'])
    b.box(-TW - .3, TW + .3, 4.2, 5.4, zf - .4, zf + .3, M['dark'])
    glass_wall(b, -TW, TW, 5.4, WALL_TOP, zf, 1)
    # ── 北面（出境大廳的帷幕，z = −TD，面朝 −z）
    zb = -TD
    b.box(-TW, TW, 0, .6, zb, zb + .6, M['conc'])
    glass_wall(b, -TW, TW, .6, WALL_TOP, zb, -1, band=(8.0, 8.8))
    # ── 東端玻璃山牆（x = +TW，面朝 +x，跟著屋頂弧線）與西端金屬板牆
    zz = [-TD + 3 * i for i in range(31)]
    for i in range(len(zz) - 1):
        z0, z1 = zz[i], zz[i + 1]
        if z0 < 2.6 and z1 > -2.6:   # 中間的自動門（z ±2.6、門楣 3.7）：門洞裡沒有玻璃，走得進室內（52-air-int.js）
            b.poly([(TW, 3.7, z1), (TW, 3.7, z0), (TW, roof_y(z0) - RT, z0), (TW, roof_y(z1) - RT, z1)], M['glass'])
            za, zb = (z0, -2.6) if z0 < -2.6 else (2.6, z1)
            if zb > za: b.poly([(TW, .6, zb), (TW, .6, za), (TW, 3.7, za), (TW, 3.7, zb)], M['glass'])
        else: b.poly([(TW, .6, z1), (TW, .6, z0), (TW, roof_y(z0) - RT, z0), (TW, roof_y(z1) - RT, z1)], M['glass'])
        b.poly([(-TW, 0, z0), (-TW, 0, z1), (-TW, roof_y(z1) - RT, z1), (-TW, roof_y(z0) - RT, z0)], M['clad'])
    b.box(TW - .6, TW, 0, .6, -TD, TD, M['conc'])
    for z in zz:   # 竪框（外凸 0.5 m 的鰭）
        b.box(TW, TW + .5, .6, roof_y(z) - RT, z - .08, z + .08, M['white'])
    for y in (6.0, 12.0, 18.0, 24.0):   # 橫框：只畫在弧線底下
        zl = math.sqrt(max(0.0, R_T * R_T - (y + RT - Y_PK + R_T) ** 2))
        if zl > 1: b.box(TW, TW + .18, y - .06, y + .06, -min(zl, TD), min(zl, TD), M['white'])
    b.box(-TW - .3, -TW, 0, 4.5, -TD, TD, M['conc'])
    # 東面入口（朝廣場）：48 m 寬的雨遮（上面鋼板、底面崁燈、前緣燈帶）、四根柱、兩座旋轉門與中間的自動門
    b.box(TW, TW + 10, 5.0, 5.45, -24, 24, M['fascia']); b.box(TW, TW + 9.9, 4.98, 5.0, -23.9, 23.9, M['soffit'])
    b.box(TW + 9.95, TW + 10.05, 4.9, 5.0, -24, 24, M['led'])
    for z in (-22.0, -8.0, 8.0, 22.0): b.vcyl(TW + 8.5, z, 0, 5.0, .25, 12, M['white'])
    for zc in (-12.0, 12.0):
        b.vcyl(TW + 1.6, zc, .6, 3.4, 1.6, 20, M['dglass']); b.vcyl(TW + 1.6, zc, 3.4, 3.7, 1.75, 20, M['dark'])
        for k in range(4): a_ = math.pi / 4 + k * math.pi / 2; b.beam((TW + 1.6, .6, zc), (TW + 1.6 + 1.55 * math.cos(a_), .6, zc + 1.55 * math.sin(a_)), .04, M['dark'])
    # 中間的自動門開著（airint.py 的室內從這裡走進去）：兩片門扇滑進兩側的固定扇後面，留 5.2 m 的開口；地檻是不鏽鋼
    for s in (-1, 1):
        b.box(TW, TW + .35, .6, 3.4, min(s * 2.6, s * 5.0), max(s * 2.6, s * 5.0), M['dglass'])
        b.box(TW - .45, TW - .1, .6, 3.4, min(s * 2.75, s * 5.0), max(s * 2.75, s * 5.0), M['dglass'])
    for z in (-5.0, -2.6, 2.6, 5.0): b.box(TW - .5, TW + .42, .6, 3.4, z - .07, z + .07, M['dark'])
    b.box(TW - .6, TW + .5, .58, .62, -2.6, 2.6, M['galv'])
    b.box(TW, TW + .5, 3.4, 3.7, -5.2, 5.2, M['dark'])
    # 樹狀柱：南北兩排、每 24 m，柱身漸細，頂上四根分枝撐住屋頂底面
    for s in (-1, 1):
        zc = s * (TD + 4.5)
        for x in range(-72, 73, 24):
            b.vcyl(x, zc, 0, 10.5, .55, 16, M['white'], r1=.4)
            b.vcyl(x, zc, 0, .25, .8, 16, M['grey'])
            for dx, dz in ((-3.2, -2.2), (3.2, -2.2), (-3.2, 2.2), (3.2, 2.2)):
                tz = zc + dz; b.tube((x, 10.3, zc), (x + dx, roof_y(tz) - RT - .05, tz), .2, M['white'], 10)
    # ── 細節：帷幕外的遮陽百葉、招牌字、登機門號燈箱、地面層的設備、屋頂的維修走道、天溝與避雷針
    for zf_, s_, ys in ((TD, 1, (9.6, 14.2)), (-TD, -1, (13.6,))):   # 遮陽百葉：每支竪框一個托架、四片鋁葉往外逐片降一點
        for y in ys:
            x = -TW
            while x <= TW + 1e-6:
                b.box(x - .06, x + .06, y - .62, y + .06, min(zf_ + .45 * s_, zf_ + 2.35 * s_), max(zf_ + .45 * s_, zf_ + 2.35 * s_), M['grey']); x += 3.0
            for k in range(5):
                zk = zf_ + s_ * (.75 + k * .38); yk = y - k * .12
                b.box(-TW, TW, yk - .03, yk + .03, zk - .17, zk + .17, M['galv'])
    b.text('GREY HERON CAPE INTERNATIONAL AIRPORT', .95, (0, roof_y(EZ) - RT / 2, -EZ - .02), (-1, 0, 0), (0, 0, -1), M['led'], .14)   # 北面簷口（航廈前路）
    b.box(TW + 9.2, TW + 9.35, 5.45, 6.75, -15.5, 15.5, M['fascia']); b.box(TW + 9.35, TW + 9.4, 5.45, 5.55, -15.5, 15.5, M['dark'])                                                                 # 東面雨遮上的招牌：背板＋字
    b.text('GREY HERON CAPE AIRPORT', .95, (TW + 9.35, 6.1, 0), (0, 0, -1), (1, 0, 0), M['led'], .12)
    for i, gx in enumerate((-58.0, 0.0, 58.0)):   # 登機門號：空橋接進來的上方，黃底黑字的燈箱
        b.box(gx - 1.9, gx + 1.9, 7.85, 9.05, TD + .5, TD + .62, M['dark']); b.box(gx - 1.75, gx + 1.75, 7.95, 8.95, TD + .62, TD + .66, M['yel']); b.box(gx - 1.75, gx + 1.75, 7.86, 7.92, TD + .58, TD + .7, M['led'])
        b.text('A%d' % (i + 1), .85, (gx, 8.45, TD + .66), (1, 0, 0), (0, 0, 1), M['black'], .04)   # 在空橋固定段的頂（7.5 m）與百葉托架（9.2 m）之間
    zf = TD
    doors = list(range(-65, 66, 26))
    for x in doors:   # 捲門前的防撞柱（黃、黑一圈）
        for dx in (-3.3, 3.3):
            b.vcyl(x + dx, zf + .55, 0, 1.1, .12, 10, M['yel']); b.vcyl(x + dx, zf + .55, .72, .86, .126, 10, M['black'])
    for x in range(-52, 53, 26):   # 捲門之間：消防栓箱、配電箱、通風百葉、壁燈
        b.box(x - .45, x + .45, .9, 2.0, zf, zf + .25, M['redp']); b.box(x - .38, x + .38, .97, 1.93, zf + .25, zf + .27, M['dark'])
        b.box(x + 2.0, x + 3.1, .3, 1.9, zf, zf + .35, M['grey']); b.box(x + 2.05, x + 3.05, 1.5, 1.85, zf + .35, zf + .37, M['dark'])
        b.box(x - 4.6, x - 1.4, 2.6, 3.6, zf, zf + .05, M['dark'])
        for k in range(8): b.box(x - 4.6, x - 1.4, 2.66 + k * .12, 2.7 + k * .12, zf + .05, zf + .12, M['grey'])
    xs_ = sorted([-TW] + [v for x in doors for v in (x - 3.0, x + 5.3)] + [TW])
    for a, c in zip(xs_[0::2], xs_[1::2]):   # 牆腳的防撞護欄（門前斷開）
        if c - a > .5: b.box(a, c, .32, .58, zf, zf + .16, M['yel'])
    for s in (-1, 1):   # 天溝（簷口頂外緣）與避雷針
        z = s * EZ; y = roof_y(z)
        b.box(-EX, EX, y - .15, y + .12, min(z, z - .4 * s), max(z, z - .4 * s), M['galv'])
        for x in range(-78, 79, 12): b.tube((x, y, z - .6 * s), (x, y + .9, z - .6 * s), .02, M['galv'], 6)
    for zc in (-10.5, 10.5):   # 維修走道：沿 x 的格柵板與單邊欄杆
        y = roof_y(zc) + .12
        b.box(-70, 70, y - .1, y, zc - .4, zc + .4, M['dark'])
        b.rail([(-70, y, zc + .42), (70, y, zc + .42)], 1.0, M['yel'], post=2.0)
    for x, z in ((58, -12), (58, 12), (66, 0)):   # 東端屋頂的排風機
        y = roof_y(z); b.vcyl(x, z, y - .3, y + .9, .7, 14, M['galv']); b.vcyl(x, z, y + .9, y + 1.0, .75, 14, M['dark'])
    return b.build('air_term')


def glass_wall(b, x0, x1, y0, y1, z, s, band=None):
    """南北帷幕：玻璃面（面朝 s·z）、每 3 m 一支外凸 0.45 m 的竪框、每 2.4 m 一道橫框；band 是樓板帶的高度"""
    if s > 0: b.poly([(x0, y0, z), (x1, y0, z), (x1, y1, z), (x0, y1, z)], M['glass'])
    else: b.poly([(x1, y0, z), (x0, y0, z), (x0, y1, z), (x1, y1, z)], M['glass'])
    x = x0
    while x <= x1 + 1e-6:
        b.box(x - .07, x + .07, y0, y1, min(z, z + .45 * s), max(z, z + .45 * s), M['white']); x += 3.0
    y = y0 + 2.4
    while y < y1 - .3:
        b.box(x0, x1, y - .04, y + .04, min(z, z + .12 * s), max(z, z + .12 * s), M['white']); y += 2.4
    if band: b.box(x0, x1, band[0], band[1], min(z, z + .5 * s), max(z, z + .5 * s), M['dark'])


# ════════ 第二航廈 T2：長 320 m（x ±160）、深 60 m（z ±30）的線形航廈，摺板屋頂（12 m 一摺、摺高 1.4 m）往空側（北，−z）升高，
# 屋頂底面是木格柵（t23）；空側地面層是深色板牆與捲門、4.4 m 以上整面玻璃（t56，後面是 air-int.mjs 的 hall2）＋外凸的玻璃肋；
# 陸側整面玻璃到地、入口門組、8.4 m 高的落客雨遮；兩端是金屬板牆與直條窗。四座空橋接在北面（local x −105、−35、35、105，門牌 B1–B4）。
T2X, T2Z = 160.0, 30.0
T2_EZ0, T2_EZ1 = -38.0, 36.0           # 屋簷（空側懸挑 8 m、陸側 6 m）
T2_P, T2_A, T2_RT = 12.0, 1.4, 1.3     # 摺的週期、摺高、屋頂厚
def t2_under(z): return 17.0 - .08 * z  # 屋頂底面（摺的谷）
def t2_fold(x): f = ((x + 166.0) % T2_P) / T2_P; return T2_A * (1 - abs(2 * f - 1))
T2_GATES = (-105.0, -35.0, 35.0, 105.0)


def term2():
    b = GB(31)
    xs = [-166.0 + 6.0 * i for i in range(int(332 / 6) + 1)]
    yu = lambda x, z: t2_under(z) + t2_fold(x)
    # 屋頂：上面（立邊鋼板）、底面（木格柵）、前後簷口（白）、兩端
    for xa, xb in zip(xs, xs[1:]):
        z0, z1 = T2_EZ0, T2_EZ1
        b.poly([(xa, yu(xa, z0) + T2_RT, z0), (xa, yu(xa, z1) + T2_RT, z1), (xb, yu(xb, z1) + T2_RT, z1), (xb, yu(xb, z0) + T2_RT, z0)], M['roof'])
        b.poly([(xb, yu(xb, z0), z0), (xb, yu(xb, z1), z1), (xa, yu(xa, z1), z1), (xa, yu(xa, z0), z0)], M['wood'])
        b.poly([(xa, yu(xa, z0), z0), (xa, yu(xa, z0) + T2_RT, z0), (xb, yu(xb, z0) + T2_RT, z0), (xb, yu(xb, z0), z0)], M['fascia'])
        b.poly([(xb, yu(xb, z1), z1), (xb, yu(xb, z1) + T2_RT, z1), (xa, yu(xa, z1) + T2_RT, z1), (xa, yu(xa, z1), z1)], M['fascia'])
        b.box(xa, xb, yu(xa, z0) - .12, yu(xa, z0) - .02, z0 + .1, z0 + .5, M['led']) if abs(xa % 24) < 1e-6 else None
    for x, s in ((xs[0], -1), (xs[-1], 1)):
        pts = [(x, yu(x, T2_EZ0), T2_EZ0), (x, yu(x, T2_EZ1), T2_EZ1), (x, yu(x, T2_EZ1) + T2_RT, T2_EZ1), (x, yu(x, T2_EZ0) + T2_RT, T2_EZ0)]
        b.poly(pts if s > 0 else pts[::-1], M['fascia'])
    # 屋脊上的天窗帶（每個摺的頂，1.2 m 寬的玻璃）與屋頂設備、維修走道
    for x in xs[1::2]:
        if abs(x) > 160: continue
        for z0, z1 in ((-30, -2), (2, 30)):
            b.box(x - .6, x + .6, yu(x, z0) + T2_RT, yu(x, z0) + T2_RT + .25, z0, z1, M['cglass'])
    for x in (-130, -70, 70, 130):
        y = yu(x - 3, 0) + T2_RT; b.box(x - 5, x + 5, y, y + 2.2, -6, 6, M['grey'])
        for k in range(3): b.vcyl(x - 3 + k * 3, -3, y + 2.2, y + 2.6, .9, 14, M['dark'])
    # ── 空側（北，z −30）：地面層深色板牆＋捲門（行李與服務）、樓板帶、玻璃（谷到地）、玻璃肋
    zN = -T2Z
    b.box(-T2X, T2X, 0, 4.4, zN - .1, zN + .3, M['dark'])
    for x in range(-150, 151, 24):
        b.box(x - 2.4, x + 2.4, 0, 3.6, zN - .14, zN - .1, M['door'])
        for k in range(12): b.box(x - 2.35, x + 2.35, .2 + k * .28, .23 + k * .28, zN - .16, zN - .14, M['grey'])
        b.box(x + 3.2, x + 4.1, 0, 2.2, zN - .14, zN - .1, M['door'])
        b.box(x - 2.6, x + 2.6, 3.7, 3.85, zN - .4, zN - .1, M['led'])
    b.box(-T2X, T2X, 4.4, 5.2, zN - .5, zN + .3, M['fascia'])
    for xa, xb in zip(xs, xs[1:]):
        xa2, xb2 = max(xa, -T2X), min(xb, T2X)
        if xb2 <= xa2: continue
        b.poly([(xb2, 5.2, zN), (xa2, 5.2, zN), (xa2, yu(xa2, zN), zN), (xb2, yu(xb2, zN), zN)], M['t2glass'])
    x = -T2X
    while x <= T2X + 1e-6:   # 玻璃肋：2.5 m 一片、往外 0.6 m，頂上一支白色的鋼接頭
        b.box(x - .03, x + .03, 5.2, yu(x, zN) - .05, zN - .6, zN, M['fin']); b.box(x - .06, x + .06, yu(x, zN) - .4, yu(x, zN), zN - .65, zN, M['white']); x += 2.5
    for y in (12.0,):
        b.box(-T2X, T2X, y - .05, y + .05, zN - .15, zN, M['white'])
    for gx in T2_GATES:   # 空橋接口：門框、上面的黃底門牌 B1–B4
        b.box(gx - 2.3, gx + 2.3, 4.3, 8.1, zN - 1.2, zN, M['white'])
        b.box(gx - 1.9, gx + 1.9, 4.6, 7.6, zN - 1.25, zN - 1.2, M['dark'])
    for i, gx in enumerate(T2_GATES):
        b.box(gx - 1.6, gx + 1.6, 8.6, 9.9, zN - .5, zN - .3, M['yel'])
        b.text(f'B{i + 1}', .95, (gx, 9.25, zN - .52), (-1, 0, 0), (0, 0, -1), M['black'], .06)
        b.box(gx - 1.6, gx + 1.6, 8.5, 8.6, zN - .55, zN - .3, M['led'])
    # 空側的柱：圓錐形的白柱撐懸挑（在谷的位置，24 m 一支）
    for x in [v for v in xs if abs(v) < 158 and abs(round((v + 166) / 12) - (v + 166) / 12) < 1e-6 and int(round((v + 166) / 12)) % 2 == 0]:
        b.vcyl(x, -35.0, 0, t2_under(-35.0), .55, 16, M['white'], r1=.32)
        b.vcyl(x, -35.0, 0, .35, .9, 16, M['conc'])
    # ── 陸側（南，z +30）：石材基座、玻璃到谷、玻璃肋、入口門組
    zS = T2Z
    xb_ = [-T2X] + [v for d in (-20, 20, 60, 100, 140) for v in (d - 1.6, d + 1.6)] + [T2X]   # 洞石基座：打開的門口斷開（室內的坡從 0.6 往外降，airint.py）
    for a, c in zip(xb_[0::2], xb_[1::2]): b.box(a, c, 0, .6, zS - .3, zS + .25, M['trav'])
    T2_OPEN = (-20, 20, 60, 100, 140)   # 打開的門斗（airint.py 的 T2_DOORS_OPEN）：門斗那 9 m 的玻璃只從門楣 4.2 m 以上，底下走得進室內
    for xa, xb in zip(xs, xs[1:]):
        xa2, xb2 = max(xa, -T2X), min(xb, T2X)
        if xb2 <= xa2: continue
        cut = [(max(xa2, d - 4.5), min(xb2, d + 4.5)) for d in T2_OPEN if d - 4.5 < xb2 and d + 4.5 > xa2]
        if not cut: b.poly([(xa2, .6, zS), (xb2, .6, zS), (xb2, yu(xb2, zS), zS), (xa2, yu(xa2, zS), zS)], M['t2glass']); continue
        b.poly([(xa2, 4.2, zS), (xb2, 4.2, zS), (xb2, yu(xb2, zS), zS), (xa2, yu(xa2, zS), zS)], M['t2glass'])
        x = xa2
        for c0, c1 in cut + [(xb2, xb2)]:
            if c0 > x + 1e-6: b.poly([(x, .6, zS), (c0, .6, zS), (c0, 4.2, zS), (x, 4.2, zS)], M['t2glass'])
            x = max(x, c1)
    x = -T2X
    while x <= T2X + 1e-6:
        b.box(x - .03, x + .03, .6, yu(x, zS) - .05, zS, zS + .5, M['fin']); x += 2.5
    b.box(-T2X, T2X, 6.2, 6.9, zS - .2, zS + .55, M['fascia'])   # 夾層的樓板封邊（外面看得到的一條）
    for x in range(-140, 141, 40):   # 入口：雙層自動門的門斗、門框、上方的亮條（打開的五座：兩側玻璃、前後兩道門扇推開到兩邊，中間 3.2 m 走得過）
        if x in T2_OPEN:
            for s_ in (-1, 1):
                b.box(min(x + s_ * 4.5, x + s_ * 4.42), max(x + s_ * 4.5, x + s_ * 4.42), .6, 3.6, zS, zS + 3.2, M['dglass'])
                for zz in (zS + .05, zS + 3.15): b.box(min(x + s_ * 1.6, x + s_ * 4.42), max(x + s_ * 1.6, x + s_ * 4.42), .6, 3.6, zz - .04, zz + .04, M['dglass'])
            b.box(x - 4.5, x + 4.5, 3.56, 3.6, zS, zS + 3.2, M['dglass'])
        else: b.box(x - 4.5, x + 4.5, 0, 3.6, zS, zS + 3.2, M['dglass'])
        b.box(x - 4.7, x + 4.7, 3.6, 4.2, zS, zS + 3.4, M['white'])
        b.box(x - 4.7, x - 4.5, 0, 3.6, zS, zS + 3.4, M['white']); b.box(x + 4.5, x + 4.7, 0, 3.6, zS, zS + 3.4, M['white'])
        b.box(x - .03, x + .03, 0, 3.6, zS + 3.2, zS + 3.25, M['dark'])
        b.box(x - 3.5, x + 3.5, 3.75, 3.95, zS + 3.4, zS + 3.45, M['led'])
    # 落客雨遮：8.4 m 高、伸到 z 60（落客道外緣），細柱、底面燈條、前緣的站名
    yc = 8.4
    b.box(-T2X, T2X, yc, yc + .7, zS, 60, M['fascia'])
    b.box(-T2X, T2X, yc - .02, yc, zS + .5, 59.5, M['soffit'])
    for z in range(34, 60, 4): b.box(-T2X + 2, T2X - 2, yc - .1, yc - .02, z - .1, z + .1, M['led'])
    for x in range(-150, 151, 20):
        b.vcyl(float(x), 57.0, .14, yc, .28, 12, M['white']); b.vcyl(float(x), 57.0, .14, .5, .5, 12, M['conc'])
    b.box(-T2X, T2X, yc + .7, yc + 1.6, 59.6, 60.0, M['fascia'])
    b.text('GREY HERON CAPE  TERMINAL 2', 1.0, (0, yc + 1.15, 60.02), (1, 0, 0), (0, 0, 1), M['led'], .12)
    for x in range(-150, 151, 10):   # 安全島路緣（落客道在 z 36..54 外側，21-air.js 的 curb2）的不鏽鋼護柱
        b.vcyl(float(x), 54.6, .14, 1.1, .12, 10, M['galv'])
    # ── 兩端：金屬板牆、直條窗、大字 T2
    for s in (-1, 1):
        x = s * T2X
        b.box(min(x, x + s * .4), max(x, x + s * .4), 0, t2_under(-T2Z), -T2Z, T2Z, M['clad'])
        for z in range(-24, 25, 6): b.box(min(x, x + s * .45), max(x, x + s * .45), 1.0, 14.0, z - .6, z + .6, M['oglass'])
        for y in (3.0, 6.0, 9.0, 12.0, 15.0): b.box(min(x, x + s * .5), max(x, x + s * .5), y - .04, y + .04, -T2Z, T2Z, M['grey'])
    b.text('T2', 9.0, (T2X + .5, 9.0, 0), (0, 0, -1), (1, 0, 0), M['ysign'], .4)
    b.text('T2', 9.0, (-T2X - .5, 9.0, 0), (0, 0, 1), (-1, 0, 0), M['ysign'], .4)
    # 地面層的細節：空側的防撞桿、消防箱
    for x in range(-150, 151, 12):
        b.vcyl(float(x) + 6, zN - 1.0, 0, 1.0, .15, 10, M['yel'])
    for x in (-120, -60, 0, 60, 120):
        b.box(x - .5, x + .5, .9, 1.9, zN - .35, zN - .1, M['redp'])
    return b.build('air_t2')


# ════════ 空橋：原點是旋轉廳的中心；固定段往北（−z）接進航廈，伸縮段往南（+z）兩節，末端的機艙往東（+x）伸出遮棚接客機左前門
J_ROT_Y = 4.4                 # 旋轉廳地板
J_CAB_Z = 24.6                # 機艙中心（旋轉廳往南）
J_CAB_Y = 2.85                # 機艙地板＝客機前門門檻
J_DOOR_X = 2.5                # 遮棚外緣（客機左側機身）


def tunnel(b, za, zb, ya, yb, hw, h, ribs=1.5):
    """一節伸縮通道：地板從 (za, ya) 斜到 (zb, yb)；兩側玻璃、鋼骨肋、波浪鋼板屋頂、深色底"""
    fy = lambda z: ya + (yb - ya) * (z - za) / (zb - za)
    b.poly([(-hw, fy(za), za), (hw, fy(za), za), (hw, fy(zb), zb), (-hw, fy(zb), zb)], M['dark'])                          # 底（朝下）
    b.poly([(-hw, fy(za) + h, za), (-hw, fy(zb) + h, zb), (hw, fy(zb) + h, zb), (hw, fy(za) + h, za)], M['clad'])          # 屋頂（朝上）
    b.poly([(hw, fy(za) + .5, za), (hw, fy(za) + h - .25, za), (hw, fy(zb) + h - .25, zb), (hw, fy(zb) + .5, zb)], M['oglass'])
    b.poly([(-hw, fy(zb) + .5, zb), (-hw, fy(zb) + h - .25, zb), (-hw, fy(za) + h - .25, za), (-hw, fy(za) + .5, za)], M['oglass'])
    for s in (-1, 1):
        b.poly([(s * hw, fy(za), za), (s * hw, fy(za) + .5, za), (s * hw, fy(zb) + .5, zb), (s * hw, fy(zb), zb)][::(1 if s > 0 else -1)], M['wcorr'])
        b.poly([(s * hw, fy(za) + h - .25, za), (s * hw, fy(za) + h, za), (s * hw, fy(zb) + h, zb), (s * hw, fy(zb) + h - .25, zb)][::(1 if s > 0 else -1)], M['white'])
    n = max(1, int((zb - za) / ribs))
    for i in range(n + 1):
        z = za + (zb - za) * i / n; y = fy(z)
        for s in (-1, 1): b.box(s * hw - .07 if s > 0 else -hw - .05, s * hw + .05 if s > 0 else -hw + .07, y, y + h, z - .06, z + .06, M['white'])
        b.box(-hw - .05, hw + .05, y + h, y + h + .06, z - .06, z + .06, M['white'])
    for i in range(int((zb - za) / .5)):   # 屋頂的波浪
        z = za + .25 + i * .5; y = fy(z) + h
        b.box(-hw + .05, hw - .05, y, y + .04, z - .08, z + .08, M['grey'])


def jetway():
    b = GB(22)
    # 旋轉廳：圓筒（白）、腰帶窗、平頂，下面一根混凝土柱
    b.vcyl(0, 0, J_ROT_Y - .3, J_ROT_Y + 3.1, 2.4, 24, M['white'])
    b.vcyl(0, 0, J_ROT_Y + .9, J_ROT_Y + 2.2, 2.42, 24, M['glass'], cap=False)
    b.vcyl(0, 0, J_ROT_Y + 3.1, J_ROT_Y + 3.3, 2.55, 24, M['grey'])
    b.vcyl(0, 0, 0, J_ROT_Y - .3, .5, 16, M['conc']); b.vcyl(0, 0, 0, .3, 1.0, 16, M['conc'])
    # 固定段：往北 10 m 接進航廈的樓板帶（地板 4.6 → 4.4），一根柱
    tunnel(b, -10.5, -2.2, 4.6, J_ROT_Y, 1.5, 2.9)
    b.vcyl(0, -6.5, 0, 4.4, .3, 12, M['grey'])
    # 伸縮段：外節（寬）與內節（窄），從旋轉廳往南斜下到機艙
    ya, yb, za, zb = J_ROT_Y, J_CAB_Y, 2.3, J_CAB_Z - 2.0
    fy = lambda z, ya=ya, yb=yb, za=za, zb=zb: ya + (yb - ya) * (z - za) / (zb - za)   # 預設參數綁住：後面機艙的迴圈會重用 za／zb 這些名字
    tunnel(b, za, 14.0, ya, fy(14.0), 1.55, 2.95)
    tunnel(b, 12.6, zb, fy(12.6), yb, 1.38, 2.7)
    b.box(-1.62, 1.62, fy(14.0) - .1, fy(14.0) + 3.05, 13.9, 14.1, M['dark'])   # 外節的端框
    # 升降柱：兩根伸縮柱、橫樑、轉向輪架（四個輪子）、油壓缸
    zc = 17.5; y = fy(zc)
    for s in (-1, 1):
        b.box(s * 1.1 - .2, s * 1.1 + .2, 1.0, y - .1, zc - .2, zc + .2, M['grey'])
        b.box(s * 1.1 - .15, s * 1.1 + .15, .6, 1.0, zc - .15, zc + .15, M['galv'])
        b.tube((s * 1.1, 1.3, zc + .25), (s * 1.1, y - .3, zc + .25), .06, M['galv'])
    b.box(-1.5, 1.5, y - .35, y - .05, zc - .3, zc + .3, M['grey'])
    b.box(-1.6, 1.6, .55, 1.0, zc - .9, zc + .9, M['yel'])
    for s in (-1, 1):
        for dz in (-.55, .55): b.xcyl(s * 1.05 - .16 if s > 0 else -1.05 - .16, s * 1.05 + .16 if s > 0 else -1.05 + .16, .45, zc + dz, .45, 16, M['rubber'])
    # 機艙：平面四角倒圓的白色外殼、分格的大窗（窗框、窗台）、斜邊的車頂與滴水槽，窗裡看得到操作台；
    # 東面接客機的是連續的橡膠折箱遮棚（一折一折往機身收窄）、前端的黑色保險桿框與兩側的軟簾
    cz0, cz1, cx0, cx1, cy0 = J_CAB_Z - 2.0, J_CAB_Z + 2.0, -1.7, 1.9, J_CAB_Y - .35
    yF, yR = cy0 + .35, cy0 + 3.05; rc = .35
    b.box(cx0, cx1, cy0, yF, cz0, cz1, M['dark'])                                                     # 地板（底下深色）
    def wall(xa, za, xb, zb, nrm, win):
        """一面牆：窗台以下與窗頂以上是白板，中間分格的窗（直櫺）；win=False 整面白"""
        ow(b, [(xa, yF, za), (xb, yF, zb), (xb, yR, zb), (xa, yR, za)], M['white'], nrm) if not win else None
        if win:
            for y0_, y1_ in ((yF, yF + 1.05), (yR - .3, yR)): ow(b, [(xa, y0_, za), (xb, y0_, zb), (xb, y1_, zb), (xa, y1_, za)], M['white'], nrm)
            ow(b, [(xa, yF + 1.05, za), (xb, yF + 1.05, zb), (xb, yR - .3, zb), (xa, yR - .3, za)], M['cglass'], nrm)
            L = math.hypot(xb - xa, zb - za); n = max(1, round(L / 1.1))
            for i in range(n + 1):
                t = i / n; x, z = xa + (xb - xa) * t, za + (zb - za) * t
                b.box(x - .04 + nrm[0] * .02, x + .04 + nrm[0] * .02, yF + 1.0, yR - .25, z - .04 + nrm[2] * .02, z + .04 + nrm[2] * .02, M['grey'])
            b.box(min(xa, xb) - .02 + nrm[0] * .06, max(xa, xb) + .02 + nrm[0] * .06, yF + .98, yF + 1.06, min(za, zb) - .02 + nrm[2] * .06, max(za, zb) + .02 + nrm[2] * .06, M['grey'])   # 窗台
    # 平面：西面兩角倒圓（東面整面開口接遮棚）
    P = [(cx1, cz0), (cx0 + rc, cz0)] + [(cx0 + rc - rc * math.sin(math.pi / 2 * k / 4), cz0 + rc - rc * math.cos(math.pi / 2 * k / 4)) for k in range(1, 4)] + [(cx0, cz0 + rc), (cx0, cz1 - rc)] + \
        [(cx0 + rc - rc * math.cos(math.pi / 2 * k / 4), cz1 - rc + rc * math.sin(math.pi / 2 * k / 4)) for k in range(1, 4)] + [(cx0 + rc, cz1), (cx1, cz1)]
    ow(b, [(cx1, yF, cz0), (1.38, yF, cz0), (1.38, yR, cz0), (cx1, yR, cz0)], M['white'], (0, 0, -1))   # 北面是通道接進來的開口，只補通道外的一小段
    for (xa, za), (xb, zb) in list(zip(P, P[1:]))[1:]:
        L = math.hypot(xb - xa, zb - za); nx, nz = (zb - za) / L, -(xb - xa) / L          # 平面上順時針走，右手邊是外面
        if nx * ((xa + xb) / 2 - (cx0 + cx1) / 2) + nz * ((za + zb) / 2 - J_CAB_Z) < 0: nx, nz = -nx, -nz
        wall(xa, za, xb, zb, (nx, 0, nz), L > 1.0)
    for z_, d in ((cz0, -1), (cz1, 1)):                                                                 # 東面兩側的窄牆（遮棚以外）
        ow(b, [(cx1 - .12, yF, z_), (cx1, yF, z_), (cx1, yR, z_), (cx1 - .12, yR, z_)], M['white'], (0, 0, d))
        za_, zb_ = sorted((z_, z_ - d * .62)); ow(b, [(cx1, yF, za_), (cx1, yF, zb_), (cx1, yR, zb_), (cx1, yR, za_)], M['white'], (1, 0, 0))
    ow(b, [(cx1, yR - .25, cz0 + .62), (cx1, yR - .25, cz1 - .62), (cx1, yR, cz1 - .62), (cx1, yR, cz0 + .62)], M['white'], (1, 0, 0))
    # 車頂：比牆大一點、四邊斜切，滴水槽，頂上的作業燈與冷氣機
    PR = [(x + (x - (cx0 + cx1) / 2) * .03, z + (z - J_CAB_Z) * .03) for x, z in P]
    for (xa, za), (xb, zb) in zip(PR, PR[1:]):
        ow(b, [(xa, yR, za), (xb, yR, zb), (xb + ((cx0 + cx1) / 2 - xb) * .06, yR + .22, zb + (J_CAB_Z - zb) * .06), (xa + ((cx0 + cx1) / 2 - xa) * .06, yR + .22, za + (J_CAB_Z - za) * .06)], M['white'], (xa - (cx0 + cx1) / 2, .6, za - J_CAB_Z))
    top = [(x + ((cx0 + cx1) / 2 - x) * .06, z + (J_CAB_Z - z) * .06) for x, z in PR]
    for i in range(1, len(top) - 1): ow(b, [(top[0][0], yR + .22, top[0][1]), (top[i][0], yR + .22, top[i][1]), (top[i + 1][0], yR + .22, top[i + 1][1])], M['white'], (0, 1, 0))
    ow(b, [(top[0][0], yR + .22, top[0][1]), (top[-1][0], yR + .22, top[-1][1]), (PR[-1][0], yR, PR[-1][1]), (PR[0][0], yR, PR[0][1])], M['white'], (1, 0, 0))
    for i in range(1, len(PR) - 1): ow(b, [(PR[0][0], yR, PR[0][1]), (PR[i][0], yR, PR[i][1]), (PR[i + 1][0], yR, PR[i + 1][1])], M['white'], (0, -1, 0))
    b.box(cx0 - .05, cx1, yR - .06, yR, cz1 + .1, cz1 + .14, M['grey'])
    b.box(cx0 + .3, cx0 + .9, yR + .22, yR + .4, cz0 + .4, cz0 + 1.0, M['led'])                        # 作業燈
    b.box(cx0 + .5, cx0 + 1.6, yR + .22, yR + .75, cz1 - 1.3, cz1 - .4, M['white'])                     # 機艙的冷氣機
    for k in range(4): b.box(cx0 + .48, cx0 + .5, yR + .3 + k * .1, yR + .34 + k * .1, cz1 - 1.25, cz1 - .45, M['dark'])
    b.box(cx0 + .25, cx0 + 1.25, yF, yF + 1.0, cz1 - 1.1, cz1 - .25, M['dark'])                         # 操作台（窗裡）
    b.box(cx0 + .3, cx0 + 1.2, yF + 1.0, yF + 1.04, cz1 - 1.05, cz1 - .3, M['led'])
    # 遮棚：十一道 U 形斷面的折箱，奇數道往外凸 5 cm（折峰），從機艙 2.75 m 寬漸縮到機身端；外面一層、裡面錯開 4 cm 再一層
    yb_ = cy0 + .3
    def uprof(w, h, r=.45, n=5):
        pts = [(-w, 0.0), (-w, h - r)]
        pts += [(-w + r - r * math.cos(math.pi / 2 * k / n), h - r + r * math.sin(math.pi / 2 * k / n)) for k in range(1, n)]
        pts += [(-w + r, h), (w - r, h)]
        pts += [(w - r + r * math.sin(math.pi / 2 * k / n), h - r + r * math.cos(math.pi / 2 * k / n)) for k in range(1, n)]
        return pts + [(w, h - r), (w, 0.0)]
    # 機身端照客機斷面收：機身中心在 x 4.5，門高處半寬 1.93 m，往上收到 y 5.0 剩 0.95 m，所以遮棚頂要比地板多伸出約 1 m 才貼得到機身
    HW = ((3.5, 1.93), (4.0, 1.84), (4.5, 1.50), (5.0, .95))
    def skin(y):
        if y <= HW[0][0]: return 4.5 - HW[0][1]
        for (ya_, wa), (yb2, wb) in zip(HW, HW[1:]):
            if y <= yb2: return 4.5 - (wa + (wb - wa) * (y - ya_) / (yb2 - ya_))
        return 4.5 - HW[-1][1]
    NR = 11; rings = []
    for k in range(NR):
        t = k / (NR - 1); x0_ = cx1 + .02
        bump = .05 if k % 2 else 0.0
        w, h = 1.36 - .12 * t + bump, 2.55 - .35 * t + bump
        rings.append([(x0_ + (skin(yb_ + yy) - .1 - x0_) * t, yb_ + yy, J_CAB_Z + zz) for zz, yy in uprof(w, h)])
    for A, Bq in zip(rings, rings[1:]):
        for i in range(len(A) - 1):
            q = [A[i], Bq[i], Bq[i + 1], A[i + 1]]; my = (A[i][1] + A[i + 1][1]) / 2 - (yb_ + 1.2); mz = (A[i][2] + A[i + 1][2]) / 2 - J_CAB_Z
            ow(b, q, M['rubber'], (0, my, mz))
            qi = [(p[0], yb_ + (p[1] - yb_) * .985, J_CAB_Z + (p[2] - J_CAB_Z) * .97) for p in q]
            ow(b, qi, M['dark'], (0, -my, -mz))
    # 機身端：黑色保險桿框（沿 U 形）、兩側垂下的軟簾、地板前緣
    last = rings[-1]
    for a_, c_ in zip(last, last[1:]): b.tube((a_[0] + .06, a_[1], a_[2]), (c_[0] + .06, c_[1], c_[2]), .07, M['black'], 8)
    for d in (-1, 1):
        zz = J_CAB_Z + d * 1.25
        for k in range(5): b.box(J_DOOR_X - .3 + k * .04, J_DOOR_X - .26 + k * .04, yb_ + .05, yb_ + 1.6, min(zz, zz + d * .02), max(zz, zz + d * .02) + k * .0, M['rubber'])
    b.box(cx1, J_DOOR_X - .05, cy0 + .3, cy0 + .35, J_CAB_Z - 1.0, J_CAB_Z + 1.0, M['galv'])
    # 服務梯：機艙西側往北下到地面，扶手
    n = 14; xa = cx0 - .55
    for i in range(n):
        y = cy0 - (cy0 / n) * (i + 1) + .02; z = cz0 + .3 - i * .27
        b.box(xa - .45, xa + .45, y, y + .05, z - .27, z, M['galv'])
    b.box(xa - .5, xa + .5, cy0 - .05, cy0, cz0, cz0 + 1.0, M['galv'])
    for s in (-1, 1):
        b.beam((xa + s * .48, cy0, cz0 + .3), (xa + s * .48, 0, cz0 + .3 - n * .27), .03, M['galv'])
        b.tube((xa + s * .48, cy0 + .95, cz0 + .3), (xa + s * .48, .95, cz0 + .3 - n * .27), .025, M['galv'])
        for k in range(4):
            t = k / 3; b.tube((xa + s * .48, cy0 * (1 - t), cz0 + .3 - n * .27 * t), (xa + s * .48, cy0 * (1 - t) + .95, cz0 + .3 - n * .27 * t), .02, M['galv'])
    # ── 細節：旋轉廳的服務梯、通道底下的電纜槽與投光燈、PCA 空調機與黃色風管（沿地面接到機腹）、機艙的保險桿與底下的燈
    xl = -3.0; b.box(xl - .5, -2.3, J_ROT_Y - .08, J_ROT_Y, -.7, .7, M['galv'])   # 旋轉廳西側的平台、往北下到地面的樓梯
    b.box(-2.43, -2.4, J_ROT_Y, J_ROT_Y + 2.1, -.5, .5, M['dark'])
    for dz in (-.6, .6): b.vcyl(xl, dz, 0, J_ROT_Y - .08, .06, 8, M['galv'])
    ns = 17
    for i in range(ns):
        y = J_ROT_Y - (J_ROT_Y / ns) * (i + 1) + .02; z = -.7 - i * .28
        b.box(xl - .45, xl + .45, y, y + .05, z - .28, z, M['galv'])
    for sx in (-1, 1):
        b.beam((xl + sx * .48, J_ROT_Y, -.7), (xl + sx * .48, 0, -.7 - ns * .28), .03, M['galv'])
        b.tube((xl + sx * .48, J_ROT_Y + .95, -.7), (xl + sx * .48, .95, -.7 - ns * .28), .025, M['galv'], 6)
        for k in range(5):
            t = k / 4; b.tube((xl + sx * .48, J_ROT_Y * (1 - t), -.7 - ns * .28 * t), (xl + sx * .48, J_ROT_Y * (1 - t) + .95, -.7 - ns * .28 * t), .02, M['galv'], 6)
    b.rail([(xl - .5, J_ROT_Y, .7), (-2.3, J_ROT_Y, .7)], .95, M['galv'], post=.8)
    for za_, zb_ in ((2.6, 13.8), (12.9, 22.3)):   # 通道底下的電纜槽
        b.beam((-.7, fy(za_) - .32, za_), (-.7, fy(zb_) - .32, zb_), .14, M['galv'], .05)
    for zl in (8.0, 20.4): b.box(.3, .9, fy(zl) - .28, fy(zl) - .12, zl - .25, zl + .25, M['dark']); b.box(.35, .85, fy(zl) - .3, fy(zl) - .28, zl - .2, zl + .2, M['led'])
    yP = fy(8.0) - .15   # PCA：吊在外節底下的空調機（白、側面百葉），黃色風管垂下來沿地面接到機腹（客機中心 x 4.5、z 38.8）
    for zh in (6.6, 9.4):
        for xh in (-.7, .9): b.tube((xh, yP, zh), (xh, yP - .35, zh), .03, M['galv'], 6)
    b.box(-.9, 1.1, yP - 1.45, yP - .35, 6.3, 9.7, M['white'])
    for k in range(9): b.box(1.1, 1.14, yP - 1.3 + k * .11, yP - 1.26 + k * .11, 6.5, 8.6, M['dark'])
    b.box(-.6, .8, yP - 1.55, yP - 1.45, 8.8, 9.5, M['dark'])
    hose = [(.4, yP - 1.5, 9.4), (.55, yP - 1.9, 9.9), (.75, 1.3, 10.6), (1.0, .55, 11.6), (1.3, .2, 12.9), (2.0, .2, 17.0), (2.7, .2, 23.5), (3.2, .2, 29.0), (3.55, .25, 31.6), (3.75, .7, 32.7), (3.85, 1.25, 33.2)]
    for a, c in zip(hose, hose[1:]): b.tube(a, c, .16, M['yel'], 10)
    for p in hose[1:-1]: b.vcyl(p[0], p[2], p[1] - .17, p[1] + .17, .175, 10, M['yel'])   # 接頭（把折角補圓）
    b.box(J_DOOR_X - .16, J_DOOR_X - .02, J_CAB_Y - .05, J_CAB_Y + .12, J_CAB_Z - 1.15, J_CAB_Z + 1.15, M['black'])   # 機艙地板前緣的保險桿
    b.box(-.6, .6, J_CAB_Y - .55, J_CAB_Y - .35, J_CAB_Z - .3, J_CAB_Z + .3, M['dark']); b.box(-.55, .55, J_CAB_Y - .57, J_CAB_Y - .55, J_CAB_Z - .25, J_CAB_Z + .25, M['led'])
    return b.build('air_jetway')


# ════════ 塔台：兩層的基座（玻璃大廳＋金屬板）、12 邊形的混凝土塔身（南面一條樓梯窗）、設備層的環窗、往外傾的管制室玻璃、懸挑屋頂、天線與雷達罩
def tower():
    b = GB(23); N = 12
    def ring(r, y, rot=math.pi / N): return [(r * math.cos(rot + 2 * math.pi * i / N), y, r * math.sin(rot + 2 * math.pi * i / N)) for i in range(N)]
    def frustum(r0, y0, r1, y1, m):
        A, Bp = ring(r0, y0), ring(r1, y1)
        for i in range(N):
            j = (i + 1) % N; b.poly([A[i], Bp[i], Bp[j], A[j]], m)
    def disc(r, y, m, up=True):
        P = ring(r, y); b.poly(P[::-1] if up else P, m)
    # 基座
    b.box(-14, 14, 0, .5, -9, 9, M['conc'])
    for s in (-1, 1):
        b.poly([(-14, .5, s * 9), (14, .5, s * 9), (14, 4.2, s * 9), (-14, 4.2, s * 9)][::s], M['oglass'])
        b.poly([(s * 14, .5, -9), (s * 14, .5, 9), (s * 14, 4.2, 9), (s * 14, 4.2, -9)][::-s], M['oglass'])
        for x in range(-14, 15, 2): b.box(x - .06, x + .06, .5, 4.2, s * 9 - (.3 if s < 0 else 0), s * 9 + (.3 if s > 0 else 0), M['dark'])
        for z in range(-9, 10, 2): b.box(s * 14 - (.3 if s < 0 else 0), s * 14 + (.3 if s > 0 else 0), .5, 4.2, z - .06, z + .06, M['dark'])
    b.box(-14.2, 14.2, 4.2, 8.6, -9.2, 9.2, M['clad'])
    for s in (-1, 1): b.box(-12, 12, 5.6, 7.2, s * 9.2 - (.02 if s < 0 else 0), s * 9.2 + (.02 if s > 0 else 0), M['cglass'])
    b.box(-14.4, 14.4, 8.6, 9.0, -9.4, 9.4, M['fascia'])
    b.box(-6, 2, 3.6, 3.9, 9, 12.5, M['fascia']); b.box(-6, 2, 3.58, 3.6, 9, 12.4, M['soffit'])   # 入口雨遮
    for x in (-6, -2, 2): b.vcyl(x - .2 if x == 2 else x + .2, 12.2, 0, 3.6, .12, 10, M['white'])
    # 塔身
    frustum(4.4, 9.0, 3.4, 44.0, M['tconc'])
    b.box(-.8, .8, 10, 43, 3.6, 4.35, M['glass'])
    for y in range(12, 43, 3): b.box(-.85, .85, y - .05, y + .05, 3.6, 4.4, M['dark'])
    # 設備層（兩層，環窗）與走道
    frustum(5.6, 44.0, 5.6, 50.0, M['clad'])
    disc(5.6, 44.0, M['grey'], up=False)
    for y0 in (45.2, 47.9): frustum(5.62, y0, 5.62, y0 + 1.3, M['cglass'])
    disc(6.6, 44.0, M['grey'], up=False); frustum(6.6, 43.8, 6.6, 44.0, M['grey']); disc(6.6, 44.0, M['grey'])
    P = ring(6.5, 45.1, 0)
    for i in range(N): b.tube((P[i][0], 44.0, P[i][2]), P[i], .03, M['galv']); b.tube(P[i], P[(i + 1) % N], .03, M['galv'])
    # 管制室：地板、往外傾的玻璃、竪框
    frustum(6.2, 50.0, 6.2, 50.6, M['fascia']); disc(6.2, 50.0, M['grey'], up=False)
    frustum(6.0, 50.6, 7.1, 55.0, M['cglass'])
    A, Bp = ring(6.0, 50.6), ring(7.1, 55.0)
    for i in range(N): b.beam(A[i], Bp[i], .07, M['dark'])
    # 屋頂：懸挑的盤、簷下崁燈、上面的設備與天線、紅色障礙燈
    frustum(7.8, 55.0, 7.8, 55.7, M['fascia']); disc(7.8, 55.0, M['soffit'], up=False); disc(7.8, 55.7, M['roof'])
    b.box(-2, 2, 55.7, 57.2, -2, 2, M['clad'])
    b.vcyl(0, 0, 57.2, 58.8, 1.2, 16, M['white'], r1=.6); b.vcyl(0, 0, 58.8, 59.3, .6, 16, M['white'], r1=.1)
    for x, z, h in ((4.5, -3, 6.0), (-4.5, 3, 4.5), (3.5, 4.5, 3.0)):
        b.tube((x, 55.7, z), (x, 55.7 + h, z), .06, M['galv']); b.vcyl(x, z, 55.7 + h, 55.7 + h + .2, .1, 8, M['red'])
    b.box(-.2, .2, 55.7, 56.5, 6.4, 6.8, M['grey'])
    # ── 細節：基座屋頂的女兒牆與空調機、玻璃門、塔身每 9 m 一道施工縫環與中段的障礙燈、屋頂的欄杆、格構天線桅杆與兩面碟形天線
    b.box(-14.4, 14.4, 9.0, 9.9, 9.1, 9.4, M['fascia']); b.box(-14.4, 14.4, 9.0, 9.9, -9.4, -9.1, M['fascia'])
    for sx in (-1, 1): b.box(sx * 14.1 - .15, sx * 14.1 + .15, 9.0, 9.9, -9.1, 9.1, M['fascia'])
    for x, z in ((-9.5, -4.5), (-9.5, 3.5), (9.5, -4.0)):
        b.box(x - 1.6, x + 1.6, 9.0, 10.6, z - 1.2, z + 1.2, M['galv'])
        for k in range(3): b.vcyl(x - 1.0 + k * 1.0, z, 10.6, 10.75, .42, 12, M['dark'])
    for x in (-4.6, -3.4): b.box(x - .55, x + .55, .5, 3.1, 9.0, 9.06, M['dglass'])   # 入口的玻璃門（雨遮下）
    b.box(-5.3, -2.7, 3.1, 3.3, 9.0, 9.1, M['dark']); b.box(-5.3, -5.15, .5, 3.1, 9.0, 9.1, M['dark']); b.box(-2.85, -2.7, .5, 3.1, 9.0, 9.1, M['dark'])
    rr = lambda y: 4.4 + (3.4 - 4.4) * (y - 9.0) / 35.0
    for y in (18.0, 27.0, 36.0): frustum(rr(y) + .05, y, rr(y + .3) + .05, y + .3, M['grey'])
    for a_ in (0.3, 0.3 + math.pi):
        r_ = rr(27.5) + .1; b.vcyl(r_ * math.cos(a_), r_ * math.sin(a_), 27.4, 27.75, .12, 8, M['red'])
    P = ring(7.6, 55.7, 0)
    b.rail(P + [P[0]], 1.0, M['galv'], post=1.4)
    for i in range(3):   # 格構桅杆：三根腳往上收、之字形斜撐
        a0 = 2 * math.pi * i / 3; a1 = 2 * math.pi * (i + 1) / 3
        b.tube((-2 + .9 * math.cos(a0), 57.2, 2 + .9 * math.sin(a0)), (-2 + .25 * math.cos(a0), 66.0, 2 + .25 * math.sin(a0)), .045, M['galv'], 6)
        for k in range(8):
            y0_, y1_ = 57.2 + k * 1.1, 57.2 + (k + 1) * 1.1; r0, r1 = .9 - .65 * k / 8, .9 - .65 * (k + 1) / 8
            b.tube((-2 + r0 * math.cos(a0), y0_, 2 + r0 * math.sin(a0)), (-2 + r1 * math.cos(a1), y1_, 2 + r1 * math.sin(a1)), .02, M['galv'], 5)
    b.box(-2.9, -1.1, 55.7, 57.2, 1.1, 2.9, M['clad'])
    b.tube((-2, 66.0, 2), (-2, 68.5, 2), .03, M['galv'], 6); b.vcyl(-2, 2, 68.5, 68.7, .1, 8, M['red'])
    for y, z, sx in ((61.5, 2.0, 1), (64.0, 2.0, -1)):   # 碟形天線：一面朝東、一面朝西
        x0 = -2 + sx * .3
        b.xcyl(min(x0, x0 + sx * .25), max(x0, x0 + sx * .25), y, z, .55, 14, M['white']); b.xcyl(min(x0 + sx * .25, x0 + sx * .45), max(x0 + sx * .25, x0 + sx * .45), y, z, .12, 8, M['grey'])
    return b.build('air_tower')


# ════════ 機庫：114 × 76 m，沿 x 的弧形屋頂（簷高 20、頂 29），南面（+z）是 96 m 寬的開口，門扇收在兩側的門袋；
# 裡面看得到：環氧地坪、沿 x 的拱形桁架（鍍鋅）、天井燈（入夜亮）、後牆；後面一排兩層的工作間
HX, HZ = 57.0, 38.0
R_H, Y_HPK, Y_HEV = 185.0, 29.0, 20.0
def hroof(x): return Y_HPK - R_H + math.sqrt(R_H * R_H - x * x)
H_DOOR = 48.0


def hangar():
    b = GB(24); xs = sorted(set([round(-HX - 1 + (2 * HX + 2) * i / 40, 4) for i in range(41)] + [-H_DOOR, H_DOOR]))
    zs = [-HZ - 1, HZ + 1]
    for i in range(len(xs) - 1):   # 屋頂上面、底面
        x0, x1 = xs[i], xs[i + 1]
        b.poly([(x0, hroof(x0), zs[1]), (x1, hroof(x1), zs[1]), (x1, hroof(x1), zs[0]), (x0, hroof(x0), zs[0])], M['roof'])
        b.poly([(x0, hroof(x0) - .8, zs[0]), (x1, hroof(x1) - .8, zs[0]), (x1, hroof(x1) - .8, zs[1]), (x0, hroof(x0) - .8, zs[1])], M['white'])
        for s in (-1, 1):   # 前後的屋簷邊
            z = zs[1] if s > 0 else zs[0]
            P = [(x0, hroof(x0) - .8, z), (x1, hroof(x1) - .8, z), (x1, hroof(x1), z), (x0, hroof(x0), z)]
            b.poly(P if s > 0 else P[::-1], M['fascia'])
    # 側牆（x = ±HX）：鋼板＋高窗帶；裡面一層
    for s in (-1, 1):
        x = s * HX
        b.box(x - .3 if s > 0 else x, x if s > 0 else x + .3, 0, Y_HEV, -HZ, HZ, M['hclad'])
        b.box(x if s > 0 else x - .02, x + .02 if s > 0 else x, 14, 17.5, -HZ + 3, HZ - 3, M['cglass'])
    # 後牆（z = −HZ）：跟著弧線
    for i in range(len(xs) - 1):
        x0, x1 = max(xs[i], -HX), min(xs[i + 1], HX)
        if x1 <= x0: continue
        b.poly([(x1, 0, -HZ), (x0, 0, -HZ), (x0, hroof(x0) - .8, -HZ), (x1, hroof(x1) - .8, -HZ)], M['hclad'])
        b.poly([(x0, 0, -HZ + .3), (x1, 0, -HZ + .3), (x1, hroof(x1) - .8, -HZ + .3), (x0, hroof(x0) - .8, -HZ + .3)], M['clad'])
        # 正面門楣（開口上方，跟著弧線）
        ya = 21.0 if (x0 + x1) / 2 > -H_DOOR and (x0 + x1) / 2 < H_DOOR else 0.0   # 開口上方從 21 m 起，門袋那段落地
        b.poly([(x0, ya, HZ), (x1, ya, HZ), (x1, hroof(x1) - .8, HZ), (x0, hroof(x0) - .8, HZ)], M['hclad'])
        b.poly([(x1, ya, HZ - .3), (x0, ya, HZ - .3), (x0, hroof(x0) - .8, HZ - .3), (x1, hroof(x1) - .8, HZ - .3)], M['clad'])
    b.box(-H_DOOR, H_DOOR, 21.0, 22.6, HZ - .3, HZ + .5, M['dark'])                 # 門楣大樑
    b.box(-H_DOOR, H_DOOR, 20.6, 21.0, HZ - .2, HZ + .3, M['grey'])                 # 門的上軌
    for x in range(-44, 45, 8): b.box(x - .9, x + .9, 20.3, 20.6, HZ - .2, HZ + .4, M['led'])   # 門楣下的投光燈
    # 門扇（收在兩側門袋，三扇交錯）：鋼板、橫肋、一條窗
    for s in (-1, 1):
        for k in range(3):
            z0 = HZ + .2 + k * .8
            xa, xb = min(s * (H_DOOR + .3), s * (HX - .2)), max(s * (H_DOOR + .3), s * (HX - .2))
            b.box(xa, xb, 0, 20.4, z0, z0 + .5, M['door'])
            for y in range(2, 20, 2): b.box(xa, xb, y - .06, y + .06, z0 + .5, z0 + .56, M['grey'])
            b.box(xa + .5, xb - .5, 10, 11, z0 + .5, z0 + .53, M['cglass'])
    b.box(-HX, HX, 0, .02, HZ - .5, HZ + 2.8, M['galv'])   # 門的地軌
    # 裡面：地坪、拱形桁架、天井燈
    b.box(-HX + .3, HX - .3, 0, .06, -HZ + .3, HZ, M['floor'])
    for z in [-HZ + 4 + 7.4 * i for i in range(10)]:
        P = [(x, hroof(x) - .9, z) for x in [-HX + .4 + (2 * HX - .8) * i / 24 for i in range(25)]]
        Q = [(x, y - 2.0, z) for x, y, _ in P]
        for i in range(24):
            b.beam(P[i], P[i + 1], .08, M['galv']); b.beam(Q[i], Q[i + 1], .08, M['galv'])
            b.beam(P[i], Q[i + 1] if i % 2 == 0 else Q[i], .045, M['galv']); b.beam(Q[i], P[i], .04, M['galv'])
        for i in range(2, 23, 3): x, y, _ = Q[i]; b.vcyl(x, z, y - .9, y - .1, .35, 12, M['dark'], r1=.12); b.vcyl(x, z, y - .95, y - .9, .33, 12, M['bay'])
    # 後面的兩層工作間
    b.box(-45, 45, 0, 9.0, -HZ - 8, -HZ, M['clad'])
    b.box(-45.3, 45.3, 9.0, 9.4, -HZ - 8.3, -HZ, M['fascia'])
    for y0 in (1.2, 5.4):
        for x in range(-42, 43, 6): b.box(x - 2.2, x + 2.2, y0, y0 + 2.2, -HZ - 8.02, -HZ - 8.0, M['oglass'])
    for x in (-30, 0, 30): b.box(x - 1, x + 1, 0, 2.6, -HZ - 8.03, -HZ - 8.0, M['door'])
    # ── 機庫裡的維修：一架 A320 停在中間（21-air.js 擺，機頭朝門 +z、中心 z −4），機頭的 U 形工作台、兩座發動機升降台、垂直尾翼旁的三層塔架、
    # 翼後的移動平台、工具車、工作檯與料架、空壓機、油桶、滅火器、地上的黃線、天車軌道與吊車；門楣上的機庫號
    PZ = -4.0; NZ = PZ + 18.8
    def legs(x0, x1, z0, z1, y, step=2.5):
        for x in (x0 + .1, x1 - .1):
            z = z0 + .1
            while z <= z1 - .1 + 1e-6: b.vcyl(x, z, .06, y, .06, 8, M['galv']); z += step
            b.beam((x, .4, z0 + .1), (x, .4, z1 - .1), .04, M['galv'])
    def deck(x0, x1, z0, z1, y):
        b.box(x0, x1, y - .08, y, z0, z1, M['galv']); b.box(x0, x1, y - .2, y - .08, z0, z0 + .08, M['yel']); b.box(x0, x1, y - .2, y - .08, z1 - .08, z1, M['yel'])
    for sx in (-1, 1):   # 機頭工作台：兩側（機身外 0.3 m）與前端
        xa, xc = sorted((sx * 2.3, sx * 4.6)); deck(xa, xc, NZ - 6.0, NZ + .4, 2.6); legs(xa, xc, NZ - 6.0, NZ + .4, 2.52)
        b.rail([(sx * 4.6, 2.6, NZ - 6.0), (sx * 4.6, 2.6, NZ + 2.9)], 1.05, M['yel'], post=1.6); b.rail([(sx * 2.3, 2.6, NZ - 6.0), (sx * 2.3, 2.6, NZ - 4.2)], 1.05, M['yel'])
    deck(-4.6, 4.6, NZ + 1.4, NZ + 2.9, 2.6); legs(-4.6, 4.6, NZ + 1.4, NZ + 2.9, 2.52, 1.5)
    b.rail([(-4.6, 2.6, NZ + 2.9), (-.6, 2.6, NZ + 2.9)], 1.05, M['yel']); b.rail([(.6, 2.6, NZ + 2.9), (4.6, 2.6, NZ + 2.9)], 1.05, M['yel'])
    for i in range(10):   # 前端的樓梯（往 +z 下到地面）
        y = 2.6 - .26 * (i + 1); z = NZ + 2.9 + i * .28; b.box(-.55, .55, y, y + .05, z, z + .28, M['galv'])
    for sx in (-1, 1): b.beam((sx * .58, 2.6, NZ + 2.9), (sx * .58, 0, NZ + 2.9 + 2.8), .03, M['galv']); b.tube((sx * .58, 3.6, NZ + 2.9), (sx * .58, 1.0, NZ + 2.9 + 2.8), .025, M['yel'], 6)
    for sx in (-1, 1):   # 發動機升降台：剪式支架、平台、欄杆、底座與輪子
        xe = sx * 5.75; z0, z1 = PZ + 9.6, PZ + 11.4
        b.box(xe - 1.1, xe + 1.1, .25, .45, z0 - .2, z1 + .2, M['yel'])
        for zz in (z0 + .1, z1 - .1):
            for dx in (-.9, .9): b.xcyl(xe + dx - .08, xe + dx + .08, .2, zz, .17, 10, M['rubber'])
        for dx in (-.95, .95): b.beam((xe + dx, .45, z0), (xe + dx, 1.5, z1), .05, M['galv']); b.beam((xe + dx, .45, z1), (xe + dx, 1.5, z0), .05, M['galv'])
        deck(xe - 1.1, xe + 1.1, z0, z1, 1.6); b.rail([(xe - 1.1, 1.6, z1), (xe + 1.1, 1.6, z1)], 1.0, M['yel'], post=1.1)
        b.rail([(xe - 1.1, 1.6, z0), (xe - 1.1, 1.6, z1)], 1.0, M['yel']); b.rail([(xe + 1.1, 1.6, z0), (xe + 1.1, 1.6, z1)], 1.0, M['yel'])
    tx0, tx1, tz0, tz1 = 1.6, 4.2, PZ - 11.4, PZ - 8.8   # 垂直尾翼旁的塔架：四根柱、三層平台、斜撐
    for x in (tx0, tx1):
        for z in (tz0, tz1): b.box(x - .08, x + .08, 0, 10.4, z - .08, z + .08, M['galv'])
    for y in (4.0, 7.2, 10.2):
        deck(tx0, tx1, tz0, tz1, y); b.box(.7, tx0, y - .08, y, tz0 + .6, tz1 - .6, M['galv'])
        b.rail([(tx1, y, tz0), (tx1, y, tz1), (tx0, y, tz1)], 1.05, M['yel'], post=1.3); b.rail([(.7, y, tz0 + .6), (.7, y, tz1 - .6)], 1.05, M['yel'])
    for y0_ in (0.0, 4.0, 7.2):
        for x in (tx0, tx1): b.beam((x, y0_ + .2, tz0), (x, y0_ + 3.0, tz1), .035, M['galv'])
    for sx in (-1, 1):   # 翼後的移動平台
        xw = sx * 11.0; b.box(xw - 1.0, xw + 1.0, .25, .4, PZ - 6.2, PZ - 4.2, M['yel'])
        for dx in (-.85, .85): b.box(xw + dx - .06, xw + dx + .06, .4, 2.4, PZ - 6.1, PZ - 4.3, M['galv'])
        deck(xw - 1.0, xw + 1.0, PZ - 6.2, PZ - 4.2, 2.4); b.rail([(xw - 1.0, 2.4, PZ - 6.2), (xw + 1.0, 2.4, PZ - 6.2)], 1.0, M['yel'], post=1.0)
    for x, z in ((-8.5, PZ + 13.0), (7.8, PZ + 8.6), (-13.5, PZ - 1.0), (13.0, PZ + 2.0), (-4.5, PZ - 16.0), (6.5, PZ - 18.0)):   # 紅色的工具車
        b.box(x - .55, x + .55, .25, 1.15, z - .3, z + .3, M['redp'])
        for k in range(5): b.box(x - .5, x + .5, .35 + k * .16, .37 + k * .16, z + .3, z + .32, M['dark'])
        for dx in (-.42, .42): b.vcyl(x + dx, z, .06, .25, .07, 8, M['rubber'])
    for z in range(-30, 31, 6):   # 西牆的工作檯與料架、東牆的料架
        b.box(-HX + .4, -HX + 1.3, .85, .92, z - 2.4, z + 2.4, M['grey']); b.box(-HX + .4, -HX + 1.3, 0, .85, z - 2.4, z - 2.2, M['dark']); b.box(-HX + .4, -HX + 1.3, 0, .85, z + 2.2, z + 2.4, M['dark'])
        b.box(HX - 1.1, HX - .4, 0, 3.6, z - 2.4, z - 2.3, M['galv']); b.box(HX - 1.1, HX - .4, 0, 3.6, z + 2.3, z + 2.4, M['galv'])
        for k in range(4): b.box(HX - 1.1, HX - .4, .2 + k * .9, .25 + k * .9, z - 2.3, z + 2.3, M['galv']); b.box(HX - 1.0, HX - .5, .25 + k * .9, .25 + k * .9 + .45 + .2 * ((z + k) % 3 == 0), z - 2.0 + (k % 2), z + .4 + (k % 2), M['door'])
    for x, z in ((-50, 30), (-47, 30), (-48.5, 31.6), (50, 31)):   # 油桶
        b.vcyl(x, z, 0, .9, .3, 12, M['redp'] if x < 0 else M['grey']); b.vcyl(x, z, .3, .34, .31, 12, M['dark'])
    b.box(44.5, 47.5, 0, 1.6, 33.0, 34.4, M['yel']); b.box(44.7, 47.3, 1.6, 1.7, 33.2, 34.2, M['dark'])   # 空壓機
    for z in range(-30, 31, 12):   # 牆上的滅火器
        for x in (-HX + .45, HX - .45): b.vcyl(x, z, .9, 1.55, .09, 8, M['redp'])
    for x0, x1, z0, z1 in ((-20, 20, PZ - 23.5, PZ - 23.35), (-20, 20, NZ + 3.4, NZ + 3.55), (-20, -19.85, PZ - 23.5, NZ + 3.55), (19.85, 20, PZ - 23.5, NZ + 3.55),
                           (-.075, .075, PZ - 23.5, NZ + 3.55), (-50, -49.85, -HZ + 1, HZ - 1), (49.85, 50, -HZ + 1, HZ - 1)):   # 地上的黃線：停機框、中線、靠牆的走道
        b.box(x0, x1, .06, .068, z0, z1, M['yel'])
    for sx in (-1, 1):   # 天車：兩條沿 z 的軌道（每道桁架吊一支）、一座橫跨的吊車與吊鉤
        b.box(sx * 30 - .25, sx * 30 + .25, 18.2, 18.7, -HZ + 1, HZ - 1, M['dark'])
        for z in [-HZ + 4 + 7.4 * i for i in range(10)]: b.box(sx * 30 - .06, sx * 30 + .06, 18.7, hroof(30) - 2.9, z - .06, z + .06, M['galv'])
    b.box(-30.4, 30.4, 18.7, 19.5, -26.5, -25.5, M['yel']); b.box(-1.0, 1.0, 17.9, 18.7, -26.6, -25.4, M['dark'])
    b.tube((0, 17.9, -26), (0, 9.5, -26), .02, M['dark'], 5); b.box(-.3, .3, 9.0, 9.5, -26.3, -25.7, M['yel'])
    b.text('HANGAR 1', 2.4, (0, 24.6, HZ + .02), (1, 0, 0), (0, 0, 1), M['white'], .12)
    return b.build('air_hangar')



# ════════ 滑行道指示牌（52-air-bld.js 擺在連絡道口）：1 m 高的箱子、兩面同一組字（背面照樣由左讀到右），內部照明（m16：入夜亮）。
# loc 位置牌：黑底黃字黃框；dir 方向牌：黃底黑字；man 強制牌（跑道等候點）：紅底白字。'<' '>' '^' 是箭頭。模型原點在地面中心，正面朝 +z
SIGNS = {
    'air_sgn_h1': [('loc', 'A1'), ('man', '09-27')], 'air_sgn_h2': [('loc', 'A2'), ('man', '09-27')],
    'air_sgn_h3': [('loc', 'A3'), ('man', '09-27')], 'air_sgn_h4': [('loc', 'A4'), ('man', '09-27')],
    'air_sgn_a5': [('loc', 'A5'), ('dir', '<A>')], 'air_sgn_a6': [('loc', 'A6'), ('dir', '<A>')], 'air_sgn_a7': [('loc', 'A7'), ('dir', '<A>')],
    'air_sgn_k': [('loc', 'K'), ('dir', '<K1')], 'air_sgn_k1': [('loc', 'K1'), ('dir', 'T2^')],
}
SG_Y0, SG_H, SG_D, SG_T = .45, 1.0, .15, .58   # 箱底高、箱高、半厚、字高


def tw(txt, size):
    """Blender 內建字型的字寬（公尺）"""
    cu = bpy.data.curves.new('tw', 'FONT'); cu.body = txt; cu.size = size
    ob = bpy.data.objects.new('tw', cu); bpy.context.scene.collection.objects.link(ob)
    dg = bpy.context.evaluated_depsgraph_get(); me = ob.evaluated_get(dg).to_mesh()
    w = max(v.co.x for v in me.vertices) - min(v.co.x for v in me.vertices) if len(me.vertices) else 0
    ob.evaluated_get(dg).to_mesh_clear(); bpy.data.objects.remove(ob, do_unlink=True); bpy.data.curves.remove(cu)
    return w


def twysign(name, panels):
    b = GB(7)
    items = []   # 每塊牌：(種類, [(字或箭頭, 寬)], 牌寬)
    for kind, txt in panels:
        parts = []; cur = ''
        for ch in txt:
            if ch in '<>^':
                if cur: parts.append((cur, tw(cur, SG_T))); cur = ''
                parts.append((ch, .62))
            else: cur += ch
        if cur: parts.append((cur, tw(cur, SG_T)))
        items.append((kind, parts, sum(w for _, w in parts) + .16 * (len(parts) - 1) + .7))
    W = sum(w for _, _, w in items); yc = SG_Y0 + SG_H / 2
    b.box(-W / 2 - .04, W / 2 + .04, SG_Y0 - .04, SG_Y0 + SG_H + .04, -SG_D, SG_D, M['dark'])                       # 箱體（邊框）
    for x in (-W / 2 + .35, W / 2 - .35):                                                                      # 兩支易斷的腳、底座
        b.vcyl(x, 0, .1, .3, .05, 10, M['galv']); b.vcyl(x, 0, .3, .34, .065, 10, M['dark']); b.vcyl(x, 0, .34, SG_Y0 - .04, .05, 10, M['galv'])
    b.box(-W / 2 - .2, W / 2 + .2, 0, .1, -.45, .45, M['conc'])
    arrow = [(-.3, -.07), (.05, -.07), (.05, -.2), (.31, 0), (.05, .2), (.05, .07), (-.3, .07)]
    for side in (1, -1):   # 正面（+z）與背面（−z）：背面的 u 軸是 −x
        zf = side * SG_D; X = lambda u: u * side
        u0 = -W / 2
        for kind, parts, pw in items:
            bg, fg = {'loc': (M['black'], M['sy']), 'dir': (M['sy'], M['black']), 'man': (M['sr'], M['sw'])}[kind]
            ua, ub = X(u0 + .015), X(u0 + pw - .015)
            b.box(min(ua, ub), max(ua, ub), SG_Y0 + .015, SG_Y0 + SG_H - .015, min(zf, zf + side * .012), max(zf, zf + side * .012), bg)   # 底板
            zt = zf + side * .012
            if kind == 'loc':   # 黃框
                for (p0, p1, q0, q1) in ((u0 + .06, u0 + pw - .06, SG_Y0 + .06, SG_Y0 + .1), (u0 + .06, u0 + pw - .06, SG_Y0 + SG_H - .1, SG_Y0 + SG_H - .06),
                                         (u0 + .06, u0 + .1, SG_Y0 + .06, SG_Y0 + SG_H - .06), (u0 + pw - .1, u0 + pw - .06, SG_Y0 + .06, SG_Y0 + SG_H - .06)):
                    xa, xb = X(p0), X(p1); b.box(min(xa, xb), max(xa, xb), q0, q1, min(zt, zt + side * .008), max(zt, zt + side * .008), fg)
            u = u0 + .35
            for t, w in parts:
                cu = u + w / 2
                if t in '<>^':
                    pts = [(-p, q) for p, q in reversed(arrow)] if t == '<' else [(-q, p) for p, q in arrow] if t == '^' else arrow
                    poly = [(X(cu + p), yc + q, zt + side * .006) for p, q in pts]   # 背面 x = −u 本身就把繞向翻過來，法線朝 −z
                    b.poly(poly, fg)
                else:
                    b.text(t, SG_T, (X(cu), yc, zt), (side, 0, 0), (0, 0, side), fg, .02)
                u += w + .16
            u0 += pw
    return b.build(name)


# ════════ 空橋外節的廣告燈箱（52-air-bld.js 每座空橋挑一款、和空橋同一個變換）：外節（z 3.2–13.2）兩側各一面，順著通道的斜度，
# 面板是內照式（t57：白天是印刷面、入夜裡面的燈管打亮），字與圖形是凸出 1–2 cm 的板。廣告主都是城裡的店家與設施（不用真的品牌）
AD_Z0, AD_Z1 = 3.2, 13.2


def jw_fy(z):
    ya, yb, za, zb = J_ROT_Y, J_CAB_Y, 2.3, J_CAB_Z - 2.0
    return ya + (yb - ya) * (z - za) / (zb - za)


def jwad(name, bg, lines, deco):
    """lines：[(字, 大小, 高度 v, 橫向 t, 顏色)]；deco(q, s, M2)：q(t, v, 層) → 3D 點，畫圖形。t 沿著通道（−5…5）、v 從面板底往上（0…2.05）"""
    b = GB(41); k = (jw_fy(10) - jw_fy(0)) / 10; zc = (AD_Z0 + AD_Z1) / 2
    cache = {}
    def mt(col, glow=True):
        key = (col, glow)
        if key not in cache: cache[key] = mat(('t57_ad_%s_%d' if glow else 't34_ad_%s_%d') % (name, len(cache)), col, 0.35, 0.0)
        return cache[key]
    MB_ = mt(bg)
    for s in (-1, 1):
        def q(t, v, lay=0.0):
            z = zc - s * t
            return (s * (1.62 + .045 + lay), jw_fy(z) + .5 + v, z)
        # 燈箱：背板（深灰框）、面板、上下框條、兩端的框
        x0, x1 = (1.6, 1.665) if s > 0 else (-1.665, -1.6)
        z0, z1 = AD_Z0, AD_Z1; xo = x1 if s > 0 else x0
        P = lambda x, z, v: (x, jw_fy(z) + .5 + v, z)
        ow(b, [P(xo, z0, 0), P(xo, z1, 0), P(xo, z1, 2.05), P(xo, z0, 2.05)], MB_, (s, 0, 0))   # 面板
        for v0, v1 in ((-.08, 0), (2.05, 2.13)):   # 上下框條：正面、頂面、底面
            ow(b, [P(xo, z0, v0), P(xo, z1, v0), P(xo, z1, v1), P(xo, z0, v1)], M['dark'], (s, 0, 0))
            ow(b, [P(x0, z0, v1), P(x1, z0, v1), P(x1, z1, v1), P(x0, z1, v1)], M['dark'], (0, 1, 0))
            ow(b, [P(x0, z0, v0), P(x1, z0, v0), P(x1, z1, v0), P(x0, z1, v0)], M['dark'], (0, -1, 0))
        for za, zb, dz in ((z0 - .08, z0, -1), (z1, z1 + .08, 1)):   # 兩端的框：正面、外端面、內端面
            ow(b, [P(xo, za, -.08), P(xo, zb, -.08), P(xo, zb, 2.13), P(xo, za, 2.13)], M['dark'], (s, 0, 0))
            zf, zi = (za, zb) if dz < 0 else (zb, za)
            ow(b, [P(x0, zf, -.08), P(x1, zf, -.08), P(x1, zf, 2.13), P(x0, zf, 2.13)], M['dark'], (0, 0, dz))
            ow(b, [P(x0, zi, 2.05), P(x1, zi, 2.05), P(x1, zi, 2.13), P(x0, zi, 2.13)], M['dark'], (0, 0, -dz))
            ow(b, [P(x0, zi, -.08), P(x1, zi, -.08), P(x1, zi, 0), P(x0, zi, 0)], M['dark'], (0, 0, -dz))
        n = math.sqrt(1 + k * k); R = (0.0, -s * k / n, -s / n); N = (float(s), 0.0, 0.0)
        for txt, size, v, t, col in lines:
            o = q(t, v, .004); b.text(txt, size, o, R, N, mt(col), .02)
        deco(q, s, b, mt)
    return b.build('air_jwad_' + name)


def quad(b, pts, m): ow(b, pts, m, (1 if pts[0][0] > 0 else -1, 0, 0))   # 貼在燈箱面上的圖形，朝外


def ad_lazarus():
    def deco(q, s, b, mt):
        m = mt('#ff3fa0'); cx, cv = -3.6, 1.02
        for i in range(36):   # 霓虹圈
            a0, a1 = 2 * math.pi * i / 36, 2 * math.pi * (i + 1) / 36
            quad(b, [q(cx + .62 * math.cos(a0), cv + .62 * math.sin(a0), .006), q(cx + .62 * math.cos(a1), cv + .62 * math.sin(a1), .006),
                     q(cx + .74 * math.cos(a1), cv + .74 * math.sin(a1), .006), q(cx + .74 * math.cos(a0), cv + .74 * math.sin(a0), .006)], m)
        for t0 in (-2.6, 4.6): quad(b, [q(t0 - .04, .25, .006), q(t0 + .04, .25, .006), q(t0 + .04, 1.8, .006), q(t0 - .04, 1.8, .006)], mt('#7d2bd9'))
        quad(b, [q(cx - .3, cv - .02, .008), q(cx + .3, cv - .02, .008), q(cx + .3, cv + .02, .008), q(cx - .3, cv + .02, .008)], mt('#ffd2ea'))
    return jwad('lazarus', '#0d0b10', [('LAZARUS', .95, 1.25, 1.0, '#ff3fa0'), ('CLUB  ·  OPEN TILL DAWN', .3, .5, 1.0, '#d8d0e0')], deco)


def ad_chrome():
    def deco(q, s, b, mt):
        for i, col in enumerate(('#e8ecf0', '#9aa4ae', '#e8a33a')):
            t0 = 3.0 + i * .55
            quad(b, [q(t0, .15, .006), q(t0 + .3, .15, .006), q(t0 + 1.1, 1.9, .006), q(t0 + .8, 1.9, .006)], mt(col))
        quad(b, [q(-4.7, 1.0, .005), q(2.6, 1.0, .005), q(2.6, 1.03, .005), q(-4.7, 1.03, .005)], mt('#e8a33a'))
    return jwad('chrome', '#1d2630', [('CHROME WORKS', .62, 1.4, -1.0, '#d9dee4'), ('CUSTOM PAINT  ·  TUNING  ·  DETAILING', .24, .62, -1.0, '#e8a33a')], deco)


def ad_cable():
    def deco(q, s, b, mt):
        for t0, w, h, col in ((-4.6, 1.5, 1.45, '#163f44'), (-3.5, 1.3, 1.75, '#2b6a70'), (-2.4, 1.2, 1.25, '#163f44')):
            quad(b, [q(t0, .0, .006), q(t0 + w, .0, .006), q(t0 + w / 2, h, .006), q(t0 + w / 2, h, .006)], mt(col))
            quad(b, [q(t0 + w / 2 - .18, h - .22, .008), q(t0 + w / 2 + .18, h - .22, .008), q(t0 + w / 2, h, .008), q(t0 + w / 2, h, .008)], mt('#f4f4ef'))
        quad(b, [q(-4.9, 1.95, .007), q(-1.0, 1.25, .007), q(-1.0, 1.27, .007), q(-4.9, 1.97, .007)], mt('#10282b'))
        quad(b, [q(-2.2, 1.18, .009), q(-1.8, 1.18, .009), q(-1.8, 1.44, .009), q(-2.2, 1.44, .009)], mt('#e04b2c'))
    return jwad('cable', '#1f5d63', [('NORTH RIDGE', .62, 1.38, 1.6, '#ffffff'), ('CABLEWAY  ·  SUMMIT IN 12 MIN', .26, .62, 1.6, '#f2d27a')], deco)


def ad_dutyfree():
    def deco(q, s, b, mt):
        for v in (.3, 1.85): quad(b, [q(-4.6, v, .005), q(4.6, v, .005), q(4.6, v + .025, .005), q(-4.6, v + .025, .005)], mt('#e8c26a'))
    return jwad('dutyfree', '#7d1a24', [('DUTY FREE', .72, 1.2, 0.0, '#e8c26a'), ('GREY HERON CAPE  ·  LEVEL 2', .24, .55, 0.0, '#f4efe6')], deco)


only = os.environ.get('ONLY', '').split(',') if os.environ.get('ONLY') else None
objs = [(f, s, g, d) for f, s, g, d in [(term, 4.0, 260, 4.0), (jetway, 1.0, 40, 1.5), (tower, 3.0, 60, 3.0), (hangar, 4.0, 180, 4.0), (term2, 4.0, 400, 4.0), (ad_lazarus, 1.0, 20, 1.0), (ad_chrome, 1.0, 20, 1.0), (ad_cable, 1.0, 20, 1.0), (ad_dutyfree, 1.0, 20, 1.0)] + [((lambda n=n, p=p: twysign(n, p)), 1.0, 8, .6) for n, p in SIGNS.items()]]
built = []
for i, (f, step, g, d) in enumerate(objs):
    o = f(); o.location = (i * 400, 0, 0); finish(o, step); built.append((o, g, d))
for o, g, d in built:
    for p, _, _ in built: p.hide_render = p is not o
    bake_ao(o, g, d)
for o, _, _ in built: o.hide_render = False; o.location = (0, 0, 0)
export_glb('airbld.glb', export_vertex_color='ACTIVE')
