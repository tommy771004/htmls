// 每日結算：讀帳本摘要（score.js 的 summary）＋當天的任務結果，給星等、全勤獎金、任務獎勵與訂戶增減。
import { MISSION_PTS } from './missions.js';
// 星等看送達率：全送到 3 星、80% 2 星、50% 1 星；砸窗或撞車太多扣一顆。漏送的訂戶會退訂（一天最多 3 戶）。
export const SETTLE = { perfectBonus: 500, leftover: 20, starAt: [0.5, 0.8, 1.0], windowsLimit: 2, crashLimit: 5, lostCap: 3 };

/** sum：score.js 的 summary；stock：騎完時剩下的報紙（一份加 leftover 分）；missions：evalMissions(…, true) 的結果 */
export function settle(sum, stock = 0, missions = []) {
  const ratio = sum.subs ? sum.delivered / sum.subs : 1;
  let stars = SETTLE.starAt.filter((r) => ratio >= r - 1e-9).length;
  const sloppy = sum.windows > SETTLE.windowsLimit || sum.bumps > SETTLE.crashLimit;
  if (sloppy) stars = Math.max(0, stars - 1);
  const perfect = ratio >= 1;
  const bonus = perfect ? SETTLE.perfectBonus : 0, spare = stock * SETTLE.leftover;
  const done = missions.filter((m) => m.state === 'done').map((m) => m.spec), mission = done.length * MISSION_PTS;
  const lost = Math.min(sum.missed, SETTLE.lostCap);
  const gained = stars >= 3 ? 2 : stars === 2 ? 1 : 0;
  return { ratio, stars, sloppy, perfect, bonus, spare, stock, missions, missionsDone: done, mission,
    total: sum.score + bonus + spare + mission, gained, lost, net: gained - lost };
}
