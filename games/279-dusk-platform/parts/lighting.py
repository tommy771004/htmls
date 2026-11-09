"""Lighting, atmosphere, render settings, compositor and the final camera move.

Runs after the geometry modules and materials. Tunables are at the top.
"""
import bpy, math
import common as C

# Runtime overrides of shared layout constants (common.py belongs to the orchestrator; fold these into C.CAM /
# C.SUN there and set them to None here). They are written into the C dicts by every step, so the camera that
# tools/preview.py re-creates after all modules, sky rotation, sun lamp and haze all agree.
#  * camera: the reference frames column 1 from ~8-11 m, not 15 m, so the dolly runs y=+0.5 -> +3.5
#    (column 1 at y=12: 11.5 m -> 8.5 m). y1 is capped by the direction signs (signs.DIR_Y=10, top z=3.60): at
#    y=3.5 their top sits ~18 deg above the lens axis, inside the 28 mm frame (y=5 crops them).
#  * sun: the reference lights the camera-facing (-Y) faces of the column, right wall and houses with no sun in
#    frame, so the sun sits behind-left (azimuth -115 deg), not left-front (-52 deg as in BRIEF.md).
#    city.py's far-ridge dip still follows the old -52 deg (built earlier); the sun is out of frame, so harmless.
CAM_OVERRIDE = None   # folded into common.CAM
SUN_AZIMUTH = None    # folded into common.SUN

SKY = dict(strength_light=0.50, strength_cam=0.085, altitude=60.0, air=1.0, aerosol=1.5, ozone=1.0, sun_intensity=0.25,   # sun_intensity only matters with disc=True
           disc=False, cam_sat=0.75, cam_tint=(0.90, 0.97, 1.16))   # camera-ray backdrop only: blue-grey dusk sky (WB 7800 warms it back)
SUN_LAMP = dict(energy=5.0, color=(1.0, 0.57, 0.33), angle_deg=1.2)
TUBE_STRENGTH = None          # None keeps the materials.py value
# The inverted-Fuji housings hide the tubes from the roof deck, so the deck only gets a weak floor bounce and reads
# black. Stand-in for the bounce off the lit floor: one upward-facing area light per canopy span, invisible to camera.
BOUNCE = dict(power=3000.0, z=0.6, color=(1.0, 0.92, 0.82), spans=((-24.0, 60.0), (60.0, 162.0)))
HAZE = dict(dist=1000.0, max=0.8, cool=(0.42, 0.42, 0.48), warm=(1.0, 0.58, 0.34), power=1.0, sharp=5.0,
            collections=("City",))
EXPOSURE = -1.0
WB_TEMP = 7800.0      # >6500 warms the frame (golden hour grade)
LOOK = ("AgX - Medium High Contrast", "AgX - Base Contrast", "Medium High Contrast", "None")
SAMPLES = 96
NOISE_T = 0.03


def _overrides():
    if CAM_OVERRIDE:
        C.CAM.update(CAM_OVERRIDE)
    if SUN_AZIMUTH is not None:
        C.SUN["azimuth_deg"] = SUN_AZIMUTH


def _world():
    _overrides()
    sc = bpy.context.scene
    w = bpy.data.worlds.get("DuskWorld") or bpy.data.worlds.new("DuskWorld")
    sc.world = w
    nt = w.node_tree
    nt.nodes.clear()
    sky = nt.nodes.new("ShaderNodeTexSky"); sky.location = (-600, 0)
    sky.sky_type = "MULTIPLE_SCATTERING"
    sky.sun_elevation = math.radians(C.SUN["elevation_deg"])
    sky.sun_rotation = C.sky_sun_rotation()
    # no disc: with it on, the sky's own sun lit the scene about as strongly as the lamp (sunlit walls barely
    # changed with SUN_LAMP energy), so the lamp alone is the direct sun and the sky is fill + backdrop.
    sky.sun_disc = SKY["disc"]
    sky.sun_size = math.radians(0.9)
    sky.sun_intensity = SKY["sun_intensity"]
    sky.altitude = SKY["altitude"]
    sky.air_density = SKY["air"]; sky.aerosol_density = SKY["aerosol"]; sky.ozone_density = SKY["ozone"]
    # camera rays see a brighter sky than the lighting uses (the sky is the backdrop of the shot)
    lp = nt.nodes.new("ShaderNodeLightPath"); lp.location = (-600, 300)
    bl = nt.nodes.new("ShaderNodeBackground"); bl.location = (-200, -100)
    bc = nt.nodes.new("ShaderNodeBackground"); bc.location = (-200, 100)
    bl.inputs["Strength"].default_value = SKY["strength_light"]
    bc.inputs["Strength"].default_value = SKY["strength_cam"]
    mix = nt.nodes.new("ShaderNodeMixShader"); mix.location = (100, 0)
    out = nt.nodes.new("ShaderNodeOutputWorld"); out.location = (300, 0)
    L = nt.links
    hs = nt.nodes.new("ShaderNodeHueSaturation"); hs.location = (-400, 200)
    hs.inputs["Saturation"].default_value = SKY["cam_sat"]
    tn = nt.nodes.new("ShaderNodeMix"); tn.location = (-250, 250); tn.data_type = "RGBA"; tn.blend_type = "MULTIPLY"
    tn.inputs["Factor"].default_value = 1.0; tn.inputs["B"].default_value = (*SKY["cam_tint"], 1)
    L.new(sky.outputs["Color"], bl.inputs["Color"]); L.new(sky.outputs["Color"], hs.inputs["Color"])
    L.new(hs.outputs["Color"], tn.inputs["A"]); L.new(tn.outputs["Result"], bc.inputs["Color"])
    L.new(lp.outputs["Is Camera Ray"], mix.inputs["Fac"])
    L.new(bl.outputs["Background"], mix.inputs[1]); L.new(bc.outputs["Background"], mix.inputs[2])
    L.new(mix.outputs["Shader"], out.inputs["Surface"])
    if hasattr(w.cycles, "sample_map_resolution"):
        w.cycles.sample_map_resolution = 2048


def _sun():
    _overrides()
    sc = bpy.context.scene
    ob = bpy.data.objects.get("Sun")
    if ob is None:
        ld = bpy.data.lights.new("Sun", "SUN")
        ob = bpy.data.objects.new("Sun", ld)
        C.coll("Lights").objects.link(ob)
    ld = ob.data
    ld.energy = SUN_LAMP["energy"]; ld.color = SUN_LAMP["color"]; ld.angle = math.radians(SUN_LAMP["angle_deg"])
    ob.rotation_euler = C.sun_vector().to_track_quat("Z", "Y").to_euler()
    for i, (ya, yb) in enumerate(BOUNCE["spans"]):
        nm = "CanopyBounce%d" % i
        ob = bpy.data.objects.get(nm)
        if ob is None:
            ld = bpy.data.lights.new(nm, "AREA")
            ob = bpy.data.objects.new(nm, ld)
            C.coll("Lights").objects.link(ob)
        ld = ob.data
        ld.shape = "RECTANGLE"; ld.size = 2 * C.PLAT_X
        ld.size_y = yb - ya
        ld.energy = BOUNCE["power"] * (yb - ya) / 186.0; ld.color = BOUNCE["color"]
        ob.location = (0.0, (ya + yb) / 2, BOUNCE["z"])
        ob.rotation_euler = (math.pi, 0, 0)          # area lights emit along local -Z: flip to face up
        ob.visible_camera = False
    if TUBE_STRENGTH is not None:
        m = bpy.data.materials.get("light_tube")
        nd = m.node_tree.nodes.get("TubeStrength") if m else None    # Value node that drives the emission chain
        if nd:
            nd.outputs[0].default_value = TUBE_STRENGTH


def _haze():
    """Aerial perspective on far geometry: mix every City material toward a direction-dependent haze colour
    by camera distance (cheap stand-in for a volume)."""
    mats = set()
    for cname in HAZE["collections"]:
        c = bpy.data.collections.get(cname)
        if not c:
            continue
        for o in c.all_objects:
            for s in getattr(o, "material_slots", []):
                if s.material:
                    mats.add(s.material)
    _overrides()
    sv = C.sun_vector()
    for m in mats:
        nt = m.node_tree
        old = [n for n in nt.nodes if n.get("haze")]
        out = next((n for n in nt.nodes if n.bl_idname == "ShaderNodeOutputMaterial" and n.is_active_output), None) \
            or next((n for n in nt.nodes if n.bl_idname == "ShaderNodeOutputMaterial"), None)
        if out is None:
            continue
        if old:      # re-run: unwrap
            mixs = [n for n in old if n.bl_idname == "ShaderNodeMixShader"]
            if mixs and mixs[0].inputs[1].is_linked:
                src = mixs[0].inputs[1].links[0].from_socket
                nt.links.new(src, out.inputs["Surface"])
            for n in old:
                nt.nodes.remove(n)
        if not out.inputs["Surface"].is_linked:
            continue
        src = out.inputs["Surface"].links[0].from_socket
        N = []
        def node(t, x, y):
            n = nt.nodes.new(t); n.location = (out.location.x + x, out.location.y + y); n["haze"] = 1; N.append(n); return n
        cam = node("ShaderNodeCameraData", -900, -300)
        geo = node("ShaderNodeNewGeometry", -900, -500)
        # fac = max * (1 - exp(-d / dist)) ^ power
        m1 = node("ShaderNodeMath", -700, -300); m1.operation = "DIVIDE"; m1.inputs[1].default_value = HAZE["dist"]
        m2 = node("ShaderNodeMath", -560, -300); m2.operation = "MULTIPLY"; m2.inputs[1].default_value = -1
        m3 = node("ShaderNodeMath", -420, -300); m3.operation = "EXPONENT"
        m4 = node("ShaderNodeMath", -280, -300); m4.operation = "SUBTRACT"; m4.inputs[0].default_value = 1
        m5 = node("ShaderNodeMath", -140, -300); m5.operation = "POWER"; m5.inputs[1].default_value = HAZE["power"]
        m6 = node("ShaderNodeMath", 0, -300); m6.operation = "MULTIPLY"; m6.inputs[1].default_value = HAZE["max"]
        L = nt.links
        L.new(cam.outputs["View Distance"], m1.inputs[0]); L.new(m1.outputs[0], m2.inputs[0]); L.new(m2.outputs[0], m3.inputs[0])
        L.new(m3.outputs[0], m4.inputs[1]); L.new(m4.outputs[0], m5.inputs[0]); L.new(m5.outputs[0], m6.inputs[0])
        # colour: warm toward the sun, cool away from it: t = max(0, dot(-incoming, sun))^sharp
        dot = node("ShaderNodeVectorMath", -700, -520); dot.operation = "DOT_PRODUCT"
        dot.inputs[1].default_value = (-sv.x, -sv.y, -sv.z)          # dot(incoming, -sun) == dot(-incoming, sun)
        mx = node("ShaderNodeMath", -560, -520); mx.operation = "MAXIMUM"; mx.inputs[1].default_value = 0
        pw = node("ShaderNodeMath", -420, -520); pw.operation = "POWER"; pw.inputs[1].default_value = HAZE["sharp"]
        L.new(geo.outputs["Incoming"], dot.inputs[0]); L.new(dot.outputs["Value"], mx.inputs[0]); L.new(mx.outputs[0], pw.inputs[0])
        col = node("ShaderNodeMix", -260, -520); col.data_type = "RGBA"
        col.inputs["A"].default_value = (*HAZE["cool"], 1); col.inputs["B"].default_value = (*HAZE["warm"], 1)
        L.new(pw.outputs[0], col.inputs["Factor"])
        em = node("ShaderNodeEmission", -100, -520)
        L.new(col.outputs["Result"], em.inputs["Color"])
        mix = node("ShaderNodeMixShader", 150, -200)
        L.new(m6.outputs[0], mix.inputs["Fac"]); L.new(src, mix.inputs[1]); L.new(em.outputs["Emission"], mix.inputs[2])
        L.new(mix.outputs["Shader"], out.inputs["Surface"])


def _render():
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    p = bpy.context.preferences.addons["cycles"].preferences
    p.compute_device_type = "METAL"; p.refresh_devices()
    for d in p.devices:
        d.use = d.type == "METAL"
    cy = sc.cycles
    cy.device = "GPU"
    cy.samples = SAMPLES; cy.use_adaptive_sampling = True; cy.adaptive_threshold = NOISE_T; cy.adaptive_min_samples = 24
    cy.use_denoising = True; cy.denoiser = "OPENIMAGEDENOISE"
    cy.denoising_input_passes = "RGB_ALBEDO_NORMAL"; cy.denoising_prefilter = "ACCURATE"
    try:
        cy.denoising_quality = "HIGH"; cy.denoising_use_gpu = True
    except Exception:
        pass
    cy.preview_samples = 48; cy.use_preview_denoising = True
    cy.use_light_tree = True
    cy.max_bounces = 8; cy.diffuse_bounces = 3; cy.glossy_bounces = 3; cy.transmission_bounces = 6
    cy.transparent_max_bounces = 8; cy.volume_bounces = 0
    cy.sample_clamp_direct = 0; cy.sample_clamp_indirect = 6
    cy.caustics_reflective = False; cy.caustics_refractive = False
    cy.film_exposure = 1.0
    sc.render.use_persistent_data = True
    sc.render.film_transparent = False
    sc.render.resolution_x, sc.render.resolution_y = C.RES
    sc.render.resolution_percentage = 100
    vs = sc.view_settings
    vs.view_transform = "AgX"
    for lk in LOOK:
        try:
            vs.look = lk; break
        except Exception:
            continue
    vs.exposure = EXPOSURE; vs.gamma = 1.0
    vs.use_white_balance = True
    vs.white_balance_temperature = WB_TEMP
    sc.render.image_settings.file_format = "PNG"
    sc.render.image_settings.color_depth = "16"


def _compositor():
    sc = bpy.context.scene
    ng = bpy.data.node_groups.get("DuskComp") or bpy.data.node_groups.new("DuskComp", "CompositorNodeTree")
    ng.nodes.clear()
    if not any(s.in_out == "OUTPUT" for s in ng.interface.items_tree if hasattr(s, "in_out")):
        ng.interface.new_socket("Image", in_out="OUTPUT", socket_type="NodeSocketColor")
    rl = ng.nodes.new("CompositorNodeRLayers"); rl.location = (-600, 0)
    gl = ng.nodes.new("CompositorNodeGlare"); gl.location = (-300, 0)
    for nm, v in (("Type", "Bloom"), ("Quality", "High")):
        try:
            gl.inputs[nm].default_value = v
        except Exception:
            pass
    for nm, v in (("Threshold", 1.6), ("Strength", 0.22), ("Size", 0.55), ("Saturation", 0.9)):
        if nm in gl.inputs:
            try:
                gl.inputs[nm].default_value = v
            except Exception:
                pass
    ld = ng.nodes.new("CompositorNodeLensdist"); ld.location = (0, 0)
    for nm, v in (("Distortion", -0.012), ("Dispersion", 0.006)):
        if nm in ld.inputs:
            ld.inputs[nm].default_value = v
    go = ng.nodes.new("NodeGroupOutput"); go.location = (300, 0)
    L = ng.links
    L.new(rl.outputs["Image"], gl.inputs["Image"])
    L.new(gl.outputs[0], ld.inputs["Image"])
    L.new(ld.outputs[0], go.inputs[0])
    sc.compositing_node_group = ng
    sc.render.use_compositing = True


def _camera():
    _overrides()
    sc = bpy.context.scene
    cam = C.setup_camera()
    act = cam.animation_data.action
    # ease in/out on the dolly; tiny breathing on height and heading so it is not a perfect CG slide
    for fc in _fcurves(act):
        for k in fc.keyframe_points:
            k.interpolation = "BEZIER"; k.handle_left_type = k.handle_right_type = "AUTO_CLAMPED"
        if fc.data_path == "location" and fc.array_index == 2:
            md = fc.modifiers.new("NOISE"); md.scale = 90; md.strength = 0.006; md.phase = 3.0
    cam.keyframe_insert("rotation_euler", frame=1)
    for fc in _fcurves(act):
        if fc.data_path == "rotation_euler" and fc.array_index in (0, 2):
            md = fc.modifiers.new("NOISE"); md.scale = 120; md.strength = 0.0018; md.phase = 7.0 + fc.array_index
    cd = cam.data
    cd.dof.use_dof = False
    sc.frame_set(1)


def _fcurves(act):
    """Blender 5 layered actions: walk every F-curve of the action (any slot / layer)."""
    if hasattr(act, "fcurves") and len(getattr(act, "fcurves", [])):
        return list(act.fcurves)
    out = []
    for layer in getattr(act, "layers", []):
        for strip in layer.strips:
            for bag in getattr(strip, "channelbags", []):
                out += list(bag.fcurves)
    return out


STEPS = [
    ("天空：多重散射大氣、傍晚太陽 6°", _world),
    ("夕陽主光、棚頂反射補光與日光燈強度", _sun),
    ("遠景空氣透視（距離霧化）", _haze),
    ("Cycles 渲染設定與 AgX 色彩", _render),
    ("合成：泛光與鏡頭色散", _compositor),
    ("鏡頭：沿月台緩慢推進", _camera),
]
