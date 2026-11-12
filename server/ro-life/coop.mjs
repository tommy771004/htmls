// 282 合作關卡的收據與擲骰（純函式；大廳 lobby-party.mjs 簽、Vercel 的 game.mjs 驗，兩邊共用 RO_LOBBY_SECRET）。
// 收據是 {p, sig}：p 是 JSON 字串，sig = HMAC-SHA256(密鑰, "<種類>:" + p)。種類當前綴，入場票、交易結算、兩種收據不能互相冒用。
//   行程收據 trip：出發時大廳發給每個隊員，頁面在 POST game/run 帶上 → 伺服器知道這張憑證是幾人隊、哪一關
//     {a 帳號, tid 這一趟的編號, stage, n 人數, at}
//   結算收據 tripend：本局結束（房主送 over）或頁面要求（runEnd）時發，頁面在結算的 PUT game/save 帶上
//     {a, tid, stage, n, secs 這個人在本局連線的秒數, end 'win'|'lose'|null, host 是不是房主, killed 房主宣布打倒過的怪物種類,
//      won 這個人擲骰拿到的東西 [[kind, ref, quality]…], full 掉落帳是否完整（全程由大廳擲骰、沒有落單過）, rolls 開骰次數, at}
import { hmacB64, sameStr } from './lobby-core.mjs';

export const TRIP_MAX_AGE = 5 * 60_000; // 行程收據發出後多久內可以拿來換憑證
const MAX_RECEIPT = 64_000;

export async function signReceipt(sign, kind, payload) {
  const p = JSON.stringify(payload);
  return { p, sig: await sign(`${kind}:${p}`) };
}
export const signer = (secret) => (text) => hmacB64(secret, text);

// 驗章後回 payload；格式或簽章不對回 null
export async function openReceipt(secret, kind, rc) {
  if (!secret || !rc || typeof rc.p !== 'string' || typeof rc.sig !== 'string' || rc.p.length > MAX_RECEIPT || rc.sig.length > 200) return null;
  if (!sameStr(await hmacB64(secret, `${kind}:${rc.p}`), rc.sig)) return null;
  try { const x = JSON.parse(rc.p); return x && typeof x === 'object' && typeof x.tid === 'string' && /^[0-9a-f]{8,32}$/.test(x.tid) ? x : null; } catch { return null; }
}

// 擲骰（同引擎 resolveRoll）：需求（need）優先於貪婪（greed），放棄（pass）不擲；各擲 1～100，最高的拿走，同分的再擲。
// who：開骰時在場的隊員；picks：{mid: 'need'|'greed'|'pass'}，沒選的當放棄。回 {r: [[mid, 選擇, 點數]…], win: mid 或 0}
export function rollDice(who, picks, d100) {
  const r = who.map((mid) => { const c = picks[mid] ?? 'pass'; return [mid, c, c === 'pass' ? 0 : d100()]; });
  const need = r.filter((x) => x[1] === 'need');
  let top = need.length ? need : r.filter((x) => x[1] === 'greed');
  for (let guard = 0; top.length > 1 && guard < 50; guard++) {
    const best = Math.max(...top.map((x) => x[2]));
    top = top.filter((x) => x[2] === best);
    if (top.length > 1) for (const x of top) x[2] = d100();
  }
  return { r, win: top[0]?.[0] ?? 0 };
}
