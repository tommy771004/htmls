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
  'carbon': (0.09, 0.095, 0.1), 'lamp': (1.0, 0.06, 0.05), 'deep': (0.05, 0.03, 0.1), 'orange': (1.0, 0.35, 0.05), 'teal': (0.05, 0.55, 0.4), 'glassg': (0.04, 0.2, 0.22), 'gold': (0.62, 0.40, 0.15), 'glass': (0.05, 0.12, 0.6), 'yellow': (0.95, 0.62, 0.02), 'black': (0.012, 0.012, 0.014), 'mesh': (0.3, 0.31, 0.33), 'cfgrey': (0.2, 0.21, 0.22),
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

def wheel2(name, r, w, loc, side, root, rim='gold', five=False):
  obs = []
  # tyre: lathed ring (open centre) so the rim shows through
  ri, b = r * .74, min(.05, w * .18)   # thin sidewall: the rim fills most of the wheel (12" front / 17" rear on the build)
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
  dish = cyl(name + '_d', r * .73, w * .5, 'black', axis='z', verts=32)
  obs.append(dish)
  # rim lip: an open ring (a capped cylinder here would hide the spokes)
  lp = [(r * .67, -w * .05), (r * .735, -w * .05), (r * .735, w * .05), (r * .67, w * .05)]; N2 = 48; lv, lf = [], []
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
  obs.append(cyl(name + '_bar', r * .7, w * .62, 'black', loc=(0, 0, side * w * .08), axis='z', verts=32))
  for k in range(0 if five else 8):  # 8 twin spokes: each a pair splitting from the hub toward the rim
    for d in (-.045, .045):
      a = k / 8 * math.tau + d
      sp = slab(name + f'_sp{k}', [(r * .15, -r * .036), (r * .71, -r * .03), (r * .71, r * .03), (r * .15, r * .036)], w * .07, rim, z=side * w * .43, bevel=.002)
      sp.rotation_euler = (0, -a, 0); obs.append(sp)
  for k in range(5 if five else 0):  # classic 5-spoke (Ogre)
    sp = slab(name + f'_sp{k}', [(r * .15, -r * .075), (r * .71, -r * .05), (r * .71, r * .05), (r * .15, r * .075)], w * .09, rim, z=side * w * .43, bevel=.004)
    sp.rotation_euler = (0, -k / 5 * math.tau, 0); obs.append(sp)
  obs.append(cyl(name + '_hub', r * .17, w * .96, rim, axis='z', verts=16))
  obs.append(cyl(name + '_nut', r * .07, w * .08, 'yellow', loc=(0, 0, side * w * .5), axis='z', verts=6))
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

def face_out(ob, want):
  """open strips come out of recalc_face_normals with an arbitrary side; the page renders single-sided,
     so flip the whole strip when its normals (on average) point against want(page_centre) -> page dir"""
  me = ob.data; tot = 0.0
  for pl in me.polygons:
    c, n = pl.center, pl.normal
    tot += Vector((n.x, n.z, -n.y)).dot(want(Vector((c.x, c.z, -c.y))))
  if tot < 0:
    bm = bmesh.new(); bm.from_mesh(me); bmesh.ops.reverse_faces(bm, faces=bm.faces); bm.to_mesh(me); bm.free()
  return ob

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
  can = [(1.98, .445, .02, .01), (1.82, .485, .085, .035), (1.6, .535, .15, .065), (1.36, .575, .2, .075), (1.12, .625, .24, .095)] if Z else \
        [(1.58, .47, .02, .01), (1.4, .53, .14, .06), (1.15, .61, .22, .1)]
  # (kit paint-guide side view) the canopy's top line keeps rising all the way back and meets the cowl top at ~1 m
  can += [(.85, .69, .26, .115), (.55, .74, .27, .15), (.3, .79, .25, .19), (.14, .82, .18, .2)]
  loft('canopy', [se_ring(x, y, hw, hh, n=2.3, N=18) for x, y, hw, hh in can], 'glass', parent=R)
  # cockpit tub: U-channel walls between the nose and the canopy edge; the top edge is the white sill line
  def sill(x, hw, cy, k=1.0):
    W, Wi, yt, yf, yb = hw * 1.08 * k, hw * .86 * k, cy - .012, .505, .36
    return [(x, yb, -W), (x, yb, W), (x, yt - .02, W), (x, yt, W - .015), (x, yt, Wi), (x, yf, Wi), (x, yf, -Wi), (x, yt, -Wi), (x, yt, -W + .015), (x, yt - .02, -W)]
  sl = [sill(x, max(hw, .03), y, 1) for x, y, hw, hh in can[1:]]
  loft('nose__sill', sl, 'white' if Z else 'purple', lv=2, parent=R, creases={i: .95 for i in range(10)})
  # ---------------- engine hump behind the canopy + antenna ----------------
  # (Variable Action figure photos) a tall, wide cowl right behind the driver's head: its pointed prow rides OVER the rear
  # of the canopy (the glass tucks under it), the red S covers its flanks, and the rear-body arms grow straight out of its sides
  # kit side view: highest at its front (where the canopy line arrives), then sloping down to the rear deck at x≈-1
  hump = [(.22, .95, .06, .06, .3), (.16, .8, .24, .24, .4), (.02, .78, .28, .27, .42), (-.2, .75, .285, .27, .45), (-.45, .71, .28, .24, .45),
          (-.7, .67, .26, .2, .4), (-.95, .64, .22, .16, .35), (-1.15, .66, .17, .13, .3), (-1.35, .72, .1, .12, .25)]
  def hsec(x, y, hw, hh, tp):
    yb, yt = y - hh, y + hh; ws = hw * (1 - tp * .55)
    return [(x, yb, hw * .8), (x, y - hh * .2, hw), (x, yt - hh * .35, ws + (hw - ws) * .35), (x, yt - .02, ws * .45), (x, yt, 0),
            (x, yt - .02, -ws * .45), (x, yt - hh * .35, -ws - (hw - ws) * .35), (x, y - hh * .2, -hw), (x, yb, -hw * .8)]
  hmp = loft('rbody__hump', [hsec(*h) for h in hump], 'white', lv=2, parent=R, creases={1: .9, 2: .95, 4: .8, 6: .95, 7: .9})
  # centre spine from the hump back to the arch wing
  loft('rbody__spine', [[(x, y - h, w), (x, y, w), (x, y + h, 0), (x, y, -w), (x, y - h, -w)] for x, y, w, h in
        [(-.95, .66, .12, .1), (-1.3, .76, .1, .1), (-1.7, .84, .08, .09), (-1.96, .9, .05, .07), (-2.04, .92, .02, .03)]], 'white', lv=2, parent=R, creases={0: 1, 1: .9, 2: .95, 3: .9, 4: 1})
  if Z:
    slab('rbody__antenna', [(.04, 1.0), (-.2, 1.0), (-.44, 1.32), (-.35, 1.33)], .03, 'white', bevel=.008, parent=R)
  # ---------------- bridge arms + deck (per side) ----------------
  # kit side view: at the front the arms are low, thin plates lying on the side pods (the cowl's S flank stays clear above
  # them); they only rise to deck height over the rear fenders
  arms = [(.12, .3, .34, .56, .6), (-.1, .3, .62, .56, .62), (-.35, .3, 1.0, .56, .66), (-.56, .3, 1.28, .57, .72),
          (-.8, .3, 1.46, .6, .8), (-1.2, .3, 1.5, .7, .85), (-1.75, .3, 1.5, .72, .85), (-2.1, .3, 1.46, .72, .84), (-2.3, .3, 1.38, .72, .82)]
  for s, sd in ((1, 'L'), (-1, 'R')):
    # the arm is a shell riding above the side pod: its underside stays clear of the pod (open, dark gap between them)
    def arm_ring(x, zi, zo, yb, yt):
      r = quad_ring(x, zi, zo, yb, yt, bev=min(.05, (yt - yb) * .4), drop=(min(.12, (yt - yb) * .5) if x > -1.0 else .04))
      if x > -1.3:
        ybo, ybi = (yb, yb - .06) if x > -1.0 else (.62, .52)
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
    # front: a toe that points forward on the ground (narrow in plan), its front edge sweeping up and back into the arm;
    # over the wheel the top runs level; behind the wheel only the outer skin remains, ending in a near-vertical rear edge
    fr = [(-.44, .03, .07, 1.33, 1.38), (-.56, .02, .12, 1.25, 1.45), (-.7, .02, .2, 1.15, 1.5), (-.84, .02, .34, 1.07, 1.53), (-.95, .02, .54, 1.03, 1.545), (-1.03, .02, .74, 1.01, 1.55),
          (-1.1, .02, .84, 1.0, 1.55), (-1.5, .03, .86, .95, 1.55), (-2.0, .06, .86, .95, 1.55), (-2.12, .2, .85, 1.5, 1.6), (-2.32, .3, .83, 1.5, 1.588), (-2.44, .33, .81, 1.5, 1.572)]
    fender = loft(f'rbody__fender_{sd}', mirror([fring(*r) for r in fr], s), 'white', lv=0, parent=R, creases={0: .95, 1: .95, 2: .95, 3: .95, 4: .95, 5: .95, 6: .95, 7: .95})
    subsurf(fender, 2); apply_all(fender)
    cut = cyl('cut', .375, 1.2, 'black', loc=(RX, RR, s * 1.25), axis='z', verts=64)
    boolean_cut(fender, cut); bpy.data.objects.remove(cut, do_unlink=True)
    # dark wheel-well liner on the inboard side, so the arch reads as a well rather than a hole through the body
    cyl(f'rbody__well_{sd}', .385, .012, 'black', loc=(RX, RR, s * .972), axis='z', verts=48).parent = R
    # open the space behind the wheel (seen from the rear only a thin outer fin remains)
    bpy.ops.mesh.primitive_cube_add(size=1)
    box = bpy.context.active_object; box.scale = (.9, .57, .72); box.location = P(-2.28, .33, s * 1.235)
    boolean_cut(fender, box); bpy.data.objects.remove(box, do_unlink=True)
    # blue lower band on the pillar and the tail (the "Jupiter" / skirt stripe)
    bb = [(-.43, .025, .075, 1.33, 1.38), (-.56, .015, .125, 1.25, 1.45), (-.7, .015, .18, 1.15, 1.5), (-.84, .015, .21, 1.07, 1.53), (-1.0, .015, .22, 1.02, 1.555), (-1.28, .015, .2, .97, 1.55)]
    loft(f'rbody__foot_{sd}', mirror([fring(x, yb, yt, zi - .006, zo + .006) for x, yb, yt, zi, zo in bb], s), A, lv=2, parent=R, creases={0: .95, 1: .95, 2: .95, 3: .95, 4: .95, 5: .95, 6: .95, 7: .95})
    zmax = max(abs(v.co.y) for v in fender.data.vertices if -1.25 < v.co.x < -.9 and .3 < v.co.z < .7)
    slab(f'rbody__panel_{sd}', [(-.8, .26), (-1.22, .26), (-1.22, .76), (-1.04, .76), (-.9, .52)], .024, 'white', z=s * (zmax + .004), bevel=.008, parent=R)
    PZ[sd] = zmax + .02
    tb = [(-2.08, .2, .27, 1.495, 1.604), (-2.2, .25, .33, 1.495, 1.598), (-2.32, .295, .37, 1.495, 1.592), (-2.445, .325, .39, 1.495, 1.576)]
    loft(f'rbody__skirt_{sd}', mirror([fring(*r) for r in tb], s), A, lv=2, parent=R, creases={0: .95, 1: .95, 2: .95, 3: .95, 4: .95, 5: .95, 6: .95, 7: .95})
    # ---------------- side pod ----------------
    pod = [(.425, .4, .1, .11), (.41, .4, .15, .17), (.27, .4, .18, .2), (.19, .4, .18, .2), (.15, .4, .18, .2), (-.4, .4, .18, .2), (-.85, .38, .16, .18), (-1.0, .36, .05, .06)]
    pb = loft(f'pods_{sd}', [se_ring(x, y - .02, hw * .95, hh * .92, n=2.2, N=16, cz=s * .74) for x, y, hw, hh in pod], 'white', parent=R)
    pb.data.materials.append(M(L))   # front third light blue (the fan intake cowl)
    for pl in pb.data.polygons:
      if pl.center.x > .17: pl.material_index = 1
    loft(f'pods__low_{sd}', [se_ring(x, y - .02 - hh * .5, hw * .98, hh * .44, n=2.2, N=14, cz=s * .74) for x, y, hw, hh in pod[4:7]], A, parent=R)
    ring = bpy.data.objects.new(f'pods__ring_{sd}', bpy.data.meshes.new('r'))
    bm = bmesh.new(); bmesh.ops.create_cone(bm, cap_ends=False, segments=48, radius1=.182, radius2=.165, depth=.07); bm.to_mesh(ring.data); bm.free()
    for pl in ring.data.polygons: pl.use_smooth = True
    link(ring, R); ring.data.materials.append(M(L)); ring.rotation_euler = (0, math.radians(90), 0); ring.location = P(.45, .38, s * .74)
    sol = ring.modifiers.new('so', 'SOLIDIFY'); sol.thickness = .03
    subsurf(ring, 1)
    cyl(f'pods__mouth_{sd}', .165, .02, 'black', loc=(.425, .38, s * .74), axis='x', verts=24).parent = R
    for k in range(3):
      x0 = -.52 - k * .13
      slab(f'pods__gill_{sd}{k}', [(x0, .34), (x0 - .026, .34), (x0 - .006, .48), (x0 + .02, .48)], .02, 'black', z=s * .905, parent=R)
    slab(f'nose__intake_{sd}', [(.72, .43), (.42, .45), (.42, .52), (.62, .5)], .03, 'black', z=s * .325, parent=R)
    slab(f'nose__intakelip_{sd}', [(.74, .42), (.4, .44), (.4, .455), (.74, .435)], .034, 'lblue', z=s * .325, parent=R)
    # metal grille on the deck just ahead of the arched wing, following its swept leading edge
    flat(f'rbody__vent_{sd}', [(-2.06 - .2 * (z / .93) ** 2 + dx, s * z) for z, dx in [(.12, .1), (.4, .1), (.7, .1), (.9, .1), (.9, .01), (.7, .01), (.4, .01), (.12, .01)]], .012, 'mesh', y=.876, parent=R)
    # radiator inlet: a wide, low slot between the pod's inner side and the tub, just above the floor, under a white lip plate
    slab(f'pods__inlet_duct_{sd}', [(.3, .075), (-.25, .075), (-.25, .235), (.3, .235)], .17, 'black', z=s * .46, parent=R)
    flat(f'pods__inlet_lip_{sd}', [(.36, s * .345), (-.25, s * .345), (-.25, s * .57), (.36, s * .57)], .022, 'white', y=.25, bevel=.006, parent=R)
    flat(f'pods__inlet_sill_{sd}', [(.33, s * .35), (.18, s * .35), (.18, s * .565), (.33, s * .565)], .016, 'white', y=.068, bevel=.004, parent=R)
    # dark chassis side seen through the gap between the side pod and the arm above it (radiator bay)
    slab(f'rbody__bay_{sd}', [(.3, .1), (-1.2, .1), (-1.2, .66), (-.6, .56), (.3, .54)], .02, 'carbon', z=s * .35, parent=R)
    # ---------------- front suspension ----------------
    rods = []
    zc = s * (FZ - .17)
    def truss(apex, b1, b2, w, h):
      """wide, flat A-arm (two legs from the upright to the chassis) with one diagonal web between them"""
      A, B1, B2 = Vector(apex), Vector(b1), Vector(b2); m1 = A + (B1 - A) * .45
      # grey woven carbon wrapping, as on the owner's figure
      return [arm_tube('tr', A, B1, (0, 0, 0), w, h, 'cfgrey', n=4, seg=6), arm_tube('tr', A, B2, (0, 0, 0), w, h, 'cfgrey', n=4, seg=6),
              arm_tube('tr', m1, B2 + (B1 - B2) * .15, (0, 0, 0), w * .75, h * .85, 'cfgrey', n=4, seg=6)]
    for x in FXS:
      rods += truss((x, FR + .06, zc), (x + .2, .42, s * .3), (x - .2, .42, s * .3), .042, .016)
      rods += truss((x, FR - .06, zc), (x + .18, .24, s * .3), (x - .18, .24, s * .3), .04, .015)
      rods.append(arm_tube('push', (x - .03, FR - .05, zc), (x - .13, .44, s * .32), (0, 0, 0), .011, .011, 'silver'))
      # brake fairing: black dome over the caliper and disc, with a small cooling inlet
      rods.append(cyl('brk', .15, .09, 'black', loc=(x, FR, s * (FZ - .14)), axis='z', verts=28, r2=.1))
      rods.append(cyl('duct', .03, .05, 'grey', loc=(x + .1, FR - .06, s * (FZ - .17)), axis='x', verts=12))
    join(f'fwheels__susp_{sd}', rods, parent=R)
    rods = []
    zu = s * (RZ - .3)
    rods += truss((RX, RR + .09, zu), (RX + .26, .52, s * .32), (RX - .22, .52, s * .32), .05, .018)
    rods += truss((RX, RR - .09, zu), (RX + .22, .26, s * .32), (RX - .2, .26, s * .32), .048, .017)
    # drive shaft integrated into the arm: a black aerofoil beam wraps it, with a window mid-span where the shaft shows;
    # thin rails above and below tie the two ends together
    rods.append(arm_tube('drive', (RX, RR, zu), (RX, RR + .02, s * .3), (0, 0, 0), .024, .024, 'silver'))
    for z0, z1 in ((zu, s * .76), (s * .5, s * .3)):
      rods.append(arm_tube('shroud', (RX, RR + .02 * (1 - abs(z0) / .97), z0), (RX, RR + .02 * (1 - abs(z1) / .97), z1), (0, 0, 0), .085, .045, 'cfgrey', n=4, seg=10))
    for dy in (.052, -.048):
      rods.append(arm_tube('rail', (RX, RR + dy, zu), (RX, RR + dy + .02, s * .3), (0, 0, 0), .075, .01, 'cfgrey', n=4, seg=8))
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
    # After a top-down photo of the Variable Action figure in aero mode, back-projected through a solved camera.
    # One faceted cowl spans the car (planform: W front edge whose centre point leads, V notch around the canopy tip);
    # the outer prongs are long columns that start at the side pods (which slide outboard in this mode, see the page)
    # and run over the front wheels to a blue spike on the ground.  Tables are (|z|, x).
    XR = [(0, 2.26), (.04, 2.12), (.08, 1.99), (.17, 1.77), (.44, 1.62), (.92, 1.39)]   # rear edge / notch
    XI = [(.055, 2.17), (.4, 2.035), (.487, 1.85), (.93, 1.66)]                         # stepped panel line
    XT = [(0, 2.63), (.47, 2.32), (.83, 2.19), (.92, 2.2)]                               # top of the blue front band
    XF = [(0, 2.71), (.48, 2.34), (.84, 2.28), (.92, 2.3)]                               # front edge
    def tab(t, z):
      z = min(max(z, t[0][0]), t[-1][0])
      for (z0, a), (z1, b) in zip(t, t[1:]):
        if z <= z1: return a + (b - a) * (z - z0) / ((z1 - z0) or 1)
      return t[-1][1]
    def cowl_prof(z):
      z = abs(z); xr, xt, xf = tab(XR, z), tab(XT, z), tab(XF, z)
      xi = min(max(tab(XI, z), xr + .02), xt - .05)
      yr = .5 + .04 * min(z, .9) / .9
      return [(xr, yr - .2), (xr, yr), (xi, yr - .02), (xi + .008, yr - .035), (xt, .22), (xf, .06), (xf - .07, .03)]
    def cowl_y(x, z):
      pr = cowl_prof(z)[1:6]
      if x <= pr[0][0]: return pr[0][1]
      for (x0, y0), (x1, y1) in zip(pr, pr[1:]):
        if x <= x1: return y0 + (y1 - y0) * (x - x0) / ((x1 - x0) or 1)
      return pr[-1][1]
    ZS = [0, .02, .04, .055, .08, .12, .17, .25, .35, .4, .44, .47, .487, .53, .65, .75, .83, .88, .92]
    zs = [-z for z in reversed(ZS[1:])] + ZS
    cw = loft('fwing__aero_cowl', [[(x, y, z) for x, y in cowl_prof(z)] for z in zs], 'white', lv=0, parent=R)
    cw.data.materials.append(M('blue'))
    n = 7; assert len(cw.data.polygons) == (len(zs) - 1) * n + 2
    for i in range(len(zs) - 1):   # blue: the front band, and the walls of the V notch around the canopy tip
      for j in (4, 0):
        if j == 4 or max(abs(zs[i]), abs(zs[i + 1])) <= .17: cw.data.polygons[i * n + j].material_index = 1
    for pl in cw.data.polygons: pl.use_smooth = False
    bv = cw.modifiers.new('bv', 'BEVEL'); bv.width = .008; bv.segments = 2; bv.limit_method = 'ANGLE'
    def drape(ob, off):
      """lay a flat decal onto the cowl top"""
      bpy.context.view_layer.objects.active = ob; bpy.ops.object.select_all(action='DESELECT'); ob.select_set(True)
      bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
      y0 = min(v.co.z for v in ob.data.vertices)
      for v in ob.data.vertices: v.co.z = cowl_y(v.co.x, -v.co.y) + off + (v.co.z - y0)
      return ob
    one = text_up('marks__aero_one', '1', TB, .4, 'red', (1.98, .5, -.68), yaw=math.radians(90), parent=R)
    drape(one, .004)
    em = [(2.615, 0), (2.53, .05), (2.545, .012), (2.52, 0)]
    hug_plate('marks__aero_emblem_L', cowl_y, em, None, .003, .004, 'yellow', 1, parent=R)
    hug_plate('marks__aero_emblem_R', cowl_y, em, None, .003, .004, 'red', -1, parent=R)
    # outer column: circle where it leaves the side pod's fan ring, flattening over the front wheels, spike at the front
    CLM = [(.2, .38, .176, .18, 1.08), (.32, .4, .17, .155, 1.08), (.45, .45, .162, .12, 1.08), (.58, .56, .158, .08, 1.075),
           (.75, .585, .155, .075, 1.07), (1.22, .59, .155, .075, 1.07), (1.5, .58, .15, .08, 1.065), (1.75, .53, .145, .09, 1.06),
           (2.0, .45, .135, .1, 1.06), (2.25, .35, .115, .1, 1.065), (2.5, .22, .085, .085, 1.075), (2.7, .11, .05, .055, 1.085),
           (2.84, .04, .02, .025, 1.09), (2.88, .02, .005, .01, 1.09)]
    def col_at(x):
      for a, b in zip(CLM, CLM[1:]):
        if a[0] <= x <= b[0]: t = (x - a[0]) / (b[0] - a[0]); return [p + (q - p) * t for p, q in zip(a, b)]
      return list(CLM[-1] if x > CLM[-1][0] else CLM[0])
    def col_top(x, z):
      _, cy, hw, hh, cz = col_at(x); u = min(abs(abs(z) - cz) / hw, .999)
      return cy + hh * (1 - u ** 2.5) ** (1 / 2.5)
    def arc(x, t0, t1, d, m=31):
      _, cy, hw, hh, cz = col_at(x); out = []
      for i in range(m):
        t = (t0 + (t1 - t0) * i / (m - 1)) * math.pi; c, sn = math.cos(t), math.sin(t)
        out.append((x, cy + (hh + d) * math.copysign(abs(sn) ** .8, sn), cz + (hw + d) * math.copysign(abs(c) ** .8, c)))
      return out
    # white top: covers the inner side and the crown; the outer flank stays blue; narrows around the lamp, pointed at x=2.43
    WT = [(.2, .22, 1.1), (1.45, .24, 1.08), (1.62, .7, 1.08), (1.9, .74, 1.06), (2.1, .76, .98), (2.3, .78, .88), (2.43, .81, .83)]
    def wt_at(x):
      for a, b in zip(WT, WT[1:]):
        if a[0] <= x <= b[0]: t = (x - a[0]) / (b[0] - a[0]); return a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t
      return WT[-1][1:]
    # same stations as the column body (plus the lamp / taper breaks), so the strip never cuts a chord through a crease
    wxs = sorted(set([r[0] for r in CLM if r[0] <= 2.43] + [.9, 1.05, 1.35, 1.45, 1.55, 1.62, 1.68, 1.82, 1.9, 2.1, 2.2, 2.3, 2.38, 2.43]))
    for s, sd in ((1, 'L'), (-1, 'R')):
      loft(f'fwing__aero_col_{sd}', mirror([se_ring(x, cy, hw, hh, 2.5, cz, 24) for x, cy, hw, hh, cz in CLM], s), 'blue', lv=0, parent=R)
      # (an open strip, flipped to face away from the column axis: a thin closed shell came out inside-out)
      rows = [arc(x, *wt_at(x), .01) for x in wxs]; m = len(rows[0])
      ct = mesh_from(f'fwing__aero_coltop_{sd}', [(x, y, s * z) for r in rows for x, y, z in r],
                     [(i * m + j, i * m + j + 1, (i + 1) * m + j + 1, (i + 1) * m + j) for i in range(len(rows) - 1) for j in range(m - 1)], 'white', parent=R)
      face_out(ct, lambda c: Vector((0, c.y - col_at(c.x)[1], c.z - s * col_at(c.x)[4])))
      # yellow lamp: a long lozenge on the crown, pointed at both ends
      lz = 1.045
      LW = [(1.63, .004), (1.7, .04), (1.82, .066), (1.95, .07), (2.07, .054), (2.17, .025), (2.22, .004)]
      loft(f'fwing__aero_lens_{sd}', mirror([se_ring(x, col_top(x, lz) + .004, w, .012 + w * .12, 2, lz, 14) for x, w in LW], s), 'yellow', lv=1, parent=R)
      # amber reflector inside the lens
      loft(f'fwing__aero_lensin_{sd}', mirror([se_ring(x, col_top(x, lz) + .012, w * .5, .012 + w * .08, 2, lz, 12) for x, w in LW[1:-1]], s), 'orange', lv=1, parent=R)
      # carbon vent just behind the band, running diagonally inboard
      # (a fine grid draped on the cowl: a coarse fan plate showed big shading triangles on the slope)
      q = [(2.04, .81), (2.17, .826), (2.3, .466), (2.2, .452)]; NU, NV = 6, 14; V = []
      for i in range(NV + 1):
        a = [q[0][k] + (q[3][k] - q[0][k]) * i / NV for k in (0, 1)]; b = [q[1][k] + (q[2][k] - q[1][k]) * i / NV for k in (0, 1)]
        for j in range(NU + 1):
          x, z = a[0] + (b[0] - a[0]) * j / NU, a[1] + (b[1] - a[1]) * j / NU
          V.append((x, cowl_y(x, z) + .004, s * z))
      vt = mesh_from(f'fwing__aero_vent_{sd}', V, [(i * (NU + 1) + j, i * (NU + 1) + j + 1, (i + 1) * (NU + 1) + j + 1, (i + 1) * (NU + 1) + j) for i in range(NV) for j in range(NU)], 'carbon', parent=R)
      face_out(vt, lambda c: Vector((0, 1, 0)))
      # blue sleeve where the outboard-slid side pod runs into the rear fender pillar (the pod tucks inside it)
      PZc = 1.08
      sv = [se_ring(-.42, .38, .176, .189, 2.2, PZc, 24)] + [se_ring(x, y, w, h, 2.2, PZc, 24) for x, y, w, h in
            [(-.42, .38, .214, .222), (-.5, .38, .208, .214), (-.75, .375, .204, .21), (-1.0, .365, .19, .198), (-1.15, .35, .15, .16), (-1.24, .34, .07, .08)]]
      loft(f'rbody__aero_sleeve_{sd}', mirror(sv, s), 'blue', lv=1, parent=R)
      # blue lining along the rim of the V notch
      for q in ([(1.8, .17), (2.0, .085), (1.99, .115), (1.8, .205)], [(2.0, .085), (2.26, .003), (2.2, .05), (1.99, .115)]):
        hug_plate(f'fwing__aero_notch_{sd}', cowl_y, q, None, .002, .004, 'blue', s, parent=R)
      # recessed panel grooves: a small L beside the notch and a dash near the outer rear corner
      # the stepped panel line, drawn as a dark groove just below the step
      for (z0, x0), (z1, x1) in zip(XI, XI[1:]):
        hug_plate(f'fwing__aero_groove_{sd}', cowl_y, [(x0 + .01, z0), (x1 + .01, z1), (x1 + .02, z1), (x0 + .02, z0)], None, .001, .002, 'grey', s, parent=R)
      for g in ([(1.935, .186), (2.07, .186), (2.07, .196), (1.935, .196)], [(1.93, .186), (1.94, .186), (1.94, .24), (1.93, .24)], [(1.655, .8), (1.667, .8), (1.667, .86), (1.655, .86)]):
        hug_plate(f'fwing__aero_groove_{sd}', cowl_y, g, None, .001, .002, 'black', s, parent=R)
      # the chevron slats behind the cowl, from the column in to the canopy side (suspension shows between them)
      flat(f'fwing__aero_slat_{sd}', [(x, s * z) for x, z in [(.925, .95), (1.1, .935), (1.56, .2), (1.39, .2)]], .026, 'white', y=.54, bevel=.006, parent=R)
      # side pods slide outboard in this mode: stepped white decks fill the gap between them and the tub
      flat(f'pods__aero_deck_{sd}', [(x, s * z) for x, z in [(-1.09, .985), (-1.09, .585), (-.05, .55), (-.05, .93)]], .024, 'white', y=.47, bevel=.006, parent=R)
      flat(f'pods__aero_deck2_{sd}', [(x, s * z) for x, z in [(-.51, .65), (-.51, .29), (.34, .29), (.34, .62)]], .024, 'white', y=.44, bevel=.006, parent=R)
      # outer vertical fins at the tail corners
      slab(f'rbody__aero_fin_{sd}', [(-1.95, .82), (-2.46, .82), (-2.8, 1.5), (-2.68, 1.54), (-2.25, 1.08)], .035, 'blue', z=s * 1.56, bevel=.01, parent=R)   # swept tail fins
    # light-blue arched wing between the nacelles, with two small white fins
    rows = []
    # spans the whole gap between the nacelles; the centre leads and the tips sweep back (owner's top-down photo)
    for k in range(17):
      z = -.93 + k / 8 * .93; v = (z / .93) ** 2; u = 1 - v
      le = -2.06 - .2 * v; te = -2.33 - .17 * v; xm = (le + te) / 2; yc = .915 + .02 * u
      rows.append([(le, yc, z), (le - .1 * (le - te) / .24, yc + .03, z), (te, yc + .015, z), (te, yc - .005, z), (le - .1 * (le - te) / .24, yc - .012, z)])
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
      # one continuous shell: blue ogive growing out of the deck, turning red at x=-1.6 (no seam, no pinch between them)
      NR = [(-.66, .83, .02, .5), (-.8, .835, .07, .55), (-.96, .845, .13, .62), (-1.12, .86, .185, .72), (-1.28, .875, .23, .84), (-1.44, .89, .265, .95),
            (-1.57, .9, .283, 1), (-1.63, .9, .285, 1), (-1.85, .9, .285, 1), (-2.1, .9, .285, 1), (-2.3, .9, .285, 1), (-2.44, .9, .268, 1), (-2.52, .9, .215, 1)]
      # over the wheel arch the underside is flattened (buried in the fender) so it never shows through the arch
      flatb = lambda x, ring: [(px, max(py, .735), pz) for px, py, pz in ring] if -2.32 < x < -1.26 else ring
      nb = loft(f'nacelles__body_{sd}', [flatb(x, se_ring(x, y, r * (.96 if x > -1.6 else 1), r * k, 2, cz, 22)) for x, y, r, k in NR], 'blue', parent=R)
      # red only on a short cap at the tail (owner's photo of the figure + built kits); two blue flame tongues run back into it
      # on the top.  A separate shell hugging the body, so the tongues are smooth instead of stair-stepped faces.
      def nac_r(x):
        for a, b in zip(NR, NR[1:]):
          if a[0] >= x >= b[0]: t = (a[0] - x) / (a[0] - b[0]); return a[2] + (b[2] - a[2]) * t
        return NR[-1][2]
      XC0, XE = -2.2, -2.52
      def cap_front(th):
        d = 0.0
        for c in (math.radians(55), math.radians(125)):
          u = abs(th - c) / math.radians(16)
          if u < 1: d = max(d, .17 * (1 - u))
        return XC0 - d
      NT, NU = 72, 10; V, F = [], []
      for i in range(NT):
        th = i / NT * math.tau
        x0 = cap_front(th)
        for j in range(NU + 1):
          x = x0 + (XE - x0) * j / NU; rr = nac_r(x) + .004
          V.append((x, max(.9 + rr * math.sin(th), .739 if x > -2.32 else -9), cz + rr * math.cos(th)))
      for i in range(NT):
        for j in range(NU):
          a, b = i * (NU + 1) + j, ((i + 1) % NT) * (NU + 1) + j
          F.append((a, a + 1, b + 1, b))
      rc = mesh_from(f'nacelles__red_{sd}', V, F, 'red', parent=R)
      face_out(rc, lambda c: Vector((0, c.y - .9, c.z - cz)))
      # dark intake slit on the crown of the blue cowl, a narrow V opening toward the rear
      def nac_top(x, dz):
        for a_, b_ in zip(NR, NR[1:]):
          if a_[0] >= x >= b_[0]: t = (a_[0] - x) / (a_[0] - b_[0]); y, r, k = [p + (q - p) * t for p, q in zip(a_[1:], b_[1:])]; break
        w = r * .96; return y + r * k * math.sqrt(max(0, 1 - (dz / w) ** 2)) + .004
      sl = [(x, (x + 1.02) / -.3 * .035) for x in (-1.02, -1.1, -1.18, -1.26, -1.32)]
      V = [(x, nac_top(x, dz), cz + dz) for x, w in sl for dz in (-w, w)]
      sk = mesh_from(f'nacelles__slot_{sd}', V, [(2 * i, 2 * i + 1, 2 * i + 3, 2 * i + 2) for i in range(len(sl) - 1)], 'black', smooth=False, parent=R)
      face_out(sk, lambda c: Vector((0, 1, 0)))
      cyl(f'nacelles__face_{sd}', .175, .02, 'black', loc=(-2.525, .9, cz), axis='x', verts=24).parent = R
      c = cyl(f'nacelles__cone_{sd}', .15, .2, 'grey', loc=(-2.62, .9, cz), axis='x', verts=24, r2=.13); c.parent = R
      cyl(f'nacelles__hole_{sd}', .085, .02, 'black', loc=(-2.725, .9, cz), axis='x', verts=6).parent = R
      loft(f'nacelles__base_{sd}', [se_ring(x, .8, w, .075, 3, cz, 16) for x, w in [(-.9, .02), (-1.0, .13), (-1.4, .17), (-2.1, .17), (-2.4, .1), (-2.5, .02)]], 'blue', parent=R)
      for k in range(3):
        xc = -2.0 - k * .13
        pts = [(xc + .07, 1.01), (xc - .03, .9), (xc + .07, .79), (xc + .03, .79), (xc - .07, .9), (xc + .03, 1.01)]
        slab(f'nacchev_{sd}{k}', pts, .02, 'white', z=s * (1.15 + .283), parent=R)
      nac = [o for o in list(COL.objects) if o.parent == R and (o.name.startswith(f'nacelles__') and not o.name.startswith('nacelles__base') and o.name.endswith(sd) or o.name.startswith(f'nacchev_{sd}'))]
      for o in nac: o.parent = None
      join(f'nacelles_{sd}', nac, parent=R, origin=(-1.55, .9, cz))
      # fan wing (circuit mode only), after the kit paint-guide top/side drawings: the root sits over the deck inboard of the
      # nacelle, the blade passes just above the nacelle top with ~11 deg dihedral and is barely swept (tip only .14 m back)
      L = 1.25; LR, TR, LT, TT = -1.7, -2.06, -1.84, -2.14
      fw = flat(f'fw_{sd}', [(LR, 0), (TR, 0), (TT, s * L), (LT, s * L)], .04, 'blue', y=0, bevel=.012)
      top = flat(f'fwt_{sd}', [(-1.92, 0), (TR, 0), (TT, s * L), (-2.02, s * L)], .01, 'lblue', y=.024, bevel=.003)
      ang = math.atan2(-s * L, TT - TR)
      sun = text_up(f'fws_{sd}', 'SUNSET', AB, .12, 'yellow', (-2.03, .03, s * .64), yaw=ang + (math.pi if s > 0 else 0))
      tip = flat(f'fwl_{sd}', [(TR + (TT - TR) * t + dx, s * L * t) for t, dx in ((.62, 0), (1.0, 0), (1.0, .07), (.62, .07))], .05, 'lamp', y=.0)
      fwj = join(f'fanwings_{sd}', [fw, top, sun, tip], origin=(-1.88, 0, 0))
      fwj.location = P(-1.88, 1.1, s * .5)
      fwj.rotation_euler = (math.radians(-11 * s), 0, 0)
      fwj.parent = R
      slab(f'fanwings__pyl_{sd}', [(-1.76, 1.1), (-2.02, 1.1), (-2.0, 1.19), (-1.8, 1.19)], .03, 'blue', z=s * 1.0, bevel=.01, parent=R)
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
      text_decal(f'marks__S_{sd}', 'S', AB, .42, 'red', (-.22, .78, s * .32), sd, shear=.25, target=hmp, parent=R)
      text_decal(f'marks__one_{sd}', '1', TB, .36, 'red', (-1.04, .5, s * PZ[sd]), sd, parent=R)
      text_decal(f'marks__kazami_{sd}', 'H.KAZAMI', AB, .06, 'black', (.02, .57, s * .31), sd, target=hmp, parent=R)
  return nose

# =====================================================================
# 凰呀 AN-21 (Aoi Ogre, Bleed Kaga's #5 in SIN), after photos of a finished 1/24 Aoshima kit (Mobile01 t=3103136).
# Scale from the side shot: rear wheel r=.33 -> ~197 px/m.  Page coords as above.
OFX, OFZ = (1.33, .82), 1.2           # front axles (side photo: 3.0 m / 2.5 m ahead of the rear axle), right behind the white fender pods
def band_ring(x, y, hw, hh, j0, j1, k_out, k_in, n=2.6, N=24, cz=0.0):
  """thin strip lying on a superellipse section between ring indices j0..j1 (outer copy scaled k_out, inner k_in)"""
  o = se_ring(x, y, hw * k_out, hh * k_out, n=n, N=N, cz=cz); i = se_ring(x, y, hw * k_in, hh * k_in, n=n, N=N, cz=cz)
  return [o[j] for j in range(j0, j1 + 1)] + [i[j] for j in range(j1, j0 - 1, -1)]

def skin_strip(name, lower, upper, side, mat, target, off=.006, parent=None, n=40, m=4, axis='z'):
  """ribbon between two side-view polylines (x, y), projected along page z onto `target`'s outer surface
     (axis='x': front-view polylines (z, y), projected backward from the front)"""
  def samp(pl, t):
    L = [0]
    for a, b in zip(pl, pl[1:]): L.append(L[-1] + math.hypot(b[0] - a[0], b[1] - a[1]))
    d = t * L[-1]
    for k in range(len(pl) - 1):
      if L[k + 1] >= d:
        u = (d - L[k]) / ((L[k + 1] - L[k]) or 1); return (pl[k][0] + (pl[k + 1][0] - pl[k][0]) * u, pl[k][1] + (pl[k + 1][1] - pl[k][1]) * u)
    return pl[-1]
  V, F = [], []
  for i in range(n + 1):
    a, b = samp(lower, i / n), samp(upper, i / n)
    for j in range(m + 1):
      u, v = a[0] + (b[0] - a[0]) * j / m, a[1] + (b[1] - a[1]) * j / m
      V.append((u, v, side * 2.5) if axis == 'z' else (5.0, v, u))
  for i in range(n):
    for j in range(m): F.append((i * (m + 1) + j, (i + 1) * (m + 1) + j, (i + 1) * (m + 1) + j + 1, i * (m + 1) + j + 1))
  ob = mesh_from(name, V, F, mat)
  sw = ob.modifiers.new('sw', 'SHRINKWRAP'); sw.target = target; sw.wrap_method = 'PROJECT'
  if axis == 'z': sw.use_project_y = True
  else: sw.use_project_x = True
  sw.use_negative_direction = True; sw.use_positive_direction = True; sw.offset = off; sw.wrap_mode = 'OUTSIDE_SURFACE'
  apply_all(ob)
  me = ob.data; bm = bmesh.new(); bm.from_mesh(me)
  bmesh.ops.delete(bm, geom=[v for v in bm.verts if (abs(v.co.y) > 2.2 if axis == 'z' else v.co.x > 4)], context='VERTS')   # rays that missed the body
  bm.to_mesh(me); bm.free()
  for pl in me.polygons: pl.use_smooth = True
  face_out(ob, (lambda c: Vector((0, 0, side))) if axis == 'z' else (lambda c: Vector((1, 0, 0))))
  if parent: ob.parent = parent
  return ob

def build_ogre(R):
  D = 'deep'
  def shield(x, yb, yt, hw):
    """nose/tub section: pointed keel, flanks widest ~70% up, rounded shoulders, flat-ish top"""
    h = yt - yb
    return sym_ring(x, [(0, yb), (.4 * hw, yb + .16 * h), (.8 * hw, yb + .42 * h), (hw, yb + .7 * h), (.93 * hw, yb + .87 * h), (.66 * hw, yb + .97 * h), (.3 * hw, yt), (0, yt)])
  def hit(ob, o, d):
    """first surface point of `ob` along page ray o + t*d (object sits at the origin, modifiers applied)"""
    ok, loc, nrm, _ = ob.ray_cast(P(*o), P(*d).normalized())
    return (Vector((loc.x, loc.z, -loc.y)), Vector((nrm.x, nrm.z, -nrm.y))) if ok else (None, None)
  def polar_strip(name, ob, axis, path, w, mat, off=.004):
    """painted line on a pod-like body: path of (x, phi) with phi the angle round the body axis from the top (+ = toward page +z);
       each point is ray-cast outward from axis(x) -> (y, z) centre, the strip is w wide across the path"""
    def at(x, a):
      yc, zc = axis(x); pt, nm = hit(ob, (x, yc, zc), (0, math.cos(a), math.sin(a)))
      return pt, nm, (pt - Vector((x, yc, zc))).length if pt is not None else 1
    V, F = [], []
    for x, a in path:
      _, _, r = at(x, a); d = w / 2 / max(r, .02)
      for aa in (a - d, a + d):
        pt, nm, _ = at(x, aa); V.append(tuple(pt + nm * off))
    for i in range(len(path) - 1): F.append((2 * i, 2 * i + 1, 2 * i + 3, 2 * i + 2))
    return face_out(mesh_from(name, V, F, mat, parent=R), lambda c: c - Vector((c.x, *axis(c.x))))
  def tube(name, pts, rw, rh, mat, taper=None, seg=10):
    """open tube with a flattened section along a polyline (page coords), capped; taper(t) scales the section"""
    P3 = [Vector(p) for p in pts]; n = len(P3); rings = []
    for i, c in enumerate(P3):
      d = (P3[min(i + 1, n - 1)] - P3[max(i - 1, 0)]).normalized(); sd = d.cross(Vector((0, 1, 0)))
      if sd.length < 1e-3: sd = d.cross(Vector((1, 0, 0)))
      sd.normalize(); up = sd.cross(d).normalized(); k = taper(i / (n - 1)) if taper else 1
      rings.append([tuple(c + sd * math.cos(j / seg * math.tau) * rw * k + up * math.sin(j / seg * math.tau) * rh * k) for j in range(seg)])
    return loft(name, rings, mat, lv=1, parent=R)
  # ---------------- nose + tub (side photo, rear wheel r=.33 -> 114 px/m): nose tip x≈2.0 at sill height, tub sill y≈.64 ----------------
  TS = [(2.0, .53, .6, .015), (1.93, .38, .62, .1), (1.82, .27, .63, .19), (1.62, .2, .635, .27), (1.3, .17, .64, .34), (.9, .15, .64, .4), (.4, .15, .64, .44),
        (-.2, .15, .645, .45), (-.8, .16, .65, .43), (-1.5, .18, .67, .38), (-2.1, .22, .7, .33), (-2.55, .3, .72, .26)]
  nose = loft('nose', [shield(*t) for t in TS], D, parent=R)
  apply_all(nose)
  # the one continuous line: white shoulder band with a red pin under it, from the nose tip back to the rear-pod collar
  skin_strip('nose__band_L', [(1.8, .585), (1.2, .578), (0, .578), (-.66, .584)], [(1.8, .6), (1.62, .615), (1.4, .63), (1.2, .648), (0, .652), (-.66, .656)], 1, 'white', nose, parent=R)
  skin_strip('nose__band_R', [(1.8, .585), (1.2, .578), (0, .578), (-.66, .584)], [(1.8, .6), (1.62, .615), (1.4, .63), (1.2, .648), (0, .652), (-.66, .656)], -1, 'white', nose, parent=R)
  for s, sd in ((1, 'L'), (-1, 'R')):
    skin_strip(f'nose__pin_{sd}', [(1.8, .558), (1.2, .552), (0, .552), (-.66, .556)], [(1.8, .585), (1.2, .578), (0, .578), (-.66, .584)], s, 'red', nose, parent=R, m=1)
  # front view: the band wraps the nose front as a V (red pin on its inner edge), orange lamps along it
  # (o90: the white collar round the nose front is a broad U that carries the lamps, not a thin pin)
  # (kept to |z| < .18 and below the top: further out the rays graze the flank / top and tear; the side band takes over there)
  skin_strip('nose__band_f', [(-.18, .51), (0, .37), (.18, .51)], [(-.18, .59), (-.1, .572), (0, .56), (.1, .572), (.18, .59)], 1, 'white', nose, parent=R, axis='x')
  skin_strip('nose__pin_f', [(-.18, .484), (0, .344), (.18, .484)], [(-.18, .51), (0, .37), (.18, .51)], 1, 'red', nose, parent=R, axis='x', m=1)
  # front photos: two big orange lamps per side sit on the band's lower edge, the inner pair low beside the tip
  for z, y, sc in ((.07, .415, .95), (.16, .48, 1.05)):
    for s in (1, -1):
      p, n = hit(nose, (4, y, s * z), (-1, 0, 0))
      if p is None: continue
      bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=10, radius=1); l = bpy.context.active_object; l.name = 'nose__lamp'
      l.scale = (.022 * sc, .042 * sc, .025 * sc); l.rotation_euler = (math.radians(-38 * s), 0, 0)
      l.location = P(*(p + n * .01)); l.data.materials.append(M('orange')); l.parent = R
  # green gem: a long faceted lozenge lying on the nose top ahead of the canopy tip (front / top photos), dark X badge at the tip
  G = [(1.95, .616, 0), (1.87, .63, .06), (1.74, .638, .075), (1.64, .642, 0), (1.74, .638, -.075), (1.87, .63, -.06)]
  mesh_from('nose__gem', G + [(1.82, .688, .028), (1.75, .694, 0), (1.82, .688, -.028), (1.89, .67, 0)],
            [(0, 1, 9), (1, 2, 6), (1, 6, 9), (2, 3, 7), (2, 7, 6), (3, 4, 7), (4, 8, 7), (4, 5, 8), (5, 9, 8), (5, 0, 9), (6, 7, 8), (6, 8, 9),
             (5, 4, 3, 2, 1, 0)], 'green', smooth=False, parent=R)
  p, n = hit(nose, (4, .43, 0), (-1, 0, 0))
  if p is not None:
    xb = [rod_between('x', tuple(p + n * .008 + Vector((0, dy, dz))), tuple(p + n * .008 - Vector((0, dy, dz))), .007, 'deep') for dy, dz in ((.03, .035), (.03, -.035))]
    join('nose__badge', xb, parent=R)
  # ---------------- canopy: long, tall bubble peaking over the driver (y≈.98 at x≈.45), blending into the rear deck ----------------
  can = [(1.64, .02, .02), (1.5, .09, .07), (1.25, .17, .16), (.9, .24, .27), (.45, .27, .34), (0, .27, .33), (-.4, .25, .3), (-.66, .2, .26), (-.8, .1, .16)]
  loft('canopy', [se_ring(x, .62, hw, hh, n=2.3, N=18) for x, hw, hh in can], 'glassg', parent=R)
  flat('canopy__well', [(1.5, .04), (1.2, .16), (.8, .22), (.1, .24), (-.5, .16), (-.5, -.16), (.1, -.24), (.8, -.22), (1.2, -.16), (1.5, -.04)], .01, 'black', y=.63, parent=R)
  loft('driver__seat', [se_ring(x, y, w, h, 3, 0, 14) for x, y, w, h in [(.02, .8, .02, .02), (.06, .8, .15, .14), (.14, .72, .16, .1), (.2, .67, .15, .05)]], 'black', parent=R)
  loft('driver__body', [se_ring(x, y, w, h, 2.4, 0, 16) for x, y, w, h in [(.1, .7, .1, .06), (.16, .74, .19, .09), (.28, .73, .2, .08), (.52, .7, .15, .06), (.85, .67, .1, .05)]], 'purple', parent=R)
  helm = bpy.data.objects.new('driver__helmet', bpy.data.meshes.new('h')); bm = bmesh.new()
  bmesh.ops.create_uvsphere(bm, u_segments=32, v_segments=20, radius=1); bm.to_mesh(helm.data); bm.free()
  for pl in helm.data.polygons: pl.use_smooth = True
  link(helm, R); helm.data.materials.append(M('white')); helm.scale = (.13, .11, .12); helm.location = P(.24, .8, 0)
  vis = bpy.data.objects.new('driver__visor', bpy.data.meshes.new('v')); bm = bmesh.new()
  bmesh.ops.create_uvsphere(bm, u_segments=24, v_segments=14, radius=1); bm.to_mesh(vis.data); bm.free()
  for pl in vis.data.polygons: pl.use_smooth = True
  link(vis, R); vis.data.materials.append(M('green')); vis.scale = (.085, .085, .05); vis.location = P(.31, .81, 0)
  for sd, s in (('L', 1), ('R', -1)):
    arm = [rod_between('a1', (.2, .77, s * .17), (.4, .7, s * .19), .035, 'purple'), rod_between('a2', (.4, .7, s * .19), (.6, .71, s * .09), .03, 'purple')]
    join(f'driver__arm_{sd}', arm + [cyl('g', .035, .06, 'black', loc=(.6, .71, s * .09), axis='z', verts=12)], parent=R)
  # ---------------- rear body (kit paint-guide top/side/rear drawings, 126 px/m): ONE wide body across the car ----------------
  # the two halves meet on the centre line (a shallow groove); plan is a rectangle x -1.1..-2.5, |z| < 1.55, whose front
  # carries two lobes per side (inner lobe beside the canopy tail, outer lobe) with a recessed notch between them;
  # four boosters: the inner pair almost touching on the centre line and sitting lower, the outer pair at the corners
  H1, H2 = .3, 1.3                      # inner / outer booster centre lines (|z|)
  def rb(x, yb, yt, zi, zo):
    # flat folded top (o86/o94): chamfered outer edge, a shallow fold between the booster lines that deepens toward the tail,
    # so from behind each half reads as two hoods (o78); the inner edge rounds into the centre groove
    mid = (H1 + H2) / 2; t = min(1, max(0, (-1.9 - x) / .58)); dip = .025 + .1 * t
    return [(x, yb, zi), (x, yb, zo), (x, yt - .24, zo), (x, yt - .09, zo - .03), (x, yt - .015, zo - .15), (x, yt, H2), (x, yt - dip, mid),
            (x, yt - .05 * t, H1), (x, yt - .03 - .05 * t, zi + .07), (x, yt - .07 - .05 * t, zi + .015), (x, yt - .13 - .05 * t, zi)]
  CR = {0: 1, 1: 1, 2: .95, 3: .95, 4: .95, 6: .9, 8: .8, 9: .8, 10: .9}   # crisp longitudinal folds, smooth along the length
  BOD = [(-.4, .6, .92, .02, 1.5), (-.52, .52, .98, .02, 1.55), (-.72, .5, 1.02, .02, 1.55), (-1.1, .5, 1.06, .02, 1.55), (-1.6, .5, 1.1, .02, 1.55),
         (-2.0, .52, 1.11, .02, 1.54), (-2.3, .56, 1.1, .02, 1.53), (-2.43, .6, 1.07, .02, 1.52), (-2.48, .62, 1.04, .02, 1.5)]   # extra ring squares off the tail cap
  # front outline in plan (x at |z|): inner lobe tip beside the canopy, notch, outer lobe tip
  FO = [(0, -.56), (.1, -.5), (.22, -.45), (.36, -.5), (.5, -.66), (.6, -.9), (.75, -1.04), (.88, -1.02), (1.0, -.9), (1.15, -.72), (1.28, -.63), (1.42, -.7), (1.5, -.85), (1.56, -1.05)]
  def front_x(z):
    z = abs(z)
    for (z0, x0), (z1, x1) in zip(FO, FO[1:]):
      if z <= z1: return x0 + (x1 - x0) * (z - z0) / (z1 - z0)
    return FO[-1][1]
  for s, sd in ((1, 'L'), (-1, 'R')):
    # collar + body are ONE loft (two separately capped lofts shrink apart under subsurf and open a crack at the joint);
    # the collar is just the white material on the lobes
    body = loft(f'rbody_{sd}', mirror([rb(*r) for r in BOD], s), D, lv=0, parent=R, creases=CR)
    subsurf(body, 2); apply_all(body)
    # lobes: a vertical prism cuts away everything ahead of the plan outline
    pl_ = [(x, z) for z, x in FO] + [(-1.3, 1.7), (1.0, 1.7), (1.0, -.1), (FO[0][1], -.1)]
    npl = len(pl_)
    cut = mesh_from('cut', [(x, .2, s * z) for x, z in pl_] + [(x, 1.6, s * z) for x, z in pl_],
                    [tuple(range(npl)), tuple(range(npl, 2 * npl))[::-1]] + [(j, (j + 1) % npl, npl + (j + 1) % npl, npl + j) for j in range(npl)], 'black', smooth=False)
    boolean_cut(body, cut); bpy.data.objects.remove(cut, do_unlink=True)
    # slice the mesh along the colour boundaries first, so the white/dark split follows the line instead of stair-stepping by face
    bm = bmesh.new(); bm.from_mesh(body.data)
    cuts = [((front_x(z) - .3, z), (front_x(z2) - .3, z2)) for z, z2 in zip([f[0] for f in FO], [f[0] for f in FO][1:])]
    for (x0, z0), (x1, z1) in cuts:
      dx, dz = x1 - x0, s * (z1 - z0)
      bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], dist=1e-5, plane_co=P(x0, 0, s * z0), plane_no=Vector((dz, dx, 0)).normalized())
    for co, no in ((P(0, 0, s * 1.38), Vector((0, 1, 0))), (P(0, .95, 0), Vector((0, 0, 1))), (P(-1.0, 0, 0), Vector((1, 0, 0))), (P(-2.5, 0, 0), Vector((1, 0, 0)))):
      bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], dist=1e-5, plane_co=co, plane_no=no)
    bm.to_mesh(body.data); bm.free()
    # (the boolean left the cutter's black on the lobe walls: slots are looked up by name, and the walls go back to body colour)
    body.data.materials.append(M('white'))
    ms = [m.name for m in body.data.materials]; iD, iW = ms.index(D), ms.index('white')
    for pl in body.data.polygons:
      c = pl.center; px_, py_, pz_ = c.x, c.z, abs(c.y)
      pl.material_index = iD
      # white: the lobes' collar, and the strip along the top outer edge (drawing: "ARD" band outside the deck plate)
      if px_ > front_x(pz_) - .3 or (pz_ > 1.38 and py_ > .95 and -2.5 < px_ < -1.0): pl.material_index = iW
    col = body
    arch = cyl('cut', .35, .74, 'black', loc=(RX, RR, s * RZ), axis='z', verts=64)   # hugs the tyre (o85), leaving room for the lower band over it
    boolean_cut(body, arch); bpy.data.objects.remove(arch, do_unlink=True)
    # tail between the two hoods: the deck's trailing edge is notched forward down to the red louvre bar (o94)
    nt = [(-2.3, .8), (-2.7, .58), (-2.7, 1.02)]
    cut = mesh_from('cut', [(x, .98, s * z) for x, z in nt] + [(x, 1.4, s * z) for x, z in nt],
                    [(2, 1, 0), (3, 4, 5), (0, 1, 4, 3), (1, 2, 5, 4), (2, 0, 3, 5)], 'black', smooth=False)
    boolean_cut(body, cut); bpy.data.objects.remove(cut, do_unlink=True)
    ms = [m.name for m in body.data.materials]
    for pl in body.data.polygons:
      if ms[pl.material_index] == 'black' and pl.center.x < -2.2: pl.material_index = ms.index(D)
    # one scoop intake on each lobe (front drawing: inner eye beside the canopy, big outer eye): eye-shaped mouths with a rolled
    # white rim standing proud of the collar, the mesh set deep and raked back so it catches light under the white brow
    eyes = []
    for k, (zc, kw) in enumerate(((.4, .6), (1.25, .85))):
      hx = [(zc - .24 * kw, .79), (zc - .17 * kw, .88), (zc - .04 * kw, .925), (zc + .12 * kw, .915), (zc + .24 * kw, .82), (zc + .15 * kw, .72), (zc - .14 * kw, .715)]
      n7 = len(hx); xf = front_x(zc)
      cut = mesh_from('cut', [(xf + .3, y, s * z) for z, y in hx] + [(xf - .38, y, s * z) for z, y in hx],
                      [tuple(range(n7))[::-1], tuple(range(n7, 2 * n7))] + [(j, (j + 1) % n7, n7 + (j + 1) % n7, n7 + j) for j in range(n7)], 'black', smooth=False)
      boolean_cut(col, cut); bpy.data.objects.remove(cut, do_unlink=True)
      mesh_from(f'rbody__mesh_{sd}{k}', [(xf - .16 - (y - .7) * .9, y, s * z) for z, y in hx], [tuple(range(n7))], 'mesh', smooth=False, parent=R)
      eyes.append(hx)
    for k, hx in enumerate(eyes):
      rim = []
      cz_ = sum(z for z, y in hx) / len(hx); cy_ = sum(y for z, y in hx) / len(hx)
      for z, y in densify(hx, .03):
        dz, dy = z - cz_, y - cy_; L = math.hypot(dz, dy) or 1
        p, _ = hit(col, (4, y + dy / L * .03, s * (z + dz / L * .03)), (-1, 0, 0))   # just outside the mouth, on the collar face
        rim.append((p.x + .004 if p is not None and p.x > front_x(z) - .25 else front_x(z) - .02, y, s * z))
      sweep_loop(f'rbody__rim_{sd}{k}', rim, .022, .018, 'white', parent=R)
    # the notch face between the lobes reads as a dark slot band with a small white fin in it (front drawing)
    slab(f'rbody__slot_{sd}', [(-.96, .69), (-1.2, .69), (-1.2, .79), (-.96, .79)], .5, 'black', z=s * .8, parent=R)
    slab(f'rbody__splitter_{sd}', [(-.98, .66), (-1.14, .66), (-1.14, .84), (-1.04, .8)], .035, 'white', z=s * .8, bevel=.006, parent=R)
    # red lip: a thick rolled edge under each lobe (two tubes: the ray hits jump back across the notch), the outer one hooking
    # down into a point at the outer front corner
    for nm, pts in (('i', [(.06, .57), (.2, .56), (.34, .56), (.48, .575)]), ('o', [(1.02, .6), (1.15, .59), (1.3, .585), (1.45, .575), (1.53, .56)])):
      lip = []
      for z, y in pts:
        p, _ = hit(col, (4, y, s * z), (-1, 0, 0))
        if p is not None: lip.append((p.x - .005, y, s * z))
      if nm == 'o':
        xe, ye, ze = lip[-1]
        lip += [(xe + .01, ye - .05, s * (abs(ze) + .02)), (xe + .02, ye - .11, s * (abs(ze) + .025)), (xe + .035, ye - .17, s * (abs(ze) + .02))]
        tube(f'rbody__facered_{sd}{nm}', lip, .046, .028, 'red', taper=lambda t: 1 if t < .6 else max(.15, 1 - (t - .6) / .4 * .85))
      else:
        tube(f'rbody__facered_{sd}{nm}', lip, .046, .028, 'red')
    # pod side: white band / wavy red stripe / white band, rising toward the boosters (dips over the wheel)
    red = [(-.55, .585), (-.99, .643), (-1.43, .702), (-1.72, .754), (-2.02, .737), (-2.31, .754), (-2.4, .754)]
    skin_strip(f'rbody__red_{sd}', [(x, y - .036) for x, y in red], [(x, y + .036) for x, y in red], s, 'red', body, off=.004, parent=R)
    # the upper white band runs right up to the flank's top fold (o86), so no dark sliver shows between it and the deck
    skin_strip(f'rbody__band_{sd}', [(x, y + .03) for x, y in red], [(x, t) for (x, y), t in zip(red, (.815, .84, .86, .87, .87, .85, .8))], s, 'white', body, off=.0025, parent=R)
    # lower white band runs on over the wheel arch (squeezed thin between arch and red) and widens again behind it to the booster (o85)
    # (its top tucks under the red stripe, drawn a hair lower so the two never z-fight; it stops short of the tail cap)
    lo = [(-.55, .52, .56), (-1.0, .525, .62), (-1.3, .6, .66), (-1.45, .668, .7), (-1.68, .69, .73), (-1.9, .672, .72), (-2.1, .62, .715), (-2.31, .64, .73), (-2.4, .67, .73)]
    skin_strip(f'rbody__bandlo_{sd}', [(x, a) for x, a, b in lo], [(x, b) for x, a, b in lo], s, 'white', body, off=.0025, parent=R)
    cyl(f'rbody__well_{sd}', .355, .012, 'black', loc=(RX, RR, s * .93), axis='z', verts=48).parent = R
    # outer leg in front of the wheel: a dark skirt with a forward-pointing toe on the ground, green 5 on it
    # (o84: the front edge is a concave sweep ending in a sharp toe, with a raked vent slot just behind it)
    leg = slab(f'rbody__leg_{sd}', [(-.3, .0), (-1.42, .01), (-1.42, .56), (-.56, .56), (-.61, .44), (-.63, .31), (-.58, .18), (-.47, .07)], .06, D, z=s * 1.58, bevel=.006, parent=R)
    apply_all(leg); arch = cyl('cut2', .38, .3, 'black', loc=(RX, RR, s * 1.58), axis='z', verts=64); boolean_cut(leg, arch)
    bpy.data.objects.remove(arch, do_unlink=True)
    slot = slab('cut3', [(-.71, .46), (-.77, .46), (-.73, .17), (-.67, .19)], .2, 'black', z=s * 1.58); boolean_cut(leg, slot)
    bpy.data.objects.remove(slot, do_unlink=True)
    # under the collar: an inner skirt and a dark radiator panel set back, so the pod reads solid from the front (dark legs at both edges)
    slab(f'rbody__skirt_{sd}', [(-.5, .1), (-1.2, .08), (-1.2, .54), (-.56, .54)], .05, D, z=s * .44, bevel=.006, parent=R)
    slab(f'rbody__duct_{sd}', [(-.74, .1), (-.84, .1), (-.84, .52), (-.74, .52)], 1.1, 'black', z=s * 1.0, parent=R)
    # behind the wheel: a down-swept tail skirt and a flat blade near the ground
    slab(f'rbody__tail_{sd}', [(-2.0, .56), (-2.47, .64), (-2.64, .3), (-2.36, .2), (-2.12, .34)], .05, D, z=s * 1.5, bevel=.006, parent=R)
    flat(f'rbody__blade_{sd}', [(-2.14, s * 1.2), (-2.74, s * 1.3), (-2.74, s * 1.6), (-2.3, s * 1.6)], .025, D, y=.17, bevel=.004, parent=R)
    slab(f'rbody__lamp_{sd}', [(-2.26, .5), (-2.44, .53), (-2.44, .58), (-2.26, .55)], .012, 'red', z=s * 1.555, parent=R)
    # ---------------- boosters: rounded-diamond red housings (rear drawing: framed bezel, recessed face), gold spikes ----------------
    # the inner pair sits lower and almost touches on the centre line, the outer pair is larger and higher
    BZ = ((H1, .77, .9), (H2, .92, 1.1))
    for k, (bz, by, sc) in enumerate(BZ):
      loft(f'boosters_{sd}{k}', [se_ring(x, by, w * sc, w * sc, 1.35, s * bz, 24) for x, w in [(-2.3, .08), (-2.42, .17), (-2.64, .19), (-2.72, .19), (-2.73, .135), (-2.68, .11)]], 'red', parent=R)
      cn = cyl(f'boosters__cone_{sd}{k}', .11 * sc, .3, 'gold', loc=(-2.83, by, s * bz), axis='x', verts=24, r2=.004); cn.rotation_euler = (0, math.radians(-90), 0); cn.parent = R
    # red louvre bar between the inner and outer housing, sloping with their heights; three dark slots on its back face
    def sbar(name, z0, y0, z1, y1, x0, x1, h, mat):
      v = [(x, y + dy, s * z) for (z, y) in ((z0, y0), (z1, y1)) for x in (x0, x1) for dy in (-h, h)]
      return mesh_from(name, v, [(0, 1, 3, 2), (4, 6, 7, 5), (0, 2, 6, 4), (1, 5, 7, 3), (0, 4, 5, 1), (2, 3, 7, 6)], mat, smooth=False)
    (z0, y0, _), (z1, y1, _) = BZ
    bar = [sbar('b', z0 + .12, y0 + .02, z1 - .16, y1 - .01, -2.5, -2.64, .07, 'red')]
    for dy in (-.035, 0, .035):
      bar.append(sbar('q', z0 + .17, y0 + .02 + dy, z1 - .21, y1 - .01 + dy, -2.635, -2.648, .007, 'black'))
    join(f'boosters__bar_{sd}', bar, parent=R)
    # ---------------- horn blade (kit drawings + front photo): one thin curved blade per side, straight along the car ----------------
    # its cross-section (front/rear views) is an arc rising from the outer corner, above the outer booster, to a tip over the inner
    # one, so head-on and from behind it is only an edge and the two read as one big arch with air under it; from above it is
    # the trapezoidal plate of the top drawing (rear edge -2.73 -> -2.47, front edge -1.93 -> -2.2); outboard it sinks into the deck
    NU = 14
    def blade(name, xa, xb, th, mat):
        rings = []
        for i in range(NU + 1):
          u = i / NU; z = 1.52 - 1.07 * u; y = 1.04 + .32 * math.sin(u * math.pi / 2)
          dz, dy = -1.07, .32 * math.pi / 2 * math.cos(u * math.pi / 2); L = math.hypot(dz, dy); nz, ny = -dy / L, dz / L
          if ny < 0: nz, ny = -nz, -ny
          x0, x1 = xa(u), xb(u)
          rings.append([(x0, y - ny * th, z - nz * th), (x1, y - ny * th, z - nz * th), (x1, y + ny * th, z + nz * th), (x0, y + ny * th, z + nz * th)])
        return loft(name, mirror(rings, s), mat, lv=0, parent=R)
    xr = lambda u: -2.73 + .26 * u; xf = lambda u: -1.93 - .27 * u
    blade(f'rbody__deck_{sd}', lambda u: xr(u) + .06, xf, .016, D)
    # white rear edge wrapping the blade's trailing edge: the "horn" line seen from behind and from above
    blade(f'horns_{sd}', lambda u: xr(u) - .005, lambda u: xr(u) + .085, .022, 'white')
    # ======== aero mode (エアロモード, promo still): parts named "__aero" appear only in aero mode ========
    # rear: two long faceted booster nacelles per side riding on the pod humps — white V-collar round a dark intake,
    # violet body with a white spine stripe, faceted red tail block with a dark nozzle; the outer one carries a tall swept fin
    def hexr(x, zc, w, yb, yt):
      h = yt - yb
      return [(x, yb, zc - .55 * w), (x, yb, zc + .55 * w), (x, yb + .55 * h, zc + w), (x, yt, zc + .62 * w), (x, yt, zc - .62 * w), (x, yb + .55 * h, zc - w)]
    for k, zc in enumerate((.64, 1.3)):
      nb = loft(f'boosters__aero_{sd}{k}', mirror([hexr(x, zc, w, yb, yt) for x, w, yb, yt in
               [(-.98, .17, 1.0, 1.3), (-1.4, .17, 1.0, 1.32), (-1.9, .17, 1.0, 1.33), (-2.34, .17, 1.0, 1.34)]], s), D, lv=0, parent=R)
      # white collar: the lower edge juts forward, so from the side the front reads as a V
      col2 = loft(f'boosters__aero_col_{sd}{k}', mirror([[(x + dx * (1 - (y - 1.0) / .38), y, z) for x, y, z in hexr(-1.0, zc, w, 1.0, yt)] for dx, w, yt in
               [(.2, .2, 1.37), (.02, .2, 1.37), (-.04, .18, 1.34)]], s), 'white', lv=0, parent=R)
      hx = [(zc - .155, 1.22), (zc - .09, 1.32), (zc + .09, 1.32), (zc + .155, 1.22), (zc + .07, 1.04), (zc - .07, 1.04)]   # big opening: the collar reads as a thin white frame
      cut = mesh_from('cut', [(-.6, y, s * z) for z, y in hx] + [(-.97, y, s * z) for z, y in hx],
                      [tuple(range(6))[::-1], tuple(range(6, 12))] + [(j, (j + 1) % 6, 6 + (j + 1) % 6, 6 + j) for j in range(6)], 'black', smooth=False)
      boolean_cut(col2, cut); bpy.data.objects.remove(cut, do_unlink=True)
      mesh_from(f'boosters__aero_in_{sd}{k}', [(-.95, y, s * z) for z, y in hx], [tuple(range(6))], 'black', smooth=False, parent=R)
      # white stripe along the spine, red faceted tail block, dark hex nozzle
      flat(f'boosters__aero_st_{sd}{k}', [(-1.15, s * (zc - .045)), (-2.2, s * (zc - .045)), (-2.2, s * (zc + .045)), (-1.15, s * (zc + .045))], .012, 'white', y=1.335, parent=R)
      loft(f'boosters__aero_tail_{sd}{k}', mirror([hexr(x, zc, w, yb, yt) for x, w, yb, yt in [(-2.3, .185, .99, 1.36), (-2.56, .19, .98, 1.37), (-2.7, .15, 1.02, 1.32)]], s), 'red', lv=0, parent=R)
      nz = [(zc - .09, 1.17), (zc - .05, 1.25), (zc + .05, 1.25), (zc + .09, 1.17), (zc + .05, 1.08), (zc - .05, 1.08)]
      mesh_from(f'boosters__aero_noz_{sd}{k}', [(-2.705, y, s * z) for z, y in nz], [tuple(range(6))], 'black', smooth=False, parent=R)
      if k == 1:
        slab(f'boosters__aero_fin_{sd}', [(-1.95, 1.3), (-2.42, 1.3), (-2.8, 1.98), (-2.66, 2.0), (-2.2, 1.52)], .04, D, z=s * (zc + .02), bevel=.008, parent=R)
    # front: a boat-shaped cowl enclosing both front wheels — pointed dark prow low at the front, white deck, violet flanks, red pin line
    fc = [(2.52, .02, .06, .1), (2.3, .12, .06, .3), (2.02, .19, .08, .5), (1.6, .215, .1, .58), (1.0, .215, .1, .6), (.6, .2, .12, .58), (.42, .16, .16, .52)]
    cw = loft(f'fpods__aero_{sd}', mirror([hexr(x, OFZ, w, yb, yt) for x, w, yb, yt in fc], s), D, lv=0, parent=R)
    bvl = cw.modifiers.new('bv', 'BEVEL'); bvl.width = .012; bvl.segments = 2; bvl.limit_method = 'ANGLE'; apply_all(cw)
    cw.data.materials.append(M('white'))
    for pl in cw.data.polygons:
      if pl.normal.z > .5 and pl.center.x < 2.2: pl.material_index = 1      # blender z = page y: upward-facing deck
    skin_strip(f'fpods__aero_pin_{sd}', [(2.2, .3), (1.6, .43), (.5, .45)], [(2.2, .33), (1.6, .46), (.5, .48)], s, 'red', cw, off=.004, parent=R, n=24, m=1)
    text_up(f'fpods__aero_five_{sd}', '5', AB, .26, 'teal', (1.2, .607, s * OFZ), yaw=math.radians(90), parent=R)
    # ---------------- front fender pods: white wedges right ahead of the front wheels (pointed keel, red check on the flank) ----------------
    def tear(x, yb, yt, hw):
      h = yt - yb
      return sym_ring(x, [(0, yb), (.55 * hw, yb + .2 * h), (.97 * hw, yb + .55 * h), (.9 * hw, yb + .8 * h), (.48 * hw, yb + .95 * h), (0, yt)])
    # front photos: a raised crest runs the length of the top (the pod reads as an arch head-on), keel crisp where the dark blade meets it
    fp = [(2.4, .17, .2, .008), (2.3, .15, .24, .045), (2.2, .13, .28, .075), (2.0, .1, .37, .115), (1.8, .08, .46, .145), (1.6, .07, .545, .158), (1.52, .07, .57, .155)]
    pod = loft(f'fpods_{sd}', [[(x, y, z + s * OFZ) for x, y, z in tear(*r)] for r in fp], 'white', parent=R, creases={0: 1, 5: .7})
    apply_all(pod)
    # red arrow painted on each pod (top photo o80): a shaft along the crest from the tip back to an apex near the tail,
    # two barbs running forward-down both flanks (side view o88 reads it as a V)
    def pax(x):
      for a, b in zip(fp, fp[1:]):
        if a[0] >= x >= b[0]:
          t = (a[0] - x) / (a[0] - b[0]); yb = a[1] + (b[1] - a[1]) * t; yt = a[2] + (b[2] - a[2]) * t
          return yb + (yt - yb) * .55, s * OFZ
      return .3, s * OFZ
    polar_strip(f'marks__arrow_{sd}', pod, pax, [(2.3 - .06 * i, 0) for i in range(12)] + [(1.6, 0)], .03, 'red')
    for sg in (1, -1):
      polar_strip(f'marks__barb_{sd}{"o" if sg * s > 0 else "i"}', pod, pax, [(1.6 + .03 * i, sg * math.radians(3 + 7 * i)) for i in range(12)], .03, 'red')
    # dark blades: under each pod down to a ground spike, one outboard, and the jagged lower edge of the wing
    slab(f'fwing__blade_{sd}', [(2.66, .01), (1.58, .0), (1.56, .2), (1.8, .12), (2.33, .17)], .04, 'black', z=s * OFZ, bevel=.004, parent=R)
    slab(f'fwing__blade2_{sd}', [(2.42, .01), (1.72, .01), (1.72, .19), (2.0, .19)], .03, 'black', z=s * 1.45, bevel=.004, parent=R)
    # white wing plate between the nose and the pod, dark underside with a saw-tooth leading edge
    flat(f'fwing__plate_{sd}', [(1.98, s * .16), (2.2, s * 1.06), (1.7, s * 1.08), (1.62, s * .3)], .035, 'white', y=.25, bevel=.008, parent=R)
    flat(f'fwing__under_{sd}', [(2.02, s * .24), (2.12, s * .5), (2.04, s * .62), (2.28, s * 1.06), (1.7, s * 1.08), (1.62, s * .3)], .025, D, y=.22, parent=R)
    # ---------------- front suspension: slim black rods ----------------
    rods = []
    for x in OFX:
      for dy, dx in ((.07, .17), (.07, -.17), (-.06, .15), (-.06, -.15)):
        rods.append(rod_between('r', (x, FR + dy, s * (OFZ - .14)), (x + dx, .3 + dy, s * .36), .016, 'black'))
      rods.append(rod_between('p', (x, FR - .05, s * (OFZ - .15)), (x - .1, .56, s * .38), .011, 'silver'))
      rods.append(cyl('brk', .13, .08, 'black', loc=(x, FR, s * (OFZ - .13)), axis='z', verts=24, r2=.09))
    join(f'fwheels__susp_{sd}', rods, parent=R)
    for i, x in enumerate(OFX): wheel2(f'fwheels_{sd}{i}', FR, FW, (x, FR, s * OFZ), s, R, 'gold', five=True)
    wheel2(f'rwheels_{sd}', RR, RW, (RX, RR, s * RZ), s, R, 'gold', five=True)
    # ---------------- mid side pods: a white vertical nose just behind the front wheels, dark behind ----------------
    sp = loft(f'pods_{sd}', [se_ring(x, y, hw, hh, n=2.4, N=16, cz=s * .62) for x, y, hw, hh in [(.32, .37, .02, .02), (.26, .37, .09, .16), (.12, .37, .13, .18), (-.3, .37, .14, .18), (-.62, .4, .14, .18)]], D, parent=R)
    sp.data.materials.append(M('white'))
    for pl in sp.data.polygons:
      if pl.center.x > .06: pl.material_index = 1
    # ---------------- rear suspension (mostly hidden inside the body) ----------------
    rods = [rod_between('r', (RX, RR + .08, s * .98), (RX + .2, .45, s * .4), .02, 'black'), rod_between('r', (RX, RR - .08, s * .98), (RX - .2, .25, s * .4), .02, 'black'),
            rod_between('d', (RX, RR, s * .98), (RX, RR + .02, s * .4), .025, 'silver')]
    join(f'rwheels__susp_{sd}', rods, parent=R)
    # ---------------- decals ----------------
    text_decal(f'marks__five_{sd}', '5', AB, .3, 'teal', (-.98, .28, s * 1.7), sd, target=leg, parent=R)
    text_decal(f'marks__kaga_{sd}', 'BLEED KAGA', TB, .045, 'black', (.9, .614, s * .6), sd, target=nose, parent=R)
  slab('fwing__keel', [(2.12, .02), (1.5, .08), (1.5, .2), (1.93, .38), (2.02, .3)], .04, D, bevel=.004, parent=R)
  text_up('marks__five_f', '5', AB, .22, 'teal', (1.86, .27, .66), yaw=math.radians(90), parent=R)
  # tail centre block under the inner boosters (rear drawing): caps the tub end, two round "eyes" low down;
  # between it and the outer legs the tail stays open, the rear suspension shows through
  xw = [(-.5, .64), (.5, .64), (.5, .3), (.4, .1), (-.4, .1), (-.5, .3)]
  nw = len(xw)
  bh = mesh_from('rbody__tailwall_c', [(-2.46, y, z) for z, y in xw] + [(-2.58, y, z) for z, y in xw],
                 [tuple(range(nw)), tuple(range(nw, 2 * nw))[::-1]] + [(j, (j + 1) % nw, nw + (j + 1) % nw, nw + j) for j in range(nw)], D, smooth=False, parent=R)
  bv = bh.modifiers.new('bv', 'BEVEL'); bv.width = .01; bv.segments = 2; bv.limit_method = 'ANGLE'
  for z in (-.2, .2):
    cyl('rbody__eye', .075, .03, 'grey', loc=(-2.585, .27, z), axis='x', verts=24).parent = R
    cyl('rbody__eyein', .05, .032, 'black', loc=(-2.59, .27, z), axis='x', verts=24).parent = R
  flat('rbody__floor', [(1.4, .3), (.6, .45), (-1.9, .45), (-1.9, -.45), (.6, -.45), (1.4, -.3)], .025, 'carbon', y=.06, parent=R)
  return nose

def car(name, Z):
  root = bpy.data.objects.new(name, None); link(root)
  build(root, Z) if Z else build_ogre(root)
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
