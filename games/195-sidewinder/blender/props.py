# 場邊擺設（mesh id 2..12）。Blender 座標：X 前（沿牆方向／面向賽道）、Y 左、Z 上，原點在地面。
import math

import bmesh
from mathutils import Matrix, Vector

from common import XorShift32
from meshkit import Builder, material, A_PAINT, A_GLOW


def M():
    return dict(
        tire=material('tire', '#262322', rough=0.9),
        tire_w=material('tire_white', '#e6ddca', rough=0.8),
        hay=material('hay', '#d8b35c', rough=1.0),
        hay_dk=material('hay_dk', '#b89140', rough=1.0),
        twine=material('twine', '#7a5a2c', rough=1.0),
        rust=material('rust', '#9c3b22', rough=0.6),
        mustard=material('mustard', '#d7a93a', rough=0.6),
        lid=material('lid', '#4a4643', rough=0.5, metal=0.4),
        wood=material('wood', '#9a6a3f', rough=0.9),
        wood_dk=material('wood_dk', '#6e4a2b', rough=0.9),
        canvas=material('canvas', '#efe6d2', rough=1.0),
        steel=material('steel', '#8a8f93', rough=0.4, metal=0.8),
        frame=material('frame', '#3a3634', rough=0.6),
        lamp=material('lamp', '#fff6da', A_GLOW, 0.2),
        pole=material('pole', '#e8e2d4', rough=0.5),
        flag=material('flag', '#e0e0e0', A_PAINT, 0.9),
        cactus=material('cactus', '#6f8455', rough=0.9),
        cactus_dk=material('cactus_dk', '#586b43', rough=0.9),
        chk_w=material('check_w', '#efe6d2', rough=0.8),
        chk_b=material('check_b', '#1f1c1a', rough=0.8),
        nitro=material('nitro', '#3d6e8f', rough=0.3, metal=0.5),
        band=material('nitro_band', '#f2e6c4', A_GLOW, 0.4),
        chrome=material('chrome', '#cfccc4', rough=0.25, metal=0.9),
        knob=material('knob', '#c0321e', rough=0.5),
        sack=material('sack', '#c9a66b', rough=1.0),
        badge=material('badge', '#5c9a45', A_GLOW, 0.5),
    )


SHIRTS = ['#9c3b22', '#35577a', '#d7a93a', '#efe6d2', '#4f6b3a', '#7a4a6a', '#c86b3c', '#2f2d2b', '#b8b0a0']
TOPS = ['#e0b48a', '#8a5a3a', '#3a2a20', '#d7a93a', '#efe6d2', '#c9a06a']


def tire_stack():
    m = M()
    b = Builder('tire_stack')
    prof = [(0.4, 0.0), (0.4, 0.28), (0.17, 0.28), (0.17, 0.06)]
    for col, x in enumerate((-0.41, 0.41)):
        for row in range(3):
            mat = m['tire_w'] if (col == 0 and row == 1) or (col == 1 and row == 2) else m['tire']
            b.revolve(prof, 8, lambda i, mat=mat: mat if i == 0 else m['tire'],
                      center=(x, 0, row * 0.3), phase=math.pi / 8 + col * 0.3)
    return b.finish()


def hay_bale():
    m = M()
    b = Builder('hay_bale')
    b.box(-0.65, 0.65, -0.3, 0.3, 0.0, 0.5, m['hay'], skip=('-z',), mats={'-y': m['hay_dk'], '+y': m['hay_dk']})
    bm = b.bm
    edges = [e for e in bm.edges if not e.is_boundary]
    bmesh.ops.bevel(bm, geom=edges, offset=0.06, segments=1, affect='EDGES', clamp_overlap=True)
    for x in (-0.36, 0.34):
        b.box(x - 0.025, x + 0.025, -0.305, 0.305, 0.0, 0.505, m['twine'], skip=('-z', '-x', '+x'))
    return b.finish()


def barrel():
    m = M()
    b = Builder('barrel')
    prof = [(0.28, 0.0), (0.3, 0.03), (0.3, 0.27), (0.32, 0.3), (0.3, 0.33), (0.3, 0.57),
            (0.32, 0.6), (0.3, 0.63), (0.3, 0.87), (0.28, 0.9)]
    b.revolve(prof, 12, lambda i: m['mustard'] if i == 4 else m['rust'], cap_top=m['lid'])
    b.box(0.08, 0.16, -0.04, 0.04, 0.9, 0.94, m['lid'], skip=('-z',))
    return b.finish()


def grandstand():
    # 原點在看台腳印中心；面向 +X（賽道方向），長邊沿 Y（±4.5 m）
    m = M()
    b = Builder('grandstand')
    rng = XorShift32(19505)
    L2 = 4.5
    for k in range(4):
        x1 = 1.6 - 0.8 * k
        x0 = x1 - 0.8
        z1 = 0.45 * (k + 1)
        skip = ('-z',) if k == 3 else ('-z', '-x')
        b.box(x0, x1, -L2, L2, 0.0, z1, m['wood'], skip=skip, mats={'+x': m['wood_dk'], '-y': m['wood_dk'], '+y': m['wood_dk']})
    b.box(-1.72, -1.6, -L2 - 0.1, L2 + 0.1, 0.0, 2.3, m['wood_dk'], skip=('-z',))
    # 遮陽帆布：後高前低，紅白條
    for y in (-L2, L2):
        b.beam((-1.66, y, 1.8), (-1.66, y, 3.62), 0.12, m['wood_dk'])
        b.beam((1.52, y, 0.0), (1.52, y, 3.02), 0.12, m['wood_dk'])
    b.beam((1.52, 0, 0.0), (1.52, 0, 3.02), 0.1, m['wood_dk'])
    n = 6
    for i in range(n):
        y0 = -L2 - 0.2 + (2 * L2 + 0.4) * i / n
        y1 = -L2 - 0.2 + (2 * L2 + 0.4) * (i + 1) / n
        mat = m['canvas'] if i % 2 == 0 else m['rust']
        top = [(-1.8, y0, 3.64), (1.75, y0, 3.02), (1.75, y1, 3.02), (-1.8, y1, 3.64)]
        b.poly(top, mat)
        b.poly(list(reversed([(x, y, z - 0.02) for (x, y, z) in top])), mat)
        # 前緣垂邊
        v = [(1.75, y0, 3.02), (1.75, y1, 3.02), (1.75, y1, 2.74), (1.75, y0, 2.74)]
        b.poly(v, mat)
        b.poly([(x - 0.012, y, z) for (x, y, z) in reversed(v)], mat)   # 背面略退，免得被去重合併
    # 觀眾：每排座位上的小方塊，頂面是頭髮／帽子
    for k in range(4):
        xc = 1.6 - 0.8 * k - 0.45
        zb = 0.45 * (k + 1)
        y = -L2 + 0.35
        while y < L2 - 0.3:
            if rng.rand() < 0.72:
                si, ti = rng.next() % len(SHIRTS), rng.next() % len(TOPS)
                sh = material('shirt%d' % si, SHIRTS[si])
                tp = material('top%d' % ti, TOPS[ti])
                hh = 0.36 + 0.08 * rng.rand()
                w = 0.16 + 0.03 * rng.rand()
                b.box(xc - 0.14, xc + 0.14, y - w, y + w, zb, zb + hh, sh, skip=('-z',))
                b.box(xc - 0.1, xc + 0.08, y - 0.09, y + 0.09, zb + hh, zb + hh + 0.2, tp, skip=('-z',))
            y += 0.52 + 0.1 * rng.rand()
    return b.finish()


def floodlight():
    m = M()
    b = Builder('floodlight')
    H = 8.6
    base, top = 0.62, 0.22
    cs = [(1, 1), (-1, 1), (-1, -1), (1, -1)]
    for (sx, sy) in cs:
        b.beam((sx * base, sy * base, 0), (sx * top, sy * top, H), 0.11, m['steel'])
    for zf in (0.25, 0.5, 0.75):
        r = base + (top - base) * zf
        z = H * zf
        for k in range(4):
            (ax, ay), (bx, by) = cs[k], cs[(k + 1) % 4]
            b.beam((ax * r, ay * r, z), (bx * r, by * r, z), 0.06, m['steel'])
    b.box(-0.5, 0.5, -0.95, 0.95, H, H + 0.14, m['frame'])
    # 燈板：往下俯 25°，面向 +X
    rot = Matrix.Rotation(math.radians(25), 4, 'Y')
    pivot = Vector((0.0, 0.0, H + 0.75))
    n0 = len(b.bm.verts)
    b.box(-0.12, 0.08, -1.05, 1.05, -0.55, 0.55, m['frame'])
    for r in range(2):
        for c in range(3):
            y0 = -0.95 + c * 0.66
            z0 = -0.45 + r * 0.48
            b.box(0.08, 0.14, y0, y0 + 0.56, z0, z0 + 0.42, m['lamp'], skip=('-x',))
    b.bm.verts.ensure_lookup_table()
    for v in b.bm.verts[n0:]:
        v.co = rot @ v.co + pivot
    return b.finish()


def flag_pole():
    m = M()
    b = Builder('flag_pole')
    b.revolve([(0.06, 0.0), (0.045, 4.3)], 6, lambda i: m['pole'], cap_top=m['pole'])
    b.box(-0.07, 0.07, -0.07, 0.07, 4.3, 4.42, m['mustard'])
    # 旗面（塗裝色）：沿 +X 飄，雙面
    n = 4
    top, bot = [], []
    for k in range(n + 1):
        x = 0.05 + 1.25 * k / n
        y = 0.1 * math.sin(k * 1.5)
        top.append((x, y, 4.2))
        bot.append((x, y, 3.4 - 0.05 * k))
    for k in range(n):
        q = [bot[k], bot[k + 1], top[k + 1], top[k]]
        b.poly(q, m['flag'])
        b.poly([(x, y + 0.012, z) for (x, y, z) in reversed(q)], m['flag'])
    return b.finish()


def cactus():
    m = M()
    b = Builder('cactus')
    b.revolve([(0.24, 0.0), (0.27, 0.25), (0.27, 2.3), (0.22, 2.68), (0.11, 2.88), (0.0, 2.94)], 8,
              lambda i: m['cactus'] if i % 2 == 0 else m['cactus_dk'], phase=math.pi / 8)
    # 兩支手臂：水平伸出再往上
    for (sy, z0, out, up) in ((1, 1.0, 0.78, 1.05), (-1, 1.4, 0.68, 0.85)):
        y_in, y_out = 0.12 * sy, out * sy
        lo, hi = min(y_in, y_out), max(y_in, y_out)
        b.revolve([(0.15, 0.0), (0.15, hi - lo)], 6, lambda i: m['cactus'], center=(0, lo, z0), axis='Y')
        b.revolve([(0.15, 0.0), (0.15, up), (0.08, up + 0.14), (0.0, up + 0.2)], 6,
                  lambda i: m['cactus'] if i == 0 else m['cactus_dk'], center=(0, y_out, z0 - 0.15))
    return b.finish()


def start_arch():
    # 車子沿 +X 穿過；兩柱在 Y = ±5.3（遊戲中依賽道寬度縮放）
    m = M()
    b = Builder('start_arch')
    for sy in (-1, 1):
        yc = 5.3 * sy
        b.box(-0.28, 0.28, yc - 0.28, yc + 0.28, 0.0, 4.4, m['frame'], skip=('-z',))
        b.box(-0.46, 0.46, yc - 0.46, yc + 0.46, 0.0, 0.75, m['tire'], skip=('-z',))
        b.box(-0.34, 0.34, yc - 0.34, yc + 0.34, 4.4, 4.62, m['mustard'], skip=('-z',))
    b.box(-0.24, 0.24, -5.6, 5.6, 3.55, 4.4, m['rust'], skip=('+x', '-x'))
    # 兩面方格旗橫幅
    cols, rows = 16, 2
    for sx in (-1, 1):
        x = 0.25 * sx
        for r in range(rows):
            for c in range(cols):
                y0 = -5.2 + 10.4 * c / cols
                y1 = -5.2 + 10.4 * (c + 1) / cols
                z0 = 3.62 + 0.36 * r
                z1 = z0 + 0.36
                mat = m['chk_w'] if (r + c) % 2 == 0 else m['chk_b']
                q = [(x, y0, z0), (x, y1, z0), (x, y1, z1), (x, y0, z1)]
                b.poly(q if sx > 0 else list(reversed(q)), mat)
        # 橫幅以外的面板
        for (ya, yb) in ((-5.6, -5.2), (5.2, 5.6)):
            q = [(x, ya, 3.55), (x, yb, 3.55), (x, yb, 4.4), (x, ya, 4.4)]
            b.poly(q if sx > 0 else list(reversed(q)), m['rust'])
        for (za, zb) in ((3.55, 3.62), (4.34, 4.4)):
            q = [(x, -5.2, za), (x, 5.2, za), (x, 5.2, zb), (x, -5.2, zb)]
            b.poly(q if sx > 0 else list(reversed(q)), m['rust'])
    return b.finish()


def fence():
    m = M()
    b = Builder('fence')
    for x in (-1.0, 0.0):
        b.box(x - 0.05, x + 0.05, -0.05, 0.05, 0.0, 1.1, m['wood_dk'], skip=('-z',))
    for z in (0.42, 0.84):
        b.box(-1.0, 1.0, -0.03, 0.03, z, z + 0.12, m['wood'])
    return b.finish()


def pickup_nitro():
    m = M()
    b = Builder('pickup_nitro')
    prof = [(0.26, 0.0), (0.29, 0.05), (0.29, 0.3), (0.29, 0.5), (0.29, 0.78), (0.2, 0.94), (0.09, 1.02), (0.075, 1.12)]
    mats = [m['nitro'], m['nitro'], m['band'], m['nitro'], m['nitro'], m['nitro'], m['chrome']]
    b.revolve(prof, 10, lambda i: mats[i], cap_top=m['chrome'], cap_bot=m['nitro'])
    b.box(-0.05, 0.05, -0.16, 0.16, 1.12, 1.2, m['chrome'], skip=('-z',))
    b.box(-0.07, 0.07, 0.16, 0.24, 1.1, 1.24, m['knob'])
    return b.finish()


def pickup_money():
    m = M()
    b = Builder('pickup_money')
    prof = [(0.2, 0.0), (0.36, 0.07), (0.43, 0.28), (0.39, 0.5), (0.23, 0.65), (0.12, 0.71),
            (0.13, 0.78), (0.23, 0.87), (0.14, 0.94), (0.0, 0.97)]
    b.revolve(prof, 10, lambda i: m['twine'] if i == 5 else m['sack'], cap_bot=m['sack'])
    # 麻布袋不規則鼓起
    rng = XorShift32(777)
    for v in b.bm.verts:
        if 0.05 < v.co.z < 0.6:
            k = 1 + 0.06 * (rng.rand() - 0.5)
            v.co.x *= k
            v.co.y *= k
    b.box(0.38, 0.45, -0.13, 0.13, 0.2, 0.42, m['badge'], skip=('-x',))
    return b.finish()


BUILDERS = [tire_stack, hay_bale, barrel, grandstand, floodlight, flag_pole, cactus,
            start_arch, fence, pickup_nitro, pickup_money]
