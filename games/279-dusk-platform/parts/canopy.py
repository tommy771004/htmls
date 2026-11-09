"""Canopy: columns, Y-frame, purlins, folded roof deck, gutters, fluorescent rows and roof services.

Butterfly roof over the island platform (collection "Canopy").
Section (right half, mirrored for the left; all heights grow linearly with |x| along the roof slope):
  deck underside (low flats of the folded plate)  zd(x) = 4.40 + 0.125 |x|
  purlins (lipped C 150)                         zd-0.15 .. zd
  rafters (tapered H, top at zd-0.15)            depth 0.50-0.04|x| (main, on columns) / x0.6 (intermediate)
  centre box girder                              x +-0.20, z 3.70 .. 4.25, sits on the columns
  columns                                        0.45 sq core, 0.55 sq clad (panel joints, corner trims), z 0 .. 3.70,
                                                 struts from z 3.0 to the rafters at x=+-2.1
  eave girder / fascia                           x 5.02 .. 5.235
Fluorescent rows: x = +-1.35 and +-4.05, inverted-Fuji housings (1.25 m, 5 cm gaps) hung under the rafters on a
continuous galvanised carrier; tubes are their own object "Canopy_LightTubes" (material light_tube only).
Notes: the canopy over y -24..12 has no column (the camera dollies on x=0 there); column y=48 is extended down to
z=-6 because the brief puts the stairwell (y 44..60) around it.
"""

import bpy, bmesh, math
from mathutils import Vector, Matrix
import common as C

CN = "Canopy"
SLOPE = (C.CANOPY_EAVE_Z - C.CANOPY_VALLEY_Z) / C.CANOPY_EAVE_X     # 0.125
ANG = math.atan(SLOPE)
Y0, Y1 = C.CANOPY_Y0, C.CANOPY_Y1
PURLIN_D = 0.15
GIRDER_HW = 0.20
GIRDER_Z0 = 3.70
HC = C.COL_SIZE / 2                     # column half size (structural core)
CH = 0.275                              # cladding half size: 0.55 m clad column around the 0.45 core
CLAD_JOINTS = [0.62, 1.24, 1.86, 2.48, 3.10]   # 8 mm horizontal panel joints (ref: ~0.55 / 1.2 / 1.9 m)
JOINT_W = 0.008
KICK_H = 0.30
KSEC = 0.60                             # intermediate rafter depth factor (main = 1.0)
RAF_X0 = GIRDER_HW
RAF_X1 = 5.02
EAVE_X0, EAVE_X1 = 5.02, 5.17
FASCIA_X0, FASCIA_X1 = 5.20, 5.235
PURLIN_X = [0.45, 1.35, 2.25, 3.15, 4.05, 4.85]
LIGHT_X = [1.35, 4.05]
STRUT_Z0, STRUT_X1 = 3.02, 2.10
BAND_Z = (2.40, 2.95)                  # red/white band on the first column
FIX_L, FIX_PITCH = 1.25, 1.30           # fixture length / pitch along the row
RAF_Y = [Y0 + 0.15] + [Y0 + 6.0 * k for k in range(1, 31)] + [Y1 - 0.15]
MAIN_Y = set(C.COL_Y)
STAIR_Y = (44.0, 60.0)


def zd(x):
    return C.CANOPY_VALLEY_Z + SLOPE * abs(x)


def rtop(x):
    return zd(x) - PURLIN_D


def rbot(x, k=1.0):
    return rtop(x) - k * (0.50 - 0.04 * abs(x))


def col_bottom(cy):
    return -6.0 if STAIR_Y[0] < cy < STAIR_Y[1] else 0.0


# ---------------------------------------------------------------------------------------------- helpers
def cl():
    return C.coll(CN)


def finish(ob, recalc=True, smooth=None, bevel=None, seg=2, angle=40):
    if recalc:
        bm = bmesh.new(); bm.from_mesh(ob.data)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        bm.to_mesh(ob.data); bm.free()
    if smooth is not None:
        C.smooth_by_angle(ob, smooth)
    if bevel:
        C.add_bevel(ob, bevel, seg, angle)
    return ob


def hexa(B, x0, x1, y0, y1, zb, zt, key):
    """Box whose bottom / top heights are functions of x (follows the roof slope)."""
    if x0 > x1:
        x0, x1 = x1, x0
    if y0 > y1:
        y0, y1 = y1, y0
    v = [(x0, y0, zb(x0)), (x1, y0, zb(x1)), (x1, y1, zb(x1)), (x0, y1, zb(x0)),
         (x0, y0, zt(x0)), (x1, y0, zt(x1)), (x1, y1, zt(x1)), (x0, y1, zt(x0))]
    f = [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]
    B.add(v, f, key)


def tbox(B, M, x0, x1, y0, y1, z0, z1, key):
    v, f = C.box_geo(min(x0, x1), max(x0, x1), min(y0, y1), max(y0, y1), min(z0, z1), max(z0, z1))
    B.add([tuple(M @ Vector(p)) for p in v], f, key)


def cyl(B, p0, p1, r, key, seg=12, cap=True):
    v, f = C.cyl_geo(p0, p1, r, seg, cap)
    B.add(v, f, key)


def ext(B, ring0, ring1, key, cap=True):
    """Side quads between two matching closed loops (+ ngon caps)."""
    n = len(ring0)
    v = list(ring0) + list(ring1)
    f = [(i, (i + 1) % n, n + (i + 1) % n, n + i) for i in range(n)]
    if cap:
        f.append(tuple(reversed(range(n))))
        f.append(tuple(range(n, 2 * n)))
    B.add(v, f, key)


def bolt(B, p, axis, r=0.013, h=0.012, key="steel_paint"):
    p = Vector(p); a = Vector(axis).normalized()
    cyl(B, p, p + a * h, r, key, seg=6)


def mirror_x(ob, name, loc, c):
    """Linked duplicate rotated 180 deg about Z (left side of a Y-symmetric right-side part)."""
    return C.instance(ob, name, loc, c, rot=(0, 0, math.pi))


# ---------------------------------------------------------------------------------------------- 1 columns
def build_columns():
    c = C.coll(CN, fresh=True)
    for me in list(bpy.data.meshes):
        if me.users == 0 and me.name.startswith("Canopy"):
            bpy.data.meshes.remove(me)
    clad, core, kick, cap, trim = C.Builder(), C.Builder(), C.Builder(), C.Builder(), C.Builder()
    jw = JOINT_W / 2
    for cy in C.COL_Y:
        zb = col_bottom(cy)
        core.box(-HC + 0.014, HC - 0.014, cy - HC + 0.014, cy + HC - 0.014, zb, GIRDER_Z0, "steel_dark")
        # dark backing rail 6 mm behind the panel faces: what shows inside the recessed joints
        core.box(-CH + 0.006, CH - 0.006, cy - CH + 0.006, cy + CH - 0.006, zb + KICK_H, 3.60, "steel_dark")
        # cladding panels (0.55 m outer, around the structural core) with 8 mm recessed horizontal joints
        cuts = ([zb + KICK_H, -4.8, -3.6, -2.4, -1.2] if zb < 0 else [zb + KICK_H]) + CLAD_JOINTS + [3.60]
        for i, (a, b) in enumerate(zip(cuts[:-1], cuts[1:])):
            clad.box(-CH, CH, cy - CH, cy + CH, a + (jw if i else 0.0), b - (jw if b < 3.59 else 0.0), "steel_paint")
        # vertical L-angle corner trims (40 mm legs, 2.5 mm proud of the panel faces)
        t, lg = 0.0025, 0.040
        for sx in (-1, 1):
            for sy in (-1, 1):
                x0, y0 = sx * (CH + t), cy + sy * (CH + t)
                trim.box(x0, x0 - sx * lg, y0, y0 - sy * (t + 0.001), zb + KICK_H, 3.60, "steel_paint")
                trim.box(x0, x0 - sx * (t + 0.001), y0, y0 - sy * lg, zb + KICK_H, 3.60, "steel_paint")
        # stainless kick plate, 5 mm proud
        kick.box(-CH - 0.005, CH + 0.005, cy - CH - 0.005, cy + CH + 0.005, zb, zb + KICK_H, "stainless")
        # capital trim + girder seat plate
        cap.box(-CH - 0.010, CH + 0.010, cy - CH - 0.010, cy + CH + 0.010, 3.60, 3.675, "steel_paint")
        cap.box(-0.30, 0.30, cy - 0.30, cy + 0.30, 3.675, GIRDER_Z0, "steel_paint")
        for sx in (-1, 1):
            for sy in (-1, 1):
                bolt(cap, (sx * 0.26, cy + sy * 0.26, 3.675), (0, 0, -1), 0.016, 0.014)
    finish(clad.build("Canopy_ColumnClad", c), bevel=0.004, seg=2)
    core.build("Canopy_ColumnCore", c)
    finish(trim.build("Canopy_ColumnTrim", c), bevel=0.0012, seg=1)
    finish(kick.build("Canopy_ColumnKick", c), bevel=0.003, seg=2)
    finish(cap.build("Canopy_ColumnCap", c), smooth=35, bevel=0.004, seg=1)

    # red/white warning band on the FIRST column only, UV u = perimeter distance (m), v = z (m)
    cy = C.COL_Y[0]
    h, hi = CH + 0.006, CH - 0.002
    z0, z1 = BAND_Z
    me = bpy.data.meshes.new("Canopy_StripeBand")
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new("UVMap")
    corners = [(-1, -1), (1, -1), (1, 1), (-1, 1)]
    side = 2 * h
    for i in range(4):
        a, b = corners[i], corners[(i + 1) % 4]
        u0 = i * side
        for (ra, rb, za, zz, flip) in ((h, h, z0, z1, False),):
            vs = [bm.verts.new((a[0] * h, cy + a[1] * h, z0)), bm.verts.new((b[0] * h, cy + b[1] * h, z0)),
                  bm.verts.new((b[0] * h, cy + b[1] * h, z1)), bm.verts.new((a[0] * h, cy + a[1] * h, z1))]
            f = bm.faces.new(vs)
            for l, uv in zip(f.loops, [(u0, z0), (u0 + side, z0), (u0 + side, z1), (u0, z1)]):
                l[uvl].uv = uv
        # thin top / bottom lips back to the cladding
        for zz, sgn in ((z0, -1), (z1, 1)):
            q = [(a[0] * h, a[1] * h), (b[0] * h, b[1] * h), (b[0] * hi, b[1] * hi), (a[0] * hi, a[1] * hi)]
            vs = [bm.verts.new((x, cy + y, zz)) for x, y in q]
            if sgn > 0:
                vs.reverse()
            f = bm.faces.new(vs)
            for l in f.loops:
                l[uvl].uv = (u0 + (l.vert.co.x + l.vert.co.y - cy) * 0.5, zz)
    bm.normal_update()
    bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new("Canopy_StripeBand", me)
    c.objects.link(ob)
    me.materials.append(C.mat("stripe_warning"))
    C.add_bevel(ob, 0.002, 1)


# ---------------------------------------------------------------------------------------------- 2 frame
def rafter_geo(main):
    """Right-side rafter (+ strut for main) in local coords, y centred on 0."""
    B = C.Builder()
    k = 1.0 if main else KSEC
    b, tf, tw = (0.20, 0.016, 0.010) if main else (0.15, 0.012, 0.008)

    def ring(x):
        zt, zb = rtop(x), rbot(x, k)
        pts = [(-b / 2, zt), (b / 2, zt), (b / 2, zt - tf), (tw / 2, zt - tf), (tw / 2, zb + tf), (b / 2, zb + tf),
               (b / 2, zb), (-b / 2, zb), (-b / 2, zb + tf), (-tw / 2, zb + tf), (-tw / 2, zt - tf), (-b / 2, zt - tf)]
        return [(x, y, z) for y, z in pts]

    xa = RAF_X0 + 0.022
    ext(B, ring(xa), ring(RAF_X1 - 0.016), "steel_paint")
    # end plates (girder side and eave side)
    ew = b / 2 + 0.035
    hexa(B, RAF_X0, xa, -ew, ew, lambda x: rbot(RAF_X0, k) - 0.035, lambda x: rtop(RAF_X0), "steel_paint")
    hexa(B, RAF_X1 - 0.016, RAF_X1, -b / 2 - 0.02, b / 2 + 0.02, lambda x: rbot(RAF_X1, k) - 0.02,
         lambda x: rtop(RAF_X1), "steel_paint")
    # bolts on the girder end plate (rafter side)
    zt, zb = rtop(xa), rbot(xa, k)
    rows = 4 if main else 3
    for i in range(rows):
        z = zb + 0.055 + (zt - zb - 0.11) * i / (rows - 1)
        for sy in (-1, 1):
            bolt(B, (xa, sy * (tw / 2 + 0.045), z), (1, 0, 0))
    # web stiffeners at quarter points (+ strut seat on main rafters)
    for xs in ((STRUT_X1, 3.6) if main else (2.6,)):
        for sy in (-1, 1):
            hexa(B, xs - 0.006, xs + 0.006, sy * tw / 2, sy * (b / 2 - 0.004),
                 lambda x: rbot(x, k) + tf, lambda x: rtop(x) - tf, "steel_paint")
    if main:
        # gusset under the bottom flange
        gx0, gx1 = STRUT_X1 - 0.20, STRUT_X1 + 0.12
        hexa(B, gx0, gx1, -0.008, 0.008, lambda x: rbot(STRUT_X1) - 0.17 + (x - gx0) * 0.35,
             lambda x: rbot(x), "steel_paint")
        # bracket on the column face
        B.box(CH, CH + 0.075, -0.11, 0.11, STRUT_Z0 - 0.13, STRUT_Z0 + 0.12, "steel_paint")
        B.box(CH + 0.075, CH + 0.09, -0.15, 0.15, STRUT_Z0 - 0.17, STRUT_Z0 + 0.16, "steel_paint")
        for sy in (-1, 1):
            for sz in (-1, 1):
                bolt(B, (CH + 0.09, sy * 0.115, STRUT_Z0 + sz * 0.12), (1, 0, 0), 0.012, 0.01)
        # the strut (CHS 190.7) with end discs
        p0 = Vector((CH + 0.09, 0, STRUT_Z0))
        p1 = Vector((STRUT_X1 + 0.02, 0, rbot(STRUT_X1) - 0.09))
        d = (p1 - p0).normalized()
        cyl(B, p0, p1, 0.0955, "steel_paint", seg=20)
        cyl(B, p0, p0 + d * 0.012, 0.115, "steel_paint", seg=20)
    return B


def build_frame():
    c = cl()
    # centre box girder with bolted splices
    G = C.Builder()
    G.box(-GIRDER_HW, GIRDER_HW, Y0, Y1, GIRDER_Z0, rtop(0), "steel_paint")
    for ys in [Y0 + 6.0 + 12.0 * k for k in range(15)]:
        if ys > Y1 - 3:
            break
        G.box(-0.17, 0.17, ys - 0.25, ys + 0.25, GIRDER_Z0 - 0.012, GIRDER_Z0, "steel_paint")
        for sx in (-1, 1):
            G.box(sx * GIRDER_HW, sx * (GIRDER_HW + 0.012), ys - 0.25, ys + 0.25, GIRDER_Z0 + 0.06, rtop(0) - 0.06,
                  "steel_paint")
            for j in range(4):
                bolt(G, (sx * 0.09, ys - 0.18 + 0.12 * j, GIRDER_Z0 - 0.012), (0, 0, -1))
                for zz in (GIRDER_Z0 + 0.13, GIRDER_Z0 + 0.275, GIRDER_Z0 + 0.42):
                    bolt(G, (sx * (GIRDER_HW + 0.012), ys - 0.18 + 0.12 * j, zz), (sx, 0, 0))
    # end caps of the girder
    finish(G.build("Canopy_Girder", c), smooth=35, bevel=0.005, seg=2)

    # rafters: one mesh each for main / intermediate, linked duplicates for every bay and both sides
    srcM = srcS = None
    for y in RAF_Y:
        main = any(abs(y - cy) < 0.01 for cy in MAIN_Y)
        if main:
            if srcM is None:
                srcM = finish(rafter_geo(True).build("Canopy_RafterMain", c), smooth=35, bevel=0.003, seg=1)
                srcM.location = (0, y, 0)
                ob = srcM
            else:
                ob = C.instance(srcM, "Canopy_RafterMain_R%+04d" % round(y), (0, y, 0), c)
        else:
            if srcS is None:
                srcS = finish(rafter_geo(False).build("Canopy_RafterSec", c), smooth=35, bevel=0.003, seg=1)
                srcS.location = (0, y, 0)
                ob = srcS
            else:
                ob = C.instance(srcS, "Canopy_RafterSec_R%+04d" % round(y), (0, y, 0), c)
        mirror_x(ob, ("Canopy_RafterMain_L%+04d" if main else "Canopy_RafterSec_L%+04d") % round(y), (0, y, 0), c)

    # eave girders (RHS 400x150) on both sides
    E = C.Builder()
    for s in (-1, 1):
        E.box(s * EAVE_X0, s * EAVE_X1, Y0, Y1, rbot(5.1) + 0.01, zd(EAVE_X0) - 0.002, "steel_paint")
    finish(E.build("Canopy_EaveGirder", c), bevel=0.006, seg=2)


# ---------------------------------------------------------------------------------------------- 3 purlins
def build_purlins():
    c = cl()
    P = C.Builder()
    d, f, l, t = PURLIN_D, 0.065, 0.020, 0.0045
    prof = [(0, 0), (f, 0), (f, l), (f - t, l), (f - t, t), (t, t), (t, d - t), (f - t, d - t), (f - t, d - l),
            (f, d - l), (f, d), (0, d)]
    for s in (-1, 1):
        for xc in PURLIN_X:
            x_web = s * xc - s * f / 2          # web on the valley side, flanges point to the eave
            def P3(u, v, y):
                x = x_web + s * u
                return (x, y, rtop(xc) + v + SLOPE * (abs(x) - xc))
            ext(P, [P3(u, v, Y0 + 0.02) for u, v in prof], [P3(u, v, Y1 - 0.02) for u, v in prof], "steel_dark")
            # cleats on every rafter
            for y in RAF_Y:
                hexa(P, x_web - s * 0.010, x_web, y - 0.05, y + 0.05,
                     lambda x: rtop(x), lambda x: rtop(x) + 0.12, "steel_dark")
                bolt(P, (x_web - s * 0.010, y, rtop(xc) + 0.07), (-s, 0, 0), 0.011, 0.01, "steel_dark")
    finish(P.build("Canopy_Purlins", c), smooth=35, bevel=0.0015, seg=1)

    # roof-plane X bracing (round bar + turnbuckle) in every other bay
    Br = C.Builder()
    bays = list(zip(RAF_Y[:-1], RAF_Y[1:]))
    for i, (ya, yb) in enumerate(bays):
        if i % 2:
            continue
        for s in (-1, 1):
            xa, xb = s * 0.32, s * 4.95
            za, zb = rtop(xa) - 0.012, rtop(xb) - 0.012
            for (p0, p1) in (((xa, ya + 0.12, za), (xb, yb - 0.12, zb)), ((xa, yb - 0.12, za), (xb, ya + 0.12, zb))):
                cyl(Br, p0, p1, 0.011, "steel_dark", seg=6, cap=False)
                m = (Vector(p0) + Vector(p1)) / 2 + Vector((0, 0, -0.004 * (1 if p0[1] < p1[1] else -1)))
                dv = (Vector(p1) - Vector(p0)).normalized()
                cyl(Br, m - dv * 0.10, m + dv * 0.10, 0.02, "steel_dark", seg=8)
    finish(Br.build("Canopy_Bracing", c), recalc=False, smooth=50)


# ---------------------------------------------------------------------------------------------- 4 roof deck
def build_roof():
    c = cl()
    # folded plate underside: ribs run with the slope (along X), pitch 0.25 m along Y, depth 88 mm
    prof = [(0.0, 0.0), (0.055, 0.0), (0.095, 0.088), (0.21, 0.088)]
    P = 0.25
    n = int(round((Y1 - Y0) / P))
    for s in (-1, 1):
        x0, x1 = s * 0.30, s * FASCIA_X0
        ys = []
        for i in range(n):
            for oy, dz in prof:
                ys.append((Y0 + i * P + oy, dz))
        ys.append((Y1, 0.0))
        v, f = [], []
        for y, dz in ys:
            v.append((x0, y, zd(x0) + dz)); v.append((x1, y, zd(x1) + dz))
        for i in range(len(ys) - 1):
            a, b, cc, dd = 2 * i, 2 * i + 2, 2 * i + 3, 2 * i + 1     # (x0,ya),(x0,yb),(x1,yb),(x1,ya)
            f.append((a, b, cc, dd) if s > 0 else (dd, cc, b, a))
        ob = C.mesh("Canopy_Deck" + ("R" if s > 0 else "L"), v, f, c, ["roof_deck"])
    # roofing sheet above the ribs (seen from the over view / from the city), with thickness
    R = C.Builder()
    for s in (-1, 1):
        hexa(R, s * 0.28, s * FASCIA_X0, Y0, Y1, lambda x: zd(x) + 0.095, lambda x: zd(x) + 0.115, "roof_deck")
    R.build("Canopy_Roofing", c)

    # centre box gutter (valley) and eave gutters behind the fascia
    Gt = C.Builder()
    gz0, gz1 = 4.29, 4.56
    Gt.box(-0.30, 0.30, Y0, Y1, gz0, gz0 + 0.004, "galvanized")
    for s in (-1, 1):
        Gt.box(s * 0.296, s * 0.30, Y0, Y1, gz0, gz1, "galvanized")
        Gt.box(s * 0.296, s * 0.33, Y0, Y1, gz1 - 0.004, gz1, "galvanized")
        ez0 = zd(FASCIA_X0) + 0.12
        Gt.box(s * 5.00, s * FASCIA_X0, Y0, Y1, ez0, ez0 + 0.004, "galvanized")
        Gt.box(s * 5.00, s * 5.004, Y0, Y1, ez0, ez0 + 0.18, "galvanized")
    for yy in (Y0, Y1):
        Gt.box(-0.30, 0.30, yy - 0.002, yy + 0.002, gz0, gz1, "galvanized")
    finish(Gt.build("Canopy_Gutters", c), bevel=0.0015, seg=1)

    # fascia (eaves + both ends) with a soffit and drip
    Fa = C.Builder()
    fz0, fz1 = rbot(5.1) - 0.03, zd(FASCIA_X0) + 0.35
    for s in (-1, 1):
        # fascia panels 3 m long with 8 mm joints over a dark backing strip
        Fa.box(s * (FASCIA_X0 - 0.004), s * (FASCIA_X0 + 0.012), Y0, Y1, fz0 + 0.004, fz1 - 0.004, "steel_dark")
        ya = Y0 - 0.035
        while ya < Y1 + 0.03:
            yb = min(ya + 3.0, Y1 + 0.035)
            Fa.box(s * FASCIA_X0, s * FASCIA_X1, ya + (0.004 if ya > Y0 else 0), yb - (0.004 if yb < Y1 else 0),
                   fz0, fz1, "steel_paint")
            ya = yb
        Fa.box(s * 4.98, s * FASCIA_X0, Y0, Y1, fz0, fz0 + 0.012, "steel_paint")          # soffit
        Fa.box(s * FASCIA_X1, s * (FASCIA_X1 + 0.012), Y0 - 0.035, Y1 + 0.035, fz1 - 0.04, fz1, "steel_paint")
        for yy, dy in ((Y0, -1), (Y1, 1)):
            hexa(Fa, s * 0.0, s * FASCIA_X1, yy, yy + dy * 0.035,
                 lambda x: rbot(x) - 0.03 + 0.05 * abs(x) / 5.2, lambda x: zd(x) + 0.35, "steel_paint")
    finish(Fa.build("Canopy_Fascia", c), bevel=0.004, seg=2)

    # downpipe on every column (+X face, at its camera-side front corner so it reads beside the column face)
    # from the valley gutter to a floor shoe; y clear of the strut bracket plate (+-0.15)
    D = C.Builder()
    for cy in C.COL_Y:
        px, py = CH + 0.06, cy - 0.21
        zb = col_bottom(cy)
        top = Vector((px, py, gz0 - 0.05))
        cyl(D, (0.12, py, gz0 + 0.002), (0.12, py, gz0 - 0.07), 0.05, "steel_paint", seg=14)   # outlet
        cyl(D, (0.12, py, gz0 - 0.07), top, 0.05, "steel_paint", seg=14)                        # offset
        cyl(D, top, (px, py, zb + 0.18), 0.05, "steel_paint", seg=14)
        cyl(D, (px, py, zb + 0.18), (px + 0.10, py, zb + 0.06), 0.05, "steel_paint", seg=14)     # shoe
        cyl(D, (px + 0.10, py, zb + 0.06), (px + 0.10, py, zb + 0.0), 0.06, "steel_paint", seg=14)
        z = zb + 0.6
        while z < 3.5:
            cyl(D, (px, py, z), (px, py, z + 0.03), 0.056, "galvanized", seg=14)
            D.box(CH, px - 0.045, py - 0.008, py + 0.008, z, z + 0.03, "galvanized")
            z += 1.1
    finish(D.build("Canopy_Downpipes", c), recalc=False, smooth=40)


# ---------------------------------------------------------------------------------------------- 5 lights
def build_lights():
    c = cl()
    H, T, K = C.Builder(), C.Builder(), C.Builder()      # housings, tubes, carriers/rods
    dead = {(1.35, 56), (-4.05, 77)}                      # two failed tubes far down the platform
    for s in (-1, 1):
        n = Vector((-s * math.sin(ANG), 0, math.cos(ANG)))
        t = Vector((math.cos(ANG), 0, s * math.sin(ANG)))
        for xr0 in LIGHT_X:
            xr = s * xr0
            ctop = rbot(xr) - 0.004
            K.box(xr - 0.0205, xr + 0.0205, Y0 + 0.2, Y1 - 0.2, ctop - 0.041, ctop, "galvanized")
            # hanger rods (M10) every 2.6 m up to the purlin above, avoiding rafters
            y = Y0 + 1.0
            while y < Y1 - 0.5:
                if min(abs(y - ry) for ry in RAF_Y) > 0.2:
                    cyl(K, (xr, y, ctop - 0.002), (xr, y, rtop(xr) + 0.002), 0.005, "galvanized", seg=6, cap=False)
                    K.box(xr - 0.03, xr + 0.03, y - 0.02, y + 0.02, ctop, ctop + 0.006, "galvanized")
                y += 2.6
            base0 = Vector((xr, 0, ctop - 0.041))
            nfix = int((Y1 - Y0 - 0.6) // FIX_PITCH)
            ystart = Y0 + 0.3 + ((Y1 - Y0 - 0.6) - nfix * FIX_PITCH) / 2
            hp = [(-0.035, 0.0), (0.035, 0.0), (0.076, -0.047), (0.076, -0.058), (-0.076, -0.058), (-0.076, -0.047)]
            for i in range(nfix):
                ya = ystart + i * FIX_PITCH
                yb = ya + FIX_L

                def W(u, v, y):
                    return tuple(base0 + t * u + n * v + Vector((0, y, 0)))
                ext(H, [W(u, v, ya) for u, v in hp], [W(u, v, yb) for u, v in hp], "light_housing")
                # lamp holders
                for y0_, y1_ in ((ya + 0.004, ya + 0.03), (yb - 0.03, yb - 0.004)):
                    M = Matrix.Translation(base0 + Vector((0, 0, 0))) @ Matrix.Rotation(-s * ANG, 4, "Y")
                    tbox(H, M, -0.015, 0.015, y0_, y1_, -0.098, -0.058, "light_housing")
                if any(abs(xr - dx) < 0.01 and abs(ya - dy) < FIX_PITCH / 2 for dx, dy in dead):
                    continue
                tc = Vector(W(0, -0.080, 0))
                cyl(T, (tc.x, ya + 0.026, tc.z), (tc.x, yb - 0.026, tc.z), 0.0127, "light_tube", seg=10)
    finish(H.build("Canopy_LightHousings", c), smooth=35, bevel=0.0025, seg=1)
    finish(T.build("Canopy_LightTubes", c), recalc=False, smooth=50)
    finish(K.build("Canopy_LightCarriers", c), recalc=False, smooth=40)


# ---------------------------------------------------------------------------------------------- 6 services
def build_services():
    c = cl()
    S = C.Builder()      # galvanised trays, hangers, conduits, boxes
    W = C.Builder()      # cables
    # one ladder cable tray, offset to the left of the girder like the reference (|x| <= 0.80 keeps it clear of the
    # LED-board hanger rods at |x| 0.86 in signs.py)
    for (xa, xb, ncab) in ((-0.40, -0.78, 5),):
        lo, hi = min(xa, xb), max(xa, xb)
        z0 = 3.66
        for xx in (lo, hi - 0.004):
            S.box(xx, xx + 0.004, Y0 + 0.3, Y1 - 0.3, z0, z0 + 0.10, "galvanized")
            S.box(xx - 0.012 if xx == lo else xx - 0.008, xx + 0.012 if xx != lo else xx + 0.004,
                  Y0 + 0.3, Y1 - 0.3, z0 + 0.096, z0 + 0.10, "galvanized")
        y = Y0 + 0.5
        while y < Y1 - 0.4:
            S.box(lo + 0.004, hi - 0.004, y - 0.02, y + 0.02, z0, z0 + 0.016, "galvanized")
            y += 0.30
        y = Y0 + 1.2
        while y < Y1 - 0.5:
            if min(abs(y - ry) for ry in RAF_Y) > 0.25:
                S.box(lo - 0.04, hi + 0.04, y - 0.021, y + 0.021, z0 - 0.042, z0, "galvanized")
                for xx in (lo - 0.025, hi + 0.025):
                    cyl(S, (xx, y, z0 - 0.045), (xx, y, zd(xx) - 0.0), 0.005, "galvanized", seg=6, cap=False)
            y += 1.8
        rr = [0.018, 0.012, 0.015, 0.010, 0.014]
        xs = lo + 0.035
        for j in range(ncab):
            r = rr[j]
            cyl(W, (xs + r, Y0 + 0.4, z0 + 0.016 + r), (xs + r, Y1 - 0.4, z0 + 0.016 + r), r, "wire", seg=8)
            xs += 2 * r + 0.02
    # right of the girder: a slim bundle of three conduits on strut-channel hangers (instead of a second tray)
    zb3 = 3.74
    for xb_, rb_ in ((0.43, 0.016), (0.475, 0.013), (0.515, 0.013)):
        cyl(S, (xb_, Y0 + 0.4, zb3 + rb_), (xb_, Y1 - 0.4, zb3 + rb_), rb_, "galvanized", seg=10)
    y = Y0 + 1.2
    while y < Y1 - 0.5:
        if min(abs(y - ry) for ry in RAF_Y) > 0.25:
            S.box(0.39, 0.56, y - 0.0205, y + 0.0205, zb3 - 0.041, zb3, "galvanized")
            for xx in (0.40, 0.55):
                cyl(S, (xx, y, zb3 - 0.044), (xx, y, zd(xx)), 0.005, "galvanized", seg=6, cap=False)
            S.box(0.405, 0.545, y - 0.012, y + 0.012, zb3 + 0.034, zb3 + 0.038, "galvanized")   # clamp strap
        y += 1.8
    # conduits under the rafters, clipped at every main rafter (rod-hung under the shallower intermediate ones),
    # junction boxes every 12 m
    for s in (-1, 1):
        for xc, r in ((0.98, 0.014), (1.05, 0.011)):
            x = s * xc
            zc = rbot(xc) - 0.008 - r
            cyl(S, (x, Y0 + 0.4, zc), (x, Y1 - 0.4, zc), r, "galvanized", seg=10)
            for y in RAF_Y:
                if Y0 + 0.5 < y < Y1 - 0.5:
                    if any(abs(y - cy) < 0.01 for cy in MAIN_Y):
                        S.box(x - r - 0.006, x + r + 0.006, y + 0.11, y + 0.135, zc - r - 0.004, rbot(xc), "galvanized")
                    else:
                        S.box(x - r - 0.006, x + r + 0.006, y - 0.0125, y + 0.0125, zc - r - 0.004, zc + r + 0.004,
                              "galvanized")
                        cyl(S, (x, y, zc + r + 0.004), (x, y, rbot(xc, KSEC)), 0.005, "galvanized", seg=6, cap=False)
        x = s * 1.015
        for k in range(16):
            y = 3.0 + 12.0 * k
            if y > Y1 - 2:
                break
            zt = rbot(1.015) - 0.006
            S.box(x - 0.07, x + 0.07, y - 0.07, y + 0.07, zt - 0.075, zt, "galvanized")
            # flexible drop to the light row
            xl = s * 1.35
            cyl(W, (x + s * 0.07, y, zt - 0.04), (xl, y + 0.25, rbot(1.35) - 0.03), 0.008, "wire", seg=6)
    finish(S.build("Canopy_Services", c), recalc=False, smooth=40)
    finish(W.build("Canopy_Cables", c), recalc=False, smooth=50)

    # box speakers in pairs under the girder
    Sp = C.Builder()
    for k in range(14):
        y = 21.0 + 12.0 * k
        if y > Y1 - 3:
            break
        Sp.box(-0.025, 0.025, y - 0.03, y + 0.03, GIRDER_Z0 - 0.24, GIRDER_Z0, "steel_paint")
        Sp.box(-0.15, 0.15, y - 0.02, y + 0.02, GIRDER_Z0 - 0.265, GIRDER_Z0 - 0.24, "steel_paint")
        for s in (-1, 1):
            M = (Matrix.Translation((s * 0.19, y, GIRDER_Z0 - 0.34)) @ Matrix.Rotation(0 if s > 0 else math.pi, 4, "Z")
                 @ Matrix.Rotation(math.radians(30), 4, "Y"))
            tbox(Sp, M, -0.05, 0.05, -0.07, 0.07, -0.105, 0.105, "light_housing")
            tbox(Sp, M, 0.05, 0.053, -0.058, 0.058, -0.092, 0.092, "plastic_black")
            tbox(Sp, M, -0.075, -0.05, -0.012, 0.012, 0.03, 0.09, "steel_paint")
    finish(Sp.build("Canopy_Speakers", c), smooth=35, bevel=0.006, seg=2)

    # CCTV on column 1: plate on the front face, arm out to the right, bullet camera aiming back down the platform
    cy = C.COL_Y[0]
    Cc = C.Builder()
    Cc.box(0.06, 0.20, cy - CH - 0.012, cy - CH, 3.30, 3.52, "steel_paint")
    for sx in (0.08, 0.18):
        for sz in (3.33, 3.49):
            bolt(Cc, (sx, cy - CH - 0.012, sz), (0, -1, 0), 0.008, 0.008)
    a0 = Vector((0.13, cy - CH - 0.012, 3.46))
    a1 = Vector((0.13, cy - 0.36, 3.46))
    a2 = Vector((0.36, cy - 0.40, 3.46))
    a3 = Vector((0.36, cy - 0.40, 3.37))
    for p, q in ((a0, a1), (a1, a2), (a2, a3)):
        cyl(Cc, p, q, 0.022, "light_housing", seg=12)
    for p in (a1, a2):
        cyl(Cc, p - Vector((0, 0, 0.022)), p + Vector((0, 0, 0.022)), 0.024, "light_housing", seg=12)
    M = (Matrix.Translation((0.36, cy - 0.44, 3.30)) @ Matrix.Rotation(math.radians(12), 4, "X"))
    tbox(Cc, M, -0.048, 0.048, -0.16, 0.12, -0.045, 0.045, "light_housing")       # body
    tbox(Cc, M, -0.062, 0.062, -0.21, 0.13, 0.045, 0.054, "light_housing")        # sun shield
    tbox(Cc, M, -0.02, 0.02, -0.02, 0.02, 0.045, 0.07, "light_housing")           # mount stub
    lens = [tuple(M @ Vector(p)) for p in ((0, -0.16, 0), (0, -0.175, 0))]
    cyl(Cc, lens[0], lens[1], 0.036, "plastic_black", seg=16)
    # cable from the camera up to the conduit bundle
    cyl(Cc, (0.36, cy - 0.40, 3.37), (0.43, cy - 0.30, 3.74), 0.006, "wire", seg=6)
    finish(Cc.build("Canopy_CCTV", c), recalc=False, smooth=35, bevel=0.004, seg=1)


STEPS = [
    ("columns", build_columns),
    ("frame", build_frame),
    ("purlins", build_purlins),
    ("roof", build_roof),
    ("lights", build_lights),
    ("services", build_services),
]
