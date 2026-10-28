// 一條街的配置：地塊、房子（窗戶矩形）、信箱、柵欄、障礙物。純資料，畫面與判定都讀這一份。
// 座標：騎士往 −z 前進，+x 是右手邊；房子正面朝街，在 x = ±houseFront。
import { STREET } from './config.js';

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

import HOUSES from './houses.json' with { type: 'json' };

export const BASE = 0.12;       // 草坪高度：房子、柵欄、信箱都站在這上面
export const FENCE_H = 1.0;
export const GATE = 0.58;       // 柵欄門口半寬（和 Blender 的 fence() 一樣）
export { HOUSES };

/** 產生一條街。opts.subRatio：訂戶比例；opts.seed：決定房型、訂戶與障礙物位置；opts.bins：每戶門口擺垃圾桶的機率；
 *  opts.vip：金色信箱戶數；opts.bundles：路上的報紙補給包數；opts.ramps：跳台數 */
export function makeStreet({ seed = 1, length = STREET.length, subRatio = 0.6, bins = 0.3, vip = 0, bundles = 0, ramps = 0 } = {}) {
  const R = rng(seed);
  const lots = [];
  const obstacles = [];   // 圓形 {x,z,r,kind} 或矩形 {x,z,hw,hd,kind}
  const lw = STREET.lotWidth;
  for (const side of [-1, 1]) {
    const off = side > 0 ? lw / 2 : 0;          // 右側錯開半塊地，兩邊房子不要對稱
    for (let i = 0; ; i++) {
      const z = -(22 + off + i * lw);
      if (z < -length + 14) break;
      const v = Math.floor(R() * HOUSES.length), H = HOUSES[v];
      // 房子的本地 u（沿牆寬）在左右兩側方向相反：右側 z = 中心 − u，左側 z = 中心 + u
      const toZ = (u) => z - side * u;
      const doorZ = toZ(H.door_u);
      const windows = H.wins.map(([u, zb]) => {
        const zc = toZ(u);
        return { z0: zc - H.win[0] / 2, z1: zc + H.win[0] / 2, y0: BASE + zb, y1: BASE + zb + H.win[1] };
      });
      lots.push({
        id: lots.length, side, z, i, variant: v, w: H.W, depth: H.D, floors: H.stories,
        eaves: BASE + H.H, sub: false, doorZ, windows,
        mailbox: { x: side * STREET.mailboxX, z: doorZ - side * 1.3 },
        gate: [doorZ - GATE, doorZ + GATE],
      });
    }
  }
  // 訂戶：按騎到的順序排，第一戶一定是訂戶，連續三戶非訂戶就強制下一戶是訂戶
  lots.sort((a, b) => b.z - a.z);
  let dry = 0;
  lots.forEach((l, k) => {
    l.sub = k === 0 || dry >= 3 || R() < subRatio;
    dry = l.sub ? 0 : dry + 1;
    l.order = k;
  });
  lots.sort((a, b) => a.id - b.id);

  // 障礙物：行道樹左右交錯每 16 m 一棵、電線桿每 34 m、消防栓、垃圾桶（收垃圾日放在路邊）、一台路邊停車
  for (let k = 0, z = -14; z > -length + 6; z -= 16, k++) {
    const s = k % 2 ? 1 : -1;
    obstacles.push({ x: s * 4.45, z, r: 0.35, kind: 'tree' });
  }
  for (let z = -30; z > -length + 6; z -= 34) obstacles.push({ x: -4.2, z, r: 0.2, kind: 'pole' });
  for (let k = 0, z = -8; z > -length + 6; z -= 32, k++) obstacles.push({ x: k % 2 ? -4.62 : 4.62, z, r: 0.14, kind: 'lamp' });
  for (const l of lots) {
    obstacles.push({ x: l.mailbox.x, z: l.mailbox.z, r: 0.12, kind: 'post', lot: l.id });
    if (R() < bins) obstacles.push({ x: l.side * 3.15, z: l.z - 4 - R() * 3, r: 0.38, kind: 'bin' });
  }
  for (let k = 0, z = -71; z > -length + 20; z -= 96, k++) obstacles.push({ x: k % 2 ? -4.6 : 4.6, z, r: 0.22, kind: 'hydrant' });
  for (let z = -122; z > -length + 20; z -= 150) obstacles.push({ x: 2.55, z, hw: 0.95, hd: 2.25, kind: 'car' });
  // 樹、桿子不要擋在信箱上：離信箱太近的就往前挪
  for (const o of obstacles) {
    if (o.kind !== 'tree' && o.kind !== 'pole' && o.kind !== 'lamp') continue;
    for (let n = 0; n < 6; n++) {
      const l = lots.find((l) => Math.sign(l.mailbox.x) === Math.sign(o.x) && Math.abs(l.mailbox.z - o.z) < 2);
      if (!l) break;
      o.z = l.mailbox.z - 2.4;
    }
  }
  // 金色信箱：從中段的訂戶挑（不挑第一戶）
  const R2 = rng(seed * 31 + 5);
  const mid = lots.filter((l) => l.sub && l.order > 1 && l.z < -40 && l.z > -length + 40);
  for (let k = 0; k < vip && mid.length; k++) mid.splice(Math.floor(R2() * mid.length), 1)[0].vip = true;
  // 補給包與跳台：平均分段擺在車道上（x ±1.7 或 ±0.6），避開停著的車與彼此
  const free = (x, z, r) => !obstacles.some((o) => (o.r != null ? Math.hypot(o.x - x, o.z - z) < o.r + r : Math.abs(o.x - x) < o.hw + r && Math.abs(o.z - z) < o.hd + r));
  const items = [];
  const place = (n, kind, r) => {
    for (let k = 0; k < n; k++) {
      const z0 = -30 - ((k + 0.5) / n) * (length - 70);
      for (let t = 0; t < 30; t++) {
        const x = [1.7, -1.7, 0.6, -0.6][Math.floor(R2() * 4)], z = z0 - t * 3.1;
        if (free(x, z, r) && !items.some((o) => Math.abs(o.z - z) < 12)) { items.push({ kind, x, z, id: items.length }); break; }
      }
    }
  };
  place(ramps, 'ramp', 1.2);
  place(bundles, 'bundle', 0.9);
  return { seed, length, lots, obstacles, finishZ: -length + 6,
    ramps: items.filter((o) => o.kind === 'ramp'), bundles: items.filter((o) => o.kind === 'bundle') };
}

/** 給定 z，找那一側沿街範圍包含 z 的地塊 */
export function lotAt(street, side, z) {
  const hw = STREET.lotWidth / 2;
  for (const l of street.lots) if (l.side === side && Math.abs(l.z - z) <= hw) return l;
  return null;
}
