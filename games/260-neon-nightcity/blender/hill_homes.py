# 霓虹夜城（260）山坡別墅區：外緣山坡上沿山路蓋的別墅與植栽（10-city.js 開路、挖平台、擺位置，50-assets.js 照型號 instancing）
# 執行：/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P blender/hill_homes.py
# 慣例：1 單位 = 1 公尺；正面（入口、車道）朝 +Y（匯出後是遊戲的 −z，10-city.js 讓 −z 朝路），原點在平台面（z = 0）、核心佔地的 x 中心。
# hm1、hm2、hm4 往 −Y（遊戲的 +z，離路那一側）懸挑平台、泳池與鋼構，支柱往下伸到 z = −22（埋進坡裡的看不到）：10-city.js 只把它們擺在路的下坡側。
# 材質名稱帶遊戲的材質代號：tNN_ 是 07-kitx.js 的程式材質（51 石柱峰的石灰岩、43 板模清水混凝土、44 直向木格柵、45 洞石、46 層疊板岩、47 泳池水、48 別墅落地玻璃、
# 49 簷下天花（崁燈）、20 灰泥、23 木平台、28 石材、34 烤漆鋼、37 筒瓦），mNN_ 是通用材質（1 玻璃、2 霧面、10 光滑漆面、16 白天暗入夜亮的燈）；顏色是頂點色的底色。
# 每型另有遠景低模 NAME_lo：只留量體、樓板、玻璃與水面，整棟縮 1%（底面不動）藏在細模裡；遊戲裡低模全畫、細模只畫相機附近的。
# 參照：使用者提供的好萊塢山一帶山坡豪宅概念圖（懸挑樓板與無邊際泳池、板模混凝土＋木格柵＋洞石、層疊板岩柱、鋼構斜撐、地中海莊園）。
import math, os, random, sys
import bmesh
from mathutils import Vector
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *

reset()
M = {
    'board': mat('t43_board', '#b9b5ab', 0.85, 0.0), 'board_d': mat('t43_board_dark', '#8f8b82', 0.85, 0.0),
    'slat': mat('t44_slat', '#8e5c38', 0.6, 0.0), 'slat_d': mat('t44_slat_dark', '#4e3322', 0.6, 0.0),
    'trav': mat('t45_trav', '#dccfb6', 0.5, 0.0), 'ledge': mat('t46_ledge', '#a08e74', 0.9, 0.0),
    'water': mat('t47_water', '#2fb2c6', 0.05, 0.0), 'vglass': mat('t48_vglass', '#ffffff', 0.05, 0.0),
    'white': mat('t20_white', '#e2ded6', 0.9, 0.0), 'soffit': mat('t49_soffit', '#e6e2da', 0.9, 0.0), 'stucco': mat('t20_stucco', '#e6d8bc', 0.9, 0.0), 'terra': mat('t20_terra', '#a85a34', 0.9, 0.0),
    'deck': mat('t23_deck', '#7a5638', 0.7, 0.0), 'tile': mat('t37_tile', '#b2603a', 0.7, 0.0),
    'steel': mat('t34_steel', '#1d1e21', 0.5, 0.3), 'frame': mat('m10_frame', '#1b1c1f', 0.4, 0.0), 'fascia': mat('m10_fascia', '#26272a', 0.4, 0.0),
    'rail': mat('m1_rail', '#9fb6bd', 0.05, 0.0), 'iron': mat('m10_iron', '#202124', 0.5, 0.0),
    'light': mat('m16_light', '#ffd7a0', 0.1, 0.0), 'fire': mat('m16_fire', '#ff8a3a', 0.1, 0.0),
    'cushion': mat('m2_cushion', '#ece7dd', 0.9, 0.0), 'fabric': mat('m2_fabric', '#e9e1d2', 0.9, 0.0), 'teak': mat('m2_teak', '#6a4a30', 0.8, 0.0),
    'gdoor': mat('m10_gdoor', '#c6ced0', 0.3, 0.0),
    'agave': mat('m2_agave', '#6f8f80', 0.8, 0.0), 'frond': mat('m2_frond', '#41602a', 0.85, 0.0), 'trunk': mat('t28_trunk', '#6e6152', 0.9, 0.0),
    'fir': mat('m2_fir', '#223319', 0.95, 0.0), 'karst': mat('t51_karst', '#8e8a80', 0.95, 0.0), 'maple': mat('m2_maple', '#a3401b', 0.9, 0.0), 'maple_d': mat('m2_maple_d', '#7a1d12', 0.9, 0.0), 'maple_o': mat('m2_maple_o', '#c26a1e', 0.9, 0.0),
    'shrub': mat('m2_shrub', '#3c5528', 0.95, 0.0), 'bloom': mat('m2_bloom', '#b0306e', 0.9, 0.0), 'rock': mat('t28_rock', '#a49884', 0.9, 0.0),
}
LO = False   # True 時建遠景低模（各函式略過細部）


def B(mb, x0, x1, y0, y1, z0, z1, m):
    if x1 - x0 > 1e-4 and y1 - y0 > 1e-4 and z1 - z0 > 1e-4: mb.box(x0, x1, y0, y1, z0, z1, m)


def beam(mb, a, b, h, m):   # 兩點之間的方鋼（截面 2h × 2h）
    a, b = Vector(a), Vector(b); d = (b - a).normalized()
    up = Vector((0, 0, 1)) if abs(d.z) < 0.95 else Vector((1, 0, 0))
    s1 = d.cross(up).normalized() * h; s2 = s1.cross(d).normalized() * h
    v = [p + i * s1 + j * s2 for p in (a, b) for i, j in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
    mb.add(v, [(0, 1, 2, 3), (7, 6, 5, 4), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)], m)


def glass(mb, ax, c, a0, a1, z0, z1, out, pitch=1.6, frame=None):
    """落地玻璃牆：ax='x' 時牆在 y = c、沿 x 從 a0 到 a1；ax='y' 時牆在 x = c、沿 y。out 是外側（±1）。黑色細框直料、上下框。"""
    f = frame or M['frame']
    def bx(u0, u1, o0, o1, w0, w1, m):
        p, q = (c + o0, c + o1) if out > 0 else (c - o1, c - o0)
        if ax == 'x': B(mb, u0, u1, p, q, w0, w1, m)
        else: B(mb, p, q, u0, u1, w0, w1, m)
    bx(a0, a1, -0.03, 0.03, z0, z1, M['vglass'])
    if LO: return
    n = max(1, round((a1 - a0) / pitch)); p = (a1 - a0) / n
    for i in range(n + 1): bx(a0 + i * p - 0.035, a0 + i * p + 0.035, 0, 0.1, z0, z1, f)
    bx(a0 - 0.035, a1 + 0.035, 0, 0.1, z0, z0 + 0.07, f); bx(a0 - 0.035, a1 + 0.035, 0, 0.1, z1 - 0.07, z1, f)


def rail(mb, x0, y0, x1, y1, z, h=1.05):   # 無框玻璃欄杆＋不鏽鋼扶手（沿 x 或沿 y 的線段）；細模的玻璃放進透明的 GB
    if LO: return
    t = 0.025; g, gm = (GB, M['clear']) if GB else (mb, M['rail'])
    if abs(y1 - y0) < 1e-6:
        B(g, min(x0, x1), max(x0, x1), y0 - t, y0 + t, z, z + h - 0.04, gm); B(mb, min(x0, x1), max(x0, x1), y0 - 0.035, y0 + 0.035, z + h - 0.04, z + h, M['steel'])
    else:
        B(g, x0 - t, x0 + t, min(y0, y1), max(y0, y1), z, z + h - 0.04, gm); B(mb, x0 - 0.035, x0 + 0.035, min(y0, y1), max(y0, y1), z + h - 0.04, z + h, M['steel'])


def cut(r, hs):   # 矩形扣掉幾個矩形孔，剩下的切成矩形
    out = [r]
    for hx0, hx1, hy0, hy1 in hs:
        nxt = []
        for x0, x1, y0, y1 in out:
            if hx1 <= x0 or hx0 >= x1 or hy1 <= y0 or hy0 >= y1: nxt.append((x0, x1, y0, y1)); continue
            a, b = max(y0, hy0), min(y1, hy1)
            nxt += [(x0, x1, y0, a), (x0, x1, b, y1), (x0, max(x0, hx0), a, b), (min(x1, hx1), x1, a, b)]
        out = [q for q in nxt if q[1] - q[0] > 1e-4 and q[3] - q[2] > 1e-4]
    return out


def slab(mb, x0, x1, y0, y1, z, t, edge, lights=(), top=None, holes=()):
    """樓板或屋頂板：封邊的顏色（深灰或白），底面是 49 號天花（著色器每 1.6 m 畫一盞崁燈，入夜才亮；lights 參數留著只是標出哪裡是出挑）。
    holes 是樓梯井的開孔（細模）。"""
    for q in cut((x0, x1, y0, y1), holes): B(mb, *q, z, z + t, edge)
    if top: B(mb, x0 + 0.1, x1 - 0.1, y0 + 0.1, y1 - 0.1, z + t, z + t + 0.03, top)
    if LO: return
    for q in cut((x0 + 0.06, x1 - 0.06, y0 + 0.06, y1 - 0.06), holes): B(mb, *q, z - 0.02, z, M['soffit'])


def lounger(mb, x, y):   # 躺椅：柚木框、坐墊、斜的靠背墊（頭朝 +Y）
    if LO: return
    B(mb, x - 0.33, x + 0.33, y - 0.95, y + 0.95, 0.1, 0.3, M['teak']); B(mb, x - 0.3, x + 0.3, y - 0.92, y + 0.4, 0.3, 0.4, M['cushion'])
    mb.add([(x - 0.3, y + 0.4, 0.3), (x + 0.3, y + 0.4, 0.3), (x + 0.3, y + 0.95, 0.85), (x - 0.3, y + 0.95, 0.85),
            (x - 0.3, y + 0.32, 0.38), (x + 0.3, y + 0.32, 0.38), (x + 0.3, y + 0.87, 0.93), (x - 0.3, y + 0.87, 0.93)],
           [(0, 1, 2, 3), (7, 6, 5, 4), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)], M['cushion'])


def umbrella(mb, x, y, r=1.4):   # 陽傘：桿、八角的傘面（上下兩層）
    if LO: return
    mb.cyl_z(x, y, 0, 2.4, 0.03, 6, M['steel'])
    ring = [(x + r * math.cos(2 * math.pi * i / 8), y + r * math.sin(2 * math.pi * i / 8), 2.15) for i in range(8)]
    mb.add(ring + [(x, y, 2.6)] + [(px, py, 2.1) for px, py, _ in ring],
           [(i, (i + 1) % 8, 8) for i in range(8)] + [(9 + (i + 1) % 8, 9 + i, i, (i + 1) % 8) for i in range(8)] + [tuple(range(16, 8, -1))], M['fabric'])


def sofa(mb, x0, x1, y0, y1):   # 戶外沙發：底座、坐墊、靠背（長邊靠 +Y 或 +X）
    if LO: return
    B(mb, x0, x1, y0, y1, 0.0, 0.25, M['teak']); B(mb, x0 + 0.05, x1 - 0.05, y0 + 0.05, y1 - 0.05, 0.25, 0.45, M['cushion'])
    if x1 - x0 > y1 - y0: B(mb, x0, x1, y1 - 0.25, y1, 0.25, 0.8, M['cushion'])
    else: B(mb, x1 - 0.25, x1, y0, y1, 0.25, 0.8, M['cushion'])


def leafy(mb, x, y, z, r, m, seed, sub=3, squash=0.8):   # 灌木（或岩石）：細分的二十面體、表面照亂數起伏
    rnd = random.Random(seed); bm = bmesh.new(); bmesh.ops.create_icosphere(bm, subdivisions=sub, radius=r)
    bm.verts.index_update()
    for v in bm.verts:
        k = 0.82 + 0.36 * rnd.random(); v.co.x *= k; v.co.y *= k; v.co.z *= k * squash
    vs = [(x + v.co.x, y + v.co.y, z + v.co.z) for v in bm.verts]; fs = [tuple(v.index for v in f.verts) for f in bm.faces]; bm.free()
    mb.add(vs, fs, m)


def agave(mb, x, y, z, s=1.0, seed=1, n=18):   # 龍舌蘭：一圈圈往外拱的劍形厚葉（裡圈短而直、外圈長而平）
    rnd = random.Random(seed)
    for i in range(n):
        ph = i * 2.39996 + rnd.random() * 0.3; L = s * (0.55 + 0.45 * (i / n)) * (0.85 + 0.3 * rnd.random()); W = 0.13 * s
        e0, a = 1.25 - 0.75 * (i / n), 1.1 / L
        out = [(0, -W * 0.5), (L * 0.3, -W * 0.6), (L * 0.75, -W * 0.3), (L, 0), (L * 0.75, W * 0.3), (L * 0.3, W * 0.6), (0, W * 0.5)]
        cp, sp, lat = math.cos(ph), math.sin(ph), (-math.sin(ph), math.cos(ph))
        pts = []
        for sv, w in out:
            r_, h_ = (math.sin(e0) - math.sin(e0 - a * sv)) / a, (math.cos(e0 - a * sv) - math.cos(e0)) / a
            pts.append((x + cp * r_ + lat[0] * w, y + sp * r_ + lat[1] * w, z + h_))
        k = len(pts)
        mb.add(pts + [(px, py, pz + 0.035 * s) for px, py, pz in pts], [tuple(reversed(range(k))), tuple(range(k, 2 * k))] + [(j, (j + 1) % k, k + (j + 1) % k, k + j) for j in range(k)], M['agave'])


def planter(mb, x0, x1, y0, y1, h, seed):   # 板模混凝土花台：裡面龍舌蘭與灌木輪流
    B(mb, x0, x1, y0, y1, 0, h, M['board'])
    if LO: return
    B(mb, x0 + 0.15, x1 - 0.15, y0 + 0.15, y1 - 0.15, h, h + 0.02, M['shrub'])
    rnd = random.Random(seed); along = (x1 - x0) > (y1 - y0); L = (x1 - x0) if along else (y1 - y0); n = max(1, int(L / 1.5))
    for k in range(n):
        t = (k + 0.5) / n; px, py = (x0 + (x1 - x0) * t, (y0 + y1) / 2) if along else ((x0 + x1) / 2, y0 + (y1 - y0) * t)
        if k % 2 == 0: agave(mb, px, py, h, 0.9 + 0.3 * rnd.random(), seed + k, 14)
        else: leafy(mb, px, py, h + 0.25, 0.45, M['shrub'], seed + k, 1)


def stilts(mb, xs, ys, z1, w=0.55, m=None):   # 往下伸進坡裡的柱子（到 z = −22）
    for x in xs:
        for y in ys: B(mb, x - w / 2, x + w / 2, y - w / 2, y + w / 2, -22, z1, m or M['board'])


def pool(mb, x0, x1, y0, y1, zt, edge=None):
    """泳池：板模混凝土池身往下 1.6 m、洞石壓頂、水面比壓頂低 6 cm。edge（'y0'／'y1'／'x0'／'x1'）是無邊際那一側：
    那邊沒有壓頂、水漫過池緣，外牆面是一片往下流的水。"""
    B(mb, x0, x1, y0, y1, zt - 1.6, zt - 0.08, M['board'])
    B(mb, x0 + 0.3, x1 - 0.3, y0 + 0.3, y1 - 0.3, zt - 0.08, zt - 0.06, M['water'])
    cs = {'y1': (x0, x1, y1 - 0.3, y1), 'y0': (x0, x1, y0, y0 + 0.3), 'x0': (x0, x0 + 0.3, y0 + 0.3, y1 - 0.3), 'x1': (x1 - 0.3, x1, y0 + 0.3, y1 - 0.3)}
    for k, (a0, a1, b0, b1) in cs.items():
        if k == edge: B(mb, a0, a1, b0, b1, zt - 0.08, zt - 0.065, M['water'])
        else: B(mb, a0 - 0.02, a1 + 0.02, b0 - 0.02, b1 + 0.02, zt - 0.08, zt + 0.02, M['trav'])
    sheet = {'y0': (x0, x1, y0 - 0.02, y0), 'y1': (x0, x1, y1, y1 + 0.02), 'x0': (x0 - 0.02, x0, y0, y1), 'x1': (x1, x1 + 0.02, y0, y1)}.get(edge)
    if sheet: B(mb, *sheet, zt - 0.9, zt - 0.065, M['water'])


# ─────────────────────────────── 照平面圖蓋的外殼（細模） ───────────────────────────────
# blender/villa_plans.json 是平面圖、tools/villa-plan.mjs 推出的 out/villa_walls.json 是每層的牆段（ext 外牆、int 內牆、glass／frost 落地玻璃，open 是門洞）、
# 窗與樓梯踏階（先跑 node tools/villa-plan.mjs）。牆有厚度、置中在平面圖的線上：外牆 24 cm（外側 16 cm 是外牆材質、內側 8 cm 白漆），內牆 12 cm；
# 牆高是樓板面到上一層樓板底（levels 的 h）。玻璃片另成一個物件 NAME_gl（遊戲用透明的 villaGlass 畫），框、門扇、踏階、欄杆的鋼件留在本體。
import json
_HERE = os.path.dirname(os.path.abspath(__file__))
PLANS = json.load(open(os.path.join(_HERE, 'villa_plans.json'), encoding='utf-8'))['villas']
WALLS = json.load(open(os.path.join(_HERE, 'out', 'villa_walls.json'), encoding='utf-8'))
M.update({
    'plaster': mat('m2_plaster', '#efe5d6', 0.85, 0.0), 'oak': mat('t23_oak', '#a07a52', 0.6, 0.0), 'door': mat('t24_door', '#7a5838', 0.6, 0.0),
    'clear': mat('m1_clear', '#a9c4c8', 0.05, 0.0), 'frost': mat('m1_frost', '#e6eef0', 0.3, 0.0),
})
GB = None   # 目前這棟的玻璃（細模才有）
EXT_T, INT_T = 0.24, 0.12
HEAD = {'door': 2.2, 'front': 2.5, 'garage': 2.6, 'slide': 2.6, 'french': 2.45, 'arch': 2.6}
FLOOR = {'bath': 'trav', 'powder': 'trav', 'kitchen': 'trav', 'foyer': 'trav', 'laundry': 'trav', 'pantry': 'trav', 'garage': 'board', 'utility': 'board'}


def inroom(lv, x, y):
    for r in lv['rooms']:
        x0, x1, y0, y1 = r['r']
        if x0 < x < x1 and y0 < y < y1: return r
    return None


def wall_on(lv, ax, c, u):   # 平面圖這條線上（ax 向、在 c）、u 這一點有沒有牆或玻璃
    k = 0 if ax == 'x' else 1
    for s in lv['walls']:
        if s['ax'] != ax or abs((s['a'][1] if ax == 'x' else s['a'][0]) - c) > 0.01: continue
        if min(s['a'][k], s['b'][k]) - 1e-6 <= u <= max(s['a'][k], s['b'][k]) + 1e-6: return s
    return None


def at(ax, c, u, o):   # 牆的局部座標（沿牆 u、離線 o）→ 平面 x, y
    return (u, c + o) if ax == 'x' else (c + o, u)


def WB(m_, ax, c, u0, u1, o0, o1, z0, z1, mt):
    if ax == 'x': B(m_, u0, u1, c + o0, c + o1, z0, z1, mt)
    else: B(m_, c + o0, c + o1, u0, u1, z0, z1, mt)


def WP(m_, ax, c, o0, o1, pts, mt):   # 牆面上的凸多邊形（u, z）穿過牆厚 o0..o1
    n = len(pts)
    v = [(*at(ax, c, u, o0), z) for u, z in pts] + [(*at(ax, c, u, o1), z) for u, z in pts]
    m_.add(v, [tuple(reversed(range(n))), tuple(range(n, 2 * n))] + [(i, (i + 1) % n, n + (i + 1) % n, n + i) for i in range(n)], mt)


def arcpts(u0, u1, zs, a0, a1, seg=8):
    R, uc = (u1 - u0) / 2, (u0 + u1) / 2
    return [(uc + R * math.cos(a0 + (a1 - a0) * i / seg), zs + R * math.sin(a0 + (a1 - a0) * i / seg)) for i in range(seg + 1)]


def spandrel(m_, ax, c, o0, o1, u0, u1, zs, mt):   # 拱形開口上方兩角的牆（拱線到拱頂高度之間）：每角一塊凹多邊形的稜柱
    zt = zs + (u1 - u0) / 2
    WP(m_, ax, c, o0, o1, arcpts(u0, u1, zs, math.pi, math.pi / 2) + [(u0, zt)], mt)
    WP(m_, ax, c, o0, o1, arcpts(u0, u1, zs, math.pi / 2, 0) + [(u1, zt)], mt)


def pane(ax, c, u0, u1, z0, z1, frost=False, o=0.0):
    WB(GB, ax, c, u0, u1, o - 0.012, o + 0.012, z0, z1, M['frost' if frost else 'clear'])


# 會動的門扇與拉門（2026-10-28）：不併進房子，每扇另存一個物件 vid_drK（關著的姿勢、原點在鉸鏈或拉門的起點、沿 +X 伸出；玻璃另存 vid_drK_g），
# 另把全部關著的門扇併成 vid_doors／vid_doors_g（遠景與沒人走近的別墅）。29-villa.js／69-villa.js 照 blender/out/villa_doors.json 開關門與擋人：
# [名字, 層, 0 推門／1 拉門, 鉸鏈 x, y, 關著的轉角, 打開要轉的角度（推門）或推開的距離（拉門）, 佔地 x0, x1, y0, y1, 外牆, 樓板 z]
DOORS, DMB, DGB = {}, {}, {}
CUR = None   # shell() 正在建的 [vid, 層, 這段牆是不是外牆]


def rot_box(px, py, th, x0, x1, y0, y1):   # 局部的軸向盒繞 (px, py) 轉 th（90° 的倍數）
    c, s_ = round(math.cos(th)), round(math.sin(th))
    pts = [(px + x * c - y * s_, py + x * s_ + y * c) for x in (x0, x1) for y in (y0, y1)]
    return min(p[0] for p in pts), max(p[0] for p in pts), min(p[1] for p in pts), max(p[1] for p in pts)


def movable(ax, c, u, th0, mv, kind, z0, draw):
    vid, L, ext = CUR
    k = len(DOORS[vid]); name = f'{vid}_dr{k}'
    px, py = at(ax, c, u, 0)
    mo, mg = MB(700 + k), MB(800 + k)
    bb = [1e9, -1e9, 1e9, -1e9]
    def lb(glass, x0, x1, y0, y1, za, zb, mt):
        B(mg if glass else mo, x0, x1, y0, y1, za, zb, mt)
        X0, X1, Y0, Y1 = rot_box(px, py, th0, x0, x1, y0, y1)
        B(DGB[vid] if glass else DMB[vid], X0, X1, Y0, Y1, za, zb, mt)
        bb[0] = min(bb[0], X0); bb[1] = max(bb[1], X1); bb[2] = min(bb[2], Y0); bb[3] = max(bb[3], Y1)
    draw(lb, 1 if ax == 'x' else -1)
    off = (len(DOORS) * 60.0, 300.0 + k * 4.0, 0.0)   # 物件放遠一點（烘 AO 時藏起來，位置不影響匯出的網格）
    o = mo.build(name); o.location = off
    if mg.f: g = mg.build(name + '_g'); g.location = off
    r = lambda v: round(v, 4)
    DOORS[vid].append([name, L, 0 if kind == 'swing' else 1, r(px), r(py), r(th0), r(mv), *map(r, bb), 1 if ext else 0, r(z0)])


def leaf(mb, ax, c, u, w, sd, z0, z1, mt, t=0.045, glazed=False, frame=None, su=1):
    """門扇：鉸鏈在牆線上 u 處，關著時沿牆往 su（±1）那一側伸出 w，打開 90° 往 sd（±1）那一側。glazed 是玻璃門扇（框＋玻璃）"""
    th0 = (0 if su > 0 else math.pi) if ax == 'x' else (math.pi / 2 if su > 0 else -math.pi / 2)
    th1 = (math.pi / 2 if sd > 0 else -math.pi / 2) if ax == 'x' else (0 if sd > 0 else math.pi)
    def draw(lb, ny):
        if not glazed:
            lb(0, 0, w, -t / 2, t / 2, z0 + 0.01, z1, mt)
            hx = w - 0.08
            lb(0, hx - 0.01, hx + 0.01, t / 2, t / 2 + 0.05, z0 + 1.0, z0 + 1.05, M['steel']); lb(0, hx - 0.01, hx + 0.01, -t / 2 - 0.05, -t / 2, z0 + 1.0, z0 + 1.05, M['steel'])
            return
        f = 0.07
        for b0, b1 in ((0, f), (w - f, w)): lb(0, b0, b1, -t / 2, t / 2, z0 + 0.01, z1, frame)
        lb(0, 0, w, -t / 2, t / 2, z0 + 0.01, z0 + 0.16, frame); lb(0, 0, w, -t / 2, t / 2, z1 - f, z1, frame)
        lb(1, f, w - f, -0.008, 0.008, z0 + 0.16, z1 - f, M['clear'])
    movable(ax, c, u, th0, (th1 - th0 + math.pi) % (2 * math.pi) - math.pi, 'swing', z0, draw)


def shell(mb, vid, ext_m=None, arch=False, solid_stair=False, plinth=None, frame=None):
    """vid 的每一層：地板、牆（門洞、窗洞、拱）、落地玻璃（框、拉門）、門扇、樓梯（踏階、梯井欄杆）。
    ext_m(L, s) 可以換掉某段外牆的材質；arch：門窗上緣是半圓拱（地中海莊園）；plinth=(高, 材質)：外牆腳的勒腳。"""
    global CUR
    P, W = PLANS[vid], WALLS[vid]
    fr = frame or M['frame']
    DOORS[vid], DMB[vid], DGB[vid] = [], MB(900), MB(901)
    for lv in W['levels']:
        L, z, h = lv['L'], lv['z'], lv['h']; zt = z + h
        for r in lv['rooms']:   # 地板（上層的樓梯井不鋪）
            if r['kind'] == 'void' or (r['kind'] == 'stair' and L > 0): continue
            x0, x1, y0, y1 = r['r']
            B(mb, x0, x1, y0, y1, z, z + 0.025, M[FLOOR.get(r['kind'], 'oak')])
        for s in lv['walls']:
            ax = s['ax']; k = 0 if ax == 'x' else 1; c = s['a'][1] if ax == 'x' else s['a'][0]
            a, b = sorted((s['a'][k], s['b'][k]))
            mid = (a + b) / 2
            rp, rn = inroom(lv, *at(ax, c, mid, 0.3)), inroom(lv, *at(ax, c, mid, -0.3))
            out = 1 if rp is None else -1   # 外側（ext 與玻璃牆）
            CUR = [vid, L, rp is None or rn is None]
            opens = []
            for u0, u1, kind in s.get('open', []):
                hd = min(HEAD[kind], h - 0.15)
                top = hd
                if arch and kind != 'door' and kind != 'garage' and kind != 'slide':
                    hd = min(HEAD[kind], h - 0.15 - (u1 - u0) / 2); top = hd + (u1 - u0) / 2
                opens.append([u0, u1, z, z + hd, z + top, kind])
            for wn in lv['windows']:
                if wn['ax'] != ax or abs((wn['y'] if ax == 'x' else wn['x']) - c) > 0.01: continue
                u = wn['x'] if ax == 'x' else wn['y']
                if not (a - 1e-6 <= u <= b + 1e-6): continue
                zh = z + wn['sill'] + wn['h']
                opens.append([u - wn['w'] / 2, u + wn['w'] / 2, z + wn['sill'], zh, zh + (wn['w'] / 2 if arch else 0), 'win'])
            opens.sort()
            if s['t'] in ('glass', 'frost'):
                gwall(mb, ax, c, a, b, z, zt, opens, s['t'] == 'frost', out, rp, rn, lv, fr)
                continue
            if s['t'] == 'ext':
                em = M[(ext_m and ext_m(L, s, ax, c)) or P['ext'][L]]
                layers = [(-0.04, 0.12, em), (-0.12, -0.04, M['plaster'])] if out > 0 else [(-0.12, 0.04, em), (0.04, 0.12, M['plaster'])]
                e = EXT_T / 2
            else:
                layers = [(-INT_T / 2, INT_T / 2, M['plaster'])]; e = 0.0
            def piece(u0, u1, z0, z1):
                if u1 - u0 > 1e-4 and z1 - z0 > 1e-4:
                    for o0, o1, mt in layers: WB(mb, ax, c, u0, u1, o0, o1, z0, z1, mt)
            u = a - e
            for u0, u1, zb, zh, ztop, kind in opens:
                piece(u, u0, z, zt)
                piece(u0, u1, z, zb); piece(u0, u1, ztop, zt)
                if ztop > zh + 1e-3:
                    for o0, o1, mt in layers: spandrel(mb, ax, c, o0, o1, u0, u1, zh, mt)
                u = max(u, u1)
                opening(mb, ax, c, u0, u1, zb, zh, ztop, kind, out if s['t'] == 'ext' else 0, rp, rn, lv, fr, arch, s['t'] == 'ext')
            piece(u, b + e, z, zt)
            if plinth and s['t'] == 'ext' and L == 0:
                ph, pm = plinth; u = a - e - 0.04; po = (0.12, 0.16) if out > 0 else (-0.16, -0.12)
                for u0, u1, zb, zh, ztop, kind in opens:
                    if zb - z < ph: WB(mb, ax, c, u, u0, *po, z, z + ph, pm); u = u1
                WB(mb, ax, c, u, b + e + 0.04, *po, z, z + ph, pm)
    for st in W['stairs']: stair(mb, vid, st, solid_stair)


def swing_side(ax, c, u, rp, rn, out):   # 門扇往哪一側開：外牆的門往室內開；室內門往比較小的房間開
    if out: return -out
    if rp is None: return -1
    if rn is None: return 1
    ar = lambda r: (r['r'][1] - r['r'][0]) * (r['r'][3] - r['r'][2])
    return 1 if ar(rp) <= ar(rn) else -1


def opening(mb, ax, c, u0, u1, zb, zh, ztop, kind, out, rp, rn, lv, fr, arch, ext):
    w = u1 - u0; sd = swing_side(ax, c, (u0 + u1) / 2, rp, rn, out)
    if kind == 'win':   # 窗：細框、中間直料，拱窗上半是整片拱形玻璃
        WB(mb, ax, c, u0 - 0.02, u1 + 0.02, -0.06, 0.06, zb - 0.04, zb + 0.04, fr)
        for uu in (u0 + 0.03, u1 - 0.03, (u0 + u1) / 2): WB(mb, ax, c, uu - 0.03, uu + 0.03, -0.04, 0.04, zb, zh, fr)
        WB(mb, ax, c, u0, u1, -0.04, 0.04, zh - 0.05, zh, fr)
        pane(ax, c, u0, u1, zb, zh - 0.05)
        if ztop > zh + 1e-3: WP(GB, ax, c, -0.012, 0.012, arcpts(u0, u1, zh, 0, math.pi), M['clear'])
        if ext: WB(mb, ax, c, u0 - 0.1, u1 + 0.1, out * 0.12 if out > 0 else -0.18, 0.18 if out > 0 else -0.12, zb - 0.06, zb, M['trav' if arch else 'fascia'])
        return
    if kind == 'garage' or kind == 'arch': return   # 車庫門照原本的模型；拱門洞不裝門
    if ztop > zh + 1e-3: WP(GB, ax, c, -0.012, 0.012, arcpts(u0, u1, zh, 0, math.pi), M['clear'])   # 拱門上方的扇形玻璃
    if kind == 'french':   # 對開玻璃門，兩扇都往裡開
        leaf(mb, ax, c, u0 + 0.03, w / 2 - 0.03, sd, zb, zh, None, glazed=True, frame=M['white'] if arch else fr)
        leaf(mb, ax, c, u1 - 0.03, w / 2 - 0.03, sd, zb, zh, None, glazed=True, frame=M['white'] if arch else fr, su=-1)
    elif kind == 'front':
        if w > 1.3:
            leaf(mb, ax, c, u0 + 0.03, w / 2 - 0.03, sd, zb, zh, M['slat_d'], 0.06); leaf(mb, ax, c, u1 - 0.03, w / 2 - 0.03, sd, zb, zh, M['slat_d'], 0.06, su=-1)
        else: leaf(mb, ax, c, u0 + 0.04, w - 0.08, sd, zb, zh, M['slat_d'], 0.06)
    elif kind == 'door':
        leaf(mb, ax, c, u0 + 0.03, w - 0.06, sd, zb, zh, M['door'])
        for uu in (u0, u1): WB(mb, ax, c, uu - 0.02, uu + 0.02, -0.08, 0.08, zb, zh + 0.04, M['white'])   # 門框
        WB(mb, ax, c, u0 - 0.02, u1 + 0.02, -0.08, 0.08, zh, zh + 0.05, M['white'])
    elif kind == 'slide':   # 實牆上的拉門：玻璃門扇收在牆裡側
        sd2 = -out if out else 1
        WB(mb, ax, c, u0, u1, -0.05, 0.05, zh - 0.06, zh, fr)
        slider(mb, ax, c, u0, u1, zb, zh, sd2, fr, None)


def slider(mb, ax, c, u0, u1, zb, zh, sd, fr, span):
    """玻璃拉門扇：關著時擋在開口（牆線 sd 側 8 cm），打開時推到旁邊那一片固定玻璃的內側。span 是這段牆的範圍（決定往哪邊推）"""
    w = u1 - u0; o = sd * 0.08
    mv = -w if span and u1 + w > span[1] + 1e-3 else w
    def draw(lb, ny):
        oy = o * ny
        for q0, q1 in ((0, 0.06), (w - 0.06, w)): lb(0, q0, q1, oy - 0.03, oy + 0.03, zb, zh - 0.02, fr)
        lb(0, 0, w, oy - 0.03, oy + 0.03, zb, zb + 0.08, fr); lb(0, 0, w, oy - 0.03, oy + 0.03, zh - 0.08, zh - 0.02, fr)
        lb(1, 0.06, w - 0.06, oy - 0.012, oy + 0.012, zb + 0.08, zh - 0.08, M['clear'])
    movable(ax, c, u0, 0 if ax == 'x' else math.pi / 2, mv, 'slide', zb, draw)


def gwall(mb, ax, c, a, b, z, zt, opens, frost, out, rp, rn, lv, fr):
    """落地玻璃牆：整片玻璃、黑框直料（≤ 1.6 m）、上下框；開口（拉門、大門）上方是氣窗玻璃，拉門扇推到旁邊那片的內側"""
    spans, u = [], a
    for u0, u1, zb, zh, ztop, kind in opens:
        if u0 > u: spans.append((u, u0))
        u = max(u, u1)
    if b > u: spans.append((u, b))
    posts = {round(a, 3), round(b, 3)}
    for p0, p1 in spans:
        pane(ax, c, p0, p1, z + 0.06, zt - 0.06, frost)
        n = max(1, round((p1 - p0) / 1.6))
        for i in range(n + 1): posts.add(round(p0 + (p1 - p0) * i / n, 3))
        WB(mb, ax, c, p0, p1, -0.05, 0.05, z, z + 0.06, fr); WB(mb, ax, c, p0, p1, -0.05, 0.05, zt - 0.06, zt, fr)
    for u0, u1, zb, zh, ztop, kind in opens:
        posts.update((round(u0, 3), round(u1, 3)))
        if zt - zh > 0.15:
            WB(mb, ax, c, u0, u1, -0.05, 0.05, zh - 0.03, zh + 0.03, fr); WB(mb, ax, c, u0, u1, -0.05, 0.05, zt - 0.06, zt, fr)
            pane(ax, c, u0, u1, zh + 0.03, zt - 0.06, frost)
        sd = -out
        if kind == 'slide': slider(mb, ax, c, u0, u1, zb, zh, sd, fr, (a, b))
        elif kind == 'front': leaf(mb, ax, c, u0 + 0.04, u1 - u0 - 0.08, sd, zb, zh, M['slat_d'], 0.06)
    for p in sorted(posts): WB(mb, ax, c, p - 0.03, p + 0.03, -0.05, 0.05, z, zt, fr)


def glass_rail(mb, p0, p1, z0, z1, h=1.0, iron=False):
    """欄杆（p0→p1 平面上的線段、底高 z0→z1 可以是斜的）：無框玻璃＋不鏽鋼扶手；iron 是鑄鐵直欄杆"""
    (x0, y0), (x1, y1) = p0, p1
    L = math.hypot(x1 - x0, y1 - y0)
    if L < 1e-3: return
    nx, ny = -(y1 - y0) / L * 0.01, (x1 - x0) / L * 0.01
    if iron:
        n = max(1, int(L / 0.14))
        for i in range(n + 1):
            t = i / n; x, y, zz = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, z0 + (z1 - z0) * t
            B(mb, x - 0.012, x + 0.012, y - 0.012, y + 0.012, zz, zz + h - 0.03, M['iron'])
        beam(mb, (x0, y0, z0 + h), (x1, y1, z1 + h), 0.025, M['iron'])
        return
    v = [(x0 - nx, y0 - ny, z0 + 0.04), (x1 - nx, y1 - ny, z1 + 0.04), (x1 - nx, y1 - ny, z1 + h - 0.04), (x0 - nx, y0 - ny, z0 + h - 0.04)]
    v += [(px + 2 * nx, py + 2 * ny, pz) for px, py, pz in v]
    GB.add(v, [(3, 2, 1, 0), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)], M['clear'])
    beam(mb, (x0, y0, z0 + h), (x1, y1, z1 + h), 0.022, M['steel'])


def stair(mb, vid, st, solid):
    """villa_walls.json 算好的踏階：現代的是 5 cm 橡木踏板＋中間一根鋼樑（懸空、看得到下面），地中海莊園是洞石實心階；
    沒有牆靠著的那一側加欄杆（斜的跟著踏階），U 型兩跑中間是一道玻璃（實心階是白牆）；上層樓梯井開口的邊有欄杆，抵達那一段留空"""
    W = WALLS[vid]; L = st['L']; lo = next(l for l in W['levels'] if l['L'] == L); hi = next(l for l in W['levels'] if l['L'] == L + 1)
    hx0, hx1, hy0, hy1 = st['hole']; d = st['dir']; ax = d[1]; sg = -1 if d[0] == '-' else 1; Lr, Wd = st['Lr'], st['W']
    def Pt(r, w):
        if ax == 'x': return (hx0 + r if sg > 0 else hx1 - r, hy0 + w)
        return (hx0 + w, hy0 + r if sg > 0 else hy1 - r)
    z0, z1 = lo['z'], hi['z']
    for x0, x1, y0, y1, zt in st['treads']:
        if solid: B(mb, x0, x1, y0, y1, z0, zt, M['trav'])
        else: B(mb, x0, x1, y0, y1, zt - 0.05, zt, M['oak'])
    if st['landing']:
        x0, x1, y0, y1, zt = st['landing']
        if solid: B(mb, x0, x1, y0, y1, z0, zt, M['trav'])
        else: B(mb, x0, x1, y0, y1, zt - 0.2, zt - 0.03, M['white']); B(mb, x0, x1, y0, y1, zt - 0.03, zt, M['oak'])
    side_ax = 'y' if ax == 'y' else 'x'   # 跑的方向上的牆線（側邊）：沿跑向
    def open_side(lv, w, r):   # 平面上 w 這條側邊線、r 處：沒有牆，而且外面是房間
        x, y = Pt(r, w)
        c = x if ax == 'y' else y; u = y if ax == 'y' else x
        if wall_on(lv, side_ax, c, u): return False
        ox, oy = Pt(r, w + (0.3 if w > Wd / 2 else -0.3))
        return inroom(lv, ox, oy) is not None
    for f in st['flights']:
        ra, rb = f['r']; za, zb = f['z']; w0, w1 = f['w']; wc = (w0 + w1) / 2
        rise = (zb - za) / max(1, round(abs(rb - ra) / f['run']))
        if not solid: beam(mb, (*Pt(ra, wc), za + rise - 0.16), (*Pt(rb, wc), zb - 0.16), 0.08, M['steel'])
        for w in (w0, w1):
            if abs(w - Wd / 2) < 1e-3 and st['ty'] == 'U': continue
            if open_side(lo, w, (ra + rb) / 2): glass_rail(mb, Pt(ra, w), Pt(rb, w), za + rise, zb, 0.95, solid)
    if st['ty'] == 'U':   # 兩跑中間：玻璃（或白牆）從第一跑的踏階線到第二跑的扶手高
        f1, f2 = st['flights']; Lf = f1['r'][1]; zm = f1['z'][1]
        a0, a1 = Pt(0, Wd / 2), Pt(Lf, Wd / 2)
        if solid:
            v = [(*a0, z0), (*a1, z0), (*a1, zm + 0.95), (*a0, z1 + 0.95)]
            th = 0.06; nx, ny = (th, 0) if ax == 'y' else (0, th)
            vv = [(x - nx, y - ny, zz) for x, y, zz in v] + [(x + nx, y + ny, zz) for x, y, zz in v]
            mb.add(vv, [(3, 2, 1, 0), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)], M['plaster'])
        else:
            nx, ny = (0.01, 0) if ax == 'y' else (0, 0.01)
            v = [(*a0, z0 + 0.2), (*a1, zm), (*a1, zm + 0.95), (*a0, z1 + 0.95)]
            vv = [(x - nx, y - ny, zz) for x, y, zz in v] + [(x + nx, y + ny, zz) for x, y, zz in v]
            GB.add(vv, [(3, 2, 1, 0), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)], M['clear'])
            beam(mb, (*a0, z1 + 0.97), (*a1, zm + 0.97), 0.022, M['steel'])
        for w in (0, Wd):   # 平台的外側與遠端
            if open_side(lo, w, (Lf + Lr) / 2): glass_rail(mb, Pt(Lf, w), Pt(Lr, w), zm, zm, 0.95, solid)
        x, y = Pt(Lr + 0.3, Wd / 2)
        c = Pt(Lr, 0)[1] if ax == 'y' else Pt(Lr, 0)[0]
        if inroom(lo, x, y) and not wall_on(lo, 'x' if ax == 'y' else 'y', c, Pt(Lr, Wd / 2)[0] if ax == 'y' else Pt(Lr, Wd / 2)[1]):
            glass_rail(mb, Pt(Lr, 0), Pt(Lr, Wd), zm, zm, 0.95, solid)
    # 上層：梯井四邊（不靠牆、外面是房間的）加欄杆；抵達的那一段不加
    arr = (0, st['flights'][1]['w']) if st['ty'] == 'U' else (Lr, (0, Wd))
    edges = [((0, 0), (0, Wd)), ((Lr, 0), (Lr, Wd)), ((0, 0), (Lr, 0)), ((0, Wd), (Lr, Wd))]
    for (ra, wa), (rb, wb) in edges:
        cuts = [(wa, wb)] if ra == rb else [(ra, rb)]
        if ra == rb and ra == arr[0]:   # 抵達端：扣掉抵達的那半邊
            g0, g1 = arr[1]
            cuts = [(p, q) for p, q in ((wa, g0), (g1, wb)) if q - p > 1e-3]
        for p, q in cuts:
            A = Pt(ra, p) if ra == rb else Pt(p, wa); Bp = Pt(ra, q) if ra == rb else Pt(q, wa)
            mx, my = (A[0] + Bp[0]) / 2, (A[1] + Bp[1]) / 2
            eax = 'x' if abs(A[1] - Bp[1]) < 1e-6 else 'y'; c = A[1] if eax == 'x' else A[0]; u = mx if eax == 'x' else my
            if wall_on(hi, eax, c, u): continue
            cx, cy = (hx0 + hx1) / 2, (hy0 + hy1) / 2
            ox, oy = mx + (0.3 if mx > cx + 1e-6 else -0.3 if mx < cx - 1e-6 else 0) * (eax == 'y'), my + (0.3 if my > cy + 1e-6 else -0.3 if my < cy - 1e-6 else 0) * (eax == 'x')
            if inroom(hi, ox, oy) is None or inroom(hi, ox, oy)['kind'] == 'void': continue
            glass_rail(mb, A, Bp, z1 + 0.025, z1 + 0.025, 1.0, solid)


# ─────────────────────────────── 型號 ───────────────────────────────
def holes(vid, L):   # 第 L 層樓板要開的樓梯孔（從 L − 1 層上來的樓梯）
    return [] if LO else [tuple(st['hole']) for st in WALLS[vid]['stairs'] if st['L'] == L - 1]


def hm1():   # 懸崖展館：一樓玻璃客廳＋板模混凝土側翼（車庫）、兩層高的洞石刀片牆、二樓往後懸挑 2.5 m、深出挑的屋頂板，後方懸挑的無邊際泳池與木平台
    mb = MB(31)
    if LO:
        B(mb, 5, 9, -5, 5, 0, 3.6, M['board'])
        glass(mb, 'x', 4.5, -8, 5, 0.05, 3.4, 1); glass(mb, 'x', -4.5, -8, 5, 0.05, 3.4, -1); glass(mb, 'y', -8, -4.5, 4.5, 0.05, 3.4, -1)
        B(mb, -8, 5, -4.5, 4.5, 3.35, 3.4, M['white'])
    else: shell(mb, 'hm1')
    B(mb, -9, -8.55, -6, 6.5, 0, 7.6, M['trav'])   # 洞石刀片牆
    B(mb, 5.6, 8.4, 5, 5.04, 0.05, 2.6, M['gdoor'])
    if not LO:
        for k in range(5): B(mb, 5.6, 8.4, 5.04, 5.08, 0.6 * k + 0.05, 0.6 * k + 0.1, M['frame'])
    slab(mb, -8.55, 9.2, -7.6, 5.0, 3.4, 0.45, M['fascia'], [(-8.4, 9, 3.6, 4.9)], holes=holes('hm1', 1))
    if LO:
        B(mb, -6, 2, -7.5, 3.5, 3.85, 7.0, M['white']); B(mb, 2, 8, -7.5, 3.5, 3.85, 7.0, M['slat'])
        glass(mb, 'x', 3.5, -6, 2, 3.9, 6.95, 1); glass(mb, 'x', -7.5, -6, 8, 3.9, 6.95, -1, 1.7); glass(mb, 'y', -6, -7.5, 3.5, 3.9, 6.95, -1)
    rail(mb, -8.5, 4.95, 9.1, 4.95, 3.85); rail(mb, 9.15, -7.5, 9.15, 4.95, 3.85)
    slab(mb, -7.2, 9.6, -9.2, 5.6, 7.0, 0.42, M['fascia'], [(-7, 9.4, 3.7, 5.5), (-7, 9.4, -9.1, -7.7)], top=M['board_d'])
    # 後方：木平台（板模混凝土的盒子托著）、無邊際泳池、躺椅與陽傘、沙發與火盆，外緣玻璃欄杆，柱子插進坡裡
    B(mb, 1, 9.2, -12, -5, -1.2, 0.0, M['board']); B(mb, 1, 9.2, -12, -5, 0.0, 0.18, M['deck'])
    pool(mb, -9.2, 1.0, -13.5, -5.0, 0.2, 'y0')
    stilts(mb, (-8.6, -4, 0.4, 4.8, 8.6), (-7.5, -11.4), -1.2)
    for k in range(3): lounger(mb, 2.4 + k * 1.1, -6.6)
    umbrella(mb, 5.8, -7.0); sofa(mb, 6.2, 9.0, -11.6, -9.6); sofa(mb, 3.0, 5.6, -11.6, -10.9)
    if not LO: B(mb, 4.0, 5.2, -10.2, -9.5, 0.18, 0.5, M['board_d']); B(mb, 4.1, 5.1, -10.1, -9.6, 0.5, 0.53, M['fire'])
    rail(mb, 9.15, -12, 9.15, -5, 0.18); rail(mb, 1, -12.0, 9.2, -12.0, 0.18)
    planter(mb, -8.4, -5.0, 5.4, 6.4, 0.7, 311); planter(mb, 1.5, 4.6, 5.4, 6.4, 0.7, 312)
    return mb.build('hm1' + ('_lo' if LO else ''))


def hm2():   # 板岩柱別墅：兩層玻璃量體、層疊板岩方柱、兩層出挑樓板（玻璃欄杆、崁燈）、二樓兩側木格柵，後方洞石泳池平台（層疊板岩擋土牆托著）
    mb = MB(32)
    if LO:
        glass(mb, 'x', 4.6, -7.5, 7.5, 0.05, 3.35, 1); glass(mb, 'x', -4.6, -7.5, 7.5, 0.05, 3.35, -1)
        glass(mb, 'y', -7.5, -4.6, 4.6, 0.05, 3.35, -1); glass(mb, 'y', 7.5, -4.6, 4.6, 0.05, 3.35, 1)
        B(mb, -7.5, 7.5, -4.6, 4.6, 3.3, 3.35, M['white'])
    else: shell(mb, 'hm2')
    for x in (-7.9, -0.45, 7.0):
        for y in (4.7, -5.6): B(mb, x, x + 0.9, y, y + 0.9, 0, 7.1, M['ledge'])
    slab(mb, -9.2, 9.2, -6.8, 6.4, 3.3, 0.45, M['white'], [(-9, 9, 4.8, 6.3), (-9, 9, -6.7, -4.8)], holes=holes('hm2', 1))
    if LO:
        B(mb, -6, 6, -4.4, 4.4, 3.75, 6.9, M['white'])
        glass(mb, 'x', 4.4, -6, 6, 3.8, 6.85, 1, 1.5); glass(mb, 'x', -4.4, -6, 6, 3.8, 6.85, -1, 1.5)
        B(mb, -6.25, -6, -4.4, 4.4, 3.75, 6.9, M['slat']); B(mb, 6, 6.25, -4.4, 4.4, 3.75, 6.9, M['slat'])
    rail(mb, -9.1, 6.35, 9.1, 6.35, 3.75); rail(mb, -9.1, -6.75, 9.1, -6.75, 3.75); rail(mb, -9.15, -6.75, -9.15, 6.35, 3.75); rail(mb, 9.15, -6.75, 9.15, 6.35, 3.75)
    slab(mb, -8.2, 8.2, -6.6, 6.2, 6.9, 0.32, M['fascia'], [(-8, 8, 4.5, 6.1), (-8, 8, -6.5, -4.5)], top=M['board_d'])
    B(mb, -9.2, 9.2, -14, -5, -0.25, 0.12, M['trav'])   # 後方洞石平台：層疊板岩包邊的 2.5 m 深梁，下面板岩方柱插進坡裡
    B(mb, -9.2, 9.2, -14.0, -13.4, -2.8, -0.25, M['ledge']); B(mb, -9.2, -8.6, -14, -5, -2.8, -0.25, M['ledge']); B(mb, 8.6, 9.2, -14, -5, -2.8, -0.25, M['ledge'])
    B(mb, -8.6, 8.6, -13.4, -5, -1.0, -0.25, M['board'])
    stilts(mb, (-8.3, -2.8, 2.8, 8.3), (-8.0, -13.0), -2.8, 0.9, M['ledge'])
    pool(mb, -7.5, 4.5, -13.4, -8.0, 0.2, 'y0')
    for k in range(4): lounger(mb, 5.4 + (k % 2) * 1.2, -8.2 - (k // 2) * 2.6)
    umbrella(mb, 7.8, -12.0); umbrella(mb, -2.0, -6.4); sofa(mb, -8.6, -6.0, -7.4, -6.4)
    planter(mb, -9.0, -5.5, 6.6, 7.6, 0.6, 321); planter(mb, 5.5, 9.0, 6.6, 7.6, 0.6, 322)
    if not LO: B(mb, -1.4, 1.4, 4.6, 5.8, 0, 0.17, M['trav'])   # 入口的洞石台階
    return mb.build('hm2' + ('_lo' if LO else ''))


def hm3():   # 洞石刀片牆三層：斜的洞石刀片牆、黑框大面玻璃、洞石量體與深框大窗、出挑的黑色屋頂板，正面一樓兩扇霧玻璃車庫門（可蓋在路的上坡側）
    mb = MB(33)
    if LO: B(mb, -9, 9, -6, 6, 0, 3.2, M['board'])
    else: shell(mb, 'hm3')
    for x0 in (1.2, 5.2):   # 霧玻璃的分節車庫門
        B(mb, x0, x0 + 3.4, 6.0, 6.03, 0.05, 2.6, M['gdoor'])
        if not LO:
            for k in range(5): B(mb, x0, x0 + 3.4, 6.03, 6.08, 0.05 + k * 0.6375, 0.11 + k * 0.6375, M['frame'])
            for k in range(5): B(mb, x0 + k * 0.85 - 0.03, x0 + k * 0.85 + 0.03, 6.03, 6.08, 0.05, 2.6, M['frame'])
    if LO: glass(mb, 'x', 6.0, -7.5, 0.4, 0.05, 3.1, 1, 1.75)
    slab(mb, -9.4, 9.4, -6.2, 7.0, 3.2, 0.35, M['fascia'], [(-9.2, 9.2, 6.1, 6.9)], holes=holes('hm3', 1))
    if LO:
        B(mb, -9, 6, -6, 5, 3.55, 6.7, M['white'])
        glass(mb, 'x', 5.0, -4.5, 6, 3.6, 6.65, 1, 1.5); B(mb, -9, -4.5, 4.95, 5.05, 3.55, 6.7, M['trav'])
        glass(mb, 'x', -6.0, -9, 6, 3.6, 6.65, -1, 1.5)
    rail(mb, -9.3, 6.95, 9.3, 6.95, 3.55)
    slab(mb, -9.4, 9.4, -6.2, 5.8, 6.7, 0.35, M['fascia'], [(-9.2, 9.2, 5.1, 5.7)], holes=holes('hm3', 2))
    if LO:
        B(mb, -4, 9, -6, 4, 7.05, 10.2, M['trav'])
        B(mb, -2.6, 4.6, 3.95, 4.5, 7.4, 9.9, M['frame']); glass(mb, 'x', 4.5, -2.4, 4.4, 7.6, 9.7, 1, 1.8)   # 深框的大窗
        glass(mb, 'y', 9.0, -5.5, 3.5, 7.4, 9.9, 1, 1.8)
    else:   # 三樓正面大窗的深框：兩側的黑框鰭片
        B(mb, -2.62, -2.42, 4.0, 4.55, 7.05, 10.2, M['frame']); B(mb, 4.42, 4.62, 4.0, 4.55, 7.05, 10.2, M['frame'])
    rail(mb, -9.3, 5.75, -4.1, 5.75, 7.05); rail(mb, -9.35, -6.1, -9.35, 5.75, 7.05)
    slab(mb, -4.6, 9.8, -6.8, 5.6, 10.2, 0.4, M['fascia'], [(-4.4, 9.6, 4.1, 5.5)], top=M['board_d'])
    mb.add([(-9.0, -6.6, 0), (-9.0, 6.8, 0), (-9.0, 6.8, 10.6), (-9.0, -6.6, 10.6), (-12.2, -6.6, 0), (-12.2, 6.8, 0)],
           [(0, 1, 2, 3), (4, 5, 1, 0), (3, 2, 5, 4), (0, 3, 4), (1, 5, 2)], M['trav'])   # 斜刀片牆（三角稜柱）
    planter(mb, -8.6, -4.6, 6.4, 7.4, 0.6, 331)
    return mb.build('hm3' + ('_lo' if LO else ''))


def hm4():   # 鋼構斜撐屋：木平台由黑色鋼桁架架在坡上，兩層玻璃屋、赤陶色牆片突出屋頂、木格柵，平台一角玻璃側壁的按摩池、沙發與火盆
    mb = MB(34)
    B(mb, -10, 10, -15, 5, -0.5, 0.0, M['steel']); B(mb, -10, 10, -15, 5, 0.0, 0.2, M['deck'])
    for x in (-9.4, -3.1, 3.1, 9.4):
        for y in (-3.0, -8.5, -14.4): beam(mb, (x, y, -22), (x, y, -0.5), 0.17, M['steel'])
    if not LO:
        for y in (-3.0, -8.5, -14.4):
            for xa, xb in ((-9.4, -3.1), (-3.1, 3.1), (3.1, 9.4)):
                for za, zb in ((-0.6, -6.5), (-6.5, -12.5)):
                    beam(mb, (xa, y, za), (xb, y, zb), 0.09, M['steel']); beam(mb, (xb, y, za), (xa, y, zb), 0.09, M['steel'])
                beam(mb, (xa, y, -6.5), (xb, y, -6.5), 0.1, M['steel'])
        for x in (-9.4, -3.1, 3.1, 9.4):
            for ya, yb in ((-3.0, -8.5), (-8.5, -14.4)):
                beam(mb, (x, ya, -0.6), (x, yb, -7.0), 0.09, M['steel']); beam(mb, (x, yb, -0.6), (x, ya, -7.0), 0.09, M['steel'])
    if LO:
        glass(mb, 'x', -11.0, -8, 6, 0.2, 3.5, -1, 1.55); glass(mb, 'y', 6.0, -11, 1.5, 0.2, 3.5, 1); glass(mb, 'y', -8.0, -11, 1.5, 0.2, 3.5, -1)
        B(mb, -8, 6, -1.0, 1.5, 0.2, 7.2, M['white']); glass(mb, 'x', 1.5, -4, 4, 0.2, 2.6, 1)
        B(mb, -8, 6, -11, 1.5, 3.5, 3.9, M['fascia'])
        glass(mb, 'x', -11.0, -8, 6, 3.9, 7.2, -1, 1.55); glass(mb, 'y', 6.0, -11, -1.0, 3.9, 7.2, 1); glass(mb, 'y', -8.0, -11, -1.0, 3.9, 7.2, -1)
        B(mb, -8.5, -7.6, -11.6, 2.0, 0.2, 8.4, M['terra']); B(mb, 5.6, 6.5, -11.6, 2.0, 0.2, 8.4, M['terra'])   # 赤陶色牆片
        B(mb, -2.5, 3.5, 1.5, 1.6, 3.9, 7.2, M['slat'])
    else:   # 兩側山牆是赤陶色實牆（開窗），前後與屋頂上方突出成牆片
        shell(mb, 'hm4', ext_m=lambda L, s, ax, c: 'terra' if ax == 'y' and (abs(c + 8) < 0.01 or abs(c - 6) < 0.01) else None)
        slab(mb, -8.12, 6.12, -11.12, 1.62, 3.5, 0.4, M['fascia'], holes=holes('hm4', 1))
        for xa, xb in ((-8.5, -7.6), (5.6, 6.5)):
            B(mb, xa, xb, -11.6, -11.12, 0.2, 8.4, M['terra']); B(mb, xa, xb, 1.62, 2.0, 0.2, 8.4, M['terra']); B(mb, xa, xb, -11.12, 1.62, 7.5, 8.4, M['terra'])
        B(mb, -2.5, 3.5, 1.62, 1.72, 3.9, 7.2, M['slat'])
    slab(mb, -9.0, 7.0, -12.4, 2.6, 7.2, 0.3, M['fascia'], [(-8.8, 6.8, -12.3, -11.1)], top=M['board_d'])
    B(mb, 6.6, 9.8, -14.6, -10.6, 0.2, 0.55, M['trav']); B(mb, 6.9, 9.5, -14.3, -10.9, -1.0, 0.45, M['water'])   # 按摩池：側壁是透光的水
    if not LO: B(mb, 6.85, 9.55, -14.35, -10.85, -1.05, 0.2, M['rail'])
    sofa(mb, -7.5, -4.8, -14.6, -13.6); sofa(mb, -3.6, -1.0, -14.6, -13.6); sofa(mb, -9.6, -8.6, -14.0, -11.6)
    if not LO: B(mb, -6.0, -4.6, -12.8, -12.0, 0.2, 0.5, M['board_d']); B(mb, -5.9, -4.7, -12.7, -12.1, 0.5, 0.53, M['fire'])
    rail(mb, -9.95, -14.95, 9.95, -14.95, 0.2); rail(mb, -9.95, -14.95, -9.95, 4.9, 0.2); rail(mb, 9.95, -14.95, 9.95, 4.9, 0.2)
    planter(mb, -9.6, -6.4, 3.4, 4.6, 0.6, 341); planter(mb, 6.6, 9.6, 3.4, 4.6, 0.6, 342)
    return mb.build('hm4' + ('_lo' if LO else ''))


def hm5():   # 地中海莊園：兩層主樓＋兩側一層翼樓、四坡赤陶筒瓦、入口塔（洞石拱門）、西翼前的柱廊、鐵欄陽台，前庭洞石鋪面的迴車道與三層噴水池
    mb = MB(35)
    def hip(x0, x1, y0, y1, zb, pitch=24, oh=0.6, ring=False):
        """四坡屋頂；ring（細模、底下是有室內的牆）時底面只做出簷那一圈斜的簷底（裡面是天花板），簷下的洞石線腳也只在牆外"""
        A, Bh = (x1 - x0) / 2 + oh, (y1 - y0) / 2 + oh; cx, cy = (x0 + x1) / 2, (y0 + y1) / 2; tp = math.tan(math.radians(pitch))
        ze, zr = zb - oh * tp, zb + (min(x1 - x0, y1 - y0) / 2) * tp
        ring = ring and not LO
        inner = [(x0, y0, zb), (x1, y0, zb), (x1, y1, zb), (x0, y1, zb)]
        bot = [(0, 1, 7, 6), (1, 2, 8, 7), (2, 3, 9, 8), (3, 0, 6, 9)] if ring else [(0, 1, 2, 3)]
        if A >= Bh:
            rl = A - Bh; v = [(cx - A, cy - Bh, ze), (cx + A, cy - Bh, ze), (cx + A, cy + Bh, ze), (cx - A, cy + Bh, ze), (cx - rl, cy, zr), (cx + rl, cy, zr)]
            mb.add(v + inner, [(3, 2, 5, 4), (1, 0, 4, 5), (0, 3, 4), (2, 1, 5)] + bot, M['tile'])
        else:
            rl = Bh - A; v = [(cx - A, cy - Bh, ze), (cx + A, cy - Bh, ze), (cx + A, cy + Bh, ze), (cx - A, cy + Bh, ze), (cx, cy - rl, zr), (cx, cy + rl, zr)]
            mb.add(v + inner, [(0, 4, 5, 3), (2, 5, 4, 1), (1, 4, 0), (3, 5, 2)] + bot, M['tile'])
        if LO: return
        if not ring: B(mb, cx - A + 0.3, cx + A - 0.3, cy - Bh + 0.3, cy + Bh - 0.3, zb - 0.25, zb, M['trav']); return   # 簷下的線腳
        o, i = 0.3, 0.1
        B(mb, x0 - o, x1 + o, y0 - o, y0 - i, zb - 0.25, zb, M['trav']); B(mb, x0 - o, x1 + o, y1 + i, y1 + o, zb - 0.25, zb, M['trav'])
        B(mb, x0 - o, x0 - i, y0 - i, y1 + i, zb - 0.25, zb, M['trav']); B(mb, x1 + i, x1 + o, y0 - i, y1 + i, zb - 0.25, zb, M['trav'])
    def arch(fy, u, z0, ww, wh, m, o0=-0.03, o1=0.04, seg=8):   # 拱形（下方矩形＋上方半圓）的薄片，在 y = fy 的牆面
        pts = [(u - ww / 2, z0), (u + ww / 2, z0)] + [(u + ww / 2 * math.cos(math.pi * i / seg), z0 + wh + ww / 2 * math.sin(math.pi * i / seg)) for i in range(seg + 1)]
        n = len(pts); sg = 1 if fy > 0 else -1
        v = [(a, fy + sg * o0, b) for a, b in pts] + [(a, fy + sg * o1, b) for a, b in pts]
        mb.add(v, [tuple(range(n, 2 * n)), tuple(reversed(range(n)))] + [(i, (i + 1) % n, n + (i + 1) % n, n + i) for i in range(n)], m)
    def trims(fy, u, z0, ww, wh, sill=True):   # 拱窗（門）的外框：洞石窗台、兩側壁柱、拱心石（貼在牆外面 fy）
        if LO: return
        sg = 1 if fy > 0 else -1; yy = sorted((fy, fy + sg * 0.12)); yk = sorted((fy, fy + sg * 0.08))
        if sill: B(mb, u - ww / 2 - 0.15, u + ww / 2 + 0.15, *yy, z0 - 0.12, z0, M['trav'])
        B(mb, u - 0.13, u + 0.13, *yk, z0 + wh + ww / 2 - 0.06, z0 + wh + ww / 2 + 0.32, M['trav'])
        for s in (-1, 1): B(mb, u + s * (ww / 2 + 0.02) - 0.08, u + s * (ww / 2 + 0.02) + 0.08, *yk, z0, z0 + wh, M['trav'])
    def awin(fy, u, z0, ww, wh, door=False):   # 拱窗（遠景低模、塔上的裝飾窗）：玻璃（或木門）＋外框
        arch(fy, u, z0, ww, wh, M['slat_d'] if door else M['vglass'])
        trims(fy, u, z0, ww, wh)
    def ironbal(y, u, z, w):   # 洞石托板＋鑄鐵欄杆的小陽台
        if LO: return
        B(mb, u - w / 2, u + w / 2, y, y + 0.7, z - 0.15, z, M['trav'])
        B(mb, u - w / 2, u + w / 2, y + 0.66, y + 0.7, z + 0.95, z + 1.0, M['iron'])
        k = int(w / 0.14)
        for i in range(k + 1): x = u - w / 2 + i * w / k; B(mb, x - 0.012, x + 0.012, y + 0.66, y + 0.69, z, z + 0.96, M['iron'])
    if LO:
        B(mb, -8, 8, -5, 5, 0, 7.2, M['stucco']); B(mb, -15, -8, -4.5, 4.5, 0, 4.0, M['stucco']); B(mb, 8, 15, -4.5, 4.5, 0, 4.0, M['stucco'])
        B(mb, -2.2, 2.2, 4.0, 6.2, 0, 9.0, M['stucco'])   # 入口塔
        arch(6.2, 0, 0.05, 1.8, 2.3, M['trav'], 0.0, 0.18); arch(6.2, 0, 0.05, 1.4, 2.1, M['slat_d'], 0.15, 0.21)
        for u in (-6.0, -3.8, 3.8, 6.0): awin(5.0, u, 0.6, 1.3, 1.9); awin(5.0, u, 4.3, 1.1, 1.5)
        for u in (-6.0, -3.0, 0.0, 3.0, 6.0): awin(-5.0, u, 0.6, 1.3, 1.9); awin(-5.0, u, 4.3, 1.1, 1.5)
        for u in (10.3, 12.7): awin(4.5, u, 0.6, 1.3, 1.9)
        for u in (-12.7, -10.3, 10.3, 12.7): awin(-4.5, u, 0.6, 1.3, 1.9)
        awin(4.5, -11.5, 0.05, 1.5, 2.1, door=True)
        tw = 6.2
    else:
        shell(mb, 'hm5', arch=True, solid_stair=True, plinth=(0.5, M['trav']), frame=M['slat_d'])
        slab(mb, -8.12, 8.12, -5.12, 5.12, 3.6, 0.15, M['stucco'], holes=holes('hm5', 1))   # 主樓二樓樓板
        slab(mb, -8.12, 8.12, -5.12, 5.12, 7.08, 0.12, M['stucco'])   # 主樓天花（上面是屋頂，頂面齊屋簷線）
        for x0, x1 in ((-15.12, -8.12), (8.12, 15.12)): slab(mb, x0, x1, -4.62, 4.62, 3.6, 0.4, M['stucco'])   # 翼樓天花
        B(mb, -2.32, 2.32, 4.88, 6.32, 3.6, 9.0, M['stucco'])   # 入口塔一樓以上（實心）
        tw = 6.32
        for lv in WALLS['hm5']['levels']:   # 門窗外框：照平面圖的窗與外牆上的門
            for wn in lv['windows']:
                if wn['ax'] == 'x': trims(wn['y'] + (0.12 if wn['y'] > 0 else -0.12), wn['x'], lv['z'] + wn['sill'], wn['w'], wn['h'])
            for d in lv['doors']:
                if d['ax'] == 'x' and d['kind'] in ('french', 'front') and None in d['rooms']:
                    fy = d['y'] + (0.12 if d['y'] > 0 else -0.12); hd = min(HEAD[d['kind']], lv['h'] - 0.15 - d['w'] / 2)
                    trims(fy, d['x'], lv['z'] + 0.03, d['w'], hd, sill=False)
    if LO: B(mb, -15.04, 15.04, -5.04, 5.04, 0, 0.5, M['trav'])   # 洞石勒腳（細模由 shell 的 plinth 沿外牆做）
    hip(-8, 8, -5, 5, 7.2, ring=True); hip(-15, -8, -4.5, 4.5, 4.0, ring=True); hip(8, 15, -4.5, 4.5, 4.0, ring=True); hip(-2.2, 2.2, 4.0, 6.2, 9.0, 26, 0.45)
    awin(tw, 0, 4.6, 1.2, 1.4); awin(tw, 0, 7.4, 0.6, 0.5)   # 入口塔上的拱窗（塔是實心的，只是窗面）
    ironbal(5.12 if not LO else 5.0, -4.9, 4.2 if LO else 3.75, 3.6); ironbal(5.12 if not LO else 5.0, 4.9, 4.2 if LO else 3.75, 3.6)
    B(mb, -15, -8, 4.5, 7.2, 3.3, 3.9, M['stucco'])   # 西翼前的柱廊：五根洞石柱、廊頂、矮坡屋頂
    for k in range(5): x = -14.6 + k * 1.6; B(mb, x - 0.2, x + 0.2, 6.75, 7.15, 0, 3.3, M['trav'])
    hip(-15, -8, 4.5, 7.2, 3.9, 18, 0.35)
    for x, y, h in ((5.0, -2.5, 9.8), (-12.0, 2.0, 5.8)):   # 煙囪（從天花板上面開始，不穿過房間）
        B(mb, x - 0.45, x + 0.45, y - 0.45, y + 0.45, (7.32 if h > 7 else 4.0) if not LO else (5.0 if h > 7 else 3.0), h, M['stucco'])
        if not LO: B(mb, x - 0.6, x + 0.6, y - 0.6, y + 0.6, h, h + 0.15, M['trav']); hip(x - 0.4, x + 0.4, y - 0.4, y + 0.4, h + 0.45, 30, 0.15)
    # 前庭：洞石鋪面的迴車道、三層水盤的圓形噴水池、兩側花台
    B(mb, -15, 15, 6.2, 15.5, 0, 0.05, M['trav'])
    mb.cyl_z(0, 11.4, 0.05, 0.55, 2.6, 20, M['trav']); mb.cyl_z(0, 11.4, 0.55, 0.57, 2.35, 20, M['water'])
    if not LO:
        mb.cyl_z(0, 11.4, 0.55, 1.6, 0.25, 10, M['trav']); mb.cyl_z(0, 11.4, 1.6, 1.8, 1.2, 14, M['trav']); mb.cyl_z(0, 11.4, 1.78, 1.81, 1.05, 14, M['water'])
        mb.cyl_z(0, 11.4, 1.8, 2.6, 0.14, 8, M['trav']); mb.cyl_z(0, 11.4, 2.6, 2.75, 0.6, 12, M['trav']); mb.cyl_z(0, 11.4, 2.74, 2.76, 0.5, 12, M['water'])
        for x0 in (-14.5, 9.5):
            B(mb, x0, x0 + 5, 13.5, 15.2, 0, 0.6, M['trav']); leafy(mb, x0 + 1.3, 14.35, 0.95, 0.6, M['shrub'], 351 + int(x0)); leafy(mb, x0 + 3.6, 14.35, 0.95, 0.6, M['bloom'], 352 + int(x0))
    return mb.build('hm5' + ('_lo' if LO else ''))


# ─────────────────────────────── 植栽與岩石（10-city.js 沿平台與坡撒） ───────────────────────────────
def palm():   # 海棗：微彎、一節節的樹幹（底粗頂細），頂上 13 片往外拱又垂下的羽葉（兩側一排小葉、V 形下垂）、葉鞘
    mb = MB(41); rnd = random.Random(41); H = 10.0; R, seg = 22, 8
    ring = lambda k: [(0.5 * (H * k / R / H) ** 2 + (0.34 - 0.12 * k / R) * (1.07 if k % 2 == 0 else 1.0) * math.cos(2 * math.pi * i / seg),
                       (0.34 - 0.12 * k / R) * (1.07 if k % 2 == 0 else 1.0) * math.sin(2 * math.pi * i / seg), H * k / R) for i in range(seg)]
    v = [p for k in range(R + 1) for p in ring(k)]
    fs = [(k * seg + i, k * seg + (i + 1) % seg, (k + 1) * seg + (i + 1) % seg, (k + 1) * seg + i) for k in range(R) for i in range(seg)]
    fs += [tuple(reversed(range(seg))), tuple(range(R * seg, (R + 1) * seg))]
    mb.add(v, fs, M['trunk'])
    tx, tz = 0.5, H
    for i in range(13):
        ph = i * 2.39996; L = 3.6 + 0.6 * rnd.random(); e0 = 0.75 - 0.25 * (i % 3); a = (1.6 + 0.4 * rnd.random()) / L
        K = 9; side = []
        for j in range(1, K + 1):
            s = L * j / (K + 1); w = 0.55 * math.sin(math.pi * s / L) + 0.08
            side += [(s - L * 0.06, 0.05), (s + L * 0.04, w)]
        out = [(0, 0.04)] + side + [(L, 0)] + [(sv, -w) for sv, w in reversed(side)] + [(0, -0.04)]
        cp, sp, lat = math.cos(ph), math.sin(ph), (-math.sin(ph), math.cos(ph))
        pts = []
        for sv, w in out:
            r_, h_ = (math.sin(e0) - math.sin(e0 - a * sv)) / a, (math.cos(e0 - a * sv) - math.cos(e0)) / a
            pts.append((tx + cp * r_ + lat[0] * w, sp * r_ + lat[1] * w, tz + h_ - 0.35 * abs(w)))
        k = len(pts)
        mb.add(pts + [(px, py, pz + 0.03) for px, py, pz in pts], [tuple(reversed(range(k))), tuple(range(k, 2 * k))] + [(j, (j + 1) % k, k + (j + 1) % k, k + j) for j in range(k)], M['frond'])
    mb.cyl_z(tx, 0, H - 0.9, H + 0.1, 0.42, 10, M['trunk'])
    return mb.build('palm')


def palm_lo():   # 遠景：六角柱的樹幹、八片厚三角的葉叢（都比細模小一號，近處兩者重疊時藏在細模裡）
    mb = MB(42); H = 10.0
    mb.cyl_z(0.25, 0, 0, H - 0.3, 0.19, 6, M['trunk'])
    for i in range(8):
        ph = i * math.pi / 4; c, s = math.cos(ph), math.sin(ph)
        v = [(0.5, 0, H - 0.3), (0.5 + c * 3.0 - s * 0.5, s * 3.0 + c * 0.5, H - 1.3), (0.5 + c * 3.0 + s * 0.5, s * 3.0 - c * 0.5, H - 1.3)]
        mb.add(v + [(x, y, z + 0.06) for x, y, z in v], [(0, 1, 2), (5, 4, 3), (0, 3, 4, 1), (1, 4, 5, 2), (2, 5, 3, 0)], M['frond'])
    return mb.build('palm_lo')


def fir_lo():   # 外緣山林的遠景冷杉（近景是 forest.py 的 fir，27-props.js 下載後只畫在近景半徑外）：六角樹幹、三層八角錐的樹冠，暗綠
    mb = MB(47)
    mb.cyl_z(0, 0, 0, 16.0, 0.22, 6, M['trunk'])
    for z0, z1, r in ((1.8, 9.5, 3.7), (6.0, 14.0, 2.7), (10.5, 18.6, 1.6)):
        ring = [(r * math.cos(2 * math.pi * i / 8), r * math.sin(2 * math.pi * i / 8), z0) for i in range(8)]
        mb.add(ring + [(0, 0, z1)], [(i, (i + 1) % 8, 8) for i in range(8)] + [tuple(reversed(range(8)))], M['fir'])
    return mb.build('fir_lo')


def maple_lo():   # 遠景楓樹：樹幹＋三團起伏的樹冠（橘紅、深紅、橘黃，一棵樹上就有漸層），大小照 forest.py 的 maple
    mb = MB(48)
    mb.cyl_z(0, 0, 0, 5.0, 0.24, 6, M['trunk'])
    leafy(mb, 0, 0, 6.4, 3.9, M['maple'], 52, 1, 0.95); leafy(mb, 1.2, -0.9, 8.7, 2.8, M['maple_d'], 53, 1, 0.9); leafy(mb, -1.4, 1.0, 7.8, 2.6, M['maple_o'], 54, 1, 0.9)
    return mb.build('maple_lo')


def karst(seed, H, R0):   # 遠景的石柱峰（張家界那樣）：細高（高是寬的四到七倍）的石灰岩柱，截面是幾塊岩體拼的（稜角、縱向的深溝），往上略收、
    # 一段段的層理（每 9–14 m 往裡縮一圈）、頂上參差的岩頂長滿深色的松叢，層理平台上也零星有。岩面的紋（裂隙、水痕、苔）在 07-kitx.js 的 51。
    # 21-coast.js 放大 1.3–3.6 倍擺在外緣山林後面的盆地，下半截泡在雲海裡
    rnd = random.Random(seed); mb = MB(seed); seg, lv = 18, 44
    ph = [rnd.random() * 6.283 for _ in range(10)]
    bands = []; z = 0.0
    while z < H: z += 9 + 5 * rnd.random(); bands.append(z)
    def rad(t, zz):
        f = zz / H
        r = R0 * (1 - 0.22 * f) * (1 + 0.08 * math.sin(zz * 0.06 + ph[0]))
        r *= 1 + 0.15 * math.sin(2 * t + ph[1] + zz * 0.012) + 0.12 * abs(math.sin(3 * t + ph[2])) + 0.07 * math.sin(5 * t + ph[3] + zz * 0.03)
        r *= 1 - 0.14 * abs(math.sin(4.5 * t + ph[4] + 0.004 * zz)) ** 10 - 0.1 * abs(math.sin(7 * t + ph[5])) ** 14   # 縱向的深溝（岩體之間的裂隙）
        for bb in bands:   # 層理：每條層線下方 1.4 m 往裡凹
            if 0 < bb - zz < 1.4: r *= 0.9
        return r
    rows = []
    for k in range(lv + 1):
        zz = H * k / lv
        rows.append([(rad(2 * math.pi * i / seg, zz) * math.cos(2 * math.pi * i / seg), rad(2 * math.pi * i / seg, zz) * math.sin(2 * math.pi * i / seg), zz) for i in range(seg)])
    # 岩頂：往裡收一圈、高低參差
    rows.append([(x * 0.8, y * 0.8, H + 1.5 + 2.5 * rnd.random()) for x, y, _ in rows[lv]])
    v = [p for r in rows for p in r]
    fs = [(k * seg + i, k * seg + (i + 1) % seg, (k + 1) * seg + (i + 1) % seg, (k + 1) * seg + i) for k in range(len(rows) - 1) for i in range(seg)]
    v.append((0, 0, H + 3.0)); c = len(v) - 1; top = (len(rows) - 1) * seg
    fs += [(top + i, top + (i + 1) % seg, c) for i in range(seg)]
    mb.add(v, fs, M['karst'])
    def pine(x, y, z0, h):   # 一棵小松（八角錐兩層），貼在岩上
        for zb, zt, r in ((z0 + h * 0.15, z0 + h * 0.7, h * 0.32), (z0 + h * 0.45, z0 + h, h * 0.22)):
            ring = [(x + r * math.cos(2 * math.pi * i / 6), y + r * math.sin(2 * math.pi * i / 6), zb) for i in range(6)]
            mb.add(ring + [(x, y, zt)], [(i, (i + 1) % 6, 6) for i in range(6)], M['fir'])
    for i in range(int(14 + R0)):   # 岩頂的松林
        a = rnd.random() * 6.283; rr = R0 * 0.75 * math.sqrt(rnd.random())
        pine(math.cos(a) * rr, math.sin(a) * rr, H + 1.5, 5 + 5 * rnd.random())
    for i in range(4):
        a = rnd.random() * 6.283; rr = R0 * 0.5 * rnd.random()
        leafy(mb, math.cos(a) * rr, math.sin(a) * rr, H + 3, R0 * (0.25 + 0.1 * rnd.random()), M['fir'], seed * 10 + i, 1, 0.5)
    for bb in bands[:-1]:   # 層理平台與岩縫裡的松
        for _ in range(3):
            if rnd.random() < 0.45: continue
            a = rnd.random() * 6.283; r = rad(a, bb) * 0.97
            pine(math.cos(a) * r, math.sin(a) * r, bb - 0.5, 3 + 4 * rnd.random())
    return mb.build(f'karst{seed % 10}', smooth=True)


def plants():
    out = []
    mb = MB(43); agave(mb, 0, 0, 0, 1.0, 43, 20); out.append(mb.build('agave'))
    mb = MB(44); leafy(mb, 0, 0, 0.55, 0.75, M['shrub'], 44); leafy(mb, 0.6, 0.3, 0.45, 0.55, M['shrub'], 45); leafy(mb, -0.5, 0.4, 0.4, 0.5, M['shrub'], 46); out.append(mb.build('shrub'))
    mb = MB(45); leafy(mb, 0, 0, 0.5, 0.7, M['shrub'], 47); leafy(mb, 0.35, 0.2, 0.9, 0.45, M['bloom'], 48); leafy(mb, -0.3, -0.25, 0.85, 0.4, M['bloom'], 49); out.append(mb.build('shrub_bloom'))
    mb = MB(46); leafy(mb, 0, 0, 0.35, 1.0, M['rock'], 50, 1, 0.55); leafy(mb, 0.9, 0.4, 0.2, 0.6, M['rock'], 51, 1, 0.5); out.append(mb.build('rock'))
    return out


# ─── 細模的收尾：倒角、加密、烘 AO ───
# 稜角（兩面夾角 > 28°）倒 2.5 cm 的斜角（方盒的邊接到光才不像積木）；再每 STEP 公尺沿 x、y、z 切一刀，頂點夠密才帶得住 AO；
# 最後 Cycles 把環境遮蔽（2.5 m 內）烘進每個面角的頂點色 ao（CORNER，再收成 0.3–1），匯出成 COLOR_0，遊戲（50-assets.js 的 bakeProp）乘在底色上：
# 樓板下、牆腳、牆角、欄杆後面暗下來。烘的時候底下墊一塊平台大小的地板（遊戲裡房子坐在平台上）。遠景低模與植栽不做
FOOT = {   # 平台面（Blender 座標 x0, x1, y0, y1）：10-city.js 的 HOME_V 核心佔地外擴 0.6 m、正面多 3 m 前院
    'hm1': (-9.8, 10.2, -5.6, 9.4), 'hm2': (-9.8, 9.8, -5.6, 10.6), 'hm3': (-12.8, 10.4, -7.4, 10.4), 'hm4': (-10.6, 10.6, -3.6, 8.0), 'hm5': (-16.2, 16.2, -6.2, 18.5),
}


STEP = 2.0   # 加密的間距（公尺）：1 m 時 GLB 從 1.3 MB 變 16 MB


def finish(o):
    bm = bmesh.new(); bm.from_mesh(o.data)
    sharp = [e for e in bm.edges if len(e.link_faces) == 2 and e.calc_face_angle(0) > 0.49]
    bmesh.ops.bevel(bm, geom=sharp, offset=0.025, offset_type='OFFSET', segments=1, profile=0.5, affect='EDGES', clamp_overlap=True)
    lo = [min(v.co[k] for v in bm.verts) for k in range(3)]; hi = [max(v.co[k] for v in bm.verts) for k in range(3)]
    for k in range(3):
        c = math.floor(lo[k] / STEP) * STEP + STEP
        while c < hi[k]:
            co = [0.0, 0.0, 0.0]; no = [0.0, 0.0, 0.0]; co[k] = c; no[k] = 1.0
            bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], dist=1e-4, plane_co=co, plane_no=no)
            c += STEP
    bm.to_mesh(o.data); bm.free(); o.data.update()


def bake_ao(objs):
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = 64
    sc.render.bake.target = 'VERTEX_COLORS'
    if sc.world is None: sc.world = bpy.data.worlds.new('bake')   # reset() 清掉了預設的 world
    sc.world.light_settings.distance = 2.5
    for o in objs:
        x0, x1, y0, y1 = FOOT[o.name]
        bpy.ops.mesh.primitive_plane_add(size=1, location=(o.location.x + (x0 + x1) / 2, o.location.y + (y0 + y1) / 2, -0.01))
        gnd = bpy.context.active_object; gnd.scale = (x1 - x0, y1 - y0, 1)
        ca = o.data.color_attributes.new('ao', 'BYTE_COLOR', 'CORNER')
        o.data.color_attributes.active_color = ca; o.data.color_attributes.render_color_index = o.data.color_attributes.active_color_index
        bpy.ops.object.select_all(action='DESELECT'); o.select_set(True); bpy.context.view_layer.objects.active = o
        bpy.ops.object.bake(type='AO')
        bpy.data.objects.remove(gnd, do_unlink=True)
        # 壓暗收斂：0.3 + 0.7 × ao^0.8（凹進去的車庫門、樓板下不要黑成一片）
        n = len(ca.data); buf = [0.0] * (n * 4); ca.data.foreach_get('color', buf)
        for i in range(n):
            a = 0.3 + 0.7 * max(buf[i * 4], 0.0) ** 0.8; buf[i * 4] = buf[i * 4 + 1] = buf[i * 4 + 2] = a
        ca.data.foreach_set('color', buf)
        print(f'ao  {o.name}  {len(o.data.polygons)} faces')


x = 0.0
detail, glassy = [], []
for f in (hm1, hm2, hm3, hm4, hm5):
    LO = False; GB = MB(60 + int(x)); o = f(); o.location = (x, 0, 0); finish(o); detail.append(o)
    g = GB.build(o.name + '_gl'); g.location = (x, 0, 0); glassy.append(g)
    d = DMB[o.name].build(o.name + '_doors'); d.location = (x, 0, 0); g = DGB[o.name].build(o.name + '_doors_g'); g.location = (x, 0, 0)
    LO = True; GB = None; o = f(); o.location = (x, 40.0, 0)
    for v in o.data.vertices: v.co *= 0.99
    x += 40.0
LO = False
for i, o in enumerate([palm(), palm_lo(), fir_lo(), maple_lo()] + plants()): o.location = (i * 8.0, -40.0, 0)
for i, o in enumerate([karst(51, 100, 9), karst(52, 110, 12), karst(53, 120, 7.5), karst(54, 90, 14)]): o.location = (i * 80.0, -120.0, 0)
doorish = [o for o in bpy.data.objects if '_dr' in o.name or o.name.endswith(('_doors', '_doors_g'))]
for g in glassy + doorish: g.hide_render = True   # 烘 AO 時玻璃與門扇不擋光
bake_ao(detail)
for g in glassy + doorish: g.hide_render = False
json.dump(DOORS, open(os.path.join(OUT, 'villa_doors.json'), 'w', encoding='utf-8'), separators=(',', ':'))
print('DOORS', {k: len(v) for k, v in DOORS.items()})
export_glb('hill_homes.glb', export_vertex_color='ACTIVE')
