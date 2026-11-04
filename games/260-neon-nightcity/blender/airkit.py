# 霓虹夜城（260）機場 Blender 腳本共用的工具（airbld.py、airint.py）：遊戲座標的建構器 GB、切刀 finish、烘 AO 進頂點色 bake_ao。
# 遊戲座標：x 東、y 上、z 南（SEA_FR 框）；G() 轉成 Blender（x, −z, y），匯出 glTF 後剛好回到遊戲座標。
import math
import bmesh, bpy
from mathutils import Vector
from common import *


def G(p): return (p[0], -p[2], p[1])


class GB:
    """遊戲座標的建構器：box(x0, x1, y0, y1, z0, z1)、quad、tube、beam、直立柱 vcyl、沿 x 的柱 xcyl"""
    def __init__(self, seed): self.mb = MB(seed)
    def box(self, x0, x1, y0, y1, z0, z1, m):
        if x1 - x0 > 1e-4 and y1 - y0 > 1e-4 and z1 - z0 > 1e-4: self.mb.box(x0, x1, -z1, -z0, y0, y1, m)
    def poly(self, pts, m): self.mb.add([G(p) for p in pts], [tuple(range(len(pts)))], m)
    def strip(self, A, Bp, m):   # 兩條等長折線之間的四邊形帶（A[i]→A[i+1]→B[i+1]→B[i]）
        v = [G(p) for p in A] + [G(p) for p in Bp]; n = len(A)
        self.mb.add(v, [(i, i + 1, n + i + 1, n + i) for i in range(n - 1)], m)
    def tube(self, a, b, r, m, seg=8):
        a, b = Vector(G(a)), Vector(G(b)); d = (b - a).normalized()
        up = Vector((0, 0, 1)) if abs(d.z) < 0.95 else Vector((1, 0, 0))
        s1 = d.cross(up).normalized(); s2 = s1.cross(d).normalized()
        ring = [s1 * math.cos(2 * math.pi * i / seg) * r + s2 * math.sin(2 * math.pi * i / seg) * r for i in range(seg)]
        f = [(i, (i + 1) % seg, seg + (i + 1) % seg, seg + i) for i in range(seg)] + [tuple(reversed(range(seg))), tuple(range(seg, 2 * seg))]
        self.mb.add([a + q for q in ring] + [b + q for q in ring], [tuple(reversed(t)) for t in f], m)   # 環是繞 d 順時針，面要反過來才朝外
    def beam(self, a, b, h, m, h2=None):
        a, b = Vector(G(a)), Vector(G(b)); d = (b - a).normalized()
        up = Vector((0, 0, 1)) if abs(d.z) < 0.95 else Vector((1, 0, 0))
        s1 = d.cross(up).normalized() * h; s2 = s1.cross(d).normalized() * (h2 or h)
        v = [p + i * s1 + j * s2 for p in (a, b) for i, j in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
        self.mb.add(v, [(0, 1, 2, 3), (7, 6, 5, 4), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)], m)
    def vcyl(self, x, z, y0, y1, r, segs, m, r1=None, cap=True):
        r1 = r if r1 is None else r1
        v = [(x + r * math.cos(2 * math.pi * i / segs), -z + r * math.sin(2 * math.pi * i / segs), y0) for i in range(segs)] + [(x + r1 * math.cos(2 * math.pi * i / segs), -z + r1 * math.sin(2 * math.pi * i / segs), y1) for i in range(segs)]
        f = [(i, (i + 1) % segs, segs + (i + 1) % segs, segs + i) for i in range(segs)]
        if cap: f += [tuple(reversed(range(segs))), tuple(range(segs, 2 * segs))]
        self.mb.add(v, f, m)
    def xcyl(self, x0, x1, y, z, r, segs, m):
        ring = [(-z + r * math.cos(2 * math.pi * i / segs), y + r * math.sin(2 * math.pi * i / segs)) for i in range(segs)]
        v = [(x0, a, c) for a, c in ring] + [(x1, a, c) for a, c in ring]
        f = [(i, (i + 1) % segs, segs + (i + 1) % segs, segs + i) for i in range(segs)] + [tuple(reversed(range(segs))), tuple(range(segs, 2 * segs))]
        self.mb.add(v, f, m)
    def text(self, txt, size, o, R, N, m, depth=.1):
        """立體字：Blender 內建字型轉網格，置中在 o，字的右方是 R、上方是 +y、朝外是 N（遊戲座標的單位向量，R×up·N 要是 +1），背面貼著 o 的平面"""
        cu = bpy.data.curves.new('txt', 'FONT'); cu.body = txt; cu.size = size; cu.extrude = depth / 2; cu.resolution_u = 2
        cu.align_x = 'CENTER'; cu.align_y = 'CENTER'
        ob = bpy.data.objects.new('txt', cu); bpy.context.scene.collection.objects.link(ob)
        dg = bpy.context.evaluated_depsgraph_get(); eo = ob.evaluated_get(dg); me = eo.to_mesh()
        P = lambda c: G(tuple(o[k] + c.x * R[k] + c.y * (1.0 if k == 1 else 0.0) + (c.z + depth / 2) * N[k] for k in range(3)))
        self.mb.add([P(v.co) for v in me.vertices], [tuple(p.vertices) for p in me.polygons], m)
        eo.to_mesh_clear(); bpy.data.objects.remove(ob, do_unlink=True); bpy.data.curves.remove(cu)
    def rail(self, pts, h, m, post=1.5, r=.025):
        """欄杆：沿折線每 post 公尺一支立柱、頂上一條扶手、中間一條橫桿"""
        for a, c in zip(pts, pts[1:]):
            L = math.dist((a[0], a[2]), (c[0], c[2])); n = max(1, int(L / post))
            for i in range(n + 1):
                t = i / n; p = tuple(a[k] + (c[k] - a[k]) * t for k in range(3)); self.tube(p, (p[0], p[1] + h, p[2]), r, m, 6)
            self.tube((a[0], a[1] + h, a[2]), (c[0], c[1] + h, c[2]), r, m, 6); self.tube((a[0], a[1] + h / 2, a[2]), (c[0], c[1] + h / 2, c[2]), r * .8, m, 6)
    def build(self, name):
        # 不用 MB.build：它的 recalc_face_normals 會把開放的面（帷幕、屋頂帶、單片玻璃）翻成隔一片反一片；這裡的面都照寫的方向朝外
        mb = self.mb; me = bpy.data.meshes.new(name)
        me.from_pydata([Vector(v) for v in mb.v], [], mb.f)
        for m in mb.mats: me.materials.append(m)
        for poly, mi in zip(me.polygons, mb.fm): poly.material_index = mi; poly.use_smooth = False
        me.update()
        ob = link(bpy.data.objects.new(name, me))
        if getattr(mb, 'tv', None): ob.vertex_groups.new(name='txt').add(mb.tv, 1.0, 'REPLACE')   # 字的頂點：倒角跳過（airint.bevel）
        return ob


def ow(b, pts, m, nrm):
    """單面：照 nrm 決定繞向（雙面重疊的面在 finish 的 remove_doubles 後會被併掉，只剩一面）。畫在板面上的圖形一律用它，不要正反各畫一次"""
    a, c, d = pts[0], pts[1], pts[2]
    u = (c[0] - a[0], c[1] - a[1], c[2] - a[2]); v = (d[0] - a[0], d[1] - a[1], d[2] - a[2])
    nx = (u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0])
    b.poly(pts if nx[0] * nrm[0] + nx[1] * nrm[1] + nx[2] * nrm[2] > 0 else pts[::-1], m)


GR_H = 1.2


def finish(o, step, gr_h=None):
    gr_h = GR_H if gr_h is None else gr_h
    bm = bmesh.new(); bm.from_mesh(o.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    lo = [min(v.co[k] for v in bm.verts) for k in range(3)]; hi = [max(v.co[k] for v in bm.verts) for k in range(3)]
    for k in range(3):
        c = math.floor(lo[k] / step) * step + step
        while c < hi[k]:
            co = [0.0, 0.0, 0.0]; no = [0.0, 0.0, 0.0]; co[k] = c; no[k] = 1.0
            bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], dist=1e-4, plane_co=co, plane_no=no)
            c += step
    if lo[2] < gr_h < hi[2]:   # 牆腳髒污（bake_ao）那一條的高度多切一刀，漸層才有頂點可以存
        bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], dist=1e-4, plane_co=(0, 0, gr_h), plane_no=(0, 0, 1))
    bm.to_mesh(o.data); bm.free(); o.data.update()


def bake_ao(o, ground, dist, grime=None):
    if grime is None: grime = not o.name.startswith('air_sgn')
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = 32
    sc.render.bake.target = 'VERTEX_COLORS'
    if sc.world is None: sc.world = bpy.data.worlds.new('bake')
    sc.world.light_settings.distance = dist
    bpy.ops.mesh.primitive_plane_add(size=1, location=(o.location.x, o.location.y, o.location.z - .002))
    gnd = bpy.context.active_object; gnd.scale = (ground, ground, 1)
    ca = o.data.color_attributes.new('ao', 'BYTE_COLOR', 'CORNER')
    o.data.color_attributes.active_color = ca; o.data.color_attributes.render_color_index = o.data.color_attributes.active_color_index
    bpy.ops.object.select_all(action='DESELECT'); o.select_set(True); bpy.context.view_layer.objects.active = o
    bpy.ops.object.bake(type='AO')
    bpy.data.objects.remove(gnd, do_unlink=True)
    n = len(ca.data); buf = [0.0] * (n * 4); ca.data.foreach_get('color', buf)
    me = o.data; gr = [1.0] * n   # 牆腳的濺泥與髒污：直立的面離地 GR_H 以下往下變暗（地上 0.7）；指示牌不算（面板就在這個高度）
    for p in (me.polygons if grime else []):
        if abs(p.normal.z) > .5: continue
        for li in p.loop_indices:
            y = me.vertices[me.loops[li].vertex_index].co.z
            if y < GR_H: t = max(y, 0.0) / GR_H; gr[li] = .7 + .3 * t * t * (3 - 2 * t)
    for i in range(n):
        a = (0.35 + 0.65 * max(buf[i * 4], 0.0) ** 0.8) * gr[i]; buf[i * 4] = buf[i * 4 + 1] = buf[i * 4 + 2] = a
    ca.data.foreach_set('color', buf)
    print(f'ao  {o.name}  {len(o.data.polygons)} faces')
