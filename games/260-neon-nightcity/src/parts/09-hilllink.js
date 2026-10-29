// ═══ 別墅區的山路互相接起來、多開幾條下到城裡的路（使用者：開叉路把三個山區串起來、多開路接地面的路；「不用尋找，直接剷平重建」）：
// 10-city.js 開完外緣的山路之後呼叫 hillLinks(roads, ok, edgeR)，回傳要加進 roads 的路。不找路：兩點之間拉直線（被公園、城寨、海擋住才試一個往旁邊推的彎點），
// 縱斷面貼著地形、每段夾在 11% 以內，其餘交給 HILL.carveH 挖平、填起來（挖方 ≤ 130 m、填方 ≤ 45 m；超過 40 m 寬的由 hillLinkCarve 加寬）。離城寨只留 60 m（一般山路 90 m；城寨的地形在平台外 46＋4 m 內由 21-coast.js 的 hillEnc 接手，路的挖填在那裡不算）。不用亂數。
// · 連絡路（link = 1）：一般山路照路口方位角排好，相鄰兩條（含跨區的）各接一條；兩端是那兩條路上的點的複本（T 字路口），半路撞到別的路就改接那條。不蓋房子、不立速限、不算城邊的路口。
// · 下山路（link = 1、mouth = 1）：城裡靠外緣的路網節點，往外對到外緣上一點當路口（離別的路口 90 m 以上、外面 60 m 是山），直線接到最近、坡度夠的山路點。
//   路口在 HILL.mouths 裡（29-villa.js 在外緣的牆開口），不蓋房子（不動 r2 的房子配置）═══
function hillLinks(roads, ok, edgeR) {
  const G = 8, ST = 8, GR = .11, out = [], stat = { link: 0, spur: 0, fail: [] }, [cx, cz] = CITY_C, all = () => roads.concat(out);
  const hRaw = (x, z) => { const h = hillMeshH(x, z); return Number.isFinite(h) ? h : NaN; };
  // 折線（A、引道、彎點、引道、B）圓滑後每 8 m 取一點（Chaikin 不動兩端，第一段、最後一段的方向不變）
  const line = Ps => {
    let P = Ps; const A = P[0], B = P[P.length - 1];
    if (P.length > 2) for (let r = 0; r < 3; r++) { const Q = [P[0]]; for (let k = 0; k + 1 < P.length; k++) { const p = P[k], q = P[k + 1]; if (k) Q.push([p[0] * .75 + q[0] * .25, p[1] * .75 + q[1] * .25]); if (k + 2 < P.length) Q.push([p[0] * .25 + q[0] * .75, p[1] * .25 + q[1] * .75]); } Q.push(P[P.length - 1]); P = Q; }
    const S = [[A[0], A[1]]]; let acc = 0;
    for (let k = 1; k < P.length; k++) { let px = P[k - 1][0], pz = P[k - 1][1]; const qx = P[k][0], qz = P[k][1]; let l = Math.hypot(qx - px, qz - pz); while (acc + l >= ST) { const t = (ST - acc) / l; px += (qx - px) * t; pz += (qz - pz) * t; S.push([px, pz]); l = Math.hypot(qx - px, qz - pz); acc = 0; } acc += l; }
    if (Math.hypot(S[S.length - 1][0] - B[0], S[S.length - 1][1] - B[1]) < 2) S.pop();
    S.push([B[0], B[1]]); return S;
  };
  // 一條路：S 的縱斷面貼地形、每段坡度 ≤ 11%，兩端高 ya、yb；mouth 的話頭幾點在城邊（不查離外緣的距離）。不行就回傳原因字串
  let hit = null, ex = new Set();   // hit：build 撞到的別的路上的點（連絡路就改接它）；ex：兩端接上的那條路前後 5 點（引道垂直離開，只要離它們 11 m，別的路 18 m）
  const around = q => { for (const P of all()) { const k = P.indexOf(q); if (k >= 0) { const s = P.slice(Math.max(0, k - 5), k + 6); s.c = k - Math.max(0, k - 5); return s; } } return []; };
  // 兩端前三段（24 m：路口與引道的彎）坡度 ≤ 5%：路口內（RC 範圍）路面高度歸主路、急彎內側投影到別段，坡度大的話車會浮起來或陷下去
  const GE = .05, GL = 3 * G, env = s => s <= GL ? GE * s : GE * GL + GR * (s - GL);
  const build = (S, ya, yb, mouth) => {
    const n = S.length, sL = [0]; for (let k = 1; k < n; k++) sL.push(sL[k - 1] + Math.hypot(S[k][0] - S[k - 1][0], S[k][1] - S[k - 1][1]));
    const len = sL[n - 1]; if (n < 4 || Math.abs(yb - ya) > env(len / 2) * 2) return 'grade';
    const A = S[0], B = S[n - 1], others = [];
    for (const P of all()) for (const p of P) others.push(p);
    const Y = [], cutM = [];
    for (let k = 0; k < n; k++) {
      const [x, z] = S[k];
      if (k && k < n - 1) {
        if (!ok(x, z, 60)) return 'ok';
        if ((!mouth || k > 3) && polyDistPt(CITY_POLY, x, z) < 10) return 'edge';
        if (sL[k] > 8 && len - sL[k] > 8) for (const p of others) if (Math.abs(p[0] - x) < 18 && Math.abs(p[1] - z) < 18 && Math.hypot(p[0] - x, p[1] - z) < (ex.has(p) ? 11 : 18)) { hit = ex.has(p) ? null : p; return 'close'; }
      }
      const h = hRaw(x, z); Y.push(Number.isFinite(h) ? h : ya + (yb - ya) * sL[k] / len);
    }
    Y[0] = ya; Y[n - 1] = yb;
    for (let k = 1; k < n - 1; k++) Y[k] = clamp(Y[k], Math.max(ya - env(sL[k]), yb - env(len - sL[k])), Math.min(ya + env(sL[k]), yb + env(len - sL[k])));
    // 第 k 段（k−1 → k）的坡度上限：兩端前三段 5%；轉彎（前後段夾角 > 3°）的段 6%（彎內側的車投影到段的端點，坡度大的話差最多半段 × 坡度）
    const turn = k => { if (k < 1 || k > n - 2) return 0; const a = Math.atan2(S[k][1] - S[k - 1][1], S[k][0] - S[k - 1][0]), b = Math.atan2(S[k + 1][1] - S[k][1], S[k + 1][0] - S[k][0]); return Math.abs(Math.atan2(Math.sin(b - a), Math.cos(b - a))); };
    const gk = k => sL[k] <= GL || len - sL[k - 1] <= GL ? GE : Math.max(turn(k - 1), turn(k)) > .05 ? .06 : GR;
    for (let k = 1; k < n - 1; k++) { const m = gk(k) * (sL[k] - sL[k - 1]); Y[k] = clamp(Y[k], Y[k - 1] - m, Y[k - 1] + m); }   // 兩端的點不動（掃描改了再設回去，最後一段就會超過上限）
    for (let k = n - 2; k >= 1; k--) { const m = gk(k + 1) * (sL[k + 1] - sL[k]); Y[k] = clamp(Y[k], Y[k + 1] - m, Y[k + 1] + m); }
    Y[0] = ya; Y[n - 1] = yb;
    // 挖填量：挖方 ≤ 170 m（東北區接東區要剷過一道 110 m 以上的山脊）、填方 ≤ 45 m（超過 carveH 的 40 m 寬的那幾段由下面的 hillLinkCarve 加寬，斜坡一路接回原本的山坡）
    let cut = 0; for (let k = 0; k < n; k++) { const h = hRaw(S[k][0], S[k][1]); if (!Number.isFinite(h)) continue; if (h - Y[k] > 170) return 'cut'; if (Y[k] - h > 45) return 'fill'; cut += Math.abs(h - Y[k]); }
    for (let k = 1; k < n; k++) if (Math.abs(Y[k] - Y[k - 1]) > (gk(k) === GE ? GE + .005 : .12) * (sL[k] - sL[k - 1]) + 1e-6) return 'steep';   // 兩端與彎道的上限擠在一起時，兩趟掃描不一定都滿足
    const L = S.map(([x, z], k) => [x, z, Y[k]]); L.cost = len + cut / n * 6; L.cut = cut / n; return L;
  };
  // 直線，或往兩側推 20%–80% 的彎點（繞過公園、城寨）；能開的裡面挑長度＋平均挖填最小的
  const tryPair = (A, B, ya, yb, mouth) => {
    const sa = around(A), sb = around(B); ex = new Set([...sa, ...sb]);
    // 兩端先垂直離開那條路 14 m 再轉過去（T 字路口）：貼著路斜斜接過去的話，最後幾十公尺兩條路並排、高度不同，挖填互相蓋掉，車會浮起來
    const lead = (seg, P, Q) => { if (seg.length < 2) return null; const a = seg[Math.max(0, seg.c - 1)], b = seg[Math.min(seg.length - 1, seg.c + 1)], L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, nx = -(b[1] - a[1]) / L, nz = (b[0] - a[0]) / L, s = nx * (Q[0] - P[0]) + nz * (Q[1] - P[1]) > 0 ? 1 : -1; return [P[0] + nx * s * 14, P[1] + nz * s * 14]; };
    const LA = lead(sa, A, B), LB = lead(sb, B, A);
    const cosT = (seg, ux, uz) => { if (seg.length < 2) return 0; const a = seg[Math.max(0, seg.c - 1)], b = seg[Math.min(seg.length - 1, seg.c + 1)], L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return Math.abs(((b[0] - a[0]) * ux + (b[1] - a[1]) * uz) / L); };   // 接點那一點的切線
    const d = Math.hypot(B[0] - A[0], B[1] - A[1]), mx = (A[0] + B[0]) / 2, mz = (A[1] + B[1]) / 2, nx = -(B[1] - A[1]) / d, nz = (B[0] - A[0]) / d;
    let best = null, why = 'none';
    for (const f of [0, .2, -.2, .4, -.4, .6, -.6, .8, -.8]) {
      const S0 = line([A, LA, f ? [mx + nx * d * f, mz + nz * d * f] : null, LB, B].filter(Boolean)), m = S0.length, q0 = S0[Math.min(1, m - 1)], q1 = S0[Math.max(0, m - 2)];
      const la = Math.hypot(q0[0] - A[0], q0[1] - A[1]) || 1, lb = Math.hypot(B[0] - q1[0], B[1] - q1[1]) || 1;
      if (cosT(sa, (q0[0] - A[0]) / la, (q0[1] - A[1]) / la) > .5 || cosT(sb, (B[0] - q1[0]) / lb, (B[1] - q1[1]) / lb) > .5) { why = 'angle'; continue; }
      const r = build(S0, ya, yb, mouth);
      if (typeof r === 'string') { why = r; continue; }
      if (!best || r.cost < best.cost) best = r;
      if (!f || Math.abs(f) >= .4) break;   // 直線能開就用直線；彎點從小的試起
    }
    return best || why;
  };
  // ─── 連絡路 ───
  const V = roads.filter(p => !p.akina && p.length >= 12).map(P => ({ P, a: Math.atan2(P[0][1] - cz, P[0][0] - cx) })).sort((p, q) => p.a - q.a);
  const joined = (P, Q) => { const e = P[P.length - 1]; return P.tee && Q.some(q => q[0] === e[0] && q[1] === e[1]); };
  for (let u = 0; u < V.length; u++) {
    const P = V[u].P, Q = V[(u + 1) % V.length].P;
    if (P === Q || joined(P, Q) || joined(Q, P)) continue;
    const cand = [];
    for (let i = 4; i < P.length; i += 2) for (let j = 4; j < Q.length; j += 2) {
      const a = P[i], b = Q[j], d = Math.hypot(a[0] - b[0], a[1] - b[1]), dy = Math.abs(a[2] - b[2]);
      if (d >= 40 && d <= 900 && dy <= d * .1) cand.push([d + dy * 4, i, j]);
    }
    cand.sort((p, q) => p[0] - q[0]);
    let got = null, why = 'none';
    const used = [];
    for (const [, i, j] of cand) {
      if (used.some(([a, b]) => Math.abs(a - i) < 8 && Math.abs(b - j) < 8)) continue;
      if (used.push([i, j]) > 40) break;
      let E = Q[j]; hit = null;
      let r = tryPair(P[i], E, P[i][2], E[2], false);
      // 半路撞到別的路：高差允許的話就接到那條路上（T 字路口，它再往下接）
      if (r === 'close' && hit && Math.hypot(hit[0] - P[i][0], hit[1] - P[i][1]) >= 40 && Math.abs(hit[2] - P[i][2]) <= Math.hypot(hit[0] - P[i][0], hit[1] - P[i][1]) * .1) { E = hit; r = tryPair(P[i], E, P[i][2], E[2], false); }
      if (typeof r !== 'string') { got = r; got[0] = [P[i][0], P[i][1], P[i][2]]; got[got.length - 1] = [E[0], E[1], E[2]]; break; }
      why = r;
    }
    if (got) { got.link = 1; got.tee = 1; out.push(got); stat.link++; } else stat.fail.push(['link', Math.round(V[u].a * 57.3), Math.round(V[(u + 1) % V.length].a * 57.3), why, cand.length]);
  }
  // ─── 下山路：城裡靠外緣的路網節點 → 外緣上的路口 → 最近、坡度夠的山路點 ───
  const mouths = roads.filter(p => !p.link).map(p => p[0]);
  const ends = [];   // 一般山路（含剛開的連絡路）上可以接的點
  for (const P of all()) if (!P.akina) for (let k = P.link ? 1 : 5; k < P.length - 1; k++) ends.push(P[k]);
  const sg = stat.sg = { nodes: 0, mouth: 0, hill: 0, none: 0 }, nodes = RN.nodes.filter(n => !n.free && polyDistPt(CITY_POLY, n.x, n.z) < 120).map(n => ({ n, a: Math.atan2(n.z - cz, n.x - cx) })).sort((p, q) => p.a - q.a);
  for (const { a } of nodes) {
    const R0 = edgeR(a) + 1, ux = Math.cos(a), uz = Math.sin(a), M = [cx + ux * R0, cz + uz * R0];
    sg.nodes++;
    if (mouths.some(m => Math.hypot(m[0] - M[0], m[1] - M[1]) < 90)) { sg.mouth++; continue; }
    if (!ok(cx + ux * (R0 + 60), cz + uz * (R0 + 60), 60) || !(hRaw(cx + ux * (R0 + 60), cz + uz * (R0 + 60)) >= 6)) { sg.hill++; continue; }
    const hm = hRaw(M[0], M[1]), ya = Number.isFinite(hm) ? Math.min(hm, .3) : .3;
    // 往外的半平面裡、距離 50–450 m、坡度允許的山路點，近的先試（最多 4 個）
    const T = ends.map(p => [Math.hypot(p[0] - M[0], p[1] - M[1]), p]).filter(([d, p]) => d >= 50 && d <= 450 && (p[0] - M[0]) * ux + (p[1] - M[1]) * uz > d * .3 && Math.abs(p[2] - ya) <= d * .095).sort((p, q) => p[0] - q[0]);
    let got = null, why = 'none';
    for (let t = 0; t < T.length && t < 4; t++) {
      const p = T[t][1], r = tryPair(M, p, ya, p[2], true);
      if (typeof r !== 'string') { got = r; got[got.length - 1] = [p[0], p[1], p[2]]; break; }
      why = r;
    }
    if (got) { got.link = 1; got.mouth = 1; got.tee = 1; out.push(got); mouths.push(M); stat.spur++; for (let k = 1; k < got.length - 1; k++) ends.push(got[k]); }
    else if (T.length) stat.fail.push(['spur', Math.round(a * 57.3), why, T.length]); else sg.none++;
  }
  roads.links = stat;   // __nc.hillRoads().links
  return out;
}

// ═══ 連絡路深挖、高填的路段：10-city.js 的 HILL.carveH 只改路兩側 CW（40 m），挖方 50 m 以上、填方 27 m 以上的地方會剩一道直立的斷崖。
// 這裡把 HILL.carveH／carveHit 包一層：那幾段照需要的寬度（路肩外 RC 起、挖方 CUT:1、填方 FILL:1，接回原本的山坡為止再多 6 m）另外挖、填。
// 其他路的挖填不變（寬度在 CW 以內的段不處理）═══
function hillLinkCarve(roads, RC, CUT, FILL, CW, roadD) {
  const W = [];
  for (const P of roads) if (P.link) for (let k = 0; k + 1 < P.length; k++) {
    const A = P[k], B = P[k + 1]; let w = 0;
    for (const p of [A, B]) { const h = hillMeshRaw(p[0], p[1]); if (Number.isFinite(h)) w = Math.max(w, RC + (h > p[2] ? (h - p[2]) / CUT : (p[2] - h) / FILL) + 6); }
    if (w > CW) W.push([A[0], A[1], A[2], B[0], B[1], B[2], w, Math.min(A[0], B[0]) - w, Math.max(A[0], B[0]) + w, Math.min(A[1], B[1]) - w, Math.max(A[1], B[1]) + w]);
  }
  HILL.linkWide = W.length;
  if (!W.length) return;
  const each = (X, Z, fn) => { for (const S of W) { if (X < S[7] || X > S[8] || Z < S[9] || Z > S[10]) continue; const [ax, az, ay, bx, bz, by, w] = S, ex = bx - ax, ez = bz - az, t = clamp(((X - ax) * ex + (Z - az) * ez) / (ex * ex + ez * ez || 1), 0, 1), d = Math.hypot(X - ax - ex * t, Z - az - ez * t); if (d < w) fn(d, ay + (by - ay) * t); } };
  const base = HILL.carveH, hit = HILL.carveHit;
  HILL.carveH = (X, Z, h) => {
    let hc = base(X, Z, h), lo = Infinity, hi = -Infinity, near = Infinity, yr = 0;
    if (roadD(X, Z) <= RC) return hc;   // 路面（任何一條路的 RC 內）照原本的：加寬的挖方斜坡罩到別的路上會把那條路面挖低（車就浮起來）
    each(X, Z, (d, y) => { if (d < near) { near = d; yr = y; } if (h > y) lo = Math.min(lo, y + Math.max(0, d - RC) * CUT); else hi = Math.max(hi, y - Math.max(0, d - RC) * FILL); });
    if (near <= RC) return yr;
    if (lo < Infinity) hc = Math.min(hc, lo);
    if (hi > -Infinity) hc = Math.max(hc, hi);
    return hc;
  };
  HILL.carveHit = P3 => {
    if (hit(P3)) return true;
    for (const S of W) for (const t of [0, .5, 1]) if (triDist(P3, S[0] + (S[3] - S[0]) * t, S[1] + (S[4] - S[1]) * t) < S[6]) return true;
    return false;
  };
}
