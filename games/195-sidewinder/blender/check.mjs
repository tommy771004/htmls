// 驗證 blender/out 的匯出檔：node blender/check.mjs [outDir]
// SWMS / SWTK 格式、數量、大小；賽道封閉、可達、牆完整；地面貼圖 JPEG 尺寸、檢查用 PNG 的顏色方向；glb 標頭。
import { readFileSync, statSync, existsSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = process.argv[2] || join(HERE, 'out');
const MESH_NAMES = ['truck_body', 'wheel', 'tire_stack', 'hay_bale', 'barrel', 'grandstand',
  'floodlight', 'flag_pole', 'cactus', 'start_arch', 'fence', 'pickup_nitro', 'pickup_money'];
const K = { DIRT: 0, LOOSE: 1, MUD: 2, WATER: 3, JUMP: 4, RAMP: 5, WALL: 6, INFIELD: 7 };

let fails = 0;
let checks = 0;
function ok(cond, msg) {
  checks++;
  if (!cond) { fails++; console.error('✗ ' + msg); }
}
const near = (a, b, e) => Math.abs(a - b) <= e;

class Reader {
  constructor(buf) { this.b = buf; this.dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength); this.o = 0; }
  u8() { return this.dv.getUint8(this.o++); }
  i8() { return this.dv.getInt8(this.o++); }
  u16() { const v = this.dv.getUint16(this.o, true); this.o += 2; return v; }
  i16() { const v = this.dv.getInt16(this.o, true); this.o += 2; return v; }
  u32() { const v = this.dv.getUint32(this.o, true); this.o += 4; return v; }
  f32() { const v = this.dv.getFloat32(this.o, true); this.o += 4; return v; }
  str(n) { const s = this.b.subarray(this.o, this.o + n); this.o += n; return s; }
  pad4() { while (this.o % 4) { ok(this.u8() === 0, '補齊位元組應為 0'); } }
}

// ---------- SWMS ----------
function checkMeshes() {
  const path = join(OUT, 'meshes.bin');
  const buf = readFileSync(path);
  ok(buf.length < 600 * 1024, `meshes.bin ${buf.length} bytes 應 < 600 KB`);
  const r = new Reader(buf);
  ok(r.str(4).toString('latin1') === 'SWMS', 'SWMS magic');
  ok(r.u16() === 1, 'SWMS version 1');
  const n = r.u16();
  ok(n === MESH_NAMES.length, `mesh 數 ${n} 應為 ${MESH_NAMES.length}`);
  const meshes = [];
  for (let m = 0; m < n; m++) {
    const nameRaw = r.str(16);
    const name = nameRaw.subarray(0, nameRaw.indexOf(0) < 0 ? 16 : nameRaw.indexOf(0)).toString('utf8');
    const nv = r.u32(), ni = r.u32();
    const bb = Array.from({ length: 6 }, () => r.f32());
    ok(name === MESH_NAMES[m], `mesh ${m} 名稱 ${name} 應為 ${MESH_NAMES[m]}`);
    ok(nv > 0 && nv < 65536, `${name} nverts ${nv}`);
    ok(ni % 3 === 0 && ni > 0, `${name} nindices ${ni} 應為 3 的倍數`);
    const pos = new Float32Array(nv * 3);
    for (let k = 0; k < nv * 3; k++) pos[k] = r.f32();
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    for (let k = 0; k < nv; k++) for (let a = 0; a < 3; a++) { lo[a] = Math.min(lo[a], pos[k * 3 + a]); hi[a] = Math.max(hi[a], pos[k * 3 + a]); }
    for (let a = 0; a < 3; a++) {
      ok(near(bb[a], lo[a], 1e-4) && near(bb[a + 3], hi[a], 1e-4), `${name} bbox 軸 ${a} 與頂點不符`);
    }
    let badN = 0;
    for (let k = 0; k < nv; k++) {
      const x = r.i8(), y = r.i8(), z = r.i8(), w = r.i8();
      const l = Math.hypot(x, y, z);
      if (w !== 0 || l < 120 || l > 131) badN++;
    }
    ok(badN === 0, `${name} 有 ${badN} 個法線長度不對或第 4 位非 0`);
    const alphas = new Set();
    for (let k = 0; k < nv; k++) { r.u8(); r.u8(); r.u8(); alphas.add(r.u8()); }
    ok([...alphas].every((a) => a === 0 || a === 128 || a === 255), `${name} alpha 只能是 0/128/255：${[...alphas]}`);
    const idx = new Uint16Array(ni);
    let badI = 0;
    for (let k = 0; k < ni; k++) { idx[k] = r.u16(); if (idx[k] >= nv) badI++; }
    ok(badI === 0, `${name} 有 ${badI} 個索引超出範圍`);
    r.pad4();
    meshes.push({ name, nv, ni, tris: ni / 3, lo, hi, pos, alphas });
  }
  ok(r.o === buf.length, `meshes.bin 讀完位移 ${r.o} 應等於檔案大小 ${buf.length}`);
  const [body, wheel] = meshes;
  if (body) {
    ok(body.tris >= 600 && body.tris <= 1500, `truck_body 三角形 ${body.tris} 應在 600–1500`);
    const L = body.hi[0] - body.lo[0], W = body.hi[2] - body.lo[2];
    ok(L > 2.4 && L < 3.0, `truck_body 長 ${L.toFixed(2)} m`);
    ok(W > 1.6 && W < 2.1, `truck_body 寬 ${W.toFixed(2)} m`);
    ok(body.lo[1] > -0.42, `truck_body 最低點 ${body.lo[1].toFixed(2)} 應在地面（-0.42）以上`);
    ok(body.alphas.has(0) && body.alphas.has(128) && body.alphas.has(255), 'truck_body 應同時有塗裝、發光與一般顏色');
    // 輪拱淨空：輪子所在範圍內（|z| 0.6–0.96）不能有車身頂點落在輪心 0.44 m 內
    let clash = 0;
    for (let k = 0; k < body.nv; k++) {
      const x = body.pos[k * 3], y = body.pos[k * 3 + 1], z = body.pos[k * 3 + 2];
      if (Math.abs(z) < 0.6 || Math.abs(z) > 0.96) continue;
      for (const ax of [0.85, -0.85]) if (Math.hypot(x - ax, y) < 0.44) clash++;
    }
    ok(clash === 0, `truck_body 有 ${clash} 個頂點侵入輪子`);
  }
  if (wheel) {
    ok(wheel.tris >= 200 && wheel.tris <= 400, `wheel 三角形 ${wheel.tris} 應在 200–400`);
    const rx = Math.max(-wheel.lo[0], wheel.hi[0]), ry = Math.max(-wheel.lo[1], wheel.hi[1]);
    ok(near(rx, 0.42, 0.01) && near(ry, 0.42, 0.01), `wheel 半徑 ${rx.toFixed(3)} / ${ry.toFixed(3)} 應為 0.42`);
    const wz = wheel.hi[2] - wheel.lo[2];
    ok(wz > 0.28 && wz < 0.45, `wheel 寬（沿 Z）${wz.toFixed(2)} m`);
  }
  const total = meshes.reduce((a, m) => a + m.tris, 0);
  console.log(`meshes.bin ${(buf.length / 1024).toFixed(1)} KB，${n} 個 mesh，共 ${total} 三角形：` +
    meshes.map((m) => `${m.name} ${m.tris}`).join('、'));
  return meshes;
}

// ---------- PNG ----------
function readPng(path) {
  const buf = readFileSync(path);
  ok(buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), `${path} PNG 簽章`);
  let o = 8, w = 0, h = 0, depth = 0, ctype = 0;
  const idat = [];
  while (o < buf.length) {
    const len = buf.readUInt32BE(o), type = buf.toString('latin1', o + 4, o + 8);
    const data = buf.subarray(o + 8, o + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); depth = data[8]; ctype = data[9]; ok(data[12] === 0, 'PNG 不可 interlace'); }
    if (type === 'IDAT') idat.push(data);
    o += 12 + len;
  }
  ok(depth === 8 && ctype === 2, `${path} 應為 8-bit RGB（depth ${depth} type ${ctype}）`);
  const raw = inflateSync(Buffer.concat(idat));
  const bpp = 3, stride = w * bpp;
  ok(raw.length === h * (stride + 1), `${path} 解壓長度`);
  const px = new Uint8Array(w * h * 3);
  for (let y = 0; y < h; y++) {
    const ft = raw[y * (stride + 1)];
    for (let x = 0; x < stride; x++) {
      const v = raw[y * (stride + 1) + 1 + x];
      const a = x >= bpp ? px[y * stride + x - bpp] : 0;
      const b = y > 0 ? px[(y - 1) * stride + x] : 0;
      const c = x >= bpp && y > 0 ? px[(y - 1) * stride + x - bpp] : 0;
      let p;
      if (ft === 0) p = v;
      else if (ft === 1) p = v + a;
      else if (ft === 2) p = v + b;
      else if (ft === 3) p = v + ((a + b) >> 1);
      else { const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c); p = v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c); }
      px[y * stride + x] = p & 255;
    }
  }
  return { w, h, px, bytes: buf.length };
}

// ---------- SWTK ----------
function checkTrack(N, meshes) {
  const path = join(OUT, `track_${N}.bin`);
  const buf = readFileSync(path);
  const r = new Reader(buf);
  ok(r.str(4).toString('latin1') === 'SWTK', `track_${N} magic`);
  ok(r.u16() === 1, `track_${N} version`);
  const id = r.u16(), gw = r.u16(), gh = r.u16();
  const cell = r.f32(), ox = r.f32(), oz = r.f32();
  const nPath = r.u16(), nPick = r.u16(), nProps = r.u16(), laps = r.u16();
  const cam = Array.from({ length: 8 }, () => r.f32());
  const nameRaw = r.str(32);
  const z0 = nameRaw.indexOf(0);
  const name = nameRaw.subarray(0, z0).toString('utf8');
  ok(id === N, `track_${N} id ${id}`);
  ok(z0 > 0 && z0 <= 31 && nameRaw.subarray(z0).every((b) => b === 0), `track_${N} 名稱須 0 結尾並補 0`);
  ok(Buffer.from(name, 'utf8').equals(nameRaw.subarray(0, z0)), `track_${N} 名稱為合法 UTF-8`);
  ok(cell === 0.5 && gw > 10 && gh > 10, `track_${N} 網格 ${gw}×${gh} cell ${cell}`);
  ok(near((gw - 1) * cell, 72, 0.01) && near((gh - 1) * cell, 48, 0.01), `track_${N} 場地應為 72×48 m`);
  ok(laps === 4, `track_${N} laps ${laps}`);
  ok(cam.every(Number.isFinite) && cam[5] > 0 && cam[6] > 0, `track_${N} 鏡頭提示`);
  ok(nPick >= 8, `track_${N} 道具點 ${nPick} 應 ≥ 8`);
  const H = new Int16Array(gw * gh);
  for (let k = 0; k < gw * gh; k++) H[k] = r.i16();
  const Kd = new Uint8Array(gw * gh);
  for (let k = 0; k < gw * gh; k++) Kd[k] = r.u8();
  r.pad4();
  ok(Kd.every((v) => v <= 7), `track_${N} 地面種類只能 0..7`);
  const path_ = [];
  for (let k = 0; k < nPath; k++) path_.push({ x: r.f32(), z: r.f32(), hw: r.f32(), fl: r.u32() });
  const start = [];
  for (let k = 0; k < 4; k++) { start.push({ x: r.f32(), z: r.f32(), yaw: r.f32() }); ok(r.f32() === 0, '發車格第 4 格為 0'); }
  const picks = [];
  for (let k = 0; k < nPick; k++) picks.push({ x: r.f32(), z: r.f32() });
  const props = [];
  for (let k = 0; k < nProps; k++) {
    const mid = r.u16(); ok(r.u16() === 0, 'prop 保留欄為 0');
    props.push({ mid, x: r.f32(), y: r.f32(), z: r.f32(), yaw: r.f32(), sc: r.f32() });
  }
  ok(r.o === buf.length, `track_${N} 讀完位移 ${r.o} 應等於檔案大小 ${buf.length}`);

  const idx = (i, j) => j * gw + i;
  const cellOf = (x, z) => [Math.round((x - ox) / cell), Math.round((z - oz) / cell)];
  const inGrid = (i, j) => i >= 0 && j >= 0 && i < gw && j < gh;
  const pass = (i, j) => inGrid(i, j) && Kd[idx(i, j)] !== K.WALL;
  const passAt = (x, z) => pass(...cellOf(x, z));

  // path：封閉、間距、全在可通行格、橫向半寬也在可通行格
  let badGap = 0, badPass = 0, badWidth = 0, badFlag = 0, nCheck = 0;
  for (let k = 0; k < nPath; k++) {
    const a = path_[k], b = path_[(k + 1) % nPath], p = path_[(k - 1 + nPath) % nPath];
    const g = Math.hypot(b.x - a.x, b.z - a.z);
    if (g < 1.0 || g > 2.5) badGap++;
    if (!passAt(a.x, a.z)) badPass++;
    const tx = b.x - p.x, tz = b.z - p.z, tl = Math.hypot(tx, tz);
    const nx = -tz / tl, nz = tx / tl;
    for (const s of [-1, -0.5, 0.5, 1]) if (!passAt(a.x + nx * a.hw * s, a.z + nz * a.hw * s)) badWidth++;
    if (a.fl & ~31) badFlag++;
    if (a.fl & 8) nCheck++;
    if (!(a.hw > 2 && a.hw < 6)) badWidth++;
  }
  ok(badGap === 0, `track_${N} path 有 ${badGap} 段間距不在 1–2.5 m（含最後一點回到起點）`);
  ok(badPass === 0, `track_${N} path 有 ${badPass} 點不在可通行格`);
  ok(badWidth === 0, `track_${N} path 有 ${badWidth} 個橫向半寬取樣落在牆上`);
  ok(badFlag === 0, `track_${N} path flags 只能用 bit0..4`);
  ok(nCheck >= 3, `track_${N} 檢查點 ${nCheck} 個`);
  ok(path_.some((p) => p.fl & 1), `track_${N} 應有跳台`);

  // 發車格
  const d0x = path_[1].x - path_[nPath - 1].x, d0z = path_[1].z - path_[nPath - 1].z;
  const d0l = Math.hypot(d0x, d0z);
  for (const [k, s] of start.entries()) {
    ok(passAt(s.x, s.z), `track_${N} 發車格 ${k} 不在可通行格`);
    const along = ((s.x - path_[0].x) * d0x + (s.z - path_[0].z) * d0z) / d0l;
    ok(along < -1.5, `track_${N} 發車格 ${k} 應在起點線後方（${along.toFixed(2)}）`);
    const dyaw = Math.atan2(Math.sin(s.yaw - Math.atan2(d0z, d0x)), Math.cos(s.yaw - Math.atan2(d0z, d0x)));
    ok(Math.abs(dyaw) < 0.3, `track_${N} 發車格 ${k} 朝向與賽道差 ${dyaw.toFixed(2)} rad`);
    for (let m = k + 1; m < 4; m++) ok(Math.hypot(s.x - start[m].x, s.z - start[m].z) >= 2.5, `track_${N} 發車格 ${k}/${m} 太近`);
  }
  for (const [k, p] of picks.entries()) ok(passAt(p.x, p.z), `track_${N} 道具點 ${k} 不在可通行格`);

  // 淹沒填充（4 連通）：從 0 號發車格出發
  const reach = new Uint8Array(gw * gh);
  const [si, sj] = cellOf(start[0].x, start[0].z);
  const stack = [[si, sj]];
  while (stack.length) {
    const [i, j] = stack.pop();
    if (!pass(i, j) || reach[idx(i, j)]) continue;
    reach[idx(i, j)] = 1;
    stack.push([i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]);
  }
  let border = 0;
  for (let i = 0; i < gw; i++) border += reach[idx(i, 0)] + reach[idx(i, gh - 1)];
  for (let j = 0; j < gh; j++) border += reach[idx(0, j)] + reach[idx(gw - 1, j)];
  ok(border === 0, `track_${N} 可達區碰到外框 ${border} 格（牆沒封閉）`);
  // 更嚴格：邊框上根本不能有可通行格；8 連通也不能漏到外框
  let borderPass = 0;
  for (let i = 0; i < gw; i++) borderPass += pass(i, 0) + pass(i, gh - 1);
  for (let j = 0; j < gh; j++) borderPass += pass(0, j) + pass(gw - 1, j);
  ok(borderPass === 0, `track_${N} 外框上有 ${borderPass} 個可通行格`);
  let missPath = 0;
  for (const p of path_) if (!reach[idx(...cellOf(p.x, p.z))]) missPath++;
  ok(missPath === 0, `track_${N} 有 ${missPath} 個 path 點不在可達區`);
  for (const p of [...start, ...picks]) ok(reach[idx(...cellOf(p.x, p.z))] === 1, `track_${N} 發車格／道具點不可達`);

  // 每個可達格投影到 path 折線：離中心線不能太遠；8 鄰格的投影點不能相距過遠（車道間牆被打穿）
  const nearestProj = (x, z) => {
    let best = Infinity, bx = 0, bz = 0;
    for (let k = 0; k < nPath; k++) {
      const a = path_[k], b = path_[(k + 1) % nPath];
      const dx = b.x - a.x, dz = b.z - a.z, l2 = dx * dx + dz * dz;
      const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / l2));
      const px = a.x + t * dx, pz = a.z + t * dz, d = Math.hypot(x - px, z - pz);
      if (d < best) { best = d; bx = px; bz = pz; }
    }
    return [best, bx, bz];
  };
  const proj = new Float32Array(gw * gh * 2).fill(NaN);
  let far = 0, maxD = 0, nReach = 0;
  const maxHw = Math.max(...path_.map((p) => p.hw));
  for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
    if (!reach[idx(i, j)]) continue;
    nReach++;
    const [d, px, pz] = nearestProj(ox + i * cell, oz + j * cell);
    proj[idx(i, j) * 2] = px; proj[idx(i, j) * 2 + 1] = pz;
    maxD = Math.max(maxD, d);
    if (d > maxHw + 4.0) far++;
  }
  ok(far === 0, `track_${N} 有 ${far} 個可達格離中心線超過 ${(maxHw + 4).toFixed(1)} m`);
  let breach = 0;
  for (let j = 0; j < gh - 1; j++) for (let i = 0; i < gw; i++) {
    if (!reach[idx(i, j)]) continue;
    for (const [di, dj] of [[1, 0], [0, 1], [1, 1], [-1, 1]]) {
      const i2 = i + di, j2 = j + dj;
      if (!inGrid(i2, j2) || !reach[idx(i2, j2)]) continue;
      const g = Math.hypot(proj[idx(i, j) * 2] - proj[idx(i2, j2) * 2], proj[idx(i, j) * 2 + 1] - proj[idx(i2, j2) * 2 + 1]);
      if (g > 6) { breach++; if (process.env.SW_DEBUG) console.log('  breach', (ox + i * cell).toFixed(1), (oz + j * cell).toFixed(1), g.toFixed(1)); }
    }
  }
  ok(breach === 0, `track_${N} 有 ${breach} 處相鄰可達格分屬不同車道（牆被打穿）`);
  // 對角縫：兩個 WALL 對角相接、另外兩格可通行 → 車子可能從縫擠過
  let diag = 0;
  for (let j = 0; j < gh - 1; j++) for (let i = 0; i < gw - 1; i++) {
    const a = pass(i, j), b = pass(i + 1, j), c = pass(i, j + 1), d = pass(i + 1, j + 1);
    if ((a && d && !b && !c) || (b && c && !a && !d)) diag++;
  }
  ok(diag === 0, `track_${N} 有 ${diag} 處牆只以對角相接`);
  // 單格厚的牆：WALL 格的相對兩側都是可通行格
  let thin = 0;
  for (let j = 1; j < gh - 1; j++) for (let i = 1; i < gw - 1; i++) {
    if (Kd[idx(i, j)] !== K.WALL) continue;
    if ((pass(i - 1, j) && pass(i + 1, j)) || (pass(i, j - 1) && pass(i, j + 1))) { thin++; if (process.env.SW_DEBUG) console.log('  thin', (ox + i * cell).toFixed(1), (oz + j * cell).toFixed(1), Kd[idx(i - 1, j)], Kd[idx(i + 1, j)], Kd[idx(i, j - 1)], Kd[idx(i, j + 1)]); }
  }
  ok(thin === 0, `track_${N} 有 ${thin} 個只有一格厚的牆`);

  // 牆與路面交界高度：牆格高度不低於相鄰路面最低點 5 cm、不高於最高點 30 cm
  let steep = 0;
  for (let j = 1; j < gh - 1; j++) for (let i = 1; i < gw - 1; i++) {
    if (Kd[idx(i, j)] !== K.WALL) continue;
    let lo = Infinity, hi = -Infinity;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (pass(i + di, j + dj)) { const v = H[idx(i + di, j + dj)]; lo = Math.min(lo, v); hi = Math.max(hi, v); }
    if (lo === Infinity) continue;
    const v = H[idx(i, j)];
    if (v < lo - 5 || v > hi + 30) { steep++; if (process.env.SW_DEBUG) console.log('  steep', (ox + i * cell).toFixed(1), (oz + j * cell).toFixed(1), v, lo, hi); }
  }
  ok(steep === 0, `track_${N} 有 ${steep} 個貼路面的牆格高度落差過大`);

  // 地面種類統計
  const cnt = new Array(8).fill(0);
  for (let k = 0; k < gw * gh; k++) if (reach[k]) cnt[Kd[k]]++;
  for (const kk of ['DIRT', 'LOOSE', 'JUMP']) ok(cnt[K[kk]] > 0, `track_${N} 應有 ${kk}`);
  ok(cnt[K.MUD] + cnt[K.WATER] > 0, `track_${N} 應有泥地或水坑`);

  // props
  for (const p of props) {
    ok(p.mid >= 2 && p.mid < meshes.length && p.mid !== 11 && p.mid !== 12, `track_${N} prop mesh_id ${p.mid}`);
    ok(p.sc > 0.3 && p.sc < 3 && [p.x, p.y, p.z, p.yaw].every(Number.isFinite), `track_${N} prop 數值`);
    const [i, j] = cellOf(p.x, p.z);
    ok(inGrid(i, j) && (Kd[idx(i, j)] === K.WALL || p.mid === 9), `track_${N} prop ${MESH_NAMES[p.mid]} 應在牆格上（${p.x.toFixed(1)},${p.z.toFixed(1)}）`);
  }
  const arch = props.filter((p) => p.mid === 9);
  ok(arch.length === 1 && Math.hypot(arch[0].x - path_[0].x, arch[0].z - path_[0].z) < 0.5, `track_${N} 起終點拱門在 path[0]`);
  if (arch.length === 1) {
    // 拱門兩柱（模型 ±5.3 m，隨 scale 縮放）要落在牆格上
    const a0 = arch[0], nx = -Math.sin(a0.yaw), nz = Math.cos(a0.yaw);
    for (const sd of [-1, 1]) {
      const px = a0.x + nx * 5.3 * a0.sc * sd, pz = a0.z + nz * 5.3 * a0.sc * sd;
      ok(!passAt(px, pz), `track_${N} 拱門柱（${px.toFixed(1)},${pz.toFixed(1)}）落在可通行格`);
    }
  }
  ok(props.some((p) => p.mid === 5), `track_${N} 應有看台`);

  // 貼圖：track_N.jpg（內嵌，每公尺 8 px）檢查標頭尺寸與大小；顏色方向用同一份資料縮成每公尺 2 px 的
  // track_N_check.png 驗（Node 沒有 JPEG 解碼器）：依地面種類取平均色，水坑偏灰綠、泥地比路面暗、路面偏紅
  const jpg = readFileSync(join(OUT, `track_${N}.jpg`));
  const W = Math.round((gw - 1) * cell * 8), Hh = Math.round((gh - 1) * cell * 8);
  ok(jpg[0] === 0xff && jpg[1] === 0xd8, `track_${N}.jpg JPEG 簽章`);
  let jw = 0, jh = 0;
  for (let o = 2; o + 9 < jpg.length && jpg[o] === 0xff;) {
    const m = jpg[o + 1];
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) { jh = jpg.readUInt16BE(o + 5); jw = jpg.readUInt16BE(o + 7); break; }
    o += 2 + jpg.readUInt16BE(o + 2);
  }
  ok(jw === W && jh === Hh, `track_${N}.jpg 尺寸 ${jw}×${jh} 應為 ${W}×${Hh}`);
  ok(jpg.length < 120 * 1024, `track_${N}.jpg ${jpg.length} bytes 應 < 120 KB`);
  const CPPM = 2;
  const png = readPng(join(OUT, `track_${N}_check.png`));
  ok(png.w === Math.round((gw - 1) * cell * CPPM) && png.h === Math.round((gh - 1) * cell * CPPM), `track_${N}_check.png 尺寸 ${png.w}×${png.h}`);
  png.bytes = jpg.length;
  const sum = Array.from({ length: 8 }, () => [0, 0, 0, 0]);
  for (let y = 0; y < png.h; y++) for (let x = 0; x < png.w; x++) {
    const wx = ox + (x + 0.5) / CPPM, wz = oz + (y + 0.5) / CPPM;
    const [i, j] = cellOf(wx, wz);
    // 只取周圍同種類的格子，避開邊界
    const k = Kd[idx(i, j)];
    let same = true;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!inGrid(i + di, j + dj) || Kd[idx(i + di, j + dj)] !== k) same = false;
    if (!same) continue;
    const o = (y * png.w + x) * 3;
    sum[k][0] += png.px[o]; sum[k][1] += png.px[o + 1]; sum[k][2] += png.px[o + 2]; sum[k][3]++;
  }
  const avg = sum.map(([r, g, b, n]) => (n ? [r / n, g / n, b / n] : null));
  const lum = (c) => 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2];
  ok(avg[K.DIRT] && avg[K.DIRT][0] > avg[K.DIRT][1] * 1.3, `track_${N} 貼圖路面應偏赭紅（方向可能顛倒）`);
  if (avg[K.WATER]) ok(avg[K.WATER][1] >= avg[K.WATER][0] * 0.95, `track_${N} 貼圖水坑應偏灰綠（方向可能顛倒）`);
  if (avg[K.MUD]) ok(lum(avg[K.MUD]) < lum(avg[K.DIRT]) * 0.75, `track_${N} 貼圖泥地應比路面暗`);

  console.log(`track_${N} 「${name}」 ${gw}×${gh}，path ${nPath} 點（${nCheck} 檢查點），道具點 ${nPick}，擺設 ${nProps}，` +
    `可達 ${nReach} 格（最遠離中心線 ${maxD.toFixed(2)} m），jpg ${(png.bytes / 1024).toFixed(1)} KB`);
}

function checkGlb(file) {
  const path = join(OUT, file);
  ok(existsSync(path), `${file} 存在`);
  if (!existsSync(path)) return;
  const buf = readFileSync(path);
  ok(buf.toString('latin1', 0, 4) === 'glTF' && buf.readUInt32LE(4) === 2, `${file} glTF 2 標頭`);
  ok(buf.readUInt32LE(8) === statSync(path).size, `${file} 長度欄位`);
  const jl = buf.readUInt32LE(12);
  const json = JSON.parse(buf.toString('utf8', 20, 20 + jl));
  ok(Array.isArray(json.meshes) && json.meshes.length > 0, `${file} 應有 mesh`);
}

const meshes = checkMeshes();
for (let n = 0; n < 4; n++) checkTrack(n, meshes);
for (const f of ['trucks.glb', 'props.glb', 'track_0.glb', 'track_1.glb', 'track_2.glb', 'track_3.glb']) checkGlb(f);
console.log(fails ? `✗ ${fails} / ${checks} 項失敗` : `✓ 全部 ${checks} 項通過`);
process.exit(fails ? 1 : 0);
