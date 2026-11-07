#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""赭線 OCHRE LINE（作品 278）高精度武器：Blender bmesh 程式建模 + 程序化 PBR。

四把全是原創設計的虛構型號，不描任何實槍或商業遊戲模型，沒有外部素材：
  ks   短突擊步槍：沖壓鋼機匣、琥珀清漆木、直線式木托
  ar5  突擊步槍：深色鋁機匣、八角四面導軌護木、斜切消焰器、雙桿伸縮托
  l40  栓動狙擊槍：橄欖聚合物底盤、雙腳架、大型瞄準鏡、後段旋轉槍機
  p9   手槍：多邊形切角滑套、斜向防滑刻痕、可選圓柱消音管（獨立節點 p9_sup）

執行（四個階段，後面的階段可重跑，不必重建模型）：
  blender --background --python tools/build_guns_hd.py -- [--only ks,p9] [--stage model,tex,glb,sheet]
  預覽造型：--stage preview
  與掃描版 guns.glb 對拍：--stage compare（輸出 dist/guns-hd-compare.png）

新槍（NEW_GUNS，規格見 dist/GUN_SPEC.md）各寫在 tools/guns/<id>.py，用 --only 指定：
  blender --background --python tools/build_guns_hd.py -- --only m7 --stage model,tex,glb,look
  每把各輸出 assets/278/models/guns/<id>.glb，不碰 guns_hd.glb，舊四把不會被重烘。
  --hd-out <path>：舊四把的 glb 改寫到別處，比對重烘結果用。

建模座標：X 右、Y 前（槍口）、Z 上，握把在原點，公尺。全部零件完成後繞 Z 轉 180 度，
讓槍口落在 Blender -Y，匯出 glTF 後為 +Z，Babylon 載入後仍是 +Z（SPEC 規則）。

管線：
  零件 → 布林 → Bevel(0.002/3/0.7/harden_normals) → Weighted Normal → 多物件 Smart UV
  → Cycles EMIT 烘 位置／法線／零件編號／邊緣與 AO（只烘資料，存 .npz）
  → numpy 依材質合成 Albedo／Normal／ORM → cwebp → glTF 匯出 → guns_hd.glb
"""
import bpy, bmesh, math, os, sys, time, random, json, struct, subprocess, importlib.util, types
import numpy as np
from mathutils import Vector, Matrix

HERE = os.path.dirname(os.path.abspath(__file__))
PROJ = os.path.dirname(HERE)
REPO = os.path.dirname(os.path.dirname(PROJ))
WORK = os.path.join(PROJ, 'dist', 'gh')
OUT_GLB = os.path.join(REPO, 'assets', '278', 'models', 'guns_hd.glb')
SHEET = os.path.join(PROJ, 'dist', 'guns-hd-sheet.png')
GUNS = ['ks', 'ar5', 'l40', 'p9']
TEX = {'ks': 2048, 'ar5': 2048, 'l40': 2048, 'p9': 2048}
# 新槍：一把一檔，輸出到 OUT_NEW/<id>.glb。貼圖最長邊上限 NEW_TEX，世界槍 <id>_w 減面到 NEW_LOD 三角形
NEW_GUNS = ['c7', 'm7', 'b90', 't4', 'x10', 's6', 'n9']
OUT_NEW = os.path.join(REPO, 'assets', '278', 'models', 'guns')
GUN_DIR = os.path.join(HERE, 'guns')
NEW_TEX = 1024; NEW_LOD = 3500
# Bevel 工序（手冊 Stage 5B）。細小零件用較小 width，因 clamp_overlap 是整個網格共用同一個上限
BW = 0.002; BW_MID = 0.0012; BW_FINE = 0.0006
BEV_SEG = 3; BEV_PROFILE = 0.7; BEV_ANGLE = math.radians(30)


def argv():
    a = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    o = {'only': GUNS, 'stage': ['model', 'tex', 'glb', 'sheet'], 'samples': 16, 'hd_out': None}
    for i in range(0, len(a), 2):
        if a[i] == '--only': o['only'] = a[i + 1].split(',')
        if a[i] == '--stage': o['stage'] = a[i + 1].split(',')
        if a[i] == '--samples': o['samples'] = int(a[i + 1])
        if a[i] == '--hd-out': o['hd_out'] = a[i + 1]
    return o


# ---------- 2D 工具 ----------
def fillet(pts, r=0.0, seg=5):
    """多邊形倒圓。pts 每點 (u,v) 或 (u,v,半徑)。"""
    n = len(pts); out = []
    for i in range(n):
        p = pts[i]; rad = p[2] if len(p) > 2 else r
        px, py = p[0], p[1]
        if rad <= 0: out.append((px, py)); continue
        a = pts[i - 1]; b = pts[(i + 1) % n]
        ax, ay = a[0] - px, a[1] - py; bx, by = b[0] - px, b[1] - py
        la = math.hypot(ax, ay); lb = math.hypot(bx, by)
        ax /= la; ay /= la; bx /= lb; by /= lb
        ang = math.acos(max(-1, min(1, ax * bx + ay * by)))
        if ang > math.pi - 0.01: out.append((px, py)); continue
        t = min(rad / math.tan(ang / 2), la * .49, lb * .49)
        rad2 = t * math.tan(ang / 2)
        mx, my = ax + bx, ay + by; ml = math.hypot(mx, my); mx /= ml; my /= ml
        h = rad2 / math.sin(ang / 2); cx, cy = px + mx * h, py + my * h
        a0 = math.atan2(py + ay * t - cy, px + ax * t - cx)
        a1 = math.atan2(py + by * t - cy, px + bx * t - cx)
        d = a1 - a0
        while d > math.pi: d -= 2 * math.pi
        while d < -math.pi: d += 2 * math.pi
        k = max(2, int(math.ceil(abs(d) / (math.pi / 2) * seg - 1e-4)))
        for j in range(k + 1):
            th = a0 + d * j / k
            out.append((cx + math.cos(th) * rad2, cy + math.sin(th) * rad2))
    return out


def rrect(w, h, r, seg=4, cu=0.0, cv=0.0):
    return fillet([(cu - w / 2, cv - h / 2, r), (cu + w / 2, cv - h / 2, r),
                   (cu + w / 2, cv + h / 2, r), (cu - w / 2, cv + h / 2, r)], seg=seg)


def sellipse(rx, ry, n=20, p=2.6, cu=0.0, cv=0.0):
    pts = []
    for i in range(n):
        t = 2 * math.pi * i / n; c, s = math.cos(t), math.sin(t)
        pts.append((cu + rx * math.copysign(abs(c) ** (2 / p), c), cv + ry * math.copysign(abs(s) ** (2 / p), s)))
    return pts


def ring(n, r, cu=0.0, cv=0.0, a0=0.0):
    return [(cu + r * math.cos(a0 + 2 * math.pi * i / n), cv + r * math.sin(a0 + 2 * math.pi * i / n)) for i in range(n)]


def rect_section(hw, zt, zb, rt, rb, k=3):
    """固定頂點數的圓角矩形剖面 (x,z)，供 loft 用。"""
    rt = min(rt, hw * .99, (zt - zb) * .49); rb = min(rb, hw * .99, (zt - zb) * .49)
    pts = []
    for cx, cz, r, a0 in ((hw - rb, zb + rb, rb, -math.pi / 2), (hw - rt, zt - rt, rt, 0),
                          (-hw + rt, zt - rt, rt, math.pi / 2), (-hw + rb, zb + rb, rb, math.pi)):
        for j in range(k + 1):
            a = a0 + j / k * math.pi / 2
            pts.append((cx + r * math.cos(a), cz + r * math.sin(a)))
    return pts


# ---------- 網格建構 ----------
def mesh_co(me):
    a = np.zeros(len(me.vertices) * 3, dtype=np.float32); me.vertices.foreach_get('co', a); return a.reshape(-1, 3)


def _link(name, me):
    ob = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(ob); return ob


def _mesh(name, verts, faces):
    me = bpy.data.meshes.new(name); me.from_pydata([tuple(v) for v in verts], [], faces); me.update()
    bm = bmesh.new(); bm.from_mesh(me)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me); bm.free()
    return _link(name, me)


def prism(pts, a, b, plane='yz', name='p'):
    """平面輪廓擠出。plane=yz：pts=(y,z) 沿 X；xz：(x,z) 沿 Y；xy：(x,y) 沿 Z。"""
    n = len(pts); v = []
    for t in (a, b):
        for p in pts:
            if plane == 'yz': v.append((t, p[0], p[1]))
            elif plane == 'xz': v.append((p[0], t, p[1]))
            else: v.append((p[0], p[1], t))
    f = [list(range(n - 1, -1, -1)), list(range(n, 2 * n))]
    for i in range(n):
        j = (i + 1) % n; f.append([i, j, n + j, n + i])
    return _mesh(name, v, f)


def box(x0, x1, y0, y1, z0, z1, name='b'):
    return prism([(y0, z0), (y1, z0), (y1, z1), (y0, z1)], x0, x1, 'yz', name)


def loft(loops, name='l', cap=True):
    """等點數 3D 環列放樣。"""
    n = len(loops[0]); v = [p for l in loops for p in l]; f = []
    assert all(len(l) == n for l in loops), f'{name}: 環點數不一致 {[len(l) for l in loops]}'
    for k in range(len(loops) - 1):
        for i in range(n):
            j = (i + 1) % n
            f.append([k * n + i, k * n + j, (k + 1) * n + j, (k + 1) * n + i])
    if cap:
        f.append(list(range(n - 1, -1, -1)))
        f.append([(len(loops) - 1) * n + i for i in range(n)])
    return _mesh(name, v, f)


def loft_y(st, k=3, name='ly'):
    """沿 Y 放樣。st=(y, ztop, zbot, 半寬, 上圓角, 下圓角)。"""
    return loft([[(x, s[0], z) for x, z in rect_section(s[3], s[1], s[2], s[4], s[5], k)] for s in st], name)


def loft_frames(st, name='lf'):
    """st=(原點, u軸, v軸, 2D 剖面)。"""
    out = []
    for o, u, v, sec in st:
        out.append([(o[0] + u[0] * a + v[0] * b, o[1] + u[1] * a + v[1] * b, o[2] + u[2] * a + v[2] * b) for a, b in sec])
    return loft(out, name)


def lathe(prof, n=32, c=(0, 0), axis='y', name='lt'):
    """旋轉體。prof=(沿軸位置, 半徑)；半徑 0 收成極點。c 為另兩軸座標。"""
    v = []; f = []; rows = []
    for a, r in prof:
        row = []
        cnt = 1 if r <= 1e-7 else n
        for i in range(cnt):
            th = 2 * math.pi * i / n; ca, sa = r * math.cos(th), r * math.sin(th)
            if axis == 'y': p = (c[0] + ca, a, c[1] + sa)
            elif axis == 'x': p = (a, c[0] + ca, c[1] + sa)
            else: p = (c[0] + ca, c[1] + sa, a)
            row.append(len(v)); v.append(p)
        rows.append(row)
    for r0, r1 in zip(rows, rows[1:]):
        if len(r0) == 1 and len(r1) == 1: continue
        if len(r0) == 1:
            for i in range(n): f.append([r0[0], r1[i], r1[(i + 1) % n]])
        elif len(r1) == 1:
            for i in range(n): f.append([r0[i], r0[(i + 1) % n], r1[0]])
        else:
            for i in range(n):
                j = (i + 1) % n; f.append([r0[i], r0[j], r1[j], r1[i]])
    if len(rows[0]) > 1: f.append(rows[0][::-1])
    if len(rows[-1]) > 1: f.append(rows[-1][:])
    return _mesh(name, v, f)


def cyl(c, r, a0, a1, axis='y', n=24, name='c'):
    return lathe([(a0, r), (a1, r)], n, c, axis, name)


def rot(ob, axis, deg, pivot=(0, 0, 0)):
    m = Matrix.Translation(pivot) @ Matrix.Rotation(math.radians(deg), 4, axis) @ Matrix.Translation((-pivot[0], -pivot[1], -pivot[2]))
    ob.data.transform(m); ob.data.update(); return ob


def move(ob, x=0, y=0, z=0):
    ob.data.transform(Matrix.Translation((x, y, z))); ob.data.update(); return ob


def fix_normals(ob):
    bm = bmesh.new(); bm.from_mesh(ob.data)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(ob.data); bm.free(); ob.data.update(); return ob


def mirror_x(ob, name=None):
    me = ob.data.copy(); me.transform(Matrix.Scale(-1, 4, (1, 0, 0)))
    o2 = _link(name or ob.name + '.m', me); return fix_normals(o2)


def clone(ob, x=0, y=0, z=0):
    me = ob.data.copy(); o2 = _link(ob.name + '.c', me); return move(o2, x, y, z)


def _join_mesh(obs):
    bm = bmesh.new()
    for o in obs: bm.from_mesh(o.data)
    me = bpy.data.meshes.new('joined'); bm.to_mesh(me); bm.free()
    for o in obs[1:]: bpy.data.objects.remove(o)
    obs[0].data = me
    return obs[0]


def _bool(target, tool, op):
    m = target.modifiers.new('b', 'BOOLEAN'); m.operation = op; m.object = tool; m.solver = 'MANIFOLD'
    before = len(target.data.polygons)
    with bpy.context.temp_override(object=target, active_object=target, selected_objects=[target]):
        bpy.ops.object.modifier_apply(modifier=m.name)
    if len(target.data.polygons) == 0:
        raise RuntimeError(f'布林結果為空：{target.name}（原 {before} 面）')
    # 不要 dissolve_limit：共面三角合併時會吃掉孔的 bridge 邊，留下蓋住孔洞的 n-gon


def cut(target, *tools):
    """差集。多個刀具合併成一個物件一次切，比逐個切快。"""
    tool = _join_mesh(list(tools)) if len(tools) > 1 else tools[0]
    _bool(target, tool, 'DIFFERENCE'); bpy.data.objects.remove(tool); return target


def fuse(target, *tools):
    for t in tools:
        _bool(target, t, 'UNION'); bpy.data.objects.remove(t)
    return target


def bevel_now(ob, w, seg=BEV_SEG, angle=BEV_ANGLE):
    """提早套一次導角（大稜線 2 mm），之後再切細節，細節才不會把大稜線的 clamp 壓小。

    Bevel 在已導角過的網格上偶爾會噴出 1e28 的頂點，所以套用後檢查外框，
    爆掉就換較保守的參數重試，全部失敗則保留未導角的網格並回報。
    """
    src = ob.data.copy(); ext0 = mesh_co(src); lo, hi = ext0.min(0) - .004, ext0.max(0) + .004
    for miter, ww, ang in (('MITER_ARC', w, angle), ('MITER_SHARP', w, angle), ('MITER_SHARP', w, math.radians(40)), ('MITER_SHARP', w * .6, math.radians(40))):
        ob.data = src.copy()
        bv = ob.modifiers.new('bv', 'BEVEL'); bv.width = ww; bv.segments = seg; bv.profile = BEV_PROFILE
        bv.limit_method = 'ANGLE'; bv.angle_limit = ang; bv.harden_normals = True
        bv.use_clamp_overlap = True; bv.miter_outer = miter; bv.loop_slide = True
        with bpy.context.temp_override(object=ob, active_object=ob, selected_objects=[ob]):
            bpy.ops.object.modifier_apply(modifier=bv.name)
        co = mesh_co(ob.data)
        if np.isfinite(co).all() and (co >= lo).all() and (co <= hi).all():
            ob['prebevel'] = True
            return ob
    print(f'[warn] {ob.name} 導角失敗，保留未導角網格', flush=True)
    ob.data = src
    return ob


def finish_part(ob, w):
    """平滑、導角、重算銳邊、Weighted Normal。"""
    me = ob.data
    me.polygons.foreach_set('use_smooth', [True] * len(me.polygons))
    bm = bmesh.new(); bm.from_mesh(me)
    for e in bm.edges: e.smooth = True
    bm.to_mesh(me); bm.free()
    # 第二次導角要避開第一次留下的弧面（段差可達 35 度），否則會重切出翻面碎片
    if w: bevel_now(ob, w, angle=math.radians(44) if ob.get('prebevel') else BEV_ANGLE)
    bm = bmesh.new(); bm.from_mesh(ob.data)
    lim = math.radians(48)
    for e in bm.edges:
        if len(e.link_faces) == 2 and e.calc_face_angle(0) > lim: e.smooth = False
    bm.to_mesh(ob.data); bm.free()
    wn = ob.modifiers.new('wn', 'WEIGHTED_NORMAL'); wn.keep_sharp = True; wn.weight = 50; wn.mode = 'FACE_AREA'
    with bpy.context.temp_override(object=ob, active_object=ob, selected_objects=[ob]):
        bpy.ops.object.modifier_apply(modifier=wn.name)
    sanitize_normals(ob)


def sanitize_normals(ob):
    """導角在布林切過弧面的地方會留下極小碎面，角法線可能為零或反向，換成面法線。"""
    me = ob.data; n = len(me.loops)
    cn = np.zeros(n * 3, np.float32); me.corner_normals.foreach_get('vector', cn); cn = cn.reshape(-1, 3)
    start = np.zeros(len(me.polygons), np.int32); total = np.zeros(len(me.polygons), np.int32); fn = np.zeros(len(me.polygons) * 3, np.float32)
    me.polygons.foreach_get('loop_start', start); me.polygons.foreach_get('loop_total', total); me.polygons.foreach_get('normal', fn)
    fl = np.repeat(fn.reshape(-1, 3), total, axis=0)
    ln = np.linalg.norm(cn, axis=1); bad = (ln < .5) | ((cn * fl).sum(1) < .05) | ~np.isfinite(ln)
    if bad.any():
        cn[bad] = fl[bad]
        me.normals_split_custom_set([tuple(v) for v in cn])


class Gun:
    def __init__(s, gid):
        s.id = gid; s.parts = []; s.marks = {}

    def add(s, ob, mat, bw=BW, **meta):
        ob.name = f'{s.id}.{len(s.parts):03d}'
        s.parts.append(dict(ob=ob, mat=mat, bw=bw, group=meta.pop('group', 'main'), **meta))
        return ob

    def pin(s, x, y, z, r=.0028, h=.0012, axis='x', mat='steel', dome=True, group='main'):
        """鉚釘／插銷頭。x,y,z 是貼面位置；h 帶正負號決定朝向。"""
        n = 16
        prof = [(0, r), (h * .55, r), (h * .85, r * .78), (h, r * .42), (h, 0)] if dome else [(0, r), (h, r), (h, 0)]
        if h < 0: prof = [(a, b) for a, b in prof]
        if axis == 'x':
            ob = lathe(prof, n, (y, z), 'x'); move(ob, x)
        elif axis == 'z':
            ob = lathe(prof, n, (x, y), 'z'); move(ob, 0, 0, z)
        else:
            ob = lathe(prof, n, (x, z), 'y'); move(ob, 0, y)
        return s.add(ob, mat, None, group=group)

    def hexbolt(s, x, y, z, r=.0032, h=.0012, axis='x', mat='oxide'):
        """內六角螺絲。"""
        prof = [(0, r), (h, r), (h, r * .5), (h * .2, r * .5), (h * .2, 0)]
        n = 20
        ob = lathe(prof, n, (y, z) if axis == 'x' else (x, z), axis)
        if axis == 'x': move(ob, x)
        else: move(ob, 0, y)
        return s.add(ob, mat, None)

    def rail(s, y0, y1, h=.0048, base=.0031, width=.0208, pitch=.01, notch=.0053, mat='alum', xf=None):
        """導軌，每格一顆獨立的齒。沿 +Z 朝上建好再用 xf 轉到位，z=0 為底面。"""
        hw = width / 2
        tooth = [(-hw + .0022, base), (-hw, base + .0012), (-hw, base + .0020), (-hw + .0032, h), (hw - .0032, h), (hw, base + .0020), (hw, base + .0012), (hw - .0022, base)]
        basep = [(-hw + .0022, 0), (hw - .0022, 0), (hw - .0022, base + .0002), (-hw + .0022, base + .0002)]
        ob = prism(basep, y0, y1, 'xz', 'rail')
        if xf: xf(ob)
        s.add(ob, mat, BW_FINE)
        n = int((y1 - y0 - .003) / pitch); y = y0 + ((y1 - y0) - n * pitch + notch) / 2; teeth = []
        for i in range(n):
            t = prism(tooth, y, y + pitch - notch, 'xz', 'tooth')
            if xf: xf(t)
            teeth.append(t); y += pitch
        s.add(_join_mesh(teeth), mat, BW_FINE)


# ---------- 共用零件 ----------
def grip_stations(a, b, sec, n=9, bow=0.0):
    """把手放樣。a→b 軸線，sec(s) 回傳 2D 剖面 (x, 沿前後)。"""
    ax = Vector(b) - Vector(a); L = ax.length; d = ax / L
    fw = Vector((0, 1, 0)); v = (fw - d * fw.dot(d)).normalized()
    st = []
    for i in range(n):
        s = i / (n - 1); o = Vector(a) + ax * s + v * (math.sin(s * math.pi) * bow)
        st.append((o, (1, 0, 0), tuple(v), sec(s)))
    return st


def curved_mag(p0, th0, th1, length, sec, n=11, ends=None):
    """彎彈匣：沿 YZ 面圓弧掃掠。th 為切線偏離 -Z 的前傾角（度）。回傳 loops 用的 frames 與末端框。"""
    y, z = p0; fr = []
    for i in range(n):
        s = i / (n - 1); th = math.radians(th0 + (th1 - th0) * s)
        d = (math.sin(th), -math.cos(th)); v = (math.cos(th), math.sin(th))
        fr.append(((0, y, z), (1, 0, 0), (0, v[0], v[1]), sec(s)))
        y += d[0] * length / (n - 1); z += d[1] * length / (n - 1)
    return fr


# ---------- KS：沖壓鋼機匣 + 琥珀木 ----------
def build_ks():
    g = Gun('ks'); BZ = .070
    # 機匣：沖壓鋼板盒，下緣在彈匣後方往上收
    prof = fillet([(-.075, .040, .004), (.015, .036, .003), (.102, .036, .003), (.180, .034, .002), (.226, .044, .010),
                   (.226, .094, .001), (-.075, .094, .001)], seg=3)
    recv = prism(prof, -.0215, .0215, 'yz', 'recv')
    bevel_now(recv, BW)
    # 側面長條壓紋（凹）與拋殼窗
    grooves = []
    for sx in (1, -1):
        x0, x1 = (.0205, .03) if sx > 0 else (-.03, -.0205)
        pts = fillet([(-.066, .052, .003), (.092, .052, .003), (.092, .058, .003), (-.066, .058, .003)], seg=3)
        grooves.append(prism(pts, x0, x1, 'yz', 'gr'))
        pts = fillet([(-.066, .072, .003), (.092, .072, .003), (.092, .078, .003), (-.066, .078, .003)], seg=3)
        if sx < 0:  # 左側上排讓給拉機柄長槽
            pts = fillet([(-.066, .080, .003), (.060, .080, .003), (.060, .085, .003), (-.066, .085, .003)], seg=3)
        grooves.append(prism(pts, x0, x1, 'yz', 'gr'))
    port = prism(fillet([(.104, .056, .003), (.176, .056, .003), (.176, .089, .003), (.104, .089, .003)], seg=3), .004, .03, 'yz', 'port')
    slot = prism(fillet([(.086, .0735, .0015), (.205, .0735, .0015), (.205, .0795, .0015), (.086, .0795, .0015)], seg=2), -.03, -.012, 'yz', 'slot')
    cut(recv, port, slot, *grooves)
    g.add(recv, 'steel', BW_MID)
    # 拋殼窗內的槍機
    g.add(box(-.009, .012, .096, .190, .058, .084), 'oxide', BW_MID)
    g.add(cyl((.0, BZ), .0088, .170, .186), 'steel', BW_FINE)
    # 拉機柄：左側短 T 柄
    g.add(box(-.030, -.010, .1415, .1475, .0745, .0785), 'steel', BW_FINE)
    g.add(lathe([(-.044, 0), (-.044, .0045), (-.0425, .0065), (-.034, .0065), (-.029, .0048), (-.026, .0048)], 18, (.1445, .0765), 'x'), 'steel', BW_FINE)
    # 頂蓋：六角斷面，帶外緣唇
    cover = prism(fillet([(-.0228, .0915, .0006), (-.0228, .0975, .0006), (-.0150, .1075, .001), (.0150, .1075, .001), (.0228, .0975, .0006), (.0228, .0915, .0006)], seg=2), -.078, .222, 'xz', 'cover')
    cut(cover, rot(box(-.04, .04, .205, .26, .100, .13), (1, 0, 0), 14, (0, .222, .1)))
    g.add(cover, 'steel', BW)
    rib = prism(fillet([(-.0048, .1070, .0), (-.0036, .1096, .0007), (.0036, .1096, .0007), (.0048, .1070, .0)], seg=2), -.040, .190, 'xz', 'rib')
    g.add(rib, 'steel', BW_FINE)
    for y in (-.062, -.018, .040, .098, .156, .205):
        for sx in (1, -1):
            g.pin(sx * .0228, y, .0945, r=.0021, h=sx * .0011)
    # 頂蓋後方卡榫
    g.add(prism(fillet([(-.086, .090, .001), (-.070, .090, .001), (-.070, .108, .001), (-.076, .112, .002), (-.086, .112, .002)], seg=2), -.0115, .0115, 'yz', 'latch'), 'oxide', BW_MID)
    # 後照門：沖壓雙耳 + 孔
    ear = prism(fillet([(-.036, .107, .001), (-.008, .107, .001), (-.012, .124, .003), (-.030, .124, .003)], seg=3), .0078, .0108, 'yz')
    g.add(ear, 'steel', BW_FINE); g.add(mirror_x(ear), 'steel', BW_FINE)
    ap = prism(fillet([(-.0072, .106, .0), (.0072, .106, .0), (.0072, .1185, .002), (-.0072, .1185, .002)], seg=2), -.0225, -.0205, 'xz')
    cut(ap, cyl((.0, .1140), .0024, -.03, -.015))
    g.add(ap, 'steel', BW_FINE * .7)
    # 前機匣節套（機削塊）
    tr = prism(fillet([(-.0235, .040, .004), (.0235, .040, .004), (.0235, .092, .004), (-.0235, .092, .004)], seg=3), .226, .250, 'xz', 'trun')
    g.add(tr, 'oxide', BW)
    for sx in (1, -1):
        g.hexbolt(sx * .0235, .238, .080, r=.0034, h=sx * .0009)
        g.hexbolt(sx * .0235, .238, .054, r=.0034, h=sx * .0009)
    # 槍管
    g.add(lathe([(.240, .0108), (.300, .0108), (.302, .0098), (.412, .0098), (.412, 0)], 28, (0, BZ)), 'steel', None)
    # 木護木：下半包覆，頂部露出鋼隔熱罩
    fore = loft_y([(.250, .0765, .0385, .0240, .004, .012), (.262, .0765, .0345, .0250, .004, .014), (.300, .0765, .0330, .0245, .004, .015),
                   (.340, .0765, .0345, .0225, .004, .014), (.358, .0765, .0410, .0205, .004, .012)], 4, 'fore')
    gr = []
    for sx in (1, -1):
        gr.append(rot(prism(fillet([(.270, .0520, .0035), (.336, .0520, .0035), (.336, .0595, .0035), (.270, .0595, .0035)], seg=4), .0205 * sx, .04 * sx, 'yz'), (0, 0, 1), -2 * sx, (0, .3, .05)))
    cut(fore, *gr)
    g.add(fore, 'wood', BW, grain=(.6, .012))
    shield = prism(fillet([(-.0150, .0765, .0), (-.0185, .0775, .001), (-.0185, .0815, .004), (-.0120, .0915, .006), (.0120, .0915, .006), (.0185, .0815, .004), (.0185, .0775, .001), (.0150, .0765, .0)], seg=4), .250, .356, 'xz', 'shield')
    vents = []
    for i in range(6):
        y = .262 + i * .0150
        vents.append(prism(fillet([(y, -.03, .0020), (y + .0085, -.03, .0020), (y + .0085, .03, .0020), (y, .03, .0020)], seg=3)[::1], .08, .10, 'xy', 'v'))
    cut(shield, cyl((0, BZ), .0145, .24, .37, n=28), *vents)
    g.add(shield, 'steel', BW_MID)
    # 護木前鋼箍 + 導氣座（氣缸在槍管下方）
    g.add(lathe([(.356, .0), (.356, .0235), (.3585, .0245), (.3665, .0245), (.369, .0235), (.369, 0)], 36, (0, BZ - .006)), 'steel', None)
    block = prism(fillet([(.369, .060, .002), (.396, .060, .002), (.396, .079, .004), (.390, .094, .003), (.375, .094, .003), (.369, .082, .002)], seg=3), -.0132, .0132, 'yz', 'gb')
    g.add(block, 'oxide', BW_MID)
    g.add(lathe([(.369, .0098), (.408, .0098), (.410, .0085), (.410, 0)], 22, (0, .0505)), 'steel', None)
    g.add(box(-.0078, .0078, .372, .381, .051, .058), 'oxide', BW_FINE)
    # 前準星：U 形護圈（開口朝上，雙耳外傾）
    ring2 = prism(fillet([(-.0130, .090, .001), (.0130, .090, .001), (.0140, .1165, .002), (.0098, .1165, .001), (.0078, .0990, .004), (-.0078, .0990, .004), (-.0098, .1165, .001), (-.0140, .1165, .002)], seg=3), .3755, .3895, 'xz', 'hood')
    g.add(ring2, 'steel', BW_MID)
    g.add(prism(fillet([(.379, .096, 0), (.386, .096, 0), (.3845, .1135, .0005), (.3805, .1135, .0005)], seg=2), -.0012, .0012, 'yz', 'post'), 'steel', None)
    # 槍口補償器：三道斜切上孔
    comp = lathe([(.406, .0108), (.411, .0118), (.412, .0132), (.456, .0132), (.458, .0118), (.458, .0065), (.438, .0058), (.438, 0)], 32, (0, BZ), name='comp')
    bevel_now(comp, BW_MID)
    ports = []
    for i in range(3):
        y = .416 + i * .0125
        p = prism(fillet([(y, .070, .0015), (y + .0062, .070, .0015), (y + .0062, .100, .0015), (y, .100, .0015)], seg=2), -.0078, .0078, 'yz')
        ports.append(rot(p, (1, 0, 0), -24, (0, y, .08)))
    cut(comp, *ports)
    g.add(comp, 'steel', BW_FINE)
    # 木托：直線式，托頂與機匣同線，只有下緣往下斜；側面橢圓凹槽
    stock = loft_y([(-.070, .0925, .0420, .0205, .004, .007), (-.086, .0925, .0390, .0190, .006, .008), (-.116, .0925, .0345, .0175, .009, .010),
                    (-.160, .0930, .0220, .0180, .011, .011), (-.205, .0935, .0060, .0195, .012, .012), (-.238, .0945, -.0075, .0210, .012, .012), (-.252, .0950, -.0130, .0215, .010, .010)], 4, 'stock')
    sc = []
    for sx in (1, -1):
        sc.append(prism(fillet([(-.224, .0300, .009), (-.128, .0560, .009), (-.128, .0710, .009), (-.224, .0710, .009)], seg=5), sx * .0150, sx * .03, 'yz'))
    cut(stock, *sc)
    g.add(stock, 'wood', BW, grain=(-.16, .021))
    plate = loft_y([(-.2525, .0965, -.0145, .0222, .011, .011), (-.2605, .0955, -.0135, .0212, .010, .010)], 4, 'plate')
    g.add(plate, 'steel', BW)
    for z in (.082, -.002):
        g.pin(0, -.2605, z, r=.0032, h=-.0010, axis='y', mat='oxide')
    # 托身固定螺絲
    for sx in (1, -1):
        g.pin(sx * .0200, -.083, .0620, r=.0035, h=sx * .0009, mat='oxide')
    # 彈匣井
    well = prism(fillet([(.102, .040, .001), (.100, .012, .003), (.182, .010, .003), (.182, .040, .001)], seg=3), -.0162, .0162, 'yz', 'well')
    g.add(well, 'steel', BW)
    # 彈匣釋放片（後方壓片）
    g.add(prism(fillet([(.089, .008, .002), (.100, .008, .001), (.100, .036, .001), (.094, .036, .001)], seg=3), -.0065, .0065, 'yz', 'magrel'), 'oxide', BW_FINE)
    # 彎彈匣：階梯斷面、前緣背脊；弧度比常見長彈匣小
    def magsec(s):
        d = .0296; w = .0118; st = .0095
        return fillet([(-st, -d, .0015), (st, -d, .0015), (st, -.021, .0006), (w, -.019, .0006), (w, .015, .0006), (st, .017, .0006),
                       (st, d - .004, .0008), (.0035, d - .002, .0006), (.0035, d + .0025, .0009), (-.0035, d + .0025, .0009), (-.0035, d - .002, .0006), (-st, d - .004, .0008),
                       (-st, .017, .0006), (-w, .015, .0006), (-w, -.019, .0006), (-st, -.021, .0006)], seg=2)
    mf = curved_mag((.1415, .036), 3, 25, .172, magsec, 13)
    mag = loft_frames(mf, 'mag')
    # 側面五個觀察凹點
    dots = []
    for i in range(5):
        fr = mf[3 + i * 2]; o = fr[0]; v = fr[2]
        dots.append(cyl((o[1] - v[1] * .000 + v[1] * .002, o[2] + v[2] * .002), .0024, .0108, .02, 'x', 16))
    cut(mag, *dots)
    g.add(mag, 'steel', BW_FINE)
    last = mf[-1]; o = last[0]; v = last[2]
    def base_sec(g0):
        return fillet([(-.0130 - g0, -.0325 - g0, .002), (.0130 + g0, -.0325 - g0, .002), (.0130 + g0, .0345 + g0, .002), (-.0130 - g0, .0345 + g0, .002)], seg=2)
    bv = (0, -v[2], v[1])
    base = loft_frames([(o, (1, 0, 0), v, base_sec(0)), ((o[0] + bv[0] * -.0048, o[1] + bv[1] * .0048 * -1, o[2] + bv[2] * .0048 * -1), (1, 0, 0), v, base_sec(0)), ((o[0], o[1] - bv[1] * .0066, o[2] - bv[2] * .0066), (1, 0, 0), v, base_sec(-.0016))], 'mbase')
    g.add(base, 'oxide', BW_FINE)
    g.marks['mag'] = (0, .1415, .036)
    # 扳機護弓：沖壓帶
    outer = fillet([(.024, .038, .002), (.030, -.008, .010), (.074, -.016, .012), (.096, -.006, .008), (.100, .038, .002)], seg=5)
    inner = fillet([(.031, .040, .001), (.036, -.0025, .007), (.072, -.0105, .009), (.091, -.002, .005), (.094, .040, .001)], seg=5)
    tg = prism(outer, -.0065, .0065, 'yz', 'tg')
    cut(tg, prism(inner, -.02, .02, 'yz'))
    g.add(tg, 'steel', BW_MID)
    tr2 = prism(fillet([(.058, .038, .0), (.0635, .038, .0), (.0605, .020, .004), (.0525, .0035, .002), (.0495, .0040, .001), (.0555, .020, .005)], seg=4), -.0035, .0035, 'yz', 'trg')
    g.add(tr2, 'steel', BW_FINE)
    # 握把：聚合物 + 高頻菱格
    def gsec(s):
        rx = .0142 + .0014 * math.sin(s * 3.14) - .0006 * s
        ry = .0235 + .0035 * math.sin(s * 3.14) + .0012 * s
        return sellipse(rx, ry, 24, 2.7)
    a = (0, .020, .040); b = (0, -.026, -.074)
    grip = loft_frames(grip_stations(a, b, gsec, 10, -.0015), 'grip')
    g.add(grip, 'grip', BW_MID, knurl=dict(a=a, b=b, pitch=.0019, lo=.14, hi=.90))
    g.add(prism(fillet([(.040, .0355, .0), (-.022, .037, 0), (-.026, .0300, .002), (.040, .0300, .002)], seg=3), -.0140, .0140, 'yz', 'gtop'), 'oxide', BW_MID)
    bdir = (Vector(b) - Vector(a)).normalized(); bv2 = Vector((0, 1, 0)); bv2 = (bv2 - bdir * bv2.dot(bdir)).normalized()
    def cap(k):
        return sellipse(.0143 * k, .0255 * k, 24, 2.7)
    g.add(loft_frames([(Vector(b) - bdir * .0015, (1, 0, 0), tuple(bv2), cap(1.03)), (Vector(b) + bdir * .0035, (1, 0, 0), tuple(bv2), cap(1.03)), (Vector(b) + bdir * .0050, (1, 0, 0), tuple(bv2), cap(.92))], 'gcap'), 'oxide', BW_FINE)
    # 選擇鈕（右側）：圓盤 + 短撥片
    g.add(lathe([(.0215, .0092), (.0232, .0092), (.0240, .0082), (.0240, 0)], 28, (.012, .0595), 'x'), 'oxide', None)
    g.add(prism(fillet([(.008, .0565, .001), (.016, .0565, .001), (.0115, .0395, .002), (.0065, .0395, .002)], seg=2), .0232, .0268, 'yz', 'sel'), 'steel', BW_FINE)
    # 背帶環
    g.add(prism(fillet([(-.226, .0010, .0), (-.196, .0120, .0), (-.198, .0060, .002), (-.226, -.0060, .002)], seg=2), -.0040, .0040, 'yz', 'swv'), 'oxide', BW_FINE)
    # 機匣側方鉚釘列
    for y in (.012, .036, .060):
        for sx in (1, -1):
            g.pin(sx * .0215, y, .0425, r=.0019, h=sx * .0009)
    for y in (.110, .130, .150, .170):
        g.pin(-.0215, y, .0420, r=.0019, h=-.0009)
        g.pin(.0215, y, .0420, r=.0019, h=.0009)
    g.marks['muzzle'] = (0, .458, BZ)
    return g


def build_ar5():
    g = Gun('ar5'); BZ = .068
    # 上機匣：八邊斷面鋁件
    sec = fillet([(-.0125, .0925, .0008), (.0125, .0925, .0008), (.0205, .0845, .0012), (.0205, .0525, .0012), (.0172, .0465, .0012), (-.0172, .0465, .0012), (-.0205, .0525, .0012), (-.0205, .0845, .0012)], seg=2)
    up = prism(sec, -.082, .170, 'xz', 'upper')
    bevel_now(up, BW)
    cuts = []
    for sx in (1, -1):
        pk = fillet([(-.068, .0565, .004), (.044, .0565, .004), (.044, .0795, .004), (-.068, .0795, .004)], seg=4)
        cuts.append(prism(pk, sx * .0192, sx * .03, 'yz'))
    port = prism(fillet([(.074, .0555, .003), (.146, .0555, .003), (.146, .0835, .003), (.074, .0835, .003)], seg=3), .004, .03, 'yz')
    slot = prism(fillet([(.052, .0705, .0018), (.158, .0705, .0018), (.158, .0775, .0018), (.052, .0775, .0018)], seg=2), -.03, -.011, 'yz')
    cut(up, port, slot, *cuts)
    g.add(up, 'alum', BW_MID)
    g.add(box(-.0085, .0105, .070, .160, .0565, .0825), 'oxide', BW_MID)
    g.add(cyl((.0, BZ), .0078, .135, .150), 'steel', BW_FINE)
    # 拋殼導流凸塊
    g.add(prism(fillet([(.050, .0545, .001), (.0715, .0545, .001), (.0715, .0845, .001), (.058, .0845, .002)], seg=2), .0195, .0240, 'yz', 'defl'), 'alum', BW_FINE)
    # 左側拉機柄：不隨動折疊片
    g.add(box(-.030, -.009, .1265, .1325, .0715, .0765), 'steel', BW_FINE)
    g.add(prism(fillet([(.119, .0695, .002), (.140, .0695, .002), (.1375, .0785, .002), (.1215, .0785, .002)], seg=3), -.0345, -.0268, 'yz', 'chg'), 'steel', BW_FINE)
    # 頂導軌
    g.rail(-.0805, .1695, xf=lambda o: move(o, 0, 0, .0925))
    # 下機匣：外翻彈匣井
    prof = fillet([(-.082, .0475, .001), (-.082, .0300, .005), (.022, .0300, .003), (.1035, .0300, .002), (.1005, -.0160, .003), (.0970, -.0225, .002), (.1805, -.0290, .002), (.1800, -.0200, .002), (.1735, .0475, .002)], seg=3)
    low = prism(prof, -.0172, .0172, 'yz', 'lower')
    bevel_now(low, BW)
    cuts = []
    for sx in (1, -1):
        tri = fillet([(.1115, -.0105, .0035), (.1635, -.0145, .0035), (.1610, .0205, .0035), (.1160, .0225, .0035)], seg=3)
        cuts.append(prism(tri, sx * .0160, sx * .03, 'yz'))
        cuts.append(prism(fillet([(-.068, .0350, .002), (.012, .0350, .002), (.012, .0420, .002), (-.068, .0420, .002)], seg=2), sx * .0162, sx * .03, 'yz'))
    cut(low, *cuts)
    g.add(low, 'alum', BW_MID)
    # 一體扳機護弓
    outer = fillet([(.018, .032, .002), (.024, -.010, .009), (.082, -.016, .010), (.100, -.003, .006), (.104, .032, .002)], seg=5)
    inner = fillet([(.0265, .036, .001), (.0305, -.0040, .006), (.0795, -.0095, .007), (.0935, -.0005, .004), (.0955, .036, .001)], seg=5)
    tg = prism(outer, -.0078, .0078, 'yz', 'tg'); cut(tg, prism(inner, -.02, .02, 'yz'))
    g.add(tg, 'alum', BW_MID)
    g.add(prism(fillet([(.0590, .034, .0), (.0650, .034, .0), (.0640, .004, .0015), (.0585, .0015, .002), (.0565, .0030, .0)], seg=3), -.0036, .0036, 'yz', 'trg'), 'steel', BW_FINE)
    # 護木：八角管 + 四面導軌 + 斜面長窗
    hg = prism(ring(8, .0272, 0, BZ, math.radians(22.5)), .170, .346, 'xz', 'hg')
    bevel_now(hg, BW)
    cuts = [cyl((0, BZ), .0182, .16, .36, n=32)]
    for k in range(4):
        for j in range(3):
            y = .184 + j * .0510
            w = prism(rrect(.0078, .0400, .0034, 3, 0, y + .0200), BZ + .010, BZ + .045, 'xy')
            cuts.append(rot(w, (0, 1, 0), 45 + 90 * k, (0, 0, BZ)))
    cut(hg, *cuts)
    g.add(hg, 'alum', BW_MID)
    apo = .0248
    g.rail(.171, .3455, xf=lambda o: move(o, 0, 0, BZ + apo))
    for k, (y0, y1) in zip((1, 2, 3), ((.195, .340), (.180, .3455), (.195, .340))):
        g.rail(y0, y1, xf=lambda o, k=k: rot(move(o, 0, 0, BZ + apo), (0, 1, 0), 90 * k, (0, 0, BZ)))
    for k in (45, 135, 225, 315):
        for y in (.177, .341):
            b = lathe([(0, .0026), (.0008, .0026), (.0008, 0)], 14, (0, 0), 'z'); move(b, 0, y, BZ + .0250)
            g.add(rot(b, (0, 1, 0), k, (0, 0, BZ)), 'oxide', None)
    # 前端環
    g.add(lathe([(.346, .0), (.346, .0238), (.3480, .0250), (.3525, .0250), (.3550, .0150), (.3550, 0)], 36, (0, BZ)), 'alum', None)
    # 槍管與斜切消焰器
    g.add(lathe([(.170, .0098), (.352, .0098), (.356, .0086), (.396, .0086), (.396, 0)], 26, (0, BZ)), 'steel', None)
    fh = lathe([(.392, .0086), (.3945, .0118), (.452, .0118), (.452, .0072), (.408, .0062), (.408, 0)], 36, (0, BZ), name='fh')
    cuts = [rot(box(-.03, .03, .445, .50, BZ - .04, BZ + .04), (1, 0, 0), 32, (0, .4445, BZ))]
    for a in (0, 60, 120):
        cuts.append(rot(box(-.0017, .0017, .413, .50, BZ - .03, BZ + .03), (0, 1, 0), a, (0, 0, BZ)))
    cut(fh, *cuts)
    # 扳手平面
    fl = []
    for sx in (1, -1):
        fl.append(box(sx * .0098, sx * .03, .3975, .4085, BZ - .03, BZ + .03))
    cut(fh, *fl)
    g.add(fh, 'steel', BW_FINE)
    # 折疊備用照門（平躺）
    g.add(prism(fillet([(.312, .0, .001), (.333, .0, .001), (.333, .0042, .001), (.3255, .0085, .001), (.312, .0085, .001)], seg=2), -.0072, .0072, 'yz', 'fs'), 'oxide', BW_FINE).data.transform(Matrix.Translation((0, 0, BZ + .0296)))
    g.add(prism(fillet([(-.074, .0, .001), (-.042, .0, .001), (-.042, .0058, .001), (-.052, .0085, .001), (-.074, .0085, .001)], seg=2), -.0095, .0095, 'yz', 'rs'), 'oxide', BW_FINE).data.transform(Matrix.Translation((0, 0, .0973)))
    # 尾端板與雙導桿
    g.add(prism(fillet([(-.0205, .0345, .004), (.0205, .0345, .004), (.0205, .0885, .006), (-.0205, .0885, .006)], seg=3), -.0955, -.0820, 'xz', 'end'), 'alum', BW)
    for sx in (1, -1):
        g.add(lathe([(-.210, .0058), (-.0955, .0058)], 20, (sx * .0135, .0620)), 'steel', None)
    # 伸縮托：聚合物骨架
    st = prism(fillet([(-.168, .0865, .005), (-.302, .0905, .004), (-.302, -.0340, .006), (-.286, -.0340, .008), (-.230, .0060, .010), (-.168, .0360, .006)], seg=4), -.0155, .0155, 'yz', 'stock')
    bevel_now(st, BW)
    tri = prism(fillet([(-.206, .0720, .006), (-.284, .0755, .006), (-.284, -.0140, .007), (-.262, -.0030, .007), (-.219, .0300, .007)], seg=4), -.03, .03, 'yz')
    cut(st, tri)
    g.add(st, 'poly', BW_MID)
    # 導桿滑塊 + 卡榫桿
    g.add(prism(fillet([(-.168, .0540, .002), (-.150, .0540, .002), (-.150, .0700, .002), (-.168, .0700, .002)], seg=2), -.0220, .0220, 'yz', 'sl'), 'poly', BW_MID)
    g.add(prism(fillet([(-.166, .0495, .001), (-.139, .0480, .001), (-.137, .0520, .001), (-.166, .0545, .001)], seg=2), -.0055, .0055, 'yz', 'lv'), 'oxide', BW_FINE)
    # 托面橡膠墊與頰墊
    pad = loft_y([(-.3020, .0925, -.0370, .0170, .006, .006), (-.3110, .0935, -.0355, .0178, .009, .008), (-.3175, .0925, -.0345, .0172, .009, .008)], 3, 'pad')
    ribs = []
    for i in range(7):
        z = -.024 + i * .0165
        ribs.append(box(-.03, .03, -.325, -.3160, z, z + .0052))
    cut(pad, *ribs)
    g.add(pad, 'rubber', BW_FINE)
    g.add(loft_y([(-.1900, .0985, .0860, .0150, .005, .002), (-.2300, .1025, .0875, .0165, .006, .002), (-.2850, .1025, .0895, .0165, .006, .002), (-.2995, .0995, .0900, .0150, .005, .002)], 3, 'cheek'), 'poly', BW)
    # 握把
    def gsec(s):
        rx = .0135 + .0012 * math.sin(s * 3.14)
        return fillet([(-rx, -.021 - .002 * s, .0085), (rx, -.021 - .002 * s, .0085), (rx, .021 + .001 * s, .0095), (-rx, .021 + .001 * s, .0095)], seg=4)
    a = (0, .016, .034); b = (0, -.030, -.074)
    g.add(loft_frames(grip_stations(a, b, gsec, 10, -.002), 'grip'), 'grip', BW_MID, knurl=dict(a=a, b=b, pitch=.0019, lo=.14, hi=.88))
    bdir = (Vector(b) - Vector(a)).normalized(); v = Vector((0, 1, 0)); v = (v - bdir * v.dot(bdir)).normalized()
    g.add(loft_frames([(Vector(b) - bdir * .002, (1, 0, 0), tuple(v), rrect(.0300, .0520, .0090, 4)), (Vector(b) + bdir * .0045, (1, 0, 0), tuple(v), rrect(.0300, .0520, .0090, 4)), (Vector(b) + bdir * .0060, (1, 0, 0), tuple(v), rrect(.0270, .0490, .0085, 4))], 'gcap'), 'poly', BW_FINE)
    # 直式長彈匣（微弧），下段橫肋、窗
    def magsec(s):
        return fillet([(-.0118, -.0298, .002), (.0118, -.0298, .002), (.0118, .0290, .0025), (.0040, .0312, .001), (-.0040, .0312, .001), (-.0118, .0290, .0025)], seg=2)
    mf = curved_mag((.1385, .030), 2, 11, .165, magsec, 9)
    mag = loft_frames(mf, 'mag')
    cuts = []
    for sx in (1, -1):
        for fr in (mf[5], mf[6], mf[7]):
            o = fr[0]; v2 = fr[2]
            b1 = box(sx * .0108, sx * .02, o[1] - .022, o[1] + .022, o[2] - .0021, o[2] + .0021)
            cuts.append(rot(b1, (1, 0, 0), math.degrees(math.atan2(v2[2], v2[1])), o))
    cut(mag, *cuts)
    g.add(mag, 'poly', BW_FINE)
    g.marks['mag'] = (0, .1385, .030)
    last = mf[-1]; o = Vector(last[0]); v2 = Vector(last[2]); dn = Vector((0, -v2[2], v2[1])) * -1
    sec2 = lambda k: rrect(.0268 * k, .0660 * k, .0050, 3, 0, .0005)
    g.add(loft_frames([(o - dn * .002, (1, 0, 0), tuple(v2), sec2(1)), (o + dn * .0050, (1, 0, 0), tuple(v2), sec2(1.02)), (o + dn * .0082, (1, 0, 0), tuple(v2), sec2(.96))], 'mbase'), 'poly', BW_FINE)
    # 控制件
    g.add(lathe([(.0172, .0074), (.0186, .0074), (.0194, .0064), (.0194, 0)], 24, (.012, .0390), 'x'), 'oxide', None)
    g.add(prism(fillet([(.0085, .0375, .001), (.0280, .0370, .001), (.0280, .0410, .001), (.0085, .0405, .001)], seg=2), .0190, .0228, 'yz', 'sel'), 'steel', BW_FINE)
    g.add(lathe([(.0172, .0058), (.0205, .0058), (.0212, .0048), (.0212, 0)], 20, (.0955, .0170), 'x'), 'steel', None)
    g.add(prism(fillet([(.0845, -.0025, .001), (.0935, -.0025, .001), (.0955, .0135, .002), (.0850, .0135, .002)], seg=2), -.0200, -.0170, 'yz', 'cat'), 'oxide', BW_FINE)
    for y in (-.060, .072):
        for sx in (1, -1):
            g.pin(sx * .0172, y, .0385, r=.0030, h=sx * .0006, mat='oxide', dome=False)
    for k in (1, -1):
        g.hexbolt(k * .0205, .158, .0505, r=.0028, h=k * .0008)
        g.hexbolt(k * .0205, .158, .0845, r=.0028, h=k * .0008)
    g.marks['muzzle'] = (0, .4525, BZ)
    return g


def gear(n, r, d):
    """外緣滾花的多邊形（2n 點）。"""
    return [((r - (d if i % 2 else 0)) * math.cos(math.pi * i / n), (r - (d if i % 2 else 0)) * math.sin(math.pi * i / n)) for i in range(2 * n)]


def build_l40():
    g = Gun('l40'); BZ = .072; SZ = .1300
    # 聚合物底盤：V 底前段
    prof = fillet([(.392, .0660, .002), (.392, .0440, .012), (.350, .0320, .012), (.180, .0190, .014), (.104, .0120, .006), (.024, .0120, .004),
                   (-.024, .0200, .004), (-.122, .0330, .004), (-.122, .0660, .003)], seg=4)
    ch = prism(prof, -.0300, .0300, 'yz', 'chassis')
    vc = []
    for sx in (1, -1):
        vc.append(prism([(sx * .036, .0448), (sx * .008, .0224), (sx * .008, -.03), (sx * .036, -.03)], .10, .40, 'xz'))
        vc.append(prism([(sx * .0185, .0760), (sx * .036, .0760), (sx * .036, .0525)], -.13, .40, 'xz'))
    cut(ch, *vc)
    bevel_now(ch, BW)
    cuts = [box(-.0185, .0185, -.100, .178, .058, .09), cyl((0, BZ), .0190, .17, .40, n=32), box(-.0125, .0125, .17, .40, BZ, .09)]
    for i in range(5):
        y = .205 + i * .0340
        cuts.append(prism(fillet([(y, .0345, .003), (y + .0225, .0345, .003), (y + .0190, .0545, .003), (y - .0035, .0545, .003)], seg=3), -.04, .04, 'yz'))
    # 彈匣井開口
    cuts.append(box(-.0138, .0138, .1135, .1895, -.02, .040))
    cut(ch, *cuts)
    g.add(ch, 'olive', BW_MID)
    # 機匣
    act = lathe([(-.078, .0), (-.078, .0170), (-.0760, .0178), (.158, .0178), (.170, .0178), (.170, 0)], 40, (0, BZ), name='act')
    cut(act, box(-.03, .03, -.09, .18, .0868, .12))
    bevel_now(act, BW)
    port = prism(fillet([(.012, .0640, .003), (.082, .0640, .003), (.082, .0900, .003), (.012, .0900, .003)], seg=3), .004, .03, 'yz')
    cut(act, port)
    g.add(act, 'steel', BW_MID)
    g.add(lathe([(.170, .0192), (.1725, .0200), (.1875, .0200), (.190, .0192), (.190, 0)], 36, (0, BZ)), 'oxide', None)
    g.rail(-.0835, .1665, width=.0212, xf=lambda o: move(o, 0, 0, .0866), mat='alum')
    # 槍機：內部本體 + 後段旋轉拉柄 + 尾帽
    g.add(cyl((0, BZ), .0102, -.074, .080, n=28), 'steel', BW_FINE)
    g.add(lathe([(-.112, 0), (-.112, .0085), (-.1095, .0118), (-.0970, .0132), (-.0900, .0132), (-.0880, .0165), (-.0780, .0165), (-.0780, 0)], 32, (0, BZ)), 'oxide', None)
    # 拉柄：右下方，帶圓錐握球
    h0 = Vector((.0090, -.0600, BZ - .0020)); h1 = Vector((.0640, -.0760, BZ - .0420))
    d = (h1 - h0); L = d.length
    stem = lathe([(0, .0058), (L * .55, .0046), (L * .86, .0050), (L * .86, 0)], 18, (0, 0), name='stem')
    knob = lathe([(L * .80, .0), (L * .80, .0060), (L * .86, .0090), (L * .92, .0105), (L * 1.0, .0105), (L * 1.06, .0088), (L * 1.095, .0045), (L * 1.10, 0)], 28, (0, 0), name='knob')
    q = Vector((0, 1, 0)).rotation_difference(d.normalized()).to_matrix().to_4x4()
    for ob, w in ((stem, None), (knob, None)):
        ob.data.transform(Matrix.Translation(h0) @ q); ob.data.update(); g.add(ob, 'steel', w)
    g.add(cyl((0, -.0600), .0110, -.0145, .0145, 'x', 20), 'steel', None).data.transform(Matrix.Translation((.0, 0, BZ - .0020)))
    # 栓槍機匣後缺口外的片
    g.add(prism(fillet([(-.094, .0605, .001), (-.082, .0605, .001), (-.082, .0660, .001), (-.094, .0660, .001)], seg=2), -.0190, .0190, 'yz'), 'oxide', BW_FINE)
    # 凹槽重槍管
    def flute(r, d):
        n = 48; pts = []
        for i in range(n):
            th = 2 * math.pi * i / n; c = abs(math.cos(3 * th)) ** 1.0
            rr = r - d * max(0.0, 1 - (1 - c) * 4) ** 1.5
            pts.append((rr * math.cos(th), BZ + rr * math.sin(th)))
        return pts
    g.add(lathe([(.188, .0165), (.215, .0150), (.222, .0138)], 36, (0, BZ)), 'steel', None)
    g.add(loft([[(x, y, z) for x, z in flute(r, .0026)] for y, r in ((.222, .0138), (.470, .0126), (.712, .0112))], 'barrel'), 'steel', None)
    g.add(lathe([(.708, .0112), (.722, .0112), (.722, 0)], 28, (0, BZ)), 'steel', None)
    # 槍口制動器：三段方塊
    br = prism(rrect(.0310, .0300, .0065, 4, 0, BZ), .716, .786, 'xz', 'brake')
    bevel_now(br, BW)
    cuts = []
    for i in range(3):
        y = .728 + i * .0168
        cuts.append(prism(fillet([(y, BZ - .0085, .0028), (y + .0098, BZ - .0085, .0028), (y + .0098, BZ + .0085, .0028), (y, BZ + .0085, .0028)], seg=3), -.03, .03, 'yz'))
    cuts.append(cyl((0, BZ), .0068, .70, .80))
    cuts.append(box(-.0036, .0036, .724, .778, BZ + .004, BZ + .03))
    cut(br, *cuts)
    g.add(br, 'oxide', BW_FINE)
    # 雙腳架
    g.add(prism(fillet([(.318, .0110, .002), (.352, .0150, .002), (.352, .0345, .001), (.318, .0290, .001)], seg=3), -.0235, .0235, 'yz', 'clamp'), 'alum', BW)
    g.hexbolt(.0235, .3245, .0225, r=.0036, h=.0010)
    g.hexbolt(-.0235, .3245, .0225, r=.0036, h=-.0010)
    for sx in (1, -1):
        hp = (sx * .0185, .3380, .0165)
        hub = lathe([(sx * .0085, 0), (sx * .0085, .0078), (sx * .0285, .0078), (sx * .0285, 0)], 22, (.3380, .0165), 'x')
        g.add(hub, 'steel', None)
        leg = lathe([(.000, .0075), (.102, .0075), (.104, .0098), (.116, .0098), (.118, .0075), (.1205, .0058), (.170, .0058), (.170, .0100), (.1745, .0108), (.1800, .0096), (.1820, 0)], 22, (0, 0), name='leg')
        m = Matrix.Translation(hp) @ Matrix.Rotation(math.radians(-sx * 5), 4, 'Z') @ Matrix.Rotation(math.radians(1.5), 4, 'X')
        leg.data.transform(m); leg.data.update()
        g.add(leg, 'steel', None)
    # 脊管 + 托
    spine = prism(fillet([(-.0120, .0300, .002), (.0120, .0300, .002), (.0120, .0580, .002), (-.0120, .0580, .002)], seg=2), -.300, -.118, 'xz', 'spine')
    bevel_now(spine, BW)
    cuts = []
    for sx in (1, -1):
        for i in range(4):
            y = -.292 + i * .0410
            cuts.append(prism(rrect(.0290, .0120, .0040, 3, y + .0145, .0440), sx * .0100, sx * .03, 'yz'))
    cut(spine, *cuts)
    g.add(spine, 'alum', BW_MID)
    butt = prism(fillet([(-.220, .0640, .004), (-.3880, .0640, .005), (-.3880, -.0410, .007), (-.3480, -.0500, .006), (-.3180, -.0480, .006), (-.292, -.0160, .012), (-.220, .0290, .007)], seg=4), -.0175, .0175, 'yz', 'butt')
    bevel_now(butt, BW)
    cuts = []
    for sx in (1, -1):
        cuts.append(prism(fillet([(-.320, .0260, .005), (-.3750, .0260, .005), (-.3750, -.0300, .006), (-.3350, -.0310, .006)], seg=4), sx * .0150, sx * .03, 'yz'))
    cut(butt, *cuts)
    g.add(butt, 'olive', BW_MID)
    pad = loft_y([(-.3880, .0660, -.0460, .0178, .005, .005), (-.3975, .0660, -.0445, .0185, .009, .008), (-.4040, .0650, -.0430, .0178, .009, .008)], 3, 'pad')
    ribs = [box(-.03, .03, -.412, -.4025, -.038 + i * .0150, -.038 + i * .0150 + .0048) for i in range(7)]
    cut(pad, *ribs)
    g.add(pad, 'rubber', BW_FINE)
    # 頰墊 + 兩根調高桿
    for y in (-.225, -.3100):
        g.add(lathe([(.0620, .0048), (.0870, .0048)], 18, (0, y), 'z'), 'steel', None)
        g.add(lathe([(.0640, .0082), (.0705, .0082), (.0720, .0072), (.0720, 0)], 22, (0, y), 'z'), 'oxide', None)
    g.add(loft_y([(-.1960, .1010, .0820, .0165, .006, .004), (-.2300, .1045, .0820, .0195, .008, .004), (-.3200, .1045, .0820, .0195, .008, .004), (-.3440, .1010, .0820, .0170, .006, .004)], 3, 'cheek'), 'olive', BW)
    # 扳機護弓（機削）
    outer = fillet([(.024, .0130, .002), (.030, -.0250, .008), (.086, -.0300, .010), (.104, -.0200, .006), (.106, .0130, .002)], seg=5)
    inner = fillet([(.0325, .0170, .001), (.0375, -.0190, .005), (.0830, -.0230, .007), (.0965, -.0170, .004), (.0975, .0170, .001)], seg=5)
    tg = prism(outer, -.0075, .0075, 'yz', 'tg'); cut(tg, prism(inner, -.02, .02, 'yz'))
    g.add(tg, 'alum', BW_MID)
    g.add(prism(fillet([(.0635, .0160, .0), (.0695, .0160, .0), (.0665, -.0030, .004), (.0585, -.0150, .002), (.0560, -.0145, .001), (.0620, -.0030, .005)], seg=4), -.0034, .0034, 'yz', 'trg'), 'steel', BW_FINE)
    # 直立握把
    def gsec(s):
        rx = .0140 + .0012 * math.sin(s * 3.14)
        return sellipse(rx, .0245 + .0030 * math.sin(s * 3.14), 24, 2.8)
    a = (0, .014, .016); b = (0, -.020, -.086)
    g.add(loft_frames(grip_stations(a, b, gsec, 10, -.0015), 'grip'), 'gripol', BW_MID, knurl=dict(a=a, b=b, pitch=.0019, lo=.10, hi=.90))
    bdir = (Vector(b) - Vector(a)).normalized(); v = Vector((0, 1, 0)); v = (v - bdir * v.dot(bdir)).normalized()
    g.add(loft_frames([(Vector(b) - bdir * .002, (1, 0, 0), tuple(v), sellipse(.0148, .0262, 24, 2.8)), (Vector(b) + bdir * .0040, (1, 0, 0), tuple(v), sellipse(.0148, .0262, 24, 2.8)), (Vector(b) + bdir * .0055, (1, 0, 0), tuple(v), sellipse(.0132, .0242, 24, 2.8))], 'gcap'), 'alum', BW_FINE)
    # 短彈匣 + 卡榫
    mag = prism(fillet([(.1140, .0420, .001), (.1885, .0420, .001), (.1860, -.0150, .002), (.1160, -.0150, .002)], seg=3), -.0132, .0132, 'yz', 'mag')
    bevel_now(mag, BW_MID)
    cut(mag, *[prism(rrect(.0560, .0034, .0012, 2, .1510, .0040 - i * .0058), sx * .0120, sx * .03, 'yz') for sx in (1, -1) for i in range(2)])
    g.add(mag, 'oxide', BW_FINE)
    g.add(prism(fillet([(.1125, -.0150, .0015), (.1900, -.0150, .0015), (.1890, -.0232, .0025), (.1135, -.0232, .0025)], seg=3), -.0148, .0148, 'yz', 'mbase'), 'olive', BW_FINE)
    g.add(prism(fillet([(.1005, -.0040, .001), (.1125, -.0040, .001), (.1125, .0120, .001), (.1035, .0120, .001)], seg=2), -.0075, .0075, 'yz', 'magrel'), 'alum', BW_FINE)
    g.marks['mag'] = (0, .151, .040)
    # 瞄準鏡
    g.add(lathe([(-.1500, .0190), (-.1500, .0242), (-.1440, .0250), (-.1160, .0250), (-.1120, .0232), (-.0920, .0205), (-.0800, .0176), (.1200, .0176), (.1520, .0255), (.1760, .0305), (.2260, .0310), (.2290, .0325), (.2470, .0325), (.2485, .0300), (.2485, .0278), (.2340, .0268), (.2340, 0)], 48, (0, SZ), name='scope'), 'steel', None)
    g.add(lathe([(-.1465, .0), (-.1465, .0190), (-.1505, .0190), (-.1505, 0)], 40, (0, SZ)), 'oxide', None)
    g.add(lathe([(.2330, .0), (.2330, .0270), (.2345, .0270), (.2365, .0120), (.2368, 0)], 44, (0, SZ)), 'glass', None)
    g.add(lathe([(-.1510, .0), (-.1490, .0080), (-.1468, .0188), (-.1455, .0188), (-.1455, 0)], 36, (0, SZ)), 'glass', None)
    # 屈光度環
    dio = prism(gear(30, .0262, .0009), 0, .0160, 'xy', 'dio')
    dio.data.transform(Matrix.Translation((0, 0, 0))); rot(dio, (1, 0, 0), 90, (0, 0, 0)); move(dio, 0, -.1250 + .016 * 0, SZ)
    g.add(dio, 'oxide', None)
    # 倍率環
    g.add(lathe([(-.0790, .0192), (-.0770, .0200), (-.0500, .0200), (-.0480, .0190)], 40, (0, SZ)), 'oxide', None)
    # 中央砲塔座
    t2 = lathe([(.0120, .0200), (.0780, .0200)], 40, (0, SZ)); g.add(t2, 'steel', None)
    def turret(axis, sign):
        o = []
        base = lathe([(.0165, .0145), (.0285, .0145), (.0285, 0)], 32, (0, 0), 'z', 'tb')
        cap = prism(gear(32, .0172, .0011), .0285, .0425, 'xy', 'tc')
        top = lathe([(.0425, .0145), (.0445, .0132), (.0445, 0)], 32, (0, 0), 'z', 'tt')
        for ob in (base, cap, top):
            if axis == 'x': rot(ob, (0, 1, 0), sign * 90)
            move(ob, 0, .0450, SZ)
        g.add(base, 'steel', None); g.add(cap, 'oxide', BW_FINE); g.add(top, 'oxide', None)
    turret('z', 1); turret('x', 1)
    g.add(rot(lathe([(.0165, .0115), (.0260, .0115), (.0272, .0100), (.0272, 0)], 28, (0, 0), 'z'), (0, 1, 0), -90), 'oxide', None).data.transform(Matrix.Translation((0, .0450, SZ)))
    # 兩組鏡環：底座夾在導軌上
    for y in (-.0470, .1040):
        rg = prism(fillet([(-.0130, .0895, .001), (.0130, .0895, .001), (.0140, .1000, .001), (.0235, .1175, .004), (.0235, SZ, .002), (.0235, SZ + .0030, .001), (.0100, SZ + .0030, .001), (.0100, SZ - .0060, .0)] + [(-.0100, SZ - .0060, .0), (-.0100, SZ + .0030, .001), (-.0235, SZ + .0030, .001), (-.0235, SZ, .002), (-.0235, .1175, .004), (-.0140, .1000, .001)], seg=3), y, y + .0200, 'xz', 'ring')
        cut(rg, cyl((0, SZ), .0176, y - .01, y + .03, n=40))
        g.add(rg, 'alum', BW_MID)
        cap = prism(fillet([(-.0235, SZ + .0034, .001), (.0235, SZ + .0034, .001), (.0235, SZ + .0140, .004), (.0140, SZ + .0212, .006), (-.0140, SZ + .0212, .006), (-.0235, SZ + .0140, .004)], seg=3), y, y + .0200, 'xz', 'rc')
        cut(cap, cyl((0, SZ), .0176, y - .01, y + .03, n=40))
        g.add(cap, 'alum', BW_MID)
        for sx in (1, -1):
            for dy in (.0055, .0145):
                g.add(lathe([(SZ + .0090, .0024), (SZ + .0160, .0024), (SZ + .0160, 0)], 12, (sx * .0200, y + dy), 'z'), 'oxide', None)
        g.add(box(-.0170, .0170, y + .0020, y + .0180, .0868, .0900), 'oxide', BW_FINE)
        g.add(cyl((y + .0100, .0920), .0028, -.0185, .0185, 'x', 14), 'steel', None)
    g.marks['muzzle'] = (0, .786, BZ)
    return g


def build_p9():
    g = Gun('p9'); BZ = .0680; S0, S1 = -.0740, .1160
    # 滑套：多邊形斷面
    sec = [(-.0130, .0450), (.0130, .0450), (.0145, .0475), (.0145, .0660), (.0075, .0835), (-.0075, .0835), (-.0145, .0660), (-.0145, .0475)]
    sl = prism(fillet([(x, z, .0007) for x, z in sec], seg=2), S0, S1, 'xz', 'slide')
    # 前端與尾端切角（多面），讓頭部像刀削
    cs = [rot(box(-.03, .03, S1 - .03, S1 + .03, .0835, .12), (1, 0, 0), -10, (0, S1 - .0240, .0835)),
          rot(box(-.03, .03, S0 - .03, S0 + .03, .0835, .12), (1, 0, 0), 15, (0, S0 + .0120, .0835))]
    for sx in (1, -1):
        cs.append(rot(box(sx * .0145, sx * .05, S1 - .05, S1 + .03, .03, .10), (0, 0, 1), sx * 13, (sx * .0145, S1 - .0280, .06)))
    cut(sl, *cs)
    cut(sl, box(-.0102, .0102, S0 - .01, S1 + .01, .0300, .0490))
    bevel_now(sl, BW)
    # 刻痕：前傾斜線，只在直立側面
    cuts = []
    for sx in (1, -1):
        for i in range(9):
            y = S0 + .0085 + i * .0034
            c = box(sx * .0133, sx * .03, y, y + .0016, .0490, .0655)
            cuts.append(rot(c, (1, 0, 0), -14, (0, y, .0570)))
        for i in range(6):
            y = .0545 + i * .0034
            c = box(sx * .0133, sx * .03, y, y + .0016, .0505, .0655)
            cuts.append(rot(c, (1, 0, 0), -14, (0, y, .0570)))
    # 頂部減重長槽（前段）
    cuts.append(prism(rrect(.0052, .0360, .0024, 3, 0, .0580), .0815, .10, 'xy'))
    # 拋殼窗
    cuts.append(box(-.0052, .03, .0150, .0545, .0620, .10))
    # 槍口孔、復進簧孔
    cuts.append(cyl((0, BZ), .0078, S1 - .02, S1 + .02, n=28))
    cuts.append(cyl((0, .0520), .0052, S1 - .03, S1 + .02, n=24))
    # 後照門溝
    cuts.append(box(-.012, .012, -.0610, -.0505, .0815, .10))
    cut(sl, *cuts)
    g.add(sl, 'steel', BW_FINE)
    # 槍管：方形膛室罩 + 突出螺牙
    g.add(box(-.0088, .0088, .0060, .0555, .0590, .0815), 'oxide', BW_MID)
    g.add(lathe([(.0500, .0074), (S1 - .001, .0074), (S1 + .0005, .0068), (S1 + .0050, .0068), (S1 + .0050, .0034), (S1 - .015, .0030), (S1 - .015, 0)], 28, (0, BZ)), 'steel', None)
    thr = [(S1 + .0050, .0066)]
    for i in range(8):
        thr += [(S1 + .0053 + i * .0012, .0066), (S1 + .0059 + i * .0012, .0060)]
    thr += [(S1 + .0150, .0060), (S1 + .0150, .0034), (S1 + .0040, .0030), (S1 + .0040, 0)]
    g.add(lathe(thr, 24, (0, BZ)), 'steel', None)
    g.add(lathe([(.1000, .0050), (S1 + .0005, .0050), (S1 + .0005, .0022), (S1 - .004, .0022), (S1 - .004, 0)], 20, (0, .0520)), 'oxide', None)
    # 準星
    g.add(prism(fillet([(.0850, .0822, .001), (.0990, .0770, .001), (.0990, .0805, .001), (.0955, .0890, .001), (.0875, .0890, .001)], seg=2), -.0017, .0017, 'yz', 'fs'), 'oxide', BW_FINE)
    g.add(lathe([(.0896, .0011), (.0900, .0011), (.0900, 0)], 12, (0, .0872)), 'dot', None)
    rs = prism(fillet([(-.0098, .0815, .001), (.0098, .0815, .001), (.0098, .0880, .001), (.0078, .0895, .001), (.0020, .0895, .0), (.0020, .0855, .0), (-.0020, .0855, .0), (-.0020, .0895, .0), (-.0078, .0895, .001), (-.0098, .0880, .001)], seg=2), -.0605, -.0510, 'xz', 'rs')
    g.add(rs, 'oxide', BW_FINE)
    for sx in (1, -1):
        g.add(lathe([(-.0606, .0009), (-.0604, .0009), (-.0604, 0)], 10, (sx * .0058, .0876)), 'dot', None)
    # 擊錘外露部
    g.add(prism(fillet([(-.0800, .0640, .001), (-.0735, .0640, .0), (-.0735, .0760, .0), (-.0790, .0760, .002), (-.0830, .0700, .002)], seg=3), -.0052, .0052, 'yz', 'ham'), 'steel', BW_FINE)
    # 滑軌（鋼片，滑套下方窄縫）
    g.add(box(-.0102, .0102, -.0700, .1090, .0440, .0490), 'oxide', BW_FINE)
    # 槍身（聚合物）
    prof = fillet([(-.0700, .0448, .001), (.1090, .0448, .001), (.1090, .0325, .002), (.0945, .0305, .002), (.0760, .0260, .004), (.0280, .0250, .004), (.0120, .0300, .003),
                   (-.0220, .0300, .003), (-.0400, .0335, .004), (-.0700, .0380, .004), (-.0765, .0420, .003)], seg=3)
    fr = prism(prof, -.0118, .0118, 'yz', 'frame')
    bevel_now(fr, BW)
    cuts = []
    for sx in (1, -1):
        cuts.append(prism(fillet([(.0810, .0365, .002), (.1050, .0375, .002), (.1050, .0420, .002), (.0810, .0420, .002)], seg=2), sx * .0108, sx * .03, 'yz'))
    # 配件導軌兩槽
    for i in range(2):
        y = .0850 + i * .0100
        cuts.append(box(-.03, .03, y, y + .0050, .02, .0335))
    cut(fr, *cuts)
    g.add(fr, 'poly', BW_MID)
    # 扳機護弓（方形前緣）
    outer = fillet([(.0160, .0330, .002), (.0220, -.0040, .007), (.0720, -.0085, .004), (.0760, -.0060, .002), (.0800, .0030, .003), (.0815, .0330, .002)], seg=4)
    inner = fillet([(.0240, .0350, .001), (.0285, .0010, .005), (.0690, -.0030, .003), (.0735, .0060, .002), (.0750, .0350, .001)], seg=4)
    tg = prism(outer, -.0078, .0078, 'yz', 'tg'); cut(tg, prism(inner, -.02, .02, 'yz'))
    g.add(tg, 'poly', BW_MID)
    # 扳機 + 保險片
    g.add(prism(fillet([(.0465, .0340, .0), (.0530, .0340, .0), (.0500, .0180, .004), (.0445, .0065, .002), (.0420, .0070, .001), (.0465, .0180, .005)], seg=4), -.0040, .0040, 'yz', 'trg'), 'steel', BW_FINE)
    # 握把：鬆弛多角斷面 + 高頻菱格
    def gsec(s):
        rx = .0132 + .0013 * math.sin(s * 3.14)
        return fillet([(-rx, -.0235 - .0015 * s, .0090), (rx, -.0235 - .0015 * s, .0090), (rx, .0205 + .0015 * s, .0065), (-rx, .0205 + .0015 * s, .0065)], seg=4)
    a = (0, .0100, .0335); b = (0, -.0235, -.0640)
    g.add(loft_frames(grip_stations(a, b, gsec, 10, -.0012), 'grip'), 'grip', BW_MID, knurl=dict(a=a, b=b, pitch=.0017, lo=.16, hi=.92))
    # 彈匣底座
    bdir = (Vector(b) - Vector(a)).normalized(); v = Vector((0, 1, 0)); v = (v - bdir * v.dot(bdir)).normalized()
    sec2 = lambda k: rrect(.0268 * k, .0500 * k, .0060, 3, 0, -.0015)
    g.add(loft_frames([(Vector(b) - bdir * .0025, (1, 0, 0), tuple(v), sec2(1)), (Vector(b) + bdir * .0060, (1, 0, 0), tuple(v), sec2(1.03)), (Vector(b) + bdir * .0080, (1, 0, 0), tuple(v), sec2(.96))], 'mbase'), 'steel', BW_FINE)
    g.marks['mag'] = (0, .0060, .0300)
    # 控制件
    g.add(prism(fillet([(.0280, .0395, .001), (.0480, .0395, .001), (.0490, .0430, .001), (.0280, .0440, .001)], seg=2), -.0138, -.0116, 'yz', 'stop'), 'oxide', BW_FINE)
    g.add(lathe([(-.0138, .0030), (-.0116, .0030)], 14, (.0380, .0412), 'x'), 'oxide', None)
    g.add(prism(fillet([(.0620, .0355, .001), (.0760, .0355, .001), (.0760, .0420, .001), (.0620, .0420, .001)], seg=2), .0116, .0128, 'yz', 'td'), 'oxide', BW_FINE)
    g.add(box(-.0138, -.0112, .0150, .0240, .0170, .0270), 'oxide', BW_FINE)
    g.pin(.0118, -.0550, .0420, r=.0024, h=.0006, mat='oxide', dome=False)
    g.pin(-.0118, -.0550, .0420, r=.0024, h=-.0006, mat='oxide', dome=False)
    g.pin(.0118, .0720, .0400, r=.0020, h=.0006, mat='oxide', dome=False)
    g.pin(-.0118, .0720, .0400, r=.0020, h=-.0006, mat='oxide', dome=False)
    g.marks['muzzle'] = (0, S1 + .0050, BZ)
    # 可選消音管（獨立節點 p9_sup）：Y0 從槍口前端算起
    Y0 = S1 + .0030
    body = lathe([(Y0, .0040), (Y0, .0150), (Y0 + .0016, .0162), (Y0 + .0210, .0162), (Y0 + .0222, .0172), (Y0 + .1440, .0172), (Y0 + .1456, .0162), (Y0 + .1560, .0162), (Y0 + .1580, .0148), (Y0 + .1580, .0052), (Y0 + .1530, .0046), (Y0 + .1530, 0)], 44, (0, BZ), name='sup')
    cuts = [box(sx * .0148, sx * .03, Y0 + .0030, Y0 + .0180, BZ - .03, BZ + .03) for sx in (1, -1)]
    cut(body, *cuts)
    g.add(body, 'steel', BW_MID, group='sup')
    g.add(lathe([(Y0 - .0010, .0038), (Y0 + .0010, .0038), (Y0 + .0010, 0)] , 18, (0, BZ)), 'oxide', None, group='sup')
    g.marks['sup_muzzle'] = (0, Y0 + .1580, BZ)
    return g


BUILDERS = {'ks': build_ks, 'ar5': build_ar5, 'l40': build_l40, 'p9': build_p9}
PLUG = {}   # 新槍模組：id → module


def load_plugins():
    """載入 tools/guns/<id>.py。"""
    # 這個檔由 blender --python 執行時是 __main__，外掛 import 回來會得到第二份，所以把工具函式當參數 H 傳進去
    if GUN_DIR not in sys.path: sys.path.insert(0, GUN_DIR)
    H = types.SimpleNamespace(**{k: v for k, v in globals().items() if not k.startswith('__')})
    for gid in NEW_GUNS:
        path = os.path.join(GUN_DIR, gid + '.py')
        if not os.path.exists(path): continue
        spec = importlib.util.spec_from_file_location('gun_' + gid, path)
        m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
        PLUG[gid] = m
        BUILDERS[gid] = lambda m=m: m.build(H)
        TEX[gid] = min(getattr(m, 'TEX', NEW_TEX), NEW_TEX)
        if hasattr(m, 'ENGRAVE'): ENGRAVE[gid] = m.ENGRAVE
        if hasattr(m, 'NOWEAR'): NOWEAR[gid] = m.NOWEAR


# ---------- 預覽（無貼圖） ----------
PREV_COL = {'steel': (.035, .04, .05, 1, .28), 'oxide': (.02, .022, .025, .8, .45), 'alum': (.035, .038, .042, .85, .36),
            'poly': (.02, .021, .022, 0, .5), 'olive': (.1, .11, .05, 0, .5), 'wood': (.55, .21, .05, 0, .22),
            'grip': (.012, .013, .015, 0, .6), 'gripol': (.1, .11, .05, 0, .6), 'rubber': (.012, .012, .012, 0, .8),
            'glass': (.01, .02, .05, 0, .04), 'dot': (.9, .9, .85, 0, .4), 'brass': (.5, .36, .12, 1, .32)}


def setup_world(scn):
    w = bpy.data.worlds.new('w'); scn.world = w; w.use_nodes = True
    nt = w.node_tree; bg = nt.nodes['Background']
    # 冷色天空由上往下漸亮，近地平線偏暖，給金屬面有東西可反射
    tc = nt.nodes.new('ShaderNodeTexCoord'); sp = nt.nodes.new('ShaderNodeSeparateXYZ'); ramp = nt.nodes.new('ShaderNodeValToRGB')
    nt.links.new(tc.outputs['Generated'], sp.inputs[0]); nt.links.new(sp.outputs['Z'], ramp.inputs['Fac'])
    cr = ramp.color_ramp; cr.elements[0].position = .0; cr.elements[0].color = (.62, .47, .33, 1)
    cr.elements[1].position = .62; cr.elements[1].color = (.30, .42, .62, 1)
    e = cr.elements.new(.22); e.color = (.95, .88, .78, 1)
    nt.links.new(ramp.outputs[0], bg.inputs[0]); bg.inputs[1].default_value = 1.0

    def sun(name, d, energy, col, ang):
        o = bpy.data.objects.new(name, bpy.data.lights.new(name, 'SUN')); scn.collection.objects.link(o)
        o.data.energy = energy; o.data.color = col; o.data.angle = math.radians(ang)
        o.rotation_euler = (-Vector(d)).to_track_quat('-Z', 'Y').to_euler()
    # 方向是「光來自哪裡」，最終座標：槍右側朝 -X、槍口 -Y
    sun('sun', (-.62, .34, .72), 4.5, (1, .9, .76), 1.2)
    sun('kick', (.35, -.75, .30), 1.6, (.75, .85, 1), 3)


def cam(scn, loc, target, ortho=None, lens=35):
    c = bpy.data.objects.get('cam')
    if c is None:
        c = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); scn.collection.objects.link(c)
    scn.camera = c
    c.location = loc
    d = Vector(target) - Vector(loc); c.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    if ortho: c.data.type = 'ORTHO'; c.data.ortho_scale = ortho
    else: c.data.type = 'PERSP'; c.data.lens = lens
    c.data.clip_start = .005; c.data.clip_end = 20


def fp_cam(scn, gid):
    """第一人稱角度：眼在槍後右上方往前看（最終座標）。"""
    fp = getattr(PLUG.get(gid), 'FP_CAM', None)
    if fp: cam(scn, fp[0], fp[1], lens=fp[2])
    elif gid == 'p9' or (gid in PLUG and PLUG[gid].KIND == 'pistol'): cam(scn, (-.070, .165, .120), (.002, -.070, .060), lens=42)
    elif gid == 'l40': cam(scn, (-.100, .200, .175), (.005, -.280, .082), lens=36)
    else: cam(scn, (-.095, .205, .150), (.004, -.220, .066), lens=38)


def render_to(scn, path, w, h, samples):
    scn.render.resolution_x = w; scn.render.resolution_y = h; scn.render.resolution_percentage = 100
    scn.cycles.samples = samples; scn.render.filepath = path
    scn.render.image_settings.file_format = 'PNG'
    bpy.ops.render.render(write_still=True)


def setup_cycles(scn):
    scn.render.engine = 'CYCLES'
    prefs = bpy.context.preferences.addons['cycles'].preferences
    prefs.compute_device_type = 'METAL'; prefs.get_devices()
    gpu = [d for d in prefs.devices if d.type == 'METAL']
    if gpu and os.environ.get('GH_GPU'):
        for d in prefs.devices: d.use = d.type == 'METAL'
        scn.cycles.device = 'GPU'
    else:
        scn.cycles.device = 'CPU'
    scn.cycles.use_denoising = True
    scn.view_settings.view_transform = 'Khronos PBR Neutral'
    scn.view_settings.look = 'None'
    scn.cycles.max_bounces = 4


def preview(gid):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scn = bpy.context.scene; t0 = time.time()
    g = BUILDERS[gid]()
    mats = {}
    tri = 0
    for p in g.parts:
        finish_part(p['ob'], p['bw'])
        ob = p['ob']; k = p['mat']
        if k not in mats:
            m = bpy.data.materials.new(k); m.use_nodes = True
            b = m.node_tree.nodes['Principled BSDF']; c = PREV_COL[k]
            b.inputs['Base Color'].default_value = (c[0], c[1], c[2], 1); b.inputs['Metallic'].default_value = c[3]; b.inputs['Roughness'].default_value = c[4]
            mats[k] = m
        ob.data.materials.clear(); ob.data.materials.append(mats[k])
        ob.data.calc_loop_triangles(); tri += len(ob.data.loop_triangles)
    print(f'[preview] {gid} parts={len(g.parts)} tris={tri} t={time.time()-t0:.1f}s', flush=True)
    setup_world(scn); setup_cycles(scn)
    # 所有物件轉到最終方向：這裡直接用建模座標拍（X 右、Y 前），相機位置同最終
    bpy.context.view_layer.update()
    co = np.concatenate([mesh_co(p['ob'].data) for p in g.parts])
    y0, y1 = co[:, 1].min(), co[:, 1].max(); z0, z1 = co[:, 2].min(), co[:, 2].max()
    yc, zc = (y0 + y1) / 2, (z0 + z1) / 2; L = (y1 - y0) * 1.1
    cam(scn, (2.0, yc, zc), (0, yc, zc), ortho=L)
    render_to(scn, os.path.join(WORK, f'pv_{gid}_r.png'), 1400, 640, 48)
    cam(scn, (-2.0, yc, zc), (0, yc, zc), ortho=L)
    render_to(scn, os.path.join(WORK, f'pv_{gid}_l.png'), 1400, 640, 48)
    cam(scn, (.12, min(y0, -.2) + .02, .20), (-.015, y1 * .72, .05), lens=30)
    render_to(scn, os.path.join(WORK, f'pv_{gid}_fp.png'), 1400, 800, 48)


# ---------- 模型 → UV → 烘焙資料 ----------
RZ180 = Matrix.Rotation(math.pi, 4, 'Z')
MAT_IDS = ['steel', 'oxide', 'alum', 'poly', 'olive', 'wood', 'grip', 'gripol', 'rubber', 'glass', 'dot', 'brass']


def select_only(obs, active):
    for o in bpy.context.view_layer.objects: o.select_set(False)
    for o in obs: o.select_set(True)
    bpy.context.view_layer.objects.active = active


def bake_pass(scn, mat, build, obs, size, samples):
    nt = mat.node_tree; nt.nodes.clear(); nt.links.clear()
    em = nt.nodes.new('ShaderNodeEmission'); out = nt.nodes.new('ShaderNodeOutputMaterial')
    nt.links.new(em.outputs[0], out.inputs[0])
    nt.links.new(build(nt), em.inputs[0])
    img = bpy.data.images.new('bake', size, size, float_buffer=True, alpha=True)
    img.colorspace_settings.name = 'Non-Color'
    ti = nt.nodes.new('ShaderNodeTexImage'); ti.image = img; nt.nodes.active = ti
    scn.cycles.samples = samples
    bpy.ops.object.bake(type='EMIT', margin=0, use_clear=True)
    px = np.zeros(size * size * 4, dtype=np.float32); img.pixels.foreach_get(px)
    bpy.data.images.remove(img)
    return px.reshape(size, size, 4)


def _geo(nt, name):
    return nt.nodes.new('ShaderNodeNewGeometry').outputs[name]


def stage_model(gid, samples):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scn = bpy.context.scene; t0 = time.time(); size = TEX[gid]
    g = BUILDERS[gid]()
    print(f'[model] {gid} 零件 {len(g.parts)}，建模 {time.time()-t0:.1f}s', flush=True)
    obs = []
    for i, p in enumerate(g.parts):
        ob = p['ob']; ob.data.transform(RZ180); ob.data.update()
        finish_part(ob, p['bw'])
        ob.color = ((i + 1) / 1024.0, 0, 0, 1)
        ob.data.uv_layers.new(name='UVMap'); obs.append(ob)
    tri = 0
    for ob in obs:
        ob.data.calc_loop_triangles(); tri += len(ob.data.loop_triangles)
    print(f'[model] {gid} 導角後 {tri} 三角形 {time.time()-t0:.1f}s', flush=True)
    bpy.context.view_layer.update()
    select_only(obs, obs[0])
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(60), island_margin=.001, area_weight=0.0, correct_aspect=True, scale_to_bounds=False)
    bpy.ops.uv.select_all(action='SELECT')
    bpy.ops.uv.pack_islands(margin_method='FRACTION', margin=.0017, rotate=True, shape_method='CONCAVE')
    bpy.ops.object.mode_set(mode='OBJECT')
    print(f'[model] {gid} UV {time.time()-t0:.1f}s', flush=True)
    # 烘資料
    scn.render.engine = 'CYCLES'; scn.cycles.device = 'CPU'; scn.cycles.use_denoising = False
    scn.render.bake.margin = 0
    mat = bpy.data.materials.new('bake'); mat.use_nodes = True
    for ob in obs:
        ob.data.materials.clear(); ob.data.materials.append(mat)
    select_only(obs, obs[0])

    def b_pos(nt):
        v = nt.nodes.new('ShaderNodeVectorMath'); v.operation = 'ADD'; v.inputs[1].default_value = (1, 1, 1)
        nt.links.new(_geo(nt, 'Position'), v.inputs[0]); return v.outputs[0]

    def b_nor(nt):
        v = nt.nodes.new('ShaderNodeVectorMath'); v.operation = 'MULTIPLY_ADD'
        v.inputs[1].default_value = (.5, .5, .5); v.inputs[2].default_value = (.5, .5, .5)
        nt.links.new(_geo(nt, 'True Normal'), v.inputs[0]); return v.outputs[0]

    def b_pid(nt):
        return nt.nodes.new('ShaderNodeObjectInfo').outputs['Color']

    def b_edge(nt):
        def ao(dist, inside, local, n):
            a = nt.nodes.new('ShaderNodeAmbientOcclusion'); a.inside = inside; a.only_local = local; a.samples = n
            a.inputs['Distance'].default_value = dist; return a.outputs['AO']
        c = nt.nodes.new('ShaderNodeCombineColor')
        nt.links.new(ao(.0016, True, True, 6), c.inputs[0])     # 凸稜：內側 AO
        nt.links.new(ao(.0220, False, False, 6), c.inputs[1])   # 環境遮蔽
        nt.links.new(ao(.0028, False, False, 6), c.inputs[2])   # 凹縫
        return c.outputs[0]

    pos = bake_pass(scn, mat, b_pos, obs, size, 1); print(f'[bake] pos {time.time()-t0:.1f}s', flush=True)
    nor = bake_pass(scn, mat, b_nor, obs, size, 1); print(f'[bake] nor {time.time()-t0:.1f}s', flush=True)
    pid = bake_pass(scn, mat, b_pid, obs, size, 1); print(f'[bake] pid {time.time()-t0:.1f}s', flush=True)
    edg = bake_pass(scn, mat, b_edge, obs, size, samples); print(f'[bake] edge {time.time()-t0:.1f}s', flush=True)
    meta = dict(id=gid, tris=tri, parts=[dict(mat=p['mat'], knurl=p.get('knurl'), grain=p.get('grain'), group=p['group']) for p in g.parts], marks=g.marks)
    os.makedirs(WORK, exist_ok=True)
    np.savez(os.path.join(WORK, f'{gid}_data.npz'), pos=pos[..., :3] - 1.0, nor=(nor[..., :3] - .5) * 2, pid=np.rint(pid[..., 0] * 1024).astype(np.int32) - 1,
             edge=edg[..., :3].astype(np.float32), mask=pos[..., 3] > .5)
    with open(os.path.join(WORK, f'{gid}_meta.json'), 'w') as f: json.dump(meta, f, default=lambda v: list(v))
    # 分組合併
    groups = {}
    for p in g.parts: groups.setdefault(p['group'], []).append(p['ob'])
    placeholder = bpy.data.materials.new(f'{gid}_pbr')
    for name, lst in groups.items():
        for ob in lst:
            ob.data.materials.clear(); ob.data.materials.append(placeholder)
        select_only(lst, lst[0]); bpy.ops.object.join()
        o = bpy.context.view_layer.objects.active
        o.name = gid if name == 'main' else f'{gid}_{name}'; o.data.name = o.name
    if gid in PLUG: world_lod(gid, tri, [bpy.data.objects[gid if n == 'main' else f'{gid}_{n}'] for n in groups if n in ('main', 'mag', 'slide')])
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(WORK, f'{gid}.blend'), compress=False)
    print(f'[model] {gid} 完成 {time.time()-t0:.1f}s', flush=True)


def world_lod(gid, tri, obs):
    """世界裡的槍（士兵手上）：全部零件合成一個減面網格 <id>_w，共用同一張貼圖。"""
    target = getattr(PLUG[gid], 'LOD', NEW_LOD)
    cp = []
    for o in obs:
        c = o.copy(); c.data = o.data.copy(); bpy.context.scene.collection.objects.link(c); cp.append(c)
    select_only(cp, cp[0]); bpy.ops.object.join()
    w = bpy.context.view_layer.objects.active; w.name = f'{gid}_w'; w.data.name = w.name
    if tri > target:
        d = w.modifiers.new('dec', 'DECIMATE'); d.decimate_type = 'COLLAPSE'; d.ratio = target / tri
        with bpy.context.temp_override(object=w, active_object=w, selected_objects=[w]):
            bpy.ops.object.modifier_apply(modifier=d.name)
    bm = bmesh.new(); bm.from_mesh(w.data)
    for e in bm.edges:
        e.smooth = not (len(e.link_faces) == 2 and e.calc_face_angle(0) > math.radians(48))
    bm.to_mesh(w.data); bm.free()
    w.data.polygons.foreach_set('use_smooth', [True] * len(w.data.polygons)); w.data.update()
    w.data.calc_loop_triangles(); print(f'[model] {gid} 世界槍 {len(w.data.loop_triangles)} 三角形', flush=True)


# ---------- 程序化貼圖（numpy） ----------
def hx(s):
    c = np.array([int(s[i:i + 2], 16) / 255 for i in (1, 3, 5)], dtype=np.float32)
    return np.where(c <= .04045, c / 12.92, ((c + .055) / 1.055) ** 2.4)


def to_srgb(c):
    c = np.clip(c, 0, 1)
    return np.where(c <= .0031308, c * 12.92, 1.055 * c ** (1 / 2.4) - .055)


_RT = np.random.default_rng(278).random(65536).astype(np.float32)


def vnoise(p, seed=0):
    pi = np.floor(p).astype(np.int64); f = (p - pi).astype(np.float32); f = f * f * (3 - 2 * f)

    def h(ix, iy, iz):
        n = (pi[:, 0] + ix) * 374761393 + (pi[:, 1] + iy) * 668265263 + (pi[:, 2] + iz) * 1274126177 + seed * 2654435761
        n = (n ^ (n >> 13)) * 1274126177
        return _RT[(n ^ (n >> 16)) & 65535]
    x0 = h(0, 0, 0) * (1 - f[:, 0]) + h(1, 0, 0) * f[:, 0]; x1 = h(0, 1, 0) * (1 - f[:, 0]) + h(1, 1, 0) * f[:, 0]
    x2 = h(0, 0, 1) * (1 - f[:, 0]) + h(1, 0, 1) * f[:, 0]; x3 = h(0, 1, 1) * (1 - f[:, 0]) + h(1, 1, 1) * f[:, 0]
    y0 = x0 * (1 - f[:, 1]) + x1 * f[:, 1]; y1 = x2 * (1 - f[:, 1]) + x3 * f[:, 1]
    return y0 * (1 - f[:, 2]) + y1 * f[:, 2]


# 每個八度旋轉晶格：值雜訊是軸對齊方格，鏡面反射會把它放大成看得見的方塊
_ROT = np.array(Matrix.Rotation(.72, 3, Vector((.48, .64, .6)).normalized()), dtype=np.float32)


def fbm(p, oct=4, seed=0):
    a = .5; t = 0; s = 0; p = p @ _ROT.T
    for i in range(oct):
        t = t + a * vnoise(p, seed + i); s += a; a *= .5; p = (p @ _ROT.T) * 2.03
    return t / s


def sstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t)


def mix(a, b, t):
    t = t[..., None] if a.ndim > t.ndim or b.ndim > t.ndim else t
    return a * (1 - t) + b * t


def dilate(a, mask, iters):
    """以遮罩內的鄰居平均往外填，避免島外背景色被 mipmap 帶進來。"""
    a = a.copy(); m = mask.copy()
    extra = a.ndim == 3
    for _ in range(iters):
        w = np.zeros(m.shape, np.float32); acc = np.zeros_like(a)
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            mm = np.roll(m, (dy, dx), (0, 1)).astype(np.float32)
            aa = np.roll(a, (dy, dx), (0, 1))
            w += mm; acc += aa * (mm[..., None] if extra else mm)
        grow = (~m) & (w > 0)
        a[grow] = (acc[grow] / (w[grow][..., None] if extra else w[grow]))
        m = m | grow
    if extra:
        a[~m] = a[m].mean(0)
    else:
        a[~m] = a[m].mean()
    return a


# 5×7 字形，只含刻字用到的字元
FONT = {'A': '01110 10001 10001 11111 10001 10001 10001', 'C': '01111 10000 10000 10000 10000 10000 01111', 'D': '11110 10001 10001 10001 10001 10001 11110',
        'E': '11111 10000 10000 11110 10000 10000 11111', 'F': '11111 10000 10000 11110 10000 10000 10000', 'H': '10001 10001 10001 11111 10001 10001 10001',
        'I': '01110 00100 00100 00100 00100 00100 01110', 'K': '10001 10010 10100 11000 10100 10010 10001', 'L': '10000 10000 10000 10000 10000 10000 11111',
        'M': '10001 11011 10101 10101 10001 10001 10001', 'N': '10001 11001 10101 10101 10011 10001 10001', 'O': '01110 10001 10001 10001 10001 10001 01110',
        'P': '11110 10001 10001 11110 10000 10000 10000', 'R': '11110 10001 10001 11110 10100 10010 10001', 'S': '01111 10000 10000 01110 00001 00001 11110',
        'T': '11111 00100 00100 00100 00100 00100 00100', 'U': '10001 10001 10001 10001 10001 10001 01110', 'W': '10001 10001 10001 10101 10101 11011 10001',
        'X': '10001 10001 01010 00100 01010 10001 10001', '0': '01110 10011 10101 10101 10101 11001 01110', '1': '00100 01100 00100 00100 00100 00100 01110',
        '2': '01110 10001 00001 00010 00100 01000 11111', '3': '11110 00001 00001 01110 00001 00001 11110', '4': '00010 00110 01010 10010 11111 00010 00010',
        '5': '11111 10000 11110 00001 00001 10001 01110', '6': '00110 01000 10000 11110 10001 10001 01110', '7': '11111 00001 00010 00100 01000 01000 01000',
        '8': '01110 10001 10001 01110 10001 10001 01110', '9': '01110 10001 10001 01111 00001 00010 01100', '-': '00000 00000 00000 01110 00000 00000 00000',
        '.': '00000 00000 00000 00000 00000 00110 00110', ' ': '00000 00000 00000 00000 00000 00000 00000',
        'B': '11110 10001 10001 11110 10001 10001 11110', 'G': '01111 10000 10000 10011 10001 10001 01111', 'J': '00111 00010 00010 00010 00010 10010 01100',
        'Q': '01110 10001 10001 10001 10101 10010 01101', 'V': '10001 10001 10001 10001 10001 01010 00100', 'Y': '10001 10001 01010 00100 00100 00100 00100',
        'Z': '11111 00001 00010 00100 01000 10000 11111'}
# (零件側面 x, 法線正負, 起點 y, 基線 z, 字高, 文字)。右側面字往 +Y 走，左側面字往 -Y 走，看起來才不會鏡像
ENGRAVE = {
    'ks': [(-.0215, -1, .088, .0605, .0038, 'KS-52 OCHRE LINE'), (-.0215, -1, .088, .0665, .0026, 'NO 27806 CAL 7.6'), (.0215, 1, .022, .0640, .0026, 'SAFE'), ],
    'ar5': [(.0205, 1, -.060, .0480, .0026, 'AR5 MOD 2 - NO 40927'), (-.0205, -1, .040, .0490, .0026, 'OCHRE LINE ARMS')],
    'l40': [(-.0300, -1, .092, .0250, .0034, 'L40 LONG LINE'), (-.0300, -1, .092, .0190, .0024, 'NO 11308 CAL 7.6')],
    'p9': [(-.0145, -1, .046, .0595, .0030, 'P9 TIDEWATCH'), (.0145, 1, -.030, .0480, .0024, 'NO 90412 CAL 9')],
}


NOWEAR = {'p9': [(-.0675, -.0325, .0470, .0670), (.0525, .0770, .0470, .0670), (.0600, .0780, .0345, .0430)]}


def glyph_mask(cy, cz, x_right, y0, z0, h, text):
    """回傳落在字形筆畫內的布林陣列。cy,cz 為像素座標。"""
    dot = h / 7.0; adv = dot * 6.2
    u = (cy - y0) / adv if x_right else (y0 - cy) / adv
    v = (z0 + h - cz) / dot
    out = np.zeros(cy.shape, bool)
    for i, ch in enumerate(text):
        rows = FONT.get(ch)
        if rows is None: continue
        rows = rows.split(' ')
        sel = (u >= i) & (u < i + 1) & (v >= 0) & (v < 7)
        if not sel.any(): continue
        cu = ((u[sel] - i) * 6.2).astype(np.int32); cv = v[sel].astype(np.int32)
        hit = np.zeros(cu.shape, bool)
        for r in range(7):
            for c in range(5):
                if rows[r][c] == '1':
                    hit |= (cv == r) & (cu == c)
        idx = np.nonzero(sel)[0]; out[idx[hit]] = True
    return out


def stage_tex(gid):
    t0 = time.time()
    d = np.load(os.path.join(WORK, f'{gid}_data.npz'))
    meta = json.load(open(os.path.join(WORK, f'{gid}_meta.json')))
    mask = d['mask']; S = mask.shape[0]
    pid = np.clip(d['pid'], 0, len(meta['parts']) - 1)
    # 建模座標（繞 Z 轉回去）
    P = d['pos'][mask] * np.array([-1, -1, 1], np.float32); N = d['nor'][mask] * np.array([-1, -1, 1], np.float32)
    pi_ = pid[mask]; E = 1 - d['edge'][mask][:, 0]; AO = d['edge'][mask][:, 1]; CV = 1 - d['edge'][mask][:, 2]
    n = len(P)
    # 每像素公尺（中位數）
    pp = d['pos']; dif = np.linalg.norm(pp[1:, :-1] - pp[:-1, :-1], axis=-1); ok = mask[1:, :-1] & mask[:-1, :-1]
    texel = float(np.median(dif[ok]))
    print(f'[tex] {gid} 覆蓋率 {mask.mean()*100:.0f}% 每像素 {texel*1000:.3f} mm', flush=True)
    mat_of_part = np.array([MAT_IDS.index(p['mat']) for p in meta['parts']])
    M = mat_of_part[pi_]
    part_rand = np.random.default_rng(7).random(len(meta['parts']))[pi_].astype(np.float32)

    alb = np.zeros((n, 3), np.float32); rough = np.zeros(n, np.float32); metal = np.zeros(n, np.float32); h = np.zeros(n, np.float32)

    def pick(*names):
        ids = [MAT_IDS.index(k) for k in names]; return np.isin(M, ids)

    # 共用雜訊
    macro = fbm(P * 38, 3, 1)
    mid = fbm(P * 420, 4, 5)
    fine = fbm(P * 2300, 3, 9)
    scr = vnoise(P * np.array([1500, 64, 1500]) + part_rand[:, None] * 40, 13)
    scratch = sstep(.90, .96, scr) * sstep(.50, .66, macro)
    # 邊緣：凸稜上一條連續細線（手冊的銀白高光邊），雜訊處才磨到亮金屬。
    # 細薄的齒與刻痕整片都會被內側 AO 判成凸稜，用上限把它排除
    line = sstep(.20, .38, E) * (1 - .92 * sstep(.52, .80, E)) * (1 - .88 * sstep(.18, .46, CV))
    spots = sstep(.46, .66, mid * .62 + macro * .28 + fine * .10)
    wear = line * (.46 + .54 * spots)
    for y0, y1, z0, z1 in NOWEAR.get(gid, []):   # 刻痕凸脊窄到內側 AO 分不出是稜線
        wear[(P[:, 1] > y0) & (P[:, 1] < y1) & (P[:, 2] > z0) & (P[:, 2] < z1) & (np.abs(N[:, 0]) > .5)] *= .22

    def surf(names, base, r0, m0, wcol, wr, wm, wamt=1.0, tint=.03):
        idx = pick(*names)
        if not idx.any(): return
        b = hx(base); w = hx(wcol)
        c = np.tile(b, (idx.sum(), 1)) * (1 + (macro[idx, None] - .5) * tint * 2.5 + (part_rand[idx, None] - .5) * tint * 3)
        wm_ = np.clip(wear[idx] * wamt + scratch[idx] * .10 * wamt, 0, 1)
        alb[idx] = mix(c, w, wm_); rough[idx] = r0 * (1 - wm_) + wr * wm_ + (macro[idx] - .5) * .025 + (mid[idx] - .5) * .006
        metal[idx] = m0 * (1 - wm_) + wm * wm_

    surf(['steel'], '#1E2226', .28, .92, '#B7BDC3', .34, 1.0)
    surf(['oxide'], '#17191C', .46, .82, '#8D9299', .40, 1.0, .7)
    surf(['alum'], '#24272B', .36, .88, '#A6ACB2', .34, 1.0, .9)
    surf(['poly'], '#1C1D1F', .50, 0., '#4B4C4F', .62, 0., .55, .05)
    surf(['olive'], '#555A3B', .50, 0., '#868A67', .62, 0., .6, .06)
    surf(['grip'], '#17181B', .65, 0., '#3F4043', .68, 0., .4, .05)
    surf(['gripol'], '#4B5033', .65, 0., '#777B5A', .68, 0., .4, .06)
    surf(['rubber'], '#131314', .82, 0., '#2B2B2C', .86, 0., .4)
    surf(['glass'], '#0A1018', .05, 0., '#0A1018', .05, 0., 0.)
    surf(['dot'], '#E8E6DA', .42, 0., '#E8E6DA', .42, 0., 0.)
    surf(['brass'], '#8A6A2C', .34, .95, '#C9A85E', .3, 1.0, .5)
    idx = pick('glass')
    if idx.any():  # 鍍膜：邊緣偏琥珀，中央偏藍紫
        r = np.linalg.norm(P[idx][:, [0, 2]] - np.median(P[idx][:, [0, 2]], axis=0), axis=1) / .03
        alb[idx] = mix(np.tile(hx('#0B1730'), (idx.sum(), 1)), np.tile(hx('#3A2410'), (idx.sum(), 1)), sstep(.4, 1, r))
    # 木：琥珀清漆
    idx = pick('wood')
    if idx.any():
        q = P[idx]; pr = part_rand[idx]
        warp = (fbm(q * np.array([70, 6, 70]), 3, 21) - .5) * .011
        rr = np.sqrt((q[:, 0] + warp + (pr - .5) * .05) ** 2 + ((q[:, 2] - .045) * 1.15 + warp * .6 + .036) ** 2)
        ring = (rr / .0021) + (fbm(q * np.array([260, 14, 260]), 2, 23) - .5) * .7
        t = ring - np.floor(ring)
        band = sstep(.42, .92, t) * (1 - sstep(.93, 1.0, t))
        fib = fbm(q * np.array([1500, 26, 1500]), 3, 25)
        pore = sstep(.70, .80, vnoise(q * np.array([3000, 60, 3000]), 27))
        c0 = hx('#8C5A2C'); c1 = hx('#5F3216'); c2 = hx('#2A1208')
        tone = np.clip(band * .78 + (fib - .5) * 1.0 + (fbm(q * np.array([46, 5, 46]), 3, 29) - .5) * .9 + .12, 0, 1)
        col = mix(np.tile(c0, (len(q), 1)), np.tile(c1, (len(q), 1)), sstep(0, .6, tone))
        col = mix(col, np.tile(c2, (len(q), 1)), sstep(.55, 1.0, tone) * .85 + pore * .45)
        w = np.clip(wear[idx] * .85 + scratch[idx] * .2, 0, 1)
        alb[idx] = mix(col, np.tile(hx('#CFA26A'), (len(q), 1)), w * .8)
        rough[idx] = .22 + (fib - .5) * .05 + w * .32 + pore * .05
        metal[idx] = 0
        h[idx] = (fib - .5) * texel * .10 - pore * texel * .28
    # 新槍逐把壓暗：第一人稱的環境與自發光倍率高，橄欖、木色會亮成黃綠、橘。模組寫 TINT = {'olive': (.3, .25, .3)} 或單一倍率
    # 世界模型照一般打光，壓暗後整把發黑，所以另存一張未壓暗的小圖 <id>_aw（stage_glb 掛到 <id>_w 的材質）；tint 記下每個像素壓了多少
    tint = np.ones((n, 3), np.float32)
    for name, k in getattr(PLUG.get(gid), 'TINT', {}).items():
        alb[pick(name)] *= np.array(k, np.float32); tint[pick(name)] *= np.array(k, np.float32)
    # 大平面的色階：模組寫 BREAKUP = {'oxide': .3}。粗糙度與明度跟著低頻雜訊走，順便整體抬一點，側面在陽光下才不會壓成一塊黑
    for name, k in getattr(PLUG.get(gid), 'BREAKUP', {}).items():
        idx = pick(name); nz_ = fbm(P[idx] * 90, 3, 47) - .5
        rough[idx] = np.clip(rough[idx] + nz_ * k * .8, .05, 1); alb[idx] *= (1 + nz_ * k * 2.2 + k * .35)[:, None]
    # 表面微結構（以像素尺寸為比例，法線強度與貼圖解析度無關）
    idx = pick('steel'); h[idx] += (vnoise(P[idx] * 700, 41) - .5) * texel * .05 - scratch[idx] * texel * .28
    idx = pick('oxide'); h[idx] += (vnoise(P[idx] * 900, 43) - .5) * texel * .10
    idx = pick('alum'); h[idx] += (vnoise(P[idx] * 1000, 31) - .5) * texel * .09 - scratch[idx] * texel * .25
    idx = pick('poly', 'olive', 'grip', 'gripol'); h[idx] += (vnoise(P[idx] * 1300, 33) - .5) * texel * .30 + (mid[idx] - .5) * texel * .25
    idx = pick('rubber'); h[idx] += (vnoise(P[idx] * 1200, 35) - .5) * texel * .35
    # 菱格：沿握把軸的環狀座標，週向齒數取整數避免接縫
    for i, part in enumerate(meta['parts']):
        k = part.get('knurl')
        if not k: continue
        sel = pi_ == i
        a = np.array(k['a'], np.float32); b = np.array(k['b'], np.float32); L = np.linalg.norm(b - a); dv = (b - a) / L
        rel = P[sel] - a; along = rel @ dv; perp = rel - along[:, None] * dv
        fw = np.array([0, 1, 0], np.float32); fw = fw - dv * (fw @ dv); fw /= np.linalg.norm(fw)
        ang = np.arctan2(perp[:, 0], perp @ fw)
        Nt = int(round(2 * math.pi * .0195 / k['pitch']))
        u = ang / (2 * math.pi) * Nt; v = along / k['pitch']
        tri = lambda x: 1 - 2 * np.abs(x - np.floor(x) - .5)
        pyramids = np.minimum(tri(u + v), tri(u - v))
        s_ = along / L
        zone = sstep(k['lo'], k['lo'] + .012, s_) * (1 - sstep(k['hi'] - .012, k['hi'], s_))
        # 轉角區（前後緣）留光面
        zone = zone * (1 - sstep(.95, 1.0, np.abs(np.cos(ang)) ** 18))
        h[sel] += pyramids * zone * .00040 - (1 - zone) * 0
        alb[sel] *= (.72 + .55 * np.clip(pyramids * zone + (1 - zone) * .6, 0, 1))[:, None]
        rough[sel] += (.5 - pyramids) * .06 * zone
    # 刻字
    for x, sgn, y0, z0, hh, text in ENGRAVE.get(gid, []):
        if not text: continue
        sel = (np.abs(P[:, 0] - x) < .0012) & (N[:, 0] * sgn > .9)
        if not sel.any(): continue
        idxs = np.nonzero(sel)[0]
        hit = glyph_mask(P[idxs, 1], P[idxs, 2], sgn > 0, y0, z0, hh, text)
        ii = idxs[hit]
        h[ii] -= .00010
        # 新槍貼圖只有 1024，字高放大才讀得出來，用白字會比槍本身還搶眼；只比底色亮一點，看起來像壓印
        if gid in PLUG: alb[ii] = alb[ii] * 1.05 + hx('#C8CCD0') * .055
        else: alb[ii] = alb[ii] * .4 + hx('#C8CCD0') * .55
        rough[ii] = np.maximum(rough[ii], .5)
    # 縫裡的沙塵：貼近舊城場景
    dust = np.clip(sstep(.12, .60, CV) * .65 * sstep(.25, .6, mid + (macro - .5) * .5), 0, 1)
    dust *= (M != MAT_IDS.index('glass')) * (M != MAT_IDS.index('dot'))
    for y0, y1, z0, z1 in getattr(PLUG.get(gid), 'NODUST', []):   # 彈匣蓋住的面 AO 全黑，會積成一整片沙，彈匣抽走就露出來
        dust[(P[:, 1] > y0) & (P[:, 1] < y1) & (P[:, 2] > z0) & (P[:, 2] < z1)] = 0
    alb_w = mix(alb / tint, np.tile(hx('#5B4A38'), (n, 1)), dust * .55)
    alb = mix(alb, np.tile(hx('#5B4A38'), (n, 1)), dust * .55)
    rough = rough * (1 - dust) + .78 * dust; metal = metal * (1 - dust * .8)
    ao = np.clip(AO, 0, 1) * .75 + .25

    def field(v, c=None):
        a = np.zeros((S, S, c) if c else (S, S), np.float32); a[mask] = v; return a
    A = dilate(field(to_srgb(alb), 3), mask, 14)
    ORM = dilate(np.dstack([field(ao), field(np.clip(rough, .03, 1)), field(np.clip(metal, 0, 1))]), mask, 14)
    H = dilate(field(h), mask, 3)
    # 法線（OpenGL Y+）：像素列 0 在下（Blender 影像），v 向上
    dx = (np.roll(H, -1, 1) - np.roll(H, 1, 1)) / (2 * texel)
    dy = (np.roll(H, -1, 0) - np.roll(H, 1, 0)) / (2 * texel)
    # 拋掉跨島差分
    grown = dilate(mask.astype(np.float32), mask, 1) > 0
    bad = ~(np.roll(mask, -1, 1) & np.roll(mask, 1, 1) & np.roll(mask, -1, 0) & np.roll(mask, 1, 0))
    dx[bad] = 0; dy[bad] = 0
    nz = 1 / np.sqrt(dx * dx + dy * dy + 1)
    NRM = dilate(np.dstack([-dx * nz, -dy * nz, nz])[..., :3] * .5 + .5, mask, 14)
    for name, arr in (('a', A), ('n', NRM), ('orm', ORM)):
        save_png(arr, os.path.join(WORK, f'{gid}_{name}.png'))
    if getattr(PLUG.get(gid), 'TINT', None):
        save_png(dilate(field(to_srgb(alb_w), 3), mask, 14), os.path.join(WORK, f'{gid}_aw.png'))
    print(f'[tex] {gid} 完成 {time.time()-t0:.1f}s', flush=True)


def save_png(arr, path):
    S = arr.shape[0]
    img = bpy.data.images.new('t', S, S, alpha=False); img.colorspace_settings.name = 'Non-Color'
    rgba = np.ones((S, S, 4), np.float32); rgba[..., :3] = np.clip(arr, 0, 1)
    img.pixels.foreach_set(rgba.ravel()); img.filepath_raw = path; img.file_format = 'PNG'; img.save()
    bpy.data.images.remove(img)


# 法線要無損：平面幾乎全是 127/128，有損編碼以區塊為單位取捨這 ±1 階，金屬高光裡就是方塊
# （對照實驗：基色、ORM 換回 PNG 都不影響，只有法線換回 PNG 方塊才消失）
WEBP_Q = {'a': ['-q', '90'], 'n': ['-lossless', '-z', '6'], 'orm': ['-q', '95']}
WEBP_SIZE = {'a': 2048, 'n': 2048, 'orm': 2048}
NEAR_NORMAL = 60


def to_webp(gid):
    out = {}
    for k in ('a', 'n', 'orm'):
        src = os.path.join(WORK, f'{gid}_{k}.png'); dst = os.path.join(WORK, f'{gid}_{k}.webp')
        cmd = ['cwebp', '-quiet', '-m', '6', *WEBP_Q[k]] + (['-sharp_yuv'] if k != 'n' else [])
        if gid in GUNS and WEBP_SIZE[k] != TEX[gid]: cmd += ['-resize', str(WEBP_SIZE[k]), str(WEBP_SIZE[k])]   # 新槍照烘焙尺寸輸出，這裡放大會浪費
        if gid in PLUG and k == 'n':   # 新槍預算緊：法線用 near-lossless，比 lossless 省四成。亮面看到階梯就在模組寫 NEAR = 100（等於 lossless）
            cmd += ['-near_lossless', str(getattr(PLUG[gid], 'NEAR', NEAR_NORMAL))]
        subprocess.check_call(cmd + [src, '-o', dst]); out[k] = dst
    src = os.path.join(WORK, f'{gid}_aw.png'); dst = os.path.join(WORK, f'{gid}_aw.webp')
    if getattr(PLUG.get(gid), 'TINT', None) and os.path.exists(src):   # 世界模型的未壓暗基色：畫面上最多幾百像素，384 就夠，一張約 8 KB。只跑 glb 沒跑過新版 tex 時沒有這張，世界模型沿用主基色
        subprocess.check_call(['cwebp', '-quiet', '-m', '6', '-q', '45', '-sharp_yuv', '-resize', '384', '384', src, '-o', dst]); out['aw'] = dst
    return out


def stage_glb(ids=GUNS, out_glb=None):
    out_glb = out_glb or OUT_GLB
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scn = bpy.context.scene
    occ = bpy.data.node_groups.new('glTF Material Output', 'ShaderNodeTree')
    occ.interface.new_socket('Occlusion', in_out='INPUT', socket_type='NodeSocketFloat')
    for gid in ids:
        tex = to_webp(gid)
        with bpy.data.libraries.load(os.path.join(WORK, f'{gid}.blend')) as (src, dst):
            dst.objects = [n for n in src.objects if n == gid or n.startswith(gid + '_')]
        meta = json.load(open(os.path.join(WORK, f'{gid}_meta.json')))
        roots = [o for o in dst.objects if o]
        for o in roots: scn.collection.objects.link(o)
        m = roots[0].data.materials[0]; m.use_nodes = True; m.use_backface_culling = True; nt = m.node_tree; nt.nodes.clear()
        out = nt.nodes.new('ShaderNodeOutputMaterial'); b = nt.nodes.new('ShaderNodeBsdfPrincipled'); nt.links.new(b.outputs[0], out.inputs[0])

        def tx(k, cs):
            im = bpy.data.images.load(tex[k]); im.colorspace_settings.name = cs
            t = nt.nodes.new('ShaderNodeTexImage'); t.image = im; return t
        ta = tx('a', 'sRGB'); nt.links.new(ta.outputs[0], b.inputs['Base Color'])
        tn = tx('n', 'Non-Color'); nm = nt.nodes.new('ShaderNodeNormalMap'); nt.links.new(tn.outputs[0], nm.inputs['Color']); nt.links.new(nm.outputs[0], b.inputs['Normal'])
        to = tx('orm', 'Non-Color'); sp = nt.nodes.new('ShaderNodeSeparateColor'); nt.links.new(to.outputs[0], sp.inputs[0])
        nt.links.new(sp.outputs[1], b.inputs['Roughness']); nt.links.new(sp.outputs[2], b.inputs['Metallic'])
        g = nt.nodes.new('ShaderNodeGroup'); g.node_tree = occ; nt.links.new(sp.outputs[0], g.inputs[0])
        if 'aw' in tex:   # <id>_w 換一份材質，只有基色圖不同，法線與 ORM 在 glb 裡共用
            mw = m.copy(); mw.name = m.name + '_w'
            next(n for n in mw.node_tree.nodes if n.type == 'TEX_IMAGE' and n.image == ta.image).image = bpy.data.images.load(tex['aw'])
            bpy.data.objects[gid + '_w'].data.materials[0] = mw
        rz = RZ180
        for name, co in meta['marks'].items():
            parent = gid
            nm2 = f'{gid}_{name}'
            if name == 'sup_muzzle': parent = f'{gid}_sup'
            e = bpy.data.objects.new(nm2, None); scn.collection.objects.link(e)
            e.parent = bpy.data.objects[parent]; e.location = rz @ Vector(co)
    os.makedirs(os.path.dirname(out_glb), exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=out_glb, export_format='GLB', use_selection=False, export_apply=False, export_normals=True, export_tangents=False,
                              export_texcoords=True, export_materials='EXPORT', export_image_format='AUTO', export_animations=False, export_cameras=False, export_lights=False)
    print('[glb]', out_glb, os.path.getsize(out_glb) / 1e6, 'MB', flush=True)


def stage_glb_new(gid):
    """一把新槍一個 glb。先寫暫存再改名：同時有別的 agent 在跑遊戲時讀不到半個檔。"""
    out = os.path.join(OUT_NEW, gid + '.glb'); tmp = os.path.join(WORK, f'{gid}_export.glb')
    stage_glb([gid], tmp)
    os.makedirs(OUT_NEW, exist_ok=True); os.replace(tmp, out)
    mb = os.path.getsize(out) / 1e6
    print(f'[glb] {out} {mb:.2f} MB{"（超過 1.5 MB）" if mb > 1.5 else ""}', flush=True)
    subprocess.call(['node', os.path.join(HERE, 'guns-manifest.mjs')])


def stage_look(gid):
    """上好貼圖的外觀：讀 <id>.glb 拍左右側與第一人稱角度，輸出 dist/gh/look_<id>_*.png。"""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scn = bpy.context.scene
    bpy.ops.import_scene.gltf(filepath=os.path.join(OUT_NEW, gid + '.glb'))
    setup_world(scn); setup_cycles(scn)
    w = bpy.data.objects.get(gid + '_w')
    if w: w.hide_render = True
    co = np.concatenate([mesh_co(o.data) for o in scn.objects if o.type == 'MESH' and o is not w])
    lo, hi = co.min(0), co.max(0); yc, zc = (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2; L = max(hi[1] - lo[1], (hi[2] - lo[2]) * 2.2) * 1.08
    cam(scn, (-2, yc, zc), (0, yc, zc), ortho=L); render_to(scn, os.path.join(WORK, f'look_{gid}_side_r.png'), 1200, 545, 48)
    cam(scn, (2, yc, zc), (0, yc, zc), ortho=L); render_to(scn, os.path.join(WORK, f'look_{gid}_side_l.png'), 1200, 545, 48)
    fp_cam(scn, gid); render_to(scn, os.path.join(WORK, f'look_{gid}_fp.png'), 1000, 600, 48)


def stage_sheet():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scn = bpy.context.scene
    bpy.ops.import_scene.gltf(filepath=OUT_GLB)
    setup_world(scn); setup_cycles(scn)
    # 暖色地面反彈
    bpy.ops.mesh.primitive_plane_add(size=8, location=(0, 0, -.32))
    gnd = bpy.context.object; gm = bpy.data.materials.new('g'); gm.use_nodes = True
    gm.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (.62, .44, .27, 1); gnd.data.materials.append(gm)
    gnd.visible_camera = False
    rows = []
    nodes = {g: bpy.data.objects[g] for g in GUNS}
    sup = bpy.data.objects.get('p9_sup')

    def show(gid, with_sup=False):
        for g, o in nodes.items():
            o.hide_render = g != gid
        if sup: sup.hide_render = not with_sup

    def extent(gid, with_sup=False):
        co = [mesh_co(nodes[gid].data)]
        if with_sup: co.append(mesh_co(sup.data))
        co = np.concatenate(co); return co.min(0), co.max(0)
    W, HH = 1180, 430
    FPW = 760
    tmp = []
    for gid, ws in (('ks', False), ('ar5', False), ('l40', False), ('p9', False), ('p9', True)):
        show(gid, ws); lo, hi = extent(gid, ws)
        yc, zc = (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2; L = max(hi[1] - lo[1], (hi[2] - lo[2]) * W / HH) * 1.08
        cam(scn, (-2, yc, zc), (0, yc, zc), ortho=L)
        a = os.path.join(WORK, f'sh_{gid}{"s" if ws else ""}_side.png'); render_to(scn, a, W, HH, 96)
        # 第一人稱：相機在右後上（最終座標 X 取反）
        fp_cam(scn, gid)
        b = os.path.join(WORK, f'sh_{gid}{"s" if ws else ""}_fp.png'); render_to(scn, b, FPW, HH, 96)
        tmp.append((a, b))
    # 近拍看導角
    for gid, loc, tg in (('ks', (-.16, -.24, .17), (.004, -.08, .075)), ('ar5', (-.17, -.22, .19), (.004, -.10, .075)), ('l40', (-.15, .20, .20), (.0, -.03, .095)), ('p9', (-.15, .10, .14), (.0, -.015, .058))):
        show(gid); cam(scn, loc, tg, lens=38)
        render_to(scn, os.path.join(WORK, f'sh_{gid}_macro.png'), 970, 560, 128)
    # ffmpeg 拼圖
    inputs = []; fc = []; i = 0
    for k, (a, b) in enumerate(tmp):
        inputs += ['-i', a, '-i', b]; fc.append(f'[{i}][{i+1}]hstack[r{k}]'); i += 2
    n = len(tmp)
    for g in GUNS: inputs += ['-i', os.path.join(WORK, f'sh_{g}_macro.png')]
    fc.append(f'[{i}][{i+1}]hstack[m0];[{i+2}][{i+3}]hstack[m1]')
    fc.append(''.join(f'[r{k}]' for k in range(n)) + '[m0][m1]' + f'vstack=inputs={n + 2}[o]')
    subprocess.check_call(['ffmpeg', '-y', '-loglevel', 'error', *inputs, '-filter_complex', ';'.join(fc), '-map', '[o]', SHEET])
    print('[sheet]', SHEET, flush=True)


def stage_compare():
    """與掃描版 guns.glb 同光同角度對拍（唯讀），輸出 dist/guns-hd-compare.png。"""
    src = os.path.join(os.path.dirname(OUT_GLB), 'guns.glb')
    tiles = []
    for gid in GUNS:
        for tag, path in (('scan', src), ('hd', OUT_GLB)):
            bpy.ops.wm.read_factory_settings(use_empty=True)
            scn = bpy.context.scene
            bpy.ops.import_scene.gltf(filepath=path)
            setup_world(scn); setup_cycles(scn)
            obs = [o for o in scn.objects if o.type == 'MESH']
            keep = [o for o in obs if o.name == gid or o.name.startswith(gid + '.') or (o.parent and o.parent.name == gid)]
            if not keep: keep = [o for o in obs if o.name.startswith(gid)]
            for o in obs:
                o.hide_render = o not in keep
            bpy.ops.mesh.primitive_plane_add(size=8, location=(0, 0, -.32))
            gnd = bpy.context.object; gm = bpy.data.materials.new('g'); gm.use_nodes = True
            gm.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (.62, .44, .27, 1); gnd.data.materials.append(gm); gnd.visible_camera = False
            fp_cam(scn, gid)
            a = os.path.join(WORK, f'cmp_{gid}_{tag}.png'); render_to(scn, a, 900, 520, 96); tiles.append(a)
    inputs = sum((['-i', t] for t in tiles), [])
    fc = ';'.join(f'[{i*2}][{i*2+1}]hstack[r{i}]' for i in range(4)) + ';' + ''.join(f'[r{i}]' for i in range(4)) + 'vstack=inputs=4[o]'
    subprocess.check_call(['ffmpeg', '-y', '-loglevel', 'error', *inputs, '-filter_complex', fc, '-map', '[o]', os.path.join(PROJ, 'dist', 'guns-hd-compare.png')])


def main():
    o = argv(); os.makedirs(WORK, exist_ok=True); load_plugins()
    miss = [g for g in o['only'] if g not in BUILDERS]
    if miss: raise SystemExit(f'沒有這些槍的 builder：{miss}')
    new = [g for g in o['only'] if g in NEW_GUNS]; old = [g for g in o['only'] if g in GUNS]
    for gid in o['only']:
        if 'preview' in o['stage']: preview(gid)
        if 'model' in o['stage']: stage_model(gid, o['samples'])
        if 'tex' in o['stage']: stage_tex(gid)
    if 'glb' in o['stage']:
        if old: stage_glb(GUNS, o['hd_out'])   # 舊四把合在 guns_hd.glb，只烘新槍時完全不寫這個檔
        for gid in new: stage_glb_new(gid)
    if 'look' in o['stage']:
        for gid in new: stage_look(gid)
    if old and 'sheet' in o['stage']: stage_sheet()
    if old and 'compare' in o['stage']: stage_compare()


if __name__ == '__main__':
    main()
