// 購買頁：七欄（裝備／手槍／衝鋒／重火力／步槍／狙擊／投擲），右側物品說明。先按欄號再按品項號可不碰滑鼠買完。
import { WEAPONS, GEAR, RULES } from '../game/state.js';
import { lockPointer } from '../core/input.js';
import { NEW_GUNS } from '../game/guns/index.js';

export const COLS = [
  { name: '裝備', items: ['armor', 'helmet', 'kit'] },
  { name: '手槍', items: ['p9', 'c7', 'r50'] },
  { name: '衝鋒', items: ['v11', 'm7', 'b90'] },
  { name: '重火力', items: ['s8', 'x10', 'n9'] },
  { name: '步槍', items: ['t4', 'ks', 'ar5'] },
  { name: '狙擊', items: ['s6', 'l40'] },
  { name: '投擲', items: ['frag', 'smoke', 'flash'] },
];
export const SPEC = { armor: '護甲 100', helmet: '護甲 100＋頭盔', kit: '拆除 5 秒' };
export const DESC = {
  armor: '擋下身體與四肢的部分傷害，被打穿前都有效。頭部沒有保護。',
  helmet: '防彈衣加頭盔，爆頭也會被減傷。整場最划算的一千元。',
  kit: '守方專用。拆除時間由 10 秒縮短成 5 秒，攻方買不到。',
  p9: '開局配槍，半自動。子彈便宜，爆頭一樣致命。',
  r50: '七發大口徑。沒穿頭盔的目標一槍爆頭倒地，後座也最重。',
  v11: '射速全場並列最快，擊殺獎金高。適合輸掉一回合後的經濟局。',
  s8: '泵動九顆彈丸，六公尺內穿甲也多半一槍倒。打偏要等將近一秒，十公尺外輸給 X10。',
  ks: '短槍管、高單發傷害，連射會明顯上跳。攻方的主力。',
  ar5: '穩定度最好，遠距離仍能壓住彈道。守方的主力。',
  l40: '開鏡一槍定生死。不開鏡完全打不準，移動也最慢。',
  frag: '落地前可以彈牆，炸傷範圍內所有人，包括隊友。',
  smoke: '封住視線約 15 秒，用來過空地或擋狙擊線。',
  flash: '被閃到的人短暫全白，自己轉頭背對可以避開。',
};
for (const g of NEW_GUNS) DESC[g.id] = g.desc;
let G, el, $ = {}, its = {}, acts, lastSig = '', col = -1, picked = 'ar5';

const stat = (label, val, max, text) => `<dt>${label}</dt><dd class="tr"><b style="width:${Math.min(100, val / max * 100).toFixed(0)}%"></b></dd><dd class="v">${text}</dd>`;
/** 武器的數值列：購買頁與主選單軍械頁共用。 */
export const statRows = w => stat('威力', w.dmg * (w.pellets ?? 1), 180, String(w.pellets ? `${w.dmg}×${w.pellets}` : w.dmg)) + stat('射速', w.rpm, 900, `${w.rpm}/分`) + stat('穿甲', w.pen, 1, `${Math.round(w.pen * 100)}%`) + stat('機動', w.speedK, 1, `${Math.round(w.speedK * 100)}%`) + `<dt>彈藥</dt><dd></dd><dd class="v">${w.mag} / ${w.rsv}</dd>`;
function info(id) {
  picked = id; for (const k in its) its[k].classList.toggle('pick', k === id);
  const w = WEAPONS[id], g = GEAR[id], name = w?.name ?? g.name, price = w?.price ?? g.price;
  $.ii.className = w ? `ic ic-${id}` : ''; $.ii.style.display = w ? '' : 'none';
  $.in.textContent = name; $.ip.textContent = '$' + price; $.id.textContent = DESC[id] ?? '';
  $.is.innerHTML = w?.mag ? statRows(w) : '';
}
function setCol(i) { col = i; $.cols.forEach((c, k) => c.classList.toggle('sel', k === i)); }
function choose(id) { info(id); if (!its[id].classList.contains('own')) acts.buy(id); }

export function initBuy(root, g, actions) {
  G = g; acts = actions; el = document.createElement('div'); el.id = 'buy';
  el.innerHTML = `<header><h2>購買</h2><div class="t">剩餘時間<b></b></div><div class="m"></div><button class="x">關閉</button></header>
  <div class="body"><div class="cols"></div><aside class="info"><i></i><h3></h3><div class="pr"></div><p></p><dl></dl></aside></div>
  <footer><span><b>1–${COLS.length}</b>選欄，再按品項編號購買</span><span><b>滑鼠</b>點一下直接買</span><span><b>B</b>或<b>Esc</b>關閉</span></footer>`;
  el.querySelector('.x').onclick = () => toggleBuy();
  $.t = el.querySelector('.t b'); $.tw = el.querySelector('.t'); $.m = el.querySelector('.m'); $.ii = el.querySelector('.info i'); $.in = el.querySelector('.info h3'); $.ip = el.querySelector('.pr'); $.id = el.querySelector('.info p'); $.is = el.querySelector('.info dl');
  const box = el.querySelector('.cols'); $.cols = [];
  COLS.forEach((c, i) => {
    const d = document.createElement('div'); d.className = 'col'; d.innerHTML = `<h3><s>${i + 1}</s>${c.name}</h3>`; box.appendChild(d); $.cols.push(d);
    c.items.forEach((id, n) => {
      const w = WEAPONS[id], g = GEAR[id], b = document.createElement('button'); b.className = 'it';
      b.innerHTML = `<s>${n + 1}</s>${w ? `<i class="ic ic-${id}"></i>` : `<div class="sp">${SPEC[id]}</div>`}<div class="nm"><span>${w?.name ?? g.name}</span><em></em></div>`;
      b.onclick = () => choose(id); b.onmouseenter = () => info(id); b.onfocus = () => info(id);
      d.appendChild(b); its[id] = b; b.dataset.p = w?.price ?? g.price;
    });
  });
  root.appendChild(el); info(picked);
  // 捕獲階段先攔：購買頁開著時數字鍵是選品項，不切武器。
  addEventListener('keydown', e => {
    if (!G.buyOpen || e.repeat) return;
    if (e.code === 'Escape') { toggleBuy(); return; }
    if (!e.code.startsWith('Digit')) return;
    e.stopImmediatePropagation(); const d = +e.code.slice(5);
    if (col < 0) { if (d >= 1 && d <= COLS.length) setCol(d - 1); return; }
    const id = COLS[col].items[d - 1]; if (id) choose(id); setCol(-1);
  }, true);
}
export function toggleBuy() { G.buyOpen = !G.buyOpen; setCol(-1); if (G.buyOpen) document.exitPointerLock?.(); else if (!matchMedia('(pointer:coarse)').matches) lockPointer(document.getElementById('view')); }

const owned = (m, id) => id === 'armor' ? m.armor >= 100 : id === 'helmet' ? m.armor >= 100 && m.helmet : id === 'kit' ? m.kit || m.team === 0 : WEAPONS[id].nade ? m.nades.includes(id) : m.primary === id || m.secondary === id;
export function frameBuy() {
  if (G.buyOpen && !G.canBuy) G.buyOpen = false;
  const on = G.buyOpen ? 'flex' : 'none'; if (el.style.display !== on) { el.style.display = on; document.body.classList.toggle('buying', G.buyOpen); }
  const m = G.me; if (!m || !G.buyOpen) return;
  const left = Math.max(0, Math.ceil(G.phase === 'buy' ? G.time + 20 : 20 - (RULES.roundTime - G.time))), txt = `0:${String(left).padStart(2, '0')}`;
  if ($.t.textContent !== txt) { $.t.textContent = txt; $.tw.classList.toggle('hot', left <= 5); }
  const sig = `${m.money}|${m.armor}|${m.helmet}|${m.kit}|${m.primary}|${m.secondary}|${m.nades.join()}|${m.team}`;
  if (sig === lastSig) return; lastSig = sig; $.m.textContent = '$' + m.money;
  for (const id in its) {
    const b = its[id], own = owned(m, id), p = +b.dataset.p, no = !own && (p > m.money || !!(WEAPONS[id]?.nade && m.nades.length >= 3));
    b.classList.toggle('own', own); b.classList.toggle('no', no); b.disabled = no;
    b.querySelector('em').textContent = id === 'kit' && m.team === 0 ? '守方限定' : own ? '已裝備' : '$' + p;
  }
}
