# 191 靜白之家：依擬合後的 scene_params.json 在 Blender 建出公共區（玄關、廚房、餐廳、客廳、走廊）
# 用法：/Applications/Blender.app/Contents/MacOS/Blender -b -P assets/191/build_scene.py -- [--no-bake]
# 產出：scene.glb（網頁預覽）、scene.blend（剛體、碰撞、抽屜與門的示範動畫、8 台由影片解出的相機）、objects.json（尺寸、材質、質量、碰撞體）
# 座標：Blender 世界座標 = 平面座標（x 東、y 北、z 上），glTF 匯出時轉成 three.js 的 y 朝上。
# 材質名稱就是「材質角色」，網頁依角色給粗糙度、金屬度與程序貼圖；頂點色 = 底色 × 烘焙的環境光遮蔽。
import bpy, bmesh, json, math, os, sys
import numpy as np
from mathutils import Vector, Matrix, noise

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from landmarks import load_params  # noqa: E402

ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
BAKE = '--no-bake' not in ARGS
P = load_params()
CAMS = json.load(open(os.path.join(HERE, 'cameras.json'), encoding='utf-8'))
TAU = math.pi * 2

R = P['room']
W, D, H = R['w'], R['d'], R['h']
WT = R['wall']
K, I, T, S = P['kitchen'], P['island'], P['table'], P['sofa']
TW, WIN, C, PA, SH = P['tv_wall'], P['window'], P['corridor'], P['partition'], P['shoe']
K['x1'] = min(K['x1'], W)
T['x1'] = I['x0']
DINING_Z = P['ceiling']['dining']
LIVING_Y0 = PA['y'] + PA['t']

# ── 材質角色：Blender 預覽用的底色與 PBR（網頁有自己的設定） ──
ROLES = {
    'plaster': ('#E7E1D8', 0.92, 0.0), 'cement': ('#D5CFC5', 0.85, 0.0), 'floor': ('#D3CCC1', 0.5, 0.0),
    'travertine': ('#D8CBB5', 0.7, 0.0), 'stone': ('#D9D3C9', 0.42, 0.0), 'steel': ('#C9C8C3', 0.3, 1.0),
    'lacquer': ('#ECE8E1', 0.48, 0.0), 'greige': ('#9E978F', 0.55, 0.0), 'fabric': ('#EAE4DA', 1.0, 0.0),
    'fabric_warm': ('#D8C8B2', 1.0, 0.0), 'fabric_grey': ('#A7A49E', 1.0, 0.0), 'black': ('#161617', 0.18, 0.0),
    'metal_dark': ('#3B3936', 0.4, 0.8), 'mirror': ('#DADCDC', 0.04, 1.0), 'glass': ('#E8EEF0', 0.05, 0.0),
    'shutter': ('#F2EFE9', 0.6, 0.0), 'lamp': ('#EFEBE4', 0.95, 0.0), 'glow': ('#FFF1DC', 1.0, 0.0),
    'emit': ('#FFE5C2', 1.0, 0.0), 'plant': ('#6D7C57', 0.8, 0.0), 'wood': ('#BDA587', 0.65, 0.0),
    'rug': ('#CFC6B8', 1.0, 0.0), 'ceramic': ('#ECE9E3', 0.32, 0.0), 'paper': ('#E9E4DA', 0.9, 0.0),
    'rattan': ('#A88E6C', 0.9, 0.0), 'skin': ('#D6B59C', 0.6, 0.0), 'cloth': ('#2B2A28', 0.95, 0.0),
    'denim': ('#3C5270', 0.95, 0.0),
}
EMISSIVE = {'glow': 3.0, 'emit': 6.0}


def srgb2lin(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def hexrgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))


def get_mat(role):
    m = bpy.data.materials.get(role)
    if m:
        return m
    m = bpy.data.materials.new(role)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes.get('Principled BSDF')
    base, rough, metal = ROLES[role]
    attr = nt.nodes.new('ShaderNodeVertexColor')
    attr.layer_name = 'Col'
    nt.links.new(attr.outputs['Color'], bsdf.inputs['Base Color'])
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Metallic'].default_value = metal
    if role in EMISSIVE:
        c = hexrgb(base)
        bsdf.inputs['Emission Color'].default_value = (srgb2lin(c[0]), srgb2lin(c[1]), srgb2lin(c[2]), 1)
        bsdf.inputs['Emission Strength'].default_value = EMISSIVE[role]
    if role == 'glass':
        bsdf.inputs['Transmission Weight'].default_value = 0.85
        m.surface_render_method = 'BLENDED' if hasattr(m, 'surface_render_method') else None
    m.diffuse_color = (*[srgb2lin(x) for x in hexrgb(base)], 1)
    return m


# ── 物件建構：每件物件一個 bmesh，零件直接加進去並帶材質角色與頂點色 ──
OBJS = []


class Obj:
    def __init__(self, oid, label, kind='static', group='', **meta):
        self.id, self.label, self.kind, self.group = oid, label, kind, group
        self.meta = meta
        self.bm = bmesh.new()
        self.col = self.bm.verts.layers.float_color.new('Col')
        self.roles = []
        self.boxes = []      # 靜態碰撞盒（平面座標 min/max）
        self.smooth = meta.pop('smooth', False)
        OBJS.append(self)

    def mi(self, role):
        if role not in self.roles:
            self.roles.append(role)
        return self.roles.index(role)

    def paint(self, verts, faces, role, color=None, var=0.0, seed=0.0, smooth=None):
        c = hexrgb(color or ROLES[role][0])
        idx = self.mi(role)
        for f in faces:
            f.material_index = idx
            f.smooth = self.smooth if smooth is None else smooth
        for v in verts:
            k = 1 + (noise.noise(v.co * 7 + Vector((seed, seed * 1.7, 3.1))) * var if var else 0)
            v[self.col] = (srgb2lin(min(1, c[0] * k)), srgb2lin(min(1, c[1] * k)), srgb2lin(min(1, c[2] * k)), 1.0)

    def collide(self, x0, x1, y0, y1, z0, z1):
        self.boxes.append([round(min(x0, x1), 3), round(min(y0, y1), 3), round(min(z0, z1), 3),
                           round(max(x0, x1), 3), round(max(y0, y1), 3), round(max(z0, z1), 3)])


def faces_of(verts):
    fs = set()
    for v in verts:
        fs.update(v.link_faces)
    return list(fs)


def box(o, x0, x1, y0, y1, z0, z1, role, color=None, bevel=0.0, seg=2, var=0.0, rot=0.0, collide=False, smooth=None):
    cx, cy, cz = (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2
    M = Matrix.Translation((cx, cy, cz)) @ Matrix.Rotation(rot, 4, 'Z') @ Matrix.Diagonal((abs(x1 - x0), abs(y1 - y0), abs(z1 - z0), 1))
    ret = bmesh.ops.create_cube(o.bm, size=1.0, matrix=M)
    verts = ret['verts']
    if bevel > 0:
        b = min(bevel, abs(x1 - x0) * 0.49, abs(y1 - y0) * 0.49, abs(z1 - z0) * 0.49)
        edges = list({e for v in verts for e in v.link_edges})
        res = bmesh.ops.bevel(o.bm, geom=verts + edges, offset=b, segments=seg, affect='EDGES', profile=0.5)
        verts = list(set(verts) | set(res.get('verts', [])))
        verts = [v for v in verts if v.is_valid]
    o.paint(verts, faces_of(verts), role, color, var, smooth=smooth if smooth is not None else (bevel > 0 and seg > 1))
    if collide:
        o.collide(x0, x1, y0, y1, z0, z1)
    return verts


def grid_box(o, x0, x1, y0, y1, z0, z1, role, color=None, step=0.25, var=0.0, collide=True, skip=()):
    """大面（牆、地板、天花）要細分，頂點環境光遮蔽才有漸層"""
    bm = o.bm
    made = []

    def quad(origin, u, v, nu, nv, flip):
        vs = [[bm.verts.new(origin + u * (i / nu) + v * (j / nv)) for j in range(nv + 1)] for i in range(nu + 1)]
        for i in range(nu):
            for j in range(nv):
                q = (vs[i][j], vs[i + 1][j], vs[i + 1][j + 1], vs[i][j + 1])
                bm.faces.new(q[::-1] if flip else q)
        made.extend(v for row in vs for v in row)

    dx, dy, dz = x1 - x0, y1 - y0, z1 - z0
    n = lambda L: max(1, int(math.ceil(L / step)))
    O = Vector((x0, y0, z0))
    X, Y, Z = Vector((dx, 0, 0)), Vector((0, dy, 0)), Vector((0, 0, dz))
    if '-z' not in skip:
        quad(O, X, Y, n(dx), n(dy), True)
    if '+z' not in skip:
        quad(O + Z, X, Y, n(dx), n(dy), False)
    if '-y' not in skip:
        quad(O, X, Z, n(dx), n(dz), False)
    if '+y' not in skip:
        quad(O + Y, X, Z, n(dx), n(dz), True)
    if '-x' not in skip:
        quad(O, Y, Z, n(dy), n(dz), True)
    if '+x' not in skip:
        quad(O + X, Y, Z, n(dy), n(dz), False)
    o.paint(made, faces_of(made), role, color, var, smooth=False)
    if collide:
        o.collide(x0, x1, y0, y1, z0, z1)


def lathe(o, prof, cx, cy, z0, role, color=None, seg=24, sx=1.0, sy=1.0, var=0.0, rfn=None, cap_top=True, cap_bot=True, smooth=True):
    """prof=[(半徑, 高度)…] 繞 z 軸；rfn(角度, 高度) 可讓半徑隨角度起伏（雲朵燈、編織籃）"""
    bm = o.bm
    rings = []
    for (r, h) in prof:
        ring = []
        for i in range(seg):
            a = TAU * i / seg
            rr = r * (rfn(a, h) if rfn else 1.0)
            ring.append(bm.verts.new((cx + math.cos(a) * rr * sx, cy + math.sin(a) * rr * sy, z0 + h)))
        rings.append(ring)
    fs = []
    for k in range(len(rings) - 1):
        for i in range(seg):
            j = (i + 1) % seg
            fs.append(bm.faces.new((rings[k][i], rings[k][j], rings[k + 1][j], rings[k + 1][i])))
    if cap_bot and prof[0][0] > 1e-4:
        fs.append(bm.faces.new(list(reversed(rings[0]))))
    if cap_top and prof[-1][0] > 1e-4:
        fs.append(bm.faces.new(rings[-1]))
    verts = [v for r in rings for v in r]
    o.paint(verts, fs, role, color, var, smooth=smooth)
    return verts


def cyl(o, cx, cy, z0, z1, r, role, color=None, seg=24, var=0.0, collide=False):
    v = lathe(o, [(r, 0), (r, z1 - z0)], cx, cy, z0, role, color, seg, var=var)
    if collide:
        o.collide(cx - r, cx + r, cy - r, cy + r, z0, z1)
    return v


def ell(o, cx, cy, cz, rx, ry, rz, role, color=None, seg=20, rings=12, var=0.0, rfn=None):
    prof = []
    for k in range(rings + 1):
        a = -math.pi / 2 + math.pi * k / rings
        prof.append((max(1e-4, math.cos(a)), math.sin(a)))
    bm = o.bm
    ring_vs = []
    for (r, h) in prof:
        ring = []
        for i in range(seg):
            a = TAU * i / seg
            k = rfn(a, h) if rfn else 1.0
            ring.append(bm.verts.new((cx + math.cos(a) * r * rx * k, cy + math.sin(a) * r * ry * k, cz + h * rz * k)))
        ring_vs.append(ring)
    fs = []
    for k in range(len(ring_vs) - 1):
        for i in range(seg):
            j = (i + 1) % seg
            fs.append(bm.faces.new((ring_vs[k][i], ring_vs[k][j], ring_vs[k + 1][j], ring_vs[k + 1][i])))
    verts = [v for r in ring_vs for v in r]
    bmesh.ops.remove_doubles(bm, verts=verts, dist=1e-5)
    verts = [v for v in verts if v.is_valid]
    o.paint(verts, faces_of(verts), role, color, var, smooth=True)
    return verts


def prism(o, pts, z0, z1, role, color=None, var=0.0, smooth=False):
    """平面多邊形（逆時針）擠出成柱體"""
    bm = o.bm
    bot = [bm.verts.new((x, y, z0)) for x, y in pts]
    top = [bm.verts.new((x, y, z1)) for x, y in pts]
    fs = [bm.faces.new(list(reversed(bot))), bm.faces.new(top)]
    n = len(pts)
    for i in range(n):
        j = (i + 1) % n
        fs.append(bm.faces.new((bot[i], bot[j], top[j], top[i])))
    o.paint(bot + top, fs, role, color, var, smooth=smooth)
    return bot + top


def tube(o, pts, r, role, color=None, seg=8, var=0.0):
    bm = o.bm
    P_ = [Vector(p) for p in pts]
    rr = r if isinstance(r, (list, tuple)) else [r] * len(P_)
    rings, prev = [], None
    for k, p in enumerate(P_):
        t = (P_[min(k + 1, len(P_) - 1)] - P_[max(k - 1, 0)]).normalized()
        n = (prev - t * prev.dot(t)) if prev is not None else (Vector((0, 0, 1)) - t * t.z)
        if n.length < 1e-4:
            n = Vector((1, 0, 0)) - t * t.x
        n.normalize()
        prev = n
        b = t.cross(n)
        rings.append([bm.verts.new(p + (n * math.cos(TAU * i / seg) + b * math.sin(TAU * i / seg)) * rr[k]) for i in range(seg)])
    fs = []
    for k in range(len(rings) - 1):
        for i in range(seg):
            j = (i + 1) % seg
            fs.append(bm.faces.new((rings[k][i], rings[k][j], rings[k + 1][j], rings[k + 1][i])))
    fs.append(bm.faces.new(list(reversed(rings[0]))))
    fs.append(bm.faces.new(rings[-1]))
    verts = [v for r_ in rings for v in r_]
    o.paint(verts, fs, role, color, var, smooth=True)
    return verts


def rrect_pts(x0, y0, x1, y1, r, n=6):
    r = min(r, (x1 - x0) / 2 - 1e-4, (y1 - y0) / 2 - 1e-4)
    pts = []
    for (cx, cy, a0) in ((x1 - r, y0 + r, -90), (x1 - r, y1 - r, 0), (x0 + r, y1 - r, 90), (x0 + r, y0 + r, 180)):
        for i in range(n + 1):
            a = math.radians(a0 + 90 * i / n)
            pts.append((cx + math.cos(a) * r, cy + math.sin(a) * r))
    return pts


def stadium_pts(x0, y0, x1, y1, n=12):
    """長圓（橢圓端）桌面"""
    r = (y1 - y0) / 2
    cy = (y0 + y1) / 2
    pts = []
    for i in range(n + 1):
        a = -math.pi / 2 + math.pi * i / n
        pts.append((x1 - r + math.cos(a) * r, cy + math.sin(a) * r))
    for i in range(n + 1):
        a = math.pi / 2 + math.pi * i / n
        pts.append((x0 + r + math.cos(a) * r * 1.0, cy + math.sin(a) * r))
    return pts


def leaf_pts(cx, cy, L, Wd, along='y', n=16):
    """不鏽鋼層板的船形輪廓"""
    pts = []
    for i in range(n):
        t = -1 + 2 * i / (n - 1)
        pts.append((t, (1 - t * t) ** 0.75))
    for i in range(n):
        t = 1 - 2 * i / (n - 1)
        pts.append((t, -0.35 * (1 - t * t) ** 0.9))
    out = []
    for t, s in pts:
        if along == 'y':
            out.append((cx + s * Wd, cy + t * L / 2))
        else:
            out.append((cx + t * L / 2, cy + s * Wd))
    return out


# ════════════════════════ 房體 ════════════════════════
def build_shell():
    fl = Obj('shell_floor', '地坪（淺灰大板磚）', group='房體')
    grid_box(fl, 0, W, 0, D, -0.05, 0, 'floor', step=0.3, var=0.03, skip=('-z', '-x', '+x', '-y', '+y'))
    grid_box(fl, W, C['x1'], C['y0'], C['y1'], -0.05, 0, 'cement', step=0.3, var=0.05, skip=('-z', '-x', '+x', '-y', '+y'))
    fl.collide(-0.5, C['x1'] + 0.5, -0.5, D + 0.5, -0.3, 0)

    wl = Obj('shell_walls', '牆面（班傑明乳膠漆）', group='房體')
    t = WT
    dz = P['entry_door']
    # 南牆：入口門洞
    grid_box(wl, -t, dz['x0'], -t, 0, 0, H, 'plaster')
    grid_box(wl, dz['x1'], W + t, -t, 0, 0, H, 'plaster')
    grid_box(wl, dz['x0'], dz['x1'], -t, 0, dz['h'], H, 'plaster')
    # 西牆（電視牆）：層板壁龕往牆內凹 22 cm
    nz0, nz1, ny0, ny1 = TW['niche_z0'], TW['niche_z1'], TW['niche_y0'], TW['niche_y1']
    grid_box(wl, -t, 0, 0, ny0, 0, H, 'plaster')
    grid_box(wl, -t, 0, ny1, D, 0, H, 'plaster')
    grid_box(wl, -t, 0, ny0, ny1, 0, nz0, 'plaster')
    grid_box(wl, -t, 0, ny0, ny1, nz1, H, 'plaster')
    grid_box(wl, -t - 0.24, -t, ny0 - 0.02, ny1 + 0.02, nz0 - 0.02, nz1 + 0.02, 'plaster', color='#EFE8DD', collide=False)
    grid_box(wl, -t - 0.24, 0, ny0, ny1, nz0 - 0.02, nz0, 'plaster', collide=False)
    # 北牆：落地窗
    grid_box(wl, -t, WIN['x0'], D, D + t, 0, H, 'plaster')
    grid_box(wl, WIN['x1'], W + t, D, D + t, 0, H, 'plaster')
    grid_box(wl, WIN['x0'], WIN['x1'], D, D + t, WIN['z1'], H, 'plaster')
    # 東牆：走廊口
    grid_box(wl, W, W + t, 0, C['y0'], 0, H, 'plaster')
    grid_box(wl, W, W + t, C['y1'], D, 0, H, 'plaster')
    grid_box(wl, W, W + t, C['y0'], C['y1'], C['h'], H, 'plaster')
    # 走廊（微水泥）
    cw = Obj('shell_corridor', '走廊（微水泥牆面）', group='房體')
    grid_box(cw, W + t, C['x1'], C['y0'] - t, C['y0'], 0, C['h'], 'cement', var=0.05)
    doors_x = [5.2, 6.9, 8.6]
    xs = [W + t] + [v for x in doors_x for v in (x, x + 0.9)] + [C['x1']]
    for i in range(0, len(xs), 2):
        grid_box(cw, xs[i], xs[i + 1], C['y1'], C['y1'] + t, 0, C['h'], 'cement', var=0.05)
    for x in doors_x:
        grid_box(cw, x, x + 0.9, C['y1'], C['y1'] + t, 2.1, C['h'], 'cement', var=0.05)
    grid_box(cw, C['x1'], C['x1'] + t, C['y0'] - t, C['y0'] + 0.15, 0, C['h'], 'cement', var=0.05)
    grid_box(cw, C['x1'], C['x1'] + t, C['y0'] + 1.05, C['y1'] + t, 0, C['h'], 'cement', var=0.05)
    grid_box(cw, C['x1'], C['x1'] + t, C['y0'] + 0.15, C['y0'] + 1.05, 2.1, C['h'], 'cement', var=0.05)
    grid_box(cw, W, C['x1'] + t, C['y0'] - t, C['y1'] + t, C['h'], C['h'] + 0.05, 'plaster', collide=False)
    # 掃地機器人的家：走廊南牆底部的凹槽
    box(cw, 4.5, 4.95, C['y0'] - 0.02, C['y0'] + 0.001, 0.0, 0.13, 'black', color='#2A2927')
    return doors_x


def build_ceiling():
    ce = Obj('shell_ceiling', '天花板（弧形轉折）', group='房體')
    grid_box(ce, 0, W, 0, LIVING_Y0, DINING_Z, H + 0.05, 'plaster', step=0.35, collide=False)
    grid_box(ce, 0, W, LIVING_Y0, D, H, H + 0.05, 'plaster', step=0.35, collide=False)
    # 客廳：沿東西兩牆與南側的弧形降板，北側窗簾盒留高並藏線燈
    zb = 2.53
    inner = rrect_pts(0.5, LIVING_Y0 + 0.35, W - 0.5, D - 0.02, P['ceiling']['corner_r'], 10)
    # 降板 = 外框矩形減去圓角內框：用放射狀對應把兩圈接起來
    cxm, cym = W / 2, (LIVING_Y0 + D) / 2
    bm = ce.bm
    outer = []
    for (x, y) in inner:
        dx, dy = x - cxm, y - cym
        s = min((W / 2) / abs(dx) if abs(dx) > 1e-6 else 1e9, ((D - LIVING_Y0) / 2) / abs(dy) if abs(dy) > 1e-6 else 1e9)
        outer.append((cxm + dx * s, min(D - 0.02, cym + dy * s)))
    ib = [bm.verts.new((x, y, zb)) for x, y in inner]
    it = [bm.verts.new((x, y, H)) for x, y in inner]
    ob = [bm.verts.new((x, y, zb)) for x, y in outer]
    fs = []
    n = len(inner)
    for i in range(n):
        j = (i + 1) % n
        fs.append(bm.faces.new((ob[i], ob[j], ib[j], ib[i])))
        fs.append(bm.faces.new((ib[i], ib[j], it[j], it[i])))
    ce.paint(ib + it + ob, fs, 'plaster', smooth=False)
    # 藏在降板內緣的間接照明（發光帶）
    glow = Obj('cove_light', '天花間接照明', group='燈光')
    gi = [(cxm + (x - cxm) * 0.985, cym + (y - cym) * 0.985) for x, y in inner]
    a = [glow.bm.verts.new((x, y, H - 0.005)) for x, y in inner]
    b = [glow.bm.verts.new((x, y, H - 0.005)) for x, y in gi]
    gf = [glow.bm.faces.new((a[i], a[(i + 1) % n], b[(i + 1) % n], b[i])) for i in range(n)]
    glow.paint(a + b, gf, 'emit')
    # 窗簾盒洗牆燈
    box(glow, WIN['x0'] - 0.3, WIN['x1'] + 0.3, D - 0.03, D - 0.01, H - 0.02, H - 0.005, 'emit')
    # 崁燈
    for (x, y) in [(1.0, 1.2), (3.3, 1.0), (0.9, 4.2), (W - 0.25, 4.5), (0.25, 7.0), (W - 0.25, 7.2), (W - 0.25, 9.6), (0.25, 9.6)]:
        cyl(glow, x, y, (DINING_Z if y < LIVING_Y0 else zb) - 0.004, (DINING_Z if y < LIVING_Y0 else zb) - 0.001, 0.045, 'glow', seg=12)
    for x in (5.0, 6.3, 7.6, 8.9, 9.8):
        cyl(glow, x, (C['y0'] + C['y1']) / 2, C['h'] - 0.004, C['h'] - 0.001, 0.04, 'glow', seg=12)


# ════════════════════════ 玄關 ════════════════════════
def build_entry():
    dz = P['entry_door']
    door = Obj('entry_door', '大門（電子鎖）', group='玄關')
    box(door, dz['x0'] + 0.02, dz['x1'] - 0.02, -0.06, -0.02, 0.0, dz['h'] - 0.02, 'lacquer', color='#E4DFD7', bevel=0.004)
    box(door, dz['x0'] + 0.1, dz['x0'] + 0.14, -0.02, 0.01, 0.95, 1.2, 'black')
    box(door, dz['x0'] + 0.09, dz['x0'] + 0.24, 0.01, 0.03, 1.02, 1.05, 'black', bevel=0.008)
    for (a, b) in ((dz['x0'], dz['x0'] + 0.03), (dz['x1'] - 0.03, dz['x1'])):
        box(door, a, b, -0.06, 0.0, 0, dz['h'], 'lacquer', color='#DCD6CD')
    box(door, dz['x0'], dz['x1'], -0.06, 0.0, dz['h'] - 0.03, dz['h'], 'lacquer', color='#DCD6CD')

    sc = Obj('shoe_cabinet', '玄關鞋櫃與穿鞋椅', group='玄關')
    d = SH['d']
    # 穿鞋椅兩側的高櫃（櫃體；南段的兩扇門另外做成可開的門）
    box(sc, 0, d - 0.02, 0.0, SH['bench_y0'], 0.08, 2.4, 'lacquer', color='#E6E1D9', collide=True)
    box(sc, 0, d, SH['bench_y1'], SH['y1'], 0.08, 2.4, 'lacquer', color='#EAE6DF', collide=True)
    box(sc, 0, d, SH['bench_y1'] + 0.005, SH['y1'] - 0.005, 0.08, 2.4, 'lacquer', color='#EAE6DF')
    box(sc, 0, d - 0.03, 0.0, SH['y1'], 0.0, 0.08, 'black', color='#3A3835')
    box(sc, 0, d, 0.0, SH['y1'], 2.4, 2.75, 'lacquer', color='#E6E1D9')
    # 穿鞋椅：洞石椅面（鳥嘴收邊）與下方收納
    box(sc, 0, d + 0.02, SH['bench_y0'], SH['bench_y1'], SH['bench_h'] - 0.05, SH['bench_h'], 'travertine', bevel=0.02, seg=3, collide=True)
    box(sc, 0, d - 0.04, SH['bench_y0'], SH['bench_y1'], 0.08, SH['bench_h'] - 0.05, 'lacquer', color='#E0DBD2')
    # 穿鞋背牆：透光不透視的長虹玻璃
    box(sc, 0.0, 0.02, SH['bench_y0'] + 0.08, SH['bench_y1'] - 0.08, SH['bench_h'] + 0.05, 2.3, 'glass', color='#F4F1EA')
    box(sc, -0.02, 0.0, SH['bench_y0'] + 0.08, SH['bench_y1'] - 0.08, SH['bench_h'] + 0.05, 2.3, 'emit', color='#FFF3E2')
    sc.collide(0, d, SH['bench_y0'], SH['bench_y1'], 0.0, SH['bench_h'])
    # 兩扇可開的鞋櫃門（鉸鏈在外側）
    doors = []
    y0, y1 = 0.02, SH['bench_y0'] - 0.01
    mid = (y0 + y1) / 2
    for k, (a, b, hinge) in enumerate(((y0, mid - 0.002, y0), (mid + 0.002, y1, y1))):
        o = Obj('shoe_door_%d' % k, '鞋櫃門 %s' % '左右'[k], kind='door', group='玄關',
                hinge=[d, hinge], axis='z', open_deg=(95 if k == 0 else -95), smooth=False)
        box(o, d - 0.02, d, a, b, 0.09, 2.38, 'lacquer', color='#EAE6DF')
        box(o, d, d + 0.012, (b - 0.03) if k == 0 else a + 0.012, (b - 0.012) if k == 0 else a + 0.03, 0.9, 1.4, 'black', color='#8C877F')
        doors.append(o)
    # 隔屏：擋住入門直視客廳；南面是拱形鏡，東端嵌垂直線燈
    pt = Obj('partition', '玄關隔屏（拱形鏡與線燈）', group='玄關')
    box(pt, 0, PA['x1'], PA['y'], PA['y'] + PA['t'], 0, PA['h'], 'plaster', collide=True)
    box(pt, 0, PA['x1'], PA['y'], PA['y'] + PA['t'], PA['h'], H, 'plaster')
    arch = []
    cx_, w_, zb, zt = PA['x1'] / 2, min(0.52, PA['x1'] - 0.1), 0.55, 2.05
    for i in range(13):
        a = math.pi * i / 12
        arch.append((cx_ + math.cos(a) * w_ / 2, zt - w_ / 2 + math.sin(a) * w_ / 2))
    outline = [(cx_ + w_ / 2, zb)] + arch + [(cx_ - w_ / 2, zb)]
    bm = pt.bm
    vs = [bm.verts.new((x, PA['y'] - 0.004, z)) for x, z in outline]
    f = bm.faces.new(vs)
    pt.paint(vs, [f], 'mirror')
    halo = [bm.verts.new((cx_ + (x - cx_) * 1.08, PA['y'] - 0.002, zb - 0.03 + (z - zb) * 1.03)) for x, z in outline]
    f2 = bm.faces.new(halo)
    pt.paint(halo, [f2], 'emit', color='#FFEBD0')
    box(pt, PA['x1'] - 0.03, PA['x1'] + 0.005, PA['y'] + 0.03, PA['y'] + PA['t'] - 0.03, 0.05, PA['h'] - 0.05, 'emit')
    box(pt, 0.2, 0.34, PA['y'] - 0.015, PA['y'], 1.35, 1.55, 'black', color='#2E2E30')  # 對講機
    return doors


# ════════════════════════ 廚房、中島、餐桌 ════════════════════════
def build_kitchen():
    x0, x1 = K['x0'], K['x1']
    tall = K['tall_x0']
    kc = Obj('kitchen_run', '廚具（下櫃、吊櫃、高櫃）', group='廚房')
    box(kc, x0, tall, 0.0, K['d'] - 0.02, 0.1, K['h'] - 0.04, 'lacquer', color='#E9E5DE', collide=True)
    box(kc, x0, tall, 0.0, K['d'] - 0.06, 0.0, 0.1, 'black', color='#3A3835')
    box(kc, x0 - 0.01, tall, 0.0, K['d'], K['h'] - 0.04, K['h'], 'stone', var=0.02, collide=True)
    box(kc, x0, tall, 0.0, 0.015, K['h'], K['upper_z0'], 'stone', color='#DCD6CC')
    box(kc, K['upper_x0'], K['upper_x1'], 0.0, 0.36, K['upper_z0'], K['upper_z1'], 'greige', collide=True)
    for i in range(1, 4):
        xx = K['upper_x0'] + (K['upper_x1'] - K['upper_x0']) * i / 4
        box(kc, xx - 0.002, xx + 0.002, 0.36, 0.362, K['upper_z0'] + 0.02, K['upper_z1'] - 0.02, 'black', color='#6E6861')
    box(kc, K['upper_x0'], K['upper_x1'], 0.02, 0.34, K['upper_z0'] - 0.012, K['upper_z0'], 'emit')
    box(kc, x0, K['upper_x0'], 0.0, 0.36, K['upper_z1'], H, 'lacquer', color='#E9E5DE')
    box(kc, K['upper_x0'], K['upper_x1'], 0.0, 0.36, K['upper_z1'], DINING_Z, 'lacquer', color='#E9E5DE')
    box(kc, tall, x1, 0.0, K['d'], 0.0, DINING_Z, 'lacquer', color='#E6E2DA', collide=True)
    box(kc, tall + 0.002, x1 - 0.002, K['d'], K['d'] + 0.01, 1.3, 1.5, 'black', color='#AAA49B')
    # 抽屜：兩欄三層，面板 + 盒身，往北拉出 42 cm
    drawers = []
    cols = [(x0 + 0.02, (x0 + tall) / 2 - 0.004), ((x0 + tall) / 2 + 0.004, tall - 0.02)]
    rows = [(0.12, 0.34), (0.36, 0.58), (0.6, K['h'] - 0.06)]
    for ci, (a, b) in enumerate(cols):
        for ri, (z0, z1) in enumerate(rows):
            o = Obj('drawer_%d%d' % (ci, ri), '廚房抽屜 %d-%d' % (ci + 1, ri + 1), kind='drawer', group='廚房',
                    axis=[0, 1, 0], travel=0.42, smooth=False)
            yf = K['d'] - 0.02
            box(o, a, b, yf, yf + 0.02, z0, z1, 'lacquer', color='#EDE9E2', bevel=0.002, seg=1)
            box(o, (a + b) / 2 - 0.12, (a + b) / 2 + 0.12, yf + 0.02, yf + 0.028, z1 - 0.035, z1 - 0.02, 'black', color='#8A857D')
            box(o, a + 0.02, b - 0.02, yf - 0.46, yf, z0 + 0.01, z0 + 0.022, 'lacquer', color='#D9D4CB')
            box(o, a + 0.02, a + 0.032, yf - 0.46, yf, z0 + 0.01, z1 - 0.04, 'lacquer', color='#D9D4CB')
            box(o, b - 0.032, b - 0.02, yf - 0.46, yf, z0 + 0.01, z1 - 0.04, 'lacquer', color='#D9D4CB')
            box(o, a + 0.02, b - 0.02, yf - 0.472, yf - 0.46, z0 + 0.01, z1 - 0.04, 'lacquer', color='#D9D4CB')
            drawers.append(o)
    # 中島（慢薩金石檯面）與接在西側的長圓餐桌
    isl = Obj('island', '中島（石材檯面）', group='廚房')
    box(isl, I['x0'], I['x1'], I['y0'] + 0.03, I['y1'] - 0.03, 0.0, I['h'] - 0.04, 'lacquer', color='#EEEAE3', bevel=0.012, collide=True)
    box(isl, I['x0'] - 0.01, I['x1'] + 0.01, I['y0'], I['y1'], I['h'] - 0.04, I['h'], 'stone', bevel=0.01, var=0.02, collide=True)
    box(isl, I['x0'] + 0.03, I['x1'] - 0.03, I['y0'] + 0.03, I['y0'] + 0.06, 0.0, 0.08, 'black', color='#3A3835')
    tb = Obj('dining_table', '餐桌（洞石紋長圓桌面）', group='餐廳')
    pts = stadium_pts(T['x0'], T['y0'], T['x1'] + 0.35, T['y1'])
    pts = [(min(x, T['x1'] + 0.01), y) for x, y in pts]
    prism(tb, pts, T['h'] - 0.035, T['h'], 'travertine', var=0.02)
    lathe(tb, [(0.24, 0), (0.24, 0.02), (0.16, 0.05), (0.15, T['h'] - 0.06), (0.2, T['h'] - 0.035)],
          T['x0'] + 0.42, (T['y0'] + T['y1']) / 2, 0.0, 'lacquer', color='#EFECE6', seg=32)
    tb.collide(T['x0'], T['x1'], T['y0'], T['y1'], T['h'] - 0.035, T['h'])
    tb.collide(T['x0'] + 0.25, T['x0'] + 0.59, (T['y0'] + T['y1']) / 2 - 0.17, (T['y0'] + T['y1']) / 2 + 0.17, 0, T['h'] - 0.035)
    # 雲朵吊燈
    for i, pd in enumerate(P['pendants']):
        o = Obj('pendant_%d' % i, '雲朵吊燈 %d' % (i + 1), group='燈光')
        r = pd['r']
        seed = i * 3.1
        bump = lambda a, h, s=seed: 1 + 0.06 * noise.noise(Vector((math.cos(a) * 1.6 + s, math.sin(a) * 1.6, h * 5)))
        prof = [(r * 0.94, 0.0), (r, 0.03), (r * 0.98, 0.09), (r * 0.86, 0.17), (r * 0.62, 0.24), (r * 0.3, 0.285), (0.001, 0.3)]
        lathe(o, [(a, b * r / 0.33) for a, b in prof], pd['x'], pd['y'], pd['z'], 'lamp', seg=40, rfn=bump, var=0.02, cap_bot=False)
        cyl(o, pd['x'], pd['y'], pd['z'] + 0.005, pd['z'] + 0.012, r * 0.9, 'glow', seg=32)
        tube(o, [(pd['x'], pd['y'], pd['z'] + 0.29 * r / 0.33), (pd['x'], pd['y'], DINING_Z)], 0.003, 'black', seg=6)
        cyl(o, pd['x'], pd['y'], DINING_Z - 0.02, DINING_Z, 0.05, 'lamp', seg=16)
    return drawers


# ════════════════════════ 客廳 ════════════════════════
def build_living():
    # 懸空洞石電視平台（45° 接角，離地 13 cm）
    pl = Obj('tv_platform', '懸空洞石電視平台', group='客廳')
    d = TW['plat_d']
    box(pl, 0, d, TW['plat_y0'], TW['plat_y1'], TW['plat_z0'], TW['plat_z1'], 'travertine', bevel=0.004, seg=1, var=0.03, collide=True)
    box(pl, 0, 0.12, TW['plat_y0'] + 0.2, TW['plat_y1'] - 0.2, 0.0, TW['plat_z0'], 'black', color='#2B2A28')
    # 西北角的 L 型線燈（牆角垂直一段接天花）
    pil = Obj('corner_light', 'L 型線燈', group='燈光')
    box(pil, 0.0, 0.025, D - 0.025, D, 0.05, H, 'emit')
    box(pil, 0.0, 0.5, D - 0.025, D, H - 0.025, H, 'emit')
    # 電視
    tv = Obj('tv', '電視（78 吋）', group='客廳')
    y0, y1 = TW['tv_yc'] - TW['tv_w'] / 2, TW['tv_yc'] + TW['tv_w'] / 2
    z0, z1 = TW['tv_zc'] - TW['tv_h'] / 2, TW['tv_zc'] + TW['tv_h'] / 2
    box(tv, 0.0, 0.045, y0, y1, z0, z1, 'black', color='#1C1C1E', bevel=0.004, seg=1)
    box(tv, 0.045, 0.047, y0 + 0.008, y1 - 0.008, z0 + 0.008, z1 - 0.008, 'black', color='#0C0C0D')
    # 壁龕裡的三片不鏽鋼髮絲紋層板與下方線燈
    sh = Obj('niche_shelves', '不鏽鋼髮絲紋層板', group='客廳')
    ny0, ny1 = TW['niche_y0'], TW['niche_y1']
    shelves = [(1.2, 0.0), (1.52, 0.18), (1.84, -0.1)]
    shelf_tops = []
    for (z, off) in shelves:
        cy = (ny0 + ny1) / 2 + off
        pts = leaf_pts(0.02, cy, 0.95, 0.2, 'y')
        pts = [(max(-0.3, x), y) for x, y in pts]
        prism(sh, pts, z - 0.012, z, 'steel', smooth=False)
        box(sh, -0.22, -0.2, cy - 0.35, cy + 0.35, z - 0.03, z - 0.012, 'emit')
        sh.collide(-0.3, 0.22, cy - 0.47, cy + 0.47, z - 0.012, z)
        shelf_tops.append((z, cy))
    # 落地窗與百葉
    wn = Obj('window', '落地窗與百葉窗', group='客廳')
    wx0, wx1, wz0, wz1 = WIN['x0'], WIN['x1'], WIN['z0'], WIN['z1']
    box(wn, wx0, wx1, D + 0.06, D + 0.08, wz0, wz1, 'glass', color='#EAF0F2')
    box(wn, wx0, wx1, D + 0.09, D + 0.1, wz0, wz1, 'emit', color='#FFFFFF')
    panels = 4
    pw = (wx1 - wx0) / panels
    for p in range(panels):
        a, b = wx0 + p * pw + 0.004, wx0 + (p + 1) * pw - 0.004
        yb = D - 0.035
        box(wn, a, a + 0.045, yb, yb + 0.03, wz0 + 0.02, wz1 - 0.01, 'shutter')
        box(wn, b - 0.045, b, yb, yb + 0.03, wz0 + 0.02, wz1 - 0.01, 'shutter')
        for zz in (wz0 + 0.02, (wz0 + wz1) / 2 - 0.04, wz1 - 0.09):
            box(wn, a, b, yb, yb + 0.03, zz, zz + 0.08, 'shutter')
        z = wz0 + 0.14
        while z < wz1 - 0.1:
            if abs(z - (wz0 + wz1) / 2) > 0.07:
                box(wn, a + 0.045, b - 0.045, yb - 0.01, yb + 0.04, z, z + 0.012, 'shutter', rot=0.0)
            z += 0.075
    box(wn, wx0 - 0.02, wx1 + 0.02, D - 0.04, D, wz1 - 0.01, wz1 + 0.02, 'shutter')
    wn.collide(wx0, wx1, D - 0.04, D, 0, wz1)
    # 沙發（模組化布沙發）
    sf = Obj('sofa', '模組沙發', group='客廳', smooth=True)
    x0, x1, y0, y1 = S['x0'], W - 0.02, S['y0'], S['y1']
    seat = S['seat']
    box(sf, x0 + 0.05, x1, y0, y1, 0.04, seat - 0.12, 'fabric', bevel=0.05, seg=3, collide=True)
    box(sf, x1 - 0.24, x1, y0, y1, 0.04, S['back'] - 0.1, 'fabric', bevel=0.08, seg=3, collide=True)
    n = 3
    L = (y1 - y0 - 0.02) / n
    for k in range(n):
        a = y0 + 0.01 + k * L
        box(sf, x0, x1 - 0.22, a + 0.005, a + L - 0.005, seat - 0.13, seat, 'fabric', bevel=0.06, seg=3, var=0.02)
        box(sf, x1 - 0.42, x1 - 0.2, a + 0.01, a + L - 0.01, seat - 0.02, S['back'], 'fabric', bevel=0.08, seg=3, var=0.02, rot=0.0)
    box(sf, x0 + 0.02, x1, y0 - 0.02, y0 + 0.2, 0.04, seat + 0.2, 'fabric', bevel=0.09, seg=3)
    box(sf, x0 + 0.02, x1, y1 - 0.2, y1 + 0.02, 0.04, seat + 0.2, 'fabric', bevel=0.09, seg=3)
    sf.collide(x0, x1, y0, y1, 0, seat)
    sf.collide(x1 - 0.42, x1, y0, y1, 0, S['back'])
    # 蓋毯
    box(sf, x0 - 0.01, x0 + 0.6, y0 + 0.6, y0 + 1.15, seat, seat + 0.025, 'fabric_warm', bevel=0.01, seg=2, var=0.05)
    box(sf, x0 - 0.02, x0 + 0.01, y0 + 0.6, y0 + 1.15, seat - 0.3, seat + 0.02, 'fabric_warm', bevel=0.005, seg=1)
    # 圓地毯
    rg = Obj('rug', '圓形地毯', group='客廳')
    cyl(rg, P['rug']['x'], P['rug']['y'], 0.0, 0.012, P['rug']['r'], 'rug', seg=64, var=0.03)
    return shelf_tops


# ════════════════════════ 可被推倒的物品（剛體） ════════════════════════
DENS = {'ceramic': 2300, 'glass': 2500, 'travertine': 2500, 'steel': 7900, 'wood': 650, 'foam': 45, 'paper': 800,
        'rattan': 350, 'plastic': 1100, 'fabric': 120, 'lacquer': 750, 'appliance': 900}


def dyn(oid, label, group, material, shape, fill, note=''):
    """shape：box / cyl / sphere；fill：實心比例（中空的花瓶、籃子遠小於 1）"""
    return Obj(oid, label, kind='dynamic', group=group, material=material, shape=shape, fill=fill, note=note, smooth=True)


def build_props(shelf_tops):
    out = []
    # 中島上的枝條花瓶
    o = dyn('vase_island', '中島枝條花瓶', '廚房', 'ceramic', 'cyl', 0.18, '陶瓶壁厚約 6 mm，瓶內無水')
    vx, vy = I['x1'] - 0.2, I['y1'] - 0.25
    lathe(o, [(0.001, 0), (0.07, 0.0), (0.085, 0.08), (0.07, 0.2), (0.035, 0.3), (0.03, 0.34), (0.036, 0.36), (0.001, 0.36)], vx, vy, I['h'], 'ceramic', seg=24, color='#E9E6E0')
    for k, (dx, dy, hh) in enumerate(((0.05, 0.02, 0.95), (-0.08, 0.04, 0.8), (0.02, -0.06, 0.7))):
        tube(o, [(vx, vy, I['h'] + 0.3), (vx + dx * 0.5, vy + dy * 0.5, I['h'] + 0.3 + hh * 0.5), (vx + dx, vy + dy, I['h'] + 0.3 + hh)], [0.006, 0.004, 0.002], 'wood', color='#5E5244', seg=5)
    o.meta['mass_override'] = 2.4
    o.meta['collider'] = {'type': 'cyl', 'r': 0.085, 'h': 0.36, 'center': [vx, vy, I['h'] + 0.18]}
    out.append(o)
    # 餐桌上的玻璃瓶與書
    o = dyn('bottle_table', '餐桌玻璃瓶', '餐廳', 'glass', 'cyl', 0.2)
    lathe(o, [(0.001, 0), (0.045, 0), (0.05, 0.02), (0.05, 0.16), (0.02, 0.22), (0.016, 0.28), (0.001, 0.28)], T['x0'] + 0.3, T['y0'] + 0.2, T['h'], 'glass', seg=20)
    out.append(o)
    o = dyn('book_table', '攤開的書', '餐廳', 'paper', 'box', 1.0)
    box(o, T['x0'] + 0.3, T['x0'] + 0.6, T['y1'] - 0.3, T['y1'] - 0.08, T['h'], T['h'] + 0.025, 'paper', color='#EDE8DE', bevel=0.003, seg=1)
    out.append(o)
    o = dyn('plate_table', '陶盤', '餐廳', 'ceramic', 'cyl', 0.5)
    lathe(o, [(0.001, 0), (0.09, 0), (0.13, 0.015), (0.14, 0.022), (0.001, 0.012)], T['x0'] + 0.72, T['y0'] + 0.28, T['h'], 'ceramic', seg=28, color='#E4DED4')
    out.append(o)
    # 備餐檯上的咖啡機
    o = dyn('espresso', '咖啡機', '廚房', 'appliance', 'box', 0.2, '外殼不鏽鋼、內部多為空腔與水箱')
    ex, ey = K['x0'] + 0.35, 0.28
    box(o, ex - 0.17, ex + 0.17, ey - 0.18, ey + 0.2, K['h'], K['h'] + 0.4, 'steel', bevel=0.015, seg=2)
    box(o, ex - 0.12, ex + 0.12, ey + 0.2, ey + 0.23, K['h'] + 0.22, K['h'] + 0.34, 'black', color='#2B2B2C')
    cyl(o, ex, ey + 0.26, K['h'] + 0.2, K['h'] + 0.23, 0.04, 'steel')
    box(o, ex - 0.15, ex + 0.15, ey - 0.16, ey + 0.2, K['h'] + 0.4, K['h'] + 0.42, 'steel', color='#B7B6B1')
    out.append(o)
    o = dyn('canister', '咖啡豆罐', '廚房', 'ceramic', 'cyl', 0.25)
    cyl(o, ex + 0.35, 0.2, K['h'], K['h'] + 0.2, 0.06, 'ceramic', color='#DAD3C7', seg=20)
    out.append(o)
    # 層板上的器物
    (z0, c0), (z1, c1), (z2, c2) = shelf_tops
    o = dyn('bowl_shelf', '層板上的陶碗', '客廳', 'ceramic', 'cyl', 0.3)
    lathe(o, [(0.001, 0), (0.05, 0), (0.09, 0.04), (0.11, 0.07), (0.1, 0.075), (0.045, 0.012), (0.001, 0.012)], 0.1, c0 - 0.1, z0, 'ceramic', seg=24, color='#D9D1C4')
    out.append(o)
    o = dyn('vase_shelf', '層板上的細頸瓶', '客廳', 'ceramic', 'cyl', 0.2)
    lathe(o, [(0.001, 0), (0.04, 0), (0.055, 0.06), (0.045, 0.14), (0.015, 0.2), (0.018, 0.23), (0.001, 0.23)], 0.08, c1 + 0.12, z1, 'ceramic', seg=20, color='#EFEDE8')
    out.append(o)
    o = dyn('books_shelf', '層板上的書堆', '客廳', 'paper', 'box', 1.0)
    for k, (h_, col) in enumerate(((0.03, '#CFC7B9'), (0.025, '#E6E0D5'), (0.022, '#9E9588'))):
        zz = z2 + sum(x for x, _ in ((0.03, 0), (0.025, 0), (0.022, 0))[:k])
        box(o, 0.0, 0.2, c2 - 0.14 + k * 0.01, c2 + 0.12 - k * 0.01, zz, zz + h_, 'paper', color=col, bevel=0.002, seg=1)
    out.append(o)
    o = dyn('sculpture_platform', '平台上的石球', '客廳', 'travertine', 'sphere', 1.0)
    ell(o, 0.3, TW['plat_y1'] - 0.35, TW['plat_z1'] + 0.08, 0.08, 0.08, 0.08, 'travertine', seg=20, rings=12)
    out.append(o)
    o = dyn('candle_platform', '平台上的燭台', '客廳', 'ceramic', 'cyl', 0.6)
    cyl(o, 0.28, TW['plat_y0'] + 0.5, TW['plat_z1'], TW['plat_z1'] + 0.16, 0.045, 'ceramic', color='#E2DCD1')
    out.append(o)
    # 抱枕
    for k, (dy, col) in enumerate(((0.35, '#D9CBB6'), (0.85, '#EFEAE2'), (2.55, '#CDBFA9'), (3.1, '#E8E1D6'))):
        o = dyn('pillow_%d' % k, '抱枕 %d' % (k + 1), '客廳', 'foam', 'box', 0.9)
        yy = S['y0'] + dy
        ell(o, W - 0.53, yy, S['seat'] + 0.225, 0.08, 0.22, 0.22, 'fabric_warm', color=col, seg=18, rings=10,
            rfn=lambda a, h: 1 - 0.18 * abs(math.sin(a * 2)) * (1 - abs(h)))
        out.append(o)
    # 蛋形矮凳、邊几與植物、藤籃、立燈
    ox, oy = P['props']['ottoman']
    o = dyn('ottoman', '蛋形矮凳', '客廳', 'foam', 'sphere', 1.0, '實心泡棉外覆皮革，等效密度 120 kg/m³')
    ell(o, ox, oy, 0.22, 0.24, 0.24, 0.22, 'fabric', color='#F1EEE8', seg=28, rings=14)
    o.meta['density_override'] = 120
    out.append(o)
    sx, sy = P['props']['side_table']
    o = dyn('side_table', '洞石邊几', '客廳', 'travertine', 'cyl', 0.12, '中空鑄造洞石柱身')
    lathe(o, [(0.001, 0), (0.17, 0), (0.18, 0.02), (0.12, 0.08), (0.1, 0.36), (0.16, 0.42), (0.26, 0.44), (0.26, 0.47), (0.001, 0.47)], sx, sy, 0.0, 'travertine', seg=36, color='#E6DFD2')
    out.append(o)
    o = dyn('plant_side', '邊几上的盆栽', '客廳', 'ceramic', 'cyl', 0.4)
    lathe(o, [(0.001, 0), (0.07, 0), (0.09, 0.14), (0.001, 0.14)], sx, sy, 0.47, 'ceramic', seg=18, color='#E9E4DB')
    for k in range(9):
        a = TAU * k / 9
        tip = (sx + math.cos(a) * 0.17, sy + math.sin(a) * 0.17, 0.47 + 0.3 + 0.06 * math.sin(k * 1.7))
        tube(o, [(sx, sy, 0.6), (sx + math.cos(a) * 0.08, sy + math.sin(a) * 0.08, 0.72), tip], [0.006, 0.004, 0.002], 'plant', seg=5)
        ell(o, *tip, 0.05, 0.03, 0.012, 'plant', color='#7C8C61', seg=8, rings=4)
    o.meta['mass_override'] = 3.2
    o.meta['collider'] = {'type': 'cyl', 'r': 0.1, 'h': 0.32, 'center': [sx, sy, 0.47 + 0.16]}
    out.append(o)
    bx, by = P['props']['basket']
    by = min(by, D - 0.3)
    o = dyn('basket', '藤編收納籃', '客廳', 'rattan', 'cyl', 0.12)
    lathe(o, [(0.001, 0), (0.17, 0), (0.19, 0.05), (0.2, 0.3), (0.19, 0.32), (0.18, 0.3), (0.17, 0.04), (0.001, 0.03)], bx, by, 0.0, 'rattan', seg=28, var=0.12,
          rfn=lambda a, h: 1 + 0.015 * math.sin(a * 40 + h * 60))
    out.append(o)
    lx, ly = min(S['x0'] - 0.25, 3.1), D - 0.32
    o = dyn('floor_lamp', '落地燈', '客廳', 'steel', 'cyl', 0.02, '鋼管與鑄鐵底座；質量集中在底座')
    cyl(o, lx, ly, 0.0, 0.025, 0.14, 'metal_dark', seg=24)
    tube(o, [(lx, ly, 0.02), (lx, ly, 1.3), (lx - 0.1, ly - 0.05, 1.55), (lx - 0.32, ly - 0.16, 1.58)], 0.011, 'metal_dark', seg=8)
    lathe(o, [(0.001, 0.0), (0.12, 0.0), (0.1, 0.08), (0.05, 0.13), (0.001, 0.14)], lx - 0.34, ly - 0.17, 1.44, 'lamp', seg=24, cap_bot=False)
    cyl(o, lx - 0.34, ly - 0.17, 1.445, 1.45, 0.1, 'glow', seg=20)
    o.meta['mass_override'] = 7.5
    o.meta['collider'] = {'type': 'box', 'half': [0.14, 0.14, 0.8], 'center': [lx, ly, 0.8]}
    o.meta['com'] = [lx, ly, 0.3]  # 鑄鐵底座很重，質心壓在底座上方
    out.append(o)
    # 餐椅兩張、長凳
    for k, cx in enumerate((T['x0'] + 0.35, T['x0'] + 0.95)):
        o = dyn('chair_%d' % k, '餐椅 %d' % (k + 1), '餐廳', 'wood', 'box', 0.08, '鋼腳＋泡棉座墊')
        cy = T['y0'] - 0.3
        for (dx, dy) in ((-0.2, -0.18), (0.2, -0.18), (-0.2, 0.18), (0.2, 0.18)):
            tube(o, [(cx + dx, cy + dy, 0.0), (cx + dx * 0.9, cy + dy * 0.9, 0.44)], 0.01, 'metal_dark', seg=6)
        box(o, cx - 0.23, cx + 0.23, cy - 0.22, cy + 0.22, 0.42, 0.47, 'fabric_grey', bevel=0.03, seg=3)
        pts = [(cx + math.sin(a) * 0.26, cy - 0.2 - math.cos(a) * 0.07) for a in np.linspace(-1.1, 1.1, 12)]
        inner = [(x, y + 0.05) for x, y in reversed(pts)]
        prism(o, pts + inner, 0.5, 0.78, 'fabric_grey', smooth=True)
        o.meta['mass_override'] = 6.5
        out.append(o)
    o = dyn('bench', '軟墊長凳', '餐廳', 'wood', 'box', 0.2, '木框＋泡棉＋布套')
    bx0, bx1, by0, by1 = T['x0'] + 0.05, T['x1'] - 0.05, T['y1'] + 0.2, T['y1'] + 0.58
    box(o, bx0, bx1, by0, by1, 0.3, 0.46, 'fabric', bevel=0.06, seg=3, color='#EEEAE3')
    for (xx, yy) in ((bx0 + 0.1, by0 + 0.08), (bx1 - 0.1, by0 + 0.08), (bx0 + 0.1, by1 - 0.08), (bx1 - 0.1, by1 - 0.08)):
        cyl(o, xx, yy, 0.0, 0.3, 0.018, 'wood', color='#8F7E69', seg=8)
    o.meta['mass_override'] = 14.0
    out.append(o)
    # 掃地機器人（在走廊口的家）
    o = dyn('robot_vacuum', '掃地機器人', '走廊', 'plastic', 'cyl', 0.35)
    cyl(o, 4.72, C['y0'] + 0.22, 0.0, 0.09, 0.17, 'lacquer', color='#F2F0EC', seg=32)
    cyl(o, 4.72, C['y0'] + 0.22, 0.09, 0.1, 0.05, 'black', color='#2A2A2B', seg=20)
    o.meta['mass_override'] = 3.6
    out.append(o)
    return out


# ════════════════════════ 走廊房門 ════════════════════════
def build_corridor_doors(doors_x):
    out = []
    names = ['主臥', '書房', '兒子房']
    for k, x in enumerate(doors_x):
        o = Obj('room_door_%d' % k, '%s房門' % names[k], kind='door', group='走廊', hinge=[x + 0.02, C['y1'] + 0.02], axis='z', open_deg=-100, smooth=False)
        box(o, x + 0.02, x + 0.88, C['y1'] + 0.01, C['y1'] + 0.05, 0.0, 2.08, 'lacquer', color='#E4DFD6', bevel=0.003, seg=1)
        box(o, x + 0.76, x + 0.78, C['y1'] - 0.03, C['y1'] + 0.01, 1.0, 1.02, 'black')
        box(o, x + 0.7, x + 0.8, C['y1'] - 0.035, C['y1'] - 0.02, 1.0, 1.02, 'black')
        out.append(o)
    o = Obj('room_door_3', '弟弟房門', kind='door', group='走廊', hinge=[C['x1'] - 0.02, C['y0'] + 0.17], axis='z', open_deg=100, smooth=False)
    box(o, C['x1'] - 0.05, C['x1'] - 0.01, C['y0'] + 0.17, C['y0'] + 1.03, 0.0, 2.08, 'lacquer', color='#E4DFD6', bevel=0.003, seg=1)
    box(o, C['x1'] - 0.09, C['x1'] - 0.05, C['y0'] + 0.9, C['y0'] + 0.92, 1.0, 1.02, 'black')
    out.append(o)
    return out


# ════════════════════════ 主持人代理人偶（非動作捕捉） ════════════════════════
def build_people():
    """兩位主持人的代理人偶：分段剛性身體 + 程序化步態。位置取自分鏡的腳點反投影（有解出相機的機位）或畫面目測"""
    specs = [
        ('host_a', '主持人 A（黑色長大衣）', 1.74, {'coat': '#2A2826', 'pants': '#1E1D1C', 'top': '#2A2826', 'hair': '#3A2E26'}),
        ('host_b', '主持人 B（丹寧背心）', 1.62, {'coat': '#3C5270', 'pants': '#1D1D1F', 'top': '#2B2D33', 'hair': '#1C1916'}),
    ]
    people = []
    for pid, label, hgt, col in specs:
        s = hgt / 1.7
        parts = {}

        def part(name, parent, pivot):
            ob = Obj('%s_%s' % (pid, name), label if name == 'root' else '%s·%s' % (label, name), kind='person', group='人物', smooth=True)
            ob.meta.update(parent=parent and '%s_%s' % (pid, parent), pivot=[p * s for p in pivot], person=pid)
            parts[name] = ob
            return ob

        root = part('root', None, (0, 0, 0))
        box(root, -0.001, 0.001, -0.001, 0.001, 0, 0.001, 'cloth', color=col['pants'])
        pel = part('pelvis', 'root', (0, 0, 0.95))
        ell(pel, 0, 0, 0.95 * s, 0.17 * s, 0.11 * s, 0.1 * s, 'cloth', color=col['pants'], seg=16, rings=8)
        tor = part('torso', 'pelvis', (0, 0, 1.0))
        lathe(tor, [(0.15, 0.0), (0.17, 0.12), (0.19, 0.34), (0.2, 0.44), (0.12, 0.5), (0.05, 0.52), (0.001, 0.52)], 0, 0, 1.0 * s, 'denim' if pid == 'host_b' else 'cloth',
              color=col['coat'], seg=16, sx=s, sy=0.62 * s)
        if pid == 'host_a':
            lathe(tor, [(0.001, -0.62), (0.26, -0.62), (0.22, -0.3), (0.19, 0.0), (0.001, 0.0)], 0, 0, 1.0 * s, 'cloth', color=col['coat'], seg=16, sx=s, sy=0.7 * s)
        hd = part('head', 'torso', (0, 0, 1.55))
        tube(hd, [(0, 0, 1.49 * s), (0, 0, 1.56 * s)], 0.045 * s, 'skin', seg=10)
        ell(hd, 0, 0.01 * s, 1.64 * s, 0.085 * s, 0.1 * s, 0.11 * s, 'skin', seg=18, rings=10)
        if pid == 'host_a':
            ell(hd, 0, -0.01 * s, 1.7 * s, 0.1 * s, 0.11 * s, 0.07 * s, 'cloth', color=col['hair'], seg=16, rings=8)
        else:
            ell(hd, 0, -0.02 * s, 1.66 * s, 0.1 * s, 0.11 * s, 0.13 * s, 'cloth', color=col['hair'], seg=16, rings=8)
        for side, sx_ in (('l', -1), ('r', 1)):
            ua = part('uparm_' + side, 'torso', (sx_ * 0.2, 0, 1.44))
            tube(ua, [(sx_ * 0.2 * s, 0, 1.44 * s), (sx_ * 0.22 * s, 0, 1.15 * s)], [0.055 * s, 0.045 * s], 'cloth', color=col['top'] if pid == 'host_b' else col['coat'], seg=10)
            fa = part('forearm_' + side, 'uparm_' + side, (sx_ * 0.22, 0, 1.15))
            tube(fa, [(sx_ * 0.22 * s, 0, 1.15 * s), (sx_ * 0.22 * s, 0.02 * s, 0.9 * s)], [0.045 * s, 0.035 * s], 'cloth', color=col['top'] if pid == 'host_b' else col['coat'], seg=10)
            ell(fa, sx_ * 0.22 * s, 0.02 * s, 0.85 * s, 0.03 * s, 0.045 * s, 0.06 * s, 'skin', seg=10, rings=6)
            th = part('thigh_' + side, 'pelvis', (sx_ * 0.09, 0, 0.92))
            tube(th, [(sx_ * 0.09 * s, 0, 0.92 * s), (sx_ * 0.09 * s, 0, 0.5 * s)], [0.085 * s, 0.065 * s], 'cloth', color=col['pants'], seg=10)
            sn = part('shin_' + side, 'thigh_' + side, (sx_ * 0.09, 0, 0.5))
            tube(sn, [(sx_ * 0.09 * s, 0, 0.5 * s), (sx_ * 0.09 * s, 0, 0.08 * s)], [0.07 * s, 0.06 * s], 'cloth', color=col['pants'], seg=10)
            box(sn, sx_ * 0.09 * s - 0.05, sx_ * 0.09 * s + 0.05, -0.05, 0.17, 0.0, 0.08 * s, 'black', color='#161514', bevel=0.02, seg=2)
        people.append((pid, label, hgt, parts))
    return people


# ════════════════════════ 物件實體化 ════════════════════════
def uv_box(bm):
    uv = bm.loops.layers.uv.new('UVMap')
    for f in bm.faces:
        n = f.normal
        ax = max(range(3), key=lambda i: abs(n[i]))
        for lp in f.loops:
            c = lp.vert.co
            lp[uv].uv = (c.y, c.z) if ax == 0 else ((c.x, c.z) if ax == 1 else (c.x, c.y))


def realize(o):
    bm = o.bm
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    uv_box(bm)
    me = bpy.data.meshes.new(o.id)
    bm.to_mesh(me)
    bm.free()
    for r in o.roles:
        me.materials.append(get_mat(r))
    ob = bpy.data.objects.new(o.id, me)
    bpy.context.scene.collection.objects.link(ob)
    me.color_attributes.active_color = me.color_attributes['Col']
    o.ob = ob
    return ob


def set_origin(ob, pos):
    pos = Vector(pos)
    ob.data.transform(Matrix.Translation(-pos))
    ob.location = pos


def bbox(ob):
    vs = np.array([ob.matrix_world @ v.co for v in ob.data.vertices]) if len(ob.data.vertices) else np.zeros((1, 3))
    return vs.min(0), vs.max(0)


def ao_bake(obs, samples=24, floor=0.42):
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.cycles.samples = samples
    sc.world.light_settings.distance = 0.6
    for ob in obs:
        me = ob.data
        ao = me.color_attributes.new('AO', 'FLOAT_COLOR', 'POINT')
        me.color_attributes.active_color = ao
        for o in bpy.context.view_layer.objects:
            o.select_set(False)
        ob.select_set(True)
        bpy.context.view_layer.objects.active = ob
        try:
            bpy.ops.object.bake(type='AO', target='VERTEX_COLORS')
            a = np.zeros(len(me.vertices) * 4, dtype=np.float32)
            ao.data.foreach_get('color', a)
            b = np.zeros_like(a)
            me.color_attributes['Col'].data.foreach_get('color', b)
            k = floor + (1 - floor) * np.clip(a.reshape(-1, 4)[:, :3], 0, 1)
            b = b.reshape(-1, 4)
            b[:, :3] *= k
            me.color_attributes['Col'].data.foreach_set('color', b.ravel())
        except Exception as e:
            print('AO bake failed', ob.name, e)
        me.color_attributes.remove(me.color_attributes['AO'])
        me.color_attributes.active_color = me.color_attributes['Col']


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.world = bpy.data.worlds.new('World')
    sc.world.use_nodes = True
    sc.world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.9, 0.88, 0.85, 1)
    sc.world.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.6
    sc.unit_settings.system = 'METRIC'
    bpy.context.preferences.filepaths.save_version = 0

    doors_x = build_shell()
    build_ceiling()
    shoe_doors = build_entry()
    drawers = build_kitchen()
    shelf_tops = build_living()
    props = build_props(shelf_tops)
    room_doors = build_corridor_doors(doors_x)
    people = build_people()

    obs = [realize(o) for o in OBJS]
    bpy.context.view_layer.update()
    # 物件原點：可動物件放在質心（外框中心）、門放在鉸鏈、抽屜放在面板中心、人偶零件放在關節
    for o in OBJS:
        ob = o.ob
        lo, hi = bbox(ob)
        if o.kind == 'dynamic':
            set_origin(ob, o.meta.get('com') or (lo + hi) / 2)
        elif o.kind == 'door':
            hx, hy = o.meta['hinge']
            set_origin(ob, (hx, hy, 0.0))
        elif o.kind == 'drawer':
            set_origin(ob, ((lo[0] + hi[0]) / 2, hi[1], (lo[2] + hi[2]) / 2))
        elif o.kind == 'person':
            set_origin(ob, o.meta['pivot'])
    bpy.context.view_layer.update()
    if BAKE:
        bake_list = [o.ob for o in OBJS if o.kind != 'person' and o.id not in ('cove_light',)]
        ao_bake(bake_list)
        print('AO baked on', len(bake_list), 'objects')
    # 人偶：父子關係（關節在各自的原點）
    for o in OBJS:
        if o.kind == 'person' and o.meta.get('parent'):
            par = bpy.data.objects[o.meta['parent']]
            mw = o.ob.matrix_world.copy()
            o.ob.parent = par
            o.ob.matrix_world = mw
    bpy.context.view_layer.update()

    records = make_records(people)
    anim = animate_people(people)
    # 網頁用 glb：只有網格與人偶動畫
    for o in bpy.context.view_layer.objects:
        o.select_set(o.type == 'MESH')
    glb = os.path.join(HERE, 'scene.glb')
    bpy.ops.export_scene.gltf(filepath=glb, export_format='GLB', use_selection=True, export_vertex_color='NAME', export_vertex_color_name='Col', export_animation_mode='ACTIVE_ACTIONS', export_apply=False,
                              export_yup=True, export_texcoords=True, export_normals=True, export_materials='EXPORT',
                              export_image_format='NONE', export_extras=False, export_cameras=False, export_lights=False)
    print('glb', os.path.getsize(glb) // 1024, 'KB')
    records['animation'] = anim
    json.dump(records, open(os.path.join(HERE, 'objects.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    # .blend：剛體、碰撞、示範動畫、影片相機
    setup_blend(records, drawers, shoe_doors + room_doors)
    blend = os.path.join(HERE, 'scene.blend')
    bpy.ops.wm.save_as_mainfile(filepath=blend, compress=True)
    print('blend', os.path.getsize(blend) // 1024, 'KB')


def make_records(people):
    err = CAMS['objects']
    fitted = {'shell': ['room.w', 'room.d', 'ceiling'], 'window': ['x0', 'x1', 'z0', 'z1'], 'tv': ['tv_yc', 'tv_zc', 'tv_w'],
              'tv_platform': ['plat_y0', 'plat_y1', 'plat_z0', 'plat_z1', 'plat_d'], 'sofa': ['x0', 'y1', 'seat'],
              'kitchen_run': ['x0', 'h', 'upper_x0', 'upper_x1', 'upper_z0', 'upper_z1'], 'island': ['x0', 'x1', 'y0', 'y1', 'h'],
              'dining_table': ['x0', 'h'], 'pendant_0': ['x', 'y', 'z'], 'pendant_1': ['x', 'y', 'z'], 'entry_door': [], 'partition': []}
    errkey = {'shell_walls': 'shell', 'shell_floor': 'shell', 'shell_ceiling': 'shell', 'window': 'window', 'tv': 'tv',
              'tv_platform': 'tv_platform', 'sofa': 'sofa', 'kitchen_run': 'kitchen', 'island': 'island', 'dining_table': 'table',
              'pendant_0': 'pendant0', 'pendant_1': 'pendant1', 'entry_door': 'entry_door', 'partition': 'partition'}
    recs, statics = [], []
    for o in OBJS:
        ob = o.ob
        lo, hi = bbox(ob)
        dims = (hi - lo)
        r = {'id': o.id, 'label': o.label, 'kind': o.kind, 'group': o.group, 'materials': o.roles,
             'size': [round(float(v), 3) for v in dims], 'origin': [round(float(v), 4) for v in ob.location]}
        ek = errkey.get(o.id)
        if ek and ek in err:
            r['error_px'] = err[ek]['mean']
            r['redo'] = err[ek]['redo']
        if fitted.get(o.id):
            r['fitted'] = fitted[o.id]
        if o.kind == 'dynamic':
            m = o.meta
            dens = m.get('density_override', DENS[m['material']])
            if m['shape'] == 'box':
                vol = float(dims[0] * dims[1] * dims[2])
                col = {'type': 'box', 'half': [round(float(v) / 2, 4) for v in dims]}
            elif m['shape'] == 'cyl':
                rad = float(max(dims[0], dims[1]) / 2)
                vol = math.pi * rad * rad * float(dims[2])
                col = {'type': 'cyl', 'r': round(rad, 4), 'h': round(float(dims[2]), 4)}
            else:
                rad = float(max(dims) / 2)
                vol = 4 / 3 * math.pi * float(dims[0] * dims[1] * dims[2]) / 8
                col = {'type': 'sphere', 'r': round(rad, 4)}
            if m.get('collider'):
                cc = m['collider']
                col = {k: v for k, v in cc.items() if k != 'center'}
                col['offset'] = [round(float(cc['center'][i] - ob.location[i]), 4) for i in range(3)]
            mass = m.get('mass_override') or dens * vol * m['fill']
            r.update(material=m['material'], density=dens, fill=m['fill'], volume_l=round(vol * 1000, 2),
                     mass=round(float(mass), 2), mass_method='override' if m.get('mass_override') else 'density×volume×fill',
                     collider=col, note=m.get('note', ''))
        if o.kind == 'door':
            r.update(hinge=o.meta['hinge'], open_deg=o.meta['open_deg'])
        if o.kind == 'drawer':
            r.update(axis=o.meta['axis'], travel=o.meta['travel'])
        if o.kind == 'person':
            r.update(parent=o.meta.get('parent'), person=o.meta['person'])
        for b in o.boxes:
            statics.append({'id': o.id, 'box': b})
        recs.append(r)
    return {'version': P['version'], 'units': 'm, 平面座標 x 東 y 北 z 上', 'objects': recs, 'static_boxes': statics,
            'room': {'w': W, 'd': D, 'h': H}, 'corridor': C}


# ── 主持人動線：各站位由分鏡推估 ──
def stations():
    feet = {}
    for fr in CAMS['frames']:
        feet.update(fr.get('people', {}))
    a_live = feet.get('host_a', (2.0, 8.9))
    b_live = feet.get('host_b', (2.75, 9.35))
    return {
        'host_a': [((0.95, 0.55), 0.0), ((0.8, 1.9), 3.5), ((1.35, 2.85), 7.0), ((1.35, 2.85), 15.0), ((2.0, 5.2), 19.0), (tuple(a_live), 23.0), (tuple(a_live), 34.0), ((3.2, 4.2), 39.0), ((4.0, 2.95), 42.5), ((4.0, 2.95), 50.0), ((2.0, 3.6), 54.0), ((1.2, 3.1), 56.0), ((0.95, 0.55), 60.0)],
        'host_b': [((1.3, 0.75), 0.0), ((1.3, 1.2), 5.0), ((1.3, 1.2), 15.0), ((1.2, 3.35), 17.5), ((2.6, 4.8), 20.0), (tuple(b_live), 23.5), (tuple(b_live), 34.0), ((3.5, 4.6), 39.5), ((4.05, 3.3), 43.0), ((4.05, 3.3), 50.0), ((2.4, 3.9), 54.5), ((1.15, 3.35), 57.0), ((1.3, 0.75), 60.0)],
    }


def animate_people(people):
    sc = bpy.context.scene
    fps = 24
    sc.render.fps = fps
    ST = stations()
    look = {'host_a': [(0, 90), (7.0, 0.0), (19, 90), (23, 70), (39, -30), (42.5, 0), (50, 200), (60, 270)],
            'host_b': [(0, 90), (5.0, 20), (20, 90), (23.5, 110), (39.5, -40), (43, 20), (50, 210), (60, 270)]}
    total = 60.0
    for pid, label, hgt, parts in people:
        path = ST[pid]
        root = parts['root'].ob
        phase = 0.0 if pid == 'host_a' else 1.3
        prev = None
        dist = 0.0
        for fi in range(0, int(total * fps) + 1, 2):
            t = fi / fps
            k = max(i for i in range(len(path)) if path[i][1] <= t + 1e-6) if t < path[-1][1] else len(path) - 1
            if k >= len(path) - 1:
                pos = path[-1][0]
                moving = False
            else:
                (p0, t0), (p1, t1) = path[k], path[k + 1]
                u = (t - t0) / max(1e-6, t1 - t0)
                u = u * u * (3 - 2 * u)
                pos = (p0[0] + (p1[0] - p0[0]) * u, p0[1] + (p1[1] - p0[1]) * u)
                moving = math.hypot(p1[0] - p0[0], p1[1] - p0[1]) > 0.05
            if prev is not None:
                dist += math.hypot(pos[0] - prev[0], pos[1] - prev[1])
            vx, vy = (pos[0] - prev[0], pos[1] - prev[1]) if prev else (0, 0)
            prev = pos
            if moving and math.hypot(vx, vy) > 1e-4:
                yaw = math.atan2(vy, vx) - math.pi / 2
            else:
                ls = look[pid]
                j = max(i for i in range(len(ls)) if ls[i][0] <= t + 1e-6)
                yaw = math.radians(ls[j][1]) - math.pi / 2
            root.location = (pos[0], pos[1], 0)
            root.rotation_euler = (0, 0, yaw)
            root.keyframe_insert('location', frame=fi + 1)
            root.keyframe_insert('rotation_euler', frame=fi + 1)
            cyc = dist / (0.62 * hgt / 1.7) * math.pi + phase
            amp = 1.0 if moving else 0.0
            talk = 0.0 if moving else math.sin(t * 2.1 + phase) * 0.5 + 0.5
            sw = math.sin(cyc) * 0.42 * amp
            rots = {
                'thigh_l': (sw, 0, 0), 'thigh_r': (-sw, 0, 0),
                'shin_l': (-max(0, math.sin(cyc + 1.2)) * 0.6 * amp, 0, 0), 'shin_r': (-max(0, math.sin(cyc + 1.2 + math.pi)) * 0.6 * amp, 0, 0),
                'uparm_l': (-sw * 0.8 + talk * 0.25, 0.08, 0), 'uparm_r': (sw * 0.8 - talk * 0.9, -0.08 - talk * 0.2, 0),
                'forearm_l': (-0.15 - talk * 0.3, 0, 0), 'forearm_r': (-0.2 - talk * 1.1 * (0.6 + 0.4 * math.sin(t * 4.3 + phase)), 0, 0),
                'torso': (0.03, 0, math.sin(cyc) * 0.06 * amp), 'head': (0.05 * math.sin(t * 0.9 + phase), 0, 0.25 * math.sin(t * 0.37 + phase) * (1 - amp)),
                'pelvis': (0, 0, -math.sin(cyc) * 0.05 * amp),
            }
            for name, e in rots.items():
                ob = parts[name].ob
                ob.rotation_euler = e
                ob.keyframe_insert('rotation_euler', frame=fi + 1)
            parts['pelvis'].ob.location.z = parts['pelvis'].ob.location.z
    sc.frame_start, sc.frame_end = 1, int(total * fps) + 1
    return {'fps': fps, 'duration': total, 'stations': ST}


def setup_blend(records, drawers, doors):
    sc = bpy.context.scene
    # 刪掉人偶以外的動畫資料不需要；剛體世界
    bpy.ops.rigidbody.world_add()
    rbw = sc.rigidbody_world
    rbw.substeps_per_frame = 10
    rbw.solver_iterations = 20
    rbw.point_cache.frame_start = 1
    rbw.point_cache.frame_end = 480
    rec = {r['id']: r for r in records['objects']}

    def add_rb(ob, typ, shape, mass=1.0, friction=0.6, kinematic=False):
        for o in bpy.context.view_layer.objects:
            o.select_set(False)
        ob.select_set(True)
        bpy.context.view_layer.objects.active = ob
        bpy.ops.rigidbody.object_add(type=typ)
        rb = ob.rigid_body
        rb.collision_shape = shape
        rb.friction = friction
        rb.restitution = 0.05
        rb.collision_margin = 0.002
        if typ == 'ACTIVE':
            rb.mass = mass
            rb.linear_damping = 0.25
            rb.angular_damping = 0.45
        rb.kinematic = kinematic
        return rb

    for o in OBJS:
        r = rec[o.id]
        if o.kind == 'static' and o.id not in ('cove_light',) and len(o.ob.data.vertices):
            add_rb(o.ob, 'PASSIVE', 'MESH')
        elif o.kind == 'dynamic':
            shape = {'box': 'BOX', 'cyl': 'CYLINDER', 'sphere': 'SPHERE'}[r['collider']['type']]
            if o.id in ('vase_island', 'chair_0', 'chair_1', 'floor_lamp', 'side_table', 'plant_side', 'bottle_table', 'vase_shelf'):
                shape = 'CONVEX_HULL'
            add_rb(o.ob, 'ACTIVE', shape, mass=max(0.05, r['mass']))
        elif o.kind in ('door', 'drawer'):
            add_rb(o.ob, 'PASSIVE', 'CONVEX_HULL' if o.kind == 'door' else 'MESH', kinematic=True)
    # 示範動畫：抽屜依序拉開、門打開、一支看不見的推桿掃過層板與中島（按播放就看得到物品被推倒）
    fps = sc.render.fps
    for i, o in enumerate(drawers):
        ob = o.ob
        y0 = ob.location.y
        ob.keyframe_insert('location', frame=40 + i * 6)
        ob.location.y = y0 + o.meta['travel']
        ob.keyframe_insert('location', frame=58 + i * 6)
        ob.location.y = y0
    for i, o in enumerate(doors):
        ob = o.ob
        ob.keyframe_insert('rotation_euler', frame=70 + i * 8)
        ob.rotation_euler.z = math.radians(o.meta['open_deg'])
        ob.keyframe_insert('rotation_euler', frame=100 + i * 8)
        ob.rotation_euler.z = 0
    pusher = bpy.data.objects.new('pusher', bpy.data.meshes.new('pusher'))
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0, matrix=Matrix.Diagonal((0.08, 0.08, 1.0, 1)))
    bm.to_mesh(pusher.data)
    bm.free()
    sc.collection.objects.link(pusher)
    pusher.hide_render = True
    pusher.display_type = 'WIRE'
    add_rb(pusher, 'PASSIVE', 'BOX', kinematic=True)
    lamp = bpy.data.objects['floor_lamp'].location
    sweeps = [(130, 175, (0.1, TW['niche_y0'] - 0.3, 1.55), (0.1, TW['niche_y1'] + 0.4, 1.55)),
              (185, 235, (0.3, TW['plat_y0'] - 0.2, 0.9), (0.3, TW['plat_y1'] + 0.1, 0.9)),
              (245, 280, (I['x1'] + 0.2, I['y1'] - 0.25, I['h'] + 0.5), (I['x0'] - 0.1, I['y1'] - 0.25, I['h'] + 0.5)),
              (290, 315, (lamp.x - 0.5, lamp.y, 1.0), (lamp.x + 0.25, lamp.y, 1.0)),
              (325, 350, (2.9, 5.7, 0.5), (2.9, 7.0, 0.5))]
    # 每段之間把推桿升到天花板上方再移過去，避免一格之內橫越房間把東西甩飛
    keys = [(1, (0.1, TW['niche_y0'] - 0.3, 4.5))]
    for f0, f1, a, b_ in sweeps:
        keys += [(f0 - 4, (a[0], a[1], 4.5)), (f0, a), (f1, b_), (f1 + 4, (b_[0], b_[1], 4.5))]
    for f, p in keys:
        pusher.location = p
        pusher.keyframe_insert('location', frame=f)
    if pusher.animation_data and pusher.animation_data.action:
        for fc in getattr(pusher.animation_data.action, 'fcurves', []):
            for kp in fc.keyframe_points:
                kp.interpolation = 'LINEAR'
    sc.frame_end = 480
    # 由影片解出的 8 台相機，背景貼原影片關鍵幀
    col = bpy.data.collections.new('影片相機')
    sc.collection.children.link(col)
    for fr in CAMS['frames']:
        cam = bpy.data.cameras.new(fr['id'])
        cam.sensor_fit = 'HORIZONTAL'
        cam.sensor_width = 36
        cam.lens = fr['blender']['lens36']
        cam.clip_start = 0.05
        ob = bpy.data.objects.new('cam_%s' % fr['id'], cam)
        col.objects.link(ob)
        m = Matrix([r for r in fr['blender']['matrix3']])
        ob.matrix_world = Matrix.Translation(fr['blender']['location']) @ m.to_4x4()
        ob['rms_px'] = fr['rms']
        ob['title'] = fr['title']
    sc.render.resolution_x, sc.render.resolution_y = 1280, 720
    sc.camera = bpy.data.objects.get('cam_f112')
    sc.frame_set(1)


main()
