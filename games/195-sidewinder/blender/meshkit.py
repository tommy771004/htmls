# bmesh 建模小工具（Blender 座標：X 前、Y 左、Z 上）。
# 顏色走材質：每種顏色一個材質，自訂屬性 sw_srgb（十六進位 sRGB）與 sw_alpha（255 / 0 塗裝 / 128 發光）。
import math

import bmesh
import bpy
from mathutils import Matrix, Vector

from common import hex_rgb, srgb_to_linear, A_NORMAL, A_PAINT, A_GLOW

# 塗裝預覽色（glb 檢查時用；SWMS 內仍是灰階亮度）
PAINT_PREVIEW = '#9c3b22'


def material(key, srgb, alpha=A_NORMAL, rough=0.8, metal=0.0):
    name = f'sw_{key}'
    m = bpy.data.materials.get(name)
    if m:
        return m
    m = bpy.data.materials.new(name)
    m['sw_srgb'] = srgb
    m['sw_alpha'] = int(alpha)
    shown = srgb
    if alpha == A_PAINT:
        # 預覽：用鐵鏽紅乘上灰階亮度
        g = hex_rgb(srgb)[0]
        pr = hex_rgb(PAINT_PREVIEW)
        shown = '#%02x%02x%02x' % tuple(int(c * g * 255) for c in pr)
    lin = [srgb_to_linear(c) for c in hex_rgb(shown)] + [1.0]
    m.diffuse_color = lin
    try:
        bsdf = m.node_tree.nodes.get('Principled BSDF') if m.node_tree else None
        if bsdf:
            bsdf.inputs['Base Color'].default_value = lin
            bsdf.inputs['Roughness'].default_value = rough
            bsdf.inputs['Metallic'].default_value = metal
            if alpha == A_GLOW:
                bsdf.inputs['Emission Color'].default_value = lin
                bsdf.inputs['Emission Strength'].default_value = 0.6
    except (AttributeError, KeyError, TypeError):
        pass
    return m


class Builder:
    def __init__(self, name):
        self.name = name
        self.bm = bmesh.new()
        self.mats = []

    def mi(self, mat):
        if mat not in self.mats:
            self.mats.append(mat)
        return self.mats.index(mat)

    def face(self, verts, mat):
        f = self.bm.faces.new(verts)
        f.material_index = self.mi(mat)
        f.smooth = False
        return f

    def poly(self, pts, mat):
        return self.face([self.bm.verts.new(p) for p in pts], mat)

    def box(self, x0, x1, y0, y1, z0, z1, mat, skip=(), mats=None, shape=None):
        # 軸對齊盒子；skip 可略過 '-x' '+x' '-y' '+y' '-z' '+z' 面；mats 可逐面指定材質
        # shape(v:Vector) → Vector 可改頂點（例如斜面）
        c = [Vector((x, y, z)) for z in (z0, z1) for y in (y0, y1) for x in (x0, x1)]
        if shape:
            c = [shape(v.copy()) for v in c]
        v = [self.bm.verts.new(p) for p in c]
        # 索引：x + 2y + 4z
        faces = {
            '-z': (0, 2, 3, 1), '+z': (4, 5, 7, 6),
            '-y': (0, 1, 5, 4), '+y': (2, 6, 7, 3),
            '-x': (0, 4, 6, 2), '+x': (1, 3, 7, 5),
        }
        out = {}
        for k, idx in faces.items():
            if k in skip:
                continue
            out[k] = self.face([v[i] for i in idx], (mats or {}).get(k, mat))
        return out

    def beam(self, a, b, w, mat, h=None, caps=False):
        # 兩點之間的方柱（截面 w×h），不含端面
        a, b = Vector(a), Vector(b)
        d = (b - a)
        ax = d.normalized()
        up = Vector((0, 0, 1)) if abs(ax.z) < 0.95 else Vector((1, 0, 0))
        s1 = ax.cross(up).normalized()
        s2 = s1.cross(ax).normalized()
        h = h or w
        corners = [s1 * w / 2 + s2 * h / 2, -s1 * w / 2 + s2 * h / 2, -s1 * w / 2 - s2 * h / 2, s1 * w / 2 - s2 * h / 2]
        ra = [self.bm.verts.new(a + c) for c in corners]
        rb = [self.bm.verts.new(b + c) for c in corners]
        for k in range(4):
            self.face([ra[k], rb[k], rb[(k + 1) % 4], ra[(k + 1) % 4]], mat)
        if caps:
            self.face(ra, mat)
            self.face(list(reversed(rb)), mat)

    def revolve(self, prof, seg, mat_of, center=(0, 0, 0), axis='Z', cap_top=None, cap_bot=None, phase=0.0):
        # 旋轉剖面 prof = [(r, h), ...]（由下往上）；mat_of(i) 給第 i 段材質
        cx, cy, cz = center
        rings = []
        for (r, hh) in prof:
            ring = []
            if r < 1e-6:
                # 尖端：整圈共用一個頂點
                p = (cx, cy, cz + hh) if axis == 'Z' else ((cx, cy + hh, cz) if axis == 'Y' else (cx + hh, cy, cz))
                v = self.bm.verts.new(p)
                rings.append([v] * seg)
                continue
            for k in range(seg):
                a = 2 * math.pi * k / seg + phase
                ca, sa = math.cos(a) * r, math.sin(a) * r
                if axis == 'Z':
                    p = (cx + ca, cy + sa, cz + hh)
                elif axis == 'Y':
                    p = (cx + ca, cy + hh, cz + sa)
                else:
                    p = (cx + hh, cy + ca, cz + sa)
                ring.append(self.bm.verts.new(p))
            rings.append(ring)
        flip = axis == 'Y'
        for i in range(len(rings) - 1):
            A, B = rings[i], rings[i + 1]
            for k in range(seg):
                q = [A[k], A[(k + 1) % seg], B[(k + 1) % seg], B[k]]
                if flip:
                    q.reverse()
                u = []
                for v in q:
                    if v not in u:
                        u.append(v)
                if len(u) >= 3:
                    self.face(u, mat_of(i))
        if cap_top and prof[-1][0] > 1e-6:
            r = rings[-1] if not flip else list(reversed(rings[-1]))
            self.face(r, cap_top)
        if cap_bot and prof[0][0] > 1e-6:
            r = list(reversed(rings[0])) if not flip else rings[0]
            self.face(r, cap_bot)
        return rings

    def cyl(self, center, r, h, seg, mat, axis='Z', top=True, bot=False, r2=None):
        return self.revolve([(r, 0), (r2 if r2 is not None else r, h)], seg, lambda i: mat,
                            center=center, axis=axis, cap_top=mat if top else None, cap_bot=mat if bot else None)

    def finish(self, recalc=False):
        bm = self.bm
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
        if recalc:
            bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        me = bpy.data.meshes.new(self.name)
        bm.to_mesh(me)
        bm.free()
        for m in self.mats:
            me.materials.append(m)
        ob = bpy.data.objects.new(self.name, me)
        return ob


def apply_modifiers(ob):
    # 把修改器結果寫回網格（不用 bpy.ops，headless 也穩）
    dg = bpy.context.evaluated_depsgraph_get()
    ev = ob.evaluated_get(dg)
    me = bpy.data.meshes.new_from_object(ev)
    old = ob.data
    ob.modifiers.clear()
    ob.data = me
    for m in old.materials:
        if m.name not in [x.name for x in me.materials if x]:
            me.materials.append(m)
    bpy.data.meshes.remove(old)
    me.name = ob.name
    return ob


def tri_count(ob):
    me = ob.data
    me.calc_loop_triangles()
    return len(me.loop_triangles)


def link(ob, coll=None):
    (coll or bpy.context.scene.collection).objects.link(ob)
    return ob


def rot_z(ob, ang):
    ob.rotation_euler = (0, 0, ang)
    return ob


def transform_verts(bm, verts, mat):
    bmesh.ops.transform(bm, matrix=mat, verts=verts)


__all__ = ['material', 'Builder', 'apply_modifiers', 'tri_count', 'link', 'Matrix', 'Vector', 'A_NORMAL', 'A_PAINT', 'A_GLOW']


def join(objs, name):
    # 把多個物件（含修改器結果）合併成一個網格，材質統一重排
    dg = bpy.context.evaluated_depsgraph_get()
    bm = bmesh.new()
    mats = []
    for ob in objs:
        ev = ob.evaluated_get(dg)
        me = ev.to_mesh()
        remap = []
        for m in me.materials:
            m = m.original if m else m        # 評估網格的材質是暫存副本，要換回原本的
            if m not in mats:
                mats.append(m)
            remap.append(mats.index(m))
        n0 = len(bm.faces)
        bm.from_mesh(me)
        bm.faces.ensure_lookup_table()
        for f in bm.faces[n0:]:
            f.material_index = remap[f.material_index] if remap else 0
            f.smooth = False
        ev.to_mesh_clear()
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for m in mats:
        me.materials.append(m)
    out = bpy.data.objects.new(name, me)
    for ob in objs:
        if ob.name in bpy.context.scene.collection.objects:
            bpy.context.scene.collection.objects.unlink(ob)
        data = ob.data
        bpy.data.objects.remove(ob)
        if data.users == 0:
            bpy.data.meshes.remove(data)
    return out
