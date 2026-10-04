// 毒圈時間表：wait（已公布下一圈）→ shrink（縮圈）→ 下一階段。前端用同一份算法內插顯示。
import { STORM, STORM_R0 } from './rules.js';

export function newStorm() {
  return { phase: 0, state: 'wait', t0: 0, from: { x: 0, z: 0, r: STORM_R0 }, next: null, cur: { x: 0, z: 0, r: STORM_R0 } };
}

// pickNext(cur, r) 回傳新圓心；由對局用自己的亂數與地形挑
export function stormTick(S, time, pickNext) {
  if (!S.next) S.next = { ...pickNext(S.cur, STORM[0].r), r: STORM[0].r };
  const P = STORM[S.phase];
  if (!P) return null;
  const el = time - S.t0;
  if (S.state === 'wait') {
    S.cur = { ...S.from };
    if (el >= P.wait) { S.state = 'shrink'; S.t0 = time; return 'shrink'; }
  } else {
    const u = Math.min(1, el / P.shrink);
    S.cur = { x: S.from.x + (S.next.x - S.from.x) * u, z: S.from.z + (S.next.z - S.from.z) * u, r: S.from.r + (S.next.r - S.from.r) * u };
    if (u >= 1) {
      S.from = { ...S.next };
      S.cur = { ...S.next };
      S.phase++;
      S.t0 = time;
      S.state = 'wait';
      const N = STORM[S.phase];
      S.next = N ? { ...pickNext(S.cur, N.r), r: N.r } : null;
      return 'phase';
    }
  }
  return null;
}

export function stormRemaining(S, time) {
  const P = STORM[S.phase];
  if (!P) return 0;
  return Math.max(0, (S.state === 'wait' ? P.wait : P.shrink) - (time - S.t0));
}

export function stormDps(S) { return (STORM[S.phase] || STORM[STORM.length - 1]).dps; }

export function outside(S, x, z) {
  const dx = x - S.cur.x, dz = z - S.cur.z;
  return dx * dx + dz * dz > S.cur.r * S.cur.r;
}

export function packStorm(S) {
  const r1 = (v) => Math.round(v * 10) / 10;
  return { p: S.phase, s: S.state === 'wait' ? 0 : 1, t0: r1(S.t0), f: [r1(S.from.x), r1(S.from.z), r1(S.from.r)], n: S.next ? [r1(S.next.x), r1(S.next.z), r1(S.next.r)] : null };
}

// 前端：由封包重建並依時間內插
export function unpackStorm(o) {
  return { phase: o.p, state: o.s ? 'shrink' : 'wait', t0: o.t0, from: { x: o.f[0], z: o.f[1], r: o.f[2] }, next: o.n ? { x: o.n[0], z: o.n[1], r: o.n[2] } : null, cur: { x: o.f[0], z: o.f[1], r: o.f[2] } };
}
export function stormAt(S, time) {
  const P = STORM[S.phase];
  if (!P || S.state === 'wait' || !S.next) return { ...S.from };
  const u = Math.min(1, Math.max(0, (time - S.t0) / P.shrink));
  return { x: S.from.x + (S.next.x - S.from.x) * u, z: S.from.z + (S.next.z - S.from.z) * u, r: S.from.r + (S.next.r - S.from.r) * u };
}
