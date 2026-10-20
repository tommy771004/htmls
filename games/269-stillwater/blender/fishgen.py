# 靜水釣遊（269）：參數化魚體產生器（fish.py 用）。
# 先在「three 座標」組幾何（X 左右、Y 上、Z 往頭；頭在 +Z），最後換成 Blender（x, −z, y）建物件，
# 匯出 glTF 後又回到 three 的方向。顏色寫在頂點色（每個頂點一色，平滑內插），沒有貼圖。
# 身體沿長軸 STN 段截面，尾鰭、背鰭、臀鰭也跟著 Z 分段，遊戲在頂點著色器沿 Z 擺尾。
import bpy, math, random
from mathutils import Vector

STN = 20     # 身體截面數（吻端到尾柄）
RING = 12    # 每圈頂點數


def hexlin(h, a=1.0):
    h = h.lstrip('#')
    s = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple((c / 12.92) if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in s) + (a,)


def mix(a, b, t):
    t = max(0.0, min(1.0, t))
    return tuple(a[i] + (b[i] - a[i]) * t for i in range(4))


def sstep(e0, e1, x):
    t = max(0.0, min(1.0, (x - e0) / (e1 - e0)))
    return t * t * (3 - 2 * t)


def _h(*a):
    """穩定的雜湊亂數 0..1。"""
    x = 0
    for v in a:
        x = (x * 1103515245 + int(v * 1000 + 7919)) & 0x7fffffff
    x ^= x >> 13
    x = (x * 1274126177) & 0x7fffffff
    return (x % 10007) / 10007.0


# 族別預設值；每條魚在 fish.py 只寫不同的地方
FAMILY = {
    'cyprinid': dict(depth=0.28, width=0.42, maxAt=0.40, tailLen=0.19, tailH=0.62, caudal='fork', fork=0.55,
                     snoutR=0.22, asym=0.08, blunt=0.7,
                     dorsal=[(0.38, 0.56, 0.17, 'tri')], anal=(0.66, 0.80, 0.09, 'tri'),
                     pect=0.09, pelv=0.08, eyeT=0.10, eyeV=0.30, eyeR=0.034),
    'minnow': dict(depth=0.19, width=0.55, maxAt=0.40, tailLen=0.19, tailH=0.55, caudal='fork', fork=0.5,
                   snoutR=0.25, asym=0.05, blunt=0.6,
                   dorsal=[(0.44, 0.58, 0.13, 'tri')], anal=(0.66, 0.78, 0.08, 'tri'),
                   pect=0.08, pelv=0.07, eyeT=0.10, eyeV=0.32, eyeR=0.04),
    'perch': dict(depth=0.26, width=0.50, maxAt=0.36, tailLen=0.17, tailH=0.55, caudal='emarg', fork=0.25,
                  snoutR=0.18, asym=0.10, blunt=0.6,
                  dorsal=[(0.24, 0.46, 0.14, 'spiny'), (0.50, 0.68, 0.11, 'round')], anal=(0.66, 0.78, 0.08, 'round'),
                  pect=0.09, pelv=0.09, eyeT=0.11, eyeV=0.36, eyeR=0.04),
    'sunfish': dict(depth=0.50, width=0.32, maxAt=0.42, tailLen=0.17, tailH=0.5, caudal='emarg', fork=0.2,
                    snoutR=0.2, asym=0.0, blunt=0.9,
                    dorsal=[(0.28, 0.48, 0.10, 'spiny'), (0.48, 0.74, 0.15, 'round')], anal=(0.56, 0.76, 0.13, 'round'),
                    pect=0.11, pelv=0.08, eyeT=0.12, eyeV=0.32, eyeR=0.045),
    'salmonid': dict(depth=0.23, width=0.50, maxAt=0.42, tailLen=0.17, tailH=0.6, caudal='emarg', fork=0.22,
                     snoutR=0.2, asym=0.04, blunt=0.55,
                     dorsal=[(0.40, 0.55, 0.13, 'tri')], adipose=0.74, anal=(0.68, 0.79, 0.09, 'tri'),
                     pect=0.09, pelv=0.08, eyeT=0.09, eyeV=0.30, eyeR=0.032),
    'catfish': dict(depth=0.17, width=0.95, maxAt=0.25, tailLen=0.15, tailH=0.42, caudal='trunc', fork=0.08,
                    snoutR=0.42, asym=-0.12, blunt=1.0, headWide=0.5, flatHead=0.35,
                    dorsal=[(0.26, 0.34, 0.10, 'tri')], adipose=0.70, anal=(0.60, 0.82, 0.07, 'long'),
                    pect=0.10, pelv=0.07, eyeT=0.07, eyeV=0.55, eyeR=0.022, barbels=[(0.5, 0.18), (-0.6, 0.10)]),
    'loach': dict(depth=0.12, width=0.75, maxAt=0.45, tailLen=0.13, tailH=0.5, caudal='round', fork=0.0,
                  snoutR=0.35, asym=0.0, blunt=0.8,
                  dorsal=[(0.46, 0.58, 0.07, 'round')], anal=(0.70, 0.78, 0.05, 'round'),
                  pect=0.05, pelv=0.04, eyeT=0.08, eyeV=0.45, eyeR=0.03),
    'pike': dict(depth=0.15, width=0.62, maxAt=0.55, tailLen=0.16, tailH=0.62, caudal='fork', fork=0.4,
                 snoutR=0.12, asym=0.0, blunt=0.35, flatHead=0.5, snout='duck',
                 dorsal=[(0.70, 0.82, 0.12, 'round')], anal=(0.71, 0.82, 0.10, 'round'),
                 pect=0.07, pelv=0.07, eyeT=0.16, eyeV=0.5, eyeR=0.03),
    'sturgeon': dict(depth=0.13, width=0.85, maxAt=0.35, tailLen=0.2, tailH=0.5, caudal='hetero', fork=0.3,
                     snoutR=0.08, asym=-0.1, blunt=0.35, flatHead=0.3, snout='sturgeon',
                     dorsal=[(0.72, 0.80, 0.09, 'tri')], anal=(0.74, 0.81, 0.07, 'tri'),
                     pect=0.08, pelv=0.06, eyeT=0.14, eyeV=0.55, eyeR=0.018, barbels=[(-0.85, 0.06)] * 2, scutes=True),
    'gar': dict(depth=0.13, width=0.75, maxAt=0.5, tailLen=0.14, tailH=0.5, caudal='round', fork=0.0,
                snoutR=0.1, asym=0.0, blunt=0.3, snout='gar',
                dorsal=[(0.74, 0.84, 0.10, 'round')], anal=(0.73, 0.83, 0.09, 'round'),
                pect=0.07, pelv=0.06, eyeT=0.2, eyeV=0.45, eyeR=0.022),
    'arapaima': dict(depth=0.16, width=0.70, maxAt=0.4, tailLen=0.12, tailH=0.45, caudal='round', fork=0.0,
                     snoutR=0.2, asym=0.0, blunt=0.5, flatHead=0.3,
                     dorsal=[(0.66, 0.92, 0.10, 'long')], anal=(0.66, 0.92, 0.10, 'long'),
                     pect=0.08, pelv=0.06, eyeT=0.08, eyeV=0.4, eyeR=0.022),
    'eel': dict(depth=0.10, width=0.72, maxAt=0.4, tailLen=0.10, tailH=0.8, caudal='round', fork=0.0,
                snoutR=0.3, asym=0.0, blunt=0.7,
                dorsal=[(0.30, 0.96, 0.06, 'long')], anal=(0.52, 0.96, 0.05, 'long'),
                pect=0.05, pelv=0.0, eyeT=0.07, eyeV=0.45, eyeR=0.03),
    'dragon': dict(depth=0.20, width=0.40, maxAt=0.35, tailLen=0.22, tailH=0.62, caudal='round', fork=0.0,
                   snoutR=0.16, asym=-0.05, blunt=0.45,
                   dorsal=[(0.64, 0.92, 0.10, 'long')], anal=(0.52, 0.92, 0.11, 'long'),
                   pect=0.12, pelv=0.06, eyeT=0.10, eyeV=0.42, eyeR=0.03, barbels=[(-0.2, 0.12)] * 2),
}


class Fish:
    def __init__(self, P):
        self.P = P
        self.v, self.c, self.f = [], [], []
        self.body_idx = set()
        self.loose = set()     # 觸鬚、飄帶：不算進全長正規化

    def vert(self, p, col, body=True, loose=False):
        self.v.append(Vector(p))
        self.c.append(col)
        if body:
            self.body_idx.add(len(self.v) - 1)
        if loose:
            self.loose.add(len(self.v) - 1)
        return len(self.v) - 1

    def tri(self, a, b, c):
        self.f.append((a, b, c))

    def quad(self, a, b, c, d):
        self.f.append((a, b, c, d))


def build_fish(name, P):
    F = Fish(P)
    L_body = 1.0 - P['tailLen']
    z_snout, z_ped = 0.5, 0.5 - L_body
    depth = P['depth']
    D = depth / 2
    C = {k: hexlin(v) for k, v in P['col'].items()}

    def shape(t):
        """回傳 (半高 上, 半高 下, 半寬, 中心 y) 於 t（0 吻端、1 尾柄）。"""
        ma = P['maxAt']
        if t <= ma:
            s = t / ma
            f = P['snoutR'] + (1 - P['snoutR']) * math.sin(s * math.pi / 2) ** P['blunt']
        else:
            s = (t - ma) / (1 - ma)
            ped = P.get('ped', 0.32)
            f = 1 - (1 - ped) * sstep(0, 1, s) ** 0.85
        h = D * f
        hump = P.get('hump', 0.0) * math.sin(min(1, t / 0.7) * math.pi) * D
        up = h * (1 + P['asym']) + hump
        dn = h * (1 - P['asym'])
        w = h * P['width'] * 1.3 * (1 - 0.35 * t)   # 俯視時要看得出體寬，比真魚略胖
        hw = P.get('headWide', 0)
        if hw:
            w *= 1 + hw * max(0, 1 - t / 0.35) ** 1.5
        fh = P.get('flatHead', 0)
        if fh:
            k = max(0, 1 - t / 0.3)
            up *= 1 - fh * k
            dn *= 1 - fh * 0.6 * k
        sn = P.get('snout')
        if sn == 'duck' and t < 0.18:
            k = 1 - t / 0.18
            up *= 1 - 0.45 * k
            dn *= 1 - 0.3 * k
            w *= 1 + 0.1 * k
        if sn in ('gar',) and t < 0.25:
            k = 1 - t / 0.25
            up *= 1 - 0.75 * k
            dn *= 1 - 0.75 * k
            w *= 1 - 0.6 * k
        cy = 0.0
        return up, dn, w, cy

    # 吻端拉長（雀鱔、狗魚、鱘、匙吻鱘）：吻部截面集中在前段
    ts = [i / (STN - 1) for i in range(STN)]
    zs = [z_snout - t * L_body for t in ts]
    rings = []
    for i, t in enumerate(ts):
        up, dn, w, cy = shape(t)
        ring = []
        for j in range(RING):
            a = 2 * math.pi * j / RING      # 0 = 右側（+X），π/2 = 背
            ca, sa = math.cos(a), math.sin(a)
            e = P.get('square', 0.85)
            x = math.copysign(abs(ca) ** e, ca) * w
            y = cy + (up if sa > 0 else dn) * math.copysign(abs(sa) ** e, sa)
            vv = sa  # -1 腹 .. 1 背
            col = body_color(P, C, t, vv, ca, i, j)
            ring.append(F.vert((x, y, zs[i]), col))
        rings.append(ring)
    # 吻尖
    up0, dn0, _, _ = shape(0)
    mouth_y = P.get('mouthY', (up0 - dn0) * 0.2)
    tipz = z_snout + P.get('tipLen', 0.025)
    if P.get('snout') == 'gar':
        tipz = z_snout + 0.04
    if P.get('snout') == 'sturgeon':
        tipz = z_snout + 0.07
        mouth_y = 0.01
    tip = F.vert((0, mouth_y, tipz), body_color(P, C, 0, 0.3, 0, 0, 0))
    for j in range(RING):
        F.tri(tip, rings[0][(j + 1) % RING], rings[0][j])
    for i in range(STN - 1):
        for j in range(RING):
            a, b = rings[i][j], rings[i][(j + 1) % RING]
            c, d = rings[i + 1][(j + 1) % RING], rings[i + 1][j]
            F.quad(a, b, c, d)
    # 尾柄封口（被尾鰭擋住，仍封起來免得看穿）
    endc = F.vert((0, 0, z_ped - 0.004), body_color(P, C, 1, 0, 0, STN, 0))
    for j in range(RING):
        F.tri(endc, rings[-1][j], rings[-1][(j + 1) % RING])

    upP, dnP, _, _ = shape(1)
    fin_c = C.get('fin', C['side'])

    # ---- 尾鰭 ----
    caudal(F, P, C, z_ped, upP, dnP)

    # ---- 背鰭／臀鰭 ----
    def top_y(t):
        up, _, _, cy = shape(t)
        return cy + up * 0.92

    def bot_y(t):
        _, dn, _, cy = shape(t)
        return cy - dn * 0.92

    for k, d in enumerate(P['dorsal']):
        median_fin(F, P, C, d, top_y, z_snout, L_body, +1, P.get('dcol', fin_c), seed=k)
    if P.get('anal'):
        median_fin(F, P, C, P['anal'], bot_y, z_snout, L_body, -1, P.get('acol', fin_c), seed=9)
    if P.get('adipose'):
        t0 = P['adipose']
        a = P.get('adcol', C.get('adipose', C['back']))
        ys = top_y(t0)
        z0 = z_snout - t0 * L_body
        b0 = F.vert((0, ys, z0 + 0.025), a, False)
        b1 = F.vert((0, ys, z0 - 0.04), a, False)
        t1 = F.vert((0, ys + 0.035, z0 - 0.035), a, False)
        F.tri(b0, b1, t1)

    # ---- 胸鰭、腹鰭（左右一對，往外後方張開） ----
    pcol = P.get('pcol', fin_c)
    for sgn in (1, -1):
        if P['pect']:
            t = P.get('pectT', 0.2)
            up, dn, w, cy = shape(t)
            z = z_snout - t * L_body
            y = cy - dn * 0.45
            s = P['pect'] * P.get('pectScale', 1.0)
            spread = P.get('pectSpread', 0.95)
            root0 = F.vert((sgn * w * 0.92, y + 0.012, z), pcol, False)
            root1 = F.vert((sgn * w * 0.92, y - 0.008, z - 0.03), pcol, False)
            tipA = F.vert((sgn * (w + s * spread), y - s * 0.12, z - s * 0.7), mix(pcol, C.get('finEdge', pcol), 0.6), False)
            tipB = F.vert((sgn * (w + s * spread * 0.55), y - s * 0.2, z - s * 1.05), mix(pcol, C.get('finEdge', pcol), 0.6), False)
            F.quad(root0, root1, tipB, tipA)
        if P['pelv']:
            t = P.get('pelvT', 0.46)
            up, dn, w, cy = shape(t)
            z = z_snout - t * L_body
            y = cy - dn * 0.85
            s = P['pelv']
            col = P.get('vcol', fin_c)
            r0 = F.vert((sgn * w * 0.35, y, z), col, False)
            r1 = F.vert((sgn * w * 0.25, y, z - 0.035), col, False)
            ribbon = P.get('ribbon', 0)
            if ribbon:
                # 長飄帶：分段往後下方延伸，遊戲擺尾時跟著彎
                prev = (r0, r1)
                n = 6
                for k in range(1, n + 1):
                    u = k / n
                    zz = z - ribbon * u
                    yy = y - 0.03 - 0.04 * math.sin(u * 2.4)
                    xx = sgn * (w * 0.3 + 0.05 * u)
                    wd = 0.022 * (1 - u * 0.75)
                    cc = mix(col, C.get('finEdge', col), u)
                    a = F.vert((xx, yy + wd, zz), cc, False, True)
                    b = F.vert((xx, yy - wd, zz - 0.01), cc, False, True)
                    F.quad(prev[0], prev[1], b, a)
                    prev = (a, b)
            else:
                tp = F.vert((sgn * (w * 0.35 + s * 0.5), y - s * 0.55, z - s * 0.9), mix(col, C.get('finEdge', col), 0.5), False)
                F.tri(r0, r1, tp)

    # ---- 眼睛 ----
    t = P['eyeT']
    up, dn, w, cy = shape(t)
    z = z_snout - t * L_body
    ev = P['eyeV']
    er = P['eyeR'] * (1 if depth > 0.15 else 1.2)
    eye_c = hexlin(P.get('eye', '#1e1b18'))
    ring_c = hexlin(P.get('eyeRing', '#c9b98a'))
    for sgn in (1, -1):
        a = math.asin(max(-1, min(1, ev)))
        nx, ny = math.cos(a), math.sin(a)
        e = P.get('square', 0.85)
        cx_ = sgn * (abs(nx) ** e) * w * 1.03
        cyy = cy + (up if ny > 0 else dn) * (abs(ny) ** e) * math.copysign(1, ny)
        nrm = Vector((sgn * nx, ny * 0.6, 0.15)).normalized()
        cen = Vector((cx_, cyy, z)) + nrm * 0.004
        u = Vector((0, 0, 1)).cross(nrm).normalized()
        vv = nrm.cross(u).normalized()
        ci = F.vert(cen + nrm * 0.003, eye_c)
        rr = [F.vert(cen + (u * math.cos(k * math.pi / 3) + vv * math.sin(k * math.pi / 3)) * er, ring_c) for k in range(6)]
        for k in range(6):
            if sgn > 0:
                F.tri(ci, rr[k], rr[(k + 1) % 6])
            else:
                F.tri(ci, rr[(k + 1) % 6], rr[k])

    # ---- 觸鬚 ----
    for (vy, ln) in P.get('barbels', []):
        bc = hexlin(P['col'].get('barbel', P['col']['side']))
        for sgn in (1, -1):
            z0 = z_snout - 0.02
            y0 = mouth_y + vy * 0.03
            prev = None
            n = 4
            th = P.get('barbelW', 0.006)
            for k in range(n + 1):
                u = k / n
                # 從嘴角往外前方伸出，再往後垂（不能藏在身體裡）
                p = Vector((sgn * (0.014 + ln * 0.62 * u), y0 - ln * 0.22 * u * u - 0.004, z0 + ln * 0.3 * math.sin(math.pi * u * 0.7) - ln * 0.5 * u))
                r = th * (1 - 0.7 * u)
                q = (F.vert(p + Vector((0, r, 0)), bc, False, True), F.vert(p - Vector((0, r, 0)), bc, False, True),
                     F.vert(p + Vector((r * 1.4, 0, 0)), bc, False, True), F.vert(p - Vector((r * 1.4, 0, 0)), bc, False, True))
                if prev:
                    F.quad(prev[0], prev[1], q[1], q[0])
                    F.quad(prev[2], prev[3], q[3], q[2])
                prev = q

    # ---- 特殊：匙吻、鱗板、背脊 ----
    if P.get('snout') == 'paddle':
        pc = hexlin(P['col'].get('paddle', P['col']['back']))
        L = 0.36
        prev = None
        n = 5
        for k in range(n + 1):
            u = k / n
            z = z_snout - 0.01 + L * u
            hw = 0.022 + 0.05 * math.sin(min(1, u * 1.15) * math.pi * 0.62) if u < 0.98 else 0.03
            a = F.vert((hw, 0.012, z), pc)
            b = F.vert((-hw, 0.012, z), pc)
            if prev:
                F.quad(prev[0], prev[1], b, a)
                F.quad(prev[1], prev[0], a, b)
            prev = (a, b)
    if P.get('scutes'):
        sc = hexlin(P['col'].get('scute', '#c8c4b4'))
        for (yrel, side) in ((1.0, 0), (0.15, 1), (0.15, -1)):
            for k in range(11):
                t = 0.18 + k * 0.055
                up, dn, w, cy = shape(t)
                z = z_snout - t * L_body
                if side == 0:
                    base = Vector((0, cy + up * 0.98, z))
                    nrm = Vector((0, 1, 0))
                else:
                    base = Vector((side * w * 0.98, cy + up * 0.12, z))
                    nrm = Vector((side, 0.2, 0)).normalized()
                s = 0.016
                ax = Vector((0, 0, 1))
                sd = nrm.cross(ax).normalized()
                p = [F.vert(base + ax * s * 1.4, sc), F.vert(base + sd * s, sc), F.vert(base - ax * s * 1.4, sc), F.vert(base - sd * s, sc)]
                top = F.vert(base + nrm * s * 1.2, mix(sc, (1, 1, 1, 1), 0.3))
                for q in range(4):
                    F.tri(p[q], p[(q + 1) % 4], top) if side >= 0 else F.tri(p[(q + 1) % 4], p[q], top)

    return finalize(name, F, P)


def body_color(P, C, t, v, ca, i, j):
    """身體頂點色。t：0 吻端～1 尾柄；v：−1 腹～1 背；ca：側向 cos（±1 為左右側中線）。"""
    back, side, belly = C['back'], C['side'], C['belly']
    col = mix(belly, side, sstep(-0.75, -0.25, v))
    col = mix(col, back, sstep(P.get('backLine', 0.35), P.get('backLine', 0.35) + 0.35, v))
    for pat in P.get('pattern', []):
        kind = pat[0]
        if kind == 'grad':          # ('grad', [hex...], vmin, vmax) 沿身體的漸層（彩虹、後半紅）
            cols = [hexlin(h) for h in pat[1]]
            vmin, vmax = pat[2], pat[3]
            if vmin <= v <= vmax:
                x = t * (len(cols) - 1)
                k = min(len(cols) - 2, int(x))
                g = mix(cols[k], cols[k + 1], x - k)
                col = mix(col, g, pat[4] if len(pat) > 4 else 1.0)
        elif kind == 'bars':        # ('bars', n, hex, 寬 0..1, vmin, t0, t1)
            n, c, wd, vmin = pat[1], hexlin(pat[2]), pat[3], pat[4]
            t0, t1 = (pat[5], pat[6]) if len(pat) > 6 else (0.15, 0.95)
            if t0 <= t <= t1 and v >= vmin:
                ph = ((t - t0) / (t1 - t0) * n) % 1.0
                if ph < wd:
                    col = mix(col, c, 0.85)
        elif kind == 'band':        # ('band', v 中心, 半寬, hex, t0, t1)
            vc, hw, c = pat[1], pat[2], hexlin(pat[3])
            t0, t1 = (pat[4], pat[5]) if len(pat) > 5 else (0.0, 1.0)
            if abs(v - vc) <= hw and t0 <= t <= t1 and abs(ca) > 0.2:
                col = mix(col, c, 0.9)
        elif kind == 'spots':       # ('spots', 機率, hex, vmin, vmax, t0, t1)
            pr, c, vmin, vmax = pat[1], hexlin(pat[2]), pat[3], pat[4]
            t0, t1 = (pat[5], pat[6]) if len(pat) > 6 else (0.0, 1.0)
            if vmin <= v <= vmax and t0 <= t <= t1 and _h(i, j, pr * 100, len(pat[2])) < pr:
                col = mix(col, c, 0.95)
        elif kind == 'mottle':      # ('mottle', hex, 量, vmin)
            c, amt, vmin = hexlin(pat[1]), pat[2], pat[3]
            if v >= vmin:
                n = _h(i // 2, j // 2, 3) * 0.6 + _h(i, j, 5) * 0.4
                if n < amt:
                    col = mix(col, c, 0.8)
        elif kind == 'scales':      # ('scales', 暗化 0..1, vmin) 交錯鱗片
            if v >= pat[2] and (i + j) % 2 == 0:
                col = tuple(col[k] * (1 - pat[1]) for k in range(3)) + (1,)
        elif kind == 'patch':       # ('patch', hex, t0, t1, vmin, vmax) 鰓蓋斑、喉部紅斑
            c, t0, t1, vmin, vmax = hexlin(pat[1]), pat[2], pat[3], pat[4], pat[5]
            if t0 <= t <= t1 and vmin <= v <= vmax:
                col = mix(col, c, 0.92)
        elif kind == 'koi':         # ('koi', hex, 機率) 大塊斑紋（鯉的雲斑）
            c, pr = hexlin(pat[1]), pat[2]
            if v > -0.3 and _h(i // 3, (j + (1 if ca > 0 else 0)) // 3, 11) < pr:
                col = mix(col, c, 0.9)
    return col


def median_fin(F, P, C, d, base_y, z_snout, L_body, sgn, fcol_hex, seed=0):
    t0, t1, h, shape = d
    col = fcol_hex if isinstance(fcol_hex, tuple) else hexlin(fcol_hex) if isinstance(fcol_hex, str) else fcol_hex
    edge = C.get('finEdge', col)
    n = max(3, int((t1 - t0) * 30) + 2)
    prev = None
    for k in range(n + 1):
        u = k / n
        t = t0 + (t1 - t0) * u
        z = z_snout - t * L_body
        if shape == 'tri':
            hh = h * (1 - u) ** 0.8 * (0.35 + 0.65 * min(1, u / 0.15 + 0.4))
        elif shape == 'round':
            hh = h * math.sin(math.pi * min(0.999, 0.15 + u * 0.85)) ** 0.7
        elif shape == 'sail':
            hh = h * (0.55 + 0.45 * math.sin(math.pi * u * 0.85)) * (1 - 0.15 * u)
        elif shape == 'spiny':
            hh = h * (0.9 - 0.45 * u) * (1.0 if k % 2 == 0 else 0.62)
        elif shape == 'long':
            hh = h * (0.6 + 0.4 * math.sin(math.pi * u)) * (1 if u < 0.97 else 0.5)
        else:
            hh = h
        if k == 0 or k == n:
            hh *= 0.25
        sweep = hh * 0.55
        by = base_y(t)
        cc = mix(col, edge, 0.0)
        a = F.vert((0, by, z), col, False)
        b = F.vert((0, by + sgn * hh, z - sweep), mix(col, edge, 0.7), False)
        if prev:
            if sgn > 0:
                F.quad(prev[0], a, b, prev[1])
            else:
                F.quad(prev[0], prev[1], b, a)
        prev = (a, b)


def caudal(F, P, C, z_ped, upP, dnP):
    col = hexlin(P['col']['tail']) if 'tail' in P['col'] else C.get('fin', C['side'])
    edge = C.get('finEdge', col)
    low = hexlin(P['col']['tailLow']) if 'tailLow' in P['col'] else col
    H = P['depth'] / 2 * P['tailH'] * 2.0
    Lt = P['tailLen']
    typ = P['caudal']
    K = 10
    zEnd = z_ped - Lt
    pts = []
    for k in range(K + 1):
        s = 1 - 2 * k / K     # 1 上葉尖 .. −1 下葉尖
        if typ in ('fork', 'emarg', 'trunc', 'lunate'):
            fk = P['fork'] if typ != 'trunc' else 0.06
            if typ == 'lunate':
                fk = 0.7
            z = zEnd + Lt * fk * (1 - abs(s)) ** 1.15
            y = s * H
        elif typ == 'round':
            z = zEnd + Lt * 0.38 * abs(s) ** 1.8
            y = s * H * 0.92
        elif typ == 'hetero':
            if s >= 0:
                y = s * H * 1.15
                z = zEnd - Lt * 0.15 * s + Lt * 0.55 * (1 - s) ** 1.3
            else:
                y = s * H * 0.55
                z = zEnd + Lt * 0.35 + Lt * 0.25 * (1 + s) ** 1.2 * 0
                z = zEnd + Lt * (0.55 - 0.2 * (-s))
        else:
            z = zEnd
            y = s * H
        pts.append((y, z))
    r_up, r_dn = upP * 0.9, -dnP * 0.9
    roots = []
    mids = []
    ends = []
    for k, (y, z) in enumerate(pts):
        s = 1 - 2 * k / K
        ry = r_dn + (r_up - r_dn) * (k / K) if False else r_up + (r_dn - r_up) * (k / K)
        cc = low if s < -0.1 else col
        roots.append(F.vert((0, ry, z_ped + 0.01), cc, False))
        mids.append(F.vert((0, (ry + y) / 2, (z_ped + z) / 2), cc, False))
        ends.append(F.vert((0, y, z), mix(cc, edge, 0.75), False))
    for k in range(K):
        F.quad(roots[k], mids[k], mids[k + 1], roots[k + 1])
        F.quad(mids[k], ends[k], ends[k + 1], mids[k + 1])


def finalize(name, F, P):
    # 依身體＋尾鰭的 z 範圍把全長正規化成 1.0，原點放在包圍盒中心
    zs = [F.v[i].z for i in range(len(F.v)) if i not in F.loose]
    zmin, zmax = min(zs), max(zs)
    ys = [F.v[i].y for i in F.body_idx]
    yc = (min(ys) + max(ys)) / 2
    s = 1.0 / (zmax - zmin)
    zc = (zmin + zmax) / 2
    verts = [((p.x) * s, -(p.z - zc) * s, (p.y - yc) * s) for p in F.v]   # → Blender (x, −z, y)
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], F.f)
    ca = me.color_attributes.new('Color', 'BYTE_COLOR', 'POINT')
    for i, c in enumerate(F.c):
        ca.data[i].color = c
    me.color_attributes.active_color = ca
    me.color_attributes.render_color_index = 0
    for p in me.polygons:
        p.use_smooth = True
    me.validate(clean_customdata=False)
    me.update()
    o = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(o)
    return o
