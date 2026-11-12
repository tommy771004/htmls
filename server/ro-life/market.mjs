// 282 線上角色的市場與信箱（純邏輯；資料庫在 store.mjs，路由在 game.mjs）。規格見 games/282-ro-life/PLAN-trade-party.md「市場＋信箱」。
// 上架：物品從賣家的伺服器存檔拿出來放進 ro_market；購買：買家的存檔扣 Kafra、拿到物品，賣家收到一封附 Kafra 的信；
// 取消：物品直接回存檔；過期：寄回信箱。所有改存檔的動作都走 POST game/op，回 {rev, doc, trade} 讓引擎 ei() 套用，
// 不在背後改玩家的存檔（避免那一頁下次存檔 409）。
import R from './rules-data.mjs';
import { cleanItem } from './trade.mjs';

export const MARKET_FEE = 0.03; // 賣出時從價格扣掉（Kafra 回收）
export const MARKET_DAYS = 7;
export const MARKET_MAX_LISTINGS = 20;
export const MARKET_PRICE_MAX = 1_000_000_000;
export const MARKET_PAGE = 40;
export const MARKET_IDS_MAX = 60; // 名稱搜尋：頁面把名稱換成物品 id 再查
const COUNT_MAX = 9_999;

const list = (v) => (Array.isArray(v) ? v : []);
const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
const int = (v) => (Number.isFinite(Number(v)) ? Math.trunc(Number(v)) : 0);
const read = (doc, key, fb) => { try { return JSON.parse(doc?.[key] ?? 'null') ?? fb; } catch { return fb; } };
const ORES = new Set(Object.values(R.ores ?? {}).map(String).concat(Object.keys(R.orePrice ?? {})));

function open(doc) {
  const chars = list(read(doc, 'characters.v1', []));
  const acc = obj(read(doc, 'account.v1', {}));
  acc.inventory = list(acc.inventory);
  acc.cards = obj(acc.cards);
  acc.materials = obj(acc.materials);
  acc.kafra = Math.max(0, int(acc.kafra));
  const worn = new Set(chars.flatMap((c) => Object.values(obj(c?.equipped)).filter(Boolean).map(String)));
  return { chars, acc, worn, out: () => ({ ...doc, 'account.v1': JSON.stringify(acc) }) };
}
export const sellerPays = (price) => price - Math.floor(price * MARKET_FEE);

// 上架：{uid} 或 {card, count} 或 {ore, count}，加 price → { doc, listing:{kind, itemId, item, count, price} } 或 { error }
export function takeForListing(doc, body) {
  const price = int(body?.price);
  if (!(price >= 1 && price <= MARKET_PRICE_MAX)) return { error: 'bad_op' };
  const S = open(doc);
  if (!S.chars.length) return { error: 'missing' };
  if (body.uid != null) {
    const it = S.acc.inventory.find((i) => String(i?.uid) === String(body.uid));
    if (!it) return { error: 'missing' };
    if (S.worn.has(String(it.uid)) || it.safe || R.items[String(it.itemId)]?.starter || !R.items[String(it.itemId)]) return { error: 'bad_op' };
    S.acc.inventory = S.acc.inventory.filter((i) => i !== it);
    const item = cleanItem(it);
    return { doc: S.out(), listing: { kind: 'gear', itemId: item.itemId, item, count: 1, price } };
  }
  const count = int(body?.count);
  if (!(count >= 1 && count <= COUNT_MAX)) return { error: 'bad_op' };
  if (body.card != null) {
    const id = String(int(body.card));
    if (!R.cards[id]) return { error: 'bad_op' };
    if (int(S.acc.cards[id]) < count) return { error: 'missing' };
    S.acc.cards[id] = int(S.acc.cards[id]) - count;
    if (S.acc.cards[id] <= 0) delete S.acc.cards[id];
    return { doc: S.out(), listing: { kind: 'card', itemId: Number(id), item: null, count, price } };
  }
  if (body.ore != null) {
    const id = String(int(body.ore));
    if (!ORES.has(id)) return { error: 'bad_op' };
    if (int(S.acc.materials[id]) < count) return { error: 'missing' };
    S.acc.materials[id] = int(S.acc.materials[id]) - count;
    if (S.acc.materials[id] <= 0) delete S.acc.materials[id];
    return { doc: S.out(), listing: { kind: 'ore', itemId: Number(id), item: null, count, price } };
  }
  return { error: 'bad_op' };
}

// 上架的東西 → 信件附件格式（引擎 M_()：gear 陣列、cards／ores 是 {id: n}）
export function attachOf(l) {
  return {
    gear: l.kind === 'gear' && l.item ? [l.item] : [],
    cards: l.kind === 'card' ? { [l.itemId]: l.count } : {},
    ores: l.kind === 'ore' ? { [l.itemId]: l.count } : {},
    kafra: 0,
  };
}

// 把附件加進存檔（領信、取消上架、購買）。物品 uid 撞號時換一個新的
export function addAttach(doc, attach, { pay = 0 } = {}) {
  const S = open(doc);
  if (!S.chars.length) return { error: 'missing' };
  if (S.acc.kafra < pay) return { error: 'kafra' };
  S.acc.kafra -= pay;
  const have = new Set(S.acc.inventory.map((i) => String(i?.uid)));
  for (const g of list(attach?.gear)) {
    if (!g || typeof g !== 'object') continue;
    const it = cleanItem(g);
    if (have.has(it.uid)) it.uid = `${it.uid}-${Date.now().toString(36)}`;
    have.add(it.uid);
    S.acc.inventory.push(it);
  }
  for (const [id, n] of Object.entries(obj(attach?.cards))) S.acc.cards[id] = int(S.acc.cards[id]) + Math.max(0, int(n));
  for (const [id, n] of Object.entries(obj(attach?.ores))) S.acc.materials[id] = int(S.acc.materials[id]) + Math.max(0, int(n));
  S.acc.kafra += Math.max(0, int(attach?.kafra));
  return { doc: S.out() };
}

// ---- 信件內容（三語；引擎的 nd() 照語系挑） ----
export const MAIL_TEXT = {
  sold: {
    title: { es: 'Mercado: vendido', en: 'Market: sold', zh: '市場：已售出' },
    body: { es: 'Alguien ha comprado lo que pusiste en el mercado. Aquí tienes los Puntos Kafra (menos la comisión del 3 %).', en: 'Someone bought your market listing. Here are your Kafra Points (minus the 3% fee).', zh: '你上架的物品已售出，收款在附件（已扣 3% 手續費）。' },
  },
  expired: {
    title: { es: 'Mercado: caducado', en: 'Market: expired', zh: '市場：上架到期' },
    body: { es: 'Tu anuncio del mercado ha caducado sin venderse. Te lo devolvemos.', en: 'Your market listing expired unsold. Here it is back.', zh: '你上架的物品到期沒有賣出，退回在附件。' },
  },
};

// 資料庫列 → 引擎信箱的格式
export const mailView = (r) => ({
  id: Number(r.id), kind: r.kind, title: r.title, body: r.body, at: new Date(r.created_at).getTime(),
  read: !!r.read_at, claimed: !!r.claimed_at, ...(r.attach ? { attach: r.attach } : {}),
});
export const claimable = (m) => !!m.attach && !m.claimed;

// 市場清單給頁面看的樣子（只有清理過的物品與賣家名）
export const listingView = (r, me = null) => ({
  id: Number(r.id), kind: r.kind, itemId: Number(r.item_id), count: Number(r.count), price: Number(r.price),
  ...(r.item ? { item: r.item } : {}), seller: String(r.seller_name ?? '').slice(0, 24), mine: me != null && String(r.seller_id) === String(me),
  status: r.status, expires: new Date(r.expires_at).getTime(),
});

// 查詢參數：kind（gear／card／ore／空）、ids（逗號分隔的物品 id）、page
export function marketQuery(q) {
  const kind = ['gear', 'card', 'ore'].includes(q?.get?.('kind')) ? q.get('kind') : '';
  const ids = String(q?.get?.('ids') ?? '').split(',').map((x) => int(x)).filter((x) => x > 0).slice(0, MARKET_IDS_MAX);
  const page = Math.max(0, Math.min(200, int(q?.get?.('page'))));
  return { kind, ids, page };
}
