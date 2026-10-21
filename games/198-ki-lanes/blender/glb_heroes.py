# 入口：blender -b --factory-startup --python blender/glb_heroes.py -- [--only vegeta,goku] [--src ~/Downloads]
# 把 Sketchfab 下載的角色 GLB 換到遊戲骨架上，輸出 ../../assets/198/<id>.glb：
#   1. 匯入、清掉動畫、骨架回到靜止姿勢；
#   2. 把手臂、腿擺成遊戲的 A 字綁定姿勢（models.js 的 BIND：肩 0.75、髖 0.1 弧度），套用成網格的靜止形狀；
#   3. 縮放到遊戲身高、雙腳踩地、髖部在原點；
#   4. 原始骨架的權重依骨名對照表併到遊戲的骨頭（hips、torso、ribs、neck、head、cl／sh／el／wr、fa／fb／fc、tb、th／kn／an／to）；
#   5. 量出各關節在綁定姿勢的位置（遊戲座標：y 朝上、z 朝前），寫進 KI 骨架物件的 extras.ki_joints，執行時 heroSkeleton 照它擺骨頭。
# 原始 GLB 不放進 repo（授權與來源見 games/198-ki-lanes/CREDITS.md），預設從 ~/Downloads 讀，--src 可改。
import json
import math
import os
import re
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector

V = Vector
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT = os.path.normpath(os.path.join(ROOT, '..', '..', 'assets', '198'))
BIND = {'shZ': 0.75, 'thZ': 0.1}

# 每名英雄：來源檔（相對 --src）、骨架家族、身高（頭頂到腳底，公尺；照 models.js 的 PROPS）、要丟掉的網格（物件或材質名稱的正規式）
HEROES = {
    'vegeta': {'src': 'vegeta/thesaiyajin_-_vegeta_bodyguard.glb', 'rig': 'mixamo', 'height': 1.72},
}

# 骨架家族：清理過的骨名 → 遊戲骨頭（可分給兩根）。清理：去掉 mixamorig: 前綴與匯入時加上的 _數字 尾碼。
# {S} 換成 Left／Right，對應遊戲的 L／R。
RIGS = {
    'mixamo': {
        'weights': [
            (r'Hips', 'hips'), (r'Spine', 'torso'), (r'Spine1', [('torso', 0.5), ('ribs', 0.5)]), (r'Spine2', 'ribs'),
            (r'Neck', 'neck'), (r'Head(Top_End.*)?', 'head'),
            (r'{S}Shoulder', 'cl{s}'), (r'{S}Arm', 'sh{s}'), (r'{S}ForeArm', 'el{s}'), (r'{S}Hand', 'wr{s}'),
            (r'{S}HandThumb\d.*', 'tb{s}'),
            (r'{S}Hand(Index|Middle|Ring|Pinky)1', 'fa{s}'), (r'{S}Hand(Index|Middle|Ring|Pinky)2', 'fb{s}'),
            (r'{S}Hand(Index|Middle|Ring|Pinky)[34].*', 'fc{s}'),
            (r'{S}UpLeg', 'th{s}'), (r'{S}Leg', 'kn{s}'), (r'{S}Foot', 'an{s}'), (r'{S}Toe.*', 'to{s}'),
        ],
        'joints': {
            'hips': 'Hips', 'torso': 'Spine', 'ribs': 'Spine2', 'neck': 'Neck', 'head': 'Head',
            'cl': '{S}Shoulder', 'sh': '{S}Arm', 'el': '{S}ForeArm', 'wr': '{S}Hand',
            'fa': '{S}HandMiddle1', 'fb': '{S}HandMiddle2', 'fc': '{S}HandMiddle3', 'tb': '{S}HandThumb1',
            'th': '{S}UpLeg', 'kn': '{S}Leg', 'an': '{S}Foot', 'to': '{S}ToeBase',
        },
        'sides': {'L': 'Left', 'R': 'Right'},
    },
}

GAME_BONES = ['hips', 'torso', 'ribs', 'neck', 'head'] + [b + s for s in 'LR' for b in ('cl', 'sh', 'el', 'wr', 'fa', 'fb', 'fc', 'tb', 'th', 'kn', 'an', 'to')]
PARENT = {'torso': 'hips', 'ribs': 'torso', 'neck': 'ribs', 'head': 'neck'}
for s in 'LR':
    PARENT.update({'cl' + s: 'ribs', 'sh' + s: 'cl' + s, 'el' + s: 'sh' + s, 'wr' + s: 'el' + s, 'fa' + s: 'wr' + s, 'fb' + s: 'fa' + s,
                   'fc' + s: 'fb' + s, 'tb' + s: 'wr' + s, 'th' + s: 'hips', 'kn' + s: 'th' + s, 'an' + s: 'kn' + s, 'to' + s: 'an' + s})


def args():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    o = {'only': None, 'src': os.path.expanduser('~/Downloads')}
    for k, a in enumerate(argv):
        if a == '--only':
            o['only'] = argv[k + 1].split(',')
        elif a == '--src':
            o['src'] = os.path.expanduser(argv[k + 1])
    return o


def clean(name):
    n = name.split(':')[-1]
    return re.sub(r'_\d+$', '', n)


def compile_rig(fam):
    R = RIGS[fam]
    rules = []
    for pat, tgt in R['weights']:
        if '{S}' in pat:
            for s, S in R['sides'].items():
                t = [(a.format(s=s), w) for a, w in tgt] if isinstance(tgt, list) else [(tgt.format(s=s), 1.0)]
                rules.append((re.compile('^' + pat.replace('{S}', S) + '$'), t))
        else:
            rules.append((re.compile('^' + pat + '$'), tgt if isinstance(tgt, list) else [(tgt, 1.0)]))
    return rules


def target_of(rules, bname):
    c = clean(bname)
    for rx, t in rules:
        if rx.match(c):
            return t
    return None


def find_bone(arm, cname):
    for b in arm.data.bones:
        if clean(b.name) == cname:
            return b
    raise KeyError('找不到骨頭 ' + cname)


def sharp_by_angle(me, ang):
    """兩面夾角大於 ang 的邊標成銳邊（匯出時在那裡切開法線），其餘平滑。"""
    bm = bmesh.new()
    bm.from_mesh(me)
    for e in bm.edges:
        e.smooth = not (len(e.link_faces) == 2 and e.calc_face_angle(0) > ang)
    bm.to_mesh(me)
    bm.free()


# ---------------------------------------------------------------- 擺成 A 字
def rotate_about(pb, R, pivot):
    """在骨架空間繞 pivot 旋轉 R（3×3）這根骨頭（子骨跟著走）。"""
    T = Matrix.Translation(pivot) @ R.to_4x4() @ Matrix.Translation(-pivot)
    pb.matrix = T @ pb.matrix
    bpy.context.view_layer.update()


def aim(arm, pb, child_head, target_dir_world):
    """把骨頭從自己的頭指向 child_head（骨架空間）的方向轉到 target_dir_world（世界方向）。"""
    Mi = arm.matrix_world.to_3x3().inverted()
    tgt = (Mi @ target_dir_world).normalized()
    cur = (child_head() - pb.head).normalized()
    rotate_about(pb, cur.rotation_difference(tgt).to_matrix(), pb.head.copy())


def repose(arm, J, sides):
    pbs = arm.pose.bones
    P = lambda key, s: pbs[find_bone(arm, J[key].replace('{S}', sides[s])).name]
    a, t = BIND['shZ'], BIND['thZ']
    for s, sx in (('L', 1), ('R', -1)):
        arm_dir = V((sx * math.sin(a), 0, -math.cos(a)))
        leg_dir = V((sx * math.sin(t), 0, -math.cos(t)))
        sh, el, wr, fa = P('sh', s), P('el', s), P('wr', s), P('fb', s)
        aim(arm, sh, lambda: el.head, arm_dir)
        aim(arm, el, lambda: wr.head, arm_dir)
        aim(arm, wr, lambda: fa.head, arm_dir)
        th, kn, an = P('th', s), P('kn', s), P('an', s)
        foot_rot = an.matrix.to_3x3().copy()   # 腳掌維持原本的朝向（腳尖朝前、腳底平）
        aim(arm, th, lambda: kn.head, leg_dir)
        aim(arm, kn, lambda: an.head, leg_dir)
        rotate_about(an, foot_rot @ an.matrix.to_3x3().inverted(), an.head.copy())


# ---------------------------------------------------------------- 主流程
def build(hid, cfg, opt):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=os.path.join(opt['src'], cfg['src']))
    sc = bpy.context.scene
    arms = [o for o in sc.objects if o.type == 'ARMATURE']
    arm = max(arms, key=lambda o: len(o.data.bones))
    for o in sc.objects:
        if o.animation_data:
            o.animation_data.action = None
            o.animation_data_clear()
    for pb in arm.pose.bones:
        pb.matrix_basis.identity()
    bpy.context.view_layer.update()
    drop = re.compile(cfg['drop']) if cfg.get('drop') else None
    meshes = [o for o in sc.objects if o.type == 'MESH' and any(m.type == 'ARMATURE' and m.object == arm for m in o.modifiers)
              and not (drop and (drop.search(o.name) or any(drop.search(s.material.name) for s in o.material_slots if s.material)))]
    R = RIGS[cfg['rig']]
    repose(arm, R['joints'], R['sides'])
    # 量關節（世界座標，Blender z 朝上、−y 朝前）
    W = arm.matrix_world
    jw = {}
    for key, nm in R['joints'].items():
        for s in ('L', 'R') if '{S}' in nm else ('',):
            b = arm.pose.bones[find_bone(arm, nm.replace('{S}', R['sides'][s]) if s else nm).name]
            jw[key + s] = W @ b.head
    for s in 'LR':   # 指尖：中指第三節再往前延伸一節
        jw['ft' + s] = jw['fc' + s] + (jw['fc' + s] - jw['fb' + s])
    # 網格套用目前姿勢，合成一個物件
    dg = bpy.context.evaluated_depsgraph_get()
    for o in meshes:
        bpy.context.view_layer.objects.active = o
        o.select_set(True)
        for m in list(o.modifiers):
            if m.type == 'ARMATURE':
                bpy.ops.object.modifier_apply(modifier=m.name)
    for o in sc.objects:
        o.select_set(o in meshes)
    bpy.context.view_layer.objects.active = meshes[0]
    for o in meshes:   # 解除父子關係並保留世界變換
        mw = o.matrix_world.copy()
        o.parent = None
        o.matrix_world = mw
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    # 面的繞向與法線：Sketchfab 模型常有翻面、法線不一致，原檔靠 doubleSided 遮掉；遊戲材質只畫正面、外框殼畫背面，
    # 繞向反了會整片變黑。依拓樸把每塊相連的面統一朝外，清掉原檔的自訂法線，改用平滑法線（銳角邊照角度切開）
    for o in meshes:
        me = o.data
        bm = bmesh.new()
        bm.from_mesh(me)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        bm.to_mesh(me)
        bm.free()
        if me.has_custom_normals:
            bpy.context.view_layer.objects.active = o
            bpy.ops.mesh.customdata_custom_splitnormals_clear()
        for p in me.polygons:
            p.use_smooth = True
        sharp_by_angle(me, math.radians(cfg.get('sharp', 70)))
    if len(meshes) > 1:
        bpy.ops.object.join()
    body = bpy.context.view_layer.objects.active
    body.name = hid
    # 縮放、落地、置中（髖部 x、y 歸零）
    zs = [v.co.z for v in body.data.vertices]
    zs.sort()
    top, bot = zs[int(len(zs) * 0.9995)], zs[0]
    k = cfg['height'] / (top - bot)
    off = V((-jw['hips'].x, -jw['hips'].y, -bot))
    Mx = Matrix.Scale(k, 4) @ Matrix.Translation(off)
    body.data.transform(Mx)
    jw = {n: Mx @ p for n, p in jw.items()}
    # 權重：原始骨頭的群組併到遊戲骨頭
    rules = compile_rig(cfg['rig'])
    bones = {b.name: b for b in arm.data.bones}
    tgt = {}
    for g in body.vertex_groups:
        b = bones.get(g.name)
        t = None
        while b is not None and t is None:
            t = target_of(rules, b.name)
            b = b.parent
        tgt[g.index] = t or [('hips', 1.0)]
    nv = len(body.data.vertices)
    acc = [dict() for _ in range(nv)]
    for v in body.data.vertices:
        for ge in v.groups:
            for gb, w in tgt.get(ge.group, ()):
                acc[v.index][gb] = acc[v.index].get(gb, 0) + ge.weight * w
    for g in list(body.vertex_groups):
        body.vertex_groups.remove(g)
    vg = {n: body.vertex_groups.new(name=n) for n in GAME_BONES}
    empty = 0
    for i, a in enumerate(acc):
        top4 = sorted(a.items(), key=lambda kv: -kv[1])[:4]
        tot = sum(w for _, w in top4)
        if tot <= 1e-6:
            empty += 1
            vg['hips'].add([i], 1.0, 'REPLACE')
            continue
        for n, w in top4:
            vg[n].add([i], w / tot, 'REPLACE')
    if empty:
        print('  警告：%d 個頂點沒有權重，給 hips' % empty)
    # 原始骨架與其他物件全部刪掉，只留身體
    for o in list(sc.objects):
        if o != body:
            bpy.data.objects.remove(o, do_unlink=True)
    # 遊戲骨架（只為了輸出權重的骨名；執行時用遊戲自己的骨頭）
    ad = bpy.data.armatures.new('KI')
    ko = bpy.data.objects.new('KI', ad)
    sc.collection.objects.link(ko)
    bpy.context.view_layer.objects.active = ko
    bpy.ops.object.mode_set(mode='EDIT')
    eb = {}
    for n in GAME_BONES:
        b = ad.edit_bones.new(n)
        b.head = jw[n]
        b.tail = jw[n] + V((0, 0, 0.05))
        eb[n] = b
    for n, p in PARENT.items():
        eb[n].parent = eb[p]
    bpy.ops.object.mode_set(mode='OBJECT')
    body.parent = ko
    mod = body.modifiers.new('KI', 'ARMATURE')
    mod.object = ko
    # 關節表（遊戲座標：x 同、y＝Blender z、z＝−Blender y）
    g = lambda p: [round(p.x, 5), round(p.z, 5), round(-p.y, 5)]
    ko['ki_joints'] = json.dumps({n: g(p) for n, p in jw.items()})
    ko['ki_height'] = cfg['height']
    # 貼圖縮到 1024
    for im in bpy.data.images:
        if im.size[0] > 1024 or im.size[1] > 1024:
            s = 1024 / max(im.size)
            im.scale(max(1, int(im.size[0] * s)), max(1, int(im.size[1] * s)))
    tris = sum(len(p.vertices) - 2 for p in body.data.polygons)
    os.makedirs(OUT, exist_ok=True)
    out = os.path.join(OUT, hid + '.glb')
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', use_selection=True, export_animations=False, export_skins=True,
                              export_extras=True, export_yup=True, export_image_format='JPEG', export_jpeg_quality=88,
                              export_morph=False, export_cameras=False, export_lights=False)
    print('  %s：%d 三角形、%d KB → %s' % (hid, tris, os.path.getsize(out) // 1024, out))


def main():
    opt = args()
    for hid in opt['only'] or list(HEROES):
        build(hid, HEROES[hid], opt)


main()
