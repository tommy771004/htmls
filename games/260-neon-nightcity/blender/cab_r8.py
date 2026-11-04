# 霓虹夜城（260）r8 重做的車內 → blender/out/cab_r8.glb ＋ cab_r8.json，tools/cab-swap.mjs r8 換進 assets/260/r8.glb
# 執行：/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P blender/cab_r8.py（先跑 node tools/cab-tex.mjs）
# 參考：第二代中置 V10 跑車的黑色內裝（菱格縫皮椅配紅線、碳纖椅背殼、駕駛座周圍一道碳纖弧形飾條、
#       沒有中央螢幕的寬幅液晶儀表、中央三個圓形出風口、平底方向盤下方兩個衛星按鈕、短排檔撥桿）。
# 對齊原模型：地板 y .14、方向盤 sw (.435, .81, .291) 傾角 18、門框多邊形 z -.30..0.70（下緣 y .21）、xi .6、窗線 .8；
# 門外皮在 |x| .86，擋風玻璃下緣 z ≈ 1.0、y .82。儀表板兩端在門框裡（z < .7）只到 |x| .59，門板前端補一塊跟著門走。
import os, sys, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cab_common import *

PAL = {
    'leather_blk': dict(col='#1d1d20', r=.55),
    'leather_blk2': dict(col='#1d1d20', r=.55),
    'quilt': dict(col='#232327', r=.6, tex='quilt', rep=.09),
    'perf_blk': dict(col='#1b1b1e', r=.62, tex='perf', rep=.04),
    'alcantara': dict(col='#222225', r=.95, tex='alcantara', rep=.12),
    'dash_top': dict(col='#19191b', r=.8),
    'dash_top2': dict(col='#19191b', r=.8),
    'dash_end': dict(col='#19191b', r=.8),
    'plastic_blk': dict(col='#151517', r=.82),
    'gloss_blk': dict(col='#0a0a0c', r=.1),
    'satin_alu': dict(col='#a3a5ab', r=.28, m=.9),
    'dark_alu': dict(col='#505259', r=.35, m=.85),
    'carbon': dict(col='#d8d8dc', r=.2, tex='carbon', rep=.05),
    'carpet': dict(col='#1b1b1d', r=1.0),
    'mat': dict(col='#141415', r=1.0),
    'rubber': dict(col='#0e0e0f', r=.9),
    'stitch_red': dict(col='#c8261c', r=.6),
    'stitch_dk': dict(col='#2a2a2c', r=.7),
    'gauge': dict(col='#ffffff', r=.3, tex='atlas_r8', emi=.5),
    'badge': dict(col='#ffffff', r=.3, tex='atlas_r8'),
    'keys': dict(col='#ffffff', r=.4, tex='atlas_r8', emi=.3),
    'led_red': dict(col='#ff2a1f', r=.3, emi=1.0),
    'led_wht': dict(col='#dfe8ff', r=.3, emi=.7),
}
setup('cab_r8', PAL)
FY = .14


# ═══════════════ 儀表板 ═══════════════
def dash():
    # 上蓋：最低點 y .805 在門框（y < .8）上面，不會被切進門裡，所以可以一路做到門邊
    xs = [-.73, -.72, -.70, -.62, -.45, -.3, -.15, 0, .15, .2, .25, .3, .45, .58, .63, .68, .70, .72, .73]
    prof = [(.39, .805), (.383, .838), (.398, .866), (.44, .884), (.55, .89), (.70, .88), (.85, .86), (.96, .838), (.985, .822), (.95, .805)]
    rings = []
    for x in xs:
        s = .88 if abs(x) > .725 else 1
        sh = .07 * cave(x, .435, .19, .05)   # 駕駛前方的後緣往前退，讓出儀表（不然液晶會埋在上蓋裡）
        rings.append([(x, .845 + (y - .845) * s, .68 + (z + (sh if k < 4 else 0) - .68) * s) for k, (z, y) in enumerate(prof)])
    mk('dash_top', *loft(rings, lambda i, j: 'leather_blk' if j < 2 else ('dash_top2' if j == 2 else 'dash_top') if j < 8 else 'plastic_blk', caps=('dash_end', 'dash_end'))[:3], sub=2)
    # 前臉（膝蓋前方），兩側各一塊；上段皮革縫紅線、下段塑膠
    prof = [(.40, .80), (.376, .80), (.378, .74), (.395, .69), (.43, .63), (.50, .565), (.60, .53), (.72, .51), (.72, .80)]
    for side in (-1, 1):
        xs = [side * v for v in (.17, .18, .3, .45, .58, .59)]
        if side < 0:
            xs = xs[::-1]
        mk('dash_face_%d' % (side > 0), *loft([[(x, y, z) for z, y in prof] for x in xs], lambda i, j: 'leather_blk2' if j < 3 else 'plastic_blk', caps=('plastic_blk', 'plastic_blk'))[:3], sub=1)
    # 副駕前方：碳纖飾條＋鋁線
    rbox('dash_carbon', (-.38, .772, .377), (.2, .016, .004), 'carbon', bevel=.002, uv_rep=.05)
    tube('dash_trim', [(-.58, .752, .378), (-.18, .752, .378)], .0025, 'satin_alu', sides=6)
    # 中控台面板：鋼琴黑，從儀表板唇緣斜到通道前端
    prof = [(.40, .80), (.375, .80), (.378, .70), (.40, .62), (.45, .55), (.52, .50), (.60, .48), (.60, .80)]
    xs = [-.17, -.163, -.12, .12, .163, .17]
    mk('dash_stack', *loft([[(x, y, z) for z, y in prof] for x in xs], lambda i, j: 'gloss_blk' if 0 < i < 4 and j < 5 else 'leather_blk', caps=('leather_blk', 'leather_blk'))[:3], sub=1)
    # 中央三個圓形出風口（中間調整鈕是溫度顯示）、兩端各一個
    for vx in (-.075, 0, .075):
        vent((vx, .768, .374), R=.03, tilt=3)
        torus('vent_temp', (vx, .768, .368), (0, 0, -1), (0, 1, 0), .0075, .0011, 'led_wht', segs=20, rs=4)
    for vx in (-.525, .525):
        vent((vx, .772, .374), R=.032, tilt=3)
    # 開關列（下方一排，中間亮紅燈）
    X, Y, Z = tilt_axes(14)
    T = frame((0, .712, .384), X, Y, Z)
    for k in range(6):
        a = -.1 + k * .04
        rbox('btn_%d' % k, T(a, 0, .004), (.016, .009, .004), 'plastic_blk', X=X, Y=Y, Z=Z, bevel=.002)
        rbox('btn_led_%d' % k, T(a, .005, .0085), (.006, .0012, .0008), 'led_red' if k in (2, 3) else 'stitch_dk', X=X, Y=Y, Z=Z, bevel=0)
    # 手機置物槽
    X, Y, Z = tilt_axes(40)
    rbox('tray', (0, .60, .412), (.1, .035, .006), 'rubber', X=X, Y=Y, Z=Z, bevel=.004)
    tube('tray_trim', [(-.105, .64, .39), (.105, .64, .39)], .0022, 'satin_alu', sides=6)


# 駕駛座周圍的碳纖弧形飾條：從門邊沿著前臉下緣繞過來，順著中控台側邊往後
def monoposto():
    pts = [(.592, .745, .39), (.56, .69, .405), (.48, .668, .415), (.36, .662, .418), (.26, .666, .412), (.205, .668, .40), (.182, .655, .405), (.178, .61, .44), (.172, .55, .50), (.165, .51, .50), (.16, .497, .40), (.158, .495, .25), (.158, .497, .10)]
    tube('mono_arc', pts, .0085, 'carbon', sides=6)
    tube('mono_edge', [(x, y + .009, z - .002) for x, y, z in pts[:7]], .0022, 'satin_alu', sides=6)


# ═══════════════ 中央通道：鋼琴黑面板、排檔撥桿、旋鈕、扶手 ═══════════════
def console():
    st = [(.58, .48, .92), (.50, .485, 1), (.30, .49, 1), (.0, .495, 1), (-.20, .50, 1), (-.25, .53, 1), (-.45, .545, 1), (-.62, .55, 1), (-.68, .54, .9)]
    rings, tops = [], []
    for z, yt, s in st:
        pts = [(-.17, FY + .01), (-.155, .33), (-.135, yt - .03), (-.115, yt), (.115, yt), (.135, yt - .03), (.155, .33), (.17, FY + .01)]
        rings.append([(x * s, y, z) for x, y in pts])

    def m(i, j):
        z = (st[i][0] + st[i + 1][0]) / 2
        if j == 3:
            return 'leather_blk' if z < -.22 else 'gloss_blk'
        if j in (1, 2, 4, 5):
            return 'leather_blk2'
        return 'plastic_blk'
    mk('console', *loft(rings, m, caps=('plastic_blk', 'plastic_blk'))[:3], sub=2)
    # 排檔撥桿：鋁底座、短撥桿、皮革握把＋鋁頂
    zs = .16
    rbox('shift_base', (0, .5, zs), (.05, .008, .07), 'satin_alu', bevel=.006)
    rbox('shift_gate', (0, .506, zs), (.012, .004, .05), 'rubber', bevel=.003)
    t = math.radians(18)
    Yv, Zv = (0, math.cos(t), math.sin(t)), (0, -math.sin(t), math.cos(t))
    rbox('shift_stem', (0, .54, zs - .005), (.012, .035, .016), 'dark_alu', Y=Yv, Z=Zv, bevel=.005)
    rbox('shift_grip', (0, .585, zs - .02), (.026, .022, .05), 'leather_blk', Y=Yv, Z=Zv, bevel=.016)
    rbox('shift_top', (0, .607, zs - .026), (.02, .004, .04), 'satin_alu', Y=Yv, Z=Zv, bevel=.003)
    rbox('shift_btn', (0, .6, zs + .025), (.008, .006, .004), 'led_red', Y=Yv, Z=Zv, bevel=.002)
    # 旋鈕與周圍按鍵、電子手煞車
    zk = -.06
    cyl('mmi_knob', (0, .497, zk), (0, 1, 0), (0, 0, 1), .024, 0, .022, 'satin_alu', segs=32, mat_cap='dark_alu')
    torus('mmi_ring', (0, .499, zk), (0, 1, 0), (0, 0, 1), .033, .003, 'satin_alu', segs=40, rs=6)
    for k, (a, b) in enumerate(((-.06, .03), (.06, .03), (-.06, -.03), (.06, -.03))):
        rbox('mmi_btn_%d' % k, (a, .499, zk + b), (.018, .004, .01), 'plastic_blk', bevel=.003)
    rbox('epb', (.07, .499, .03), (.012, .005, .02), 'dark_alu', bevel=.004)
    # 扶手蓋的接縫與杯架蓋
    rbox('arm_lid_gap', (0, .534, -.24), (.11, .003, .003), 'gloss_blk', bevel=0)
    rbox('cup_lid', (0, .497, -.15), (.09, .004, .05), 'carbon', bevel=.004, uv_rep=.05)


# ═══════════════ 門板前端（跟著門走，補到儀表板端） ═══════════════
def door_front(sgn):
    # 和儀表板前臉同一個剖面，z < .7、y < .8 在門框裡、|x| > .6，開門時跟著門走
    prof = [(.40, .795), (.376, .795), (.378, .74), (.395, .69), (.43, .63), (.50, .565), (.60, .53), (.69, .52), (.69, .795)]
    xs = [sgn * v for v in (.606, .615, .68, .735, .745)]
    if sgn < 0:
        xs = xs[::-1]
    mk('door_cap_%d' % (sgn > 0), *loft([[(x, y, z) for z, y in prof] for x in xs], lambda i, j: 'leather_blk2' if j < 3 else 'plastic_blk', caps=('plastic_blk', 'plastic_blk'))[:3], sub=1)


# ═══════════════ 建模 ═══════════════
for sx, tag in ((.435, 'L'), (-.435, 'R')):
    seat(sx, tag, z0=.30, z1=-.24, vsF=.34, vsR=.275, W=.25, base=(.255, -.205), tilt=20, H=.80, main='leather_blk', insert='quilt',
         shell='carbon', bottom='plastic_blk', side='leather_blk', rep=.09, floor_y=FY)
W = Wheel((.435, .81, .291), 18)
steering(W, R=.138, flat=-.112, spokes='r8', keys_uv=((256, 640), (384, 640)), hub_size=(.058, .052), a=(.013, .0155), ag=(.016, .017))
column(W, length=.22)
cluster((.435, .856, .43), 15, .30, .1125, (0, 0, 512, 192), hood=(.185, .12, -.045, .06), hood_out='dash_top', stitch='stitch_red')
dash()
monoposto()
console()
for sgn in (1, -1):
    door_card(sgn, -.30, .68, .765, .85, .23, .55, .79, arm=(-.25, .35), upper='quilt', arm_mat='leather_blk', lower='plastic_blk', ledge='leather_blk2', insert_z=(-.2, .5))
    door_front(sgn)
floor(FY, fx=(.15, .76), fz=(-.62, .62), toe=(.62, .88, .34), fw=(.90, .72, .50), kick=(.75, .70, .92, .62), sill=(.78, .05, .20, -.35, .70),
      pedals=(.80, .31, [(.455, .04, .034), (.33, .022, .055)], .58), apillar=[(.66, .84, .97), (.74, .83, .93), (.60, 1.07, .48), (.68, 1.07, .44)], xc=.44)
finish([
    ('seat_', both('quilt', 'leather_blk'), 'stitch_red', (-.0035, .0035)),
    ('dash_top', both('dash_top', 'leather_blk'), 'stitch_red', (0,)),
    ('dash_top', both('dash_top', 'dash_top2'), 'stitch_red', (-.0035, .0035)),
    ('dash_face', both('leather_blk2', 'plastic_blk'), 'stitch_red', (0,)),
    ('door_cap', both('leather_blk2', 'plastic_blk'), 'stitch_red', (0,)),
    ('console', both('leather_blk', 'leather_blk2') | both('gloss_blk', 'leather_blk2'), 'stitch_red', (-.0035, .0035)),
    ('door_card', both('quilt', 'leather_blk') | both('quilt', 'leather_blk2'), 'stitch_red', (-.0035, .0035)),
])
