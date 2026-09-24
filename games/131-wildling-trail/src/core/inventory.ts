import { getItem } from '../data/items';
import type { Bag } from './types';

export const ITEM_MAX = 99;
export const MONEY_MAX = 999_999;

export function itemCount(bag: Bag, id: string): number {
  return bag[id] ?? 0;
}

/** 放入背包，單項上限 99；回傳實際放入的數量。 */
export function addItem(bag: Bag, id: string, amount: number): number {
  getItem(id);
  const before = itemCount(bag, id);
  const after = Math.min(ITEM_MAX, before + Math.max(0, Math.floor(amount)));
  bag[id] = after;
  return after - before;
}

export function removeItem(bag: Bag, id: string, amount = 1): boolean {
  const before = itemCount(bag, id);
  if (amount <= 0 || before < amount) return false;
  bag[id] = before - amount;
  return true;
}

export interface Wallet {
  bag: Bag;
  money: number;
}

export type PurchaseResult =
  | { ok: true; spent: number }
  | { ok: false; reason: string; shortfall?: number };

/** 購買前的檢查，不改動任何資料。 */
export function purchaseCheck(wallet: Wallet, itemId: string, quantity: number): PurchaseResult {
  const item = getItem(itemId);
  if (!Number.isInteger(quantity) || quantity < 1) return { ok: false, reason: '購買數量至少要 1 個' };
  if (itemCount(wallet.bag, itemId) + quantity > ITEM_MAX) {
    return { ok: false, reason: `背包裡的${item.name}最多只能放 ${ITEM_MAX} 個` };
  }
  const cost = item.price * quantity;
  if (cost > wallet.money) {
    return { ok: false, reason: `銅貝不夠，還差 ${cost - wallet.money} 銅貝。`, shortfall: cost - wallet.money };
  }
  return { ok: true, spent: cost };
}

/** 餘額與背包同時更新；檢查失敗時兩者都不變。 */
export function purchase(wallet: Wallet, itemId: string, quantity: number): PurchaseResult {
  const check = purchaseCheck(wallet, itemId, quantity);
  if (!check.ok) return check;
  wallet.money -= check.spent;
  wallet.bag[itemId] = itemCount(wallet.bag, itemId) + quantity;
  return check;
}

export function addMoney(wallet: Wallet, amount: number): number {
  const before = wallet.money;
  wallet.money = Math.min(MONEY_MAX, Math.max(0, before + Math.floor(amount)));
  return wallet.money - before;
}
