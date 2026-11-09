# 279 黃昏月台 — scene brief for module authors

Goal: a photoreal, empty Japanese JR-style island platform at dusk, rendered in Cycles, camera dollying slowly down the
platform centre line (12.5 s, 300 frames @ 24 fps, 1920×1080). Reference photo: `ref/ref.png` (look at it first).
Everything is modelled in Python (`bpy`/`bmesh`); materials are procedural node trees; only Japanese-text signage and
posters use generated image textures (`tex/`). Do not put the JR logo or any real company logo/brand on anything.

## What the reference shows (match its feel, not pixel-copy)
* Long island platform, large square floor tiles (warm beige/grey, slightly glossy, worn), yellow dotted tactile strip near
  each edge, light concrete coping at the edge, track drops away on both sides.
* Butterfly (V) canopy: a row of square columns on the centre line; from each column top, transverse steel beams rise
  outward to the eaves, with diagonal struts from the column to the beams (Y-shaped). Continuous rows of fluorescent tube
  fixtures run the whole length (they converge to the vanishing point and are a key visual). Purlins, folded steel roof
  deck underside, cable trays, conduits, hanging rods.
* Hanging signage: two large black direction signs side by side over the centre (white text: "2 横浜 新横浜 方面 / for
  Yokohama, Shin-Yokohama" and "川崎 品川 方面 / for Kawasaki, Shinagawa 1"), two LED departure boards below/behind them
  (amber/green dot-matrix: "各停 17:02 横浜 8両", scrolling red "★まもなく 2番線に 電車が参ります"), small square
  platform-number placards ("2", "1") and car-stop placards ("8"), a blue elevator sign "エレベーター Elevator".
  The first column has a red/white diagonal-stripe band near its top. CCTV camera on a bracket.
* Left (track 2): open side, low wall + railing fence, overhead catenary wires and poles, a city spreading far below to
  hazy hills, sun low on the left horizon (warm orange haze).
* Right (track 1): retaining wall with framed ad posters, hedge on top, low-rise houses / apartments / a white high-rise
  beyond, utility poles and wires.
* Dusk: warm low sun raking across the platform under the canopy from the left, cool white fluorescent light from above,
  bluish sky away from the sun.

## Coordinates (authoritative values live in `parts/common.py`)
Z up, metres. Platform runs along +Y, walking surface z=0, edges at x=±4.60, rail top z=-1.10, track centres x=±6.30.
Columns on x=0 at y=12,24,…,156 (none at y≤0 because the camera runs on x=0 from y=0.5 to y=3.5, eye height 1.55, lens 28 mm
on 36 mm sensor ≈ 65° horizontal FOV, looking straight down +Y). Canopy y=-24…162, valley z=4.40 on x=0, eaves z=5.05 at
x=±5.20. Left parapet x=-8.70; right retaining wall face x=+8.70, top z=+1.70. City ground on the left z≈-11.
Sun: elevation 6°, azimuth -115° (left-behind, out of frame; rakes the column faces and right wall). `C.sun_vector()` points toward the sun.

## Module ownership (one file each — never edit another agent's file, never edit `common.py`)
| file | owner content |
| --- | --- |
| `parts/platform.py` | platform slab + side walls + dark refuge recess under the coping, coping, white safety line, yellow tactile strips (real dome geometry for the first ~25 m in front of the camera, rest may be bump only — say which), floor (one mesh is fine, tiles come from the material; but add a few *geometric* details: drain covers, expansion joints, car-position floor marks as thin decals), platform ends, elevator shaft (glass/steel box around y≈34–37 on the centre line, behind column 3) and a stairwell going down (y≈44–60, x≈-1.7…1.7) with handrails, low walls and a small glass windbreak; a few benches and bins far down the platform (y>60). |
| `parts/canopy.py` | columns (light-grey clad, stainless kick plate at the foot, red/white stripe band near the top of the FIRST column y=12 only), transverse beams, Y struts, purlins, roof deck underside (folded/corrugated), centre box gutter + downpipe on columns, eave fascia + gutter, fluorescent fixture rows (housings + separate emissive tube meshes using `light_tube`), cable trays, conduits, speakers, CCTV dome/bracket on column 1. |
| `parts/signs.py` + `tools/tex.mjs` → `tex/*.png` | all signage and posters: direction signs (internally lit), LED departure boards (dot-matrix texture, emissive; animate the scrolling red message with a keyframed Mapping offset over frames 1–300), platform-number placards, car-stop placards, elevator sign, a hanging analog clock showing 17:01, the standing station-name board 駅名標 (fictional station "汐見台 しおみだい Shiomidai", neighbours 新横浜 / 川崎 — no JR logo), ad posters in frames on the right retaining wall (fictional brands only), hanger rods/brackets. Sign materials are owned here and named `sign_*` / `poster_*`. |
| `parts/tracks.py` | rails (proper head/web/foot profile), sleepers, ballast (geometry with noise, not a flat box), track bed edges, cable troughs, both tracks from y=-200 to y=700; catenary poles + cantilevers + messenger/contact wires + droppers (wires sag slightly; also feeder wires above the poles); left parapet wall + steel railing/mesh fence; right retaining wall (concrete, panel joints, drainage weep holes, stains) + top fence + hedge on top (lumpy foliage geometry). |
| `parts/city.py` | left lowland city far below (thousands of buildings via instancing/joined meshes, varied heights, roofs, rooftop tanks; windows as a material on `window_city`; a few lit), hills on the horizon, utility poles and wires; right hillside above the retaining wall: Japanese houses (kawara roofs), 3–6 storey apartments, one white high-rise, trees, utility poles + sagging wires. Everything beyond x=±9; keep the total tris reasonable (<3 M) and use linked duplicates. |
| `parts/materials.py` | `STEPS` that rebuild every key in `C.MATS` (in place via `C.new_material(key)`), procedural only: tiles with grout + per-tile variation + wear + subtle gloss, tactile yellow with domes bump and dirt, concrete with stains/AO grime (use Ambient Occlusion node / pointiness where useful), painted steel with edge wear and dust, galvanized, roof deck, stainless, red/white diagonal stripes, rail steel (rusty web, shiny head), sleeper, ballast, light tube (emissive ~5000 K), glass, foliage, building materials, `window_city` (dark glass with random warm lit windows via object-random / cell noise), kawara roof tiles, terrain. |
| `parts/lighting.py` (later stage) | world sky, sun, fluorescent strength, render + colour management + compositor, final camera move. |

## Rules
* Read `parts/common.py` first and use its helpers (`C.coll`, `C.mesh`, `C.Builder`, `C.box`, `C.cylinder`, `C.instance`,
  `C.uv_box`, `C.smooth_by_angle`, `C.mat`). Use the layout constants instead of re-typing numbers.
* Module shape: `STEPS = [("label", fn), ...]`; the first step calls `C.coll("<Name>", fresh=True)`. 4–10 steps per module,
  each a visibly different chunk (for the making-of timelapse). No step may take more than ~20 s.
* Blender 5.2 API: there is no `use_auto_smooth`; materials have nodes by default but default node names are translated in
  the GUI session — find nodes by `bl_idname`. Avoid `bpy.ops` where data API works (ops need context in the GUI bridge).
* Geometry should hold up to the camera: bevel visible edges (bevel modifier or modelled chamfers), no z-fighting
  (offset coplanar decals by ≥2 mm), correct normals (outward), real thickness on sheet parts near the camera.
* Keep object count sane: merge repeated small parts with `C.Builder` or linked duplicates via `C.instance`.

## Testing
```
cd games/279-dusk-platform
/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P tools/preview.py -- \
   --parts platform,canopy --engine cycles --samples 24 --res 960x540 --view shot --out $PWD/out/prev/<you>_shot.png
```
`--view` also takes `over`, `left`, `right`, `floor`, `sky`, `roof` or `x,y,z,tx,ty,tz`; `--engine workbench` is faster
for geometry. Add `materials` to `--parts` (after the geometry modules) to see real materials. Always write previews to
`out/prev/<your-module>_*.png` (other agents run in parallel; never overwrite their files) and look at them with the Read
tool. Several Blender renders run at once on one GPU — keep previews small (≤960×540, ≤32 samples).
