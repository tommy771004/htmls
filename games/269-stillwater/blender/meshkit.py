# 靜水釣遊（269）env.py／fish.py 共用的網格產生器：直接組頂點與面（Blender 座標，Z 朝上），
# 每個面帶材質索引與（可選）頂點色，最後 build() 成一個物件。比 bpy.ops 拼零件快，也好控制段數。
import bpy, bmesh, math, random
from mathutils import Vector, Matrix


class MB:
    def __init__(self):
        self.v = []        # 頂點座標
        self.f = []        # 面（頂點索引 tuple）
        self.fm = []       # 每個面的材質索引
        self.col = []      # 每個頂點的顏色（線性 RGBA），只有 fish 用
        self.mats = []     # 材質物件（依索引）

    def mi(self, m):
        if m not in self.mats:
            self.mats.append(m)
        return self.mats.index(m)

    def vert(self, p, c=None):
        self.v.append(Vector(p))
        self.col.append(c)
        return len(self.v) - 1

    def face(self, idx, m):
        self.f.append(tuple(idx))
        self.fm.append(self.mi(m))

    # ---- 基本形 ----
    def box(self, center, size, m, rz=0.0, m_top=None, rx=0.0, ry=0.0):
        """中心、尺寸 (x, y, z)；rz/rx/ry 為度數（先 x、再 y、最後 z）。m_top：頂面另一個材質。"""
        cx, cy, cz = center
        sx, sy, sz = (s / 2 for s in size)
        R = (Matrix.Rotation(math.radians(rz), 3, 'Z') @ Matrix.Rotation(math.radians(ry), 3, 'Y')
             @ Matrix.Rotation(math.radians(rx), 3, 'X'))
        pts = [Vector((x, y, z)) for z in (-sz, sz) for y in (-sy, sy) for x in (-sx, sx)]
        b = len(self.v)
        for p in pts:
            self.vert(R @ p + Vector(center))
        q = lambda a, b_, c, d: (b + a, b + b_, b + c, b + d)
        self.face(q(0, 2, 3, 1), m)          # 底
        self.face(q(4, 5, 7, 6), m_top or m)  # 頂
        self.face(q(0, 1, 5, 4), m)          # -y
        self.face(q(2, 6, 7, 3), m)          # +y
        self.face(q(0, 4, 6, 2), m)          # -x
        self.face(q(1, 3, 7, 5), m)          # +x
        return self

    def tube(self, p0, p1, r0, r1, sides, m, cap0=True, cap1=True, m_cap=None, phase=0.0, squash=1.0):
        """p0→p1 的錐管（r1=0 時尖頂）。m_cap：端面材質（原木端面用）。"""
        p0, p1 = Vector(p0), Vector(p1)
        ax = (p1 - p0)
        L = ax.length
        ax.normalize()
        up = Vector((0, 0, 1)) if abs(ax.z) < 0.95 else Vector((1, 0, 0))
        u = ax.cross(up).normalized()
        w = ax.cross(u).normalized()
        ring = lambda c, r: [self.vert(c + (u * math.cos(a) + w * math.sin(a) * squash) * r)
                             for a in (phase + 2 * math.pi * i / sides for i in range(sides))]
        A = ring(p0, r0)
        if r1 <= 1e-5:
            t = self.vert(p1)
            for i in range(sides):
                self.face((A[i], A[(i + 1) % sides], t), m)
        else:
            B = ring(p1, r1)
            for i in range(sides):
                j = (i + 1) % sides
                self.face((A[i], A[j], B[j], B[i]), m)
            if cap1:
                self.face(tuple(B), m_cap or m)
        if cap0:
            self.face(tuple(reversed(A)), m_cap or m)
        return self

    def ngon_fan(self, pts, m, flip=False):
        idx = [self.vert(p) for p in pts]
        self.face(tuple(reversed(idx)) if flip else tuple(idx), m)

    def hull(self, pts, mat_of_face):
        """凸包（岩石）：mat_of_face(normal, center) → 材質。"""
        bm = bmesh.new()
        for p in pts:
            bm.verts.new(p)
        r = bmesh.ops.convex_hull(bm, input=bm.verts)
        for g in r.get('geom_interior', []) + r.get('geom_unused', []):
            if isinstance(g, bmesh.types.BMVert) and g.is_valid and not g.link_faces:
                bm.verts.remove(g)
        bmesh.ops.dissolve_limit(bm, angle_limit=math.radians(4), verts=bm.verts[:], edges=bm.edges[:])
        bm.normal_update()
        b = len(self.v)
        mp = {}
        for vv in bm.verts:
            mp[vv.index if False else vv] = self.vert(vv.co.copy())
        for fc in bm.faces:
            c = fc.calc_center_median()
            self.face([mp[vv] for vv in fc.verts], mat_of_face(fc.normal.copy(), c))
        bm.free()
        return self

    def transform(self, M, start=0):
        for i in range(start, len(self.v)):
            self.v[i] = M @ self.v[i]

    # ---- 輸出 ----
    def build(self, name, smooth=False, colors=False):
        me = bpy.data.meshes.new(name)
        me.from_pydata([tuple(p) for p in self.v], [], self.f)
        for m in self.mats:
            me.materials.append(m)
        for p, i in zip(me.polygons, self.fm):
            p.material_index = i
            p.use_smooth = smooth
        if colors:
            ca = me.color_attributes.new('Color', 'FLOAT_COLOR', 'POINT')
            for i, c in enumerate(self.col):
                ca.data[i].color = c or (1, 1, 1, 1)
            me.color_attributes.active_color = ca
        me.validate(clean_customdata=False)
        me.update()
        o = bpy.data.objects.new(name, me)
        bpy.context.scene.collection.objects.link(o)
        return o


def jitter_obj(o, amount, seed=1, keep_z_below=None):
    """同位置頂點推同樣的量（不裂開）。keep_z_below：z 小於此值的頂點只推 xy（底面保持平）。"""
    rnd = random.Random(seed)
    cache = {}
    for v in o.data.vertices:
        k = tuple(round(c, 3) for c in v.co)
        if k not in cache:
            cache[k] = Vector((rnd.uniform(-1, 1), rnd.uniform(-1, 1), rnd.uniform(-1, 1))) * amount
        d = cache[k].copy()
        if keep_z_below is not None and v.co.z < keep_z_below:
            d.z = 0
        v.co += d
    return o


def merge_close(o, dist=1e-4):
    bm = bmesh.new()
    bm.from_mesh(o.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=dist)
    bm.to_mesh(o.data)
    bm.free()
    o.data.update()
    return o
