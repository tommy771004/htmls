# 鞋子（short.md 的 F-01～F-15）：wear.py 用 exec 載入（排在 wear_socks.py 之後，用襪子的 leg_a、褲子的 above）
# 鞋面是身體鞋區（people.py 投影過的圓頭鞋楦，帶 foot／ball 權重，跑步時在前掌彎折）長出來的殼，靴子再加小腿區；
# 穿上鞋子時身體原本的鞋整區不畫（uCov.w 的 4），所以殼可以比鞋楦小（尖頭、細長的皮鞋往內收）。
# 鞋底沿鞋面下緣那圈（shell 的 ctx['rim']）往外、往下長到地面，鞋跟柱、鞋帶、扣環是 extra。
# 厚底與高跟：40-people.js 的 poseOne 把骨盆往上抬 lift、腳掌繞左右軸往下壓 flex（腳趾反轉回來，前掌貼地）。
# 這裡先把骨架擺成同一個姿勢、照擺好的身體做鞋（地面 z = 0、鞋跟柱垂直），再用線性蒙皮的反矩陣換回綁定姿勢；
# lift／flex 寫在物件的自訂屬性（glTF extras），前端照它擺，兩邊不用各寫一份數字。
# 低筒鞋與涼鞋露出來的腳是 W_foot（UBC 原始身體有腳趾的腳，部位 skin；40-people.js 畫膚色，穿襪子時照那雙襪子的顏色與圖案）。

from mathutils import Matrix, Quaternion

_UBC = os.path.join(os.environ.get('QUATERNIUS_CACHE') or os.path.normpath(os.path.join(ROOT, '../197-openworld/.cache')),
                    'ubc/Universal Base Characters[Standard]/Base Characters/Godot - UE/Superhero_{}_FullBody.gltf')


def _rest(arm):
    """骨架回到綁定姿勢（匯入的 people.glb 停在動畫的第一格）"""
    arm.animation_data_clear()
    for pb in arm.pose.bones:
        pb.rotation_mode = 'QUATERNION'
        pb.rotation_quaternion = (1, 0, 0, 0)
        pb.location = (0, 0, 0)
        pb.scale = (1, 1, 1)


def _local(arm, bn, v):
    """世界座標的向量換成骨頭 bn 綁定姿勢的局部座標"""
    return arm.data.bones[bn].matrix_local.to_3x3().inverted() @ (arm.matrix_world.to_3x3().inverted() @ v)


def shoe_pose(F, lift, flex):
    """骨盆往上 lift；兩腳 foot 繞世界 X 軸轉 flex（正的腳尖往下）、ball 轉回 -flex（前掌照原本的方向貼地）"""
    arm = F.arm
    _rest(arm)
    if lift:
        arm.pose.bones['pelvis'].location = _local(arm, 'pelvis', Vector((0, 0, lift)))
    if flex:
        for s in 'lr':
            for bn, a in ((f'foot_{s}', flex), (f'ball_{s}', -flex)):
                arm.pose.bones[bn].rotation_quaternion = Quaternion(_local(arm, bn, Vector((1, 0, 0))).normalized(), a)
    bpy.context.view_layer.update()


class PFig(Fig):
    """擺好姿勢的身體（shell、_reweight 照它做）；B 還是綁定姿勢的骨頭位置，P 是擺好之後的"""

    def __init__(self, F, lift=0., flex=0.):
        self.g, self.arm, self.ox, self.top, self.B = F.g, F.arm, F.ox, F.top, F.B
        self.lift, self.flex = lift, flex
        shoe_pose(F, lift, flex)
        dg = bpy.context.evaluated_depsgraph_get()
        me = bpy.data.meshes.new_from_object(F.body.evaluated_get(dg), preserve_all_data_layers=True, depsgraph=dg)
        o = bpy.data.objects.new(f'{F.body.name}_posed', me)
        o.matrix_world = F.body.matrix_world.copy()
        for vg in F.body.vertex_groups:
            o.vertex_groups.new(name=vg.name)
        self.body = o
        self.P = {pb.name: F.arm.matrix_world @ pb.head for pb in F.arm.pose.bones}
        _rest(F.arm)


def _unpose(o, F, lift, flex):
    """擺好姿勢做的殼換回綁定姿勢：每個頂點的蒙皮矩陣（權重加權）求反矩陣"""
    shoe_pose(F, lift, flex)
    aw = F.arm.matrix_world
    awi = aw.inverted()
    S = {pb.name: aw @ pb.matrix @ pb.bone.matrix_local.inverted() @ awi for pb in F.arm.pose.bones}
    names = [vg.name for vg in o.vertex_groups]
    for v in o.data.vertices:
        M, t = Matrix.Diagonal((0, 0, 0, 0)), 0.
        for gr in v.groups:
            if gr.weight > 0:
                M = M + S[names[gr.group]] * gr.weight
                t += gr.weight
        if t > 0:
            v.co = (M * (1. / t)).inverted_safe() @ v.co
    o.data.update()
    _rest(F.arm)


class Last:
    """擺好姿勢的鞋楦（身體鞋區）沿前後每 5 mm 一格量：左腳（+x）離中線的內外側、最高、最低；右腳左右對稱"""

    def __init__(self, PF):
        me, mw = PF.body.data, PF.body.matrix_world
        names = [m.name for m in me.materials]
        vs = {i for p in me.polygons if names[p.material_index].endswith('shoe') for i in p.vertices}
        pts = [mw @ me.vertices[i].co for i in vs]
        pts = [Vector((p.x - PF.ox, p.y, p.z)) for p in pts if p.x > PF.ox]
        self.ox = PF.ox
        self.y0, self.y1 = min(p.y for p in pts), max(p.y for p in pts)     # 鞋尖、後跟
        self.n = int((self.y1 - self.y0) / .005) + 1
        acc = [[9., -9., 9., -9.] for _ in range(self.n)]
        for p in pts:
            a = acc[min(self.n - 1, int((p.y - self.y0) / .005))]
            a[0], a[1], a[2], a[3] = min(a[0], p.x), max(a[1], p.x), min(a[2], p.z), max(a[3], p.z)
        for k in range(self.n):
            if acc[k][0] > 8:
                acc[k] = list(acc[k - 1] if k else next(a for a in acc if a[0] < 8))
        # 每格的極值會跳（鞋區的三角形大小不一）：前後各兩格平均，照它切的鞋口才不會一格一格鋸齒
        for _ in range(3):
            acc = [[sum(acc[max(0, min(self.n - 1, k + d))][i] for d in (-1, 0, 1)) / 3 for i in range(4)] for k in range(self.n)]
        self.acc = acc

    def at(self, y):
        """(內側 x, 外側 x, 最低 z, 最高 z)，x 是離中線的距離"""
        t = max(0., min(self.n - 1.001, (y - self.y0) / .005 - .5))
        k = int(t)
        u = t - k
        a, b = self.acc[k], self.acc[min(k + 1, self.n - 1)]
        return tuple(a[i] * (1 - u) + b[i] * u for i in range(4))

    def mid(self, y):
        a = self.at(y)
        return (a[0] + a[1]) * .5

    def hw(self, y):
        a = self.at(y)
        return (a[1] - a[0]) * .5

    def bot(self, y):
        return self.at(y)[2]

    def tip(self, y):
        """0 後跟 → 1 鞋尖"""
        return (self.y1 - y) / (self.y1 - self.y0)

    def side(self, p):
        """p 在腳的哪一側：+1 外側、-1 內側（左右腳都一樣）；離中線多遠（相對半寬）"""
        x = abs(p.x - self.ox)
        m, h = self.mid(p.y), self.hw(p.y)
        return (x - m) / max(h, 1e-4)


def _outline(edges, zcut, ox):
    """鞋面下緣（切在 zcut 上的那些邊）每隻腳一圈：照繞腳掌中心的角度排（腳的輪廓從中心看出去是單調的；
    兩個切面交會的地方有細碎的邊，串邊會斷）"""
    out = []
    for s in (1, -1):
        pts = {}
        for a, b in edges:
            for p in (a, b):
                if (p.x - ox) * s > 0 and abs(p.z - zcut(p)) < .004:
                    pts[(round(p.x, 4), round(p.y, 4))] = p
        pts = list(pts.values())
        if len(pts) < 12:
            continue
        c = sum(pts, Vector()) / len(pts)
        pts.sort(key=lambda p: math.atan2(p.y - c.y, p.x - c.x))
        out.append(pts)
    return out


def _resample(loop, step=.004, smooth=2):
    """封閉的環照弧長重新取點、抹平（切口沿三角形走，有細碎的折角）"""
    L = [(loop[(i + 1) % len(loop)] - loop[i]).length for i in range(len(loop))]
    tot = sum(L)
    n = max(24, int(tot / step))
    out, acc, i = [], 0., 0
    for k in range(n):
        s = tot * k / n
        while acc + L[i] < s:
            acc += L[i]
            i += 1
        t = (s - acc) / max(L[i], 1e-9)
        out.append(loop[i].lerp(loop[(i + 1) % len(loop)], t))
    for _ in range(smooth):
        out = [out[k] * .5 + (out[k - 1] + out[(k + 1) % n]) * .25 for k in range(n)]
    # 由上往下看逆時針
    area = sum(out[k].x * out[(k + 1) % n].y - out[(k + 1) % n].x * out[k].y for k in range(n))
    return out if area > 0 else out[::-1]


def _out2(loop):
    """逆時針環每一點往外的水平方向"""
    n = len(loop)
    res = []
    for k in range(n):
        t = loop[(k + 2) % n] - loop[k - 2]
        d = Vector((t.y, -t.x, 0.))
        res.append(d.normalized() if d.length > 1e-9 else Vector((1, 0, 0)))
    return res


def tube_loop(bm, pts, r, seg=8, rz=1.):
    """沿封閉的環掃一個圓（鞋口滾邊）；rz：斷面上下的比例（扁的滾邊 < 1）"""
    n, rows = len(pts), []
    for i, p in enumerate(pts):
        t = (pts[(i + 1) % n] - pts[i - 1]).normalized()
        u = t.cross(Vector((0, 0, 1)))
        u = u.normalized() if u.length > 1e-4 else Vector((1, 0, 0))
        w = t.cross(u)
        rows.append([bm.verts.new(p + (u * math.cos(k / seg * 2 * math.pi) + w * math.sin(k / seg * 2 * math.pi) * rz) * r) for k in range(seg)])
    rows.append(rows[0])
    _skin(bm, rows)


def _chains(rim):
    """切口的邊（ctx['rim'] 的端點對）串成一圈一圈：照端點位置接起來，每圈照順序排好（封閉的頭尾相接）"""
    key = lambda p: (round(p.x, 5), round(p.y, 5), round(p.z, 5))
    adj, co = {}, {}
    for a, b in rim:
        ka, kb = key(a), key(b)
        if ka == kb:
            continue
        co[ka], co[kb] = a, b
        adj.setdefault(ka, []).append(kb)
        adj.setdefault(kb, []).append(ka)
    seen, out = set(), []
    for k0 in adj:
        if k0 in seen:
            continue
        path, prev, k = [k0], None, k0
        seen.add(k0)
        while True:
            nx = next((n for n in adj[k] if n != prev and n not in seen), None)
            if nx is None:
                break
            seen.add(nx)
            path.append(nx)
            prev, k = k, nx
        out.append([co[q] for q in path])
    return out


def collar_roll(bm, trim, rim, zc, ox, r, part, rz=1., lo=.015, minlen=.12):
    """鞋口一圈滾邊：鞋面上緣（切口那圈，比鞋面下緣高 lo 以上、周長超過 minlen 的那幾圈；鞋面上的小破洞不算）沿著邊排好、抹平，
    管子一半在鞋面外、一半在裡面，把切口細碎的邊包起來（鞋底包住鞋面下緣是同一個道理）"""
    for ch in _chains(rim):
        if len(ch) < 12 or sum(p.z - zc(p) for p in ch) / len(ch) < lo:
            continue
        if sum((ch[i + 1] - ch[i]).length for i in range(len(ch) - 1)) < minlen:
            continue
        P = _resample(ch, step=.003, smooth=4)
        N = _out2(P)
        with _part(bm, trim, part):
            tube_loop(bm, [q - N[k] * r * .35 - Vector((0, 0, r * .25)) for k, q in enumerate(P)], r, seg=8, rz=rz)


def _cap(bm, ring, up):
    """把一圈頂點封成面：從上往下看（XY）切三角形，高跟鞋的鞋底前低後高也不會翻面；up：法線朝上"""
    from mathutils.geometry import tessellate_polygon
    tris = tessellate_polygon([[Vector((v.co.x, v.co.y, 0.)) for v in ring]])
    for a, b, c in tris:
        f = bm.faces.new((ring[a], ring[b], ring[c]))
        f.normal_update()
        if (f.normal.z > 0) != up:
            f.normal_flip()


def _band(bm, trim, a, b, part, outward):
    """兩圈頂點之間的一圈面；outward(k) 是那一點往外的方向（決定面朝哪邊）"""
    n = len(a)
    fs = [bm.faces.new((a[k], a[(k + 1) % n], b[(k + 1) % n], b[k])) for k in range(n)]
    for f in fs:
        f.normal_update()
    if sum(f.normal.dot(outward(k)) for k, f in enumerate(fs)) < 0:
        for f in fs:
            f.normal_flip()
    for v in set(a) | set(b):
        v[trim] = PART[part] if isinstance(part, str) else part
    return fs


def sole(bm, trim, loops, prof, zbot, insole='b', zcut=None, lip=.004):
    """鞋底：鞋面下緣那圈 loop 往外 prof、往下到 zbot(p)（地面是 0）。
    prof：[(u, 往外, 部位)]，u 0 是鞋面下緣、1 是鞋底；相鄰兩列之間的面用後一列的部位（換部位的地方頂點拆開，顏色不會內插）。
    u 與往外都可以是 f(p)（波浪的分層、鞋頭包得比較寬的杯底）。insole：鞋墊（從鞋口看得到）的部位。
    lip：鞋底上緣往上、往裡多長一圈藏進鞋面（鞋面下緣切過三角形、往內折過，邊是細碎的，從鞋底上面露出白色的鋸齒）"""
    for loop in loops:
        P = _resample(loop)
        N = _out2(P)
        zb = [zbot(p) for p in P]
        def ring(u, o, dz=0.):
            out = []
            for k, p in enumerate(P):
                uu = u(p) if callable(u) else u
                out.append(bm.verts.new(Vector((p.x, p.y, p.z * (1 - uu) + zb[k] * uu + dz)) + N[k] * (o(p) if callable(o) else o)))
            return out
        prev = ring(prof[0][0], prof[0][1])
        top = prev
        if lip:
            top = ring(prof[0][0], (prof[0][1] if not callable(prof[0][1]) else 0.) - .0025, lip)
            _band(bm, trim, top, prev, prof[1][2], lambda k: N[k])
        for (u, o, part), (u0, o0, part0) in zip(prof[1:], prof):
            if part != part0:
                prev = ring(u0, o0)
            cur = ring(u, o)
            _band(bm, trim, prev, cur, part, lambda k: N[k])
            prev = cur
        _cap(bm, prev, False)
        _cap(bm, top, True)
        for v in top:
            v[trim] = PART[insole]


def heel_post(bm, trim, top, bot, rt, rb, seg=20, rows=10, sq=2., bend=0., tilt=0., part='b'):
    """鞋跟柱：上面接後跟（中心 top、半徑 rt = (左右, 前後)），往下到 bot（地面）縮成 rb；sq 斷面的方圓（2 圓、越大越方）、bend 柱身往後彎的量；
    tilt：頂面跟著後跟的鞋底往前斜（壓了腳掌的鞋底是斜的），往下到地面變成平的"""
    rings = []
    for r in range(rows + 1):
        t = r / rows
        c = top.lerp(bot, t) + Vector((0., bend * math.sin(t * math.pi), 0.))
        rx, ry = rt[0] + (rb[0] - rt[0]) * t ** .7, rt[1] + (rb[1] - rt[1]) * t ** .7
        ring_ = []
        for k in range(seg):
            a = k / seg * 2 * math.pi
            ca, sa = math.cos(a), math.sin(a)
            e = 2. / sq
            dy = math.copysign(abs(sa) ** e, sa) * ry
            ring_.append(bm.verts.new(c + Vector((math.copysign(abs(ca) ** e, ca) * rx, dy, math.tan(tilt) * dy * (1 - t) ** 2))))
        rings.append(ring_)
    for a, b in zip(rings, rings[1:]):
        c = sum((v.co for v in a), Vector()) / len(a)
        _band(bm, trim, a, b, part, lambda k, a=a, c=c: (a[k].co - c).normalized())
    _cap(bm, rings[0], True)
    _cap(bm, rings[-1], False)
    for v in rings[0] + rings[-1]:
        v[trim] = PART[part] if isinstance(part, str) else part


def surf(PF, x, y, dz=.0):
    """擺好姿勢的鞋楦從上往下打到的點與法線（鞋帶、扣環貼著鞋面放）"""
    tree = _body_bvh(PF)[0]
    hit = tree.ray_cast(Vector((x, y, .6)), Vector((0, 0, -1)), 1.)
    return (hit[0], hit[1]) if hit[0] is not None else (Vector((x, y, dz)), Vector((0, 0, 1)))


def surf_side(PF, x0, y, z, s):
    """從腳的側面（s：+1 往 +x 那側）往內打到的點與法線"""
    tree = _body_bvh(PF)[0]
    hit = tree.ray_cast(Vector((x0 + s * .4, y, z)), Vector((-s, 0, 0)), .8)
    return (hit[0], hit[1]) if hit[0] is not None else (Vector((x0, y, z)), Vector((s, 0, 0)))


def build_foot(F, g):
    """W_foot：原始身體腳踝切面往上 3 cm 以下的腳（有腳趾）。上緣藏在小腿區底下（40-people.js 把鞋口滾邊那排藏掉），往內 1 mm 不和皮膚打架。
    權重照原始身體（同一副骨架、同名骨頭）；腳指甲是貼在趾尖上的薄片（部位 nail）"""
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=_UBC.format(g))
    new = [o for o in bpy.data.objects if o not in before]
    src = max((o for o in new if o.type == 'MESH'), key=lambda o: len(o.data.vertices))
    an, ball = F.b('foot_l'), F.b('ball_l')
    co, no = Vector((F.ox, an.y, an.z + .052)), Vector((0., -.14, 1.)).normalized()   # people.py 的腳踝切面
    bm = bmesh.new()
    bm.from_mesh(src.data)
    bm.transform(Matrix.Translation(Vector((F.ox, 0, 0))) @ src.matrix_world)
    names = [vg.name for vg in src.vertex_groups]
    bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=co + no * .03, plane_no=no, clear_outer=True, dist=1e-5)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces or v.co.z > co.z + .1], context='VERTS')
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    # 原始的腳底比鞋楦底低 1.2 cm（陷進地面）：5 cm 以下往上壓到鞋楦底；腳趾往腳跟縮 6 mm、壓扁一點（鞋楦是包著腳趾投影的，趾尖會頂出鞋頭）
    for v in bm.verts:
        p = v.co
        t = max(0., min(1., (ball.y - p.y) / .07))
        p.y += .006 * t
        p.z = .002 + (p.z - .002) * (1 - .12 * t)
        if p.z < .05:
            p.z += .012 * (1 - max(p.z, -.012) / .05) * min(1., (.05 - p.z) / .05 + .2)
    bm.normal_update()
    for v in bm.verts:
        v.co -= v.normal * .001
    trim = bm.verts.layers.float.new('_trim')
    for v in bm.verts:
        v[trim] = PART['skin']
    # 指甲：每隻腳前緣 2 mm 一格找最往前的點，局部最前面的就是趾尖（五個）；指甲貼在趾尖往後、從上往下打到的地方
    from mathutils.bvhtree import BVHTree
    tree = BVHTree.FromBMesh(bm)
    with _part(bm, trim, 'nail'):
        for s in (1, -1):
            fv = [v.co for v in bm.verts if (v.co.x - F.ox) * s > .03 and v.co.z < .05]
            x0, x1 = min(abs(p.x - F.ox) for p in fv), max(abs(p.x - F.ox) for p in fv)
            cols = {}
            for p in fv:
                k = int((abs(p.x - F.ox) - x0) / .002)
                if k not in cols or p.y < cols[k].y:
                    cols[k] = p
            ks = sorted(cols)
            tips = [cols[k] for i, k in enumerate(ks) if all(cols[k].y <= cols[j].y for j in ks if abs(j - k) <= 3)]
            tips = sorted(tips, key=lambda p: p.y)[:5]
            for p in tips:
                big = p is tips[0]
                w, l = (.0062, .0068) if big else (.0034, .0036)
                hit = tree.ray_cast(Vector((p.x, p.y + l * .9, .3)), Vector((0, 0, -1)), 1.)
                if hit[0] is None:
                    continue
                c, n = hit[0] + hit[1] * .0006, hit[1]
                rows = []
                for r in range(4):
                    t = r / 3
                    row = []
                    for k in range(10):
                        a = k / 10 * 2 * math.pi
                        row.append(bm.verts.new(c + Vector((math.cos(a) * w * (1 - .55 * t ** 2), math.sin(a) * l * (1 - .55 * t ** 2), .0005 * t))))
                    rows.append(row)
                _skin(bm, rows, cap=tuple(c + Vector((0, 0, .0007))))
    me = bpy.data.meshes.new(f'W_foot_{g}')
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = True
    o = new_obj(f'W_foot_{g}', me, F)
    # 原始身體的權重（指甲取最近的腳的頂點）
    from mathutils.kdtree import KDTree
    sv = [(src.matrix_world @ v.co) + Vector((F.ox, 0, 0)) for v in src.data.vertices]
    kd = KDTree(len(sv))
    for i, p in enumerate(sv):
        kd.insert(p, i)
    kd.balance()
    for v in me.vertices:
        _, i, _ = kd.find(v.co)
        for gr in src.data.vertices[i].groups:
            if gr.weight > 1e-4:
                o.vertex_groups[names[gr.group]].add([v.index], gr.weight, 'REPLACE')
    for ob in new:
        bpy.data.objects.remove(ob, do_unlink=True)
    F.wfoot = o
    return o


def tighten(PF, F, lift, flex, gap=.004):
    """people.py 把鞋區的後跟往外鼓了 1.75 cm、鞋口滾邊那圈 1.15 cm（給沒換裝的角色一雙圓鞋），鞋面照它長，後跟鼓成一包、
    鞋口離阿基里斯腱很遠，和小腿的交界皺成一圈。前掌以後、離腳底 2.5 cm 以上的鞋區頂點，離真的腳（W_foot，擺同一個姿勢）超過 gap
    的沿法線收回到 gap；前掌（圓頭鞋楦）與鞋底的輪廓不動"""
    from mathutils.bvhtree import BVHTree
    shoe_pose(F, lift, flex)
    dg = bpy.context.evaluated_depsgraph_get()
    fe = F.wfoot.evaluated_get(dg)
    fm = fe.to_mesh()
    fw = F.wfoot.matrix_world
    tree = BVHTree.FromPolygons([fw @ v.co for v in fm.vertices], [tuple(p.vertices) for p in fm.polygons])
    fe.to_mesh_clear()
    ball_y = PF.P['ball_l'].y
    _rest(F.arm)
    me, mw = PF.body.data, PF.body.matrix_world
    mi = mw.inverted()
    names = [m.name for m in me.materials]
    vs = {i for p in me.polygons if names[p.material_index].endswith('shoe') for i in p.vertices}
    z0, an_z = lift + .025, PF.P['foot_l'].z
    mv = {}
    for i in vs:
        q = mw @ me.vertices[i].co
        w = max(0., min(1., (q.y - (ball_y + .03)) / .04)) * max(0., min(1., (q.z - z0) / .02))
        if w <= 0:
            continue
        # 腳踝以上收得更貼（小腿區退回皮膚了，兩邊差太多，交界在腳踝前面折出一道皺痕）
        gp = gap + (.001 - gap) * max(0., min(1., (q.z - (an_z - .01)) / .04))
        loc, n, _, d = tree.find_nearest(q)
        if loc is None or d <= gp or (q - loc).dot(n) < 0:
            continue
        # 沿頂點法線往內收（people.py 就是沿法線鼓出來的）；拉到最近點的話相鄰的頂點會擠在踝骨上，被 shell 焊成一點、破洞
        vn = (mw.to_3x3() @ me.vertices[i].normal).normalized()
        mv[i] = mi @ (q - vn * (d - gp) * w)
    # glTF 在材質交界把頂點拆成兩份：小腿區那一份（鞋口滾邊那圈）也一起移，不然靴筒和鞋面之間裂開
    from mathutils.kdtree import KDTree
    kd = KDTree(len(mv))
    for k, i in enumerate(mv):
        kd.insert(me.vertices[i].co, k)
    kd.balance()
    tg = list(mv.values())
    for v in me.vertices:
        hit = kd.find(v.co)
        if hit[0] is not None and hit[2] < 3e-4:
            v.co = tg[hit[1]]
    me.update()


class Kit:
    """做一雙鞋要用的量測：擺好姿勢的身體 PF、鞋楦 L、鞋面下緣的高度 zc(p)（鞋楦底往上 wrap；前掌一個水平面，
    壓了腳掌的再加後跟一個跟著斜的平面，兩個平面取高的，在前掌後面交成一道折線）、前掌那一面的高度 z1"""

    def __init__(self, F, lift, flex, wrap):
        self.F, self.ox, self.lift, self.flex = F, F.ox, lift, flex
        self.PF = PFig(F, lift, flex)
        if getattr(F, 'wfoot', None):
            tighten(self.PF, F, lift, flex)
        L = self.L = Last(self.PF)
        z1 = self.z1 = min(L.bot(L.y0 + k * .005) for k in range(16)) + wrap
        self.cuts = [(Vector((0, 0, z1)), Vector((0, 0, -1)))]
        if flex:
            yh = L.y1 - .03
            zh, th = L.bot(yh) + wrap, math.tan(flex)
            self.cuts.append((Vector((0, yh, zh)), Vector((0, math.sin(flex), -math.cos(flex)))))
            self.zc = lambda p: max(z1, zh + th * (p.y - yh))
        else:
            self.zc = lambda p: z1

    def surf(self, x, y):
        return surf(self.PF, x, y)


def shoe(F, name, make, lift=0., flex=0., ball=None, slots=('shoe',), wrap=.012, smooth=3, sub=1, rim=.003):
    """一雙鞋：make(K) 回傳這雙的設定 dict——top(p)（以上切掉的鞋口高度）、off(p)（往外推多少，可以是負的）、prof（鞋底斷面，見 sole）、
    zbot(p)（鞋底底面，預設地面 0）、roll（鞋口滾邊 (半徑, 部位[, 上下比例])，見 collar_roll）、fields、patches、regions、heel(bm, trim)（鞋跟柱）、extra(bm, trim)、insole（鞋墊的部位）。
    ball：前掌鞋底的厚度（鞋楦底到地面）；給了就照壓完腳掌之後前掌的高度算 lift（男女的腳不一樣長，各自算）。
    sub：鞋面細分幾次（腳踝的三角形很大，不細分的話鞋口切過去留下細碎的三角形，往內折、推出去皺成一團）"""
    if ball is not None:
        L0 = Last(PFig(F, 0., flex))
        lift = round(ball - min(L0.bot(L0.y0 + k * .005) for k in range(16)), 4)
    K = Kit(F, lift, flex, wrap)
    d = make(K)
    K.off = d['off']
    top, zb = d.get('top', lambda p: 9.), d.get('zbot', lambda p: 0.)

    def ex(bm, trim, ctx):
        sole(bm, trim, _outline(ctx['rim'], K.zc, K.ox), d['prof'], zb, insole=d.get('insole', 'b'))
        if d.get('roll'):
            collar_roll(bm, trim, ctx['rim'], K.zc, K.ox, *d['roll'])
        if d.get('heel'):
            d['heel'](bm, trim)
        if d.get('extra'):
            d['extra'](bm, trim)

    shoe_pose(F, lift, flex)
    o = shell(K.PF, f'W_{name}_{F.g}', list(slots), cuts=K.cuts, off=d['off'], smooth=smooth, rim=rim, sub=sub, part=d.get('part', 0),
              patches=d.get('patches', ()), regions=d.get('regions', ()), fields=[lambda p, ctx: p.z - top(p), *d.get('fields', ())], extra=ex, fill=64)
    if lift or flex:
        _unpose(o, F, lift, flex)
    _rest(F.arm)
    o['lift'], o['flex'] = lift, flex
    return o


def foot_a(F, p):
    """繞腳踝的角度：0 外側、π/2 正面、-π/2 後面、±π 內側（中心是腳踝關節，同襪子的 leg_a 的方向）"""
    cx = F.b('calf_l').x - F.ox
    return math.atan2(-(p.y - F.b('foot_l').y), abs(p.x - F.ox) - cx)


def collar(F, A, side, back, front, kf=3., kb=2.):
    """鞋口高度：側邊 A + side、後跟 A + back、正面 A + front（A 是擺好姿勢的腳踝關節高度）"""
    def top(p):
        a = foot_a(F, p)
        return A + side + (back - side) * max(0., -math.sin(a)) ** kb + (front - side) * max(0., math.sin(a)) ** kf
    return top


def _quat_z(n):
    """把 +Z 轉到 n 的歐拉角（扣環、鞋孔照鞋面法線擺）"""
    return n.to_track_quat('Z', 'Y').to_euler()


def midline(K, y_t, z_top, n):
    """左腳的腳背中線：從鞋喉（y_t）往後從上往下打到鞋楦，到腳踝前面變陡了改從正面打，一直到 z_top；照弧長取 n 個點。
    回傳 [(點, 法線, 切線)]，右腳照 ox 鏡像"""
    tree, L, ox = _body_bvh(K.PF)[0], K.L, K.ox
    pts = []
    y = y_t
    z0 = K.F.b('foot_l').z + K.lift + .12
    while y < K.F.b('foot_l').y - .02:
        # 從腳踝上面 12 cm 往下打（從更高打會先打到膝蓋；從鞋區頂點上面一點打，鞋區的三角形很大，起點會在腳背裡面）
        h = tree.ray_cast(Vector((ox + L.mid(y), y, z0)), Vector((0, 0, -1)), .3)
        if h[0] is not None:
            if h[1].z < .3 or h[0].z < L.bot(y) + .025 or (pts and abs(h[0].z - pts[-1][0].z) > .015):   # 打到小腿、打穿到腳底
                if pts:
                    break
            else:
                pts.append((h[0], h[1]))
        y += .004
    z = pts[-1][0].z + .004 if pts else z_top
    while z < z_top:
        x = ox + L.mid(min(L.y1, max(L.y0, pts[-1][0].y if pts else y_t)))
        h = tree.ray_cast(Vector((x, -.5, z)), Vector((0, 1, 0)), 1.)
        if h[0] is not None:
            pts.append((h[0], h[1]))
        z += .004
    assert len(pts) > 1, ('midline', y_t, z_top)
    # 身體的三角形很大，打到的點左右、前後會抖：抹平，鞋孔才排得整齊
    for _ in range(6):
        pts = [pts[0]] + [((pts[i - 1][0] + pts[i][0] * 2 + pts[i + 1][0]) / 4, (pts[i - 1][1] + pts[i][1] * 2 + pts[i + 1][1]).normalized())
                          for i in range(1, len(pts) - 1)] + [pts[-1]]
    acc = [0.]
    for i in range(1, len(pts)):
        acc.append(acc[-1] + (pts[i][0] - pts[i - 1][0]).length)
    out = []
    for k in range(n):
        t = acc[-1] * k / max(1, n - 1)
        i = max(0, min(len(pts) - 2, next((j for j in range(len(acc) - 1) if acc[j + 1] >= t), len(acc) - 2)))
        u = (t - acc[i]) / max(1e-9, acc[i + 1] - acc[i])
        q = pts[i][0].lerp(pts[i + 1][0], u)
        nn = pts[i][1].lerp(pts[i + 1][1], u).normalized()
        out.append((q, nn, (pts[i + 1][0] - pts[i][0]).normalized()))
    return out


def laces(K, y_t, z_top, n, w0, w1, h, part='c', r=.0018, eyelet='silver', bow=True, er=.0027):
    """鞋帶：腳背中線（midline）兩側 n 對鞋孔（半寬 w0 → w1），離鞋面 h（鞋面是鞋楦往外推 K.off）；交叉穿過、最前面一道橫的，最上面打個蝴蝶結。
    回傳 build(bm, trim)（擺好姿勢的座標）"""
    ox, tree = K.ox, _body_bvh(K.PF)[0]
    ml = midline(K, y_t, z_top, n)
    def build(bm, trim):
        for s in (1, -1):
            mir = lambda v: Vector((ox + s * (v.x - ox), v.y, v.z))
            mirn = lambda v: Vector((s * v.x, v.y, v.z))
            E = []
            for i, (q, nn, tg) in enumerate(ml):
                w = w0 + (w1 - w0) * i / max(1, n - 1)
                side = tg.cross(nn).normalized()
                row = []
                for sd in (-1, 1):
                    c = q + side * sd * w
                    hit = tree.ray_cast(c + nn * .05, -nn, .1)
                    c, cn = (hit[0], hit[1]) if hit[0] is not None else (c, nn)
                    row.append((mir(c + cn * (h + K.off(c))), mirn(cn)))
                E.append(row)
            with _part(bm, trim, part):
                (pa, na), (pb, nb) = E[0]
                tube(bm, [tuple(pa), tuple((pa + pb) * .5 + na * .0015), tuple(pb)], r, seg=6)
                for i in range(n - 1):
                    for a, b in ((0, 1), (1, 0)):
                        (p0, n0), (p1, n1) = E[i][a], E[i + 1][b]
                        up = .0016 if a == 0 else .0028      # 兩條交叉的帶子一上一下
                        tube(bm, [tuple(p0), tuple((p0 + p1) * .5 + (n0 + n1).normalized() * up), tuple(p1)], r, seg=6)
                if bow:
                    (pa, na), (pb, nb) = E[-1]
                    nm = (na + nb).normalized()
                    c = (pa + pb) * .5 + nm * .004
                    for sd in (-1, 1):
                        d = (pb - pa).normalized() * sd
                        ring(bm, c + d * .011, .009, r * .9, rot=_quat_z(nm), seg=14, sseg=5)
                        # 帶尾往兩側垂下，貼著鞋面（打回表面再墊 r）
                        q1, q2 = c + d * .012 - nm * .002, c + d * .02 + Vector((0, 0, -.028))
                        h2 = tree.ray_cast(q2 + nm * .04, -nm, .1)
                        if h2[0] is not None:
                            q2 = h2[0] + h2[1] * (h + r + K.off(h2[0]))
                        tube(bm, [tuple(c), tuple(q1), tuple(q2)], r, seg=6)
            if eyelet:
                with _part(bm, trim, eyelet):
                    for row in E:
                        for q, nn in row:
                            ring(bm, q - nn * (h - .0008), er, .0009, rot=_quat_z(nn), seg=12, sseg=5)
    return build


def yz_stroke(L, pts, w0, w1, sides=(1,), lo=.35):
    """鞋側面（L.side 的外側 +1、內側 -1）沿 (y, z) 折線的一條帶子（≤ 0 在帶子裡）：飛翼標誌、側拉鍊、反光條；寬度從 w0 漸到 w1"""
    seg = list(zip(pts, pts[1:]))
    tot = sum(math.hypot(b[0] - a[0], b[1] - a[1]) for a, b in seg)
    def f(p, ctx):
        sd = L.side(p)
        if not any(sd * k > lo for k in sides):
            return 1.
        best, acc, at = 9., 0., 0.
        for (ay, az), (by, bz) in seg:
            dy, dz = by - ay, bz - az
            l2 = dy * dy + dz * dz
            t = max(0., min(1., ((p.y - ay) * dy + (p.z - az) * dz) / l2))
            d = math.hypot(p.y - ay - dy * t, p.z - az - dz * t)
            if d < best:
                best, at = d, acc + t * math.sqrt(l2)
            acc += math.sqrt(l2)
        return best - (w0 + (w1 - w0) * at / tot)
    return f


class FootFig(Fig):
    """涼鞋、拖鞋的帶子照 W_foot（真的腳）的表面長：把它包成 shell 吃的「身體」（全部算鞋區、沒有鼓起來的分區），往上抬 lift"""

    def __init__(self, F, foot, lift):
        self.g, self.arm, self.ox, self.top, self.B = F.g, F.arm, F.ox, F.top, F.B
        bm = bmesh.new()
        bm.from_mesh(foot.data)
        tl = bm.verts.layers.float.get('_trim')
        bmesh.ops.delete(bm, geom=[v for v in bm.verts if v[tl] > 14.5], context='VERTS')
        bm.verts.layers.float.remove(tl)
        bm.transform(Matrix.Translation(Vector((0, 0, lift))))
        # 細分一次：帶子是照場切的，原本的三角形太大，帶子的邊一格一格的
        bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=1, use_grid_fill=True)
        bmesh.ops.triangulate(bm, faces=[f for f in bm.faces if len(f.verts) > 3])
        me = bpy.data.meshes.new('foot_fig')
        bm.to_mesh(me)
        bm.free()
        me.attributes.new('_UNPUFF', 'FLOAT_VECTOR', 'POINT')
        me.attributes.new('_PMASK', 'FLOAT', 'POINT')
        for sn in SLOT:      # shell 照材質編號挑分區：全部放在鞋區（5）
            me.materials.append(bpy.data.materials.new(f'{F.g}_ff_{sn}'))
        for p in me.polygons:
            p.material_index = SLOT['shoe']
        o = bpy.data.objects.new('foot_fig', me)
        for vg in foot.vertex_groups:
            o.vertex_groups.new(name=vg.name)
        self.body = o


def sandal(F, name, foot, make, ball, smooth=2, rim=.0015):
    """涼鞋、拖鞋：鞋底是鞋楦的腳印往內收 bed_in（腳踩在上面，四周多出幾 mm），帶子照真的腳（W_foot）的表面長。
    make(K, FF) 回傳 off、fields（留下帶子）、prof（鞋底斷面）、bed_in（鞋底比鞋楦小多少）、patches、regions、extra、insole"""
    lift = ball - .002
    K = Kit(F, lift, 0., 0.)
    FF = FootFig(F, foot, lift)
    d = make(K, FF)
    zbed = K.L.bot(K.L.y0 + .1) + .002

    def ex(bm, trim, ctx):
        # 鞋底輪廓：鞋楦每 5 mm 一格的內外側（腳印）；用一個高度橫切的話，腳弓高的（女生）會切成前掌、後跟兩塊
        loops = []
        L = K.L
        ys = [L.y0 + .002 + (L.y1 - L.y0 - .004) * k / 60 for k in range(61)]
        io = [L.at(y)[:2] for y in ys]
        for _ in range(80):      # 每格的極值會跳（腳踝那幾格量到的是踝骨）：抹平成順的腳印
            io = [io[0]] + [tuple((io[k - 1][i] + io[k][i] * 2 + io[k + 1][i]) / 4 for i in (0, 1)) for k in range(1, len(io) - 1)] + [io[-1]]
        for sg in (1, -1):
            ring_ = [Vector((F.ox + sg * io[k][1], y, zbed)) for k, y in enumerate(ys)] + [Vector((F.ox + sg * io[k][0], y, zbed)) for k, y in reversed(list(enumerate(ys)))]
            P = _resample(ring_, smooth=6)
            N = _out2(P)
            loops.append([q - N[k] * d.get('bed_in', .004) for k, q in enumerate(P)])
        sole(bm, trim, loops, d['prof'], lambda p: 0., insole=d.get('insole', 'b'), lip=0.)
        # 帶子的邊滾一圈細管（照 W_foot 的三角形切出來的邊是毛的）
        for ch in _chains(ctx['rim']):
            if len(ch) > 8 and sum(p.z for p in ch) / len(ch) > zbed + .01:
                with _part(bm, trim, d.get('pipe', 'cloth')):
                    tube_loop(bm, _resample(ch, step=.003, smooth=3), .0017, seg=6)
        if d.get('extra'):
            d['extra'](bm, trim)

    shoe_pose(F, lift, 0.)
    o = shell(FF, f'W_{name}_{F.g}', ['shoe'], off=d['off'], smooth=smooth, rim=rim, patches=d.get('patches', ()), regions=d.get('regions', ()),
              fields=[lambda p, ctx: zbed + .006 - p.z, *d['fields']], extra=ex)
    _unpose(o, F, lift, 0.)
    o['lift'], o['flex'] = lift, 0.
    return o


def build_shoes(F, g):
    ox, M = F.ox, g == 'Male'
    an, kn = F.b('foot_l'), F.b('calf_l')
    foot = build_foot(F, g)
    A = lambda K: an.z + K.lift                    # 擺好姿勢的腳踝關節高度（壓腳掌是繞它轉，不動）
    R = lambda K: an.z + .052 + K.lift             # 小腿區下緣（鞋口滾邊那圈）
    toe = lambda K, u0: (lambda p, ctx: u0 - K.L.tip(p.y))                    # 鞋尖往後到 u0（0 後跟 → 1 鞋尖）
    heelr = lambda K, u0: (lambda p, ctx: K.L.tip(p.y) - u0)                  # 後跟到 u0
    below = lambda h: (lambda p, ctx: p.z - h(p))                              # h(p) 以下
    band = lambda top, w: (lambda p, ctx: (top(p) - w) - p.z)                 # 鞋口往下 w 的一圈（滾邊、加厚的鞋領）
    def shaft(K, foot_off, shaft_off, tip=0.):
        """鞋面推 foot_off；鞋口滾邊那圈往上是靴筒，推 shaft_off（靴筒的皮比較厚、要蓋住褲管）；tip：鞋頭再多推的量"""
        r = R(K)
        def off(p):
            t = max(0., min(1., (p.z - (r - .04)) / .035))
            return foot_off + (shaft_off - foot_off) * t * t * (3 - 2 * t) + tip * max(0., (K.L.tip(p.y) - .72) / .28) ** 2
        return off
    def lateral_tab(K, y, z, part, w=.012, h=.024):
        """後跟的拉環（後面中線上，從鞋口往上翻出一圈）"""
        def build(bm, trim):
            tree = _body_bvh(K.PF)[0]
            for s in (1, -1):
                hit = tree.ray_cast(Vector((ox + s * K.L.mid(y), .6, z)), Vector((0, -1, 0)), 1.)
                if hit[0] is None:
                    continue
                c = hit[0] + Vector((0, .016, 0))
                with _part(bm, trim, part):
                    tube(bm, [tuple(c + Vector((s * -w * .5, -.002, -h))), tuple(c + Vector((s * -w * .5, .002, .006))),
                              tuple(c + Vector((0, .004, .012))), tuple(c + Vector((s * w * .5, .002, .006))), tuple(c + Vector((s * w * .5, -.002, -h)))], .0028, seg=6, close=True)
        return build

    # ── F-01 紅白黑高筒復古籃球鞋：白色頭層皮的底，紅色的鞋頭、鞋眼片、後跟片，黑色的飛翼與加厚鞋領；九孔鞋帶，鞋舌高出鞋口，鞋頭打孔（CHAR_FS 的 hoop），杯底白側牆、紅色大底
    def f01(K):
        L, a = K.L, A(K)
        tm = collar(F, a, .082, .09, .086)
        def top(p):
            fr = max(0., math.sin(foot_a(F, p)))
            return tm(p) + .02 * max(0., 1 - L.side(p) ** 2 / .16) * fr ** 4
        y_t = L.y0 + (L.y1 - L.y0) * .45
        wing = yz_stroke(L, [(L.y0 + (L.y1 - L.y0) * .5, K.z1 + .02), (L.y1 - .08, a + .015), (L.y1 - .045, a + .05)], .006, .012, sides=(1, -1), lo=.55)
        eye = lambda p, ctx: max(abs(L.side(p)) - .62, .2 - abs(L.side(p)), y_t - .008 - p.y, p.y - (an.y - .02)) if p.z > K.z1 + .03 else 1.
        return dict(top=top, off=shaft(K, .0045, .0065, .002), pat=1,
                    regions=[(toe(K, .84), 'b'), (lambda p, ctx: max(heelr(K, .2)(p, ctx), p.z - (a + .045)), 'b'), (eye, 'b'), (wing, 'c'), (band(tm, .016), 'c')],
                    roll=(.0055, 'c'),
                    extra=laces(K, y_t, a + .08, 9, .017, .02, .007, part='plain', r=.0017, eyelet='c'),
                    prof=[(0., -.001, 'plain'), (0., .004, 'plain'), (.5, .0055, 'plain'), (.82, .0052, 'plain'), (.82, .0052, 'b'), (1., .003, 'b')], insole='c')
    shoe(F, 'hoop_high', f01, ball=.022, slots=('shoe', 'shin'), smooth=4)

    # ── F-02 全白厚底滑板鞋：35 mm 平底硫化大底（米色，CHAR_FS 的 skate 畫側牆兩道細線與鞋頭車線），低筒鞋口在踝骨下 12 mm、後跟往上收，
    #    加肥麵包鞋舌（往外多鼓 4 mm）、加厚鞋領、雙層寬鞋帶
    def f02(K):
        L, a = K.L, A(K)
        top = collar(F, a, -.014, -.002, .062)
        y_t = L.y0 + (L.y1 - L.y0) * .48
        tongue = lambda p, ctx: max(abs(L.side(p)) - .3, y_t - p.y, p.y - (an.y - .01), p.z - (top(p) - .002)) if p.z > K.z1 + .03 else 1.
        return dict(top=top, off=lambda p: .004 + .0015 * max(0., (L.tip(p.y) - .75) / .25),
                    patches=[(tongue, .004, .002, 'cloth')], roll=(.006, 'cloth'),
                    extra=laces(K, y_t + .012, a + .03, 5, .02, .021, .009, part='plain', r=.0024, eyelet=None),
                    prof=[(0., -.001, 'b'), (0., .0035, 'b'), (.3, .005, 'b'), (.55, .0052, 'b'), (.92, .005, 'b'), (1., .002, 'b')])
    shoe(F, 'skate_low', f02, ball=.025)

    # ── F-03 八孔馬汀靴：櫻桃紅擦色牛皮（CHAR_FS 的 docs）、圓鼓鞋頭，八孔黑鞋帶，後跟布拉環；鞋底邊一圈黃色車線的沿條，底下是一道道橫紋的厚底
    def f03(K):
        L, a = K.L, A(K)
        top = collar(F, a, .1, .102, .095)
        y_t = L.y0 + (L.y1 - L.y0) * .5
        rib = [(.1, .005, 'c'), (.1, .005, 'b')] + [(u, o, 'b') for k in range(5) for u, o in ((.2 + k * .14, .0066), (.27 + k * .14, .0054))]
        return dict(top=top, off=shaft(K, .0055, .007, .004),
                    roll=(.0045, 'cloth'),
                    extra=lambda bm, trim: (laces(K, y_t, top(Vector((ox + .1, an.y - .1, 0))) - .012, 8, .016, .019, .006, part='b', r=.0016, eyelet='b')(bm, trim),
                                                 lateral_tab(K, L.y1, top(Vector((ox, L.y1, 0))), 'c')(bm, trim)),
                    prof=[(0., -.001, 'c'), (0., .0035, 'c')] + rib + [(1., .004, 'b')])
    shoe(F, 'docs8', f03, ball=.03, slots=('shoe', 'shin'), smooth=4)

    # ── F-04 老爹厚底鞋：淺灰網布底（CHAR_FS 的 dad：網眼與做舊刷灰），灰麂皮鞋頭與鞋眼片、螢光綠側飾、銀色反光後跟片；
    #    三層波浪厚底（螢光綠／白／灰，分層線前後起伏）往外鼓
    def f04(K):
        L, a = K.L, A(K)
        top = collar(F, a, -.006, .006, .062)
        y_t = L.y0 + (L.y1 - L.y0) * .46
        wv = lambda b, amp, fr, ph: (lambda p: b + amp * math.sin(p.y * fr + ph))
        u1, u2, u3 = wv(.2, .05, 55, 0), wv(.55, .07, 40, 1.2), wv(.84, .03, 70, 2.)
        swo = yz_stroke(L, [(L.y0 + (L.y1 - L.y0) * .3, K.z1 + .012), (L.y0 + (L.y1 - L.y0) * .6, K.z1 + .035), (L.y1 - .05, a - .012)], .009, .004, sides=(1, -1), lo=.5)
        eye = lambda p, ctx: max(abs(L.side(p)) - .65, .18 - abs(L.side(p)), y_t - .01 - p.y) if p.z > K.z1 + .025 else 1.
        return dict(top=top, off=lambda p: .0058 + .002 * max(0., (L.tip(p.y) - .7) / .3), pat=1,
                    regions=[(lambda p, ctx: max(toe(K, .8)(p, ctx), p.z - (K.z1 + .035)), 'c'), (eye, 'c'), (heelr(K, .22), 'silver'), (swo, 'b')],
                    roll=(.0065, 'cloth'), patches=[(lambda p, ctx: max(abs(L.side(p)) - .28, y_t - p.y, p.y - (an.y - .01)) if p.z > K.z1 + .03 else 1., .003, .002, 'cloth')],
                    extra=laces(K, y_t + .01, a + .03, 6, .019, .02, .008, part='plain', r=.0021, eyelet='c'),
                    prof=[(0., -.001, 'b'), (0., .004, 'b'), (u1, .0062, 'b'), (u1, .0062, 'plain'), (u2, .0095, 'plain'), (u2, .0095, 'c'), (u3, .0075, 'c'), (u3, .0075, 'b'), (1., .0045, 'b')])
    shoe(F, 'dad_chunky', f04, ball=.045, wrap=.016)

    # ── F-05 紅底尖頭細高跟：10 cm 細跟（腳掌壓 0.5 rad），前掌 6 mm 皮底、後面 8 mm 的鞋底沿著腳弓斜上去；
    #    黑漆皮淺口（鞋頭蓋到前掌、兩側低、後跟包 5 cm），鞋頭往前收成尖頭；鞋底與鞋跟柱的內側是緋紅烤漆（第三色）
    def f05(K):
        L, zc = K.L, K.zc
        def zbot(p):
            return (zc(p) - .008) * max(0., min(1., (zc(p) - K.z1 - .004) / .021))
        def opening(p, ctx):
            u, sd = L.tip(p.y), L.side(p)
            yv = L.y0 + (L.y1 - L.y0) * .42 + .03 * sd * sd     # 鞋口前緣（腳背上一道 U 形，從鞋尖算 42%）
            hc = .016 + (.05 - .016) * max(0., min(1., (.3 - u) / .2)) ** 1.5
            return min(p.y - yv, (p.z - zc(p)) - hc)
        def off(p):
            u, sd = L.tip(p.y), L.side(p)
            return .0018 + .02 * max(0., (u - .9) / .1) ** 2 * (1 - min(1., abs(sd))) - .004 * max(0., min(1., (u - .74) / .2)) * min(1., sd * sd) * (sd > 0)
        def heel(bm, trim):
            for s in (1, -1):
                y = L.y1 - .024
                c = Vector((ox + s * L.mid(y), y, 0.))
                c.z = zbot(c) + .003
                heel_post(bm, trim, c, Vector((c.x, y + .003, 0.)), (.012, .015), (.0042, .0042), bend=-.004, tilt=K.flex, part='b')
        return dict(off=off, zbot=zbot, fields=[opening], heel=heel, part='gloss', insole='c', roll=(.0016, 'gloss'),
                    prof=[(0., -.001, 'c'), (.3, .0012, 'c'), (1., .0004, 'c')])
    shoe(F, 'stiletto', f05, flex=.5, ball=.006, wrap=.005, smooth=5)

    # ── F-06 賽博襪套靴：消光黑彈力編織（CHAR_FS 的 cyber：針織與靴筒上的編號），外側一條銀拉鍊、腳背兩道魔鬼氈帶；
    #    分離式透明氣墊底，中間一層是青色的發光（第三色）
    def f06(K):
        L, a = K.L, A(K)
        top = collar(F, a, .13, .14, .125)
        zip_ = yz_stroke(L, [(L.y1 - .05, K.z1 + .012), (L.y1 - .04, a + .02), (an.y + .01, a + .125)], .0035, .0035, sides=(1,), lo=.6)
        strap = lambda yc: (lambda p, ctx: max(abs(p.y - yc) - .011, K.z1 + .022 - p.z))
        def pull(bm, trim):
            tree = _body_bvh(K.PF)[0]
            for s in (1, -1):
                hit = tree.ray_cast(Vector((ox + s * .5, an.y + .01, a + .115)), Vector((-s, 0, 0)), 1.)
                if hit[0] is not None:
                    with _part(bm, trim, 'silver'):
                        cube(bm, hit[0] + hit[1] * .018, (.004, .012, .018))
        y1, y2 = L.y0 + (L.y1 - L.y0) * .42, L.y0 + (L.y1 - L.y0) * .55
        return dict(top=top, off=shaft(K, .0035, .005, .002), regions=[(zip_, 'silver')],
                    patches=[(strap(y1), .0035, .002, 'b'), (strap(y2), .0035, .002, 'b')], roll=(.003, 'b'),
                    extra=pull,
                    prof=[(0., -.001, 'b'), (0., .004, 'b'), (.18, .005, 'b'), (.18, .005, 'glow'), (.72, .0058, 'glow'), (.72, .0058, 'b'), (1., .003, 'b')])
    shoe(F, 'cyber_sock', f06, ball=.034, slots=('shoe', 'shin'), smooth=4)

    # ── F-07 黑白棋盤格懶人鞋：無鞋帶低筒、鞋面蓋到腳踝前，兩側黑色鬆緊帶，加厚黑鞋領，後跟一片紅色小標；白色硫化底中間一道黑線
    def f07(K):
        L, a = K.L, A(K)
        top = collar(F, a, -.017, -.006, .004, kf=2)
        gore = lambda p, ctx: max(abs(abs(L.side(p)) - .55) - .18, abs(p.y - (an.y - .05)) - .022, top(p) - .028 - p.z)
        tag = lambda p, ctx: max(abs(L.side(p)) - .2, (L.tip(p.y) - .05), abs(p.z - (K.z1 + .03)) - .01)
        return dict(top=top, off=lambda p: .0035, regions=[(gore, 'b'), (band(top, .012), 'b')],
                    patches=[(tag, .0018, .0012, 'c')], roll=(.005, 'b'),
                    prof=[(0., -.001, 'plain'), (0., .0035, 'plain'), (.22, .0045, 'plain'), (.22, .0045, 'b'), (.3, .0045, 'b'), (.3, .0045, 'plain'), (.92, .0045, 'plain'), (1., .002, 'plain')])
    shoe(F, 'checker_slip', f07, ball=.02)

    # ── F-08 沙漠色戰術軍靴：狼棕反毛皮（CHAR_FS 的 tactical），靴筒兩側高強度尼龍網布（第二色）、鞋頭與鞋底一圈防撞橡膠（第三色）；
    #    七孔鞋帶，深溝槽越野大底
    def f08(K):
        L, a = K.L, A(K)
        top = collar(F, a, .13, .135, .123)
        y_t = L.y0 + (L.y1 - L.y0) * .5
        nylon = lambda p, ctx: max(a + .018 - p.z, .25 - abs(L.side(p)), p.z - (top(p) - .02))
        lug = [(u, o, 'c') for k in range(4) for u, o in ((.16 + k * .2, .0068), (.25 + k * .2, .0052))]
        return dict(top=top, off=shaft(K, .006, .0075, .003),
                    regions=[(nylon, 'b'), (lambda p, ctx: max(toe(K, .86)(p, ctx), p.z - (K.z1 + .04)), 'c'), (lambda p, ctx: p.z - (K.z1 + .012), 'c')],
                    roll=(.005, 'cloth'),
                    extra=laces(K, y_t, top(Vector((ox + .1, an.y - .1, 0))) - .014, 7, .016, .019, .007, part='b', r=.0016, eyelet='metal'),
                    prof=[(0., -.001, 'c'), (0., .004, 'c')] + lug + [(1., .004, 'c')])
    shoe(F, 'tactical', f08, ball=.032, slots=('shoe', 'shin'), smooth=4)

    # ── F-09 千禧辣妹及膝防水台長靴：嬰兒粉亮面漆皮、修身靴筒到膝下 3 cm，內側全開的銀拉鍊；前掌 5 cm 防水台、12 cm 方粗跟（腳掌壓 0.32 rad）
    def f09(K):
        L, a, zc = K.L, A(K), K.zc
        def zbot(p):
            return (zc(p) - .014) * max(0., min(1., (zc(p) - K.z1 - .006) / .03))
        zip_ = yz_stroke(L, [(L.y1 - .06, K.z1 + .02), (an.y + .005, a + .03), (an.y - .005, kn.z - .045 + K.lift)], .003, .003, sides=(-1,), lo=.55)
        def heel(bm, trim):
            for s in (1, -1):
                y = L.y1 - .032
                c = Vector((ox + s * L.mid(y), y, 0.))
                c.z = zbot(c) + .004
                heel_post(bm, trim, c, Vector((c.x, y + .002, 0.)), (.024, .028), (.021, .023), sq=5., tilt=K.flex, part='gloss')
        def pull(bm, trim):
            tree = _body_bvh(K.PF)[0]
            for s in (1, -1):
                hit = tree.ray_cast(Vector((ox + s * L.mid(an.y), an.y - .005, kn.z - .06 + K.lift)), Vector((-s, 0, 0)), .3)   # 從腿中間往內側打（從外面打會先打到另一條腿）
                if hit[0] is not None:
                    with _part(bm, trim, 'silver'):
                        cube(bm, hit[0] + hit[1] * .016, (.004, .006, .014))
        return dict(top=lambda p: kn.z - .03 + K.lift, off=shaft(K, .0045, .0055, .003), part='gloss', zbot=zbot, heel=heel, roll=(.0024, 'gloss'),
                    regions=[(zip_, 'silver')], extra=pull,
                    prof=[(0., -.001, 'gloss'), (0., .004, 'gloss'), (.5, .0062, 'gloss'), (1., .004, 'gloss')])
    shoe(F, 'y2k_knee', f09, flex=.32, ball=.05, wrap=.008, slots=('shoe', 'shin'), smooth=5)

    # ── F-10 小麥色六吋工裝靴：牛巴革（CHAR_FS 的 workboot：絨面與四排車線），深棕皮革加厚鞋領，七孔金屬孔、第三色圓繩鞋帶，生膠大底
    def f10(K):
        L, a = K.L, A(K)
        top = collar(F, a, .07, .075, .064)
        y_t = L.y0 + (L.y1 - L.y0) * .48
        lug = [(u, o, 'c') for k in range(3) for u, o in ((.3 + k * .22, .0066), (.39 + k * .22, .0056))]
        return dict(top=top, off=shaft(K, .0062, .008, .004), regions=[(band(top, .024), 'b')],
                    roll=(.0065, 'b'),
                    extra=laces(K, y_t, top(Vector((ox + .1, an.y - .1, 0))) - .03, 7, .017, .02, .007, part='c', r=.0019, eyelet='gold'),
                    prof=[(0., -.001, 'b'), (0., .0045, 'b'), (.18, .0058, 'b'), (.18, .0058, 'c')] + lug + [(1., .0045, 'c')])
    shoe(F, 'workboot', f10, ball=.03, slots=('shoe', 'shin'), smooth=4)

    # ── F-11 雕花擦色牛津鞋：威士忌棕（CHAR_FS 的 brogue：翼紋沖孔、鞋頭花孔、鞋頭與後跟加深打蠟），杏仁鞋頭、五孔封閉式細鞋帶；
    #    薄皮底、2.5 cm 木紋層疊後跟（腳掌壓 0.12 rad）
    def f11(K):
        L, a, zc = K.L, A(K), K.zc
        top = collar(F, a, -.02, -.008, .0, kf=2)
        y_t = L.y0 + (L.y1 - L.y0) * .5
        def zbot(p):
            return (zc(p) - .006) * max(0., min(1., (zc(p) - K.z1 - .002) / .012))
        def off(p):
            u, sd = L.tip(p.y), L.side(p)
            return .0026 + .007 * max(0., (u - .88) / .12) ** 2 * (1 - min(1., abs(sd))) - .0025 * max(0., (u - .7) / .3) * min(1., sd * sd)
        def heel(bm, trim):
            for s in (1, -1):
                y = L.y1 - .034
                c = Vector((ox + s * L.mid(y), y, 0.))
                c.z = zbot(c) + .002
                heel_post(bm, trim, c, Vector((c.x, y, 0.)), (.026, .031), (.025, .029), sq=6., rows=6, tilt=K.flex, part='c')
        return dict(top=top, off=off, zbot=zbot, heel=heel, roll=(.002, 'b'),
                    extra=laces(K, y_t, a - .006, 5, .007, .011, .0045, part='b', r=.0011, eyelet=None, bow=True),
                    prof=[(0., -.001, 'c'), (0., .003, 'c'), (1., .0022, 'c')])
    shoe(F, 'wingtip', f11, flex=.12, ball=.012, wrap=.009, smooth=4)

    # ── F-12 軟木厚底交叉寬帶涼鞋：焦糖植鞣皮的兩條寬帶在腳背交叉、後跟一條固定帶，大號金方釦；軟木顆粒底台（CHAR_FS 的 cork）、皮革鞋墊；露出腳趾與指甲
    def f12(K, FF):
        L = K.L
        zb = L.bot(L.y0 + .1) + .002
        yc = L.y0 + (L.y1 - L.y0) * .48
        def straps(p, ctx):
            X, Y = abs(p.x - ox) - L.mid(p.y), p.y - yc
            d1 = abs(X * .64 + Y * .77) - .017        # 兩條斜帶在腳背中間交叉
            d2 = abs(-X * .64 + Y * .77) - .017
            hz = zb + .036
            d3 = max(abs(p.z - hz) - .008, an.y - .015 - p.y)   # 後跟帶
            d12 = max(min(d1, d2), p.z - (zb + .09), p.y - (an.y - .02))     # 交叉帶只在腳背（腳踝以前、不往上爬）
            return min(d12, d3) if p.z > zb + .006 else 1.
        def buckles(bm, trim):
            tree = _body_bvh(FF)[0]
            for s in (1, -1):
                for y, z in ((yc + .03, zb + .022), (an.y + .005, zb + .036)):
                    hit = tree.ray_cast(Vector((ox + s * .5, y, z)), Vector((-s, 0, 0)), 1.)
                    if hit[0] is None:
                        continue
                    c, n = hit[0] + hit[1] * .005, hit[1]
                    rot = _quat_z(n)
                    with _part(bm, trim, 'gold'):
                        for dx, dy, sx, sy in ((0, .011, .013, .0022), (0, -.011, .013, .0022), (.011, 0, .0022, .013), (-.011, 0, .0022, .013)):
                            m = _mat(tuple(c), tuple(rot), (1, 1, 1))
                            bmesh.ops.create_cube(bm, size=1, matrix=m @ _mat((0, dx, dy), (0, 0, 0), (.0025, sx * 2, sy * 2)))
        return dict(off=lambda p: .0025, fields=[straps], extra=buckles, bed_in=.003, insole='cloth',
                    patches=[], prof=[(0., .0, 'cloth'), (.1, .0012, 'cloth'), (.1, .0012, 'b'), (.5, .0028, 'b'), (1., .0015, 'b')])
    sandal(F, 'cork_sandal', foot, f12, ball=.04)

    # ── F-13 全掌氣墊跑鞋：電光藍漸層到霓虹紫的飛織網面（CHAR_FS 的 knitgrad，第一色 → 第二色）、像襪口的低鞋領，外側銀色流線反光標；
    #    白色中底包住一整條透明波浪氣墊（珍珠白），紫色大底
    def f13(K):
        L, a = K.L, A(K)
        top = collar(F, a, -.004, .012, .048, kf=2)
        y_t = L.y0 + (L.y1 - L.y0) * .46
        wv = lambda b, amp: (lambda p: b + amp * math.sin(p.y * 48))
        swo = yz_stroke(L, [(L.y0 + (L.y1 - L.y0) * .35, K.z1 + .01), (L.y1 - .07, K.z1 + .03), (L.y1 - .03, a - .01)], .0055, .0025, sides=(1,), lo=.5)
        return dict(top=top, off=lambda p: .0032 + .0015 * max(0., (L.tip(p.y) - .75) / .25), regions=[(swo, 'silver')], roll=(.004, 'cloth', .8),
                    extra=laces(K, y_t + .006, a + .015, 6, .015, .016, .0055, part='c', r=.0013, eyelet=None),
                    prof=[(0., -.001, 'c'), (0., .004, 'c'), (wv(.22, .04), .0055, 'c'), (wv(.22, .04), .0055, 'pearl'), (wv(.76, .04), .006, 'pearl'), (wv(.76, .04), .006, 'b'), (1., .003, 'b')])
    shoe(F, 'knit_runner', f13, ball=.03, wrap=.016)

    # ── F-14 德州刺繡尖頭牛仔靴：做舊深棕油蠟皮（CHAR_FS 的 western：靴筒的米白與松石綠火焰羽毛車線），前後 V 形波浪開口的靴筒、兩側拉耳，
    #    上翹的尖鞋頭、斜切的古巴跟（腳掌壓 0.14 rad）
    def f14(K):
        L, a, zc = K.L, A(K), K.zc
        def top(p):
            fa = foot_a(F, p)
            return a + .235 - .036 * math.exp(-((fa - math.pi / 2) / .32) ** 2) - .03 * math.exp(-((fa + math.pi / 2) / .32) ** 2)
        def zbot(p):
            return (zc(p) - .008) * max(0., min(1., (zc(p) - K.z1 - .003) / .015)) + .008 * max(0., (L.tip(p.y) - .9) / .1) ** 2
        def off(p):
            u, sd = L.tip(p.y), L.side(p)
            base = shaft(K, .0045, .0075)(p) + .006 * max(0., min(1., (p.z - (a + .1)) / .12))
            return base + .016 * max(0., (u - .88) / .12) ** 2 * (1 - min(1., abs(sd))) - .003 * max(0., (u - .72) / .28) * min(1., sd * sd)
        def heel(bm, trim):
            for s in (1, -1):
                y = L.y1 - .03
                c = Vector((ox + s * L.mid(y), y, 0.))
                c.z = zbot(c) + .002
                heel_post(bm, trim, c, Vector((c.x, y - .012, 0.)), (.026, .031), (.022, .021), sq=4., rows=8, tilt=K.flex, part='c')
        def ears(bm, trim):
            tree = _body_bvh(K.PF)[0]
            for s in (1, -1):
                for k in (1, -1):
                    z = a + .22
                    hit = tree.ray_cast(Vector((ox + s * L.mid(an.y), an.y + .005, z)), Vector((s * k, 0, 0)), .3)   # 從腿中間往外、往內打
                    if hit[0] is None:
                        continue
                    c = hit[0] + hit[1] * .02
                    with _part(bm, trim, 'b'):
                        tube(bm, [tuple(c + Vector((0, -.011, -.002))), tuple(c + Vector((0, -.008, .022))), tuple(c + Vector((0, .008, .022))), tuple(c + Vector((0, .011, -.002)))], .0032, seg=6, close=True)
        return dict(top=top, off=off, zbot=zbot, heel=heel, extra=ears, roll=(.0025, 'b'),
                    prof=[(0., -.001, 'c'), (0., .0035, 'c'), (1., .0025, 'c')])
    shoe(F, 'cowboy_boot', f14, flex=.14, ball=.01, wrap=.009, slots=('shoe', 'shin'), smooth=5)

    # ── F-15 燕麥色魔鬼氈老爹拖鞋：加厚的 EVA 大底（CHAR_FS 的 eva：壓印的字母），腳趾下一道凸起的人體工學腳趾溝；鋪棉寬帶橫過腳背，中間一道魔鬼氈分線
    def f15(K, FF):
        L = K.L
        zb = L.bot(L.y0 + .1) + .002
        ys = L.y0 + (L.y1 - L.y0) * .56
        strap = lambda p, ctx: max(abs(p.y - ys) - .034, zb + .008 - p.z, p.z - (zb + .085), p.y - (an.y - .03))
        def ridge(bm, trim):
            for s in (1, -1):
                y = L.y0 + .03
                pts = [(ox + s * (L.mid(y) + k * L.hw(y) * .78), y + .006 * k * k, zb + .002) for k in (-1, -.5, 0, .5, 1)]
                with _part(bm, trim, 'cloth'):
                    tube(bm, pts, .0045, seg=8)
        return dict(off=lambda p: .0045, fields=[strap], extra=ridge, bed_in=.0015, insole='cloth',
                    patches=[(lambda p, ctx: abs(p.y - ys) - .003, .0012, .001, 'b')],
                    prof=[(0., .0, 'cloth'), (.15, .0016, 'cloth'), (.6, .0035, 'cloth'), (1., .0012, 'cloth')])
    sandal(F, 'eva_slide', foot, f15, ball=.038)
