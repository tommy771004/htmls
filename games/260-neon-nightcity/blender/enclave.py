# 霓虹夜城（260）雲梯城寨 Cloudstair Enclave：灰石國宅北端外緣外、山腳挖出的平台上的賽博龐克集合住宅，全部程序化產生（不下載模型）
# 執行：/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P blender/enclave.py -- [--render] [--samples 192] [--res 1920x1080] [--cam hero|top]
# 產出：
#   assets/260/enclave/enclave.json      版面（框座標）：平台、街道、樓群、每棟樓的佔地／高度／穿堂、燈位；頁面 import（地面、碰撞、點光、程式替身都照它）
#   .cache/enclave/mesh.json＋mesh.bin    每個樓群 × 材質的三角網格（框座標、Y 朝上）；tools/enclave-glb.mjs 轉成 assets/260/enclave/enclave.glb
#   .cache/enclave/tex/*.png              程序化貼圖：混凝土（水漬、剝落、霉斑）、鐵皮（波紋與鏽）、欄杆、鐵籠、晾衣、窗（底色與窗燈遮罩）
#   --render：同一份幾何組 Blender 場景（雨後濕柏油、黃線、積水、遠景水面、黃昏偏藍天光），Cycles 從高角度算一張成品圖 assets/260/enclave/hero.jpg
# 座標：遊戲的框座標（x 橫向、y 朝上、z 往城裡為正，山上是 −z；10-city.js 的 ENC.f），單位公尺。Blender 裡換成 X = x、Y = −z、Z = y
import bpy, bmesh, math, os, random, json, sys, struct
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
GAME = os.path.dirname(HERE)
REPO = os.path.dirname(os.path.dirname(GAME))
OUT = os.path.join(REPO, 'assets', '260', 'enclave')
CACHE = os.path.join(GAME, '.cache', 'enclave')
TEX = os.path.join(CACHE, 'tex')
ARGV = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
def arg(k, d=None):
    return ARGV[ARGV.index(k) + 1] if k in ARGV and ARGV.index(k) + 1 < len(ARGV) else d
RENDER = '--render' in ARGV
FONT = next((f for f in ['/System/Library/Fonts/Supplemental/Arial Unicode.ttf', '/Library/Fonts/Arial Unicode.ttf'] if os.path.exists(f)), None)

# ─── 版面（框座標）───────────────────────────────────────────────────────────
# 平台：x 橫向 −72…198、z 從山上 −206 到外緣（實際的前緣是城的外緣，頁面判斷；外緣在 z ≈ −40…−60）
# 街：主街接霓虹堡與地堡之間那條大道往北（x −6…6），前街 z −74…−62、橫街 −134…−122，四欄樓群之間 6 m 的巷子；樓群（地塊）含 2.5 m 人行道
NAME, EN = '雲梯城寨', 'Cloudstair Enclave'
PAD = dict(x0=-72, x1=198, z0=-206, z1=-52)
COLS = [(-66, -6), (6, 64), (70, 128), (134, 192)]
ROWS = [(-122, -74), (-194, -134)]
STREETS = [
    dict(id='main', x0=-6, x1=6, z0=-206, z1=-30, ax='z', name='雲梯街'),
    dict(id='front', x0=-72, x1=198, z0=-74, z1=-62, ax='x', name='城寨前街'),
    dict(id='cross', x0=-72, x1=198, z0=-134, z1=-122, ax='x', name='水塔街'),
    dict(id='back', x0=-72, x1=198, z0=-206, z1=-194, ax='x', name='後巷', lane=1),
    dict(id='west', x0=-72, x1=-66, z0=-206, z1=-62, ax='z', name='西巷', lane=1),
    dict(id='east', x0=192, x1=198, z0=-206, z1=-62, ax='z', name='東巷', lane=1),
    dict(id='a1', x0=64, x1=70, z0=-206, z1=-62, ax='z', name='晾衣巷', lane=1),
    dict(id='a2', x0=128, x1=134, z0=-206, z1=-62, ax='z', name='鐵皮巷', lane=1),
]
SW = 2.5           # 人行道
GF, FH, PAR = 3.8, 2.9, 1.1   # 一樓（店面）層高、標準層高、女兒牆
CD = 1.6           # 外廊深
PASS_W, PASS_H = 5.2, GF   # 穿堂（車與人從街進中庭）

R = random.Random(260417)
NR = np.random.default_rng(260417)

# ─── 程序化貼圖（numpy，可平鋪：頻域合成的雜訊天生週期）─────────────────────────
def pnoise(n, beta, rng=NR):
    kx = np.fft.fftfreq(n)[:, None]; ky = np.fft.fftfreq(n)[None, :]
    k = np.sqrt(kx * kx + ky * ky); k[0, 0] = 1
    amp = k ** (-beta); amp[0, 0] = 0
    f = np.real(np.fft.ifft2(amp * np.exp(1j * rng.uniform(0, 2 * np.pi, (n, n)))))
    return (f - f.mean()) / (f.std() + 1e-9)

def save_png(name, rgba):   # rgba：(H, W, 4) 0..1，第 0 列是圖的上緣
    h, w = rgba.shape[:2]
    img = bpy.data.images.new(name, w, h, alpha=True)
    img.pixels.foreach_set(np.ascontiguousarray(rgba[::-1]).astype(np.float32).ravel())
    img.filepath_raw = os.path.join(TEX, name + '.png'); img.file_format = 'PNG'; img.save()
    return img

def tex_conc():
    # 混凝土 1024²＝6 m：底色微暖的灰、細砂紋、從上往下流的水漬（暗、邊緣淡）、剝落的舊漆（亮、邊緣一圈暗）、牆腳的霉斑、混凝土剝落的坑
    n = 1024
    lo, mid, fine = pnoise(n, 2.2), pnoise(n, 1.4), pnoise(n, .6)
    v = .62 + .07 * lo + .04 * mid + .03 * fine
    streak = np.zeros((n, n))
    for _ in range(420):
        x, y0, L, w = R.randrange(n), R.randrange(n), R.randint(40, 620), R.uniform(1.5, 11)
        a = R.uniform(.08, .3)
        xs = np.arange(int(x - 3 * w), int(x + 3 * w) + 1)
        prof = np.exp(-((xs - x) / w) ** 2)
        for k in range(0, L, 2):
            yy = (y0 + k) % n
            wob = int(3 * math.sin(k * .02 + x))
            streak[yy, (xs + wob) % n] = np.maximum(streak[yy, (xs + wob) % n], a * prof * (1 - k / L) ** .7)
            streak[(yy + 1) % n, (xs + wob) % n] = streak[yy, (xs + wob) % n]
    v -= streak
    peel = pnoise(n, 2.4)
    pm = peel > 1.35
    edge = (np.abs(np.roll(pm, 1, 0) ^ pm) | np.abs(np.roll(pm, 1, 1) ^ pm))
    v = np.where(pm, v * .82 + .1, v)          # 剝掉面漆露出的灰底（暗一點、沒有色）
    v -= edge * .12
    mold = np.clip(pnoise(n, 1.8) - 1.4, 0, None) * .1   # 太濃會變成一塊塊深色圓斑
    v -= mold
    pits = (pnoise(n, .3) > 3.4) * .15
    v -= pits
    v = np.clip(v, .05, 1)
    rgb = np.stack([v * 1.0, v * .985, v * .955], -1)
    rgb[..., 1] += mold * .25                    # 霉斑偏綠
    paint = np.where(pm, 0., 1.)                 # 有漆的地方（Cycles 拿來做凹凸）
    return save_png('conc', np.concatenate([np.clip(rgb, 0, 1), paint[..., None]], -1))

def tex_tin():
    # 鐵皮 512²＝2 m：波紋（每 7.6 cm 一道）、鏽斑（橘褐）、往下流的鏽水
    n = 512
    u = np.arange(n)[None, :].repeat(n, 0)
    ridge = .82 + .18 * np.sin(u / n * 2 * np.pi * 26)
    rust = np.clip(pnoise(n, 1.2) * .3 + .12 * pnoise(n, .7) - .05, 0, 1)   # 低頻太重時整片屋頂是幾塊 X 形的大鏽斑
    run = np.zeros((n, n))
    for _ in range(90):
        x, y0, L = R.randrange(n), R.randrange(n), R.randint(30, 300)
        for k in range(L):
            run[(y0 + k) % n, (x + np.arange(-2, 3)) % n] += .02 * (1 - k / L)
    rust = np.clip(rust + run * 3, 0, 1)
    base = np.array([.78, .79, .8])
    rc = np.array([.42, .2, .08])
    rgb = (base * (1 - rust[..., None]) + rc * rust[..., None]) * ridge[..., None]
    return save_png('tin', np.concatenate([np.clip(rgb, 0, 1), (1 - rust)[..., None]], -1))

def tex_rail():
    # 外廊欄杆 256²＝1 m 寬 × 1.1 m 高：上扶手、中橫桿、下框、每 8 cm 一根直桿，鐵鏽
    n = 256
    a = np.zeros((n, n))
    a[0:12] = 1; a[124:131] = 1; a[244:256] = 1
    for x in range(0, n, 21): a[:, x:x + 4] = 1
    a[:, 0:6] = 1
    rust = np.clip(.5 + .5 * pnoise(n, 1.2), 0, 1)
    rgb = np.stack([.2 + .25 * rust, .14 + .09 * rust, .11 + .02 * rust], -1)
    return save_png('rail', np.concatenate([rgb, a[..., None]], -1))

def tex_cage():
    # 陽台鐵籠與窗花 256²＝1 m：方格鐵枝，外框
    n = 256
    a = np.zeros((n, n))
    for k in range(0, n, 32): a[k:k + 4] = 1; a[:, k:k + 4] = 1
    for k in range(0, n, 64):   # 每隔一格斜一道（舊式窗花）
        for t in range(64):
            a[(k + t) % n, (k + t) % n:(k + t) % n + 3] = 1
    rust = np.clip(.5 + .5 * pnoise(n, 1.0), 0, 1)
    rgb = np.stack([.26 + .2 * rust, .24 + .06 * rust, .22 - .04 * rust], -1)
    return save_png('cage', np.concatenate([rgb, a[..., None]], -1))

CLOTH_COL = [(.85, .2, .2), (.2, .4, .8), (.95, .9, .8), (.9, .75, .2), (.3, .6, .4), (.8, .5, .7), (.15, .15, .2), (.95, .6, .4), (.5, .7, .9), (.7, .7, .72)]
def tex_cloth():
    # 晾衣圖集 512²：4×4 格，T 恤、毛巾（條紋）、長褲、裙子、床單
    n, c = 512, 128
    img = np.zeros((n, n, 4))
    yy, xx = np.mgrid[0:c, 0:c] / c
    for k in range(16):
        i, j = k % 4, k // 4
        col = np.array(CLOTH_COL[(k * 7 + 3) % len(CLOTH_COL)])
        kind = k % 5
        if kind == 0:   # T 恤
            m = ((xx > .25) & (xx < .75) & (yy > .12) & (yy < .95)) | ((yy > .12) & (yy < .38) & (xx > .06) & (xx < .94))
            m &= ~((yy < .2) & (np.abs(xx - .5) < .09))
        elif kind == 1:   # 毛巾
            m = (xx > .12) & (xx < .88) & (yy > .05) & (yy < .9)
        elif kind == 2:   # 長褲
            m = ((xx > .25) & (xx < .75) & (yy > .05) & (yy < .3)) | ((yy >= .3) & (yy < .97) & (((xx > .25) & (xx < .48)) | ((xx > .52) & (xx < .75))))
        elif kind == 3:   # 裙子
            m = (yy > .05) & (yy < .9) & (np.abs(xx - .5) < .16 + .3 * yy)
        else:   # 床單
            m = (xx > .02) & (xx < .98) & (yy > .03) & (yy < .98)
        shade = .82 + .18 * np.sin(xx * 19 + k) * .5 + .1 * yy
        rgb = col[None, None, :] * shade[..., None]
        if kind == 1: rgb = np.where(((yy * 12).astype(int) % 3 == 0)[..., None], rgb * .55 + .4, rgb)
        if kind == 4: rgb = np.where((((xx * 8).astype(int) + (yy * 8).astype(int)) % 2 == 0)[..., None], rgb, rgb * .8 + .15)
        blk = np.concatenate([np.clip(rgb, 0, 1), m[..., None].astype(float)], -1)
        img[j * c:(j + 1) * c, i * c:(i + 1) * c] = blk
    return save_png('cloth', img)

def tex_win():
    # 窗 256²：2×2 種（素玻璃、半拉窗簾、百葉、鐵枝），每種 128 px：鋁框、中間直框、暗玻璃（上半映著天光）。
    # winm：遊戲的窗燈遮罩（26-glb.js 的 USE_WINMAP：R＝玻璃、G＝窗戶編號）；Cycles 也拿 R 當發光遮罩
    n, c = 256, 128
    rgb = np.zeros((n, n, 3)); wm = np.zeros((n, n, 4)); wm[..., 3] = 1
    yy, xx = np.mgrid[0:c, 0:c]
    for v in range(4):
        i, j = v % 2, v // 2
        frame = (xx < 9) | (xx > c - 10) | (yy < 9) | (yy > c - 10) | (np.abs(xx - c / 2) < 3) | (np.abs(yy - c * .32) < 2)
        glass = ~frame
        g = np.stack([.07 + .1 * (1 - yy / c), .09 + .11 * (1 - yy / c), .1 + .12 * (1 - yy / c)], -1)
        if v == 1:   # 半拉窗簾
            cur = (xx < c * .55) & glass
            g = np.where(cur[..., None], np.array([.72, .55, .42]) * (.85 + .15 * np.sin(xx * .9))[..., None], g)
        if v == 2:   # 百葉
            g = np.where(((yy // 6) % 2 == 0)[..., None] & glass[..., None], np.array([.6, .6, .58]), g)
        if v == 3:   # 鐵枝
            bars = (xx % 18 < 3) & glass
            frame = frame | bars
            glass = glass & ~bars
        col = np.where(frame[..., None], np.array([.55, .57, .58]), g)
        rgb[j * c:(j + 1) * c, i * c:(i + 1) * c] = col
        wm[j * c:(j + 1) * c, i * c:(i + 1) * c, 0] = glass
        wm[j * c:(j + 1) * c, i * c:(i + 1) * c, 1] = glass * ((40 + 50 * v) / 255)
    save_png('winm', wm)
    return save_png('win', np.concatenate([rgb, np.ones((n, n, 1))], -1))

# ─── 網格累積：每個群組（樓群）× 材質一份，框座標 ─────────────────────────────────
MATS = ['conc', 'win', 'tin', 'rail', 'cage', 'cloth', 'misc', 'emi']
UVS = {'conc': 6., 'tin': 2.}

class Acc:
    def __init__(self):
        self.P = []; self.N = []; self.U = []; self.C = []; self.W = []; self.L = []; self.I = []

class Geo:
    def __init__(self):
        self.groups = {}
        self.g = None; self.win = 0; self.uoff = 0; self.lit = 0; self.tris = 0
    def use(self, name):
        self.g = self.groups.setdefault(name, {m: Acc() for m in MATS})
    def poly(self, m, pts, col, uvs=None, n=None, lit=0):
        a = self.g[m]
        if n is None:
            e1 = [pts[1][i] - pts[0][i] for i in range(3)]; e2 = [pts[-1][i] - pts[0][i] for i in range(3)]
            n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]]
            l = math.sqrt(n[0] ** 2 + n[1] ** 2 + n[2] ** 2) or 1; n = [n[0] / l, n[1] / l, n[2] / l]
        if uvs is None:
            S = UVS.get(m, 1.)
            if abs(n[1]) > .5: uvs = [(p[0] / S + self.uoff, p[2] / S) for p in pts]
            else:
                tx, tz = -n[2], n[0]
                uvs = [((p[0] * tx + p[2] * tz) / S + self.uoff, p[1] / S) for p in pts]
        b = len(a.P)
        for p, uv in zip(pts, uvs):
            a.P.append(p); a.N.append(n); a.U.append(uv); a.C.append(col); a.W.append(self.win); a.L.append(lit)
        for k in range(1, len(pts) - 1): a.I += [b, b + k, b + k + 1]
        self.tris += len(pts) - 2
    def quad(self, m, p0, p1, p2, p3, col, uvs=None, lit=0):
        self.poly(m, [p0, p1, p2, p3], col, uvs, lit=lit)
    def box(self, m, x0, x1, y0, y1, z0, z1, col, bottom=False, top=True):
        if x1 - x0 < 1e-4 or y1 - y0 < 1e-4 or z1 - z0 < 1e-4: return
        q = self.quad
        q(m, (x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1), col)   # +z
        q(m, (x1, y0, z0), (x0, y0, z0), (x0, y1, z0), (x1, y1, z0), col)   # −z
        q(m, (x1, y0, z1), (x1, y0, z0), (x1, y1, z0), (x1, y1, z1), col)   # +x
        q(m, (x0, y0, z0), (x0, y0, z1), (x0, y1, z1), (x0, y1, z0), col)   # −x
        if top: q(m, (x0, y1, z1), (x1, y1, z1), (x1, y1, z0), (x0, y1, z0), col)
        if bottom: q(m, (x0, y0, z0), (x1, y0, z0), (x1, y0, z1), (x0, y0, z1), col)
    def cyl(self, m, cx, cz, y0, y1, r, seg, col, cap=True, r1=None):
        r1 = r if r1 is None else r1
        for k in range(seg):
            a0, a1 = 2 * math.pi * k / seg, 2 * math.pi * (k + 1) / seg
            p = lambda a, y, rr: (cx + math.cos(a) * rr, y, cz - math.sin(a) * rr)
            am = (a0 + a1) / 2
            self.poly(m, [p(a0, y0, r), p(a1, y0, r), p(a1, y1, r1), p(a0, y1, r1)], col, n=[math.cos(am), 0, -math.sin(am)])
        if cap: self.poly(m, [(cx + math.cos(2 * math.pi * k / seg) * r1, y1, cz - math.sin(2 * math.pi * k / seg) * r1) for k in range(seg)], col, n=[0, 1, 0])
    def rod(self, m, a, b, w, col):   # 兩點之間的方桿（任意方向）
        d = [b[i] - a[i] for i in range(3)]; L = math.sqrt(sum(x * x for x in d)) or 1; d = [x / L for x in d]
        up = [0, 1, 0] if abs(d[1]) < .9 else [1, 0, 0]
        s = [d[1] * up[2] - d[2] * up[1], d[2] * up[0] - d[0] * up[2], d[0] * up[1] - d[1] * up[0]]; ls = math.sqrt(sum(x * x for x in s)); s = [x / ls * w / 2 for x in s]
        t = [d[1] * s[2] - d[2] * s[1], d[2] * s[0] - d[0] * s[2], d[0] * s[1] - d[1] * s[0]]; lt = math.sqrt(sum(x * x for x in t)) or 1; t = [x / lt * w / 2 for x in t]
        c = [[s[i] * sx + t[i] * sy for i in range(3)] for sx, sy in [(1, 1), (-1, 1), (-1, -1), (1, -1)]]
        A = [tuple(a[i] + o[i] for i in range(3)) for o in c]; B = [tuple(b[i] + o[i] for i in range(3)) for o in c]
        for k in range(4):
            k1 = (k + 1) % 4
            self.poly(m, [A[k], A[k1], B[k1], B[k]], col)

G = Geo()

# ─── 顏色 ────────────────────────────────────────────────────────────────
def lin(h):
    h = h.lstrip('#'); s = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple((c / 12.92) if c <= .04045 else ((c + .055) / 1.055) ** 2.4 for c in s) + (1.,)
def mix(c, k):
    return tuple(min(1, x * k) for x in c[:3]) + (1.,)
PAINT = [lin(h) for h in ['bdb6a8', 'a9bcae', 'c9b2a4', 'aab4bc', 'c2b48e', '9ea49c', 'c4aea8', 'a2acb6', 'cfc2a6', '9a9284', '8f9a8c', 'b59a86', '9aa8a4']]
WHITE = (1, 1, 1, 1)
DOORS = [lin(h) for h in ['3d5a4a', '6b2a24', '2a3a5c', '6a5a3a', '2c2c2e', '5a6a6c']]
CLUT = [lin(h) for h in ['8a7a5a', '5a6a7a', '9a4a3a', '3a5a4a', 'b0a080', '6a5a6a', 'c0b8a8', '4a4a52', 'a06030', '2a6a8a']]
PLANT = [lin(h) for h in ['2f5a2a', '3c6e30', '4a7a3a', '28502a', '557a35']]
NEON = [lin(h) for h in ['ff2a6a', '22e0ff', 'ffd02a', '7aff4a', 'ff6a1a', 'c04aff', 'ff3030', '40a0ff']]
TINC = [lin(h) for h in ['8fa6b4', '6f8f7a', 'a89a86', 'b06a46', '9aa0a4', '5a7aa0', 'c8c4b8']]
SIGNS = ['雲梯茶餐廳', '金記五金', '永發冰室', '大眾理髮', '祥興押', '明記燒臘', '涼茶', '牙科', '跌打', '電器維修', '麵家', '麻雀', '時鐘旅館',
         '福來雜貨', '雀仔街', '新興影印', '光明眼鏡', '和記粥麵', '老陳車房', '鐘錶', '中藥', '按摩', '網吧', '藥房', '洗衣', '補習社', '士多', '海鮮']

# ─── 中文霓虹字：Blender 文字物件轉三角形（快取）────────────────────────────────
_glyph = {}
def glyph_tris(ch):
    if ch in _glyph: return _glyph[ch]
    cu = bpy.data.curves.new('t', 'FONT'); cu.body = ch; cu.resolution_u = 1; cu.align_x = 'CENTER'; cu.align_y = 'CENTER'
    if FONT: cu.font = bpy.data.fonts.load(FONT, check_existing=True)
    ob = bpy.data.objects.new('t', cu); bpy.context.scene.collection.objects.link(ob)
    dg = bpy.context.evaluated_depsgraph_get(); me = ob.evaluated_get(dg).to_mesh()
    bm = bmesh.new(); bm.from_mesh(me); bmesh.ops.triangulate(bm, faces=bm.faces[:])
    tris = [[(v.co.x, v.co.y) for v in f.verts] for f in bm.faces]
    bm.free(); ob.evaluated_get(dg).to_mesh_clear(); bpy.data.objects.remove(ob); bpy.data.curves.remove(cu)
    _glyph[ch] = tris
    return tris

def text_on(face, s, u, y, d, size, col, vertical=False):
    # 在立面座標（u 沿牆、y 高、d 往外）擺一串字，字面朝外
    for i, ch in enumerate(s):
        cu, cy = (u, y - i * size * 1.08) if vertical else (u + (i - (len(s) - 1) / 2) * size * 1.02, y)
        for t in glyph_tris(ch):
            pts = [face.P(cu + x * size, cy + yy * size, d) for x, yy in t]
            G.poly('emi', pts, col, n=list(face.n))

# ─── 立面框：o 是 u = 0、y = 0 在牆面上的點，t 沿牆（= Y × n），n 朝外 ─────────────────
class Face:
    def __init__(self, o, n):
        self.o = o; self.n = n; self.t = (n[2], 0, -n[0])   # Y × n
    def P(self, u, y, d=0.):
        return (self.o[0] + self.t[0] * u + self.n[0] * d, y, self.o[2] + self.t[2] * u + self.n[2] * d)
    def q(self, m, u0, y0, u1, y1, d, col, uvs=None, lit=0):
        G.quad(m, self.P(u0, y0, d), self.P(u1, y0, d), self.P(u1, y1, d), self.P(u0, y1, d), col, uvs, lit)
    def box(self, m, u0, u1, y0, y1, d0, d1, col, top=True, bottom=False):
        a, b = self.P(u0, 0, d0), self.P(u1, 0, d1)
        G.box(m, min(a[0], b[0]), max(a[0], b[0]), y0, y1, min(a[2], b[2]), max(a[2], b[2]), col, bottom, top)
    def side(self, m, u, y0, y1, d0, d1, col, s=1):   # 垂直於牆的一片（s=1 朝 +t）
        a, b = self.P(u, 0, d0), self.P(u, 0, d1)
        if s > 0: G.quad(m, (b[0], y0, b[2]), (a[0], y0, a[2]), (a[0], y1, a[2]), (b[0], y1, b[2]), col)
        else: G.quad(m, (a[0], y0, a[2]), (b[0], y0, b[2]), (b[0], y1, b[2]), (a[0], y1, a[2]), col)
    def hz(self, m, u0, u1, d0, d1, y, col, up=True):
        # 水平面：依朝上／朝下排頂點順序
        pts = [self.P(u0, y, d1), self.P(u1, y, d1), self.P(u1, y, d0), self.P(u0, y, d0)]
        if not up: pts = pts[::-1]
        G.poly(m, pts, col, n=[0, 1 if up else -1, 0])

def winq(face, u0, y0, u1, y1, d, var=None):
    # 一扇窗：窗玻璃 UV 在 [k, k+1) 這一格裡取 2×2 圖集的一種（遊戲依 floor(uv) 與 G 分辨每扇窗）
    var = R.randrange(4) if var is None else var
    k = G.win_k = getattr(G, 'win_k', 0) + 1
    ku, kv = k % 997, (k // 997) % 997
    a, b = var % 2, var // 2
    u_0, u_1 = ku + a * .5 + .002, ku + a * .5 + .498
    v_0, v_1 = kv + (1 - b) * .5 + .002, kv + (1 - b) * .5 + .498
    lit = 1 if R.random() < .38 else 0
    face.q('win', u0, y0, u1, y1, d, WHITE, [(u_0, v_0), (u_1, v_0), (u_1, v_1), (u_0, v_1)], lit=lit)

def cloth(face, u0, u1, ytop, d):
    # 一條晾衣線上的衣服（雙面、吊在 ytop 往下）
    u = u0 + R.uniform(.05, .3)
    while u < u1 - .35:
        w = R.uniform(.38, .75); h = w * R.uniform(1.0, 1.6)
        if u + w > u1: break
        cell = R.randrange(16); ci, cj = cell % 4, cell // 4
        uvs = [(ci / 4 + .005, 1 - (cj + 1) / 4 + .005), ((ci + 1) / 4 - .005, 1 - (cj + 1) / 4 + .005), ((ci + 1) / 4 - .005, 1 - cj / 4 - .005), (ci / 4 + .005, 1 - cj / 4 - .005)]
        dd = d + R.uniform(-.06, .06)
        face.q('cloth', u, ytop - h, u + w, ytop, dd, WHITE, uvs)
        u += w + R.uniform(.04, .35)
    face.box('misc', u0, u1, ytop - .01, ytop + .01, d - .01, d + .01, lin('202020'), top=False)

def plant(x, y, z, s=1.):
    pc = R.choice([lin('8a4a30'), lin('6a6a6a'), lin('3a5a8a'), lin('b0a090')])
    G.cyl('misc', x, z, y, y + .35 * s, .18 * s, 6, pc, r1=.22 * s)
    lc = R.choice(PLANT)
    for _ in range(R.randint(1, 2)):
        cx, cz, cy, r = x + R.uniform(-.15, .15) * s, z + R.uniform(-.15, .15) * s, y + .35 * s + R.uniform(.15, .5) * s, R.uniform(.22, .45) * s
        # 低面數的葉叢：八面體
        P = [(cx + r, cy, cz), (cx, cy, cz + r), (cx - r, cy, cz), (cx, cy, cz - r)]
        top, bot = (cx, cy + r * 1.1, cz), (cx, cy - r * .6, cz)
        for k in range(4):
            a, b = P[k], P[(k + 1) % 4]
            G.poly('misc', [b, a, top], mix(lc, R.uniform(.8, 1.2)))
            G.poly('misc', [a, b, bot], mix(lc, .7))

def ac_unit(face, u, y, d0=0.):
    c = lin(R.choice(['d8d6d0', 'c8c6be', 'e0ddd4', 'b8b4aa']))
    w, h, dp = R.uniform(.7, .9), R.uniform(.5, .6), R.uniform(.28, .38)
    face.box('misc', u - w / 2, u + w / 2, y, y + h, d0, d0 + dp, c)
    face.q('misc', u - w / 2 + .08, y + .07, u + w / 2 - .25, y + h - .07, d0 + dp + .005, lin('2a2a2a'))   # 風扇格柵
    face.box('misc', u - w / 2 - .05, u - w / 2 + .02, y - .05, y + .02, d0, d0 + dp, lin('5a5a5a'), top=False)   # 托架

# ─── 一棟樓 ──────────────────────────────────────────────────────────────
class Bld:
    def __init__(s, x0, x1, z0, z1, floors, kinds, lot):
        s.x0, s.x1, s.z0, s.z1, s.n, s.kinds, s.lot = x0, x1, z0, z1, floors, kinds, lot
        s.h = GF + (floors - 1) * FH
        s.paint = R.choice(PAINT); s.passes = []; s.id = 0

def fy(k): return 0. if k == 0 else GF + (k - 1) * FH

def faces_of(b):
    # 四面：(名稱, 牆面框, 長度)
    return {
        's': (Face((b.x0, 0, b.z1), (0, 0, 1)), b.x1 - b.x0),
        'n': (Face((b.x1, 0, b.z0), (0, 0, -1)), b.x1 - b.x0),
        'e': (Face((b.x1, 0, b.z1), (1, 0, 0)), b.z1 - b.z0),
        'w': (Face((b.x0, 0, b.z0), (-1, 0, 0)), b.z1 - b.z0),
    }

def cover(b, side, blds):
    # 這一面被貼著的鄰棟蓋住的區段：[(u0, u1, 鄰棟高)]（u 照 faces_of 的方向）
    out = []
    for o in blds:
        if o is b: continue
        if side in 'sn':
            zz = b.z1 if side == 's' else b.z0
            if abs((o.z0 if side == 's' else o.z1) - zz) > .05: continue
            a, c = max(b.x0, o.x0), min(b.x1, o.x1)
            if c - a < .05: continue
            u = (a - b.x0, c - b.x0) if side == 's' else (b.x1 - c, b.x1 - a)
        else:
            xx = b.x1 if side == 'e' else b.x0
            if abs((o.x0 if side == 'e' else o.x1) - xx) > .05: continue
            a, c = max(b.z0, o.z0), min(b.z1, o.z1)
            if c - a < .05: continue
            u = (b.z1 - c, b.z1 - a) if side == 'e' else (a - b.z0, c - b.z0)
        out.append((u[0], u[1], o.h))
    return out

def runs(L, cov):
    # 把 [0, L] 依蓋住的區段切開：[(u0, u1, 蓋到的高度)]
    cuts = sorted({0., L, *[max(0, min(L, c)) for a in cov for c in a[:2]]})
    res = []
    for a, c in zip(cuts, cuts[1:]):
        if c - a < .05: continue
        m = (a + c) / 2; h = max([o[2] for o in cov if o[0] <= m <= o[1]] or [0.])
        res.append((a, c, h))
    return res

LIGHTS = []   # [x, y, z, 顏色, 半徑, 強度]
SIGN_N = [0]

def street_face(b, f, u0, u1, hid, lights_ok):
    # 臨街面：一樓店面（鐵捲門／亮著的店）、招牌；樓上每 3.2–4 m 一個開間：窗、冷氣機、鐵籠陽台、晾衣竿、遮雨棚、雨水管；每層一道樓板線
    L = u1 - u0
    nb = max(1, round(L / R.uniform(3.2, 4.0))); bw = L / nb
    c = b.paint
    top = b.h
    # 一樓
    passes = [p for p in b.passes if p['face'] == f.key]
    segs = [(u0, u1)]
    for p in passes:
        segs = [s for a, e in segs for s in ((a, p['u0']), (p['u1'], e)) if s[1] - s[0] > .05]
    if hid < GF:
        for a, e in segs:
            ns = max(1, round((e - a) / R.uniform(3.6, 5.2))); sw = (e - a) / ns
            for k in range(ns):
                sa, se = a + k * sw, a + (k + 1) * sw
                f.q('conc', sa, 0, sa + .3, GF, 0, c); f.q('conc', se - .3, 0, se, GF, 0, c)
                f.side('conc', sa + .3, 0, GF, -.45, 0, c, 1); f.side('conc', se - .3, 0, GF, -.45, 0, c, -1)
                f.q('conc', sa + .3, 3.05, se - .3, GF, 0, c)
                f.hz('conc', sa + .3, se - .3, -.45, 0, 3.05, c, up=False)
                r = R.random()
                if r < .42:   # 鐵捲門
                    f.q('tin', sa + .3, 0, se - .3, 3.05, -.45, mix(R.choice(TINC), .9), [(0, 0), ((se - sa) / 2, 0), ((se - sa) / 2, 1.5), (0, 1.5)])
                else:   # 亮著的店（遊戲的窗燈在 4.2 m 以下當店面整間亮）
                    winq(f, sa + .3, 0, se - .3, 3.05, -.45, var=R.choice([0, 0, 2]))
                # 招牌（店面上方，有字的是霓虹）
                if R.random() < .75:
                    bc = R.choice([lin('1a1a1e'), lin('7a1a1a'), lin('1a3a6a'), lin('e8e0c8'), lin('2a5a3a')])
                    f.box('misc', sa + .2, se - .2, 3.1, 3.75, 0, .22, bc)
                    if R.random() < .45:
                        s = R.choice(SIGNS)[:max(1, min(4, int((se - sa - .6) / .55)))]
                        nc = R.choice(NEON)
                        text_on(f, s, (sa + se) / 2, 3.42, .225, .48, nc)
                        if lights_ok and R.random() < .35: LIGHTS.append([*f.P((sa + se) / 2, 3.4, 1.2), nc, 7, 1.0])
                if R.random() < .3:   # 遮雨棚
                    p0, p1 = f.P(sa + .1, 3.0, 0), f.P(se - .1, 3.0, 0)
                    p2, p3 = f.P(se - .1, 2.55, 1.3), f.P(sa + .1, 2.55, 1.3)
                    tc = mix(R.choice(TINC), 1.)
                    G.quad('tin', p3, p2, p1, p0, tc); G.quad('tin', p0, p1, p2, p3, tc)
    # 樓上
    k0 = 1
    for k in range(k0, b.n):
        y0, y1 = fy(k), fy(k + 1)
        if y1 <= hid + .01: continue
        f.box('conc', u0, u1, y0 - .1, y0 + .12, 0, .07, mix(c, .92), top=True)   # 樓板線
        for j in range(nb):
            a, e = u0 + j * bw, u0 + (j + 1) * bw
            ww = bw * R.uniform(.42, .58); wa, we = (a + e) / 2 - ww / 2, (a + e) / 2 + ww / 2
            r = R.random()
            if r < .2 and k < b.n - 1:   # 鐵籠陽台：凸出 0.7–1 m，裡面堆雜物、晾衣服
                dp = R.uniform(.7, 1.0); ca, ce = a + .25, e - .25
                f.q('conc', a, y0, e, y1, 0, c)
                winq(f, ca + .3, y0 + .1, ce - .3, y0 + 2.2, .01, var=R.choice([0, 1, 2]))
                f.box('conc', ca, ce, y0 - .12, y0 + .02, 0, dp, mix(c, .85), top=True, bottom=True)
                cg = mix(lin(R.choice(['6a6a64', '4a5a5a', '7a5a40', '3a4a3a'])), 1.)
                f.q('cage', ca, y0, ce, y0 + 2.4, dp, cg, [(0, 0), (ce - ca, 0), (ce - ca, 2.4), (0, 2.4)])
                f.side('cage', ca, y0, y0 + 2.4, 0, dp, cg, -1); f.side('cage', ce, y0, y0 + 2.4, 0, dp, cg, 1)
                if R.random() < .6:
                    f.box('tin', ca - .05, ce + .05, y0 + 2.4, y0 + 2.46, 0, dp + .12, mix(R.choice(TINC), .9))
                for _ in range(R.randint(1, 3)):
                    ua = R.uniform(ca + .1, ce - .6); sz = R.uniform(.25, .6)
                    f.box('misc', ua, ua + sz, y0 + .02, y0 + .02 + R.uniform(.2, .9), .05, .05 + min(dp - .1, R.uniform(.25, .6)), R.choice(CLUT))
                if R.random() < .55: cloth(f, ca + .1, ce - .1, y0 + 2.25, dp * .55)
                if R.random() < .3:
                    p = f.P(ce - .35, y0 + .02, dp - .3); plant(p[0], p[1], p[2], .9)
                continue
            # 一般窗：窗間的牆、窗台下與窗上的牆、窗框內側的四片、玻璃
            sill, wh = y0 + R.uniform(.8, .95), R.uniform(1.2, 1.45)
            yt = min(sill + wh, y1 - .35)
            f.q('conc', a, y0, wa, y1, 0, c); f.q('conc', we, y0, e, y1, 0, c)
            f.q('conc', wa, y0, we, sill, 0, c); f.q('conc', wa, yt, we, y1, 0, c)
            f.side('conc', wa, sill, yt, -.18, 0, mix(c, .8), 1); f.side('conc', we, sill, yt, -.18, 0, mix(c, .8), -1)
            f.hz('conc', wa, we, -.18, 0, sill, mix(c, .9), up=True); f.hz('conc', wa, we, -.18, 0, yt, mix(c, .7), up=False)
            winq(f, wa, sill, we, yt, -.18)
            if R.random() < .3: f.q('cage', wa - .05, sill - .05, we + .05, yt + .05, .06, lin('5a5a54'), [(0, 0), (we - wa + .1, 0), (we - wa + .1, yt - sill + .1), (0, yt - sill + .1)])   # 窗花
            if r < .55:
                ac_unit(f, R.choice([wa - .5, we + .5, (wa + we) / 2]) if R.random() < .6 else (wa + we) / 2, sill - R.uniform(.62, .75) if R.random() < .7 else yt + .05)
            elif r < .68 and k < b.n - 1:   # 晾衣竿
                for uu in (wa + .15, we - .15):
                    G.rod('misc', f.P(uu, yt + .02, 0), f.P(uu, yt + .08, 1.3), .04, lin('8a8a8a'))
                cloth(f, wa + .1, we - .1, yt + .06, 1.15)
            elif r < .8:   # 遮雨棚
                tc = mix(R.choice(TINC), 1.)
                p0, p1 = f.P(wa - .2, yt + .35, 0), f.P(we + .2, yt + .35, 0)
                p2, p3 = f.P(we + .2, yt + .05, .6), f.P(wa - .2, yt + .05, .6)
                G.quad('tin', p3, p2, p1, p0, tc); G.quad('tin', p0, p1, p2, p3, tc)
            if R.random() < .06 and lights_ok:
                p = f.P((wa + we) / 2, sill + .2, .3); LIGHTS.append([*p, lin('ffb870'), 5, .6])
    # 雨水管
    for _ in range(R.randint(1, 2)):
        uu = R.uniform(u0 + .5, u1 - .5); p = f.P(uu, 0, .14)
        G.cyl('misc', p[0], p[2], max(0, hid), top + .4, .07, 6, lin(R.choice(['5a5a5a', '3a4a4a', '7a6a5a'])), cap=False)
    # 伸出式直招牌（霓虹）
    if R.random() < .4 and top > 14 and hid < GF:
        uu = R.uniform(u0 + 1, u1 - 1); s = R.choice(SIGNS)[:4]; nc = R.choice(NEON)
        yb, ht = GF + R.uniform(.4, 2.5), len(s) * .95 + .6
        p0, p1 = f.P(uu - .12, 0, .1), f.P(uu + .12, 0, 1.5)
        x0, x1, z0, z1 = min(p0[0], p1[0]), max(p0[0], p1[0]), min(p0[2], p1[2]), max(p0[2], p1[2])
        G.box('misc', x0, x1, yb, yb + ht, z0, z1, lin('141418'), bottom=True)
        for sd in (-1, 1):   # 兩面的字（直排）：板面朝 ±t
            sf = Face(f.P(uu + sd * .125, 0, .8), tuple(f.t[i] * sd for i in range(3)))
            text_on(sf, s, 0, yb + ht - .65, .005, .8, nc, vertical=True)
            # 邊框燈管
        G.box('emi', x0 - .01, x1 + .01, yb + ht, yb + ht + .05, z0, z1, nc)
        G.box('emi', x0 - .01, x1 + .01, yb - .05, yb, z0, z1, nc)
        if lights_ok: LIGHTS.append([*f.P(uu, yb + ht / 2, 2.2), nc, 10, 1.4])

def court_face(b, f, u0, u1, hid, lights_ok):
    # 向中庭的一面：每層一條 1.6 m 深的開放外廊（樓板、扶手欄杆、柱子、住戶的門窗、晾衣、燈、雜物與盆栽）
    L = u1 - u0
    nu = max(1, round(L / R.uniform(3.6, 4.4))); uw = L / nu
    c = b.paint
    passes = [p for p in b.passes if p['face'] == f.key]
    if hid < GF:   # 一樓：住戶入口、樓梯口與小店
        segs = [(u0, u1)]
        for p in passes: segs = [s for a, e in segs for s in ((a, p['u0']), (p['u1'], e)) if s[1] - s[0] > .05]
        for a, e in segs:
            ns = max(1, round((e - a) / 4.2)); sw = (e - a) / ns
            for k in range(ns):
                sa, se = a + k * sw, a + (k + 1) * sw
                f.q('conc', sa, 0, se, GF, 0, c)
                r = R.random()
                if r < .4: f.q('misc', sa + .6, 0, sa + 1.6, 2.2, .01, R.choice(DOORS))
                elif r < .75: winq(f, sa + .5, .1, se - .5, 2.9, .01, var=R.choice([0, 2]))
                else: f.q('tin', sa + .4, 0, se - .4, 2.8, .01, mix(R.choice(TINC), .9), [(0, 0), ((se - sa) / 2, 0), ((se - sa) / 2, 1.4), (0, 1.4)])
                if R.random() < .25:
                    p = f.P((sa + se) / 2, 2.9, .3); G.box('emi', p[0] - .3, p[0] + .3, 2.95, 3.0, p[2] - .3, p[2] + .3, lin('fff0d0'))
                    if lights_ok: LIGHTS.append([p[0], 2.8, p[2], lin('ffe8c0'), 6, .8]); lights_ok = False
    for k in range(1, b.n):
        y0, y1 = fy(k), fy(k + 1)
        if y1 <= hid + .01: continue
        ct = y1 - .25
        f.box('conc', u0, u1, y0 - .25, y0 + .02, -.05, .06, mix(c, .9), top=False, bottom=True)   # 樓板前緣
        f.hz('conc', u0, u1, -CD, 0, y0, mix(c, .75), up=True)         # 外廊地板
        f.hz('conc', u0, u1, -CD, 0, ct, mix(c, .65), up=False)        # 外廊天花
        f.q('conc', u0, y0, u1, ct, -CD, c)                            # 住戶那面牆
        f.q('rail', u0, y0, u1, y0 + 1.1, 0, WHITE, [(0, 0), (L, 0), (L, 1), (0, 1)])
        f.side('conc', u0, y0, y1, -CD, 0, c, 1); f.side('conc', u1, y0, y1, -CD, 0, c, -1)
        for j in range(nu + 1):
            uu = u0 + j * uw
            if 0 < j < nu: f.box('conc', uu - .17, uu + .17, y0, ct, -.3, .04, mix(c, .95), top=False)
        for j in range(nu):
            a, e = u0 + j * uw, u0 + (j + 1) * uw
            dc = R.choice(DOORS)
            f.q('misc', a + .4, y0, a + 1.3, y0 + 2.05, -CD + .02, dc)
            f.q('cage', a + .35, y0, a + 1.35, y0 + 2.1, -CD + .12, lin('4a4a44'), [(0, 0), (1, 0), (1, 2.1), (0, 2.1)])   # 鐵閘
            winq(f, a + 1.7, y0 + .95, e - .4, y0 + 2.05, -CD + .02)
            r = R.random()
            if r < .38: cloth(f, a + .2, e - .2, ct - .05, -.35)
            if R.random() < .35:
                for _ in range(R.randint(1, 2)):
                    ua = R.uniform(a + 1.4, e - .6); sz = R.uniform(.3, .6)
                    f.box('misc', ua, ua + sz, y0, y0 + R.uniform(.3, 1.0), -CD + .05, -CD + .05 + R.uniform(.3, .5), R.choice(CLUT))
            if R.random() < .3:
                p = f.P(R.uniform(a + .3, e - .3), y0, -.3); plant(p[0], p[1], p[2], R.uniform(.7, 1.1))
            if R.random() < .3:
                p = f.P((a + e) / 2, ct - .06, -.8)
                G.box('emi', p[0] - .25, p[0] + .25, ct - .08, ct - .01, p[2] - .08, p[2] + .08, lin(R.choice(['fff0c8', 'ffe0a0', 'd8f0ff'])))
                if lights_ok and R.random() < .08: LIGHTS.append([p[0], ct - .3, p[2], lin('ffd8a0'), 7, .7])
            if R.random() < .12: ac_unit(f, a + 2.3, ct - .7, -CD)

def party_face(f, u0, u1, y0, top, c):
    # 貼著鄰棟、只露出比鄰棟高的那一截：素混凝土牆，零星幾扇小窗（廁所）與雨水管
    if top - y0 < .1: return
    f.q('conc', u0, y0, u1, top, 0, c)
    for k in range(1, 40):
        y = fy(k)
        if y < y0 + .3 or y + 2 > top: continue
        if R.random() < .25:
            uu = R.uniform(u0 + .6, u1 - 1.2); winq(f, uu, y + 1.3, uu + .6, y + 2.0, .01, var=3)
    if R.random() < .5:
        uu = R.uniform(u0 + .3, u1 - .3); p = f.P(uu, 0, .1); G.cyl('misc', p[0], p[2], y0, top, .06, 6, lin('5a5a5a'), cap=False)

def roof(b, blds):
    # 屋頂：樓頂板、女兒牆（鄰棟更高的那邊不做）、違建鐵皮屋、水塔、太陽能板、天線、衛星碟、盆栽、機房
    H = b.h; c = b.paint
    G.quad('conc', (b.x0, H, b.z1), (b.x1, H, b.z1), (b.x1, H, b.z0), (b.x0, H, b.z0), mix(c, .7))
    for side in 'snew':
        cov = [o for o in cover(b, side, blds) if o[2] > H + .5]
        f, L = faces_of(b)[side]
        for a, e, hh in runs(L, cov):
            if hh > H + .5: continue
            if R.random() < .2:   # 一段鐵欄杆代替女兒牆
                f.q('rail', a, H, e, H + 1.1, -.1, WHITE, [(0, 0), (e - a, 0), (e - a, 1), (0, 1)])
            else:
                f.box('conc', a, e, H, H + PAR, -.25, 0, c)
    # 可用的屋頂範圍（女兒牆內），擺的東西不疊在一起（格子佔位）
    x0, x1, z0, z1 = b.x0 + .5, b.x1 - .5, b.z0 + .5, b.z1 - .5
    used = []
    def free(a0, a1, c0, c1):
        if a0 < x0 or a1 > x1 or c0 < z0 or c1 > z1: return False
        for u in used:
            if a0 < u[1] and a1 > u[0] and c0 < u[3] and c1 > u[2]: return False
        used.append((a0, a1, c0, c1)); return True
    def spot(w, d, tries=14):
        for _ in range(tries):
            a = R.uniform(x0, x1 - w); cc = R.uniform(z0, z1 - d)
            if free(a, a + w, cc, cc + d): return a, cc
        return None
    # 樓梯／水箱機房（每棟一間）
    s = spot(3.2, 3.2)
    if s:
        a, cc = s; G.box('conc', a, a + 3.2, H, H + 3.0, cc, cc + 3.2, mix(c, .95)); G.box('conc', a - .1, a + 3.3, H + 3.0, H + 3.15, cc - .1, cc + 3.3, mix(c, .8))
        G.quad('misc', (a + 1, H, cc + 3.21), (a + 1.9, H, cc + 3.21), (a + 1.9, H + 2.0, cc + 3.21), (a + 1, H + 2.0, cc + 3.21), R.choice(DOORS))
    # 違建鐵皮屋 1–3 間：單斜屋頂、門、亮燈的窗
    for _ in range(R.randint(1, 3)):
        w, d = R.uniform(3, 6.5), R.uniform(2.8, 5)
        s = spot(w, d)
        if not s: continue
        a, cc = s; tc = mix(R.choice(TINC), R.uniform(.85, 1.05)); hh = R.uniform(2.3, 2.8)
        G.box('tin', a, a + w, H, H + hh, cc, cc + d, tc, top=False)
        G.quad('tin', (a - .2, H + hh, cc + d + .2), (a + w + .2, H + hh, cc + d + .2), (a + w + .2, H + hh + .45, cc - .2), (a - .2, H + hh + .45, cc - .2), mix(tc, .8))
        fr = Face((a, 0, cc + d), (0, 0, 1))
        fr.q('misc', .4, H, 1.25, H + 1.95, .01, R.choice(DOORS))
        if w > 2.6: winq(fr, 1.6, H + 1.0, min(w - .3, 2.8), H + 1.9, .01)
        if R.random() < .4 and len(LIGHTS) < 400: LIGHTS.append([a + w / 2, H + 2.2, cc + d + 1, lin('ffc890'), 6, .7])
        if R.random() < .5: plant(a + w + .4, H, cc + d - .4, R.uniform(.8, 1.2))
    # 水塔：不鏽鋼波紋圓筒，站在鋼架上
    for _ in range(R.randint(1, 3)):
        r = R.uniform(.7, 1.15); s = spot(2 * r + .3, 2 * r + .3)
        if not s: continue
        cx, cz = s[0] + r + .15, s[1] + r + .15; hs = R.uniform(.6, 1.4); ht = R.uniform(1.8, 2.8)
        for dx, dz in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
            G.box('misc', cx + dx * r * .6 - .05, cx + dx * r * .6 + .05, H, H + hs, cz + dz * r * .6 - .05, cz + dz * r * .6 + .05, lin('4a4a4a'))
        G.box('misc', cx - r * .75, cx + r * .75, H + hs - .08, H + hs, cz - r * .75, cz + r * .75, lin('5a5a5a'))
        tc = mix(lin(R.choice(['c8ccd0', 'b8bcc0', 'a8b4bc', '5a7aa8'])), 1.)
        G.cyl('tin', cx, cz, H + hs, H + hs + ht, r, 10, tc, cap=False)
        G.cyl('tin', cx, cz, H + hs + ht, H + hs + ht + r * .35, r, 10, mix(tc, .9), r1=.12)
    # 太陽能板：一排斜放的板（朝 −z 偏南的方向無所謂，照屋頂長邊排）
    if R.random() < .55:
        n = R.randint(2, 5); w, d = 1.05, 1.7
        s = spot(n * (w + .1), d + .4)
        if s:
            for k in range(n):
                a = s[0] + k * (w + .1); cc = s[1] + .2
                y0, y1 = H + .35, H + 1.15
                G.quad('misc', (a, y0, cc + d), (a + w, y0, cc + d), (a + w, y1, cc), (a, y1, cc), lin('1a2a4a'))
                G.quad('misc', (a, y1, cc), (a + w, y1, cc), (a + w, y0, cc + d), (a, y0, cc + d), lin('3a3a3a'))
                G.box('misc', a + .1, a + .16, H, y1, cc, cc + .06, lin('6a6a6a'))
    # 天線：細桿加橫桿（魚骨天線）
    for _ in range(R.randint(1, 4)):
        s = spot(.6, .6)
        if not s: continue
        cx, cz = s[0] + .3, s[1] + .3; ht = R.uniform(2.5, 6.5)
        G.box('misc', cx - .03, cx + .03, H, H + ht, cz - .03, cz + .03, lin('7a7a7a'))
        for k in range(R.randint(2, 5)):
            y = H + ht - .3 - k * .45; L = R.uniform(.5, 1.2)
            G.box('misc', cx - L / 2, cx + L / 2, y - .015, y + .015, cz - .015, cz + .015, lin('8a8a8a'), top=False)
    # 衛星碟
    for _ in range(R.randint(0, 3)):
        s = spot(1.4, 1.4)
        if not s: continue
        cx, cz = s[0] + .7, s[1] + .7; rr = R.uniform(.35, .65); y = H + R.uniform(.8, 1.4); a = R.uniform(0, 6.28)
        G.box('misc', cx - .04, cx + .04, H, y, cz - .04, cz + .04, lin('5a5a5a'))
        # 碟面：朝 a 方向傾斜的淺錐
        dx, dz = math.cos(a), math.sin(a)
        ctr = (cx + dx * .15, y + .1, cz + dz * .15)
        ax = (dx * .7, .7, dz * .7)
        u = (-dz, 0, dx); v = (ax[1] * u[2] - ax[2] * u[1], ax[2] * u[0] - ax[0] * u[2], ax[0] * u[1] - ax[1] * u[0])
        lv = math.sqrt(sum(t * t for t in v)) or 1; v = tuple(t / lv for t in v)
        rim = [tuple(ctr[i] + (u[i] * math.cos(t) + v[i] * math.sin(t)) * rr + ax[i] * .12 for i in range(3)) for t in [2 * math.pi * k / 10 for k in range(10)]]
        dc = lin('d8d8d0')
        for k in range(10):
            G.poly('misc', [ctr, rim[(k + 1) % 10], rim[k]], dc); G.poly('misc', [ctr, rim[k], rim[(k + 1) % 10]], mix(dc, .7))
    # 盆栽、雜物
    for _ in range(R.randint(2, 7)):
        s = spot(.7, .7)
        if s: plant(s[0] + .35, H, s[1] + .35, R.uniform(.9, 1.5))
    for _ in range(R.randint(1, 5)):
        w, d = R.uniform(.4, 1.4), R.uniform(.4, 1.0); s = spot(w, d)
        if s: G.box('misc', s[0], s[0] + w, H, H + R.uniform(.3, 1.2), s[1], s[1] + d, R.choice(CLUT))
    # 屋頂晾衣：兩根竿子拉一條線
    if R.random() < .5:
        s = spot(4.2, .6)
        if s:
            a, cc = s
            for xx in (a, a + 4.2): G.box('misc', xx - .03, xx + .03, H, H + 1.9, cc + .27, cc + .33, lin('7a7a7a'))
            cloth(Face((a, 0, cc + .3), (0, 0, 1)), 0, 4.2, H + 1.85, 0)

# ─── 樓群：一圈樓圍出中庭，地塊含人行道 ─────────────────────────────────────────
LOTS, BLDS = [], []
def lot_cluster(li, x0, x1, z0, z1, entries):
    ix0, ix1, iz0, iz1 = x0 + SW, x1 - SW, z0 + SW, z1 - SW
    rd = {k: R.uniform(12, 14.5) for k in 'nsew'}
    cx0, cx1, cz0, cz1 = ix0 + rd['w'], ix1 - rd['e'], iz0 + rd['n'], iz1 - rd['s']
    blds = []
    def split(a, e, mn=10, mx=19):
        cuts = [a]
        while e - cuts[-1] > mx + mn * .5:
            cuts.append(cuts[-1] + R.uniform(mn, mx))
        cuts.append(e)
        return list(zip(cuts, cuts[1:]))
    fl = lambda: R.choice([12, 12, 13, 13, 14, 14, 15])
    for a, e in split(ix0, ix1): blds.append(Bld(a, e, iz0, cz0, fl(), {'n': 'street', 's': 'court'}, li))   # 北排（山那邊）
    for a, e in split(ix0, ix1): blds.append(Bld(a, e, cz1, iz1, fl(), {'s': 'street', 'n': 'court'}, li))   # 南排（城那邊）
    for a, e in split(cz0, cz1, 9, 16): blds.append(Bld(ix0, cx0, a, e, fl(), {'w': 'street', 'e': 'court'}, li))
    for a, e in split(cz0, cz1, 9, 16): blds.append(Bld(cx1, ix1, a, e, fl(), {'e': 'street', 'w': 'court'}, li))
    # 角上的樓：北／南排頭尾兩棟的 e／w 面也是臨街
    row_n = [b for b in blds if b.z0 == iz0]; row_s = [b for b in blds if b.z1 == iz1]
    for row in (row_n, row_s):
        row[0].kinds['w'] = 'street'; row[-1].kinds['e'] = 'street'
    # 穿堂：entries 指定從哪一面進中庭（'s' 南排、'n' 北排、'w' 西側、'e' 東側）
    pas = []
    for side in entries:
        cand = {'s': [b for b in row_s if b.x0 >= cx0 - 1 and b.x1 <= cx1 + 1], 'n': [b for b in row_n if b.x0 >= cx0 - 1 and b.x1 <= cx1 + 1],
                'w': [b for b in blds if b.x0 == ix0 and b.z0 >= cz0 - .1 and b.z1 <= cz1 + .1], 'e': [b for b in blds if b.x1 == ix1 and b.z0 >= cz0 - .1 and b.z1 <= cz1 + .1]}[side]
        cand = [b for b in cand if (b.x1 - b.x0 if side in 'sn' else b.z1 - b.z0) > PASS_W + 3]
        if not cand: continue
        b = max(cand, key=lambda b: (b.x1 - b.x0) if side in 'sn' else (b.z1 - b.z0))
        if side in 'sn':
            m = (b.x0 + b.x1) / 2; p = dict(x0=m - PASS_W / 2, x1=m + PASS_W / 2, z0=b.z0, z1=b.z1, h=PASS_H)
            fs, fc = ('s', 'n') if side == 's' else ('n', 's')
            for fk in (fs, fc):
                u0 = (p['x0'] - b.x0) if fk == 's' else (b.x1 - p['x1'])
                b.passes.append(dict(face=fk, u0=u0, u1=u0 + PASS_W))
        else:
            m = (b.z0 + b.z1) / 2; p = dict(x0=b.x0, x1=b.x1, z0=m - PASS_W / 2, z1=m + PASS_W / 2, h=PASS_H)
            fs, fc = ('w', 'e') if side == 'w' else ('e', 'w')
            for fk in (fs, fc):
                u0 = (b.z1 - p['z1']) if fk == 'e' else (p['z0'] - b.z0)
                b.passes.append(dict(face=fk, u0=u0, u1=u0 + PASS_W))
        p['side'] = side; b.pas = p; pas.append(dict(p))
    LOTS.append(dict(x0=x0, x1=x1, z0=z0, z1=z1, court=dict(x0=cx0, x1=cx1, z0=cz0, z1=cz1), passes=pas))
    return blds

def build_cluster(li, blds):
    G.use('lot%d' % li)
    lights_left = [3]
    for b in blds:
        G.win = (b.id * 37 % 997) / 997.; G.uoff = R.uniform(0, 1)
        fs = faces_of(b)
        for side, (f, L) in fs.items():
            f.key = side
            kind = b.kinds.get(side, 'party')
            cov = cover(b, side, blds)
            for a, e, hid in runs(L, cov):
                if hid >= b.h - .05: continue
                ok = lights_left[0] > 0 or R.random() < .3
                if hid > .05 or kind == 'party': party_face(f, a, e, hid, b.h, b.paint)
                elif kind == 'street': street_face(b, f, a, e, hid, ok)
                else: court_face(b, f, a, e, hid, ok); lights_left[0] -= 1
        if getattr(b, 'pas', None):   # 穿堂：兩側牆、天花、燈管
            p = b.pas; c = mix(b.paint, .8)
            if p['side'] in 'sn':   # 南北向的穿堂：牆在 x0（朝 +x）與 x1（朝 −x）
                G.quad('conc', (p['x0'], 0, p['z1']), (p['x0'], 0, p['z0']), (p['x0'], p['h'], p['z0']), (p['x0'], p['h'], p['z1']), c)
                G.quad('conc', (p['x1'], 0, p['z0']), (p['x1'], 0, p['z1']), (p['x1'], p['h'], p['z1']), (p['x1'], p['h'], p['z0']), c)
                G.box('emi', (p['x0'] + p['x1']) / 2 - .06, (p['x0'] + p['x1']) / 2 + .06, p['h'] - .06, p['h'] - .01, p['z0'] + 1, p['z1'] - 1, lin('e8f4ff'), top=False, bottom=True)
            else:
                G.quad('conc', (p['x0'], 0, p['z0']), (p['x1'], 0, p['z0']), (p['x1'], p['h'], p['z0']), (p['x0'], p['h'], p['z0']), c)
                G.quad('conc', (p['x1'], 0, p['z1']), (p['x0'], 0, p['z1']), (p['x0'], p['h'], p['z1']), (p['x1'], p['h'], p['z1']), c)
                G.box('emi', p['x0'] + 1, p['x1'] - 1, p['h'] - .06, p['h'] - .01, (p['z0'] + p['z1']) / 2 - .06, (p['z0'] + p['z1']) / 2 + .06, lin('e8f4ff'), top=False, bottom=True)
            G.quad('conc', (p['x0'], p['h'], p['z0']), (p['x1'], p['h'], p['z0']), (p['x1'], p['h'], p['z1']), (p['x0'], p['h'], p['z1']), mix(c, .7))
            LIGHTS.append([(p['x0'] + p['x1']) / 2, p['h'] - .5, (p['z0'] + p['z1']) / 2, lin('dceeff'), 8, 1.1])
        roof(b, blds)
    # 中庭的燈：對角兩盞
    L = LOTS[li]['court']
    LIGHTS.append([L['x0'] + 3, 7.5, L['z0'] + 3, lin('ffc070'), 16, 1.2])
    LIGHTS.append([L['x1'] - 3, 5.5, L['z1'] - 3, lin('ff9a5a'), 14, 1.0])

def build_gate():
    # 主街入口的門樓（城寨前街的南邊，跨主街）：兩根方柱、橫樑、霓虹匾「雲梯城寨」；沿主街與前街、橫街的路燈
    G.use('street')
    G.win = 0; G.uoff = 0
    z = -60.; c = lin('6a6660')
    for x in (-7.6, 6.4):
        G.box('conc', x, x + 1.2, 0, 8.6, z - .6, z + .6, c)
    G.box('conc', -8.2, 8.2, 8.6, 10.2, z - .8, z + .8, mix(c, .9))
    G.box('misc', -5.8, 5.8, 10.2, 12.4, z - .35, z + .35, lin('141016'), bottom=True)
    f = Face((0, 0, z + .36), (0, 0, 1)); text_on(f, NAME, 0, 11.3, .02, 1.55, lin('ff3a6a'))
    f2 = Face((0, 0, z - .36), (0, 0, -1)); text_on(f2, NAME, 0, 11.3, .02, 1.55, lin('22e0ff'))
    for yy in (10.2, 12.4): G.box('emi', -5.9, 5.9, yy - .04, yy + .04, z - .37, z + .37, lin('ffd02a'))
    LIGHTS.append([0, 10.6, z + 2, lin('ff3a6a'), 16, 1.6]); LIGHTS.append([0, 10.6, z - 2, lin('22e0ff'), 14, 1.3])
    # 路燈：鈉燈（橘），每 28 m 一支，交錯擺在路邊
    lamps = []
    for s in STREETS:
        if s.get('lane'): continue
        if s['ax'] == 'z':
            for k, zz in enumerate(np.arange(s['z0'] + 14, s['z1'] - 10, 28)):
                if zz > -64: continue
                lamps.append((s['x0'] - .6 if k % 2 else s['x1'] + .6, float(zz), 1 if k % 2 else -1, 0))
        else:
            for k, xx in enumerate(np.arange(s['x0'] + 10, s['x1'] - 6, 28)):
                if -10 < xx < 10: continue
                lamps.append((float(xx), s['z1'] + .6 if k % 2 else s['z0'] - .6, 0, -1 if k % 2 else 1))
    for x, z, dx, dz in lamps:
        G.box('misc', x - .09, x + .09, 0, 7.2, z - .09, z + .09, lin('3a3c40'))
        ex, ez = x + dx * 1.4, z + dz * 1.4
        G.box('misc', min(x, ex) - .05, max(x, ex) + .05, 7.1, 7.2, min(z, ez) - .05, max(z, ez) + .05, lin('3a3c40'))
        G.box('emi', ex - .25, ex + .25, 6.95, 7.1, ez - .15, ez + .15, lin('ffb060'), bottom=True)
        LIGHTS.append([ex, 6.8, ez, lin('ffa850'), 16, 1.15])
    return lamps

# ─── 產生 ────────────────────────────────────────────────────────────────
def generate():
    os.makedirs(TEX, exist_ok=True); os.makedirs(OUT, exist_ok=True)
    for f in (tex_conc, tex_tin, tex_rail, tex_cage, tex_cloth, tex_win): f()
    # 每個地塊從哪幾面開穿堂：前排從南（前街）與靠主街那面，後排從南（橫街）與北（後巷）
    ent = {(0, 0): 'se', (1, 0): 'sw', (2, 0): 'sn', (3, 0): 'sw', (0, 1): 'se', (1, 1): 'sw', (2, 1): 'sn', (3, 1): 'sn'}
    groups = []
    for ri, (z0, z1) in enumerate(ROWS):
        for ci, (x0, x1) in enumerate(COLS):
            li = len(LOTS)
            blds = lot_cluster(li, x0, x1, z0, z1, ent[(ci, ri)])
            for b in blds: b.id = len(BLDS); BLDS.append(b)
            groups.append(blds)
    for li, blds in enumerate(groups): build_cluster(li, blds)
    lamps = build_gate()
    # 網格
    meta = {'groups': [], 'mats': MATS}
    buf = bytearray()
    for gname, mats in G.groups.items():
        for m, a in mats.items():
            if not a.I: continue
            P = np.array(a.P, np.float32); N = np.array(a.N, np.float32); U = np.array(a.U, np.float32); C = np.array(a.C, np.float32)
            W = np.array(a.W, np.float32); L = np.array(a.L, np.float32); I = np.array(a.I, np.uint32)
            ent_ = {'group': gname, 'mat': m, 'n': len(P), 'i': len(I), 'off': len(buf)}
            for arr in (P, N, U, C, W, L, I): buf += arr.tobytes()
            meta['groups'].append(ent_)
    with open(os.path.join(CACHE, 'mesh.bin'), 'wb') as fh: fh.write(buf)
    with open(os.path.join(CACHE, 'mesh.json'), 'w') as fh: json.dump(meta, fh)
    r2 = lambda v: round(v, 2)
    lay = {
        'name': NAME, 'en': EN, 'pad': PAD, 'sw': SW, 'gf': GF, 'fh': FH,
        'streets': STREETS,
        'lots': [{k: (r2(v) if isinstance(v, float) else v) for k, v in L.items()} for L in LOTS],
        'blds': [dict(x0=r2(b.x0), x1=r2(b.x1), z0=r2(b.z0), z1=r2(b.z1), h=r2(b.h), n=b.n, lot=b.lot, pas=getattr(b, 'pas', None)) for b in BLDS],
        'lamps': [[r2(x), r2(z), dx, dz] for x, z, dx, dz in lamps],
        'gate': dict(z=-60., x0=-8.2, x1=8.2),
        'lights': [[r2(l[0]), r2(l[1]), r2(l[2]), '%02x%02x%02x' % tuple(int(round(((c / 12.92 * 0 + (1.055 * c ** (1 / 2.4) - .055) if c > .0031308 else c * 12.92)) * 255)) for c in l[3][:3]), l[4], l[5]] for l in LIGHTS],
        'tris': G.tris,
    }
    with open(os.path.join(OUT, 'enclave.json'), 'w') as fh: json.dump(lay, fh, ensure_ascii=False, separators=(',', ':'))
    print('ENCLAVE', 'blds', len(BLDS), 'tris', G.tris, 'lights', len(LIGHTS), 'groups', len(G.groups), 'bin KB', len(buf) // 1024)

# ─── Cycles 成品圖 ────────────────────────────────────────────────────────
def bl(p): return (p[0], -p[2], p[1])

def mk_mesh(name, a, mat):
    P = np.array(a.P, np.float32); I = np.array(a.I, np.int32).reshape(-1, 3)
    V = np.stack([P[:, 0], -P[:, 2], P[:, 1]], 1)
    me = bpy.data.meshes.new(name)
    me.vertices.add(len(V)); me.vertices.foreach_set('co', V.ravel())
    me.loops.add(I.size); me.loops.foreach_set('vertex_index', I.ravel())
    me.polygons.add(len(I)); me.polygons.foreach_set('loop_start', np.arange(0, I.size, 3, dtype=np.int32)); me.polygons.foreach_set('loop_total', np.full(len(I), 3, np.int32))
    me.update(); me.validate()
    U = np.array(a.U, np.float32)[I.ravel()]
    uv = me.uv_layers.new(name='UVMap'); uv.data.foreach_set('uv', U.ravel())
    C = np.array(a.C, np.float32)[I.ravel()]
    ca = me.color_attributes.new('col', 'FLOAT_COLOR', 'CORNER'); ca.data.foreach_set('color', C.ravel())
    L = np.array(a.L, np.float32)[I.ravel()]
    la = me.attributes.new('lit', 'FLOAT', 'CORNER'); la.data.foreach_set('value', L)
    for p in me.polygons: p.use_smooth = False
    ob = bpy.data.objects.new(name, me); ob.data.materials.append(mat)
    bpy.context.scene.collection.objects.link(ob)
    return ob

def node_mat(name, kind):
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; N = nt.nodes; Lk = nt.links
    bsdf = N['Principled BSDF']
    col = N.new('ShaderNodeVertexColor'); col.layer_name = 'col'
    def img(fn, non_color=False):
        t = N.new('ShaderNodeTexImage'); t.image = bpy.data.images.load(os.path.join(TEX, fn + '.png'), check_existing=True)
        if non_color: t.image.colorspace_settings.name = 'Non-Color'
        if kind in ('conc', 'tin'): t.image.alpha_mode = 'CHANNEL_PACKED'   # alpha 是剝漆／鏽的遮罩，不是透明度（預設會把顏色乘上 alpha，剝漆的地方變成黑斑）
        return t
    def mul(a, b):
        mm = N.new('ShaderNodeMix'); mm.data_type = 'RGBA'; mm.blend_type = 'MULTIPLY'; mm.inputs['Factor'].default_value = 1
        Lk.new(a, mm.inputs[6]); Lk.new(b, mm.inputs[7]); return mm.outputs[2]
    if kind in ('conc', 'tin'):
        t = img(kind)
        Lk.new(mul(t.outputs['Color'], col.outputs['Color']), bsdf.inputs['Base Color'])
        bsdf.inputs['Roughness'].default_value = .88 if kind == 'conc' else .5
        bsdf.inputs['Metallic'].default_value = 0 if kind == 'conc' else .35
        bump = N.new('ShaderNodeBump'); bump.inputs['Strength'].default_value = .25 if kind == 'conc' else .4
        Lk.new(t.outputs['Color'], bump.inputs['Height']); Lk.new(bump.outputs['Normal'], bsdf.inputs['Normal'])
        if kind == 'tin':   # 鏽的地方粗、不反光
            Lk.new(t.outputs['Alpha'], bsdf.inputs['Metallic'])
    elif kind == 'win':
        t = img('win'); wm = img('winm', True)
        Lk.new(t.outputs['Color'], bsdf.inputs['Base Color'])
        sep = N.new('ShaderNodeSeparateColor'); Lk.new(wm.outputs['Color'], sep.inputs['Color'])
        rr = N.new('ShaderNodeMapRange'); rr.inputs['To Min'].default_value = .55; rr.inputs['To Max'].default_value = .06
        Lk.new(sep.outputs['Red'], rr.inputs['Value']); Lk.new(rr.outputs['Result'], bsdf.inputs['Roughness'])
        at = N.new('ShaderNodeAttribute'); at.attribute_name = 'lit'
        em = N.new('ShaderNodeMath'); em.operation = 'MULTIPLY'
        Lk.new(at.outputs['Fac'], em.inputs[0]); Lk.new(sep.outputs['Red'], em.inputs[1])
        k = N.new('ShaderNodeMath'); k.operation = 'MULTIPLY'; k.inputs[1].default_value = 2.2
        Lk.new(em.outputs[0], k.inputs[0])
        bsdf.inputs['Emission Color'].default_value = (1., .55, .24, 1)
        Lk.new(k.outputs[0], bsdf.inputs['Emission Strength'])
    elif kind in ('rail', 'cage', 'cloth'):
        t = img(kind)
        Lk.new(mul(t.outputs['Color'], col.outputs['Color']), bsdf.inputs['Base Color'])
        Lk.new(t.outputs['Alpha'], bsdf.inputs['Alpha'])
        bsdf.inputs['Roughness'].default_value = .7 if kind != 'cloth' else .95
        bsdf.inputs['Metallic'].default_value = .4 if kind != 'cloth' else 0
        if kind == 'cloth':
            bsdf.inputs['Subsurface Weight'].default_value = 0
            bsdf.inputs['Transmission Weight'].default_value = .15
    elif kind == 'misc':
        Lk.new(col.outputs['Color'], bsdf.inputs['Base Color']); bsdf.inputs['Roughness'].default_value = .62; bsdf.inputs['Metallic'].default_value = .05
    elif kind == 'emi':
        Lk.new(col.outputs['Color'], bsdf.inputs['Base Color'])
        Lk.new(col.outputs['Color'], bsdf.inputs['Emission Color']); bsdf.inputs['Emission Strength'].default_value = 9.
    return m

def ground_scene():
    # 地面（只給成品圖用；遊戲裡的地面是 28-enclave.js 照 enclave.json 畫的）：濕柏油（積水照雜訊、低處反光）、人行道、黃線、中庭的黃格
    def plane(name, x0, x1, z0, z1, y, mat):
        me = bpy.data.meshes.new(name)
        me.from_pydata([bl((x0, y, z1)), bl((x1, y, z1)), bl((x1, y, z0)), bl((x0, y, z0))], [], [(0, 1, 2, 3)])
        uv = me.uv_layers.new(); uv.data.foreach_set('uv', [0, 0, 1, 0, 1, 1, 0, 1])
        ob = bpy.data.objects.new(name, me); ob.data.materials.append(mat); bpy.context.scene.collection.objects.link(ob); return ob
    # 柏油：深灰、粗糙度照雜訊（積水處 0.02 且更暗），細碎凹凸
    m = bpy.data.materials.new('asph'); m.use_nodes = True; N = m.node_tree.nodes; Lk = m.node_tree.links; b = N['Principled BSDF']
    tc = N.new('ShaderNodeTexCoord'); nz = N.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = .09; nz.inputs['Detail'].default_value = 6; nz.inputs['Roughness'].default_value = .62
    Lk.new(tc.outputs['Object'], nz.inputs['Vector'])
    ramp = N.new('ShaderNodeValToRGB'); ramp.color_ramp.elements[0].position = .5; ramp.color_ramp.elements[1].position = .56
    Lk.new(nz.outputs['Fac'], ramp.inputs['Fac'])   # 1＝乾、0＝積水
    rr = N.new('ShaderNodeMapRange'); rr.inputs['To Min'].default_value = .015; rr.inputs['To Max'].default_value = .38
    Lk.new(ramp.outputs['Color'], rr.inputs['Value']); Lk.new(rr.outputs['Result'], b.inputs['Roughness'])
    grain = N.new('ShaderNodeTexNoise'); grain.inputs['Scale'].default_value = 60; Lk.new(tc.outputs['Object'], grain.inputs['Vector'])
    cr = N.new('ShaderNodeMapRange'); cr.inputs['To Min'].default_value = .018; cr.inputs['To Max'].default_value = .05
    mm = N.new('ShaderNodeMath'); mm.operation = 'MULTIPLY'; Lk.new(grain.outputs['Fac'], mm.inputs[0]); Lk.new(ramp.outputs['Color'], mm.inputs[1])
    Lk.new(mm.outputs[0], cr.inputs['Value'])
    cc = N.new('ShaderNodeCombineColor'); Lk.new(cr.outputs['Result'], cc.inputs[0]); Lk.new(cr.outputs['Result'], cc.inputs[1]); Lk.new(cr.outputs['Result'], cc.inputs[2])
    Lk.new(cc.outputs['Color'], b.inputs['Base Color'])
    bump = N.new('ShaderNodeBump'); bump.inputs['Strength'].default_value = .15; Lk.new(grain.outputs['Fac'], bump.inputs['Height'])
    bm = N.new('ShaderNodeMath'); bm.operation = 'MULTIPLY'; Lk.new(ramp.outputs['Color'], bm.inputs[0]); bm.inputs[1].default_value = 1
    Lk.new(bm.outputs[0], bump.inputs['Strength']); Lk.new(bump.outputs['Normal'], b.inputs['Normal'])
    walk = bpy.data.materials.new('walk'); walk.use_nodes = True; wb = walk.node_tree.nodes['Principled BSDF']; wb.inputs['Base Color'].default_value = (.09, .09, .085, 1); wb.inputs['Roughness'].default_value = .25
    yel = bpy.data.materials.new('yel'); yel.use_nodes = True; yb = yel.node_tree.nodes['Principled BSDF']; yb.inputs['Base Color'].default_value = (.85, .55, .02, 1); yb.inputs['Roughness'].default_value = .3
    wht = bpy.data.materials.new('wht'); wht.use_nodes = True; wb2 = wht.node_tree.nodes['Principled BSDF']; wb2.inputs['Base Color'].default_value = (.7, .7, .68, 1); wb2.inputs['Roughness'].default_value = .3
    plane('asph', PAD['x0'], PAD['x1'], PAD['z0'], -30, 0, m)
    terrain()
    for L in LOTS:
        plane('walk', L['x0'], L['x1'], L['z0'], L['z1'], .15, walk)
        c = L['court']; plane('court', c['x0'], c['x1'], c['z0'], c['z1'], .16, m)
        # 中庭的黃格（禁止停車的方框與斜線）
        x0, x1, z0, z1 = c['x0'] + 2, c['x1'] - 2, c['z0'] + 2, c['z1'] - 2
        for a, bb in (((x0, z0), (x1, z0)), ((x1, z0), (x1, z1)), ((x1, z1), (x0, z1)), ((x0, z1), (x0, z0))): stripe(a, bb, .17, .2, yel)
        stripe((x0, z0), (x1, z1), .17, .15, yel); stripe((x1, z0), (x0, z1), .17, .15, yel)
        for p in L['passes']:
            plane('pass', p['x0'], p['x1'], p['z0'], p['z1'], .165, m)
    for s in STREETS:
        if s.get('lane'): continue
        if s['ax'] == 'z':
            xm = (s['x0'] + s['x1']) / 2
            for zz in np.arange(s['z0'] + 2, s['z1'] - 2, 6): stripe((xm, zz), (xm, zz + 3.5), .012, .16, yel)
            for xx in (s['x0'] + .4, s['x1'] - .4): stripe((xx, s['z0']), (xx, s['z1']), .012, .12, yel)
        else:
            zm = (s['z0'] + s['z1']) / 2
            for xx in np.arange(s['x0'] + 2, s['x1'] - 2, 6): stripe((xx, zm), (xx + 3.5, zm), .012, .16, yel)
            for zz in (s['z0'] + .4, s['z1'] - .4): stripe((s['x0'], zz), (s['x1'], zz), .012, .12, yel)
    # 路口的斑馬線
    for zc in (-68., -128.):
        for xx in np.arange(-5, 5.1, 1.1): stripe((xx, zc - 5.2), (xx, zc - 7.4), .013, .5, wht); stripe((xx, zc + 5.2), (xx, zc + 7.4), .013, .5, wht)
    # 遠景的水面（往城那邊，霧裡的海灣）
    wm = bpy.data.materials.new('water'); wm.use_nodes = True; wN = wm.node_tree.nodes; wbs = wN['Principled BSDF']
    wbs.inputs['Base Color'].default_value = (.01, .025, .035, 1); wbs.inputs['Roughness'].default_value = .04; wbs.inputs['IOR'].default_value = 1.33
    wv = wN.new('ShaderNodeTexWave'); wv.inputs['Scale'].default_value = .6; wv.inputs['Distortion'].default_value = 6
    wbp = wN.new('ShaderNodeBump'); wbp.inputs['Strength'].default_value = .05
    wm.node_tree.links.new(wv.outputs['Fac'], wbp.inputs['Height']); wm.node_tree.links.new(wbp.outputs['Normal'], wbs.inputs['Normal'])
    plane('water', -4000, 4000, 140, 6000, -3, wm)
    # 城那邊的岸：一道暗堤（不然水直接貼到平台邊）
    plane('bank', PAD['x0'] - 60, PAD['x1'] + 60, 120, 140, -.5, walk)

def terrain():
    # 平台四周：後面與兩側是山坡（照遊戲的做法：平台外 46 m 內順著接上山），前面是城的那塊平地，再往前是水
    import bmesh as _bm
    gm = bpy.data.materials.new('hill'); gm.use_nodes = True; gb = gm.node_tree.nodes['Principled BSDF']
    gb.inputs['Base Color'].default_value = (.035, .055, .03, 1); gb.inputs['Roughness'].default_value = .9
    nz = gm.node_tree.nodes.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = .02
    gm.node_tree.links.new(nz.outputs['Fac'], gb.inputs['Roughness'])
    P = PAD; S = 8
    def h(x, z):
        dx = max(P['x0'] - x, x - P['x1'], 0); dz = max(P['z0'] - z, 0)
        if z > -40: dx = 0
        d = math.hypot(dx, dz)
        if d <= 0: return -.05
        t = min(1, d / 46); hill = 6 + d * .55 + 18 * math.sin(x * .013) * math.cos(z * .011)
        return hill * t * t * (3 - 2 * t) - .05
    xs = np.arange(P['x0'] - 420, P['x1'] + 420, S); zs = np.arange(P['z0'] - 520, 140, S)
    bm = _bm.new(); V = {}
    for i, x in enumerate(xs):
        for j, z in enumerate(zs):
            V[i, j] = bm.verts.new(bl((float(x), h(x, z), float(z))))
    for i in range(len(xs) - 1):
        for j in range(len(zs) - 1):
            bm.faces.new((V[i, j], V[i + 1, j], V[i + 1, j + 1], V[i, j + 1]))
    me = bpy.data.meshes.new('terrain'); bm.to_mesh(me); bm.free()
    for p in me.polygons: p.use_smooth = True
    if me.polygons[0].normal.z < 0: me.flip_normals()
    ob = bpy.data.objects.new('terrain', me); ob.data.materials.append(gm); bpy.context.scene.collection.objects.link(ob)

def stripe(a, b, y, w, mat):
    dx, dz = b[0] - a[0], b[1] - a[1]; L = math.hypot(dx, dz) or 1; nx, nz = -dz / L * w / 2, dx / L * w / 2
    me = bpy.data.meshes.new('st')
    me.from_pydata([bl((a[0] + nx, y, a[1] + nz)), bl((b[0] + nx, y, b[1] + nz)), bl((b[0] - nx, y, b[1] - nz)), bl((a[0] - nx, y, a[1] - nz))], [], [(0, 1, 2, 3)])
    # 朝上
    me.update()
    if me.polygons[0].normal.z < 0: me.flip_normals()
    ob = bpy.data.objects.new('st', me); ob.data.materials.append(mat); bpy.context.scene.collection.objects.link(ob)

def render():
    sc = bpy.context.scene
    mats = {k: node_mat('m_' + k, k) for k in MATS}
    for gname, gm in G.groups.items():
        for m, a in gm.items():
            if a.I: mk_mesh(gname + '_' + m, a, mats[m])
    ground_scene()
    # 黃昏偏藍的天光：太陽剛下山（仰角 −2°），Nishita 天空照出藍色調；城裡的霧
    w = bpy.data.worlds.new('dusk'); sc.world = w; w.use_nodes = True
    sky = w.node_tree.nodes.new('ShaderNodeTexSky')
    try: sky.sky_type = 'MULTIPLE_SCATTERING'
    except Exception:
        try: sky.sky_type = 'NISHITA'
        except Exception: pass
    sky.sun_elevation = math.radians(float(arg('--sun', '0.4'))); sky.sun_rotation = math.radians(160)
    try: sky.air_density = 1.4; sky.aerosol_density = 2.5
    except Exception:
        try: sky.dust_density = 2.5
        except Exception: pass
    bg = w.node_tree.nodes['Background']; bg.inputs['Strength'].default_value = float(arg('--sky', '3'))
    # 藍調的黃昏：天空乘上冷色（用 MIX 混深藍的話，太陽附近很亮，剩下的比例還是整片粉紅）
    blue = w.node_tree.nodes.new('ShaderNodeMix'); blue.data_type = 'RGBA'; blue.blend_type = 'MULTIPLY'; blue.inputs['Factor'].default_value = float(arg('--blue', '1'))
    blue.inputs[7].default_value = (.3, .5, 1.25, 1)
    w.node_tree.links.new(sky.outputs['Color'], blue.inputs[6]); w.node_tree.links.new(blue.outputs[2], bg.inputs['Color'])
    # 一點補光：月光般的冷色天光（太陽在地平線下，只靠天空太暗）
    ld = bpy.data.lights.new('fill', 'SUN'); ld.energy = 1.2; ld.color = (.55, .68, 1.); ld.angle = math.radians(8)
    lo = bpy.data.objects.new('fill', ld); lo.rotation_euler = (math.radians(55), 0, math.radians(-30)); sc.collection.objects.link(lo)
    # 點光：版面裡的燈（店招、穿堂、中庭、路燈）
    for x, y, z, c, r, i in LIGHTS:
        l = bpy.data.lights.new('p', 'POINT'); l.energy = 260 * i * (r / 10) ** 2; l.color = c[:3]; l.shadow_soft_size = .3
        o = bpy.data.objects.new('p', l); o.location = bl((x, y, z)); sc.collection.objects.link(o)
    # 霧：只包住場景的體積方塊（世界體積是無限大，會把天空整個吃掉），很淡，讓遠處的樓與水面退後
    fog = bpy.data.materials.new('fog'); fog.use_nodes = True; fN = fog.node_tree.nodes
    fN.remove(fN['Principled BSDF'])
    vol = fN.new('ShaderNodeVolumePrincipled'); vol.inputs['Density'].default_value = float(arg('--fog', '0.0012')); vol.inputs['Color'].default_value = (.6, .68, .85, 1)
    fog.node_tree.links.new(vol.outputs['Volume'], fN['Material Output'].inputs['Volume'])
    bpy.ops.mesh.primitive_cube_add(size=1, location=bl(((PAD['x0'] + PAD['x1']) / 2, 120, 0)))
    cube = bpy.context.active_object; cube.scale = (900, 900, 240); cube.data.materials.append(fog)
    # 相機：從山上高處斜俯看前排第二個樓群的中庭，遠景是霧裡的水面
    cam = bpy.data.cameras.new('cam'); co = bpy.data.objects.new('cam', cam); sc.collection.objects.link(co); sc.camera = co
    which = arg('--cam', 'hero')
    if which == 'top':
        cam.lens = 24; eye, tgt = (60, 260, -320), (60, 0, -120)
    else:
        cam.lens = float(arg('--lens', '26')); eye, tgt = (4, 74, -214), (12, 0, -66)
    co.location = bl(eye)
    d = [tgt[i] - eye[i] for i in range(3)]; dv = bl(d)
    from mathutils import Vector
    co.rotation_euler = Vector(dv).to_track_quat('-Z', 'Y').to_euler()
    sc.render.engine = 'CYCLES'
    prefs = bpy.context.preferences.addons['cycles'].preferences
    try:
        prefs.compute_device_type = 'METAL'; prefs.get_devices()
        for dv_ in prefs.devices: dv_.use = True
        sc.cycles.device = 'GPU'
    except Exception as e: print('GPU 失敗，用 CPU', e)
    sc.cycles.samples = int(arg('--samples', '192')); sc.cycles.use_denoising = True
    sc.cycles.max_bounces = 6; sc.cycles.volume_bounces = 0; sc.cycles.volume_step_rate = 4
    W_, H_ = map(int, arg('--res', '1920x1080').split('x'))
    sc.render.resolution_x, sc.render.resolution_y = W_, H_; sc.render.resolution_percentage = 100
    try: sc.view_settings.view_transform = 'AgX'; sc.view_settings.look = 'AgX - Punchy'
    except Exception: pass
    sc.view_settings.exposure = float(arg('--exposure', '0.4'))
    sc.render.image_settings.file_format = 'JPEG'; sc.render.image_settings.quality = 90
    out = arg('--out', os.path.join(OUT, 'hero.jpg' if which == 'hero' else which + '.jpg'))
    sc.render.filepath = out
    bpy.ops.render.render(write_still=True)
    print('RENDER', out)

bpy.ops.wm.read_factory_settings(use_empty=True)
generate()
if RENDER: render()
