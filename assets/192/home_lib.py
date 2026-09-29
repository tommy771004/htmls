# 192 我的家：建模共用工具（複製自 assets/191/build_scene.py 的零件函式，作品之間不互相匯入）
# 座標：Blender 世界座標 = 平面座標（x 東、y 北、z 上）。材質名稱就是材質角色，頂點色 = 底色 × 烘焙的環境光遮蔽。
import bpy, bmesh, math
import numpy as np
from mathutils import Vector, Matrix, noise

TAU = math.pi * 2

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


def tube(o, pts, r, role, color=None, seg=8, var=0.0, flat=1.0):
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
        rings.append([bm.verts.new(p + (n * math.cos(TAU * i / seg) * flat + b * math.sin(TAU * i / seg)) * rr[k]) for i in range(seg)])
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
