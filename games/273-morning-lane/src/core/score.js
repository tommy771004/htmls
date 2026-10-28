// 計分：把事件記成帳本（一行一筆），分數、連投、送達與漏送都從帳本算。每日結算之後會讀同一份帳本。
import { POINTS } from './config.js';

export function makeLedger(street) {
  return { lines: [], score: 0, streak: 0, best: 0, delivered: new Set(), missed: new Set(), subs: street.lots.filter((l) => l.sub).length };
}

function add(L, kind, pts, lot = -1, extra = {}) {
  const line = { kind, pts, lot, ...extra };
  L.lines.push(line); L.score += pts;
  return line;
}

/** 報紙落點事件 → 帳本。回傳新增的那幾行 */
export function scorePaper(L, street, ev) {
  const lot = ev.lot >= 0 ? street.lots[ev.lot] : null;
  const out = [];
  const deliver = (kind, pts) => {
    L.delivered.add(lot.id); L.streak++; L.best = Math.max(L.best, L.streak);
    out.push(add(L, kind, pts, lot.id));
    if (L.streak > 1) out.push(add(L, 'streak', POINTS.streak * (L.streak - 1), lot.id, { n: L.streak }));
  };
  if (ev.type === 'window' && lot) out.push(add(L, 'window', lot.sub ? POINTS.subWindow : POINTS.badWindow, lot.id, { sub: lot.sub }));
  else if (lot && lot.sub && !L.delivered.has(lot.id) && !L.missed.has(lot.id)) {
    const m = lot.vip ? POINTS.vipMult : 1;
    if (ev.type === 'mailbox') deliver('mailbox', POINTS.mailbox * m);
    else if (ev.type === 'wall' || ev.type === 'yard') deliver('doorstep', POINTS.doorstep * m);
    if (lot.vip && L.delivered.has(lot.id)) { out[0].vip = true; L.vip = true; }
  }
  return out;
}

/** 騎過訂戶還沒送到 → 漏送（不扣分，但連投歸零） */
export function scorePass(L, street, bikeZ) {
  const out = [];
  for (const l of street.lots) {
    if (!l.sub || L.delivered.has(l.id) || L.missed.has(l.id) || bikeZ > l.z - 12) continue;
    L.missed.add(l.id); L.streak = 0;
    out.push(add(L, 'missed', POINTS.missedHouse, l.id));
  }
  return out;
}

export function scoreBump(L, o) {
  const pts = o.kind === 'dog' ? POINTS.bite : o.kind === 'carMove' ? POINTS.crash : POINTS.bump;
  return [add(L, 'bump', pts, -1, { what: o.kind })];
}

export const scoreBundle = (L) => [add(L, 'bundle', POINTS.bundle)];
export const scoreJump = (L) => [add(L, 'jump', POINTS.jump)];

export function summary(L) {
  const n = (k) => L.lines.filter((x) => x.kind === k).length;
  return { score: L.score, subs: L.subs, delivered: L.delivered.size, mailbox: n('mailbox'), doorstep: n('doorstep'),
    missed: L.missed.size, windows: n('window'), bumps: n('bump'), best: L.best, vip: !!L.vip, bundles: n('bundle'), jumps: n('jump') };
}
