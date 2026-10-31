// ═══ 程式立面的量體與細模：地塊照輪廓與樓層數擠出（凸窗、塔樓退角、壁柱、樓板），近處的街區再換成牆上真的挖出窗洞的細模 ═══
// 10-city.js 的立面原本是一個方塊（boxFaces）＋ m-facade 畫在平面上的窗；這裡改成：
//   量體（遠近都建，輪廓一致）：磚樓正面的凸窗（一或兩開間寬、凸出 0.75 m、下面托座、上面壓頂）、轉角塔樓在街角退一格（基座兩層照舊是整塊）、
//     石造廠房樓每個開間之間的壁柱（凸出 0.2 m）、翻新灰泥樓每層一道樓板（凸出 0.1 m，正面照舊畫 LED 線）
//   細模（鏡頭 SET.fac 公尺內的街區，10-city.js 的 facLod 串流建、走遠就丟）：每扇窗挖進牆裡（玻璃退 d，窗洞的兩側、窗楣底與窗台都是面）、
//     店面的櫥窗與鐵捲門往內凹 0.3 m（店與店之間的牆墩、上面的招牌帶留在牆面）、玻璃帷幕每層一道凸出的樓板邊
// 窗格完全照 m-facade（gH、fh、ws、cols、mg、wmin／wmax、店面 units），所以玻璃、窗內、店內照舊是著色器畫的；新的面帶 aB2.w 的 2（solid）：
// 著色器把它當純牆（不畫窗、不當屋頂），窗洞的水平面用樣式 7（石材）。只用 L.seed 的雜湊，不抽 rnd()：亂數序列和以前一樣。
// 騎樓：霓虹區、珊瑚灘與一部分中城、舊碼頭的街面，一樓店面往裡退 ARC_D，正面一排柱撐著上面的樓（街區的碰撞盒在那段往裡退、柱是圓柱，10-city.js）。
// 其他的一樓不出地塊的矩形。函式在 10-city.js 的立面迴圈才呼叫（quad、boxFaces、lots 在那裡）。
const FAC_GH = 4.6;
const facHash = (s, k) => { const x = Math.sin(s * 12.9898 + k * 78.233) * 43758.5453; return x - Math.floor(x); };
const facFh = st => st === 3 ? 3.7 : st === 2 || st === 8 ? 3.4 : 3.1;
const facWs = st => st === 3 ? 1.6 : st === 2 || st === 8 ? 2.2 : 2.5;
const facCols = (w, ws) => Math.max(1, Math.floor((w - 1) / ws));
const facNF = (H, st) => Math.floor((H - FAC_GH - .7) / facFh(st));
// 面的框：起點 a（u = 0，面向觀看者的左邊）、u 方向、法線、寬；和 boxFaces 的方向一致（u 方向 × 上 = 法線）
// ry：局部 +z 朝外的零件（20-relief.js 的 fbox、實例）要轉的角度
function facFace(key, x0, x1, z0, z1) {
  return key === 'pz' ? { key, ax: x0, az: z1, ux: 1, uz: 0, nx: 0, nz: 1, w: x1 - x0, ry: 0 }
    : key === 'nz' ? { key, ax: x1, az: z0, ux: -1, uz: 0, nx: 0, nz: -1, w: x1 - x0, ry: Math.PI }
    : key === 'px' ? { key, ax: x1, az: z1, ux: 0, uz: -1, nx: 1, nz: 0, w: z1 - z0, ry: Math.PI / 2 }
    : { key, ax: x0, az: z0, ux: 0, uz: 1, nx: -1, nz: 0, w: z1 - z0, ry: -Math.PI / 2 };
}
const facPt = (F, u, o) => [F.ax + F.ux * u + F.nx * o, F.az + F.uz * u + F.nz * o];
// 同一個方向的子面：從 u0 到 u1、往外 o（新的 u 從 0 起算）
const facSub = (F, u0, u1, o = 0) => { const [ax, az] = facPt(F, u0, o); return { key: F.key, ax, az, ux: F.ux, uz: F.uz, nx: F.nx, nz: F.nz, w: u1 - u0, ry: F.ry }; };
// 凸窗：正面第 ci 開間、第 fi 層是不是在凸窗裡（後面的窗不挖、不擺窗台與冷氣）；凸窗正面的框
const facBayAt = (L, ci, fi) => !!L.mass && L.mass.bays.some(b => ci >= b.c0 && ci <= b.c1 && fi >= b.f0 && fi <= b.f1);
const facBayF = (L, b) => facSub(facFace(L.mass.front, L.x0, L.x1, L.z0, L.z1), b.u0, b.u1, b.d);
// 正面 u（離面的左端）、高 y 有沒有凸出物，有的話回傳要往外讓多少（立式招牌）
const facOut = (L, u, y) => { let d = 0; if (L.mass) for (const s of L.mass.spans) if (u > s.u0 && u < s.u1 && y > s.y0 - 2 && y < s.y1 + 2) d = Math.max(d, s.d); return d; };
const facFront = L => L.axis === 'z' ? (L.face > 0 ? 'pz' : 'nz') : (L.face > 0 ? 'px' : 'nx');
const FAC_REAR = { pz: 'nz', nz: 'pz', px: 'nx', nx: 'px' };

// ─── 四種面（quad 的 a、b 在下、c、d 在上，從外面看是逆時針） ───
// 平行於面：u0 → u1、離牆 o、y0 → y1；uv 的 u 是 a0 → a1（預設就是面的 u，著色器才算得出同一套窗格）
function fvq(B, F, u0, u1, o, y0, y1, A, A2, a0 = u0, a1 = u1) {
  const [x0, z0] = facPt(F, u0, o), [x1, z1] = facPt(F, u1, o);
  quad(B, [x0, y0, z0], [x1, y0, z1], [x1, y1, z1], [x0, y1, z0], [F.nx, 0, F.nz], a0, a1, A, A2);
}
// 垂直於面（窗洞側面、凸窗側牆）：在 u、o0 → o1，s = 1 朝 +u；uv 的 u 是深度
function fsq(B, F, u, o0, o1, y0, y1, s, A, A2) {
  const p = facPt(F, u, s > 0 ? o1 : o0), q = facPt(F, u, s > 0 ? o0 : o1);
  quad(B, [p[0], y0, p[1]], [q[0], y0, q[1]], [q[0], y1, q[1]], [p[0], y1, p[1]], [F.ux * s, 0, F.uz * s], 0, Math.abs(o1 - o0), A, A2);
}
// 水平（窗台、窗楣底、托座底、壓頂）：u0 → u1、o0 → o1、高 y，up 朝上
function fhq(B, F, u0, u1, o0, o1, y, up, A, A2) {
  const a = facPt(F, u0, o1), b = facPt(F, u1, o1), c = facPt(F, u1, o0), d = facPt(F, u0, o0);
  if (up) quad(B, [a[0], y, a[1]], [b[0], y, b[1]], [c[0], y, c[1]], [d[0], y, d[1]], [0, 1, 0], u0, u1, A, A2);
  else quad(B, [d[0], y, d[1]], [c[0], y, c[1]], [b[0], y, b[1]], [a[0], y, a[1]], [0, -1, 0], u0, u1, A, A2);
}
// 獨立的柱（騎樓）：四面都是 solid，背面用反過來的框
function fcol(B, F, u0, u1, o0, o1, y0, y1, S, S2) {
  fvq(B, F, u0, u1, o1, y0, y1, S, S2);
  fsq(B, F, u0, o0, o1, y0, y1, -1, S, S2); fsq(B, F, u1, o0, o1, y0, y1, 1, S, S2);
  const [ax, az] = facPt(F, u1, o0);
  fvq(B, { ax, az, ux: -F.ux, uz: -F.uz, nx: -F.nx, nz: -F.nz }, 0, u1 - u0, 0, y0, y1, S, S2);
}
// 凸出牆面的方塊（u0..u1、o0..o1、y0..y1）：正面照 A（著色器照面的 u 畫），兩側、底與頂是 solid
function fbx(B, F, u0, u1, o0, o1, y0, y1, A, A2, S, S2, top = true, bot = true) {
  fvq(B, F, u0, u1, o1, y0, y1, A, A2);
  fsq(B, F, u0, o0, o1, y0, y1, -1, S, S2); fsq(B, F, u1, o0, o1, y0, y1, 1, S, S2);
  if (bot) fhq(B, F, u0, u1, o0, o1, y0, false, S, S2);
  if (top) fhq(B, F, u0, u1, o0, o1, y1, true, S, S2);
}
const solidOf = A2 => [A2[0], A2[1], A2[2], A2[3] + 2];
// 真的凹進去的玻璃（加 4）：m-facade 不再用視差畫洞口的側面
const deepOf = A2 => [A2[0], A2[1], A2[2], A2[3] + 4];

// ─── 面外側緊貼的地塊有多高（側面被隔壁擋住的部分不挖窗、不擺壁柱） ───
let facByBlock = null;
function facCover(L, key) {
  if (!facByBlock) { facByBlock = new Map(); for (const N of lots) { const k = N.b || N.zn; if (!facByBlock.has(k)) facByBlock.set(k, []); facByBlock.get(k).push(N); } }
  let h = 0;
  for (const N of facByBlock.get(L.b || L.zn) || []) {
    if (N === L || N.ghost) continue;
    const hit = key === 'px' ? Math.abs(N.x0 - L.x1) < .05 && N.z0 < L.z1 - .5 && N.z1 > L.z0 + .5
      : key === 'nx' ? Math.abs(N.x1 - L.x0) < .05 && N.z0 < L.z1 - .5 && N.z1 > L.z0 + .5
      : key === 'pz' ? Math.abs(N.z0 - L.z1) < .05 && N.x0 < L.x1 - .5 && N.x1 > L.x0 + .5
      : Math.abs(N.z1 - L.z0) < .05 && N.x0 < L.x1 - .5 && N.x1 > L.x0 + .5;
    if (hit) h = Math.max(h, N.h + (N.glb ? 3 : 0));
  }
  return h;
}

// ─── 量體計畫（立面迴圈裡、店面與退縮頂的亂數抽完之後呼叫）：L.mass ───
// bays：正面的凸窗 { c0, c1（開間）, f0, f1（樓層）, u0, u1, d, y0, y1 }；spans：正面凸出物的範圍（20-props 的立式招牌往外讓、20-relief 的花台不擺）
// notch：塔樓街角退的邊長，nk：哪幾個角（0：pz 尾／px 頭，1：px 尾／nz 頭，2：nz 尾／nx 頭，3：nx 尾／pz 頭），yp：基座頂
// bal：翻新樓的陽台 { u, w, fi }（20-relief 擺實例）
function massPlan(L) {
  const st = L.style, front = facFront(L), F = facFace(front, L.x0, L.x1, L.z0, L.z1);
  const M = L.mass = { front, bays: [], spans: [], notch: 0, nk: [0, 0, 0, 0], yp: 0, bal: [], arc: null };
  if (L.isle || L.special || L.tiers || !L.b || L.b.outer) return M;
  M.arc = arcPlan(L);
  const fh = facFh(st), ws = facWs(st), nF = facNF(L.h, st), cols = facCols(F.w, ws), mg = (F.w - cols * ws) / 2;
  const dist = district((L.x0 + L.x1) / 2, (L.z0 + L.z1) / 2), homey = /^(楓林|公園|雲杉|灰石)/.test(dist);
  // 磚樓：正面的凸窗（紐約、舊金山的老公寓），兩開間的 6 m 寬（著色器算出兩扇窗）、一開間的 3.5 m
  if ((st === 0 || st === 1) && !L.back && nF >= 2 && facHash(L.seed, 21) < (homey ? .7 : .45)) {
    const r = facHash(L.seed, 22), pick = [];
    if (cols >= 5) pick.push([0, 1], [cols - 2, cols - 1]);
    else if (cols === 4) pick.push(r < .5 ? [1, 2] : [0, 1], ...(r < .5 ? [] : [[2, 3]]));
    else if (cols === 3) pick.push(...(r < .5 ? [[1, 1]] : [[0, 0], [2, 2]]));
    else if (cols === 2) pick.push([0, 1]);
    const f1 = nF >= 4 && facHash(L.seed, 23) < .5 ? nF - 2 : nF - 1, f0 = nF >= 5 && facHash(L.seed, 24) < .3 ? 1 : 0, d = .75;
    for (const [c0, c1] of pick) {
      const u0 = mg + c0 * ws - .5, u1 = mg + (c1 + 1) * ws + .5;
      if (u0 < -.01 || u1 > F.w + .01 || f1 < f0) continue;
      const b = { c0, c1, f0, f1, u0, u1, d, y0: FAC_GH + f0 * fh + .4, y1: FAC_GH + (f1 + 1) * fh - .15 };
      M.bays.push(b); M.spans.push({ u0: u0 - .1, u1: u1 + .1, d: d + .12, y0: b.y0 - .4, y1: b.y1 + .2 });
    }
  }
  // 翻新灰泥樓：兩開間一座的陽台（二樓起；樓板和下面每層的樓板帶連在一起）
  if (st === 4 && !L.back && cols >= 2 && nF >= 2 && facHash(L.seed, 31) < .65) {
    const every = facHash(L.seed, 32) < .5 ? 1 : 2;
    for (let c = 0; c + 1 < cols; c += 2) for (let fi = 1; fi < nF; fi += every) M.bal.push({ u: mg + (c + 1) * ws, w: 2 * ws - .3, fi });
    if (M.bal.length) M.spans.push({ u0: 0, u1: F.w, d: 1.1, y0: FAC_GH + fh - .2, y1: L.h });
  }
  // 轉角的玻璃塔：街角兩面都露出來的角往裡退一格（1.6 m，大樓 3.2 m），基座兩層照舊
  if (st === 3 && !L.h2 && L.h > 30) {
    const w = L.x1 - L.x0, dp = L.z1 - L.z0, n = Math.min(w, dp) >= 24 && facHash(L.seed, 41) < .5 ? 3.2 : 1.6, yp = FAC_GH + 2 * 3.7;
    if (Math.min(w, dp) >= 11.5 && facHash(L.seed, 42) < .8) {
      const open = k => facCover(L, k) < yp - .1;
      const ring = ['pz', 'px', 'nz', 'nx'];
      for (let i = 0; i < 4; i++) M.nk[i] = open(ring[i]) && open(ring[(i + 1) % 4]) ? 1 : 0;
      if (M.nk.some(Boolean)) { M.notch = n; M.yp = yp; }
    }
  }
  return M;
}

// ─── 一個地塊的外牆清單 { F, y0, y1, key（在地塊矩形的平面上才有）, shop, flat } ───
// 一般的地塊是矩形的四面；退角的塔樓是基座四面加上面的八段（四面縮短、每個角兩段退進去的牆）
function facWalls(L) {
  const M = L.mass, H = L.h, out = [];
  const keys = ['pz', 'px', 'nz', 'nx'];
  const shopOf = k => !!(L.fz && L.fz.shopF[k]);
  if (!M || !M.notch) {
    for (const k of keys) out.push({ F: facFace(k, L.x0, L.x1, L.z0, L.z1), y0: 0, y1: H, key: k, shop: shopOf(k) });
    return out;
  }
  const n = M.notch, nk = M.nk;
  for (let i = 0; i < 4; i++) {
    const k = keys[i], F = facFace(k, L.x0, L.x1, L.z0, L.z1);
    out.push({ F, y0: 0, y1: M.yp, key: k, shop: shopOf(k) });
    const t0 = nk[(i + 3) % 4] ? n : 0, t1 = nk[i] ? n : 0;   // 這一面的頭（前一個角）與尾（這個角）
    out.push({ F: facSub(F, t0, F.w - t1), y0: M.yp, y1: H, key: t0 || t1 ? null : k, cov: facCover(L, k) });
    if (nk[i]) {   // 這個角：和下一面平行、往裡退 n 的那段，與和這一面平行、往裡退 n 的那段
      const G = facFace(keys[(i + 1) % 4], L.x0, L.x1, L.z0, L.z1);
      out.push({ F: facSub(G, 0, n, -n), y0: M.yp, y1: H, key: null, cc: [0, 1] }, { F: facSub(F, F.w - n, F.w, -n), y0: M.yp, y1: H, key: null, cc: [1, 0] });
    }
  }
  return out;
}

// ─── 細模的牆：窗格照 m-facade，選到的窗挖洞（玻璃退 d，四邊是窗洞的面）；skip(ci, fi) 為真的窗不挖（凸窗後面） ───
function facHoles(B, F, A, A2, st, H, y0, y1, d, skip) {
  const fh = facFh(st), ws = facWs(st), nF = facNF(H, st), cols = facCols(F.w, ws), mg = (F.w - cols * ws) / 2;
  const S2 = solidOf(A2), SB = [A[0], 7, A[2], 0], SJ = [A[0], st, A[2], 0];
  let y = y0;
  for (let fi = 0; fi < nF; fi++) {
    const r0 = FAC_GH + fi * fh + .18 * fh, r1 = FAC_GH + fi * fh + .8 * fh;
    if (r0 < y0 - 1e-3 || r1 > y1 + 1e-3) continue;
    if (r0 > y + 1e-4) fvq(B, F, 0, F.w, 0, y, r0, A, A2);
    let u = 0;
    for (let ci = 0; ci < cols; ci++) {
      if (skip && skip(ci, fi)) continue;
      const a = mg + (ci + .27) * ws, b = mg + (ci + .73) * ws;
      fvq(B, F, u, a, 0, r0, r1, A, A2);                 // 窗間牆
      fvq(B, F, a, b, -d, r0, r1, A, deepOf(A2));        // 玻璃（照舊畫窗內、窗簾與倒影）
      fsq(B, F, a, -d, 0, r0, r1, 1, SJ, S2); fsq(B, F, b, -d, 0, r0, r1, -1, SJ, S2);   // 窗洞兩側
      fhq(B, F, a, b, -d, 0, r1, false, SB, S2); fhq(B, F, a, b, -d, 0, r0, true, SB, S2);   // 窗楣底、窗台
      u = b;
    }
    fvq(B, F, u, F.w, 0, r0, r1, A, A2);
    y = r1;
  }
  if (y1 > y + 1e-4) fvq(B, F, 0, F.w, 0, y, y1, A, A2);
}
// 細模的店面：每個店面單位的櫥窗（或鐵捲門）往內凹 d，牆墩與招牌帶留在牆面；o0 是整排店面離牆面多遠（騎樓裡退進去的那排，招牌帶是柱上的梁）
function facShop(B, F, A, A2, units, d, o0 = 0) {
  const uw = F.w / units, S2 = solidOf(A2), SB = [A[0], 7, A[2], 0], SJ = [A[0], A[1], A[2], 0];
  let u = 0;
  for (let k = 0; k < units; k++) {
    const a = (k + .045) * uw, b = (k + .955) * uw;
    fvq(B, F, u, a, o0, 0, 3.42, A, A2);
    fvq(B, F, a, b, o0 - d, 0, 3.42, A, deepOf(A2));
    fsq(B, F, a, o0 - d, o0, 0, 3.42, 1, SJ, S2); fsq(B, F, b, o0 - d, o0, 0, 3.42, -1, SJ, S2);
    fhq(B, F, a, b, o0 - d, o0, 3.42, false, SB, S2);
    u = b;
  }
  fvq(B, F, u, F.w, o0, 0, 3.42, A, A2);
  if (!o0) fvq(B, F, 0, F.w, 0, 3.42, FAC_GH, A, A2);
}

// ─── 騎樓 ───
// 一條街面（街區的一面）抽一次：雜湊照街區與面，所以同一面上符合的地塊一起做；街角的地塊（正面的一端沒有隔壁）、
// 店面以外的特殊地塊、設施街區、安全屋的門、玻璃帷幕與夜店不做（隔壁是實體建築的那端是側牆）；連續不到兩塊的也不做（單獨一塊看起來像蓋錯）
const ARC_D = 2.8, ARC_Y = 3.42;
const arcP = d => /^霓虹/.test(d) ? .7 : /^珊瑚/.test(d) ? .45 : /^(中城|舊碼頭)/.test(d) ? .2 : 0;
function arcNb(L, end) {   // 正面 u = 0（end 0）或 u = 寬（end 1）那一端緊鄰的地塊
  const F = facFace(facFront(L), L.x0, L.x1, L.z0, L.z1), [x, z] = facPt(F, end ? F.w + .5 : -.5, -1);
  facCover(L, 'pz');   // 建 facByBlock
  return (facByBlock.get(L.b) || []).find(N => N !== L && !N.ghost && x > N.x0 && x < N.x1 && z > N.z0 && z < N.z1) || null;
}
function arcLot(L) {
  if (!L || L.back || L.special || L.glb || L.ghost || L.isle || L.tiers || !L.b || L.b.outer || L.b.plaza || L.b.fac) return false;
  if (![0, 1, 2, 4].includes(L.style) || L.h < FAC_GH + 3) return false;
  const key = facFront(L), F = facFace(key, L.x0, L.x1, L.z0, L.z1);
  if (F.w < 6 || key === 'pz' && aptDoorOn(L.x0, L.x1, L.z1)) return false;
  if (facHash(L.b.i * 7.31 + L.b.j * 3.17 + ['pz', 'px', 'nz', 'nx'].indexOf(key) * .71, 51) >= arcP(district((L.x0 + L.x1) / 2, (L.z0 + L.z1) / 2))) return false;
  const n0 = arcNb(L, 0), n1 = arcNb(L, 1);
  return !!(n0 && n1);
}
const arcJoin = (L, N) => !!N && facFront(N) === facFront(L) && arcLot(N);
function arcPlan(L) {
  if (!arcLot(L)) return null;
  const e0 = arcJoin(L, arcNb(L, 0)), e1 = arcJoin(L, arcNb(L, 1));
  if (!e0 && !e1) return null;
  const F = facFace(facFront(L), L.x0, L.x1, L.z0, L.z1);
  return { d: ARC_D, e0, e1, units: Math.max(1, Math.round(F.w / 6.5)) };
}
// 柱的位置（正面的 u 範圍）：店面單位的交界；一端接著隔壁的騎樓時柱跨在地界上（只由 u = 0 那端的地塊建），接著一般的樓時是貼齊地界的端柱
const arcCols = (L, w) => {
  const a = L.mass.arc, uw = w / a.units, out = [a.e0 ? [-.25, .25] : [0, .5]];
  for (let k = 1; k < a.units; k++) out.push([k * uw - .25, k * uw + .25]);
  if (!a.e1) out.push([w - .5, w]);
  return out;
};
// 騎樓的一樓（遠近都建）：柱上的梁（店招掛在這裡）、退進去的店面（細模是凹進去的櫥窗）、天花板、地坪、柱、接一般的樓那端的側牆
function arcGeo(B, L, F, A, A2, det) {
  const a = L.mass.arc, D = a.d, S2 = solidOf(A2), SB = [L.seed, 9, F.w, 0], SJ = [L.seed, L.style, .5, 0];   // 樣式 9：騎樓的地坪與天花板
  fvq(B, F, 0, F.w, 0, ARC_Y, FAC_GH, A, A2);
  if (det) facShop(B, F, A, A2, a.units, .3, -D); else fvq(B, F, 0, F.w, -D, 0, ARC_Y, A, A2);
  fhq(B, F, 0, F.w, -D, 0, ARC_Y, false, SB, S2);
  fhq(B, F, 0, F.w, -D, 0, .16, true, SB, S2);
  for (const [u0, u1] of arcCols(L, F.w)) fcol(B, F, u0, u1, -.5, 0, .16, ARC_Y, SJ, S2);
  if (!a.e0) fsq(B, F, 0, -D, -.5, .16, ARC_Y, 1, SJ, S2);
  if (!a.e1) fsq(B, F, F.w, -D, -.5, .16, ARC_Y, -1, SJ, S2);
}

// ─── 一個地塊的立面幾何（det：細模）。天樞島的地塊（退台、塔冠）照舊是方塊 ───
function lotGeo(B, L, det) {
  const fz = L.fz, st = L.style, H = L.h, flag = L.isle ? 1 : 0, M = L.mass;
  if (L.isle || !M) return boxFaces(B, L.x0, L.x1, L.z0, L.z1, 0, H, L.seed, st, fz.shopF, H, fz.masks, true, flag);
  const rear = FAC_REAR[M.front], recess = st === 2 ? .3 : st === 4 ? .18 : st === 3 ? .12 : .22;
  const bayAt = (ci, fi) => facBayAt(L, ci, fi);
  for (const w of facWalls(L)) {
    const F = w.F, m = w.key && fz.masks[w.key] || [0, 1];
    const A = [L.seed, st, F.w, w.shop ? 1 : 0], A2 = [m[0], m[1], H, flag];
    const cov = w.key ? facCover(L, w.key) : w.cov || 0;
    const arc = M.arc && w.key === M.front, y0 = arc ? FAC_GH : w.y0;
    if (arc) arcGeo(B, L, F, A, A2, det);
    // 遠景、背面、整面被隔壁擋住的：一片
    if (!det || w.key === rear && !w.shop || cov >= w.y1 - .3 || st === 5 || st === 8) { fvq(B, F, 0, F.w, 0, y0, w.y1, A, A2); continue; }
    let y = y0;
    if (cov > y + .05) { fvq(B, F, 0, F.w, 0, y, cov, A, A2); y = cov; }
    if (y < FAC_GH) {
      const top = Math.min(FAC_GH, w.y1);
      if (y === 0 && top === FAC_GH && w.shop && st !== 6) facShop(B, F, A, A2, Math.max(1, m[1]), .3);
      else fvq(B, F, 0, F.w, 0, y, top, A, A2);
      y = top;
    }
    if (y >= w.y1 - 1e-3) continue;
    if (st === 3) {   // 玻璃帷幕：玻璃退 0.12 m，每層樓板邊凸出 0.15 m（深色金屬）
      const S = [L.seed, 3, F.w, 0], S2 = solidOf(A2);
      // 兩端：外角是朝外的角柱面（和隔壁那面的角柱面圍成一根柱），退角裡面的內角是朝裡的側面
      const cc = w.cc || [0, 0];
      fvq(B, F, 0, F.w, -recess, y, w.y1, A, deepOf(A2));
      fsq(B, F, 0, -recess, 0, y, w.y1, cc[0] ? 1 : -1, S, S2); fsq(B, F, F.w, -recess, 0, y, w.y1, cc[1] ? -1 : 1, S, S2);
      for (let yf = FAC_GH + 3.7 * Math.ceil((y - FAC_GH + .2) / 3.7); yf < w.y1 - 1.7; yf += 3.7) fbx(B, F, 0, F.w, -recess, .15, yf - .16, yf + .16, S, S2, S, S2);
      continue;
    }
    facHoles(B, F, A, A2, st, H, y, w.y1, recess, w.key === M.front && M.bays.length ? bayAt : null);
  }
  // 屋頂：退角的塔樓是十字形（中段整條、上下兩條扣掉退進去的角），基座頂在退進去的角上
  const R = [L.seed, st, L.x1 - L.x0, 0], R2 = [0, 1, H, 0];
  const roof = (x0, x1, z0, z1, y) => { if (x1 - x0 > .01 && z1 - z0 > .01) quad(B, [x0, y, z1], [x1, y, z1], [x1, y, z0], [x0, y, z0], [0, 1, 0], 0, x1 - x0, R, R2); };
  if (M.notch) {
    const n = M.notch, k = M.nk;
    roof(L.x0, L.x1, L.z0 + n, L.z1 - n, H); roof(L.x0 + n * k[3], L.x1 - n * k[0], L.z1 - n, L.z1, H); roof(L.x0 + n * k[2], L.x1 - n * k[1], L.z0, L.z0 + n, H);
    for (const [i, x0, z0] of [[0, L.x1 - n, L.z1 - n], [1, L.x1 - n, L.z0], [2, L.x0, L.z0], [3, L.x0, L.z1 - n]]) if (k[i]) roof(x0, x0 + n, z0, z0 + n, M.yp);
  } else roof(L.x0, L.x1, L.z0, L.z1, H);
  massGeo(B, L, det);
}

// ─── 量體的凸出部分（遠近都建）：凸窗、壁柱、樓板帶 ───
function massGeo(B, L, det) {
  const M = L.mass, st = L.style, H = L.h, flag = L.isle ? 1 : 0, fh = facFh(st), ws = facWs(st);
  const F = facFace(M.front, L.x0, L.x1, L.z0, L.z1), stone = [L.seed, 7, 1, 0], S2 = [0, 1, H, flag + 2];
  for (const b of M.bays) {
    const Fb = facSub(F, b.u0, b.u1, b.d), A = [L.seed, st, Fb.w, 0], A2 = [0, 1, H, flag], SJ = [L.seed, st, b.d, 0];
    if (det) facHoles(B, Fb, A, A2, st, H, b.y0, b.y1, .16, null); else fvq(B, Fb, 0, Fb.w, 0, b.y0, b.y1, A, A2);
    fsq(B, F, b.u0, 0, b.d, b.y0, b.y1, -1, SJ, S2); fsq(B, F, b.u1, 0, b.d, b.y0, b.y1, 1, SJ, S2);
    fhq(B, F, b.u0, b.u1, 0, b.d, b.y0, false, stone, S2);
    // 托座（兩段往下收）與壓頂（出挑的簷）
    fbx(B, F, b.u0 + .08, b.u1 - .08, 0, b.d - .04, b.y0 - .2, b.y0, stone, S2, stone, S2, false);
    fbx(B, F, b.u0 + .35, b.u1 - .35, 0, b.d * .55, b.y0 - .38, b.y0 - .2, stone, S2, stone, S2, false);
    fbx(B, F, b.u0 - .08, b.u1 + .08, 0, b.d + .1, b.y1, b.y1 + .22, stone, S2, stone, S2);
  }
  if (st !== 2 && st !== 4) return;
  const rear = FAC_REAR[M.front];
  for (const w of facWalls(L)) {
    if (!w.key || w.key === rear) continue;
    const Fw = w.F, cov = facCover(L, w.key), A = [L.seed, st, Fw.w, 0], A2 = [0, 1, H, flag], SJ = [L.seed, st, .2, 0];
    if (st === 2) {   // 石造廠房樓：開間之間的壁柱，轉角的那根包到角上
      const cols = facCols(Fw.w, ws), mg = (Fw.w - cols * ws) / 2, y0 = Math.max(FAC_GH, cov + .2), y1 = H - .55;
      if (y1 - y0 < 2) continue;
      for (let c = 0; c <= cols; c++) {
        const u0 = c === 0 ? 0 : mg + c * ws - .28, u1 = c === cols ? Fw.w : mg + c * ws + .28;
        fbx(B, Fw, u0, u1, 0, .2, y0, y1, A, A2, SJ, S2, false);
      }
    } else {          // 翻新灰泥樓：每層一道樓板帶（正面照舊畫 LED 線）
      const nF = facNF(H, st);
      for (let fi = 1; fi < nF; fi++) {
        const yf = FAC_GH + fi * fh;
        if (yf > cov + .3) fbx(B, Fw, 0, Fw.w, 0, .1, yf - .12, yf + .14, A, A2, stone, S2);
      }
    }
  }
}
