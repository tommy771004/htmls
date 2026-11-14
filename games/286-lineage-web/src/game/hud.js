// 286 天堂實境客戶端：底部狀態列、快捷鍵 F5~F12、道具／裝備、法術書、小地圖、內掛設定與 NPC 互動視窗
import { assetUrl } from '../app.js';
import { MAP_NAMES } from './world-state.js';

const CLASS_LABELS = {
  royal: '王族',
  knight: '騎士',
  elf: '妖精',
  mage: '法師',
};

const QUICKBAR_KEYS = ['F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12'];

const NPC_DIALOGUE_START = {
  朵琳: 'dorin',
  潘朵拉: 'pandora',
  法林: 'farlin1',
  茱迪思: 'judice1',
  拉達: 'ladar1',
  林果: 'lengo1',
  夢娜: 'mona1',
  莫麗雅: 'moria1',
  丁: 'touma1',
};

const TELEPORT_DESTINATIONS = [
  { label: '說話之島村莊中央', map: 0, x: 32578, y: 32943, price: 30 },
  { label: '說話之島東北森林（練功區）', map: 0, x: 32645, y: 32840, price: 50 },
  { label: '說話之島地監入口外', map: 0, x: 32480, y: 32854, price: 60 },
  { label: '說話之島地監 1樓（骷髏／食屍鬼）', map: 1, x: 32669, y: 32802, price: 100 },
  { label: '說話之島地監 2樓（狼人／巴風特試煉）', map: 2, x: 32662, y: 32874, price: 150 },
  { label: '甘特之家（導師試煉）', map: 3, x: 32675, y: 32814, price: 80 },
];

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export class GameHud {
  constructor({ rootEl, world, autoHunt, onReturnToSelect, onActionNearest }) {
    this.rootEl = rootEl;
    this.world = world;
    this.autoHunt = autoHunt;
    this.onReturnToSelect = onReturnToSelect;
    this.onActionNearest = onActionNearest;

    this.activeModal = null;
    this.selectedItemId = null;
    this.npcSession = null; // { npc, mode: 'talk'|'buy'|'sell'|'deposit'|'withdraw'|'teleport', dialogueKey }
    this.lastRenderKey = '';

    this.elements = this.#mountDom();
    this.sync(true);
  }

  #mountDom() {
    const topStrip = document.createElement('div');
    topStrip.className = 'll-top-strip';
    topStrip.innerHTML = `
      <div style="display:flex;flex-wrap:wrap;gap:6px;align-items:flex-start;">
        <div class="ll-map-pill" data-role="map-pill">
          <span class="ll-map-name" data-role="map-name">說話之島</span>
          <span class="ll-coords" data-role="coords">32578, 32943</span>
        </div>
        <div class="ll-target-pill" data-role="target-pill" hidden>
          <span class="ll-target-name" data-role="target-name"></span>
          <div class="ll-target-bar"><div class="ll-target-fill" data-role="target-fill" style="width:100%"></div></div>
        </div>
      </div>
      <div class="ll-top-actions">
        <button type="button" class="ll-mini-btn" data-act="attack-nearest" title="鎖定最近怪物 (Space)">鎖敵攻擊</button>
        <button type="button" class="ll-mini-btn" data-act="pickup-nearest" title="拾取附近道具">拾取</button>
        <button type="button" class="ll-mini-btn" data-act="toggle-auto" title="切換內掛符石 (H)">內掛：關</button>
        <button type="button" class="ll-mini-btn" data-act="open-system" title="系統與返回選角 (Esc)">選單</button>
      </div>
    `;

    const modalLayer = document.createElement('div');
    modalLayer.id = 'll-modal-layer';
    modalLayer.hidden = true;

    const bottomHud = document.createElement('div');
    bottomHud.id = 'll-hud-bottom';
    bottomHud.style.backgroundImage = `url("${assetUrl('/lineage163/ui-redraw-v8/406.png')}")`;
    bottomHud.innerHTML = `
      <div class="ll-hud-backdrop">
        <div class="ll-vitals-col">
          <div class="ll-char-line">
            <span class="ll-char-title" data-role="char-title">勇者</span>
            <span class="ll-lawful" data-role="lawful">中立 0</span>
          </div>
          <div class="ll-gauge-row">
            <span class="ll-gauge-label">HP</span>
            <div class="ll-gauge-track"><div class="ll-gauge-fill hp" data-role="hp-fill"></div><span class="ll-gauge-text" data-role="hp-text"></span></div>
          </div>
          <div class="ll-gauge-row">
            <span class="ll-gauge-label">MP</span>
            <div class="ll-gauge-track"><div class="ll-gauge-fill mp" data-role="mp-fill"></div><span class="ll-gauge-text" data-role="mp-text"></span></div>
          </div>
          <div class="ll-gauge-row">
            <span class="ll-gauge-label">EXP</span>
            <div class="ll-gauge-track"><div class="ll-gauge-fill exp" data-role="exp-fill"></div><span class="ll-gauge-text" data-role="exp-text"></span></div>
          </div>
          <div class="ll-stat-chips" data-role="stat-chips"></div>
        </div>
        <div class="ll-log-col" data-role="log-box"></div>
        <div class="ll-right-col">
          <div class="ll-quickbar" data-role="quickbar"></div>
          <div class="ll-hud-buttons">
            <button type="button" class="ll-hud-btn" data-win="inventory">道具(I)</button>
            <button type="button" class="ll-hud-btn" data-win="spells">魔法(K)</button>
            <button type="button" class="ll-hud-btn" data-win="status">狀態(S)</button>
            <button type="button" class="ll-hud-btn" data-win="map">地圖(M)</button>
            <button type="button" class="ll-hud-btn" data-win="auto">內掛(H)</button>
            <button type="button" class="ll-hud-btn" data-win="system">系統</button>
          </div>
        </div>
      </div>
    `;

    this.rootEl.appendChild(topStrip);
    this.rootEl.appendChild(modalLayer);
    this.rootEl.appendChild(bottomHud);

    topStrip.addEventListener('click', (ev) => {
      const btn = ev.target.closest('[data-act]');
      if (!btn) return;
      const act = btn.dataset.act;
      if (act === 'attack-nearest') this.onActionNearest?.('attack');
      else if (act === 'pickup-nearest') this.onActionNearest?.('pickup');
      else if (act === 'toggle-auto') {
        this.autoHunt.toggle();
        this.sync(true);
      } else if (act === 'open-system') {
        this.toggleModal('system');
      }
    });

    bottomHud.addEventListener('click', (ev) => {
      const qbtn = ev.target.closest('[data-qidx]');
      if (qbtn) {
        this.triggerQuickbar(Number(qbtn.dataset.qidx));
        return;
      }
      const wbtn = ev.target.closest('[data-win]');
      if (wbtn) {
        this.toggleModal(wbtn.dataset.win);
      }
    });

    modalLayer.addEventListener('click', (ev) => this.#handleModalClick(ev));
    modalLayer.addEventListener('input', (ev) => this.#handleModalInput(ev));

    return {
      topStrip,
      modalLayer,
      bottomHud,
      mapName: topStrip.querySelector('[data-role="map-name"]'),
      coords: topStrip.querySelector('[data-role="coords"]'),
      targetPill: topStrip.querySelector('[data-role="target-pill"]'),
      targetName: topStrip.querySelector('[data-role="target-name"]'),
      targetFill: topStrip.querySelector('[data-role="target-fill"]'),
      autoBtn: topStrip.querySelector('[data-act="toggle-auto"]'),
      charTitle: bottomHud.querySelector('[data-role="char-title"]'),
      lawful: bottomHud.querySelector('[data-role="lawful"]'),
      hpFill: bottomHud.querySelector('[data-role="hp-fill"]'),
      hpText: bottomHud.querySelector('[data-role="hp-text"]'),
      mpFill: bottomHud.querySelector('[data-role="mp-fill"]'),
      mpText: bottomHud.querySelector('[data-role="mp-text"]'),
      expFill: bottomHud.querySelector('[data-role="exp-fill"]'),
      expText: bottomHud.querySelector('[data-role="exp-text"]'),
      statChips: bottomHud.querySelector('[data-role="stat-chips"]'),
      logBox: bottomHud.querySelector('[data-role="log-box"]'),
      quickbar: bottomHud.querySelector('[data-role="quickbar"]'),
    };
  }

  triggerQuickbar(idx) {
    const slot = this.world.player.quickbar?.[idx];
    if (!slot) return;
    if (slot.kind === 'item') {
      const res = this.world.useItem(slot.name);
      if (res?.toggledAuto) {
        this.autoHunt.statusLabel = this.world.player.autoConfig.enabled ? '自動練功啟動' : '待機';
      }
    } else if (slot.kind === 'spell') {
      this.world.castSpell(slot.id);
    }
    this.sync(true);
  }

  toggleModal(name) {
    if (this.activeModal === name) {
      this.closeModal();
      return;
    }
    this.activeModal = name;
    this.renderModal();
    this.sync(true);
  }

  closeModal() {
    this.activeModal = null;
    this.npcSession = null;
    this.elements.modalLayer.hidden = true;
    this.elements.modalLayer.innerHTML = '';
  }

  openNpc(npc) {
    const key = this.#resolveNpcDialogueKey(npc);
    let defaultMode = 'talk';
    if (npc.type === 'Teleport') defaultMode = 'teleport';
    this.npcSession = { npc, mode: defaultMode, dialogueKey: key };
    this.activeModal = 'npc';
    this.renderModal();
    this.sync(true);
  }

  #resolveNpcDialogueKey(npc) {
    const dialogues = this.world.worldData.dialogues || {};
    const clsSuffix = { royal: 'p', knight: 'k', elf: 'e', mage: 'w' }[this.world.player.classId] || 'p';
    if (npc.name === '吉倫') return dialogues[`gereng${clsSuffix}1`] ? `gereng${clsSuffix}1` : 'gerengp1';
    if (npc.name === '甘特') return dialogues[`gunter${clsSuffix}1`] ? `gunter${clsSuffix}1` : 'gunterp1';
    const mapped = NPC_DIALOGUE_START[npc.name];
    if (mapped && dialogues[mapped]) return mapped;
    return null;
  }

  #findDialogueHtml(key) {
    if (!key) return null;
    const dialogues = this.world.worldData.dialogues || {};
    if (dialogues[key]) return dialogues[key];
    const lower = key.toLowerCase();
    for (const [k, v] of Object.entries(dialogues)) {
      if (k.toLowerCase() === lower) return v;
    }
    return null;
  }

  #formatLineageDialogue(rawHtml) {
    // 僅保留安全段落與換行，將 <a link> / <a action> 與商店圖片鈕轉成真實按鈕
    let s = String(rawHtml || '')
      .replace(/<\s*\/?\s*(?:body|p|font)[^>]*>/gi, '\n')
      .replace(/<\s*br\s*\/?>/gi, '\n')
      .replace(/<\s*img[^>]*action\s*=\s*"([^"]+)"[^>]*>(?:\s*<\/img>)?/gi, (_, act) => {
        const label = act === 'buy' ? '購買物品' : act === 'sell' ? '販賣物品' : act;
        return `[[ACT:${act}|${label}]]`;
      })
      .replace(/<\s*a\s+link\s*=\s*"([^"]+)"[^>]*>([\s\S]*?)<\s*\/\s*a\s*>/gi, (_, lk, txt) => `[[LINK:${lk}|${txt.trim()}]]`)
      .replace(/<\s*a\s+action\s*=\s*"([^"]+)"[^>]*>([\s\S]*?)<\s*\/\s*a\s*>/gi, (_, act, txt) => `[[ACT:${act}|${txt.trim()}]]`)
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/gi, ' ');

    const escaped = esc(s)
      .replace(/\[\[LINK:([^|\]]+)\|([^\]]+)\]\]/g, (_, lk, txt) => `<button type="button" class="ll-act-btn secondary" data-npc-link="${esc(lk)}">${txt}</button>`)
      .replace(/\[\[ACT:([^|\]]+)\|([^\]]+)\]\]/g, (_, act, txt) => `<button type="button" class="ll-act-btn" data-npc-act="${esc(act)}">${txt}</button>`)
      .replace(/\n{3,}/g, '\n\n')
      .trim()
      .replace(/\n/g, '<br>');
    return escaped;
  }

  #resolveNpcShopList(npc) {
    const shops = this.world.worldData.shops || {};
    if (shops[npc.name]) return shops[npc.name];
    if (npc.type === 'Inn' || npc.name === '多瑪' || npc.name === '法林') return shops['巴辛'] || [];
    if (npc.shop || npc.type === 'Shop' || npc.type === 'Craft') return shops['潘朵拉'] || [];
    return [];
  }

  renderModal() {
    const layer = this.elements.modalLayer;
    if (!this.activeModal) {
      layer.hidden = true;
      layer.innerHTML = '';
      return;
    }

    layer.hidden = false;
    if (this.activeModal === 'inventory') layer.innerHTML = this.#renderInventoryHtml();
    else if (this.activeModal === 'spells') layer.innerHTML = this.#renderSpellsHtml();
    else if (this.activeModal === 'status') layer.innerHTML = this.#renderStatusHtml();
    else if (this.activeModal === 'map') {
      layer.innerHTML = this.#renderMapModalHtml();
      this.#drawMinimapCanvas();
    } else if (this.activeModal === 'npc') layer.innerHTML = this.#renderNpcModalHtml();
    else if (this.activeModal === 'auto') layer.innerHTML = this.#renderAutoModalHtml();
    else if (this.activeModal === 'system') layer.innerHTML = this.#renderSystemModalHtml();
  }

  #renderInventoryHtml() {
    const p = this.world.player;
    const eqMap = {};
    for (const it of p.inventory) {
      if (!it.equipped) continue;
      const def = this.world.worldData.items[it.name];
      if (!def) continue;
      const slotName = def.kind === 'weapon' ? '武器' : def.type || '防具';
      eqMap[slotName] = it;
    }

    const slotOrder = [
      ['武器', '武器'],
      ['armor', '盔甲'],
      ['helm', '頭盔'],
      ['shield', '盾牌'],
      ['cloak', '斗篷'],
      ['boots', '長靴'],
      ['glove', '手套'],
    ];

    const eqRows = slotOrder
      .map(([key, label]) => {
        const it = eqMap[key];
        const disp = it ? `${it.plus ? `+${it.plus} ` : ''}${it.name}` : '<span style="color:#6d6456">（空）</span>';
        return `<div class="ll-equip-row"><span>${label}</span><span>${disp}</span></div>`;
      })
      .join('');

    const itemCards = p.inventory
      .map((it) => {
        const def = this.world.worldData.items[it.name] || {};
        const iconUrl = this.world.assets.itemIconUrl(def.icon);
        const sel = this.selectedItemId === it.id ? 'border-color:#f4cd75;' : '';
        const title = `${it.plus ? `+${it.plus} ` : ''}${it.name}`;
        const sub = def.kind === 'weapon'
          ? `傷害 ${def.small}/${def.large}`
          : def.kind === 'armor'
            ? `AC -${def.ac + (it.plus || 0)}`
            : `數量 ${it.count}`;
        return `
          <button type="button" class="ll-item-card ${it.equipped ? 'equipped' : ''}" style="${sel}" data-select-item="${esc(it.id)}">
            <img src="${esc(iconUrl)}" alt="" />
            <div class="ll-item-meta">
              <div class="ll-item-name">${esc(title)}</div>
              <div class="ll-item-sub">${it.equipped ? '已裝備 · ' : ''}${esc(sub)}</div>
            </div>
          </button>
        `;
      })
      .join('');

    const selItem = p.inventory.find((i) => i.id === this.selectedItemId) || p.inventory[0] || null;
    if (selItem && !this.selectedItemId) this.selectedItemId = selItem.id;
    const selDef = selItem ? this.world.worldData.items[selItem.name] : null;
    const actionLabel = selDef && (selDef.kind === 'weapon' || selDef.kind === 'armor')
      ? (selItem.equipped ? '卸下裝備' : '穿戴裝備')
      : '使用道具';

    const quickAssignBtns = selItem
      ? QUICKBAR_KEYS.map(
          (k, idx) => `<button type="button" class="ll-act-btn secondary" data-bind-item-q="${idx}" title="設為 ${k}">${k}</button>`,
        ).join('')
      : '';

    return `
      <div class="ll-win wide">
        <div class="ll-win-head">
          <h3 class="ll-win-title">裝備與道具欄（金幣 ${p.gold.toLocaleString()} / 負重 ${p.weightPercent}%）</h3>
          <button type="button" class="ll-win-close" data-close-modal="1">關閉</button>
        </div>
        <div class="ll-win-body">
          <div class="ll-inv-grid">
            <div class="ll-equip-box">
              <div class="ll-subhead">角色裝備（AC ${p.ac} / 抗魔 ${p.mr}%）</div>
              ${eqRows}
            </div>
            <div class="ll-bag-box">
              <div class="ll-subhead">持有物品（點擊選取，雙擊或點按鈕使用）</div>
              <div class="ll-item-list">${itemCards || '<div style="color:#998">背包內尚無物品</div>'}</div>
              ${selItem ? `
                <div style="margin-top:10px;padding-top:8px;border-top:1px solid #493822;">
                  <div style="font-size:12px;color:#f3d284;margin-bottom:6px;">已選取：${esc(selItem.plus ? `+${selItem.plus} ` : '')}${esc(selItem.name)} x${selItem.count}</div>
                  <div class="ll-btn-row">
                    <button type="button" class="ll-act-btn" data-use-selected="${esc(selItem.id)}">${actionLabel}</button>
                    ${quickAssignBtns}
                  </div>
                </div>
              ` : ''}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  #renderSpellsHtml() {
    const p = this.world.player;
    const allSpells = this.world.worldData.spells || [];
    const rows = p.spells
      .map((sid) => allSpells.find((s) => s.id === sid))
      .filter(Boolean)
      .map((sp) => {
        const iconUrl = this.world.assets.spellIconUrl(sp);
        return `
          <div class="ll-list-row">
            <div class="ll-list-left">
              <img src="${esc(iconUrl)}" alt="" />
              <div>
                <div style="font-weight:700;color:#f6dfaa;">${esc(sp.name)} <span style="font-size:11px;color:#9eb5cb;">Lv.${sp.level}</span></div>
                <div style="font-size:11px;color:#9eb5cb;">消耗 MP ${sp.mp} · 距離 ${sp.range || '自身'}</div>
              </div>
            </div>
            <div style="display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end;">
              <button type="button" class="ll-act-btn" data-cast-spell="${sp.id}">施放</button>
              <button type="button" class="ll-act-btn secondary" data-bind-spell-q="4:${sp.id}" title="綁定至 F9">設F9</button>
              <button type="button" class="ll-act-btn secondary" data-bind-spell-q="5:${sp.id}" title="綁定至 F10">設F10</button>
            </div>
          </div>
        `;
      })
      .join('');

    return `
      <div class="ll-win">
        <div class="ll-win-head">
          <h3 class="ll-win-title">魔法書（MP ${p.mp} / ${p.maxMp}）</h3>
          <button type="button" class="ll-win-close" data-close-modal="1">關閉</button>
        </div>
        <div class="ll-win-body">
          ${rows || '<div style="color:#9eb5cb;">目前尚未習得任何魔法（騎士職業以近戰武藝為主）。</div>'}
        </div>
      </div>
    `;
  }

  #renderStatusHtml() {
    const p = this.world.player;
    const expSpan = Math.max(1, p.expNext - p.expPrev);
    const expPct = Math.min(99.9, Math.max(0, ((p.exp - p.expPrev) / expSpan) * 100)).toFixed(2);
    const clsName = CLASS_LABELS[p.classId] || '冒險者';
    return `
      <div class="ll-win">
        <div class="ll-win-head">
          <h3 class="ll-win-title">角色狀態 — ${esc(p.name)}</h3>
          <button type="button" class="ll-win-close" data-close-modal="1">關閉</button>
        </div>
        <div class="ll-win-body">
          <div class="ll-equip-row"><span>職業 / 等級</span><span>${clsName} · Lv.${p.level} (${expPct}%)</span></div>
          <div class="ll-equip-row"><span>體力 (HP)</span><span>${p.hp} / ${p.maxHp}</span></div>
          <div class="ll-equip-row"><span>魔力 (MP)</span><span>${p.mp} / ${p.maxMp}</span></div>
          <div class="ll-equip-row"><span>防禦力 (AC) / 抗魔 (MR)</span><span>${p.ac} / ${p.mr}%</span></div>
          <div class="ll-equip-row"><span>正義值 (Lawful)</span><span>${p.lawful}</span></div>
          <div class="ll-equip-row"><span>基礎能力</span><span>力${p.stats.str} 體${p.stats.con} 敏${p.stats.dex} 精${p.stats.wis} 魅${p.stats.cha} 智${p.stats.int}</span></div>
          <div class="ll-equip-row"><span>持有金幣 / 負重</span><span>${p.gold.toLocaleString()} Adena · ${p.weightPercent}%</span></div>
          <div class="ll-equip-row"><span>所在位置</span><span>${esc(MAP_NAMES[p.map] || p.map)} (${p.tx}, ${p.ty})</span></div>
        </div>
      </div>
    `;
  }

  #renderMapModalHtml() {
    const p = this.world.player;
    return `
      <div class="ll-win wide">
        <div class="ll-win-head">
          <h3 class="ll-win-title">世界地圖 — ${esc(MAP_NAMES[p.map] || '說話之島')} (${p.tx}, ${p.ty})</h3>
          <button type="button" class="ll-win-close" data-close-modal="1">關閉</button>
        </div>
        <div class="ll-win-body">
          <div style="font-size:12px;color:#b8aa90;margin-bottom:8px;">
            綠點：玩家位置 · 金點：村莊 NPC · 青點：地圖傳送點 · 紅點：怪物分布（點擊地圖可直接尋路前往）
          </div>
          <canvas class="ll-minimap-canvas" width="480" height="340" data-role="minimap-canvas"></canvas>
        </div>
      </div>
    `;
  }

  #drawMinimapCanvas() {
    const canvas = this.elements.modalLayer.querySelector('[data-role="minimap-canvas"]');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const p = this.world.player;
    const span = 120;
    const minX = p.tx - span;
    const maxX = p.tx + span;
    const minY = p.ty - span;
    const maxY = p.ty + span;
    const w = canvas.width;
    const h = canvas.height;
    ctx.fillStyle = '#070c12';
    ctx.fillRect(0, 0, w, h);

    // 繪製可行走地形格
    const step = 2;
    for (let ty = minY; ty <= maxY; ty += step) {
      const py = ((ty - minY) / (span * 2)) * h;
      for (let tx = minX; tx <= maxX; tx += step) {
        if (!this.world.isoMap.isWalkableTile(tx, ty, p.map)) continue;
        const px = ((tx - minX) / (span * 2)) * w;
        ctx.fillStyle = '#253547';
        ctx.fillRect(px, py, 4, 4);
      }
    }

    const toPx = (tx, ty) => ({
      x: ((tx - minX) / (span * 2)) * w,
      y: ((ty - minY) / (span * 2)) * h,
    });

    // 傳送門
    ctx.fillStyle = '#38bdf8';
    for (const po of this.world.worldData.portals || []) {
      if (po.map !== p.map) continue;
      const pt = toPx(po.x, po.y);
      ctx.fillRect(pt.x - 3, pt.y - 3, 6, 6);
    }

    // 怪物
    ctx.fillStyle = '#f87171';
    for (const m of this.world.mobs) {
      if (m.hp <= 0) continue;
      const pt = toPx(m.tx, m.ty);
      ctx.fillRect(pt.x - 1.5, pt.y - 1.5, 3, 3);
    }

    // NPC
    ctx.fillStyle = '#facc15';
    for (const n of this.world.npcs) {
      const pt = toPx(n.x, n.y);
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // 玩家
    const me = toPx(p.tx, p.ty);
    ctx.fillStyle = '#4ade80';
    ctx.beginPath();
    ctx.arc(me.x, me.y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    canvas.onclick = (ev) => {
      const rect = canvas.getBoundingClientRect();
      const nx = (ev.clientX - rect.left) / rect.width;
      const ny = (ev.clientY - rect.top) / rect.height;
      const gx = Math.round(minX + nx * span * 2);
      const gy = Math.round(minY + ny * span * 2);
      this.world.setWalkTarget(gx, gy);
      this.world.addLog(`設定地圖目標前往 (${gx}, ${gy})。`, 'info');
      this.closeModal();
    };
  }

  #renderNpcModalHtml() {
    const sess = this.npcSession;
    if (!sess) return '';
    const { npc, mode, dialogueKey } = sess;
    const p = this.world.player;

    let bodyHtml = '';
    if (mode === 'buy') {
      const entries = this.#resolveNpcShopList(npc);
      bodyHtml = `
        <div style="margin-bottom:8px;color:#ffd872;">持有金幣：${p.gold.toLocaleString()} Adena</div>
        ${entries
          .map((e, i) => {
            const def = this.world.worldData.items[e.item];
            const iconUrl = this.world.assets.itemIconUrl(def?.icon);
            return `
              <div class="ll-list-row">
                <div class="ll-list-left">
                  <img src="${esc(iconUrl)}" alt="" />
                  <div>
                    <div style="font-weight:700;">${esc(e.item)}${e.count > 1 ? ` x${e.count}` : ''}</div>
                    <div style="font-size:11px;color:#ffd872;">價格：${e.price.toLocaleString()} 金幣</div>
                  </div>
                </div>
                <div style="display:flex;gap:4px;">
                  <button type="button" class="ll-act-btn" data-shop-buy="${i}:1">買 1</button>
                  ${def?.stack ? `<button type="button" class="ll-act-btn secondary" data-shop-buy="${i}:10">買 10</button>` : ''}
                </div>
              </div>
            `;
          })
          .join('') || '<div>目前暫無販售商品。</div>'}
      `;
    } else if (mode === 'sell') {
      const sellables = p.inventory.filter((it) => !it.equipped);
      bodyHtml = sellables
        .map((it) => {
          const def = this.world.worldData.items[it.name];
          const unit = Math.max(1, Math.floor((def?.price || 10) * 0.5));
          return `
            <div class="ll-list-row">
              <div>${esc(it.name)} x${it.count} <span style="color:#ffd872;">(單價 ${unit} 金幣)</span></div>
              <button type="button" class="ll-act-btn" data-shop-sell="${esc(it.id)}">賣出全部</button>
            </div>
          `;
        })
        .join('') || '<div>背包沒有可販售的非裝備道具。</div>';
    } else if (mode === 'deposit' || mode === 'withdraw') {
      const list = mode === 'deposit' ? p.inventory.filter((i) => !i.equipped) : this.world.warehouse.items;
      const actName = mode === 'deposit' ? 'data-wh-dep' : 'data-wh-wd';
      const label = mode === 'deposit' ? '存入 (30金幣)' : '取出 (30金幣)';
      bodyHtml = `
        <div class="ll-btn-row" style="margin-bottom:8px;">
          <button type="button" class="ll-act-btn ${mode === 'deposit' ? '' : 'secondary'}" data-npc-mode="deposit">存放物品</button>
          <button type="button" class="ll-act-btn ${mode === 'withdraw' ? '' : 'secondary'}" data-npc-mode="withdraw">取出物品</button>
        </div>
        ${list
          .map(
            (it) => `
          <div class="ll-list-row">
            <span>${esc(it.plus ? `+${it.plus} ` : '')}${esc(it.name)} x${it.count}</span>
            <button type="button" class="ll-act-btn" ${actName}="${esc(it.id)}">${label}</button>
          </div>
        `,
          )
          .join('') || '<div style="color:#998;">目前無項目可操作。</div>'}
      `;
    } else if (mode === 'teleport') {
      bodyHtml = `
        <div class="ll-npc-html">
          <strong>${esc(npc.name)}：</strong>願諸神祝福你的旅途！你想前往說話之島的哪個區域？
        </div>
        ${TELEPORT_DESTINATIONS.map(
          (dest, idx) => `
          <div class="ll-list-row">
            <span>${esc(dest.label)}</span>
            <button type="button" class="ll-act-btn" data-tp-idx="${idx}">傳送 (${dest.price} 金幣)</button>
          </div>
        `,
        ).join('')}
      `;
    } else {
      const raw = this.#findDialogueHtml(dialogueKey);
      const formatted = raw
        ? this.#formatLineageDialogue(raw)
        : this.#buildFallbackDialogue(npc);
      const extraBtns = [];
      if (this.#resolveNpcShopList(npc).length > 0 && !raw) {
        extraBtns.push('<button type="button" class="ll-act-btn" data-npc-act="buy">購買物品</button>');
        extraBtns.push('<button type="button" class="ll-act-btn secondary" data-npc-act="sell">販賣物品</button>');
      }
      if (npc.type === 'Dwarf') {
        extraBtns.push('<button type="button" class="ll-act-btn" data-npc-mode="deposit">開啟個人倉庫</button>');
      }
      if (npc.type === 'Blesser555') {
        extraBtns.push('<button type="button" class="ll-act-btn" data-npc-act="bless">接受免費祝福補滿狀態</button>');
      }
      bodyHtml = `
        <div class="ll-npc-html">${formatted}</div>
        ${extraBtns.length ? `<div class="ll-btn-row">${extraBtns.join('')}</div>` : ''}
      `;
    }

    return `
      <div class="ll-win wide">
        <div class="ll-win-head">
          <h3 class="ll-win-title">${esc(npc.name)}（${esc(npc.type || 'NPC')}）</h3>
          <button type="button" class="ll-win-close" data-close-modal="1">離開對話</button>
        </div>
        <div class="ll-win-body">
          ${mode !== 'talk' ? '<div style="margin-bottom:8px;"><button type="button" class="ll-act-btn secondary" data-npc-mode="talk">← 返回對話</button></div>' : ''}
          ${bodyHtml}
        </div>
      </div>
    `;
  }

  #buildFallbackDialogue(npc) {
    if (npc.type === 'Guard') {
      return `<strong>${esc(npc.name)}：</strong>說話之島村莊由我們守護！請放心在城鎮內補給與整備，出村狩獵前別忘了攜帶紅色藥水與傳送回家卷軸。`;
    }
    if (npc.type === 'Blesser555') {
      return `<strong>${esc(npc.name)}：</strong>年輕的冒險者啊，只要點擊下方祝福按鈕，我就能為你恢復體力與魔力，並賜予加速與保護罩！`;
    }
    if (npc.name.includes('木人')) {
      return `<strong>木人：</strong>點擊攻擊即可進行近戰／弓箭打擊練習。村外還有高侖、半獸人與骷髏等著你挑戰。`;
    }
    return `<strong>${esc(npc.name)}：</strong>你好，來自亞丁大陸的旅人。說話之島處處充滿冒險氣息，需要協助請隨時開口。`;
  }

  #renderAutoModalHtml() {
    const cfg = this.world.player.autoConfig;
    return `
      <div class="ll-win">
        <div class="ll-win-head">
          <h3 class="ll-win-title">內掛與喝水符石設定</h3>
          <button type="button" class="ll-win-close" data-close-modal="1">關閉</button>
        </div>
        <div class="ll-win-body">
          <div class="ll-list-row">
            <div>
              <div style="font-weight:700;">自動練功（內掛符石）</div>
              <div style="font-size:11px;color:#9eb5cb;">狀態：${esc(this.autoHunt.statusLabel)}</div>
            </div>
            <button type="button" class="ll-act-btn" data-auto-toggle="enabled">${cfg.enabled ? '點擊關閉' : '點擊啟動'}</button>
          </div>
          <div class="ll-list-row">
            <div>
              <div style="font-weight:700;">自動喝水（喝水符石）</div>
              <div style="font-size:11px;color:#9eb5cb;">HP 低於 <span data-role="pot-val">${cfg.potThreshold}</span>% 自動飲用紅／橙／白水或施放治癒術</div>
            </div>
            <button type="button" class="ll-act-btn" data-auto-toggle="pot">${cfg.potEnabled ? '已開啟' : '已關閉'}</button>
          </div>
          <div class="ll-list-row">
            <span>自動喝水門檻：${cfg.potThreshold}%</span>
            <input type="range" min="25" max="85" step="5" value="${cfg.potThreshold}" data-auto-range="potThreshold" />
          </div>
          <div class="ll-list-row">
            <span>索敵巡邏半徑：${cfg.radius} 格</span>
            <input type="range" min="6" max="24" step="2" value="${cfg.radius}" data-auto-range="radius" />
          </div>
          <div class="ll-list-row">
            <span>自動拾取地上戰利品</span>
            <button type="button" class="ll-act-btn" data-auto-toggle="pickup">${cfg.pickupDrops ? '已開啟' : '已關閉'}</button>
          </div>
        </div>
      </div>
    `;
  }

  #renderSystemModalHtml() {
    const muted = this.world.audio.muted;
    return `
      <div class="ll-win">
        <div class="ll-win-head">
          <h3 class="ll-win-title">系統選單 — 天堂 1.63 說話之島</h3>
          <button type="button" class="ll-win-close" data-close-modal="1">關閉</button>
        </div>
        <div class="ll-win-body">
          <div class="ll-list-row">
            <span>背景音樂與音效</span>
            <button type="button" class="ll-act-btn" data-sys-act="mute">${muted ? '目前靜音 · 點擊開啟' : '開啟中 · 點擊靜音'}</button>
          </div>
          <div class="ll-list-row">
            <span>立刻手動存檔（同步帳號進度）</span>
            <button type="button" class="ll-act-btn" data-sys-act="save">儲存角色資料</button>
          </div>
          <div class="ll-list-row">
            <span>緊急脫離卡點（傳送回說話之島村莊）</span>
            <button type="button" class="ll-act-btn secondary" data-sys-act="home">傳回村莊</button>
          </div>
          <div class="ll-list-row">
            <span>儲存並登出至角色選擇畫面</span>
            <button type="button" class="ll-act-btn" data-sys-act="lobby">回選角大廳</button>
          </div>
        </div>
      </div>
    `;
  }

  #handleModalClick(ev) {
    if (ev.target.closest('[data-close-modal]')) {
      this.closeModal();
      return;
    }

    const selItemBtn = ev.target.closest('[data-select-item]');
    if (selItemBtn) {
      const id = selItemBtn.dataset.selectItem;
      if (this.selectedItemId === id) {
        this.world.useItem(id);
      } else {
        this.selectedItemId = id;
      }
      this.renderModal();
      this.sync(true);
      return;
    }

    const useSel = ev.target.closest('[data-use-selected]');
    if (useSel) {
      this.world.useItem(useSel.dataset.useSelected);
      this.renderModal();
      this.sync(true);
      return;
    }

    const bindItemQ = ev.target.closest('[data-bind-item-q]');
    if (bindItemQ) {
      const idx = Number(bindItemQ.dataset.bindItemQ);
      const it = this.world.player.inventory.find((i) => i.id === this.selectedItemId);
      if (it) {
        this.world.player.quickbar[idx] = { kind: 'item', name: it.name };
        this.world.dirtySave = true;
        this.world.addLog(`已將 ${it.name} 指派至快捷鍵 ${QUICKBAR_KEYS[idx]}。`, 'info');
        this.sync(true);
      }
      return;
    }

    const castBtn = ev.target.closest('[data-cast-spell]');
    if (castBtn) {
      this.world.castSpell(Number(castBtn.dataset.castSpell));
      this.closeModal();
      this.sync(true);
      return;
    }

    const bindSpell = ev.target.closest('[data-bind-spell-q]');
    if (bindSpell) {
      const [idxStr, sidStr] = bindSpell.dataset.bindSpellQ.split(':');
      const idx = Number(idxStr);
      const sid = Number(sidStr);
      const sp = (this.world.worldData.spells || []).find((s) => s.id === sid);
      if (sp) {
        this.world.player.quickbar[idx] = { kind: 'spell', id: sp.id };
        this.world.dirtySave = true;
        this.world.addLog(`已將 ${sp.name} 指派至快捷鍵 ${QUICKBAR_KEYS[idx]}。`, 'info');
        this.sync(true);
      }
      return;
    }

    const npcLink = ev.target.closest('[data-npc-link]');
    if (npcLink && this.npcSession) {
      this.npcSession.dialogueKey = npcLink.dataset.npcLink;
      this.npcSession.mode = 'talk';
      this.renderModal();
      return;
    }

    const npcAct = ev.target.closest('[data-npc-act]');
    if (npcAct && this.npcSession) {
      const act = npcAct.dataset.npcAct;
      if (act === 'buy' || act === 'sell') {
        this.npcSession.mode = act;
      } else if (act === 'deposit' || act === 'deposit-pledge') {
        this.npcSession.mode = 'deposit';
      } else if (act === 'retrieve' || act === 'retrieve-pledge') {
        this.npcSession.mode = 'withdraw';
      } else if (act === 'bless') {
        const p = this.world.player;
        const now = performance.now();
        p.hp = p.maxHp;
        p.mp = p.maxMp;
        p.buffs.haste = now + 300000;
        p.buffs.shield = now + 600000;
        this.world.recomputePlayerStats();
        this.world.spawnEffect(p.tx, p.ty, '751');
        this.world.addLog('獲得祝福師的完全恢復與加速保護祝福！', 'gold');
      } else {
        const alt = this.#findDialogueHtml(act);
        if (alt) this.npcSession.dialogueKey = act;
        else this.world.addLog(`${this.npcSession.npc.name}：功能準備就緒。`, 'info');
      }
      this.renderModal();
      this.sync(true);
      return;
    }

    const npcMode = ev.target.closest('[data-npc-mode]');
    if (npcMode && this.npcSession) {
      this.npcSession.mode = npcMode.dataset.npcMode;
      this.renderModal();
      return;
    }

    const buyBtn = ev.target.closest('[data-shop-buy]');
    if (buyBtn && this.npcSession) {
      const [idxStr, qtyStr] = buyBtn.dataset.shopBuy.split(':');
      const entries = this.#resolveNpcShopList(this.npcSession.npc);
      const entry = entries[Number(idxStr)];
      if (entry) this.world.buyFromShop(this.npcSession.npc.name, entry, Number(qtyStr));
      this.renderModal();
      this.sync(true);
      return;
    }

    const sellBtn = ev.target.closest('[data-shop-sell]');
    if (sellBtn) {
      const id = sellBtn.dataset.shopSell;
      const item = this.world.player.inventory.find((i) => i.id === id);
      if (item) this.world.sellToShop(id, item.count);
      this.renderModal();
      this.sync(true);
      return;
    }

    const whDep = ev.target.closest('[data-wh-dep]');
    if (whDep) {
      this.world.depositToWarehouse(whDep.dataset.whDep);
      this.renderModal();
      this.sync(true);
      return;
    }

    const whWd = ev.target.closest('[data-wh-wd]');
    if (whWd) {
      this.world.withdrawFromWarehouse(whWd.dataset.whWd);
      this.renderModal();
      this.sync(true);
      return;
    }

    const tpBtn = ev.target.closest('[data-tp-idx]');
    if (tpBtn) {
      const dest = TELEPORT_DESTINATIONS[Number(tpBtn.dataset.tpIdx)];
      if (dest) {
        if (this.world.player.gold < dest.price) {
          this.world.addLog(`金幣不足 ${dest.price}，無法傳送。`, 'warn');
        } else {
          this.world.player.gold -= dest.price;
          this.world.teleportTo(dest.map, dest.x, dest.y, 4);
          this.closeModal();
        }
        this.sync(true);
      }
      return;
    }

    const autoBtn = ev.target.closest('[data-auto-toggle]');
    if (autoBtn) {
      const kind = autoBtn.dataset.autoToggle;
      const cfg = this.world.player.autoConfig;
      if (kind === 'enabled') this.autoHunt.toggle();
      else if (kind === 'pot') cfg.potEnabled = !cfg.potEnabled;
      else if (kind === 'pickup') cfg.pickupDrops = !cfg.pickupDrops;
      this.world.dirtySave = true;
      this.renderModal();
      this.sync(true);
      return;
    }

    const sysBtn = ev.target.closest('[data-sys-act]');
    if (sysBtn) {
      const act = sysBtn.dataset.sysAct;
      if (act === 'mute') {
        this.world.audio.setMuted(!this.world.audio.muted);
        this.renderModal();
      } else if (act === 'save') {
        this.world.dirtySave = true;
        this.world.saveWorld(true);
        this.world.addLog('已完成角色存檔。', 'gold');
      } else if (act === 'home') {
        this.world.teleportTo(0, 32578, 32943, 4);
        this.closeModal();
      } else if (act === 'lobby') {
        this.world.dirtySave = true;
        this.world.saveWorld(true);
        this.onReturnToSelect?.();
      }
    }
  }

  #handleModalInput(ev) {
    const rng = ev.target.closest('[data-auto-range]');
    if (!rng) return;
    const key = rng.dataset.autoRange;
    this.world.player.autoConfig[key] = Number(rng.value);
    this.world.dirtySave = true;
    this.renderModal();
  }

  sync(force = false) {
    const p = this.world.player;
    const now = performance.now();
    const targetMob = p.targetId ? this.world.mobs.find((m) => m.id === p.targetId && m.hp > 0) : null;
    const lastLog = this.world.logs[this.world.logs.length - 1];
    const sig = [
      p.map,
      p.tx,
      p.ty,
      p.hp,
      p.maxHp,
      p.mp,
      p.maxMp,
      p.exp,
      p.level,
      p.gold,
      p.ac,
      p.weightPercent,
      p.autoConfig.enabled ? 1 : 0,
      targetMob ? `${targetMob.id}:${targetMob.hp}` : 'none',
      this.world.logs.length,
      lastLog?.text || '',
    ].join('|');

    if (!force && sig === this.lastRenderKey) return;
    this.lastRenderKey = sig;

    const el = this.elements;
    el.mapName.textContent = MAP_NAMES[p.map] || `地圖 ${p.map}`;
    el.coords.textContent = `${p.tx}, ${p.ty}`;

    if (targetMob) {
      el.targetPill.hidden = false;
      el.targetName.textContent = `${targetMob.name} (Lv.${targetMob.level})`;
      el.targetFill.style.width = `${Math.max(0, Math.min(100, (targetMob.hp / Math.max(1, targetMob.maxHp)) * 100))}%`;
    } else {
      el.targetPill.hidden = true;
    }

    el.autoBtn.textContent = p.autoConfig.enabled ? '內掛：開' : '內掛：關';
    el.autoBtn.classList.toggle('active', Boolean(p.autoConfig.enabled));

    const clsLabel = CLASS_LABELS[p.classId] || '勇者';
    el.charTitle.textContent = `${p.name} · Lv.${p.level} ${clsLabel}`;
    el.lawful.textContent = p.lawful >= 500 ? `守護 ${p.lawful}` : p.lawful < 0 ? `邪惡 ${p.lawful}` : `中立 ${p.lawful}`;

    const hpPct = Math.max(0, Math.min(100, (p.hp / Math.max(1, p.maxHp)) * 100));
    const mpPct = Math.max(0, Math.min(100, (p.mp / Math.max(1, p.maxMp)) * 100));
    const expSpan = Math.max(1, p.expNext - p.expPrev);
    const expPct = Math.max(0, Math.min(99.99, ((p.exp - p.expPrev) / expSpan) * 100));

    el.hpFill.style.width = `${hpPct}%`;
    el.hpText.textContent = `${p.hp} / ${p.maxHp}`;
    el.mpFill.style.width = `${mpPct}%`;
    el.mpText.textContent = `${p.mp} / ${p.maxMp}`;
    el.expFill.style.width = `${expPct}%`;
    el.expText.textContent = `${expPct.toFixed(2)}%`;

    const chips = [
      `<span class="ll-chip">AC ${p.ac}</span>`,
      `<span class="ll-chip gold">${p.gold.toLocaleString()} 金幣</span>`,
      `<span class="ll-chip">負重 ${p.weightPercent}%</span>`,
    ];
    if ((p.buffs.haste || 0) > now) chips.push('<span class="ll-chip buff">加速</span>');
    if ((p.buffs.brave || 0) > now) chips.push('<span class="ll-chip buff">勇水</span>');
    if ((p.buffs.shield || 0) > now) chips.push('<span class="ll-chip buff">保護罩</span>');
    if (p.autoConfig.enabled) chips.push('<span class="ll-chip buff">內掛中</span>');
    el.statChips.innerHTML = chips.join('');

    const tailLogs = this.world.logs.slice(-14);
    el.logBox.innerHTML = tailLogs
      .map(
        (l) => `<div class="ll-log-line ${esc(l.tone)}"><span class="ll-log-time">[${esc(l.time)}]</span>${esc(l.text)}</div>`,
      )
      .join('');
    el.logBox.scrollTop = el.logBox.scrollHeight;

    el.quickbar.innerHTML = QUICKBAR_KEYS.map((keyLabel, idx) => {
      const slot = p.quickbar?.[idx];
      let icon = '';
      let cnt = '';
      let activeAuto = false;
      let title = keyLabel;
      if (slot?.kind === 'item') {
        const def = this.world.worldData.items[slot.name];
        const held = p.inventory.find((i) => i.name === slot.name);
        icon = this.world.assets.itemIconUrl(def?.icon);
        cnt = held ? String(held.count) : '0';
        title = `${keyLabel} ${slot.name}`;
        if ((slot.name === '內掛符石' || slot.name === '喝水符石') && p.autoConfig.enabled) {
          activeAuto = true;
        }
      } else if (slot?.kind === 'spell') {
        const sp = (this.world.worldData.spells || []).find((s) => s.id === slot.id);
        icon = this.world.assets.spellIconUrl(sp);
        cnt = sp ? `${sp.mp}` : '';
        title = sp ? `${keyLabel} ${sp.name}` : keyLabel;
      }
      return `
        <button type="button" class="ll-qslot ${activeAuto ? 'active-auto' : ''}" data-qidx="${idx}" title="${esc(title)}">
          <span class="ll-qslot-key">${keyLabel}</span>
          ${icon ? `<img src="${esc(icon)}" alt="" />` : ''}
          ${cnt ? `<span class="ll-qslot-cnt">${esc(cnt)}</span>` : ''}
        </button>
      `;
    }).join('');
  }

  destroy() {
    this.elements.topStrip.remove();
    this.elements.modalLayer.remove();
    this.elements.bottomHud.remove();
  }
}
