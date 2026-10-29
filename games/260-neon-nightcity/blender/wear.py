"""霓虹夜城（260）的服裝：從 blender/out/people.glb 的男女身體量身做出衣服，輸出 blender/out/wear.glb（打包時內嵌）。

    node tools/wear.mjs          （Blender 無頭執行這支，再用 gltf-transform 壓縮）

做法（40-people.js 的 wearGeo 把衣服併進每個人的那份幾何，跟著同一副骨架動）：
- 貼身的衣褲鞋襪是「殼」：複製身體那一區的面（people.py 已經沿領口、袖口、腰線、膝上、腳踝切齊），
  沿平面再切出這件的長度，焊接接縫、抹平肌肉的起伏，沿法線往外推（鬆緊依部位不同），權重和身體一樣，
  邊緣往內折回身體表面（衣服有厚度，看不到縫）；口袋、腰帶、羅紋這些細節是同一片殼再往外推一層的貼片。
- 帽子、眼鏡、飾品是硬的，全部綁在一根骨頭上（Head、spine_03、hand_l…），尺寸照男女各自量。
- 前端靠網格名稱 W_<款式>_<Male|Female> 分辨；顏色與圖案在 40-people.js 的 WEAR 型錄（同一個款式可以有不同圖案）。
"""
import math
import os

import bmesh
import bpy
from mathutils import Vector

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'blender/out/people.glb')
OUT = os.path.join(ROOT, 'blender/out/wear.glb')

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)
# 眼睛與眉毛（墨鏡量這個）：瞳孔的左右距離與高度、眼球最前面、眉骨最前面
EYES = {}
for g in ('Male', 'Female'):
    ox = bpy.data.objects[g].matrix_world.translation.x
    ev = [bpy.data.objects[g + '_Eyes'].matrix_world @ v.co for v in bpy.data.objects[g + '_Eyes'].data.vertices]
    bv = [bpy.data.objects[g + '_Brows'].matrix_world @ v.co for v in bpy.data.objects[g + '_Brows'].data.vertices]
    rt = [p for p in ev if p.x > ox]
    EYES[g] = dict(px=sum(p.x - ox for p in rt) / len(rt), z=sum(p.z for p in rt) / len(rt), ey=min(p.y for p in ev), by=min(p.y for p in bv))
for o in list(bpy.data.objects):
    if o.type == 'MESH' and not o.name.endswith('_Body'):
        bpy.data.objects.remove(o, do_unlink=True)
MAT = bpy.data.materials.new('wear')
SLOT = {'skin': 0, 'top': 1, 'sleeve': 2, 'bottom': 3, 'shin': 4, 'shoe': 5}


def bone_pos(arm, name):
    return arm.matrix_world @ arm.data.bones[name].head_local


class Fig:
    """一個性別的身體：骨頭位置（世界座標，Z 朝上、-Y 是正面、T 字手臂沿 ±X）與身體網格"""

    def __init__(self, g):
        self.g = g
        self.arm = bpy.data.objects[g]
        self.body = bpy.data.objects[g + '_Body']
        self.ox = self.arm.matrix_world.translation.x   # 女性骨架在檔案裡平移了 1.2 m
        self.B = {b.name: bone_pos(self.arm, b.name) for b in self.arm.data.bones}
        mw = self.body.matrix_world
        self.top = max((mw @ v.co).z for v in self.body.data.vertices)

    def b(self, name):
        return self.B[name]


def new_obj(name, me, fig, weights=None):
    """建成骨架底下的蒙皮網格；weights=None 表示 me 已經帶了 deform 權重（複製自身體）"""
    o = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(o)
    o.parent = fig.arm
    o.matrix_parent_inverse = fig.arm.matrix_world.inverted()
    for bn in fig.arm.data.bones:
        if bn.name not in o.vertex_groups:
            o.vertex_groups.new(name=bn.name)
    if weights:
        bone, = weights
        o.vertex_groups[bone].add(list(range(len(me.vertices))), 1.0, 'REPLACE')
    md = o.modifiers.new('Armature', 'ARMATURE')
    md.object = fig.arm
    me.materials.clear()
    me.materials.append(MAT)
    return o


# ─── 殼：從身體的某幾區長出來 ───
def shell(fig, name, slots, cuts=(), off=lambda p: .008, smooth=4, rim=.006, patches=(), fields=(), regions=(), part=0, cov=None, extra=None, sub=0, collar=0., fill=0):
    """slots：要複製的身體分區；cuts：[(平面上一點, 法線)]，法線那一側切掉；off(p)：p 點往外推多少（公尺）；
    cov：穿上時退回皮膚的那組（1 上衣、2 褲裙；39-wear-items.js 照類別給 uCov），預設照 slots 推；高腰褲用到上衣區也只退褲裙那組。
    sub：場切之後整片細分幾輪（每輪每條邊對半；小腿的邊長 3 cm，襪子的堆堆皺褶、羅紋要細一點）；
    fill：補上邊數不到 fill 的破洞（鞋區：people.py 把腳趾投影到鞋楦上，擠在一起的點焊起來會留下小洞）；
    collar：小腿與鞋子交界那圈（people.py 的鞋口滾邊鼓出 1.15 cm，不在 _PMASK 裡、退不回皮膚）往內收多少，襪口才塞得進鞋口，不會翻在鞋子外面。
    extra(bm, trim, ctx)：殼做好之後再加的立體件（鐵鍊、抽繩），和殼一起從身體表面取權重；回傳一組頂點的話，那些頂點自己帶了權重（裙身），不重取。
    patches：[(場 f(p, ctx), 再往外推, 邊緣往內折, 部位)] 口袋、腰帶、羅紋這類貼片：先沿 f = 0 把殼切開（邊緣是平順的曲線，
    不會有鋸齒），f ≤ 0 的面再複製一層往外推；ctx['neck'] 是領口那圈邊緣的點。部位寫進 _trim（0 布面、1 滾邊與配色、2 金屬）
    座標一律是世界座標（女性骨架在檔案裡平移了 1.2 m，身體物件也是）"""
    src = fig.body
    me = src.data.copy()
    me.name = name
    bm = bmesh.new()
    bm.from_mesh(me)
    # people.py 的 _UNPUFF／_PMASK：穿上這件時 CHAR_VS 把上衣（1）、褲裙（2）分區鼓起來的布料退回皮膚，殼也照退回去的表面做
    flag = cov if cov is not None else (1 if {'top', 'sleeve'} & set(slots) else 0) | (2 if {'bottom', 'shin'} & set(slots) else 0)
    lu, lm = bm.verts.layers.float_vector.get('_UNPUFF'), bm.verts.layers.float.get('_PMASK')
    assert lu and lm, 'people.glb 沒有 _UNPUFF／_PMASK（先跑 tools/people.mjs）'
    for v in bm.verts:
        if int(v[lm] + .5) & flag:
            v.co -= v[lu]
    bm.verts.layers.float_vector.remove(lu)
    if bm.verts.layers.float_vector.get('_UNORM'):
        bm.verts.layers.float_vector.remove(bm.verts.layers.float_vector['_UNORM'])
    bm.verts.layers.float.remove(lm)
    bm.transform(src.matrix_world)
    from mathutils.bvhtree import BVHTree
    skin = BVHTree.FromBMesh(bm)      # 退回皮膚後的身體表面（往外推完再抹平時，量離皮膚多遠用）
    trim = bm.verts.layers.float.new('_trim')
    # 領口：上衣區與皮膚區相接的那圈（不管這件留哪些區，領口的羅紋、V 領、高領都照它量）
    nkz = fig.b('neck_01').z
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-4)     # glTF 依材質拆開了頂點，先焊回來，上衣區與皮膚區才接得上
    ringl = bm.verts.layers.float.new('_ring')
    if collar:
        for v in bm.verts:
            if {f.material_index for f in v.link_faces} >= {SLOT['shin'], SLOT['shoe']}:
                v[ringl] = 1.
    neck = [v.co.copy() for v in bm.verts if v.co.z > nkz - .08 and abs(v.co.x - fig.ox) < .13
            and {f.material_index for f in v.link_faces} >= {SLOT['skin'], SLOT['top']}]
    keep = {SLOT[s] for s in slots}
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.material_index not in keep], context='FACES')
    # people.py 的圓領錐是 8 道平面切的，頸根、頸窩（8 面交會）留下一堆細長三角形，往外推會皺成一團：3 mm 內的點先併掉
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=.003)
    bmesh.ops.dissolve_degenerate(bm, dist=1e-4, edges=bm.edges[:])
    if fill:
        bmesh.ops.holes_fill(bm, edges=[e for e in bm.edges if e.is_boundary], sides=fill)
    for co, no in cuts:
        geom = bm.verts[:] + bm.edges[:] + bm.faces[:]
        bmesh.ops.bisect_plane(bm, geom=geom, plane_co=co, plane_no=no, clear_outer=True, dist=1e-5)
    ctx = {'neck': neck, 'fig': fig}
    # 往外推的方向一律用身體原本表面的法線（附近 6 個頂點加權）：切口邊的細長三角形法線很亂，用它推會把邊緣推成鋸齒
    from mathutils.kdtree import KDTree
    bm.normal_update()
    kd, bn = KDTree(len(bm.verts)), []
    for i, v in enumerate(bm.verts):
        kd.insert(v.co, i)
        bn.append(v.normal.copy())
    kd.balance()
    def body_n(co):
        acc = Vector()
        for _, i, d in kd.find_n(co, 6):
            acc += bn[i] / (d + .004)
        return acc.normalized()
    # 抹平肌肉的起伏（在場切之前：切完再抹會把切口旁的細三角形拉過邊緣、翻面，邊上就破成一個個缺口；身體分區的邊不動）
    inner = [v for v in bm.verts if not v.is_boundary]
    orig = {v: (v.co.copy(), body_n(v.co)) for v in bm.verts}
    for _ in range(smooth):
        bmesh.ops.smooth_vert(bm, verts=inner, factor=.5, use_axis_x=True, use_axis_y=True, use_axis_z=True)
    # 抹平只留沿表面的移動：凸的地方（胸口、袖孔邊）縮進身體的部分推回原本的表面，貼身的衣服才不會被皮膚穿出來
    for v, (c, n) in orig.items():
        d = (v.co - c).dot(n)
        if d < 0:
            v.co -= n * d
    # 先全部切成三角形：每個面跨過等值線時剛好兩個交點，切口才是連續的線（四邊形會留下三角形的缺口）
    bmesh.ops.triangulate(bm, faces=bm.faces[:])
    # 純量場切：g(p, ctx) > 0 的那一側切掉（領口、袖孔、短版下擺、破洞）；邊緣沿等值線，平順不會有鋸齒
    for g in fields:
        _cut_field(bm, lambda p: g(p, ctx))
        bmesh.ops.delete(bm, geom=[f for f in bm.faces if sum(g(v.co, ctx) for v in f.verts) / len(f.verts) > 0], context='FACES')
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    for _ in range(sub):
        # 先全部三角化再每條邊切一刀：每個三角形照標準的一分四（_halve 只切跨線的邊，六邊形重新三角化會有零面積的三角形）
        bmesh.ops.triangulate(bm, faces=bm.faces[:])
        bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=1, use_grid_fill=True)
        bmesh.ops.triangulate(bm, faces=[fc for fc in bm.faces if len(fc.verts) > 3])
    for f, *_ in patches:
        _cut_field(bm, lambda p: f(p, ctx))
    for f, _ in regions:
        _cut_field(bm, lambda p: f(p, ctx))
    pre = {v: v.co.copy() for v in bm.verts}
    nrm = {v: body_n(v.co) for v in bm.verts}
    amt = {v: off(v.co) - collar * v[ringl] for v in bm.verts}
    for v in bm.verts:
        v.co += nrm[v] * amt[v]
    # 凹的地方（胸骨上的頸窩、鎖骨下）沿法線推出去會互相擠在一起、面翻過去（看得到黑洞與皺褶）：推完再抹平兩次，
    # 離皮膚不到 85% 推出量的頂點沿最近點的法線推回去（量真正的距離，不靠會聚的頂點法線）
    _relax(bm, skin, amt)
    # 切口那圈邊（往內折之前）：鞋子的鞋底沿鞋面下緣長出來（wear_shoes.py）
    ctx['rim'] = [(e.verts[0].co.copy(), e.verts[1].co.copy()) for e in bm.edges if e.is_boundary]
    _fold_rim(bm, [e for e in bm.edges if e.is_boundary], nrm, amt, rim)
    base = [fc for fc in bm.faces if all(v in pre for v in fc.verts)]
    if part:
        for v in bm.verts:
            v[trim] = PART[part] if isinstance(part, str) else part
    _dress(bm, trim, base, pre, nrm, amt, patches, regions, ctx)
    bm.verts.layers.float.remove(ringl)
    # 切了很多刀的地方會留下面積幾乎是 0 的三角形，法線算出來是亂的（看起來是一點一點的亮斑）
    bmesh.ops.dissolve_degenerate(bm, dist=2e-5, edges=bm.edges[:])
    own = extra(bm, trim, ctx) if extra else None
    _reweight(fig, bm, pre, own or ())
    bm.normal_update()
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = True
    return new_obj(name, me, fig)



def _dress(bm, trim, base, pre, nrm, amt, patches, regions, ctx):
    """貼片與換色區塊（shell 與裙身的放樣共用）：base 是推出去之前就有的面，pre／nrm／amt 是頂點推出去之前的位置、法線、推出量"""
    for f, more, prim, pp in patches:
        # 用面的平均判斷（同 regions）：_cut_field 的新點是沿邊線性內插的，非線性的場（near_neck 的 hypot、max）在那裡重算會是 +1e-4，
        # 逐點判斷會把貼著邊界的面漏掉，帶子的邊就一格格缺口
        faces = [fc for fc in base if fc.is_valid and sum(f(pre[v], ctx) for v in fc.verts) / len(fc.verts) <= 1e-5 and _mid_in(f, fc, pre, ctx)]
        _patch(bm, faces, more, prim, trim, PART[pp] if isinstance(pp, str) else pp, nrm)
    # 換色的區塊（插肩袖、假兩件的襯衫袖、蕾絲袖）：沿邊界把頂點拆開，兩邊的部位才不會在縫上內插
    for f, rp in regions:
        fs = [fc for fc in base if fc.is_valid and sum(f(pre[v], ctx) for v in fc.verts if v in pre) / len(fc.verts) <= 1e-5 and _mid_in(f, fc, pre, ctx)]
        fset = set(fs)
        edges = [e for e in {e for fc in fs for e in fc.edges} if any(lf not in fset for lf in e.link_faces)]
        if edges:
            # 拆開後複製出來的頂點不在 pre 裡：補上原本那個點推出去之前的位置（下一個區塊的判斷、_reweight 取權重都要用）
            src = {tuple(v.co): v for e in edges for v in e.verts}
            bmesh.ops.split_edges(bm, edges=edges)
            for e in bm.edges:
                for v in e.verts:
                    if v not in pre and tuple(v.co) in src and src[tuple(v.co)] in pre:
                        o = src[tuple(v.co)]
                        pre[v], nrm[v], amt[v] = pre[o], nrm[o], amt[o]
        for fc in fs:
            for v in fc.verts:
                v[trim] = PART[rp] if isinstance(rp, str) else rp


def _mid_in(f, fc, pre, ctx):
    """面的中心也要在場裡：細帶子切完會有三個點都在邊線上（平均是 0）、面卻在帶子外面的細長三角形，不排除就是一根根尖刺"""
    vs = [pre[v] for v in fc.verts if v in pre]
    return not vs or f(sum(vs, Vector()) / len(vs), ctx) <= 1e-5


def _relax(bm, skin, amt, it=3):
    """往外推完的殼再整理：裡面的頂點抹平、切口那圈沿著邊線本身抹平（鋸齒的切口變順，V 領尖這種轉角超過 50° 的不動）、
    翻過去的面（法線和皮膚相反）那幾個頂點多抹幾次；每一輪都把離皮膚不到 85% 推出量的頂點沿最近點的法線推回去"""
    def push(vs):
        for v in vs:
            loc, n, _, _ = skin.find_nearest(v.co)
            if loc is None:
                continue
            h = (v.co - loc).dot(n)
            if h < amt.get(v, .006) * .85:
                v.co += n * (amt.get(v, .006) * .85 - h)
    inner = [v for v in bm.verts if not v.is_boundary]
    ring = {}
    for v in bm.verts:
        if v.is_boundary:
            nb = [e.other_vert(v) for e in v.link_edges if e.is_boundary]
            if len(nb) == 2:
                d1, d2 = v.co - nb[0].co, nb[1].co - v.co
                if d1.length > 1e-6 and d2.length > 1e-6 and d1.angle(d2) < math.radians(50):
                    ring[v] = nb
    for _ in range(it):
        bmesh.ops.smooth_vert(bm, verts=inner, factor=.5, use_axis_x=True, use_axis_y=True, use_axis_z=True)
        new = {v: v.co * .5 + (a.co + b.co) * .25 for v, (a, b) in ring.items()}
        for v, c in new.items():
            v.co = c
        push(bm.verts)
    for _ in range(6):
        bm.normal_update()
        bad = set()
        for f in bm.faces:
            loc, n, _, _ = skin.find_nearest(f.calc_center_median())
            if loc is not None and f.normal.dot(n) < 0:
                bad.update(f.verts)
        if not bad:
            break
        bmesh.ops.smooth_vert(bm, verts=[v for v in bad if not v.is_boundary], factor=.7, use_axis_x=True, use_axis_y=True, use_axis_z=True)
        new = {v: v.co * .3 + (ring[v][0].co + ring[v][1].co) * .35 for v in bad if v in ring}
        for v, c in new.items():
            v.co = c
        push(bad)


def _body_bvh(fig):
    """身體表面（世界座標）的 BVH 與每個頂點的骨頭權重（殼重新取權重用，每個性別量一次）"""
    if getattr(fig, '_bvh', None):
        return fig._bvh
    from mathutils.bvhtree import BVHTree
    me, mw = fig.body.data, fig.body.matrix_world
    # 退回皮膚的位置（殼是照它做的；用鼓起來的表面找最近點，胸口、腋下會找到別的部位、權重錯開，動起來皮膚就穿出來）
    u, m = me.attributes['_UNPUFF'], me.attributes['_PMASK']
    co = [mw @ (v.co - u.data[i].vector if m.data[i].value > .5 else v.co) for i, v in enumerate(me.vertices)]
    polys = [tuple(p.vertices) for p in me.polygons]
    wts = [[(g.group, g.weight) for g in v.groups if g.weight > 1e-4] for v in me.vertices]
    fig._bvh = (BVHTree.FromPolygons(co, polys), co, polys, wts)
    return fig._bvh


def _reweight(fig, bm, pre, skip=()):
    """殼的每個頂點改用身體表面最近那一點的權重（那個面的角按重心座標內插）：抹平、切口、往外推過的頂點還留著原本位置的權重，
    肩膀、脖子這些權重變化快的地方動起來就會跟底下的皮膚錯開，皮膚從衣服邊緣穿出來。最多 4 根骨頭、正規化"""
    from mathutils.interpolate import poly_3d_calc
    tree, co, polys, wts = _body_bvh(fig)
    dl = bm.verts.layers.deform.verify()
    for v in bm.verts:
        if v in skip:
            continue
        p = pre.get(v, v.co)
        hit = tree.find_nearest(p)
        if hit[2] is None:
            continue
        idx = polys[hit[2]]
        bw = poly_3d_calc([co[i] for i in idx], hit[0])
        acc = {}
        for i, w in zip(idx, bw):
            for g, gw in wts[i]:
                acc[g] = acc.get(g, 0.) + gw * w
        top = sorted(acc.items(), key=lambda t: -t[1])[:4]
        tot = sum(w for _, w in top)
        if tot <= 0:
            continue
        dv = v[dl]
        dv.clear()
        for g, w in top:
            dv[g] = w / tot


def _refine(bm, f, rounds=3):
    """細線（側邊條紋、斜劃、螺旋）比一個三角形還窄時，兩端同號的邊會整條跨過去、切不到：
    邊上 1/4、1/2、3/4 的點和兩端不同號的邊對半切開（最多三輪，每輪切完重新三角化），只細分線經過的那幾格"""
    for _ in range(rounds):
        val = {v: f(v.co) for v in bm.verts}
        es = []
        for e in bm.edges:
            a, b = e.verts
            sa = val[a] < 0
            # 兩端都已經在線上（放樣的環剛好對齊線條）：邊整條就在線上，中間取樣的正負是捨入誤差，不用切
            if sa != (val[b] < 0) or e.calc_length() < .003 or abs(val[a]) < 1e-7 and abs(val[b]) < 1e-7:
                continue
            if any((f(a.co.lerp(b.co, t)) < 0) != sa for t in (.25, .5, .75)):
                es.append(e)
        if not es:
            return
        _halve(bm, es)


def _halve(bm, es):
    """這些邊對半切開、碰到的面重新三角化（不用 bmesh.ops.subdivide_edges：connect_verts 切出來的四邊形、多邊形會讓它卡死）"""
    nv = []
    for e in es:
        if e.is_valid:
            nv.append(bmesh.utils.edge_split(e, e.verts[0], .5)[1])
    fs = {fc for v in nv for fc in v.link_faces}
    bmesh.ops.triangulate(bm, faces=[fc for fc in fs if len(fc.verts) > 3])


def _cut_field(bm, f):
    """沿純量場 f = 0 的等值線把網格切開（bisect_plane 的一般化）：跨過 0 的邊插一個點（權重跟著內插），同一個面上的兩點連起來。
    帶子的兩條邊線都穿過同一個三角形時（一個面上 4 個交點）連不起來：切完還有正負兩邊頂點的面，把它的邊對半再切一次（最多三輪）"""
    _refine(bm, f)
    on = set()
    for rnd in range(4):
        # 已經切在線上的點留在 0（不連續的場在那裡重算不是 0，會一直被當成沒切到）
        val = {v: 0. if v in on else f(v.co) for v in bm.verts}
        on = {v for v in on if v.is_valid}
        for e in list(bm.edges):
            a, b = e.verts
            fa, fb = val[a], val[b]
            if (fa < 0) == (fb < 0):
                continue
            # 交點：先線性內插，不準（非線性、不連續的場：外面一律回 1 的那種）再沿邊二分找變號的地方
            t = fa / (fa - fb)
            ft = f(a.co.lerp(b.co, t))
            if abs(ft) > .25 * min(abs(fa), abs(fb)):
                lo, hi = 0., 1.
                for _ in range(14):
                    m = (lo + hi) * .5
                    if (f(a.co.lerp(b.co, m)) < 0) == (fa < 0):
                        lo = m
                    else:
                        hi = m
                t = (lo + hi) * .5
            if t * e.calc_length() < 2e-4:
                on.add(a)
            elif (1 - t) * e.calc_length() < 2e-4:
                on.add(b)
            else:
                _, nv = bmesh.utils.edge_split(e, a, t)
                val[nv] = 0.
                on.add(nv)
        # 每個面沿頂點的順序走：兩個交點之間全是正值的那一段（要切掉的角）把兩端連起來。
        # 一般是 2 個交點連一刀；細帶子的兩條邊線穿過同一個面時有 4 個交點，就是兩刀
        pairs = []
        for fc in bm.faces:
            lv = [l.vert for l in fc.loops]
            ix = [i for i, v in enumerate(lv) if v in on]
            if len(ix) < 2:
                continue
            for k, i in enumerate(ix):
                j = ix[(k + 1) % len(ix)]
                arc = lv[i + 1:j] if j > i else lv[i + 1:] + lv[:j]
                if arc and all(val[v] > 0 for v in arc):
                    pairs.append((lv[i], lv[j]))
        for a, b in pairs:
            if any(e.other_vert(a) is b for e in a.link_edges):
                continue
            fc = next((f for f in a.link_faces if b in f.verts), None)
            if fc is not None:
                bmesh.utils.face_split(fc, a, b)
        bad = [fc for fc in bm.faces if max(val.get(v, 0.) for v in fc.verts) > 1e-6 and min(val.get(v, 0.) for v in fc.verts) < -1e-6
               and max(e.calc_length() for e in fc.edges) > .004]
        if not bad or rnd == 3:
            return
        _halve(bm, [e for e in {e for fc in bad for e in fc.edges} if e.calc_length() > .004])


def _fold_rim(bm, edges, nrm, amt, rim):
    """邊緣往內折回身體表面：衣服看起來有厚度，從袖口、褲管往裡看也看不到身體與殼之間的縫"""
    if not edges:
        return
    ret = bmesh.ops.extrude_edge_only(bm, edges=edges)
    for v in [g for g in ret['geom'] if isinstance(g, bmesh.types.BMVert)]:
        src = next((e.other_vert(v) for e in v.link_edges if e.other_vert(v) in nrm), None)
        n = nrm.get(src, v.normal)
        # 寬鬆的褲管、喇叭口推出去 2–3 cm，整段折回皮膚會在褲口鼓成一圈：折進去最多 1 cm
        v.co -= n * (max(0., min(amt.get(src, .006), .01)) + rim * .4)   # 襪口塞進鞋口（collar）推出量是負的：只折 rim


def _patch(bm, faces, more, prim, trim, part, nrm=None):
    """nrm：殼頂點 → 身體表面的法線（shell 往外推用的那份）；貼片沿它推，不用細長三角形的頂點法線（羅紋領口會皺成一團）"""
    if not faces:
        return
    ret = bmesh.ops.duplicate(bm, geom=faces)
    nf = [g for g in ret['geom'] if isinstance(g, bmesh.types.BMFace)]
    nv = {v for f in nf for v in f.verts}
    vm = {}
    for a, b in ret['vert_map'].items():
        if a in nv:
            vm[a] = b
        elif b in nv:
            vm[b] = a
    bm.normal_update()
    dn = {v: nrm[vm[v]] if nrm and vm.get(v) in nrm else v.normal.copy() for v in nv}
    for v in nv:
        v.co += dn[v] * more
    edges = [e for e in {e for f in nf for e in f.edges} if sum(1 for f in e.link_faces if f in nf) == 1]
    ret2 = bmesh.ops.extrude_edge_only(bm, edges=edges)
    for v in [g for g in ret2['geom'] if isinstance(g, bmesh.types.BMVert)]:
        src = next((e.other_vert(v) for e in v.link_edges if e.other_vert(v) in dn), None)
        v.co -= (dn[src] if src else v.normal) * (more + prim)
        v[trim] = part
    for v in nv:
        v[trim] = part


def box(cx, cy, cz, hx, hy, hz, sym=None):
    """盒狀範圍的場（盒內 ≤ 0）；sym 是左右對稱軸的 x（兩側各一個）"""
    def f(p, ctx):
        x = abs(p.x - sym) if sym is not None else p.x
        return max(abs(x - cx) / hx, abs(p.y - cy) / hy, abs(p.z - cz) / hz) - 1.
    return f


def neck_ring(neck, bins=32):
    """領口那圈邊緣：照繞脖子的角度分格平均高度與半徑（領口的羅紋、V 領照這個切，等值線才是平順的曲線，不是一顆顆點的扇形）
    回傳 (cx, cy, at)；at(p) → (那個角度的領口高度, 半徑, p 離脖子中心的水平距離)"""
    if not neck:
        return None
    cx, cy = sum(q.x for q in neck) / len(neck), sum(q.y for q in neck) / len(neck)
    ang = lambda p: (math.atan2(p.x - cx, -(p.y - cy)) / (2 * math.pi) % 1.) * bins
    acc = [[0., 0., 0] for _ in range(bins)]
    for q in neck:
        k = int(ang(q)) % bins
        acc[k][0] += q.z
        acc[k][1] += math.hypot(q.x - cx, q.y - cy)
        acc[k][2] += 1
    zr = [(a / n, r / n) if n else None for a, r, n in acc]
    for _ in range(bins):
        for k in range(bins):
            if zr[k] is None:
                zr[k] = zr[k - 1] if zr[k - 1] is not None else zr[(k + 1) % bins]
    def at(p):
        t = ang(p)
        k, u = int(t) % bins, t - int(t)
        a, b = zr[k], zr[(k + 1) % bins]
        return a[0] * (1 - u) + b[0] * u, a[1] * (1 - u) + b[1] * u, math.hypot(p.x - cx, p.y - cy)
    at.cx, at.cy = cx, cy
    return at


def near_neck(w):
    """領口往下（往外）w 的一圈（≤ 0 是羅紋那一圈）：高度在領口下 w 以內、離脖子中心不超過領口半徑 + w"""
    def f(p, ctx):
        if not _ring(ctx):
            return 1.
        z, r, d = ctx['ring'](p)
        return max((z - w) - p.z, d - (r + w))
    return f


def _ring(ctx):
    if 'ring' not in ctx:
        ctx['ring'] = neck_ring(ctx['neck'])
    return ctx['ring']


def neckline(drop):
    """領口往下挖：drop(a) 是繞脖子角度 a（0 正前、±π 正後，往 +X 為正）的下挖深度（公尺）；> 0 的地方切掉"""
    def g(p, ctx):
        R = _ring(ctx)
        z, r, d = R(p)
        fx, fy = p.x - ctx['fig'].ox, p.y - R.cy
        a = math.atan2(fx, -fy)
        return p.z - (z - drop(a)) if d < r + .09 else -1.
    return g


def collar_up(h):
    """高領：留下領口往上 h 的脖子（皮膚區），更上面切掉"""
    def g(p, ctx):
        z, r, d = _ring(ctx)(p)
        return p.z - (z + h)
    return g


def arm_cut(fig, t, a='upperarm', b='lowerarm', tilt=0.):
    """垂直於手臂的平面（t：0 在 a 骨頭、1 在 b 骨頭），手那一側切掉；tilt 讓切口前後斜（袖口往後下斜）"""
    P = {}
    for sd, sg in (('l', 1), ('r', -1)):
        A, B = fig.b(f'{a}_{sd}'), fig.b(f'{b}_{sd}')
        n = (B - A).normalized()
        n = (n + Vector((0, tilt, 0))).normalized()
        P[sg] = (A + (B - A) * t, n)
    def g(p, ctx):
        c, n = P[1 if p.x > fig.ox else -1]
        return (p - c).dot(n)
    return g


def below(z):
    """下擺：z 以下切掉（短版上衣）；z 可以是 z(p)"""
    return lambda p, ctx: (z(p) if callable(z) else z) - p.z


def holes(lst):
    """破洞：[(中心, 半徑 (rx, ry, rz))]，洞裡切掉"""
    def g(p, ctx):
        return max(1. - math.sqrt(((p.x - c[0]) / r[0]) ** 2 + ((p.y - c[1]) / r[1]) ** 2 + ((p.z - c[2]) / r[2]) ** 2) for c, r in lst)
    return g


# ─── 硬的：綁在一根骨頭上 ───
def rigid(fig, name, bone, build, weight=None):
    """build(bm, fig, trim)：在 bm 裡建模，trim 是 _trim 圖層（部位編號見 PART）。
    weight(co) → [(骨頭, 權重)]：不是整件綁在 bone 上的（杜拉格的尾巴跟著脖子、斜背包的背帶跟著胸口）"""
    bm = bmesh.new()
    trim = bm.verts.layers.float.new('_trim')
    build(bm, fig, trim)
    me = bpy.data.meshes.new(name)
    bm.normal_update()
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = True
    if weight is None:
        return new_obj(name, me, fig, weights=(bone,))
    o = new_obj(name, me, fig)
    for v in me.vertices:
        for bn, w in weight(v.co):   # 網格是世界座標（new_obj 的 matrix_parent_inverse）
            if w > 0:
                o.vertex_groups[bn].add([v.index], w, 'REPLACE')
    return o


# 部位（_trim，40-people.js CHAR_FS 的 s == 10 照這個上色）
PART = dict(cloth=0, b=1, silver=2, gold=3, glow=4, lens=5, gloss=6, c=7, mesh=8, plain=9, metal=10, hex=11, pearl=12, fleece=13, skin=14, nail=15)


def head_frame(fig):
    """頭顱的量測：帽帶高度、左右半寬、前後中心與半深（量身體頭部的頂點）"""
    mw = fig.body.matrix_world
    hz = fig.top
    band = hz - (.062 if fig.g == 'Male' else .058)
    vs = [mw @ v.co for v in fig.body.data.vertices if (mw @ v.co).z > band - .01]
    vs = [p for p in vs if abs(p.x - fig.ox) < .1]
    rx = max(abs(p.x - fig.ox) for p in vs) + .010
    y0, y1 = min(p.y for p in vs) - .011, max(p.y for p in vs) + .010
    return dict(z=band, top=hz, rx=rx, cy=(y0 + y1) / 2, ry=(y1 - y0) / 2, x=fig.ox)


def _mark(bm, trim, before, part):
    for v in bm.verts[before:]:
        v[trim] = part


def cap_six(bm, fig, trim, brim=.072, crown=1.0, flat=0.0):
    """六片式棒球帽：帽冠六道縫線與頂扣、後方調節帶開口、往下彎的帽簷（上下兩面有厚度）"""
    H = head_frame(fig)
    segs, rings = 36, 9
    rz = (H['top'] - H['z']) + .016 * crown
    rows = []
    for ri in range(rings + 1):
        el = ri / rings * math.pi * .5
        prof = math.cos(el) ** (.80 - .2 * flat)
        row = []
        for si in range(segs):
            a = si / segs * 2 * math.pi            # 0 = 正前方（-Y）
            dx, dy = math.sin(a), -math.cos(a)
            seam = -.0012 * (abs(math.sin(a * 3)) ** 16) * math.sin(el + .3)   # 六道縫線往內壓
            back = -.010 * max(0., dy) * (1 - ri / rings) ** 2               # 後面往下包住後腦
            front = .006 * max(0., -dy) * math.sin(el * 2)                   # 前片挺起來
            r = prof + seam
            row.append(bm.verts.new((H['x'] + dx * H['rx'] * r, H['cy'] + dy * (H['ry'] + front) * r,
                                     H['z'] + back + math.sin(el) * rz * (1 - .12 * flat * math.sin(el)))))
        rows.append(row)
    for ri in range(rings):
        for si in range(segs):
            sn = (si + 1) % segs
            # 後方調節帶的開口（帽帶以上兩格、正後方三格）
            if ri < 2 and (segs // 2 - 2) <= si <= (segs // 2):
                continue
            bm.faces.new((rows[ri][si], rows[ri][sn], rows[ri + 1][sn], rows[ri + 1][si]))
    top = bm.verts.new((H['x'], H['cy'], H['z'] + rz + .002))
    for si in range(segs):
        bm.faces.new((rows[rings][si], rows[rings][(si + 1) % segs], top))
    # 內面（從帽簷下往上看不會看到背面剔除後的空洞）：整頂帽冠往內 4 mm 反向複製
    ret = bmesh.ops.duplicate(bm, geom=list(bm.faces))
    inner = [g for g in ret['geom'] if isinstance(g, bmesh.types.BMFace)]
    bm.normal_update()
    for v in {v for f in inner for v in f.verts}:
        v.co -= v.normal * .004
    bmesh.ops.reverse_faces(bm, faces=inner)
    # 頂扣
    bm.verts.ensure_lookup_table()
    n0 = len(bm.verts)
    bmesh.ops.create_uvsphere(bm, u_segments=10, v_segments=6, radius=.0075,
                              matrix=_mat_t((H['x'], H['cy'], H['z'] + rz + .004)))
    bm.verts.ensure_lookup_table()
    _mark(bm, trim, n0, 1)
    # 帽簷：從前方 150° 的帽帶往外伸，往下彎，邊緣圓角，上下兩層加厚度
    n0 = len(bm.verts)
    n_a, n_r = 22, 6
    span = math.radians(150)
    top_layer, bot_layer = [], []
    for ri in range(n_r + 1):
        t = ri / n_r
        rt, rb = [], []
        for ai in range(n_a + 1):
            a = -span / 2 + span * ai / n_a
            dx, dy = math.sin(a), -math.cos(a)
            edge = math.cos(a / (span / 2) * math.pi / 2) ** .55             # 兩側收窄
            ext = brim * t * edge
            px = H['x'] + dx * (H['rx'] * .985 + ext * .55)
            py = H['cy'] + dy * (H['ry'] * .985 + ext)
            pz = H['z'] + .002 - .022 * t * t * edge - .008 * (dx * dx) * t   # 往下彎、兩側再彎一點
            rt.append(bm.verts.new((px, py, pz + .0025)))
            rb.append(bm.verts.new((px, py, pz - .0025)))
        top_layer.append(rt)
        bot_layer.append(rb)
    for ri in range(n_r):
        for ai in range(n_a):
            bm.faces.new((top_layer[ri][ai], top_layer[ri + 1][ai], top_layer[ri + 1][ai + 1], top_layer[ri][ai + 1]))
            bm.faces.new((bot_layer[ri][ai], bot_layer[ri][ai + 1], bot_layer[ri + 1][ai + 1], bot_layer[ri + 1][ai]))
    for ai in range(n_a):   # 外緣
        bm.faces.new((top_layer[n_r][ai], bot_layer[n_r][ai], bot_layer[n_r][ai + 1], top_layer[n_r][ai + 1]))
    for ri in range(n_r):   # 兩側
        bm.faces.new((top_layer[ri][0], bot_layer[ri][0], bot_layer[ri + 1][0], top_layer[ri + 1][0]))
        bm.faces.new((top_layer[ri][n_a], top_layer[ri + 1][n_a], bot_layer[ri + 1][n_a], bot_layer[ri][n_a]))
    bm.verts.ensure_lookup_table()
    _mark(bm, trim, n0, 1)
    # 調節帶的金屬扣
    n0 = len(bm.verts)
    for s in (-1, 1):
        bmesh.ops.create_cube(bm, size=1, matrix=_mat_t((H['x'] + s * .012, H['cy'] + H['ry'] * .97, H['z'] + .012)) @ _mat_s((.010, .004, .008)))
    bm.verts.ensure_lookup_table()
    _mark(bm, trim, n0, 2)


def _mat_t(p):
    from mathutils import Matrix
    return Matrix.Translation(Vector(p))


def _mat_s(s):
    from mathutils import Matrix
    return Matrix.Diagonal((s[0], s[1], s[2], 1))


def _mat(p=(0, 0, 0), rot=(0, 0, 0), s=(1, 1, 1)):
    """平移 × 旋轉（XYZ 歐拉角，弧度）× 縮放"""
    from mathutils import Euler, Matrix
    return Matrix.Translation(Vector(p)) @ Euler(rot, 'XYZ').to_matrix().to_4x4() @ Matrix.Diagonal((s[0], s[1], s[2], 1))


# ─── 硬配件的建模工具：一圈一圈的頂點列、帽簷、管子、各種基本形 ───
def _part(bm, trim, part):
    """之後新加的頂點標成這個部位：with _part(bm, trim, 'gold'): …
    （刪過頂點的網格，新頂點會填進刪掉的空位，不一定排在最後；所以記下原本有哪些，不用 bm.verts[n0:]）"""
    class _P:
        def __enter__(self):
            self.old = set(bm.verts)
        def __exit__(self, *a):
            p = PART[part] if isinstance(part, str) else part
            for v in bm.verts:
                if v not in self.old:
                    v[trim] = p
    return _P()


def _skin(bm, rows, closed=True, skip=None, cap=None, flip=False):
    """rows：由下往上一圈圈的頂點（每圈同樣多個，角度從正前方往 +X 繞）；cap：最上面收成一點的座標"""
    for ri in range(len(rows) - 1):
        n = len(rows[ri])
        for si in range(n if closed else n - 1):
            sn = (si + 1) % n
            if skip and skip(ri, si):
                continue
            q = (rows[ri][si], rows[ri][sn], rows[ri + 1][sn], rows[ri + 1][si])
            bm.faces.new(q[::-1] if flip else q)
    if cap is not None:
        top = bm.verts.new(cap)
        n = len(rows[-1])
        for si in range(n if closed else n - 1):
            q = (rows[-1][si], rows[-1][(si + 1) % n], top)
            bm.faces.new(q[::-1] if flip else q)


def _inner(bm, faces, d):
    """殼的內面：整片往內 d 反向複製（從帽簷下、帽口往裡看不會看到背面剔除後的空洞）"""
    ret = bmesh.ops.duplicate(bm, geom=list(faces))
    inner = [g for g in ret['geom'] if isinstance(g, bmesh.types.BMFace)]
    bm.normal_update()
    for v in {v for f in inner for v in f.verts}:
        v.co -= v.normal * d
    bmesh.ops.reverse_faces(bm, faces=inner)
    return inner


def _ang(segs, si):
    a = si / segs * 2 * math.pi
    return a, math.sin(a), -math.cos(a)      # 0 = 正前方（-Y）


def dome(bm, H, rz, segs=36, rings=10, prof=None, r=None, z0=None, cap=True, skip=None):
    """頭頂的帽冠：prof(el, a) 是那一點的水平縮放（el 0 帽口 → π/2 頂）、r(el, a) → (dx 倍率, dy 倍率, dz) 額外變形"""
    z0 = H['z'] if z0 is None else z0
    rows = []
    for ri in range(rings + 1):
        el = ri / rings * math.pi * .5
        row = []
        for si in range(segs):
            a, dx, dy = _ang(segs, si)
            k = prof(el, a) if prof else math.cos(el) ** .8
            ex, ey, ez = r(el, a) if r else (1, 1, 0)
            row.append(bm.verts.new((H['x'] + dx * H['rx'] * k * ex, H['cy'] + dy * H['ry'] * k * ey, z0 + math.sin(el) * rz + ez)))
        rows.append(row)
    f0 = len(bm.faces)
    _skin(bm, rows, skip=skip, cap=(H['x'], H['cy'], z0 + rz + .001) if cap else None)
    bm.faces.ensure_lookup_table()
    return rows, bm.faces[f0:]


def brim(bm, H, z, ext, drop=lambda a, t: 0., span=2 * math.pi, segs=48, nr=6, th=.0025, k0=.985, edge=None, a0=0.):
    """帽簷：從帽口（橢圓縮 k0）往外伸 ext(a)，往下 drop(a, t)（t 0 內緣 → 1 外緣，可以是負的＝往上翹）；上下兩層、外緣與兩側封起來"""
    full = span >= 2 * math.pi - 1e-6
    na = segs if full else segs + 1
    top, bot = [], []
    for ri in range(nr + 1):
        t = ri / nr
        rt, rb = [], []
        for ai in range(na):
            a = (ai / segs * 2 * math.pi) if full else (a0 - span / 2 + span * ai / segs)   # a0：不完整的帽簷置中在哪個方向（0 正前、π 正後）
            dx, dy = math.sin(a), -math.cos(a)
            e = ext(a) * t
            px, py = H['x'] + dx * (H['rx'] * k0 + e), H['cy'] + dy * (H['ry'] * k0 + e)
            pz = z - drop(a, t)
            rt.append(bm.verts.new((px, py, pz + th)))
            rb.append(bm.verts.new((px, py, pz - th)))
        top.append(rt)
        bot.append(rb)
    nseg = na if full else na - 1
    for ri in range(nr):
        for ai in range(nseg):
            an = (ai + 1) % na
            bm.faces.new((top[ri][ai], top[ri + 1][ai], top[ri + 1][an], top[ri][an]))
            bm.faces.new((bot[ri][ai], bot[ri][an], bot[ri + 1][an], bot[ri + 1][ai]))
    for ai in range(nseg):
        an = (ai + 1) % na
        bm.faces.new((top[nr][ai], bot[nr][ai], bot[nr][an], top[nr][an]))
        bm.faces.new((top[0][ai], top[0][an], bot[0][an], bot[0][ai]))
    if not full:
        for ri in range(nr):
            bm.faces.new((top[ri][0], bot[ri][0], bot[ri + 1][0], top[ri + 1][0]))
            bm.faces.new((top[ri][na - 1], top[ri + 1][na - 1], bot[ri + 1][na - 1], bot[ri][na - 1]))
    return top, bot


def band(bm, H, z0, z1, k=1.0, segs=48, th=.003, ry_k=1.0, wave=None):
    """帽口的一圈帶子（帽帶、反摺、緞帶）：外層與內層，上下封口；wave(a) 讓下緣起伏"""
    rows = []
    for kk in (k, k - th / H['rx']):
        lo, hi = [], []
        for si in range(segs):
            a, dx, dy = _ang(segs, si)
            w = wave(a) if wave else 0.
            px, py = H['x'] + dx * H['rx'] * kk, H['cy'] + dy * H['ry'] * kk * ry_k
            lo.append(bm.verts.new((px, py, z0 + w)))
            hi.append(bm.verts.new((px, py, z1)))
        rows.append((lo, hi))
    (ol, oh), (il, ih) = rows
    _skin(bm, [ol, oh])
    _skin(bm, [il, ih], flip=True)
    _skin(bm, [oh, ih])
    _skin(bm, [il, ol])


def tube(bm, pts, r, seg=8, close=True):
    """沿折線掃一個圓（繩子、鏡框、背帶的邊）"""
    pts = [Vector(p) for p in pts]
    rings = []
    for i, p in enumerate(pts):
        t = (pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]).normalized()
        u = t.cross(Vector((0, 0, 1)))
        if u.length < 1e-4:
            u = t.cross(Vector((1, 0, 0)))
        u.normalize()
        w = t.cross(u)
        rings.append([bm.verts.new(p + (u * math.cos(k / seg * 2 * math.pi) + w * math.sin(k / seg * 2 * math.pi)) * r) for k in range(seg)])
    _skin(bm, rings)
    if close:
        for ring, c in ((rings[0], pts[0]), (rings[-1], pts[-1])):
            cv = bm.verts.new(c)
            for k in range(seg):
                q = (ring[k], ring[(k + 1) % seg], cv)
                bm.faces.new(q[::-1] if ring is rings[0] else q)


def ball(bm, p, r, s=(1, 1, 1), u=12, v=8, rot=(0, 0, 0)):
    bmesh.ops.create_uvsphere(bm, u_segments=u, v_segments=v, radius=r, matrix=_mat(p, rot, s))


def cube(bm, p, s, rot=(0, 0, 0)):
    bmesh.ops.create_cube(bm, size=1, matrix=_mat(p, rot, s))


def cyl(bm, p, r1, r2, h, rot=(0, 0, 0), seg=16):
    bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=r1, radius2=r2, depth=h, matrix=_mat(p, rot))


def ring(bm, p, R, r, rot=(0, 0, 0), seg=24, sseg=8):
    """圓環（金屬環、扣眼、耳環）"""
    rows = []
    for i in range(seg + 1):
        a = i / seg * 2 * math.pi
        rows.append([Vector((math.cos(a) * (R + r * math.cos(b)), math.sin(a) * (R + r * math.cos(b)), r * math.sin(b)))
                     for b in [k / sseg * 2 * math.pi for k in range(sseg)]])
    m = _mat(p, rot)
    vs = [[bm.verts.new(m @ q) for q in row] for row in rows[:-1]]
    vs.append(vs[0])
    _skin(bm, vs)


def split_faces(bm, faces):
    """把這些面從網格上拆開（頂點複製一份），標不同部位時邊界的頂點才不會被兩邊內插"""
    ret = bmesh.ops.split(bm, geom=list(faces))
    return {g for g in ret['geom'] if isinstance(g, bmesh.types.BMVert)}


# ─── 帽子（short.md 的 H-01～H-15）───
def hat_trucker(bm, fig, trim):
    """H-02 卡車司機帽：高挺的泡棉前片、後半圈網眼（部位 mesh）、微彎帽簷、後方塑膠調節扣"""
    H = head_frame(fig)
    rz = (H['top'] - H['z']) + .026
    kw = dict(segs=36, rings=10, prof=lambda el, a: math.cos(el) ** (.62 if math.cos(a) > 0 else .8),
              r=lambda el, a: (1, 1 + .06 * max(0., math.cos(a)) * math.sin(el * 1.6), -.008 * max(0., -math.cos(a)) * (1 - el / 1.57) ** 2))
    # 前片與後面的網眼分兩次建（邊界的頂點各一份，部位才不會在縫上內插）：網眼是正後方左右各 100°
    is_back = lambda si: 8 < si < 27
    _, ff = dome(bm, H, rz, skip=lambda ri, si: is_back(si), cap=True, **kw)
    _inner(bm, ff, .004)
    with _part(bm, trim, 'mesh'):
        _, fb = dome(bm, H, rz, skip=lambda ri, si: not is_back(si) or (ri < 2 and 16 <= si <= 18), cap=False, **kw)
        _inner(bm, fb, .004)
    with _part(bm, trim, 'b'):
        brim(bm, H, H['z'] + .003, lambda a: .074 * math.cos(a / (math.radians(75)) * math.pi / 2) ** .5, lambda a, t: .016 * t * t,
             span=math.radians(150), segs=22, nr=6)
        ball(bm, (H['x'], H['cy'], H['z'] + rz + .004), .0075, v=6)
    with _part(bm, trim, 'gloss'):
        for s in (-1, 1):
            cube(bm, (H['x'] + s * .011, H['cy'] + H['ry'] * .985, H['z'] + .011), (.016, .004, .006))


def _mark_verts(trim, vs, part):
    for v in vs:
        v[trim] = PART[part]


def hat_bucket(bm, fig, trim, brim_w=.058, angle=25, crown_h=.072, wide=False, cord=False):
    """H-03 鐘形漁夫帽／H-04 奔尼帽：桶狀帽冠、往下斜的整圈帽簷（車縫線的同心圈是幾何上的淺溝）"""
    H = head_frame(fig)
    zb = H['z'] - .004
    top_z = H['top'] + .012
    rows = []
    for ri in range(9):
        t = ri / 8
        row = []
        for si in range(40):
            a, dx, dy = _ang(40, si)
            if t < .78:
                k, z = 1.02 - .04 * t, zb + (top_z - zb) * t / .78 * .92
            else:
                u = (t - .78) / .22
                k, z = (1.02 - .04 * .78) * math.cos(u * 1.4) ** .6, zb + (top_z - zb) * (.92 + .08 * math.sin(u * 1.57))
            soft = .004 * math.sin(a * 3 + 1) * t if wide else 0.
            row.append(bm.verts.new((H['x'] + dx * (H['rx'] * k + soft), H['cy'] + dy * (H['ry'] * k + soft), z)))
        rows.append(row)
    f0 = len(bm.faces)
    _skin(bm, rows, cap=(H['x'], H['cy'], top_z + .001))
    bm.faces.ensure_lookup_table()
    _inner(bm, bm.faces[f0:], .004)
    tan = math.tan(math.radians(angle))
    wav = (lambda a, t: brim_w * t * tan + .01 * t * t * (1 + math.sin(a * 3)) * .5) if wide else (lambda a, t: brim_w * t * tan)
    brim(bm, H, zb + .002, lambda a: brim_w * (1.04 if wide else 1), wav, segs=48, nr=7, k0=1.02, th=.0022)
    with _part(bm, trim, 'b'):
        band(bm, H, zb + .002, zb + .02, k=1.03, th=.0025)
    if cord:
        with _part(bm, trim, 'silver'):
            for s in (-1, 1):
                ring(bm, (H['x'] + s * H['rx'] * 1.0, H['cy'], zb + .045), .0045, .0012, rot=(0, math.pi / 2, 0))
        with _part(bm, trim, 'c'):
            for s in (-1, 1):
                x0 = H['x'] + s * H['rx'] * 1.03
                tube(bm, [(x0, H['cy'] - .005, zb + .005), (x0 - s * .004, H['cy'] - .03, zb - .06), (H['x'] + s * .03, H['cy'] - .075, zb - .125),
                          (H['x'], H['cy'] - .08, zb - .135)], .0016, seg=6)
            cube(bm, (H['x'], H['cy'] - .082, zb - .132), (.012, .008, .016))   # 束繩扣


def hat_flatback(bm, fig, trim):
    """H-05 反戴平沿棒球帽：硬挺的高帽冠、平直的帽簷轉到後面，前額露出調節帶的開口與扣帶；側面金色皇冠貼布"""
    H = head_frame(fig)
    rz = (H['top'] - H['z']) + .024
    rows, faces = dome(bm, H, rz, prof=lambda el, a: math.cos(el) ** .55)
    # 反戴的開口不挖穿（挖穿會看到被帽子藏起來的頭髮缺口），改成前額一塊深色的拱形網底，上面橫著調節扣帶
    _inner(bm, faces, .004)
    with _part(bm, trim, 'b'):
        brim(bm, H, H['z'] + .004, lambda a: .078 * math.cos((a - math.pi) / math.radians(70) * math.pi / 2) ** .35 if abs(a - math.pi) < math.radians(70) else 0.,
             lambda a, t: .002 * t, span=math.radians(140), segs=24, nr=5, th=.003, a0=math.pi)
        ball(bm, (H['x'], H['cy'], H['z'] + rz + .004), .0075, v=6)
    with _part(bm, trim, 'mesh'):
        ball(bm, (H['x'], H['cy'] - H['ry'] * 1.0, H['z'] + .012), 1., s=(.028, .0035, .02), u=16, v=8)
    with _part(bm, trim, 'c'):
        for s in (-1, 1):
            cube(bm, (H['x'] + s * .013, H['cy'] - H['ry'] * 1.0 - .003, H['z'] + .012), (.022, .003, .007))
    with _part(bm, trim, 'silver'):
        cube(bm, (H['x'], H['cy'] - H['ry'] * 1.0 - .0045, H['z'] + .012), (.008, .002, .009))
    # 側面的皇冠：三個尖的金色立體貼布
    with _part(bm, trim, 'gold'):
        xs, yc, zc = H['x'] + H['rx'] * 1.0 + .004, H['cy'] + .006, H['z'] + .03
        cube(bm, (xs, yc, zc), (.004, .03, .01))
        for k in (-1, 0, 1):
            bmesh.ops.create_cone(bm, cap_ends=True, segments=4, radius1=.006, radius2=0, depth=.014 + .004 * (k == 0),
                                  matrix=_mat((xs, yc + k * .011, zc + .011), (0, 0, math.pi / 4)))


def hat_beanie(bm, fig, trim, high=.012, slouch=0., cuff=.03, horns=False, pin=False):
    """H-06 反摺水兵毛帽／H-07 惡魔角針織冷帽：貼頭的針織帽冠（下緣離耳朵 1 cm）、雙層反摺；slouch 是後面垂下來的長度"""
    H = head_frame(fig)
    z0 = H['z'] + high
    rz = H['top'] - z0 + .014 + slouch * .4
    rows, faces = dome(bm, H, rz, segs=40, rings=12, prof=lambda el, a: math.cos(el) ** .72,
                       r=lambda el, a: (1.02, 1.02 + slouch * 1.6 * max(0., -math.cos(a + math.pi)) * math.sin(el) ** 2 / H['ry'],
                                        -slouch * .3 * max(0., -math.cos(a + math.pi)) * math.sin(el) ** 3), z0=z0)
    _inner(bm, faces, .004)
    with _part(bm, trim, 'cloth'):
        band(bm, H, z0 - .002, z0 + cuff, k=1.065, th=.005, wave=lambda a: -.002 * math.sin(a * 2))
    if horns:
        with _part(bm, trim, 'c'):
            for s in (-1, 1):
                pts, rs = [], []
                for i in range(8):
                    t = i / 7
                    pts.append((H['x'] + s * (H['rx'] * .55 + .028 * t + .012 * t * t), H['cy'] - .005 - .01 * t, H['top'] + .002 + .058 * t - .012 * t * t))
                rings_ = []
                for i, p in enumerate(pts):
                    r = .024 * (1 - i / 7) ** .85 + .0008
                    rings_.append([bm.verts.new((p[0] + r * math.cos(k / 10 * 6.283), p[1] + r * math.sin(k / 10 * 6.283), p[2])) for k in range(10)])
                _skin(bm, rings_, cap=(pts[-1][0] + s * .003, pts[-1][1], pts[-1][2] + .006))
    if pin:
        with _part(bm, trim, 'silver'):
            x, y, z = H['x'] + .03, H['cy'] - H['ry'] * 1.07, z0 + cuff * .55
            tube(bm, [(x - .016, y, z), (x + .016, y, z + .003)], .0011, seg=6)
            tube(bm, [(x - .016, y - .0015, z - .003), (x + .016, y - .0015, z)], .0011, seg=6)
            ring(bm, (x - .018, y - .0008, z - .0015), .003, .0009, rot=(math.pi / 2, 0, 0))


def hat_beret(bm, fig, trim):
    """H-08 斜戴貝雷帽：向右傾 15° 的扁圓盤、包邊的帽口、頂上的小帽蒂"""
    H = head_frame(fig)
    z0 = H['z'] + .004
    tilt = math.radians(15)
    rows = []
    rings = 12
    for ri in range(rings + 1):
        t = ri / rings
        row = []
        for si in range(44):
            a, dx, dy = _ang(44, si)
            # 帽口 → 往外鼓到最寬（1.38 倍）→ 收到頂；高度只比頭頂高一點
            if t < .35:
                k, z = 1.0 + .38 * math.sin(t / .35 * math.pi / 2), z0 + .022 * t / .35
            else:
                u = (t - .35) / .65
                k, z = 1.38 * math.cos(u * math.pi / 2) ** .7, z0 + .022 + (H['top'] + .016 - z0 - .022) * math.sin(u * math.pi / 2) ** 1.4
            x, y = dx * H['rx'] * k, dy * H['ry'] * k
            # 向右（+X）傾：右邊壓低、左邊抬高
            z += -x * math.sin(tilt) * (t > .1) * min(1., t * 3)
            row.append(bm.verts.new((H['x'] + x + .012, H['cy'] + y, z)))
        rows.append(row)
    f0 = len(bm.faces)
    _skin(bm, rows, cap=(H['x'] + .012, H['cy'], H['top'] + .017 - .012 * math.sin(tilt)))
    bm.faces.ensure_lookup_table()
    _inner(bm, bm.faces[f0:], .003)
    with _part(bm, trim, 'gloss'):
        band(bm, H, z0 - .004, z0 + .006, k=1.02, th=.003)
    with _part(bm, trim, 'cloth'):
        cyl(bm, (H['x'] + .012, H['cy'], H['top'] + .02 - .012 * math.sin(tilt)), .0035, .002, .012, seg=8)


def hat_cowboy(bm, fig, trim):
    """H-09 牛仔帽：中間凹陷的高帽冠、兩側往上捲的寬帽簷（上下兩面）、松石與銀扣的帽帶"""
    H = head_frame(fig)
    z0 = H['z'] - .002
    ch = .105
    rows = []
    for ri in range(11):
        t = ri / 10
        row = []
        for si in range(44):
            a, dx, dy = _ang(44, si)
            k = 1.07 - .1 * t * t
            z = z0 + ch * t
            if t > .7:   # 頂上的凹陷（前後一道長的、前面兩側捏進去）
                u = (t - .7) / .3
                k *= 1 - .5 * u * u
                z = z0 + ch * (.7 + .3 * math.sin(u * math.pi / 2)) - .03 * u * u * (1 - abs(dx) * 1.4) - .012 * u * max(0., -dy) * abs(dx)
            row.append(bm.verts.new((H['x'] + dx * H['rx'] * k * (1 - .06 * max(0., -dy) * t), H['cy'] + dy * H['ry'] * k, z)))
        rows.append(row)
    f0 = len(bm.faces)
    _skin(bm, rows, cap=(H['x'], H['cy'], z0 + ch - .024))
    bm.faces.ensure_lookup_table()
    _inner(bm, bm.faces[f0:], .004)
    brim(bm, H, z0 + .003, lambda a: .088 + .012 * abs(math.sin(a)), lambda a, t: -.05 * (t ** 2.2) * math.sin(a) ** 2 + .012 * t * math.cos(a) ** 2,
         segs=56, nr=8, k0=1.07, th=.0028)
    with _part(bm, trim, 'b'):
        band(bm, H, z0 + .004, z0 + .02, k=1.085, th=.0025)
    with _part(bm, trim, 'c'):
        for k in range(10):
            a = k / 10 * 2 * math.pi + .3
            ball(bm, (H['x'] + math.sin(a) * H['rx'] * 1.105, H['cy'] - math.cos(a) * H['ry'] * 1.105, z0 + .012), .0042, u=8, v=6)
    with _part(bm, trim, 'silver'):
        a = math.pi * .5
        cyl(bm, (H['x'] + H['rx'] * 1.11, H['cy'], z0 + .012), .009, .009, .003, rot=(0, math.pi / 2, 0), seg=12)


def hat_visor(bm, fig, trim):
    """H-10 賽博遮陽空頂帽：中空的帽圈（條碼燈帶）、前面一大片往下彎的弧形透明鏡片（離鼻樑 18 mm 以上）"""
    H = head_frame(fig)
    z0 = H['z'] + .004
    with _part(bm, trim, 'b'):
        band(bm, H, z0, z0 + .032, k=1.04, th=.006)
    with _part(bm, trim, 'glow'):
        band(bm, H, z0 + .012, z0 + .02, k=1.047, th=.002)
    with _part(bm, trim, 'lens'):
        span, na, nr = math.radians(150), 28, 6
        top, bot = [], []
        for ri in range(nr + 1):
            t = ri / nr
            rt, rb = [], []
            for ai in range(na + 1):
                a = -span / 2 + span * ai / na
                dx, dy = math.sin(a), -math.cos(a)
                w = math.cos(a / (span / 2) * math.pi / 2) ** .4
                ext = .028 + .03 * t * w
                px, py = H['x'] + dx * (H['rx'] * 1.05 + ext * .3), H['cy'] + dy * (H['ry'] * 1.05 + ext)
                pz = z0 + .004 - .085 * t * w - .01 * (1 - w)
                rt.append(bm.verts.new((px, py, pz + .0012)))
                rb.append(bm.verts.new((px, py - dy * .0024, pz - .0012)))
            top.append(rt)
            bot.append(rb)
        for ri in range(nr):
            for ai in range(na):
                bm.faces.new((top[ri][ai], top[ri][ai + 1], top[ri + 1][ai + 1], top[ri + 1][ai]))
                bm.faces.new((bot[ri][ai], bot[ri + 1][ai], bot[ri + 1][ai + 1], bot[ri][ai + 1]))
        for ai in range(na):
            bm.faces.new((top[nr][ai], top[nr][ai + 1], bot[nr][ai + 1], bot[nr][ai]))
        for ri in range(nr):
            bm.faces.new((top[ri][0], top[ri + 1][0], bot[ri + 1][0], bot[ri][0]))
            bm.faces.new((top[ri][na], bot[ri][na], bot[ri + 1][na], top[ri + 1][na]))
    with _part(bm, trim, 'silver'):
        for s in (-1, 1):
            cyl(bm, (H['x'] + s * H['rx'] * 1.0, H['cy'] - H['ry'] * .62, z0 + .016), .006, .006, .006, rot=(0, math.pi / 2, 0), seg=12)


def hat_ushanka(bm, fig, trim):
    """H-11 俄羅斯毛帽：厚的圓柱帽身、兩側往上翻綁在頂上的護耳、前片翻起；絨毛的厚度直接建在殼上（外緣起伏）"""
    H = head_frame(fig)
    z0 = H['z'] - .008
    ch = .12
    rows = []
    for ri in range(10):
        t = ri / 9
        row = []
        for si in range(48):
            a, dx, dy = _ang(48, si)
            fuzz = .0025 * math.sin(a * 23 + t * 9) * math.sin(a * 7 - t * 5)
            k = 1.18 - .02 * t
            row.append(bm.verts.new((H['x'] + dx * (H['rx'] * k + fuzz), H['cy'] + dy * (H['ry'] * k + fuzz), z0 + ch * t)))
        rows.append(row)
    # 頂：微微隆起的平頂
    for ri in range(1, 5):
        u = ri / 4
        row = []
        for si in range(48):
            a, dx, dy = _ang(48, si)
            k = 1.16 * math.cos(u * math.pi / 2) ** .5
            row.append(bm.verts.new((H['x'] + dx * H['rx'] * k, H['cy'] + dy * H['ry'] * k, z0 + ch + .012 * math.sin(u * math.pi / 2))))
        rows.append(row)
    f0 = len(bm.faces)
    _skin(bm, rows, cap=(H['x'], H['cy'], z0 + ch + .013))
    bm.faces.ensure_lookup_table()
    _inner(bm, bm.faces[f0:], .008)
    # 翻起來的護耳與前片：貼在帽身外面的厚片
    for a0, w, h in ((math.pi / 2, .075, .085), (-math.pi / 2, .075, .085), (0, .12, .05)):
        dx, dy = math.sin(a0), -math.cos(a0)
        R = (H['rx'] if abs(dx) > .5 else H['ry']) * 1.18 + .011
        cx, cy = H['x'] + dx * R, H['cy'] + dy * R
        rot = (0, 0, -a0)
        ball(bm, (cx, cy, z0 + h / 2 + .006), 1., s=(w / 2, .011, h / 2), u=16, v=10, rot=rot)   # 翻起來的毛片：圓角的厚片
    with _part(bm, trim, 'c'):
        tube(bm, [(H['x'] - H['rx'] * 1.2, H['cy'], z0 + .09), (H['x'], H['cy'] + .01, z0 + ch + .016), (H['x'] + H['rx'] * 1.2, H['cy'], z0 + .09)], .0018, seg=6)


def hat_newsboy(bm, fig, trim):
    """H-12 報童八角帽：八片拼接的蓬鬆帽冠往前蓋過帽簷、短硬的帽簷縫在前緣、頂上一顆包布扣"""
    H = head_frame(fig)
    z0 = H['z'] + .002
    rows = []
    for ri in range(12):
        t = ri / 11
        row = []
        for si in range(48):
            a, dx, dy = _ang(48, si)
            puff = math.sin(t * math.pi) ** .8
            seam = -.004 * (abs(math.cos(a * 4)) ** 12) * puff
            k = (1.0 + .3 * puff * (1 - t) ** .3 + seam / H['rx']) * (1 - t ** 3 * .96)
            fwd = .03 * puff * max(0., -dy)          # 前面往前蓋
            back = -.012 * max(0., dy) * (1 - t)
            z = z0 + .052 * math.sin(t * math.pi / 2) ** .9 - .004 * t ** 4 + back - .01 * max(0., -dy) * t * (1 - t)
            row.append(bm.verts.new((H['x'] + dx * H['rx'] * k, H['cy'] + dy * (H['ry'] * k + fwd * (1 if dy < 0 else 0)), z)))
        rows.append(row)
    f0 = len(bm.faces)
    _skin(bm, rows, cap=(H['x'], H['cy'] - .006, z0 + .05))
    bm.faces.ensure_lookup_table()
    _inner(bm, bm.faces[f0:], .004)
    with _part(bm, trim, 'b'):
        brim(bm, H, z0 + .001, lambda a: .045 * math.cos(a / math.radians(60) * math.pi / 2) ** .6, lambda a, t: .012 * t, span=math.radians(120), segs=20, nr=4, th=.0028)
        band(bm, H, z0 - .003, z0 + .008, k=1.0, th=.003)
    with _part(bm, trim, 'cloth'):
        ball(bm, (H['x'], H['cy'] - .006, z0 + .052), .008, s=(1, 1, .5))


def hat_durag(bm, fig, trim):
    """H-13 杜拉格頭巾：整頂貼著頭殼（前緣在額頭、後面包到後頸）、正中一道縫線、後面兩條垂下來的綁帶（跟著脖子與上背動）"""
    H = head_frame(fig)
    rows, faces = dome(bm, H, (H['top'] - H['z']) + .02, segs=44, rings=12, z0=H['z'] - .008,
                       prof=lambda el, a: math.cos(el) ** .78,
                       r=lambda el, a: (1.0, 1.0 + .03 * max(0., math.cos(a + math.pi)) * (1 - el / 1.57),
                                        -.06 * max(0., math.cos(a + math.pi)) ** 1.5 * max(0., 1 - el / 1.5708) ** 1.5))
    _inner(bm, faces, .003)
    with _part(bm, trim, 'cloth'):
        tube(bm, [(H['x'], H['cy'] - H['ry'] * 1.0, H['z'] + .01), (H['x'], H['cy'] - H['ry'] * .6, H['top'] + .012),
                  (H['x'], H['cy'], H['top'] + .021), (H['x'], H['cy'] + H['ry'] * .7, H['top'] + .005), (H['x'], H['cy'] + H['ry'] * 1.02, H['z'] - .02)], .0022, seg=6)
    # 綁帶：從後腦的結垂到上背，一條稍長、往兩邊散開
    nk = fig.b('neck_01')
    for s, L in ((-1, .2), (1, .17)):
        pts = []
        for i in range(9):
            t = i / 8
            pts.append(Vector((H['x'] + s * (.012 + .03 * t), H['cy'] + H['ry'] * 1.06 + .02 * math.sin(t * 2) , H['z'] - .045 - L * t)))
        rows_ = []
        for i, p in enumerate(pts):
            w = .028 - .008 * (i / 8)
            rows_.append([bm.verts.new(p + Vector((-w / 2, 0, 0))), bm.verts.new(p + Vector((w / 2, 0, 0))),
                          bm.verts.new(p + Vector((w / 2, .003, 0))), bm.verts.new(p + Vector((-w / 2, .003, 0)))])
        _skin(bm, rows_)
    ball(bm, (H['x'], H['cy'] + H['ry'] * 1.04, H['z'] - .04), .016, s=(1.2, .7, .9))


def durag_weight(fig):
    """頭巾的綁帶：脖子以下慢慢從 Head 換到 neck_01、spine_03"""
    H = head_frame(fig)
    zn, zs = H['z'] - .06, H['z'] - .2
    def w(co):
        if co.z > zn:
            return [('Head', 1.)]
        t = min(1., (zn - co.z) / (zn - zs))
        return [('Head', max(0., 1 - t * 1.6)), ('neck_01', 1 - abs(t - .5) * 1.2), ('spine_03', max(0., t * 1.4 - .4))]
    return w


def hat_helmet(bm, fig, trim):
    """H-14 戰術頭盔：高切耳的 FAST 盔殼、兩側導軌、前面的夜視儀支架（上翻）與四眼鏡筒"""
    H = head_frame(fig)
    z0 = H['z'] - .02
    rz = H['top'] - z0 + .022
    rows, faces = dome(bm, H, rz, segs=48, rings=12, z0=z0,
                       prof=lambda el, a: math.cos(el) ** .6,
                       r=lambda el, a: (1.16, 1.14, .03 * abs(math.sin(a)) ** 3 * (1 - el / 1.57) ** 2 + .006 * max(0., -math.cos(a)) * (1 - el / 1.57)))
    _inner(bm, faces, .006)
    with _part(bm, trim, 'gloss'):
        for s in (-1, 1):
            x = H['x'] + s * H['rx'] * 1.17
            cube(bm, (x, H['cy'], z0 + .05), (.008, .09, .016), rot=(0, s * .25, 0))
            cube(bm, (x - s * .004, H['cy'] + .035, z0 + .038), (.012, .02, .03))   # 側邊的燈座
        # 夜視儀的底座與上翻支架
        cube(bm, (H['x'], H['cy'] - H['ry'] * 1.14 - .004, z0 + .055), (.04, .012, .03), rot=(-.35, 0, 0))
        cube(bm, (H['x'], H['cy'] - H['ry'] * 1.14 - .02, z0 + .085), (.028, .02, .012), rot=(-.9, 0, 0))
    # 四眼鏡筒：上翻收在盔前，鏡頭朝前上方（約 33°）
    d = Vector((0, -math.sin(1.0), math.cos(1.0)))
    base = Vector((H['x'], H['cy'] - H['ry'] * 1.14 - .03, z0 + .1))
    tubes = ((-.034, 0), (-.012, .008), (.012, .008), (.034, 0))
    with _part(bm, trim, 'b'):
        cube(bm, base + Vector((0, .004, .006)), (.088, .02, .022), rot=(1.0 - math.pi / 2, 0, 0))
        for dx, dz in tubes:
            cyl(bm, base + Vector((dx, 0, dz)) + d * .03, .0105, .0118, .046, rot=(1.0, 0, 0), seg=12)
    with _part(bm, trim, 'lens'):
        for dx, dz in tubes:
            cyl(bm, base + Vector((dx, 0, dz)) + d * .054, .009, .009, .003, rot=(1.0, 0, 0), seg=12)
    with _part(bm, trim, 'c'):
        for s in (-1, 1):
            x = H['x'] + s * H['rx'] * 1.0
            # Y 字下巴帶：耳前、耳後兩條在耳下會合，再貼著下顎繞到下巴底下
            tube(bm, [(x, H['cy'] - .03, z0 + .02), (x - s * .004, H['cy'] - .012, z0 - .05)], .0022, seg=6)
            tube(bm, [(x, H['cy'] + .03, z0 + .02), (x - s * .004, H['cy'] - .008, z0 - .05)], .0022, seg=6)
            tube(bm, [(x - s * .004, H['cy'] - .01, z0 - .05), (x - s * .016, H['cy'] - .02, z0 - .1), (H['x'] + s * .03, H['cy'] - .04, z0 - .132), (H['x'], H['cy'] - .045, z0 - .138)], .0022, seg=6)
    with _part(bm, trim, 'b'):
        ball(bm, (H['x'], H['cy'] - .046, z0 - .136), .016, s=(1.3, 1, .45))   # 下巴墊


def hat_panama(bm, fig, trim):
    """H-15 巴拿馬草帽：前面捏出凹痕的淚滴帽冠、寬帽簷（前低後高、外緣抽鬚不齊）、海軍藍條紋緞帶"""
    H = head_frame(fig)
    z0 = H['z'] - .001
    ch = .092
    rows = []
    for ri in range(11):
        t = ri / 10
        row = []
        for si in range(48):
            a, dx, dy = _ang(48, si)
            k = 1.05 - .08 * t
            z = z0 + ch * t
            if t > .65:
                u = (t - .65) / .35
                k *= 1 - .55 * u * u
                z = z0 + ch * (.65 + .35 * math.sin(u * math.pi / 2)) - .022 * u * u * (1 - abs(dx)) * (1 if dy < .3 else .4)
            pinch = .14 * max(0., -dy) ** 4 * abs(dx) * t if t > .5 else 0.
            row.append(bm.verts.new((H['x'] + dx * H['rx'] * k * (1 - pinch), H['cy'] + dy * H['ry'] * k * (1 + .04 * max(0., dy) * t), z)))
        rows.append(row)
    f0 = len(bm.faces)
    _skin(bm, rows, cap=(H['x'], H['cy'] + .004, z0 + ch - .02))
    bm.faces.ensure_lookup_table()
    _inner(bm, bm.faces[f0:], .004)
    brim(bm, H, z0 + .003, lambda a: .07 + .004 * math.sin(a * 37) * math.sin(a * 11), lambda a, t: (.014 * max(0., math.cos(a)) - .012 * max(0., -math.cos(a))) * t,
         segs=72, nr=7, k0=1.05, th=.0022)
    with _part(bm, trim, 'b'):
        band(bm, H, z0 + .004, z0 + .024, k=1.065, th=.0022)
    with _part(bm, trim, 'c'):
        band(bm, H, z0 + .011, z0 + .016, k=1.069, th=.0012)
        cube(bm, (H['x'] + H['rx'] * .7, H['cy'] - H['ry'] * .78, z0 + .014), (.006, .016, .022), rot=(0, 0, .7))   # 側邊的蝴蝶結


# ─── 款式表（證明階段：一件上衣、一件短褲、一頂帽子）───
# 墨鏡（G-01～G-15）、上衣（T-02～T-15）在另外的檔：跟這裡共用同一組工具與全域
exec(open(os.path.join(ROOT, 'blender/wear_glasses.py'), encoding='utf-8').read())
exec(open(os.path.join(ROOT, 'blender/wear_tops.py'), encoding='utf-8').read())
exec(open(os.path.join(ROOT, 'blender/wear_pants.py'), encoding='utf-8').read())
exec(open(os.path.join(ROOT, 'blender/wear_skirts.py'), encoding='utf-8').read())
exec(open(os.path.join(ROOT, 'blender/wear_jackets.py'), encoding='utf-8').read())
exec(open(os.path.join(ROOT, 'blender/wear_socks.py'), encoding='utf-8').read())
exec(open(os.path.join(ROOT, 'blender/wear_shoes.py'), encoding='utf-8').read())
exec(open(os.path.join(ROOT, 'blender/wear_acc.py'), encoding='utf-8').read())


def build_all():
    for g in ('Male', 'Female'):
        F = Fig(g)
        ox = F.ox
        pel, sp3, nk = F.b('pelvis'), F.b('spine_03'), F.b('neck_01')
        th, cf = F.b('thigh_l'), F.b('calf_l')
        waist = pel.z + (.075 if g == 'Male' else .085)

        # 寬版短袖 T（boxy tee）：身體上衣區，袖子在上臂一半，胸腰之間放鬆、下擺多 1.2 cm 垂墜，羅紋領口與胸前口袋
        def tee_off(p):
            body = .0095 + .010 * max(0., min(1., (sp3.z - p.z) / (sp3.z - waist)))     # 胸口貼一點、腰部鬆
            arm = .012 if abs(p.x - ox) > .2 else 0.
            return body + arm
        shell(F, f'W_tee_boxy_{g}', ['top'], off=tee_off, smooth=5, rim=.007, fields=[neckline(lambda a: .004)], patches=[
            (near_neck(.017), .0025, .002, 1),                                          # 羅紋領口（配色）
            (box(ox + .11, -.12, sp3.z + .04, .045, .08, .055), .0022, .002, 0),          # 左胸口袋
        ])

        # 工作短褲（cargo shorts）：膝上 9 cm 的長度、褲管外擴、腰頭加寬、兩側立體口袋
        hem = cf.z + (.115 if g == 'Male' else .13)
        def sh_off(p):
            flare = .012 * max(0., min(1., (pel.z - p.z) / (pel.z - hem)))
            return .010 + flare
        shell(F, f'W_short_cargo_{g}', ['bottom'], cuts=[(Vector((ox, 0, hem)), Vector((0, 0, -1)))], off=sh_off, smooth=4, rim=.008, patches=[
            (lambda p, ctx: (waist - .045) - p.z, .003, .002, 1),                         # 腰頭（配色）
            (box(.2, .03, hem + .14, .09, .062, .075, sym=ox), .006, .003, 0),           # 側邊口袋
            (box(.2, .03, hem + .232, .09, .068, .016, sym=ox), .0085, .003, 0),         # 口袋蓋
        ])

        # 帽子（H-01～H-15）：全部綁在 Head 上，杜拉格的綁帶另外跟著脖子
        rigid(F, f'W_cap_six_{g}', 'Head', lambda bm, fig, trim: cap_six(bm, fig, trim))
        HATS = dict(
            trucker=hat_trucker,
            bucket=lambda bm, fig, trim: hat_bucket(bm, fig, trim),
            boonie=lambda bm, fig, trim: hat_bucket(bm, fig, trim, brim_w=.078, angle=14, wide=True, cord=True),
            flatback=hat_flatback,
            beanie_fisher=lambda bm, fig, trim: hat_beanie(bm, fig, trim, high=.014, cuff=.032),
            beanie_horn=lambda bm, fig, trim: hat_beanie(bm, fig, trim, high=.004, slouch=.05, cuff=.026, horns=True, pin=True),
            beret=hat_beret, cowboy=hat_cowboy, visor=hat_visor, ushanka=hat_ushanka, newsboy=hat_newsboy,
            helmet=hat_helmet, panama=hat_panama,
        )
        for k, fn in HATS.items():
            rigid(F, f'W_{k}_{g}', 'Head', fn)
        rigid(F, f'W_durag_{g}', 'Head', hat_durag, weight=durag_weight(F))
        for k, fn in GLASSES.items():
            rigid(F, f'W_{k}_{g}', 'Head', fn)
        build_tops(F, g)
        build_pants(F, g)
        build_skirts(F, g)
        build_jackets(F, g)
        build_socks(F, g)
        build_shoes(F, g)
        build_acc(F, g)


build_all()
for o in list(bpy.data.objects):
    if o.type == 'MESH' and o.name.endswith('_Body'):
        bpy.data.objects.remove(o, do_unlink=True)
for a in list(bpy.data.actions):
    bpy.data.actions.remove(a)
os.makedirs(os.path.dirname(OUT), exist_ok=True)
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', export_animations=False, export_texcoords=False,
                          export_normals=True, export_skins=True, export_morph=False, export_def_bones=False, export_materials='PLACEHOLDER',
                          export_attributes=True, export_extras=True)   # extras：鞋子的 lift／flex（wear_shoes.py）
print('wrote', OUT, os.path.getsize(OUT), sorted(o.name for o in bpy.data.objects if o.type == 'MESH'))
