"""Shared constants and helpers for the 279 DUSK PLATFORM scene.

World convention (metres, Z up, Blender right-handed):
  * The island platform runs along +Y. The camera stands near y=0 on the centre line and looks down +Y.
  * Platform walking surface is z = 0. Rail top is z = RAIL_TOP (-1.10).
  * Left of camera = -X  -> track 2 (横浜方面), open side, the hill drops away to a city far below (sun side).
  * Right of camera = +X -> track 1 (川崎方面), retaining wall with ad boards, hillside houses above it.
  * Sun is low (about 6 deg) in the left-behind sky: light rakes in from -X/-Y toward +X/+Y.

Every part module (parts/<name>.py) exposes
    STEPS = [("short label", fn), ...]
fn() takes no arguments and builds into its own collection (C.coll("<Name>")).
The build driver calls the steps one by one (screenshots in between), so keep each step a visible chunk of work.
Modules must be re-runnable: C.coll(name, fresh=True) on the first step wipes the collection.

Materials: parts ask for materials only through C.mat("<key>") using the keys in MATS.
C.mat() returns the existing material or creates a flat grey/coloured placeholder.
parts/materials.py later rebuilds the node tree of every material in MATS in place (same datablock),
so modelling never depends on the material module.
UVs: call C.uv_box(obj) on every mesh (box projection, 1 UV unit = 1 metre, object space).
Procedural materials may use either the UV map "UVMap" (metres) or Object / world Position.

No names may depend on UI language: the GUI session runs in zh_HANT, so default node/datablock names are translated.
Always look nodes up by type or keep the Python reference; always pass explicit names to bpy.data.*.new().
"""

import bpy, bmesh, math, random
from mathutils import Vector, Matrix

# ---------------------------------------------------------------------------------------------- layout
PLAT_X = 4.60            # platform half width (edge at x = +-4.60)
PLAT_Y0, PLAT_Y1 = -40.0, 170.0
PLAT_TOP = 0.0
EDGE_OVERHANG = 0.20     # coping overhangs the platform wall by this much (dark refuge recess under it)
COPING_W = 0.30          # light concrete coping strip at the edge
WHITE_LINE = (0.42, 0.52)   # white safety line, distance inward from edge (from, to)
TACTILE = (0.80, 1.10)      # yellow tactile (dotted warning) strip, distance inward from edge
TILE = 0.30              # floor tile size, grout ~4 mm

RAIL_TOP = -1.10
GAUGE = 1.067            # Japanese narrow gauge
TRACK_X = 6.30           # track centre lines at x = +-6.30 (platform edge to track centre 1.70)
BALLAST_TOP = -1.27
TRACK_BED = -1.60        # bottom of ballast / formation level

COL_PITCH = 12.0
COL_Y = [COL_PITCH * k for k in range(1, 14)]   # 12 .. 156; no column at y<=0 (camera runs on x=0)
COL_SIZE = 0.45
CANOPY_Y0, CANOPY_Y1 = -24.0, 162.0
CANOPY_VALLEY_Z = 4.40   # butterfly roof: low valley on x=0 ...
CANOPY_EAVE_Z = 5.05     # ... rising to the eaves
CANOPY_EAVE_X = 5.20     # eave line (overhangs the platform edge by 0.6 m)

LEFT_WALL_X = -8.70      # parapet / fence line beyond track 2 (city side)
RIGHT_WALL_X = 8.70      # retaining wall face beyond track 1
RIGHT_WALL_TOP = 1.70    # top of the retaining wall (street / hedge level on the hill side)
CITY_GROUND_Z = -11.0    # the city below on the left

# ---------------------------------------------------------------------------------------------- camera
CAM = dict(lens=28.0, sensor=36.0, x=0.0, z=1.55, y0=0.5, y1=3.5, pitch_deg=1.0,
           frames=300, fps=24, clip_end=3000.0)
SUN = dict(elevation_deg=6.0, azimuth_deg=-115.0)  # azimuth: angle from +Y toward -X (sun sits left-behind)

RES = (1920, 1080)

# ---------------------------------------------------------------------------------------------- materials
# key -> placeholder RGB (only used until parts/materials.py replaces the node tree)
MATS = {
    "tile_floor":      (0.55, 0.52, 0.47),
    "coping":          (0.62, 0.60, 0.56),
    "tactile_yellow":  (0.80, 0.62, 0.10),
    "line_white":      (0.85, 0.85, 0.82),
    "concrete":        (0.50, 0.49, 0.46),
    "concrete_dark":   (0.30, 0.29, 0.27),
    "steel_paint":     (0.56, 0.58, 0.58),   # light grey painted steel (columns cladding, beams)
    "steel_dark":      (0.18, 0.19, 0.20),   # dark painted steel (purlins, roof underside details, fence)
    "galvanized":      (0.55, 0.56, 0.57),
    "roof_deck":       (0.40, 0.41, 0.42),   # underside of folded metal roof
    "stainless":       (0.70, 0.70, 0.70),
    "stripe_warning":  (0.70, 0.20, 0.18),   # red/white diagonal stripes (procedural)
    "rail_steel":      (0.35, 0.30, 0.27),
    "sleeper":         (0.52, 0.51, 0.48),
    "ballast":         (0.40, 0.38, 0.35),
    "light_tube":      (1.00, 1.00, 1.00),   # emissive fluorescent tube
    "light_housing":   (0.75, 0.75, 0.73),
    "glass":           (0.80, 0.85, 0.85),
    "wire":            (0.05, 0.05, 0.05),
    "plastic_black":   (0.03, 0.03, 0.03),
    "asphalt":         (0.20, 0.20, 0.20),
    "foliage":         (0.12, 0.20, 0.08),
    "building_plaster":(0.70, 0.66, 0.60),
    "building_tile":   (0.62, 0.56, 0.50),
    "building_dark":   (0.30, 0.30, 0.32),
    "window_city":     (0.20, 0.22, 0.25),   # building windows, some lit at dusk
    "roof_tile":       (0.22, 0.24, 0.27),   # Japanese house roofs (kawara)
    "terrain":         (0.25, 0.24, 0.20),
}


def mat(key):
    """Get material by key (must be in MATS, or a sign_/poster_ key owned by signs.py)."""
    m = bpy.data.materials.get(key)
    if m is None:
        m = bpy.data.materials.new(key)
        m.use_nodes = True
        nt = m.node_tree
        bsdf = next((n for n in nt.nodes if n.bl_idname == "ShaderNodeBsdfPrincipled"), None)
        if bsdf is None:
            bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
        out = next((n for n in nt.nodes if n.bl_idname == "ShaderNodeOutputMaterial"), None)
        if out is None:
            out = nt.nodes.new("ShaderNodeOutputMaterial")
        if not out.inputs["Surface"].is_linked:
            nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
        rgb = MATS.get(key, (0.5, 0.5, 0.5))
        bsdf.inputs["Base Color"].default_value = (*rgb, 1)
        bsdf.inputs["Roughness"].default_value = 0.6
        m.diffuse_color = (*rgb, 1)
        if key == "light_tube":
            bsdf.inputs["Emission Color"].default_value = (1, 1, 1, 1)
            bsdf.inputs["Emission Strength"].default_value = 8.0
    return m


def new_material(key):
    """Wipe and return a material's node tree (used by materials.py / signs.py). Returns (mat, nodes, links, out)."""
    m = bpy.data.materials.get(key) or bpy.data.materials.new(key)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    out.location = (600, 0)
    return m, nt.nodes, nt.links, out


# ---------------------------------------------------------------------------------------------- collections
def coll(name, fresh=False, parent=None):
    c = bpy.data.collections.get(name)
    if c is not None and fresh:
        for o in list(c.all_objects):
            bpy.data.objects.remove(o, do_unlink=True)
        for ch in list(c.children_recursive):
            bpy.data.collections.remove(ch)
    if c is None:
        c = bpy.data.collections.new(name)
    par = parent or bpy.context.scene.collection
    if c.name not in [x.name for x in par.children]:
        par.children.link(c)
    return c


def link(obj, c):
    for uc in list(obj.users_collection):
        uc.objects.unlink(obj)
    c.objects.link(obj)
    return obj


# ---------------------------------------------------------------------------------------------- mesh helpers
def mesh(name, verts, faces, c, mats=None, mat_idx=None, smooth=False):
    """Create a mesh object. mats: list of material keys; mat_idx: per-face index into mats."""
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(v) for v in verts], [], [tuple(f) for f in faces])
    me.validate(clean_customdata=False)
    me.update()
    ob = bpy.data.objects.new(name, me)
    c.objects.link(ob)
    for k in (mats or []):
        me.materials.append(mat(k))
    if mat_idx is not None:
        me.polygons.foreach_set("material_index", list(mat_idx))
    if smooth:
        me.polygons.foreach_set("use_smooth", [True] * len(me.polygons))
    uv_box(ob)
    return ob


def box_geo(x0, x1, y0, y1, z0, z1, off=0):
    v = [(x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0),
         (x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)]
    f = [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]
    return v, [tuple(i + off for i in q) for q in f]


def box(name, x0, x1, y0, y1, z0, z1, key, c, bevel=0.0):
    v, f = box_geo(min(x0, x1), max(x0, x1), min(y0, y1), max(y0, y1), min(z0, z1), max(z0, z1))
    ob = mesh(name, v, f, c, [key])
    if bevel > 0:
        add_bevel(ob, bevel)
    return ob


class Builder:
    """Accumulate many boxes / quads into one mesh (keeps object count low)."""

    def __init__(self):
        self.v, self.f, self.mi = [], [], []
        self.keys = []

    def _k(self, key):
        if key not in self.keys:
            self.keys.append(key)
        return self.keys.index(key)

    def box(self, x0, x1, y0, y1, z0, z1, key):
        v, f = box_geo(min(x0, x1), max(x0, x1), min(y0, y1), max(y0, y1), min(z0, z1), max(z0, z1), len(self.v))
        self.v += v; self.f += f; self.mi += [self._k(key)] * 6

    def quad(self, a, b, c_, d, key):
        n = len(self.v)
        self.v += [a, b, c_, d]; self.f.append((n, n + 1, n + 2, n + 3)); self.mi.append(self._k(key))

    def poly(self, pts, key):
        n = len(self.v)
        self.v += list(pts); self.f.append(tuple(range(n, n + len(pts)))); self.mi.append(self._k(key))

    def add(self, verts, faces, key):
        n = len(self.v)
        self.v += list(verts); self.f += [tuple(i + n for i in q) for q in faces]; self.mi += [self._k(key)] * len(faces)

    def build(self, name, c, smooth=False):
        return mesh(name, self.v, self.f, c, self.keys, self.mi, smooth)


def uv_box(ob, scale=1.0):
    """Box-project UVs in object space, 1 UV unit = 1 m / scale."""
    me = ob.data
    if not me.polygons:
        return
    bm = bmesh.new(); bm.from_mesh(me)
    uv = bm.loops.layers.uv.get("UVMap") or bm.loops.layers.uv.new("UVMap")
    for f in bm.faces:
        n = f.normal
        ax = max(range(3), key=lambda i: abs(n[i]))
        for l in f.loops:
            co = l.vert.co
            if ax == 0:
                u, v = co.y, co.z
            elif ax == 1:
                u, v = co.x, co.z
            else:
                u, v = co.x, co.y
            l[uv].uv = (u / scale, v / scale)
    bm.to_mesh(me); bm.free()


def add_bevel(ob, width, segments=2, angle_deg=40):
    m = ob.modifiers.new("Bevel", "BEVEL")
    m.width = width; m.segments = segments
    m.limit_method = "ANGLE"; m.angle_limit = math.radians(angle_deg)
    m.harden_normals = False
    return m


def smooth_by_angle(ob, deg=35.0):
    """Smooth shading with sharp edges above `deg` (5.x has no use_auto_smooth)."""
    me = ob.data
    me.polygons.foreach_set("use_smooth", [True] * len(me.polygons))
    bm = bmesh.new(); bm.from_mesh(me)
    sharp = []
    lim = math.radians(deg)
    for e in bm.edges:
        s = (not e.is_manifold) or (len(e.link_faces) == 2 and e.calc_face_angle(0.0) > lim)
        sharp.append(s)
    bm.free()
    attr = me.attributes.get("sharp_edge") or me.attributes.new("sharp_edge", "BOOLEAN", "EDGE")
    attr.data.foreach_set("value", sharp)
    me.update()


def cylinder(name, p0, p1, r, key, c, seg=12, cap=True):
    """Cylinder between two points (smooth shaded)."""
    v, f = cyl_geo(p0, p1, r, seg, cap)
    ob = mesh(name, v, f, c, [key])
    smooth_by_angle(ob, 50)
    return ob


def cyl_geo(p0, p1, r, seg=12, cap=True, off=0):
    p0, p1 = Vector(p0), Vector(p1)
    ax = (p1 - p0).normalized()
    t = ax.orthogonal().normalized(); b = ax.cross(t)
    v, f = [], []
    for p in (p0, p1):
        for i in range(seg):
            a = 2 * math.pi * i / seg
            v.append(tuple(p + (t * math.cos(a) + b * math.sin(a)) * r))
    for i in range(seg):
        j = (i + 1) % seg
        f.append((off + i, off + j, off + seg + j, off + seg + i))
    if cap:
        f.append(tuple(off + i for i in reversed(range(seg))))
        f.append(tuple(off + seg + i for i in range(seg)))
    return v, f


def instance(src, name, loc, c, rot=(0, 0, 0)):
    """Linked duplicate (shares mesh data, cheap in memory and in Cycles)."""
    ob = bpy.data.objects.new(name, src.data)
    ob.location = loc; ob.rotation_euler = rot
    for m in src.modifiers:
        nm = ob.modifiers.new(m.name, m.type)
        for p in ("width", "segments", "limit_method", "angle_limit"):
            if hasattr(m, p):
                setattr(nm, p, getattr(m, p))
    c.objects.link(ob)
    return ob


def rng(seed):
    return random.Random(seed)


# ---------------------------------------------------------------------------------------------- camera
def setup_camera(frame=None):
    """Create / update the shot camera with its dolly animation. frame=None keeps the current frame."""
    sc = bpy.context.scene
    cam = bpy.data.objects.get("ShotCam")
    if cam is None:
        cd = bpy.data.cameras.new("ShotCam")
        cam = bpy.data.objects.new("ShotCam", cd)
        coll("Camera").objects.link(cam)
    cd = cam.data
    cd.lens = CAM["lens"]; cd.sensor_width = CAM["sensor"]; cd.sensor_fit = "HORIZONTAL"
    cd.clip_start = 0.05; cd.clip_end = CAM["clip_end"]
    sc.camera = cam
    sc.render.fps = CAM["fps"]
    sc.frame_start, sc.frame_end = 1, CAM["frames"]
    sc.render.resolution_x, sc.render.resolution_y = RES
    cam.rotation_mode = "XYZ"
    cam.rotation_euler = (math.radians(90 + CAM["pitch_deg"]), 0, 0)   # looking down +Y
    cam.animation_data_clear()
    for fr, y in ((1, CAM["y0"]), (CAM["frames"], CAM["y1"])):
        cam.location = (CAM["x"], y, CAM["z"])
        cam.keyframe_insert("location", frame=fr)
    # gentle ease in/out (default Bezier keys); see parts/camera.py for the final move
    if frame is not None:
        sc.frame_set(frame)
    return cam


def sun_vector():
    """Unit vector pointing from the scene toward the sun."""
    el = math.radians(SUN["elevation_deg"]); az = math.radians(SUN["azimuth_deg"])
    return Vector((math.sin(az) * math.cos(el), math.cos(az) * math.cos(el), math.sin(el)))


def sky_sun_rotation():
    """Value for ShaderNodeTexSky.sun_rotation matching sun_vector() (measured: 0 = sun toward +Y, +90deg = toward +X)."""
    return math.radians(SUN["azimuth_deg"])
