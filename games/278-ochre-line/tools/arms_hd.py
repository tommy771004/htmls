"""第一人稱手臂的高模來源：ccransh「FPS Benelli M4 Animations」（CC BY 4.0）的手套與袖子。

原檔的骨架帶不均勻縮放，Blender 的匯入器算不對（手臂會拉成一條線），所以這裡直接讀 GLB，
用 glTF 規範的 全域節點矩陣 × inverseBindMatrix 蒙皮，取得 M4_Idle 第一格的正確網格，
再逐骨剛體對到 stage_arms 用的骨架 rest（UBC 骨架），權重依骨名合併。之後的握持求解照舊。
"""
import bmesh
import bpy
import os
import subprocess
import json,struct,numpy as np
CT={5120:'i1',5121:'u1',5122:'<i2',5123:'<u2',5125:'<u4',5126:'<f4'};NC={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}
class G:
    def __init__(s,f):
        b=open(f,'rb').read();n=struct.unpack('<I',b[12:16])[0];s.j=json.loads(b[20:20+n]);s.bin=b[20+n+8:]
        s.par={}
        for i,N in enumerate(s.j['nodes']):
            for c in N.get('children',[]): s.par[c]=i
    def acc(s,i):
        a=s.j['accessors'][i];v=s.j['bufferViews'][a['bufferView']];nc=NC[a['type']];dt=np.dtype(CT[a['componentType']])
        off=v.get('byteOffset',0)+a.get('byteOffset',0);st=v.get('byteStride',0) or nc*dt.itemsize
        if st==nc*dt.itemsize: r=np.frombuffer(s.bin,dtype=dt,count=a['count']*nc,offset=off).reshape(a['count'],nc)
        else: r=np.stack([np.frombuffer(s.bin,dtype=dt,count=nc,offset=off+k*st) for k in range(a['count'])])
        if a.get('normalized') and dt.kind=='u': r=r/ (255. if dt.itemsize==1 else 65535.)
        return r.copy()
    def local(s,i,tr=None):
        N=s.j['nodes'][i]
        if 'matrix' in N and not tr: return np.array(N['matrix'],float).reshape(4,4).T
        t=np.array(N.get('translation',[0,0,0]),float);q=np.array(N.get('rotation',[0,0,0,1]),float);z=np.array(N.get('scale',[1,1,1]),float)
        if tr and i in tr:
            t=tr[i].get('translation',t);q=tr[i].get('rotation',q);z=tr[i].get('scale',z)
        x,y,zz,w=q/np.linalg.norm(q)
        R=np.array([[1-2*(y*y+zz*zz),2*(x*y-zz*w),2*(x*zz+y*w)],[2*(x*y+zz*w),1-2*(x*x+zz*zz),2*(y*zz-x*w)],[2*(x*zz-y*w),2*(y*zz+x*w),1-2*(x*x+y*y)]])
        m=np.eye(4);m[:3,:3]=R*z;m[:3,3]=t;return m
    def glob(s,tr=None):
        M={}
        def g(i):
            if i in M: return M[i]
            l=s.local(i,tr);M[i]=(g(s.par[i])@l) if i in s.par else l;return M[i]
        for i in range(len(s.j['nodes'])): g(i)
        return M
    def anim(s,name,t=0.0):
        a=next(x for x in s.j['animations'] if name in x.get('name',''))
        tr={}
        for c in a['channels']:
            sm=a['samplers'][c['sampler']];T=s.acc(sm['input'])[:,0];V=s.acc(sm['output'])
            k=int(np.clip(np.searchsorted(T,t),0,len(T)-1));tg=c['target']
            v=V[k*3+1] if sm.get('interpolation')=='CUBICSPLINE' else V[k]
            tr.setdefault(tg['node'],{})[tg['path']]=np.array(v,float)
        return tr
    def prims(s):
        for mi,m in enumerate(s.j['meshes']):
            for p in m['primitives']:
                yield m.get('name'),s.j['materials'][p['material']]['name'],p
    def skinned(s,p,skin,tr=None):
        A=p['attributes'];P=s.acc(A['POSITION']);UV=s.acc(A['TEXCOORD_0']);I=s.acc(p['indices']).reshape(-1,3)
        J=s.acc(A['JOINTS_0']).astype(int);W=s.acc(A['WEIGHTS_0']).astype(float)
        sk=s.j['skins'][skin];IB=s.acc(sk['inverseBindMatrices']).reshape(-1,4,4).transpose(0,2,1);M=s.glob(tr)
        JM=np.stack([M[n]@IB[k] for k,n in enumerate(sk['joints'])])
        h=np.c_[P,np.ones(len(P))];out=np.zeros((len(P),3))
        for c in range(4):
            w=W[:,c,None];T=JM[J[:,c]];out+=w*np.einsum('nij,nj->ni',T,h)[:,:3]
        return dict(P=P,Q=out,UV=UV,I=I,J=J,W=W,JM=JM,names=[s.j['nodes'][n]['name'] for n in sk['joints']],M=M,joints=sk['joints'])

SRC = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '.cache', 'sketchfab', 'fps_benelli_m4_animations.glb')
ANIM = 'M4_Idle'
ARM_SLIM = 0.78   # 原檔是寬鬆外套，第一人稱沿槍管看時袖子會蓋掉半個畫面
FNG = {'index': 'index', 'middle': 'middle', 'ring': 'ring', 'pink': 'pinky'}


def map_bone(n):
    """原檔骨名 -> stage_arms 的骨名；None 表示不是手臂"""
    p = n.split('_')
    side = next((s for s in p if s in ('L', 'R')), None)
    if not side:
        return None
    s = '_' + side.lower()
    h = p[0]
    if h in ('shoulder', 'upperarm'):
        return 'upperarm' + s
    if h == 'lowerarm':
        return 'lowerarm' + s
    if h == 'twist':
        return 'lowerarm' + s
    if h == 'hand':
        return 'hand' + s
    if h == 'thumb':
        return f'thumb_0{p[1]}{s}'
    if h in FNG:
        return f'{FNG[h]}_0{p[1]}{s}' if p[1].isdigit() and p[1] != side and len(p) > 3 else 'hand' + s
    return None


def frame(d, lat):
    y = d / np.linalg.norm(d)
    z = np.cross(y, lat)
    z /= np.linalg.norm(z)
    return np.c_[np.cross(y, z), y, z]


def chain(h, s):
    """h: 骨名 -> 位置。回傳 骨名 -> (頭, 到下一節的向量)"""
    out = {}
    H = h['hand' + s]
    lat = h['pinky_01' + s] - h['index_01' + s]
    arm = [('upperarm' + s, 'lowerarm' + s), ('lowerarm' + s, 'hand' + s)]
    out['hand' + s] = (H, h['middle_01' + s] - H)
    for a, b in arm:
        out[a] = (h[a], h[b] - h[a])
    for f in ('thumb', 'index', 'middle', 'ring', 'pinky'):
        for i in (1, 2, 3):
            a = f'{f}_0{i}{s}'
            b = f'{f}_0{i + 1}{s}'
            out[a] = (h[a], (h[b] - h[a]) if b in h else (h[a] - h[f'{f}_0{i - 1}{s}']))
    return out, lat


def extract_tex(g, mat, key, path):
    M = next(m for m in g.j['materials'] if m['name'] == mat)
    t = (M['normalTexture'] if key == 'n' else M['pbrMetallicRoughness']['baseColorTexture' if key == 'a' else 'metallicRoughnessTexture'])['index']
    src = g.j['textures'][t]['source']
    v = g.j['bufferViews'][g.j['images'][src]['bufferView']]
    o = v.get('byteOffset', 0)
    open(path, 'wb').write(g.bin[o:o + v['byteLength']])


def atlas(g, work, team):
    """手套 3/4、袖子 1/4 併成一張，一隻手臂只要一個材質（draw call 不增加）"""
    for key, out in (('a', 'albedo'), ('n', 'n'), ('o', 'orm')):
        a, b = os.path.join(work, f'_g{key}.bin'), os.path.join(work, f'_s{key}.bin')
        extract_tex(g, 'glove_hardknuckle', key, a)
        extract_tex(g, 'sleeve_st6_generalist', key, b)
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', a, '-i', b, '-filter_complex', '[0:v]format=rgb24,scale=2048:1536:flags=lanczos[g];[1:v]format=rgb24,scale=2048:512:flags=lanczos[s];[g][s]vstack',
                        '-frames:v', '1', os.path.join(work, f'{team}_{out}.png')], check=True)


def build(P, work, team='fph'):
    g = G(SRC)
    tr = g.anim(ANIM)
    atlas(g, work, team)
    prs = {mat: p for _, mat, p in g.prims()}
    gl_ = g.skinned(prs['glove_hardknuckle'], 0, tr)
    sl_ = g.skinned(prs['sleeve_st6_generalist'], 0, tr)
    names = gl_['names']
    # 骨頭位置：用蒙皮矩陣把 IBM 的逆（綁定姿勢的骨頭原點）送到姿勢空間，避開節點鏈的縮放
    IB = g.acc(g.j['skins'][0]['inverseBindMatrices']).reshape(-1, 4, 4).transpose(0, 2, 1)
    sh = {}
    for k, n in enumerate(names):
        q = map_bone(n)
        if q and q not in sh and not n.startswith(('twist', 'shoulder')) and not (n.split('_')[0] in FNG and q.startswith('hand')):
            sh[q] = (gl_['JM'][k] @ np.linalg.inv(IB[k]))[:3, 3]
    th = {n: np.array(P.B[n].translation) for n in P.names if map_bone_ok(n)}
    print('hd src hand', sh['hand_r'], 'glove', gl_['Q'].mean(0), flush=True)
    T = {}
    for s in ('_r', '_l'):
        cs, lat_s = chain(sh, s)
        ct, lat_t = chain(th, s)
        k = np.linalg.norm(ct['hand' + s][1]) / np.linalg.norm(cs['hand' + s][1])
        for b in cs:
            hs, ds = cs[b]
            ht, dt = ct[b]
            Fs, Ft = frame(ds, lat_s), frame(dt, lat_t)
            sy = np.linalg.norm(dt) / np.linalg.norm(ds)
            ka = k * ARM_SLIM if b.startswith(('lowerarm', 'upperarm')) else k
            A = Ft @ np.diag([ka, sy, ka]) @ Fs.T
            T[b] = (A, hs, ht)
        print('hd scale', s, round(float(k), 6), 'hand len', float(np.linalg.norm(ct['hand' + s][1])), flush=True)
    Pv, UV, Tri, groups = [], [], [], {}
    off = 0
    for sk, region in ((gl_, (0.0, 0.25, 1.0, 0.75)), (sl_, (0.0, 0.0, 1.0, 0.25))):
        n = len(sk['Q'])
        W = np.zeros((n, 3))
        wb = {}
        for c in range(4):
            for v in np.nonzero(sk['W'][:, c] > 1e-4)[0]:
                q = map_bone(names[sk['J'][v, c]])
                if q:
                    wb.setdefault(q, {}).setdefault(v, 0.0)
                    wb[q][v] += float(sk['W'][v, c])
        tot = np.zeros(n)
        out = np.zeros((n, 3))
        for q, d in wb.items():
            A, hs, ht = T[q]
            ix = np.fromiter(d.keys(), int)
            w = np.fromiter(d.values(), float)
            out[ix] += w[:, None] * ((sk['Q'][ix] - hs) @ A.T + ht)
            tot[ix] += w
            gr = groups.setdefault(q, ([], []))
            gr[0].extend((ix + off).tolist())
            gr[1].extend(w.tolist())
        out /= tot[:, None]
        Pv.append(out)
        u = sk['UV'].copy()
        u[:, 1] = 1 - u[:, 1]   # glTF -> Blender；下面的 region 是 Blender 的 UV（v 向上）
        u = u * [region[2], region[3]] + [region[0], region[1]]
        UV.append(u)
        Tri.append(sk['I'] + off)
        off += n
    Pv, UV, Tri = np.concatenate(Pv), np.concatenate(UV), np.concatenate(Tri)
    me = bpy.data.meshes.new('lo_body_fph')
    me.from_pydata(Pv.tolist(), [], Tri.tolist())
    me.update()
    vi = np.zeros(len(me.loops), dtype=np.int64)
    me.loops.foreach_get('vertex_index', vi)
    me.uv_layers.new(name='UVMap').data.foreach_set('uv', UV[vi].ravel())
    ob = bpy.data.objects.new('lo_body_fph', me)
    bpy.context.scene.collection.objects.link(ob)
    for q, (ix, w) in groups.items():
        vg = ob.vertex_groups.new(name=q)
        for i, x in zip(ix, w):
            vg.add([i], x, 'REPLACE')
    # 接縫頂點焊起來：手指貼槍時才不會沿 UV 裂開（權重取其中一份，來源本來就相同）
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bm.to_mesh(me)
    bm.free()
    me.update()
    print('hd arms', len(me.vertices), len(me.polygons), {q: len(v[0]) for q, v in list(groups.items())[:4]}, flush=True)
    return ob


def map_bone_ok(n):
    return n.endswith(('_l', '_r')) and n.split('_')[0] in ('upperarm', 'lowerarm', 'hand', 'thumb', 'index', 'middle', 'ring', 'pinky')
