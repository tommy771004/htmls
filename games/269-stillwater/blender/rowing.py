# 靜水釣遊（269）：划槳公式的 Python 版（boat.py 與 fisher.py 共用），和 SPEC.md「划槳公式」一節逐條對應。
# 所有座標都是 three 的船本地座標（原點吃水線中心、船頭 +Z、左舷 +X、Y 朝上）；Blender 端要自己換算：
#   three (x, y, z) = Blender (x, z, −y)
import math

T = 1.2                                   # 一次划槳週期（秒）
DRIVE = 0.45                              # 拉槳佔週期的比例
PIVOT = {'L': (0.60, 0.40, -0.28), 'R': (-0.60, 0.40, -0.28)}
HANDLE = 0.52                             # 槳柄中心到支點的距離（往船內）
BLADE = 1.50                              # 槳葉中心到支點的距離（往船外）
INBOARD, OUTBOARD = 0.58, 1.72
CATCH, FINISH = 38.0, -20.0               # sweep（度）：正 = 槳葉往船頭
LIFT_DRIVE, LIFT_RECOVER = -18.0, -10.0   # lift（度）：正 = 槳葉抬高
REST = (20.0, -12.0)                      # 靜止（不划、釣魚、單邊轉向時停住的那支）


def ease(s):
    return 0.5 - 0.5 * math.cos(math.pi * s)


def smoothstep(a, b, x):
    t = min(1.0, max(0.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


def lerp(a, b, t):
    return a + (b - a) * t


def oar_pose(phi):
    """相位 φ ∈ [0, 1) → (sweep, lift)，單位度。"""
    phi %= 1.0
    if phi < DRIVE:
        s = phi / DRIVE
        return lerp(CATCH, FINISH, ease(s)), LIFT_DRIVE
    s = (phi - DRIVE) / (1 - DRIVE)
    lift = LIFT_RECOVER
    if s < 0.12:
        lift = lerp(LIFT_DRIVE, LIFT_RECOVER, smoothstep(0, 0.12, s))
    elif s > 0.88:
        lift = lerp(LIFT_RECOVER, LIFT_DRIVE, smoothstep(0.88, 1, s))
    return lerp(FINISH, CATCH, ease(s)), lift


def oar_point(side, sweep, lift, d):
    """支點往槳葉方向 d 公尺（槳柄用負值）的點，回傳 three 船本地座標。
    Oar_L：q = qY(−sweep)·qZ(+lift)，本地 +X 是槳葉；Oar_R：q = qY(+sweep)·qZ(−lift)，本地 −X 是槳葉。"""
    s, l = math.radians(sweep), math.radians(lift)
    px, py, pz = PIVOT[side]
    if side == 'L':
        x0 = d                             # 本地 (d, 0, 0)
        # qZ(+l)：(x cos l, x sin l, 0)；qY(−s)：x' = x cos s, z' = x sin s
        x1, y1 = x0 * math.cos(l), x0 * math.sin(l)
        return (px + x1 * math.cos(s), py + y1, pz + x1 * math.sin(s))
    x0 = -d                                # 本地 (−d, 0, 0)
    # qZ(−l)：(x cos l, −x sin l, 0)；qY(+s)：x' = x cos s, z' = −x sin s
    x1, y1 = x0 * math.cos(l), -x0 * math.sin(l)
    return (px + x1 * math.cos(s), py + y1, pz - x1 * math.sin(s))


def handle(side, sweep, lift):
    return oar_point(side, sweep, lift, -HANDLE)


def blade(side, sweep, lift):
    return oar_point(side, sweep, lift, BLADE)


if __name__ == '__main__':
    for phi in (0, 0.2, 0.44, 0.5, 0.7, 0.95):
        sw, li = oar_pose(phi)
        print(f'φ={phi:.2f} sweep={sw:+.1f} lift={li:+.1f}  handle_L={tuple(round(c, 3) for c in handle("L", sw, li))}'
              f'  blade_L={tuple(round(c, 3) for c in blade("L", sw, li))}  blade_R={tuple(round(c, 3) for c in blade("R", sw, li))}')
