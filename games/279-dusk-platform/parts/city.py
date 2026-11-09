"""City, hills and hillside for 279 DUSK PLATFORM.  Collection "City".

Left (track 2 side): a lowland city 11 m below the viaduct (ground z = C.CITY_GROUND_Z), from the street at the foot of
the viaduct (x -9 .. -17.5) out to x ~ -1550 and along y -560 .. 2060, in three street-grid districts with slightly
different angles.  Lots come from a recursive split of each block; building type and height follow an "urban
intensity" field (a station core around (-430, 760) and a few smaller centres).  Level of detail follows the shot
camera: buildings outside the camera wedge (|x| > 0.85 y + 60) are plain boxes, the visible ones get banded facades,
those within ~380 m get recessed windows, parapets, pent houses, water tanks, AC units and antennas.
Right (track 1 side): hillside rising from the street behind the hedge bed (x 10.6 .. 16.2, z 1.69): rows of
Japanese 2-storey houses (14 instanced prototypes with kawara hip / gable roofs, sashes with rain-shutter boxes,
balconies, gutters, antennas), 3-6 storey apartments, one white 15-storey block at x 34..56, y 56..70, a shrine grove,
garden trees, and distribution poles with sagging wire bundles on both sides.
Hills: one terrain grid (left city ground, viaduct corridor below the track bed, right hillside, outer hills at
2-4 km) plus a ring of far ridges at 6.5-11.5 km.

Conventions used by the materials:
  * storeys are exactly FH = 3.0 m and window bands sit at 0.39 .. 2.49 m inside a storey, in OBJECT space, matching
    the 1.8 x 3.0 m cells of `window_city` (which draws its own panes from Object coordinates).  Left-city objects
    have their origin at z = CITY_GROUND_Z so their floor grid lines up as well.
  * every city mesh carries a FACE float attribute "bld_rand" (0..1, one value per building), and every building /
    house / apartment / tree object carries a custom property ob["rand"].  Left-city buildings are joined per block
    (near) or per 320 m cell (far), so Object Info Random is per block there; "bld_rand" is per building.
"""
import bpy, bmesh, math, random
import numpy as np
from mathutils import Vector, noise
import common as C

COLL = "City"
PFX = "city_"
FH = 3.0                         # storey height (window_city cell height)
WIN = (0.39, 2.49)               # window band inside a storey (window_city pane rows)
CZ = C.CITY_GROUND_Z             # -11
CITY_X0 = -19.0                  # first building line on the left (street + sidewalk at the viaduct foot)
CITY_XMAX = 1550.0
CITY_Y = (-560.0, 2060.0)
STREET_R = (10.6, 16.2)          # street behind the hedge bed (tracks.py owns x 8.7 .. 10.6)
HR = (34.0, 56.0, 56.0, 70.0)    # white high-rise footprint x0, x1, y0, y1
BARK = "concrete_dark"           # no bark material in C.MATS (see commonRequests)
HILL_K = 0.45                    # outer hills / right far slope amplitude (keeps the far horizon low and flat)
RIDGE_K = 0.36                   # far ridge band amplitude: ridge tops stay under ~1 deg above eye height
RSHIFT = 6.0                     # right hillside: first house row pushed back behind a belt of garden trees

S = {}                           # state shared between steps (reset by the first step)


# ============================================================================================== small math
def sm(a, b, x):
    if x <= a:
        return 0.0
    if x >= b:
        return 1.0
    t = (x - a) / (b - a)
    return t * t * (3.0 - 2.0 * t)


def fbm(x, y, s, oct=4, seed=0.0):
    return noise.fractal(Vector((x / s + seed, y / s - seed, 0.37 + seed)), 0.9, 2.0, oct, noise_basis="PERLIN_NEW")


def ridge(x, y, s, oct=5):
    amp, f, tot, nrm = 1.0, 1.0 / s, 0.0, 0.0
    for i in range(oct):
        n = 1.0 - abs(noise.noise(Vector((x * f + 11.3 * i, y * f - 7.1 * i, 0.5 + i)), noise_basis="PERLIN_NEW"))
        tot += n * n * amp; nrm += amp; amp *= 0.5; f *= 2.03
    return tot / nrm


# ============================================================================================== mesh builder
BOXF = {"b": (0, 3, 2, 1), "t": (4, 5, 6, 7), "s": (0, 1, 5, 4), "e": (1, 2, 6, 5), "n": (2, 3, 7, 6), "w": (3, 0, 4, 7)}


class MB:
    """Python-list mesh accumulator with a local frame (origin + rotation about Z), per-face key / smooth / rand."""

    def __init__(self):
        self.V, self.F, self.M, self.R, self.S = [], [], [], [], []
        self.keys, self.kidx = [], {}
        self.rand = 0.0
        self.smooth = False
        self.frame()

    def frame(self, ox=0.0, oy=0.0, oz=0.0, ang=0.0):
        self.ox, self.oy, self.oz = ox, oy, oz
        self.ca, self.sa = math.cos(ang), math.sin(ang)

    def w(self, x, y, z):
        return (self.ox + x * self.ca - y * self.sa, self.oy + x * self.sa + y * self.ca, self.oz + z)

    def k(self, key):
        i = self.kidx.get(key)
        if i is None:
            i = self.kidx[key] = len(self.keys)
            self.keys.append(key)
        return i

    def face(self, idx, key, smooth=None):
        self.F.append(idx); self.M.append(self.k(key)); self.R.append(self.rand)
        self.S.append(self.smooth if smooth is None else smooth)

    def poly(self, pts, key):
        n = len(self.V)
        w = self.w
        self.V.extend(w(*p) for p in pts)
        self.face(tuple(range(n, n + len(pts))), key)

    def polyn(self, pts, key, nrm):
        """Polygon oriented so its normal points along nrm (local frame)."""
        nx = ny = nz = 0.0
        m = len(pts)
        for i in range(m):
            a = pts[i]; c = pts[(i + 1) % m]
            nx += (a[1] - c[1]) * (a[2] + c[2]); ny += (a[2] - c[2]) * (a[0] + c[0]); nz += (a[0] - c[0]) * (a[1] + c[1])
        if nx * nrm[0] + ny * nrm[1] + nz * nrm[2] < 0.0:
            pts = pts[::-1]
        self.poly(pts, key)

    def box(self, x0, x1, y0, y1, z0, z1, key, faces="tsnewb", keys=None):
        if x0 > x1: x0, x1 = x1, x0
        if y0 > y1: y0, y1 = y1, y0
        if z0 > z1: z0, z1 = z1, z0
        n = len(self.V)
        w = self.w
        self.V.extend((w(x0, y0, z0), w(x1, y0, z0), w(x1, y1, z0), w(x0, y1, z0),
                       w(x0, y0, z1), w(x1, y0, z1), w(x1, y1, z1), w(x0, y1, z1)))
        for f in faces:
            self.face(tuple(n + i for i in BOXF[f]), keys.get(f, key) if keys else key)

    def cyl(self, p0, p1, r0, r1=None, seg=8, key="galvanized", cap=(True, True), smooth=True):
        r1 = r0 if r1 is None else r1
        p0 = Vector(p0); p1 = Vector(p1)
        ax = (p1 - p0)
        if ax.length < 1e-6:
            return
        ax.normalize()
        t = ax.orthogonal().normalized(); bb = ax.cross(t)
        n = len(self.V)
        for p, r in ((p0, r0), (p1, r1)):
            for i in range(seg):
                a = 2.0 * math.pi * i / seg
                q = p + (t * math.cos(a) + bb * math.sin(a)) * r
                self.V.append(self.w(q.x, q.y, q.z))
        for i in range(seg):
            j = (i + 1) % seg
            self.face((n + i, n + j, n + seg + j, n + seg + i), key, smooth)
        if cap[0]:
            self.face(tuple(n + i for i in reversed(range(seg))), key, False)
        if cap[1]:
            self.face(tuple(n + seg + i for i in range(seg)), key, False)

    def tube(self, pts, r, seg=5, key="wire"):
        m = len(pts)
        if m < 2:
            return
        n0 = len(self.V)
        z = Vector((0, 0, 1))
        for i, p in enumerate(pts):
            tg = (pts[min(i + 1, m - 1)] - pts[max(i - 1, 0)]).normalized()
            u = tg.cross(z)
            if u.length < 1e-6:
                u = Vector((1, 0, 0))
            u.normalize()
            v = tg.cross(u)
            for k in range(seg):
                a = 2.0 * math.pi * k / seg
                q = p + (u * math.cos(a) + v * math.sin(a)) * r
                self.V.append(self.w(q.x, q.y, q.z))
        for i in range(m - 1):
            for k in range(seg):
                k1 = (k + 1) % seg
                a, b = n0 + i * seg, n0 + (i + 1) * seg
                self.face((a + k, a + k1, b + k1, b + k), key, True)

    def empty(self):
        return not self.F

    def build(self, name, coll, origin=(0.0, 0.0, 0.0), attr=True):
        V = np.asarray(self.V, dtype=np.float64).reshape(-1, 3) - np.asarray(origin, dtype=np.float64)
        sizes = np.fromiter((len(f) for f in self.F), dtype=np.int64, count=len(self.F))
        flat = np.fromiter((i for f in self.F for i in f), dtype=np.int64, count=int(sizes.sum()))
        R = np.asarray(self.R, dtype=np.float32) if attr else None
        me = np_mesh(name, V, flat, sizes, np.asarray(self.M, dtype=np.int64), self.keys,
                     np.asarray(self.S, dtype=bool), R)
        ob = bpy.data.objects.new(name, me)
        ob.location = origin
        coll.objects.link(ob)
        return ob

    def mesh(self, name, attr=False):
        """Mesh datablock only (for linked-duplicate prototypes)."""
        V = np.asarray(self.V, dtype=np.float64).reshape(-1, 3)
        sizes = np.fromiter((len(f) for f in self.F), dtype=np.int64, count=len(self.F))
        flat = np.fromiter((i for f in self.F for i in f), dtype=np.int64, count=int(sizes.sum()))
        return np_mesh(name, V, flat, sizes, np.asarray(self.M, dtype=np.int64), self.keys,
                       np.asarray(self.S, dtype=bool), np.asarray(self.R, dtype=np.float32) if attr else None)


def np_mesh(name, V, L, Sz, M, keys, smooth, R=None):
    old = bpy.data.meshes.get(name)
    if old is not None and old.users == 0:
        bpy.data.meshes.remove(old)
    me = bpy.data.meshes.new(name)
    me.vertices.add(len(V))
    me.vertices.foreach_set("co", V.astype(np.float32).ravel())
    me.loops.add(len(L))
    me.loops.foreach_set("vertex_index", L.astype(np.int32))
    me.polygons.add(len(Sz))
    starts = np.zeros(len(Sz), dtype=np.int32)
    if len(Sz) > 1:
        starts[1:] = np.cumsum(Sz)[:-1]
    me.polygons.foreach_set("loop_start", starts)
    me.update(calc_edges=True)
    for k in keys:
        me.materials.append(C.mat(k))
    me.polygons.foreach_set("material_index", M.astype(np.int32))
    me.polygons.foreach_set("use_smooth", smooth)
    # box-projected UVs in object space (1 UV unit = 1 m, same convention as C.uv_box)
    pn = np.empty(len(Sz) * 3, dtype=np.float32)
    if hasattr(me, "polygon_normals"):
        me.polygon_normals.foreach_get("vector", pn)
    else:
        me.polygons.foreach_get("normal", pn)
    ax = np.repeat(np.abs(pn.reshape(-1, 3)).argmax(axis=1), Sz)
    co = V[L]
    u = np.where(ax == 0, co[:, 1], co[:, 0])
    v = np.where(ax == 2, co[:, 1], co[:, 2])
    uvl = me.uv_layers.new(name="UVMap")
    uvl.data.foreach_set("uv", np.c_[u, v].astype(np.float32).ravel())
    if R is not None:
        a = me.attributes.new("bld_rand", "FLOAT", "FACE")
        a.data.foreach_set("value", R)
    me.update()
    return me


def inst(me, name, loc, rotz, coll, rnd, scale=1.0):
    """Linked duplicate of a prototype mesh."""
    ob = bpy.data.objects.new(name, me)
    ob.location = loc
    ob.rotation_euler = (0.0, 0.0, rotz)
    if scale != 1.0:
        ob.scale = (scale, scale, scale)
    ob["rand"] = rnd
    coll.objects.link(ob)
    return ob


def sub(name):
    return C.coll(PFX + name, parent=C.coll(COLL))


# ============================================================================================== terrain
def hills(x, y):
    """Outer hills: zero inside the city footprint, rising to ~35-225 m over 2-4 km."""
    dx = max(-CITY_XMAX - x, 0.0)
    dy = max(y - CITY_Y[1], CITY_Y[0] - y, 0.0)
    d = math.hypot(dx, dy)
    w = sm(150.0, 1700.0, d)
    if w <= 0.0:
        return 0.0
    return w * HILL_K * (35.0 + 190.0 * ridge(x, y, 1300.0))


def H(x, y):
    """Ground height of the city / hillside terrain."""
    hl = hills(x, y)
    if x <= -8.9:                                   # left lowland (the viaduct wall sits at x -8.4 .. -9.13)
        u = -x - 9.0
        return CZ + 0.8 * fbm(x, y, 420.0) * sm(600.0, 1100.0, u) + hl
    if x < 9.05:                                    # corridor under the track bed
        if -205.0 < y < 705.0:
            return -2.5
        return CZ + hl
    if x < 10.62:                                   # under the hedge bed (tracks.py, top 1.70)
        return 1.62 + hl
    u = max(0.0, x - 16.5)
    z = 1.69 + 0.085 * u + 0.00009 * min(u, 900.0) ** 2 + 4.0 * fbm(x + 77.0, y, 170.0) * sm(15.0, 180.0, u)
    z += sm(500.0, 2800.0, x) * HILL_K * (30.0 + 170.0 * ridge(x, y, 1500.0))
    return z + hl


def _grid_axis():
    xs = set(np.linspace(-6500.0, -1700.0, 22)) | set(np.arange(-1660.0, -40.0, 40.0))
    xs |= {-40.0, -30.0, -24.0, -20.0, -17.5, -14.0, -11.0, -9.4, -8.9, -8.85, 0.0, 9.0, 9.05, 10.6, 10.65, 13.4,
           16.2, 16.5}
    xs |= set(np.arange(19.0, 133.0, 3.0)) | set(np.arange(135.0, 600.0, 15.0)) | set(np.arange(620.0, 1700.0, 60.0))
    xs |= set(np.linspace(1800.0, 6500.0, 20))
    ys = set(np.linspace(-7000.0, -1100.0, 14)) | set(np.arange(-1000.0, -200.0, 40.0))
    ys |= set(np.arange(-200.0, 800.0, 5.0)) | set(np.arange(800.0, 2400.0, 20.0)) | set(np.linspace(2500.0, 8500.0, 30))
    return np.array(sorted(round(float(v), 3) for v in xs)), np.array(sorted(round(float(v), 3) for v in ys))


def step_terrain():
    C.coll(COLL, fresh=True)
    for me in list(bpy.data.meshes):
        if me.name.startswith(PFX) and me.users == 0:
            bpy.data.meshes.remove(me)
    S.clear()
    c = sub("terrain")
    xs, ys = _grid_axis()
    nx, ny = len(xs), len(ys)
    Z = np.array([[H(x, y) for x in xs] for y in ys])
    X, Y = np.meshgrid(xs, ys)
    V = np.c_[X.ravel(), Y.ravel(), Z.ravel()]
    j, i = np.meshgrid(np.arange(ny - 1), np.arange(nx - 1), indexing="ij")
    a = (j * nx + i).ravel()
    F = np.c_[a, a + 1, a + nx + 1, a + nx]
    xc = (xs[:-1] + xs[1:]) * 0.5; yc = (ys[:-1] + ys[1:]) * 0.5
    XC, YC = np.meshgrid(xc, yc)
    XC = XC.ravel(); YC = YC.ravel()
    asph = ((XC < -9.0) & (XC > -CITY_XMAX - 20) & (YC > CITY_Y[0] - 20) & (YC < CITY_Y[1] + 20)) | \
           ((XC > STREET_R[0]) & (XC < STREET_R[1]) & (YC > -210) & (YC < 800))
    M = np.where(asph, 0, 1)
    me = np_mesh(PFX + "terrain", V, F.ravel(), np.full(len(F), 4), M, ["asphalt", "terrain"],
                 np.zeros(len(F), dtype=bool), np.zeros(len(F), dtype=np.float32))
    ob = bpy.data.objects.new(PFX + "terrain", me); c.objects.link(ob)
    # far ridges: a band of hills 2.55 - 2.99 km away (the shot camera clips at C.CAM["clip_end"] = 3 km),
    # kept low toward the sun (azimuth -52 deg)
    az = np.linspace(-1.5, 1.5, 260)
    rs = [2550.0, 2680.0, 2800.0, 2900.0, 2990.0]
    rowk = [0.1, 0.55, 1.0, 0.8, 0.45]
    saz = math.radians(C.SUN["azimuth_deg"])
    V2 = []
    for jr, rr in enumerate(rs):
        for a_ in az:
            x, y = rr * math.sin(a_), rr * math.cos(a_)
            pk = RIDGE_K * (70.0 + 150.0 * ridge(a_ * 2600.0 + jr * 37.0, rr * 0.9, 700.0, 5))
            pk *= 1.0 - 0.45 * math.exp(-((a_ - saz) / 0.3) ** 2)
            V2.append((x, y, CZ - 20.0 + pk * rowk[jr]))
    na = len(az)
    F2 = []
    for jr in range(len(rs) - 1):
        for ia in range(na - 1):
            q = jr * na + ia
            F2.append((q, q + na, q + na + 1, q + 1))
    F2 = np.array(F2)
    me2 = np_mesh(PFX + "ridges", np.array(V2), F2.ravel(), np.full(len(F2), 4), np.zeros(len(F2), dtype=np.int64),
                  ["terrain"], np.ones(len(F2), dtype=bool), np.zeros(len(F2), dtype=np.float32))
    ob2 = bpy.data.objects.new(PFX + "ridges", me2); c.objects.link(ob2)
    # kerb + sidewalk edge of the right street, and the kerb of the street at the viaduct foot
    b = MB()
    for y0 in np.arange(-200.0, 780.0, 40.0):
        y1 = y0 + 40.0
        b.box(STREET_R[1] - 0.15, STREET_R[1], y0, y1, 1.69, 1.84, "concrete", "tw")
        b.box(STREET_R[1], STREET_R[1] + 1.6, y0, y1, 1.69, 1.84, "concrete_dark", "t")
        b.box(-17.65, -17.5, y0, y1, CZ, CZ + 0.15, "concrete", "te")
    b.build(PFX + "kerbs", c)


# ============================================================================================== facade toolkit
def _edge(p0, p1):
    dx, dy = p1[0] - p0[0], p1[1] - p0[1]
    L = math.hypot(dx, dy)
    tx, ty = (dx / L, dy / L) if L > 1e-9 else (1.0, 0.0)
    nx, ny = ty, -tx                               # outward = right of p0 -> p1 (CCW footprint)

    def P(s, o, z):
        return (p0[0] + tx * s + nx * o, p0[1] + ty * s + ny * o, z)
    return L, tx, ty, P


def fq(b, P, sa, sb, za, zb, o, key):
    b.poly((P(sa, o, za), P(sb, o, za), P(sb, o, zb), P(sa, o, zb)), key)


def fbox(b, P, tx, ty, s0, s1, o0, o1, z0, z1, key, faces="flrtb"):
    """Box in facade coordinates (s along the wall, o outward)."""
    nx, ny = ty, -tx
    if "f" in faces: b.polyn([P(s0, o1, z0), P(s1, o1, z0), P(s1, o1, z1), P(s0, o1, z1)], key, (nx, ny, 0))
    if "k" in faces: b.polyn([P(s0, o0, z0), P(s1, o0, z0), P(s1, o0, z1), P(s0, o0, z1)], key, (-nx, -ny, 0))
    if "l" in faces: b.polyn([P(s0, o0, z0), P(s0, o1, z0), P(s0, o1, z1), P(s0, o0, z1)], key, (-tx, -ty, 0))
    if "r" in faces: b.polyn([P(s1, o0, z0), P(s1, o1, z0), P(s1, o1, z1), P(s1, o0, z1)], key, (tx, ty, 0))
    if "t" in faces: b.polyn([P(s0, o0, z1), P(s1, o0, z1), P(s1, o1, z1), P(s0, o1, z1)], key, (0, 0, 1))
    if "b" in faces: b.polyn([P(s0, o0, z0), P(s1, o0, z0), P(s1, o1, z0), P(s0, o1, z0)], key, (0, 0, -1))


def recess(b, P, tx, ty, a, c, za, zb, r, revk, wink):
    fq(b, P, a, c, za, zb, -r, wink)
    b.polyn([P(a, 0, za), P(c, 0, za), P(c, -r, za), P(a, -r, za)], revk, (0, 0, 1))
    b.polyn([P(a, 0, zb), P(c, 0, zb), P(c, -r, zb), P(a, -r, zb)], revk, (0, 0, -1))
    b.polyn([P(a, 0, za), P(a, -r, za), P(a, -r, zb), P(a, 0, zb)], revk, (tx, ty, 0))
    b.polyn([P(c, 0, za), P(c, -r, za), P(c, -r, zb), P(c, 0, zb)], revk, (-tx, -ty, 0))


def segs(L, st, lod):
    mode = st.get("mode", "band")
    if mode == "few":
        fw = st.get("fw", 1.4)
        n = max(1, int(L / st.get("fsp", 4.0)))
        out = []
        for k in range(n):
            cc = L * (k + 0.5) / n
            a, c = max(0.4, cc - fw * 0.5), min(L - 0.4, cc + fw * 0.5)
            if c - a > 0.3:
                out.append((a, c))
        return out
    pe = min(st.get("pier", 0.5), L * 0.3)
    span = L - 2.0 * pe
    if span < 0.6:
        return []
    bay, mull = st.get("bay", 0.0), st.get("mull", 0.0)
    if lod >= 2 or bay <= 0 or mull <= 0:
        return [(pe, L - pe)]
    n = max(1, int(round(span / bay)))
    w = (span - (n - 1) * mull) / n
    if w < 0.5:
        return [(pe, L - pe)]
    return [(pe + k * (w + mull), pe + k * (w + mull) + w) for k in range(n)]


def facade(b, p0, p1, z0, zt, floors, lod, wallk, wink="window_city"):
    """Wall p0 -> p1 (outside on the right) from z0 to zt with one window band per storey.
    floors: [(zb, st)], st = dict(mode band|few|blank, pier, bay, mull, fw, fsp, win=(lo, hi), rec)."""
    L, tx, ty, P = _edge(p0, p1)
    if L < 0.05:
        return
    cur = z0
    for zb, st in floors:
        mode = st.get("mode", "band")
        if mode == "blank" or L < 2.2 or (mode == "few" and lod >= 2):
            continue
        lo, hi = st.get("win", WIN)
        ws, we = zb + lo, zb + hi
        if we > zt - 0.05 or ws < cur:
            continue
        sg = segs(L, st, lod)
        if not sg:
            continue
        if ws > cur + 1e-4:
            fq(b, P, 0.0, L, cur, ws, 0.0, wallk)
        s = 0.0
        rec = st.get("rec", 0.14) if lod == 0 else 0.0
        for a, c in sg:
            if a > s + 1e-4:
                fq(b, P, s, a, ws, we, 0.0, wallk)
            if rec > 0:
                recess(b, P, tx, ty, a, c, ws, we, rec, st.get("revk", wallk), wink)
            else:
                fq(b, P, a, c, ws, we, 0.0, wink)
            s = c
        if s < L - 1e-4:
            fq(b, P, s, L, ws, we, 0.0, wallk)
        cur = we
    if zt > cur + 1e-4:
        fq(b, P, 0.0, L, cur, zt, 0.0, wallk)


def roof_flat(b, W, D, z, par, lod, wallk, roofk="concrete_dark", topk="concrete"):
    zt = z + par
    if lod == 0 and par > 0.25:
        th = 0.2
        o = [(0, 0), (W, 0), (W, D), (0, D)]
        i = [(th, th), (W - th, th), (W - th, D - th), (th, D - th)]
        for k in range(4):
            k2 = (k + 1) % 4
            b.poly(((*o[k], zt), (*o[k2], zt), (*i[k2], zt), (*i[k], zt)), topk)
            b.poly(((*i[k2], z), (*i[k], z), (*i[k], zt), (*i[k2], zt)), wallk)
        b.poly(((th, th, z), (W - th, th, z), (W - th, D - th, z), (th, D - th, z)), roofk)
    else:
        b.poly(((0, 0, zt), (W, 0, zt), (W, D, zt), (0, D, zt)), roofk)


def ac_unit(b, x, y, z, lod, face=-1):
    """Split-type AC outdoor unit, front toward -y (face=-1) or +y."""
    y0, y1 = (y, y + 0.30) if face < 0 else (y - 0.30, y)
    b.box(x, x + 0.84, y0, y1, z + 0.08, z + 0.70, "galvanized", "tsnew")
    if lod == 0:
        b.box(x + 0.06, x + 0.78, y0 + 0.03, y1 - 0.03, z, z + 0.08, "steel_dark", "snew")
        cx, cz, rr = x + 0.33, z + 0.39, 0.22
        yf = (y0 - 0.004) if face < 0 else (y1 + 0.004)
        b.polyn([(cx + rr * math.cos(a), yf, cz + rr * math.sin(a)) for a in (i * math.pi / 4 for i in range(8))],
                "plastic_black", (0, face, 0))


def roof_clutter(b, W, D, z, r, lod, wallk):
    m = 0.7
    if W < 5 or D < 5:
        return
    if W * D > 140 and r.random() < 0.8:
        pw = r.uniform(2.6, min(5.0, W * 0.4)); pd = r.uniform(2.4, min(4.2, D * 0.45)); ph = r.uniform(2.6, 3.4)
        px = r.uniform(m, W - pw - m); py = r.uniform(m, D - pd - m)
        b.box(px, px + pw, py, py + pd, z, z + ph, wallk, "snew")
        b.box(px - 0.08, px + pw + 0.08, py - 0.08, py + pd + 0.08, z + ph, z + ph + 0.18, "concrete",
              "tsnewb" if lod == 0 else "tsnew")
        if lod == 0:
            b.box(px + 0.4, px + 1.3, py - 0.03, py, z, z + 2.05, "steel_dark", "s")
    if r.random() < 0.65:
        tw, td, th = r.uniform(1.6, 3.2), r.uniform(1.4, 2.4), r.uniform(1.2, 2.0)
        st = r.uniform(0.5, 1.8)
        if tw < W - 2 * m and td < D - 2 * m:
            tx, ty = r.uniform(m, W - tw - m), r.uniform(m, D - td - m)
            if lod == 0:
                for lx, ly in ((tx + 0.1, ty + 0.1), (tx + tw - 0.1, ty + 0.1), (tx + tw - 0.1, ty + td - 0.1),
                               (tx + 0.1, ty + td - 0.1)):
                    b.box(lx - 0.06, lx + 0.06, ly - 0.06, ly + 0.06, z, z + st - 0.12, "galvanized", "snew")
                b.box(tx - 0.1, tx + tw + 0.1, ty - 0.1, ty + td + 0.1, z + st - 0.12, z + st, "galvanized", "tsnewb")
                b.box(tx, tx + tw, ty, ty + td, z + st, z + st + th, "building_plaster", "tsnew")
                zm = z + st + th * 0.5
                b.box(tx - 0.025, tx + tw + 0.025, ty - 0.025, ty + td + 0.025, zm - 0.03, zm + 0.03,
                      "building_plaster", "tsnewb")
                b.box(tx + tw * 0.3, tx + tw * 0.3 + 0.6, ty + td * 0.3, ty + td * 0.3 + 0.6, z + st + th,
                      z + st + th + 0.1, "galvanized", "tsnew")
            else:
                b.box(tx, tx + tw, ty, ty + td, z, z + st + th, "building_plaster", "tsnew")
    if lod == 0 and r.random() < 0.18:
        rr = r.uniform(0.7, 1.3)
        if W - 2 * (m + rr) > 0 and D - 2 * (m + rr) > 0:
            cx, cy = r.uniform(m + rr, W - m - rr), r.uniform(m + rr, D - m - rr)
            b.cyl((cx, cy, z), (cx, cy, z + r.uniform(1.6, 3.0)), rr, seg=14, key="galvanized")
    n = r.randint(2, 9) if lod == 0 else r.randint(0, 3)
    for k in range(n):
        ac_unit(b, r.uniform(m, W - m - 0.9), r.uniform(m, D - m - 0.4), z, lod)
    if r.random() < 0.35:
        ax, ay = r.uniform(m, W - m), r.uniform(m, D - m)
        hh = r.uniform(2.5, 6.0)
        b.cyl((ax, ay, z), (ax, ay, z + hh), 0.035, seg=5, key="galvanized", cap=(False, True))
        if lod == 0:
            for k in range(3):
                zz = z + hh - 0.3 - k * 0.45
                b.box(ax - 0.5, ax + 0.5, ay - 0.015, ay + 0.015, zz - 0.015, zz + 0.015, "galvanized", "tsnewb")


# ============================================================================================== roofs
def roof_hip(b, W, D, ze, ov, p, key, lod, fas="building_dark", sof="building_plaster"):
    x0, x1, y0, y1 = -ov, W + ov, -ov, D + ov
    Wx, Dy = x1 - x0, y1 - y0
    E = [(x0, y0, ze), (x1, y0, ze), (x1, y1, ze), (x0, y1, ze)]
    if Wx >= Dy:
        zr = ze + p * Dy * 0.5; cy = (y0 + y1) * 0.5
        R0, R1 = (x0 + Dy * 0.5, cy, zr), (x1 - Dy * 0.5, cy, zr)
        fl = [([E[0], E[1], R1, R0], (0, -1, 1)), ([E[2], E[3], R0, R1], (0, 1, 1)),
              ([E[3], E[0], R0], (-1, 0, 1)), ([E[1], E[2], R1], (1, 0, 1))]
        hips = [(E[0], R0), (E[3], R0), (E[1], R1), (E[2], R1)]
    else:
        zr = ze + p * Wx * 0.5; cx = (x0 + x1) * 0.5
        R0, R1 = (cx, y0 + Wx * 0.5, zr), (cx, y1 - Wx * 0.5, zr)
        fl = [([E[3], E[0], R0, R1], (-1, 0, 1)), ([E[1], E[2], R1, R0], (1, 0, 1)),
              ([E[0], E[1], R0], (0, -1, 1)), ([E[2], E[3], R1], (0, 1, 1))]
        hips = [(E[0], R0), (E[1], R0), (E[2], R1), (E[3], R1)]
    pyramid = math.dist(R0, R1) < 0.05
    for pts, n in fl:
        if pyramid and len(pts) == 4:
            pts = pts[:3]
        b.polyn(pts, key, n)
    if lod <= 1:
        for k in range(4):
            a, c = E[k], E[(k + 1) % 4]
            b.poly(((a[0], a[1], ze - 0.16), (c[0], c[1], ze - 0.16), (c[0], c[1], ze), (a[0], a[1], ze)), fas)
    if lod == 0:
        b.poly(((x0, y0, ze - 0.16), (x0, y1, ze - 0.16), (x1, y1, ze - 0.16), (x1, y0, ze - 0.16)), sof)
        if key == "roof_tile":
            if not pyramid:
                b.cyl((R0[0], R0[1], R0[2] + 0.04), (R1[0], R1[1], R1[2] + 0.04), 0.15, seg=8, key=key)
            for e, rr in hips:
                b.cyl((e[0], e[1], e[2] + 0.05), (rr[0], rr[1], rr[2] + 0.04), 0.10, seg=6, key=key)
        # eave gutters on the two long sides
        for (a, c, nx, ny) in ((E[0], E[1], 0, -1), (E[2], E[3], 0, 1), (E[3], E[0], -1, 0), (E[1], E[2], 1, 0)):
            if (Wx >= Dy) == (ny != 0):
                b.cyl((a[0] + nx * 0.07, a[1] + ny * 0.07, ze - 0.13), (c[0] + nx * 0.07, c[1] + ny * 0.07, ze - 0.13),
                      0.065, seg=6, key="galvanized")
    return zr


def roof_gable(b, W, D, ze, ov, p, key, lod, wallk, fas="building_dark"):
    """Gable roof with real slab thickness; returns (wall top at the eaves, ridge z)."""
    t = 0.16
    x0, x1, y0, y1 = -ov, W + ov, -ov, D + ov
    along_x = W >= D
    if along_x:
        cy = D * 0.5; zr = ze + p * (cy - y0)
        slopes = [([(x0, y0), (x1, y0), (x1, cy), (x0, cy)], (0, -1, 1)), ([(x1, y1), (x0, y1), (x0, cy), (x1, cy)], (0, 1, 1))]
    else:
        cx = W * 0.5; zr = ze + p * (cx - x0)
        slopes = [([(x0, y1), (x0, y0), (cx, y0), (cx, y1)], (-1, 0, 1)), ([(x1, y0), (x1, y1), (cx, y1), (cx, y0)], (1, 0, 1))]
    zw = ze - t + p * ov
    for pts, n in slopes:
        zz = [ze, ze, zr, zr]
        top = [(pts[i][0], pts[i][1], zz[i]) for i in range(4)]
        b.polyn(top, key, n)
        bot = [(q[0], q[1], q[2] - t) for q in top]
        if lod == 0:
            b.polyn(bot, "building_plaster", (0, 0, -1))
        # eave fascia (edge 0-1) and the two verges (edges 1-2, 3-0)
        for i0, i1 in ((0, 1), (1, 2), (3, 0)):
            q = [top[i0], top[i1], bot[i1], bot[i0]]
            mx = (top[i0][0] + top[i1][0]) * 0.5; my = (top[i0][1] + top[i1][1]) * 0.5
            ccx, ccy = W * 0.5, D * 0.5
            if i0 == 0:
                nn = (n[0], n[1], 0)
            else:
                nn = (mx - ccx, 0, 0) if along_x else (0, my - ccy, 0)
            b.polyn(q, fas, nn)
        if lod == 0:                                     # half-round eave gutter
            g0, g1 = top[0], top[1]
            b.cyl((g0[0] + n[0] * 0.08, g0[1] + n[1] * 0.08, ze - 0.12), (g1[0] + n[0] * 0.08, g1[1] + n[1] * 0.08, ze - 0.12),
                  0.065, seg=6, key="galvanized")
    # gable triangles in the wall planes
    if along_x:
        for xw, nx in ((0.0, -1), (W, 1)):
            b.polyn([(xw, 0.0, zw), (xw, D, zw), (xw, cy, zr - t)], wallk, (nx, 0, 0))
        if key == "roof_tile" and lod == 0:
            b.cyl((x0, cy, zr + 0.03), (x1, cy, zr + 0.03), 0.14, seg=8, key=key)
    else:
        for yw, ny in ((0.0, -1), (D, 1)):
            b.polyn([(0.0, yw, zw), (W, yw, zw), (cx, yw, zr - t)], wallk, (0, ny, 0))
        if key == "roof_tile" and lod == 0:
            b.cyl((cx, y0, zr + 0.03), (cx, y1, zr + 0.03), 0.14, seg=8, key=key)
    return zw, zr


# ============================================================================================== building generators
BOX4 = [(0.0, 0.0), (1.0, 0.0), (1.0, 1.0), (0.0, 1.0)]


def corners(W, D):
    return [(0.0, 0.0), (W, 0.0), (W, D), (0.0, D)]


def gen_block(b, W, D, nf, lod, r, zg, vis):
    """Mid-rise mixed-use block: shop front on the -y side, banded upper floors, parapet, roof clutter."""
    wallk = r.choices(["building_plaster", "building_tile", "building_dark", "concrete"], [4, 3, 1.3, 1.5])[0]
    st = dict(mode="band", pier=r.uniform(0.35, 1.0), bay=r.uniform(3.2, 6.4), mull=r.uniform(0.35, 0.8), rec=0.14)
    shop = dict(st, win=(0.15, 2.70), rec=0.25, bay=r.uniform(3.5, 6.0), mull=0.3)
    modes = ["band"] + [r.choice(["band", "few", "blank"]) for _ in range(3)]
    Hh = nf * FH
    par = r.uniform(0.6, 1.1)
    P = corners(W, D)
    for s in range(4):
        m = modes[s] if (lod < 2 or vis[s]) else "blank"
        sts = dict(st, mode=m)
        fl = [(0.0, dict(shop, mode=m) if s == 0 else sts)] + [(k * FH, sts) for k in range(1, nf)]
        facade(b, P[s], P[(s + 1) % 4], zg, Hh + par, fl, lod, wallk)
    roof_flat(b, W, D, Hh, par, lod, wallk)
    if lod == 0:
        b.box(0.3, W - 0.3, -0.9, 0.0, 2.80, 2.92, "steel_dark", "tbsew")
        if nf >= 3 and r.random() < 0.55:
            x = r.uniform(0.5, W - 0.8)
            b.box(x, x + 0.25, -1.0, -0.05, FH + 0.5, min(Hh - 0.3, FH + 0.5 + r.uniform(2.5, 7.0)),
                  r.choice(["building_plaster", "building_dark"]), "tbsew")
    if lod <= 1:
        roof_clutter(b, W, D, Hh, r, lod, wallk)
    return Hh


def gen_apt(b, W, D, nf, lod, r, zg, wallk=None, parak=None, vis=(1, 1, 1, 1)):
    """Apartment slab: balconies on the -y side (deep stripes), open corridor side +y, blank-ish ends."""
    wallk = wallk or r.choices(["building_plaster", "building_tile", "concrete"], [5, 3, 1])[0]
    parak = parak or r.choices(["building_plaster", wallk, "building_dark"], [4, 2, 1])[0]
    Hh = nf * FH
    par = 0.9
    st_back = dict(mode="band", pier=0.5, bay=r.uniform(5.5, 7.0), mull=r.uniform(0.6, 1.4), rec=0.12,
                   win=(1.05, 2.49))
    st_end = dict(mode="few", fw=1.0, fsp=5.0, rec=0.10)
    if lod >= 2:
        stf = dict(mode="band", pier=0.0, win=(1.15, 2.85))
        facade(b, (0.0, 0.0), (W, 0.0), zg, Hh + par, [(k * FH, stf) for k in range(nf)], 2, parak)
        others = [((W, 0.0), (W, D)), ((W, D), (0.0, D)), ((0.0, D), (0.0, 0.0))]
        for s, (p0, p1) in enumerate(others):
            fl = [(k * FH, st_back if (s == 1 and vis[2]) else dict(mode="blank")) for k in range(nf)]
            facade(b, p0, p1, zg, Hh + par, fl, 2, wallk)
        roof_flat(b, W, D, Hh, par, 2, wallk)
        return Hh
    bd = 1.4
    fin = 0.2
    stf = dict(mode="band", pier=0.25, bay=r.uniform(5.6, 7.2), mull=0.5, rec=0.0)
    facade(b, (fin, bd), (W - fin, bd), zg, Hh, [(k * FH, stf) for k in range(nf)], lod, wallk)
    facade(b, (W, D), (0.0, D), zg, Hh + par, [(k * FH, st_back) for k in range(nf)], lod, wallk)
    facade(b, (0.0, D), (0.0, 0.0), zg, Hh + par, [(k * FH, st_end) for k in range(nf)], lod, wallk)
    facade(b, (W, 0.0), (W, D), zg, Hh + par, [(k * FH, st_end) for k in range(nf)], lod, wallk)
    unit = r.uniform(5.8, 7.4)
    nb = max(1, int(round((W - 2 * fin) / unit)))
    for k in range(nf):
        zb = k * FH
        if lod == 0:
            if k > 0:
                b.box(fin, W - fin, 0.0, bd, zb - 0.2, zb, "concrete", "tbs")
            b.box(fin, W - fin, 0.0, 0.12, zb, zb + 1.1, parak, "tsn")
            b.box(fin, W - fin, 0.02, 0.10, zb + 1.1, zb + 1.16, "galvanized", "ts")
            for j in range(1, nb):
                xp = fin + (W - 2 * fin) * j / nb
                b.box(xp - 0.04, xp + 0.04, 0.12, bd, zb, zb + FH - 0.2, "building_plaster", "ews")
            for j in range(nb):
                if r.random() < 0.55:
                    x = fin + (W - 2 * fin) * j / nb + r.uniform(0.2, max(0.25, (W - 2 * fin) / nb - 1.1))
                    ac_unit(b, x, 0.35, zb, lod, -1)
        else:
            b.box(fin, W - fin, 0.0, bd, zb - (0.2 if k > 0 else 0.0), zb + 1.1, parak, "tsb")
    b.box(fin, W - fin, 0.0, bd, Hh - 0.2, Hh, "concrete", "bs")
    b.box(fin, W - fin, -0.001, 0.0, Hh, Hh + par, wallk, "s")
    for x0, x1, f in ((0.0, fin, "se"), (W - fin, W, "sw")):
        b.box(x0, x1, 0.0, bd, zg, Hh + par, wallk, f)
    roof_flat(b, W, D, Hh, par, lod, wallk)
    roof_clutter(b, W, D, Hh, r, lod, wallk)
    return Hh


def gen_tower(b, W, D, nf, lod, r, zg, vis):
    wallk = r.choice(["building_dark", "concrete", "building_plaster", "building_tile"])
    curtain = r.random() < 0.5
    st = dict(mode="band", pier=r.uniform(0.4, 1.2), bay=r.uniform(3.0, 4.5), mull=r.uniform(0.2, 0.45),
              win=(0.12, 2.88) if curtain else WIN, rec=0.10)
    Hh = nf * FH
    par = 1.2
    P = corners(W, D)
    for s in range(4):
        m = "band" if (lod < 2 or vis[s]) else "blank"
        facade(b, P[s], P[(s + 1) % 4], zg, Hh + par, [(k * FH, dict(st, mode=m)) for k in range(nf)], lod, wallk)
    roof_flat(b, W, D, Hh, par, min(lod, 1), wallk)
    cw, cd = W * r.uniform(0.45, 0.7), D * r.uniform(0.45, 0.7)
    cx, cy = (W - cw) * 0.5, (D - cd) * 0.5
    ch = r.uniform(3.5, 7.0)
    b.box(cx, cx + cw, cy, cy + cd, Hh, Hh + ch, wallk if r.random() < 0.5 else "building_dark", "tsnew")
    if lod <= 1:
        b.cyl((W * 0.5, D * 0.5, Hh + ch), (W * 0.5, D * 0.5, Hh + ch + r.uniform(4, 12)), 0.12, 0.05, seg=6,
              key="galvanized")
        roof_clutter(b, W, D, Hh, r, lod, wallk)
    return Hh


def gen_ware(b, W, D, lod, r, zg, vis):
    wallk = r.choice(["galvanized", "building_dark", "building_plaster"])
    h = r.choice([6.0, 9.0])
    P = corners(W, D)
    st = dict(mode="band", pier=1.0, bay=6.0, mull=2.0, win=(1.3, 2.2), rec=0.08)
    for s in range(4):
        fl = [(h - FH, st)] if (lod < 2 or vis[s]) else []
        facade(b, P[s], P[(s + 1) % 4], zg, h - 0.1, fl, lod, wallk)
    roof_gable(b, W, D, h + 0.06, 0.3, 0.12, "galvanized", 1 if lod > 0 else 0, wallk)
    return h


def gen_house(b, W, D, lod, r, zg, vis):
    """Detached house for the left city (lod 1 / 2)."""
    nf = 2 if r.random() < 0.82 else (3 if r.random() < 0.5 else 1)
    wallk = r.choices(["building_plaster", "building_tile"], [3, 2])[0]
    kind = r.choices(["hip", "gable", "flat"], [5, 3, 1.2])[0]
    p = r.uniform(0.38, 0.5); ov = 0.5
    ze = nf * FH + 0.25
    st = dict(mode="few", fw=r.uniform(1.2, 1.8), fsp=r.uniform(2.8, 4.0), rec=0.08)
    P = corners(W, D)
    if kind == "flat":
        top = nf * FH + 0.6
    elif kind == "hip":
        top = ze - 0.16
    else:
        top = ze - 0.16 + p * ov
    for s in range(4):
        fl = [(k * FH, st) for k in range(nf)] if (lod < 2 and vis[s]) else []
        facade(b, P[s], P[(s + 1) % 4], zg, top, fl, lod, wallk)
    rk = "roof_tile" if r.random() < 0.8 else "steel_dark"
    if kind == "hip":
        roof_hip(b, W, D, ze, ov, p, rk, max(lod, 1))
    elif kind == "gable":
        roof_gable(b, W, D, ze, ov, p, rk, max(lod, 1), wallk)
    else:
        roof_flat(b, W, D, nf * FH + 0.2, 0.4, 1, wallk, "galvanized")
    return ze


def gen_box(b, W, D, h, r, zg, key):
    b.box(0.0, W, 0.0, D, zg, h, key, "tsnew")


# ============================================================================================== left city plan
DISTRICTS = [(-560.0, 520.0, 0.05), (520.0, 1240.0, -0.20), (1240.0, 2060.0, 0.16)]
SEAM = 9.0
CENTRES = ((-700.0, 1450.0, 420.0, 0.95), (-1150.0, 1050.0, 320.0, 0.7), (-330.0, 1850.0, 230.0, 0.6),
           (-900.0, 450.0, 260.0, 0.45), (-250.0, 700.0, 160.0, 0.35))


def intensity(x, y):
    I = 0.0
    for cx, cy, rr, a in CENTRES:
        I += a * math.exp(-((x - cx) ** 2 + (y - cy) ** 2) / (rr * rr))
    I += 0.22 * noise.noise(Vector((x / 260.0, y / 260.0, 3.3)), noise_basis="PERLIN_NEW")
    return min(1.0, max(0.0, I))


def industrial(x, y):
    return noise.noise(Vector((x / 420.0 + 5.1, y / 420.0, 1.7)), noise_basis="PERLIN_NEW") > 0.42


def inview(x, y, m=60.0):
    """Inside the shot camera's horizontal wedge (74 deg FOV looking +Y from the origin), with margin m."""
    return abs(x) < 0.85 * y + m


def _split(r, rc, maxs, out, depth=0):
    u0, u1, v0, v1 = rc
    w, d = u1 - u0, v1 - v0
    if (w <= maxs and d <= maxs * 1.5) or depth > 9:
        out.append(rc)
        return
    t = r.uniform(0.38, 0.62)
    if w >= d:
        um = u0 + w * t
        _split(r, (u0, um, v0, v1), maxs, out, depth + 1); _split(r, (um, u1, v0, v1), maxs, out, depth + 1)
    else:
        vm = v0 + d * t
        _split(r, (u0, u1, v0, vm), maxs, out, depth + 1); _split(r, (u0, u1, vm, v1), maxs, out, depth + 1)


def _left_plan():
    if "left" in S:
        return S["left"]
    r = C.rng(2791)
    lots, parks = [], []
    bid = 0
    for (ya, yb, ang) in DISTRICTS:
        ca, sa = math.cos(ang), math.sin(ang)
        ox, oy = CITY_X0, (ya + yb) * 0.5

        def Wd(u, v):
            return (ox + u * ca - v * sa, oy + u * sa + v * ca)
        us, u1 = [], -1.0
        while u1 > -1850.0:
            bw = r.uniform(42.0, 80.0)
            us.append((u1 - bw, u1))
            u1 -= bw + (r.uniform(14.0, 18.0) if r.random() < 0.15 else r.uniform(5.0, 8.0))
        vs, half = [], (yb - ya) * 0.5 + 420.0
        v0 = -half
        while v0 < half:
            bd = r.uniform(34.0, 62.0)
            vs.append((v0, v0 + bd))
            v0 += bd + (r.uniform(14.0, 18.0) if r.random() < 0.15 else r.uniform(5.0, 8.0))
        for (a0, a1) in us:
            for (b0, b1) in vs:
                cx, cy = Wd((a0 + a1) * 0.5, (b0 + b1) * 0.5)
                if not (ya - 80 < cy < yb + 80) or cx < -CITY_XMAX - 80 or cx > CITY_X0 + 60:
                    continue
                bid += 1
                d = math.hypot(cx, cy)
                I = intensity(cx, cy)
                vis = inview(cx, cy, 60.0)
                if vis and 120 < d < 800 and I < 0.6 and r.random() < 0.05:
                    ok = all(px < CITY_X0 and ya + SEAM < py < yb - SEAM
                             for px, py in (Wd(a0, b0), Wd(a1, b0), Wd(a1, b1), Wd(a0, b1)))
                    if ok:
                        parks.append(dict(rect=(a0, a1, b0, b1), ang=ang, o=(ox, oy), bid=bid))
                        continue
                maxs = (12.0 + 22.0 * I) * (1.0 + 0.7 * sm(900.0, 2200.0, d)) * (1.0 if vis else 1.9)
                rects = []
                _split(r, (a0, a1, b0, b1), maxs, rects)
                ind = industrial(cx, cy)
                for rc in rects:
                    if r.random() < (0.06 if vis else 0.4):
                        continue
                    cs = [Wd(rc[0], rc[2]), Wd(rc[1], rc[2]), Wd(rc[1], rc[3]), Wd(rc[0], rc[3])]
                    if any(px > CITY_X0 or px < -CITY_XMAX or py < ya + SEAM or py > yb - SEAM for px, py in cs):
                        continue
                    lx, ly = Wd((rc[0] + rc[1]) * 0.5, (rc[2] + rc[3]) * 0.5)
                    ld = math.hypot(lx, ly)
                    lv = inview(lx, ly, 60.0)
                    lod = 3 if not lv else (0 if ld < 380 else (1 if ld < 900 else 2))
                    lI = intensity(lx, ly) * (0.3 + 0.7 * sm(150.0, 800.0, ld))
                    lots.append(dict(rect=rc, ang=ang, o=(ox, oy), bid=bid, I=lI, ind=ind, c=(lx, ly),
                                     d=ld, lod=lod, seed=r.random()))
    S["left"] = (lots, parks)
    return S["left"]


def _left_building(b, lot):
    r = C.rng(int(lot["seed"] * 1e9))
    u0, u1, v0, v1 = lot["rect"]
    w, d = u1 - u0, v1 - v0
    I, lod = lot["I"], lot["lod"]
    cap = 2 + int(lot["d"] / 110.0)          # keeps the near city under the parapet line, taller far away
    area = w * d
    ar = max(w, d) / max(1.0, min(w, d))
    if lot["ind"] and r.random() < 0.6:
        typ = "ware"
    elif I > 0.55 and area > 380 and lot["d"] > 900 and r.random() < (I - 0.45) * 0.8:
        typ = "tower"
    elif area > 200 and r.random() < 0.22 + 0.45 * I:
        typ = "apt" if (ar > 1.5 or r.random() < 0.4) else "block"
    elif area < 320 and r.random() < 0.9 - 0.7 * I:
        typ = "house"
    else:
        typ = "block"
    sb = r.uniform(1.2, 2.4) if typ == "house" else r.uniform(0.5, 1.4)
    W, D = w - 2 * sb, d - 2 * sb
    if W < 4.0 or D < 4.0:
        return
    ang = lot["ang"]
    ca, sa = math.cos(ang), math.sin(ang)
    ou, ov = u0 + sb, v0 + sb
    ox = lot["o"][0] + ou * ca - ov * sa
    oy = lot["o"][1] + ou * sa + ov * ca
    g = H(lot["c"][0], lot["c"][1])
    zb0 = CZ + FH * max(0, math.ceil((g - CZ - 0.3) / FH))
    zg = g - zb0 - 1.2
    b.frame(ox, oy, zb0, ang)
    b.rand = lot["seed"]
    # which local sides face the camera (s0 -y, s1 +x, s2 +y, s3 -x)
    dx, dy = -ox, -oy
    lx, ly = dx * ca + dy * sa, -dx * sa + dy * ca
    vis = (ly < 0.0, lx > W, ly > D, lx < 0.0)
    if lod == 3:
        h = {"house": 2 * FH + 1.5, "ware": 7.0}.get(typ, FH * min(cap, 2 + int(r.random() * (3 + 6 * I))))
        gen_box(b, W, D, h, r, zg, r.choice(["building_plaster", "building_tile", "concrete"]))
        return
    if typ == "house":
        gen_house(b, W, D, max(lod, 1), r, zg, vis)
    elif typ == "ware":
        gen_ware(b, W, D, lod, r, zg, vis)
    elif typ == "tower":
        gen_tower(b, W, D, min(cap + 6, 12 + int(r.random() * (8 + 14 * I))), lod, r, zg, vis)
    elif typ == "apt":
        nf = min(cap, 3 + int(r.random() * (4 + 9 * I)))
        if D > W * 1.3:
            # balconies on the long edge, facing old +x (toward the viaduct / camera): frame turned by +90 deg,
            # new x = old +y, new y = old -x, origin at old (W, 0)
            b.frame(ox + W * ca, oy + W * sa, zb0, ang + math.pi * 0.5)
            gen_apt(b, D, W, nf, lod, r, zg, vis=(vis[1], vis[2], vis[3], vis[0]))
        else:
            gen_apt(b, W, D, nf, lod, r, zg, vis=vis)
    else:
        gen_block(b, W, D, min(cap, 2 + int(r.random() * (3 + 7 * I))), lod, r, zg, vis)


def step_city_far():
    lots, parks = _left_plan()
    c = sub("left_far")
    chunks = {}
    for lot in lots:
        if lot["lod"] < 2:
            continue
        key = (int(lot["c"][0] // 320), int(lot["c"][1] // 320), lot["lod"])
        b = chunks.get(key)
        if b is None:
            b = chunks[key] = MB()
        _left_building(b, lot)
    for (i, j, lod), b in chunks.items():
        if not b.empty():
            b.build(PFX + "left_%s_%d_%d" % ("far" if lod == 2 else "hid", i, j), c,
                    origin=((i + 0.5) * 320.0, (j + 0.5) * 320.0, CZ))


def step_city_near():
    lots, parks = _left_plan()
    c = sub("left_near")
    blocks = {}
    for lot in lots:
        if lot["lod"] > 1:
            continue
        b = blocks.get(lot["bid"])
        if b is None:
            b = blocks[lot["bid"]] = [MB(), [], []]
        _left_building(b[0], lot)
        b[1].append(lot["c"][0]); b[2].append(lot["c"][1])
    for bid, (b, xs, ys) in blocks.items():
        if b.empty():
            continue
        ob = b.build(PFX + "left_blk_%04d" % bid, c, origin=(sum(xs) / len(xs), sum(ys) / len(ys), CZ))
        ob["rand"] = C.rng(bid).random()


# ============================================================================================== right hillside plan
ROWS = [(a + RSHIFT, b + RSHIFT) for a, b in (
    (21.0, 31.0), (33.0, 43.5), (45.5, 56.0), (58.0, 69.0), (71.5, 83.0), (85.0, 98.0), (101.0, 115.5),
    (118.5, 134.0), (138.0, 156.0), (160.0, 180.0), (185.0, 208.0), (213.0, 240.0), (246.0, 275.0))]
BELT = (18.2, ROWS[0][0] - 1.2)  # garden-tree belt between the right street and the first house row
FIXED_APTS = [  # x0, x1, y0, y1, storeys, wall key, balcony facing
    (33.4, 43.2, 98.0, 122.0, 5, "building_tile", "-x"),
    (46.0, 55.6, 150.0, 176.0, 4, "building_plaster", "-y"),
    (58.5, 68.6, 226.0, 256.0, 6, "building_plaster", "-x"),
    (21.5 + RSHIFT, 30.6 + RSHIFT, 300.0, 322.0, 3, "building_tile", "-x"),
    (72.0, 82.6, 120.0, 146.0, 5, "concrete", "-y"),
    (86.0, 97.5, 280.0, 312.0, 6, "building_tile", "-x"),
]
FOREST = [(58.0, 100.0, 332.0, 404.0), (120.0, 182.0, 470.0, 560.0)]   # shrine grove, wooded slope


def _overlap(a, b, m=0.0):
    return a[0] < b[1] + m and a[1] > b[0] - m and a[2] < b[3] + m and a[3] > b[2] - m


def _right_plan():
    if "right" in S:
        return S["right"]
    r = C.rng(2792)
    cross, y = [], -120.0
    while y < 800:
        y += r.uniform(70.0, 130.0)
        cross.append(y)
    reserved = [HR] + [f[:4] for f in FIXED_APTS] + FOREST
    lots = []
    for ri, (x0, x1) in enumerate(ROWS):
        y = -140.0 + r.uniform(0.0, 8.0)
        ymax = 780.0 if x0 < 140 else 900.0
        while y < ymax:
            u = r.random()
            apt = ri < 8 and 30 < y < 640 and u < 0.07 and not (ri < 2 and y < 150)
            w = r.uniform(20.0, 30.0) if apt else r.uniform(9.0, 13.5)
            rc = (x0, x1, y, y + w)
            y += w + r.uniform(0.6, 2.0)
            if any(c_ - 3.5 < (rc[2] + rc[3]) * 0.5 < c_ + 3.5 or (rc[2] < c_ < rc[3]) for c_ in cross):
                continue
            if any(_overlap(rc, q, 1.0) for q in reserved):
                continue
            cx, cy = (x0 + x1) * 0.5, (rc[2] + rc[3]) * 0.5
            vis = inview(cx, cy, 40.0)
            if not vis and r.random() < 0.5:
                continue
            if apt and vis:
                typ = "apt"
            elif u < 0.17:
                typ = "garden"
            elif u < 0.22:
                typ = "park"           # parking / empty lot
            else:
                typ = "house"
            lots.append(dict(rect=rc, row=ri, typ=typ, vis=vis, seed=r.random(),
                             detail=vis and x0 < 100 and cy < 620))
    S["right"] = dict(lots=lots, cross=cross)
    return S["right"]


# ============================================================================================== right: houses
def wall_holes(b, p0, p1, z0, z1, holes, wallk):
    L, tx, ty, P = _edge(p0, p1)
    ss = sorted({0.0, L} | {h[0] for h in holes} | {h[1] for h in holes})
    zs = sorted({z0, z1} | {h[2] for h in holes} | {h[3] for h in holes})
    for i in range(len(ss) - 1):
        sc = (ss[i] + ss[i + 1]) * 0.5
        for j in range(len(zs) - 1):
            zc = (zs[j] + zs[j + 1]) * 0.5
            if any(h[0] < sc < h[1] and h[2] < zc < h[3] for h in holes):
                continue
            fq(b, P, ss[i], ss[i + 1], zs[j], zs[j + 1], 0.0, wallk)
    return L, tx, ty, P


def opening(b, P, tx, ty, h, wallk, frame, r, L):
    a, c, za, zb, kind = h
    rec = 0.09
    glass = "steel_dark" if kind == "door" else "window_city"
    recess(b, P, tx, ty, a, c, za, zb, rec, frame, glass)
    if kind != "door":
        m = (a + c) * 0.5
        fq(b, P, m - 0.025, m + 0.025, za, zb, -rec + 0.025, frame)
        fq(b, P, a, c, za, za + 0.04, -rec + 0.02, frame)
    if kind == "door":
        fbox(b, P, tx, ty, a - 0.3, c + 0.3, 0.0, 0.85, zb + 0.18, zb + 0.26, "galvanized")
    elif kind == "big" or (kind == "win" and r.random() < 0.35):
        # rain-shutter box above, shutter pocket beside the window
        fbox(b, P, tx, ty, a - 0.05, c + 0.05, 0.0, 0.2, zb, zb + 0.28, frame, "flrtb")
        pw = (c - a) * 0.5
        if c + pw < L - 0.15:
            fbox(b, P, tx, ty, c + 0.02, c + pw, 0.0, 0.16, za - 0.03, zb, wallk, "flrtb")
    elif kind == "win" and r.random() < 0.6:
        fbox(b, P, tx, ty, a - 0.15, c + 0.15, 0.0, 0.42, zb + 0.12, zb + 0.17, "galvanized")
    elif kind == "grille":
        n = max(3, int((c - a) / 0.11))
        for k in range(n):
            s = a + 0.06 + (c - a - 0.12) * k / max(1, n - 1)
            fbox(b, P, tx, ty, s - 0.011, s + 0.011, 0.02, 0.05, za - 0.04, zb + 0.04, "stainless", "flr")
        for zz in (za - 0.04, zb + 0.01):
            fbox(b, P, tx, ty, a - 0.03, c + 0.03, 0.02, 0.06, zz, zz + 0.03, "stainless", "ftb")


def _place(L, n, w, lo=0.4, avoid=()):
    out = []
    for k in range(n):
        cc = L * (k + 0.5) / n
        a, c = cc - w * 0.5, cc + w * 0.5
        if a < lo or c > L - lo or any(a < q[1] + 0.3 and c > q[0] - 0.3 for q in avoid):
            continue
        out.append((a, c))
    return out


def gen_house_detail(b, W, D, r):
    """Hillside house, front toward local -y, ground at z = 0 (foundation goes 3 m down for the slope)."""
    # siding mix: tiled / stucco, dark metal siding, grey ALC panel ("concrete"); upper storey sometimes differs
    k1 = r.choices(["building_tile", "building_plaster", "building_dark", "concrete"], [3, 3, 2, 1.6])[0]
    k2 = r.choices([k1, "building_plaster", "building_tile", "building_dark"], [5, 1.5, 1, 1])[0]
    frame = r.choice(["stainless", "steel_dark", "stainless"])
    kind = r.choices(["hip", "gable", "gable_m", "flat"], [5, 3, 1.2, 1.2])[0]
    p = r.uniform(0.38, 0.5) if kind != "gable_m" else r.uniform(0.25, 0.33)
    ov = r.uniform(0.45, 0.7)
    base = 0.45
    ze = 2 * FH + 0.25
    if kind == "hip":
        zw = ze - 0.16
    elif kind.startswith("gable"):
        zw = ze - 0.16 + p * ov
    else:
        zw = 2 * FH + 0.65
    b.box(-0.03, W + 0.03, -0.03, D + 0.03, -3.0, base, "concrete", "snew")
    sides = [((0.0, 0.0), (W, 0.0)), ((W, 0.0), (W, D)), ((W, D), (0.0, D)), ((0.0, D), (0.0, 0.0))]
    holes = [[] for _ in range(4)]
    # front: door at one end, big sliding window(s); 2F balcony with glass door + a small window
    left = r.random() < 0.5
    da = 0.55 if left else W - 1.45
    holes[0].append((da, da + 0.9, base + 0.05, 2.35, "door"))
    free = (da + 1.5, W - 0.5) if left else (0.5, da - 0.6)
    if free[1] - free[0] > 2.0:
        cc = (free[0] + free[1]) * 0.5
        holes[0].append((cc - 0.85, cc + 0.85, WIN[0] + 0.12, WIN[1] - 0.04, "big"))
    bw = min(W - 1.2, r.uniform(3.4, 5.6))
    bx0 = r.uniform(0.6, W - 0.6 - bw)
    bx1 = bx0 + bw
    bc = (bx0 + bx1) * 0.5
    holes[0].append((bc - 0.85, bc + 0.85, FH + 0.45, FH + WIN[1] - 0.04, "bal"))
    rest = (0.5, bx0 - 0.3) if bx0 > W - bx1 else (bx1 + 0.3, W - 0.5)
    if rest[1] - rest[0] > 1.4:
        cc = (rest[0] + rest[1]) * 0.5
        holes[0].append((cc - 0.6, cc + 0.6, FH + 1.2, FH + 2.3, "win"))
    # sides and back
    for s, L in ((1, D), (3, D), (2, W)):
        n1 = 1 + (L > 8.0) if s != 2 else 2
        for a, c in _place(L, n1, r.uniform(1.1, 1.7)):
            holes[s].append((a, c, 1.25, 2.35, "grille" if r.random() < 0.35 else "win"))
        for a, c in _place(L, 1 + (L > 7.5), r.uniform(1.3, 1.8)):
            holes[s].append((a, c, FH + 1.15, FH + 2.35, "win"))
    zmid = FH + 0.1
    for s in range(4):
        p0, p1 = sides[s]
        h1 = [h for h in holes[s] if h[3] <= zmid]
        h2 = [h for h in holes[s] if h[2] >= zmid]
        wall_holes(b, p0, p1, base, zmid, h1, k1)
        L, tx, ty, P = wall_holes(b, p0, p1, zmid, zw, h2, k2)
        for h in holes[s]:
            opening(b, P, tx, ty, h, k1 if h[3] <= zmid else k2, frame, r, L)
    # belt course between the storeys
    b.box(-0.035, W + 0.035, -0.035, D + 0.035, FH, FH + 0.12, r.choice(["building_dark", "building_plaster"]), "snewb")
    # balcony
    b.box(bx0, bx1, -0.95, 0.0, FH - 0.1, FH + 0.1, "concrete", "tbsew")
    if r.random() < 0.5:
        b.box(bx0, bx1, -0.95, -0.85, FH + 0.1, FH + 1.15, k2, "tsnew")
        for x0_, x1_ in ((bx0, bx0 + 0.1), (bx1 - 0.1, bx1)):
            b.box(x0_, x1_, -0.85, 0.0, FH + 0.1, FH + 1.15, k2, "tew" if x0_ == bx0 else "twe")
    else:
        rail = "stainless" if frame == "stainless" else "steel_dark"
        for zz in (FH + 1.08, FH + 0.15):
            b.box(bx0, bx1, -0.95, -0.90, zz, zz + 0.06, rail, "tsnb")
        for k in range(5):
            zz = FH + 0.3 + k * 0.16
            b.box(bx0, bx1, -0.94, -0.92, zz, zz + 0.07, rail, "tsnb")
        for x in (bx0 + 0.03, bx1 - 0.03, bc):
            b.box(x - 0.025, x + 0.025, -0.95, -0.90, FH + 0.1, FH + 1.14, rail, "snew")
        for x in (bx0, bx1):
            b.box(x - 0.025, x + 0.025, -0.95, 0.0, FH + 1.08, FH + 1.14, rail, "tew")
    b.cyl((bx0 + 0.15, -0.45, FH + 1.95), (bx1 - 0.15, -0.45, FH + 1.95), 0.016, seg=5, key="stainless")
    for x in (bx0 + 0.25, bx1 - 0.25):                    # laundry-pole holders off the wall
        b.box(x - 0.015, x + 0.015, -0.50, 0.0, FH + 1.93, FH + 2.0, "stainless", "tsnewb")
    if r.random() < 0.7:
        ac_unit(b, bx0 + 0.2 if bc > W * 0.5 else bx1 - 1.05, -0.75, FH + 0.1, 0, -1)
    house_clutter(b, W, D, r, bx0, bx1, k2, holes)
    # 1F pent roof over the part of the front without the balcony (traditional houses)
    if kind in ("hip", "gable") and r.random() < 0.45:
        px0, px1 = (0.0, bx0 - 0.1) if bx0 > 2.0 else (bx1 + 0.1, W)
        if px1 - px0 > 1.6:
            zt, dp, dr = FH - 0.05, 0.9, 0.35
            b.polyn([(px0, 0.0, zt), (px0, -dp, zt - dr), (px1, -dp, zt - dr), (px1, 0.0, zt)], "roof_tile", (0, -1, 1))
            b.polyn([(px0, -dp, zt - dr - 0.12), (px1, -dp, zt - dr - 0.12), (px1, -dp, zt - dr), (px0, -dp, zt - dr)],
                    "building_dark", (0, -1, 0))
            b.polyn([(px0, 0.0, zt - 0.12), (px1, 0.0, zt - 0.12), (px1, -dp, zt - dr - 0.12), (px0, -dp, zt - dr - 0.12)],
                    "building_plaster", (0, 0, -1))
            for x, nx in ((px0, -1), (px1, 1)):
                b.polyn([(x, 0.0, zt - 0.12), (x, -dp, zt - dr - 0.12), (x, -dp, zt - dr), (x, 0.0, zt)],
                        "building_dark", (nx, 0, 0))
    # roof
    if kind == "hip":
        zr = roof_hip(b, W, D, ze, ov, p, "roof_tile", 0)
    elif kind == "gable":
        zr = roof_gable(b, W, D, ze, ov, p, "roof_tile", 0, k2)[1]
    elif kind == "gable_m":
        zr = roof_gable(b, W, D, ze, ov, p, "steel_dark", 0, k2)[1]
    else:
        roof_flat(b, W, D, 2 * FH + 0.25, 0.4, 0, k2, "galvanized", "galvanized")
        zr = 2 * FH + 0.65
        ac_unit(b, W * 0.3, D * 0.5, 2 * FH + 0.25, 0, -1)
    # downpipes
    for x, y in ((0.12, -0.10), (W - 0.12, D + 0.10)):
        b.cyl((x, y, zw), (x, y, 0.0), 0.04, seg=6, key="galvanized")
    # TV antenna
    if kind != "flat" and r.random() < 0.45:
        ax, ay = W * r.uniform(0.35, 0.65), D * 0.5
        b.cyl((ax, ay, zr - 0.3), (ax, ay, zr + 2.2), 0.022, seg=5, key="galvanized")
        b.box(ax - 0.015, ax + 0.015, ay - 0.75, ay + 0.75, zr + 1.9, zr + 1.93, "galvanized", "tsnewb")
        for k in range(6):
            yy = ay - 0.7 + k * 0.28
            hw = 0.26 - k * 0.025
            b.box(ax - hw, ax + hw, yy - 0.008, yy + 0.008, zr + 1.9, zr + 1.92, "galvanized", "tsnb")
    return dict(kind=kind, eave=(0.2, -0.3, zw - 0.3))


def wall_ac(b, P, tx, ty, s, z):
    """Split AC outdoor unit on wall brackets (facade coords: s along the wall, outward o)."""
    nx, ny = ty, -tx
    fbox(b, P, tx, ty, s, s + 0.80, 0.06, 0.36, z, z + 0.62, "galvanized", "flrtb")
    for ss in (s + 0.08, s + 0.70):
        fbox(b, P, tx, ty, ss, ss + 0.04, 0.0, 0.40, z - 0.06, z, "steel_dark", "flrtb")
    cx, cz, rr = s + 0.32, z + 0.31, 0.21
    b.polyn([P(cx + rr * math.cos(a), 0.364, cz + rr * math.sin(a)) for a in (i * math.pi / 5 for i in range(10))],
            "plastic_black", (nx, ny, 0))
    # refrigerant pipe cover running down the wall
    fbox(b, P, tx, ty, s + 0.86, s + 0.96, 0.0, 0.08, 0.15, z + 0.45, "building_plaster", "flrt")
    fbox(b, P, tx, ty, s + 0.62, s + 0.96, 0.0, 0.08, z + 0.40, z + 0.50, "building_plaster", "flrtb")


def house_clutter(b, W, D, r, bx0, bx1, wallk, holes):
    """Things that make a suburban house read as lived in: balcony cover, wall ACs + pipe ducts, vent hoods,
    a satellite dish, a gas meter box, a hanging futon/laundry on some balconies."""
    sides = [((0.0, 0.0), (W, 0.0)), ((W, 0.0), (W, D)), ((W, D), (0.0, D)), ((0.0, D), (0.0, 0.0))]
    # polycarbonate balcony cover on a galvanized frame
    if r.random() < 0.5:
        z0, z1 = FH + 2.62, FH + 2.42
        b.polyn([(bx0, 0.0, z0), (bx0, -1.05, z1), (bx1, -1.05, z1), (bx1, 0.0, z0)], "glass", (0, 0, 1))
        b.polyn([(bx0, 0.0, z0 - 0.012), (bx1, 0.0, z0 - 0.012), (bx1, -1.05, z1 - 0.012), (bx0, -1.05, z1 - 0.012)],
                "glass", (0, 0, -1))
        b.box(bx0, bx1, -1.10, -1.02, z1 - 0.09, z1, "galvanized", "tsnewb")
        for x in (bx0 + 0.02, (bx0 + bx1) * 0.5, bx1 - 0.08):
            b.polyn([(x, 0.0, z0 - 0.07), (x, -1.05, z1 - 0.07), (x, -1.05, z1), (x, 0.0, z0)], "galvanized", (-1, 0, 0))
            b.polyn([(x + 0.06, 0.0, z0), (x + 0.06, -1.05, z1), (x + 0.06, -1.05, z1 - 0.07), (x + 0.06, 0.0, z0 - 0.07)],
                    "galvanized", (1, 0, 0))
    # laundry / futon over the balcony rail
    if r.random() < 0.35:
        n = r.randint(1, 3)
        for k in range(n):
            w_ = r.uniform(0.5, 1.0)
            x = bx0 + 0.3 + (bx1 - bx0 - 0.6 - w_) * (k + 0.5) / n
            key = r.choice(["building_plaster", "line_white", "building_tile"])
            b.box(x, x + w_, -0.99, -0.95, FH + 0.55, FH + 1.17, key, "tsnew")
            b.box(x, x + w_, -0.95, -0.86, FH + 1.13, FH + 1.20, key, "tsnew")
    # side walls: AC units (2F, sometimes 1F) with pipe ducts, vent hoods, gas meter
    for s in (1, 3):
        p0, p1 = sides[s]
        L, tx, ty, P = _edge(p0, p1)
        busy = [(h[0], h[1]) for h in holes[s]]
        for zz, pr in ((FH + 0.35, 0.65), (0.55, 0.4)):
            if r.random() < pr:
                for _ in range(4):
                    sa = r.uniform(0.3, L - 1.3)
                    if not any(sa < h1 + 0.1 and sa + 1.0 > h0 - 0.1 for h0, h1 in busy):
                        wall_ac(b, P, tx, ty, sa, zz)
                        busy.append((sa, sa + 1.0))
                        break
        for _ in range(r.randint(1, 3)):
            sa = r.uniform(0.4, L - 0.6)
            zz = r.choice((1.9, FH + 1.9, FH + 2.5))
            fbox(b, P, tx, ty, sa, sa + 0.18, 0.0, 0.13, zz, zz + 0.16, "stainless", "flrtb")
        if s == 1 and r.random() < 0.6:
            fbox(b, P, tx, ty, 0.6, 0.95, 0.0, 0.16, 1.1, 1.55, "building_plaster", "flrtb")
    # satellite dish on the balcony end or a wall bracket
    if r.random() < 0.22:
        x, y, z = (bx1 - 0.2, -0.95, FH + 1.45) if r.random() < 0.5 else (W + 0.02, D * 0.4, 2 * FH)
        b.cyl((x, y, z - 0.3), (x, y, z), 0.02, seg=4, key="galvanized")
        b.cyl((x - 0.05, y - 0.02, z + 0.08), (x - 0.12, y - 0.12, z + 0.02), 0.30, 0.22, seg=12, key="building_plaster")


def gen_house_simple(b, W, D, r):
    """Cheap house prototype for far rows (same look at a distance)."""
    gen_house(b, W, D, 1, r, -2.5, (True, True, True, True))


def step_houses():
    plan = _right_plan()
    c = sub("right_houses")
    protos = []
    r = C.rng(27931)
    for k in range(18):
        W, D = r.uniform(7.0, 10.0), r.uniform(7.2, 9.0)
        b = MB()
        info = gen_house_detail(b, W, D, C.rng(500 + k))
        protos.append((b.mesh(PFX + "proto_house_%02d" % k), W, D, info))
    simple = []
    for k in range(6):
        W, D = r.uniform(7.0, 11.0), r.uniform(7.0, 9.5)
        b = MB()
        gen_house_simple(b, W, D, C.rng(700 + k))
        simple.append((b.mesh(PFX + "proto_house_far_%02d" % k), W, D, None))
    S["drops"] = []
    S["trees_r"] = []
    n = 0
    placed = {}                                    # row -> [(y centre, prototype mesh name)]
    for lot in plan["lots"]:
        x0, x1, y0, y1 = lot["rect"]
        r = C.rng(int(lot["seed"] * 1e9))
        cx, cy = (x0 + x1) * 0.5, (y0 + y1) * 0.5
        if lot["typ"] == "garden":
            for k in range(r.randint(2, 5)):
                S["trees_r"].append((r.uniform(x0 + 1, x1 - 1), r.uniform(y0 + 1, y1 - 1), r.random()))
            continue
        if lot["typ"] != "house":
            continue
        pool = protos if lot["detail"] else simple
        u = r.random()
        rot = -math.pi * 0.5 if u < 0.65 else (0.0 if u < 0.85 else (math.pi * 0.5 if u < 0.95 else math.pi))
        along_y = abs(math.sin(rot)) > 0.5           # prototype W runs along world y
        lw, ld = y1 - y0, x1 - x0
        fits = [q for q in pool if (q[1] if along_y else q[2]) <= lw - 1.0 and (q[2] if along_y else q[1]) <= ld - 1.2]
        if not fits:
            fits = [min(pool, key=lambda q: q[1])]
        # never the same prototype as the previous house in this row or a neighbour in the row in front
        ri = lot["row"]
        recent = {nm for (yy, nm) in placed.get(ri, [])[-2:]}
        recent |= {nm for (yy, nm) in placed.get(ri - 1, []) if abs(yy - cy) < 16.0}
        fresh = [q for q in fits if q[0].name not in recent]
        if not fresh:
            fresh = [q for q in pool if q[0].name not in recent] or fits
        me, W, D, info = r.choice(fresh)
        placed.setdefault(ri, []).append((cy, me.name))
        jx = r.uniform(-0.4, 0.4); jy = r.uniform(-0.4, 0.4)
        ca, sa = math.cos(rot), math.sin(rot)
        lcx, lcy = W * 0.5 * ca - D * 0.5 * sa, W * 0.5 * sa + D * 0.5 * ca
        gx, gy = cx + jx, cy + jy
        z = H(gx, gy)
        ob = inst(me, PFX + "house_%04d" % n, (gx - lcx, gy - lcy, z), rot, c, lot["seed"])
        if info is not None:
            ob["win_geo"] = 1.0            # openings are modelled (frames, sashes): window_city may drop its pane grid
        n += 1
        if info is not None:
            ex, ey, ez = info["eave"]
            S["drops"].append((gx - lcx + ex * ca - ey * sa, gy - lcy + ex * sa + ey * ca, z + ez))
        if r.random() < 0.5:
            # garden tree in a free corner of the lot
            S["trees_r"].append((r.choice((x0 + 0.8, x1 - 0.8)), r.choice((y0 + 0.8, y1 - 0.8)), r.random()))


# ============================================================================================== right: apartments + high-rise
def _apt_obj(name, c, x0, x1, y0, y1, nf, wallk, face, seed, lod=0, parak=None):
    r = C.rng(seed)
    b = MB()
    b.rand = r.random()
    if face == "-y":
        W, D, rot, org = x1 - x0, y1 - y0, 0.0, (x0, y0)
    elif face == "-x":                                 # balcony toward the tracks: local x runs along -y
        W, D, rot, org = y1 - y0, x1 - x0, -math.pi * 0.5, (x0, y1)
    else:
        W, D, rot, org = y1 - y0, x1 - x0, math.pi * 0.5, (x1, y0)
    zs = [H(x, y) for x in (x0, x1) for y in (y0, y1)]
    zb0 = sum(zs) / 4.0 + 0.3
    zg = min(zs) - zb0 - 1.0
    gen_apt(b, W, D, nf, lod, r, zg, wallk=wallk, parak=parak)
    ob = b.build(PFX + name, c)
    ob.location = (org[0], org[1], zb0)
    ob.rotation_euler = (0.0, 0.0, rot)
    ob["rand"] = b.rand
    return ob


def step_apartments():
    plan = _right_plan()
    c = sub("right_apts")
    for i, (x0, x1, y0, y1, nf, wk, face) in enumerate(FIXED_APTS):
        _apt_obj("apt_fixed_%d" % i, c, x0, x1, y0, y1, nf, wk, face, 900 + i)
    lots = plan["lots"]
    n = 0
    for i, lot in enumerate(lots):
        if lot["typ"] != "apt":
            continue
        x0, x1, y0, y1 = lot["rect"]
        r = C.rng(int(lot["seed"] * 1e9))
        face = "-x" if r.random() < 0.6 else "-y"
        _apt_obj("apt_%03d" % n, c, x0 + 0.8, x1 - 0.8, y0 + 0.8, y1 - 0.8, r.randint(3, 6),
                 r.choice(["building_plaster", "building_tile", "concrete"]), face, 1000 + i,
                 lod=0 if x0 < 90 else 1)
        n += 1
    # the white high-rise (15 storeys), balconies toward the camera
    hr = _apt_obj("highrise", c, HR[0], HR[1], HR[2], HR[3], 15, "building_plaster", "-y", 1501,
                  parak="building_plaster")
    hr["tint"] = (1.0, 1.0, 1.0)
    hr.color = (1.0, 1.0, 1.0, 1.0)


# ============================================================================================== trees
_ICO = {}


def ico(subd):
    if subd not in _ICO:
        bm = bmesh.new()
        bmesh.ops.create_icosphere(bm, subdivisions=subd, radius=1.0)
        V = [tuple(v.co) for v in bm.verts]
        F = [tuple(v.index for v in f.verts) for f in bm.faces]
        bm.free()
        _ICO[subd] = (V, F)
    return _ICO[subd]


def blob(b, c, rad, sq, seed, subd, amp=0.30, freq=1.7, smooth=True):
    """Noise-displaced icosphere clump; returns (verts, tris) of the clump (local frame) for leaf scattering."""
    V, F = ico(subd)
    n0 = len(b.V)
    off = Vector((seed * 1.37, seed * 0.71, seed * 2.13))
    pts = []
    for v in V:
        d = Vector(v)
        j = 1.0 + amp * noise.fractal(d * freq + off, 0.7, 2.1, 3, noise_basis="PERLIN_NEW") \
            + amp * 0.55 * noise.noise(d * 6.5 + off * 3.0, noise_basis="PERLIN_NEW")
        z = d.z * sq * (0.7 if d.z < -0.25 else 1.0)
        q = (c[0] + d.x * rad * j, c[1] + d.y * rad * j, c[2] + z * rad * j)
        pts.append(q)
        b.V.append(b.w(*q))
    for f in F:
        b.face(tuple(n0 + i for i in f), "foliage", smooth)
    return pts, F


# leaf cards: small opaque bent diamonds (2 tris) scattered over the outward half of each near clump, like the hedge
LEAF = dict(density=230.0, size=(0.10, 0.19), aspect=0.55, fold=0.30, lift=(-0.03, 0.24), tilt=0.95)


def leaves(b, pts, F, ctr, rng_, size=None, density=None):
    """Scatter leaf cards on a clump surface (pts / tri faces), skipping the half that faces the crown centre."""
    P = np.asarray(pts, dtype=np.float64)
    T = np.asarray(F, dtype=np.int64)
    a, bb, cc = P[T[:, 0]], P[T[:, 1]], P[T[:, 2]]
    cr = np.cross(bb - a, cc - a)
    area = 0.5 * np.linalg.norm(cr, axis=1)
    nrm = cr / np.maximum(area[:, None] * 2.0, 1e-9)
    mid = (a + bb + cc) / 3.0
    out = mid - np.asarray(ctr, dtype=np.float64)
    out /= np.maximum(np.linalg.norm(out, axis=1)[:, None], 1e-9)
    keep = (nrm * out).sum(axis=1) > -0.25            # inward-facing side of the clump is hidden inside the crown
    w = area * keep
    tot = w.sum()
    n = int(tot * (density or LEAF["density"]))
    if n <= 0:
        return
    rs = np.random.default_rng(int(rng_.random() * 2 ** 31))
    ti = rs.choice(len(T), size=n, p=w / tot)
    u = rs.random(n); v = rs.random(n)
    flip = u + v > 1.0
    u[flip] = 1.0 - u[flip]; v[flip] = 1.0 - v[flip]
    pos = a[ti] + (bb[ti] - a[ti]) * u[:, None] + (cc[ti] - a[ti]) * v[:, None]
    nn = nrm[ti] + rs.normal(0.0, LEAF["tilt"], (n, 3))
    nn[:, 2] += 0.35                                   # leaves turn up toward the light a little
    nn /= np.maximum(np.linalg.norm(nn, axis=1)[:, None], 1e-9)
    pos += nrm[ti] * rs.uniform(*LEAF["lift"], n)[:, None]
    t = np.cross(nn, rs.normal(0.0, 1.0, (n, 3)))
    t /= np.maximum(np.linalg.norm(t, axis=1)[:, None], 1e-9)
    s_ = np.cross(nn, t)
    lo, hi = size or LEAF["size"]
    L = rs.uniform(lo, hi, n)[:, None]
    Wd = L * LEAF["aspect"] * rs.uniform(0.8, 1.2, n)[:, None]
    fold = (L * LEAF["fold"]) * nn
    q = np.stack([pos - t * L * 0.5, pos - s_ * Wd * 0.5 - fold * 0.5, pos + t * L * 0.5, pos + s_ * Wd * 0.5 - fold * 0.5],
                 axis=1).reshape(-1, 3)
    n0 = len(b.V)
    w_ = b.w
    b.V.extend(w_(*p) for p in q.tolist())
    for k in range(n):
        i = n0 + 4 * k
        b.face((i, i + 1, i + 2), "foliage", True)
        b.face((i, i + 2, i + 3), "foliage", True)


def crown(b, r, cx, cy, cz, rx, ry, rz, n, rmin, rmax, seed, subd, sq=0.85, near=True, leaf=None):
    """Foliage crown on an ellipsoid envelope.  Near trees: fewer, larger smooth-shaded clumps (noise-displaced,
    slightly undersized) carrying a shell of leaf cards; far trees: a few large smooth blobs."""
    if near:
        n = max(3, int(n * 0.45))
    for k in range(n):
        while True:
            q = Vector((r.uniform(-1, 1), r.uniform(-1, 1), r.uniform(-1, 1)))
            if 0.05 < q.length <= 1.0:
                break
        q = q.normalized() * (q.length ** (0.25 if near else 0.6))
        c = (cx + q.x * rx, cy + q.y * ry, cz + q.z * rz)
        if near:
            rad = r.uniform(rmin, rmax) * r.uniform(0.75, 1.3) * 1.3
            pts, F = blob(b, c, rad * 0.78, sq, seed * 31 + k, 2, 0.42, 1.9, smooth=True)
            leaves(b, pts, F, (cx, cy, cz), r, leaf)
        else:
            rad = r.uniform(rmin, rmax)
            blob(b, c, rad, sq, seed * 31 + k, subd, 0.22, 2.2)


def tree_mesh(name, kind, seed, near):
    r = C.rng(seed)
    b = MB()
    subd = 1
    if kind == "broad":                             # camphor / zelkova-like broadleaf: 2-3 sub-crowns on branches
        h = r.uniform(6.0, 9.0); cr = r.uniform(2.3, 3.3)
        fork = h * r.uniform(0.28, 0.36)
        b.cyl((0, 0, -0.6), (0, 0, fork), 0.22, 0.17, seg=7, key=BARK)
        if near:
            subs = []
            for k in range(r.randint(2, 3)):
                a = r.uniform(0, 2 * math.pi) if k == 0 else subs[0][3] + r.uniform(1.8, 4.4) * (k)
                off = r.uniform(0.3, 0.5) * cr
                zc = h * r.uniform(0.55, 0.78)
                subs.append((math.cos(a) * off, math.sin(a) * off, zc, a))
            subs.append((0.0, 0.0, h * 0.8, 0.0))
            for (sx, sy, sz, _a) in subs:
                b.cyl((0, 0, fork - 0.2), (sx * 0.8, sy * 0.8, sz - 0.4), 0.12, 0.06, seg=5, key=BARK)
                rr = cr * r.uniform(0.55, 0.7)
                crown(b, r, sx, sy, sz, rr, rr * r.uniform(0.85, 1.0), rr * 0.72, int(150 / len(subs)) + 10,
                      0.32, 0.55, seed * 3 + int(sz * 10), subd, 0.85, True)
        else:
            ch = h * 0.66
            crown(b, r, 0, 0, ch, cr * 0.72, cr * 0.66, (h - ch) * 0.75 + 0.3, 7, 0.36 * cr, 0.52 * cr, seed, 1,
                  0.85, False)
    elif kind == "garden":                          # pruned garden pine / maki (pads on bent branches)
        h = r.uniform(3.5, 5.5)
        lean = r.uniform(-0.6, 0.6)
        b.cyl((0, 0, -0.4), (lean, 0, h * 0.78), 0.14, 0.07, seg=6, key=BARK)
        for k in range(r.randint(5, 7)):
            a = r.uniform(0, 2 * math.pi); rr = r.uniform(0.5, 1.3)
            zc = r.uniform(0.35, 0.98) * h
            c = (lean * zc / h + math.cos(a) * rr, math.sin(a) * rr, zc)
            b.cyl((lean * zc / h * 0.8, 0, zc - 0.35), c, 0.05, 0.03, seg=4, key=BARK)
            pr = r.uniform(0.55, 0.95)
            if near:
                crown(b, r, c[0], c[1], c[2], pr, pr, pr * 0.3, 14, 0.22, 0.34, seed * 7 + k, 1, 0.55, True,
                      (0.07, 0.13))
            else:
                crown(b, r, c[0], c[1], c[2], pr * 0.6, pr * 0.6, pr * 0.2, 2, 0.38, 0.55, seed * 7 + k, 1, 0.55, False)
    else:                                           # cedar / hinoki: tiers narrowing to a point
        h = r.uniform(9.0, 15.0)
        b.cyl((0, 0, -0.6), (0, 0, h * 0.95), 0.22, 0.05, seg=7, key=BARK)
        nl = r.randint(7, 10) if near else 4
        for k in range(nl):
            t = k / max(1, nl - 1)
            zc = h * (0.28 + 0.66 * t)
            rad = (1.0 - 0.82 * t) * h * 0.16 + 0.25
            if near:
                crown(b, r, 0, 0, zc, rad, rad, rad * 0.45, int(8 + 10 * (1 - t)), 0.26, 0.42, seed * 11 + k, 1,
                      0.7, True, (0.07, 0.13))
            else:
                crown(b, r, 0, 0, zc, rad * 0.55, rad * 0.55, rad * 0.3, 2, 0.35 + rad * 0.35, 0.5 + rad * 0.45,
                      seed * 11 + k, 1, 0.7, False)
    return b.mesh(name)


def step_trees():
    plan = _right_plan()
    lots, parks = _left_plan()
    c = sub("trees")
    near = [tree_mesh(PFX + "proto_tree_%d" % i, k, 40 + i, True)
            for i, k in enumerate(["broad", "broad", "broad", "broad", "garden", "garden", "garden", "conical", "conical"])]
    far = [tree_mesh(PFX + "proto_tree_far_%d" % i, k, 80 + i, False) for i, k in enumerate(["broad", "broad", "conical"])]
    r = C.rng(2794)
    n = [0]

    def put(x, y, protos, rnd=None, s0=0.8, s1=1.25, z=None):
        me = protos[int(r.random() * len(protos))]
        inst(me, PFX + "tree_%05d" % n[0], (x, y, H(x, y) if z is None else z), r.uniform(0, 2 * math.pi), c,
             r.random() if rnd is None else rnd, r.uniform(s0, s1))
        n[0] += 1
    # garden trees from the house step (+ garden lots)
    for (x, y, rnd) in S.get("trees_r", []):
        put(x, y, near if (x < 110 and y < 600) else far, rnd)
    # shrine grove / wooded slope
    for (x0, x1, y0, y1) in FOREST:
        k = int((x1 - x0) * (y1 - y0) / 30.0)
        for _ in range(k):
            x, y = r.uniform(x0, x1), r.uniform(y0, y1)
            put(x, y, near if x < 110 else far, None, 1.0, 1.5)
    # garden-tree belt between the right street and the first house row (clumps, with gaps for the houses)
    y = -50.0
    while y < 700:
        y += r.uniform(5.0, 11.0)
        g = noise.noise(Vector((y / 30.0, 2.7, 0.9)), noise_basis="PERLIN_NEW")
        if g < -0.02 or not inview(BELT[1], y, 30.0):
            continue
        x = r.uniform(*BELT)
        if r.random() < 0.65:
            put(x, y, near[:4], None, 0.75, 1.05)
        else:
            put(x, y, near[4:7] if r.random() < 0.6 else near[7:], None, 0.8, 1.1)
    # wooded hill beyond the last row (cheap trees), only inside the camera wedge
    for _ in range(700):
        x, y = r.uniform(280.0, 700.0), r.uniform(150.0, 1100.0)
        if inview(x, y, 20.0) and noise.noise(Vector((x / 90.0, y / 90.0, 0.4))) > -0.15:
            put(x, y, far, None, 1.1, 1.8)
    # left: parks and a few street trees near the viaduct foot
    for pk in parks:
        a0, a1, b0, b1 = pk["rect"]
        ang = pk["ang"]; ca, sa = math.cos(ang), math.sin(ang)
        ox, oy = pk["o"]
        for _ in range(int((a1 - a0) * (b1 - b0) / 70.0)):
            u, v = r.uniform(a0 + 3, a1 - 3), r.uniform(b0 + 3, b1 - 3)
            x, y = ox + u * ca - v * sa, oy + u * sa + v * ca
            put(x, y, far if math.hypot(x, y) > 350 else near[:4], None, 1.0, 1.5)


# ============================================================================================== utility poles + wires
def pole_mesh(name, h, trans, seed):
    """Concrete distribution pole, wires along local y. Attachments (local) in ATTACH scaled by h."""
    r = C.rng(seed)
    b = MB()
    b.cyl((0, 0, -1.5), (0, 0, h), 0.19, 0.125, seg=12, key="concrete")
    b.cyl((0, 0, h), (0, 0, h + 0.05), 0.125, 0.0, seg=12, key="concrete", cap=(False, False))
    za = h - 0.75
    b.box(-1.0, 1.0, -0.045, 0.045, za - 0.045, za + 0.045, "galvanized", "tsnewb")
    for x in (-0.9, 0.25, 0.9):
        b.cyl((x, 0, za + 0.045), (x, 0, za + 0.20), 0.045, 0.03, seg=8, key="building_plaster")
    for sgn in (-1, 1):
        b.box(sgn * 0.02, sgn * 0.7, -0.015, 0.015, za - 0.5, za - 0.47, "galvanized", "tsnewb")   # arm brace
    zl = h - 2.4
    b.box(-0.6, 0.6, -0.04, 0.04, zl - 0.04, zl + 0.04, "galvanized", "tsnewb")
    for x in (-0.5, 0.5):
        b.cyl((x, 0, zl + 0.04), (x, 0, zl + 0.14), 0.035, seg=6, key="building_plaster")
    if trans:
        zt = h - 4.0
        b.box(-0.1, 0.1, -0.5, 0.5, zt - 0.6, zt - 0.5, "galvanized", "tsnewb")
        for y in (-0.33, 0.33):
            b.cyl((0.32, y, zt - 0.5), (0.32, y, zt + 0.55), 0.24, seg=12, key="galvanized")
            b.cyl((0.32, y, zt + 0.55), (0.32, y, zt + 0.62), 0.24, 0.18, seg=12, key="galvanized")
        b.cyl((0.32, -0.33, zt + 0.62), (0.0, 0.0, zl), 0.012, seg=4, key="wire")
    for zz in (h - 5.2, h - 5.7):
        b.box(0.12, 0.34, -0.03, 0.03, zz - 0.03, zz + 0.03, "galvanized", "tsnewb")
    for k in range(int((h - 3.0) / 0.45)):
        zz = 2.4 + k * 0.45
        a = (k % 2) * math.pi
        b.cyl((0, 0, zz), (math.cos(a + 0.3) * 0.32, math.sin(a + 0.3) * 0.32, zz), 0.012, seg=4, key="galvanized")
    b.box(-0.2, 0.2, -0.19, -0.17, 1.6, 2.1, "building_plaster", "s")        # number plate
    return b.mesh(name)


def attach(h):
    """(x, z, radius, sag factor) of the wires carried by a pole of height h (local x across the line)."""
    za, zl = h - 0.75 + 0.2, h - 2.4 + 0.14
    return [(-0.9, za, 0.007, 0.012), (0.25, za, 0.007, 0.012), (0.9, za, 0.007, 0.012),
            (-0.5, zl, 0.009, 0.018), (0.5, zl, 0.009, 0.018), (0.3, zl - 0.6, 0.016, 0.022),
            (0.36, h - 5.2, 0.028, 0.030), (0.36, h - 5.7, 0.020, 0.034), (-0.3, h - 6.0, 0.014, 0.036)]


def span(b, p, q, r_, sag, n=16):
    pts = []
    for i in range(n + 1):
        t = i / n
        pts.append(Vector((p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t,
                           p[2] + (q[2] - p[2]) * t - sag * 4.0 * t * (1.0 - t))))
    b.tube(pts, r_, 5 if r_ > 0.012 else 4)


def step_poles():
    _right_plan()
    c = sub("poles")
    r = C.rng(2795)
    lines = []
    # right street: 12 m poles on the hill-side kerb
    hR = 12.0
    mR = [pole_mesh(PFX + "proto_pole12_%d" % k, hR, k == 1, 60 + k) for k in range(2)]
    ys, y = [], -100.0
    while y < 760:
        ys.append(y)
        y += r.uniform(28.0, 36.0)
    lines.append((16.45, ys, hR, mR))
    # left street at the viaduct foot: 14 m poles (their tops show over the parapet fence)
    hL = 14.0
    mL = [pole_mesh(PFX + "proto_pole14_%d" % k, hL, k == 1, 70 + k) for k in range(2)]
    ys, y = [], -60.0
    while y < 1000:
        ys.append(y)
        y += r.uniform(34.0, 42.0)
    lines.append((-15.2, ys, hL, mL))
    wb = MB()
    for li, (x, ys, h, ms) in enumerate(lines):
        tops = []
        for i, y in enumerate(ys):
            z = H(x, y)
            m = ms[1] if r.random() < 0.3 else ms[0]
            inst(m, PFX + "pole_%d_%03d" % (li, i), (x, y, z), r.uniform(-0.03, 0.03), c, r.random())
            tops.append((x, y, z))
        at = attach(h)
        for i in range(len(tops) - 1):
            p, q = tops[i], tops[i + 1]
            L = math.dist(p[:2], q[:2])
            for (ax, az, rr, sf) in at:
                if L > 120:
                    continue
                span(wb, (p[0] + ax, p[1], p[2] + az), (q[0] + ax, q[1], q[2] + az), rr,
                     sf * L + r.uniform(-0.05, 0.08))
        if li == 0:
            # service drops from the low-voltage arm to nearby house eaves
            for (px, py, pz) in tops:
                near = sorted((d for d in S.get("drops", []) if abs(d[1] - py) < 22 and d[0] < 34 + RSHIFT),
                              key=lambda d: abs(d[1] - py))[:2]
                for d in near:
                    span(wb, (px + 0.5, py, pz + h - 2.4 + 0.1), d, 0.009, 0.25 + 0.01 * math.dist((px, py), d[:2]), 10)
        else:
            # a few feeders running off into the city
            for (px, py, pz) in tops[::3]:
                q = (px - r.uniform(25, 45), py + r.uniform(-15, 15), pz + h - 3.0)
                span(wb, (px - 0.5, py, pz + h - 2.4 + 0.14), q, 0.009, 0.5)
    wb.build(PFX + "wires", c, attr=False)


STEPS = [
    ("terrain + hills", step_terrain),
    ("left city, far", step_city_far),
    ("left city, near", step_city_near),
    ("hillside houses", step_houses),
    ("apartments + high-rise", step_apartments),
    ("trees", step_trees),
    ("utility poles + wires", step_poles),
]
