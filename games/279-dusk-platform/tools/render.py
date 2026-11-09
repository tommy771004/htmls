"""Final film render: background Blender on the scene saved by build_mcp.py.

  Blender -b out/scene.blend -P tools/render.py [-- --frames 1-300 --samples N --res 1920x1080 --out out/frames]

Skips frames that already exist (placeholders on), so a killed run can be restarted with the same command.
"""
import bpy, os, sys, time

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
opt = dict(zip(argv[::2], argv[1::2]))
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
out = os.path.abspath(opt.get("--out", os.path.join(ROOT, "out", "frames")))
os.makedirs(out, exist_ok=True)

p = bpy.context.preferences.addons["cycles"].preferences
p.compute_device_type = "METAL"; p.refresh_devices()
for d in p.devices:
    d.use = d.type == "METAL"

sc = bpy.context.scene
sc.render.engine = "CYCLES"
sc.cycles.device = "GPU"
if "--samples" in opt:
    sc.cycles.samples = int(opt["--samples"])
if "--res" in opt:
    w, h = map(int, opt["--res"].split("x"))
    sc.render.resolution_x, sc.render.resolution_y = w, h
sc.render.resolution_percentage = 100
f0, f1 = map(int, opt.get("--frames", "%d-%d" % (sc.frame_start, sc.frame_end)).split("-"))
sc.frame_start, sc.frame_end = f0, f1
r = sc.render
r.filepath = os.path.join(out, "f")
r.image_settings.file_format = "PNG"
r.image_settings.color_mode = "RGB"
r.image_settings.color_depth = "8"
r.use_overwrite = False
r.use_placeholder = True
r.use_persistent_data = True

t0 = [time.time()]
def tick(scene, *_):
    now = time.time()
    print("frame %d  %.1fs" % (scene.frame_current, now - t0[0]), flush=True)
    t0[0] = now
bpy.app.handlers.render_post.append(tick)
print("render %s frames %d-%d %dx%d samples %d" % (out, f0, f1, r.resolution_x, r.resolution_y, sc.cycles.samples), flush=True)
bpy.ops.render.render(animation=True)
print("render done", flush=True)
