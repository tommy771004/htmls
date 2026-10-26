// ═══ 天樞島的填空樓：島上四片轉的角度不同，片與片之間留下三角形、梯形的空地。沿著空地裡的連接道路與片的邊界路兩側蓋臨街的樓（世界座標），
// 正面順著彎路，空地就成了曼哈頓下城那種斜街夾出來的楔形街廓。每棟是一個四邊形地塊（前緣兩點在路邊、側邊沿路的法線往後拉），
// 相鄰的樓共用側邊；地塊裡 1.5 m 取一點，碰到路、片的街區、濱水步道、尖端的公園（ISLE_PARK）或別棟就縮淺，再不行就留空（巷子、口袋廣場）。
// 立面用 10-city.js 的 MAT_FACADE（quad，前緣那面一樓是店面），磚石樓的簷口、腰線與 isleTower 一樣的退台；碰撞盒在 cityWorld() 時加（每 ≤ 12 m 一段的外接盒）；
// 陰影高度圖在 22-hmap.js 畫；20-props.js 的縫中步道、涼亭與草地上的樹避開（isleFillNear）。亂數自己一條，前面的序列不變 ───
const ISLE_FILL = [];
const ISLE_TIP = ISLE_P[38], ISLE_PARK_R = 130;   // 尖端（04-layout.js 的 TIP 朝 75°，ISLE_POLY 每 2° 一點）與公園的範圍
const ISLE_BB = (() => { const xs = ISLE_P.map(p => p[0]), zs = ISLE_P.map(p => p[1]); return [Math.min(...xs) - 10, Math.max(...xs) + 10, Math.min(...zs) - 10, Math.max(...zs) + 10]; })();
const ISLE_G = 2, ISLE_NX = Math.ceil((ISLE_BB[1] - ISLE_BB[0]) / ISLE_G), ISLE_NZ = Math.ceil((ISLE_BB[3] - ISLE_BB[2]) / ISLE_G);
// 每格 0 空、1 不能蓋（路、街區、岸邊、公園）、2 已經有樓
const isleMask = new Uint8Array(ISLE_NX * ISLE_NZ);
const isleCell = (x, z) => { const i = Math.floor((x - ISLE_BB[0]) / ISLE_G), j = Math.floor((z - ISLE_BB[2]) / ISLE_G); return i < 0 || j < 0 || i >= ISLE_NX || j >= ISLE_NZ ? -1 : j * ISLE_NX + i; };
const isleFillNear = (x, z, r = 0) => {
  if (x < ISLE_BB[0] - r || x > ISLE_BB[1] + r || z < ISLE_BB[2] - r || z > ISLE_BB[3] + r) return false;
  for (let dz = -r; dz <= r; dz += ISLE_G) for (let dx = -r; dx <= r; dx += ISLE_G) { const k = isleCell(x + dx, z + dz); if (k >= 0 && isleMask[k] === 2) return true; }
  return false;
};
if (ZONES.some(z => z.isle)) {
  const t0 = performance.now(), R = rng(20261027), FO = HR + SW + .3;
  const mark = (x0, x1, z0, z1, f) => {
    const i0 = Math.max(0, Math.floor((x0 - ISLE_BB[0]) / ISLE_G)), i1 = Math.min(ISLE_NX - 1, Math.floor((x1 - ISLE_BB[0]) / ISLE_G));
    const j0 = Math.max(0, Math.floor((z0 - ISLE_BB[2]) / ISLE_G)), j1 = Math.min(ISLE_NZ - 1, Math.floor((z1 - ISLE_BB[2]) / ISLE_G));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) if (f(ISLE_BB[0] + (i + .5) * ISLE_G, ISLE_BB[2] + (j + .5) * ISLE_G)) isleMask[j * ISLE_NX + i] = 1;
  };
  // 島外、離岸 20 m 內（濱水步道與擋牆）、尖端的公園
  for (let j = 0; j < ISLE_NZ; j++) for (let i = 0; i < ISLE_NX; i++) {
    const x = ISLE_BB[0] + (i + .5) * ISLE_G, z = ISLE_BB[2] + (j + .5) * ISLE_G;
    if (!inPoly(ISLE_P, x, z) || Math.hypot(x - ISLE_TIP[0], z - ISLE_TIP[1]) < ISLE_PARK_R || polyDistPt(ISLE_P, x, z) < 20) isleMask[j * ISLE_NX + i] = 1;
  }
  // 片的街區（含人行道，外加 1 m）
  for (const b of blocks) if (b.isle) {
    const Q = polyInset(rectW(b.x0, b.x1, b.z0, b.z1), [-1, -1, -1, -1]), xs = Q.map(p => p[0]), zs = Q.map(p => p[1]);
    mark(Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs), (x, z) => inPoly(Q, x, z));
  }
  // 路：路中心線兩側到人行道外緣（快速道路是橋面外 4 m，橋墩與匝道都在裡面）
  const inBB = (x, z, r) => x > ISLE_BB[0] - r && x < ISLE_BB[1] + r && z > ISLE_BB[2] - r && z < ISLE_BB[3] + r;
  const roadsHere = RN.edges.filter(e => e.pts.some(([x, z]) => inBB(x, z, 60)));
  for (const e of roadsHere) {
    const r = e.kind === 'f' ? (e.dw || DECK_W) + 4 : (e.hw || HR) + SW;
    for (let k = 1; k < e.pts.length; k++) {
      const [ax, az] = e.pts[k - 1], [bx, bz] = e.pts[k], ex = bx - ax, ez = bz - az, l2 = ex * ex + ez * ez || 1;
      mark(Math.min(ax, bx) - r, Math.max(ax, bx) + r, Math.min(az, bz) - r, Math.max(az, bz) + r, (x, z) => {
        const t = Math.max(0, Math.min(1, ((x - ax) * ex + (z - az) * ez) / l2));
        return (x - ax - ex * t) ** 2 + (z - az - ez * t) ** 2 < r * r;
      });
    }
  }
  // 地段：靠北的片（MA）是五到十四層的廠房樓，其他是金融區的辦公樓與高樓
  const isleBlocks = blocks.filter(b => b.isle).map(b => { const [x, z] = toW((b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2); return { x, z, kind: ISLE_KIND[b.isle] }; });
  const kindAt = (x, z) => { let best = null, d = 1e18; for (const o of isleBlocks) { const q = (o.x - x) ** 2 + (o.z - z) ** 2; if (q < d) { d = q; best = o.kind; } } return best || 'fin'; };
  const quadOK = (F0, F1, B1, B0) => {
    const l = Math.max(Math.hypot(F1[0] - F0[0], F1[1] - F0[1]), Math.hypot(B1[0] - B0[0], B1[1] - B0[1])), d = Math.max(Math.hypot(B0[0] - F0[0], B0[1] - F0[1]), Math.hypot(B1[0] - F1[0], B1[1] - F1[1]));
    const ns = Math.max(2, Math.ceil(l / 1.5)), nt = Math.max(2, Math.ceil(d / 1.5));
    for (let a = 0; a <= ns; a++) for (let c = 0; c <= nt; c++) {
      const s = a / ns, t = c / nt, x = (1 - t) * ((1 - s) * F0[0] + s * F1[0]) + t * ((1 - s) * B0[0] + s * B1[0]), z = (1 - t) * ((1 - s) * F0[1] + s * F1[1]) + t * ((1 - s) * B0[1] + s * B1[1]);
      const k = isleCell(x, z); if (k < 0 || isleMask[k]) return false;
    }
    return true;
  };
  const claim = P => {
    const xs = P.map(p => p[0]), zs = P.map(p => p[1]);
    const i0 = Math.floor((Math.min(...xs) - ISLE_BB[0]) / ISLE_G), i1 = Math.floor((Math.max(...xs) - ISLE_BB[0]) / ISLE_G), j0 = Math.floor((Math.min(...zs) - ISLE_BB[2]) / ISLE_G), j1 = Math.floor((Math.max(...zs) - ISLE_BB[2]) / ISLE_G);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) if (inPoly(P, ISLE_BB[0] + (i + .5) * ISLE_G, ISLE_BB[2] + (j + .5) * ISLE_G)) isleMask[j * ISLE_NX + i] = 2;
  };
  const sideAt = (e, u, s) => { const [x, z, dx, dz] = edgeAt(e, Math.max(.01, Math.min(e.len - .01, u))), nx = dz * s, nz = -dx * s; return [x + nx * FO, z + nz * FO, nx, nz]; };
  // 先排長的路（連接道路的彎路先挑地），每條路兩側從路口範圍外開始一塊塊往前
  const order = roadsHere.filter(e => e.kind !== 'f' && !e.ramp && !e.bridge).sort((a, b) => b.len - a.len);
  for (const e of order) for (const s of [-1, 1]) {
    let u = HR + 4;
    while (u < e.len - HR - 4) {
      let w = 11 + R() * 15;
      if (e.len - HR - 4 - (u + w) < 9) w = e.len - HR - 4 - u;
      if (w < 9) break;
      const a = sideAt(e, u, s), b = sideAt(e, u + w, s), F0 = [a[0], a[1]], F1 = [b[0], b[1]];
      const kind = kindAt((a[0] + b[0]) / 2, (a[1] + b[1]) / 2), deep = 16 + R() * (kind === 'loft' ? 12 : 22);
      for (const d of [deep, deep * .72, 11]) {
        const B0 = [F0[0] + a[2] * d, F0[1] + a[3] * d], B1 = [F1[0] + b[2] * d, F1[1] + b[3] * d];
        if (!quadOK(F0, F1, B1, B0)) continue;
        // 排成和 boxFaces 同一個方向（polyArea < 0，isleWalls 算的法線朝外），記下前緣是哪一條邊
        const P = [F0, F1, B1, B0], ccw = polyArea(P) < 0, Q = ccw ? P : [B0, B1, F1, F0];
        claim(Q);
        ISLE_FILL.push({ P: Q, front: ccw ? 0 : 2, w, d, kind, e, s, u0: u, u1: u + w, seed: R() * 1000, r: R(), r2: R(), r3: R() });
        break;
      }
      u += w;
    }
  }
  // 高度與樣式：廠房區五到十四層（偶爾一棟 20 層以上），金融區 8–35 層、寬深都夠的地塊有三成蓋退台高樓
  for (const f of ISLE_FILL) {
    const big = f.w > 19 && f.d > 22;
    f.cx = f.P.reduce((a, p) => a + p[0], 0) / 4; f.cz = f.P.reduce((a, p) => a + p[1], 0) / 4;
    if (f.kind === 'loft') {
      f.style = f.r < .45 ? 2 : f.r < .9 ? 0 : 1; f.fh = f.style === 2 ? 3.9 : 3.4;
      const fl = f.r2 < .12 && big ? 18 + Math.floor(f.r3 * 10) : 5 + Math.floor(f.r3 * 10);
      f.h = 4.6 + fl * f.fh + .7;
    } else {
      f.style = f.r < .38 ? 2 : f.r < .72 ? 3 : f.r < .9 ? 0 : 4; f.fh = f.style === 3 ? 3.7 : f.style === 2 ? 3.6 : 3.4;
      const fl = 8 + Math.floor(f.r3 * 28);
      f.h = 4.6 + fl * f.fh + .7;
      if (big && f.r2 < .3) f.h = 80 + f.r3 * 90;
    }
    // 退台：高過 45 m 的每 25–40 m 往裡退 2–3.5 m（玻璃樓只退一次當機房層）
    f.tiers = [];
    if (f.h > 45) {
      let y = f.h * (f.style === 3 ? .82 : .55 + f.r2 * .15), ins = 0, P = f.P;
      const top = f.h; f.h = y;
      for (let k = 0; k < (f.style === 3 ? 1 : 4) && y < top - 1; k++) {
        ins += 2 + (f.r3 * 7 + k) % 1.5;
        const Q = polyInset(f.P, [ins, ins, ins, ins]);
        if (Math.abs(polyArea(Q)) < 60 || Q.some((p, i) => Math.hypot(p[0] - Q[(i + 1) % 4][0], p[1] - Q[(i + 1) % 4][1]) < 5)) break;
        const y1 = f.style === 3 ? top : Math.min(top, y + (top - f.h) / 3 * (k ? .8 : 1.2));
        f.tiers.push({ P: Q, y: y1, st: f.style }); y = y1; P = Q;
      }
      if (!f.tiers.length) f.h = top;
    }
    f.htop = Math.max(f.h, ...f.tiers.map(t => t.y));
  }
  if (location.search.includes('isleLog')) console.log(`天樞島填空樓 ${ISLE_FILL.length} 棟 · ${(performance.now() - t0).toFixed(0)} ms`);
}
// 立面：每條邊一面牆（quad 的 u 從面向觀看者的左邊算起），頂一片；前緣那面一樓是店面
function isleWalls(B, P, y0, y1, seed, style, h, front, roof = true) {
  for (let k = 0; k < P.length; k++) {
    const a = P[k], b = P[(k + 1) % P.length], ex = b[0] - a[0], ez = b[1] - a[1], l = Math.hypot(ex, ez) || 1;
    const shop = k === front ? 1 : 0, units = Math.max(1, Math.round(l / 6.5));
    let mask = 0; if (shop) for (let u = 0; u < units; u++) if (((seed * 7.3 + u * 3.1) % 1) < .28) mask |= 1 << u;
    quad(B, [a[0], y0, a[1]], [b[0], y0, b[1]], [b[0], y1, b[1]], [a[0], y1, a[1]], [-ez / l, 0, ex / l], 0, l, [seed, style, l, shop], [mask, units, h, 0]);
  }
  if (roof) quad(B, [P[0][0], y1, P[0][1]], [P[1][0], y1, P[1][1]], [P[2][0], y1, P[2][1]], [P[3][0], y1, P[3][1]], [0, 1, 0], 0, Math.hypot(P[1][0] - P[0][0], P[1][1] - P[0][1]), [seed, style, 10, 0], [0, 1, h, 0]);
}
{
  const bufs = new Map();
  for (const f of ISLE_FILL) {
    const key = `${Math.floor(f.cx / 120)},${Math.floor(f.cz / 120)}`;
    if (!bufs.has(key)) bufs.set(key, { p: [], n: [], uv: [], b: [], b2: [], idx: [], zn: null });
    const B = bufs.get(key);
    isleWalls(B, f.P, 0, f.h, f.seed, f.style, f.h, f.front);
    if (f.style !== 3) {   // 簷口與一樓頂的腰線
      isleWalls(B, polyInset(f.P, [-.35, -.35, -.35, -.35]), f.h - .55, f.h + .06, f.seed, 7, f.h, -1);
      isleWalls(B, polyInset(f.P, [-.18, -.18, -.18, -.18]), 4.45, 4.75, f.seed, 7, f.h, -1, false);
    }
    let y0 = f.h;
    for (const [k, t] of f.tiers.entries()) {
      isleWalls(B, t.P, y0, t.y, f.seed + k + 1, t.st, t.y, -1);
      if (t.st !== 3) isleWalls(B, polyInset(t.P, [-.3, -.3, -.3, -.3]), t.y - .45, t.y + .06, f.seed, 7, t.y, -1);
      y0 = t.y;
    }
  }
  for (const B of bufs.values()) chunkMesh(B);
}
// 人行道：每棟樓前緣到路緣（路中心外 HR）鋪一條，和片裡的人行道同一個材質；aL 給一個不會碰到路緣石紋路的座標（WALK_FS 照方格畫路緣石）
{
  const P = [], N = [], AL = [], I = [];
  for (const f of ISLE_FILL) {
    const n = Math.max(2, Math.ceil((f.u1 - f.u0) / 3)), base = P.length / 3;
    for (let k = 0; k <= n; k++) {
      const u = f.u0 + (f.u1 - f.u0) * k / n, [x, z, dx, dz] = edgeAt(f.e, Math.max(.01, Math.min(f.e.len - .01, u))), nx = dz * f.s, nz = -dx * f.s;
      for (const o of [HR + .05, HR + SW + .3]) { P.push(x + nx * o, .02, z + nz * o); N.push(0, 1, 0); AL.push(X0 + 20 + o - HR, Z0 + 10 + u % 40, nx, nz); }
    }
    for (let k = 0; k < n; k++) { const a = base + k * 2; I.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  }
  if (I.length) {
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(N, 3)); g.setAttribute('aL', new T.Float32BufferAttribute(AL, 4)); g.setIndex(I);
    const m = new T.Mesh(g, new T.ShaderMaterial({ uniforms: { ...shared(ALLU), ...reflU }, vertexShader: GROUND_VS, fragmentShader: WALK_FS, side: T.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
    groundAdd(m, null);
  }
}
// 碰撞：沿前緣每 ≤ 12 m 一段，每段在自己的座標框（x 沿前緣）裡取四角的外接盒；退台在底座裡面，不另外加
worldHooks.push(() => {
  for (const f of ISLE_FILL) {
    const [F0, F1, B1, B0] = f.front === 0 ? f.P : [f.P[3], f.P[2], f.P[1], f.P[0]], n = Math.max(1, Math.ceil(f.w / 12));
    const lerp2 = (p, q, t) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
    for (let k = 0; k < n; k++) {
      const a = lerp2(F0, F1, k / n), b = lerp2(F0, F1, (k + 1) / n), c = lerp2(B0, B1, (k + 1) / n), d = lerp2(B0, B1, k / n);
      const cx = (a[0] + b[0] + c[0] + d[0]) / 4, cz = (a[1] + b[1] + c[1] + d[1]) / 4, fr = frameW(cx, cz, b[0] - a[0], b[1] - a[1]);
      const loc = [a, b, c, d].map(([x, z]) => toL(x, z, fr));
      const box = { x0: Math.min(...loc.map(p => p[0])), x1: Math.max(...loc.map(p => p[0])), z0: Math.min(...loc.map(p => p[1])), z1: Math.max(...loc.map(p => p[1])) };
      colliders.push(boxToW(box, fr));
    }
  }
});
