#!/usr/bin/env python3
"""Build the scene inside a running GUI Blender through the Blender MCP bridge, step by step, with UI screenshots.

  Blender --python tools/start_gui.py out/empty.blend      # once: GUI Blender + MCP bridge on :9876
  python3 tools/build_mcp.py                               # full build -> out/shots/*.png + out/shots/manifest.json
  python3 tools/build_mcp.py --only materials,lighting     # re-run some phases on the current scene (no reset)
  python3 tools/build_mcp.py --noshots                     # no screenshots (fast rebuild)

Phases: model (platform, canopy, tracks, signs, city) -> materials -> lighting -> save out/scene.blend.
Each module step is one MCP request; a screenshot request follows after the viewport redrew.
"""
import json, os, sys, time, argparse
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from bl import send

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHOTS = os.path.join(ROOT, "out", "shots")
MODEL = ["platform", "canopy", "tracks", "signs", "city"]

MOD_ZH = {"platform": "月台", "canopy": "頂棚", "tracks": "軌道與兩側", "signs": "標示與看板", "city": "街景"}
STEP_ZH = {
    "platform body, refuge recess, coping": "月台本體、避難凹槽、邊緣石",
    "floor tiles and white safety line": "地磚與白色安全線",
    "tactile strips with domes": "黃色導盲磚（點狀凸起）",
    "drains, hatches, joints, door marks": "排水蓋、檢修蓋、伸縮縫、乘車位置標示",
    "glass elevator shaft": "玻璃電梯井",
    "stairwell, handrails, windbreak": "樓梯口、扶手、擋風玻璃",
    "benches, bins, platform end": "長椅、垃圾桶、月台端",
    "columns": "柱子（包覆板、踢腳板、紅白斜紋）",
    "frame": "Y 字形鋼骨與斜撐",
    "purlins": "桁條",
    "roof": "折板屋面、天溝、簷口",
    "lights": "日光燈列",
    "services": "線槽、管線、喇叭、監視器",
    "track bed + troughs": "道床與電纜槽",
    "ballast": "道碴",
    "sleepers + fastenings": "枕木與扣件",
    "rails": "鋼軌",
    "left parapet + fence": "左側女兒牆與玻璃圍欄",
    "right retaining wall": "右側擋土牆",
    "hedge": "牆頂樹籬",
    "catenary poles": "電車線柱",
    "catenary wires": "架空電車線",
    "sign textures + materials": "日文標示貼圖與材質",
    "direction signs": "方向指示牌",
    "LED departure boards": "LED 發車資訊看板",
    "placards + elevator sign": "月台編號、停車位置牌、電梯指示",
    "platform clock": "月台時鐘",
    "station name board": "站名標",
    "wall posters": "擋土牆廣告",
    "terrain + hills": "地形與遠山",
    "left city, far": "左側遠景市街",
    "left city, near": "左側近景市街",
    "hillside houses": "右側坡地住宅",
    "apartments + high-rise": "公寓與白色高樓",
    "trees": "樹木",
    "utility poles + wires": "電線桿與電線",
    "floor, tactile and lines": "地磚、導盲磚、標線",
    "concrete": "混凝土（髒污、水痕）",
    "metals and paint": "金屬與烤漆（邊緣磨損、積塵）",
    "track": "鋼軌、枕木、道碴",
    "lights, glass, cables": "燈管、玻璃、電纜",
    "city and foliage": "建築、窗光、植栽",
}
zh = lambda label: STEP_ZH.get(label, label)

ap = argparse.ArgumentParser()
ap.add_argument("--only", default="")
ap.add_argument("--noshots", action="store_true")
ap.add_argument("--wait", type=float, default=0.6)
ap.add_argument("--rwait", type=float, default=14.0, help="seconds to let the Cycles viewport converge")
a = ap.parse_args()
only = set(x for x in a.only.split(",") if x)

manifest_path = os.path.join(SHOTS, "manifest.json")
os.makedirs(SHOTS, exist_ok=True)
manifest = json.load(open(manifest_path)) if (only and os.path.exists(manifest_path)) else []
if not only:
    for f in os.listdir(SHOTS):
        if f.endswith(".png"):
            os.remove(os.path.join(SHOTS, f))


def run(code, what=""):
    r = send(code)
    if r.get("status") != "ok":
        print("FAILED:", what, "\n", r.get("message"), r.get("stdout", ""), r.get("stderr", ""))
        sys.exit(1)
    if r.get("stdout"):
        sys.stdout.write(r["stdout"])
    return r.get("result") or {}


PRELUDE = r'''
import bpy, sys, os, time, importlib.util
from mathutils import Vector
ROOT = %r
if os.path.join(ROOT, "parts") not in sys.path:
    sys.path.insert(0, os.path.join(ROOT, "parts"))
def _part(name, fresh=False):
    key = "part_" + name
    if fresh or key not in sys.modules:
        spec = importlib.util.spec_from_file_location(key, os.path.join(ROOT, "parts", name + ".py"))
        mod = importlib.util.module_from_spec(spec); spec.loader.exec_module(mod)
        sys.modules[key] = mod
    return sys.modules[key]
def _v3d():
    w = bpy.context.window_manager.windows[0]
    area = max((x for x in w.screen.areas if x.type == "VIEW_3D"), key=lambda x: x.width * x.height)
    return w, area, area.spaces.active
''' % ROOT


def view(mode="cam", shading="SOLID", eye=None, tgt=None, lens=None):
    """Set the main 3D viewport: mode 'cam' = through ShotCam, else a free perspective eye->tgt."""
    code = PRELUDE + r'''
w, area, sp = _v3d()
r3 = sp.region_3d
sp.shading.type = %r
if %r == "SOLID":
    sp.shading.light = "STUDIO"; sp.shading.color_type = "MATERIAL"
    sp.shading.show_cavity = True; sp.shading.show_shadows = True
sp.clip_start = 0.05; sp.clip_end = 4000
sp.overlay.show_floor = False; sp.overlay.show_axis_x = False; sp.overlay.show_axis_y = False
if %r == "cam" and bpy.context.scene.camera:
    r3.view_perspective = "CAMERA"
    sp.lock_camera = False
    rg = next(x for x in area.regions if x.type == "WINDOW")
    with bpy.context.temp_override(window=w, area=area, region=rg, screen=w.screen):
        bpy.ops.view3d.view_center_camera()      # camera frame fills the viewport (no passepartout band)
else:
    eye, tgt = Vector(%r), Vector(%r)
    r3.view_perspective = "PERSP"
    r3.view_location = tgt
    r3.view_rotation = (eye - tgt).to_track_quat("Z", "Y")
    r3.view_distance = (eye - tgt).length
    if %r: sp.lens = %r
area.tag_redraw()
result = {}
''' % (shading, shading, mode, list(eye or (0, 0, 0)), list(tgt or (0, 0, 0)), bool(lens), lens or 50)
    run(code, "view")


def editor(kind):
    """Turn the bottom (timeline) area into another editor: 'TIMELINE', 'ShaderNodeTree', 'TEXT_EDITOR'."""
    run(PRELUDE + r'''
w = bpy.context.window_manager.windows[0]
areas = [x for x in w.screen.areas if x.type in ("DOPESHEET_EDITOR", "NODE_EDITOR", "TEXT_EDITOR", "GRAPH_EDITOR")]
if areas:
    ar = min(areas, key=lambda x: x.y)
    ar.ui_type = %r
result = {}
''' % kind, "editor")


def workspace(kind):
    """Switch the window workspace: 'layout' or 'shading' (names may be translated, so match several)."""
    names = {"layout": ("Layout", "配置"), "shading": ("Shading", "著色")}[kind]
    run(PRELUDE + r'''
ws = next((bpy.data.workspaces[n] for n in %r if n in bpy.data.workspaces), None)
if ws: bpy.context.window_manager.windows[0].workspace = ws
result = {"ws": ws.name if ws else None}
''' % (names,), "workspace")
    time.sleep(0.5)


def show_material(key):
    """Select an object that uses material `key` so the shader editor shows its node tree."""
    run(PRELUDE + r'''
m = bpy.data.materials.get(%r)
ob = None
if m:
    for o in bpy.context.view_layer.objects:
        if o.type == "MESH" and m.name in [s.material.name for s in o.material_slots if s.material]:
            ob = o; break
if ob:
    for o in bpy.context.selected_objects: o.select_set(False)
    ob.select_set(True); bpy.context.view_layer.objects.active = ob
    ob.active_material_index = [s.material.name if s.material else "" for s in ob.material_slots].index(m.name)
    w = bpy.context.window_manager.windows[0]
    for ar in w.screen.areas:
        if ar.type == "NODE_EDITOR":
            sp = ar.spaces.active
            sp.node_tree = m.node_tree if hasattr(sp, "node_tree") else None
            ar.tag_redraw()
result = {"ob": ob.name if ob else None}
''' % key, "show_material")
    time.sleep(0.8)   # let the node editor draw the new tree once, else view_all frames stale bounds
    run(PRELUDE + r'''
w = bpy.context.window_manager.windows[0]
for ar in w.screen.areas:
    if ar.type == "NODE_EDITOR":
        rg = next(x for x in ar.regions if x.type == "WINDOW")
        with bpy.context.temp_override(window=w, area=ar, region=rg, screen=w.screen):
            try: bpy.ops.node.view_all()
            except Exception as e: print("view_all", e)
result = {}
''', "node view_all")


shot_i = [len(manifest)]


def shot(phase, caption, wait=None):
    if a.noshots:
        return
    time.sleep(a.wait if wait is None else wait)
    shot_i[0] += 1
    name = "%04d_%s.png" % (shot_i[0], phase)
    path = os.path.join(SHOTS, name)
    run(PRELUDE + r'''
w = bpy.context.window_manager.windows[0]
area = max((x for x in w.screen.areas if x.type == "VIEW_3D"), key=lambda x: x.width * x.height)
with bpy.context.temp_override(window=w, area=area, screen=w.screen):
    bpy.ops.screen.screenshot(filepath=%r)
result = {}
''' % path, "shot")
    manifest.append({"file": name, "phase": phase, "caption": caption})
    json.dump(manifest, open(manifest_path, "w"), ensure_ascii=False, indent=1)


def stats():
    return run(PRELUDE + r'''
sc = bpy.context.scene
tris = 0
for o in sc.objects:
    if o.type == "MESH":
        tris += sum(len(p.vertices) - 2 for p in o.data.polygons)
result = {"objects": len(sc.objects), "tris": tris}
''', "stats")


def run_module(name, phase, per_step):
    n = run(PRELUDE + "m = _part(%r, fresh=True)\nresult = {'n': len(getattr(m, 'STEPS', []))}" % name, "load " + name)["n"]
    for i in range(n):
        t = time.time()
        r = run(PRELUDE + r'''
m = _part(%r)
label, fn = m.STEPS[%d]
t = time.time(); fn()
result = {"label": label, "t": round(time.time() - t, 2)}
''' % (name, i), "%s step %d" % (name, i))
        print("  %-9s %2d/%d %-40s %5.2fs" % (name, i + 1, n, r["label"], r["t"]))
        per_step(name, i, n, r["label"])


ORBIT = [((-30, -22, 18), (0, 25, 0)), ((-14, -10, 6), (0, 18, 2)), ((16, -14, 9), (0, 30, 1)),
         ((24, 40, 14), (0, 40, 0)), ((-20, 70, 22), (0, 40, 0)), ((0, -16, 30), (0, 45, 0))]
MOD_VIEW = {
    "platform": ((-11, -9, 7), (0, 14, 0)),
    "canopy":   ((-12, -10, 9), (0, 20, 3)),
    "tracks":   ((-18, -12, 6), (0, 25, -1)),
    "signs":    ((-2.5, 6, 2.2), (0, 26, 3.4)),
    "city":     ((-60, -80, 70), (-60, 300, -10)),
}

t0 = time.time()
if not only:
    # ------------------------------------------------------------------ reset
    run(PRELUDE + r'''
for o in list(bpy.data.objects): bpy.data.objects.remove(o, do_unlink=True)
for c in list(bpy.data.collections): bpy.data.collections.remove(c)
for m in list(bpy.data.materials): bpy.data.materials.remove(m)
for k in [k for k in sys.modules if k.startswith("part_") or k == "common"]: del sys.modules[k]
sc = bpy.context.scene
sc.render.engine = "CYCLES"
p = bpy.context.preferences.addons["cycles"].preferences
p.compute_device_type = "METAL"; p.refresh_devices()
for d in p.devices: d.use = d.type == "METAL"
sc.cycles.device = "GPU"; sc.cycles.preview_samples = 48; sc.cycles.use_preview_denoising = True
import common as C
C.setup_camera(1)
result = {}
''', "reset")
    workspace("layout")
    editor("TIMELINE")
    view("free", "SOLID", *ORBIT[0])
    shot("model", "空場景：只有鏡頭", 0.8)

if not only or "model" in only:
    for mod in MODEL:
        if only and mod not in only and "model" not in only:
            continue
        def per(name, i, n, label):
            eye, tgt = MOD_VIEW[name]
            if i == 0:
                view("free", "SOLID", eye, tgt)
            shot("model", "%s · %s" % (MOD_ZH[name], zh(label)))
            if i == n - 1:
                view("cam", "SOLID"); shot("model", "%s完成（鏡頭視角）" % MOD_ZH[name])
        run_module(mod, "model", per)
    for eye, tgt in ORBIT:
        view("free", "SOLID", eye, tgt); shot("model", "建模完成：環繞檢視")
    print(stats())

if not only or "materials" in only:
    workspace("shading")
    view("cam", "MATERIAL")
    keys = run(PRELUDE + "m = _part('materials', fresh=True)\nresult = {'k': [l for l, f in m.STEPS]}", "mat steps")["k"]
    focus = ["tile_floor", "concrete", "steel_paint", "rail_steel", "light_tube", "window_city", "roof_deck", "tactile_yellow"]

    def perm(name, i, n, label):
        show_material(focus[i % len(focus)])
        if i % 2:
            view("free", "MATERIAL", (-3.2, 2, 1.4), (1.5, 9, 0.3))
        else:
            view("cam", "MATERIAL")
        shot("materials", zh(label), 4.5)
    run_module("materials", "materials", perm)
    view("cam", "MATERIAL"); shot("materials", "材質完成（材質預覽）", 6)

if not only or "lighting" in only:
    workspace("layout")

    def perl(name, i, n, label):
        view("cam", "RENDERED")
        shot("lighting", zh(label), a.rwait)
    run_module("lighting", "lighting", perl)
    for fr in (1, 100, 200, 300):
        run(PRELUDE + "bpy.context.scene.frame_set(%d)\nresult={}" % fr)
        shot("lighting", "鏡頭推進：第 %d 格" % fr, a.rwait)
    run(PRELUDE + "bpy.context.scene.frame_set(1)\nresult={}")

run(PRELUDE + "bpy.ops.wm.save_as_mainfile(filepath=%r, copy=True)\nresult={}" % os.path.join(ROOT, "out", "scene.blend"), "save")
print("done %.0fs, %d shots" % (time.time() - t0, len(manifest)))
