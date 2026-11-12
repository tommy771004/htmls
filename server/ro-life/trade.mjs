// 282 線上角色的交易結算（伺服器權威）：大廳只撮合，成交時呼叫 POST /api/ro/trade/settle，
// 這裡在兩個帳號的伺服器存檔（ro_game_save）上搬東西，一個交易裡寫完兩邊（store.tradeGameSaves）。
// 用戶端收到 tradeDone 後只重抓存檔（引擎 settled() → GET save），自己不改庫存。
//
// 可交易：沒裝在任何角色身上、沒上鎖（safe）、不是新手裝備的物品；卡片庫存、礦石（materials）、Kafra 點數。
// 引擎的交易視窗只讓玩家放「伺服器清單」（GET／PUT save 與 op 回應的 trade）裡的東西，清單由 tradeLedger() 算。
// 出價裡的裝備是用戶端給對方看的樣子：結算時逐件和伺服器上的那件比對（物品、精煉、品質、詞綴、卡片…），
// 不一樣就當作「有人已不再擁有」（missing），避免讓對方看到假的 +10。
//
// 大廳 → 伺服器：POST trade/settle {p, sig}；p 是 JSON 字串 {id, ts, a:{acc, offer}, b:{acc, offer}}，
// sig = HMAC-SHA256(RO_LOBBY_SECRET, "trade:" + p)。同一個 id 重送（回應沒收到）時，兩邊存檔的 wid 已是 trade-<id> 就直接回成功。
import { hmacB64, sameStr } from './lobby-core.mjs';
import R from './rules-data.mjs';

export const SETTLE_MAX_AGE = 60_000;
export const OFFER_GEAR_MAX = 12;
export const OFFER_STACK_MAX = 20;
export const KAFRA_MAX = 1_000_000_000;
const COUNT_MAX = 99_999;
const UID = /^[\w.:-]{1,64}$/;
const KEY = /^[A-Za-z0-9_.]{1,40}$/;

const list = (v) => (Array.isArray(v) ? v : []);
const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
const int = (v) => (Number.isFinite(Number(v)) ? Math.trunc(Number(v)) : 0);
const read = (doc, key, fb) => { try { return JSON.parse(doc?.[key] ?? 'null') ?? fb; } catch { return fb; } };
const equippedSet = (chars) => new Set(list(chars).flatMap((c) => Object.values(obj(c?.equipped)).filter(Boolean).map(String)));
const tradable = (it, worn) => !!it?.uid && !worn.has(String(it.uid)) && !it.safe && !R.items[String(it.itemId)]?.starter;

// 引擎的 b1()：{uids, cards:{id:n}, ores:{id:n}, kafra}
export function tradeLedger(doc) {
  const chars = list(read(doc, 'characters.v1', []));
  const acc = obj(read(doc, 'account.v1', {}));
  const worn = equippedSet(chars);
  const counts = (o) => Object.fromEntries(Object.entries(obj(o)).map(([k, v]) => [k, Math.max(0, int(v))]).filter(([, v]) => v > 0));
  return {
    uids: list(acc.inventory).filter((it) => tradable(it, worn)).map((it) => String(it.uid)),
    cards: counts(acc.cards),
    ores: counts(acc.materials),
    kafra: Math.max(0, int(acc.kafra)),
  };
}

// 出價（引擎 D0()：{gear:[物品], cards:[[id, n]], ores:[[id, n]], kafra}）清理成固定格式；格式不對回 null
const look = (it) => ({
  uid: String(it.uid),
  itemId: int(it.itemId),
  refine: Math.max(0, Math.min(20, int(it.refine))),
  quality: Math.max(0, Math.min(9, int(it.quality))),
  ...(it.tier != null ? { tier: int(it.tier) } : {}),
  ...(it.ilvl != null ? { ilvl: int(it.ilvl) } : {}),
  cards: list(it.cards).slice(0, 4).map((c) => (c == null ? null : int(c))),
  affixes: list(it.affixes).slice(0, 8).filter((a) => a && KEY.test(String(a.stat))).map((a) => ({ stat: String(a.stat), value: Number.isFinite(Number(a.value)) ? Number(a.value) : 0 })),
});
// 物品跨帳號（交易、市場、信箱）時重建：只留引擎物品的欄位（引擎建物品只用這幾個），safe（上鎖）、owner（新手）不帶過去；
// 詞綴保留原本的鍵（引擎可能還有別的欄位），但只收基本型別的值
// 詞綴的字串只會是識別字（stat、skill 的 id）：別的字串一律丟掉。引擎的物品提示是 innerHTML，對方的存檔內容不能帶標籤進來
const IDENT = /^[A-Za-z0-9_.:-]{1,40}$/;
const PRIM = (v) => (typeof v === 'string' ? (IDENT.test(v) ? v : undefined) : typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'boolean' ? v : undefined);
export function cleanItem(it) {
  const out = { uid: String(it?.uid ?? '').replace(/[^\w.:-]/g, '_').slice(0, 64) || 'item', itemId: int(it.itemId), quality: Math.max(0, Math.min(9, int(it.quality))), refine: Math.max(0, Math.min(20, int(it.refine))) };
  out.cards = list(it.cards).slice(0, 4).map((c) => (c == null ? null : int(c)));
  out.affixes = list(it.affixes).slice(0, 8).filter((a) => a && typeof a === 'object').map((a) => Object.fromEntries(Object.entries(a).filter(([k]) => KEY.test(k)).slice(0, 6).map(([k, v]) => [k, PRIM(v)]).filter(([, v]) => v !== undefined)));
  if (it.ilvl != null) out.ilvl = int(it.ilvl);
  if (it.tier != null) out.tier = int(it.tier);
  return out;
}
export function cleanOffer(o) {
  if (!o || typeof o !== 'object') return null;
  const gear = list(o.gear), cards = list(o.cards), ores = list(o.ores);
  if (gear.length > OFFER_GEAR_MAX || cards.length > OFFER_STACK_MAX || ores.length > OFFER_STACK_MAX) return null;
  if (gear.some((g) => !g || !UID.test(String(g.uid ?? '')))) return null;
  const stacks = (pairs) => {
    const out = new Map();
    for (const p of pairs) {
      const [id, n] = list(p);
      if (!KEY.test(String(id ?? '')) || !(int(n) >= 1)) return null;
      out.set(String(id), Math.min(COUNT_MAX, (out.get(String(id)) ?? 0) + int(n)));
    }
    return [...out].map(([id, n]) => [/^\d+$/.test(id) ? Number(id) : id, n]);
  };
  const c = stacks(cards), r = stacks(ores);
  if (!c || !r) return null;
  const uids = gear.map((g) => String(g.uid));
  if (new Set(uids).size !== uids.length) return null;
  return { gear: gear.map(look), cards: c, ores: r, kafra: Math.max(0, Math.min(KAFRA_MAX, int(o.kafra))) };
}
export const emptyOffer = (o) => !o || (!o.gear.length && !o.cards.length && !o.ores.length && !o.kafra);

// 在兩份存檔上搬東西（不改傳入的物件）→ { docA, docB, a:{give, get}, b:{give, get} } 或 { error }
//   missing：有人已經沒有出價裡的東西，或出價的樣子和伺服器上的不一樣
//   offline：有一邊沒有線上角色（從沒用線上模式玩過）
export function applyTrade(docA, docB, offerA, offerB) {
  const side = (doc) => {
    const chars = list(read(doc, 'characters.v1', []));
    const acc = obj(read(doc, 'account.v1', {}));
    acc.inventory = list(acc.inventory);
    acc.cards = obj(acc.cards);
    acc.materials = obj(acc.materials);
    acc.kafra = Math.max(0, int(acc.kafra));
    return { chars, acc, worn: equippedSet(chars) };
  };
  const A = side(docA), B = side(docB);
  if (!A.chars.length || !B.chars.length) return { error: 'offline' };
  // 從一邊拿出出價裡的東西（拿真的那件，不用用戶端給的樣子）
  const take = (S, offer) => {
    const items = [];
    for (const g of offer.gear) {
      const it = S.acc.inventory.find((i) => String(i?.uid) === g.uid);
      if (!it || !tradable(it, S.worn) || JSON.stringify(look(it)) !== JSON.stringify(g)) return null;
      items.push(it);
    }
    for (const [id, n] of offer.cards) if (int(S.acc.cards[id]) < n) return null;
    for (const [id, n] of offer.ores) if (int(S.acc.materials[id]) < n) return null;
    if (S.acc.kafra < offer.kafra) return null;
    const gone = new Set(items.map((i) => String(i.uid)));
    S.acc.inventory = S.acc.inventory.filter((i) => !gone.has(String(i?.uid)));
    for (const [id, n] of offer.cards) { S.acc.cards[id] = int(S.acc.cards[id]) - n; if (S.acc.cards[id] <= 0) delete S.acc.cards[id]; }
    for (const [id, n] of offer.ores) { S.acc.materials[id] = int(S.acc.materials[id]) - n; if (S.acc.materials[id] <= 0) delete S.acc.materials[id]; }
    S.acc.kafra -= offer.kafra;
    return { gear: items, cards: offer.cards, ores: offer.ores, kafra: offer.kafra };
  };
  const put = (S, got) => {
    const have = new Set(S.acc.inventory.map((i) => String(i?.uid)));
    if (got.gear.some((i) => have.has(String(i.uid)))) return false; // uid 撞號（理論上不會發生）
    S.acc.inventory.push(...got.gear.map(cleanItem));
    for (const [id, n] of got.cards) S.acc.cards[id] = int(S.acc.cards[id]) + n;
    for (const [id, n] of got.ores) S.acc.materials[id] = int(S.acc.materials[id]) + n;
    S.acc.kafra += got.kafra;
    return true;
  };
  const fromA = take(A, offerA), fromB = take(B, offerB);
  if (!fromA || !fromB) return { error: 'missing' };
  if (!put(A, fromB) || !put(B, fromA)) return { error: 'missing' };
  const pub = (x) => ({ gear: x.gear.map(look), cards: x.cards, ores: x.ores, kafra: x.kafra });
  return {
    docA: { ...docA, 'account.v1': JSON.stringify(A.acc) },
    docB: { ...docB, 'account.v1': JSON.stringify(B.acc) },
    a: { give: pub(fromA), get: pub(fromB) },
    b: { give: pub(fromB), get: pub(fromA) },
  };
}

// ---- 簽章（大廳 Worker 與 Vercel 共用 RO_LOBBY_SECRET；前綴 trade: 讓入場票不能拿來當結算授權）----
export async function signSettle(secret, payload) {
  const p = JSON.stringify(payload);
  return { p, sig: await hmacB64(secret, 'trade:' + p) };
}
export async function openSettle(secret, body, now = Date.now()) {
  if (!secret || typeof body?.p !== 'string' || typeof body?.sig !== 'string' || body.p.length > 64_000) return null;
  if (!sameStr(await hmacB64(secret, 'trade:' + body.p), body.sig)) return null;
  let x;
  try { x = JSON.parse(body.p); } catch { return null; }
  if (!x || typeof x.id !== 'string' || !/^[\w-]{8,40}$/.test(x.id) || Math.abs(now - Number(x.ts)) > SETTLE_MAX_AGE) return null;
  // 大廳的帳號 id 是字串（入場票的 a）；資料庫與記憶體版的帳號 id 是數字
  const accOf = (v) => { const t = String(v ?? ''); return /^\d{1,15}$/.test(t) ? Number(t) : t; };
  const a = { acc: accOf(x.a?.acc), offer: cleanOffer(x.a?.offer) };
  const b = { acc: accOf(x.b?.acc), offer: cleanOffer(x.b?.offer) };
  if (!a.acc || !b.acc || a.acc === b.acc || !a.offer || !b.offer) return null;
  return { id: x.id, a, b };
}

// 結算：讀兩邊最新存檔 → applyTrade → 一個交易寫兩邊（rev 對不上就重來，最多三次）
export async function settleTrade(store, { id, a, b }) {
  if (emptyOffer(a.offer) && emptyOffer(b.offer)) return { error: 'cancel' };
  const wid = `trade-${id}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    const [sa, sb] = await Promise.all([store.getGameSave(a.acc), store.getGameSave(b.acc)]);
    if (sa.wid === wid && sb.wid === wid) return { ok: true, again: true, a: { give: a.offer, get: b.offer }, b: { give: b.offer, get: a.offer } };
    const r = applyTrade(sa.doc, sb.doc, a.offer, b.offer);
    if (r.error) return r;
    const done = await store.tradeGameSaves({ acc: a.acc, rev: sa.rev, doc: r.docA }, { acc: b.acc, rev: sb.rev, doc: r.docB }, wid);
    if (!done) continue;
    const log = (me, other, x, rev) => store.addGameLog(me, 'trade', { rev, flags: [], detail: { trade: id, with: other, give: brief(x.give), get: brief(x.get) } }).catch(() => {});
    await Promise.all([log(a.acc, b.acc, r.a, done.revA), log(b.acc, a.acc, r.b, done.revB)]);
    return { ok: true, a: r.a, b: r.b };
  }
  return { error: 'busy' };
}
const brief = (x) => ({ gear: x.gear.map((g) => [g.itemId, g.refine, g.quality]), cards: x.cards, ores: x.ores, kafra: x.kafra });

// 大廳端：把結算交給 Vercel（Worker 與本機 npm start 都走這條）。網路錯誤用同一個 id 再送一次（伺服器那邊會認得已經做過）
export function makeSettle({ url, secret, fetchImpl = globalThis['fe' + 'tch'], log = () => {} }) {
  if (!url || !secret) return null;
  return async (payload) => {
    const body = JSON.stringify(await signSettle(secret, payload));
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const r = await fetchImpl(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body });
        if (r.status >= 500) throw Error(`settle ${r.status}`);
        const j = await r.json().catch(() => ({}));
        return r.ok ? j : { error: 'cancel', status: r.status };
      } catch (e) {
        log('[ro-lobby] settle', e?.message ?? e);
      }
    }
    return { error: 'cancel' };
  };
}
