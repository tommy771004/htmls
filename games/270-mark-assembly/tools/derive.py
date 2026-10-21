# 以現有的實體模型改造出沒有對應網格的型號（參考 GK 與設定圖的比例，只取比例、不描圖）：
#   先照 bake.py 拆好部位（不匯出），再依 DERIVE[key] 改比例、包外殼、加零件，最後同樣以 meshopt 匯出。
# blender -b --factory-startup --python derive.py -- <key> <out.glb> [debug.png]
# 來源是 .blend 的（mk7）會自己開 ../.cache/ 的檔案。
import bpy, bmesh, sys, os, math
from mathutils import Vector as V, Matrix

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from common import MODELS, CACHE

argv = sys.argv[sys.argv.index('--') + 1:]
key, out = argv[0], argv[1]
debug = argv[2] if len(argv) > 2 else None
HEIGHT = 1.95


# ---------------- 幾何工具 ----------------
def verts_of(names):
    return [v.co for n in names if n in P for v in P[n].data.vertices]


def box(names):
    cs = verts_of(names if isinstance(names, (list, tuple)) else [names])
    mn = V((min(c.x for c in cs), min(c.y for c in cs), min(c.z for c in cs)))
    mx = V((max(c.x for c in cs), max(c.y for c in cs), max(c.z for c in cs)))
    return mn, mx


def anchor(name, where='c'):
    mn, mx = box(name); c = (mn + mx) / 2
    return V((c.x, c.y, mx.z)) if where == 'top' else V((c.x, c.y, mn.z)) if where == 'bot' else c


def place(names, s, piv, to=None):
    """以 piv 為中心依 s=(sx,sy,sz) 縮放，再把 piv 移到 to"""
    to = piv if to is None else to
    for n in names if isinstance(names, (list, tuple)) else [names]:
        if n not in P: continue
        for v in P[n].data.vertices:
            d = v.co - piv
            v.co = to + V((d.x * s[0], d.y * s[1], d.z * s[2]))
        P[n].data.update()


def mat_idx(o, role):
    m = ROLE_MATS.get(role)
    if m is None:
        m = bpy.data.materials.new('role_' + role); m.diffuse_color = ROLE_MATS['g'].diffuse_color; ROLE_MATS[role] = m
    for i, mm in enumerate(o.data.materials):
        if mm == m: return i
    o.data.materials.append(m); return len(o.data.materials) - 1


def role_of_face(o, f):
    m = o.data.materials[f.material_index] if f.material_index < len(o.data.materials) else None
    return m.name[5:] if m else 'p'


def edit(name, fn):
    o = P[name]; bm = bmesh.new(); bm.from_mesh(o.data)
    bm.faces.ensure_lookup_table(); fn(o, bm)
    bm.to_mesh(o.data); bm.free(); o.data.update()


def drop_faces(name, keep):
    """keep(o, face) 為 False 的面刪掉"""
    def fn(o, bm):
        bmesh.ops.delete(bm, geom=[f for f in bm.faces if not keep(o, f)], context='FACES')
    edit(name, fn)


def append(name, bm2, role_fn):
    """把 bm2 的幾何併進部位物件（沒有就新建）；role_fn(face) 回傳塗裝角色"""
    if name not in P:
        o = bpy.data.objects.new(name, bpy.data.meshes.new(name)); bpy.context.scene.collection.objects.link(o)
        P[name] = o; objs.append(o)
    o = P[name]
    for f in bm2.faces: f.material_index = mat_idx(o, role_fn(f))
    tmp = bpy.data.meshes.new('tmp'); bm2.to_mesh(tmp); bm2.free()
    bm = bmesh.new(); bm.from_mesh(o.data); bm.from_mesh(tmp)
    bm.to_mesh(o.data); bm.free(); bpy.data.meshes.remove(tmp); o.data.update()


def decimate_bm(bm, ratio):
    me = bpy.data.meshes.new('d'); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new('d', me); bpy.context.scene.collection.objects.link(ob)
    md = ob.modifiers.new('d', 'DECIMATE'); md.ratio = ratio
    dg = bpy.context.evaluated_depsgraph_get()
    nm = bpy.data.meshes.new_from_object(ob.evaluated_get(dg), depsgraph=dg)
    out = bmesh.new(); out.from_mesh(nm)
    bpy.data.objects.remove(ob); bpy.data.meshes.remove(me); bpy.data.meshes.remove(nm)
    return out


def shell(names, inflate=.02, faces=1400, bands=3, band_w=.022, smooth=5, s=(1, 1, 1), piv=None, cuts=()):
    """部位的外殼：凸包膨脹 → 體素重建 → 平滑成圓潤的裝甲殼 → 減面；沿高度切 bands 道分件縫（縫是關節色）。
    s／piv 可以再把外殼壓扁或拉長。回傳 (bm, seam_faces)。"""
    bm = bmesh.new()
    for c in verts_of(names): bm.verts.new(c)
    r = bmesh.ops.convex_hull(bm, input=bm.verts)
    bmesh.ops.delete(bm, geom=list({g for g in r['geom_interior'] + r['geom_unused'] if isinstance(g, bmesh.types.BMVert)}), context='VERTS')
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.normal_update()
    for v in bm.verts: v.co += v.normal * inflate
    if piv is not None:
        for v in bm.verts:
            d = v.co - piv; v.co = piv + V((d.x * s[0], d.y * s[1], d.z * s[2]))
    dims = [max(v.co[k] for v in bm.verts) - min(v.co[k] for v in bm.verts) for k in range(3)]
    me = bpy.data.meshes.new('sh'); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new('sh', me); bpy.context.scene.collection.objects.link(ob)
    rm = ob.modifiers.new('r', 'REMESH'); rm.mode = 'VOXEL'; rm.voxel_size = max(dims) / 46
    sm = ob.modifiers.new('s', 'SMOOTH'); sm.factor = .8; sm.iterations = smooth
    dg = bpy.context.evaluated_depsgraph_get()
    nm = bpy.data.meshes.new_from_object(ob.evaluated_get(dg), depsgraph=dg)
    bm = bmesh.new(); bm.from_mesh(nm)
    bpy.data.objects.remove(ob); bpy.data.meshes.remove(me); bpy.data.meshes.remove(nm)
    if len(bm.faces) > faces: bm = decimate_bm(bm, faces / len(bm.faces))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    for co, no in cuts: cut(bm, co, no)  # 飾板分界
    z0 = min(v.co.z for v in bm.verts); z1 = max(v.co.z for v in bm.verts)
    # 分件縫：用水平面切開，兩刀之間的窄帶是縫，邊緣才會整齊
    sf = set(); w = band_w * (z1 - z0) / 2; cuts = [z0 + (z1 - z0) * k / bands for k in range(1, bands)] if bands else []
    for zc in cuts:
        for z in (zc - w, zc + w):
            bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=(0, 0, z), plane_no=(0, 0, 1))
    for f in bm.faces:
        z = f.calc_center_median().z
        if any(abs(z - zc) < w for zc in cuts): sf.add(f)
    return bm, sf


def cut(bm, co, no):
    bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=co, plane_no=no)


def prim_box(c, size, bevel=.006):
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1)
    for v in bm.verts: v.co = V((v.co.x * size[0], v.co.y * size[1], v.co.z * size[2]))
    if bevel: bmesh.ops.bevel(bm, geom=bm.edges[:], offset=bevel, segments=2, affect='EDGES', profile=.5)
    for v in bm.verts: v.co += V(c)
    return bm


def prim_cyl(c, r, depth, seg=40, axis='Y', r2=None):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=r, radius2=r if r2 is None else r2, depth=depth)
    R = {'Y': Matrix.Rotation(math.pi / 2, 4, 'X'), 'X': Matrix.Rotation(math.pi / 2, 4, 'Y'), 'Z': Matrix.Identity(4)}[axis]
    bm.transform(Matrix.Translation(V(c)) @ R)
    return bm


def prim_torus(c, R, r, seg=48, ring=10, axis='Y'):
    bm = bmesh.new(); rows = []
    for i in range(seg):
        a = i / seg * math.tau; row = []
        for j in range(ring):
            b = j / ring * math.tau; rr = R + r * math.cos(b)
            row.append(bm.verts.new((rr * math.cos(a), rr * math.sin(a), r * math.sin(b))))
        rows.append(row)
    for i in range(seg):
        for j in range(ring):
            bm.faces.new((rows[i][j], rows[(i + 1) % seg][j], rows[(i + 1) % seg][(j + 1) % ring], rows[i][(j + 1) % ring]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    rot = Matrix.Rotation(math.pi / 2, 4, 'X') if axis == 'Y' else Matrix.Identity(4)
    bm.transform(Matrix.Translation(V(c)) @ rot)
    return bm


def prim_prism(pts2d, c, depth, axis_rot=None, bevel=.004):
    """xz 平面上的多邊形往 −Y（正面）擠出 depth，c 是放置中心"""
    bm = bmesh.new()
    vs = [bm.verts.new((x, 0, z)) for x, z in pts2d]
    f = bm.faces.new(vs)
    r = bmesh.ops.extrude_face_region(bm, geom=[f])
    for v in [g for g in r['geom'] if isinstance(g, bmesh.types.BMVert)]: v.co.y -= depth
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    if bevel: bmesh.ops.bevel(bm, geom=bm.edges[:], offset=bevel, segments=1, affect='EDGES')
    if axis_rot: bm.transform(axis_rot)
    for v in bm.verts: v.co += V(c)
    return bm


def front_y(name, x, z, r=.04):
    """部位在 (x, z) 附近最前面（最小 y）的表面"""
    cs = [c for c in verts_of([name]) if abs(c.x - x) < r and abs(c.z - z) < r]
    return min(c.y for c in cs) if cs else box(name)[0].y


def back_y(names, x, z, r=.04):
    """部位在 (x, z) 附近最後面（最大 y）的表面"""
    cs = [c for c in verts_of(names if isinstance(names, list) else [names]) if abs(c.x - x) < r and abs(c.z - z) < r]
    return max(c.y for c in cs) if cs else box(names)[1].y


def finish():
    """接地、置中、身高正規化成 1.95 m，重設平滑與銳邊"""
    mn, mx = box(list(P))
    s = HEIGHT / (mx.z - mn.z); c = (mn + mx) / 2
    for o in P.values():
        for v in o.data.vertices:
            v.co = V(((v.co.x - c.x) * s, (v.co.y - c.y) * s, (v.co.z - mn.z) * s))
        for poly in o.data.polygons: poly.use_smooth = True
        o.data.set_sharp_from_angle(angle=math.radians(34))
        o.data.update()


# ---------------- 各型號 ----------------
def hulkbuster():
    """Mark 44：以 Mk.7 為內骨架，放大成桶狀上身、巨型前臂與短粗腿，四肢外面包圓潤的分節外殼。"""
    torso = ['pelvis', 'abdomen', 'chest', 'reactor']
    mn, mx = box(torso)
    place(torso, (1.7, 1.55, 1.12), V((0, (mn.y + mx.y) / 2, mn.z)))
    place(['chest', 'reactor'], (1.12, 1.15, 1.08), anchor('chest', 'bot'))
    cmn, cmx = box('chest')
    place('helmet', (.9, .9, .9), anchor('helmet', 'bot'), V((0, (cmn.y + cmx.y) / 2 - .04, cmx.z - .16)))
    pmn, pmx = box('pelvis')
    for s, sg in (('L', 1), ('R', -1)):
        sh = V((sg * (cmx.x - .02), (cmn.y + cmx.y) / 2 + .01, cmx.z - .2))
        place('pauldron.' + s, (2.6, 2.4, 2.2), anchor('pauldron.' + s), sh + V((sg * .02, 0, .02)))
        place('upperArm.' + s, (2.0, 2.0, 1.1), anchor('upperArm.' + s, 'top'), sh + V((sg * .03, 0, -.02)))
        place('forearm.' + s, (2.5, 2.5, 1.3), anchor('forearm.' + s, 'top'), anchor('upperArm.' + s, 'bot') + V((sg * .01, 0, .04)))
        place('hand.' + s, (2.9, 2.9, 2.6), anchor('hand.' + s, 'top'), anchor('forearm.' + s, 'bot') + V((0, 0, .06)))
        hip = V((sg * pmx.x * .6, anchor('thigh.' + s).y, pmn.z + .12))
        place('thigh.' + s, (1.8, 1.65, .95), anchor('thigh.' + s, 'top'), hip)
        place('shin.' + s, (1.85, 1.7, .9), anchor('shin.' + s, 'top'), anchor('thigh.' + s, 'bot') + V((sg * .01, 0, .06)))
        place('boot.' + s, (1.9, 1.65, 1.5), anchor('boot.' + s, 'top'), anchor('shin.' + s, 'bot') + V((0, -.02, .06)))
    # 四肢外殼：主色分節殼＋金色袖口與大腿側板；原本的內層只留關節
    for s, sg in (('L', 1), ('R', -1)):
        for part, bands, gold, inf in (('pauldron.' + s, 2, None, .03), ('upperArm.' + s, 2, None, .02), ('forearm.' + s, 3, 'cuff', .03),
                                       ('thigh.' + s, 2, 'side', .02), ('shin.' + s, 3, None, .02), ('boot.' + s, 1, 'toe', .015)):
            mn2, mx2 = box(part)
            # 金色飾板的分界也用平面切，邊才整齊
            zc = lambda u: mn2.z + (mx2.z - mn2.z) * u
            xo = (mx2.x if sg > 0 else mn2.x) - sg * (mx2.x - mn2.x) * .22
            cuts = {'cuff': [((0, 0, zc(.17)), (0, 0, 1))], 'side': [((xo, 0, 0), (1, 0, 0)), ((0, 0, zc(.3)), (0, 0, 1)), ((0, 0, zc(.75)), (0, 0, 1))],
                    'toe': [((0, mn2.y + (mx2.y - mn2.y) * .3, 0), (0, 1, 0))]}.get(gold, [])
            bm, seams = shell([part], inflate=inf, bands=bands, cuts=cuts)
            drop_faces(part, lambda o, f: role_of_face(o, f) in ('k', 't'))
            def role(f, seams=seams, gold=gold, mn2=mn2, mx2=mx2, xo=xo, sg=sg):
                c = f.calc_center_median(); u = (c.z - mn2.z) / max(1e-6, mx2.z - mn2.z)
                if f in seams: return 'k'
                if gold == 'cuff' and u < .17: return 's'
                if gold == 'side' and (c.x - xo) * sg > 0 and .3 < u < .75: return 's'
                if gold == 'toe' and c.y < mn2.y + (mx2.y - mn2.y) * .3: return 's'
                return 'p'
            append(part, bm, role)
    # 腹部：深色分節環
    bm, seams = shell(['abdomen'], inflate=.005, bands=4, band_w=.06, s=(1.02, 1.02, .9), piv=anchor('abdomen'))
    drop_faces('abdomen', lambda o, f: role_of_face(o, f) in ('k', 't', 'g'))
    append('abdomen', bm, lambda f: 'k' if f in seams else 't')
    # 掌心推進器：手掌朝身體那一面
    for s, sg in (('L', 1), ('R', -1)):
        hmn, hmx = box('hand.' + s)
        x = hmn.x - .004 if sg > 0 else hmx.x + .004
        append('hand.' + s, prim_cyl((x, (hmn.y + hmx.y) / 2, hmn.z + (hmx.z - hmn.z) * .62), .038, .012, 24, 'X'), lambda f: 'g')
    # 半圓頂頭盔：原本的頭盔換成圓頂外殼，正面下半是金色面罩，兩道發光眼縫
    hmn, hmx = box('helmet')
    bm, _ = shell(['helmet'], inflate=.012, bands=0, smooth=12, s=(1.75, 1.5, 1.12), piv=V(((hmn.x + hmx.x) / 2, (hmn.y + hmx.y) / 2, hmn.z)))
    y0 = min(v.co.y for v in bm.verts); y1 = max(v.co.y for v in bm.verts)
    z0 = min(v.co.z for v in bm.verts); z1 = max(v.co.z for v in bm.verts)
    x0 = min(v.co.x for v in bm.verts); x1 = max(v.co.x for v in bm.verts)
    yf, zf = y0 + (y1 - y0) * .34, z0 + (z1 - z0) * .66
    cut(bm, (0, yf, 0), (0, 1, 0)); cut(bm, (0, 0, zf), (0, 0, 1))
    eyes = []
    for sx in (-1, 1):
        ex, ez = (x0 + x1) / 2 + sx * (x1 - x0) * .17, z0 + (z1 - z0) * .55
        ey = min((v.co.y for v in bm.verts if abs(v.co.x - ex) < .03 and abs(v.co.z - ez) < .03), default=y0)
        e = prim_box((0, 0, 0), (.05, .014, .014), .003)
        e.transform(Matrix.Translation((ex, ey + .002, ez)) @ Matrix.Rotation(sx * math.radians(-12), 4, 'Y'))
        eyes.append(e)
    drop_faces('helmet', lambda o, f: False)
    append('helmet', bm, lambda f: 's' if (lambda c: c.y < yf and c.z < zf)(f.calc_center_median()) else 'p')
    for e in eyes: append('helmet', e, lambda f: 'g')


def bones():
    """Mark 41：Mk.46 的裝甲板只留一條條肋骨帶，露出黑色內襯；四肢收細，背上加脊椎節。"""
    for n in list(P):
        base = n.split('.')[0]
        if base in ('upperArm', 'forearm', 'thigh', 'shin'): place(n, (.86, .86, 1), anchor(n))
    period = {'chest': .05, 'abdomen': .042, 'pelvis': .05, 'upperArm': .045, 'forearm': .04, 'thigh': .05, 'shin': .045}
    for n in list(P):
        base = n.split('.')[0]
        if base not in period: continue
        T = period[base]
        def keep(o, f, T=T, base=base):
            if role_of_face(o, f) not in ('p', 's'): return True
            c = f.calc_center_median()
            if base in ('chest', 'abdomen') and abs(c.x) < .022: return True  # 胸骨／脊椎線
            return (c.z / T) % 1 < .46
        drop_faces(n, keep)
    cmn, cmx = box(['chest', 'abdomen', 'pelvis'])
    z = cmn.z + .04
    while z < cmx.z - .05:
        y = max(c.y for c in verts_of(['chest', 'abdomen', 'pelvis']) if abs(c.x) < .03 and abs(c.z - z) < .02) + .006
        part = 'chest' if z > box('chest')[0].z else 'abdomen' if z > box('abdomen')[0].z else 'pelvis'
        append(part, prim_box((0, y, z), (.05, .028, .026), .006), lambda f: 's')
        z += .042


def recolor(name, fn):
    """fn(o, face, role) 回傳新角色（或 None 不變）"""
    def go(o, bm):
        for f in bm.faces:
            r = fn(o, f, role_of_face(o, f))
            if r: f.material_index = mat_idx(o, r)
    edit(name, go)


def no_stones():
    """Mk.85 右手背的六顆寶石（role_g_<色碼>）是 85 專屬，改造型號換成金屬鉚釘"""
    for n in list(P): recolor(n, lambda o, f, r: 't' if r.startswith('g_') else None)


def rescue():
    """Mark 49：Mk.85 收窄成女性體型（窄肩、細腰、腿收細），背後六片懸浮翼。"""
    no_stones()
    cmn, cmx = box('chest'); w0 = cmx.x
    place(['chest', 'reactor'], (.83, .88, .97), anchor('chest'))
    place('abdomen', (.74, .84, 1), anchor('abdomen'))
    place('pelvis', (.94, .88, 1), anchor('pelvis'))
    place('helmet', (.9, .92, .92), anchor('helmet', 'bot'))
    dx = cmx.x - box('chest')[1].x
    # 收窄後胸腹交界會露出縫，裡面墊一截深色腰芯
    amn, amx = box('abdomen'); c = (amn + amx) / 2
    core = prim_cyl((0, 0, 0), 1, 1, 32, 'Z')
    core.transform(Matrix.Translation((c.x, c.y, c.z)) @ Matrix.Diagonal(((amx.x - amn.x) * .44, (amx.y - amn.y) * .42, (amx.z - amn.z) * 1.5, 1)))
    append('abdomen', core, lambda f: 'k')
    for s, sg in (('L', 1), ('R', -1)):
        for n in ('pauldron.', 'upperArm.', 'forearm.', 'hand.'):
            c = anchor(n + s); k = .78 if n != 'hand.' else .86
            place(n + s, (k, k, 1), c, c - V((sg * (dx + .016), 0, 0)))
        for n, k in (('thigh.', .86), ('shin.', .8), ('boot.', .86)):
            c = anchor(n + s); place(n + s, (k, k, 1), c, c - V((sg * .012, 0, 0)))
    cmn, cmx = box('chest')
    back = max(c.y for c in verts_of(['chest']) if abs(c.x) < .06)
    for s, sg in (('L', 1), ('R', -1)):
        for i, ang in enumerate((122, 142, 162)):
            a = math.radians(ang); L = .5 - i * .06
            bm = prim_prism([(-.04, 0), (.04, 0), (.014, L), (-.014, L)], (0, 0, 0), .012, None, .003)
            ln = prim_box((0, .002, L * .45), (.008, .004, L * .7), 0)  # 背面朝外的發光線
            for b, role in ((bm, 's'), (ln, 'g')):
                b.transform(Matrix.Translation((sg * .07, back + .03 + i * .014, cmx.z - .09)) @ Matrix.Rotation(sg * a, 4, 'Y'))
                append('chest', b, lambda f, role=role: role)


def heartbreaker():
    """Mark 17：胸甲加大，正中央是巨型圓形反應爐（發光盤＋金屬環＋金色放射肋）。"""
    place(['chest'], (1.08, 1.06, 1.05), anchor('chest', 'bot'))
    place('abdomen', (1.04, 1.04, 1), anchor('abdomen'))
    rmn, rmx = box('reactor') if 'reactor' in P else box('chest')
    rz = (rmn.z + rmx.z) / 2 if 'reactor' in P else box('chest')[0].z + .17
    if 'reactor' in P: drop_faces('reactor', lambda o, f: False)
    fy = front_y('chest', 0, rz, .1)
    append('reactor', prim_cyl((0, fy + .012, rz), .15, .03, 56), lambda f: 's')
    append('reactor', prim_torus((0, fy - .006, rz), .105, .017, 56, 10), lambda f: 't')
    append('reactor', prim_cyl((0, fy - .004, rz), .088, .02, 56), lambda f: 'g')
    for i in range(8):
        a = i / 8 * math.tau
        b = prim_box((0, 0, 0), (.02, .022, .05), .004)
        b.transform(Matrix.Translation((math.cos(a) * .13, fy - .004, rz + math.sin(a) * .13)) @ Matrix.Rotation(-a + math.pi / 2, 4, 'Y'))
        append('reactor', b, lambda f: 's')


def centurion():
    """Mark 33：方正的大肩甲（銀色多面體外殼）、胸口倒三角反應爐板與立領。"""
    cmn, cmx = box('chest')
    for s, sg in (('L', 1), ('R', -1)):
        n = 'pauldron.' + s; c = anchor(n)
        bm, seams = shell([n], inflate=.03, bands=3, band_w=.06, smooth=3, s=(1.55, 1.3, 1.4), piv=c + V((sg * -.03, 0, -.04)))
        append(n, bm, lambda f, seams=seams: 'k' if f in seams else 's')
    rz = cmn.z + (cmx.z - cmn.z) * .55
    if 'reactor' in P: drop_faces('reactor', lambda o, f: False)
    fy = front_y('chest', 0, rz, .08)
    tri = [(-.13, .08), (.13, .08), (0, -.12)]
    append('reactor', prim_prism(tri, (0, fy + .012, rz), .03), lambda f: 's')
    append('reactor', prim_prism([(x * .68, z * .68 + .006) for x, z in tri], (0, fy - .016, rz), .012), lambda f: 'g')
    hmn, hmx = box('helmet')
    bm = prim_torus(((hmn.x + hmx.x) / 2, (hmn.y + hmx.y) / 2, hmn.z + .035), .095, .022, 40, 8, 'Z')
    bm.transform(Matrix.Translation(-V(((hmn.x + hmx.x) / 2, (hmn.y + hmx.y) / 2, hmn.z + .035))))
    for v in bm.verts: v.co = V((v.co.x * 1.15, v.co.y, v.co.z * 1.6))
    bm.transform(Matrix.Translation(V(((hmn.x + hmx.x) / 2, (hmn.y + hmx.y) / 2, hmn.z + .035))))
    append('chest', bm, lambda f: 's')


def nightclub():
    """Mark 16：高機動近戰型，整體收緊：四肢收細、肩甲縮小、胸甲收窄。"""
    for n in list(P):
        base = n.split('.')[0]
        if base in ('upperArm', 'forearm', 'thigh', 'shin'): place(n, (.86, .88, 1), anchor(n))
        if base == 'pauldron': place(n, (.72, .8, .8), anchor(n))
    cmn, cmx = box('chest')
    place(['chest', 'reactor'], (.93, .95, 1), anchor('chest'))
    dx = cmx.x - box('chest')[1].x
    for s, sg in (('L', 1), ('R', -1)):
        for n in ('pauldron.', 'upperArm.', 'forearm.', 'hand.'):
            c = anchor(n + s); place(n + s, (1, 1, 1), c, c - V((sg * dx, 0, 0)))


def striker():
    """Mark 25：雙前臂外側裝上黃黑條紋的氣動攻城錘（含活塞頭），前臂加粗。"""
    for s, sg in (('L', 1), ('R', -1)):
        place('forearm.' + s, (1.3, 1.3, 1), anchor('forearm.' + s))
        fmn, fmx = box('forearm.' + s); hmn, hmx = box('hand.' + s)
        zm = (fmn.z + fmx.z) / 2
        mid = [c for c in verts_of(['forearm.' + s]) if abs(c.z - zm) < .05]
        x = max(sg * c.x for c in mid) * sg + sg * .028; y = sum(c.y for c in mid) / len(mid)
        top, bot = fmx.z + .02, hmn.z - .02
        ram = prim_cyl((x, y, (top + bot) / 2), .06, top - bot, 40, 'Z', .064)
        L = top - bot; cuts = [bot + L * k / 9 for k in range(1, 9)]
        for z in cuts: cut(ram, (0, 0, z), (0, 0, 1))
        append('forearm.' + s, ram, lambda f, bot=bot, L=L: 's' if int((f.calc_center_median().z - bot) / L * 9) % 2 == 0 or abs(f.normal.z) > .9 else 'k')
        append('forearm.' + s, prim_cyl((x, y, bot - .06), .042, .12, 28, 'Z'), lambda f: 't')
        append('forearm.' + s, prim_cyl((x, y, bot - .125), .06, .03, 28, 'Z'), lambda f: 't')
        for z in (top - .03, top - L * .55):
            b = prim_box((x - sg * .05, y, z), (.07, .05, .03), .006)
            append('forearm.' + s, b, lambda f: 't')


def gemini():
    """Mark 39：背上掛次軌道推進器（主艙＋鼻錐、雙噴嘴、尾翼與金色環），胸甲略加厚。"""
    place(['chest', 'reactor'], (1.04, 1.06, 1.02), anchor('chest', 'bot'))
    cmn, cmx = box('chest')
    back = max(c.y for c in verts_of(['chest']) if abs(c.x) < .08)
    y = back + .12; zc = (cmn.z + cmx.z) / 2 + .02; L = .6
    body = prim_cyl((0, y, zc), .11, L, 40, 'Z', .1)
    for z in (zc - L * .3, zc + L * .25): cut(body, (0, 0, z), (0, 0, 1))
    append('chest', body, lambda f: 't' if abs(f.calc_center_median().z - (zc - L * .3)) < .03 or abs(f.calc_center_median().z - (zc + L * .25)) < .03 else 'p')
    append('chest', prim_cyl((0, y, zc + L / 2 + .07), .1, .14, 40, 'Z', .02), lambda f: 'p')
    for sx in (-1, 1):
        append('chest', prim_cyl((sx * .055, y, zc - L / 2 - .05), .045, .1, 24, 'Z', .06), lambda f: 'k')
        append('chest', prim_cyl((sx * .055, y, zc - L / 2 - .1), .04, .01, 24, 'Z'), lambda f: 'g')
        fin = prim_prism([(0, 0), (.12, -.05), (.12, .12), (0, .22)], (0, 0, 0), .012, None, .003)
        fin.transform(Matrix.Translation((sx * .1, y + .006, zc - L / 2 + .02)) @ Matrix.Diagonal((sx, 1, 1, 1)))
        append('chest', fin, lambda f: 's')
    for sx in (-1, 1):  # 掛架
        append('chest', prim_box((sx * .07, (back + y) / 2, zc + .12), (.035, y - back, .05), .006), lambda f: 'k')


def bleeding_edge():
    """Mark 50：Mk.85 收細一點、黑色接縫改成主色（奈米裝甲沒有螺絲接縫），背後四片推進翼與兩個推進口。"""
    no_stones()
    for n in list(P):
        base = n.split('.')[0]
        if base in ('upperArm', 'forearm', 'thigh', 'shin'): place(n, (.94, .94, 1), anchor(n))
        if base != 'helmet': recolor(n, lambda o, f, r: 'p' if r == 'k' else None)
    cmn, cmx = box('chest')
    back = max(c.y for c in verts_of(['chest']) if abs(c.x) < .08)
    for sx in (-1, 1):
        for i, (ang, L) in enumerate(((122, .2), (148, .16))):
            x0, z0 = sx * (.06 + i * .02), cmx.z - .14 - i * .04
            w = prim_prism([(-.03, 0), (.03, 0), (.012, L), (-.012, L)], (0, 0, 0), .014, None, .003)
            w.transform(Matrix.Translation((x0, back_y('chest', x0, z0, .05) - .002, z0)) @ Matrix.Rotation(sx * math.radians(ang), 4, 'Y'))
            append('chest', w, lambda f: 's')
        zn = cmn.z + .08; by = back_y(['chest', 'abdomen'], sx * .045, zn, .03)
        append('chest', prim_cyl((sx * .045, by + .01, zn), .028, .04, 24, 'Y', .022), lambda f: 'k')
        append('chest', prim_cyl((sx * .045, by + .032, zn), .02, .004, 24, 'Y'), lambda f: 'g')


DERIVE = {
    # Mark 44 已改用 Shreyash 的實體模型（bake.py）；這個改造版留作備案，輸出時不要蓋掉 assets/270/mk44.glb
    'mk44': dict(src='mk7', fn=hulkbuster),
    'mk41': dict(src='mk46', fn=bones),
    'mk49': dict(src='mk85', fn=rescue),
    'mk17': dict(src='mk7', fn=heartbreaker),
    'mk33': dict(src='mk7', fn=centurion),
    'mk16': dict(src='mk7', fn=nightclub),
    'mk25': dict(src='mk7', fn=striker),
    'mk39': dict(src='mk7', fn=gemini),
    'mk50': dict(src='mk85', fn=bleeding_edge),
}

# ---------------- 執行 ----------------
D = DERIVE[key]
if 'file' in MODELS[D['src']]:
    bpy.ops.wm.open_mainfile(filepath=os.path.join(CACHE, MODELS[D['src']]['file']))
os.environ['BAKE_NOEXPORT'] = '1'
sys.argv = [sys.argv[0], '--', D['src'], out]
g = {'__name__': 'bake', '__file__': os.path.join(HERE, 'bake.py')}
exec(compile(open(g['__file__']).read(), g['__file__'], 'exec'), g)
objs, ROLE_MATS = g['objs'], g['ROLE_MATS']
P = {o.name: o for o in objs}
D['fn']()
finish()
g['export'](objs, out, debug, dbg_roles=True)
