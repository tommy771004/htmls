// 每日任務：每天三個（week.js 的 missions），騎的時候即時顯示進度，騎完結算。完成一個加 MISSION_PTS。
// 任務分兩種：計數型（達到就完成）與保持型（整趟沒犯規才算，犯規當下就失敗）。
export const MISSION_PTS = 150;

// st：statsOf(g) 的統計；n：門檻
const DEFS = {
  mailbox: (n) => ({ label: `正中信箱 ${n} 次`, prog: (st) => [st.mailbox, n] }),
  streak: (n) => ({ label: `連投 ×${n}`, prog: (st) => [st.best, n] }),
  vip: () => ({ label: '送到金色信箱', prog: (st) => [st.vip ? 1 : 0, 1] }),
  bundles: (n) => ({ label: `撿起 ${n} 個報紙包`, prog: (st) => [st.bundles, n] }),
  jumps: (n) => ({ label: `飛過 ${n} 個跳台`, prog: (st) => [st.jumps, n] }),
  escape: () => ({ label: '甩掉追人的狗（不被咬）', prog: (st) => [st.escapes, 1], fail: (st) => st.bites > 0 }),
  noBump: () => ({ label: '一路不撞到任何東西', keep: true, fail: (st) => st.bumps > 0 }),
  noWindow: () => ({ label: '不打破任何窗戶', keep: true, fail: (st) => st.windows > 0 }),
  dry: () => ({ label: '不被灑水器噴到', keep: true, fail: (st) => st.wets > 0 }),
  perfect: () => ({ label: '每一戶訂戶都送到', keep: true, fail: (st) => st.missed > 0 }),
  spare: (n) => ({ label: `騎完還剩 ${n} 份報紙`, keep: true, fail: (st) => st.stock < n, end: true }),
};

/** 'streak:5' → 任務物件 */
export function mission(spec) {
  const [id, arg] = spec.split(':');
  const d = DEFS[id](arg == null ? undefined : +arg);
  return { spec, id, ...d };
}

/**
 * 任務狀態。final＝騎完了（保持型沒犯規就算完成）。
 * 回傳 [{ spec, label, state: 'open'|'done'|'fail', have, need }]
 */
export function evalMissions(specs, st, final = false) {
  return specs.map((spec) => {
    const m = mission(spec);
    let state = 'open', have = 0, need = 0;
    if (m.fail && m.fail(st) && !(m.end && !final)) state = 'fail';
    else if (m.prog) { [have, need] = m.prog(st); if (have >= need) state = 'done'; }
    else if (m.keep && final) state = 'done';
    if (state === 'open' && final) state = 'fail';
    return { spec, label: m.label, state, have: Math.min(have, need), need };
  });
}

/** 遊戲狀態 → 任務用的統計（帳本摘要＋game 的計數） */
export function statsOf(sum, g) {
  return { ...sum, escapes: g.stats.escapes, bites: g.stats.bites, wets: g.stats.wets, stock: g.stock };
}
