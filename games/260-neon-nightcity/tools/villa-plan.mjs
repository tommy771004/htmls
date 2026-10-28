// 山坡別墅的平面圖：讀 blender/villa_plans.json，推出每層的牆（房間交界、外牆）與開口，檢查動線（每個房間都從大門走得到、門都落在牆上、
// 房間不重疊），寫出 blender/out/villa_walls.json（hill_homes.py 建模與遊戲碰撞用），並畫出平面圖 PNG（.cache/villa/plan_hmN.png，借 197 的 sharp）。
// 執行：node tools/villa-plan.mjs [hm1 …]（不給就全部）
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sharp = createRequire(resolve(root, '../197-openworld/package.json'))('sharp');
const SPEC = JSON.parse(readFileSync(resolve(root, 'blender/villa_plans.json'), 'utf8'));
const G = 10;   // 格點：每公尺 10 格（座標都是 0.1 m 的倍數）
const q = v => Math.round(v * G);
const only = process.argv.slice(2);
const out = {}, problems = [];
const FURN = JSON.parse(readFileSync(resolve(root, '../../assets/260/props/props.json'), 'utf8')).villa_furn?.items || {};

// 樓梯的踏階：起跑端 r = 0、往 dir 跑，寬度方向 w 從 x0（或 y0）量。每階高 ≤ 19 cm；最上面一階和上層樓板齊平（樓板在整個樓梯範圍開孔）。
// I：n 階平均排滿全長。U：第一跑在 first 那半邊（a 低、b 高）跑到遠端的平台（深 LAND），第二跑在另一半邊跑回起跑端，在 r = 0 那一格抵達上層。
// 回傳踏階 [x0, x1, y0, y1, 面高]、平台、每一跑的側邊線（給欄杆）、起跑與抵達的點（各往外 0.3 m）
const RISE = .19, LAND = 1.1;
function stairGeo(s, z0, z1) {
  const [, x0, x1, y0, y1, ty, dir, first = 'a'] = s;
  const ax = dir[1], sg = dir[0] === '-' ? -1 : 1;
  const Lr = ax === 'x' ? x1 - x0 : y1 - y0, Wd = ax === 'x' ? y1 - y0 : x1 - x0, Hh = z1 - z0;
  const P = (r, w) => ax === 'x' ? [sg > 0 ? x0 + r : x1 - r, y0 + w] : [x0 + w, sg > 0 ? y0 + r : y1 - r];
  const Rc = (r0, r1, w0, w1) => { const p = P(r0, w0), q2 = P(r1, w1); return [Math.min(p[0], q2[0]), Math.max(p[0], q2[0]), Math.min(p[1], q2[1]), Math.max(p[1], q2[1])]; };
  const rd = v => Math.round(v * 1e4) / 1e4, R4 = a => a.map(rd);
  const treads = [], flights = [];
  if (ty === 'I') {
    const n = Math.ceil(Hh / RISE - 1e-6), d = Lr / n;
    for (let k = 0; k < n; k++) treads.push([...R4(Rc(k * d, (k + 1) * d, 0, Wd)), rd(z0 + (k + 1) * Hh / n)]);
    flights.push({ w: [0, Wd], r: [0, Lr], z: [z0, z1], run: d });
    return { ty, dir, Lr, W: Wd, treads, flights, landing: null, entry: R4(P(-.3, Wd / 2)), arrive: R4(P(Lr + .3, Wd / 2)), hole: [x0, x1, y0, y1] };
  }
  const m = Math.ceil(Hh / 2 / RISE - 1e-6), Lf = Lr - LAND, zm = z0 + Hh / 2, d1 = Lf / (m - 1), d2 = Lf / m;
  const h1 = first === 'a' ? [0, Wd / 2] : [Wd / 2, Wd], h2 = first === 'a' ? [Wd / 2, Wd] : [0, Wd / 2];
  for (let k = 0; k < m - 1; k++) treads.push([...R4(Rc(k * d1, (k + 1) * d1, ...h1)), rd(z0 + (k + 1) * Hh / 2 / m)]);
  const landing = [...R4(Rc(Lf, Lr, 0, Wd)), rd(zm)];
  for (let k = 0; k < m; k++) treads.push([...R4(Rc(Lf - (k + 1) * d2, Lf - k * d2, ...h2)), rd(zm + (k + 1) * Hh / 2 / m)]);
  flights.push({ w: h1, r: [0, Lf], z: [z0, zm], run: d1 }, { w: h2, r: [Lf, 0], z: [zm, z1], run: d2 });
  return { ty, dir, Lr, W: Wd, treads, flights, landing, entry: R4(P(-.3, (h1[0] + h1[1]) / 2)), arrive: R4(P(-.3, (h2[0] + h2[1]) / 2)), hole: [x0, x1, y0, y1] };
}

function derive(id, V) {
  const res = { levels: [] };
  V.levels.forEach((lv, L) => {
    const R = V.rooms.filter(r => r[0] === L);
    if (!R.length) return;
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (const r of R) { x0 = Math.min(x0, q(r[4])); x1 = Math.max(x1, q(r[5])); y0 = Math.min(y0, q(r[6])); y1 = Math.max(y1, q(r[7])); }
    x0 -= 1; y0 -= 1; x1 += 1; y1 += 1;
    const W = x1 - x0, H = y1 - y0, cell = new Int16Array(W * H).fill(-1), ids = [...new Set(R.map(r => r[1]))];
    for (const r of R) {
      const k = ids.indexOf(r[1]);
      for (let j = q(r[6]); j < q(r[7]); j++) for (let i = q(r[4]); i < q(r[5]); i++) {
        const c = (j - y0) * W + (i - x0);
        if (cell[c] >= 0 && cell[c] !== k) { problems.push(`${id} ${L} 層：${r[1]} 和 ${ids[cell[c]]} 重疊（${(i / G).toFixed(1)}, ${(j / G).toFixed(1)}）`); }
        cell[c] = k;
      }
    }
    const grp = k => { const r = R.find(r => r[1] === ids[k]); return r[8] || ids[k]; };
    const at = (i, j) => (i < x0 || j < y0 || i >= x1 || j >= y1) ? -1 : cell[(j - y0) * W + (i - x0)];
    // 牆的單位邊：x 向的邊（y = j 這條線上 i..i+1）與 y 向的邊
    const segs = [];
    const edge = (a, b) => a === b ? null : (a < 0 || b < 0) ? 'ext' : grp(a) === grp(b) ? null : 'int';
    for (let j = y0; j <= y1; j++) {   // 沿 x 的牆（水平線 y = j）
      let run = null;
      for (let i = x0; i <= x1; i++) {
        const t = i < x1 ? edge(at(i, j - 1), at(i, j)) : null;
        if (run && (t !== run.t || i === x1)) { segs.push({ a: [run.s / G, j / G], b: [i / G, j / G], t: run.t, ax: 'x' }); run = null; }
        if (t && !run) run = { s: i, t };
      }
    }
    for (let i = x0; i <= x1; i++) {   // 沿 y 的牆（垂直線 x = i）
      let run = null;
      for (let j = y0; j <= y1; j++) {
        const t = j < y1 ? edge(at(i - 1, j), at(i, j)) : null;
        if (run && (t !== run.t || j === y1)) { segs.push({ a: [i / G, run.s / G], b: [i / G, j / G], t: run.t, ax: 'y' }); run = null; }
        if (t && !run) run = { s: j, t };
      }
    }
    // 外牆上的玻璃段：把外牆切開
    const glass = (V.glass || []).filter(g => g[0] === L);
    const cut = [];
    for (const s of segs) {
      if (s.t !== 'ext') { cut.push(s); continue; }
      const k = s.ax === 'x' ? 0 : 1, c = s.ax === 'x' ? s.a[1] : s.a[0];
      let parts = [[s.a[k], s.b[k], 'ext']];
      for (const g of glass) {
        const gax = g[2] === g[4] ? 'x' : 'y', gc = gax === 'x' ? g[2] : g[1];
        if (gax !== s.ax || Math.abs(gc - c) > 1e-6) continue;
        const g0 = Math.min(g[1 + k], g[3 + k]), g1 = Math.max(g[1 + k], g[3 + k]);
        const np = [];
        for (const [p0, p1, t] of parts) {
          if (t !== 'ext' || g1 <= p0 || g0 >= p1) { np.push([p0, p1, t]); continue; }
          if (g0 > p0) np.push([p0, g0, t]);
          np.push([Math.max(p0, g0), Math.min(p1, g1), g[5]]);
          if (g1 < p1) np.push([g1, p1, t]);
        }
        parts = np;
      }
      for (const [p0, p1, t] of parts) cut.push({ a: k ? [c, p0] : [p0, c], b: k ? [c, p1] : [p1, c], t, ax: s.ax });
    }
    // 開口：門要落在某段牆上
    const doors = (V.doors || []).filter(d => d[0] === L).map(d => {
      const [, x, y, w, kind] = d;
      const s = cut.find(s => s.ax === 'x' ? Math.abs(s.a[1] - y) < 1e-6 && x - w / 2 >= s.a[0] - 1e-6 && x + w / 2 <= s.b[0] + 1e-6
        : Math.abs(s.a[0] - x) < 1e-6 && y - w / 2 >= s.a[1] - 1e-6 && y + w / 2 <= s.b[1] + 1e-6);
      if (!s) problems.push(`${id} ${L} 層：門 (${x}, ${y}) 寬 ${w} 沒有落在一段牆上`);
      else (s.open = s.open || []).push([(s.ax === 'x' ? x : y) - w / 2, (s.ax === 'x' ? x : y) + w / 2, kind]);
      const rs = s ? (s.ax === 'x' ? [at(q(x), q(y) - 1), at(q(x), q(y))] : [at(q(x) - 1, q(y)), at(q(x), q(y))]) : [-1, -1];
      return { x, y, w, kind, ax: s ? s.ax : null, rooms: rs.map(k => k < 0 ? null : ids[k]) };
    });
    const windows = (V.windows || []).filter(w => w[0] === L).map(([, x, y, w, sill, h]) => {
      const s = cut.find(s => s.t === 'ext' && (s.ax === 'x' ? Math.abs(s.a[1] - y) < 1e-6 && x - w / 2 >= s.a[0] - 1e-6 && x + w / 2 <= s.b[0] + 1e-6
        : Math.abs(s.a[0] - x) < 1e-6 && y - w / 2 >= s.a[1] - 1e-6 && y + w / 2 <= s.b[1] + 1e-6));
      if (!s) problems.push(`${id} ${L} 層：窗 (${x}, ${y}) 沒有落在外牆上`);
      return { x, y, w, sill, h, ax: s ? s.ax : null };
    });
    // 房間面積與鄰接（同群組相連、門相連）
    const area = {}, adj = new Map(ids.map(k => [k, new Set()]));
    for (const r of R) area[r[1]] = (area[r[1]] || 0) + (r[5] - r[4]) * (r[7] - r[6]);
    for (let a = 0; a < ids.length; a++) for (let b = a + 1; b < ids.length; b++) {
      if (grp(a) !== grp(b)) continue;
      // 同群組而且真的相鄰才算
      let touch = false;
      for (let c = 0; c < cell.length && !touch; c++) {
        if (cell[c] !== a) continue;
        const i = c % W, j = (c / W) | 0;
        touch = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([di, dj]) => i + di >= 0 && i + di < W && j + dj >= 0 && j + dj < H && cell[(j + dj) * W + i + di] === b);
      }
      if (touch) { adj.get(ids[a]).add(ids[b]); adj.get(ids[b]).add(ids[a]); }
    }
    for (const d of doors) if (d.rooms[0] && d.rooms[1]) { adj.get(d.rooms[0]).add(d.rooms[1]); adj.get(d.rooms[1]).add(d.rooms[0]); }
    res.levels.push({ L, z: lv.z, h: lv.h, rooms: R.map(r => ({ id: r[1], name: r[2], kind: r[3], r: r.slice(4, 8), g: r[8] || r[1] })), walls: cut, doors, windows, area, adj: Object.fromEntries([...adj].map(([k, s]) => [k, [...s]])) });
  });
  // 動線：從大門所在的房間出發，經過門、開放相連與樓梯，每個房間都要走得到
  const key = (L, k) => L + ':' + k, G2 = new Map();
  for (const lv of res.levels) for (const [k, s] of Object.entries(lv.adj)) G2.set(key(lv.L, k), new Set(s.map(t => key(lv.L, t))));
  // 樓梯：起跑前那一點要落在和樓梯同一群組（開放相連）的房間，抵達的那一點要落在上層和樓梯井同一群組的房間
  res.stairs = [];
  for (const s of V.stairs || []) {
    const [L0, sx0, sx1, sy0, sy1] = s;
    const lo = res.levels.find(l => l.L === L0), hi = res.levels.find(l => l.L === L0 + 1);
    const inP = (l, x, y) => l.rooms.find(r => r.r[0] < x && r.r[1] > x && r.r[2] < y && r.r[3] > y);
    const a = lo && inP(lo, (sx0 + sx1) / 2, (sy0 + sy1) / 2), b = hi && inP(hi, (sx0 + sx1) / 2, (sy0 + sy1) / 2);
    if (!a || !b) { problems.push(`${id}：樓梯 ${L0}→${L0 + 1} 上下找不到房間`); continue; }
    const g = stairGeo(s, lo.z, hi.z), e = inP(lo, ...g.entry), t = inP(hi, ...g.arrive);
    if (!e || e.g !== a.g) problems.push(`${id}：樓梯 ${L0}→${L0 + 1} 起跑前（${g.entry}）是 ${e ? e.name : '牆外'}，不和樓梯相通`);
    if (!t || t.g !== b.g) problems.push(`${id}：樓梯 ${L0}→${L0 + 1} 抵達（${g.arrive}）是 ${t ? t.name : '牆外'}，不和樓梯井相通`);
    if (g.flights.some(f => Math.abs(f.run) < .245)) problems.push(`${id}：樓梯 ${L0}→${L0 + 1} 踏階太淺（${g.flights.map(f => f.run.toFixed(2)).join('／')} m）`);
    res.stairs.push({ L: L0, ...g });
    G2.get(key(L0, a.id)).add(key(L0 + 1, b.id)); G2.get(key(L0 + 1, b.id)).add(key(L0, a.id));
    if (e && t) { G2.get(key(L0, e.id)).add(key(L0 + 1, t.id)); G2.get(key(L0 + 1, t.id)).add(key(L0, e.id)); }
  }
  // 家具（furniture：[層, 件, x, y, 正面朝向 ±x／±y, 寬的縮放, 深的縮放]，尺寸照 assets/260/props/props.json 的 villa_furn）：
  // 佔地要整塊在房間裡（不在樓梯、梯井上）、不壓到牆（外牆 24 cm、內牆 12 cm、玻璃 10 cm）、門洞前後 0.7 m 留空、件與件不重疊（茶几可以在 L 型沙發裡）
  res.furn = [];
  for (const f of V.furniture || []) {
    const [L, fid, x, y, face, sx = 1, sy = 1] = f, it = FURN[fid], lv = res.levels.find(l => l.L === L);
    if (!it || !lv) { problems.push(`${id}：沒有 ${fid} 這件家具或第 ${L} 層`); continue; }
    const w = it.w * sx, d = it.d * sy, [hx, hy] = face[1] === 'y' ? [w / 2, d / 2] : [d / 2, w / 2];
    const r = [x - hx, x + hx, y - hy, y + hy], tag = `${id} ${fid} ${L} 層 (${x}, ${y})`;
    res.furn.push({ L, id: fid, x, y, face, sx, sy, r, z: lv.z });
    const pts = [[r[0] + .01, r[2] + .01], [r[1] - .01, r[2] + .01], [r[0] + .01, r[3] - .01], [r[1] - .01, r[3] - .01], [x, y]];
    const rm = pts.map(([px, py]) => lv.rooms.find(q => q.r[0] <= px && q.r[1] >= px && q.r[2] <= py && q.r[3] >= py));
    if (rm.some(q => !q)) problems.push(`${tag}：超出房間`);
    else if (rm.some(q => q.kind === 'stair' || q.kind === 'void')) problems.push(`${tag}：壓到樓梯`);
    const hit = (a, b2) => a[0] < b2[1] && a[1] > b2[0] && a[2] < b2[3] && a[3] > b2[2];
    for (const s of lv.walls) {
      const t = s.t === 'ext' ? .12 : s.t === 'int' ? .06 : .05, c = s.ax === 'x' ? s.a[1] : s.a[0], k = s.ax === 'x' ? 0 : 1;
      const lo = Math.min(s.a[k], s.b[k]), hi = Math.max(s.a[k], s.b[k]);
      const band = s.ax === 'x' ? [lo, hi, c - t, c + t] : [c - t, c + t, lo, hi];
      if (hit(r, band)) problems.push(`${tag}：壓到牆（${s.ax === 'x' ? 'y' : 'x'} = ${c}）`);
    }
    for (const dd of lv.doors) {
      if (dd.kind === 'garage') continue;
      const zone = dd.ax === 'x' ? [dd.x - dd.w / 2, dd.x + dd.w / 2, dd.y - .7, dd.y + .7] : [dd.x - .7, dd.x + .7, dd.y - dd.w / 2, dd.y + dd.w / 2];
      if (hit(r, zone)) problems.push(`${tag}：擋到 (${dd.x}, ${dd.y}) 的${dd.kind === 'door' ? '門' : dd.kind}`);
    }
    for (const o of res.furn.slice(0, -1)) if (o.L === L && hit(r, o.r) && !(fid === 'coffee' && o.id === 'sofa_l') && !(fid === 'sofa_l' && o.id === 'coffee')) problems.push(`${tag}：和 ${o.id} 重疊`);
  }
  const fd = res.levels[0].doors.find(d => d.kind === 'front');
  const start = fd && (fd.rooms[0] || fd.rooms[1]);
  if (!start) problems.push(`${id}：找不到大門`);
  else {
    const seen = new Set([key(0, start)]), st = [key(0, start)];
    while (st.length) for (const n of G2.get(st.pop()) || []) if (!seen.has(n)) { seen.add(n); st.push(n); }
    const miss = [...G2.keys()].filter(k => !seen.has(k));
    if (miss.length) problems.push(`${id}：從大門走不到 ${miss.join('、')}`);
    res.reach = { start, n: seen.size, of: G2.size };
  }
  res.graph = Object.fromEntries([...G2].map(([k, s]) => [k, [...s]]));
  return res;
}

// ─── 畫圖：每層一張並排，房間依種類上色、標名稱與坪數，牆粗細分內外、玻璃藍色、門畫開啟弧、樓梯畫踏階與箭頭、戶外區淡色 ───
const KC = { living: '#f3e3c6', dining: '#f0dcc0', kitchen: '#eed6b4', foyer: '#e8e0d0', hall: '#e6e2da', stair: '#d8d2c6', void: '#ffffff', bed: '#d9e4ee', bath: '#cfe6e4',
  powder: '#cfe6e4', closet: '#e2dbe8', garage: '#d6d6d6', utility: '#dcdcd2', laundry: '#dcdcd2', pantry: '#e4dccc', study: '#e0e8d6', media: '#d8d4e6', den: '#ece0cc' };
const OC = { deck: '#c9a982', pool: '#7fc8d6', terrace: '#e3dccb', balcony: '#ebe6dc', walk: '#e3dccb', drive: '#cfcfcf', spa: '#7fc8d6', court: '#e8dfcc', fountain: '#9fd0d8', loggia: '#e2d6bf' };
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

function draw(id, V, D) {
  const S = 34, pad = 50, gap = 70;
  // 每層畫的範圍：房間＋同層戶外
  const box = D.levels.map(lv => {
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    const grow = ([a, b, c, d]) => { x0 = Math.min(x0, a); x1 = Math.max(x1, b); y0 = Math.min(y0, c); y1 = Math.max(y1, d); };
    lv.rooms.forEach(r => grow(r.r)); (V.outdoor || []).filter(o => o[0] === lv.L).forEach(o => grow(o.slice(2, 6)));
    return [x0 - .6, x1 + .6, y0 - .6, y1 + .6];
  });
  const wd = box.map(b => (b[1] - b[0]) * S), hd = Math.max(...box.map(b => (b[3] - b[2]) * S));
  const Wt = pad * 2 + wd.reduce((a, b) => a + b, 0) + gap * (box.length - 1), Ht = hd + pad * 2 + 60;
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.ceil(Wt)}" height="${Math.ceil(Ht)}" font-family="PingFang TC, Heiti TC, sans-serif"><rect width="100%" height="100%" fill="#fbfaf7"/>`;
  svg += `<text x="${pad}" y="34" font-size="22" fill="#222">${esc(id)} ${esc(V.name)}　平面圖（上方 = 正面 = 朝路）　格線 1 m</text>`;
  let ox = pad;
  D.levels.forEach((lv, n) => {
    const b = box[n], X = x => ox + (x - b[0]) * S, Y = y => pad + 40 + (b[3] - y) * S;   // y 往上（正面在上）
    svg += `<text x="${ox}" y="${pad + 30}" font-size="17" fill="#444">${lv.L === 0 ? '一樓' : lv.L === 1 ? '二樓' : '三樓'}　樓板 +${lv.z} m　淨高 ${lv.h} m</text>`;
    for (let x = Math.ceil(b[0]); x <= b[1]; x++) svg += `<line x1="${X(x)}" y1="${Y(b[2])}" x2="${X(x)}" y2="${Y(b[3])}" stroke="#eee" stroke-width="1"/>`;
    for (let y = Math.ceil(b[2]); y <= b[3]; y++) svg += `<line x1="${X(b[0])}" y1="${Y(y)}" x2="${X(b[1])}" y2="${Y(y)}" stroke="#eee" stroke-width="1"/>`;
    for (const o of (V.outdoor || []).filter(o => o[0] === lv.L)) svg += `<rect x="${X(o[2])}" y="${Y(o[5])}" width="${(o[3] - o[2]) * S}" height="${(o[5] - o[4]) * S}" fill="${OC[o[1]] || '#e6e6e6'}" stroke="#bbb" stroke-dasharray="4 3"/><text x="${X((o[2] + o[3]) / 2)}" y="${Y((o[4] + o[5]) / 2) + 5}" font-size="12" fill="#666" text-anchor="middle">${esc({ deck: '木平台', pool: '泳池', terrace: '露台', balcony: '陽台', walk: '步道', drive: '車道', spa: '按摩池', court: '前庭', fountain: '噴水池', loggia: '柱廊' }[o[1]] || o[1])}</text>`;
    for (const r of lv.rooms) svg += `<rect x="${X(r.r[0])}" y="${Y(r.r[3])}" width="${(r.r[1] - r.r[0]) * S}" height="${(r.r[3] - r.r[2]) * S}" fill="${KC[r.kind] || '#eee'}"/>`;
    // 樓梯：villa_walls.json 算好的踏階（顏色越深越高）、平台，起跑 → 抵達的箭頭（下層紅、上層灰）
    for (const s of (D.stairs || []).filter(s => s.L === lv.L || s.L === lv.L - 1)) {
      const up = s.L === lv.L, z0 = s.treads[0][4], z1 = s.treads[s.treads.length - 1][4];
      for (const t of [...s.treads, ...(s.landing ? [s.landing] : [])]) {
        const g = Math.round(235 - 120 * (t[4] - z0) / (z1 - z0 || 1));
        svg += `<rect x="${X(t[0])}" y="${Y(t[3])}" width="${(t[1] - t[0]) * S}" height="${(t[3] - t[2]) * S}" fill="rgb(${g},${g - 4},${g - 12})" stroke="${up ? '#777' : '#bbb'}" stroke-width="1"/>`;
      }
      const pts = [s.entry, ...s.flights.flatMap(f => { const c = (f.w[0] + f.w[1]) / 2, P = r => s.dir[1] === 'x' ? [s.dir[0] === '-' ? s.hole[1] - r : s.hole[0] + r, s.hole[2] + c] : [s.hole[0] + c, s.dir[0] === '-' ? s.hole[3] - r : s.hole[2] + r]; return [P(f.r[0]), P(f.r[1])]; }), s.arrive];
      svg += `<polyline points="${pts.map(p => X(p[0]) + ',' + Y(p[1])).join(' ')}" fill="none" stroke="${up ? '#c0392b' : '#bbb'}" stroke-width="2" marker-end="url(#ar)"/>`;
      svg += `<text x="${X((s.hole[0] + s.hole[1]) / 2)}" y="${Y((s.hole[2] + s.hole[3]) / 2) - 4}" font-size="11" fill="#c0392b" text-anchor="middle">${up ? '上' : '下'}</text>`;
    }
    // 牆、玻璃、開口
    for (const s of lv.walls) {
      const k = s.ax === 'x' ? 0 : 1, c = s.ax === 'x' ? s.a[1] : s.a[0];
      let parts = [[s.a[k], s.b[k]]];
      for (const [o0, o1] of s.open || []) parts = parts.flatMap(([p0, p1]) => o1 <= p0 || o0 >= p1 ? [[p0, p1]] : [[p0, o0], [o1, p1]].filter(([u, v]) => v - u > 1e-6));
      const st = s.t === 'glass' ? ['#3a8fc7', 5] : s.t === 'frost' ? ['#9fc3d9', 5] : s.t === 'ext' ? ['#222', 9] : ['#444', 5];
      for (const [p0, p1] of parts) {
        const a = k ? [c, p0] : [p0, c], bb = k ? [c, p1] : [p1, c];
        svg += `<line x1="${X(a[0])}" y1="${Y(a[1])}" x2="${X(bb[0])}" y2="${Y(bb[1])}" stroke="${st[0]}" stroke-width="${st[1]}" stroke-linecap="square"/>`;
      }
    }
    for (const d of lv.doors) {
      if (!d.ax) continue;
      const col = { front: '#c0392b', garage: '#555', slide: '#3a8fc7', french: '#3a8fc7', arch: '#8a6d3b', door: '#8a6d3b' }[d.kind] || '#8a6d3b';
      if (d.kind === 'door' || d.kind === 'front') {   // 開門弧（往房間 rooms[1] 那側開）
        const r = d.w * S, hx = d.ax === 'x' ? X(d.x - d.w / 2) : X(d.x), hy = d.ax === 'x' ? Y(d.y) : Y(d.y - d.w / 2);
        const tx = d.ax === 'x' ? hx : hx + r, ty = d.ax === 'x' ? hy - r : hy, ex = d.ax === 'x' ? hx + r : hx, ey = d.ax === 'x' ? hy : hy - r;
        svg += `<line x1="${hx}" y1="${hy}" x2="${tx}" y2="${ty}" stroke="${col}" stroke-width="2"/><path d="M${tx},${ty} A${r},${r} 0 0 1 ${ex},${ey}" fill="none" stroke="${col}" stroke-width="1" stroke-dasharray="3 2"/>`;
      } else {
        const a = d.ax === 'x' ? [X(d.x - d.w / 2), Y(d.y), X(d.x + d.w / 2), Y(d.y)] : [X(d.x), Y(d.y - d.w / 2), X(d.x), Y(d.y + d.w / 2)];
        svg += `<line x1="${a[0]}" y1="${a[1]}" x2="${a[2]}" y2="${a[3]}" stroke="${col}" stroke-width="3" stroke-dasharray="6 3"/>`;
      }
    }
    for (const w of lv.windows) {
      if (!w.ax) continue;
      const a = w.ax === 'x' ? [X(w.x - w.w / 2), Y(w.y), X(w.x + w.w / 2), Y(w.y)] : [X(w.x), Y(w.y - w.w / 2), X(w.x), Y(w.y + w.w / 2)];
      svg += `<line x1="${a[0]}" y1="${a[1]}" x2="${a[2]}" y2="${a[3]}" stroke="#3a8fc7" stroke-width="5"/>`;
    }
    // 家具：佔地框＋名稱，正面那一邊畫粗線
    for (const f of (D.furn || []).filter(f => f.L === lv.L)) {
      const [x0, x1, y0, y1] = f.r;
      svg += `<rect x="${X(x0)}" y="${Y(y1)}" width="${(x1 - x0) * S}" height="${(y1 - y0) * S}" fill="rgba(120,80,40,.18)" stroke="#7a5030" stroke-width="1.2"/>`;
      const e = { '-y': [x0, y0, x1, y0], '+y': [x0, y1, x1, y1], '-x': [x0, y0, x0, y1], '+x': [x1, y0, x1, y1] }[f.face];
      svg += `<line x1="${X(e[0])}" y1="${Y(e[1])}" x2="${X(e[2])}" y2="${Y(e[3])}" stroke="#7a5030" stroke-width="3"/><text x="${X(f.x)}" y="${Y(f.y) + 4}" font-size="10" fill="#7a5030" text-anchor="middle">${esc(f.id)}</text>`;
    }
    // 房間名稱與面積（同 id 標在最大那塊）
    const big = {};
    for (const r of lv.rooms) { const ar = (r.r[1] - r.r[0]) * (r.r[3] - r.r[2]); if (!big[r.id] || ar > big[r.id].ar) big[r.id] = { r, ar }; }
    for (const { r } of Object.values(big)) {
      if (r.kind === 'void' || r.kind === 'stair') continue;
      const cx = X((r.r[0] + r.r[1]) / 2), cy = Y((r.r[2] + r.r[3]) / 2), a = lv.area[r.id];
      svg += `<text x="${cx}" y="${cy}" font-size="14" fill="#222" text-anchor="middle">${esc(r.name)}</text><text x="${cx}" y="${cy + 16}" font-size="11" fill="#666" text-anchor="middle">${a.toFixed(1)} m²（${(a / 3.3058).toFixed(1)} 坪）</text>`;
    }
    ox += wd[n] + gap;
  });
  svg += `<defs><marker id="ar" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 z" fill="#c0392b"/></marker></defs>`;
  const lg = [['#222', '外牆'], ['#444', '內牆'], ['#3a8fc7', '落地玻璃／窗'], ['#9fc3d9', '霧玻璃'], ['#c0392b', '大門'], ['#8a6d3b', '室內門'], ['#3a8fc7', '拉門（虛線）']];
  lg.forEach(([c, t], i) => { svg += `<line x1="${pad + i * 150}" y1="${Ht - 22}" x2="${pad + i * 150 + 30}" y2="${Ht - 22}" stroke="${c}" stroke-width="5"/><text x="${pad + i * 150 + 38}" y="${Ht - 17}" font-size="13" fill="#333">${t}</text>`; });
  return svg + '</svg>';
}

mkdirSync(resolve(root, '.cache/villa'), { recursive: true });
mkdirSync(resolve(root, 'blender/out'), { recursive: true });
for (const [id, V] of Object.entries(SPEC.villas)) {
  if (only.length && !only.includes(id)) continue;
  const D = derive(id, V);
  out[id] = D;
  const f = resolve(root, `.cache/villa/plan_${id}.png`);
  await sharp(Buffer.from(draw(id, V, D))).png().toFile(f);
  const area = D.levels.reduce((a, lv) => a + Object.values(lv.area).reduce((x, y) => x + y, 0), 0);
  console.log(`${id} ${V.name}：${D.levels.length} 層、${D.levels.reduce((a, l) => a + l.rooms.length, 0)} 塊、室內 ${area.toFixed(0)} m²、牆 ${D.levels.reduce((a, l) => a + l.walls.length, 0)} 段、動線 ${D.reach ? D.reach.n + '/' + D.reach.of : '—'} → ${f}`);
}
if (!only.length) writeFileSync(resolve(root, 'blender/out/villa_walls.json'), JSON.stringify(out));
if (problems.length) { console.log('問題：\n  ' + problems.join('\n  ')); process.exitCode = 1; } else console.log('平面檢查通過');
