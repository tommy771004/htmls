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
        self.orient = []     # (面, 內部參考點)：開放面片的法線要朝外，否則只算正面的通道（例如 GTAO 的深度）會看不到
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
    fs = faces_of(made)
    o.paint(made, fs, role, color, var, smooth=False)
    o.orient.append((fs, Vector(((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2))))
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



# ════════════════════════ 細部零件（軟包、垂墜、縫線） ════════════════════════
def rbox(o, x0, x1, y0, y1, z0, z1, r, role, color=None, n=(6, 6, 4), bulge=0.0, var=0.0, sag=0.0, collide=False):
    """圓角軟包：立方體細分後把每個點推到「縮小的方塊＋半徑 r」的表面；bulge 讓頂面鼓起、sag 讓頂面中央微凹（坐過的痕跡）"""
    hx, hy, hz = (x1 - x0) / 2, (y1 - y0) / 2, (z1 - z0) / 2
    cx, cy, cz = (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2
    r = min(r, hx * .98, hy * .98, hz * .98)
    bm = o.bm
    tmp = bmesh.new()
    bmesh.ops.create_cube(tmp, size=2.0)
    bmesh.ops.subdivide_edges(tmp, edges=tmp.edges[:], cuts=max(n), use_grid_fill=True)
    made = []
    vmap = {}
    for v in tmp.verts:
        q = Vector((v.co.x * hx, v.co.y * hy, v.co.z * hz))
        c = Vector((max(-(hx - r), min(hx - r, q.x)), max(-(hy - r), min(hy - r, q.y)), max(-(hz - r), min(hz - r, q.z))))
        d = q - c
        p = c + (d.normalized() * r if d.length > 1e-9 else Vector((0, 0, r)))
        if v.co.z > 0.2:
            u, w = p.x / hx, p.y / hy
            k = max(0.0, 1 - u * u) * max(0.0, 1 - w * w)
            p.z += bulge * k * v.co.z - sag * k * k * v.co.z
        nv = bm.verts.new((cx + p.x, cy + p.y, cz + p.z))
        vmap[v] = nv
        made.append(nv)
    fs = [bm.faces.new([vmap[v] for v in f.verts]) for f in tmp.faces]
    tmp.free()
    o.paint(made, fs, role, color, var, smooth=True)
    if collide:
        o.collide(x0, x1, y0, y1, z0, z1)
    return made


def piping(o, x0, x1, y0, y1, z, r, role, color=None, rad=0.004):
    """沿圓角矩形走一圈的滾邊"""
    pts = [(x, y, z) for x, y in rrect_pts(x0, y0, x1, y1, r, 4)]
    pts.append(pts[0])
    tube(o, pts, rad, role, color, seg=6)


def drape(o, x0, x1, y0, y1, z_top, over, sides, role, color, step=0.035, fold=0.018, var=0.04, seed=0.0):
    """被子／毯子：頂面平鋪在矩形上，往 sides（'-x','+x','-y','+y' 的組合）垂下 over 公尺，垂下的部分有褶"""
    ex0 = x0 - (over if '-x' in sides else 0.0)
    ex1 = x1 + (over if '+x' in sides else 0.0)
    ey0 = y0 - (over if '-y' in sides else 0.0)
    ey1 = y1 + (over if '+y' in sides else 0.0)
    nx = max(2, int((ex1 - ex0) / step))
    ny = max(2, int((ey1 - ey0) / step))
    bm = o.bm
    grid = []
    for i in range(nx + 1):
        row = []
        for j in range(ny + 1):
            px = ex0 + (ex1 - ex0) * i / nx
            py = ey0 + (ey1 - ey0) * j / ny
            dx = max(0.0, x0 - px, px - x1)
            dy = max(0.0, y0 - py, py - y1)
            d = max(dx, dy)
            qx = min(max(px, x0), x1)
            qy = min(max(py, y0), y1)
            # 邊緣是一段圓弧過渡，再直直垂下
            rr = 0.035
            if d < rr * 1.5708:
                ang = d / rr
                out, down = rr * math.sin(ang), rr * (1 - math.cos(ang))
            else:
                out, down = rr, rr + (d - rr * 1.5708)
            ox = (1 if px > x1 else -1 if px < x0 else 0) * (out + d * 0.04 if d > 0 else 0)
            oy = (1 if py > y1 else -1 if py < y0 else 0) * (out + d * 0.04 if d > 0 else 0)
            z = z_top - down
            # 褶：沿邊緣方向的波紋，越往下越深；頂面只有細小起伏
            along = qy if dx >= dy else qx
            fz = noise.noise(Vector((px * 3.1 + seed, py * 3.1, 0.3))) * 0.006
            ff = math.sin(along * 21 + noise.noise(Vector((along * 2 + seed, 1.7, 0))) * 3) * fold * min(1.0, d / 0.18)
            if dx >= dy and dx > 0:
                ox += ff * (1 if px > x1 else -1)
            elif dy > 0:
                oy += ff * (1 if py > y1 else -1)
            row.append(bm.verts.new((qx + ox, qy + oy, z + fz)))
        grid.append(row)
    fs = []
    for i in range(nx):
        for j in range(ny):
            fs.append(bm.faces.new((grid[i][j], grid[i + 1][j], grid[i + 1][j + 1], grid[i][j + 1])))
    made = [v for row in grid for v in row]
    o.paint(made, fs, role, color, var, smooth=True)
    o.orient.append((fs, Vector(((x0 + x1) / 2, (y0 + y1) / 2, z_top - 0.6))))
    return made


def shell_chair(o, cx, cy, face, seat_col='#A9A49D', leg_col='#2F2C29'):
    """餐椅：彎曲的一體殼背＋軟墊座＋四支微外斜的細腳；face 為椅子面向的方向（弧度，0 = +x）"""
    ca, sa = math.cos(face), math.sin(face)
    P2 = lambda u, v: (cx + u * ca - v * sa, cy + u * sa + v * ca)  # u 朝前、v 朝左
    for (u, v) in ((0.17, 0.17), (0.17, -0.17), (-0.17, 0.17), (-0.17, -0.17)):
        a = P2(u * 1.12, v * 1.12)
        b_ = P2(u * 0.92, v * 0.92)
        tube(o, [(a[0], a[1], 0.0), (b_[0], b_[1], 0.43)], [0.009, 0.012], 'metal_dark', leg_col, seg=8)
    x_ = [P2(u, v) for u, v in ((0.2, 0.2), (0.2, -0.2), (-0.2, -0.2), (-0.2, 0.2))]
    xs = [p[0] for p in x_]
    ys = [p[1] for p in x_]
    rbox(o, min(xs), max(xs), min(ys), max(ys), 0.425, 0.485, 0.03, 'fabric_grey', seat_col, n=(5, 5, 3), bulge=0.012, var=0.03)
    # 殼背：沿椅背弧線的截面往上擠出，越往上越往後、越寬
    secs = []
    for k in range(7):
        t = k / 6
        z = 0.47 + t * 0.34
        back = -0.2 - t * 0.06
        wid = 0.21 + t * 0.04
        ring = []
        for m in range(13):
            a = -1.15 + 2.3 * m / 12
            ring.append((math.sin(a) * wid, back + (1 - math.cos(a)) * 0.09 * 0.0 - math.cos(a) * 0.06 + 0.06))
        inner = [(u * 0.93, v + 0.035) for u, v in reversed(ring)]
        sec = [(P2(v, u)[0], P2(v, u)[1], z) for u, v in ring + inner]
        secs.append(sec)
    verts = []
    bm = o.bm
    rings = [[bm.verts.new(p) for p in sec] for sec in secs]
    fs = []
    n = len(secs[0])
    for k in range(len(rings) - 1):
        for i in range(n):
            j = (i + 1) % n
            fs.append(bm.faces.new((rings[k][i], rings[k][j], rings[k + 1][j], rings[k + 1][i])))
    fs.append(bm.faces.new(rings[0][::-1]))
    fs.append(bm.faces.new(rings[-1]))
    verts = [v for r in rings for v in r]
    o.paint(verts, fs, 'fabric_grey', seat_col, 0.03, smooth=True)


def plate(o, x, y, z, w, h, n_axis, role='lacquer', color='#EFECE6'):
    """牆上的開關／插座面板：n_axis 為牆的法線方向（'+x','-x','+y','-y'）"""
    t = 0.008
    if n_axis in ('+y', '-y'):
        s = 1 if n_axis == '+y' else -1
        box(o, x - w / 2, x + w / 2, y, y + s * t, z - h / 2, z + h / 2, role, color=color, bevel=0.002, seg=1)
        box(o, x - w / 4, x + w / 4, y + s * t, y + s * (t + 0.002), z - h / 5, z + h / 5, role, color='#E2DED6')
    else:
        s = 1 if n_axis == '+x' else -1
        box(o, x, x + s * t, y - w / 2, y + w / 2, z - h / 2, z + h / 2, role, color=color, bevel=0.002, seg=1)
        box(o, x + s * t, x + s * (t + 0.002), y - w / 4, y + w / 4, z - h / 5, z + h / 5, role, color='#E2DED6')


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
    # 走廊與四個房間在 build_wing()


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
    # 高櫃：左半是冰箱（兩扇門、垂直把手），右半是電器櫃
    fx = (tall + x1) / 2
    box(kc, fx - 0.003, fx + 0.003, K['d'], K['d'] + 0.004, 0.05, DINING_Z - 0.05, 'black', color='#8C867D')
    box(kc, tall + 0.01, fx - 0.01, K['d'], K['d'] + 0.004, 1.2, 1.206, 'black', color='#8C867D')
    tube(kc, [(fx - 0.05, K['d'] + 0.03, 0.95), (fx - 0.05, K['d'] + 0.03, 1.6)], 0.009, 'steel', seg=8)
    for zz in (0.95, 1.6):
        tube(kc, [(fx - 0.05, K['d'] + 0.004, zz), (fx - 0.05, K['d'] + 0.03, zz)], 0.006, 'steel', seg=6)
    box(kc, fx + 0.08, x1 - 0.06, K['d'], K['d'] + 0.006, 0.85, 1.45, 'black', color='#1F1E1D', bevel=0.004, seg=1)
    box(kc, fx + 0.1, x1 - 0.08, K['d'] + 0.006, K['d'] + 0.009, 1.38, 1.42, 'glow', color='#FFE9C8')
    # 水槽（下嵌、深色內膽）與鵝頸龍頭
    sx0, sx1 = tall - 0.72, tall - 0.18
    box(kc, sx0, sx1, 0.14, K['d'] - 0.1, K['h'] - 0.001, K['h'] + 0.0005, 'black', color='#34322F')
    box(kc, sx0 + 0.02, sx1 - 0.02, 0.16, K['d'] - 0.12, K['h'] - 0.2, K['h'] - 0.0015, 'steel', color='#9A9994')
    cyl(kc, (sx0 + sx1) / 2, (0.16 + K['d'] - 0.12) / 2, K['h'] - 0.2, K['h'] - 0.198, 0.035, 'black', color='#2A2927', seg=16)
    fxx = (sx0 + sx1) / 2
    cyl(kc, fxx, 0.1, K['h'], K['h'] + 0.02, 0.026, 'steel', seg=16)
    tube(kc, [(fxx, 0.1, K['h'] + 0.02), (fxx, 0.1, K['h'] + 0.3), (fxx, 0.14, K['h'] + 0.37), (fxx, 0.22, K['h'] + 0.36), (fxx, 0.27, K['h'] + 0.29)], 0.012, 'steel', seg=10)
    tube(kc, [(fxx + 0.05, 0.1, K['h'] + 0.12), (fxx + 0.12, 0.1, K['h'] + 0.14)], 0.006, 'steel', seg=6)
    # 電陶爐：黑玻璃面與兩圈爐位
    cx0 = x0 + 0.72
    box(kc, cx0, cx0 + 0.6, 0.06, 0.56, K['h'], K['h'] + 0.006, 'black', color='#161617', bevel=0.004, seg=1)
    for (dx, rr) in ((0.16, 0.1), (0.44, 0.08)):
        for r2 in (rr, rr * 0.62):
            pts = [(cx0 + dx + math.cos(a) * r2, 0.31 + math.sin(a) * r2, K['h'] + 0.0075) for a in np.linspace(0, TAU, 33)]
            tube(kc, pts, 0.0018, 'glow', color='#8E7F6C', seg=4)
    box(kc, cx0 + 0.22, cx0 + 0.38, 0.07, 0.11, K['h'] + 0.0062, K['h'] + 0.0068, 'glow', color='#9E9384')
    # 抽屜上緣的 J 型把手溝（深色內凹線）
    for ri, zz in enumerate((0.34, 0.58, K['h'] - 0.06)):
        box(kc, x0 + 0.02, tall - 0.02, K['d'] - 0.019, K['d'] - 0.004, zz - 0.004, zz + 0.016, 'black', color='#4A4640')
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
    # 沙發（模組化布沙發）：凹入的踢腳座、底座、三個鼓起的坐墊與靠墊、兩側扶手，墊子邊緣有滾邊
    sf = Obj('sofa', '模組沙發', group='客廳', smooth=True)
    x0, x1, y0, y1 = S['x0'], W - 0.02, S['y0'], S['y1']
    seat = S['seat']
    FC = '#ECE6DC'
    box(sf, x0 + 0.1, x1 - 0.04, y0 + 0.06, y1 - 0.06, 0.0, 0.05, 'black', color='#403B35')
    rbox(sf, x0 + 0.04, x1, y0, y1, 0.05, seat - 0.13, 0.04, 'fabric', FC, n=(8, 8, 3), var=0.02)
    rbox(sf, x1 - 0.24, x1, y0 + 0.02, y1 - 0.02, seat - 0.14, S['back'] - 0.08, 0.06, 'fabric', FC, n=(4, 10, 6), var=0.02)
    n = 3
    L = (y1 - y0 - 0.44) / n
    for k in range(n):
        a = y0 + 0.22 + k * L
        rbox(sf, x0, x1 - 0.22, a + 0.006, a + L - 0.006, seat - 0.14, seat, 0.05, 'fabric', FC, n=(8, 8, 4), bulge=0.018, sag=0.012, var=0.02)
        piping(sf, x0 + 0.01, x1 - 0.23, a + 0.016, a + L - 0.016, seat - 0.035, 0.045, 'fabric', '#DDD5C8')
        rbox(sf, x1 - 0.46, x1 - 0.2, a + 0.012, a + L - 0.012, seat - 0.03, S['back'] + 0.02, 0.07, 'fabric', FC, n=(5, 8, 8), bulge=0.0, var=0.025)
    for (ya, yb) in ((y0, y0 + 0.22), (y1 - 0.22, y1)):
        rbox(sf, x0 + 0.02, x1, ya, yb, 0.05, seat + 0.2, 0.08, 'fabric', FC, n=(8, 4, 6), bulge=0.01, var=0.02)
        piping(sf, x0 + 0.03, x1 - 0.01, ya + 0.01, yb - 0.01, seat + 0.14, 0.07, 'fabric', '#DDD5C8')
    sf.collide(x0, x1, y0, y1, 0, seat)
    sf.collide(x1 - 0.42, x1, y0, y1, 0, S['back'])
    # 搭在坐墊前緣的蓋毯
    drape(sf, x0 + 0.02, x0 + 0.55, y0 + 0.62, y0 + 1.2, seat + 0.012, 0.26, ('-x',), 'fabric_warm', '#D8C8B2', step=0.03, fold=0.022, seed=1.3)
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
        pillow_shape(o, W - 0.53, yy, S['seat'] + 0.01, 0.075, 0.22, 0.43, col)
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
        cy = T['y0'] - 0.24
        shell_chair(o, cx, cy, math.pi / 2)
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
# ════════════════════════ 走廊與四個房間（下集） ════════════════════════
# 位置照上下集影片裡的平面圖相對配置（北側三間小孩房、南側主臥套房），尺寸以平面圖比例與下集畫面目測。
FLOOR_RECTS = []


def wall_x(o, x0, x1, y0, y1, openings=(), z_top=None, role='plaster', color=None, var=0.0):
    """沿 x 走的牆（厚度在 y），openings=[(a0, a1, z0, z1)]"""
    zt = z_top or H
    xs = [x0]
    for a0, a1, _, _ in sorted(openings):
        xs += [a0, a1]
    xs.append(x1)
    for k in range(0, len(xs), 2):
        if xs[k + 1] - xs[k] > 1e-3:
            grid_box(o, xs[k], xs[k + 1], y0, y1, 0, zt, role, color=color, var=var, step=0.45)
    for a0, a1, z0, z1 in openings:
        if z0 > 1e-3:
            grid_box(o, a0, a1, y0, y1, 0, z0, role, color=color, var=var, step=0.45)
        if z1 < zt - 1e-3:
            grid_box(o, a0, a1, y0, y1, z1, zt, role, color=color, var=var, step=0.45)


def wall_y(o, x0, x1, y0, y1, openings=(), z_top=None, role='plaster', color=None, var=0.0):
    """沿 y 走的牆（厚度在 x）"""
    zt = z_top or H
    ys = [y0]
    for a0, a1, _, _ in sorted(openings):
        ys += [a0, a1]
    ys.append(y1)
    for k in range(0, len(ys), 2):
        if ys[k + 1] - ys[k] > 1e-3:
            grid_box(o, x0, x1, ys[k], ys[k + 1], 0, zt, role, color=color, var=var, step=0.45)
    for a0, a1, z0, z1 in openings:
        if z0 > 1e-3:
            grid_box(o, x0, x1, a0, a1, 0, z0, role, color=color, var=var, step=0.45)
        if z1 < zt - 1e-3:
            grid_box(o, x0, x1, a0, a1, z1, zt, role, color=color, var=var, step=0.45)


def door(oid, label, group, hx, hy, L, along, deg, z1=2.08, t=0.04, color='#E4DFD6', sub=None):
    """門片：鉸鏈在 (hx, hy)，門片沿 along 軸往 L（可為負）方向延伸；deg 為打開角度（正值逆時針）"""
    o = Obj(oid, label, kind='door', group=group, hinge=[hx, hy], axis='z', open_deg=deg, smooth=False)
    if sub:
        o.meta['sub'] = sub
    s = 1 if L > 0 else -1
    if along == 'x':
        box(o, min(hx, hx + L) + 0.01 * s * 0, max(hx, hx + L), hy - t / 2, hy + t / 2, 0.0, z1, 'lacquer', color=color, bevel=0.003, seg=1)
        hxh = hx + L - s * 0.1
        for dy in (-t / 2 - 0.035, t / 2 + 0.005):
            box(o, hxh - s * 0.1 if s < 0 else hxh - 0.1, hxh + 0.1 if s > 0 else hxh + 0.1, hy + dy, hy + dy + 0.03, 1.0, 1.02, 'black')
    else:
        box(o, hx - t / 2, hx + t / 2, min(hy, hy + L), max(hy, hy + L), 0.0, z1, 'lacquer', color=color, bevel=0.003, seg=1)
        hyh = hy + L - s * 0.1
        for dx in (-t / 2 - 0.035, t / 2 + 0.005):
            box(o, hx + dx, hx + dx + 0.03, hyh - 0.1, hyh + 0.1, 1.0, 1.02, 'black')
    return o


def slider(oid, label, group, x0, x1, y0, y1, z0, z1, axis, travel, color='#E9E4DC', sub='滑門'):
    o = Obj(oid, label, kind='drawer', group=group, axis=axis, travel=travel, smooth=False)
    o.meta['sub'] = sub
    box(o, x0, x1, y0, y1, z0, z1, 'lacquer', color=color, bevel=0.003, seg=1)
    return o


def zebra(o, x0, x1, y, z0, z1, along='x', depth=0.012):
    """調光捲簾：不透光與透光條紋交錯"""
    z = z0
    k = 0
    while z < z1 - 1e-3:
        h = min(0.05, z1 - z)
        role, col = ('fabric', '#EEEAE3') if k % 2 == 0 else ('glass', '#F6F3EE')
        if along == 'x':
            box(o, x0, x1, y - depth / 2, y + depth / 2, z, z + h, role, color=col)
        else:
            box(o, y - depth / 2, y + depth / 2, x0, x1, z, z + h, role, color=col)
        z += h
        k += 1


def curtain(o, x0, x1, y, z0, z1, amp=0.03, n=10, role='fabric_warm', color='#E9DECB'):
    """垂墜窗簾：波浪截面沿 x 擠出"""
    pts_f, pts_b = [], []
    steps = max(8, int((x1 - x0) / 0.04))
    for i in range(steps + 1):
        x = x0 + (x1 - x0) * i / steps
        yy = y + math.sin(i / steps * n * math.pi) * amp
        pts_f.append((x, yy))
        pts_b.append((x, yy + 0.012))
    prism(o, pts_f + list(reversed(pts_b)), z0, z1, role, color=color, smooth=True)


def bed(o, x0, x1, y0, y1, head, base_h=0.3, colors=('#E7E1D7', '#EFEAE2', '#DCCFBC'), drawers_side=None, group='', oid=''):
    """床：凹入踢腳＋床座＋有滾邊的圓角床墊＋垂到床側的被子（褶皺）＋床尾摺好的蓋毯；head 為床頭方向"""
    base, matc, duv = colors
    box(o, x0 + 0.03, x1 - 0.03, y0 + 0.03, y1 - 0.03, 0.0, 0.08, 'black', color='#3B3834', collide=True)
    box(o, x0 + 0.01, x1 - 0.01, y0 + 0.01, y1 - 0.01, 0.08, base_h, 'lacquer', color=base, bevel=0.01, collide=True)
    mt = base_h + 0.22
    rbox(o, x0 + 0.03, x1 - 0.03, y0 + 0.03, y1 - 0.03, base_h, mt, 0.05, 'fabric', matc, n=(10, 8, 3), bulge=0.008, var=0.015)
    piping(o, x0 + 0.035, x1 - 0.035, y0 + 0.035, y1 - 0.035, mt - 0.012, 0.04, 'fabric', '#E1DBD1', rad=0.0045)
    piping(o, x0 + 0.035, x1 - 0.035, y0 + 0.035, y1 - 0.035, base_h + 0.012, 0.04, 'fabric', '#E1DBD1', rad=0.0045)
    o.collide(x0, x1, y0, y1, base_h, mt)
    dz = mt + 0.03
    sides = {'+x': ('-x', '+y', '-y'), '-x': ('+x', '+y', '-y'), '+y': ('-y', '+x', '-x'), '-y': ('+y', '+x', '-x')}[head]
    if head in ('+x', '-x'):
        L = x1 - x0
        a, c = (x0 + 0.02, x1 - L * 0.3) if head == '+x' else (x0 + L * 0.3, x1 - 0.02)
        drape(o, a, c, y0 + 0.02, y1 - 0.02, dz, 0.26, sides, 'fabric_warm', duv, step=0.035, fold=0.02, seed=x0)
        # 被子往床頭反摺的一道
        fa, fc = (c - 0.24, c) if head == '+x' else (a, a + 0.24)
        rbox(o, fa, fc, y0 + 0.01, y1 - 0.01, dz - 0.005, dz + 0.035, 0.02, 'fabric_warm', duv, n=(4, 10, 2), var=0.03)
        # 床尾摺好的蓋毯
        ta, tc = (a + 0.12, a + 0.52) if head == '+x' else (c - 0.52, c - 0.12)
        drape(o, ta, tc, y0 - 0.005, y1 + 0.005, dz + 0.02, 0.12, ('+y', '-y'), 'fabric_grey', '#B7AEA2', step=0.03, fold=0.01, seed=y0)
    else:
        L = y1 - y0
        a, c = (y0 + 0.02, y1 - L * 0.3) if head == '+y' else (y0 + L * 0.3, y1 - 0.02)
        drape(o, x0 + 0.02, x1 - 0.02, a, c, dz, 0.26, sides, 'fabric_warm', duv, step=0.035, fold=0.02, seed=y0)
        fa, fc = (c - 0.24, c) if head == '+y' else (a, a + 0.24)
        rbox(o, x0 + 0.01, x1 - 0.01, fa, fc, dz - 0.005, dz + 0.035, 0.02, 'fabric_warm', duv, n=(10, 4, 2), var=0.03)
        ta, tc = (a + 0.12, a + 0.52) if head == '+y' else (c - 0.52, c - 0.12)
        drape(o, x0 - 0.005, x1 + 0.005, ta, tc, dz + 0.02, 0.12, ('+x', '-x'), 'fabric_grey', '#B7AEA2', step=0.03, fold=0.01, seed=x0)


def bed_drawers(prefix, label, group, x0, x1, y, z0, z1, n, side):
    """床座側邊的抽屜：沿 x 排列，往 side（-1 往南、+1 往北）拉出"""
    out = []
    w = (x1 - x0) / n
    for k in range(n):
        a, c = x0 + k * w + 0.01, x0 + (k + 1) * w - 0.01
        o = Obj('%s_%d' % (prefix, k), '%s %d' % (label, k + 1), kind='drawer', group=group, axis=[0, side, 0], travel=0.42, smooth=False)
        o.meta['sub'] = '床座抽屜'
        yf = y
        box(o, a, c, yf - 0.018 if side < 0 else yf, yf if side < 0 else yf + 0.018, z0, z1, 'lacquer', color='#E4DED5', bevel=0.002, seg=1)
        yb = yf + (0.45 if side < 0 else -0.45)
        box(o, a + 0.02, c - 0.02, min(yf, yb), max(yf, yb), z0 + 0.01, z0 + 0.022, 'lacquer', color='#D6D0C6')
        box(o, a + 0.02, a + 0.032, min(yf, yb), max(yf, yb), z0 + 0.01, z1 - 0.03, 'lacquer', color='#D6D0C6')
        box(o, c - 0.032, c - 0.02, min(yf, yb), max(yf, yb), z0 + 0.01, z1 - 0.03, 'lacquer', color='#D6D0C6')
        box(o, (a + c) / 2 - 0.08, (a + c) / 2 + 0.08, (yf - 0.026) if side < 0 else yf + 0.018, (yf - 0.018) if side < 0 else yf + 0.026, z1 - 0.05, z1 - 0.035, 'black', color='#8A857D')
        out.append(o)
    return out


def clothes(o, x0, x1, y, z_rod, along='x', n=8, palette=('#F2EFEA', '#D9CFC2', '#B9AFA3', '#EDE6DA', '#8D8479', '#E4DCCF')):
    tube(o, [(x0, y, z_rod), (x1, y, z_rod)] if along == 'x' else [(y, x0, z_rod), (y, x1, z_rod)], 0.012, 'steel', seg=8)
    for k in range(n):
        c = x0 + (x1 - x0) * (k + 0.5) / n
        L = 0.75 + 0.35 * ((k * 7) % 3) / 2
        col = palette[k % len(palette)]
        if along == 'x':
            box(o, c - 0.018, c + 0.018, y - 0.22, y + 0.22, z_rod - L, z_rod - 0.04, 'fabric', color=col, bevel=0.01, seg=1)
        else:
            box(o, y - 0.22, y + 0.22, c - 0.018, c + 0.018, z_rod - L, z_rod - 0.04, 'fabric', color=col, bevel=0.01, seg=1)


def plush(oid, label, group, x, y, z, s=1.0, col='#D8C3A8'):
    o = dyn(oid, label, group, 'foam', 'sphere', 1.0, '填充玩偶')
    ell(o, x, y, z + 0.07 * s, 0.07 * s, 0.06 * s, 0.07 * s, 'fabric_warm', color=col, seg=14, rings=8)
    ell(o, x, y, z + 0.17 * s, 0.055 * s, 0.05 * s, 0.05 * s, 'fabric_warm', color=col, seg=14, rings=8)
    for dx in (-0.035, 0.035):
        ell(o, x + dx * s, y, z + 0.215 * s, 0.018 * s, 0.012 * s, 0.018 * s, 'fabric_warm', color=col, seg=8, rings=4)
    o.meta['density_override'] = 60
    return o


def pillow(oid, label, group, x, y, z, along='y', col='#EDE7DE', size=(0.5, 0.14, 0.32)):
    o = dyn(oid, label, group, 'foam', 'box', 0.9)
    w, t, h = size
    rx, ry = (t / 2, w / 2) if along == 'y' else (w / 2, t / 2)
    pillow_shape(o, x, y, z, rx, ry, h, col)
    return o


def pillow_shape(o, x, y, z, rx, ry, h, col):
    """抱枕：圓角軟包，中間飽滿、四角收薄，四邊一圈滾邊"""
    made = rbox(o, x - rx, x + rx, y - ry, y + ry, z, z + h, min(rx, ry) * 0.9, 'fabric_warm', col, n=(6, 8, 6), var=0.03)
    thin = min(rx, ry)
    for v in made:
        u = (v.co.x - x) / rx if rx > ry else (v.co.y - y) / ry
        w = (v.co.z - z - h / 2) / (h / 2)
        k = (1 - 0.45 * abs(u) ** 3) * (1 - 0.45 * abs(w) ** 3)
        if rx < ry:
            v.co.x = x + (v.co.x - x) * k
        else:
            v.co.y = y + (v.co.y - y) * k


def side_table(oid, label, group, x, y, col='#E3DCD0', h=0.5):
    o = dyn(oid, label, group, 'wood', 'cyl', 0.3, '圓邊桌')
    lathe(o, [(0.001, 0), (0.14, 0), (0.15, 0.02), (0.05, 0.05), (0.04, h - 0.04), (0.2, h - 0.03), (0.2, h), (0.001, h)], x, y, 0.0, 'lacquer', color=col, seg=28)
    o.meta['mass_override'] = 3.0
    return o


def build_wing():
    WG = P['wing']
    t = WT
    y0r = WG['rooms_y0']
    east = WG['east_x']
    M = WG['master']
    doors, drawers = [], []
    # ── 地坪與天花 ──
    fl = Obj('wing_floor', '房間地坪', group='房體')
    grid_box(fl, W + t, C['x1'], C['y0'], C['y1'], -0.05, 0, 'cement', step=0.3, var=0.05, skip=('-z', '-x', '+x', '-y', '+y'), collide=False)
    FLOOR_RECTS.append((0, 0, W, D))
    for k, x0 in enumerate(WG['kid_x0']):
        grid_box(fl, x0, x0 + WG['kid_w'], y0r, D, -0.05, 0, 'floor', color='#DDD5C9', step=0.3, var=0.03, skip=('-z', '-x', '+x', '-y', '+y'), collide=False)
    grid_box(fl, M['x0'], east, M['y0'], M['y1'], -0.05, 0, 'floor', color='#D9D1C4', step=0.3, var=0.03, skip=('-z', '-x', '+x', '-y', '+y'), collide=False)
    ce = Obj('wing_ceiling', '房間天花', group='房體')
    grid_box(ce, W + t, C['x1'] + t, C['y0'] - t, C['y1'] + t, C['h'], C['h'] + 0.05, 'plaster', step=0.4, collide=False)
    for x0 in WG['kid_x0']:
        grid_box(ce, x0, x0 + WG['kid_w'], y0r, D, H, H + 0.05, 'plaster', step=0.4, collide=False)
    grid_box(ce, M['x0'], east, M['y0'], M['y1'], H, H + 0.05, 'plaster', step=0.4, collide=False)
    # 走廊與房間之間沒有做的區域（平面圖上的工作陽台一帶）：做成低於剖面的實心量體
    ms = Obj('wing_mass', '未重建區域', group='房體')
    box(ms, W + t, M['x0'] - t, 0.0, C['y0'] - t, 0.0, 2.28, 'plaster', color='#CFC6B9', collide=True)

    wl = Obj('wing_walls', '房間牆面', group='房體')
    cw = Obj('shell_corridor', '走廊（微水泥牆面）', group='房體')
    kw, kx = WG['kid_w'], WG['kid_x0']
    # 小孩房門位置：哥哥房門在東側、弟弟房鏡射在西側、妹妹房在西側
    kdoor = [(kx[0] + kw - 1.05, kx[0] + kw - 0.15), (kx[1] + 0.15, kx[1] + 1.05), (kx[2] + 0.18, kx[2] + 1.08)]
    mdoor = (9.3, 10.2)
    # 走廊北牆（小孩房南牆）、南牆（主臥北牆）、東端牆
    wall_x(cw, W + t, east + t, C['y1'], y0r, [(a, c, 0, 2.1) for a, c in kdoor], role='cement', var=0.05)
    wall_x(cw, W + t, east + t, C['y0'] - t, C['y0'], [(mdoor[0], mdoor[1], 0, 2.1)], role='cement', var=0.05)
    wall_y(cw, east, east + t, C['y0'], C['y1'], z_top=C['h'], role='cement', var=0.05)
    # 掃地機器人的家：走廊南牆底部的凹槽
    box(cw, 4.5, 4.95, C['y0'] - 0.02, C['y0'] + 0.001, 0.0, 0.13, 'black', color='#2A2927')
    # 小孩房之間的隔間、東牆、北外牆與窗
    kwin = WG['kid_window']
    wall_y(wl, kx[0] + kw, kx[1], y0r, D)
    wall_y(wl, kx[1] + kw, kx[2], y0r, D)
    wall_y(wl, east, east + t, y0r - t, D + t)
    wall_y(wl, east, east + t, M['y0'] - t, C['y0'] - t)
    opens = []
    for x0 in kx:
        cx = x0 + kw / 2
        opens.append((cx - kwin['w'] / 2, cx + kwin['w'] / 2, kwin['z0'], kwin['z1']))
    wall_x(wl, W + t, east + t, D, D + t, opens)
    # 主臥：西牆、南外牆（窗）、浴室與更衣室隔間
    mw = WG['master_window']
    wall_y(wl, M['x0'] - t, M['x0'], M['y0'] - t, C['y0'] - t)
    wall_x(wl, M['x0'] - t, east + t, M['y0'] - t, M['y0'], [(mw['x0'], mw['x1'], mw['z0'], mw['z1'])])
    bdoor = (8.05, 8.8)
    wall_x(wl, M['x0'], M['split_x'], M['bath_y1'], M['bath_y1'] + 0.1, [(bdoor[0], bdoor[1], 0, 2.05)])
    wall_y(wl, M['split_x'], M['split_x'] + 0.1, M['y0'], M['bath_y1'] + 0.1)
    for x0 in kx:
        FLOOR_RECTS.append((x0, y0r, x0 + kw, D))
    FLOOR_RECTS.append((M['x0'], M['y0'], east, M['y1']))
    FLOOR_RECTS.append((W + t, C['y0'], east, C['y1']))
    # 窗：玻璃、天光、調光捲簾與窗簾盒
    win = Obj('wing_windows', '房間窗戶與調光捲簾', group='房體')
    for x0 in kx:
        cx = x0 + kw / 2
        a, c = cx - kwin['w'] / 2, cx + kwin['w'] / 2
        box(win, a, c, D + 0.06, D + 0.08, kwin['z0'], kwin['z1'], 'glass', color='#EAF0F2')
        box(win, a, c, D + 0.09, D + 0.1, kwin['z0'], kwin['z1'], 'emit', color='#FFFFFF')
        zebra(win, a - 0.05, c + 0.05, D - 0.06, kwin['z0'] + 0.35, kwin['z1'])
        box(win, a - 0.15, c + 0.15, D - 0.18, D, H - 0.2, H, 'plaster', color='#ECE6DC')
        box(win, a - 0.1, c + 0.1, D - 0.17, D - 0.15, H - 0.2, H - 0.19, 'emit')
    a, c = mw['x0'], mw['x1']
    box(win, a, c, M['y0'] - 0.1, M['y0'] - 0.08, mw['z0'], mw['z1'], 'glass', color='#EAF0F2')
    box(win, a, c, M['y0'] - 0.13, M['y0'] - 0.12, mw['z0'], mw['z1'], 'emit', color='#FFFFFF')
    zebra(win, a - 0.05, c + 0.05, M['y0'] + 0.08, mw['z0'] + 0.5, mw['z1'])
    box(win, a - 0.2, c + 0.2, M['y0'], M['y0'] + 0.2, H - 0.22, H, 'plaster', color='#ECE6DC')
    # ── 房門 ──
    names = [('door_brother', '哥哥房門', '哥哥房'), ('door_younger', '弟弟房門', '弟弟房'), ('door_sister', '妹妹房門', '妹妹房')]
    yc = (C['y1'] + y0r) / 2
    doors.append(door(names[0][0], names[0][1], '走廊', kdoor[0][1] - 0.01, yc, -0.88, 'x', -95))
    doors.append(door(names[1][0], names[1][1], '走廊', kdoor[1][0] + 0.01, yc, 0.88, 'x', 95))
    doors.append(door(names[2][0], names[2][1], '走廊', kdoor[2][0] + 0.01, yc, 0.88, 'x', 95))
    doors.append(door('door_master', '主臥房門', '走廊', mdoor[1] - 0.01, C['y0'] - t / 2, -0.88, 'x', 95))
    doors.append(door('door_master_bath', '主臥浴室門', '主臥', bdoor[0] + 0.01, M['bath_y1'] + 0.05, 0.73, 'x', -95, z1=2.03))

    # ── 哥哥房、弟弟房（鏡射配置）──
    def kid_room(x0, mirror, grp, pre):
        X = (lambda u: x0 + kw - u) if mirror else (lambda u: x0 + u)
        xs = lambda u0, u1: (min(X(u0), X(u1)), max(X(u0), X(u1)))
        out_d, out_s = [], []
        # 衣櫃（西側，鏡射時在東側）：櫃體＋兩片滑門（內外軌）
        wd = Obj(pre + '_wardrobe', '%s衣櫃' % grp, group=grp)
        a, c = xs(0, 0.6)
        box(wd, a, c, y0r, y0r + 2.6, 0, 2.4, 'lacquer', color='#E6E0D7', collide=True)
        box(wd, a, c, y0r, y0r + 2.6, 2.4, H, 'lacquer', color='#E6E0D7')
        cl = Obj(pre + '_clothes', '%s衣櫃內的衣物' % grp, group=grp)
        clothes(cl, y0r + 0.1, y0r + 2.5, (a + c) / 2, 1.9, along='y', n=10)
        fx = X(0.6)
        s = 1 if not mirror else -1
        p1 = xs(0.6, 0.62)
        p2 = xs(0.62, 0.64)
        out_s.append(slider(pre + '_slide_0', '%s衣櫃滑門（內）' % grp, grp, p1[0], p1[1], y0r + 1.3, y0r + 2.6, 0.02, 2.38, [0, -1, 0], 1.2))
        out_s.append(slider(pre + '_slide_1', '%s衣櫃滑門（外）' % grp, grp, p2[0], p2[1], y0r + 0.02, y0r + 1.32, 0.02, 2.38, [0, 1, 0], 1.2, color='#EDE8E0'))
        # 衣櫃上方的大樑（修成圓弧）與間照
        bm_ = Obj(pre + '_beam', '%s修樑' % grp, group=grp)
        bx = xs(0, kw)
        box(bm_, bx[0], bx[1], y0r + 2.6, y0r + 3.0, 2.38, H, 'plaster', color='#ECE7DE', bevel=0.12, seg=6)
        box(bm_, bx[0] + 0.05, bx[1] - 0.05, y0r + 2.99, y0r + 3.01, 2.38, 2.4, 'emit')
        # 床：床頭靠東牆（鏡射時靠西牆），床座南側兩個抽屜
        bd = Obj(pre + '_bed', '%s床組' % grp, group=grp)
        a, c = xs(kw - 2.12, kw)
        bed(bd, a, c, y0r + 3.15, y0r + 4.65, '+x' if not mirror else '-x', colors=('#E6E0D6', '#F1ECE4', '#D9CCB8' if not mirror else '#C9CFCB'))
        hb = xs(kw - 0.08, kw)
        box(bd, hb[0], hb[1], y0r + 3.05, y0r + 4.75, 0.3, 1.15, 'fabric', color='#E2D8C9', bevel=0.06, seg=4, collide=True)
        dx = xs(kw - 1.95, kw - 0.58)
        out_d += bed_drawers(pre + '_beddrawer', '%s床座抽屜' % grp, grp, dx[0], dx[1], y0r + 3.15, 0.1, 0.28, 2, -1)
        # 窗邊平台＋坐墊
        wb = Obj(pre + '_windowseat', '%s窗邊平台' % grp, group=grp)
        a, c = xs(0.75, 2.45)
        box(wb, a, c, D - 0.5, D, 0, 0.42, 'lacquer', color='#E4DDD2', collide=True)
        box(wb, a + 0.03, c - 0.03, D - 0.47, D - 0.03, 0.42, 0.5, 'fabric', color='#D8CDBE', bevel=0.03, seg=3, collide=True)
        # 壁燈（球形）
        lp = Obj(pre + '_lamp', '%s壁燈' % grp, group=grp)
        ell(lp, X(kw - 0.06), y0r + 4.9, 1.2, 0.07, 0.07, 0.07, 'glow', seg=16, rings=8)
        props = []
        props.append(pillow(pre + '_pillow_0', '%s枕頭 1' % grp, grp, X(kw - 0.25), y0r + 3.55, 0.52, 'y'))
        props.append(pillow(pre + '_pillow_1', '%s枕頭 2' % grp, grp, X(kw - 0.25), y0r + 4.25, 0.52, 'y', col='#E0D6C8'))
        props.append(side_table(pre + '_sidetable', '%s圓邊桌' % grp, grp, X(kw - 0.3), y0r + 2.85))
        cols = ['#D8C3A8', '#C4CBBF', '#E5D5C8', '#B8A792']
        for k in range(3):
            props.append(plush(pre + '_plush_%d' % k, '%s玩偶 %d' % (grp, k + 1), grp, X(1.0 + k * 0.5), D - 0.25, 0.5, s=1.0 + 0.2 * (k % 2), col=cols[(k + (1 if mirror else 0)) % 4]))
        return out_d, out_s, props

    d1, s1, pr1 = kid_room(kx[0], False, '哥哥房', 'brother')
    d2, s2, pr2 = kid_room(kx[1], True, '弟弟房', 'younger')
    drawers += d1 + s1 + d2 + s2
    # 弟弟房：展示櫃與籃框
    grp = '弟弟房'
    x0 = kx[1]
    dc = Obj('younger_display', '弟弟房展示櫃', group=grp)
    box(dc, x0 + kw - 0.45, x0 + kw, y0r + 2.7, y0r + 3.7, 0, 0.8, 'lacquer', color='#E6E0D7', collide=True)
    box(dc, x0 + kw - 0.45, x0 + kw, y0r + 2.7, y0r + 3.7, 2.2, H, 'lacquer', color='#E6E0D7')
    for zz in (1.2, 1.6, 2.0):
        box(dc, x0 + kw - 0.42, x0 + kw, y0r + 2.73, y0r + 3.67, zz - 0.01, zz, 'glass', color='#EAF0F0', collide=True)
        box(dc, x0 + kw - 0.03, x0 + kw, y0r + 2.73, y0r + 3.67, zz + 0.01, zz + 0.012, 'emit')
    box(dc, x0 + kw - 0.44, x0 + kw, y0r + 2.7, y0r + 3.7, 0.8, 0.82, 'lacquer', color='#DDD6CB', collide=True)
    pr2.append(dyn('younger_cap', '展示櫃上的棒球帽', grp, 'fabric', 'sphere', 0.2))
    ell(OBJS[-1], x0 + kw - 0.22, y0r + 3.2, 1.26, 0.1, 0.1, 0.05, 'fabric_grey', color='#6A86A6', seg=16, rings=6)
    for k, (dy, h_, col) in enumerate(((0.2, 0.18, '#D0463C'), (0.75, 0.22, '#EFD36A'))):
        o = dyn('younger_figure_%d' % k, '收藏公仔 %d' % (k + 1), grp, 'plastic', 'box', 0.5)
        box(o, x0 + kw - 0.28, x0 + kw - 0.16, y0r + 2.7 + dy - 0.05, y0r + 2.7 + dy + 0.05, 1.6, 1.6 + h_, 'lacquer', color=col, bevel=0.02, seg=2)
        pr2.append(o)
    o = dyn('younger_box', '收藏盒', grp, 'paper', 'box', 0.4)
    box(o, x0 + kw - 0.4, x0 + kw - 0.06, y0r + 3.0, y0r + 3.4, 2.0, 2.18, 'paper', color='#E7D8B8', bevel=0.004, seg=1)
    pr2.append(o)
    # 籃框掛在衣櫃側板上方，籃球在地上
    hp = Obj('younger_hoop', '弟弟房籃框', group=grp)
    hx = x0 + kw - 0.62 - 0.3
    box(hp, x0 + kw - 0.62 - 0.02, x0 + kw - 0.6, y0r + 2.55, y0r + 2.6, 1.7, 1.72, 'steel')
    box(hp, x0 + kw - 1.05, x0 + kw - 0.62, y0r + 2.58, y0r + 2.6, 1.62, 1.95, 'lacquer', color='#F4F2EE')
    ring = [(x0 + kw - 0.83 + math.cos(a) * 0.12, y0r + 2.43 + math.sin(a) * 0.12, 1.68) for a in np.linspace(0, TAU, 25)]
    tube(hp, ring, 0.008, 'black', color='#D8552F', seg=6)
    o = dyn('younger_ball', '籃球', grp, 'plastic', 'sphere', 0.08)
    ell(o, x0 + 1.9, y0r + 1.6, 0.12, 0.12, 0.12, 0.12, 'fabric_warm', color='#D07A3C', seg=18, rings=10)
    o.meta['mass_override'] = 0.6
    pr2.append(o)

    # ── 妹妹房 ──
    grp = '妹妹房'
    x0 = kx[2]
    x1 = x0 + kw
    wd = Obj('sister_wardrobe', '妹妹房衣櫃與展示櫃', group=grp)
    box(wd, x1 - 0.6, x1, y0r, y0r + 2.0, 0, 2.4, 'lacquer', color='#E8E2D9', collide=True)
    box(wd, x1 - 0.6, x1, y0r, y0r + 2.8, 2.4, H, 'lacquer', color='#E8E2D9')
    # 展示格（燈光層板）
    box(wd, x1 - 0.45, x1, y0r + 2.0, y0r + 2.8, 0, 0.75, 'lacquer', color='#E8E2D9', collide=True)
    for zz in (1.15, 1.55, 1.95):
        box(wd, x1 - 0.42, x1, y0r + 2.02, y0r + 2.78, zz - 0.012, zz, 'lacquer', color='#EFEAE2', collide=True)
        box(wd, x1 - 0.42, x1 - 0.4, y0r + 2.04, y0r + 2.76, zz - 0.03, zz - 0.012, 'emit')
    box(wd, x1 - 0.46, x1 - 0.44, y0r + 2.0, y0r + 2.8, 0.75, 2.4, 'lacquer', color='#E8E2D9')
    cl = Obj('sister_clothes', '妹妹房衣櫃內的衣物', group=grp)
    clothes(cl, y0r + 0.1, y0r + 1.9, x1 - 0.3, 1.9, along='y', n=8, palette=('#F4E9E2', '#E9D2C9', '#F0EDE6', '#D9C7B8', '#C9B3A6'))
    # 衣櫃兩扇對開門（鉸鏈在外側）
    doors.append(door('sister_wd_0', '妹妹房衣櫃門 左', grp, x1 - 0.62, y0r + 0.02, 0.97, 'y', 95, z1=2.38, t=0.02, color='#ECE6DE', sub='衣櫃門'))
    doors.append(door('sister_wd_1', '妹妹房衣櫃門 右', grp, x1 - 0.62, y0r + 1.98, -0.97, 'y', -95, z1=2.38, t=0.02, color='#ECE6DE', sub='衣櫃門'))
    # 化妝桌：側拉抽＋燈鏡
    vn = Obj('sister_vanity', '妹妹房化妝桌', group=grp)
    box(vn, x1 - 0.5, x1, y0r + 2.9, y0r + 3.9, 0.72, 0.75, 'lacquer', color='#EDE8E0', collide=True)
    box(vn, x1 - 0.5, x1, y0r + 3.62, y0r + 3.9, 0, 0.72, 'lacquer', color='#E6E0D6', collide=True)
    box(vn, x1 - 0.03, x1, y0r + 3.0, y0r + 3.5, 1.05, 1.75, 'mirror')
    box(vn, x1 - 0.035, x1 - 0.03, y0r + 2.98, y0r + 3.52, 1.03, 1.77, 'emit')
    o = Obj('sister_sidepull', '化妝桌側拉抽', kind='drawer', group=grp, axis=[-1, 0, 0], travel=0.4, smooth=False)
    o.meta['sub'] = '側拉抽'
    box(o, x1 - 0.52, x1 - 0.5, y0r + 3.64, y0r + 3.88, 0.05, 0.7, 'lacquer', color='#EFEAE2')
    box(o, x1 - 0.5, x1 - 0.05, y0r + 3.66, y0r + 3.68, 0.07, 0.66, 'lacquer', color='#D8D2C8')
    box(o, x1 - 0.5, x1 - 0.05, y0r + 3.84, y0r + 3.86, 0.07, 0.66, 'lacquer', color='#D8D2C8')
    for zz in (0.25, 0.48):
        box(o, x1 - 0.5, x1 - 0.05, y0r + 3.66, y0r + 3.86, zz, zz + 0.01, 'lacquer', color='#D8D2C8')
    box(o, x1 - 0.535, x1 - 0.52, y0r + 3.72, y0r + 3.8, 0.55, 0.57, 'black', color='#9B8F80')
    drawers.append(o)
    # 床：床頭靠西牆，拱形軟包床頭板與雙圓壁燈
    bd = Obj('sister_bed', '妹妹房床組', group=grp)
    bed(bd, x0, x0 + 2.1, y0r + 3.0, y0r + 4.5, '-x', colors=('#E9E1D6', '#F4EFE8', '#E7D4C6'))
    arch = [(x0 + 0.001, y0r + 2.95 + 0.8 + math.cos(a) * 0.8) for a in np.linspace(0, math.pi, 1)]
    box(bd, x0, x0 + 0.07, y0r + 2.9, y0r + 4.6, 0.3, 1.25, 'fabric', color='#E3D3C2', bevel=0.07, seg=5, collide=True)
    lp = Obj('sister_lamps', '妹妹房雙圓壁燈', group=grp)
    for dy in (2.75, 4.75):
        for dz in (0, 0.2):
            cyl(lp, x0 + 0.03, y0r + dy, 1.35 + dz, 1.35 + dz + 0.001, 0.001, 'glow')
            ell(lp, x0 + 0.03, y0r + dy, 1.35 + dz, 0.02, 0.07, 0.07, 'glow', seg=16, rings=8)
    # 穿衣鏡：不規則弧形，貼在南牆門邊
    mr = Obj('sister_mirror', '妹妹房弧形穿衣鏡', group=grp)
    pts = []
    for i in range(40):
        a = TAU * i / 40
        r = 1 + 0.12 * math.sin(3 * a + 0.6) + 0.06 * math.sin(5 * a)
        pts.append((x0 + 1.75 + math.cos(a) * 0.3 * r, 1.05 + math.sin(a) * 0.72 * r))
    vs = [mr.bm.verts.new((x, y0r + 0.012, z)) for x, z in pts]
    f = mr.bm.faces.new(vs)
    mr.paint(vs, [f], 'mirror')
    vs2 = [mr.bm.verts.new((x0 + 1.75 + (x - x0 - 1.75) * 1.04, y0r + 0.006, 1.05 + (z - 1.05) * 1.03)) for x, z in pts]
    f2 = mr.bm.faces.new(list(reversed(vs2)))
    mr.paint(vs2, [f2], 'emit', color='#FFF0DC')
    # 窗簾
    cu = Obj('sister_curtain', '妹妹房窗簾', group=grp)
    cx = x0 + kw / 2
    curtain(cu, cx - 1.35, cx - 0.9, D - 0.14, 0.02, H - 0.06)
    curtain(cu, cx + 0.9, cx + 1.35, D - 0.14, 0.02, H - 0.06)
    pr3 = [pillow('sister_pillow_0', '妹妹房枕頭 1', grp, x0 + 0.25, y0r + 3.4, 0.52, 'y', col='#F0E7DE'),
           pillow('sister_pillow_1', '妹妹房枕頭 2', grp, x0 + 0.25, y0r + 4.1, 0.52, 'y', col='#E8CFC4'),
           plush('sister_plush', '妹妹房玩偶', grp, x0 + 0.6, y0r + 3.75, 0.55, s=1.3, col='#EAD9D0')]
    o = dyn('sister_stool', '化妝椅', grp, 'foam', 'cyl', 0.6)
    lathe(o, [(0.001, 0), (0.15, 0), (0.17, 0.3), (0.19, 0.44), (0.12, 0.47), (0.001, 0.47)], x1 - 0.8, y0r + 3.3, 0.0, 'fabric', color='#EFE8DF', seg=24)
    o.meta['mass_override'] = 4.0
    pr3.append(o)
    for k, (dy, col, h_) in enumerate(((3.05, '#E8C9C0', 0.12), (3.2, '#F2EEE8', 0.08), (3.75, '#D9B9A0', 0.16))):
        o = dyn('sister_bottle_%d' % k, '化妝桌上的瓶罐 %d' % (k + 1), grp, 'glass', 'cyl', 0.4)
        cyl(o, x1 - 0.3, y0r + dy, 0.75, 0.75 + h_, 0.03, 'ceramic', color=col, seg=14)
        pr3.append(o)

    # ── 主臥套房 ──
    grp = '主臥'
    sx = M['split_x']
    by1 = M['bath_y1']
    # 更衣室（開放式）：掛衣桿＋燈、抽屜櫃、玻璃展示櫃；和臥室之間是小冰柱玻璃
    cl = Obj('master_closet', '主臥開放式更衣間', group=grp)
    clothes(cl, by1 + 0.2, M['y1'] - 0.1, M['x0'] + 0.3, 1.95, along='y', n=11)
    box(cl, M['x0'], M['x0'] + 0.6, by1 + 0.1, M['y1'], 2.0, 2.05, 'lacquer', color='#EAE5DD')
    box(cl, M['x0'] + 0.56, M['x0'] + 0.6, by1 + 0.15, M['y1'] - 0.05, 1.99, 2.0, 'emit')
    box(cl, M['x0'], M['x0'] + 0.6, by1 + 0.1, M['y1'], 0, 0.2, 'lacquer', color='#EAE5DD', collide=True)
    cab_x0, cab_x1 = M['x0'] + 0.9, sx - 0.15
    box(cl, cab_x0, cab_x1, by1 + 0.1, by1 + 0.55, 0, 0.08, 'black', color='#3B3834', collide=True)
    box(cl, cab_x0, cab_x1, by1 + 0.1, by1 + 0.53, 0.08, 0.78, 'lacquer', color='#E8E2D9', collide=True)
    box(cl, cab_x0 - 0.01, cab_x1 + 0.01, by1 + 0.1, by1 + 0.56, 0.78, 0.81, 'stone', collide=True)
    n = 3
    for k in range(n):
        z0 = 0.1 + k * 0.225
        o = Obj('master_drawer_%d' % k, '更衣室抽屜櫃 %d' % (k + 1), kind='drawer', group=grp, axis=[0, 1, 0], travel=0.36, smooth=False)
        yf = by1 + 0.53
        box(o, cab_x0 + 0.01, cab_x1 - 0.01, yf, yf + 0.02, z0, z0 + 0.21, 'lacquer', color='#EDE8E0', bevel=0.002, seg=1)
        box(o, cab_x0 + 0.03, cab_x1 - 0.03, yf - 0.4, yf, z0 + 0.01, z0 + 0.022, 'lacquer', color='#D6D0C6')
        box(o, cab_x0 + 0.03, cab_x0 + 0.042, yf - 0.4, yf, z0 + 0.01, z0 + 0.18, 'lacquer', color='#D6D0C6')
        box(o, cab_x1 - 0.042, cab_x1 - 0.03, yf - 0.4, yf, z0 + 0.01, z0 + 0.18, 'lacquer', color='#D6D0C6')
        box(o, (cab_x0 + cab_x1) / 2 - 0.1, (cab_x0 + cab_x1) / 2 + 0.1, yf + 0.02, yf + 0.028, z0 + 0.17, z0 + 0.185, 'black', color='#8A857D')
        drawers.append(o)
    # 玻璃展示櫃（北牆，放包包）
    gc = Obj('master_display', '主臥玻璃展示櫃', group=grp)
    gx0, gx1 = M['x0'] + 0.9, sx - 0.15
    box(gc, gx0, gx1, M['y1'] - 0.42, M['y1'], 0, 0.85, 'lacquer', color='#E8E2D9', collide=True)
    box(gc, gx0, gx1, M['y1'] - 0.42, M['y1'], 2.25, H, 'lacquer', color='#E8E2D9')
    for zz in (1.3, 1.78):
        box(gc, gx0 + 0.02, gx1 - 0.02, M['y1'] - 0.4, M['y1'], zz - 0.01, zz, 'glass', color='#EAF0F0', collide=True)
    box(gc, gx0, gx1, M['y1'] - 0.42, M['y1'] - 0.41, 0.85, 2.25, 'glass', color='#F2F5F5')
    box(gc, gx0 + 0.02, gx1 - 0.02, M['y1'] - 0.04, M['y1'] - 0.02, 0.87, 2.23, 'emit', color='#FFF3E4')
    box(gc, gx0 - 0.01, gx1 + 0.01, M['y1'] - 0.43, M['y1'], 0.85, 0.87, 'stone', collide=True)
    prm = []
    for k, (xx, zz, col) in enumerate(((0.35, 0.87, '#8C6A4E'), (1.05, 1.3, '#E2D7C6'), (0.6, 1.78, '#2F2C29'))):
        o = dyn('master_bag_%d' % k, '展示櫃裡的包 %d' % (k + 1), grp, 'fabric', 'box', 0.25, '皮革包，內部中空')
        bx0 = gx0 + xx
        box(o, bx0, bx0 + 0.3, M['y1'] - 0.3, M['y1'] - 0.14, zz, zz + 0.22, 'cloth', color=col, bevel=0.03, seg=3)
        tube(o, [(bx0 + 0.07, M['y1'] - 0.22, zz + 0.22), (bx0 + 0.15, M['y1'] - 0.22, zz + 0.33), (bx0 + 0.23, M['y1'] - 0.22, zz + 0.22)], 0.008, 'cloth', color=col, seg=6)
        o.meta['mass_override'] = 0.9
        prm.append(o)
    # 小冰柱玻璃隔屏（更衣室／臥室之間）
    ice = Obj('master_iceglass', '小冰柱玻璃隔屏', group=grp)
    box(ice, sx, sx + 0.04, by1 + 0.1, by1 + 0.95, 0, 2.3, 'glass', color='#E9EEEF', collide=True)
    for k in range(18):
        yy = by1 + 0.12 + k * 0.045
        box(ice, sx - 0.004, sx + 0.044, yy, yy + 0.012, 0, 2.3, 'glass', color='#F4F7F7')
    box(ice, sx, sx + 0.04, by1 + 0.1, by1 + 0.95, 2.3, 2.34, 'steel', color='#B8B4AC')
    # 浴室：鏡櫃（兩扇門）、檯面盆、馬桶、淋浴玻璃
    bt = Obj('master_bath', '主臥浴室', group=grp)
    box(bt, M['x0'], M['x0'] + 0.55, M['y0'] + 0.25, M['y0'] + 1.3, 0.2, 0.85, 'lacquer', color='#DDD6CB', collide=True)
    box(bt, M['x0'], M['x0'] + 0.56, M['y0'] + 0.23, M['y0'] + 1.32, 0.85, 0.88, 'stone', collide=True)
    ell(bt, M['x0'] + 0.3, M['y0'] + 0.78, 0.9, 0.18, 0.26, 0.05, 'ceramic', seg=24, rings=8)
    box(bt, M['x0'], M['x0'] + 0.14, M['y0'] + 0.35, M['y0'] + 1.2, 1.1, 1.9, 'lacquer', color='#E6E0D7', collide=True)
    box(bt, M['x0'] + 0.13, M['x0'] + 0.145, M['y0'] + 0.35, M['y0'] + 1.2, 1.08, 1.1, 'emit')
    lathe(bt, [(0.001, 0), (0.14, 0), (0.18, 0.2), (0.21, 0.38), (0.19, 0.4), (0.001, 0.4)], 7.55, by1 - 0.3, 0.0, 'ceramic', seg=24, sy=1.25)
    box(bt, 7.35, 7.75, by1 - 0.12, by1, 0.35, 0.8, 'ceramic', color='#F1EFEB', bevel=0.02, seg=2, collide=True)
    bt.collide(7.35, 7.75, by1 - 0.55, by1, 0, 0.4)
    box(bt, 8.0, sx, M['y0'], M['y0'] + 0.9, 0, 0.04, 'stone', color='#D2CCC2')
    box(bt, 8.0, 8.02, M['y0'], M['y0'] + 0.9, 0, 2.0, 'glass', color='#EEF3F3', collide=True)
    tube(bt, [(8.6, M['y0'] + 0.05, 2.0), (8.6, M['y0'] + 0.3, 2.0)], 0.012, 'steel', seg=8)
    cyl(bt, 8.6, M['y0'] + 0.3, 1.98, 2.0, 0.1, 'steel', seg=16)
    bt.smooth = False
    doors.append(door('master_mirror_0', '鏡櫃門 左', grp, M['x0'] + 0.15, M['y0'] + 0.35, 0.42, 'y', -95, z1=1.9, t=0.02, color='#E6E0D7', sub='鏡櫃門'))
    doors.append(door('master_mirror_1', '鏡櫃門 右', grp, M['x0'] + 0.15, M['y0'] + 1.2, -0.42, 'y', 95, z1=1.9, t=0.02, color='#E6E0D7', sub='鏡櫃門'))
    for dd in doors[-2:]:
        for v in dd.bm.verts:
            if v.co.z < 1.1:
                v.co.z = 1.1
    # 臥室：床頭靠東牆，長低櫃沿窗，L 型圓弧天花燈帶
    bd = Obj('master_bed', '主臥床組', group=grp)
    by_ = (M['y0'] + M['y1']) / 2
    bed(bd, east - 2.2, east - 0.1, by_ - 0.9, by_ + 0.9, '+x', colors=('#E3DCD1', '#F2EEE7', '#CFC3B2'))
    box(bd, east - 0.12, east, by_ - 1.05, by_ + 1.05, 0.3, 1.3, 'fabric', color='#DCD2C4', bevel=0.06, seg=4, collide=True)
    lc = Obj('master_lowcab', '主臥窗邊長低櫃', group=grp)
    box(lc, sx + 0.25, east - 2.4, M['y0'], M['y0'] + 0.42, 0, 0.45, 'lacquer', color='#E6E0D6', collide=True)
    box(lc, sx + 0.25, east - 2.4, M['y0'], M['y0'] + 0.44, 0.45, 0.48, 'travertine', collide=True)
    art = Obj('master_art', '主臥壁畫', group=grp)
    box(art, sx + 0.1, sx + 0.13, by1 + 1.0, M['y1'] - 0.12, 1.0, 2.0, 'travertine', color='#D9CFBF', bevel=0.005, seg=1)
    for k in range(9):
        yy = by1 + 1.08 + k * 0.06
        box(art, sx + 0.13, sx + 0.15, yy, yy + 0.02, 1.08, 1.92, 'wood', color='#B8A68C')
    cv = Obj('master_cove', '主臥圓弧天花燈帶', group=grp)
    box(cv, sx + 0.1, east, M['y1'] - 0.45, M['y1'], H - 0.22, H, 'plaster', color='#ECE7DE', bevel=0.12, seg=6)
    box(cv, east - 0.45, east, M['y0'], M['y1'] - 0.45, H - 0.22, H, 'plaster', color='#ECE7DE', bevel=0.12, seg=6)
    box(cv, sx + 0.1, east - 0.45, M['y1'] - 0.47, M['y1'] - 0.45, H - 0.2, H - 0.18, 'emit')
    box(cv, east - 0.47, east - 0.45, M['y0'] + 0.1, M['y1'] - 0.45, H - 0.2, H - 0.18, 'emit')
    cu = Obj('master_curtain', '主臥窗簾', group=grp)
    curtain(cu, mw['x0'] - 0.45, mw['x0'] - 0.05, M['y0'] + 0.18, 0.02, H - 0.1)
    curtain(cu, mw['x1'] + 0.05, mw['x1'] + 0.45, M['y0'] + 0.18, 0.02, H - 0.1)
    prm += [pillow('master_pillow_0', '主臥枕頭 1', grp, east - 0.3, by_ - 0.45, 0.52, 'y'),
            pillow('master_pillow_1', '主臥枕頭 2', grp, east - 0.3, by_ + 0.45, 0.52, 'y'),
            pillow('master_pillow_2', '主臥抱枕', grp, east - 0.5, by_, 0.52, 'y', col='#C9A391', size=(0.42, 0.12, 0.28))]
    prm.append(side_table('master_side_0', '主臥床邊几 1', grp, east - 0.3, by_ - 1.3, col='#DDD3C4'))
    prm.append(side_table('master_side_1', '主臥床邊几 2', grp, east - 0.3, by_ + 1.3, col='#DDD3C4'))
    o = dyn('master_vase', '長低櫃上的花瓶', grp, 'ceramic', 'cyl', 0.2)
    lathe(o, [(0.001, 0), (0.06, 0), (0.09, 0.12), (0.05, 0.28), (0.03, 0.32), (0.001, 0.32)], sx + 0.8, M['y0'] + 0.22, 0.48, 'ceramic', color='#E3DBCF', seg=20)
    for k, (dx, dy) in enumerate(((0.04, 0.02), (-0.05, 0.03), (0.01, -0.05))):
        tube(o, [(sx + 0.8, M['y0'] + 0.22, 0.78), (sx + 0.8 + dx, M['y0'] + 0.22 + dy, 1.2)], [0.005, 0.002], 'wood', color='#5E5244', seg=5)
    prm.append(o)
    o = dyn('master_books', '長低櫃上的書', grp, 'paper', 'box', 1.0)
    box(o, sx + 1.4, sx + 1.7, M['y0'] + 0.1, M['y0'] + 0.32, 0.48, 0.53, 'paper', color='#D9CFBF', bevel=0.003, seg=1)
    prm.append(o)

    # ── 收邊：踢腳板、門框、開關插座面板、線型出風口 ──
    trim_all(kdoor, mdoor, bdoor, y0r, east, M)
    return doors, drawers


def trim_all(kdoor, mdoor, bdoor, y0r, east, M):
    t = WT
    tr = Obj('trim', '收邊（踢腳板、門框、面板）', group='房體')
    BH, BT, BC = 0.07, 0.012, '#E1DAD0'
    dz = P['entry_door']
    kw, kx = P['wing']['kid_w'], P['wing']['kid_x0']
    # 每個空間的四面牆與開口（開口處不做踢腳板）：(x0, y0, x1, y1, {邊: [(a0, a1)]})
    rooms = [
        (0, 0, W, D, {'-y': [(dz['x0'], dz['x1'])], '+y': [(WIN['x0'], WIN['x1'])], '+x': [(C['y0'], C['y1'])]}),
        (W + t, C['y0'], east, C['y1'], {'-x': [(C['y0'], C['y1'])], '+y': list(kdoor), '-y': [mdoor]}),
        (M['x0'], M['y0'], east, M['y1'], {'+y': [mdoor]}),
    ]
    for k, x0 in enumerate(kx):
        rooms.append((x0, y0r, x0 + kw, D, {'-y': [kdoor[k]]}))

    def run(a, b_, gaps):
        segs, s = [], a
        for g0, g1 in sorted(gaps):
            if g1 <= a or g0 >= b_:
                continue
            if g0 > s:
                segs.append((s, g0))
            s = max(s, g1)
        if s < b_:
            segs.append((s, b_))
        return segs

    for (x0, y0, x1, y1, gaps) in rooms:
        for (a, c) in run(x0, x1, gaps.get('-y', [])):
            box(tr, a, c, y0, y0 + BT, 0, BH, 'lacquer', BC)
        for (a, c) in run(x0, x1, gaps.get('+y', [])):
            box(tr, a, c, y1 - BT, y1, 0, BH, 'lacquer', BC)
        for (a, c) in run(y0, y1, gaps.get('-x', [])):
            box(tr, x0, x0 + BT, a, c, 0, BH, 'lacquer', BC)
        for (a, c) in run(y0, y1, gaps.get('+x', [])):
            box(tr, x1 - BT, x1, a, c, 0, BH, 'lacquer', BC)

    # 門框：開口兩面各一圈（兩側立框＋上框）
    FC, FW, FT = '#E4DED5', 0.055, 0.012

    def frame_y(a0, a1, yface, s, h=2.1):
        box(tr, a0 - FW, a0, yface, yface + s * FT, 0, h + FW, 'lacquer', FC, bevel=0.003, seg=1)
        box(tr, a1, a1 + FW, yface, yface + s * FT, 0, h + FW, 'lacquer', FC, bevel=0.003, seg=1)
        box(tr, a0 - FW, a1 + FW, yface, yface + s * FT, h, h + FW, 'lacquer', FC, bevel=0.003, seg=1)
        box(tr, a0, a1, min(yface, yface - s * 0.14), max(yface, yface - s * 0.14), h - 0.004, h, 'lacquer', FC)
        box(tr, a0 - 0.004, a0, min(yface, yface - s * 0.14), max(yface, yface - s * 0.14), 0, h, 'lacquer', FC)
        box(tr, a1, a1 + 0.004, min(yface, yface - s * 0.14), max(yface, yface - s * 0.14), 0, h, 'lacquer', FC)

    for (a0, a1) in kdoor:
        frame_y(a0, a1, C['y1'], -1)
        frame_y(a0, a1, y0r, 1)
    frame_y(mdoor[0], mdoor[1], C['y0'], 1)
    frame_y(mdoor[0], mdoor[1], M['y1'], -1)
    frame_y(bdoor[0], bdoor[1], M['bath_y1'] + 0.1, 1, h=2.05)
    frame_y(dz['x0'], dz['x1'], 0.0, 1, h=dz['h'])

    # 開關（1.15 m）與插座（0.3 m）
    for (a0, a1) in kdoor:
        plate(tr, a1 + 0.16, y0r, 1.15, 0.08, 0.12, '+y')
        plate(tr, a0 + 0.4, D, 0.3, 0.08, 0.08, '-y')
    plate(tr, mdoor[0] - 0.16, M['y1'], 1.15, 0.08, 0.12, '-y')
    plate(tr, dz['x1'] + 0.16, 0.0, 1.15, 0.08, 0.12, '+y')
    plate(tr, W, C['y0'] - 0.25, 1.15, 0.08, 0.12, '-x')
    plate(tr, 0.0, TW['plat_y0'] - 0.2, 0.3, 0.08, 0.08, '+x')
    plate(tr, W, 6.0, 0.3, 0.08, 0.08, '-x')
    plate(tr, 1.3, 0.0, 1.15, 0.12, 0.12, '+y', color='#E9E6E0')  # 對講機旁的空調控制面板
    # 線型出風口：客廳電視牆側的降板、每間小孩房衣櫃上方
    ac = Obj('ac_slots', '線型出風口', group='房體')
    zb = 2.53
    box(ac, 0.58, 0.64, TW['plat_y0'] + 0.2, TW['plat_y1'] - 0.2, zb - 0.002, zb, 'black', color='#2B2927')
    for sgn in range(6):
        yy = TW['plat_y0'] + 0.25 + sgn * (TW['plat_y1'] - TW['plat_y0'] - 0.5) / 5
        box(ac, 0.58, 0.64, yy, yy + 0.004, zb - 0.003, zb - 0.002, 'lacquer', color='#D8D2C8')
    for x0 in kx:
        box(ac, x0 + 0.4, x0 + kw - 0.4, y0r + 2.66, y0r + 2.72, 2.379, 2.381, 'black', color='#2B2927')


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
    for fs, ref in o.orient:
        for f in fs:
            if f.is_valid and f.normal.dot(f.calc_center_median() - ref) < 0:
                f.normal_flip()
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

    build_shell()
    build_ceiling()
    shoe_doors = build_entry()
    drawers = build_kitchen()
    shelf_tops = build_living()
    props = build_props(shelf_tops)
    wing_doors, wing_drawers = build_wing()
    room_doors = wing_doors
    drawers = drawers + wing_drawers

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

    records = make_records()
    anim = host_route()
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


def make_records():
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
        if o.meta.get('sub'):
            r['sub'] = o.meta['sub']
        if o.kind == 'door':
            r.update(hinge=o.meta['hinge'], open_deg=o.meta['open_deg'])
        if o.kind == 'drawer':
            r.update(axis=o.meta['axis'], travel=o.meta['travel'])
        if o.kind == 'person':
            r.update(parent=o.meta.get('parent'), person=o.meta['person'])
        for b in o.boxes:
            statics.append({'id': o.id, 'box': b})
        recs.append(r)
    area = sum((x1 - x0) * (y1 - y0) for x0, y0, x1, y1 in FLOOR_RECTS)
    return {'version': P['version'], 'units': 'm, 平面座標 x 東 y 北 z 上', 'objects': recs, 'static_boxes': statics, 'area_m2': round(area, 1),
            'floors': [[round(v, 3) for v in r] for r in FLOOR_RECTS],
            'room': {'w': W, 'd': D, 'h': H}, 'corridor': C}


# ── 主持人動線：各站位由分鏡推估 ──
def stations():
    feet = {}
    for fr in CAMS['frames']:
        feet.update(fr.get('people', {}))
    a_live = feet.get('host_a', (2.0, 8.9))
    b_live = feet.get('host_b', (2.75, 9.35))
    cy = (C['y0'] + C['y1']) / 2
    WG = P['wing']
    kx, kw, y0r = WG['kid_x0'], WG['kid_w'], WG['rooms_y0']
    bro_door = kx[0] + kw - 0.6
    sis_door = kx[2] + 0.63
    m_door = 9.75
    # 公共區（上集）→ 走廊 → 哥哥房 → 主臥 → 妹妹房（下集）→ 回玄關，90 秒一圈
    A = [((0.95, 0.55), 0.0), ((0.8, 1.9), 3.5), ((1.35, 2.85), 7.0), ((1.35, 2.85), 15.0), ((2.0, 5.2), 19.0), (tuple(a_live), 23.0), (tuple(a_live), 32.0),
         ((3.4, cy), 36.0), ((bro_door, cy - 0.15), 39.0), ((bro_door, y0r + 0.6), 40.5), ((kx[0] + 1.3, y0r + 1.4), 42.5), ((kx[0] + 1.3, y0r + 1.4), 49.0),
         ((bro_door, y0r + 0.6), 51.0), ((bro_door, cy), 52.5), ((m_door, cy), 55.0), ((m_door, 3.1), 56.5), ((10.6, 2.3), 58.0), ((10.6, 2.3), 64.0),
         ((m_door, 3.1), 65.5), ((m_door, cy), 67.0), ((sis_door, cy), 68.5), ((sis_door, y0r + 0.6), 70.0), ((kx[2] + 1.2, y0r + 1.6), 72.0), ((kx[2] + 1.2, y0r + 1.6), 77.0),
         ((sis_door, y0r + 0.6), 79.0), ((sis_door, cy), 80.5), ((3.4, cy), 85.0), ((1.2, 3.1), 87.5), ((0.95, 0.55), 90.0)]
    Bp = [((1.3, 0.75), 0.0), ((1.6, 0.86), 1.5), ((3.2, 0.86), 4.5), ((3.2, 0.86), 13.0), ((1.5, 0.86), 15.2), ((1.2, 3.35), 17.5), ((2.6, 4.8), 20.0), (tuple(b_live), 23.5), (tuple(b_live), 32.0),
          ((3.4, cy + 0.3), 37.0), ((bro_door + 0.2, cy + 0.2), 40.0), ((bro_door + 0.1, y0r + 0.7), 41.5), ((kx[0] + 2.0, y0r + 1.1), 43.5), ((kx[0] + 2.0, y0r + 1.1), 49.5),
          ((bro_door + 0.1, y0r + 0.7), 51.5), ((bro_door, cy + 0.2), 53.0), ((m_door + 0.2, cy), 55.5), ((m_door, 3.0), 57.0), ((11.4, 2.7), 58.5), ((11.4, 2.7), 64.0),
          ((m_door, 3.0), 66.0), ((m_door + 0.3, cy), 67.5), ((sis_door + 0.2, cy + 0.2), 69.0), ((sis_door + 0.1, y0r + 0.7), 70.5), ((kx[2] + 1.9, y0r + 1.2), 72.5), ((kx[2] + 1.9, y0r + 1.2), 77.5),
          ((sis_door + 0.1, y0r + 0.7), 79.5), ((sis_door, cy + 0.2), 81.0), ((3.4, cy + 0.2), 85.5), ((1.15, 3.35), 88.0), ((1.3, 0.75), 90.0)]
    return {'host_a': A, 'host_b': Bp}


LOOK = {  # 停下時面向的方向（度，0 = 東、90 = 北），依時間生效
    'host_a': [(0, 90), (7.0, 0.0), (19, 90), (23, 70), (42, 60), (58, 0), (72, 60), (85, 270)],
    'host_b': [(0, 90), (5.0, 270), (20, 90), (23.5, 110), (43, 120), (58, 180), (72, 120), (85, 270)],
}
HEIGHT = {'host_a': 1.74, 'host_b': 1.62}


def host_route():
    """主持人動線：站位、停下時的朝向與身高（網頁與 .blend 用同一份）"""
    return {'fps': 24, 'duration': 90.0, 'stations': stations(), 'look': LOOK, 'height': HEIGHT}


def host_pose(pid, t, st):
    """回傳 (位置, 朝向角 β, 是否在走, 走過的距離)；β 是繞 z 軸的角度，靜止時角色面向 -y"""
    path = st[pid]
    if t >= path[-1][1]:
        pos, moving = path[-1][0], False
    else:
        k = max(i for i in range(len(path)) if path[i][1] <= t + 1e-6)
        (p0, t0), (p1, t1) = path[k], path[k + 1]
        u = (t - t0) / max(1e-6, t1 - t0)
        u = u * u * (3 - 2 * u)
        pos = (p0[0] + (p1[0] - p0[0]) * u, p0[1] + (p1[1] - p0[1]) * u)
        moving = math.hypot(p1[0] - p0[0], p1[1] - p0[1]) > 0.05
    return pos, moving


def keyframe_hosts(route):
    """.blend：匯入 people.glb，沿同一條動線替骨架打關鍵影格（與網頁的走路週期相同）"""
    sc = bpy.context.scene
    path = os.path.join(HERE, 'people.glb')
    if not os.path.exists(path):
        print('people.glb missing, skip hosts')
        return
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    new = [o for o in bpy.data.objects if o not in before]
    col = bpy.data.collections.new('主持人')
    sc.collection.children.link(col)
    for o in new:
        for c in list(o.users_collection):
            c.objects.unlink(o)
        col.objects.link(o)
    fps = route['fps']
    st = route['stations']
    for pid, rig_name in (('host_a', 'HostA_Rig'), ('host_b', 'HostB_Rig')):
        rig = bpy.data.objects.get(rig_name)
        if not rig:
            continue
        root = bpy.data.objects.new(pid + '_root', None)
        col.objects.link(root)
        rig.parent = root
        rig.location = (0, 0, 0)
        rig.rotation_euler = (0, 0, 0)
        hgt = HEIGHT[pid]
        phase = 0.0 if pid == 'host_a' else 1.3
        rest = {pb.name: pb.bone.matrix_local.to_3x3() for pb in rig.pose.bones}
        for pb in rig.pose.bones:
            pb.rotation_mode = 'QUATERNION'
        prev, dist = None, 0.0
        for fi in range(0, int(route['duration'] * fps) + 1, 2):
            t = fi / fps
            pos, moving = host_pose(pid, t, st)
            if prev is not None:
                dist += math.hypot(pos[0] - prev[0], pos[1] - prev[1])
            vx, vy = (pos[0] - prev[0], pos[1] - prev[1]) if prev else (0, 0)
            prev = pos
            if moving and math.hypot(vx, vy) > 1e-4:
                beta = math.atan2(vx, -vy)
            else:
                ls = LOOK[pid]
                th = math.radians(ls[max(i for i in range(len(ls)) if ls[i][0] <= t + 1e-6)][1])
                beta = math.atan2(math.cos(th), -math.sin(th))
            root.location = (pos[0], pos[1], 0)
            root.rotation_euler = (0, 0, beta)
            root.keyframe_insert('location', frame=fi + 1)
            root.keyframe_insert('rotation_euler', frame=fi + 1)
            for name, (rx, ry, rz) in walk_rot(t, dist, moving, hgt, phase).items():
                pb = rig.pose.bones.get(name)
                if not pb:
                    continue
                R = (Matrix.Rotation(rz, 3, 'Y') @ Matrix.Rotation(ry, 3, 'Z') @ Matrix.Rotation(rx, 3, 'X'))  # three 的 x/y/z → Blender 的 x/z/y
                Rl = rest[name].inverted() @ R @ rest[name]
                pb.rotation_quaternion = Rl.to_quaternion()
                pb.keyframe_insert('rotation_quaternion', frame=fi + 1)


def walk_rot(t, dist, moving, hgt, phase):
    """three 座標的關節角（弧度）：x = 前後擺、y = 扭轉、z = 側舉；網頁版 walkPose() 與此相同"""
    cyc = dist / (0.62 * hgt / 1.7) * math.pi + phase
    amp = 1.0 if moving else 0.0
    talk = 0.0 if moving else math.sin(t * 2.1 + phase) * 0.5 + 0.5
    sw = math.sin(cyc) * 0.42 * amp
    return {
        'thighL': (-sw, 0, 0), 'thighR': (sw, 0, 0),
        'shinL': (max(0, math.sin(cyc + 1.2)) * 0.62 * amp, 0, 0), 'shinR': (max(0, math.sin(cyc + 1.2 + math.pi)) * 0.62 * amp, 0, 0),
        'upL': (sw * 0.7 - talk * 0.15, 0, 0.06), 'upR': (-sw * 0.7 - talk * 0.75, 0, -0.06 - talk * 0.18),
        'foreL': (-0.18 - talk * 0.25, 0, 0), 'foreR': (-0.2 - talk * 1.0 * (0.6 + 0.4 * math.sin(t * 4.3 + phase)), 0, 0),
        'torso': (0.02, math.sin(cyc) * 0.07 * amp, 0), 'head': (0.05 * math.sin(t * 0.9 + phase), 0.25 * math.sin(t * 0.37 + phase) * (1 - amp), 0),
        'hips': (0, -math.sin(cyc) * 0.05 * amp, 0),
    }


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
              (290, 320, (lamp.x + 0.2, lamp.y + 0.12, 1.1), (lamp.x - 0.8, lamp.y - 0.5, 1.1)),
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
    keyframe_hosts(host_route())
    sc.frame_end = max(sc.frame_end, int(host_route()['duration'] * host_route()['fps']) + 1)
    sc.frame_set(1)


main()
