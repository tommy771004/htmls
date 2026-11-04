# 霓虹夜城（260）f40 重做的車內 → blender/out/cab_f40.glb ＋ cab_f40.json，tools/cab-swap.mjs f40 換進 assets/260/f40.glb
# 執行：/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P blender/cab_f40.py（先跑 node tools/cab-tex.mjs）
# 參考：1980 年代末雙渦輪輕量跑車的賽車式內裝（灰色毛氈儀表板與儀表罩、黑底橘白字的類比錶組、
#       紅色布面桶椅配黑色殼、細圓三輻方向盤配黃色喇叭鈕、通道上的鍍鉻檔位槽、沒有門板只有克維拉內面與拉繩）。
# 對齊原模型（剖面）：地板 y .15；方向盤 sw (.319, .69, .37) 傾角 25；儀表板上緣後端 z .52 y .83 → 擋風玻璃下緣 z .9 y .76；
# 錶面 z .57 y .71–.80；通道頂 y .36–.38（z -.3..0.86）；排檔頭 z .33 y .51；後艙壁 z -.42..-.52；
# 門框 z -.30..0.68（下緣 y .23、上緣 .74）、xi .6，門外皮 |x| .86。儀表板低於 y .74 的部分在門框裡只到 |x| .59。
import os, sys, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cab_common import *

PAL = {
    'cloth_red': dict(col='#a3201f', r=.92, tex='cloth', rep=.03),
    'cloth_red2': dict(col='#8c1b1a', r=.92, tex='cloth', rep=.03),
    'felt': dict(col='#5e5d58', r=1.0, tex='felt', rep=.15),
    'felt_dk': dict(col='#403f3b', r=1.0, tex='felt', rep=.15),
    'dash_end': dict(col='#5e5d58', r=1.0, tex='felt', rep=.15),
    'kevlar': dict(col='#8c8678', r=.3, tex='kevlar', rep=.025),
    'leather_blk': dict(col='#1c1c1e', r=.6),
    'plastic_blk': dict(col='#161618', r=.82),
    'gloss_blk': dict(col='#0b0b0d', r=.15),
    'satin_alu': dict(col='#a6a8ae', r=.28, m=.9),
    'chrome': dict(col='#d6d8dc', r=.1, m=1.0),
    'dark_alu': dict(col='#4c4e54', r=.35, m=.85),
    'carpet': dict(col='#34332f', r=1.0),
    'mat': dict(col='#222220', r=1.0),
    'rubber': dict(col='#0f0f10', r=.9),
    'stitch_dk': dict(col='#2a2a2c', r=.7),
    'stitch_red': dict(col='#5a1210', r=.8),
    'cord_red': dict(col='#b01c18', r=.7),
    'gauge': dict(col='#ffffff', r=.25, tex='atlas_f40', emi=.35),
    'badge': dict(col='#ffffff', r=.3, tex='atlas_f40'),
    'led_red': dict(col='#ff2a1f', r=.3, emi=1.0),
    'led_grn': dict(col='#38ff5a', r=.3, emi=.8),
}
setup('cab_f40', PAL)
FY = .15


# ═══════════════ 儀表板：毛氈上蓋（貼著擋風玻璃往前斜）、前臉、中控面板 ═══════════════
def dash():
    # 上蓋最低 y .745（門框上緣 .74 之上）可以做到門邊；往前低於 .74 的部分在 z > .68（門框外）
    xs = [-.66, -.655, -.64, -.55, -.4, -.25, -.1, 0, .1, .25, .4, .55, .64, .655, .66]
    prof = [(.50, .748), (.49, .79), (.51, .822), (.58, .83), (.70, .808), (.80, .77), (.88, .735), (.905, .72), (.87, .705), (.62, .748)]
    rings = []
    for x in xs:
        s = .88 if abs(x) > .65 else 1
        rings.append([(x, .77 + (y - .77) * s, .7 + (z - .7) * s) for z, y in prof])
    mk('dash_top', *loft(rings, lambda i, j: 'felt_dk' if j < 2 else 'felt' if j < 8 else 'plastic_blk', caps=('dash_end', 'dash_end'))[:3], sub=2)
    # 前臉（兩側），毛氈
    prof = [(.51, .748), (.495, .745), (.49, .70), (.52, .64), (.60, .56), (.72, .50), (.85, .47), (.94, .46), (.94, .745)]
    for side in (-1, 1):
        xs = [side * v for v in (.12, .13, .25, .4, .55, .585, .59)]
        if side < 0:
            xs = xs[::-1]
        mk('dash_face_%d' % (side > 0), *loft([[(x, y, z) for z, y in prof] for x in xs], lambda i, j: 'felt_dk' if j < 2 else 'felt', caps=('felt', 'felt'))[:3], sub=1)
    # 中控面板（兩片前臉中間）：黑色面板、三個空調旋鈕、一排撥桿
    prof = [(.52, .748), (.50, .745), (.50, .62), (.56, .52), (.66, .44), (.75, .41), (.94, .41), (.94, .748)]
    xs = [-.12, -.115, -.09, .09, .115, .12]
    mk('stack', *loft([[(x, y, z) for z, y in prof] for x in xs], lambda i, j: 'plastic_blk' if 0 < i < 4 and 0 < j < 4 else 'felt', caps=('felt', 'felt'))[:3], sub=1)
    X, Y, Z = tilt_axes(4)
    for a in (-.055, 0, .055):
        c = Vector((a, .69, .495))
        cyl('hvac_knob', c, Z, Y, .017, 0, .018, 'plastic_blk', segs=24, mat_cap='dark_alu', r1=.015)
        rbox('hvac_tick', c + Z * .0185 + Y * .008, (.0014, .005, .001), 'chrome', X=X, Y=Y, Z=Z, bevel=0)
    X, Y, Z = tilt_axes(25)
    for k in range(5):
        a = -.06 + k * .03
        c = Vector((a, .615, .51))
        rbox('sw_base_%d' % k, c, (.009, .012, .003), 'chrome', X=X, Y=Y, Z=Z, bevel=.002)
        cyl('sw_lever_%d' % k, c + Z * .002, (Z * .9 + Y * .4).normalized(), Y, .0025, 0, .02, 'chrome', segs=8, r1=.002)
    rbox('warn_led', (0, .575, .52), (.01, .004, .002), 'led_red', X=X, Y=Y, Z=Z, bevel=0)


# ═══════════════ 儀表罩與錶組（中間大轉速＋車速，兩側各兩個小錶） ═══════════════
def gauges():
    # 錶組坐在上蓋前緣（上蓋後端 z .49 前面），罩緣停在 z .46：方向盤上緣（前傾 25°）在 z .435
    T = cluster((.319, .745, .495), 15, .40, .125, (0, 0, 1, 1), mat='plastic_blk', frame_mat='gloss_blk', hood=(.215, .13, -.06, .035),
                hood_out='felt', hood_in='plastic_blk', lip='felt_dk', stitch=None)
    big = ((-.062, 0, .056, (128, 128, 120)), (.062, 0, .056, (384, 128, 120)))
    small = ((-.168, .026, .026, (640, 128, 120)), (-.168, -.03, .026, (896, 128, 120)), (.168, .026, .026, (128, 384, 120)), (.168, -.03, .026, (384, 384, 120)))
    for k, (a, b, r, uv) in enumerate(big + small):
        disc('dial_%d' % k, lambda x, y, z, a=a, b=b: T(a + x, b + y, .003 + z), r, 'gauge', uv, segs=40)
        torus('dial_ring_%d' % k, T(a, b, .004), T(0, 0, 1) - T(0, 0, 0), T(0, 1, 0) - T(0, 0, 0), r + .002, .0022, 'chrome', segs=40, rs=6)
    # 指示燈
    for k, (a, m) in enumerate(((-.11, 'led_red'), (.11, 'led_grn'))):
        cyl('tell_%d' % k, T(a, -.05, .0), T(0, 0, 1) - T(0, 0, 0), T(0, 1, 0) - T(0, 0, 0), .004, 0, .004, m, segs=12)


# ═══════════════ 通道：毛氈包覆、鍍鉻檔位槽、短排檔桿、手煞車 ═══════════════
def tunnel():
    st = [(-.42, .36), (-.3, .366), (0, .372), (.3, .38), (.6, .39), (.86, .405), (.94, .41)]
    rings = []
    for z, yt in st:
        pts = [(-.13, FY + .005), (-.125, .30), (-.115, yt - .022), (-.095, yt), (.095, yt), (.115, yt - .022), (.125, .30), (.13, FY + .005)]
        rings.append([(x, y, z) for x, y in pts])
    mk('tunnel', *loft(rings, lambda i, j: 'felt_dk' if j == 3 else 'felt' if j in (1, 2, 4, 5) else 'plastic_blk', caps=('felt', 'felt'))[:3], sub=1)
    # 檔位槽：鍍鉻板＋六檔的開放式槽（狗腿一檔）
    zg, yg = .37, .383
    rbox('gate_plate', (0, yg, zg), (.052, .004, .065), 'chrome', bevel=.003)
    rbox('gate_surround', (0, yg - .003, zg), (.062, .004, .075), 'leather_blk', bevel=.006)
    for gx in (-.03, 0, .03):
        rbox('gate_slot', (gx, yg + .002, zg), (.0045, .003, .042), 'rubber', bevel=0)
    rbox('gate_cross', (0, yg + .002, zg), (.034, .003, .0045), 'rubber', bevel=0)
    rbox('gate_dog', (-.042, yg + .002, zg + .03), (.012, .003, .0045), 'rubber', bevel=0)
    # 排檔桿：從檔位槽中間斜向駕駛，黑色球頭
    base, knob = Vector((0, yg + .004, zg)), Vector((0, .49, .335))
    tube('shift_rod', [base, (base + knob) / 2 + Vector((0, .01, 0)), knob], .0055, 'chrome', sides=10)
    rings = []
    for k in range(1, 12):
        a = math.pi * k / 12
        rings.append([(.021 * math.sin(a) * math.cos(p), .51 - .021 * math.cos(a), .335 + .021 * math.sin(a) * math.sin(p)) for p in (2 * math.pi * q / 24 for q in range(24))])
    mk('shift_knob', *loft(rings, lambda i, j: 'leather_blk', caps=('leather_blk', 'leather_blk'))[:3], sub=1)
    # 手煞車（通道駕駛側）
    p0, p1 = Vector((.135, .30, .05)), Vector((.14, .40, -.18))
    tube('ebrake', [p0, (p0 + p1) / 2 + Vector((0, .02, 0)), p1], .009, 'chrome', sides=10)
    cyl('ebrake_grip', p1, p1 - p0, (0, 1, 0), .013, -.07, .005, 'leather_blk', segs=14)
    rbox('ebrake_base', (.135, .29, .06), (.012, .02, .03), 'dark_alu', bevel=.004)


# ═══════════════ 門：沒有門板，克維拉內面＋紅色拉繩＋鍍鉻開門撥桿 ═══════════════
def door_in(sgn):
    door_card(sgn, -.28, .66, .70, .80, .25, .45, .73, arm=(-.2, .3), upper='kevlar', arm_mat='kevlar', lower='kevlar', ledge='felt_dk',
              pull=False, release=False, speaker=False, switch=False, armw=0)
    tube('door_cord_%d' % (sgn > 0), [(sgn * .695, .60, -.18), (sgn * .672, .575, -.05), (sgn * .672, .575, .10), (sgn * .695, .60, .2)], .005, 'cord_red', sides=8)
    for z in (-.18, .2):
        cyl('door_cord_end_%d' % (z > 0), (sgn * .70, .60, z), (sgn, 0, 0), (0, 1, 0), .009, -.012, 0, 'chrome', segs=12)
    rbox('door_rel_%d' % (sgn > 0), (sgn * .695, .66, .52), (.006, .008, .035), 'chrome', bevel=.003)
    rbox('door_rel_rec_%d' % (sgn > 0), (sgn * .699, .66, .52), (.004, .02, .05), 'gloss_blk', bevel=.004)
    # 窗戶的滑窗撥扣
    rbox('door_slide_%d' % (sgn > 0), (sgn * .70, .72, .1), (.006, .008, .04), 'dark_alu', bevel=.003)


# ═══════════════ 建模 ═══════════════
for sx, tag in ((.319, 'L'), (-.319, 'R')):
    seat(sx, tag, z0=.32, z1=-.14, vsF=.33, vsR=.26, W=.23, base=(.24, -.11), tilt=22.5, H=.76, main='cloth_red', insert='cloth_red2',
         shell='kevlar', bottom='plastic_blk', side='cloth_red', rep=.03, floor_y=FY)
W = Wheel((.319, .69, .37), 25)
steering(W, R=.153, flat=None, rim='leather_blk', grip='leather_blk', stitch='stitch_dk', spokes='momo', trim='satin_alu', badge_uv=(128, 640, 124),
         a=(.012, .0135))
column(W, length=.24)
gauges()
dash()
tunnel()
for sgn in (1, -1):
    door_in(sgn)
floor(FY, fx=(.13, .70), fz=(-.42, .70), toe=(.70, .92, .32), fw=(.95, .62, .45), kick=(.66, .70, .93, .52), sill=(.74, .06, .22, -.3, .68),
      pedals=(.82, .29, [(.41, .028, .036), (.32, .03, .032), (.22, .02, .05)], .52), carpet='carpet', sill_mat='kevlar', kick_mat='kevlar', mats=False, xc=.33)
finish([
    ('seat_', both('cloth_red', 'cloth_red2'), 'stitch_red', (-.0035, .0035)),
    ('dash_top', both('felt', 'felt_dk'), 'stitch_dk', (0,)),
])
