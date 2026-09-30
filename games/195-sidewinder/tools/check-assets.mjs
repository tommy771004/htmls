// 重新驗證 blender/out/ 的匯出檔是否符合 SPEC §3（SWTK）與 §4（SWMS）與貼圖尺寸。
// 用法：node tools/check-assets.mjs [資料夾=blender/out] [--quiet]；結束碼 0 = 全部通過。
// 也可以 import { checkTrack, checkMeshes, readTrack } 給其他工具用。
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const SURF = ['DIRT', 'LOOSE', 'MUD', 'WATER', 'JUMP', 'RAMP', 'WALL', 'INFIELD'];
export const MESH_NAMES = ['truck_body', 'wheel', 'tire_stack', 'hay_bale', 'barrel', 'grandstand', 'floodlight', 'flag_pole', 'cactus', 'start_arch', 'fence', 'pickup_nitro', 'pickup_money'];
const WALL = 6;
const pad4 = (n) => (n + 3) & ~3;
const cstr = (buf, off, len) => {
  const b = buf.subarray(off, off + len);
  const z = b.indexOf(0);
  return new TextDecoder('utf-8', { fatal: true }).decode(z < 0 ? b : b.subarray(0, z));
};

// 解析 SWTK；格式錯誤直接丟例外。回傳所有欄位（高度已換成公尺）。
export function readTrack(u8) {
  const buf = Buffer.from(u8.buffer ?? u8, u8.byteOffset ?? 0, u8.byteLength);
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  if (buf.length < 96) throw new Error(`檔案只有 ${buf.length} bytes，比檔頭還短`);
  if (cstr(buf, 0, 4) !== 'SWTK') throw new Error('magic 不是 SWTK');
  const t = {
    version: dv.getUint16(4, true), id: dv.getUint16(6, true), gw: dv.getUint16(8, true), gh: dv.getUint16(10, true),
    cell: dv.getFloat32(12, true), originX: dv.getFloat32(16, true), originZ: dv.getFloat32(20, true),
    nPath: dv.getUint16(24, true), nPickup: dv.getUint16(26, true), nProps: dv.getUint16(28, true), laps: dv.getUint16(30, true),
    cam: Array.from({ length: 8 }, (_, i) => dv.getFloat32(32 + 4 * i, true)),
    name: cstr(buf, 64, 32),
  };
  const n = t.gw * t.gh;
  let o = 96;
  const need = pad4(o + 2 * n + n) + t.nPath * 16 + 4 * 16 + t.nPickup * 8 + t.nProps * 24;
  if (buf.length !== need) throw new Error(`檔案長度 ${buf.length}，依檔頭計算應為 ${need}`);
  t.height = new Float32Array(n);
  for (let k = 0; k < n; k++) t.height[k] = dv.getInt16(o + 2 * k, true) / 100;
  o += 2 * n;
  t.surface = buf.subarray(o, o + n);
  o = pad4(o + n);
  t.path = [];
  for (let k = 0; k < t.nPath; k++, o += 16) t.path.push({ x: dv.getFloat32(o, true), z: dv.getFloat32(o + 4, true), hw: dv.getFloat32(o + 8, true), flags: dv.getUint32(o + 12, true) });
  t.start = [];
  for (let k = 0; k < 4; k++, o += 16) t.start.push({ x: dv.getFloat32(o, true), z: dv.getFloat32(o + 4, true), yaw: dv.getFloat32(o + 8, true), pad: dv.getFloat32(o + 12, true) });
  t.pickups = [];
  for (let k = 0; k < t.nPickup; k++, o += 8) t.pickups.push({ x: dv.getFloat32(o, true), z: dv.getFloat32(o + 4, true) });
  t.props = [];
  for (let k = 0; k < t.nProps; k++, o += 24)
    t.props.push({ mesh: dv.getUint16(o, true), pad: dv.getUint16(o + 2, true), x: dv.getFloat32(o + 4, true), y: dv.getFloat32(o + 8, true), z: dv.getFloat32(o + 12, true), yaw: dv.getFloat32(o + 16, true), scale: dv.getFloat32(o + 20, true) });
  t.surfaceAt = (x, z) => {
    const i = Math.round((x - t.originX) / t.cell), j = Math.round((z - t.originZ) / t.cell);
    return i < 0 || j < 0 || i >= t.gw || j >= t.gh ? WALL : t.surface[j * t.gw + i];
  };
  return t;
}

// 回傳 { errors:[], warnings:[], info:{} }
export function checkTrack(buf, expectId, nMeshes = MESH_NAMES.length) {
  const errors = [], warnings = [];
  let t;
  try {
    t = readTrack(buf);
  } catch (e) {
    return { errors: [e.message], warnings, info: {} };
  }
  const E = (m) => errors.push(m), W = (m) => warnings.push(m);
  const fin = (...v) => v.every(Number.isFinite);
  if (t.version !== 1) E(`version ${t.version} ≠ 1`);
  if (expectId != null && t.id !== expectId) E(`track_id ${t.id} ≠ 檔名編號 ${expectId}`);
  if (!(t.cell > 0) || Math.abs(t.cell - 0.5) > 1e-6) W(`cell ${t.cell}（SPEC 為 0.5）`);
  if (t.gw < 8 || t.gh < 8) E(`網格太小 ${t.gw}×${t.gh}`);
  if (!fin(t.originX, t.originZ)) E('origin 不是有限數');
  if (t.laps < 1 || t.laps > 20) E(`laps ${t.laps} 不合理`);
  if (!t.cam.every(Number.isFinite)) E('鏡頭提示含 NaN／Inf');
  if (!t.name) W('賽道名是空的');
  const w = (t.gw - 1) * t.cell, h = (t.gh - 1) * t.cell;
  if (w < 30 || w > 200 || h < 20 || h > 200) W(`場地 ${w.toFixed(1)}×${h.toFixed(1)} m 偏離 SPEC 的約 72×48 m`);

  // 地面與高度
  const hist = new Array(8).fill(0);
  let bad = 0, hmin = Infinity, hmax = -Infinity;
  for (let k = 0; k < t.surface.length; k++) {
    const s = t.surface[k];
    if (s > 7) bad++;
    else hist[s]++;
    hmin = Math.min(hmin, t.height[k]);
    hmax = Math.max(hmax, t.height[k]);
  }
  if (bad) E(`${bad} 個地面值超出 0..7`);
  if (hmax - hmin > 30) W(`高低差 ${(hmax - hmin).toFixed(2)} m 偏大`);
  if (!hist[WALL]) W('沒有任何 WALL 格');

  // 路徑：封閉迴圈、點距、寬度、不能在牆上、要有檢查點
  const x0 = t.originX, z0 = t.originZ, x1 = x0 + w, z1 = z0 + h;
  const inside = (p) => p.x >= x0 && p.x <= x1 && p.z >= z0 && p.z <= z1;
  if (t.nPath < 8) E(`path 只有 ${t.nPath} 點`);
  let len = 0, maxSeg = 0, onWall = 0, outside = 0, cps = 0;
  for (let k = 0; k < t.path.length; k++) {
    const p = t.path[k], q = t.path[(k + 1) % t.path.length];
    if (!fin(p.x, p.z, p.hw)) { E(`path[${k}] 含 NaN`); continue; }
    const d = Math.hypot(q.x - p.x, q.z - p.z);
    len += d;
    maxSeg = Math.max(maxSeg, d);
    if (!inside(p)) outside++;
    if (t.surfaceAt(p.x, p.z) === WALL) onWall++;
    if (!(p.hw > 0.5 && p.hw < 30)) E(`path[${k}] half_width ${p.hw} 不合理`);
    if (p.flags & 8) cps++;
    if (p.flags & ~0x1f) W(`path[${k}] flags 有未定義位元 0x${p.flags.toString(16)}`);
  }
  if (outside) E(`${outside} 個 path 點在場地外`);
  if (onWall) E(`${onWall} 個 path 中心點落在 WALL 格`);
  if (cps < 2) E(`檢查點（flags bit3）只有 ${cps} 個`);
  if (maxSeg > 8) W(`path 最大點距 ${maxSeg.toFixed(2)} m，偏稀`);
  const flagsOf = (bit) => t.path.filter((p) => p.flags & bit).length;

  // 發車格
  t.start.forEach((s, k) => {
    if (!fin(s.x, s.z, s.yaw)) return E(`start[${k}] 含 NaN`);
    if (!inside(s)) E(`start[${k}] 在場地外`);
    else if (t.surfaceAt(s.x, s.z) === WALL) E(`start[${k}] 落在 WALL 格`);
  });
  for (let a = 0; a < 4; a++)
    for (let b = a + 1; b < 4; b++) if (Math.hypot(t.start[a].x - t.start[b].x, t.start[a].z - t.start[b].z) < 1.8) E(`start[${a}] 與 start[${b}] 距離 < 1.8 m，卡車會重疊`);
  if (t.path.length) {
    const p0 = t.path[0], d = Math.min(...t.start.map((s) => Math.hypot(s.x - p0.x, s.z - p0.z)));
    if (d > 20) W(`發車格離 path[0]（起終點線）${d.toFixed(1)} m`);
  }

  // 道具與擺設
  if (t.nPickup < 8) W(`pickup 點只有 ${t.nPickup} 個（state 有 8 個道具欄）`);
  t.pickups.forEach((p, k) => {
    if (!fin(p.x, p.z) || !inside(p)) E(`pickup[${k}] 在場地外或含 NaN`);
    else if (t.surfaceAt(p.x, p.z) === WALL) W(`pickup[${k}] 落在 WALL 格，撿不到`);
  });
  t.props.forEach((p, k) => {
    if (p.mesh >= nMeshes) E(`prop[${k}] mesh_id ${p.mesh} ≥ ${nMeshes}`);
    if (p.mesh <= 1 || p.mesh >= 11) W(`prop[${k}] 用了 ${MESH_NAMES[p.mesh] ?? p.mesh}（卡車／道具網格不該當擺設）`);
    if (!fin(p.x, p.y, p.z, p.yaw, p.scale) || !(p.scale > 0)) E(`prop[${k}] 數值不合理`);
  });

  const share = hist.map((c) => ((100 * c) / t.surface.length).toFixed(0) + '%');
  return {
    errors, warnings, track: t,
    info: {
      name: t.name, grid: `${t.gw}×${t.gh}`, size: `${w.toFixed(0)}×${h.toFixed(0)} m`, laps: t.laps,
      path: `${t.nPath} 點 / ${len.toFixed(0)} m`, cps, jump: flagsOf(1), water: flagsOf(2), mud: flagsOf(4), ramp: flagsOf(16),
      pickups: t.nPickup, props: t.nProps, height: `${hmin.toFixed(2)}..${hmax.toFixed(2)} m`,
      surface: SURF.map((s, i) => `${s} ${share[i]}`).join(' '),
    },
  };
}

export function checkMeshes(u8) {
  const errors = [], warnings = [], meshes = [];
  const buf = Buffer.from(u8.buffer ?? u8, u8.byteOffset ?? 0, u8.byteLength);
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const E = (m) => errors.push(m), W = (m) => warnings.push(m);
  if (buf.length < 8 || cstr(buf, 0, 4) !== 'SWMS') return { errors: ['magic 不是 SWMS'], warnings, meshes };
  const version = dv.getUint16(4, true), n = dv.getUint16(6, true);
  if (version !== 1) E(`version ${version} ≠ 1`);
  if (n < MESH_NAMES.length) E(`只有 ${n} 個 mesh，SPEC 需要 ${MESH_NAMES.length} 個`);
  let o = 8, tris = 0;
  for (let m = 0; m < n; m++) {
    if (o + 40 > buf.length) { E(`mesh ${m} 檔頭超出檔尾`); break; }
    const name = cstr(buf, o, 16), nv = dv.getUint32(o + 16, true), ni = dv.getUint32(o + 20, true);
    const bbox = Array.from({ length: 6 }, (_, i) => dv.getFloat32(o + 24 + 4 * i, true));
    o += 48;
    const end = pad4(o + nv * 12 + nv * 4 + nv * 4 + ni * 2);
    if (end > buf.length) { E(`mesh ${m} ${name} 資料超出檔尾`); break; }
    const tag = `mesh ${m} ${name}`;
    if (MESH_NAMES[m] && name !== MESH_NAMES[m]) E(`${tag}：名稱應為 ${MESH_NAMES[m]}`);
    if (!nv || !ni) E(`${tag}：沒有頂點或索引`);
    if (nv > 65535) E(`${tag}：${nv} 個頂點超過 u16 索引上限`);
    if (ni % 3) E(`${tag}：索引數 ${ni} 不是 3 的倍數`);
    const eps = 1e-3;
    let outBox = 0, nan = 0;
    for (let v = 0; v < nv; v++) {
      const x = dv.getFloat32(o + 12 * v, true), y = dv.getFloat32(o + 12 * v + 4, true), z = dv.getFloat32(o + 12 * v + 8, true);
      if (![x, y, z].every(Number.isFinite)) nan++;
      else if (x < bbox[0] - eps || y < bbox[1] - eps || z < bbox[2] - eps || x > bbox[3] + eps || y > bbox[4] + eps || z > bbox[5] + eps) outBox++;
    }
    if (nan) E(`${tag}：${nan} 個頂點含 NaN`);
    if (outBox) E(`${tag}：${outBox} 個頂點在 bbox 外`);
    o += nv * 12;
    let badN = 0;
    for (let v = 0; v < nv; v++) {
      const l = Math.hypot(dv.getInt8(o + 4 * v), dv.getInt8(o + 4 * v + 1), dv.getInt8(o + 4 * v + 2)) / 127;
      if (l < 0.85 || l > 1.15) badN++;
    }
    if (badN) W(`${tag}：${badN} 個法線長度偏離 1`);
    o += nv * 4;
    const alphas = new Set();
    for (let v = 0; v < nv; v++) alphas.add(buf[o + 4 * v + 3]);
    for (const a of alphas) if (![0, 128, 255].includes(a)) { W(`${tag}：顏色 alpha 有非定義值 ${a}`); break; }
    if (m === 0 && !alphas.has(0)) W(`${tag}：沒有 alpha=0 的車隊塗裝頂點`);
    o += nv * 4;
    let oob = 0;
    for (let k = 0; k < ni; k++) if (dv.getUint16(o + 2 * k, true) >= nv) oob++;
    if (oob) E(`${tag}：${oob} 個索引超出頂點數`);
    o = end;
    tris += ni / 3;
    meshes.push({ name, nv, tris: ni / 3, bbox: bbox.map((b) => +b.toFixed(2)) });
  }
  if (o !== buf.length && !errors.length) E(`檔尾多出 ${buf.length - o} bytes`);
  // 卡車尺寸對照 SPEC：長約 2.5 m、寬約 1.7 m；輪半徑 0.42
  const body = meshes[0], wheel = meshes[1];
  if (body) {
    const L = body.bbox[3] - body.bbox[0], Wd = body.bbox[5] - body.bbox[2];
    if (L < 2 || L > 3.4 || Wd < 1.3 || Wd > 2.2) W(`truck_body 尺寸 ${L.toFixed(2)}×${Wd.toFixed(2)} m，SPEC 約 2.5×1.7`);
  }
  if (wheel) {
    const r = (wheel.bbox[4] - wheel.bbox[1]) / 2;
    if (Math.abs(r - 0.42) > 0.08) W(`wheel 半徑 ${r.toFixed(2)} m，SPEC 為 0.42`);
  }
  return { errors, warnings, meshes, tris };
}

// JPEG 尺寸：找第一個 SOF0..SOF15（不含 DHT C4、JPG C8、DAC CC）區段
export function jpegSize(buf) {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let o = 2;
  while (o + 9 < buf.length) {
    if (buf[o] !== 0xff) return null;
    const m = buf[o + 1];
    if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) { o += 2; continue; }
    const len = buf.readUInt16BE(o + 2);
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
      return { h: buf.readUInt16BE(o + 5), w: buf.readUInt16BE(o + 7), progressive: m === 0xc2 };
    }
    o += 2 + len;
  }
  return null;
}

// ---- CLI ----
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const args = process.argv.slice(2);
  const dir = resolve(args.find((a) => !a.startsWith('--')) || resolve(root, 'blender/out'));
  const quiet = args.includes('--quiet');
  let fails = 0, warns = 0;
  const report = (label, r) => {
    fails += r.errors.length;
    warns += r.warnings.length;
    console.log(`${r.errors.length ? 'FAIL' : 'ok  '} ${label}`);
    for (const e of r.errors) console.log(`       錯誤：${e}`);
    if (!quiet) for (const w of r.warnings) console.log(`       注意：${w}`);
  };

  const mf = resolve(dir, 'meshes.bin');
  let nMeshes = MESH_NAMES.length;
  if (!existsSync(mf)) report('meshes.bin', { errors: [`找不到 ${mf}`], warnings: [] });
  else {
    const r = checkMeshes(readFileSync(mf));
    nMeshes = Math.max(r.meshes.length, 1);
    report(`meshes.bin  ${r.meshes.length} 個 mesh、${r.tris ?? 0} 三角形`, r);
    if (!quiet) for (const m of r.meshes) console.log(`       ${m.name.padEnd(13)} ${String(m.nv).padStart(6)} v ${String(m.tris).padStart(6)} tri  bbox ${m.bbox.join(' ')}`);
  }
  for (let n = 0; n < 4; n++) {
    const f = resolve(dir, `track_${n}.bin`);
    if (!existsSync(f)) { report(`track_${n}.bin`, { errors: [`找不到 ${f}`], warnings: [] }); continue; }
    const r = checkTrack(readFileSync(f), n, nMeshes);
    report(`track_${n}.bin  ${r.info.name ?? ''}`, r);
    if (!quiet && r.info.grid) {
      const i = r.info;
      console.log(`       ${i.grid} 網格、${i.size}、${i.laps} 圈、path ${i.path}、檢查點 ${i.cps}、跳台 ${i.jump}／水 ${i.water}／泥 ${i.mud}／坡 ${i.ramp} 點`);
      console.log(`       道具點 ${i.pickups}、擺設 ${i.props}、高度 ${i.height}`);
      console.log(`       ${i.surface}`);
    }
    // 貼圖：與高度場同範圍，每公尺 8 px 的 JPEG（SPEC §4）
    const pf = resolve(dir, `track_${n}.jpg`);
    if (!existsSync(pf)) { report(`track_${n}.jpg`, { errors: [`找不到 ${pf}`], warnings: [] }); continue; }
    const jb = readFileSync(pf);
    const sz = jpegSize(jb);
    const pr = { errors: [], warnings: [] };
    if (!sz) pr.errors.push('不是有效的 JPEG');
    else if (r.track) {
      const t = r.track, cw = (t.gw - 1) * t.cell * 8, ch = (t.gh - 1) * t.cell * 8;
      if (Math.abs(sz.w - cw) > 2 || Math.abs(sz.h - ch) > 2) pr.errors.push(`尺寸 ${sz.w}×${sz.h}，應為 ${cw}×${ch}（每公尺 8 px）`);
      if (jb.length > 120 * 1024) pr.warnings.push(`${(jb.length / 1024).toFixed(1)} KB，超過 120 KB`);
    }
    report(`track_${n}.jpg  ${sz ? `${sz.w}×${sz.h}，${(jb.length / 1024).toFixed(1)} KB` : ''}`, pr);
  }
  console.log(`\n${fails ? `${fails} 個錯誤` : '全部通過'}${warns ? `，${warns} 個注意事項` : ''}`);
  process.exit(fails ? 1 : 0);
}
