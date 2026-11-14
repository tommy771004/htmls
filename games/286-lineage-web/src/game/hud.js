// 286 天堂實境客戶端：底部狀態列、快捷鍵 F5~F12、道具／裝備、法術書、小地圖、內掛設定與 NPC 互動視窗
import { assetUrl } from '../app.js';
import {
  CRAFT_RECIPES,
  TEACHER_SPELLS,
  MORPH_FORMS,
  PET_CATALOG,
  STATUE_BLESSINGS,
} from './world-state.js';
import {
  MAP_NAMES,
  getMapMeta,
  isSafetyZone,
  resolveHomeTown,
  TELEPORT_ACTIONS,
  TELEPORT_ROUTES_BY_NPC,
  WORLD_EXPEDITION_ROUTES,
  HARBOR_DESTINATIONS_BY_MAP,
  CONTINENT_LANDMARKS,
} from './world-maps.js';

const CLASS_LABELS = {
  royal: '王族',
  knight: '騎士',
  elf: '妖精',
  mage: '法師',
  dark: '黑暗妖精',
  dragon: '龍騎士',
  illusion: '幻術師',
  warrior: '戰士',
};

const CLASS_ALLOW_LABELS = ['王族', '騎士', '妖精', '法師'];

const WEAPON_TYPE_LABELS = {
  sword: '單手劍',
  dagger: '匕首',
  tohandsword: '雙手劍',
  bow: '弓弩',
  spear: '矛戟',
  axe: '戰斧',
  blunt: '鈍器',
  wand: '魔杖',
};

const QUICKBAR_KEYS = ['F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12'];

// 3×5 人型紙娃娃格位配置（area, slotKey, label, placeholderGlyph）
const PAPERDOLL_GRID_SLOTS = [
  { col: 2, row: 1, key: 'helm', label: '頭盔', glyph: '⛑' },
  { col: 1, row: 2, key: 'necklace', label: '項鍊', glyph: '📿' },
  { col: 2, row: 2, key: 't', label: '內衣', glyph: '👕' },
  { col: 3, row: 2, key: 'cloak', label: '斗篷', glyph: '🧥' },
  { col: 1, row: 3, key: '武器', label: '武器', glyph: '⚔' },
  { col: 2, row: 3, key: 'armor', label: '盔甲', glyph: '🛡' },
  { col: 3, row: 3, key: 'shield', label: '盾牌', glyph: '🔰' },
  { col: 1, row: 4, key: 'glove', label: '手套', glyph: '🧤' },
  { col: 2, row: 4, key: 'belt', label: '腰帶', glyph: '➰' },
  { col: 3, row: 4, key: 'ring', label: '戒指', glyph: '💍' },
  { col: 2, row: 5, key: 'boot', label: '長靴', glyph: '🥾' },
];

const EQUIP_SLOT_LABELS = PAPERDOLL_GRID_SLOTS.map((s) => [s.key, s.label]);

const NPC_DIALOGUE_START = {
  朵琳: 'dorin',
  凱倫: 'karim',
  索連: 'karim',
  高特: 'karim',
  塔奇: 'karim',
  諾丁: 'karim',
  蘇瑞耳: 'karim',
  克哈丁: 'karim',
  寶金: 'karim',
  潘朵拉: 'pandora',
  歐林: 'orim1',
  法林: 'farlin1',
  茱迪思: 'judice1',
  拉達: 'ladar1',
  林果: 'lengo1',
  夢娜: 'mona1',
  莫麗雅: 'moria1',
  丁: 'touma1',
  盧卡斯: 'teleisland1',
  史提夫: 'telegludin1',
  史坦利: 'telekent1',
  爾瑪: 'telegiran1',
  特萊: 'telewoods1',
  麥特: 'telesilver1',
  保羅: 'teleorcbdg1',
  丹尼爾: 'daniel1',
  瑟琳娜: 'inn',
  羅利雅: 'inn',
  維萊莎: 'inn',
  米蘭德: 'miranda1',
  莫莉: 'inn',
  '港口主人[說語島]': 'shipevi3',
  '港口主人[古丁]': 'shipevm1',
};

const TOWN_TELEPORTER_ALIAS = {
  ti: '盧卡斯',
  gludin: '史提夫',
  kent: '史坦利',
  giran: '爾瑪',
  woods: '特萊',
  silver: '麥特',
};

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
    this.invFilter = 'all'; // 'all' | 'consumable' | 'gear' | 'etc'
    this.pendingDiscardId = null;
    this.spellView = 'grid'; // 'grid' | 'list'
    this.spellCircle = 'all'; // 'all' | 1..6
    this.selectedSpellId = null;
    this.npcSession = null; // { npc, mode: 'talk'|'buy'|'sell'|'deposit'|'withdraw'|'teleport', dialogueKey }
    this.npcShopQty = {}; // { [entryIdx]: qty }
    this.chatExpanded = false;
    this.chatTab = 'all'; // 'all' | 'combat' | 'chat'
    this.tlCollapsed = false;
    this.lastRenderKey = '';
    this.lastLogSig = '';
    this.lastRadarSig = '';

    this.elements = this.#mountDom();
    this.sync(true);
  }

  #mountDom() {
    const iconBag = assetUrl('/lineage163/ui-redraw-v9/619.png');
    const iconMagic = assetUrl('/lineage163/ui-redraw-v9/618.png');
    const iconStatus = assetUrl('/lineage163/ui-redraw-v9/617.png');
    const iconMap = assetUrl('/lineage163/ui-redraw-v9/620.png');
    const iconAuto = assetUrl('/lineage163/ui-quickbar-v1/quickbar.png');
    const iconSys = assetUrl('/lineage163/ui-quickbar-v1/options.png');
    const swordDef = this.world.worldData.items['長劍'];
    const iconAtk = swordDef ? this.world.assets.itemIconUrl(swordDef.icon) : iconStatus;
    const coinDef = this.world.worldData.items['金幣'];
    const iconLoot = coinDef ? this.world.assets.itemIconUrl(coinDef.icon) : iconBag;
    const potDef = this.world.worldData.items['紅色藥水'];
    const iconPot = potDef ? this.world.assets.itemIconUrl(potDef.icon) : assetUrl('/lineage163/ui-redraw-v8/468-fill.png');
    const sendIcon = assetUrl('/lineage163/ui-redraw-v8/send.png');
    const expandIcon = assetUrl('/lineage163/ui-redraw-v8/chat-expand.png');

    // 1. 右上角小地圖雷達＋安全/戰鬥區＋可折疊任務與地監面板（左上角保持完全清空）
    const topStrip = document.createElement('div');
    topStrip.className = 'll-top-strip';
    topStrip.innerHTML = `
      <div class="ll-tr-cluster">
        <div class="ll-radar-card">
          <div class="ll-radar-head" data-win="map" title="點擊開啟完整世界地圖 (M)">
            <span class="ll-map-name" data-role="map-name">說話之島</span>
            <span class="ll-radar-open-hint">地圖 ⤢</span>
          </div>
          <div class="ll-radar-body">
            <canvas class="ll-radar-canvas" width="164" height="118" data-role="radar-canvas" title="點擊小地圖可直接移動"></canvas>
          </div>
          <div class="ll-radar-foot">
            <span class="ll-coords" data-role="coords">32579, 32946</span>
            <span class="ll-zone-badge safety" data-role="zone-badge">安全區域</span>
          </div>
        </div>
        <div class="ll-tr-accordion">
          <details class="ll-acc-item" open>
            <summary>▾ 試煉任務</summary>
            <div class="ll-acc-body" data-role="quest-summary"></div>
          </details>
          <details class="ll-acc-item">
            <summary>▸ 亞丁世界導航</summary>
            <div class="ll-acc-body">
              <button type="button" class="ll-acc-action" data-win="map">開啟世界地圖傳送 / 尋路</button>
              <button type="button" class="ll-acc-action" data-chat-cmd="/home">使用回卷返回最近城鎮 (/home)</button>
            </div>
          </details>
          <details class="ll-acc-item">
            <summary>▸ 冒險指令助手</summary>
            <div class="ll-acc-body">
              <button type="button" class="ll-acc-action" data-chat-cmd="/who">查看附近玩家與怪物 (/who)</button>
              <button type="button" class="ll-acc-action" data-chat-cmd="/loc">回報目前座標 (/loc)</button>
            </div>
          </details>
        </div>
      </div>
    `;

    const modalLayer = document.createElement('div');
    modalLayer.id = 'll-modal-layer';
    modalLayer.hidden = true;

    // 3. 底部浮動三區控制台（左下聊天盒＋中下等級/血魔/F5-F12/能力列＋右下Play內掛鈕）＋最底滿版EXP條
    const bottomHud = document.createElement('div');
    bottomHud.id = 'll-hud-bottom';
    bottomHud.innerHTML = `
      <div class="ll-hud-backdrop">
        <div class="ll-chat-col">
          <div class="ll-chat-tabs">
            <button type="button" class="ll-chat-tab active" data-chat-tab="all">一般</button>
            <button type="button" class="ll-chat-tab" data-chat-tab="combat">戰鬥</button>
            <button type="button" class="ll-chat-tab" data-chat-tab="chat">對話</button>
            <span class="ll-chat-tabs-spacer"></span>
            <button type="button" class="ll-chat-expand-btn" data-act-chat="toggle-expand" title="展開／收合對話框">
              <img src="${esc(expandIcon)}" data-role="expand-icon" alt="展開" />
            </button>
          </div>
          <div class="ll-log-col" data-role="log-box"></div>
          <form class="ll-chat-form" data-role="chat-form">
            <span class="ll-chat-chan">一般</span>
            <input type="text" class="ll-chat-input" data-role="chat-input" placeholder="對話或指令 (/who, /loc, /auto, /help)" maxlength="80" autocomplete="off" />
            <button type="submit" class="ll-chat-send-btn" title="送出訊息">
              <img src="${esc(sendIcon)}" alt="送出" />
            </button>
          </form>
        </div>

        <div class="ll-center-console">
          <div class="ll-level-card" data-win="status" title="點擊查看角色狀態與裝備 (S)">
            <div class="ll-level-top">
              <span class="ll-level-label">Level</span>
              <span class="ll-level-num" data-role="char-level">1</span>
            </div>
            <div class="ll-char-title" data-role="char-title">勇者</div>
            <div class="ll-lawful" data-role="lawful">中立 0</div>
          </div>

          <div class="ll-console-main">
            <div class="ll-bars-wrap">
              <div class="ll-bars-stack">
                <div class="ll-gauge-track"><div class="ll-gauge-fill hp" data-role="hp-fill"></div><span class="ll-gauge-text" data-role="hp-text"></span></div>
                <div class="ll-gauge-track"><div class="ll-gauge-fill mp" data-role="mp-fill"></div><span class="ll-gauge-text" data-role="mp-text"></span></div>
              </div>
              <button type="button" class="ll-side-pot-btn" data-act="quick-heal" title="快速飲用紅色藥水">
                <img src="${esc(iconPot)}" alt="" />
                <span data-role="pot-count">0</span>
              </button>
            </div>
            <div class="ll-quickbar" data-role="quickbar"></div>
            <div class="ll-stat-chips" data-role="stat-chips"></div>
          </div>
        </div>

        <div class="ll-br-dock">
          <div class="ll-tl-cluster">
            <div class="ll-target-pill" data-role="target-pill" hidden>
              <span class="ll-target-name" data-role="target-name"></span>
              <div class="ll-target-bar"><div class="ll-target-fill" data-role="target-fill" style="width:100%"></div></div>
            </div>
            <div class="ll-buff-strip" data-role="buff-strip"></div>
            <div class="ll-br-actions">
              <button type="button" class="ll-br-sub-btn" data-act="attack-nearest" title="鎖定最近目標 (Space)">周邊</button>
              <button type="button" class="ll-play-btn" data-act="toggle-auto" data-role="hud-auto-btn" title="切換自動狩獵／內掛 (H)">
                <span class="ll-play-ring">▶</span>
                <span class="ll-play-label" data-role="auto-label">內掛</span>
              </button>
            </div>
            <div class="ll-tl-toolbar" data-role="tl-toolbar">
              <button type="button" class="ll-tl-btn" data-win="inventory" title="道具欄 (I)"><img src="${esc(iconBag)}" alt="" /><span>道具</span></button>
              <button type="button" class="ll-tl-btn" data-win="spells" title="魔法書 (K)"><img src="${esc(iconMagic)}" alt="" /><span>魔法</span></button>
              <button type="button" class="ll-tl-btn" data-win="status" title="狀態紙娃娃 (S)"><img src="${esc(iconStatus)}" alt="" /><span>狀態</span></button>
              <button type="button" class="ll-tl-btn" data-win="map" title="世界地圖 (M)"><img src="${esc(iconMap)}" alt="" /><span>地圖</span></button>
              <button type="button" class="ll-tl-btn" data-win="auto" title="內掛設定 (H)"><img src="${esc(iconAuto)}" alt="" /><span>設定</span></button>
              <button type="button" class="ll-tl-btn" data-act="attack-nearest" title="鎖敵攻擊 (Space)"><img src="${esc(iconAtk)}" alt="" /><span>鎖敵</span></button>
              <button type="button" class="ll-tl-btn" data-act="pickup-nearest" title="拾取道具"><img src="${esc(iconLoot)}" alt="" /><span>拾取</span></button>
              <button type="button" class="ll-tl-btn" data-win="system" title="系統與選角 (Esc)"><img src="${esc(iconSys)}" alt="" /><span>系統</span></button>
              <button type="button" class="ll-tl-chevron" data-act="toggle-tl" title="收合／展開工具列">›</button>
            </div>
          </div>
        </div>
      </div>

      <div class="ll-exp-footer" title="經驗值進度條">
        <div class="ll-exp-fill" data-role="exp-fill"></div>
        <span class="ll-exp-pct" data-role="exp-text">0.00%</span>
      </div>
    `;

    this.rootEl.appendChild(topStrip);
    this.rootEl.appendChild(modalLayer);
    this.rootEl.appendChild(bottomHud);

    topStrip.addEventListener('click', (ev) => {
      const cmdBtn = ev.target.closest('[data-chat-cmd]');
      if (cmdBtn) {
        this.world.runChatCommand(cmdBtn.dataset.chatCmd);
        this.sync(true);
        return;
      }
      const wbtn = ev.target.closest('[data-win]');
      if (wbtn) {
        this.toggleModal(wbtn.dataset.win);
        return;
      }
      const btn = ev.target.closest('[data-act]');
      if (!btn) return;
      const act = btn.dataset.act;
      if (act === 'attack-nearest') this.onActionNearest?.('attack');
      else if (act === 'pickup-nearest') this.onActionNearest?.('pickup');
    });

    bottomHud.addEventListener('click', (ev) => {
      const tabBtn = ev.target.closest('[data-chat-tab]');
      if (tabBtn) {
        this.chatTab = tabBtn.dataset.chatTab;
        bottomHud.querySelectorAll('[data-chat-tab]').forEach((b) => b.classList.toggle('active', b === tabBtn));
        this.lastLogSig = '';
        this.sync(true);
        return;
      }
      const expandBtn = ev.target.closest('[data-act-chat="toggle-expand"]');
      if (expandBtn) {
        this.chatExpanded = !this.chatExpanded;
        bottomHud.classList.toggle('chat-expanded', this.chatExpanded);
        const iconEl = this.elements.expandIcon;
        if (iconEl) {
          iconEl.src = assetUrl(
            this.chatExpanded ? '/lineage163/ui-redraw-v8/chat-collapse.png' : '/lineage163/ui-redraw-v8/chat-expand.png',
          );
        }
        this.elements.logBox.scrollTop = this.elements.logBox.scrollHeight;
        return;
      }
      const actBtn = ev.target.closest('[data-act]');
      if (actBtn) {
        const act = actBtn.dataset.act;
        if (act === 'toggle-auto') {
          this.autoHunt.toggle();
          this.sync(true);
        } else if (act === 'attack-nearest') {
          this.onActionNearest?.('attack');
        } else if (act === 'pickup-nearest') {
          this.onActionNearest?.('pickup');
        } else if (act === 'toggle-tl') {
          this.tlCollapsed = !this.tlCollapsed;
          bottomHud.querySelector('[data-role="tl-toolbar"]')?.classList.toggle('collapsed', this.tlCollapsed);
          actBtn.textContent = this.tlCollapsed ? '‹' : '›';
        } else if (act === 'quick-heal') {
          const hpPot = this.world.player.inventory.find((i) =>
            ['紅色藥水', '橙色藥水', '白色藥水'].includes(i.name) && i.count > 0,
          );
          if (hpPot) this.world.useItem(hpPot.id);
          else this.world.addLog('背包內已無回復藥水。', 'warn');
          this.sync(true);
        }
        return;
      }
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

    const chatForm = bottomHud.querySelector('[data-role="chat-form"]');
    const chatInput = bottomHud.querySelector('[data-role="chat-input"]');
    chatForm?.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const val = chatInput?.value || '';
      if (val.trim()) {
        this.world.runChatCommand(val);
        chatInput.value = '';
        this.sync(true);
      }
      chatInput?.blur();
    });

    modalLayer.addEventListener('click', (ev) => this.#handleModalClick(ev));
    modalLayer.addEventListener('input', (ev) => this.#handleModalInput(ev));
    modalLayer.addEventListener('change', (ev) => this.#handleModalChange(ev));
    modalLayer.addEventListener('keydown', (ev) => {
      if (ev.key !== 'Enter') return;
      const qtyInput = ev.target.closest('[data-shop-qty]');
      if (!qtyInput || !this.npcSession) return;
      ev.preventDefault();
      const idx = Number(qtyInput.dataset.shopQty);
      this.#buyShopRow(idx);
    });

    return {
      topStrip,
      modalLayer,
      bottomHud,
      mapName: topStrip.querySelector('[data-role="map-name"]'),
      coords: topStrip.querySelector('[data-role="coords"]'),
      zoneBadge: topStrip.querySelector('[data-role="zone-badge"]'),
      radarCanvas: topStrip.querySelector('[data-role="radar-canvas"]'),
      buffStrip: bottomHud.querySelector('[data-role="buff-strip"]'),
      questSummary: topStrip.querySelector('[data-role="quest-summary"]'),
      targetPill: bottomHud.querySelector('[data-role="target-pill"]'),
      targetName: bottomHud.querySelector('[data-role="target-name"]'),
      targetFill: bottomHud.querySelector('[data-role="target-fill"]'),
      hudAutoBtn: bottomHud.querySelector('[data-role="hud-auto-btn"]'),
      autoLabel: bottomHud.querySelector('[data-role="auto-label"]'),
      charLevel: bottomHud.querySelector('[data-role="char-level"]'),
      charTitle: bottomHud.querySelector('[data-role="char-title"]'),
      lawful: bottomHud.querySelector('[data-role="lawful"]'),
      hpFill: bottomHud.querySelector('[data-role="hp-fill"]'),
      hpText: bottomHud.querySelector('[data-role="hp-text"]'),
      mpFill: bottomHud.querySelector('[data-role="mp-fill"]'),
      mpText: bottomHud.querySelector('[data-role="mp-text"]'),
      potCount: bottomHud.querySelector('[data-role="pot-count"]'),
      expFill: bottomHud.querySelector('[data-role="exp-fill"]'),
      expText: bottomHud.querySelector('[data-role="exp-text"]'),
      statChips: bottomHud.querySelector('[data-role="stat-chips"]'),
      logBox: bottomHud.querySelector('[data-role="log-box"]'),
      chatInput,
      expandIcon: bottomHud.querySelector('[data-role="expand-icon"]'),
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
      } else if (res?.openModal) {
        if (res.scrollId) this.pendingPolyScrollId = res.scrollId;
        this.activeModal = res.openModal;
        this.renderModal();
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
    this.pendingDiscardId = null;
    this.invFilter = 'all';
    this.spellCircle = 'all';
    this.activeModal = name;
    this.renderModal();
    this.sync(true);
  }

  closeModal() {
    this.activeModal = null;
    this.pendingDiscardId = null;
    this.invFilter = 'all';
    this.spellCircle = 'all';
    this.npcSession = null;
    this.npcShopQty = {};
    this.elements.modalLayer.hidden = true;
    this.elements.modalLayer.innerHTML = '';
  }

  openNpc(npc) {
    const key = this.#resolveNpcDialogueKey(npc);
    let defaultMode = 'talk';
    if (npc.type === 'Teleport') defaultMode = 'teleport';
    else if (npc.type === 'Craft') defaultMode = 'craft';
    else if (npc.type === 'PetShop') defaultMode = 'pet';
    else if (npc.type === 'ClanRegistrar') defaultMode = 'clan';
    this.npcSession = { npc, mode: defaultMode, dialogueKey: key };
    this.npcShopQty = {};
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
    else if (this.activeModal === 'poly') layer.innerHTML = this.#renderPolyModalHtml();
    else if (this.activeModal === 'auto') layer.innerHTML = this.#renderAutoModalHtml();
    else if (this.activeModal === 'system') layer.innerHTML = this.#renderSystemModalHtml();
  }

  #buildEquipMap(p) {
    const eqMap = {};
    for (const it of p.inventory) {
      if (!it.equipped) continue;
      const def = this.world.worldData.items[it.name];
      if (!def) continue;
      const slotName = def.kind === 'weapon' ? '武器' : def.type || 'armor';
      eqMap[slotName] = it;
    }
    return eqMap;
  }

  /** 依道具定義分類至經典背包頁籤 */
  #classifyInvItem(it, def) {
    if (def?.kind === 'weapon' || def?.kind === 'armor') return 'gear';
    if (
      def?.type === 'manapotion' ||
      /(藥水|餅乾|肉|蘋果|起司|麵包|果汁|解毒|牛奶|蘿蔔|檸檬|香蕉|茶)/.test(it?.name || '')
    ) {
      return 'consumable';
    }
    return 'etc';
  }

  /** 將道具可使用職業旗標陣列格式化為【職業】字串 */
  #formatAllowedClasses(def) {
    if (!Array.isArray(def?.classes)) return '全職業';
    const allowed = CLASS_ALLOW_LABELS.filter((_, idx) => Boolean(def.classes[idx]));
    if (!allowed.length) return '無職業限制 / 一般';
    return allowed.map((c) => `【${c}】`).join('');
  }

  /** 建構經典黑色半透明屬性視窗的詳細欄位列 */
  #buildItemTooltipLines(it, def) {
    const lines = [];
    const plus = it.plus || 0;
    const isGear = def?.kind === 'weapon' || def?.kind === 'armor';
    const unid = isGear && it.identified === false;

    if (unid) {
      lines.push({ text: '尚未鑑定，無法確認詳細強化與附加能力。', cls: 'muted' });
      lines.push({ text: '可使用「鑑定卷軸」進行辨識。', cls: 'muted' });
    } else if (def?.kind === 'weapon') {
      const plusSuffix = plus ? `+${plus}` : '';
      const wType = WEAPON_TYPE_LABELS[def.type] || '武器';
      lines.push({ text: `攻擊力 ${def.small}${plusSuffix}/${def.large}${plusSuffix} (${wType})`, cls: 'bright' });
      if (def.twoHand) lines.push({ text: '雙手武器.', cls: '' });
      if (def.hit) lines.push({ text: `${def.type === 'bow' ? '遠距離命中' : '近距離命中'} +${def.hit}.`, cls: '' });
      if (def.damage) lines.push({ text: `${def.type === 'bow' ? '遠距離傷害' : '額外傷害'} +${def.damage}.`, cls: '' });
      if (it.brokenCount > 0) {
        lines.push({ text: `武器受損 -${it.brokenCount}（請前往武器店找多瑪修理）.`, cls: 'warn' });
      }
      lines.push({ text: `安定值 +${def.safe ?? 6}.`, cls: '' });
    } else if (def?.kind === 'armor') {
      const slotName = PAPERDOLL_GRID_SLOTS.find((s) => s.key === def.type)?.label || '防具';
      lines.push({ text: `防禦 -${(def.ac || 0) + plus}（部位：${slotName}）`, cls: 'bright' });
      const bonuses = [
        def.hp && `體力 +${def.hp}`,
        def.mp && `魔力 +${def.mp}`,
        def.sp && `魔攻 +${def.sp}`,
        def.mr && `魔防 +${def.mr}%`,
        def.str && `力量 +${def.str}`,
        def.dex && `敏捷 +${def.dex}`,
        def.regenHp && `體力回復 +${def.regenHp}`,
        def.regenMp && `魔力回復 +${def.regenMp}`,
      ].filter(Boolean);
      for (const b of bonuses) lines.push({ text: `${b}.`, cls: '' });
      lines.push({ text: `安定值 +${def.safe ?? 4}.`, cls: '' });
    } else {
      const catText = def?.kind === 'book'
        ? '魔法書（雙擊或點使用學習法術）'
        : this.#classifyInvItem(it, def) === 'consumable'
          ? '消耗道具（雙擊或綁定 F5~F12 快速使用）'
          : '道具／卷軸／材料';
      lines.push({ text: catText, cls: 'muted' });
      lines.push({ text: `持有數量 ${it.count.toLocaleString()}.`, cls: 'bright' });
      if (def?.price > 0) lines.push({ text: `商店估價 ${def.price.toLocaleString()} 金幣.`, cls: '' });
    }

    if (isGear) lines.push({ text: `可使用職業：${this.#formatAllowedClasses(def)}`, cls: 'cls' });
    const unitWeight = def?.weight || 0;
    const totalWeight = unitWeight * (it.count || 1);
    lines.push({
      text: `重量 ${totalWeight}${it.count > 1 ? ` (單件 ${unitWeight})` : ''}.`,
      cls: '',
    });
    return lines;
  }

  /** 人型紙娃娃背景 SVG 剪影（內嵌圖示零額外請求） */
  #renderPaperdollSvg() {
    return `
      <svg class="ll-doll-silhouette" viewBox="0 0 180 250" aria-hidden="true">
        <defs>
          <radialGradient id="llDollGlow" cx="50%" cy="38%" r="58%">
            <stop offset="0%" stop-color="rgba(220, 178, 102, 0.34)" />
            <stop offset="100%" stop-color="rgba(12, 15, 20, 0)" />
          </radialGradient>
        </defs>
        <ellipse cx="90" cy="122" rx="76" ry="108" fill="url(#llDollGlow)" />
        <path d="M90 16 C105 16 113 27 113 41 C113 51 107 58 102 61 L104 69 L136 82 L154 126 L142 133 L125 99 L120 148 L131 230 L111 230 L97 166 L90 166 L76 230 L56 230 L67 148 L62 99 L45 133 L33 126 L51 82 L83 69 L85 61 C80 58 74 51 74 41 C74 27 82 16 90 16 Z"
              fill="rgba(22, 26, 33, 0.88)"
              stroke="rgba(224, 184, 108, 0.62)"
              stroke-width="2" />
      </svg>
    `;
  }

  /** 渲染 3×5 解剖位置人型紙娃娃格子（供狀態視窗與其他需要位置重用） */
  #renderPaperdollSlotsHtml(eqMap) {
    return PAPERDOLL_GRID_SLOTS.map((slot) => {
      const it = eqMap[slot.key];
      const def = it ? this.world.worldData.items[it.name] : null;
      const iconUrl = def?.icon != null ? this.world.assets.itemIconUrl(def.icon) : '';
      const fullTitle = it ? `${it.plus ? `+${it.plus} ` : ''}${it.name}` : '未裝備';
      return `
        <button type="button"
                class="ll-doll-slot ${it ? 'equipped' : ''}"
                style="grid-column:${slot.col};grid-row:${slot.row};"
                data-open-win="inventory"
                ${it ? `data-preselect-item="${esc(it.id)}"` : ''}
                title="${esc(slot.label)}：${esc(fullTitle)}">
          <span class="ll-doll-corner">${esc(slot.label)}</span>
          ${it ? '<span class="ll-doll-on">ON</span>' : ''}
          ${it?.plus ? `<span class="ll-doll-plus">+${it.plus}</span>` : ''}
          ${iconUrl ? `<img src="${esc(iconUrl)}" alt="" />` : `<span class="ll-doll-empty">${slot.glyph}</span>`}
          <span class="ll-doll-name">${esc(it ? `${it.plus ? `+${it.plus} ` : ''}${it.name}` : '空')}</span>
        </button>
      `;
    }).join('');
  }

  #renderInventoryHtml() {
    const p = this.world.player;
    const eqMap = this.#buildEquipMap(p);
    const items = p.inventory || [];
    const filtered = this.invFilter === 'all'
      ? items
      : items.filter((it) => this.#classifyInvItem(it, this.world.worldData.items[it.name]) === this.invFilter);

    // 選取項優先對應目前檢視清單；若外部指定了 selectedItemId 仍可精準顯示
    let selItem = items.find((i) => i.id === this.selectedItemId) || null;
    if (!selItem || (this.invFilter !== 'all' && !filtered.some((i) => i.id === selItem.id))) {
      selItem = filtered[0] || items[0] || null;
    }
    if (selItem) this.selectedItemId = selItem.id;
    else this.selectedItemId = null;

    const minCells = Math.max(24, Math.ceil(filtered.length / 4) * 4);
    const emptyCellsCount = Math.max(0, minCells - filtered.length);

    const itemSlotsHtml = filtered
      .map((it) => {
        const def = this.world.worldData.items[it.name] || {};
        const iconUrl = this.world.assets.itemIconUrl(def.icon);
        const isGear = def.kind === 'weapon' || def.kind === 'armor';
        const unid = isGear && it.identified === false;
        const selected = selItem?.id === it.id;
        const tipTitle = `${it.plus ? `+${it.plus} ` : ''}${it.name}${it.count > 1 ? ` x${it.count}` : ''}`;
        return `
          <button type="button"
                  class="ll-inv-slot ${it.equipped ? 'equipped' : ''} ${selected ? 'selected' : ''}"
                  data-select-item="${esc(it.id)}"
                  title="${esc(tipTitle)}">
            ${it.equipped ? '<span class="ll-slot-on">ON</span>' : ''}
            ${unid ? '<span class="ll-slot-tag unid">未</span>' : it.plus > 0 ? `<span class="ll-slot-tag plus">+${it.plus}</span>` : it.brokenCount > 0 ? `<span class="ll-slot-tag warn">-${it.brokenCount}</span>` : ''}
            <img src="${esc(iconUrl)}" alt="${esc(it.name)}" />
            ${it.locked ? '<span class="ll-slot-lock" title="已鎖定">🔒</span>' : ''}
            ${it.count > 1 ? `<span class="ll-slot-cnt">${it.count > 9999 ? '9999+' : it.count}</span>` : ''}
          </button>
        `;
      })
      .join('') + Array.from({ length: emptyCellsCount }, () => '<div class="ll-inv-slot empty" aria-hidden="true"></div>').join('');

    const selDef = selItem ? this.world.worldData.items[selItem.name] || {} : null;
    const selIsGear = selDef && (selDef.kind === 'weapon' || selDef.kind === 'armor');
    const actionLabel = selIsGear ? (selItem.equipped ? '卸下裝備' : '穿戴裝備') : '使用道具';
    const hasIdScroll = items.some((i) => i.name === '鑑定卷軸' && i.count > 0);
    const selUnid = Boolean(selItem && selIsGear && selItem.identified === false);
    const tooltipLines = selItem ? this.#buildItemTooltipLines(selItem, selDef) : [];
    const selIconUrl = selDef?.icon != null ? this.world.assets.itemIconUrl(selDef.icon) : '';
    const weightTone = p.weightPercent >= 82 ? 'danger' : p.weightPercent >= 50 ? 'warn' : 'ok';

    const quickAssignBtns = selItem
      ? QUICKBAR_KEYS.map((k, idx) => {
          const bound = p.quickbar?.[idx]?.kind === 'item' && p.quickbar[idx].name === selItem.name;
          return `<button type="button" class="ll-qbind-btn ${bound ? 'bound' : ''}" data-bind-item-q="${idx}" title="設為 ${k}">${k}</button>`;
        }).join('')
      : '';

    const eqSummaryPills = EQUIP_SLOT_LABELS
      .map(([key, label]) => {
        const eqIt = eqMap[key];
        if (!eqIt) return '';
        return `<button type="button" class="ll-eq-mini-pill" data-focus-item="${esc(eqIt.id)}" title="${esc(label)}：${esc(eqIt.name)}（點擊檢視）">${esc(label)}：${esc(eqIt.plus ? `+${eqIt.plus} ` : '')}${esc(eqIt.name)}</button>`;
      })
      .filter(Boolean)
      .join('');

    const filterBtns = [
      ['all', '全', '全部物品'],
      ['consumable', 'P', '藥水與食物 (P)'],
      ['gear', '裝', '武器與防具'],
      ['etc', '卷', '卷軸與材料'],
    ]
      .map(
        ([key, text, title]) =>
          `<button type="button" class="ll-inv-tool ${this.invFilter === key ? 'active' : ''}" data-inv-filter="${key}" title="${title}">${text}</button>`,
      )
      .join('');

    const pendingDiscard = selItem && this.pendingDiscardId === selItem.id;

    return `
      <div class="ll-win ll-classic-win wide inv-win">
        <div class="ll-win-head">
          <h3 class="ll-win-title">道具與裝備欄（金幣 ${p.gold.toLocaleString()} · ${items.length} 格）</h3>
          <button type="button" class="ll-win-close" data-close-modal="1">關閉</button>
        </div>
        <div class="ll-win-body">
          <div class="ll-inv-classic-wrap">
            <div class="ll-bag-slate-frame">
              <div class="ll-bag-frame-top">
                <span>🎒 背包格陣列（4×6）</span>
                <span class="ll-gold-tag">🪙 ${p.gold.toLocaleString()}</span>
              </div>
              <div class="ll-inv-grid-4col">${itemSlotsHtml}</div>
              <div class="ll-bag-footer">
                <div class="ll-bag-filters">${filterBtns}</div>
                <span class="ll-inv-weight ${weightTone}" title="負重 ${p.weightPercent}%">% ${p.weightPercent}</span>
                <div class="ll-bag-ops">
                  <button type="button" class="ll-inv-tool ${selItem?.locked ? 'locked-on' : ''}" data-toggle-lock="${esc(selItem?.id || '')}" title="鎖定／解鎖選取物品" ${selItem ? '' : 'disabled'}>🔒</button>
                  <button type="button" class="ll-inv-tool danger" data-discard-item="${esc(selItem?.id || '')}" title="丟棄選取物品" ${selItem ? '' : 'disabled'}>🗑</button>
                </div>
              </div>
            </div>

            <div class="ll-inv-detail-pane">
              ${selItem ? `
                <div class="ll-classic-tooltip">
                  <div class="ll-tip-head">
                    ${selIconUrl ? `<img src="${esc(selIconUrl)}" alt="" />` : ''}
                    <div>
                      <div class="ll-tip-title">${selItem.plus ? `+${selItem.plus} ` : ''}${esc(selItem.name)}${selItem.equipped ? ' 〔裝備中〕' : ''}</div>
                      <div class="ll-tip-badges">
                        ${selUnid ? '<span class="ll-tip-badge unid">未鑑定</span>' : ''}
                        ${selItem.locked ? '<span class="ll-tip-badge lock">已鎖定</span>' : ''}
                        ${selItem.brokenCount > 0 ? `<span class="ll-tip-badge warn">受損 -${selItem.brokenCount}</span>` : ''}
                      </div>
                    </div>
                  </div>
                  <div class="ll-tip-lines">
                    ${tooltipLines.map((ln) => `<div class="ll-tip-line ${ln.cls}">${esc(ln.text)}</div>`).join('')}
                  </div>
                </div>
                ${pendingDiscard ? `
                  <div class="ll-discard-confirm">
                    <span>確定要丟棄「${esc(selItem.name)}${selItem.count > 1 ? ` x${selItem.count}` : ''}」？</span>
                    <div class="ll-btn-row" style="margin-top:4px;">
                      <button type="button" class="ll-act-btn danger" data-confirm-discard="${esc(selItem.id)}">確認丟棄</button>
                      <button type="button" class="ll-act-btn secondary" data-cancel-discard="1">取消</button>
                    </div>
                  </div>
                ` : ''}
                <div class="ll-btn-row">
                  <button type="button" class="ll-act-btn" data-use-selected="${esc(selItem.id)}">${actionLabel}</button>
                  ${selUnid && hasIdScroll ? `<button type="button" class="ll-act-btn secondary" data-identify-item="${esc(selItem.id)}">鑑定裝備</button>` : ''}
                  <button type="button" class="ll-act-btn secondary" data-open-win="status">紙娃娃</button>
                </div>
                <div class="ll-qbind-wrap">
                  <span class="ll-qbind-label">指派快捷</span>
                  <div class="ll-qbind-row">${quickAssignBtns}</div>
                </div>
              ` : '<div class="ll-classic-tooltip"><div class="ll-tip-line muted">背包內尚無符合分類的物品。</div></div>'}

              <div class="ll-inv-eq-mini">
                <div class="ll-subhead" style="margin-bottom:4px;">目前穿戴（AC ${p.ac} · 抗魔 ${p.mr}% · 魔攻 ${p.sp || 1}）</div>
                <div class="ll-eq-mini-list">${eqSummaryPills || '<span style="color:#8b816f;font-size:11px;">尚未穿戴任何裝備</span>'}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  #renderSpellsHtml() {
    const p = this.world.player;
    const allSpells = this.world.worldData.spells || [];
    const learned = p.spells
      .map((sid) => allSpells.find((s) => s.id === sid))
      .filter(Boolean)
      .sort((a, b) => a.level - b.level || a.id - b.id);

    const filtered = this.spellCircle === 'all'
      ? learned
      : learned.filter((s) => s.level === Number(this.spellCircle));

    let selSpell = filtered.find((s) => s.id === this.selectedSpellId) || filtered[0] || learned[0] || null;
    if (selSpell) this.selectedSpellId = selSpell.id;
    else this.selectedSpellId = null;

    const circleTabs = [
      ['all', `全 (${learned.length})`],
      ...[1, 2, 3, 4, 5, 6].map((lv) => {
        const cnt = learned.filter((s) => s.level === lv).length;
        return [String(lv), `${lv}階${cnt ? `·${cnt}` : ''}`];
      }),
    ]
      .map(
        ([k, lbl]) =>
          `<button type="button" class="ll-spell-tab ${String(this.spellCircle) === k ? 'active' : ''}" data-spell-circle="${k}">${lbl}</button>`,
      )
      .join('');

    let mainContent = '';
    if (this.spellView === 'list') {
      const rows = filtered
        .map((sp) => {
          const iconUrl = this.world.assets.spellIconUrl(sp);
          const isSel = selSpell?.id === sp.id;
          return `
            <div class="ll-list-row ll-spell-list-row ${isSel ? 'selected' : ''}" data-select-spell="${sp.id}">
              <div class="ll-list-left">
                <img src="${esc(iconUrl)}" alt="${esc(sp.name)}" />
                <div>
                  <div style="font-weight:700;color:#f6dfaa;">${esc(sp.name)} <span style="font-size:11px;color:#9eb5cb;">${sp.level}階</span></div>
                  <div style="font-size:11px;color:#9eb5cb;">MP ${sp.mp} · 距離 ${sp.range || '自身'}${sp.duration ? ` · ${sp.duration}s` : ''}</div>
                </div>
              </div>
              <div style="display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end;">
                <button type="button" class="ll-act-btn" data-cast-spell="${sp.id}">施放</button>
                ${[4, 5, 6, 7].map((qi, j) => `<button type="button" class="ll-act-btn secondary" data-bind-spell-q="${qi}:${sp.id}" title="綁定至 F${9 + j}">F${9 + j}</button>`).join('')}
              </div>
            </div>
          `;
        })
        .join('');
      mainContent = `<div class="ll-spell-list-box">${rows || '<div class="ll-spell-empty">此階尚無習得魔法（可打怪掉落或向吉倫／教師購買魔法書）。</div>'}</div>`;
    } else {
      const minSlots = Math.max(20, Math.ceil(filtered.length / 5) * 5);
      const emptyCount = Math.max(0, minSlots - filtered.length);
      const cells = filtered
        .map((sp) => {
          const iconUrl = this.world.assets.spellIconUrl(sp);
          const isSel = selSpell?.id === sp.id;
          return `
            <button type="button"
                    class="ll-spell-cell ${isSel ? 'selected' : ''}"
                    data-select-spell="${sp.id}"
                    title="${esc(sp.name)}（${sp.level}階 · MP ${sp.mp}）">
              <span class="ll-spell-lv">${sp.level}</span>
              <img src="${esc(iconUrl)}" alt="${esc(sp.name)}" />
              <span class="ll-spell-mp">${sp.mp}</span>
            </button>
          `;
        })
        .join('') + Array.from({ length: emptyCount }, () => '<div class="ll-spell-cell empty" aria-hidden="true"></div>').join('');
      mainContent = `<div class="ll-spell-grid-5col">${cells}</div>`;
    }

    const elemMap = { none: '無屬性', earth: '地屬性', water: '水屬性', fire: '火屬性', wind: '風屬性', laser: '雷射' };
    const hotkeySockets = [4, 5, 6, 7]
      .map((qIdx, offset) => {
        const keyTxt = `F${9 + offset}`;
        const slot = p.quickbar?.[qIdx];
        let slotIcon = '';
        let slotTitle = `${keyTxt} 空插槽`;
        if (slot?.kind === 'spell') {
          const spObj = allSpells.find((s) => s.id === slot.id);
          if (spObj) {
            slotIcon = this.world.assets.spellIconUrl(spObj);
            slotTitle = `${keyTxt}：${spObj.name}`;
          }
        } else if (slot?.kind === 'item') {
          const def = this.world.worldData.items[slot.name];
          if (def) {
            slotIcon = this.world.assets.itemIconUrl(def.icon);
            slotTitle = `${keyTxt}：${slot.name}`;
          }
        }
        const bindVal = selSpell ? `${qIdx}:${selSpell.id}` : '';
        const isItemSlot = slot?.kind === 'item';
        return `
          <button type="button"
                  class="ll-f9-socket ${slot?.kind === 'spell' && slot.id === selSpell?.id ? 'bound' : ''} ${isItemSlot ? 'is-item' : ''}"
                  ${bindVal ? `data-bind-spell-q="${bindVal}"` : 'disabled'}
                  title="${esc(slotTitle)}${selSpell ? '（點擊綁定目前選取魔法）' : ''}">
            ${slotIcon ? `<img src="${esc(slotIcon)}" alt="" />` : ''}
            <span>${keyTxt}</span>
          </button>
        `;
      })
      .join('');

    return `
      <div class="ll-win ll-classic-win spell-win">
        <div class="ll-win-head">
          <h3 class="ll-win-title">魔法書（MP ${p.mp} / ${p.maxMp}）</h3>
          <div class="ll-win-head-tools">
            <div class="ll-view-switch">
              <button type="button" class="ll-view-btn ${this.spellView === 'grid' ? 'active' : ''}" data-spell-view="grid" title="5×4 魔法圖示盤">圖示</button>
              <button type="button" class="ll-view-btn ${this.spellView === 'list' ? 'active' : ''}" data-spell-view="list" title="條列詳情檢視">條列</button>
            </div>
            <button type="button" class="ll-win-close" data-close-modal="1">關閉</button>
          </div>
        </div>
        <div class="ll-win-body">
          <div class="ll-spell-tabs">${circleTabs}</div>
          <div class="ll-spell-slate-wrap">${mainContent}</div>
          ${this.spellView === 'grid' && filtered.length === 0 ? '<div class="ll-spell-empty-hint">目前尚未習得此階魔法（可打怪掉落或向吉倫學習）</div>' : ''}
          ${selSpell ? `
            <div class="ll-spell-selected-bar">
              <div class="ll-spell-sel-info">
                <div class="ll-spell-sel-name">${esc(selSpell.name)} <span class="ll-spell-sel-tier">${selSpell.level}階</span></div>
                <div class="ll-spell-sel-meta">
                  MP ${selSpell.mp} · 距離 ${selSpell.range || '自身'} · ${elemMap[selSpell.element] || selSpell.element}${selSpell.duration ? ` · 持續 ${selSpell.duration}s` : ''}${selSpell.maxDmg > 0 ? ` · 威力 ${selSpell.minDmg}~${selSpell.maxDmg}` : ''}
                </div>
              </div>
              <button type="button" class="ll-act-btn" data-cast-spell="${selSpell.id}">施放魔法</button>
            </div>
          ` : ''}
          <div class="ll-spell-footer">
            <div class="ll-spell-stats">
              <div class="ll-stat-pill-classic"><span>魔攻</span><b>${p.sp || 1}</b></div>
              <div class="ll-stat-pill-classic"><span>魔防</span><b>${p.mr}%</b></div>
            </div>
            <div class="ll-f9-tray">${hotkeySockets}</div>
          </div>
        </div>
      </div>
    `;
  }

  #renderStatusHtml() {
    const p = this.world.player;
    const expSpan = Math.max(1, p.expNext - p.expPrev);
    const expPct = Math.min(99.99, Math.max(0, ((p.exp - p.expPrev) / expSpan) * 100)).toFixed(2);
    const clsName = p.className || CLASS_LABELS[p.classId] || '冒險者';
    const eqMap = this.#buildEquipMap(p);
    const buffs = this.world.getBuffList();

    const paperdollHtml = this.#renderPaperdollSlotsHtml(eqMap);
    const buffRows = buffs.length
      ? buffs
          .map((bf) => `<span class="ll-chip buff">${esc(bf.label)} ${bf.remainSec}s</span>`)
          .join('')
      : '<span style="font-size:11px;color:#8c8372;">無作用中的增益狀態</span>';

    const kills = p.kills || 0;
    const q1 = p.quests?.hunterDone ? '完成 (+150金/紅水x5)' : `進行中 ${Math.min(5, kills)}/5`;
    const q2 = p.quests?.slayerDone ? '完成 (+500金/瞬卷x3)' : `進行中 ${Math.min(20, kills)}/20`;

    const fmtStat = (base, eff) => {
      const v = eff ?? base;
      const diff = v - base;
      return diff > 0 ? `${v} <em class="buff-plus">(+${diff})</em>` : String(v);
    };

    return `
      <div class="ll-win ll-classic-win wide status-win">
        <div class="ll-win-head">
          <h3 class="ll-win-title">角色狀態與裝備紙娃娃 — ${esc(p.name)}（${clsName}）</h3>
          <button type="button" class="ll-win-close" data-close-modal="1">關閉</button>
        </div>
        <div class="ll-win-body">
          <div class="ll-inv-grid status-layout">
            <div class="ll-status-slate">
              <div class="ll-st-exp-row">
                <span class="ll-st-lbl">等級 &amp; 經驗值</span>
                <div class="ll-st-box wide"><b>Lv.${p.level}</b><span>${expPct}%</span></div>
              </div>
              <div class="ll-st-rows">
                <div class="ll-st-row"><span class="ll-st-lbl">體力</span><span class="ll-st-box">${p.hp} / ${p.maxHp}</span></div>
                <div class="ll-st-row"><span class="ll-st-lbl">魔力</span><span class="ll-st-box">${p.mp} / ${p.maxMp}</span></div>
                <div class="ll-st-row"><span class="ll-st-lbl">防禦</span><span class="ll-st-box">AC ${p.ac}</span></div>
                <div class="ll-st-row"><span class="ll-st-lbl">負重</span><span class="ll-st-box">${p.weightPercent}%</span></div>
                <div class="ll-st-row"><span class="ll-st-lbl">飽度</span><span class="ll-st-box">${p.food ?? 84}%</span></div>
              </div>

              <div class="ll-st-divider"></div>
              <div class="ll-st-attrs">
                <div class="ll-st-row"><span class="ll-st-lbl">力量</span><span class="ll-st-box">${fmtStat(p.stats.str, p.effStr)}</span></div>
                <div class="ll-st-row"><span class="ll-st-lbl">敏捷</span><span class="ll-st-box">${fmtStat(p.stats.dex, p.effDex)}</span></div>
                <div class="ll-st-row"><span class="ll-st-lbl">體質</span><span class="ll-st-box">${p.stats.con}</span></div>
                <div class="ll-st-row"><span class="ll-st-lbl">智力</span><span class="ll-st-box">${p.stats.int}</span></div>
                <div class="ll-st-row"><span class="ll-st-lbl">精神</span><span class="ll-st-box">${p.stats.wis}</span></div>
                <div class="ll-st-row"><span class="ll-st-lbl">魅力</span><span class="ll-st-box">${p.stats.cha}</span></div>
              </div>

              <div class="ll-st-divider"></div>
              <div class="ll-st-rows">
                <div class="ll-st-row"><span class="ll-st-lbl">魔法等級</span><span class="ll-st-box">${Math.max(1, Math.floor(p.level / 4))}</span></div>
                <div class="ll-st-row"><span class="ll-st-lbl">額外魔攻</span><span class="ll-st-box">SP ${p.sp || 1}</span></div>
                <div class="ll-st-row"><span class="ll-st-lbl">魔防 / 正義</span><span class="ll-st-box">${p.mr}% · ${p.lawful}</span></div>
              </div>

              <div class="ll-st-divider"></div>
              <div class="ll-subhead" style="margin-bottom:4px;">屬性抗性</div>
              <div class="ll-st-elems">
                <div class="ll-st-elem"><span>地性</span><b>0%</b></div>
                <div class="ll-st-elem"><span>水性</span><b>0%</b></div>
                <div class="ll-st-elem"><span>火性</span><b>0%</b></div>
                <div class="ll-st-elem"><span>風性</span><b>0%</b></div>
              </div>
            </div>

            <div class="ll-doll-pane">
              <div class="ll-subhead" style="display:flex;justify-content:space-between;align-items:center;">
                <span>人型紙娃娃裝備（點擊開啟背包切換）</span>
                <span style="font-size:11px;color:#b8aa8f;">${p.clanName ? `《${esc(p.clanName)}》` : '無血盟'}</span>
              </div>
              <div class="ll-doll-stage">
                ${this.#renderPaperdollSvg()}
                <div class="ll-doll-grid">${paperdollHtml}</div>
              </div>
              <div class="ll-status-extra">
                <div class="ll-equip-row"><span>所在地 / 金幣</span><span>${esc(MAP_NAMES[p.map] || p.map)} (${p.tx},${p.ty}) · ${p.gold.toLocaleString()}</span></div>
                <div class="ll-equip-row"><span>夥伴 / 討伐</span><span>${p.pet ? `${esc(p.pet.name)} Lv.${p.pet.level}` : '無寵物'} · 殺敵 ${kills}</span></div>
                <div class="ll-equip-row"><span>初階 / 巡守試煉</span><span>${q1} / ${q2}</span></div>
                <div class="ll-stat-chips" style="margin-top:6px;">${buffRows}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  #renderPolyModalHtml() {
    const p = this.world.player;
    const scrollCnt = p.inventory.filter((i) => i.name === '變形卷軸').reduce((s, i) => s + i.count, 0);
    return `
      <div class="ll-win wide">
        <div class="ll-win-head">
          <h3 class="ll-win-title">變形契約選單（持有變形卷軸 ${scrollCnt} 張）</h3>
          <button type="button" class="ll-win-close" data-close-modal="1">關閉</button>
        </div>
        <div class="ll-win-body">
          <div style="font-size:12px;color:#b8aa90;margin-bottom:10px;">
            選擇要變身的天堂怪物形態（維持 600 秒）：將即時更換地圖精靈造型並獲得攻速與戰鬥加成。
          </div>
          <div class="ll-morph-grid">
            ${MORPH_FORMS.map((f) => {
              const active = p.polyName === f.label && (p.buffs.poly || 0) > performance.now();
              const disabled = (f.gfx && p.level < f.minLv) || (f.gfx && scrollCnt <= 0);
              return `
                <button type="button" class="ll-morph-card ${active ? 'active' : ''}" data-poly-form="${esc(f.id)}" ${disabled ? 'disabled' : ''}>
                  <div style="font-weight:700;color:#ffe28a;">${esc(f.label)} <span style="font-size:11px;color:#93c5fd;">(Lv.${f.minLv}+)</span></div>
                  <div style="font-size:11px;color:#cbd5e1;">${esc(f.desc)}</div>
                </button>
              `;
            }).join('')}
          </div>
        </div>
      </div>
    `;
  }

  #renderMapModalHtml() {
    const p = this.world.player;
    const meta = getMapMeta(p.map);
    const rules = [
      `瞬移:${meta.tele ? '可' : '禁'}`,
      `回卷:${meta.recall ? '可' : '禁'}`,
      `記點:${meta.mark ? '可' : '禁'}`,
    ].join(' · ');
    return `
      <div class="ll-win wide">
        <div class="ll-win-head">
          <h3 class="ll-win-title">世界地圖 — ${esc(MAP_NAMES[p.map] || meta.name)} (${p.tx}, ${p.ty})</h3>
          <button type="button" class="ll-win-close" data-close-modal="1">關閉</button>
        </div>
        <div class="ll-win-body">
          <div style="font-size:12px;color:#b8aa90;margin-bottom:8px;">
            綠點：玩家位置 · 金點：村莊 NPC／地標 · 青點：地圖傳送點 · 紅點：怪物／地監（${esc(rules)} · 點擊雷達可直接尋路）
          </div>
          <canvas class="ll-minimap-canvas" width="480" height="340" data-role="minimap-canvas"></canvas>
          <div style="margin-top:10px;">
            <div style="font-size:12px;font-weight:700;color:#f3d284;margin-bottom:6px;">
              亞丁世界傳送總覽（說話之島 ＋ 亞丁大陸 7 城鎮 ＋ 經典地監）
            </div>
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:6px;">
              ${WORLD_EXPEDITION_ROUTES.map(
                (r, idx) => `
                <div class="ll-list-row" style="margin:0;">
                  <div>
                    <div style="font-weight:700;font-size:12px;">[${esc(r.group)}] ${esc(r.label)}</div>
                    <div style="font-size:11px;color:#9eb5cb;">${esc(r.lv)} · (${r.x}, ${r.y})</div>
                  </div>
                  <button type="button" class="ll-act-btn" data-world-warp="${idx}">前往 (${r.price}G)</button>
                </div>
              `,
              ).join('')}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  #paintRadarCanvas(canvas, span, { step = 2, walkColor = '#253547', onPicked } = {}) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const p = this.world.player;
    const minX = p.tx - span;
    const maxX = p.tx + span;
    const minY = p.ty - span;
    const maxY = p.ty + span;
    const w = canvas.width;
    const h = canvas.height;
    ctx.fillStyle = '#070c12';
    ctx.fillRect(0, 0, w, h);

    const tileW = Math.max(2, Math.ceil((step / (span * 2)) * w));
    const tileH = Math.max(2, Math.ceil((step / (span * 2)) * h));
    ctx.fillStyle = walkColor;
    for (let ty = minY; ty <= maxY; ty += step) {
      const py = ((ty - minY) / (span * 2)) * h;
      for (let tx = minX; tx <= maxX; tx += step) {
        if (!this.world.isoMap.isWalkableTile(tx, ty, p.map)) continue;
        const px = ((tx - minX) / (span * 2)) * w;
        ctx.fillRect(px, py, tileW, tileH);
      }
    }

    const toPx = (tx, ty) => ({
      x: ((tx - minX) / (span * 2)) * w,
      y: ((ty - minY) / (span * 2)) * h,
    });

    ctx.fillStyle = '#38bdf8';
    for (const po of this.world.worldData.portals || []) {
      if (po.map !== p.map) continue;
      const pt = toPx(po.x, po.y);
      ctx.fillRect(pt.x - 2.5, pt.y - 2.5, 5, 5);
    }

    ctx.fillStyle = '#f87171';
    for (const m of this.world.mobs) {
      if (m.hp <= 0) continue;
      const pt = toPx(m.tx, m.ty);
      ctx.fillRect(pt.x - 1.5, pt.y - 1.5, 3, 3);
    }

    ctx.fillStyle = '#facc15';
    for (const n of this.world.npcs) {
      const pt = toPx(n.x, n.y);
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = '#60a5fa';
    for (const peer of this.world.remotePeers || []) {
      if (peer.map !== p.map) continue;
      const pt = toPx(peer.tx, peer.ty);
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    const me = toPx(p.tx, p.ty);
    ctx.fillStyle = '#4ade80';
    ctx.beginPath();
    ctx.arc(me.x, me.y, span > 90 ? 5 : 3.5, 0, Math.PI * 2);
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
      onPicked?.(gx, gy);
    };
  }

  #drawMinimapCanvas() {
    const canvas = this.elements.modalLayer.querySelector('[data-role="minimap-canvas"]');
    const p = this.world.player;
    this.#paintRadarCanvas(canvas, 120, {
      step: 2,
      walkColor: '#253547',
      onPicked: () => this.closeModal(),
    });
    if (canvas && p.map === 4) {
      const ctx = canvas.getContext('2d');
      const w = canvas.width;
      const minX = 32460;
      const maxX = 33640;
      const minY = 32180;
      const maxY = 33600;
      const boxW = 116;
      const boxH = 116;
      const boxX = w - boxW - 8;
      const boxY = 8;
      ctx.save();
      ctx.fillStyle = 'rgba(7, 12, 18, 0.86)';
      ctx.strokeStyle = 'rgba(138, 108, 59, 0.9)';
      ctx.lineWidth = 1;
      ctx.fillRect(boxX, boxY, boxW, boxH);
      ctx.strokeRect(boxX, boxY, boxW, boxH);
      ctx.font = '9px sans-serif';
      for (const lm of CONTINENT_LANDMARKS) {
        const lx = boxX + 8 + ((lm.x - minX) / (maxX - minX)) * (boxW - 16);
        const ly = boxY + 8 + ((lm.y - minY) / (maxY - minY)) * (boxH - 16);
        ctx.fillStyle = lm.color;
        ctx.beginPath();
        ctx.arc(lx, ly, 2.4, 0, Math.PI * 2);
        ctx.fill();
        if (lm.color === '#facc15') {
          ctx.fillStyle = '#e5dcc8';
          ctx.fillText(lm.label.slice(0, 2), lx + 3, ly + 3);
        }
      }
      const mx = boxX + 8 + ((p.tx - minX) / (maxX - minX)) * (boxW - 16);
      const my = boxY + 8 + ((p.ty - minY) / (maxY - minY)) * (boxH - 16);
      ctx.fillStyle = '#4ade80';
      ctx.beginPath();
      ctx.arc(mx, my, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  #resolveTeleportDestinations(npc) {
    if (npc && TELEPORT_ROUTES_BY_NPC[npc.name]) {
      return TELEPORT_ROUTES_BY_NPC[npc.name];
    }
    if (npc?.name === '保羅' || npc?.name === '丹尼爾') {
      return [
        TELEPORT_ACTIONS['gludio-orcfortress'],
        TELEPORT_ACTIONS['orcfortress-gludio'],
      ].filter(Boolean);
    }
    if (npc) {
      const home = resolveHomeTown(npc.map, npc.x, npc.y);
      const alias = TOWN_TELEPORTER_ALIAS[home?.id];
      if (alias && TELEPORT_ROUTES_BY_NPC[alias]) {
        return TELEPORT_ROUTES_BY_NPC[alias];
      }
    }
    return TELEPORT_ROUTES_BY_NPC['盧卡斯'] || WORLD_EXPEDITION_ROUTES;
  }

  #resolveHarborDestinations() {
    const m = Number(this.world.player.map);
    return HARBOR_DESTINATIONS_BY_MAP[m] || HARBOR_DESTINATIONS_BY_MAP[0] || [];
  }

  #getShopQty(idx) {
    const raw = Number(this.npcShopQty?.[idx] ?? 1);
    if (!Number.isFinite(raw)) return 1;
    return Math.max(1, Math.min(9999, Math.floor(raw)));
  }

  #setShopQtyDom(idx, entry, nextQty) {
    const clamped = Math.max(1, Math.min(9999, Math.floor(Number(nextQty) || 1)));
    this.npcShopQty[idx] = clamped;
    const modal = this.elements.modalLayer;
    const input = modal.querySelector(`[data-shop-qty="${idx}"]`);
    if (input && Number(input.value) !== clamped) {
      input.value = String(clamped);
    }
    this.#refreshShopTotalDom(idx, entry, clamped);
    return clamped;
  }

  #refreshShopTotalDom(idx, entry, qty) {
    const totalEl = this.elements.modalLayer.querySelector(`[data-shop-total="${idx}"]`);
    if (!totalEl || !entry) return;
    const total = entry.price * qty;
    totalEl.textContent = `總計 ${total.toLocaleString()} 金幣`;
    totalEl.classList.toggle('insufficient', total > this.world.player.gold);
  }

  #buyShopRow(idx, explicitQty = null) {
    if (!this.npcSession) return;
    const entries = this.#resolveNpcShopList(this.npcSession.npc);
    const entry = entries[idx];
    if (!entry) return;
    const qty = explicitQty !== null ? Math.max(1, Math.min(9999, Math.floor(Number(explicitQty) || 1))) : this.#getShopQty(idx);
    this.world.buyFromShop(this.npcSession.npc.name, entry, qty);
    this.renderModal();
    this.sync(true);
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
            const qty = this.#getShopQty(i);
            const total = e.price * qty;
            const insufficient = total > p.gold;
            return `
              <div class="ll-list-row ll-shop-row">
                <div class="ll-list-left">
                  <img src="${esc(iconUrl)}" alt="" />
                  <div>
                    <div style="font-weight:700;">${esc(e.item)}${e.count > 1 ? ` x${e.count}` : ''}</div>
                    <div style="font-size:11px;color:#ffd872;">單價：${e.price.toLocaleString()} 金幣</div>
                  </div>
                </div>
                <div class="ll-shop-ctrl">
                  <div class="ll-shop-stepper">
                    <button type="button" class="ll-qty-step" data-shop-step="${i}:-1" title="減少 1" aria-label="減少 1">-1</button>
                    <input
                      type="number"
                      class="ll-qty-input"
                      min="1"
                      max="9999"
                      inputmode="numeric"
                      value="${qty}"
                      data-shop-qty="${i}"
                      aria-label="${esc(e.item)} 購買數量"
                    />
                    <button type="button" class="ll-qty-step" data-shop-step="${i}:1" title="增加 1" aria-label="增加 1">+1</button>
                    ${def?.stack ? `<button type="button" class="ll-qty-step secondary" data-shop-step="${i}:10" title="增加 10">+10</button>` : ''}
                  </div>
                  <div class="ll-shop-buy-group">
                    <span class="ll-shop-total${insufficient ? ' insufficient' : ''}" data-shop-total="${i}">總計 ${total.toLocaleString()} 金幣</span>
                    <button type="button" class="ll-act-btn" data-shop-buy="${i}">購買</button>
                  </div>
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
      const tpRoutes = this.#resolveTeleportDestinations(npc);
      bodyHtml = `
        <div class="ll-npc-html">
          <strong>${esc(npc.name)}：</strong>願諸神祝福你的旅途！你想前往亞丁世界的哪個區域？
        </div>
        ${tpRoutes
          .map(
            (dest, idx) => `
          <div class="ll-list-row">
            <span>${esc(dest.label)} <span style="font-size:11px;color:#9eb5cb;">(${esc(MAP_NAMES[dest.map] || `地圖 ${dest.map}`)})</span></span>
            <button type="button" class="ll-act-btn" data-tp-idx="${idx}">傳送 (${dest.price} 金幣)</button>
          </div>
        `,
          )
          .join('')}
        ${npc.name === '盧卡斯' ? '<div class="ll-btn-row" style="margin-top:10px;"><button type="button" class="ll-act-btn secondary" data-npc-mode="clan">血盟創立／管理</button></div>' : ''}
      `;
    } else if (mode === 'pet') {
      const pet = p.pet;
      bodyHtml = `
        <div style="margin-bottom:8px;color:#ffd872;">持有金幣：${p.gold.toLocaleString()} Adena · 馴獸師：${esc(npc.name)}</div>
        ${
          pet
            ? `
          <div class="ll-list-row" style="border-color:#9b7a3c;background:rgba(46,35,17,0.68);">
            <div>
              <div style="font-weight:700;color:#ffe28a;">同行寵物：${esc(pet.name)} (Lv.${pet.level})</div>
              <div style="font-size:11px;color:#cbd5e1;">HP ${pet.hp}/${pet.maxHp} · 攻擊力 ${pet.minDmg}~${pet.maxDmg} · EXP ${pet.exp}</div>
            </div>
            <div style="display:flex;gap:4px;">
              <button type="button" class="ll-act-btn" data-pet-heal="1">治療恢復 (100金)</button>
              <button type="button" class="ll-act-btn secondary" data-pet-dismiss="1">寄存離隊</button>
            </div>
          </div>
        `
            : '<div style="font-size:12px;color:#b8aa90;margin-bottom:8px;">目前尚未帶著召喚寵物，選擇下方忠誠夥伴一同狩獵吧。</div>'
        }
        ${PET_CATALOG.map(
          (spec) => `
          <div class="ll-list-row">
            <div>
              <div style="font-weight:700;">${esc(spec.name)} <span style="font-size:11px;color:#ffd872;">(${spec.price} 金幣)</span></div>
              <div style="font-size:11px;color:#b8aa90;">HP ${spec.baseHp} · 攻擊 ${spec.dmg[0]}~${spec.dmg[1]} · ${esc(spec.desc)}</div>
            </div>
            <button type="button" class="ll-act-btn" data-pet-adopt="${esc(spec.id)}">領養召喚</button>
          </div>
        `,
        ).join('')}
      `;
    } else if (mode === 'clan') {
      const peers = this.world.remotePeers || [];
      bodyHtml = `
        <div style="margin-bottom:8px;color:#ffd872;">目前角色：${esc(p.name)}（Lv.${p.level}）· 所屬血盟：${p.clanName ? `《${esc(p.clanName)}》` : '無'} · 同服在線：${this.world.onlineCount || 1} 人</div>
        <div class="ll-list-row" style="gap:8px;flex-wrap:wrap;">
          <input type="text" id="ll-clan-input" maxlength="12" placeholder="輸入血盟名稱（如：亞丁遠征軍）" value="${esc(p.clanName || '')}" style="flex:1;min-width:170px;height:30px;padding:0 8px;border:1px solid #6b532e;background:#0e1217;color:#f5ebd6;border-radius:4px;" />
          <button type="button" class="ll-act-btn" data-clan-create="1">創立／加入血盟 (1000 金幣)</button>
          ${p.clanName ? '<button type="button" class="ll-act-btn secondary" data-clan-leave="1">退出血盟</button>' : ''}
        </div>
        <div class="ll-subhead" style="margin-top:10px;">目前在地圖附近之冒險者（${peers.length} 人）</div>
        ${peers.length ? peers.map((rp) => `<div class="ll-list-row"><span>${rp.clanName ? `《${esc(rp.clanName)}》` : ''}${esc(rp.charName || rp.name || '冒險者')}${rp.level ? ` (Lv.${rp.level})` : ''}</span><span style="color:#93c5fd;">(${rp.tx}, ${rp.ty})</span></div>`).join('') : '<div style="font-size:12px;color:#998;">目前附近沒有其他同圖在線玩家。</div>'}
      `;
    } else if (mode === 'harbor') {
      const harborRoutes = this.#resolveHarborDestinations();
      bodyHtml = `
        <div class="ll-npc-html">
          <strong>${esc(npc.name)}：</strong>海風正順！想要搭乘渡船前往哪一處港口或渡口？
        </div>
        ${harborRoutes
          .map(
            (dest, idx) => `
          <div class="ll-list-row">
            <span>${esc(dest.label)} <span style="font-size:11px;color:#9eb5cb;">(${esc(MAP_NAMES[dest.map] || `地圖 ${dest.map}`)} · ${dest.x}, ${dest.y})</span></span>
            <button type="button" class="ll-act-btn" data-harbor-idx="${idx}">乘船出發 (${dest.price} 金幣)</button>
          </div>
        `,
          )
          .join('')}
      `;
    } else if (mode === 'craft') {
      const recipes = CRAFT_RECIPES.map((r, idx) => ({ r, idx })).filter(({ r }) => r.npc === npc.name);
      const countOwned = (matName) =>
        p.inventory.filter((i) => i.name === matName && !i.equipped).reduce((s, i) => s + i.count, 0);
      bodyHtml = `
        <div style="margin-bottom:8px;color:#ffd872;">持有金幣：${p.gold.toLocaleString()} Adena · 工坊匠師：${esc(npc.name)}</div>
        ${recipes
          .map(({ r, idx }) => {
            const def = this.world.worldData.items[r.output];
            const iconUrl = this.world.assets.itemIconUrl(def?.icon);
            const hasGold = p.gold >= r.adena;
            const matsHtml = r.mats
              .map(([mName, need]) => {
                const have = countOwned(mName);
                const lack = have < need;
                return `<span class="ll-craft-mat ${lack ? 'lack' : ''}">${esc(mName)} ${have}/${need}</span>`;
              })
              .join('');
            const canCraft = hasGold && r.mats.every(([mName, need]) => countOwned(mName) >= need);
            return `
              <div class="ll-list-row">
                <div class="ll-list-left">
                  <img src="${esc(iconUrl)}" alt="" />
                  <div>
                    <div style="font-weight:700;">${esc(r.output)}${r.count > 1 ? ` x${r.count}` : ''} <span style="font-size:11px;color:#ffd872;">(${r.adena} 金幣)</span></div>
                    <div class="ll-craft-reqs">${matsHtml}</div>
                  </div>
                </div>
                <button type="button" class="ll-act-btn ${canCraft ? '' : 'secondary'}" data-craft-idx="${idx}">製作</button>
              </div>
            `;
          })
          .join('') || '<div>目前暫無可製作項目。</div>'}
      `;
    } else if (mode === 'teach') {
      const courses = TEACHER_SPELLS.filter((t) => t.npcs.includes(npc.name));
      bodyHtml = `
        <div style="margin-bottom:8px;color:#ffd872;">持有金幣：${p.gold.toLocaleString()} Adena · 等級：Lv.${p.level}</div>
        ${courses
          .map((t) => {
            const sp = (this.world.worldData.spells || []).find((s) => s.id === t.id);
            if (!sp) return '';
            const learned = p.spells.includes(t.id);
            const classOk = t.classes.includes(p.classId);
            const lvOk = p.level >= t.minLv;
            const statusText = learned
              ? '已習得'
              : !classOk
                ? '職業不符'
                : !lvOk
                  ? `需 Lv.${t.minLv}`
                  : `費用 ${t.price} 金幣`;
            return `
              <div class="ll-list-row">
                <div>
                  <div style="font-weight:700;">[C${sp.circle}] ${esc(sp.name)} <span style="font-size:11px;color:#93c5fd;">(MP ${sp.mp} · Lv.${t.minLv}+)</span></div>
                  <div style="font-size:11px;color:#b8aa90;">${esc(statusText)}</div>
                </div>
                <button type="button" class="ll-act-btn ${learned || !classOk || !lvOk ? 'secondary' : ''}" ${learned || !classOk || !lvOk ? 'disabled' : ''} data-learn-spell="${t.id}">${learned ? '已學會' : '學習'}</button>
              </div>
            `;
          })
          .join('')}
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
      if (npc.type === 'Inn') {
        extraBtns.push('<button type="button" class="ll-act-btn" data-npc-act="inn-rest">旅館休息回復體力與解毒 (30 金幣)</button>');
      }
      if (npc.type === 'Craft') {
        extraBtns.push('<button type="button" class="ll-act-btn" data-npc-mode="craft">開啟道具製作工坊</button>');
      }
      if (npc.name === '吉倫' || npc.name === '甘特') {
        extraBtns.push('<button type="button" class="ll-act-btn" data-npc-mode="teach">學習初級～三階魔法</button>');
      }
      if (npc.type === 'Dwarf') {
        extraBtns.push('<button type="button" class="ll-act-btn" data-npc-mode="deposit">開啟個人倉庫</button>');
      }
      if (npc.type === 'Blesser555') {
        extraBtns.push('<button type="button" class="ll-act-btn" data-npc-act="bless">接受免費祝福補滿狀態</button>');
      }
      if (npc.type === 'PetShop') {
        extraBtns.push('<button type="button" class="ll-act-btn" data-npc-mode="pet">寵物管理／領養</button>');
      }
      if (npc.type === 'ClanRegistrar' || npc.name === '盧卡斯') {
        extraBtns.push('<button type="button" class="ll-act-btn" data-npc-mode="clan">創立／管理血盟</button>');
      }
      if (npc.name === '多瑪' || npc.name === '丁') {
        extraBtns.push('<button type="button" class="ll-act-btn" data-npc-act="fix">修理受損武器 (300 金幣)</button>');
      }
      if (npc.type === 'Teleport' || npc.name === '傑瑞德') {
        const label = npc.name === '傑瑞德' ? '進入傑瑞德的試煉地監' : '開啟傳送地點清單';
        extraBtns.push(`<button type="button" class="ll-act-btn" data-npc-mode="teleport">${label}</button>`);
      }
      if (npc.name.includes('港口主人') || npc.name.includes('水手') || npc.name.includes('船長')) {
        extraBtns.push('<button type="button" class="ll-act-btn" data-npc-mode="harbor">搭乘跨海／沿岸渡船</button>');
      }
      if (STATUE_BLESSINGS[npc.name]) {
        extraBtns.push('<button type="button" class="ll-act-btn" data-npc-act="statue-pray">向英雄雕像祈禱庇佑</button>');
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
    const areaName = MAP_NAMES[npc.map] || '亞丁世界';
    if (npc.type === 'Guard') {
      return `<strong>${esc(npc.name)}：</strong>${esc(areaName)}城鎮由我們守護！請放心在安全區內補給與整備，出發冒險前別忘了攜帶紅色藥水與傳送回家卷軸。`;
    }
    if (npc.type === 'Blesser555') {
      return `<strong>${esc(npc.name)}：</strong>年輕的冒險者啊，只要點擊下方祝福按鈕，我就能為你恢復體力與魔力，並賜予加速與保護罩！`;
    }
    if (npc.type === 'PetShop') {
      return `<strong>${esc(npc.name)}：</strong>訓練有素的獵犬與小狼是最可靠的狩獵夥伴！隨時可在此領養、治療或寄存您的寵物。`;
    }
    if (npc.type === 'ClanRegistrar' || npc.name === '盧卡斯') {
      return `<strong>${esc(npc.name)}：</strong>建立血盟是邁向亞丁城主的第一步，凝聚戰友的徽記與血盟傳送之光吧。`;
    }
    if (npc.name === '傑瑞德') {
      return `<strong>${esc(npc.name)}：</strong>銀騎士的試煉需要面對成群結隊的蛇女。準備好藥水與武器後，點擊下方即可進入傑瑞德的試煉地監（內部出口可傳回銀騎士村莊）。`;
    }
    if (npc.name === '多瑪' || npc.name === '丁') {
      return `<strong>${esc(npc.name)}：</strong>擊打岩石魔怪或硬甲怪物時刀刃很容易受損，若武器捲刃，我可以為你鍛打修復！`;
    }
    if (npc.name.includes('港口主人') || npc.name.includes('水手') || npc.name.includes('船長')) {
      return `<strong>${esc(npc.name)}：</strong>歡迎來到${esc(areaName)}港口，我可以為你安排往返說話之島與古魯丁港口或附近沿岸渡口的船班。`;
    }
    if (STATUE_BLESSINGS[npc.name]) {
      return `<strong>${esc(npc.name)}：</strong>古老的英雄意志在此閃耀，虔誠祈禱即可獲得免費戰鬥加護。`;
    }
    if (npc.name.includes('木人')) {
      return `<strong>木人：</strong>點擊攻擊即可進行近戰／弓箭打擊練習。村外還有高侖、半獸人與骷髏等著你挑戰。`;
    }
    return `<strong>${esc(npc.name)}：</strong>你好，來自遠方的旅人。${esc(areaName)}處處充滿冒險氣息，需要協助請隨時開口。`;
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
    const p = this.world.player;
    const homeTown = resolveHomeTown(p.map, p.tx, p.ty);
    return `
      <div class="ll-win">
        <div class="ll-win-head">
          <h3 class="ll-win-title">系統選單 — 天堂 1.63 亞丁實境</h3>
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
            <span>緊急脫離卡點（傳送回 ${esc(homeTown.label)}）</span>
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

  #handleUseResult(res) {
    if (res?.openModal) {
      if (res.scrollId) this.pendingPolyScrollId = res.scrollId;
      this.activeModal = res.openModal;
      this.renderModal();
      this.sync(true);
      return true;
    }
    return false;
  }

  #handleModalClick(ev) {
    if (ev.target.closest('[data-close-modal]')) {
      this.closeModal();
      return;
    }

    const openWin = ev.target.closest('[data-open-win]');
    if (openWin) {
      if (openWin.dataset.preselectItem) this.selectedItemId = openWin.dataset.preselectItem;
      this.toggleModal(openWin.dataset.openWin);
      return;
    }

    const invFilterBtn = ev.target.closest('[data-inv-filter]');
    if (invFilterBtn) {
      this.invFilter = invFilterBtn.dataset.invFilter || 'all';
      this.pendingDiscardId = null;
      this.renderModal();
      return;
    }

    const lockBtn = ev.target.closest('[data-toggle-lock]');
    if (lockBtn && lockBtn.dataset.toggleLock) {
      const it = this.world.player.inventory.find((i) => i.id === lockBtn.dataset.toggleLock);
      if (it) {
        it.locked = !it.locked;
        this.pendingDiscardId = null;
        this.world.dirtySave = true;
        this.world.addLog(`${it.locked ? '已鎖定' : '已解除鎖定'} ${it.name}。`, 'info');
        this.renderModal();
        this.sync(true);
      }
      return;
    }

    const discardBtn = ev.target.closest('[data-discard-item]');
    if (discardBtn && discardBtn.dataset.discardItem) {
      const it = this.world.player.inventory.find((i) => i.id === discardBtn.dataset.discardItem);
      if (!it) return;
      if (it.equipped || it.locked) {
        this.world.addLog('無法丟棄裝備中或已鎖定的物品，請先卸下／解鎖。', 'warn');
        this.sync(true);
        return;
      }
      this.pendingDiscardId = this.pendingDiscardId === it.id ? null : it.id;
      this.renderModal();
      return;
    }

    const confirmDiscard = ev.target.closest('[data-confirm-discard]');
    if (confirmDiscard) {
      const id = confirmDiscard.dataset.confirmDiscard;
      const it = this.world.player.inventory.find((i) => i.id === id);
      if (it && !it.equipped && !it.locked) {
        const label = `${it.plus ? `+${it.plus} ` : ''}${it.name}${it.count > 1 ? ` x${it.count}` : ''}`;
        this.world.consumeItem(id, it.count);
        this.world.addLog(`已丟棄 ${label}。`, 'info');
        if (this.selectedItemId === id) this.selectedItemId = null;
      }
      this.pendingDiscardId = null;
      this.renderModal();
      this.sync(true);
      return;
    }

    if (ev.target.closest('[data-cancel-discard]')) {
      this.pendingDiscardId = null;
      this.renderModal();
      return;
    }

    const focusItemBtn = ev.target.closest('[data-focus-item]');
    if (focusItemBtn) {
      this.selectedItemId = focusItemBtn.dataset.focusItem;
      this.pendingDiscardId = null;
      this.invFilter = 'all';
      this.renderModal();
      return;
    }

    const selItemBtn = ev.target.closest('[data-select-item]');
    if (selItemBtn) {
      const id = selItemBtn.dataset.selectItem;
      this.pendingDiscardId = null;
      if (this.selectedItemId === id) {
        if (this.#handleUseResult(this.world.useItem(id))) return;
      } else {
        this.selectedItemId = id;
      }
      this.renderModal();
      this.sync(true);
      return;
    }

    const useSel = ev.target.closest('[data-use-selected]');
    if (useSel) {
      this.pendingDiscardId = null;
      if (this.#handleUseResult(this.world.useItem(useSel.dataset.useSelected))) return;
      this.renderModal();
      this.sync(true);
      return;
    }

    const identifyBtn = ev.target.closest('[data-identify-item]');
    if (identifyBtn) {
      this.pendingDiscardId = null;
      this.world.identifyItem(identifyBtn.dataset.identifyItem);
      this.renderModal();
      this.sync(true);
      return;
    }

    const polyBtn = ev.target.closest('[data-poly-form]');
    if (polyBtn) {
      this.world.applyPolymorph(polyBtn.dataset.polyForm, this.pendingPolyScrollId);
      this.pendingPolyScrollId = null;
      this.closeModal();
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
        this.renderModal();
        this.sync(true);
      }
      return;
    }

    const viewBtn = ev.target.closest('[data-spell-view]');
    if (viewBtn) {
      this.spellView = viewBtn.dataset.spellView === 'list' ? 'list' : 'grid';
      this.renderModal();
      return;
    }

    const circleBtn = ev.target.closest('[data-spell-circle]');
    if (circleBtn) {
      this.spellCircle = circleBtn.dataset.spellCircle || 'all';
      this.renderModal();
      return;
    }

    const castBtn = ev.target.closest('[data-cast-spell]');
    if (castBtn) {
      this.world.castSpell(Number(castBtn.dataset.castSpell));
      this.closeModal();
      this.sync(true);
      return;
    }

    const selSpellBtn = ev.target.closest('[data-select-spell]');
    if (selSpellBtn) {
      const sid = Number(selSpellBtn.dataset.selectSpell);
      if (this.spellView === 'grid' && this.selectedSpellId === sid) {
        this.world.castSpell(sid);
        this.closeModal();
        this.sync(true);
        return;
      }
      this.selectedSpellId = sid;
      this.renderModal();
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
        this.renderModal();
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
      } else if (act === 'inn-rest') {
        this.world.restAtInn(this.npcSession.npc);
      } else if (act === 'deposit' || act === 'deposit-pledge') {
        this.npcSession.mode = 'deposit';
      } else if (act === 'retrieve' || act === 'retrieve-pledge') {
        this.npcSession.mode = 'withdraw';
      } else if (act === 'bless') {
        const p = this.world.player;
        const now = performance.now();
        p.hp = p.maxHp;
        p.mp = p.maxMp;
        this.world.curePoison();
        p.buffs.haste = now + 300000;
        p.buffs.shield = now + 600000;
        this.world.recomputePlayerStats();
        this.world.spawnEffect(p.tx, p.ty, '751');
        this.world.addLog('獲得祝福師的完全恢復與加速保護祝福！', 'gold');
      } else if (act === 'gerengtest' && this.npcSession.npc.name === '吉倫') {
        this.npcSession.mode = 'teach';
      } else if (act === 'fix') {
        this.world.repairWeapons();
      } else if (act === 'statue-pray') {
        this.world.prayAtStatue(this.npcSession.npc);
      } else if (act === 'teleportURL') {
        this.npcSession.mode = 'teleport';
      } else if (act.startsWith('teleport ')) {
        const tpKey = act.slice(9).trim();
        const dest = TELEPORT_ACTIONS[tpKey];
        if (dest) {
          if (this.world.player.gold < dest.price) {
            this.world.addLog(`金幣不足 ${dest.price}，無法傳送前往 ${dest.label}。`, 'warn');
          } else {
            this.world.player.gold -= dest.price;
            this.world.teleportTo(dest.map, dest.x, dest.y, 4);
            this.world.addLog(`傳送前往 ${dest.label}。`, 'cyan');
            this.closeModal();
            this.sync(true);
            return;
          }
        } else {
          this.npcSession.mode = 'teleport';
        }
      } else if (act === 'entership') {
        this.npcSession.mode = 'harbor';
      } else if (act === 'deposit-elven') {
        this.npcSession.mode = 'deposit';
      } else if (act === 'retrieve-elven') {
        this.npcSession.mode = 'withdraw';
      } else if (act === 'buyspell' || act === 'skillspell') {
        this.npcSession.mode = 'teach';
      } else if (act === 'cancel' || act === 'close') {
        this.closeModal();
        return;
      } else if (act.startsWith('request ') && this.npcSession.npc.type === 'Craft') {
        this.npcSession.mode = 'craft';
      } else {
        const alt = this.#findDialogueHtml(act);
        if (alt) this.npcSession.dialogueKey = act;
        else this.world.addLog(`${this.npcSession.npc.name}：功能準備就緒。`, 'info');
      }
      this.renderModal();
      this.sync(true);
      return;
    }

    const craftBtn = ev.target.closest('[data-craft-idx]');
    if (craftBtn && this.npcSession) {
      this.world.craftItem(Number(craftBtn.dataset.craftIdx));
      this.renderModal();
      this.sync(true);
      return;
    }

    const learnBtn = ev.target.closest('[data-learn-spell]');
    if (learnBtn && this.npcSession) {
      this.world.learnSpellFromTeacher(Number(learnBtn.dataset.learnSpell), this.npcSession.npc.name);
      this.renderModal();
      this.sync(true);
      return;
    }

    const petAdoptBtn = ev.target.closest('[data-pet-adopt]');
    if (petAdoptBtn && this.npcSession) {
      this.world.adoptPet(petAdoptBtn.dataset.petAdopt);
      this.renderModal();
      this.sync(true);
      return;
    }

    if (ev.target.closest('[data-pet-heal]') && this.npcSession) {
      this.world.healPet();
      this.renderModal();
      this.sync(true);
      return;
    }

    if (ev.target.closest('[data-pet-dismiss]') && this.npcSession) {
      this.world.dismissPet();
      this.renderModal();
      this.sync(true);
      return;
    }

    if (ev.target.closest('[data-clan-create]') && this.npcSession) {
      const inp = this.elements.modalLayer.querySelector('#ll-clan-input');
      this.world.createOrJoinClan(inp?.value || '');
      this.renderModal();
      this.sync(true);
      return;
    }

    if (ev.target.closest('[data-clan-leave]') && this.npcSession) {
      this.world.leaveClan();
      this.renderModal();
      this.sync(true);
      return;
    }

    const harborBtn = ev.target.closest('[data-harbor-idx]');
    if (harborBtn && this.npcSession) {
      const harborRoutes = this.#resolveHarborDestinations();
      const dest = harborRoutes[Number(harborBtn.dataset.harborIdx)];
      if (dest) {
        if (this.world.player.gold < dest.price) {
          this.world.addLog(`船資不足 ${dest.price} 金幣，無法登船。`, 'warn');
        } else {
          this.world.player.gold -= dest.price;
          this.world.teleportTo(dest.map, dest.x, dest.y, 4);
          this.world.addLog(`搭乘渡船抵達 ${dest.label}。`, 'cyan');
          this.closeModal();
        }
        this.sync(true);
      }
      return;
    }

    const npcMode = ev.target.closest('[data-npc-mode]');
    if (npcMode && this.npcSession) {
      this.npcSession.mode = npcMode.dataset.npcMode;
      this.renderModal();
      return;
    }

    const stepBtn = ev.target.closest('[data-shop-step]');
    if (stepBtn && this.npcSession) {
      const [idxStr, deltaStr] = stepBtn.dataset.shopStep.split(':');
      const idx = Number(idxStr);
      const delta = Number(deltaStr);
      const entries = this.#resolveNpcShopList(this.npcSession.npc);
      const entry = entries[idx];
      const cur = this.#getShopQty(idx);
      const next = cur === 1 && delta === 10 ? 10 : cur + delta;
      this.#setShopQtyDom(idx, entry, next);
      return;
    }

    const buyBtn = ev.target.closest('[data-shop-buy]');
    if (buyBtn && this.npcSession) {
      const parts = buyBtn.dataset.shopBuy.split(':');
      const idx = Number(parts[0]);
      const explicitQty = parts.length > 1 ? Number(parts[1]) : null;
      this.#buyShopRow(idx, explicitQty);
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
      const tpRoutes = this.#resolveTeleportDestinations(this.npcSession?.npc);
      const dest = tpRoutes[Number(tpBtn.dataset.tpIdx)];
      if (dest) {
        if (this.world.player.gold < dest.price) {
          this.world.addLog(`金幣不足 ${dest.price}，無法傳送。`, 'warn');
        } else {
          this.world.player.gold -= dest.price;
          this.world.teleportTo(dest.map, dest.x, dest.y, 4);
          this.world.addLog(`傳送前往 ${dest.label}。`, 'cyan');
          this.closeModal();
        }
        this.sync(true);
      }
      return;
    }

    const worldWarpBtn = ev.target.closest('[data-world-warp]');
    if (worldWarpBtn) {
      const dest = WORLD_EXPEDITION_ROUTES[Number(worldWarpBtn.dataset.worldWarp)];
      if (dest) {
        if (this.world.player.gold < dest.price) {
          this.world.addLog(`金幣不足 ${dest.price}，無法啟程前往 ${dest.label}。`, 'warn');
        } else {
          this.world.player.gold -= dest.price;
          this.world.teleportTo(dest.map, dest.x, dest.y, 4);
          this.world.addLog(`世界傳送抵達 [${dest.group}] ${dest.label}。`, 'cyan');
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
        const p = this.world.player;
        const homeTown = resolveHomeTown(p.map, p.tx, p.ty);
        this.world.teleportTo(homeTown.map, homeTown.x, homeTown.y, 4);
        this.world.addLog(`緊急脫離卡點，已傳回 ${homeTown.label}。`, 'info');
        this.closeModal();
        this.sync(true);
      } else if (act === 'lobby') {
        this.world.dirtySave = true;
        this.world.saveWorld(true);
        this.onReturnToSelect?.();
      }
    }
  }

  #handleModalInput(ev) {
    const qtyInput = ev.target.closest('[data-shop-qty]');
    if (qtyInput && this.npcSession) {
      const idx = Number(qtyInput.dataset.shopQty);
      const entries = this.#resolveNpcShopList(this.npcSession.npc);
      const entry = entries[idx];
      const raw = qtyInput.value.trim();
      if (!raw) return;
      const parsed = Math.max(1, Math.min(9999, Math.floor(Number(raw) || 1)));
      this.npcShopQty[idx] = parsed;
      this.#refreshShopTotalDom(idx, entry, parsed);
      return;
    }

    const rng = ev.target.closest('[data-auto-range]');
    if (!rng) return;
    const key = rng.dataset.autoRange;
    this.world.player.autoConfig[key] = Number(rng.value);
    this.world.dirtySave = true;
    this.renderModal();
  }

  #handleModalChange(ev) {
    const qtyInput = ev.target.closest('[data-shop-qty]');
    if (!qtyInput || !this.npcSession) return;
    const idx = Number(qtyInput.dataset.shopQty);
    const entries = this.#resolveNpcShopList(this.npcSession.npc);
    this.#setShopQtyDom(idx, entries[idx], qtyInput.value || 1);
  }

  sync(force = false) {
    const p = this.world.player;
    const now = performance.now();
    const buffs = this.world.getBuffList(now);
    const buffSig = buffs.map((b) => `${b.key}:${b.remainSec}`).join(',');
    const targetMob = p.targetId ? this.world.mobs.find((m) => m.id === p.targetId && m.hp > 0) : null;
    const lastLog = this.world.logs[this.world.logs.length - 1];
    const logSig = `${this.world.logs.length}|${lastLog?.time || ''}|${lastLog?.text || ''}`;
    const spellById = (id) => (this.world.worldData.spells || []).find((s) => s.id === id);
    const spellIcon = (id) => this.world.assets.spellIconUrl(spellById(id));
    const itemIcon = (name) => this.world.assets.itemIconUrl(this.world.worldData.items[name]?.icon);
    const buffIconByKey = {
      haste: itemIcon('綠色藥水'),
      brave: itemIcon('勇敢藥水'),
      bluePotion: itemIcon('藍色藥水'),
      wisdom: itemIcon('慎重藥水'),
      poly: itemIcon('變形卷軸'),
      shield: assetUrl('/lineage163/ui-redraw-v9/617.png'),
      blessedArmor: assetUrl('/lineage163/ui-redraw-v9/617.png'),
      holyWeapon: spellIcon(48),
      strUp: spellIcon(42),
      dexUp: spellIcon(26),
      heavy: spellIcon(14),
      mrUp: spellIcon(31),
      meditation: spellIcon(32),
      resurrect: itemIcon('復活卷軸'),
      hungry: itemIcon('肉'),
      poison: itemIcon('翡翠藥水'),
    };
    const redPotCount = p.inventory
      .filter((i) => ['紅色藥水', '橙色藥水', '白色藥水'].includes(i.name))
      .reduce((acc, i) => acc + i.count, 0);

    const pSig = [
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
      p.sp,
      p.mr,
      p.food,
      p.clanName,
      p.polyName,
      this.world.onlineCount,
      this.world.remotePeers.length,
      p.kills,
      redPotCount,
      p.weightPercent,
      p.autoConfig.enabled ? 1 : 0,
      buffSig,
      targetMob ? `${targetMob.id}:${targetMob.hp}` : 'none',
      this.chatTab,
      logSig,
    ].join('|');

    if (!force && pSig === this.lastRenderKey) return;
    this.lastRenderKey = pSig;

    const el = this.elements;
    el.mapName.textContent = MAP_NAMES[p.map] || `地圖 ${p.map}`;
    el.coords.textContent = `${p.tx}, ${p.ty}`;

    const inSafetyZone = isSafetyZone(p.map, p.tx, p.ty, this.world.isoMap);
    if (el.zoneBadge) {
      el.zoneBadge.textContent = inSafetyZone ? '安全區域' : '一般區域';
      el.zoneBadge.className = `ll-zone-badge ${inSafetyZone ? 'safety' : 'combat'}`;
    }

    if (targetMob) {
      el.targetPill.hidden = false;
      el.targetName.textContent = `${targetMob.name} (Lv.${targetMob.level})`;
      el.targetFill.style.width = `${Math.max(0, Math.min(100, (targetMob.hp / Math.max(1, targetMob.maxHp)) * 100))}%`;
    } else {
      el.targetPill.hidden = true;
    }

    if (el.buffStrip) {
      const items = buffs.map(
        (b) => `
          <div class="ll-buff-badge ${b.isDebuff ? 'debuff' : ''}" title="${esc(b.label)}${b.remainSec > 0 ? ` 剩餘 ${b.remainSec} 秒` : ''}">
            ${buffIconByKey[b.key] ? `<img src="${esc(buffIconByKey[b.key])}" alt="" />` : ''}
            <span>${b.remainSec > 0 ? `${b.isDebuff ? `${esc(b.label)} ` : ''}${b.remainSec}s` : esc(b.label)}</span>
          </div>
        `,
      );
      if (p.autoConfig.enabled) {
        items.unshift(
          `<div class="ll-buff-badge auto" title="自動狩獵啟用中"><span>內掛ON</span></div>`,
        );
      }
      el.buffStrip.innerHTML = items.join('');
    }

    if (el.questSummary) {
      const kills = p.kills || 0;
      const q1 = p.quests?.hunterDone ? '<span class="done">完成</span>' : `${Math.min(5, kills)}/5`;
      const q2 = p.quests?.slayerDone ? '<span class="done">完成</span>' : `${Math.min(20, kills)}/20`;
      el.questSummary.innerHTML = `
        <div class="ll-quest-row"><span>初階討伐</span><span>${q1}</span></div>
        <div class="ll-quest-row"><span>巡守獵人</span><span>${q2}</span></div>
      `;
    }

    const radarSig = `${p.map}:${p.tx}:${p.ty}:${this.world.mobs.filter((m) => m.hp > 0).length}:${this.world.remotePeers.length}:${p.pet ? `${p.pet.tx}:${p.pet.ty}` : ''}`;
    if (force || radarSig !== this.lastRadarSig) {
      this.lastRadarSig = radarSig;
      this.#paintRadarCanvas(el.radarCanvas, 65, { step: 2, walkColor: '#364a5e' });
    }

    el.hudAutoBtn?.classList.toggle('active', Boolean(p.autoConfig.enabled));
    if (el.autoLabel) el.autoLabel.textContent = p.autoConfig.enabled ? '狩獵中' : '內掛';

    const clsLabel = p.className || CLASS_LABELS[p.classId] || '勇者';
    if (el.charLevel) el.charLevel.textContent = String(p.level);
    el.charTitle.textContent = p.clanName ? `《${p.clanName}》${p.name}` : p.name;
    el.charTitle.title = `${p.name} · ${clsLabel}${p.clanName ? ` · 血盟：${p.clanName}` : ''}`;
    el.lawful.textContent = p.lawful >= 500 ? `守護 ${p.lawful}` : p.lawful < 0 ? `邪惡 ${p.lawful}` : `中立 ${p.lawful}`;

    const hpPct = Math.max(0, Math.min(100, (p.hp / Math.max(1, p.maxHp)) * 100));
    const mpPct = Math.max(0, Math.min(100, (p.mp / Math.max(1, p.maxMp)) * 100));
    const expSpan = Math.max(1, p.expNext - p.expPrev);
    const expPct = Math.max(0, Math.min(99.99, ((p.exp - p.expPrev) / expSpan) * 100));

    el.hpFill.style.width = `${hpPct}%`;
    el.hpText.textContent = `${p.hp} / ${p.maxHp}`;
    el.mpFill.style.width = `${mpPct}%`;
    el.mpText.textContent = `${p.mp} / ${p.maxMp}`;
    if (el.potCount) el.potCount.textContent = String(redPotCount);
    el.expFill.style.width = `${expPct}%`;
    el.expText.textContent = `${expPct.toFixed(2)}%`;

    el.statChips.innerHTML = [
      `<span class="ll-chip">🛡 AC ${p.ac}</span>`,
      `<span class="ll-chip">✨ MR ${p.mr}%</span>`,
      `<span class="ll-chip">🔮 SP ${p.sp || 1}</span>`,
      `<span class="ll-chip">🍖 ${p.food ?? 84}%</span>`,
      `<span class="ll-chip">⚖ ${p.weightPercent}%</span>`,
      `<span class="ll-chip gold">🪙 ${p.gold.toLocaleString()}</span>`,
    ].join('');

    const curLogSig = `${this.chatTab}|${logSig}`;
    if (force || curLogSig !== this.lastLogSig) {
      this.lastLogSig = curLogSig;
      const filteredLogs = this.world.logs.filter((l) => {
        if (this.chatTab === 'combat') return l.tone === 'info' || l.tone === 'warn' || l.tone === 'danger' || l.tone === 'gold';
        if (this.chatTab === 'chat') return l.tone === 'chat' || l.tone === 'cyan';
        return true;
      });
      const tailLogs = filteredLogs.slice(-24);
      el.logBox.innerHTML = tailLogs
        .map(
          (l) => `<div class="ll-log-line ${esc(l.tone)}"><span class="ll-log-time">[${esc(l.time)}]</span>${esc(l.text)}</div>`,
        )
        .join('');
      el.logBox.scrollTop = el.logBox.scrollHeight;
    }

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
