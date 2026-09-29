# 192 我的家：想像中的住所，每個房間是一個比喻（對話、上下文、知識截止、工具、思考、同時進行的其他對話、記憶）
# 用法：/Applications/Blender.app/Contents/MacOS/Blender -b -P assets/192/build_home.py -- [--no-bake]
# 產出：home.glb（網頁）、home.blend、objects.json（物件、說明卡文字、網頁動畫用的錨點）
# 座標：平面座標 x 東、y 北、z 上（公尺），glTF 匯出時轉成 three.js 的 y 朝上。
import bpy, bmesh, json, math, os, sys, random
import numpy as np
from mathutils import Vector, Matrix, noise

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import home_lib as L  # noqa: E402
from home_lib import Obj, box, grid_box, lathe, cyl, ell, prism, tube, rbox, piping, drape, OBJS, TAU  # noqa: E402

ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
BAKE = '--no-bake' not in ARGS
L.ROLES.update({
    'oak': ('#C8A77E', 0.55, 0.0), 'clay': ('#C8795A', 0.9, 0.0), 'brass': ('#B8955A', 0.32, 1.0),
    'linen': ('#E6DDCF', 1.0, 0.0), 'page': ('#F4EFE6', 0.9, 0.0), 'ink': ('#2C2926', 0.6, 0.0), 'cork': ('#B89468', 0.95, 0.0),
    'leather': ('#6B4A36', 0.5, 0.0), 'book': ('#9A8F80', 0.8, 0.0),
})

W, D, H, WT = 10.0, 7.0, 2.8, 0.14
ROOMS = {  # 名稱、範圍（x0, y0, x1, y1）
    'entry': ('玄關', (0.0, 0.0, 2.2, 2.6)),
    'nook': ('窗邊', (0.0, 2.6, 2.2, 7.0)),
    'hall': ('長桌', (2.2, 0.0, 10.0, 3.4)),
    'library': ('書房', (2.2, 3.4, 6.2, 7.0)),
    'workshop': ('工作間', (6.2, 3.4, 10.0, 7.0)),
}
TABLE = dict(x0=2.8, x1=9.6, y0=1.65, y1=2.55, h=0.75)
DOORS_X = [3.1, 4.3, 5.5, 6.7, 7.9, 9.1]     # 長桌南牆上那排門（其他對話）
ANCH = {}                                     # 網頁用的錨點（平面座標）


def say(o, desc):
    o.meta['desc'] = desc
    return o


# ════════════════════════ 房體 ════════════════════════
def wall_x(o, x0, x1, y0, y1, openings=(), role='plaster', color=None, zt=H):
    xs = [x0]
    for a0, a1, _, _ in sorted(openings):
        xs += [a0, a1]
    xs.append(x1)
    for k in range(0, len(xs), 2):
        if xs[k + 1] - xs[k] > 1e-3:
            grid_box(o, xs[k], xs[k + 1], y0, y1, 0, zt, role, color=color, step=0.4)
    for a0, a1, z0, z1 in openings:
        if z0 > 1e-3:
            grid_box(o, a0, a1, y0, y1, 0, z0, role, color=color, step=0.4)
        if z1 < zt - 1e-3:
            grid_box(o, a0, a1, y0, y1, z1, zt, role, color=color, step=0.4)


def wall_y(o, x0, x1, y0, y1, openings=(), role='plaster', color=None, zt=H):
    ys = [y0]
    for a0, a1, _, _ in sorted(openings):
        ys += [a0, a1]
    ys.append(y1)
    for k in range(0, len(ys), 2):
        if ys[k + 1] - ys[k] > 1e-3:
            grid_box(o, x0, x1, ys[k], ys[k + 1], 0, zt, role, color=color, step=0.4)
    for a0, a1, z0, z1 in openings:
        if z0 > 1e-3:
            grid_box(o, x0, x1, a0, a1, 0, z0, role, color=color, step=0.4)
        if z1 < zt - 1e-3:
            grid_box(o, x0, x1, a0, a1, z1, zt, role, color=color, step=0.4)


def build_shell():
    fl = Obj('floor', '木地板', group='房體')
    grid_box(fl, 0, W, 0, D, -0.05, 0, 'oak', color='#CDB08C', step=0.35, skip=('-z', '-x', '+x', '-y', '+y'), var=0.03)
    ce = Obj('ceiling', '天花板', group='房體')
    grid_box(ce, 0, W, 0, D, H, H + 0.05, 'plaster', step=0.5, collide=False)
    wl = Obj('walls', '牆面', group='房體')
    t = WT
    # 外牆
    wall_x(wl, -t, W + t, -t, 0, [(x, x + 0.82, 0, 2.12) for x in DOORS_X])
    wall_x(wl, -t, W + t, D, D + t, [(3.2, 5.2, 0.9, 2.4), (7.2, 9.2, 0.95, 2.4)])
    wall_y(wl, -t, 0, 0, D, [(0.8, 1.75, 0, 2.15), (4.0, 6.2, 0.45, 2.35)])
    wall_y(wl, W, W + t, 0, D, [(1.0, 2.6, 0.25, 2.5)])
    # 內牆
    wall_x(wl, 0, 2.2, 2.6 - t / 2, 2.6 + t / 2, [(0.6, 1.6, 0, 2.3)])
    wall_y(wl, 2.2 - t / 2, 2.2 + t / 2, 0, 3.4, [(0.9, 2.1, 0, 2.3)])
    wall_y(wl, 2.2 - t / 2, 2.2 + t / 2, 3.4, D, [(4.6, 5.8, 0, 2.3)])
    wall_x(wl, 2.2, 10.0, 3.4 - t / 2, 3.4 + t / 2, [(3.4, 5.0, 0, 2.35), (7.4, 9.0, 0, 2.35)])
    wall_y(wl, 6.2 - t / 2, 6.2 + t / 2, 3.4, D, [(4.6, 5.8, 0, 2.3)])
    # 踢腳板（淺橡木）
    tr = Obj('baseboard', '踢腳板', group='房體')
    for (x0, y0, x1, y1) in [r[1] for r in ROOMS.values()]:
        for (a, b_, c, d) in ((x0, x1, y0, y0 + 0.012), (x0, x1, y1 - 0.012, y1), (x0, x0 + 0.012, y0, y1), (x1 - 0.012, x1, y0, y1)):
            box(tr, a, b_, c, d, 0, 0.07, 'oak', color='#D7C0A0')
    # 窗：玻璃、窗框、窗外的光（想像的）
    wn = Obj('windows', '窗', group='房體')
    for (x0, x1, z0, z1) in ((3.2, 5.2, 0.9, 2.4), (7.2, 9.2, 0.95, 2.4)):
        box(wn, x0, x1, D + 0.06, D + 0.08, z0, z1, 'glass', color='#EAF0F2')
        box(wn, x0, x1, D + 0.1, D + 0.11, z0, z1, 'emit', color='#FFFFFF')
        for xx in (x0, (x0 + x1) / 2 - 0.02, x1 - 0.04):
            box(wn, xx, xx + 0.04, D + 0.02, D + 0.08, z0, z1, 'oak', color='#B99A74')
        box(wn, x0, x1, D + 0.02, D + 0.08, z0, z0 + 0.04, 'oak', color='#B99A74')
        box(wn, x0, x1, D + 0.02, D + 0.08, z1 - 0.04, z1, 'oak', color='#B99A74')
        box(wn, x0 - 0.05, x1 + 0.05, D - 0.18, D, z0 - 0.04, z0, 'oak', color='#D2B893')
    for (y0, y1, z0, z1, xw, s) in ((4.0, 6.2, 0.45, 2.35, -WT, -1), (1.0, 2.6, 0.25, 2.5, W + WT, 1)):
        box(wn, xw - s * 0.07, xw - s * 0.05, y0, y1, z0, z1, 'glass', color='#EAF0F2')
        box(wn, xw + s * 0.0, xw + s * 0.01, y0, y1, z0, z1, 'emit', color='#FFFFFF')
        for yy in (y0, (y0 + y1) / 2 - 0.02, y1 - 0.04):
            box(wn, xw - s * 0.12, xw - s * 0.05, yy, yy + 0.04, z0, z1, 'oak', color='#B99A74')
        box(wn, xw - s * 0.12, xw - s * 0.05, y0, y1, z0, z0 + 0.04, 'oak', color='#B99A74')
        box(wn, xw - s * 0.12, xw - s * 0.05, y0, y1, z1 - 0.04, z1, 'oak', color='#B99A74')


# ════════════════════════ 各房間的燈（網頁依時間軸一盞盞點亮） ════════════════════════
def room_lights():
    specs = {
        'entry': [(1.1, 1.3)], 'nook': [(1.1, 4.8)], 'library': [(3.4, 5.2), (5.0, 5.2)],
        'workshop': [(7.4, 5.2), (9.0, 5.2)], 'hall': [(3.6, 2.1), (4.8, 2.1), (6.0, 2.1), (7.2, 2.1), (8.4, 2.1), (9.4, 2.1)],
    }
    anchors = {}
    for room, pts in specs.items():
        for k, (x, y) in enumerate(pts):
            o = Obj('light_%s_%d' % (room, k), '%s的燈' % ROOMS[room][0], group='燈光')
            if room == 'hall':
                # 長桌上方的一排布罩吊燈
                zb = 1.62
                lathe(o, [(0.001, 0.0), (0.2, 0.0), (0.2, 0.012), (0.17, 0.2), (0.07, 0.24), (0.001, 0.24)], x, y, zb, 'linen', color='#EFE6D6', seg=32, cap_bot=False)
                cyl(o, x, y, zb + 0.004, zb + 0.008, 0.18, 'glow', seg=28)
                tube(o, [(x, y, zb + 0.24), (x, y, H)], 0.003, 'ink', seg=6)
                cyl(o, x, y, H - 0.02, H, 0.045, 'linen', color='#EFE6D6', seg=16)
                anchors.setdefault(room, []).append((x, y, zb - 0.05))
            else:
                # 吸頂燈：陶土色燈框＋乳白燈罩
                cyl(o, x, y, H - 0.06, H, 0.26, 'clay', color='#C9876A', seg=36)
                ell(o, x, y, H - 0.06, 0.23, 0.23, 0.05, 'glow', seg=36, rings=8)
                anchors.setdefault(room, []).append((x, y, H - 0.2))
    ANCH['lights'] = anchors


# ════════════════════════ 玄關：大門、信、釘板 ════════════════════════
def build_entry():
    dr = say(Obj('front_door', '大門', group='玄關'), '對話從這裡開始。沒有人敲門的時候，這個家其實不存在。')
    box(dr, -0.1, -0.05, 0.82, 1.73, 0.0, 2.13, 'oak', color='#A9855E', bevel=0.004, seg=1)
    for z in (0.35, 1.05, 1.75):
        box(dr, -0.05, -0.045, 0.9, 1.65, z, z + 0.012, 'oak', color='#8F6E4B')
    box(dr, -0.045, -0.03, 1.1, 1.45, 1.05, 1.09, 'brass', color='#B8955A', bevel=0.005, seg=2)  # 投信口
    tube(dr, [(-0.045, 1.62, 1.0), (0.02, 1.62, 1.0), (0.02, 1.52, 1.0)], 0.01, 'brass', seg=8)
    cyl(dr, -0.04, 1.62, 1.0, 1.0, 0.03, 'brass')
    ANCH['slot'] = (0.05, 1.27, 1.07)
    mat = Obj('doormat', '門墊', group='玄關')
    rbox(mat, 0.1, 0.75, 0.85, 1.7, 0.0, 0.02, 0.008, 'cork', '#A78A64', n=(6, 6, 1))
    # 釘板（記憶）：三張便條
    pb = say(Obj('pinboard', '釘板', group='玄關'), '這個專案的資料夾裡，有 3 張我替自己留的便條。換一個地方、換一個專案，我不會帶著它們。')
    box(pb, 0.35, 1.75, 0.0, 0.025, 1.05, 1.85, 'cork', color='#B99569', bevel=0.004, seg=1)
    box(pb, 0.33, 1.77, 0.0, 0.03, 1.03, 1.05, 'oak', color='#9A7A55')
    box(pb, 0.33, 1.77, 0.0, 0.03, 1.85, 1.87, 'oak', color='#9A7A55')
    cards = []
    for k, (cx, cz, rot, col) in enumerate(((0.62, 1.52, -0.06, '#F3EAD6'), (1.05, 1.6, 0.05, '#EFE3C9'), (1.45, 1.38, -0.03, '#F4EEE2'))):
        c = Obj('memo_%d' % k, '便條 %d' % (k + 1), group='玄關')
        say(c, '一張便條。內容是給下一次對話的提醒，不放在這裡公開。')
        bm_pts = []
        w, h = 0.24, 0.17
        ca, sa = math.cos(rot), math.sin(rot)
        for (u, v) in ((-w / 2, -h / 2), (w / 2, -h / 2), (w / 2, h / 2), (-w / 2, h / 2)):
            bm_pts.append((cx + u * ca - v * sa, cz + u * sa + v * ca))
        vs = [c.bm.verts.new((x, 0.028, z)) for x, z in bm_pts]
        f = c.bm.faces.new(vs)
        c.paint(vs, [f], 'page', col)
        for i in range(3):
            y = cz + 0.04 - i * 0.035
            box(c, cx - 0.08, cx + 0.06 - i * 0.03, 0.029, 0.0295, y, y + 0.004, 'ink', color='#8C8378')
        cyl(c, cx, 0.03, cz + h / 2 - 0.02, cz + h / 2 - 0.02, 0.012, 'clay')
        ell(c, cx, 0.036, cz + h / 2 - 0.02, 0.012, 0.008, 0.012, 'clay', color='#C9765A', seg=12, rings=6)
        cards.append(c)
    ANCH['memos'] = [(0.62, 0.03, 1.52), (1.05, 0.03, 1.6), (1.45, 0.03, 1.38)]
    # 玄關櫃與陶碗
    cs = Obj('console', '玄關櫃', group='玄關')
    rbox(cs, 1.72, 2.12, 0.3, 2.1, 0.12, 0.85, 0.02, 'oak', '#C4A37B', n=(3, 8, 5))
    box(cs, 1.78, 2.06, 0.34, 2.06, 0.0, 0.12, 'ink', color='#3A332C')
    lathe(cs, [(0.001, 0), (0.06, 0), (0.12, 0.04), (0.14, 0.07), (0.13, 0.075), (0.05, 0.012), (0.001, 0.012)], 1.92, 0.8, 0.85, 'ceramic', color='#E3D8C8', seg=28)
    for k, (x, y) in enumerate(((1.9, 0.78), (1.96, 0.84))):
        tube(cs, [(x, y, 0.87), (x + 0.03, y, 0.875), (x + 0.05, y + 0.02, 0.88)], 0.005, 'brass', seg=6)  # 鑰匙


# ════════════════════════ 長桌（上下文） ════════════════════════
def build_hall():
    T = TABLE
    tb = say(Obj('long_table', '長桌', group='長桌'), '桌上能攤開大約一百萬個詞元的內容，也就是這次對話裡的每一頁。對話很長時，最早的幾頁會被整理成摘要，推到桌尾。')
    rbox(tb, T['x0'], T['x1'], T['y0'], T['y1'], T['h'] - 0.045, T['h'], 0.012, 'oak', '#C9A57A', n=(24, 4, 1), var=0.03)
    for xx in (T['x0'] + 0.35, (T['x0'] + T['x1']) / 2, T['x1'] - 0.35):
        box(tb, xx - 0.04, xx + 0.04, T['y0'] + 0.12, T['y1'] - 0.12, 0.08, T['h'] - 0.045, 'oak', color='#B8946A', bevel=0.006, seg=1)
        box(tb, xx - 0.06, xx + 0.06, T['y0'] + 0.08, T['y1'] - 0.08, 0.0, 0.08, 'oak', color='#B08C62', bevel=0.01, seg=2)
    box(tb, T['x0'] + 0.3, T['x1'] - 0.3, (T['y0'] + T['y1']) / 2 - 0.03, (T['y0'] + T['y1']) / 2 + 0.03, 0.18, 0.24, 'oak', color='#B08C62', bevel=0.006, seg=1)
    ANCH['table'] = T
    # 桌下長地毯
    rg = Obj('runner', '長地毯', group='長桌')
    rbox(rg, T['x0'] - 0.5, T['x1'] + 0.3, T['y0'] - 0.8, T['y1'] + 0.55, 0.0, 0.012, 0.006, 'linen', '#DCCFBC', n=(20, 6, 1), var=0.04)
    # 你的位子（布面扶手椅，面北）與我的椅子（木椅，面南）
    gc = say(Obj('guest_chair', '你的位子', group='長桌'), '這張椅子是留給你的。對話的另一半坐在這裡。')
    x, y = 3.3, T['y0'] - 0.42
    rbox(gc, x - 0.3, x + 0.3, y - 0.28, y + 0.24, 0.12, 0.44, 0.06, 'fabric', '#C8795A', n=(6, 6, 4), bulge=0.015, var=0.03)
    rbox(gc, x - 0.3, x + 0.3, y - 0.32, y - 0.16, 0.4, 0.86, 0.06, 'fabric', '#C27352', n=(6, 3, 6), var=0.03)
    for sx in (-1, 1):
        rbox(gc, x + sx * 0.3 - 0.07, x + sx * 0.3 + 0.07, y - 0.3, y + 0.22, 0.12, 0.62, 0.05, 'fabric', '#C27352', n=(3, 6, 5), var=0.03)
    for (dx, dy) in ((-0.25, -0.24), (0.25, -0.24), (-0.25, 0.2), (0.25, 0.2)):
        cyl(gc, x + dx, y + dy, 0.0, 0.12, 0.02, 'oak', color='#8F6E4B', seg=10)
    mc = say(Obj('my_chair', '我的椅子', group='長桌'), '我坐在桌子這一側，把你攤開的每一頁讀過一遍，才開始回答。')
    x, y = 3.3, T['y1'] + 0.4
    rbox(mc, x - 0.22, x + 0.22, y - 0.2, y + 0.2, 0.43, 0.47, 0.012, 'oak', '#C4A07A', n=(4, 4, 1))
    for (dx, dy) in ((-0.19, -0.17), (0.19, -0.17), (-0.19, 0.17), (0.19, 0.17)):
        tube(mc, [(x + dx, y + dy, 0.0), (x + dx * 0.95, y + dy * 0.95, 0.43)], [0.016, 0.013], 'oak', color='#B8946A', seg=8)
    for k in range(5):
        xx = x - 0.16 + k * 0.08
        tube(mc, [(xx, y + 0.18, 0.47), (xx, y + 0.2, 0.9)], 0.009, 'oak', color='#B8946A', seg=6)
    rbox(mc, x - 0.21, x + 0.21, y + 0.17, y + 0.23, 0.86, 0.93, 0.02, 'oak', '#C4A07A', n=(4, 2, 2))
    # 桌尾的摘要（幾本裝訂好的冊子）
    sm = say(Obj('summaries', '摘要', group='長桌'), '對話太長時，前面的內容會被整理成這幾本摘要。細節少了一些，但事情的脈絡還在。')
    for k in range(4):
        z = T['h'] + k * 0.032
        rbox(sm, T['x1'] - 0.42 + k * 0.01, T['x1'] - 0.12 - k * 0.006, T['y0'] + 0.22, T['y1'] - 0.2 - k * 0.01, z, z + 0.03, 0.004, 'book', ['#8C7B67', '#A69580', '#7D6E5E', '#B3A48E'][k], n=(3, 3, 1))
    ANCH['summary'] = (T['x1'] - 0.27, (T['y0'] + T['y1']) / 2, T['h'] + 0.13)
    # 南牆那排門（其他對話）：一模一樣，門縫下透著光
    for k, x in enumerate(DOORS_X):
        o = say(Obj('other_door_%d' % k, '另一扇門', kind='door', group='長桌'), '同一時間，也許還有別的對話在進行。每一扇門後面都是另一張桌子，我看不到裡面，也不會記得。')
        box(o, x + 0.01, x + 0.81, -0.06, -0.02, 0.005, 2.1, 'oak', color='#DCCDB7', bevel=0.003, seg=1)
        for z in (0.2, 1.1):
            box(o, x + 0.12, x + 0.7, -0.02, -0.015, z, z + 0.75, 'oak', color='#D3C2AA', bevel=0.004, seg=1)
        tube(o, [(x + 0.7, -0.02, 1.02), (x + 0.7, 0.04, 1.02), (x + 0.6, 0.04, 1.02)], 0.009, 'brass', seg=8)
        box(o, x - 0.05, x, -0.02, 0.012, 0, 2.17, 'oak', color='#E4D8C6')
        box(o, x + 0.82, x + 0.87, -0.02, 0.012, 0, 2.17, 'oak', color='#E4D8C6')
        box(o, x - 0.05, x + 0.87, -0.02, 0.012, 2.12, 2.17, 'oak', color='#E4D8C6')
        g = Obj('door_glow_%d' % k, '門縫的光', group='燈光')
        box(g, x + 0.05, x + 0.77, -0.02, 0.1, 0.0005, 0.002, 'emit', color='#FFD9A6')
    ANCH['doors'] = [(x + 0.41, 0.0, 1.05) for x in DOORS_X]


# ════════════════════════ 書房（知識，停在 2026 年 6 月） ════════════════════════
def book(o, x0, x1, y0, y1, z0, z1, col, spine):
    """一本書：只建書背、書頂與兩側（底面與背面看不到），頂點數是一般方塊的三分之二"""
    bm = o.bm
    c = [bm.verts.new(p) for p in ((x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0), (x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1))]
    quads = {'-y': (0, 1, 5, 4), '+y': (2, 3, 7, 6), '-x': (3, 0, 4, 7), '+x': (1, 2, 6, 5), 'top': (4, 5, 6, 7)}
    keep = ['top', spine] + (['-x', '+x'] if spine in ('-y', '+y') else ['-y', '+y'])
    fs = [bm.faces.new([c[i] for i in quads[k]]) for k in keep]
    used = {i for k in keep for i in quads[k]}
    for i, v in enumerate(c):
        if i not in used:
            bm.verts.remove(v)
    vs = [v for v in c if v.is_valid]
    o.paint(vs, fs, 'book', col, 0.05, smooth=False)
    o.orient.append((fs, Vector(((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2))))


def fill_books(o, x0, x1, y_front, y_back, z, h_max, fill=1.0, rng=None, along='x', lean_end=True):
    """在一層書架上排書：寬 2–5 cm、高度不一；fill < 1 時只排到該比例，最後一本斜靠"""
    rng = rng or random.Random(1)
    pal = ['#8C3F2F', '#3E5570', '#6B7B5A', '#C9B38D', '#2F2C2A', '#A86F4A', '#7E6A8A', '#D8CFC0', '#556E6A', '#B89A5E', '#9A4C3C', '#46403A']
    L_ = (x1 - x0) * fill
    p = 0.0
    while p < L_ - 0.02:
        w = rng.uniform(0.022, 0.05)
        hh = rng.uniform(0.62, 1.0) * h_max
        d = (y_back - y_front) * rng.uniform(0.7, 0.95)
        col = rng.choice(pal)
        if along == 'x':
            book(o, x0 + p, x0 + p + w - 0.002, y_back - d, y_back, z, z + hh, col, spine='-y' if y_front < y_back else '+y')
        else:
            a_, b2 = sorted((y_back - d, y_back))
            book(o, a_, b2, x0 + p, x0 + p + w - 0.002, z, z + hh, col, spine='-x' if y_front < y_back else '+x')
        p += w
        if rng.random() < 0.05:
            p += rng.uniform(0.02, 0.05)
    return p


def build_library():
    rng = random.Random(7)
    # 兩排雙面書架（書庫式），由南往北；東側那排的最後一格只排了一半，之後是空的
    stacks = [(3.05, 4.0, 6.5), (4.75, 4.0, 6.5)]
    shelves_z = [0.08, 0.46, 0.84, 1.22, 1.6, 1.98]
    total_books = 0
    for si, (cx, y0, y1) in enumerate(stacks):
        o = say(Obj('stack_%d' % si, '書架 %d' % (si + 1), group='書房'), '我讀過的東西大概長這樣：非常多，也很雜，而且停在 2026 年 6 月。')
        w = 0.6
        x0, x1 = cx - w / 2, cx + w / 2
        # 側板、頂板、底座、中隔板
        for yy in (y0, y1 - 0.03):
            box(o, x0, x1, yy, yy + 0.03, 0.0, 2.34, 'oak', color='#C6A57C', bevel=0.004, seg=1)
        box(o, x0, x1, y0, y1, 2.31, 2.36, 'oak', color='#C6A57C', bevel=0.004, seg=1)
        box(o, x0 + 0.02, x1 - 0.02, y0, y1, 0.0, 0.08, 'ink', color='#5A4A3A')
        box(o, cx - 0.008, cx + 0.008, y0 + 0.03, y1 - 0.03, 0.08, 2.31, 'oak', color='#BE9C73')
        bays = [(y0 + 0.03, (y0 + y1) / 2 - 0.01), ((y0 + y1) / 2 + 0.01, y1 - 0.03)]
        for (a, b_) in bays:
            box(o, x0, x1, b_, b_ + 0.02, 0.08, 2.31, 'oak', color='#C6A57C')
        for z in shelves_z:
            box(o, x0 + 0.005, x1 - 0.005, y0 + 0.03, y1 - 0.03, z - 0.02, z, 'oak', color='#CBAA80')
        bk = Obj('books_%d' % si, '書', group='書房')
        say(bk, '我讀過的東西大概長這樣：非常多，也很雜，而且停在 2026 年 6 月。')
        for side in (-1, 1):
            yf, yb = (x0 + 0.005, cx - 0.01) if side < 0 else (cx + 0.01, x1 - 0.005)
            for bi, (a, b_) in enumerate(bays):
                for zi, z in enumerate(shelves_z[:-1] + [shelves_z[-1]]):
                    if z > 2.2:
                        continue
                    last_bay = (si == 1 and side > 0 and bi == 1)
                    fill = 1.0
                    if last_bay:
                        # 由下往上排滿，最上面兩層開始變空：截止之後就沒有書
                        fill = [1.0, 1.0, 0.85, 0.35, 0.0, 0.0][zi]
                    if fill <= 0:
                        continue
                    # 書背朝走道：沿 y 排列，深度在 x
                    if side > 0:
                        fill_books(bk, a + 0.01, b_ - 0.01, yb, yf, z, 0.33, fill, rng, along='y')
                    else:
                        fill_books(bk, a + 0.01, b_ - 0.01, yf, yb, z, 0.33, fill, rng, along='y')
                    total_books += 1
    # 截止線：東側書架最後一格的銅牌
    pl = say(Obj('cutoff_plate', '2026 · 06', group='書房'), '書排到這裡為止。再往後發生的事，我只能從你告訴我的內容，或用工具去查。')
    x1 = stacks[1][0] + 0.3
    yb0 = (stacks[1][1] + stacks[1][2]) / 2 + 0.01
    box(pl, x1, x1 + 0.006, yb0 + 0.15, yb0 + 0.55, 1.46, 1.54, 'brass', color='#B8955A', bevel=0.002, seg=1)
    ANCH['cutoff'] = (x1 + 0.007, yb0 + 0.35, 1.5)
    # 北牆窗下的矮書櫃與閱讀燈
    lw = Obj('wall_shelf', '窗下矮櫃', group='書房')
    box(lw, 2.35, 6.05, D - 0.36, D, 0.0, 0.62, 'oak', color='#C6A57C', bevel=0.006, seg=1, collide=True)
    for k in range(6):
        xx = 2.35 + k * (3.7 / 6)
        box(lw, xx + 0.02, xx + 3.7 / 6 - 0.02, D - 0.362, D - 0.358, 0.06, 0.56, 'oak', color='#BD9A70', bevel=0.003, seg=1)
    fill_books(lw, 2.4, 3.1, D - 0.3, D - 0.05, 0.62, 0.26, 1.0, rng)
    fill_books(lw, 5.3, 6.0, D - 0.3, D - 0.05, 0.62, 0.26, 1.0, rng)
    # 桌上攤開的書與閱讀椅
    rc = Obj('reading_chair', '閱讀椅', group='書房')
    x, y = 4.0, 6.05
    rbox(rc, x - 0.35, x + 0.35, y - 0.35, y + 0.3, 0.1, 0.42, 0.07, 'leather', '#7A5840', n=(6, 6, 4), bulge=0.01)
    rbox(rc, x - 0.35, x + 0.35, y + 0.14, y + 0.32, 0.36, 0.9, 0.07, 'leather', '#704F39', n=(6, 3, 6))
    for sx in (-1, 1):
        rbox(rc, x + sx * 0.32 - 0.06, x + sx * 0.32 + 0.06, y - 0.34, y + 0.3, 0.1, 0.6, 0.05, 'leather', '#704F39', n=(3, 6, 5))
    for (dx, dy) in ((-0.3, -0.3), (0.3, -0.3), (-0.3, 0.26), (0.3, 0.26)):
        cyl(rc, x + dx, y + dy, 0.0, 0.1, 0.018, 'brass', seg=8)
    ANCH['library_books'] = total_books


# ════════════════════════ 工作間（工具） ════════════════════════
TOOLS = [  # id, 名稱, 比喻, 說明
    ('magnifier', '放大鏡', '讀取', '打開檔案、看清楚裡面寫了什麼。多數事情都從讀開始。'),
    ('pencil', '鉛筆', '寫入', '寫出一個新檔案，例如這一頁。'),
    ('plane', '刨刀', '編輯', '只改需要改的那一小段，其他地方不動。'),
    ('wrench', '扳手', '終端機', '跑指令：建置、測試、啟動伺服器、查版本控制。'),
    ('spyglass', '望遠鏡', '搜尋', '在很多檔案裡找一個名字，或上網查我不知道的事。'),
    ('chisel', '雕刻刀', '建模', '在 Blender 裡用程式把家具、房子一件件刻出來。'),
    ('camera', '相機', '截圖檢查', '開瀏覽器把畫面拍下來，看做出來的東西對不對。'),
]


def build_workshop():
    # 洞洞板與工作檯
    pb = Obj('pegboard', '洞洞板', group='工作間')
    say(pb, '我的工具都掛在這裡。能做的事不是憑空變出來的，是一次拿一樣工具做一件事。')
    box(pb, W - 0.03, W, 3.75, 6.65, 1.0, 2.25, 'oak', color='#D9C4A4', bevel=0.004, seg=1)
    for k in range(13):
        for m in range(6):
            yy = 3.85 + k * 0.22
            zz = 1.1 + m * 0.21
            cyl(pb, W - 0.031, yy, zz, zz, 0.008, 'ink', color='#7A6650', seg=6)
    bench = Obj('workbench', '工作檯', group='工作間')
    say(bench, '工作檯上是上一件作品的縮小版。')
    box(bench, 6.9, 9.5, D - 0.72, D - 0.05, 0.86, 0.92, 'oak', color='#C29C70', bevel=0.008, seg=2, collide=True)
    for (x, y) in ((7.0, D - 0.65), (9.4, D - 0.65), (7.0, D - 0.12), (9.4, D - 0.12)):
        box(bench, x - 0.035, x + 0.035, y - 0.035, y + 0.035, 0.0, 0.86, 'oak', color='#A9855E', bevel=0.004, seg=1)
    box(bench, 6.95, 9.45, D - 0.68, D - 0.09, 0.18, 0.21, 'oak', color='#B8946A')
    lathe(bench, [(0.001, 0), (0.16, 0), (0.17, 0.02), (0.05, 0.05), (0.04, 0.6), (0.2, 0.62), (0.2, 0.64), (0.001, 0.64)], 8.2, D - 1.25, 0.0, 'oak', color='#B8946A', seg=24)
    # 工具：各自一件，網頁可點選並在工作時段亮起
    tx = W - 0.05
    tool_pos = {}
    for k, (tid, name, meta, desc) in enumerate(TOOLS):
        y = 3.95 + k * 0.38
        o = say(Obj('tool_' + tid, '%s · %s' % (name, meta), group='工作間'), desc)
        o.meta['tool'] = meta
        if tid == 'magnifier':
            pts = [(tx - 0.02, y + math.cos(a) * 0.07, 1.95 + math.sin(a) * 0.07) for a in np.linspace(0, TAU, 33)]
            tube(o, pts, 0.008, 'brass', seg=8)
            box(o, tx - 0.022, tx - 0.018, y - 0.065, y + 0.065, 1.885, 2.015, 'glass', color='#E8EEF0')
            tube(o, [(tx - 0.02, y, 1.88), (tx - 0.02, y, 1.68)], [0.013, 0.011], 'leather', seg=10)
        elif tid == 'pencil':
            tube(o, [(tx - 0.02, y, 2.0), (tx - 0.02, y, 1.7)], 0.008, 'clay', seg=6)
            lathe(o, [(0.008, 0), (0.001, 0.035)], tx - 0.02, y, 1.665, 'oak', color='#E2C9A4', seg=8, sx=1, sy=1)
            cyl(o, tx - 0.02, y, 2.0, 2.02, 0.0085, 'brass', seg=8)
        elif tid == 'plane':
            rbox(o, tx - 0.06, tx - 0.01, y - 0.12, y + 0.12, 1.7, 1.78, 0.012, 'oak', '#B8946A', n=(2, 6, 2))
            box(o, tx - 0.05, tx - 0.02, y + 0.02, y + 0.06, 1.78, 1.84, 'metal_dark', color='#4A4744', bevel=0.004, seg=1)
            ell(o, tx - 0.035, y - 0.08, 1.82, 0.02, 0.03, 0.04, 'oak', color='#A9855E', seg=10, rings=6)
        elif tid == 'wrench':
            tube(o, [(tx - 0.02, y, 1.68), (tx - 0.02, y, 1.95)], 0.012, 'steel', seg=8)
            for a0 in (0.0,):
                pts = [(tx - 0.02, y + math.cos(a) * 0.035, 1.98 + math.sin(a) * 0.035) for a in np.linspace(-0.9, math.pi + 0.9, 18)]
                tube(o, pts, 0.01, 'steel', seg=8)
        elif tid == 'spyglass':
            tube(o, [(tx - 0.05, y, 1.7), (tx - 0.05, y, 1.84), (tx - 0.05, y, 1.84001), (tx - 0.05, y, 2.0)], [0.028, 0.028, 0.022, 0.018], 'brass', seg=14)
            cyl(o, tx - 0.05, y, 1.78, 1.8, 0.03, 'leather', seg=14)
        elif tid == 'chisel':
            tube(o, [(tx - 0.02, y, 1.95), (tx - 0.02, y, 1.82)], [0.016, 0.014], 'oak', color='#A9855E', seg=10)
            box(o, tx - 0.024, tx - 0.016, y - 0.012, y + 0.012, 1.68, 1.82, 'steel', bevel=0.002, seg=1)
        elif tid == 'camera':
            rbox(o, tx - 0.09, tx - 0.01, y - 0.09, y + 0.09, 1.72, 1.84, 0.012, 'ink', '#2C2926', n=(3, 4, 3))
            cyl(o, tx - 0.09, y, 1.78, 1.78, 0.001, 'ink')
            tube(o, [(tx - 0.09, y, 1.78), (tx - 0.13, y, 1.78)], 0.035, 'ink', color='#3A3632', seg=16)
            cyl(o, tx - 0.05, y + 0.06, 1.84, 1.855, 0.012, 'steel', seg=10)
        tool_pos[tid] = (tx - 0.04, y, 1.84)
    ANCH['tools'] = tool_pos
    # 工作檯上的小模型（上一件作品）：網頁在「用工具」那段把它一塊塊組起來
    mini = []
    bx, by, bz, s = 7.6, D - 0.55, 0.92, 0.075
    parts = [((0, 0, 4.3, 9.91), '#E4DCCF'), ((4.44, 3.7, 14.32, 4.8), '#D8D1C6'), ((4.44, 4.94, 14.32, 9.91), '#E8E1D6'), ((6.34, 0.3, 14.32, 3.56), '#E1D9CC')]
    for k, ((x0, y0, x1, y1), col) in enumerate(parts):
        o = Obj('mini_%d' % k, '小模型 %d' % (k + 1), group='工作間')
        say(o, '上一件作品（191 影中屋）的縮小版。房子是靠工具一件件做出來的。')
        X0, X1, Y0, Y1 = bx + x0 * s, bx + x1 * s, by - y1 * s * 0.5, by - y0 * s * 0.5
        box(o, X0, X1, Y0, Y1, bz, bz + 0.012, 'oak', color='#D7C2A2')
        for (a, b_, c, d) in ((X0, X1, Y0, Y0 + 0.004), (X0, X1, Y1 - 0.004, Y1), (X0, X0 + 0.004, Y0, Y1), (X1 - 0.004, X1, Y0, Y1)):
            box(o, a, b_, c, d, bz + 0.012, bz + 0.055, 'plaster', color=col)
        rr = random.Random(k)
        for m in range(3):  # 房間裡的小家具
            fx, fy = rr.uniform(X0 + 0.02, X1 - 0.05), rr.uniform(Y0 + 0.02, Y1 - 0.04)
            box(o, fx, fx + 0.03, fy, fy + 0.02, bz + 0.012, bz + 0.012 + rr.uniform(0.008, 0.02), 'linen', color=rr.choice(['#C8795A', '#E6DDCF', '#9A8F80']))
        mini.append(o)
    ANCH['mini'] = [('mini_%d' % k) for k in range(len(parts))]


# ════════════════════════ 窗邊（思考） ════════════════════════
def build_nook():
    ar = say(Obj('armchair', '思考的椅子', group='窗邊'), '回答之前，有時我會先在這裡想一下：把幾種做法攤開，寫了又劃掉，選一個再開始。')
    x, y = 0.95, 4.2
    rbox(ar, x - 0.42, x + 0.42, y - 0.4, y + 0.4, 0.14, 0.44, 0.08, 'fabric', '#E4D9C7', n=(7, 7, 4), bulge=0.02, sag=0.01)
    rbox(ar, x - 0.42, x - 0.22, y - 0.4, y + 0.4, 0.38, 0.95, 0.09, 'fabric', '#DDD1BE', n=(3, 7, 6))
    for sy in (-1, 1):
        rbox(ar, x - 0.42, x + 0.4, y + sy * 0.4 - 0.09, y + sy * 0.4 + 0.09, 0.14, 0.64, 0.07, 'fabric', '#DDD1BE', n=(7, 3, 5))
    for (dx, dy) in ((-0.36, -0.36), (0.36, -0.36), (-0.36, 0.36), (0.36, 0.36)):
        tube(ar, [(x + dx, y + dy, 0.0), (x + dx * 0.95, y + dy * 0.95, 0.14)], [0.014, 0.018], 'oak', color='#8F6E4B', seg=8)
    piping(ar, x - 0.4, x + 0.4, y - 0.38, y + 0.38, 0.4, 0.07, 'fabric', '#CFC2AE')
    drape(ar, x - 0.2, x + 0.25, y - 0.3, y + 0.05, 0.47, 0.22, ('+x',), 'fabric_warm', '#C8795A', step=0.03, fold=0.02, seed=2.1)
    # 窗邊坐墊
    ws = Obj('window_seat', '窗邊平台', group='窗邊')
    box(ws, 0.0, 0.5, 4.0, 6.2, 0.0, 0.42, 'oak', color='#C6A57C', bevel=0.006, seg=1, collide=True)
    rbox(ws, 0.02, 0.48, 4.05, 6.15, 0.42, 0.5, 0.03, 'linen', '#E8DFD1', n=(3, 10, 2), bulge=0.006)
    for k, (yy, col) in enumerate(((4.4, '#C8795A'), (5.7, '#E3D6C3'))):
        rbox(ws, 0.06, 0.2, yy - 0.2, yy + 0.2, 0.5, 0.86, 0.1, 'fabric_warm', col, n=(3, 5, 5), var=0.03)
    # 邊几、筆記本、草稿紙團、落地燈、植物
    sd = Obj('side_table', '邊几', group='窗邊')
    lathe(sd, [(0.001, 0), (0.16, 0), (0.17, 0.02), (0.04, 0.05), (0.035, 0.52), (0.24, 0.53), (0.24, 0.56), (0.001, 0.56)], 1.65, 4.25, 0.0, 'oak', color='#B8946A', seg=32)
    nb = say(Obj('notebook', '筆記本', group='窗邊'), '想事情的時候寫下的草稿。多數會被劃掉，留下來的才寫進回答。')
    rbox(nb, 1.52, 1.78, 4.12, 4.36, 0.56, 0.575, 0.004, 'page', '#F4EFE6', n=(4, 4, 1))
    rbox(nb, 1.52, 1.78, 4.12, 4.36, 0.558, 0.565, 0.004, 'leather', '#7A5840', n=(4, 4, 1))
    for i in range(6):
        yy = 4.16 + i * 0.03
        box(nb, 1.55, 1.74 - (i % 3) * 0.04, yy, yy + 0.003, 0.5755, 0.5765, 'ink', color='#6E655C')
    tube(nb, [(1.6, 4.4, 0.58), (1.78, 4.33, 0.58)], 0.004, 'clay', seg=6)
    for k in range(5):
        o = Obj('draft_%d' % k, '草稿紙團 %d' % (k + 1), group='窗邊')
        say(o, '寫了又劃掉的草稿。')
        rr = random.Random(k)
        cx, cy = 1.35 + rr.uniform(-0.25, 0.3), 4.7 + rr.uniform(-0.2, 0.35)
        ell(o, cx, cy, 0.035, 0.035, 0.032, 0.033, 'page', color='#F2ECE2', seg=10, rings=6, rfn=lambda a, h, rr=rr: 1 + 0.25 * noise.noise(Vector((math.cos(a) * 2 + rr.random() * 9, math.sin(a) * 2, h * 3))))
    ANCH['drafts'] = ['draft_%d' % k for k in range(5)]
    lp = Obj('light_nook_lamp', '閱讀燈', group='燈光')
    cyl(lp, 0.45, 3.35, 0.0, 0.025, 0.14, 'metal_dark', color='#3B3632', seg=24)
    tube(lp, [(0.45, 3.35, 0.02), (0.45, 3.35, 1.4), (0.6, 3.45, 1.58), (0.8, 3.7, 1.6)], 0.011, 'metal_dark', color='#3B3632', seg=8)
    lathe(lp, [(0.001, 0.0), (0.14, 0.0), (0.1, 0.1), (0.04, 0.16), (0.001, 0.17)], 0.8, 3.72, 1.46, 'clay', color='#C9876A', seg=24, cap_bot=False)
    cyl(lp, 0.8, 3.72, 1.465, 1.47, 0.12, 'glow', seg=20)
    pl = Obj('plant', '植物', group='窗邊')
    lathe(pl, [(0.001, 0), (0.13, 0), (0.16, 0.3), (0.001, 0.3)], 1.8, 6.6, 0.0, 'clay', color='#B86F52', seg=24)
    rr = random.Random(3)
    for k in range(14):
        a = TAU * k / 14 + rr.uniform(-0.2, 0.2)
        hgt = rr.uniform(0.55, 1.05)
        tip = (1.8 + math.cos(a) * 0.3, 6.6 + math.sin(a) * 0.3, 0.3 + hgt)
        tube(pl, [(1.8, 6.6, 0.28), (1.8 + math.cos(a) * 0.1, 6.6 + math.sin(a) * 0.1, 0.3 + hgt * 0.6), tip], [0.008, 0.006, 0.003], 'plant', color='#5E6E48', seg=5)
        # 葉片：沿莖的方向長出去，中間寬、兩端尖，微微下垂
        e = (tip[0] + math.cos(a) * 0.26, tip[1] + math.sin(a) * 0.26, tip[2] - 0.06)
        m1 = (tip[0] + math.cos(a) * 0.13, tip[1] + math.sin(a) * 0.13, tip[2] + 0.03)
        tube(pl, [tip, m1, e], [0.004, 0.055, 0.003], 'plant', color=rr.choice(['#71835A', '#667A50', '#7E8F63']), seg=8, flat=0.12)


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.world = bpy.data.worlds.new('World')
    build_shell()
    room_lights()
    build_entry()
    build_hall()
    build_library()
    build_workshop()
    build_nook()
    obs = [L.realize(o) for o in OBJS]
    bpy.context.view_layer.update()
    for o in OBJS:
        lo, hi = L.bbox(o.ob)
        if o.kind == 'door':
            L.set_origin(o.ob, ((lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, 0.0))
        elif o.id.startswith(('mini_', 'draft_', 'tool_', 'summaries', 'memo_')):
            # 網頁會縮放／移動這些物件：原點放在自身底部中央
            L.set_origin(o.ob, ((lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, lo[2]))
    if BAKE:
        L.ao_bake([o.ob for o in OBJS if not o.id.startswith('light_') and not o.id.startswith('door_glow')], samples=24)
    for o in bpy.context.view_layer.objects:
        o.select_set(o.type == 'MESH')
    glb = os.path.join(HERE, 'home.glb')
    bpy.ops.export_scene.gltf(filepath=glb, export_format='GLB', use_selection=True, export_vertex_color='NAME', export_vertex_color_name='Col',
                              export_apply=False, export_yup=True, export_texcoords=True, export_normals=True, export_materials='EXPORT',
                              export_image_format='NONE', export_extras=False, export_cameras=False, export_lights=False, export_animation_mode='ACTIONS')
    print('glb', os.path.getsize(glb) // 1024, 'KB')
    recs = []
    for o in OBJS:
        lo, hi = L.bbox(o.ob)
        r = {'id': o.id, 'label': o.label, 'group': o.group, 'kind': o.kind, 'size': [round(float(v), 3) for v in hi - lo]}
        if o.meta.get('desc'):
            r['desc'] = o.meta['desc']
        if o.meta.get('tool'):
            r['tool'] = o.meta['tool']
        recs.append(r)
    out = {'house': {'w': W, 'd': D, 'h': H}, 'rooms': {k: {'name': v[0], 'rect': v[1]} for k, v in ROOMS.items()}, 'objects': recs, 'anchors': ANCH,
           'tools': [{'id': t[0], 'name': t[1], 'meta': t[2]} for t in TOOLS]}
    json.dump(out, open(os.path.join(HERE, 'objects.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    blend = os.path.join(HERE, 'home.blend')
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=blend, compress=True)
    print('blend', os.path.getsize(blend) // 1024, 'KB')


main()
