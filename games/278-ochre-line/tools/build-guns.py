#!/usr/bin/env python3
"""赭線 OCHRE LINE（作品 278）武器模型管線：輸出 assets/278/models/guns.glb 與 dist/guns-meta.json。

用法（repo 內任何目錄皆可，路徑由本檔位置推得）：
  blender --background --factory-startup --python tools/build-guns.py -- [--only p9,ks] [--pack] [--sheet] [--no-sheet]

  無參數       全部武器 → 打包 → dist/guns-sheet.png、dist/guns-markers.png
  --only a,b   只重建這幾把（其餘沿用 dist/guns-cache/）並打包，sheet 只畫這幾把到 dist/guns-sheet-partial.png
               r50 跟著 p9、flash 跟著 smoke 重建，不能單獨指定
  --pack       不重建，只重新打包 dist/guns-cache/ 成 guns.glb
  --sheet      只重畫 sheet（讀最後的 guns.glb）
  --no-sheet   不畫 sheet

座標：Blender 內的標準姿態是「槍口 -Y、上 +Z、槍的右側 -X」，輸出時 (x,y,z)→(x,z,-y)，
也就是 glTF 的槍口 +Z、上 +Y、右側 -X。Babylon（左手系）載入時 __root__ 會把 x 翻號，
所以遊戲裡仍是槍口 +Z、右側 +X，拋殼口不會左右顛倒。
本檔不用 glTF exporter：自己寫 GLB 才能讓 r50／flash 共用頂點 accessor 與貼圖。
"""
import bpy, bmesh, sys, os, json, struct, subprocess, math, shutil
import numpy as np
from mathutils import Matrix, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
PROJ = os.path.dirname(HERE)
REPO = os.path.dirname(os.path.dirname(PROJ))
ARMS = os.path.join(REPO, 'games/260-neon-nightcity/.cache/arms/')
AKSU = os.path.join(REPO, 'games/266-eternauta-plaza/.cache/sketchfab/aksu-74_game_ready.glb')
OUT_GLB = os.path.join(REPO, 'assets/278/models/guns.glb')
DIST = os.path.join(PROJ, 'dist')
CACHE = os.path.join(DIST, 'guns-cache')
META = os.path.join(DIST, 'guns-meta.json')
SHEET = os.path.join(DIST, 'guns-sheet.png')

TEX = 1024              # 貼圖邊長
WEBP_ALBEDO = 92
WEBP_ORM = 82
WEBP_NORMAL = 90

# ---------------------------------------------------------------------------
# 武器設定
#   axes     新 (X,Y,Z) 由舊軸組成（必為旋轉，不可鏡射）
#   length   真實總長（公尺），以標準姿態的 Y 範圍量
#   origin   握把（公尺，標準姿態，縮放後、平移前）
#   atlas    輸出材質：每組是來源材質名列表；兩個來源以上就走 UV 島打包
#   scrub    來源貼圖的字樣修補：{來源材質: [(x0,y0,x1,y1) 影像比例，左上原點]}
# ---------------------------------------------------------------------------
def V(x0, y0, x1, y1):
    """矩形：座標是 1500×1500 縮圖上量的（左上原點）。"""
    return (x0 / 1500, y0 / 1500, x1 / 1500, y1 / 1500)


def Q(*pts):
    """凸多邊形（斜向的字用）：同樣是 1500 縮圖座標。"""
    return [(x / 1500, y / 1500) for x, y in pts]


GUNS = {
    'p9': dict(
        src=ARMS + 'heckler__koch_usp_pistol.glb', axes=('x', 'z', '-y'), length=0.194,
        origin=(0, .056, -.0215), muzzle=(0, -.097, .0545), mag=(0, .062, -.060),
        atlas=[['Slide_Magazine'], ['Barrel_Body', 'Small_Parts']],
        scrub={
            'Slide_Magazine': [V(62, 790, 110, 850), V(62, 714, 104, 776), V(64, 500, 102, 580)],
            'Barrel_Body': [V(100, 342, 132, 386), V(100, 400, 132, 446), V(840, 342, 870, 384), V(840, 400, 870, 446)],
        },
    ),
    'v11': dict(
        # 檔案裡有兩把擺拍的槍：後 23 個物件那把彈匣有裝好、槍托收合。物件 0/11/20 是懸垂的背帶與扣環，拿掉
        src=ARMS + 'mac-11.glb', keep=(23, 46), drop=(0, 11, 20), axes=None, pca_obj=16, pca_flip=(-1, 1), length=0.32,
        origin=(0, .017, .012), muzzle=(0, -.16, .106), mag=(0, .005, -.06),
        atlas=[['Material__0']],
        scrub={'Material__0': [V(342, 1380, 532, 1432)]},
    ),
    's8': dict(
        src=ARMS + 'remington_870_shotgun.glb', axes=('x', 'z', '-y'), length=0.98,
        origin=(0, .22, .048), muzzle=(0, -.49, .0836), mag=(0, .044, .033),
        atlas=[['01___Default'], ['02___Default']],
        scrub={
            '01___Default': [Q((827, 1035), (821, 1046), (882, 1095), (890, 1083)), V(1412, 932, 1448, 1012)],
            '02___Default': [Q((108, 1289), (119, 1301), (73, 1338), (62, 1325)),
                             Q((178, 1362), (189, 1373), (145, 1417), (134, 1406))],
        },
    ),
    'ks': dict(
        src=AKSU, axes=('x', 'z', '-y'), length=0.735, tri_target=24000,
        origin=(-.008, .179, -.005), mag=(-.008, .025, -.033),
        atlas=[['Material.001']],
        scrub={'Material.001': [V(298, 749, 346, 765), V(347, 730, 388, 786), V(436, 818, 482, 838),
                                V(274, 840, 366, 858), V(1272, 908, 1290, 962), V(1147, 1164, 1159, 1205)]},
    ),
    'ar5': dict(
        src=ARMS + 'm4a1_sopmod_remaster.glb', axes=('-z', '-x', 'y'), length=0.84,
        origin=(0, .189, -.0567), mag=(0, .0567, -.066),
        atlas=[['M4A1_Gun'], ['M4_Mag']],
        # 第一個矩形的字只在法線與 ORM 上，albedo 那塊跨過 UV 島，不能動
        scrub={'M4A1_Gun': [dict(r=V(708, 146, 778, 244), keys=('n', 'orm')), V(860, 156, 950, 196), V(1008, 462, 1068, 480)]},
    ),
    'l40': dict(
        src=ARMS + 'usmc_m40a5_sniper.glb', axes=('x', 'z', '-y'), length=1.124,
        origin=(.008, .30, -.038), mag=(.008, .134, -.05),
        atlas=[['03___Default'], ['02___Default', '07___Default']],
    ),
    'frag': dict(
        # 投擲物：origin=彈體中心，muzzle=引信頂，mag=拉環
        src=ARMS + 'm67_fragmentation_grenade.glb', axes=('x', 'z', '-y'), length=0.066,
        origin=(0, 0, -.0154), muzzle=(0, 0, .04), mag=(0, .0246, .0338),
        atlas=[['Scene_-_Root']], scrub_fn='m67',
    ),
    'smoke': dict(
        src=ARMS + 'smoke_grenade.glb', axes=('x', 'z', '-y'), length=0.0635, tri_target=9000,
        origin=(0, 0, -.0216), muzzle=(0, 0, .0744), mag=(0, -.0135, .059),
        atlas=[['Material.001']], flat_normal=True, scrub_grain=False,
        scrub={'Material.001': [V(420, 22, 815, 74), V(525, 90, 695, 170), V(485, 540, 715, 655)]},
    ),
}

# 自建：knife、charge（來源 c4_explosive.glb 是 Source 引擎模型，不用，見 credits/guns.md）
# 共用幾何：r50（p9）、flash（smoke），在來源武器建置時一起產出
ALL_IDS = ['knife', 'p9', 'r50', 'v11', 's8', 'ks', 'ar5', 'l40', 'frag', 'smoke', 'flash', 'charge']


# ---------------------------------------------------------------------------
# 通用工具
# ---------------------------------------------------------------------------
def log(*a):
    print('[guns]', *a, flush=True)


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def axes_matrix(axes):
    """('x','z','-y') → 新 X=舊 x、新 Y=舊 z、新 Z=-舊 y 的 3×3 矩陣。"""
    m = Matrix(((0, 0, 0), (0, 0, 0), (0, 0, 0)))
    for row, a in enumerate(axes):
        s = -1 if a[0] == '-' else 1
        m[row]['xyz'.index(a[-1])] = s
    assert abs(m.determinant() - 1) < 1e-6, f'axes {axes} 不是旋轉'
    return m.to_4x4()


def import_model(cfg):
    reset()
    bpy.ops.import_scene.gltf(filepath=cfg['src'])
    # Sketchfab 根節點常帶展示用的任意旋轉，先清掉才有乾淨的建模軸
    root = bpy.data.objects.get('Sketchfab_model')
    if root:
        root.matrix_world = Matrix.Identity(4)
    bpy.context.view_layer.update()
    obs = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    keep = cfg.get('keep')
    if keep:
        keep_set = set(range(*keep))
        obs = [o for i, o in enumerate(obs) if i in keep_set]
    if cfg.get('pca_obj') is not None:
        cfg['_pca'] = pca_rotation(obs[cfg['pca_obj']], cfg['pca_flip'])
    drop = cfg.get('drop', ())
    obs = [o for i, o in enumerate(obs) if i not in drop]
    return obs


def join(obs, xf):
    """把物件烘成世界座標再乘 xf，合併成一個 mesh。"""
    keep = set(obs)
    for o in list(bpy.context.scene.objects):
        if o not in keep:
            bpy.data.objects.remove(o, do_unlink=True)
    for o in obs:
        o.data = o.data.copy()
        mw = o.matrix_world.copy()
        o.parent = None
        m = xf @ mw
        o.data.transform(m)
        if m.to_3x3().determinant() < 0:
            o.data.flip_normals()
        o.matrix_world = Matrix.Identity(4)
        while len(o.data.uv_layers) > 1:
            o.data.uv_layers.remove(o.data.uv_layers[-1])
        o.data.uv_layers[0].name = 'UVMap'
    bpy.context.view_layer.update()
    for o in bpy.context.selected_objects:
        o.select_set(False)
    for o in obs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = obs[0]
    if len(obs) > 1:
        bpy.ops.object.join()
    return bpy.context.view_layer.objects.active


def mesh_arrays(me):
    """回傳 {material_index: (pos, nor, uv, idx)}，位置/法線已是 glTF 軸，v 已翻。"""
    me.calc_loop_triangles()
    n = len(me.loop_triangles)
    tl = np.empty(n * 3, np.int32)
    me.loop_triangles.foreach_get('loops', tl)
    mi = np.empty(n, np.int32)
    me.loop_triangles.foreach_get('material_index', mi)
    lv = np.empty(len(me.loops), np.int32)
    me.loops.foreach_get('vertex_index', lv)
    co = np.empty(len(me.vertices) * 3, np.float32)
    me.vertices.foreach_get('co', co)
    co = co.reshape(-1, 3)
    uv = np.empty(len(me.loops) * 2, np.float32)
    me.uv_layers[0].uv.foreach_get('vector', uv)
    uv = uv.reshape(-1, 2)
    nor = np.empty(len(me.loops) * 3, np.float32)
    me.corner_normals.foreach_get('vector', nor)
    nor = nor.reshape(-1, 3)
    pos_l = co[lv]
    out = {}
    for m in np.unique(mi):
        sel = np.repeat(mi == m, 3)
        loops = tl[sel]
        key = np.concatenate([
            np.round(pos_l[loops] * 1e5), np.round(nor[loops] * 1e4), np.round(uv[loops] * 1e5)
        ], axis=1).astype(np.int64)
        _, first, inv = np.unique(key, axis=0, return_index=True, return_inverse=True)
        lp = loops[first]
        p = pos_l[lp]
        q = nor[lp]
        q = q / np.maximum(np.linalg.norm(q, axis=1, keepdims=True), 1e-8)
        pos = np.stack([p[:, 0], p[:, 2], -p[:, 1]], 1).astype(np.float32)
        nrm = np.stack([q[:, 0], q[:, 2], -q[:, 1]], 1).astype(np.float32)
        t = uv[lp].copy()
        t[:, 1] = 1 - t[:, 1]
        out[int(m)] = (pos, nrm, t.astype(np.float32), inv.reshape(-1).astype(np.uint32))
    return out


# ---------------------------------------------------------------------------
# 貼圖（numpy + ffmpeg + cwebp，不經過 Blender 影像）
# ---------------------------------------------------------------------------
def glb_json(path):
    with open(path, 'rb') as f:
        head = f.read(20)
        jl = struct.unpack('<I', head[12:16])[0]
        return json.loads(f.read(jl)), 20 + jl + 8


def glb_image(path, j, base, idx, into):
    """把 GLB 裡第 idx 張圖解成 h×w×4 uint8。"""
    bv = j['bufferViews'][j['images'][idx]['bufferView']]
    tmp = os.path.join(into, f'_src{idx}.bin')
    with open(path, 'rb') as f:
        f.seek(base + bv.get('byteOffset', 0))
        data = f.read(bv['byteLength'])
    with open(tmp, 'wb') as f:
        f.write(data)
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', tmp, '-f', 'rawvideo', '-pix_fmt', 'rgba', '-'],
                         capture_output=True, check=True).stdout
    os.remove(tmp)
    s = int(round(math.sqrt(len(raw) / 4)))
    assert s * s * 4 == len(raw), 'non-square texture'
    return np.frombuffer(raw, np.uint8).reshape(s, s, 4).copy()


def source_materials(cfg, into):
    """回傳 {材質名: {'base','orm','n'}}，orm 已合併成 R=AO G=rough B=metal。"""
    j, base = glb_json(cfg['src'])
    cache = {}

    def img(tex):
        if tex is None:
            return None
        src = j['textures'][tex['index']]['source']
        if src not in cache:
            cache[src] = glb_image(cfg['src'], j, base, src, into)
        return cache[src]

    out = {}
    for m in j['materials']:
        pbr = m['pbrMetallicRoughness']
        b = img(pbr.get('baseColorTexture'))
        mr = img(pbr.get('metallicRoughnessTexture'))
        n = img(m.get('normalTexture'))
        ao = img(m.get('occlusionTexture'))
        orm = mr.copy()
        orm[..., 0] = 255 if ao is None else ao[..., 0]
        out[m['name']] = dict(base=b, orm=orm, n=n)
    return out


def box_blur(a, r):
    """分離式方框模糊（邊界夾住）。a: h×w×c float32。"""
    pad = np.pad(a, ((r + 1, r), (0, 0), (0, 0)), mode='edge')
    c = np.cumsum(pad, 0)
    a = (c[2 * r + 1:] - c[:-2 * r - 1]) / (2 * r + 1)
    pad = np.pad(a, ((0, 0), (r + 1, r), (0, 0)), mode='edge')
    c = np.cumsum(pad, 1)
    return (c[:, 2 * r + 1:] - c[:, :-2 * r - 1]) / (2 * r + 1)


def heal_rect(img, rect, grain=True):
    """把矩形內的刻字換成由四邊內插的平滑面（Coons patch），再疊回鄰近區域的細紋。
    對法線、albedo、ORM 同一組矩形各做一次，三張圖才不會留下字的殘影。"""
    h, w = img.shape[:2]
    x0, y0, x1, y1 = rect
    x0 = int(x0 * w); x1 = int(x1 * w); y0 = int(y0 * h); y1 = int(y1 * h)
    rw, rh = x1 - x0, y1 - y0
    a = img[y0:y1, x0:x1, :3].astype(np.float32)
    # 邊界線先沿線方向平滑，避免把雜點拉成條紋
    def line(v):
        k = max(3, min(len(v) // 8, 31)) | 1
        p = np.pad(v, ((k // 2, k // 2), (0, 0)), mode='edge')
        return np.stack([np.convolve(p[:, c], np.ones(k) / k, 'valid') for c in range(3)], 1)
    top, bot = line(a[0]), line(a[-1])
    lef, rig = line(a[:, 0]), line(a[:, -1])
    u = np.linspace(0, 1, rw, dtype=np.float32)[None, :, None]
    v = np.linspace(0, 1, rh, dtype=np.float32)[:, None, None]
    c00, c10, c01, c11 = top[0], top[-1], bot[0], bot[-1]
    fill = ((1 - v) * top[None] + v * bot[None]
            + (1 - u) * lef[:, None] + u * rig[:, None]
            - ((1 - u) * (1 - v) * c00 + u * (1 - v) * c10 + (1 - u) * v * c01 + u * v * c11))
    if grain:
        # 細紋取自矩形上下較乾淨的一側，幅度夾住，免得把鄰近的凹槽或字一起搬過來
        best = None
        for sy in (y0 - rh, y1):
            if sy < 0 or sy + rh > h:
                continue
            src = img[sy:sy + rh, x0:x1, :3].astype(np.float32)
            hp = src - box_blur(src, max(2, min(rw, rh) // 8))
            e = float(np.abs(hp).mean())
            if best is None or e < best[0]:
                best = (e, hp)
        if best:
            fill = fill + np.clip(best[1], -7, 7)
    # 邊緣 6% 羽化
    fx = np.clip(np.minimum(u, 1 - u) / 0.06, 0, 1)
    fy = np.clip(np.minimum(v, 1 - v) / 0.06, 0, 1)
    mask = fx * fy
    img[y0:y1, x0:x1, :3] = np.clip(a * (1 - mask) + fill * mask, 0, 255).astype(np.uint8)


def poly_mask(h, w, pts):
    """凸多邊形遮罩（比例座標）。"""
    yy, xx = np.mgrid[0:h, 0:w]
    xx = (xx + .5) / w
    yy = (yy + .5) / h
    p = np.array(pts)
    c = p.mean(0)
    m = np.ones((h, w), bool)
    for i in range(len(p)):
        a, b = p[i], p[(i + 1) % len(p)]
        e = b - a
        sign = np.sign(e[0] * (c[1] - a[1]) - e[1] * (c[0] - a[0]))
        m &= (e[0] * (yy - a[1]) - e[1] * (xx - a[0])) * sign >= 0
    return m


def heal_mask(img, mask, r=None, grain=True):
    """任意遮罩的修補：外圍像素做正規化卷積往內填，再疊回鄰近細紋。"""
    ys, xs = np.nonzero(mask)
    if len(ys) == 0:
        return
    span = max(ys.max() - ys.min(), xs.max() - xs.min())
    r = r or max(8, int(min(span, 160) * .35))
    h, w = img.shape[:2]
    y0, y1 = max(0, ys.min() - 3 * r), min(h, ys.max() + 3 * r)
    x0, x1 = max(0, xs.min() - 3 * r), min(w, xs.max() + 3 * r)
    a = img[y0:y1, x0:x1, :3].astype(np.float32)
    m = mask[y0:y1, x0:x1, None].astype(np.float32)
    keep = 1 - m
    w0 = box_blur(box_blur(keep, r), r)
    fill = box_blur(box_blur(a * keep, r), r) / np.maximum(w0, 1e-3)
    if w0.min() < .02:
        r2 = r * 3
        w1 = box_blur(box_blur(keep, r2), r2)
        wide = box_blur(box_blur(a * keep, r2), r2) / np.maximum(w1, 1e-3)
        fill = np.where(w0 < .02, wide, fill)
    if grain:
        hp = a - box_blur(a, 4)
        sh = int(r * 1.3)
        fill = fill + np.roll(hp * keep, (sh, sh // 2), (0, 1))
    soft = np.clip(box_blur(m, 2), 0, 1)
    img[y0:y1, x0:x1, :3] = np.clip(a * (1 - soft) + fill * soft, 0, 255).astype(np.uint8)


def heal(img, item, grain=True):
    if isinstance(item, list):
        heal_mask(img, poly_mask(img.shape[0], img.shape[1], item), grain=grain)
    else:
        heal_rect(img, item, grain=grain)


def scrub_m67(S):
    """M67 的環形字：從 albedo 取字色遮罩（字偏黃、底偏綠），三張圖用同一個遮罩。"""
    b = S['base'].astype(np.float32)
    text = (b[..., 0] > b[..., 1] * .93) & (b[..., 2] < b[..., 0] * .72) & (b[..., 0] > 70)
    text[:, int(text.shape[1] * .47):] = False   # 右半是引信的金屬件
    k = 9
    grow = box_blur(text[..., None].astype(np.float32), k)[..., 0] > 0.01
    for key in ('base', 'orm', 'n'):
        s = S[key].shape[0]
        m = grow if s == grow.shape[0] else resample(grow[..., None].astype(np.float32) * 255, 0, 0, grow.shape[1], grow.shape[0], s, s)[..., 0] > 8
        heal_mask(S[key], m, r=24, grain=key != 'n')


def fbm(size, seed, beta=1.6):
    """可無縫的 1/f^beta 雜訊，回傳 0..1。"""
    rng = np.random.default_rng(seed)
    f = np.fft.fftfreq(size)
    fx, fy = np.meshgrid(f, f)
    amp = 1 / np.maximum(np.hypot(fx, fy), 1 / size) ** beta
    z = np.fft.ifft2(amp * np.exp(2j * np.pi * rng.random((size, size)))).real
    return (z - z.min()) / (z.max() - z.min())


def height_normal(h, k):
    """高度圖 → OpenGL Y+ 法線圖（0-255）。"""
    dx = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) * k
    dy = (np.roll(h, -1, 0) - np.roll(h, 1, 0)) * k
    v = np.stack([-dx, dy, np.ones_like(h)], 2)
    v /= np.linalg.norm(v, axis=2, keepdims=True)
    return (v + 1) * 127.5


def wear(b, o, n, amount, seed):
    """沿法線圖的稜線磨出底金屬，並加低頻髒污。來源貼圖整片純色時才看得出金屬感。"""
    e = np.hypot(n[..., 0] / 127.5 - 1, n[..., 1] / 127.5 - 1)
    e = box_blur(e[..., None].astype(np.float32), 1)[..., 0]
    e = np.clip((e - .14) / .4, 0, 1)
    g = fbm(b.shape[0], seed, 1.5)
    w = np.clip(e * (.35 + g * 1.5), 0, 1) * amount
    b = b * (.88 + .24 * g[..., None])
    b = b + w[..., None] * (np.array([148, 146, 140], np.float32) - b)
    o = o.copy()
    o[..., 1] = o[..., 1] * (1 - .45 * w)
    o[..., 2] = o[..., 2] + (255 - o[..., 2]) * w
    return b, o


def retint_red(b, color):
    """把紅色標示帶換色（保留明暗）。"""
    red = np.clip((b[..., 0] - np.maximum(b[..., 1], b[..., 2]) * 1.35) / 60, 0, 1)[..., None]
    lum = (b.mean(2, keepdims=True) / 95).clip(.55, 1.5)
    return b * (1 - red) + np.array(color, np.float32) * lum * red


def resample(img, x0, y0, x1, y1, dw, dh):
    """面積平均縮圖：把 img 的 [x0,x1)×[y0,y1) 縮成 dh×dw。"""
    crop = img[y0:y1, x0:x1].astype(np.float64)
    sh, sw = crop.shape[:2]
    if (sw, sh) == (dw, dh):
        return crop.astype(np.float32)
    # 雙向累積和，可在小數座標取樣
    c = np.zeros((sh + 1, sw + 1, crop.shape[2]))
    c[1:, 1:] = np.cumsum(np.cumsum(crop, 0), 1)
    xs = np.linspace(0, sw, dw + 1)
    ys = np.linspace(0, sh, dh + 1)
    xi = np.minimum(xs.astype(int), sw - 1)
    xf = (xs - xi)[None, :, None]
    yi = np.minimum(ys.astype(int), sh - 1)
    yf = (ys - yi)[:, None, None]
    I = (c[yi][:, xi] * (1 - xf) + c[yi][:, xi + 1] * xf) * (1 - yf) \
        + (c[yi + 1][:, xi] * (1 - xf) + c[yi + 1][:, xi + 1] * xf) * yf
    box = I[1:, 1:] - I[:-1, 1:] - I[1:, :-1] + I[:-1, :-1]
    return (box * (dw * dh) / (sw * sh)).astype(np.float32)


def fix_normal(a):
    """縮圖後重新正規化法線圖。a: h×w×3，0-255。"""
    v = a / 127.5 - 1
    v /= np.maximum(np.linalg.norm(v, axis=2, keepdims=True), 1e-6)
    return (v + 1) * 127.5


def write_webp(arr, path, q):
    """arr: h×w×3，0-255。"""
    h, w = arr.shape[:2]
    png = path + '.png'
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{w}x{h}', '-i', '-',
                    '-frames:v', '1', png], input=np.clip(arr + .5, 0, 255).astype(np.uint8).tobytes(), check=True)
    if q == WEBP_NORMAL:
        # 有損 WebP 固定 4:2:0，法線的 R/G 全在色度裡：q100 也只有 28 dB。near-lossless 40 約 46 dB
        mode = ['-near_lossless', '40']
    else:
        mode = ['-q', str(q), '-sharp_yuv']
    subprocess.run(['cwebp', '-quiet'] + mode + ['-m', '6', '-metadata', 'none', png, '-o', path], check=True)
    os.remove(png)


# --- UV 島打包：把 2 個以上的來源材質併進一張 1024 --------------------------------
def uv_island_rects(uv):
    """uv: (三角形數,3,2)，回傳每個 UV 島的外框 [(u0,v0,u1,v1)]（已合併重疊的外框）。"""
    n = len(uv)
    key = np.round(uv.reshape(-1, 2) * 4096).astype(np.int64)
    key = key[:, 0] * 100003 + key[:, 1]
    _, inv = np.unique(key, return_inverse=True)
    inv = inv.reshape(n, 3)
    parent = list(range(inv.max() + 1))

    def find(a):
        while parent[a] != a:
            parent[a] = parent[parent[a]]
            a = parent[a]
        return a

    for a, b, c in inv.tolist():
        ra, rb, rc = find(a), find(b), find(c)
        parent[rb] = ra
        parent[rc] = ra
    roots = np.array([find(i) for i in inv[:, 0].tolist()])
    rects = []
    for r in np.unique(roots):
        p = uv[roots == r].reshape(-1, 2)
        rects.append([p[:, 0].min(), p[:, 1].min(), p[:, 0].max(), p[:, 1].max()])
    # 鏡射共用同一塊貼圖的島會重疊，合併到穩定為止
    merged = True
    while merged:
        merged = False
        out = []
        for r in rects:
            for o in out:
                if r[0] < o[2] and r[2] > o[0] and r[1] < o[3] and r[3] > o[1]:
                    o[0] = min(o[0], r[0]); o[1] = min(o[1], r[1])
                    o[2] = max(o[2], r[2]); o[3] = max(o[3], r[3])
                    merged = True
                    break
            else:
                out.append(list(r))
        rects = out
    return rects


def shelf_pack(boxes, scale, side, pad):
    """boxes: [(w,h,...)] 以來源像素計。回傳 [(x,y)] 或 None（放不下）。"""
    order = sorted(range(len(boxes)), key=lambda i: -boxes[i][1])
    x = y = shelf = 0
    pos = [None] * len(boxes)
    for i in order:
        w = int(math.ceil(boxes[i][0] * scale)) + pad * 2
        h = int(math.ceil(boxes[i][1] * scale)) + pad * 2
        if w > side:
            return None
        if x + w > side:
            x = 0
            y += shelf
            shelf = 0
        if y + h > side:
            return None
        pos[i] = (x, y)
        x += w
        shelf = max(shelf, h)
    return pos


def uv_coverage(tri, s=256, grow=3):
    """把 UV 三角形畫成 s×s 布林遮罩（可環繞），外擴 grow 像素。"""
    m = np.zeros((s, s), bool)
    p = tri * s
    for a, b, c in p:
        x0 = int(math.floor(min(a[0], b[0], c[0]))); x1 = int(math.ceil(max(a[0], b[0], c[0]))) + 1
        y0 = int(math.floor(min(a[1], b[1], c[1]))); y1 = int(math.ceil(max(a[1], b[1], c[1]))) + 1
        yy, xx = np.mgrid[y0:y1, x0:x1]
        d = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1])
        if abs(d) < 1e-9:
            continue
        l0 = ((b[1] - c[1]) * (xx + .5 - c[0]) + (c[0] - b[0]) * (yy + .5 - c[1])) / d
        l1 = ((c[1] - a[1]) * (xx + .5 - c[0]) + (a[0] - c[0]) * (yy + .5 - c[1])) / d
        e = 1.2 / max(abs(d), 1) ** .5
        hit = (l0 >= -e) & (l1 >= -e) & (l0 + l1 <= 1 + e)
        m[yy[hit] % s, xx[hit] % s] = True
    if grow:
        m = box_blur(m[..., None].astype(np.float32), grow)[..., 0] > 0.001
    return m


def interlock(sources, uv_by_src, side=TEX):
    """兩張稀疏的貼圖只平移就能互相咬合時（UV 島是斜的，外框打包很浪費），
    直接疊成一張，兩邊都保有完整密度。找不到零重疊的位移就回傳 None。"""
    names = list(uv_by_src)
    if len(names) != 2:
        return None
    a, b = names
    s = 256
    ma = uv_coverage(np.clip(uv_by_src[a], 0, 1), s)
    mb = uv_coverage(np.clip(uv_by_src[b], 0, 1), s)
    # 環狀相關：overlap[dy,dx] = a 與「b 平移 (dx,dy)」的重疊量
    ov = np.fft.ifft2(np.fft.fft2(ma.astype(np.float64)) * np.conj(np.fft.fft2(mb.astype(np.float64)))).real
    ov = np.round(ov).astype(np.int64)
    dy, dx = np.unravel_index(np.argmin(ov), ov.shape)
    if ov[dy, dx] > 0:
        log(f'  咬合失敗：最小重疊 {ov[dy, dx]}（覆蓋 {ma.mean():.2f}+{mb.mean():.2f}）')
        return None
    if ov[0, 0] == 0:
        dy = dx = 0
    log(f'  咬合成功：{b} 位移 ({dx},{dy})/256，覆蓋 {ma.mean():.2f}+{mb.mean():.2f}')
    maskb = np.kron(mb, np.ones((side // s, side // s), bool))
    maskb = np.roll(maskb, (dy * (side // s), dx * (side // s)), (0, 1))
    out = []
    for key in ('base', 'orm', 'n'):
        A = sources[a][key]
        B = sources[b][key]
        ia = resample(A[..., :3], 0, 0, A.shape[1], A.shape[0], side, side)
        ib = resample(B[..., :3], 0, 0, B.shape[1], B.shape[0], side, side)
        ib = np.roll(ib, (dy * (side // s), dx * (side // s)), (0, 1))
        out.append(np.where(maskb[..., None], ib, ia))

    def remap(name, uv):
        if name == a:
            return uv
        o = uv.copy()
        o[:, 0] += dx / s
        o[:, 1] += dy / s
        return o

    return out[0], out[1], out[2], remap


def build_atlas(sources, uv_by_src, side=TEX, pad=4):
    """sources: {名: 貼圖組}；uv_by_src: {名: (三角形數,3,2) UV，v 向下}。
    回傳 (base, orm, n, remap)；remap[名](uv) 把舊 UV 換成新 UV。"""
    got = interlock(sources, uv_by_src, side)
    if got:
        return got
    boxes = []   # (sw, sh, 名, 來源 u0,v0,u1,v1)
    for name, tri in uv_by_src.items():
        s = sources[name]['base'].shape[0]
        for u0, v0, u1, v1 in uv_island_rects(np.clip(tri, 0, 1)):
            u0 = max(0, u0 - 2 / s); v0 = max(0, v0 - 2 / s)
            u1 = min(1, u1 + 2 / s); v1 = min(1, v1 + 2 / s)
            # 以 UV 比例當面積：不同解析度的來源得到相同的貼圖密度
            boxes.append(((u1 - u0) * 1024, (v1 - v0) * 1024, name, u0, v0, u1, v1))
    lo, hi = 0.1, 2.0
    best = None
    for _ in range(24):
        mid = (lo + hi) / 2
        pos = shelf_pack(boxes, mid, side, pad)
        if pos:
            best = (mid, pos)
            lo = mid
        else:
            hi = mid
    scale, pos = best
    log(f'  atlas {list(uv_by_src)}: {len(boxes)} 塊，縮放 {scale:.3f}')
    base = np.zeros((side, side, 3), np.float32)
    orm = np.zeros((side, side, 3), np.float32)
    orm[..., 0] = 255
    orm[..., 1] = 180
    nrm = np.zeros((side, side, 3), np.float32)
    nrm[...] = (128, 128, 255)
    table = {k: [] for k in uv_by_src}
    for (bw, bh, name, u0, v0, u1, v1), (x, y) in zip(boxes, pos):
        S = sources[name]
        s = S['base'].shape[0]
        dw = int(math.ceil(bw * scale)) + pad * 2
        dh = int(math.ceil(bh * scale)) + pad * 2
        # 含 pad 的來源範圍
        ex = pad / (bw * scale) * (u1 - u0)
        ey = pad / (bh * scale) * (v1 - v0)
        su0, sv0, su1, sv1 = u0 - ex, v0 - ey, u1 + ex, v1 + ey
        sx0 = max(0, int(su0 * s)); sy0 = max(0, int(sv0 * s))
        sx1 = min(s, int(math.ceil(su1 * s))); sy1 = min(s, int(math.ceil(sv1 * s)))
        for key, dst in (('base', base), ('orm', orm), ('n', nrm)):
            src = S[key]
            k = src.shape[0] / s
            part = resample(src[..., :3], int(sx0 * k), int(sy0 * k), int(sx1 * k), int(sy1 * k), dw, dh)
            dst[y:y + dh, x:x + dw] = part
        # 來源實際取樣範圍 → 目的矩形（整塊線性對應）
        table[name].append((u0, v0, u1, v1, sx0 / s, sy0 / s, sx1 / s, sy1 / s, x, y, dw, dh))

    def remap(name, uv):
        out = uv.copy()
        c = np.clip(uv, 0, 1)
        done = np.zeros(len(uv), bool)
        for u0, v0, u1, v1, a0, b0, a1, b1, x, y, dw, dh in table[name]:
            sel = (~done) & (c[:, 0] >= u0 - 1e-5) & (c[:, 0] <= u1 + 1e-5) & (c[:, 1] >= v0 - 1e-5) & (c[:, 1] <= v1 + 1e-5)
            out[sel, 0] = (x + (uv[sel, 0] - a0) / (a1 - a0) * dw) / side
            out[sel, 1] = (y + (uv[sel, 1] - b0) / (b1 - b0) * dh) / side
            done |= sel
        assert done.all(), f'{name}: {int((~done).sum())} 個 UV 沒落在任何島裡'
        return out

    return base, orm, nrm, remap


def post_textures(gid, gi, b, o, n):
    """各武器的貼圖後處理，並在這裡順手產出共用幾何的變體（r50、flash）。"""
    work = os.path.join(CACHE, gid)
    if gid == 'p9':
        # r50：同幾何，滑套與彈匣換暗鎳，框體略深
        dir50 = os.path.join(CACHE, 'r50')
        os.makedirs(dir50, exist_ok=True)
        if gi == 0:
            nb, no = wear(b * 1.0, o, n, .9, 501)
            lum = nb.mean(2, keepdims=True) / 90
            nb = np.array([104, 101, 96], np.float32) * lum.clip(.7, 1.5)
            no[..., 1] = no[..., 1] * .62
            no[..., 2] = 245
            write_webp(nb, os.path.join(dir50, 'm0_a.webp'), WEBP_ALBEDO)
            write_webp(no, os.path.join(dir50, 'm0_orm.webp'), WEBP_ORM)
            return wear(b, o, n, .8, 277)
        nb, no = wear(b * .86, o, n, .18, 502)
        write_webp(nb, os.path.join(dir50, 'm1_a.webp'), WEBP_ALBEDO)
        write_webp(no, os.path.join(dir50, 'm1_orm.webp'), WEBP_ORM)
        return wear(b, o, n, .15, 278)
    if gid == 'smoke':
        # flash：同幾何，字全部擦掉，鈍灰殼加淡黃標示帶
        dirf = os.path.join(CACHE, 'flash')
        os.makedirs(dirf, exist_ok=True)
        c = np.clip(b, 0, 255).astype(np.uint8)
        c = np.dstack([c, np.full(c.shape[:2], 255, np.uint8)])
        for r in (V(395, 222, 815, 428), V(435, 438, 765, 548)):
            heal_rect(c, r)
        f = c[..., :3].astype(np.float32)
        olive = np.clip(1 - np.abs(f[..., 0] - f[..., 1] * 1.08) / 40, 0, 1)[..., None] * (f[..., 2:3] < f[..., 1:2] * .92)
        f = f * (1 - olive) + f.mean(2, keepdims=True) * np.array([.86, .88, .92], np.float32) * olive
        write_webp(retint_red(f, (214, 196, 120)), os.path.join(dirf, 'm0_a.webp'), WEBP_ALBEDO)
        return retint_red(b, (150, 132, 92)), o
    return b, o


def build_textures(cfg, gid, arrays, slot_names, out):
    """回傳輸出的材質描述，並把 arrays 的 UV 改成新貼圖座標。"""
    work = os.path.join(CACHE, gid)
    src = source_materials(cfg, work)
    for name, rects in cfg.get('scrub', {}).items():
        for r in rects:
            keys = ('base', 'orm', 'n')
            if isinstance(r, dict):
                keys = r['keys']
                r = r['r']
            for key in keys:
                heal(src[name][key], r, grain=key != 'n' and cfg.get('scrub_grain', True))
    if cfg.get('scrub_fn') == 'm67':
        scrub_m67(src['Scene_-_Root'])
    mats = []
    for gi, group in enumerate(cfg['atlas']):
        tag = f'm{gi}'
        slots = [i for i, n in enumerate(slot_names) if n in group and i in arrays]
        if len(group) == 1:
            S = src[group[0]]
            b = resample(S['base'][..., :3], 0, 0, S['base'].shape[1], S['base'].shape[0], TEX, TEX)
            o = resample(S['orm'][..., :3], 0, 0, S['orm'].shape[1], S['orm'].shape[0], TEX, TEX)
            n = resample(S['n'][..., :3], 0, 0, S['n'].shape[1], S['n'].shape[0], TEX, TEX)
            remap = None
        else:
            uv_by = {}
            for i in slots:
                pos, nor, uv, idx = arrays[i]
                uv_by[slot_names[i]] = uv[idx].reshape(-1, 3, 2)
            b, o, n, remap = build_atlas(src, uv_by)
        n = fix_normal(n)
        b, o = post_textures(gid, gi, b, o, n)
        write_webp(b, os.path.join(work, tag + '_a.webp'), WEBP_ALBEDO)
        write_webp(o, os.path.join(work, tag + '_orm.webp'), WEBP_ORM)
        if not cfg.get('flat_normal'):
            write_webp(n, os.path.join(work, tag + '_n.webp'), WEBP_NORMAL)
        # 併成一個 primitive
        parts = []
        ofs = 0
        for i in slots:
            pos, nor, uv, idx = arrays[i]
            if remap:
                uv = remap(slot_names[i], uv)
            parts.append((pos, nor, uv, idx + ofs))
            ofs += len(pos)
        out[gi] = tuple(np.concatenate([p[k] for p in parts]) for k in range(4))
        mats.append(dict(name=f'{gid}_{gi}', a=f'{gid}/{tag}_a.webp', orm=f'{gid}/{tag}_orm.webp',
                         n=None if cfg.get('flat_normal') else f'{gid}/{tag}_n.webp'))
    return mats


# ---------------------------------------------------------------------------
# 來源模型 → 快取
# ---------------------------------------------------------------------------
def pca_rotation(ob, flip):
    """v11 的來源是擺拍姿勢：以機匣物件的主軸定出標準軸。長軸→Y、次軸→Z。"""
    co = np.empty(len(ob.data.vertices) * 3, np.float32)
    ob.data.vertices.foreach_get('co', co)
    co = co.reshape(-1, 3)
    m = np.array(ob.matrix_world)
    p = co @ m[:3, :3].T + m[:3, 3]
    w, v = np.linalg.eigh(np.cov((p - p.mean(0)).T))
    y = v[:, 2] * flip[0]
    z = v[:, 1] * flip[1]
    x = np.cross(y, z)
    return Matrix((tuple(x), tuple(y), tuple(z))).to_4x4()


def tri_count(me):
    me.calc_loop_triangles()
    return len(me.loop_triangles)


def decimate(obs, target):
    """逐零件減面：小零件（螺絲、準星）不動，只壓大面。法線由原模型轉印回來，
    烘好的法線圖才不會因為頂點法線改變而出現髒面。"""
    counts = [tri_count(o.data) for o in obs]
    total = sum(counts)
    if total <= target:
        return obs
    floor = 220
    big = [c for c in counts if c > floor]
    small = total - sum(big)
    ratio = max(.08, (target - small) / sum(big))
    log(f'  減面 {total} → 目標 {target}，大零件比例 {ratio:.3f}')
    sc = bpy.context.scene
    out = []
    for o, c in zip(obs, counts):
        if c <= floor:
            out.append(o)
            continue
        d = o.copy()
        d.data = o.data.copy()
        sc.collection.objects.link(d)
        d.matrix_world = o.matrix_world
        m = d.modifiers.new('dec', 'DECIMATE')
        m.decimate_type = 'COLLAPSE'
        m.ratio = ratio
        m.use_collapse_triangulate = True
        bpy.context.view_layer.update()
        dg = bpy.context.evaluated_depsgraph_get()
        me = bpy.data.meshes.new_from_object(d.evaluated_get(dg))
        d.modifiers.clear()
        d.data = me
        t = d.modifiers.new('nor', 'DATA_TRANSFER')
        t.object = o
        t.use_object_transform = True
        t.use_loop_data = True
        t.data_types_loops = {'CUSTOM_NORMAL'}
        t.loop_mapping = 'POLYINTERP_NEAREST'
        bpy.context.view_layer.update()
        dg = bpy.context.evaluated_depsgraph_get()
        me2 = bpy.data.meshes.new_from_object(d.evaluated_get(dg))
        d.modifiers.clear()
        d.data = me2
        bpy.data.objects.remove(o, do_unlink=True)
        out.append(d)
    return out


def build_source(gid, cfg):
    log('build', gid)
    work = os.path.join(CACHE, gid)
    shutil.rmtree(work, ignore_errors=True)
    os.makedirs(work)
    obs = import_model(cfg)
    if cfg.get('axes'):
        R = axes_matrix(cfg['axes'])
    else:
        R = cfg['_pca']
    if cfg.get('tri_target'):
        obs = decimate(obs, cfg['tri_target'])
    # 先以標準軸量長度
    P = []
    for o in obs:
        co = np.empty(len(o.data.vertices) * 3, np.float32)
        o.data.vertices.foreach_get('co', co)
        co = co.reshape(-1, 3)
        m = np.array(R @ o.matrix_world)
        P.append(co @ m[:3, :3].T + m[:3, 3])
    P = np.concatenate(P)
    s = cfg['length'] / float(P[:, 1].max() - P[:, 1].min())
    org = Vector(cfg.get('origin', (0, 0, 0)))
    # AABB 中心先搬到 0，origin／muzzle／mag 都以此為基準量
    mid = (P.max(0) + P.min(0)) / 2 * s
    xf = Matrix.Translation(-org) @ Matrix.Translation(-Vector(mid)) @ Matrix.Scale(s, 4) @ R
    log(f'  AABB(m) size {((P.max(0) - P.min(0)) * s).round(4)}，縮放 {s:.5f}')
    ob = join(obs, xf)
    slot_names = [m.name for m in ob.data.materials]
    arrays = mesh_arrays(ob.data)
    out = {}
    mats = build_textures(cfg, gid, arrays, slot_names, out)
    save_cache(gid, cfg, out, mats)
    if gid == 'p9':
        info = json.load(open(os.path.join(work, 'info.json')))
        info.update(id='r50', share='p9', mats=[
            dict(name='r50_0', a='r50/m0_a.webp', orm='r50/m0_orm.webp', n='p9/m0_n.webp'),
            dict(name='r50_1', a='r50/m1_a.webp', orm='r50/m1_orm.webp', n='p9/m1_n.webp')])
        json.dump(info, open(os.path.join(CACHE, 'r50', 'info.json'), 'w'), ensure_ascii=False, indent=1)
    if gid == 'smoke':
        info = json.load(open(os.path.join(work, 'info.json')))
        info.update(id='flash', share='smoke', mats=[
            dict(name='flash_0', a='flash/m0_a.webp', orm='smoke/m0_orm.webp', n=None)])
        json.dump(info, open(os.path.join(CACHE, 'flash', 'info.json'), 'w'), ensure_ascii=False, indent=1)


def save_cache(gid, cfg, prims, mats, share=None):
    work = os.path.join(CACHE, gid)
    arr = {}
    tris = 0
    for i, (pos, nor, uv, idx) in prims.items():
        arr[f'p{i}'] = pos; arr[f'n{i}'] = nor; arr[f't{i}'] = uv; arr[f'i{i}'] = idx
        tris += len(idx) // 3
    np.savez(os.path.join(work, 'mesh.npz'), **arr)
    allp = np.concatenate([p[0] for p in prims.values()])
    z = allp[:, 2]
    # 槍口：最前端 2% 長度內頂點的中心
    front = allp[z > z.max() - 0.02 * (z.max() - z.min())]
    org = np.array(cfg.get('origin', (0, 0, 0)), np.float64)

    def to_gltf(v):
        d = np.array(v, np.float64) - org
        return [float(d[0]), float(d[2]), float(-d[1])]

    muzzle = to_gltf(cfg['muzzle']) if cfg.get('muzzle') else [float(front[:, 0].mean()), float(front[:, 1].mean()), float(z.max())]
    mag = to_gltf(cfg['mag']) if cfg.get('mag') else [0.0, float(allp[:, 1].min()), 0.0]
    with open(os.path.join(work, 'info.json'), 'w') as f:
        json.dump(dict(id=gid, mats=mats, nmat=len(prims), tris=tris, muzzle=muzzle, mag=mag,
                       min=allp.min(0).tolist(), max=allp.max(0).tolist()), f, ensure_ascii=False, indent=1)
    log(f'  {gid}: {tris} 三角形, {len(prims)} 材質, 頂點 {len(allp)}')



# ---------------------------------------------------------------------------
# 自建武器：knife、charge
# ---------------------------------------------------------------------------
class Part:
    """逐點建網格。uv 以頂點為單位（要分開的邊就複製頂點）。"""

    def __init__(self):
        self.v = []
        self.f = []
        self.t = []

    def add(self, pts, uv=None):
        i = len(self.v)
        self.v.extend(pts)
        self.t.extend(uv if uv is not None else [(0, 0)] * len(pts))
        return i

    def grid(self, pts, uv=None, wrap=False, caps=False):
        """pts: (rows, cols, 3)。wrap=True 時每列首尾相接（環）。"""
        pts = np.asarray(pts, np.float64)
        r, c = pts.shape[:2]
        i = self.add([tuple(p) for p in pts.reshape(-1, 3)],
                     None if uv is None else [tuple(q) for q in np.asarray(uv).reshape(-1, 2)])
        for a in range(r - 1):
            for b in range(c if wrap else c - 1):
                n = (b + 1) % c
                self.f.append((i + a * c + b, i + a * c + n, i + (a + 1) * c + n, i + (a + 1) * c + b))
        if caps:
            self.f.append(tuple(i + b for b in range(c))[::-1])
            self.f.append(tuple(i + (r - 1) * c + b for b in range(c)))


def to_object(part, name, recalc=True):
    me = bpy.data.meshes.new(name)
    me.from_pydata(part.v, [], part.f)
    me.update()
    uv = me.uv_layers.new(name='UVMap')
    t = np.array(part.t, np.float32)
    lv = np.empty(len(me.loops), np.int32)
    me.loops.foreach_get('vertex_index', lv)
    uv.uv.foreach_set('vector', t[lv].reshape(-1))
    if recalc:
        bm = bmesh.new()
        bm.from_mesh(me)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        bm.to_mesh(me)
        bm.free()
    me.shade_smooth()
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    return ob


def apply_mods(ob):
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
    ob.modifiers.clear()
    ob.data = me
    return ob


def bevel_part(ob, width=.0012, seg=3, angle=30, sharp=35):
    """SPEC_Super 的硬表面做法：Bevel（profile 0.7）+ Weighted Normal。"""
    if width > 0:
        m = ob.modifiers.new('bev', 'BEVEL')
        m.width = width
        m.segments = seg
        m.profile = .7
        m.limit_method = 'ANGLE'
        m.angle_limit = math.radians(angle)
        m.miter_outer = 'MITER_ARC'
        apply_mods(ob)
    ob.data.set_sharp_from_angle(angle=math.radians(sharp))
    w = ob.modifiers.new('wn', 'WEIGHTED_NORMAL')
    w.keep_sharp = True
    w.weight = 50
    apply_mods(ob)
    return ob


def box_project(ob, cell, span=None):
    """把物件依面的主軸平面投影進貼圖格子 cell=(u0,v0,u1,v1)（影像座標，v 向下）。"""
    me = ob.data
    co = np.empty(len(me.vertices) * 3, np.float32)
    me.vertices.foreach_get('co', co)
    co = co.reshape(-1, 3)
    lo = co.min(0)
    sp = span or float((co.max(0) - lo).max())
    sp = max(sp, 1e-5)
    uv = me.uv_layers[0].uv
    n = np.empty(len(me.polygons) * 3, np.float32)
    me.polygons.foreach_get('normal', n)
    n = np.abs(n.reshape(-1, 3))
    ax = n.argmax(1)
    u0, v0, u1, v1 = cell
    su = (u1 - u0) * .96
    sv = (v1 - v0) * .96
    for p, a in zip(me.polygons, ax):
        i, j = [(1, 2), (0, 2), (0, 1)][a]
        for li in p.loop_indices:
            c = co[me.loops[li].vertex_index] - lo
            x = u0 + (u1 - u0) * .02 + (c[i] / sp) * su
            y = v0 + (v1 - v0) * .02 + (c[j] / sp) * sv
            uv[li].vector = (x, 1 - y)
    return ob


def collect(parts, xf=None):
    """parts: [(物件, 輸出材質索引)] → {材質索引: 合併的 pos/nor/uv/idx}。"""
    out = {}
    for ob, gi in parts:
        if xf is not None:
            ob.data.transform(xf)
        a = mesh_arrays(ob.data)[0]
        out.setdefault(gi, []).append(a)
    res = {}
    for gi, lst in out.items():
        ofs = 0
        idx = []
        for a in lst:
            idx.append(a[3] + ofs)
            ofs += len(a[0])
        res[gi] = (np.concatenate([a[0] for a in lst]), np.concatenate([a[1] for a in lst]),
                   np.concatenate([a[2] for a in lst]), np.concatenate(idx))
    return res


def stadium(hx, hz, n=28, power=2.6):
    """超橢圓環：回傳 (n,2)。"""
    t = np.linspace(0, 2 * math.pi, n, endpoint=False)
    c, s = np.cos(t), np.sin(t)
    return np.stack([hx * np.sign(c) * np.abs(c) ** (2 / power), hz * np.sign(s) * np.abs(s) ** (2 / power)], 1)


# --- K2 戰鬥刀 ---------------------------------------------------------------
BLADE_L = .178


def blade_spine(t):
    t = np.asarray(t, np.float64)
    c = np.clip((t - .60) / .40, 0, 1)
    return .0165 - .0125 * c ** 1.5


def blade_edge(t):
    t = np.asarray(t, np.float64)
    c = np.clip((t - .50) / .50, 0, 1)
    return -.0165 + .0205 * c ** 2.6


def saw(t):
    """刀背鋸齒，t 在 .10–.40 之間，14 齒。"""
    t = np.asarray(t, np.float64)
    p = (t - .10) / .30 * 14
    on = (t >= .10) & (t <= .40)
    return np.where(on, np.abs((p % 1) - .5) * 2 * .0017, 0.0)


def build_blade():
    # 欄位：鋸齒段每齒 4 欄，其餘均勻
    ts = list(np.linspace(0, .10, 8)[:-1]) + list(np.linspace(.10, .40, 14 * 4 + 1))[:-1] + list(np.linspace(.40, 1, 34))
    ts = np.array(ts)
    S = np.array([0, .055, .22, .25, .42, .45, .54, .97, 1.0])
    X = np.array([.62, 1, 1, 0, 0, 1, 1, .10, 0])     # 0 表示要套凹槽深度，見下
    T = .0026 * (1 - .55 * ts ** 2)
    fuller = np.clip((ts - .08) / .06, 0, 1) * np.clip((.62 - ts) / .08, 0, 1) * .40
    grid = np.zeros((2, len(S), len(ts), 3))
    uv = np.zeros((2, len(S), len(ts), 2))
    sp = blade_spine(ts) + saw(ts)
    ed = blade_edge(ts)
    for i, s in enumerate(S):
        z = sp + (ed - sp) * s
        if i in (3, 4):
            x = T * (1 - fuller)
        elif i == 8:
            x = T * 0
        else:
            x = T * X[i]
        for side, sign in ((0, 1), (1, -1)):
            grid[side, i, :, 0] = x * sign
            grid[side, i, :, 1] = -ts * BLADE_L
            grid[side, i, :, 2] = z
            # 影像座標：u 沿刃長、v 在貼圖上方 26% 的橫帶
            uv[side, i, :, 0] = .01 + ts * .98
            uv[side, i, :, 1] = 1 - (.005 + (z + .022) / .044 * .25)
    p = Part()
    p.grid(grid[0], uv[0])
    p.grid(grid[1], uv[1])
    # 刀背窄條：兩側 s=0 相接，刀尖收成一線
    strip = np.stack([grid[0, 0], grid[1, 0]], 0)
    suv = np.zeros((2, len(ts), 2))
    suv[0, :, 0] = suv[1, :, 0] = .01 + ts * .98
    suv[0, :, 1] = 1 - .27
    suv[1, :, 1] = 1 - .275
    p.grid(strip, suv)
    # 根部封口（藏在護手裡）
    ob = to_object(p, 'blade')
    ob.data.set_sharp_from_angle(angle=math.radians(28))
    return ob


def build_knife():
    log('build knife')
    work = os.path.join(CACHE, 'knife')
    shutil.rmtree(work, ignore_errors=True)
    os.makedirs(work)
    reset()
    parts = [(build_blade(), 0)]
    # 護手：上小下大的短十字，厚 6 mm
    g = stadium(.0115, .0285, 32, 3.0)
    g[:, 1] -= .004
    p = Part()
    p.grid(np.stack([np.column_stack([g[:, 0], np.full(len(g), yy), g[:, 1]]) for yy in (.001, .007)]), wrap=True, caps=True)
    parts.append((box_project(bevel_part(to_object(p, 'guard'), .0011, 3), (.02, .30, .22, .50)), 0))
    # 握把芯（幾乎被繩蓋住）與末端配重
    prof = lambda t: 1 + .10 * np.sin(math.pi * t) - .05 * np.sin(2 * math.pi * t)
    rings = []
    ts = np.linspace(0, 1, 14)
    base = stadium(.0102, .0150, 20, 2.4)
    GL = .116
    for t in ts:
        k = float(prof(t))
        rings.append(np.column_stack([base[:, 0] * k, np.full(len(base), .007 + t * GL), base[:, 1] * k]))
    p = Part()
    p.grid(np.stack(rings), wrap=True, caps=True)
    parts.append((box_project(bevel_part(to_object(p, 'core'), 0, sharp=60), (.25, .30, .45, .50)), 0))
    pm = stadium(.0125, .0185, 28, 3.4)
    secs = [(.123, .92), (.127, 1.0), (.134, 1.0), (.139, .84)]
    p = Part()
    p.grid(np.stack([np.column_stack([pm[:, 0] * k, np.full(len(pm), yy), pm[:, 1] * k]) for yy, k in secs]), wrap=True, caps=True)
    parts.append((box_project(bevel_part(to_object(p, 'pommel'), .0009, 3, 25), (.50, .30, .70, .50)), 0))
    # 纏繩：沿握把輪廓的螺旋管，接縫朝內
    cr = .00205                 # 繩半徑
    pitch = cr * 2.02
    turns = int(GL * .98 / pitch)
    steps = 26
    sides = 6
    n = turns * steps + 1
    th = np.linspace(0, turns * 2 * math.pi, n)
    ty = th / (2 * math.pi) * pitch + cr
    tt = ty / GL
    k = prof(tt)
    # 超橢圓的徑向
    c, s = np.cos(th), np.sin(th)
    pw = 2 / 2.4
    ex = .0102 * np.sign(c) * np.abs(c) ** pw * k
    ez = .0150 * np.sign(s) * np.abs(s) ** pw * k
    cen = np.stack([ex, .007 + ty, ez], 1)
    out = np.stack([ex / .0102, np.zeros(n), ez / .0150], 1)
    out /= np.linalg.norm(out, axis=1, keepdims=True)
    tan = np.gradient(cen, axis=0)
    tan /= np.linalg.norm(tan, axis=1, keepdims=True)
    bi = np.cross(tan, out)
    ang = np.linspace(0, 2 * math.pi, sides + 1) + math.pi  # 首尾重複一圈當 UV 接縫，朝向握把
    grid = np.zeros((n, sides + 1, 3))
    uv = np.zeros((n, sides + 1, 2))
    length = np.concatenate([[0], np.cumsum(np.linalg.norm(np.diff(cen, axis=0), axis=1))])
    for j, a in enumerate(ang):
        grid[:, j] = cen + (out * math.cos(a) + bi * math.sin(a)) * cr
        uv[:, j, 0] = length / .046     # 繩紋貼圖每 46 mm 重複一次
        uv[:, j, 1] = j / sides * .25
    p = Part()
    p.grid(grid, uv)
    # 兩端封口
    i = len(p.v)
    p.add([tuple(cen[0]), tuple(cen[-1])], [(0, 0), (0, 0)])
    base_i = 0
    for j in range(sides):
        p.f.append((i, base_i + j, base_i + j + 1))
        p.f.append((i + 1, base_i + (n - 1) * (sides + 1) + j + 1, base_i + (n - 1) * (sides + 1) + j))
    cord = to_object(p, 'cord')
    parts.append((cord, 1))

    org = Vector((0, .065, 0))    # 握把中段
    prims = collect(parts, Matrix.Translation(-org))

    # 貼圖 0：刀身（鍍層＋磨砂＋開刃帶）與護手／配重的金屬格
    N = TEX
    rng = np.random.default_rng(278)
    g1 = fbm(N, 11, 1.0)
    g2 = fbm(N, 12, 1.9)
    b = np.zeros((N, N, 3), np.float32)
    o = np.zeros((N, N, 3), np.float32)
    o[..., 0] = 235
    base_c = np.array([46, 47, 49], np.float32)
    b[...] = base_c * (.86 + .3 * g2[..., None])
    o[..., 1] = 150 + 50 * g1
    o[..., 2] = 240
    h = g1 * .35
    # 長刮痕：沿刃長方向
    scr = np.zeros((N, N), np.float32)
    for _ in range(420):
        x0 = rng.integers(0, N)
        y0 = rng.integers(0, N)
        ln = rng.integers(30, 260)
        sl = rng.uniform(-.12, .12)
        xs = (x0 + np.arange(ln)) % N
        ys = (y0 + (np.arange(ln) * sl).astype(int)) % N
        scr[ys, xs] = max(.2, rng.random())
    scr = box_blur(scr[..., None], 1)[..., 0]
    # 開刃帶：把 t、z 換回貼圖列
    yy, xx = np.mgrid[0:N, 0:N]
    ut = np.clip((xx / N - .01) / .98, 0, 1)
    z = (yy / N - .005) / .25 * .044 - .022
    sp = blade_spine(ut)
    ed = blade_edge(ut)
    frac = (sp - z) / np.maximum(sp - ed, 1e-4)
    band = (yy < int(.27 * N))
    grind = np.clip((frac - .535) / .02, 0, 1) * band
    wearline = np.clip((frac - .86) / .1, 0, 1) * band
    streak = fbm(N, 21, 1.2)
    streak = np.roll(box_blur(np.repeat(streak[:, :1], N, 1)[..., None], 2)[..., 0], 0, 0)
    b = b + (grind * (6 + 14 * streak))[..., None]
    b = b + (wearline * (64 + 48 * g1))[..., None]
    b = b + (scr * 26)[..., None]
    o[..., 1] = o[..., 1] * (1 - .35 * wearline) * (1 - .2 * scr)
    h = h + scr * .5 + grind * streak * .3
    n = height_normal(h, 2.6)
    write_webp(b, os.path.join(work, 'm0_a.webp'), WEBP_ALBEDO)
    write_webp(o, os.path.join(work, 'm0_orm.webp'), WEBP_ORM)
    write_webp(n, os.path.join(work, 'm0_n.webp'), WEBP_NORMAL)
    # 貼圖 1：編織繩（可重複）
    yy, xx = np.mgrid[0:N, 0:N]
    u = xx / N * 2 * math.pi * 10
    v = yy / N * 2 * math.pi * 40    # 橫向 v 只用 1/4 帶，故頻率高
    weave = np.sin(u + v) * np.sin(u - v)
    h = .5 + .5 * weave
    h = h + fbm(N, 31, 1.2) * .25
    n = height_normal(h, 3.2)
    g3 = fbm(N, 32, 1.6)[..., None]
    b = np.array([118, 100, 66], np.float32) * (.62 + .5 * h[..., None] * .8 + .28 * g3)
    o = np.zeros((N, N, 3), np.float32)
    o[..., 0] = 120 + 135 * np.clip(h, 0, 1)
    o[..., 1] = 225
    write_webp(b, os.path.join(work, 'm1_a.webp'), WEBP_ALBEDO)
    write_webp(o, os.path.join(work, 'm1_orm.webp'), WEBP_ORM)
    write_webp(n, os.path.join(work, 'm1_n.webp'), WEBP_NORMAL)
    mats = [dict(name='knife_0', a='knife/m0_a.webp', orm='knife/m0_orm.webp', n='knife/m0_n.webp'),
            dict(name='knife_1', a='knife/m1_a.webp', orm='knife/m1_orm.webp', n='knife/m1_n.webp')]
    # 刀的 muzzle=刀尖、mag=配重
    save_cache('knife', dict(origin=tuple(org), muzzle=(0, -BLADE_L, .004), mag=(0, .139, 0)), prims, mats)


# --- 破門裝藥 Breach Charge ----------------------------------------------------
# 設計：貼門用的長條硬殼（不是磚塊＋膠帶＋鍵盤）。硬殼、兩端鋼製貼門支架、四個橡膠腳墊、
# 中央起爆模組（轉盤＋掀蓋開關＋短天線）、兩條走線。
CELLS = [
    # (albedo, rough, metal)
    ((122, 104, 72), 175, 0),     # 0 硬殼：褐土色聚合物
    ((44, 45, 44), 170, 0),       # 1 模組：深灰
    ((96, 96, 94), 110, 245),     # 2 鋼
    ((26, 26, 27), 225, 0),       # 3 橡膠
    ((170, 138, 40), 165, 0),     # 4 警示黃
    ((132, 44, 30), 150, 0),      # 5 轉盤紅
    ((70, 72, 68), 120, 230),     # 6 深色金屬
    ((22, 22, 23), 200, 0),       # 7 線
]


def cell_uv(i):
    c = i % 4
    r = i // 4
    return (c * .25, r * .25, (c + 1) * .25, (r + 1) * .25)


def extrude_box(cx, cy, cz, hx, hy, hz, power=5, n=24):
    """平面是圓角矩形（XY），沿 Z 擠出的塊。"""
    t = stadium(hx, hy, n, power)
    p = Part()
    p.grid(np.stack([np.column_stack([t[:, 0] + cx, t[:, 1] + cy, np.full(n, zz)]) for zz in (cz - hz, cz + hz)]),
           wrap=True, caps=True)
    return p


def cylinder(c, r, h, axis='z', n=20):
    t = np.linspace(0, 2 * math.pi, n, endpoint=False)
    ring = np.stack([np.cos(t) * r, np.sin(t) * r], 1)
    rows = []
    for d in (-h / 2, h / 2):
        if axis == 'z':
            rows.append(np.column_stack([ring[:, 0] + c[0], ring[:, 1] + c[1], np.full(n, c[2] + d)]))
        elif axis == 'x':
            rows.append(np.column_stack([np.full(n, c[0] + d), ring[:, 0] + c[1], ring[:, 1] + c[2]]))
        else:
            rows.append(np.column_stack([ring[:, 0] + c[0], np.full(n, c[1] + d), ring[:, 1] + c[2]]))
    p = Part()
    p.grid(np.stack(rows), wrap=True, caps=True)
    return p


def tube(path, r, sides=6):
    path = np.asarray(path, np.float64)
    tan = np.gradient(path, axis=0)
    tan /= np.linalg.norm(tan, axis=1, keepdims=True)
    up = np.array([1, 0, 0.])
    rows = []
    a = np.linspace(0, 2 * math.pi, sides, endpoint=False)
    for p_, t_ in zip(path, tan):
        s = np.cross(t_, up)
        s /= np.linalg.norm(s)
        q = np.cross(s, t_)
        rows.append(p_ + (np.outer(np.cos(a), s) + np.outer(np.sin(a), q)) * r)
    p = Part()
    p.grid(np.stack(rows), wrap=True, caps=True)
    return p


def build_charge():
    log('build charge')
    work = os.path.join(CACHE, 'charge')
    shutil.rmtree(work, ignore_errors=True)
    os.makedirs(work)
    reset()
    parts = []

    def add(part, name, cell, bev=.0011, seg=3, angle=30):
        ob = bevel_part(to_object(part, name), bev, seg, angle)
        box_project(ob, cell_uv(cell))
        parts.append((ob, 0))

    HX, HY, HZ = .058, .125, .021      # 硬殼半尺寸
    add(extrude_box(0, 0, HZ, HX, HY, HZ, 6, 40), 'shell', 0, .0024, 3)
    # 上蓋分段的凸肋（殼體是橫向分節，不是一塊塊的磚）
    for i, y in enumerate(np.linspace(-.098, .098, 6)):
        if abs(y) < .03:
            continue
        add(extrude_box(0, y, HZ * 2 + .0012, HX * .90, .0035, .0016, 6, 16), f'rib{i}', 0, .0007, 2)
    # 側邊的固定帶（警示黃條）
    for sx in (-1, 1):
        add(extrude_box(sx * (HX + .0006), 0, HZ, .0012, HY * .62, .0075, 8, 16), f'band{sx}', 4, .0005, 2)
    # 兩端鋼支架 + 腳墊
    for sy in (-1, 1):
        y = sy * (HY + .010)
        add(extrude_box(0, y, .0035, HX * .92, .012, .0035, 6, 24), f'brk{sy}', 2, .001, 2)
        add(extrude_box(0, sy * (HY + .002), .012, HX * .55, .004, .012, 6, 20), f'lug{sy}', 2, .0009, 2)
        for sx in (-1, 1):
            add(cylinder((sx * HX * .66, y + sy * .002, -.0028), .0085, .0036, 'z', 18), f'pad{sy}{sx}', 3, .0008, 2)
            add(cylinder((sx * HX * .66, y + sy * .002, .0075), .0034, .0012, 'z', 12), f'bolt{sy}{sx}', 6, .0004, 1)
    # 中央起爆模組
    MZ = HZ * 2
    add(extrude_box(.008, 0, MZ + .009, .030, .033, .009, 7, 28), 'mod', 1, .0016, 3)
    add(cylinder((.018, -.012, MZ + .0205), .0125, .0066, 'z', 28), 'dial', 5, .0009, 2)
    add(cylinder((.018, -.012, MZ + .0248), .0044, .0034, 'z', 14), 'dialcap', 6, .0006, 2)
    add(extrude_box(.012, .019, MZ + .0195, .0115, .0075, .0014, 6, 14), 'plate', 6, .0005, 2)
    # 掀蓋開關
    add(extrude_box(-.010, .015, MZ + .0205, .0048, .0085, .0034, 6, 16), 'switch', 4, .0007, 2)
    add(cylinder((-.0145, .015, MZ + .0225), .0016, .0052, 'y', 10), 'hinge', 2, 0, 1)
    # 短天線與接頭
    add(cylinder((-.017, -.022, MZ + .0225), .0048, .0050, 'z', 14), 'ant0', 6, .0006, 2)
    add(cylinder((-.017, -.022, MZ + .0365), .0024, .024, 'z', 10), 'ant1', 3, .0005, 2)
    # 走線：模組兩側到端部支架
    for sy in (-1, 1):
        path = np.array([[-.024, sy * .030, MZ + .010], [-.034, sy * .046, MZ + .010], [-.040, sy * .070, MZ + .0045],
                         [-.040, sy * .100, MZ + .0040], [-.038, sy * .118, MZ - .002], [-.030, sy * .123, MZ - .010]])
        # Catmull-Rom 內插
        pts = []
        for i in range(len(path) - 1):
            p0, p1, p2, p3 = path[max(i - 1, 0)], path[i], path[i + 1], path[min(i + 2, len(path) - 1)]
            for t in np.linspace(0, 1, 6, endpoint=False):
                pts.append(.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3))
        pts.append(path[-1])
        add(tube(pts, .0019, 6), f'wire{sy}', 7, 0, 1)
    org = Vector((0, 0, .021))
    prims = collect(parts, Matrix.Translation(-org))

    N = TEX
    b = np.zeros((N, N, 3), np.float32)
    o = np.zeros((N, N, 3), np.float32)
    h = np.zeros((N, N), np.float32)
    g1 = fbm(N, 41, 1.1)
    g2 = fbm(N, 42, 1.9)
    q = N // 4
    for i, (col, r, m) in enumerate(CELLS):
        c = i % 4
        ro = i // 4
        y0, y1, x0, x1 = ro * q, (ro + 1) * q, c * q, (c + 1) * q
        b[y0:y1, x0:x1] = np.array(col, np.float32)
        o[y0:y1, x0:x1, 1] = r
        o[y0:y1, x0:x1, 2] = m
    o[..., 0] = 235
    b *= (.84 + .34 * g2[..., None])
    o[..., 1] *= (.9 + .2 * g1)
    # 刮痕、磨損
    rng = np.random.default_rng(278)
    scr = np.zeros((N, N), np.float32)
    for _ in range(900):
        x0 = rng.integers(0, N)
        y0 = rng.integers(0, N)
        ln = rng.integers(10, 70)
        a = rng.uniform(0, 2 * math.pi)
        t = np.arange(ln)
        scr[(y0 + (t * math.sin(a)).astype(int)) % N, (x0 + (t * math.cos(a)).astype(int)) % N] = rng.random()
    b = b + (scr * 30)[..., None]
    h = g1 * .5 + scr * .4
    # 硬殼格子壓一層細顆粒
    n = height_normal(h, 1.6)
    write_webp(b, os.path.join(work, 'm0_a.webp'), WEBP_ALBEDO)
    write_webp(o, os.path.join(work, 'm0_orm.webp'), WEBP_ORM)
    write_webp(n, os.path.join(work, 'm0_n.webp'), WEBP_NORMAL)
    mats = [dict(name='charge_0', a='charge/m0_a.webp', orm='charge/m0_orm.webp', n='charge/m0_n.webp')]
    # charge：muzzle=天線頂、mag=起爆轉盤
    save_cache('charge', dict(origin=tuple(org), muzzle=(-.017, -.022, MZ + .0485), mag=(.018, -.012, MZ + .0265)), prims, mats)


# ---------------------------------------------------------------------------
# GLB 寫出
# ---------------------------------------------------------------------------
def pack():
    order = [g for g in ALL_IDS if os.path.exists(os.path.join(CACHE, g, 'info.json'))]
    bin_ = bytearray()
    j = dict(asset=dict(version='2.0', generator='games/278-ochre-line/tools/build-guns.py'),
             scene=0, scenes=[dict(nodes=[])], nodes=[], meshes=[], materials=[], textures=[], images=[],
             accessors=[], bufferViews=[], samplers=[dict(magFilter=9729, minFilter=9987, wrapS=10497, wrapT=10497)],
             extensionsUsed=['EXT_texture_webp'], extensionsRequired=['EXT_texture_webp'])

    def view(data, target=None):
        while len(bin_) % 4:
            bin_.append(0)
        bv = dict(buffer=0, byteOffset=len(bin_), byteLength=len(data))
        if target:
            bv['target'] = target
        j['bufferViews'].append(bv)
        bin_.extend(data)
        return len(j['bufferViews']) - 1

    def accessor(arr, ctype, typ, target, minmax=False):
        a = dict(bufferView=view(arr.tobytes(), target), componentType=ctype, count=len(arr), type=typ)
        if minmax:
            a['min'] = arr.min(0).tolist()
            a['max'] = arr.max(0).tolist()
        j['accessors'].append(a)
        return len(j['accessors']) - 1

    tex_of = {}

    def texture(rel):
        if rel not in tex_of:
            with open(os.path.join(CACHE, rel), 'rb') as f:
                data = f.read()
            j['images'].append(dict(name=rel.replace('/', '_').replace('.webp', ''), bufferView=view(data),
                                    mimeType='image/webp'))
            j['textures'].append(dict(sampler=0, extensions=dict(EXT_texture_webp=dict(source=len(j['images']) - 1))))
            tex_of[rel] = len(j['textures']) - 1
        return tex_of[rel]

    def material(m):
        pbr = dict(baseColorTexture=dict(index=texture(m['a'])))
        if m.get('factor'):
            pbr['baseColorFactor'] = m['factor']
        if m.get('metal') is not None:
            pbr['metallicFactor'] = m['metal']
        if m.get('rough') is not None:
            pbr['roughnessFactor'] = m['rough']
        if m.get('orm'):
            pbr['metallicRoughnessTexture'] = dict(index=texture(m['orm']))
        out = dict(name=m['name'], pbrMetallicRoughness=pbr)
        if m.get('orm'):
            out['occlusionTexture'] = dict(index=texture(m['orm']))
        if m.get('n'):
            out['normalTexture'] = dict(index=texture(m['n']))
        j['materials'].append(out)
        return len(j['materials']) - 1

    geo = {}   # geo id → [(pos,nor,uv,idx 的 accessor)]
    meta = dict(units='m', coords='glTF：槍口 +Z、上 +Y、槍的右側 -X；Babylon 載入後 x 翻號（右側 +X）', weapons={})
    for gid in order:
        info = json.load(open(os.path.join(CACHE, gid, 'info.json')))
        gsrc = info.get('share') or gid
        if gsrc not in geo:
            npz = np.load(os.path.join(CACHE, gsrc, 'mesh.npz'))
            prs = []
            for i in range(json.load(open(os.path.join(CACHE, gsrc, 'info.json')))['nmat']):
                pos, nor, uv, idx = npz[f'p{i}'], npz[f'n{i}'], npz[f't{i}'], npz[f'i{i}']
                it = (np.uint16, 5123) if len(pos) < 65535 else (np.uint32, 5125)
                prs.append((accessor(pos, 5126, 'VEC3', 34962, True), accessor(nor, 5126, 'VEC3', 34962),
                            accessor(uv, 5126, 'VEC2', 34962), accessor(idx.astype(it[0]), it[1], 'SCALAR', 34963)))
            geo[gsrc] = prs
        prims = []
        for (ap, an, at, ai), m in zip(geo[gsrc], info['mats']):
            prims.append(dict(attributes=dict(POSITION=ap, NORMAL=an, TEXCOORD_0=at), indices=ai,
                              material=material(m), mode=4))
        j['meshes'].append(dict(name=gid, primitives=prims))
        mesh_i = len(j['meshes']) - 1
        kids = []
        for tag in ('muzzle', 'mag'):
            j['nodes'].append(dict(name=f'{gid}_{tag}', translation=info[tag]))
            kids.append(len(j['nodes']) - 1)
        j['nodes'].append(dict(name=gid, mesh=mesh_i, children=kids))
        j['scenes'][0]['nodes'].append(len(j['nodes']) - 1)
        meta['weapons'][gid] = dict(muzzle=info['muzzle'], mag=info['mag'],
                                    aabb=dict(min=info['min'], max=info['max']), tris=info['tris'],
                                    materials=len(info['mats']), sharesGeometryWith=info.get('share'))
    while len(bin_) % 4:
        bin_.append(0)
    j['buffers'] = [dict(byteLength=len(bin_))]
    js = json.dumps(j, ensure_ascii=False, separators=(',', ':')).encode('utf8')
    js += b' ' * (-len(js) % 4)
    os.makedirs(os.path.dirname(OUT_GLB), exist_ok=True)
    total = 12 + 8 + len(js) + 8 + len(bin_)
    with open(OUT_GLB, 'wb') as f:
        f.write(struct.pack('<III', 0x46546C67, 2, total))
        f.write(struct.pack('<II', len(js), 0x4E4F534A))
        f.write(js)
        f.write(struct.pack('<II', len(bin_), 0x004E4942))
        f.write(bin_)
    meta['fileBytes'] = total
    with open(META, 'w') as f:
        json.dump(meta, f, ensure_ascii=False, indent=1)
    log(f'guns.glb {total / 1048576:.2f} MB，{len(order)} 把，貼圖 {len(j["images"])} 張')


# ---------------------------------------------------------------------------
# Contact sheet：讀最後的 guns.glb（驗的是成品，不是建置中途的狀態）
# ---------------------------------------------------------------------------
def tile(files, cols, w, h, out):
    args = []
    for f in files:
        args += ['-i', f]
    fc = ''.join(f'[{i}:v]scale={w}:{h}:force_original_aspect_ratio=decrease,pad={w}:{h}:(ow-iw)/2:(oh-ih)/2:0x8E9296[v{i}];'
                 for i in range(len(files)))
    fc += ''.join(f'[v{i}]' for i in range(len(files)))
    fc += f'xstack=inputs={len(files)}:fill=0x8E9296:layout=' + '|'.join(
        f'{(i % cols) * w}_{(i // cols) * h}' for i in range(len(files)))
    subprocess.run(['ffmpeg', '-v', 'error', '-y'] + args + ['-filter_complex', fc, '-frames:v', '1', out], check=True)


def sheet(only_ids=None):
    reset()
    bpy.ops.import_scene.gltf(filepath=OUT_GLB)
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.samples = 32
    sc.cycles.use_denoising = True
    prefs = bpy.context.preferences.addons['cycles'].preferences
    prefs.compute_device_type = 'METAL'
    prefs.get_devices()
    for d in prefs.devices:
        d.use = True
    sc.cycles.device = 'GPU'
    sc.view_settings.view_transform = 'Standard'
    sc.render.image_settings.file_format = 'PNG'
    world = bpy.data.worlds.new('w')
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs[0].default_value = (.42, .44, .47, 1)
    world.node_tree.nodes['Background'].inputs[1].default_value = 1.0
    sc.world = world
    sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN'))
    sun.data.energy = 3.0
    sun.data.angle = math.radians(6)
    sun.rotation_euler = (math.radians(55), math.radians(-20), math.radians(60))
    sc.collection.objects.link(sun)
    fill = bpy.data.objects.new('fill', bpy.data.lights.new('fill', 'SUN'))
    fill.data.energy = 1.0
    fill.data.color = (.8, .88, 1)
    fill.rotation_euler = (math.radians(75), 0, math.radians(-70))
    sc.collection.objects.link(fill)
    cam = bpy.data.cameras.new('cam')
    cam_ob = bpy.data.objects.new('cam', cam)
    sc.collection.objects.link(cam_ob)
    sc.camera = cam_ob
    guns = [o for o in sc.objects if o.name in ALL_IDS]
    hide = {}
    for o in guns:
        hide[o.name] = [o] + list(o.children_recursive)
    # 標記球：紅=槍口、藍=彈匣、綠=原點（只畫在 markers 那張）
    markers = {}
    for name, col in (('muzzle', (1, .05, .03, 1)), ('mag', (.05, .2, 1, 1)), ('org', (.05, 1, .1, 1))):
        m = bpy.data.materials.new(name)
        m.use_nodes = True
        m.node_tree.nodes['Principled BSDF'].inputs['Emission Color'].default_value = col
        m.node_tree.nodes['Principled BSDF'].inputs['Emission Strength'].default_value = 4
        markers[name] = m

    def only(gid, marks):
        for k, lst in hide.items():
            for o in lst:
                o.hide_render = k != gid
        for o in list(sc.objects):
            if o.name.startswith('mk_'):
                bpy.data.objects.remove(o, do_unlink=True)
        if not marks:
            return
        g = bpy.data.objects[gid]
        L = max(g.dimensions)
        for tag, loc in (('muzzle', bpy.data.objects[gid + '_muzzle'].matrix_world.translation),
                         ('mag', bpy.data.objects[gid + '_mag'].matrix_world.translation),
                         ('org', Vector((0, 0, 0)))):
            bpy.ops.mesh.primitive_uv_sphere_add(radius=max(L * 0.012, 0.002), location=loc, segments=16, ring_count=8)
            o = bpy.context.active_object
            o.name = 'mk_' + tag
            o.data.materials.append(markers[tag])

    def frame(gid):
        g = bpy.data.objects[gid]
        cs = [g.matrix_world @ Vector(c) for c in g.bound_box]
        mn = Vector([min(c[i] for c in cs) for i in range(3)])
        mx = Vector([max(c[i] for c in cs) for i in range(3)])
        return mn, mx

    tmp = os.path.join(DIST, 'guns-sheet-tmp')
    shutil.rmtree(tmp, ignore_errors=True)
    os.makedirs(tmp)
    side, mark, close = [], [], []
    ids = [g for g in ALL_IDS if g in hide and (not only_ids or g in only_ids)]
    for gid in ids:
        mn, mx = frame(gid)
        c = (mn + mx) / 2
        size = mx - mn
        L = max(size)
        # 側視：相機在槍的左側（+X），槍口朝畫面左，與 ref/guns.jpg 相同
        cam.type = 'ORTHO'
        sc.render.resolution_x, sc.render.resolution_y = 720, 450
        cam.ortho_scale = max(size.y * 1.08, size.z * 1.08 * 1.6)
        cam.clip_start, cam.clip_end = L * 0.01, L * 8
        cam_ob.location = c + Vector((L * 3, 0, 0))
        cam_ob.rotation_euler = Vector((1, 0, 0)).to_track_quat('Z', 'Y').to_euler()
        only(gid, False)
        sc.render.filepath = f'{tmp}/{gid}_side.png'
        bpy.ops.render.render(write_still=True)
        side.append(sc.render.filepath)
        only(gid, True)
        sc.cycles.samples = 16
        sc.render.filepath = f'{tmp}/{gid}_mark.png'
        bpy.ops.render.render(write_still=True)
        mark.append(sc.render.filepath)
        sc.cycles.samples = 32
        only(gid, False)
        # 近拍：第一人稱看得到的那一面（後上方偏右，看得到拋殼口）
        cam.type = 'PERSP'
        cam.lens = 35
        d = Vector((-0.55, 0.75, 0.42)).normalized()
        tgt = Vector((0, c.y + size.y * 0.14, mx.z - size.z * 0.38))
        dist = max(0.16, size.y * 0.42)
        cam_ob.location = tgt + d * dist
        cam_ob.rotation_euler = d.to_track_quat('Z', 'Y').to_euler()
        cam.clip_start, cam.clip_end = 0.01, 10
        sc.render.filepath = f'{tmp}/{gid}_close.png'
        bpy.ops.render.render(write_still=True)
        close.append(sc.render.filepath)
    if only_ids:
        tile(side + close + mark, max(2, len(ids)), 480, 300, os.path.join(DIST, 'guns-sheet-partial.png'))
    else:
        tile(side + close, 4, 480, 300, SHEET)
        tile(mark, 4, 480, 300, os.path.join(DIST, 'guns-markers.png'))
    log('sheet 完成')



def main():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    only = None
    if '--only' in argv:
        only = argv[argv.index('--only') + 1].split(',')
    pack_only = '--pack' in argv
    sheet_only = '--sheet' in argv
    os.makedirs(CACHE, exist_ok=True)
    if not pack_only and not sheet_only:
        for gid, cfg in GUNS.items():
            if only and gid not in only:
                continue
            build_source(gid, cfg)
        if not only or 'knife' in only:
            build_knife()
        if not only or 'charge' in only:
            build_charge()
    if not sheet_only:
        pack()
    if sheet_only or '--no-sheet' not in argv:
        sheet(only)


main()
