# 貝吉塔、特南克斯、比克、弗利沙、18 號（悟空與共用工具在 heroes.py）。
import math

import bmesh
from mathutils import Matrix

import kit
import realbody
import heroes
from kit import S, V, ang_bump, bump, lerp, smooth
from heroes import (
    ALLOW, BACK, FRONT, G_ARM_L, G_BELT, G_CHAIN, G_SKIRT, G_FOOT_L, G_FORE_L, G_FREE, G_HAND_L, G_LEG_L, G_NECK, G_PELVIS, G_TORSO,
    G_UPPER_L, G_CHEST, PI, TORSO_ROWS, Fig, anime_head, arm_skin, band, boot, finish, fist, hair, hair_cap, leg_tube,
    limb, mirror, neck, pair_add, path_loft, pelvis, sash_chain_weights, skirt_chain_weights, sleeve, sym, torso_rows, tree_of, baggy_leg,
)


def team_band(F, team, k=1.0, on=None, s=(0.155, 0.18), hug=False):
    """隊伍臂章（左上臂）。on＝袖子：臂章沿袖子表面貼合（fit_band，離表面 3 mm），綁骨群組和袖子相同。
    圓管的 band() 套在袖子外時，袖子的三角肌／二頭肌隆起會讓臂章一邊埋進袖子、一邊浮空，只露出幾塊青色碎片；
    群組不同（臂章只跟上臂、袖子跟骨熱）時，抬手也會一起錯開。
    s：臂章沿上臂的範圍（從肩關節起，公尺）；上臂有護具的角色（小櫻的護肘）要往上移，否則整圈被護具蓋住。
    hug：直接套在裸露（或被取代的皮膚部件塗色）的上臂上：換真人身體時內壁重新貼到真人手臂外（realbody.hug_fit），權重抄底下的皮膚。
    圓管照「真人皮膚−舊皮膚」平移時，底模上臂偏在骨軸下方，臂章一側陷進肉、一側浮起，18 號條紋袖在臂章上緣露出一截鋸齒白條。
    套在袖子外的角色（魯夫、索隆、香吉士）不能用：底下的皮膚縮在袖子裡，臂章會跟著陷進袖子。"""
    if on is not None:
        o = fit_band(F, on, 'teamL', [(0.155, 0, 0, 0.003), (0.1675, 0, 0, 0.0045), (0.18, 0, 0, 0.003)], team, G_ARM_L, thick=0.005, mat=5, ol=0.5)
        o['ride_on'] = on.name   # 換真人身體時跟著袖子一起挪（realbody.retarget）
        return o
    o = band('teamL', F.sh, F.da, s[0], s[1], 0.085 * F.k_arm * k, 0.083 * F.k_arm * k, team, G_UPPER_L, thick=0.006, mat=5, ol=0.5)
    if hug:
        o['hug'] = 0.0015
    return o


def arm_s(F, co):
    """頂點沿手臂的距離（從肩關節起）。"""
    return (co - F.sh).dot(F.da)


def arm_out(F, co, n):
    """法線朝手臂外側（遠離身體）的程度。"""
    side = V((0, 0, 1)).cross(F.da).normalized()
    return n.dot(side)


def belt_ring(F, y, h, pal, e=0.0, n=18, thick=0.012, mat=0, a=None, b=None):
    a = a or F.w * 1.18 + e
    b = b or F.cz * 0.9 + e
    o = limb('belt', V((0, y - h / 2, 0)), V((0, 1, 0)), [(0.0, a, b, None, 2.3), (h / 2, a * 1.02, b * 1.02, None, 2.3), (h, a, b, None, 2.3)], n=n, cap0=None, cap1=None)
    o = kit.subsurf(o, 2, solidify=thick)
    return kit.tag(o, pal, grp=G_BELT, mat=mat)


def strap_around(F, target, center, normal, width, thick, pal, name='strap', grp=G_CHEST, off=0.006, steps=28, arc=None, lay=False):
    """沿傾斜平面繞身體一圈的帶子（以射線貼合 target 表面）。arc＝(φ0, φ1) 只取一段。
    lay＝False（舊行為）：斷面的寬邊沿著射線方向（從身體表面立起來的鰭片，從正面只看得到一條細邊，一半埋在衣服裡）；
    lay＝True：寬邊沿著平面法線、平貼在表面上（真正的背帶），off 是帶子中心離表面的距離，要大於 thick。"""
    if isinstance(target, (list, tuple)):
        tmp = kit.join([kit.duplicate(t, 'tmp') for t in target], 'tmp_target')
        tr = tree_of(tmp)
        import bpy
        bpy.data.objects.remove(tmp, do_unlink=True)
    else:
        tr = tree_of(target)
    nrm = V(normal).normalized()
    u = V((0, 0, 1)).cross(nrm).normalized()
    w = nrm.cross(u).normalized()
    pts = []
    a0, a1 = arc if arc else (0, 2 * PI)
    for i in range(steps + 1):
        f = lerp(a0, a1, i / steps)
        d = u * math.cos(f) + w * math.sin(f)
        o = V(center) + d * 1.0
        hit = tr.ray_cast(o, -d, 2)
        if hit[0] is not None:
            pts.append(hit[0] + hit[1] * off)
    if lay:
        # loft 的斷面：side 投影到切線垂直面後就是射線（徑向）方向、front＝平面法線；徑向取厚度、法線方向取寬度
        ob = path_loft(name, pts, [thick] * len(pts), n=8, flat=width / thick, front=nrm, side=u, cap0='pole', cap1='pole')
    else:
        ob = path_loft(name, pts, [width] * len(pts), n=6, flat=thick / width, front=nrm, side=u, cap0='pole', cap1='pole')
    ob = kit.subsurf(ob, 1)
    return kit.tag(ob, pal, grp=grp, ol=0.6)


def plate(name, center, ax_u, ax_v, ax_n, ru, rv, rn, pal, grp, mat=2, ol=0.7):
    """貼在身上的橢圓甲片（弗利沙的紫色圓頂、甲片）。"""
    o = kit.quad_sphere(name, 1.0, cuts=4)
    au, av, an = V(ax_u).normalized(), V(ax_v).normalized(), V(ax_n).normalized()
    kit.deform(o, lambda p: V(center) + au * p.x * ru + av * p.y * rv + an * p.z * rn)
    o = kit.subsurf(o, 1)
    kit.recalc_normals(o)
    return kit.tag(o, pal, mat=mat, grp=grp, ol=ol)


# ================================================================ 貝吉塔
# 賽亞人篇戰鬥服（參考 01 FighterZ 立繪為準，04／05 GK 原型看甲片分片與位置）：
#   藍色緊身衣包住手臂與腿、白色胸背甲（從肩頂繞過腋下的 U 字袖孔）、往外上方翹的金色大肩甲（56° 俯視時頭以外最大的色塊）、
#   從胸下收成尖舌、蓋到胯前的金色橫紋腹甲、背後腰上的金色橫紋帶、兩側垂到大腿的金色側腰甲、棕色毛皮腰帶（尾巴，左後打結）、
#   白手套（手套口在前臂中段）、白靴（膝下喇叭口、金色鞋頭與鞋底包邊）。
# 舊版是一個白色的桶（甲片離緊身衣 2.8 cm、上緣開在肩線，脖子周圍一圈黑縫）加兩條像提把的金色背帶，沒有肩甲、腰帶與側腰甲，
# 上臂與前臂露出皮膚，靴口一圈金色。

def _tree_multi(objs):
    """多個物件合成一棵 BVH（射線貼合用）。"""
    import bpy
    tmp = kit.join([kit.duplicate(t, 'tmp') for t in objs], 'tmp_target')
    tr = tree_of(tmp)
    bpy.data.objects.remove(tmp, do_unlink=True)
    return tr


def _grid(name, nu, nv, fn, out):
    """(nu+1)×(nv+1) 的四邊形網格：fn(u, v) → 座標（u、v 都是 0..1）；out(co) 是希望的法線方向（中央那一格照它決定繞序）。"""
    bm = bmesh.new()
    vs = [[bm.verts.new(fn(i / nu, j / nv)) for j in range(nv + 1)] for i in range(nu + 1)]
    for i in range(nu):
        for j in range(nv):
            bm.faces.new((vs[i][j], vs[i + 1][j], vs[i + 1][j + 1], vs[i][j + 1]))
    bm.normal_update()
    bm.faces.ensure_lookup_table()
    f = bm.faces[(nu // 2) * nv + nv // 2]
    if f.normal.dot(out(f.calc_center_median())) < 0:
        bmesh.ops.reverse_faces(bm, faces=bm.faces)
    return kit.to_object(name, bm)


def _hash(i, k):
    """格點的偽亂數（−1..1），毛皮腰帶的起伏用；固定種子，每次建模結果一樣。"""
    x = math.sin(i * 12.9898 + k * 78.233) * 43758.5453
    return (x - math.floor(x)) * 2 - 1


def _bands(x, centers, hw):
    """一組條紋（凹紋、橫紋）的場：離最近的條紋中心不到 hw 時＜0。"""
    return min(abs(x - c) for c in centers) - hw


# 貝吉塔專屬的綁骨群組（權重全由自訂函式決定，左右共用一個群組、依 x 正負選骨頭）
G_VPAD = 76      # 肩甲：剛性，六成跟胸廓、四成跟鎖骨（舉手聳肩時肩甲跟著抬一點，不會壓進三角肌）
G_VTONGUE = 78   # 腹甲尖舌：腰帶以上和胸甲一樣（骨熱只取胸廓），腰帶以下漸漸交給骨盆與兩條大腿
G_VTAS = 79      # 側腰甲：上緣跟骨盆，往下漸漸交一半給同側大腿
ALLOW[G_VTONGUE] = ALLOW[G_CHEST]


def vegeta_pad_w(co):
    s = 'L' if co.x >= 0 else 'R'
    return [('ribs', 0.6), ('cl' + s, 0.4)]


def vegeta_tongue_w(F, yb, ytip):
    def fn(co, old):
        k = smooth((yb + 0.02 - co.y) / 0.1)
        if k <= 0.001:
            return old
        # 腰帶以下：左半片跟左大腿、右半片跟右大腿（中線兩側 4 cm 內漸變），往尖端漸增到八成。
        # 兩條大腿平分時，跑步、弓步抬起的那條大腿前緣整個從尖舌中段頂出來（間隙 3.6 cm 也擋不住）
        q = smooth((yb - co.y) / (yb - ytip))
        tk = 0.8 * q
        sl = smooth((co.x + 0.04) / 0.08)
        new = [('hips', 1 - tk), ('thL', tk * sl), ('thR', tk * (1 - sl))]
        return [(b, w * (1 - k)) for b, w in old] + [(b, w * k) for b, w in new]
    fn.blend = True
    return fn


def vegeta_tasset_w(yt, yb):
    def fn(co):
        s = 'L' if co.x >= 0 else 'R'
        k = 0.8 * smooth((yt - co.y) / (yt - yb))
        return [('hips', 1 - k), ('th' + s, k)]
    return fn


def vegeta_pad(F, gold, goldD, white):
    """左肩甲（參考 01／04）：從脖子旁的肩頂往外上方翹的翅膀形硬殼，尖端略高於下巴，兩片尖端距約 3.2 頭高；
    前後緣往下垂成拱頂（正面看根部高約 0.35 頭，蓋住三角肌頂），往尖端收窄；表面有 9 條從根部放射到尖端的凹紋，前後緣是白色滾邊。
    參數：u 從根部到尖端、v 從前緣（+z）到後緣。殼的下緣離三角肌頂約 4 cm，出拳、舉手時手臂不會頂進去。"""
    hh = F.hr * 1.667                          # 頭顱高（PROPS 的 hr 與量測的換算）
    x0, x1 = 0.4 * F.cx, 1.6 * hh              # 根部（頸側）與尖端的 x
    y0 = F.y(1.05) + 0.025                     # 根部上緣：斜方肌頂上 2.5 cm
    y1 = y0 + 0.08                             # 尖端：往外上方翹約 13°（參考 02 的上緣 15～25°，01 的尖端在下巴高度）
    zc = -0.008
    D = lambda u: 0.122 * (1 - 0.8 * u ** 1.8)          # 前後半深：根部蓋住肩頂的前後，尖端收成窄尖
    # 前後緣下垂量：參考 01 正面看得到肩甲朝前的一整片斜面（根部從頸根垂到三角肌頂、高約 0.5 頭），
    # 0.088 m 時正面只剩一條細細的弧帶
    Hg = lambda u: 0.13 * (1 - 0.7 * u ** 1.3)

    def pt(u, v):
        v = v * 2 - 1
        x = x0 + (x1 - x0) * u
        y = y0 + (y1 - y0) * u + 0.016 * math.sin(PI * u) - Hg(u) * abs(v) ** 1.6
        return V((x, y, zc + D(u) * v * (1 - 0.06 * v * v)))
    o = _grid('padL', 12, 10, pt, lambda co: V((0, 1, 0)))
    o = kit.subsurf(o, 2, solidify=0.012)

    def vpar(co):
        u = max(0.0, min(1.0, (co.x - x0) / (x1 - x0)))
        return (co.z - zc) / max(1e-4, D(u))
    kit.tag(o, gold, mat=2, grp=G_VPAD, ol=0.8)
    kit.paint_field(o, lambda co: _bands(vpar(co), [-0.72 + 1.44 * k / 8 for k in range(9)], 0.028), goldD, 2)
    kit.paint_field(o, lambda co: 0.86 - abs(vpar(co)), white, 2)
    o['trim'] = 1   # 不算「蓋住身體」：肩甲浮在肩頂上 4 cm，底下的皮膚不必收進去
    return o


def vegeta_tongue(F, targets, gold, goldD, yt, yb, ytip, W=0.088):
    """前方的金色腹甲（參考 01／04）：上緣圓弧在胸肌下緣正中，往下穿過腰帶、收成尖舌蓋到胯前；表面 10 多條橫紋。
    以射線從正前方貼到胸甲／緊身衣表面，再沿縱向往外撫平（胸甲下緣到緊身衣的台階變成斜坡，不會陷進去）。"""
    tr = _tree_multi(targets)
    nu, nv = 8, 26

    def half_w(t):
        if t < 0.15:
            return W * (0.6 + 0.4 * math.sqrt(max(0.0, 1 - ((0.15 - t) / 0.15) ** 2)))
        return W * (1 - 0.9 * ((t - 0.15) / 0.85) ** 1.5)
    rows = []
    for j in range(nv + 1):
        t = j / nv
        row = []
        for i in range(nu + 1):
            s = i / nu * 2 - 1
            x = s * half_w(t)
            y = yt - t * (yt - ytip)   # 上緣的圓弧由 half_w 收窄做出來（往下壓 y 會讓第一排越過第二排、細分加厚後折出尖刺）
            hit = tr.ray_cast(V((x, y, 0.6)), V((0, 0, -1)), 1.0)
            # 腰帶以下很快離開緊身衣（腰帶下 15 cm 起 3.6 cm）：尖舌蓋在小腹與兩條大腿根部前面，
            # 出拳弓步、跑步抬腿時大腿根部連同小腹往前鼓（底模的權重），間隙 2.4 cm 時從甲片中段頂出一塊塊藍色
            z = (hit[0].z if hit[0] is not None else F.cz) + 0.008 + 0.028 * smooth((yb + 0.015 - y) / 0.12)
            row.append([x, y, z])
        rows.append(row)
    base = [[p[2] for p in r] for r in rows]
    for _ in range(10):   # 沿縱向撫平、只往外推（取 max），台階變成斜坡
        for j in range(1, nv):
            for i in range(nu + 1):
                rows[j][i][2] = max(base[j][i], (rows[j - 1][i][2] + rows[j][i][2] + rows[j + 1][i][2]) / 3)
    o = _grid('tongue', nu, nv, lambda u, v: V(rows[round(v * nv)][round(u * nu)]), lambda co: V((0, 0, 1)))
    o = kit.subsurf(o, 2, solidify=0.007)
    kit.tag(o, gold, mat=0, grp=G_VTONGUE, ol=0.7)   # 霧面：亮面材質在這片朝前的平面上打出一整塊白色反光，看起來像破洞
    ys = [yt - 0.045 - 0.031 * k for k in range(int((yt - ytip - 0.06) / 0.031))]
    kit.paint_field(o, lambda co: _bands(co.y, ys, 0.0035), goldD, 2)
    # 不標 pin_bones：腰帶以上底下是胸甲（骨軸射線先碰到胸甲，已經釘住）；腰帶以下蓋著小腹與胯，釘到胸廓會讓那片皮膚不跟骨盆走
    return o


def vegeta_tasset(F, targets, gold, goldD, yt, yb, phc=0.24, hw=0.066):
    """左側腰甲（參考 01／04／05）：從腰帶垂到大腿上段、貼在大腿外側略偏前的金色甲片，寬約 0.5 頭，有橫紋；正前方與臀部沒有。
    沿水平射線從外側貼到骨盆／大腿表面，離表面的間隙往下漸大（2 cm），抬腿時才不會被大腿頂穿。"""
    tr = _tree_multi(targets)
    nu, nv = 6, 14
    pts = {}
    rr = []
    for j in range(nv + 1):
        t = j / nv
        y = yt - t * (yt - yb)
        row = []
        for i in range(nu + 1):
            s = i / nu * 2 - 1
            ph = phc + s * hw * (1 + 0.15 * t) / 0.16
            d = V((math.cos(ph), 0, math.sin(ph)))
            a = V((0, y, 0))
            hit = tr.ray_cast(a + d * 0.6, -d, 0.6)
            r = (0.6 - hit[3]) if hit[0] is not None else 0.16
            row.append((d, a, r + 0.008 + 0.014 * t))
        rr.append(row)
    base = [[c[2] for c in r] for r in rr]
    R = [[c[2] for c in r] for r in rr]
    # 縱橫兩向撫平、只往外推：射線打在骨盆與大腿上的起伏（臀部、大腿外側的肌肉）會讓甲片和橫紋扭成波浪
    for _ in range(24):
        R2 = [r[:] for r in R]
        for j in range(1, nv + 1):
            for i in range(nu + 1):
                nb = [R[j - 1][i]] + ([R[j + 1][i]] if j < nv else []) + ([R[j][i - 1]] if i > 0 else []) + ([R[j][i + 1]] if i < nu else [])
                R2[j][i] = max(base[j][i], (R[j][i] + sum(nb) / len(nb)) / 2)
        R = R2
    for j in range(nv + 1):
        for i in range(nu + 1):
            d, a, _r = rr[j][i]
            pts[(i, j)] = a + d * R[j][i]
    o = _grid('tassetL', nu, nv, lambda u, v: pts[(round(u * nu), round(v * nv))], lambda co: V((co.x, 0, co.z)))
    o = kit.subsurf(o, 2, solidify=0.007)
    kit.tag(o, gold, mat=0, grp=G_VTAS, ol=0.7)
    ys = [yt - 0.05 - 0.032 * k for k in range(int((yt - yb - 0.06) / 0.032))]
    kit.paint_field(o, lambda co: _bands(co.y, ys, 0.0035), goldD, 2)
    return o


def vegeta_fur_belt(F, targets, fur, y, r=0.017):
    """毛皮腰帶（尾巴，參考 01／04／05）：粗而毛糙的一圈，繞在腰最細處、壓住腹甲；左後腰打結，結尾垂下約 0.4 頭。
    中心線以水平射線貼到腰上（胸甲下緣與腹甲的外面），斷面加偽亂數起伏，輪廓毛糙。"""
    import bmesh as _bm
    tr = _tree_multi(targets)
    N, n = 72, 10
    cs = []
    for i in range(N):
        a = 2 * PI * i / N
        d = V((math.cos(a), 0, math.sin(a)))
        hit = tr.ray_cast(V((0, y, 0)) + d * 0.6, -d, 0.6)
        rr = (0.6 - hit[3]) if hit[0] is not None else F.w * 1.2
        cs.append(V((0, y, 0)) + d * (rr + r * 0.75))
    bm = _bm.new()
    rings = []
    up = V((0, 1, 0))
    for i in range(N):
        T = (cs[(i + 1) % N] - cs[i - 1]).normalized()
        out = T.cross(up).normalized()
        if out.dot(V((cs[i].x, 0, cs[i].z))) < 0:
            out = -out
        ring = []
        for k in range(n):
            th = 2 * PI * k / n
            fr = r * (1 + 0.16 * _hash(i, k))
            ring.append(bm.verts.new(cs[i] + out * (math.cos(th) * fr) + up * (math.sin(th) * fr * 1.15)))
        rings.append(ring)
    for i in range(N):
        a, b = rings[i], rings[(i + 1) % N]
        for k in range(n):
            bm.faces.new((a[k], a[(k + 1) % n], b[(k + 1) % n], b[k]))
    _bm.ops.recalc_face_normals(bm, faces=bm.faces)
    belt = kit.subsurf(kit.to_object('furBelt', bm), 1)
    kit.tag(belt, fur, grp=G_BELT, ol=0.8)
    # 左後腰的結：扁圓的一團＋往下垂的結尾（剛性跟著骨盆，夠短、離開臀部，跑步時不會被大腿頂穿）
    ia = int(round(N * (2 * PI - 0.95) / (2 * PI))) % N
    kc = cs[ia] + V((cs[ia].x, 0, cs[ia].z)).normalized() * 0.012
    knot = kit.quad_sphere('furKnot', 1.0, cuts=5)
    kit.deform(knot, lambda p: kc + V((p.x * 0.03, p.y * 0.026, p.z * 0.03)) * (1 + 0.12 * _hash(int(p.x * 7 + 9), int(p.y * 7 + p.z * 13 + 9))))
    knot = kit.subsurf(knot, 1)
    kit.tag(knot, fur, grp=G_BELT, ol=0.8)
    od = V((kc.x, 0, kc.z)).normalized()
    tip = kc + V((0, -0.11, 0)) + od * 0.03
    tail = path_loft('furEnd', [kc, (kc + tip) * 0.5 + od * 0.012, tip], [0.017, 0.015, 0.007], n=8, front=od, side=V((0, 1, 0)).cross(od))
    kit.deform(tail, lambda p: p + od * 0.003 * _hash(int(p.y * 300), int(p.x * 300 + p.z * 200)))
    tail = kit.subsurf(tail, 1)
    kit.tag(tail, fur, grp=G_BELT, ol=0.8)
    return [belt, knot, tail]


def build_vegeta(R):
    F = Fig(R)
    P = kit.Palette()
    skin = P(0xf2c69e)
    suit = P(0x2a4cc0)
    white = P(0xf5f2e8)
    gold, goldD = P(0xe6b84a), P(0xa07a2c)
    fur = P(0x77452b)
    team = P(-1)
    body, proxy = [], []

    # 緊身衣：軀幹＋骨盆＋腿
    st = kit.loft('suit', torso_rows(F, e=0.004, u0=0.0, pec=0.108, lat=0.09), n=18, cap0=None, cap1=None)
    st = kit.subsurf(st, 2)
    kit.tag(st, suit, grp=G_TORSO)
    body.append(realbody.skin(st))
    proxy.append(st)
    # 高領（參考 01：緊身衣的高領一路到下巴下方，露出的脖子只有約 0.1 頭）
    ycl = 0.105
    col = limb('collar', V((0, F.y(0.93), -0.008)), V((0, 1, 0)), [(0, 0.075, 0.07), (0.05, 0.068, 0.064), (ycl, 0.066, 0.062)], n=14, cap0=None, cap1=None)
    col = kit.subsurf(col, 2, solidify=0.006)
    kit.tag(col, suit, grp=G_NECK, ol=0.7)
    body.append(col)
    body.append(neck(F, skin, r=0.06))
    # 脖子整段埋在緊身衣與高領裡：投影顏色時排在緊身衣後面（射線同時碰到兩者就取緊身衣）。
    # 底模的脖子根部比舊的斜方肌細好幾公分，高領下緣兩側的頂點離脖子皮膚管比離緊身衣近，會被塗成一條條膚色
    body[-1]['proj_under'] = 1
    # 脖子在高領口上方 3 cm 內外框漸細：脖子的外框反殼比「脖子到高領內壁」的間隙還厚，從領口裡面穿出一圈黑色虛線
    ycol = F.y(0.93) + ycl
    kit.paint_ol(body[-1], lambda co: smooth((co.y - ycol) / 0.03))
    proxy.append(body[-1])
    pel = realbody.skin(pelvis(F, suit, e=0.004))
    body.append(pel)
    proxy.append(pel)
    kl = F.k_leg
    quad = lambda th: 1 + 0.06 * ang_bump(th, FRONT - 0.3, 1.0)
    calf = lambda th: 1 + 0.08 * ang_bump(th, BACK, 1.0)
    leg = leg_tube(F, suit, [
        (-0.07, 0.122 * kl, 0.122 * kl),
        (0.03, 0.118 * kl, 0.122 * kl, quad),
        (0.18, 0.106 * kl, 0.11 * kl, quad),
        (F.tl - 0.04, 0.078 * kl, 0.084 * kl),
        (F.tl + 0.06, 0.074 * kl, 0.08 * kl, calf),
        (F.tl + 0.14, 0.066 * kl, 0.07 * kl, calf),
        (F.tl + 0.2, 0.05 * kl, 0.052 * kl),
    ])
    realbody.skin(leg)

    # 胸背甲：貼著緊身衣（離表面 1.6 cm，上緣收到 0.5 cm 貼住高領），從腰最細處（腰帶）包到頸根；
    # 肩頂由 cut_armholes 沿上臂骨軸挖掉，留下從頸根繞過腋下的 U 字甲緣（參考 04）。
    # 舊版離表面 2.8 cm、上緣停在肩線（u 0.9），是一個白色的桶，頸根一圈寬開口露出外框殼的黑縫
    yb = F.y(0.4)   # 腰帶（腰最細處；參考 01 腰帶在胸甲下緣下約 0.25 頭、GK 04 在肚臍上方）
    ar = kit.loft('armor', torso_rows(F, e=lambda u: 0.016 - 0.011 * smooth((u - 0.9) / 0.15) - 0.003 * smooth((0.55 - u) / 0.15),
                                      u0=0.38, u1=1.08, pec=0.15, lat=0.06, p=2.3), n=20, cap0=None, cap1=None)
    ar = kit.subsurf(ar, 1)
    heroes.cut_armholes(ar, F, 0.1 * F.k_arm)
    ar = kit.subsurf(ar, 1, solidify=0.012)
    kit.tag(ar, white, grp=G_CHEST, mat=2)
    # 背後腰上的金色橫紋帶（參考 05：背甲白色只到肩胛下，下背到腰帶是橫紋帶）；前方與兩側維持白色（04 的腹甲是另一片尖舌）
    ybk = F.y(0.66)
    kit.paint_field(ar, lambda co: max(co.y - ybk, co.z + 0.02 - 0.1 * max(0.0, 1 - abs(co.x) / F.cx)), gold, 2)
    nb = int((ybk - F.y(0.38)) / 0.03)
    kit.paint_field(ar, lambda co: max(_bands(co.y, [ybk - 0.03 * (k + 1) for k in range(nb)], 0.0035), co.z + 0.02 - 0.1 * max(0.0, 1 - abs(co.x) / F.cx)), goldD, 2)
    # 胸甲是硬殼、綁骨群組只跟胸廓（G_CHEST）：底下被它蓋住的皮膚也釘在胸廓上（realbody.weights_for 的 pin_bones）。
    # 原本皮膚照骨熱分到鎖骨與上臂，一抬手（出拳、施法）胸口整片皮膚往前上方走、從白甲裡穿出藍色，只剩外圈一道白邊
    ar['pin_bones'] = ('torso', 'ribs')
    body.append(ar)
    # 腹甲尖舌：上緣在胸肌下緣正中，尖端到胯前（參考 01 的尖端約在胯高、04 在胯下）
    ytip = F.L - 0.1
    tg = vegeta_tongue(F, [ar, st, pel], gold, goldD, F.y(0.64), yb, ytip)
    body.append(tg)
    # 側腰甲（左右）
    tas = vegeta_tasset(F, [pel, leg], gold, goldD, yb + 0.005, F.L - 0.13)
    # 毛皮腰帶
    body += vegeta_fur_belt(F, [ar, tg, st, pel], fur, yb)
    # 肩甲（左右）
    pad = vegeta_pad(F, gold, goldD, white)
    pair_add(body, proxy, [pad, tas])

    # 手臂：整條藍色緊身衣（參考 01：藍色一路到手套口）；白手套（手套口在前臂中段）
    arm = arm_skin(F, suit, muscle=1.3, k=1.1, grp=G_VARM_L, mat=0)
    # 手套、臂章都貼合手臂斷面（fit_band），並和底下的手臂皮膚同一個綁骨群組（G_ARM_L）：
    # 權重相同才會一起變形；原本手套只跟前臂（G_FORE_L），彎肘時皮膚會從手套口穿出來
    kf = F.k_fore
    se = F.up + F.lo - 0.005
    glove = fit_band(F, arm, 'gloveL', [
        (F.up + 0.45 * F.lo, 0.072 * kf, 0.066 * kf, 0.009),
        (F.up + 0.62 * F.lo, 0.064 * kf, 0.06 * kf, 0.008),
        (F.up + 0.82 * F.lo, 0.058 * kf, 0.053 * kf, 0.007),
        (se, 0.054 * kf, 0.05 * kf, 0.006),
    ], white, G_ARM_L, thick=0.007)   # 換真人身體時內壁貼到前臂外（hug），厚度照留
    hand = fist(F, white, mat=0, scale=1.1, glove=True)
    # 白靴：膝下喇叭口（參考 01：靴口寬約 0.8 頭、往外翻），金色鞋頭與鞋底包邊；舊版靴口一圈金色（參考沒有）
    top_s = F.tl + 0.06
    bt = boot(F, white, top_s, 0.078, toe=1.04)
    kit.paint_field(bt[1], lambda co: 0.085 - co.z, gold, 2)
    kit.paint_field(bt[1], lambda co: co.y - 0.022, gold, 2)
    rt = 0.078 * F.k_shin
    cuff = limb('bootCuffL', F.th, F.dl, [(top_s - 0.02, rt * 1.52, rt * 1.55), (top_s + 0.0, rt * 1.36, rt * 1.4), (top_s + 0.03, rt * 1.12, rt * 1.16), (top_s + 0.075, rt * 0.9, rt * 0.94)], n=16, cap0=None, cap1=None)
    cuff = kit.subsurf(cuff, 2, solidify=0.006)
    kit.tag(cuff, white, grp=heroes.G_FOOT_L, ol=0.8)
    pair_add(body, proxy, [arm, glove, hand, leg, cuff] + bt, proxy_set=[arm, hand, leg] + bt)
    body.append(fit_band(F, arm, 'teamL', [(0.158, 0, 0, 0.005), (0.169, 0, 0, 0.0065), (0.18, 0, 0, 0.005)], team, G_ARM_L, thick=0.006, mat=5, ol=0.5))

    heads = {}
    for form in ('base', 'ssj'):
        h = anime_head('head_' + form, F, skin, jaw=1.08, chin=0.98, brow=0.6, square=0.4)
        hc = P(0x17130f) if form == 'base' else P(0xffd447)
        heads[form] = [h, hair_cap('cap_' + form, F, hc, hairline=0.5, temple=0.55, scale=1.06, peak=(0.3, 0.62, 1.0), fit=0.002)] + hair(F, hc, vegeta_hair(form), wmul=1.1)  # M 字高髮際線，額頭露出；美人尖直接切在髮帽上
    custom = {G_VARM_L: vegeta_armpit(F, 'L'), G_VARM_R: vegeta_armpit(F, 'R'), G_VPAD: vegeta_pad_w,
              G_VTONGUE: vegeta_tongue_w(F, yb, ytip), G_VTAS: vegeta_tasset_w(yb + 0.005, F.L - 0.13)}
    return finish(F, P, body, proxy, heads, custom=custom)


def vegeta_hair(form):
    """參考 01：整束往上豎成收尖的火焰（像倒過來的大蒜），最寬在耳上、往頭頂收成一點，高出頭頂約 1.1 頭、從側面看往後上方傾約 15°。
    舊版的髮尖高到 3.0 hr（髮長乘上 HAIR_GROW 後高出頭頂約 1.5 頭）、兩側的髮尖往外張，正面是一顆蓬開的球。"""
    k = 1.0 if form == 'base' else 1.08
    return sym([
        ((0.0, 0.95, 0.25), (0.0, 2.28 * k, -0.22), 0.54, 0.25, (0, 0, 0.1)),
        ((0.28, 0.9, 0.18), (0.32, 2.14 * k, -0.3), 0.5, 0.24, (0.06, 0, 0.05)),
        ((0.55, 0.75, 0.05), (0.84, 2.0 * k, -0.36), 0.48, 0.23, (0.1, 0, 0)),
        ((0.75, 0.45, -0.1), (1.24, 1.55 * k, -0.45), 0.45, 0.22, (0.1, 0, 0)),
        ((0.8, 0.1, -0.3), (1.3, 0.9 * k, -0.65), 0.4, 0.2, (0.08, 0, 0)),
        ((0.3, 0.75, -0.55), (0.32, 2.08 * k, -0.95), 0.5, 0.24, (0, 0, 0)),
        ((0.0, 0.6, -0.8), (0.0, 1.98 * k, -1.15), 0.52, 0.24, (0, 0, 0)),
        ((0.5, 0.4, -0.75), (0.84, 1.75 * k, -1.05), 0.45, 0.22, (0, 0, 0)),
        ((0.0, 0.1, -0.95), (0.0, 1.25 * k, -1.32), 0.45, 0.22, (0, 0, 0)),
    ])
    # 額頭中央的美人尖改由 hair_cap 的 peak 切出來：原本是一撮往下的細髮束，寬只有 0.12 hr、四周描黑框，
    # 在額頭上看起來像一道裂痕。參考 01（FighterZ 立繪）：美人尖是一個寬的 V 字，尖端在兩眉之間上方，
    # 兩條直邊往外上方斜到太陽穴（頂端寬約額頭的七成），兩側的額角往後退，整體是 M 字；peak 取半寬 0.62、指數 1（直邊）

# 貝吉塔的手臂皮膚（含同色短袖）：允許的骨頭和 G_ARM 相同，但腋下根部改用自訂權重（vegeta_armpit）
G_VARM_L, G_VARM_R = 62, 63
ALLOW[G_VARM_L] = ALLOW[G_ARM_L]
ALLOW[G_VARM_R] = ALLOW[heroes.G_ARM_R]
heroes.MIRROR_GRP[G_VARM_L] = G_VARM_R


def vegeta_armpit(F, side):
    """手臂根部（肩關節附近、綁定姿勢埋在軀幹裡的那段）：骨熱在腋下混了不少 ribs／torso，舉手過頭時
    腋下被釘在胸腔上、和上臂差了一百多度一起內插，皺成一團、法線反過來被邊緣光打亮，在袖子和胸甲交界處閃出白點。
    根部改成只保留骨熱裡 clL／shL 的比例（重新正規化），s 從 0.07 往肩內漸漸套用；
    s ≥ 0.07 維持原本的骨熱權重（袖口、臂章與手套用 G_ARM 的骨熱權重，兩者一致）。
    試過純沿軸向的 clL→shL 斜坡：過渡帶太寬，翻面的範圍反而變大。"""
    sh_b, cl_b = 'sh' + side, 'cl' + side

    def fn(co, old):
        p = V((abs(co.x), co.y, co.z))
        s = (p - F.sh).dot(F.da)
        k = smooth((0.07 - s) / 0.09)
        if k <= 0.001:
            return old
        arm_w = [(b, w) for b, w in old if b in (sh_b, cl_b)]
        tot = sum(w for _, w in arm_w)
        if tot < 1e-3:
            return old
        return [(b, w * (1 - k)) for b, w in old] + [(b, w / tot * k) for b, w in arm_w]
    fn.blend = True
    return fn


def fit_band(F, target, name, rows, pal, grp, thick=0.008, n=24, mat=0, ol=0.8):
    """貼合手臂斷面的環帶（貝吉塔的袖口、隊伍臂章、手套）：沿 F.da 的每個斷面向手臂表面打射線，
    半徑取 max(橢圓半徑, 表面距離＋e)；圓形的 band() 遇到二頭／三頭肌的隆起會一邊陷進肉裡、一邊浮在空中。
    rows＝[(s, a, b, e)]：s 沿骨距離，a、b 為側向／前後半徑的下限（0＝完全貼合），e 為離表面的間隙。"""
    tr = tree_of(target)
    kc = 6.0 / (4.0 + 2.0 * math.cos(2 * PI / n))   # 細分一次會把 n 邊形往內縮（B-spline 極限），先放大補回
    T = F.da
    f = V((0, 0, 1)) - T * T.z
    f.normalize()
    u = V((1, 0, 0)) - T * T.x - f * f.x
    u.normalize()
    sts = []
    for s, a, b, e in rows:
        c = F.arm_pt(s)

        def mod(th, c=c, a=a, b=b, e=e):
            d = u * math.cos(th) + f * math.sin(th)
            hit = tr.ray_cast(c + d * 0.4, -d, 0.4)
            r = (0.4 - hit[3]) if hit[0] is not None else 0.0
            ell = a * b / max(1e-6, math.hypot(b * math.cos(th), a * math.sin(th))) if a > 0 else 0.0
            return max(ell, r + e) * kc
        sts.append(S(c, 1.0, 1.0, p=2.0, mod=mod))
    o = kit.loft(name, sts, n=n, cap0=None, cap1=None)
    o = kit.subsurf(o, 2, solidify=thick)
    if target.get('skin'):
        o['hug'] = 0.0015   # 貼在被取代的皮膚部件上：換真人身體時內壁重新貼到真人手臂外 1.5 mm（realbody.hug_fit）
    return kit.tag(o, pal, mat=mat, grp=grp, ol=ol)


# ================================================================ 特南克斯
def sleeve_arm_weights(F, s1=0.1):
    """長袖（與袖上的臂章）的權重：骨熱是在體素化的聯集代理體上算的，A 字站姿下上臂內側離軀幹很近，
    代理體在腋下黏成一片，袖子（和貼在袖上的臂章）內側在上臂中段還分到五成的胸廓骨。一抬手，這一圈頂點留在身上，
    從袖子裡拉出一叢細長的三角形（特南克斯施法時臂章下方的青色碎片、袖子下緣的鋸齒）。
    沿手臂離開肩頭 s1 之後，胸廓、軀幹、鎖骨的權重漸漸改給上臂；袖根（藏在外套袖孔裡）照舊。左右共用，依 x 正負選骨頭。"""
    def f(co, old):
        sf = 'L' if co.x >= 0 else 'R'
        k = smooth(arm_s(F, V((abs(co.x), co.y, co.z))) / s1)
        if k <= 0.001:
            return old
        st, moved = [], 0.0
        for b, w in old:
            if b in ('torso', 'ribs', 'cl' + sf):
                st.append((b, w * (1 - k)))
                moved += w * k
            else:
                st.append((b, w))
        return st + [('sh' + sf, moved)]
    f.blend = True
    return f


def torso_arm_free(F, y0=0.62, y1=0.38):
    """外套、上衣這類 G_TORSO 部件在腰側的權重：骨熱在 A 字站姿下，腰側離垂下的手肘很近，外套腰側分到上臂、鎖骨的權重。
    跑步手臂往後擺時，外套腰側被手肘拉走，露出底下的襯衫（香吉士背後腰側的藍點）。
    沿高度從 F.y(y0) 到 F.y(y1)，肩與鎖骨的權重漸漸改給胸廓（再往下給軀幹骨）。"""
    def f(co, old):
        k = smooth((F.y(y0) - co.y) / max(1e-4, F.y(y0) - F.y(y1)))
        if k <= 0.001:
            return old
        to = 'ribs' if co.y > F.y(0.5) else 'torso'
        st, moved = [], 0.0
        for b, w in old:
            if b[:2] in ('cl', 'sh'):
                st.append((b, w * (1 - k)))
                moved += w * k
            else:
                st.append((b, w))
        return st + [(to, moved)]
    f.blend = True
    return f


def build_trunks(R):
    F = Fig(R)
    P = kit.Palette()
    skin = P(0xf7cfa8)
    # 外套藍紫（參考 01 FighterZ 立繪：受光 #797ad4、陰影 #2c3478；SHF 偏 #2a5ad0）：原本 0x1e2648 接近黑，
    # 角色材質的邊緣光是加上去的固定量，在近黑的底色上把側面洗成灰藍、正對鏡頭的地方留下原色，
    # 舉手時袖子正對鏡頭的手肘看起來像一塊黑斑。改成參考圖的中間調
    jacket, jacketL = P(0x3a49b0), P(0x4d5cc4)
    tank = P(0x17171b)
    pants = P(0x2c2c32)  # 參考圖：黑色寬褲
    bootc, bootD = P(0xd2a64a), P(0x6a5028)
    blk = P(0x1a1a1a)
    brass = P(0xb8a060)
    strapc = P(0x6a4a2a)
    team = P(-1)
    body, proxy = [], []

    tk = kit.loft('tank', torso_rows(F, e=0.003, u0=0.0, pec=0.09), n=18, cap0=None, cap1=None)
    tk = kit.subsurf(tk, 2)
    kit.tag(tk, tank, grp=G_TORSO)
    body.append(realbody.skin(tk))
    proxy.append(tk)
    # 外套：前襟敞開、立領
    rows = [r for r in TORSO_ROWS if r[0] > 0.3]  # 短版外套：下襬在胸下
    us = [r[0] for r in rows]
    jk = kit.loft('jacket', torso_rows(F, e=0.02, rows=rows, pec=0.072), n=20, cap0=None, cap1=None, gap=lambda i: 0.3 + 0.25 * smooth((us[i] - 0.5) / 0.5))
    # 袖孔：外套的殼原本包到肩關節外，抬手時殼的肩頭從袖子裡穿出成碎片。孔比袖根（約 10 cm）小，站著時孔緣藏在袖子裡
    jk = kit.subsurf(jk, 1)
    heroes.cut_armholes(jk, F, 0.08 * F.k_arm)
    jk = kit.subsurf(jk, 1, solidify=0.01)
    kit.tag(jk, jacket, grp=G_TORSO)
    body.append(jk)
    proxy.append(jk)
    cl = kit.loft('jcollar', [S(V((0, F.y(0.95), -0.01)), F.cx * 0.5, F.cz * 0.66), S(V((0, F.y(1.03), -0.015)), F.cx * 0.47, F.cz * 0.62), S(V((0, F.y(1.1), -0.02)), F.cx * 0.48, F.cz * 0.62)],
                  n=16, cap0=None, cap1=None, gap=lambda i: 0.55)
    cl = kit.subsurf(cl, 2, solidify=0.008)
    kit.tag(cl, jacket, grp=G_NECK, ol=0.8)
    body.append(cl)
    body.append(neck(F, skin, r=0.056))
    proxy.append(body[-1])
    # 劍帶：左肩斜到右腰
    # 綁骨群組和外套相同：帶子貼在外套表面 8 mm 外，骨熱取到的權重和底下的外套幾乎一樣，抬手時一起動。
    # 原本是 G_CHEST（只跟胸廓），外套腋下跟著上臂掀起時，帶子留在原地，從腋下穿出一截棕色斷頭
    # 參考圖（03／04 GK、SHF）：帶子從右肩（−x）斜過胸前、跨在敞開的外套之間的黑背心上，到左腰（＋x），和背後的劍鞘平行。
    # 原本傾斜方向相反（左肩到右腰，和劍鞘交叉），而且只貼外套：前襟敞開處射線穿過缺口，帶子在外套裡面繞過去，只在衣襟邊露出棕色斷頭。
    # 改成同時貼外套與背心（射線先碰到哪個就貼哪個）
    st = strap_around(F, [jk, tk], V((0, F.y(0.62), 0)), V((0.55, 1, 0)), 0.024, 0.004, strapc, off=0.007, grp=G_TORSO, lay=True)
    # 換真人身體時整條全量跟著皮膚挪（realbody.retarget 的 fit_reach）：預設離皮膚 2.5 cm 以外漸漸少挪，
    # 疊在外套外的帶子挪得比外套少，整條陷進外套裡；跨在背心上的那段又不能照外套衣襟的位移（ride_on），兩段都照自己底下的皮膚
    st['fit_reach'] = 0.07
    body.append(st)
    # 長袖外套＋袖口
    ka = F.k_arm
    from crossover import long_sleeve
    sl = long_sleeve(F, jacket, k=1.0, e=0.01)  # 貼合手臂的長袖（和客串角色同一個函式）
    cuff = band('cuffL', F.sh, F.da, F.up + F.lo - 0.085, F.up + F.lo - 0.045, 0.058 * F.k_fore + 0.016, 0.056 * F.k_fore + 0.016, jacketL, G_FORE_L, thick=0.008)
    arm = arm_skin(F, skin, muscle=0.9, k=1.0)
    kit.paint_field(arm, lambda co: arm_s(F, co) - (F.up + F.lo - 0.06), jacket, 0)
    hand = fist(F, skin, scale=1.05)
    # 褲、腰帶、靴
    body.append(pelvis(F, pants, e=0.01))
    proxy.append(body[-1])
    kl = F.k_leg
    leg = baggy_leg(F, pants, bag=1.25, blouse=1.2, s_end=F.tl + 0.17)  # 寬鬆褲管收進靴口
    bt = boot(F, bootc, F.tl + 0.15, 0.076, pal_sole=bootD)
    rim = band('bootRimL', F.th, F.dl, F.tl + 0.135, F.tl + 0.165, 0.082, 0.083, bootD, G_FOOT_L, thick=0.008)
    pair_add(body, proxy, [sl, cuff, arm, hand, leg, rim] + bt, proxy_set=[arm, hand, leg] + bt)
    body.append(team_band(F, team, on=sl))
    yb = F.L + 0.08
    body.append(belt_ring(F, yb, 0.04, blk, e=0.014))
    bk = kit.box_cage('buckle', 0.05, 0.036, 0.012, cuts=(1, 1, 1))
    kit.transform(bk, Matrix.Translation(V((0, yb, F.cz * 0.92 + 0.026))))
    bk = kit.subsurf(bk, 2)
    body.append(kit.tag(bk, brass, grp=G_BELT, mat=2, ol=0.5))

    heads = {}
    for form in ('base', 'ssj'):
        h = anime_head('head_' + form, F, skin, jaw=0.98, chin=0.95)
        hc = P(0xb9a6e8) if form == 'base' else P(0xffd447)
        if form == 'base':
            parts = [h, hair_cap('cap_' + form, F, hc, hairline=0.5, temple=0.0, scale=1.08, nape=-0.75, side_cut=False)] + hair(F, hc, trunks_hair())
        else:
            parts = [h, hair_cap('cap_' + form, F, hc, hairline=0.4, temple=0.2)] + hair(F, hc, trunks_ssj())
        heads[form] = parts
    extras = trunks_sword(P, brass)
    sw = sleeve_arm_weights(F)
    return finish(F, P, body, proxy, heads, extras=extras, custom={heroes.G_ARM_L: sw, heroes.G_ARM_R: sw})


def trunks_hair():
    return sym([
        ((0.12, 0.95, 0.35), (0.78, -0.15, 0.78), 0.4, 0.15, (0.35, 0.35, 0.25)),
        ((0.32, 0.9, 0.12), (1.02, -0.5, 0.35), 0.44, 0.16, (0.45, 0.25, 0.1)),
        ((0.36, 0.88, -0.2), (1.02, -0.62, -0.32), 0.46, 0.17, (0.45, 0.25, 0.0)),
        ((0.26, 0.85, -0.5), (0.78, -0.72, -0.88), 0.46, 0.17, (0.35, 0.25, -0.25)),
        ((0.06, 0.82, -0.7), (0.26, -0.78, -1.08), 0.46, 0.17, (0.12, 0.25, -0.35)),
        ((0.1, 0.96, 0.42), (0.5, 0.42, 0.98), 0.4, 0.13, (0.15, 0.25, 0.2)),
    ])


def trunks_ssj():
    return sym([
        ((0.0, 0.92, 0.25), (0.1, 2.6, -0.1), 0.52, 0.24, (0, 0, 0)),
        ((0.38, 0.85, 0.1), (0.9, 2.4, -0.3), 0.5, 0.23, (0, 0, 0)),
        ((0.7, 0.55, -0.05), (1.55, 1.7, -0.4), 0.46, 0.22, (0, 0, 0)),
        ((0.82, 0.12, -0.25), (1.6, 0.6, -0.7), 0.42, 0.2, (0, 0, 0)),
        ((0.28, 0.78, -0.5), (0.5, 2.2, -1.1), 0.5, 0.23, (0, 0, 0)),
        ((0.0, 0.55, -0.8), (0.05, 1.7, -1.6), 0.5, 0.23, (0, 0, 0)),
        ((0.45, 0.2, -0.82), (1.0, 0.5, -1.5), 0.46, 0.22, (0, 0, 0)),
        ((0.12, 0.85, 0.5), (0.2, 0.3, 1.02), 0.28, 0.13, (0, 0.05, 0.12)),
        ((0.55, 0.65, 0.4), (0.82, 0.05, 0.75), 0.24, 0.12, (0, 0, 0.06)),
    ])


def trunks_sword(P, brass):
    steel, hilt, sheath = P(0xe3e9f0), P(0x3a2a1e), P(0x6a5430)
    # 劍：握把在原點、刃沿 +y（在 JS 的劍座局部座標）
    grip = limb('grip', V((0, -0.1, 0)), V((0, 1, 0)), [(0, 0.016, 0.016), (0.2, 0.019, 0.019)], n=8, cap0='pole', cap1='pole')
    grip = kit.subsurf(grip, 1)
    kit.tag(grip, hilt, ol=0.6)
    pom = kit.quad_sphere('pommel', 0.024, cuts=3)
    kit.transform(pom, Matrix.Translation(V((0, -0.112, 0))))
    kit.tag(pom, brass, mat=2, ol=0.6)
    guard = kit.box_cage('guard', 0.13, 0.024, 0.044, cuts=(1, 1, 1))
    kit.transform(guard, Matrix.Translation(V((0, 0.112, 0))))
    guard = kit.subsurf(guard, 1)
    kit.tag(guard, brass, mat=2, ol=0.6)
    blade = kit.loft('blade', [S(V((0, 0.13, 0)), 0.022, 0.0045, p=1.2), S(V((0, 0.6, 0)), 0.022, 0.0045, p=1.2), S(V((0, 1.0, 0)), 0.021, 0.004, p=1.2), S(V((0, 1.085, 0)), 0.002, 0.001, p=1.2)],
                     n=8, cap0='pole', cap1=None, front=V((0, 0, 1)), side=V((1, 0, 0)))
    kit.split_sharp(blade, 35)
    kit.tag(blade, steel, mat=2, ol=0.5)
    sw = [grip, pom, guard, blade]
    # 鞘
    sh = kit.box_cage('sheath', 0.064, 0.94, 0.032, cuts=(1, 4, 1))
    kit.transform(sh, Matrix.Translation(V((0, 0.6, 0))))
    sh = kit.subsurf(sh, 1)
    kit.tag(sh, sheath, ol=0.7)
    caps = []
    for y, hh in ((0.16, 0.044), (1.05, 0.05)):
        c = kit.box_cage('cap', 0.076, hh, 0.04, cuts=(1, 1, 1))
        kit.transform(c, Matrix.Translation(V((0, y, 0))))
        c = kit.subsurf(c, 1)
        caps.append(kit.tag(c, brass, mat=2, ol=0.6))
    return {'sword': sw, 'sheath': [sh] + caps}


# ================================================================ 比克
# 比克專屬綁骨群組（64～65）
G_PIC_HEM = 64    # 道服上衣垂在腰帶下的衣襬：原本是 G_TORSO，骨熱只分到大腿骨（不在允許清單）而退回 clL，踢腿時刺出尖角；改和褲子同一套權重
G_PIC_SHOE = 65   # 鞋（左右共用，依 x 正負分邊）：腳趾漸變加寬，踮腳時鞋尖不會折出 V 形
ALLOW[G_PIC_HEM] = {'hips', 'torso', 'thL', 'thR'}
ALLOW[G_PIC_SHOE] = {'knL', 'anL', 'toL', 'knR', 'anR', 'toR'}


def set_grp(ob, pred, grp):
    """把 pred(co) 為真的頂點改成另一個綁骨群組。"""
    G = ob.data.attributes['grp'].data
    for i, v in enumerate(ob.data.vertices):
        if pred(V(v.co)):
            G[i].value = grp
    return ob


def piccolo_weights(F, yb):
    """比克的衣物權重（左右共用，依 x 正負選骨頭）。
    肩頭一帶（手臂皮膚、短袖、道服肩部）用同一個依沿臂距離 s 的鎖骨→上臂漸變，舉手時三者一起動、不會互相穿出；
    上臂中段剛性跟著上臂（隊伍臂章才不會和皮膚分開）；褲子依沿大腿距離分配骨盆／大腿；鞋的腳趾漸變加寬。"""
    nd = V((F.da.y, -F.da.x, 0))
    if nd.x > 0:
        nd = -nd   # 垂直手臂、朝身體內下方（腋下那一側）

    def side(co):
        sx = 1 if co.x >= 0 else -1
        return V((co.x * sx, co.y, co.z)), ('L' if sx > 0 else 'R')

    def shoulder(s, sf, z=0.0):
        # 前側（腋下往前）早一點交給上臂：手往前上舉時前側才不會被擠成尖片；後側留給鎖骨久一點：手往前伸時袖根後緣才不會掀開
        k = smooth((s + 0.12 + 0.03 * max(-1.0, min(1.0, z / 0.08))) / 0.16)
        return [('cl' + sf, 1 - k), ('sh' + sf, k)]

    def arm(co, old):
        c, sf = side(co)
        s = arm_s(F, c)
        # 熱權重：去掉胸廓、軀幹、鎖骨（上臂離開肩頭後不該再被身體拉住）
        f = smooth(s / 0.1)
        g = smooth(((F.up - 0.06) - s) / 0.06)   # 前臂骨也只管到手肘附近，上臂中段（臂章處）完全跟上臂
        st, moved = [], 0.0
        for b, w in old:
            k = f if b in ('torso', 'ribs', 'cl' + sf) else g if b == 'el' + sf else 0.0
            st.append((b, w * (1 - k)))
            moved += w * k
        st.append(('sh' + sf, moved))
        e = smooth(((F.up - 0.1) - s) / 0.05)   # 上臂中段以上改用程序權重
        if e <= 0.001:
            return st
        return [(b, w * (1 - e)) for b, w in st] + [(b, w * e) for b, w in shoulder(s, sf, c.z)]
    arm.blend = True

    def sleeve_w(co):
        c, sf = side(co)
        return shoulder(arm_s(F, c), sf, c.z)

    def torso(co, old):
        c, sf = side(co)
        if c.y < F.y(0.4):
            # 腰以下不該有肩、鎖骨的權重（骨熱沒有允許的骨頭時 read_weights 會退回 clL）
            moved = sum(w for b, w in old if b[:2] in ('cl', 'sh'))
            if moved <= 0:
                return old
            return [(b, w) for b, w in old if b[:2] not in ('cl', 'sh')] + [('hips' if c.y < F.L + 0.1 else 'torso', moved)]
        s = arm_s(F, c)
        h = (c - F.sh).dot(nd)
        m = smooth((0.14 - h) / 0.11) * smooth((0.15 - abs(c.z)) / 0.06) * smooth((s + 0.1) / 0.06)
        if m <= 0.001:
            return old
        return [(b, w * (1 - m)) for b, w in old] + [(b, w * m) for b, w in shoulder(s, sf, c.z)]
    torso.blend = True

    # 褲子（骨盆、褲管、衣襬）：骨熱在蓬鬆的褲管上很亂（大腿前側有頂點整個跟骨盆、相鄰的整個跟大腿，踢腿時拉出尖刺），
    # 改用沿大腿的距離決定骨盆→大腿的比例；骨盆與衣襬依 x 左右分配，褲管保留骨熱的大腿／小腿比例
    def hip_share(c):
        return smooth(((c - F.th).dot(F.dl) + 0.06) / 0.14)

    def pants(co, center=1.0):
        wl = smooth((co.x + 0.04) / 0.08)
        k = center + (1 - center) * smooth((abs(co.x) - 0.03) / 0.12)
        a_l = wl * hip_share(co) * k
        a_r = (1 - wl) * hip_share(V((-co.x, co.y, co.z))) * k
        return [('hips', 1 - a_l - a_r), ('thL', a_l), ('thR', a_r)]

    def hem(co):
        # 衣襬正中央（前後片）多跟骨盆：兩腿張開時下緣中央才不會被扯進褲襠、折成 V 字
        return pants(co, 0.0)

    def leg(sf):
        sx = 1 if sf == 'L' else -1

        def fn(co, old):
            t = hip_share(V((co.x * sx, co.y, co.z)))
            rest = [(b, w) for b, w in old if b != 'hips']
            tot = sum(w for _, w in rest)
            rest = [(b, w / tot) for b, w in rest] if tot > 1e-6 else [('th' + sf, 1.0)]
            return [('hips', 1 - t)] + [(b, w * t) for b, w in rest]
        fn.blend = True
        return fn

    def shoe(co):
        _, sf = side(co)
        ay = F.b['an' + sf][0].y
        tz = F.b['to' + sf][0].z
        k = smooth((ay + 0.045 - co.y) / 0.06)
        t = smooth((co.z - (tz - 0.03)) / 0.06) * k
        return [('kn' + sf, 1 - k), ('an' + sf, k - t), ('to' + sf, t)]

    return {heroes.G_ARM_L: arm, heroes.G_ARM_R: arm, G_UPPER_L: arm, heroes.G_UPPER_R: arm,
            heroes.G_DELT_L: sleeve_w, heroes.G_DELT_R: sleeve_w, G_TORSO: torso, G_PIC_SHOE: shoe,
            G_PELVIS: pants, G_PIC_HEM: hem, G_LEG_L: leg('L'), heroes.G_LEG_R: leg('R')}


def hug_band(F, arm, s0, s1, pal, grp, thick=0.006, gap=0.0015, name='teamL'):
    """貼著手臂表面的臂章：先放樣成比手臂粗的管，再沿徑向射線貼到手臂皮膚上（二頭、三頭肌的起伏也照著走），最後往內加厚。
    圓管臂章套在肌肉起伏大的上臂上，側面會懸空、前面被二頭肌穿出。"""
    tr = tree_of(arm)
    sm = (s0 + s1) / 2
    o = limb(name, F.sh, F.da, [(s0, 0.2, 0.2), (sm, 0.2, 0.2), (s1, 0.2, 0.2)], n=24, cap0=None, cap1=None)
    o = kit.subsurf(o, 1)

    def snap(co):
        s = arm_s(F, co)
        a = F.arm_pt(s)
        d = co - a
        d = (d - F.da * d.dot(F.da)).normalized()
        hit = tr.ray_cast(a + d * 0.3, -d, 0.3)
        r = (hit[0] - a).length if hit[0] is not None else 0.09
        return a + d * (r + thick + gap)
    kit.deform(o, snap)
    o = kit.subsurf(o, 0, solidify=thick)
    # 直接貼在手臂皮膚上：換真人身體時內壁重新貼到真人手臂外 gap（realbody.hug_fit）
    o['hug'] = gap
    return kit.tag(o, pal, grp=grp, mat=5, ol=0.5)


def build_piccolo(R):
    F = Fig(R)
    P = kit.Palette()
    gskin, pink = P(0x66b83e), P(0xf0a0a8)
    gi = P(0x5d3a94)
    sash = P(0x5fb8e8)
    shoe, shoeD = P(0x6e4428), P(0x3e2614)
    wrist = P(0xb3322e)
    team = P(-1)
    body, proxy = [], []

    chest = kit.loft('chest', torso_rows(F, e=0.0, u0=0.3, pec=0.144), n=18, cap0=None, cap1=None)
    chest = kit.subsurf(chest, 2)
    kit.tag(chest, gskin, grp=G_TORSO, mat=4)
    body.append(realbody.skin(chest))
    proxy.append(chest)
    rows = [(-0.2, ('w', 1.3), 1.0, 0.02), (-0.08, ('w', 1.2), 0.9, 0.01)] + TORSO_ROWS
    us = [r[0] for r in rows]
    uv0 = 0.42
    top = kit.loft('gi_top', torso_rows(F, e=0.018, rows=rows, pec=0.09, lat=0.108), n=20, cap0=None, cap1=None,
                   gap=lambda i: 0.0 if us[i] <= uv0 else min(1.35, 0.1 + (us[i] - uv0) * 2.2))
    top = kit.subsurf(top, 2, solidify=0.012)
    kit.tag(top, gi, grp=G_TORSO)
    yb = F.L + 0.09   # 腰帶中心
    set_grp(top, lambda co: co.y < yb, G_PIC_HEM)
    # 道服底下的皮膚收得比預設 3 mm 深（同香吉士的外套）：道服用程序權重（piccolo_weights）、底下的皮膚是底模＋骨熱的混合，
    # 交叉雙臂（待機）時肩口與胸側的皮膚被拉出道服 5～8 mm，遊戲鏡頭下肩口一塊塊綠色與粉紅從紫色裡冒出來
    top['conform_gap'] = 0.01
    body.append(top)
    proxy.append(top)
    body.append(neck(F, gskin, r=0.07))
    proxy.append(body[-1])
    # 手臂：粉紅肌肉紋、紅護腕
    arm = arm_skin(F, gskin, muscle=1.35, k=1.15)

    side = V((0, 0, 1)).cross(F.da).normalized()

    # 粉紅肌肉紋（參考 SHF 02 正側背三視圖、03 T 字）：
    #   上臂：整顆三角肌是粉紅的圓帽，從道服袖口底下一路包到上臂約 45%，正面、側面、背面都看得到，只有腋下內側是綠的；
    #         下緣在外側最低、往前後兩側慢慢升高
    #   前臂：外側（手背那一側）一大塊橢圓，從手肘下方到前臂約 2/3，不碰紅護腕
    #   原作兩塊上都有橫向的肌肉細紋：試過用深一階的粉紅細線，底模的面約 2 cm、比線寬大得多，切線只在頂點取樣，
    #   畫出來是一片片三角形碎斑，所以不畫（遊戲鏡頭下也看不到）
    # 以手臂局部的 s（沿骨距離）與繞軸角度 phi 判斷：phi=0 是手臂外側（side，朝外上），+π/2 是正面，±π 是腋下內側
    # 換成真人身體後這兩塊由 realbody.paint() 在底模上重新切線上色（逐頂點投影會因為頂點太稀被併掉）
    # 上臂那塊往上包到肩關節內 8 cm（整顆三角肌到道服肩口都是粉紅，參考 FighterZ 立繪交叉雙臂時肩口下就是粉紅）：
    # 原本從肩下 3 cm 才開始，待機交叉雙臂時肩頭從道服肩口轉出來，露出的是粉紅上方一圈綠色肩頂，和粉紅交錯成一塊塊碎斑
    PATCH = ((0.05, 0.13, 0.1, 2.25), (F.up + 0.11, 0.09, 0.15, 1.45))   # (s 中心, s 半長, phi 中心, phi 半寬)

    def arm_local(co):
        s = arm_s(F, co)
        r = co - F.arm_pt(s)
        return s, r.length, math.atan2(r.dot(V((0, 0, 1))), r.dot(side))

    def patch_f(co):
        s, rr, phi = arm_local(co)
        es = [((s - s0) / ls) ** 2 + ((phi - p0) / lp) ** 2 - 1 for s0, ls, p0, lp in PATCH]
        # 肩頂（s＜0）的骨軸延長線會伸進斜方肌與脖子：上臂那塊再限制在底模上臂權重＞0.22 的地方（肩頂到道服肩口都算三角肌），粉紅不會塗到頸側
        e = min(max(es[0], arm_w(co) * 3), es[1])
        # 離手臂骨軸 11 cm 以外（軀幹、腋下另一側）一律不塗；用 max 接起來，場保持連續，切線才不會沿著截斷處鋸齒
        return max(e, (rr - 0.11) / 0.01)
    arm_w = realbody.weight_field(['shL'], thr=0.22, fallback=lambda co: -1.0)
    realbody.paint(arm, F, patch_f, pink, 4)
    sl = sleeve(F, gi, s1=0.035, r=0.118 * F.k_arm, s0=-0.06, grp=heroes.G_DELT_L)   # 權重見 piccolo_weights
    sl['conform_gap'] = 0.01
    # 紅護腕（參考 SHF 03）：只是手腕上一圈窄帶，高約半個手掌、貼著手腕；舊版從前臂中段套到腕（約 0.1 m）、口比手掌寬，
    # 出拳施法時從正面看像一截空心筒子。改成貼合斷面的 fit_band，綁骨群組和手臂皮膚相同（G_ARM_L），彎腕、旋前時一起變形
    se = F.up + F.lo - 0.004
    # 第二版：真人底模的前臂整段用同一個徑向縮放，到手腕還和前臂中段一樣粗（半徑約 6 cm），比手掌厚；護腕貼著它再外擴 8 mm，
    # 出拳時從正面看就是一圈比拳頭寬的紅環。改成往手的方向收窄：上緣只離皮膚 2 mm，下緣比原本的手腕表面小 6 mm，
    # conform 會把底下的皮膚收進護腕內壁，等於把手腕收細、接到手掌，紅環的口徑落在前臂與拳頭之間；殼與外框也減薄
    wb = fit_band(F, arm, 'wristL', [(se - 0.05, 0, 0, 0.002), (se - 0.042, 0, 0, 0.003), (se - 0.016, 0, 0, -0.002), (se, 0, 0, -0.006)],
                  wrist, G_ARM_L, thick=0.006, ol=0.4)
    hand = fist(F, gskin, scale=1.12)
    body.append(pelvis(F, gi, e=0.014))
    proxy.append(body[-1])
    leg = baggy_leg(F, gi, bag=1.28, blouse=1.32, s_end=F.tl + F.sl - 0.06)  # 參考圖：寬大燈籠褲，腳踝收口
    shoe_ = boot(F, shoe, F.tl + F.sl - 0.09, 0.07, pal_sole=shoeD, toe_len=0.04, toe=0.95)
    for o in shoe_:
        set_grp(o, lambda co: True, G_PIC_SHOE)
    pair_add(body, proxy, [arm, sl, wb, hand, leg] + shoe_, proxy_set=[arm, hand, leg] + shoe_)
    body.append(hug_band(F, arm, 0.155, 0.18, team, G_UPPER_L))
    # 天藍腰帶＋結＋垂帶
    body.append(belt_ring(F, yb, 0.13, sash, e=0.03, thick=0.016))
    kz = F.cz * 0.92 + 0.03
    knot = kit.quad_sphere('knot', 1, cuts=3)
    kit.deform(knot, lambda p: V((0.13 + p.x * 0.04, yb + p.y * 0.036, kz + p.z * 0.024)))
    knot = kit.subsurf(knot, 1)
    body.append(kit.tag(knot, sash, grp=G_BELT))
    for k, (dx, w0, ln) in enumerate(((-0.014, 0.04, 0.12), (0.03, 0.035, 0.09))):
        t0 = V((0.13 + dx, yb - 0.01, kz + 0.004 + 0.006 * k))
        f = kit.loft('flap%d' % k, [S(t0, w0, 0.008), S(t0 + V((0.004, -ln * 0.5, 0.004)), w0 * 1.12, 0.008), S(t0 + V((0.01, -ln, 0.006)), w0 * 0.92, 0.007)], n=8)
        f = kit.subsurf(f, 2)
        body.append(kit.tag(f, sash, grp=G_CHAIN, ol=0.7))

    # 頭：光頭、尖耳、觸角、額頭隆起
    c, hr = F.c, F.hr
    ridges = []
    for sx in (1, -1):
        for k in range(2):
            rid = path_loft('ridge', [c + V((sx * 0.1 * hr, (0.42 + k * 0.2) * hr, 0.8 * hr - k * 0.08 * hr)), c + V((sx * 0.4 * hr, (0.56 + k * 0.2) * hr, 0.64 * hr - k * 0.1 * hr))],
                            [0.06 * hr, 0.035 * hr], n=6)
            ridges.append(kit.subsurf(rid, 1))
    h = anime_head('head_base', F, gskin, pointed_ears=True, ear_scale=1.25, jaw=1.04, brow=1.0, cranium=(0.82, 0.95, 0.9), extra=ridges)
    parts = [h]
    for sx in (1, -1):
        pts = [c + V((sx * 0.22 * hr, 0.75 * hr, 0.45 * hr)), c + V((sx * 0.3 * hr, 1.25 * hr, 0.3 * hr)), c + V((sx * 0.42 * hr, 1.65 * hr, -0.05 * hr)), c + V((sx * 0.5 * hr, 1.85 * hr, -0.45 * hr))]
        an = path_loft('ant', pts, [0.07 * hr, 0.055 * hr, 0.045 * hr, 0.06 * hr], n=6)
        an = kit.subsurf(an, 1)
        parts.append(kit.tag(an, gskin, mat=4, ol=0.6))
    heads = {'base': parts}
    custom = piccolo_weights(F, yb)
    custom[G_CHAIN] = sash_chain_weights(F, 'sash')
    return finish(F, P, body, proxy, heads, custom=custom)


# ================================================================ 弗利沙
def build_frieza(R):
    F = Fig(R)
    P = kit.Palette()
    skin = P(0xf7f4f0)
    dome = P(0x7a3cc4)
    team = P(-1)
    body, proxy = [], []

    # 白色身體：軀幹、骨盆、腿、手臂、脖子 → 體素融成一張皮
    tor = kit.subsurf(kit.loft('torso', torso_rows(F, e=0.0, u0=0.0, pec=0.14, lat=0.11), n=18, cap0='pole', cap1='pole'), 2)
    pel = pelvis(F, skin, e=0.0, closed=True)
    kl, ks = F.k_leg, F.k_shin
    calf = lambda th: 1 + 0.1 * ang_bump(th, BACK, 1.0)
    quad = lambda th: 1 + 0.08 * ang_bump(th, FRONT, 1.1)   # 大腿前側的股四頭肌（參考影片：弗利沙的腿比身體壯）
    leg = limb('legL', F.th, F.dl, [(-0.07, 0.115 * kl, 0.115 * kl), (0.05, 0.122 * kl, 0.126 * kl, quad), (0.22, 0.104 * kl, 0.108 * kl, quad), (F.tl - 0.03, 0.07 * kl, 0.076 * kl),
                                    (F.tl + 0.06, 0.07 * ks / 0.75 * 0.75, 0.076 * kl, calf), (F.tl + 0.17, 0.06 * kl, 0.062 * kl, calf), (F.tl + F.sl - 0.08, 0.045 * kl, 0.05 * kl), (F.tl + F.sl - 0.03, 0.05 * kl, 0.06 * kl)], n=12)
    leg = kit.subsurf(leg, 2)
    arm = arm_skin(F, skin, muscle=1.1, k=1.08)
    nk = neck(F, skin, r=0.062)   # 脖子短（參考：頸寬約 0.44 個頭高＝0.14 m，藏在下巴與後腦勺後面；正交正面量得最細 0.42 頭高）；頭放大到 0.32 m 高之後，0.052 只剩 0.33 頭高，背面看是燈泡插在細桿上
    # 腳不併進皮膚（底模的五趾人腳會被下面的爪腳蓋住、收進去後刪掉）
    parts = [tor, pel, leg, mirror(leg), arm, mirror(arm), nk]
    # 量脖子粗細用的替身：融合後整張皮都是 G_FREE，realbody 找不到 G_NECK 的頂點，脖子就照預設 1.1 倍的底模粗細（頸寬 0.53 頭高）。
    # 另外留一份標成 G_NECK 的脖子交給 realbody 量（它是被取代的部件，不會出現在成品裡）
    nk_m = kit.tag(kit.duplicate(nk, 'neck_meas'), skin, mat=4, grp=G_NECK)
    for o in parts:
        kit.tag(o, skin, mat=4, grp=G_FREE)
    skin_body = kit.fuse(parts, 'skin', voxel=0.0055, iters=10, factor=0.6, tris=9000)
    kit.tag(skin_body, skin, mat=4, grp=G_FREE)
    body.append(realbody.skin(skin_body))
    body.append(realbody.skin(nk_m))
    proxy.append(skin_body)
    hand = fist(F, skin, scale=1.15)
    pair_add(body, proxy, [hand], proxy_set=[hand])
    # 爪腳（參考 01／02／05：三根往前張開的粗腳趾、腳跟一根短後爪，趾尖是深色的小指甲；單腳長約 0.8 頭高、寬約 0.5 頭高）。
    # 腳掌是包住底模人腳的圓殼，底模的腳被它蓋住、收進殼內再刪掉（realbody 的 conform／drop_covered），所以這裡不畫五趾。
    # 腳踝以下照高度交給腳踝骨、腳趾關節以前交給腳趾骨（build_heroes 依 G_FOOT 指定）
    nail = P(0x2a1c34)
    fx, ay = F.sole.x, F.b['anL'][0].y
    pad = kit.loft('clawFootL', [S(V((fx, 0.036, -0.05)), 0.028, 0.03, p=2.2), S(V((fx, 0.053, -0.005)), 0.041, 0.051, p=2.3),
                                 S(V((fx + 0.004, 0.038, 0.045)), 0.047, 0.034, p=2.4), S(V((fx + 0.006, 0.024, 0.085)), 0.044, 0.02, p=2.4)],
                   n=14, front=V((0, 1, 0)))
    kit.deform(pad, lambda p: V((p.x, max(p.y, 0.006), p.z)))
    pad = kit.subsurf(pad, 1)
    kit.recalc_normals(pad)
    claws = [pad]
    nails = []

    def toe(base, d, L, r0, r1, name):
        d = d.normalized()
        tip = base + d * L
        mid = base + d * (L * 0.5) + V((0, 0.006, 0))
        # 放樣的 front 取上方：腳趾朝前（+z），front 用預設的 +z 會和走向平行，斷面框架退化、繞序翻面（整根被外框殼蓋成黑色）
        t = kit.subsurf(path_loft(name, [base, mid, tip], [r0, (r0 + r1) / 2 * 1.05, r1], n=10, front=V((0, 1, 0)), side=V((1, 0, 0))), 1)
        kit.recalc_normals(t)
        claws.append(t)
        nl = kit.quad_sphere(name + 'Nail', 1.0, cuts=3)
        side = d.cross(V((0, 1, 0))).normalized()
        nc = tip + d * (r1 * 0.35) + V((0, r1 * 0.3, 0))
        kit.deform(nl, lambda p, nc=nc, d=d, side=side: nc + side * p.x * r1 * 0.8 + V((0, 1, 0)) * p.y * r1 * 0.55 + d * p.z * r1 * 0.75)
        nl = kit.subsurf(nl, 1)
        kit.recalc_normals(nl)
        nails.append(kit.tag(nl, nail, mat=2, grp=G_FOOT_L, ol=0.4))
    tb0 = V((fx + 0.004, 0.024, 0.07))
    for ang, L in ((-0.6, 0.11), (0.0, 0.135), (0.6, 0.11)):   # 外、中、內三趾往前張開
        toe(tb0 + V((math.sin(ang) * 0.02, 0, 0)), V((math.sin(ang), -0.04, math.cos(ang))), L, 0.022, 0.016, 'clawToe')
    toe(V((fx, 0.03, -0.045)), V((0, -0.15, -1)), 0.05, 0.018, 0.013, 'clawBack')   # 腳跟的後爪
    for o in claws:
        kit.tag(o, skin, mat=4, grp=G_FOOT_L, ol=0.7)
    pair_add(body, proxy, claws + nails)
    # 紫色甲片：肩、小腿
    side = V((0, 0, 1)).cross(F.da).normalized()
    # 肩甲（參考 02／04：單片寬約 0.47 頭高、高約 0.35 頭高，頂點約在下巴高度，往外凸出頭寬之外，兩片外緣距約 1.64 頭高）：
    # 中心往外、往上移到三角肌頂上，半球大部分露在肩外（舊版 7.6 cm 的半徑一半埋在三角肌裡，正面只露出 0.31 頭高）
    shp = plate('shoulderL', F.sh + V((0.03, 0.04, 0)), V((0.8, -0.6, 0)), V((0, 0, 1)), V((0.6, 0.8, 0)), 0.098, 0.09, 0.068, dome, heroes.G_DELT_L)
    sp = F.leg_pt(F.tl + 0.15) + V((0, 0, 0.05 * kl))
    shn = plate('shinL', sp, F.dl, V((1, 0, 0)), V((0, 0, 1)), 0.1, 0.038, 0.02, dome, G_FOOT_L)
    pair_add(body, proxy, [shp, shn])
    # 前臂的紫斑（參考 02 正面手肘外下方露出一小片、03 背面前臂背側一條）：手肘下方、前臂外側偏後的小橢圓，
    # 直接畫在皮膚上（舊版是 1.8 cm 厚的甲片，換成真人手臂後一半埋進皮膚，露出來的邊是破碎的 W 形）。
    # 換真人身體時由 realbody.paint() 在底模上切線上色。skin_body 是兩隻手臂融在一起的整張皮（沒有鏡射），所以 x 取絕對值。
    # 手臂局部座標：s＝沿骨距離、phi＝繞軸角度（0＝外側、+π/2＝正面、−π/2＝背面）
    FORE = (F.up + 0.3 * F.lo, 0.24 * F.lo, -0.85, 0.6)   # (s 中心, s 半長, phi 中心, phi 半寬)：沿前臂拉長的橢圓

    def fore_f(co):
        q = V((abs(co.x), co.y, co.z))
        s_ = arm_s(F, q)
        r = q - F.arm_pt(s_)
        phi = math.atan2(r.dot(V((0, 0, 1))), r.dot(side))
        s0, ls, p0, lp = FORE
        e = ((s_ - s0) / ls) ** 2 + ((phi - p0) / lp) ** 2 - 1
        # 離前臂骨軸 6.5 cm 以外（軀幹、大腿）一律不塗；用 max 接起來，場保持連續，切線才不會鋸齒
        return max(e, (r.length - 0.065) / 0.01)
    realbody.paint(skin_body, F, fore_f, dome, 2, refine=2)
    # 胸口的盾形紫寶石（參考 02／04／06 正面最醒目的色塊）：胸肌下緣正中，寬約 0.49 頭高、高約 0.32 頭高，上緣微拱、
    # 兩側往下收成尖端朝下的盾形。中心在頭頂下約 1.85 頭高（頭頂 top 1.59、頭高約 0.32 m → y≈1.02）。
    # 場是三個連續函式取 max（上緣、兩側收尖、只塗正面），交界才平滑
    GEM_Y, GEM_H, GEM_W = F.b['ribs'][0].y + 0.095, 0.1, 0.078   # 上緣高度、上緣到尖端的高度、半寬

    def gem_f(co):
        ax = abs(co.x)
        top = GEM_Y + 0.012 * (1 - min(1.0, (ax / GEM_W) ** 2))   # 上緣中央微微拱起
        t = (top - co.y) / GEM_H                                    # 0＝上緣、1＝尖端
        w = GEM_W * max(0.0, 1 - max(0.0, t) ** 1.7)                 # 上半段兩側近乎平行，往下收成尖端
        # 以 2 cm 為單位：refine_near 細分場值 ±0.4 以內的面，用公尺的話整個身體都會被細分兩次
        return max(co.y - top, ax - w, 0.05 - co.z) / 0.02
    realbody.paint(skin_body, F, gem_f, dome, 2, refine=2)
    body.append(band('teamL', F.sh, F.da, 0.155, 0.175, 0.07 * F.k_arm, 0.068 * F.k_arm, team, G_UPPER_L, thick=0.005, mat=5, ol=0.5))
    # 尾巴（5 節擺動鏈，綁定姿勢筆直下垂）
    h0 = F.b['tail0'][0]
    # 尾巴：根部和大腿差不多粗、往尾端一路收細（參考影片的弗利沙尾巴又粗又長）
    tail = limb('tail', h0 + V((0, 0.06, 0.02)), V((0, -1, 0)), [(0, 0.074, 0.074), (0.1, 0.082, 0.082), (0.32, 0.07, 0.07), (0.56, 0.056, 0.056), (0.8, 0.041, 0.041), (1.0, 0.027, 0.027), (1.17, 0.011, 0.011)], n=10)
    tail = kit.subsurf(tail, 2)
    body.append(kit.tag(tail, skin, mat=4, grp=G_CHAIN))
    tb = [F.b['tail%d' % i] for i in range(5)]

    seg = R['bones'][[x['name'] for x in R['bones']].index('tail0')]
    ln = (V(seg['head']) - V(seg['tail'])).length

    def tail_w(co):
        t = (tb[0][0].y - co.y) / ln
        if t < 0.5:
            k = smooth((t + 0.3) / 0.8)
            return [('tail0', k), ('hips', 1 - k)]
        x = t - 0.5
        i = int(math.floor(x))
        f = smooth(x - i)
        a, b = min(i, 4), min(i + 1, 4)
        return [('tail%d' % a, 1 - f), ('tail%d' % b, f)]

    c, hr = F.c, F.hr
    # 頭（參考 SEW 04／05、S.H.F. 02、FRS 03 背面）：蛋形的大頭殼，頭寬約頭高的 0.88，臉往下收成小尖下巴，後腦勺往後鼓、坐在細脖子上。
    # 頭頂到下巴約 2.1 hr（約 5 頭身），眼睛落在頭高一半以下，紫色圓頂才有參考那麼大。
    #   cranium 的 kx 加寬顱骨（PROPS 的 hx 也改成 1.0，不再把頭橫向壓窄）；face_len 把下巴往下拉；
    #   jaw×cheek＝0.52、taper 1：臉的前半部從眼睛直線收到尖下巴（底模原本的 S 形收窄在顴骨下方幾乎不收，臉頰到下顎又寬又長）
    #   nose 0：底模的真人鼻子由 realbody.flatten_nose 完全壓平（只剩貼花上的一筆）
    #   egg 1.0：眼線以上的顱骨圓成光滑的蛋形（底模的頭頂偏方，紫色圓頂貼在上面像方帽）
    #   occ 0.32：後腦勺往後鼓（底模的後腦從眼線往下是垂直的，背面看像一根和頭一樣寬的白柱子頂著帽子）
    #   relax 12：眼線以下與太陽穴 Taubin 平滑（底模的下顎角、咀嚼肌與耳朵補洞處在側面著色成一塊塊三角形灰斑；弗利沙的臉是光滑的）
    #   muzzle 1：連人中、上下唇一起壓平（只壓鼻子時側面還有往前凸的鳥嘴狀唇峰；嘴巴是貼花畫的）
    #   recede 0.22：下半臉往後收（底模的臉從眼睛到下巴是垂直的牆、下巴底面水平，側面看是方下巴；參考 05 的下巴是往後斜的小尖下巴）
    #   soft 10：整顆頭（含下顎、頸部）的法線在網格上平滑（底模頂點稀，下顎後方到脖子的卡通明暗切成一塊塊多邊形灰斑，外框也沿著摺痕斷成尖刺）
    # 太陽穴的圓突起與耳孔（參考 03 背面、05 3/4 側）：眼線高度、眼睛後方的頭側，一顆扁圓的白色突起，外側中央是黑色的耳孔。
    # 換底模的頭時沿頭心射線推到貼著頭側表面（dress_head 的額外部件），孔由 dress_head 依 'hole' 塗色
    holeP = P(0x2c2234)
    temples = []
    for sx in (1, -1):
        d = V((sx * 0.95, -0.1, -0.3)).normalized()
        u = d.cross(V((0, 1, 0))).normalized()
        w = d.cross(u).normalized()
        bump = kit.quad_sphere('templeL' if sx > 0 else 'templeR', 1.0, cuts=4)
        cen = c + d * hr * 0.95
        kit.deform(bump, lambda p, cen=cen, d=d, u=u, w=w: cen + u * p.x * 0.021 + w * p.y * 0.021 + d * p.z * 0.009)
        bump['hole'] = [holeP, d.x, d.y, d.z, 0.0125]   # 孔佔突起的大半，外圈只剩一圈薄邊（孔太小、外框太粗時看起來像多一隻眼睛）
        temples.append(bump)
    h = anime_head('head_base', F, skin, ears=False, extra=temples, jaw=0.55, chin=0.9, cheek=0.95, cranium=(1.25, 1.24, 1.0), nose=0.0, face_len=1.2, egg=1.0,
                   occ=0.32, taper=1.0, relax=12, muzzle=1.0, soft=10, recede=0.22)

    # 紫色圓頂（參考 02／04／05 正側與 03 背面）：從頭頂蓋到前額、兩側、後腦的大半，白色只剩 V 字形的臉、耳孔一帶與後腦勺下緣。
    # 交界繞頭一圈的高度（頭心以上、以 hr 計；貼花的眼睛上緣約在 0.15）：
    #   正前方：U 字尖端往下壓到兩眼之間 0.13（參考 02／04 的前緣幾乎壓到眉骨，正中往下收），半寬約 0.45 rad（底模頭頂的面約 2 cm，太尖會變成兩個三角形的 V）
    #   眼睛正上方（a≈0.37）0.3：留一條白色眉骨
    #   額角（a≈0.85）升到 0.44：參考 04 正面的白臉是 V 字形，紫色在額角往上收、兩側露出白色的太陽穴
    #   正側面（太陽穴，a＝π/2）0.3：在耳孔上方
    #   正後方：降到頭心以下 −0.25，中央再往下收一點（03 背面的交界在後頸上方收成圓弧；−0.05 時背面是一圈很寬的白色碗形）
    def dome_f(co):
        p = (co - c) / hr
        a = abs(math.atan2(p.x, p.z))   # 0＝正前方、π＝正後方
        hump = max(0.0, 1 - ((a - 0.85) / 0.6) ** 2) ** 2
        yb = 0.3 + 0.14 * hump - 0.55 * smooth((a - PI / 2) / (PI / 2 - 0.5))   # 後腦降到頭心下 0.25 hr（參考 03 背面：白色只剩後頸上方一圈）
        yb -= 0.17 * (1 - smooth(a / 0.45))           # 前方的 U 字尖端
        yb -= 0.08 * smooth((a - (PI - 0.6)) / 0.6)    # 後方中央往下收
        return yb - p.y
    # 換成底模的頭時，由 dress_head 直接在底模的頭上依這個場切線上色（不經逐頂點投影，交界才平滑）
    realbody.head_paint(h, F, dome_f, dome, 2)
    heads = {'base': [h]}
    return finish(F, P, body, proxy, heads, custom={G_CHAIN: tail_w})


# ================================================================ 18 號
FEMALE_ROWS = [
    (0.06, ('w', 1.22), 0.86, 0.0),
    (0.2, ('w', 1.0), 0.78, 0.0),
    (0.36, ('c', 0.8), 0.8, 0.02),
    (0.52, ('c', 0.92), 0.9, 0.06),
    (0.65, ('c', 0.98), 0.98, 0.1),
    (0.78, ('c', 1.0), 0.88, 0.04),
    (0.89, ('c', 0.95), 0.78, -0.02),
    (0.97, ('c', 0.64), 0.6, -0.04),
    (1.01, ('c', 0.36), 0.45, 0.0),
]


ARM_L = [b + 'L' for b in ('sh', 'el', 'wr', 'fa', 'fb', 'fc', 'tb')]
ARM_BONES = ARM_L + [b[:-1] + 'R' for b in ARM_L]


def build_a18(R):
    F = Fig(R)
    P = kit.Palette()
    skin = P(0xf9d6bd)
    shirt, stripe = P(0x1d1d23), P(0xf0eee8)
    denim, denimD = P(0x4274bc), P(0x2c5290)
    legging = P(0x23304e)  # 深藍牛仔褲
    bootc, bootD = P(0x7c4c2c), P(0x4a2c18)
    beltc = P(0x5a3a22)
    team = P(-1)
    body, proxy = [], []

    sh = kit.loft('shirt', torso_rows(F, e=0.003, u0=0.0, pec=0, lat=0, bust=0.14, rows=FEMALE_ROWS), n=18, cap0=None, cap1=None)
    sh = kit.subsurf(sh, 2)
    kit.tag(sh, shirt, grp=G_TORSO)
    body.append(realbody.skin(sh))
    proxy.append(sh)
    # 領口：黑上衣和脖子皮膚的交界原本靠逐頂點投影（脖子部件 y(1.0) 以下不當顏色來源），底模頸根的面大，交界成鋸齒；
    # 改用解析場切一條水平的領口線（脖子周圍 9 cm 內：y(1.0) 以下黑、以上膚色）
    nk_y = F.y(1.0)
    nk_r = lambda co: math.hypot(co.x, co.z + 0.006) - 0.09
    # 場除以 1 cm：refine 只細分 |場|＜0.4 的面（交界 4 mm 內），以公尺計會把整個身體都細分
    realbody.paint(sh, F, lambda co: max(nk_r(co), co.y - nk_y, F.y(0.85) - co.y) / 0.01, shirt, 0, refine=1)
    realbody.paint(sh, F, lambda co: max(nk_r(co), nk_y - co.y) / 0.01, skin, 4, refine=1)
    us = [r[0] for r in FEMALE_ROWS if r[0] >= 0.3]
    # 參考圖（超版本）：黑色背心＋條紋長袖，不穿牛仔背心
    body.append(neck(F, skin, r=0.048))
    proxy.append(body[-1])
    # 長袖條紋上衣
    arm = arm_skin(F, skin, muscle=0.3, k=1.04)

    s_end = F.up + F.lo - 0.03
    # 換真人身體後，條紋原本先塗在手臂部件上再逐頂點投影到底模：條紋寬約 2 cm，和底模手臂的面差不多大，
    # 投影後被平滑、併島，變成幾大塊白色鋸齒碎片。改成 realbody.paint() 在底模上直接用同一個場切線上色
    # （交界附近先細分一次），範圍限制在 heroes.arm_region 的手臂上，不會塗到腋下的軀幹
    # 手臂部件本身仍先塗黑：底模肩頭有一圈頂點投影到手臂部件（不在 arm_region 的鉛直切面外側），部件是膚色的話肩頭會露出一塊膚色
    kit.paint_field(arm, lambda co: arm_s(F, co) - s_end, shirt, 0)
    # 手臂和軀幹的分界：arm_region 的 |x| 鉛直切面在腋窩和皮膚幾乎平行，舉手時切線在腋下拉成鋸齒、留下白色碎片；
    # 換成底模蒙皮權重的等值線（realbody.weight_field，抬手時沿著它平順拉開）。只取左臂的骨頭，鏡射那一份自動換成右臂
    on_arm = realbody.weight_field(ARM_L, 0.5, fallback=heroes.arm_region(F, s_end + 0.1, both=False))
    realbody.paint(arm, F, lambda co: max(arm_s(F, co) - s_end, on_arm(co)), shirt, 0)
    # 袖口以外（手腕、手）明確塗回膚色：投影在手腕附近有幾個頂點取到手臂部件的黑色，袖口成黑色短刺的階梯
    realbody.paint(arm, F, lambda co: max(s_end - arm_s(F, co), on_arm(co)), skin, 4)
    # 細分只做在 |場|＜0.4 的面：條紋項的 1 單位約 7 mm，其他以公尺計的項也除以 0.007 換成同一尺度，才不會整個身體都被細分
    # 條紋只畫在手臂權重六成以上的地方：腋窩前後的皺褶（權重在手臂和胸廓之間）留黑色，舉手時那裡被拉到胸側，不會在胸口留下白色碎片。
    # 原本取九成：底模女性上臂內側到臂章上方（肩下約 14 cm）權重都不到九成，等值線斜斜穿過條紋，內側的條紋切成鋸齒碎片、只剩外側半圈
    in_sleeve = realbody.weight_field(ARM_L, 0.6, fallback=heroes.arm_region(F, s_end + 0.1, r=0.068, both=False))
    realbody.paint(arm, F, lambda co: max(0.2 - math.sin(2 * PI * arm_s(F, co) / 0.046),
                                          (arm_s(F, co) - s_end + 0.01) / 0.007, (0.03 - arm_s(F, co)) / 0.007, in_sleeve(co) / 0.05), stripe, 0, refine=1)
    hand = fist(F, skin, scale=1.0)
    # 裙、內搭褲、短靴
    body.append(realbody.skin(pelvis(F, legging, e=0.004)))
    proxy.append(body[-1])
    yb = F.y(0.15)
    hw = F.R['hip']
    sk = kit.loft('skirt', [S(V((0, yb, 0.0)), F.w * 1.22 + 0.01, F.cz * 0.86 + 0.01, p=2.2), S(V((0, F.L + 0.03, 0)), hw * 1.6, F.cz * 0.98, p=2.2),
                            S(V((0, F.L - 0.12, 0.005)), hw * 1.85, F.cz * 1.15, p=2.1), S(V((0, F.L - 0.24, 0.01)), hw * 2.0, F.cz * 1.28, p=2.0), S(V((0, F.L - 0.32, 0.012)), hw * 2.06, F.cz * 1.32, p=2.0)], n=22, cap0=None, cap1=None)
    sk = kit.subsurf(sk, 2, solidify=0.009)
    kit.tag(sk, denim, grp=G_SKIRT)
    body.append(sk)
    body.append(belt_ring(F, yb + 0.005, 0.026, beltc, e=0.02, thick=0.008))
    kl = F.k_leg
    calf = lambda th: 1 + 0.09 * ang_bump(th, BACK, 1.0)
    leg = leg_tube(F, legging, [(-0.07, 0.112 * kl, 0.112 * kl), (0.05, 0.11 * kl, 0.114 * kl), (0.22, 0.094 * kl, 0.098 * kl), (F.tl - 0.03, 0.068 * kl, 0.074 * kl),
                                (F.tl + 0.07, 0.068 * kl, 0.074 * kl, calf), (F.tl + 0.17, 0.056 * kl, 0.06 * kl, calf), (F.tl + 0.26, 0.042 * kl, 0.046 * kl)])
    realbody.skin(leg)
    bt = boot(F, bootc, F.tl + 0.06, 0.068, pal_sole=bootD, toe=0.92)  # 咖啡色靴子到小腿中段
    pair_add(body, proxy, [arm, hand, leg] + bt, proxy_set=[arm, hand, leg] + bt)
    body.append(team_band(F, team, 1.0, hug=True))

    h = anime_head('head_base', F, skin, jaw=0.9, chin=0.85, cheek=0.96, nose=0.7)
    hc = P(0xf3d77a)
    from heroes import bob_cap
    heads = {'base': [h, bob_cap('bob', F, hc, hairline=0.5, length=0.75, flare=0.28, scale=1.14, part=0.15)] + hair(F, hc, a18_hair()[:3])}  # 及下巴的蓬鬆鮑伯頭＋側分瀏海
    return finish(F, P, body, proxy, heads, custom={G_SKIRT: a18_skirt_weights(F), G_PELVIS: a18_pelvis_weights(F)})


def a18_pelvis_weights(F):
    """內搭褲的臀部：裙子底下只留 5 mm 空隙，骨熱讓臀部跟著大腿前抬往後翻，從裙子後片頂出深藍色的斑。
    襠部以上改成跟著骨盆，大腿份量只保留在襠部附近（往下漸漸交回骨熱）。"""
    ya, yb = F.L + 0.02, F.L - 0.07

    def fn(co, old):
        keep = smooth((ya - co.y) / (ya - yb))
        acc = {}
        for b, w in old:
            if b in ('thL', 'thR'):
                acc[b] = acc.get(b, 0.0) + w * keep
                acc['hips'] = acc.get('hips', 0.0) + w * (1 - keep)
            else:
                acc[b] = acc.get(b, 0.0) + w
        return [(b, w) for b, w in acc.items() if w > 1e-4]
    fn.blend = True
    return fn


def a18_skirt_weights(F):
    """牛仔裙：骨熱把相鄰的裙片頂點分給骨盆與不同的大腿（跨步時折出黑色外框楔形、大腿從裙面穿出），
    改成平滑的分配：裙頭只跟骨盆（和底下的內搭褲、腰帶一致），往下漸漸交給左右大腿（依 x 平滑交叉，下襬 90%），
    後片中央一條再讓一部分給擺動鏈（兩腿之間，不會讓往後跨的腿從後片穿出）。"""
    h0, _ = F.b['skirt0']
    _, t1 = F.b['skirt1']
    y0, y1 = F.L + 0.05, F.L - 0.22     # 裙頭 → 裙身
    xw = F.R['hip'] * 0.8                # 左右大腿交叉的半寬

    def fn(co, old):
        old = [('hips' if b in ('thL', 'thR') else b, w) for b, w in old]   # 骨熱給裙頭的大腿份量併回骨盆
        a = smooth((y0 - co.y) / (y0 - y1))
        sl = smooth(0.5 + co.x / (2 * xw))
        k = 0.9 * a
        acc = {'thL': k * sl, 'thR': k * (1 - sl), 'hips': a - k}
        for b, w in old:
            acc[b] = acc.get(b, 0.0) + w * (1 - a)
        # 擺動鏈：後片、兩腿之間，依高度從 skirt0 交給 skirt1
        t = (h0.y - co.y) / (h0.y - t1.y)
        c = 0.45 * smooth(-co.z / (F.cz * 0.9)) * smooth(t * 3.0) * (1 - abs(2 * sl - 1)) ** 2
        if c > 1e-3:
            c1 = smooth(t * 1.6 - 0.5)
            acc = {b: w * (1 - c) for b, w in acc.items()}
            acc['skirt0'] = c * (1 - c1)
            acc['skirt1'] = c * c1
        # 每個頂點最多 4 根骨頭：多出來的先把腰椎、再把鏈根併回骨盆（不讓截斷造成接縫）
        for b in ('torso', 'ribs', 'skirt0'):
            if len([w for w in acc.values() if w > 1e-4]) <= 4:
                break
            if b in acc:
                acc['hips'] = acc.get('hips', 0.0) + acc.pop(b)
        return [(b, w) for b, w in acc.items() if w > 1e-4]
    fn.blend = True
    return fn


def a18_hair():
    cl = [
        ((0.3, 0.95, 0.3), (-0.55, 0.3, 1.0), 0.42, 0.14, (-0.1, 0.35, 0.3)),     # 側分瀏海掃向右
        ((0.0, 0.98, 0.3), (-0.82, -0.2, 0.75), 0.4, 0.14, (-0.3, 0.3, 0.25)),
        ((0.4, 0.9, 0.25), (0.88, -0.3, 0.68), 0.38, 0.14, (0.35, 0.3, 0.2)),
    ]
    cl += sym([
        ((0.35, 0.88, 0.0), (1.02, -0.6, 0.15), 0.46, 0.16, (0.45, 0.25, 0.05)),
        ((0.34, 0.86, -0.3), (1.0, -0.72, -0.4), 0.48, 0.17, (0.45, 0.25, -0.05)),
        ((0.22, 0.84, -0.55), (0.72, -0.8, -0.92), 0.48, 0.17, (0.3, 0.25, -0.25)),
        ((0.05, 0.8, -0.72), (0.22, -0.84, -1.08), 0.48, 0.17, (0.1, 0.25, -0.35)),
    ])
    return cl
