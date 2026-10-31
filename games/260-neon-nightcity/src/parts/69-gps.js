// ═══ 第三階段：GPS 導航（大地圖點一下設導航點，紫線；任務目標黃線） ═══
// 路線沿路網圖（06-roads.js 的 RN）走：起點與終點先投影到最近的路中線，終點那段路的兩端路口各跑一次 rnField（結果快取），
// 起點從所在路段的兩端路口挑總距離最短的，再沿距離遞減的路段走過去（連接道路的折線點也畫出來）。每 0.4 秒（真實時間）重算一次。
// routeTo 只走城裡的 RN（車流、運鈔車、救護車、街頭賽、步行繞路用）；玩家的導航線（gps.route／mroute）走 gpsRoute：RN 加上城外的路的 XG（見下面）。
// 排在 69-crew 之後、69-police 之前。

const gps = { wp: null, route: null, mroute: null, t: 0 };
const GPS_WP = '#c88cff', GPS_MK = '#ffcc4d';
const rnFieldC = new Map();
const rnFieldOf = id => { let D = rnFieldC.get(id); if (!D) rnFieldC.set(id, D = rnField(id)); return D; };
// 離 (x, z) 最近的路中線上的點：{ x, z, e, u }；從那一點沿路走到路段某一端的路程
function roadPoint(x, z) { const p = rnProject(x, z); return p ? { x: p.x, z: p.z, e: p.e, u: p.u } : { x, z, e: null, u: 0 }; }
const toEnd = (p, n) => n === p.e.a ? p.u : p.e.len - p.u;
// 沿路段 e 從節點 n 走到另一端的折線點（不含 n 本身）
const edgeWalk = (e, n) => (n === e.a ? e.pts.slice(1) : e.pts.slice(0, -1).reverse());
function routeTo(px, pz, tx, tz) {
  const s = roadPoint(px, pz), g = roadPoint(tx, tz);
  if (!s.e || !g.e || s.e === g.e || Math.hypot(s.x - g.x, s.z - g.z) < 6) return [[px, pz], [s.x, s.z], [g.x, g.z], [tx, tz]];
  let best = null;
  for (const gn of [g.e.a, g.e.b]) {
    const D = rnFieldOf(gn.id), tail = toEnd(g, gn);
    for (const sn of [s.e.a, s.e.b]) {
      const c = toEnd(s, sn) + D[sn.id] + tail;
      if (!best || c < best.c) best = { c, sn, gn, D };
    }
  }
  const pts = [[px, pz], [s.x, s.z]];
  let n = best.sn;
  pts.push([n.x, n.z]);
  for (let k = 0; k < 400 && n !== best.gn; k++) {
    let bo = null, bd = best.D[n.id];
    for (const { e } of n.out) { if (e.oneway && e.b === n) continue; const m = e.a === n ? e.b : e.a, v = best.D[m.id] + e.len; if (v < bd + .01 && (!bo || v < bo.v)) bo = { e, m, v }; }
    if (!bo) break;
    for (const q of edgeWalk(bo.e, n)) pts.push([q[0], q[1]]);
    n = bo.m;
  }
  pts.push([g.x, g.z], [tx, tz]);
  return pts;
}
// ─── 導航用的完整路網（XG）：RN 再加上城外的路——外緣山路與榛嶺（10-city.js 的 HILL.paths）、機場堤道（AIR.road）、
// 紐柏林的進場路、GP、北環、維修道與 OSM 村道（09-nbr.js、09-nbr-dem.js）。只給玩家的導航（gps.route／mroute）與大地圖用；
// 車流、警察、運鈔車、街頭賽照舊走 RN（routeTo），不會開上山路或賽道。
// 城外的路各是一條長折線，只在交會處切開成邊（節點少，Dijkstra 用二元堆積）：OSM 村道共用的點（0.5 m 量化的座標）就是路口；
// 端點落在別條路上（≤ tol）就把那條路切開接上；山路的路口（p[0]）與城裡最近的路、堤道與紐柏林進場路之間隔著一段空地，用直線接起來。
// 村道與賽道、進場路平面交叉的地方也切開（橋與隧道段 09-nbr-dem.js 已經拿掉，沒鋪也不算）。和城裡的路網連不起來的碎段照樣畫、不拿來導航。
const XG = (() => {
  const t0 = performance.now(), nodes = [], edges = [], lines = [];
  const node = (x, z) => { const n = { id: nodes.length, x, z, out: [] }; nodes.push(n); return n; };
  for (const n of RN.nodes) node(n.x, n.z);
  const cumOf = pts => { const c = [0]; for (let k = 1; k < pts.length; k++) c.push(c[k - 1] + Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1])); return c; };
  // 一條線：pts（世界 [x, z]）、cuts（{ u, n }，u 是弧長）、端點的接法 tol（[頭, 尾]，0 不接）、只接城裡的路 rnOnly
  const line = (pts, o = {}) => { const L = { pts, cum: cumOf(pts), cuts: [], tol: [0, 0], src: 'x', ...o }; L.len = L.cum.at(-1); lines.push(L); return L; };
  for (const e of RN.edges) { const L = line(e.pts, { src: 'rn', oneway: !!e.oneway }); L.cuts.push({ u: 0, n: nodes[e.a.id] }, { u: L.len, n: nodes[e.b.id] }); }
  const nRN = lines.length, W = (x, z) => toW(x, z, SEA_FR);
  for (const P of HILL.paths || []) if (P.length > 1) line(P.map(p => [p[0], p[1]]), { src: P.akina ? 'akina' : 'hill', tol: [P.link && !P.mouth ? 12 : 140, 12], rnOnly: [!P.link || !!P.mouth, false] });
  const air = AIR ? line(AIR.road.map(([x, z]) => W(x, z)), { src: 'air', tol: [40, 0] }) : null;
  const osmK = [];
  if (NBR) {
    const nr = line(NBR.road.p.map(([x, z]) => W(x, z)), { src: 'nbr', tol: [0, 30] });
    if (air) { const a = node(...air.pts.at(-1)); air.cuts.push({ u: air.len, n: a }); const b = node(...nr.pts[0]); nr.cuts.push({ u: 0, n: b }); air.joinEnd = [a, b]; }   // 堤道的盡頭（航廈前）到進場路的起點：一段機坪
    for (const T of [NBR.gp, NBR.ns]) line([...T.p.map(([x, z]) => W(x, z)), W(T.p[0][0], T.p[0][1])], { src: 'track', closed: 1 });
    line(NBR.pit.p.map(([x, z]) => W(x, z)), { src: 'track', tol: [30, 30] });
    if (NBR_OSM && NBR_OSM.road) {
      const B = NBR_OSM.road, cnt = nbB64(B.n, Uint16Array), xz = nbB64(B.xz, Int16Array), kind = nbB64(B.k, Uint8Array);
      for (let i = 0, o = 0; i < cnt.length; i++) {
        const n = cnt[i], keys = [], P = []; for (let j = 0; j < n; j++) { const a = xz[(o + j) * 2], b = xz[(o + j) * 2 + 1]; keys.push(a * 65536 + b); P.push(W(NBR_OX - a / 2, NBR_OZ - b / 2)); } o += n;
        if (kind[i] & 12 || n < 2) continue;   // 橋、隧道
        osmK.push([line(P, { src: 'osm', k: kind[i] & 3, tol: [15, 15] }), keys]);
      }
    }
  }
  // 線段的空間索引（64 m 一格）：找端點落在哪條路上、平面交叉、點選地圖時投影
  const S = 64, cells = new Map(), ck = (c, d) => c * 100003 + d;
  const segIdx = (L, li) => { for (let k = 1; k < L.pts.length; k++) { const [ax, az] = L.pts[k - 1], [bx, bz] = L.pts[k]; for (let c = Math.floor(Math.min(ax, bx) / S); c <= Math.floor(Math.max(ax, bx) / S); c++) for (let d = Math.floor(Math.min(az, bz) / S); d <= Math.floor(Math.max(az, bz) / S); d++) { const key = ck(c, d); let a = cells.get(key); if (!a) cells.set(key, a = []); a.push(li, k); } } };
  lines.forEach(segIdx);
  const nearOn = (x, z, r, ok) => {   // 半徑 r 內最近的線上一點 { L, u, x, z, d }
    let best = null;
    for (let c = Math.floor((x - r) / S); c <= Math.floor((x + r) / S); c++) for (let d = Math.floor((z - r) / S); d <= Math.floor((z + r) / S); d++) {
      const a = cells.get(ck(c, d)); if (!a) continue;
      for (let q = 0; q < a.length; q += 2) {
        const L = lines[a[q]], k = a[q + 1]; if (!ok(L, k)) continue;
        const [ax, az] = L.pts[k - 1], [bx, bz] = L.pts[k], dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1, t = clamp(((x - ax) * dx + (z - az) * dz) / l2, 0, 1), px = ax + dx * t, pz = az + dz * t, dd = Math.hypot(x - px, z - pz);
        if (dd <= r && (!best || dd < best.d)) best = { L, u: L.cum[k - 1] + Math.sqrt(l2) * t, x: px, z: pz, d: dd };
      }
    }
    return best;
  };
  // OSM 村道共用的點：端點一律是節點；兩條以上的路經過的中間點也切開
  const keyN = new Map(), seen = new Map();
  for (const [L, keys] of osmK) keys.forEach((k, j) => seen.set(k, (seen.get(k) || 0) + 1));
  for (const [L, keys] of osmK) keys.forEach((k, j) => {
    if (j && j < keys.length - 1 && seen.get(k) < 2) return;
    let n = keyN.get(k); if (!n) keyN.set(k, n = node(...L.pts[j]));
    L.cuts.push({ u: L.cum[j], n });
    if (!j || j === keys.length - 1) L[j ? 'endN' : 'begN'] = n;
  });
  // 村道與賽道、進場路的平面交叉
  for (const [L] of osmK) for (let k = 1; k < L.pts.length; k++) {
    const p = L.pts[k - 1], q = L.pts[k], c = Math.floor((p[0] + q[0]) / 2 / S), d = Math.floor((p[1] + q[1]) / 2 / S);
    for (let cc = c - 1; cc <= c + 1; cc++) for (let dd = d - 1; dd <= d + 1; dd++) {
      const a = cells.get(ck(cc, dd)); if (!a) continue;
      for (let i = 0; i < a.length; i += 2) {
        const M = lines[a[i]]; if (M.src !== 'track' && M.src !== 'nbr') continue;
        const r = M.pts[a[i + 1] - 1], s = M.pts[a[i + 1]], d1x = q[0] - p[0], d1z = q[1] - p[1], d2x = s[0] - r[0], d2z = s[1] - r[1], den = d1x * d2z - d1z * d2x;
        if (Math.abs(den) < 1e-9) continue;
        const t = ((r[0] - p[0]) * d2z - (r[1] - p[1]) * d2x) / den, u = ((r[0] - p[0]) * d1z - (r[1] - p[1]) * d1x) / den;
        if (t < 0 || t >= 1 || u < 0 || u >= 1) continue;
        const uL = L.cum[k - 1] + t * (L.cum[k] - L.cum[k - 1]), uM = M.cum[a[i + 1] - 1] + u * (M.cum[a[i + 1]] - M.cum[a[i + 1] - 1]);
        if (M.cuts.some(o => Math.abs(o.u - uM) < 1) || L.cuts.some(o => Math.abs(o.u - uL) < 1)) continue;
        const n = node(p[0] + d1x * t, p[1] + d1z * t); L.cuts.push({ u: uL, n }); M.cuts.push({ u: uM, n });
      }
    }
  }
  // 端點：落在別條路上就把那條切開，用一段直線接過去（距離 0 時就是同一點）
  const conn = [];
  lines.forEach((L, li) => {   // 每條城外的路兩端都是節點（死巷也要畫進路線）
    if (li < nRN || L.closed) return;
    for (const end of [0, 1]) { const u = end ? L.len : 0; if (!L.cuts.some(o => Math.abs(o.u - u) < .01)) L.cuts.push({ u, n: node(...L.pts[end ? L.pts.length - 1 : 0]) }); }
  });
  osmK.forEach(([L, keys]) => { L.shared = [seen.get(keys[0]) > 1, seen.get(keys.at(-1)) > 1]; });
  lines.forEach((L, li) => {
    if (li < nRN || L.closed) return;
    for (const end of [0, 1]) {
      const tol = L.tol[end]; if (!tol || L.shared && L.shared[end]) continue;   // 不接，或已經是村道的路口
      const u = end ? L.len : 0, [x, z] = L.pts[end ? L.pts.length - 1 : 0], n = L.cuts.find(o => Math.abs(o.u - u) < .01).n;
      const rn = L.rnOnly && L.rnOnly[end];
      const hit = nearOn(x, z, tol, M => M !== L && (!rn || M.src === 'rn'));
      if (!hit) continue;
      let m = hit.L.cuts.find(o => Math.abs(o.u - hit.u) < 2);
      if (!m) { m = { u: hit.u, n: node(hit.x, hit.z) }; hit.L.cuts.push(m); }
      if (m.n !== n) conn.push([n, m.n]);
    }
  });
  if (air && air.joinEnd) conn.push(air.joinEnd);
  // 切成邊：照 u 排序，相鄰兩刀之間的折線（閉合的賽道從最後一刀繞回第一刀）
  const sub = (L, u0, u1) => {
    const out = [], at = u => { let k = 1; while (k < L.pts.length - 1 && L.cum[k] < u) k++; const a = L.pts[k - 1], b = L.pts[k], l = L.cum[k] - L.cum[k - 1] || 1, t = clamp((u - L.cum[k - 1]) / l, 0, 1); return [k, [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]]; };
    const [k0, p0] = at(u0), [k1, p1] = at(u1); out.push(p0); for (let k = k0; k < k1; k++) out.push(L.pts[k]); out.push(p1); return out;
  };
  const addE = (a, b, pts, o = {}) => { const cum = cumOf(pts), e = { id: edges.length, a, b, pts, cum, len: cum.at(-1), ...o }; edges.push(e); a.out.push(e); b.out.push(e); return e; };
  for (const L of lines) {
    if (L.closed && L.cuts.length < 2) for (const f of [0, .5]) if (!L.cuts.some(o => Math.abs(o.u - f * L.len) < 2)) L.cuts.push({ u: f * L.len, n: node(...sub(L, f * L.len, f * L.len)[0]) });
    const C = L.cuts.sort((p, q) => p.u - q.u);
    for (let i = 0; i + 1 < C.length; i++) if (C[i + 1].u - C[i].u > .01 || C[i].n !== C[i + 1].n) addE(C[i].n, C[i + 1].n, L.src === 'rn' && C.length === 2 ? L.pts : sub(L, C[i].u, C[i + 1].u), { src: L.src, oneway: L.oneway, k: L.k });
    if (L.closed && C.length) { const a = C[C.length - 1], b = C[0]; addE(a.n, b.n, [...sub(L, a.u, L.len), ...sub(L, 0, b.u).slice(1)], { src: L.src }); }
  }
  for (const [a, b] of conn) addE(a, b, [[a.x, a.z], [b.x, b.z]], { src: 'link' });
  // 和城裡路網連通的部分
  const main = new Uint8Array(nodes.length), st = [0]; main[0] = 1;
  while (st.length) { const n = nodes[st.pop()]; for (const e of n.out) { const m = e.a === n ? e.b : e.a; if (!main[m.id]) { main[m.id] = 1; st.push(m.id); } } }
  for (const e of edges) e.main = !!main[e.a.id];
  // 邊的空間索引（只放連通的邊）
  const eS = 48, eCells = new Map();
  for (const e of edges) if (e.main) {
    const set = new Set();
    for (let k = 1; k < e.pts.length; k++) { const [ax, az] = e.pts[k - 1], [bx, bz] = e.pts[k]; for (let c = Math.floor(Math.min(ax, bx) / eS); c <= Math.floor(Math.max(ax, bx) / eS); c++) for (let d = Math.floor(Math.min(az, bz) / eS); d <= Math.floor(Math.max(az, bz) / eS); d++) set.add(ck(c, d)); }
    for (const key of set) { let a = eCells.get(key); if (!a) eCells.set(key, a = []); a.push(e); }
  }
  const stat = { nodes: nodes.length, edges: edges.length, main: main.reduce((a, v) => a + v, 0), out: edges.filter(e => e.src !== 'rn').length, outMain: edges.filter(e => e.src !== 'rn' && e.main).length, links: conn.length, ms: Math.round(performance.now() - t0) };
  return { nodes, edges, eCells, eS, ck, stat, main };
})();
// 離 (x, z) 最近的（連通的）路中線上一點：{ e, u, x, z, d }；r 內沒有就往外擴
function xgProject(x, z, r = 64, rMax = 16384) {
  const { eCells, eS, ck } = XG;
  let best = null;
  for (let R = r; !best && R <= rMax; R *= 2) {
    const seen = new Set();
    for (let c = Math.floor((x - R) / eS); c <= Math.floor((x + R) / eS); c++) for (let d = Math.floor((z - R) / eS); d <= Math.floor((z + R) / eS); d++) {
      for (const e of eCells.get(ck(c, d)) || []) {
        if (seen.has(e)) continue; seen.add(e);
        for (let k = 1; k < e.pts.length; k++) {
          const [ax, az] = e.pts[k - 1], [bx, bz] = e.pts[k], dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1;
          const t = clamp(((x - ax) * dx + (z - az) * dz) / L2, 0, 1), px = ax + dx * t, pz = az + dz * t, dd = Math.hypot(x - px, z - pz);
          if (!best || dd < best.d) best = { e, u: e.cum[k - 1] + Math.sqrt(L2) * t, x: px, z: pz, d: dd };
        }
      }
    }
    if (R * 2 > rMax && !best) break;
  }
  return best;
}
// 到節點 goal 的最短路程（二元堆積的 Dijkstra；單向的匝道只算順向）；最近用過的 8 個目標快取
const xgFieldC = new Map();
function xgField(goal) {
  let D = xgFieldC.get(goal); if (D) return D;
  const N = XG.nodes, n = N.length; D = new Float64Array(n).fill(1e9); D[goal] = 0;   // 64 位元：堆積裡的值和 D 要比得相等，Float32 捨入後會被當成過期的項目跳過
  const hk = [goal], hv = [0];
  const push = (k, v) => { let i = hk.length; hk.push(k); hv.push(v); while (i) { const p = (i - 1) >> 1; if (hv[p] <= v) break; hk[i] = hk[p]; hv[i] = hv[p]; i = p; } hk[i] = k; hv[i] = v; };
  const pop = () => { const k = hk[0], lk = hk.pop(), lv = hv.pop(); if (hk.length) { let i = 0; for (;;) { let c = 2 * i + 1; if (c >= hk.length) break; if (c + 1 < hk.length && hv[c + 1] < hv[c]) c++; if (hv[c] >= lv) break; hk[i] = hk[c]; hv[i] = hv[c]; i = c; } hk[i] = lk; hv[i] = lv; } return k; };
  while (hk.length) {
    const v0 = hv[0], b = pop(); if (v0 > D[b]) continue;
    for (const e of N[b].out) { const m = e.a.id === b ? e.b.id : e.a.id; if (e.oneway && e.b.id === m) continue; const v = D[b] + e.len; if (v < D[m]) { D[m] = v; push(m, v); } }
  }
  xgFieldC.set(goal, D); if (xgFieldC.size > 8) xgFieldC.delete(xgFieldC.keys().next().value);
  return D;
}
// 邊 e 上 u0 → u1 那一段的折線（u1 < u0 時反過來）
function xgSub(e, u0, u1) {
  const rev = u1 < u0; if (rev) [u0, u1] = [u1, u0];
  const at = u => { let k = 1; while (k < e.pts.length - 1 && e.cum[k] < u) k++; const a = e.pts[k - 1], b = e.pts[k], l = e.cum[k] - e.cum[k - 1] || 1, t = clamp((u - e.cum[k - 1]) / l, 0, 1); return [k, [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]]; };
  const [k0, p0] = at(u0), [k1, p1] = at(u1), out = [p0]; for (let k = k0; k < k1; k++) out.push(e.pts[k]); out.push(p1);
  return rev ? out.reverse() : out;
}
// 玩家的導航路線（世界座標的折線）：起點、終點先投影到最近的路，沿 XG 走；同一條邊上照那一段折線（長的山路、整圈賽道是一條邊）
function gpsRoute(px, pz, tx, tz) {
  const s = xgProject(px, pz), g = xgProject(tx, tz);
  if (!s || !g) return [[px, pz], [tx, tz]];
  const end = (e, n, u) => n === e.a ? u : e.len - u;
  let best = null;
  for (const gn of [g.e.a, g.e.b]) {
    if (g.e.oneway && gn === g.e.b) continue;
    const D = xgField(gn.id), tail = end(g.e, gn, g.u);
    for (const sn of [s.e.a, s.e.b]) { if (s.e.oneway && sn === s.e.a) continue; const c = end(s.e, sn, s.u) + D[sn.id] + tail; if (!best || c < best.c) best = { c, sn, gn, D }; }
  }
  if (s.e === g.e && (!s.e.oneway || g.u >= s.u) && (!best || Math.abs(g.u - s.u) <= best.c)) return [[px, pz], ...xgSub(s.e, s.u, g.u), [tx, tz]];
  if (!best || best.c >= 1e9) return [[px, pz], [s.x, s.z], [g.x, g.z], [tx, tz]];
  const pts = [[px, pz], ...xgSub(s.e, s.u, best.sn === s.e.a ? 0 : s.e.len)];
  let n = best.sn;
  for (let k = 0; k < 4000 && n !== best.gn; k++) {
    let bo = null, bd = best.D[n.id];
    for (const e of n.out) { if (e.oneway && e.b === n) continue; const m = e.a === n ? e.b : e.a, v = best.D[m.id] + e.len; if (v < bd + .01 && (!bo || v < bo.v)) bo = { e, m, v }; }
    if (!bo) break;
    for (const q of edgeWalk(bo.e, n)) pts.push([q[0], q[1]]);
    n = bo.m;
  }
  pts.push(...xgSub(g.e, best.gn === g.e.a ? 0 : g.e.len, g.u), [tx, tz]);
  return pts;
}
function gpsSet(x, z) { gps.wp = { x, z }; gps.t = 0; sfx.click(); }
function gpsClear() { gps.wp = null; gps.route = null; }
function gpsUpdate() {
  gps.t -= slowmo.raw;
  if (gps.t > 0) return;
  gps.t = .4;
  const out = player.where === 'out', v = player.mode === 'drive' ? player.veh : player, px = v.x, pz = v.z;
  if (gps.wp && out && Math.hypot(gps.wp.x - px, gps.wp.z - pz) < 12) { gpsClear(); toast('抵達導航點'); }
  gps.route = gps.wp && out ? gpsRoute(px, pz, gps.wp.x, gps.wp.z) : null;
  const mk = missionMark();   // 69-heist.js：搶劫進行中換成搶劫目標
  gps.mroute = mk && mk.where === 'out' && out && Math.hypot(mk.x - px, mk.z - pz) > 25 ? gpsRoute(px, pz, mk.x, mk.z) : null;
}
function strokeRoute(ctx, pts, P2, col, w) {
  ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.beginPath();
  pts.forEach(([x, z], k) => { const [a, b] = P2(x, z); if (k) ctx.lineTo(a, b); else ctx.moveTo(a, b); });
  ctx.stroke();
}
// 小地圖（90-hud.js 的 drawMini 在畫好底圖之後呼叫）
function gpsMini(ctx, P2, zoom) {
  if (gps.mroute) strokeRoute(ctx, gps.mroute, P2, GPS_MK, 7 / zoom);
  if (gps.route) strokeRoute(ctx, gps.route, P2, GPS_WP, 7 / zoom);
  if (gps.wp) { const [x, y] = P2(gps.wp.x, gps.wp.z); ctx.fillStyle = GPS_WP; ctx.beginPath(); ctx.arc(x, y, 9 / zoom, 0, 7); ctx.fill(); }
}
// 大地圖：路線與導航點；點地圖設定，點在導航點上取消
function gpsBig(c, X, Z, s, M = (x, z) => [x, z]) {   // M：世界 → 大地圖上的位置（91-map.js 的 mapIn，紐柏林是縮小的插圖）
  const P2 = (x, z) => { const [a, b] = M(x, z); return [X(a), Z(b)]; };
  if (gps.mroute) strokeRoute(c, gps.mroute, P2, GPS_MK, 5 / s);
  if (gps.route) strokeRoute(c, gps.route, P2, GPS_WP, 5 / s);
  if (gps.wp) {
    const [x, y] = P2(gps.wp.x, gps.wp.z);
    c.fillStyle = GPS_WP; c.beginPath(); c.moveTo(x, y); c.arc(x, y - 16 / s, 8 / s, Math.PI * .8, Math.PI * .2); c.closePath(); c.fill();
    c.fillStyle = '#1a1220'; c.beginPath(); c.arc(x, y - 16 / s, 3 / s, 0, 7); c.fill();
  }
}
// 測試 API（window.__nc.gta.gps）
const gpsApi = { gps, set: gpsSet, clear: gpsClear, route: routeTo, xroute: gpsRoute, xg: () => XG.stat, xproject: (x, z) => { const p = xgProject(x, z); return p && { x: p.x, z: p.z, d: p.d, src: p.e.src }; } };
