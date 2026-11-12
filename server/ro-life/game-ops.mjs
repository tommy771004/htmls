import { randomInt } from 'node:crypto';
import R from './rules-data.mjs';
import { sellValue, cardValue } from './game-rules.mjs';

// 282 線上角色的伺服器 op（引擎 nc() → POST game/op）：買礦、賣東西、精煉由伺服器在存檔上算，精煉亂數在伺服器。
// 引擎收到 {rev, doc, …} 會用 ei() 載入，所以存檔裡的 Kafra、材料、精煉值只有這裡能讓它變多（game-rules.mjs 會擋存檔自己變多）。
// applyOp(doc, body, rng) → { doc, result, log } 或 { error }；doc 是新的存檔（不改傳入的物件）。
// 錯誤碼：missing（Kafra／材料／物品不夠，引擎顯示「已經沒有需要的東西」）、bad_op（參數不對）。

const list = (v) => (Array.isArray(v) ? v : []);
const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
const int = (v) => (Number.isFinite(Number(v)) ? Math.trunc(Number(v)) : 0);
const read = (doc, key, fb) => { try { return JSON.parse(doc?.[key] ?? 'null') ?? fb; } catch { return fb; } };
const MAX_BUY = 999;

// 引擎 YE()／tl()：飾品、頭中、頭下、新手裝備不能精煉；武器用武器礦，其他用防具礦
const refineSlot = (def) => (!def || def.starter || def.slot === 'acc' || def.slot === 'head_mid' || def.slot === 'head_low' ? null : def.slot === 'weapon' ? 'weapon' : 'armor');
const roll = (rng) => rng() * 100;
export const defaultRng = () => randomInt(0, 1_000_000) / 1_000_000;

export function applyOp(doc, body, rng = defaultRng) {
  const chars = list(read(doc, 'characters.v1', []));
  const acc = obj(read(doc, 'account.v1', {}));
  acc.inventory = list(acc.inventory);
  acc.cards = obj(acc.cards);
  acc.materials = obj(acc.materials);
  acc.kafra = Math.max(0, int(acc.kafra));
  const out = (result, log, charsChanged = false) => ({
    doc: { ...doc, 'account.v1': JSON.stringify(acc), ...(charsChanged ? { 'characters.v1': JSON.stringify(chars) } : {}) },
    result, log,
  });
  const equippedBy = new Set(chars.flatMap((c) => Object.values(obj(c?.equipped)).filter(Boolean).map(String)));

  switch (body?.op) {
    case 'buy': { // 引擎 s_ 的買礦：kafra -= 單價 × 數量，材料 += 數量
      const ore = String(body.ore ?? '');
      const count = int(body.count);
      const price = R.orePrice[ore];
      if (!price || count < 1 || count > MAX_BUY) return { error: 'bad_op' };
      const cost = price * count;
      if (acc.kafra < cost) return { error: 'missing' };
      acc.kafra -= cost;
      acc.materials[ore] = int(acc.materials[ore]) + count;
      return out({}, { ore, count, cost, kafra: acc.kafra });
    }
    case 'sell': { // 引擎 s_ 的賣出：已裝備、上鎖（safe）的不賣；插著的卡退回卡片庫存；卡片照張數賣
      const uids = new Set(list(body.uids).map(String).slice(0, 500));
      let gained = 0, items = 0, cards = 0;
      acc.inventory = acc.inventory.filter((it) => {
        if (!it?.uid || !uids.has(String(it.uid)) || equippedBy.has(String(it.uid)) || it.safe) return true;
        gained += sellValue(it);
        items++;
        for (const c of list(it.cards)) if (c != null) acc.cards[c] = int(acc.cards[c]) + 1;
        return false;
      });
      for (const pair of list(body.cards).slice(0, 500)) {
        const [cid, n] = list(pair);
        const k = String(cid), have = int(acc.cards[k]), take = Math.min(Math.max(0, int(n)), have);
        if (!take) continue;
        gained += cardValue(k) * take;
        cards += take;
        acc.cards[k] = have - take;
        if (acc.cards[k] <= 0) delete acc.cards[k];
      }
      acc.kafra += gained;
      return out({ gained }, { items, cards, gained, kafra: acc.kafra });
    }
    case 'refine': { // 引擎 a_／aT：用一顆對應的礦，成功 +1；失敗時卡片毀掉、裝備壞掉（從身上卸下並移除）
      const uid = String(body.uid ?? '');
      const it = acc.inventory.find((i) => String(i?.uid) === uid);
      const def = it && R.items[String(it.itemId)];
      const slot = refineSlot(def);
      const lv = int(it?.refine);
      if (!it) return { error: 'missing' };
      if (!slot || lv >= R.maxRefine) return { error: 'bad_op' };
      const ore = String(R.refineOre[slot][lv]);
      if (int(acc.materials[ore]) <= 0) return { error: 'missing' };
      acc.materials[ore] = int(acc.materials[ore]) - 1;
      if (acc.materials[ore] <= 0) delete acc.materials[ore];
      const rate = R.refineRate[lv] ?? 0;
      const ok = roll(rng) < rate;
      let charsChanged = false;
      if (ok) it.refine = lv + 1;
      else {
        acc.inventory = acc.inventory.filter((i) => i !== it);
        for (const c of chars) for (const [k, v] of Object.entries(obj(c?.equipped))) if (String(v) === uid) { delete c.equipped[k]; charsChanged = true; }
      }
      return out({ ok }, { item: String(it.itemId), from: lv, ok, rate }, charsChanged);
    }
    case 'mail': return { error: 'missing' }; // 信箱還沒有內容（引擎看到 missing 會當作信已經領過）
    default: return { error: 'bad_op' };
  }
}
