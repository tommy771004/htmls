// 由 NPC 打開的面板：初始夥伴、商店、收納石。

import { ITEM_MAX, itemCount, purchase } from '../core/inventory';
import { displayName } from '../core/monster';
import { deposit, depositCheck, withdraw, withdrawCheck } from '../core/party';
import { ELEMENT_NAME } from '../data/elements';
import { getItem, SHOP_STOCK } from '../data/items';
import { getSpecies, STARTERS } from '../data/species';
import { STARTER_CAGES, STARTER_LEVEL } from './constants';
import type { GameApp } from './game';
import { monRow } from './menus';
import { Panel } from './panel';

// ---------- 初始夥伴 ----------

const STARTER_BLURB: Record<string, string> = {
  wickling: '速度快、攻擊高。火花和熱身讓它一開始就很能打。',
  bubblet: '防禦穩、會先制招式疾流，之後能學會讓對手睡著的眠泡。',
  mossum: 'HP 與防禦最高，能吸取養分回復，適合穩紮穩打。',
};

export function buildStarterPanel(app: GameApp): Panel {
  const panel: Panel = new Panel({
    kind: 'starter',
    layout: 'starter',
    title: '選擇你的第一個夥伴',
    rows: () =>
      STARTERS.map((id) => {
        const s = getSpecies(id);
        return { label: s.name, right: `${ELEMENT_NAME[s.type]}屬性`, icon: s.sprite.front };
      }),
    detail: (i) => {
      const s = getSpecies(STARTERS[i]);
      return { title: `${s.name}・${ELEMENT_NAME[s.type]}屬性`, sprite: s.sprite.front, lines: [STARTER_BLURB[s.id], s.dex] };
    },
    hint: '焰剋苔、苔剋潮、潮剋焰。左右或上下選擇，確認決定。',
    onSide: (d) => {
      panel.cursor = (panel.cursor + d + STARTERS.length) % STARTERS.length;
    },
    onConfirm: (i) => {
      const s = getSpecies(STARTERS[i]);
      app.sfx('confirm');
      app.ask([{ speaker: '禾老師', text: `就選${s.name}嗎？` }], {
        options: [`就決定是${s.name}`, '再想想'],
        cancelIndex: 1,
        onPick: (k) => {
          if (k !== 0 || app.p.flags.gotStarter) return;
          const { mon } = app.giveMonster(s.id, STARTER_LEVEL);
          app.giveItem('cage', STARTER_CAGES);
          app.p.flags.gotStarter = true;
          app.closePanel(panel);
          app.sfx('pickup');
          app.autosave();
          app.say([
            `${displayName(mon)}成為你的夥伴了！`,
            { speaker: '禾老師', text: `還有這 ${STARTER_CAGES} 個晶籠，是用來捕捉野生野靈的。` },
            { speaker: '禾老師', text: '村子北邊出口通往風草道。走進高草叢，野生野靈就會跳出來。' },
            { speaker: '禾老師', text: '戰鬥時選「招式」攻擊。對手的 HP 變黃、變紅之後，再從「背包」丟晶籠，比較容易成功。' },
            { speaker: '禾老師', text: '夥伴累了就回村子找蘇護士；阿良的攤位也能補貨。去吧！' },
          ]);
        },
      });
    },
    onCancel: () => {
      app.closePanel(panel);
      app.say([{ speaker: '禾老師', text: '慢慢想，想好了再來找我。' }]);
    },
  });
  return panel;
}

// ---------- 商店 ----------

export function buildShopPanel(app: GameApp): Panel {
  const panel: Panel = new Panel({
    kind: 'shop',
    title: () => `阿良的攤位　持有 ${app.p.money} 銅貝`,
    rows: () =>
      SHOP_STOCK.map((id) => {
        const item = getItem(id);
        return { label: item.name, right: `${item.price} 銅貝`, sub: `持有 ${itemCount(app.p.bag, id)}`, icon: item.sprite };
      }),
    detail: (i) => {
      const item = getItem(SHOP_STOCK[i]);
      return { title: item.name, sprite: item.sprite, lines: [item.desc] };
    },
    onConfirm: (i) => {
      const id = SHOP_STOCK[i];
      if (itemCount(app.p.bag, id) >= ITEM_MAX) {
        app.sfx('error');
        app.say([{ speaker: '阿良', text: `你的${getItem(id).name}已經放不下了。` }]);
        return;
      }
      app.sfx('confirm');
      app.openPanel(buildQtyPanel(app, id));
    },
    onCancel: () => {
      app.closePanel(panel);
      app.say([{ speaker: '阿良', text: '謝謝光臨，路上小心！' }]);
    },
  });
  return panel;
}

export function buildQtyPanel(app: GameApp, itemId: string): Panel {
  const item = getItem(itemId);
  let qty = 1;
  const max = () => Math.max(1, ITEM_MAX - itemCount(app.p.bag, itemId));
  const set = (n: number) => {
    qty = Math.max(1, Math.min(max(), n));
  };
  const panel: Panel = new Panel({
    kind: 'qty',
    title: `要買幾個${item.name}？`,
    rows: () => [],
    qty: () => ({ value: qty, max: max(), price: item.price, total: qty * item.price, balance: app.p.money }),
    hint: '上下 ±1、左右 ±10，確認購買。',
    // 上下鍵在沒有列的面板上不會動游標，因此改用 onSide 處理 ±10，up/down 由 press 攔截。
    onSide: (d) => set(qty + d * 10),
    onConfirm: () => {
      const total = qty * item.price;
      const n = qty;
      app.ask([{ speaker: '阿良', text: `${item.name} ×${n}，一共 ${total} 銅貝。要買嗎？` }], {
        options: ['購買', '不買了'],
        cancelIndex: 1,
        onPick: (k) => {
          if (k !== 0) return;
          const result = purchase(app.p, itemId, n);
          if (!result.ok) {
            app.sfx('error');
            app.say([{ speaker: '阿良', text: result.reason }]);
            return;
          }
          app.closePanel(panel);
          app.sfx('buy');
          app.autosave();
          app.say([{ speaker: '阿良', text: `好的，${item.name} ×${n}！謝謝惠顧。` }]);
        },
      });
    },
    onCancel: () => app.closePanel(panel),
  });
  // 數量面板沒有清單列，上下鍵改成 ±1。
  const press = panel.press.bind(panel);
  panel.press = (button) => {
    if (button === 'up' || button === 'down') {
      set(qty + (button === 'up' ? 1 : -1));
      return 'side';
    }
    return press(button);
  };
  return panel;
}

// ---------- 收納石 ----------

export function buildBoxPanel(app: GameApp): Panel {
  const panel: Panel = new Panel({
    kind: 'box',
    title: '收納石',
    rows: () => [
      { label: '存入怪獸', right: `隊伍 ${app.p.party.length}/6` },
      { label: '取出怪獸', right: `收納箱 ${app.p.box.length}` },
      { label: '離開' },
    ],
    hint: '隊伍最多 6 隻；滿了之後捕捉的怪獸會自動送到這裡。',
    onConfirm: (i) => {
      app.sfx('confirm');
      if (i === 0) app.openPanel(buildDepositPanel(app));
      else if (i === 1) app.openPanel(buildWithdrawPanel(app));
      else {
        app.closePanel(panel);
        app.autosave();
      }
    },
    onCancel: () => {
      app.closePanel(panel);
      app.autosave();
    },
  });
  return panel;
}

function buildDepositPanel(app: GameApp): Panel {
  const panel: Panel = new Panel({
    kind: 'deposit',
    title: '要存入哪一隻？',
    rows: () => app.p.party.map((m) => monRow(m)),
    onConfirm: (i) => {
      const error = depositCheck(app.p, i);
      if (error) {
        app.sfx('error');
        app.say([error]);
        return;
      }
      app.sfx('confirm');
      app.say([deposit(app.p, i)]);
    },
    onCancel: () => app.closePanel(panel),
  });
  return panel;
}

function buildWithdrawPanel(app: GameApp): Panel {
  const panel: Panel = new Panel({
    kind: 'withdraw',
    title: '要取出哪一隻？',
    rows: () => (app.p.box.length === 0 ? [{ label: '收納箱是空的', disabled: true, tone: 'muted' }] : app.p.box.map((m) => monRow(m))),
    onConfirm: (i) => {
      if (app.p.box.length === 0) return;
      const error = withdrawCheck(app.p, i);
      if (error) {
        app.sfx('error');
        app.say([error]);
        return;
      }
      app.sfx('confirm');
      app.say([withdraw(app.p, i)]);
    },
    onCancel: () => app.closePanel(panel),
  });
  return panel;
}
