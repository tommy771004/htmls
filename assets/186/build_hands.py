# 186 下坡：用 Blender（5.x，無頭模式）程序化建出騎士握著把手的雙手與外套袖子，
# 把膚色／布料、環境光遮蔽與細部法線從高精度模型烘焙到低面數模型，匯出 hands.glb。
# 重建：blender -b --factory-startup -P assets/186/build_hands.py -- /tmp/hands
#   環境變數：GLB=輸出路徑（預設 assets/186/hands.glb）、TEX=貼圖邊長（預設 1024）、SAMPLES=烘焙取樣數、RENDER=1 另存預覽圖
# 兩組手：裸手（港城夜雨，對應參考影片）與長指手套（杉林、雪地）。先建右手，再鏡射出左手。
# 食指有「pull」形狀鍵（扣煞車拉桿），網頁依煞車力道調整權重。
import bpy, bmesh, math, sys, os
import numpy as np
from mathutils import Vector, Matrix

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = sys.argv[sys.argv.index('--') + 1] if '--' in sys.argv else '/tmp/hands'
os.makedirs(OUT, exist_ok=True)
GLB = os.environ.get('GLB', os.path.join(HERE, 'hands.glb'))
TEX = int(os.environ.get('TEX', '1024'))
SAMPLES = int(os.environ.get('SAMPLES', '48'))
RENDER = os.environ.get('RENDER', '1') == '1'

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
COL = scene.collection
scene.render.engine = 'CYCLES'
scene.cycles.samples = SAMPLES
try:
  prefs = bpy.context.preferences.addons['cycles'].preferences
  prefs.compute_device_type = 'METAL'
  prefs.get_devices()
  for d in prefs.devices: d.use = True
  scene.cycles.device = 'GPU'
except Exception as e:
  print('GPU 不可用，改用 CPU', e)

# 網頁的手部座標（原點在握把中心，x 沿握把往外、y 上、z 朝騎士）→ Blender（z 上）
def P(x, y, z): return Vector((x, -z, y))
def Pinv(v): return (v.x, v.z, -v.y)

GRIP_R = 0.0165
# 右手骨架：每指 [掌指關節, 近端指間關節, 遠端指間關節, 指尖]，半徑依序遞減（公尺）
FING = {
  # 中、無名、小指沿握把圓弧包覆（以指骨長度換算圓心角）：指節在握把前上方，手指從前面往下包到底部後方
  'index':  ([(-0.027, 0.024, -0.016), (-0.030, 0.004, -0.050), (-0.032, -0.016, -0.060), (-0.033, -0.030, -0.047)], [0.0098, 0.0092, 0.0084, 0.0077]),
  'middle': ([(-0.006, 0.0254, -0.0178), (-0.006, -0.022, -0.0173), (-0.006, -0.0258, 0.0079), (-0.006, -0.0133, 0.0235)], [0.0100, 0.0093, 0.0086, 0.0079]),
  'ring':   ([(0.014, 0.0251, -0.0182), (0.014, -0.0196, -0.0193), (0.014, -0.0267, 0.0039), (0.014, -0.0175, 0.0205)], [0.0095, 0.0089, 0.0082, 0.0075]),
  'pinky':  ([(0.032, 0.0205, -0.0205), (0.033, -0.0186, -0.0182), (0.034, -0.0259, -0.0017), (0.035, -0.0226, 0.0129)], [0.0084, 0.0078, 0.0072, 0.0066]),
  'thumb':  ([(-0.024, 0.020, 0.050), (-0.040, 0.001, 0.035), (-0.043, -0.021, 0.017), (-0.040, -0.028, -0.004)], [0.0135, 0.0118, 0.0106, 0.0095]),
}
BASES = {'index': (-0.019, 0.035, 0.052), 'middle': (-0.005, 0.037, 0.055), 'ring': (0.008, 0.036, 0.053), 'pinky': (0.020, 0.032, 0.049)}

def link(ob):
  COL.objects.link(ob); return ob
def bm_obj(bm, name):
  me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
  return link(bpy.data.objects.new(name, me))
def activate(*obs, active=None):
  bpy.ops.object.select_all(action='DESELECT')
  for o in obs: o.select_set(True)
  bpy.context.view_layer.objects.active = active or obs[-1]
def apply_mods(ob):
  dg = bpy.context.evaluated_depsgraph_get()
  me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
  ob.modifiers.clear(); old = ob.data; ob.data = me; bpy.data.meshes.remove(old)
def smooth_shade(ob):
  for p in ob.data.polygons: p.use_smooth = True

def add_sphere(bm, c, r, sc=(1, 1, 1)):
  # sc 以網頁軸（x, y, z）給定的橢球比例
  M = Matrix.Translation(P(*c)) @ Matrix.Diagonal((r * sc[0], r * sc[2], r * sc[1], 1))
  bmesh.ops.create_uvsphere(bm, u_segments=28, v_segments=18, radius=1.0, matrix=M)
def add_cone(bm, a, b, ra, rb):
  A, B = P(*a), P(*b); d = B - A
  q = Vector((0, 0, 1)).rotation_difference(d.normalized())
  M = Matrix.Translation((A + B) / 2) @ q.to_matrix().to_4x4()
  bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=28, radius1=ra, radius2=rb, depth=d.length, matrix=M)

# 手掌：由指節列、手背、手腕、兩側與掌根的點取凸包，得到從指節往手腕收窄、微拱的梯形
def add_palm(bm, g):
  pts = []
  for name in ('index', 'middle', 'ring', 'pinky'):
    (x, y, z), r = FING[name][0][0], FING[name][1][0]
    pts.append((x, y + r * 0.72, z + 0.001))                      # 指節背側
    pts.append((x, y - r * 0.2, z + 0.006))
  pts += [(-0.030, 0.043, 0.022), (0.000, 0.045, 0.022), (0.030, 0.041, 0.022),            # 手背中段
          (-0.022, 0.046, 0.064), (0.022, 0.044, 0.064), (0.0, 0.047, 0.064),               # 手腕背側
          (-0.039, 0.030, 0.000), (-0.038, 0.027, 0.035), (0.042, 0.024, 0.000), (0.040, 0.025, 0.035),  # 兩側
          (-0.030, 0.0175, -0.004), (0.035, 0.0170, -0.004), (-0.032, 0.006, 0.030), (0.035, 0.007, 0.030),  # 掌根貼著握把
          (-0.020, 0.022, 0.064), (0.020, 0.022, 0.064)]                                    # 手腕掌側
  c = Vector((sum(p[0] for p in pts), sum(p[1] for p in pts), sum(p[2] for p in pts))) / len(pts)
  tmp = bmesh.new()
  vs = []
  for p in pts:
    v = Vector(p); v = c + (v - c) * 1.1; v = v + (v - c).normalized() * g   # 往外推，補償細分曲面的收縮
    vs.append(tmp.verts.new(P(*v)))
  bmesh.ops.convex_hull(tmp, input=vs)
  ob = bm_obj(tmp, 'palm_tmp')
  sd = ob.modifiers.new('sd', 'SUBSURF'); sd.levels = 3; sd.render_levels = 3
  apply_mods(ob)
  bm.from_mesh(ob.data)
  me = ob.data; bpy.data.objects.remove(ob); bpy.data.meshes.remove(me)

# ───────── 高精度的手 ─────────
def build_hand_hi(glove=False):
  bm = bmesh.new()
  g = 0.0013 if glove else 0.0   # 手套厚度
  for name, (pts, rad) in FING.items():
    for k in range(4):
      kn = 1.03 if k == 0 else 1.06 if k < 3 else 1.0
      add_sphere(bm, pts[k], rad[k] * kn + g)
    for k in range(3):
      add_cone(bm, pts[k], pts[k + 1], rad[k] + g, rad[k + 1] + g)
  add_palm(bm, g)
  add_sphere(bm, (-0.028, 0.015, 0.043), 0.016 + g)                                  # 大魚際
  add_sphere(bm, (0.031, 0.018, 0.036), 0.013 + g)                                   # 小魚際
  add_sphere(bm, (0.0, 0.036, 0.070), 1.0, (0.027 + g, 0.016 + g, 0.018 + g))        # 手腕
  add_sphere(bm, (0.003, 0.039, 0.100), 1.0, (0.025 + g, 0.018 + g, 0.020 + g))
  add_cone(bm, (0.0, 0.036, 0.07), (0.004, 0.041, 0.118), 0.019 + g, 0.02 + g)
  if glove:
    # 魔鬼氈腕帶：略寬的一圈
    add_sphere(bm, (0.002, 0.038, 0.088), 1.0, (0.031, 0.0215, 0.012))
  ob = bm_obj(bm, 'hi_glove' if glove else 'hi_bare')
  r = ob.modifiers.new('rm', 'REMESH'); r.mode = 'VOXEL'; r.voxel_size = 0.0005; r.adaptivity = 0.0
  s = ob.modifiers.new('sm', 'LAPLACIANSMOOTH'); s.iterations = 8; s.lambda_factor = 0.6; s.use_volume_preserve = True
  apply_mods(ob)
  # 皮膚／布料的細小起伏
  tex = bpy.data.textures.new('bump', 'CLOUDS'); tex.noise_scale = 0.0016 if not glove else 0.0022; tex.noise_depth = 2
  d = ob.modifiers.new('dp', 'DISPLACE'); d.texture = tex; d.strength = 0.00012 if not glove else 0.0002; d.mid_level = 0.5
  apply_mods(ob); smooth_shade(ob)
  return ob

def build_sleeve_hi(lo=False):
  # 外套袖子：沿前臂的管子，手腕處有堆疊的環狀皺褶
  # 攻擊姿勢：手肘往外、略高於把手，前臂從手腕往外後方走，上臂再往上接到肩膀
  pts = [P(0.004, 0.037, 0.082), P(0.016, 0.043, 0.11), P(0.07, 0.07, 0.19), P(0.15, 0.12, 0.29), P(0.18, 0.2, 0.36), P(0.16, 0.33, 0.47)]
  def cr(t):
    n = len(pts) - 1; f = min(t * n, n - 1e-6); i = int(f); u = f - i
    p0, p1, p2, p3 = pts[max(i - 1, 0)], pts[i], pts[i + 1], pts[min(i + 2, n)]
    return 0.5 * ((2 * p1) + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u + (-p0 + 3 * p1 - 3 * p2 + p3) * u ** 3)
  rings, segs = (48, 24) if lo else (260, 72)
  bm = bmesh.new(); prev = None; nrm = Vector((0, 0, 1)); rows = []
  L = 0.0; last = cr(0)
  for i in range(rings + 1):
    t = i / rings; c = cr(t); tan = (cr(min(t + 1e-3, 1)) - cr(max(t - 1e-3, 0))).normalized()
    L += (c - last).length; last = c
    nrm = (nrm - tan * nrm.dot(tan)).normalized(); bin_ = tan.cross(nrm)
    base = 0.0345 + (0.046 - 0.0345) * min(1.0, t * 1.8)
    row = []
    for j in range(segs):
      a = j / segs * math.tau
      rr = base
      if not lo:
        # 不規則的堆疊皺褶：波長隨位置變、只繞半圈左右，另加順著手臂的細褶
        env = 0.3 + 0.7 * max(0.0, 1 - t * 2.4)
        lam = 0.026 + 0.012 * math.sin(L * 37 + 1.3)
        part = 0.5 + 0.5 * math.sin(a + L * 23 + 0.7 * math.sin(L * 61))
        rr += 0.0026 * env * part * math.sin(L * math.tau / lam + 1.4 * math.sin(a * 2 + L * 29))
        rr += 0.0007 * math.sin(a * 7 + L * 13 + 2 * math.sin(L * 40))
        if t > 0.55: rr += 0.0018 * math.sin(L * math.tau / 0.05 + a) * (t - 0.55)
      if t < 0.03: rr += 0.0022 * (1 - t / 0.03)
      row.append(bm.verts.new(c + (nrm * math.cos(a) + bin_ * math.sin(a)) * rr))
    rows.append(row)
  for i in range(rings):
    for j in range(segs):
      a, b = rows[i][j], rows[i][(j + 1) % segs]; c2, d2 = rows[i + 1][(j + 1) % segs], rows[i + 1][j]
      bm.faces.new((a, b, c2, d2))
  # 袖口內側往內折一圈，看起來有厚度
  inner = []
  for j in range(segs):
    v = rows[0][j].co; c0 = cr(0)
    inner.append(bm.verts.new(c0 + (v - c0) * 0.9 + (cr(0.01) - c0).normalized() * 0.006))
  for j in range(segs):
    bm.faces.new((rows[0][(j + 1) % segs], rows[0][j], inner[j], inner[(j + 1) % segs]))
  bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
  ob = bm_obj(bm, 'sleeve_lo' if lo else 'sleeve_hi'); smooth_shade(ob)
  return ob

# ───────── 材質（只用來烘焙）─────────
def node_mat(name):
  m = bpy.data.materials.new(name); m.use_nodes = True
  return m, m.node_tree.nodes, m.node_tree.links, m.node_tree.nodes['Principled BSDF']

def skin_material():
  m, N, Lk, b = node_mat('skin_hi')
  tc = N.new('ShaderNodeTexCoord'); geo = N.new('ShaderNodeNewGeometry')
  base = N.new('ShaderNodeRGB'); base.outputs[0].default_value = (0.52, 0.29, 0.19, 1)
  red = N.new('ShaderNodeRGB'); red.outputs[0].default_value = (0.5, 0.2, 0.14, 1)
  pale = N.new('ShaderNodeRGB'); pale.outputs[0].default_value = (0.62, 0.4, 0.29, 1)
  # 凸起處（指節、指尖）偏紅
  mr = N.new('ShaderNodeMapRange'); mr.inputs['From Min'].default_value = 0.5; mr.inputs['From Max'].default_value = 0.56
  Lk.new(geo.outputs['Pointiness'], mr.inputs['Value'])
  mix1 = N.new('ShaderNodeMix'); mix1.data_type = 'RGBA'
  Lk.new(mr.outputs[0], mix1.inputs['Factor']); Lk.new(base.outputs[0], mix1.inputs['A']); Lk.new(red.outputs[0], mix1.inputs['B'])
  # 掌側（朝下）較淡
  sep = N.new('ShaderNodeSeparateXYZ'); Lk.new(geo.outputs['Normal'], sep.inputs[0])
  mr2 = N.new('ShaderNodeMapRange'); mr2.inputs['From Min'].default_value = 0.2; mr2.inputs['From Max'].default_value = -0.7
  Lk.new(sep.outputs['Z'], mr2.inputs['Value'])
  mix2 = N.new('ShaderNodeMix'); mix2.data_type = 'RGBA'
  Lk.new(mr2.outputs[0], mix2.inputs['Factor']); Lk.new(mix1.outputs['Result'], mix2.inputs['A']); Lk.new(pale.outputs[0], mix2.inputs['B'])
  # 細微斑駁
  nz = N.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 900; Lk.new(tc.outputs['Object'], nz.inputs['Vector'])
  mr3 = N.new('ShaderNodeMapRange'); mr3.inputs['To Min'].default_value = 0.9; mr3.inputs['To Max'].default_value = 1.08
  Lk.new(nz.outputs['Fac'], mr3.inputs['Value'])
  mul = N.new('ShaderNodeMix'); mul.data_type = 'RGBA'; mul.blend_type = 'MULTIPLY'; mul.inputs['Factor'].default_value = 1
  Lk.new(mix2.outputs['Result'], mul.inputs['A'])
  cmb = N.new('ShaderNodeCombineXYZ'); Lk.new(mr3.outputs[0], cmb.inputs[0]); Lk.new(mr3.outputs[0], cmb.inputs[1]); Lk.new(mr3.outputs[0], cmb.inputs[2])
  Lk.new(cmb.outputs[0], mul.inputs['B'])
  Lk.new(mul.outputs['Result'], b.inputs['Base Color'])
  # 皮膚紋理的凹凸
  vn = N.new('ShaderNodeTexVoronoi'); vn.inputs['Scale'].default_value = 2600; Lk.new(tc.outputs['Object'], vn.inputs['Vector'])
  bp = N.new('ShaderNodeBump'); bp.inputs['Strength'].default_value = 0.12; bp.inputs['Distance'].default_value = 0.0002
  Lk.new(vn.outputs['Distance'], bp.inputs['Height']); Lk.new(bp.outputs['Normal'], b.inputs['Normal'])
  return m

def glove_material():
  m, N, Lk, b = node_mat('glove_hi')
  tc = N.new('ShaderNodeTexCoord')
  sep = N.new('ShaderNodeSeparateXYZ'); Lk.new(tc.outputs['Object'], sep.inputs[0])
  # 遮罩：指節護片（手背上方、指節列附近）與腕帶
  def band(val, lo_, hi_, soft=0.003):
    a = N.new('ShaderNodeMapRange'); a.inputs['From Min'].default_value = lo_ - soft; a.inputs['From Max'].default_value = lo_ + soft; Lk.new(val, a.inputs['Value'])
    c = N.new('ShaderNodeMapRange'); c.inputs['From Min'].default_value = hi_ + soft; c.inputs['From Max'].default_value = hi_ - soft; Lk.new(val, c.inputs['Value'])
    mm = N.new('ShaderNodeMath'); mm.operation = 'MULTIPLY'; Lk.new(a.outputs[0], mm.inputs[0]); Lk.new(c.outputs[0], mm.inputs[1]); return mm.outputs[0]
  def mul(a, b2):
    mm = N.new('ShaderNodeMath'); mm.operation = 'MULTIPLY'; Lk.new(a, mm.inputs[0]); Lk.new(b2, mm.inputs[1]); return mm.outputs[0]
  # Blender 座標：X=網頁 x、Y=-網頁 z、Z=網頁 y
  knuckle = mul(mul(band(sep.outputs['Z'], 0.03, 0.06), band(sep.outputs['Y'], -0.024, 0.014)), band(sep.outputs['X'], -0.042, 0.046))
  strap = band(sep.outputs['Y'], -0.097, -0.079, 0.0008)
  fabric = N.new('ShaderNodeRGB'); fabric.outputs[0].default_value = (0.03, 0.031, 0.029, 1)
  pad = N.new('ShaderNodeRGB'); pad.outputs[0].default_value = (0.065, 0.068, 0.06, 1)
  stc = N.new('ShaderNodeRGB'); stc.outputs[0].default_value = (0.055, 0.057, 0.05, 1)
  m1 = N.new('ShaderNodeMix'); m1.data_type = 'RGBA'; Lk.new(knuckle, m1.inputs['Factor']); Lk.new(fabric.outputs[0], m1.inputs['A']); Lk.new(pad.outputs[0], m1.inputs['B'])
  m2 = N.new('ShaderNodeMix'); m2.data_type = 'RGBA'; Lk.new(strap, m2.inputs['Factor']); Lk.new(m1.outputs['Result'], m2.inputs['A']); Lk.new(stc.outputs[0], m2.inputs['B'])
  Lk.new(m2.outputs['Result'], b.inputs['Base Color'])
  # 布紋（兩向細波）＋護片的顆粒皮紋
  w1 = N.new('ShaderNodeTexWave'); w1.inputs['Scale'].default_value = 1700; w1.bands_direction = 'X'; Lk.new(tc.outputs['Object'], w1.inputs['Vector'])
  w2 = N.new('ShaderNodeTexWave'); w2.inputs['Scale'].default_value = 1700; w2.bands_direction = 'Z'; Lk.new(tc.outputs['Object'], w2.inputs['Vector'])
  ad = N.new('ShaderNodeMath'); ad.operation = 'ADD'; Lk.new(w1.outputs['Fac'], ad.inputs[0]); Lk.new(w2.outputs['Fac'], ad.inputs[1])
  vr = N.new('ShaderNodeTexVoronoi'); vr.inputs['Scale'].default_value = 1400; Lk.new(tc.outputs['Object'], vr.inputs['Vector'])
  hm = N.new('ShaderNodeMix'); hm.data_type = 'FLOAT'; Lk.new(knuckle, hm.inputs['Factor']); Lk.new(ad.outputs[0], hm.inputs['A']); Lk.new(vr.outputs['Distance'], hm.inputs['B'])
  bp = N.new('ShaderNodeBump'); bp.inputs['Strength'].default_value = 0.25; bp.inputs['Distance'].default_value = 0.00025
  Lk.new(hm.outputs['Result'], bp.inputs['Height']); Lk.new(bp.outputs['Normal'], b.inputs['Normal'])
  return m

def sleeve_material():
  m, N, Lk, b = node_mat('sleeve_hi')
  tc = N.new('ShaderNodeTexCoord')
  c = N.new('ShaderNodeRGB'); c.outputs[0].default_value = (0.02, 0.028, 0.023, 1)
  nz = N.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 120; Lk.new(tc.outputs['Object'], nz.inputs['Vector'])
  mr = N.new('ShaderNodeMapRange'); mr.inputs['To Min'].default_value = 0.85; mr.inputs['To Max'].default_value = 1.15; Lk.new(nz.outputs['Fac'], mr.inputs['Value'])
  mm = N.new('ShaderNodeMix'); mm.data_type = 'RGBA'; mm.blend_type = 'MULTIPLY'; mm.inputs['Factor'].default_value = 1
  cmb = N.new('ShaderNodeCombineXYZ')
  for k in range(3): Lk.new(mr.outputs[0], cmb.inputs[k])
  Lk.new(c.outputs[0], mm.inputs['A']); Lk.new(cmb.outputs[0], mm.inputs['B']); Lk.new(mm.outputs['Result'], b.inputs['Base Color'])
  w = N.new('ShaderNodeTexWave'); w.inputs['Scale'].default_value = 900; w.bands_direction = 'DIAGONAL'; Lk.new(tc.outputs['Object'], w.inputs['Vector'])
  bp = N.new('ShaderNodeBump'); bp.inputs['Strength'].default_value = 0.15; bp.inputs['Distance'].default_value = 0.0002
  Lk.new(w.outputs['Fac'], bp.inputs['Height']); Lk.new(bp.outputs['Normal'], b.inputs['Normal'])
  return m

# ───────── 烘焙用的場景：握把與煞車拉桿（產生接觸陰影）─────────
def occluders():
  bm = bmesh.new()
  q = Vector((0, 0, 1)).rotation_difference(Vector((1, 0, 0)))
  bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=40, radius1=GRIP_R, radius2=GRIP_R, depth=0.25,
                        matrix=Matrix.Translation(P(-0.04, 0, 0)) @ q.to_matrix().to_4x4())
  bmesh.ops.create_cube(bm, size=1.0, matrix=Matrix.Translation(P(-0.049, -0.004, -0.04)) @ Matrix.Diagonal((0.09, 0.014, 0.008, 1)))
  ob = bm_obj(bm, 'occ'); return ob

def decimate_to(ob, tris):
  n = sum(len(p.vertices) - 2 for p in ob.data.polygons)
  d = ob.modifiers.new('dec', 'DECIMATE'); d.ratio = min(1.0, tris / max(n, 1))
  apply_mods(ob); smooth_shade(ob)

def uv_unwrap(ob):
  activate(ob)
  bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
  bpy.ops.uv.smart_project(angle_limit=math.radians(60), island_margin=0.006)
  bpy.ops.object.mode_set(mode='OBJECT')

def new_img(name, noncolor=False):
  im = bpy.data.images.new(name, TEX, TEX, alpha=False, float_buffer=noncolor)
  if noncolor: im.colorspace_settings.name = 'Non-Color'
  return im

def bake_set(hi, lo, hi_mat, tag, rough):
  hi.data.materials.clear(); hi.data.materials.append(hi_mat)
  m, N, Lk, b = node_mat('mat_' + tag)
  lo.data.materials.clear(); lo.data.materials.append(m)
  imgs = {k: new_img(f'{tag}_{k}', k == 'nrm') for k in ('col', 'nrm', 'ao')}
  nodes = {}
  for k, im in imgs.items():
    t = N.new('ShaderNodeTexImage'); t.image = im; nodes[k] = t
  rb = scene.render.bake
  rb.use_selected_to_active = True; rb.cage_extrusion = 0.0025; rb.max_ray_distance = 0.006; rb.margin = 6
  activate(hi, lo, active=lo)
  for k, kind in (('col', 'DIFFUSE'), ('nrm', 'NORMAL'), ('ao', 'AO')):
    N.active = nodes[k]; nodes[k].select = True
    kw = dict(type=kind, use_selected_to_active=True, cage_extrusion=0.0025, max_ray_distance=0.006, margin=6)
    if kind == 'DIFFUSE': kw['pass_filter'] = {'COLOR'}
    bpy.ops.object.bake(**kw)
    print('baked', tag, k)
  # 顏色 × 環境光遮蔽，合成成一張底色
  col = np.array(imgs['col'].pixels[:], dtype=np.float32).reshape(-1, 4)
  ao = np.array(imgs['ao'].pixels[:], dtype=np.float32).reshape(-1, 4)[:, :1]
  out = col.copy(); out[:, :3] = col[:, :3] * (0.25 + 0.75 * np.power(np.clip(ao, 0, 1), 0.9))
  fin = bpy.data.images.new(f'{tag}_base', TEX, TEX, alpha=False); fin.pixels[:] = out.ravel()
  for im, nm in ((fin, 'base'), (imgs['nrm'], 'nrm')):
    im.filepath_raw = os.path.join(OUT, f'{tag}_{nm}.png'); im.file_format = 'PNG'; im.save()
  # 換成最終材質：底色 + 法線
  for t in list(N):
    if t.type == 'TEX_IMAGE': N.remove(t)
  tb = N.new('ShaderNodeTexImage'); tb.image = fin; Lk.new(tb.outputs['Color'], b.inputs['Base Color'])
  tn = N.new('ShaderNodeTexImage'); tn.image = imgs['nrm']; nm = N.new('ShaderNodeNormalMap')
  Lk.new(tn.outputs['Color'], nm.inputs['Color']); Lk.new(nm.outputs['Normal'], b.inputs['Normal'])
  b.inputs['Roughness'].default_value = rough
  return m

# ───────── 食指扣煞車的形狀鍵 ─────────
def seg_dist(p, a, b):
  ab = b - a; t = max(0.0, min(1.0, (p - a).dot(ab) / ab.length_squared)); return (p - (a + ab * t)).length, t
def add_pull_key(ob):
  me = ob.data
  segs = []
  for name, (pts, rad) in FING.items():
    V = [Vector(p) for p in pts]
    for k in range(3): segs.append((name, k, V[k], V[k + 1]))
    if name in BASES: segs.append((name, -1, V[0], Vector(BASES[name])))
  mcp, pip, dip = (Vector(FING['index'][0][k]) for k in range(3))
  ax = Vector((1, 0, 0))
  def rot_about(p, c, ang): return c + Matrix.Rotation(ang, 3, ax) @ (p - c)
  # 決定旋轉方向：讓指尖往騎士方向（+z）移
  tip = Vector(FING['index'][0][3])
  s1 = 1 if rot_about(tip, mcp, 0.3).z > tip.z else -1
  if not me.shape_keys: ob.shape_key_add(name='Basis')
  key = ob.shape_key_add(name='pull', from_mix=False)
  moved = 0
  for i, v in enumerate(me.vertices):
    p = Vector(Pinv(v.co))
    best = min(segs, key=lambda s: seg_dist(p, s[2], s[3])[0])
    if best[0] != 'index' or best[1] < 0: continue
    d, t = seg_dist(p, best[2], best[3])
    w0 = 1.0 if best[1] > 0 else min(1.0, t / 0.3)          # 掌指關節附近漸變
    q = rot_about(p, mcp, s1 * 0.32 * w0)
    if best[1] > 0:
      pip2 = rot_about(pip, mcp, s1 * 0.32)
      w1 = 1.0 if best[1] > 1 else min(1.0, t / 0.35)
      q = rot_about(q, pip2, s1 * 0.28 * w1)
    key.data[i].co = P(*q); moved += 1
  print('pull 形狀鍵移動頂點', moved)

# ───────── 指甲（裸手）─────────
def add_nails(bm_target_ob):
  bm = bmesh.new()
  for name, (pts, rad) in FING.items():
    dip, tip = Vector(pts[2]), Vector(pts[3])
    c = dip * 0.38 + tip * 0.62
    axis = (tip - dip).normalized()
    out = Vector((0, c.y, c.z)).normalized()                     # 離開握把軸的方向＝指背
    if name == 'index': out = (out + Vector((0, 0.3, -0.6))).normalized()
    out = (out - axis * out.dot(axis)).normalized()
    side = axis.cross(out)
    r = rad[3]
    pos = c + out * r * 0.78
    Mw = Matrix((side * r * 0.62, axis * r * 0.72, out * r * 0.18)).transposed()
    M = Matrix.Translation(P(*pos)) @ Matrix(((1, 0, 0), (0, 0, -1), (0, 1, 0))).to_4x4() @ Mw.to_4x4()
    bmesh.ops.create_uvsphere(bm, u_segments=16, v_segments=10, radius=1.0, matrix=M)
  ob = bm_obj(bm, 'nails'); smooth_shade(ob)
  m, N, Lk, b = node_mat('nail'); b.inputs['Base Color'].default_value = (0.62, 0.42, 0.36, 1); b.inputs['Roughness'].default_value = 0.28
  ob.data.materials.append(m)
  return ob

def join(a, b):
  activate(a, b, active=a); bpy.ops.object.join(); return a

def mirror_copy(ob, name):
  d = ob.copy(); d.data = ob.data.copy(); d.name = name; link(d)
  d.data.transform(Matrix.Scale(-1, 4, (1, 0, 0)), shape_keys=True)
  d.data.flip_normals()
  return d

occ = occluders()
results = []
# 裸手
hi = build_hand_hi(False); lo = hi.copy(); lo.data = hi.data.copy(); lo.name = 'HandR_bare'; link(lo)
decimate_to(lo, 9000); uv_unwrap(lo)
bake_set(hi, lo, skin_material(), 'bare', 0.5)
nails = add_nails(lo); join(lo, nails); lo.name = 'HandR_bare'
add_pull_key(lo); results.append(lo)
# 手套（先把裸手藏起來，免得烘焙遮蔽時互相干擾）
for o in (hi, lo): o.hide_render = True
hg = build_hand_hi(True); lg = hg.copy(); lg.data = hg.data.copy(); lg.name = 'HandR_glove'; link(lg)
decimate_to(lg, 8000); uv_unwrap(lg)
bake_set(hg, lg, glove_material(), 'glove', 0.72)
add_pull_key(lg); results.append(lg)
# 袖子
for o in (hg, lg): o.hide_render = True
sh = build_sleeve_hi(False); sl = build_sleeve_hi(True); sl.name = 'SleeveR'; uv_unwrap(sl)
bake_set(sh, sl, sleeve_material(), 'sleeve', 0.8)
results.append(sl)

for ob in list(results):
  results.append(mirror_copy(ob, ob.name.replace('R_', 'L_').replace('SleeveR', 'SleeveL')))
for ob in (hi, hg, sh, occ): ob.hide_render = True

if RENDER:
  # 預覽：從騎士眼睛的位置看右手（網頁座標），再從側前方看
  cam = link(bpy.data.objects.new('cam', bpy.data.cameras.new('cam')))
  scene.camera = cam
  sun = link(bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN'))); sun.data.energy = 3; sun.rotation_euler = (0.7, 0.2, 0.5)
  world = bpy.data.worlds.new('w'); scene.world = world; world.use_nodes = True
  world.node_tree.nodes['Background'].inputs[0].default_value = (0.35, 0.33, 0.3, 1)
  occ.hide_render = False
  scene.render.resolution_x = 900; scene.render.resolution_y = 700; scene.cycles.samples = 32
  for ob in results: ob.hide_render = not ob.name.endswith('R_bare') and ob.name != 'SleeveR'
  views = {'eye': ((-0.322 * 0.6, 0.46 * 0.6, 0.63 * 0.6), 30), 'side': ((-0.16, 0.05, -0.16), 35), 'top': ((0.0, 0.25, 0.06), 40)}
  for variant in ('bare', 'glove'):
    for ob in results: ob.hide_render = not (ob.name.endswith('R_' + variant) or ob.name == 'SleeveR')
    for nm, (pos, lens) in views.items():
      cam.location = P(*pos); cam.data.lens = lens
      d = P(0, 0.01, 0) - cam.location
      cam.rotation_euler = d.to_track_quat('-Z', 'Z').to_euler()
      scene.render.filepath = os.path.join(OUT, f'prev_{variant}_{nm}.png'); bpy.ops.render.render(write_still=True)

activate(*results)
bpy.ops.export_scene.gltf(filepath=GLB, export_format='GLB', use_selection=True, export_yup=True, export_apply=False,
                          export_texcoords=True, export_normals=True, export_materials='EXPORT', export_morph=True,
                          export_morph_normal=True, export_image_format='JPEG', export_jpeg_quality=86,
                          export_cameras=False, export_lights=False)
print('DONE', GLB, os.path.getsize(GLB))
