# 植物：有枝幹的行道樹（樹冠由多團葉片卡組成，法線從樹冠中心往外）、灌木、花、草叢。
import bpy, math, random
from mathutils import Vector
from kit_common import Acc, mat, leaf_mat, grass_mat, prim_sphere, coll, PAL, srgb

def _rand_unit(rng):
    while True:
        v = Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), rng.uniform(-1, 1)))
        if 0.05 < v.length <= 1: return v.normalized()

def _leaf_cards(acc, center, radius, n, size, rng, squash=0.85, up_bias=0.25):
    for _ in range(n):
        d = _rand_unit(rng); d.z = d.z * squash + up_bias * rng.random()
        d.normalize()
        p = center + Vector((d.x * radius, d.y * radius, d.z * radius * squash)) * (0.75 + 0.3 * rng.random())
        nrm = (d + _rand_unit(rng) * 0.7).normalized()
        t1 = nrm.cross(Vector((0, 0, 1)))
        if t1.length < 1e-3: t1 = Vector((1, 0, 0))
        t1.normalize(); t2 = nrm.cross(t1).normalized()
        s = size * (0.7 + 0.6 * rng.random()); a = rng.random() * math.tau
        u = t1 * math.cos(a) + t2 * math.sin(a); v = nrm.cross(u).normalized()
        acc.quad(p - u * s / 2 - v * s / 2, p + u * s / 2 - v * s / 2, p + u * s / 2 + v * s / 2, p - u * s / 2 + v * s / 2)

def tree(name, base, rng, height=7.0, crown=3.0, leaf='leaf2', clumps=11, cards=150, lean=0.0):
    """行道樹：微彎的錐狀樹幹、4–6 根主枝通往樹冠團塊；每團 = 深色內核 + 一圈葉片卡。"""
    base = Vector(base); C = coll('trees')
    bark = Acc(rng.randint(0, 1 << 30))
    trunk_h = height - crown * 1.25
    pts = [base]; r = [0.2 * height / 7]
    for k in range(1, 5):
        t = k / 4
        pts.append(base + Vector((math.sin(t * 2.1 + lean) * 0.18, math.cos(t * 1.7) * 0.12, trunk_h * t)))
        r.append(r[0] * (1 - 0.35 * t))
    for k in range(4): bark.tube(pts[k], pts[k + 1], r[k], r[k + 1], n=10)
    bark.tube(base + Vector((0, 0, -0.05)), base + Vector((0, 0, 0.35)), r[0] * 1.35, r[0], n=10)   # 根部外擴
    top = pts[-1]
    cc = base + Vector((0, 0, height - crown * 0.85))
    centers = []
    for i in range(clumps):
        d = _rand_unit(rng); d.z = abs(d.z) * 0.6 + 0.1 if i < clumps - 2 else 0.9
        centers.append(cc + Vector((d.x * crown * 0.95, d.y * crown * 0.95, d.z * crown * 0.6)))
    for c in centers:   # 主枝與分枝
        mid = top.lerp(c, 0.55) + Vector((0, 0, 0.3))
        bark.tube(top, mid, r[-1] * 0.8, r[-1] * 0.45, n=6); bark.tube(mid, c, r[-1] * 0.45, r[-1] * 0.18, n=5)
    bark.obj(f'{name}_bark', mat('bark', var=0.1, brush=0.35, rough=0.95, grime=0.0), coll=C, smooth=True)
    leaves = Acc(rng.randint(0, 1 << 30))
    for c in centers:
        rad = rng.uniform(1.0, 1.45) * crown / 3.0
        prim_sphere(f'{name}_core', c, rad * 0.62, mat('leafDark', var=0.0, brush=0.4, grime=0.0), (1, 1, 0.82), 2, C, displace=0.3)
        _leaf_cards(leaves, c - cc, rad, cards * 3, 0.26 * crown / 3.0, rng)
    ob = leaves.obj(f'{name}_leaves', leaf_mat(leaf), loc=cc, coll=C)
    return ob

def bush(name, base, rng, r=0.6, leaf='leaf1', flowers=None):
    base = Vector(base); C = coll('trees')
    c = base + Vector((0, 0, r * 0.7))
    prim_sphere(f'{name}_core', c, r * 0.85, mat('leafDark', var=0.0, brush=0.4, grime=0.0), (1.1, 1.1, 0.8), 2, C, displace=0.18)
    leaves = Acc(rng.randint(0, 1 << 30))
    _leaf_cards(leaves, Vector((0, 0, 0)), r, int(260 * r + 60), 0.16, rng, 0.8, 0.1)
    leaves.obj(f'{name}_leaves', leaf_mat(leaf), loc=c, coll=C)
    if flowers:
        fl = Acc(rng.randint(0, 1 << 30))
        for _ in range(int(40 * r)):
            d = _rand_unit(rng); d.z = abs(d.z)
            p = c + d * r * 0.95
            fl.box(p, (0.07, 0.07, 0.05), (rng.random(), rng.random(), 0))
        fl.obj(f'{name}_fl', mat(flowers, var=0.2, brush=0.1, grime=0.0), coll=C)

def flower_bed(name, x0, x1, y0, y1, rng, colors=('flowerPink', 'flowerWhite', 'flowerYellow')):
    C = coll('trees')
    a = Acc(rng.randint(0, 1 << 30)); a.box(((x0 + x1) / 2, (y0 + y1) / 2, 0.11), (abs(x1 - x0), abs(y1 - y0), 0.06))
    a.obj(f'{name}_mulch', mat('mulch', var=0.2, brush=0.5, grime=0.0), coll=C)
    for ci, col in enumerate(colors):
        fl = Acc(rng.randint(0, 1 << 30)); st = Acc(rng.randint(0, 1 << 30))
        for _ in range(int(abs(x1 - x0) * abs(y1 - y0) * 18)):
            p = Vector((rng.uniform(x0, x1), rng.uniform(y0, y1), 0.14)); h = rng.uniform(0.15, 0.4)
            st.tube(p, p + Vector((0, 0, h)), 0.008, n=4)
            fl.box(p + Vector((0, 0, h)), (0.06, 0.06, 0.04), (0, 0, rng.random()))
        fl.obj(f'{name}_f{ci}', mat(col, var=0.2, brush=0.1, grime=0.0), coll=C)
        st.obj(f'{name}_s{ci}', mat('leaf1', var=0.1, grime=0.0), coll=C)

def grass_tufts(name, points, rng, h=(0.12, 0.3)):
    """草叢：每叢 3–5 片三角草葉，用在柵欄邊、步道縫、樹根旁，打破地面的平整感。"""
    a = Acc(rng.randint(0, 1 << 30))
    for p in points:
        p = Vector(p)
        for _ in range(rng.randint(3, 5)):
            ang = rng.random() * math.tau; hh = rng.uniform(*h); w = rng.uniform(0.05, 0.09)
            u = Vector((math.cos(ang), math.sin(ang), 0)) * w / 2
            tip = Vector((math.cos(ang + 1.3), math.sin(ang + 1.3), 0)) * rng.uniform(0.02, 0.08)
            q = p + Vector((rng.uniform(-0.05, 0.05), rng.uniform(-0.05, 0.05), 0))
            a.quad(q - u, q + u, q + u + tip + Vector((0, 0, hh)), q - u + tip + Vector((0, 0, hh)))
    return a.obj(name, grass_mat(), coll=coll('grass'))
