# 霓虹夜城（260）外緣山林的近景樹：程式長出來的冷杉與楓樹（樹幹、一輪輪的枝、枝上的葉片卡），葉片卡貼 tools/forest-tex.mjs 合成的帶 alpha 貼圖
# （冷杉是 Poly Haven fir_tree_01 的枝葉照片，楓樹是 SVG 畫的楓葉叢）。匯出到 gitignore 的 .cache/forest/forest.glb，
# 再由 tools/props.mjs 的 nat_forest 組壓成 assets/260/props/nat_forest.glb（http 才下載；遠景與檔案開啟時是 hill_homes.py 的 fir_lo／maple_lo）。
# 執行：node tools/forest-tex.mjs，然後 /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P blender/forest.py
# 慣例：1 單位 = 1 公尺，原點在樹幹底面中心。葉片卡兩面各一份幾何（不靠雙面材質）：法線照樹冠往外（不是卡片本身的法線），整叢受光才有體積。
import math, os, random, sys
import bpy
from mathutils import Vector, Matrix
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import reset

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, '..'))
TEX = os.path.join(ROOT, '.cache', 'forest')
PH = os.path.join(ROOT, '.cache', 'tex-src', 'ph')
UP = Vector((0, 0, 1))

reset()


def tmat(name, img, clip=False, rough=0.85):   # 貼圖材質：clip＝葉片卡（alpha 遮罩，glTF 的 MASK）
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; b = nt.nodes.get('Principled BSDF')
    t = nt.nodes.new('ShaderNodeTexImage'); t.image = bpy.data.images.load(img)
    nt.links.new(t.outputs['Color'], b.inputs['Base Color'])
    if clip:
        nt.links.new(t.outputs['Alpha'], b.inputs['Alpha'])   # 匯出成 BLEND 也沒關係：props.mjs 的 mask 一律改成 MASK
    b.inputs['Roughness'].default_value = rough; b.inputs['Metallic'].default_value = 0.0
    m.use_backface_culling = True
    return m


class MB:   # 頂點、面、每個角的 UV 與法線（自訂法線），一個物件
    def __init__(s): s.v, s.f, s.uv, s.no, s.mi = [], [], [], [], []

    def face(s, pts, uvs, mi, nos=None):
        i0 = len(s.v); s.v += [tuple(p) for p in pts]; s.f.append(list(range(i0, i0 + len(pts))))
        s.uv += [tuple(u) for u in uvs]; s.mi.append(mi)
        if nos is None:
            n = (Vector(pts[1]) - Vector(pts[0])).cross(Vector(pts[2]) - Vector(pts[0])).normalized(); nos = [n] * len(pts)
        s.no += [tuple(n) for n in nos]

    def tube(s, path, radii, sides, mi, vk=1.0):   # 沿折線的錐管（樹幹、枝），u 繞一圈、v 照長度（貼圖重複）
        rings, L = [], 0.0
        for i, p in enumerate(path):
            d = (path[min(i + 1, len(path) - 1)] - path[max(i - 1, 0)]).normalized()
            a = (UP if abs(d.z) < 0.95 else Vector((1, 0, 0))).cross(d).normalized(); b = d.cross(a)
            if i: L += (p - path[i - 1]).length
            rings.append([(p + (a * math.cos(t) + b * math.sin(t)) * radii[i], (a * math.cos(t) + b * math.sin(t)), L) for t in (2 * math.pi * k / sides for k in range(sides + 1))])
        circ = 2 * math.pi * max(radii[0], 0.05)
        for i in range(len(path) - 1):
            for k in range(sides):
                q = [rings[i][k], rings[i][k + 1], rings[i + 1][k + 1], rings[i + 1][k]]
                us = [k / sides * vk, (k + 1) / sides * vk, (k + 1) / sides * vk, k / sides * vk]
                s.face([c[0] for c in q], [(us[j], q[j][2] / circ * vk) for j in range(4)], mi, [c[1] for c in q])

    def card(s, base, along, across, L, W, reg, mi, nrm):   # 葉片卡：base 是卡底中點，along 朝卡頂；reg = (u0, u1, v0, v1) 圖上比例（v 由上往下，卡底在 v1）
        u0, u1, v0, v1 = reg
        p = [base - across * (W / 2), base + across * (W / 2), base + across * (W / 2) + along * L, base - across * (W / 2) + along * L]
        uv = [(u0, 1 - v1), (u1, 1 - v1), (u1, 1 - v0), (u0, 1 - v0)]
        ns = [nrm(q) for q in p]
        s.face(p, uv, mi, ns)
        s.face([p[0], p[3], p[2], p[1]], [uv[0], uv[3], uv[2], uv[1]], mi, [ns[0], ns[3], ns[2], ns[1]])   # 背面

    def build(s, name, mats, ao=None):   # ao(位置) → 0..1：樹冠的遮蔽（裡面、下面暗），烘成頂點色（props.mjs 的 vcol 乘進底色）
        me = bpy.data.meshes.new(name); me.from_pydata(s.v, [], s.f)
        if ao:
            ca = me.color_attributes.new('ao', 'FLOAT_COLOR', 'CORNER'); me.color_attributes.active_color = ca
            for i, lp in enumerate(me.loops): a = ao(Vector(s.v[lp.vertex_index])); ca.data[i].color = (a, a, a, 1.0)
        uvl = me.uv_layers.new(name='UVMap')
        for i, lp in enumerate(me.loops): uvl.data[i].uv = s.uv[lp.vertex_index]
        for m in mats: me.materials.append(m)
        for i, p in enumerate(me.polygons): p.material_index = s.mi[i]; p.use_smooth = True
        me.normals_split_custom_set([s.no[lp.vertex_index] for lp in me.loops])
        o = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(o)
        print(f'{name}: {sum(len(f) - 2 for f in s.f)} tris')
        return o


def sdir(az, pitch):
    return Vector((math.cos(az) * math.cos(pitch), math.sin(az) * math.cos(pitch), math.sin(pitch)))


# ─── 冷杉：直的樹幹、底部根張；2 m 以上每 0.45 m 一輪 5～7 枝，越下面越長、越往下垂，枝上左右交錯斜出的枝葉卡，枝端一張順著枝；樹頂直立的頂芽 ───
# fir_tree_01_twig 圖上四片大的枝葉（u0, u1, v0, v1；枝的基部在下緣、梢在上緣）
FIR_REG = [(.31, .645, .39, .77), (.635, .957, .45, .83), (.19, .42, .04, .31), (.655, .94, .04, .37)]


def fir(H=17.0, seed=3):
    rng = random.Random(seed); mb = MB()
    zs = [H * k / 12 for k in range(13)]
    rad = [0.30 * (1 - z / H) ** 1.1 + 0.025 + (0.14 * (1 - z / 0.8) ** 2 if z < 0.8 else 0) for z in zs]
    mb.tube([Vector((0, 0, z)) for z in zs], rad, 10, 0, vk=2.0)
    z = 1.9
    while z < H - 0.6:
        t = z / H; n = rng.randint(5, 7); az0 = rng.random() * 6.283
        for i in range(n):
            az = az0 + i * 6.283 / n + (rng.random() - 0.5) * 0.5
            L = min(3.8, 0.35 + (H - z) * 0.29) * (0.85 + 0.3 * rng.random())
            pitch = -0.08 - 0.42 * (1 - t) ** 1.5 + (rng.random() - 0.5) * 0.12
            r0 = 0.30 * (1 - t) ** 1.1 + 0.02
            p0 = Vector((math.cos(az) * r0 * 0.6, math.sin(az) * r0 * 0.6, z))
            p1 = p0 + sdir(az, pitch) * (L * 0.55); p2 = p1 + sdir(az, pitch - 0.22 * (1 - t)) * (L * 0.45)
            br = 0.014 + 0.022 * L / 4.6
            mb.tube([p0, p1, p2], [br, br * 0.55, 0.008], 3, 0, vk=0.5)
            # 整段枝條卡（tools/forest-tex.mjs 的 fir_branch）：順著枝，兩張繞枝軸各轉 ±28° 成 V 字（平放的卡從側面看會不見）；長枝再加一張平的
            al = (p2 - p0).normalized(); flat = al.cross(UP).normalized()
            Lc = L * 1.08; W = Lc * 0.86
            for rot in ((-0.5, 0.5) if L < 2.4 else (-0.5, 0.0, 0.5)):
                ac = (flat * math.cos(rot) + al.cross(flat).normalized() * math.sin(rot)).normalized()
                mb.card(p0 + al * 0.05, al, ac, Lc, W, (0, 1, 0, 1), 1, lambda q: fir_n(q, H))
        z += 0.42 + 0.08 * rng.random()
    # 頂芽：三張直立的卡交錯
    for k in range(3):
        a = k * 1.047; ac = Vector((math.cos(a), math.sin(a), 0))
        mb.card(Vector((0, 0, H - 2.2)), UP, ac, 2.6, 2.2, (0, 1, 0, 1), 1, lambda q: fir_n(q, H))
    def ao(q):   # 離樹軸的距離 ÷ 那個高度的樹冠半徑（外圈亮、貼著樹幹暗），越下面越暗
        cr = max(0.4, min(3.8, 0.35 + (H - q.z) * 0.29) * 1.05)
        return 0.22 + 0.78 * min(1.0, math.hypot(q.x, q.y) / cr) ** 0.9 * (0.55 + 0.45 * min(1.0, q.z / H))
    return mb.build('fir', [M['fir_bark'], M['fir_twig']], ao)


def fir_n(q, H):   # 冷杉葉片的法線：離樹軸往外＋往上（圓錐的表面）
    r = Vector((q.x, q.y, 0)); r = r.normalized() if r.length > 1e-4 else Vector((1, 0, 0))
    return (r + UP * 0.75).normalized()


# ─── 松（使用者：冷杉遠看都是同一個輪廓；pine_tree_01 的小枝照片）：日本山上的赤松那種——樹幹往一側微彎、下半截的枝自然枯落只剩幾根斷枝，
# 樹冠集中在上面四成：一層層 2～3 枝往外平伸再往上翹，枝上與枝端一團團刷子狀的針葉叢（tools/forest-tex.mjs 的 pine_branch，每團三張交錯＋一張平放），頂平而不規則 ───
def pine(H=15.0, seed=5):
    rng = random.Random(seed); mb = MB(); zc = H * 0.5
    zs = [H * k / 9 for k in range(10)]
    ax = lambda z: Vector((0.6 * math.sin(z / H * 2.2) * (z / H), 0.3 * math.sin(z / H * 3.1 + 0.5) * (z / H), z))   # 樹幹的中心線（S 形微彎）
    rad = [0.28 * (1 - z / H) ** 0.9 + 0.035 + (0.12 * (1 - z / 0.7) ** 2 if z < 0.7 else 0) for z in zs]
    mb.tube([ax(z) for z in zs], rad, 10, 0, vk=2.0)
    for i in range(7):   # 下段的斷枝
        z = 2.4 + rng.random() * (zc - 3.0); a = rng.random() * 6.283; p0 = ax(z)
        mb.tube([p0, p0 + sdir(a, -0.1 - 0.3 * rng.random()) * (0.3 + 0.6 * rng.random())], [0.035, 0.012], 4, 0, vk=0.5)
    C = ax(H * 0.82); clumps = []
    z, az = zc, rng.random() * 6.283
    while z < H - 0.8:
        t = (z - zc) / (H - zc); L = (1.2 + 3.2 * math.sin(math.pi * min(1.0, 0.3 + t * 0.8))) * (0.75 + 0.45 * rng.random())   # 中段最長、頂上收
        nb = rng.randint(3, 4)
        for i in range(nb):
            a = az + i * 6.283 / nb + (rng.random() - 0.5) * 0.8; pitch = 0.12 + 0.3 * t + (rng.random() - 0.5) * 0.2
            p0 = ax(z); p1 = p0 + sdir(a, pitch) * (L * 0.55); p2 = p1 + sdir(a + (rng.random() - 0.5) * 0.5, pitch + 0.4) * (L * 0.45)
            br = 0.03 + 0.03 * L / 4
            mb.tube([p0, p1, p2], [br, br * 0.6, 0.012], 5, 0, vk=0.6)
            clumps += [(p2, a), (p1.lerp(p2, 0.35), a), (p0.lerp(p1, 0.6), a)] + ([(p1, a)] if L > 2.4 else [])
        z += 0.55 + 0.4 * rng.random(); az += 2.4
    clumps += [(ax(H - 0.6), rng.random() * 6.283), (ax(H - 1.1) + Vector((0.4, -0.2, 0)), rng.random() * 6.283)]   # 樹頂
    nrm = lambda q: ((q - C) * Vector((1, 1, 1.6)) + UP * 0.5).normalized()
    for q, a in clumps:
        S = 1.7 + 0.8 * rng.random(); out = Vector((math.cos(a), math.sin(a), 0))
        al = (out * 0.45 + UP * 0.85 + Vector(((rng.random() - 0.5) * 0.4, (rng.random() - 0.5) * 0.4, 0))).normalized()
        a1 = al.cross(Vector((rng.random() - 0.5, rng.random() - 0.5, rng.random() - 0.5))).normalized(); a2 = al.cross(a1).normalized()
        for ac in (a1, (a1 + a2).normalized(), (a2 - a1).normalized()): mb.card(q - al * (S * 0.2), al, ac, S, S, (0, 1, 0, 1), 1, nrm)
        side = Vector((-out.y, out.x, 0)); mb.card(q - out * (S * 0.35) + UP * 0.15, (out + UP * 0.25).normalized(), side, S * 1.1, S, (0, 1, 0, 1), 1, nrm)   # 平放的一張：從上面看不是空的
    print(f'pine clumps: {len(clumps)}')
    ao = lambda q: 0.25 + 0.75 * min(1.0, ((q - C) * Vector((1, 1, 1.4))).length / 3.6) ** 1.1 * (0.6 + 0.4 * min(1.0, q.z / H))
    return mb.build('pine', [M['fir_bark'], M['pine_twig']], ao)


# ─── 楓樹：樹幹 2.6 m 後分成 3～4 枝主幹，每枝再分三次（越分越細、往外往上開），第二層以上的枝段中點與末端掛楓葉叢卡（兩張十字交叉） ───
# broad：榛嶺的綠色闊葉樹（雜木林）用同一套枝架，樹冠寬一點（cr）、葉叢卡大一點、每點三張（樹冠比楓樹密）
def maple(H=11.0, seed=11, name='maple', leaf='maple_leaf', cr=4.2, S0=1.25, Sv=0.5, ncard=2):
    rng = random.Random(seed); mb = MB(); C = Vector((0, 0, H * 0.62))   # 樹冠中心（葉片法線從這裡往外）
    nrm = lambda q: ((q - C) * Vector((1, 1, 1.35)) + UP * 0.6).normalized()
    leaves = []

    def branch(p, d, L, r, lvl):
        q1 = p + d * (L * 0.5) + Vector(((rng.random() - 0.5) * 0.3 * L, (rng.random() - 0.5) * 0.3 * L, 0))
        d2 = (d + UP * 0.15 + Vector(((rng.random() - 0.5) * 0.4, (rng.random() - 0.5) * 0.4, 0))).normalized()
        q2 = q1 + d2 * (L * 0.5)
        mb.tube([p, q1, q2], [r, r * 0.82, r * 0.66], 7 if lvl < 2 else 4, 0, vk=1.0)
        if lvl >= 2: leaves.extend((p.lerp(q1, 0.5), q1, q1.lerp(q2, 0.5), q2))
        if lvl >= 4: return
        k = 3 if lvl < 3 else 2
        az0 = rng.random() * 6.283
        for i in range(k):   # 第一枝幾乎順著母枝往上長（頂端優勢，樹冠才是蛋形不是傘），其他往外開
            az = az0 + i * 6.283 / k + (rng.random() - 0.5) * 0.6
            spread = (0.12 + rng.random() * 0.15) if i == 0 else (0.5 if lvl == 1 else 0.7) + rng.random() * 0.25
            out = Vector((math.cos(az), math.sin(az), 0))
            nd = (d2 * math.cos(spread) + out * math.sin(spread)).normalized()
            if nd.z < 0.05: nd = (nd + UP * 0.3).normalized()
            branch(q2, nd, L * (0.68 + 0.12 * rng.random()), r * 0.62, lvl + 1)

    # 樹幹一路往上當中央主幹（到 0.8 H），2.8 m 以上每 0.45～0.6 m 照黃金角長一枝側枝，長度照蛋形樹冠（中心 C、橫半徑 4.2、縱半徑 0.42 H）在那個高度的半徑
    top = H * 0.8; zs = [0, 0.5, 2.6, top * 0.6, top]
    path = [Vector((0.06 * math.sin(z * 1.3), 0.05 * math.cos(z * 0.9), z)) for z in zs]
    mb.tube(path, [0.36, 0.25, 0.21, 0.13, 0.05], 9, 0, vk=1.5)
    z, az, k = 2.8, rng.random() * 6.283, 0
    while z < top - 0.4:
        e = (z - C.z) / (H * 0.42); L = cr * math.sqrt(max(0.05, 1 - e * e)) * (0.85 + 0.25 * rng.random())
        f = z / top; r = 0.13 * (1 - f) + 0.05 + 0.02
        pitch = 0.75 - 0.5 * f   # 下面的側枝平一點，上面的往上翹
        d = (Vector((math.cos(az), math.sin(az), 0)) * math.cos(pitch) + UP * math.sin(pitch)).normalized()
        branch(Vector((0.06 * math.sin(z * 1.3), 0.05 * math.cos(z * 0.9), z)), d, L * 0.6, r * 0.7, 2)
        z += 0.45 + 0.15 * rng.random(); az += 2.4 + (rng.random() - 0.5) * 0.4; k += 1
    branch(path[-1], UP, 1.6, 0.05, 3)
    # 葉叢：每個點兩張十字交叉的卡，卡底在枝上、朝外往上
    for q in leaves:
        out = (q - C) * Vector((1, 1, 0.6)); out = out.normalized() if out.length > 1e-3 else UP
        al = (out * 0.6 + UP * 0.5 + Vector(((rng.random() - 0.5) * 0.6, (rng.random() - 0.5) * 0.6, (rng.random() - 0.5) * 0.4))).normalized()
        a1 = al.cross(Vector((rng.random() - 0.5, rng.random() - 0.5, rng.random() - 0.5))).normalized(); a2 = al.cross(a1).normalized()
        S = S0 + Sv * rng.random()
        acs = (a1, a2) if ncard == 2 else (a1, (a1 + a2).normalized(), (a2 - a1).normalized())
        for ac in acs: mb.card(q - al * (S * 0.15), al, ac, S, S, (0, 1, 0, 1), 1, nrm)
    print(f'{name} leaves: {len(leaves)} clusters')
    ao = lambda q: 0.3 + 0.7 * min(1.0, ((q - C) * Vector((1, 1, 1.15))).length / (cr + 0.4)) ** 1.2 * (0.7 + 0.3 * min(1.0, q.z / H))
    return mb.build(name, [M['maple_bark'], M[leaf]], ao)


# ─── 林下層（每片幾平方公尺，拼好整片做實例）：蕨是 Poly Haven fern_02 的葉片照片彎成一圈拱出去的蕨叢；紫色野花叢與草叢是 forest-tex.mjs 畫的卡，
# 三張繞垂直軸 60° 交錯。原檔的蕨、蔓長春花、草叢模型一株只有 0.2–0.4 m、葉子稀，遊戲的距離看不出來，所以只借照片 ───
FERN_REG = [(.1, .24, .11, .95), (.32, .45, .03, .75), (.53, .66, .03, .49), (.51, .63, .51, .96), (.72, .84, .11, .89)]   # fern_02 圖上五片葉（葉柄在下緣）


def fern(mb, cx, cy, s, rng, mi):   # 一叢蕨：10–13 片葉從中心拱出去再垂下（每片切三段彎折），法線朝上偏外
    n = rng.randint(10, 13)
    for i in range(n):
        az = i * 6.283 / n + (rng.random() - 0.5) * 0.4; reg = FERN_REG[rng.randrange(5)]
        L = s * (0.8 + 0.5 * rng.random()); W = L * (reg[1] - reg[0]) / (reg[3] - reg[2]) * 1.6
        out = Vector((math.cos(az), math.sin(az), 0)); side = UP.cross(out)
        e0 = 1.05 + 0.25 * rng.random()   # 起始仰角（從水平量）
        pts = [Vector((cx, cy, 0.02))]
        for k in range(1, 4):
            e = e0 - k * 0.55; pts.append(pts[-1] + (out * math.cos(e) + UP * math.sin(e)) * (L / 3))
        u0, u1, v0, v1 = reg
        for k in range(3):
            a0, a1 = pts[k], pts[k + 1]; t0, t1 = k / 3, (k + 1) / 3
            w0, w1 = W * (0.35 + 0.65 * min(1, t0 * 3)), W * (0.35 + 0.65 * min(1, t1 * 3))
            q = [a0 - side * w0 / 2, a0 + side * w0 / 2, a1 + side * w1 / 2, a1 - side * w1 / 2]
            uv = [(u0, 1 - (v1 - t0 * (v1 - v0))), (u1, 1 - (v1 - t0 * (v1 - v0))), (u1, 1 - (v1 - t1 * (v1 - v0))), (u0, 1 - (v1 - t1 * (v1 - v0)))]
            nr = (UP + out * 0.4).normalized()
            mb.face(q, uv, mi, [nr] * 4); mb.face([q[0], q[3], q[2], q[1]], [uv[0], uv[3], uv[2], uv[1]], mi, [nr] * 4)


def xcards(mb, cx, cy, h, w, rng, mi):   # 三張交錯的直立卡（卡的下緣在地面）
    a0 = rng.random() * 3.14
    for k in range(3):
        a = a0 + k * 1.047; ac = Vector((math.cos(a), math.sin(a), 0)); tilt = (UP + Vector((rng.random() - 0.5, rng.random() - 0.5, 0)) * 0.25).normalized()
        mb.card(Vector((cx, cy, -0.05)), tilt, ac, h, w, (0, 1, 0, 1), mi, lambda q: (UP * 0.8 + (q - Vector((cx, cy, q.z))) * 0.6).normalized() if (q - Vector((cx, cy, q.z))).length > 1e-3 else UP)


def understory(name, kind, seed):
    rng = random.Random(seed); mb = MB()
    def spots(n, R):
        return [(math.cos(a) * r, math.sin(a) * r) for a, r in ((rng.random() * 6.283, R * math.sqrt(rng.random())) for _ in range(n))]
    if kind == 'fern':
        for x, y in spots(5, 1.5): fern(mb, x, y, 0.85 + 0.45 * rng.random(), rng, 0)
        for x, y in spots(8, 1.9): xcards(mb, x, y, 0.55 + 0.3 * rng.random(), 0.7, rng, 1)
        mats = [M['fern_leaf'], M['grass_leaf']]
    elif kind == 'flower':
        for x, y in spots(14, 1.5): xcards(mb, x, y, 0.6 + 0.35 * rng.random(), 0.75, rng, 0)
        for x, y in spots(7, 1.7): xcards(mb, x, y, 0.5 + 0.25 * rng.random(), 0.7, rng, 1)
        mats = [M['flower_leaf'], M['grass_leaf']]
    else:
        for x, y in spots(18, 1.8): xcards(mb, x, y, 0.5 + 0.45 * rng.random(), 0.75, rng, 0)
        mats = [M['grass_leaf']]
    return mb.build(name, mats, lambda q: 0.45 + 0.55 * min(1.0, q.z / 0.7))   # 林下層：貼地的部分暗


M = {
    'fir_bark': tmat('fir_bark', os.path.join(PH, 'pine_bark', 'pine_bark_diff_1k.jpg'), rough=0.95),
    'fir_twig': tmat('fir_twig', os.path.join(TEX, 'fir_branch.png'), clip=True),
    'maple_bark': tmat('maple_bark', os.path.join(PH, 'trident_maple_bark', 'trident_maple_bark_diff_1k.jpg'), rough=0.9),
    'maple_leaf': tmat('maple_leaf', os.path.join(TEX, 'maple_leaves.png'), clip=True, rough=0.7),
    'broad_leaf': tmat('broad_leaf', os.path.join(TEX, 'broad_leaves.png'), clip=True, rough=0.75),
    'pine_twig': tmat('pine_twig', os.path.join(TEX, 'pine_branch.png'), clip=True, rough=0.8),
    'fern_leaf': tmat('fern_leaf', os.path.join(TEX, 'fern.png'), clip=True, rough=0.8),
    'flower_leaf': tmat('flower_leaf', os.path.join(TEX, 'flowers.png'), clip=True, rough=0.8),
    'grass_leaf': tmat('grass_leaf', os.path.join(TEX, 'grass_tuft.png'), clip=True, rough=0.85),
}
fir().location = (0, 0, 0)
maple().location = (12, 0, 0)
maple(H=12.5, seed=23, name='broad', leaf='broad_leaf', cr=5.0, S0=1.6, Sv=0.7, ncard=3).location = (60, 0, 0)
pine().location = (70, 0, 0)
understory('fern_patch', 'fern', 61).location = (30, 0, 0)
understory('flower_patch', 'flower', 62).location = (40, 0, 0)
understory('grass_patch', 'grass', 63).location = (50, 0, 0)
out = os.path.join(ROOT, '.cache', 'forest', 'forest.glb')
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_yup=True, export_apply=False, export_cameras=False, export_lights=False,
                          export_texcoords=True, export_normals=True, export_materials='EXPORT', export_image_format='AUTO', export_vertex_color='ACTIVE')
print(f'ok  {out}  {os.path.getsize(out) / 1024:.0f} KB')
