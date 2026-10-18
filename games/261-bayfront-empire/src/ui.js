// 介面：頂部資金／日期／評分／帝國等級、遊戲時間與天氣、任務列、底部導覽、商家標籤、收入飄字、各種面板。
import { BIZ, BIZ_BY_ID, WEATHER, EVENTS, QUESTS, PORT, CARGO, CARGO_IDS, TIERS, PROMO, LIFT, SWAP_COST, APT, LANDMARKS, LANDMARK_BY_ID, RIVAL } from './data.js';
import { nextCost, capOf, todayRevenue, todayCosts, empireLevel, questProgress, isOpen, priceOf } from './econ.js';
import {
  seasonOf, seasonDay, promoLeft, promoCost, stackMult, liftLv, liftCost, floorOrder, APTS, APT_BY_KEY, aptLv, aptNextCost, aptRent,
  popLevels, rentPerDay, hasMark, rivalMult, rivalBuyCost, dailyProgress, dailyText, ACHIEVEMENTS,
} from './empire.js';
import { portNextCost, winChance, shipStatus, absMin, truckCap, inbound } from './port.js';
import { LEVEL_AT, ITEMS, ITEM_BY_ID, GEAR, CIVIC, FLAGS, BOOKABLE, DEAL, BAG_MAX } from './data.js';
import { itemPrice, itemListPrice, bagCount, bagTotal, canBuyItem, buffOf, itemTargets, useGate, useBlock, gearFits, hasGear, gearCost, hasCivic, hasPermit, ownsFlag } from './items.js';
import { NPCS, NPC_BY_ID, npcStatus, npcStep, npcProgress, npcState, landmarkCost, chalText, chalProgress, weeklyProgress, weeklyText, weekOf, SHOTS, FOLLOWS, CHAL } from './story.js';
import { icon } from './icons.js';
import { stackOf, floorOf, CITY_LOTS } from './layout.js';

export const money = (v, full = false) => {
  const s = v < 0 ? '-' : '';
  v = Math.abs(v);
  if (full || v < 10000) return `${s}$${Math.round(v).toLocaleString('en-US')}`;
  if (v < 1e6) return `${s}$${(v / 1e3).toFixed(v < 1e5 ? 1 : 0)}K`;
  return `${s}$${(v / 1e6).toFixed(v < 1e8 ? 2 : 1)}M`;
};
const hhmm = (m) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(Math.floor(m % 60)).padStart(2, '0')}`;
const pct = (v) => `${Math.round(v * 100)}%`;
const hrs = (m) => (m >= 60 ? `${Math.floor(m / 60)} 小時${m % 60 >= 1 ? ` ${Math.floor(m % 60)} 分` : ''}` : `${Math.max(1, Math.floor(m))} 分`);
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const KIND = { indoor: '室內 · 雨天反而多', outdoor: '戶外 · 晴天熱浪大增', water: '水上 · 下雨幾乎停擺' };
const ZONE = { city: '海濱大道 · 城市街區', beach: '海灘改版 · 沙灘與碼頭' };

export function weatherIcon(cur, minute) {
  const h = minute / 60;
  if ((h < 6 || h >= 19.5) && (cur === 'sunny' || cur === 'heat' || cur === 'partly')) return 'moon';
  return { sunny: 'sun', partly: 'partly', cloudy: 'cloudy', rain: 'rain', heat: 'heat' }[cur] || 'sun';
}

export function createUI(root, ctx) {
  const $ = (sel) => root.querySelector(sel);
  root.innerHTML = `
  <div class="labels" id="labels"></div>
  <div class="pops" id="pops"></div>
  <header class="hud">
    <div class="card funds">
      <span class="coin">${icon('money', 22)}</span>
      <div class="fundtxt"><small>可用資金</small><b id="money">$0</b><i id="trend"></i></div>
      <span class="chip day" id="day">第 1 天</span>
      <span class="ring" id="rating" title="顧客評分"><svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="15" class="trk"/><circle cx="18" cy="18" r="15" class="val" id="ratingArc"/></svg><b id="ratingNum">74</b></span>
      <span class="lvl" id="lvl" title="帝國等級">${icon('crown', 13)}<b>1</b></span>
    </div>
    <div class="card clock">
      <div><small>遊戲時間</small><b id="time">08:30</b></div>
      <span class="wx" id="wx">${icon('sun', 26)}</span>
    </div>
  </header>
  <div class="row2">
    <button class="pill btn-quests" id="btnQuests">${icon('quest', 18)}<span>任務</span><em id="qBadge"></em></button>
    <button class="pill btn-bag" id="btnBag">${icon('bag', 18)}<span>道具</span><em id="bagBadge"></em></button>
    <div class="chips"><button class="chip chal" id="chalChip" hidden></button><span class="chip ev" id="event" hidden></span><span class="chip inc" id="lastInc" hidden></span><button class="chip follow" id="follow" hidden></button></div>
  </div>
  <aside class="tools">
    <button class="sq" id="btnSettings" title="設定">${icon('gear')}</button>
    <button class="sq" id="btnOverview" title="全景">${icon('map')}</button>
    <button class="sq" id="btnZoomIn" title="放大">${icon('plus')}</button>
    <button class="sq" id="btnZoomOut" title="縮小">${icon('minus')}</button>
    <button class="sq" id="btnFollow" title="跟拍一位客人">${icon('eye')}</button>
    <button class="sq" id="btnPhoto" title="照片模式">${icon('camera')}</button>
    <div class="speed" id="speed">
      <button data-s="0" title="暫停">${icon('pause', 16)}</button><button data-s="1">1×</button><button data-s="2">2×</button><button data-s="4">4×</button>
    </div>
    <div class="fps" id="fps"><b>60</b><small>FPS</small><i><u></u><u></u><u></u><u></u><u></u><u></u></i></div>
  </aside>
  <section class="questbar card" id="questbar">
    <div class="qhead"><small id="qch">CHAPTER 1 · 街角起家</small><span id="qcount">0/11</span></div>
    <div class="qprog"><i id="qprog"></i></div>
    <button class="qnext" id="qnext"><span class="qic">${icon('star', 20)}</span><span class="qtxt"><small>下一步</small><b id="qtitle">開第一家店</b><em id="qhint"></em></span><span class="qval" id="qval"></span>${icon('arrow', 18)}</button>
  </section>
  <nav class="nav card">
    <button data-p="manage">${icon('manage')}<span>經營</span></button>
    <button data-p="shop">${icon('shop')}<span>商店</span><em id="shopBadge"></em></button>
    <button data-p="finance">${icon('finance')}<span>財務</span></button>
    <button data-p="port">${icon('anchor')}<span>物流</span><em id="portBadge"></em></button>
    <button data-p="alerts">${icon('bell')}<span>通知</span><em id="alertBadge"></em></button>
  </nav>
  <div class="toasts" id="toasts"></div>
  <div class="photobar card" id="photobar">
    <label class="ptime">${icon('clock', 16)}<input type="range" min="0" max="23.9" step="0.1" id="phTime" aria-label="時間"><b id="phTimeV">12:00</b></label>
    <div class="seg" id="phWx">${['sunny', 'partly', 'cloudy', 'rain', 'heat'].map((w) => `<button data-phw="${w}" title="${WEATHER[w].name}">${icon(w === 'sunny' ? 'sun' : w, 16)}</button>`).join('')}</div>
    <div class="phact">
      <button class="mini" data-ph="lapse">${icon('film', 14)} <span>24 小時縮時</span></button>
      <button class="mini" data-ph="rec">${icon('record', 14)} <span>錄影</span></button>
      <button class="mini" data-ph="snap">${icon('camera', 14)} <span>截圖</span></button>
      <button class="mini warn" data-ph="exit">${icon('close', 14)} <span>離開</span></button>
    </div>
  </div>
  <div class="sheet" id="sheet" hidden><div class="grab"></div><button class="x" id="sheetX" aria-label="關閉">${icon('close', 18)}</button><div class="body" id="sheetBody"></div></div>
  <div class="modal" id="modal" hidden></div>
  `;

  const st = () => ctx.state();
  const labels = {};
  const alerts = [];
  let unread = 0;
  let open = null;
  let lastMoney = null, shownMoney = 0, trendT = 0;

  // ── 商家標籤 ──
  for (const b of BIZ) {
    const el = document.createElement('button');
    el.className = 'lbl';
    el.style.setProperty('--c', b.color);
    el.addEventListener('click', (e) => { e.stopPropagation(); openBiz(b.id); });
    $('#labels').appendChild(el);
    labels[b.id] = { el, key: '' };
  }
  const portLbl = document.createElement('button');
  portLbl.className = 'lbl port';
  portLbl.style.setProperty('--c', PORT.color);
  portLbl.addEventListener('click', (e) => { e.stopPropagation(); openPanel('port', true); });
  $('#labels').appendChild(portLbl);
  let portKey = '';
  const shipEls = [];
  const elevEls = [];
  // 公寓、地標與對手的標籤
  const xLabels = [];
  const mkLabel = (id, color, onClick, cls = '') => {
    const el = document.createElement('button');
    el.className = 'lbl ' + cls;
    el.style.setProperty('--c', color);
    el.addEventListener('click', (e) => { e.stopPropagation(); onClick(); });
    $('#labels').appendChild(el);
    const L = { id, el, key: '' };
    xLabels.push(L);
    return L;
  };
  for (const a of APTS) mkLabel('apt:' + a.key, '#2d5a45', () => openApt(a.key));
  for (const m of LANDMARKS) mkLabel('mark:' + m.id, m.color, () => openMark(m.id));
  mkLabel('rival', '#2a2f3a', () => openRival(), 'rv');
  function portLabelHTML() {
    const s = st(), lv = s.port.lv;
    if (!lv) return `<span class="li sale">${icon('anchor', 14)}</span><span>${PORT.name}</span><b class="price">${money(PORT.cost)}</b>`;
    return `<span class="li">${icon('anchor', 14)}</span><span>${PORT.name}</span><b class="lv">Lv${lv}</b>`;
  }
  function labelHTML(id) {
    const s = st(), b = BIZ_BY_ID[id], lv = s.biz[id].lv;
    // 同一棟疊樓的店家標上樓層
    const fl = b.zone === 'city' && stackOf(id).floors > 1 ? `F${floorOf(id)} · ` : '';
    if (!lv) return `<span class="li sale">${icon(b.icon, 14)}</span><span>${fl}${esc(b.name)}</span><b class="price">${money(b.cost)}</b>`;
    const shut = !isOpen(b, s.minute);
    return `<span class="li">${icon(b.icon, 14)}</span><span>${fl}${esc(b.name)}</span><b class="lv${shut ? ' shut' : ''}">${shut ? '打烊' : 'Lv' + lv}</b>`;
  }

  function xLabelState(id) {
    const s = st();
    const shopping = open === 'shop';
    if (id.startsWith('apt:')) {
      const key = id.slice(4), lv = aptLv(s, key), a = APT_BY_KEY[key];
      const show = lv || (shopping && shopTab === 'estate') || open === id;
      return { show, html: lv ? `<span class="li">${icon('home', 14)}</span><span>${esc(a.name)}</span><b class="lv">Lv${lv}</b>` : `<span class="li sale">${icon('home', 14)}</span><span>${esc(a.name)}</span><b class="price">${money(a.cost)}</b>`, sale: !lv };
    }
    if (id.startsWith('mark:')) {
      const m = LANDMARK_BY_ID[id.slice(5)], on = hasMark(s, m.id);
      const show = on || (shopping && shopTab === 'marks') || open === id;
      return { show, html: on ? `<span class="li">${icon(m.icon, 14)}</span><span>${esc(m.name)}</span>` : `<span class="li sale">${icon(m.icon, 14)}</span><span>${esc(m.name)}</span><b class="price">${money(landmarkCost(s, m))}</b>`, sale: !on };
    }
    const r = s.rival;
    return { show: !!r, html: r ? `<span class="li">${icon('rival', 14)}</span><span>對手 · ${esc(r.name)}</span><b class="neg">−${Math.round((1 - rivalMult(s, r.id)) * 100)}%</b>` : '', sale: false };
  }

  // ── 飄字 ──
  const pops = [];
  function pop(text, x, y, z, cls) {
    if (pops.length > 26) { const o = pops.shift(); o.el.remove(); }
    const el = document.createElement('div');
    el.className = 'pop ' + cls;
    el.textContent = text;
    $('#pops').appendChild(el);
    pops.push({ el, x, y, z, t: 0, life: cls === 'full' ? 1.4 : 1.8 });
  }

  // ── 通知 ──
  function toast(msg, ic = 'info', tone = '') {
    const el = document.createElement('div');
    el.className = 'toast ' + tone;
    el.innerHTML = `${icon(ic, 18)}<span>${esc(msg)}</span>`;
    $('#toasts').prepend(el);
    while ($('#toasts').children.length > 3) $('#toasts').lastChild.remove();
    setTimeout(() => el.classList.add('out'), 3800);
    setTimeout(() => el.remove(), 4300);
    const s = st();
    alerts.unshift({ msg, ic, when: `第 ${s.day} 天 ${hhmm(s.minute)}` });
    if (alerts.length > 60) alerts.pop();
    if (open !== 'alerts') unread++;
  }

  // ── 面板 ──
  let lastHTML = '', pressing = false;
  $('#sheet').addEventListener('pointerdown', () => { pressing = true; });
  addEventListener('pointerup', () => setTimeout(() => { pressing = false; }, 60));
  addEventListener('pointercancel', () => { pressing = false; });
  function show(kind, html) {
    open = kind;
    if (html !== lastHTML || $('#sheet').hidden) { $('#sheetBody').innerHTML = html; lastHTML = html; }
    $('#sheet').hidden = false;
    root.classList.add('sheet-open');
    root.querySelectorAll('.nav button').forEach((b) => b.classList.toggle('on', b.dataset.p === kind));
  }
  function close() {
    open = null;
    $('#sheet').hidden = true;
    root.classList.remove('sheet-open');
    root.querySelectorAll('.nav button').forEach((b) => b.classList.remove('on'));
    ctx.actions.select(null);
  }
  function bizStats(id) {
    const s = st(), b = BIZ_BY_ID[id], lv = s.biz[id].lv;
    const L = Math.max(1, lv);
    return `<div class="grid">
      <div><small>客單價</small><b>${money(lv ? priceOf(s, id) : b.price[L - 1], true)}${lv && s.biz[id].tier ? ` <em>${TIERS[s.biz[id].tier].name}</em>` : ''}</b></div>
      <div><small>容量</small><b>${b.cap[L - 1]} ${id === 'boat' || id === 'jetski' ? '艘' : id === 'umbrella' ? '傘位' : '人'}</b></div>
      <div><small>營業時間</small><b>${hhmm(b.open)}–${hhmm(b.close)}</b></div>
      <div><small>工資／日</small><b>${money(b.wage[L - 1])}</b></div>
      ${lv ? `<div><small>今日營收</small><b class="g">${money(s.today.rev[id] || 0, true)}</b></div>
      <div><small>今日來客</small><b>${s.today.visits[id] || 0}${s.today.turned[id] ? ` <em class="r">拒 ${s.today.turned[id]}</em>` : ''}</b></div>
      <div><small>店內人數</small><b>${ctx.occ(id)} / ${b.cap[L - 1]}</b></div>
      <div><small>累計營收</small><b>${money(s.biz[id].earned)}</b></div>` : ''}
    </div>`;
  }
  function buyBtn(id) {
    const s = st(), c = nextCost(s, id), lv = s.biz[id].lv;
    if (c === null) return `<button class="big done" disabled>${icon('check', 18)} 已達最高等級</button>`;
    const ok = s.money >= c;
    return `<button class="big" data-buy="${id}" ${ok ? '' : 'disabled'}>${icon(lv ? 'up' : 'shop', 18)} ${lv ? `升級到 Lv${lv + 1}` : '買下並開業'} · ${money(c, c < 1e6)}</button>${ok ? '' : `<p class="need">還差 ${money(c - s.money)}</p>`}`;
  }
  function nextPreview(id) {
    const s = st(), b = BIZ_BY_ID[id], lv = s.biz[id].lv;
    if (lv === 0 || lv >= 3) return '';
    const extra = { boat: '多兩艘出租船停在棧橋', jetski: '多兩台水上摩托車', umbrella: '沙灘上加開四組傘位', surf: '加大衝浪板架、插旗', snack: '加野餐桌與遮陽傘' }[id] || (lv === 1 ? '外帶座位、A 字立牌與花箱' : '屋頂看板與燈串');
    return `<div class="next"><small>Lv${lv + 1} 之後</small><p>客單價 ${money(b.price[lv - 1], true)} → <b>${money(b.price[lv], true)}</b>　容量 ${b.cap[lv - 1]} → <b>${b.cap[lv]}</b>　吸引力 +${lv === 1 ? 40 : 32}%</p><p class="muted">${extra}</p></div>`;
  }
  // 經營策略：定價三段與促銷
  function strategyHTML(id) {
    const s = st(), lv = s.biz[id].lv;
    if (!lv) return '';
    const t = s.biz[id].tier || 0, left = promoLeft(s, id), pc = promoCost(id), T = TIERS[t];
    const note = t === -1 ? '評分漲得快，也能對抗對手的價格戰' : t === 1 ? '客人少但每位付得多，適合常常客滿的店' : '客單價與來客數都照原本';
    return `<h3>經營策略</h3>
      <div class="set"><span>${icon('tag', 18)} 定價</span><div class="seg">${[-1, 0, 1].map((k) => `<button data-tier="${id}:${k}" class="${t === k ? 'on' : ''}">${TIERS[k].name}</button>`).join('')}</div></div>
      <p class="muted">客單價 ${pct(T.price)}、來客 ${pct(T.arrive)}：${note}。</p>
      <div class="set"><span>${icon('megaphone', 18)} 促銷</span>${left > 0 ? `<b class="g">進行中 · 剩 ${hrs(left)}</b>` : `<button class="mini" data-promo="${id}" ${s.money >= pc ? '' : 'disabled'}>3 小時客流 +${Math.round((PROMO.mult - 1) * 100)}% · ${money(pc)}</button>`}</div>`;
  }
  // 疊樓：各層店家、交換樓層、同棟加成與電梯
  function towerHTML(id) {
    const sk = CITY_LOTS[id] && stackOf(id);
    if (!sk || sk.floors < 2) return '';
    const s = st(), key = sk.key, lv = liftLv(s, key), c = liftCost(s, key);
    const order = floorOrder(s, key), me = order.indexOf(id);
    const bonus = Math.round((stackMult(s, id) - 1) * 100);
    const rows = order.map((k, i) => ({ k, i })).reverse().map(({ k, i }) => {
      const b = BIZ_BY_ID[k], l = s.biz[k].lv;
      return `<div class="frow${k === id ? ' me' : ''}"><span class="fl">F${i + 1}</span><span class="bic" style="--c:${b.color}">${icon(b.icon, 14)}</span><b>${esc(b.name)}</b><small>${l ? `Lv${l}` : '空樓層'}</small>${k === id ? '' : `<button class="mini alt" data-swap="${key}:${id}:${k}" ${s.money >= SWAP_COST ? '' : 'disabled'} title="和${esc(b.name)}交換樓層">${icon('swap', 14)}</button>`}</div>`;
    }).join('');
    return `<h3>同一棟的樓層</h3>
      <div class="floors">${rows}</div>
      <p class="muted">同棟別家每多一級，這家客流 +5%（現在 +${bonus}%）。交換樓層的裝修費 ${money(SWAP_COST)}，店內客人會先請出門。${me > 0 ? '樓上的客人要從一樓搭電梯上來。' : ''}</p>
      <div class="set"><span>${icon('lift', 18)} ${LIFT.name[lv - 1]}</span><small class="lt">${LIFT.cap[lv - 1]} 人 · 每層 ${LIFT.move[lv - 1]} 秒${s.today.liftLost ? ` · <em class="r">今日因排隊流失 ${s.today.liftLost} 人</em>` : ''}</small></div>
      ${c === null ? '<p class="muted">電梯已是最高等級。</p>' : `<button class="big alt" data-lift="${key}" ${s.money >= c ? '' : 'disabled'}>${icon('up', 18)} 升級為${LIFT.name[lv]} · ${money(c)}<small>${LIFT.cap[lv]} 人、每層 ${LIFT.move[lv]} 秒，排隊的客人更少</small></button>`}`;
  }
  function rivalBox(id) {
    const s = st(), r = s.rival;
    if (!r || r.id !== id) return '';
    return `<div class="warnbox" data-rival="1">${icon('rival', 20)}<p><b>${esc(r.name)}</b>開在對街，搶走這家 ${Math.round((1 - rivalMult(s, id)) * 100)}% 的客人。<small>點這裡看怎麼應對</small></p>${icon('arrow', 16)}</div>`;
  }
  function openBiz(id) {
    ctx.actions.select(id);
    const s = st(), b = BIZ_BY_ID[id], lv = s.biz[id].lv;
    show('biz:' + id, `
      <p class="zone">${ZONE[b.zone]}${CITY_LOTS[id] && stackOf(id).floors > 1 ? ` · F${floorOf(id)}` : ''}</p>
      <h2><span class="bic" style="--c:${b.color}">${icon(b.icon, 22)}</span>${esc(b.name)}<small>${esc(b.en)}</small></h2>
      <div class="lvrow">${[1, 2, 3].map((k) => `<i class="${lv >= k ? 'on' : ''}"></i>`).join('')}<span>${lv ? `Lv${lv} · ${b.cat}` : `出售中 · ${b.cat}`}</span><span class="tag">${KIND[b.kind]}</span></div>
      ${rivalBox(id)}
      ${bizStats(id)}
      ${nextPreview(id)}
      ${buyBtn(id)}
      ${strategyHTML(id)}
      ${gearHTML(id)}
      ${towerHTML(id)}
      <button class="ghost" data-focus="${id}">${icon('pin', 16)} 鏡頭移到這裡</button>
    `);
  }
  // ── 公寓、地標、對手 ──
  function openApt(key) {
    ctx.actions.select('apt:' + key);
    const s = st(), a = APT_BY_KEY[key], lv = aptLv(s, key), c = aptNextCost(s, key);
    const rentNow = aptRent(key, lv), rentNext = aptRent(key, Math.min(2, lv + 1));
    const rv = s.rival && s.rival.lot === key ? s.rival : null;
    show('apt:' + key, `
      <p class="zone">城市生活改版 · 住宅</p>
      <h2><span class="bic" style="--c:#2d5a45">${icon('home', 22)}</span>${esc(a.name)}<small>${lv ? '你的公寓' : '出售中'}</small></h2>
      <div class="lvrow">${[1, 2].map((k) => `<i class="${lv >= k ? 'on' : ''}"></i>`).join('')}<span>${lv ? (lv === 2 ? 'Lv2 · 翻修完成' : 'Lv1 · 出租中') : '出售中 · 公寓'}</span><span class="tag">住戶會去城市商家消費</span></div>
      ${rv ? `<div class="warnbox" data-rival="1">${icon('rival', 20)}<p><b>${esc(rv.name)}</b>租了這棟的一樓。<small>買下這棟就能收回店面，請他們搬走</small></p></div>` : ''}
      <div class="grid">
        <div><small>房租／日</small><b class="g">${money(lv ? rentNow : rentNext)}</b></div>
        <div><small>城市客流</small><b>+${(APT.pop * 100).toFixed(1)}% / 級</b></div>
        <div><small>全城住戶加成</small><b>+${(popLevels(s) * APT.pop * 100).toFixed(1)}%</b></div>
        <div><small>名下公寓房租／日</small><b>${money(rentPerDay(s))}</b></div>
      </div>
      ${lv === 1 ? `<div class="next"><small>翻修之後</small><p>房租 ${money(rentNow)} → <b>${money(rentNext)}</b>／日，再多 +${(APT.pop * 100).toFixed(1)}% 城市客流</p><p class="muted">外牆掛上帝國布條、露台加棚架。</p></div>` : ''}
      ${c === null ? `<button class="big done" disabled>${icon('check', 18)} 已翻修完成</button>` : `<button class="big" data-apt="${key}" ${s.money >= c ? '' : 'disabled'}>${icon(lv ? 'up' : 'home', 18)} ${lv ? '翻修' : '買下公寓'} · ${money(c, c < 1e6)}</button>${s.money >= c ? '' : `<p class="need">還差 ${money(c - s.money)}</p>`}`}
      <button class="ghost" data-focus="apt:${key}">${icon('pin', 16)} 鏡頭移到這裡</button>`);
  }
  function openMark(id) {
    ctx.actions.select('mark:' + id);
    const s = st(), m = LANDMARK_BY_ID[id], on = hasMark(s, id), mc = landmarkCost(s, m);
    show('mark:' + id, `
      <p class="zone">城市生活改版 · 地標</p>
      <h2><span class="bic" style="--c:${m.color}">${icon(m.icon, 22)}</span>${esc(m.name)}<small>${esc(m.en)}</small></h2>
      <div class="lvrow"><i class="${on ? 'on' : ''}"></i><span>${on ? `第 ${s.marks[id]} 天落成` : '尚未興建'}</span></div>
      <div class="next"><small>效果</small><p>${esc(m.note)}</p>${id === 'ferris' && on ? `<p class="muted">今日票房 ${money(s.today.rev.ferris || 0)}</p>` : ''}</div>
      ${on ? `<button class="big done" disabled>${icon('check', 18)} 已落成</button>` : `<button class="big" data-mark="${id}" ${s.money >= mc ? '' : 'disabled'}>${icon(m.icon, 18)} 興建 · ${money(mc)}${mc < m.cost ? '<small>市府觀光補助 −40%</small>' : ''}</button>${s.money >= mc ? '' : `<p class="need">還差 ${money(mc - s.money)}</p>`}`}
      <button class="ghost" data-focus="mark:${id}">${icon('pin', 16)} 鏡頭移到這裡</button>`);
  }
  function openRival() {
    const s = st(), r = s.rival;
    if (!r) { close(); return; }
    ctx.actions.select('rival');
    const b = BIZ_BY_ID[r.id], c = rivalBuyCost(s), a = APT_BY_KEY[r.lot], ac = aptNextCost(s, r.lot);
    show('rival', `
      <p class="zone">競爭對手 · 開在${esc(a.name)}一樓</p>
      <h2><span class="bic" style="--c:#2a2f3a">${icon('rival', 22)}</span>${esc(r.name)}<small>第 ${r.since} 天進駐</small></h2>
      <div class="grid">
        <div><small>搶走${esc(b.name)}的客人</small><b class="r">${Math.round((1 - rivalMult(s, r.id)) * 100)}%</b></div>
        <div><small>每天變強</small><b>+${Math.round(RIVAL.grow * 100)}%（最多 ${Math.round(RIVAL.max * 100)}%）</b></div>
      </div>
      <h3>怎麼應對</h3>
      <div class="costs">
        <div><span>${icon('tag', 14)} ${esc(b.name)}改成平價</span><b>影響減半</b></div>
        <div><span>${icon('up', 14)} ${esc(b.name)}升到 Lv3</span><b>影響 −20%</b></div>
      </div>
      <button class="big" data-buyout="1" ${s.money >= c ? '' : 'disabled'}>${icon('money', 18)} 收購${esc(r.name)} · ${money(c)}</button>
      ${ac !== null ? `<button class="big alt" data-apt="${r.lot}" ${s.money >= ac ? '' : 'disabled'}>${icon('home', 18)} 買下${esc(a.name)}收回店面 · ${money(ac)}</button>` : ''}
      <p class="muted">趕走後 ${RIVAL.cooldown} 天內不會有新對手；把空著的公寓都買下，對手就沒地方開店。</p>
      <button class="ghost" data-focus="rival">${icon('pin', 16)} 鏡頭移到這裡</button>`);
  }
  function shopHTML(tab) {
    const s = st();
    const tabs = `<div class="tabs wrap">${[['city', '城市'], ['beach', '海灘'], ['estate', '地產'], ['marks', '建設'], ['items', '道具']].map(([k, n]) => `<button data-tab="${k}" class="${tab === k ? 'on' : ''}">${n}${k === 'items' && s.deal && s.deal.sale ? '<em>特價</em>' : ''}</button>`).join('')}<button data-p="port">海港</button></div>`;
    if (tab === 'items') return `<h2 class="plain">商店</h2>${tabs}${itemShopHTML()}`;
    if (tab === 'estate') {
      return `<h2 class="plain">商店</h2>${tabs}
        <p class="muted">買下街上的公寓：每天收房租，住戶也是城市商家的客人（每級 +${(APT.pop * 100).toFixed(1)}% 城市客流）。對手只能租你沒買下的公寓開店。</p>
        <div class="cards">${APTS.map((a) => {
          const lv = aptLv(s, a.key), c = aptNextCost(s, a.key);
          return `<div class="bcard${lv ? ' own' : ''}" data-openapt="${a.key}">
            <div class="bt"><span class="bic" style="--c:#2d5a45">${icon('home', 18)}</span><b>${esc(a.name)}</b>${lv ? `<em>Lv${lv}</em>` : ''}</div>
            <dl><dt>${lv ? '翻修' : '買下'}</dt><dd>${c === null ? '完成' : money(c)}</dd><dt>房租／日</dt><dd>${money(aptRent(a.key, Math.max(1, lv)))}</dd></dl>
            ${s.rival && s.rival.lot === a.key ? '<div class="stars rv">對手在這</div>' : ''}
          </div>`;
        }).join('')}</div>`;
    }
    if (tab === 'marks') {
      return `<h2 class="plain">商店</h2>${tabs}
        <h3>地標</h3>
        <p class="muted">一次買斷的大型地標，帶來全區加成，也是新的風景。</p>
        <div class="mlist">${LANDMARKS.map((m) => {
          const on = hasMark(s, m.id), c = landmarkCost(s, m);
          return `<div class="mrow" data-openmark="${m.id}">
            <span class="bic" style="--c:${m.color}">${icon(m.icon, 18)}</span>
            <div class="mt"><b>${esc(m.name)}${c < m.cost && !on ? ' <em>補助 −40%</em>' : ''}</b><small>${esc(m.note)}</small></div>
            ${on ? '<span class="maxed">已落成</span>' : `<button class="mini" data-mark="${m.id}" ${s.money >= c ? '' : 'disabled'}>${money(c)}</button>`}
          </div>`;
        }).join('')}</div>
        ${civicHTML()}`;
    }
    const list = BIZ.filter((b) => b.zone === tab);
    return `<h2 class="plain">商店</h2>
      ${tabs}
      ${tab === 'beach' ? '<p class="muted">沿海道路以南的新區域：沙灘、碼頭與海面。客人會從街區穿過斑馬線走下步道消費，晴天與熱浪天生意最好。</p>' : ''}
      <div class="cards">${list.map((b) => {
        const lv = s.biz[b.id].lv, c = nextCost(s, b.id);
        return `<div class="bcard${lv ? ' own' : ''}" data-open="${b.id}">
          <div class="bt"><span class="bic" style="--c:${b.color}">${icon(b.icon, 18)}</span><b>${esc(b.name)}</b>${lv ? `<em>Lv${lv}</em>` : ''}</div>
          <dl><dt>${lv ? '升級' : '開業'}</dt><dd>${c === null ? '滿級' : money(c)}</dd><dt>客單價</dt><dd>${money(b.price[Math.max(0, lv - 1)], true)}</dd><dt>營業</dt><dd>${hhmm(b.open)}–${hhmm(b.close)}</dd></dl>
          <div class="stars" title="天氣敏感度">${b.kind === 'indoor' ? '室內' : b.kind === 'outdoor' ? '戶外' : '水上'}</div>
        </div>`;
      }).join('')}</div>`;
  }
  // ── 道具與任務改版：道具商店、背包、設備、全城建設 ──
  const itemCost = (s, it) => {
    const p = itemPrice(s, it.id), l = itemListPrice(s, it.id);
    return p < l ? `<s>${money(l)}</s> ${money(p)}` : money(p);
  };
  function itemBuyBtn(s, it) {
    if (bagCount(s, it.id) >= BAG_MAX) return '<span class="maxed">背包已滿</span>';
    if (it.rare && s.deal && s.deal.bought.includes(it.id)) return '<span class="maxed">今天已買</span>';
    return `<button class="mini" data-buyitem="${it.id}" ${canBuyItem(s, it.id) ? '' : 'disabled'}>${itemCost(s, it)}</button>`;
  }
  function itemShopHTML() {
    const s = st(), deal = s.deal || { items: [], bought: [] };
    const row = (it, inDeal) => `<div class="irow${inDeal && deal.sale === it.id ? ' sale' : ''}${it.rare ? ' rare' : ''}">
        <span class="bic" style="--c:${it.rare ? '#7a4a2a' : '#2f7f8f'}">${icon(it.icon, 18)}</span>
        <div class="mt"><b>${esc(it.name)}${bagCount(s, it.id) ? ` <em>背包 ${bagCount(s, it.id)}</em>` : ''}${inDeal && deal.sale === it.id ? ` <i class="tg off">−${Math.round(DEAL.off * 100)}%</i>` : ''}${it.rare ? ' <i class="tg rare">稀有</i>' : ''}</b><small>${esc(it.note)}${it.port && !s.port.lv ? '（要先開海港）' : ''}</small></div>
        ${itemBuyBtn(s, it)}
      </div>`;
    const dealItems = deal.items.map((id) => ITEM_BY_ID[id]);
    return `<h3>今日特價 <small>第 ${s.day} 天 · 午夜換一批</small></h3>
      <div class="mlist">${dealItems.map((it) => row(it, true)).join('')}</div>
      <h3>常備道具</h3>
      <p class="muted">價格跟著近 3 天的平均營收走，生意越大、效果越值錢。每種最多帶 ${BAG_MAX} 個；稀有品只在今日特價出現，每天限買一個。</p>
      <div class="mlist">${ITEMS.filter((it) => !it.rare).map((it) => row(it, false)).join('')}</div>
      <button class="big alt" data-p="bag">${icon('bag', 18)} 打開背包 · ${bagTotal(s)} 件</button>`;
  }
  function civicHTML() {
    const s = st();
    const rows = CIVIC.map((c) => {
      const on = hasCivic(s, c.id), ok = hasPermit(s, c.id), n = c.permit && NPC_BY_ID[c.permit];
      const right = on ? (c.id === 'yacht' || c.id === 'mascot' ? `<button class="mini alt" data-fthing="${c.id}">${icon('eye', 14)} 跟拍</button>` : '<span class="maxed">已完工</span>')
        : ok ? `<button class="mini" data-civic="${c.id}" ${s.money >= c.cost ? '' : 'disabled'}>${money(c.cost)}</button>`
          : `<span class="lockd">${icon('lock', 14)} ${money(c.cost)}</span>`;
      return `<div class="mrow${ok || on ? '' : ' locked'}">
        <span class="bic" style="--c:${c.color}">${icon(c.icon, 18)}</span>
        <div class="mt"><b>${esc(c.name)}${c.cosmetic ? ' <i class="tg">外觀</i>' : ''}</b><small>${ok || on ? esc(c.note) : `需要${esc(n.name)}的「${esc(n.permit)}」：完成${esc(n.name)}的委託`}</small></div>
        ${right}
      </div>`;
    }).join('');
    return `<h3>全城建設</h3>
      <p class="muted">公共設施要先拿到角色委託給的許可證；吉祥物不用。帝國號與吉祥物主要是風景，可以跟拍。</p>
      <div class="mlist">${rows}</div>
      <h3>帝國旗色</h3>
      <p class="muted">公寓外牆的布條、帝國號與吉祥物用這個顏色。</p>
      <div class="flags">${FLAGS.map((f) => {
        const own = ownsFlag(s, f.id), on = s.flag === f.id;
        return `<button class="flagb${on ? ' on' : ''}" data-flag="${f.id}" ${own || s.money >= f.cost ? '' : 'disabled'} style="--c:${f.color}"><i></i><b>${f.name}</b><small>${on ? '使用中' : own ? '已擁有' : money(f.cost)}</small></button>`;
      }).join('')}</div>`;
  }
  // 店家面板：設備與快速用道具
  function gearHTML(id) {
    const s = st();
    if (!s.biz[id].lv) return '';
    const list = GEAR.filter((g) => gearFits(id, g.id));
    const now = absMin(s);
    // 稀有品只有背包裡有、或今天特價有賣時才列出來
    const quick = ITEMS.filter((it) => it.target === 'shop' && (!it.ok || it.ok.includes(id)) && (!it.rare || bagCount(s, it.id) || (s.deal && s.deal.items.includes(it.id))));
    const active = s.buffs.filter((b) => b.t === id && b.until > now);
    return `${list.length ? `<h3>設備</h3><div class="gears">${list.map((g) => {
      const own = hasGear(s, id, g.id), c = gearCost(id, g.id);
      return `<div class="grow${own ? ' own' : ''}"><span class="gi">${icon(g.icon, 18)}</span><div class="mt"><b>${esc(g.name)}</b><small>${esc(g.note)}</small></div>${own ? `<span class="maxed">${icon('check', 12)} 已裝</span>` : `<button class="mini" data-gear="${id}:${g.id}" ${s.money >= c ? '' : 'disabled'}>${money(c)}</button>`}</div>`;
    }).join('')}</div>` : ''}
      ${quick.length ? `<h3>對這家店用道具</h3>
      ${active.length ? `<div class="buffs">${active.map((b) => `<span class="buff">${icon(ITEM_BY_ID[b.id].icon, 14)} ${ITEM_BY_ID[b.id].name} · 剩 ${hrs(b.until - now)}</span>`).join('')}</div>` : ''}
      <div class="quick">${quick.map((it) => {
        const n = bagCount(s, it.id), why = n ? useBlock(s, it.id, id) : null;
        return n ? `<button class="mini${why ? ' alt' : ''}" data-use="${it.id}:${id}" ${why ? `disabled title="${esc(why)}"` : ''}>${icon(it.icon, 14)} ${it.name} ×${n}</button>`
          : `<button class="mini alt" data-tab="items" title="到道具商店買">${icon(it.icon, 14)} ${it.name} · 買</button>`;
      }).join('')}</div>` : ''}`;
  }
  let bagSel = null;
  function useArea(s, it) {
    const gate = useGate(s, it.id);
    if (gate) return `<p class="why">${icon('info', 14)} ${esc(gate)}</p>`;
    if (it.target === 'shop') {
      const ts = itemTargets(s, it.id);
      if (!ts.length) return `<p class="why">${icon('info', 14)} 還沒有能用這個道具的店</p>`;
      return `<div class="targets">${ts.map((t) => {
        const b = BIZ_BY_ID[t], why = useBlock(s, it.id, t);
        return `<button class="tgt" data-use="${it.id}:${t}" ${why ? `disabled title="${esc(why)}"` : ''} style="--c:${b.color}"><span>${icon(b.icon, 14)}</span>${esc(b.name)}${why ? '<small>效果中</small>' : ''}</button>`;
      }).join('')}</div>`;
    }
    if (it.target === 'cargo') return `<div class="targets">${CARGO_IDS.map((c) => `<button class="tgt" data-use="${it.id}:${c}" style="--c:${CARGO[c].color}"><span>${icon('crate', 14)}</span>${CARGO[c].name}<small>庫存 ${Math.floor(s.port.stock[c])}</small></button>`).join('')}</div>`;
    if (it.target === 'event') return `<div class="targets">${BOOKABLE.map((e) => `<button class="tgt" data-use="${it.id}:${e}" style="--c:#b4513c"><span>${icon('ticket', 14)}</span>${EVENTS[e].name}<small>${esc(EVENTS[e].note)}</small></button>`).join('')}</div>`;
    return `<button class="big" data-use="${it.id}">${icon(it.icon, 18)} 現在使用</button>`;
  }
  function bagHTML() {
    const s = st(), now = absMin(s);
    const own = ITEMS.filter((it) => bagCount(s, it.id));
    const buffs = s.buffs.filter((b) => b.until > now);
    if (bagSel && !bagCount(s, bagSel)) bagSel = null;
    return `<h2 class="plain">道具 <small>背包 ${bagTotal(s)} 件</small></h2>
      ${buffs.length ? `<h3>生效中</h3><div class="buffs">${buffs.map((b) => `<span class="buff">${icon(ITEM_BY_ID[b.id].icon, 14)} ${ITEM_BY_ID[b.id].name}${b.t ? ` · ${BIZ_BY_ID[b.t].name}` : ''} · 剩 ${hrs(b.until - now)}</span>`).join('')}</div>` : ''}
      ${s.booked ? `<p class="muted">${icon('ticket', 14)} 明天預約了${EVENTS[s.booked].name}。</p>` : ''}
      <h3>背包</h3>
      ${own.length ? `<div class="bag">${own.map((it) => {
        const sel = bagSel === it.id, gate = useGate(s, it.id);
        return `<div class="bitem${sel ? ' on' : ''}">
          <button class="bh" data-pick="${it.id}"><span class="bic" style="--c:${it.rare ? '#7a4a2a' : '#2f7f8f'}">${icon(it.icon, 18)}</span><span class="mt"><b>${esc(it.name)} <em>×${bagCount(s, it.id)}</em></b><small>${esc(it.note)}</small></span><span class="use${gate ? ' no' : ''}">${gate ? '暫不能用' : sel ? '收起' : '使用'}</span></button>
          ${sel ? `<div class="bu">${useArea(s, it)}</div>` : ''}
        </div>`;
      }).join('')}</div>` : '<p class="muted">背包是空的。到「商店 › 道具」買，或完成委託、挑戰拿獎勵。</p>'}
      <button class="big alt" data-tab="items">${icon('shop', 18)} 道具商店${s.deal && s.deal.sale ? ` · ${ITEM_BY_ID[s.deal.sale].name}特價中` : ''}</button>`;
  }
  let shopTab = 'city';
  function openShop(tab) { shopTab = tab || shopTab; show('shop', shopHTML(shopTab)); }
  function manageHTML() {
    const s = st();
    const own = BIZ.filter((b) => s.biz[b.id].lv);
    if (!own.length) return `<h2 class="plain">經營</h2><p class="muted">還沒有任何店。到「商店」或直接點地圖上標著價格的店面開第一家。</p><button class="big" data-p="shop">${icon('shop', 18)} 前往商店</button>`;
    return `<h2 class="plain">經營 <small>${own.length} 家店</small></h2>
      <div class="mlist">${own.map((b) => {
        const lv = s.biz[b.id].lv, c = nextCost(s, b.id), openNow = isOpen(b, s.minute);
        return `<div class="mrow" data-open="${b.id}">
          <span class="bic" style="--c:${b.color}">${icon(b.icon, 18)}</span>
          <div class="mt"><b>${esc(b.name)} <em>Lv${lv}</em></b><small>${openNow ? `營業中 · ${ctx.occ(b.id)}/${capOf(s, b.id)}` : '打烊'} · 今日 ${s.today.visits[b.id] || 0} 位</small></div>
          <div class="mv"><b>${money(s.today.rev[b.id] || 0)}</b><small>今日</small></div>
          ${c === null ? '<span class="maxed">MAX</span>' : `<button class="mini" data-buy="${b.id}" ${s.money >= c ? '' : 'disabled'}>${icon('up', 14)} ${money(c)}</button>`}
        </div>`;
      }).join('')}${s.port.lv ? `<div class="mrow" data-p="port">
          <span class="bic" style="--c:${PORT.color}">${icon('anchor', 18)}</span>
          <div class="mt"><b>${PORT.name} <em>Lv${s.port.lv}</em></b><small>${s.port.ships.filter((q) => q.state !== 'departed').length} 艘船 · 庫存 ${CARGO_IDS.map((c) => `${CARGO[c].name} ${Math.floor(s.port.stock[c])}`).join('、')}</small></div>
          <div class="mv"><b class="g">${money(s.today.saved)}</b><small>今日省下</small></div>
        </div>` : ''}${popLevels(s) ? `<div class="mrow" data-tab="estate">
          <span class="bic" style="--c:#2d5a45">${icon('home', 18)}</span>
          <div class="mt"><b>公寓 <em>${APTS.filter((a) => aptLv(s, a.key)).length} 棟</em></b><small>城市客流 +${(popLevels(s) * APT.pop * 100).toFixed(1)}% · 房租 ${money(rentPerDay(s))}／日</small></div>
          <div class="mv"><b>${money(s.today.rev.rent || 0)}</b><small>今日房租</small></div>
        </div>` : ''}</div>`;
  }
  function financeHTML() {
    const s = st();
    const rev = todayRevenue(s), cost = todayCosts(s);
    const t = s.today, fees = t.freight + t.storage + t.spoil;
    const days = [...s.history.map((d) => ({ ...d, cost: d.cost + (d.supply || 0) + (d.port || 0) })), { day: s.day, rev, cost, live: true }].slice(-7);
    const max = Math.max(1, ...days.map((d) => Math.max(d.rev, d.cost)));
    const byBiz = BIZ.filter((b) => s.biz[b.id].lv).map((b) => ({ b, v: s.today.rev[b.id] || 0 })).sort((p, q) => q.v - p.v);
    const top = Math.max(1, ...byBiz.map((x) => x.v));
    const city = byBiz.filter((x) => x.b.zone === 'city').reduce((a, x) => a + x.v, 0), port = t.rev.port || 0, estate = (t.rev.rent || 0) + (t.rev.ferris || 0) + (t.rev.insurance || 0), beach = rev - city - port - estate;
    return `<h2 class="plain">財務 <small>第 ${s.day} 天</small></h2>
      <div class="grid three">
        <div><small>今日營收</small><b class="g">${money(rev)}</b></div>
        <div><small>營業成本</small><b class="r">${money(cost)}</b></div>
        <div><small>營業淨利</small><b class="${rev - cost >= 0 ? 'g' : 'r'}">${money(rev - cost)}</b></div>
      </div>
      <div class="split"><i style="flex:${Math.max(city, 1)}"></i><i class="b" style="flex:${Math.max(beach, beach ? 1 : 0.001)}"></i><i class="p" style="flex:${Math.max(port, port ? 1 : 0.001)}"></i><i class="e" style="flex:${Math.max(estate, estate ? 1 : 0.001)}"></i></div>
      <p class="legend"><span class="d1"></span>城市 ${money(city)}　<span class="d2"></span>海灘 ${money(beach)}${port ? `　<span class="d4"></span>貨運合約 ${money(port)}` : ''}${estate ? `　<span class="d5"></span>房租、摩天輪${t.rev.insurance ? '與保險理賠' : ''} ${money(estate)}` : ''}</p>
      ${t.delivered ? `<p class="legend">${icon('scooter', 14)} 今天外送 ${t.delivered} 單（已算進各店營收）</p>` : ''}
      <h3>今日成本</h3>
      <div class="costs">
        <div><span>人事與營運</span><b>${money(t.cost)}</b></div>
        <div><span>進貨（供應成本）</span><b>${money(t.supply)}</b></div>
        ${s.port.lv ? `<div><span>港口運費・倉儲・耗損</span><b>${money(fees)}</b></div><div class="g"><span>${icon('anchor', 14)} 走港口省下</span><b>−${money(t.saved)}</b></div>` : `<div class="hint" data-p="port"><span>${icon('anchor', 14)} 開設灣岸海港，進貨價便宜 ${pct(PORT.disc[0])} 起</span>${icon('arrow', 14)}</div>`}
      </div>
      <h3>最近 7 天</h3>
      <div class="bars">${days.map((d) => `<div class="bar${d.live ? ' live' : ''}"><i style="height:${(d.rev / max) * 100}%"></i><u style="height:${(d.cost / max) * 100}%"></u><small>D${d.day}</small></div>`).join('')}</div>
      <p class="legend"><span class="d1"></span>營收　<span class="d3"></span>成本（含進貨與港口費用）　投資購店不計入</p>
      <h3>今日各店營收</h3>
      <div class="hbars">${byBiz.length ? byBiz.map((x) => `<div><span>${esc(x.b.name)}</span><i style="width:${(x.v / top) * 100}%;--c:${x.b.color}"></i><b>${money(x.v)}</b></div>`).join('') : '<p class="muted">還沒有營收。</p>'}</div>
      <div class="grid">
        <div><small>總投資</small><b>${money(s.stats.invested)}</b></div>
        <div><small>累計營收</small><b>${money(s.stats.earned)}</b></div>
        <div><small>服務人次</small><b>${s.stats.served.toLocaleString()}</b></div>
        <div><small>客滿拒客</small><b>${s.stats.turned.toLocaleString()}</b></div>
      </div>`;
  }
  // ── 物流與海港 ──
  let portTab = 'ov';
  const bidR = {};
  const pct = (v) => `${Math.round(v * 100)}%`;
  const hrs = (m) => (m >= 60 ? `${Math.floor(m / 60)} 小時${m % 60 >= 1 ? ` ${Math.floor(m % 60)} 分` : ''}` : `${Math.max(0, Math.floor(m))} 分`);
  function portBuyBtn() {
    const s = st(), c = portNextCost(s), lv = s.port.lv;
    if (c === null) return `<button class="big done" disabled>${icon('check', 18)} 已是區域港</button>`;
    const ok = s.money >= c;
    return `<button class="big" data-pbuy="1" ${ok ? '' : 'disabled'}>${icon(lv ? 'up' : 'anchor', 18)} ${lv ? `擴建為${PORT.stage[lv]}` : '買下碼頭並開港'} · ${money(c, c < 1e6)}</button>${ok ? '' : `<p class="need">還差 ${money(c - s.money)}</p>`}`;
  }
  function shipRow(q, now) {
    const tag = q.kind === 'contract' ? `<span class="tag c">${icon('contract', 12)} ${esc(q.client)}</span>` : `<span class="tag">${icon('crate', 12)} 補給</span>`;
    const p = q.state === 'unloading' ? q.done / q.total : q.state === 'departed' ? 1 : 0;
    const due = q.kind === 'contract' && q.state !== 'departed' ? q.deadline - now : null;
    return `<div class="ship ${q.state}">
      <span class="si">${icon('ship', 18)}</span>
      <div><b>${esc(q.name)} ${tag}</b><small>${shipStatus(q, now)} · ${q.total} 櫃${q.delayed ? ' · <em class="r">天候延誤</em>' : ''}${due !== null ? ` · ${due >= 0 ? `交期剩 ${hrs(due)}` : `<em class="r">逾期 ${hrs(-due)}</em>`}` : ''}</small><i class="qp"><u style="width:${p * 100}%"></u></i></div>
    </div>`;
  }
  function portHTML() {
    const s = st(), p = s.port, lv = p.lv, now = absMin(s);
    const head = `<p class="zone">物流改版 · 防波堤西側碼頭</p>
      <h2><span class="bic" style="--c:${PORT.color}">${icon('anchor', 22)}</span>${PORT.name}<small>${PORT.en}</small></h2>
      <div class="lvrow">${[1, 2, 3].map((k) => `<i class="${lv >= k ? 'on' : ''}"></i>`).join('')}<span>${lv ? `Lv${lv} · ${PORT.stage[lv - 1]}` : '出售中 · 物流設施'}</span><span class="tag">每日營運 ${money(PORT.wage[Math.max(0, lv - 1)])}</span></div>`;
    if (!lv) {
      return `${head}
        <p class="muted">每位客人消費都要用掉一份貨：食材、零售貨或燃油耗材。沒有港口時全部向城市批發商以市價進貨；開港後由補給船運來，物流車送到各店，進貨價便宜 ${pct(PORT.disc[0])} 起。</p>
        <div class="grid">
          <div><small>批發折扣</small><b class="g">${PORT.disc.map(pct).join(' / ')}</b></div>
          <div><small>岸橋／泊位</small><b>${PORT.cranes.join(' / ')}</b></div>
          <div><small>物流車</small><b>${PORT.trucks.join(' / ')} 台</b></div>
          <div><small>今日供應成本</small><b class="r">${money(s.today.supply)}</b></div>
        </div>
        <div class="next"><small>開港後</small><p>自動依補貨點向補給船下單、船到後岸橋卸貨入庫；也可以在「合約」投標別人的貨櫃，卸完收款。</p><p class="muted">生鮮在倉庫會慢慢耗損，Lv2 冷鏈港加冷藏倉後幾乎不壞。下雨時航行中的船可能延誤。</p></div>
        ${portBuyBtn()}
        <button class="ghost" data-pfocus="1">${icon('pin', 16)} 鏡頭移到港口</button>`;
    }
    const tabs = `<div class="tabs"><button data-ptab="ov" class="${portTab === 'ov' ? 'on' : ''}">總覽</button><button data-ptab="bid" class="${portTab === 'bid' ? 'on' : ''}">合約${p.offers.length ? `<em>${p.offers.length}</em>` : ''}</button><button data-ptab="fleet" class="${portTab === 'fleet' ? 'on' : ''}">船隊與岸橋</button></div>`;
    let body = '';
    if (portTab === 'ov') {
      const fees = s.today.freight + s.today.storage + s.today.spoil;
      const cap = truckCap(s);
      body = `<div class="grid">
          <div><small>今日省下</small><b class="g">${money(s.today.saved)}</b></div>
          <div><small>港口費用</small><b class="r">${money(fees)}</b></div>
          <div><small>走港口的客人</small><b>${s.today.viaPort.toLocaleString()}</b></div>
          <div><small>物流車（本小時）</small><b>${Math.round(p.truckUsed)} / ${cap}</b></div>
        </div>
        <p class="legend">運費 ${money(s.today.freight)}　倉儲 ${money(s.today.storage)}　生鮮耗損 ${money(s.today.spoil)}</p>
        <h3>倉庫庫存 <small>每櫃 ${PORT.container} 單位</small></h3>
        <div class="stock">${CARGO_IDS.map((c) => {
          const g = CARGO[c], v = p.stock[c], r = p.reorder[c], inb = inbound(s, c);
          const max = Math.max(r * 2.6, v + inb, 60);
          return `<div class="srow">
            <span class="sn"><i style="background:${g.color}"></i>${g.name}${g.fresh ? '<em>生鮮</em>' : ''}</span>
            <div class="sbar"><u style="width:${(v / max) * 100}%;background:${g.color}"></u><s style="left:${(v / max) * 100}%;width:${(inb / max) * 100}%"></s><b style="left:${(r / max) * 100}%"></b></div>
            <span class="sv"><b>${Math.floor(v)}</b>${inb ? `<small>+${Math.round(inb)} 在途</small>` : ''}</span>
            <span class="ro"><button class="mini" data-ro="${c}:-1" aria-label="降低補貨點">${icon('minus', 14)}</button><small>補貨點 ${r}</small><button class="mini" data-ro="${c}:1" aria-label="提高補貨點">${icon('plus', 14)}</button></span>
          </div>`;
        }).join('')}</div>
        <p class="muted">庫存加在途低於補貨點（黃線）時，自動向批發商叫一艘補給船，補到補貨點的 2.5 倍。補貨點越高越不會斷貨，但倉儲費與耗損也越多。</p>
        <h3>船期</h3>
        <div class="ships">${p.ships.length ? p.ships.map((q) => shipRow(q, now)).join('') : '<p class="muted">目前沒有船。庫存低於補貨點時會自動下單。</p>'}</div>`;
    } else if (portTab === 'bid') {
      const active = p.ships.filter((q) => q.kind === 'contract' && q.state !== 'departed');
      body = `<p class="muted">貨主公開招標：出價越低越容易得標，但每櫃賺得少。得標後船會開進港口，卸完全部貨櫃才收款；超過交期每小時扣 15%，最多扣 50%，評分也會下降。</p>
        <div class="offers">${p.offers.length ? p.offers.map((o) => {
          const r = bidR[o.id] ?? 0.9;
          const bid = Math.round((o.guide * r) / 100) * 100;
          const ch = winChance(s, o, bid);
          return `<div class="offer" data-oid="${o.id}">
            <div class="oh"><span class="bic" style="--c:#2f7f8f">${icon('contract', 18)}</span><div><b>${esc(o.client)}</b><small>${esc(o.goods)} · ${o.containers} 櫃 · ${esc(o.name)}</small></div><span class="ox">${hrs(o.expires - now)} 後截止</span></div>
            <dl><dt>指導價</dt><dd>${money(o.guide, true)}／櫃</dd><dt>船到</dt><dd>約 ${(o.arrive / 60).toFixed(1)} 小時</dd><dt>交期</dt><dd>${o.deadlineH} 小時內</dd></dl>
            <label class="slider"><span>出價 <b data-bv>${money(bid, true)}</b>／櫃 · <em data-bp>${pct(r)}</em></span><input type="range" min="60" max="130" step="1" value="${Math.round(r * 100)}" data-bidr="${o.id}" aria-label="出價佔指導價比例"></label>
            <div class="chance"><i><u data-cu style="width:${ch * 100}%"></u></i><span>得標機率 <b data-cv>${pct(ch)}</b>　總額 <b data-tv>${money(bid * o.containers)}</b></span></div>
            <button class="big" data-bid="${o.id}">${icon('contract', 18)} 送出投標</button>
          </div>`;
        }).join('') : '<p class="muted">目前沒有招標。每 5–8 小時會有新的貨主上門，最多同時三份。</p>'}</div>
        ${active.length ? `<h3>執行中的合約</h3><div class="ships">${active.map((q) => shipRow(q, now)).join('')}</div>` : ''}
        <div class="grid"><div><small>完成合約</small><b>${p.stats.contracts}</b></div><div><small>逾期交貨</small><b class="${p.stats.late ? 'r' : ''}">${p.stats.late}</b></div><div><small>今日合約收入</small><b class="g">${money(s.today.rev.port || 0)}</b></div><div><small>累計卸貨</small><b>${p.stats.containers.toLocaleString()} 櫃</b></div></div>`;
    } else {
      body = `<table class="lvt"><thead><tr><th></th>${PORT.stage.map((n, i) => `<th class="${lv === i + 1 ? 'on' : ''}">Lv${i + 1}<small>${n}</small></th>`).join('')}</tr></thead><tbody>
          <tr><td>岸橋</td>${PORT.cranes.map((v, i) => `<td class="${lv === i + 1 ? 'on' : ''}">${v} 座</td>`).join('')}</tr>
          <tr><td>泊位</td>${PORT.berths.map((v, i) => `<td class="${lv === i + 1 ? 'on' : ''}">${v} 個</td>`).join('')}</tr>
          <tr><td>物流車</td>${PORT.trucks.map((v, i) => `<td class="${lv === i + 1 ? 'on' : ''}">${v} 台</td>`).join('')}</tr>
          <tr><td>批發折扣</td>${PORT.disc.map((v, i) => `<td class="${lv === i + 1 ? 'on' : ''}">${pct(v)}</td>`).join('')}</tr>
          <tr><td>生鮮耗損／日</td>${PORT.spoil.map((v, i) => `<td class="${lv === i + 1 ? 'on' : ''}">${(v * 100).toFixed(1)}%</td>`).join('')}</tr>
          <tr><td>營運成本／日</td>${PORT.wage.map((v, i) => `<td class="${lv === i + 1 ? 'on' : ''}">${money(v)}</td>`).join('')}</tr>
        </tbody></table>
        <p class="muted">每座岸橋每小時卸 ${PORT.craneRate} 櫃；每台物流車每小時送 ${PORT.truckUnits} 份貨。物流車送不完的客人改回市價進貨，所以生意越大越需要擴建。</p>
        ${portBuyBtn()}
        <div class="grid"><div><small>到港船次</small><b>${p.stats.ships}</b></div><div><small>泊位使用</small><b>${p.ships.filter((q) => q.state === 'berthing' || q.state === 'unloading').length} / ${PORT.berths[lv - 1]}</b></div></div>`;
    }
    return `${head}${tabs}${body}<button class="ghost" data-pfocus="1">${icon('pin', 16)} 鏡頭移到港口</button>`;
  }
  function alertsHTML() {
    return `<h2 class="plain">通知</h2><div class="alist">${alerts.length ? alerts.map((a) => `<div>${icon(a.ic, 18)}<p>${esc(a.msg)}<small>${a.when}</small></p></div>`).join('') : '<p class="muted">目前沒有通知。</p>'}</div>`;
  }
  let qTab = 'main', dayKey = '';
  const itemsText = (items) => Object.entries(items || {}).map(([id, n]) => `${ITEM_BY_ID[id].name}×${n}`).join('、');
  const rewardLine = (r, permit) => [r.money ? money(r.money) : '', r.items ? itemsText(r.items) : '', r.rating ? `評分 +${r.rating}` : '', r.permit ? permit : ''].filter(Boolean).join(' · ');
  // 可以領的獎勵數（任務鈕的紅點）
  function claimables(s) {
    let n = NPCS.filter((x) => npcStatus(s, x.id) === 'ready').length;
    if (s.chal && s.chal.state === 'ready') n++;
    if (s.weekly) n += s.weekly.tasks.filter((t) => t.done && !t.claimed).length;
    n += Object.values(s.shots).filter((v) => v === 1).length + Object.values(s.follows).filter((v) => v === 1).length;
    return n;
  }
  // 角色頭像：參數化的平面插畫，光源在右上
  function portrait(L) {
    const H = L.hair;
    const back = L.style === 'long' ? `<path d="M12.5 33c-1.5-13 2.5-23 11.5-23s13 10 11.5 23c-2 1-4 1-5.5 0V21H18v12c-1.5 1-3.5 1-5.5 0z" fill="${H}"/>` : '';
    const front = {
      side: `<path d="M14.6 21.5c-.4-8 4-12.3 9.6-12.3 5.8 0 9.6 4 9.4 11.4-2.6-3.2-7.6-4.6-13.6-3.4-2.2.7-4 2.2-5.4 4.3z" fill="${H}"/>`,
      short: `<path d="M14.8 20.5c0-7.2 4.2-10.8 9.2-10.8s9.2 3.6 9.2 10.8c-1.8-2.4-5-3.6-9.2-3.6s-7.4 1.2-9.2 3.6z" fill="${H}"/>`,
      long: `<path d="M14.6 21c.4-7 4.2-11 9.4-11s9 4 9.4 11c-2.4-3.6-5.6-5.4-9.4-5.4s-7 1.8-9.4 5.4z" fill="${H}"/>`,
      bun: `<circle cx="24" cy="8.6" r="4.2" fill="${H}"/><path d="M14.8 21c0-7.2 4.2-11 9.2-11s9.2 3.8 9.2 11c-2-3.8-5.2-5.8-9.2-5.8s-7.2 2-9.2 5.8z" fill="${H}"/>`,
      slick: `<path d="M14.8 20.4c0-7 4-10.7 9.4-10.7 6 0 9.2 3.4 9.2 8.8-3.4-2-9.4-3.2-14.8-2-2.2.8-3 2.2-3.8 3.9z" fill="${H}"/>`,
    }[L.style] || '';
    const acc = {
      glasses: '<g fill="none" stroke="#2a2a2a" stroke-width="1.1"><rect x="17.6" y="20" width="5.6" height="4.2" rx="1.6"/><rect x="24.8" y="20" width="5.6" height="4.2" rx="1.6"/><path d="M23.2 21.6h1.6"/></g>',
      shades: '<path d="M17.2 20.2h6.2v2.6a1.8 1.8 0 0 1-1.8 1.8h-2.6a1.8 1.8 0 0 1-1.8-1.8zM24.6 20.2h6.2v2.6a1.8 1.8 0 0 1-1.8 1.8h-2.6a1.8 1.8 0 0 1-1.8-1.8z" fill="#1f2a30"/><path d="M23.4 21h1.2" stroke="#1f2a30" stroke-width="1"/>',
      cap: '<path d="M14.6 17.6c.8-5.4 4.6-8.4 9.4-8.4s8.6 3 9.4 8.4z" fill="#24476b"/><path d="M13 17.6h22.4c-.4 1.2-1.4 1.8-3 1.8H16c-1.6 0-2.6-.6-3-1.8z" fill="#1a3550"/><path d="M21.4 12.4h5.2v2.4h-5.2z" fill="#d9a63e"/>',
      earring: '<circle cx="15.2" cy="26" r="1.1" fill="#d9a63e"/><circle cx="32.8" cy="26" r="1.1" fill="#d9a63e"/>',
    }[L.acc] || '';
    const tie = L.tie ? `<path d="M19.4 36.4l4.6 4.4 4.6-4.4" fill="none" stroke="#f4f1e6" stroke-width="2.2" stroke-linejoin="round"/><path d="M23 37.6h2l1.1 7.6-2.1 2.2-2.1-2.2z" fill="${L.tie}"/>` : '';
    return `<svg class="pt" viewBox="0 0 48 48" width="52" height="52" aria-hidden="true">
      <rect width="48" height="48" rx="14" fill="#efe2c2"/>
      ${back}
      <path d="M7 48c0-8.6 7.4-12.6 17-12.6S41 39.4 41 48z" fill="${L.shirt}"/>
      <path d="M7 48c0-8.6 7.4-12.6 17-12.6-6 1.6-10 5-11 12.6z" fill="rgba(0,0,0,.12)"/>
      <path d="M20.6 30h6.8v6.4L24 38.6l-3.4-2.2z" fill="${L.skin}"/><path d="M20.6 30h6.8v2.4c-2.4 1.2-4.4 1.2-6.8 0z" fill="rgba(0,0,0,.14)"/>
      <ellipse cx="15.2" cy="22.6" rx="1.6" ry="2.4" fill="${L.skin}"/><ellipse cx="32.8" cy="22.6" rx="1.6" ry="2.4" fill="${L.skin}"/>
      <ellipse cx="24" cy="21.4" rx="9" ry="10.4" fill="${L.skin}"/>
      <path d="M17 26.5c1.2 3.6 3.8 5.3 7 5.3-4.2-.6-7-4.6-7.4-11.4z" fill="rgba(0,0,0,.08)"/>
      ${front}
      <path d="M18.6 19.2c1-.6 2.4-.7 3.4-.2M26 19c1-.5 2.4-.4 3.4.2" stroke="${H === '#d8d2c4' || H === '#8a8a8a' ? '#6a6a6a' : H}" stroke-width="1.2" fill="none" stroke-linecap="round"/>
      <circle cx="20.6" cy="22.2" r="1.15" fill="#2a2a2a"/><circle cx="27.4" cy="22.2" r="1.15" fill="#2a2a2a"/>
      <path d="M23.4 23.6l-.6 2.6h1.6" stroke="rgba(0,0,0,.18)" stroke-width="1" fill="none" stroke-linecap="round"/>
      <path d="M21.4 27.6c1.6 1.1 3.6 1.1 5.2 0" stroke="#8a4a3a" stroke-width="1.2" fill="none" stroke-linecap="round"/>
      ${acc}${tie}
    </svg>`;
  }
  function npcCard(s, n) {
    const status = npcStatus(s, n.id), st0 = npcState(s, n.id), total = n.steps.length;
    const head = `<div class="nh">${portrait(n.look)}<div class="nn"><b>${esc(n.name)}</b><small>${esc(n.role)}</small></div><span class="nstep">${Math.min(st0.step + (status === 'ready' ? 1 : 0), total)} / ${total}</span></div>
      <div class="pips">${n.steps.map((_, i) => `<i class="${i < st0.step ? 'on' : i === st0.step && status !== 'locked' ? 'cur' : ''}"></i>`).join('')}</div>`;
    if (status === 'locked') return `<div class="npc locked">${head}<p class="why">${icon('lock', 14)} ${esc(n.lockText)}</p></div>`;
    if (status === 'done') return `<div class="npc done">${head}<p class="say">委託全部完成。${n.permit ? `你拿到了「${esc(n.permit)}」。` : ''}</p></div>`;
    const step = npcStep(s, n.id), g = step.goal, now = absMin(s);
    const p = npcProgress(s, n.id);
    const prog = status === 'on' || status === 'ready'
      ? `<i class="qp"><u style="width:${Math.min(100, (p.cur / p.goal) * 100)}%"></u></i><em>${g.k === 'hold' ? `${hrs(p.cur)} / ${hrs(p.goal)}` : g.k === 'state' ? (p.cur ? '已達成' : '尚未達成') : `${Math.min(p.cur, p.goal)} / ${p.goal}`}${st0.until && status === 'on' ? ` · 剩 ${hrs(Math.max(0, st0.until - now))}` : ''}</em>` : '';
    let act = '';
    if (status === 'ready') act = `<button class="big" data-npc="claim:${n.id}">${icon('gift', 18)} 領取獎勵</button>`;
    else if (status === 'wait') act = `<p class="why">${icon('lock', 14)} ${esc(step.reqText)}</p>`;
    else if (status === 'new' && g.k === 'choice') act = `<div class="opts">${g.options.map((o) => `<button class="big${g.options.length > 1 ? ' alt' : ''}" data-npc="choose:${n.id}:${o.id}" ${o.cost && s.money < o.cost ? 'disabled' : ''}>${esc(o.label)}<small>${esc(o.note)}</small></button>`).join('')}</div>`;
    else if (status === 'new') act = `<button class="big" data-npc="accept:${n.id}">${icon('chat', 18)} 接下委託${g.hours ? `<small>接下後 ${g.hours} 小時內完成</small>` : ''}</button>`;
    else act = g.ids ? `<button class="ghost" data-focus="${g.ids[0]}">${icon('pin', 16)} 鏡頭移到${esc(BIZ_BY_ID[g.ids[0]].name)}</button>` : '';
    const rw = rewardLine(step.reward, n.permit ? `「${n.permit}」` : '');
    return `<div class="npc ${status}">${head}
      <p class="say">${esc(step.say)}</p>
      <div class="ngoal"><b>${esc(step.title)}</b>${prog}${rw ? `<small>獎勵 ${esc(rw)}</small>` : ''}</div>
      ${act}</div>`;
  }
  function chalHTML(s) {
    const c = s.chal, now = absMin(s);
    if (!c) {
      const wait = s.quest < CHAL.startQuest ? '主線第 1 章完成後開放' : s.chalNext > now ? `下一個挑戰大約 ${hrs(s.chalNext - now)}後出現` : '新的挑戰馬上就來';
      return `<div class="chal idle"><span class="ci">${icon('timer', 20)}</span><p><b>目前沒有挑戰</b><small>${wait}。挑戰出現後 ${CHAL.offerMin} 分鐘內要接受。</small></p></div>`;
    }
    const p = chalProgress(s), rw = `${money(c.reward)} · ${ITEM_BY_ID[c.item].name}×1`;
    if (c.state === 'offer') return `<div class="chal offer"><span class="ci">${icon('timer', 20)}</span><p><b>${esc(chalText(c))}</b><small>獎勵 ${rw} · 接受期限剩 ${hrs(Math.max(0, c.offerUntil - now))}</small></p></div><button class="big" data-chal="accept">${icon('timer', 18)} 接受挑戰</button>`;
    if (c.state === 'ready') return `<div class="chal ready"><span class="ci">${icon('check', 20)}</span><p><b>${esc(chalText(c))}</b><small>挑戰成功 · 獎勵 ${rw}</small></p></div><button class="big" data-chal="claim">${icon('gift', 18)} 領取獎勵</button>`;
    if (c.state === 'fail') return `<div class="chal fail"><span class="ci">${icon('close', 20)}</span><p><b>${esc(chalText(c))}</b><small>這次沒成功，下一個挑戰晚點會來</small></p></div>`;
    const before = c.start > now;
    return `<div class="chal on"><span class="ci">${icon('timer', 20)}</span><p><b>${esc(chalText(c))}</b><i class="qp"><u style="width:${(p.cur / p.goal) * 100}%"></u></i><small>${before ? `${hrs(c.start - now)}後開始計算` : c.k === 'calm' ? `已撐 ${hrs(p.cur)} / 2 小時 · 拒客 ${Math.max(0, s.stats.turned - (c.base || 0))} / ${c.limit}` : `${c.k === 'rev' ? `${money(p.cur)} / ${money(p.goal)}` : `${p.cur} / ${p.goal}`} · 剩 ${hrs(Math.max(0, c.end - now))}`} · 獎勵 ${rw}</small></p></div>`;
  }
  function questsHTML() {
    const s = st();
    const npcN = NPCS.filter((n) => ['ready', 'new'].includes(npcStatus(s, n.id))).length;
    const chN = (s.chal && (s.chal.state === 'offer' || s.chal.state === 'ready') ? 1 : 0) + (s.weekly ? s.weekly.tasks.filter((t) => t.done && !t.claimed).length : 0) + (s.daily ? s.daily.tasks.filter((t) => !t.done).length : 0);
    const alN = Object.values(s.shots).filter((v) => v === 1).length + Object.values(s.follows).filter((v) => v === 1).length;
    const tb = (k, n, b) => `<button data-qtab="${k}" class="${qTab === k ? 'on' : ''}">${n}${b ? `<em>${b}</em>` : ''}</button>`;
    const tabs = `<div class="tabs">${tb('main', '主線')}${tb('story', '委託', npcN)}${tb('chal', '挑戰', chN)}${tb('album', '收藏', alN)}</div>`;
    if (qTab === 'story') {
      return `<h2 class="plain">任務 <small>角色委託</small></h2>${tabs}
        <p class="muted">灣岸的人各有心事。接下委託、達成條件後按「領取」；有些委託會給許可證，蓋全城建設要用。</p>
        <div class="npcs">${NPCS.map((n) => npcCard(s, n)).join('')}</div>`;
    }
    if (qTab === 'chal') {
      const tasks = s.daily ? s.daily.tasks : [];
      const w = s.weekly, left = 7 - ((s.day - 1) % 7);
      const bonus = Math.round(Math.min(5, s.streak || 0) * 10);
      return `<h2 class="plain">任務 <small>第 ${s.day} 天</small></h2>${tabs}
        <h3>限時挑戰</h3>${chalHTML(s)}
        <h3>每日目標 <small>${s.streak ? `連續 ${s.streak} 天全部完成 · 獎金 +${bonus}%` : '全部完成可累積連續天數'}</small></h3>
        <div class="qlist">${tasks.map((t) => {
          const p = Math.min(t.goal, dailyProgress(s, t));
          return `<div class="${t.done ? 'done' : 'cur'}"><span>${t.done ? icon('check', 16) : icon('target', 16)}</span><p><b>${esc(dailyText(t))}</b><i class="qp"><u style="width:${(p / t.goal) * 100}%"></u></i><em>${t.goal >= 1000 ? `${money(p)} / ${money(t.goal)}` : `${p} / ${t.goal}`}</em></p><b class="rw">+${money(t.reward)}</b></div>`;
        }).join('')}</div>
        <h3>每週任務 <small>第 ${weekOf(s) + 1} 週 · 剩 ${left} 天</small></h3>
        <div class="qlist">${w ? w.tasks.map((t, i) => {
          const p = Math.min(t.goal, weeklyProgress(s, t));
          return `<div class="${t.claimed ? 'done' : t.done ? 'ready' : ''}"><span>${t.claimed ? icon('check', 16) : icon('calendar', 16)}</span><p><b>${esc(weeklyText(t))}</b><i class="qp"><u style="width:${(p / t.goal) * 100}%"></u></i><em>${t.goal >= 1000 ? `${money(p)} / ${money(t.goal)}` : `${p} / ${t.goal}`}</em></p>${t.done && !t.claimed ? `<button class="mini" data-weekly="${i}">${icon('gift', 14)} ${money(t.reward)}</button>` : `<b class="rw">+${money(t.reward)}</b>`}</div>`;
        }).join('') : '<p class="muted">每週一批，跨週時更新。</p>'}</div>`;
    }
    if (qTab === 'album') {
      const done = Object.keys(s.ach).length;
      const cell = (kind, d, v) => `<div class="shot${v === 2 ? ' got' : v === 1 ? ' ready' : ''}"><span>${icon(kind === 'shot' ? 'camera' : 'eye', 16)}</span><p><b>${esc(d.name)}</b><small>${esc(d.hint)}</small></p>${v === 1 ? `<button class="mini" data-shot="${kind}:${d.id}">${icon('gift', 14)} ${money(d.reward)}</button>` : v === 2 ? `<span class="maxed">${icon('check', 12)} 收藏</span>` : `<b class="rw">+${money(d.reward)}</b>`}</div>`;
      return `<h2 class="plain">任務 <small>收藏</small></h2>${tabs}
        <h3>攝影收藏 <small>照片模式按「截圖」時判定</small></h3>
        <div class="shots">${SHOTS.map((d) => cell('shot', d, s.shots[d.id])).join('')}</div>
        <h3>跟拍收藏 <small>放大後點街上的人，或按右側的眼睛鈕</small></h3>
        <div class="shots">${FOLLOWS.map((d) => cell('follow', d, s.follows[d.id])).join('')}</div>
        <h3>成就 <small>${done} / ${ACHIEVEMENTS.length}</small></h3>
        <div class="qlist">${ACHIEVEMENTS.map((a) => `<div class="${s.ach[a.id] ? 'done' : ''}"><span>${s.ach[a.id] ? icon('trophy', 16) : icon('star', 14)}</span><p><b>${esc(a.name)}</b><em>${esc(a.desc)}${s.ach[a.id] ? ` · 第 ${s.ach[a.id]} 天達成` : ''}</em></p><b class="rw">+${money(a.reward)}</b></div>`).join('')}</div>`;
    }
    // 主線：做完的章節收成一列
    const chs = [];
    QUESTS.forEach((q, i) => { let c = chs[chs.length - 1]; if (!c || c.ch !== q.ch) chs.push((c = { ch: q.ch, name: q.chName, list: [] })); c.list.push(i); });
    return `<h2 class="plain">任務 <small>主線 ${Math.min(s.quest, QUESTS.length)} / ${QUESTS.length}</small></h2>${tabs}${chs.map((c) => {
      const all = c.list.every((i) => i < s.quest);
      if (all) return `<div class="chdone">${icon('check', 14)}<b>第 ${c.ch} 章 · ${esc(c.name)}</b><small>${c.list.length} / ${c.list.length}</small></div>`;
      return `<h3>第 ${c.ch} 章 · ${esc(c.name)}</h3><div class="qlist">${c.list.map((i) => {
        const q = QUESTS[i], done = i < s.quest, cur = i === s.quest;
        const p = cur ? questProgress(s) : null;
        return `<div class="${done ? 'done' : cur ? 'cur' : ''}"><span>${done ? icon('check', 16) : i + 1}</span><p><b>${esc(q.title)}</b>${cur ? `<em>${esc(q.hint)}</em><i class="qp"><u style="width:${(p.cur / p.goal) * 100}%"></u></i>` : ''}</p><b class="rw">+${money(q.reward)}${q.items ? `<small>${esc(itemsText(q.items))}</small>` : ''}</b></div>`;
      }).join('')}</div>`;
    }).join('')}`;
  }
  function settingsHTML() {
    const s = st();
    return `<h2 class="plain">設定</h2>
      <div class="set"><span>${icon('sound', 18)} 音效</span><button class="tog ${s.opts.sound ? 'on' : ''}" data-act="sound"><i></i></button></div>
      <div class="set"><span>${icon('gear', 18)} 畫質</span><div class="seg">${['auto', 'high', 'low'].map((q) => `<button data-q="${q}" class="${s.opts.quality === q ? 'on' : ''}">${{ auto: '自動', high: '高', low: '省電' }[q]}</button>`).join('')}</div></div>
      <p class="muted">「自動」會在手機上以較低解析度與陰影更新頻率維持 50fps 以上，畫面掉到 45fps 以下時再自動降級。</p>
      <div class="set"><span>${icon('save', 18)} 存檔</span><button class="mini" data-act="save">立即存檔</button></div>
      <p class="muted">每 15 秒與切換分頁時自動存到這台裝置。存檔格式 v5；更早的 v1（海灘改版前）、v2（物流改版前）、v3（城市生活改版前）、v4（道具與任務改版前）存檔都會自動轉換，原有進度完整保留。</p>
      <div class="set"><span>${icon('close', 18)} 重新開始</span><button class="mini warn" data-act="reset">清除進度</button></div>
      <h3>操作</h3>
      <p class="muted">拖曳移動地圖，滾輪或雙指縮放，點店面、公寓或標籤看詳情；放大後點街上的人可以跟拍。鍵盤：WASD／方向鍵移動、Q／E 縮放、空白鍵暫停、1／2／3 切換速度、Esc 離開跟拍或照片模式。</p>`;
  }

  function render() {
    if (!open) return;
    const y = $('#sheetBody').scrollTop;
    if (open.startsWith('biz:')) openBiz(open.slice(4));
    else if (open.startsWith('apt:')) openApt(open.slice(4));
    else if (open.startsWith('mark:')) openMark(open.slice(5));
    else if (open === 'rival') openRival();
    else if (open === 'shop') openShop();
    else if (open === 'manage') show('manage', manageHTML());
    else if (open === 'finance') show('finance', financeHTML());
    else if (open === 'alerts') show('alerts', alertsHTML());
    else if (open === 'quests') show('quests', questsHTML());
    else if (open === 'bag') show('bag', bagHTML());
    else if (open === 'settings') show('settings', settingsHTML());
    else if (open === 'port') show('port', portHTML());
    $('#sheetBody').scrollTop = y;
  }
  function openPanel(p, keep = false) {
    if (open === p) return keep ? undefined : close();
    if (p === 'shop') openShop();
    else { open = p; render(); }
    if (p === 'alerts') unread = 0;
  }

  // ── 事件 ──
  root.addEventListener('click', (e) => {
    const t = e.target.closest('button, [data-open], [data-p]');
    if (!t) return;
    if (t.dataset.buy) { ctx.actions.buy(t.dataset.buy); render(); return; }
    if (t.dataset.buyitem) { ctx.actions.buyItem(t.dataset.buyitem); render(); return; }
    if (t.dataset.pick) { bagSel = bagSel === t.dataset.pick ? null : t.dataset.pick; render(); return; }
    if (t.dataset.use) { const [id, x] = t.dataset.use.split(':'); if (ctx.actions.useItem(id, x)) bagSel = null; render(); return; }
    if (t.dataset.gear) { const [id, g] = t.dataset.gear.split(':'); ctx.actions.gear(id, g); render(); return; }
    if (t.dataset.civic) { ctx.actions.civic(t.dataset.civic); render(); return; }
    if (t.dataset.flag) { ctx.actions.flag(t.dataset.flag); render(); return; }
    if (t.dataset.fthing) { ctx.actions.followThing(t.dataset.fthing); if (matchMedia('(max-width: 899px)').matches) close(); return; }
    if (t.dataset.npc) {
      const [k, id, o] = t.dataset.npc.split(':');
      if (k === 'accept') ctx.actions.npcAccept(id);
      else if (k === 'choose') ctx.actions.npcChoose(id, o);
      else ctx.actions.npcClaim(id);
      render();
      return;
    }
    if (t.dataset.chal) { if (t.dataset.chal === 'accept') ctx.actions.chalAccept(); else ctx.actions.chalClaim(); render(); return; }
    if (t.dataset.weekly !== undefined) { ctx.actions.weeklyClaim(+t.dataset.weekly); render(); return; }
    if (t.dataset.shot) { const [k, id] = t.dataset.shot.split(':'); ctx.actions.shotClaim(k, id); render(); return; }
    if (t.dataset.tier) { const [id, k] = t.dataset.tier.split(':'); ctx.actions.tier(id, +k); render(); return; }
    if (t.dataset.promo) { ctx.actions.promo(t.dataset.promo); render(); return; }
    if (t.dataset.lift) { ctx.actions.lift(t.dataset.lift); render(); return; }
    if (t.dataset.swap) { const [key, a, b] = t.dataset.swap.split(':'); ctx.actions.swap(key, a, b); render(); return; }
    if (t.dataset.apt) { ctx.actions.apt(t.dataset.apt); render(); return; }
    if (t.dataset.mark) { ctx.actions.mark(t.dataset.mark); render(); return; }
    if (t.dataset.buyout) { ctx.actions.buyout(); close(); return; }
    if (t.dataset.rival) { openRival(); ctx.actions.focus('rival'); return; }
    if (t.dataset.openapt) { openApt(t.dataset.openapt); ctx.actions.focus('apt:' + t.dataset.openapt); return; }
    if (t.dataset.openmark) { openMark(t.dataset.openmark); ctx.actions.focus('mark:' + t.dataset.openmark); return; }
    if (t.dataset.qtab) { qTab = t.dataset.qtab; render(); $('#sheetBody').scrollTop = 0; return; }
    if (t.dataset.phw) { ctx.actions.photoWeather(t.dataset.phw); return; }
    if (t.dataset.ph) {
      const k = t.dataset.ph;
      if (k === 'exit') photo(false);
      else if (k === 'lapse') ctx.actions.timelapse();
      else if (k === 'rec') ctx.actions.record();
      else if (k === 'snap') ctx.actions.snapshot();
      return;
    }
    if (t.dataset.pbuy) { ctx.actions.buyPort(); render(); return; }
    if (t.dataset.ptab) { portTab = t.dataset.ptab; render(); $('#sheetBody').scrollTop = 0; return; }
    if (t.dataset.pfocus) { ctx.actions.focusPort(); if (matchMedia('(max-width: 899px)').matches) close(); return; }
    if (t.dataset.ro) { const [c, d] = t.dataset.ro.split(':'); ctx.actions.reorder(c, +d); render(); return; }
    if (t.dataset.bid !== undefined) {
      const o = st().port.offers.find((x) => x.id === +t.dataset.bid);
      if (o) ctx.actions.bid(o.id, Math.round((o.guide * (bidR[o.id] ?? 0.9)) / 100) * 100);
      render();
      return;
    }
    if (t.dataset.open) { openBiz(t.dataset.open); ctx.actions.focus(t.dataset.open); return; }
    if (t.dataset.tab && t.classList.contains('mrow')) { openShop(t.dataset.tab); return; }
    if (t.dataset.focus) { ctx.actions.focus(t.dataset.focus); if (matchMedia('(max-width: 899px)').matches) close(); return; }
    if (t.dataset.tab) { openShop(t.dataset.tab); return; }
    if (t.dataset.p) { openPanel(t.dataset.p); return; }
    if (t.dataset.s !== undefined) { ctx.actions.setSpeed(+t.dataset.s); return; }
    if (t.dataset.q) { ctx.actions.setQuality(t.dataset.q); render(); return; }
    if (t.dataset.act === 'sound') { ctx.actions.toggleSound(); render(); return; }
    if (t.dataset.act === 'save') { ctx.actions.save(); toast('已存檔', 'save'); return; }
    if (t.dataset.act === 'reset') {
      if (t.dataset.armed) { ctx.actions.reset(); close(); return; }
      t.dataset.armed = '1';
      t.textContent = '再按一次確認';
      return;
    }
  });
  // 出價滑桿：拖動時只更新數字，不重繪整個面板
  root.addEventListener('input', (e) => {
    const el = e.target;
    if (el.id === 'phTime') { ctx.actions.photoTime(+el.value); return; }
    if (!el.dataset || el.dataset.bidr === undefined) return;
    const id = +el.dataset.bidr, o = st().port.offers.find((x) => x.id === id);
    if (!o) return;
    const r = +el.value / 100;
    bidR[id] = r;
    const bid = Math.round((o.guide * r) / 100) * 100, ch = winChance(st(), o, bid);
    const card = el.closest('.offer');
    card.querySelector('[data-bv]').textContent = money(bid, true);
    card.querySelector('[data-bp]').textContent = pct(r);
    card.querySelector('[data-cu]').style.width = `${ch * 100}%`;
    card.querySelector('[data-cv]').textContent = pct(ch);
    card.querySelector('[data-tv]').textContent = money(bid * o.containers);
  });
  $('#sheetX').addEventListener('click', close);
  $('#btnQuests').addEventListener('click', () => openPanel('quests'));
  $('#btnBag').addEventListener('click', () => openPanel('bag'));
  $('#chalChip').addEventListener('click', () => openQuests('chal'));
  function openQuests(tab) { qTab = tab; if (open === 'quests') render(); else openPanel('quests'); }
  $('#qnext').addEventListener('click', () => {
    const p = questProgress(st());
    if (p && p.q.target === 'port') { if (st().port.lv) portTab = s0(p.index); openPanel('port', true); ctx.actions.focusPort(); }
    else if (p && p.q.target) { openBiz(p.q.target); ctx.actions.focus(p.q.target); }
    else if (p && p.index === 0) openShop('city');
    else openPanel('quests');
  });
  const s0 = (i) => (QUESTS[i].title.includes('合約') ? 'bid' : QUESTS[i].title.includes('Lv3') ? 'fleet' : 'ov');
  $('#btnSettings').addEventListener('click', () => openPanel('settings'));
  $('#btnOverview').addEventListener('click', () => ctx.actions.overview());
  $('#btnZoomIn').addEventListener('click', () => ctx.actions.zoom(0.8));
  $('#btnZoomOut').addEventListener('click', () => ctx.actions.zoom(1.25));
  $('#btnFollow').addEventListener('click', () => ctx.actions.follow(true));
  $('#follow').addEventListener('click', () => ctx.actions.follow(false));
  $('#btnPhoto').addEventListener('click', () => photo(true));
  function photo(on) {
    root.classList.toggle('photo', on);
    if (on) close();
    ctx.actions.photo(on);
  }
  // 擋住介面上的指標事件，避免拖到地圖
  for (const el of root.querySelectorAll('.hud, .row2 > *, .tools, .questbar, .nav, .sheet, .modal, .toasts, .photobar')) {
    el.addEventListener('pointerdown', (e) => e.stopPropagation());
    el.addEventListener('wheel', (e) => e.stopPropagation(), { passive: true });
  }

  // ── 每幀更新 ──
  let slow = 0, fpsAcc = 0, fpsN = 0;
  const api = {
    toast, close, openBiz, openShop, openPanel,
    portTab(t) { portTab = t; if (open === 'port') render(); },
    income(id, amt, x, y, z) {
      pop(`+${money(amt, true)}`, x, y + 2.4, z, amt >= 3000 ? 'hi' : '');
      const inc = $('#lastInc');
      inc.hidden = false;
      inc.innerHTML = `${icon('money', 14)} +${money(amt, true)}`;
      inc.classList.remove('flash');
      void inc.offsetWidth;
      inc.classList.add('flash');
    },
    turned(id, x, y, z, why) { pop(why === 'lift' ? '電梯排太長' : '客滿', x, y, z, 'full'); },
    pop(text, x, y, z, cls = '') { pop(text, x, y, z, cls); },
    act: (k, ...args) => ctx.actions[k](...args),
    // 跟拍資訊
    follow(d, a, color) {
      const el = $('#follow');
      el.hidden = !d;
      if (!d) return;
      const html = `${icon('eye', 14)}<span><b>${esc(d.who)}</b> ${esc(d.what)}${d.left ? ` · 還要 ${d.left} 分` : ''}${d.paid ? ` · 付了 ${money(d.paid, true)}` : ''}</span><i>${icon('close', 12)}</i>`;
      if (el.dataset.h !== html) { el.dataset.h = html; el.innerHTML = html; }
      if (a) el.style.setProperty('--c', `rgb(${a.shirt.map((v) => Math.round(Math.pow(v, 1 / 2.2) * 255)).join(',')})`);
      else if (color) el.style.setProperty('--c', color);
    },
    recording(on) { root.querySelector('[data-ph=rec]').classList.toggle('on', on); root.querySelector('[data-ph=rec] span').textContent = on ? '停止錄影' : '錄影'; },
    photo(on) { photo(on); },
    openApt, openMark, openRival, openQuests,
    // 領獎：金幣從畫面中間飛進資金欄（減少動態效果時只閃一下）
    coins(amount) {
      const box = $('.funds');
      box.classList.remove('gain');
      void box.offsetWidth;
      box.classList.add('gain');
      if (matchMedia('(prefers-reduced-motion: reduce)').matches || !Element.prototype.animate) return;
      const to = $('.coin').getBoundingClientRect();
      const sx = innerWidth / 2, sy = innerHeight * 0.5;
      const n = Math.min(10, 3 + Math.round(Math.log10(Math.max(10, amount))));
      for (let i = 0; i < n; i++) {
        const el = document.createElement('i');
        el.className = 'coinfx';
        el.style.left = `${sx}px`;
        el.style.top = `${sy}px`;
        root.appendChild(el);
        const a = (i / n) * Math.PI * 2, r = 26 + (i % 3) * 12;
        const jx = Math.cos(a) * r, jy = Math.sin(a) * r * 0.7;
        const dx = to.left + to.width / 2 - sx, dy = to.top + to.height / 2 - sy;
        el.animate([
          { transform: 'translate(-50%, -50%) scale(.4)', opacity: 0 },
          { transform: `translate(-50%, -50%) translate(${jx}px, ${jy - 18}px) scale(1)`, opacity: 1, offset: 0.25 },
          { transform: `translate(-50%, -50%) translate(${dx}px, ${dy}px) scale(.55)`, opacity: 0.9 },
        ], { duration: 720 + i * 45, easing: 'cubic-bezier(.45, 0, .55, 1)', fill: 'forwards' }).onfinish = () => el.remove();
      }
    },
    modal(html) {
      $('#modal').innerHTML = html;
      $('#modal').hidden = false;
    },
    closeModal() { $('#modal').hidden = true; },
    isOpen: () => open,
    update(dt, fps) {
      const s = st();
      // 資金數字滾動
      if (lastMoney === null) shownMoney = s.money;
      shownMoney += (s.money - shownMoney) * Math.min(1, dt * 6);
      if (Math.abs(s.money - shownMoney) < 1) shownMoney = s.money;
      $('#money').textContent = money(shownMoney);
      if (lastMoney !== null && s.money !== lastMoney) {
        $('#trend').innerHTML = icon(s.money > lastMoney ? 'up' : 'down', 15);
        $('#trend').className = s.money > lastMoney ? 'up' : 'dn';
        trendT = 2;
      }
      trendT -= dt;
      if (trendT < 0) $('#trend').innerHTML = '';
      lastMoney = s.money;
      $('#time').textContent = hhmm(s.minute);

      // 標籤位置（每幀）
      for (const b of BIZ) {
        const L = labels[b.id];
        const p = ctx.project(b.id);
        if (!p.vis) { L.el.style.visibility = 'hidden'; continue; }
        L.el.style.visibility = '';
        L.el.style.transform = `translate3d(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px, 0) translate(-50%, -100%)`;
        L.el.classList.toggle('sel', ctx.selected() === b.id);
        L.el.classList.toggle('far', p.far);
      }
      for (const L of xLabels) {
        if (!L.show) { L.el.style.visibility = 'hidden'; continue; }
        const a = ctx.anchor(L.id);
        const p = ctx.projectPoint(a[0], a[1], a[2]);
        const vis = p.x > -60 && p.x < innerWidth + 60 && p.y > 40 && p.y < innerHeight + 40;
        L.el.style.visibility = vis ? '' : 'hidden';
        if (!vis) continue;
        L.el.style.transform = `translate3d(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px, 0) translate(-50%, -100%)`;
        L.el.classList.toggle('far', ctx.far());
        L.el.classList.toggle('sel', ctx.selected() === L.id);
      }
      {
        const p = ctx.projectPort();
        portLbl.style.visibility = p.vis ? '' : 'hidden';
        if (p.vis) portLbl.style.transform = `translate3d(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px, 0) translate(-50%, -100%)`;
        portLbl.classList.toggle('far', p.far);
        portLbl.classList.toggle('sel', open === 'port');
        const ships = p.far ? [] : ctx.shipLabels();
        const now = absMin(s);
        for (let i = 0; i < Math.max(ships.length, shipEls.length); i++) {
          let el = shipEls[i];
          const q = ships[i];
          if (!el) {
            el = document.createElement('button');
            el.className = 'slbl';
            el.addEventListener('click', (e) => { e.stopPropagation(); openPanel('port', true); });
            $('#labels').appendChild(el);
            shipEls.push(el);
          }
          if (!q) { el.style.visibility = 'hidden'; continue; }
          const pp = ctx.projectPoint(q.x, 14, q.z);
          const vis = pp.x > -80 && pp.x < innerWidth + 80 && pp.y > 40 && pp.y < innerHeight + 40;
          el.style.visibility = vis ? '' : 'hidden';
          if (!vis) continue;
          el.style.transform = `translate3d(${pp.x.toFixed(1)}px, ${pp.y.toFixed(1)}px, 0) translate(-50%, -100%)`;
          const html = `${icon('ship', 13)}<span>${esc(q.name)}</span><b class="${q.q.state}">${shipStatus(q.q, now)}</b>`;
          if (el.dataset.h !== html) { el.dataset.h = html; el.innerHTML = html; }
        }
      }
      // 疊樓建築：電梯樓層指示（F1 ▲ 2/4）
      {
        const list = ctx.elevators();
        for (let i = 0; i < Math.max(list.length, elevEls.length); i++) {
          if (!elevEls[i]) {
            const el = document.createElement('div');
            el.className = 'elbl';
            $('#labels').append(el);
            elevEls.push(el);
          }
          const el = elevEls[i], q = list[i];
          const pb = q && ctx.project(q.base);
          if (!q || !pb.vis || pb.far) { el.style.visibility = 'hidden'; continue; }
          el.style.visibility = '';
          const pe = ctx.projectPoint(q.x, q.y, q.z);
          el.style.transform = `translate3d(${pe.x.toFixed(1)}px, ${pe.y.toFixed(1)}px, 0) translate(-50%, -100%)`;
          const eh = `F${q.floor} ${q.dir > 0 ? '▲' : q.dir < 0 ? '▼' : '■'} ${q.n}/${q.cap}`;
          if (el.textContent !== eh) el.textContent = eh;
        }
      }
      for (let i = pops.length - 1; i >= 0; i--) {
        const o = pops[i];
        o.t += dt;
        if (o.t > o.life) { o.el.remove(); pops.splice(i, 1); continue; }
        const p = ctx.projectPoint(o.x, o.y, o.z);
        const k = o.t / o.life;
        o.el.style.transform = `translate3d(${p.x.toFixed(1)}px, ${(p.y - k * 46).toFixed(1)}px, 0) translate(-50%, -100%) scale(${(0.8 + Math.min(1, o.t * 6) * 0.2).toFixed(2)})`;
        o.el.style.opacity = k < 0.7 ? 1 : (1 - k) / 0.3;
      }

      fpsAcc += fps; fpsN++;
      slow -= dt;
      if (slow > 0) return;
      slow = 0.25;
      // 低頻更新：標籤內容、日期、天氣、評分、任務、面板
      for (const b of BIZ) {
        const key = `${s.biz[b.id].lv}|${isOpen(b, s.minute)}`;
        if (labels[b.id].key !== key) { labels[b.id].key = key; labels[b.id].el.innerHTML = labelHTML(b.id); labels[b.id].el.classList.toggle('sale', !s.biz[b.id].lv); }
      }
      for (const L of xLabels) {
        const x = xLabelState(L.id);
        L.show = x.show;
        if (L.key !== x.html) { L.key = x.html; L.el.innerHTML = x.html; L.el.classList.toggle('sale', x.sale); }
      }
      const pk = `${s.port.lv}`;
      if (pk !== portKey) { portKey = pk; portLbl.innerHTML = portLabelHTML(); portLbl.classList.toggle('sale', !s.port.lv); }
      $('#portBadge').textContent = s.port.lv ? (s.port.offers.length || '') : (s.money >= PORT.cost ? '!' : '');
      const se = seasonOf(s);
      const dk = `${s.day}|${se.id}`;
      if (dayKey !== dk) { dayKey = dk; $('#day').innerHTML = `第 ${s.day} 天<i class="se ${se.id}">${icon({ spring: 'flower', summer: 'sun', autumn: 'leaf', winter: 'snow' }[se.id], 13)}<b>${se.name}</b></i>`; }
      $('#day').title = `${se.name}季第 ${seasonDay(s)} 天：海灘 ${Math.round(se.beach * 100)}%、城市 ${Math.round(se.city * 100)}%`;
      if (root.classList.contains('photo')) {
        const ph = $('#phTime');
        if (document.activeElement !== ph) ph.value = (s.minute / 60).toFixed(1);
        $('#phTimeV').textContent = hhmm(s.minute);
        root.querySelectorAll('[data-phw]').forEach((b) => b.classList.toggle('on', b.dataset.phw === s.weather.cur));
        root.querySelector('[data-ph=lapse]').classList.toggle('on', ctx.speed() >= 20);
      }
      const dd = s.daily ? s.daily.tasks.filter((t) => !t.done).length : 0;
      const wi = weatherIcon(s.weather.cur, s.minute);
      if ($('#wx').dataset.k !== wi) { $('#wx').dataset.k = wi; $('#wx').innerHTML = icon(wi, 26); $('#wx').className = 'wx ' + wi; }
      $('#wx').title = WEATHER[s.weather.cur].name;
      const r = Math.round(s.rating);
      $('#ratingNum').textContent = r;
      $('#ratingArc').style.strokeDasharray = `${(r / 100) * 94.2} 94.2`;
      $('#lvl b').textContent = empireLevel(s);
      const ev = s.event && EVENTS[s.event];
      $('#event').hidden = !ev;
      if (ev) $('#event').innerHTML = `${icon('people', 14)} ${ev.name} · ${ev.note}`;
      const qp = questProgress(s);
      if (qp) {
        $('#qch').textContent = `CHAPTER ${qp.q.ch} · ${qp.q.chName}`;
        $('#qcount').textContent = `${s.quest}/${QUESTS.length}`;
        $('#qprog').style.width = `${(s.quest / QUESTS.length) * 100}%`;
        $('#qtitle').textContent = qp.q.title;
        $('#qhint').textContent = qp.q.hint;
        $('#qval').textContent = qp.goal > 1 ? `${qp.goal >= 1000 ? money(qp.cur) : qp.cur} / ${qp.goal >= 1000 ? money(qp.goal) : qp.goal}` : `+${money(qp.q.reward)}`;
      } else {
        $('#qch').textContent = 'EPILOGUE · 海岸帝國';
        $('#qcount').textContent = `${QUESTS.length}/${QUESTS.length}`;
        $('#qprog').style.width = '100%';
        $('#qtitle').textContent = '所有任務完成';
        $('#qhint').textContent = '自由經營：挑戰更高的單日營收';
        $('#qval').textContent = '';
      }
      const cl = claimables(s);
      $('#qBadge').textContent = cl || (qp ? '1' : dd || '');
      $('#qBadge').classList.toggle('gift', cl > 0);
      $('#bagBadge').textContent = bagTotal(s) || '';
      {
        const c = s.chal, now = absMin(s), chip = $('#chalChip');
        chip.hidden = !c || c.state === 'fail';
        if (c && c.state !== 'fail') {
          const p = chalProgress(s);
          const txt = c.state === 'offer' ? `新挑戰 · ${hrs(Math.max(0, c.offerUntil - now))}內接受`
            : c.state === 'ready' ? '挑戰成功 · 去領獎'
              : c.start > now ? `挑戰 · ${hrs(c.start - now)}後開始`
                : c.k === 'calm' ? `撐住 · 剩 ${hrs(Math.max(0, c.end - now))}` : `挑戰 ${c.k === 'rev' ? money(p.cur) : p.cur} / ${c.k === 'rev' ? money(p.goal) : p.goal} · 剩 ${hrs(Math.max(0, c.end - now))}`;
          const html = `${icon(c.state === 'ready' ? 'gift' : 'timer', 14)}<span>${txt}</span>`;
          if (chip.dataset.h !== html) { chip.dataset.h = html; chip.innerHTML = html; chip.className = `chip chal ${c.state}`; }
        }
      }
      const affordable = BIZ.filter((b) => !s.biz[b.id].lv && s.money >= b.cost).length;
      $('#shopBadge').textContent = affordable || '';
      $('#alertBadge').textContent = unread ? Math.min(unread, 9) : '';
      root.querySelectorAll('#speed button').forEach((b) => b.classList.toggle('on', +b.dataset.s === ctx.speed()));
      const f = Math.round(fpsAcc / fpsN);
      fpsAcc = fpsN = 0;
      $('#fps b').textContent = f;
      $('#fps').className = 'fps ' + (f >= 50 ? 'ok' : f >= 35 ? 'mid' : 'low');
      root.querySelectorAll('#fps u').forEach((u, i) => u.classList.toggle('on', f >= 10 + i * 10));
      if (open && !pressing && open !== 'alerts' && open !== 'settings') render();
    },
  };
  return api;
}
