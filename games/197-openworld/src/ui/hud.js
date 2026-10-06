import { ITEMS, HOTBAR, SLOTS } from '../game/items.js';
import { WEATHER } from '../world/environment.js';

const el = (tag, cls, parent, html) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  parent?.appendChild(e);
  return e;
};

// 物品圖示：24×24 線稿，顏色跟著文字色
const ICON = {
  knife: '<path d="M4.5 19.5 9 15"/><path d="M8 13.5 18.5 3c1.2 4.6-1.6 9.6-7.5 13.5Z"/>',
  gun: '<path d="M3 7h17v4.5h-8.5l-1.5 2.5H8l-1.2 5.5H3.6L5 12.5 3 11.5Z"/><path d="M8.5 11.5v2.5"/>',
  ammo: '<path d="M5 20v-8.5a2 2 0 0 1 4 0V20ZM10 20V8.5a2 2 0 0 1 4 0V20ZM15 20v-8.5a2 2 0 0 1 4 0V20Z"/><path d="M4 20h16"/>',
  food: '<rect x="6" y="4.5" width="12" height="15" rx="2"/><path d="M6 9h12M6 15h12"/>',
  meat: '<path d="M5 13.5C4.4 8.6 9 5 14 5.8c4.2.7 6 5 3.3 8.4-3.2 4-11.6 5.2-12.3-.7Z"/><circle cx="14.2" cy="10.3" r="1.7"/>',
};
const iconSvg = (id) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true">${ICON[id] || ''}</svg>`;

const CONTROLS = [
  ['W A S D', '移動'],
  ['滑鼠', '視角'],
  ['Shift', '奔跑／快游'],
  ['Space', '跳躍／上浮／手煞車'],
  ['C', '下潛'],
  ['E', '互動（撿拾、上下車船、睡覺）'],
  ['1 – 5', '快捷列：裝備武器／使用物品'],
  ['Tab', '背包'],
  ['滑鼠左鍵', '攻擊／射擊'],
  ['R', '換彈'],
  ['G', '丟下手上物品'],
  ['V', '載具第三人稱視角'],
  ['F ／ L', '手電筒／車頭燈'],
  ['M', '靜音'],
  ['T', '切換天氣'],
  ['[ ]', '時間快轉 −／＋ 1 小時'],
  ['P', '畫質（低／中／高）'],
  ['F1', '顯示／隱藏說明'],
];

export class Hud {
  constructor(root, game) {
    this.game = game;
    this.root = root;

    this.fps = el('div', 'panel fps', root);
    this.status = el('div', 'panel status', root);
    this.crosshair = el('div', 'crosshair', root);
    this.marker = el('div', 'hitmarker', root);
    this.prompt = el('div', 'prompt', root);
    this.toasts = el('div', 'toasts', root);
    this.ammo = el('div', 'panel ammo', root);

    this.vitals = el('div', 'vitals', root);
    this.bars = {};
    for (const [key, label] of [['health', '生命'], ['stamina', '體力'], ['hunger', '飽食'], ['oxygen', '氧氣']]) {
      const row = el('div', 'bar ' + key, this.vitals);
      el('span', 'bar-label', row, label);
      const track = el('div', 'bar-track', row);
      this.bars[key] = { row, fill: el('div', 'bar-fill', track), value: -1 };
    }

    this.hotbar = el('div', 'hotbar', root);
    this.hotSlots = [];
    for (let i = 0; i < HOTBAR; i++) this.hotSlots.push(this.#slot(this.hotbar, i, true));

    this.bag = el('div', 'bag hidden', root);
    el('div', 'bag-title', this.bag, '背包');
    const grid = el('div', 'bag-grid', this.bag);
    this.bagSlots = [];
    for (let i = 0; i < SLOTS; i++) this.bagSlots.push(this.#slot(grid, i, false));
    el('div', 'bag-hint', this.bag, '左鍵：裝備／使用　右鍵：丟棄　拖曳：換位置　Tab：關閉');

    this.vignette = el('div', 'overlay vignette', root);
    this.flash = el('div', 'overlay flash', root);
    this.water = el('div', 'overlay water', root);
    this.hurt = el('div', 'overlay hurt', root);
    this.fade = el('div', 'overlay fade', root);

    this.start = el('div', 'start', root);
    const card = el('div', 'start-card', this.start);
    el('h1', '', card, '湖畔求生 · OPENWORLD');
    this.loading = el('div', 'loading', card, '載入中…');
    const list = el('div', 'controls', card);
    for (const [k, v] of CONTROLS) {
      el('kbd', '', list, k);
      el('span', '', list, v);
    }
    this.startBtn = el('button', 'start-btn', card, '點擊開始');
    el('p', 'start-note', card, '需要鍵盤與滑鼠，手機與平板無法操作。');
    this.startBtn.disabled = true;

    this.dragFrom = -1;
    this.lastPrompt = '';
    this.markerT = 0;
  }

  #slot(parent, index, hot) {
    const s = el('div', 'slot', parent);
    if (hot || index < HOTBAR) el('span', 'slot-key', s, String(index + 1));
    const icon = el('span', 'slot-icon', s);
    const count = el('span', 'slot-count', s);
    const name = el('span', 'slot-name', s);
    if (!hot) {
      s.draggable = true;
      s.addEventListener('click', () => this.game.useSlot(index));
      s.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        this.game.dropSlot(index);
      });
      s.addEventListener('dragstart', () => (this.dragFrom = index));
      s.addEventListener('dragover', (e) => e.preventDefault());
      s.addEventListener('drop', (e) => {
        e.preventDefault();
        if (this.dragFrom >= 0) this.game.inventory.swap(this.dragFrom, index);
        this.dragFrom = -1;
      });
    }
    return { root: s, icon, count, name };
  }

  setLoading(text, ready = false) {
    this.loading.textContent = text;
    this.startBtn.disabled = !ready;
    if (ready) this.loading.classList.add('done');
  }

  showStart(show, resume = false) {
    this.start.classList.toggle('hidden', !show);
    if (resume) this.startBtn.textContent = '點擊繼續';
  }

  get bagOpen() {
    return !this.bag.classList.contains('hidden');
  }

  toggleBag(open = !this.bagOpen) {
    this.bag.classList.toggle('hidden', !open);
  }

  toast(text) {
    const t = el('div', 'toast', this.toasts, text);
    while (this.toasts.children.length > 4) this.toasts.firstChild.remove();
    setTimeout(() => t.classList.add('out'), 2200);
    setTimeout(() => t.remove(), 2800);
  }

  /** NPC 對話：比一般提示停留久一點 */
  say(text) {
    const t = el('div', 'toast speech', this.toasts, text);
    while (this.toasts.children.length > 4) this.toasts.firstChild.remove();
    setTimeout(() => t.classList.add('out'), 4200);
    setTimeout(() => t.remove(), 4800);
  }

  hitMarker() {
    this.markerT = 0.25;
    this.marker.classList.add('on');
  }

  setFade(v) {
    this.fade.style.opacity = v;
  }

  refreshInventory() {
    const inv = this.game.inventory;
    const paint = (slot, i) => {
      const s = inv.slots[i];
      const def = s ? ITEMS[s.id] : null;
      const iconId = s ? s.id : '';
      if (slot.iconId !== iconId) {
        slot.iconId = iconId;
        slot.icon.innerHTML = s ? iconSvg(s.id) : '';
      }
      slot.name.textContent = def ? def.name : '';
      slot.count.textContent = s && s.count > 1 ? s.count : '';
      slot.root.classList.toggle('equipped', inv.equipped === i);
      slot.root.classList.toggle('filled', !!s);
    };
    this.hotSlots.forEach((s, i) => paint(s, i));
    this.bagSlots.forEach((s, i) => paint(s, i));
  }

  setPrompt(text) {
    if (text === this.lastPrompt) return;
    this.lastPrompt = text;
    this.prompt.innerHTML = text;
    this.prompt.classList.toggle('on', !!text);
  }

  #bar(key, value, visible = true) {
    const b = this.bars[key];
    const v = Math.round(value);
    if (b.value !== v) {
      b.value = v;
      b.fill.style.width = v + '%';
      b.row.classList.toggle('low', v < 25);
    }
    b.row.classList.toggle('hidden', !visible);
  }

  /** 每個 frame 呼叫；文字類只在內容改變時才動 DOM */
  update(dt, stats) {
    const { player, env, weapons, inventory } = this.game;
    this.#bar('health', player.health);
    this.#bar('stamina', player.stamina);
    this.#bar('hunger', player.hunger);
    this.#bar('oxygen', player.oxygen, player.oxygen < 99.5);

    if (stats) {
      this.fps.innerHTML =
        `<b class="${stats.fps < 30 ? 'bad' : stats.fps < 50 ? 'warn' : 'good'}">${stats.fps} FPS</b> ` +
        `<span>${stats.ms.toFixed(1)} ms</span><br>` +
        `<span>draw ${stats.calls}　tri ${(stats.triangles / 1000).toFixed(0)}k　草 ${(stats.blades / 1000).toFixed(0)}k</span><br>` +
        `<span>畫質 ${stats.quality}　解析度 ${stats.scale.toFixed(2)}×</span>`;
      const mode = player.vehicle ? player.vehicle.name : player.swimming ? '游泳' : '徒步';
      this.status.innerHTML = `<b>${env.clock}</b> ${WEATHER[env.weatherName].label}<br><span>${mode}　命中 ${weapons.score}</span>`;
    }

    const id = player.vehicle ? null : inventory.equippedId;
    const ammoText = id === 'gun' ? `${weapons.reload > 0 ? '換彈中…' : weapons.mag} <span>/ ${weapons.reserve}</span>` : '';
    if (ammoText !== this.lastAmmo) {
      this.lastAmmo = ammoText;
      this.ammo.innerHTML = ammoText;
      this.ammo.classList.toggle('hidden', !ammoText);
    }

    this.crosshair.classList.toggle('hidden', !!player.vehicle && player.vehicle.thirdPerson);
    if (this.markerT > 0) {
      this.markerT -= dt;
      if (this.markerT <= 0) this.marker.classList.remove('on');
    }
    this.water.style.opacity = env.underwater ? 1 : 0;
    this.flash.style.opacity = env.underwater ? 0 : Math.min(env.flash * 0.45, 0.45);
    this.hurt.style.opacity = Math.min(1, (player.hurtFlash ?? 0) + (player.health < 30 ? 0.35 : 0));
  }
}
