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
        # （03 GK 15.3、01 立繪 16、悟空 14.3），下半臉長了約兩成。face_len 1→0.72：眼線與顱骨不動、下巴往上收約 3.6 cm；
        # 頭因此整顆往下放 2.2 cm（models-heroes.js 的 H、neck），脖子不會變長。
        # muzzle 0.75、nose 0.7（同悟空）：底模的上下唇與鼻底在臉縮短後擠成一道深色的咬牙形（正面描成一撇鬍子），和臉部貼花的嘴疊成兩張嘴
        h = anime_head('head_' + form, F, skin, jaw=0.98, chin=0.95, face_len=0.72, muzzle=0.75, nose=0.7)
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
        (0.07, 0.08 * ka + e, 0.08 * ka + e, flat(0.04)),
        (0.15, 0.076 * ka + e, 0.079 * ka + e),
        (up - 0.04, 0.068 * ka + e, 0.07 * ka + e),
        (up + 0.02, 0.068 * kf + e * 1.1, 0.066 * kf + e * 1.1),
        (up + 0.12, 0.064 * kf + e * 1.1, 0.058 * kf + e * 1.1),
        (s_end - 0.03, 0.056 * kf + e * 1.2, 0.05 * kf + e * 1.2),
        (s_end, 0.055 * kf + e * 1.2, 0.049 * kf + e * 1.2),
    ]
    sl = limb('sleeveL', F.sh, F.da, st, n=14, cap0='pole', cap1=None)
    sl = kit.subsurf(sl, 2, solidify=thick)
    sl['hollow'] = (0.06, s_end - 0.06)   # 換真人身體時，袖子裡的底模手臂整段刪掉（realbody.hollow_mask）
    sl['fit_lim'] = 0.01
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
