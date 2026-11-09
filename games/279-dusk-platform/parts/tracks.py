"""Tracks, track bed, catenary, left parapet + fence, right retaining wall + fence + hedge.  Collection "Tracks".

Coordinates follow parts/common.py.  Both tracks run y = -200 .. 700.  Everything is modelled at its world position
(objects at the origin) so object-space UVs / positions are in world metres, except the catenary poles and
cantilevers, which are linked duplicates of one mesh per variant.

Track cross-section (right side, u = |x|; the left side is the mirror image):
  4.40 platform wall (platform.py)  | 3.80-8.70 concrete track bed slab top -1.60
  4.75-5.14 ballast slope           | 5.30-7.30 PC sleepers (2.0 m) around the track centre 6.30
  5.14-7.44 ballast crib ~-1.29     | 7.44-7.70 ballast shoulder down to the slab
  7.70-7.80 toe curb                | 7.83-8.27 pole pedestals (poles at u=8.05)
  8.29-8.67 cable trough with lids  | 8.70 parapet face (left) / retaining wall face (right)
Left only: pole plinths 7.78-8.72 up to z -0.60, steel cable rack 8.42-8.69 at z -0.88..-0.72 on the parapet face,
  precast cap 8.655-9.10 at z -0.20..-0.09, framed glass-panel fence at u 8.88 up to z 1.40.
Right only: dark bar fence on the planting kerb at u 9.13 (0.82 m, per-post lean/height scatter), partly inside the
  hedge front.
Sight line: from the shot camera (eye 1.55) over the platform edge (4.60, 0) the parapet face is visible only above
  z -1.38 and the far rail only above z -0.76, so the left track itself is hidden; detail goes on the parapet face.
"""
import bpy, bmesh, math
import numpy as np
from mathutils import Vector, noise
import common as C

Y0, Y1 = -200.0, 700.0
NEAR0, NEAR1 = -40.0, 80.0          # dense / noisy ballast
DET0, DET1 = -40.0, 130.0           # detailed sleeper fastenings
POLE_U = 8.05
CW_Z = C.RAIL_TOP + 5.00            # contact wire height (3.90)
MW_Z = CW_Z + 0.96                  # messenger at the supports (4.86)
ARM_Z = 5.02                        # upper cantilever tube
REG_Z = 4.10                        # lower (registration) tube
FEED_Z = 6.85
RET_Z = 6.10
POLE_TOP = 6.95
POLES_R = [-5.0 + 50.0 * k for k in range(-4, 15)]   # -205 .. 695 (none in front of the nearest posters)
POLES_L = [20.0 + 50.0 * k for k in range(-5, 14)]   # -230 .. 670
RAIL_DX = C.GAUGE / 2 + 0.0325       # rail centre from the track centre (gauge is measured at the head)
FOOT_Z = C.RAIL_TOP - 0.153          # rail foot underside (-1.253)
SLEEPER_TOP = FOOT_Z - 0.012         # 12 mm rail pad (-1.265)
SLEEPER_BOT = -1.435
CRIB_Z = -1.292
WALL_TOP = C.RIGHT_WALL_TOP
COPING_Z = (1.56, 1.78)
GN_NAME = "trk_hedge_leaves_gn"
HN0, HN1 = -30.0, 125.0             # hedge with leaf instances
# left parapet (city side): precast cap, steel cable rack on the inner face, pole plinths, framed glass fence
CAP_Z = (-0.20, -0.09)              # cap underside (= parapet top) / cap top
PAR_CAP_U = 8.655                   # cap inner face (oversails the parapet face at 8.70 by 45 mm)
RACK_Z = (-0.88, -0.72)             # cable rack floor / lid
PLINTH_Z = -0.60                    # top of the catenary pole plinths (above the platform-edge sight line)
FENCE_L_TOP = 1.40                  # left fence handrail top (about 0.15 m below eye height)
# right retaining wall: low dark bar fence on the planting kerb, partly swallowed by the hedge front
FENCE_R_U = 9.13
FENCE_R_H = 0.82

COLL = "Tracks"


def _coll():
    return C.coll(COLL)


# =============================================================================================== fast mesh builder
class MB:
    """numpy mesh accumulator: verts, flat loop indices, polygon sizes, material indices."""

    def __init__(self):
        self.V, self.L, self.S, self.M = [], [], [], []
        self.keys, self.n = [], 0

    def k(self, key):
        if key not in self.keys:
            self.keys.append(key)
        return self.keys.index(key)

    def add(self, verts, faces, key, mirror=False):
        if not faces:
            return
        V = np.asarray(verts, dtype=np.float64).reshape(-1, 3).copy()
        if mirror:
            V[:, 0] *= -1.0
        sizes = np.fromiter((len(f) for f in faces), dtype=np.int64, count=len(faces))
        if mirror:
            flat = np.fromiter((i for f in faces for i in reversed(f)), dtype=np.int64, count=int(sizes.sum()))
        else:
            flat = np.fromiter((i for f in faces for i in f), dtype=np.int64, count=int(sizes.sum()))
        self.add_np(V, flat, sizes, key)

    def add_np(self, V, flat, sizes, key):
        self.V.append(np.asarray(V, dtype=np.float64).reshape(-1, 3))
        self.L.append(np.asarray(flat, dtype=np.int64) + self.n)
        self.S.append(np.asarray(sizes, dtype=np.int64))
        if isinstance(key, str):
            self.M.append(np.full(len(sizes), self.k(key), dtype=np.int64))
        else:                                   # per-face key list
            self.M.append(np.array([self.k(x) for x in key], dtype=np.int64))
        self.n += len(self.V[-1])

    def box(self, x0, x1, y0, y1, z0, z1, key):
        v, f = C.box_geo(min(x0, x1), max(x0, x1), min(y0, y1), max(y0, y1), min(z0, z1), max(z0, z1))
        self.add(v, f, key)

    def tile(self, verts, faces, keys, mats):
        """Repeat one unit (verts, faces, per-face keys) under a stack of 4x4 matrices (N,4,4)."""
        V = np.asarray(verts, dtype=np.float64).reshape(-1, 3)
        nv = len(V)
        sizes = np.fromiter((len(f) for f in faces), dtype=np.int64, count=len(faces))
        flat = np.fromiter((i for f in faces for i in f), dtype=np.int64, count=int(sizes.sum()))
        mats = np.asarray(mats, dtype=np.float64)
        N = len(mats)
        Vh = np.c_[V, np.ones(nv)]                                   # (nv,4)
        W = np.einsum("nij,vj->nvi", mats, Vh)[:, :, :3].reshape(-1, 3)
        F = (flat[None, :] + (np.arange(N) * nv)[:, None]).ravel()
        S = np.tile(sizes, N)
        mi = [self.k(x) for x in keys] if not isinstance(keys, str) else [self.k(keys)] * len(faces)
        self.V.append(W); self.L.append(F + self.n); self.S.append(S)
        self.M.append(np.tile(np.asarray(mi, dtype=np.int64), N))
        self.n += len(W)

    def build(self, name, c, smooth=False, sharp_deg=None):
        V = np.concatenate(self.V); L = np.concatenate(self.L); S = np.concatenate(self.S); M = np.concatenate(self.M)
        return np_mesh(name, V, L, S, M, self.keys, c, smooth, sharp_deg)


def np_mesh(name, V, L, S, M, keys, c, smooth=False, sharp_deg=None):
    old = bpy.data.meshes.get(name)
    if old is not None and old.users == 0:
        bpy.data.meshes.remove(old)
    me = bpy.data.meshes.new(name)
    me.vertices.add(len(V))
    me.vertices.foreach_set("co", V.astype(np.float32).ravel())
    me.loops.add(len(L))
    me.loops.foreach_set("vertex_index", L.astype(np.int32))
    me.polygons.add(len(S))
    starts = np.zeros(len(S), dtype=np.int32)
    starts[1:] = np.cumsum(S)[:-1]
    me.polygons.foreach_set("loop_start", starts)
    me.update(calc_edges=True)
    for k in keys:
        me.materials.append(C.mat(k))
    me.polygons.foreach_set("material_index", M.astype(np.int32))
    me.polygons.foreach_set("use_smooth", np.full(len(S), bool(smooth)))
    np_uv(me, V, L, S)
    if sharp_deg is not None:
        _sharp_edges(me, sharp_deg)
    me.update()
    ob = bpy.data.objects.new(name, me)
    c.objects.link(ob)
    return ob


def np_uv(me, V, L, S):
    """Box-projected UVs in object space, 1 UV unit = 1 m (same convention as C.uv_box)."""
    if len(S) == 0:
        return
    pn = np.empty(len(S) * 3, dtype=np.float32)
    if hasattr(me, "polygon_normals"):
        me.polygon_normals.foreach_get("vector", pn)
    else:
        me.polygons.foreach_get("normal", pn)
    ax = np.abs(pn.reshape(-1, 3)).argmax(axis=1)
    lax = np.repeat(ax, S)
    co = V[L]
    u = np.where(lax == 0, co[:, 1], co[:, 0])
    v = np.where(lax == 2, co[:, 1], co[:, 2])
    uvl = me.uv_layers.new(name="UVMap")
    uvl.data.foreach_set("uv", np.c_[u, v].astype(np.float32).ravel())


def _sharp_edges(me, deg):
    """Mark edges sharper than `deg` (smooth shading elsewhere), numpy version of C.smooth_by_angle."""
    me.polygons.foreach_set("use_smooth", np.ones(len(me.polygons), dtype=bool))
    bm = bmesh.new(); bm.from_mesh(me)
    lim = math.radians(deg)
    sharp = [(not e.is_manifold) or (len(e.link_faces) == 2 and e.calc_face_angle(0.0) > lim) for e in bm.edges]
    bm.free()
    attr = me.attributes.get("sharp_edge") or me.attributes.new("sharp_edge", "BOOLEAN", "EDGE")
    attr.data.foreach_set("value", sharp)


# =============================================================================================== geometry primitives
def _area2(p):
    return sum(p[i][0] * p[(i + 1) % len(p)][1] - p[(i + 1) % len(p)][0] * p[i][1] for i in range(len(p))) * 0.5


def extrude_y(prof, ys, closed=True, caps=True):
    """Sweep a 2-D profile [(x, z), ...] along +Y through the stations `ys`. Outward normals."""
    n = len(prof); m = len(ys)
    V = [(x, y, z) for y in ys for (x, z) in prof]
    ccw = _area2(prof) > 0 if closed else True
    F = []
    rng_j = range(n) if closed else range(n - 1)
    for i in range(m - 1):
        for j in rng_j:
            jj = (j + 1) % n
            a, b, c_, d = i * n + j, i * n + jj, (i + 1) * n + jj, (i + 1) * n + j
            F.append((a, d, c_, b) if ccw else (a, b, c_, d))
    if closed and caps:
        s = list(range(n)); e = [(m - 1) * n + j for j in range(n)]
        F.append(tuple(s) if ccw else tuple(reversed(s)))
        F.append(tuple(reversed(e)) if ccw else tuple(e))
    return V, F


def loft_x(sections):
    """Loft closed (y, z) sections (CCW, y right / z up) placed at x stations: [(x, [(y, z), ...]), ...]."""
    n = len(sections[0][1]); m = len(sections)
    V = [(x, y, z) for x, pts in sections for (y, z) in pts]
    F = []
    for i in range(m - 1):
        for j in range(n):
            jj = (j + 1) % n
            F.append((i * n + j, i * n + jj, (i + 1) * n + jj, (i + 1) * n + j))
    F.append(tuple(reversed(range(n))))
    F.append(tuple((m - 1) * n + j for j in range(n)))
    return V, F


def tube_np(P, r, seg=6, caps=False):
    """Tube along a polyline P (N,3). Returns (V (N*seg,3), flat loops, sizes)."""
    P = np.asarray(P, dtype=np.float64)
    N = len(P)
    T = np.zeros_like(P)
    T[1:-1] = P[2:] - P[:-2]
    T[0] = P[1] - P[0]; T[-1] = P[-1] - P[-2]
    T /= np.linalg.norm(T, axis=1, keepdims=True)
    ref = np.where(np.abs(T[:, 2:3]) < 0.9, np.array([[0.0, 0.0, 1.0]]), np.array([[1.0, 0.0, 0.0]]))
    N1 = np.cross(T, ref); N1 /= np.linalg.norm(N1, axis=1, keepdims=True)
    N2 = np.cross(T, N1)
    a = np.arange(seg) * (2 * math.pi / seg)
    V = P[:, None, :] + r * (np.cos(a)[None, :, None] * N1[:, None, :] + np.sin(a)[None, :, None] * N2[:, None, :])
    V = V.reshape(-1, 3)
    i = np.arange(N - 1)[:, None]; j = np.arange(seg)[None, :]; jj = (j + 1) % seg
    q = np.stack([i * seg + j, i * seg + jj, (i + 1) * seg + jj, (i + 1) * seg + j], axis=-1).reshape(-1, 4)
    # (N1, N2, T) is right-handed, rings run CCW about T, so (j, j+1, next j+1, next j) faces outward
    flat = q.ravel(); sizes = np.full(len(q), 4)
    if caps:
        c0 = np.arange(seg)[::-1]; c1 = (N - 1) * seg + np.arange(seg)
        flat = np.concatenate([flat, c0, c1]); sizes = np.concatenate([sizes, [seg, seg]])
    return V, flat, sizes


def add_tube(mb, P, r, key, seg=6, caps=False):
    V, fl, sz = tube_np(P, r, seg, caps)
    mb.add_np(V, fl, sz, key)


def lathe(p0, p1, prof, seg=12):
    """Surface of revolution along p0->p1. prof = [(t in metres along axis, radius), ...]; capped ends."""
    p0, p1 = Vector(p0), Vector(p1)
    ax = (p1 - p0).normalized()
    t = ax.orthogonal().normalized(); b = ax.cross(t)
    V, F = [], []
    for (s, r) in prof:
        c = p0 + ax * s
        for i in range(seg):
            a = 2 * math.pi * i / seg
            V.append(tuple(c + (t * math.cos(a) + b * math.sin(a)) * r))
    n = len(prof)
    for k in range(n - 1):
        for i in range(seg):
            j = (i + 1) % seg
            F.append((k * seg + i, k * seg + j, (k + 1) * seg + j, (k + 1) * seg + i))
    F.append(tuple(reversed(range(seg))))
    F.append(tuple((n - 1) * seg + i for i in range(seg)))
    return V, F


def cyl(p0, p1, r, seg=12, cap=True):
    return C.cyl_geo(p0, p1, r, seg, cap)


def _fix_cyl(V, F, p0, p1):
    """C.cyl_geo winding depends on its frame; make the side faces point outward."""
    p0 = Vector(p0); p1 = Vector(p1); ax = (p1 - p0)
    f = F[0]
    a, b, d = Vector(V[f[0]]), Vector(V[f[1]]), Vector(V[f[3]])
    nrm = (b - a).cross(d - a)
    mid = (a + b) * 0.5
    radial = (mid - p0) - ax.normalized() * (mid - p0).dot(ax.normalized())
    if nrm.dot(radial) < 0:
        F = [tuple(reversed(q)) for q in F]
    return V, F


def cylf(p0, p1, r, seg=12, cap=True):
    V, F = C.cyl_geo(p0, p1, r, seg, cap)
    return _fix_cyl(V, F, p0, p1)


def rail_profile():
    """JIS 50N-like rail, CCW in (x, z), z from the foot underside.  Head 65 mm wide, 153 mm tall, foot 127 mm."""
    half = [(0.0, 0.0), (0.0635, 0.0), (0.0635, 0.0085), (0.0615, 0.0115), (0.040, 0.0185), (0.020, 0.0255),
            (0.0115, 0.0315), (0.0080, 0.0400), (0.0075, 0.0480), (0.0075, 0.0990), (0.0085, 0.1060),
            (0.0130, 0.1110), (0.0300, 0.1155), (0.0325, 0.1190), (0.0325, 0.1405), (0.0315, 0.1460),
            (0.0285, 0.1495), (0.0230, 0.1517), (0.0140, 0.1527), (0.0, 0.1530)]
    left = [(-x, z) for (x, z) in reversed(half[1:-1])]
    return half + left


# =============================================================================================== step 1: track bed
def step_bed():
    # wipe the collection and any orphaned meshes of a previous run
    C.coll(COLL, fresh=True)
    for me in list(bpy.data.meshes):
        if me.name.startswith("trk_") and me.users == 0:
            bpy.data.meshes.remove(me)
    c = _coll()
    mb = MB()
    for s in (1, -1):
        m = s < 0
        # concrete deck / track-bed slab (left continues under the parapet)
        u1 = 8.72 if s > 0 else 8.71
        v, f = C.box_geo(3.80, u1, Y0, Y1, C.TRACK_BED - 0.30, C.TRACK_BED)
        mb.add(v, f, "concrete", m)
        # small drainage channel at the foot of the platform wall (u 4.42..4.70)
        v, f = extrude_y([(4.42, C.TRACK_BED - 0.0), (4.42, C.TRACK_BED + 0.045), (4.47, C.TRACK_BED + 0.055),
                          (4.50, C.TRACK_BED + 0.05), (4.50, C.TRACK_BED + 0.002), (4.66, C.TRACK_BED + 0.002),
                          (4.66, C.TRACK_BED + 0.05), (4.69, C.TRACK_BED + 0.055), (4.74, C.TRACK_BED + 0.045),
                          (4.74, C.TRACK_BED)], [Y0, Y1])
        mb.add(v, f, "concrete_dark", m)
        # toe curb holding the ballast shoulder, cast in 2 m pieces
        y = Y0
        while y < Y1 - 0.01:
            y2 = min(Y1, y + 2.0)
            v, f = C.box_geo(7.70, 7.80, y + 0.006, y2 - 0.006, C.TRACK_BED, C.TRACK_BED + 0.14)
            mb.add(v, f, "concrete", m)
            y = y2
        # cable trough: two walls + floor, lids 0.6 m with 6 mm gaps
        z0 = C.TRACK_BED
        v, f = C.box_geo(8.29, 8.33, Y0, Y1, z0, z0 + 0.19); mb.add(v, f, "concrete", m)
        v, f = C.box_geo(8.63, 8.67, Y0, Y1, z0, z0 + 0.19); mb.add(v, f, "concrete", m)
        v, f = C.box_geo(8.33, 8.63, Y0, Y1, z0, z0 + 0.03); mb.add(v, f, "concrete_dark", m)
        y = Y0
        while y < Y1 - 0.01:
            y2 = min(Y1, y + 0.6)
            v, f = C.box_geo(8.285, 8.675, y + 0.003, y2 - 0.003, z0 + 0.19, z0 + 0.225)
            mb.add(v, f, "concrete", m)
            y = y2
        # cables visible through the lid gaps
        for k, du in enumerate((8.39, 8.46, 8.53)):
            add_tube(mb, [(s * du, Y0, z0 + 0.05 + 0.01 * k), (s * du, Y1, z0 + 0.05 + 0.01 * k)], 0.018,
                     "plastic_black", seg=6)
    ob = mb.build("trk_bed", c)
    C.add_bevel(ob, 0.006, 1, 40)


# =============================================================================================== step 2: ballast
BAL_KNOTS = [(4.74, C.TRACK_BED + 0.012), (4.90, -1.47), (5.03, -1.36), (5.15, CRIB_Z),
             (7.43, CRIB_Z), (7.54, -1.36), (7.62, -1.47), (7.71, C.TRACK_BED + 0.012)]


def _bal_z(u):
    ks = BAL_KNOTS
    if u <= ks[0][0]:
        return ks[0][1]
    for (u0, z0), (u1, z1) in zip(ks, ks[1:]):
        if u <= u1:
            t = (u - u0) / (u1 - u0)
            return z0 + (z1 - z0) * t
    return ks[-1][1]


def _bal_grid(us, ys, s, disp):
    nu, ny = len(us), len(ys)
    V = np.zeros((ny, nu, 3))
    for j, y in enumerate(ys):
        for i, u in enumerate(us):
            V[j, i] = (s * u, y, _bal_z(u))
    if disp:
        fade_ok = lambda y: min(1.0, max(0.0, (y - NEAR0) / 4.0), max(0.0, (NEAR1 - y) / 4.0))
        for j, y in enumerate(ys):
            fy = fade_ok(y)
            if fy <= 0:
                continue
            for i, u in enumerate(us):
                if i == 0 or i == nu - 1:
                    continue
                x = s * u
                on_crib = 5.15 <= u <= 7.43
                amp = 0.007 if on_crib else 0.020
                p = Vector((x * 3.1, y * 3.1, 0.3 * s))
                n1 = noise.noise(p)
                n2 = noise.noise(Vector((x * 9.0, y * 9.0, 7.7)))
                dz = amp * (0.65 * n1 + 0.35 * n2) * fy
                if on_crib:
                    dz = min(dz, 0.012)          # stay below the sleeper tops
                dx = 0.0 if on_crib else 0.012 * noise.noise(Vector((x * 5.0, y * 5.0, 3.3))) * fy
                V[j, i, 2] += dz
                V[j, i, 0] += dx * s
    V = V.reshape(-1, 3)
    i = np.arange(nu - 1)[None, :]; j = np.arange(ny - 1)[:, None]
    q = np.stack([j * nu + i, j * nu + i + 1, (j + 1) * nu + i + 1, (j + 1) * nu + i], axis=-1).reshape(-1, 4)
    if s < 0:
        q = q[:, ::-1]
    return V, q.ravel(), np.full(len(q), 4)


def step_ballast():
    c = _coll()
    knots_u = [k[0] for k in BAL_KNOTS]
    us_near = sorted(set([round(u, 4) for u in knots_u] +
                         [round(u, 4) for u in np.arange(5.15, 7.43, 0.07)] +
                         [round(u, 4) for u in np.linspace(4.74, 5.15, 7)] +
                         [round(u, 4) for u in np.linspace(7.43, 7.71, 6)]))
    ys_near = list(np.arange(NEAR0, NEAR1 + 1e-6, 0.10))
    us_far = sorted(set(knots_u + [6.3]))
    ys_far_a = list(np.arange(Y0, NEAR0 + 1e-6, 2.0))
    ys_far_b = list(np.arange(NEAR1, Y1 + 1e-6, 2.0))
    near, far = MB(), MB()
    for s in (1, -1):
        V, L, S = _bal_grid(us_near, ys_near, s, True)
        near.add_np(V, L, S, "ballast")
        for ys in (ys_far_a, ys_far_b):
            V, L, S = _bal_grid(us_far, ys, s, False)
            far.add_np(V, L, S, "ballast")
    near.build("trk_ballast_near", c, smooth=True)
    far.build("trk_ballast_far", c, smooth=True)


# =============================================================================================== step 3: sleepers
def _sleeper_unit(level):
    """level 2: sleeper + pads + full fastenings, 1: sleeper + pads + simple clips, 0: sleeper + pads."""
    zb, zt = SLEEPER_BOT, SLEEPER_TOP
    st = [(-1.000, 0.098, zt - 0.014), (-0.990, 0.110, zt - 0.003), (-0.975, 0.112, zt),
          (-0.45, 0.112, zt), (-0.33, 0.104, zt - 0.022), (0.33, 0.104, zt - 0.022), (0.45, 0.112, zt),
          (0.975, 0.112, zt), (0.990, 0.110, zt - 0.003), (1.000, 0.098, zt - 0.014)]
    secs = []
    for x, hw, top in st:
        hb = hw + 0.012
        secs.append((x, [(-hb, zb), (hb, zb), (hw, top - 0.010), (hw - 0.010, top), (-(hw - 0.010), top),
                         (-hw, top - 0.010)]))
    V, F = loft_x(secs)
    K = ["sleeper"] * len(F)

    def put(v, f, key):
        n = len(V); V.extend(v); F.extend([tuple(i + n for i in q) for q in f]); K.extend([key] * len(f))

    for rc in (-RAIL_DX, RAIL_DX):
        put(*C.box_geo(rc - 0.075, rc + 0.075, -0.080, 0.080, zt - 0.002, FOOT_Z), "plastic_black")
        if level == 0:
            continue
        for d in (-1, 1):
            e = rc + d * 0.0635
            if level == 1:
                x0, x1 = sorted((e - d * 0.010, e + d * 0.075))
                put(*C.box_geo(x0, x1, -0.034, 0.034, FOOT_Z + 0.008, FOOT_Z + 0.022), "steel_dark")
                continue
            # nylon shoulder insulator against the foot edge
            x0, x1 = sorted((e + d * 0.001, e + d * 0.022))
            put(*C.box_geo(x0, x1, -0.052, 0.052, zt, FOOT_Z + 0.016), "plastic_black")
            # cast shoulder anchored in the sleeper
            x0, x1 = sorted((e + d * 0.022, e + d * 0.112))
            put(*C.box_geo(x0, x1, -0.045, 0.045, zt, zt + 0.018), "steel_dark")
            # plate spring: toe on the foot, bent up over the bolt, heel on the shoulder
            for (a, b, z0, z1) in ((-0.012, 0.030, FOOT_Z + 0.010, FOOT_Z + 0.019),
                                   (0.030, 0.085, FOOT_Z + 0.017, FOOT_Z + 0.026),
                                   (0.085, 0.108, zt + 0.018, zt + 0.027)):
                x0, x1 = sorted((e + d * a, e + d * b))
                put(*C.box_geo(x0, x1, -0.032, 0.032, z0, z1), "steel_dark")
            bx = e + d * 0.057
            put(*cylf((bx, 0, FOOT_Z + 0.026), (bx, 0, FOOT_Z + 0.030), 0.022, 10), "galvanized")     # washer
            put(*cylf((bx, 0, FOOT_Z + 0.030), (bx, 0, FOOT_Z + 0.046), 0.017, 6), "galvanized")     # hex nut
            put(*cylf((bx, 0, FOOT_Z + 0.046), (bx, 0, FOOT_Z + 0.060), 0.010, 8), "galvanized")     # bolt end
    return V, F, K


def _sleeper_mats(s, ys, seed):
    r = C.rng(seed)
    out = []
    for y in ys:
        a = math.radians(r.uniform(-0.35, 0.35))
        dy = r.uniform(-0.008, 0.008)
        dx = r.uniform(-0.006, 0.006)
        ca, sa = math.cos(a), math.sin(a)
        out.append([[ca, -sa, 0, s * C.TRACK_X + dx], [sa, ca, 0, y + dy], [0, 0, 1, 0], [0, 0, 0, 1]])
    return out


def step_sleepers():
    c = _coll()
    ys_all = list(np.arange(Y0 + 0.3, Y1, 0.6))
    near = [y for y in ys_all if DET0 <= y <= DET1]
    mid = [y for y in ys_all if (-120 <= y < DET0) or (DET1 < y <= 320)]
    far = [y for y in ys_all if y < -120 or y > 320]
    for lvl, ys, nm in ((2, near, "trk_sleepers_near"), (1, mid, "trk_sleepers_mid"), (0, far, "trk_sleepers_far")):
        V, F, K = _sleeper_unit(lvl)
        mb = MB()
        for s in (1, -1):
            mb.tile(V, F, K, _sleeper_mats(s, ys, 11 + s + lvl * 7))
        ob = mb.build(nm, c, smooth=False)
        if lvl == 2:
            # nuts / washers smooth, boxes flat: sharp edges by angle
            _sharp_edges(ob.data, 40)


# =============================================================================================== step 4: rails
def step_rails():
    c = _coll()
    prof = rail_profile()
    ys = list(np.arange(Y0, Y1 + 1e-6, 10.0))
    mb = MB()
    for s in (1, -1):
        for rd in (-RAIL_DX, RAIL_DX):
            xc = s * C.TRACK_X + rd
            # rails are canted 1:40 toward the track centre (rotate the profile about the foot centre)
            a = math.atan(1 / 40.0) * (1 if xc > s * C.TRACK_X else -1)
            ca, sa = math.cos(a), math.sin(a)
            p = [(xc + x * ca - z * sa, FOOT_Z + x * sa + z * ca) for (x, z) in prof]
            v, f = extrude_y(p, ys)
            mb.add(v, f, "rail_steel")
    ob = mb.build("trk_rails", c, smooth=True, sharp_deg=32)
    # welded joints: thin collar rings every 50 m on each rail (thermite weld bulges)
    wb = MB()
    for s in (1, -1):
        for rd in (-RAIL_DX, RAIL_DX):
            xc = s * C.TRACK_X + rd
            for y in np.arange(Y0 + 23.0, Y1, 50.0):
                v, f = C.box_geo(xc - 0.010, xc + 0.010, y - 0.03, y + 0.03, FOOT_Z + 0.03, FOOT_Z + 0.12)
                wb.add(v, f, "rail_steel")
                v, f = C.box_geo(xc - 0.0335, xc + 0.0335, y - 0.025, y + 0.025, FOOT_Z + 0.112, FOOT_Z + 0.1515)
                wb.add(v, f, "rail_steel")
    wo = wb.build("trk_rail_welds", c)
    C.add_bevel(wo, 0.004, 1, 40)


# =============================================================================================== step 5: left parapet + fence
def _beam(mb, p0, p1, a, b, key, up=(0.0, 0.0, 1.0)):
    """Rectangular bar from p0 to p1, half-sizes a (across, horizontal) and b (across, toward `up`). Capped."""
    p0 = np.asarray(p0, dtype=np.float64); p1 = np.asarray(p1, dtype=np.float64)
    t = p1 - p0; t /= np.linalg.norm(t)
    up = np.asarray(up, dtype=np.float64)
    if abs(np.dot(t, up)) > 0.9:
        up = np.array([1.0, 0.0, 0.0])
    e1 = np.cross(up, t); e1 /= np.linalg.norm(e1)        # (e1, e2, t) right-handed
    e2 = np.cross(t, e1)
    ring = [(-a, -b), (a, -b), (a, b), (-a, b)]
    V = [p + e1 * x + e2 * z for p in (p0, p1) for (x, z) in ring]
    F = [(0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7), (3, 2, 1, 0), (4, 5, 6, 7)]
    mb.add(V, F, key)


def _glass_fence(mb, s, u, z0, z1, y0, y1, pitch, seed):
    """Framed-panel fence (left, city side): square posts, each 2 m bay a welded frame (bottom rail, mid rail,
    handrail, two stiles) holding two clear polycarbonate panes.  Panes get a few mm of random yaw so their
    reflections don't line up into one mirror for 900 m."""
    r = C.rng(seed)
    x = s * u
    ys = list(np.arange(y0, y1 + 1e-6, pitch))
    zm = z0 + 0.60 * (z1 - z0)
    for y in ys:
        mb.box(x - 0.040, x + 0.040, y - 0.035, y + 0.035, z0, z1, "steel_dark")                   # post
        mb.box(x - 0.044, x + 0.044, y - 0.039, y + 0.039, z1, z1 + 0.010, "steel_dark")           # cap
        mb.box(x - 0.085, x + 0.085, y - 0.080, y + 0.080, z0, z0 + 0.012, "steel_dark")           # base plate
        for dx in (-0.06, 0.06):
            for dy in (-0.055, 0.055):
                mb.box(x + dx - 0.010, x + dx + 0.010, y + dy - 0.010, y + dy + 0.010, z0 + 0.012, z0 + 0.034,
                       "galvanized")                                                              # anchor nuts
    for ya, yb in zip(ys, ys[1:]):
        a, b = ya + 0.036, yb - 0.036
        da, db = r.uniform(-0.004, 0.004), r.uniform(-0.004, 0.004)
        xa, xb = x + da, x + db
        _beam(mb, (xa, a, z0 + 0.10), (xb, b, z0 + 0.10), 0.020, 0.020, "steel_dark")             # bottom rail
        _beam(mb, (xa, a, zm), (xb, b, zm), 0.016, 0.016, "steel_dark")                           # mid rail
        _beam(mb, (xa, a, z1 - 0.030), (xb, b, z1 - 0.030), 0.030, 0.030, "steel_dark")           # handrail
        for (yy, xx) in ((a + 0.022, xa), (b - 0.022, xb)):
            _beam(mb, (xx, yy, z0 + 0.12), (xx, yy, z1 - 0.06), 0.016, 0.016, "steel_dark")       # stiles
        # panes (single quads, thin-walled glass), edges hidden in the frame
        g0, g1 = a + 0.030, b - 0.030
        xg0 = xa + (xb - xa) * (g0 - a) / (b - a); xg1 = xa + (xb - xa) * (g1 - a) / (b - a)
        for (za, zb) in ((z0 + 0.105, zm - 0.004), (zm + 0.004, z1 - 0.035)):
            q = [(xg0, g0, za), (xg1, g1, za), (xg1, g1, zb), (xg0, g0, zb)]
            mb.add(q, [(0, 1, 2, 3) if s > 0 else (3, 2, 1, 0)], "glass")


def step_left():
    c = _coll()
    zt = -0.20
    prof = [(8.70, C.TRACK_BED - 0.30), (8.70, zt - 0.025), (8.725, zt), (9.035, zt), (9.06, zt - 0.025),
            (9.06, -1.80), (9.13, -1.84), (9.13, -2.55), (9.06, -2.60), (9.06, C.CITY_GROUND_Z - 0.5),
            (8.40, C.CITY_GROUND_Z - 0.5), (8.40, C.TRACK_BED - 0.30)]
    mb = MB()
    # cast in 10 m bays with 20 mm expansion joints
    y = Y0
    while y < Y1 - 0.01:
        y2 = min(Y1, y + 10.0)
        v, f = extrude_y(prof, [y + 0.01, y2 - 0.01])
        mb.add(v, f, "concrete", mirror=True)
        y = y2
    # joint filler (dark, recessed 15 mm)
    for y in np.arange(Y0 + 10.0, Y1 - 1, 10.0):
        v, f = extrude_y([(8.715, C.TRACK_BED), (8.715, zt - 0.01), (9.045, zt - 0.01), (9.045, C.TRACK_BED)],
                         [y - 0.011, y + 0.011])
        mb.add(v, f, "concrete_dark", mirror=True)
    # precast cap, 2 m pieces, oversailing the inner face by 45 mm with a drip groove (shadow line at the top)
    cap = [(PAR_CAP_U, CAP_Z[0]), (PAR_CAP_U, CAP_Z[1] - 0.02), (PAR_CAP_U + 0.02, CAP_Z[1]),
           (9.08, CAP_Z[1]), (9.10, CAP_Z[1] - 0.02), (9.10, CAP_Z[0]),
           (8.685, CAP_Z[0]), (8.685, CAP_Z[0] + 0.012), (8.675, CAP_Z[0] + 0.012), (8.675, CAP_Z[0])]
    cap = [(u, z) for (u, z) in reversed(cap)] if _area2(cap) < 0 else cap
    y = Y0
    while y < Y1 - 0.01:
        y2 = min(Y1, y + 2.0)
        v, f = extrude_y(cap, [y + 0.004, y2 - 0.004])
        mb.add(v, f, "concrete", mirror=True)
        y = y2
    # catenary pole plinths, cast against the parapet and tall enough to clear the platform-edge sight line
    for yp in POLES_L:
        v, f = C.box_geo(7.78, 8.72, yp - 0.34, yp + 0.34, C.TRACK_BED, PLINTH_Z)
        mb.add(v, f, "concrete", mirror=True)
    ob = mb.build("trk_parapet", c)
    C.add_bevel(ob, 0.008, 1, 40)

    # --- inner-face fittings: steel cable rack on brackets, plinth base plates, form-tie plugs
    db = MB()
    zr0, zr1 = RACK_Z
    for yb in np.arange(Y0 + 0.75, Y1, 1.5):
        # bracket: wall plate + arm + diagonal brace
        db.box(-8.70, -8.688, yb - 0.04, yb + 0.04, zr0 - 0.28, zr0 + 0.02, "steel_dark")
        db.box(-8.688, -8.40, yb - 0.022, yb + 0.022, zr0 - 0.035, zr0, "steel_dark")
        _beam(db, (-8.69, yb, zr0 - 0.25), (-8.45, yb, zr0 - 0.03), 0.010, 0.016, "steel_dark",
              up=(0.0, 1.0, 0.0))
    # trough: floor, back (wall side) and front lip, lids in 1.5 m pieces with gaps
    v, f = C.box_geo(-8.685, -8.42, Y0, Y1, zr0, zr0 + 0.006); db.add(v, f, "galvanized")
    v, f = C.box_geo(-8.426, -8.42, Y0, Y1, zr0, zr1); db.add(v, f, "galvanized")
    v, f = C.box_geo(-8.685, -8.679, Y0, Y1, zr0, zr1); db.add(v, f, "galvanized")
    r = C.rng(2791)
    y = Y0
    while y < Y1 - 0.01:
        y2 = min(Y1, y + 1.5)
        lift = 0.0 if r.random() > 0.06 else 0.006           # the odd lid not seated properly
        v, f = C.box_geo(-8.69, -8.412, y + 0.004, y2 - 0.004, zr1 + lift, zr1 + 0.004 + lift)
        db.add(v, f, "galvanized")
        v, f = C.box_geo(-8.42, -8.408, y + 0.004, y2 - 0.004, zr1 - 0.025 + lift, zr1 + 0.004 + lift)
        db.add(v, f, "galvanized")                            # lid front flange
        y = y2
    for yp in POLES_L:
        v, f = C.box_geo(-8.25, -7.85, yp - 0.20, yp + 0.20, PLINTH_Z, PLINTH_Z + 0.025); db.add(v, f, "galvanized")
        for sx in (-0.15, 0.15):
            for sy in (-0.15, 0.15):
                db.add(*cylf((-POLE_U + sx, yp + sy, PLINTH_Z + 0.025), (-POLE_U + sx, yp + sy, PLINTH_Z + 0.055),
                             0.020, 6), "galvanized")
        # cable duct from the rack up beside the plinth and across its top to the pole
        db.box(-8.69, -8.62, yp + 0.36, yp + 0.43, zr1 + 0.004, PLINTH_Z + 0.05, "galvanized")
        db.box(-8.69, -8.26, yp + 0.27, yp + 0.43, PLINTH_Z, PLINTH_Z + 0.05, "galvanized")
    for y in np.arange(Y0 + 0.45, Y1, 0.90):
        ph = ((y - Y0) % 10.0)
        if ph < 0.25 or ph > 9.75:
            continue
        for zc in (-0.42, -1.12):
            jx = r.uniform(-0.01, 0.01)
            db.add(*cylf((-8.70 + 0.0025, y + jx, zc), (-8.70 - 0.002, y + jx, zc), 0.0145, 8), "concrete_dark")
    do = db.build("trk_parapet_fittings", c)
    _sharp_edges(do.data, 40)

    fb = MB()
    _glass_fence(fb, -1, 8.88, CAP_Z[1], FENCE_L_TOP, Y0, Y1, 2.0, 2792)
    fo = fb.build("trk_fence_left", c)
    C.add_bevel(fo, 0.002, 1, 40)


# =============================================================================================== step 6: right retaining wall
def _bar_fence(mb, s, u, z0, h, y0, y1, pitch, bar_pitch, seed):
    """Low painted bar fence (right wall top).  Every post gets a few mm of lean and height scatter, panels follow
    their posts; about one panel in 14 is a later replacement (bare galvanized, denser bars, mid rail)."""
    r = C.rng(seed)
    x = s * u
    ys = list(np.arange(y0, y1 + 1e-6, pitch))
    lean = [r.gauss(0.0, 0.006) for _ in ys]                 # x offset of the post top (m)
    top = [z0 + h + r.uniform(-0.007, 0.007) for _ in ys]
    for y, lx, zt in zip(ys, lean, top):
        _beam(mb, (x, y, z0), (x + lx, y, zt), 0.024, 0.024, "steel_dark")
        _beam(mb, (x + lx, y, zt), (x + lx, y, zt + 0.008), 0.028, 0.028, "steel_dark")      # cap
        mb.box(x - 0.06, x + 0.06, y - 0.06, y + 0.06, z0, z0 + 0.010, "steel_dark")       # base plate

    def at(k, f):        # point on post k at height fraction f of its own height
        return (x + lean[k] * f, ys[k], z0 + (top[k] - z0) * f)

    for k in range(len(ys) - 1):
        alt = r.random() < 0.07
        key = "galvanized" if alt else "steel_dark"
        bp = bar_pitch * (0.6 if alt else 1.0)
        rails = [(0.06, 0.012, 0.016), (1.0 - 0.025 / h, 0.016, 0.020)]
        if alt:
            rails.append((0.55, 0.010, 0.012))
        for (f, a, b) in rails:
            p0 = np.array(at(k, f)); p1 = np.array(at(k + 1, f))
            p0[1] += 0.024; p1[1] -= 0.024
            _beam(mb, p0, p1, a, b, key)
        ya, yb = ys[k] + 0.024, ys[k + 1] - 0.024
        n = max(1, int(round((yb - ya) / bp)))
        for i in range(1, n):
            t = i / n
            fb_, ft = 0.06 + 0.012 / h, 1.0 - 0.041 / h
            pa = np.array(at(k, fb_)) * (1 - t) + np.array(at(k + 1, fb_)) * t
            pb = np.array(at(k, ft)) * (1 - t) + np.array(at(k + 1, ft)) * t
            _beam(mb, pa, pb, 0.007, 0.007, key)


def step_right_wall():
    c = _coll()
    xw = C.RIGHT_WALL_X
    z0, z1 = C.TRACK_BED - 0.02, COPING_Z[0]
    # face grid: x = xw + V-groove depth at panel joints (every 10 m) and one horizontal construction joint
    ys = [Y0]
    for yj in np.arange(Y0 + 10.0, Y1 - 1, 10.0):
        ys += [yj - 0.022, yj - 0.010, yj + 0.010, yj + 0.022]
    ys.append(Y1)
    zh = 0.32
    zs = [z0, -0.60, zh - 0.012, zh, zh + 0.012, z1]

    def gy(y):
        d = min(abs(y - yj) for yj in (round((y - Y0) / 10.0) * 10.0 + Y0,))
        return 0.016 if d < 0.0105 else 0.0

    def gz(z):
        return 0.010 if abs(z - zh) < 1e-4 else 0.0

    nu, nz = len(ys), len(zs)
    V = [(xw + max(gy(y), gz(z)), y, z) for z in zs for y in ys]
    F = []
    for k in range(nz - 1):
        for i in range(nu - 1):
            a = k * nu + i
            F.append((a, a + nu, a + nu + 1, a + 1))      # faces -x (toward the tracks)
    mb = MB()
    mb.add(V, F, "concrete")
    # back / top filler so the wall reads as solid from inspection views
    v, f = C.box_geo(xw + 0.02, 9.10, Y0, Y1, z0, z1 - 0.001)
    mb.add(v, [q for k, q in enumerate(f) if k not in (2, 4, 5)], "concrete")
    wall = mb.build("trk_wall_right", c)
    # coping: 2 m precast pieces with a front drip and chamfers
    cb = MB()
    prof = [(8.665, z1 - 0.010), (8.665, COPING_Z[1] - 0.018), (8.683, COPING_Z[1]), (9.10, COPING_Z[1]),
            (9.10, z1 - 0.010), (8.70, z1 - 0.010), (8.70, z1 - 0.025), (8.69, z1 - 0.025), (8.69, z1 - 0.010)]
    prof = [(8.665, z1), (8.665, COPING_Z[1] - 0.018), (8.683, COPING_Z[1]), (9.10, COPING_Z[1]), (9.10, z1)]
    y = Y0
    while y < Y1 - 0.01:
        y2 = min(Y1, y + 2.0)
        v, f = extrude_y(prof, [y + 0.003, y2 - 0.003])
        cb.add(v, f, "concrete")
        y = y2
    co = cb.build("trk_coping_right", c)
    C.add_bevel(co, 0.004, 1, 40)
    # weep holes (PVC pipe ends, flush with the face) and form-tie plugs
    db = MB()
    for y in np.arange(Y0 + 1.5, Y1, 3.0):
        if abs(((y - Y0) % 10.0) - 5.0) > 4.6:
            continue
        zc = -1.02
        # grey PVC rim (annulus facing the tracks) + short proud tube, dark bore just in front of the face
        ring = [(xw - 0.006, y + 0.042 * math.cos(2 * math.pi * i / 14), zc + 0.042 * math.sin(2 * math.pi * i / 14))
                for i in range(14)]
        inner = [(xw - 0.006, y + 0.033 * math.cos(2 * math.pi * i / 14), zc + 0.033 * math.sin(2 * math.pi * i / 14))
                 for i in range(14)]
        f = [(14 + i, 14 + (i + 1) % 14, (i + 1) % 14, i) for i in range(14)]    # faces -x
        db.add(ring + inner, f, "steel_paint")
        v, f = cylf((xw - 0.006, y, zc), (xw + 0.004, y, zc), 0.042, 14, cap=False)
        db.add(v, f, "steel_paint")
        v, f = cylf((xw - 0.004, y, zc), (xw - 0.003, y, zc), 0.0335, 14)
        db.add(v, f, "plastic_black")
    r = C.rng(279)
    for y in np.arange(Y0 + 0.45, Y1, 0.90):
        ph = ((y - Y0) % 10.0)
        if ph < 0.25 or ph > 9.75:
            continue
        for zc in (-0.85, -0.10, 0.80, 1.30):
            jx = r.uniform(-0.01, 0.01)
            v, f = cylf((xw - 0.0025, y + jx, zc), (xw + 0.002, y + jx, zc), 0.0145, 8)
            db.add(v, f, "concrete_dark")
    db.build("trk_wall_details", c, smooth=False)
    # ground strip behind the wall (hedge bed) at the top level
    gb = MB()
    v, f = C.box_geo(9.10, 10.60, Y0, Y1, WALL_TOP - 0.30, WALL_TOP)
    gb.add(v, f, "terrain")
    v, f = C.box_geo(9.08, 9.18, Y0, Y1, WALL_TOP, WALL_TOP + 0.10)      # kerb of the planting strip
    gb.add(v, f, "concrete")
    gb.build("trk_hedge_bed", c)
    fb = MB()
    _bar_fence(fb, 1, FENCE_R_U, WALL_TOP + 0.10, FENCE_R_H, Y0, Y1, 2.0, 0.13, 2793)
    fo = fb.build("trk_fence_right", c)
    C.add_bevel(fo, 0.002, 1, 40)


# =============================================================================================== step 7: hedge
HEDGE_PROF = [(9.21, WALL_TOP + 0.08), (9.15, WALL_TOP + 0.45), (9.13, WALL_TOP + 0.95), (9.16, WALL_TOP + 1.25),
              (9.27, WALL_TOP + 1.43), (9.45, WALL_TOP + 1.52), (9.70, WALL_TOP + 1.55), (9.95, WALL_TOP + 1.50),
              (10.15, WALL_TOP + 1.38), (10.27, WALL_TOP + 1.15), (10.32, WALL_TOP + 0.70), (10.32, WALL_TOP + 0.08)]
HEDGE_H = 1.55


def _resample(prof, step):
    pts = []
    for (a, b) in zip(prof, prof[1:]):
        L = math.dist(a, b); n = max(1, int(math.ceil(L / step)))
        for i in range(n):
            t = i / n
            pts.append((a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t))
    pts.append(prof[-1])
    # 2-D normals (outward = right of the walking direction for this CW-ish profile)
    nr = []
    for i in range(len(pts)):
        p0 = pts[max(0, i - 1)]; p1 = pts[min(len(pts) - 1, i + 1)]
        tx, tz = p1[0] - p0[0], p1[1] - p0[1]
        L = math.hypot(tx, tz) or 1.0
        nr.append((-tz / L, tx / L))
    return pts, nr


def _hedge_grid(ys, step, amp, seed_off):
    pts, nr = _resample(HEDGE_PROF, step)
    nu, ny = len(pts), len(ys)
    V = np.zeros((ny, nu, 3))
    for j, y in enumerate(ys):
        top = 0.10 * noise.noise(Vector((y * 0.11, 0.0, 4.0))) + 0.05 * noise.noise(Vector((y * 0.37, 2.0, 1.0)))
        for i, ((u, z), (nx, nz)) in enumerate(zip(pts, nr)):
            h = (z - WALL_TOP) / HEDGE_H
            zz = z + top * max(0.0, h)
            p = Vector((u, y, zz))
            d = 0.0
            if amp > 0:
                d = (0.11 * noise.noise(p * 1.4 + Vector((seed_off, 0, 0))) +
                     0.050 * noise.noise(p * 3.6 + Vector((0, seed_off, 0))) +
                     0.022 * noise.noise(p * 8.5)) * amp
                d = d * min(1.0, h * 4.0) if h < 0.25 else d
            V[j, i] = (u + nx * d, y, zz + nz * d)
    V = V.reshape(-1, 3)
    i = np.arange(nu - 1)[None, :]; j = np.arange(ny - 1)[:, None]
    q = np.stack([j * nu + i, j * nu + i + 1, (j + 1) * nu + i + 1, (j + 1) * nu + i], axis=-1).reshape(-1, 4)
    return V, q.ravel(), np.full(len(q), 4)


def _leaves_group():
    old = bpy.data.node_groups.get(GN_NAME)
    if old is not None:
        bpy.data.node_groups.remove(old)
    ng = bpy.data.node_groups.new(GN_NAME, "GeometryNodeTree")
    ng.interface.new_socket(name="Geometry", in_out="INPUT", socket_type="NodeSocketGeometry")
    ng.interface.new_socket(name="Geometry", in_out="OUTPUT", socket_type="NodeSocketGeometry")
    N = ng.nodes; Lk = ng.links
    gi = N.new("NodeGroupInput"); go = N.new("NodeGroupOutput")
    isv = N.new("GeometryNodeIsViewport")
    dens = N.new("ShaderNodeMath"); dens.operation = "MULTIPLY_ADD"
    Lk.new(isv.outputs[0], dens.inputs[0]); dens.inputs[1].default_value = -0.92 * 900.0
    dens.inputs[2].default_value = 900.0
    dist = N.new("GeometryNodeDistributePointsOnFaces"); dist.distribute_method = "RANDOM"
    Lk.new(gi.outputs[0], dist.inputs["Mesh"]); Lk.new(dens.outputs[0], dist.inputs["Density"])
    dist.inputs["Seed"].default_value = 279
    # push points out along the normal a little (leaves stand proud of the clipped surface)
    rnd_o = N.new("FunctionNodeRandomValue"); rnd_o.data_type = "FLOAT"
    rnd_o.inputs["Min"].default_value = -0.01; rnd_o.inputs["Max"].default_value = 0.05
    rnd_o.inputs["Seed"].default_value = 3
    sc = N.new("ShaderNodeVectorMath"); sc.operation = "SCALE"
    Lk.new(dist.outputs["Normal"], sc.inputs[0]); Lk.new(rnd_o.outputs[0], sc.inputs["Scale"])
    sp = N.new("GeometryNodeSetPosition")
    Lk.new(dist.outputs["Points"], sp.inputs["Geometry"]); Lk.new(sc.outputs[0], sp.inputs["Offset"])
    # leaf: small bent diamond (2 tris), foliage material
    leaf = N.new("GeometryNodeMeshGrid")
    leaf.inputs["Size X"].default_value = 0.070; leaf.inputs["Size Y"].default_value = 0.040
    leaf.inputs["Vertices X"].default_value = 3; leaf.inputs["Vertices Y"].default_value = 2
    sm = N.new("GeometryNodeSetMaterial"); sm.inputs["Material"].default_value = C.mat("foliage")
    Lk.new(leaf.outputs["Mesh"], sm.inputs["Geometry"])
    rnd_r = N.new("FunctionNodeRandomValue"); rnd_r.data_type = "FLOAT_VECTOR"
    rnd_r.inputs["Min"].default_value = (-math.pi, -math.pi, -math.pi)
    rnd_r.inputs["Max"].default_value = (math.pi, math.pi, math.pi)
    rnd_r.inputs["Seed"].default_value = 5
    rnd_s = N.new("FunctionNodeRandomValue"); rnd_s.data_type = "FLOAT"
    rnd_s.inputs["Min"].default_value = 0.65; rnd_s.inputs["Max"].default_value = 1.35
    rnd_s.inputs["Seed"].default_value = 7
    iop = N.new("GeometryNodeInstanceOnPoints")
    Lk.new(sp.outputs[0], iop.inputs["Points"]); Lk.new(sm.outputs[0], iop.inputs["Instance"])
    Lk.new(rnd_r.outputs[0], iop.inputs["Rotation"]); Lk.new(rnd_s.outputs[0], iop.inputs["Scale"])
    j = N.new("GeometryNodeJoinGeometry")
    Lk.new(iop.outputs[0], j.inputs[0]); Lk.new(gi.outputs[0], j.inputs[0])
    Lk.new(j.outputs[0], go.inputs[0])
    return ng


def step_hedge():
    c = _coll()
    mb = MB()
    V, L, S = _hedge_grid(list(np.arange(HN0, HN1 + 1e-6, 0.06)), 0.06, 1.0, 0.0)
    mb.add_np(V, L, S, "foliage")
    near = mb.build("trk_hedge_near", c, smooth=True)
    mod = near.modifiers.new("Leaves", "NODES")
    mod.node_group = _leaves_group()
    fb = MB()
    for (ya, yb) in ((Y0, HN0 + 0.4), (HN1 - 0.4, Y1)):     # overlap the near piece to hide the seam
        V, L, S = _hedge_grid(list(np.arange(ya, yb + 1e-6, 0.35)), 0.18, 1.0, 0.0)
        fb.add_np(V, L, S, "foliage")
    fb.build("trk_hedge_far", c, smooth=True)


# =============================================================================================== step 8: catenary poles + cantilevers
def _pole_mesh():
    """H-section steel pole on a pedestal, local origin at the pole axis at z=0 (world z). Flanges face the track."""
    mb = MB()
    zb = C.TRACK_BED + 0.20
    v, f = C.box_geo(-0.22, 0.22, -0.30, 0.30, C.TRACK_BED, zb); mb.add(v, f, "concrete")
    v, f = C.box_geo(-0.20, 0.20, -0.20, 0.20, zb, zb + 0.025); mb.add(v, f, "galvanized")
    for sx in (-0.15, 0.15):
        for sy in (-0.15, 0.15):
            mb.add(*cylf((sx, sy, zb + 0.025), (sx, sy, zb + 0.050), 0.022, 6), "galvanized")
            mb.add(*cylf((sx, sy, zb + 0.050), (sx, sy, zb + 0.085), 0.012, 8), "galvanized")
    h, t, w = 0.125, 0.014, 0.0045
    v, f = C.box_geo(-h, -h + t, -0.125, 0.125, zb + 0.025, POLE_TOP); mb.add(v, f, "galvanized")
    v, f = C.box_geo(h - t, h, -0.125, 0.125, zb + 0.025, POLE_TOP); mb.add(v, f, "galvanized")
    v, f = C.box_geo(-h + t, h - t, -w, w, zb + 0.025, POLE_TOP); mb.add(v, f, "galvanized")
    v, f = C.box_geo(-0.14, 0.14, -0.14, 0.14, POLE_TOP, POLE_TOP + 0.012); mb.add(v, f, "galvanized")
    # base stiffeners
    for sy in (-1, 1):
        v, f = C.box_geo(-h + t, h - t, sy * 0.06 - 0.005, sy * 0.06 + 0.005, zb + 0.025, zb + 0.22)
        mb.add(v, f, "galvanized")
    # cantilever clamps (both heights) and the feeder cross-arm at the top
    for zc in (ARM_Z, REG_Z):
        v, f = C.box_geo(-0.165, -h, -0.06, 0.06, zc - 0.09, zc + 0.09); mb.add(v, f, "galvanized")
        for sy in (-1, 1):
            v, f = C.box_geo(-h - 0.01, h + 0.01, sy * 0.13 - 0.008, sy * 0.13 + 0.008, zc - 0.05, zc + 0.05)
            mb.add(v, f, "galvanized")
    # feeder cross arm (angle steel) + post insulators
    v, f = C.box_geo(-0.50, 0.50, -0.04, 0.04, FEED_Z - 0.18, FEED_Z - 0.13); mb.add(v, f, "galvanized")
    for sx in (-0.42, 0.42):
        mb.add(*lathe((sx, 0, FEED_Z - 0.13), (sx, 0, FEED_Z), _shed_prof(0.13, 0.045, 0.022, 3), 10), "plastic_black")
    # return-wire bracket on the outer face
    v, f = C.box_geo(h, 0.32, -0.03, 0.03, RET_Z + 0.02, RET_Z + 0.07); mb.add(v, f, "galvanized")
    mb.add(*lathe((0.28, 0, RET_Z + 0.02), (0.28, 0, RET_Z - 0.10), _shed_prof(0.12, 0.035, 0.018, 3), 10),
           "plastic_black")
    return mb


def _shed_prof(L, R, r, n):
    """Insulator radius profile along its axis: n sheds of radius R on a core of radius r."""
    prof = [(0.0, r * 1.25), (0.012, r * 1.25), (0.014, r)]
    span = (L - 0.03) / n
    for k in range(n):
        a = 0.016 + k * span
        prof += [(a + span * 0.25, r), (a + span * 0.35, R), (a + span * 0.55, R * 0.92), (a + span * 0.75, r)]
    prof += [(L - 0.014, r), (L - 0.012, r * 1.25), (L, r * 1.25)]
    return prof


def _cantilever_mesh(stagger):
    """Cantilever for a right-side pole (local x = world x - POLE_U); the track centre is at local x = -1.75.
    stagger: contact-wire offset from the track centre at this support (+ toward the pole)."""
    mb = MB()
    xt = -(POLE_U - C.TRACK_X)
    x_ins = -0.165
    xa = x_ins - 0.40                                     # end of insulators
    # upper tube with rod insulator at the pole
    mb.add(*lathe((x_ins, 0, ARM_Z), (xa, 0, ARM_Z), _shed_prof(0.40, 0.060, 0.022, 5), 12), "plastic_black")
    mb.add(*cylf((xa, 0, ARM_Z), (xt - 0.30, 0, ARM_Z), 0.024, 10), "galvanized")
    # lower registration tube with insulator
    mb.add(*lathe((x_ins, 0, REG_Z), (xa, 0, REG_Z), _shed_prof(0.40, 0.055, 0.020, 5), 12), "plastic_black")
    xr = xt + 0.55
    mb.add(*cylf((xa, 0, REG_Z), (xr, 0, REG_Z), 0.017, 10), "galvanized")
    # diagonal brace from the registration tube up to the upper tube
    xb = xt + 0.85
    mb.add(*cylf((xa - 0.04, 0, REG_Z + 0.02), (xb, 0, ARM_Z - 0.02), 0.017, 10), "galvanized")
    # messenger support: hanger plate + saddle clamp above the track centre
    mb.add(*cylf((xt, 0, ARM_Z), (xt, 0, MW_Z + 0.03), 0.009, 8), "galvanized")
    v, f = C.box_geo(xt - 0.03, xt + 0.03, -0.06, 0.06, MW_Z - 0.012, MW_Z + 0.03); mb.add(v, f, "galvanized")
    # steady arm from the registration tube end down to the contact wire
    xc = xt + stagger
    mb.add(*cylf((xr, 0, REG_Z), (xc, 0, CW_Z + 0.02), 0.011, 8), "galvanized")
    v, f = C.box_geo(xc - 0.025, xc + 0.025, -0.04, 0.04, CW_Z + 0.004, CW_Z + 0.03); mb.add(v, f, "galvanized")
    # tube end clamps
    for (x, z) in ((xr, REG_Z), (xb, ARM_Z), (xa, ARM_Z), (xa, REG_Z)):
        v, f = C.box_geo(x - 0.035, x + 0.035, -0.035, 0.035, z - 0.035, z + 0.035); mb.add(v, f, "galvanized")
    return mb


def step_poles():
    c = _coll()
    pm = _pole_mesh().build("trk_pole", c, smooth=False)
    _sharp_edges(pm.data, 40)
    C.add_bevel(pm, 0.003, 1, 40)
    ca = _cantilever_mesh(+0.20).build("trk_cant_a", c)
    cb = _cantilever_mesh(-0.20).build("trk_cant_b", c)
    for o in (ca, cb):
        _sharp_edges(o.data, 40)
    srcs = (pm, ca, cb)
    for side, Ys in ((1, POLES_R), (-1, POLES_L)):
        for k, y in enumerate(Ys):
            loc = (side * POLE_U, y, 0.0)
            rot = (0, 0, 0) if side > 0 else (0, 0, math.pi)
            if k == 0 and side > 0:
                pm.location = loc
                p = pm
            else:
                p = C.instance(pm, "trk_pole_%s%02d" % ("R" if side > 0 else "L", k), loc, c, rot)
            p.rotation_euler = rot
            src = ca if k % 2 == 0 else cb
            if k <= 1 and side > 0:
                src.location = loc; src.rotation_euler = rot
            else:
                C.instance(src, "trk_cant_%s%02d" % ("R" if side > 0 else "L", k), loc, c, rot)


# =============================================================================================== step 9: wires
def _span_samples(ya, yb, step=1.0):
    n = max(2, int(round((yb - ya) / step)))
    return np.linspace(ya, yb, n + 1)


def step_wires():
    c = _coll()
    mb = MB()
    for side, Ys in ((1, POLES_R), (-1, POLES_L)):
        s = side
        xt = s * C.TRACK_X
        mw, cw, drop = [], [], []
        for k in range(len(Ys) - 1):
            ya, yb = Ys[k], Ys[k + 1]
            sa = 0.20 if k % 2 == 0 else -0.20
            sb = -sa
            ys = _span_samples(ya, yb, 1.0)
            t = (ys - ya) / (yb - ya)
            zm = MW_Z - 0.38 * 4 * t * (1 - t)
            zc = CW_Z - 0.015 * 4 * t * (1 - t)
            xc = xt + s * (sa + (sb - sa) * t)
            start = 0 if k == 0 else 1
            mw += [(xt, y, z) for y, z in zip(ys[start:], zm[start:])]
            cw += [(x, y, z) for x, y, z in zip(xc[start:], ys[start:], zc[start:])]
            for yd in np.arange(ya + 4.5, yb - 4.0, 5.1):
                td = (yd - ya) / (yb - ya)
                z_m = MW_Z - 0.38 * 4 * td * (1 - td)
                z_c = CW_Z - 0.015 * 4 * td * (1 - td)
                x_c = xt + s * (sa + (sb - sa) * td)
                drop.append(((x_c, yd, z_c + 0.006), (xt, yd, z_m - 0.004)))
        add_tube(mb, mw, 0.0075, "wire", seg=6)
        add_tube(mb, cw, 0.0065, "wire", seg=6)
        for p0, p1 in drop:
            add_tube(mb, [p0, p1], 0.006, "wire", seg=4)
            # dropper clips
            for p in (p0, p1):
                v, f = C.box_geo(p[0] - 0.012, p[0] + 0.012, p[1] - 0.02, p[1] + 0.02, p[2] - 0.012, p[2] + 0.012)
                mb.add(v, f, "galvanized")
        # feeders on the pole tops (two) + return wire on the outer bracket
        for (ux, z0, sag, r) in ((-0.42, FEED_Z + 0.012, 0.75, 0.0100), (0.42, FEED_Z + 0.012, 0.75, 0.0100),
                                 (0.28, RET_Z - 0.105, 0.55, 0.0070)):
            pts = []
            for k in range(len(Ys) - 1):
                ya, yb = Ys[k], Ys[k + 1]
                ys = _span_samples(ya, yb, 1.0)
                t = (ys - ya) / (yb - ya)
                z = z0 - sag * 4 * t * (1 - t)
                start = 0 if k == 0 else 1
                pts += [(s * (POLE_U + ux), y, zz) for y, zz in zip(ys[start:], z[start:])]
            add_tube(mb, pts, r, "wire", seg=6)
    ob = mb.build("trk_wires", c, smooth=True)


STEPS = [
    ("track bed + troughs", step_bed),
    ("ballast", step_ballast),
    ("sleepers + fastenings", step_sleepers),
    ("rails", step_rails),
    ("left parapet + fence", step_left),
    ("right retaining wall", step_right_wall),
    ("hedge", step_hedge),
    ("catenary poles", step_poles),
    ("catenary wires", step_wires),
]
