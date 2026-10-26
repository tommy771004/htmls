// 檢查引擎：新放上的零件對所有已放置零件，在整個開合範圍（φ 0–90°，每 1°，最差處再細掃 0.25°）
// 量最小間隙；另查排線／顯示屏彎曲半徑、齒輪嚙合中心距與齒條咬合範圍。
import { apply, inv, compose, rotAbout, IDENT, PX, PZ, D2R } from './kin.mjs';
import { plateLaw, plateFrame } from './parts.mjs';

export const TOL = 0.05;        // 最小間隙
export const CAP = 1.0;         // 量測上限：超過視為寬鬆
export const H = 0.01;          // 邊界取樣間距（結果已扣 H/2，保守）
export const R_FPC = 0.80;      // 排線動態最小彎曲半徑（20 × 0.04）
export const R_DISP = 1.50;     // 內螢幕中性面最小彎曲半徑（推估）

export function stateAt(D, phi, press = 0) { return { phi, psi: plateLaw(D)(phi), press }; }

export function frameT(D, pr, part, st) {
  let T;
  switch (pr.frame) {
    case 'S': T = IDENT; break;
    case 'L': T = rotAbout(-PX, PZ, -st.phi); break;
    case 'R': T = rotAbout(PX, PZ, st.phi); break;
    case 'PL': T = plateFrame(D, st.psi, -1); break;
    case 'PR': T = plateFrame(D, st.psi, 1); break;
  }
  if (part.press && pr.tag === part.press.tag && st.press && part.press.dx) T = compose(T, { c: 1, s: 0, tx: part.press.dx * st.press, tz: 0 });
  return T;
}
const yRange = (pr, part, st) => (part.press && pr.tag === part.press.tag && st.press && part.press.dy)
  ? [pr.y0 + part.press.dy * st.press, pr.y1 + part.press.dy * st.press] : [pr.y0, pr.y1];
export const shapeOf = (pr, st) => pr.shapeAt ? pr.shapeAt(st) : pr.shape;

// 單向：A 的邊界點在 B 的 SDF 中的最小值
function oneWay(sa, Ta, sb, Tb, best, skip) {
  const M = compose(inv(Tb), Ta), bb = sb.bb, lim = () => Math.min(CAP, best.d);
  for (const g of sa.samples(H)) {
    const c = [[g.bb[0], g.bb[2]], [g.bb[1], g.bb[2]], [g.bb[0], g.bb[3]], [g.bb[1], g.bb[3]]].map(([x, z]) => apply(M, x, z));
    const gx0 = Math.min(...c.map(p => p[0])), gx1 = Math.max(...c.map(p => p[0])), gz0 = Math.min(...c.map(p => p[1])), gz1 = Math.max(...c.map(p => p[1]));
    if (Math.max(bb[0] - gx1, gx0 - bb[1], bb[2] - gz1, gz0 - bb[3]) > lim()) continue;
    const p = g.p;
    for (let i = 0; i < p.length; i += 2) {
      const u = M.c * p[i] - M.s * p[i + 1] + M.tx, v = M.s * p[i] + M.c * p[i + 1] + M.tz;
      if (Math.max(bb[0] - u, u - bb[1], bb[2] - v, v - bb[3]) > lim()) continue;
      if (skip) { const w = apply(Ta, p[i], p[i + 1]); if (skip(w[0], w[1])) continue; }
      const d = sb.sdf(u, v, lim());
      if (d < best.d) { best.d = d; best.p = apply(Ta, p[i], p[i + 1]); }
    }
  }
}
export function dist2(sa, Ta, sb, Tb, skip) {
  const best = { d: Infinity, p: null };
  oneWay(sa, Ta, sb, Tb, best, skip);
  oneWay(sb, Tb, sa, Ta, best, skip);
  if (best.d !== Infinity) best.d -= H / 2;
  return best;
}

// ---------- 例外規則：黏合、嚙合、按鍵觸發、錨點 ----------
export function rulesFor(D, a, pa, b, pb) {
  const k = (x, tx) => x.id + (tx ? '.' + tx : '');
  const has = (A, ta, B, tb) => {
    const m = (p, pr, id, t) => p.id === id && (!t || pr.tag === t);
    return (m(a, pa, A, ta) && m(b, pb, B, tb)) || (m(b, pb, A, ta) && m(a, pa, B, tb));
  };
  if (has('frameL', 0, 'bandL') || has('frameR', 0, 'bandR')) return { type: 'bond' };
  if (has('display', 'bondL', 'frameL') || has('display', 'bondR', 'frameR')) return { type: 'bond' };
  if (has('sliderL', 0, 'frameL') || has('sliderR', 0, 'frameR')) return { type: 'bond' };
  if (has('outerGlass', 0, 'outerPanel')) return { type: 'bond' };
  for (const n of ['fpc1', 'fpc2']) {
    if (has(n, 'conL', 'frameL') || has(n, 'conR', 'frameR')) return { type: 'bond' };
  }
  // 顯示屏自由段與中框在黏著線處相接
  if (has('display', 'fold', 'frameL') || has('display', 'fold', 'frameR')) {
    return { type: 'near', pts: [['L', -6.5, 2.4], ['R', 6.5, 2.4]], r: 0.3 };
  }
  for (const n of ['fpc1', 'fpc2']) if (has(n, 'free', 'frameL') || has(n, 'free', 'frameR')) {
    return { type: 'near', pts: [['L', D.fpc.ax, D.fpc.az], ['R', -D.fpc.ax, D.fpc.az]], r: 0.15 };
  }
  // 齒條 ↔ 第一顆惰輪：嚙合區不量間隙（另查中心距）
  if (has('sliderL', 0, 'sync', 'g0') || has('sliderR', 0, 'sync', 'g5')) {
    return { type: 'mesh' };
  }
  return null;
}
function skipFn(D, rule, st) {
  if (!rule) return null;
  if (rule.type === 'near') {
    const pts = rule.pts.map(([f, x, z]) => apply(f === 'L' ? rotAbout(-PX, PZ, -st.phi) : rotAbout(PX, PZ, st.phi), x, z));
    return (x, z) => pts.some(([px, pz]) => Math.hypot(x - px, z - pz) < rule.r);
  }
  return null;
}
function meshSkip(D, gear, side) { // 嚙合點附近 0.6 內（兩齒頂圓交疊區）略過
  const cx = side < 0 ? -PX : PX, a = Math.atan2(gear.z - PZ, gear.x - cx), r = D.slider.r1;
  const px = cx + r * Math.cos(a), pz = PZ + r * Math.sin(a);
  return (x, z) => Math.hypot(x - px, z - pz) < 0.6;
}

// ---------- 兩零件之間 ----------
export const PHI_STEPS = Array.from({ length: 91 }, (_, i) => i * D2R);
function isDynamicPair(a, pa, b, pb) {
  if (pa.shapeAt || pb.shapeAt) return true;
  if (a.press && pa.tag === a.press.tag) return true;
  if (b.press && pb.tag === b.press.tag) return true;
  return pa.frame !== pb.frame || pa.frame === 'PL' || pa.frame === 'PR';
}
export function checkPair(D, a, b, onlyPhis) {
  let worst = null;
  const cache = new Map();
  for (const pa of a.prisms) for (const pb of b.prisms) {
    const rule = rulesFor(D, a, pa, b, pb);
    if (rule && rule.type === 'bond') continue;
    const dyn = isDynamicPair(a, pa, b, pb);
    const keyPart = (a.press && pa.tag === a.press.tag) || (b.press && pb.tag === b.press.tag);
    const states = [];
    if (onlyPhis) { if (!dyn) continue; for (const phi of onlyPhis) states.push(stateAt(D, phi)); }
    else {
      if (dyn && !(keyPart && pa.frame === pb.frame && !pa.shapeAt && !pb.shapeAt)) for (const phi of PHI_STEPS) states.push(stateAt(D, phi));
      else states.push(stateAt(D, 0));
      if (keyPart) states.push(stateAt(D, 0, 1));
    }
    const one = st => {
      const [ay0, ay1] = yRange(pa, a, st), [by0, by1] = yRange(pb, b, st);
      const dy = Math.max(ay0, by0) - Math.min(ay1, by1);
      if (dy >= CAP) return null;
      const sa = shapeOf(pa, st), sb = shapeOf(pb, st);
      if (!sa || !sb) return { d: -Infinity, phi: st.phi, missing: true };
      let skip = skipFn(D, rule, st);
      if (rule && rule.type === 'mesh') {
        const gi = pa.tag && pa.tag[0] === 'g' ? +pa.tag.slice(1) : +pb.tag.slice(1);
        const side = (a.id === 'sliderL' || b.id === 'sliderL') ? -1 : 1;
        const g = (a.gears || b.gears)[gi]; skip = meshSkip(D, g, side);
      }
      // 同形狀、同座標系、同狀態的 XZ 距離只算一次（多段同截面的稜柱共用）
      const ck = st.phi + ':' + st.press + ':' + pa.frame + pb.frame + (rule ? rule.type + (pa.tag || '') + (pb.tag || '') : '');
      let cm = cache.get(sa); if (!cm) cache.set(sa, cm = new Map());
      let cmm = cm.get(sb); if (!cmm) cm.set(sb, cmm = new Map());
      let r = cmm.get(ck);
      if (!r) { r = dist2(sa, frameT(D, pa, a, st), sb, frameT(D, pb, b, st), skip); cmm.set(ck, r); }
      if (r.d === Infinity) return null;
      const d = dy > 0 ? Math.hypot(dy, Math.max(r.d, 0)) : r.d;
      return { d, d2: r.d, dy: Math.max(dy, 0), phi: st.phi, press: st.press, at: r.p, ta: pa.tag, tb: pb.tag, y: [Math.max(ay0, by0), Math.min(ay1, by1)] };
    };
    let best = null;
    for (const st of states) { const r = one(st); if (r && (!best || r.d < best.d)) best = r; }
    if (best && dyn && states.length > 2 && !best.press && !onlyPhis) { // 細掃
      for (let k = -4; k <= 4; k++) {
        const phi = best.phi + k * 0.25 * D2R;
        if (phi < 0 || phi > Math.PI / 2 || k === 0) continue;
        const r = one(stateAt(D, phi)); if (r && r.d < best.d) best = r;
      }
    }
    if (best && (!worst || best.d < worst.d)) worst = best;
  }
  return worst;
}

// ---------- 零件本身：彎曲半徑、嚙合 ----------
export function selfCheck(D, part) {
  const out = [];
  if (part.id === 'display') {
    let rmin = Infinity, at = 0;
    for (const phi of PHI_STEPS) { if (phi < 1e-6) continue; const s = part.prisms[2].shapeAt({ phi }).fold; if (s.R < rmin) { rmin = s.R; at = phi; } }
    out.push({ kind: 'bend', what: '內螢幕摺彎（中性面）', R: rmin, min: R_DISP, phi: at, ok: rmin >= R_DISP });
  }
  if (part.bend) {
    let rmin = Infinity, at = 0, miss = 0;
    for (const phi of PHI_STEPS) { const r = part.prisms[0].shapeAt({ phi }); if (!r) { miss++; continue; } if (r.Rmin < rmin) { rmin = r.Rmin; at = phi; } }
    out.push({ kind: 'bend', what: '排線自由段', R: rmin, min: R_FPC, phi: at, ok: rmin >= R_FPC && !miss, miss });
  }
  if (part.gears) {
    const g = part.gears;
    for (let i = 0; i < g.length - 1; i++) {
      const c = Math.hypot(g[i + 1].x - g[i].x, g[i + 1].z - g[i].z), want = g[i].p + g[i + 1].p;
      out.push({ kind: 'mesh', what: `${g[i].n}T–${g[i + 1].n}T 中心距`, err: c - want, ok: Math.abs(c - want) < 0.003 });
    }
    // 齒條（滑軌外緣節圓 r1）↔ 端齒輪
    const rk = Math.hypot(g[0].x + PX, g[0].z - PZ), want = D.slider.r1 + g[0].p;
    out.push({ kind: 'mesh', what: `齒條 R${D.slider.r1}–${g[0].n}T 中心距`, err: rk - want, ok: Math.abs(rk - want) < 0.003 });
    const alpha = (Math.atan2(g[0].z - PZ, g[0].x + PX) / D2R + 360) % 360, m = 4; // 留約一齒
    const lo = D.slider.b0 + m, hi = D.slider.b1 - m;
    out.push({ kind: 'engage', what: `齒條咬合範圍 ${alpha.toFixed(1)}°–${(alpha + 90).toFixed(1)}° ⊂ 齒條 ${lo}°–${hi}°`, ok: alpha >= lo && alpha + 90 <= hi });
    out.push({ kind: 'mesh', what: '惰輪數（偶數 → 兩半反向）', ok: (g.length % 2) === 0, err: 0 });
  }
  if (part.press) { // 鍵帽 ↔ 開關：靜止時留隙、按下時剛好接觸
    const caps = part.prisms.filter(p => p.tag === 'cap'), sws = part.prisms.filter(p => p.tag === 'sw');
    const g = st => {
      let m = Infinity;
      for (const cap of caps) for (const sw of sws) {
        const [a0, a1] = yRange(cap, part, st), dy = Math.max(a0, sw.y0) - Math.min(a1, sw.y1);
        const r = dist2(cap.shape, frameT(D, cap, part, st), sw.shape, frameT(D, sw, part, st));
        if (r.d === Infinity) continue;
        // 沿 y 按壓的鍵：接觸面在 y 方向，量 y 間隙；沿 x 按壓：量截面距離
        const v = part.press.dy ? (r.d < 0 ? dy : Math.hypot(Math.max(dy, 0), r.d)) : (dy > 0 ? Math.hypot(dy, Math.max(r.d, 0)) : r.d);
        m = Math.min(m, v);
      }
      return m;
    };
    const rest = g(stateAt(D, 0)), pressed = g(stateAt(D, 0, 1));
    out.push({ kind: 'key', what: '鍵帽 ↔ 開關：靜止間隙／按下', rest, pressed, ok: rest >= TOL && Math.abs(pressed) < 0.012 });
  }
  return out;
}

export function checkPart(D, part, placed) {
  const pairs = [];
  for (const q of placed) {
    const r = checkPair(D, part, q);
    if (r) pairs.push({ other: q.id, ...r });
  }
  pairs.sort((x, y) => x.d - y.d);
  const self = selfCheck(D, part);
  const fails = pairs.filter(p => p.d < TOL);
  return { pairs, self, ok: !fails.length && self.every(s => s.ok), fails };
}
