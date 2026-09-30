# 共用：常數、座標轉換、雜訊、SWTK / SWMS 二進位寫出。
# 座標：Blender Z 朝上；遊戲 Y 朝上、Z 朝南。game = (bx, bz, -by)。
import math
import struct

import numpy as np

# 地面種類（Rust、JS、Blender 共用，見 SPEC §3）
DIRT, LOOSE, MUD, WATER, JUMP, RAMP, WALL, INFIELD = range(8)
KIND_NAMES = ['DIRT', 'LOOSE', 'MUD', 'WATER', 'JUMP', 'RAMP', 'WALL', 'INFIELD']

# path flags
F_JUMP, F_WATER, F_MUD, F_CHECK, F_RAMP = 1, 2, 4, 8, 16

# 場地網格：72 m × 48 m，0.5 m 一格
CELL = 0.5
GW, GH = 145, 97
ORIGIN_X = -(GW - 1) * CELL / 2
ORIGIN_Z = -(GH - 1) * CELL / 2
PX_PER_M = 8        # 地面貼圖（JPEG，內嵌）每公尺像素
ALBEDO_SS = 2       # 先用 2 倍解析度算再 2×2 平均：地面種類的硬邊界不會變成階梯鋸齒
CHECK_PX_PER_M = 2  # 給 check.mjs 驗顏色方向的小 PNG（不內嵌），一個像素剛好一格

# SWMS mesh 順序（prop 的 mesh_id 就是索引）
MESH_NAMES = [
    'truck_body', 'wheel', 'tire_stack', 'hay_bale', 'barrel', 'grandstand',
    'floodlight', 'flag_pole', 'cactus', 'start_arch', 'fence',
    'pickup_nitro', 'pickup_money',
]
MESH_ID = {n: i for i, n in enumerate(MESH_NAMES)}

# 顏色 alpha 代碼
A_NORMAL, A_PAINT, A_GLOW = 255, 0, 128


def to_game(bx, by, bz):
    return (bx, bz, -by)


def to_blender(gx, gy, gz):
    return (gx, -gz, gy)


def srgb_to_linear(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def linear_to_srgb(c):
    c = min(max(c, 0.0), 1.0)
    return c * 12.92 if c <= 0.0031308 else 1.055 * c ** (1 / 2.4) - 0.055


def hex_rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[k:k + 2], 16) / 255 for k in (0, 2, 4))


# ---------- 雜訊（numpy 向量化、決定性） ----------

def _hash2(ix, iy, seed):
    # 整數格點雜湊 → 0..1
    h = (ix.astype(np.int64) * 374761393 + iy.astype(np.int64) * 668265263 + seed * 144269504) & 0xFFFFFFFF
    h = ((h ^ (h >> 13)) * 1274126177) & 0xFFFFFFFF
    h = h ^ (h >> 16)
    return (h & 0xFFFFFF) / float(0xFFFFFF)


def value_noise(x, y, seed=0):
    x = np.asarray(x, dtype=np.float64)
    y = np.asarray(y, dtype=np.float64)
    ix, iy = np.floor(x), np.floor(y)
    fx, fy = x - ix, y - iy
    ix, iy = ix.astype(np.int64), iy.astype(np.int64)
    ux, uy = fx * fx * (3 - 2 * fx), fy * fy * (3 - 2 * fy)
    a = _hash2(ix, iy, seed)
    b = _hash2(ix + 1, iy, seed)
    c = _hash2(ix, iy + 1, seed)
    d = _hash2(ix + 1, iy + 1, seed)
    return (a + (b - a) * ux) + ((c + (d - c) * ux) - (a + (b - a) * ux)) * uy


def fbm(x, y, seed=0, octaves=4, lac=2.0, gain=0.5):
    # 回傳約 -1..1
    tot = np.zeros(np.broadcast(np.asarray(x), np.asarray(y)).shape)
    amp, norm, f = 1.0, 0.0, 1.0
    for o in range(octaves):
        tot = tot + amp * (value_noise(np.asarray(x) * f, np.asarray(y) * f, seed + o * 31) * 2 - 1)
        norm += amp
        amp *= gain
        f *= lac
    return tot / norm


def cellular(x, y, seed=0):
    # Worley：回傳 (F1, F2)，格點間距 1
    x = np.asarray(x, dtype=np.float64)
    y = np.asarray(y, dtype=np.float64)
    ix, iy = np.floor(x).astype(np.int64), np.floor(y).astype(np.int64)
    f1 = np.full(x.shape, 9.0)
    f2 = np.full(x.shape, 9.0)
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            cx, cy = ix + dx, iy + dy
            px = cx + _hash2(cx, cy, seed)
            py = cy + _hash2(cx, cy, seed + 7)
            d = np.hypot(px - x, py - y)
            f2 = np.where(d < f1, f1, np.minimum(f2, d))
            f1 = np.minimum(f1, d)
    return f1, f2


def smoothstep(e0, e1, x):
    t = np.clip((np.asarray(x, dtype=np.float64) - e0) / (e1 - e0), 0.0, 1.0)
    return t * t * (3 - 2 * t)


class XorShift32:
    # 與 core 同款的決定性亂數（這裡只用於擺放）
    def __init__(self, seed):
        self.s = (seed or 1) & 0xFFFFFFFF

    def next(self):
        s = self.s
        s ^= (s << 13) & 0xFFFFFFFF
        s ^= s >> 17
        s ^= (s << 5) & 0xFFFFFFFF
        self.s = s
        return s

    def rand(self):
        return self.next() / 4294967296.0

    def range(self, a, b):
        return a + (b - a) * self.rand()


# ---------- 二進位寫出 ----------

def _pad4(buf):
    while len(buf) % 4:
        buf.append(0)


def encode_name(name, size):
    b = name.encode('utf-8')
    if len(b) > size - 1:
        raise ValueError(f'名稱超過 {size - 1} bytes：{name!r}')
    return b + b'\0' * (size - len(b))


def write_swtk(path, t):
    # t：tracks.generate() 的結果（heights_cm 為 int16 陣列 gh×gw）
    gw, gh = t['gw'], t['gh']
    hdr = bytearray()
    hdr += b'SWTK'
    hdr += struct.pack('<HHHH', 1, t['id'], gw, gh)
    hdr += struct.pack('<fff', t['cell'], t['origin_x'], t['origin_z'])
    hdr += struct.pack('<HHHH', len(t['path']), len(t['pickups']), len(t['props']), t['laps'])
    hdr += struct.pack('<8f', *t['camera'])
    hdr += encode_name(t['name'], 32)
    assert len(hdr) == 96
    buf = bytearray(hdr)
    h = np.asarray(t['heights_cm'], dtype='<i2').reshape(gh, gw)
    buf += h.tobytes(order='C')
    k = np.asarray(t['kinds'], dtype=np.uint8).reshape(gh, gw)
    buf += k.tobytes(order='C')
    _pad4(buf)
    for (x, z, hw, fl) in t['path']:
        buf += struct.pack('<fffI', x, z, hw, fl)
    assert len(t['start']) == 4
    for (x, z, yaw) in t['start']:
        buf += struct.pack('<ffff', x, z, yaw, 0.0)
    for (x, z) in t['pickups']:
        buf += struct.pack('<ff', x, z)
    for (mid, x, y, z, yaw, sc) in t['props']:
        buf += struct.pack('<HHfffff', mid, 0, x, y, z, yaw, sc)
    with open(path, 'wb') as f:
        f.write(buf)
    return len(buf)


def write_swms(path, meshes):
    # meshes：[(name, pos(N×3 f32), nrm(N×3 f32), col(N×4 u8), idx(M u16))]，順序同 MESH_NAMES
    buf = bytearray(b'SWMS')
    buf += struct.pack('<HH', 1, len(meshes))
    for name, pos, nrm, col, idx in meshes:
        pos = np.asarray(pos, dtype='<f4').reshape(-1, 3)
        nrm = np.asarray(nrm, dtype=np.float64).reshape(-1, 3)
        col = np.asarray(col, dtype=np.uint8).reshape(-1, 4)
        idx = np.asarray(idx, dtype='<u2').reshape(-1)
        nv = len(pos)
        assert nv < 65536 and len(idx) % 3 == 0
        lo, hi = pos.min(axis=0), pos.max(axis=0)
        buf += encode_name(name, 16)
        buf += struct.pack('<II6f', nv, len(idx), *lo, *hi)
        buf += pos.tobytes()
        n4 = np.zeros((nv, 4), dtype=np.int8)
        n4[:, :3] = np.clip(np.round(nrm * 127), -127, 127).astype(np.int8)
        buf += n4.tobytes()
        buf += col.tobytes()
        buf += idx.tobytes()
        _pad4(buf)
    with open(path, 'wb') as f:
        f.write(buf)
    return len(buf)
