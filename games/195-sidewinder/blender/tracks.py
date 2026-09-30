# 四條賽道：中心線、地面種類、高度函數、擺設、貼圖顏色。
# 純 numpy（不依賴 bpy），build_all.py 再把結果做成 Blender 網格與影像。
# 座標皆為遊戲座標 (x, z)，Z 朝南；path 依行車方向排列。
import math

import numpy as np

from common import (
    CELL, GW, GH, ORIGIN_X, ORIGIN_Z, PX_PER_M, ALBEDO_SS,
    DIRT, LOOSE, MUD, WATER, JUMP, RAMP, WALL, INFIELD,
    F_JUMP, F_WATER, F_MUD, F_CHECK, F_RAMP, MESH_ID,
    fbm, value_noise, cellular, smoothstep, hex_rgb, XorShift32,
)

PATH_STEP = 1.75      # path 點間距（公尺）
DENSE_STEP = 0.25     # 內部中心線取樣
WALL_MIN = 1.5        # 相鄰車道間牆的最小厚度
BORDER = 2            # 外框強制 WALL 的格數


def arc(cx, cz, r, a0, a1):
    # 以角度（度）描述的圓弧，a 從 +X 往 +Z（畫面順時針）
    n = max(2, int(abs(a1 - a0) / 180 * math.pi * r / 1.6) + 1)
    return [(cx + r * math.cos(math.radians(a0 + (a1 - a0) * k / n)),
             cz + r * math.sin(math.radians(a0 + (a1 - a0) * k / n))) for k in range(n + 1)]


def _expand(items):
    pts = []
    for it in items:
        seq = it if isinstance(it, list) else [it]
        for p in seq:
            if not pts or math.dist(pts[-1], p) > 0.8:
                pts.append((float(p[0]), float(p[1])))
    if math.dist(pts[0], pts[-1]) < 0.8:
        pts.pop()
    return pts


# ---------- 賽道定義 ----------
# 特徵位置用 (x, z) 標在中心線附近，產生器會投影到弧長 s。
# jump：at = 跳台唇口；table/hill：at = 中心；water/mud/sand：at = 中心，len 長度，lat = 橫向範圍（右正）。
# apron：可通行的內場草地（INFIELD）加寬，side = +1 右 / -1 左。
# walls：(u0, u1, 樣式) 依圈進度 u 決定牆上擺設：tire / hay / berm。

TRACKS = [
    dict(
        id=0, name='Sidewinder Gulch', seed=1951, hw=3.6, sh=0.8,
        pts=[(-8, 16.8), (2, 16.8), (12, 16.8), arc(22.5, 11.55, 5.25, 90, -90),
             (12, 6.3), (2, 6.3), (-4, 6.3), arc(-10, 1.05, 5.25, 90, 270),
             (-4, -4.2), (6, -4.2), (16, -4.2), arc(22.5, -9.45, 5.25, 90, -90),
             (12, -14.7), (0, -14.7), (-12, -14.7), (-22, -14.7), arc(-23.5, -9.7, 5, -90, -180),
             (-28.5, -2), (-28.5, 6), arc(-23.5, 11.8, 5, 180, 90), (-16, 16.8)],
        feats=[
            dict(t='jump', at=(9, 16.8), up=4.0, h=1.0),
            dict(t='mud', at=(27.6, 11.5), len=11, depth=0.07),
            dict(t='water', at=(4, 6.3), len=9, lat=(-3.2, 4.4), depth=0.22),
            dict(t='table', at=(7, -4.2), up=6, top=5, down=6, h=1.3),
            dict(t='jump', at=(-4, -14.7), up=4.5, h=1.3),
            dict(t='hill', at=(-28.5, 2), up=8, top=2, down=8, h=1.5),
            dict(t='sand', at=(-18, 16.8), len=9, lat=(0.5, 4.4)),
            dict(t='sand', at=(-10, 1.0), len=10, lat=(-4.4, -1.5)),
            dict(t='apron', at=(-27.2, 15.5), len=10, side=1, w=2.2),
        ],
        walls=[(0.0, 0.18, 'hay'), (0.18, 0.72, 'tire'), (0.72, 0.9, 'berm'), (0.9, 1.0, 'hay')],
        stands=[(-12, -22.0), (10, -22.0)],
    ),
    dict(
        id=1, name='Dry Wash', seed=1952, hw=3.6, sh=0.8,
        pts=[(29, -1.5), (29, -7.5), arc(24, -10, 5, 0, -90), (20, -15),
             arc(18.5, -10.5, 4.5, -90, -180), (14, -5.5), arc(8.75, -0.5, 5.25, 0, 180),
             (3.5, -5.5), arc(-1, -10.5, 4.5, 0, -90), (-8, -15), (-16, -15), (-24, -15),
             arc(-24, -10, 5, -90, -180), (-29, -3), (-29, 5), arc(-24, 11.5, 5, 180, 90),
             (-16, 16.1), (-8, 16.9), (0, 15.9), (8, 16.9), (16, 16.3), arc(24, 11.5, 5, 90, 0), (29, 5)],
        feats=[
            dict(t='water', at=(-1, 16.4), len=34, lat=(-3.6, 3.2), depth=0.18),
            dict(t='water', at=(8.75, 4.75), len=7, depth=0.22),
            dict(t='jump', at=(-12, -15), up=4.0, h=1.1),
            dict(t='jump', at=(14, -4.5), up=3.5, h=0.9),
            dict(t='hill', at=(-29, 1), up=7, top=2, down=7, h=1.4),
            dict(t='mud', at=(-27.4, -13.4), len=7, depth=0.06),
            dict(t='sand', at=(-20, 16.0), len=8, lat=(-4.4, -0.8)),
            dict(t='sand', at=(20, 16.0), len=8, lat=(1.0, 4.4)),
            dict(t='sand', at=(24, -15), len=6, lat=(0.8, 4.4)),
            dict(t='apron', at=(26.6, 13.7), len=9, side=1, w=2.0),
        ],
        walls=[(0.0, 0.5, 'hay'), (0.5, 0.62, 'berm'), (0.62, 1.0, 'hay')],
        stands=[(-14, -22.4), (22, -22.4)],
    ),
    dict(
        id=2, name='Mudflat Basin', seed=1953, hw=4.0, sh=0.8,
        pts=[(-8, -15), (4, -15), (14, -15), arc(22, -8, 7, -90, 0), (29, -2), (29, 3),
             arc(22, 9.5, 7, 0, 90), (16, 16.2), (12, 13), (8, 7.5),
             arc(0, 2, 5.6, 12, -192), (-8, 7.5), (-12, 13), (-16, 16.2),
             arc(-22, 9.5, 7, 90, 180), (-29, 3), (-29, -2), arc(-22, -8, 7, 180, 270)],
        feats=[
            dict(t='mud', at=(3, -15), len=16, depth=0.09),
            dict(t='mud', at=(27.5, 14.2), len=10, depth=0.07),
            dict(t='mud', at=(0, -3.6), len=13, depth=0.08),
            dict(t='mud', at=(-29, -1), len=10, lat=(-4.8, 0.6), depth=0.06),
            dict(t='mud', at=(10.4, 10.5), len=6, lat=(-1.5, 4.8), depth=0.06),
            dict(t='water', at=(-20, 16.2), len=7, depth=0.2),
            dict(t='jump', at=(29, 1.5), up=4.0, h=1.0),
            dict(t='hill', at=(-10, 10.2), up=5, top=1, down=5, h=1.1),
            dict(t='sand', at=(19, 16.2), len=6, lat=(-4.8, -1.0)),
            dict(t='apron', at=(-26.9, -12.9), len=8, side=-1, w=1.7),
            dict(t='apron', at=(26.9, -12.9), len=8, side=-1, w=1.7),
        ],
        walls=[(0.0, 0.2, 'berm'), (0.2, 0.32, 'tire'), (0.32, 0.62, 'berm'), (0.62, 0.82, 'tire'), (0.82, 1.0, 'berm')],
        stands=[(-12, -22.6), (12, -22.6)],
    ),
    dict(
        id=3, name='Anvil Mesa', seed=1954, hw=3.6, sh=0.8,
        pts=[(-6, -15), (6, -15), (16, -15), arc(24, -9.75, 5.25, -90, 90), (18, -4.5),
             arc(14, 0, 4.5, -90, -180), arc(14, 1.8, 4.5, 180, 90), (18, 6.3),
             arc(22, 11.55, 5.25, -90, 90), (14, 16.8), (4, 16.8), (-6, 16.8), (-16, 16.8),
             arc(-22, 11.55, 5.25, 90, 270), (-18, 6.3), arc(-14, 1.8, 4.5, 90, 0),
             arc(-14, 0, 4.5, 0, -90), (-18, -4.5), arc(-24, -9.75, 5.25, 90, 270), (-16, -15)],
        feats=[
            dict(t='jump', at=(-1, -15), up=4.0, h=1.2),
            dict(t='jump', at=(15, -15), up=4.0, h=1.0),
            dict(t='whoops', at=(21.5, -4.5), n=4, sp=2.6, h=0.32),
            dict(t='jump', at=(9, 16.8), up=4.5, h=1.4),
            dict(t='table', at=(-7, 16.8), up=5, top=5, down=5, h=1.3),
            dict(t='mud', at=(-21, -4.5), len=6, depth=0.06),
            dict(t='water', at=(-27.2, 11.55), len=7, depth=0.2),
            dict(t='sand', at=(18, 6.3), len=6, lat=(-4.4, -0.8)),
            dict(t='sand', at=(-17, 6.3), len=6, lat=(0.8, 4.4)),
        ],
        walls=[(0.0, 1.0, 'tire')],
        stands=[(-11, -22.4), (11, -22.4)],
        mesa=(0.0, 1.0, 9.0, 8.0, 2.2),   # 中央台地：cx, cz, 寬, 深, 高
    ),
]


# ---------- 中心線 ----------

def _catmull(pts, per=12):
    # 向心 Catmull-Rom，封閉
    P = np.array(pts, dtype=np.float64)
    n = len(P)
    out = []
    for i in range(n):
        p0, p1, p2, p3 = P[(i - 1) % n], P[i], P[(i + 1) % n], P[(i + 2) % n]

        def tj(ti, a, b):
            return ti + max(np.linalg.norm(b - a), 1e-6) ** 0.5
        t0 = 0.0
        t1 = tj(t0, p0, p1)
        t2 = tj(t1, p1, p2)
        t3 = tj(t2, p2, p3)
        for k in range(per):
            t = t1 + (t2 - t1) * k / per
            a1 = (t1 - t) / (t1 - t0) * p0 + (t - t0) / (t1 - t0) * p1
            a2 = (t2 - t) / (t2 - t1) * p1 + (t - t1) / (t2 - t1) * p2
            a3 = (t3 - t) / (t3 - t2) * p2 + (t - t2) / (t3 - t2) * p3
            b1 = (t2 - t) / (t2 - t0) * a1 + (t - t0) / (t2 - t0) * a2
            b2 = (t3 - t) / (t3 - t1) * a2 + (t - t1) / (t3 - t1) * a3
            out.append((t2 - t) / (t2 - t1) * b1 + (t - t1) / (t2 - t1) * b2)
    return np.array(out)


def _resample(poly, step):
    seg = np.linalg.norm(np.roll(poly, -1, axis=0) - poly, axis=1)
    cum = np.concatenate([[0.0], np.cumsum(seg)])
    L = cum[-1]
    n = max(8, int(round(L / step)))
    s = np.arange(n) * (L / n)
    closed = np.vstack([poly, poly[:1]])
    x = np.interp(s, cum, closed[:, 0])
    z = np.interp(s, cum, closed[:, 1])
    return np.stack([x, z], axis=1), s, L


class Centerline:
    def __init__(self, pts):
        poly = _catmull(_expand(pts))
        self.P, self.S, self.L = _resample(poly, DENSE_STEP)
        self.N = len(self.P)
        nxt = np.roll(self.P, -1, axis=0)
        self.D = nxt - self.P
        self.len = np.linalg.norm(self.D, axis=1)
        self.T = self.D / self.len[:, None]

    def at(self, s):
        # 弧長 s → 位置、切線
        s = np.mod(s, self.L)
        closed = np.vstack([self.P, self.P[:1]])
        cum = np.concatenate([self.S, [self.L]])
        x = np.interp(s, cum, closed[:, 0])
        z = np.interp(s, cum, closed[:, 1])
        k = np.minimum((s / self.L * self.N).astype(int), self.N - 1)
        return np.stack([x, z], axis=-1), self.T[k]

    def project(self, qx, qz, chunk=1024):
        # 每個查詢點 → 最近中心線距離 d、弧長 s、橫向位移 lat（右正）
        qx = np.asarray(qx, dtype=np.float64).ravel()
        qz = np.asarray(qz, dtype=np.float64).ravel()
        d = np.empty(qx.shape)
        s = np.empty(qx.shape)
        lat = np.empty(qx.shape)
        Px, Pz = self.P[:, 0], self.P[:, 1]
        Dx, Dz = self.D[:, 0], self.D[:, 1]
        l2 = self.len ** 2
        for a in range(0, len(qx), chunk):
            x = qx[a:a + chunk, None]
            z = qz[a:a + chunk, None]
            t = np.clip(((x - Px) * Dx + (z - Pz) * Dz) / l2, 0, 1)
            cx, cz = Px + t * Dx, Pz + t * Dz
            dd = (x - cx) ** 2 + (z - cz) ** 2
            k = np.argmin(dd, axis=1)
            r = np.arange(len(k))
            d[a:a + chunk] = np.sqrt(dd[r, k])
            s[a:a + chunk] = self.S[k] + t[r, k] * self.len[k]
            tx, tz = self.T[k, 0], self.T[k, 1]
            lat[a:a + chunk] = (x[:, 0] - cx[r, k]) * (-tz) + (z[:, 0] - cz[r, k]) * tx
        return d, s, lat

    def s_of(self, x, z):
        return float(self.project([x], [z])[1][0])


def cyc(s, s0, L):
    # 從 s0 起算的帶號弧長差，範圍 [-L/2, L/2)
    return np.mod(np.asarray(s) - s0 + L / 2, L) - L / 2


# ---------- 特徵 ----------

class Track:
    def __init__(self, td):
        self.td = td
        self.rng_seed = td['seed']
        self.cl = Centerline(td['pts'])
        L = self.cl.L
        self.hw, self.sh = td['hw'], td['sh']
        self.feats = []
        for f in td['feats']:
            f = dict(f)
            f['s'] = self.cl.s_of(*f['at'])
            self.feats.append(f)
        # 中心線上的地形起伏（橫向常數，車子在跳台上不會側傾）
        cx, cz = self.cl.P[:, 0], self.cl.P[:, 1]
        base = 0.22 * fbm(cx / 22, cz / 22, td['seed'], 3)
        # 沿弧長平滑
        k = np.ones(25) / 25
        ext = np.concatenate([base[-12:], base, base[:12]])
        self.base_s = np.convolve(ext, k, mode='valid')
        self.L = L

    # 沿弧長的高度剖面（不含橫向）
    def h_along(self, s):
        L = self.L
        cum = np.concatenate([self.cl.S, [L]])
        h = np.interp(np.mod(s, L), cum, np.concatenate([self.base_s, self.base_s[:1]]))
        for f in self.feats:
            u = cyc(s, f['s'], L)
            if f['t'] == 'jump':
                up = f['up']
                a = np.clip((u + up) / up, 0, 1)
                rise = f['h'] * a ** 1.6
                drop = f['h'] * np.clip(1 - u / 0.5, 0, 1)
                h = h + np.where(u <= 0, np.where(u >= -up, rise, 0.0), np.where(u < 0.5, drop, 0.0))
            elif f['t'] in ('table', 'hill'):
                up, top, dn = f['up'], f['top'], f['down']
                a0 = -(up + top / 2)
                r = smoothstep(a0, a0 + up, u) * (1 - smoothstep(top / 2, top / 2 + dn, u))
                h = h + f['h'] * r
            elif f['t'] == 'whoops':
                span = f['n'] * f['sp']
                v = u + span / 2
                bump = 0.5 * (1 - np.cos(2 * math.pi * v / f['sp']))
                h = h + np.where((v >= 0) & (v <= span), f['h'] * bump, 0.0)
        return h

    def kind_along(self, s):
        # 沿弧長的標記（JUMP / RAMP），-1 表示無
        k = np.full(np.shape(s), -1, dtype=np.int16)
        for f in self.feats:
            u = cyc(s, f['s'], self.L)
            if f['t'] == 'jump':
                k = np.where((u >= -f['up']) & (u <= 0.5), JUMP, k)
            elif f['t'] == 'whoops':
                span = f['n'] * f['sp']
                k = np.where(np.abs(u) <= span / 2, JUMP, k)
            elif f['t'] in ('table', 'hill'):
                a0 = -(f['up'] + f['top'] / 2)
                slope = ((u >= a0) & (u <= a0 + f['up'])) | ((u >= f['top'] / 2) & (u <= f['top'] / 2 + f['down']))
                k = np.where(slope, RAMP, k)
        return k

    def patch(self, f, s, lat, x, z):
        # 泥地／水坑／沙地的「內側距離」：> 0 在範圍內（公尺），超橢圓外形 + 雜訊邊緣
        u = cyc(s, f['s'], self.L)
        lo, hi = f.get('lat', (-(self.hw + self.sh), self.hw + self.sh))
        a = np.abs(u) / (f['len'] / 2)
        b = np.abs(lat - (lo + hi) / 2) / ((hi - lo) / 2)
        r = (a ** 3 + b ** 3) ** (1 / 3)
        inside = (1 - r) * min(f['len'] / 2, (hi - lo) / 2)
        inside = np.minimum(inside, np.minimum(lat - lo + 0.6, hi - lat + 0.6))
        return inside + 0.8 * fbm(x / 2.2, z / 2.2, self.rng_seed + len(f['t']) * 7 + int(f['s']), 3)

    def apron(self, s, lat):
        w = np.zeros(np.shape(s))
        for f in self.feats:
            if f['t'] != 'apron':
                continue
            u = cyc(s, f['s'], self.L)
            m = 1 - smoothstep(f['len'] / 2 - 3, f['len'] / 2, np.abs(u))
            w = np.maximum(w, np.where(np.sign(lat) == f['side'], f['w'] * m, 0.0))
        return w

    # ---------- 場地欄位（格點或像素） ----------
    def fields(self, x, z):
        d, s, lat = self.cl.project(x, z)
        x = np.asarray(x, dtype=np.float64).ravel()
        z = np.asarray(z, dtype=np.float64).ravel()
        hw, sh = self.hw, self.sh
        pass_r = hw + sh + self.apron(s, lat)
        kind = np.full(d.shape, WALL, dtype=np.int16)
        kind = np.where(d <= pass_r, INFIELD, kind)
        kind = np.where(d <= hw + sh, LOOSE, kind)
        kind = np.where(d <= hw, DIRT, kind)
        passable = d <= pass_r
        ka = self.kind_along(s)
        kind = np.where(passable & (d <= hw + sh) & (ka >= 0), ka, kind)
        h = self.h_along(s)
        h = h - 0.05 * smoothstep(hw, hw + sh, d)
        water_in = np.full(d.shape, -9.0)
        mud_in = np.full(d.shape, -9.0)
        for f in self.feats:
            if f['t'] not in ('water', 'mud', 'sand'):
                continue
            ins = self.patch(f, s, lat, x, z)
            ins = np.where(d <= hw + sh, ins, np.minimum(ins, hw + sh - d))
            if f['t'] == 'water':
                water_in = np.maximum(water_in, ins)
            elif f['t'] == 'mud':
                mud_in = np.maximum(mud_in, ins)
                h = h + np.where(ins > -0.3, -f['depth'] * smoothstep(-0.3, 1.2, ins)
                                 + 0.03 * fbm(x * 1.7, z * 1.7, 77, 2), 0.0)
            else:
                kind = np.where(passable & (ins > 0) & (kind == DIRT), LOOSE, kind)
        for f in self.feats:
            if f['t'] == 'water':
                ins = np.where(d <= hw + sh, self.patch(f, s, lat, x, z), -9)
                h = h - f['depth'] * smoothstep(-0.2, 1.4, ins)
        kind = np.where(passable & (mud_in > 0), MUD, kind)
        kind = np.where(passable & (water_in > 0), WATER, kind)
        h = np.where(kind == INFIELD, h + 0.04 * fbm(x, z, 5, 2), h)
        return dict(d=d, s=s, lat=lat, kind=kind, h=h, pass_r=pass_r, t=d - pass_r,
                    water_in=water_in, mud_in=mud_in, x=x, z=z)

    def ground(self, x, z):
        g = 0.22 * fbm(np.asarray(x) / 22, np.asarray(z) / 22, self.td['seed'], 3)
        m = self.td.get('mesa')
        if m:
            cx, cz, w, dp, hh = m
            r = np.maximum(np.abs(np.asarray(x) - cx) / (w / 2), np.abs(np.asarray(z) - cz) / (dp / 2))
            g = g + hh * (1 - smoothstep(0.75, 1.15, r + 0.12 * fbm(np.asarray(x) / 2, np.asarray(z) / 2, 9, 2)))
        return g


# ---------- 產生 ----------

def _dilate_mean(h, mask, it):
    # 把 mask 內的高度逐圈往外擴散（取已知的上下左右鄰格平均），回傳擴散後高度（未觸及為 nan）
    # 只用 4 鄰格：貼著直線路邊的牆格高度 = 旁邊那一格路面，跳台唇口旁也不會被平均掉
    cur = np.where(mask, h, np.nan)
    for _ in range(it):
        p = np.pad(cur, 1, constant_values=np.nan)
        nb = np.stack([p[1 + dy:1 + dy + cur.shape[0], 1 + dx:1 + dx + cur.shape[1]]
                       for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1))])
        cnt = np.sum(np.isfinite(nb), axis=0)
        avg = np.nansum(nb, axis=0) / np.maximum(cnt, 1)
        cur = np.where(np.isfinite(cur), cur, np.where(cnt > 0, avg, np.nan))
    return cur


def _dist_to(mask):
    # 每格到最近 mask 格的距離（公尺），暴力分塊計算；mask 內為 0
    src = np.argwhere(mask).astype(np.float64)
    out = np.zeros(mask.shape)
    dst = np.argwhere(~mask)
    for a in range(0, len(dst), 512):
        q = dst[a:a + 512].astype(np.float64)
        d2 = (q[:, None, 0] - src[None, :, 0]) ** 2 + (q[:, None, 1] - src[None, :, 1]) ** 2
        out[dst[a:a + 512, 0], dst[a:a + 512, 1]] = np.sqrt(d2.min(axis=1)) * CELL
    return out


def flood(passable, start_ij):
    # 4 連通淹沒填充
    gh, gw = passable.shape
    seen = np.zeros_like(passable, dtype=bool)
    stack = [start_ij]
    while stack:
        j, i = stack.pop()
        if j < 0 or j >= gh or i < 0 or i >= gw or seen[j, i] or not passable[j, i]:
            continue
        seen[j, i] = True
        stack.extend(((j + 1, i), (j - 1, i), (j, i + 1), (j, i - 1)))
    return seen


def cell_of(x, z):
    return int(round((z - ORIGIN_Z) / CELL)), int(round((x - ORIGIN_X) / CELL))


def generate(td, log=print):
    tr = Track(td)
    cl = tr.cl
    ii, jj = np.meshgrid(np.arange(GW), np.arange(GH))
    gx = ORIGIN_X + ii * CELL
    gz = ORIGIN_Z + jj * CELL
    F = tr.fields(gx, gz)
    kind = F['kind'].reshape(GH, GW)
    h = F['h'].reshape(GH, GW)
    t = F['t'].reshape(GH, GW)
    # 外框
    kind[:BORDER, :] = WALL
    kind[-BORDER:, :] = WALL
    kind[:, :BORDER] = WALL
    kind[:, -BORDER:] = WALL
    # 清掉路肩邊緣零星的單格牆（相對兩側都能通行），改成鬆土
    for _ in range(3):
        pw = np.pad(kind != WALL, 1, constant_values=False)
        lr = pw[1:-1, :-2] & pw[1:-1, 2:]
        ud = pw[:-2, 1:-1] & pw[2:, 1:-1]
        speck = (kind == WALL) & (lr | ud)
        speck[:BORDER, :] = speck[-BORDER:, :] = False
        speck[:, :BORDER] = speck[:, -BORDER:] = False
        if not speck.any():
            break
        kind[speck] = LOOSE
    passable = kind != WALL
    t = _dist_to(passable) - CELL / 2       # 牆格到最近可通行格的距離（公尺）
    # 牆：貼著路面的格子只比路面高一點，往外才隆起成土堤，再回落到原地形
    near = _dilate_mean(h, passable, 4)
    g = tr.ground(gx, gz)
    ridge = 0.8 * smoothstep(0.0, 1.3, t) * (1 - smoothstep(1.6, 3.2, t))
    wall_h = np.where(np.isfinite(near), near, g) + ridge
    far = smoothstep(1.4, 4.0, t)
    wall_h = wall_h * (1 - far) + (g + 0.35 * ridge) * far
    h = np.where(passable, h, wall_h)
    heights_cm = np.clip(np.round(h * 100), -32000, 32000).astype(np.int16)

    # path
    L = cl.L
    n_path = int(round(L / PATH_STEP))
    ps = np.arange(n_path) * (L / n_path)
    ppos, ptan = cl.at(ps)
    ka = tr.kind_along(ps)
    flags = np.zeros(n_path, dtype=np.uint32)
    flags |= np.where(ka == JUMP, F_JUMP, 0).astype(np.uint32)
    flags |= np.where(ka == RAMP, F_RAMP, 0).astype(np.uint32)
    for f in tr.feats:
        if f['t'] in ('table', 'hill'):
            half = f['up'] + f['top'] / 2 + 0.5
            flags |= np.where(np.abs(cyc(ps, f['s'], L)) <= half, F_RAMP, 0).astype(np.uint32)
    Fp = tr.fields(ppos[:, 0], ppos[:, 1])
    flags |= np.where(Fp['water_in'] > -1.5, F_WATER, 0).astype(np.uint32)
    flags |= np.where(Fp['mud_in'] > -1.5, F_MUD, 0).astype(np.uint32)
    n_check = 6
    for k in range(1, n_check):
        flags[int(round(k * n_path / n_check))] |= F_CHECK
    path = [(float(ppos[k, 0]), float(ppos[k, 1]), float(tr.hw), int(flags[k])) for k in range(n_path)]

    # 發車格：起點線後方 2×2 交錯，0 號在第一個彎的內側
    fwd_turn = 0.0
    for k in range(1, 40):
        a = cl.T[int(k * 1.0 / DENSE_STEP) % cl.N]
        b = cl.T[int((k + 1) * 1.0 / DENSE_STEP) % cl.N]
        fwd_turn += a[0] * b[1] - a[1] * b[0]
    inside = 1.0 if fwd_turn > 0 else -1.0     # 右轉（yaw 增加）→ 內側在右
    start = []
    for back, side in ((3.5, inside), (5.0, -inside), (8.5, inside), (10.0, -inside)):
        p, tn = cl.at(np.array([-back]))
        p, tn = p[0], tn[0]
        nrm = np.array([-tn[1], tn[0]])
        q = p + nrm * 1.8 * side
        start.append((float(q[0]), float(q[1]), float(math.atan2(tn[1], tn[0]))))

    # 道具點：避開起跑區與特徵
    avoid = [(0.0, 16.0)]
    for f in tr.feats:
        if f['t'] == 'jump':
            avoid.append((f['s'] - f['up'] / 2, f['up'] / 2 + 4))
        elif f['t'] in ('table', 'hill'):
            avoid.append((f['s'], f['up'] + f['top'] / 2 + 2))
        elif f['t'] == 'whoops':
            avoid.append((f['s'], f['n'] * f['sp'] / 2 + 2))
        elif f['t'] in ('water', 'mud'):
            avoid.append((f['s'], f['len'] / 2 + 2))
    pickups = []
    for k in range(8):
        s0 = (k + 0.5) / 8 * L
        for tries in range(80):
            sk = s0 + (tries // 2 + 1) * 1.5 * (1 if tries % 2 == 0 else -1) if tries else s0
            if any(abs(float(cyc(sk, a, L))) < r for a, r in avoid):
                continue
            p, tn = cl.at(np.array([sk]))
            lat = 1.4 if k % 2 == 0 else -1.4
            q = p[0] + np.array([-tn[0][1], tn[0][0]]) * lat
            j, i = cell_of(q[0], q[1])
            if kind[j, i] in (DIRT, LOOSE) and all(math.dist(q, pp) > 8 for pp in pickups):
                pickups.append((float(q[0]), float(q[1])))
                break
        else:
            raise RuntimeError(f'賽道 {td["id"]} 找不到第 {k} 個道具點')

    # 自我檢查：淹沒填充不可碰外框，且涵蓋整條 path 與發車格
    sj, si = cell_of(start[0][0], start[0][1])
    reach = flood(passable, (sj, si))
    assert not reach[0, :].any() and not reach[-1, :].any() and not reach[:, 0].any() and not reach[:, -1].any()
    for (x, z, _, _) in path:
        assert reach[cell_of(x, z)], f'path 點不可達 {x:.1f},{z:.1f}'
    for (x, z, _) in start:
        assert reach[cell_of(x, z)], '發車格不可達'
    sep = _min_separation(ppos, L, tr.hw + tr.sh)
    log(f'  [{td["id"]}] {td["name"]}: L={L:.1f} m, path={n_path}, 最小車道間距 {sep:.2f} m, '
        f'可達格 {int(reach.sum())} / 可通行 {int(passable.sum())}')

    props = place_props(tr, kind, h, t, reach, path, start)
    th = float(np.mean(h[reach]))
    camera = [0.0, th, 0.0, -math.pi / 2, 0.95, (GW - 1) * CELL, (GH - 1) * CELL, 0.0]
    return dict(
        id=td['id'], name=td['name'], gw=GW, gh=GH, cell=CELL, origin_x=ORIGIN_X, origin_z=ORIGIN_Z,
        laps=4, camera=camera, heights=h, heights_cm=heights_cm, kinds=kind.astype(np.uint8),
        path=path, start=start, pickups=pickups, props=props, track=tr, reach=reach, length=L,
    )


def _min_separation(ppos, L, corridor):
    # 弧長相距夠遠的兩點之間，中心線最近距離
    n = len(ppos)
    step = L / n
    gap = int(math.ceil(math.pi * (corridor + WALL_MIN) / step)) + 2
    best = 1e9
    for a in range(n):
        dd = np.linalg.norm(ppos - ppos[a], axis=1)
        idx = np.arange(n)
        cyc_d = np.minimum(np.abs(idx - a), n - np.abs(idx - a))
        m = dd[cyc_d > gap]
        if len(m):
            best = min(best, float(m.min()))
    return best


# ---------- 擺設 ----------

def _bilinear(h, x, z):
    fi = (x - ORIGIN_X) / CELL
    fj = (z - ORIGIN_Z) / CELL
    i0 = int(np.clip(math.floor(fi), 0, GW - 2))
    j0 = int(np.clip(math.floor(fj), 0, GH - 2))
    u, v = min(max(fi - i0, 0), 1), min(max(fj - j0, 0), 1)
    return float(h[j0, i0] * (1 - u) * (1 - v) + h[j0, i0 + 1] * u * (1 - v)
                 + h[j0 + 1, i0] * (1 - u) * v + h[j0 + 1, i0 + 1] * u * v)


def _footprint_ok(kind, x, z, yaw, lx, lz, margin=0.0):
    # 以 (x,z) 為中心、沿 yaw 的 lx × lz 矩形，範圍內都要是 WALL 且在網格內
    c, s = math.cos(yaw), math.sin(yaw)
    for a in np.linspace(-lx / 2 - margin, lx / 2 + margin, max(2, int(lx / 0.4) + 2)):
        for b in np.linspace(-lz / 2 - margin, lz / 2 + margin, max(2, int(lz / 0.4) + 2)):
            px, pz = x + a * c - b * s, z + a * s + b * c
            j, i = cell_of(px, pz)
            if not (0 <= j < GH and 0 <= i < GW) or kind[j, i] != WALL:
                return False
    return True


def place_props(tr, kind, h, t, reach, path, start):
    td = tr.td
    cl = tr.cl
    L = cl.L
    rng = XorShift32(td['seed'] * 2654435761 & 0xFFFFFFFF)
    props = []
    taken = []   # (x, z, r)

    def free(x, z, r):
        return all(math.hypot(x - a, z - b) > r + rr for a, b, rr in taken)

    def add(name, x, z, yaw, sc=1.0, r=0.8):
        props.append((MESH_ID[name], float(x), _bilinear(h, x, z), float(z), float(yaw), float(sc)))
        taken.append((x, z, r))

    # 起終點拱門：跨在 path[0] 上
    p0, t0 = cl.at(np.array([0.0]))
    yaw0 = math.atan2(t0[0][1], t0[0][0])
    span = tr.hw + tr.sh + 0.75
    add('start_arch', p0[0][0], p0[0][1], yaw0, span / 5.3, r=0.1)
    nrm0 = np.array([-t0[0][1], t0[0][0]])
    for sd in (-1, 1):
        q = p0[0] + nrm0 * span * sd
        taken.append((q[0], q[1], 1.2))

    # 看台（北側，面向南方賽道：yaw = +π/2）
    for (x, z) in td['stands']:
        ok = False
        for dz in (0, -0.3, 0.3, -0.6, 0.6):
            for dx in (0, 1, -1, 2, -2, 3, -3):
                xx, zz = x + dx, z + dz
                circ = [(xx + o, zz, 1.7) for o in (-3.6, -1.8, 0.0, 1.8, 3.6)]
                if _footprint_ok(kind, xx, zz, math.pi / 2, 3.2, 9.0) and all(free(a, b, r) for a, b, r in circ):
                    add('grandstand', xx, zz, math.pi / 2, 1.0, r=0.0)
                    taken.extend(circ)
                    ok = True
                    break
            if ok:
                break
        if not ok:
            print(f'  ! 賽道 {td["id"]} 看台放不下 {x},{z}')

    # 照明燈塔：四角附近，面向場地中心
    for (cx, cz) in ((-34, -22), (34, -22), (-34, 22), (34, 22)):
        best = None
        for r in np.arange(0, 12, 0.5):
            for a in np.linspace(0, 2 * math.pi, 16, endpoint=False):
                x, z = cx + r * math.cos(a), cz + r * math.sin(a)
                if _footprint_ok(kind, x, z, 0, 1.4, 1.4, 0.3) and free(x, z, 1.0):
                    best = (x, z)
                    break
            if best:
                break
        if best:
            add('floodlight', best[0], best[1], math.atan2(-best[1], -best[0]), 1.0, r=1.0)

    # 牆邊：輪胎堆 / 乾草捆，沿中心線兩側
    def style_at(s):
        u = (s % L) / L
        for a, b, st in td['walls']:
            if a <= u < b:
                return st
        return td['walls'][-1][2]

    s = 0.0
    step = 1.7
    while s < L:
        st = style_at(s)
        p, tn = cl.at(np.array([s]))
        p, tn = p[0], tn[0]
        nrm = np.array([-tn[1], tn[0]])
        yaw = math.atan2(tn[1], tn[0])
        for side in (-1, 1):
            if st == 'berm':
                continue
            pr = tr.hw + tr.sh + float(tr.apron(np.array([s]), np.array([side * 1.0]))[0])
            q = p + nrm * side * (pr + 0.75)
            j, i = cell_of(q[0], q[1])
            if not (0 <= j < GH and 0 <= i < GW) or kind[j, i] != WALL:
                continue
            if t[j, i] > 1.3 or t[j, i] < 0.3:
                continue
            name = 'tire_stack' if st == 'tire' else 'hay_bale'
            if free(q[0], q[1], 0.62):
                add(name, q[0], q[1], yaw, 1.0, r=0.62)
        s += step if st != 'hay' else 1.45

    # 急彎外側放油桶
    for k in range(0, cl.N, 8):
        a = cl.T[k]
        b = cl.T[(k + 8) % cl.N]
        turn = a[0] * b[1] - a[1] * b[0]
        if abs(turn) > 0.22 and rng.rand() < 0.35:
            side = -1 if turn > 0 else 1    # 右彎外側在左
            nrm = np.array([-a[1], a[0]])
            q = cl.P[k] + nrm * side * (tr.hw + tr.sh + 1.15)
            j, i = cell_of(q[0], q[1])
            if 0 <= j < GH and 0 <= i < GW and kind[j, i] == WALL and t[j, i] > 0.6 and free(q[0], q[1], 0.35):
                add('barrel', q[0], q[1], rng.range(0, 6.28), 1.0, r=0.35)

    # 旗桿：起點兩側與幾個彎道外側
    for sd in (-1, 1):
        q = p0[0] - np.array(t0[0]) * 3.0 + nrm0 * sd * (span + 0.4)
        j, i = cell_of(q[0], q[1])
        if 0 <= j < GH and 0 <= i < GW and kind[j, i] == WALL and free(q[0], q[1], 0.3):
            add('flag_pole', q[0], q[1], yaw0 + math.pi, 1.0, r=0.3)
    nflag = 0
    for k in range(cl.N // 7, cl.N, cl.N // 7):
        a = cl.T[k]
        b = cl.T[(k + 12) % cl.N]
        turn = a[0] * b[1] - a[1] * b[0]
        if abs(turn) < 0.2:
            continue
        side = -1 if turn > 0 else 1
        nrm = np.array([-a[1], a[0]])
        q = cl.P[k] + nrm * side * (tr.hw + tr.sh + 1.1)
        j, i = cell_of(q[0], q[1])
        if 0 <= j < GH and 0 <= i < GW and kind[j, i] == WALL and t[j, i] > 0.5 and free(q[0], q[1], 0.4):
            add('flag_pole', q[0], q[1], rng.range(0, 6.28), 1.0, r=0.4)
            nflag += 1

    # 圍欄：看台前方一排
    for pr in [p for p in props if p[0] == MESH_ID['grandstand']]:
        x0, z0 = pr[1], pr[3] + 2.3
        for k in range(-2, 3):
            x = x0 + k * 2.0
            if _footprint_ok(kind, x, z0, 0, 2.0, 0.3) and free(x, z0, 0.2):
                add('fence', x, z0, 0.0, 1.0, r=0.3)

    # 仙人掌：散在內場與場外，離路面至少 1.4 m
    tries = 0
    ncac = 0
    while ncac < 16 and tries < 3000:
        tries += 1
        x = rng.range(ORIGIN_X + 1.5, -ORIGIN_X - 1.5)
        z = rng.range(ORIGIN_Z + 1.5, -ORIGIN_Z - 1.5)
        j, i = cell_of(x, z)
        if kind[j, i] != WALL or t[j, i] < 1.6:
            continue
        if _footprint_ok(kind, x, z, 0, 1.2, 1.2, 0.3) and free(x, z, 1.6):
            add('cactus', x, z, rng.range(0, 6.28), rng.range(0.75, 1.15), r=1.0)
            ncac += 1
    return props


# ---------- 貼圖 ----------

PAL = {k: np.array(hex_rgb(v)) for k, v in dict(
    clay='#a3593a', clay_dk='#86452d', clay_lt='#b86c48', rut='#76402c',
    loose='#c99c69', loose_lt='#d9b384', mud='#3f2a1d', mud_hi='#6b4a33',
    water='#5e6b57', water_lt='#76826a', wet='#5f3626',
    berm='#8e5337', berm_top='#a8694a', alkali='#d5c9ad', alkali_dk='#b9aa8c', crack='#8d7d66',
    sage='#879568', sage_dk='#66744f', grass='#8b9464',
    chk_w='#ece3cf', chk_b='#211d1a',
).items()}


def albedo(gen):
    # 以 PX_PER_M × ALBEDO_SS 取樣，最後 ALBEDO_SS × ALBEDO_SS 平均回 PX_PER_M（超取樣抗鋸齒）
    tr = gen['track']
    ss = ALBEDO_SS
    ppm = PX_PER_M * ss
    W0 = int(round((GW - 1) * CELL * PX_PER_M))
    H0 = int(round((GH - 1) * CELL * PX_PER_M))
    W, H = W0 * ss, H0 * ss
    uu, vv = np.meshgrid(np.arange(W), np.arange(H))
    x = ORIGIN_X + (uu + 0.5) / ppm
    z = ORIGIN_Z + (vv + 0.5) / ppm
    F = tr.fields(x, z)
    kind = F['kind']
    # 外框與格點一致
    bj = (z.ravel() - ORIGIN_Z) / CELL
    bi = (x.ravel() - ORIGIN_X) / CELL
    kind = np.where((bj < BORDER - 0.5) | (bj > GH - 1 - BORDER + 0.5) | (bi < BORDER - 0.5) | (bi > GW - 1 - BORDER + 0.5),
                    WALL, kind)
    xr, zr = F['x'], F['z']
    d, s, lat, t = F['d'], F['s'], F['lat'], F['t']
    n1 = fbm(xr / 1.8, zr / 1.8, 11, 3)
    n2 = value_noise(xr * 3.1, zr * 3.1, 12)
    n3 = fbm(xr / 6, zr / 6, 13, 2)
    col = np.zeros((len(xr), 3))

    def mix(a, b, m):
        m = np.asarray(m, dtype=np.float64)[:, None]
        return np.asarray(a) * (1 - m) + np.asarray(b) * m

    # 路面：赭紅黏土 + 雜訊
    clay = mix(PAL['clay'], PAL['clay_dk'], smoothstep(-0.2, 0.7, n1))
    clay = mix(clay, PAL['clay_lt'], smoothstep(0.2, 0.9, n3) * 0.6)
    # 胎痕：沿行車線的四條輪轍，位置隨雜訊擺動
    wob = 0.35 * fbm(s / 7.0, np.zeros_like(s) + 3.3, 21, 2)
    rut = np.zeros_like(s)
    for c in (-2.3, -0.75, 0.75, 2.3):
        rut = np.maximum(rut, 1 - smoothstep(0.08, 0.26, np.abs(lat - c - wob)))
    rut = rut * smoothstep(0.25, 0.75, value_noise(s / 4.0, lat * 0.5, 22)) * (d <= tr.hw)
    clay = mix(clay, PAL['rut'], rut * 0.38)
    col[:] = clay
    # 鬆土
    m = kind == LOOSE
    col[m] = mix(PAL['loose'], PAL['loose_lt'], smoothstep(-0.3, 0.8, n2[m] * 2 - 1 + 0.5 * n1[m]))
    # 跳台與坡道：唇口與坡面稍亮，唇口一條深色
    ka = tr.kind_along(s)
    mj = (kind == JUMP)
    col[mj] = mix(col[mj], PAL['clay_lt'], np.full(mj.sum(), 0.35))
    for f in tr.feats:
        if f['t'] == 'jump':
            u = cyc(s, f['s'], tr.L)
            lip = (np.abs(u + 0.12) < 0.14) & (F['d'] <= tr.hw + tr.sh)
            col[lip] = PAL['clay_dk'] * 0.8
            shade = (u > 0) & (u < 1.6) & (F['d'] <= tr.hw + tr.sh)
            col[shade] = col[shade] * 0.86
    mr = kind == RAMP
    col[mr] = mix(col[mr], PAL['clay_lt'], np.full(mr.sum(), 0.18))
    # 泥地：深褐濕亮
    wi, mi = F['water_in'], F['mud_in']
    mm = kind == MUD
    streak = smoothstep(0.55, 0.85, value_noise(xr * 1.4 + zr * 0.3, zr * 4.0, 31))
    col[mm] = mix(PAL['mud'], PAL['mud_hi'], (streak[mm] * 0.7 + 0.2 * smoothstep(0, 1, n1[mm])))
    rim_m = (kind != MUD) & (kind != WALL) & (mi > -0.7)
    col[rim_m] = mix(col[rim_m], PAL['mud'], 0.5 * smoothstep(-0.7, 0.0, mi[rim_m]))
    # 水坑：混濁灰綠，邊緣一圈濕黏土
    mw = kind == WATER
    rip = smoothstep(0.62, 0.9, value_noise(xr * 2.2, zr * 0.9, 41))
    col[mw] = mix(mix(PAL['water'], PAL['water_lt'], rip[mw] * 0.6), PAL['wet'], 1 - smoothstep(0, 0.5, wi[mw]))
    rim_w = (~mw) & (kind != WALL) & (wi > -0.9)
    col[rim_w] = mix(col[rim_w], PAL['wet'], 0.75 * smoothstep(-0.9, 0.0, wi[rim_w]))
    # 內場草地（可通行的外擴區）
    mi_ = kind == INFIELD
    col[mi_] = mix(PAL['grass'], PAL['sage_dk'], smoothstep(-0.2, 0.6, n1[mi_]))
    # 牆：土堤與場外鹼土
    mwl = kind == WALL
    berm = 1 - smoothstep(1.2, 2.6, t)
    top = np.exp(-((t - 0.95) / 0.35) ** 2)
    alk = mix(PAL['alkali'], PAL['alkali_dk'], smoothstep(-0.3, 0.7, n3))
    f1, f2 = cellular(xr / 0.9, zr / 0.9, 51)
    crack = (1 - smoothstep(0.03, 0.09, f2 - f1)) * smoothstep(1.3, 2.6, t)
    alk = mix(alk, PAL['crack'], crack * 0.8)
    sage = smoothstep(0.62, 0.8, fbm(xr / 1.3, zr / 1.3, 61, 3) * 0.5 + 0.5) * smoothstep(2.4, 4.0, t)
    alk = mix(alk, PAL['sage'], sage * 0.9)
    alk = mix(alk, PAL['sage_dk'], sage * smoothstep(0.3, 0.9, n2) * 0.6)
    bcol = mix(mix(PAL['berm'], PAL['berm_top'], top * 0.6), PAL['clay_dk'], smoothstep(-0.5, 0.8, n1) * 0.3)
    wcol = bcol * berm[:, None] + alk * (1 - berm[:, None])
    col[mwl] = wcol[mwl]
    # 起終點方格線
    u0 = cyc(s, 0.0, tr.L)
    chk = (u0 >= 0) & (u0 < 1.0) & (d <= tr.hw + tr.sh)
    cc = ((np.floor(u0 / 0.5) + np.floor((lat + 10) / 0.5)) % 2 == 0)
    col[chk & cc] = PAL['chk_w']
    col[chk & ~cc] = PAL['chk_b']
    # 細微亮度顆粒
    col = col * (0.965 + 0.07 * n2[:, None])
    col = col.reshape(H, W, 3)
    if ss > 1:
        col = col.reshape(H0, ss, W0, ss, 3).mean(axis=(1, 3))
    return np.clip(col, 0, 1), W0, H0


def downsample(rgb, f):
    # 整數倍區塊平均（給檢查用的小圖）
    H, W, _ = rgb.shape
    return rgb[:H - H % f, :W - W % f].reshape(H // f, f, W // f, f, 3).mean(axis=(1, 3))


def kind_rgb(k):
    # glb 檢查用：地面種類顏色
    return {DIRT: '#a3593a', LOOSE: '#c99c69', MUD: '#3f2a1d', WATER: '#5e6b57', JUMP: '#d08a50',
            RAMP: '#b87a52', WALL: '#8e5337', INFIELD: '#879568'}[int(k)]
