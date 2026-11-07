// 本機戰績與設定：只存這台裝置的 localStorage。瀏覽器禁用儲存時退回記憶體，不影響遊戲。
const KEY = 'ochre-line.record.v1', SET = 'ochre-line.settings.v1';
const load = k => { try { return JSON.parse(localStorage.getItem(k)) ?? null; } catch { return null; } };
const save = (k, v) => { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch { /* 無痕模式等 */ } };
const fresh = () => ({ matches: 0, wins: 0, kills: 0, deaths: 0, roundsWon: 0, roundsLost: 0, last: null });
let rec = { ...fresh(), ...load(KEY) };

export const record = () => rec;
/** 比賽打完才記；中途離開不算。 */
export function addMatch(win, my, opp, kills, deaths) {
  rec.matches++; if (win) rec.wins++;
  rec.kills += kills; rec.deaths += deaths; rec.roundsWon += my; rec.roundsLost += opp; rec.last = { win, my, opp };
  save(KEY, rec);
}
export function clearRecord() { rec = fresh(); save(KEY, null); }
export const loadSettings = () => load(SET) ?? {};
export const saveSettings = o => save(SET, o);
