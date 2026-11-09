"""Signs: all signage + ad posters (collection "Signs").

Textures come from tools/tex.mjs (node tools/tex.mjs -> tex/*.png). If a PNG is missing the face falls back to a
flat colour and a warning is printed, so other modules' previews never fail on it.

Placement (worked out against parts/canopy.py so nothing passes through the canopy services):
  * Hangers attach to transverse unistrut channels clamped under the purlins (purlin underside zd(x)-0.15,
    purlins at |x| = 0.45, 1.35, 2.25, 3.15, 4.05, 4.85), or to the centre box girder underside (z 3.70).
    Rods avoid the fluorescent rows (|x| 1.35 / 4.05, bottom ~3.83), the cable trays (|x| 0.32..0.80, z 3.62..3.76),
    the conduits (|x| ~1.0) and the girder speakers (y = 9 + 12k).
  * Direction signs y=10 (2 m in front of column 1), |x| 0.40..3.07, z 2.98..3.60 (housing top 2 cm under the
    cable trays at |x| 0.36..0.76, z 3.62; the column shows through the 0.8 m gap between them).
  * LED departure boards y=12.4 (just behind column 1's +Y face 12.225), |x| 0.15..2.27, z 2.45..3.04 (LED window at
    the red/white band height 2.40..2.95; from the camera the column hides their inner ends). Rods at |x| 0.86 / 1.94
    up to a channel at y=12.4 (clear of the main rafter flange y 11.9..12.1). Board A (left, track 2) scrolls.
  * Platform-number placards |x|=3.55, car-stop placards |x|=4.40, elevator signs: hanging one x=0 y=34.6 and a
    0.45x0.28 plate on column 1's -Y face (z 2.07..2.35, arrow up), clock on column 2 (+X arm).
  * Girder speakers are at y = 21 + 12k, tray hangers at y = -22.8 + 1.8k (see parts/canopy.py).
  * 駅名標 standing at x=3.20, y=16 (long axis along Y). Posters framed on the right retaining wall face x=8.64..8.70.
Materials owned here: sign_* and poster_* (see MATS_OWN). Hardware uses the shared keys galvanized / steel_paint /
stainless / plastic_black so parts/materials.py styles it.
"""

import bpy, bmesh, math, os
from mathutils import Vector, Matrix
import common as C

CN = "Signs"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(C.__file__)))
TEX = os.path.join(ROOT, "tex")

# emission strengths (relative; the lighting stage may scale them with EMIT_GAIN)
EMIT_GAIN = 1.0
EMIT = dict(dir=3.2, led=5.0, ledhead=1.2, ekimei=0.6, elevator=1.8, clock=0.35, lightbox=1.1)

# placement (y positions can be overridden before the steps run, e.g. signs.DIR_Y = 13.5)
DIR_Y = 10.0          # direction signs: 2 m in front of column 1 like the reference (rafters at 6 / 12)
DIR_X0, DIR_Z0 = 0.40, 2.98   # inner edge |x| and bottom of the direction signs (top 3.60 < tray bottom 3.62)
LED_Y = 12.4          # LED departure boards: just behind column 1, inner ends hidden by it from the camera
LED_X0, LED_Z0 = 0.15, 2.45
ELEV_Y = 34.6         # elevator sign, in front of column 3 / the shaft
EKIMEI_XY = (3.20, 16.0)

# canopy geometry (mirrors parts/canopy.py; read-only knowledge)
SLOPE = (C.CANOPY_EAVE_Z - C.CANOPY_VALLEY_Z) / C.CANOPY_EAVE_X
PURLIN_X = [0.45, 1.35, 2.25, 3.15, 4.05, 4.85]
GIRDER_Z0 = 3.70


def zp(x):
    """Purlin underside (roof deck underside - 0.15) at x."""
    return C.CANOPY_VALLEY_Z + SLOPE * abs(x) - 0.15


# LED board layout (must match tools/tex.mjs)
LED_NX, LED_NY, LED_P = 208, 40, 0.0095
LED_W, LED_H = LED_NX * LED_P, LED_NY * LED_P           # 1.976 x 0.380
WIN_ROWS = (22, 38)                                      # message window rows (top-origin), 16 rows
SCROLL_DOTS_PER_S = 56.0
SCROLL_START = 40                                        # message starts this many LEDs into the window at frame 1


# ============================================================================================ builder with UVs
class SB(C.Builder):
    """C.Builder + a local transform (self.T) + explicit 0..1 UVs on chosen faces."""

    def __init__(self):
        super().__init__()
        self.T = Matrix()
        self.cuv = {}

    def _t(self, p):
        return tuple(self.T @ Vector(p))

    def tbox(self, x0, x1, y0, y1, z0, z1, key):
        v, f = C.box_geo(min(x0, x1), max(x0, x1), min(y0, y1), max(y0, y1), min(z0, z1), max(z0, z1))
        self.add([self._t(p) for p in v], f, key)

    def tpoly(self, pts, key, uv=None):
        if uv is not None:
            self.cuv[len(self.f)] = list(uv)
        self.poly([self._t(p) for p in pts], key)

    def tquad_y(self, x0, x1, z0, z1, y, key, front=True, uv=((0, 0), (1, 0), (1, 1), (0, 1))):
        """Quad in the local x-z plane. front=True: normal -Y (toward the camera), u along +x.
        front=False: normal +Y, u along -x (so text reads correctly from behind)."""
        if front:
            pts = [(x0, y, z0), (x1, y, z0), (x1, y, z1), (x0, y, z1)]
        else:
            pts = [(x1, y, z0), (x0, y, z0), (x0, y, z1), (x1, y, z1)]
        self.tpoly(pts, key, uv)

    def tcyl(self, p0, p1, r, key, seg=10, cap=True):
        v, f = C.cyl_geo(self._t(p0), self._t(p1), r, seg, cap)
        self.add(v, f, key)

    def tbar(self, p0, p1, w, h, key, up=(0, 0, 1)):
        """Rectangular bar from p0 to p1 (local coords), w across, h along `up`."""
        p0, p1 = Vector(self._t(p0)), Vector(self._t(p1))
        upv = (self.T.to_3x3() @ Vector(up)).normalized()
        a = p1 - p0
        L = a.length
        a.normalize()
        s = a.cross(upv)
        if s.length < 1e-6:
            s = a.orthogonal()
        s.normalize()
        u = s.cross(a).normalized()
        v, f = C.box_geo(-w / 2, w / 2, 0, L, -h / 2, h / 2)
        self.add([tuple(p0 + s * q[0] + a * q[1] + u * q[2]) for q in v], f, key)

    def build(self, name, c, smooth=False):
        ob = super().build(name, c, smooth)
        if self.cuv:
            me = ob.data
            uvl = me.uv_layers["UVMap"]
            for fi, uv in self.cuv.items():
                p = me.polygons[fi]
                for k, li in enumerate(p.loop_indices):
                    uvl.data[li].uv = uv[k]
        return ob


def finish(ob, bevel=0.0, seg=2, smooth=None, recalc=False):
    if recalc:
        bm = bmesh.new(); bm.from_mesh(ob.data)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        bm.to_mesh(ob.data); bm.free()
    if smooth is not None:
        C.smooth_by_angle(ob, smooth)
    if bevel > 0:
        C.add_bevel(ob, bevel, segments=seg, angle_deg=40)
    return ob


def place(x, y, z=0.0, rz=0.0):
    return Matrix.Translation((x, y, z)) @ Matrix.Rotation(rz, 4, "Z")


# ============================================================================================ materials
def _img(name):
    p = os.path.join(TEX, name + ".png")
    if not os.path.exists(p):
        print("[signs] WARNING missing texture %s (run: node tools/tex.mjs)" % p)
        return None
    im = bpy.data.images.get(name + ".png")
    if im is not None and os.path.abspath(bpy.path.abspath(im.filepath)) == os.path.abspath(p):
        im.reload()
    else:
        im = bpy.data.images.load(p, check_existing=False)
        im.name = name + ".png"
    im.colorspace_settings.name = "sRGB"
    return im


class NT:
    """Tiny node-tree helper."""

    def __init__(self, key):
        self.m, self.nodes, self.links, self.out = C.new_material(key)
        ad = self.m.node_tree.animation_data
        if ad:
            act = ad.action
            self.m.node_tree.animation_data_clear()
            if act is not None and act.users == 0:
                bpy.data.actions.remove(act)
        self.x = -1400

    def n(self, t, **kw):
        nd = self.nodes.new(t)
        nd.location = (self.x, 300 - 60 * (len(self.nodes) % 12))
        self.x += 40
        for k, v in kw.items():
            setattr(nd, k, v)
        return nd

    def L(self, a, b):
        self.links.new(a, b)

    def math(self, op, a, b=None, clamp=False):
        nd = self.n("ShaderNodeMath", operation=op, use_clamp=clamp)
        for i, v in enumerate((a, b)):
            if v is None:
                continue
            if isinstance(v, (int, float)):
                nd.inputs[i].default_value = v
            else:
                self.L(v, nd.inputs[i])
        return nd.outputs[0]

    def bsdf(self):
        b = self.n("ShaderNodeBsdfPrincipled")
        self.L(b.outputs["BSDF"], self.out.inputs["Surface"])
        return b

    def tex(self, im, interp="Linear", ext="EXTEND", vec=None):
        t = self.n("ShaderNodeTexImage", interpolation=interp, extension=ext)
        t.image = im
        if vec is not None:
            self.L(vec, t.inputs["Vector"])
        return t


def mat_face(key, img, emit=0.0, rough=0.25, coat=0.0, fallback=(0.1, 0.1, 0.1), fade=0.0):
    """Printed / backlit face: base colour from the image, optional emission from the same image."""
    T = NT(key)
    b = T.bsdf()
    im = _img(img)
    b.inputs["Roughness"].default_value = rough
    if coat > 0:
        b.inputs["Coat Weight"].default_value = coat
        b.inputs["Coat Roughness"].default_value = 0.04
    if im is None:
        b.inputs["Base Color"].default_value = (*fallback, 1)
        return T.m
    t = T.tex(im)
    col = t.outputs["Color"]
    if fade > 0:      # sun-faded print: lift blacks, drop saturation a touch
        hs = T.n("ShaderNodeHueSaturation")
        hs.inputs["Saturation"].default_value = 1.0 - 0.5 * fade
        hs.inputs["Value"].default_value = 1.0 - 0.1 * fade
        T.L(col, hs.inputs["Color"])
        mx = T.n("ShaderNodeMix", data_type="RGBA", blend_type="LIGHTEN")
        mx.inputs[0].default_value = 1.0
        T.L(hs.outputs["Color"], mx.inputs[6])
        mx.inputs[7].default_value = (0.05 * fade, 0.05 * fade, 0.048 * fade, 1)
        col = mx.outputs[2]
    T.L(col, b.inputs["Base Color"])
    if emit > 0:
        T.L(t.outputs["Color"], b.inputs["Emission Color"])
        b.inputs["Emission Strength"].default_value = emit * EMIT_GAIN
    return T.m


def mat_housing():
    """Dark grey painted aluminium sign housing with a little dust on upward faces."""
    T = NT("sign_housing")
    b = T.bsdf()
    geo = T.n("ShaderNodeNewGeometry")
    sep = T.n("ShaderNodeSeparateXYZ")
    T.L(geo.outputs["Normal"], sep.inputs[0])
    up = T.math("MULTIPLY", T.math("SUBTRACT", sep.outputs["Z"], 0.55), 3.0, clamp=True)
    noi = T.n("ShaderNodeTexNoise")
    noi.inputs["Scale"].default_value = 18.0
    tc = T.n("ShaderNodeTexCoord")
    T.L(tc.outputs["Object"], noi.inputs["Vector"])
    dust = T.math("MULTIPLY", up, T.math("ADD", T.math("MULTIPLY", noi.outputs["Fac"], 0.6), 0.4))
    mix = T.n("ShaderNodeMix", data_type="RGBA")
    mix.inputs[6].default_value = (0.045, 0.047, 0.05, 1)
    mix.inputs[7].default_value = (0.22, 0.21, 0.19, 1)
    T.L(dust, mix.inputs[0])
    T.L(mix.outputs[2], b.inputs["Base Color"])
    rr = T.n("ShaderNodeMapRange")
    T.L(noi.outputs["Fac"], rr.inputs["Value"])
    rr.inputs["To Min"].default_value, rr.inputs["To Max"].default_value = 0.32, 0.5
    rmix = T.math("ADD", rr.outputs[0], T.math("MULTIPLY", dust, 0.4))
    T.L(rmix, b.inputs["Roughness"])
    return T.m


def mat_simple(key, rgb, rough, metal=0.0, coat=0.0):
    T = NT(key)
    b = T.bsdf()
    b.inputs["Base Color"].default_value = (*rgb, 1)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    if coat:
        b.inputs["Coat Weight"].default_value = coat
    return T.m


def mat_led(key, img, scroll=None):
    """LED departure board. Static content from `img` (round LEDs drawn in the texture). With scroll=strip image name,
    the message window rows WIN_ROWS show the strip, re-sampled per LED (dot shape made in the shader) and scrolled
    by a keyframed Mapping location (LINEAR, frames 1..300). The window is selected by a UV mask."""
    T = NT(key)
    b = T.bsdf()
    b.inputs["Roughness"].default_value = 0.12        # acrylic front glass
    b.inputs["Coat Weight"].default_value = 0.0
    im = _img(img)
    if im is None:
        b.inputs["Base Color"].default_value = (0.02, 0.02, 0.02, 1)
        return T.m
    tc = T.n("ShaderNodeTexCoord")
    t = T.tex(im, interp="Linear", vec=tc.outputs["UV"])
    col = t.outputs["Color"]
    # lit-LED mask from brightness: unlit dots (~0.02 linear) -> 0, lit -> 1
    sepc = T.n("ShaderNodeSeparateColor")
    T.L(col, sepc.inputs[0])
    mx = T.math("MAXIMUM", T.math("MAXIMUM", sepc.outputs[0], sepc.outputs[1]), sepc.outputs[2])
    mr = T.n("ShaderNodeMapRange", interpolation_type="SMOOTHSTEP")
    T.L(mx, mr.inputs["Value"])
    mr.inputs["From Min"].default_value, mr.inputs["From Max"].default_value = 0.06, 0.30
    stat = T.n("ShaderNodeVectorMath", operation="SCALE")
    T.L(col, stat.inputs[0])
    T.L(mr.outputs[0], stat.inputs["Scale"])
    emis = stat.outputs[0]
    T.L(col, b.inputs["Base Color"])
    im_s = _img(scroll) if scroll else None
    if im_s is not None:
        N = im_s.size[0]
        uvs = T.n("ShaderNodeSeparateXYZ")
        T.L(tc.outputs["UV"], uvs.inputs[0])
        ud = T.math("MULTIPLY", uvs.outputs["X"], float(LED_NX))
        vd = T.math("MULTIPLY", T.math("SUBTRACT", 1.0, uvs.outputs["Y"]), float(LED_NY))   # rows from top
        col_i = T.math("FLOOR", ud)
        row_i = T.math("FLOOR", vd)
        # window mask (rows 22..37)
        mask = T.math("MULTIPLY", T.math("GREATER_THAN", row_i, WIN_ROWS[0] - 0.5),
                      T.math("LESS_THAN", row_i, WIN_ROWS[1] - 0.5))
        # strip lookup: x = led column + 0.5 (scaled by 1/N, shifted by the animated location), y = row in strip
        cmb = T.n("ShaderNodeCombineXYZ")
        T.L(T.math("ADD", col_i, 0.5), cmb.inputs["X"])
        T.L(T.math("SUBTRACT", WIN_ROWS[1] - 0.5, row_i), cmb.inputs["Y"])
        mp = T.n("ShaderNodeMapping", vector_type="POINT")
        mp.name = "ScrollMap"
        mp.inputs["Scale"].default_value = (1.0 / N, 1.0 / 16.0, 1.0)
        T.L(cmb.outputs[0], mp.inputs["Vector"])
        ts = T.tex(im_s, interp="Closest", ext="REPEAT", vec=mp.outputs[0])
        sr = T.n("ShaderNodeSeparateColor")
        T.L(ts.outputs["Color"], sr.inputs[0])
        lit = T.math("GREATER_THAN", sr.outputs[0], 0.5)
        # round LED shape
        fu = T.math("SUBTRACT", T.math("FRACT", ud), 0.5)
        fv = T.math("SUBTRACT", T.math("FRACT", vd), 0.5)
        dist = T.math("SQRT", T.math("ADD", T.math("MULTIPLY", fu, fu), T.math("MULTIPLY", fv, fv)))
        disc = T.n("ShaderNodeMapRange", interpolation_type="SMOOTHSTEP")
        T.L(dist, disc.inputs["Value"])
        disc.inputs["From Min"].default_value, disc.inputs["From Max"].default_value = 0.37, 0.27
        core = T.n("ShaderNodeMapRange", interpolation_type="SMOOTHSTEP")      # hot centre like the texture
        T.L(dist, core.inputs["Value"])
        core.inputs["From Min"].default_value, core.inputs["From Max"].default_value = 0.25, 0.0
        core.inputs["To Max"].default_value = 0.12
        k = T.math("MULTIPLY", T.math("MULTIPLY", lit, disc.outputs[0]), mask)
        red = T.n("ShaderNodeVectorMath", operation="ADD")
        red.inputs[0].default_value = (1.0, 0.10, 0.04)
        T.L(core.outputs[0], red.inputs[1])
        sc = T.n("ShaderNodeVectorMath", operation="SCALE")
        T.L(red.outputs[0], sc.inputs[0])
        T.L(k, sc.inputs["Scale"])
        # static part only outside the window
        st2 = T.n("ShaderNodeVectorMath", operation="SCALE")
        T.L(emis, st2.inputs[0])
        T.L(T.math("SUBTRACT", 1.0, mask), st2.inputs["Scale"])
        add = T.n("ShaderNodeVectorMath", operation="ADD")
        T.L(st2.outputs[0], add.inputs[0])
        T.L(sc.outputs[0], add.inputs[1])
        emis = add.outputs[0]
        # keyframes on the mapping location (units of the strip width), LINEAR
        nt = T.m.node_tree
        path = 'nodes["ScrollMap"].inputs[1].default_value'
        frames = C.CAM["frames"]
        dots = SCROLL_DOTS_PER_S * (frames - 1) / C.CAM["fps"]
        for fr, d in ((1, -SCROLL_START), (frames, -SCROLL_START + dots)):
            mp.inputs["Location"].default_value[0] = d / N
            nt.keyframe_insert(path, index=0, frame=fr)
        _linear(nt)
    T.L(emis, b.inputs["Emission Color"])
    b.inputs["Emission Strength"].default_value = EMIT["led"] * EMIT_GAIN
    return T.m


def _linear(idblock):
    ad = idblock.animation_data
    if not ad or not ad.action:
        return
    try:
        from bpy_extras import anim_utils
        cb = anim_utils.action_get_channelbag_for_slot(ad.action, ad.action_slot)
        fcs = cb.fcurves if cb else []
    except Exception:
        fcs = getattr(ad.action, "fcurves", [])
    for fc in fcs:
        for kp in fc.keyframe_points:
            kp.interpolation = "LINEAR"
        fc.extrapolation = "LINEAR"


MATS_OWN = []


def step_materials():
    C.coll(CN, fresh=True)
    for me in list(bpy.data.meshes):          # meshes orphaned by the fresh collection (keeps names stable)
        if me.users == 0 and me.name.startswith("Signs_"):
            bpy.data.meshes.remove(me)
    MATS_OWN.clear()

    def reg(m):
        MATS_OWN.append(m.name)
        return m
    reg(mat_housing())
    reg(mat_simple("sign_frame", (0.78, 0.79, 0.80), 0.28, metal=1.0))          # anodised aluminium trims / poster frames
    reg(mat_simple("sign_red", (0.55, 0.03, 0.02), 0.4))                        # clock second hand
    reg(mat_simple("sign_glass", (1, 1, 1), 0.02))                              # clock glass (made transmissive below)
    g = bpy.data.materials["sign_glass"].node_tree
    bs = next(n for n in g.nodes if n.bl_idname == "ShaderNodeBsdfPrincipled")
    bs.inputs["Transmission Weight"].default_value = 1.0
    bs.inputs["IOR"].default_value = 1.49
    reg(mat_face("sign_dir_2", "sign_dir_2", EMIT["dir"], rough=0.18, coat=0.3))
    reg(mat_face("sign_dir_1", "sign_dir_1", EMIT["dir"], rough=0.18, coat=0.3))
    reg(mat_face("sign_ledhead_a", "sign_ledhead_a", EMIT["ledhead"], rough=0.3))
    reg(mat_face("sign_ledhead_b", "sign_ledhead_b", EMIT["ledhead"], rough=0.3))
    reg(mat_led("sign_led_a", "sign_led_a", scroll="sign_led_scroll"))
    reg(mat_led("sign_led_b", "sign_led_b"))
    for n in ("1", "2"):
        reg(mat_face("sign_plat_" + n, "sign_plat_" + n, 0.0, rough=0.35, fallback=(0.8, 0.8, 0.78)))
    for n in ("8", "6", "4"):
        reg(mat_face("sign_car_" + n, "sign_car_" + n, 0.0, rough=0.35, fallback=(0.8, 0.8, 0.78)))
    reg(mat_face("sign_elevator", "sign_elevator", EMIT["elevator"], rough=0.2, coat=0.3, fallback=(0.1, 0.3, 0.6)))
    reg(mat_face("sign_elevator_col", "sign_elevator_col", EMIT["elevator"], rough=0.2, coat=0.3,
                 fallback=(0.1, 0.3, 0.6)))
    reg(mat_face("sign_clock", "sign_clock", EMIT["clock"], rough=0.3, fallback=(0.9, 0.9, 0.88)))
    reg(mat_face("sign_ekimei_e", "sign_ekimei_e", EMIT["ekimei"], rough=0.3, coat=0.1, fallback=(0.9, 0.9, 0.88)))
    reg(mat_face("sign_ekimei_w", "sign_ekimei_w", EMIT["ekimei"], rough=0.3, coat=0.1, fallback=(0.9, 0.9, 0.88)))
    for p in POSTERS:
        lit = p in LIGHTBOX_POSTERS
        reg(mat_face(p, p, EMIT["lightbox"] if lit else 0.0, rough=0.4, coat=0.8, fade=0.0 if lit else 0.3,
                     fallback=(0.6, 0.6, 0.6)))
    print("[signs] materials:", ", ".join(MATS_OWN))


# ============================================================================================ hardware helpers
def channel(B, y, xa, xb):
    """Transverse unistrut (41x41) clamped under the purlins between |x| xa..xb on one side (same sign)."""
    s = 1 if xa + xb > 0 else -1
    a, b = sorted((abs(xa), abs(xb)))
    B.T = Matrix()
    p0 = Vector((s * a, y, zp(a) - 0.0205))
    p1 = Vector((s * b, y, zp(b) - 0.0205))
    B.tbar(p0, p1, 0.041, 0.041, "galvanized")
    for px in PURLIN_X:
        if a - 0.01 <= px <= b + 0.01:
            z = zp(px)
            B.tbox(s * px - 0.045, s * px + 0.045, y - 0.035, y + 0.035, z - 0.004, z + 0.012, "galvanized")   # clamp
            B.tcyl((s * px - 0.03, y, z + 0.012), (s * px - 0.03, y, z + 0.03), 0.008, "galvanized", seg=6)
            B.tcyl((s * px + 0.03, y, z + 0.012), (s * px + 0.03, y, z + 0.03), 0.008, "galvanized", seg=6)


def rod(B, x, y, z0, z1, r=0.011):
    """Hanger rod from a sign top (z0) up to a support underside (z1), with eye bracket and channel nut."""
    B.T = Matrix()
    B.tcyl((x, y, z0 + 0.03), (x, y, z1), r, "galvanized", seg=10)
    B.tbox(x - 0.03, x + 0.03, y - 0.012, y + 0.012, z0, z0 + 0.05, "galvanized")          # lug on the sign top
    B.tcyl((x, y - 0.016, z0 + 0.03), (x, y + 0.016, z0 + 0.03), 0.009, "stainless", seg=8)  # bolt through the lug
    B.tbox(x - 0.026, x + 0.026, y - 0.026, y + 0.026, z1 - 0.025, z1, "galvanized")        # nut + washer plate
    B.tcyl((x, y, z1 - 0.06), (x, y, z1 - 0.03), r * 1.6, "galvanized", seg=6)               # lock nut


def lightbox(H, F, T, W, Hh, D, wins, key_back=None, recess=0.012, screws=True):
    """Sign housing in local coords (front at -Y, centred on x, z from 0 to Hh).
    wins: list of (x0, x1, z0, z1, key, uv) windows on the front; the face is flush-recessed behind a frame lip.
    key_back: texture key for the back side (same windows mirrored) or None for a plain back."""
    H.T = T; F.T = T
    yf = -D / 2
    yb = D / 2
    # body
    H.tbox(-W / 2, W / 2, yf + recess, yb - (recess if key_back else 0), 0, Hh, "sign_housing")
    # front (and back) frame lips: everything outside the windows' bounding box + bars between windows
    for side in ((yf, yf + recess + 0.003),) + (((yb - recess - 0.003, yb),) if key_back else ()):
        wx0 = min(w[0] for w in wins); wx1 = max(w[1] for w in wins)
        wz0 = min(w[2] for w in wins); wz1 = max(w[3] for w in wins)
        y0, y1 = side
        H.tbox(-W / 2, W / 2, y0, y1, 0, wz0, "sign_housing")
        H.tbox(-W / 2, W / 2, y0, y1, wz1, Hh, "sign_housing")
        H.tbox(-W / 2, wx0, y0, y1, wz0, wz1, "sign_housing")
        H.tbox(wx1, W / 2, y0, y1, wz0, wz1, "sign_housing")
        ws = sorted(wins, key=lambda w: w[2])
        for a, b in zip(ws, ws[1:]):
            if b[2] - a[3] > 1e-4:
                H.tbox(wx0, wx1, y0, y1, a[3], b[2], "sign_housing")
        if screws:
            n = max(2, int(W / 0.45))
            for i in range(n + 1):
                x = -W / 2 + 0.035 + (W - 0.07) * i / n
                for z in ((wz1 + Hh) / 2, wz0 / 2):
                    yy = y0 - 0.0015 if y0 == yf else y1 + 0.0015
                    yc = y0 if y0 == yf else y1
                    H.tcyl((x, yc, z), (x, yy, z), 0.0045, "stainless", seg=8)
    for (x0, x1, z0, z1, key, uv) in wins:
        F.tquad_y(x0, x1, z0, z1, yf + recess - 0.002, key, front=True, uv=uv)
        if key_back:
            kb = key if key_back is True else key_back
            F.tquad_y(x0, x1, z0, z1, yb - recess + 0.002, kb, front=False, uv=uv)


UV1 = ((0, 0), (1, 0), (1, 1), (0, 1))


# ============================================================================================ 2 direction signs
def step_direction():
    c = C.coll(CN)
    H, F, K = SB(), SB(), SB()
    y = DIR_Y
    W, Hh, D = 2.67, 0.62, 0.16
    fw, fh = 2.60, 0.55
    z0 = DIR_Z0
    for s, key in ((-1, "sign_dir_2"), (1, "sign_dir_1")):
        xc = s * (DIR_X0 + W / 2)
        T = place(xc, y, z0)
        lightbox(H, F, T, W, Hh, D, [(-fw / 2, fw / 2, (Hh - fh) / 2, (Hh + fh) / 2, key, UV1)], key)
        # top cap rail (folded edge of the housing lid)
        H.T = T
        H.tbox(-W / 2 - 0.005, W / 2 + 0.005, -D / 2 - 0.005, D / 2 + 0.005, Hh - 0.012, Hh, "sign_housing")
        # hangers to a channel under the purlins 1.35 .. 3.15 (rods clear of the light row at 1.35, the conduits at
        # ~1.0 and the trays at 0.36..0.76)
        ztop = z0 + Hh
        rx = (s * 1.60, s * 2.90)
        channel(K, y, s * 1.35, s * 3.15)
        for x in rx:
            rod(K, x, y, ztop, zp(abs(x)) - 0.041)
        # conduit feeding the lamps: from the housing top up to the channel
        K.T = Matrix()
        K.tcyl((s * 2.20, y + 0.04, ztop), (s * 2.20, y + 0.04, zp(2.20) - 0.041), 0.012, "galvanized", seg=8)
        K.tbox(s * 2.20 - 0.05, s * 2.20 + 0.05, y - 0.0, y + 0.08, ztop, ztop + 0.06, "galvanized")       # junction box
    finish(H.build("Signs_DirHousing", c), bevel=0.006, seg=2)
    F.build("Signs_DirFaces", c)
    finish(K.build("Signs_DirHangers", c), smooth=40)


# ============================================================================================ 3 LED boards
def step_led():
    c = C.coll(CN)
    H, F, K = SB(), SB(), SB()
    y = LED_Y
    W, D = 2.12, 0.15
    mb, gap, mt, hh = 0.05, 0.02, 0.04, 0.10
    Hh = mb + LED_H + gap + hh + mt
    z0 = LED_Z0
    hx0 = -LED_W / 2
    for s, k in ((-1, "a"), (1, "b")):
        xc = s * (LED_X0 + W / 2)
        T = place(xc, y, z0)
        wins = [(hx0, -hx0, mb, mb + LED_H, "sign_led_" + k, UV1),
                (hx0, -hx0, mb + LED_H + gap, mb + LED_H + gap + hh, "sign_ledhead_" + k, UV1)]
        lightbox(H, F, T, W, Hh, D, wins, None)
        H.T = T
        # rear service door outline + louvres on the back
        for i in range(6):
            zz = 0.12 + i * 0.05
            H.tbox(-0.6, 0.6, D / 2, D / 2 + 0.004, zz, zz + 0.012, "sign_housing")
        H.tbox(-W / 2 - 0.004, W / 2 + 0.004, -D / 2 - 0.004, D / 2 + 0.004, Hh - 0.012, Hh, "sign_housing")
        ztop = z0 + Hh
        rx = (s * 0.86, s * 1.94)
        channel(K, y, s * 0.45, s * 2.25)
        for x in rx:
            rod(K, x, y, ztop, zp(abs(x)) - 0.041)
        K.T = Matrix()
        xc2 = s * 1.58                       # clear of the light housings at |x| 1.27..1.43
        K.tcyl((xc2, y + 0.05, ztop), (xc2, y + 0.05, zp(1.58) - 0.041), 0.013, "galvanized", seg=8)   # power conduit
        K.tbox(xc2 - 0.06, xc2 + 0.06, y - 0.01, y + 0.09, ztop, ztop + 0.07, "galvanized")
    finish(H.build("Signs_LEDHousing", c), bevel=0.005, seg=2)
    F.build("Signs_LEDFaces", c)
    finish(K.build("Signs_LEDHangers", c), smooth=40)


# ============================================================================================ 4 placards + elevator sign
PLAT = [(-3.55, 27.0, "2"), (3.55, 27.0, "1"), (-3.55, 63.0, "2"), (3.55, 63.0, "1"), (-3.55, 99.0, "2"),
        (3.55, 99.0, "1"), (-3.55, 135.0, "2"), (3.55, 135.0, "1")]
CARS = [(-4.40, 41.0, "8"), (4.40, 43.0, "8"), (-4.40, 79.0, "6"), (4.40, 81.0, "6"), (-4.40, 113.0, "4"),
        (4.40, 115.0, "4"), (-4.40, 151.0, "8"), (4.40, 153.0, "8")]


def _hang_small(H, F, K, x, y, w, h, d, face_w, face_h, key, zb, rod_dx, both=True):
    T = place(x, y, zb)
    lightbox(H, F, T, w, h, d, [(-face_w / 2, face_w / 2, (h - face_h) / 2, (h + face_h) / 2, key, UV1)],
             key if both else None, recess=0.006, screws=False)
    s = 1 if x > 0 else -1
    ztop = zb + h
    pa = max(p for p in PURLIN_X if p <= abs(x) - rod_dx - 0.02)
    pb = min(p for p in PURLIN_X if p >= abs(x) + rod_dx + 0.02)
    channel(K, y, s * pa, s * pb)
    for dx in (-rod_dx, rod_dx):
        xx = x + dx
        rod(K, xx, y, ztop, zp(abs(xx)) - 0.041, r=0.009)


def col_face_y(cy, z0=0.5, z1=3.5):
    """-Y face of the column cladding at y=cy, measured from the canopy's mesh when it is in the scene (the clad
    size is canopy.py's business and has changed before), else the bare C.COL_SIZE."""
    y = cy - C.COL_SIZE / 2
    ob = bpy.data.objects.get("Canopy_ColumnClad")
    if ob is not None and ob.type == "MESH":
        mw = ob.matrix_world
        for v in ob.data.vertices:
            w = mw @ v.co
            if abs(w.x) < 0.5 and abs(w.y - cy) < 0.5 and z0 < w.z < z1:
                y = min(y, w.y)
    return y


def step_placards():
    c = C.coll(CN)
    H, F, K = SB(), SB(), SB()
    for x, y, n in PLAT:
        _hang_small(H, F, K, x, y, 0.44, 0.44, 0.05, 0.40, 0.40, "sign_plat_" + n, 2.70, 0.15)
    for x, y, n in CARS:
        _hang_small(H, F, K, x, y, 0.33, 0.39, 0.04, 0.30, 0.36, "sign_car_" + n, 2.55, 0.09)
    # elevator sign: centre line, hangs from the girder underside, in front of column 3 / the shaft
    y, W, Hh, D = ELEV_Y, 0.86, 0.34, 0.10
    zb = 2.62
    T = place(0.0, y, zb)
    lightbox(H, F, T, W, Hh, D, [(-0.40, 0.40, 0.02, 0.32, "sign_elevator", UV1)], "sign_elevator", recess=0.008)
    for x in (-0.15, 0.15):
        rod(K, x, y, zb + Hh, GIRDER_Z0, r=0.009)
    K.T = Matrix()
    K.tbox(-0.20, 0.20, y - 0.06, y + 0.06, GIRDER_Z0 - 0.008, GIRDER_Z0, "galvanized")   # clamp plate on the girder
    # second elevator sign: thin backlit plate on column 1's camera face, just below the red/white band
    cy = C.COL_Y[0]
    yf = col_face_y(cy) - 0.002                      # 2 mm proud of the cladding
    w, h, d, zb = 0.45, 0.28, 0.012, 2.07
    H.T = Matrix()
    H.tbox(-w / 2, w / 2, yf - d, yf, zb, zb + h, "sign_housing")
    H.T = Matrix()
    F.T = Matrix()
    F.tquad_y(-w / 2 + 0.008, w / 2 - 0.008, zb + 0.008, zb + h - 0.008, yf - d - 0.001, "sign_elevator_col", uv=UV1)
    for sx in (-1, 1):                                # fixing screws in the trim
        for zz in (zb + 0.004, zb + h - 0.004):
            H.tcyl((sx * (w / 2 - 0.004), yf - d, zz), (sx * (w / 2 - 0.004), yf - d - 0.002, zz), 0.0025,
                   "stainless", seg=6)
    finish(H.build("Signs_PlacardHousing", c), bevel=0.004, seg=2)
    F.build("Signs_PlacardFaces", c)
    finish(K.build("Signs_PlacardHangers", c), smooth=40)


# ============================================================================================ 5 clock
def _ring(B, c0, axis, r_out, r_in, depth, key, seg=48):
    """Tube (open both ends with annulus caps) along `axis` centred at c0."""
    c0 = Vector(c0); ax = Vector(axis).normalized()
    t = Vector((1, 0, 0)) if abs(ax.x) < 0.9 else Vector((0, 0, 1))
    t = (t - ax * t.dot(ax)).normalized(); bb = ax.cross(t)
    v = []
    for e in (-depth / 2, depth / 2):
        for r in (r_out, r_in):
            for i in range(seg):
                a = 2 * math.pi * i / seg
                v.append(tuple(c0 + ax * e + (t * math.cos(a) + bb * math.sin(a)) * r))
    f = []
    O0, I0, O1, I1 = 0, seg, 2 * seg, 3 * seg
    for i in range(seg):
        j = (i + 1) % seg
        f.append((O0 + i, O0 + j, O1 + j, O1 + i))      # outer wall
        f.append((I0 + j, I0 + i, I1 + i, I1 + j))      # inner wall
        f.append((O0 + j, O0 + i, I0 + i, I0 + j))      # back annulus
        f.append((O1 + i, O1 + j, I1 + j, I1 + i))      # front annulus
    B.add(v, f, key)


def step_clock():
    c = C.coll(CN)
    H, F, K = SB(), SB(), SB()
    cy = C.COL_Y[1]
    hc = cy - col_face_y(cy)          # column cladding half-size (canopy clads at 0.275)
    cx, cz = 0.86, 2.53               # clock centre
    R, depth = 0.25, 0.10
    # column clamp band + arm + stem
    za = 2.89
    K.T = Matrix()
    for (x0, x1, y0, y1) in ((-hc - 0.012, hc + 0.012, cy - hc - 0.012, cy - hc), (-hc - 0.012, hc + 0.012, cy + hc, cy + hc + 0.012),
                             (-hc - 0.012, -hc, cy - hc, cy + hc), (hc, hc + 0.012, cy - hc, cy + hc)):
        K.tbox(x0, x1, y0, y1, za - 0.05, za + 0.05, "steel_paint")
    K.tbox(hc + 0.012, hc + 0.03, cy - 0.06, cy + 0.06, za - 0.07, za + 0.07, "steel_paint")       # arm base plate
    K.tbar((hc + 0.03, cy, za), (cx, cy, za), 0.045, 0.045, "steel_paint")
    K.tbar((hc + 0.03, cy, za - 0.17), (hc + 0.30, cy, za - 0.02), 0.022, 0.022, "steel_paint", up=(0, 1, 0))  # brace
    K.tbox(hc + 0.012, hc + 0.03, cy - 0.03, cy + 0.03, za - 0.20, za - 0.14, "steel_paint")
    K.tcyl((cx, cy, za - 0.02), (cx, cy, cz + R - 0.005), 0.018, "steel_paint", seg=12)
    K.tcyl((cx, cy - 0.03, za - 0.0225), (cx, cy + 0.03, za - 0.0225), 0.012, "stainless", seg=8)
    # case: ring + back-to-back dials (both faces), glass, bezel
    _ring(H, (cx, cy, cz), (0, 1, 0), R, R - 0.022, depth, "sign_housing")
    _ring(H, (cx, cy - depth / 2 + 0.004, cz), (0, 1, 0), R + 0.004, R - 0.03, 0.012, "sign_frame")
    _ring(H, (cx, cy + depth / 2 - 0.004, cz), (0, 1, 0), R + 0.004, R - 0.03, 0.012, "sign_frame")
    H.T = Matrix()
    H.tcyl((cx, cy - 0.02, cz), (cx, cy + 0.02, cz), R - 0.021, "sign_housing", seg=48)     # inner body (between dials)
    seg = 64
    rface = R - 0.022
    ruv = 508.0 / 1024.0
    for sgn in (-1, 1):
        yf = cy + sgn * 0.022
        pts, uv = [], []
        for i in range(seg):
            a = 2 * math.pi * i / seg
            ca, sa = math.cos(a), math.sin(a)
            pts.append((cx + rface * ca, yf, cz + rface * sa))
            u = 0.5 + ruv * ca * (1 if sgn < 0 else -1)
            uv.append((u, 0.5 + ruv * sa))
        if sgn > 0:
            pts.reverse(); uv.reverse()
        F.tpoly(pts, "sign_clock", uv)
        # glass disc in front
        gy = cy + sgn * 0.040
        gp = [(cx + (rface + 0.004) * math.cos(2 * math.pi * i / 32), gy, cz + (rface + 0.004) * math.sin(2 * math.pi * i / 32))
              for i in range(32)]
        if sgn > 0:
            gp.reverse()
        F.tpoly(gp, "sign_glass")
        # hands for 17:01:12 (as seen from this face; viewer's right is +X on the -Y face, -X on the +Y face)
        hx = -sgn  # x sign of "right" for this face's viewer
        hy = yf + sgn * 0.004

        def hand(ang_deg, L, tail, w, key, dy):
            a = math.radians(ang_deg)
            d = Vector((hx * math.sin(a), 0, math.cos(a)))
            p0 = Vector((cx, hy + sgn * dy, cz)) - d * tail
            p1 = Vector((cx, hy + sgn * dy, cz)) + d * L
            K.T = Matrix()
            K.tbar(p0, p1, w, 0.002, key, up=(0, 1, 0))
        hand((5 + 1 / 60) * 30, 0.125, 0.03, 0.016, "plastic_black", 0.000)
        hand(1.2 * 6, 0.19, 0.035, 0.011, "plastic_black", 0.003)
        hand(12 * 6, 0.20, 0.05, 0.0035, "sign_red", 0.006)
        K.tcyl((cx, hy, cz), (cx, hy + sgn * 0.010, cz), 0.009, "plastic_black", seg=12)
    finish(H.build("Signs_ClockCase", c), smooth=40, recalc=True)
    F.build("Signs_ClockFaces", c)
    finish(K.build("Signs_ClockArm", c), smooth=40)


# ============================================================================================ 6 駅名標
def step_ekimei():
    c = C.coll(CN)
    H, F, K = SB(), SB(), SB()
    x, y = EKIMEI_XY
    W, Hh, D = 1.90, 0.70, 0.14
    zb = 1.20
    # local frame: rotate so local -Y (front) faces +X (track 1 side); local +x then runs along +Y
    T = place(x, y, zb, math.radians(90))
    lightbox(H, F, T, W, Hh, D, [(-0.90, 0.90, 0.05, 0.65, "sign_ekimei_e", UV1)], "sign_ekimei_w", recess=0.012)
    H.T = T
    H.tbox(-W / 2 - 0.01, W / 2 + 0.01, -D / 2 - 0.01, D / 2 + 0.01, Hh, Hh + 0.025, "sign_housing")   # rain cap
    # two posts outside the ends, base plates with anchor bolts, cross brackets into the housing
    for ly in (-W / 2 - 0.06, W / 2 + 0.06):
        K.T = T
        K.tcyl((ly, 0, 0.012 - zb), (ly, 0, Hh + 0.06), 0.045, "steel_paint", seg=16)
        K.tcyl((ly, 0, Hh + 0.06), (ly, 0, Hh + 0.075), 0.05, "steel_paint", seg=16)                # cap
        K.tbox(ly - 0.11, ly + 0.11, -0.11, 0.11, -zb, 0.012 - zb, "steel_paint")                   # base plate
        for bx in (-0.08, 0.08):
            for by in (-0.08, 0.08):
                K.tcyl((ly + bx, by, 0.012 - zb), (ly + bx, by, 0.03 - zb), 0.011, "galvanized", seg=6)
        for zz in (0.12, Hh - 0.12):
            K.tbox(min(ly, 0) if ly < 0 else W / 2 - 0.01, max(ly, 0) if ly > 0 else -W / 2 + 0.01,
                   -0.03, 0.03, zz - 0.03, zz + 0.03, "steel_paint")
    finish(H.build("Signs_EkimeiHousing", c), bevel=0.006, seg=2)
    F.build("Signs_EkimeiFaces", c)
    finish(K.build("Signs_EkimeiPosts", c), smooth=40)


# ============================================================================================ 7 posters
POSTERS = ["poster_estate", "poster_onsen", "poster_coffee", "poster_school", "poster_museum", "poster_manners",
           "poster_vacancy"]
LIGHTBOX_POSTERS = {"poster_estate", "poster_coffee"}
POSTER_ORDER = ["poster_estate", "poster_onsen", "poster_coffee", "poster_school", "poster_museum", "poster_vacancy",
                "poster_manners", "poster_coffee", "poster_onsen", "poster_estate", "poster_school", "poster_vacancy",
                "poster_museum", "poster_onsen", "poster_coffee", "poster_school"]


def step_posters():
    c = C.coll(CN)
    H, F = SB(), SB()
    xw = C.RIGHT_WALL_X
    pw, ph = 1.40, 1.00             # visible print
    fr = 0.045                      # frame profile width
    zb = 0.22
    for i, key in enumerate(POSTER_ORDER):
        y = 8.0 + 4.0 * i
        lit = key in LIGHTBOX_POSTERS
        d = 0.10 if lit else 0.045          # light boxes stand further off the wall
        # local frame: front (-Y local) faces -X world, local +x runs along -Y world
        T = place(xw - d / 2, y, zb, math.radians(-90))
        H.T = T; F.T = T
        W, Hh = pw + 2 * fr, ph + 2 * fr
        yf, yb = -d / 2, d / 2
        if lit:
            H.tbox(-W / 2, W / 2, yf + 0.012, yb, 0, Hh, "sign_housing")
        else:
            H.tbox(-W / 2 + 0.01, W / 2 - 0.01, yf + 0.03, yb, 0.01, Hh - 0.01, "sign_housing")     # back board
        # snap frame: four bars with a rounded-ish profile (bevelled) in aluminium
        for (x0, x1, z0, z1) in ((-W / 2, W / 2, 0, fr), (-W / 2, W / 2, Hh - fr, Hh),
                                 (-W / 2, -W / 2 + fr, fr, Hh - fr), (W / 2 - fr, W / 2, fr, Hh - fr)):
            H.tbox(x0, x1, yf, yf + (0.035 if not lit else 0.03), z0, z1, "sign_frame")
        if lit:
            for (x0, x1, z0, z1) in ((-W / 2, W / 2, 0, fr), (-W / 2, W / 2, Hh - fr, Hh)):
                H.tbox(x0, x1, yf + 0.03, yb, z0, z1, "sign_frame")
        # print behind the acrylic cover (the cover is the material's coat)
        F.tquad_y(-pw / 2, pw / 2, fr, fr + ph, yf + 0.012, key, front=True, uv=UV1)
        # wall anchors under the bottom bar
        for xx in (-W / 2 + 0.15, W / 2 - 0.15):
            H.tbox(xx - 0.02, xx + 0.02, yf + 0.01, yb, -0.03, 0.0, "galvanized")
    finish(H.build("Signs_PosterFrames", c), bevel=0.006, seg=2)
    F.build("Signs_PosterFaces", c)


STEPS = [
    ("sign textures + materials", step_materials),
    ("direction signs", step_direction),
    ("LED departure boards", step_led),
    ("placards + elevator sign", step_placards),
    ("platform clock", step_clock),
    ("station name board", step_ekimei),
    ("wall posters", step_posters),
]
