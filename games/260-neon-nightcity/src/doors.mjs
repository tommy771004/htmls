// 實車的車門：從合併過的 body 網格裡切出左右車門（26-glb.js 的 loadGLB 執行期呼叫；tools/door-view.mjs 用同一份檢查）。
// 規格寫在 assets/260/cars.json 的 door（tools/cars.mjs、seats.mjs 重寫 manifest 時會保留）：
//   p：側視的門框多邊形 [[z, y], …]（車身座標：車頭 +z、上 +y、左 +x，公尺），必須是凸多邊形；
//   ps：凹的門框拆成幾塊凸多邊形（不重疊、共用邊），門是它們的聯集（給了 ps 就不看 p）
//   xi：比這個 |x| 更靠車身中線的不算門（座椅、儀表板、中控台）；xis：每塊 ps 各自的 xi（蝴蝶門帶走的那塊車頂比門窗更靠中線）
//   ang：全開的角度（度，預設 62）；hx／hz：鉸鏈的 |x| 與 z（沒給就取門的前緣往後 3 cm、外側往內 4 cm）
//   hy、axis：蝴蝶門（McLaren 的 dihedral，鉸鏈在 A 柱下端與車頂）——鉸鏈點的 y 與轉軸方向 [x, y, z]（左門的，右門 x 鏡像），
//         門繞這條斜軸往上、往外掀；沒給 axis 就是一般的門，繞垂直軸轉
//   shell：z 方向比門長出這麼多的連通塊算「外殼」（車身側板、整片玻璃），沿門框把三角形剪開（預設 0.3 m）；
//          其他塊（門板內飾、把手、後照鏡）照面積多數決整塊歸門或歸車身，切口跟著原檔的零件縫
// 減面（tools/cars.mjs 的 simplify）常把門縫焊平，門皮變成橫跨門縫的大三角形，所以外殼一定要剪，不能只挑三角形。
// doorSplit 回傳 mark（每個三角形：0 車身、1 左門 +x、2 右門 −x、3 被剪開，由 frags 取代）
// 與 frags（剪出來的小三角形：{ s: 0/1/2, t: 原三角形, w: [9 個重心權重] }，頂點屬性 = Σ w·原三角形三個頂點的值）。
export function doorInPoly(p, z, y) {
  let c = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const [zi, yi] = p[i], [zj, yj] = p[j];
    if ((yi > y) !== (yj > y) && z < (zj - zi) * (y - yi) / (yj - yi) + zi) c = !c;
  }
  return c;
}

// 凸多邊形的半平面（側視 z-y），以及 |x| > xi 那一面；值 ≥ 0 是門框裡
const pieces = (spec) => spec.ps || [spec.p];
const xiOf = (spec, k) => (spec.xis && spec.xis[k]) ?? spec.xi ?? .55;
const inDoor = (spec, z, y, ax) => pieces(spec).some((P, k) => ax > xiOf(spec, k) && doorInPoly(P, z, y));
function planes(spec, P, s, k) {
  const n = P.length, xi = xiOf(spec, k);
  let A = 0; for (let i = 0; i < n; i++) { const [z0, y0] = P[i], [z1, y1] = P[(i + 1) % n]; A += z0 * y1 - z1 * y0; }
  const o = A > 0 ? 1 : -1, out = [(v) => (s === 1 ? v[0] : -v[0]) - xi];
  for (let i = 0; i < n; i++) {
    const [z0, y0] = P[i], [z1, y1] = P[(i + 1) % n], ez = z1 - z0, ey = y1 - y0, L = Math.hypot(ez, ey) || 1;
    out.push((v) => o * (ez * (v[1] - y0) - ey * (v[2] - z0)) / L);
  }
  return out;
}
// 把多邊形（頂點 { v: [x, y, z], w: [w0, w1, w2] }）用一個半平面分成裡、外兩塊
function cut(poly, f) {
  const inn = [], out = [], d = poly.map((p) => f(p.v));
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length], da = d[i], db = d[(i + 1) % poly.length];
    (da >= 0 ? inn : out).push(a);
    if ((da >= 0) !== (db >= 0)) {
      const t = da / (da - db), p = { v: a.v.map((x, k) => x + (b.v[k] - x) * t), w: a.w.map((x, k) => x + (b.w[k] - x) * t) };
      inn.push(p); out.push(p);
    }
  }
  return [inn.length >= 3 ? inn : null, out.length >= 3 ? out : null];
}
function fan(poly, s, t, frags) {
  for (let i = 1; i + 1 < poly.length; i++) frags.push({ s, t, w: [...poly[0].w, ...poly[i].w, ...poly[i + 1].w] });
}

export function doorSplit(pos, idx, spec, dbg) {
  const nv = pos.length / 3, nt = idx.length / 3, xi = Math.min(...pieces(spec).map((P, k) => xiOf(spec, k))), shell = spec.shell ?? .3;
  let pz0 = 1e9, pz1 = -1e9, py0 = 1e9, py1 = -1e9; for (const P of pieces(spec)) for (const [z, y] of P) { pz0 = Math.min(pz0, z); pz1 = Math.max(pz1, z); py0 = Math.min(py0, y); py1 = Math.max(py1, y); }
  const PL = { 1: pieces(spec).map((P, k) => planes(spec, P, 1, k)), 2: pieces(spec).map((P, k) => planes(spec, P, 2, k)) };
  // 連通塊（共用頂點的三角形）
  const par = new Int32Array(nv); for (let i = 0; i < nv; i++) par[i] = i;
  const find = (a) => { while (par[a] !== a) { par[a] = par[par[a]]; a = par[a]; } return a; };
  for (let t = 0; t < nt; t++) {
    const a = find(idx[t * 3]), b = find(idx[t * 3 + 1]); if (a !== b) par[a] = b;
    const c = find(idx[t * 3 + 2]), r = find(b); if (c !== r) par[c] = r;
  }
  // 每個三角形的重心在不在門框裡，連通塊依面積加權記門框內的比例
  const tri = new Uint8Array(nt), comp = new Map();
  for (let t = 0; t < nt; t++) {
    const a = idx[t * 3] * 3, b = idx[t * 3 + 1] * 3, c = idx[t * 3 + 2] * 3;
    const x = (pos[a] + pos[b] + pos[c]) / 3, y = (pos[a + 1] + pos[b + 1] + pos[c + 1]) / 3, z = (pos[a + 2] + pos[b + 2] + pos[c + 2]) / 3;
    const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2], vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
    const A = Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) / 2;
    if (inDoor(spec, z, y, Math.abs(x))) tri[t] = x > 0 ? 1 : 2;
    const r = find(idx[t * 3]); let o = comp.get(r);
    if (!o) comp.set(r, o = { n: 0, a: 0, a1: 0, a2: 0, z0: 1e9, z1: -1e9 });
    o.n++; o.a += A; if (tri[t] === 1) o.a1 += A; else if (tri[t] === 2) o.a2 += A;
    for (const v of [a, b, c]) { const w = pos[v + 2]; if (w < o.z0) o.z0 = w; if (w > o.z1) o.z1 = w; }
  }
  const span = pz1 - pz0, mark = new Uint8Array(nt), frags = [];
  for (const o of comp.values()) { o.shell = o.z1 - o.z0 > span + shell; o.s = o.a1 > o.a * .5 ? 1 : o.a2 > o.a * .5 ? 2 : 0; }
  if (dbg) for (const o of comp.values()) if (o.a1 || o.a2) dbg.push({ n: o.n, f: +(Math.max(o.a1, o.a2) / (o.a || 1)).toFixed(2), z: [+o.z0.toFixed(2), +o.z1.toFixed(2)], shell: o.shell });
  for (let t = 0; t < nt; t++) {
    const o = comp.get(find(idx[t * 3]));
    if (!o.shell) { mark[t] = o.s; continue; }
    // 外殼：整個在門框裡的歸門、完全碰不到的歸車身，跨過門框線的剪開
    const V = [0, 1, 2].map((k) => { const i = idx[t * 3 + k] * 3; return [pos[i], pos[i + 1], pos[i + 2]]; });
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, z0 = 1e9, z1 = -1e9;
    for (const v of V) { x0 = Math.min(x0, v[0]); x1 = Math.max(x1, v[0]); y0 = Math.min(y0, v[1]); y1 = Math.max(y1, v[1]); z0 = Math.min(z0, v[2]); z1 = Math.max(z1, v[2]); }
    if (y1 < py0 || y0 > py1 || z1 < pz0 || z0 > pz1 || (x1 <= xi && x0 >= -xi)) continue;
    let rest = [V.map((v, k) => ({ v, w: [k === 0 ? 1 : 0, k === 1 ? 1 : 0, k === 2 ? 1 : 0] }))];
    const got = [];
    for (const s of [1, 2]) {
      if (s === 1 ? x1 <= xi : x0 >= -xi) continue;
      for (const pl of PL[s]) {   // 每塊凸多邊形：剪下裡面的，外面的留給下一塊
        const next = [];
        for (const poly of rest) {
          let inn = poly;
          for (const f of pl) { if (!inn) break; const [a, b] = cut(inn, f); if (b) next.push(b); inn = a; }
          if (inn) got.push([inn, s]);
        }
        rest = next;
      }
    }
    if (!got.length) continue;
    if (!rest.length && got.every((g) => g[1] === got[0][1])) { mark[t] = got[0][1]; continue; }   // 整個在門框裡
    mark[t] = 3;
    for (const [poly, s] of got) fan(poly, s, t, frags);
    for (const poly of rest) fan(poly, 0, t, frags);
  }
  return { mark, frags };
}

// 依 doorSplit 的結果組出三份三角形：每份 { idx: 原頂點的索引, frag: [{ t, w }] }（0 車身、1 左門、2 右門）
export function doorGroups(idx, r) {
  const g = [0, 1, 2].map(() => ({ idx: [], frag: [] }));
  for (let t = 0; t < r.mark.length; t++) { const m = r.mark[t]; if (m < 3) g[m].idx.push(idx[t * 3], idx[t * 3 + 1], idx[t * 3 + 2]); }
  for (const f of r.frags) g[f.s].frag.push(f);
  return g;
}

// 剪出來的小三角形的頂點屬性：每個屬性照重心權重內插原三角形的三個頂點（讀 getX…getW，已反正規化），寫成 Float32
// attrs：{ 名稱: { count, itemSize, get(i, k) } }；回傳 { 名稱: Float32Array }
export function doorFragAttrs(idx, frag, attrs) {
  const out = {};
  for (const [k, a] of Object.entries(attrs)) {
    const n = a.itemSize, arr = new Float32Array(frag.length * 3 * n);
    let o = 0;
    for (const f of frag) for (let v = 0; v < 3; v++) {
      const w0 = f.w[v * 3], w1 = f.w[v * 3 + 1], w2 = f.w[v * 3 + 2], i0 = idx[f.t * 3], i1 = idx[f.t * 3 + 1], i2 = idx[f.t * 3 + 2];
      for (let c = 0; c < n; c++) arr[o++] = w0 * a.get(i0, c) + w1 * a.get(i1, c) + w2 * a.get(i2, c);
    }
    out[k] = arr;
  }
  return out;
}

// 鉸鏈：門的前緣（最大 z）往後 3 cm、外側（最大 |x|）往內 4 cm；規格有給就用規格。pts：門的頂點座標（車身座標）
export function doorHinge(pts, s, spec) {
  let z1 = -1e9, x1 = 0;
  for (const [x, , z] of pts) { if (z > z1) z1 = z; if (Math.abs(x) > x1) x1 = Math.abs(x); }
  return { x: (s === 1 ? 1 : -1) * (spec.hx ?? x1 - .04), y: spec.axis ? spec.hy ?? 0 : 0, z: spec.hz ?? z1 - .03 };
}
// 門開到 e（0..1）時鉸鏈 Group 的旋轉：一般的門繞 y 轉（左門往外是負角）；蝴蝶門繞 axis 轉，正負取讓門的後緣往外的那一邊
export function doorTurn(spec, s) {
  if (!spec.axis) return { ax: [0, 1, 0], sg: s === 1 ? -1 : 1 };
  const [ax, ay, az] = spec.axis, L = Math.hypot(ax, ay, az), a = [(s === 1 ? ax : -ax) / L, ay / L, az / L];
  // 門裡、鉸鏈後方 0.5 m 的點 q = (0, 0, −.5)，繞 a 轉一點點的位移是 a × q；取讓 x 往外（左門 +x）的方向
  const dx = a[1] * -.5;
  return { ax: a, sg: (dx > 0) === (s === 1) ? 1 : -1 };
}

// 一個 body 網格 → 車身／左門／右門的幾何（three 由呼叫端傳入，這個檔不 import three）。
// geo：BufferGeometry；rel：網格到車身座標的矩陣（含 meshopt 的反量化）；回傳 { parts: [[geo…]×3], pts: { 1: [[x,y,z]…], 2: […] } }，
// 沒有切到門的網格回傳 null（照原樣用）。原三角形共用原本的頂點屬性（只換索引），剪出來的另建 Float32 幾何。
export function doorBuild(T, geo, rel, spec, dbg) {
  const p = geo.attributes.position, nv = p.count, P = new Float32Array(nv * 3), v = new T.Vector3();
  for (let i = 0; i < nv; i++) { v.fromBufferAttribute(p, i).applyMatrix4(rel); P[i * 3] = v.x; P[i * 3 + 1] = v.y; P[i * 3 + 2] = v.z; }
  const idx = geo.index ? geo.index.array : Uint32Array.from({ length: nv }, (_, i) => i);
  const r = doorSplit(P, idx, spec, dbg);
  if (!r.frags.length && !r.mark.some((m) => m === 1 || m === 2)) return null;
  const G = doorGroups(idx, r), pts = { 1: [], 2: [] };
  const acc = {}; for (const [k, a] of Object.entries(geo.attributes)) acc[k] = { itemSize: a.itemSize, get: (i, c) => a.getComponent(i, c) };
  const parts = G.map((g, s) => {
    const out = [];
    if (g.idx.length) {
      const gg = new T.BufferGeometry(); for (const k in geo.attributes) gg.setAttribute(k, geo.attributes[k]);
      gg.setIndex(g.idx); out.push(gg);
      if (s) for (const i of g.idx) pts[s].push([P[i * 3], P[i * 3 + 1], P[i * 3 + 2]]);
    }
    if (g.frag.length) {
      const A = doorFragAttrs(idx, g.frag, acc), gg = new T.BufferGeometry();
      for (const k in A) gg.setAttribute(k, new T.BufferAttribute(A[k], geo.attributes[k].itemSize));
      out.push(gg);
      if (s) { const Q = doorFragAttrs(idx, g.frag, { p: { itemSize: 3, get: (i, c) => P[i * 3 + c] } }).p; for (let i = 0; i < Q.length; i += 3) pts[s].push([Q[i], Q[i + 1], Q[i + 2]]); }
    }
    return out;
  });
  return { parts, pts };
}

// 門板內飾：模型沒做車門內側，打開的門會露出外殼背面與整片藏在門裡的車窗玻璃（鏡面玻璃把附近的燈反成一大團亮斑）。
// doorCard：拿這扇門不透明、朝側面（|法線 x| > .5）的三角形中窗線以下的部分（就是外殼），往車內縮 spec.cardIn（預設 7 cm）
// 複製一層、反轉朝向，畫成霧面內飾板；doorGlassTrim：拿掉窗線以下的車窗玻璃三角形（真車的那段玻璃收在門裡）。
// 窗線 spec.belt：一個高度，或門前後兩點 [[z, y], [z, y]]（中間線性內插）；spec.card：內飾板顏色（線性 RGB，預設深灰）。
// list：[{ geo, mat, rel }]（mat 是 glb 原本的材質，看 transparent、map；rel 到車身座標）。
export function doorBelt(spec, z) {
  const b = spec.belt ?? .9;
  if (typeof b === 'number') return b;
  const [[z0, y0], [z1, y1]] = b, t = Math.min(1, Math.max(0, (z - z0) / (z1 - z0)));
  return y0 + (y1 - y0) * t;
}
const triIds = (g) => { const I = g.index ? g.index.array : null, n = I ? I.length : g.attributes.position.count; return { n, at: (i) => (I ? I[i] : i) }; };
// 回傳 { geo（車身座標、Float32、屬性照模板網格）, mat, tris }，沒有外殼回傳 null
export function doorCard(T, list, spec) {
  const inset = spec.cardIn ?? .07, col = spec.card || [.055, .052, .048];
  const v = new T.Vector3(), n = new T.Vector3(), nm = new T.Matrix3(), tris = [];
  let tmpl = null, best = 0;
  for (const e of list) {
    const g = e.geo, P = g.attributes.position, N = g.attributes.normal;
    if (e.mat.transparent || !N) continue;
    const { n: cnt, at } = triIds(g);
    nm.getNormalMatrix(e.rel);
    let used = 0;
    for (let i = 0; i < cnt; i += 3) {
      const ids = [at(i), at(i + 1), at(i + 2)];
      const q = ids.map((j) => { v.fromBufferAttribute(P, j).applyMatrix4(e.rel); return [v.x, v.y, v.z]; });
      if (q.every((p) => p[1] > doorBelt(spec, p[2]) - .005)) continue;
      const nn = ids.map((j) => { n.fromBufferAttribute(N, j).applyMatrix3(nm).normalize(); return [-n.x, -n.y, -n.z]; });
      if (Math.abs(nn[0][0] + nn[1][0] + nn[2][0]) / 3 < .5) continue;
      tris.push([q, nn]); used++;
    }
    // 屬性與材質照用到最多三角形、沒有貼圖的網格（內飾板沒有 uv）
    const score = used * (e.mat.map ? .01 : 1);
    if (used && score > best) { best = score; tmpl = e; }
  }
  if (!tris.length) return null;
  const nv = tris.length * 3, A = {};
  for (const [k, a] of Object.entries(tmpl.geo.attributes)) A[k] = new Float32Array(nv * a.itemSize);
  let w = 0;
  for (const [q, nn] of tris) for (const k of [0, 2, 1]) {   // 反轉繞向：正面朝車內
    const [x, y, z] = q[k], yb = Math.min(y, doorBelt(spec, z)), sh = .82 + .18 * Math.min(1, Math.max(0, (yb - .3) / .55));
    for (const [name, arr] of Object.entries(A)) {
      const sz = tmpl.geo.attributes[name].itemSize, o = w * sz;
      if (name === 'position') { arr[o] = x - Math.sign(x) * inset; arr[o + 1] = yb; arr[o + 2] = z; }
      else if (name === 'normal') { arr[o] = nn[k][0]; arr[o + 1] = nn[k][1]; arr[o + 2] = nn[k][2]; }
      else if (name === 'color') { arr[o] = col[0] * sh; arr[o + 1] = col[1] * sh; arr[o + 2] = col[2] * sh; if (sz > 3) arr[o + 3] = 1; }
      else if (name === '_pbr') arr[o] = .8;   // 粗糙 .8、金屬 0、清漆 0、不是烤漆（換色不套用）
    }
    w++;
  }
  const geo = new T.BufferGeometry();
  for (const [k, arr] of Object.entries(A)) geo.setAttribute(k, new T.BufferAttribute(arr, tmpl.geo.attributes[k].itemSize));
  return { geo, mat: tmpl.mat, tris: tris.length };
}
// 半透明網格只留窗線以上的三角形（三個頂點都在窗線下 1 cm 以下的拿掉）；回傳拿掉幾個
export function doorGlassTrim(T, list, spec) {
  const v = new T.Vector3();
  let cut = 0;
  for (const e of list) {
    if (!e.mat.transparent) continue;
    const g = e.geo, P = g.attributes.position, { n, at } = triIds(g), keep = [];
    for (let i = 0; i < n; i += 3) {
      const ids = [at(i), at(i + 1), at(i + 2)];
      const low = ids.every((j) => { v.fromBufferAttribute(P, j).applyMatrix4(e.rel); return v.y < doorBelt(spec, v.z) - .01; });
      if (low) cut++; else keep.push(...ids);
    }
    if (keep.length < n) g.setIndex(keep);
  }
  return cut;
}

// 原檔玻璃的不透明度（material.opacity）沒有進頂點色：不透明度 0（作者藏起來的層）與 0.2 的玻璃都畫成 alpha 1 的白色鏡面，
// 開門轉個角度就把城市的反射與招牌燈整片反過來、擋住車裡的人。有車門的車：opacity 0 的半透明網格拿掉，其餘把 color 的 alpha 乘上 opacity。
// list：[{ geo, mat }]（mat 是 glb 原本的材質）；回傳留下的 list
// tint：cars.json 的 door.glass，深色隔熱玻璃（頂點色 RGB 都在 0.3 以下）的 alpha 上限（m4wb 原檔 0.9，夜裡整片黑綠、看不到車裡的人）
export function doorGlass(list, tint = 1) {
  const done = new Set();
  return list.filter((e) => {
    const m = e.mat;
    if (!m.transparent || m.opacity >= 1 && tint >= 1) return true;
    if (m.opacity <= .001) return false;
    const g = e.geo, c = g.attributes.color;
    if (!c || c.itemSize < 4 || done.has(g)) return true;
    done.add(g);
    const b = c.clone();
    for (let i = 0; i < b.count; i++) { let a = b.getW(i) * m.opacity; if (a > tint && Math.max(b.getX(i), b.getY(i), b.getZ(i)) < .3) a = tint; b.setW(i, a); }
    g.setAttribute('color', b);
    return true;
  });
}

// ─── 方向盤：模型裡的方向盤和車身是同一個網格，照 cars.json 的 sw 把它拆出來，頁面掛在轉軸上跟著轉向轉 ───
// sw：{ c: [x, y, z] 中心（車身座標）, r 外緣半徑, t 轉軸往上翹的角度（度，0 是水平朝後）, d 沿轉軸的半厚度（預設 .07） }
// 連通塊（共用頂點的三角形）有 85% 以上的頂點落在這個圓柱裡就算方向盤（輪圈、輻條、中間的氣囊與廠徽）。
export function swAxis(sw) { const t = (sw.t ?? 22) * Math.PI / 180; return [0, Math.sin(t), -Math.cos(t)]; }   // 朝駕駛的轉軸
export function swInside(sw, x, y, z) {
  const n = swAxis(sw), qx = x - sw.c[0], qy = y - sw.c[1], qz = z - sw.c[2], a = qx * n[0] + qy * n[1] + qz * n[2];
  const rx = qx - a * n[0], ry = qy - a * n[1], rz = qz - a * n[2];
  return Math.abs(a) < (sw.d ?? .07) && rx * rx + ry * ry + rz * rz < (sw.r + .015) ** 2;
}
// 一個網格 → { rest, wheel }（共用原本的頂點屬性、各自一份索引），沒有方向盤的網格回傳 null
export function swSplit(T, geo, rel, sw) {
  const p = geo.attributes.position, nv = p.count, v = new T.Vector3(), inside = new Uint8Array(nv);
  let any = 0;
  for (let i = 0; i < nv; i++) { v.fromBufferAttribute(p, i).applyMatrix4(rel); if (swInside(sw, v.x, v.y, v.z)) { inside[i] = 1; any = 1; } }
  if (!any) return null;
  const idx = geo.index ? geo.index.array : Uint32Array.from({ length: nv }, (_, i) => i);
  const par = new Int32Array(nv).map((_, i) => i), find = (a) => { while (par[a] !== a) a = par[a] = par[par[a]]; return a; };
  for (let i = 0; i < idx.length; i += 3) { const a = find(idx[i]), b = find(idx[i + 1]), c = find(idx[i + 2]); par[b] = a; par[find(c)] = a; }
  const tot = new Map(), inn = new Map();
  for (let i = 0; i < nv; i++) { const r = find(i); tot.set(r, (tot.get(r) || 0) + 1); if (inside[i]) inn.set(r, (inn.get(r) || 0) + 1); }
  const rest = [], wheel = [];
  // sw.cut：輪圈和儀表板、轉向柱焊成同一塊網格的車（m4wb），整塊挑不出來，改成三個頂點都在圓柱裡的三角形就拆出來
  for (let i = 0; i < idx.length; i += 3) {
    const r = find(idx[i]), whole = (inn.get(r) || 0) >= tot.get(r) * .85;
    (whole || sw.cut && inside[idx[i]] && inside[idx[i + 1]] && inside[idx[i + 2]] ? wheel : rest).push(idx[i], idx[i + 1], idx[i + 2]);
  }
  if (!wheel.length) return null;
  const mk = (ix) => { const g = new T.BufferGeometry(); for (const k in geo.attributes) g.setAttribute(k, geo.attributes[k]); g.setIndex(ix); return g; };
  return { rest: rest.length ? mk(rest) : null, wheel: mk(wheel), tris: wheel.length / 3 };
}
