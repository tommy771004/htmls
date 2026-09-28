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
  'carbon': (0.09, 0.095, 0.1), 'lamp': (1.0, 0.06, 0.05), 'gold': (0.62, 0.40, 0.15), 'glass': (0.05, 0.12, 0.6), 'yellow': (0.95, 0.62, 0.02), 'black': (0.012, 0.012, 0.014),
})

RX, RR, RW, RZ = -1.68, .33, .56, 1.27        # rear wheels
FXS, FR, FW, FZ = (1.22, .70), .25, .26, 1.25  # front wheels (a touch further back: the endplates sit right in front of them)

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
  # tyre: lathed ring (open centre) so the rim shows through
  ri, b = r * .68, min(.06, w * .2)
  prof = [(ri, -w / 2 + .01), (r - b, -w / 2), (r - b * .3, -w / 2 + b * .3), (r, -w / 2 + b), (r, w / 2 - b), (r - b * .3, w / 2 - b * .3), (r - b, w / 2), (ri, w / 2 - .01)]
  N = 48; verts = []; faces = []
  for i in range(N):
    a0 = i / N * math.tau
    for rr, zz in prof: verts.append((rr * math.cos(a0), rr * math.sin(a0), zz))
  m = len(prof)
  for i in range(N):
    for j in range(m):
      a_, b_ = i * m + j, i * m + (j + 1) % m; i2 = (i + 1) % N
      faces.append((a_, b_, i2 * m + (j + 1) % m, i2 * m + j))
  me = bpy.data.meshes.new(name + '_t'); me.from_pydata([P(*v) for v in verts], [], faces); me.update()
  t = bpy.data.objects.new(name + '_t', me); t.data.materials.append(M('black')); link(t)
  for pl in me.polygons: pl.use_smooth = True
  obs.append(t)
  dish = cyl(name + '_d', r * .67, w * .5, 'black', axis='z', verts=32)
  obs.append(dish)
  # rim lip: an open ring (a capped cylinder here would hide the spokes)
  lp = [(r * .6, -w * .05), (r * .675, -w * .05), (r * .675, w * .05), (r * .6, w * .05)]; N2 = 48; lv, lf = [], []
  for i in range(N2):
    a0 = i / N2 * math.tau
    for rr, zz in lp: lv.append((rr * math.cos(a0), rr * math.sin(a0), zz + side * w * .42))
  for i in range(N2):
    for j in range(4):
      i2 = (i + 1) % N2; lf.append((i * 4 + j, i * 4 + (j + 1) % 4, i2 * 4 + (j + 1) % 4, i2 * 4 + j))
  mel = bpy.data.meshes.new(name + '_lip'); mel.from_pydata([P(*v) for v in lv], [], lf); mel.update()
  lob = bpy.data.objects.new(name + '_lip', mel); lob.data.materials.append(M(rim)); link(lob)
  for pl in mel.polygons: pl.use_smooth = True
  obs.append(lob)
  obs.append(cyl(name + '_bar', r * .64, w * .62, 'black', loc=(0, 0, side * w * .08), axis='z', verts=32))
  for k in range(8):
    a = k / 8 * math.tau
    sp = slab(name + f'_sp{k}', [(r * .13, -r * .045), (r * .645, -r * .03), (r * .645, r * .03), (r * .13, r * .045)], w * .07, rim, z=side * w * .43, bevel=.003)
    sp.rotation_euler = (0, -a, 0); obs.append(sp)
  obs.append(cyl(name + '_hub', r * .15, w * .96, rim, axis='z', verts=16))
  ob = join(name, obs)
  ob.location = P(*loc); ob.parent = root
  return ob

def arm_tube(name, a, b, bow, rw, rh, mat, n=12, seg=10):
  """flattened tube along a quadratic curve from a to b, mid-point pushed by `bow`; slightly fatter at the ends"""
  a, b = Vector(a), Vector(b); c = (a + b) / 2 + Vector(bow)
  rings = []
  for i in range(n + 1):
    t = i / n; p = (1 - t) ** 2 * a + 2 * (1 - t) * t * c + t * t * b
    d = (2 * (1 - t) * (c - a) + 2 * t * (b - c)).normalized()
    side = d.cross(Vector((0, 1, 0)))
    if side.length < 1e-4: side = Vector((1, 0, 0))
    side.normalize(); up = side.cross(d).normalized()
    k = 1 + .35 * abs(2 * t - 1) ** 3
    rings.append([tuple(p + side * math.cos(j / seg * math.tau) * rw * k + up * math.sin(j / seg * math.tau) * rh * k) for j in range(seg)])
  return loft(name, rings, mat, lv=1)

def sweep_loop(name, pts, rw, rh, mat, seg=8, parent=None):
  """flattened tube along a closed polyline (page coords)"""
  n = len(pts); P3 = [Vector(p) for p in pts]; rings = []
  for i in range(n):
    d = (P3[(i + 1) % n] - P3[i - 1]).normalized()
    side = d.cross(Vector((0, 1, 0))).normalized(); up = side.cross(d).normalized()
    rings.append([tuple(P3[i] + side * math.cos(j / seg * math.tau) * rw + up * math.sin(j / seg * math.tau) * rh) for j in range(seg)])
  verts = [v for r in rings for v in r]; faces = []
  for i in range(n):
    for j in range(seg):
      a, b = i * seg + j, i * seg + (j + 1) % seg; i2 = (i + 1) % n
      faces.append((a, b, i2 * seg + (j + 1) % seg, i2 * seg + j))
  ob = mesh_from(name, verts, faces, mat, parent=parent)
  return subsurf(ob, 1)

def harden(ob, deg=32):
  """mark edges sharper than `deg` so the exported normals split there (crisp panel lines)"""
  me = ob.data; bm = bmesh.new(); bm.from_mesh(me)
  lim = math.radians(deg)
  for e in bm.edges:
    if len(e.link_faces) == 2 and e.calc_face_angle(0) > lim: e.smooth = False
  for f in bm.faces: f.smooth = True
  bm.to_mesh(me); bm.free()

def cover_top_fn(st):
  """y of the aero front-cover top surface at (x, |z|); follows the loft's faceted top exactly"""
  def prof(r):
    x, zi, zo, yb, yt = r; zr = zi + (zo - zi) * .38
    return [(zi, yt - .03), (zr, yt), (zo - .1, yt - .015), (zo, yt - .07)]
  def f(x, z):
    x = min(max(x, st[-1][0]), st[0][0])
    for i in range(len(st) - 1):
      if st[i][0] >= x >= st[i + 1][0]: break
    t = (st[i][0] - x) / (st[i][0] - st[i + 1][0] or 1)
    pa, pb = prof(st[i]), prof(st[i + 1])
    pr = [(za + (zb - za) * t, ya + (yb - ya) * t) for (za, ya), (zb, yb) in zip(pa, pb)]
    if z <= pr[0][0]: return pr[0][1]
    for (z0, y0), (z1, y1) in zip(pr, pr[1:]):
      if z <= z1: return y0 + (y1 - y0) * (z - z0) / ((z1 - z0) or 1)
    return pr[-1][1]
  return f

def densify(poly, step=.04, closed=True):
  out = []; n = len(poly)
  for i in range(n if closed else n - 1):
    (x0, z0), (x1, z1) = poly[i], poly[(i + 1) % n]
    k = max(1, int(math.hypot(x1 - x0, z1 - z0) / step))
    out += [(x0 + (x1 - x0) * j / k, z0 + (z1 - z0) * j / k) for j in range(k)]
  return out

def hug_plate(name, top, outer, inner, lift, thick, mat, s, parent=None):
  """plate that follows the cover top: `outer` (x,z) polygon, optional `inner` hole with the same vertex count"""
  O = densify(outer)
  if inner is None:
    cx = sum(p[0] for p in O) / len(O); cz = sum(p[1] for p in O) / len(O)
    I = [(cx + (x - cx) * .02, cz + (z - cz) * .02) for x, z in O]
  else:
    I = densify(inner)
    if len(I) != len(O):  # resample the hole to the same count
      I = [I[int(i * len(I) / len(O))] for i in range(len(O))]
  n = len(O); V = []
  for ring in (O, I):
    for x, z in ring:
      y = top(x, z); V.append((x, y + lift + thick, s * z)); V.append((x, y - .03, s * z))  # bottom buried in the shell: no gaps
  def v(r, i, up): return (r * n + i % n) * 2 + (0 if up else 1)
  F = []
  for i in range(n):
    F.append((v(0, i, 1), v(0, i + 1, 1), v(1, i + 1, 1), v(1, i, 1)))    # top
    F.append((v(0, i, 0), v(1, i, 0), v(1, i + 1, 0), v(0, i + 1, 0)))    # bottom
    F.append((v(0, i, 0), v(0, i + 1, 0), v(0, i + 1, 1), v(0, i, 1)))    # outer wall
    if inner is not None: F.append((v(1, i, 0), v(1, i, 1), v(1, i + 1, 1), v(1, i + 1, 0)))  # inner wall
  ob = mesh_from(name, V, F, mat, smooth=False, parent=parent)
  return ob

def wishbone(pre, up_pt, inner_front, inner_rear, rw, rh):
  """A-arm: two curved carbon tubes meeting at the upright"""
  u = Vector(up_pt)
  return [arm_tube(pre, u, Vector(inner_front), (0, .03, 0), rw, rh, 'carbon'),
          arm_tube(pre, u, Vector(inner_rear), (0, .03, 0), rw, rh, 'carbon')]

def rod_between(name, a, b, r, mat):
  a, b = Vector(a), Vector(b); d = b - a
  c = cyl(name, r, d.length, mat, axis='y', verts=8)
  c.location = P(*((a + b) / 2))
  c.rotation_mode = 'QUATERNION'; c.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(P(*d).normalized())
  return c

PZ = {}
TUB = [(2.4, .25, .03, .02), (2.24, .3, .14, .08), (2.02, .345, .24, .12), (1.78, .37, .31, .14), (1.45, .36, .33, .16), (1.0, .34, .33, .17),
       (.5, .34, .33, .18), (0, .35, .33, .19), (-.6, .37, .32, .2), (-1.3, .4, .3, .22), (-2.0, .42, .3, .24), (-2.38, .43, .25, .2)]
TUB0 = [(2.34, .32, .03, .02), (2.22, .34, .14, .07), (2.02, .36, .24, .11)] + TUB[3:]
SHIELD = [(0, -1), (.5, -.6), (1, .02), (.8, .6), (.38, .93), (0, 1)]      # (z/hw, dy/hh), keel -> ridge
ROUND = [(0, -1), (.78, -.95), (1, -.3), (1, .42), (.74, .94), (0, 1)]
def shield_t(x): return min(1, max(0, (x - .3) / .9))
def nose_half(x, y, hw, hh):
  t = shield_t(x)
  return [((a * t + c * (1 - t)) * hw, y + (b * t + d * (1 - t)) * hh) for (a, b), (c, d) in zip(SHIELD, ROUND)]
def nose_ring(x, y, hw, hh):
  h = nose_half(x, y, hw, hh)
  return [(x, yy, zz) for zz, yy in h] + [(x, yy, -zz) for zz, yy in reversed(h[1:-1])]
def tub_at(x):
  for a, b in zip(TUB, TUB[1:]):
    if a[0] >= x >= b[0]:
      t = (a[0] - x) / (a[0] - b[0]); return tuple(p + (q - p) * t for p, q in zip(a, b))
  return TUB[0] if x > TUB[0][0] else TUB[-1]
def cheek_pt(x, u, s, off=.012):
  """point on the facet between the chine (u=0) and the next shield vertex up (u=1), pushed `off` outward"""
  h = nose_half(*tub_at(x)); (z0, y0), (z1, y1) = h[2], h[3]
  z, y = z0 + (z1 - z0) * u, y0 + (y1 - y0) * u
  nz, ny = (y1 - y0), -(z1 - z0); L = math.hypot(nz, ny); nz, ny = nz / L, ny / L
  return (x, y + ny * off, s * (z + nz * off))
AZ = lambda z: z if z < .3 else .3 + (z - .3) * 1.24   # widening map for the front section (inner edge at the nose unchanged)
WZ = lambda poly: [(x, AZ(z)) for x, z in poly]
def build(root, Z):
  A = 'blue' if Z else 'purple'; L = 'lblue' if Z else 'magenta'; R = root
  # ---------------- tub + nose (one loft, nose tip -> tail) ----------------
  tub = TUB if Z else TUB0
  # section: a downward-pointing shield at the nose (keel, chine, sloping cheeks, ridge on top) morphing into the rounded tub
  if Z:
    nose = loft('nose', [nose_ring(*r) for r in tub], 'white', parent=R, creases={0: .85, 2: .95, 5: .6, 8: .95})
    # blue keel below the chines
    band = []
    for x, y, hw, hh in tub[:8]:
      rg = nose_ring(x, y, hw * 1.012, hh * 1.012); yc = (rg[2][1] + rg[8][1]) / 2 - .012
      band.append([(px, min(py, yc) - .004, pz * (1 if py < yc else .9)) for px, py, pz in rg])
    loft('nose__band', band, A, parent=R, creases={0: .85, 2: .95, 8: .95})
  else:  # Ouga keeps its flat, rounded nose
    nose = loft('nose', [se_ring(x, y, hw, hh, n=2.8, N=18) for x, y, hw, hh in tub], 'purple', parent=R)
    loft('nose__band', [se_ring(x, y - hh * .72, hw * 1.02, hh * .3, n=3, N=14) for x, y, hw, hh in tub[1:7]], A, parent=R)
  if Z:  # yellow triangles on the cheeks just above the chines, pointing at the nose tip
    for s, sd in ((1, 'L'), (-1, 'R')):
      tri = [cheek_pt(2.06, .06, s), cheek_pt(1.5, .06, s), cheek_pt(1.5, .72, s)]
      mesh_from(f'nose__lamp_{sd}', tri + [(x, y, z) for x, y, z in (cheek_pt(2.06, .06, s, -.01), cheek_pt(1.5, .06, s, -.01), cheek_pt(1.5, .72, s, -.01))],
                [(0, 1, 2), (5, 4, 3), (0, 3, 4, 1), (1, 4, 5, 2), (2, 5, 3, 0)], 'yellow', smooth=False, parent=R)
  else:
    flat('marks__tri', [(2.05, 0), (1.75, .1), (1.75, -.1)], .01, 'green', y=.51, parent=R)
  # ---------------- canopy ----------------
  can = [(1.98, .445, .02, .01), (1.82, .485, .085, .035), (1.6, .535, .15, .065), (1.36, .59, .2, .09), (1.12, .64, .24, .11)] if Z else \
        [(1.58, .47, .02, .01), (1.4, .53, .14, .06), (1.15, .61, .22, .1)]
  can += [(.85, .68, .26, .13), (.55, .72, .27, .14), (.3, .74, .25, .12), (.14, .74, .16, .08)]
  loft('canopy', [se_ring(x, y, hw, hh, n=2.3, N=18) for x, y, hw, hh in can], 'glass', parent=R)
  # cockpit tub: U-channel walls between the nose and the canopy edge; the top edge is the white sill line
  def sill(x, hw, cy, k=1.0):
    W, Wi, yt, yf, yb = hw * 1.08 * k, hw * .86 * k, cy - .012, .505, .36
    return [(x, yb, -W), (x, yb, W), (x, yt - .02, W), (x, yt, W - .015), (x, yt, Wi), (x, yf, Wi), (x, yf, -Wi), (x, yt, -Wi), (x, yt, -W + .015), (x, yt - .02, -W)]
  sl = [sill(x, max(hw, .03), y, 1) for x, y, hw, hh in can[1:]]
  loft('nose__sill', sl, 'white' if Z else 'purple', lv=2, parent=R, creases={i: .95 for i in range(10)})
  loft('canopy__collar', [se_ring(x, y, w, h, 2.4, 0, 18) for x, y, w, h in [(.26, .73, .24, .1), (.2, .735, .23, .105), (.12, .73, .2, .1)]], 'blue' if Z else 'purple', lv=1, parent=R)
  # ---------------- engine hump behind the canopy + antenna ----------------
  hump = [(.32, .56, .2, .12, .5), (.15, .66, .28, .24, .45), (-.15, .7, .31, .26, .45), (-.5, .68, .31, .24, .4), (-.85, .63, .29, .18, .35), (-1.15, .6, .26, .13, .3)]
  def hsec(x, y, hw, hh, tp):
    yb, yt = y - hh, y + hh; ws = hw * (1 - tp * .55)
    return [(x, yb, hw * .8), (x, y - hh * .2, hw), (x, yt - hh * .35, ws + (hw - ws) * .35), (x, yt - .02, ws * .45), (x, yt, 0),
            (x, yt - .02, -ws * .45), (x, yt - hh * .35, -ws - (hw - ws) * .35), (x, y - hh * .2, -hw), (x, yb, -hw * .8)]
  hmp = loft('rbody__hump', [hsec(*h) for h in hump], 'white', lv=2, parent=R, creases={1: .9, 2: .95, 4: .8, 6: .95, 7: .9})
  # centre spine from the hump back to the arch wing
  loft('rbody__spine', [[(x, y - h, w), (x, y, w), (x, y + h, 0), (x, y, -w), (x, y - h, -w)] for x, y, w, h in
        [(-.95, .66, .12, .1), (-1.3, .76, .1, .1), (-1.7, .84, .08, .09), (-1.96, .9, .05, .07), (-2.04, .92, .02, .03)]], 'white', lv=2, parent=R, creases={0: 1, 1: .9, 2: .95, 3: .9, 4: 1})
  if Z:
    slab('rbody__antenna', [(.1, .9), (-.1, .92), (-.33, 1.25), (-.27, 1.25)], .03, 'white', bevel=.008, parent=R)
  # ---------------- bridge arms + deck (per side) ----------------
  arms = [(.12, .3, .34, .62, .72), (-.1, .3, .62, .56, .76), (-.35, .3, 1.0, .52, .79), (-.56, .3, 1.28, .54, .82),
          (-.8, .3, 1.46, .6, .84), (-1.2, .3, 1.5, .7, .85), (-1.75, .3, 1.5, .72, .85), (-2.1, .3, 1.46, .72, .84), (-2.3, .3, 1.38, .72, .82)]
  for s, sd in ((1, 'L'), (-1, 'R')):
    # the arm is a shell riding above the side pod: its underside stays clear of the pod (open, dark gap between them)
    def arm_ring(x, zi, zo, yb, yt):
      r = quad_ring(x, zi, zo, yb, yt, bev=.05, drop=(.12 if x > -1.0 else .04))
      if x > -1.3:
        ybo, ybi = (.64, .5) if x > -1.0 else (.62, .52)
        r[0] = (x, ybi, zi); r[1] = (x, ybo, zo)
      return r
    rows = [arm_ring(*a) for a in arms]
    loft(f'rbody__arm_{sd}', mirror(rows, s), 'white', lv=2, parent=R, creases={0: 1, 1: 1, 2: .95, 3: .95, 4: .85, 5: .95})
    # blue band across the rear of the deck (PULSE band)
    bp = [(-1.02, .3), (-1.5, 1.46), (-2.26, 1.4), (-2.26, .3)]
    flat(f'rbody__band_{sd}', [(x, s * z) for x, z in bp], .026, A, y=.858, bevel=.008, parent=R)
    flat(f'rbody__bandl_{sd}', [(x, s * z) for x, z in [(-1.02, .3), (-1.12, .3), (-1.58, 1.4), (-1.5, 1.46)]], .03, 'lblue', y=.86, bevel=.006, parent=R)
    # ---------------- rear fender: one smooth shell (front pillar, arch, tail), wheel arch cut out ----------------
    def fring(x, yb, yt, zi, zo):
      ym, zm = (yb + yt) / 2, (zi + zo) / 2
      return [(x, yb, zi), (x, yb, zm), (x, yb, zo), (x, ym, zo), (x, yt, zo), (x, yt, zm), (x, yt, zi), (x, ym, zi)]
    fr = [(-.46, .06, .26, 1.14, 1.42), (-.54, .03, .5, 1.07, 1.5), (-.7, .03, .78, 1.03, 1.54), (-1.0, .03, .86, 1.0, 1.55),
          (-1.5, .03, .86, .95, 1.55), (-2.0, .06, .86, .95, 1.55), (-2.12, .12, .85, 1.5, 1.6), (-2.3, .3, .83, 1.5, 1.585), (-2.46, .5, .8, 1.5, 1.565)]
    fender = loft(f'rbody__fender_{sd}', mirror([fring(*r) for r in fr], s), 'white', lv=0, parent=R, creases={0: .95, 1: .95, 2: .95, 3: .95, 4: .95, 5: .95, 6: .95, 7: .95})
    subsurf(fender, 2); apply_all(fender)
    cut = cyl('cut', .4, 1.2, 'black', loc=(RX, RR, s * 1.25), axis='z', verts=64)
    boolean_cut(fender, cut); bpy.data.objects.remove(cut, do_unlink=True)
    # open the space behind the wheel (seen from the rear only a thin outer fin remains)
    bpy.ops.mesh.primitive_cube_add(size=1)
    box = bpy.context.active_object; box.scale = (.9, .57, .72); box.location = P(-2.28, .33, s * 1.235)
    boolean_cut(fender, box); bpy.data.objects.remove(box, do_unlink=True)
    # blue lower band on the pillar and the tail (the "Jupiter" / skirt stripe)
    bb = [(-.5, .05, .17, 1.1, 1.46), (-.56, .02, .2, 1.05, 1.52), (-.7, .02, .2, 1.02, 1.555), (-1.1, .02, .2, .985, 1.555), (-1.28, .02, .2, .96, 1.54)]
    loft(f'rbody__foot_{sd}', mirror([fring(x, yb, yt, zi - .006, zo + .006) for x, yb, yt, zi, zo in bb], s), A, lv=2, parent=R, creases={0: .95, 1: .95, 2: .95, 3: .95, 4: .95, 5: .95, 6: .95, 7: .95})
    zmax = max(abs(v.co.y) for v in fender.data.vertices if -1.25 < v.co.x < -.62 and .3 < v.co.z < .7)
    slab(f'rbody__panel_{sd}', [(-.66, .24), (-1.22, .24), (-1.22, .74), (-.74, .76), (-.62, .5)], .024, 'white', z=s * (zmax + .004), bevel=.008, parent=R)
    PZ[sd] = zmax + .02
    tb = [(-2.0, .06, .2, .945, 1.556), (-2.12, .11, .25, 1.495, 1.606), (-2.3, .29, .41, 1.495, 1.591), (-2.46, .49, .57, 1.495, 1.571)]
    loft(f'rbody__skirt_{sd}', mirror([fring(*r) for r in tb], s), A, lv=2, parent=R, creases={0: .95, 1: .95, 2: .95, 3: .95, 4: .95, 5: .95, 6: .95, 7: .95})
    # ---------------- side pod ----------------
    pod = [(.47, .4, .04, .05), (.42, .4, .15, .17), (.27, .4, .18, .2), (-.4, .4, .18, .2), (-.85, .38, .16, .18), (-1.0, .36, .05, .06)]
    loft(f'pods_{sd}', [se_ring(x, y - .02, hw * .95, hh * .92, n=2.2, N=16, cz=s * .74) for x, y, hw, hh in pod], 'white' if Z else 'white', parent=R)
    loft(f'pods__low_{sd}', [se_ring(x, y - .02 - hh * .5, hw * .98, hh * .44, n=2.2, N=14, cz=s * .74) for x, y, hw, hh in pod[1:5]], A, parent=R)
    ring = bpy.data.objects.new(f'pods__ring_{sd}', bpy.data.meshes.new('r'))
    bm = bmesh.new(); bmesh.ops.create_cone(bm, cap_ends=False, segments=48, radius1=.18, radius2=.145, depth=.09); bm.to_mesh(ring.data); bm.free()
    for pl in ring.data.polygons: pl.use_smooth = True
    link(ring, R); ring.data.materials.append(M(L)); ring.rotation_euler = (0, math.radians(90), 0); ring.location = P(.45, .38, s * .74)
    sol = ring.modifiers.new('so', 'SOLIDIFY'); sol.thickness = .03
    subsurf(ring, 1)
    cyl(f'pods__mouth_{sd}', .145, .02, 'black', loc=(.43, .38, s * .74), axis='x', verts=24).parent = R
    for k in range(3):
      x0 = -.52 - k * .13
      slab(f'pods__gill_{sd}{k}', [(x0, .3), (x0 - .045, .3), (x0 - .01, .5), (x0 + .035, .5)], .04, 'black', z=s * .9, parent=R)
    slab(f'nose__intake_{sd}', [(.72, .43), (.42, .45), (.42, .52), (.62, .5)], .03, 'black', z=s * .325, parent=R)
    slab(f'nose__intakelip_{sd}', [(.74, .42), (.4, .44), (.4, .455), (.74, .435)], .034, 'lblue', z=s * .325, parent=R)
    flat(f'rbody__vent_{sd}', [(-1.96, s * .3), (-2.03, s * .3), (-2.08, s * 1.02), (-2.01, s * 1.02)], .012, 'black', y=.876, parent=R)
    # dark chassis side seen through the gap between the side pod and the arm above it (radiator bay)
    slab(f'rbody__bay_{sd}', [(.3, .1), (-1.2, .1), (-1.2, .66), (-.2, .66), (.3, .62)], .02, 'carbon', z=s * .35, parent=R)
    # ---------------- front suspension ----------------
    rods = []
    zc = s * (FZ - .17)
    def truss(apex, b1, b2, w, h):
      """A-arm with X bracing between the legs (lattice arm from the post)"""
      A, B1, B2 = Vector(apex), Vector(b1), Vector(b2); m1, m2 = (A + B1) / 2, (A + B2) / 2
      return [arm_tube('tr', A, B1, (0, 0, 0), w, h, 'carbon', n=4, seg=6), arm_tube('tr', A, B2, (0, 0, 0), w, h, 'carbon', n=4, seg=6),
              arm_tube('tr', m1, B2, (0, 0, 0), w * .7, h * .8, 'carbon', n=4, seg=6), arm_tube('tr', m2, B1, (0, 0, 0), w * .7, h * .8, 'carbon', n=4, seg=6)]
    for x in FXS:
      rods += truss((x, FR + .06, zc), (x + .2, .42, s * .3), (x - .2, .42, s * .3), .024, .012)
      rods += truss((x, FR - .06, zc), (x + .18, .24, s * .3), (x - .18, .24, s * .3), .022, .011)
      rods.append(arm_tube('push', (x - .03, FR - .05, zc), (x - .13, .44, s * .32), (0, 0, 0), .011, .011, 'silver'))
      # brake fairing: black dome over the caliper and disc, with a small cooling inlet
      rods.append(cyl('brk', .15, .09, 'black', loc=(x, FR, s * (FZ - .14)), axis='z', verts=28, r2=.1))
      rods.append(cyl('duct', .03, .05, 'grey', loc=(x + .1, FR - .06, s * (FZ - .17)), axis='x', verts=12))
    join(f'fwheels__susp_{sd}', rods, parent=R)
    rods = []
    zu = s * (RZ - .3)
    rods += truss((RX, RR + .09, zu), (RX + .26, .52, s * .32), (RX - .22, .52, s * .32), .03, .015)
    rods += truss((RX, RR - .09, zu), (RX + .22, .26, s * .32), (RX - .2, .26, s * .32), .028, .014)
    rods.append(arm_tube('drive', (RX, RR, zu), (RX, RR + .02, s * .3), (0, 0, 0), .03, .03, 'grey'))
    rods.append(arm_tube('push', (RX + .04, RR - .08, zu), (RX - .1, .6, s * .34), (0, 0, 0), .012, .012, 'silver'))
    rods.append(cyl('rup', .09, .12, 'grey', loc=(RX, RR, s * (RZ - .31)), axis='z', verts=20))
    join(f'rwheels__susp_{sd}', rods, parent=R)
    # ---------------- wheels ----------------
    for i, x in enumerate(FXS): wheel2(f'fwheels_{sd}{i}', FR, FW, (x, FR, s * FZ), s, R, 'gold' if Z else 'silver')
    wheel2(f'rwheels_{sd}', RR, RW, (RX, RR, s * RZ), s, R, 'gold' if Z else 'silver')
  # ---------------- tail box + rear fins ----------------
  loft('rbody__tail', [se_ring(x, y, hw, hh, n=4, N=16) for x, y, hw, hh in [(-1.8, .66, .3, .14), (-2.1, .66, .3, .14), (-2.36, .66, .29, .13)]], 'white', parent=R)
  loft('rbody__diffuser', [se_ring(x, y, hw, hh, n=3, N=16) for x, y, hw, hh in [(-1.8, .4, .28, .16), (-2.36, .4, .28, .16)]], 'black', parent=R)
  # ground-effect floor: flat carbon underbody, venturi edges, and a diffuser ramp with strakes at the tail
  flat('rbody__floor', [(1.3, .2), (.6, .42), (-.4, .5), (-1.7, .42), (-1.7, -.42), (-.4, -.5), (.6, -.42), (1.3, -.2)], .025, 'carbon', y=.055, bevel=.006, parent=R)
  ramp = mesh_from('rbody__ramp', [(-1.7, .07, .42), (-1.7, .07, -.42), (-2.44, .26, -.36), (-2.44, .26, .36), (-1.7, .05, .42), (-1.7, .05, -.42), (-2.44, .24, -.36), (-2.44, .24, .36)],
                   [(0, 1, 2, 3), (7, 6, 5, 4), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)], 'carbon', smooth=False, parent=R)
  for z in (-.24, -.08, .08, .24):
    slab('rbody__strake', [(-1.8, .075), (-2.44, .26), (-2.44, .17), (-2.1, .1)], .014, 'black', z=z, parent=R)
  # crash structure: a tapered gunmetal box under the tail band, two small oval cooling holes
  loft('rbody__crash', [[(x, y - h, -w * .8), (x, y - h, w * .8), (x, y + h, w), (x, y + h, -w)] for x, w, h, y in [(-2.3, .23, .15, .44), (-2.46, .21, .14, .44), (-2.52, .17, .12, .45)]],
       'grey', lv=0, parent=R)
  for z in (-.075, .075):
    o = cyl('rbody__crashvent', .045, .02, 'black', loc=(-2.525, .46, z), axis='x', verts=20); o.scale = (1, .7, 1.2); o.parent = R
  if Z:
    loft('rbody__tailband', [se_ring(x, .68, .305, .045, n=4, N=12) for x in (-2.0, -2.2, -2.375)], 'red', parent=R)
  for s, sd in ((1, 'L'), (-1, 'R')):
    slab(f'rbody__rfin_{sd}', [(-1.8, .05), (-2.42, .05), (-2.42, .88), (-2.2, .9), (-1.9, .8)], .03, 'white', z=s * .32, bevel=.012, parent=R)
  # ---------------- front aero ----------------
  if Z:
    # circuit front wing (after the 3D-printed build's CAD): full-width, two elements with a see-through slot between them.
    # Front view: white upper element steps up outboard; blue lower element's bottom edge is a W (keel under the nose,
    # rising to mid-span, dropping to the ground again at the endplates).  z, leading edge, trailing edge, bottom, top
    WS = [(0.0, 2.42, 1.47, .012, .21), (.2, 2.27, 1.47, .04, .205), (.44, 2.17, 1.49, .085, .215), (.54, 2.15, 1.5, .09, .275),
          (.86, 2.09, 1.52, .095, .29), (1.1, 2.05, 1.53, .075, .29), (1.24, 2.04, 1.53, .045, .285)]
    def wlow(z, le, te, yb, yt):
      ym = yb + .07
      return [(le, yb + .02, z), (le - .07, ym, z), (te + .02, ym, z), (te, ym - .025, z), (te + .05, yb, z), (le - .18, yb, z)]
    def wup(z, le, te, yb, yt):
      ym = yb + .092; le -= .05
      return [(le, ym, z), (le - .02, yt - .04, z), (le - .1, yt, z), (te + .07, yt - .012, z), (te, yt - .05, z), (te + .03, ym, z)]
    for s, sd in ((1, 'L'), (-1, 'R')):
      for nm, fn, mat in (('plane_lower', wlow, 'blue'), ('plane', wup, 'white')):
        ob = loft(f'fwing__{nm}_{sd}', mirror([fn(*w) for w in WS], s), mat, lv=0, parent=R)
        for pl in ob.data.polygons: pl.use_smooth = False
        bv = ob.modifiers.new('bv', 'BEVEL'); bv.width = .008; bv.segments = 2; bv.limit_method = 'ANGLE'
      for z in (.3, .72, 1.02):
        le = 2.15 - z * .08
        slab(f'fwing__plane_strut_{sd}', [(le - .12, .09), (le - .36, .09), (le - .36, .16), (le - .12, .16)], .02, 'black', z=s * z, parent=R)
      # endplate: a triangular blade (section: wide base on the ground, pointed top), spike forward on the ground,
      # peak at the rear, then a steep rear edge.  x, inner base z, outer base z, peak z, peak height
      EP = [(2.56, 1.3, 1.33, 1.315, .025), (2.4, 1.25, 1.38, 1.32, .1), (2.18, 1.2, 1.44, 1.325, .2), (1.94, 1.18, 1.48, 1.33, .31),
            (1.72, 1.17, 1.5, 1.34, .41), (1.63, 1.17, 1.5, 1.34, .43), (1.52, 1.18, 1.48, 1.34, .1)]
      ob = loft(f'fwing__blade_{sd}', mirror([[(x, .008, zi), (x, .008, zo), (x, h, zp)] for x, zi, zo, zp, h in EP], s), 'blue', lv=0, parent=R)
      for pl in ob.data.polygons: pl.use_smooth = False
      # white cap over the upper part of the blade (sits proud of the blue: a separate layer)
      cap = [(x, zi, zo, zp, h) for x, zi, zo, zp, h in EP if h > .15]
      def capr(x, zi, zo, zp, h, k=.5, o=.012):
        # points k of the way up both faces, pushed out along each face normal, plus the ridge lifted
        (ni, mi), (no, mo) = [(-(h), zp - zb) if zb < zp else (h, zb - zp) for zb in (zi, zo)]
        li, lo = math.hypot(ni, mi), math.hypot(no, mo)
        a = (zi + (zp - zi) * k + ni / li * o, h * k + mi / li * o); b = (zo + (zp - zo) * k + no / lo * o, h * k + mo / lo * o)
        return [(x, a[1], a[0]), (x, b[1], b[0]), (x, h + o * 1.4, zp)]
      rows = [capr(2.02, 1.19, 1.46, 1.328, .27, k=.8)] + [capr(*c) for c in cap[1:]] + [capr(1.54, 1.178, 1.482, 1.34, .16, k=.62)]
      ob = loft(f'fwing__bladetop_{sd}', mirror(rows, s), 'white', lv=0, parent=R)
      for pl in ob.data.polygons: pl.use_smooth = False
      # the black triangle on both faces of the blade (a real opening on the 3D-printed build)
      def face(x, y, out):
        for a, b in zip(EP, EP[1:]):
          if a[0] >= x >= b[0]: t = (a[0] - x) / (a[0] - b[0]); r = [p + (q - p) * t for p, q in zip(a, b)]; break
        _, zi, zo, zp, h = r; zb = zo if out else zi
        return zb + (zp - zb) * y / h
      for out in (True, False):
        tri = [(1.98, .05), (1.68, .05), (1.68, .25)]; k = 1 if out else -1
        v = [(x, y, s * (face(x, y, out) + k * .004)) for x, y in tri] + [(x, y, s * (face(x, y, out) - k * .01)) for x, y in tri]
        mesh_from(f'fwing__blade_hole_{"o" if out else "i"}_{sd}', v, [(0, 1, 2), (5, 4, 3), (0, 3, 4, 1), (1, 4, 5, 2), (2, 5, 3, 0)], 'black', smooth=False, parent=R)
      # small outboard fin beside the endplate's rear foot
      slab(f'fwing__blade_fin_{sd}', [(1.92, .008), (1.56, .008), (1.56, .05), (1.62, .17)], .018, 'blue', z=s * 1.535, bevel=.004, parent=R)
    flat('fwing__plane_split', [(2.22, .4), (1.6, .66), (1.6, -.66), (2.22, -.4)], .012, 'carbon', y=.012, parent=R)
    text_up('marks__pulse_R', 'PULSE', AB, .16, 'blue', (1.78, .292, -.84), yaw=math.radians(90), parent=R)
    text_up('marks__fw1_L', '1', TB, .3, 'red', (1.78, .292, .84), yaw=math.radians(90), parent=R)
    # ======== aero mode (エアロモード): parts named "__aero" appear only in aero mode ========
    for s, sd in ((1, 'L'), (-1, 'R')):
      # front cover half: faceted white shell over the front wheels; front edge recedes toward the nose (W planform)
      def cring(x, zi, zo, yb, yt):
        # flat faceted section: steep outer wall, broad top plane with a crease, inner wall down to the nose
        zr = zi + (zo - zi) * .38
        return [(x, yb, zi), (x, yb, zo), (x, yt - .07, zo), (x, yt - .015, zo - .1), (x, yt, zr), (x, yt - .03, zi)]
      st = [(x, AZ(zi), AZ(zo), yb, yt) for x, zi, zo, yb, yt in [(2.44, .86, .98, .04, .08), (2.3, .64, 1.06, .04, .19), (2.12, .42, 1.11, .04, .3), (1.96, .22, 1.13, .05, .37), (1.8, .24, 1.15, .05, .43),
            (1.45, .27, 1.16, .07, .5), (1.1, .28, 1.16, .1, .53), (.86, .3, 1.12, .14, .52), (.72, .4, 1.0, .24, .47)]]
      cv = loft(f'fwing__aero_cover_{sd}', mirror([cring(*r) for r in st], s), 'white', lv=0, parent=R)
      for pl in cv.data.polygons: pl.use_smooth = False
      bv = cv.modifiers.new('bv', 'BEVEL'); bv.width = .012; bv.segments = 2; bv.limit_method = 'ANGLE'
      # blue lower skirt along the whole cover
      bb = [[(x, yb - .005, zi + .01), (x, yb - .005, zo + .015), (x, yb + .09, zo + .03), (x, yb + .09, zi + .01)] for x, zi, zo, yb, yt in st[1:]]
      loft(f'fwing__aero_skirt_{sd}', mirror(bb, s), 'blue', lv=1, parent=R)
      # outer forward blade (longer and taller than the circuit one)
      bl = [(2.66, .006, .03, .06), (2.4, .07, .02, .16), (2.0, .1, .02, .3), (1.6, .12, .03, .42), (1.12, .1, .06, .48), (.9, .05, .1, .44)]
      rows = [[(x, b, 1.43 - w), (x, b, 1.43 + w), (x, t, 1.43 + w * .6), (x, t + .02, 1.43), (x, t, 1.43 - w * .6)] for x, w, b, t in bl]
      loft(f'fwing__aero_blade_{sd}', mirror(rows, s), 'blue', lv=1, parent=R, creases={0: 1, 1: 1, 2: .7, 4: .7})
      rows = [[(x, t - .002, 1.43 - w * .62), (x, t - .002, 1.43 + w * .62), (x, t + .03, 1.43 + w * .4), (x, t + .036, 1.43), (x, t + .03, 1.43 - w * .4)] for x, w, b, t in bl[1:]]
      loft(f'fwing__aero_bladetop_{sd}', mirror(rows, s), 'lblue', lv=1, parent=R)
      # long yellow lens on the outer top of the cover
      top = cover_top_fn(st)
      # ---- layered panels on the cover (all hug the faceted top) ----
      # lens: blue bezel plate, yellow lens sitting in it
      ell = lambda cx, cz, a, b, n=20: [(cx + a * math.cos(t * math.tau / n), cz + b * math.sin(t * math.tau / n)) for t in range(n)]
      hug_plate(f'fwing__aero_bezel_{sd}', top, ell(1.56, AZ(.95), .44, .095), ell(1.56, AZ(.95), .39, .058), .004, .014, 'blue', s, parent=R)
      loft(f'fwing__aero_lens_{sd}', [se_ring(x, top(x, AZ(.95)) + .02, w * 1.1, .016, 2, s * AZ(.95), 14) for x, w in [(1.95, .006), (1.86, .03), (1.62, .052), (1.3, .04), (1.18, .006)]], 'yellow', parent=R)
      # carbon vent recessed inside a raised white frame
      vo = [(2.24, .68), (2.24, 1.03), (1.98, 1.08), (1.98, .56)]
      vi = [(2.2, .73), (2.2, .98), (2.02, 1.02), (2.02, .62)]
      hug_plate(f'fwing__aero_ventframe_{sd}', top, WZ(vo), WZ(vi), .012, .012, 'white', s, parent=R)
      hug_plate(f'fwing__aero_vent_{sd}', top, WZ(vi), None, .004, .0, 'carbon', s, parent=R)
      # inner deck panel with a blue edge stripe, stepped above the cover
      dp = [(1.92, .26), (1.92, .47), (1.55, .54), (1.02, .54), (.9, .44), (.9, .31), (1.3, .29)]
      hug_plate(f'fwing__aero_deck_{sd}', top, WZ(dp), None, .008, .01, 'white', s, parent=R)
      hug_plate(f'fwing__aero_deckedge_{sd}', top, WZ([(1.9, .5), (1.55, .57), (1.0, .57), (1.0, .545), (1.55, .545), (1.9, .475)]), None, .008, .014, 'lblue', s, parent=R)
      # blue lip along the W-shaped front edge
      hug_plate(f'fwing__aero_lip_{sd}', top, WZ([(2.43, .87), (2.3, .65), (2.12, .43), (1.96, .23), (1.9, .27), (2.06, .47), (2.24, .69), (2.37, .92)]), None, .006, .012, 'blue', s, parent=R)
      # rear step: a carbon strip where the cover ends in front of the side pods
      hug_plate(f'fwing__aero_rearstrip_{sd}', top, WZ([(.86, .32), (.86, 1.1), (.76, 1.0), (.76, .42)]), None, .006, .01, 'carbon', s, parent=R)
      if s < 0: ONE_Y = top(1.42, AZ(.74)) + .004
      # outer vertical fins at the tail corners
      slab(f'rbody__aero_fin_{sd}', [(-1.95, .78), (-2.46, .78), (-2.62, 1.3), (-2.5, 1.32), (-2.2, 1.0)], .03, 'blue', z=s * 1.56, bevel=.01, parent=R)
    text_up('marks__aero_one', '1', TB, .46, 'red', (1.42, ONE_Y, -AZ(.74)), yaw=math.radians(90), parent=R)
    # light-blue arched wing between the nacelles, with two small white fins
    rows = []
    for k in range(13):
      z = -.76 + k / 6 * .76; u = 1 - (z / .76) ** 2
      xc = -2.12 - .06 * u; yc = .915 + .02 * u
      rows.append([(xc + .12, yc, z), (xc + .02, yc + .03, z), (xc - .12, yc + .015, z), (xc - .12, yc - .005, z), (xc + .02, yc - .012, z)])
    loft('fanwings__arch', rows, 'lblue', lv=1, parent=R, creases={0: .9, 2: .9})
    slab('fanwings__campost', [(-1.95, .9), (-2.3, .92), (-2.28, 1.2), (-2.12, 1.28)], .035, 'white', z=0, bevel=.01, parent=R)
    cyl('fanwings__cam', .04, .1, 'black', loc=(-2.27, 1.19, 0), axis='x', verts=18).parent = R
    cyl('fanwings__camlens', .025, .01, 'yellow', loc=(-2.325, 1.19, 0), axis='x', verts=18).parent = R
    cyl('fanwings__camring', .042, .015, 'red', loc=(-2.32, 1.19, 0), axis='x', verts=18).parent = R
    for z in (-.13, .13):
      slab('fanwings__lamp', [(-2.28, .9), (-2.325, .9), (-2.325, .95), (-2.28, .95)], .14, 'lamp', z=z, parent=R)
    for z in (-.32, .32):
      slab('fanwings__fin', [(-2.06, .92), (-2.3, .92), (-2.38, 1.14), (-2.3, 1.14)], .02, 'white', z=z, bevel=.006, parent=R)
  else:
    for s, sd in ((1, 'L'), (-1, 'R')):
      rows = [[(x, b, z - w), (x, b, z + w), (x, t, z + w * .7), (x, t + .015, z), (x, t, z - w * .7)] for x, w, b, t, z in
              [(2.75, .01, .24, .26, 1.12), (2.4, .07, .26, .38, 1.18), (1.9, .1, .34, .52, 1.24), (1.3, .1, .4, .58, 1.27), (.9, .06, .4, .52, 1.22)]]
      loft(f'fangs_{sd}', mirror(rows, s), 'purple', lv=1, parent=R, creases={0: 1, 1: 1, 2: .6, 4: .6})
      join(f'fangs__rods_{sd}', [rod_between('fr', (1.6, .45, s * 1.25), (1.65, .36, s * .3), .02, 'grey'), rod_between('fr', (1.05, .45, s * 1.25), (1.0, .36, s * .3), .02, 'grey')], parent=R)
    half = [(2.5, 0), (2.36, .8), (2.2, 1.35), (1.92, 1.35), (2.0, .7), (2.14, 0)]
    flat('splitter', half + [(x, -z) for x, z in reversed(half[1:-1])], .045, 'purple', y=.1, bevel=.012, parent=R)
  # ---------------- rear: nacelles + fan wings (Asurada) / fins + wing (Ouga) ----------------
  for s, sd in ((1, 'L'), (-1, 'R')):
    cz = s * 1.15
    if Z:
      # blue cowl: a long shallow ogive growing out of the deck into the red nacelle (not a dome sitting on the deck)
      loft(f'nacelles__cowl_{sd}', [se_ring(x, y, r * .96, r * k, 2, cz, 22) for x, y, r, k in [(-.66, .83, .02, .5), (-.8, .835, .07, .55), (-.96, .845, .13, .62),
            (-1.12, .86, .185, .72), (-1.28, .875, .23, .84), (-1.44, .89, .265, .95), (-1.6, .9, .285, 1)]], 'blue', parent=R)
      loft(f'nacelles__red_{sd}', [se_ring(x, .9, r, r, 2, cz, 20) for x, r in [(-1.6, .285), (-2.3, .285), (-2.44, .268), (-2.52, .215)]], 'red', parent=R)
      cyl(f'nacelles__face_{sd}', .175, .02, 'black', loc=(-2.525, .9, cz), axis='x', verts=24).parent = R
      c = cyl(f'nacelles__cone_{sd}', .15, .2, 'grey', loc=(-2.62, .9, cz), axis='x', verts=24, r2=.13); c.parent = R
      cyl(f'nacelles__hole_{sd}', .085, .02, 'black', loc=(-2.725, .9, cz), axis='x', verts=6).parent = R
      loft(f'nacelles__base_{sd}', [se_ring(x, .77, w, .1, 3, cz, 16) for x, w in [(-.9, .02), (-1.0, .13), (-1.4, .17), (-2.1, .17), (-2.4, .1), (-2.5, .02)]], 'blue', parent=R)
      for k in range(3):
        xc = -2.0 - k * .13
        pts = [(xc + .07, 1.01), (xc - .03, .9), (xc + .07, .79), (xc + .03, .79), (xc - .07, .9), (xc + .03, 1.01)]
        slab(f'nacchev_{sd}{k}', pts, .02, 'white', z=s * (1.15 + .283), parent=R)
      nac = [o for o in list(COL.objects) if o.parent == R and (o.name.startswith(f'nacelles__') and not o.name.startswith('nacelles__base') and o.name.endswith(sd) or o.name.startswith(f'nacchev_{sd}'))]
      for o in nac: o.parent = None
      join(f'nacelles_{sd}', nac, parent=R, origin=(-1.55, .9, cz))
      # fan wing: swept blade from the arch end outward and back, with dihedral (circuit mode only)
      L = 1.25; w = [(-1.84, 0), (-2.2, 0), (-2.95, s * L), (-2.62, s * L)]
      fw = flat(f'fw_{sd}', w, .04, 'blue', y=0, bevel=.012)
      top = flat(f'fwt_{sd}', [(-1.98, 0), (-2.2, 0), (-2.95, s * L), (-2.76, s * L)], .01, 'lblue', y=.024, bevel=.003)
      ang = math.atan2(-.72 * s * L, -.75)
      sun = text_up(f'fws_{sd}', 'SUNSET', AB, .12, 'yellow', (-2.42, .03, s * .66), yaw=ang + (math.pi if s > 0 else 0))
      tip = flat(f'fwl_{sd}', [(-2.2 - .75 * t + dx, s * L * t) for t, dx in ((.62, 0), (1.0, 0), (1.0, .07), (.62, .07))], .05, 'lamp', y=.0)
      fwj = join(f'fanwings_{sd}', [fw, top, sun, tip], origin=(-2.02, 0, 0))
      fwj.location = P(-2.02, 1.02, s * .78)
      fwj.rotation_euler = (math.radians(-9 * s), 0, 0)
      fwj.parent = R
      slab(f'fanwings__pyl_{sd}', [(-2.0, 1.12), (-2.45, 1.12), (-2.42, 1.1 if False else 1.09 + .08), (-2.12, 1.1 + .06)], .03, 'blue', z=s * 1.0, bevel=.01, parent=R)
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
      text_decal(f'marks__one_{sd}', '1', TB, .36, 'red', (-.95, .49, s * PZ[sd]), sd, parent=R)
      text_decal(f'marks__kazami_{sd}', 'H.KAZAMI', AB, .07, 'black', (.05, .56, s * .3), sd, target=hmp, parent=R)
  return nose

def car(name, Z):
  root = bpy.data.objects.new(name, None); link(root)
  build(root, Z)
  return root

roots = {'zenith': car('car_zenith', True), 'ouga': car('car_ouga', False)}
for ob in list(COL.objects):
  if ob.type == 'MESH' and ob.modifiers: apply_all(ob)
for ob in list(COL.objects):
  if ob.type == 'MESH' and not ob.name.startswith(('marks', 'nacchev')): harden(ob)

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
