# 霓虹夜城（260）灰鷺角機場的支援設施：機場消防站（ARFF）、油庫、機場搜索雷達（ASR）、ILS 的定位台天線陣與下滑台、氣象觀測場、跑道東端的 EMAS 與防吹籬（52-air-fac.js 擺）
# 第三批：鋁梯 af_ladder（移動式平台梯）、af_stepl（A 字梯）與機坪告示牌 af_sgn_*（禁菸、速限、噴流危險、空側限制、反光背心）
# 第二批（2026-11-04）：貨運站 af_cargo（卡車碼頭、冷鏈倉、危險品倉、辦公樓）、試車坪 af_runup（三面消音牆）、空廚大樓 af_cater、地勤車基地 af_gseb
# 執行：/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P blender/airfac.py   → blender/out/airfac.glb，再 npm run build
# 和 airbld.py 一樣用「遊戲座標」寫：x 東、y 上、z 南（SEA_FR 框，原點在各設施的中心地面），G() 轉成 Blender；材質名稱帶遊戲的材質代號（見 airbld.py 檔頭）。
# 消防車本身在 airgse.py（gse_arff）。不靠貼圖：細節都是幾何＋程式材質，字是 Blender 內建字型轉的網格；Cycles 烘 AO 進頂點色。
import math, os, sys
import bmesh, bpy
from mathutils import Vector
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *

reset()
M = {
    'oglass': mat('t54_room', '#0b1014', 0.05, 0.0), 'cglass': mat('m1_cabglass', '#1b2a2c', 0.05, 0.0), 'dglass': mat('m1_door', '#111619', 0.05, 0.0),
    'white': mat('t34_white', '#cfd2d4', 0.4, 0.1), 'grey': mat('t34_grey', '#7d8288', 0.45, 0.2), 'dark': mat('t34_dark', '#383b40', 0.5, 0.2),
    'clad': mat('t29_clad', '#8d939a', 0.5, 0.3), 'door': mat('t29_door', '#4c5156', 0.5, 0.3), 'conc': mat('t43_conc', '#a9a59e', 0.85, 0.0),
    'floor': mat('t33_floor', '#8e9296', 0.5, 0.0), 'galv': mat('t22_galv', '#9a9ea2', 0.5, 0.7), 'black': mat('m2_black', '#141416', 0.85, 0.0),
    'redp': mat('t34_red', '#a3201a', 0.45, 0.1), 'yel': mat('m10_gse_yel', '#d9a21a', 0.35, 0.1), 'tank': mat('t34_tank', '#dfe1e0', 0.35, 0.1),
    'led': mat('m16_led', '#fff4e4', 0.4, 0.0, emit='#fff4e4'), 'red': mat('m16_red', '#ff2a1c', 0.4, 0.0, emit='#ff2a1c'), 'bay': mat('m16_bay', '#fff8ec', 0.3, 0.0, emit='#fff8ec'),
    'rubber': mat('m2_rubber', '#1b1b1d', 0.9, 0.0), 'grass': mat('m2_gravel', '#5d5a52', 0.95, 0.0),
    'wave': mat('t55_wave', '#8f959b', 0.5, 0.4), 'blue': mat('t34_blue', '#1f4f8c', 0.4, 0.1), 'green': mat('t34_green', '#2f5a3a', 0.5, 0.1),
    'hdg': mat('t34_hdg', '#8f9394', 0.72, 0.2),   # 戶外風化的熱浸鍍鋅（霧面；金屬感太強的鍍鋅在晴天整支反射天空變藍）
    'orange': mat('t34_orange', '#d8661c', 0.45, 0.1), 'amber': mat('m16_amber', '#ffa020', 0.4, 0.0, emit='#ffa020'), 'trl': mat('t34_trailer', '#e4e5e2', 0.4, 0.1),
}

from airkit import *


def ring_rail(b, cx, cz, r, y, h, m, n=36):
    """圓形的欄杆（油槽頂）"""
    pts = [(cx + r * math.cos(2 * math.pi * i / n), cz + r * math.sin(2 * math.pi * i / n)) for i in range(n + 1)]
    for (x0, z0), (x1, z1) in zip(pts, pts[1:]):
        b.tube((x0, y + h, z0), (x1, y + h, z1), .03, m, 6); b.tube((x0, y + h / 2, z0), (x1, y + h / 2, z1), .022, m, 6)
    for x, z in pts[:-1:3]: b.tube((x, y, z), (x, y + h, z), .03, m, 6)


def lattice(b, x, z, y0, y1, w0, w1, panel, m, r=.07):
    """方形格構塔：四支腳由 w0 收到 w1，每 panel 公尺一道橫材、每面交叉斜撐"""
    n = max(1, round((y1 - y0) / panel)); P = []
    for i in range(n + 1):
        t = i / n; w = (w0 + (w1 - w0) * t) / 2; y = y0 + (y1 - y0) * t
        P.append([(x - w, y, z - w), (x + w, y, z - w), (x + w, y, z + w), (x - w, y, z + w)])
    for k in range(4):
        b.tube(P[0][k], P[-1][k], r, m, 8)
        for i in range(n + 1): b.tube(P[i][k], P[i][(k + 1) % 4], r * .6, m, 6)
        for i in range(n):
            b.tube(P[i][k], P[i + 1][(k + 1) % 4], r * .45, m, 5); b.tube(P[i][(k + 1) % 4], P[i + 1][k], r * .45, m, 5)


def zdisc(b, cx, cy, z, r, m, d, n=20, r0=0.0):
    """朝 ±z（d）的圓盤或圓環（r0 > 0）"""
    for i in range(n):
        a0, a1 = 2 * math.pi * i / n, 2 * math.pi * (i + 1) / n
        q = [(cx + r0 * math.cos(a0), cy + r0 * math.sin(a0), z), (cx + r * math.cos(a0), cy + r * math.sin(a0), z), (cx + r * math.cos(a1), cy + r * math.sin(a1), z)]
        if r0 > 0: q.append((cx + r0 * math.cos(a1), cy + r0 * math.sin(a1), z))
        ow(b, q, m, (0, 0, d))


def shelter(b, x0, x1, z0, z1, h, door_side='s'):
    """設備小屋（預鑄的導航設備房）：兩階混凝土基座與碎石帶、夾層鋼板牆（1 m 一道立縫、包角）、
    出挑 0.35 m 的單斜屋頂（封簷板、滴水、通風帽）、帶門框與小雨遮的鋼門（下半百葉）、分離式冷氣室外機（風扇格柵）、
    側牆的進氣百葉、電錶箱與穿牆的電纜管、門邊的警告牌"""
    d = 1 if door_side == 's' else -1; zf = z1 if d > 0 else z0; zb = z0 if d > 0 else z1
    b.box(x0 - .9, x1 + .9, 0, .05, z0 - .9, z1 + .9, M['grass'])                                        # 碎石帶
    b.box(x0 - .25, x1 + .25, 0, .18, z0 - .25, z1 + .25, M['conc']); b.box(x0 - .12, x1 + .12, .18, .3, z0 - .12, z1 + .12, M['conc'])
    y0 = .3; hb = h + .12                                                                                    # 前高後低的單斜屋頂
    b.box(x0, x1, y0, h, z0, z1, M['white'])
    b.box(x0 - .02, x1 + .02, y0, y0 + .12, z0 - .02, z1 + .02, M['grey'])                                # 底部的收邊
    for zz in (z0, z1):                                                                                        # 前後牆的立縫
        dz = -1 if zz == z0 else 1; xx = x0 + 1.0
        while xx < x1 - .4:
            b.box(xx - .015, xx + .015, y0 + .12, h - .05, min(zz, zz + dz * .012), max(zz, zz + dz * .012), M['clad']); xx += 1.0
    for xx in (x0, x1):
        dx = -1 if xx == x0 else 1; zz = z0 + 1.0
        while zz < z1 - .4:
            b.box(min(xx, xx + dx * .012), max(xx, xx + dx * .012), y0 + .12, h - .05, zz - .015, zz + .015, M['clad']); zz += 1.0
    for xx in (x0, x1):                                                                                        # 包角
        for zz in (z0, z1):
            b.box(xx - .05, xx + .05, y0, h, zz - .05, zz + .05, M['grey'])
    # 屋頂：出挑、封簷板、滴水條、通風帽
    ox = .35; yf, yb = h + .2, h + .05
    yF, yB = (yf, yb) if d > 0 else (yb, yf)
    ow(b, [(x0 - ox, yF, z1 + ox), (x1 + ox, yF, z1 + ox), (x1 + ox, yB, z0 - ox), (x0 - ox, yB, z0 - ox)], M['grey'], (0, 1, 0))
    ow(b, [(x0 - ox, yF - .02, z1 + ox), (x1 + ox, yF - .02, z1 + ox), (x1 + ox, yB - .02, z0 - ox), (x0 - ox, yB - .02, z0 - ox)], M['white'], (0, -1, 0))
    for zz, yy, dz in ((z1 + ox, yF, 1), (z0 - ox, yB, -1)):
        b.box(x0 - ox - .02, x1 + ox + .02, yy - .2, yy + .02, min(zz, zz + dz * .04), max(zz, zz + dz * .04), M['white'])
    for xx, dx in ((x0 - ox, -1), (x1 + ox, 1)):
        ow(b, [(xx, yF - .2, z1 + ox), (xx, yB - .2, z0 - ox), (xx, yB + .02, z0 - ox), (xx, yF + .02, z1 + ox)], M['white'], (dx, 0, 0))
    b.box(x0, x1, h, min(yf, yb), z0, z1, M['white'])
    xc = (x0 + x1) / 2
    b.vcyl(x0 + 1.0, (z0 + z1) / 2, max(yf, yb) - .05, max(yf, yb) + .35, .09, 10, M['galv']); b.vcyl(x0 + 1.0, (z0 + z1) / 2, max(yf, yb) + .35, max(yf, yb) + .45, .2, 12, M['galv'])
    # 門：門框、門扇、下半百葉、把手、門頂的小雨遮與門燈、門前的台階
    def zb_(za, t): return (min(za, za + d * t), max(za, za + d * t))
    b.box(xc - .58, xc + .58, y0, 2.42, *zb_(zf, .05), M['galv'])
    b.box(xc - .5, xc + .5, y0 + .02, 2.34, *zb_(zf, .06), M['door'])
    for k in range(6): b.box(xc - .36, xc + .36, .55 + k * .07, .58 + k * .07, *zb_(zf, .075), M['dark'])
    b.box(xc + .32, xc + .42, 1.18, 1.24, *zb_(zf, .12), M['galv'])
    b.box(xc - .75, xc + .75, 2.55, 2.62, *zb_(zf, .7), M['grey'])
    for s in (-1, 1): b.beam((xc + s * .68, 2.55, zf + d * .65), (xc + s * .68, 2.2, zf + d * .02), .02, M['galv'])
    b.box(xc - .12, xc + .12, 2.45, 2.53, *zb_(zf, .1), M['led'])
    b.box(xc - .7, xc + .7, 0, .3, *zb_(zf + d * .12, .55), M['conc'])
    b.box(xc - 1.05, xc - .7, 1.45, 1.75, *zb_(zf, .02), M['yel'])                                          # 警告牌
    zdisc(b, xc - .875, 1.585, zf + d * .021, .14, M['black'], d, 3); zdisc(b, xc - .875, 1.585, zf + d * .022, .08, M['yel'], d, 3)
    # 冷氣室外機：牆上的支架、機殼、風扇格柵
    ax = x1 - .8; ay = 1.1
    for s in (-1, 1): b.box(ax + s * .32 - .02, ax + s * .32 + .02, ay - .05, ay, *zb_(zf, .45), M['galv'])
    b.box(ax - .42, ax + .42, ay, ay + .62, *zb_(zf + d * .06, .34), M['white'])
    zdisc(b, ax - .08, ay + .31, zf + d * .405, .24, M['dark'], d, 20)
    zdisc(b, ax - .08, ay + .31, zf + d * .41, .26, M['grey'], d, 20, .24)
    for k in range(5): b.box(ax - .32, ax + .16, ay + .14 + k * .085, ay + .155 + k * .085, *zb_(zf + d * .4, .015), M['grey'])
    b.box(ax + .22, ax + .38, ay + .1, ay + .52, *zb_(zf + d * .4, .01), M['grey'])
    b.tube((ax + .3, ay + .1, zf + d * .25), (ax + .3, ay - .3, zf + d * .05), .02, M['black'], 6)
    # 背面：電錶箱、電纜管從地下穿牆、兩個進氣百葉
    mx = x0 + .9
    b.box(mx - .25, mx + .25, 1.2, 1.85, *zb_(zb, -.18), M['grey'])
    b.tube((mx, 1.2, zb - d * .1), (mx, .05, zb - d * .1), .045, M['galv'], 8)
    b.tube((mx + .5, 2.2, zb - d * .08), (mx + .5, .05, zb - d * .08), .06, M['dark'], 8)
    for xx in (x0, x1):
        dx = -1 if xx == x0 else 1
        b.box(min(xx, xx + dx * .04), max(xx, xx + dx * .04), 1.7, 2.3, (z0 + z1) / 2 - .35, (z0 + z1) / 2 + .35, M['galv'])
        for k in range(5): b.box(min(xx, xx + dx * .07), max(xx, xx + dx * .07), 1.76 + k * .11, 1.79 + k * .11, (z0 + z1) / 2 - .32, (z0 + z1) / 2 + .32, M['dark'])


# ════════ 機場消防站：四個車庫（西邊兩個門開著，停著消防車；東邊兩個關著）＋東側兩層的值班樓，角上一間玻璃瞭望室；西北角的水帶塔。
# 正面（+z）就是機坪北緣的圍籬線（z 14 → 遊戲 z 197），車庫門直接開向機坪；背面（−z）是陸側。原點在車庫的中心。
FS_H, FS_X0, FS_X1, FS_XW, FS_Z0, FS_Z1 = 8.6, -24.0, 20.0, 36.0, -14.0, 14.0
FS_DOORS = ((-18.5, 1), (-7.5, 1), (3.5, 0), (14.5, 0))   # 車庫門中心 x、開著
FS_DW, FS_DH = 8.4, 5.8


def fire():
    b = GB(41); H, X0, X1, XW, Z0, Z1, W = FS_H, FS_X0, FS_X1, FS_XW, FS_Z0, FS_Z1, .3
    b.box(X0, XW, 0, .12, Z0, Z1, M['floor'])                                          # 地坪（環氧）
    b.box(X0 - 4, XW + 2, 0, .08, Z1, Z1 + 2.95, M['conc'])                             # 門前接到機坪的混凝土
    b.box(X0 - 4, XW + 2, 0, .06, Z0 - 6, Z0, M['conc'])                               # 背面（陸側）的人行道
    # ── 車庫：後牆、西牆、與值班樓之間的牆（外面鋼板、裡面白）
    b.box(X0, X1, .12, H, Z0, Z0 + W, M['clad']); b.box(X0, X0 + W, .12, H, Z0, Z1, M['clad']); b.box(X1 - W, X1, .12, H, Z0, Z1, M['white'])
    for z in range(-12, 13, 4): b.box(X0 - .12, X0, .12, H, z - .08, z + .08, M['grey'])   # 西牆外的立肋
    # 正面：門與門之間的墩、門楣、紅色簷帶與站名、門號
    xs = [X0] + [v for xc, _ in FS_DOORS for v in (xc - FS_DW / 2, xc + FS_DW / 2)] + [X1]
    for a, c in zip(xs[0::2], xs[1::2]): b.box(a, c, .12, H, Z1 - W, Z1, M['white'])
    b.box(X0, X1, FS_DH, H, Z1 - W, Z1, M['white'])
    b.box(X0 - .1, XW + .1, H - 1.3, H - .1, Z1, Z1 + .08, M['redp'])
    b.text('AIRPORT FIRE & RESCUE', .82, (-2.0, H - .7, Z1 + .08), (1, 0, 0), (0, 0, 1), M['white'], .04)
    for i, (xc, op) in enumerate(FS_DOORS):
        b.box(xc - .7, xc + .7, FS_DH + .35, FS_DH + 1.45, Z1, Z1 + .03, M['dark']); b.text(str(i + 1), .8, (xc, FS_DH + .9, Z1 + .03), (1, 0, 0), (0, 0, 1), M['white'], .03)
        for s in (-1, 1): b.box(xc + s * FS_DW / 2 - .12, xc + s * FS_DW / 2 + .12, .12, FS_DH, Z1, Z1 + .15, M['yel'])   # 門框的防撞護角
        b.box(xc - FS_DW / 2, xc + FS_DW / 2, FS_DH - .12, FS_DH, Z1 - W - .02, Z1 + .05, M['grey'])
        if op:   # 開著：捲門收在門楣後面的捲箱，兩側的軌道
            b.box(xc - FS_DW / 2, xc + FS_DW / 2, FS_DH, FS_DH + .6, Z1 - 1.0, Z1 - W, M['grey'])
            for s in (-1, 1): b.box(xc + s * (FS_DW / 2 - .05) - .05, xc + s * (FS_DW / 2 - .05) + .05, .12, FS_DH, Z1 - W - .12, Z1 - W, M['galv'])
        else:    # 關著：分段的鋼門、一排窗
            b.box(xc - FS_DW / 2, xc + FS_DW / 2, .12, FS_DH - .12, Z1 - .22, Z1 - .1, M['door'])
            for k in range(1, 10): b.box(xc - FS_DW / 2, xc + FS_DW / 2, .12 + k * .6 - .02, .12 + k * .6 + .02, Z1 - .1, Z1 - .08, M['grey'])
            for k in range(6):
                x = xc - FS_DW / 2 + .5 + k * 1.25; b.box(x, x + 1.0, 3.75, 4.2, Z1 - .1, Z1 - .07, M['dglass'])
    # 車庫裡：白色天花與燈、地上的黃線、後牆的裝備櫃、廢氣抽管、牆上的水帶架
    b.box(X0, X1, H - .45, H - .3, Z0, Z1 - W, M['white'])
    for xc, _ in FS_DOORS:
        for z in (-8.0, -1.0, 6.0): b.box(xc - 1.8, xc + 1.8, H - .5, H - .45, z - .15, z + .15, M['bay'])
        for s in (-1, 1): b.box(xc + s * 4.6 - .06, xc + s * 4.6 + .06, .12, .125, Z0 + 1.0, Z1 - .4, M['yel'])
        b.box(xc - 4.4, xc + 4.4, .12, 2.2, Z0 + W, Z0 + W + .55, M['redp'])
        for k in range(1, 8): b.box(xc - 4.4 + k * 1.1 - .015, xc - 4.4 + k * 1.1 + .015, .15, 2.15, Z0 + W + .55, Z0 + W + .57, M['dark'])
        b.box(xc - 4.4, xc + 4.4, 2.2, 2.26, Z0 + W, Z0 + W + .6, M['galv'])
        b.tube((xc, H - .45, -6.5), (xc, 3.6, -6.5), .09, M['dark'], 10); b.tube((xc, 3.6, -6.5), (xc, 2.6, -6.0), .11, M['yel'], 10)
    for z in (-9.0, -5.0, -1.0, 3.0):
        b.box(X0 + W, X0 + W + .2, 1.2, 1.3, z - .9, z + .9, M['galv'])
        b.xcyl(X0 + W + .05, X0 + W + .5, 1.65, z, .35, 14, M['redp'])
    # ── 值班樓（x 20..36）：兩層，帶狀窗、北面的入口與雨遮，屋頂角上一間玻璃瞭望室
    b.box(X1, XW, .12, H, Z0, Z1, M['white'])
    for f in range(2):
        y0 = .12 + f * 4.2
        for (a, c, z, n) in ((X1 + 1.0, XW - 1.0, Z1, 1), (X1 + 2.5, XW - 1.0, Z0, -1)):
            b.box(a, c, y0 + 1.0, y0 + 2.7, min(z, z + n * .04), max(z, z + n * .04), M['oglass'])
            for x in [a + i * 1.5 for i in range(int((c - a) / 1.5) + 1)]: b.box(x - .05, x + .05, y0 + 1.0, y0 + 2.7, min(z, z + n * .08), max(z, z + n * .08), M['dark'])
        b.box(XW, XW + .04, y0 + 1.0, y0 + 2.7, Z0 + 1.0, Z1 - 1.0, M['oglass'])
        for z in [Z0 + 1.0 + i * 1.5 for i in range(int((Z1 - Z0 - 2) / 1.5) + 1)]: b.box(XW, XW + .08, y0 + 1.0, y0 + 2.7, z - .05, z + .05, M['dark'])
        b.box(X1, XW + .1, y0 + 3.95, y0 + 4.2, Z0 - .1, Z1 + .1, M['grey'])          # 樓板帶
    b.box(X1 + .6, X1 + 2.2, .12, 2.4, Z0 - .05, Z0, M['dglass']); b.box(X1 + .2, X1 + 2.6, 2.6, 2.75, Z0 - 2.2, Z0, M['grey'])   # 入口與雨遮
    for x in (X1 + .3, X1 + 2.5): b.box(x - .05, x + .05, .06, 2.6, Z0 - 2.1, Z0 - 2.0, M['galv'])
    # 瞭望室（x 27..36、z 4..14）：玻璃四面、出挑的屋頂、天線與警報器
    WX0, WZ0, WY = 27.0, 4.0, H + .35
    b.box(WX0, XW, H, WY, WZ0, Z1, M['white'])
    for (x0, x1, z0, z1) in ((WX0, XW, Z1 - .04, Z1), (WX0, XW, WZ0, WZ0 + .04), (WX0, WX0 + .04, WZ0, Z1), (XW - .04, XW, WZ0, Z1)):
        b.box(x0, x1, WY + .9, WY + 3.0, z0, z1, M['cglass'])
    b.box(WX0, XW, WY, WY + .9, WZ0 + .04, Z1 - .04, M['white'])
    for x in (WX0, WX0 + 3, WX0 + 6, XW):
        for z in (WZ0, Z1): b.box(x - .06, x + .06, WY + .9, WY + 3.0, z - .06, z + .06, M['dark'])
    b.box(WX0 - .6, XW + .6, WY + 3.0, WY + 3.35, WZ0 - .6, Z1 + .6, M['white']); b.box(WX0 - .62, XW + .62, WY + 3.15, WY + 3.3, WZ0 - .62, Z1 + .62, M['redp'])
    b.vcyl(XW - 1.0, WZ0 + 1.0, WY + 3.35, WY + 7.5, .05, 8, M['galv']); b.vcyl(XW - 1.0, WZ0 + 1.0, WY + 7.5, WY + 7.65, .08, 8, M['red'])
    b.box(WX0 + 1, WX0 + 1.6, WY + 3.35, WY + 3.9, WZ0 + 1, WZ0 + 1.6, M['grey']); b.vcyl(WX0 + 1.3, WZ0 + 1.3, WY + 3.9, WY + 4.3, .25, 12, M['grey'], .12)
    # ── 屋頂：女兒牆、空調機組、排風機、往瞭望室的爬梯
    b.box(X0, XW, H, H + .1, Z0, Z1, M['grey'])
    for (x0, x1, z0, z1) in ((X0, XW, Z0, Z0 + .25), (X0, WX0, Z1 - .25, Z1), (X0, X0 + .25, Z0, Z1), (XW - .25, XW, Z0, WZ0)):
        b.box(x0, x1, H, H + .8, z0, z1, M['white'])
    for x in (-14.0, 2.0):
        b.box(x, x + 5, H + .1, H + 1.7, -9, -5.5, M['grey'])
        for k in range(2): b.vcyl(x + 1.3 + k * 2.4, -7.25, H + 1.7, H + 1.85, .9, 18, M['dark'])
    for x in (-20, -8, 4, 14): b.vcyl(x, 4, H + .1, H + .7, .4, 12, M['galv']); b.vcyl(x, 4, H + .7, H + .8, .5, 12, M['grey'])
    for i in range(12): b.box(WX0 - .5, WX0 - .1, H + .2 + i * .3, H + .24 + i * .3, 6.0, 6.5, M['galv'])
    # ── 水帶塔（西北角）：清水混凝土、細長窗、頂上的百葉
    TX0, TX1, TZ0, TZ1, TH = X0 - 4.0, X0, Z0, Z0 + 4.0, 15.5
    b.box(TX0, TX1, .06, TH, TZ0, TZ1, M['conc'])
    for y in (3.0, 7.0, 11.0): b.box(TX0 + 1.6, TX0 + 2.4, y, y + 2.2, TZ1, TZ1 + .03, M['dglass'])
    b.box(TX0 - .15, TX1 + .15, TH - 1.3, TH - .3, TZ0 - .15, TZ1 + .15, M['grey'])
    for k in range(5): b.box(TX0 - .2, TX1 + .2, TH - 1.25 + k * .2, TH - 1.2 + k * .2, TZ1 + .15, TZ1 + .2, M['dark'])
    b.box(TX0 - .2, TX1 + .2, TH - .3, TH, TZ0 - .2, TZ1 + .2, M['white'])
    b.vcyl(TX0 + 2, TZ0 + 2, TH, TH + .2, .1, 8, M['red'])
    # 門前：消防栓、旗桿
    for x in (X0 - 2.0, XW + 1.0):
        b.vcyl(x, Z1 + 1.8, .08, .8, .14, 12, M['redp']); b.vcyl(x, Z1 + 1.8, .8, .95, .17, 12, M['redp'])
        for s in (-1, 1): b.xcyl(x + s * .14, x + s * .24, .6, Z1 + 1.8, .06, 8, M['redp'])
    b.vcyl(XW + 1.0, Z0 - 3.0, .06, 10.0, .06, 10, M['galv'], .04)
    return b.build('af_fire')


# ════════ 油庫：防溢堤（1.4 m 混凝土牆）裡三座 22 m 直徑的油槽（錐頂、螺旋梯、頂上的欄杆、泡沫消防的泡沫室）、
# 往東的管架接到泵房，再往東是油罐車的裝油棚。原點在防溢堤中心。
FU_TANKS = (-46.0, -14.0, 18.0)
FU_R, FU_H = 11.0, 14.0
FU_BX0, FU_BX1, FU_BZ0, FU_BZ1 = -62.0, 34.0, -22.0, 22.0


def fuel():
    b = GB(43); R, H = FU_R, FU_H
    b.box(FU_BX0, FU_BX1, 0, .04, FU_BZ0, FU_BZ1, M['conc'])                                       # 堤內的地坪
    for (x0, x1, z0, z1) in ((FU_BX0, FU_BX1, FU_BZ0, FU_BZ0 + .35), (FU_BX0, FU_BX1, FU_BZ1 - .35, FU_BZ1), (FU_BX0, FU_BX0 + .35, FU_BZ0, FU_BZ1), (FU_BX1 - .35, FU_BX1, FU_BZ0, FU_BZ1)):
        b.box(x0, x1, 0, 1.4, z0, z1, M['conc'])
    for x in (FU_BX0 + 6, FU_BX1 - 6):   # 跨堤的階梯（南面）
        for i in range(5):
            b.box(x - .6, x + .6, 0, .3 + i * .28, FU_BZ1 + 1.5 - i * .3, FU_BZ1 + 1.8 - i * .3, M['galv'])
            b.box(x - .6, x + .6, 0, .3 + i * .28, FU_BZ1 - 1.8 + i * .3, FU_BZ1 - 1.5 + i * .3, M['galv'])
    for k, tx in enumerate(FU_TANKS):
        b.vcyl(tx, 0, 0, .3, R + .6, 40, M['conc'])
        b.vcyl(tx, 0, .3, H, R, 48, M['tank'], cap=False)
        b.vcyl(tx, 0, H, H + 1.6, R + .05, 48, M['tank'], .9)                                          # 錐頂
        for y in (4.5, 9.0): b.vcyl(tx, 0, y, y + .15, R + .06, 48, M['white'], cap=False)
        b.vcyl(tx, 0, H - .9, H - .7, R + .5, 48, M['grey'])                                            # 風樑（頂下的環台）
        ring_rail(b, tx, 0, R - .2, H + .1, 1.0, M['yel'], 40)
        b.text(f'T-{k + 1}', 1.6, (tx, 9.8, R + .3), (1, 0, 0), (0, 0, 1), M['dark'], .04)
        b.text('JET A-1', 1.0, (tx, 7.3, R + .3), (1, 0, 0), (0, 0, 1), M['dark'], .04)
        for a in (.4, 2.5, 4.6): b.box(tx + (R + .05) * math.cos(a) - .3, tx + (R + .05) * math.cos(a) + .3, H - 1.6, H - .9, (R + .05) * math.sin(a) - .3, (R + .05) * math.sin(a) + .3, M['white'])   # 泡沫室
        # 螺旋梯：從槽的西北邊繞一圈半上到頂（踏板的外緣斜樑、扶手、轉角柱）
        n = 40; ra, rb = R + .15, R + 1.15
        for i in range(n):
            a0, a1 = 2.4 + i * .1, 2.4 + (i + 1) * .1; y0, y1 = .3 + i * (H - .4) / n, .3 + (i + 1) * (H - .4) / n
            for r in (ra, rb): b.beam((tx + r * math.cos(a0), y0, r * math.sin(a0)), (tx + r * math.cos(a1), y1, r * math.sin(a1)), .06, M['galv'], .12)
            b.tube((tx + rb * math.cos(a0), y0 + 1.0, rb * math.sin(a0)), (tx + rb * math.cos(a1), y1 + 1.0, rb * math.sin(a1)), .03, M['yel'], 6)
            if i % 4 == 0: b.tube((tx + rb * math.cos(a0), y0, rb * math.sin(a0)), (tx + rb * math.cos(a0), y0 + 1.0, rb * math.sin(a0)), .03, M['yel'], 6)
        # 出油管：槽底往南接到管架
        b.tube((tx + 3, .9, R - .2), (tx + 3, .9, 15.5), .25, M['grey'], 12); b.tube((tx + 3, .9, 15.5), (tx + 3, 2.6, 15.5), .25, M['grey'], 12)
        b.box(tx + 2.6, tx + 3.4, .3, 1.5, R + 1.0, R + 1.6, M['yel'])                                   # 閥
    # 管架：堤內沿 z 15.5、2.6 m 高，往東跨過堤牆到泵房
    for x in range(int(FU_TANKS[0]), int(FU_BX1) + 14, 6):
        for z in (14.8, 16.2): b.box(x - .12, x + .12, 0, 2.3, z - .12, z + .12, M['galv'])
        b.box(x - .15, x + .15, 2.3, 2.4, 14.6, 16.4, M['galv'])
    for dz in (-.35, .35): b.tube((FU_TANKS[0] + 3, 2.6, 15.5 + dz), (FU_BX1 + 12, 2.6, 15.5 + dz), .25, M['grey'], 12)
    # 泵房（堤外東側）
    PX0, PX1, PZ0, PZ1 = FU_BX1 + 8, FU_BX1 + 22, 4.0, 18.0
    b.box(PX0, PX1, 0, .2, PZ0, PZ1, M['conc']); b.box(PX0, PX1, .2, 5.0, PZ0, PZ1, M['white']); b.box(PX0 - .2, PX1 + .2, 5.0, 5.25, PZ0 - .2, PZ1 + .2, M['grey'])
    b.box(PX0 + 4, PX0 + 8, .2, 4.0, PZ1, PZ1 + .05, M['door'])
    for k in range(1, 7): b.box(PX0 + 4, PX0 + 8, .2 + k * .55, .23 + k * .55, PZ1 + .05, PZ1 + .07, M['grey'])
    for x in (PX0 + 1, PX1 - 2.5):
        for k in range(6): b.box(x, x + 1.5, 2.6 + k * .2, 2.65 + k * .2, PZ1, PZ1 + .1, M['dark'])
    b.text('FUEL FARM', .7, ((PX0 + PX1) / 2, 4.4, PZ1 + .05), (1, 0, 0), (0, 0, 1), M['dark'], .03)
    for z in (PZ0 + 4, PZ0 + 9): b.box(PX1 + .5, PX1 + 2.5, .2, 1.6, z - 1.0, z + 1.0, M['white']); b.vcyl(PX1 + 1.5, z, 1.6, 1.75, .7, 14, M['dark'])
    # 裝油棚（再往東）：四根柱的雨遮、兩座裝油臂、走道平台
    LX0, LX1, LZ0, LZ1 = PX1 + 8, PX1 + 24, -2.0, 18.0
    b.box(LX0, LX1, 0, .15, LZ0, LZ1, M['conc'])
    for x in (LX0 + 1, LX1 - 1):
        for z in (LZ0 + 1, LZ1 - 1): b.box(x - .2, x + .2, .15, 7.0, z - .2, z + .2, M['white'])
    b.box(LX0 - .5, LX1 + .5, 7.0, 7.6, LZ0 - .5, LZ1 + .5, M['white']); b.box(LX0 - .52, LX1 + .52, 7.2, 7.45, LZ0 - .52, LZ1 + .52, M['redp'])
    for z in (LZ0 + 5, LZ1 - 5): b.box(LX0 + 2, LX1 - 2, 6.85, 7.0, z - .2, z + .2, M['led'])
    xm = (LX0 + LX1) / 2
    b.box(xm - .6, xm + .6, 0, 3.6, LZ0 + 1, LZ1 - 1, M['grey']); b.box(xm - 1.2, xm + 1.2, 3.6, 3.7, LZ0 + 1, LZ1 - 1, M['galv'])
    for s in (-1, 1):
        b.tube((xm + s * 1.2, 4.6, LZ0 + 1), (xm + s * 1.2, 4.6, LZ1 - 1), .03, M['yel'], 6)
        for z in (LZ0 + 6, LZ1 - 6):
            b.tube((xm + s * .6, 2.8, z), (xm + s * 2.4, 3.2, z), .12, M['galv'], 10); b.tube((xm + s * 2.4, 3.2, z), (xm + s * 2.6, 1.6, z), .1, M['galv'], 10)
    for dz in (-.35, .35): b.tube((FU_BX1 + 12, 2.6, 15.5 + dz), (FU_BX1 + 12, 2.6, PZ1 - .5), .25, M['grey'], 12)
    for z in (LZ0, LZ1): b.box(LX0 - 2, LX1 + 2, .02, .05, z - .08, z + .08, M['yel'])
    return b.build('af_fuel')


# ════════ 機場搜索雷達（ASR）：22 m 的方形格構塔、頂上的平台與欄杆、拋物面的天線（上面是二次雷達的長條天線）、塔下的設備房
def asr():
    b = GB(47); TH = 22.0
    b.box(-4, 4, 0, .3, -4, 4, M['conc'])
    lattice(b, 0, 0, .3, TH, 6.0, 3.2, 3.15, M['galv'])
    b.box(-2.6, 2.6, TH, TH + .15, -2.6, 2.6, M['galv'])
    b.rail([(-2.6, TH + .15, -2.6), (2.6, TH + .15, -2.6), (2.6, TH + .15, 2.6), (-2.6, TH + .15, 2.6), (-2.6, TH + .15, -2.6)], 1.1, M['yel'])
    for y in [.3 + i * .35 for i in range(int((TH - .3) / .35))]: b.box(-.3, .3, y, y + .035, 2.0 - y * .0175, 2.06 - y * .0175, M['galv'])   # 塔裡的直梯（跟著塔腳收）
    b.vcyl(0, 0, TH + .15, TH + 1.6, .9, 20, M['white']); b.vcyl(0, 0, TH + 1.6, TH + 2.1, .6, 16, M['grey'])
    # 拋物面（寬 9 m、高 3.6 m，往 −z 開口、略往上仰）：兩面都畫
    nx, ny = 18, 6; W, Hh = 9.0, 3.6; pts = []
    for j in range(ny + 1):
        for i in range(nx + 1):
            u = -W / 2 + W * i / nx; v = Hh * j / ny
            pts.append((u, TH + 2.3 + v, .9 - u * u / 18 - (v - 1.2) ** 2 / 14 + v * .25))
    for j in range(ny):
        for i in range(nx):
            a = j * (nx + 1) + i; q = [pts[a], pts[a + 1], pts[a + nx + 2], pts[a + nx + 1]]
            b.poly(q, M['grey']); b.poly(list(reversed(q)), M['grey'])
    for u in (-3.0, 0.0, 3.0): b.beam((u, TH + 2.3, .95 - u * u / 18), (u, TH + 2.3 + Hh, .95 - u * u / 18 + .5), .05, M['dark'])
    b.beam((0, TH + 2.1, .4), (0, TH + 3.2, -2.6), .06, M['dark']); b.box(-.25, .25, TH + 3.0, TH + 3.5, -2.9, -2.5, M['dark'])   # 饋電喇叭的支臂
    b.box(-4.8, 4.8, TH + 6.05, TH + 6.6, .9, 1.35, M['white']); b.beam((0, TH + 5.9, 1.0), (0, TH + 6.1, 1.1), .25, M['grey'])   # 二次雷達的長條天線
    b.vcyl(2.2, 2.2, TH + .15, TH + 2.8, .04, 6, M['galv']); b.vcyl(2.2, 2.2, TH + 2.8, TH + 2.95, .08, 8, M['red'])
    shelter(b, 4.5, 11.0, -2.5, 2.5, 3.2)
    for k in range(3): b.tube((4.5, 2.5 + k * .15, -1.0 + k * .3), (2.5, 2.5 + k * .15, -1.0 + k * .3), .05, M['dark'], 6)   # 電纜
    return b.build('af_asr')


# ════════ ILS 定位台天線陣：跑道東端外，橫跨中線（沿 z）的 16 支對數週期天線，朝西（−x，對著進場的飛機），裝在 2.4 m 高的框架上；後面是設備房與遠場監視天線
def loc():
    b = GB(53); NA, SP = 16, 3.1; z0 = -SP * (NA - 1) / 2
    b.box(-.2, 1.4, 0, .06, z0 - 1.2, -z0 + 1.2, M['grass'])                                         # 天線下的碎石帶
    for i in range(NA):
        z = z0 + i * SP
        # 每支天線一支易斷桿：混凝土墩、鍍鋅管、中段的易斷接頭（白色套環）、頂上的 U 形夾座
        b.box(.35, .85, 0, .18, z - .25, z + .25, M['conc'])
        b.vcyl(.6, z, .18, 1.1, .055, 10, M['galv']); b.vcyl(.6, z, 1.1, 1.2, .075, 10, M['white']); b.vcyl(.6, z, 1.2, 2.45, .05, 10, M['galv'])
        b.box(.45, .75, 2.45, 2.52, z - .08, z + .08, M['galv'])
        # 對數週期天線：上下兩支集合線（鋁管），偶極子越往前越短、上下交錯朝兩邊伸出
        for y in (2.58, 2.7): b.tube((-2.3, y, z), (1.5, y, z), .022, M['white'], 8)
        for k in range(11):
            x = -2.15 + k * .35; L = .28 + k * .095
            y, sgn = (2.58, 1) if k % 2 == 0 else (2.7, -1)
            b.tube((x, y, z), (x, y, z + sgn * L), .011, M['white'], 6); b.tube((x, 2.64 * 2 - y, z), (x, 2.64 * 2 - y, z - sgn * L), .011, M['white'], 6)
        b.box(1.42, 1.62, 2.55, 2.73, z - .06, z + .06, M['grey'])                                   # 後端的饋電接頭
        b.tube((1.55, 2.55, z), (.65, 2.0, z), .012, M['black'], 6); b.tube((.65, 2.0, z), (.65, .2, z + .07), .012, M['black'], 6)   # 饋線沿桿下來
    b.box(.55, .75, 0, .08, z0, -z0, M['dark'])                                                       # 地上的纜線槽
    b.box(.55, 9.0, 0, .08, -.1, .1, M['dark'])
    shelter(b, 9.0, 15.0, -2.0, 2.0, 3.0, 'n')
    b.vcyl(-.6, -z0 + 4.5, .2, 2.6, .05, 8, M['galv']); b.vcyl(-.6, z0 - 4.5, .2, 2.6, .05, 8, M['galv'])   # 近場監視天線
    for zz in (-z0 + 4.5, z0 - 4.5): b.box(-.9, -.3, 2.6, 2.75, zz - .05, zz + .05, M['white'])
    return b.build('af_loc')


def hexa(b, P, m):
    """任意六面體（斜的百葉片、楔形的板）：P 是 8 個角，0–3 一圈、4–7 對應的另一圈；每面照離中心的方向朝外"""
    c = [sum(p[k] for p in P) / 8 for k in range(3)]
    for f in ((0, 1, 2, 3), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)):
        q = [P[i] for i in f]; fc = [sum(p[k] for p in q) / 4 for k in range(3)]
        ow(b, q, m, (fc[0] - c[0], fc[1] - c[1], fc[2] - c[2]))


def cage_ladder(b, x, z0, z1, y0, y1, d, cage=2.4):
    """直梯（兩支側軌、30 cm 一階）＋護籠：z0／z1 是梯子底與頂離桿面的 z（塔往上收），d 是往外的方向（±1）"""
    zz = lambda y: z0 + (z1 - z0) * (y - y0) / (y1 - y0)
    for s in (-1, 1): b.tube((x + s * .22, y0, zz(y0)), (x + s * .22, y1 + 1.0, zz(y1)), .022, M['galv'], 6)
    y = y0 + .3
    while y < y1 + .9: b.tube((x - .22, y, zz(y)), (x + .22, y, zz(y)), .014, M['galv'], 5); y += .3
    y = y0 + cage; hoops = []
    while y < y1 + 1.0:
        zc = zz(y) + d * .36; pts = [(x + .36 * math.cos(math.pi * k / 8), y, zc + d * .36 * math.sin(math.pi * k / 8)) for k in range(9)]
        pts = [(x + .36, y, zz(y))] + pts[1:-1] + [(x - .36, y, zz(y))]
        for p0, p1 in zip(pts, pts[1:]): b.tube(p0, p1, .012, M['galv'], 5)
        hoops.append(pts); y += .9
    for k in (0, 2, 4, 6, 8):
        for h0, h1 in zip(hoops, hoops[1:]): b.tube(h0[k], h1[k], .01, M['galv'], 4)


# ════════ 下滑台：跑道南側、著陸區旁 16 m 的方形格構桅杆。M 型陣列的三具天線（4.4／8.8／13.2 m，越高越往跑道伸出）朝 −z：
# 每具是 2.6 m 寬的 90° 角反射器（兩面平行的鋁桿排成 V 形、端框與背樑）、焦線上三支半波偶極子與饋電盒，兩支方管臂架在桿面上；
# 同軸電纜沿桿下到電纜槽；背面一支帶護籠的直梯、頂上的避雷針與障礙燈；底下是設備房，前方一支近場監視天線
def gs():
    b = GB(59); MH = 16.0; W0, W1 = 1.1, .7
    hw = lambda y: (W0 + (W1 - W0) * (y - .3) / (MH - .3)) / 2
    b.box(-3, 9, 0, .05, -3, 3, M['grass']); b.box(-1.2, 1.2, 0, .3, -1.2, 1.2, M['conc'])
    for sx in (-1, 1):
        for sz in (-1, 1): b.box(sx * .55 - .16, sx * .55 + .16, .3, .34, sz * .55 - .16, sz * .55 + .16, M['hdg']); b.vcyl(sx * .55 + .1, sz * .55 + .1, .34, .42, .025, 6, M['hdg'])
    lattice(b, 0, 0, .3, MH, W0, W1, 1.6, M['hdg'], .05)
    b.box(-W1 / 2 - .05, W1 / 2 + .05, MH, MH + .04, -W1 / 2 - .05, W1 / 2 + .05, M['hdg'])
    cage_ladder(b, 0, hw(.3) + .12, hw(MH) + .12, .3, MH, 1)
    for i, (ya, off) in enumerate(((4.4, 0.0), (8.8, .15), (13.2, .3))):
        zm = -hw(ya); zA = zm - .55 - off; R, A = .78, math.radians(45)
        # 臂：兩支方管＋斜撐，桿面上的抱箍
        for sx in (-.75, .75):
            b.beam((sx, ya, zm), (sx, ya, zA + .02), .035, M['hdg'])
            b.beam((sx, ya - .55, zm), (sx, ya - .03, zA + .06), .025, M['hdg'])
            b.box(sx - .07, sx + .07, ya - .1, ya + .1, zm - .02, zm + .04, M['hdg'])
        b.beam((-1.32, ya, zA), (1.32, ya, zA), .045, M['hdg'])                                           # 背樑（V 的頂點）
        for s in (-1, 1):                                                                                    # 上下兩面反射桿
            for k in range(1, 8):
                t = R * k / 7; y = ya + s * t * math.sin(A); z = zA - t * math.cos(A)
                b.tube((-1.3, y, z), (1.3, y, z), .016 if k < 7 else .024, M['white'], 6)
            for x in (-1.3, 0.0, 1.3): b.beam((x, ya, zA), (x, ya + s * R * math.sin(A), zA - R * math.cos(A)), .018, M['hdg'])
        zD = zA - .36                                                                                        # 焦線：三支偶極子與饋電
        for x in (-.85, 0.0, .85):
            b.tube((x, ya, zA), (x, ya, zD), .014, M['hdg'], 6)
            b.tube((x - .23, ya, zD), (x - .02, ya, zD), .013, M['white'], 6); b.tube((x + .02, ya, zD), (x + .23, ya, zD), .013, M['white'], 6)
            b.box(x - .035, x + .035, ya - .035, ya + .035, zD - .02, zD + .05, M['grey'])
        b.box(-.18, .18, ya - .2, ya - .05, zA + .02, zA + .2, M['grey'])                                    # 功分器盒
        b.tube((.1, ya - .2, zA + .1), (.42, ya - .3, zm + .02), .02, M['black'], 6)
        b.tube((.42, ya - .3, zm + .02), (hw(ya) - .05, ya - .3, -hw(ya) + .05), .02, M['black'], 6)
    # 電纜沿桿的東北角下來，進地下的電纜槽
    xs = lambda y: hw(y) - .06
    b.tube((xs(13), 12.9, -xs(13)), (xs(.6), .6, -xs(.6)), .03, M['black'], 6)
    for y in [1.0 + k * 1.2 for k in range(10)]: b.box(xs(y) - .04, xs(y) + .04, y, y + .05, -xs(y) - .04, -xs(y) + .04, M['hdg'])
    b.box(.45, 3.0, 0, .08, -.62, -.42, M['dark'])
    # 頂上：避雷針、兩盞障礙燈；桿中段一盞
    b.vcyl(0, 0, MH + .04, MH + 2.2, .025, 6, M['hdg'], .008)
    for sx in (-1, 1):
        b.box(sx * .3 - .06, sx * .3 + .06, MH + .04, MH + .12, -.06, .06, M['hdg'])
        b.vcyl(sx * .3, 0, MH + .12, MH + .3, .07, 10, M['red']); b.vcyl(sx * .3, 0, MH + .3, MH + .33, .075, 10, M['grey'])
    b.box(hw(8.0) - .02, hw(8.0) + .14, 7.9, 7.98, -.06, .06, M['hdg']); b.vcyl(hw(8.0) + .08, 0, 7.98, 8.14, .06, 10, M['red'])
    shelter(b, 3.0, 8.0, -1.8, 1.8, 3.0)
    # 近場監視天線：易斷桿上一支小偶極子＋小角反射器，朝桿
    mz = -9.0
    b.box(-.2, .2, 0, .15, mz - .2, mz + .2, M['conc']); b.vcyl(0, mz, .15, 2.6, .04, 8, M['hdg']); b.vcyl(0, mz, 1.0, 1.08, .055, 8, M['white'])
    b.beam((-.35, 2.6, mz), (.35, 2.6, mz), .02, M['hdg'])
    for s in (-1, 1):
        for k in range(1, 4):
            t = .22 * k / 3; b.tube((-.35, 2.6 + s * t * .7, mz + t * .7), (.35, 2.6 + s * t * .7, mz + t * .7), .009, M['white'], 5)
    b.tube((-.13, 2.6, mz + .1), (.13, 2.6, mz + .1), .009, M['white'], 5)
    return b.build('af_gs')


# ════════ 氣象觀測場：12 × 12 m 的草地圍場（鍍鋅柱＋三道橫桿的圍籬、南面雙開門、混凝土踏板）。
# 百葉箱（木腳＋斜撐、雙層斜百葉四面、雙層屋頂、北面開門、門前小踏台）、10 m 的傾倒式風桿（鉸鏈底座、三向拉線、
# 頂上橫臂兩端的杯式風速計與風向標、障礙燈、避雷針）、雨量筒與 Alter 擋風圈、雲幕儀（基座上的機箱、斜罩與朝天的窗）、
# 能見度／天氣現象儀、溫濕度防輻射罩、資料箱與朝南的太陽能板
def met():
    b = GB(61); S = 6.0
    for x, z in ((0, 5.3), (0, 4.5), (0, 3.7), (-1.0, 2.9), (-1.9, 2.4), (1.0, 2.9), (1.9, 2.4), (.6, 1.1), (1.2, .2)):
        b.box(x - .3, x + .3, 0, .05, z - .3, z + .3, M['conc'])
    # 圍籬：2.4 m 一支的鍍鋅柱（混凝土基礎）、上中下三道橫桿；南面中間的雙開門
    def fence(pts):
        for a, c in zip(pts, pts[1:]):
            L = math.dist((a[0], a[1]), (c[0], c[1])); n = max(1, round(L / 2.4))
            for i in range(n + 1):
                t = i / n; x, z = a[0] + (c[0] - a[0]) * t, a[1] + (c[1] - a[1]) * t
                b.vcyl(x, z, 0, .1, .1, 8, M['conc']); b.vcyl(x, z, .1, 1.3, .03, 8, M['hdg']); b.vcyl(x, z, 1.3, 1.34, .036, 8, M['hdg'])
            for y in (.12, .7, 1.26): b.tube((a[0], y, a[1]), (c[0], y, c[1]), .02, M['hdg'], 6)
    fence([(1.1, S), (S, S), (S, -S), (-S, -S), (-S, S), (-1.1, S)])
    for s in (-1, 1):
        x0, x1 = s * 1.1, s * .03
        b.vcyl(x0, S, 0, 1.45, .045, 8, M['hdg'])
        for y in (.15, 1.25): b.tube((x0, y, S), (x1, y, S), .02, M['hdg'], 6)
        b.tube((x1, .15, S), (x1, 1.25, S), .02, M['hdg'], 6); b.tube((x0, .15, S), (x1, 1.25, S), .015, M['hdg'], 5)
        b.tube((x0, .7, S), (x1, .7, S), .014, M['hdg'], 5)
    b.box(-.06, .06, .9, 1.05, S - .03, S + .03, M['dark'])
    # 百葉箱（中心 −2.5, −2；門朝北 −z）：四支木腳與斜撐、底板
    cx, cz = -2.5, -2.0; X0, X1, Z0, Z1, Y0, Y1 = cx - .5, cx + .5, cz - .4, cz + .4, 1.2, 1.9
    for sx in (-1, 1):
        for sz in (-1, 1): b.box(cx + sx * .4 - .045, cx + sx * .4 + .045, 0, Y0, cz + sz * .3 - .045, cz + sz * .3 + .045, M['white'])
        b.beam((cx + sx * .4, .25, cz - .3), (cx + sx * .4, Y0 - .1, cz + .3), .025, M['white'])
        b.beam((cx - .4, .35 + (sx + 1) * .3, cz + sx * .3), (cx + .4, .35 + (sx + 1) * .3, cz + sx * .3), .025, M['white'])
    b.box(X0 - .04, X1 + .04, Y0 - .06, Y0, Z0 - .04, Z1 + .04, M['white'])
    for xx in (X0, X1):
        for zz in (Z0, Z1): b.box(xx - .03, xx + .03, Y0, Y1, zz - .03, zz + .03, M['white'])     # 角柱
    # 四面雙層斜百葉：每片 4.5 cm 寬、往外下斜；外層與內層斜向相反
    def louvers(a, c, n, axis):
        for k in range(14):
            y = Y0 + .04 + k * .046
            for layer, (dy, dd) in enumerate(((.035, .045), (-.03, .02))):
                o = n * (.0 if layer == 0 else -.05)
                if axis == 'z':
                    z_o, z_i = a + o, a + o - n * dd
                    P = [(c[0] + .02, y, z_o), (c[1] - .02, y, z_o), (c[1] - .02, y + dy, z_i), (c[0] + .02, y + dy, z_i)]
                    P = P + [(p[0], p[1] + .008, p[2]) for p in P]
                else:
                    x_o, x_i = a + o, a + o - n * dd
                    P = [(x_o, y, c[0] + .02), (x_o, y, c[1] - .02), (x_i, y + dy, c[1] - .02), (x_i, y + dy, c[0] + .02)]
                    P = P + [(p[0], p[1] + .008, p[2]) for p in P]
                hexa(b, P, M['white'])
    louvers(Z1, (X0, X1), 1, 'z'); louvers(Z0, (X0, X1), -1, 'z'); louvers(X0, (Z0, Z1), -1, 'x'); louvers(X1, (Z0, Z1), 1, 'x')
    b.box(X0 + .05, X1 - .05, Y0, Y1, Z0 + .07, Z1 - .07, M['dark'])                                             # 箱裡（百葉縫看進去是暗的）
    b.box(X0 - .02, X1 + .02, Y1, Y1 + .04, Z0 - .02, Z1 + .02, M['white'])
    hexa(b, [(X0 - .08, Y1 + .1, Z0 - .1), (X1 + .08, Y1 + .1, Z0 - .1), (X1 + .08, Y1 + .1, Z1 + .1), (X0 - .08, Y1 + .1, Z1 + .1),
             (X0 - .08, Y1 + .13, Z0 - .1), (X1 + .08, Y1 + .13, Z0 - .1), (X1 + .08, Y1 + .23, Z1 + .1), (X0 - .08, Y1 + .23, Z1 + .1)], M['white'])   # 上層斜屋頂（往北洩水）
    for xx in (X0 + .1, cx, X1 - .1): b.box(xx - .03, xx + .03, Y1 + .04, Y1 + .1, Z0, Z1, M['white'])
    for x0_, x1_, y0_, y1_ in ((cx - .46, cx + .46, Y0 + .01, Y0 + .05), (cx - .46, cx + .46, Y1 - .05, Y1 - .01), (cx - .46, cx - .42, Y0 + .01, Y1 - .01), (cx + .42, cx + .46, Y0 + .01, Y1 - .01), (cx - .02, cx + .02, Y0 + .01, Y1 - .01)):
        b.box(x0_, x1_, y0_, y1_, Z0 - .012, Z0 + .005, M['white'])                                           # 北面兩扇門的門框（百葉在框裡）
    for yy in (Y0 + .15, Y1 - .15): b.box(X0 + .02, X0 + .08, yy - .04, yy + .04, Z0 - .02, Z0 - .005, M['hdg'])
    b.box(cx + .38, cx + .42, Y0 + .3, Y0 + .4, Z0 - .04, Z0 - .01, M['hdg'])
    b.box(cx - .4, cx + .4, .35, .4, Z0 - .75, Z0 - .25, M['white'])                                             # 踏台
    for sx in (-1, 1):
        for zz in (Z0 - .7, Z0 - .3): b.box(cx + sx * .36 - .03, cx + sx * .36 + .03, 0, .35, zz - .03, zz + .03, M['white'])
    # 風桿（3, −3）：鉸鏈底座、錐形鋼管、三向拉線（6 m 處），頂上的橫臂
    mx, mz, MH = 3.0, -3.0, 10.0
    b.box(mx - .4, mx + .4, 0, .25, mz - .4, mz + .4, M['conc'])
    b.box(mx - .2, mx + .2, .25, .28, mz - .2, mz + .2, M['hdg'])
    for s in (-1, 1): b.box(mx + s * .1 - .012, mx + s * .1 + .012, .28, .55, mz - .08, mz + .08, M['hdg'])
    b.tube((mx - .14, .45, mz), (mx + .14, .45, mz), .025, M['hdg'], 8)
    b.vcyl(mx, mz, .3, MH, .075, 12, M['hdg'], .04)
    b.vcyl(mx, mz, 1.2, 1.6, .1, 10, M['grey'])                                                                   # 接線盒
    b.box(mx - .08, mx + .08, 1.1, 1.65, mz - .17, mz - .08, M['grey'])
    b.tube((mx, 1.1, mz - .12), (mx, .25, mz - .12), .015, M['black'], 5)
    b.vcyl(mx, mz, 6.0, 6.08, .085, 10, M['hdg'])
    for k in range(3):
        a = math.pi / 2 + k * 2 * math.pi / 3; gx, gz = mx + 4.0 * math.cos(a), mz + 4.0 * math.sin(a)
        gx, gz = min(max(gx, -S + .4), S - .4), min(max(gz, -S + .4), S - .4)
        b.tube((mx, 6.04, mz), (gx, .25, gz), .007, M['hdg'], 4)
        b.box(gx - .15, gx + .15, 0, .12, gz - .15, gz + .15, M['conc']); b.tube((gx, .12, gz), (gx, .3, gz), .015, M['hdg'], 5)
    b.beam((mx - .9, MH - .1, mz), (mx + .9, MH - .1, mz), .03, M['hdg'])
    for s in (-1, 1): b.beam((mx, MH - .7, mz), (mx + s * .7, MH - .14, mz), .015, M['hdg'])
    ax, ay = mx - .85, MH - .07                                                                                   # 西端：杯式風速計
    b.vcyl(ax, mz, ay, ay + .22, .025, 8, M['hdg']); b.vcyl(ax, mz, ay + .22, ay + .3, .04, 10, M['white'])
    for k in range(3):
        a = k * 2 * math.pi / 3; ex, ez = ax + .17 * math.cos(a), mz + .17 * math.sin(a)
        b.tube((ax, ay + .27, mz), (ex, ay + .27, ez), .006, M['hdg'], 4)
        tx, tz = -math.sin(a) * .03, math.cos(a) * .03
        b.tube((ex - tx, ay + .27, ez - tz), (ex + tx, ay + .27, ez + tz), .035, M['white'], 10)
    vx = mx + .85                                                                                                 # 東端：風向標（尾翼、配重）
    b.vcyl(vx, mz, ay, ay + .22, .025, 8, M['hdg']); b.vcyl(vx, mz, ay + .22, ay + .3, .035, 10, M['white'])
    b.tube((vx - .25, ay + .28, mz), (vx + .38, ay + .28, mz), .008, M['hdg'], 5)
    hexa(b, [(vx + .2, ay + .2, mz - .004), (vx + .4, ay + .2, mz - .004), (vx + .4, ay + .4, mz - .004), (vx + .26, ay + .32, mz - .004),
             (vx + .2, ay + .2, mz + .004), (vx + .4, ay + .2, mz + .004), (vx + .4, ay + .4, mz + .004), (vx + .26, ay + .32, mz + .004)], M['white'])
    b.tube((vx - .25, ay + .28, mz), (vx - .32, ay + .28, mz), .022, M['dark'], 8)
    b.vcyl(mx, mz, MH, MH + .12, .05, 10, M['red']); b.vcyl(mx, mz, MH + .12, MH + 1.2, .015, 6, M['hdg'], .005)
    # 雨量筒（2.5, 2.5）：基座、筒身、承水口的刃口；Alter 擋風圈（直徑 1.2 m 的環、24 片垂片）
    rx, rz = 2.5, 2.5
    b.box(rx - .35, rx + .35, .04, .14, rz - .35, rz + .35, M['conc'])
    b.vcyl(rx, rz, .14, .85, .1, 16, M['hdg']); b.vcyl(rx, rz, .85, 1.0, .1, 16, M['white'], .115)
    b.vcyl(rx, rz, 1.0, 1.02, .117, 20, M['hdg'], .117, False); b.vcyl(rx, rz, .99, 1.0, .107, 20, M['dark'])
    for k in range(4):
        a = math.pi / 4 + k * math.pi / 2; b.tube((rx + .62 * math.cos(a), 0, rz + .62 * math.sin(a)), (rx + .62 * math.cos(a), 1.02, rz + .62 * math.sin(a)), .02, M['hdg'], 6)
    ring = [(rx + .6 * math.cos(2 * math.pi * k / 24), 1.02, rz + .6 * math.sin(2 * math.pi * k / 24)) for k in range(25)]
    for p0, p1 in zip(ring, ring[1:]): b.tube(p0, p1, .012, M['hdg'], 5)
    for k in range(24):
        a = 2 * math.pi * (k + .5) / 24; ca, sa = math.cos(a), math.sin(a); tx, tz = -sa * .07, ca * .07
        r0, r1 = .6, .68
        P = [(rx + r0 * ca - tx, 1.0, rz + r0 * sa - tz), (rx + r0 * ca + tx, 1.0, rz + r0 * sa + tz), (rx + r1 * ca + tx, .55, rz + r1 * sa + tz), (rx + r1 * ca - tx, .55, rz + r1 * sa - tz)]
        P = P + [(p[0] - ca * .006, p[1], p[2] - sa * .006) for p in P]
        hexa(b, P, M['grey'])
    # 雲幕儀（−2.5, 2.1）：混凝土基座、機箱、斜罩與朝天的窗、側面的把手與通風
    qx, qz = -2.5, 2.1
    b.box(qx - .6, qx + .6, .04, .2, qz - .5, qz + .5, M['conc'])
    b.box(qx - .2, qx + .2, .2, .35, qz - .2, qz + .2, M['hdg'])
    b.box(qx - .32, qx + .32, .35, 1.25, qz - .3, qz + .3, M['white'])
    hexa(b, [(qx - .36, 1.25, qz - .34), (qx + .36, 1.25, qz - .34), (qx + .36, 1.25, qz + .34), (qx - .36, 1.25, qz + .34),
             (qx - .36, 1.62, qz - .34), (qx + .36, 1.62, qz - .34), (qx + .36, 1.36, qz + .34), (qx - .36, 1.36, qz + .34)], M['white'])
    ow(b, [(qx - .24, 1.5, qz - .22), (qx + .24, 1.5, qz - .22), (qx + .24, 1.39, qz + .26), (qx - .24, 1.39, qz + .26)], M['cglass'], (0, 1, -.4))
    hexa(b, [(qx - .36, 1.62, qz - .34), (qx + .36, 1.62, qz - .34), (qx + .36, 1.62, qz - .2), (qx - .36, 1.62, qz - .2),
             (qx - .36, 1.68, qz - .38), (qx + .36, 1.68, qz - .38), (qx + .36, 1.66, qz - .2), (qx - .36, 1.66, qz - .2)], M['white'])   # 遮光簷
    for k in range(5): b.box(qx + .32, qx + .335, .6 + k * .07, .63 + k * .07, qz - .2, qz + .2, M['dark'])
    for s in (-1, 1): b.tube((qx - .33, .9, qz + s * .12), (qx - .33, 1.1, qz + s * .12), .012, M['hdg'], 5)
    b.box(qx - .1, qx + .1, .7, .9, qz + .3, qz + .32, M['grey'])
    # 能見度／天氣現象儀（1.8, −0.6）：桿、橫臂、往下斜的發射與接收頭、遮光罩
    px, pz = 1.8, -.6
    b.box(px - .25, px + .25, .04, .15, pz - .25, pz + .25, M['conc']); b.vcyl(px, pz, .15, 2.4, .045, 10, M['hdg'])
    b.box(px - .12, px + .12, 1.0, 1.35, pz + .05, pz + .2, M['grey'])
    b.beam((px - .6, 2.3, pz), (px + .6, 2.3, pz), .03, M['hdg'])
    for s in (-1, 1):
        hx = px + s * .62; b.box(hx - .07, hx + .07, 2.2, 2.38, pz - .07, pz + .07, M['white'])
        b.tube((hx, 2.22, pz), (hx - s * .12, 2.0, pz), .05, M['white'], 10); b.tube((hx - s * .12, 2.0, pz), (hx - s * .14, 1.96, pz), .058, M['dark'], 10)
    # 溫濕度防輻射罩（−0.6, −3.2）：桿上 10 片疊盤
    tx_, tz_ = -.6, -3.2
    b.vcyl(tx_, tz_, 0, 1.7, .03, 8, M['hdg']); b.beam((tx_, 1.5, tz_), (tx_ + .2, 1.5, tz_), .015, M['hdg'])
    for k in range(10): b.vcyl(tx_ + .25, tz_, 1.3 + k * .03, 1.312 + k * .03, .09 - (k > 7) * .02, 16, M['white'], .08 - (k > 7) * .02)
    b.vcyl(tx_ + .25, tz_, 1.3, 1.6, .03, 8, M['white'])
    # 資料箱與太陽能板（0, 0）：桿、不鏽鋼箱（門縫、鎖、遮雨簷）、朝南（+z）傾 35° 的板（鋁框、電池格）
    b.box(-.2, .2, .04, .12, -.2, .2, M['conc']); b.vcyl(0, 0, .12, 2.25, .045, 10, M['hdg'])
    b.box(-.3, .3, .9, 1.55, .05, .3, M['hdg']); b.box(-.32, .32, 1.55, 1.58, .03, .34, M['hdg'])
    b.box(-.005, .005, .92, 1.53, .3, .305, M['dark']); b.box(.2, .24, 1.15, 1.25, .3, .32, M['dark'])
    b.tube((-.2, .9, .2), (-.2, .12, .05), .016, M['black'], 5); b.tube((.15, .9, .2), (.15, .12, .05), .016, M['black'], 5)
    pa = math.radians(35); y0p, z0p, L = 2.0, .5, 1.0
    P = [(-.6, y0p, z0p), (.6, y0p, z0p), (.6, y0p + L * math.sin(pa), z0p - L * math.cos(pa)), (-.6, y0p + L * math.sin(pa), z0p - L * math.cos(pa))]
    hexa(b, P + [(p[0], p[1] - .035, p[2] - .02) for p in P], M['hdg'])
    nrm = (0, math.cos(pa), math.sin(pa))
    for i in range(6):
        for j in range(3):
            u0, u1 = -.57 + i * .19 + .006, -.57 + (i + 1) * .19 - .006; v0, v1 = .03 + j * .313 + .006, .03 + (j + 1) * .313 - .006
            q = [(u, y0p + v * math.sin(pa) + .004, z0p - v * math.cos(pa) + .003) for u, v in ((u0, v0), (u1, v0), (u1, v1), (u0, v1))]
            ow(b, q, M['dglass'], nrm)
    b.beam((0, 2.15, .1), (0, 2.25, .3), .03, M['hdg'])
    return b.build('af_met')


# ════════ EMAS（跑道端的阻攔材料鋪面）：40 × 45 m，1.2 m 一格的塊，前緣斜坡、往後加厚，前 6 m 是斜坡、之後 0.6 m 高，頂上的黃色箭頭（指向跑道外）
def emas():
    b = GB(67); L, HW = 40.0, 22.5
    for i in range(int(L / 1.2)):
        x0 = i * 1.2; h = min(.2 + i * .08, .6)
        b.box(x0 + .02, x0 + 1.18, 0, h, -HW, HW, M['conc'])
        b.box(x0, x0 + .02, 0, h - .01, -HW, HW, M['dark'])
    for zc in (-12.0, 0.0, 12.0):   # 箭頭（V 字，尖朝 +x）
        for x0 in (10.0, 20.0, 30.0):
            hy = .615
            for s in (-1, 1):
                q = [(x0, hy + .02, zc), (x0 + 5.0, hy + .02, zc + s * 4.5), (x0 + 3.6, hy + .02, zc + s * 4.5), (x0 - 1.4, hy + .02, zc)]
                ow(b, q, M['yel'], (0, 1, 0))
    return b.build('af_emas')


# ════════ 防吹籬（跑道東端外、定位台後面，擋起飛滑跑前推油門的噴流吹到島東緣的道路）：60 m 長（沿 z）、4.5 m 高，
# 朝西（−x，對著跑道）的十道斜百葉鋼板（霧面灰）往東後傾，H 型鋼柱每 3 m 一支、後面的斜撐、混凝土基座，兩端頂上的紅白障礙標示
def blast():
    b = GB(71); HZ, HT, NL = 30.0, 4.5, 10
    if 'bdef' not in M: M['bdef'] = mat('t34_bdef', '#8b8f90', 0.75, 0.15); M['bdefb'] = mat('t34_bdefb', '#6f7375', 0.8, 0.1)   # 霧面的灰色塗裝鋼板（金屬感太強會整片反射天空變藍）
    b.box(-.4, 3.6, 0, .35, -HZ - .3, HZ + .3, M['conc'])
    for i in range(NL):   # 百葉：每一道是斜的鋼板（前緣低、後緣高），整面往東後傾
        y0 = .45 + i * (HT - .6) / NL; x0 = i * .22
        q = [(x0, y0, -HZ), (x0, y0, HZ), (x0 + .5, y0 + .5, HZ), (x0 + .5, y0 + .5, -HZ)]
        ow(b, q, M['bdef'], (-1, 1, 0)); ow(b, [(a, c - .012, d) for a, c, d in q], M['bdefb'], (1, -1, 0))   # 背面錯開一點，不然 finish 會把正反兩面併成一面
        b.box(x0 + .45, x0 + .55, y0 + .42, y0 + .52, -HZ, HZ, M['bdefb'])
    for z in [-HZ + 3 * k for k in range(21)]:
        b.beam((0, .35, z), (NL * .22 + .3, HT, z), .12, M['dark'], .08)                        # 柱（沿著斜面）
        b.beam((NL * .22 + .3, HT - .2, z), (3.4, .35, z), .07, M['grey'])                       # 後面的斜撐
        b.box(3.2, 3.6, .35, .55, z - .25, z + .25, M['dark'])
    yt = HT - .1; xt = NL * .22 + .1
    for zz in (-HZ, HZ - 3):   # 兩端各 3 m 的紅白障礙標示（頂板＋端柱），中間不畫
        for k in range(3):
            b.box(xt - .04, xt + .02, yt + .2 * k, yt + .2 * (k + 1), zz + .02, zz + 2.98, M['redp'] if k % 2 == 0 else M['white'])
    return b.build('af_blast')


# ════════════════════════ 第二批 ════════════════════════
M['card'] = mat('m2_card', '#9a774c', 0.9, 0.0)


def frange(a, b, d):
    out = []; x = a
    while x <= b + 1e-6: out.append(x); x += d
    return out


def zbox(b, x0, x1, y0, y1, za, zc, m): b.box(x0, x1, y0, y1, min(za, zc), max(za, zc), m)


def dock(b, xc, z, n, w=3.0, h=3.0, y0=1.2, door='door'):
    """卡車碼頭（牆面在 z、n 是朝外的 z 方向）：分段捲門、黑色門封、過橋板的唇板、兩塊橡膠擋塊、門邊的碼頭燈"""
    zbox(b, xc - w / 2, xc + w / 2, y0, y0 + h, z, z + n * .06, M[door])
    for k in range(1, int(h / .5)): zbox(b, xc - w / 2, xc + w / 2, y0 + k * .5 - .015, y0 + k * .5 + .015, z + n * .06, z + n * .08, M['grey'])
    for s in (-1, 1): zbox(b, xc + s * (w / 2 + .22) - .22, xc + s * (w / 2 + .22) + .22, y0 - .2, y0 + h + .4, z, z + n * .7, M['black'])
    zbox(b, xc - w / 2 - .44, xc + w / 2 + .44, y0 + h, y0 + h + .55, z, z + n * .7, M['black'])
    zbox(b, xc - 1.1, xc + 1.1, y0 - .1, y0, z + n * .3, z + n * .45, M['galv'])
    for s in (-1, 1): zbox(b, xc + s * 1.3 - .15, xc + s * 1.3 + .15, y0 - .45, y0 - .05, z + n * .3, z + n * .52, M['rubber'])
    zbox(b, xc + w / 2 + .6, xc + w / 2 + .85, y0 + h - .3, y0 + h, z, z + n * .5, M['grey'])
    zbox(b, xc + w / 2 + .62, xc + w / 2 + .83, y0 + h - .32, y0 + h - .3, z + n * .05, z + n * .48, M['led'])


def trailer(b, xc, zr, m, n=-1):
    """靠在碼頭的半拖車（13.6 m，車尾在 zr、車頭往 n）：廂體、側面立肋、前板、三軸雙胎、支撐腳、側燈、防鑽撞桿"""
    L, w = 13.6, 1.27; zf = zr + n * L
    zbox(b, xc - w, xc + w, 1.25, 4.0, zr, zf, M[m]); zbox(b, xc - w + .1, xc + w - .1, 1.0, 1.25, zr, zf, M['dark'])
    for k in range(1, 12):
        z = zr + n * k * 1.13
        for s in (-1, 1): b.box(xc + s * w - .03, xc + s * w + .03, 1.3, 3.95, z - .04, z + .04, M['grey'])
    zbox(b, xc - w + .05, xc + w - .05, 1.3, 3.95, zf, zf + n * .04, M['grey'])
    zbox(b, xc - w, xc + w, 3.92, 4.02, zr, zf, M['grey'])
    for j in range(3):
        z = zr + n * (1.4 + j * 1.3)
        for s in (-1, 1):
            b.xcyl(xc + s * 1.25 - (.6 if s > 0 else 0), xc + s * 1.25 + (0 if s > 0 else .6), .5, z, .5, 14, M['rubber'])
            b.xcyl(xc + s * 1.25 - (.02 if s < 0 else 0), xc + s * 1.25 + (.02 if s > 0 else 0), .5, z, .28, 12, M['galv'])
    zl = zf - n * 2.4
    for s in (-1, 1):
        b.box(xc + s * .85 - .08, xc + s * .85 + .08, .1, 1.0, zl - .08, zl + .08, M['galv']); b.box(xc + s * .85 - .18, xc + s * .85 + .18, 0, .1, zl - .18, zl + .18, M['dark'])
        for k in range(4):
            z = zr + n * (1.0 + k * 3.6); b.box(xc + s * (w + .02) - .02, xc + s * (w + .02) + .02, 1.08, 1.18, z - .08, z + .08, M['amber'])
    b.tube((xc - .85, .6, zl), (xc + .85, .6, zl), .04, M['galv'], 6)
    zbox(b, xc - 1.1, xc + 1.1, .45, .6, zr + n * .15, zr + n * .3, M['galv'])
    for s in (-1, 1): zbox(b, xc + s * .8 - .05, xc + s * .8 + .05, .6, 1.0, zr + n * .2, zr + n * .3, M['galv'])


def ld3(b, x, z, y0=0.0):
    """LD3 貨櫃：鋁殼、一側斜肩（往 +x）、正面（−z）的帆布門、底框"""
    b.box(x - .78, x + .78, y0 + .06, y0 + 1.63, z - .765, z + .765, M['galv']); b.box(x - .8, x + .8, y0, y0 + .06, z - .78, z + .78, M['dark'])
    b.box(x + .78, x + 1.23, y0 + 1.0, y0 + 1.63, z - .765, z + .765, M['galv'])
    q = [(x + .78, y0 + .55, z - .765), (x + .78, y0 + .55, z + .765), (x + 1.23, y0 + 1.0, z + .765), (x + 1.23, y0 + 1.0, z - .765)]
    ow(b, q, M['galv'], (1, -1, 0))
    b.box(x - .7, x + .7, y0 + .15, y0 + 1.55, z - .785, z - .765, M['curt'] if 'curt' in M else M['dark'])
    for k in range(3): b.box(x - .7, x + .7, y0 + .5 + k * .4, y0 + .53 + k * .4, z - .8, z - .785, M['black'])


def pallet(b, x, z):
    """貨盤（88 吋 × 125 吋的鋁板）：紙箱堆、上面的貨網"""
    b.box(x - 1.59, x + 1.59, 0, .1, z - 1.12, z + 1.12, M['galv'])
    for i, (dx, dz, h) in enumerate(((-.8, -.5, 1.4), (.8, -.5, 1.1), (-.8, .5, 1.25), (.8, .5, 1.5))):
        b.box(x + dx - .72, x + dx + .72, .1, .1 + h, z + dz - .48, z + dz + .48, M['card'])
    for k in range(-3, 4): b.box(x + k * .45 - .02, x + k * .45 + .02, 1.62, 1.64, z - 1.05, z + 1.05, M['black'])
    for k in range(-2, 3): b.box(x - 1.55, x + 1.55, 1.64, 1.66, z + k * .45 - .02, z + k * .45 + .02, M['black'])


def roof_fans(b, x, z, y, n=2, m='dark'):
    """屋頂的冷凝機組：箱體、頂上 n 具風扇（黑色葉輪、鍍鋅護網圈）"""
    b.box(x - .9 * n, x + .9 * n, y, y + 1.2, z - 1.1, z + 1.1, M[m])
    for k in range(n):
        cx = x - .9 * n + .9 + k * 1.8
        b.vcyl(cx, z, y + 1.2, y + 1.28, .72, 16, M['black']); b.vcyl(cx, z, y + 1.28, y + 1.33, .78, 16, M['galv'], cap=False)


# ════════ 貨運站：140 × 50 m 的倉庫（波浪鋼板，14 m 高）。北面（−z，陸側）十二個卡車碼頭與雨遮，靠著六台半拖車；
# 南面（+z，空側）四個貨櫃口（兩個開著，滾輪台伸出來）、9 m 深的雨遮，雨遮下是 LD3 貨櫃與貨盤；東端三層的辦公樓（海關）、
# 西端的冷鏈倉（保溫板、屋頂冷凝機組）、西南角獨立的危險品倉（防溢堤、圍欄、危險標誌）。原點在倉庫中心。
CG_X, CG_Z, CG_H = 70.0, 25.0, 14.0


def cargo():
    b = GB(81); X, Z, H = CG_X, CG_Z, CG_H
    b.box(-X, X, 1.2, H, -Z, Z, M['wave']); b.box(-X - .05, X + .05, 0, 1.2, -Z - .05, Z + .05, M['conc'])
    b.box(-X, X, 0, 1.2, -Z - .35, -Z, M['conc'])                                                # 北面碼頭的牆腳
    for (x0, x1, z0, z1) in ((-X - .05, X + .05, -Z - .05, -Z), (-X - .05, X + .05, Z, Z + .05), (-X - .05, -X, -Z, Z), (X, X + .05, -Z, Z)):
        b.box(x0, x1, 9.0, 9.6, z0, z1, M['blue'])
    zbox(b, -66, 66, 10.4, 12.2, -Z, -Z - .04, M['dglass'])                                       # 北面的高窗
    for x in frange(-66, 66, 3): zbox(b, x - .06, x + .06, 10.4, 12.2, -Z, -Z - .07, M['dark'])
    for i in range(12):
        xc = -55 + i * 10; dock(b, xc, -Z - .35, -1)
        zbox(b, xc - .5, xc + .5, 4.85, 5.45, -Z, -Z - .02, M['dark']); b.text(str(i + 1), .5, (xc, 5.15, -Z - .02), (-1, 0, 0), (0, 0, -1), M['white'], .03)
    b.box(-X + 2, X - 2, 6.2, 6.55, -Z - 6.5, -Z, M['grey']); b.box(-X + 2, X - 2, 5.95, 6.75, -Z - 6.65, -Z - 6.5, M['white'])
    for x in frange(-60, 60, 12): b.tube((x, 6.55, -Z - 6.2), (x, 9.0, -Z), .04, M['galv'], 6)
    for x in frange(-55, 55, 10): b.box(x - 1, x + 1, 6.12, 6.2, -Z - 3.4, -Z - 3.1, M['bay'])
    b.text('GREY HERON CARGO', 1.25, (0, 8.0, -Z), (-1, 0, 0), (0, 0, -1), M['blue'], .12)
    for i, m in ((1, 'trl'), (2, 'grey'), (4, 'trl'), (7, 'blue'), (8, 'trl'), (10, 'grey')): trailer(b, -55 + i * 10, -Z - 1.1, m)
    # 南面（空側）：貨櫃口、滾輪台、雨遮
    for xc, op in ((-45, 0), (-15, 1), (15, 1), (45, 0)):
        zbox(b, xc - 4.8, xc + 4.8, 6.0, 6.4, Z, Z + .15, M['galv'])
        for s in (-1, 1): zbox(b, xc + s * 4.65 - .15, xc + s * 4.65 + .15, 0, 6.0, Z, Z + .15, M['yel'])
        if op:
            zbox(b, xc - 4.5, xc + 4.5, 0, 6.0, Z, Z + .02, M['black'])
            b.box(xc - 1.7, xc + 1.7, 0, .48, Z, Z + 3.2, M['galv'])
            for k in range(13): b.xcyl(xc - 1.65, xc + 1.65, .5, Z + .25 + k * .23, .045, 6, M['grey'])
            for s in (-1, 1): b.box(xc + s * 1.75 - .05, xc + s * 1.75 + .05, .48, .7, Z, Z + 3.2, M['yel'])
        else:
            zbox(b, xc - 4.5, xc + 4.5, 0, 6.0, Z, Z + .06, M['door'])
            for k in range(1, 12): zbox(b, xc - 4.5, xc + 4.5, k * .5 - .015, k * .5 + .015, Z + .06, Z + .08, M['grey'])
    ld3(b, -15, Z + 1.6, .52)
    b.box(-X, X, 9.0, 9.45, Z, Z + 9, M['grey']); b.box(-X, X, 8.8, 9.6, Z + 8.85, Z + 9.0, M['white'])
    for x in frange(-60, 60, 12): b.tube((x, 9.45, Z + 8.6), (x, 13.4, Z), .05, M['galv'], 6)
    for x in frange(-60, 60, 10): b.box(x - 1.2, x + 1.2, 8.92, 9.0, Z + 4.3, Z + 4.7, M['bay'])
    b.text('GREY HERON CARGO', 1.6, (0, 11.6, Z), (1, 0, 0), (0, 0, 1), M['blue'], .12)
    for k in range(6): ld3(b, 48 + k * 2.6, Z + 4.6)
    for k in range(4): ld3(b, 51 + k * 2.6, Z + 6.6)
    for k in range(3): pallet(b, 28 + k * 3.6, Z + 5.5)
    # 屋頂：女兒牆、採光帶、空調箱、檢修口與欄杆
    b.box(-X - .2, X + .2, H, H + .3, -Z - .2, Z + .2, M['grey'])
    for (x0, x1, z0, z1) in ((-X - .2, X + .2, -Z - .2, -Z + .1), (-X - .2, X + .2, Z - .1, Z + .2), (-X - .2, -X + .1, -Z, Z), (X - .1, X + .2, -Z, Z)):
        b.box(x0, x1, H + .3, H + 1.1, z0, z1, M['white'])
    for x in frange(-60, 60, 15):
        b.box(x - 1.0, x + 1.0, H + .3, H + .7, -Z + 4, Z - 4, M['cglass'])
        for s in (-1, 1): b.box(x + s * 1.0 - .06, x + s * 1.0 + .06, H + .3, H + .75, -Z + 4, Z - 4, M['galv'])
    for x in (-37.5, 7.5, 52.5): roof_fans(b, x, -12, H + .3, 3, 'grey')
    b.box(20, 21.2, H + .3, H + .9, 10, 11.2, M['grey']); b.rail([(19.2, H + .3, 9.2), (22, H + .3, 9.2), (22, H + .3, 12), (19.2, H + .3, 12)], 1.1, M['yel'], 1.4)
    # 東端的辦公樓（三層，海關與貨運代理）
    OX0, OX1, OZ0, OZ1 = X, X + 16, -Z, 5.0
    b.box(OX0, OX1, 0, 12.6, OZ0, OZ1, M['white'])
    for f in range(3):
        y = f * 4.2
        zbox(b, OX0 + 1, OX1 - 1, y + 1.1, y + 3.0, OZ0, OZ0 - .04, M['oglass']); zbox(b, OX0 + 1, OX1 - 1, y + 1.1, y + 3.0, OZ1, OZ1 + .04, M['oglass'])
        b.box(OX1, OX1 + .04, y + 1.1, y + 3.0, OZ0 + 1, OZ1 - 1, M['oglass'])
        for x in frange(OX0 + 1, OX1 - 1, 1.5): zbox(b, x - .05, x + .05, y + 1.1, y + 3.0, OZ0, OZ0 - .07, M['dark']); zbox(b, x - .05, x + .05, y + 1.1, y + 3.0, OZ1, OZ1 + .07, M['dark'])
        for z in frange(OZ0 + 1, OZ1 - 1, 1.5): b.box(OX1, OX1 + .07, y + 1.1, y + 3.0, z - .05, z + .05, M['dark'])
        b.box(OX0, OX1 + .1, y + 4.0, y + 4.2, OZ0 - .1, OZ1 + .1, M['grey'])
    b.box(OX0, OX1, 12.6, 13.4, OZ0, OZ1, M['grey']); roof_fans(b, OX0 + 8, OZ0 + 15, 12.6, 2)
    zbox(b, OX0 + 2.8, OX0 + 5.2, 0, 2.6, OZ0, OZ0 - .05, M['dglass']); b.box(OX0 + 2, OX0 + 6, 2.8, 3.0, OZ0 - 2.4, OZ0, M['grey'])
    b.text('CARGO OFFICE  CUSTOMS', .42, (OX0 + 8, 3.55, OZ0), (-1, 0, 0), (0, 0, -1), M['dark'], .03)
    # 西端的冷鏈倉（保溫板、兩個保溫碼頭門、屋頂冷凝機組）
    CX0, CX1, CZ1, CH = -X - 16, -X, 13.0, 10.0
    b.box(CX0, CX1, 0, CH, -Z, CZ1, M['trl'])
    for x in frange(CX0 + 1.2, CX1 - .6, 1.2): zbox(b, x - .025, x + .025, .2, CH, -Z, -Z - .03, M['grey'])
    for z in frange(-Z + 1.2, CZ1 - .6, 1.2): b.box(CX0 - .03, CX0, .2, CH, z - .025, z + .025, M['grey'])
    b.box(CX0, CX1, 0, 1.2, -Z - .35, -Z, M['conc'])
    for xc in (CX0 + 4.5, CX0 + 11.5): dock(b, xc, -Z - .35, -1, 2.8, 2.8, 1.2, 'trl')
    b.box(CX0 - .1, CX1, CH, CH + .3, -Z - .1, CZ1 + .1, M['grey'])
    for k in range(3): roof_fans(b, CX0 + 3.2 + k * 4.8, -2.0, CH + .3, 2)
    for k in range(3): b.tube((CX0 + 3.2 + k * 4.8, CH + .5, -.9), (CX0 + 3.2 + k * 4.8, CH + .5, 6), .07, M['galv'], 8)
    b.text('COLD STORE', .9, (CX0 + 8, 7.6, -Z), (-1, 0, 0), (0, 0, -1), M['blue'], .08)
    b.text('LIVE ANIMALS', .38, (CX0 + 11.5, 5.15, -Z), (-1, 0, 0), (0, 0, -1), M['dark'], .03)
    # 危險品倉（西南角）：防溢堤、白色鋼板屋、橘色門、危險標誌、圍欄
    DX0, DX1, DZ0, DZ1 = -X - 14, -X - 5, Z - 6, Z + 3
    b.box(DX0 - 1.2, DX1 + 1.2, 0, .25, DZ0 - 1.2, DZ1 + 1.2, M['conc'])
    for (x0, x1, z0, z1) in ((DX0 - 1.2, DX1 + 1.2, DZ0 - 1.2, DZ0 - 1.0), (DX0 - 1.2, DX1 + 1.2, DZ1 + 1.0, DZ1 + 1.2), (DX0 - 1.2, DX0 - 1.0, DZ0 - 1.2, DZ1 + 1.2), (DX1 + 1.0, DX1 + 1.2, DZ0 - 1.2, DZ1 + 1.2)):
        b.box(x0, x1, .25, .3, z0, z1, M['yel'])
    b.box(DX0, DX1, .25, 4.2, DZ0, DZ1, M['white']); b.box(DX0 - .15, DX1 + .15, 4.2, 4.4, DZ0 - .15, DZ1 + .15, M['grey'])
    cx = (DX0 + DX1) / 2
    zbox(b, cx - 1.2, cx + 1.2, .25, 2.6, DZ1, DZ1 + .05, M['orange'])
    for dx, m in ((-2.7, 'redp'), (2.7, 'yel')):
        q = [(cx + dx, 2.05, DZ1 + .03), (cx + dx + .45, 1.6, DZ1 + .03), (cx + dx, 1.15, DZ1 + .03), (cx + dx - .45, 1.6, DZ1 + .03)]
        ow(b, q, M[m], (0, 0, 1))
    b.text('DANGEROUS GOODS', .42, (cx, 3.4, DZ1), (1, 0, 0), (0, 0, 1), M['redp'], .03)
    for z in (DZ0 + 2, DZ1 - 2):
        for k in range(5): b.box(DX0 - .06, DX0, 2.6 + k * .18, 2.66 + k * .18, z - .6, z + .6, M['grey'])
    g = 2.2; b.rail([(cx - 2, 0, DZ1 + g), (DX0 - g, 0, DZ1 + g), (DX0 - g, 0, DZ0 - g), (DX1 + g, 0, DZ0 - g), (DX1 + g, 0, DZ1 + g), (cx + 2, 0, DZ1 + g)], 1.8, M['galv'], 2.0)
    return b.build('af_cargo')


# ════════ 試車坪（引擎試車的消音圍牆）：80 × 72 m，西、北、南三面 11 m 的吸音牆（裡面是穿孔吸音板，外面每 6 m 一支鋼柱加斜撐），
# 開口朝東（接 T1 機坪）。後牆底下是把噴流往上翻的斜導流板；牆頂朝內的投光燈；地上的繫留環；南牆外的控制亭。原點在坪中心。
RU_X, RU_Z, RU_H = 40.0, 36.0, 11.0


def runup():
    b = GB(83); X, Z, H, T = RU_X, RU_Z, RU_H, .6; XE = X - 6
    for x0, x1, z0, z1 in ((-X, -X + T, -Z, Z), (-X, XE, -Z, -Z + T), (-X, XE, Z - T, Z)):
        b.box(x0, x1, 0, H, z0, z1, M['clad']); b.box(x0 - .1, x1 + .1, H, H + .25, z0 - .1, z1 + .1, M['galv'])
    # 內面的吸音板：3 m 一片的板縫、0.5 m 一道穿孔帶
    b.box(-X + T, -X + T + .12, .3, H - .3, -Z + T, Z - T, M['grey'])
    b.box(-X + T, XE, .3, H - .3, -Z + T, -Z + T + .12, M['grey']); b.box(-X + T, XE, .3, H - .3, Z - T - .12, Z - T, M['grey'])
    for z in frange(-Z + T + 3, Z - T - 1, 3): b.box(-X + T + .12, -X + T + .14, .3, H - .3, z - .03, z + .03, M['dark'])
    for x in frange(-X + T + 3, XE - 1, 3):
        b.box(x - .03, x + .03, .3, H - .3, -Z + T + .12, -Z + T + .14, M['dark']); b.box(x - .03, x + .03, .3, H - .3, Z - T - .14, Z - T - .12, M['dark'])
    for y in frange(.8, H - .8, .5):
        b.box(-X + T + .12, -X + T + .13, y, y + .06, -Z + T, Z - T, M['dark'])
        b.box(-X + T, XE, y, y + .06, -Z + T + .12, -Z + T + .13, M['dark']); b.box(-X + T, XE, y, y + .06, Z - T - .13, Z - T - .12, M['dark'])
    b.box(-X + T, XE, 0, .3, -Z + T, -Z + T + .3, M['conc']); b.box(-X + T, XE, 0, .3, Z - T - .3, Z - T, M['conc']); b.box(-X + T, -X + T + .3, 0, .3, -Z + T, Z - T, M['conc'])
    # 外面的鋼柱與斜撐（每 6 m，基礎墩）
    for z in frange(-Z, Z, 6):
        b.box(-X - .5, -X, 0, H + .2, z - .25, z + .25, M['dark']); b.beam((-X - .3, H - 1.5, z), (-X - 6, .25, z), .16, M['dark'], .1)
        b.box(-X - 6.6, -X - 5.4, 0, .3, z - .6, z + .6, M['conc'])
    for x in frange(-X, XE, 6):
        for n in (-1, 1):
            zbox(b, x - .25, x + .25, 0, H + .2, n * Z, n * (Z + .5), M['dark']); b.beam((x, H - 1.5, n * (Z + .3)), (x, .25, n * (Z + 6)), .16, M['dark'], .1)
            zbox(b, x - .6, x + .6, 0, .3, n * (Z + 5.4), n * (Z + 6.6), M['conc'])
    # 東端的收頭：牆端鋼柱、黃黑警示
    for z0, z1 in ((-Z, -Z + T), (Z - T, Z)):
        b.box(XE, XE + .4, 0, H + .2, z0 - .1, z1 + .1, M['dark'])
        for k in range(8): b.box(XE + .4, XE + .42, k * .4, k * .4 + .4, z0, z1, M['yel'] if k % 2 == 0 else M['black'])
    # 後牆底的導流板
    q = [(-X + T + 3.5, .08, -Z + T + .3), (-X + T + 3.5, .08, Z - T - .3), (-X + T + .15, 4.0, Z - T - .3), (-X + T + .15, 4.0, -Z + T + .3)]
    ow(b, q, M['galv'], (1, 1, 0))
    for z in frange(-30, 30, 6): b.beam((-X + T + 3.3, .1, z), (-X + T + .25, 3.9, z), .08, M['dark'])
    # 牆頂朝內的投光燈
    for x, z in [(-X + T + .5, z) for z in (-20, 0, 20)] + [(x, -Z + T + .5) for x in (-25, -5, 15)] + [(x, Z - T - .5) for x in (-25, -5, 15)]:
        b.box(x - .45, x + .45, H + .25, H + .85, z - .45, z + .45, M['dark']); b.box(x - .38, x + .38, H + .2, H + .25, z - .38, z + .38, M['bay'])
    for x in (-24, -12, 0, 12):
        for z in (-12, 0, 12): b.vcyl(x, z, 0, .1, .18, 10, M['galv'])
    zbox(b, -20, 4, 9.8, 11.0, -Z - .55, -Z - .65, M['blue']); b.text('ENGINE RUN-UP AREA', .85, (-8, 10.4, -Z - .65), (-1, 0, 0), (0, 0, -1), M['white'], .05)
    shelter(b, XE + 1.0, XE + 6.0, Z + 1.0, Z + 4.5, 2.8, 's')
    b.box(XE + 6.0, XE + 6.03, 1.2, 2.2, Z + 1.8, Z + 3.7, M['cglass'])
    return b.build('af_runup')


# ════════ 空廚大樓：56 × 32 m、兩層（9.6 m），白色保溫板與藍帶。南面（空側）五個高台碼頭與雨遮（空廚車倒進來），
# 北面（陸側）兩層帶狀窗、員工入口；屋頂一排冷凝機組、廚房排煙管與空調箱；東側的垃圾壓縮機與子母車。原點在建築中心。
CT_X, CT_Z, CT_H = 28.0, 16.0, 9.6


def cater():
    b = GB(85); X, Z, H = CT_X, CT_Z, CT_H
    b.box(-X, X, .6, H, -Z, Z, M['white']); b.box(-X - .05, X + .05, 0, .6, -Z - .05, Z + .05, M['grey'])
    for (x0, x1, z0, z1) in ((-X - .05, X + .05, -Z - .05, -Z), (-X - .05, X + .05, Z, Z + .05), (-X - .05, -X, -Z, Z), (X, X + .05, -Z, Z)):
        b.box(x0, x1, 4.4, 5.0, z0, z1, M['blue'])
    for y in (1.3, 5.9):
        zbox(b, -26, 12, y, y + 1.9, -Z, -Z - .04, M['oglass'])
        for x in frange(-26, 12, 1.5): zbox(b, x - .05, x + .05, y, y + 1.9, -Z, -Z - .07, M['dark'])
    zbox(b, 16.6, 19.4, 0, 2.6, -Z, -Z - .05, M['dglass']); b.box(15.8, 20.2, 2.8, 3.0, -Z - 2.4, -Z, M['grey'])
    for x in (16.0, 20.0): b.vcyl(x, -Z - 2.2, 0, 2.8, .06, 8, M['galv'])
    b.text('STAFF', .4, (18, 3.45, -Z), (-1, 0, 0), (0, 0, -1), M['dark'], .03)
    b.text('SKY KITCHEN', 1.0, (-7, 8.6, -Z), (-1, 0, 0), (0, 0, -1), M['blue'], .08)
    b.box(-X, X, 0, 1.2, Z, Z + .35, M['conc'])
    for xc in (-20, -10, 0, 10, 20):
        dock(b, xc, Z + .35, 1, 3.0, 3.2)
        zbox(b, xc - .45, xc + .45, 5.0, 5.4, Z, Z + .02, M['dark']); b.text(str((xc + 20) // 10 + 1), .35, (xc, 5.2, Z + .02), (1, 0, 0), (0, 0, 1), M['white'], .02)
    b.box(-X, X, 5.6, 5.95, Z, Z + 6, M['grey']); b.box(-X, X, 5.4, 6.1, Z + 5.85, Z + 6.0, M['white'])
    for x in frange(-24, 24, 8): b.tube((x, 5.95, Z + 5.7), (x, 8.6, Z), .04, M['galv'], 6)
    for x in frange(-20, 20, 10): b.box(x - 1, x + 1, 5.52, 5.6, Z + 2.8, Z + 3.1, M['bay'])
    b.text('SKY KITCHEN', 1.3, (0, 7.6, Z), (1, 0, 0), (0, 0, 1), M['blue'], .1)
    b.box(-X, X, H, H + .2, -Z, Z, M['grey'])
    for (x0, x1, z0, z1) in ((-X, X, -Z, -Z + .25), (-X, X, Z - .25, Z), (-X, -X + .25, -Z, Z), (X - .25, X, -Z, Z)): b.box(x0, x1, H + .2, H + 1.0, z0, z1, M['white'])
    for k in range(6): roof_fans(b, -22 + k * 4.4, 5.5, H + .2, 2)
    for x in (-10, -4, 2, 8): b.vcyl(x, -6, H + .2, H + 3.2, .35, 12, M['galv']); b.vcyl(x, -6, H + 3.25, H + 3.55, .62, 12, M['galv'], .15)
    b.box(14, 22, H + .2, H + 2.4, -11, -3, M['grey']); b.vcyl(18, -7, H + 2.4, H + 2.5, 1.2, 18, M['black'])
    b.box(X + .5, X + 5.5, 0, 2.6, -8, -2, M['green']); b.box(X + .5, X + 2.0, 2.6, 3.2, -7.5, -2.5, M['dark']); b.box(X + .4, X + 5.6, 0, .25, -8.2, -1.8, M['dark'])
    b.box(X + 1, X + 4, 0, 1.5, 2, 6.5, M['blue']); b.box(X + .9, X + 4.1, 1.5, 1.6, 1.9, 6.6, M['dark'])
    return b.build('af_cater')


# ════════ 地勤車基地：北側的維修廠（44 × 20 m，波浪鋼板，三道捲門其中一道開著、東端辦公室），
# 前面是加油島（雨遮、加油機）、四支電動地勤車的充電柱、洗車棚（刷子門架、截水溝）；南邊的停車格在 21-air.js 畫。原點在場地中心。
def gseb():
    b = GB(87); WX0, WX1, WZ0, WZ1, WH = -22.0, 22.0, -35.0, -15.0, 8.0
    b.box(WX0, WX1, 1.0, WH, WZ0, WZ1, M['wave']); b.box(WX0 - .05, WX1 + .05, 0, 1.0, WZ0 - .05, WZ1 + .05, M['conc'])
    b.box(WX0 - .4, WX1 + .4, WH, WH + .3, WZ0 - .4, WZ1 + .4, M['grey']); b.box(-18, 6, WH + .3, WH + .6, -27, -23, M['cglass'])
    for x in (-14, -2, 10): b.vcyl(x, -31, WH + .3, WH + 1.0, .3, 10, M['galv']); b.vcyl(x, -31, WH + 1.0, WH + 1.2, .45, 10, M['galv'], .1)
    for xc, op in ((-15.0, 0), (-6.0, 1), (3.0, 0)):
        zbox(b, xc - 3.0, xc + 3.0, 5.0, 5.3, WZ1, WZ1 + .12, M['galv'])
        if op:
            zbox(b, xc - 2.75, xc + 2.75, 0, 5.0, WZ1, WZ1 + .02, M['black']); zbox(b, xc - 2.9, xc + 2.9, 5.0, 5.6, WZ1 - .1, WZ1 + .5, M['grey'])
        else:
            zbox(b, xc - 2.75, xc + 2.75, 0, 5.0, WZ1, WZ1 + .06, M['door'])
            for k in range(1, 10): zbox(b, xc - 2.75, xc + 2.75, k * .5 - .015, k * .5 + .015, WZ1 + .06, WZ1 + .08, M['grey'])
        for s in (-1, 1): b.vcyl(xc + s * 3.2, WZ1 + .6, 0, 1.2, .12, 10, M['yel'])
    for y in (1.2, 4.6):
        zbox(b, 9.5, 21, y, y + 1.6, WZ1, WZ1 + .04, M['oglass'])
        for x in frange(9.5, 21, 1.5): zbox(b, x - .05, x + .05, y, y + 1.6, WZ1, WZ1 + .07, M['dark'])
    zbox(b, 7.4, 8.8, 0, 2.3, WZ1, WZ1 + .05, M['dglass'])
    b.text('GSE MAINTENANCE', .9, (-6, 6.6, WZ1), (1, 0, 0), (0, 0, 1), M['dark'], .05)
    # 加油島（雨遮下）
    b.box(-19, -11, 0, .25, -8.8, -7.2, M['conc']); b.box(-16.4, -13.6, .25, 2.2, -8.5, -7.5, M['white'])
    for zf in (-8.52, -7.48): zbox(b, -16.0, -14.0, 1.3, 1.9, zf, zf + (-.02 if zf < -8 else .02), M['dark'])
    b.tube((-13.6, 1.6, -8.0), (-12.6, .6, -8.0), .03, M['black'], 6)
    for x in (-19.3, -10.7): b.vcyl(x, -8.0, 0, 1.0, .14, 10, M['yel'])
    for x in (-18.5, -11.5): b.box(x - .12, x + .12, .25, 4.6, -8.1, -7.9, M['galv'])
    b.box(-20, -10, 4.6, 4.9, -11, -5, M['grey']); b.box(-20, -10, 4.5, 4.6, -11, -10.8, M['redp']); b.box(-18, -12, 4.55, 4.6, -8.3, -7.7, M['bay'])
    # 充電柱
    for k in range(4):
        x = -4 + k * 3.0; b.box(x - .22, x + .22, 0, 1.6, -11.6, -11.3, M['green']); b.box(x - .16, x + .16, 1.05, 1.4, -11.62, -11.6, M['dark'])
        b.tube((x + .22, 1.2, -11.45), (x + .45, .3, -11.2), .025, M['black'], 6)
    # 洗車棚
    for x in (8.3, 19.7):
        for z in (-11.7, 1.7): b.box(x - .15, x + .15, 0, 5.5, z - .15, z + .15, M['galv'])
    b.box(8, 20, 5.5, 5.8, -12, 2, M['grey']); b.box(8, 20, 5.3, 5.95, 1.95, 2.08, M['white'])
    b.text('WASH BAY', .45, (14, 5.62, 2.08), (1, 0, 0), (0, 0, 1), M['dark'], .03)
    b.box(9, 19, .066, .09, -5.3, -4.7, M['dark'])
    for x in (10.6, 17.4): b.box(x - .12, x + .12, 0, 4.3, -5.12, -4.88, M['galv']); b.vcyl(x + (.7 if x < 14 else -.7), -5.0, .3, 3.9, .45, 14, M['blue'])
    b.box(10.4, 17.6, 4.1, 4.4, -5.2, -4.8, M['galv'])
    return b.build('af_gseb')



# ════════ 鋁梯與機坪告示牌（第三批，2026-11-04；52-air-gse.js、52-air-fac.js 擺）
M['alu'] = mat('t22_alu', '#c4c8cc', 0.35, 0.8)
M['sblue'] = mat('t34_sblue', '#1d4f9a', 0.4, 0.0)


def ladder():
    """機務用的移動式平台梯（引擎、機翼前緣檢修）：鋁合金，原點在底座後端中心，梯級往 +x 升到 2.0 m 的平台；四個萬向輪、
    兩側扶手接到平台的護欄、平台前緣的踢腳板、黃黑警示帶。長 2.1、寬 0.9、扶手頂 3.0 m"""
    b = GB(91); A, Y0, YP, X1 = M['alu'], .22, 2.0, 1.35
    for zs in (-.42, .42):
        b.box(0, 2.1, Y0 - .06, Y0, zs - .03, zs + .03, A)                                   # 底座的兩根縱樑
        b.beam((.08, Y0, zs), (X1, YP, zs), .04, A, .025)                                      # 梯的側樑
        for x in (X1 + .05, 2.05): b.box(x - .025, x + .025, Y0, YP, zs - .025, zs + .025, A)  # 平台下的立柱
        b.beam((X1 + .05, Y0 + .1, zs), (2.05, YP - .1, zs), .015, A)                          # 斜撐
        b.tube((0.0, Y0 + .95, zs), (X1 - .05, YP + .95, zs), .022, A, 8)                     # 扶手
        b.tube((X1 - .05, YP + .95, zs), (2.08, YP + .95, zs), .022, A, 8)
        b.tube((X1 + .4, YP, zs), (X1 + .4, YP + .95, zs), .02, A, 6); b.tube((2.08, YP, zs), (2.08, YP + .95, zs), .02, A, 6)
        b.tube((0.0, Y0, zs), (0.0, Y0 + .95, zs), .02, A, 6)
        for x in (.05, 2.05): b.vcyl(x, zs, .05, Y0 - .06, .02, 6, M['galv']); b.xcyl(x - .06, x + .06, .07, zs, .07, 10, M['black'])
    for zs in (-.42, .42): b.tube((X1 + .4, YP + .5, zs), (2.08, YP + .5, zs), .016, A, 6)
    b.tube((2.08, YP + .95, -.42), (2.08, YP + .95, .42), .02, A, 6)
    for x in (.05, 2.05): b.box(x - .02, x + .02, Y0 - .06, Y0, -.42, .42, A)
    n = 7
    for i in range(n):   # 梯級：防滑鋁踏板（三條凸紋）
        t = (i + .5) / n; x = .08 + (X1 - .08) * t; y = Y0 + (YP - Y0) * t
        b.box(x - .11, x + .11, y - .025, y, -.4, .4, A)
        for dx in (-.06, 0, .06): b.box(x + dx - .008, x + dx + .008, y, y + .006, -.38, .38, M['galv'])
    b.box(X1, 2.1, YP - .04, YP, -.44, .44, A)                                                # 平台
    for z in frange(-.38, .38, .08): b.box(X1 + .02, 2.08, YP, YP + .005, z - .008, z + .008, M['galv'])
    b.box(2.08, 2.11, YP, YP + .15, -.44, .44, M['yel'])                                      # 踢腳板
    for k in range(5): b.box(.4 + k * .3, .55 + k * .3, Y0 - .05, Y0 - .01, .45, .452, M['yel'] if k % 2 == 0 else M['black'])
    return b.build('af_ladder')


def stepl():
    """A 字鋁梯（6 階、1.8 m）：前腳有梯級、後腳兩根加橫撐，頂蓋、兩側的開腳拉桿；原點在兩腳之間的地面中心，前腳朝 −x"""
    b = GB(93); A = M['alu']; H = 1.8
    for zs in (-.24, .24):
        b.beam((-.52, 0, zs), (-.05, H, zs * .85), .03, A, .018); b.beam((.5, 0, zs), (.05, H, zs * .85), .025, A, .015)
        b.box(-.56, -.48, 0, .03, zs - .03, zs + .03, M['black']); b.box(.46, .54, 0, .03, zs - .03, zs + .03, M['black'])
        b.tube((-.3, .85, zs), (.3, .85, zs), .008, M['galv'], 5)
    for i in range(1, 6):
        t = i / 6; x = -.52 + .47 * t; y = H * t; w = .24 - .04 * t
        b.box(x - .06, x + .06, y - .025, y, -w, w, A)
    for t in (.3, .65): b.tube((.5 - .45 * t, H * t, -.22), (.5 - .45 * t, H * t, .22), .012, A, 6)
    b.box(-.12, .12, H, H + .06, -.24, .24, M['redp'])
    return b.build('af_stepl')


def apron_sign(name, w, h, face):
    """機坪告示牌：兩支鍍鋅方管、混凝土基座、鋁板（背面灰）；face(b, cx, cy, z) 在正面（+z）畫內容。原點在兩柱中間的地面"""
    b = GB(95); y0 = 2.1 - h; z = 0.0
    for x in (-w / 2 + .12, w / 2 - .12):
        b.box(x - .03, x + .03, 0, 2.15, -.06, -.0, M['galv']); b.box(x - .14, x + .14, 0, .08, -.14, .08, M['conc'])
    b.box(-w / 2, w / 2, y0, 2.1, .0, .02, M['grey'])
    b.box(-w / 2 + .01, w / 2 - .01, y0 + .01, 2.09, .02, .025, M['white'])
    face(b, 0, y0 + h / 2, .025)
    return b.build(name)


def disc(b, cx, cy, z, r0, r1, m, n=40, a0=0.0, a1=2 * math.pi):
    for i in range(n):
        p0 = a0 + (a1 - a0) * i / n; p1 = a0 + (a1 - a0) * (i + 1) / n
        q = [(cx + r0 * math.cos(p0), cy + r0 * math.sin(p0), z), (cx + r0 * math.cos(p1), cy + r0 * math.sin(p1), z), (cx + r1 * math.cos(p1), cy + r1 * math.sin(p1), z), (cx + r1 * math.cos(p0), cy + r1 * math.sin(p0), z)]
        ow(b, q, m, (0, 0, 1))


def rect(b, x0, x1, y0, y1, z, m, d=.004): b.box(x0, x1, y0, y1, z, z + d, m)


def sgn_nosmoke():
    def f(b, cx, cy, z):
        ox = cx - .4
        disc(b, ox, cy + .02, z + .003, .26, .32, M['redp'])
        b.box(ox - .22, ox + .16, cy - .02, cy + .04, z + .002, z + .006, M['dark']); b.box(ox + .16, ox + .22, cy - .02, cy + .04, z + .002, z + .006, M['orange'])
        q = [(ox - .22, cy + .02 - .2, z + .008), (ox - .18, cy + .02 - .24, z + .008), (ox + .22, cy + .02 + .2, z + .008), (ox + .18, cy + .02 + .24, z + .008)]
        ow(b, q, M['redp'], (0, 0, 1))
        b.text('NO', .2, (cx + .34, cy + .13, z), (1, 0, 0), (0, 0, 1), M['redp'], .01); b.text('SMOKING', .135, (cx + .34, cy - .1, z), (1, 0, 0), (0, 0, 1), M['redp'], .01)
    return apron_sign('af_sgn_nosmoke', 1.5, .8, f)


def sgn_speed():
    def f(b, cx, cy, z):
        disc(b, cx, cy + .12, z + .003, .27, .34, M['redp'])
        b.text('25', .3, (cx, cy + .12, z), (1, 0, 0), (0, 0, 1), M['dark'], .01)
        b.text('km/h  AIRSIDE', .11, (cx, cy - .34, z), (1, 0, 0), (0, 0, 1), M['dark'], .008)
    return apron_sign('af_sgn_speed', .9, 1.0, f)


def sgn_blast():
    def f(b, cx, cy, z):
        rect(b, cx - .78, cx + .78, cy - .48, cy + .48, z, M['yel'])
        rect(b, cx - .72, cx + .72, cy + .14, cy + .42, z + .004, M['redp'])
        b.text('DANGER', .22, (cx, cy + .28, z + .004), (1, 0, 0), (0, 0, 1), M['white'], .008)
        b.text('JET BLAST', .2, (cx + .14, cy - .03, z + .004), (1, 0, 0), (0, 0, 1), M['black'], .008)
        b.text('KEEP CLEAR OF RUN-UP AREA', .075, (cx, cy - .32, z + .004), (1, 0, 0), (0, 0, 1), M['black'], .006)
        q = [(cx - .66, cy - .2, z + .006), (cx - .38, cy - .2, z + .006), (cx - .52, cy + .06, z + .006)]
        ow(b, q, M['black'], (0, 0, 1))
        q = [(cx - .61, cy - .17, z + .008), (cx - .43, cy - .17, z + .008), (cx - .52, cy + .0, z + .008)]
        ow(b, q, M['yel'], (0, 0, 1))
        for k in range(10): rect(b, cx - .78 + k * .156, cx - .78 + k * .156 + .078, cy - .48, cy - .43, z + .004, M['black'])
    return apron_sign('af_sgn_blast', 1.7, 1.06, f)


def sgn_airside():
    def f(b, cx, cy, z):
        rect(b, cx - .73, cx + .73, cy - .38, cy + .38, z, M['sblue'])
        b.text('AIRSIDE', .26, (cx, cy + .14, z + .004), (1, 0, 0), (0, 0, 1), M['white'], .008)
        b.text('AUTHORISED PERSONNEL ONLY', .085, (cx, cy - .1, z + .004), (1, 0, 0), (0, 0, 1), M['white'], .006)
        b.text('ID MUST BE DISPLAYED', .07, (cx, cy - .26, z + .004), (1, 0, 0), (0, 0, 1), M['white'], .006)
    return apron_sign('af_sgn_airside', 1.56, .86, f)


def sgn_hivis():
    def f(b, cx, cy, z):
        cx = cx - .08
        disc(b, cx - .42, cy, z + .003, 0, .26, M['sblue'])
        q = [(cx - .55, cy - .15, z + .007), (cx - .29, cy - .15, z + .007), (cx - .29, cy + .1, z + .007), (cx - .36, cy + .16, z + .007), (cx - .48, cy + .16, z + .007), (cx - .55, cy + .1, z + .007)]
        ow(b, q, M['white'], (0, 0, 1))
        rect(b, cx - .55, cx - .29, cy - .04, cy - .01, z + .009, M['sblue'])
        b.text('HI-VIS', .16, (cx + .22, cy + .1, z), (1, 0, 0), (0, 0, 1), M['sblue'], .008)
        b.text('MUST BE WORN', .085, (cx + .22, cy - .12, z), (1, 0, 0), (0, 0, 1), M['sblue'], .006)
    return apron_sign('af_sgn_hivis', 1.6, .7, f)

objs = [(fire, 4.0, 120, 3.0), (fuel, 4.0, 200, 4.0), (asr, 2.0, 40, 2.0), (loc, 1.0, 70, 1.5), (gs, 1.0, 30, 1.5), (met, 1.0, 20, 1.0), (emas, 4.0, 70, 1.0), (blast, 2.0, 70, 1.5),
        (cargo, 4.0, 220, 4.0), (runup, 3.0, 110, 3.0), (cater, 2.0, 80, 2.0), (gseb, 2.0, 80, 2.0),
        (ladder, 1.0, 6, .6), (stepl, 1.0, 4, .5), (sgn_nosmoke, 1.0, 4, .4), (sgn_speed, 1.0, 4, .4), (sgn_blast, 1.0, 4, .4), (sgn_airside, 1.0, 4, .4), (sgn_hivis, 1.0, 4, .4)]
built = []
for i, (f, step, g, d) in enumerate(objs):
    o = f(); o.location = (i * 300, 0, 0); finish(o, step); built.append((o, g, d))
for o, g, d in built:
    for p, _, _ in built: p.hide_render = p is not o
    bake_ao(o, g, d)
for o, _, _ in built: o.hide_render = False; o.location = (0, 0, 0)
export_glb('airfac.glb', export_vertex_color='ACTIVE')
