// SWTK 賽道檔與 SWMS 模型檔解析（格式見 SPEC §3、§4，小端序）。

const DEC = new TextDecoder('utf-8');

function str(u8, off, len) {
  let end = off;
  while (end < off + len && u8[end] !== 0) end++;
  return DEC.decode(u8.subarray(off, end));
}

// 複製成獨立的 typed array（來源位移不一定對齊）
function f32(buf, off, n) { return new Float32Array(buf.slice(off, off + n * 4)); }

export function parseTrack(buf) {
  const dv = new DataView(buf);
  const u8 = new Uint8Array(buf);
  if (str(u8, 0, 4) !== 'SWTK') throw new Error('SWTK：檔頭不符');
  const ver = dv.getUint16(4, true);
  if (ver !== 1) throw new Error('SWTK：不支援的版本 ' + ver);
  const id = dv.getUint16(6, true);
  const gw = dv.getUint16(8, true), gh = dv.getUint16(10, true);
  const cell = dv.getFloat32(12, true);
  const originX = dv.getFloat32(16, true), originZ = dv.getFloat32(20, true);
  const nPath = dv.getUint16(24, true), nPick = dv.getUint16(26, true);
  const nProps = dv.getUint16(28, true), laps = dv.getUint16(30, true);
  const c = [];
  for (let i = 0; i < 8; i++) c.push(dv.getFloat32(32 + i * 4, true));
  const cam = { x: c[0], y: c[1], z: c[2], yaw: c[3], pitch: c[4], fitW: c[5], fitH: c[6] };
  const name = str(u8, 64, 32);

  const n = gw * gh;
  let off = 96;
  const height = new Float32Array(n);
  for (let k = 0; k < n; k++) height[k] = dv.getInt16(off + k * 2, true) / 100;
  off += n * 2;
  const surface = u8.slice(off, off + n);
  off += n;
  off = (off + 3) & ~3;

  const path = [];
  for (let k = 0; k < nPath; k++, off += 16) {
    path.push({ x: dv.getFloat32(off, true), z: dv.getFloat32(off + 4, true), hw: dv.getFloat32(off + 8, true), flags: dv.getUint32(off + 12, true) });
  }
  const start = [];
  for (let k = 0; k < 4; k++, off += 16) {
    start.push({ x: dv.getFloat32(off, true), z: dv.getFloat32(off + 4, true), yaw: dv.getFloat32(off + 8, true) });
  }
  const pickups = [];
  for (let k = 0; k < nPick; k++, off += 8) pickups.push({ x: dv.getFloat32(off, true), z: dv.getFloat32(off + 4, true) });
  const props = [];
  for (let k = 0; k < nProps; k++, off += 24) {
    props.push({
      mesh: dv.getUint16(off, true),
      x: dv.getFloat32(off + 4, true), y: dv.getFloat32(off + 8, true), z: dv.getFloat32(off + 12, true),
      yaw: dv.getFloat32(off + 16, true), scale: dv.getFloat32(off + 20, true),
    });
  }
  if (off > buf.byteLength) throw new Error('SWTK：檔案長度不足');

  const t = { id, gw, gh, cell, originX, originZ, laps, cam, name, height, surface, path, start, pickups, props };
  // 世界範圍（取樣點涵蓋的區間）
  t.width = (gw - 1) * cell;
  t.depth = (gh - 1) * cell;
  t.heightAt = (x, z) => {
    let fx = (x - originX) / cell, fz = (z - originZ) / cell;
    fx = Math.min(Math.max(fx, 0), gw - 1.0001);
    fz = Math.min(Math.max(fz, 0), gh - 1.0001);
    const i = fx | 0, j = fz | 0, u = fx - i, v = fz - j;
    const k = j * gw + i;
    const a = height[k], b = height[k + 1], c2 = height[k + gw], d = height[k + gw + 1];
    return (a * (1 - u) + b * u) * (1 - v) + (c2 * (1 - u) + d * u) * v;
  };
  t.surfaceAt = (x, z) => {
    const i = Math.round((x - originX) / cell), j = Math.round((z - originZ) / cell);
    if (i < 0 || j < 0 || i >= gw || j >= gh) return 6;
    return surface[j * gw + i];
  };
  return t;
}

export function parseMeshes(buf) {
  const dv = new DataView(buf);
  const u8 = new Uint8Array(buf);
  if (str(u8, 0, 4) !== 'SWMS') throw new Error('SWMS：檔頭不符');
  const ver = dv.getUint16(4, true);
  if (ver !== 1) throw new Error('SWMS：不支援的版本 ' + ver);
  const count = dv.getUint16(6, true);
  const out = [];
  let off = 8;
  for (let m = 0; m < count; m++) {
    const name = str(u8, off, 16);
    const nv = dv.getUint32(off + 16, true), ni = dv.getUint32(off + 20, true);
    const b = [];
    for (let k = 0; k < 6; k++) b.push(dv.getFloat32(off + 24 + k * 4, true));
    off += 48;
    const pos = f32(buf, off, nv * 3); off += nv * 12;
    const nrm = new Int8Array(buf.slice(off, off + nv * 4)); off += nv * 4;
    const col = new Uint8Array(buf.slice(off, off + nv * 4)); off += nv * 4;
    const idx = new Uint16Array(buf.slice(off, off + ni * 2)); off += ni * 2;
    off = (off + 3) & ~3;
    if (off > buf.byteLength) throw new Error('SWMS：檔案長度不足');
    out.push({ name, pos, nrm, col, idx, bbox: { min: [b[0], b[1], b[2]], max: [b[3], b[4], b[5]] } });
  }
  return out;
}
