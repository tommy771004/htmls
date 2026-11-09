"""Procedural materials for every key in C.MATS (279 DUSK PLATFORM).

Each step rebuilds the node trees of one family of materials *in place* (C.new_material(key) wipes the tree of the
existing datablock, so objects keep their assignment).  No image textures.

Coordinate conventions used here
  * Platform-surface patterns (tiles, tactile blocks, line wear) use world Position (Geometry node), so the tile grid is
    continuous across separate floor objects:  floor tiles 0.30 m, a tile is centred on x = 0, rows start at y = 0.
    Tactile blocks use |x| measured from the strip's inner edge (|x| = PLAT_X - TACTILE[1]), so both strips line up.
    Tactile dome centres sit on a 0.06 m grid inside each 0.30 m block (5 x 5 domes).
  * An object that carries *real* tactile dome geometry can set the custom property  ob["tactile_geo"] = 1.0 ; the
    tactile material then drops its dome bump (keeps colour and dirt, uses AO for gap dirt) so domes are not doubled.
  * `light_tube` exposes a Value node named "TubeStrength" (emission strength) for lighting.py to tune.
  * `window_city` exposes a Value node named "WindowLit" (emission strength of lit windows) and "WindowRatio"
    (fraction of lit windows).
"""

import bpy, math
import common as C

SQ2 = math.sqrt(2.0)


# ============================================================================================== node helpers
class G:
    """Tiny node-graph builder: methods take sockets / nodes / constants and return output sockets."""

    def __init__(self, key):
        self.key = key
        self.m, self.n, self.l, self.out = C.new_material(key)
        self._c = {}
        self._i = 0
        rgb = C.MATS.get(key)
        if rgb:
            self.m.diffuse_color = (*rgb, 1)

    # -- plumbing
    def node(self, t, **props):
        nd = self.n.new(t)
        for k, v in props.items():
            setattr(nd, k, v)
        i = self._i; self._i += 1
        nd.location = (-300 - 190 * (i % 10), 900 - 230 * (i // 10))
        return nd

    def put(self, sock, v):
        if v is None:
            return
        if isinstance(v, bpy.types.NodeSocket):
            self.l.new(v, sock)
        elif isinstance(v, bpy.types.Node):
            self.l.new(v.outputs[0], sock)
        else:
            if sock.type == "RGBA":
                if isinstance(v, (int, float)):
                    v = (v, v, v, 1.0)
                elif len(v) == 3:
                    v = (*v, 1.0)
            elif sock.type == "VECTOR" and isinstance(v, (int, float)):
                v = (v, v, v)
            sock.default_value = v

    # -- inputs
    def pos(self):
        if "geo" not in self._c:
            self._c["geo"] = self.node("ShaderNodeNewGeometry")
        return self._c["geo"].outputs["Position"]

    def nrm(self):
        self.pos()
        return self._c["geo"].outputs["Normal"]

    def obj(self):
        if "tc" not in self._c:
            self._c["tc"] = self.node("ShaderNodeTexCoord")
        return self._c["tc"].outputs["Object"]

    def uv(self):
        if "uv" not in self._c:
            self._c["uv"] = self.node("ShaderNodeUVMap", uv_map="UVMap")
        return self._c["uv"].outputs["UV"]

    def orand(self):
        if "oi" not in self._c:
            self._c["oi"] = self.node("ShaderNodeObjectInfo")
        return self._c["oi"].outputs["Random"]

    def value(self, name, v):
        nd = self.node("ShaderNodeValue")
        nd.name = name; nd.label = name
        nd.outputs[0].default_value = v
        return nd.outputs[0]

    def sep(self, v):
        nd = self.node("ShaderNodeSeparateXYZ"); self.put(nd.inputs[0], v)
        return nd.outputs[0], nd.outputs[1], nd.outputs[2]

    def comb(self, x=0.0, y=0.0, z=0.0):
        nd = self.node("ShaderNodeCombineXYZ")
        for i, v in enumerate((x, y, z)):
            self.put(nd.inputs[i], v)
        return nd.outputs[0]

    # -- math
    def math(self, op, a, b=None, c=None, clamp=False):
        nd = self.node("ShaderNodeMath", operation=op, use_clamp=clamp)
        for i, v in enumerate((a, b, c)):
            self.put(nd.inputs[i], v)
        return nd.outputs[0]

    def add(self, a, b, clamp=False): return self.math("ADD", a, b, clamp=clamp)
    def sub(self, a, b, clamp=False): return self.math("SUBTRACT", a, b, clamp=clamp)
    def mul(self, a, b, clamp=False): return self.math("MULTIPLY", a, b, clamp=clamp)
    def mad(self, a, b, c, clamp=False): return self.math("MULTIPLY_ADD", a, b, c, clamp=clamp)
    def mx(self, a, b): return self.math("MAXIMUM", a, b)
    def mn(self, a, b): return self.math("MINIMUM", a, b)
    def ab(self, a): return self.math("ABSOLUTE", a)
    def fract(self, a): return self.math("FRACT", a)
    def floor(self, a): return self.math("FLOOR", a)
    def inv(self, a): return self.math("SUBTRACT", 1.0, a, clamp=True)
    def clamp(self, a): return self.math("ADD", a, 0.0, clamp=True)

    def edge_dist(self, coord, pitch):
        """Distance (in coord units) from coord to the nearest multiple of pitch."""
        f = self.fract(self.mul(coord, 1.0 / pitch))
        return self.mul(self.mn(f, self.sub(1.0, f)), pitch)

    def vm(self, op, a, b=None, scale=None):
        nd = self.node("ShaderNodeVectorMath", operation=op)
        self.put(nd.inputs[0], a); self.put(nd.inputs[1], b)
        if scale is not None:
            self.put(nd.inputs[3], scale)
        return nd.outputs["Value"] if op in ("DOT_PRODUCT", "LENGTH", "DISTANCE") else nd.outputs["Vector"]

    def vscale(self, v, s):
        """Component-wise multiply of a vector by a constant 3-tuple."""
        return self.vm("MULTIPLY", v, tuple(s))

    def mr(self, x, a, b, c=0.0, d=1.0, smooth=False, clamp=True):
        nd = self.node("ShaderNodeMapRange", interpolation_type="SMOOTHSTEP" if smooth else "LINEAR", clamp=clamp)
        for i, v in enumerate((x, a, b, c, d)):
            self.put(nd.inputs[i], v)
        return nd.outputs["Result"]

    def gauss(self, x, mu, sigma):
        t = self.mul(self.sub(x, mu), 1.0 / sigma)
        return self.math("EXPONENT", self.mul(self.mul(t, t), -0.5))

    # -- colour
    def mix(self, fac, a, b, blend="MIX", clamp=False):
        nd = self.node("ShaderNodeMix", data_type="RGBA", blend_type=blend, clamp_result=clamp)
        self.put(nd.inputs[0], fac); self.put(nd.inputs[6], a); self.put(nd.inputs[7], b)
        return nd.outputs[2]

    def mixf(self, fac, a, b):
        nd = self.node("ShaderNodeMix", data_type="FLOAT")
        self.put(nd.inputs[0], fac); self.put(nd.inputs[2], a); self.put(nd.inputs[3], b)
        return nd.outputs[0]

    def cmul(self, a, b):
        return self.mix(1.0, a, b, blend="MULTIPLY")

    def ramp(self, fac, stops, interp="LINEAR"):
        nd = self.node("ShaderNodeValToRGB")
        cr = nd.color_ramp; cr.interpolation = interp
        while len(cr.elements) < len(stops):
            cr.elements.new(0.5)
        for el, (p, col) in zip(cr.elements, stops):
            el.position = p
            el.color = (*col, 1.0) if len(col) == 3 else col
        self.put(nd.inputs[0], fac)
        return nd.outputs["Color"]

    def hsv(self, col, h=0.5, s=1.0, v=1.0):
        nd = self.node("ShaderNodeHueSaturation")
        self.put(nd.inputs["Hue"], h); self.put(nd.inputs["Saturation"], s); self.put(nd.inputs["Value"], v)
        self.put(nd.inputs["Color"], col)
        return nd.outputs[0]

    def bw(self, col):
        nd = self.node("ShaderNodeRGBToBW"); self.put(nd.inputs[0], col)
        return nd.outputs[0]

    # -- textures
    def noise(self, vec, scale, detail=2.0, rough=0.5, distortion=0.0, dims="3D", out="Factor", w=None):
        nd = self.node("ShaderNodeTexNoise", noise_dimensions=dims)
        self.put(nd.inputs["Vector"], vec)
        if w is not None:
            self.put(nd.inputs["W"], w)
        nd.inputs["Scale"].default_value = scale
        nd.inputs["Detail"].default_value = detail
        nd.inputs["Roughness"].default_value = rough
        nd.inputs["Distortion"].default_value = distortion
        return nd.outputs[out]

    def vor(self, vec, scale, out="Distance", feature="F1", dims="3D", rand=1.0):
        nd = self.node("ShaderNodeTexVoronoi", feature=feature, voronoi_dimensions=dims)
        self.put(nd.inputs["Vector"], vec)
        nd.inputs["Scale"].default_value = scale
        nd.inputs["Randomness"].default_value = rand
        return nd.outputs[out]

    def white(self, vec, out="Value", dims="3D", w=None):
        nd = self.node("ShaderNodeTexWhiteNoise", noise_dimensions=dims)
        self.put(nd.inputs["Vector"], vec)
        if w is not None:
            self.put(nd.inputs["W"], w)
        return nd.outputs[out]

    # -- geometry-ish
    def ao(self, dist, samples=8, only_local=False, inside=False):
        nd = self.node("ShaderNodeAmbientOcclusion", samples=samples, only_local=only_local, inside=inside)
        nd.inputs["Distance"].default_value = dist
        return nd.outputs["AO"]

    def edges(self, radius=0.012, lo=0.015, hi=0.12, samples=4):
        """0..1 mask on convex/concave edges (bevel-normal deviation)."""
        bv = self.node("ShaderNodeBevel", samples=samples)
        bv.inputs["Radius"].default_value = radius
        d = self.vm("DOT_PRODUCT", bv.outputs[0], self.nrm())
        return self.mr(self.sub(1.0, d), lo, hi, smooth=True)

    def up(self, lo=0.55, hi=0.95):
        """Mask of upward-facing surfaces."""
        return self.mr(self.sep(self.nrm())[2], lo, hi, smooth=True)

    def vertical(self):
        """1 on vertical faces, 0 on horizontal."""
        return self.sub(1.0, self.ab(self.sep(self.nrm())[2]), clamp=True)

    def bump(self, h, strength=1.0, dist=1.0, normal=None):
        nd = self.node("ShaderNodeBump")
        self.put(nd.inputs["Strength"], strength); self.put(nd.inputs["Distance"], dist)
        self.put(nd.inputs["Height"], h); self.put(nd.inputs["Normal"], normal)
        return nd.outputs[0]

    # -- shaders
    ALIAS = {"base": "Base Color", "rough": "Roughness", "metal": "Metallic", "normal": "Normal",
             "spec": "Specular IOR Level", "aniso": "Anisotropic", "aniso_rot": "Anisotropic Rotation",
             "coat": "Coat Weight", "coat_rough": "Coat Roughness", "emc": "Emission Color",
             "ems": "Emission Strength", "trans": "Transmission Weight", "ior": "IOR", "alpha": "Alpha",
             "sss": "Subsurface Weight", "sheen": "Sheen Weight", "spec_tint": "Specular Tint"}

    def principled(self, **kw):
        nd = self.node("ShaderNodeBsdfPrincipled")
        nd.location = (250, 300)
        for k, v in kw.items():
            if k == "thin":
                nd.inputs["Thin Wall"].default_value = bool(v)
                continue
            self.put(nd.inputs[self.ALIAS.get(k, k)], v)
        return nd

    def bsdf(self, **kw):
        nd = self.principled(**kw)
        self.l.new(nd.outputs[0], self.out.inputs["Surface"])
        return nd

    def shader_out(self, sh):
        self.l.new(sh if isinstance(sh, bpy.types.NodeSocket) else sh.outputs[0], self.out.inputs["Surface"])


def lin(*srgb):
    """sRGB 0-255 triple -> linear 0-1 (for picking colours from the reference)."""
    def f(c):
        c = c / 255.0
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    return tuple(f(c) for c in srgb)


# ============================================================================================== 1. floor family
def _tile_floor():
    g = G("tile_floor")
    X, Y, Z = g.sep(g.pos())
    T = C.TILE
    xs = g.add(X, T / 2)                                # tile centred on x = 0
    d = g.mn(g.edge_dist(xs, T), g.edge_dist(Y, T))     # metres to nearest grout centre line
    cell = g.comb(g.floor(g.mul(xs, 1 / T)), g.floor(g.mul(Y, 1 / T)), 0.0)
    rv = g.white(cell)                                   # per-tile random
    rc = g.white(cell, out="Color", w=None)
    rr, rg_, rb = g.sep(rc)
    fx = g.fract(g.mul(xs, 1 / T)); fy = g.fract(g.mul(Y, 1 / T))

    grout = g.mr(d, 0.0016, 0.0024, 1.0, 0.0, smooth=True)          # 4 mm joint
    near_grout = g.mr(d, 0.002, 0.010, 1.0, 0.0)                     # grime creeping into tile edges
    # worn walking path: both sides of the column line, polished + greyer
    ax = g.ab(X)
    walk = g.add(g.gauss(ax, 1.7, 1.0), g.mul(g.gauss(ax, 0.0, 0.9), 0.5))
    walk_n = g.mul(walk, g.mr(g.noise(g.pos(), 0.9, 2.0), 0.3, 0.7, 0.55, 1.0))

    # --- colour
    base = lin(150, 140, 124)
    tile = g.mix(g.mr(rv, 0, 1, 0.0, 1.0), base, lin(166, 155, 138))                 # per-tile value
    tile = g.mix(g.mul(g.mr(rg_, 0.0, 1.0), 0.5), tile, lin(142, 137, 128))           # some greyer tiles
    odd = g.mr(rb, 0.965, 0.975)                                                       # ~3 % replacement tiles
    tile = g.mix(g.mul(odd, 0.7), tile, lin(140, 132, 120))
    big = g.noise(g.pos(), 0.12, 2.0)
    tile = g.mix(g.mr(big, 0.3, 0.7, 0.0, 0.10), tile, lin(120, 112, 100))           # large tonal drift
    speck = g.noise(g.pos(), 260.0, 2.0, 0.6)
    tile = g.mix(g.mr(speck, 0.4, 0.7, 0.0, 0.12), tile, lin(110, 102, 92))          # stoneware speckle
    speck2 = g.white(g.vscale(g.pos(), (900, 900, 900)))
    tile = g.mix(g.mr(speck2, 0.94, 0.97, 0.0, 0.5), tile, lin(200, 192, 180))       # light grains

    grime_large = g.mr(g.noise(g.pos(), 0.45, 3.0, 0.55), 0.42, 0.72, 0.0, 1.0, smooth=True)
    grime_fine = g.noise(g.pos(), 7.0, 3.0, 0.6)
    grime = g.mad(grime_large, 0.18, g.mul(near_grout, g.mr(grime_fine, 0.35, 0.7, 0.2, 0.65)))
    grime = g.add(grime, g.mul(walk_n, 0.3), clamp=True)
    col = g.mix(grime, tile, lin(84, 80, 72))
    scuff = g.mr(g.noise(g.vscale(g.pos(), (3, 0.6, 3)), 4.0, 3.0, 0.6), 0.62, 0.72, 0.0, 0.25)
    col = g.mix(g.mul(scuff, walk), col, lin(70, 66, 60))                              # shoe scuffs in the path
    col = g.mix(grout, col, lin(62, 58, 52))

    # --- roughness: subtle gloss so the low sun and tubes make a sheen
    rough = g.mad(g.sub(rv, 0.5), 0.06, 0.43)
    rough = g.add(rough, g.mr(grime_fine, 0.3, 0.7, -0.04, 0.05))
    rough = g.sub(rough, g.mul(walk, 0.07))
    rough = g.add(rough, g.mul(grime_large, 0.10))
    rough = g.mixf(grout, rough, 0.85)

    # --- bump: recessed joint with rounded tile arris + slight per-tile lippage + fine surface
    h = g.mul(g.mr(d, 0.0012, 0.003, 0.0, 1.0, smooth=True), 0.0005)
    tilt = g.add(g.mul(g.sub(rr, 0.5), g.sub(fx, 0.5)), g.mul(g.sub(rg_, 0.5), g.sub(fy, 0.5)))
    h = g.add(h, g.mul(tilt, 0.0004))
    h = g.add(h, g.mul(g.noise(g.pos(), 40.0, 2.0), 0.00025))
    nrm = g.bump(h, 1.0, 1.0)
    g.bsdf(base=col, rough=rough, spec=0.5, normal=nrm)


def _tactile_yellow():
    g = G("tactile_yellow")
    X, Y, Z = g.sep(g.pos())
    inner = C.PLAT_X - C.TACTILE[1]              # |x| of the strip's inner edge
    u = g.sub(g.ab(X), inner)
    T, P = C.TILE, C.TILE / 5.0
    du = g.edge_dist(u, T); dv = g.edge_dist(Y, T)
    d = g.mn(du, dv)
    cell = g.comb(g.floor(g.mul(u, 1 / T)), g.floor(g.mul(Y, 1 / T)), 7.0)
    rv = g.white(cell)
    # dome field: centres at (k+0.5)*0.06
    lu = g.sub(g.fract(g.mul(u, 1 / P)), 0.5); lv = g.sub(g.fract(g.mul(Y, 1 / P)), 0.5)
    r = g.mul(g.vm("LENGTH", g.comb(lu, lv, 0.0)), P)       # metres from dome centre
    dome = g.mr(r, 0.0125, 0.0065, 0.0, 1.0, smooth=True)   # 25 mm base, 13 mm top
    # real dome geometry on this object? -> no bump, AO for gap dirt
    at = g.node("ShaderNodeAttribute", attribute_type="OBJECT", attribute_name="tactile_geo")
    geo = g.clamp(at.outputs["Factor"])
    gap_ao = g.inv(g.ao(0.02, samples=6, only_local=True))
    gap = g.mixf(geo, g.inv(dome), g.mr(gap_ao, 0.05, 0.4))

    base = g.mix(g.mr(rv, 0.0, 1.0), lin(200, 166, 78), lin(190, 160, 90))          # sun-faded, per block
    fade = g.mr(g.noise(g.pos(), 0.35, 2.0), 0.35, 0.7, 0.0, 0.35)
    base = g.mix(fade, base, lin(190, 170, 110))
    top_wear = g.mul(dome, g.mul(g.inv(geo), 0.35))
    base = g.mix(top_wear, base, lin(214, 184, 96))
    dn = g.noise(g.pos(), 9.0, 3.0, 0.6)
    dirt = g.mul(gap, g.mr(dn, 0.3, 0.7, 0.35, 0.85))
    dirt = g.add(dirt, g.mr(g.noise(g.pos(), 0.6, 3.0), 0.45, 0.75, 0.0, 0.35), clamp=True)
    col = g.mix(dirt, base, lin(96, 84, 60))
    joint = g.mr(d, 0.0012, 0.0022, 1.0, 0.0, smooth=True)
    col = g.mix(joint, col, lin(58, 52, 44))
    rough = g.add(g.mad(dirt, 0.2, 0.60), g.mul(top_wear, -0.2))
    rough = g.mixf(joint, rough, 0.85)

    h = g.add(g.mul(dome, 0.0045), g.mul(g.mr(d, 0.001, 0.004), 0.0008))
    h = g.add(h, g.mul(g.noise(g.pos(), 60.0, 2.0), 0.0002))
    nrm = g.bump(h, g.mad(geo, -0.85, 1.0), 1.0)
    g.bsdf(base=col, rough=rough, spec=0.5, normal=nrm)


def _line_white():
    g = G("line_white")
    p = g.pos()
    paint = lin(214, 212, 202)
    under = lin(118, 113, 104)
    wear = g.noise(g.vscale(p, (1.0, 0.35, 1.0)), 5.0, 4.0, 0.62)
    worn = g.mr(wear, 0.60, 0.66, 0.0, 1.0, smooth=True)
    scuff = g.mr(g.noise(g.vscale(p, (2.0, 0.25, 2.0)), 9.0, 3.0, 0.6), 0.55, 0.7, 0.0, 0.5)
    col = g.mix(worn, paint, under)
    col = g.mix(scuff, col, lin(160, 156, 146))
    dirt = g.mr(g.noise(p, 0.8, 3.0), 0.4, 0.75, 0.0, 0.45)
    col = g.mix(dirt, col, lin(120, 114, 102))
    rough = g.mixf(worn, g.add(0.62, g.mul(dirt, 0.15)), 0.78)
    h = g.add(g.mul(g.inv(worn), 0.0004), g.mul(g.noise(p, 90.0, 2.0), 0.00015))
    g.bsdf(base=col, rough=rough, spec=0.45, normal=g.bump(h))


def _coping():
    g = G("coping")
    p = g.pos()
    X, Y, Z = g.sep(p)
    base = lin(170, 166, 156)
    big = g.noise(p, 0.3, 3.0)
    col = g.mix(g.mr(big, 0.35, 0.7, 0.0, 0.25), base, lin(140, 136, 126))
    agg = g.vor(p, 180.0, out="Color")
    col = g.mix(g.mr(g.bw(agg), 0.2, 0.8, 0.0, 0.18), col, lin(110, 106, 98))
    # grime toward the track edge + over the outer arris
    edge_d = g.sub(C.PLAT_X, g.ab(X))
    toedge = g.mr(edge_d, 0.0, 0.18, 1.0, 0.0)
    dn = g.noise(p, 6.0, 3.0, 0.6)
    dirt = g.add(g.mul(toedge, g.mr(dn, 0.3, 0.7, 0.3, 0.8)), g.mr(g.noise(p, 1.0, 3.0), 0.5, 0.8, 0.0, 0.4), clamp=True)
    col = g.mix(dirt, col, lin(80, 76, 68))
    # transverse anti-slip grooves on the top (every 40 mm along y), softened
    gr = g.edge_dist(Y, 0.03)
    groove = g.mul(g.mr(gr, 0.0008, 0.0025, 0.0, 1.0, smooth=True), g.up(0.8, 0.95))
    rough = g.add(0.72, g.mul(dirt, 0.12))
    h = g.add(g.mul(groove, 0.0004), g.mul(g.noise(p, 70.0, 2.0), 0.0004))
    g.bsdf(base=col, rough=rough, spec=0.4, normal=g.bump(h))


# ============================================================================================== 2. concrete
def _concrete_tree(key, base, light, dark, streak_amt=0.6):
    g = G(key)
    p = g.pos()
    big = g.noise(p, 0.15, 3.0, 0.55)
    col = g.mix(g.mr(big, 0.3, 0.7), dark, light)                                     # large tonal stains
    stain = g.mr(g.noise(p, 0.35, 3.0, 0.6, distortion=0.4), 0.5, 0.7, 0.0, 0.7)
    col = g.mix(stain, col, g.hsv(dark, 0.52, 1.1, 0.62))                             # damp / weathered patches
    X, Y, Z = g.sep(p)
    splash = g.mul(g.mr(Z, C.BALLAST_TOP + 1.0, C.BALLAST_TOP + 0.05, 0.0, 0.7, smooth=True), g.vertical())
    splash = g.mul(splash, g.mr(g.noise(g.vscale(p, (3.0, 3.0, 1.5)), 2.0, 3.0), 0.3, 0.6, 0.5, 1.0))
    col = g.mix(splash, col, lin(70, 60, 50))                                         # brake dust / splash zone
    mid = g.noise(p, 0.9, 4.0, 0.6)
    col = g.mix(g.mr(mid, 0.35, 0.65, 0.0, 0.3), col, g.hsv(base, 0.5, 0.95, 0.78))   # mottling
    # vertical water streaks on vertical faces (noise stretched along z), denser under top edges
    st = g.noise(g.vscale(p, (11.0, 11.0, 0.3)), 1.0, 3.0, 0.55)
    st2 = g.mr(g.noise(p, 0.45, 2.0), 0.35, 0.65)
    streak = g.mul(g.mul(g.mr(st, 0.48, 0.72, 0.0, 1.0, smooth=True), st2), g.mul(g.vertical(), streak_amt))
    col = g.mix(streak, col, g.hsv(base, 0.53, 0.8, 0.32))
    # AO-driven grime in corners / under ledges
    occ = g.mr(g.inv(g.ao(0.6, samples=6)), 0.08, 0.5, 0.0, 0.65, smooth=True)
    col = g.mix(occ, col, lin(46, 44, 40))
    # tiny air pores (bug holes) and aggregate speckle
    pores = g.vor(p, 90.0, out="Distance")
    pore = g.mul(g.mr(pores, 0.08, 0.02, 0.0, 1.0), g.mr(g.white(g.floor(g.vscale(p, (90, 90, 90)))), 0.7, 0.72))
    col = g.mix(g.mul(pore, 0.6), col, g.hsv(base, 0.5, 1.0, 0.45))
    fine = g.noise(p, 35.0, 3.0, 0.6)
    col = g.mix(g.mr(fine, 0.3, 0.7, 0.0, 0.16), col, g.hsv(base, 0.5, 0.9, 1.25))
    rough = g.add(0.84, g.mr(fine, 0.0, 1.0, -0.05, 0.06))
    rough = g.sub(rough, g.mul(streak, 0.12))
    h = g.add(g.mul(g.noise(p, 22.0, 3.0, 0.6), 0.0010), g.mul(pore, -0.0015))
    h = g.add(h, g.mul(mid, 0.002))
    g.bsdf(base=col, rough=rough, spec=0.4, normal=g.bump(h))


def _concrete():
    _concrete_tree("concrete", lin(146, 145, 140), lin(172, 171, 166), lin(98, 96, 90))


def _concrete_dark():
    _concrete_tree("concrete_dark", lin(102, 99, 92), lin(118, 114, 106), lin(74, 71, 65), 0.7)


# ============================================================================================== 3. metals
def _paint_tree(key, base, alt, rough0=0.38, dust_amt=0.7, wear_amt=0.6, wear_col=None, dust_col=None):
    g = G(key)
    p = g.pos()
    col = g.mix(g.mr(g.noise(p, 0.4, 2.0), 0.3, 0.7, 0.0, 0.5), base, alt)
    # dust on top faces, broken up
    dmask = g.mul(g.up(0.45, 0.95), g.mr(g.noise(p, 3.0, 3.0, 0.6), 0.3, 0.65, 0.35, 1.0))
    dmask = g.mul(dmask, dust_amt)
    # edge wear (bevel-normal deviation), broken up by noise, subtle
    e = g.edges(0.012)
    ebreak = g.mr(g.noise(p, 14.0, 3.0, 0.6), 0.45, 0.65)
    wear = g.mul(g.mul(e, ebreak), wear_amt)
    # grime: low-frequency + vertical rundown on vertical faces
    run = g.mr(g.noise(g.vscale(p, (8.0, 8.0, 0.5)), 1.0, 3.0), 0.55, 0.78, 0.0, 0.35)
    grime = g.add(g.mul(run, g.vertical()), g.mr(g.noise(p, 0.9, 3.0), 0.5, 0.8, 0.0, 0.25), clamp=True)
    col = g.mix(grime, col, g.hsv(base, 0.5, 0.9, 0.62))
    col = g.mix(wear, col, wear_col or g.hsv(base, 0.5, 0.6, 1.25))
    col = g.mix(dmask, col, dust_col or lin(128, 120, 106))
    rough = g.add(rough0, g.mr(g.noise(p, 2.0, 2.0), 0.0, 1.0, -0.04, 0.05))
    rough = g.mixf(dmask, rough, 0.8)
    rough = g.add(rough, g.mul(grime, 0.15))
    # orange-peel
    h = g.mul(g.noise(p, 120.0, 1.0), 0.00012)
    h = g.add(h, g.mul(wear, -0.0003))
    nb = g.principled(base=col, rough=rough, spec=0.5, normal=g.bump(h), coat=0.0)
    g.shader_out(nb)
    return g


def _steel_paint():
    _paint_tree("steel_paint", lin(170, 170, 164), lin(158, 160, 157), 0.36, 0.75, 0.6,
                wear_col=lin(205, 204, 198))


def _steel_dark():
    _paint_tree("steel_dark", lin(52, 48, 44), lin(44, 41, 38), 0.45, 1.0, 0.5,
                wear_col=lin(96, 90, 82), dust_col=lin(104, 98, 88))


def _galvanized():
    g = G("galvanized")
    p = g.pos()
    sp = g.vor(p, 90.0, out="Color")
    spv = g.bw(sp)
    base = g.mix(g.mr(spv, 0.0, 1.0), lin(158, 160, 162), lin(170, 172, 174))
    ox = g.mr(g.noise(p, 1.6, 4.0, 0.6), 0.52, 0.72, 0.0, 0.8)                  # dull zinc oxide
    col = g.mix(ox, base, lin(170, 170, 166))
    dirt = g.mul(g.up(0.5, 0.95), g.mr(g.noise(p, 4.0, 3.0), 0.35, 0.7, 0.2, 0.9))
    col = g.mix(dirt, col, lin(110, 104, 94))
    rough = g.mixf(ox, g.mr(spv, 0.0, 1.0, 0.30, 0.38), 0.72)
    rough = g.mixf(dirt, rough, 0.85)
    metal = g.sub(1.0, g.mul(g.add(ox, dirt), 0.6), clamp=True)
    g.bsdf(base=col, metal=metal, rough=rough, normal=g.bump(g.mul(spv, 0.00003)))


def _stainless():
    g = G("stainless")
    p = g.pos()
    X, Y, Z = g.sep(p)
    brush = g.noise(g.vscale(g.obj(), (3.0, 3.0, 420.0)), 1.0, 3.0, 0.6)      # horizontal brushing
    smudge = g.mr(g.noise(p, 2.5, 3.0, 0.6), 0.5, 0.72, 0.0, 1.0)
    low = g.mr(Z, 0.0, 0.3, 1.0, 0.0)                                          # kicked / mopped at floor level
    col = g.mix(g.mr(brush, 0.3, 0.7), lin(168, 168, 166), lin(196, 196, 194))
    col = g.mix(g.mul(low, 0.5), col, lin(120, 116, 108))
    rough = g.add(g.mr(brush, 0.3, 0.7, 0.16, 0.26), g.mul(smudge, 0.1))
    rough = g.add(rough, g.mul(low, 0.15))
    g.bsdf(base=col, metal=1.0, rough=rough, aniso=0.45,
           normal=g.bump(g.mul(brush, 0.00004)))


def _roof_deck():
    g = G("roof_deck")
    p = g.pos()
    base = lin(146, 138, 128)
    col = g.mix(g.mr(g.noise(p, 0.25, 2.0), 0.3, 0.7, 0.0, 0.4), base, lin(124, 118, 110))
    soot = g.mr(g.noise(g.vscale(p, (1.0, 0.25, 1.0)), 1.5, 3.0, 0.6), 0.5, 0.75, 0.0, 0.3)
    col = g.mix(soot, col, lin(72, 68, 62))
    occ = g.mr(g.inv(g.ao(0.25, samples=6)), 0.1, 0.6, 0.0, 0.7, smooth=True)
    col = g.mix(occ, col, lin(44, 40, 36))
    leak = g.mul(g.mr(g.noise(p, 0.6, 2.0), 0.62, 0.72), 0.5)                  # rusty leak marks at joints
    col = g.mix(leak, col, lin(110, 84, 60))
    rough = g.add(0.5, g.mul(g.add(soot, occ), 0.2))
    g.bsdf(base=col, rough=rough, metal=0.15, spec=0.5)


def _stripe_warning():
    g = G("stripe_warning")
    U, V, _ = g.sep(g.uv())
    w = 0.12
    s = g.mul(g.add(U, V), 1.0 / SQ2)
    f = g.fract(g.mul(s, 1.0 / (2 * w)))
    # anti-aliased bands with a soft paint edge
    band = g.mul(g.mr(f, 0.49, 0.51, 0.0, 1.0, smooth=True), g.mr(f, 0.99, 0.97, 0.0, 1.0, smooth=True))
    band = g.add(band, g.mr(f, 0.01, 0.0, 0.0, 1.0), clamp=True)
    red = lin(196, 44, 38); white = lin(226, 222, 212)
    col = g.mix(band, white, red)
    p = g.pos()
    fadev = g.mr(g.noise(p, 3.0, 3.0), 0.3, 0.7, 0.0, 0.25)
    col = g.mix(fadev, col, lin(180, 150, 140))
    e = g.mul(g.edges(0.01), g.mr(g.noise(p, 16.0, 3.0), 0.45, 0.62, 0.0, 0.7))
    col = g.mix(e, col, lin(150, 150, 146))
    dust = g.mul(g.up(0.5, 0.95), 0.6)
    col = g.mix(dust, col, lin(150, 140, 124))
    grime = g.mr(g.noise(g.vscale(p, (8.0, 8.0, 0.6)), 1.0, 3.0), 0.55, 0.78, 0.0, 0.3)
    col = g.mix(grime, col, lin(90, 80, 72))
    rough = g.add(0.38, g.mul(g.add(e, grime), 0.2))
    g.bsdf(base=col, rough=rough, spec=0.5, normal=g.bump(g.mul(band, 0.00015)))


# ============================================================================================== 4. track
def _rail_from_track(g, X):
    """Distance from the nearest rail centre line (both tracks), metres."""
    tx = g.ab(g.sub(g.ab(X), C.TRACK_X))
    return g.ab(g.sub(tx, C.GAUGE / 2 + 0.035))


def _rail_steel():
    g = G("rail_steel")
    p = g.pos()
    X, Y, Z = g.sep(p)
    nz = g.sep(g.nrm())[2]
    top = g.mul(g.mr(nz, 0.86, 0.97, 0.0, 1.0, smooth=True), g.mr(Z, C.RAIL_TOP - 0.03, C.RAIL_TOP - 0.008))
    # running band narrower than the crown: centre of the head is brightest
    streak = g.noise(g.vscale(p, (260.0, 0.6, 260.0)), 1.0, 3.0, 0.6)
    shiny = g.mix(g.mr(streak, 0.3, 0.7), lin(176, 172, 168), lin(214, 210, 204))
    rust_n = g.noise(p, 9.0, 4.0, 0.62)
    rust = g.mix(g.mr(rust_n, 0.3, 0.7), lin(86, 46, 26), lin(120, 70, 40))
    rust = g.mix(g.mr(g.noise(p, 2.0, 2.0), 0.4, 0.7, 0.0, 0.6), rust, lin(60, 44, 34))   # dark scale
    low = g.mr(Z, C.RAIL_TOP - 0.17, C.RAIL_TOP - 0.08, 0.7, 0.0)                         # grime at the foot
    rust = g.mix(low, rust, lin(48, 38, 30))
    col = g.mix(top, rust, shiny)
    rough = g.mixf(top, g.mr(rust_n, 0.0, 1.0, 0.68, 0.9), g.mr(streak, 0.0, 1.0, 0.1, 0.2))
    metal = g.mixf(top, 0.15, 1.0)
    h = g.mul(g.mul(rust_n, g.inv(top)), 0.0006)
    g.bsdf(base=col, metal=metal, rough=rough, normal=g.bump(h))


def _sleeper():
    g = G("sleeper")
    p = g.pos()
    X, Y, Z = g.sep(p)
    base = lin(140, 137, 128)
    col = g.mix(g.mr(g.noise(p, 1.5, 3.0), 0.3, 0.7, 0.0, 0.5), base, lin(112, 108, 100))
    rail_d = _rail_from_track(g, X)
    rustz = g.mul(g.mr(rail_d, 0.22, 0.04), g.mr(g.noise(p, 8.0, 3.0), 0.3, 0.7, 0.4, 1.0))
    col = g.mix(rustz, col, lin(100, 60, 34))
    dust = g.mul(g.up(0.5, 0.95), g.mr(g.noise(p, 5.0, 3.0), 0.3, 0.7, 0.2, 0.7))
    col = g.mix(dust, col, lin(96, 80, 64))
    occ = g.mr(g.inv(g.ao(0.12, samples=6)), 0.1, 0.6, 0.0, 0.7)
    col = g.mix(occ, col, lin(40, 36, 32))
    pore = g.mr(g.vor(p, 120.0), 0.0, 0.15, 1.0, 0.0)
    rough = 0.86
    h = g.add(g.mul(g.noise(p, 25.0, 3.0), 0.001), g.mul(pore, -0.0006))
    g.bsdf(base=col, rough=rough, spec=0.35, normal=g.bump(h))


def _ballast():
    g = G("ballast")
    p = g.pos()
    X, Y, Z = g.sep(p)
    S = 24.0                                                     # ~40 mm crushed stone
    cid = g.vor(p, S, out="Color")
    dist = g.vor(p, S, out="Distance")
    dte = g.vor(p, S, out="Distance", feature="DISTANCE_TO_EDGE")
    r = g.bw(cid)
    rr = g.sep(cid)[1]
    stone = g.ramp(r, [(0.0, lin(78, 76, 72)), (0.3, lin(112, 108, 102)), (0.55, lin(136, 132, 124)),
                       (0.75, lin(122, 108, 94)), (0.9, lin(96, 94, 92)), (1.0, lin(156, 152, 144))])
    facet = g.noise(p, 90.0, 2.0, 0.5)                                                      # fractured faces
    stone = g.mix(g.mr(facet, 0.3, 0.7, 0.0, 0.25), stone, lin(80, 76, 72))
    # iron-oxide brake dust near / between the rails
    rail_d = _rail_from_track(g, X)
    inside = g.mr(g.ab(g.sub(g.ab(X), C.TRACK_X)), 0.9, 0.5)
    rust = g.add(g.mul(g.mr(rail_d, 0.3, 0.0), 0.5), g.mul(inside, 0.2), clamp=True)
    rust = g.mul(rust, g.mr(g.noise(p, 1.5, 2.0), 0.25, 0.7, 0.5, 1.0))
    stone = g.mix(rust, stone, g.cmul(stone, lin(190, 140, 105)))
    gap = g.mr(dte, 0.0, 0.05, 1.0, 0.0, smooth=True)                                       # dark voids between stones
    occ = g.mr(g.inv(g.ao(0.08, samples=6)), 0.1, 0.6, 0.0, 0.6)
    dark = g.add(g.mul(gap, 0.75), occ, clamp=True)
    col = g.mix(dark, stone, lin(30, 28, 26))
    rough = g.mad(rr, 0.1, 0.78)
    dome = g.mr(dte, 0.0, 0.2, 0.0, 1.0)
    h = g.mul(g.math("SQRT", g.mul(dome, g.sub(2.0, dome))), 0.016)                         # rounded stone profile
    h = g.add(h, g.mul(g.mr(r, 0.0, 1.0, -0.004, 0.004), dome))                             # stones at different heights
    h = g.add(h, g.mul(facet, 0.0012))
    # each stone gets its own random facet tilt -> faces catch the low sun differently
    cpos = g.vor(p, S, out="Position")
    tilt = g.vm("DOT_PRODUCT", g.vm("SUBTRACT", cid, (0.5, 0.5, 0.5)), g.vm("SUBTRACT", p, cpos))
    h = g.add(h, g.mul(g.mul(tilt, dome), 0.7))
    g.bsdf(base=col, rough=rough, spec=0.35, normal=g.bump(h, 1.0))


# ============================================================================================== 5. lights + glass + small
def _light_tube():
    g = G("light_tube")
    X, Y, Z = g.sep(g.pos())
    strength = g.value("TubeStrength", 18.0)
    cell = g.comb(g.floor(g.mul(Y, 1 / 1.25)), g.floor(g.mul(X, 1 / 0.6)), 3.0)
    rv = g.white(cell)
    # per-tube variation: slight warm/cool and brightness spread, ~3 % noticeably dimmer (ageing tubes)
    tint = g.mix(g.mr(rv, 0.0, 1.0), (0.88, 0.94, 1.0), (0.96, 0.97, 1.0))
    s = g.mul(strength, g.add(g.mr(rv, 0.0, 1.0, 0.9, 1.05), g.mul(g.mr(rv, 0.97, 0.98), -0.35)))
    g.bsdf(base=(0.85, 0.87, 0.9), rough=0.25, emc=tint, ems=s)


def _light_housing():
    _paint_tree("light_housing", lin(206, 206, 200), lin(196, 194, 184), 0.34, 0.6, 0.3,
                wear_col=lin(150, 146, 136), dust_col=lin(150, 140, 120))


def _glass():
    g = G("glass")
    p = g.pos()
    dirt = g.mr(g.noise(p, 1.8, 4.0, 0.6), 0.5, 0.78, 0.0, 1.0)
    streak = g.mr(g.noise(g.vscale(p, (14.0, 14.0, 0.5)), 1.0, 3.0), 0.62, 0.82, 0.0, 0.5)
    X, Y, Z = g.sep(p)
    low = g.mr(Z, 0.0, 0.5, 0.5, 0.0)                                  # splash dirt near the floor
    d = g.add(g.add(g.mul(dirt, 0.35), g.mul(streak, 0.6)), low, clamp=True)
    col = g.mix(d, (0.94, 0.97, 0.96), (0.80, 0.78, 0.72))
    rough = g.mad(d, 0.12, 0.015)
    glass = g.principled(base=col, rough=rough, trans=1.0, ior=1.5, spec=0.5, thin=True)
    tr = g.node("ShaderNodeBsdfTransparent")
    g.put(tr.inputs["Color"], g.mix(d, (0.86, 0.9, 0.89), (0.7, 0.68, 0.64)))
    lp = g.node("ShaderNodeLightPath")
    ms = g.node("ShaderNodeMixShader")
    g.l.new(lp.outputs["Is Shadow Ray"], ms.inputs[0])
    g.l.new(glass.outputs[0], ms.inputs[1]); g.l.new(tr.outputs[0], ms.inputs[2])
    g.shader_out(ms)
    g.m.diffuse_color = (0.7, 0.8, 0.82, 0.3)


def _wire():
    g = G("wire")
    col = g.mix(g.mr(g.noise(g.pos(), 3.0, 2.0), 0.3, 0.7), lin(26, 24, 22), lin(40, 34, 28))
    g.bsdf(base=col, rough=0.42, metal=0.35, spec=0.5)


def _plastic_black():
    g = G("plastic_black")
    p = g.pos()
    dust = g.mul(g.up(0.5, 0.95), g.mr(g.noise(p, 4.0, 3.0), 0.3, 0.7, 0.15, 0.6))
    col = g.mix(dust, lin(18, 18, 19), lin(90, 86, 78))
    rough = g.add(g.mr(g.noise(p, 6.0, 2.0), 0.0, 1.0, 0.32, 0.42), g.mul(dust, 0.4))
    g.bsdf(base=col, rough=rough, spec=0.5, normal=g.bump(g.mul(g.noise(p, 160.0, 1.0), 0.00008)))


# ============================================================================================== 6. city + foliage
def _asphalt():
    g = G("asphalt")
    p = g.pos()
    base = g.mix(g.mr(g.noise(p, 0.15, 3.0), 0.3, 0.7), lin(46, 46, 46), lin(64, 63, 61))
    agg = g.white(g.floor(g.vscale(p, (250.0, 250.0, 250.0))))
    col = g.mix(g.mr(agg, 0.85, 0.95, 0.0, 0.6), base, lin(120, 118, 112))
    patch = g.mr(g.noise(p, 0.25, 2.0), 0.62, 0.66, 0.0, 0.5)
    col = g.mix(patch, col, lin(30, 30, 31))
    rough = g.add(0.88, g.mul(patch, -0.1))
    g.bsdf(base=col, rough=rough, spec=0.35, normal=g.bump(g.mul(g.noise(p, 120.0, 2.0), 0.0015)))


def _foliage():
    g = G("foliage")
    p = g.pos()
    orr = g.orand()
    leaf_id = g.vor(p, 38.0, out="Color")
    lr = g.bw(leaf_id)
    clump = g.noise(p, 1.4, 3.0, 0.6)
    tone = g.add(g.mul(orr, 0.5), g.mul(g.mr(clump, 0.3, 0.7), 0.5))
    col = g.ramp(tone, [(0.0, lin(70, 92, 56)), (0.35, lin(86, 108, 62)), (0.7, lin(104, 122, 72)),
                        (1.0, lin(118, 134, 80))])
    col = g.mix(g.mr(lr, 0.0, 1.0, 0.0, 0.35), col, lin(128, 148, 86))
    col = g.mix(g.mr(lr, 0.85, 0.88, 0.0, 0.8), col, lin(118, 110, 62))   # warm sun-tipped new growth
    col = g.mix(g.mr(lr, 0.92, 0.97, 0.0, 0.6), col, lin(104, 82, 44))    # a few dry leaves
    # short-range AO only: a dense leaf cloud is almost fully occluded at larger radii and goes black
    occ = g.mr(g.inv(g.ao(0.12, samples=6)), 0.1, 0.7, 0.0, 0.2)
    col = g.mix(occ, col, lin(30, 40, 20))
    dist = g.vor(p, 38.0)
    h = g.add(g.mul(g.mr(dist, 0.0, 0.5, 1.0, 0.0), 0.006), g.mul(clump, 0.03))
    surf = g.principled(base=col, rough=g.mr(lr, 0.0, 1.0, 0.5, 0.75), spec=0.4, normal=g.bump(h, 0.7))
    tr = g.node("ShaderNodeBsdfTranslucent")
    g.put(tr.inputs["Color"], g.cmul(col, (1.5, 1.7, 0.9)))
    ms = g.node("ShaderNodeMixShader")
    ms.inputs[0].default_value = 0.38
    g.l.new(surf.outputs[0], ms.inputs[1]); g.l.new(tr.outputs[0], ms.inputs[2])
    g.shader_out(ms)


def _building(key, stops, rough0, mortar=None, brick=None, metal=0.0):
    g = G(key)
    p = g.pos()
    orr = g.orand()
    col = g.ramp(g.fract(g.mul(orr, 7.31)), stops)
    col = g.mix(g.mr(g.noise(p, 0.15, 3.0), 0.3, 0.7, 0.0, 0.25), col, g.hsv(col, 0.5, 0.9, 0.75))
    if brick:
        bt = g.node("ShaderNodeTexBrick", offset=0.5, offset_frequency=2)
        g.put(bt.inputs["Vector"], g.uv())
        bt.inputs["Scale"].default_value = 1.0
        bt.inputs["Brick Width"].default_value = brick[0]
        bt.inputs["Row Height"].default_value = brick[1]
        bt.inputs["Mortar Size"].default_value = 0.006
        bt.inputs["Mortar Smooth"].default_value = 0.2
        g.put(bt.inputs["Color1"], (1.0, 1.0, 1.0)); g.put(bt.inputs["Color2"], (0.86, 0.86, 0.86))
        g.put(bt.inputs["Mortar"], mortar or (1.3, 1.3, 1.3))
        col = g.cmul(col, bt.outputs["Color"])
    run = g.mr(g.noise(g.vscale(p, (6.0, 6.0, 0.4)), 1.0, 3.0), 0.55, 0.8, 0.0, 0.45)
    col = g.mix(g.mul(run, g.vertical()), col, g.hsv(col, 0.5, 0.8, 0.4))
    occ = g.mr(g.inv(g.ao(1.0, samples=4)), 0.15, 0.6, 0.0, 0.5)
    col = g.mix(occ, col, lin(40, 38, 36))
    rough = g.add(rough0, g.mul(run, 0.06))
    g.bsdf(base=col, rough=rough, metal=metal, spec=0.45)


def _building_plaster():
    _building("building_plaster",
              [(0.0, lin(178, 172, 160)), (0.25, lin(190, 184, 172)), (0.45, lin(170, 160, 144)),
               (0.62, lin(156, 154, 148)), (0.8, lin(184, 170, 156)), (1.0, lin(146, 138, 122))], 0.85)


def _building_tile():
    _building("building_tile",
              [(0.0, lin(150, 120, 96)), (0.3, lin(176, 156, 130)), (0.55, lin(132, 112, 98)),
               (0.8, lin(190, 178, 160)), (1.0, lin(120, 96, 80))], 0.6, brick=(0.227, 0.066))


def _building_dark():
    _building("building_dark",
              [(0.0, lin(60, 62, 66)), (0.4, lin(78, 78, 80)), (0.7, lin(52, 54, 52)), (1.0, lin(92, 90, 86))],
              0.5, metal=0.3)


def _window_city():
    g = G("window_city")
    o = g.obj()
    orr = g.orand()
    lit_k = g.value("WindowLit", 1.4)
    ratio = g.value("WindowRatio", 0.12)
    PW, PH = 1.8, 3.0
    X, Y, Z = g.sep(o)
    cx = g.floor(g.mul(X, 1 / PW)); cy = g.floor(g.mul(Y, 1 / PW)); cz = g.floor(g.mul(Z, 1 / PH))
    cell = g.comb(g.add(cx, g.mul(orr, 917.0)), g.add(cy, g.mul(orr, 311.0)), cz)
    rc = g.white(cell, out="Color")
    r1, r2, r3 = g.sep(rc)
    lit = g.math("LESS_THAN", r1, ratio)
    # pane / mullion layout inside the cell (horizontal coordinate = whichever of x/y runs along the face)
    nx, ny, nz = g.sep(g.nrm())
    hcoord = g.mixf(g.math("GREATER_THAN", g.ab(nx), g.ab(ny)), X, Y)
    fh = g.fract(g.mul(hcoord, 1 / PW)); fz = g.fract(g.mul(Z, 1 / PH))
    pane = g.mul(g.mul(g.mr(fh, 0.06, 0.09), g.mr(fh, 0.94, 0.91)), g.mul(g.mr(fz, 0.10, 0.13), g.mr(fz, 0.86, 0.83)))
    mull = g.mul(g.mr(g.ab(g.sub(fh, 0.5)), 0.008, 0.016), 1.0)
    pane = g.mul(pane, mull)
    # interior light: warm or cool, curtains dim some, a gradient from the ceiling
    warm = g.math("LESS_THAN", r2, 0.75)
    lcol = g.mix(warm, (0.62, 0.74, 0.86), (1.0, 0.52, 0.2))
    grad = g.mr(fz, 0.1, 0.85, 0.55, 1.0)
    curtain = g.mr(r3, 0.0, 1.0, 0.25, 1.0)
    em = g.mul(g.mul(g.mul(lit, pane), lit_k), g.mul(grad, curtain))
    # unlit glass: dark, reflective; frame: dark grey
    glass_col = g.mix(g.mr(r3, 0.0, 1.0), lin(14, 16, 20), lin(30, 34, 40))
    frame_col = g.mix(g.mr(orr, 0.0, 1.0), lin(70, 70, 72), lin(130, 128, 122))
    col = g.mix(pane, frame_col, glass_col)
    col = g.mix(g.mul(lit, pane), col, g.cmul(lcol, (0.5, 0.5, 0.5)))
    rough = g.mixf(pane, 0.6, 0.06)
    g.bsdf(base=col, rough=rough, spec=0.6, emc=lcol, ems=em)


def _roof_tile():
    g = G("roof_tile")
    p = g.pos()
    X, Y, Z = g.sep(p)
    nx, ny, nz = g.sep(g.nrm())
    orr = g.orand()
    # down-slope direction = the horizontal axis the normal leans along
    slope_x = g.math("GREATER_THAN", g.ab(nx), g.ab(ny))
    across = g.mixf(slope_x, X, Y)        # coordinate across the slope (tile columns repeat along it)
    down = g.mixf(slope_x, Y, X)          # coordinate down the slope (courses repeat along it)
    fa = g.fract(g.mul(across, 1 / 0.30))
    ridge = g.math("SINE", g.mul(fa, math.pi))
    course = g.fract(g.mul(down, 1 / 0.24))
    h = g.add(g.mul(ridge, 0.03), g.mul(course, 0.012))
    col = g.ramp(g.fract(g.mul(orr, 5.17)),
                 [(0.0, lin(70, 72, 76)), (0.4, lin(88, 90, 92)), (0.65, lin(58, 60, 64)),
                  (0.82, lin(96, 76, 62)), (1.0, lin(60, 66, 76))], interp="CONSTANT")
    tid = g.white(g.comb(g.floor(g.mul(across, 1 / 0.30)), g.floor(g.mul(down, 1 / 0.24)), 0.0))
    col = g.mix(g.mr(tid, 0.0, 1.0, 0.0, 0.25), col, g.hsv(col, 0.5, 0.9, 1.25))
    lichen = g.mr(g.noise(p, 0.8, 3.0), 0.55, 0.75, 0.0, 0.35)
    col = g.mix(lichen, col, lin(76, 74, 60))
    gap = g.mr(course, 0.9, 1.0, 0.0, 0.6)
    col = g.mix(gap, col, lin(20, 22, 24))
    rough = g.add(g.mr(tid, 0.0, 1.0, 0.3, 0.45), g.mul(lichen, 0.3))
    g.bsdf(base=col, rough=g.add(rough, 0.1), metal=0.08, spec=0.5, normal=g.bump(h, 0.6))


def _terrain():
    g = G("terrain")
    p = g.pos()
    n1 = g.noise(p, 0.05, 4.0, 0.6)
    n2 = g.noise(p, 0.6, 3.0, 0.6)
    col = g.ramp(g.add(g.mul(n1, 0.6), g.mul(n2, 0.4)),
                 [(0.25, lin(48, 58, 30)), (0.45, lin(70, 74, 40)), (0.6, lin(92, 82, 54)),
                  (0.75, lin(84, 70, 50)), (0.9, lin(110, 100, 74))])
    col = g.mix(g.mr(g.noise(p, 8.0, 2.0), 0.3, 0.7, 0.0, 0.3), col, lin(30, 36, 20))
    g.bsdf(base=col, rough=0.94, spec=0.3, normal=g.bump(g.mul(n2, 0.05), 0.5))


# ============================================================================================== steps
def _run(*fns):
    def f():
        for fn in fns:
            fn()
    return f


FAMILIES = [
    ("floor, tactile and lines", (_tile_floor, _tactile_yellow, _line_white, _coping)),
    ("concrete", (_concrete, _concrete_dark)),
    ("metals and paint", (_steel_paint, _steel_dark, _galvanized, _stainless, _roof_deck, _stripe_warning)),
    ("track", (_rail_steel, _sleeper, _ballast)),
    ("lights, glass, cables", (_light_tube, _light_housing, _glass, _wire, _plastic_black)),
    ("city and foliage", (_asphalt, _foliage, _building_plaster, _building_tile, _building_dark, _window_city,
                          _roof_tile, _terrain)),
]

COVERED = {fn.__name__[1:] for _, fns in FAMILIES for fn in fns}


def _leftovers():
    """Any MATS key added to common.py later still gets a sane (flat) material."""
    for key in C.MATS:
        if key not in COVERED:
            g = G(key)
            g.bsdf(base=C.MATS[key], rough=0.6)


STEPS = [(label, _run(*fns)) for label, fns in FAMILIES[:-1]]
STEPS.append((FAMILIES[-1][0], _run(*FAMILIES[-1][1], _leftovers)))
