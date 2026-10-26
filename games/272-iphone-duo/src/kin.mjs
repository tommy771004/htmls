// 運動學：鉸鏈角 → 兩半機身姿態、顯示屏自由段（兩段等半徑圓弧）、排線（彈性線 elastica）
export const D2R = Math.PI / 180;
export const PX = 1.925, PZ = 1.125;       // 左右虛擬樞軸 (∓PX, PZ)
export const DISP = { nz: 2.40, t: 0.40, bond: 6.5, half: 6.5 }; // 中性面 z、厚、黏著邊 |x|、自由段半長

// θ：鉸鏈開角（0 闔上、180 攤平）；φ：每半邊轉角
export const phiOf = theta => (180 - theta) / 2 * D2R;

// 旋轉 a（弧度）繞 (px,pz)：world = R·p + t
export function rotAbout(px, pz, a) {
  const c = Math.cos(a), s = Math.sin(a);
  return { c, s, tx: px - c * px + s * pz, tz: pz - s * px - c * pz };
}
export const IDENT = { c: 1, s: 0, tx: 0, tz: 0 };
export const apply = (T, x, z) => [T.c * x - T.s * z + T.tx, T.s * x + T.c * z + T.tz];
export const inv = T => ({ c: T.c, s: -T.s, tx: -(T.c * T.tx + T.s * T.tz), tz: -(-T.s * T.tx + T.c * T.tz) });
export const compose = (A, B) => ({ // A∘B
  c: A.c * B.c - A.s * B.s, s: A.s * B.c + A.c * B.s,
  tx: A.c * B.tx - A.s * B.tz + A.tx, tz: A.s * B.tx + A.c * B.tz + A.tz,
});

// ---------- 顯示屏自由段 ----------
// 左半：黏著邊 B 起，航向 −φ；第一弧轉 u(<0，往下)，第二弧轉 φ−u 回到水平，於 x=0 與右半鏡射相接。
// 兩弧等半徑 R、無直線段 → R = 半長 / (|u|+|φ−u|)，u 由「終點 x=0」單變數求根。
function arcD(h, t) { const s = Math.sign(t) || 1; return [s * (Math.sin(h + t) - Math.sin(h)), s * (Math.cos(h) - Math.cos(h + t))]; }
export function bodyPoint(side, x, z, phi) { // 平攤座標點 → 世界座標（side −1 左、+1 右）
  return apply(side < 0 ? rotAbout(-PX, PZ, -phi) : rotAbout(PX, PZ, phi), x, z);
}
export function twoArc(phi, ax, az, half) { // (ax,az) 為左側錨點的平攤座標
  if (phi < 1e-5) return null;
  const [xb, zb] = bodyPoint(-1, ax, az, phi), h0 = -phi;
  const f = u => { const a1 = arcD(h0, u), a2 = arcD(h0 + u, phi - u); return xb + half * (a1[0] + a2[0]) / (Math.abs(u) + Math.abs(phi - u)); };
  let lo = -Math.PI / 2 + 1e-9, hi = -1e-12, flo = f(lo), fhi = f(hi);
  if (Math.sign(flo) === Math.sign(fhi)) return null;
  for (let i = 0; i < 80; i++) { const m = (lo + hi) / 2, fm = f(m); if (Math.sign(fm) === Math.sign(flo)) { lo = m; flo = fm; } else { hi = m; } }
  const u = (lo + hi) / 2, R = half / (Math.abs(u) + Math.abs(phi - u));
  // 兩段弧的圓心與極角範圍（供扇區形狀）
  const c1x = xb + R * Math.sin(h0), c1z = zb - R * Math.cos(h0); // u<0：圓心在下方
  const h1 = h0 + u, x1 = c1x - R * Math.sin(h1), z1 = c1z + R * Math.cos(h1);
  const c2x = x1 - R * Math.sin(h1), c2z = z1 + R * Math.cos(h1);
  return {
    u, R, xb, zb,
    arcs: [
      { cx: c1x, cz: c1z, a0: h1 + Math.PI / 2, a1: h0 + Math.PI / 2 },       // 極角 = 航向 + 90°
      { cx: c2x, cz: c2z, a0: h1 - Math.PI / 2, a1: -Math.PI / 2 },           // 極角 = 航向 − 90°
    ],
    zMid: c2z - R,
  };
}
export const displayFold = phi => twoArc(phi, -DISP.bond, DISP.nz, DISP.half);

// 沿曲線取點（左半，起點→中點），再鏡射成全段
export function twoArcPts(sol, ds = 0.01) {
  const out = [];
  const [A1, A2] = sol.arcs;
  const n1 = Math.max(2, Math.ceil(sol.R * (A1.a1 - A1.a0) / ds));
  for (let i = 0; i <= n1; i++) { const a = A1.a1 - (A1.a1 - A1.a0) * i / n1; out.push([A1.cx + sol.R * Math.cos(a), A1.cz + sol.R * Math.sin(a)]); }
  const n2 = Math.max(2, Math.ceil(sol.R * (A2.a1 - A2.a0) / ds));
  for (let i = 1; i <= n2; i++) { const a = A2.a0 + (A2.a1 - A2.a0) * i / n2; out.push([A2.cx + sol.R * Math.cos(a), A2.cz + sol.R * Math.sin(a)]); }
  return out;
}
export function mirrorFull(half) {
  const r = half.slice(0, -1).reverse().map(([x, z]) => [-x, z]);
  return [...half, ...r];
}

// ---------- 排線：對稱彈性線（elastica） ----------
// 半條：起點 A（世界座標）航向 h0，弧長 S，終點在 x=0 且航向 0；對稱面上只有水平內力 →
// θ'' = λ sin θ。未知 κ0、λ，以牛頓法打靶；φ 連續延拓。
function shoot(x0, z0, h0, S, k0, lam, N = 240, keep = false) {
  const ds = S / N; let th = h0, k = k0, x = x0, z = z0, kmax = Math.abs(k0);
  const pts = keep ? [[x, z]] : null;
  const f = (th, k) => [k, lam * Math.sin(th), Math.cos(th), Math.sin(th)];
  for (let i = 0; i < N; i++) {
    const a = f(th, k), b = f(th + a[0] * ds / 2, k + a[1] * ds / 2), c = f(th + b[0] * ds / 2, k + b[1] * ds / 2), d = f(th + c[0] * ds, k + c[1] * ds);
    th += ds / 6 * (a[0] + 2 * b[0] + 2 * c[0] + d[0]); k += ds / 6 * (a[1] + 2 * b[1] + 2 * c[1] + d[1]);
    x += ds / 6 * (a[2] + 2 * b[2] + 2 * c[2] + d[2]); z += ds / 6 * (a[3] + 2 * b[3] + 2 * c[3] + d[3]);
    if (Math.abs(k) > kmax) kmax = Math.abs(k);
    if (keep) pts.push([x, z]);
  }
  return { th, k, x, z, kmax, pts };
}
export function elastica(x0, z0, h0, S, guess) {
  let [k0, lam] = guess;
  for (let it = 0; it < 60; it++) {
    const r = shoot(x0, z0, h0, S, k0, lam);
    const F = [r.th, r.x];
    if (Math.abs(F[0]) < 1e-11 && Math.abs(F[1]) < 1e-11) break;
    const e = 1e-7;
    const a = shoot(x0, z0, h0, S, k0 + e, lam), b = shoot(x0, z0, h0, S, k0, lam + e);
    const J = [[(a.th - r.th) / e, (b.th - r.th) / e], [(a.x - r.x) / e, (b.x - r.x) / e]];
    const det = J[0][0] * J[1][1] - J[0][1] * J[1][0];
    if (!isFinite(det) || Math.abs(det) < 1e-14) return null;
    let d0 = (J[1][1] * F[0] - J[0][1] * F[1]) / det, d1 = (-J[1][0] * F[0] + J[0][0] * F[1]) / det;
    const m = Math.max(Math.abs(d0) / 2, Math.abs(d1) / 2, 1); d0 /= m; d1 /= m;
    k0 -= d0; lam -= d1;
  }
  const r = shoot(x0, z0, h0, S, k0, lam, 600, true);
  if (Math.abs(r.th) > 1e-6 || Math.abs(r.x) > 1e-6) return null;
  return { k0, lam, pts: r.pts, Rmin: 1 / r.kmax, zMid: r.z };
}

// 排線在一個 φ 序列上延拓求解（錨點為左半平攤座標，航向沿機身 +x）
export function fpcSweep(anchor, S, phis) {
  // 由大 φ 往小 φ 延拓：φ=0 有多個平衡解（S 形下鑽），從闔起端連續下來才是真實的那一支
  const out = []; let g = null;
  for (const phi of [...phis].sort((a, b) => b - a)) {
    const [x0, z0] = bodyPoint(-1, anchor[0], anchor[1], phi);
    if (phi < 1e-6 && S <= -x0 + 1e-9) { out.push({ phi, pts: [[x0, z0], [0, z0]], Rmin: Infinity, k0: 0, lam: 0 }); g = null; continue; }
    let sol = null;
    const tries = g ? [g] : [];
    for (const k of [-0.05, -0.2, -0.5, -1, 0.05]) for (const l of [-0.5, -2, -5, 0.5, -10]) tries.push([k, l]);
    for (const t of tries) { sol = elastica(x0, z0, -phi, S, t); if (sol && sol.zMid < z0 + 1e-9) break; sol = null; }
    if (!sol) { out.push({ phi, fail: true }); g = null; continue; }
    g = [sol.k0, sol.lam];
    out.push({ phi, ...sol });
  }
  return out.sort((a, b) => a.phi - b.phi);
}
