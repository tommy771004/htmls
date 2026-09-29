# 191 影中屋：兩位主持人（一整塊蒙皮網格 + 11 根骨頭）→ people.glb
# 重建：/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P assets/191/build_people.py
#   環境變數 PREVIEW=資料夾 會另存預覽圖
# 服裝與髮型依影片畫面：A 捲髮、黑色長大衣、黑長褲；B 及肩直髮、深色長袖上衣外罩丹寧背心、黑色長裙。
# 臉部、手與衣服的細部是依畫面印象補做的推測，不是量測。
# 骨架沿用 190 的做法：骨頭全部朝上、沒有滾轉，匯出後靜止旋轉是單位四元數，網頁直接改 bone.rotation。
# 先以 190 工人的比例（身高約 1.84 m）建模，最後整體縮放到各自身高。
import sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lb_lib import *

HERE = os.path.dirname(os.path.abspath(__file__))
PREVIEW = os.environ.get('PREVIEW')
reset()


def add(p, d):
    return (p[0] + d[0], p[1] + d[1], p[2] + d[2])


BONES = [  # 名稱, 關節位置（190 比例、three 座標）, 父骨
    ('hips', (0, .94, 0), None), ('torso', (0, 1.02, 0), 'hips'), ('head', (0, 1.58, 0), 'torso'),
    ('upL', (.25, 1.47, 0), 'torso'), ('foreL', (.27, 1.18, 0), 'upL'), ('upR', (-.25, 1.47, 0), 'torso'), ('foreR', (-.27, 1.18, 0), 'upR'),
    ('thighL', (.1, .89, 0), 'hips'), ('shinL', (.1, .47, 0), 'thighL'), ('thighR', (-.1, .89, 0), 'hips'), ('shinR', (-.1, .47, 0), 'thighR'),
]
SEG = {
    'hips': ((0, .8, 0), (0, 1.0, 0)), 'torso': ((0, 1.06, 0), (0, 1.47, 0)), 'head': ((0, 1.63, 0), (0, 1.86, 0)),
    'upL': ((.25, 1.46, 0), (.27, 1.21, 0)), 'foreL': ((.27, 1.15, 0), (.27, .78, 0)),
    'upR': ((-.25, 1.46, 0), (-.27, 1.21, 0)), 'foreR': ((-.27, 1.15, 0), (-.27, .78, 0)),
    'thighL': ((.1, .86, 0), (.1, .5, 0)), 'shinL': ((.1, .44, 0), (.1, -.05, .05)),
    'thighR': ((-.1, .86, 0), (-.1, .5, 0)), 'shinR': ((-.1, .44, 0), (-.1, -.05, .05)),
}


def seg_d(p, a, b):
    a, b = Vector(a), Vector(b)
    ab = b - a
    t = max(0.0, min(1.0, (p - a).dot(ab) / ab.dot(ab)))
    return (p - (a + ab * t)).length


def skin(ob, bones, power=6.0):
    bpy.context.view_layer.update()
    mw = ob.matrix_world
    groups = {b: (ob.vertex_groups.get(b) or ob.vertex_groups.new(name=b)) for b in bones}
    for v in ob.data.vertices:
        if len(bones) == 1:
            groups[bones[0]].add([v.index], 1.0, 'REPLACE')
            continue
        p = T(mw @ v.co)
        ws = sorted(((1.0 / (seg_d(p, *SEG[b]) + .012) ** power, b) for b in bones), reverse=True)[:3]
        s = sum(w for w, _ in ws)
        for w, b in ws:
            if w / s > .01:
                groups[b].add([v.index], w / s, 'REPLACE')
    return ob


def skirt_skin(ob, top_y):
    """長大衣下擺與長裙：上緣全跟骨盆，越往下越跟著同側大腿（中線兩側各半），避免走路時撕開"""
    bpy.context.view_layer.update()
    mw = ob.matrix_world
    g = {b: (ob.vertex_groups.get(b) or ob.vertex_groups.new(name=b)) for b in ('hips', 'thighL', 'thighR')}
    for v in ob.data.vertices:
        p = T(mw @ v.co)
        k = max(0.0, min(1.0, (top_y - p.y) / .45)) * .62
        side = max(-1.0, min(1.0, p.x / .09))
        wl, wr = k * (.5 + .5 * side), k * (.5 - .5 * side)
        g['hips'].add([v.index], 1 - k, 'REPLACE')
        if wl > .01:
            g['thighL'].add([v.index], wl, 'REPLACE')
        if wr > .01:
            g['thighR'].add([v.index], wr, 'REPLACE')
    return ob


def resample(pts, radii, step=.026):
    P_ = [Vector(p) for p in pts]
    out, rr = [], []
    for i in range(len(P_) - 1):
        n = max(1, int((P_[i + 1] - P_[i]).length / step))
        for k in range(n):
            t = k / n
            out.append(tuple(P_[i].lerp(P_[i + 1], t)))
            rr.append(radii[i] + (radii[i + 1] - radii[i]) * t)
    out.append(tuple(P_[-1]))
    rr.append(radii[-1])
    return out, rr


def limb(name, role, color, pts, radii, seg=20, caps=True, flat=1.0):
    p2, r2 = resample(pts, radii)
    return finish(bm_tube(p2, r2, seg, caps, flat, up=(0, 0, 1)), name, role, color, var=.03)


def fabric(ob, amp=.0022, freq=36, fold=0.0, fold_freq=9.0):
    """布料：細微起伏＋可選的垂直褶痕（長大衣、長裙）"""
    me = ob.data
    for v in me.vertices:
        d = noise.noise(v.co * freq) * amp
        if fold:
            ang = math.atan2(v.co.x, -v.co.y)
            d += math.sin(ang * fold_freq + noise.noise(v.co * 4) * 2.2) * fold * max(0.0, min(1.0, (1.0 - v.co.z) * 1.6))
        v.co = v.co + v.normal * d
    me.update()


def curls(ob, amp=.012, freq=34):
    me = ob.data
    for v in me.vertices:
        n = noise.noise(v.co * freq) + .5 * noise.noise(v.co * freq * 2.3)
        v.co = v.co + v.normal * abs(n) * amp
    me.update()


def host(tag, P):
    """P：外觀參數；回傳 (骨架, 身體網格)"""
    BODY = []

    def B_(ob, *bones, cloth=False, fold=0.0, skirt=None):
        if cloth:
            fabric(ob, fold=fold)
        if skirt is not None:
            skirt_skin(ob, skirt)
        else:
            skin(ob, list(bones))
        BODY.append(ob)
        return ob

    SK, HAIR = P['skin'], P['hair']
    H = (0, .94, 0)
    S = (0, 1.02, 0)
    HD = (0, 1.58, 0)
    fem = P['female']

    # ── 腿與鞋 ──
    for sx, tg in ((1, 'L'), (-1, 'R')):
        th, sh = 'thigh' + tg, 'shin' + tg
        if not fem:
            B_(limb('leg', 'cloth', P['pants'], [(sx * .095, .98, 0), (sx * .1, .89, 0), (sx * .102, .72, .004), (sx * .1, .5, .008), (sx * .1, .45, .01), (sx * .098, .3, 0), (sx * .097, .11, -.004)],
                    [.092, .096, .092, .082, .08, .076, .075], seg=22), 'hips', th, sh, cloth=True)
            # 褲腳落在鞋面上的一圈皺褶
            B_(lathe('hem', 'cloth', P['pants'], [(.078, -.02), (.083, 0), (.081, .03)], (sx * .097, .1, 0), 22, cap_top=False, cap_bot=False), sh, cloth=True)
        else:
            # 長裙下只露出腳踝：黑色褲襪
            B_(limb('leg', 'cloth', P['tights'], [(sx * .095, .95, 0), (sx * .1, .72, .004), (sx * .1, .47, .01), (sx * .094, .25, 0), (sx * .085, .1, -.004)],
                    [.085, .08, .066, .052, .042], seg=18), 'hips', th, sh)
        KN = (sx * .1, .45, 0)
        shoe, sole = P['shoe'], P['sole']
        if fem:  # 平底鞋
            B_(box('ft', 'shoe', shoe, add(KN, (0, -.405, .05)), (.085, .05, .235), .025, smooth=True), sh)
            B_(ell('tc', 'shoe', shoe, add(KN, (0, -.405, .15)), (.043, .026, .05)), sh)
            B_(box('so', 'shoe', sole, add(KN, (0, -.437, .05)), (.088, .014, .245), .006), sh)
        else:  # 黑色德比鞋
            B_(box('ft', 'shoe', shoe, add(KN, (0, -.39, .045)), (.1, .075, .255), .035, smooth=True), sh)
            B_(ell('tc', 'shoe', shoe, add(KN, (0, -.395, .15)), (.051, .036, .058)), sh)
            B_(box('so', 'shoe', sole, add(KN, (0, -.435, .05)), (.106, .022, .285), .008), sh)
            B_(box('he', 'shoe', sole, add(KN, (0, -.428, -.055)), (.098, .036, .075), .008), sh)
            for i in range(3):
                B_(box('la', 'shoe', 0x3a3a3c, add(KN, (0, -.35 - i * .013, .07 + i * .02)), (.05, .004, .007), .002, rot=(-.6, 0, (.25 if i % 2 else -.25))), sh)

    # ── 骨盆 ──
    if not fem:
        B_(lathe('p1', 'cloth', P['pants'], [(.15, -.14), (.168, -.08), (.172, 0), (.17, .06), (.166, .095)], H, 30, 1, .72), 'hips', cloth=True)
        B_(ell('p2', 'cloth', P['pants'], add(H, (0, -.12, 0)), (.13, .07, .1), 20, 12), 'hips', 'thighL', 'thighR')

    # ── 軀幹 ──
    if not fem:
        # 內搭黑色高領，只看得到領口
        B_(lathe('tn', 'cloth', P['inner'], [(.064, .53), (.07, .545), (.071, .6), (.066, .61)], S, 24, 1, .95, cap_top=False, cap_bot=False), 'torso', 'head', cloth=True)
        # 長大衣：從肩膀一路到膝上，前襟重疊處是一條暗縫
        prof = [(.21, -.5), (.205, -.38), (.196, -.24), (.19, -.1), (.186, 0), (.19, .1), (.2, .2), (.212, .32), (.218, .41), (.2, .48), (.16, .53), (.1, .565), (.075, .575)]
        B_(lathe('coat', 'cloth', P['coat'], [(r, y) for r, y in prof if y >= -.1], S, 36, 1, .62, cap_top=False, cap_bot=False), 'hips', 'torso', cloth=True)
        B_(lathe('skirt', 'cloth', P['coat'], [(r, y) for r, y in prof if y <= -.1], S, 36, 1.02, .66, cap_top=False, cap_bot=False), cloth=True, fold=.004, skirt=S[1] - .1)
        B_(box('seam', 'cloth', P['coat_dark'], add(S, (.012, -.02, .126)), (.006, 1.02, .004), .001), 'hips', 'torso')
        # 翻領、立領與扣子
        for sx in (1, -1):
            B_(tube('lap', 'cloth', P['coat_lap'], [add(S, (sx * .062, .56, .065)), add(S, (sx * .085, .47, .105)), add(S, (sx * .07, .36, .122)), add(S, (sx * .02, .28, .128))], [.012, .016, .014, .008], 8, flat=.28), 'torso')
        B_(lathe('col', 'cloth', P['coat_lap'], [(.08, .55), (.086, .565), (.083, .61), (.078, .615)], S, 28, 1, .92, cap_top=False, cap_bot=False), 'torso', 'head')
        for i, y in enumerate((.22, .08, -.06, -.2)):
            B_(cyl('bt', 'button', 0x1a1a1b, add(S, (-.02, y, .124 if y > -.1 else .132)), add(S, (-.02, y, .132 if y > -.1 else .14)), .011, 12), 'torso' if y > 0 else 'hips')
        for sx in (1, -1):  # 口袋蓋
            B_(box('pk', 'cloth', P['coat_lap'], add(S, (sx * .12, -.14, .116)), (.12, .03, .012), .005, rot=(0, sx * .42, 0)), 'hips')
        # 後背中縫開衩
        B_(box('vent', 'cloth', P['coat_dark'], add(S, (0, -.36, -.138)), (.004, .28, .004), .001), cloth=False, skirt=S[1] - .1)
    else:
        # 深色長袖上衣（領口圓領）
        B_(lathe('top', 'cloth', P['top'], [(.155, -.03), (.16, .05), (.172, .16), (.182, .28), (.185, .38), (.172, .46), (.14, .51), (.09, .545), (.06, .56)], S, 32, 1, .6, cap_top=False), 'hips', 'torso', cloth=True)
        B_(lathe('neck', 'cloth', P['top'], [(.058, .555), (.062, .565), (.06, .575)], S, 24, 1, .92, cap_top=False, cap_bot=False), 'torso')
        # 丹寧背心：比上衣寬一圈，前開襟，下擺在臀部
        vp = [(.2, -.16), (.198, -.06), (.19, .06), (.192, .18), (.198, .3), (.199, .4), (.186, .47), (.15, .51), (.11, .535)]
        vest_bm = bm_lathe([(r, y) for r, y in vp], 36, 1, .66, cap_top=False, cap_bot=False)
        bmesh.ops.delete(vest_bm, geom=[f for f in vest_bm.faces if (lambda c: c.z > 0 and abs(c.x) < .018 + max(0, c.y - .3) * .5)(f.calc_center_median())], context='FACES')
        # 袖孔
        bmesh.ops.delete(vest_bm, geom=[f for f in vest_bm.faces if (lambda c: abs(c.x) > .165 and .3 < c.y < .47 and abs(c.z) < .06)(f.calc_center_median())], context='FACES')
        vo = finish(vest_bm, 'vest', 'denim', P['denim'], S, var=.08)
        B_(vo, 'hips', 'torso', cloth=True)
        for i in range(34):  # 下擺的鬚邊
            a = -math.pi + (i + .5) / 34 * 2 * math.pi
            if abs(math.sin(a)) < .09 and math.cos(a) > 0:
                continue
            x, z = math.sin(a) * .2, math.cos(a) * .2 * .66
            B_(box('fr', 'denim', P['fray'], add(S, (x, -.175, z)), (.006, .035, .006), .001, rot=(0, a, 0)), skirt=S[1] - .16)
        for sx in (1, -1):
            B_(box('vpk', 'denim', P['denim_dark'], add(S, (sx * .1, .3, .128)), (.085, .08, .01), .004, rot=(0, sx * .38, 0)), 'torso')
            B_(box('vpf', 'denim', P['denim_dark'], add(S, (sx * .1, .345, .132)), (.088, .018, .012), .003, rot=(0, sx * .38, 0)), 'torso')
            B_(tube('vs', 'denim', P['denim_dark'], [add(S, (sx * .018, -.15, .131)), add(S, (sx * .022, .2, .13)), add(S, (sx * .07, .46, .1)), add(S, (sx * .1, .53, .03))], .006, 6, flat=.4), 'hips', 'torso')
        for y in (.3, .17, .04, -.09):
            B_(cyl('vb', 'button', 0xb9b2a4, add(S, (.028, y, .128)), add(S, (.028, y, .134)), .008, 10), 'torso' if y > .05 else 'hips')
        # 黑色長裙：腰到腳踝，越往下越寬，有垂直褶
        B_(lathe('skirt', 'cloth', P['skirt'], [(.16, .02), (.172, -.06), (.19, -.2), (.215, -.4), (.24, -.6), (.262, -.78), (.272, -.9), (.27, -.92)], S, 44, 1, .78, cap_top=False, cap_bot=False), cloth=True, fold=.009, skirt=S[1])
        B_(lathe('sw', 'cloth', P['skirt'], [(.158, .0), (.164, .02), (.164, .06), (.158, .07)], S, 30, 1, .7, cap_top=False, cap_bot=False), 'hips')

    # ── 肩膀 ──
    for sx, up in ((1, 'upL'), (-1, 'upR')):
        col = P['coat'] if not fem else P['top']
        B_(ell('sh', 'cloth', col, add(S, (sx * .178, .445, 0)), (.078, .058, .078), 22, 12), 'torso', up, cloth=True)

    # ── 手臂、手 ──
    for sx, tg in ((1, 'L'), (-1, 'R')):
        up, fo = 'up' + tg, 'fore' + tg
        col = P['coat'] if not fem else P['top']
        r = [.055, .064, .064, .06, .056, .052, .048] if not fem else [.048, .054, .053, .049, .045, .041, .038]
        B_(limb('arm', 'cloth', col, [(sx * .19, 1.465, 0), (sx * .245, 1.452, 0), (sx * .258, 1.42, 0), (sx * .268, 1.31, 0), (sx * .272, 1.18, .004), (sx * .27, 1.05, .004), (sx * .27, .975, 0)], r), 'torso', up, fo, cloth=True)
        B_(lathe('cu', 'cloth', P['coat_lap'] if not fem else P['top'], [(r[-1] + .003, -.02), (r[-1] + .006, -.01), (r[-1] + .006, .012), (r[-1] + .002, .02)], (sx * .27, .975, 0), 20, cap_top=False, cap_bot=False), fo)
        # 手：手腕、手掌、四指、拇指
        Wp = (sx * .27, .95, 0)
        B_(lathe('wr', 'skin', SK, [(.03, -.03), (.032, 0), (.034, .03)], Wp, 16), fo)
        pm = bm_box((.07, .085, .03), .014, 3)
        B_(finish(pm, 'pm', 'skin', SK, add(Wp, (0, -.07, .006)), smooth=True), fo)
        for i in range(4):
            fx = -.025 + i * .0167
            L = [.92, 1.0, .96, .78][i]
            B_(tube('fg', 'skin', SK, [add(Wp, (fx * sx, -.108, .008)), add(Wp, (fx * sx * 1.05, -.108 - .03 * L, .012)), add(Wp, (fx * sx * 1.08, -.108 - .052 * L, .022)), add(Wp, (fx * sx * 1.08, -.108 - .068 * L, .034))],
                  [.0085, .008, .0074, .0066], 8), fo)
            B_(ell('nl', 'nail', 0xe9c7b3 if fem else 0xd9b39c, add(Wp, (fx * sx * 1.08, -.108 - .066 * L, .041)), (.005, .007, .002), 8, 4), fo)
        B_(tube('th', 'skin', SK, [add(Wp, (-sx * .028, -.045, .016)), add(Wp, (-sx * .042, -.075, .032)), add(Wp, (-sx * .042, -.098, .045))], [.011, .0095, .0082], 8), fo)

    # ── 脖子與頭 ──
    B_(lathe('nk', 'skin', SK, [(.05, -.06), (.053, .0), (.055, .05), (.052, .1)], HD, 22, cap_top=False, cap_bot=False), 'torso', 'head')
    hr = (.09, .116, .102) if not fem else (.086, .112, .098)
    hb = bm_ell(hr, 32, 22)
    for v in hb.verts:
        y = v.co.y
        if y < -.02:  # 下顎往內收
            k = 1 - (-.02 - y) * (1.35 if not fem else 1.55)
            v.co.x *= k
            v.co.z = v.co.z * (1 - (-.02 - y) * .45)
        if v.co.z > .05:
            v.co.x *= 1 - (v.co.z - .05) * .9
        for sxx in (1, -1):  # 顴骨
            d = (Vector(v.co) - Vector((sxx * .056, -.01, .068))).length
            if d < .035:
                v.co = Vector(v.co) * (1 + (.035 - d) * .25)
        for sxx in (1, -1):  # 眼窩
            d = (Vector(v.co) - Vector((sxx * .035, .018, .094))).length
            if d < .024:
                v.co.z -= (.024 - d) * .35
        d = (Vector(v.co) - Vector((0, .05, .09))).length  # 眉骨
        if d < .05:
            v.co.z += (.05 - d) * .12
    HC = add(HD, (0, .14, .005))
    B_(finish(hb, 'h2', 'skin', SK, HC), 'head')
    # 眼睛：眼白、虹膜、瞳孔、上眼瞼
    for sx in (1, -1):
        E = add(HC, (sx * .035, .018, .078))
        B_(ell('ew', 'eye', 0xeee9e2, E, (.0125, .0105, .0105), 14, 8), 'head')
        B_(ell('ei', 'eye', 0x3a2a20, add(E, (0, 0, .0095)), (.0065, .0065, .0022), 12, 6), 'head')
        B_(ell('ep', 'eye', 0x0e0b0a, add(E, (0, 0, .0112)), (.0032, .0032, .001), 10, 4), 'head')
        B_(tube('lid', 'skin', SK, [add(E, (-.014, .002, .004)), add(E, (0, .0085, .011)), add(E, (.014, .002, .004))], .0028, 6), 'head')
        B_(tube('eb', 'hair', HAIR, [add(HC, (sx * .018, .042, .093)), add(HC, (sx * .036, .047, .092)), add(HC, (sx * .054, .042, .082))], [.0035, .004, .0025] if not fem else [.0028, .003, .0018], 6, flat=.45), 'head')
    # 鼻子、嘴、下巴、耳朵
    B_(tube('ns', 'skin', SK, [add(HD, (0, .163, .097)), add(HD, (0, .135, .107)), add(HD, (0, .12, .113))], [.009, .011, .012] if not fem else [.008, .0095, .0105], 10), 'head')
    B_(ell('nt', 'skin', SK, add(HD, (0, .116, .106)), (.018, .011, .012) if not fem else (.015, .0095, .0105)), 'head')
    for sx in (1, -1):
        B_(ell('na', 'skin', SK, add(HD, (sx * .014, .112, .104)), (.007, .007, .008)), 'head')
    lip = P['lip']
    for yy, zz, rr in ((.0795, .0955, .0032), (.0725, .0945, .0038)):
        B_(tube('lp', 'lip', lip, [add(HD, (-.018, yy + .0025, zz - .008)), add(HD, (-.008, yy, zz - .001)), add(HD, (0, yy - .0005, zz)), add(HD, (.008, yy, zz - .001)), add(HD, (.018, yy + .0025, zz - .008))], rr, 8), 'head')
    B_(tube('lm', 'lip', 0x5a302a, [add(HD, (-.017, .0785, .0905)), add(HD, (0, .0762, .0975)), add(HD, (.017, .0785, .0905))], .0011, 6), 'head')
    B_(ell('ch', 'skin', SK, add(HD, (0, .054, .066)), (.024, .014, .016)), 'head')
    for sx in (1, -1):
        B_(ell('er', 'skin', SK, add(HD, (sx * .089, .13, -.005)), (.011, .03, .021)), 'head')
        B_(ell('ei2', 'skin', 0xb98a74, add(HD, (sx * .095, .13, 0)), (.004, .016, .01)), 'head')

    # ── 頭髮 ──
    HCN = add(HD, (0, .146, -.008))
    if not fem:
        # 蓬鬆捲髮：髮帽（髮際線在額頭上緣）＋一簇簇小捲
        hb2 = bm_ell((.1, .124, .11), 32, 20)
        bmesh.ops.delete(hb2, geom=[f for f in hb2.faces if (lambda c: (c.z > .02 and c.y < .066) or c.y < -.075 or (c.z > -.04 and c.y < .025))(f.calc_center_median())], context='FACES')
        ho = finish(hb2, 'hc', 'hair', HAIR, HCN, var=.1)
        curls(ho, .012, 34)
        B_(ho, 'head')
        rnd = random.Random(7)
        n = 0
        while n < 90:
            th = rnd.uniform(-math.pi, math.pi)
            ph = rnd.uniform(0, 1.45)
            x, y, z = math.sin(th) * math.sin(ph) * .1, math.cos(ph) * .124, math.cos(th) * math.sin(ph) * .11
            if z > .02 and y < .07:
                continue  # 不蓋住額頭與眼睛
            if y < -.07 or (z > -.04 and y < .03):
                continue
            rr = rnd.uniform(.016, .024)
            o = ell('cr', 'hair', HAIR, add(HCN, (x * 1.06, y * 1.04, z * 1.06)), (rr, rr * .8, rr), 9, 6, var=.18)
            curls(o, .005, 70)
            B_(o, 'head')
            n += 1
        # 前額垂下的幾綹
        for k, dx in enumerate((-.045, -.012, .02, .05)):
            B_(tube('fr', 'hair', HAIR, [add(HCN, (dx, .118, .058)), add(HCN, (dx * 1.1, .1, .1)), add(HCN, (dx * 1.15 + .008, .075, .112))], [.016, .012, .006], 8), 'head')
    else:
        # 及肩直髮：頭頂髮帽（中分）＋兩側與後腦垂到下巴下方的髮簾，臉前方留開口
        hb2 = bm_ell((.102, .126, .112), 34, 20)
        bmesh.ops.delete(hb2, geom=[f for f in hb2.faces if (lambda c: c.y < .02 or (c.z > .03 and c.y < .07))(f.calc_center_median())], context='FACES')
        ho = finish(hb2, 'hc', 'hair', HAIR, HCN, var=.06)
        fabric(ho, .0015, 80)
        B_(ho, 'head')
        prof = [(.106, .085), (.112, .03), (.114, -.03), (.112, -.09), (.108, -.15), (.104, -.2), (.098, -.23), (.09, -.24)]
        cur = bm_lathe(prof, 30, 1.0, 1.08, cap_top=False, cap_bot=False, a0=.95, a1=2 * math.pi - .95)
        co = finish(cur, 'hcur', 'hair', HAIR, HCN, var=.06)
        fabric(co, .0018, 90)
        B_(co, 'head', 'torso')
        # 髮簾內層（從臉的方向看進去也有頭髮）
        cur2 = bm_lathe([(r - .01, y) for r, y in prof], 30, 1.0, 1.08, cap_top=False, cap_bot=False, a0=.95, a1=2 * math.pi - .95)
        B_(finish(cur2, 'hcur2', 'hair', 0x0e0b0a, HCN, var=.04), 'head', 'torso')
        # 中分線與垂在臉頰兩側、貼著額頭的髮束
        B_(tube('part', 'hair', 0x0c0a09, [add(HCN, (0, .122, .05)), add(HCN, (0, .128, 0)), add(HCN, (0, .118, -.06))], .002, 5), 'head')
        for sx in (1, -1):
            B_(tube('lk', 'hair', HAIR, [add(HCN, (sx * .05, .085, .088)), add(HCN, (sx * .08, .055, .082)), add(HCN, (sx * .094, .02, .072)), add(HCN, (sx * .1, -.05, .06)), add(HCN, (sx * .097, -.16, .055)), add(HCN, (sx * .092, -.225, .05))],
                    [.01, .014, .016, .016, .014, .008], 10, flat=.42), 'head', 'torso')

    body = join(BODY, '%s_body' % tag)
    smooth_by_angle(body, 55)
    return body


PARAMS = {
    'HostA': dict(female=False, height=1.74, kx=1.0, skin=0xd9b194, hair=0x221a15, lip=0xb57a6c, pants=0x1c1c1e, coat=0x242426, coat_dark=0x121213,
                  coat_lap=0x2c2c2f, inner=0x151516, shoe=0x1a1a1b, sole=0x2e2c2a),
    'HostB': dict(female=True, height=1.62, kx=.94, skin=0xe6c4a8, hair=0x15110f, lip=0xbf7f74, top=0x252b36, denim=0x3a4f6d, denim_dark=0x2e4059,
                  fray=0x8898ae, skirt=0x19191b, tights=0x1d1d20, shoe=0x1b1b1c, sole=0x3a3632),
}

OUT = []
for tag, P in PARAMS.items():
    body = host(tag, P)
    s = P['height'] / 1.845
    kx = P['kx']
    # 縮放到身高（x 另外乘寬度係數）：網格直接改頂點，骨頭位置用同樣比例
    for v in body.data.vertices:
        c = T(v.co)
        v.co = V(c.x * s * kx, c.y * s, c.z * s)
    ao_bake([body], samples=24, floor=.5)
    arm = bpy.data.armatures.new('%s_Rig' % tag)
    rig = bpy.data.objects.new('%s_Rig' % tag, arm)
    bpy.context.scene.collection.objects.link(rig)
    bpy.context.view_layer.objects.active = rig
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    rig.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    for (n, p, par) in BONES:
        b = arm.edit_bones.new(n)
        b.head = V(p[0] * s * kx, p[1] * s, p[2] * s)
        b.tail = V(p[0] * s * kx, p[1] * s + .08, p[2] * s)
        b.roll = 0
        if par:
            b.parent = arm.edit_bones[par]
    bpy.ops.object.mode_set(mode='OBJECT')
    body.parent = rig
    mod = body.modifiers.new('Armature', 'ARMATURE')
    mod.object = rig
    OUT += [rig, body]
    print(tag, 'tris', tri_count([body]))

export(os.path.join(HERE, 'people.glb'), OUT)

if PREVIEW:
    bpy.data.objects['HostA_Rig'].location = V(-.45, 0, 0)
    bpy.data.objects['HostB_Rig'].location = V(.45, 0, 0)
    preview(os.path.join(PREVIEW, 'people_front.png'), target=(0, .95, 0), dist=3.6, yaw=0, pitch=4, res=(900, 1000), lens=50)
    preview(os.path.join(PREVIEW, 'people_side.png'), target=(0, .95, 0), dist=3.6, yaw=70, pitch=4, res=(900, 1000), lens=50)
    preview(os.path.join(PREVIEW, 'people_faceA.png'), target=(-.45, 1.58, 0), dist=.75, yaw=18, pitch=2, res=(800, 800), lens=50)
    preview(os.path.join(PREVIEW, 'people_faceB.png'), target=(.45, 1.47, 0), dist=.75, yaw=-18, pitch=2, res=(800, 800), lens=50)
