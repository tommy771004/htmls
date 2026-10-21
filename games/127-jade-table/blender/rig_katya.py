# 遠山（Katya 藝伎裝）原檔沒有骨架：依量好的關節建一副簡單骨架，身體用 bone heat 自動刷權重，
# 臉與頭髮整塊綁在頭骨上，輸出 .cache/katya_rigged.glb 給 tools/figures.mjs 處理。
# blender -b --factory-startup --python blender/rig_katya.py -- <原檔.glb> <輸出.glb>
# 座標是 Blender 的（z 朝上、角色面向 -y），單位公尺；原檔身高約 1.73、A 字站姿，手尖在 (±0.505, -0.119, 0.885)。
import sys
import bpy
import numpy as np
from mathutils import Vector

src, out = sys.argv[sys.argv.index('--') + 1:][:2]
SIGMA = .07  # 權重衰減距離（公尺）
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)

meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
for o in meshes:  # 套用 Sketchfab 外層節點的轉換，之後網格直接掛在骨架下
    mw = o.matrix_world.copy(); o.parent = None; o.matrix_world = mw
bpy.ops.object.select_all(action='DESELECT')
for o in meshes: o.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
for o in list(bpy.context.scene.objects):
    if o.type != 'MESH': bpy.data.objects.remove(o)

# 關節：名稱 → (頭, 尾, 父骨)。手臂沿肩到手尖的直線取肘（40%）與腕（72%）。
def lerp(a, b, t): return tuple(a[i] + (b[i] - a[i]) * t for i in range(3))
J = {
    'Hips': ((0, 0, .95), (0, 0, 1.05), None),
    'Spine': ((0, 0, 1.05), (0, 0, 1.22), 'Hips'),
    'Chest': ((0, 0, 1.22), (0, 0, 1.43), 'Spine'),
    'Neck': ((0, 0, 1.43), (0, 0, 1.5), 'Chest'),
    'Head': ((0, 0, 1.5), (0, 0, 1.75), 'Neck'),
}
for s, k in ((1, 'L'), (-1, 'R')):
    sh, tip = (s * .16, 0, 1.39), (s * .505, -.119, .885)
    el, wr = lerp(sh, tip, .4), lerp(sh, tip, .72)
    J['Clavicle' + k] = ((s * .03, 0, 1.4), sh, 'Chest')
    J['UpperArm' + k] = (sh, el, 'Clavicle' + k)
    J['ForeArm' + k] = (el, wr, 'UpperArm' + k)
    J['Hand' + k] = (wr, tip, 'ForeArm' + k)
    J['Thigh' + k] = ((s * .09, 0, .92), (s * .09, 0, .5), 'Hips')
    J['Shin' + k] = ((s * .09, 0, .5), (s * .09, .01, .08), 'Thigh' + k)

arm = bpy.data.objects.new('Armature', bpy.data.armatures.new('Armature'))
bpy.context.scene.collection.objects.link(arm)
bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode='EDIT')
for name, (h, t, p) in J.items():
    b = arm.data.edit_bones.new(name); b.head = Vector(h); b.tail = Vector(t)
for name, (h, t, p) in J.items():
    if p: arm.data.edit_bones[name].parent = arm.data.edit_bones[p]
bpy.ops.object.mode_set(mode='OBJECT')

# 原網格是許多斷開的面片，Blender 的 bone heat（連體素代理網格也是）都算不出來，所以自己刷：
# 每個頂點對每段骨頭取距離的高斯權重，手臂骨只影響同側、肩膀外側、而且離手臂比離軀幹近的頂點，
# 頭頸以上只給頭頸，最後取前 4 名正規化。
body = next(o for o in meshes if o.name.startswith('Body'))
P = np.array([v.co for v in body.data.vertices])
names = list(J)
def seg_dist(p, a, b):
    a, b = np.array(a), np.array(b); ab = b - a
    t = np.clip(((p - a) @ ab) / (ab @ ab), 0, 1)
    return np.linalg.norm(p - (a + t[:, None] * ab), axis=1)
D = np.stack([seg_dist(P, J[n][0], J[n][1]) for n in names], 1)
W = np.exp(-(D / SIGMA) ** 2) + 1e-9
torso = D[:, [names.index(n) for n in ('Hips', 'Spine', 'Chest')]].min(1)
# 連通塊：腰帶、衣身這種重心在中線、又碰不到手的塊整塊不給手臂（腰帶側邊的褶片離前臂很近，單靠距離分不開）
par = np.arange(len(P))
def find(i):
    while par[i] != i: par[i] = par[par[i]]; i = par[i]
    return i
for e in body.data.edges:
    a, b = find(e.vertices[0]), find(e.vertices[1])
    if a != b: par[a] = b
isl = np.array([find(i) for i in range(len(P))])
torso_isl = np.zeros(len(P), bool)
for r in np.unique(isl):
    m = isl == r
    if abs(P[m, 0].mean()) < .12 and np.abs(P[m, 0]).max() < .38: torso_isl |= m
print(f'連通塊 {len(np.unique(isl))} 個，軀幹塊頂點 {torso_isl.sum()}')
for k, n in enumerate(names):
    side = 1 if n.endswith('L') else -1 if n.endswith('R') else 0
    if n.startswith(('Clavicle', 'UpperArm', 'ForeArm', 'Hand')):
        # 背後的腰帶結離軀幹比離手臂近，不能被手臂帶走
        reach = D[:, [names.index(m + n[-1]) for m in ('UpperArm', 'ForeArm', 'Hand')]].min(1)
        W[:, k] *= (side * P[:, 0] > .12) & (P[:, 2] > .5) & (reach < torso) & ~torso_isl
    if n.startswith(('Thigh', 'Shin')):
        W[:, k] *= (side * P[:, 0] > 0) & (P[:, 2] < .95)
    if n in ('Neck', 'Head'):
        W[:, k] *= P[:, 2] > 1.36
W[P[:, 2] > 1.5] *= np.array([n in ('Neck', 'Head') for n in names])
top = np.argsort(-W, 1)[:, :4]
groups = {n: body.vertex_groups.new(name=n) for n in names}
for vi in range(len(P)):
    w = W[vi, top[vi]]; w = w / w.sum()
    for k, x in zip(top[vi], w):
        if x > .01: groups[names[k]].add([vi], float(x), 'REPLACE')
body.parent = arm; body.modifiers.new('Armature', 'ARMATURE').object = arm
missing = sum(1 for v in body.data.vertices if not v.groups)
print(f'body: {len(body.data.vertices)} 個頂點，{missing} 個沒有權重')
for o in meshes:
    if o is body: continue
    g = o.vertex_groups.new(name='Head'); g.add(range(len(o.data.vertices)), 1.0, 'REPLACE')
    o.parent = arm; o.modifiers.new('Armature', 'ARMATURE').object = arm

bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_animations=False, export_skins=True)
