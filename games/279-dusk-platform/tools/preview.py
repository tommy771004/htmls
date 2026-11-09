"""Headless preview of any subset of part modules.

  Blender -b --factory-startup -P tools/preview.py -- --parts platform,canopy [--engine workbench|cycles]
        [--view shot|over|left|right|floor|sky|x,y,z,tx,ty,tz] [--frame 1] [--res 960x540] [--samples 32]
        [--out out/prev/x.png] [--save out/prev/x.blend] [--lit]

  * Modules run in the order given; 'materials' and 'lighting' are modules too.
  * Without 'lighting' in --parts and with --engine cycles, a stand-in sun + sky is added so materials can be judged.
  * --view shot uses the real ShotCam at --frame. Other names are fixed inspection cameras.
  * Prints per-module timing and object / triangle counts.
"""
import bpy, sys, os, time, math, importlib, importlib.util, argparse

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, os.path.join(ROOT, "parts"))

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument("--parts", default="")
ap.add_argument("--engine", default="workbench")
ap.add_argument("--view", default="shot")
ap.add_argument("--frame", type=int, default=1)
ap.add_argument("--res", default="960x540")
ap.add_argument("--samples", type=int, default=32)
ap.add_argument("--out", default=os.path.join(ROOT, "out", "prev", "preview.png"))
ap.add_argument("--save", default="")
ap.add_argument("--lens", type=float, default=0)
a = ap.parse_args(argv)

import common as C

# empty scene
for o in list(bpy.data.objects):
    bpy.data.objects.remove(o, do_unlink=True)
for c in list(bpy.data.collections):
    bpy.data.collections.remove(c)

parts = [p for p in a.parts.split(",") if p]
t_all = time.time()
for p in parts:
    # load by path: 'platform' would otherwise resolve to the stdlib module of the same name
    spec = importlib.util.spec_from_file_location("part_" + p, os.path.join(ROOT, "parts", p + ".py"))
    mod = importlib.util.module_from_spec(spec); spec.loader.exec_module(mod)
    t = time.time()
    steps = getattr(mod, "STEPS", [])
    for label, fn in steps:
        fn()
    print("[preview] %-10s %2d steps %6.2fs" % (p, len(steps), time.time() - t))

cam = C.setup_camera(a.frame)
sc = bpy.context.scene

views = {
    "over":  ((-22, -18, 16), (0, 30, 0)),
    "left":  ((3.5, 6, 1.6), (-30, 30, -3)),
    "right": ((-3.5, 6, 1.6), (12, 40, 1)),
    "floor": ((1.5, 2, 1.2), (3.5, 6, 0)),
    "sky":   ((0, 6, 1.4), (0, 14, 4.6)),
    "roof":  ((0, 4, 1.6), (0, 20, 4.6)),
}
if a.view != "shot":
    if a.view in views:
        eye, tgt = views[a.view]
    else:
        n = [float(x) for x in a.view.split(",")]
        eye, tgt = n[:3], n[3:6]
    cd = bpy.data.cameras.new("InspectCam")
    ic = bpy.data.objects.new("InspectCam", cd)
    sc.collection.objects.link(ic)
    from mathutils import Vector
    d = Vector(tgt) - Vector(eye)
    ic.location = eye
    ic.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
    cd.lens = a.lens or 28; cd.clip_end = 3000
    sc.camera = ic
elif a.lens:
    cam.data.lens = a.lens

w, h = (int(x) for x in a.res.split("x"))
sc.render.resolution_x, sc.render.resolution_y = w, h
sc.render.resolution_percentage = 100
sc.render.image_settings.file_format = "PNG"
sc.render.filepath = a.out
os.makedirs(os.path.dirname(a.out), exist_ok=True)

if a.engine == "workbench":
    sc.render.engine = "BLENDER_WORKBENCH"
    sh = sc.display.shading
    sh.light = "STUDIO"; sh.color_type = "MATERIAL"
    sh.show_shadows = True; sh.show_cavity = True
    sc.display.shading.cavity_type = "BOTH"
else:
    sc.render.engine = "CYCLES"
    prefs = bpy.context.preferences.addons["cycles"].preferences
    prefs.compute_device_type = "METAL"; prefs.refresh_devices()
    for d in prefs.devices:
        d.use = d.type == "METAL"
    sc.cycles.device = "GPU"
    sc.cycles.samples = a.samples
    sc.cycles.use_denoising = True
    if "lighting" not in parts:
        # stand-in light rig: low warm sun from the left-front + sky
        world = bpy.data.worlds.new("PreviewWorld"); sc.world = world
        nt = world.node_tree; nt.nodes.clear()
        sky = nt.nodes.new("ShaderNodeTexSky"); sky.sky_type = "MULTIPLE_SCATTERING"
        el = math.radians(C.SUN["elevation_deg"]); az = math.radians(C.SUN["azimuth_deg"])
        sky.sun_elevation = el
        sky.sun_rotation = float(os.environ["SUNROT"]) if "SUNROT" in os.environ else az   # Sky texture: rotation 0 = sun toward +Y, +90deg = toward +X
        bg = nt.nodes.new("ShaderNodeBackground"); bg.inputs["Strength"].default_value = float(os.environ.get("SKYK", "0.4"))
        out = nt.nodes.new("ShaderNodeOutputWorld")
        nt.links.new(sky.outputs["Color"], bg.inputs["Color"]); nt.links.new(bg.outputs["Background"], out.inputs["Surface"])
        sd = bpy.data.lights.new("PreviewSun", "SUN"); sd.energy = float(os.environ.get("LAMPK", "4.0")); sd.color = (1.0, 0.62, 0.38); sd.angle = math.radians(0.6)
        so = bpy.data.objects.new("PreviewSun", sd); sc.collection.objects.link(so)
        so.rotation_euler = (C.sun_vector()).to_track_quat("Z", "Y").to_euler()
        sc.view_settings.view_transform = "AgX"

tris = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in sc.objects if o.type == "MESH")
print("[preview] objects %d  tris %d  build %.2fs" % (len(sc.objects), tris, time.time() - t_all))
t = time.time()
bpy.ops.render.render(write_still=True)
print("[preview] render %.2fs -> %s" % (time.time() - t, a.out))
if a.save:
    bpy.ops.wm.save_as_mainfile(filepath=a.save)
