"""霓虹夜城（260）的掃描人物：Sketchfab 上沒有骨架的靜態人物（AI 掃描、單一材質），綁到 people.py 的 Quaternius 骨架，
輸出 assets/260/people/<id>.glb（tools/scan-people.mjs 再以 meshopt 壓縮；頁面只在 http(s) 下載，換掉程式換色的身體）。

    /Applications/Blender.app/Contents/MacOS/Blender -b -P blender/scan_people.py -- [id ...]

原檔放在 gitignore 的 .cache/people/（SCANS 的 src）。步驟：
1. 合併、套用世界變換、轉成面向 −Y（左手 +X）、縮到身高、合併重複頂點、減面到 tris。
2. lm 是正面圖量的關節（u = x / 身高、v = 離地高 / 身高，只量左側；中線關節只給 v），前後深度取該處網格切片的中點。
3. 複製一副 UBC 骨架，骨頭頭尾搬到量出的關節（手指照手掌的相似變換搬），用體素代理網格算熱擴散權重（同 198 的 glb_heroes.py）。
4. 把這副骨架擺成 UBC 靜止姿勢的方向（T 字），套用到網格；再依權重把各段平移到 UBC 的關節，網格就落在 UBC 的綁定空間。
5. 綁回原本的 UBC 骨架（骨名相同，動畫庫只有旋轉，直接通用），只留底色貼圖（1024 JPEG）。
有骨架的原檔（rig: True，rosa、dane）：第 2、3 步不量也不算——骨頭直接放到原檔的關節（含前後深度），權重沿用原檔的（rig_weights 照 rig_ubc
的骨名表併過去）。原檔的 head_end／foot_end／指尖 _end 不在頭頂、腳尖、指尖，所以頭朝正上、腳尖照網格量、指尖由第三節往外延。
"""
import math
import os
import re
import sys

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector as V

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.environ.get('QUATERNIUS_CACHE') or os.path.normpath(os.path.join(ROOT, '../197-openworld/.cache'))
BODY = os.path.join(CACHE, 'ubc/Universal Base Characters[Standard]/Base Characters/Godot - UE/Superhero_{}_FullBody.gltf')
OUT = os.path.normpath(os.path.join(ROOT, '../../assets/260/people'))

SCANS = {
    # BakhtiarSource「Jason Duval & GTA VI」（CC BY 4.0），A 字站姿
    'jason': {'src': 'jason_duval.glb', 'sex': 'Male', 'height': 1.84, 'yaw': 0, 'tris': 36000, 'lm': {
        'hips': 0.52, 'torso': 0.585, 'neck': 0.83, 'head': 0.868, 'cl': (0.02, 0.81),
        'sh': (0.125, 0.79), 'el': (0.19, 0.62), 'wr': (0.208, 0.505), 'ft': (0.215, 0.41),
        'th': (0.085, 0.49), 'kn': (0.095, 0.27), 'an': (0.10, 0.058)}},
    # SYMXY_「GTA 6 GIRL SKIN」（CC BY 4.0），T 字站姿、原檔面向 +X
    'lucia': {'src': 'gta6_girl.glb', 'sex': 'Female', 'height': 1.72, 'yaw': -90, 'tris': 36000, 'lm': {
        'hips': 0.53, 'torso': 0.60, 'neck': 0.81, 'head': 0.845, 'cl': (0.02, 0.79),
        'sh': (0.13, 0.775), 'el': (0.26, 0.765), 'wr': (0.385, 0.755), 'ft': (0.47, 0.75),
        'th': (0.07, 0.505), 'kn': (0.085, 0.29), 'an': (0.10, 0.05)}},
    # 主線的雙主角（plans/260-story.md）：renderpeople 有骨架的掃描（CC BY 4.0），原檔在 .cache/story/。
    # rig：靜止姿勢是 T 字、面向 −Y；lm 不用量，從骨頭的靜止位置換算（rig_lm），骨盆的 x、y 置中
    'rosa': {'src': 'sophia_animated_003_-_animated_3d_woman.glb', 'dir': 'story', 'rig': True, 'sex': 'Female', 'height': 1.68, 'yaw': 0, 'tris': 36000},
    'dane': {'src': 'nathan_animated_003_-_walking_3d_man.glb', 'dir': 'story', 'rig': True, 'sex': 'Male', 'height': 1.84, 'yaw': 0, 'tris': 36000},
}
# 有骨架的原檔：lm 的各關節對到哪一根骨頭（骨名結尾，左側；ft 是中指尖，從第三節往外延一節）
RIG_LM = {'hips': 'hip', 'torso': 'spine_02', 'neck': 'neck', 'head': 'head', 'cl': 'shoulder_l', 'sh': 'upperarm_l', 'el': 'lowerarm_l',
          'wr': 'hand_l', 'th': 'upperleg_l', 'kn': 'lowerleg_l', 'an': 'foot_l'}
FINGERS = ('index', 'middle', 'pinky', 'ring', 'thumb')


def import_gltf(path):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    return [o for o in bpy.data.objects if o not in before]


def select_only(objs, active):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = active


def rig_rest(objs):
    """有骨架的原檔：骨架切到靜止姿勢、網格套用骨架變形後拿掉修改器；回傳骨名 → 世界座標的骨頭頭端"""
    arm = next((o for o in objs if o.type == 'ARMATURE'), None)
    if arm is None:
        return None
    arm.data.pose_position = 'REST'
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    for o in objs:
        if o.type == 'MESH' and any(m.type == 'ARMATURE' for m in o.modifiers):
            me = bpy.data.meshes.new_from_object(o.evaluated_get(dg), preserve_all_data_layers=True, depsgraph=dg)
            o.modifiers.clear()
            o.data = me
    return {b.name: arm.matrix_world @ b.head_local for b in arm.data.bones}


def rig_bone(B, key):
    pat = re.compile(r'(^|_)' + re.escape(key) + r'_\d+$')
    for n, p in B.items():
        if pat.search(n):
            return p
    raise KeyError(key)


# 有骨架的原檔：骨名（去掉前綴與結尾的編號）→ UBC 的骨頭。原檔的權重照這張表併過去（扭轉骨併進本骨、臉部的小骨併進頭、末端併進上一節），
# 不再用熱擴散重算：熱擴散在脖子會把下巴、領口一起算進 neck_01，轉頭時臉和領子跟著扭（2026-10-31）
def rig_ubc(name):
    k = re.sub(r'_\d+$', '', name)
    for s in 'lr':
        side = {f'shoulder_{s}': f'clavicle_{s}', f'upperarm_{s}': f'upperarm_{s}', f'upperarm_twist_{s}': f'upperarm_{s}',
                f'lowerarm_{s}': f'lowerarm_{s}', f'lowerarm_twist_{s}': f'lowerarm_{s}', f'hand_{s}': f'hand_{s}',
                f'upperleg_{s}': f'thigh_{s}', f'upperleg_twist_{s}': f'thigh_{s}', f'lowerleg_{s}': f'calf_{s}', f'lowerleg_twist_{s}': f'calf_{s}',
                f'foot_{s}': f'foot_{s}', f'ball_{s}': f'ball_{s}', f'foot_end_{s}': f'ball_{s}'}
        for f in FINGERS:
            side[f'{f}_end_{s}'] = f'{f}_03_{s}'
            for i in (1, 2, 3):
                side[f'{f}_0{i}_{s}'] = f'{f}_0{i}_{s}'
        for a in sorted(side, key=len, reverse=True):
            if k.endswith('_' + a) or k == a:
                return side[a]
    for a, b in (('spine_01', 'spine_01'), ('spine_02', 'spine_02'), ('spine_03', 'spine_03'), ('neck', 'neck_01'), ('hip', 'pelvis'), ('root', 'pelvis')):
        if k.endswith('_' + a) or k == a:
            return b
    if re.search(r'(head|jaw|eye|eyelid|eyebrow|mouth)(_end)?(_[lr])?$', k):
        return 'Head'
    return None


def rig_weights(scan):
    """原檔的頂點群組照 rig_ubc 改名、合併；每個頂點最多 4 根、和為 1 在後面統一做"""
    src = {g.index: rig_ubc(g.name) for g in scan.vertex_groups}
    miss = sorted({g.name for g in scan.vertex_groups if src[g.index] is None})
    if miss:
        print('  對不到 UBC 的群組（權重丟掉）', miss)
    W = []
    for v in scan.data.vertices:
        d = {}
        for g in v.groups:
            n = src[g.group]
            if n and g.weight > 0:
                d[n] = d.get(n, 0.0) + g.weight
        W.append(d)
    scan.vertex_groups.clear()
    vg = {}
    for i, d in enumerate(W):
        for n, w in d.items():
            if n not in vg:
                vg[n] = scan.vertex_groups.new(name=n)
            vg[n].add([i], w, 'REPLACE')


def build(sid, cfg):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    H = cfg['height']
    # ---- 1. 掃描網格 ----
    objs = import_gltf(os.path.join(ROOT, '.cache', cfg.get('dir', 'people'), cfg['src']))
    B = rig_rest(objs) if cfg.get('rig') else None
    meshes = [o for o in objs if o.type == 'MESH' and len(o.data.vertices) > 500]   # renderpeople 原檔裡有一顆空的 Icosphere
    Ry = Matrix.Rotation(math.radians(cfg['yaw']), 4, 'Z')
    if B:
        B = {n: Ry @ p for n, p in B.items()}
        hip = rig_bone(B, 'hip')
        Ry = Matrix.Translation((-hip.x, -hip.y, 0)) @ Ry
        B = {n: p - V((hip.x, hip.y, 0)) for n, p in B.items()}
    for o in meshes:
        mw = Ry @ o.matrix_world
        o.parent = None
        o.data.transform(mw)
        o.matrix_world = Matrix.Identity(4)
    for o in objs:
        if o not in meshes:
            bpy.data.objects.remove(o, do_unlink=True)
    select_only(meshes, meshes[0])
    if len(meshes) > 1:
        bpy.ops.object.join()
    scan = bpy.context.view_layer.objects.active
    scan.name = f'{sid}_body'
    me = scan.data
    P = np.array([tuple(v.co) for v in me.vertices])
    z0 = P[:, 2].min()
    k = H / (P[:, 2].max() - z0)
    me.transform(Matrix.Scale(k, 4) @ Matrix.Translation((0, 0, -z0)))
    JB = {}
    if B:
        def uv(p):
            return (round(p.x * k / H, 4), round((p.z - z0) * k / H, 4))
        lm = {n: uv(rig_bone(B, b))[1] if n in ('hips', 'torso', 'neck', 'head') else uv(rig_bone(B, b)) for n, b in RIG_LM.items()}
        m2, m3 = rig_bone(B, 'middle_02_l'), rig_bone(B, 'middle_03_l')
        lm['ft'] = uv(m3 + (m3 - m2) * 0.9)
        cfg = {**cfg, 'lm': lm}
        print(f'[{sid}] lm {lm}')
        # 骨頭的實際位置（含前後深度）：權重是原檔的，搬骨頭時要用原檔的關節，不能用網格切片的中點（脖子那層會被下巴往前拉）
        def sc(p):
            return V((p.x * k, p.y * k, (p.z - z0) * k))
        for n, p in B.items():
            kk = re.sub(r'_\d+$', '', n)
            u = rig_ubc(n)
            if u and not re.search(r'(twist|_end|jaw|eye|mouth|brow|root)', kk):
                JB[u] = sc(p)
        # 末端（head_end、foot_end、指尖的 _end）在原檔裡不是頭頂、腳尖、指尖，不能用：頭朝正上、指尖照第三節往外延，腳尖在下面照網格量
        JB['Head_end'] = JB['Head'] + V((0, 0, 0.1))
        for s in 'lr':
            for f in FINGERS:
                a, b = JB[f'{f}_02_{s}'], JB[f'{f}_03_{s}']
                JB[f'{f}_04_leaf_{s}'] = b + (b - a) * 0.9
    # 只留第一組 UV（底色貼圖用）；原檔的切線與其他 UV 是法線、粗糙度貼圖用的
    while len(me.uv_layers) > 1:
        me.uv_layers.remove(me.uv_layers[-1])
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5 * H)
    bm.to_mesh(me)
    bm.free()
    n0 = len(me.polygons)
    dm = scan.modifiers.new('dec', 'DECIMATE')
    dm.ratio = min(1.0, cfg['tris'] / max(n0, 1))
    bpy.ops.object.modifier_apply(modifier=dm.name)
    print(f'[{sid}] {n0} → {len(me.polygons)} 面')
    for p in me.polygons:
        p.use_smooth = True
    P = np.array([tuple(v.co) for v in me.vertices])

    # ---- 2. 關節 ----
    lm = cfg['lm']

    def depth(x, z, rx, rz):
        m = (abs(P[:, 0] - x) < rx) & (abs(P[:, 2] - z) < rz)
        if m.sum() < 4:
            return 0.0
        ys = P[m, 1]
        return float((np.percentile(ys, 5) + np.percentile(ys, 95)) / 2)
    J = {}
    for n in ('hips', 'torso', 'neck', 'head'):
        z = lm[n] * H
        J[n] = V((0, depth(0, z, 0.06 * H, 0.02 * H), z))
    for s, sx in (('l', 1), ('r', -1)):
        for n in ('cl', 'sh', 'el', 'wr', 'ft', 'th', 'kn', 'an'):
            x, z = sx * lm[n][0] * H, lm[n][1] * H
            J[n + s] = V((x, depth(x, z, 0.035 * H, 0.035 * H), z))
        a = J['an' + s]
        m = (abs(P[:, 0] - a.x) < 0.06 * H) & (P[:, 2] < a.z)
        tip, heel = float(np.percentile(P[m, 1], 2)), float(np.percentile(P[m, 1], 98))   # 前方是 −y
        J['ball' + s] = V((a.x, heel + 0.72 * (tip - heel), 0.015 * H))
        J['tip' + s] = V((a.x, tip, 0.015 * H))

    # ---- 3. UBC 骨架：一副原樣（輸出用），一副搬到掃描的關節（算權重用） ----
    def ubc():
        got = import_gltf(BODY.format(cfg['sex']))
        arm = next(o for o in got if o.type == 'ARMATURE')
        for o in got:
            if o.type != 'ARMATURE':
                bpy.data.objects.remove(o, do_unlink=True)
        return arm
    base = ubc()
    base.name = cfg["sex"]
    print(f"[{sid}] UBC matrix_world identity: {base.matrix_world == Matrix.Identity(4)}")
    fit = ubc()
    fit.name = 'fit'
    U = {b.name: (V(b.head_local), V(b.tail_local)) for b in base.data.bones}
    select_only([fit], fit)
    bpy.ops.object.mode_set(mode='EDIT')
    eb = fit.data.edit_bones
    # 脊椎：照 UBC 在骨盆到頸部之間的比例分段，前後深度取掃描的切片
    p0, p1 = U['pelvis'][0].z, U['neck_01'][0].z
    for n in ('pelvis', 'spine_01', 'spine_02', 'spine_03', 'neck_01'):
        f = (U[n][0].z - p0) / (p1 - p0)
        z = J['hips'].z + f * (J['neck'].z - J['hips'].z)
        eb[n].head = V((0, depth(0, z, 0.06 * H, 0.02 * H), z))
    chain = ['pelvis', 'spine_01', 'spine_02', 'spine_03', 'neck_01', 'Head']
    eb['Head'].head = J['head']
    eb['Head'].tail = J['head'] + V((0, 0, (U['Head'][1] - U['Head'][0]).length * H / 1.8))
    for a, b in zip(chain, chain[1:]):
        eb[a].tail = eb[b].head
    for s in 'lr':
        put = {'clavicle_': ('cl', 'sh'), 'upperarm_': ('sh', 'el'), 'lowerarm_': ('el', 'wr'), 'thigh_': ('th', 'kn'), 'calf_': ('kn', 'an'),
               'foot_': ('an', 'ball'), 'ball_': ('ball', 'tip')}
        for b, (h, t) in put.items():
            eb[b + s].head, eb[b + s].tail = J[h + s], J[t + s]
        eb['ball_leaf_' + s].head = J['tip' + s]
        eb['ball_leaf_' + s].tail = J['tip' + s] + V((0, -0.02, 0))
        # 手掌與手指：UBC 手腕→中指尖的相似變換（旋轉＋等比）搬到掃描的手腕→指尖
        w0, f0 = U['hand_' + s][0], U['middle_04_leaf_' + s][1]
        w1, f1 = J['wr' + s], J['ft' + s]
        R = (f0 - w0).rotation_difference(f1 - w1).to_matrix()
        kk = (f1 - w1).length / (f0 - w0).length

        def hm(p):
            return w1 + (R @ (p - w0)) * kk
        names = ['hand_' + s] + [f'{f}_0{i}_{s}' for f in FINGERS for i in (1, 2, 3)] + [f'{f}_04_leaf_{s}' for f in FINGERS]
        for n in names:
            eb[n].head, eb[n].tail = hm(U[n][0]), hm(U[n][1])
    if JB:   # 有骨架的原檔：骨頭直接放到原檔的關節，尾端接到鏈上的下一節
        NXT = {'pelvis': 'spine_01', 'spine_01': 'spine_02', 'spine_02': 'spine_03', 'spine_03': 'neck_01', 'neck_01': 'Head', 'Head': 'Head_end'}
        for s in 'lr':
            ch = [f'clavicle_{s}', f'upperarm_{s}', f'lowerarm_{s}', f'hand_{s}', f'middle_01_{s}']
            ch2 = [f'thigh_{s}', f'calf_{s}', f'foot_{s}', f'ball_{s}', f'ball_leaf_{s}']
            NXT.update(zip(ch, ch[1:]))
            NXT.update(zip(ch2, ch2[1:]))
            for f in FINGERS:
                c3 = [f'{f}_0{i}_{s}' for i in (1, 2, 3)] + [f'{f}_04_leaf_{s}']
                NXT.update(zip(c3, c3[1:]))
        for s in 'lr':
            JB[f'ball_leaf_{s}'] = J['tip' + s]
        miss = [n for n in list(NXT) + list(NXT.values()) if n not in JB]
        if miss:
            raise RuntimeError(f'{sid}: 原檔缺關節 {sorted(set(miss))}')
        for e in eb:
            e.use_connect = False
        for n, t in NXT.items():
            eb[n].head, eb[n].tail = JB[n], JB[t]
        for e in eb:
            if 'leaf' in e.name and e.name in JB:
                d = JB[e.name] - eb[e.parent.name].head
                e.head, e.tail = JB[e.name], JB[e.name] + d * 0.5
    bpy.ops.object.mode_set(mode='OBJECT')
    for b in fit.data.bones:
        b.use_deform = b.name != 'root' and 'leaf' not in b.name

    if cfg.get('rig'):
        rig_weights(scan)
    else:
        # 熱擴散權重：體素重建的封閉代理網格算，再最近面內插轉移回掃描網格
        select_only([scan], scan)
        bpy.ops.object.duplicate()
        px = bpy.context.view_layer.objects.active
        px.name = 'proxy'
        rm = px.modifiers.new('vox', 'REMESH')
        rm.mode = 'VOXEL'
        rm.voxel_size = 0.008
        bpy.ops.object.modifier_apply(modifier=rm.name)
        bm = bmesh.new()   # 只留最大的連通塊（耳環、鏈子等分離小件靠資料轉移拿到權重）
        bm.from_mesh(px.data)
        seen, parts = set(), []
        for v0 in bm.verts:
            if v0 in seen:
                continue
            comp, stack = [], [v0]
            seen.add(v0)
            while stack:
                v = stack.pop()
                comp.append(v)
                for e in v.link_edges:
                    w = e.other_vert(v)
                    if w not in seen:
                        seen.add(w)
                        stack.append(w)
            parts.append(comp)
        parts.sort(key=len)
        bmesh.ops.delete(bm, geom=[v for c in parts[:-1] for v in c], context='VERTS')
        bm.to_mesh(px.data)
        bm.free()
        select_only([px, fit], fit)
        px.scale = fit.scale = (10, 10, 10)   # 熱擴散在一公尺上下的尺度容易解不出來
        bpy.context.view_layer.update()
        bpy.ops.object.parent_set(type='ARMATURE_AUTO')
        px.parent = None
        px.scale = fit.scale = (1, 1, 1)
        bpy.context.view_layer.update()
        print(f'[{sid}] 代理 {len(px.data.vertices)} 頂點，有權重 {sum(1 for v in px.data.vertices if v.groups)}')
        select_only([scan], scan)
        dt = scan.modifiers.new('wt', 'DATA_TRANSFER')
        dt.object = px
        dt.use_vert_data = True
        dt.data_types_verts = {'VGROUP_WEIGHTS'}
        dt.vert_mapping = 'POLYINTERP_NEAREST'
        dt.layers_vgroup_select_src = 'ALL'
        dt.layers_vgroup_select_dst = 'NAME'
        bpy.ops.object.datalayout_transfer(modifier=dt.name)
        bpy.ops.object.modifier_apply(modifier=dt.name)
        bpy.data.objects.remove(px, do_unlink=True)
    # 每個頂點最多 4 根骨頭、權重和為 1
    select_only([scan], scan)
    bpy.ops.object.vertex_group_limit_total(group_select_mode='ALL', limit=4)
    bpy.ops.object.vertex_group_normalize_all(group_select_mode='ALL', lock_active=False)
    bare = sum(1 for v in me.vertices if not v.groups)
    print(f'[{sid}] 沒有權重的頂點 {bare}')

    # ---- 4. 擺成 UBC 的 T 字並套用 ----
    am = scan.modifiers.new('fit', 'ARMATURE')
    am.object = fit
    select_only([fit], fit)
    bpy.ops.object.mode_set(mode='POSE')
    order = []

    def walk(b):
        order.append(b.name)
        for c in b.children:
            walk(c)
    walk(fit.data.bones['root'])
    for n in order:
        pb = fit.pose.bones[n]
        bpy.context.view_layer.update()
        h, t = pb.head.copy(), pb.tail.copy()
        want = U[n][1] - U[n][0]
        if (t - h).length < 1e-6 or want.length < 1e-6:
            continue
        R = (t - h).rotation_difference(want).to_matrix().to_4x4()
        pb.matrix = Matrix.Translation(h) @ R @ Matrix.Translation(-h) @ pb.matrix
    bpy.context.view_layer.update()
    posed = {n: fit.pose.bones[n].head.copy() for n in order}
    bpy.ops.object.mode_set(mode='OBJECT')
    select_only([scan], scan)
    bpy.ops.object.modifier_apply(modifier=am.name)
    # 依權重把各段平移到 UBC 的關節
    gname = {g.index: g.name for g in scan.vertex_groups}
    for v in me.vertices:
        d, tw = V((0, 0, 0)), 0.0
        for g in v.groups:
            n = gname[g.group]
            if n in posed:
                d += (U[n][0] - posed[n]) * g.weight
                tw += g.weight
        if tw > 0:
            v.co += d / tw
    bpy.data.objects.remove(fit, do_unlink=True)

    # ---- 5. 綁回 UBC 骨架、材質只留底色 ----
    scan.parent = base
    am = scan.modifiers.new(cfg['sex'], 'ARMATURE')
    am.object = base
    mat = me.materials[0]
    nt = mat.node_tree
    bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    for sock in ('Normal', 'Roughness', 'Metallic'):
        for l in list(bsdf.inputs[sock].links):
            nt.links.remove(l)
    bsdf.inputs['Roughness'].default_value = 0.7
    bsdf.inputs['Metallic'].default_value = 0.0
    for n in list(nt.nodes):
        if n.type == 'TEX_IMAGE' and not n.outputs['Color'].links:
            nt.nodes.remove(n)
    for n in list(nt.nodes):
        if n.type == 'NORMAL_MAP' or (n.type not in ('TEX_IMAGE', 'BSDF_PRINCIPLED', 'OUTPUT_MATERIAL') and not any(o.links for o in n.outputs)):
            nt.nodes.remove(n)
    tex = next(n for n in nt.nodes if n.type == 'TEX_IMAGE')
    img = tex.image
    if img.size[0] > 1024:
        img.scale(1024, 1024)
    mat.name = f'{sid}_scan'
    for im in list(bpy.data.images):
        if im is not img:
            bpy.data.images.remove(im)
    os.makedirs(OUT, exist_ok=True)
    out = os.path.join(OUT, f'{sid}.glb')
    select_only([base, scan], base)
    bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', use_selection=True, export_animations=False, export_skins=True,
                              export_image_format='JPEG', export_jpeg_quality=86, export_tangents=False, export_normals=True,
                              export_texcoords=True, export_apply=False)
    print(f'[{sid}] → {out} ({os.path.getsize(out) // 1024} KB)')


ids = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
for sid, cfg in SCANS.items():
    if not ids or sid in ids:
        build(sid, cfg)
