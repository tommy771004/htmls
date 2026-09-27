# 184 阿斯拉重返：用 Blender（5.x，無頭模式）以 Python 建立 ν 阿斯拉 AKF-0/G 與鳳・凰呀 AA-1，匯出 cars.glb。
# 重建：RENDER=0 GLB=assets/184/cars.glb blender -b --factory-startup -P assets/184/build_cars.py -- /tmp/renders
# 比例來源：在四張模型照片上標出同一組特徵點，以光束法平差同時解出相機與點的 3D 位置（後輪為尺度基準），再疊圖校正。
import bpy, bmesh, math, sys, os
from mathutils import Vector, Matrix

OUT = sys.argv[sys.argv.index('--') + 1] if '--' in sys.argv else '/tmp/out'
os.makedirs(OUT, exist_ok=True)
EXPORT = os.environ.get('GLB', '')
RENDER = os.environ.get('RENDER', '1') == '1'

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
COL = bpy.context.collection

def P(x, y, z): return Vector((x, -z, y))

PAL = {
  'white': (0.93, 0.94, 0.95), 'blue': (0.10, 0.27, 0.72), 'lblue': (0.42, 0.66, 0.88), 'red': (0.72, 0.08, 0.09),
  'silver': (0.62, 0.64, 0.67), 'gold': (0.55, 0.42, 0.18), 'dark': (0.03, 0.035, 0.04), 'tyre': (0.025, 0.025, 0.03),
  'glass': (0.55, 0.75, 0.92), 'yellow': (0.95, 0.72, 0.1), 'grey': (0.35, 0.37, 0.4), 'rimface': (0.05, 0.05, 0.06),
  'purple': (0.22, 0.09, 0.45), 'magenta': (0.75, 0.12, 0.38), 'green': (0.12, 0.72, 0.28), 'deep': (0.08, 0.03, 0.18),
}
MATS = {}
def M(name):
  if name not in MATS:
    m = bpy.data.materials.new(name)
    c = PAL[name]
    m.diffuse_color = (*c, 1)
    m.use_nodes = True
    b = m.node_tree.nodes.get('Principled BSDF')
    if b: b.inputs['Base Color'].default_value = (*c, 1); b.inputs['Roughness'].default_value = .5
    MATS[name] = m
  return MATS[name]

def link(ob, parent=None):
  COL.objects.link(ob)
  if parent: ob.parent = parent
  return ob

def mesh_from(name, verts, faces, mat, smooth=True, parent=None):
  me = bpy.data.meshes.new(name)
  me.from_pydata([P(*v) if len(v) == 3 else v for v in verts], [], faces)
  me.validate(); me.update()
  bm = bmesh.new(); bm.from_mesh(me)
  bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
  bm.to_mesh(me); bm.free()
  for p in me.polygons: p.use_smooth = smooth
  ob = bpy.data.objects.new(name, me)
  ob.data.materials.append(M(mat))
  return link(ob, parent)

def subsurf(ob, lv=2):
  m = ob.modifiers.new('ss', 'SUBSURF'); m.levels = lv; m.render_levels = lv
  return ob

def apply_all(ob):
  bpy.context.view_layer.objects.active = ob
  for m in list(ob.modifiers):
    with bpy.context.temp_override(object=ob, active_object=ob, selected_objects=[ob]):
      bpy.ops.object.modifier_apply(modifier=m.name)

def crease(ob, pred):
  me = ob.data
  attr = me.attributes.get('crease_edge') or me.attributes.new('crease_edge', 'FLOAT', 'EDGE')
  for e in me.edges:
    a, b = me.vertices[e.vertices[0]].co, me.vertices[e.vertices[1]].co
    attr.data[e.index].value = 1.0 if pred(a, b) else 0.0

# ---------- loft from rings (each ring: list of page-coord points, same count) ----------
def loft(name, rings, mat, lv=2, parent=None, cap=True, creases=None):
  n = len(rings[0]); verts = [p for r in rings for p in r]; faces = []
  for i in range(len(rings) - 1):
    for j in range(n):
      a, b = i * n + j, i * n + (j + 1) % n
      faces.append((a, b, b + n, a + n))
  if cap:
    faces.append(tuple(range(n))[::-1]); faces.append(tuple(range((len(rings) - 1) * n, len(rings) * n)))
  ob = mesh_from(name, verts, faces, mat, parent=parent)
  if creases:
    me = ob.data
    attr = me.attributes.get('crease_edge') or me.attributes.new('crease_edge', 'FLOAT', 'EDGE')
    nv = len(rings) * n
    for e in me.edges:
      a, b = e.vertices
      if a < nv and b < nv and a % n == b % n and (a % n) in creases: attr.data[e.index].value = creases[a % n]
  if lv: subsurf(ob, lv)
  return ob

def se_ring(x, cy, hw, hh, n=2.5, cz=0.0, N=16, tp=0.0):
  pts = []
  for j in range(N):
    t = j / N * math.tau; c, s = math.cos(t), math.sin(t); e = 2 / n
    ys = math.copysign(abs(s) ** e, s)
    pts.append((x, cy + hh * ys, cz + hw * math.copysign(abs(c) ** e, c) * (1 - tp * (ys + 1) / 2)))
  return pts

def sym_ring(x, half):
  """half: list of (z, y) from bottom-center going outward/up to top-center (z >= 0). Mirrored to a closed ring."""
  right = [(x, y, z) for z, y in half]
  left = [(x, y, -z) for z, y in reversed(half[1:-1])]
  return right + left

# extruded polygon (shape in page XY, thickness along page z) with optional bevel
def slab(name, pts, t, mat, z=0.0, bevel=0.0, parent=None):
  n = len(pts)
  verts = [(x, y, z - t / 2) for x, y in pts] + [(x, y, z + t / 2) for x, y in pts]
  faces = [tuple(range(n))[::-1], tuple(range(n, 2 * n))] + [(j, (j + 1) % n, n + (j + 1) % n, n + j) for j in range(n)]
  ob = mesh_from(name, verts, faces, mat, smooth=False, parent=parent)
  if bevel:
    m = ob.modifiers.new('bv', 'BEVEL'); m.width = bevel; m.segments = 2; m.limit_method = 'ANGLE'
  return ob

# flat plate in page XZ plane (pts are (x, z)), thickness along y
def flat(name, pts, t, mat, y=0.0, bevel=0.0, parent=None):
  n = len(pts)
  verts = [(x, y - t / 2, z) for x, z in pts] + [(x, y + t / 2, z) for x, z in pts]
  faces = [tuple(range(n)), tuple(range(n, 2 * n))[::-1]] + [(j, (j + 1) % n, n + (j + 1) % n, n + j) for j in range(n)]
  ob = mesh_from(name, verts, faces, mat, smooth=False, parent=parent)
  if bevel:
    m = ob.modifiers.new('bv', 'BEVEL'); m.width = bevel; m.segments = 2; m.limit_method = 'ANGLE'
  return ob

def cyl(name, r, depth, mat, loc=(0, 0, 0), axis='z', verts=32, r2=None, parent=None):
  """page-axis cylinder"""
  bm = bmesh.new()
  bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=verts, radius1=r, radius2=r if r2 is None else r2, depth=depth)
  me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
  ob = bpy.data.objects.new(name, me); ob.data.materials.append(M(mat)); link(ob, parent)
  for p in me.polygons: p.use_smooth = True
  # blender cone axis = blender Z = page y. rotate to requested page axis
  if axis == 'z': ob.rotation_euler = (math.radians(90), 0, 0)      # blender Y = -page z
  elif axis == 'x': ob.rotation_euler = (0, math.radians(90), 0)
  ob.location = P(*loc)
  return ob

def join(name, obs, parent=None, origin=None):
  for o in obs: apply_all(o)
  bpy.ops.object.select_all(action='DESELECT')
  for o in obs: o.select_set(True)
  bpy.context.view_layer.objects.active = obs[0]
  bpy.ops.object.join()
  ob = obs[0]; ob.name = name; ob.data.name = name
  bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
  if origin is not None:
    o = P(*origin)
    ob.data.transform(Matrix.Translation(-o)); ob.location = o
  if parent: ob.parent = parent
  return ob

def set_origin(ob, page_pt):
  apply_all(ob)
  bpy.context.view_layer.objects.active = ob
  bpy.ops.object.select_all(action='DESELECT'); ob.select_set(True)
  bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
  o = P(*page_pt); ob.data.transform(Matrix.Translation(-o)); ob.location = o
  return ob

def boolean_cut(ob, cutter):
  m = ob.modifiers.new('cut', 'BOOLEAN'); m.operation = 'DIFFERENCE'; m.object = cutter; m.solver = 'EXACT'
  apply_all(ob)

# ---------- text decal ----------
def text_decal(name, body, font, size, mat, center, face, shear=0.0, target=None, parent=None, rot=0.0):
  """face: 'L' (faces +page z), 'R' (faces -page z). center page coords."""
  cu = bpy.data.curves.new(name, 'FONT'); cu.body = body; cu.size = size; cu.align_x = 'CENTER'; cu.align_y = 'CENTER'
  cu.extrude = 0.004; cu.shear = shear
  if font: cu.font = bpy.data.fonts.load(font, check_existing=True)
  ob = bpy.data.objects.new(name, cu); link(ob)
  ob.data.materials.append(M(mat))
  # text lies in blender XY facing +Z. Page side 'L' faces +page z = -blender Y.
  if face == 'L': ob.rotation_euler = (math.radians(90), 0, 0)
  else: ob.rotation_euler = (math.radians(90), 0, math.radians(180))
  if rot: ob.rotation_euler[1] += rot
  ob.location = P(*center)
  bpy.context.view_layer.objects.active = ob
  bpy.ops.object.select_all(action='DESELECT'); ob.select_set(True)
  bpy.ops.object.convert(target='MESH')
  ob = bpy.context.view_layer.objects.active; ob.name = name
  if target:
    sw = ob.modifiers.new('sw', 'SHRINKWRAP'); sw.target = target; sw.wrap_method = 'PROJECT'; sw.use_negative_direction = True
    sw.use_project_y = True; sw.offset = 0.006; sw.wrap_mode = 'OUTSIDE_SURFACE'
    apply_all(ob)
  if parent: ob.parent = parent
  return ob

# =====================================================================

# ν Asurada AKF-0/G (kit photos) + Ouga AA-1, measured from reference photos.
# Page coords: x forward, y up, z = car's left. Rear axle x=-1.6, rear wheel r=.33.
import os, sys

PAL.update({
  'white': (0.90, 0.91, 0.92), 'blue': (0.03, 0.14, 0.62), 'lblue': (0.05, 0.42, 0.85), 'red': (0.75, 0.03, 0.04),
  'gold': (0.62, 0.40, 0.15), 'glass': (0.05, 0.12, 0.6), 'yellow': (0.95, 0.62, 0.02), 'black': (0.012, 0.012, 0.014),
})

RX, RR, RW, RZ = -1.68, .33, .56, 1.27        # rear wheels
FXS, FR, FW, FZ = (1.27, .755), .235, .24, 1.01  # front wheels

def mirror(rows, s):
  """rows of page points on the +z side -> side s, keeping ring winding consistent"""
  return [[(x, y, s * z) for x, y, z in (r if s > 0 else r[::-1])] for r in rows]

def quad_ring(x, zi, zo, yb, yt, bev=0.0, drop=0.0):
  return [(x, yb, zi), (x, yb, zo), (x, yt - bev, zo), (x, yt, zo - bev), (x, yt - drop, zi + (zo - zi) * .35), (x, yt - drop * 1.25, zi)]

def text_up(name, body, font, size, mat, center, yaw=0.0, parent=None, flip=False):
  cu = bpy.data.curves.new(name, 'FONT'); cu.body = body; cu.size = size; cu.align_x = 'CENTER'; cu.align_y = 'CENTER'
  cu.extrude = 0.003
  if font: cu.font = bpy.data.fonts.load(font, check_existing=True)
  ob = bpy.data.objects.new(name, cu); link(ob); ob.data.materials.append(M(mat))
  ob.rotation_euler = (0, 0, yaw + (math.pi if flip else 0))
  ob.location = P(*center)
  bpy.context.view_layer.objects.active = ob
  bpy.ops.object.select_all(action='DESELECT'); ob.select_set(True)
  bpy.ops.object.convert(target='MESH')
  ob = bpy.context.view_layer.objects.active; ob.name = name
  if parent: ob.parent = parent
  return ob

AB = '/System/Library/Fonts/Supplemental/Arial Black.ttf'
TB = '/System/Library/Fonts/Supplemental/Times New Roman Bold.ttf'
TBI = '/System/Library/Fonts/Supplemental/Times New Roman Bold Italic.ttf'

def wheel2(name, r, w, loc, side, root, rim='gold'):
  obs = []
  t = cyl(name + '_t', r, w, 'black', axis='z', verts=48)
  bv = t.modifiers.new('bv', 'BEVEL'); bv.width = min(.07, w * .2); bv.segments = 4
  obs.append(t)
  dish = cyl(name + '_d', r * .66, w * .96, 'black', axis='z', verts=32)
  obs.append(dish)
  obs.append(cyl(name + '_lip', r * .66, w * .08, rim, loc=(0, 0, side * w * .44), axis='z', verts=40))
  obs.append(cyl(name + '_bar', r * .6, w * .7, rim, loc=(0, 0, side * w * .05), axis='z', verts=32))
  for k in range(5):
    a = k / 5 * math.tau
    sp = slab(name + f'_sp{k}', [(r * .12, -r * .07), (r * .6, -r * .05), (r * .6, r * .05), (r * .12, r * .07)], w * .08, rim, z=side * w * .45)
    sp.rotation_euler = (0, -a, 0); obs.append(sp)
  obs.append(cyl(name + '_hub', r * .15, w * .96, rim, axis='z', verts=16))
  ob = join(name, obs)
  ob.location = P(*loc); ob.parent = root
  return ob

def rod_between(name, a, b, r, mat):
  a, b = Vector(a), Vector(b); d = b - a
  c = cyl(name, r, d.length, mat, axis='y', verts=8)
  c.location = P(*((a + b) / 2))
  c.rotation_mode = 'QUATERNION'; c.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(P(*d).normalized())
  return c

def build(root, Z):
  A = 'blue' if Z else 'purple'; L = 'lblue' if Z else 'magenta'; R = root
  # ---------------- tub + nose (one loft, nose tip -> tail) ----------------
  tub = [(2.34, .32, .03, .02), (2.22, .34, .14, .07), (2.02, .36, .24, .11), (1.78, .37, .31, .14), (1.45, .36, .33, .16), (1.0, .34, .33, .17),
         (.5, .34, .33, .18), (0, .35, .33, .19), (-.6, .37, .32, .2), (-1.3, .4, .3, .22), (-2.0, .42, .3, .24), (-2.38, .43, .25, .2)]
  nose = loft('nose', [se_ring(x, y, hw, hh, n=2.8, N=18) for x, y, hw, hh in tub], 'white' if Z else 'purple', parent=R)
  # blue underside band along the nose
  loft('nose__band', [se_ring(x, y - hh * .72, hw * 1.02, hh * .3, n=3, N=14) for x, y, hw, hh in tub[1:7]], A, parent=R)
  if Z:  # yellow lamp lens on the nose top
    for s, sd in ((1, 'L'), (-1, 'R')):
      loft(f'nose__lamp_{sd}', [se_ring(x, y, .07 * k, .03 * k, n=2, N=14, cz=s * z) for x, y, z, k in [(2.02, .41, .13, .15), (1.94, .43, .15, .8), (1.78, .45, .19, 1), (1.6, .47, .22, .8), (1.52, .47, .23, .2)]], 'yellow', parent=R)
  else:
    flat('marks__tri', [(2.05, 0), (1.75, .1), (1.75, -.1)], .01, 'green', y=.51, parent=R)
  # ---------------- canopy ----------------
  can = [(1.58, .47, .02, .01), (1.4, .53, .14, .06), (1.15, .61, .22, .1), (.85, .68, .26, .13), (.55, .72, .27, .14), (.3, .74, .25, .12), (.14, .74, .16, .08)]
  loft('canopy', [se_ring(x, y, hw, hh, n=2.3, N=18) for x, y, hw, hh in can], 'glass', parent=R)
  # ---------------- engine hump behind the canopy + antenna ----------------
  hump = [(.32, .56, .2, .12, .5), (.15, .66, .28, .24, .45), (-.15, .7, .31, .26, .45), (-.5, .68, .31, .24, .4), (-.85, .63, .29, .18, .35), (-1.15, .6, .26, .13, .3)]
  hmp = loft('rbody__hump', [se_ring(x, y, hw, hh, n=2.6, N=18, tp=tp) for x, y, hw, hh, tp in hump], 'white', parent=R)
  if Z:
    slab('rbody__antenna', [(.1, .9), (-.1, .92), (-.33, 1.25), (-.27, 1.25)], .03, 'white', bevel=.008, parent=R)
  # ---------------- bridge arms + deck (per side) ----------------
  arms = [(.12, .3, .34, .62, .72), (-.1, .3, .62, .56, .76), (-.35, .3, 1.0, .52, .79), (-.56, .3, 1.28, .54, .82),
          (-.8, .3, 1.46, .6, .84), (-1.2, .3, 1.5, .7, .85), (-1.75, .3, 1.5, .72, .85), (-2.1, .3, 1.46, .72, .84), (-2.3, .3, 1.38, .72, .82)]
  for s, sd in ((1, 'L'), (-1, 'R')):
    rows = [quad_ring(x, zi, zo, yb - (.1 if x > -.9 else 0), yt, bev=.05, drop=(.12 if x > -1.0 else .04)) for x, zi, zo, yb, yt in arms]
    loft(f'rbody__arm_{sd}', mirror(rows, s), 'white', lv=2, parent=R)
    # blue band across the rear of the deck (PULSE band)
    band = [[(x, yt - .01, .3), (x, yt - .01, zo - .02), (x, yt + .012, zo - .02), (x, yt + .012, .3)] for x, zi, zo, yb, yt in arms[5:]]
    loft(f'rbody__band_{sd}', mirror(band, s), A, lv=0, parent=R)
    # ---------------- rear fender: one smooth shell (front pillar, arch, tail), wheel arch cut out ----------------
    def fring(x, yb, yt, zi, zo):
      ym, zm = (yb + yt) / 2, (zi + zo) / 2
      return [(x, yb, zi), (x, yb, zm), (x, yb, zo), (x, ym, zo), (x, yt, zo), (x, yt, zm), (x, yt, zi), (x, ym, zi)]
    fr = [(-.46, .06, .26, 1.1, 1.4), (-.54, .03, .5, 1.0, 1.5), (-.7, .03, .78, .96, 1.54), (-1.0, .03, .86, .95, 1.55),
          (-1.5, .03, .86, .95, 1.55), (-2.0, .06, .86, .95, 1.55), (-2.25, .22, .84, .98, 1.52), (-2.4, .42, .8, 1.04, 1.46), (-2.46, .56, .74, 1.14, 1.36)]
    fender = loft(f'rbody__fender_{sd}', mirror([fring(*r) for r in fr], s), 'white', lv=0, parent=R)
    subsurf(fender, 2); apply_all(fender)
    cut = cyl('cut', .4, 1.2, 'black', loc=(RX, RR, s * 1.25), axis='z', verts=64)
    boolean_cut(fender, cut); bpy.data.objects.remove(cut, do_unlink=True)
    # blue lower band on the pillar and the tail (the "Jupiter" / skirt stripe)
    bb = [(-.5, .05, .17, 1.06, 1.44), (-.56, .02, .2, .98, 1.52), (-.7, .02, .2, .95, 1.555), (-1.1, .02, .2, .95, 1.555), (-1.28, .02, .2, .96, 1.54)]
    loft(f'rbody__foot_{sd}', mirror([fring(x, yb, yt, zi - .006, zo + .006) for x, yb, yt, zi, zo in bb], s), A, lv=2, parent=R)
    tb = [(-2.0, .06, .2, .945, 1.556), (-2.25, .22, .34, .975, 1.526), (-2.4, .42, .5, 1.035, 1.466), (-2.46, .56, .6, 1.13, 1.37)]
    loft(f'rbody__skirt_{sd}', mirror([fring(*r) for r in tb], s), A, lv=2, parent=R)
    # ---------------- side pod ----------------
    pod = [(.47, .4, .04, .05), (.42, .4, .15, .17), (.27, .4, .18, .2), (-.4, .4, .18, .2), (-.85, .38, .16, .18), (-1.0, .36, .05, .06)]
    loft(f'pods_{sd}', [se_ring(x, y - .04, hw * .85, hh * .82, n=2.2, N=16, cz=s * .66) for x, y, hw, hh in pod], 'white' if Z else 'white', parent=R)
    loft(f'pods__low_{sd}', [se_ring(x, y - .04 - hh * .45, hw * .88, hh * .42, n=2.2, N=14, cz=s * .66) for x, y, hw, hh in pod[1:5]], A, parent=R)
    ring = bpy.data.objects.new(f'pods__ring_{sd}', bpy.data.meshes.new('r'))
    bm = bmesh.new(); bmesh.ops.create_cone(bm, cap_ends=False, segments=48, radius1=.16, radius2=.13, depth=.08); bm.to_mesh(ring.data); bm.free()
    for pl in ring.data.polygons: pl.use_smooth = True
    link(ring, R); ring.data.materials.append(M(L)); ring.rotation_euler = (0, math.radians(90), 0); ring.location = P(.45, .36, s * .66)
    sol = ring.modifiers.new('so', 'SOLIDIFY'); sol.thickness = .03
    subsurf(ring, 1)
    cyl(f'pods__mouth_{sd}', .13, .02, 'black', loc=(.43, .36, s * .66), axis='x', verts=24).parent = R
    # ---------------- front suspension ----------------
    rods = []
    for x in FXS:
      for dy, dx in ((.07, .16), (.07, -.16), (-.06, .13), (-.06, -.14)):
        rods.append(rod_between('rod', (x + dx * .15, FR + dy, s * (FZ - .12)), (x + dx, .3 + dy * .6, s * .3), .012, 'black'))
      rods.append(cyl('up', .07, .1, 'grey', loc=(x, FR, s * (FZ - .12)), axis='z', verts=14))
    join(f'fwheels__susp_{sd}', rods, parent=R)
    # rear suspension rods (visible from behind)
    rods = [rod_between('rr', (RX + dx, RR + dy, s * (RZ - .26)), (RX + dx * 2, .3 + dy, s * .3), .014, 'black') for dx, dy in ((.12, .08), (-.12, .08), (.1, -.1), (-.1, -.1))]
    join(f'rwheels__susp_{sd}', rods, parent=R)
    # ---------------- wheels ----------------
    for i, x in enumerate(FXS): wheel2(f'fwheels_{sd}{i}', FR, FW, (x, FR, s * FZ), s, R, 'gold' if Z else 'silver')
    wheel2(f'rwheels_{sd}', RR, RW, (RX, RR, s * RZ), s, R, 'gold' if Z else 'silver')
  # ---------------- tail box + rear fins ----------------
  loft('rbody__tail', [se_ring(x, y, hw, hh, n=4, N=16) for x, y, hw, hh in [(-1.8, .66, .3, .14), (-2.1, .66, .3, .14), (-2.36, .66, .29, .13)]], 'white', parent=R)
  loft('rbody__diffuser', [se_ring(x, y, hw, hh, n=3, N=16) for x, y, hw, hh in [(-1.8, .3, .28, .24), (-2.36, .3, .28, .24)]], 'black', parent=R)
  if Z:
    loft('rbody__tailband', [se_ring(x, .68, .305, .045, n=4, N=12) for x in (-2.0, -2.2, -2.375)], 'red', parent=R)
  for s, sd in ((1, 'L'), (-1, 'R')):
    slab(f'rbody__rfin_{sd}', [(-1.8, .05), (-2.42, .05), (-2.42, .88), (-2.2, .9), (-1.9, .8)], .03, 'white', z=s * .32, bevel=.012, parent=R)
  # ---------------- front aero ----------------
  if Z:
    half = [(2.44, 0), (2.02, .82), (1.95, 1.18), (1.42, 1.38), (1.43, .82), (1.2, 0)]
    pl = half + [(x, -z) for x, z in reversed(half[1:-1])]
    flat('fwing__plane', pl, .05, 'white', y=.12, bevel=.012, parent=R)
    flat('fwing__edge', [(x - .04, z) for x, z in pl], .055, 'blue', y=.09, parent=R)
    for s, sd in ((1, 'L'), (-1, 'R')):
      bl = [(2.62, .006, .04, .07), (2.38, .06, .02, .14), (2.08, .1, .01, .24), (1.8, .13, .02, .33), (1.58, .12, .03, .38), (1.52, .07, .05, .38)]
      rows = [[(x, b, 1.0 - w), (x, b, 1.0 + w), (x, t, 1.0 + w * .7), (x, t + .02, 1.0), (x, t, 1.0 - w * .7)] for x, w, b, t in bl]
      loft(f'fwing__blade_{sd}', mirror(rows, s), 'blue', lv=1, parent=R, creases={0: 1, 1: 1, 2: .7, 4: .7})
      rows = [[(x, t - .002, 1.0 - w * .72), (x, t - .002, 1.0 + w * .72), (x, t + .03, 1.0 + w * .5), (x, t + .035, 1.0), (x, t + .03, 1.0 - w * .5)] for x, w, b, t in bl[1:]]
      loft(f'fwing__bladetop_{sd}', mirror(rows, s), 'lblue', lv=1, parent=R)
      text_up(f'marks__pulse_{sd}', 'PULSE', AB, .16, 'blue', (1.7, .15, s * .5), yaw=math.radians(90), parent=R)
    text_up('marks__fw1', '1', TB, .18, 'red', (1.62, .15, -.02), yaw=math.radians(90), parent=R)
  else:
    for s, sd in ((1, 'L'), (-1, 'R')):
      rows = [[(x, b, z - w), (x, b, z + w), (x, t, z + w * .7), (x, t + .015, z), (x, t, z - w * .7)] for x, w, b, t, z in
              [(2.75, .01, .24, .26, .9), (2.4, .07, .26, .38, .95), (1.9, .1, .34, .52, 1.0), (1.3, .1, .4, .58, 1.02), (.9, .06, .4, .52, .98)]]
      loft(f'fangs_{sd}', mirror(rows, s), 'purple', lv=1, parent=R, creases={0: 1, 1: 1, 2: .6, 4: .6})
      join(f'fangs__rods_{sd}', [rod_between('fr', (1.6, .45, s * 1.0), (1.65, .36, s * .3), .02, 'grey'), rod_between('fr', (1.05, .45, s * 1.0), (1.0, .36, s * .3), .02, 'grey')], parent=R)
    half = [(2.5, 0), (2.36, .7), (2.2, 1.1), (1.92, 1.1), (2.0, .6), (2.14, 0)]
    flat('splitter', half + [(x, -z) for x, z in reversed(half[1:-1])], .045, 'purple', y=.1, bevel=.012, parent=R)
  # ---------------- rear: nacelles + fan wings (Asurada) / fins + wing (Ouga) ----------------
  for s, sd in ((1, 'L'), (-1, 'R')):
    cz = s * 1.15
    if Z:
      loft(f'nacelles__cowl_{sd}', [se_ring(x, y, r * .92, r, 2, cz, 20) for x, y, r in [(-.5, .82, .015), (-.62, .83, .09), (-.8, .85, .17), (-1.0, .88, .23), (-1.25, .9, .27), (-1.6, .9, .28)]], 'blue', parent=R)
      loft(f'nacelles__red_{sd}', [se_ring(x, .9, r, r, 2, cz, 20) for x, r in [(-1.6, .285), (-2.28, .285), (-2.5, .27)]], 'red', parent=R)
      cyl(f'nacelles__face_{sd}', .24, .02, 'black', loc=(-2.505, .9, cz), axis='x', verts=24).parent = R
      c = cyl(f'nacelles__cone_{sd}', .12, .34, 'silver', loc=(-2.64, .9, cz), axis='x', verts=24, r2=.085); c.parent = R
      cyl(f'nacelles__hole_{sd}', .06, .02, 'black', loc=(-2.81, .9, cz), axis='x', verts=16).parent = R
      loft(f'nacelles__base_{sd}', [se_ring(x, .78, w, .1, 2.2, cz, 16) for x, w in [(-.7, .02), (-.9, .12), (-1.4, .16), (-2.1, .16), (-2.4, .1), (-2.5, .02)]], 'blue', parent=R)
      for k in range(3):
        xc = -2.0 - k * .13
        pts = [(xc + .07, 1.01), (xc - .03, .9), (xc + .07, .79), (xc + .03, .79), (xc - .07, .9), (xc + .03, 1.01)]
        slab(f'marks__chev_{sd}{k}', pts, .02, 'white', z=s * (1.15 + .283), parent=R)
      # fan wing: swept blade above the nacelle, rising outward
      w = [(-1.0, s * .5), (-1.52, s * .5), (-2.32, s * 1.95), (-1.82, s * 1.95)]
      fw = flat(f'fw_{sd}', w, .034, 'blue', y=0, bevel=.014)
      top = flat(f'fwt_{sd}', [(x + .01, z) for x, z in w], .008, 'lblue', y=.02, bevel=.003)
      top.scale = (1, 1, 1)
      pyl = slab(f'fwp_{sd}', [(-1.3, -.3), (-1.8, -.3), (-1.74, 0), (-1.46, 0)], .03, 'blue', z=s * 1.15, bevel=.012)
      sun = text_up(f'fws_{sd}', 'SUNSET', AB, .13, 'yellow', (-1.72, .04, s * 1.22), yaw=math.atan2(1.43, .87) * (1 if s > 0 else -1) + (0 if s > 0 else math.pi))
      fwj = join(f'fanwings_{sd}', [fw, top, pyl, sun], origin=(-1.55, 0, s * 1.15))
      fwj.location = P(-1.55, 1.2, s * 1.15)
      fwj.rotation_euler = (math.radians(-5 * s), 0, 0)
      fwj.parent = R
    else:
      slab(f'fins_{sd}', [(-1.0, .9), (-1.55, .9), (-2.3, 1.62), (-2.5, 1.64), (-2.05, 1.18)], .05, 'purple', z=s * .82, bevel=.012, parent=R)
      bolt = [(-1.62, 1.36), (-1.84, 1.06), (-1.72, 1.06), (-1.9, .9), (-1.58, 1.16), (-1.7, 1.16), (-1.5, 1.36)]
      slab(f'marks__bolt_{sd}', bolt, .01, 'green', z=s * .85, parent=R)
      for k in range(3):
        v = slab(f'rbody__vent_{sd}{k}', [(-1.0 - k * .26, 0), (-1.2 - k * .26, 0), (-1.24 - k * .26, .025), (-1.04 - k * .26, .025)], .12, 'black', z=s * (1.3 - k * .03), parent=R)
        v.location = P(0, .93 - k * .005, 0)
  if not Z:
    half = [(-1.9, 0), (-2.1, .95), (-2.5, .95), (-2.3, 0)]
    flat('rwing', half + [(x, -z) for x, z in reversed(half[1:-1])], .05, 'purple', y=1.52, bevel=.012, parent=R)
  # ---------------- cockpit interior: dark well under the canopy, seat, seated driver ----------------
  well = [(1.5, .03), (1.3, .12), (1.0, .2), (.7, .24), (.4, .24), (.18, .16)]
  flat('canopy__well', [(x, w) for x, w in well] + [(x, -w) for x, w in reversed(well)], .01, 'black', y=.515, parent=R)
  loft('driver__seat', [se_ring(x, y, w, h, 3, 0, 14) for x, y, w, h in [(.12, .66, .02, .02), (.16, .66, .17, .14), (.24, .6, .18, .1), (.3, .56, .17, .05)]], 'black', parent=R)
  suit = 'blue' if Z else 'purple'
  loft('driver__body', [se_ring(x, y, w, h, 2.4, 0, 16) for x, y, w, h in [(.2, .5, .1, .06), (.26, .54, .19, .09), (.38, .54, .2, .08), (.62, .5, .15, .06), (.95, .46, .1, .05)]], suit, parent=R)
  helm = bpy.data.objects.new('driver__helmet', bpy.data.meshes.new('h')); bm = bmesh.new()
  bmesh.ops.create_uvsphere(bm, u_segments=32, v_segments=20, radius=1); bm.to_mesh(helm.data); bm.free()
  for pl in helm.data.polygons: pl.use_smooth = True
  link(helm, R); helm.data.materials.append(M('white')); helm.scale = (.15, .125, .14); helm.location = P(.34, .68, 0)
  vis = bpy.data.objects.new('driver__visor', bpy.data.meshes.new('v')); bm = bmesh.new()
  bmesh.ops.create_uvsphere(bm, u_segments=24, v_segments=14, radius=1); bm.to_mesh(vis.data); bm.free()
  for pl in vis.data.polygons: pl.use_smooth = True
  link(vis, R); vis.data.materials.append(M('black')); vis.scale = (.1, .1, .055); vis.location = P(.42, .69, 0)
  for x0, col in ((.34, 'red' if Z else 'purple'), (.3, 'blue' if Z else 'magenta')):
    bpy.ops.mesh.primitive_torus_add(major_radius=1, minor_radius=.07, major_segments=40, minor_segments=8)
    t = bpy.context.active_object; t.name = 'driver__band'; t.data.materials.append(M(col))
    for pl in t.data.polygons: pl.use_smooth = True
    t.scale = (1, 1, 1); t.rotation_euler = (0, math.radians(90), 0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    k = (1 - ((x0 - .34) / .15) ** 2) ** .5
    t.scale = (.02 / .07, .143 * k, .128 * k); t.location = P(x0, .68, 0)
    t.parent = R
  for sd, s in (('L', 1), ('R', -1)):
    arm = [rod_between('a1', (.3, .56, s * .17), (.5, .5, s * .19), .035, suit), rod_between('a2', (.5, .5, s * .19), (.7, .56, s * .09), .03, suit)]
    glove = cyl('g', .035, .06, 'black', loc=(.7, .56, s * .09), axis='z', verts=12)
    join(f'driver__arm_{sd}', arm + [glove], parent=R)
  # ---------------- decals ----------------
  if Z:
    for s, sd in ((1, 'L'), (-1, 'R')):
      text_decal(f'marks__S_{sd}', 'S', AB, .44, 'red', (-.3, .72, s * .3), sd, shear=.25, target=hmp, parent=R)
      text_decal(f'marks__one_{sd}', '1', TB, .38, 'red', (-.95, .5, s * 1.56), sd, parent=R)
      text_decal(f'marks__kazami_{sd}', 'H.KAZAMI', AB, .07, 'black', (.05, .56, s * .3), sd, target=hmp, parent=R)
  return nose

def car(name, Z):
  root = bpy.data.objects.new(name, None); link(root)
  build(root, Z)
  return root

roots = {'zenith': car('car_zenith', True), 'ouga': car('car_ouga', False)}
for ob in list(COL.objects):
  if ob.type == 'MESH' and ob.modifiers: apply_all(ob)

# ---------------- renders: transparent overlays at matched cameras + preview views ----------------
CAMS = {}
def add_cam(key, loc, tgt, lens, shift=(0, 0), roll=0.0, res=(1920, 1082)):
  CAMS[key] = (loc, tgt, lens, shift, roll, res)

def render_cams(prefix, keys):
  scene.render.engine = 'BLENDER_WORKBENCH'
  sh = scene.display.shading
  sh.light = 'STUDIO'; sh.color_type = 'MATERIAL'; sh.show_object_outline = True
  scene.render.film_transparent = True
  for k in keys:
    loc, tgt, lens, shift, roll, res = CAMS[k]
    scene.render.resolution_x, scene.render.resolution_y = res
    cd = bpy.data.cameras.new(k); cam = bpy.data.objects.new(k, cd); link(cam)
    cam.location = P(*loc); d = P(*tgt) - P(*loc)
    cam.rotation_mode = 'QUATERNION'; q = d.to_track_quat('-Z', 'Y')
    if roll: q = q @ Matrix.Rotation(roll, 4, 'Z').to_quaternion()
    cam.rotation_quaternion = q
    cd.lens = lens; cd.shift_x, cd.shift_y = shift; cd.sensor_width = 36; cd.clip_end = 1000
    scene.camera = cam
    scene.render.filepath = os.path.join(OUT, f'{prefix}_{k}.png')
    bpy.ops.render.render(write_still=True)

if os.path.exists(os.path.join(os.getcwd(), 'cams.py')): exec(open(os.path.join(os.getcwd(), 'cams.py')).read())

def show_only(key):
  for k, r in roots.items():
    for o in [r] + list(r.children_recursive): o.hide_render = (k != key)
if RENDER:
  show_only('zenith'); render_cams('a', [k for k in CAMS if not k.startswith('o_')])
  show_only('ouga'); render_cams('o', [k for k in CAMS if k.startswith('o_')])
  for r in roots.values():
    for o in [r] + list(r.children_recursive): o.hide_render = False
if EXPORT:
  bpy.ops.export_scene.gltf(filepath=EXPORT, export_format='GLB', export_apply=True, export_yup=True, export_texcoords=False,
                            export_normals=True, export_materials='EXPORT', export_cameras=False, export_lights=False)
print('DONE')
