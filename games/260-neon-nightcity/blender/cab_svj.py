# 霓虹夜城（260）svj 重做的車內 → blender/out/cab_svj.glb ＋ cab_svj.json，tools/cab-swap.mjs svj 換進 assets/260/svj.glb
# 執行：/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P blender/cab_svj.py（先跑 node tools/cab-tex.mjs）
# 參考：V12 剪刀門旗艦的黑色麂皮內裝（黃色縫線、六角縫椅面、鍛造碳飾板、深罩稜角液晶儀表、
#       從通道斜升到儀表板的「機艙式」中控：一排撥桿開關與紅色翻蓋啟動鈕、小螢幕、柱上大撥片、平底麂皮方向盤十二點黃色標記）。
# 對齊原模型（剖面）：地板 y .22；方向盤 sw (.385, .745, .354) 傾角 20；儀表板上緣後端 z .52 y .87，前臉往前斜到 z .70 y .49；
# 中央通道 z -.42 y .45 → z .18 y .49 → z .58 y .70 → z .88 y .81；後艙壁 z -.42..-.61；門框（剪刀門）下緣 y .27、前緣 z .87..0.9，
# 上框前緣 (z .72, y .74) → (.41, 1.05)，xi .7；門外皮 |x| .92。儀表板在 |x| .69 以內，門板與門前下段的護板跟著門走。
import os, sys, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cab_common import *

PAL = {
    'leather_blk': dict(col='#1b1b1d', r=.55),
    'leather_blk2': dict(col='#1b1b1d', r=.55),
    'alcantara': dict(col='#212124', r=.95, tex='alcantara', rep=.12),
    'hex': dict(col='#242427', r=.7, tex='hex', rep=.1),
    'perf_blk': dict(col='#1b1b1e', r=.62, tex='perf', rep=.04),
    'dash_top': dict(col='#1e1e21', r=.95, tex='alcantara', rep=.12),
    'dash_top2': dict(col='#1e1e21', r=.95, tex='alcantara', rep=.12),
    'dash_end': dict(col='#1e1e21', r=.95, tex='alcantara', rep=.12),
    'plastic_blk': dict(col='#141416', r=.82),
    'gloss_blk': dict(col='#0a0a0c', r=.1),
    'satin_alu': dict(col='#a3a5ab', r=.28, m=.9),
    'dark_alu': dict(col='#4a4c52', r=.33, m=.85),
    'carbon': dict(col='#d8d8dc', r=.2, tex='carbon', rep=.05),
    'forged': dict(col='#5c5c62', r=.18, tex='forged', rep=.22),
    'carpet': dict(col='#1a1a1c', r=1.0),
    'mat': dict(col='#131314', r=1.0),
    'rubber': dict(col='#0e0e0f', r=.9),
    'stitch_yel': dict(col='#e8c21a', r=.6),
    'stitch_dk': dict(col='#2a2a2c', r=.7),
    'leather_yel': dict(col='#e0b81c', r=.5),
    'start_red': dict(col='#c4211a', r=.25),
    'gauge': dict(col='#ffffff', r=.3, tex='atlas_svj', emi=.5),
    'screen': dict(col='#ffffff', r=.15, tex='atlas_svj', emi=.5),
    'badge': dict(col='#ffffff', r=.3, tex='atlas_svj'),
    'keys': dict(col='#ffffff', r=.4, tex='atlas_svj', emi=.3),
    'led_red': dict(col='#ff2a1f', r=.3, emi=1.0),
    'led_yel': dict(col='#ffc21a', r=.3, emi=.9),
}
setup('cab_svj', PAL)
FY = .22


# ═══════════════ 儀表板：麂皮上蓋、往前斜的前臉、Y 形鍛造碳飾條 ═══════════════
def dash():
    xs = [-.69, -.685, -.67, -.6, -.45, -.3, -.15, 0, .15, .2, .25, .3, .45, .52, .57, .62, .67, .685, .69]
    prof = [(.525, .835), (.515, .862), (.53, .885), (.60, .90), (.68, .895), (.80, .862), (.90, .826), (1.0, .805), (1.0, .79), (.60, .80)]
    rings = []
    for x in xs:
        s = .9 if abs(x) > .68 else 1
        sh = .08 * cave(x, .385, .18, .05)   # 駕駛前方的後緣往前退，讓出儀表
        rings.append([(x, .85 + (y - .85) * s, .75 + (z + (sh if k < 3 else 0) - .75) * s) for k, (z, y) in enumerate(prof)])
    mk('dash_top', *loft(rings, lambda i, j: 'leather_blk' if j < 2 else ('dash_top2' if j == 2 else 'dash_top') if j < 8 else 'plastic_blk', caps=('dash_end', 'dash_end'))[:3], sub=2)
    # 前臉：上段皮革縫黃線、下段塑膠，往前斜（膝蓋空間），下緣 y .46 留出腳踏板的空間
    prof = [(.53, .84), (.515, .835), (.52, .80), (.56, .72), (.62, .62), (.70, .53), (.76, .465), (1.0, .46), (1.0, .84)]
    for side in (-1, 1):
        xs = [side * v for v in (.155, .165, .3, .45, .6, .68, .69)]
        if side < 0:
            xs = xs[::-1]
        mk('dash_face_%d' % (side > 0), *loft([[(x, y, z) for z, y in prof] for x in xs], lambda i, j: 'leather_blk2' if j < 3 else 'plastic_blk', caps=('plastic_blk', 'plastic_blk'))[:3], sub=1)
    # 副駕前方的 Y 形鍛造碳飾條（沿前臉的兩條斜帶）
    for a, b in (((-.62, .80, .52), (-.30, .70, .575)), ((-.30, .70, .575), (-.17, .76, .545)), ((-.30, .70, .575), (-.25, .58, .63))):
        A, B = Vector(a), Vector(b)
        d = B - A
        c = (A + B) / 2
        n = Vector((0, .55, -.84)).normalized()
        X = d.normalized()
        Y = n.cross(X).normalized()
        rbox('dash_y', c, (d.length / 2 + .012, .014, .004), 'forged', X=X, Y=Y, Z=n, bevel=.002)
    # 兩端的稜角出風口
    for vx in (-.6, .6):
        slot_vent((vx, .812, .522), .07, .03, tilt=6, frame_mat='dark_alu')


# 中控上段（兩片前臉中間）：兩個出風口、小螢幕
def stack():
    prof = [(.53, .845), (.515, .84), (.52, .78), (.55, .72), (.62, .695), (.66, .70), (.66, .845)]
    xs = [-.16, -.152, -.11, .11, .152, .16]
    mk('stack', *loft([[(x, y, z) for z, y in prof] for x in xs], lambda i, j: 'gloss_blk' if 0 < i < 4 and 0 < j < 4 else 'leather_blk', caps=('leather_blk', 'leather_blk'))[:3], sub=1)
    for vx in (-.065, .065):
        slot_vent((vx, .817, .516), .07, .026, tilt=4, frame_mat='dark_alu')
    X, Y, Z = tilt_axes(28)
    T = frame((0, .752, .538), X, Y, Z)
    quad('screen', T, .15, .084, 'screen', (512, 0, 512, 288))
    rbox('screen_frame', T(0, 0, -.007), (.083, .05, .006), 'gloss_blk', X=X, Y=Y, Z=Z, bevel=.003)


# ═══════════════ 中央通道：斜升到儀表板，撥桿列與翻蓋啟動鈕、扶手 ═══════════════
def console():
    st = [(-.42, .455, .95), (-.36, .462, 1), (-.2, .47, 1), (0, .48, 1), (.18, .49, 1), (.30, .555, 1), (.45, .635, 1), (.58, .70, 1), (.62, .71, .98)]
    rings = []
    for z, yt, s in st:
        pts = [(-.15, FY + .01), (-.145, .34), (-.14, yt - .028), (-.12, yt), (.12, yt), (.14, yt - .028), (.145, .34), (.15, FY + .01)]
        rings.append([(x * s, y, z) for x, y in pts])

    def m(i, j):
        z = (st[i][0] + st[i + 1][0]) / 2
        if j == 3:
            return 'leather_blk' if z < .05 else 'forged'
        if j in (2, 4):
            return 'leather_blk2'
        if j in (1, 5):
            return 'alcantara'
        return 'plastic_blk'
    mk('console', *loft(rings, m, caps=('plastic_blk', 'plastic_blk'))[:3], sub=1)
    # 斜面上的開關：沿通道頂面的局部座標
    def on_ramp(z):
        for a, b in zip(st, st[1:]):
            if a[0] <= z <= b[0]:
                f = (z - a[0]) / (b[0] - a[0])
                y = a[1] + (b[1] - a[1]) * f
                ang = math.atan2(b[1] - a[1], b[0] - a[0])
                return y, ang
        return st[-1][1], 0
    for zc, kind in ((.26, 'gear'), (.40, 'toggle'), (.53, 'hvac')):
        y, ang = on_ramp(zc)
        Zn = Vector((0, math.cos(ang), -math.sin(ang)))   # 斜面法線（朝上偏後）
        Yt = Vector((0, math.sin(ang), math.cos(ang)))     # 沿斜面往前
        Xt = Vector((1, 0, 0))
        c = Vector((0, y + .002, zc))
        T = frame(c, Xt, Yt, Zn)
        if kind == 'toggle':
            rbox('tog_plate', T(0, 0, .002), (.11, .04, .004), 'gloss_blk', X=Xt, Y=Yt, Z=Zn, bevel=.003)
            # 中間紅色翻蓋（打開一點）＋底下的啟動鈕
            cyl('start_btn', T(0, -.002, .004), Zn, Yt, .012, 0, .008, 'gloss_blk', segs=20)
            torus('start_led', T(0, -.002, .012), Zn, Yt, .009, .0012, 'led_red', segs=20, rs=4)
            hinge = T(0, .022, .01)
            t = math.radians(35)
            Yc = (Yt * math.cos(t) + Zn * math.sin(t)).normalized()
            Zc = Xt.cross(Yc)
            rbox('flip_cover', hinge - Yc * .021 + Zc * .004, (.017, .021, .003), 'start_red', X=Xt, Y=Yc, Z=Zc, bevel=.002)
            cyl('flip_hinge', hinge, Xt, Zn, .003, -.016, .016, 'satin_alu', segs=10)
            for k in (-3, -2, -1, 1, 2, 3):
                a = k * .03 + (.005 if k > 0 else -.005)
                rbox('tog_guard', T(a, .014, .005), (.008, .006, .005), 'dark_alu', X=Xt, Y=Yt, Z=Zn, bevel=.002)
                tl = math.radians(-20 if k % 2 else 15)
                Yl = (Zn * math.cos(tl) + Yt * math.sin(tl)).normalized()
                cyl('tog_lever', T(a, -.004, .004), Yl, Yt, .0032, 0, .022, 'satin_alu', segs=10, r1=.0025)
                rbox('tog_led', T(a, -.026, .0045), (.005, .0015, .001), 'led_yel' if k in (-1, 1) else 'stitch_dk', X=Xt, Y=Yt, Z=Zn, bevel=0)
        elif kind == 'gear':
            for k, a in enumerate((-.04, 0, .04)):
                rbox('gear_btn_%d' % k, T(a, 0, .005), (.016, .012, .005), 'dark_alu' if k != 1 else 'satin_alu', X=Xt, Y=Yt, Z=Zn, bevel=.003)
            rbox('gear_led', T(0, -.016, .0055), (.012, .0015, .001), 'led_yel', X=Xt, Y=Yt, Z=Zn, bevel=0)
        else:
            for k, a in enumerate((-.075, .075)):
                cyl('hvac_knob_%d' % k, T(a, 0, 0), Zn, Yt, .018, 0, .016, 'dark_alu', segs=24, mat_cap='satin_alu')
            for k in range(4):
                rbox('hvac_btn_%d' % k, T(-.033 + k * .022, 0, .004), (.009, .014, .004), 'plastic_blk', X=Xt, Y=Yt, Z=Zn, bevel=.002)
    # 扶手接縫、杯架蓋
    rbox('arm_gap', (0, .4835, .02), (.115, .003, .003), 'gloss_blk', bevel=0)
    rbox('cup_lid', (0, .484, .10), (.08, .004, .055), 'forged', bevel=.004)


# 柱上的大撥片（不跟方向盤轉：沿軸在圓柱外）
def paddles(W):
    for sgn in (-1, 1):
        c = W.F(sgn * .125, .03, -.085)
        rbox('paddle_%d' % (sgn > 0), c, (.05, .03, .003), 'satin_alu', X=W.X * sgn, Y=W.Y, Z=W.Z, bevel=.003)
        rbox('paddle_arm_%d' % (sgn > 0), W.F(sgn * .07, .02, -.085), (.03, .008, .006), 'dark_alu', X=W.X, Y=W.Y, Z=W.Z, bevel=.002)


# 門前下段的護板（門框前緣 z .87–.9、y < .62 在門裡）
def door_kick(sgn):
    rbox('door_kick_%d' % (sgn > 0), (sgn * .84, .44, .78), (.05, .14, .07), 'carbon', bevel=.012, uv_rep=.05)


# ═══════════════ 建模 ═══════════════
for sx, tag in ((.385, 'L'), (-.385, 'R')):
    seat(sx, tag, z0=.36, z1=-.19, vsF=.35, vsR=.27, W=.24, base=(.25, -.155), tilt=20, H=.80, main='leather_blk', insert='hex',
         shell='forged', bottom='plastic_blk', side='alcantara', rep=.1, floor_y=.20)
W = Wheel((.385, .745, .354), 20)
steering(W, R=.183, flat=-.15, rim='alcantara', grip='leather_blk', stitch='stitch_yel', spokes='svj', stripe='leather_yel', trim='dark_alu',
         hub_size=(.07, .062), a=(.014, .0165), ag=(.017, .018))
column(W, length=.26)
paddles(W)
cluster((.385, .835, .545), 22, .26, .13, (0, 0, 512, 256), hood=(.17, .13, -.04, .07), hood_out='dash_top', stitch='stitch_yel')
dash()
stack()
console()
for sgn in (1, -1):
    door_card(sgn, -.24, .70, .78, .90, .30, .52, .73, arm=(-.15, .45), upper='hex', arm_mat='leather_blk', lower='carbon', ledge='alcantara', insert_z=(-.1, .5))
    door_kick(sgn)
floor(FY, fx=(.15, .74), fz=(-.42, .70), toe=(.70, .95, .40), fw=(.97, .69, .46), sill=(.80, .06, .26, -.25, .88),
      pedals=(.86, .37, [(.43, .04, .034), (.31, .022, .055)], .57), xc=.40)
finish([
    ('seat_', both('hex', 'leather_blk') | both('alcantara', 'leather_blk'), 'stitch_yel', (-.0035, .0035)),
    ('dash_top', both('dash_top', 'leather_blk'), 'stitch_yel', (0,)),
    ('dash_top', both('dash_top', 'dash_top2'), 'stitch_yel', (-.0035, .0035)),
    ('dash_face', both('leather_blk2', 'plastic_blk'), 'stitch_yel', (0,), dict(xlim=.68)),   # 外端蓋（x .69）不縫：沿端蓋輪廓會折來折去
    ('console', both('leather_blk', 'leather_blk2') | both('forged', 'leather_blk2'), 'stitch_yel', (0,)),
    ('door_card', both('hex', 'leather_blk') | both('hex', 'alcantara'), 'stitch_yel', (-.0035, .0035)),
])
