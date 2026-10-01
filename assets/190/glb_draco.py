# 190 封頂：glb 後處理 — 每個三角形 primitive 的頂點屬性與索引改存成 KHR_draco_mesh_compression（下載量約剩 1/4）
# 用 Blender 內附的 Draco 編碼器（glTF 匯出器的 libbf_intern_draco_bridge），不需要 npm；輸出固定（同樣的輸入 → 同樣的檔案）。
# 建模腳本在匯出與其他後處理（quantize_glb_colors / strip_glb_attrs）之後最後呼叫 draco_glb(path)；
# 也可以直接重壓現成的 glb（已經壓過的 primitive 會跳過）：
#   /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P assets/190/glb_draco.py -- assets/190/workers.glb ...
#   建模時加環境變數 DRACO=0 會跳過壓縮（輸出未壓縮的 glb，方便用其他工具檢查）。
# 量化：位置 16 位元（每個 primitive 自己的外框；2 m 的人 ≈ 0.03 mm、10 m 的房子 ≈ 0.15 mm）、法線 12、UV 12、浮點頂點色 10、
#   其他浮點屬性 12；整數屬性（8 / 16 位元頂點色、JOINTS_0、WEIGHTS_0、索引）無損。Draco 會重排頂點與三角形，
#   頂點不會合併（非流形的點反而多拆幾個），硬邊照舊。
# 網頁用 DRACOLoader 解碼（解碼器從 jsdelivr 的 three@0.186.0/examples/jsm/libs/draco/gltf/ 載入），解出來的位置與法線是 Float32。
import os, sys, json, struct
from ctypes import cdll, c_void_p, c_uint32, c_size_t, c_char_p, c_bool, c_uint8, c_uint64

QBITS = dict(position=16, normal=12, texcoord=12, color=10, generic=12)
LEVEL = 7                     # Draco 的壓縮等級（0–10，越大越慢越小；7 = edgebreaker + 較強的預測）
EXT = 'KHR_draco_mesh_compression'
CS = {5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4}
NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT2': 4, 'MAT3': 9, 'MAT4': 16}


def _dll():
    import bpy
    base = None
    if 'io_scene_gltf2' in sys.modules:
        base = os.path.dirname(sys.modules['io_scene_gltf2'].__file__)
    else:
        base = os.path.join(bpy.utils.resource_path('LOCAL'), 'scripts', 'addons_core', 'io_scene_gltf2')
    name = {'win32': 'bf_intern_draco_bridge.dll', 'darwin': 'libbf_intern_draco_bridge.dylib'}.get(sys.platform, 'libbf_intern_draco_bridge.so')
    p = os.path.join(base, name)
    if not os.path.exists(p) and sys.platform not in ('win32', 'darwin'):
        p = os.path.join(os.path.dirname(bpy.utils.resource_path('LOCAL')), 'lib', name)
    d = cdll.LoadLibrary(p)
    for f, res, args in (('encoderCreate', c_void_p, [c_uint32]), ('encoderRelease', None, [c_void_p]),
                         ('encoderSetCompressionLevel', None, [c_void_p, c_uint32]),
                         ('encoderSetQuantizationBits', None, [c_void_p, c_uint32, c_uint32, c_uint32, c_uint32, c_uint32]),
                         ('encoderSetIndices', None, [c_void_p, c_size_t, c_uint32, c_void_p]),
                         ('encoderSetAttribute', c_uint32, [c_void_p, c_char_p, c_size_t, c_char_p, c_void_p, c_bool]),
                         ('encoderEncode', c_bool, [c_void_p, c_uint8]),
                         ('encoderGetEncodedVertexCount', c_uint32, [c_void_p]), ('encoderGetEncodedIndexCount', c_uint32, [c_void_p]),
                         ('encoderGetByteLength', c_uint64, [c_void_p]), ('encoderCopy', None, [c_void_p, c_void_p])):
        fn = getattr(d, f)
        fn.restype, fn.argtypes = res, args
    return d


def _read(path):
    raw = open(path, 'rb').read()
    assert raw[:4] == b'glTF', path
    jl = struct.unpack('<I', raw[12:16])[0]
    j = json.loads(raw[20:20 + jl])
    o = 20 + jl
    binb = b''
    if o < len(raw):
        bl = struct.unpack('<I', raw[o:o + 4])[0]
        binb = raw[o + 8:o + 8 + bl]
    return j, binb


def _packed(j, binb, ai):
    """accessor 的資料（去掉 stride 的緊密排列）"""
    a = j['accessors'][ai]
    bv = j['bufferViews'][a['bufferView']]
    item = CS[a['componentType']] * NC[a['type']]
    stride = bv.get('byteStride', item)
    s = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
    if stride == item:
        return binb[s:s + item * a['count']]
    return b''.join(binb[s + i * stride:s + i * stride + item] for i in range(a['count']))


def draco_glb(path, out=None, qbits=QBITS, level=LEVEL, log=True):
    if os.environ.get('DRACO') == '0' and __name__ != '__main__':
        return
    j, binb = _read(path)
    size0 = os.path.getsize(path)
    dll = _dll()
    blobs = []                  # 新的 Draco bufferView 資料（暫時用負號編號，重排時再換成真正的索引）
    cache = {}
    for m in j.get('meshes', []):
        for pr in m['primitives']:
            if EXT in pr.get('extensions', {}) or pr.get('mode', 4) != 4 or pr.get('targets') or 'indices' not in pr or 'POSITION' not in pr['attributes']:
                continue
            key = (tuple(sorted(pr['attributes'].items())), pr['indices'])
            if key not in cache:
                n = j['accessors'][pr['attributes']['POSITION']]['count']
                enc = dll.encoderCreate(n)
                ids, keep = {}, []
                for k, ai in pr['attributes'].items():
                    a = j['accessors'][ai]
                    data = _packed(j, binb, ai)
                    keep.append(data)
                    ids[k] = dll.encoderSetAttribute(enc, k.encode(), a['componentType'], a['type'].encode(), data, bool(a.get('normalized', False)))
                ia = j['accessors'][pr['indices']]
                idx = _packed(j, binb, pr['indices'])
                keep.append(idx)
                dll.encoderSetIndices(enc, ia['componentType'], ia['count'], idx)
                dll.encoderSetCompressionLevel(enc, level)
                dll.encoderSetQuantizationBits(enc, qbits['position'], qbits['normal'], qbits['texcoord'], qbits['color'], qbits['generic'])
                if not dll.encoderEncode(enc, 0):
                    dll.encoderRelease(enc)
                    raise RuntimeError('Draco 編碼失敗：' + m.get('name', '?'))
                buf = bytes(dll.encoderGetByteLength(enc))
                dll.encoderCopy(enc, buf)
                nv, ni = dll.encoderGetEncodedVertexCount(enc), dll.encoderGetEncodedIndexCount(enc)
                dll.encoderRelease(enc)
                blobs.append(buf)
                # 新的 accessor（沒有 bufferView，數量照 Draco 解出來的）；原本的若沒人用，重排時丟掉
                acc = {}
                for k, ai in list(pr['attributes'].items()) + [('__idx', pr['indices'])]:
                    a = {kk: vv for kk, vv in j['accessors'][ai].items() if kk not in ('bufferView', 'byteOffset')}
                    a['count'] = ni if k == '__idx' else nv
                    j['accessors'].append(a)
                    acc[k] = len(j['accessors']) - 1
                cache[key] = (-len(blobs), ids, acc)
            bvi, ids, acc = cache[key]
            pr['attributes'] = {k: acc[k] for k in pr['attributes']}
            pr['indices'] = acc['__idx']
            pr.setdefault('extensions', {})[EXT] = {'bufferView': bvi, 'attributes': dict(ids)}
    if not blobs:
        if log:
            print('draco: 沒有要壓的 primitive', path)
        if out and out != path:
            open(out, 'wb').write(open(path, 'rb').read())
        return
    # 重排：只留下有人用的 accessor 與 bufferView
    used = set()
    for m in j.get('meshes', []):
        for pr in m['primitives']:
            used |= set(pr['attributes'].values())
            if 'indices' in pr:
                used.add(pr['indices'])
            for t in pr.get('targets', []):
                used |= set(t.values())
    for s in j.get('skins', []):
        if 'inverseBindMatrices' in s:
            used.add(s['inverseBindMatrices'])
    for an in j.get('animations', []):
        for sm in an['samplers']:
            used |= {sm['input'], sm['output']}
    amap = {a: i for i, a in enumerate(sorted(used))}
    accs = [j['accessors'][a] for a in sorted(used)]
    R = lambda a: amap[a]
    for m in j.get('meshes', []):
        for pr in m['primitives']:
            pr['attributes'] = {k: R(v) for k, v in pr['attributes'].items()}
            if 'indices' in pr:
                pr['indices'] = R(pr['indices'])
            if 'targets' in pr:
                pr['targets'] = [{k: R(v) for k, v in t.items()} for t in pr['targets']]
    for s in j.get('skins', []):
        if 'inverseBindMatrices' in s:
            s['inverseBindMatrices'] = R(s['inverseBindMatrices'])
    for an in j.get('animations', []):
        for sm in an['samplers']:
            sm['input'], sm['output'] = R(sm['input']), R(sm['output'])
    out_b, views, vmap = bytearray(), [], {}

    def view(bi):
        if bi in vmap:
            return vmap[bi]
        while len(out_b) % 4:
            out_b.extend(b'\0')
        if bi < 0:
            data, v = blobs[-bi - 1], {'buffer': 0}
        else:
            bv = j['bufferViews'][bi]
            s0 = bv.get('byteOffset', 0)
            data, v = binb[s0:s0 + bv['byteLength']], {k: vv for k, vv in bv.items() if k not in ('byteOffset', 'byteLength')}
        v['byteOffset'], v['byteLength'] = len(out_b), len(data)
        out_b.extend(data)
        vmap[bi] = len(views)
        views.append(v)
        return vmap[bi]
    for a in accs:
        if 'bufferView' in a:
            a['bufferView'] = view(a['bufferView'])
    for m in j.get('meshes', []):
        for pr in m['primitives']:
            e = pr.get('extensions', {}).get(EXT)
            if e:
                e['bufferView'] = view(e['bufferView'])
    for im in j.get('images', []):
        if 'bufferView' in im:
            im['bufferView'] = view(im['bufferView'])
    while len(out_b) % 4:
        out_b.extend(b'\0')
    j['accessors'], j['bufferViews'], j['buffers'] = accs, views, [{'byteLength': len(out_b)}]
    for k in ('extensionsUsed', 'extensionsRequired'):
        if EXT not in j.setdefault(k, []):
            j[k].append(EXT)
    js = json.dumps(j, separators=(',', ':'), ensure_ascii=False).encode()
    while len(js) % 4:
        js += b' '
    total = 12 + 8 + len(js) + 8 + len(out_b)
    with open(out or path, 'wb') as f:
        f.write(struct.pack('<III', 0x46546C67, 2, total))
        f.write(struct.pack('<II', len(js), 0x4E4F534A) + js)
        f.write(struct.pack('<II', len(out_b), 0x004E4942) + bytes(out_b))
    if log:
        print('draco', out or path, size0 // 1024, 'KB →', total // 1024, 'KB', len(blobs), 'primitives；網頁 GLB_FILES 的大小 =', total)


if __name__ == '__main__':
    args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    for p in args:
        draco_glb(p)
