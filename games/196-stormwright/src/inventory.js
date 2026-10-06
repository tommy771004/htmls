// 背包資料模型（SPEC §5）
import { PICKAXE, CONSUMABLES, makeItem, AMMO_TYPES } from './items.js';

const MAT_CAP = 999;
export class Inventory {
  constructor() {
    this.slots = [null, null, null, null, null];
    this.selected = 0;
    this.ammo = { light: 0, medium: 0, heavy: 0, shells: 0 };
    this.mats = { wood: 0, stone: 0, metal: 0 };
    this.buildMat = 'wood';
  }
  current() { return this.selected === 0 ? PICKAXE : this.slots[this.selected - 1]; }
  select(i) { if (i >= 0 && i <= 5) this.selected = i; }
  add(item) {
    if (item.kind === 'ammo' || item.kind === 'mats') {
      // 上限 999：收不下的留在地上（同消耗品的 remainder），完全收不下就不撿
      const taken = item.kind === 'ammo' ? this.addAmmo(item.defId.slice(5), item.count) : this.addMat(item.defId.slice(4), item.count);
      if (taken <= 0) return { added: false, swapped: null, taken: 0 };
      if (taken < item.count) { item.count -= taken; return { added: true, swapped: null, remainder: item, taken }; }
      return { added: true, swapped: null, taken };
    }
    if (item.kind === 'consumable') {
      const max = CONSUMABLES[item.defId].stack;
      const start = item.count;
      for (const s of this.slots) {
        if (s && s.defId === item.defId && s.count < max) {
          const n = Math.min(max - s.count, item.count);
          s.count += n; item.count -= n;
          if (item.count <= 0) return { added: true, swapped: null };
        }
      }
      // 疊滿了還有剩：有空格放剩下的；否則留在地上（remainder），不換掉手上的東西
      const empty = this.slots.indexOf(null);
      if (empty >= 0) { this.slots[empty] = item; return { added: true, swapped: null, slot: empty + 1 }; }
      if (item.count < start) return { added: true, swapped: null, remainder: item };   // 疊了一部分，剩下的留在地上
      // 完全沒疊到且沒空格：落到下面的換槍邏輯
    }
    const empty = this.slots.indexOf(null);
    if (empty >= 0) { this.slots[empty] = item; return { added: true, swapped: null, slot: empty + 1 }; }
    if (this.selected === 0) return { added: false, swapped: null };
    const swapped = this.slots[this.selected - 1];
    this.slots[this.selected - 1] = item;
    return { added: true, swapped, slot: this.selected };
  }
  remove(i) { const it = this.slots[i]; this.slots[i] = null; return it; }
  addAmmo(type, n) { const a = Math.max(0, Math.min(999 - this.ammo[type], n)); this.ammo[type] += a; return a; }
  addMat(m, n) { const a = Math.min(MAT_CAP - this.mats[m], n); this.mats[m] += a; return a; }
  spendMat(m, n) { if (this.mats[m] < n) return false; this.mats[m] -= n; return true; }
  hasSpace() { return this.slots.includes(null); }
  totalMats() { return this.mats.wood + this.mats.stone + this.mats.metal; }
  find(defId) { return this.slots.findIndex((s) => s && s.defId === defId); }
  dropAll() {
    const out = [];
    for (let i = 0; i < 5; i++) if (this.slots[i]) out.push(this.slots[i]);
    this.slots = [null, null, null, null, null];
    for (const t of AMMO_TYPES) if (this.ammo[t] > 0) { out.push(makeItem('ammo_' + t, 0, this.ammo[t])); this.ammo[t] = 0; }
    for (const m of ['wood', 'stone', 'metal']) if (this.mats[m] > 0) { out.push(makeItem('mat_' + m, 0, this.mats[m])); this.mats[m] = 0; }
    this.selected = 0;
    return out;
  }
}
