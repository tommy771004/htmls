# 霓虹夜城（260）灰鷺角機場第一航廈 T1 的室內（52-air-int.js 擺；航廈的外殼是 airbld.py 的 air_term）
# 執行：/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P blender/airint.py
#   → blender/out/airint.glb（建築 air_t1i ＋ 各件家具 ai_*，打包時內嵌）與 src/parts/52-air-int-data.js（AIR_INT：擺放、碰撞、步行面、燈；自動產生，不要手改），再 npm run build
# 座標是航廈的局部座標（SEA_FR，原點在航廈中心，x 東、y 上、z 南＝機坪側）。牆內 x ±77.4、z ±44.4。
# 兩層：一樓陸側（地坪 0.6 m，和東面入口與北面帷幕的牆基同高）是報到大廳、安檢與入境；二樓空側是 4.4 m 的夾層（空橋固定段的地板高），
# 在南半邊 z 10..44.4、x −77.4..66：三座登機門（x −58、0、58）的候機區、商店與廁所。一樓到二樓是安檢後面（西邊）的兩座電扶梯與一座樓梯。
# 東面中間的自動門開著（airbld.py），門外一條 8 m 長的坡道下到廣場。
# 家具（ai_*）各自一個物件、原點在地上中心、正面朝 +z，烘 AO（bake_ao）；52-air-int.js 照 AIR_INT.place 複製、旋轉、合成一個網格。
# 材質名稱帶遊戲的材質代號（50-assets.js 的 matId）：t40 拋光大理石地磚、t41 漆面灰泥牆、t35 室內不鏽鋼、t34 烤漆鋼板、t23／t25 木紋（沿 x／z）、
# t30 橡膠與粗塑膠、t45 洞石、m8 一直亮的螢幕與燈箱、m2 霧面、m1 玻璃。字只用英文（Blender 內建字型沒有中文字）；航空公司代號是虛構的。
import json, math, os, random, sys
import bmesh, bpy
from mathutils import Vector
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *
from airkit import *

reset()
M = {
    'floor': mat('t40_floor', '#d8d3c9', 0.25, 0.0), 'floor2': mat('t40_inlay', '#8d9196', 0.25, 0.0),
    'plaster': mat('t41_wall', '#e6e2da', 0.8, 0.0), 'ceil': mat('t41_ceil', '#eeece8', 0.8, 0.0),
    'steel': mat('t35_steel', '#b9bdc1', 0.35, 0.8), 'white': mat('t34_white', '#e8e9e9', 0.4, 0.1), 'grey': mat('t34_grey', '#8b9096', 0.45, 0.2),
    'dark': mat('t34_dark', '#2f3236', 0.5, 0.2), 'shell': mat('t34_seat', '#3b3f45', 0.45, 0.2), 'navy': mat('t30_fabric', '#28405a', 0.9, 0.0),
    'wood': mat('t23_oak', '#a87a4e', 0.55, 0.0), 'woodz': mat('t25_oak', '#a87a4e', 0.55, 0.0), 'walnut': mat('t23_walnut', '#5e3f2a', 0.55, 0.0),
    'rubber': mat('t30_rubber', '#1b1c1e', 0.9, 0.0), 'trav': mat('t45_trav', '#cdbfa8', 0.6, 0.0), 'solid': mat('m2_solid', '#f1efea', 0.35, 0.0),
    'glass': mat('m1_glass', '#1a272b', 0.05, 0.0), 'ink': mat('m2_ink', '#16181b', 0.8, 0.0), 'red': mat('t34_red', '#b3261e', 0.45, 0.1),
    'yel': mat('t34_yel', '#e2ad1c', 0.4, 0.1), 'grn': mat('m2_leaf', '#3d6a34', 0.8, 0.0), 'grn2': mat('m2_leaf2', '#55803f', 0.8, 0.0), 'soil': mat('m2_soil', '#3b2d22', 0.95, 0.0),
    'bark': mat('m2_bark', '#5a4634', 0.9, 0.0), 'tray': mat('t30_tray', '#5c6066', 0.7, 0.0), 'curtain': mat('t30_curtain', '#2a2c2e', 0.9, 0.0),
    # 一直亮的（m8：入夜不關；顏色＝發光色 × 0.9）
    'scr': mat('m8_scrbg', '#0b1a2e', 0.4, 0.0, emit='#0b1a2e'), 'txt': mat('m8_txt', '#f4f0e6', 0.4, 0.0, emit='#f4f0e6'), 'amb': mat('m8_amber', '#ffb23a', 0.4, 0.0, emit='#ffb23a'),
    'gtx': mat('m8_green', '#57f08c', 0.4, 0.0, emit='#57f08c'), 'rtx': mat('m8_redtx', '#ff5a48', 0.4, 0.0, emit='#ff5a48'),
    'ysg': mat('m8_ysign', '#f3b81f', 0.4, 0.0, emit='#f3b81f'), 'wsg': mat('m8_wsign', '#f5f3ee', 0.4, 0.0, emit='#f5f3ee'), 'led': mat('m8_led', '#fff4e2', 0.4, 0.0, emit='#fff4e2'),
    'bsg': mat('m8_bsign', '#1f6fd6', 0.4, 0.0, emit='#1f6fd6'), 'cafe': mat('m8_cafe', '#e9a35a', 0.4, 0.0, emit='#e9a35a'),
}
PROD = [mat('t30_p%d' % i, c, 0.6, 0.0) for i, c in enumerate(['#c0392b', '#2471a3', '#f1c40f', '#27ae60', '#8e44ad', '#e67e22', '#ecf0f1', '#34495e', '#d35400', '#16a085', '#b9770e', '#7d3c98'])]
F0, F1, SLAB = 0.6, 4.4, 0.45                 # 一樓地坪、二樓夾層地坪、夾層樓板厚
IX, IZ = 77.4, 44.4                            # 牆內
MX0, MX1, MZ0, MZ1 = -IX, 66.0, 10.0, IZ       # 夾層
BOH = 18.0                                     # 夾層底下的後勤區牆（一樓 z 18 以南是行李與辦公，不開放）
SEC_X = -27.0                                  # 安檢線（以西是空側）
R_T, Y_PK, RT = 129.1, 27.0, 1.2
def roof_in(z): return Y_PK - R_T + math.sqrt(R_T * R_T - z * z) - RT   # 屋頂底面
GATES = [-58.0, 0.0, 58.0]
HX0, HX1, HZ0, HZ1 = -21.0, -14.4, 32.8, 36.6   # 夾層開洞（往入境大廳的電扶梯）
SLABS = [(MX0, HX0, MZ0, MZ1), (HX1, MX1, MZ0, MZ1), (HX0, HX1, MZ0, HZ0), (HX0, HX1, HZ1, MZ1)]


# ─── 有旋轉的建構器：local（家具自己的座標，正面 +z）→ 遊戲座標；ry 照 three.js 的 rotateY（+z 轉到 (sin, cos)）
class X:
    def __init__(self, b, x=0.0, y=0.0, z=0.0, ry=0.0):
        self.b, self.o, self.c, self.s = b, (x, y, z), math.cos(ry), math.sin(ry)
    def p(self, q): x, y, z = q; return (self.o[0] + x * self.c + z * self.s, self.o[1] + y, self.o[2] - x * self.s + z * self.c)
    def d(self, q): x, y, z = q; return (x * self.c + z * self.s, y, -x * self.s + z * self.c)
    def obb(self, c, u, v, w, m):
        c, u, v, w = Vector(self.p(c)), Vector(self.d(u)), Vector(self.d(v)), Vector(self.d(w))
        if u.cross(v).dot(w) < 0: w = -w
        P = lambda a, bb, cc: G(tuple(c + a * u + bb * v + cc * w))
        V = [P(a, bb, cc) for a in (-1, 1) for bb in (-1, 1) for cc in (-1, 1)]   # 索引 = 4a' + 2b' + c'
        i = lambda a, bb, cc: (4 if a > 0 else 0) + (2 if bb > 0 else 0) + (1 if cc > 0 else 0)
        F = [(i(1, -1, -1), i(1, 1, -1), i(1, 1, 1), i(1, -1, 1)), (i(-1, -1, -1), i(-1, -1, 1), i(-1, 1, 1), i(-1, 1, -1)),
             (i(-1, 1, -1), i(-1, 1, 1), i(1, 1, 1), i(1, 1, -1)), (i(-1, -1, -1), i(1, -1, -1), i(1, -1, 1), i(-1, -1, 1)),
             (i(-1, -1, 1), i(1, -1, 1), i(1, 1, 1), i(-1, 1, 1)), (i(-1, -1, -1), i(-1, 1, -1), i(1, 1, -1), i(1, -1, -1))]
        self.b.mb.add(V, F, m)
    def box(self, x0, x1, y0, y1, z0, z1, m):
        if x1 - x0 > 1e-4 and y1 - y0 > 1e-4 and z1 - z0 > 1e-4:
            self.obb(((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), ((x1 - x0) / 2, 0, 0), (0, (y1 - y0) / 2, 0), (0, 0, (z1 - z0) / 2), m)
    def cyl(self, x, z, y0, y1, r, seg, m, r1=None):
        X_, _, Z_ = self.p((x, 0, z)); self.b.vcyl(X_, Z_, self.o[1] + y0, self.o[1] + y1, r, seg, m, r1=r1)
    def tube(self, a, c, r, m, seg=8): self.b.tube(self.p(a), self.p(c), r, m, seg)
    def nb(self, fn):
        """fn() 畫的東西不倒角（貨架上的小商品：倒角只會讓頂點數翻倍、看不出差別）"""
        mb = self.b.mb; n0 = len(mb.v); fn()
        if not hasattr(mb, 'tv'): mb.tv = []
        mb.tv.extend(range(n0, len(mb.v)))
    def text(self, t, size, o, R, N, m, depth=0.0):
        # 預設是平面字（沒有側面）；記下頂點，倒角時跳過（字的倒角會讓頂點數翻好幾倍）
        mb = self.b.mb; n0 = len(mb.v); P, Nd = self.p(o), self.d(N)
        P = tuple(P[k] + Nd[k] * .012 for k in range(3))   # 離底板 1.2 cm：遠處的深度精度分不出幾 mm，字會和螢幕打架缺一角
        self.b.text(t, size, P, self.d(R), Nd, m, depth)
        if not hasattr(mb, 'tv'): mb.tv = []
        mb.tv.extend(range(n0, len(mb.v)))
    def poly(self, pts, m): self.b.poly([self.p(q) for q in pts], m)
    def blob(self, c, r, m, seed, sq=1.0):
        bm = bmesh.new(); bmesh.ops.create_icosphere(bm, subdivisions=1, radius=1.0); rr = random.Random(seed)
        vs = [Vector(self.p((c[0] + v.co.x * r * (.8 + .35 * rr.random()), c[1] + v.co.z * r * sq * (.8 + .35 * rr.random()), c[2] + v.co.y * r * (.8 + .35 * rr.random())))) for v in bm.verts]
        fs = [tuple(v.index for v in f.verts) for f in bm.faces]; bm.free()
        self.b.mb.add([G(tuple(v)) for v in vs], [tuple(reversed(f)) for f in fs], m)


def bevel(o, w=.008):
    finish(o, 99.0, gr_h=-1.0)   # 合併重複點（切刀用很大的間距＝不切）
    # 修改器的 vertex group 只在 VGROUP 模式有用、不能和角度一起限，所以自己算邊的權重：夾角大於 40° 的邊倒角，字（txt 群組）的邊不倒（字倒角會讓頂點數翻三倍）
    bm = bmesh.new(); bm.from_mesh(o.data); dl = bm.verts.layers.deform.active
    gi = o.vertex_groups['txt'].index if 'txt' in o.vertex_groups else -1
    bw = bm.edges.layers.float.get('bevel_weight_edge') or bm.edges.layers.float.new('bevel_weight_edge')
    for e in bm.edges:
        if len(e.link_faces) != 2 or (gi >= 0 and dl is not None and all(gi in v[dl] for v in e.verts)): continue
        if e.calc_face_angle(0.0) > math.radians(40): e[bw] = 1.0
    bm.to_mesh(o.data); bm.free(); o.data.update()
    md = o.modifiers.new('bv', 'BEVEL'); md.width = w; md.segments = 1; md.limit_method = 'WEIGHT'
    _ = [s.select_set(False) for s in bpy.context.scene.objects]; o.select_set(True); bpy.context.view_layer.objects.active = o
    bpy.ops.object.modifier_apply(modifier='bv')


# ════════ 家具 ════════
def seat_row(x, n, face_z, double):
    """候機座椅：n 個座位在一根鋼樑上（0.64 m 一位），兩端 T 型腳；double 是背對背兩排（正面 ±z）"""
    P = .64; L = n * P
    rows = [(.48, 0.0), (-.48, math.pi)] if double else [(0.0, 0.0)]
    for zc, ry in rows:
        t = X(x.b, *x.p((0, 0, zc)), ry=math.atan2(x.s, x.c) + ry)
        for i in range(n):
            cx = (i - (n - 1) / 2) * P
            t.box(cx - .27, cx + .27, .40, .44, -.24, .25, M['shell'])
            t.box(cx - .25, cx + .25, .44, .50, -.22, .23, M['navy'])
            a = math.radians(12)
            t.obb((cx, .78, -.29), (.27, 0, 0), (0, .29 * math.cos(a), -.29 * math.sin(a)), (0, .02 * math.sin(a), .02 * math.cos(a)), M['shell'])
            t.obb((cx, .79, -.255), (.245, 0, 0), (0, .25 * math.cos(a), -.25 * math.sin(a)), (0, .025 * math.sin(a), .025 * math.cos(a)), M['navy'])
        for i in range(n + 1):   # 扶手：立柱＋墊
            ax = (i - n / 2) * P
            t.tube((ax, .38, .05), (ax, .64, .05), .018, M['steel'], 6); t.box(ax - .03, ax + .03, .64, .67, -.18, .22, M['rubber'])
        t.box(-L / 2 + .1, L / 2 - .1, .30, .38, -.06, .06, M['steel'])
        for sx in (-1, 1):
            lx = sx * (L / 2 - .4)
            t.box(lx - .03, lx + .03, .02, .32, -.05, .05, M['steel']); t.box(lx - .05, lx + .05, 0, .025, -.32, .32, M['steel'])
            t.obb((lx, .2, -.18), (.025, 0, 0), (0, .17, .1), (0, -.02, .035), M['steel'])
    if double:
        x.box(-L / 2 + .2, L / 2 - .2, .3, .38, -.06, .06, M['steel'])


def seats(name, n, double):
    b = GB(hash(name) & 0xffff); seat_row(X(b), n, 0, double); return b.build(name)


def island(name, n=14):
    """報到島：沿 z 的長條（2 m 一座櫃台、兩側各 n 座），中間是行李輸送帶與背牆，兩端上方是燈箱（字是另外的 ai_isl_*）"""
    b = GB(51); t = X(b); L = n * 2.0; h = L / 2
    t.box(-.35, .35, F0 * 0, 2.7, -h, h, M['woodz'])                  # 背牆（木）
    t.box(-.36, .36, 2.7, 2.78, -h, h, M['steel'])
    for sx in (-1, 1):
        bx = sx * .95
        t.box(bx - .6, bx + .6, 0, .32, -h, h, M['steel'])              # 輸送帶的機殼
        t.box(bx - .55, bx + .55, .32, .36, -h, h, M['rubber'])         # 皮帶
        for k in range(int(L / .5)): t.box(bx - .58, bx + .58, .33, .345, -h + .25 + k * .5 - .01, -h + .25 + k * .5 + .01, M['dark'])
        for i in range(n):
            zc = -h + 1.0 + i * 2.0; cx = sx * 2.3
            t.box(cx - .45, cx + .45, 0, .95, zc - .78, zc + .78, M['white'])          # 櫃台本體
            t.box(cx - .5, cx + .5, .95, 1.0, zc - .8, zc + .8, M['solid'])
            t.box(cx + sx * .44, cx + sx * .47, .05, .95, zc - .76, zc + .76, M['wood'])  # 客人那面的木飾板
            t.box(cx - sx * .05 - .02, cx - sx * .05 + .02, 1.0, 1.36, zc - .25, zc + .25, M['dark'])  # 員工的螢幕
            t.box(cx - sx * .02 - .01, cx - sx * .02 + .01, 1.03, 1.33, zc - .23, zc + .23, M['glass'])
            t.box(cx + sx * .2, cx + sx * .26, 1.0, 1.4, zc + .5, zc + .62, M['dark'])     # 客人那面的小螢幕（櫃台號）
            t.box(cx + sx * .26, cx + sx * .27, 1.18, 1.38, zc + .44, zc + .68, M['scr'])
            t.text('%d' % (i + 1 + (0 if sx > 0 else n)), .13, (cx + sx * .272, 1.28, zc + .56), (0, 0, -sx), (sx, 0, 0), M['txt'], .004)
            sz0, sz1 = zc - .78, zc + .78                                                     # 行李秤：在櫃台與皮帶之間，皮帶那側開口
            t.box(min(sx * 1.55, sx * 1.85), max(sx * 1.55, sx * 1.85), 0, .42, sz0 + .1, sz0 + .95, M['steel'])
            t.box(min(sx * 1.57, sx * 1.83), max(sx * 1.57, sx * 1.83), .42, .45, sz0 + .12, sz0 + .93, M['rubber'])
            t.box(min(sx * 1.55, sx * 2.75), max(sx * 1.55, sx * 2.75), .42, .6, sz0 + .02, sz0 + .1, M['steel'])
        # 客人那側的地上：排隊線（深色地帶）
        t.box(min(sx * 2.8, sx * 3.0), max(sx * 2.8, sx * 3.0), 0, .005, -h, h, M['floor2'])
    for sz in (-1, 1):   # 兩端的燈箱：兩支柱撐著，面朝外（字在 ai_isl_* ）
        z = sz * (h + .2)
        for px in (-1.6, 1.6): t.box(px - .06, px + .06, 0, 3.6, z - .06, z + .06, M['steel'])
        t.box(-2.0, 2.0, 3.0, 4.0, z - .18, z + .18, M['dark'])
        t.box(-1.9, 1.9, 3.08, 3.92, z + sz * .18, z + sz * .19, M['ysg'])
        t.text('CHECK-IN', .34, (.55, 3.5, z + sz * .19), (sz, 0, 0), (0, 0, sz), M['ink'], .01)
    for sx in (-1, 1):   # 長邊上方的櫃台號燈條（背牆頂）
        for i in range(0, n, 2):
            zc = -h + 2.0 + i * 2.0
            t.box(min(sx * .36, sx * .4), max(sx * .36, sx * .4), 2.2, 2.6, zc - .9, zc + .9, M['wsg'])
            t.text('%d - %d' % (i + 1 + (0 if sx > 0 else n), i + 2 + (0 if sx > 0 else n)), .24, (sx * .401, 2.4, zc), (0, 0, -sx), (sx, 0, 0), M['ink'], .006)
    return b.build(name)


def isl_letter(name, ch):
    """報到島兩端燈箱上的字母（正面 +z、背面也一份），原點在燈箱面中心的地上"""
    b = GB(52); t = X(b)
    for sz in (-1, 1):
        t.box(-1.9 if sz > 0 else -1.9, -.95, 3.15, 3.85, sz * .19, sz * .2, M['ink']) if False else None
        t.text(ch, .62, (-1.35 * sz, 3.5, sz * .2), (sz, 0, 0), (0, 0, sz), M['ink'], .02)
    return b.build(name)


def xray(name):
    """安檢通道（沿 x，人往 −x 走）：卸物台＋滾筒、X 光機（隧道與鉛簾）、出口滾筒；金屬探測門在 z +0.9（人走那條）；一側是 1.2 m 的隔板"""
    b = GB(53); t = X(b)
    zc = -.55
    t.box(2.6, 7.0, 0, .8, zc - .45, zc + .45, M['steel'])                   # 卸物台＋滾筒
    for k in range(22): t.cyl(0, 0, 0, 0, 0, 3, M['steel']) if False else t.box(2.65 + k * .2, 2.73 + k * .2, .8, .84, zc - .42, zc + .42, M['grey'])
    for k, xx in enumerate((6.4, 5.7, 5.0, 4.3)): t.box(xx - .3, xx + .3, .84, .95, zc - .22, zc + .22, M['tray'])
    t.box(-1.6, 2.6, 0, 1.45, zc - .62, zc + .62, M['white'])                 # X 光機
    t.box(-1.62, 2.62, .9, 1.47, zc - .64, zc + .64, M['grey'])
    t.box(-1.65, -1.6, .62, 1.22, zc - .4, zc + .4, M['dark']); t.box(2.6, 2.65, .62, 1.22, zc - .4, zc + .4, M['dark'])
    for k in range(6): t.box(2.62, 2.64, .66, 1.18, zc - .38 + k * .13, zc - .27 + k * .13, M['curtain'])
    t.box(-.4, .4, 1.47, 1.85, zc - .5, zc - .3, M['dark']); t.box(-.37, .37, 1.5, 1.82, zc - .3, zc - .29, M['scr'])   # 操作員的螢幕
    t.box(-6.2, -1.6, 0, .78, zc - .45, zc + .45, M['steel'])                 # 出口滾筒
    for k in range(22): t.box(-6.15 + k * .2, -6.07 + k * .2, .78, .82, zc - .42, zc + .42, M['grey'])
    for xx in (-5.4, -3.2): t.box(xx - .3, xx + .3, .82, .93, zc - .22, zc + .22, M['tray'])
    # 金屬探測門：兩片側板、頂板、燈條
    for sz in (-1, 1):
        z = .95 + sz * .5
        t.box(-1.0, -.7, 0, 2.2, z - .07, z + .07, M['grey']); t.box(-.98, -.72, .05, .2, z - .1, z + .1, M['dark'])
        t.box(-.99, -.71, .4, 2.0, z - .072, z + .072, M['white'])
    t.box(-1.0, -.7, 2.2, 2.42, .38, 1.52, M['grey']); t.box(-.99, -.71, 2.25, 2.3, .43, 1.47, M['gtx'])
    t.box(-2.4, -1.9, 0, 1.05, 1.0, 1.5, M['white']); t.box(-2.42, -1.88, 1.05, 1.1, .98, 1.52, M['solid'])   # 檢查員的小台
    # 隔板（−z 側，整條通道）：不鏽鋼框＋霧白板
    zb = -1.62
    t.box(-7.0, 7.0, 0, .08, zb - .05, zb + .05, M['steel']); t.box(-7.0, 7.0, 1.15, 1.2, zb - .04, zb + .04, M['steel'])
    t.box(-6.95, 6.95, .1, 1.13, zb - .015, zb + .015, M['white'])
    for xx in range(-7, 8, 2): t.box(xx - .03, xx + .03, 0, 1.2, zb - .05, zb + .05, M['steel'])
    # 通道號燈箱（入口那端，柱上）
    t.box(6.9, 7.0, 0, 2.4, 1.55, 1.65, M['steel']); t.box(6.95, 7.25, 2.0, 2.5, 1.35, 1.85, M['dark'])
    return b.build(name)


def lane_no(name, k):
    b = GB(54); t = X(b); t.box(7.25, 7.26, 2.05, 2.45, 1.4, 1.8, M['gtx']); t.text('%d' % k, .3, (7.262, 2.25, 1.6), (0, 0, -1), (1, 0, 0), M['ink'], .01); return b.build(name)


FLIGHTS = [('07:40', 'GH 102', 'TOKYO', 'A1', 'DEPARTED', 'txt'), ('08:15', 'NC 318', 'SINGAPORE', 'A2', 'BOARDING', 'gtx'), ('08:30', 'HC 721', 'SEOUL', 'A3', 'GATE OPEN', 'gtx'),
           ('08:55', 'GH 214', 'BANGKOK', 'B1', 'ON TIME', 'txt'), ('09:10', 'SK 905', 'MANILA', 'B2', 'DELAYED', 'rtx'), ('09:25', 'NC 442', 'OSAKA', 'B3', 'ON TIME', 'txt'),
           ('09:40', 'HC 233', 'HONG KONG', 'A1', 'ON TIME', 'txt'), ('10:05', 'GH 618', 'SYDNEY', 'B4', 'ON TIME', 'txt'), ('10:20', 'SK 117', 'DUBAI', 'A2', 'ON TIME', 'txt'),
           ('10:45', 'NC 820', 'VANCOUVER', 'A3', 'ON TIME', 'txt')]
ARRIVALS = [('07:05', 'NC 317', 'SINGAPORE', 'LANDED', 'gtx'), ('07:30', 'GH 101', 'TOKYO', 'LANDED', 'gtx'), ('07:55', 'HC 720', 'SEOUL', 'BAGGAGE', 'amb'),
            ('08:20', 'SK 904', 'MANILA', 'EXPECTED 08:41', 'amb'), ('08:40', 'GH 213', 'BANGKOK', 'ON TIME', 'txt'), ('09:00', 'NC 441', 'OSAKA', 'ON TIME', 'txt'),
            ('09:35', 'HC 232', 'HONG KONG', 'ON TIME', 'txt'), ('09:50', 'GH 617', 'SYDNEY', 'ON TIME', 'txt'), ('10:15', 'SK 116', 'DUBAI', 'CANCELLED', 'rtx'),
            ('10:30', 'NC 819', 'VANCOUVER', 'ON TIME', 'txt')]


def fids(name):
    """航班看板：兩支柱撐著 4.8 × 2.9 m 的雙面螢幕，正面（+z）出境、背面到站"""
    b = GB(55); t = X(b); W, y0, y1 = 2.4, 2.1, 5.0
    for px in (-1.9, 1.9):
        t.box(px - .09, px + .09, 0, y0, -.09, .09, M['steel']); t.box(px - .3, px + .3, 0, .03, -.3, .3, M['steel'])
    t.box(-W - .08, W + .08, y0 - .08, y1 + .08, -.16, .16, M['dark'])
    for sz in (-1, 1):
        z = sz * .16
        t.box(-W, W, y0, y1, min(z, z + sz * .005), max(z, z + sz * .005), M['scr'])
        R, N = (sz, 0, 0), (0, 0, sz); zf = z + sz * .006
        X_ = lambda u: u * sz
        t.box(-W, W, y1 - .42, y1, min(zf, zf + sz * .002), max(zf, zf + sz * .002), M['bsg'])
        t.text('DEPARTURES' if sz > 0 else 'ARRIVALS', .26, (X_(-1.35), y1 - .21, zf + sz * .002), R, N, M['txt'], .004)
        t.text('11:%02d' % (27 if sz > 0 else 28), .2, (X_(2.0), y1 - .21, zf + sz * .002), R, N, M['txt'], .004)
        hdr = [('TIME', -2.15), ('FLIGHT', -1.45), ('DESTINATION' if sz > 0 else 'FROM', -.45), ('GATE', .75), ('STATUS', 1.55)] if sz > 0 else [('TIME', -2.15), ('FLIGHT', -1.45), ('FROM', -.45), ('STATUS', 1.2)]
        for h_, u in hdr: t.text(h_, .1, (X_(u + len(h_) * .035), y1 - .55, zf), R, N, M['amb'], .003)
        rows = FLIGHTS if sz > 0 else ARRIVALS
        for k, r in enumerate(rows):
            y = y1 - .8 - k * .225
            if k % 2 == 0: t.box(-W + .03, W - .03, y - .1, y + .1, min(zf - sz * .001, zf), max(zf - sz * .001, zf), M['ink'])
            cells = [(r[0], -2.15, 'txt'), (r[1], -1.45, 'amb'), (r[2], -.45, 'txt'), (r[3], .75, 'txt'), (r[4], 1.55, r[5])] if sz > 0 else [(r[0], -2.15, 'txt'), (r[1], -1.45, 'amb'), (r[2], -.45, 'txt'), (r[3], 1.2, r[4])]
            for s_, u, mm in cells: t.text(s_, .13, (X_(u + len(s_) * .045), y, zf), R, N, M[mm], .003)
    return b.build(name)


def gate_desk(name):
    """登機門櫃台：弧形前緣的白色台、木飾板、兩台螢幕與掃描機；後面一支 3 m 的門號燈箱柱（字在 ai_gno_*）"""
    b = GB(56); t = X(b)
    t.box(-1.8, 1.8, 0, 1.0, -.35, .35, M['white']); t.box(-1.85, 1.85, 1.0, 1.05, -.42, .42, M['solid'])
    t.box(-1.78, 1.78, .06, .98, .35, .37, M['wood'])
    for sx in (-1, 1):
        t.box(sx * .8 - .28, sx * .8 + .28, 1.05, 1.42, -.2, -.17, M['dark']); t.box(sx * .8 - .26, sx * .8 + .26, 1.07, 1.4, -.17, -.165, M['glass'])
    t.box(1.95, 2.25, 0, 1.05, -.15, .15, M['grey']); t.box(1.97, 2.23, 1.05, 1.12, -.13, .13, M['scr'])   # 自助掃描機
    t.box(2.0, 2.2, .9, .96, .15, .2, M['red'])
    t.box(-2.6, -2.45, 0, 3.0, -.08, .08, M['steel']); t.box(-3.3, -1.75, 2.9, 3.6, -.12, .12, M['dark'])     # 門號燈箱柱
    for sz in (-1, 1): t.box(-3.25, -1.8, 2.95, 3.55, min(sz * .12, sz * .13), max(sz * .12, sz * .13), M['ysg'])
    return b.build(name)


def gate_no(name, txt, ox=-2.525, oy=3.25):
    b = GB(57); t = X(b)
    for sz in (-1, 1): t.text(txt, .44, (ox, oy, sz * .13), (sz, 0, 0), (0, 0, sz), M['ink'], .015)
    return b.build(name)


def board_door(name):
    """空橋門：南牆窗台裡的門框與關著的門（門上小窗、門號燈）；正面 +z 朝候機區（擺的時候轉 180°）"""
    b = GB(58); t = X(b)
    t.box(-1.5, 1.5, 0, .05, -.4, .2, M['steel'])
    for sx in (-1, 1): t.box(sx * 1.5 - .12, sx * 1.5 + .12, 0, 2.6, -.25, .1, M['dark'])
    t.box(-1.62, 1.62, 2.6, 2.85, -.25, .1, M['dark'])
    t.box(-1.38, 1.38, .02, 2.58, -.18, -.12, M['grey'])
    for sx in (-1, 1): t.box(sx * .69 - .03, sx * .69 + .03, .02, 2.58, -.12, -.1, M['dark']); t.box(sx * .69 - .3, sx * .69 + .3, 1.5, 2.1, -.12, -.11, M['glass'])
    t.box(-.6, .6, 2.62, 2.82, .1, .12, M['ysg'])
    return b.build(name)


def stanchions(name, nx=5, nz=4, dx=1.5, dz=1.2):
    """排隊柵欄：nx × nz 支不鏽鋼柱，每排之間拉布帶（蛇行：每排一端開口）"""
    b = GB(59); t = X(b); x0 = -(nx - 1) * dx / 2; z0 = -(nz - 1) * dz / 2
    for i in range(nx):
        for j in range(nz):
            x, z = x0 + i * dx, z0 + j * dz
            t.cyl(x, z, 0, .02, .17, 14, M['steel']); t.cyl(x, z, .02, .95, .028, 10, M['steel']); t.cyl(x, z, .95, 1.0, .04, 10, M['steel'])
    for j in range(nz):
        z = z0 + j * dz
        a, c = (0, nx - 2) if j % 2 == 0 else (1, nx - 1)
        for i in range(a, c): t.box(x0 + i * dx, x0 + (i + 1) * dx, .84, .9, z - .004, z + .004, M['navy'])
    for i in (0, nx - 1):
        for j in range(nz - 1): t.box(x0 + i * dx - .004, x0 + i * dx + .004, .84, .9, z0 + j * dz, z0 + (j + 1) * dz, M['navy'])
    return b.build(name)


def shopfront(t, W, D, H, sign, signm, ink):
    """店面的殼：後牆、兩側牆、頂上的招牌帶（燈箱字）、天花；正面（+z）開著"""
    t.box(-W / 2, W / 2, 0, H, -D, -D + .2, M['plaster'])
    for sx in (-1, 1): t.box(min(sx * W / 2, sx * (W / 2 - .2)), max(sx * W / 2, sx * (W / 2 - .2)), 0, H + .8, -D, 0, M['plaster'])
    t.box(-W / 2, W / 2, H, H + .8, -.25, 0, M['dark']); t.box(-W / 2, W / 2, H + .8, H + .9, -D, 0, M['white'])
    t.box(-W / 2 + .3, W / 2 - .3, H + .12, H + .68, 0, .02, signm)
    t.text(sign, .38, (0, H + .4, .021), (1, 0, 0), (0, 0, 1), ink, .02)
    t.box(-W / 2 + .2, W / 2 - .2, H - .05, H, -D + .2, 0, M['ceil'])
    for k in range(int(W / 2.5)): t.cyl(-W / 2 + 1.25 + k * 2.5, -D / 2, H - .07, H - .05, .09, 10, M['led'])


def shop_cafe(name, W=12.0, D=6.0, H=3.2):
    b = GB(60); t = X(b); shopfront(t, W, D, H, 'HERON CAFE', M['cafe'], M['ink'])
    t.box(-W / 2 + 1, W / 2 - 3, 0, 1.0, -2.6, -1.9, M['walnut']); t.box(-W / 2 + .95, W / 2 - 2.95, 1.0, 1.06, -2.65, -1.85, M['solid'])   # 吧台
    t.box(-2.2, -1.2, 1.06, 1.5, -2.45, -2.0, M['steel']); t.cyl(-1.9, -2.0, 1.25, 1.33, .04, 8, M['dark']); t.cyl(-1.5, -2.0, 1.25, 1.33, .04, 8, M['dark'])   # 咖啡機
    t.box(.5, 2.4, 1.06, 1.45, -2.5, -1.95, M['glass'])                                 # 甜點櫃
    for k in range(9): t.box(.6 + (k % 3) * .6, .9 + (k % 3) * .6, 1.08, 1.16, -2.45 + (k // 3) * .16, -2.33 + (k // 3) * .16, PROD[(k * 5) % 12])
    t.box(-W / 2 + .4, W / 2 - .4, 1.8, 3.0, -D + .21, -D + .25, M['walnut'])                # 後牆木板＋菜單燈箱
    for k in range(3): t.box(-3.5 + k * 2.6, -1.5 + k * 2.6, 2.0, 2.9, -D + .26, -D + .28, M['scr']); t.text(['COFFEE', 'TEA', 'BAKERY'][k], .16, (-2.5 + k * 2.6, 2.75, -D + .29), (1, 0, 0), (0, 0, 1), M['amb'], .004)
    for k in range(3):
        for j in range(4): t.text(['3.80', '4.20', '4.60', '5.10'][j], .1, (-2.0 + k * 2.6, 2.5 - j * .14, -D + .29), (1, 0, 0), (0, 0, 1), M['txt'], .003); t.box(-3.3 + k * 2.6, -2.5 + k * 2.6, 2.45 - j * .14, 2.47 - j * .14, -D + .285, -D + .29, M['txt'])
    for k in range(12): t.cyl(-W / 2 + 1.0 + k * .25, -D + .45, 1.06, 1.18, .045, 8, M['white'])   # 杯子
    t.box(-W / 2 + .4, W / 2 - .4, 1.0, 1.04, -D + .25, -D + .6, M['walnut'])
    for k, (tx, tz) in enumerate([(-4.0, 1.4), (-1.2, 1.6), (1.6, 1.4), (4.2, 1.6)]):   # 店外的圓桌與椅子
        t.cyl(tx, tz, 0, .03, .25, 14, M['dark']); t.cyl(tx, tz, .03, .72, .04, 8, M['dark']); t.cyl(tx, tz, .72, .75, .4, 18, M['solid'])
        for a in (0, math.pi):
            cx, cz = tx + .62 * math.cos(a), tz
            for lx in (-.17, .17):
                for lz in (-.17, .17): t.box(cx + lx - .015, cx + lx + .015, 0, .45, cz + lz - .015, cz + lz + .015, M['dark'])
            t.box(cx - .21, cx + .21, .45, .5, cz - .21, cz + .21, M['wood'])
            bxs = cx + .21 * math.cos(a); t.box(min(bxs, bxs + .03 * math.cos(a)), max(bxs, bxs + .03 * math.cos(a)), .5, .88, cz - .2, cz + .2, M['wood'])
    return b.build(name)


def shop_duty(name, W=16.0, D=7.0, H=3.2):
    b = GB(61); t = X(b); shopfront(t, W, D, H, 'CAPE DUTY FREE', M['wsg'], M['ink']); r = random.Random(7)
    for gx in (-5.0, -1.7, 1.7, 5.0):   # 貨架島：兩面四層，香水瓶與盒子
        t.box(gx - .45, gx + .45, 0, .15, -4.6, -1.4, M['dark']); t.box(gx - .05, gx + .05, .15, 1.75, -4.6, -1.4, M['white'])
        for lv in range(4):
            y = .35 + lv * .38; t.box(gx - .42, gx + .42, y - .02, y, -4.55, -1.45, M['solid'])
            for sx in (-1, 1):
                z = -4.45
                while z < -1.6:
                    w = .08 + r.random() * .12; hgt = .1 + r.random() * .2
                    if r.random() < .5: t.nb(lambda: t.cyl(gx + sx * .25, z + w / 2, y, y + hgt, w / 2, 8, PROD[r.randrange(12)]))
                    else: t.nb(lambda: t.box(gx + sx * .25 - .06, gx + sx * .25 + .06, y, y + hgt, z, z + w, PROD[r.randrange(12)]))
                    z += w + .04
        t.box(gx - .45, gx + .45, 1.75, 1.8, -4.6, -1.4, M['steel'])
    for k in range(int((W - 1) / 1.0)):   # 後牆的酒櫃（燈打亮的層板）
        x = -W / 2 + .8 + k * 1.0
        for lv in range(5):
            y = .4 + lv * .45; t.box(x - .45, x + .45, y - .02, y, -D + .2, -D + .55, M['led'] if lv == 4 else M['solid'])
            for q in range(4): t.nb(lambda: t.cyl(x - .33 + q * .22, -D + .38, y, y + .28 + r.random() * .06, .04, 8, PROD[r.randrange(12)]))
    t.box(W / 2 - 3.2, W / 2 - .6, 0, 1.0, -1.1, -.5, M['white']); t.box(W / 2 - 3.25, W / 2 - .55, 1.0, 1.05, -1.15, -.45, M['solid'])   # 結帳台
    t.box(W / 2 - 2.6, W / 2 - 2.2, 1.05, 1.35, -.9, -.86, M['dark'])
    return b.build(name)


def shop_news(name, W=8.0, D=5.0, H=3.2):
    b = GB(62); t = X(b); shopfront(t, W, D, H, 'NEWS & BOOKS', M['bsg'], M['txt']); r = random.Random(9)
    for k in range(int(W - 1)):   # 後牆的雜誌架（斜放的一本本）
        x = -W / 2 + 1 + k
        for lv in range(5):
            y = .45 + lv * .42; t.box(x - .48, x + .48, y - .02, y, -D + .2, -D + .5, M['white'])
            for q in range(3): t.nb(lambda: t.obb((x - .3 + q * .3, y + .15, -D + .35), (.12, 0, 0), (0, .15, -.04), (0, .01, .004), PROD[r.randrange(12)]))
    for gx in (-2.0, 1.0):   # 書桌：平放的書
        t.box(gx - .8, gx + .8, 0, .8, -2.8, -1.6, M['wood'])
        for q in range(12): t.box(gx - .75 + (q % 6) * .25, gx - .55 + (q % 6) * .25, .8, .84 + r.random() * .06, -2.75 + (q // 6) * .55, -2.3 + (q // 6) * .55, PROD[r.randrange(12)])
    t.box(W / 2 - 2.2, W / 2 - .5, 0, 1.0, -1.0, -.4, M['white']); t.box(W / 2 - 2.25, W / 2 - .45, 1.0, 1.05, -1.05, -.35, M['solid'])
    for q in range(10): t.box(W / 2 - 2.1 + (q % 5) * .3, W / 2 - 1.9 + (q % 5) * .3, 1.05, 1.13, -.95 + (q // 5) * .25, -.8 + (q // 5) * .25, PROD[r.randrange(12)])
    return b.build(name)


def pictogram(t, cx, cy, z, s, woman, m):
    """廁所圖示：圓頭＋身體（女：梯形裙），在 z 平面上、朝 +z"""
    t.cyl(cx, z, cy + .34 * s, cy + .34 * s + .001, .07 * s, 14, m) if False else None
    n = 16; pts = [(cx + .07 * s * math.cos(2 * math.pi * i / n), cy + .38 * s + .07 * s * math.sin(2 * math.pi * i / n), z) for i in range(n)]
    t.poly(pts, m)
    if woman: t.poly([(cx - .16 * s, cy - .05 * s, z), (cx + .16 * s, cy - .05 * s, z), (cx + .07 * s, cy + .28 * s, z), (cx - .07 * s, cy + .28 * s, z)], m)
    else: t.poly([(cx - .09 * s, cy - .05 * s, z), (cx + .09 * s, cy - .05 * s, z), (cx + .09 * s, cy + .28 * s, z), (cx - .09 * s, cy + .28 * s, z)], m)
    for lx in (-.045, .045): t.poly([(cx + lx - .03 * s, cy - .4 * s, z), (cx + lx + .03 * s, cy - .4 * s, z), (cx + lx + .03 * s, cy - .05 * s, z), (cx + lx - .03 * s, cy - .05 * s, z)], m)


def wc(name, W=9.0, D=6.0, H=3.2):
    """廁所：外牆是洞石、兩個轉折的入口（看不進去）、門楣上的燈箱圖示"""
    b = GB(63); t = X(b)
    t.box(-W / 2, W / 2, 0, H, -D, -D + .2, M['trav'])
    for sx in (-1, 1): t.box(min(sx * W / 2, sx * (W / 2 - .2)), max(sx * W / 2, sx * (W / 2 - .2)), 0, H, -D, 0, M['trav'])
    t.box(-W / 2, W / 2, H, H + .25, -D, 0, M['white'])
    t.box(-W / 2 + .2, -1.5, 0, H, -.2, 0, M['trav']); t.box(1.5, W / 2 - .2, 0, H, -.2, 0, M['trav']); t.box(-.4, .4, 0, H, -.2, 0, M['trav'])   # 正面：兩個開口 x ±(0.4..1.5)
    t.box(-1.6, 1.6, 0, H, -2.2, -2.0, M['trav'])                                                  # 轉折的擋牆
    t.box(-1.6, -.4, 2.4, H, -.2, 0, M['trav']) ; t.box(.4, 1.6, 2.4, H, -.2, 0, M['trav'])
    t.box(-1.4, 1.4, 2.62, 3.1, .0, .06, M['wsg'])
    pictogram(t, -.8, 2.86, .061, .45, False, M['ink']); pictogram(t, .8, 2.86, .061, .45, True, M['ink'])
    t.box(-.02, .02, 2.66, 3.06, .06, .062, M['ink'])
    t.box(-W / 2 + .3, -2.2, 1.0, 1.05, -.06, .0, M['steel']) ; t.box(2.2, W / 2 - .3, 1.0, 1.05, -.06, .0, M['steel'])
    t.box(-W / 2 + .3, -2.2, .1, 1.0, -.03, 0.0, M['trav']) if False else None
    t.box(-1.5, 1.5, 0, .01, -2.0, -.2, M['floor2'])
    return b.build(name)


def info_desk(name):
    """服務台：半徑 1.6 m 的圓台（木飾板、白檯面）＋柱頂的 i 燈箱"""
    b = GB(64); t = X(b); n = 28
    for i in range(n):
        a0, a1 = 2 * math.pi * i / n, 2 * math.pi * (i + 1) / n
        P = lambda r, a, y: (r * math.cos(a), y, r * math.sin(a))
        t.poly([P(1.6, a1, 0), P(1.6, a0, 0), P(1.6, a0, 1.0), P(1.6, a1, 1.0)], M['wood'])
        t.poly([P(1.0, a0, 0), P(1.0, a1, 0), P(1.0, a1, 1.0), P(1.0, a0, 1.0)], M['white'])
        t.poly([P(1.68, a0, 1.05), P(1.68, a1, 1.05), P(.95, a1, 1.05), P(.95, a0, 1.05)], M['solid'])
        t.poly([P(1.68, a1, 1.0), P(1.68, a0, 1.0), P(1.68, a0, 1.05), P(1.68, a1, 1.05)], M['solid'])
    t.cyl(0, 0, 0, 4.0, .1, 12, M['steel']); t.box(-.55, .55, 4.0, 5.1, -.55, .55, M['bsg'])
    for (R, N, o) in [((1, 0, 0), (0, 0, 1), (0, 4.55, .551)), ((-1, 0, 0), (0, 0, -1), (0, 4.55, -.551)), ((0, 0, -1), (1, 0, 0), (.551, 4.55, 0)), ((0, 0, 1), (-1, 0, 0), (-.551, 4.55, 0))]:
        t.text('i', .9, o, R, N, M['txt'], .02)
    for a in (.4, 2.0, 3.6, 5.2): t.box(math.cos(a) * 1.25 - .2, math.cos(a) * 1.25 + .2, 1.05, 1.36, math.sin(a) * 1.25 - .02, math.sin(a) * 1.25 + .02, M['dark'])
    return b.build(name)


def trolleys(name, n=7):
    """行李推車一列（套在一起，沿 x 0.32 m 一台）"""
    b = GB(65); t = X(b)
    for i in range(n):
        x = (i - (n - 1) / 2) * .32
        for sz in (-1, 1):
            z = sz * .3
            t.tube((x - .45, .12, z), (x + .45, .12, z), .015, M['steel'], 6)
            t.tube((x + .45, .12, z), (x + .55, 1.05, z), .018, M['steel'], 6)
            t.tube((x - .45, .12, z), (x - .4, .45, z), .015, M['steel'], 6)
            for wx in (-.4, .4): t.cyl(x + wx, z, 0, .02, .06, 8, M['rubber']); t.box(x + wx - .02, x + wx + .02, .02, .12, z - .02, z + .02, M['dark'])
        t.tube((x + .55, 1.05, -.32), (x + .55, 1.05, .32), .02, M['red'], 8)
        t.box(x - .45, x + .45, .14, .16, -.29, .29, M['grey'])
        t.box(x + .35, x + .5, .2, .9, -.28, .28, M['grey'])
    return b.build(name)


def planter(name, seed=1):
    """盆栽：洞石花台＋榕樹（樹幹、幾團葉）"""
    b = GB(66 + seed); t = X(b); r = random.Random(seed)
    t.box(-.7, .7, 0, .7, -.7, .7, M['trav']); t.box(-.62, .62, .62, .66, -.62, .62, M['soil'])
    t.tube((0, .6, 0), (.1, 1.7, .05), .07, M['bark'], 7); t.tube((.1, 1.7, .05), (-.25, 2.3, -.1), .04, M['bark'], 6); t.tube((.1, 1.7, .05), (.35, 2.4, .15), .04, M['bark'], 6)
    for k in range(9):
        a = r.random() * 6.28; rr = .25 + r.random() * .3
        t.blob((math.cos(a) * rr * .9, 2.1 + r.random() * .7, math.sin(a) * rr * .9), .38 + r.random() * .15, M['grn' if k % 3 else 'grn2'], seed * 31 + k, .75)
    return b.build(name)


def bins(name):
    b = GB(70); t = X(b)
    for k, m in enumerate(['steel', 'steel', 'steel']):
        x = (k - 1) * .5
        t.box(x - .22, x + .22, 0, .85, -.25, .25, M['steel']); t.box(x - .23, x + .23, .85, .9, -.26, .26, M[['yel', 'bsg', 'dark'][k]] if k != 1 else M['grey'])
        t.box(x - .1, x + .1, .7, .8, .25, .252, M['ink'])
    return b.build(name)


def pylon(name, lines):
    """導引柱：3.2 m 高的深灰立牌，上面一塊黃色燈箱（雙面），每行一段字與箭頭（'<' '>' '^' 在字前）"""
    b = GB(71); t = X(b); n = len(lines); h = .5 * n + .2
    t.box(-.12, .12, 0, 3.4 - h, -.12, .12, M['dark']); t.box(-.4, .4, 0, .04, -.3, .3, M['dark'])
    t.box(-1.1, 1.1, 3.4 - h, 3.4, -.14, .14, M['dark'])
    for sz in (-1, 1):
        t.box(-1.05, 1.05, 3.4 - h + .05, 3.35, min(sz * .14, sz * .15), max(sz * .14, sz * .15), M['ysg'])
        for k, s in enumerate(lines):
            y = 3.4 - .35 - k * .5; arrow, txt = (s[0], s[1:]) if s[0] in '<>^' else (None, s)
            u0 = -.85
            if arrow:
                cu = u0 + .15; z = sz * .151
                Pq = lambda u, v: (cu * sz + u * sz, y + v, z)
                if arrow == '^': pts = [Pq(0, .17), Pq(.15, 0), Pq(.05, 0), Pq(.05, -.17), Pq(-.05, -.17), Pq(-.05, 0), Pq(-.15, 0)]
                else:
                    d = 1 if arrow == '>' else -1; pts = [Pq(d * .17, 0), Pq(0, .15 * d), Pq(0, .05 * d), Pq(-.17 * d, .05 * d), Pq(-.17 * d, -.05 * d), Pq(0, -.05 * d), Pq(0, -.15 * d)]
                    pts = pts if d > 0 else pts
                t.poly(pts if sz > 0 else pts[::-1], M['ink'])
                if arrow == '<' or arrow == '>':
                    pass
                u0 += .4
            t.text(txt, .22, ((u0 + len(txt) * .065) * sz, y, sz * .151), (sz, 0, 0), (0, 0, sz), M['ink'], .006)
    return b.build(name)


def rental(name, W=12.0):
    """租車櫃台：沿牆的長檯（三家，虛構名）、後面的燈箱"""
    b = GB(72); t = X(b)
    t.box(-W / 2, W / 2, 0, 1.0, -.9, -.2, M['white']); t.box(-W / 2 - .05, W / 2 + .05, 1.0, 1.05, -.95, -.15, M['solid'])
    t.box(-W / 2, W / 2, .05, .98, -.2, -.18, M['walnut'])
    for k, (nm, m) in enumerate([('CAPE RENT', 'bsg'), ('HARBOR CARS', 'rtx'), ('NEON DRIVE', 'gtx')]):
        x = -W / 2 + W / 6 + k * W / 3
        t.box(x - 1.8, x + 1.8, 2.3, 3.0, -1.6, -1.5, M[m]); t.text(nm, .3, (x, 2.65, -1.49), (1, 0, 0), (0, 0, 1), M['txt'], .01)
        t.box(x - .3, x + .3, 1.05, 1.4, -.7, -.67, M['dark'])
    t.box(-W / 2, W / 2, 0, 3.2, -1.7, -1.6, M['walnut'])
    return b.build(name)


def kiosk(name, n=4):
    """自助報到機一排：白色立柱、往後傾的觸控螢幕、印表機出口與讀卡機，上方一條 SELF CHECK-IN 燈箱"""
    b = GB(73); t = X(b); P = 1.0
    for i in range(n):
        x = (i - (n - 1) / 2) * P
        t.box(x - .3, x + .3, 0, .03, -.25, .25, M['dark']); t.box(x - .2, x + .2, .03, 1.0, -.16, .14, M['white'])
        a = math.radians(28)
        t.obb((x, 1.2, -.02), (.26, 0, 0), (0, .2 * math.cos(a), -.2 * math.sin(a)), (0, .05 * math.sin(a), .05 * math.cos(a)), M['white'])
        t.obb((x, 1.2, .03), (.23, 0, 0), (0, .17 * math.cos(a), -.17 * math.sin(a)), (0, .006 * math.sin(a), .006 * math.cos(a)), M['scr'])
        t.text('CHECK-IN', .045, (x, 1.25, .04 + .012), (1, 0, 0), (0, math.sin(a), math.cos(a)), M['txt'], .002) if False else None
        t.obb((x, 1.27, .045), (.15, 0, 0), (0, .025 * math.cos(a), -.025 * math.sin(a)), (0, .004 * math.sin(a), .004 * math.cos(a)), M['txt'])
        t.obb((x, 1.15, .07), (.08, 0, 0), (0, .04 * math.cos(a), -.04 * math.sin(a)), (0, .004 * math.sin(a), .004 * math.cos(a)), M['gtx'])
        t.box(x - .12, x + .12, .9, .93, .13, .15, M['ink']); t.box(x + .1, x + .17, .95, 1.02, .1, .16, M['dark'])
    L = n * P / 2 + .1
    for sx in (-1, 1): t.box(sx * L - .04, sx * L + .04, 0, 2.5, -.2, -.12, M['steel'])
    t.box(-L, L, 2.2, 2.55, -.22, -.1, M['dark']); t.box(-L + .05, L - .05, 2.24, 2.51, -.1, -.095, M['ysg'])
    t.text('SELF CHECK-IN', .18, (0, 2.375, -.094), (1, 0, 0), (0, 0, 1), M['ink'], .005)
    return b.build(name)


def sbd(name, n=3):
    """自助行李託運：每座一個行李秤（橡膠面、不鏽鋼框）、側邊的螢幕與吊牌印表機柱、後面的鉛簾開口，接到後面的輸送帶"""
    b = GB(74); t = X(b); P = 2.0
    for i in range(n):
        x = (i - (n - 1) / 2) * P
        t.box(x - .55, x + .55, 0, .38, -.9, .3, M['steel']); t.box(x - .5, x + .5, .38, .41, -.85, .25, M['rubber'])
        for k in range(8): t.box(x - .5, x + .5, .41, .415, -.82 + k * .14, -.8 + k * .14, M['dark'])
        t.box(x - .62, x - .55, 0, 1.1, -.9, .3, M['steel']); t.box(x + .55, x + .62, 0, 1.1, -.9, .3, M['steel'])
        t.box(x - .65, x + .65, 1.9, 2.3, -1.1, -.9, M['dark']); t.box(x - .62, x + .62, .41, 1.9, -1.1, -1.05, M['grey'])
        for k in range(8): t.box(x - .5 + k * .125, x - .39 + k * .125, .45, 1.2, -1.04, -1.02, M['curtain'])
        t.box(x + .7, x + 1.0, 0, 1.45, -.4, -.1, M['white'])
        a = math.radians(20)
        t.obb((x + .85, 1.5, -.22), (.18, 0, 0), (0, .14 * math.cos(a), -.14 * math.sin(a)), (0, .03 * math.sin(a), .03 * math.cos(a)), M['white'])
        t.obb((x + .85, 1.5, -.185), (.16, 0, 0), (0, .12 * math.cos(a), -.12 * math.sin(a)), (0, .004 * math.sin(a), .004 * math.cos(a)), M['scr'])
        t.box(x + .78, x + .92, 1.05, 1.1, -.1, -.08, M['ink'])
        t.box(x - .3, x + .3, 2.0, 2.2, -.9, -.88, M['gtx'])
    W = n * P / 2 + .2
    t.box(-W, W, 0, .5, -2.2, -1.1, M['steel']); t.box(-W, W, .5, .54, -2.1, -1.2, M['rubber'])
    t.box(-W, W, 2.3, 2.75, -1.12, -.95, M['dark']); t.box(-W + .05, W - .05, 2.34, 2.71, -.95, -.945, M['ysg'])
    t.text('SELF BAG DROP', .2, (0, 2.525, -.944), (1, 0, 0), (0, 0, 1), M['ink'], .005)
    return b.build(name)


def immig(name, n=4, P=3.0):
    """證照查驗：一排查驗亭（白色亭身、檯面、霧面上半、亭頂的號碼燈），亭與亭之間是旅客走道，走道出口有不鏽鋼的單向門柱；人往 −x 走，亭朝 +z 側的走道"""
    b = GB(75); t = X(b)
    for i in range(n):
        z = (i - (n - 1) / 2) * P
        t.box(-1.2, 1.2, 0, 1.15, z - .75, z + .75, M['white']); t.box(-1.25, 1.25, 1.15, 1.2, z - .8, z + .8, M['solid'])
        t.box(-1.2, 1.2, 1.2, 2.2, z - .75, z - .7, M['solid']); t.box(-1.2, -1.15, 1.2, 2.2, z - .75, z + .75, M['solid']); t.box(1.15, 1.2, 1.2, 2.2, z - .75, z + .75, M['solid'])
        t.box(-1.2, 1.2, 2.2, 2.3, z - .8, z + .8, M['steel']); t.box(-.3, .3, 2.3, 2.6, z + .5, z + .8, M['dark']); t.box(-.27, .27, 2.33, 2.57, z + .8, z + .81, M['gtx'])
        t.text('%d' % (i + 1), .2, (0, 2.45, z + .812), (1, 0, 0), (0, 0, 1), M['ink'], .005)
        t.box(-.2, .2, 1.2, 1.5, z + .55, z + .58, M['dark']); t.box(.35, .55, 1.2, 1.28, z + .6, z + .75, M['ink'])
        t.box(-.5, .5, .45, .5, z - .5, z + .3, M['walnut']) ; t.cyl(0, z - .2, 0, .45, .05, 8, M['dark'])   # 查驗官的椅子
        t.box(-.4, .4, .45, .55, z - .5, z - .1, M['navy'])
        for sx in (-1.6, -2.6):   # 走道出口的門柱與擺臂
            t.box(sx - .05, sx + .05, 0, 1.0, z + .78, z + .88, M['steel']); t.box(sx - .02, sx + .02, .8, .86, z + .88, z + 1.6, M['steel'])
    t.box(1.4, 1.5, 0, 2.6, -n * P / 2, -n * P / 2 + .1, M['steel']) if False else None
    t.box(-.2, .2, 0, 3.2, -n * P / 2 - .3, -n * P / 2 - .1, M['steel']); t.box(-.2, .2, 0, 3.2, n * P / 2 + .1, n * P / 2 + .3, M['steel'])
    t.box(-.25, .25, 3.0, 3.5, -n * P / 2 - .3, n * P / 2 + .3, M['dark'])
    for sx in (-1, 1): t.box(min(sx * .25, sx * .26), max(sx * .25, sx * .26), 3.05, 3.45, -n * P / 2 - .2, n * P / 2 + .2, M['ysg'])
    for sx in (-1, 1): t.text('IMMIGRATION  -  ALL PASSPORTS', .24, (sx * .262, 3.25, 0), (0, 0, -sx), (sx, 0, 0), M['ink'], .006)
    return b.build(name)


def egate(name, n=3, P=1.5):
    """自動查驗通關 e-Gate：每道兩扇玻璃擺門、前面的護照讀取台與螢幕、出口的人臉辨識柱；人往 −x 走"""
    b = GB(76); t = X(b)
    for i in range(n + 1):
        z = (i - n / 2) * P
        t.box(-1.6, 1.0, 0, 1.05, z - .14, z + .14, M['white']); t.box(-1.62, 1.02, 1.05, 1.08, z - .16, z + .16, M['steel'])
        t.box(-1.55, .95, .2, .25, z - .145, z + .145, M['gtx'])
    for i in range(n):
        z = (i - (n - 1) / 2) * P
        for sx in (-1, 1): t.box(-.06, .06, .15, 1.6, z + sx * .2 - .01, z + sx * .2 + .01, M['glass']) if False else t.obb((0, .9, z + sx * .38), (.03, 0, 0), (0, .7, 0), (0, 0, .3), M['glass'])
        t.box(.9, 1.3, 0, 1.15, z - .3, z + .3, M['white']); a = math.radians(30)
        t.obb((1.1, 1.22, z), (.15, 0, 0), (0, .08 * math.cos(a), 0), (0, 0, .2), M['dark']); t.box(1.18, 1.21, 1.25, 1.45, z - .14, z + .14, M['scr'])
        t.box(-1.8, -1.7, 0, 1.7, z - .05, z + .05, M['steel']); t.box(-1.82, -1.68, 1.55, 1.75, z - .1, z + .1, M['dark']); t.box(-1.68, -1.67, 1.58, 1.72, z - .07, z + .07, M['glass'])
    W = n * P / 2 + .2
    t.box(.0, .1, 2.5, 2.9, -W, W, M['dark']); t.box(.1, .11, 2.55, 2.85, -W + .1, W - .1, M['bsg'])
    t.text('e-GATE', .22, (.112, 2.7, 0), (0, 0, -1), (1, 0, 0), M['txt'], .005)
    for sz in (-1, 1): t.box(-.05, .05, 0, 2.5, sz * W - .05, sz * W + .05, M['steel'])
    return b.build(name)


def bscan(name):
    """全身掃描儀（毫米波）：圓形底座、兩片弧形掃描牆（前後開口，人沿 x 走過）、頂蓋、側邊的螢幕"""
    b = GB(77); t = X(b); n = 20
    t.cyl(0, 0, 0, .08, .95, 28, M['grey'])
    for sz in (-1, 1):
        for i in range(n):
            a0 = math.pi * (.2 + .6 * i / n); a1 = math.pi * (.2 + .6 * (i + 1) / n)
            P = lambda r, a, y: (r * math.cos(a), y, sz * r * math.sin(a))
            pts = [P(.9, a0, .08), P(.9, a1, .08), P(.9, a1, 2.3), P(.9, a0, 2.3)]; t.poly(pts if sz < 0 else pts[::-1], M['white'])
            pts = [P(.78, a1, .08), P(.78, a0, .08), P(.78, a0, 2.3), P(.78, a1, 2.3)]; t.poly(pts if sz < 0 else pts[::-1], M['solid'])
            pts = [P(.78, a0, 2.3), P(.9, a0, 2.3), P(.9, a1, 2.3), P(.78, a1, 2.3)]; t.poly(pts if sz < 0 else pts[::-1], M['grey'])
        for a in (.2, .8):
            c = math.pi * a; t.box(.84 * math.cos(c) - .07, .84 * math.cos(c) + .07, .08, 2.3, sz * .84 * math.sin(c) - .07, sz * .84 * math.sin(c) + .07, M['grey'])
    t.cyl(0, 0, 2.3, 2.45, 1.0, 28, M['white']); t.cyl(0, 0, 2.45, 2.47, .6, 20, M['gtx'])
    t.box(-.1, .1, 1.0, 1.6, -1.15, -1.0, M['dark']); t.box(-.09, .09, 1.05, 1.55, -1.0, -.99, M['scr'])
    for x in (-.25, .25):   # 地上的腳印標示
        t.box(x - .06, x + .06, .08, .085, -.25, -.05, M['yel']); t.box(x - .06, x + .06, .08, .085, .05, .25, M['yel'])
    return b.build(name)


def quar(name):
    """檢疫：櫃台（QUARANTINE 燈箱）、三腳架上的熱像儀與監看螢幕、紅色的農產品棄置箱"""
    b = GB(78); t = X(b)
    t.box(-1.5, 1.5, 0, 1.0, -.4, .3, M['white']); t.box(-1.55, 1.55, 1.0, 1.05, -.45, .35, M['solid']); t.box(-1.48, 1.48, .05, .98, .3, .32, M['wood'])
    t.box(-.5, .5, 1.05, 1.4, -.3, -.27, M['dark'])
    for s, (ox, oz) in enumerate([(-.2, -.2), (.2, -.2), (0, .15)]): t.tube((2.4 + ox * 1.5, 0, 0 + oz * 1.5), (2.4, 1.7, 0), .015, M['dark'], 6)
    t.box(2.28, 2.52, 1.7, 1.86, -.14, .14, M['dark']); t.cyl(2.4, .15, 1.73, 1.83, .05, 10, M['glass'])
    t.box(-1.0, 1.0, 0, 3.0, -.55, -.45, M['steel']) if False else None
    for px in (-1.3, 1.3): t.box(px - .05, px + .05, 0, 3.0, -.55, -.45, M['steel'])
    t.box(-1.5, 1.5, 2.6, 3.1, -.56, -.44, M['dark']); t.box(-1.45, 1.45, 2.64, 3.06, -.44, -.435, M['gtx'])
    t.text('QUARANTINE', .26, (0, 2.85, -.434), (1, 0, 0), (0, 0, 1), M['ink'], .006)
    t.box(-3.0, -2.2, 0, 1.0, -.4, .4, M['red']); t.box(-2.9, -2.3, 1.0, 1.02, -.3, .3, M['ink']); t.box(-2.85, -2.35, .55, .85, .4, .41, M['wsg'])
    t.text('FOOD & PLANTS', .06, (-2.6, .75, .412), (1, 0, 0), (0, 0, 1), M['ink'], .002); t.text('DISPOSAL', .08, (-2.6, .63, .412), (1, 0, 0), (0, 0, 1), M['ink'], .002)
    return b.build(name)


def customs(name):
    """海關：門形燈箱架（綠：NOTHING TO DECLARE、紅：GOODS TO DECLARE）、紅線那側的檢查檯與小型 X 光機；人往 −z 走"""
    b = GB(79); t = X(b)
    for x in (-5.0, 0.0, 5.0): t.box(x - .1, x + .1, 0, 3.4, -.1, .1, M['steel'])
    t.box(-5.1, 5.1, 3.2, 3.8, -.15, .15, M['dark'])
    for sz in (-1, 1):
        z = sz * .155
        t.box(-4.95, -.15, 3.25, 3.75, min(z, z + sz * .01), max(z, z + sz * .01), M['gtx']); t.box(.15, 4.95, 3.25, 3.75, min(z, z + sz * .01), max(z, z + sz * .01), M['rtx'])
        t.text('NOTHING TO DECLARE', .24, (-2.55 * sz, 3.5, z + sz * .011), (sz, 0, 0), (0, 0, sz), M['ink'], .005)
        t.text('GOODS TO DECLARE', .24, (2.55 * sz, 3.5, z + sz * .011), (sz, 0, 0), (0, 0, sz), M['ink'], .005)
    for k in range(2):
        z = 1.5 + k * 2.4
        t.box(2.0, 4.6, 0, .85, z - .5, z + .5, M['steel']); t.box(1.95, 4.65, .85, .9, z - .55, z + .55, M['steel'])
        t.box(2.2, 2.8, .9, 1.1, z - .3, z + .3, M['tray'])
    t.box(1.0, 2.2, 0, 1.3, 6.0, 7.2, M['white']); t.box(.95, 2.25, .55, .95, 5.95, 7.25, M['dark'])
    for sz in (0.0,): t.box(-.03, .03, 0, .02, -.1, 7.5, M['floor2'])
    return b.build(name)


def carousel(name, L=12.0, R=2.6):
    """行李轉盤（斜板式）：跑道形，外圈不鏽鋼裙板、往內斜上的橡膠板（每 0.3 m 一道接縫）、中間的島與進料口的鉛簾罩、端頭柱上的航班螢幕；板上幾件行李"""
    b = GB(80); t = X(b); n = 16
    def ring(r):   # 跑道形的周邊點（沿 x 的長軸）
        P = []
        for i in range(n + 1): a = -math.pi / 2 + math.pi * i / n; P.append((L / 2 + r * math.cos(a), r * math.sin(a)))
        for i in range(n + 1): a = math.pi / 2 + math.pi * i / n; P.append((-L / 2 + r * math.cos(a), r * math.sin(a)))
        return P
    o, m_, i_ = ring(R), ring(R - .15), ring(R - 1.15)
    for k in range(len(o)):
        a, c = o[k], o[(k + 1) % len(o)]; am, cm = m_[k], m_[(k + 1) % len(o)]; ai, ci = i_[k], i_[(k + 1) % len(o)]
        t.poly([(a[0], 0, a[1]), (c[0], 0, c[1]), (c[0], .42, c[1]), (a[0], .42, a[1])][::-1], M['steel'])
        t.poly([(a[0], .42, a[1]), (c[0], .42, c[1]), (cm[0], .44, cm[1]), (am[0], .44, am[1])][::-1], M['steel'])
        t.poly([(am[0], .44, am[1]), (cm[0], .44, cm[1]), (ci[0], .62, ci[1]), (ai[0], .62, ai[1])][::-1], M['rubber'])
    zz = -L / 2
    while zz < L / 2:
        for sz in (-1, 1): t.box(zz - .01, zz + .01, .445, .63, min(sz * (R - .15), sz * (R - 1.15)), max(sz * (R - .15), sz * (R - 1.15)), M['dark']) if False else t.obb((zz, .535, sz * (R - .65)), (.008, 0, 0), (0, .09, -sz * .02), (0, sz * .0, .5), M['dark'])
        zz += .45
    ii = ring(R - 1.2)
    t.box(-L / 2, L / 2, 0, .65, -(R - 1.2), R - 1.2, M['steel'])
    for k in range(len(ii)):
        a, c = ii[k], ii[(k + 1) % len(ii)]; t.poly([(a[0], .62, a[1]), (c[0], .62, c[1]), (c[0], .65, c[1]), (a[0], .65, a[1])], M['steel'])
    t.box(-L / 2 - .5, -L / 2 + 1.2, .65, 2.0, -.9, .9, M['grey']); t.box(-L / 2 + 1.2, -L / 2 + 1.22, .7, 1.4, -.8, .8, M['curtain'])
    t.box(-L / 2 - .5, -L / 2 + 1.25, 2.0, 2.1, -.95, .95, M['dark'])
    t.box(L / 2 + R + .6, L / 2 + R + .75, 0, 2.6, -.08, .08, M['steel']); t.box(L / 2 + R + .5, L / 2 + R + .85, 2.2, 3.0, -.9, .9, M['dark'])
    for sx in (-1, 1): t.box(L / 2 + R + .5 if sx < 0 else L / 2 + R + .85, L / 2 + R + .5 if sx < 0 else L / 2 + R + .86, 2.25, 2.95, -.85, .85, M['scr']) if False else None
    t.box(L / 2 + R + .45, L / 2 + R + .5, 2.25, 2.95, -.85, .85, M['scr']); t.box(L / 2 + R + .85, L / 2 + R + .9, 2.25, 2.95, -.85, .85, M['scr'])
    for xx, R_, N_ in ((L / 2 + R + .449, (0, 0, 1), (-1, 0, 0)), (L / 2 + R + .901, (0, 0, -1), (1, 0, 0))):
        t.text('1', .5, (xx, 2.7, 0 if R_[2] > 0 else 0), R_, N_, M['amb'], .005)
        t.text('NC 317  SINGAPORE', .09, (xx, 2.38, 0), R_, N_, M['txt'], .003)
    r = random.Random(3)
    for k in range(9):   # 行李：硬殼箱（拉桿、把手）
        u = r.random(); sz = 1 if k % 2 else -1; x = -L / 2 + 1.5 + u * (L - 2)
        w, h, d = .45 + r.random() * .2, .25 + r.random() * .1, .65 + r.random() * .2
        m = PROD[r.randrange(12)]; zc = sz * (R - .62)
        t.obb((x, .55 + h / 2, zc), (d / 2, 0, 0), (0, h / 2, -sz * .05), (0, sz * .0, w / 2), m)
        t.box(x - .12, x + .12, .55 + h, .58 + h, zc - .02, zc + .02, M['ink'])
    return b.build(name)


def bagsvc(name, W=7.0):
    """行李服務：長櫃台、後面木牆上的燈箱（BAGGAGE SERVICES／LOST & FOUND），旁邊的大件行李出口（滾筒、鉛簾）"""
    b = GB(81); t = X(b)
    t.box(-W / 2, W / 2, 0, 1.0, -.9, -.2, M['white']); t.box(-W / 2 - .05, W / 2 + .05, 1.0, 1.05, -.95, -.15, M['solid']); t.box(-W / 2, W / 2, .05, .98, -.2, -.18, M['wood'])
    t.box(-W / 2, W / 2, 0, 3.2, -1.9, -1.8, M['walnut']); t.box(-W / 2 + .5, W / 2 - .5, 2.3, 3.0, -1.8, -1.78, M['bsg'])
    t.text('BAGGAGE SERVICES', .26, (0, 2.78, -1.775), (1, 0, 0), (0, 0, 1), M['txt'], .005); t.text('LOST & FOUND', .18, (0, 2.48, -1.775), (1, 0, 0), (0, 0, 1), M['txt'], .005)
    for x in (-2.0, 0.0, 2.0): t.box(x - .25, x + .25, 1.05, 1.38, -.75, -.72, M['dark'])
    ox = W / 2 + 2.0
    t.box(ox - 1.2, ox + 1.2, 0, .6, -1.8, .4, M['steel'])
    for k in range(10): t.box(ox - 1.1, ox + 1.1, .6, .64, -1.7 + k * .2, -1.62 + k * .2, M['grey'])
    t.box(ox - 1.3, ox + 1.3, .6, 2.6, -1.95, -1.8, M['grey']); t.box(ox - 1.3, ox + 1.3, 2.6, 3.2, -1.95, -1.7, M['dark'])
    for k in range(10): t.box(ox - 1.0 + k * .2, ox - .82 + k * .2, .65, 2.0, -1.8, -1.78, M['curtain'])
    t.box(ox - 1.2, ox + 1.2, 2.65, 3.15, -1.7, -1.69, M['ysg']); t.text('OVERSIZE', .22, (ox, 2.9, -1.689), (1, 0, 0), (0, 0, 1), M['ink'], .005)
    return b.build(name)


def room(t, W, D, H, front_m, sign, signm, ink, door=1.6):
    """小房間（貴賓室、祈禱室、淋浴間）：三面牆＋正面牆（中間開門），門上燈箱"""
    t.box(-W / 2, W / 2, 0, H, -D, -D + .2, M['plaster'])
    for sx in (-1, 1): t.box(min(sx * W / 2, sx * (W / 2 - .2)), max(sx * W / 2, sx * (W / 2 - .2)), 0, H, -D, 0, M['plaster'])
    t.box(-W / 2, -door / 2, 0, H, -.2, 0, front_m); t.box(door / 2, W / 2, 0, H, -.2, 0, front_m); t.box(-door / 2, door / 2, 2.4, H, -.2, 0, front_m)
    for sx in (-1, 1): t.box(sx * door / 2 - .05, sx * door / 2 + .05, 0, 2.4, -.22, .02, M['steel'])
    t.box(-W / 2, W / 2, H, H + .15, -D, 0, M['white']); t.box(-W / 2 + .2, W / 2 - .2, H - .05, H, -D + .2, -.2, M['ceil'])
    t.box(-min(2.4, W / 2 - .3), min(2.4, W / 2 - .3), 2.55, 3.0, 0, .05, signm); t.text(sign, .26, (0, 2.775, .051), (1, 0, 0), (0, 0, 1), ink, .006)


def lounge(name, W=11.0, D=7.0, H=3.4):
    b = GB(82); t = X(b); room(t, W, D, H, M['solid'], 'SKY LOUNGE', M['wsg'], M['ink'], door=2.4)
    for sx in (-1, 1):   # 霧面玻璃前牆上的橫條
        for y in (1.0, 1.05): t.box(min(sx * 1.2, sx * (W / 2 - .2)), max(sx * 1.2, sx * (W / 2 - .2)), y, y + .02, .0, .01, M['steel'])
    t.box(-1.5, 1.5, 0, 1.05, -2.0, -1.4, M['walnut']); t.box(-1.55, 1.55, 1.05, 1.1, -2.05, -1.35, M['trav'])   # 接待台
    t.box(-W / 2 + .3, W / 2 - .3, .005, .01, -D + .3, -.4, M['navy'])                                             # 地毯
    for x, z in ((-3.4, -3.6), (3.4, -3.6), (-3.4, -5.6), (3.4, -5.6)):   # 沙發與茶几
        t.box(x - 1.0, x + 1.0, .02, .42, z - .45, z + .45, M['walnut']); t.box(x - .95, x + .95, .42, .55, z - .4, z + .35, M['navy']); t.box(x - 1.0, x + 1.0, .42, .9, z - .45, z - .3, M['navy'])
        t.cyl(x, z + 1.0, 0, .42, .04, 8, M['steel']); t.cyl(x, z + 1.0, .42, .45, .45, 18, M['trav'])
    t.box(-W / 2 + .3, -W / 2 + 2.5, 0, .9, -D + .3, -D + .9, M['walnut']); t.box(-W / 2 + .3, -W / 2 + 2.5, .9, .95, -D + .25, -D + .95, M['trav'])
    return b.build(name)


def prayer(name, W=6.0, D=5.0, H=3.2):
    b = GB(83); t = X(b); room(t, W, D, H, M['trav'], 'PRAYER ROOM', M['wsg'], M['ink'])
    t.box(-W / 2 + .3, W / 2 - .3, .005, .015, -D + .3, -.5, M['walnut'])
    t.box(-W / 2 + .3, -W / 2 + 1.5, 0, .5, -1.0, -.3, M['wood'])   # 鞋櫃
    for k in range(3): t.box(-W / 2 + .35, -W / 2 + 1.45, .12 + k * .14, .14 + k * .14, -.95, -.35, M['walnut'])
    return b.build(name)


def shower(name, W=7.0, D=6.0, H=3.2):
    b = GB(84); t = X(b); room(t, W, D, H, M['trav'], 'SHOWERS', M['wsg'], M['ink'])
    t.box(-1.6, 1.6, 0, 1.0, -1.6, -1.1, M['white']); t.box(-1.65, 1.65, 1.0, 1.05, -1.65, -1.05, M['trav'])
    for k in range(4): t.box(-W / 2 + .3 + k * 1.6, -W / 2 + 1.7 + k * 1.6, 0, 2.4, -D + .2, -D + .25, M['grey']) if k < 4 else None
    return b.build(name)


def transfer(name):
    b = GB(85); t = X(b)
    t.box(-2.0, 2.0, 0, 1.0, -.5, .2, M['white']); t.box(-2.05, 2.05, 1.0, 1.05, -.55, .25, M['solid']); t.box(-1.98, 1.98, .05, .98, .2, .22, M['wood'])
    for x in (-1.0, 1.0): t.box(x - .25, x + .25, 1.05, 1.4, -.35, -.32, M['dark'])
    for px in (-1.8, 1.8): t.box(px - .05, px + .05, 0, 3.0, -.7, -.6, M['steel'])
    t.box(-2.0, 2.0, 2.5, 3.0, -.71, -.59, M['dark']); t.box(-1.95, 1.95, 2.54, 2.96, -.59, -.585, M['bsg'])
    t.text('TRANSFER', .26, (0, 2.75, -.584), (1, 0, 0), (0, 0, 1), M['txt'], .006)
    return b.build(name)



def esc_unit(b, ox, oz, ry, up, L, rise, under=True):
    """電扶梯一座：局部框的 z 0..L 從 F0 升到 F0+rise，兩端 1.2 m 平台；不鏽鋼機殼側板、白色扶手板、黑扶手、帶黃邊的階梯"""
    t = X(b, ox, 0, oz, ry); w = .5; ang = math.atan2(rise, L); Ft = F0 + rise
    for sx in (-1, 1):
        x = sx * (w + .12)
        t.poly([(x, F0 - .3, -1.2), (x, F0 + .1, -1.2), (x, Ft + .1, L), (x, Ft + .1, L + 1.2), (x, Ft - .9, L + 1.2), (x, F0 - .3, 0)][::sx], M['steel'])
        x2 = sx * (w + .05)
        for k in range(2):
            xx = x2 + sx * k * .14
            t.box(min(xx, xx + sx * .02), max(xx, xx + sx * .02), F0 + .1, F0 + 1.0, -1.0, 0, M['white'])
            t.obb((xx + sx * .01, F0 + rise / 2 + .55, L / 2), (.01, 0, 0), (0, rise / 2, L / 2), (0, .45 * math.cos(ang), -.45 * math.sin(ang)), M['white'])
            t.box(min(xx, xx + sx * .02), max(xx, xx + sx * .02), Ft + .1, Ft + 1.0, L, L + 1.1, M['white'])
        hx = x2 + sx * .07
        t.tube((hx, F0 + 1.02, -1.0), (hx, F0 + 1.02, 0), .035, M['rubber'], 8); t.tube((hx, F0 + 1.02, 0), (hx, Ft + 1.02, L), .035, M['rubber'], 8); t.tube((hx, Ft + 1.02, L), (hx, Ft + 1.02, L + 1.1), .035, M['rubber'], 8)
        col_t(t, min(x, x2 + sx * .2) - .02, max(x, x2 + sx * .2) + .02, -1.2, L + 1.2)
    n = int(L / .4)
    for k in range(n):
        z0 = k * L / n; y0 = F0 + rise * k / n
        t.box(-w, w, y0, y0 + rise / n, z0, z0 + L / n, M['dark']); t.box(-w, w, y0 + rise / n, y0 + rise / n + .005, z0, z0 + .05, M['yel'])
    t.box(-w, w, F0, F0 + .01, -1.0, 0, M['steel']); t.box(-w, w, Ft, Ft + .01, L, L + 1.2, M['steel'])
    t.obb((0, F0 + rise / 2 - .5, L / 2), (w + .12, 0, 0), (0, rise / 2, L / 2), (0, .4 * math.cos(ang), -.4 * math.sin(ang)), M['steel'])
    walk_ramp_t(t, -w, w, 0, L, F0, Ft); walk_ramp_t(t, -w, w, L, L + 1.2, Ft, Ft)
    if under: under_block(t, -w - .12, w + .12, L, rise)
    t.box(-.3, .3, F0 + 1.15, F0 + 1.35, -1.25, -1.2, M['gtx' if up else 'rtx'])

# ════════ 建築：地坪、夾層、柱、欄杆、後勤牆、安檢隔牆、樓梯與電扶梯、西牆內面、窗台、門外坡道 ════════
COL, WALK, LIGHTS = [], {'flat': [], 'ramp': [], 'ceil': []}, []
def col(x0, x1, z0, z1, lv=None, ly=None, hy=None):   # lv：0＝只擋一樓（hy 3）、1＝只擋二樓（ly 3）、None＝都擋；也可以直接給 ly／hy（站的高度 colY 在這之間才擋）
    if lv == 0: hy = 3.0
    if lv == 1: ly = 3.0
    COL.append([round(min(x0, x1), 3), round(max(x0, x1), 3), round(min(z0, z1), 3), round(max(z0, z1), 3), ly, hy])
def col_t(t, x0, x1, z0, z1, **kw):   # 局部座標（X 的框）的盒轉成遊戲座標的 AABB（只用在轉 90° 倍數的框）
    P = [t.p((x, 0, z)) for x in (x0, x1) for z in (z0, z1)]
    col(min(q[0] for q in P), max(q[0] for q in P), min(q[2] for q in P), max(q[2] for q in P), **kw)
def walk_ramp_t(t, x0, x1, z0, z1, ya, yb):   # 局部沿 +z 升的坡（z0 → ya、z1 → yb）轉成 WALK 的 ramp
    P = [t.p((x, 0, z)) for x in (x0, x1) for z in (z0, z1)]; a, c = t.p((0, 0, z0)), t.p((0, 0, z1))
    X0, X1, Z0, Z1 = min(q[0] for q in P), max(q[0] for q in P), min(q[2] for q in P), max(q[2] for q in P)
    if abs(c[0] - a[0]) > abs(c[2] - a[2]): WALK['ramp'].append([X0, X1, Z0, Z1, ya if c[0] > a[0] else yb, yb if c[0] > a[0] else ya, 'x'])
    else: WALK['ramp'].append([X0, X1, Z0, Z1, ya if c[2] > a[2] else yb, yb if c[2] > a[2] else ya, 'z'])
def under_block(t, x0, x1, L, rise, top=1.2):
    """坡底下擋住地面的人（坡在局部 z 0..L 從 F0 升到 F0+rise）：每 0.5 m 一個盒，hy = 那一段坡的最低高度 − 0.3，坡上的人比 hy 高、不會被擋；頂端平台底下 hy 3"""
    z = 0.0
    while z < L - 1e-6:
        h = F0 + rise * z / L
        if h > 1.1: col_t(t, x0, x1, z, min(L, z + .5), hy=round(h - .3, 2))
        z += .5
    col_t(t, x0, x1, L, L + top, hy=3.0)


def rail(t, pts, y, lv=1):
    """不鏽鋼欄杆：1.1 m 高，1.5 m 一支柱、木扶手、五條橫桿；底下一條踢腳；碰撞是一條薄盒"""
    for a, c in zip(pts, pts[1:]):
        L = math.dist(a, c); n = max(1, int(L / 1.5))
        for i in range(n + 1):
            q = (a[0] + (c[0] - a[0]) * i / n, a[1] + (c[1] - a[1]) * i / n)
            t.box(q[0] - .025, q[0] + .025, y, y + 1.08, q[1] - .025, q[1] + .025, M['steel'])
        ux, uz = (c[0] - a[0]) / L, (c[1] - a[1]) / L
        t.obb(((a[0] + c[0]) / 2, y + 1.11, (a[1] + c[1]) / 2), (ux * L / 2, 0, uz * L / 2), (0, .035, 0), (-uz * .04, 0, ux * .04), M['walnut'])
        for k in range(5): t.tube((a[0], y + .18 + k * .18, a[1]), (c[0], y + .18 + k * .18, c[1]), .006, M['steel'], 5)
        t.obb(((a[0] + c[0]) / 2, y + .06, (a[1] + c[1]) / 2), (ux * L / 2, 0, uz * L / 2), (0, .06, 0), (-uz * .03, 0, ux * .03), M['steel'])
        col(a[0] - .06, c[0] + .06, a[1] - .06, c[1] + .06, lv)


def ceiling():
    """大廳的木格柵天花：沿屋頂底面（roof_in）往下 0.45 m，東西向的長條（寬 0.9 m、間隔 0.35 m）跟著拱的斜度轉；每 6 條的縫裡一條線型燈。
    另成一件（air_t1c）：不用切刀、不用 AO 的細分，頂點很少"""
    b = GB(80); t = X(b); L = IX - .2
    z = -IZ + .7
    k = 0
    while z < IZ - .6:
        dy = -z / math.sqrt(R_T * R_T - z * z); n = math.sqrt(1 + dy * dy)
        y = roof_in(z) - .45
        t.obb((0, y, z), (L, 0, 0), (0, .04 / n, -.04 * dy / n), (0, .45 * dy / n, .45 / n), M['wood'])
        if k % 6 == 3:
            zl = z + .625; dl = -zl / math.sqrt(R_T * R_T - zl * zl); nl = math.sqrt(1 + dl * dl)
            t.obb((0, roof_in(zl) - .3, zl), (L, 0, 0), (0, .02 / nl, -.02 * dl / nl), (0, .06 * dl / nl, .06 / nl), M['led'])
        z += 1.25; k += 1
    for x in range(-72, 73, 12):   # 橫向的鋼樑（格柵掛在上面）
        for i in range(36):
            za, zb = -IZ + i * IZ * 2 / 36, -IZ + (i + 1) * IZ * 2 / 36
            ya, yb = roof_in(za) - .12, roof_in(zb) - .12
            t.obb((x, (ya + yb) / 2, (za + zb) / 2), (.08, 0, 0), (0, .1, 0), (0, (yb - ya) / 2, (zb - za) / 2), M['steel'])
    return b.build('air_t1c')


def arch():
    b = GB(80); t = X(b)
    # 地坪（大理石，走道鑲深色帶）＋夾層底下與後勤牆之間
    t.box(-IX, IX, F0 - .05, F0, -IZ, IZ, M['floor'])
    for z in (-1.0, 9.0): t.box(-IX + .5, IX - .5, F0, F0 + .002, z - .15, z + .15, M['floor2'])
    for x in (-IX + .5, IX - .5): t.box(x - .15, x + .15, F0, F0 + .002, -1.0, 9.0, M['floor2'])
    WALK['flat'].append([-IX, IX, -IZ, IZ, F0])
    # 西牆內面（灰泥，到屋頂底面）與北面帷幕下的牆基頂（窗台）
    zz = [-IZ + 3.0 * i for i in range(30)] + [IZ]
    for a, c in zip(zz, zz[1:]): t.poly([(-IX, F0, c), (-IX, F0, a), (-IX, roof_in(a), a), (-IX, roof_in(c), c)], M['plaster'])
    t.box(-IX, -IX + .3, F0, 1.1, -IZ, IZ, M['trav'])
    # 西牆的大字與木飾帶（空側大廳的端景；字面朝 +x：R＝−z）
    t.box(-IX, -IX + .12, 9.4, 9.9, -38.0, 38.0, M['walnut']); t.box(-IX, -IX + .12, 16.6, 17.1, -30.0, 30.0, M['walnut'])
    t.text('GREY HERON CAPE', 3.2, (-IX + .02, 13.2, 0.0), (0, 0, -1), (1, 0, 0), M['ink'], .06)
    t.text('INTERNATIONAL AIRPORT', 1.1, (-IX + .02, 10.9, 0.0), (0, 0, -1), (1, 0, 0), M['grey'], .04)
    # ── 夾層：樓板（上大理石、下灰泥天花、邊緣白色封板）、崁燈
    for x0, x1, z0, z1 in SLABS: t.box(x0, x1, F1 - SLAB, F1 - .03, z0, z1, M['ceil']); t.box(x0, x1, F1 - .03, F1, z0, z1, M['floor'])
    for x0, x1, z0, z1 in ((HX0, HX1, HZ0 - .06, HZ0), (HX0, HX1, HZ1, HZ1 + .06)): t.box(x0, x1, F1 - SLAB - .1, F1 + .02, z0, z1, M['white'])
    t.box(HX0 - .06, HX0, F1 - SLAB - .1, F1 + .02, HZ0, HZ1, M['white'])
    t.box(MX0, MX1, F1 - SLAB - .1, F1 + .02, MZ0 - .06, MZ0, M['white']); t.box(MX1, MX1 + .06, F1 - SLAB - .1, F1 + .02, MZ0, MZ1, M['white'])
    for x in range(int(MX0) + 3, int(MX1), 3):
        for z in range(int(MZ0) + 2, int(MZ1), 3):
            if not (HX0 - .3 < x < HX1 + .3 and HZ0 - .3 < z < HZ1 + .3): t.cyl(x, z, F1 - SLAB - .012, F1 - SLAB, .1, 10, M['led'])
    for x0, x1, z0, z1 in SLABS: WALK['flat'].append([x0, x1, z0, z1, F1]); WALK['ceil'].append([x0, x1, z0, z1, F1 - SLAB, 3.0])
    # 入境：夾層往下到入境大廳的兩座電扶梯（往 +x 升：底在 x −21、頂在 −14.4），樓板開洞、洞的三邊欄杆、東邊電扶梯之間的空隙補欄杆
    for zc, up in ((33.9, 0), (35.5, 1)): esc_unit(b, HX0, zc, math.pi / 2, up, HX1 - HX0, F1 - F0)
    rail(t, [(HX0, HZ0 + .05), (HX1, HZ0 + .05)], F1); rail(t, [(HX0, HZ1 - .05), (HX1, HZ1 - .05)], F1); rail(t, [(HX0 + .05, HZ0), (HX0 + .05, HZ1)], F1)
    for z0, z1 in ((HZ0, 33.28), (34.52, 34.88), (36.12, HZ1)): rail(t, [(HX1 - .05, z0), (HX1 - .05, z1)], F1)
    # 夾層底下的柱（圓、白）：邊緣一排、裡面一排
    for x in [-72.0, -48.0, -24.0, 0.0, 24.0, 48.0, 64.5]:
        for z in (MZ0 + .8, 30.0):
            if z > BOH and x < MX1 - 2: continue
            t.cyl(x, z, F0, F1 - SLAB, .38, 20, M['white']); t.cyl(x, z, F0, F0 + .1, .42, 20, M['steel']); col(x - .4, x + .4, z - .4, z + .4, 0)
    for z in (22.0, 34.0): t.cyl(MX1 - 1.0, z, F0, F1 - SLAB, .38, 20, M['white']); col(MX1 - 1.4, MX1 - .6, z - .4, z + .4, 0)
    # 後勤牆（一樓 z 18，到東邊 x 64 再轉南到南牆）：灰泥、木飾板腰帶、員工門
    for x0, x1 in ((MX0, 32.0), (36.0, MX1 - 2.0)): t.box(x0, x1, F0, F1 - SLAB, BOH, BOH + .3, M['plaster']); col(x0, x1, BOH, BOH + .3, 0)
    t.box(32.0, 36.0, F0 + 2.8, F1 - SLAB, BOH, BOH + .3, M['plaster'])
    t.box(MX1 - 2.3, MX1 - 2.0, F0, F1 - SLAB, BOH, IZ, M['plaster']); col(MX1 - 2.3, MX1 - 2.0, BOH, IZ, 0)
    for x0, x1 in ((MX0, 32.0), (36.0, MX1 - 2.3)): t.box(x0, x1, F0 + .9, F0 + 1.0, BOH - .02, BOH, M['walnut'])
    for x in (-40.0, 12.0):   # 員工門
        t.box(x - .6, x + .6, F0, F0 + 2.3, BOH - .04, BOH, M['grey']); t.box(x - .7, x + .7, F0 + 2.3, F0 + 2.4, BOH - .05, BOH, M['dark'])
        t.box(x - .3, x + .3, F0 + 2.5, F0 + 2.7, BOH - .06, BOH - .05, M['wsg']); t.text('STAFF ONLY', .1, (x, F0 + 2.6, BOH - .061), (-1, 0, 0), (0, 0, -1), M['ink'], .003)
    # 入境出口：後勤牆上 4 m 的開口（不鏽鋼門框），北面（接機大廳）燈箱 ARRIVALS、南面（入境大廳）燈箱 EXIT
    ax = 34.0
    for sx in (-1, 1): t.box(ax + sx * 2.0 - .08, ax + sx * 2.0 + .08, F0, F0 + 2.8, BOH - .05, BOH + .35, M['steel'])
    t.box(ax - 2.08, ax + 2.08, F0 + 2.72, F0 + 2.8, BOH - .05, BOH + .35, M['steel'])
    t.box(ax - 2.4, ax + 2.4, F0 + 2.85, F0 + 3.3, BOH - .12, BOH, M['ysg']); t.text('ARRIVALS', .3, (ax, F0 + 3.07, BOH - .121), (-1, 0, 0), (0, 0, -1), M['ink'], .01)
    t.box(ax - 1.6, ax + 1.6, F0 + 2.85, F0 + 3.3, BOH + .3, BOH + .42, M['gtx']); t.text('EXIT', .3, (ax, F0 + 3.07, BOH + .421), (1, 0, 0), (0, 0, 1), M['ink'], .01)
    # 安檢線的隔牆（x −27，一樓）：北段、南段（到後勤牆）；中間是安檢通道
    for z0, z1 in ((-IZ, -34.0), (-13.6, IZ)):
        t.box(SEC_X - .15, SEC_X + .15, F0, F0 + 3.0, z0, z1, M['plaster']); t.box(SEC_X - .16, SEC_X + .16, F0 + 3.0, F0 + 3.08, z0, z1, M['steel']); col(SEC_X - .15, SEC_X + .15, z0, z1, 0)
    t.box(SEC_X - .4, SEC_X + .4, F0 + 3.08, F0 + 3.6, -26.0, -21.6, M['dark']); t.box(SEC_X + .4, SEC_X + .41, F0 + 3.13, F0 + 3.55, -25.9, -21.7, M['ysg'])
    t.text('SECURITY', .28, (SEC_X + .412, F0 + 3.34, -23.8), (0, 0, -1), (1, 0, 0), M['ink'], .01)
    # ── 一樓到二樓：兩座電扶梯（x −64、−61.8）與樓梯（x −57.4），往南升；底 z 2.2、頂 z 8.8，兩端平台
    z_a, z_b = 2.2, 8.8; L = z_b - z_a; rise = F1 - F0; ang = math.atan2(rise, L)
    for ex, up in ((-64.6, 1), (-62.2, 0)): esc_unit(b, ex, z_a, 0.0, up, L, rise)
    sx0, sx1 = -58.9, -55.9
    n = 22
    for k in range(n):   # 樓梯：洞石踏板、不鏽鋼側樑
        z0 = z_a + k * L / n; y0 = F0 + rise * (k + 1) / n
        t.box(sx0, sx1, y0 - .06, y0, z0, z0 + L / n + .02, M['trav']); t.box(sx0, sx1, y0 - rise / n, y0 - .06, z0, z0 + .03, M['trav'])
    for x in (sx0 - .08, sx1 + .08):
        t.obb((x, (F0 + F1) / 2 - .15, (z_a + z_b) / 2), (.06, 0, 0), (0, rise / 2, L / 2), (0, .3 * math.cos(ang), -.3 * math.sin(ang)), M['steel'])
        for k in range(8):
            z = z_a + k * L / 7; y = F0 + rise * k / 7
            t.box(x - .015, x + .015, y, y + 1.0, z - .015, z + .015, M['steel'])
        t.tube((x, F0 + 1.0, z_a), (x, F1 + 1.0, z_b), .025, M['walnut'], 8)
        col(x - .1, x + .1, z_a - .2, z_b)
    WALK['ramp'].append([sx0, sx1, z_a, z_b, F0, F1, 'z']); under_block(X(b, 0, 0, z_a), sx0 - .1, sx1 + .1, L, rise)
    WALK['flat'].append([-65.3, -55.9, z_b, MZ0, F1])   # 頂端平台到夾層邊
    t.box(-65.3, -55.9, F1 - SLAB, F1, z_b, MZ0, M['ceil']); t.box(-65.3, -55.9, F1 - .03, F1, z_b, MZ0, M['floor'])
    WALK['ceil'].append([-65.3, -55.9, z_b, MZ0, F1 - SLAB, 3.0])
    for x0, x1 in ((-63.98, -62.82), (-61.58, -59.0)): rail(t, [(x0, z_b + .05), (x1, z_b + .05)], F1)   # 平台北緣：電扶梯與樓梯之間的空隙
    # 樓梯與電扶梯底下圍起來（一樓的人不會走進去）：兩側擋牆
    t.box(-66.0, -65.3, F0, F1 - SLAB, z_a + 2.0, MZ0, M['plaster']); col(-66.0, -65.3, z_a + 2.0, MZ0, 0)
    t.box(-55.7, -55.0, F0, F1 - SLAB, z_a + 2.0, MZ0, M['plaster']); col(-55.7, -55.0, z_a + 2.0, MZ0, 0)
    # ── 夾層邊的欄杆：北緣（樓梯口斷開）與東緣
    rail(t, [(MX0 + .3, MZ0 + .05), (-66.0, MZ0 + .05)], F1); rail(t, [(-55.0, MZ0 + .05), (MX1 - .05, MZ0 + .05)], F1)
    rail(t, [(MX1 - .05, MZ0 + .05), (MX1 - .05, IZ - .3)], F1)
    rail(t, [(-66.0, z_b), (-66.0, MZ0)], F1); rail(t, [(-55.0, z_b), (-55.0, MZ0)], F1)
    # 南面窗台（夾層上，0.6 m 深的洞石檯面；空橋門那段斷開）
    xs = [MX0] + [v for g in GATES for v in (g - 1.8, g + 1.8)] + [MX1]
    for a, c in zip(xs[0::2], xs[1::2]):
        t.box(a, c, F1, F1 + 1.0, IZ - .35, IZ, M['plaster']); t.box(a, c, F1 + 1.0, F1 + 1.05, IZ - .45, IZ, M['trav']); col(a, c, IZ - .45, IZ, 1)
    # 外殼的南牆內面（一樓，夾層下：混凝土牆的內側已經有面）
    # ── 東門外的坡道（0.6 → 0.06，8 m）、兩側的矮牆與扶手、門外的防撞柱
    t.poly([(IX + .6, F0, -2.8), (IX + .6, F0, 2.8), (IX + 8.6, .06, 2.8), (IX + 8.6, .06, -2.8)], M['trav'])
    for s in (-1, 1):
        z = s * 2.95
        t.poly([(IX + .6, 0, z - .15 * s), (IX + .6, F0 + .25, z - .15 * s), (IX + 8.6, .3, z - .15 * s), (IX + 8.6, 0, z - .15 * s)][::-s], M['trav'])
        t.poly([(IX + .6, 0, z + .15 * s), (IX + .6, F0 + .25, z + .15 * s), (IX + 8.6, .3, z + .15 * s), (IX + 8.6, 0, z + .15 * s)][::s], M['trav'])
        t.poly([(IX + .6, F0 + .25, z - .15), (IX + .6, F0 + .25, z + .15), (IX + 8.6, .3, z + .15), (IX + 8.6, .3, z - .15)], M['trav'])
        t.tube((IX + .8, F0 + 1.15, z), (IX + 8.4, 1.2, z), .025, M['steel'], 8)
        for k in range(5): xx = IX + .8 + k * 1.9; yy = F0 + .25 + (.3 - F0 - .25) * (xx - IX - .6) / 8.0; t.tube((xx, yy, z), (xx, yy + .9, z), .02, M['steel'], 6)
        col(IX + .6, IX + 8.6, z - .15, z + .15)
    t.box(IX, IX + .6, F0 - .02, F0, -2.8, 2.8, M['steel'])
    WALK['flat'].append([IX - .6, IX + .6, -2.6, 2.6, F0]); WALK['ramp'].append([IX + .6, IX + 8.6, -2.8, 2.8, F0, .06, 'x'])
    for z in (-4.5, -3.2, 3.2, 4.5):
        t.cyl(IX + 9.4, z, 0, .9, .11, 12, M['steel']); t.cyl(IX + 9.4, z, .75, .8, .115, 12, M['ink'])
    # 屋頂底下的相機天花
    WALK['roof'] = {'k': 'arch', 'r': R_T, 'y': Y_PK, 't': RT}
    return b.build('air_t1i')



# 家具自己的碰撞盒（局部座標 [x0, x1, z0, z1]）：有這一項的照這個擋（店與房間只擋牆與櫃台、走得進去；安檢、查驗亭留出人走的道），沒有的照包圍盒
def shell_cols(W, D): return [[-W / 2, W / 2, -D, -D + .2], [-W / 2, -W / 2 + .2, -D, 0], [W / 2 - .2, W / 2, -D, 0]]
def room_cols(W, D, door): return shell_cols(W, D) + [[-W / 2, -door / 2, -.22, 0], [door / 2, W / 2, -.22, 0]]
LCOL = {
    'ai_cafe': shell_cols(12, 6) + [[-5.05, 3.05, -2.65, -1.85]] + [[tx - 1.05, tx + 1.05, tz - .45, tz + .45] for tx, tz in ((-4.0, 1.4), (-1.2, 1.6), (1.6, 1.4), (4.2, 1.6))],
    'ai_duty': shell_cols(16, 7) + [[gx - .45, gx + .45, -4.6, -1.4] for gx in (-5.0, -1.7, 1.7, 5.0)] + [[4.75, 7.45, -1.15, -.45], [-7.8, 7.8, -6.8, -6.45]],
    'ai_news': shell_cols(8, 5) + [[gx - .8, gx + .8, -2.8, -1.6] for gx in (-2.0, 1.0)] + [[1.75, 3.55, -1.05, -.35], [-3.8, 3.8, -4.8, -4.5]],
    'ai_wc': shell_cols(9, 6) + [[-4.3, -1.5, -.2, 0], [1.5, 4.3, -.2, 0], [-.4, .4, -.2, 0], [-1.6, 1.6, -2.2, -2.0]],
    'ai_lounge': room_cols(11, 7, 2.4) + [[-1.55, 1.55, -2.05, -1.35]] + [[x - 1.0, x + 1.0, z - .45, z + 1.45] for x, z in ((-3.4, -3.6), (3.4, -3.6), (-3.4, -5.6), (3.4, -5.6))],
    'ai_prayer': room_cols(6, 5, 1.6), 'ai_shower': room_cols(7, 6, 1.6) + [[-1.65, 1.65, -1.65, -1.05]],
    'ai_xray': [[-6.2, 7.0, -1.17, .07], [-7.0, 7.0, -1.67, -1.17],   # 隔板到機身之間 0.4 m 的縫一起擋（人的半徑 0.32，夾在兩個盒中間會被推過去）
                [-1.0, -.7, .38, .52], [-1.0, -.7, 1.38, 1.52], [-2.42, -1.88, .98, 1.52], [6.9, 7.0, 1.55, 1.65]],
    'ai_immig': [[-1.25, 1.25, z - .8, z + .8] for z in (-4.5, -1.5, 1.5, 4.5)] + [[sx - .05, sx + .05, z + .78, z + .88] for z in (-4.5, -1.5, 1.5, 4.5) for sx in (-1.6, -2.6)] + [[-.2, .2, -6.3, -6.1], [-.2, .2, 6.1, 6.3]],
    'ai_egate': [[-1.6, 1.0, (i - 1.5) * 1.5 - .14, (i - 1.5) * 1.5 + .14] for i in range(4)] + [[.9, 1.3, (i - 1) * 1.5 - .3, (i - 1) * 1.5 + .3] for i in range(3)] + [[-1.8, -1.7, (i - 1) * 1.5 - .05, (i - 1) * 1.5 + .05] for i in range(3)] + [[-.05, .05, -2.5, -2.4], [-.05, .05, 2.4, 2.5]],
    'ai_customs': [[x - .1, x + .1, -.1, .1] for x in (-5.0, 0.0, 5.0)] + [[2.0, 4.6, 1.5 + k * 2.4 - .55, 1.5 + k * 2.4 + .55] for k in range(2)] + [[1.0, 2.2, 6.0, 7.2]],
    'ai_stan': [],   # 排隊的伸縮帶欄柱：整片外框會把報到島與安檢的入口堵死，不擋
    'ai_bscan': [[-.75, .75, .5, .92], [-.75, .75, -.92, -.5], [-.1, .1, -1.15, -.95]],
}

# ════════ 擺放（家具的名稱、x、y、z、ry），一樓 y = F0、二樓 y = F1 ════════
PLACE = []
def put(n, x, y, z, ry=0.0, lv=None, cbox=True): PLACE.append([n, round(x, 3), round(y, 3), round(z, 3), round(ry, 4), 0 if y < 2 else 1, 1 if cbox else 0])
E, W_, N, S_ = math.pi / 2, -math.pi / 2, math.pi, 0.0   # 正面朝 +x、−x、−z、+z

def layout():
    # 一樓陸側：報到島四座（沿 z，z −36..−6）、排隊柵欄、自助報到機、自助行李託運、看板、服務台、推車、盆栽、租車
    for k, x in enumerate((40.0, 22.0, 4.0, -14.0)):
        put('ai_island', x, F0, -21.0)
        for sz, z in ((1, -21.0 + 14.2), (-1, -21.0 - 14.2)): put('ai_isl_' + 'ABCD'[k], x, F0, z, 0.0 if sz > 0 else N, cbox=False)
        for sx in (-1, 1): put('ai_stan', x + sx * 7.2, F0, -27.0, E)
    for x in (31.0, 13.0, -5.0): put('ai_kiosk', x, F0, -41.6, S_)
    put('ai_sbd', 56.0, F0, -41.0, S_)
    for z, ry in ((-30.0, E), (-12.0, E)): put('ai_fids', 60.0, F0, z, ry)
    put('ai_fids', -18.0, F0, 3.0, E)
    put('ai_info', 70.0, F0, -22.0)
    for z in (-12.0, 12.0): put('ai_trolley', 73.5, F0, z, 0.0)
    for x, z in ((74.5, -41.5), (74.5, 41.5), (49.5, -41.5), (-30.0, -41.5)): put('ai_plant%d' % (1 + int(abs(x + z)) % 3), x, F0, z)
    put('ai_rental', MX1 - 2.3 + 1.75, F0, 31.0, E)
    put('ai_seat4x2', 70.5, F0, 2.0, E); put('ai_seat4x2', 70.5, F0, 22.0, E)
    for x in (-4.0, 12.0): put('ai_seat5', x, F0, 2.0, N)
    for x in (52.0, 22.0, 6.0): put('ai_bins', x, F0, 8.5, N)
    put('ai_pylon_in', 66.0, F0, 3.0, E); put('ai_pylon_sec', -9.0, F0, -1.0, E)
    # 一樓：後勤牆上的店（背貼 z 18，面朝北）；入境出口在 x 34
    put('ai_cafe', 52.0, F0, BOH, N); put('ai_news', 18.0, F0, BOH, N); put('ai_wc', 2.0, F0, BOH, N)
    # 安檢：六條通道（沿 x，中心 x −27），第 2、5 條加全身掃描儀；排隊柵欄在東邊
    for k in range(6):
        z = -32.3 + 3.4 * k; put('ai_xray', SEC_X, F0, z, 0.0, cbox=False); put('ai_lane%d' % (k + 1), SEC_X, F0, z, 0.0, cbox=False)
        if k in (1, 4): put('ai_bscan', SEC_X - 3.4, F0, z + .85, 0.0, cbox=False)
    for z in (-30.0, -18.0): put('ai_stan', -15.0, F0, z, E)
    # 一樓空側（安檢後）：出境證照查驗（人工四亭＋e-Gate 三道）、便利店、廁所、座椅、往二樓的導引
    put('ai_immig', -39.0, F0, -24.0, 0.0, cbox=False); put('ai_egate', -39.0, F0, -36.5, 0.0, cbox=False)
    put('ai_news', -44.0, F0, BOH, N); put('ai_wc', -71.0, F0, -20.0, E)
    for z in (-36.0, -30.0): put('ai_seat5x2', -60.0, F0, z, E)
    put('ai_pylon_up', -50.0, F0, -4.0, E); put('ai_plant2', -34.0, F0, -41.5)
    # 一樓入境大廳（夾層底下 z 18..44、x −27..63.7）：電扶梯下來 → 入境查驗 → 檢疫 → 行李轉盤 → 海關 → 出口（x 34）
    put('ai_immig', -10.0, F0, 33.0, N, cbox=False); put('ai_egate', -10.0, F0, 23.5, N, cbox=False)
    put('ai_quar', -1.0, F0, 20.2, S_)
    put('ai_carousel', 8.0, F0, 31.0, 0.0); put('ai_carousel', 33.0, F0, 36.0, 0.0)
    put('ai_customs', 34.0, F0, 21.0, 0.0, cbox=False)
    put('ai_bagsvc', 54.0, F0, 42.2, N)
    for x, z in ((20.0, 22.0), (48.0, 26.0)): put('ai_trolley', x, F0, z, 0.0)
    put('ai_seat5', 52.0, F0, 33.0, N)
    # 二樓：三座登機門（門、櫃台、門號）、座椅、商店、貴賓室、祈禱室、淋浴間、轉機櫃台、廁所
    for gi, g in enumerate(GATES):
        put('ai_door', g, F1, IZ - .3, N); put('ai_gate', g + 5.0, F1, 40.0, N); put('ai_gno_A%d' % (gi + 1), g + 5.0, F1, 40.0, N, cbox=False)
        for z in (19.5, 23.5, 27.5, 31.5):
            for dx in (-9.0, -3.0, 3.0, 9.0):
                x = g + dx
                if x > MX1 - 4.5 or x < MX0 + 3: continue
                put('ai_seat4x2', x, F1, z, 0.0)
    put('ai_cafe', -30.0, F1, 18.0, S_); put('ai_duty', 26.0, F1, 19.0, S_); put('ai_wc', -14.0, F1, 18.0, S_); put('ai_news', 42.0, F1, 17.0, S_)
    put('ai_lounge', -71.0, F1, 19.0, S_); put('ai_prayer', 2.0, F1, 17.0, S_); put('ai_shower', 9.0, F1, 18.0, S_); put('ai_transfer', -6.0, F1, 15.0, S_)
    for x in (-44.0, 14.0, 38.0): put('ai_pylon_gates', x, F1, 36.0, N)
    for x in (-72.0, -20.0, 34.0, 62.0): put('ai_plant%d' % (1 + int(abs(x)) % 3), x, F1, 42.6)
    for x in (-36.0, 18.0, 50.0): put('ai_bins', x, F1, 40.5, N)
    # 燈（局部座標）：一樓大廳、夾層下（含入境大廳）、夾層上
    for x in (66.0, 46.0, 26.0, 6.0, -14.0, -40.0, -62.0): LIGHTS.append([x, 9.0, -14.0, 30, 2.4])
    for x in (60.0, 34.0, 8.0, -20.0, -52.0): LIGHTS.append([x, 3.7, 13.0, 12, 1.4])
    for x in (-12.0, 8.0, 30.0, 52.0): LIGHTS.append([x, 3.7, 31.0, 14, 1.4])
    for x in (-58.0, -30.0, 0.0, 28.0, 58.0): LIGHTS.append([x, 9.5, 28.0, 26, 2.2])


# ════════ 第二航廈 T2（airbld.py 的 term2：320 × 60 m，北面 z −30 是空側、四座空橋 B1–B4；南面 z +30 是陸側玻璃與入口門斗）════════
# 同一套家具重新擺：陸側大廳（一樓 x > −40、z −8..30）報到島、自助機、看板；安檢線 x −40；一樓空側（x < −40）證照查驗、商店、上二樓的電扶梯與樓梯；
# 北側夾層 4.4 m（z −29.7..−8）登機門、座椅、商店；夾層底下 x > −40 是入境大廳（夾層開洞的電扶梯下來 → 證照 → 轉盤 → 海關 → 後勤牆上的出口 x 140），x < −40 是後勤（不開放）。
T2_IX, T2_IZ = 159.8, 29.7
T2_MZ0, T2_MZ1 = -T2_IZ, -8.0                   # 夾層的 z 範圍
T2_SEC = -40.0                                  # 安檢線
T2_HX0, T2_HX1, T2_HZ0, T2_HZ1 = 4.0, 10.6, -19.6, -15.8   # 夾層開洞（入境電扶梯，往 +x 升：底 x 4、頂 x 10.6）
T2_DOORS_OPEN = (-20.0, 20.0, 60.0, 100.0, 140.0)           # 打開的入口門斗（x −60 以西三座在空側，照舊關著）
T2_EXIT = 140.0                                 # 入境出口（後勤牆 z −8 上）
T2_GATES = (-105.0, -35.0, 35.0, 105.0)
def t2_under(z): return 17.0 - .08 * z
def t2_slabs():
    return [(-T2_IX, T2_HX0, T2_MZ0, T2_MZ1), (T2_HX1, T2_IX, T2_MZ0, T2_MZ1), (T2_HX0, T2_HX1, T2_MZ0, T2_HZ0), (T2_HX0, T2_HX1, T2_HZ1, T2_MZ1)]


def t2_arch():
    b = GB(90); t = X(b); IXa, IZa = T2_IX, T2_IZ
    # 地坪、牆腳、兩端的灰泥內牆（外殼的端牆在 ±160）
    t.box(-IXa, IXa, F0 - .05, F0, -IZa, IZa, M['floor'])
    for z in (-3.0, 27.0): t.box(-IXa + .5, IXa - .5, F0, F0 + .002, z - .15, z + .15, M['floor2'])
    WALK['flat'].append([-IXa, IXa, -IZa, IZa, F0])
    for s_ in (-1, 1):
        x = s_ * IXa; t.box(min(x, x + s_ * .2), max(x, x + s_ * .2), F0, t2_under(-IZa) - .2, -IZa, IZa, M['plaster']); col(min(x, x + s_ * .2), max(x, x + s_ * .2), -IZa, IZa)
    # 夾層：樓板、崁燈、邊緣封板、欄杆（洞的三邊與夾層南緣，樓梯口斷開）
    for x0, x1, z0, z1 in t2_slabs():
        t.box(x0, x1, F1 - SLAB, F1 - .03, z0, z1, M['ceil']); t.box(x0, x1, F1 - .03, F1, z0, z1, M['floor'])
        WALK['flat'].append([x0, x1, z0, z1, F1]); WALK['ceil'].append([x0, x1, z0, z1, F1 - SLAB, 3.0])
    t.box(-IXa, IXa, F1 - SLAB - .1, F1 + .02, T2_MZ1, T2_MZ1 + .06, M['white'])
    for x0, x1, z0, z1 in ((T2_HX0, T2_HX1, T2_HZ0, T2_HZ0 + .06), (T2_HX0, T2_HX1, T2_HZ1 - .06, T2_HZ1)): t.box(x0, x1, F1 - SLAB - .1, F1 + .02, z0, z1, M['white'])
    t.box(T2_HX0, T2_HX0 + .06, F1 - SLAB - .1, F1 + .02, T2_HZ0, T2_HZ1, M['white'])
    for x in range(int(-IXa) + 3, int(IXa), 3):
        for z in range(int(T2_MZ0) + 2, int(T2_MZ1), 3):
            if not (T2_HX0 - .3 < x < T2_HX1 + .3 and T2_HZ0 - .3 < z < T2_HZ1 + .3): t.cyl(x, z, F1 - SLAB - .012, F1 - SLAB, .1, 10, M['led'])
    # 入境電扶梯（夾層 → 一樓入境大廳，往 +x 升）與洞的欄杆
    for zc, up in ((-18.5, 0), (-16.9, 1)): esc_unit(b, T2_HX0, zc, math.pi / 2, up, T2_HX1 - T2_HX0, F1 - F0)
    rail(t, [(T2_HX0, T2_HZ0 + .05), (T2_HX1, T2_HZ0 + .05)], F1); rail(t, [(T2_HX0, T2_HZ1 - .05), (T2_HX1, T2_HZ1 - .05)], F1); rail(t, [(T2_HX0 + .05, T2_HZ0), (T2_HX0 + .05, T2_HZ1)], F1)
    for z0, z1 in ((T2_HZ0, -19.12), (-17.88, -17.52), (-16.28, T2_HZ1)): rail(t, [(T2_HX1 - .05, z0), (T2_HX1 - .05, z1)], F1)
    # 一樓空側往二樓：兩座電扶梯＋一道樓梯，往北升（底 z −0.2、頂 z −6.8），頂端平台到夾層邊 z −8
    z_a, z_b = -.2, -6.8; L = z_a - z_b; rise = F1 - F0; ang = math.atan2(rise, L)
    for ex, up in ((-76.6, 1), (-74.2, 0)): esc_unit(b, ex, z_a, math.pi, up, L, rise)
    sx0, sx1 = -71.0, -68.0; n = 22
    for k in range(n):
        z0 = z_a - k * L / n; y0 = F0 + rise * (k + 1) / n
        t.box(sx0, sx1, y0 - .06, y0, z0 - L / n - .02, z0, M['trav']); t.box(sx0, sx1, y0 - rise / n, y0 - .06, z0 - .03, z0, M['trav'])
    for x in (sx0 - .08, sx1 + .08):
        t.obb((x, (F0 + F1) / 2 - .15, (z_a + z_b) / 2), (.06, 0, 0), (0, rise / 2, -L / 2), (0, .3 * math.cos(ang), .3 * math.sin(ang)), M['steel'])
        for k in range(8):
            z = z_a - k * L / 7; y = F0 + rise * k / 7
            t.box(x - .015, x + .015, y, y + 1.0, z - .015, z + .015, M['steel'])
        t.tube((x, F0 + 1.0, z_a), (x, F1 + 1.0, z_b), .025, M['walnut'], 8)
        col(x - .1, x + .1, z_b, z_a + .2)
    WALK['ramp'].append([sx0, sx1, z_b, z_a, F1, F0, 'z']); under_block(X(b, 0, 0, z_a, math.pi), -(sx1 + .1), -(sx0 - .1), L, rise)
    WALK['flat'].append([-77.3, -68.0, T2_MZ1, z_b, F1])
    t.box(-77.3, -68.0, F1 - SLAB, F1, T2_MZ1, z_b, M['ceil']); t.box(-77.3, -68.0, F1 - .03, F1, T2_MZ1, z_b, M['floor'])
    WALK['ceil'].append([-77.3, -68.0, T2_MZ1, z_b, F1 - SLAB, 3.0])
    for x0, x1 in ((-75.98, -74.82), (-73.58, -71.0)): rail(t, [(x0, z_b - .05), (x1, z_b - .05)], F1)
    t.box(-78.0, -77.3, F0, F1 - SLAB, T2_MZ1, z_a - 2.0, M['plaster']); col(-78.0, -77.3, T2_MZ1, z_a - 2.0, 0)
    t.box(-67.8, -67.1, F0, F1 - SLAB, T2_MZ1, z_a - 2.0, M['plaster']); col(-67.8, -67.1, T2_MZ1, z_a - 2.0, 0)
    rail(t, [(-IXa + .3, T2_MZ1 - .05), (-78.0, T2_MZ1 - .05)], F1); rail(t, [(-67.1, T2_MZ1 - .05), (IXa - .3, T2_MZ1 - .05)], F1)
    rail(t, [(-78.0, z_b), (-78.0, T2_MZ1)], F1); rail(t, [(-67.1, z_b), (-67.1, T2_MZ1)], F1)
    # 夾層底下的柱（邊緣一排、裡面一排）
    for x in range(-156, 157, 24):
        for z in (T2_MZ1 - .8, -20.0):
            if T2_HX0 - 1 < x < T2_HX1 + 1 and z < -15: continue
            t.cyl(x, z, F0, F1 - SLAB, .38, 20, M['white']); t.cyl(x, z, F0, F0 + .1, .42, 20, M['steel']); col(x - .4, x + .4, z - .4, z + .4, 0)
    # 後勤牆（一樓 z −8，夾層邊底下）：入境出口 x 140 開 10.8 m（海關兩條通道）；x −40 一道往北到北牆（以西是後勤）
    bz = T2_MZ1
    EW = 5.4   # 出口半寬：對齊海關的紅綠兩條通道（x ±5）
    for x0, x1 in ((-IXa, T2_EXIT - EW), (T2_EXIT + EW, IXa)): t.box(x0, x1, F0, F1 - SLAB, bz - .3, bz, M['plaster']); col(x0, x1, bz - .3, bz, 0)
    t.box(T2_EXIT - EW, T2_EXIT + EW, F0 + 2.8, F1 - SLAB, bz - .3, bz, M['plaster'])
    for x0, x1 in ((-IXa, T2_EXIT - EW), (T2_EXIT + EW, IXa)): t.box(x0, x1, F0 + .9, F0 + 1.0, bz, bz + .02, M['walnut'])
    t.box(T2_SEC - .3, T2_SEC, F0, F1 - SLAB, T2_MZ0, bz, M['plaster']); col(T2_SEC - .3, T2_SEC, T2_MZ0, bz, 0)
    for x in (-120.0, -20.0, 70.0):
        t.box(x - .6, x + .6, F0, F0 + 2.3, bz, bz + .04, M['grey']); t.box(x - .7, x + .7, F0 + 2.3, F0 + 2.4, bz, bz + .05, M['dark'])
        t.box(x - .3, x + .3, F0 + 2.5, F0 + 2.7, bz + .05, bz + .06, M['wsg']); t.text('STAFF ONLY', .1, (x, F0 + 2.6, bz + .061), (1, 0, 0), (0, 0, 1), M['ink'], .003)
    ax = T2_EXIT
    for sx in (-1, 1): t.box(ax + sx * EW - .08, ax + sx * EW + .08, F0, F0 + 2.8, bz - .35, bz + .05, M['steel'])
    t.box(ax - EW - .08, ax + EW + .08, F0 + 2.72, F0 + 2.8, bz - .35, bz + .05, M['steel'])
    t.box(ax - 2.4, ax + 2.4, F0 + 2.85, F0 + 3.3, bz, bz + .12, M['ysg']); t.text('ARRIVALS', .3, (ax, F0 + 3.07, bz + .121), (1, 0, 0), (0, 0, 1), M['ink'], .01)
    t.box(ax - 1.6, ax + 1.6, F0 + 2.85, F0 + 3.3, bz - .42, bz - .3, M['gtx']); t.text('EXIT', .3, (ax, F0 + 3.07, bz - .421), (-1, 0, 0), (0, 0, -1), M['ink'], .01)
    # 安檢線（x −40，一樓 z −8..30）：中間是六條安檢通道
    for z0, z1 in ((bz, -1.2), (19.1, IZa)):
        t.box(T2_SEC - .15, T2_SEC + .15, F0, F0 + 3.0, z0, z1, M['plaster']); t.box(T2_SEC - .16, T2_SEC + .16, F0 + 3.0, F0 + 3.08, z0, z1, M['steel']); col(T2_SEC - .15, T2_SEC + .15, z0, z1, 0)
    t.box(T2_SEC - .4, T2_SEC + .4, F0 + 3.08, F0 + 3.6, 6.8, 11.2, M['dark']); t.box(T2_SEC + .4, T2_SEC + .41, F0 + 3.13, F0 + 3.55, 6.9, 11.1, M['ysg'])
    t.text('SECURITY', .28, (T2_SEC + .412, F0 + 3.34, 9.0), (0, 0, -1), (1, 0, 0), M['ink'], .01)
    # 北面：夾層上的窗台（空橋門那段斷開）；一樓是外殼的深色板牆
    xs = [-IXa] + [v for g in T2_GATES for v in (g - 1.8, g + 1.8)] + [IXa]
    for a, c in zip(xs[0::2], xs[1::2]):
        t.box(a, c, F1, F1 + 1.0, -IZa, -IZa + .35, M['plaster']); t.box(a, c, F1 + 1.0, F1 + 1.05, -IZa, -IZa + .45, M['trav']); col(a, c, -IZa, -IZa + .45, 1)
    # 入境大廳（x −40 以東、夾層底下）的北牆內襯：灰泥＋胡桃木腰帶，轉盤後面一道歡迎字
    t.box(T2_SEC, IXa, F0, F1 - SLAB, -IZa, -IZa + .15, M['plaster']); col(T2_SEC, IXa, -IZa, -IZa + .15, 0)
    t.box(T2_SEC, IXa, F0, F0 + .12, -IZa + .15, -IZa + .18, M['steel']); t.box(T2_SEC, IXa, F0 + .9, F0 + 1.05, -IZa + .15, -IZa + .19, M['walnut'])
    t.box(52.0, 92.0, F0 + 2.2, F0 + 2.25, -IZa + .15, -IZa + .2, M['walnut'])
    t.text('WELCOME TO GREY HERON CAPE', .55, (72.0, F0 + 2.75, -IZa + .2), (1, 0, 0), (0, 0, 1), M['ink'], .01)
    # 南面入口門斗裡的坡（0.6 → 人行道 0.15），門口的不鏽鋼門檻
    for dx in T2_DOORS_OPEN:
        t.poly([(dx - 1.6, F0, IZa), (dx + 1.6, F0, IZa), (dx + 1.6, .15, IZa + 3.5), (dx - 1.6, .15, IZa + 3.5)], M['trav'])
        t.box(dx - 1.6, dx + 1.6, F0 - .02, F0, IZa - .3, IZa, M['steel'])
        WALK['ramp'].append([dx - 1.6, dx + 1.6, IZa, IZa + 3.5, F0, .15, 'z'])
    WALK['roof'] = {'k': 'lin', 'a': 17.0, 'b': -.08}
    return b.build('air_t2i')


def t2_layout():
    IZa = T2_IZ
    # 陸側大廳（x −40..160、z −8..30）：三座報到島（沿 z，中心 z 11）、柵欄、自助機與托運（背貼後勤牆）、看板、服務台、店、推車
    for k, x in enumerate((40.0, 80.0, 120.0)):
        put('ai_island', x, F0, 11.0)
        for sz, z in ((1, 11.0 + 14.2), (-1, 11.0 - 14.2)): put('ai_isl_' + 'ABC'[k], x, F0, z, 0.0 if sz > 0 else N, cbox=False)
        for sx in (-1, 1): put('ai_stan', x + sx * 7.2, F0, 5.0, E)
    for x in (30.0, 50.0, 90.0): put('ai_kiosk', x, F0, -5.2, S_)
    put('ai_sbd', 70.0, F0, -4.6, S_)
    for x, z in ((-8.0, 12.0), (150.0, 12.0)): put('ai_fids', x, F0, z, E)
    put('ai_info', 0.0, F0, 22.0)
    put('ai_cafe', 152.0, F0, T2_MZ1 + 6.3, S_); put('ai_news', 10.0, F0, T2_MZ1 + 5.3, S_); put('ai_wc', -12.0, F0, T2_MZ1 + 6.3, S_)
    for x in (20.0, 100.0): put('ai_trolley', x + 7.0, F0, 26.0, 0.0)
    put('ai_rental', T2_IX - 1.75, F0, 18.0, W_)
    for z in (0.0, 22.0): put('ai_seat4x2', 147.0, F0, z, E)
    for x in (58.0, 98.0, 136.0): put('ai_bins', x, F0, 27.5, 0.0)
    for x, z in ((-36.0, 27.5), (158.0, 27.5), (2.0, -6.0)): put('ai_plant%d' % (1 + int(abs(x + z)) % 3), x, F0, z)
    put('ai_pylon2_in', 10.0, F0, 26.0, 0.0); put('ai_pylon2_sec', -24.0, F0, 22.0, E)
    # 安檢：六條通道（中心 x −40，z 0.5..17.5），第 2、5 條加全身掃描儀；排隊柵欄在東邊
    for k in range(6):
        z = .5 + 3.4 * k; put('ai_xray', T2_SEC, F0, z, 0.0, cbox=False); put('ai_lane%d' % (k + 1), T2_SEC, F0, z, 0.0, cbox=False)
        if k in (1, 4): put('ai_bscan', T2_SEC - 3.4, F0, z + .85, 0.0, cbox=False)
    for z in (3.0, 15.0): put('ai_stan', -28.0, F0, z, E)
    # 一樓空側（x −160..−40）：出境證照查驗、商店（背貼後勤牆）、座椅、廁所、往二樓的導引
    put('ai_immig', -54.0, F0, 9.0, 0.0, cbox=False); put('ai_egate', -54.0, F0, 22.0, 0.0, cbox=False)
    put('ai_duty', -110.0, F0, T2_MZ1 + 7.3, S_); put('ai_cafe', -135.0, F0, T2_MZ1 + 6.3, S_); put('ai_news', -92.0, F0, T2_MZ1 + 5.3, S_); put('ai_wc', -150.0, F0, T2_MZ1 + 6.3, S_)
    for x in (-128.0, -118.0, -102.0, -92.0): put('ai_seat5x2', x, F0, 18.0, 0.0)
    put('ai_pylon2_up', -62.0, F0, 6.0, E); put('ai_plant1', -150.0, F0, 27.5); put('ai_plant3', -66.0, F0, 27.5)
    put('ai_bins', -84.0, F0, 27.5, 0.0)
    # 入境大廳（夾層底下 x −40..160）：電扶梯下來 → 證照查驗 → 檢疫 → 三座轉盤 → 海關 → 出口（x 140）
    put('ai_immig', 16.0, F0, -19.0, N, cbox=False); put('ai_egate', 16.0, F0, -11.5, N, cbox=False)
    put('ai_quar', 28.0, F0, T2_MZ1 - 2.2, N)
    for x in (48.0, 72.0, 96.0): put('ai_carousel', x, F0, -20.0, 0.0)   # 在夾層下兩排柱（24 m 一支）的中間
    put('ai_customs', T2_EXIT, F0, T2_MZ1 - 1.0, N, cbox=False)
    put('ai_bagsvc', 95.0, F0, -IZa + 1.9, S_)
    for x in (65.0, 125.0): put('ai_trolley', x, F0, -11.0, 0.0)
    put('ai_seat5', 154.0, F0, -20.0, W_)
    # 夾層（z −29.7..−8）：四座登機門、座椅、商店與貴賓室（背貼北窗）
    for gi, g in enumerate(T2_GATES):
        put('ai_door', g, F1, -IZa + .3, S_); put('ai_gate', g + 5.0, F1, -26.0, S_); put('ai_gno_B%d' % (gi + 1), g + 5.0, F1, -26.0, S_, cbox=False)
        for z in (-21.0, -17.0, -13.0):
            for dx in (-12.0, -6.0, 0.0, 6.0, 12.0):
                x = g + dx
                if T2_HX0 - 3 < x < T2_HX1 + 3 and z < -14: continue
                put('ai_seat4x2', x, F1, z, 0.0)
    put('ai_cafe', -70.0, F1, -IZa + 6.3, S_); put('ai_duty', 0.0, F1, -IZa + 7.3, S_); put('ai_news', 70.0, F1, -IZa + 5.3, S_)
    put('ai_wc', -140.0, F1, -IZa + 6.3, S_); put('ai_wc', 146.0, F1, -IZa + 6.3, S_)
    put('ai_lounge', -125.0, F1, -IZa + 7.3, S_); put('ai_prayer', 125.0, F1, -IZa + 5.3, S_); put('ai_shower', 133.0, F1, -IZa + 6.3, S_); put('ai_transfer', -20.0, F1, -11.0, S_)
    for k, x in enumerate((-70.0, 0.0, 70.0)): put('ai_pylon2_g%d' % (k + 1), x, F1, -12.0, S_)
    for x in (-150.0, -50.0, 50.0, 150.0): put('ai_plant%d' % (1 + int(abs(x)) % 3), x, F1, -9.6)
    for x in (-88.0, -52.0, 18.0, 52.0, 88.0): put('ai_bins', x, F1, -9.6, S_)
    # 燈（局部座標）：陸側大廳挑高處、一樓空側、夾層上、入境大廳（夾層下）
    for x in range(-150, 151, 25): LIGHTS.append([float(x), 10.0, 12.0, 28, 2.4])
    for x in range(-145, 151, 30): LIGHTS.append([float(x), 9.0, -19.0, 24, 2.0])
    for x in range(-30, 151, 30): LIGHTS.append([float(x), 3.7, -18.0, 14, 1.4])


# ════════ 建、烘、匯出 ════════
FURN = [
    (lambda: seats('ai_seat4x2', 4, True), .9), (lambda: seats('ai_seat5', 5, False), .9), (lambda: seats('ai_seat5x2', 5, True), .9),
    (lambda: island('ai_island'), 1.5), (lambda: xray('ai_xray'), 1.2), (lambda: fids('ai_fids'), 1.2), (lambda: gate_desk('ai_gate'), 1.0),
    (lambda: board_door('ai_door'), 1.0), (lambda: stanchions('ai_stan'), .6), (lambda: shop_cafe('ai_cafe'), 1.5), (lambda: shop_duty('ai_duty'), 1.5),
    (lambda: shop_news('ai_news'), 1.5), (lambda: wc('ai_wc'), 1.5), (lambda: info_desk('ai_info'), 1.0), (lambda: trolleys('ai_trolley'), .6),
    (lambda: planter('ai_plant1', 1), .8), (lambda: planter('ai_plant2', 2), .8), (lambda: planter('ai_plant3', 3), .8), (lambda: bins('ai_bins'), .6),
    (lambda: pylon('ai_pylon_in', ['<CHECK-IN A-D', '<SECURITY', '>ARRIVALS']), .8), (lambda: pylon('ai_pylon_sec', ['^SECURITY', '^GATES A1-A3']), .8),
    (lambda: pylon('ai_pylon_up', ['^GATES A1-A3', '^TOILETS']), .8), (lambda: pylon('ai_pylon_gates', ['<GATE A1', '>GATES A2-A3']), .8),
    (lambda: rental('ai_rental'), 1.0), (lambda: kiosk('ai_kiosk'), .8), (lambda: sbd('ai_sbd'), 1.0), (lambda: immig('ai_immig'), 1.2), (lambda: egate('ai_egate'), 1.0),
    (lambda: bscan('ai_bscan'), .8), (lambda: quar('ai_quar'), 1.0), (lambda: customs('ai_customs'), 1.2), (lambda: carousel('ai_carousel'), 1.2), (lambda: bagsvc('ai_bagsvc'), 1.2),
    (lambda: lounge('ai_lounge'), 1.5), (lambda: prayer('ai_prayer'), 1.2), (lambda: shower('ai_shower'), 1.2), (lambda: transfer('ai_transfer'), 1.0),
] + [((lambda ch=ch: isl_letter('ai_isl_' + ch, ch)), .3) for ch in 'ABCD'] + [((lambda k=k: lane_no('ai_lane%d' % k, k)), .3) for k in range(1, 7)] \
  + [((lambda k=k: gate_no('ai_gno_A%d' % k, 'A%d' % k)), .3) for k in range(1, 4)] \
  + [((lambda k=k: gate_no('ai_gno_B%d' % k, 'B%d' % k)), .3) for k in range(1, 5)] \
  + [(lambda: pylon('ai_pylon2_in', ['>CHECK-IN A-C', '<SECURITY', '>ARRIVALS']), .8), (lambda: pylon('ai_pylon2_sec', ['^SECURITY', '^GATES B1-B4']), .8),
     (lambda: pylon('ai_pylon2_up', ['^GATES B1-B4', '^TOILETS']), .8), (lambda: pylon('ai_pylon2_g1', ['<GATE B1', '>GATES B2-B4']), .8),
     (lambda: pylon('ai_pylon2_g2', ['<GATES B1-B2', '>GATES B3-B4']), .8), (lambda: pylon('ai_pylon2_g3', ['<GATES B1-B3', '>GATE B4']), .8)]

only = os.environ.get('ONLY', '').split(',') if os.environ.get('ONLY') else None
built = []
o = arch(); o.location = (0, 0, 0); finish(o, 3.0, gr_h=F0 + .6); built.append((o, 200, 2.0))
o = ceiling(); o.location = (0, 0, 0); finish(o, 99.0, gr_h=-1.0); built.append((o, 200, .5))
T1D = (COL, WALK, LIGHTS)   # 建築的碰撞、步行面寫進各自的表（col()、WALK 都是看全域的名字）
COL, WALK, LIGHTS = [], {'flat': [], 'ramp': [], 'ceil': []}, []
o = t2_arch(); o.location = (0, 0, 0); finish(o, 3.0, gr_h=F0 + .6); built.append((o, 400, 2.0))
T2D = (COL, WALK, LIGHTS)
for i, (f, d) in enumerate(FURN):
    o = f(); o.location = (300 + (i % 8) * 30, (i // 8) * 30, 0); bevel(o) if not o.name.startswith(('ai_isl_', 'ai_lane', 'ai_gno')) else finish(o, 99.0, gr_h=-1.0); built.append((o, 20, d))
for o, g, d in built:
    for p_, _, _ in built: p_.hide_render = p_ is not o
    bake_ao(o, g, d, grime=False)
for o, _, _ in built: o.hide_render = False; o.location = (0, 0, 0)
# 家具的佔地框（遊戲座標 x、z：Blender 的 x、−y）：沒有 LCOL 的家具照它擋，遊戲端不用等模型解出來就能放碰撞
BBOX = {}
for o in [q for q, _, _ in built if q.name.startswith('ai_')]:
    xs = [v.co.x for v in o.data.vertices]; ys = [v.co.y for v in o.data.vertices]
    BBOX[o.name] = [round(min(xs), 3), round(max(xs), 3), round(-max(ys), 3), round(-min(ys), 3)]
export_glb('airint.glb', export_vertex_color='ACTIVE')

# 各航廈：建築的碰撞 col、步行面 walk、燈 lights、家具 place、室內半寬 hx／hz、門口只擋車的盒 swim（都是航廈中心起算的 SEA_FR）
COL, WALK, LIGHTS = T1D; PLACE = []; layout()
t1 = {'col': COL, 'walk': WALK, 'lights': LIGHTS, 'place': PLACE, 'hx': IX, 'hz': IZ, 'swim': [[IX - .2, IX + 1.2, -2.7, 2.7]]}
COL, WALK, LIGHTS = T2D; PLACE = []; t2_layout()
t2 = {'col': COL, 'walk': WALK, 'lights': LIGHTS, 'place': PLACE, 'hx': T2_IX, 'hz': T2_IZ, 'swim': [[dx - 1.7, dx + 1.7, T2_IZ - .2, T2_IZ + 3.6] for dx in T2_DOORS_OPEN]}
data = {'t1': t1, 't2': t2, 'lcol': LCOL, 'bbox': BBOX, 'F0': F0, 'F1': F1}
out = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'src', 'parts', '52-air-int-data.js')
with open(out, 'w') as f:
    f.write('// 自動產生（blender/airint.py）：第一、第二航廈（T1、T2）室內的擺放、碰撞、步行面與燈。不要手改，改 airint.py 再跑 Blender。\n')
    f.write('const AIR_INT = ' + json.dumps(data, separators=(',', ':')) + ';\n')
print('ok  52-air-int-data.js', 'T1', len(t1['place']), 'items', len(t1['col']), 'colliders；T2', len(t2['place']), 'items', len(t2['col']), 'colliders')
