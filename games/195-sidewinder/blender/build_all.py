# 入口：blender -b --factory-startup --python blender/build_all.py -- --out blender/out
# 產出：meshes.bin（SWMS）、track_N.bin（SWTK）、track_N.jpg（地面貼圖）、track_N_check.png（檢查用小圖）、track_N.glb、trucks.glb、props.glb、manifest.json
import json
import os
import sys
import time

import bmesh
import bpy
import numpy as np

sys.dont_write_bytecode = True          # 不在 blender/ 留下 __pycache__
HERE = os.path.dirname(os.path.abspath(__file__))
if HERE not in sys.path:
    sys.path.insert(0, HERE)

import props  # noqa: E402
import tracks  # noqa: E402
import trucks  # noqa: E402
from common import (CELL, GW, GH, ORIGIN_X, ORIGIN_Z, MESH_NAMES, hex_rgb, to_blender,  # noqa: E402
                    write_swms, write_swtk, srgb_to_linear, PX_PER_M, ALBEDO_SS, CHECK_PX_PER_M)


def parse_args():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    out = os.path.join(HERE, 'out')
    only = None
    for k, a in enumerate(argv):
        if a == '--out':
            out = argv[k + 1]
        elif a == '--tracks':
            only = [int(x) for x in argv[k + 1].split(',')]
    return os.path.abspath(out), only


def reset_scene():
    # 清空預設場景（不在腳本內重讀 factory settings，避免 depsgraph 失效）
    for ob in list(bpy.data.objects):
        bpy.data.objects.remove(ob, do_unlink=True)
    for coll in (bpy.data.meshes, bpy.data.materials, bpy.data.cameras, bpy.data.lights, bpy.data.images):
        for d in list(coll):
            coll.remove(d)
    sc = bpy.context.scene
    sc.unit_settings.system = 'METRIC'
    return sc


def collection(name):
    c = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(c)
    return c


# ---------- SWMS：讀取評估後的 Blender 網格 ----------

def mesh_arrays(ob):
    dg = bpy.context.evaluated_depsgraph_get()
    ev = ob.evaluated_get(dg)
    me = ev.to_mesh()
    me.calc_loop_triangles()
    nv, nl, nt, npoly = len(me.vertices), len(me.loops), len(me.loop_triangles), len(me.polygons)
    co = np.empty(nv * 3, dtype=np.float32)
    me.vertices.foreach_get('co', co)
    co = co.reshape(-1, 3)
    lv = np.empty(nl, dtype=np.int32)
    me.loops.foreach_get('vertex_index', lv)
    cn = np.empty(nl * 3, dtype=np.float32)
    me.corner_normals.foreach_get('vector', cn)
    cn = cn.reshape(-1, 3)
    tl = np.empty(nt * 3, dtype=np.int32)
    me.loop_triangles.foreach_get('loops', tl)
    tp = np.empty(nt, dtype=np.int32)
    me.loop_triangles.foreach_get('polygon_index', tp)
    pm = np.zeros(npoly, dtype=np.int32)
    if npoly:
        me.polygons.foreach_get('material_index', pm)
    mcol = []
    for m in me.materials:
        rgb = hex_rgb(m['sw_srgb']) if m and 'sw_srgb' in m else (0.8, 0.8, 0.8)
        a = int(m['sw_alpha']) if m and 'sw_alpha' in m else 255
        mcol.append(tuple(int(round(c * 255)) for c in rgb) + (a,))
    if not mcol:
        mcol = [(200, 200, 200, 255)]
    ev.to_mesh_clear()
    # 每個三角形角點：(頂點, 量化法線, 材質) 去重
    keymap = {}
    pos, nrm, col, idx = [], [], [], []
    for t in range(nt):
        mi = int(pm[tp[t]]) if npoly else 0
        for c in tl[t * 3:t * 3 + 3]:
            v = int(lv[c])
            n = cn[c]
            q = (int(round(n[0] * 127)), int(round(n[1] * 127)), int(round(n[2] * 127)))
            key = (v, q, mi)
            k = keymap.get(key)
            if k is None:
                k = len(pos)
                keymap[key] = k
                x, y, z = co[v]
                pos.append((x, z, -y))                 # game = (bx, bz, -by)
                nn = np.array((n[0], n[2], -n[1]), dtype=np.float64)
                nrm.append(nn / (np.linalg.norm(nn) or 1))
                col.append(mcol[min(mi, len(mcol) - 1)])
            idx.append(k)
    return np.array(pos, np.float32), np.array(nrm), np.array(col, np.uint8), np.array(idx, np.uint16)


# ---------- 模型 ----------

def build_meshes(coll):
    objs = [trucks.build_body(), trucks.build_wheel()] + [fn() for fn in props.BUILDERS]
    assert [o.name.split('.')[0] for o in objs] == MESH_NAMES, [o.name for o in objs]
    for o in objs:
        if o.name not in coll.objects:
            for c in list(o.users_collection):
                c.objects.unlink(o)
            coll.objects.link(o)
    return objs


def instance(src, name, coll, x, y, z, yaw, sc=1.0):
    # 遊戲座標擺放：yaw 繞遊戲 Y（前方 (cos, 0, sin)）= 繞 Blender Z 轉 -yaw
    ob = bpy.data.objects.new(name, src.data)
    ob.location = to_blender(x, y, z)
    ob.rotation_euler = (0.0, 0.0, -yaw)
    ob.scale = (sc, sc, sc)
    coll.objects.link(ob)
    return ob


def export_glb(path, objs):
    for o in bpy.context.scene.objects:
        o.select_set(False)
    for o in objs:
        o.select_set(True)
    kw = dict(filepath=path, export_format='GLB', use_selection=True, export_yup=True,
              export_apply=True, export_extras=False)
    try:
        bpy.ops.export_scene.gltf(**kw, export_draco_mesh_compression_enable=True,
                                  export_draco_mesh_compression_level=6)
    except Exception as e:   # 沒有 Draco 函式庫時退回未壓縮
        print('  (draco 不可用，改未壓縮)', e)
        bpy.ops.export_scene.gltf(**kw)
    for o in objs:
        o.select_set(False)


# ---------- 地形 ----------

def build_terrain(gen, image, coll):
    h = gen['heights']
    bm = bmesh.new()
    verts = []
    for j in range(GH):
        z = ORIGIN_Z + j * CELL
        for i in range(GW):
            x = ORIGIN_X + i * CELL
            verts.append(bm.verts.new(to_blender(x, float(h[j, i]), z)))
    bm.verts.ensure_lookup_table()
    uv = bm.loops.layers.uv.new('UVMap')
    col = bm.loops.layers.float_color.new('kind')
    kc = [tuple(srgb_to_linear(c) for c in hex_rgb(tracks.kind_rgb(k))) + (1.0,) for k in range(8)]
    kinds = gen['kinds']
    for j in range(GH - 1):
        for i in range(GW - 1):
            a = j * GW + i
            q = (verts[a], verts[a + GW], verts[a + GW + 1], verts[a + 1])   # 從上往下看逆時針
            f = bm.faces.new(q)
            f.smooth = True
            for lp, (jj, ii) in zip(f.loops, ((j, i), (j + 1, i), (j + 1, i + 1), (j, i + 1))):
                lp[uv].uv = (ii / (GW - 1), 1.0 - jj / (GH - 1))
                lp[col] = kc[int(kinds[jj, ii])]
    me = bpy.data.meshes.new(f'track_{gen["id"]}_ground')
    bm.to_mesh(me)
    bm.free()
    mat = bpy.data.materials.new(f'track_{gen["id"]}_ground')
    nt = mat.node_tree
    bsdf = nt.nodes.get('Principled BSDF')
    tex = nt.nodes.new('ShaderNodeTexImage')
    tex.image = image
    tex.interpolation = 'Linear'
    nt.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
    bsdf.inputs['Roughness'].default_value = 0.95
    me.materials.append(mat)
    ob = bpy.data.objects.new(f'track_{gen["id"]}_ground', me)
    coll.objects.link(ob)
    return ob


def read_heights(ob):
    # 從評估後的地形網格讀回高度（遊戲 Y = Blender Z），確認頂點順序即 j*gw + i
    dg = bpy.context.evaluated_depsgraph_get()
    ev = ob.evaluated_get(dg)
    me = ev.to_mesh()
    co = np.empty(len(me.vertices) * 3, dtype=np.float64)
    me.vertices.foreach_get('co', co)
    ev.to_mesh_clear()
    co = co.reshape(GH, GW, 3)
    ii, jj = np.meshgrid(np.arange(GW), np.arange(GH))
    assert np.allclose(co[..., 0], ORIGIN_X + ii * CELL, atol=1e-4)
    assert np.allclose(-co[..., 1], ORIGIN_Z + jj * CELL, atol=1e-4)
    return np.clip(np.round(co[..., 2] * 100), -32000, 32000).astype(np.int16)


def save_image(rgb, path, name, fmt):
    H, W, _ = rgb.shape
    img = bpy.data.images.new(name, W, H, alpha=False)
    px = np.ones((H, W, 4), dtype=np.float32)
    px[..., :3] = rgb[::-1]           # Blender 第 0 列在影像底部；檔案第 0 列 = 北（z = origin_z）
    img.pixels.foreach_set(px.ravel())
    img.filepath_raw = path
    if fmt == 'JPEG':
        # save_render 會套場景的色彩轉換：用 Standard／無 look，像素值原樣寫出
        sc = bpy.context.scene
        sc.view_settings.view_transform = 'Standard'
        sc.view_settings.look = 'None'
        st = sc.render.image_settings
        st.file_format = 'JPEG'
        st.color_mode = 'RGB'
        st.quality = 88
        img.save_render(path)
        img.file_format = 'JPEG'
    else:
        img.file_format = 'PNG'
        img.save()
    img.filepath = path
    return img


def save_albedo(gen, path, check_path):
    rgb, W, H = tracks.albedo(gen)
    img = save_image(rgb, path, f'track_{gen["id"]}_albedo', 'JPEG')
    # 給 check.mjs 的小 PNG（每公尺 CHECK_PX_PER_M px，不內嵌進網頁）
    small = tracks.downsample(rgb, PX_PER_M // CHECK_PX_PER_M)
    save_image(small, check_path, f'track_{gen["id"]}_check', 'PNG')
    return img, W, H


def main():
    out, only = parse_args()
    os.makedirs(out, exist_ok=True)
    t0 = time.time()
    reset_scene()
    lib = collection('SW_Meshes')
    objs = build_meshes(lib)
    manifest = dict(meshes=[], tracks=[])

    # SWMS
    arrays = []
    for o in objs:
        pos, nrm, col, idx = mesh_arrays(o)
        arrays.append((o.name.split('.')[0], pos, nrm, col, idx))
        manifest['meshes'].append(dict(name=o.name, verts=len(pos), tris=len(idx) // 3))
        print(f'  mesh {o.name:<14} verts {len(pos):5d}  tris {len(idx) // 3:5d}')
    n = write_swms(os.path.join(out, 'meshes.bin'), arrays)
    print(f'meshes.bin {n} bytes')

    # trucks.glb：車身＋四輪；props.glb：擺設排一列
    tc = collection('SW_TruckPreview')
    body = instance(objs[0], 'truck', tc, 0, 0.42, 0, 0)
    wheels = [instance(objs[1], f'wheel_{k}', tc, sx * trucks.AXLE_X, 0.42, sz * trucks.TRACK_HALF, 0)
              for k, (sx, sz) in enumerate(((1, -1), (1, 1), (-1, -1), (-1, 1)))]
    export_glb(os.path.join(out, 'trucks.glb'), [body] + wheels)
    pc = collection('SW_PropPreview')
    row = []
    x = 0.0
    for o in objs[2:]:
        w = max(o.dimensions.x, o.dimensions.y)
        row.append(instance(o, 'show_' + o.name, pc, x + w / 2, 0, 0, 0))
        x += w + 1.0
    export_glb(os.path.join(out, 'props.glb'), row)

    # 賽道
    for td in tracks.TRACKS:
        if only is not None and td['id'] not in only:
            continue
        gen = tracks.generate(td)
        k = gen['id']
        png = os.path.join(out, f'track_{k}.jpg')
        img, W, H = save_albedo(gen, png, os.path.join(out, f'track_{k}_check.png'))
        c = collection(f'SW_Track{k}')
        ground = build_terrain(gen, img, c)
        gen['heights_cm'] = read_heights(ground)
        assert np.abs(gen['heights_cm'].astype(np.int32) - np.round(gen['heights'] * 100)).max() <= 1
        placed = [ground]
        for p_i, (mid, x, y, z, yaw, sc) in enumerate(gen['props']):
            placed.append(instance(objs[mid], f't{k}_{MESH_NAMES[mid]}_{p_i}', c, x, y, z, yaw, sc))
        export_glb(os.path.join(out, f'track_{k}.glb'), placed)
        nb = write_swtk(os.path.join(out, f'track_{k}.bin'), gen)
        manifest['tracks'].append(dict(
            id=k, name=td['name'], length_m=round(gen['length'], 1), n_path=len(gen['path']),
            n_pickup=len(gen['pickups']), n_props=len(gen['props']), bin_bytes=nb,
            albedo=[W, H], albedo_bytes=os.path.getsize(png)))
        print(f'track_{k}.bin {nb} bytes, jpg {W}x{H} {os.path.getsize(png)} bytes, props {len(gen["props"])}')

    if only is None:
        manifest['note'] = (f'地面貼圖 track_N.jpg：第 0 列 = 北（z = origin_z），第 0 欄 = x = origin_x；每公尺 {PX_PER_M} px'
                            f'（{ALBEDO_SS}×{ALBEDO_SS} 超取樣）。track_N_check.png 是每公尺 {CHECK_PX_PER_M} px 的檢查用小圖，不內嵌。')
        with open(os.path.join(out, 'manifest.json'), 'w', encoding='utf-8') as f:
            json.dump(manifest, f, ensure_ascii=False, indent=1)
    print(f'完成，用時 {time.time() - t0:.1f} s → {out}')


if __name__ == '__main__':
    main()
