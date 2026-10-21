# 貝吉塔、特南克斯、比克、弗利沙、18 號（悟空與共用工具在 heroes.py）。
import math

import bmesh
from mathutils import Matrix
from mathutils.kdtree import KDTree

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


def strap_around(F, target, center, normal, width, thick, pal, name='strap', grp=G_CHEST, off=0.006, steps=28, arc=None, lay=False, bridge=0):
    """沿傾斜平面繞身體一圈的帶子（以射線貼合 target 表面）。arc＝(φ0, φ1) 只取一段。
    lay＝False（舊行為）：斷面的寬邊沿著射線方向（從身體表面立起來的鰭片，從正面只看得到一條細邊，一半埋在衣服裡）；
    lay＝True：寬邊沿著平面法線、平貼在表面上（真正的背帶），off 是帶子中心離表面的距離，要大於 thick。
    bridge＝k（預設 0 不處理）：每點離中心的距離取前後 k 點的最大值，帶子跨過衣襬、衣襟這類高低差時拉直架在外層上，
    不會跟著射線一下打到外套、一下打到裡面的背心而折成 Z 字（折起來的那段露出背面，外框殼畫成黑塊）。
    lay＝'surface'：寬邊沿「帶子切線 × 表面法線」、厚度沿表面法線（逐點的斷面）。lay＝True 的寬邊固定沿平面法線，
    平面斜到側腰、腋下時身體表面法線不在平面上，帶子變成斜立的鰭片，薄片側看只剩外框殼，畫成一塊黑。"""
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
    rad = []
    for i in range(steps + 1):
        f = lerp(a0, a1, i / steps)
        d = u * math.cos(f) + w * math.sin(f)
        o = V(center) + d * 1.0
        hit = tr.ray_cast(o, -d, 2)
        if hit[0] is not None:
            pts.append(hit[0] + hit[1] * off)
            hn = hit[1] if hit[1].dot(d) > 0 else -hit[1]
            rad.append((d, (hit[0] - V(center)).dot(d), hn))
    if bridge and rad:
        n_ = len(rad)
        ring = not arc
        rr = []
        for i in range(n_):
            js = [(i + j) % n_ if ring else min(max(i + j, 0), n_ - 1) for j in range(-bridge, bridge + 1)]
            rr.append(max(rad[j][1] for j in js))
        pts = [V(center) + d * (r + off) for (d, _, _), r in zip(rad, rr)]
    if lay == 'surface':
        n_ = len(rad)
        ring = not arc
        win = max(1, bridge)
        nr = []
        for i in range(n_):
            js = [(i + j) % n_ if ring else min(max(i + j, 0), n_ - 1) for j in range(-win, win + 1)]
            nr.append(sum((rad[j][2] for j in js), V((0, 0, 0))).normalized())
        ob = _ribbon(name, pts, nr, width, thick, closed=ring)
    elif lay:
        # loft 的斷面：side 投影到切線垂直面後就是射線（徑向）方向、front＝平面法線；徑向取厚度、法線方向取寬度
        ob = path_loft(name, pts, [thick] * len(pts), n=8, flat=width / thick, front=nrm, side=u, cap0='pole', cap1='pole')
    else:
        ob = path_loft(name, pts, [width] * len(pts), n=6, flat=thick / width, front=nrm, side=u, cap0='pole', cap1='pole')
    ob = kit.subsurf(ob, 1)
    return kit.tag(ob, pal, grp=grp, ol=0.6)


def _ribbon(name, pts, nrms, width, thick, closed=False, p=6.0, k=8):
    """沿 pts 的扁帶：每點的斷面寬邊沿「切線 × 法線」、厚度沿法線（nrms 朝外）；斷面是圓角矩形（超橢圓指數 p）。
    closed：首尾相接成環（首尾兩點重合時去掉最後一點）。"""
    pts = [V(q) for q in pts]
    if closed and (pts[0] - pts[-1]).length < 1e-5:
        pts, nrms = pts[:-1], nrms[:-1]
    n = len(pts)
    bm = bmesh.new()
    rings = []
    for i in range(n):
        a = pts[(i - 1) % n] if closed or i > 0 else pts[i]
        b = pts[(i + 1) % n] if closed or i < n - 1 else pts[i]
        t = (b - a).normalized()
        N = nrms[i]
        bdir = t.cross(N).normalized()
        N2 = bdir.cross(t).normalized()
        if N2.dot(N) < 0:
            N2 = -N2
        ring = []
        for j in range(k):
            th = 2 * PI * j / k
            c, s_ = math.cos(th), math.sin(th)
            c = math.copysign(abs(c) ** (2 / p), c)
            s_ = math.copysign(abs(s_) ** (2 / p), s_)
            ring.append(bm.verts.new(pts[i] + bdir * (c * width / 2) + N2 * (s_ * thick / 2)))
        rings.append(ring)
    for i in range(n if closed else n - 1):
        r0, r1 = rings[i], rings[(i + 1) % n]
        for j in range(k):
            bm.faces.new((r0[j], r0[(j + 1) % k], r1[(j + 1) % k], r1[j]))
    if not closed:
        bm.faces.new(rings[0][::-1])
        bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    return kit.to_object(name, bm)


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
G_VTAS = 79      # 側腰甲：上緣跟骨盆，往下漸漸交一半給同側大腿
# 胸背甲與腹甲的權重抄底下真人皮膚（realbody.G_RIDE_REAL／ride_weights）：
# 舊版胸甲只跟胸廓（剛體）、腹甲依高度自訂（腰帶下漸漸交給大腿），底下的皮膚在袖孔與胯前卻跟著上臂、大腿走，
# 出拳時袖孔前緣、跑步時腹甲中段都被皮膚頂穿（藍色碎片與外框黑縫）


def vegeta_pad_w(co):
    s = 'L' if co.x >= 0 else 'R'
    return [('ribs', 0.6), ('cl' + s, 0.4)]


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
    # 橫向 6 格（細分後 24 格）就夠描出尖舌的輪廓；8 格時全身衣物超過 32000 面的預算，整體減面會把橫紋帶、腹甲與側腰甲的橫紋啃成鋸齒和菱形碎塊
    nu, nv = 6, 26

    def half_w(t):
        if t < 0.15:
            return W * (0.6 + 0.4 * math.sqrt(max(0.0, 1 - ((0.15 - t) / 0.15) ** 2)))
        # 尖端收到 0.05 W：舊版收到 0.1 W（尖端是 1.8 cm 寬的平頭），尖端伸到兩腿之間時左右兩半各抄一條大腿的權重，
        # 站姿兩腿稍微張開就把平頭撕成兩根叉
        return W * (1 - 0.95 * ((t - 0.15) / 0.85) ** 1.5)
    rows = []
    for j in range(nv + 1):
        t = j / nv
        row = []
        for i in range(nu + 1):
            s = i / nu * 2 - 1
            x = s * half_w(t)
            y = yt - t * (yt - ytip)   # 上緣的圓弧由 half_w 收窄做出來（往下壓 y 會讓第一排越過第二排、細分加厚後折出尖刺）
            hit = tr.ray_cast(V((x, y, 0.6)), V((0, 0, -1)), 1.0)
            if hit[0] is not None:
                zs = hit[0].z
            else:
                # 胯下（骨盆管的底下、兩腿之間）打不到東西：沿用上一列同一格的表面深度。
                # 舊版退回 F.cz（胸深 0.156 m），尖端一伸到胯下就往前翹出十幾公分
                zs = rows[j - 1][i][2] - 0.008 - 0.028 if j else F.cz
            # 腰帶以下很快離開緊身衣（腰帶下 15 cm 起 3.6 cm）：尖舌蓋在小腹與兩條大腿根部前面，
            # 出拳弓步、跑步抬腿時大腿根部連同小腹往前鼓（底模的權重），間隙 2.4 cm 時從甲片中段頂出一塊塊藍色
            z = zs + 0.008 + 0.028 * smooth((yb + 0.015 - y) / 0.12)
            row.append([x, y, z])
        rows.append(row)
    base = [[p[2] for p in r] for r in rows]
    for _ in range(10):   # 沿縱向撫平、只往外推（取 max），台階變成斜坡
        for j in range(1, nv):
            for i in range(nu + 1):
                rows[j][i][2] = max(base[j][i], (rows[j - 1][i][2] + rows[j][i][2] + rows[j + 1][i][2]) / 3)
    o = _grid('tongue', nu, nv, lambda u, v: V(rows[round(v * nv)][round(u * nu)]), lambda co: V((0, 0, 1)))
    o = kit.subsurf(o, 2, solidify=0.007)
    kit.tag(o, gold, mat=0, grp=realbody.G_RIDE_REAL, ol=0.7)   # 霧面：亮面材質在這片朝前的平面上打出一整塊白色反光，看起來像破洞
    ys = [yt - 0.045 - 0.031 * k for k in range(int((yt - ytip - 0.06) / 0.031))]
    kit.paint_field(o, lambda co: _bands(co.y, ys, 0.0035), goldD, 2)
    # 不標 pin_bones：腰帶以上底下是胸甲（骨軸射線先碰到胸甲，已經釘住）；腰帶以下蓋著小腹與胯，釘到胸廓會讓那片皮膚不跟骨盆走
    return o


def vegeta_armhole(F, r, drop=0.55, s_low=0.1, swing=0.6, s_swing=0.07, front=0.0):
    """胸背甲的袖孔場（＜0 在孔內，左右對稱）：離這幾段骨軸最近的距離減掉 r——
    綁定姿勢的上臂骨軸（s −0.03～0.3）、往下轉 drop（站姿手臂放下的角度）後肩頭那一段（s −0.03～s_low），
    以及放下後再往前、往後擺 swing（出拳護架、跑步擺臂）的肩頭那一小段（s −0.03～s_swing）。
    放下、擺動的那幾段只挖肩頭：整條手臂放下後貼著軀幹側面，全挖會把側腹的甲切掉。
    front：前半（z＞0）的孔再加大，袖孔前緣往胸口收，正面看得到從肩頂繞過腋下的 U 字甲緣（參考 04）。"""
    a = math.atan2(F.da.y, F.da.x) - drop
    d2 = V((math.cos(a), math.sin(a), 0.0))
    segs = [(F.da, 0.3), (d2, s_low)]
    for sg in (swing, -swing):   # 繞 x 軸往前（+z）／往後（−z）擺
        segs.append((V((d2.x, d2.y * math.cos(sg), -d2.y * math.sin(sg))).normalized(), s_swing))

    def f(co):
        p = V((abs(co.x), co.y, co.z))
        best = 9.0
        for d, s1 in segs:
            s = max(-0.03, min(s1, (p - F.sh).dot(d)))
            best = min(best, (p - F.sh - d * s).length)
        return best - r - front * smooth((p.z + 0.01) / 0.08)
    return f


def vegeta_backband(F, armor, gold, goldD, y0, y1, A=1.2):
    """背後腰上的金色橫紋帶（參考 05：背甲白色只到肩胛下，下背到腰帶是 5～6 道橫紋）：從背後正中往兩側各 A 弧度，
    以水平射線貼到背甲外 1.2 cm 的薄片（細分會把凸面往內收，2 mm 時背後正中的背甲從薄片裡透出一塊沒有橫紋的梯形），
    自己的規則網格（和腹甲一樣），橫紋間距 2.4 cm、紋寬 9 mm。綁骨同胸甲（G_CHEST），換真人身體時照背甲外殼的位移挪（呼叫端設 ride_on／ride_bary）。
    只細分一層、縱向 16 列（列距約 6 mm，比紋寬細）：細分兩層時薄片近萬面，全身衣物超過減面預算，減面把橫紋啃成菱形碎塊。"""
    tr = tree_of(armor)
    nu, nv = 24, 16
    pts = {}
    for i in range(nu + 1):
        a = -A + 2 * A * i / nu
        d = V((math.sin(a), 0, -math.cos(a)))
        for j in range(nv + 1):
            y = y0 + (y1 - y0) * j / nv
            o = V((0, y, 0)) + d * 0.6
            hit = tr.ray_cast(o, -d, 0.6)
            pts[(i, j)] = (hit[0] + d * 0.012) if hit[0] is not None else V((0, y, 0)) + d * F.w * 1.2
    o = _grid('backband', nu, nv, lambda u, v: pts[(round(u * nu), round(v * nv))], lambda co: V((co.x, 0, co.z)))
    o = kit.subsurf(o, 1, solidify=0.004)
    kit.tag(o, gold, mat=0, grp=G_CHEST, ol=0.6)
    nb = int((y1 - y0 - 0.006) / 0.024)
    kit.paint_field(o, lambda co: _bands(co.y, [y1 - 0.012 - 0.024 * k for k in range(nb)], 0.0045), goldD, 2)
    return o


def vegeta_tasset(F, targets, gold, goldD, yt, yb, phc=0.2, hw=0.078):
    """左側腰甲（參考 01／04／05）：從腰帶垂到大腿上段、貼在大腿外側略偏前的金色甲片，寬約 0.5 頭，有橫紋；正前方與臀部沒有。
    沿水平射線從外側貼到骨盆／大腿表面，離表面的間隙往下漸大（2 cm），抬腿時才不會被大腿頂穿。
    phc：甲片中心的方位角（從 +x 往前 +z 量，弧度），hw：半寬（沿 0.16 m 半徑的弧長）。
    舊版 phc 0.24、hw 0.066，甲片幾乎都轉到正側面，正面只看到 0.055 m（約 0.2 頭）寬的一條邊；
    第 2 輪把中心轉到前外側 29°（phc 0.5）、加寬三成，正面看三片黃甲連成一整片黃裙；真正的原因是上半截的射線打不到東西
    （目標只有骨盆與大腿，腰帶高度沒有），取 0.16 m 預設半徑、離腰 4 cm 往外張。目標補上緊身衣之後，中心轉回外側略偏前 11°，
    半寬 0.078（約 0.5 頭寬），和腹甲之間露出藍色緊身衣（參考 01／04／05）。"""
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
            # 上緣整片往後轉 0.06 rad：腹甲在腰帶下最寬（半寬 8.8 cm），側腰甲前緣上角會疊在腹甲邊上，兩片橫紋互相穿插成鋸齒
            ph = phc - 0.06 * (1 - t) + s * hw * (1 + 0.15 * t) / 0.16
            d = V((math.cos(ph), 0, math.sin(ph)))
            a = V((0, y, 0))
            hit = tr.ray_cast(a + d * 0.6, -d, 0.6)
            r = (0.6 - hit[3]) if hit[0] is not None else 0.16
            # 下襬往外張（參考 04：側腰甲是硬板，下緣離大腿外側幾公分），正面看得到的寬度也跟著變大
            row.append((d, a, r + 0.008 + 0.014 * t + 0.025 * t * t))
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
    中心線以水平射線貼到腰上（胸甲下緣與腹甲的外面）。表面是一撮撮的毛束：斷面半徑沿圈繞成螺旋的毛束起伏（像擰過的毛皮），
    再疊上逐點的偽亂數尖刺，不細分（細分會把尖刺磨平），外框沿毛束的起伏描出參差的輪廓。
    舊版斷面只有 ±16% 的起伏又細分一次，正面看是一圈光滑的棕色圓管（像游泳圈）。"""
    import bmesh as _bm
    tr = _tree_multi(targets)
    # 一圈 108 段（舊版 132）：省下約 600 面給頭髮以外的幾何，全身衣物在 32000 面的預算內（超過時整體減面把橫紋啃成菱形）
    N, n = 108, 12
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
            # 螺旋毛束（每圈 4 束、沿腰繞 18 圈）＋逐點尖刺；朝內貼腰的那一側（cos θ＜0）起伏收小，不會刺進胸甲
            tuft = 0.5 + 0.5 * math.cos(4 * th + 2 * PI * 18 * i / N)
            amp = 0.45 + 0.55 * smooth((math.cos(th) + 0.6) / 1.2)
            fr = r * (0.82 + amp * (0.32 * tuft ** 3 + 0.14 * _hash(i, k)))
            ring.append(bm.verts.new(cs[i] + out * (math.cos(th) * fr) + up * (math.sin(th) * fr * 1.15)))
        rings.append(ring)
    for i in range(N):
        a, b = rings[i], rings[(i + 1) % N]
        for k in range(n):
            bm.faces.new((a[k], a[(k + 1) % n], b[(k + 1) % n], b[k]))
    _bm.ops.recalc_face_normals(bm, faces=bm.faces)
    belt = kit.to_object('furBelt', bm)
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


# 貝吉塔的軀幹斷面（緊身衣與胸背甲共用）：倒三角（參考 01：毛皮腰帶寬約 1.1 頭、約胸寬的六到七成）。
# 共用的 TORSO_ROWS 在 u 0.21→0.38 從腰寬（w×1.13）跳到胸寬（cx×0.86＝0.18 m），腰帶（u 0.4）剛好繫在肋骨最寬處，
# 腰帶連毛皮量到 1.73 頭、比腋下的胸甲還寬。改成 u 0.38 仍是腰寬（腰最細處就在腰帶下），胸廓從 u 0.54 才張開。
# realbody 的 torso_map 在 u 0.38／0.54 量這件緊身衣的斷面，真人身體的腰跟著收
VEG_TORSO = [
    (0.06, ('w', 1.1), 0.81, 0.0),
    (0.21, ('w', 1.1), 0.82, 0.02),
    (0.38, ('w', 1.04), 0.84, 0.04),
    (0.54, ('c', 0.9), 0.94, 0.07),
] + [r for r in TORSO_ROWS if r[0] > 0.6]


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
    st = kit.loft('suit', torso_rows(F, e=0.004, u0=0.0, pec=0.108, lat=0.09, rows=VEG_TORSO), n=18, cap0=None, cap1=None)
    st = kit.subsurf(st, 2)
    kit.tag(st, suit, grp=G_TORSO)
    body.append(realbody.skin(st))
    proxy.append(st)
    # 高領（參考 01：緊身衣的高領一路到下巴下方，露出的脖子只有約 0.1 頭）
    ycl = 0.1
    col = limb('collar', V((0, F.y(0.93), -0.008)), V((0, 1, 0)), [(0, 0.075, 0.07), (0.05, 0.068, 0.064), (ycl, 0.066, 0.062)], n=14, cap0=None, cap1=None)
    col = kit.subsurf(col, 2, solidify=0.006)
    kit.tag(col, suit, grp=G_NECK, ol=0.7)
    # 換真人身體時高領幾乎不挪（fit_lim 2 mm）：retarget 照「真人脖子−舊脖子管」把高領往內收了 1.4 cm，
    # 上緣內壁（約 0.05 m）比真人脖子（0.054 m）還細，領口上緣一圈和脖子互相穿插，從領口冒出一排膚色方齒。
    # 保持原本 0.062～0.066 m 的半徑，上緣離脖子約 1 cm
    col['fit_lim'] = 0.002
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
    # 腿的粗細決定真人身體大腿、小腿的徑向縮放（realbody.Fitter.limb_rad：這條管子在骨段 0.3～0.7 的半徑中位數÷底模）。
    # 參考 01：大腿最粗約 0.75 頭、膝上仍有 0.55 頭；04 GK：大腿寬約腰帶寬的 0.45、膝寬約大腿的 0.75。
    # 舊版大腿量到 0.0725 m（底模的 0.77 倍，最粗 0.49 頭），管子在膝下 20 cm 就收尖，小腿量到 0.035 m、夾到 0.6 倍下限，
    # 膝上只剩 7 cm 寬，俯視下兩條腿像細管。PROPS thigh 改 0.1072（k_leg 0.96），小腿段延長到靴筒中段
    leg = leg_tube(F, suit, [
        (-0.07, 0.122 * kl, 0.122 * kl),
        (0.03, 0.118 * kl, 0.122 * kl, quad),
        (0.18, 0.106 * kl, 0.11 * kl, quad),
        (F.tl - 0.04, 0.078 * kl, 0.084 * kl),
        (F.tl + 0.06, 0.074 * kl, 0.078 * kl, calf),
        (F.tl + 0.14, 0.066 * kl, 0.07 * kl, calf),
        (F.tl + 0.22, 0.056 * kl, 0.058 * kl),
        (F.tl + 0.3, 0.044 * kl, 0.046 * kl),
    ])
    realbody.skin(leg)

    # 胸背甲：貼著緊身衣（離表面 1.6 cm，上緣收到 0.5 cm 貼住高領），從腰最細處（腰帶）包到頸根；
    # 肩頂由 cut_armholes 沿上臂骨軸挖掉，留下從頸根繞過腋下的 U 字甲緣（參考 04）。
    # 舊版離表面 2.8 cm、上緣停在肩線（u 0.9），是一個白色的桶，頸根一圈寬開口露出外框殼的黑縫
    yb = F.y(0.4)   # 腰帶（腰最細處；參考 01 腰帶在胸甲下緣下約 0.25 頭、GK 04 在肚臍上方）
    ar = kit.loft('armor', torso_rows(F, e=lambda u: 0.016 - 0.011 * smooth((u - 0.9) / 0.15) - 0.003 * smooth((0.55 - u) / 0.15),
                                      u0=0.38, u1=1.08, pec=0.22, lat=0.06, p=2.3, rows=VEG_TORSO), n=20, cap0=None, cap1=None)
    ar = kit.subsurf(ar, 1)
    # 袖孔：綁定姿勢（A 字）的上臂骨軸 0.11 m 以內，再加上手臂放下 0.55 rad（站姿、待機）後肩頭那一段（s＜0.1）的骨軸 0.11 m 以內。
    # 只沿綁定姿勢挖時，手臂一放下，加粗後的三角肌後緣就轉到背甲的袖孔邊上，站著就從背甲頂出一排藍色階梯；
    # 參考 04／05 的 U 字袖孔本來就開得深，三角肌整塊露在甲外
    ah = vegeta_armhole(F, 0.11 * F.k_arm, front=0.025)
    kit.iso_cut(ar, ah)
    kit.cut(ar, lambda co, n: ah(co) < 0)
    ar = kit.subsurf(ar, 1, solidify=0.012)
    kit.tag(ar, white, grp=G_CHEST, mat=2)
    # 背後腰上的金色橫紋帶（參考 05：背甲白色只到肩胛下，下背到腰帶是橫紋帶）；前方與兩側維持白色（04 的腹甲是另一片尖舌）
    ybk = F.y(0.66)
    kit.paint_field(ar, lambda co: max(co.y - ybk, co.z + 0.02 - 0.1 * max(0.0, 1 - abs(co.x) / F.cx)), gold, 2)
    # 橫紋另做一片貼在背甲外的橫紋帶（vegeta_backband）。直接畫在背甲上時，背甲下段的面約 3～4 cm 高、比橫紋間距還大，
    # 等值切線一條邊只切一刀，橫紋併成梯形色塊或整道消失（舊版背面只剩一兩條細線，像一整條素面金帶）；
    # 只把那一段細分再畫，條紋邊緣仍是鋸齒，細分邊界還有裂縫
    # 換真人身體時橫紋帶照背甲外殼表面的位移挪（ride_on＋ride_bary，見 realbody.retarget）。
    # 自己量（或併進背甲同一個物件）時，薄片離皮膚遠 1.2 cm，脊椎正中那幾列的射線打到原本皮膚的背溝，
    # 往內挪 2.5 cm、背甲只挪 1.1 cm，背甲外殼從橫紋帶下緣頂出一塊沒有橫紋的金色圓斑；
    # 抄最近背甲頂點的位移時，最近頂點在內外殼之間跳，條紋一格格閃爍
    bb = vegeta_backband(F, ar, gold, goldD, F.y(0.42), ybk)
    bb['ride_on'] = ar.name
    bb['ride_bary'] = 1
    # 胸甲是硬殼、綁骨群組只跟胸廓（G_CHEST）：底下被它蓋住的皮膚也釘在胸廓上（realbody.weights_for 的 pin_bones）。
    # 原本皮膚照骨熱分到鎖骨與上臂，一抬手（出拳、施法）胸口整片皮膚往前上方走、從白甲裡穿出藍色，只剩外圈一道白邊
    ar['pin_bones'] = ('torso', 'ribs')
    # 底下的皮膚收到胸甲內壁裡 1.2 cm（預設 3 mm）：袖孔邊上的皮膚只釘住一部分（spread_pin 往孔裡漸減），
    # 手臂從綁定姿勢放下時，那一圈皮膚跟著三角肌外移幾公釐就穿出 3 mm 的間隙，背甲袖孔邊站著就是一排藍色階梯
    ar['conform_gap'] = 0.012
    body += [ar, bb]
    # 腹甲尖舌：上緣在胸肌下緣正中，尖端到胯前（參考 01 的尖端約在胯高、04 在胯下）
    # 真人身體的胯下約在 y 0.745（F.L−0.115）；尖端放到胯高（參考 01 尖端在胯高）。
    # 再往下（F.L−0.145）尖端整段夾在兩條大腿之間，權重抄兩側大腿，站姿就撕成兩根叉
    ytip = F.L - 0.125
    tg = vegeta_tongue(F, [ar, st, pel], gold, goldD, F.y(0.64), yb, ytip)
    body.append(tg)
    # 側腰甲（左右）
    # 射線目標要含緊身衣：骨盆管只到 u 0.15（y 0.95），腰帶到骨盆頂那 13 cm 的射線全部落空、取 0.16 m 的預設半徑，
    # 上緣離腰 4 cm 往外張，正面看側腰甲上半截和腹甲連成一片黃裙（第 2 輪）
    tas = vegeta_tasset(F, [st, pel, leg], gold, goldD, yb + 0.005, F.L - 0.13)
    # 毛皮腰帶
    body += vegeta_fur_belt(F, [ar, bb, tg, st, pel], fur, yb)
    # 肩甲（左右）
    pad = vegeta_pad(F, gold, goldD, white)
    pair_add(body, proxy, [pad, tas])

    # 手臂：整條藍色緊身衣（參考 01：藍色一路到手套口）；白手套（手套口在前臂中段）
    # 上臂加粗（k 1.1→1.3，前臂維持 1.1）：參考 04 的二頭肌和手套口一樣寬，舊版上臂 0.119 m、手套口 0.137 m，前臂反而比上臂粗。
    # 真人身體的上臂照這條手臂量（上限見 realbody.ARM_CAP_HERO），肌肉起伏另由 realbody.RELIEF_HERO 加強
    arm = arm_skin(F, suit, muscle=1.3, k=1.3, k_fore=1.1, grp=G_VARM_L, mat=0)
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
    cuff = limb('bootCuffL', F.th, F.dl, [(top_s - 0.03, rt * 1.72, rt * 1.72), (top_s - 0.005, rt * 1.44, rt * 1.48), (top_s + 0.03, rt * 1.12, rt * 1.16), (top_s + 0.075, rt * 0.9, rt * 0.94)], n=16, cap0=None, cap1=None)
    cuff = kit.subsurf(cuff, 2, solidify=0.006)
    kit.tag(cuff, white, grp=heroes.G_FOOT_L, ol=0.8)
    # 換真人身體時靴口幾乎不挪（fit_lim 4 mm）：retarget 照「真人小腿−腿管」把靴口平均往內收 1.7 cm，
    # 喇叭口從 0.8 頭縮成 0.65 頭的直筒
    cuff['fit_lim'] = 0.004
    pair_add(body, proxy, [arm, glove, hand, leg, cuff] + bt, proxy_set=[arm, hand, leg] + bt)
    body.append(fit_band(F, arm, 'teamL', [(0.158, 0, 0, 0.005), (0.169, 0, 0, 0.0065), (0.18, 0, 0, 0.005)], team, G_ARM_L, thick=0.006, mat=5, ol=0.5))

    heads = {}
    for form in ('base', 'ssj'):
        # soft 6：整顆底模頭的法線在網格上平滑 6 輪（同弗利沙的做法，輪數較少、臉的骨相保留）；同時讓 build_heroes 的頸胸法線平滑加到 24 輪。
        # face_normals 只處理下巴以上，下顎底下到頸部接縫那段的底模三角形大，卡通明暗的交界在側面切成一塊塊多邊形
        h = anime_head('head_' + form, F, skin, jaw=1.08, chin=0.98, brow=0.6, square=0.4, soft=6)
        hc = P(0x17130f) if form == 'base' else P(0xffd447)
        # side_y 0.25：頭側的髮帽只到眉高（參考 01：兩側頭髮停在太陽穴、耳朵整個露出）；預設 −0.05 時兩側髮帽垂到耳垂，
        # 正面看像兩條長鬢角把臉框住
        heads[form] = [h, hair_cap('cap_' + form, F, hc, hairline=0.5, temple=0.55, scale=1.06, peak=(0.3, 0.62, 1.0), fit=0.002, side_y=0.25)] + hair(F, hc, vegeta_hair(form), wmul=1.1)  # M 字高髮際線，額頭露出；美人尖直接切在髮帽上
    custom = {G_VARM_L: vegeta_armpit(F, 'L'), G_VARM_R: vegeta_armpit(F, 'R'), G_VPAD: vegeta_pad_w,
              G_VTAS: vegeta_tasset_w(yb + 0.005, F.L - 0.13)}
    return finish(F, P, body, proxy, heads, custom=custom)


def vegeta_hair(form):
    """參考 01：整束往上豎成收尖的火焰（像倒過來的大蒜），最寬在頭頂高度（半寬約 1.2 hr）、往上收成正中的單一尖頂，
    髮尖高出頭頂約 1.2 頭（頭心上 3.25 hr）；從側面看往後上方傾約 15°。
    第 2 輪的髮尖高 2.0～2.5 hr、正中五根差不多高（2.16～2.28），排成平頂的皇冠，耳上那幾根往兩側張。
    第 3 輪改成由中央往兩側逐根降低：每根的髮尖落在一條火焰形的包絡線上（正中最高、往外每根低 0.4～0.55 hr），
    最外兩根往兩側翹出（參考 01 的髮束在頭頂高度最寬、約臉寬的兩倍），上面幾根往中線收。
    下表的髮尖是乘上 HAIR_GROW（髮長 ×1.15）之後的實際位置，在這裡換回 hair() 吃的參數。"""
    k = 1.0 if form == 'base' else 1.08
    G = heroes.HAIR_GROW

    def cl(root, tip, w, th, bend=(0, 0, 0)):
        t = [r + (q - r) / G for r, q in zip(root, tip)]
        t[1] = root[1] + (t[1] - root[1]) * k
        return (root, tuple(t), w, th, bend)
    return sym([
        # 前排：正中最高，往外依序降低
        cl((0.0, 0.95, 0.25), (0.0, 3.25, -0.4), 0.46, 0.24, (0, 0, 0.12)),
        cl((0.3, 0.9, 0.15), (0.3, 2.85, -0.5), 0.42, 0.23, (0.06, 0, 0.05)),
        cl((0.55, 0.75, 0.02), (0.7, 2.35, -0.55), 0.4, 0.22, (0.1, 0, 0)),
        cl((0.75, 0.5, -0.12), (1.18, 1.8, -0.62), 0.38, 0.21, (0.12, 0, 0)),
        cl((0.82, 0.3, -0.35), (1.45, 1.1, -0.7), 0.34, 0.19, (0.08, 0, 0)),
        # 後排：撐出後腦的厚度，側面看整束往後上方掃
        cl((0.3, 0.75, -0.55), (0.18, 3.0, -1.05), 0.44, 0.23),
        cl((0.0, 0.6, -0.8), (0.0, 3.1, -1.2), 0.46, 0.24),
        cl((0.55, 0.45, -0.75), (0.68, 2.35, -1.12), 0.4, 0.22),
        cl((0.75, 0.15, -0.6), (1.32, 1.3, -0.98), 0.36, 0.2),
        cl((0.0, 0.1, -0.95), (0.0, 1.75, -1.4), 0.42, 0.22),
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
# 斜背帶與背後劍鞘共用的斜率（dy/dx）：models.js 的 trunks backSocket 旋轉 −2.341 rad 對應同一個斜率，兩邊要一起改
TRUNKS_SLOPE = 0.97
# 斜背帶胸前的方扣：整塊剛性跟胸廓（骨熱失敗時的膠囊權重在方扣上左右不一，舉手時方扣扭成嘴唇形）
G_TRK_BUCKLE = 80


def trunks_buckle_w(co):
    return [('ribs', 1.0)]


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
    # GK 第一輪：外套往藍紫偏（GK 上色模型 #5a5ca8、立繪受光 #797ad4）；0x3a49b0 在角色材質下渲染成飽和的寶藍
    jacket, jacketL, jacketD = P(0x4447ab), P(0x5a5cc0), P(0x23265e)
    tank = P(0x17171b)
    # 參考圖：黑色寬褲。GK 第三輪：0x2c2c32→0x312f36（03 GK 的炭黑）：角色材質的邊緣光是固定的淡藍白，
    # 在近黑的底色上遊戲俯角的大腿亮成一片灰白的塑膠反光
    pants = P(0x312f36)
    # 靴：芥末金（參考 #d4a651，陰影 #8a6a2a），鞋頭與鞋底深棕 #4a3020；舊版 0xd2a64a 渲染成檸檬黃、鞋頭沒有分色
    bootc, bootD, bootT = P(0xc4943e), P(0x4a3020), P(0xa77a30)
    blk = P(0x1a1a1a)
    brass = P(0xb8a060)
    strapc = P(0x6399c5)   # 斜背帶：水藍（參考 03／04 GK、SHF）；舊版是棕色皮帶
    beltc = P(0xa67737)    # 腰帶：黃褐（參考 #a67737）；舊版是黑色細皮帶
    red, white = P(0xc8282e), P(0xeeeef2)
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
    # GK 第二輪：外套背面不帶背闊肌隆起（lat＝0），斷面方一點（p 2.6），胸大肌隆起 0.072→0.04（側面看胸口不再鼓成弧）。04 GK 的外套背面是平順的梯形，舊版 lat 0.04 在肩胛兩側
    # 各鼓一塊、加上圓角斷面在肩後轉彎，遊戲俯角的背面看起來像兩瓣臀部
    jk = kit.loft('jacket', torso_rows(F, e=0.02, rows=rows, pec=0.04, lat=0.0, p=2.6), n=20, cap0=None, cap1=None, gap=lambda i: 0.3 + 0.25 * smooth((us[i] - 0.5) / 0.5))
    # 袖孔：外套的殼原本包到肩關節外，抬手時殼的肩頭從袖子裡穿出成碎片。孔比袖根（約 10 cm）小，站著時孔緣藏在袖子裡
    jk = kit.subsurf(jk, 1)
    # GK 第三輪：袖根縮小、肩頂壓平（trunks_sleeve），袖孔跟著 0.08→0.072、上方較淺
    trunks_armhole(jk, F, 0.072 * F.k_arm)
    jk = kit.subsurf(jk, 1, solidify=0.01)
    kit.tag(jk, jacket, grp=G_TORSO)
    body.append(jk)
    proxy.append(jk)
    # 立領（GK 第一輪）：03／04 GK 與 01 立繪的領子在頸後豎到下巴高度、上緣往外翻開，正面敞開露出喉嚨；
    # 舊版只到 F.y(1.1)（比下巴低 4.5 cm），背面整段脖子露在外面
    # GK 第三輪：上緣往外翻開成領片（04 GK 背面）：最上一段往外張 0.58→0.7 倍胸寬、往後 1 cm；舊版是一圈圓筒形高領
    cl = kit.loft('jcollar', [S(V((0, F.y(0.95), -0.01)), F.cx * 0.5, F.cz * 0.66), S(V((0, F.y(1.05), -0.016)), F.cx * 0.46, F.cz * 0.62),
                              S(V((0, F.y(1.14), -0.026)), F.cx * 0.5, F.cz * 0.7), S(V((0, F.y(1.2), -0.045)), F.cx * 0.68, F.cz * 0.92)],
                  n=16, cap0=None, cap1=None, gap=lambda i: (0.6, 0.66, 0.8, 0.98)[i])
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
    # GK 第一輪：03 GK 正面量到帶子從右肩頂（離地約 1.57 m）斜到左腰帶上緣（約 1.23 m），斜率約 0.83、寬約 0.16 頭（4.5 cm）；
    # 舊版斜率 0.55、寬 2.4 cm，在胸前中央低了約 9 cm。胸骨中段有紅色方扣（白框），見 trunks_buckle
    # GK 第二輪：背後那段要壓在劍鞘底下（04 GK 背面看不到另一條帶子，鞘就掛在帶子上）。帶子是一個斜平面繞身體一圈，
    # 正面與背面的斜率相同，所以斜率改成和劍鞘相同的 0.97（約 44°，04 GK 量到鞘約 45°、03 正面帶子約 0.88）；
    # 劍座（models.js 的 trunks backSocket）也同步改到這條線上：背面 x＝0 處鞘的中心線約在 F.y(0.8)。舊版帶子 0.83、鞘 1.09，背後兩條並排
    sn = V((TRUNKS_SLOPE, 1, 0))
    sc = V((0, F.y(0.8), 0))
    st = strap_around(F, [jk, tk], sc, sn, 0.04, 0.0045, strapc, off=0.008, grp=G_TORSO, lay='surface', steps=72, bridge=2)
    bk = trunks_buckle(st, sc, sn, -0.012, 0.08, 0.052, red, white, G_TRK_BUCKLE)
    # 換真人身體時照外套表面的位移挪（ride_on＋ride_bary）：舊版自己沿骨軸量（fit_reach 0.07），帶子和外套各自平滑位移，
    # 差幾公釐就讓外套從帶子邊緣穿出（背後帶子下緣成波浪狀鋸齒），正面也在左胸衣襟邊被外套蓋住、像鑽進外套底下
    st['ride_on'] = jk.name
    st['ride_bary'] = 1
    st['ride_smooth'] = 12
    body.append(st)
    for o in bk:   # 方扣是剛體：整塊照平均位移平移（跨在左右衣襟之間，各自取最近面會被撕成兩半）
        o['ride_on'] = jk.name
        o['ride_bary'] = 1
        o['ride_rigid'] = 1
        o['trim'] = 1
        body.append(o)
    # 外套兩側胸前的有蓋口袋（03 GK、02 SHF）：貼片投影到外套表面，跟著外套挪
    body += trunks_pockets(F, jk, jacket, jacketL, jacketD)
    # 長袖外套＋袖口
    ka = F.k_arm
    # 貼合手臂的長袖（和客串角色同一個函式）。GK 第二輪：照肌肉斷面的袖子上臂量到 0.73 頭粗、前臂只有 0.43 頭（03 GK 上臂約 0.5、
    # 前臂含袖約 0.55 頭），上臂比前臂粗一大截；上臂段縮細、前臂段放寬成較直的外套袖
    sl = trunks_sleeve(F, jacket)
    cuff = band('cuffL', F.sh, F.da, F.up + F.lo - 0.085, F.up + F.lo - 0.045, 0.058 * F.k_fore + 0.016, 0.056 * F.k_fore + 0.016, jacketL, G_FORE_L, thick=0.008)
    arm = arm_skin(F, skin, muscle=0.9, k=1.0)
    kit.paint_field(arm, lambda co: arm_s(F, co) - (F.up + F.lo - 0.06), jacket, 0)
    hand = fist(F, skin, scale=1.05)
    # 褲、腰帶、靴
    # GK 第一輪：高腰褲。03 GK 與 01 立繪的腰帶都在外套下襬下方約 0.17 頭（露一截黑背心）、下巴下方只 1.2 頭；
    # 舊版褲頭在 F.y(0.15)、腰帶在 L＋0.08，外套下襬到腰帶之間露出 0.6 頭的背心。腰帶中心放在外套下襬（F.y(0.38)）下 6.5 cm
    yb = F.y(0.38) - 0.065
    body.append(pelvis(F, pants, e=0.01, top_u=(yb - F.yT) / F.T))
    proxy.append(body[-1])
    leg = trunks_leg(F, pants)
    # 靴：03 GK 靴高約 1.2 頭、靴筒寬約 0.75 頭（舊版 1.0 頭高、0.45 頭寬的細筒）；靴口一圈較深的芥末色分節
    btop = F.tl + 0.19
    bt = boot(F, bootc, btop, 0.105, pal_sole=bootD, toe=1.1)
    zt = max(v.co.z for v in bt[1].data.vertices)
    kit.paint_field(bt[1], lambda co: (zt - 0.08) - co.z, bootD, 0)   # 深棕鞋頭（參考 01／02／03 都是深色鞋頭）
    # GK 第二輪：靴筒的分節（03 GK、05 SHF）：加厚的靴口＋兩道較深的橫向綁帶，舊版只有一圈淡色細帶、整支是平滑圓筒
    rim = band('bootRimL', F.th, F.dl, btop - 0.02, btop + 0.034, 0.105 * F.k_shin + 0.012, 0.1 * F.k_shin + 0.01, bootT, G_FOOT_L, thick=0.012, rb=1.03)
    ks_, sl_ = F.k_shin, F.sl

    def shaft_r(s):   # 靴筒在沿腿 s 處的半徑（照 heroes.boot 的斷面內插）
        pts = [(btop + 0.03, 0.105 * ks_), (btop + 0.12, 0.0945 * ks_), (F.tl + sl_ - 0.075, 0.057 * ks_)]
        for (s0, r0), (s1, r1) in zip(pts, pts[1:]):
            if s <= s1:
                return lerp(r0, r1, max(0.0, (s - s0) / (s1 - s0)))
        return pts[-1][1]
    # GK 第三輪：靴筒改成「靴口反摺＋正面一片縱向的護片＋腳踝一道綁帶」（02 SHF 正面）。舊版是兩道等距的橫環加靴口，
    # 正面看是四圈疊起來的輪胎
    straps = [band('bootStrapL1', F.th, F.dl, btop + 0.15, btop + 0.175, shaft_r(btop + 0.15) + 0.006, shaft_r(btop + 0.175) + 0.006, bootT, G_FOOT_L, thick=0.007, rb=1.04)]
    pf = []
    for k in range(6):
        sk = lerp(btop + 0.03, btop + 0.16, k / 5)
        r = shaft_r(sk)
        pf.append(S(F.leg_pt(sk) + V((0, 0, r * 0.97 + 0.002)), lerp(0.034, 0.03, k / 5), 0.008, p=3.0))
    panel = kit.loft('bootPanelL', pf, n=12, cap0='pole', cap1='pole', front=V((0, 0, 1)), side=V((1, 0, 0)))
    panel = kit.subsurf(panel, 1)
    straps.append(kit.tag(panel, bootT, grp=G_FOOT_L, ol=0.5))
    patch = trunks_patch(F, sl, white, blk)   # 只在左臂，不鏡射
    pair_add(body, proxy, [sl, cuff, arm, hand, leg, rim] + straps + bt, proxy_set=[arm, hand, leg] + bt)
    body.append(team_band(F, team, on=sl))
    body += patch
    # 腰帶：黃褐、寬約 0.2 頭（5 cm），正中央紅色方扣加白框（參考 03 GK、01 立繪）
    body.append(belt_ring(F, yb, 0.05, beltc, e=0.02))
    bz = max(v.co.z for v in body[-1].data.vertices if abs(v.co.x) < 0.01 and abs(v.co.y - yb) < 0.02)
    for o in trunks_buckle_box(V((0, yb, bz + 0.002)), V((1, 0, 0)), V((0, 1, 0)), V((0, 0, 1)), 0.072, 0.04, red, white, G_BELT):
        body.append(o)
    # GK 第三輪：腰帶分節（02 SHF、03 GK）：方扣兩側起每隔一段一道較深的縱向接縫條；舊版是平滑的一條
    body += trunks_belt_seams(F, body[-3], yb, 0.05, P(0x7d5524))

    heads = {}
    for form in ('base', 'ssj'):
        # GK 第三輪：照題目的約定（頭高＝2.8×眼到下巴）量，眼到下巴是頭顱高的 0.46（約定 0.36）、下巴到地只有眼到下巴的 12.3 倍
        # （03 GK 15.3、01 立繪 16、悟空 14.3），下半臉長了約兩成。face_len 1→0.7：眼線與顱骨不動、下巴往上收約 3.9 cm；
        # 頭因此整顆往下放 2.2 cm（models-heroes.js 的 H、neck），脖子不會變長。
        # muzzle 0.75、nose 0.7（同悟空）：底模的上下唇與鼻底在臉縮短後擠成一道深色的咬牙形（正面描成一撇鬍子），和臉部貼花的嘴疊成兩張嘴
        h = anime_head('head_' + form, F, skin, jaw=0.98, chin=0.95, face_len=0.7, muzzle=0.75, nose=0.7)
        hc = P(0xb9a6e8) if form == 'base' else P(0xffd447)
        if form == 'base':
            # GK 第二輪：一般型是貼頭、圓順的中分蘑菇頭（參考 05 SHF）：瀏海從中分處往兩側蓋住額頭到眉上，只在中分處露出一個窄的倒 V，
            # 兩側髮尾到耳垂、後腦圓。舊版是 hairline 0.5 的髮帽加尖角髮束，額頭大片露出、兩側髮尖垂到下巴
            # GK 第三輪：髮殼上的髮束外框 0.85→0.22。遊戲俯角下頭頂是畫面裡面積最大的部位，髮束兩側與髮尾的描線在髮殼上圍成
            # 心形（正面）、嘴唇形（後腦）的閉合大框；髮束改成從中分線往兩側、往後梳的平行髮流（見 trunks_hair），只靠明暗分出來
            parts = [h, trunks_bowl('cap_' + form, F, hc)] + hair(F, hc, trunks_hair(), grow=1.0 / heroes.HAIR_GROW, ol=0.22)
        else:
            # GK 第二輪：超賽型的額頭也被瀏海蓋到眉毛（參考 03 GK），中分處只露出窄的倒 V（peak 深度取負＝中央髮際往上開）；
            # 舊版 hairline 0.4＋temple 0.2，太陽穴往上退成 M 字，臉被一圈髮緣框住
            parts = [h, hair_cap('cap_' + form, F, hc, hairline=0.12, temple=0.0, peak=(-0.32, 0.3, 1.3), fit=0.002)]
            parts += hair(F, hc, trunks_ssj()) + hair(F, hc, trunks_ssj_bangs(), grow=1.0 / heroes.HAIR_GROW)
            parts += hair(F, hc, trunks_ssj_nape(), grow=1.0 / heroes.HAIR_GROW, ol=0.6)
        heads[form] = parts
    extras = trunks_sword(P, brass)
    sw = sleeve_arm_weights(F)
    return finish(F, P, body, proxy, heads, extras=extras, custom={heroes.G_ARM_L: sw, heroes.G_ARM_R: sw, G_TRK_BUCKLE: trunks_buckle_w})


def trunks_belt_seams(F, belt, yb, h, pal, angs=(0.62, 0.95, 1.3, 1.75, 2.2, 2.65, 3.14)):
    """腰帶的分節接縫（GK 第三輪）：在腰帶外表面上、繞腰的幾個角度（從正前方起，弧度，左右對稱；正中央是方扣）各放一條
    較深色的縱向細條（寬 8 mm、凸出約 2 mm、和腰帶等高）。位置從腰帶中心水平往外打射線取表面。"""
    tr = tree_of(belt)
    out = []
    for a in angs:
        for sx in ((1, -1) if a < 3.1 else (1,)):
            d = V((sx * math.sin(a), 0, math.cos(a)))
            hit = tr.ray_cast(V((0, yb, 0)) + d * 0.5, -d, 1.0)
            if hit[0] is None:
                continue
            n = hit[1] if hit[1].dot(d) > 0 else -hit[1]
            t = V((0, 1, 0)).cross(n).normalized()
            b = kit.box_cage('beltSeam', 0.008, h * 0.9, 0.003, cuts=(2, 4, 1))
            M = Matrix(((t.x, 0, n.x, hit[0].x), (t.y, 1, n.y, hit[0].y), (t.z, 0, n.z, hit[0].z), (0, 0, 0, 1)))
            kit.transform(b, M @ Matrix.Translation(V((0, 0, 0.0005))))
            b = kit.subsurf(b, 1)
            out.append(kit.tag(b, pal, grp=G_BELT, ol=0.0))
    return out


def trunks_patch(F, sl, white, dark, s=0.075, r=0.034):
    """左上臂外側的 Capsule Corp 圓形臂章（GK 第三輪，參考 01 立繪：白底圓形、深色字，直徑約 0.3 頭）。
    白色圓片與中央深色的 C 字弧都從外側往骨軸打射線、貼到袖子表面外 2.5／4 mm（同口袋的作法），
    綁骨群組同袖子（G_ARM_L），換真人身體時跟著袖子挪（ride_on）。字樣只做成一道粗 C 弧，不放文字。"""
    tr = tree_of(sl)
    c0 = F.arm_pt(s)
    up = V((-F.da.y, F.da.x, 0)).normalized()
    if up.y < 0:
        up = -up
    nrm = (up * 0.62 + V((0, 0, 0.78))).normalized()    # 外側偏前（垂手站時臂章朝外前方，正面與 3/4 都看得到）
    t1 = F.da.normalized()
    t2 = nrm.cross(t1).normalized()

    def proj(p, lift):
        hit = tr.ray_cast(p + nrm * 0.2, -nrm, 0.4)
        if hit[0] is None:
            return p
        return hit[0] + nrm * lift
    out = []
    # 白色圓片：方格映射成圓盤（每個格點都投影到袖子表面外 2.5 mm，整片貼著袖子的弧面），再加厚 1.5 mm
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=8, y_segments=8, size=1.0)
    disc = kit.to_object('ccPatch', bm)

    def sq2disc(p):
        u, v = p.x * math.sqrt(max(0.0, 1 - p.y * p.y / 2)), p.y * math.sqrt(max(0.0, 1 - p.x * p.x / 2))
        return proj(c0 + t1 * (u * r) + t2 * (v * r), 0.0025)
    kit.deform(disc, sq2disc)
    disc = kit.subsurf(disc, 1, solidify=0.0015)
    out.append(kit.tag(disc, white, grp=heroes.G_ARM_L, ol=0.45))
    # 中央深色 C 弧（開口朝手肘那側）：沿弧取點投影到圓片外 1.5 mm 的高度
    pts, rad = [], []
    for i in range(11):
        a = math.radians(45 + 270 * i / 10)
        pts.append(proj(c0 + t1 * (math.cos(a) * r * 0.5) + t2 * (math.sin(a) * r * 0.5), 0.0045))
        rad.append(r * 0.12)
    arc = path_loft('ccMark', pts, rad, n=6, flat=0.3, front=nrm, side=t2)
    out.append(kit.tag(kit.subsurf(arc, 1), dark, grp=heroes.G_ARM_L, ol=0.0))
    for o in out:
        o['ride_on'] = sl.name
    return out


def trunks_armhole(ob, F, r, top=0.85, s0=-0.03, s1=0.3):
    """外套的袖孔（heroes.cut_armholes 的上方壓扁版）：離上臂骨軸 r 以內挖掉，但朝外上方（θ＝0，A 字綁定姿勢下垂直骨軸、
    在 xy 平面內朝外上的方向）的距離先除以 top，孔在肩頂只開 r×top 深，和 trunks_sleeve 壓平的肩頂一致。"""
    up = V((-F.da.y, F.da.x, 0)).normalized()
    if up.y < 0:
        up = -up

    def f(co):
        p = V((abs(co.x), co.y, co.z))
        s = max(s0, min(s1, (p - F.sh).dot(F.da)))
        q = p - F.arm_pt(s)
        qu = q.dot(up)
        q2 = q - up * qu
        return math.sqrt(q2.length_squared + (max(qu, 0.0) / top) ** 2 + min(qu, 0.0) ** 2) - r
    kit.iso_cut(ob, f)
    return kit.cut(ob, lambda co, n: f(co) < 0)


def trunks_sleeve(F, pal, e=0.01, k_up=0.78, k_lo=1.25, thick=0.007):
    """外套長袖（GK 第三輪）：和 crossover.long_sleeve 同樣的斷面序列（上臂 k_up、前臂 k_lo），只有袖根到三角肌那段改小、改低。
    long_sleeve 的袖根從肩關節往內上 11 cm 起、半徑在肩關節附近最大（三角肌帽），垂手站時袖根的圓頂翹到嘴角高度，
    正面看肩頭是兩顆比外套肩線高的圓球（ortho 正面肩頂只比下巴低 0.15 頭，03 GK 約 0.3 頭）。
    改成袖根從肩關節內上 10 cm 起、半徑小一圈，最粗處往下移到肩下 7 cm，肩線從立領往外往下斜成梯形。
    肘部不再鼓起：long_sleeve 的上臂下端半徑 5.6 cm、肘下 2 cm 跳到 8.7 cm，彎肘時袖子在肘部鼓成一顆氣球；
    改成上臂下端 6.4 cm → 肘 7.2 cm → 前臂 7.5 cm 的直筒外套袖（03 GK 前臂含袖約 0.55 頭）。
    上臂段再細一點（肩下 7～15 cm 的半徑 ×0.93）：換真人身體時袖子還會被往外推約 1 cm，舊版上臂含袖粗約 0.56 頭（03 GK 約 0.5 頭），
    遊戲俯角舉手握劍柄時右上臂像一顆枕頭。
    肩頭的斷面上下不對稱（真人的肩關節上方只有一層肩峰，腋下那側才厚）：θ＝0（A 字綁定姿勢的外上方，垂手時是肩頂）的半徑
    在袖根收 45%、肩關節收 30%、肩下 7 cm 收 10%，往下恢復；外套的袖孔照同樣的比例改成上方較淺（trunks_armhole），孔緣仍藏在袖子裡。
    舊版袖根在肩關節內上 7 cm（鎖骨權重，垂手時不跟著轉下去）的圓頂頂到離地 1.52 m，比肩關節高 8 cm。"""
    ka, kf = F.k_arm * k_up, F.k_fore * k_lo
    up, lo = F.up, F.lo
    s_end = up + lo - 0.05

    def flat(k):
        return lambda th: 1 - k * ang_bump(th, 0.0, 1.4)
    st = [
        (-0.1, 0.03 * ka, 0.03 * ka, flat(0.25)),
        (-0.075, 0.058 * ka + e * 0.5, 0.058 * ka + e * 0.5, flat(0.25)),
        (-0.035, 0.075 * ka + e, 0.076 * ka + e, flat(0.2)),
        (0.0, 0.08 * ka + e, 0.082 * ka + e, flat(0.12)),
        (0.07, 0.093 * ka + e, 0.086 * ka + e),
        (0.15, 0.086 * ka + e, 0.082 * ka + e),
        (up - 0.04, 0.08 * ka + e, 0.08 * ka + e),
        (up + 0.02, 0.056 * kf + e, 0.056 * kf + e),
        (up + 0.12, 0.058 * kf + e * 1.1, 0.054 * kf + e * 1.1),
        (s_end - 0.03, 0.056 * kf + e * 1.2, 0.05 * kf + e * 1.2),
        (s_end, 0.055 * kf + e * 1.2, 0.049 * kf + e * 1.2),
    ]
    sl = limb('sleeveL', F.sh, F.da, st, n=14, cap0='pole', cap1=None)
    sl = kit.subsurf(sl, 2, solidify=thick)
    sl['hollow'] = (0.06, s_end - 0.06)   # 換真人身體時，袖子裡的底模手臂整段刪掉（realbody.hollow_mask）
    return kit.tag(sl, pal, grp=heroes.G_ARM_L)


def trunks_leg(F, pal):
    """特南克斯的寬褲管（GK 第一輪，參考 03 GK 正面、01 立繪）：大腿適中、膝下最寬（單腳約 1.1 頭 ≈ 0.3 m）、
    在靴口上方收緊、往下塞進靴筒。共用的 baggy_leg 是悟空的燈籠褲（膝蓋處反而收窄、膝下只比大腿寬一點），照它做出來的是直筒褲。
    GK 第三輪：褲管內側收窄（外側不動）。髖關節只離中線 6.6 cm，大腿 10.4 cm、膝下 13 cm 的圓斷面內側一路越過中線，
    正面看兩條褲管從腰帶黏到離地 1.1 頭（像一件袴）；03 GK、02 SHF 從胯下（約 3 頭高）往下就看得到腿縫。
    內側（θ＝π）的半徑照「骨軸離中線的距離 − 留縫」收（胯下附近收最多，往膝蓋漸少），兩腿之間留一道縫。
    褲子的外框殼每邊外擴約 8 mm，縫小於 2 cm 會被兩條外框填滿（正面看仍黏成一塊），所以胯下 1 cm、往下到大腿中段漸增到 1.6 cm；
    內側面的外框倍率也降到 0.35（只描褲管外側的輪廓，腿縫靠背景色分開）。"""
    tl = F.tl
    bg = lambda th: 1 + 0.07 * ang_bump(th, FRONT, 1.2) + 0.05 * ang_bump(th, 0, 1.0)

    def gap(s):
        return lerp(0.01, 0.016, smooth((s - 0.14) / 0.14))

    def inner(s, r):
        # s 處骨軸離中線的距離 cx；內側半徑最多 cx − gap（膝蓋的前後鼓起照舊，只收朝內的那一側）
        cx = F.leg_pt(s).x
        k = max(0.0, 1.0 - (cx - gap(s)) / r)
        return lambda th: bg(th) * (1 - k * ang_bump(th, math.pi, 1.3))

    def row(s, a, b, mod=True):
        return (s, a, b, inner(s, a) if mod else None)

    def ol_inner(co):
        s = (co - F.th).dot(F.dl)
        if s < 0.1 or s > tl + 0.17:
            return None
        d = F.leg_pt(s).x - co.x   # 離骨軸往內的距離
        return lerp(1.0, 0.35, smooth((d - 0.02) / 0.03))
    leg = leg_tube(F, pal, [
        (-0.07, 0.1, 0.1),
        (0.02, 0.105, 0.11),
        row(0.14, 0.104, 0.108),
        row(0.28, 0.1, 0.104),
        row(tl - 0.06, 0.106, 0.11),
        row(tl + 0.05, 0.132, 0.128),
        row(tl + 0.13, 0.134, 0.124),
        (tl + 0.185, 0.094, 0.094),
        (tl + 0.215, 0.068, 0.07),
        (tl + 0.235, 0.058, 0.06),
    ])
    return kit.paint_ol(leg, ol_inner)


def trunks_buckle_box(pos, along, across, nrm, L, W, red, white, grp):
    """紅色方扣加白框（腰帶、斜背帶）：白框薄方塊上疊一塊略凸的紅色方塊。along／across／nrm 是方扣的長邊、短邊、朝外方向。"""
    M = Matrix(((along.x, across.x, nrm.x, pos.x), (along.y, across.y, nrm.y, pos.y), (along.z, across.z, nrm.z, pos.z), (0, 0, 0, 1)))
    out = []
    # GK 第二輪：白框 8 mm、紅片再疊 5.5 mm，側面看是一片立起來的鰭；改成 3.5＋2.5 mm（側面只比帶子厚一點）
    for nm, l, w, t, dz, pal, ol in (('bkFrame', L, W, 0.0035, 0.0, white, 0.5), ('bkRed', L * 0.78, W * 0.66, 0.0025, 0.0025, red, 0.0)):
        # 細分 1 次的方塊籠會圓成橢圓（紅色只剩一個小點）：籠子先切 3 刀，細分後只有邊角變圓
        b = kit.box_cage(nm, l, w, t, cuts=(3, 3, 3))
        kit.transform(b, Matrix.Translation(V((0, 0, dz + t / 2))))
        b = kit.subsurf(b, 1)
        kit.transform(b, M)
        out.append(kit.tag(b, pal, grp=grp, mat=2, ol=ol))
    return out


def trunks_buckle(strap, c, n, x, L, W, red, white, grp):
    """斜背帶胸前的方扣：在帶子平面上取 x 處、從正面射線打到帶子表面，沿帶子方向擺方扣。"""
    tr = tree_of(strap)
    y = c.y - n.x / n.y * x
    hit = tr.ray_cast(V((x, y, 0.6)), V((0, 0, -1)), 1.2)
    p, nh = hit[0], hit[1]
    if nh.z < 0:
        nh = -nh
    t = n.normalized().cross(nh).normalized()
    if t.x < 0:
        t = -t
    return trunks_buckle_box(p + nh * 0.001, t, nh.cross(t).normalized(), nh, L, W, red, white, grp)


def trunks_pockets(F, jk, pal, palL, palD):
    """外套左右胸前的有蓋口袋（03 GK、02 SHF）：袋身與袋蓋是兩片貼片，沿 z 射線投影到外套外層。
    袋身和外套同色、浮 1.5 mm，袋蓋較亮、再浮 1.5 mm、下緣略寬；綁骨群組 G_RIDE（權重抄底下外套），換真人身體時跟著外套挪（ride_on）。
    GK 第二輪：舊版在一片 20×20 的格子上畫深色縫線（3～4 mm 寬），身體減面後重投影顏色，線條變成一階一階的鋸齒，
    遊戲俯角下是髒斑；貼片又浮 6 mm，側面看口袋凸出外套輪廓。03 GK 上色模型的口袋也沒有深色描邊，只靠袋蓋的明暗分出來。"""
    tree = tree_of(jk)
    out = []
    hw, hh, cy = 0.036, 0.038, F.y(0.8)
    for sx in (1, -1):
        cx = sx * 0.135
        for nm, x0, x1, y0, y1, lift, col in (('pocket', -hw, hw, -hh, hh * 0.25, 0.0015, pal),
                                               ('pflap', -hw - 0.003, hw + 0.003, hh * 0.2, hh + 0.002, 0.003, palL)):
            bm = bmesh.new()
            bmesh.ops.create_grid(bm, x_segments=10, y_segments=8, size=1.0)
            ob = kit.to_object(nm, bm)
            kit.deform(ob, lambda p, x0=x0, x1=x1, y0=y0, y1=y1: V((cx + lerp(x0, x1, (p.x + 1) / 2), cy + lerp(y0, y1, (p.y + 1) / 2), 0.0)))

            def proj(p, lift=lift):
                hit = tree.ray_cast(V((p.x, p.y, 0.5)), V((0, 0, -1)), 1.0)
                if hit[0] is None:
                    return p
                nrm = hit[1] if hit[1].z > 0 else -hit[1]
                return hit[0] + nrm * lift
            kit.deform(ob, proj)
            ob = kit.subsurf(ob, 1, solidify=0.0012)
            kit.tag(ob, col, grp=heroes.G_RIDE, ol=0.0)
            ob['ride_on'] = jk.name
            ob['ride_bary'] = 1
            ob['trim'] = 1
            out.append(ob)
    return out


def trunks_bowl(name, F, pal, brow=0.06, part=(0.3, 0.34), side=-0.6, back=-0.66, scale=1.13, thick=0.07):
    """一般型的蘑菇頭髮殼：整片包住頭頂與後腦，正面開到眉上（brow，單位球的 y），中分處往上開一個窄的倒 V
    （part＝(深度, 半寬)），兩側下緣在耳垂（side）、後腦到頸根上方（back）；耳上一帶往外微蓬、下緣往內收，是圓順的碗形。
    開口與下緣都沿等值線切開，邊緣是平滑曲線；瀏海與下緣切成一瓣瓣圓弧（髮束的鈍尖），不是一圈等高的帽緣。
    臉側的開口從眉尾往下漸漸往後退到耳前（鬢角），側面看不是一道鉛直的切面。"""
    c, hr = F.c, F.hr
    cap = kit.quad_sphere(name, 1.0, cuts=20)
    pd, pw = part

    def opening(co):   # ＜0：臉的開口（正面、眉上以下，中分處往上開）
        hl = brow + pd * max(0.0, 1.0 - abs(co.x) / pw) ** 1.3 + 0.07 * abs(math.sin(co.x * 6.0))
        z0 = 0.16 - 0.26 * smooth((brow - co.y) / 0.55)
        return max(z0 - co.z, co.y - hl)

    def lower(co):     # ＜0：下緣以下（兩側到耳垂、後腦較低），一瓣瓣圓弧
        t = smooth((-co.z + 0.1) / 0.8)
        th = math.atan2(co.x, co.z)
        return co.y - lerp(side, back, t) - 0.07 * abs(math.sin(th * 4.5))
    kit.iso_cut(cap, opening)
    kit.iso_cut(cap, lower)
    kit.cut(cap, lambda co, n: opening(co) < 0 or lower(co) < 0)

    def dfm(p):
        k = 1 + 0.08 * bump(p.y, 0.15, 0.5) - 0.06 * smooth((-p.y - 0.15) / 0.35)   # 耳上微蓬、下緣內收
        return c + V((p.x * hr * 0.8 * scale * k, p.y * hr * 0.9 * scale + hr * 0.1, p.z * hr * 0.88 * scale * k - hr * 0.04))
    kit.deform(cap, dfm)
    cap = kit.subsurf(cap, 1, solidify=hr * thick)
    return kit.tag(cap, pal, mat=1, grp=G_FREE, ol=0.9)


def trunks_hair():
    """一般型蓋在髮殼上的髮束（參考 05 SHF）：從中分處往兩側、往後梳的髮片，額前幾撮細瀏海垂到眉間。
    舊版是往外下方刺出的尖片，兩側髮尖垂到下巴。
    GK 第三輪：舊版四片寬髮片（寬 0.46）的兩側描線在髮殼上圍成閉合的大框：俯視正面是心形、後腦是嘴唇形。
    改成七片較窄的髮束，髮根全部排在中分線上（x 0.05），由前往後沿頭頂往兩側、往後下方梳，髮尾收尖貼在髮殼上；
    俯視是從中分線往兩側展開的平行髮流。彎曲量照弦中點推到髮殼表面外（單位 hr），髮束中段不會埋進髮殼。"""
    flows = [
        ((0.05, 0.96, 0.42), (0.62, 0.2, 0.8)),
        ((0.05, 1.02, 0.22), (0.84, 0.05, 0.56)),
        ((0.05, 1.04, 0.0), (0.95, -0.1, 0.2)),
        ((0.05, 1.02, -0.22), (0.92, -0.22, -0.24)),
        ((0.05, 0.94, -0.44), (0.8, -0.38, -0.62)),
        ((0.05, 0.8, -0.64), (0.55, -0.56, -0.86)),
        ((0.05, 0.6, -0.8), (0.24, -0.64, -0.96)),
    ]
    out = []
    for r, t in flows:
        m = (V(r) + V(t)) / 2
        b = m.normalized() * 1.1 - m
        out.append((r, t, 0.3, 0.1, tuple(b), 0.6))
    out.append(((0.05, 0.92, 0.6), (0.14, 0.12, 0.98), 0.13, 0.06, (0.02, 0.12, 0.16), 0.6))   # 額前細瀏海
    return sym(out)


def trunks_ssj():
    """超級賽亞人（GK 第一輪，參考 03／04 GK、01 立繪、02 SHF）：比悟空小而集中的尖髮，大多往上、外側的往外上方斜（不水平外張），
    髮尖約高出頭頂 0.6 頭、整體寬約 1.4 頭；中分處兩撮細長瀏海沿臉頰垂到下巴（和悟空、貝吉塔最大的辨識差異）。
    舊版是往兩側水平張開的大尖錐（寬約 2 頭），沒有垂到下巴的瀏海。"""
    return sym([
        ((0.0, 0.92, 0.2), (0.04, 1.78, -0.12), 0.46, 0.22, (0, 0, 0)),
        ((0.3, 0.88, 0.12), (0.62, 1.72, -0.1), 0.46, 0.22, (0, 0, 0)),
        ((0.55, 0.68, 0.0), (1.12, 1.46, -0.25), 0.46, 0.21, (0, 0, 0)),
        ((0.7, 0.32, -0.15), (1.32, 0.98, -0.4), 0.42, 0.2, (0, 0, 0)),
        ((0.45, 0.62, -0.42), (0.98, 1.4, -0.82), 0.44, 0.21, (0, 0, 0)),
        ((0.22, 0.82, -0.45), (0.36, 1.66, -0.78), 0.46, 0.22, (0, 0, 0)),
        ((0.0, 0.62, -0.75), (0.04, 1.42, -1.15), 0.46, 0.22, (0, 0, 0)),
        ((0.48, 0.32, -0.7), (0.86, 0.9, -1.12), 0.42, 0.2, (0, 0, 0)),
        ((0.58, -0.05, -0.62), (0.8, 0.22, -1.05), 0.34, 0.17, (0, 0, 0)),
        ((0.2, 0.86, 0.5), (0.3, 0.42, 0.98), 0.26, 0.12, (0, 0.05, 0.1)),
        ((0.24, 0.74, 0.6), (0.66, -0.42, 0.42), 0.2, 0.09, (0.14, 0.0, 0.12)),   # 沿眼睛外側、太陽穴垂到下巴的長瀏海
        ((0.62, 0.52, 0.2), (1.24, 0.98, 0.12), 0.4, 0.18, (0, 0, 0)),             # 太陽穴：耳上就往外上方蓬（參考 03 GK）
        ((0.7, 0.24, -0.08), (1.3, 0.6, -0.22), 0.36, 0.16, (0, 0, 0)),
    ])


def trunks_ssj_nape():
    """超賽型後頸往下垂的髮尾（GK 第三輪，參考 04 GK 背面：後腦的髮尾一直蓋到立領）。舊版髮帽下緣在頸後中段就結束，
    和立領之間是一條粗黑的水平描邊（髮帽切面＋外框）加一截頸後皮膚。髮尖收進立領裡（立領上緣約在頭心下 0.7 hr）。"""
    return sym([
        ((0.0, -0.18, -0.92), (0.02, -0.84, -0.86), 0.34, 0.13, (0, 0, -0.08), 0.6),
        ((0.34, -0.14, -0.86), (0.44, -0.78, -0.76), 0.3, 0.12, (0.04, 0, -0.06), 0.6),
        ((0.62, -0.04, -0.66), (0.72, -0.62, -0.58), 0.26, 0.11, (0.05, 0, -0.04), 0.6),
    ])


def trunks_ssj_bangs():
    """超賽型的額前瀏海（參考 03 GK）：從中分處兩側往下蓋住額頭到眉毛，外側一撮蓋住太陽穴；髮尖略鈍。"""
    return sym([
        ((0.12, 0.86, 0.55), (0.4, 0.14, 0.93), 0.3, 0.1, (0.08, 0.1, 0.14), 0.6),
        ((0.38, 0.8, 0.46), (0.7, 0.08, 0.72), 0.3, 0.1, (0.14, 0.1, 0.1), 0.6),
    ])


def trunks_sword(P, brass):
    """劍與鞘（GK 第一輪，參考 03／04 GK、01 立繪、05 SHF）：黑色纏繩握柄、銀色球形柄頭與細十字護手；
    鞘是橘紅色、上段兩圈水藍色環、末端銀色尖頭鞘尾。舊版鞘是棕色長盒（0.94 m）、兩端黃銅蓋，背在身上鞘尾垂到膝蓋。"""
    steel, hilt, sheath = P(0xe3e9f0), P(0x1c1c22), P(0xb8523a)
    silver, ring = P(0xc8ccd4), P(0x6399c5)
    # 劍：握把在原點、刃沿 +y（在 JS 的劍座局部座標）
    # GK 第三輪：握把加長（柄頭到護手 0.224→0.30 m）。04 GK 背面的握把約 1.1～1.2 頭、柄頭只比頭顱頂低約 0.2 頭；
    # 舊版約 0.8 頭，柄頭在眼睛高度，遊戲俯角下劍柄被頭髮和肩膀蓋住。只往柄頭那端加長：護手與鞘的位置不動（跑步時護手不插進頭髮），
    # 手握的位置（劍座原點）也不變
    grip = limb('grip', V((0, -0.178, 0)), V((0, 1, 0)), [(0, 0.016, 0.016), (0.278, 0.018, 0.018)], n=8, cap0='pole', cap1='pole')
    grip = kit.subsurf(grip, 1)
    kit.tag(grip, hilt, ol=0.6)
    pom = kit.quad_sphere('pommel', 0.024, cuts=3)
    kit.transform(pom, Matrix.Translation(V((0, -0.19, 0))))
    kit.tag(pom, silver, mat=2, ol=0.6)
    guard = kit.box_cage('guard', 0.15, 0.018, 0.03, cuts=(1, 1, 1))
    kit.transform(guard, Matrix.Translation(V((0, 0.112, 0))))
    guard = kit.subsurf(guard, 1)
    kit.tag(guard, silver, mat=2, ol=0.6)
    blade = kit.loft('blade', [S(V((0, 0.13, 0)), 0.022, 0.0045, p=1.2), S(V((0, 0.6, 0)), 0.022, 0.0045, p=1.2), S(V((0, 0.9, 0)), 0.021, 0.004, p=1.2), S(V((0, 0.975, 0)), 0.002, 0.001, p=1.2)],
                     n=8, cap0='pole', cap1=None, front=V((0, 0, 1)), side=V((1, 0, 0)))
    kit.split_sharp(blade, 35)
    kit.tag(blade, steel, mat=2, ol=0.5)
    sw = [grip, pom, guard, blade]
    # 鞘：鞘口 0.125 到 0.84，之後是銀色鞘尾（到 0.985）；03 GK 量到護手到鞘尾約 0.85 m
    # GK 第二輪：04 GK 背面的鞘寬約 0.5 頭（10～13 cm），舊版半寬 0.03（寬 6 cm），遊戲俯角下是一根細棍；
    # 鞘尾是比鞘還寬的銀色倒五角形（正面看：上緣平、兩側直、下半收成尖），舊版只是一根細尖刺
    sh = kit.loft('sheath', [S(V((0, 0.125, 0)), 0.05, 0.026, p=3.0), S(V((0, 0.5, 0)), 0.052, 0.027, p=3.0), S(V((0, 0.845, 0)), 0.054, 0.028, p=3.0)],
                  n=16, cap0='pole', cap1='pole', front=V((0, 0, 1)), side=V((1, 0, 0)))
    sh = kit.subsurf(sh, 1)
    kit.tag(sh, sheath, ol=0.7)
    caps = []
    # 水藍色環（帶子的扣環）：比鞘寬一圈
    for y0, y1 in ((0.15, 0.19), (0.34, 0.38)):
        c = kit.loft('ring', [S(V((0, y0, 0)), 0.056, 0.032, p=3.0), S(V((0, (y0 + y1) / 2, 0)), 0.058, 0.033, p=3.0), S(V((0, y1, 0)), 0.056, 0.032, p=3.0)],
                     n=16, cap0=None, cap1=None, front=V((0, 0, 1)), side=V((1, 0, 0)))
        c = kit.subsurf(c, 1, solidify=0.004)
        caps.append(kit.tag(c, ring, ol=0.5))
    # GK 第三輪：鞘尾縮成收尖的套頭（04 GK 只比鞘寬約 1.1～1.25 倍）：最大半寬 0.066→0.057、長度 0.175→0.13，
    # 從套口就開始收；舊版是比鞘寬 1.8 倍的大倒五角形，背面像箭頭，往外伸出前臂輪廓
    tip = kit.loft('chape', [S(V((0, 0.82, 0)), 0.056, 0.03, p=3.0), S(V((0, 0.835, 0)), 0.057, 0.031, p=3.0), S(V((0, 0.875, 0)), 0.05, 0.028, p=2.8),
                             S(V((0, 0.92, 0)), 0.03, 0.019, p=2.4), S(V((0, 0.95, 0)), 0.007, 0.006, p=2.2)],
                   n=16, cap0='pole', cap1='pole', front=V((0, 0, 1)), side=V((1, 0, 0)))
    tip = kit.subsurf(tip, 1)
    caps.append(kit.tag(tip, silver, mat=2, ol=0.6))
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


GI_LAG = 0.04


def piccolo_weights(F, yb):
    """比克的衣物權重（左右共用，依 x 正負選骨頭）。
    肩頭一帶（手臂皮膚、道服袖孔周圍）用同一個依沿臂距離 s 的鎖骨→上臂漸變，舉手時一起動、不會互相穿出
    （GK 第一輪改成無袖道服後已沒有短袖，sleeve_w 留給 G_DELT 群組；腰帶的結與垂帶也拿掉了，models.js 的 sash 擺動鏈骨頭仍保留、沒有幾何綁在上面）；
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
        # GK 第三輪：道服比底下的皮膚晚一點交給上臂（s 往軀幹側挪 GI_LAG）。袖孔邊和三角肌用同一條鎖骨→上臂漸變時，
        # 待機手往前抬（shLX −1.15）袖孔邊整圈跟著上臂轉到前面，道服前襟被拉成一片紫色翻邊蓋在上臂與前臂上（遊戲俯角像包著手臂）
        return [(b, w * (1 - m)) for b, w in old] + [(b, w * m) for b, w in shoulder(s - GI_LAG, sf, c.z)]
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
            rest = [(b, w) for b, w in one_side(old, sf) if b != 'hips']
            tot = sum(w for _, w in rest)
            rest = [(b, w / tot) for b, w in rest] if tot > 1e-6 else [('th' + sf, 1.0)]
            return [('hips', 1 - t)] + [(b, w * t) for b, w in rest]
        fn.blend = True
        return fn

    # 腿只跟自己這一側的腿骨：燈籠褲管鼓得很大，小腿內側的褲管（和底下的皮膚）在代理體裡看得到對側的膝蓋，
    # 骨熱分到對側 knR／thR 約 0.1～0.3，弓步兩腿張開時褲管內壁與皮膚被拉向另一條腿，從兩條褲管之間拉出綠色碎片
    def one_side(ws, sf):
        other = 'R' if sf == 'L' else 'L'
        out = [(b, w) for b, w in ws if not (b[:2] in ('th', 'kn', 'an', 'to') and b[2:] == other)]
        return out or ws

    def real(co, old):
        if co.y > F.L - 0.05 or abs(co.x) < 0.02:
            return old
        return one_side(old, 'L' if co.x > 0 else 'R')
    real.blend = True

    def shoe(co):
        _, sf = side(co)
        ay = F.b['an' + sf][0].y
        tz = F.b['to' + sf][0].z
        k = smooth((ay + 0.045 - co.y) / 0.06)
        t = smooth((co.z - (tz - 0.03)) / 0.06) * k
        return [('kn' + sf, 1 - k), ('an' + sf, k - t), ('to' + sf, t)]

    return {heroes.G_ARM_L: arm, heroes.G_ARM_R: arm, G_UPPER_L: arm, heroes.G_UPPER_R: arm,
            heroes.G_DELT_L: sleeve_w, heroes.G_DELT_R: sleeve_w, G_TORSO: torso, G_PIC_SHOE: shoe,
            G_PELVIS: pants, G_PIC_HEM: hem, G_LEG_L: leg('L'), heroes.G_LEG_R: leg('R'), realbody.G_REAL: real}


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


def pic_tube(name, F, pal, grp, rows, n=18, cap_len=0.006):
    """沿大腿骨方向放樣的管（褲管、鞋筒）：rows＝[(s, a, b, mod)]，兩端是很短的平封口（cap_len）。"""
    sts = [S(F.th + F.dl * r[0], r[1], r[2], mod=r[3] if len(r) > 3 else None) for r in rows]
    o = kit.loft(name, sts, n=n, cap_len=cap_len)
    o = kit.subsurf(o, 1)
    return kit.tag(o, pal, grp=grp)


def piccolo_armhole(ob, F, r, top=0.42, back=1.0, s0=0.0, s1=0.3, low=1.0):
    """比克道服的袖孔：離上臂骨軸 r 以內挖掉，但朝外上方（A 字綁定姿勢下垂直骨軸、在 xy 平面內朝外上，垂手時是肩頂）
    的距離先除以 top，孔在肩頂只開 r×top 深，紫色的肩口留在肩頂上；腋下那側照原本的圓孔。
    back＞1：骨軸後方（−z）的距離先除以 back，孔在背面開得大一點，孔緣落在三角肌後緣以內的背上（參考 02 背面）。
    low＞1：朝內下方（腋下）的距離先除以 low，腋下開得深一點。"""
    up = V((-F.da.y, F.da.x, 0)).normalized()
    if up.y < 0:
        up = -up

    def f(co):
        p = V((abs(co.x), co.y, co.z))
        s = max(s0, min(s1, (p - F.sh).dot(F.da)))
        q = p - F.arm_pt(s)
        qu = q.dot(up)
        q2 = q - up * qu
        qb = min(q2.z, 0.0)
        return math.sqrt(q2.length_squared - qb * qb + (qb / back) ** 2 + (max(qu, 0.0) / top) ** 2 + (min(qu, 0.0) / low) ** 2) - r
    kit.iso_cut(ob, f)
    kit.cut(ob, lambda co, n: f(co) < 0)
    return f


def piccolo_boot(F, pal, pal_sole, top_s, splay=0.16):
    """比克的尖頭鞋（參考 02 正側背）：鞋筒包住腳踝、鞋口外翻一圈（寬約 0.7 頭），腳掌長約 1.25 頭，
    鞋頭往前收成細尖、最後 5 cm 往上翹；整隻腳以腳踝為軸往外轉 splay 弧度（正面看腳尖往外張）。
    共用的 boot() 鞋頭是圓鈍的一團、鞋底平直（側面像樂福鞋），所以另外寫一份。回傳 [筒, 腳]。"""
    sole_s = F.tl + F.sl
    # 鞋口用平封口：pole 封口會往上凸出 3 cm、伸進褲口裡
    shaft = pic_tube('bootL', F, pal, G_FOOT_L, [
        (top_s - 0.012, 0.094, 0.098),
        (top_s + 0.006, 0.104, 0.108),     # 外翻的鞋口
        (top_s + 0.028, 0.096, 0.1),
        (top_s + 0.05, 0.08, 0.086),
        (sole_s - 0.09, 0.072, 0.08),
        (sole_s - 0.035, 0.07, 0.084),
    ], n=16)
    ax = F.b['anL'][0]
    fx = F.sole.x + 0.004
    # (z, 中心高, 半寬, 半高)：腳跟→腳背→腳尖，最後兩站縮成細尖並往上翹
    st = [(-0.088, 0.062, 0.05, 0.056), (-0.035, 0.07, 0.066, 0.07), (0.045, 0.062, 0.068, 0.06), (0.125, 0.048, 0.06, 0.046),
          (0.19, 0.04, 0.046, 0.034), (0.235, 0.044, 0.03, 0.024), (0.268, 0.058, 0.016, 0.013), (0.284, 0.072, 0.006, 0.005)]
    foot = kit.loft('foot', [S(V((fx, y, z)), a, b, p=2.4) for z, y, a, b in st], n=14, front=V((0, 1, 0)), side=V((1, 0, 0)))
    ca, sa = math.cos(splay), math.sin(splay)

    def turn(p):
        # 腳尖往外（+x）轉；腳底壓平在地上（上翹的鞋尖不壓）
        q = V((p.x - ax.x, p.y, p.z - ax.z))
        r = V((ax.x + q.x * ca + q.z * sa, p.y, ax.z - q.x * sa + q.z * ca))
        if p.z < 0.22:
            r.y = max(r.y, 0.012)
        return r
    kit.deform(foot, turn)
    foot = kit.subsurf(foot, 1)
    kit.tag(foot, pal, grp=G_FOOT_L)
    kit.paint_field(foot, lambda co: co.y - 0.02, pal_sole, 0)
    return [shaft, foot]


def build_piccolo(R):
    F = Fig(R)
    P = kit.Palette()
    gskin, pink = P(0x66b83e), P(0xf0a0a8)
    gi = P(0x5d3a94)
    sash = P(0x5fb8e8)
    shoe, shoeD = P(0xc8783a), P(0x6e4428)   # 參考 02：亮棕橘色鞋、深棕鞋底（舊版主色用了陰影色 0x6e4428）
    # 腕環：參考 02／03 是偏暗的紅棕色（#b3322e）。著色器會把固有色的彩度再拉高 1.28 倍，0xb3322e 渲染出來是 (217,0,9) 的純紅，
    # 所以給一個彩度低一點的紅棕，渲染後才落在參考的紅棕；環與環之間的凹槽用深棕色（wristD）
    wrist, wristD = P(0x9a4a40), P(0x4a1e18)
    team = P(-1)
    body, proxy = [], []

    # GK 第二輪：胸廓前後加厚（參考 02 側面胸廓含道服厚約 1.5 頭，舊版 1.25 頭、側面太扁）。只加厚腰帶以上（deep_rows），
    # 不改 PROPS 的 chest 深：試過 0.1658→0.185，骨盆一帶連帶變厚，骨熱分不到 hips 主導的頂點而整體退回膠囊距離權重
    def deep_rows(rows, k=1.14):
        return [(u, a, fb * (1 + (k - 1) * smooth((u - 0.42) / 0.16)), fz * (1 + (k - 1) * smooth((u - 0.42) / 0.16))) for u, a, fb, fz in rows]
    chest = kit.loft('chest', torso_rows(F, e=0.0, u0=0.3, pec=0.144, rows=deep_rows(TORSO_ROWS)), n=18, cap0=None, cap1=None)
    chest = kit.subsurf(chest, 2)
    # 軀幹皮膚的外框調細（1.0→0.4）：軀幹幾乎整片在道服底下，只從 V 領露出正面（不是輪廓線，用不到外框）。
    # 待機上身前傾、手往前抬時道服和底下的皮膚權重不同，皮膚貼近道服內壁，皮膚的反向外框殼（比皮膚面再外撐約 1 cm）
    # 從道服的前襟與腋下穿出來，遊戲俯角是 V 領左側一塊黑三角、腋下一塊黑斑（關掉外框就沒有）
    kit.tag(chest, gskin, grp=G_TORSO, mat=4, ol=0.4)
    body.append(realbody.skin(chest))
    proxy.append(chest)
    # GK 第一輪（參考 02 SHF 正側背三視圖）：
    #   腰帶在自然腰（下巴下 1.73 頭、總高 62%），舊版放在髖骨（L＋0.09，總高 57%），上身短、腰帶下的道服衣襬垂到胯下，
    #   正面像一片圍裙；道服上衣其實塞進腰帶，腰帶下面直接是褲頭（pelvis 往上包到腰帶）。衣襬只留到剛過腰帶下緣。
    #   V 領只開到胸肌上半（V 底在下巴下約 0.75 頭，見下方 V_GAP），領口兩側開到斜方肌外緣。
    yb = F.L + 0.19   # 腰帶中心
    u_hem = (yb - 0.075 - F.yT) / F.T
    yu = (yb - F.yT) / F.T
    # 領口在後頸多爬一列（參考 02 背面：道服領口緊貼頭底下，斜方肌在衣服底下一路鼓到脖子）
    # GK 第二輪：肩頂到頸根的幾列加寬（0.96：0.84→1.0、1.02：0.58→0.76），道服的肩口往外蓋過三角肌頂（參考 02 正背面：紫色肩口蓋住
    # 肩頂與斜方肌外側，粉紅只從肩頂外緣往下露在上臂外側）；共用的 TORSO_ROWS 從肩頭往脖子斜得很快，三角肌頂整個露在道服外面。
    # 領口不再豎起：舊版最上一列（1.12，半寬 0.3 cx）比脖子只寬 1 cm，在頸側圍成一圈厚立領；改成停在頸根、比脖子寬 3 cm 的平領
    # 0.85 是補的一列（0.8 與 0.9 之間），V 底落在 0.8 列（細縫），V 的下半段多一列可以照直線加寬
    rows = ([(u_hem, ('w', 1.16), 0.84, 0.02), (yu, ('w', 1.24), 0.8, 0.02)] + [r for r in TORSO_ROWS if yu + 0.06 < r[0] < 0.9]
            + [(0.9, ('c', 1.04), 0.84, -0.02), (0.96, ('c', 1.0), 0.72, -0.04), (1.02, ('c', 0.76), 0.58, -0.04), (1.07, ('c', 0.46), 0.47, -0.03)])
    # 補列用三次 Hermite（切線取前後列的斜率，Catmull-Rom）而且只補一列：0.8 列上下的 z 斜率差很多（肩背在這裡開始往後斜），
    # loft 斷面的傾角跟著從 5° 跳到 13°，斷面背面的點往下掉 b·sinθ。曾補 0.81／0.82／0.84 三列密列，背面中線上相鄰兩列的點掉到同高、
    # 中間那列還凸出 6 mm（實測背中線 y 1.600／1.603、z −0.183／−0.189），細分後是一道摺痕，反向外框殼從摺痕露出來、背上一條橫黑線；
    # 只補 0.85 一列時背中線 1.598 → 1.609 → 1.651 單調往上
    def herm_row(u, r0, r1, r2, r3):
        h, t = r2[0] - r1[0], (u - r1[0]) / (r2[0] - r1[0])
        h00, h10, h01, h11 = 1 - 3 * t * t + 2 * t ** 3, t - 2 * t * t + t ** 3, 3 * t * t - 2 * t ** 3, t ** 3 - t * t
        def f(g):
            m1 = (g(r2) - g(r0)) / (r2[0] - r0[0])
            m2 = (g(r3) - g(r1)) / (r3[0] - r1[0])
            return h00 * g(r1) + h10 * h * m1 + h01 * g(r2) + h11 * h * m2
        return (u, ('c', f(lambda q: q[1][1])), f(lambda q: q[2]), f(lambda q: q[3]))
    ri = {r[0]: r for r in rows}
    rows = sorted(rows + [herm_row(u, ri[0.67], ri[0.8], ri[0.9], ri[0.96]) for u in (0.85,)], key=lambda r: r[0])
    us = [r[0] for r in rows]
    # V 領每一列的開口半角（弧度）。V 字的底要落在某一列上、而且那一列的開口幾乎是 0，否則開口在兩列之間一次跳開，V 底是一條水平的 U 字。
    # GK 第三輪：參考 02 的 V 底在下巴下 0.70 頭、V 高約 0.54 頭、頂端半寬約 0.59 頭（開到肩帶內緣），V 的兩邊是直線。
    # 舊版開口從 u 0.66 起照 3.0×(u−0.66) 線性加寬，V 底量到下巴下 1.19 頭、離腰帶上緣只剩 0.48 頭（參考約 1.0 頭），胸前紫色少了一半。
    # 注意 loft 的斷面框架：各列中心的 z 往上漸漸後退（肩背斜），斷面的「前方」跟著往上傾，每一列最前面的點比列高 y 高出 3～4 cm，
    # 實測 V 底（細分之後）：開口最低一列放在 0.84 時 1.685 m、0.82 時 1.658 m（下巴下 0.63 頭）、0.8 時 1.607 m（0.8 頭），
    # 所以 0.8 列只開一道細縫（0.008）、0.85 列再加寬，量到 1.628 m（下巴下 0.73 頭，參考 0.70）。
    # 上面各列的半角照「半寬隨高度線性增加（V 底 0 → 下巴下 0.2 頭處 0.59 頭）」換算（斷面是 p＝2.3 的超橢圓、每一列的寬不同，所以不是等差）
    V_GAP = {0.8: 0.008, 0.85: 0.12, 0.9: 0.22, 0.96: 0.32, 1.02: 0.56, 1.07: 1.25}
    # pec 0.09→0.13：參考 02 側面胸厚約 1.2 頭（含道服），頭放大後量到只有 0.9～1.0 頭
    top = kit.loft('gi_top', torso_rows(F, e=0.018, rows=deep_rows(rows), pec=0.13, lat=0.108), n=20, cap0=None, cap1=None,
                   gap=lambda i: V_GAP.get(us[i], 0.0))
    # 無袖道服（參考 02 肩部特寫）：袖孔開在肩關節，整顆粉紅三角肌露在道服外面，道服只在肩頂留一條寬肩帶。
    # 舊版道服軀幹一路包到肩關節外，再套一截短袖筒蓋住三角肌，正面看是兩塊往上翹的方形肩章、粉紅只剩肩下一條。
    # 先細分一次、在加厚之前挖袖孔（孔緣平滑），再加厚
    top = kit.subsurf(top, 1)
    # GK 第二輪：袖孔的上半部壓淺（piccolo_armhole）。圓的袖孔（離骨軸 8.8 cm）把肩頂整個挖掉，道服在肩上只剩一條窄肩帶，
    # 整顆粉紅三角肌連肩頂都露出來，遊戲俯角看是兩顆粉紅肩章；參考 02 正背面是紫色肩口蓋住肩頂與斜方肌外側，
    # 粉紅從肩頂外緣往下露在上臂外側
    # GK 第三輪：腋下開深一點（low 1.3，參考 02 正面袖孔下緣約在胸口中段）。待機手往前抬時，腋下前方那一截道服夾在上臂與胸口之間，
    # 被擠成一團往外翻的紫色皺褶（遊戲俯角看是包在上臂內側的一片翻邊，上面一排黑點）
    hole = piccolo_armhole(top, F, 0.088, top=0.42, back=1.2, low=1.3)
    # 袖孔邊緣 3 cm 內的道服往外掀起最多 1 cm（無袖上衣的袖口滾邊）：孔緣正好落在三角肌後緣的隆起上，
    # 道服照軀幹的弧度走、比三角肌低，孔緣外側沒被蓋住的底模皮膚（不會被收進道服）從孔緣冒出粉紅尖片與外框黑塊
    def lift(co):
        k = 0.01 * smooth((0.03 - hole(co)) / 0.03) * smooth((co.y - yb - 0.1) / 0.08)
        d = V((co.x, 0.0, co.z - F.cz * 0.05))
        return co + d.normalized() * k if d.length > 1e-6 else co
    kit.deform(top, lift)
    # 領口（V 領與後領那一圈開口邊）的頂點，加厚之後用來把開口邊的外框調細
    bm = bmesh.new()
    bm.from_mesh(top.data)
    neck_pts = [V(v.co) for e in bm.edges if e.is_boundary for v in e.verts if v.co.y > yb + 0.15 and hole(V(v.co)) > 0.01]
    bm.free()
    top = kit.subsurf(top, 0, solidify=0.012)
    kit.tag(top, gi, grp=G_TORSO)
    # GK 第三輪：V 領開口邊的外框調細（1.0→0.3）。底下的皮膚收在道服內 1 cm（conform_gap），道服又有 1.2 cm 厚，
    # 開口邊的反向外框殼往內撐出來蓋在凹下去的胸口上，V 字下半段窄的地方整條被塗黑（正交正面看是一道黑縫、V 底一個黑色缺口）。
    # 待機上身扭轉前傾時，靠脖子的前襟翻起、從側面看到開口邊，整圈外框殼撐出開口邊外，V 領左側是一塊黑三角。
    # 參考 02 的領口只有紫綠交界、沒有描線；留一條細線和其他部位的描邊一致
    if neck_pts:
        nkd = KDTree(len(neck_pts))
        for i, q in enumerate(neck_pts):
            nkd.insert(q, i)
        nkd.balance()
        kit.paint_ol(top, lambda co: 1.0 - 0.7 * (1 - smooth((nkd.find(co)[2] - 0.006) / 0.03)))
    # 道服內壁（法線朝軀幹中心）不描外框（同 realbody.hug_fit 對環帶的做法）：內壁的反向殼往身體裡撐，平常看不到；
    # 但待機上身前傾、手往前抬時，前襟和袖孔下緣離開胸口，從縫隙看進去是內壁的黑色外框殼（遊戲俯角下 V 領左側一塊黑三角、腋下一塊黑斑）。
    # 拿掉之後縫隙裡看到的是道服內側的紫色
    me = top.data
    OL = me.attributes['ol'].data
    for v in me.vertices:
        d = V((v.co.x, 0.0, v.co.z))
        if V(v.normal).dot(d) < 0:
            OL[v.index].value = 0.0
    set_grp(top, lambda co: co.y < yb, G_PIC_HEM)
    # 道服底下的皮膚收得比預設 3 mm 深（同香吉士的外套）：道服用程序權重（piccolo_weights）、底下的皮膚是底模＋骨熱的混合，
    # 交叉雙臂（待機）時肩口與胸側的皮膚被拉出道服 5～8 mm，遊戲鏡頭下肩口一塊塊綠色與粉紅從紫色裡冒出來
    top['conform_gap'] = 0.01
    body.append(top)
    proxy.append(top)
    # 脖子粗、直接接到很厚的斜方肌（參考 02：頸寬約 0.6 頭＝0.17 m，舊版 r 0.07 量到 0.126 m）；realbody 照這個半徑縮放底模的脖子
    body.append(neck(F, gskin, r=0.085))
    proxy.append(body[-1])
    # 手臂：粉紅肌肉紋、紅護腕
    arm = arm_skin(F, gskin, muscle=1.35, k=1.15)

    side = V((0, 0, 1)).cross(F.da).normalized()

    # 粉紅肌肉紋（參考 SHF 02 正側背三視圖、03 T 字）：
    #   上臂：整顆三角肌是粉紅的圓帽，從道服袖孔一路包到上臂約 45%，正面、側面、背面都看得到，只有腋下內側是綠的；
    #         下緣在外側最低、往前後兩側慢慢升高
    #   前臂：外側（手背那一側）一大塊橢圓，從手肘下方到前臂約 2/3，不碰紅護腕
    #   原作兩塊上都有橫向的肌肉細紋：試過用深一階的粉紅細線，底模的面約 2 cm、比線寬大得多，切線只在頂點取樣，
    #   畫出來是一片片三角形碎斑，所以不畫（遊戲鏡頭下也看不到）
    # 以手臂局部的 s（沿骨距離）與繞軸角度 phi 判斷：phi=0 是手臂外側（side，朝外上），+π/2 是正面，±π 是腋下內側
    # 換成真人身體後這兩塊由 realbody.paint() 在底模上重新切線上色（逐頂點投影會因為頂點太稀被併掉）
    # 上臂那塊往上包到肩關節內 8 cm（整顆三角肌到道服肩口都是粉紅，參考 FighterZ 立繪交叉雙臂時肩口下就是粉紅）：
    # 原本從肩下 3 cm 才開始，待機交叉雙臂時肩頭從道服肩口轉出來，露出的是粉紅上方一圈綠色肩頂，和粉紅交錯成一塊塊碎斑
    # GK 第一輪：道服改成無袖、整顆三角肌露出來，上臂那塊的 phi 往後加寬（−0.1±2.6）：原本只到 −1.7（肩頂附近），
    # 三角肌後側到袖孔之間留一條直的綠帶（參考 02 背面整顆三角肌都是粉紅，只有腋下是綠的）
    # GK 第三輪：上臂那塊往下延到肩下約 23 cm（舊版 18 cm，參考 01 FighterZ 與 02 正面，粉紅一路到上臂下段、離手肘約 5 cm）
    PATCH = ((0.075, 0.155, -0.1, 2.6), (F.up + 0.11, 0.09, 0.15, 1.45))   # (s 中心, s 半長, phi 中心, phi 半寬)

    def arm_local(co):
        s = arm_s(F, co)
        r = co - F.arm_pt(s)
        return s, r.length, math.atan2(r.dot(V((0, 0, 1))), r.dot(side))

    def patch_f(co):
        s, rr, phi = arm_local(co)
        es = [((s - s0) / ls) ** 2 + ((phi - p0) / lp) ** 2 - 1 for s0, ls, p0, lp in PATCH]
        # 肩頂（s＜0）的骨軸延長線會伸進斜方肌與脖子：上臂那塊再限制在肩關節內側 9 cm 以外（|x| 的鉛直切面，道服肩帶以內都蓋住了），
        # 粉紅不會塗到頸側。舊版用底模上臂權重＞0.22 的場，權重在三角肌後側一塊塊跳，換成無袖道服、整顆三角肌露出來之後，
        # 背面的粉紅邊緣碎成鋸齒；切面放在 4.5 cm 時三角肌後側到袖孔之間留一條直的綠帶
        # 離手臂骨軸太遠（軀幹、腋下另一側）一律不塗；用 max 接起來，場保持連續，切線才不會沿著截斷處鋸齒。
        # 三角肌那塊放寬到 13.5 cm：底模三角肌後側到袖孔邊緣離骨軸 11～13 cm，舊版 11 cm 在那裡切出一排綠色方塊
        e = min(max(es[0], (F.sh.x - 0.09 - abs(co.x)) / 0.01, (rr - 0.135) / 0.01), max(es[1], (rr - 0.11) / 0.01))
        return e
    # 肌肉塊的橫紋與紅褐邊框（參考 02／03）第三輪又試了一次：沿手臂每 3.4 cm 一道寬條紋＋場值 −0.07～0 的邊框。
    # 不細分時底模的面約 2 cm，條紋切成一片片三角形碎斑（比沒有更糟）；切線前細分一次（paint 的 refine）則整個建模跑超過 9 分鐘沒結束。
    # 所以仍然只有單色的粉紅塊，質感留給之後用法線或遮蔽處理
    realbody.paint(arm, F, patch_f, pink, 4)
    # 上臂靠腋下那一半（肩下 16 cm 內、朝身體的一側）外框調細（1.0→0.45）：待機手往前抬時上臂內側壓進道服的腋下，
    # 手臂皮膚的反向外框殼從道服前面穿出來，遊戲俯角腋下一塊黑斑（道服外框全關掉也還在，是手臂的殼）
    kit.paint_ol(arm, lambda co: 1.0 - 0.55 * smooth((0.16 - arm_s(F, co)) / 0.04) * smooth(-(co - F.arm_pt(arm_s(F, co))).dot(side) / 0.02))
    # 三角肌後側與上緣的底模頂點，顏色是從軀幹皮膚（chest）投影來的（骨軸射線先碰到軀幹），只畫在 arm 上的話那幾塊留成綠色，
    # 無袖道服露出整顆三角肌之後背面是一塊塊綠斑：軀幹也套同一個場（左右對稱）
    realbody.paint(chest, F, lambda co: patch_f(V((abs(co.x), co.y, co.z))), pink, 4)
    # 紅護腕（參考 SHF 03）：只是手腕上一圈窄帶，高約半個手掌、貼著手腕；舊版從前臂中段套到腕（約 0.1 m）、口比手掌寬，
    # 出拳施法時從正面看像一截空心筒子。改成貼合斷面的 fit_band，綁骨群組和手臂皮膚相同（G_ARM_L），彎腕、旋前時一起變形
    se = F.up + F.lo - 0.004
    # 第二版：真人底模的前臂整段用同一個徑向縮放，到手腕還和前臂中段一樣粗（半徑約 6 cm），比手掌厚；護腕貼著它再外擴 8 mm，
    # 出拳時從正面看就是一圈比拳頭寬的紅環。改成往手的方向收窄：上緣只離皮膚 2 mm，下緣比原本的手腕表面小 6 mm，
    # conform 會把底下的皮膚收進護腕內壁，等於把手腕收細、接到手掌，紅環的口徑落在前臂與拳頭之間；殼與外框也減薄
    wb = fit_band(F, arm, 'wristL', [(se - 0.05, 0, 0, 0.002), (se - 0.04, 0, 0, 0.004), (se - 0.03, 0, 0, -0.002), (se - 0.02, 0, 0, 0.002),
                                      (se - 0.01, 0, 0, -0.002), (se, 0, 0, -0.006)],
                  wrist, G_ARM_L, thick=0.006, ol=0.4)
    # 參考 02／03 的紅腕環是 3 圈細環疊在一起。第二輪在斷面上壓 2～4 mm 的凹槽，但換真人身體時 realbody.hug_fit 把環帶每一圈的內壁
    # 都重新貼到真人手腕外 1.5 mm、外壁＝內壁＋固定厚度，斷面上的起伏整個被抹平，正交圖與遊戲鏡頭下都是一整條厚袖口。
    # 改成在環上切出兩道深棕色的細縫（沿骨距離 ±2.5 mm），分成三圈；顏色交界由 paint_field 沿等值線切開，不受 hug_fit 影響
    grooves = (se - 0.034, se - 0.018)
    kit.paint_field(wb, lambda co: min(abs(arm_s(F, V((abs(co.x), co.y, co.z))) - g) for g in grooves) - 0.0025, wristD, 0)
    hand = fist(F, gskin, scale=1.12)
    # 褲頭往上包到腰帶底下（道服上衣塞進腰帶，腰帶下面就是褲子）
    body.append(pelvis(F, gi, e=0.014, top_u=(yb - F.yT) / F.T))
    proxy.append(body[-1])
    # 只給骨熱用的衣襬殼（不出現在成品裡）：腰帶上移、腰帶下的衣襬拿掉之後，代理體在骨盆骨一帶只剩褲頭一層，
    # 骨熱分不到任何 hips 主導的頂點，整體判定失敗而退回膠囊距離權重（左腿內側的皮膚分到右膝，弓步時褲管間拉出綠色碎片）。
    # 舊版的長衣襬（u −0.2～0.21）在代理體裡正好提供這一層，照原樣留給骨熱用；實心的骨盆塊試過沒有用
    hp_ = kit.loft('hem_proxy', torso_rows(F, e=0.018, rows=[(-0.2, ('w', 1.3), 1.0, 0.02), (-0.08, ('w', 1.2), 0.9, 0.01), (0.06, ('w', 1.1), 0.81, 0.0), (0.21, ('w', 1.13), 0.82, 0.02)]),
                   n=20, cap0=None, cap1=None)
    proxy.append(kit.tag(kit.subsurf(hp_, 2, solidify=0.012), gi, grp=G_PIC_HEM))
    # 燈籠褲（GK 第二輪，參考 02 正側背）：每條褲管寬約 1.15 頭（0.34 m）、前後厚約 1.2 頭，從大腿到小腿下段都很蓬，
    # 膝前鼓起一圈，到腳踝上方約 0.35 m 才急收成窄口塞進鞋口，窄口和鞋口之間露出一小截綠色腳踝。
    # 褲管斷面左右不對稱：內側（θ＝π，朝另一條腿）收 30% 左右、外側往外鼓。舊版斷面是正圓、半寬 0.175 m，
    # 髖關節又只在 x＝0.074，內側越過中線 10 cm，兩條褲管從胯下黏到膝下（正面看是一整根筒子）。
    # 現在髖關節 x＝0.105（PROPS hip），內側在胯下剛好碰到中線，往下逐漸分開成倒 V 縫（stand 姿勢膝蓋處縫寬約 0.1 m）。
    # 斷面半徑直接用公尺（只給比克用，不跟 k_leg 縮放）
    s_end = 0.77                                         # 褲口（離地約 0.33 m）
    top_s = 0.81                                         # 鞋口（離地約 0.3 m，鞋高約 1.0 頭）；中間露出約 3 cm 的綠色腳踝

    def pmod(o=0.0, f=0.0, bk=0.0, i=0.0):
        return lambda th: (1 + o * ang_bump(th, 0, 1.4) + f * ang_bump(th, FRONT, 1.2) + bk * ang_bump(th, BACK, 1.2)
                           - i * ang_bump(th, PI, 1.35))
    # 兩端用很短的平封口（loft 預設的 pole 封口會沿軸再凸出 0.35 r，褲口那端凸出 2 cm、正好蓋住露出來的腳踝）
    leg = pic_tube('legL', F, gi, G_LEG_L, [
        (-0.07, 0.13, 0.13),
        (0.04, 0.155, 0.17, pmod(o=0.05, bk=0.12, i=0.3)),           # 臀部往後鼓（參考 02 側面）
        (0.16, 0.168, 0.18, pmod(o=0.08, f=0.05, bk=0.12, i=0.32)),
        (0.32, 0.168, 0.178, pmod(o=0.1, f=0.1, i=0.33)),
        (F.tl - 0.02, 0.162, 0.18, pmod(o=0.1, f=0.24, i=0.3)),      # 膝前鼓起（側面前緣不是一條直線）
        (F.tl + 0.1, 0.166, 0.178, pmod(o=0.12, f=0.1, bk=0.1, i=0.3)),
        (F.tl + 0.19, 0.15, 0.162, pmod(o=0.12, f=0.05, bk=0.08, i=0.28)),
        (s_end - 0.045, 0.118, 0.12, pmod(o=0.08, i=0.12)),           # 褲腳堆在褲口上方的一圈皺褶
        (s_end - 0.014, 0.074, 0.078),
        (s_end, 0.062, 0.066),
    ])
    # 鞋（參考 02 正側）：亮棕橘色、鞋高約 0.95 頭、鞋口外翻成寬口，鞋頭細長、尖而上翹，正面看兩腳腳尖往外張
    shoe_ = piccolo_boot(F, shoe, shoeD, top_s)
    # 褲口與鞋口之間露出的綠色腳踝（參考 02 約 0.1 頭）：腿沒有皮膚部件時，底模的腳踝被褲管、鞋筒判定為蓋住而整圈刪掉，
    # 中間只剩一圈外框殼的黑縫。放一小截皮膚部件，底模在它附近 3.5 cm 內的頂點留著，顏色也從這裡投影成綠色
    ank = kit.tag(pic_tube('ankleL', F, gskin, G_LEG_L, [(s_end - 0.05, 0.056, 0.058), (top_s + 0.03, 0.05, 0.054)], n=12), gskin, grp=G_LEG_L, mat=4)
    realbody.skin(ank)
    for o in shoe_:
        set_grp(o, lambda co: True, G_PIC_SHOE)
    pair_add(body, proxy, [arm, wb, hand, leg, ank] + shoe_, proxy_set=[arm, hand, leg] + shoe_)
    body.append(hug_band(F, arm, 0.155, 0.18, team, G_UPPER_L))
    # 天藍寬腰帶（參考 02／01）：在自然腰繞一圈、高約 0.37 頭，沒有結也沒有垂下的帶尾（舊版左前方的結與兩片垂帶，
    # 遊戲鏡頭下是一團藍色）。寬約 1.22 頭（0.36 m），比道服的胸口窄很多，上衣在腰帶上方鼓出一圈
    # 腰帶處的道服收成 w×1.24（上一列 rows），腰帶只比它寬 2.6 cm
    # GK 第三輪：前後深 +8 mm。道服在腰帶上緣往後鼓（背闊肌 lat），背面正中間的道服比腰帶上緣外凸幾公釐，
    # 背面看腰帶上緣被紫色蓋掉一段、兩端各一個缺角
    body.append(belt_ring(F, yb, 0.11, sash, thick=0.016, a=F.w * 1.24 + 0.044, b=F.cz * 0.8 + 0.052))

    # 頭：光頭、尖耳、觸角
    # 額頭不再加隆起：舊版每邊兩條小管（extra）接到底模額頭上，各自帶外框殼，正面與遊戲俯角看是額頭上四道黑色鉤紋；
    # 參考 02 的額頭只有眉骨的起伏（brow）
    # GK 第三輪（參考 02 正側頭部特寫）：眼睛在頭頂下 0.63～0.67 頭（FighterZ 0.62），眼睛到下巴只有 0.33～0.38 頭；
    # 舊版 cranium 高 0.95、face_len 1.0，眼睛在頭頂下 0.56 頭、眼到下巴 0.44 頭，顱頂短、下半臉長。
    # 頭顱總高不變（1.66 hr，頭身比照舊），顱頂加高（ky 0.95→1.08）、下半臉縮短（face_len 1.0→0.82），眼睛落在頭頂下約 0.63 頭。
    # 顱頂飽滿的蛋形（egg）：底模的頭兩側近乎垂直，正面看是直筒；參考 02 正面最寬在太陽穴上方、往頭頂圓收。
    # 後腦往後鼓（occ）：參考 02 側面後腦勺懸在脖子後方一大塊。
    c, hr = F.c, F.hr
    h = anime_head('head_base', F, gskin, pointed_ears=True, ear_scale=1.25, jaw=1.0, brow=1.0, cranium=(0.82, 1.08, 0.9), face_len=0.82,
                   egg=0.7, occ=0.3)
    # 嘴的一圈外框調細（底模的頭顏色與外框倍率從這顆動畫頭顱投影過去）：底模的上下唇之間有一道凹縫，
    # 鏡頭一拉遠（外框隨距離變粗）凹縫的外框殼從兩個嘴角冒出來，正交與遊戲鏡頭下像咬著牙露出兩顆尖牙。參考 02 是閉著的一條細線
    kit.paint_ol(h, lambda co: 0.12 if (co - (c + V((0, -0.42 * hr, 0.72 * hr)))).length < 0.3 * hr else None)
    parts = [h]
    # 觸角（GK 第三輪，參考 02 正側頭部特寫）：從眉上約 0.4 hr、離中線約 0.3 hr 的額頭長出，往外、往前、略往上拱，末端往下垂；
    # 正面看是兩道往外張的弧、尖端張到耳朵內側（離中線約 0.78 hr），側面看是往前平伸出額頭約 0.5 hr 的細桿、尖端微微下勾。
    # 第二輪的觸角往上再往前捲（尖端離中線只有 ±0.36 hr、末端朝前對著鏡頭），加上圓頭與外框，
    # 正交正面像額頭上一個黑色的「♈」紋，遊戲俯角下兩顆圓頭剛好落在眼睛上方、像第二雙眼睛；圓頭拿掉，尖端照放樣的圓封口收尖
    for sx in (1, -1):
        # 第一點埋在額頭裡（底模的額頭在這個高度離頭心約 0.55～0.6 hr）
        pts = [c + V((sx * x * hr, y * hr, z * hr)) for x, y, z in (
            (0.24, 0.36, 0.36), (0.36, 0.46, 0.68), (0.48, 0.55, 0.86), (0.62, 0.6, 0.99), (0.75, 0.59, 1.09), (0.85, 0.53, 1.15), (0.9, 0.44, 1.17))]
        an = path_loft('ant', pts, [r * hr for r in (0.05, 0.042, 0.036, 0.032, 0.029, 0.026, 0.022)], n=6)
        an = kit.subsurf(an, 1)
        parts.append(kit.tag(an, gskin, mat=4, ol=0.5))
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
    kneecap = lambda th: 1 + 0.12 * ang_bump(th, FRONT, 0.9)   # 膝蓋骨往前凸
    leg = limb('legL', F.th, F.dl, [(-0.07, 0.115 * kl, 0.115 * kl), (0.05, 0.122 * kl, 0.126 * kl, quad), (0.22, 0.104 * kl, 0.108 * kl, quad), (F.tl - 0.03, 0.076 * kl, 0.08 * kl, kneecap),
                                    (F.tl + 0.06, 0.087 * kl, 0.092 * kl, calf), (F.tl + 0.17, 0.084 * kl, 0.087 * kl, calf), (F.tl + 0.3, 0.078 * kl, 0.08 * kl),
                                    (F.tl + F.sl - 0.08, 0.056 * kl, 0.06 * kl), (F.tl + F.sl - 0.03, 0.052 * kl, 0.062 * kl)], n=12)
    # GK 第一輪：小腿上段加粗（參考 02／04 膝下到小腿肚約 0.4～0.45 頭寬，舊版 0.3；realbody 量到小腿只有底模的 0.73 倍）；腳踝維持細
    # GK 第三輪：正交正面量得小腿從膝（3.46 頭，寬 0.44 頭）一路收細到 4.1 頭只剩 0.29 頭，紫色長條像貼在細管上的膠囊。
    # 參考 02／04 的小腿是靴筒狀：膝下到約 4.3 頭維持 0.4 頭左右再收到腳踝；膝蓋前面加一點髕骨的凸起
    leg = kit.subsurf(leg, 2)
    # 前臂比上臂粗（參考 02／04；realbody 的 FORE_FIT_HERO 同步放寬前臂輪廓）。
    # GK 第三輪：舊版 muscle 1.1／k 1.08／k_fore 1.3 量得上臂中段 0.34 頭、前臂 0.40 頭，比參考（0.28／0.35）粗約兩成，三角肌臃腫；
    # 兩段各收約 15%（上臂 ×0.82、前臂 ×0.875），肌肉起伏也收小，保留「前臂比上臂粗」
    arm = arm_skin(F, skin, muscle=0.85, k=0.9, k_fore=1.14)
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
    # GK 第一輪：腳掌放寬 1.2 倍、腳背加高（參考 02／04：腳背寬約 0.5 頭、三根腳趾粗短）。thigh／shin 加粗後小腿下端比舊腳掌還寬，
    # 腳踝一圈的皮膚從腳殼上緣穿出成鋸齒；舊版腳趾 2.2 cm 粗，俯視像細長的鳥爪
    kw = 1.32   # GK 第二輪：1.2→1.32，參考 02／04 的腳背寬而平（約 0.5 頭寬）
    pad = kit.loft('clawFootL', [S(V((fx, 0.04, -0.055)), 0.03 * kw, 0.034, p=2.2), S(V((fx, 0.06, -0.005)), 0.043 * kw, 0.058, p=2.3),
                                 S(V((fx + 0.004, 0.042, 0.045)), 0.05 * kw, 0.038, p=2.4), S(V((fx + 0.006, 0.026, 0.085)), 0.047 * kw, 0.022, p=2.4)],
                   n=14, front=V((0, 1, 0)))
    kit.deform(pad, lambda p: V((p.x, max(p.y, 0.006), p.z)))
    pad = kit.subsurf(pad, 1)
    kit.recalc_normals(pad)
    claws = [pad]
    nails = []

    def toe(base, d, L, r0, r1, name, claw=0.032):
        # GK 第二輪：舊版腳趾是一樣粗的圓柱、末端頂著一顆亮面的黑球指甲，正面看像一排「眼珠」。
        # 參考 02／04：粗短的腳趾往前收細，末端是往前伸、往下勾的深色尖爪（霧面），爪根和趾尖一樣粗、尖端收成一點
        d = d.normalized()
        tip = base + d * L
        mid = base + d * (L * 0.5) + V((0, 0.006, 0))
        # 放樣的 front 取上方：腳趾朝前（+z），front 用預設的 +z 會和走向平行，斷面框架退化、繞序翻面（整根被外框殼蓋成黑色）
        t = kit.subsurf(path_loft(name, [base, mid, tip], [r0, (r0 + r1) / 2 * 1.05, r1], n=10, front=V((0, 1, 0)), side=V((1, 0, 0))), 1)
        kit.recalc_normals(t)
        claws.append(t)
        # 尖爪：從趾尖裡面長出來（爪根埋進趾尖 0.6 個半徑），往前、往下勾成尖端；上下壓扁成爪形
        up = V((0, 1, 0))
        c0 = tip - d * (r1 * 0.6) + up * (r1 * 0.1)
        c1 = tip + d * (claw * 0.45) + up * (r1 * 0.05)
        c2 = tip + d * (claw * 0.95) - up * (r1 * 0.55)
        nl = path_loft(name + 'Nail', [c0, c1, c2], [r1 * 0.95, r1 * 0.62, 0.0015], n=10, front=V((0, 1, 0)), side=V((1, 0, 0)), flat=0.62)
        nl = kit.subsurf(nl, 1)
        kit.recalc_normals(nl)
        nails.append(kit.tag(nl, nail, mat=0, grp=G_FOOT_L, ol=0.4))
    tb0 = V((fx + 0.004, 0.026, 0.07))
    for ang, L in ((-0.62, 0.095), (0.0, 0.112), (0.62, 0.095)):   # 外、中、內三趾往前張開
        toe(tb0 + V((math.sin(ang) * 0.03, 0, 0)), V((math.sin(ang), -0.06, math.cos(ang))), L, 0.031, 0.022, 'clawToe')
    toe(V((fx, 0.032, -0.05)), V((0, -0.15, -1)), 0.045, 0.024, 0.017, 'clawBack', claw=0.024)   # 腳跟的後爪
    for o in claws:
        kit.tag(o, skin, mat=4, grp=G_FOOT_L, ol=0.7)
    pair_add(body, proxy, claws + nails)
    # 紫色甲片：肩、小腿
    side = V((0, 0, 1)).cross(F.da).normalized()
    # 肩甲（參考 02／04：單片寬約 0.47 頭高、高約 0.35 頭高，頂點約在下巴高度，往外凸出頭寬之外，兩片外緣距約 1.64 頭高）：
    # 中心往外、往上移到三角肌頂上，半球大部分露在肩外（舊版 7.6 cm 的半徑一半埋在三角肌裡，正面只露出 0.31 頭高）
    # GK 第一輪：舊版 0.098／0.09／0.068（正面量到單片 0.61×0.56 頭高，比參考大三成，頂點高過下巴、緊貼脖子，像兩顆球）。
    # 改小成扁一點的半球、中心往外移到三角肌頂、高度降到肩關節：頂點約在頭頂下 1.0 頭（參考 02 1.02、04 1.0），
    # 外緣距中線約 0.27 m（兩片外緣距約 1.7 頭），頸側與肩甲之間露出一段白色的斜方肌
    # GK 第三輪：舊版的高度軸往外斜 37°（ax_n＝(0.6, 0.8)），中心在肩關節外 3.4 cm，正面看是掛在三角肌外側、直立的橢球，
    # 露出的紫色只有寬 0.3×高 0.4 頭（長寬比和參考相反），內側大半埋在斜方肌裡。改成寬扁的「肩帽」：
    # 長軸幾乎水平（沿肩線往外微微下斜）、高度軸朝上，中心收回到肩關節上方，從頸側（斜方肌外緣）一路蓋到肩頭；
    # 上半是半橢球（高 rn），下半只鼓出一片薄透鏡（rb），底面不會像球一樣垂到上臂外側。
    # 目標（H＝0.312 m）：單片寬 0.47 頭＝0.147 m、高 0.35 頭＝0.109 m、頂點約在下巴高度（y≈1.28）、外緣 x≈0.255（含肩甲肩寬約 1.64 頭）
    def cap(name, center, ax_u, ax_n, ru, rv, rn, rb):
        o = kit.quad_sphere(name, 1.0, cuts=5)
        au = V(ax_u).normalized()
        an = V(ax_n).normalized()
        av = au.cross(an).normalized()
        kit.deform(o, lambda p: V(center) + au * p.x * ru + av * p.y * rv + an * p.z * (rn if p.z > 0 else rb))
        o = kit.subsurf(o, 1)
        kit.recalc_normals(o)
        return kit.tag(o, dome, mat=2, grp=heroes.G_DELT_L, ol=0.7)
    shp = cap('shoulderL', V((F.sh.x + 0.01, F.sh.y + 0.03, -0.004)), (0.97, -0.24, 0), (0.24, 0.97, 0), 0.098, 0.082, 0.066, 0.035)
    # 小腿正面的紫色長條（參考 02／04：膝下到腳踝上方，頭頂下約 3.9～4.5 頭；寬約 0.2 頭、兩端圓角的長方形，不是尖頭的橢圓）。
    # 舊版中心固定在膝下 0.15 m，thighK 改 0.4（膝抬高、小腿變長）後會跑到膝蓋上；改照小腿長的比例放在小腿中段
    # GK 第二輪：舊版中心在小腿中段（頭頂下 4.03～4.62 頭，比參考低 0.1 頭）、中心埋在小腿裡（往前只推 0.05×kl，小腿半徑約 0.072×kl），
    # 只露出弦的那一段，正面寬只有 0.14 頭（參考約 0.2 頭）。改成照高度定位（頭頂 1.59 m、頭高 0.312 m：3.9～4.5 頭＝y 0.37～0.19），
    # 甲片貼在真人小腿正面（底模小腿換上後半徑約 0.05 m，外緣只凸出幾公釐、邊緣埋進皮膚）、繞小腿正面約 ±42°，正面看是寬約 0.2 頭的圓角長條
    yc = 1.59 - 4.2 * 0.312
    sc_ = (F.th.y - yc) / -F.dl.y
    ax0 = F.leg_pt(sc_)
    au_, av_ = F.dl, V((1, 0, 0))
    av_ = (av_ - au_ * av_.dot(au_)).normalized()
    an_ = au_.cross(av_).normalized()
    if an_.z < 0:
        an_ = -an_
    sgp = lambda x, e: math.copysign(abs(x) ** e, x)
    shn = kit.quad_sphere('shinL', 1.0, cuts=4)

    def wrap(p):
        # 長軸做超橢圓（兩端圓角）；繞小腿的角度 θ 也做超橢圓，厚度方向是 1 cm 的圓拱
        u = sgp(p.x, 0.55) * 0.094
        th = sgp(p.y, 0.7) * 0.74
        r = 0.057 + 0.006 * max(0.0, -p.x) + p.z * 0.007   # 上端（靠膝蓋，小腿較粗）多推出一點；GK 第三輪小腿加粗，貼合半徑跟著放大
        return ax0 + au_ * u + (an_ * math.cos(th) + av_ * math.sin(th)) * r
    kit.deform(shn, wrap)
    shn = kit.subsurf(shn, 1)
    kit.recalc_normals(shn)
    kit.tag(shn, dome, mat=2, grp=G_FOOT_L, ol=0.7)
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
    # GK 第一輪：上緣改以頸根為基準（頸根下 0.15 m＝頭頂下約 1.68 頭）；舊版以胸骨 ribs 為基準，髖抬高、軀幹變短後 ribs 上移，寶石會跟著往上跑
    GEM_Y, GEM_H, GEM_W = F.b['neck'][0].y - 0.15, 0.1, 0.078   # 上緣高度、上緣到尖端的高度、半寬

    def gem_f(co):
        ax = abs(co.x)
        top = GEM_Y + 0.012 * (1 - min(1.0, (ax / GEM_W) ** 2))   # 上緣中央微微拱起
        t = (top - co.y) / GEM_H                                    # 0＝上緣、1＝尖端
        w = GEM_W * max(0.0, 1 - max(0.0, t) ** 1.7)                 # 上半段兩側近乎平行，往下收成尖端
        # 以 2 cm 為單位：refine_near 細分場值 ±0.4 以內的面，用公尺的話整個身體都會被細分兩次
        return max(co.y - top, ax - w, 0.05 - co.z) / 0.02
    realbody.paint(skin_body, F, gem_f, dome, 2, refine=2)
    # 軀幹的肌肉起伏（GK 第二輪）：舊版的背面是一根光滑的白管，參考 03 Figure-rise 的背肌是全身最立體的地方，
    # 01／04／05 正面的胸肌、腹肌也分塊明顯（S.H.F. 02 比較光滑，但胸肌下緣與腹直肌的分線仍在）。遊戲鏡頭最常看到的就是背。
    # 在擬合好的真人軀幹上沿法線推出（realbody.sculpt；只動軀幹權重，頭頸接縫不動），形狀都是 2 cm 以上的平滑隆起與凹線，
    # 烘焙遮蔽會把凹線再壓暗一點（卡通明暗下才看得出分塊，又不會碎成斑點）
    yn, nz0 = F.b['neck'][0].y, F.b['neck'][0].z
    g2 = lambda dx, dy, sx, sy: math.exp(-(dx / sx) ** 2 - (dy / sy) ** 2)

    def seg_d(px, py, ax, ay, bx, by):
        vx, vy = bx - ax, by - ay
        t = max(0.0, min(1.0, ((px - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy)))
        return math.hypot(px - ax - vx * t, py - ay - vy * t)

    def muscles(co):
        x, y, z = abs(co.x), co.y, co.z
        front = smooth((z + 0.01) / 0.04)
        back = 1 - smooth((z + 0.02) / 0.04)
        d = 0.0
        # GK 第三輪：外框是沿法線往外推的反向殼（遊戲距離約 1.9 cm 厚），凹處的曲率半徑比殼還小時，兩側的殼會從凹處透出來，
        # 變成黑色墨線（第二輪背面一整條脊椎黑線、腹部黑十字、胯下黑 V、頸肩交界的黑碎片）。高斯凹線 A·exp(−(x/s)²) 底部的曲率半徑是 s²／2A，
        # 所以每條凹線都改成 s²／2A ≥ 約 4 cm（寬而淺），分塊交給隆起之間的落差與烘焙遮蔽；腹直肌的中線凹溝拿掉
        # （它在 y 方向沒有下界，一路刻到骨盆、胯下，就是那個黑 V），腹肌只留兩列隆起。
        # 正面：胸肌（下緣是寶石上緣）、胸骨的淺凹、胸肌下緣的淺摺、腹直肌兩列四塊（只在寶石下到肚臍之間）
        abs_win = smooth((y - (yn - 0.36)) / 0.03) * (1 - smooth((y - (yn - 0.22)) / 0.03))
        d += front * (0.008 * g2(x - 0.066, y - (yn - 0.1), 0.058, 0.04)
                      - 0.002 * g2(x, y - (yn - 0.1), 0.028, 0.06)
                      - 0.0015 * g2(0, y - (yn - 0.152), 1, 0.026) * (1 - smooth((x - 0.1) / 0.03))
                      + 0.0028 * abs_win * (g2(x - 0.034, y - (yn - 0.262), 0.024, 0.02) + g2(x - 0.034, y - (yn - 0.31), 0.024, 0.02)))
        # 背面：脊椎的淺溝、兩側豎脊肌、肩胛骨、從腋下斜到腰的背闊肌
        d += back * (-0.0025 * g2(x, 0, 0.026, 1) * smooth((y - (yn - 0.34)) / 0.03) * (1 - smooth((y - (yn - 0.02)) / 0.03))
                     + 0.0026 * g2(x - 0.036, y - (yn - 0.25), 0.024, 0.09)
                     + 0.008 * g2(x - 0.075, y - (yn - 0.095), 0.045, 0.05)
                     + 0.0065 * math.exp(-(seg_d(x, y, 0.125, yn - 0.13, 0.078, yn - 0.25) / 0.022) ** 2))
        # 斜方肌：從頸根往外、往下斜到肩甲（參考 02／04）。第二輪是頸根外 7.5 cm 的一圈環狀隆起，環和脖子之間夾出一道窄溝，
        # 正面頸肩交界透出一段段外框殼的黑碎片。改成貼著脖子最高、往外單調降下來（rn＜7 cm 一律全量），脖子根部變粗、沒有凹溝。
        # 背面（參考 03）的後腦幾乎壓在斜方肌上：背側的斜方肌再往上墊高、加厚，脖子從背面看變短變粗
        rn = math.hypot(co.x, co.z - nz0)
        fall = math.exp(-(max(0.0, rn - 0.07) / 0.045) ** 2)
        bk = 1 - smooth((co.z - nz0 + 0.01) / 0.05)   # 背側 1、正面 0
        # 上下兩端的過渡都拉到 6～8 cm（3 cm 的過渡在頸根摺出曲率半徑不到 1 cm 的凹角，同樣會透出外框）
        ytop = yn - 0.01 + 0.03 * bk
        d += (0.009 + 0.005 * bk) * fall * smooth((y - (yn - 0.13)) / 0.08) * (1 - smooth((y - ytop) / 0.06))
        return d
    realbody.sculpt(F, muscles)
    # 肌肉分線（FighterZ 立繪 06 的畫法：白皮膚上一條條偏冷的淡灰紫細線）：起伏只有幾公釐，背光的背面整片在暗部、看不出分塊，
    # 所以主要的分線另外用色塊畫在皮膚上（寬約 1 cm，遊戲鏡頭下約 1 px，近看才清楚）。座標以頸根高度 yn 為基準、x 取絕對值（左右對稱）
    mline = P(0xd9d4e6)
    # GK 第三輪：拿掉落在正中線（x＝0）上的線（脊椎、胸骨、腹直肌中線）：細分切線在底模的中線上留下一條細縫，
    # 外框殼從縫裡透出來，遊戲距離下是一整條黑色墨線（背面的脊椎線、寶石下的垂直黑線；不畫這幾條線時黑線就消失）。
    # 脊溝與腹直肌的分界改由 sculpt 的淺凹與兩列隆起、烘焙遮蔽表現（參考 03 的脊椎是陰影凹溝，不是墨線）
    LINES_B = [   # 背面（z<0）
        [(0.045, yn - 0.05), (0.048, yn - 0.11), (0.068, yn - 0.155), (0.105, yn - 0.135)],    # 肩胛骨內緣到下角
        [(0.125, yn - 0.135), (0.1, yn - 0.2), (0.078, yn - 0.265)],                           # 背闊肌外緣
    ]
    LINES_F = [   # 正面（z>0）
        [(0.092, yn - 0.148), (0.108, yn - 0.135), (0.122, yn - 0.1)],                         # 胸肌下緣（寶石外側到腋下）
        # GK 第三輪：拿掉腹肌的兩條橫線（和中線組成梯子、十字形），腹直肌的分塊靠 sculpt 的兩列隆起與烘焙遮蔽
    ]

    def poly_d(x, y, pts):
        return min(seg_d(x, y, *a, *b) for a, b in zip(pts, pts[1:]))

    def line_f(co):
        x, y = abs(co.x), co.y
        ls = LINES_B if co.z < 0 else LINES_F
        dz = abs(co.z) - 0.02   # 只塗前後兩面（側面 |z| 小的地方不塗，前後的線不會在腰側接在一起）
        return max(min(poly_d(x, y, pl) for pl in ls) - 0.005, -dz) / 0.01
    realbody.paint(skin_body, F, line_f, mline, 4, refine=2)
    # 胯下（兩條大腿根之間的窄凹角）：曲率半徑比外框殼（遊戲距離約 1.9 cm）小，反向殼從凹角穿出成一個黑色 V 字（基準版就有，
    # 第二輪腹中線的凹溝刻到這裡後更明顯）。這裡不是剪影輪廓，只把凹角附近的外框倍率收細（由 project() 投影到底模）
    yc_ = F.b['thL'][0].y - 0.065
    kit.paint_ol(skin_body, lambda co: (0.3 + 0.7 * smooth(math.hypot(co.x / 0.05, (co.y - yc_) / 0.055) * 1.6 - 0.6))
                 if math.hypot(co.x / 0.05, (co.y - yc_) / 0.055) < 1 else None)
    body.append(band('teamL', F.sh, F.da, 0.155, 0.175, 0.07 * F.k_arm, 0.068 * F.k_arm, team, G_UPPER_L, thick=0.005, mat=5, ol=0.5))
    # 尾巴（擺動鏈，綁定姿勢筆直下垂；遊戲裡由 models.js 的 groundChain 逐節擺成「下垂→貼地繞弧→尾尖上勾」）
    # GK 第二輪：8 節 × 0.32 m（2.56 m，約 1.65 倍身高；參考 03 拉直約 1.6～1.8 倍身高）；粗細從根部一路收到尾尖（參考 02／03／04：根部約 0.42 頭粗、
    # 和大腿差不多，落地繞到身側時約 0.3 頭，最後一段收成尖）。舊版前半段維持粗度、中段還有大腿粗，側面像一根粗棍。
    # TAIL_R 是各節起點的半徑，models.js 的 chainSpecs（ground.rad）用同一組數字當貼地的離地高度
    # GK 第三輪：8 節 × 0.32 m 在遊戲鏡頭下貼地的那一圈每 0.32 m 一個折角（多邊形折線），尾端從 1.1 cm 收到 2.5 mm 的針尖，
    # 往上勾時像一根細天線。改成 12 節 × 0.2 m（2.4 m，約 1.5 倍身高）：折角變小、弧線平滑；
    # 粗細收得比較慢（根部約 0.42 頭、貼地處約 0.3 頭），尾端最後一節仍有 2 cm 粗、再圓圓地收尖，勾起來是有粗細的鉤
    TAIL_R = [0.067, 0.063, 0.059, 0.055, 0.051, 0.047, 0.043, 0.039, 0.035, 0.031, 0.027, 0.023]
    h0 = F.b['tail0'][0]
    names = [x['name'] for x in R['bones']]
    tn = sum(1 for x in names if x.startswith('tail') and x[4:].isdigit())
    seg = R['bones'][names.index('tail0')]
    ln = (V(seg['head']) - V(seg['tail'])).length
    assert tn == len(TAIL_R), '尾巴節數 %d 和 TAIL_R 不一致' % tn
    off = 0.06   # 放樣起點在骨頭起點上方 6 cm（和臀部融在一起）
    rows = [(0, 0.064, 0.064)] + [(off + i * ln, r_, r_) for i, r_ in enumerate(TAIL_R)] + [(off + (tn - 0.45) * ln, 0.02, 0.02), (off + (tn - 0.12) * ln, 0.014, 0.014), (off + tn * ln, 0.006, 0.006)]
    tail = limb('tail', h0 + V((0, off, 0.02)), V((0, -1, 0)), rows, n=12)
    tail = kit.subsurf(tail, 2)
    body.append(kit.tag(tail, skin, mat=4, grp=G_CHAIN))
    tb = [F.b['tail%d' % i] for i in range(tn)]

    def tail_w(co):
        t = (tb[0][0].y - co.y) / ln
        if t < 0.5:
            k = smooth((t + 0.3) / 0.8)
            return [('tail0', k), ('hips', 1 - k)]
        x = t - 0.5
        i = int(math.floor(x))
        f = smooth(x - i)
        a, b = min(i, tn - 1), min(i + 1, tn - 1)
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
        # GK 第一輪：0.021／0.009 → 0.029／0.018。參考 02 正面太陽穴的突起在眼線高度凸出臉的輪廓外（頭最寬處就在這裡，約 0.97 頭高），
        # 03 背面、05 側面是一圈明顯的圓杯（直徑約 0.2 頭高），中央是黑色耳孔；舊版扁平、大半埋進頭側，正面幾乎看不到
        kit.deform(bump, lambda p, cen=cen, d=d, u=u, w=w: cen + u * p.x * 0.029 + w * p.y * 0.029 + d * p.z * 0.018)
        bump['hole'] = [holeP, d.x, d.y, d.z, 0.0165]   # 孔佔突起的大半，外圈只剩一圈薄邊（孔太小、外框太粗時看起來像多一隻眼睛）
        temples.append(bump)
    # GK 第一輪：jaw 0.55→0.46、cheek 0.95→0.9（下巴寬倍率 0.52→0.41）：參考 04／05／06 的臉從太陽穴的耳杯以下就直線收成小尖下巴，
    # 舊版顴骨下方到下顎仍寬，正面是圓臉
    h = anime_head('head_base', F, skin, ears=False, extra=temples, jaw=0.46, chin=0.9, cheek=0.9, cranium=(1.25, 1.24, 1.0), nose=0.0, face_len=1.2, egg=1.0,
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
    shirt = P(0x1d1d23)
    # GK 第一輪（參考 02 FRS、05 SEW、06 FighterZ）：袖子是白底配灰黑細橫紋（條紋約占週期三分之一），舊版黑白等寬像囚衣。
    # GK 第二輪：條紋 0x8c8c98→中性深灰 0x55555c（0x8c8c98 在角色材質下渲染成淡紫，56° 俯角幾乎看不到條紋）
    sleeve_w, stripe = P(0xefeee9), P(0x55555c)
    # 牛仔藍（參考 05 SEW #2f4fb0、02 FRS #3a5fc8）：舊版 0x4274bc 在角色材質下渲染成偏亮的天藍
    denim, denimD = P(0x3a66b8), P(0x284a8e)
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
    nk_r = lambda co: math.hypot(co.x, co.z + 0.006) - 0.13   # GK 第一輪：0.09→0.13，圓領前緣在胸骨上方（離頸軸約 10 cm）
    # 場除以 1 cm：refine 只細分 |場|＜0.4 的面（交界 4 mm 內），以公尺計會把整個身體都細分
    # GK 第一輪：黑上衣的領口改成前低後高的圓領（參考 05 SEW、06 立繪：背心翻領之間露出鎖骨下一截皮膚），前方低 4 cm
    nk_line = lambda co: nk_y - 0.045 * max(0.0, 1 - (co.x / 0.085) ** 2) * smooth((co.z + 0.02) / 0.04)   # 只看 x：頸窩凹進去，照 z 算會在中央翹起一塊
    realbody.paint(sh, F, lambda co: max(nk_r(co), co.y - nk_line(co), F.y(0.8) - co.y) / 0.01, shirt, 0, refine=2)
    realbody.paint(sh, F, lambda co: max(nk_r(co), nk_line(co) - co.y) / 0.01, skin, 4, refine=2)
    # GK 第二輪：背心前襟敞開處的黑上衣外框變細。底模胸側在背心內緣被收進衣物，皮膚在那裡折出一道凹摺，
    # 粗的外框反殼從凹摺穿出，背心內緣旁一排黑色碎屑（e-head）；外框倍率靠 project() 從這個部件投影到底模
    kit.paint_ol(sh, lambda co: 0.3 + 0.7 * smooth((abs(co.x) - 0.11) / 0.04) if co.z > 0.0 and F.y(0.3) < co.y < F.y(0.98) else None)
    us = [r[0] for r in FEMALE_ROWS if r[0] >= 0.3]
    # 黑色貼身上衣＋條紋長袖，外面再套短版牛仔背心（a18_vest；FighterZ 的 DBZ 造型）
    body.append(neck(F, skin, r=0.048))
    proxy.append(body[-1])
    # 長袖條紋上衣
    arm = arm_skin(F, skin, muscle=0.3, k=1.04)

    s_end = F.up + F.lo - 0.03
    # 換真人身體後，條紋原本先塗在手臂部件上再逐頂點投影到底模：條紋寬約 2 cm，和底模手臂的面差不多大，
    # 投影後被平滑、併島，變成幾大塊白色鋸齒碎片。改成 realbody.paint() 在底模上直接用同一個場切線上色
    # （交界附近先細分一次），範圍限制在 heroes.arm_region 的手臂上，不會塗到腋下的軀幹
    # 手臂部件本身仍先塗黑：底模肩頭有一圈頂點投影到手臂部件（不在 arm_region 的鉛直切面外側），部件是膚色的話肩頭會露出一塊膚色
    kit.paint_field(arm, lambda co: arm_s(F, co) - s_end, sleeve_w, 0)
    # 手臂和軀幹的分界：arm_region 的 |x| 鉛直切面在腋窩和皮膚幾乎平行，舉手時切線在腋下拉成鋸齒、留下白色碎片；
    # 換成底模蒙皮權重的等值線（realbody.weight_field，抬手時沿著它平順拉開）。只取左臂的骨頭，鏡射那一份自動換成右臂
    on_arm = realbody.weight_field(ARM_L, 0.5, fallback=heroes.arm_region(F, s_end + 0.1, both=False))
    realbody.paint(arm, F, lambda co: max(arm_s(F, co) - s_end, on_arm(co)), sleeve_w, 0)
    # 袖口以外（手腕、手）明確塗回膚色：投影在手腕附近有幾個頂點取到手臂部件的黑色，袖口成黑色短刺的階梯
    realbody.paint(arm, F, lambda co: max(s_end - arm_s(F, co), on_arm(co)), skin, 4)
    # 細分只做在 |場|＜0.4 的面：條紋項的 1 單位約 7 mm，其他以公尺計的項也除以 0.007 換成同一尺度，才不會整個身體都被細分
    # 條紋只畫在手臂權重六成以上的地方：腋窩前後的皺褶（權重在手臂和胸廓之間）留黑色，舉手時那裡被拉到胸側，不會在胸口留下白色碎片。
    # 原本取九成：底模女性上臂內側到臂章上方（肩下約 14 cm）權重都不到九成，等值線斜斜穿過條紋，內側的條紋切成鋸齒碎片、只剩外側半圈
    # GK 第一輪：條紋週期 4.6→3.4 cm（參考 02 FRS 量到約 0.11 頭高一條）、深色只占三分之一（sin＞0.45）；場的單位約 5 mm
    in_sleeve = realbody.weight_field(ARM_L, 0.6, fallback=heroes.arm_region(F, s_end + 0.1, r=0.068, both=False))
    # 條紋的場改成「離最近一條深色條紋中線的距離−半寬」（以 1.2 cm 為一單位）：舊的 0.45−sin 在底模手肘附近 2 cm 長的面上，
    # 兩端頂點都落在白色、條紋整條藏在面裡，refine 不會細分、切線也切不到，那一條紋被逐面上色成一排鋸齒
    P_st, hw_st = 0.034, 0.006

    def stripe_d(co):
        ph = (arm_s(F, co) / P_st - 0.25) % 1.0
        return (min(ph, 1.0 - ph) * P_st - hw_st) / 0.012
    realbody.paint(arm, F, lambda co: max(stripe_d(co), (arm_s(F, co) - s_end + 0.01) / 0.012, (0.03 - arm_s(F, co)) / 0.012, in_sleeve(co) / 0.05), stripe, 0, refine=2)
    # 肩頭（荷葉袖口裡面）塗成牛仔藍：荷葉袖從肩關節內 2 cm 開口，俯角往袖口裡看會看到底模肩頭的黑上衣，
    # 遊戲視角兩肩各一個黑洞。這塊被背心和荷葉袖蓋住，只有從袖口縫隙看得到，塗成背心同色就像背心內裡
    def cap_d(co):
        p = V((abs(co.x), co.y, co.z))
        return max(arm_s(F, co) - 0.03, (p - F.sh).length - 0.085, F.sh.y - 0.03 - co.y) / 0.01
    for o in (sh, arm):
        realbody.paint(o, F, cap_d, denim, 0)
    hand = fist(F, skin, scale=1.0)
    # 裙、內搭褲、短靴
    body.append(realbody.skin(pelvis(F, legging, e=0.004)))
    proxy.append(body[-1])
    # GK 第一輪（參考 02 FRS、05 SEW）：牛仔窄裙。皮帶在下巴下約 0.95 頭（總高的 39%）、裙襬在總高 57%（離地約 0.75 m），
    # 裙長約 0.32 m；裙寬幾乎直筒：皮帶處 0.23 m、臀 0.31 m、裙襬 0.33 m。舊版是到膝上的鐘形 A 字裙（裙襬寬 0.45 m、長 0.4 m），
    # 皮帶低在髖關節上 9 cm
    yb = F.y(0.176)
    y_hem = 0.75
    hw = F.R['hip']
    seat = lambda th: 1 + 0.1 * ang_bump(th, BACK, 1.5)   # 臀部後面多留一點空間（跨步時後腿的臀部會頂出裙子）
    sk = kit.loft('skirt', [S(V((0, yb + 0.012, 0.0)), F.w * 1.18 + 0.008, F.cz * 0.86 + 0.01, p=2.3),
                            S(V((0, yb - 0.05, 0.0)), hw * 1.36, F.cz * 1.01, p=2.3, mod=seat),
                            S(V((0, yb - 0.12, 0.004)), hw * 1.47, F.cz * 1.07, p=2.2, mod=seat),
                            S(V((0, lerp(yb - 0.12, y_hem, 0.55), 0.006)), hw * 1.51, F.cz * 1.13, p=2.2),
                            S(V((0, y_hem, 0.008)), hw * 1.56, F.cz * 1.18, p=2.2)], n=22, cap0=None, cap1=None)
    sk = kit.subsurf(sk, 2, solidify=0.009)
    kit.tag(sk, denim, grp=G_SKIRT)
    # 裙襬一圈較深的反摺縫線（參考 05 SEW 的下襬折邊）
    kit.paint_field(sk, lambda co: co.y - (y_hem + 0.014), denimD, 0)
    body.append(sk)
    # 皮帶：深褐、寬 3 cm，正前方一顆金色橢圓扣（參考 01／02 FRS、05 SEW）
    body.append(belt_ring(F, yb, 0.03, beltc, e=0.016, thick=0.008))
    bz = max(v.co.z for v in body[-1].data.vertices if abs(v.co.x) < 0.01 and abs(v.co.y - yb) < 0.02)
    bk = kit.quad_sphere('a18Buckle', 1.0, cuts=4)
    kit.deform(bk, lambda p: V((p.x * 0.026, yb + p.y * 0.017, bz + 0.002 + p.z * 0.005)))
    body.append(kit.tag(kit.subsurf(bk, 1), P(0xd8b24a), mat=2, grp=G_BELT, ol=0.5))
    # GK 第一輪：短版牛仔背心（FighterZ 的預設造型、參考 01／03／04 FRS、05 SEW、06 立繪）。舊版只穿黑上衣，56° 俯角下整個上身是一塊黑
    vparts = a18_vest(F, denim, denimD, P(0xc8a25a), P(0xc8282e), P(0xf2f0ea), yb + 0.022)
    body += vparts
    proxy.append(vparts[0])
    kl = F.k_leg
    calf = lambda th: 1 + 0.09 * ang_bump(th, BACK, 1.0)
    leg = leg_tube(F, legging, [(-0.07, 0.112 * kl, 0.112 * kl), (0.05, 0.11 * kl, 0.114 * kl), (0.22, 0.094 * kl, 0.098 * kl), (F.tl - 0.03, 0.068 * kl, 0.074 * kl),
                                (F.tl + 0.07, 0.068 * kl, 0.074 * kl, calf), (F.tl + 0.17, 0.056 * kl, 0.06 * kl, calf), (F.tl + 0.26, 0.042 * kl, 0.046 * kl)])
    realbody.skin(leg)
    # GK 第一輪：靴口到小腿中段（離地約 0.38 m，舊版 0.46 m 到膝下），靴口外翻、比小腿寬一圈；腳踝一道深色皮帶加銀環，鞋底白邊（參考 01／02 FRS）
    btop = F.tl + 0.14
    bt = boot(F, bootc, btop, 0.072, pal_sole=bootD, toe=0.95)
    # 靴筒整支照腿軸放粗 1.2 倍（參考 05 SEW、02 FRS：靴筒是幾乎直筒的粗管，靴口約 0.5 頭寬、腳踝約 0.4 頭；heroes.boot 的腳踝只有 0.3 頭）
    kb = 1.2

    def widen(ob, k):
        def f(p):
            s_ = (p - F.th).dot(F.dl)
            a = F.leg_pt(s_)
            return a + (p - a) * k
        kit.deform(ob, f)
    widen(bt[0], kb)
    kit.paint_field(bt[1], lambda co: co.y - 0.009, P(0xe6e0d4), 0)
    # 靴口翻邊（GK 第二輪，參考 01／02 FRS）：從靴筒頂緣往外下方翻出的一圈薄邊，上緣貼著靴筒頂、下緣只比靴筒寬一點。
    # 第一輪是另外套上的一圈粗環（比靴筒寬 2 cm、高出靴頂 2.2 cm、厚 8 mm），側面看是兩截疊起來的圓筒，俯視像兩個甜甜圈
    rs = 0.072 * F.k_shin * kb          # 靴筒頂（boot() 的 r_top，再乘 widen 的倍率）
    cuffb = band('bootCuffL', F.th, F.dl, btop - 0.009, btop + 0.04, rs * 0.97 + 0.006, rs * 1.13 + 0.005, bootc, G_FOOT_L, thick=0.0045, rb=1.03, bulge=1.0)
    ank = band('bootStrapL', F.th, F.dl, F.tl + F.sl - 0.07, F.tl + F.sl - 0.05, (0.058 * F.k_shin + 0.004) * kb, (0.06 * F.k_shin + 0.005) * kb, bootD, G_FOOT_L, thick=0.006, rb=1.1)
    ring = kit.quad_sphere('bootRingL', 1.0, cuts=3)
    rc = F.leg_pt(F.tl + F.sl - 0.06) + V(((0.06 * F.k_shin + 0.005) * kb + 0.006, 0, 0.01))
    kit.deform(ring, lambda p: rc + V((p.x * 0.004, p.y * 0.012, p.z * 0.012)))
    bt += [cuffb, ank, kit.tag(kit.subsurf(ring, 1), P(0xc9ccd2), mat=2, grp=G_FOOT_L, ol=0.4)]
    frill = a18_frill(F, denim, F.k_arm * 1.04)
    pair_add(body, proxy, [arm, hand, leg, frill] + bt, proxy_set=[arm, hand, leg] + bt[:2])
    body.append(team_band(F, team, 1.0, hug=True))

    # GK 第一輪：參考 02 FRS、06 立繪的眼到下巴只有髮頂到下巴的 0.37（舊版 0.47，臉長、眼睛偏高）；face_len 0.8 把下巴往上收約 2.5 cm，
    # 頭（hr 0.165）與鮑伯頭的頭頂（a18_bob）一起放大，髮頂到下巴約 0.31 m、總高約 5.6 頭（FRS 與 SEW 實量 5.2，FighterZ 遊戲約 5.8）。
    # muzzle 0.75：底模的上下唇在臉縮短後擠成一道咬牙的深色縫，和臉部貼花的嘴疊成兩張嘴（同特南克斯）
    h = anime_head('head_base', F, skin, jaw=0.9, chin=0.85, cheek=0.96, nose=0.7, face_len=0.8, muzzle=0.75)
    hc = P(0xeed892)   # 淡金（參考 #f3d77a；角色材質會再提亮飽和，舊色渲染成檸檬黃）
    heads = {'base': [h, a18_bob('bob', F, hc, pal_part=P(0xd2bb7a))] + hair(F, hc, a18_hair(), grow=1.0 / heroes.HAIR_GROW, ol=0.5)}  # 及下巴的蓬鬆鮑伯頭＋側分瀏海
    sw = sleeve_arm_weights(F, s1=0.05)
    H = finish(F, P, body, proxy, heads, custom={G_SKIRT: a18_skirt_weights(F), G_PELVIS: a18_pelvis_weights(F), heroes.G_ARM_L: sw, heroes.G_ARM_R: sw})
    # 鮑伯頭的殼是 cuts 20 細分一次（加厚後約 2.7 萬面）：預設的 5200 面上限會把它減回粗網格，分線與髮尾溝紋又變成鋸齒
    H['hair_tris'] = 32000
    return H


# 背心最上一圈蓋過斜方肌到頸根（1.04）：只到 0.97 時，底模的斜方肌比背心肩線高，兩肩各露出一塊黑上衣
A18_VEST_ROWS = [(0.25, ('w', 1.04), 0.8, 0.0)] + [r for r in FEMALE_ROWS if 0.3 < r[0] < 0.95] + [(0.97, ('c', 0.7), 0.64, -0.04), (1.04, ('c', 0.5), 0.56, -0.03)]


def a18_vest(F, denim, denimD, brass, red, white, y_hem):
    """短版牛仔背心（GK 第一輪）：下襬在皮帶上緣、前襟敞開露出黑上衣（開口從下襬約 8 cm 往上漸寬成 V 領）、無袖，
    袖孔一圈荷葉邊（a18_frill）、翻領、左右胸前有蓋口袋與銅釦、背後上方一塊紅色方標（參考 03 FRS 背面；不放文字）。
    回傳 [背心, 其他貼片...]；背心是 G_TORSO（骨熱），貼片 G_RIDE 跟著背心（ride_on）。"""
    u_hem = (y_hem - F.yT) / F.T
    rows = [(u_hem,) + A18_VEST_ROWS[0][1:]] + A18_VEST_ROWS[1:]
    us = [r[0] for r in rows]
    # 離皮膚 1.6 cm，下襬再多 1 cm：短版背心是硬挺的直筒，不跟著腰收（參考 01 FRS 側面下襬離身體一指寬）
    e = lambda u: 0.016 + 0.01 * (1 - smooth((u - u_hem) / 0.25))
    vs = kit.loft('a18Vest', torso_rows(F, e=e, rows=rows, pec=0.0, lat=0.0, bust=0.14, p=2.4), n=24, cap0=None, cap1=None,
                  gap=lambda i: 0.3 + 0.32 * smooth((us[i] - 0.62) / 0.35))
    vs = kit.subsurf(vs, 1)
    # 袖孔（同特南克斯外套的壓扁版）：肩頂只開 r×0.45 深。整圈 5 cm 時肩頂開出一個洞，從洞裡看到底下黑上衣的肩頭（正面兩肩各一塊黑斑）
    trunks_armhole(vs, F, 0.055, top=0.12, s0=0.0)
    vs = kit.subsurf(vs, 1, solidify=0.008)
    kit.tag(vs, denim, grp=G_TORSO)
    out = [vs]
    tr = tree_of(vs)

    def stick(ob, origin_z, lift):
        """把平面貼片沿 z 射線投影到背心外層（origin_z 正＝從前面打、負＝從背後打）。"""
        d = V((0, 0, -1)) if origin_z > 0 else V((0, 0, 1))

        def proj(p):
            hit = tr.ray_cast(V((p.x, p.y, origin_z)), d, 1.0)
            if hit[0] is None:
                return p
            n = hit[1] if hit[1].dot(d) < 0 else -hit[1]
            return hit[0] + n * lift
        kit.deform(ob, proj)
        return ob

    def patch(name, cx, cy, hw, hh, lift, pal, origin_z, nx=10, ny=8, ol=0.0, mat=0):
        bm = bmesh.new()
        bmesh.ops.create_grid(bm, x_segments=nx, y_segments=ny, size=1.0)
        ob = kit.to_object(name, bm)
        kit.deform(ob, lambda p: V((cx + p.x * hw, cy + p.y * hh, 0.0)))
        stick(ob, origin_z, lift)
        ob = kit.subsurf(ob, 1, solidify=0.0015)
        kit.tag(ob, pal, grp=heroes.G_RIDE, ol=ol, mat=mat)
        ob['ride_on'] = vs.name
        ob['ride_bary'] = 1
        ob['trim'] = 1
        return ob
    # 胸前有蓋口袋（參考 01／04 FRS：袋蓋在胸口高度、略外側，下方袋身同色，袋蓋中央一顆銅釦）
    yc = F.y(0.68)
    for sx in (1, -1):
        cx = sx * F.cx * 0.52
        out.append(patch('a18Pocket', cx, yc - 0.022, 0.03, 0.026, 0.0015, denim, 0.5, ol=0.3))
        out.append(patch('a18Flap', cx, yc + 0.008, 0.033, 0.012, 0.0035, denimD, 0.5, ol=0.35))
        hit = tr.ray_cast(V((cx, yc + 0.004, 0.5)), V((0, 0, -1)), 1.0)
        if hit[0] is not None:
            b = kit.quad_sphere('a18Btn', 1.0, cuts=3)
            c0 = hit[0] + V((0, 0, 0.006))
            kit.deform(b, lambda p, c0=c0: c0 + V((p.x * 0.0055, p.y * 0.0055, p.z * 0.0025)))
            b = kit.tag(kit.subsurf(b, 1), brass, mat=2, grp=heroes.G_RIDE, ol=0.3)
            b['ride_on'] = vs.name
            b['ride_bary'] = 1
            b['ride_rigid'] = 1
            b['trim'] = 1
            out.append(b)
    # 背後上方的紅色方標（參考 03 FRS：肩胛骨之間、約 0.4 背寬），白色細框；只做色塊不放文字
    yb_ = F.y(0.78)
    out.append(patch('a18BackTag', 0.0, yb_, 0.05, 0.03, 0.002, red, -0.5, nx=16, ny=10, ol=0.3))
    rim = patch('a18BackRim', 0.0, yb_, 0.043, 0.023, 0.0032, white, -0.5, nx=16, ny=10)
    kit.paint_field(rim, lambda co: 0.0035 - max(abs(co.x) - 0.043 + 0.0035, abs(co.y - yb_) - 0.023 + 0.0035, -(max(abs(co.x) - 0.043, abs(co.y - yb_) - 0.023))), red, 0)
    out.append(rim)
    # 翻領：從頸根往外翻到肩上的一圈（前方敞開成兩片尖領），往外下方斜
    cl = kit.loft('a18Collar', [S(V((0, F.y(1.05), -0.012)), F.cx * 0.52, F.cz * 0.64),
                               S(V((0, F.y(1.0), -0.014)), F.cx * 0.7, F.cz * 0.84),
                               S(V((0, F.y(0.93), -0.012)), F.cx * 0.86, F.cz * 0.98)],
                  n=18, cap0=None, cap1=None, gap=lambda i: (0.5, 0.62, 0.78)[i])
    cl = kit.subsurf(cl, 2, solidify=0.006)
    out.append(kit.tag(cl, denim, grp=G_NECK, ol=0.7))
    return out


def a18_frill(F, denim, ka):
    """袖孔的荷葉邊（GK 第一輪，參考 01／04 FRS：無袖背心的袖孔一圈往外翻的波浪布邊）：套在上臂根部的短喇叭管，
    外側（遠離身體）翻得多、腋下那側幾乎不翻，下緣波浪起伏。綁骨群組同袖子（G_ARM_L），抬手時跟著上臂。"""
    r0 = 0.084 * ka + 0.007
    flare = lambda th: (1 + 0.14 * (1 + math.cos(th)) / 2) * (1 + 0.16 * math.sin(7 * th))
    o = limb('a18FrillL', F.sh, F.da, [(-0.02, r0 * 0.98, r0 * 0.96), (0.008, r0, r0 * 0.98), (0.036, r0 * 1.03, r0, flare)], n=42, cap0=None, cap1=None)
    o = kit.subsurf(o, 1, solidify=0.006)
    kit.tag(o, denim, grp=G_ARM_L, ol=0.6)
    # 上緣（埋在背心袖孔裡）不描外框：開口管從上方看得到管內，對面那片的外框反殼是黑的，肩頂各露出一塊黑斑
    kit.paint_ol(o, lambda co: 0.6 * smooth((arm_s(F, co) - 0.005) / 0.02))
    return o


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
    # GK 第一輪：窄裙（裙襬寬 0.33 m）和大腿之間只剩 1～2 cm，跨步時大腿從裙身中段穿出一塊深藍色；
    # 漸變改成從皮帶下 2 cm 開始、到髖關節下 10 cm 就全量跟大腿（舊版到髖關節下 22 cm，裙身中段只跟大腿一半）
    y0, y1 = F.y(0.176) - 0.02, F.L - 0.1   # 裙頭 → 裙身
    xw = F.R['hip'] * 0.8                # 左右大腿交叉的半寬

    def fn(co, old):
        old = [('hips' if b in ('thL', 'thR') else b, w) for b, w in old]   # 骨熱給裙頭的大腿份量併回骨盆
        a = smooth((y0 - co.y) / (y0 - y1))
        sl = smooth(0.5 + co.x / (2 * xw))
        k = 0.95 * a
        acc = {'thL': k * sl, 'thR': k * (1 - sl), 'hips': a - k}
        for b, w in old:
            acc[b] = acc.get(b, 0.0) + w * (1 - a)
        # 擺動鏈：後片、兩腿之間，依高度從 skirt0 交給 skirt1
        t = (h0.y - co.y) / (h0.y - t1.y)
        # GK 第二輪：0.45→0.15。擺動鏈不跟腿，施法、跑步時腿往後擺，後片中央留在原地，裙襬右後方露出內搭褲、下襬折成階梯
        c = 0.15 * smooth(-co.z / (F.cz * 0.9)) * smooth(t * 3.0) * (1 - abs(2 * sl - 1)) ** 2
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


def a18_bob(name, F, pal, scale=1.14, thick=0.09, pal_part=None):
    """鮑伯頭（GK 第二輪，參考 01／04 FRS 正面、03 FRS 背面、05 SEW 正面）。單位球座標（變形前）：y 上、z 前、x 角色左側。
    - 側分線在角色左側（φ≈0.32 rad，φ＝atan2(x, z)，0＝正前方）：分線右側的頭髮蓬起、斜掃過額頭蓋到右眉上；
      分線左側沿太陽穴往後梳、塞在左耳後（參考 01／05／06：左耳和耳環露出來）。
    - 臉的開口（髮際）是 φ 的連續曲線，各段以平滑最大值接起來：第一輪用 min／max 疊平面場，臉頰與太陽穴開出直角的矩形缺口。
    - 兩側幾乎鉛直、髮尾在下巴下約 3 cm：前側髮尾往下巴內收、後腦的髮尾略往外蓬（參考 03）；第一輪從太陽穴以下一路收 7%，背面是燈泡形。
    - 髮尾一束束收成鈍尖（下緣依 φ 起伏），束與束之間有往下的溝紋；分線是一道窄凹槽（56° 俯角看得到側分）。
    - 髮尾的殼變薄（加厚量往下緣漸減），下緣不再是一刀切齊的厚板。
    背面那條鋸齒狀的「閃電」暗部：第一輪的縱向拉伸在赤道直接換斜率（頭頂 1.1、下半 1.75），法線在那一圈不連續，
    背面整片接近明暗交界（N·L≈0），卡通暗部沿那圈折成鋸齒；改成斜率平滑過渡（ystretch），網格也加密（cuts 20＋細分一次）。"""
    c, hr = F.c, F.hr
    cap = kit.quad_sphere(name, 1.0, cuts=20)
    phi_p = 0.32         # 分線
    phi_r = -1.15        # 右側髮片的前緣（蓋住顴骨外側的臉頰；之後 hx 0.88 橫向壓窄，實際約 −1.05 rad）
    phi_l = 1.82         # 左側塞到耳後：開口一路開到耳朵後緣
    n_st = 16            # 一圈的髮束數（背面約 8 束，參考 03）

    def smax(a, b, k=0.1):
        return 0.5 * (a + b + math.sqrt((a - b) ** 2 + k * k))

    def phi(co):
        return math.atan2(co.x, co.z)

    def top(f):
        """髮際高度（單位球的 y）：分線處最高；往右是斜掃過額頭的瀏海下緣（略往下凸的弧），往左沿太陽穴降到耳朵上緣。"""
        if f < phi_p:
            d = phi_p - f
            return 0.54 - 0.5 * d + 0.13 * d * d
        d = f - phi_p
        return 0.54 - 0.28 * d - 0.22 * max(0.0, d - 0.85) ** 1.3

    def opening(co):
        f = phi(co)
        side = smax(phi_r - f, f - phi_l, 0.06)
        return smax(co.y - top(f), side, 0.14)
    kit.iso_cut(cap, opening)
    kit.cut(cap, lambda co, n: opening(co) < 0)

    def strand(f):
        """髮束的相位：0＝束與束的交界（溝），1＝一束的中線（髮尖）。"""
        fr = (n_st * f / (2 * math.pi) + 0.5) % 1.0
        return 1.0 - abs(fr - 0.5) * 2

    def y_end(co):
        f = phi(co)
        back = 0.5 - 0.5 * math.cos(f)              # 0＝正前方、1＝正後方
        return -0.6 + 0.03 * back - 0.05 * strand(f) ** 1.6
    kit.iso_cut(cap, lambda co: co.y - y_end(co))
    kit.cut(cap, lambda co, n: co.y < y_end(co))

    def ystretch(y):
        """縱向拉伸：頭頂約 1.06 倍、下半約 1.82 倍，中間（±0.3）的斜率平滑過渡。第一輪在赤道直接換斜率（分段線性），
        法線在那一圈不連續，背面接近明暗交界的地方卡通暗部沿那圈折成鋸齒狀的「閃電」。"""
        n = 24
        acc = 0.0
        for i in range(n):
            t = y * (i + 0.5) / n
            acc += 1.822 + (1.057 - 1.822) * smooth((t + 0.3) / 0.6)   # 斜率配到頭頂（y＝1）與髮尾（y＝−0.6）的高度和第一輪相同
        return acc * y / n

    def dfm(p):
        f = phi(p)
        back = 0.5 - 0.5 * math.cos(f)
        y = ystretch(p.y)          # 頭頂蓬高、下半往下拉長到下巴
        t = -p.y
        tip = smooth((t - 0.42) / 0.2)
        # 太陽穴略鼓、兩側鉛直；髮尾：前側往下巴內收、後腦略往外蓬
        k = 1 + 0.045 * bump(t, 0.1, 0.3) + tip * (0.035 * back - 0.05 * (1 - back) ** 2)
        k *= 1 + 0.1 * smooth(p.y / 0.7)   # 頭頂寬而平（參考 05 SEW）
        # 髮束之間的溝：只在下半段（耳朵以下）漸深到髮尾。整顆頭都刻溝時，背面整片接近明暗交界（N·L≈0），
        # 溝的法線起伏把卡通暗部推成一塊塊斑點；上半段保持光滑，交界是一條平順的弧
        k *= 1 - 0.03 * (1 - strand(f)) ** 4 * smooth((-0.12 - p.y) / 0.33)
        # 分線右側的瀏海蓬起（往右眉斜掃的一大片），分線本身一道窄凹槽，從前額髮際往後到頭頂
        dz = p.z
        xp = 0.3 * smooth((dz + 0.35) / 0.8)
        part = math.exp(-((p.x - xp) / 0.05) ** 2) * smooth((p.y - 0.45) / 0.2) * smooth((dz + 0.1) / 0.3)   # 只到頭頂：伸到後腦時，背面的明暗交界在凹槽處折一個缺口
        sweep = smooth((xp - p.x) / 0.25) * smooth((dz - 0.0) / 0.5) * bump(p.y, 0.55, 0.45)
        k *= 1 - 0.07 * part + 0.03 * sweep   # 分線凹槽深 7%（56° 俯角才看得到側分）
        return c + V((p.x * hr * 0.82 * scale * k, y * hr * 0.9 * scale + hr * 0.1, p.z * hr * 0.84 * scale * k - hr * 0.06))
    kit.deform(cap, dfm)
    cap = kit.subsurf(cap, 1)   # 細分一次：分線的色界與髮尾的溝紋在 cuts 20 的粗網格上會切成鋸齒
    # 加厚：髮尾 6 cm 內漸薄到三成（頂點群組控制 solidify 的厚度），下緣是薄的髮梢而不是厚板
    y0 = min(v.co.y for v in cap.data.vertices)
    vg = cap.vertex_groups.new(name='th')
    for v in cap.data.vertices:
        vg.add([v.index], 0.3 + 0.7 * smooth((v.co.y - y0 - 0.006) / 0.06), 'REPLACE')
    m = cap.modifiers.new('sol', 'SOLIDIFY')
    m.thickness = hr * thick
    m.offset = -1.0
    m.use_even_offset = True
    m.use_rim = True
    m.vertex_group = 'th'
    m.thickness_vertex_group = 0.3
    cap = kit.bake(cap)
    cap.vertex_groups.clear()
    cap['fit_skull'] = (0.003, hr * thick)
    kit.tag(cap, pal, mat=1, grp=G_FREE, ol=0.9)
    if pal_part is not None:
        # 分線畫成一道稍深的髮色細線（約 9 mm 寬，從前額髮際到頭頂）：凹槽在卡通著色下只有碰到明暗交界才看得出來，
        # 遊戲 56° 俯角的頭頂是一整個光滑圓殼、看不到側分（第二輪驗收 g-game）。座標換回頭頂一帶的單位球（頭頂寬 1.08 倍）
        sx, sy, sz = hr * 0.82 * scale * 1.08, hr * 0.9 * scale, hr * 0.84 * scale * 1.08

        def part_line(co):
            ux, uy, uz = (co.x - c.x) / sx, (co.y - c.y - hr * 0.1) / sy, (co.z - c.z + hr * 0.06) / sz
            if uy < 0.45 or uz < -0.12:
                return 1.0
            return abs(ux - 0.3 * smooth((uz + 0.35) / 0.8)) - 0.028 * smooth((uz + 0.12) / 0.25)
        kit.paint_field(cap, part_line, pal_part, 1)
    return cap


def a18_hair():
    """鮑伯頭上的髮束：瀏海與側分都已經做在 a18_bob 的殼上（第一輪的三撮尖髮束從額頭斜插到右眼角、像一根尖刺，
    第三撮的髮尾在下巴下方露出一塊黃色方塊）；只留分線右側兩片貼著殼的寬髮片，加強瀏海往右眉掃的層次。"""
    return [
        ((0.22, 0.9, 0.42), (-0.62, 0.2, 0.82), 0.5, 0.07, (-0.04, 0.14, 0.24), 0.55),
        ((0.02, 0.84, 0.58), (-0.86, 0.02, 0.6), 0.42, 0.065, (-0.12, 0.1, 0.24), 0.55),
    ]
