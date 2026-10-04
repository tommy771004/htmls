// HUD：比分、技能列、氣力條、血條、連擊數、公告、必殺技切入、單位血條與浮動數字、選角與結算。
import { HEROES, HERO_ORDER, TEAM_COLOR, TEAM_LIGHT, KI_BAR, xpToNext, MAX_LEVEL, ITEMS, APE_BUFF, DRAGON } from './config.js';
import { ICONS, ITEM_ICONS } from './icons.js';
import { buy, canBuy, inShop, eatSenzu, sell, priceFor, totalCost, sellPrice, itemById } from './items.js';
import { inBush } from './vision.js';
import { seen } from './vision.js';
import { canLevel, skillReady } from './combat.js';
import { vulnerable } from './units.js';
import { quipLine } from './quips.js';

const $ = (s, r = document) => r.querySelector(s);
const KEYS = ['Q', 'W', 'E', 'R'];
const fmtT = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

export function createHud(env) {
  const { render, portraits, busts = portraits } = env;
  let G = null;
  const el = {
    hud: $('#hud'), clock: $('#clock'), k0: $('#k0'), k1: $('#k1'), kda: $('#kda'),
    rosterA: $('#rosterA'), rosterB: $('#rosterB'), combo: $('#combo'), banner: $('#banner'), cutin: $('#cutin'),
    dock: $('#dock'), port: $('#dock .port img'), lvl: $('#dock .lvl'), hpFill: $('#dock .hp i'), hpTxt: $('#dock .hp b'), shFill: $('#dock .hp s'), xpFill: $('#dock .xp i'),
    kiCells: [...document.querySelectorAll('#dock .ki .cell i')], kiN: $('#dock .ki .kn'), sp: $('#spPrompt'), dead: $('#dead'), recall: $('#recallbar'),
    bars: $('#bars'), speed: $('#speed'), flash: $('#flash'), skills: {},
    slots: [...document.querySelectorAll('#dock .slots .slot:not(.senzu):not(.ward):not(.control)')], control: $('#dock .slot.control'), senzu: $('#dock .slot.senzu'), goldB: $('#dock .goldbtn'), gold: $('#dock .goldbtn b'), buffs: $('#buffs'),
    shop: $('#shop'), shopList: $('#shop .shopList'), shopGold: $('#shop .shopGold'), shopHint: $('#shop .shopHint'), shopDetail: $('#shop .shopDetail'), shopInv: $('#shop .shopInv'),
    ward: $('#dock .slot.ward'), bushTag: $('#bushTag'),
    nmB: $('#dock .nm b'), nmS: $('#dock .nm span'), target: $('#target'), tImg: $('#target img'), tName: $('#target .tn b'), tBar: $('#target .tb i'), tLv: $('#target .tl'),
    apeT: $('#apeT'), feed: $('#feed'), dbT: $('#dbT'), dbh: $('#dbh'), quip: $('#quip'), qImg: $('#quip img'), qName: $('#quip .bub b'), qText: $('#quip .bub p'),
  };
  const bctx = el.bars.getContext('2d');
  const sctx = el.speed.getContext('2d');

  // 技能列
  const skWrap = $('#dock .skills');
  for (const k of [...KEYS, 'D', 'B']) {
    const d = document.createElement('div');
    d.className = 'sk' + (k === 'D' || k === 'B' ? ' small' : '');
    d.dataset.k = k;
    d.innerHTML = `<button class="face" type="button" aria-label="${k}"><span class="ic"></span><span class="cd"></span><span class="cdn"></span></button><kbd>${k}</kbd>${k.length === 1 && KEYS.includes(k) ? '<span class="pips"><i></i><i></i><i></i><i></i><i></i></span><button class="plus" type="button" aria-label="升級">＋</button><span class="cost"></span>' : ''}<span class="lab"></span>`;
    skWrap.appendChild(d);
    el.skills[k] = { d, lab: $('.lab', d), ic: $('.ic', d), cd: $('.cd', d), cdn: $('.cdn', d), pips: d.querySelectorAll('.pips i'), plus: $('.plus', d), cost: $('.cost', d), face: $('.face', d), last: {} };
  }

  let player = null;
  const touchUI = matchMedia('(pointer: coarse)').matches;
  /* ---------- 商店 ---------- */
  el.senzu.querySelector('.ic').innerHTML = ITEM_ICONS.senzu;
  el.ward.querySelector('.ic').innerHTML = ITEM_ICONS.ward; el.ward.title = '插眼（4）';
  el.control.querySelector('.ic').innerHTML = ITEM_ICONS.control; el.control.title = '真眼（5）';
  let shopSel = 'weights', sellSlot = -1;
  const TIERS = [[1, '基礎'], [2, '進階'], [3, '終極'], [0, '消耗品']];
  function tree(id, top = true) {
    const it = itemById(id), own = !top && player.inv.includes(id);
    return `<div class="node${own ? ' own' : ''}"><button type="button" data-pick="${id}" title="${it.name}">${ITEM_ICONS[id]}</button>${it.from ? `<div class="kids">${it.from.map((c) => tree(c, false)).join('')}</div>` : ''}</div>`;
  }
  function renderShop() {
    if (!player) return;
    const P = player;
    el.shopList.innerHTML = TIERS.map(([t, label]) => `<section><h4>${label}</h4>${ITEMS.filter((it) => it.tier === t).map((it) => {
      const owned = !it.consumable && P.inv.includes(it.id), price = priceFor(P, it.id);
      return `<button class="item${it.id === shopSel && sellSlot < 0 ? ' sel' : ''}${owned ? ' owned' : ''}${canBuy(P, it.id) ? '' : ' cant'}" type="button" data-id="${it.id}">${ITEM_ICONS[it.id]}<b>${it.name}</b><em>${price}</em></button>`;
    }).join('')}</section>`).join('');
    if (sellSlot >= 0 && P.inv[sellSlot]) {
      const id = P.inv[sellSlot], it = itemById(id);
      el.shopDetail.innerHTML = `<div class="dh">${ITEM_ICONS[id]}<div><b>${it.name}</b><small>${it.desc}</small></div></div><p class="price">賣回可得 <em>${sellPrice(id)}</em>（總價 ${totalCost(id)} 的 60%）</p><button class="act sellb" type="button" ${inShop(P) ? '' : 'disabled'}>賣出</button>`;
    } else {
      sellSlot = -1;
      const it = itemById(shopSel), price = priceFor(P, shopSel), total = it.consumable ? it.cost : totalCost(shopSel);
      const into = ITEMS.filter((x) => x.from && x.from.includes(shopSel));
      el.shopDetail.innerHTML = `<div class="dh">${ITEM_ICONS[shopSel]}<div><b>${it.name}</b><small>${it.desc}</small></div></div>`
        + (it.from ? `<div class="tree">${tree(shopSel)}</div>` : '')
        + (into.length ? `<p class="into">可合成：${into.map((x) => `<button type="button" data-pick="${x.id}">${x.name}</button>`).join('、')}</p>` : '')
        + `<p class="price">${price < total ? `已折抵身上的材料，只要付 <em>${price}</em>（總價 ${total}）` : `價格 <em>${price}</em>`}</p>`
        + `<button class="act buyb" type="button" ${canBuy(P, shopSel) ? '' : 'disabled'}>購買</button>`;
    }
    el.shopInv.innerHTML = Array.from({ length: 6 }, (_, i) => { const id = P.inv[i]; return `<button type="button" class="islot${i === sellSlot ? ' sel' : ''}" data-slot="${i}" ${id ? '' : 'disabled'}>${id ? ITEM_ICONS[id] : ''}</button>`; }).join('');
    el.shopGold.textContent = Math.floor(P.gold);
    el.shopHint.textContent = inShop(P) ? '點道具看合成路線，再點一次購買；點自己的道具可賣出' : '回到泉水附近才能購買或賣出';
    el.shopState = shopKey();
  }
  const shopKey = () => player ? `${Math.floor(player.gold / 10)}|${player.inv.join()}|${player.senzu}|${player.controls}|${inShop(player)}|${shopSel}|${sellSlot}` : '';
  function toggleShop(on) {
    const want = on ?? !el.shop.classList.contains('on');
    el.shop.classList.toggle('on', want);
    if (want) { sellSlot = -1; renderShop(); }
  }
  el.shop.addEventListener('click', (e) => {
    if (!player) return;
    const pick = e.target.closest('[data-pick]'), item = e.target.closest('.item'), slot = e.target.closest('.islot');
    if (pick) { shopSel = pick.dataset.pick; sellSlot = -1; }
    else if (item) { if (shopSel === item.dataset.id && sellSlot < 0 && canBuy(player, shopSel)) buy(G, player, shopSel); shopSel = item.dataset.id; sellSlot = -1; }
    else if (slot) sellSlot = +slot.dataset.slot;
    else if (e.target.closest('.buyb')) buy(G, player, shopSel);
    else if (e.target.closest('.sellb')) { sell(G, player, sellSlot); sellSlot = -1; }
    else return;
    renderShop();
  });
  el.shop.addEventListener('pointerdown', (e) => { if (e.target === el.shop) toggleShop(false); });
  $('#shop .shopX').addEventListener('click', () => toggleShop(false));
  el.goldB.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); toggleShop(); });
  el.senzu.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); if (player && G) eatSenzu(G, player); });
  function bindPlayer(h) {
    player = h;
    el.port.src = (touchUI ? portraits : busts)[h.heroId] || ''; el.port._f = 'base';
    el.nmB.textContent = h.def.name; el.nmS.textContent = h.def.en;
    el.invKey = '';
    for (const k of KEYS) {
      const s = el.skills[k]; s.ic.innerHTML = ICONS[h.heroId][k]; s.d.style.setProperty('--el', h.def.color);
      const sd = h.def.skills[k]; s.face.title = `${sd.name}：${sd.desc}`; s.lab.textContent = sd.name;
      s.cost.textContent = sd.ki ? `${sd.ki}` : ''; s.cost.style.display = sd.ki ? '' : 'none';
      s.last = {};
    }
    el.skills.D.lab.textContent = '爆氣'; el.skills.B.lab.textContent = '回城';
    el.skills.D.ic.innerHTML = ICONS.D; el.skills.D.face.title = '爆氣：8 秒內傷害與移速提升並持續回血';
    el.skills.B.ic.innerHTML = ICONS.B; el.skills.B.face.title = '回城：原地 4 秒後回到泉水';
    el.dock.style.setProperty('--el', h.def.color);
    buildRoster();
  }
  function buildRoster() {
    const mk = (h) => `<div class="mate" data-id="${h.id}"><img alt="" src="${portraits[h.heroId] || ''}"><span class="lv">${h.level}</span><b>${h.def.short}</b><i class="bar"><i></i></i><em></em></div>`;
    el.rosterA.innerHTML = G.heroes.filter((h) => h.team === 0 && !h.isPlayer).map(mk).join('');
    el.rosterB.innerHTML = G.heroes.filter((h) => h.team === 1).map(mk).join('');
  }

  /* ---------- 公告、連擊、切入 ---------- */
  let bannerT = 0;
  function announce(text, kind = '', sub = '') {
    el.banner.className = 'on ' + kind; el.banner.innerHTML = `<b>${text}</b>${sub ? `<small>${sub}</small>` : ''}`;
    el.banner.style.animation = 'none'; void el.banner.offsetWidth; el.banner.style.animation = '';
    bannerT = 2.6;
  }
  let cutT = 0;
  function cutin(h, k) {
    const sd = h.def.skills[k];
    el.cutin.className = 'on' + (h.team !== 0 ? ' foe' : '');
    el.cutin.style.setProperty('--el', h.def.color);
    el.cutin.innerHTML = `<img alt="" src="${portraits[h.heroId] || ''}"><div><small>${h.team === 0 ? (h.isPlayer ? '' : '隊友') : '敵方'} ${h.def.name}</small><b>${sd.name}</b></div>`;
    el.cutin.style.animation = 'none'; void el.cutin.offsetWidth; el.cutin.style.animation = '';
    cutT = h.isPlayer ? 1.3 : 1.1;
    if (h.isPlayer) speedT = 1.1;
  }
  let speedT = 0;
  function flash(color = '#fff6dc', dur = 0.25) { el.flash.style.background = color; el.flash.style.transition = 'none'; el.flash.style.opacity = '0.7'; void el.flash.offsetWidth; el.flash.style.transition = `opacity ${dur}s ease-out`; el.flash.style.opacity = '0'; }

  /* ---------- 擊殺卡片（右上，5 秒，最多 3 張） ---------- */
  const feedList = [];
  function feedCard(mine, killerImg, killerName, verb, victimName, victimImg, sub = '') {
    const d = document.createElement('div');
    d.className = 'kf' + (mine ? ' mine' : '') + (victimImg ? '' : ' solo');
    const killerTeam = mine ? player.team : 1 - player.team;
    d.innerHTML = (killerImg ? `<img alt="" src="${killerImg}">` : `<i class="tm t${killerTeam}">${killerTeam ? '赤' : '青'}</i>`) + `<span class="kn"></span><em></em>` + (victimImg ? `<span class="vn"></span><img class="vi" alt="" src="${victimImg}">` : '') + '<small></small>';
    d.querySelector('.kn').textContent = killerName; d.querySelector('em').textContent = verb; if (victimImg) d.querySelector('.vn').textContent = victimName; d.querySelector('small').textContent = sub;
    el.feed.prepend(d); feedList.push({ d, t: 5 });
    while (feedList.length > 3) feedList.shift().d.remove();
  }

  /* ---------- 漫畫對話框 ---------- */
  let quipT = 0, quipCool = 0;
  function quip(h, kind, name = '', force = false) {
    if (!h || (!force && quipCool > 0)) return false;
    const line = quipLine(h.heroId, kind, name); if (!line) return false;
    el.quip.className = 'on' + (player && h.team !== player.team ? ' foe' : '');
    el.qImg.src = busts[h.heroId] || ''; el.qName.textContent = h.def.en; el.qText.textContent = line;
    el.quip.style.animation = 'none'; void el.quip.offsetWidth; el.quip.style.animation = '';
    quipT = 3.4; quipCool = 7; return true;
  }
  const pickAlly = (except) => { const c = G.heroes.filter((x) => x.team === player.team && x.alive && x !== except); return c[Math.floor(Math.random() * c.length)]; };
  // 目標框：玩家鎖定的敵方英雄，否則是最近 4 秒內交手過的敵方英雄
  let foe = null, foeT = -9, greeted = false;

  /* ---------- 浮動數字 ---------- */
  const nums = [];
  function number(x, y, z, text, color, size = 1, kind = '') { nums.push({ x, y, z, text: String(text), color, size, t: 0, kind, ox: (Math.random() - 0.5) * 24 }); if (nums.length > 80) nums.shift(); }

  /* ---------- 事件（每場重新綁定） ---------- */
  function attach(g) {
    G = g; nums.length = 0; for (const f of feedList) f.d.remove(); feedList.length = 0; bannerT = 0; cutT = 0; speedT = 0; el.banner.className = ''; el.cutin.className = '';
    quipT = 0; quipCool = 2; foe = null; foeT = -9; el.quip.className = ''; greeted = false;
    G.on('hit', ({ src, dst }) => { if (!player) return; const o = src === player && dst.kind === 'hero' ? dst : dst === player && src && src.kind === 'hero' ? src : null; if (o && o.team !== player.team) { foe = o; foeT = G.time; } });
  G.on('hit', ({ src, dst, amount, opts }) => {
    if (!player || amount <= 0) return;
    if (src === player) number(dst.x, 2.2 + dst.y, dst.z, amount, opts.type === 'super' ? '#ffd54a' : opts.type === 'skill' ? '#fff0c4' : '#ffffff', opts.type === 'super' ? 1.5 : opts.type === 'H' || opts.type === 'skill' ? 1.15 : 0.9, 'out');
    else if (dst === player) number(dst.x, 2.4, dst.z, amount, '#ff6a4d', 0.9, 'in');
  });
  G.on('levelup', (h) => { if (h === player) { number(h.x, 2.8, h.z, `等級 ${h.level}`, '#ffe08a', 1.2, 'lv'); } });
  G.on('gold', ({ h, g, at }) => { if (h === player && at && g >= 15) number(at.x, 3, at.z, `+${g}`, '#f6c64a', 0.75); });
  G.on('flank', ({ h, foe }) => { if (h.team === player.team && h !== player) announce(`${h.def.short} 繞到敵人背後`, 'good', `包抄 ${foe.def.short}`); });
  G.on('roam', ({ h, to }) => { if (h.team === player.team && to === player) announce(`${h.def.short} 前來支援`, 'good', '從敵人背後切入'); });
  G.on('ambush', ({ team, foe, members }) => { if (team === player.team && !members.includes(player)) announce('隊友在草叢埋伏', 'good', `${members.map((m) => m.def.short).join('、')} 等 ${foe.def.short} 走近`); });
  G.on('ambushStrike', ({ team, foe }) => { if (team === player.team) announce('埋伏出手！', 'good', `包圍 ${foe.def.short}`); else if (foe === player) announce('草叢裡有埋伏！', 'bad'); });
  G.on('wardDeath', ({ u, src }) => { if (src && src === player) number(u.x, 1.6, u.z, '拆眼', '#b8f09a', 0.9); });
  G.on('campSpawn', (c) => { if (c.boss) { announce('大猿出現在河道', 'good', '擊倒牠全隊得到金幣與大猿之力'); if (player) quip(pickAlly(null), 'ape'); } });
  G.on('monsterDeath', ({ u, team }) => { if (u.boss && team >= 0) announce(team === player.team ? '我方擊倒大猿' : '敵方擊倒大猿', team === player.team ? 'good' : 'bad', `大猿之力 ${APE_BUFF.dur} 秒：傷害 +20%`); });
  G.on('immune', ({ dst, src }) => { if (src === player && Math.random() < 0.25) number(dst.x, 4, dst.z, '無法攻擊', '#d9cbb0', 0.8); });
  G.on('herodeath', ({ u, killer, assists = [] }) => {
    if (!player) return;
    const kImg = killer && killer.heroId ? portraits[killer.heroId] : '', kName = killer && killer.def ? killer.def.short : u.team === 0 ? '赤隊' : '青隊';
    feedCard(u.team !== player.team, kImg, kName, G.combo.n >= 6 && killer === player ? '連段擊殺!' : '擊倒!', u.def.short, portraits[u.heroId], assists.length ? `助攻 ${assists.map((a) => a.def.short).join('、')}` : '');
    if (u === player) { el.dead.querySelector('.slain em').textContent = killer && killer.def ? `${killer.def.name} 擊倒了你` : ''; quip(player, 'death', '', true); }
    else if (killer && killer.kind === 'hero' && killer.team === player.team) quip(killer, 'kill', u.def.short);
    else if (u.team === player.team) { if (!quip(pickAlly(u), 'allyDown', u.def.short) && killer && killer.kind === 'hero') quip(killer, 'taunt'); }
    else if (killer === player) announce(G.combo.n >= 6 ? '連段擊殺！' : '擊倒敵方英雄', 'good', `${u.def.name} · ${G.combo.n} HITS`);
    else if (u.team === player.team) announce('隊友被擊倒', 'bad', `${u.def.name}`);
    else announce('敵方英雄被擊倒', 'good', `${u.def.name}`);
  });
  G.on('structure', ({ u, src }) => {
    if (u.kind === 'core') return;
    const sh = src && src.kind === 'hero' ? src : null;
    if (player) feedCard(u.team !== player.team, sh ? portraits[sh.heroId] : '', sh ? sh.def.short : (u.team === 0 ? '赤隊' : '青隊'), '推塔!', '', '', `${['上路', '中路', '下路'][u.lane]}${u.tier === 'outer' ? '外塔' : '內塔'}`);
    const lane = ['上路', '中路', '下路'][u.lane], tier = u.tier === 'outer' ? '外塔' : '內塔';
    announce(u.team === player?.team ? `我方${lane}${tier}被摧毀` : `摧毀敵方${lane}${tier}`, u.team === player?.team ? 'bad' : 'good');
    if (player) quip(pickAlly(null), u.team === player.team ? 'towerLost' : 'towerDown');
  });
  G.on('super', ({ h, k }) => cutin(h, k));
  G.on('dragonBall', ({ team, total, why }) => {
    if (!player) return;
    const mine = team === player.team;
    if (why === 'ape' || total >= 6) announce(`${mine ? '我方' : '敵方'}獲得龍珠`, mine ? 'good' : 'bad', `${total} / ${DRAGON.max} 顆${why === 'ape' ? '（打倒大猿）' : ''}`);
    else if (mine) number(player.x, 3.4, player.z, '+1 龍珠', '#ffc23d', 1);
  });
  G.on('dragonSummon', ({ team }) => {
    const mine = team === player.team;
    announce(`${mine ? '我方' : '敵方'}集齊七顆龍珠！`, mine ? 'good' : 'bad', '神龍即將降臨神龍坑');
    quip(pickAlly(null), 'shenron', '', true);
  });
  G.on('shenronSpawn', () => announce('神龍降臨！', 'good big', '打倒神龍的隊伍可以許願'));
  G.on('dragonWish', ({ team }) => {
    if (team < 0) return;
    const mine = team === player.team;
    announce(mine ? '我方許下願望！' : '敵方許下願望', mine ? 'good' : 'bad', `全隊 ${DRAGON.wish.dur} 秒：傷害 +${DRAGON.wish.dmg * 100}%、移速 +${DRAGON.wish.ms * 100}%，陣亡隊友立即復活`);
    const sp = G.heroes.filter((h) => h.team === team && h.alive); quip(sp[Math.floor(Math.random() * sp.length)], 'wish', '', true);
  });
  G.on('superFire', ({ h }) => { if (h.isPlayer) flash('#fff3d4', 0.35); });
  }

  /* ---------- 每幀 ---------- */
  function setText(e, v) { if (e._v !== v) { e._v = v; e.textContent = v; } }
  function setW(e, k) { const v = Math.max(0, Math.min(1, k)); if (Math.abs((e._w ?? -1) - v) > 0.002) { e._w = v; e.style.transform = `scaleX(${v})`; } }

  function update(dt) {
    if (!player) return;
    const P = player;
    setText(el.clock, fmtT(G.time)); setText(el.k0, G.kills[0]); setText(el.k1, G.kills[1]);
    setText(el.kda, `${P.kills} / ${P.deaths} / ${P.assists}　補兵 ${P.cs}`);
    setText(el.lvl, P.level);
    if (!touchUI && el.port._f !== P.form) { el.port._f = P.form; el.port.src = busts[P.form === 'ssj' && busts[P.heroId + ':ssj'] ? P.heroId + ':ssj' : P.heroId] || ''; }
    setW(el.hpFill, P.hp / P.maxHp); setW(el.shFill, Math.min(1, P.st.shield / P.maxHp));
    setText(el.hpTxt, `${Math.ceil(P.hp)} / ${Math.round(P.maxHp)}`);
    setW(el.xpFill, P.level >= MAX_LEVEL ? 1 : P.xp / xpToNext(P.level));
    const bars = Math.floor(P.ki / KI_BAR), part = (P.ki % KI_BAR) / KI_BAR;
    el.kiCells.forEach((c, i) => setW(c, i < bars ? 1 : i === bars ? part : 0));
    setText(el.kiN, bars);
    el.dock.classList.toggle('kifull', bars >= 5);
    el.dock.classList.toggle('sparking', P.st.spark > 0);
    for (const k of [...KEYS, 'D', 'B']) {
      const s = el.skills[k], L = s.last;
      let cd = P.cds[k], max = k === 'D' ? 90 : k === 'B' ? 1 : P.def.skills[k].cd;
      const learned = k === 'D' || k === 'B' || P.ranks[k] > 0;
      const ready = k === 'D' ? cd <= 0 : k === 'B' ? P.recall <= 0 : skillReady(P, k);
      const noKi = KEYS.includes(k) && P.def.skills[k].ki && P.ki < P.def.skills[k].ki * KI_BAR;
      const st = `${learned}|${ready}|${noKi}|${cd > 0 ? Math.ceil(cd) : 0}`;
      if (L.st !== st) {
        L.st = st;
        s.d.classList.toggle('locked', !learned); s.d.classList.toggle('ready', ready && learned); s.d.classList.toggle('noki', !!noKi && cd <= 0);
        setText(s.cdn, cd > 0 ? Math.ceil(cd) : '');
      }
      const frac = cd > 0 ? cd / max : 0;
      if (Math.abs((L.f ?? -1) - frac) > 0.005) { L.f = frac; s.cd.style.background = frac > 0 ? `conic-gradient(rgba(14,18,30,.78) ${frac * 360}deg, transparent 0)` : 'none'; }
      if (KEYS.includes(k)) {
        const r = P.ranks[k];
        if (L.r !== r) { L.r = r; s.pips.forEach((p, i) => { p.className = i < r ? 'on' : ''; p.style.display = k === 'R' && i > 2 ? 'none' : ''; }); }
        const cl = canLevel(P, k);
        if (L.cl !== cl) { L.cl = cl; s.d.classList.toggle('canlv', cl); }
      }
    }
    setText(el.gold, Math.floor(P.gold));
    const wc = P.cds.T > 0 ? Math.ceil(P.cds.T) : 0;
    if (el.ward._c !== wc) { el.ward._c = wc; el.ward.classList.toggle('cool', wc > 0); el.ward.querySelector('.wcd').textContent = wc || ''; }
    el.bushTag.classList.toggle('on', P.alive && inBush(P) > 0);
    el.dock.classList.toggle('canshop', inShop(P) && ITEMS.some((it) => canBuy(P, it.id)));
    const ik = P.inv.join() + '|' + (P.senzu || 0) + '|' + (P.controls || 0);
    if (el.invKey !== ik) {
      el.invKey = ik;
      el.slots.forEach((sl, i) => { const id = P.inv[i]; sl.innerHTML = id ? ITEM_ICONS[id] : ''; sl.title = id ? ITEMS.find((x) => x.id === id).name : ''; });
      el.senzu.querySelector('b').textContent = P.senzu || 0; el.senzu.classList.toggle('none', !(P.senzu > 0));
      el.control.querySelector('b').textContent = P.controls || 0; el.control.classList.toggle('none', !(P.controls > 0));
    }
    const bk = `${P.apeBuff > 0 ? Math.ceil(P.apeBuff) : 0}|${P.form}|${P.omen > 0 ? Math.ceil(P.omen) : 0}|${P.wish > 0 ? Math.ceil(P.wish) : 0}`;
    if (el.buffs._k !== bk) { el.buffs._k = bk; el.buffs.innerHTML = (P.wish > 0 ? `<span class="wish">神龍的願望 ${Math.ceil(P.wish)}</span>` : '') + (P.omen > 0 ? `<span class="omen">神龍之兆 ${Math.ceil(P.omen)}</span>` : '') + (P.apeBuff > 0 ? `<span class="ape">大猿之力 ${Math.ceil(P.apeBuff)}</span>` : '') + (P.form === 'ssj' ? '<span class="ssj">超級賽亞人</span>' : ''); }
    if (el.shop.classList.contains('on') && el.shopState !== shopKey()) renderShop();
    el.sp.classList.toggle('on', P.sp > 0);
    if (P.sp > 0) setText(el.sp.querySelector('b'), `+${P.sp} 技能點`);
    // 死亡與回城
    el.dead.classList.toggle('on', !P.alive);
    if (!P.alive) setText(el.dead.querySelector('b'), Math.ceil(P.respawn));
    el.recall.classList.toggle('on', P.recall > 0);
    if (P.recall > 0) setW(el.recall.querySelector('i'), 1 - P.recall / 4);
    // 名單
    for (const m of document.querySelectorAll('.mate')) {
      const h = G.heroes.find((x) => x.id === +m.dataset.id); if (!h) continue;
      setText(m.querySelector('.lv'), h.level);
      setW(m.querySelector('.bar i'), h.alive ? h.hp / h.maxHp : 0);
      m.classList.toggle('down', !h.alive);
      setText(m.querySelector('em'), h.alive ? '' : Math.ceil(h.respawn));
    }
    // 連擊數
    const c = G.combo, live = G.time - c.t < 1.6 && c.n >= 2;
    el.combo.classList.toggle('on', live);
    if (live) { if (el.combo._n !== c.n) { el.combo._n = c.n; el.combo.querySelector('b').textContent = c.n; el.combo.querySelector('small').textContent = `${c.dmg} 傷害`; el.combo.classList.remove('pop'); void el.combo.offsetWidth; el.combo.classList.add('pop'); } }
    else el.combo._n = 0;
    // 河道目標計時
    const bc = G.camps && G.camps.find((c) => c.boss);
    if (bc) { const live = bc.mobs.some((m) => m.alive), t = live ? '出現中' : fmtT(Math.max(0, bc.next - G.time)); if (el.apeT._t !== t) { el.apeT._t = t; el.apeT.querySelector('b').textContent = t; el.apeT.classList.toggle('live', live); } }
    // 龍珠獵人
    const D = G.dball;
    if (D) {
      const live = !!(G.shenron && G.shenron.alive), PT = P.team;
      const k = `${D.balls}|${D.cs}|${D.phase}|${live}|${D.phase === 'summon' ? Math.ceil(D.summonAt - G.time) : 0}`;
      if (el.dbh._k !== k) {
        el.dbh._k = k;
        [0, 1].forEach((t) => { const row = el.dbh.querySelector('.t' + t); row.querySelector('.balls').innerHTML = Array.from({ length: DRAGON.max }, (_, i) => `<i${i < D.balls[t] ? ' class="on"' : ''}></i>`).join(''); row.querySelector('small').textContent = `${D.balls[t]}/${DRAGON.max}`; });
        const st = live ? '神龍降臨中' : D.phase === 'summon' ? `召喚中 ${Math.max(0, Math.ceil(D.summonAt - G.time))}` : '收集中';
        el.dbh.querySelector('.st').textContent = st; el.dbh.classList.toggle('live', live || D.phase === 'summon');
        el.dbh.querySelector('.nx').textContent = live ? '到神龍坑搶下最後一擊，打倒神龍的隊伍許願' : D.phase === 'summon' ? `${D.owner === PT ? '我方' : '敵方'}召喚了神龍，準備爭奪神龍坑` : `下一顆：全隊補兵 ${D.cs[PT]}/${DRAGON.perCs}，或打倒大猿得 ${DRAGON.apeBalls} 顆`;
        el.dbT.querySelector('b').textContent = live ? '降臨中' : `${D.balls[PT]}/${DRAGON.max}`; el.dbT.classList.toggle('live', live);
      }
    }
    // 目標框
    let tg = P.target && P.target.kind === 'hero' && P.target.team !== P.team ? P.target : (G.time - foeT < 4 ? foe : null);
    if (tg && (!P.alive || !tg.alive || !seen(G, P.team, tg))) tg = null;
    el.target.classList.toggle('on', !!tg);
    if (tg) {
      if (el.target._id !== tg.id) { el.target._id = tg.id; el.tImg.src = portraits[tg.heroId] || ''; el.tName.textContent = tg.def.en; }
      setW(el.tBar, tg.hp / tg.maxHp); setText(el.tLv, tg.level);
    }
    if (!greeted && G.time > 1.5) { greeted = true; quip(P, 'start', '', true); }
    for (let i = feedList.length - 1; i >= 0; i--) { const f = feedList[i]; f.t -= dt; if (f.t <= 0) { f.d.remove(); feedList.splice(i, 1); } }
    if (quipCool > 0) quipCool -= dt;
    if (quipT > 0) { quipT -= dt; if (quipT <= 0) el.quip.className = ''; }
    if (bannerT > 0) { bannerT -= dt; if (bannerT <= 0) el.banner.className = ''; }
    if (cutT > 0) { cutT -= dt; if (cutT <= 0) el.cutin.className = ''; }
    drawSpeed(dt);
    drawBars(dt);
  }

  function drawSpeed(dt) {
    const [W, H] = render.size;
    if (el.speed.width !== W) { el.speed.width = W; el.speed.height = H; }
    sctx.clearRect(0, 0, W, H);
    if (speedT <= 0) return;
    speedT -= dt;
    const a = Math.min(1, speedT * 3);
    sctx.save(); sctx.translate(W / 2, H / 2);
    sctx.fillStyle = `rgba(255,248,226,${0.55 * a})`;
    const R = Math.hypot(W, H) / 2;
    for (let i = 0; i < 70; i++) {
      const ang = Math.random() * Math.PI * 2, r0 = R * (0.42 + Math.random() * 0.25), w = 0.004 + Math.random() * 0.012;
      sctx.beginPath(); sctx.moveTo(Math.cos(ang) * r0, Math.sin(ang) * r0); sctx.lineTo(Math.cos(ang - w) * R, Math.sin(ang - w) * R); sctx.lineTo(Math.cos(ang + w) * R, Math.sin(ang + w) * R); sctx.closePath(); sctx.fill();
    }
    sctx.restore();
  }

  function drawBars(dt) {
    const [W, H] = render.size, dpr = Math.min(devicePixelRatio, 2);
    if (el.bars.width !== Math.round(W * dpr)) { el.bars.width = Math.round(W * dpr); el.bars.height = Math.round(H * dpr); }
    const g = bctx; g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
    const s = Math.max(0.8, Math.min(1.15, W / 1300));
    for (const u of G.units) {
      if (!u.alive || (player && !seen(G, player.team, u))) continue;
      const top = u.kind === 'hero' ? 2.95 : u.kind === 'minion' ? 1.9 : u.kind === 'ward' ? 1.4 : u.kind === 'monster' ? (u.big ? 6.5 : u.boss ? 7.6 : 2.2) : u.kind === 'core' ? 9 : 8.2;
      const p = render.toScreen(u.x, u.y + top + (u.groundY || 0), u.z);
      if (p.behind || p.x < -60 || p.x > W + 60 || p.y < -40 || p.y > H + 40) continue;
      const ally = player && u.team === player.team;
      const col = u === player ? '#f6c64a' : ally ? '#3fc7a4' : '#e5563a';
      if (u.kind === 'ward') {
        const w = 18 * s, h = 3.5 * s, seg = w / u.maxHp; g.fillStyle = '#10141f'; g.fillRect(p.x - w / 2 - 1, p.y - 1, w + 2, h + 2);
        g.fillStyle = ally ? '#b8f09a' : '#f07a5c'; for (let i = 0; i < u.hp; i++) g.fillRect(p.x - w / 2 + i * seg + 0.5, p.y, seg - 1, h);
        continue;
      }
      if (u.kind === 'monster') {
        if (u.hp >= u.maxHp && !u.boss && !u.big) continue;
        const big = u.boss || u.big, w = (u.big ? 150 : u.boss ? 110 : 38) * s, h = (big ? 8 : 4.5) * s;
        g.fillStyle = '#10141f'; g.fillRect(p.x - w / 2 - 2, p.y - 2, w + 4, h + 4);
        g.fillStyle = '#e8b04a'; g.fillRect(p.x - w / 2, p.y, w * (u.hp / u.maxHp), h);
        if (big) { const nm = u.big ? '神龍' : '大猿'; g.font = `800 ${12 * s}px ${FONT}`; g.textAlign = 'center'; g.lineWidth = 3; g.strokeStyle = '#10141f'; g.strokeText(nm, p.x, p.y - 6 * s); g.fillStyle = '#ffd9a0'; g.fillText(nm, p.x, p.y - 6 * s); }
        continue;
      }
      if (u.kind === 'minion') {
        if (u.hp >= u.maxHp) continue;
        const w = 26 * s, h = 3.5 * s;
        g.fillStyle = '#10141f'; g.fillRect(p.x - w / 2 - 1, p.y - 1, w + 2, h + 2);
        g.fillStyle = ally ? '#7fd9c2' : '#f07a5c'; g.fillRect(p.x - w / 2, p.y, w * (u.hp / u.maxHp), h);
        continue;
      }
      if (u.kind === 'tower' || u.kind === 'core') {
        const w = 70 * s, h = 7 * s;
        g.fillStyle = '#10141f'; g.fillRect(p.x - w / 2 - 2, p.y - 2, w + 4, h + 4);
        g.fillStyle = vulnerable(G, u) ? col : '#8a7e6a'; g.fillRect(p.x - w / 2, p.y, w * (u.hp / u.maxHp), h);
        if (!vulnerable(G, u)) { g.fillStyle = '#e9dcc0'; g.font = `600 ${10 * s}px ${FONT}`; g.textAlign = 'center'; g.fillText('受保護', p.x, p.y - 4 * s); }
        continue;
      }
      // 英雄：等級方塊＋血條＋氣力細條＋名字
      const w = 82 * s, h = 8 * s, x0 = p.x - w / 2 + 8 * s, y0 = p.y;
      g.fillStyle = '#10141f';
      g.beginPath(); g.moveTo(x0 - 18 * s, y0 - 3 * s); g.lineTo(x0 + w + 2 * s, y0 - 3 * s); g.lineTo(x0 + w - 2 * s, y0 + h + 6 * s); g.lineTo(x0 - 22 * s, y0 + h + 6 * s); g.closePath(); g.fill();
      g.fillStyle = '#2b3550'; g.fillRect(x0, y0, w, h);
      g.fillStyle = col; g.fillRect(x0, y0, w * (u.hp / u.maxHp), h);
      if (u.st.shield > 0) { g.fillStyle = 'rgba(240,236,220,.85)'; g.fillRect(x0 + w * (u.hp / u.maxHp), y0, Math.min(w * (1 - u.hp / u.maxHp), w * (u.st.shield / u.maxHp)), h); }
      g.fillStyle = 'rgba(14,18,30,.6)'; for (let i = 1; i < u.maxHp / 250; i++) g.fillRect(x0 + (w * i * 250) / u.maxHp, y0, 1, h * 0.55);
      g.fillStyle = '#ffc23d'; g.fillRect(x0, y0 + h + 1.5 * s, w * (u.ki / 500), 2.5 * s);
      g.fillStyle = '#f3ead8'; g.font = `800 ${11 * s}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(u.level, x0 - 10 * s, y0 + h / 2 + 1.5 * s);
      g.font = `700 ${11 * s}px ${FONT}`; g.textBaseline = 'alphabetic';
      g.lineWidth = 3; g.strokeStyle = '#10141f'; g.strokeText(u.def.short, p.x, y0 - 6 * s); g.fillStyle = ally ? '#f3ead8' : '#ffd8c8'; g.fillText(u.def.short, p.x, y0 - 6 * s);
      if (u.recall > 0) { g.fillStyle = '#9fe6ff'; g.fillRect(x0, y0 - 20 * s, w * (1 - u.recall / 4), 3 * s); }
      if (u.charging) { g.fillStyle = '#ffc23d'; g.font = `800 ${10 * s}px ${FONT}`; g.fillText('集氣', p.x, y0 + h + 18 * s); }
    }
    // 浮動數字
    g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let i = nums.length - 1; i >= 0; i--) {
      const n = nums[i]; n.t += dt;
      const life = n.kind === 'lv' ? 1.4 : 0.9;
      if (n.t > life) { nums.splice(i, 1); continue; }
      const p = render.toScreen(n.x, n.y, n.z);
      const k = n.t / life, pop = n.t < 0.08 ? 1.6 - n.t * 7 : 1;
      const fs = 18 * n.size * s * pop;
      g.font = `italic 900 ${fs}px ${NUMFONT}`;
      g.globalAlpha = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
      const x = p.x + n.ox * k, y = p.y - k * 46 * s;
      g.lineWidth = Math.max(3, fs * 0.22); g.lineJoin = 'round'; g.strokeStyle = '#10141f'; g.strokeText(n.text, x, y);
      g.fillStyle = n.color; g.fillText(n.text, x, y);
    }
    g.globalAlpha = 1;
  }

  return { update, attach, bindPlayer, announce, number, flash, cutin, quip, el, toggleShop };
}
export const FONT = '"PingFang TC","Noto Sans TC","Microsoft JhengHei",system-ui,sans-serif';
export const NUMFONT = '"Avenir Next Condensed","Bahnschrift","Arial Narrow","PingFang TC",system-ui,sans-serif';

/* ---------------- 選角畫面 ---------------- */
export function createSelect({ portraits, onPick, onStart }) {
  const wrap = $('#select'), cards = $('#cards'), info = $('#pickInfo');
  let cur = 'goku', lane = 1, diff = 1;
  cards.innerHTML = HERO_ORDER.map((id) => { const d = HEROES[id]; return `<button class="card" type="button" data-id="${id}" style="--el:${d.color}"><img alt="" src="${portraits[id] || ''}"><b>${d.short}</b><small>${d.en}</small><em>${d.role}</em></button>`; }).join('');
  function show(id) {
    cur = id; const d = HEROES[id];
    for (const c of cards.children) c.classList.toggle('sel', c.dataset.id === id);
    info.style.setProperty('--el', d.color);
    info.innerHTML = `<h2><b>${d.name}</b><span>${d.en} · ${d.role}</span></h2><p>${d.blurb}</p><ul>${KEYS.map((k) => `<li><i>${ICONS[id][k]}</i><kbd>${k}</kbd><div><b>${d.skills[k].name}</b><span>${d.skills[k].desc}</span></div></li>`).join('')}</ul>`;
    onPick(id);
  }
  cards.addEventListener('click', (e) => { const c = e.target.closest('.card'); if (c) show(c.dataset.id); });
  for (const b of document.querySelectorAll('#laneSel button')) b.addEventListener('click', () => { lane = +b.dataset.lane; for (const o of document.querySelectorAll('#laneSel button')) o.classList.toggle('sel', o === b); });
  for (const b of document.querySelectorAll('#diffSel button')) b.addEventListener('click', () => { diff = +b.dataset.d; for (const o of document.querySelectorAll('#diffSel button')) o.classList.toggle('sel', o === b); });
  $('#go').addEventListener('click', () => onStart(cur, lane, diff));
  show(cur);
  return { show: () => { wrap.classList.add('on'); }, hide: () => wrap.classList.remove('on'), get cur() { return cur; }, pick: show };
}

/* ---------------- 結算 ---------------- */
export function showEnd(G, portraits, onAgain) {
  const wrap = $('#end'), P = G.player, win = G.winner === P.team;
  wrap.className = 'on ' + (win ? 'win' : 'lose');
  const row = (h) => `<tr class="${h.isPlayer ? 'me' : ''} t${h.team}"><td><img alt="" src="${portraits[h.heroId] || ''}">${h.def.name}${h.isPlayer ? '（你）' : ''}</td><td>${h.level}</td><td>${h.kills} / ${h.deaths} / ${h.assists}</td><td>${h.cs}</td></tr>`;
  $('#endTitle').textContent = win ? '勝利' : '敗北';
  $('#endSub').textContent = `${win ? '摧毀了赤隊主堡' : '青隊主堡被摧毀'} · ${Math.floor(G.time / 60)} 分 ${Math.floor(G.time % 60)} 秒 · 擊倒 ${G.kills[0]} : ${G.kills[1]}`;
  $('#endTable').innerHTML = `<thead><tr><th>英雄</th><th>等級</th><th>擊倒 / 陣亡 / 助攻</th><th>補兵</th></tr></thead><tbody>${G.heroes.slice().sort((a, b) => a.team - b.team).map(row).join('')}</tbody>`;
  $('#again').onclick = onAgain;
}
