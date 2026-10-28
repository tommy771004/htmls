// 存檔：一週的進度（今天是第幾天、每天的分數與星等、累積的訂戶增減、各天最佳）。
// 純資料函式＋localStorage 包裝；讀寫失敗（私密視窗、被封鎖）就當成沒有存檔，遊戲照常進行。
export const SAVE_KEY = 'ml273.save.v1';

export function freshSave() { return { v: 1, week: 1, day: 0, subsDelta: 0, results: [], best: [] }; }

function valid(s) {
  return s && s.v === 1 && Number.isInteger(s.day) && s.day >= 0 && s.day <= 7 && Array.isArray(s.results) && Array.isArray(s.best) && Number.isFinite(s.subsDelta);
}

/** 第 dayIndex 天的結算結果記進存檔（回傳新物件）。七天都騎完 weekDone 為真，下一次 nextWeek() 開新的一週 */
export function applyResult(s, dayIndex, res) {
  const n = structuredClone(s);
  const prev = n.results[dayIndex];
  const missions = [...new Set([...(prev?.missions || []), ...(res.missionsDone || [])])];   // 任務完成過就一直算
  n.results[dayIndex] = { score: Math.max(res.total, prev?.score || 0), stars: Math.max(res.stars, prev?.stars || 0), delivered: res.delivered, subs: res.subs, missions };
  n.best[dayIndex] = Math.max(n.best[dayIndex] || 0, res.total);
  if (dayIndex === n.day) { n.subsDelta = Math.max(-6, Math.min(6, n.subsDelta + res.net)); n.day = dayIndex + 1; }
  n.weekDone = n.day >= 7;
  return n;
}
export function nextWeek(s) { return { ...freshSave(), week: s.week + 1, best: [...s.best] }; }
export const weekTotal = (s) => s.results.reduce((a, r) => a + (r ? r.score : 0), 0);

export function storage() { try { return globalThis.localStorage || null; } catch { return null; } }
export function loadSave(st = storage()) {
  try { const s = JSON.parse(st.getItem(SAVE_KEY)); if (valid(s)) return s; } catch { /* 沒有或壞掉 */ }
  return freshSave();
}
export function writeSave(s, st = storage()) {
  try { st.setItem(SAVE_KEY, JSON.stringify(s)); return true; } catch { return false; }
}
