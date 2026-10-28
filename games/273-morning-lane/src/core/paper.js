// 報紙：拋出、飛行、判定落點。判定順序：信箱 → 柵欄 → 房子正面（窗／牆）→ 落地（前院／路上）。
import { PAPER, STREET } from './config.js';
import { FENCE_H, lotAt } from './street.js';

export const MAILBOX_Y = [0.7, 1.75];    // 信箱判定的高度範圍：箱子 0.95–1.35，往上含旗子、往下含柱子，偏寬鬆

export function launch(b, side, C = PAPER) {
  return {
    x: b.x + side * 0.35, y: C.launchH + (b.y || 0), z: b.z,
    vx: side * C.side + Math.sin(b.yaw) * b.v * C.inherit,
    vy: C.up,
    vz: -Math.cos(b.yaw) * b.v * C.inherit,
    side, t: 0, alive: true, spin: 0,
  };
}

/** 前進 dt。打到東西就回傳結果事件並讓報紙停下：{ type, lot, x, y, z } */
export function stepPaper(p, dt, street, C = PAPER) {
  const n = 4, h = dt / n;
  for (let i = 0; i < n && p.alive; i++) {
    const px = p.x;
    p.vy -= C.gravity * h;
    p.x += p.vx * h; p.y += p.vy * h; p.z += p.vz * h; p.t += h;
    const side = Math.sign(p.x) || p.side;
    const ax = Math.abs(p.x), apx = Math.abs(px);
    const lot = lotAt(street, side, p.z);
    const end = (type, l = lot) => { p.alive = false; return { type, lot: l ? l.id : -1, x: p.x, y: p.y, z: p.z }; };
    // 信箱：以信箱為軸的直立圓柱
    for (const l of street.lots) {
      if (l.side !== side || Math.abs(l.mailbox.z - p.z) > 1) continue;
      if (Math.hypot(p.x - l.mailbox.x, p.z - l.mailbox.z) < C.mailboxR && p.y > MAILBOX_Y[0] && p.y < MAILBOX_Y[1]) return end('mailbox', l);
    }
    // 柵欄：從內往外穿過 x = ±fence 時太低就卡住（門口開口除外）
    if (apx < STREET.fence && ax >= STREET.fence && p.y < FENCE_H) {
      if (!(lot && p.z > lot.gate[0] && p.z < lot.gate[1])) return end('fence');
    }
    // 房子正面
    if (lot && apx < STREET.houseFront && ax >= STREET.houseFront && Math.abs(p.z - lot.z) < lot.w / 2 && p.y < lot.eaves) {
      for (const w of lot.windows) if (p.z > w.z0 && p.z < w.z1 && p.y > w.y0 && p.y < w.y1) return end('window');
      return end('wall');
    }
    if (p.y <= 0.06) {
      p.y = 0.06;
      return end(lot && ax >= STREET.fence ? 'yard' : 'ground');
    }
  }
  return null;
}

/** 解析解：從 x0 往 side 丟，報紙橫向到達 |x| = X 時的時間與高度（不算繼承的橫向速度）。給測試與報告用 */
export function crossing(x0, side, X, C = PAPER) {
  const dist = X - side * x0 - 0.35;
  const t = dist / C.side;
  return { t, y: C.launchH + C.up * t - 0.5 * C.gravity * t * t };
}
