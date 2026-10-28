# 街道與道具：柏油路（裂縫、補丁、人孔蓋、排水格柵）、路邊溝與路緣、植栽帶、一塊塊人行道板、
# 尖頭白柵欄（含門柱與半開的門）、隧道形信箱（訂戶：白箱＋紅旗立起＋黃色報紙筒）、路燈、消防栓、
# 有輪垃圾桶、擺動式灑水器、轎車、狗（skin modifier）。
import bpy, math, random
from mathutils import Vector
from kit_common import Acc, mat, ground_mat, glass_mat, ST, PAL, srgb, coll, parent_all, skin_mesh, prim_sphere
import kit_nature as KN

def street(y0, y1, rng, driveways=()):
    C = coll('street'); L = y1 - y0; cy = (y0 + y1) / 2; rh = ST['roadHalf']
    a = Acc(1); a.box((0, cy, -0.05), (rh * 2, L, 0.1)); a.obj('road', ground_mat('asphalt', cracks=True, scale=0.35), coll=C)
    # 補丁與油漬
    p = Acc(2)
    for _ in range(int(L / 9)):
        p.box((rng.uniform(-rh + 0.6, rh - 0.6), rng.uniform(y0, y1), 0.002), (rng.uniform(0.6, 1.8), rng.uniform(0.8, 3.0), 0.004))
    p.obj('patches', mat('asphaltDark', var=0.25, brush=0.4, rough=0.95, grime=0.0), coll=C)
    # 中線（磨損的黃色虛線）
    d = Acc(3); y = y0
    while y < y1:
        d.box((0, y + 1.5, 0.006), (0.12, 3.0, 0.008)); y += 7.5
    d.obj('lane', mat('lane', var=0.3, brush=0.8, rough=0.7, grime=0.0), coll=C)
    # 人孔蓋
    for k, y in enumerate(range(int(y0) + 11, int(y1), 37)):
        m = Acc(10 + k); m.tube(Vector((-1.2, y, -0.01)), Vector((-1.2, y, 0.012)), 0.38, n=20)
        m.obj(f'manhole{k}', mat('asphaltDark', color=srgb('#4a4744'), var=0.0, rough=0.6), coll=C)
    for s in (-1, 1):
        # 路邊溝（混凝土帶）＋ 路緣石（在車道口降低）
        g = Acc(20 + s); g.box((s * (rh - ST['gutter'] / 2), cy, 0.0), (ST['gutter'], L, 0.04))
        g.obj(f'gutter{s}', mat('concrete', var=0.1, brush=0.3, grime=0.1), coll=C)
        cb = Acc(30 + s); yy = y0
        while yy < y1:
            seg = 2.0
            low = any(abs(yy + seg / 2 - dy) < 1.8 and ds == s for ds, dy in driveways)
            h = 0.05 if low else ST['curb']
            cb.box((s * (rh + 0.08), yy + seg / 2, h / 2), (0.16, seg - 0.01, h + 0.02))
            yy += seg
        cb.obj(f'curb{s}', mat('concrete', var=0.12, brush=0.3, grime=0.3), coll=C, bevel=0.02)
        # 雨水格柵
        for k, y in enumerate(range(int(y0) + 23, int(y1), 41)):
            gr = Acc(40 + k)
            for i in range(7): gr.box((s * (rh - 0.2), y - 0.3 + i * 0.1, 0.03), (0.32, 0.04, 0.02))
            gr.obj(f'grate{s}{k}', mat('asphaltDark', color=srgb('#2a2a2a'), var=0.0, rough=0.5), coll=C)
        # 植栽帶與草坪底
        sw = ST['stripOut'] - rh - 0.16; sx = s * (rh + 0.16 + sw / 2)
        gs = Acc(50 + s); gs.box((sx, cy, 0.07), (sw, L, 0.14)); gs.obj(f'strip{s}', ground_mat('grass', scale=0.8), coll=C)
        # 人行道板
        ww = ST['walkOut'] - ST['stripOut']; wx = s * (ST['stripOut'] + ww / 2)
        base = Acc(60 + s); base.box((wx, cy, 0.06), (ww, L, 0.1)); base.obj(f'walkbase{s}', mat('soil', var=0.0), coll=C)
        sl = Acc(70 + s); yy = y0
        while yy < y1:
            ln = 1.5; dz = rng.uniform(-0.006, 0.01)
            sl.box((wx + rng.uniform(-0.01, 0.01), yy + ln / 2, 0.13 + dz), (ww - 0.04, ln - 0.025, 0.06), (rng.uniform(-0.006, 0.006), rng.uniform(-0.006, 0.006), rng.uniform(-0.004, 0.004)))
            yy += ln
        sl.obj(f'walk{s}', mat('concrete', var=0.22, brush=0.35, grime=0.15), coll=C, bevel=0.012)
        # 草從人行道縫冒出來
        tufts = []
        yy = y0
        while yy < y1:
            for _ in range(rng.randint(0, 3)): tufts.append((wx + rng.uniform(-ww / 2, ww / 2), yy, 0.12))
            for _ in range(rng.randint(2, 6)): tufts.append((s * (ST['stripOut'] - rng.uniform(0.0, 0.25)), yy + rng.uniform(0, 1.5), 0.14))
            for _ in range(rng.randint(1, 4)): tufts.append((s * (rh + 0.2 + rng.uniform(0, 0.15)), yy + rng.uniform(0, 1.5), 0.14))
            yy += 1.5
        KN.grass_tufts(f'walkgrass{s}', tufts, rng, (0.08, 0.2))
    # 車道（混凝土）
    for k, (s, dy) in enumerate(driveways):
        dw = Acc(80 + k); x0, x1 = rh + 0.16, ST['houseFront'] + 9
        dw.box((s * (x0 + x1) / 2, dy, 0.145), (x1 - x0, 3.2, 0.03))
        dw.obj(f'drive{k}', mat('concrete', var=0.08, brush=0.3, grime=0.35), coll=C)

def lawn(s, y0, y1):
    a = Acc(90 + s); x0, x1 = ST['walkOut'], ST['walkOut'] + 30
    a.box((s * (x0 + x1) / 2, (y0 + y1) / 2, 0.08), (x1 - x0, y1 - y0, 0.12))
    a.obj(f'lawn{s}_{int(y0)}', ground_mat('grass', stripes=True, scale=0.5), coll=coll('street'))

def fence(name, s, y0, y1, gate_y, rng, gate_open=0.9):
    """尖頭木樁 7.5 cm 寬、間距 15 cm；每 2.4 m 一根柱子（有柱帽）；兩道橫木在院子那側。"""
    a = Acc(rng.randint(0, 1 << 30)); fx = s * ST['fence']
    w, h, t = 0.075, 1.0, 0.022
    prof = [(-w / 2, 0.08), (w / 2, 0.08), (w / 2, h - 0.05), (0, h), (-w / 2, h - 0.05)]
    def picket(y, ox=0.0, oy=0.0, ang=0.0):
        a.poly_prism(prof, -t / 2, t / 2, lambda u, v, tt: Vector((fx + tt * s + ox + math.sin(ang) * u, y + math.cos(ang) * u + oy, v)))
    gap = 0.58
    y = y0
    while y <= y1:
        if abs(y - gate_y) > gap: picket(y)
        y += 0.15
    for yy in [y0 + k * 2.4 for k in range(int((y1 - y0) / 2.4) + 1)] + [gate_y - gap - 0.05, gate_y + gap + 0.05]:
        a.box((fx + s * 0.06, yy, 0.6), (0.1, 0.1, 1.2)); a.box((fx + s * 0.06, yy, 1.23), (0.14, 0.14, 0.05))
    for z in (0.3, 0.78):
        for aa, bb in ((y0, gate_y - gap), (gate_y + gap, y1)):
            if bb > aa: a.box((fx + s * 0.035, (aa + bb) / 2, z), (0.035, bb - aa, 0.08))
    # 門：繞著門柱轉開
    hinge = gate_y - gap
    for k in range(7):
        u = 0.08 + k * 0.15
        a.poly_prism(prof, -t / 2, t / 2, lambda uu, v, tt, u=u: Vector((fx + s * (math.sin(gate_open) * (u + uu)) + tt * s, hinge + math.cos(gate_open) * (u + uu), v)))
    return a.obj(name, mat('fence', var=0.08, brush=0.15, grime=0.45), coll=coll('props'))

def mailbox(name, x, y, s, subscriber, rng, vip=False):
    """隧道形信箱，門朝馬路。訂戶：白色箱、紅旗立起、下方黃色報紙筒；非訂戶：黑色箱、旗子放下。
    vip（每天一戶的金色信箱，送到加倍）：金色箱、柱上一塊深藍小木牌、旗子上加一顆金色圓點。"""
    a = Acc(rng.randint(0, 1 << 30)); b = Acc(rng.randint(0, 1 << 30)); f = Acc(rng.randint(0, 1 << 30)); tb = Acc(rng.randint(0, 1 << 30))
    a.box((x, y, 0.55), (0.1, 0.1, 1.1)); a.box((x + s * 0.12, y, 1.05), (0.42, 0.09, 0.07))   # 柱與托臂
    w, hb = 0.21, 0.12
    prof = [(-w / 2, 0), (w / 2, 0)] + [(w / 2 * math.cos(t), hb + w / 2 * math.sin(t)) for t in [i / 8 * math.pi for i in range(9)]] + [(-w / 2, 0)]
    prof = prof[:-1]
    b.poly_prism(prof, -0.25, 0.25, lambda u, v, t: Vector((x + s * 0.05 - t * s, y + u, 1.09 + v)))
    b.box((x - s * 0.205, y, 1.09 + 0.1), (0.02, w + 0.02, 0.23))       # 前門
    b.box((x - s * 0.225, y, 1.2), (0.03, 0.05, 0.03))
    if subscriber:
        f.box((x + s * 0.1, y + 0.125, 1.33), (0.025, 0.02, 0.36)); f.box((x + s * 0.02, y + 0.13, 1.47), (0.16, 0.015, 0.1))
        tb.tube(Vector((x - s * 0.22, y, 0.82)), Vector((x + s * 0.24, y, 0.82)), 0.075, n=12)
    else:
        f.box((x + s * 0.0, y + 0.125, 1.2), (0.3, 0.02, 0.025))
    C = coll('props')
    return [a.obj(f'{name}_post', mat('post', var=0.15, brush=0.4), coll=C),
            b.obj(f'{name}_box', mat('mailboxSub' if subscriber else 'mailbox', color=srgb('#e0a93a') if vip else None, var=0.05, brush=0.12, rough=0.35 if vip else 0.5), coll=C, bevel=0.01),
            f.obj(f'{name}_flag', mat('flag', var=0.0, rough=0.5), coll=C),
            tb.obj(f'{name}_tube', mat('tube', var=0.05, rough=0.5), coll=C) if subscriber else None] + (vip_sign(name, x, y, s) if vip else [])

def vip_sign(name, x, y, s):
    """金色信箱柱上的深藍小木牌＋旗上的金色圓點"""
    a = Acc(41); g = Acc(42); C = coll('props')
    a.box((x - s * 0.06, y, 0.72), (0.03, 0.26, 0.2)); a.box((x - s * 0.06, y, 0.72), (0.035, 0.22, 0.03))
    g.tube(Vector((x + s * 0.02, y + 0.12, 1.47)), Vector((x + s * 0.02, y + 0.145, 1.47)), 0.035, n=12)
    g.box((x - s * 0.08, y, 0.72), (0.012, 0.12, 0.12), (math.pi / 4, 0, 0))
    return [a.obj(f'{name}_sign', mat('post', color=srgb('#2f4c6e'), var=0.08, brush=0.3, rough=0.8), coll=C),
            g.obj(f'{name}_gold', mat('tube', color=srgb('#f2c14e'), var=0.0, rough=0.35), coll=C)]

def bundle(name, x, y, rng):
    """報紙補給包：六卷捲好的報紙疊成三角、中間一圈麻繩，下面墊一塊舊木板"""
    pa = Acc(51); bd = Acc(52); tw = Acc(53); wd = Acc(54); C = coll('props')
    wd.box((x, y, 0.03), (0.62, 0.42, 0.05))
    rows = [(-0.2, 0.1), (0.0, 0.1), (0.2, 0.1), (-0.1, 0.27), (0.1, 0.27), (0.0, 0.43)]
    for k, (dx, z) in enumerate(rows):
        a = Vector((x + dx, y - 0.17, z)); b = Vector((x + dx, y + 0.17, z))
        pa.tube(a, b, 0.085, n=12)
        bd.tube(Vector((x + dx, y - 0.03, z)), Vector((x + dx, y + 0.03, z)), 0.088, n=12)
    for yy in (-0.1, 0.1):
        pts = [(-0.31, 0.02), (-0.31, 0.2), (-0.2, 0.37), (0.0, 0.55), (0.2, 0.37), (0.31, 0.2), (0.31, 0.02)]
        for (u0, v0), (u1, v1) in zip(pts, pts[1:]):
            tw.tube(Vector((x + u0, y + yy, v0)), Vector((x + u1, y + yy, v1)), 0.012, n=6)
    return [pa.obj(f'{name}_p', mat('paper', var=0.06, brush=0.1, rough=0.85), coll=C, smooth=True),
            bd.obj(f'{name}_b', mat('band', var=0.0, rough=0.6), coll=C, smooth=True),
            tw.obj(f'{name}_t', mat('strap', color=srgb('#b99a63'), var=0.1, rough=0.95), coll=C, smooth=True),
            wd.obj(f'{name}_w', mat('post', color=srgb('#8b6a47'), var=0.2, brush=0.5, rough=0.95), coll=C)]

def ramp(name, x, y):
    """木頭跳台：長 1.7 m、寬 1.2 m、高 0.34 m；斜面是五條木板，兩端各一條黃黑警示漆，兩側三角板"""
    pl = Acc(61); sd = Acc(62); yl = Acc(63); bk = Acc(64); C = coll('props')
    L, W, H = 1.7, 1.2, 0.34
    ang = math.atan2(H, L)
    for k in range(5):
        u = -W / 2 + (k + 0.5) * W / 5
        pl.box((x + u, y, H / 2 + 0.01), (W / 5 - 0.02, math.hypot(L, H), 0.035), (ang, 0, 0))
    for e in (-1, 1):
        sd.poly_prism([(-L / 2, 0), (L / 2, 0), (L / 2, H)], e * W / 2 - 0.02 * e, e * W / 2 + 0.01 * e, lambda u, v, t: Vector((x + t, y + u, v)))
    for k in range(6):
        c = yl if k % 2 == 0 else bk
        u = -W / 2 + (k + 0.5) * W / 6
        c.box((x + u, y + L / 2 - 0.09, H - 0.01), (W / 6, 0.16, 0.045), (ang, 0, 0))
        c2 = bk if k % 2 == 0 else yl                                   # 低的一端（騎士那側）也一排，從後面就認得出是跳台
        c2.box((x + u, y - L / 2 + 0.16, 0.045), (W / 6, 0.2, 0.045), (ang, 0, 0))
    return [pl.obj(f'{name}_pl', mat('post', color=srgb('#b0844f'), var=0.25, brush=0.55, rough=0.9), coll=C),
            sd.obj(f'{name}_sd', mat('post', color=srgb('#8a6440'), var=0.15, brush=0.5, rough=0.9), coll=C),
            yl.obj(f'{name}_yl', mat('tube', color=srgb('#e8b730'), var=0.05, rough=0.6), coll=C),
            bk.obj(f'{name}_bk', mat('tire', color=srgb('#2b2b2e'), var=0.0, rough=0.7), coll=C)]

def lamp(name, x, y, dusk):
    s = 1 if x > 0 else -1; a = Acc(5); g = Acc(6); C = coll('props')
    a.tube(Vector((x, y, 0.1)), Vector((x, y, 0.6)), 0.12, 0.08, n=12)
    a.tube(Vector((x, y, 0.6)), Vector((x, y, 3.6)), 0.06, 0.05, n=10)
    a.box((x, y, 3.65), (0.32, 0.32, 0.06)); a.box((x, y, 4.25), (0.4, 0.4, 0.08)); a.tube(Vector((x, y, 4.29)), Vector((x, y, 4.45)), 0.12, 0.02, n=8)
    for dx, dy in ((-0.13, -0.13), (0.13, -0.13), (0.13, 0.13), (-0.13, 0.13)): a.box((x + dx, y + dy, 3.95), (0.03, 0.03, 0.55))
    g.box((x, y, 3.95), (0.24, 0.24, 0.5))
    out = [a.obj(f'{name}_pole', mat('lampPole', var=0.0, rough=0.4, grime=0.0), coll=C),
           g.obj(f'{name}_glass', mat('lampGlow', emit=9.0 if dusk else 0.0, var=0.0, rough=0.2, grime=0.0), coll=C)]
    if dusk:
        L = bpy.data.lights.new(f'{name}L', 'POINT'); L.energy = 1100; L.color = (1, 0.76, 0.48); L.shadow_soft_size = 0.3
        o = bpy.data.objects.new(f'{name}L', L); o.location = (x, y, 3.8); C.objects.link(o)
    return out

def hydrant(name, x, y):
    a = Acc(7); C = coll('props')
    a.tube(Vector((x, y, 0.1)), Vector((x, y, 0.62)), 0.11, n=14); a.tube(Vector((x, y, 0.62)), Vector((x, y, 0.72)), 0.13, 0.06, n=14)
    a.tube(Vector((x - 0.17, y, 0.45)), Vector((x + 0.17, y, 0.45)), 0.05, n=10); a.tube(Vector((x, y - 0.17, 0.45)), Vector((x, y, 0.45)), 0.06, n=10)
    a.tube(Vector((x, y, 0.1)), Vector((x, y, 0.16)), 0.15, n=14)
    return a.obj(name, mat('flag', color=srgb('#c9402e'), var=0.05, rough=0.45, grime=0.4), coll=C, smooth=True)

def wheelie_bin(name, x, y, rz=0.0, col='bin'):
    a = Acc(8); b = Acc(9); w = Acc(10); C = coll('props')
    a.poly_prism([(-0.28, 0.08), (0.28, 0.08), (0.34, 1.0), (-0.34, 1.0)], -0.33, 0.33, lambda u, v, t: Vector((u, t, v)))
    b.box((0.0, 0.0, 1.04), (0.74, 0.72, 0.06)); b.box((0.0, -0.38, 1.0), (0.6, 0.06, 0.06))
    for e in (-1, 1): w.tube(Vector((e * 0.3, -0.3, 0.1)), Vector((e * 0.22, -0.3, 0.1)), 0.1, n=12)
    objs = [a.obj(f'{name}_b', mat(col, var=0.04, brush=0.15, rough=0.5, grime=0.5), coll=C, bevel=0.03),
            b.obj(f'{name}_l', mat('binLid', var=0.0, rough=0.5), coll=C, bevel=0.02), w.obj(f'{name}_w', mat('tire', var=0.0), coll=C, smooth=True)]
    return parent_all(name, objs, (x, y, 0.12), rz)

def sprinkler(name, x, y, rng, phase=0.4, water=True):
    """擺動式灑水器：長條管左右擺，噴出一排拋物線水柱與水珠。"""
    a = Acc(11); wtr = Acc(12); C = coll('props')
    a.box((x, y, 0.16), (0.12, 0.5, 0.05)); a.tube(Vector((x, y - 0.22, 0.2)), Vector((x, y + 0.22, 0.2)), 0.02, n=8)
    a.tube(Vector((x + 0.3, y, 0.12)), Vector((x + 3.5, y + 1.0, 0.12)), 0.015, n=6)   # 水管
    for k in range(14 if water else 0):
        yy = y - 0.2 + k * 0.03; tilt = phase
        v0 = Vector((math.sin(tilt) * 2.4, (k - 6.5) * 0.12, 3.4)); p = Vector((x, yy, 0.22)); g = 9.0; dt = 0.04; prev = p.copy()
        for i in range(24):
            t = (i + 1) * dt; q = p + v0 * t + Vector((0, 0, -0.5 * g * t * t))
            if q.z < 0.12: break
            if i % 2 == 0: wtr.tube(prev, q, 0.012, 0.008, n=4)
            else: wtr.box(q, (0.035, 0.035, 0.035), (rng.random(), rng.random(), 0))
            prev = q
    return [a.obj(f'{name}_b', mat('chrome', color=srgb('#8f9399'), var=0.0, rough=0.35), coll=C),
            wtr.obj(f'{name}_w', mat('water', emit=0.35, alpha=0.55, var=0.0, rough=0.1, grime=0.0), coll=C) if water else None]

def car(name, x, y, rz, col='car'):
    """小轎車：側面輪廓擠出 + 大倒角；車窗內縮、輪拱、輪框、燈、後照鏡。"""
    a = Acc(13); g = Acc(14); t = Acc(15); ch = Acc(16); lt = Acc(17); C = coll('props')
    side = [(-2.15, 0.32), (2.15, 0.32), (2.2, 0.62), (2.0, 0.86), (0.9, 0.95), (0.35, 1.45), (-1.3, 1.48), (-1.95, 1.0), (-2.2, 0.92)]
    a.poly_prism(side, -0.88, 0.88, lambda u, v, tt: Vector((tt, u, v)))
    glass_side = [(0.75, 1.0), (0.3, 1.38), (-1.22, 1.4), (-1.8, 1.02)]
    for e in (-1, 1): g.poly_prism(glass_side, e * 0.885, e * 0.9, lambda u, v, tt: Vector((tt, u, v)))
    g.poly_prism([(-0.7, 1.0), (0.7, 1.0), (0.6, 1.36), (-0.6, 1.36)], 0.62, 0.86, lambda u, v, tt: Vector((u, tt + 0.0, v)))
    for wy in (-1.35, 1.35):
        for e in (-1, 1):
            t.tube(Vector((e * 0.78, wy, 0.34)), Vector((e * 0.98, wy, 0.34)), 0.33, n=20)
            ch.tube(Vector((e * 0.97, wy, 0.34)), Vector((e * 1.0, wy, 0.34)), 0.19, n=16)
    for e in (-1, 1):
        lt.box((e * 0.62, 2.18, 0.72), (0.34, 0.06, 0.14)); ch.box((e * 0.62, -2.2, 0.75), (0.3, 0.05, 0.14))
        ch.box((e * 0.98, 0.72, 1.05), (0.12, 0.08, 0.1))
    ch.box((0, 2.24, 0.42), (1.7, 0.1, 0.16)); ch.box((0, -2.24, 0.42), (1.7, 0.1, 0.16))
    objs = [a.obj(f'{name}_body', mat(col, var=0.0, brush=0.05, rough=0.3, grime=0.3), coll=C, bevel=0.09),
            g.obj(f'{name}_glass', glass_mat(False), coll=C, bevel=0.02), t.obj(f'{name}_tires', mat('tire', var=0.0, rough=0.8), coll=C, smooth=True),
            ch.obj(f'{name}_chrome', mat('chrome', var=0.0, rough=0.25, grime=0.0), coll=C, bevel=0.01),
            lt.obj(f'{name}_lights', mat('trim', color=srgb('#fff4d8'), var=0.0, rough=0.2), coll=C)]
    return parent_all(name, objs, (x, y, 0.12), rz)

def dog(name, x, y, rz, barking=True):
    """黃金獵犬體型：skin modifier 長出軀幹、四肢、脖子與頭；耳朵與尾巴另外加。"""
    v = [(0, -0.32, 0.55), (0, 0.0, 0.58), (0, 0.3, 0.6), (0, 0.42, 0.78), (0, 0.5, 0.86), (0, 0.66, 0.82),
         (-0.1, 0.3, 0.3), (-0.1, 0.32, 0.04), (0.1, 0.3, 0.3), (0.1, 0.34, 0.04),
         (-0.1, -0.3, 0.32), (-0.1, -0.36, 0.04), (0.1, -0.3, 0.32), (0.1, -0.34, 0.04), (0, -0.42, 0.6), (0, -0.62, 0.78)]
    e = [(0, 1), (1, 2), (2, 3), (3, 4), (4, 5), (2, 6), (6, 7), (2, 8), (8, 9), (0, 10), (10, 11), (0, 12), (12, 13), (0, 14), (14, 15)]
    r = [(0.15, 0.16), (0.16, 0.17), (0.15, 0.17), (0.08, 0.09), (0.11, 0.12), (0.06, 0.06),
         0.05, 0.04, 0.05, 0.04, 0.06, 0.04, 0.06, 0.04, 0.04, 0.025]
    C = coll('props')
    body = skin_mesh(f'{name}_body', v, e, r, mat('dog', var=0.0, brush=0.35, rough=0.9, grime=0.2), c=C)
    ears = [prim_sphere(f'{name}_ear{k}', (k * 0.1, 0.48, 0.9), 0.07, mat('dogDark', var=0.0, brush=0.3), (0.35, 0.8, 1.2), 2, C) for k in (-1, 1)]
    nose = prim_sphere(f'{name}_nose', (0, 0.72, 0.83), 0.03, mat('eye', var=0.0, rough=0.3), (1, 1, 0.8), 2, C)
    eyes = [prim_sphere(f'{name}_eye{k}', (k * 0.06, 0.6, 0.92), 0.018, mat('eye', var=0.0, rough=0.2), sub=2, c=C) for k in (-1, 1)]
    objs = [body, nose] + ears + eyes
    if barking:
        objs.append(prim_sphere(f'{name}_mouth', (0, 0.66, 0.77), 0.04, mat('lip', color=srgb('#9b3b34'), var=0.0), (0.8, 1.0, 0.4), 2, C))
    return parent_all(name, objs, (x, y, 0.12), rz)

def utility_poles(x, y0, y1, step=34, rng=None):
    """木電線桿（橫擔、礙子）＋ 三條下垂的電線；參考影片裡這是街景生活感的重要來源。"""
    a = Acc(18); w = Acc(19); C = coll('props'); tops = []
    y = y0
    while y <= y1:
        a.tube(Vector((x, y, 0.1)), Vector((x, y, 9.0)), 0.13, 0.1, n=10)
        a.box((x, y, 8.4), (2.2, 0.12, 0.12)); a.box((x, y, 7.6), (1.4, 0.1, 0.1))
        for dx in (-0.95, 0.0, 0.95): a.tube(Vector((x + dx, y, 8.46)), Vector((x + dx, y, 8.62)), 0.04, n=6)
        a.tube(Vector((x + 0.3, y, 6.6)), Vector((x + 0.3, y, 7.3)), 0.22, n=12)   # 變壓器
        tops.append(y); y += step
    for dx, dz in ((-0.95, 8.62), (0.0, 8.62), (0.95, 8.62), (-0.6, 7.66)):
        for ya, yb in zip(tops, tops[1:]):
            prev = None
            for k in range(13):
                t = k / 12; yy = ya + (yb - ya) * t; z = dz - 0.9 * 4 * t * (1 - t)
                p = Vector((x + dx, yy, z))
                if prev is not None: w.tube(prev, p, 0.012, n=4)
                prev = p
    return [a.obj('poles', mat('post', color=srgb('#6e5843'), var=0.1, brush=0.4, rough=0.9), coll=C, smooth=True),
            w.obj('wires', mat('tire', color=srgb('#2a2a2c'), var=0.0, rough=0.6), coll=C)]
