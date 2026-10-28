# 房子：搭接木板牆（開口處斷開）、轉角板、封簷板與簷底板、三片式屋瓦、屋脊瓦、雨槽與落水管、
# 六格窗＋窗框＋窗台＋百葉窗、鑲板門＋氣窗、門廊（地板、台階、方柱、欄杆、斜屋頂）、磚基座、煙囪。
# 房子在自己的座標系建：正面在 x = 0、朝 −x；縱深往 +x；寬度沿 y。左右兩側用 rz = 0 / π 擺放。
import bpy, math, random
from mathutils import Vector
from kit_common import Acc, mat, glass_mat, ST, PAL, srgb, parent_all, coll

BOARD = 0.19      # 木板外露高度
LOD = False       # 遠景版（export.py 的 housesLod）：屋瓦一排一條，不分片
TILT = 0.07       # 木板傾角（下緣外凸，形成一條條陰影線）
FOUND = 0.5       # 基座高度

class Walls:
    def __init__(self, D, W):
        self.D, self.W = D, W
    def P(self, wall, u, z, n):
        D, W = self.D, self.W
        if wall == 'front': return Vector((-n, u, z))
        if wall == 'back': return Vector((D + n, -u, z))
        if wall == 'left': return Vector((u, -W / 2 - n, z))
        return Vector((u, W / 2 + n, z))
    def size(self, wall, su, sz, sn):
        return (sn, su, sz) if wall in ('front', 'back') else (su, sn, sz)
    def tilt(self, wall, a):
        return {'front': (0, a, 0), 'back': (0, -a, 0), 'left': (-a, 0, 0), 'right': (a, 0, 0)}[wall]
    def urange(self, wall):
        return (-self.W / 2, self.W / 2) if wall in ('front', 'back') else (0, self.D)
    def box(self, acc, wall, u, z, n, su, sz, sn, tilt=0.0, rnd=None):
        acc.box(self.P(wall, u, z, n), self.size(wall, su, sz, sn), self.tilt(wall, tilt), rnd)

def _subtract(iv, holes):
    out = [iv]
    for h0, h1 in holes:
        nxt = []
        for a, b in out:
            if h1 <= a or h0 >= b: nxt.append((a, b)); continue
            if h0 > a: nxt.append((a, h0))
            if h1 < b: nxt.append((h1, b))
        out = nxt
    return [(a, b) for a, b in out if b - a > 0.04]

def siding(acc, Wl, wall, z0, z1, openings, gable=None):
    """openings: [(u0,u1,zb,zt)]；gable: (H, rise, uc, half) 讓木板在山牆三角形內縮短。"""
    ua, ub = Wl.urange(wall); z = z0
    while z < z1 - 0.02:
        lo, hi = ua, ub
        if gable and z > gable[0]:
            H, rise, uc, half = gable; k = 1 - (z + BOARD - H) / rise
            if k <= 0.02: break
            lo, hi = max(ua, uc - half * k), min(ub, uc + half * k)
        holes = [(o[0], o[1]) for o in openings if not (o[3] <= z or o[2] >= z + BOARD)]
        for a, b in _subtract((lo, hi), holes):
            Wl.box(acc, wall, (a + b) / 2, z + BOARD / 2, 0.035, b - a, BOARD + 0.02, 0.025, TILT)
        z += BOARD

def window(acc_trim, acc_glass, acc_glow, acc_shut, Wl, wall, u, zb, w, h, shutters, lit):
    zc = zb + h / 2
    (acc_glow if lit else acc_glass).box(Wl.P(wall, u, zc, 0.0), Wl.size(wall, w, h, 0.04))
    t = 0.11
    for e in (-1, 1): Wl.box(acc_trim, wall, u + e * (w / 2 + t / 2), zc, 0.075, t, h + 2 * t, 0.05)
    Wl.box(acc_trim, wall, u, zb + h + t / 2, 0.075, w + 2 * t, t, 0.05)
    Wl.box(acc_trim, wall, u, zb + h + t + 0.025, 0.1, w + 2 * t + 0.08, 0.05, 0.1)        # 窗楣
    Wl.box(acc_trim, wall, u, zb - 0.03, 0.12, w + 2 * t + 0.1, 0.06, 0.14)              # 窗台
    Wl.box(acc_trim, wall, u, zb - t / 2 - 0.04, 0.07, w + 2 * t - 0.04, t * 0.8, 0.04)
    # 窗格：中橫檔（上下扇交會）＋ 每扇 1 直 1 橫
    Wl.box(acc_trim, wall, u, zc, 0.03, w, 0.05, 0.035)
    for e in (-1, 1): Wl.box(acc_trim, wall, u, zc + e * h / 4, 0.025, w, 0.022, 0.025)
    Wl.box(acc_trim, wall, u, zc, 0.025, 0.022, h, 0.025)
    if shutters:
        sw = w * 0.5
        for e in (-1, 1):
            su = u + e * (w / 2 + t + sw / 2 + 0.02)
            Wl.box(acc_shut, wall, su, zc, 0.06, sw, h + 2 * t, 0.025)
            n = int((h + 2 * t - 0.12) / 0.07)
            for k in range(n):
                Wl.box(acc_shut, wall, su, zb - t + 0.08 + k * 0.07, 0.085, sw - 0.08, 0.05, 0.012, 0.5)

def roof_plane(acc_deck, acc_sh, origin, d_slope, d_width, normal, L, Wd, rng, deck_t=0.1):
    """一片屋面：origin 是簷口角落，沿 d_slope 往屋脊 L 公尺、沿 d_width Wd 公尺；三片式瓦一排排往上疊。"""
    th = math.atan2(d_slope.z, math.hypot(d_slope.x, d_slope.y))
    # 屋面板
    c = origin + d_slope * (L / 2) + d_width * (Wd / 2) - normal * (deck_t / 2)
    _oriented_box(acc_deck, c, d_slope, d_width, normal, (L, Wd, deck_t))
    exp, tab, gap = 0.21, 0.36, 0.02
    rows = int(L / exp); s = 0.0
    if LOD:                      # 遠景版：每排一條長瓦，保留一排排往上疊的輪廓，拿掉片與片之間的縫
        ns = (normal * math.cos(0.09) - d_slope * math.sin(0.09)).normalized()
        ds = (d_slope * math.cos(0.09) + normal * math.sin(0.09)).normalized()
        for r in range(rows):
            cc = origin + d_slope * (r * exp + exp * 0.75) + d_width * (Wd / 2) + normal * 0.032
            _oriented_box(acc_sh, cc, ds, d_width, ns, (exp * 1.5, Wd, 0.025))
        return
    for r in range(rows):
        off = (r % 2) * tab / 2; y = -off
        while y < Wd:
            y0, y1 = max(0.0, y + gap / 2), min(Wd, y + tab - gap / 2)
            if y1 - y0 > 0.04:
                lift = 0.012 + rng.random() * 0.01
                cc = origin + d_slope * (s + exp * 0.75) + d_width * ((y0 + y1) / 2) + normal * (0.015 + lift)
                # 下緣微微翹起：沿坡度方向的軸稍微再往外傾
                ns = (normal * math.cos(0.09) - d_slope * math.sin(0.09)).normalized()
                ds = (d_slope * math.cos(0.09) + normal * math.sin(0.09)).normalized()
                _oriented_box(acc_sh, cc, ds, d_width, ns, (exp * 1.5, y1 - y0, 0.025))
            y += tab
        s += exp

def _oriented_box(acc, c, ax, ay, az, size):
    hx, hy, hz = size[0] / 2, size[1] / 2, size[2] / 2
    vs = [c + ax * (dx * hx) + ay * (dy * hy) + az * (dz * hz) for dx, dy, dz in
          [(-1,-1,-1),(1,-1,-1),(1,1,-1),(-1,1,-1),(-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1)]]
    acc._push(vs, [(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)])

def house(name, side, yc, spec, dusk=False, fade_roof=False, seed=0):
    """spec: W, D, stories, roof('side'|'front'), color, roofc, door, shutter, porch(bool), chimney(bool)"""
    rng = random.Random(seed)
    W, D, st = spec['W'], spec['D'], spec['stories']
    H = FOUND + (3.0 if st == 1 else 5.7)
    Wl = Walls(D, W)
    A = {k: Acc(seed * 31 + i) for i, k in enumerate(['core', 'siding', 'trim', 'glass', 'glow', 'shut', 'deck', 'sh', 'found', 'door', 'porch', 'chim', 'metal'])}
    # 核心牆體與基座
    A['core'].box((D / 2, 0, (FOUND + H) / 2), (D - 0.04, W - 0.04, H - FOUND))
    A['found'].box((D / 2, 0, FOUND / 2), (D + 0.12, W + 0.12, FOUND))
    # 開口
    door_u = spec.get('door_u', rng.uniform(-W * 0.15, W * 0.15))
    porch = spec.get('porch', True); deckZ = FOUND
    ops = {'front': [], 'back': [], 'left': [], 'right': []}
    win_w, win_h = 0.95, 1.35
    floors = [FOUND + 0.95] + ([FOUND + 3.75] if st == 2 else [])
    slots = [u for u in (-W * 0.36, -W * 0.14, W * 0.14, W * 0.36)]
    wins = []
    for fi, zb in enumerate(floors):
        for u in slots:
            if fi == 0 and abs(u - door_u) < 1.25: continue
            wins.append(('front', u, zb))
        for u in (D * 0.3, D * 0.7):
            wins.append(('left', u, zb)); wins.append(('right', u, zb))
    for wall, u, zb in wins:
        ops[wall].append((u - win_w / 2 - 0.12, u + win_w / 2 + 0.12, zb - 0.1, zb + win_h + 0.14))
    ops['front'].append((door_u - 0.62, door_u + 0.62, deckZ, deckZ + 2.55))
    # 屋頂幾何參數
    ov, ro = 0.55, 0.35
    if spec['roof'] == 'side':
        span, length, rise = D, W, D * 0.36
    else:
        span, length, rise = W, D, W * 0.42
    # 牆面木板
    for wall in ('front', 'left', 'right', 'back'):
        gable = None
        if spec['roof'] == 'side' and wall in ('left', 'right'): gable = (H, rise, D / 2, D / 2)
        if spec['roof'] == 'front' and wall in ('front', 'back'): gable = (H, rise, 0.0, W / 2)
        top = H + (rise if gable else 0)
        if wall == 'back' and not gable: top = H
        siding(A['siding'], Wl, wall, FOUND, top, ops[wall] if wall != 'back' else [], gable)
    # 山牆的核心三角
    if spec['roof'] == 'side':
        for e in (-1, 1):
            A['core'].poly_prism([(0.02, H), (D - 0.02, H), (D / 2, H + rise - 0.05)], e * (W / 2 - 0.02), e * (W / 2 - 0.3),
                                 lambda u, v, t: Vector((u, t, v)))
    else:
        for x0 in (0.02, D - 0.02):
            A['core'].poly_prism([(-W / 2 + 0.02, H), (W / 2 - 0.02, H), (0, H + rise - 0.05)], x0, x0 + (0.3 if x0 < 1 else -0.3),
                                 lambda u, v, t: Vector((t, u, v)))
        # 山牆通風百葉（三角形中間）
        for k in range(6):
            Wl.box(A['trim'], 'front', 0, H + rise * 0.42 + k * 0.08, 0.06, 0.7 - k * 0.07, 0.04, 0.03, 0.4)
        Wl.box(A['trim'], 'front', 0, H + rise * 0.42 + 0.22, 0.045, 0.82, 0.62, 0.02)
    # 轉角板
    for (x, y) in ((0, -W / 2), (0, W / 2), (D, -W / 2), (D, W / 2)):
        sx = -0.04 if x == 0 else 0.04; sy = -0.04 if y < 0 else 0.04
        A['trim'].box((x + sx, y + sy, (FOUND + H) / 2), (0.16, 0.16, H - FOUND))
    # 樓層腰帶（兩層樓）
    if st == 2:
        for wall in ('front', 'left', 'right'):
            ua, ub = Wl.urange(wall); Wl.box(A['trim'], wall, (ua + ub) / 2, FOUND + 3.15, 0.06, ub - ua + 0.1, 0.16, 0.05)
    # 窗
    for i, (wall, u, zb) in enumerate(wins):
        lit = dusk and rng.random() < 0.65
        window(A['trim'], A['glass'], A['glow'], A['shut'], Wl, wall, u, zb, win_w, win_h, spec.get('shutters', True) and wall == 'front', lit)
    # 門：門板、四片鑲板、門把、門框、氣窗
    dz = deckZ + 1.05
    A['door'].box((-0.01, door_u, dz), (0.06, 0.95, 2.1))
    for py in (-0.22, 0.22):
        for pz in (-0.5, 0.45):
            A['door'].box((-0.05, door_u + py, dz + pz), (0.03, 0.34, 0.7 if pz < 0 else 0.55))
    A['metal'].box((-0.08, door_u + 0.36, dz - 0.05), (0.06, 0.05, 0.05))
    for e in (-1, 1): A['trim'].box((-0.07, door_u + e * 0.55, deckZ + 1.27), (0.05, 0.14, 2.55))
    A['trim'].box((-0.08, door_u, deckZ + 2.6), (0.08, 1.3, 0.14))
    A['glow' if dusk else 'glass'].box((-0.02, door_u, deckZ + 2.32), (0.04, 0.9, 0.3))
    A['trim'].box((-0.06, door_u, deckZ + 2.15), (0.05, 1.0, 0.06))
    # 門廊
    if porch:
        pw = spec.get('porchW', 3.8); pd = 2.2; y0, y1 = door_u - pw / 2, door_u + pw / 2
        A['porch'].box((-pd / 2, door_u, deckZ - 0.06), (pd, pw, 0.12))
        A['found'].box((-pd / 2, door_u, (deckZ - 0.12) / 2), (pd - 0.1, pw - 0.1, deckZ - 0.12))
        for k in range(int(pw / 0.14)):   # 地板縫
            A['porch'].box((-pd / 2, y0 + 0.07 + k * 0.14, deckZ + 0.002), (pd - 0.02, 0.012, 0.01))
        for k in range(3):                # 台階
            A['porch'].box((-pd - 0.18 - k * 0.3, door_u, deckZ - 0.17 * (k + 1) + 0.03), (0.34, 1.4, 0.12))
            A['found'].box((-pd - 0.18 - k * 0.3, door_u, (deckZ - 0.17 * (k + 1)) / 2), (0.3, 1.36, deckZ - 0.17 * (k + 1)))
        colz = deckZ + 1.32
        cols = [y0 + 0.12, y1 - 0.12]
        for cy in cols:
            A['trim'].box((-pd + 0.15, cy, colz), (0.16, 0.16, 2.5))
            A['trim'].box((-pd + 0.15, cy, deckZ + 0.12), (0.26, 0.26, 0.2))
            A['trim'].box((-pd + 0.15, cy, deckZ + 2.5), (0.24, 0.24, 0.12))
        # 欄杆（台階處留開口）
        for a, b in ((y0 + 0.2, door_u - 0.75), (door_u + 0.75, y1 - 0.2)):
            if b - a < 0.2: continue
            A['trim'].box((-pd + 0.15, (a + b) / 2, deckZ + 0.85), (0.07, b - a, 0.06))
            A['trim'].box((-pd + 0.15, (a + b) / 2, deckZ + 0.12), (0.06, b - a, 0.05))
            y = a + 0.06
            while y < b - 0.03:
                A['trim'].box((-pd + 0.15, y, deckZ + 0.48), (0.035, 0.035, 0.72)); y += 0.13
        for e in (-1, 1):                 # 側邊欄杆
            yy = y0 + 0.12 if e < 0 else y1 - 0.12
            A['trim'].box((-pd / 2 + 0.05, yy, deckZ + 0.85), (pd - 0.2, 0.07, 0.06))
            x = -pd + 0.25
            while x < -0.1:
                A['trim'].box((x, yy, deckZ + 0.48), (0.035, 0.035, 0.72)); x += 0.13
        # 門廊斜屋頂
        pz0, pz1 = deckZ + 2.62, deckZ + 3.05
        o = Vector((-pd - 0.35, y0 - 0.2, pz0)); ds = Vector((pd + 0.35, 0, pz1 - pz0)); Ls = ds.length; ds.normalize()
        nrm = Vector((-ds.z, 0, ds.x))
        A['trim'].box((-pd + 0.15, door_u, deckZ + 2.62), (0.2, pw + 0.1, 0.22))    # 樑
        roof_plane(A['deck'], A['sh'], o, ds, Vector((0, 1, 0)), nrm, Ls, pw + 0.4, rng)
        A['trim'].box((-pd - 0.36, door_u, pz0 - 0.08), (0.04, pw + 0.42, 0.18))     # 封簷板
    # 主屋頂
    rset = []
    th = math.atan2(rise, span / 2)
    for e in (-1, 1):
        # 屋頂座標：跨度方向 a、屋脊方向 b
        if spec['roof'] == 'side':
            a_dir, b_dir, cen = Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((D / 2, 0, 0))
        else:
            a_dir, b_dir, cen = Vector((0, 1, 0)), Vector((1, 0, 0)), Vector((D / 2, 0, 0))
        eave_a = -e * (span / 2 + ov)
        o = cen + a_dir * eave_a + b_dir * (-(length / 2 + ro)) + Vector((0, 0, H + 0.06 - ov * math.tan(th)))
        ds = (a_dir * (e * math.cos(th)) + Vector((0, 0, math.sin(th)))).normalized()
        L = (span / 2 + ov) / math.cos(th)
        nrm = (a_dir * (-e * math.sin(th)) + Vector((0, 0, math.cos(th)))).normalized()
        wdir = b_dir
        if e > 0:   # 讓兩片屋面的寬度方向一致（右手系）
            pass
        roof_plane(A['deck'], A['sh'], o, ds, wdir, nrm, L, length + 2 * ro, rng)
        # 封簷板與雨槽
        fe = cen + a_dir * eave_a + Vector((0, 0, H - ov * math.tan(th) - 0.04))
        _oriented_box(A['trim'], fe, b_dir, a_dir, Vector((0, 0, 1)), (length + 2 * ro, 0.05, 0.22))
        _oriented_box(A['trim'], fe + a_dir * (e * ov / 2) + Vector((0, 0, -0.1)), b_dir, a_dir, Vector((0, 0, 1)), (length + 2 * ro, ov, 0.03))
        A['metal'].tube(fe + a_dir * (-e * 0.07) + b_dir * (-(length / 2 + ro)) + Vector((0, 0, -0.06)),
                        fe + a_dir * (-e * 0.07) + b_dir * (length / 2 + ro) + Vector((0, 0, -0.06)), 0.065, n=8)
        # 落水管（兩端）
        for be in (-1, 1):
            top = fe + a_dir * (-e * 0.07) + b_dir * (be * (length / 2 - 0.1)) + Vector((0, 0, -0.1))
            A['metal'].tube(top, top + a_dir * (e * (ov - 0.12)) + Vector((0, 0, -0.3)), 0.04, n=6)
            p2 = top + a_dir * (e * (ov - 0.12)) + Vector((0, 0, -0.3))
            A['metal'].tube(p2, Vector((p2.x, p2.y, 0.15)), 0.045, n=6)
        # 山牆封簷（斜邊）
        for be in (-1, 1):
            p0 = cen + a_dir * eave_a + b_dir * (be * (length / 2 + ro)) + Vector((0, 0, H + 0.05 - ov * math.tan(th)))
            p1 = cen + b_dir * (be * (length / 2 + ro)) + Vector((0, 0, H + rise + 0.05))
            mid = (p0 + p1) / 2; dd = (p1 - p0).normalized()
            _oriented_box(A['trim'], mid + Vector((0, 0, -0.05)), dd, b_dir, dd.cross(b_dir).normalized(), ((p1 - p0).length, 0.06, 0.22))
    # 屋脊瓦
    rc = Vector((D / 2, 0, H + rise + 0.08))
    b_dir = Vector((0, 1, 0)) if spec['roof'] == 'side' else Vector((1, 0, 0))
    a_dir = Vector((1, 0, 0)) if spec['roof'] == 'side' else Vector((0, 1, 0))
    n = int((length + 2 * ro) / 0.3)
    for k in range(n):
        c = rc + b_dir * (-(length / 2 + ro) + 0.15 + k * 0.3)
        _oriented_box(A['sh'], c, b_dir, a_dir, Vector((0, 0, 1)), (0.32, 0.34, 0.06))
    # 煙囪
    if spec.get('chimney'):
        if spec['roof'] == 'side':
            cx, cy = D * 0.62, (W / 2 + 0.35) * (1 if seed % 2 else -1)
        else:
            cx, cy = D * 0.72, W * 0.2
        ch_top = H + rise + 0.9
        A['chim'].box((cx, cy, ch_top / 2), (0.9, 0.7, ch_top))
        A['chim'].box((cx, cy, ch_top + 0.08), (1.05, 0.85, 0.16))
        for k in range(int(ch_top / 0.075)):   # 磚縫（凸起的灰縫帶）
            if k % 2: A['found'].box((cx, cy, k * 0.075), (0.92, 0.72, 0.012))
    # 組合
    C = coll('houses')
    fa = 0.22 if fade_roof else 1.0   # 近側房子擋住騎士時整棟淡出
    def fm(*a, **kw):
        kw.setdefault('alpha', fa); return mat(*a, **kw)
    roofC = spec['roofc']
    m_roof = fm(roofC, var=0.35, brush=0.1, rough=0.9, grime=0.0)
    m_deck = fm(roofC, var=0.0, brush=0.0, grime=0.0, color=tuple(c * 0.6 for c in srgb(PAL[roofC])[:3]) + (1,))
    gm = (lambda d: glass_mat(d)) if not fade_roof else (lambda d: mat('glass', alpha=fa, rough=0.15, var=0.0))
    objs = [
        A['core'].obj(f'{name}_core', fm(spec['color'], var=0.0, brush=0.1), coll=C),
        A['siding'].obj(f'{name}_siding', fm(spec['color'], var=0.14, brush=0.22, grime=0.35), coll=C),
        A['trim'].obj(f'{name}_trim', fm('trim', var=0.06, brush=0.12, grime=0.3), coll=C),
        A['glass'].obj(f'{name}_glass', gm(False), coll=C),
        A['glow'].obj(f'{name}_glow', gm(True), coll=C),
        A['shut'].obj(f'{name}_shut', fm(spec['shutter'], var=0.08, brush=0.15), coll=C),
        A['deck'].obj(f'{name}_deck', m_deck, coll=C),
        A['sh'].obj(f'{name}_shingles', m_roof, coll=C),
        A['found'].obj(f'{name}_found', fm('brick', var=0.25, brush=0.3, grime=0.4), coll=C),
        A['door'].obj(f'{name}_door', fm(spec['door'], var=0.04, brush=0.1, rough=0.55), coll=C),
        A['porch'].obj(f'{name}_porch', fm('stone', color=srgb('#b7a48a'), var=0.15, brush=0.2), coll=C),
        A['chim'].obj(f'{name}_chim', fm('brick', var=0.3, brush=0.3), coll=C),
        A['metal'].obj(f'{name}_metal', fm('trim', color=srgb('#e9e6de'), var=0.0, rough=0.5), coll=C),
    ]
    # 給遊戲判定用：正面窗戶（u 沿牆寬、zb 窗底，相對房子原點）、門、尺寸
    house.meta = dict(W=W, D=D, H=H, stories=st, roof=spec['roof'], rise=rise, door_u=door_u, win=[win_w, win_h], porch=porch,
                      wins=[[u, zb] for wall, u, zb in wins if wall == 'front'])
    x = side * ST['houseFront']; rz = 0.0 if side > 0 else math.pi
    return parent_all(name, [o for o in objs if o], (x, yc, 0.12), rz), door_u
