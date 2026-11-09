"""Platform module (collection "Platform") for 279 DUSK PLATFORM.

Owns: platform body + side walls with the dark refuge recess under the coping, coping stones, floor (tile_floor,
world-aligned UV), white safety line, yellow tactile strips with the inner line bar (real dome geometry for
y = -4.2 .. 28.2, flat blocks beyond whose domes come from the tactile_yellow bump), drain gratings, access hatches,
expansion joints, car-position floor marks, the glass elevator shaft behind column 3, the stairwell (y 44 .. 59.6)
with flights, handrails, low walls and windbreak glass, benches + recycling bins beyond y = 60 and the far platform end.

Owned materials (built here, not in materials.py): "platform_mark_paint" (worn floor paint, colour = Object Color),
"platform_seat" (moulded plastic, colour = Object Color), "platform_grating" (worn galvanized drain bars with
foot-polished tops), "platform_sump" (damp grey concrete under the gratings).
"""

import bpy, bmesh, math
from mathutils import Vector
import common as C

COLL = "Platform"

# ------------------------------------------------------------------------------------------------ layout (x>0 side)
X = C.PLAT_X                                   # 4.60 platform edge (coping lip)
XW = X - C.EDGE_OVERHANG                       # 4.40 platform wall face under the coping
XC = X - C.COPING_W                            # 4.30 inner edge of the coping
XT0, XT1 = X - C.TACTILE[1], X - C.TACTILE[0]  # 3.50 .. 3.80 dot blocks
XB0 = XT0 - 0.05                               # 3.45 .. 3.50 inner line bar (内方線); 3.45 is a tile grid line
XL0, XL1 = X - C.WHITE_LINE[1], X - C.WHITE_LINE[0]   # 4.08 .. 4.18 white safety line
Y0, Y1 = C.PLAT_Y0, C.PLAT_Y1
T = C.TILE
FLOOR_Z0 = -0.03                               # floor tiles are 30 mm boxes on the slab
SLAB_Z = -0.32                                 # slab underside
XR = 3.70                                      # refuge recess back wall
ZR = -1.30                                     # refuge recess floor (about ballast top)

NEAR_Y0, NEAR_N = -4.2, 108                    # tactile blocks with real domes: y -4.2 .. 28.2
FAR_Y0, FAR_N = NEAR_Y0 + NEAR_N * T, 472      # 28.2 .. 169.8
BACK_Y0, BACK_N = -39.9, 119                   # -39.9 .. -4.2

# elevator (glass shaft behind column 3 at y=36)
EV_X = 1.15
EV_Y0, EV_Y1 = 37.0, 39.6
EV_TOP = 3.70

# stairwell
SW_X = 1.75                                    # outer face of the low side walls
SW_IN = 1.55                                   # inner face of the side walls
SP_X = 0.30                                    # half width of the central spine wall (column 4 stands on it)
SW_Y0, SW_Y1 = 44.0, 59.6                      # floor opening
ST_Y0 = 44.3                                   # top nosing
RISE, TREAD = 0.16, 0.30
N1, N2 = 18, 10                                # risers in flight 1 / flight 2
LANDING = 1.5
LOW_Z = -(N1 + N2) * RISE                      # -4.48 underpass floor
WALL_H = 1.10                                  # low wall height above the platform
GLASS_Y0 = 46.0

BENCH_Y = [66.0, 90.0, 114.0, 138.0]
BIN_Y = [72.45, 120.45, 156.45]
END_FENCE_Y = 169.55

DRAIN_Y = [6.0 + 24.0 * k for k in range(7)]   # drain gratings x 2.85..3.15 (both sides)
SUMP_Z = -0.016                                # sump floor under the gratings (shallow so bounce light reaches it)
GRATE_Z0 = -0.014                              # underside of the grating bars
HATCHES = [(-2.55, -1.95, 8.7, 9.3), (1.95, 2.55, 25.2, 25.8)]
JOINT_Y = [18.0, 90.0, 162.0]
MARK_Y_MIN = 8.0                               # no door marks within ~4 m of the end of the dolly (camera y=3)
QUEUE_W = 0.09                                 # queue line width
QUEUE_RGB = (0.13, 0.31, 0.29)                 # faded blue-green floor paint


def _c():
    return C.coll(COLL)


# ================================================================================================= geometry helpers
def g_cbox(x0, x1, y0, y1, z0, z1, ch=0.003, bottom=True):
    """Box with the four top edges chamfered by ch."""
    x0, x1 = min(x0, x1), max(x0, x1)
    y0, y1 = min(y0, y1), max(y0, y1)
    z0, z1 = min(z0, z1), max(z0, z1)
    ch = min(ch, (x1 - x0) * 0.45, (y1 - y0) * 0.45, (z1 - z0) * 0.9)
    zm = z1 - ch
    v = [(x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0),
         (x0, y0, zm), (x1, y0, zm), (x1, y1, zm), (x0, y1, zm),
         (x0 + ch, y0 + ch, z1), (x1 - ch, y0 + ch, z1), (x1 - ch, y1 - ch, z1), (x0 + ch, y1 - ch, z1)]
    f = [(0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7),
         (4, 5, 9, 8), (5, 6, 10, 9), (6, 7, 11, 10), (7, 4, 8, 11), (8, 9, 10, 11)]
    if bottom:
        f.append((0, 3, 2, 1))
    return v, f


def g_box(x0, x1, y0, y1, z0, z1):
    return C.box_geo(min(x0, x1), max(x0, x1), min(y0, y1), max(y0, y1), min(z0, z1), max(z0, z1))


def g_frustum(b, t, z0, z1):
    """Bottom rect b=(x0,x1,y0,y1) at z0, top rect t at z1; no bottom face."""
    v = [(b[0], b[2], z0), (b[1], b[2], z0), (b[1], b[3], z0), (b[0], b[3], z0),
         (t[0], t[2], z1), (t[1], t[2], z1), (t[1], t[3], z1), (t[0], t[3], z1)]
    f = [(4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]
    return v, f


def g_prof_y(pts, y0, y1):
    """Extrude a closed (x, z) profile along +Y from y0 to y1 (closed solid, outward normals)."""
    area = sum(pts[i][0] * pts[(i + 1) % len(pts)][1] - pts[(i + 1) % len(pts)][0] * pts[i][1] for i in range(len(pts)))
    if area < 0:
        pts = list(reversed(pts))          # CCW in (x, z)
    n = len(pts)
    v = [(x, y0, z) for x, z in pts] + [(x, y1, z) for x, z in pts]
    f = [(i, n + i, n + (i + 1) % n, (i + 1) % n) for i in range(n)]
    f.append(tuple(range(n)))                          # y0 cap faces -Y (CCW seen from -Y)
    f.append(tuple(n + i for i in reversed(range(n))))  # y1 cap faces +Y
    return v, f


def g_prof_x(pts, x0, x1):
    """Extrude a closed (y, z) profile along +X."""
    area = sum(pts[i][0] * pts[(i + 1) % len(pts)][1] - pts[(i + 1) % len(pts)][0] * pts[i][1] for i in range(len(pts)))
    if area < 0:
        pts = list(reversed(pts))          # CCW in (y, z): normal of that plane is +X
    n = len(pts)
    v = [(x0, y, z) for y, z in pts] + [(x1, y, z) for y, z in pts]
    f = [(i, (i + 1) % n, n + (i + 1) % n, n + i) for i in range(n)]
    f.append(tuple(reversed(range(n))))              # x0 cap faces -X
    f.append(tuple(n + i for i in range(n)))          # x1 cap faces +X
    return v, f


def g_tube(path, r, seg=10, caps=True):
    """Round tube along a polyline (rings use the averaged tangent, mitre-scaled)."""
    P = [Vector(p) for p in path]
    v, f = [], []
    m = len(P)
    for i, p in enumerate(P):
        if i == 0:
            t = (P[1] - P[0]).normalized(); k = 1.0
        elif i == m - 1:
            t = (P[-1] - P[-2]).normalized(); k = 1.0
        else:
            a = (P[i] - P[i - 1]).normalized(); b = (P[i + 1] - P[i]).normalized()
            t = (a + b).normalized()
            k = 1.0 / max(0.5, a.dot(t))
        ref = Vector((0, 0, 1)) if abs(t.z) < 0.9 else Vector((1, 0, 0))
        u = t.cross(ref).normalized(); w = t.cross(u).normalized()
        for s in range(seg):
            an = 2 * math.pi * s / seg
            # stretch the ring only along the bend direction (w lies in the bend plane for planar paths)
            v.append(tuple(p + u * (math.cos(an) * r) + w * (math.sin(an) * r * k)))
    for i in range(m - 1):
        for s in range(seg):
            s2 = (s + 1) % seg
            f.append((i * seg + s, i * seg + s2, (i + 1) * seg + s2, (i + 1) * seg + s))
    if caps:
        f.append(tuple(reversed(range(seg))))
        f.append(tuple((m - 1) * seg + s for s in range(seg)))
    return v, f


def g_cyl(p0, p1, r, seg=10, cap=True):
    return C.cyl_geo(p0, p1, r, seg, cap)


def g_dome(cx, cy, z, seg=10):
    """Truncated dome of a tactile dot: 22 mm base, ~11 mm flat top, 5 mm high."""
    prof = [(0.011, 0.0), (0.0097, 0.0026), (0.0075, 0.0043), (0.0045, 0.0050)]
    v, f = [], []
    for r, h in prof:
        for s in range(seg):
            a = 2 * math.pi * s / seg
            v.append((cx + r * math.cos(a), cy + r * math.sin(a), z + h))
    for j in range(len(prof) - 1):
        for s in range(seg):
            s2 = (s + 1) % seg
            f.append((j * seg + s, j * seg + s2, (j + 1) * seg + s2, (j + 1) * seg + s))
    top = len(prof) - 1
    f.append(tuple(top * seg + s for s in range(seg)))
    return v, f


def mirror_x(geo):
    v, f = geo
    return [(-x, y, z) for x, y, z in v], [tuple(reversed(q)) for q in f]


def add(B, geo, key, both=False):
    B.add(geo[0], geo[1], key)
    if both:
        m = mirror_x(geo)
        B.add(m[0], m[1], key)


def rect_sub(rects, hole):
    hx0, hx1, hy0, hy1 = hole
    out = []
    for r in rects:
        x0, x1, y0, y1 = r
        if hx0 >= x1 or hx1 <= x0 or hy0 >= y1 or hy1 <= y0:
            out.append(r); continue
        if hx0 > x0: out.append((x0, hx0, y0, y1))
        if hx1 < x1: out.append((hx1, x1, y0, y1))
        ix0, ix1 = max(x0, hx0), min(x1, hx1)
        if hy0 > y0: out.append((ix0, ix1, y0, hy0))
        if hy1 < y1: out.append((ix0, ix1, hy1, y1))
    return out


def tile_uv(ob):
    """World-aligned metre UVs (object sits at the origin): u = x + 0.15 so u is a 0.30 m grid line wherever the
    tile_floor grid (tiles centred on x=0, rows from y=0) has one; v = y. Side faces use (y, z) / (x, z)."""
    me = ob.data
    bm = bmesh.new(); bm.from_mesh(me)
    uv = bm.loops.layers.uv.get("UVMap") or bm.loops.layers.uv.new("UVMap")
    for f in bm.faces:
        n = f.normal
        ax = max(range(3), key=lambda i: abs(n[i]))
        for l in f.loops:
            x, y, z = l.vert.co
            if ax == 2:
                l[uv].uv = (x + 0.15, y)
            elif ax == 0:
                l[uv].uv = (y, z)
            else:
                l[uv].uv = (x + 0.15, z)
    bm.to_mesh(me); bm.free()


def new_ob(name, me, loc=(0, 0, 0), c=None):
    ob = bpy.data.objects.new(name, me)
    ob.location = loc
    (c or _c()).objects.link(ob)
    return ob


def array_y(ob, count, step):
    m = ob.modifiers.new("Array", "ARRAY")
    m.use_relative_offset = False
    m.use_constant_offset = True
    m.constant_offset_displace = (0.0, step, 0.0)
    m.count = count
    m.use_merge_vertices = False
    return m


def array_x(ob, count, step):
    m = array_y(ob, count, step)
    m.constant_offset_displace = (step, 0.0, 0.0)
    return m


def _purge_orphans():
    for me in list(bpy.data.meshes):
        if me.users == 0 and me.name.startswith("plat_"):
            bpy.data.meshes.remove(me)


# ================================================================================================= owned materials
def _mat_mark_paint():
    m, nodes, links, out = C.new_material("platform_mark_paint")
    oi = nodes.new("ShaderNodeObjectInfo")
    tc = nodes.new("ShaderNodeTexCoord")
    # wear mask: large blotches + fine scuffs (world space so it differs mark to mark)
    n1 = nodes.new("ShaderNodeTexNoise"); n1.inputs["Scale"].default_value = 6.0
    n1.inputs["Detail"].default_value = 8.0; n1.inputs["Roughness"].default_value = 0.62
    links.new(tc.outputs["Object"], n1.inputs["Vector"])
    r1 = nodes.new("ShaderNodeValToRGB")
    r1.color_ramp.elements[0].position = 0.28; r1.color_ramp.elements[0].color = (0, 0, 0, 1)
    r1.color_ramp.elements[1].position = 0.42; r1.color_ramp.elements[1].color = (1, 1, 1, 1)
    links.new(n1.outputs["Fac"], r1.inputs["Fac"])
    n2 = nodes.new("ShaderNodeTexNoise"); n2.inputs["Scale"].default_value = 60.0
    n2.inputs["Detail"].default_value = 4.0
    links.new(tc.outputs["Object"], n2.inputs["Vector"])
    r2 = nodes.new("ShaderNodeValToRGB")
    r2.color_ramp.elements[0].position = 0.30; r2.color_ramp.elements[0].color = (0.25, 0.25, 0.25, 1)
    r2.color_ramp.elements[1].position = 0.42; r2.color_ramp.elements[1].color = (1, 1, 1, 1)
    links.new(n2.outputs["Fac"], r2.inputs["Fac"])
    cov = nodes.new("ShaderNodeMath"); cov.operation = "MULTIPLY"
    links.new(r1.outputs["Color"], cov.inputs[0]); links.new(r2.outputs["Color"], cov.inputs[1])
    # colour: object colour, dirtied
    dn = nodes.new("ShaderNodeTexNoise"); dn.inputs["Scale"].default_value = 2.5
    links.new(tc.outputs["Object"], dn.inputs["Vector"])
    mix = nodes.new("ShaderNodeMix"); mix.data_type = "RGBA"; mix.blend_type = "MULTIPLY"
    mix.inputs["Factor"].default_value = 0.55
    links.new(oi.outputs["Color"], mix.inputs["A"]); links.new(dn.outputs["Color"], mix.inputs["B"])
    bs = nodes.new("ShaderNodeBsdfPrincipled")
    links.new(mix.outputs["Result"], bs.inputs["Base Color"])
    bs.inputs["Roughness"].default_value = 0.58
    tr = nodes.new("ShaderNodeBsdfTransparent")
    ms = nodes.new("ShaderNodeMixShader")
    links.new(cov.outputs["Value"], ms.inputs["Fac"])
    links.new(tr.outputs["BSDF"], ms.inputs[1]); links.new(bs.outputs["BSDF"], ms.inputs[2])
    links.new(ms.outputs["Shader"], out.inputs["Surface"])
    m.diffuse_color = (0.3, 0.5, 0.4, 1)
    return m


def _mat_seat():
    m, nodes, links, out = C.new_material("platform_seat")
    oi = nodes.new("ShaderNodeObjectInfo")
    tc = nodes.new("ShaderNodeTexCoord")
    dn = nodes.new("ShaderNodeTexNoise"); dn.inputs["Scale"].default_value = 9.0; dn.inputs["Detail"].default_value = 6.0
    links.new(tc.outputs["Object"], dn.inputs["Vector"])
    mix = nodes.new("ShaderNodeMix"); mix.data_type = "RGBA"; mix.blend_type = "MULTIPLY"
    mix.inputs["Factor"].default_value = 0.25
    links.new(oi.outputs["Color"], mix.inputs["A"]); links.new(dn.outputs["Color"], mix.inputs["B"])
    bs = nodes.new("ShaderNodeBsdfPrincipled")
    links.new(mix.outputs["Result"], bs.inputs["Base Color"])
    rr = nodes.new("ShaderNodeMapRange")
    rr.inputs["To Min"].default_value = 0.28; rr.inputs["To Max"].default_value = 0.5
    links.new(dn.outputs["Fac"], rr.inputs["Value"])
    links.new(rr.outputs["Result"], bs.inputs["Roughness"])
    bs.inputs["Coat Weight"].default_value = 0.15
    links.new(bs.outputs["BSDF"], out.inputs["Surface"])
    m.diffuse_color = (0.08, 0.16, 0.3, 1)
    return m


def _mat_grating():
    """Worn galvanized / cast-iron grating bars: mid grey, foot-polished bright top faces, grime in the sides."""
    m, nodes, links, out = C.new_material("platform_grating")
    tc = nodes.new("ShaderNodeTexCoord")
    geo = nodes.new("ShaderNodeNewGeometry")
    sep = nodes.new("ShaderNodeSeparateXYZ")
    links.new(geo.outputs["Normal"], sep.inputs["Vector"])
    top = nodes.new("ShaderNodeMapRange")                      # 1 on the walked-on top faces, 0 on the sides
    top.inputs["From Min"].default_value = 0.80; top.inputs["From Max"].default_value = 0.97
    links.new(sep.outputs["Z"], top.inputs["Value"])
    dn = nodes.new("ShaderNodeTexNoise"); dn.inputs["Scale"].default_value = 40.0; dn.inputs["Detail"].default_value = 6.0
    links.new(tc.outputs["Object"], dn.inputs["Vector"])
    side = nodes.new("ShaderNodeMix"); side.data_type = "RGBA"
    side.inputs["A"].default_value = (0.20, 0.20, 0.19, 1); side.inputs["B"].default_value = (0.30, 0.29, 0.27, 1)
    links.new(dn.outputs["Fac"], side.inputs["Factor"])
    col = nodes.new("ShaderNodeMix"); col.data_type = "RGBA"
    links.new(top.outputs["Result"], col.inputs["Factor"])
    links.new(side.outputs["Result"], col.inputs["A"]); col.inputs["B"].default_value = (0.40, 0.40, 0.385, 1)
    rough = nodes.new("ShaderNodeMapRange")
    rough.inputs["To Min"].default_value = 0.66; rough.inputs["To Max"].default_value = 0.42
    links.new(top.outputs["Result"], rough.inputs["Value"])
    met = nodes.new("ShaderNodeMapRange")
    met.inputs["To Min"].default_value = 0.2; met.inputs["To Max"].default_value = 0.6
    links.new(top.outputs["Result"], met.inputs["Value"])
    bs = nodes.new("ShaderNodeBsdfPrincipled")
    links.new(col.outputs["Result"], bs.inputs["Base Color"])
    links.new(rough.outputs["Result"], bs.inputs["Roughness"])
    links.new(met.outputs["Result"], bs.inputs["Metallic"])
    links.new(bs.outputs["BSDF"], out.inputs["Surface"])
    m.diffuse_color = (0.45, 0.45, 0.44, 1)
    return m


def _mat_sump():
    """Damp mid-grey concrete at the bottom of the drain channel (slightly glossy so it catches the canopy lights)."""
    m, nodes, links, out = C.new_material("platform_sump")
    tc = nodes.new("ShaderNodeTexCoord")
    dn = nodes.new("ShaderNodeTexNoise"); dn.inputs["Scale"].default_value = 25.0; dn.inputs["Detail"].default_value = 5.0
    links.new(tc.outputs["Object"], dn.inputs["Vector"])
    col = nodes.new("ShaderNodeMix"); col.data_type = "RGBA"
    col.inputs["A"].default_value = (0.15, 0.145, 0.135, 1); col.inputs["B"].default_value = (0.24, 0.235, 0.22, 1)
    links.new(dn.outputs["Fac"], col.inputs["Factor"])
    bs = nodes.new("ShaderNodeBsdfPrincipled")
    links.new(col.outputs["Result"], bs.inputs["Base Color"])
    bs.inputs["Roughness"].default_value = 0.32
    links.new(bs.outputs["BSDF"], out.inputs["Surface"])
    m.diffuse_color = (0.30, 0.29, 0.27, 1)
    return m


# ================================================================================================= 1. body, walls, coping
def step_body():
    c = C.coll(COLL, fresh=True)
    _purge_orphans()
    B = C.Builder()
    # slab under the floor tiles (opening for the stairwell)
    for r in rect_sub([(-XW, XW, Y0, Y1)], (-SW_X, SW_X, SW_Y0, SW_Y1)):
        add(B, g_box(r[0], r[1], r[2], r[3], SLAB_Z, FLOOR_Z0), "concrete")
    # refuge recess: back wall, floor curb, piers every 3 m (both sides)
    add(B, g_box(XR - 0.15, XR, Y0, Y1, ZR, SLAB_Z), "concrete_dark", both=True)
    add(B, g_cbox(XR - 0.15, XW, Y0, Y1, -1.65, ZR, 0.01), "concrete", both=True)
    y = Y0 + 1.5
    while y < Y1 - 1.0:
        add(B, g_cbox(XR, XW, y - 0.15, y + 0.15, ZR, SLAB_Z, 0.008, bottom=False), "concrete", both=True)
        y += 3.0
    # platform ends
    add(B, g_box(-XW, XW, Y0 - 0.25, Y0, -1.65, 0.0), "concrete")
    add(B, g_box(-XW, XW, Y1, Y1 + 0.25, -1.65, 0.0), "concrete")
    add(B, g_box(-X, X, Y1 + 0.25, Y1 + 0.40, -1.65, 0.05), "concrete_dark")
    body = B.build("plat_body", c)
    C.smooth_by_angle(body, 30)

    # coping stones: 0.9 m units, rounded track-side arris, 3 mm joints over a recessed mortar bed
    prof = [(XC + 0.002, -0.18), (X, -0.18), (X, -0.016), (X - 0.002, -0.0065), (X - 0.0065, -0.0018),
            (X - 0.014, 0.0), (XC + 0.004, 0.0), (XC + 0.002, -0.002)]
    B = C.Builder()
    y = Y0
    while y < Y1 - 1e-6:
        ye = min(Y1, y + 0.9)
        add(B, g_prof_y(prof, y + 0.0015, ye - 0.0015), "coping", both=True)
        y = ye
    cop = B.build("plat_coping", c)
    C.smooth_by_angle(cop, 28)
    B = C.Builder()
    add(B, g_box(XC + 0.006, X - 0.006, Y0, Y1, -0.17, -0.007), "concrete_dark", both=True)
    B.build("plat_coping_bed", c)


# ================================================================================================= 2. floor + white line
def _floor_holes():
    holes = [(-SW_X, SW_X, SW_Y0, SW_Y1)]
    for y in DRAIN_Y:
        holes += [(2.85, 3.15, y, y + 0.6), (-3.15, -2.85, y, y + 0.6)]
    holes += [(h[0], h[1], h[2], h[3]) for h in HATCHES]
    # tactile insets: in front of each stair flight and the elevator door
    holes += [(0.5, 1.4, 43.5, 43.8), (-1.4, -0.5, 43.5, 43.8), (-0.45, 0.45, 39.9, 40.2)]
    return holes


def step_floor():
    c = _c()
    rects = [(-XB0, 0.0, Y0, Y1), (0.0, XB0, Y0, Y1), (XT1, XC, Y0, Y1), (-XC, -XT1, Y0, Y1)]
    for h in _floor_holes():
        rects = rect_sub(rects, h)
    B = C.Builder()
    for r in rects:
        add(B, g_box(r[0], r[1], r[2], r[3], FLOOR_Z0, 0.0), "tile_floor")
    # hatch lids (tiled infill, same world grid) inside a 20 mm stainless frame
    for x0, x1, y0, y1 in HATCHES:
        add(B, g_cbox(x0 + 0.023, x1 - 0.023, y0 + 0.023, y1 - 0.023, FLOOR_Z0, -0.0005, 0.0015), "tile_floor")
    fl = B.build("plat_floor", c)
    tile_uv(fl)

    # white safety line: painted strip 2 mm proud, softly rounded
    B = C.Builder()
    add(B, g_cbox(XL0, XL1, Y0 + 0.05, Y1 - 0.05, -0.004, 0.002, 0.0015), "line_white", both=True)
    B.build("plat_white_line", c)


# ================================================================================================= 3. tactile strips
def _dot_block_mesh(name, domes):
    B = C.Builder()
    add(B, g_cbox(0.002, 0.298, 0.002, 0.298, -0.02, 0.0, 0.0018, bottom=False), "tactile_yellow")
    if domes:
        for i in range(5):
            for j in range(5):
                add(B, g_dome(0.03 + 0.06 * i, 0.03 + 0.06 * j, 0.0), "tactile_yellow")
    ob = B.build(name, _c())
    C.smooth_by_angle(ob, 50)
    me = ob.data
    bpy.data.objects.remove(ob)
    return me


def _bar_block_mesh(name):
    B = C.Builder()
    w = XT0 - XB0                                      # 0.05
    add(B, g_cbox(0.002, w - 0.002, 0.002, 0.298, -0.02, 0.0, 0.0018, bottom=False), "tactile_yellow")
    cx = w / 2
    add(B, g_frustum((cx - 0.0135, cx + 0.0135, 0.02, 0.28), (cx - 0.0085, cx + 0.0085, 0.026, 0.274), 0.0, 0.005),
        "tactile_yellow")
    ob = B.build(name, _c())
    C.smooth_by_angle(ob, 50)
    me = ob.data
    bpy.data.objects.remove(ob)
    return me


def step_tactile():
    c = _c()
    near = _dot_block_mesh("plat_tactile_dome_block", True)
    flat = _dot_block_mesh("plat_tactile_flat_block", False)
    bar = _bar_block_mesh("plat_tactile_bar_block")
    for side, sx in (("R", 1), ("L", -1)):
        bx = XT0 if sx > 0 else -XT1
        ob = new_ob("plat_tactile_near_" + side, near, (bx, NEAR_Y0, 0.0), c); array_y(ob, NEAR_N, T)
        ob["tactile_geo"] = 1.0
        ob = new_ob("plat_tactile_far_" + side, flat, (bx, FAR_Y0, 0.0), c); array_y(ob, FAR_N, T)
        ob = new_ob("plat_tactile_back_" + side, flat, (bx, BACK_Y0, 0.0), c); array_y(ob, BACK_N, T)
        lx = XB0 if sx > 0 else -XT0
        ob = new_ob("plat_tactile_bar_" + side, bar, (lx, BACK_Y0, 0.0), c)
        array_y(ob, round((Y1 - 0.2 - BACK_Y0) / T), T)
        ob["tactile_geo"] = 1.0
    # insets in front of the stair flights and the elevator door (real domes)
    for name, x0, y0, n in (("stairR", 0.5, 43.5, 3), ("stairL", -1.4, 43.5, 3), ("lift", -0.45, 39.9, 3)):
        ob = new_ob("plat_tactile_" + name, near, (x0, y0, 0.0), c); array_x(ob, n, T)
        ob["tactile_geo"] = 1.0
    # mortar bed under all blocks (shows in the 4 mm joints)
    B = C.Builder()
    add(B, g_box(XB0, XT1, Y0, Y1, FLOOR_Z0, -0.004), "concrete_dark", both=True)
    for x0, x1, y0, y1 in ((0.5, 1.4, 43.5, 43.8), (-1.4, -0.5, 43.5, 43.8), (-0.45, 0.45, 39.9, 40.2)):
        add(B, g_box(x0, x1, y0, y1, FLOOR_Z0, -0.004), "concrete_dark")
    B.build("plat_tactile_bed", c)


# ================================================================================================= 4. floor details
def _door_marks():
    ys = []
    for k in range(8):
        for d in (0.0, 4.8, 9.6, 14.4):
            ys.append(2.6 + 20.0 * k + d)
    ok = []
    for y in ys:
        if y < MARK_Y_MIN:
            continue
        if any(abs(y - (dy + 0.3)) < 1.1 for dy in DRAIN_Y):
            continue
        if SW_Y0 - 1.0 < y < SW_Y1 + 0.5 or EV_Y0 - 1.0 < y < EV_Y1 + 1.0:
            continue
        ok.append(y)
    return ok


def step_details():
    c = _c()
    _mat_mark_paint(); _mat_grating(); _mat_sump()
    # drain gratings: stainless frame, worn galvanized bars (bright foot-polished tops), damp grey sump 15 mm down
    S = C.Builder(); D = C.Builder(); K = C.Builder(); G = C.Builder()
    for y in DRAIN_Y:
        x0, x1, y0, y1 = 2.85, 3.15, y, y + 0.6
        for gx0, gx1, gy0, gy1 in ((x0, x1, y0, y0 + 0.02), (x0, x1, y1 - 0.02, y1),
                                   (x0, x0 + 0.02, y0 + 0.02, y1 - 0.02), (x1 - 0.02, x1, y0 + 0.02, y1 - 0.02)):
            add(S, g_cbox(gx0, gx1, gy0, gy1, FLOOR_Z0, 0.0, 0.0012), "stainless", both=True)
        yy = y0 + 0.035
        while yy < y1 - 0.03:
            add(G, g_cbox(x0 + 0.02, x1 - 0.02, yy - 0.005, yy + 0.005, GRATE_Z0, -0.0015, 0.0012), "platform_grating",
                both=True)
            yy += 0.022
        for xx in (x0 + 0.1, x0 + 0.2):
            add(G, g_box(xx - 0.004, xx + 0.004, y0 + 0.02, y1 - 0.02, GRATE_Z0 - 0.001, -0.006), "platform_grating",
                both=True)
        add(K, g_box(x0 + 0.02, x1 - 0.02, y0 + 0.02, y1 - 0.02, FLOOR_Z0, SUMP_Z), "platform_sump", both=True)
    # hatch frames + lifting-key plugs
    for x0, x1, y0, y1 in HATCHES:
        for gx0, gx1, gy0, gy1 in ((x0, x1, y0, y0 + 0.02), (x0, x1, y1 - 0.02, y1),
                                   (x0, x0 + 0.02, y0 + 0.02, y1 - 0.02), (x1 - 0.02, x1, y0 + 0.02, y1 - 0.02)):
            add(S, g_cbox(gx0, gx1, gy0, gy1, FLOOR_Z0, 0.0, 0.0012), "stainless")
        add(S, g_cbox(x0 + 0.003 + 0.02, x1 - 0.003 - 0.02, y0 + 0.003 + 0.02, y0 + 0.023, FLOOR_Z0, -0.0008, 0.0006),
            "stainless")
        for kx in (x0 + 0.12, x1 - 0.12):
            add(D, g_cyl((kx, (y0 + y1) / 2, -0.006), (kx, (y0 + y1) / 2, -0.0003), 0.011, 12), "plastic_black")
    # expansion joints: stainless cover plates 60 mm, 3 mm proud, across the walkable bands
    for y in JOINT_Y:
        for x0, x1 in ((-XB0, XB0), (XT1, XC)):
            if x0 > 0:
                add(S, g_cbox(x0, x1, y - 0.03, y + 0.03, -0.004, 0.003, 0.0015), "stainless", both=True)
            else:
                add(S, g_cbox(x0, x1, y - 0.03, y + 0.03, -0.004, 0.003, 0.0015), "stainless")
        for xs in [k * 0.6 - 4.2 for k in range(15)]:  # countersunk screws along the plate centre line
            if abs(abs(xs) - (XT0 + XT1) / 2) > 0.25:
                add(D, g_cyl((xs, y, 0.0025), (xs, y, 0.0034), 0.006, 10), "steel_dark")
    so = S.build("plat_floor_steel", c); C.smooth_by_angle(so, 50)
    do = D.build("plat_floor_fixings", c); C.smooth_by_angle(do, 50)
    go = G.build("plat_floor_grating", c); C.smooth_by_angle(go, 50)
    K.build("plat_floor_sumps", c)

    # car-position floor marks: boarding triangle between the tactile strip and the white line + two queue lines
    M = C.Builder(); Q = C.Builder()
    for y in _door_marks():
        tri = [(XT1 + 0.04, y - 0.14, 0.0), (XT1 + 0.25, y, 0.0), (XT1 + 0.04, y + 0.14, 0.0)]
        n = len(tri)
        v = [(x, yy, -0.002) for x, yy, _ in tri] + [(x, yy, 0.002) for x, yy, _ in tri]
        f = [(2, 1, 0), (3, 4, 5), (0, 1, 4, 3), (1, 2, 5, 4), (2, 0, 3, 5)]
        add(M, (v, f), "platform_mark_paint", both=True)
        for dy in (-0.62, 0.62):
            add(Q, g_cbox(2.15, 3.30, y + dy - QUEUE_W / 2, y + dy + QUEUE_W / 2, -0.003, 0.002, 0.001),
                "platform_mark_paint", both=True)
        # short head bar closing the queue box on the tactile side
        add(Q, g_cbox(3.30 - QUEUE_W, 3.30, y - 0.62 + QUEUE_W / 2, y + 0.62 - QUEUE_W / 2, -0.003, 0.002, 0.001),
            "platform_mark_paint", both=True)
    tri = M.build("plat_mark_triangles", c); tri.color = (0.85, 0.42, 0.08, 1.0)
    q = Q.build("plat_mark_queue", c); q.color = (*QUEUE_RGB, 1.0)


# ================================================================================================= 5. elevator shaft
def step_elevator():
    c = _c()
    F = C.Builder()      # painted steel frame
    G = C.Builder()      # glass
    S = C.Builder()      # stainless
    K = C.Builder()      # dark parts
    x0, x1, y0, y1 = -EV_X, EV_X, EV_Y0, EV_Y1
    p = 0.12
    zg0, zg1 = 0.15, 3.20
    # corner posts
    for px, py in ((x0, y0), (x1 - p, y0), (x0, y1 - p), (x1 - p, y1 - p)):
        add(F, g_cbox(px, px + p, py, py + p, 0.0, EV_TOP, 0.004), "steel_dark")
    # mid mullions: one on each long side, one on the camera face
    for my in ((y0 + y1) / 2,):
        add(F, g_cbox(x0, x0 + 0.08, my - 0.04, my + 0.04, zg0, zg1, 0.003), "steel_dark")
        add(F, g_cbox(x1 - 0.08, x1, my - 0.04, my + 0.04, zg0, zg1, 0.003), "steel_dark")
    add(F, g_cbox(-0.04, 0.04, y0, y0 + 0.08, zg0, zg1, 0.003), "steel_dark")
    # transoms at 2.40 and glass head 3.20, head band (machine room) 3.20..3.70 with cap
    for zt in (2.36,):
        add(F, g_box(x0 + p, x1 - p, y0, y0 + 0.08, zt, zt + 0.08), "steel_dark")
        add(F, g_box(x0, x0 + 0.08, y0 + p, y1 - p, zt, zt + 0.08), "steel_dark")
        add(F, g_box(x1 - 0.08, x1, y0 + p, y1 - p, zt, zt + 0.08), "steel_dark")
    add(F, g_cbox(x0 - 0.01, x1 + 0.01, y0 - 0.01, y1 + 0.01, zg1, EV_TOP, 0.006), "steel_dark")
    add(F, g_cbox(x0 - 0.04, x1 + 0.04, y0 - 0.04, y1 + 0.04, EV_TOP, EV_TOP + 0.06, 0.01), "steel_dark")
    # stainless kick band
    add(S, g_cbox(x0 - 0.005, x1 + 0.005, y0 - 0.005, y1 + 0.005, 0.0, zg0, 0.003), "stainless")
    # glass panes (12 mm) in the frame planes
    gt = 0.006
    gz = [(zg0, 2.36), (2.44, zg1)]
    for za, zb in gz:
        for ga, gb in ((x0 + p, -0.04), (0.04, x1 - p)):                      # camera face (y0)
            add(G, g_box(ga, gb, y0 + 0.04 - gt, y0 + 0.04 + gt, za, zb), "glass")
        for ga, gb in (((y0 + p, (y0 + y1) / 2 - 0.04), ((y0 + y1) / 2 + 0.04, y1 - p))):
            add(G, g_box(x0 + 0.04 - gt, x0 + 0.04 + gt, ga, gb, za, zb), "glass")
            add(G, g_box(x1 - 0.04 - gt, x1 - 0.04 + gt, ga, gb, za, zb), "glass")
        # door face (y1): glass beside the door, and the transom light over it
        for ga, gb in ((x0 + p, -0.58), (0.58, x1 - p)):
            add(G, g_box(ga, gb, y1 - 0.04 - gt, y1 - 0.04 + gt, za, zb), "glass")
    add(G, g_box(-0.58, 0.58, y1 - 0.04 - gt, y1 - 0.04 + gt, 2.44, zg1), "glass")
    # landing door: stainless jambs + head, two leaves with narrow vision panels, sill, call panel
    for ja, jb in ((-0.58, -0.47), (0.47, 0.58)):
        add(S, g_cbox(ja, jb, y1 - 0.10, y1 + 0.02, 0.0, 2.36, 0.004), "stainless")
    add(S, g_cbox(-0.58, 0.58, y1 - 0.10, y1 + 0.02, 2.12, 2.36, 0.004), "stainless")
    for la, lb in ((-0.47, -0.002), (0.002, 0.47)):
        add(S, g_box(la, lb, y1 - 0.06, y1 - 0.03, 0.0, 2.12), "stainless")
        cx = (la + lb) / 2
        add(G, g_box(cx - 0.05, cx + 0.05, y1 - 0.031, y1 - 0.025, 0.9, 1.9), "glass")
    add(S, g_box(-0.62, 0.62, y1 - 0.06, y1 + 0.10, -0.004, 0.003), "stainless")
    add(S, g_cbox(0.66, 0.78, y1 + 0.0, y1 + 0.025, 0.95, 1.30, 0.004), "stainless")
    for bz in (1.05, 1.17):
        add(K, g_cyl((0.72, y1 + 0.024, bz), (0.72, y1 + 0.034, bz), 0.016, 14), "plastic_black")
    # cab parked at the platform: glass back (toward camera), stainless sides, lit ceiling
    cx0, cx1, cy0, cy1 = -0.92, 0.92, y0 + 0.20, y1 - 0.22
    add(S, g_box(cx0, cx1, cy0, cy1, 0.0, 0.06), "stainless")
    add(K, g_box(cx0 + 0.02, cx1 - 0.02, cy0 + 0.02, cy1 - 0.02, 0.06, 0.065), "plastic_black")
    add(S, g_cbox(cx0, cx1, cy0, cy1, 2.25, 2.45, 0.004), "stainless")
    for sx0, sx1 in ((cx0, cx0 + 0.03), (cx1 - 0.03, cx1)):
        add(S, g_box(sx0, sx1, cy0, cy1, 0.06, 2.25), "stainless")
    for fx in (cx0, cx1 - 0.05):
        add(S, g_box(fx, fx + 0.05, cy0, cy0 + 0.05, 0.06, 2.25), "stainless")
    add(S, g_box(cx0, cx1, cy0, cy0 + 0.05, 0.06, 0.35), "stainless")
    add(S, g_box(cx0, cx1, cy0, cy0 + 0.05, 2.10, 2.25), "stainless")
    add(G, g_box(cx0 + 0.05, cx1 - 0.05, cy0 + 0.02, cy0 + 0.03, 0.35, 2.10), "glass")
    add(S, g_tube([(cx0 + 0.1, cy0 + 0.11, 0.9), (cx1 - 0.1, cy0 + 0.11, 0.9)], 0.018, 12), "stainless")
    for hx in (cx0 + 0.1, cx1 - 0.1):
        add(S, g_cyl((hx, cy0 + 0.05, 0.9), (hx, cy0 + 0.11, 0.9), 0.01, 8), "stainless")
    add(S, g_box(cx0, cx1, cy1 - 0.04, cy1, 0.06, 2.25), "stainless")              # cab door (closed)
    # guide rails, ropes, counterweight frame
    for gx in (-1.0, 0.96):
        add(K, g_box(gx, gx + 0.04, (y0 + y1) / 2 - 0.03, (y0 + y1) / 2 + 0.03, 0.0, zg1), "steel_dark")
    for rx in (-0.06, -0.02, 0.02, 0.06):
        add(K, g_cyl((rx, (y0 + y1) / 2, 2.45), (rx, (y0 + y1) / 2, zg1), 0.005, 6), "steel_dark")
    fo = F.build("plat_lift_frame", c); C.smooth_by_angle(fo, 30)
    G.build("plat_lift_glass", c)
    so = S.build("plat_lift_stainless", c); C.smooth_by_angle(so, 40)
    K.build("plat_lift_dark", c)
    # cab ceiling light panel (emissive, facing down)
    L = C.Builder()
    L.add([(cx0 + 0.15, cy0 + 0.25, 2.245), (cx0 + 0.15, cy1 - 0.25, 2.245),
           (cx1 - 0.15, cy1 - 0.25, 2.245), (cx1 - 0.15, cy0 + 0.25, 2.245)], [(0, 1, 2, 3)], "light_tube")
    L.build("plat_lift_light", c)


# ================================================================================================= 6. stairwell
def _rail_path(h):
    """(y, z) points of a handrail centre line h above the nosing line, both flights + landing."""
    s = RISE / TREAD
    yl0 = ST_Y0 + (N1 - 1) * TREAD               # last nosing of flight 1 (49.4)
    zl = -N1 * RISE                              # landing (-2.88)
    yl1 = yl0 + LANDING                          # first nosing of flight 2 (50.9)
    y_a = ST_Y0 + N1 * RISE / s                  # slope meets landing rail height (49.7)
    y_b = yl1 + (N2 * RISE) / s                  # slope meets the lower floor rail height
    return [(SW_Y0 + 0.08, h), (ST_Y0, h), (y_a, zl + h), (yl1, zl + h), (y_b, LOW_Z + h), (y_b + 0.30, LOW_Z + h)]


def step_stairs():
    c = _c()
    W = C.Builder()      # concrete walls
    TR = C.Builder()     # treads (tile)
    S = C.Builder()      # stainless
    K = C.Builder()      # dark rubber
    G = C.Builder()      # glass
    F = C.Builder()      # painted steel
    bot = LOW_Z - 0.12
    # side walls (full height, platform level + 1.10) and spine, end wall above the underpass
    add(W, g_cbox(SW_IN, SW_X, SW_Y0, SW_Y1, bot, WALL_H, 0.01), "concrete", both=True)
    add(W, g_cbox(-SP_X, SP_X, SW_Y0, SW_Y1 - 0.2, bot, WALL_H, 0.01), "concrete")
    add(W, g_cbox(-SW_X, SW_X, SW_Y1 - 0.2, SW_Y1, SLAB_Z - 0.25, WALL_H, 0.01), "concrete")
    # underpass beyond the stair: walls, floor, end wall
    add(W, g_box(SW_IN, SW_X + 0.3, SW_Y1, SW_Y1 + 6.0, bot, SLAB_Z), "concrete", both=True)
    add(W, g_box(-SW_X, SW_X, SW_Y1 + 6.0, SW_Y1 + 6.3, bot, SLAB_Z), "concrete_dark")
    # wall caps (stainless) on the low walls
    add(S, g_cbox(SW_IN - 0.02, SW_X + 0.02, SW_Y0 - 0.02, SW_Y1 + 0.02, WALL_H, WALL_H + 0.03, 0.006), "stainless", both=True)
    add(S, g_cbox(-SP_X - 0.02, SP_X + 0.02, SW_Y0 - 0.02, SW_Y1 - 0.2, WALL_H, WALL_H + 0.03, 0.006), "stainless")
    add(S, g_cbox(-SW_IN, SW_IN, SW_Y1 - 0.22, SW_Y1 + 0.02, WALL_H, WALL_H + 0.03, 0.006), "stainless")

    # flights: tread boxes with stainless nosings and dark anti-slip inserts
    def flight(xa, xb):
        z_top = 0.0
        # platform-level top tread (fills the opening in front of the first nosing)
        steps = [(SW_Y0, ST_Y0, 0.0)]
        y = ST_Y0
        for i in range(1, N1):
            steps.append((y, y + TREAD, -i * RISE)); y += TREAD
        steps.append((y, y + LANDING, -N1 * RISE)); y += LANDING
        for j in range(1, N2):
            steps.append((y, y + TREAD, -(N1 + j) * RISE)); y += TREAD
        steps.append((y, SW_Y1 + 6.0, LOW_Z))
        for k, (ya, yb, z) in enumerate(steps):
            add(TR, g_cbox(xa - 0.005, xb + 0.005, ya, yb, z - 0.20, z, 0.004), "tile_floor")
            if k < len(steps) - 1:
                add(S, g_cbox(xa, xb, yb - 0.05, yb, z - 0.03, z + 0.002, 0.0015), "stainless")
                add(K, g_cbox(xa + 0.02, xb - 0.02, yb - 0.04, yb - 0.012, z, z + 0.0035, 0.001), "plastic_black")
        return steps
    flight(SP_X, SW_IN)
    flight(-SW_IN, -SP_X)

    # handrails: double stainless rails (0.85 / 0.65) on both sides of each flight, brackets every ~1.1 m
    R = C.Builder()
    for xr, wall_x in ((SW_IN - 0.065, SW_IN), (SP_X + 0.065, SP_X)):
        for h in (0.85, 0.65):
            pts = [(xr, y, z) for y, z in _rail_path(h)]
            add(R, g_tube(pts, 0.017, 12), "stainless", both=True)
            # brackets
            path = _rail_path(h)
            for a, b in zip(path[:-1], path[1:]):
                L = math.hypot(b[0] - a[0], b[1] - a[1])
                n = max(1, int(L / 1.1))
                for t in range(n):
                    f = (t + 0.5) / n
                    y = a[0] + (b[0] - a[0]) * f; z = a[1] + (b[1] - a[1]) * f
                    add(R, g_cyl((xr, y, z - 0.017), (xr, y, z - 0.06), 0.006, 8), "stainless", both=True)
                    add(R, g_cyl((xr, y, z - 0.06), (wall_x, y, z - 0.06), 0.006, 8), "stainless", both=True)
                    add(R, g_cyl((wall_x + (0.004 if wall_x < xr else -0.004), y, z - 0.06),
                                 (wall_x, y, z - 0.06), 0.03, 12), "stainless", both=True)

    # windbreak: 12 mm glass on the side walls (y >= 46) and the end wall, steel mullions + top rail
    zg0, zg1 = WALL_H + 0.03, 2.10
    ys = [GLASS_Y0 + k * (SW_Y1 - GLASS_Y0) / 9 for k in range(10)]
    xm = (SW_IN + SW_X) / 2
    for y in ys:
        add(F, g_cbox(xm - 0.03, xm + 0.03, y - 0.03, y + 0.03, zg0, zg1 + 0.06, 0.003), "steel_paint", both=True)
    for a, b in zip(ys[:-1], ys[1:]):
        add(G, g_box(xm - 0.006, xm + 0.006, a + 0.03, b - 0.03, zg0 + 0.02, zg1), "glass", both=True)
    add(F, g_cbox(xm - 0.035, xm + 0.035, GLASS_Y0 - 0.03, SW_Y1, zg1, zg1 + 0.06, 0.004), "steel_paint", both=True)
    ye = SW_Y1 - 0.1
    xs = [-xm + k * (2 * xm) / 3 for k in range(4)]
    for x in xs[1:-1]:
        add(F, g_cbox(x - 0.03, x + 0.03, ye - 0.03, ye + 0.03, zg0, zg1 + 0.06, 0.003), "steel_paint")
    for a, b in zip(xs[:-1], xs[1:]):
        add(G, g_box(a + 0.03, b - 0.03, ye - 0.006, ye + 0.006, zg0 + 0.02, zg1), "glass")
    add(F, g_cbox(-xm, xm, ye - 0.035, ye + 0.035, zg1, zg1 + 0.06, 0.004), "steel_paint")
    # glazing beads at the foot of the glass
    for y0g, y1g in ((GLASS_Y0, SW_Y1),):
        add(F, g_box(xm - 0.03, xm + 0.03, y0g, y1g, zg0, zg0 + 0.025), "steel_dark", both=True)
    add(F, g_box(-xm, xm, ye - 0.03, ye + 0.03, zg0, zg0 + 0.025), "steel_dark")

    # underpass ceiling light (so the stair does not fall to black)
    L = C.Builder()
    for lx in (-0.95, 0.95):
        L.add([(lx - 0.06, SW_Y1 + 0.6, SLAB_Z - 0.02), (lx - 0.06, SW_Y1 + 5.4, SLAB_Z - 0.02),
               (lx + 0.06, SW_Y1 + 5.4, SLAB_Z - 0.02), (lx + 0.06, SW_Y1 + 0.6, SLAB_Z - 0.02)],
              [(0, 1, 2, 3)], "light_tube")

    wo = W.build("plat_stair_walls", c); C.smooth_by_angle(wo, 30)
    tr = TR.build("plat_stair_treads", c); tile_uv(tr)
    so = S.build("plat_stair_stainless", c); C.smooth_by_angle(so, 40)
    K.build("plat_stair_rubber", c)
    ro = R.build("plat_stair_handrails", c); C.smooth_by_angle(ro, 60)
    G.build("plat_stair_glass", c)
    fo = F.build("plat_stair_frame", c); C.smooth_by_angle(fo, 30)
    L.build("plat_stair_light", c)


# ================================================================================================= 7. benches, bins, end
def _seat_geo(y0, w=0.44):
    """One moulded seat shell for the +X facing row; the back sits near x=0.08."""
    prof = [(0.000, 0.82), (0.018, 0.70), (0.035, 0.58), (0.050, 0.50), (0.075, 0.455), (0.12, 0.432),
            (0.22, 0.425), (0.34, 0.430), (0.42, 0.436), (0.455, 0.428), (0.47, 0.405)]
    t = 0.008
    pts = []
    for i, (d, z) in enumerate(prof):
        a = prof[max(0, i - 1)]; b = prof[min(len(prof) - 1, i + 1)]
        tx, tz = b[0] - a[0], b[1] - a[1]
        L = math.hypot(tx, tz)
        nx, nz = tz / L, -tx / L                    # normal pointing away from the sitter (down/back)
        pts.append((d, z, nx, nz))
    v, f = [], []
    # cross-section: rounded-ish ends along y (inset corners)
    ys = [y0, y0 + 0.012, y0 + w - 0.012, y0 + w]
    ins = [0.006, 0.0, 0.0, 0.006]
    n = len(pts)
    for yi, (yy, di) in enumerate(zip(ys, ins)):
        for d, z, nx, nz in pts:
            v.append((0.08 + d, yy, z + di * 0.0))      # top surface
        for d, z, nx, nz in pts:
            v.append((0.08 + d + nx * t, yy, z + nz * t))  # under surface
    ring = 2 * n
    for yi in range(len(ys) - 1):
        a0 = yi * ring; b0 = (yi + 1) * ring
        for i in range(n - 1):
            f.append((a0 + i, a0 + i + 1, b0 + i + 1, b0 + i))               # top
            f.append((a0 + n + i + 1, a0 + n + i, b0 + n + i, b0 + n + i + 1))  # under
        f.append((a0 + 0, b0 + 0, b0 + n, a0 + n))                            # back top edge
        f.append((a0 + n - 1 + n, b0 + n - 1 + n, b0 + n - 1, a0 + n - 1))    # front edge
    for base, rev in ((0, False), ((len(ys) - 1) * ring, True)):
        for i in range(n - 1):
            q = (base + i, base + n + i, base + n + i + 1, base + i + 1)
            f.append(tuple(reversed(q)) if rev else q)
    # pull the end sections in slightly (soft corners)
    for yi, di in ((0, 1), (len(ys) - 1, -1)):
        for k in range(ring):
            x, yy, z = v[yi * ring + k]
            v[yi * ring + k] = (x, yy, z - 0.002)
    return v, f


def step_furniture():
    c = _c()
    _mat_seat()
    SE = C.Builder(); FR = C.Builder()
    for yb in BENCH_Y:
        seats = [yb + o for o in (-0.94, -0.47, 0.0, 0.47)]
        for ys in seats:
            v, f = _seat_geo(ys + 0.015)
            add(SE, (v, f), "platform_seat", both=True)
            # seat bracket under the pan
            add(FR, g_box(0.22, 0.42, ys + 0.20, ys + 0.27, 0.36, 0.42), "steel_dark", both=True)
            add(FR, g_box(0.06, 0.10, ys + 0.20, ys + 0.27, 0.36, 0.60), "steel_dark", both=True)
        # beams + pedestal legs
        add(FR, g_cbox(0.22, 0.30, yb - 0.96, yb + 0.96, 0.31, 0.36, 0.006), "steel_dark", both=True)
        add(FR, g_cbox(0.05, 0.11, yb - 0.96, yb + 0.96, 0.31, 0.36, 0.006), "steel_dark", both=True)
        for ly in (yb - 0.70, yb + 0.70):
            add(FR, g_cbox(-0.04, 0.04, ly - 0.04, ly + 0.04, 0.0, 0.33, 0.005), "steel_dark")
            add(FR, g_cbox(-0.32, 0.32, ly - 0.03, ly + 0.03, 0.30, 0.34, 0.005), "steel_dark")
            add(FR, g_cbox(-0.12, 0.12, ly - 0.10, ly + 0.10, 0.0, 0.012, 0.003), "steel_dark")
            for bx in (-0.08, 0.08):
                add(FR, g_cyl((bx, ly - 0.07, 0.012), (bx, ly - 0.07, 0.02), 0.008, 8), "galvanized")
                add(FR, g_cyl((bx, ly + 0.07, 0.012), (bx, ly + 0.07, 0.02), 0.008, 8), "galvanized")
    so = SE.build("plat_bench_seats", c); C.smooth_by_angle(so, 40); so.color = (0.10, 0.22, 0.42, 1.0)
    fo = FR.build("plat_bench_frames", c); C.smooth_by_angle(fo, 40)

    # recycling bins behind columns: 3 stainless compartments, black tops, coloured label bands
    BS = C.Builder(); BK = C.Builder()
    LB = [C.Builder(), C.Builder(), C.Builder()]
    for yb in BIN_Y:
        y0, y1 = yb, yb + 0.42
        for k in range(3):
            xa = -0.66 + k * 0.44
            xb = xa + 0.43
            add(BS, g_cbox(xa, xb, y0, y1, 0.04, 0.92, 0.012), "stainless")
            add(BK, g_cbox(xa - 0.005, xb + 0.005, y0 - 0.005, y1 + 0.005, 0.92, 1.00, 0.015), "plastic_black")
            # slot opening on the camera face (dark recess)
            if k == 0:
                for cx in (-0.06, 0.06):
                    add(BK, g_cyl(((xa + xb) / 2 + cx, y0 + 0.02, 0.84), ((xa + xb) / 2 + cx, y0 - 0.006, 0.84),
                                  0.045, 16), "plastic_black")
            elif k == 1:
                add(BK, g_cbox((xa + xb) / 2 - 0.16, (xa + xb) / 2 + 0.16, y0 - 0.006, y0 + 0.02, 0.86, 0.885, 0.002),
                    "plastic_black")
            else:
                add(BK, g_cbox((xa + xb) / 2 - 0.12, (xa + xb) / 2 + 0.12, y0 - 0.006, y0 + 0.02, 0.80, 0.87, 0.004),
                    "plastic_black")
            add(LB[k], g_box(xa + 0.02, xb - 0.02, y0 - 0.004, y0 + 0.002, 0.62, 0.76), "platform_seat")
        add(BS, g_cbox(-0.67, 0.67, y0 - 0.01, y1 + 0.01, 0.0, 0.04, 0.004), "steel_dark")
    bo = BS.build("plat_bins", c); C.smooth_by_angle(bo, 40)
    BK.build("plat_bin_tops", c)
    for k, col in enumerate(((0.05, 0.22, 0.60, 1), (0.10, 0.40, 0.16, 1), (0.80, 0.38, 0.05, 1))):
        o = LB[k].build("plat_bin_label_%d" % k, c); o.color = col

    # platform end: steel fence with a gate across the far end
    E = C.Builder()
    ye = END_FENCE_Y
    xs = [-XC + 0.05 + k * (2 * XC - 0.1) / 6 for k in range(7)]
    for x in xs:
        add(E, g_cbox(x - 0.035, x + 0.035, ye - 0.035, ye + 0.035, 0.0, 1.25, 0.004), "steel_paint")
    for z in (0.10, 1.15):
        add(E, g_box(-XC + 0.05, XC - 0.05, ye - 0.02, ye + 0.02, z, z + 0.04), "steel_paint")
    x = -XC + 0.12
    while x < XC - 0.1:
        add(E, g_box(x - 0.008, x + 0.008, ye - 0.008, ye + 0.008, 0.14, 1.15), "steel_paint")
        x += 0.12
    eo = E.build("plat_end_fence", c); C.smooth_by_angle(eo, 30)


STEPS = [
    ("platform body, refuge recess, coping", step_body),
    ("floor tiles and white safety line", step_floor),
    ("tactile strips with domes", step_tactile),
    ("drains, hatches, joints, door marks", step_details),
    ("glass elevator shaft", step_elevator),
    ("stairwell, handrails, windbreak", step_stairs),
    ("benches, bins, platform end", step_furniture),
]
