"""霓虹夜城（260）的人物，改自 268 TERRA 的同名腳本：Quaternius Universal Base Characters 男女底模＋ Universal Animation Library 動畫（皆 CC0），
輸出 blender/out/people.glb（打包時以 gzip＋base64 內嵌）。

    /Applications/Blender.app/Contents/MacOS/Blender -b -P blender/people.py

素材包由 games/197-openworld/tools/fetch-quaternius.py 下載到 games/197-openworld/.cache/（或設 QUATERNIUS_CACHE）。
- 以 bmesh 平面切齊領口、短袖口、手腕袖口、上衣下擺、膝上褲裙緣、鞋口與鞋底邊緣，消除鋸齒狀材質交界；
  並做出領口滾邊、上衣下擺覆蓋褲頭的立體層次、布料自然皺褶，以及圓頭鞋楦與平底鞋底（不再露出五趾輪廓）。
- 男女各掛七種髮型／帽款（男：旁分、寸頭、光頭落腮鬍、寸頭落腮鬍、旁分落腮鬍、後梳厚髮、鴨舌戰術帽；
  女：長直髮、雙包頭、俐落極短髮、及肩鮑伯頭、低挽單髻、中長微捲髮、鴨舌帽），眉毛與眼睛沿用底模。
- 將男女淺膚色（保留五官唇色、鼻影、眼窩、耳廓與手指關節指甲細節，以中性膚色正規化供前端乘色）、
  雙髮絲貼圖、眼白虹膜貼圖與布料斜紋微結構打包成單張 1024×1024 角色細節圖集（T_CharAtlas），單次取樣即可呈現真實五官與眼神。
- 動畫：從 UAL 挑出待機、說話、行走、端莊行走、慢跑、衝刺、坐、坐著聊天、駕駛、跳舞、出拳，以及持槍瞄準射擊、換彈、中彈、倒地、蹲、翻滾、揮砍、游泳（見 KEEP）。
"""
import math
import os

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Quaternion, Vector

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.environ.get('QUATERNIUS_CACHE') or os.path.normpath(os.path.join(ROOT, '../197-openworld/.cache'))
UBC = os.path.join(CACHE, 'ubc/Universal Base Characters[Standard]')
BODY = os.path.join(UBC, 'Base Characters/Godot - UE/Superhero_{}_FullBody.gltf')
HAIR = os.path.join(UBC, 'Hairstyles/Rigged to Head Bone/glTF (Godot -Unreal)/{}.gltf')
ANIMS = os.path.join(CACHE, 'ual/Universal Animation Library[Standard]/Unreal-Godot/UAL1_Standard.glb')
OUT = os.path.join(ROOT, 'blender/out/people.glb')

# 髮型與帽款清單（前 3 項維持原名稱與順序以完全相容舊索引，後面擴充真實都市髮型與帽款）
HAIR_SPECS = {
    'Male': [
        ('Hair_SimpleParted', ['Hair_SimpleParted'], None),
        ('Hair_Buzzed', ['Hair_Buzzed'], None),
        ('Hair_Beard', ['Hair_Beard'], None),
        ('Hair_BuzzedBeard', ['Hair_Buzzed', 'Hair_Beard'], None),
        ('Hair_PartedBeard', ['Hair_SimpleParted', 'Hair_Beard'], None),
        ('Hair_Swept', ['Hair_SimpleParted'], 'swept'),
        ('Hair_Cap', ['Hair_Buzzed'], 'cap'),
    ],
    'Female': [
        ('Hair_Long', ['Hair_Long'], None),
        ('Hair_Buns', ['Hair_Buns'], None),
        ('Hair_BuzzedFemale', ['Hair_BuzzedFemale'], None),
        ('Hair_Bob', ['Hair_Long'], 'bob'),
        ('Hair_LowBun', ['Hair_Buns'], 'lowbun'),
        ('Hair_WavyMid', ['Hair_Long'], 'wavymid'),
        ('Hair_Cap', ['Hair_BuzzedFemale'], 'cap'),
    ],
}

# 夜城用得到的動作；調酒、DJ、撐傘、抽菸、抱胸、滑手機由前端在這些動作上覆寫骨頭旋轉（40-people.js）
KEEP = ['Idle_Loop', 'Idle_Talking_Loop', 'Walk_Loop', 'Walk_Formal_Loop', 'Jog_Fwd_Loop', 'Sprint_Loop', 'Sitting_Idle_Loop',
        'Sitting_Talking_Loop', 'Driving_Loop', 'Dance_Loop', 'Punch_Jab', 'Punch_Cross',
        # GTA 式擴充：持槍、瞄準、射擊、換彈、中彈、倒地、蹲、翻滾、揮砍、開門
        'Pistol_Idle_Loop', 'Pistol_Aim_Neutral', 'Pistol_Aim_Up', 'Pistol_Aim_Down', 'Pistol_Shoot', 'Pistol_Reload',
        'Hit_Chest', 'Hit_Head', 'Death01', 'Crouch_Idle_Loop', 'Crouch_Fwd_Loop', 'Roll', 'Sword_Attack', 'Interact',
        # 游泳（下水）
        'Swim_Idle_Loop', 'Swim_Fwd_Loop']
SLOTS = ['skin', 'top', 'sleeve', 'bottom', 'shin', 'shoe']
# 把超級英雄誇張的倒三角肌肉收斂成自然都市人的基礎骨架比例（前端再依每人雜湊拉出高矮胖瘦差異）
SLIM = {
    'Male': {
        'upperarm_': 0.74, 'lowerarm_': 0.81, 'clavicle_': 0.85,
        'thigh_': 0.87, 'calf_': 0.90, 'spine_0': 0.88, 'neck_01': 0.84,
    },
    'Female': {
        'upperarm_': 0.84, 'lowerarm_': 0.88, 'clavicle_': 0.92,
        'thigh_': 0.90, 'calf_': 0.93, 'spine_0': 0.93, 'neck_01': 0.90,
    },
}
# 衣物基礎厚度（公尺）：top 覆蓋在 bottom 之上（0.0145 > 0.009），袖與小腿兼顧露膚與穿衣時的自然粗細
PUFF = {'top': 0.0145, 'sleeve': 0.0055, 'bottom': 0.0090, 'shin': 0.0060, 'shoe': 0.0175}

# 1024×1024 圖集分區：(x0, y0, w, h, pad)，每個分區內縮 pad 像素並以邊緣像素外推，避免 mipmap 滲色
ATLAS_W, ATLAS_H = 1024, 1024
ATLAS_RECTS = {
    'Male_skin':   (0,   512, 512, 512, 6),   # 500×500 有效解析度（優於舊版 256×256）
    'Female_skin': (512, 512, 512, 512, 6),   # 500×500 有效解析度
    'Hair_1':      (0,     0, 368, 512, 8),   # 352×496 有效解析度
    'Hair_2':      (368,   0, 368, 512, 8),   # 352×496 有效解析度
    'Eye':         (736, 224, 288, 288, 16),  # 256×256 原生 1:1 解析度
    'Fabric':      (736,   0, 288, 224, 16),  # 256×192 布料斜紋細節
}
NEUTRAL_REF = 0.82  # 圖集中性基準值（線性空間），預留 >1.0 的指甲、鼻樑與皮膚亮部空間


def import_gltf(path):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    return [o for o in bpy.data.objects if o not in before]


def plain(name, rgb, tex_img=None):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    b = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    b.inputs['Base Color'].default_value = (*rgb, 1)
    b.inputs['Roughness'].default_value = 0.85
    if tex_img is not None:
        tn = nt.nodes.new('ShaderNodeTexImage')
        tn.image = tex_img
        nt.links.new(tn.outputs['Color'], b.inputs['Base Color'])
    return m


def load_linear_rgb(path):
    im = bpy.data.images.load(path)
    w, h = im.size
    arr = np.empty(w * h * 4, dtype=np.float32)
    im.pixels.foreach_get(arr)
    bpy.data.images.remove(im)
    return arr.reshape((h, w, 4))[..., :3]


def resize_bilinear(img, out_h, out_w):
    h, w, c = img.shape
    if h == out_h and w == out_w:
        return img.copy()
    ys = (np.arange(out_h, dtype=np.float32) + 0.5) * (h / out_h) - 0.5
    xs = (np.arange(out_w, dtype=np.float32) + 0.5) * (w / out_w) - 0.5
    ys = np.clip(ys, 0.0, h - 1.0001)
    xs = np.clip(xs, 0.0, w - 1.0001)
    y0 = np.floor(ys).astype(np.int32)
    x0 = np.floor(xs).astype(np.int32)
    y1 = np.minimum(y0 + 1, h - 1)
    x1 = np.minimum(x0 + 1, w - 1)
    wy = (ys - y0)[:, None, None]
    wx = (xs - x0)[None, :, None]
    top = img[y0][:, x0] * (1.0 - wx) + img[y0][:, x1] * wx
    bot = img[y1][:, x0] * (1.0 - wx) + img[y1][:, x1] * wx
    return top * (1.0 - wy) + bot * wy


def build_char_atlas():
    """建立 1024×1024 角色細節圖集：正規化男女五官手部皮膚、雙髮絲貼圖、真實眼白虹膜與斜紋布料微結構"""
    atlas = np.full((ATLAS_H, ATLAS_W, 4), NEUTRAL_REF, dtype=np.float32)
    atlas[..., 3] = 1.0

    def put_cell(key, rgb):
        x0, y0, cw, ch, pad = ATLAS_RECTS[key]
        iw, ih = cw - pad * 2, ch - pad * 2
        sub = np.clip(resize_bilinear(rgb, ih, iw), 0.0, 1.0)
        padded = np.pad(sub, ((pad, pad), (pad, pad), (0, 0)), mode='edge')
        atlas[y0:y0 + ch, x0:x0 + cw, :3] = padded

    # 1. 男女皮膚：除以平坦膚色基準（約 p78），乘上 NEUTRAL_REF，保留唇色、眼窩、鼻孔、耳朵與手指關節指甲色差
    tex_dir = os.path.join(UBC, 'Base Characters/Textures')
    for key, fn in (('Male_skin', 'T_Superhero_Male_Ligh.png'), ('Female_skin', 'T_Superhero_Female_Light_BaseColor.png')):
        raw = load_linear_rgb(os.path.join(tex_dir, fn))
        mask = raw.sum(axis=-1) > 0.2
        ref = np.percentile(raw[mask], 78, axis=0)
        norm = (raw / np.maximum(ref, 1e-4)) * NEUTRAL_REF
        # 適度強化五官與指節的微陰影對比，避免遠看太平
        lum = norm.mean(axis=-1, keepdims=True)
        chroma = norm / np.maximum(lum, 1e-4)
        lum_enh = NEUTRAL_REF + (lum - NEUTRAL_REF) * 1.18
        put_cell(key, np.clip(lum_enh * chroma, 0.14, 1.0))

    # 2. 兩張髮絲貼圖：強化髮束深淺條紋，乘上前端髮色後有自然髮絲層次
    for key, fn in (('Hair_1', 'T_Hair_1_BaseColor.png'), ('Hair_2', 'T_Hair_2_BaseColor.png')):
        raw = load_linear_rgb(os.path.join(tex_dir, fn))
        med = np.median(raw, axis=(0, 1))
        norm = NEUTRAL_REF + ((raw / np.maximum(med, 1e-4)) - 1.0) * (NEUTRAL_REF * 1.85)
        put_cell(key, np.clip(norm, 0.22, 1.0))

    # 3. 眼睛貼圖：保留真實眼白微血管、虹膜放射狀紋理與深黑瞳孔；抹除中央死板的靜態白點改由即時高光反射呈現
    eye = load_linear_rgb(os.path.join(tex_dir, 'T_Eye_Brown.png'))
    eh, ew, _ = eye.shape
    yy, xx = np.mgrid[0:eh, 0:ew]
    rr = np.hypot(xx - ew * 0.5, yy - eh * 0.5)
    # 瞳孔中心（r < 9px）若原本有畫死的白色反光點，改為深邃瞳孔黑，讓太陽與霓虹燈即時高光更自然
    pupil_glint = (rr < 9.5) & (eye.mean(axis=-1) > 0.08)
    eye[pupil_glint] = 0.008
    put_cell('Eye', eye)

    # 4. 布料斜紋／針織微結構（供上衣、褲子與帽款在近距離呈現細緻織物感）
    fh, fw = ATLAS_RECTS['Fabric'][3] - 32, ATLAS_RECTS['Fabric'][2] - 32
    fy, fx = np.mgrid[0:fh, 0:fw].astype(np.float32)
    twill = np.sin((fx + fy * 1.5) * (2.0 * math.pi / 4.0)) * 0.032
    weft = np.sin(fx * (2.0 * math.pi / 3.0)) * np.sin(fy * (2.0 * math.pi / 3.0)) * 0.022
    grain = np.sin(fx * 1.7 + np.cos(fy * 1.3) * 2.0) * 0.014
    fab = np.full((fh, fw, 3), NEUTRAL_REF, dtype=np.float32) + (twill + weft + grain)[..., None]
    put_cell('Fabric', np.clip(fab, 0.5, 1.0))

    img = bpy.data.images.new('T_CharAtlas', width=ATLAS_W, height=ATLAS_H, alpha=False)
    img.pixels.foreach_set(atlas.ravel())
    img.pack()
    return img


def remap_mesh_uvs(me, rect_key, wrap_uv=False):
    x0, y0, cw, ch, pad = ATLAS_RECTS[rect_key]
    u0 = (x0 + pad) / ATLAS_W
    v0 = (y0 + pad) / ATLAS_H
    uw = (cw - pad * 2) / ATLAS_W
    vh = (ch - pad * 2) / ATLAS_H
    if not me.uv_layers:
        me.uv_layers.new(name='UVMap')
    uv_data = me.uv_layers[0].data
    for loop in uv_data:
        u, v = loop.uv
        if wrap_uv:
            u = u - math.floor(u)
            v = v - math.floor(v)
        else:
            u = max(0.0, min(1.0, u))
            v = max(0.0, min(1.0, v))
        loop.uv = (u0 + u * uw, v0 + v * vh)


def build_cap_mesh(name, arm, body_me, body_mw):
    """依角色實際頭顱頂點量身建立結構化鴨舌／戰術帽（含六片式帽冠與弧形立體帽簷，綁定至 Head 骨，完全包覆前額不穿模）"""
    head_z_top = max((body_mw @ v.co).z for v in body_me.vertices)
    band_z = head_z_top - 0.060  # 落在眉骨上方額頭中段，避免壓到眉毛或讓眉弓穿出帽冠
    # 取帽帶高度以上的全部頭蓋骨頂點（排除外耳廓 |x| > 0.095），確保帽冠完整包覆前額與後腦
    crown_vs = [
        body_mw @ v.co for v in body_me.vertices
        if (body_mw @ v.co).z > band_z - 0.012 and abs((body_mw @ v.co).x) < 0.095
    ]
    if not crown_vs:
        crown_vs = [body_mw @ v.co for v in body_me.vertices if (body_mw @ v.co).z > head_z_top - 0.070]
    rx = max(abs(v.x) for v in crown_vs) + 0.009
    y_min = min(v.y for v in crown_vs) - 0.010
    y_max = max(v.y for v in crown_vs) + 0.009
    cy = 0.5 * (y_min + y_max)
    ry = 0.5 * (y_max - y_min)
    rz = (head_z_top - band_z) + 0.015

    bm = bmesh.new()
    segs = 24
    rings = 6
    ring_verts = []
    # 帽冠：從帽帶往上收攏至帽頂，前額略微挺立、後腦自然往下包覆至枕骨
    for ri in range(rings):
        v_frac = ri / rings
        elev = v_frac * (math.pi * 0.5)
        cr = math.cos(elev)
        sr = math.sin(elev)
        profile = cr ** 0.84
        row = []
        for si in range(segs):
            ang = (si / segs) * (2.0 * math.pi)  # 0 為 -Y（正前方），逆時針
            dx = math.sin(ang)
            dy = -math.cos(ang)
            # 後側（dy > 0）帽帶自然往下包覆 1.2 cm，前側保持俐落眉上高度
            back_drop = -0.012 * max(0.0, dy) * (1.0 - v_frac)
            seam_indent = -0.0007 * (abs(math.sin(ang * 3.0)) ** 4) * math.sin(elev)
            px = dx * (rx + seam_indent) * profile
            py = cy + dy * (ry + seam_indent) * profile
            pz = band_z + back_drop + sr * rz
            row.append(bm.verts.new((px, py, pz)))
        ring_verts.append(row)
    apex = bm.verts.new((0.0, cy + 0.003, band_z + rz + 0.003))
    for ri in range(rings - 1):
        for si in range(segs):
            sn = (si + 1) % segs
            bm.faces.new((ring_verts[ri][si], ring_verts[ri][sn], ring_verts[ri + 1][sn], ring_verts[ri + 1][si]))
    for si in range(segs):
        sn = (si + 1) % segs
        bm.faces.new((ring_verts[-1][si], ring_verts[-1][sn], apex))
    # 帽帶內折下緣（4 mm 厚度，避免仰角看到單層薄片）
    inner_band = []
    for si in range(segs):
        v0 = ring_verts[0][si].co
        inner_band.append(bm.verts.new((v0.x * 0.92, cy + (v0.y - cy) * 0.92, v0.z - 0.0025)))
    for si in range(segs):
        sn = (si + 1) % segs
        bm.faces.new((inner_band[si], inner_band[sn], ring_verts[0][sn], ring_verts[0][si]))

    # 弧形前帽簷（涵蓋前方 ±60°，即 si = 20..23, 0..4 共 9 個節點）
    visor_idx = [(segs - 4 + k) % segs for k in range(9)]
    visor_steps = 4
    visor_len = 0.072
    visor_thick = 0.0040
    top_grid = []
    bot_grid = []
    for st in range(visor_steps + 1):
        t = st / visor_steps
        t_row, b_row = [], []
        for idx_i, si in enumerate(visor_idx):
            u_lat = (idx_i / (len(visor_idx) - 1)) * 2.0 - 1.0  # -1..+1
            base = ring_verts[0][si].co
            fwd = visor_len * t * (1.0 - 0.22 * (u_lat ** 2) * t)
            narrow = 1.0 - 0.13 * t
            arch_drop = -0.014 * t - 0.013 * (u_lat ** 2) * (0.30 + 0.70 * t)
            vx = base.x * narrow
            vy = base.y - fwd
            vz = base.z + 0.002 + arch_drop
            t_row.append(bm.verts.new((vx, vy, vz + visor_thick * 0.5)))
            b_row.append(bm.verts.new((vx, vy, vz - visor_thick * 0.5)))
        top_grid.append(t_row)
        bot_grid.append(b_row)
    for st in range(visor_steps):
        for j in range(len(visor_idx) - 1):
            bm.faces.new((top_grid[st][j], top_grid[st][j + 1], top_grid[st + 1][j + 1], top_grid[st + 1][j]))
            bm.faces.new((bot_grid[st][j + 1], bot_grid[st][j], bot_grid[st + 1][j], bot_grid[st + 1][j + 1]))
    # 帽簷前緣與左右側封邊
    for j in range(len(visor_idx) - 1):
        bm.faces.new((bot_grid[-1][j], bot_grid[-1][j + 1], top_grid[-1][j + 1], top_grid[-1][j]))
    for st in range(visor_steps):
        bm.faces.new((bot_grid[st][0], top_grid[st][0], top_grid[st + 1][0], bot_grid[st + 1][0]))
        bm.faces.new((top_grid[st][-1], bot_grid[st][-1], bot_grid[st + 1][-1], top_grid[st + 1][-1]))

    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    uv_lay = bm.loops.layers.uv.new('UVMap')
    for f in bm.faces:
        f.smooth = True
        for lp in f.loops:
            co = lp.vert.co
            lp[uv_lay].uv = ((co.x * 3.5) % 1.0, ((co.y + co.z) * 3.5) % 1.0)

    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()

    # 轉回骨架局部空間並綁上 Head 權重 1.0
    inv_arm = arm.matrix_world.inverted()
    me.transform(inv_arm)
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    obj.parent = arm
    obj.matrix_parent_inverse.identity()
    vg = obj.vertex_groups.new(name='Head')
    vg.add(list(range(len(me.vertices))), 1.0, 'REPLACE')
    mod = obj.modifiers.new(name='Armature', type='ARMATURE')
    mod.object = arm
    return obj


def sculpt_hair_variant(hmesh, arm, body_me, mode):
    """以 CC0 原始髮型網格雕塑出自然都市髮型（不減少任何頂點與面數）"""
    if not mode:
        return
    me = hmesh.data
    mw = arm.matrix_world @ hmesh.matrix_local
    inv = mw.inverted()
    bones = arm.data.bones
    nk = arm.matrix_world @ bones['neck_01'].head_local
    hd = arm.matrix_world @ bones['Head'].head_local
    head_top = max((arm.matrix_world @ v.co).z for v in body_me.vertices)

    if me.has_custom_normals:
        me.normals_split_custom_set_from_vertices([(0, 0, 1)] * len(me.vertices))
        try:
            bpy.context.view_layer.objects.active = hmesh
            hmesh.select_set(True)
            bpy.ops.mesh.customdata_custom_splitnormals_clear()
            hmesh.select_set(False)
        except Exception:
            pass

    for v in me.vertices:
        wco = mw @ v.co
        if mode == 'swept':
            # 鏡射分線至另一側、略微蓬鬆頭頂並收攏兩側鬢角，做出俐落後梳厚髮
            wco.x = -wco.x * 0.95
            above = max(0.0, wco.z - hd.z)
            wco.z += 0.010 * min(1.0, above / 0.14)
            wco.y += 0.012 * min(1.0, above / 0.14)
        elif mode == 'bob':
            # 及肩內彎鮑伯頭：將肩線以下的長髮平滑收短至鎖骨上方並微微內扣，完整保留原本面數與髮尾層次
            cut_z = nk.z - 0.015
            if wco.z < cut_z:
                below = cut_z - wco.z
                wco.z = cut_z - math.tanh(below * 9.0) * 0.055
                inward = min(1.0, below / 0.16)
                wco.x *= (1.0 - 0.22 * inward)
                if wco.y > nk.y - 0.02:
                    wco.y -= 0.018 * inward
        elif mode == 'wavymid':
            # 中長微捲層次髮：收至肩下胸上，加入自然波浪起伏
            cut_z = nk.z - 0.095
            if wco.z < cut_z:
                below = cut_z - wco.z
                wco.z = cut_z - below * 0.58
            wave = math.sin(wco.z * 34.0 + wco.x * 12.0) * 0.007 * max(0.0, min(1.0, (hd.z + 0.05 - wco.z) / 0.22))
            wco.x += wave * (1.0 if wco.x >= 0 else -1.0)
            wco.y += math.cos(wco.z * 28.0) * 0.005
        elif mode == 'lowbun':
            # 將原本偏動漫感的左右高雙包頭，平滑聚攏成後腦杓自然單發髻
            dist_side = abs(wco.x)
            high = wco.z - (hd.z + 0.045)
            if dist_side > 0.065 and (high > 0.015 or wco.y > hd.y + 0.030):
                t = min(1.0, max(0.0, (dist_side - 0.065) / 0.050))
                wco.x *= (1.0 - 0.82 * t)
                wco.y += 0.046 * t
                wco.z -= 0.052 * t
        elif mode == 'cap':
            # 戴帽時將帽帶以上的寸頭往頭骨內縮，避免穿出帽冠，保留兩側鬢角與後頸自然短髮
            band_z = head_top - 0.064
            if wco.z > band_z:
                t = min(1.0, (wco.z - band_z) / 0.018)
                center = Vector((0.0, hd.y, band_z))
                wco = wco.lerp(center + (wco - center) * 0.80, t)
        v.co = inv @ wco
    me.update()


def weld_smooth_normals(me):
    """清除舊的匯入法線、重算平滑面法線，並在 UV 接縫同位置頂點間平均法線以消除接縫亮線"""
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    for f in bm.faces:
        f.smooth = True
    bm.normal_update()
    spot_n = {}
    for v in bm.verts:
        key = (round(v.co.x, 4), round(v.co.y, 4), round(v.co.z, 4))
        spot_n[key] = spot_n.get(key, Vector((0.0, 0.0, 0.0))) + v.normal
    loop_normals = []
    for f in bm.faces:
        for lp in f.loops:
            v = lp.vert
            key = (round(v.co.x, 4), round(v.co.y, 4), round(v.co.z, 4))
            n = spot_n[key]
            loop_normals.append(n.normalized() if n.length_squared > 1e-12 else v.normal)
    bm.to_mesh(me)
    bm.free()
    if me.has_custom_normals:
        try:
            me.normals_split_custom_set(loop_normals)
        except Exception:
            pass
    else:
        me.normals_split_custom_set(loop_normals)


bpy.ops.wm.read_factory_settings(use_empty=True)
atlas_img = build_char_atlas()
cap_mat_shared = {}

for gi, g in enumerate(('Male', 'Female')):
    objs = import_gltf(BODY.format(g))
    arm = next(o for o in objs if o.type == 'ARMATURE')
    arm.name = g
    arm.data.name = g
    body = next(o for o in objs if o.type == 'MESH' and o.name.lower().startswith('superhero'))
    for o in objs:
        if o.type == 'MESH' and o.parent is None:
            bpy.data.objects.remove(o, do_unlink=True)  # 匯入器帶進來的 Icosphere
    body.name = f'{g}_Body'
    for o in arm.children:
        if o.type == 'MESH' and o is not body:
            is_eye = 'eye' in o.name.lower() and 'brow' not in o.name.lower()
            o.name = f'{g}_{"Eyes" if is_eye else "Brows"}'
            if is_eye:
                remap_mesh_uvs(o.data, 'Eye', wrap_uv=True)
            else:
                mat0 = o.data.materials[0].name if o.data.materials and o.data.materials[0] else 'MI_Hair_1'
                remap_mesh_uvs(o.data, 'Hair_2' if 'Hair_2' in mat0 else 'Hair_1', wrap_uv=False)

    bones = arm.data.bones
    P = {n: arm.matrix_world @ bones[n].head_local for n in ('pelvis', 'spine_02', 'spine_03', 'Head', 'neck_01', 'upperarm_l', 'lowerarm_l', 'hand_l', 'calf_l', 'foot_l', 'ball_l')}
    knee = P['calf_l'].z
    nk = P['neck_01']
    sx = abs(P['upperarm_l'].x)
    hx = abs(P['hand_l'].x) - 0.018

    me = body.data
    # 先把身體 UV 對齊到圖集對應性別的 500×500 皮膚區（後續 bisect_plane 會自動線性插值新頂點的 UV 與骨頭權重）
    remap_mesh_uvs(me, f'{g}_skin', wrap_uv=False)

    me.materials.clear()
    mats = {'skin': plain(f'{g}_skin', (1.0, 1.0, 1.0), tex_img=atlas_img)}
    for s in SLOTS[1:]:
        mats[s] = plain(f'{g}_{s}', {'top': (0.8, 0.35, 0.12), 'sleeve': (0.78, 0.34, 0.12), 'bottom': (0.22, 0.25, 0.3), 'shin': (0.21, 0.24, 0.29), 'shoe': (0.3, 0.3, 0.32)}[s], tex_img=atlas_img)
    for s in SLOTS:
        me.materials.append(mats[s])
    cap_mat_shared[g] = plain(f'{g}_cap', (0.18, 0.2, 0.24), tex_img=atlas_img)

    groups = {vg.index: vg.name for vg in body.vertex_groups}

    # 1. 依骨頭權重收斂超級英雄誇張肌肉，並柔和男性胸肌外凸，使基礎身形自然真實
    slim = SLIM[g]
    segs = {}
    inv = body.matrix_world.inverted() @ arm.matrix_world
    mw = body.matrix_world
    mw_inv = mw.inverted()
    for b in bones:
        k = next((v for p, v in slim.items() if b.name.startswith(p)), None)
        if k is not None:
            segs[b.name] = (inv @ b.head_local, inv @ b.tail_local, k)
    for v in me.vertices:
        acc = Vector((0, 0, 0))
        tw = 0.0
        for gr in v.groups:
            name = groups.get(gr.group, '')
            w = gr.weight
            if w <= 0:
                continue
            tw += w
            sg = segs.get(name)
            if not sg:
                acc += v.co * w
                continue
            a, b2, k = sg
            ab = b2 - a
            t = max(0.0, min(1.0, (v.co - a).dot(ab) / max(ab.length_squared, 1e-9)))
            c = a + ab * t
            acc += (c + (v.co - c) * k) * w
        if tw > 0:
            v.co = acc / tw
        # 男性胸廓前側微收，避免穿 T 恤像緊身盔甲
        if g == 'Male':
            wco = mw @ v.co
            if P['spine_02'].z < wco.z < P['neck_01'].z - 0.03 and abs(wco.x) < sx * 0.92 and wco.y < -0.04:
                zt = 1.0 - abs(wco.z - (P['spine_03'].z + 0.04)) / 0.18
                if zt > 0:
                    wco.y *= (1.0 - 0.11 * zt)
                    v.co = mw_inv @ wco

    # 1b. 在切鞋底平面之前，將前掌與赤腳五趾平滑投影至凸超橢球圓頭鞋楦（徹底消除五趾分叉與趾縫陰影）
    me.update()
    foot_top_z = P['foot_l'].z + 0.052
    foot_bounds = {}
    for sgn in (1.0, -1.0):
        fvs = [mw @ v.co for v in me.vertices if (mw @ v.co).z < foot_top_z and (mw @ v.co).x * sgn > 0.005]
        y_min_f = min(p.y for p in fvs)
        y_max_f = max(p.y for p in fvs)
        x_med = min(p.x * sgn for p in fvs)
        x_lat = max(p.x * sgn for p in fvs)
        # 前掌橢球中心設在腳長中段偏後（約自腳跟往前 45%），讓前半雙腳完整落在平滑圓頭鞋楦包絡面上
        cy_shoe = y_min_f + 0.56 * (y_max_f - y_min_f)
        rx_shoe = 0.5 * (x_lat - x_med) + 0.012
        ry_shoe = (cy_shoe - y_min_f) + 0.012
        foot_bounds[sgn] = (cy_shoe, 0.5 * (x_med + x_lat), rx_shoe, ry_shoe)
    f_keys = [(round(v.co.x, 4), round(v.co.y, 4), round(v.co.z, 4)) for v in me.vertices]
    f_new = {}
    for idx_v, v in enumerate(me.vertices):
        fk = f_keys[idx_v]
        if fk in f_new:
            continue
        wco = mw @ v.co
        if wco.z < foot_top_z and abs(wco.x) > 0.005:
            sgn = 1.0 if wco.x >= 0.0 else -1.0
            cy_s, xm_s, rx_s, ry_s = foot_bounds[sgn]
            if wco.y < cy_s + 0.015:
                t_b = min(1.0, max(0.0, (cy_s + 0.015 - wco.y) / 0.065))
                sm = t_b * t_b * (3.0 - 2.0 * t_b)
                dx = wco.x * sgn - xm_s
                dy = wco.y - cy_s  # 前方為負
                dz = max(0.0, wco.z - 0.002)
                rz_s = 0.064
                # 超橢球範數：鞋底至中底（dz 小）維持近垂直邊牆，往上收成圓潤鞋面拱頂
                q_xy = math.hypot(dx / rx_s, dy / ry_s)
                q_z = dz / rz_s
                denom = (q_xy ** 2.4 + q_z ** 2.4) ** (1.0 / 2.4)
                if denom > 1e-5:
                    scale_r = 1.0 / denom
                    tx = (xm_s + dx * scale_r) * sgn
                    ty = cy_s + dy * scale_r
                    tz = 0.002 if wco.z < 0.009 else (0.002 + dz * scale_r)
                    # 只往外推平凹陷趾縫與統一圓頭輪廓
                    blend = sm * (0.96 if scale_r > 1.0 else 0.82)
                    wco.x = wco.x + (tx - wco.x) * blend
                    wco.y = wco.y + (ty - wco.y) * blend
                    wco.z = wco.z + (tz - wco.z) * blend
        f_new[fk] = mw_inv @ wco
    for idx_v, v in enumerate(me.vertices):
        v.co = f_new[f_keys[idx_v]]
    me.update()

    # 2. 用 bmesh.ops.bisect_plane 沿平滑解剖切面切齊所有衣物交界（自動保留並插值 UV 與骨骼權重，徹底消除鋸齒邊！）
    # 領口：建立環繞頸根的 8 切面自然圓領錐（正面微凹至鎖骨窩、兩側收在頸根、後頸貼合，消除寬方領與側邊鋸齒）
    col_rx = 0.068 if g == 'Male' else 0.058
    col_ry = 0.066 if g == 'Male' else 0.056
    col_cy = nk.y - 0.008
    col_z_base = nk.z + (0.001 if g == 'Male' else -0.002)
    collar_planes = []
    for ki in range(8):
        ang = ki * (math.pi * 0.25)
        sx_a = math.sin(ang)
        cy_a = math.cos(ang)  # +1 為正前方（-Y）
        front_dip = 0.020 * max(0.0, cy_a)
        pt = Vector((col_rx * sx_a, col_cy - col_ry * cy_a, col_z_base - front_dip))
        # 法線朝向頸部內上方（在所有 8 個半空間內即為頸部／頭部皮膚）
        no = Vector((-sx_a * 0.62, cy_a * 0.62, 0.78)).normalized()
        collar_planes.append((pt, no))

    # 袖口與手腕切面：嚴格沿上臂骨與前臂骨軸向垂直切開，無論 A-pose／T-pose 皆 100% 垂直貼合手臂圓柱
    ua_l_dir = (P['lowerarm_l'] - P['upperarm_l']).normalized()
    ss_l_co = P['upperarm_l'].lerp(P['lowerarm_l'], 0.50)
    ss_l_no = ua_l_dir
    ss_r_co = Vector((-ss_l_co.x, ss_l_co.y, ss_l_co.z))
    ss_r_no = Vector((-ua_l_dir.x, ua_l_dir.y, ua_l_dir.z)).normalized()

    fa_l_dir = (P['hand_l'] - P['lowerarm_l']).normalized()
    wr_l_co = P['lowerarm_l'].lerp(P['hand_l'], 0.90)
    wr_l_no = fa_l_dir
    wr_r_co = Vector((-wr_l_co.x, wr_l_co.y, wr_l_co.z))
    wr_r_no = Vector((-fa_l_dir.x, fa_l_dir.y, fa_l_dir.z)).normalized()

    waist_co = Vector((0.0, 0.0, P['pelvis'].z + 0.036))
    waist_no = Vector((0.0, -0.04, 1.0)).normalized()
    knee_co = Vector((0.0, 0.0, knee + 0.026))
    knee_no = Vector((0.0, 0.03, 1.0)).normalized()
    ankle_co = Vector((0.0, P['foot_l'].y, P['foot_l'].z + 0.052))
    ankle_no = Vector((0.0, -0.14, 1.0)).normalized()
    sole_co = Vector((0.0, 0.0, 0.017))
    sole_no = Vector((0.0, 0.0, 1.0))

    ARM_PREFIXES = ('upperarm_', 'lowerarm_', 'hand_', 'index_', 'middle_', 'ring_', 'pinky_', 'thumb_')

    bm = bmesh.new()
    bm.from_mesh(me)
    deform_lay = bm.verts.layers.deform.verify()

    def bm_vert_is_arm(bv):
        d = bv[deform_lay]
        best_g, best_w = '', 0.0
        for gi_k, w in d.items():
            if w > best_w:
                best_g, best_w = groups.get(gi_k, ''), w
        return best_g.startswith(ARM_PREFIXES)

    def cut_band(co_w, no_w, pred_face):
        faces = [f for f in bm.faces if pred_face(f, mw @ f.calc_center_median())]
        if not faces:
            return
        edges = {e for f in faces for e in f.edges}
        verts = {v for f in faces for v in f.verts}
        co_l = mw_inv @ co_w
        no_l = (mw.to_3x3().transposed() @ no_w).normalized()
        bmesh.ops.bisect_plane(bm, geom=list(verts) + list(edges) + faces, dist=1e-5, plane_co=co_l, plane_no=no_l)

    for c_pt, c_no in collar_planes:
        cut_band(c_pt, c_no, lambda f, c: abs(c.x) < 0.125 and nk.z - 0.075 < c.z < nk.z + 0.045 and nk.y - 0.12 < c.y < nk.y + 0.10)
    cut_band(ss_l_co, ss_l_no, lambda f, c, p=ss_l_co, n=ss_l_no: c.x > 0.05 and any(bm_vert_is_arm(v) for v in f.verts) and abs((c - p).dot(n)) < 0.11)
    cut_band(ss_r_co, ss_r_no, lambda f, c, p=ss_r_co, n=ss_r_no: c.x < -0.05 and any(bm_vert_is_arm(v) for v in f.verts) and abs((c - p).dot(n)) < 0.11)
    cut_band(wr_l_co, wr_l_no, lambda f, c, p=wr_l_co, n=wr_l_no: c.x > 0.10 and any(bm_vert_is_arm(v) for v in f.verts) and abs((c - p).dot(n)) < 0.09)
    cut_band(wr_r_co, wr_r_no, lambda f, c, p=wr_r_co, n=wr_r_no: c.x < -0.10 and any(bm_vert_is_arm(v) for v in f.verts) and abs((c - p).dot(n)) < 0.09)
    cut_band(waist_co, waist_no, lambda f, c: not all(bm_vert_is_arm(v) for v in f.verts) and abs(c.x) < 0.26 and abs((c - waist_co).dot(waist_no)) < 0.12)
    cut_band(knee_co, knee_no, lambda f, c: not any(bm_vert_is_arm(v) for v in f.verts) and abs((c - knee_co).dot(knee_no)) < 0.12)
    cut_band(ankle_co, ankle_no, lambda f, c: not any(bm_vert_is_arm(v) for v in f.verts) and abs((c - ankle_co).dot(ankle_no)) < 0.10)
    cut_band(sole_co, sole_no, lambda f, c: c.z < 0.065)

    bm.to_mesh(me)
    bm.free()

    # 3. 100% 依上述幾道切面指派六個分區材質（不再讓跨界骨骼權重覆蓋切面，男女所有衣緣皆平整無鋸齒）
    def bone_of(v):
        best, bw = '', 0.0
        for gr in v.groups:
            if gr.weight > bw:
                best, bw = groups.get(gr.group, ''), gr.weight
        return best

    vb = [bone_of(v) for v in me.vertices]
    for poly in me.polygons:
        c = mw @ poly.center
        arm_votes = sum(1 for vi in poly.vertices if vb[vi].startswith(ARM_PREFIXES))
        is_arm_poly = arm_votes * 2 > len(poly.vertices)
        if is_arm_poly:
            if c.x >= 0.0:
                slot_name = 'skin' if (c - wr_l_co).dot(wr_l_no) > 0 else ('sleeve' if (c - ss_l_co).dot(ss_l_no) > 0 else 'top')
            else:
                slot_name = 'skin' if (c - wr_r_co).dot(wr_r_no) > 0 else ('sleeve' if (c - ss_r_co).dot(ss_r_no) > 0 else 'top')
        else:
            in_collar = (
                c.z > nk.z + 0.032
                or (
                    c.z > nk.z - 0.055
                    and abs(c.x) < 0.105
                    and all((c - pt).dot(no) > 0 for pt, no in collar_planes)
                )
            )
            if in_collar:
                slot_name = 'skin'
            elif (c - waist_co).dot(waist_no) >= 0:
                slot_name = 'top'
            elif (c - knee_co).dot(knee_no) >= 0:
                slot_name = 'bottom'
            elif (c - ankle_co).dot(ankle_no) >= 0:
                slot_name = 'shin'
            else:
                slot_name = 'shoe'
        poly.material_index = SLOTS.index(slot_name)

    # 4. 雕塑真實鞋楦（消除赤腳五趾凹槽、平底外擴鞋底）＋領口／下擺立體厚度與衣服自然皺褶
    vert_slots = [set() for _ in range(len(me.vertices))]
    for poly in me.polygons:
        sn = SLOTS[poly.material_index]
        for vi in poly.vertices:
            vert_slots[vi].add(sn)

    # 先將鞋部前掌收整成流暢圓頭鞋面，填平赤腳趾縫，並壓平接地鞋底
    foot_x = abs(P['foot_l'].x)
    ball_y = P['ball_l'].y
    foot_y = P['foot_l'].y
    # 建立同位置頂點映射以保持 UV 接縫完全密合
    pre_keys = [(round(v.co.x, 4), round(v.co.y, 4), round(v.co.z, 4)) for v in me.vertices]
    spot_n = {}
    for i, v in enumerate(me.vertices):
        k = pre_keys[i]
        spot_n[k] = spot_n.get(k, Vector((0.0, 0.0, 0.0))) + v.normal

    # 鼓起來之前的平滑法線（同 weld_smooth_normals 的算法）：退回皮膚時法線也要換回來，不然領口那圈的受光還是鋸齒狀
    bm0 = bmesh.new()
    bm0.from_mesh(me)
    bmesh.ops.recalc_face_normals(bm0, faces=bm0.faces)
    bm0.normal_update()
    unorm = {}
    for v in bm0.verts:
        k = (round(v.co.x, 4), round(v.co.y, 4), round(v.co.z, 4))
        unorm[k] = unorm.get(k, Vector((0.0, 0.0, 0.0))) + v.normal
    bm0.free()
    new_co, unpuff = {}, {}
    for i, v in enumerate(me.vertices):
        k = pre_keys[i]
        if k in new_co:
            continue
        wco = mw @ v.co
        wco0 = wco.copy()
        n = spot_n[k].normalized() if spot_n[k].length_squared > 1e-12 else v.normal
        wn = (mw.to_3x3() @ n).normalized()
        ss = vert_slots[i]

        if 'shoe' in ss and 'shin' not in ss:
            side_sgn = 1.0 if wco.x >= 0 else -1.0
            # 前掌已在 1b 投影成平滑圓頭鞋楦，這裡只做後跟包覆厚度與接地底邊微外擴
            heel_t = min(1.0, max(0.0, (wco.y - (foot_y - 0.035)) / 0.065))
            if heel_t > 0.0:
                wco += wn * (PUFF['shoe'] * heel_t)
            if wco.z < 0.008:
                wco.z = 0.002
            if wco.z <= 0.020:
                out_xy = Vector((wco.x - side_sgn * foot_x, wco.y - (foot_y - 0.05), 0.0))
                if out_xy.length > 1e-4:
                    out_xy.normalize()
                    wco.x += out_xy.x * 0.003
                    wco.y += out_xy.y * 0.003
        elif 'shoe' in ss and 'shin' in ss:
            # 鞋口滾邊交界：微收貼合腳踝，讓長褲褲管或腳踝自然銜接
            wco += wn * 0.0115
        else:
            d = max((PUFF.get(s, 0.0) for s in ss), default=0.0)
            # 領口滾邊微凸（距領口圓領錐邊界 1.8 cm 內）
            if 'top' in ss:
                d_neck = abs(min((wco - pt).dot(no) for pt, no in collar_planes))
                if abs(wco.x) < 0.105 and wco.z > nk.z - 0.06 and d_neck < 0.018:
                    d += 0.0032 * (1.0 - d_neck / 0.018)
                # 上衣下擺微外翻覆蓋腰頭，加立體橫向垂墜皺褶
                d_waist = (wco - waist_co).dot(waist_no)
                if 0.0 <= d_waist < 0.045 and abs(wco.x) < 0.25:
                    hem_k = 1.0 - d_waist / 0.045
                    d += 0.0045 * (hem_k ** 1.3)
                    wco.z -= 0.0055 * (hem_k ** 2)
                # 軀幹布料自然皺褶（腰側、腋下與後背微幅折紋，讓法線受光有真實布感）
                if d_waist > 0.015 and abs(wco.x) < 0.25:
                    ang = math.atan2(wco.y, wco.x)
                    fold = (
                        math.sin(wco.z * 52.0 + math.sin(ang * 3.0) * 1.6) * 0.0022
                        + math.cos(wco.z * 85.0 - ang * 2.0) * 0.0012 * max(0.0, 1.0 - d_waist / 0.18)
                    )
                    d += fold
            if 'bottom' in ss and 'top' not in ss:
                # 褲頭收在上衣下擺內側，胯部與大腿根部加入自然貓鬚橫紋
                d_waist = -(wco - waist_co).dot(waist_no)
                if 0.0 <= d_waist < 0.022:
                    d *= (0.78 + 0.22 * (d_waist / 0.022))
                lap = math.exp(-((wco.z - (P['pelvis'].z - 0.045)) / 0.065) ** 2)
                ang = math.atan2(wco.y, abs(wco.x) - 0.09)
                d += math.sin(wco.z * 68.0 + ang * 2.0) * 0.0018 * lap
            if d:
                wco += wn * d

        new_co[k] = mw_inv @ wco
        unpuff[k] = mw_inv.to_3x3() @ (wco - wco0)

    for i, v in enumerate(me.vertices):
        v.co = new_co[pre_keys[i]]
    me.update()
    weld_smooth_normals(me)
    # 換裝用：上衣／袖子、褲子／小腿分區鼓起來的位移與它屬於哪一組（1 上衣、2 褲裙；鞋子那圈不算）。
    # 穿上衣服時 CHAR_VS 把這組退回皮膚（領口、袖口開得比原本低時，看到的是皮膚而不是鼓起來的衣緣），wear.py 也照這個貼身做殼
    grp = {}
    for i, v in enumerate(me.vertices):
        ss = vert_slots[i]
        m = 0 if 'shoe' in ss else (1 if ss & {'top', 'sleeve'} else 0) | (2 if ss & {'bottom', 'shin'} else 0)
        grp[pre_keys[i]] = grp.get(pre_keys[i], 0) | m
    au = me.attributes.new('_UNPUFF', 'FLOAT_VECTOR', 'POINT')
    an = me.attributes.new('_UNORM', 'FLOAT_VECTOR', 'POINT')
    am = me.attributes.new('_PMASK', 'FLOAT', 'POINT')
    for i in range(len(me.vertices)):
        m = grp[pre_keys[i]]
        au.data[i].vector = unpuff[pre_keys[i]] if m else Vector((0.0, 0.0, 0.0))
        an.data[i].vector = unorm[pre_keys[i]].normalized() if m else Vector((0.0, 0.0, 0.0))
        am.data[i].value = float(m)

    # 5. 髮型與帽款：逐一建立並綁到同性別骨架
    for h_idx, (var_name, src_names, sculpt_mode) in enumerate(HAIR_SPECS[g]):
        parts_objs = []
        for sn in src_names:
            hobjs = import_gltf(HAIR.format(sn))
            harm = next(o for o in hobjs if o.type == 'ARMATURE')
            hmesh = next(o for o in hobjs if o.type == 'MESH' and o.parent is harm)
            hmesh.parent = arm
            hmesh.matrix_parent_inverse.identity()
            for mod in hmesh.modifiers:
                if mod.type == 'ARMATURE':
                    mod.object = arm
            mat0 = hmesh.data.materials[0].name if hmesh.data.materials and hmesh.data.materials[0] else 'MI_Hair_1'
            remap_mesh_uvs(hmesh.data, 'Hair_2' if 'Hair_2' in mat0 else 'Hair_1', wrap_uv=False)
            if sculpt_mode:
                sculpt_hair_variant(hmesh, arm, me, sculpt_mode)
            parts_objs.append(hmesh)
            for o in hobjs:
                if o is not hmesh:
                    bpy.data.objects.remove(o, do_unlink=True)

        # 若是複合髮型（例如寸頭＋鬍子、旁分＋鬍子），保留各自獨立物件但掛上同一個髮型變體名稱讓前端一起收入該變體
        for pi, pobj in enumerate(parts_objs):
            pobj.name = f'{g}_{var_name}' if pi == 0 else f'{g}_{var_name}_sub{pi}'

        if sculpt_mode == 'cap':
            cap_obj = build_cap_mesh(f'{g}_{var_name}_CapMesh', arm, me, mw)
            remap_mesh_uvs(cap_obj.data, 'Fabric', wrap_uv=True)
            cap_obj.data.materials.append(cap_mat_shared[g])

    arm.location.x = gi * 1.2  # 兩副骨架並排（前端各自複製，位置無關）

# 將所有頭髮、眉毛、眼睛材質統一指向單張 T_CharAtlas，並移除多餘貼圖
for m in list(bpy.data.materials):
    if not m.use_nodes or not m.node_tree:
        continue
    nt = m.node_tree
    b = next((n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED'), None)
    if not b:
        continue
    for sock, v in (('Roughness', 0.7), ('Metallic', 0.0), ('Normal', None)):
        s = b.inputs[sock]
        for l in list(s.links):
            nt.links.remove(l)
        if v is not None:
            s.default_value = v
    tex_nodes = [n for n in nt.nodes if n.type == 'TEX_IMAGE']
    if tex_nodes:
        tex_nodes[0].image = atlas_img
        for extra in tex_nodes[1:]:
            nt.nodes.remove(extra)

for o in bpy.data.objects:
    if o.type == 'MESH':
        for i, m in enumerate(o.data.materials):
            if m and '.' in m.name and m.name.split('.')[0] in bpy.data.materials:
                o.data.materials[i] = bpy.data.materials[m.name.split('.')[0]]

for img in list(bpy.data.images):
    if img is not atlas_img:
        bpy.data.images.remove(img)
print('atlas image:', atlas_img.name, atlas_img.size[:], 'channels', atlas_img.channels)

# ---- 動畫 ----
anim_objs = import_gltf(ANIMS)
for a in list(bpy.data.actions):
    if any(a.name.startswith(k) for k in KEEP):
        a.use_fake_user = True
    else:
        bpy.data.actions.remove(a)
for o in anim_objs:
    bpy.data.objects.remove(o, do_unlink=True)
for a in bpy.data.actions:
    for k in KEEP:
        if a.name.startswith(k):
            a.name = k

arm = bpy.data.objects['Male']
arm.animation_data_create()
scene = bpy.context.scene
bpy.ops.object.select_all(action='DESELECT')
arm.select_set(True)
bpy.context.view_layer.objects.active = arm

# 每個動作一條 NLA 軌（glTF 匯出器依軌道輸出動畫）
arm.animation_data.action = None
for a in bpy.data.actions:
    if a.name not in KEEP and not a.name.startswith(('Board_', 'Bike_')):
        continue
    t = arm.animation_data.nla_tracks.new()
    t.name = a.name
    s = t.strips.new(a.name, int(a.frame_range[0]), a)
    if getattr(a, 'slots', None) and len(a.slots):
        try:
            s.action_slot = a.slots[0]
        except Exception:
            pass
print('actions', len(bpy.data.actions), sorted(a.name for a in bpy.data.actions))

os.makedirs(os.path.dirname(OUT), exist_ok=True)
bpy.ops.export_scene.gltf(
    filepath=OUT, export_format='GLB', export_animation_mode='NLA_TRACKS', export_image_format='WEBP',
    export_image_quality=92, export_texcoords=True, export_normals=True, export_skins=True, export_morph=False,
    export_force_sampling=True, export_optimize_animation_size=True, export_def_bones=False, export_frame_step=2, export_attributes=True,
)
print('wrote', OUT, os.path.getsize(OUT))
