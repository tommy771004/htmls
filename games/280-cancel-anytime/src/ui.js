// DOM 介面：先攻條、通緝令隊伍面板、骰盤＋收據紀錄、技能熱鍵列、懸停偵測卡、各種對話框，以及轉場與互動回饋。
import { HEROES, HERO_ORDER, LAYER_LABEL, LOOT, POWERS, STATUSES, COMMON, LEVELS } from './data.js';
import * as R from './rules.js';
import { STATUS_ICON } from './view.js';
import { SFX } from './audio.js';

const $ = (sel, root = document) => root.querySelector(sel);
const esc = (t) => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
export { $, esc };

// 重新觸發 CSS 動畫
const replay = (el, cls) => { if (!el) return; el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); };
const vibrate = (p) => { try { if (navigator.vibrate && navigator.userActivation && navigator.userActivation.hasBeenActive) navigator.vibrate(p); } catch (e) { /* 不支援 */ } };

export function createUI(V, game) {
  const portraits = new Map();
  const portrait = (key) => {
    if (!portraits.has(key)) { try { portraits.set(key, V.portrait(key)); } catch (e) { portraits.set(key, ''); } }
    return portraits.get(key);
  };
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const UI = { portrait, reducedMotion: RM };
  const logEl = $('#log'), ribbon = $('#ribbon'), party = $('#party');

  // ── 演出速度：CSS 的 --spd = 1/速度 ──
  UI.syncSpeed = () => { document.documentElement.style.setProperty('--spd', String(1 / (V.speed || 1))); };
  UI.syncSpeed();

  // ── 可跳過的等待：點擊或按鍵呼叫 UI.skipNow() 會讓所有等待立刻結束 ──
  // skipping：按一下就略過整段轉場（之後的等待也立刻結束，直到下一段轉場開始）
  const skippers = new Set();
  let skipping = false;
  UI.resetSkip = () => { skipping = false; };
  UI.swait = (ms) => skipping ? Promise.resolve() : new Promise(res => {
    const done = () => { clearTimeout(t); skippers.delete(done); res(); };
    const t = setTimeout(done, (RM ? ms * 0.4 : ms) / (V.speed || 1));
    skippers.add(done);
  });
  UI.skipNow = () => { if (!skippers.size) return; skipping = true; for (const f of [...skippers]) f(); };
  UI.canSkip = () => skippers.size > 0;

  // ── 紀錄（收據）──
  UI.log = (text, cls = '') => {
    const p = document.createElement('p');
    p.className = cls;
    p.textContent = text;
    logEl.appendChild(p);
    while (logEl.children.length > 80) logEl.firstChild.remove();
    logEl.scrollTop = logEl.scrollHeight;
    if (cls === 'react') UI.toast('CHAIN REACTION', text);
  };
  UI.clearLog = () => { logEl.innerHTML = ''; };

  // ── 連鎖反應浮動通知 ──
  const toasts = $('#toasts');
  UI.toast = (tag, text) => {
    while (toasts.children.length >= 3) toasts.firstChild.remove();
    const t = document.createElement('div');
    t.className = 'toast';
    t.innerHTML = `<i>${esc(tag)}</i><span>${esc(text)}</span>`;
    toasts.appendChild(t);
    SFX.play('notify');
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 320 / V.speed); }, 2400 / V.speed);
  };

  // ── 英雄受傷：畫面邊緣紅光 ──
  const vig = $('#vig');
  UI.vignette = (big) => { vig.classList.toggle('crit', !!big); replay(vig, 'hit'); };

  // ── 回合橫幅 ──
  UI.round = (n) => {
    $('#roundN').textContent = n;
    replay($('#shield'), 'bump');
    UI.banner(`ROUND ${n}`, 'round');
    SFX.play('round');
  };
  UI.banner = (text, cls = '') => {
    const b = $('#banner');
    b.className = 'show ' + cls;
    b.textContent = text;
    clearTimeout(UI._bt);
    UI._bt = setTimeout(() => { b.className = ''; }, 1300 / V.speed);
  };
  // 大型斜紋橫幅：YOUR TURN · 名字／ENEMY TURN
  const tb = $('#turnBan');
  UI.turnBanner = (side, title, name, color) => {
    tb.className = side === 'hero' ? 'hero' : 'foe';
    tb.style.setProperty('--tc', side === 'hero' ? (color || '#ffc531') : '#e23b2e');
    tb.querySelector('b').textContent = title;
    const sp = tb.querySelector('span');
    sp.textContent = name || '';
    sp.hidden = !name;
    replay(tb, 'go');
    clearTimeout(UI._tbt);
    UI._tbt = setTimeout(() => tb.classList.remove('go'), 1300 / V.speed);
  };

  // ── 骰盤 ──
  const dieEl = $('#die'), formula = $('#formula'), verdict = $('#verdict'), dicebox = $('#dicebox');
  const sparks = (n, chars) => {
    for (let i = 0; i < n; i++) {
      const sp = document.createElement('i');
      sp.className = 'spark';
      sp.textContent = chars[i % chars.length];
      const a = (i / n) * Math.PI * 2;
      sp.style.setProperty('--sx', Math.cos(a) * 60 + 'px');
      sp.style.setProperty('--sy', Math.sin(a) * 46 + 'px');
      dicebox.appendChild(sp);
      setTimeout(() => sp.remove(), 900);
    }
  };
  const countUp = (el, from, to, ms) => {
    if (!el) return;
    const t0 = performance.now();
    const tick = () => {
      const k = Math.min(1, (performance.now() - t0) / (ms / V.speed));
      el.textContent = Math.round(from + (to - from) * k);
      if (k < 1) requestAnimationFrame(tick);
    };
    tick();
  };
  UI.showRoll = async (e, opts = {}) => {
    const s = game.s;
    const who = R.unitById(s, e.who);
    const mine = who && who.side === 'hero';
    $('#tray').classList.add('rolling');
    dicebox.classList.remove('crit', 'fumble');
    dieEl.classList.remove('land');
    verdict.classList.remove('pop');
    SFX.play('dice');
    const spin = (mine ? 560 : 320) / V.speed;
    const t0 = performance.now();
    // 翻滾：骰子在毛氈上彈跳、翻面
    await new Promise(res => {
      const tick = () => {
        const k = (performance.now() - t0) / spin;
        if (k >= 1) return res();
        dieEl.querySelector('text').textContent = 1 + Math.floor(Math.random() * 20);
        const hop = Math.abs(Math.sin(k * Math.PI * 3)) * (1 - k) * 14;
        dieEl.style.transform = `translate(${Math.sin(k * Math.PI * 2) * 8 * (1 - k)}px,${-hop}px) rotate(${k * 600}deg) scale(${1 + Math.sin(k * Math.PI) * 0.22},${1 + Math.sin(k * Math.PI) * 0.22 - hop * 0.004})`;
        requestAnimationFrame(tick);
      };
      tick();
    });
    dieEl.style.transform = '';
    dieEl.querySelector('text').textContent = e.d20;
    dieEl.classList.toggle('nat20', e.d20 === 20);
    dieEl.classList.toggle('nat1', e.d20 === 1);
    replay(dieEl, 'land');
    $('#tray').classList.remove('rolling');
    const parts = (e.parts || []).map(([l, v]) => `<span>${esc(l)} <b>${v >= 0 ? '+' : '−'}${Math.abs(v)}</b></span>`).join(' ');
    const acs = (e.acParts || []).length > 1 ? ' <small>(' + e.acParts.map(([l, v]) => `${esc(l)} ${v}`).join(' ') + ')</small>' : '';
    formula.innerHTML = `<em>${esc(who ? (who.side === 'hero' ? HEROES[who.key].name : who.name) : '')}</em> · ${esc(e.label)}<br>d20(<b>${e.d20}</b>) ${parts} = <b class="tot">${e.d20}</b> vs ${e.label === '死亡豁免' ? 'DC' : '對抗'} <b>${e.ac}</b>${acs}`;
    countUp(formula.querySelector('.tot'), e.d20, e.total, 260);
    let v, cls;
    if (e.label === '死亡豁免') { v = e.hit ? '💪 撐住了' : '💀 病情惡化'; cls = e.hit ? 'hit' : 'miss'; }
    else if (e.fumble) { v = '🤡 EMOTIONAL DAMAGE!'; cls = 'fumble'; }
    else if (e.crit) { v = '🦅 FREEDOM CRIT! 200% STONKS!'; cls = 'crit'; }
    else if (e.hit) { v = e.label.includes('推撞') ? '🏈 推飛成功' : '✅ FREEDOM HIT!'; cls = 'hit'; }
    else { v = e.label.includes('推撞') ? '🧱 紋風不動' : '❌ 閃過'; cls = 'miss'; }
    verdict.className = cls + ' pop'; verdict.textContent = v;
    if (cls === 'crit' && !opts.noWait) { dicebox.classList.add('crit'); sparks(10, ['★', '🦅', '✦']); if (mine) vibrate([30, 40, 70]); }
    else if (cls === 'fumble' && !opts.noWait) { dicebox.classList.add('fumble'); sparks(6, ['🤡', '💧']); }
    if (opts.noWait) return;
    await V.wait(mine ? 440 : 250);
  };
  // 小費重擲提示，回傳 true = 付小費
  UI.askTip = (info) => new Promise(res => {
    const box = $('#tipAsk');
    box.innerHTML = `<p>${esc(info)}</p><div><button class="b tip">💵 付小費給 DM 重擲（剩 ${game.s.party.tips}）</button><button class="b ghost">算了</button></div>`;
    box.hidden = false;
    // 手機上紀錄面板平常收著：問的時候打開（只露出骰子和這個提示），問完恢復原狀，不要蓋住棋盤
    const tray = $('#tray'), was = tray.classList.contains('open');
    tray.classList.add('open', 'asking');
    const done = (v) => { box.hidden = true; tray.classList.remove('asking'); if (!was) tray.classList.remove('open'); res(v); };
    box.querySelector('.tip').onclick = () => { SFX.play('refund'); done(true); };
    box.querySelector('.ghost').onclick = () => done(false);
    box.querySelector('.tip').focus({ preventScroll: true });
  });

  // ── 先攻條（FLIP：重排時每顆星滑到新位置）──
  let ribbonHtml = '';
  UI.ribbon = () => {
    const s = game.s;
    if (!s || !s.order.length) { ribbon.innerHTML = ''; ribbonHtml = ''; return; }
    const n = s.order.length;
    let html = '';
    for (let i = 0; i < n; i++) {
      const id = s.order[(s.turn + i) % n];
      const u = R.unitById(s, id);
      if (!u || !R.alive(u)) continue;
      const key = u.transformed ? 'lizard2' : u.key;
      const cls = (u.side === 'hero' ? 'hero' : 'foe') + (i === 0 ? ' now' : '') + (u.downed ? ' down' : '') + (u.boss ? ' boss' : '') + (u.st.intern ? ' intern' : '');
      const col = u.side === 'hero' ? HEROES[u.key].color : '#ff4a5a';
      html += `<button class="star ${cls}" data-id="${esc(u.id)}" title="${esc(u.side === 'hero' ? HEROES[u.key].name : u.name)}（先攻 ${u.init}）" style="--c:${col}">
        <span class="sp"><img alt="" src="${portrait(key)}"></span><i class="ini">${u.init}</i><i class="hb"><i style="width:${Math.max(0, u.hp / u.maxHp * 100)}%"></i></i></button>`;
    }
    if (html === ribbonHtml) return;
    const first = ribbonHtml === '';
    ribbonHtml = html;
    const old = new Map();
    for (const b of ribbon.querySelectorAll('.star')) old.set(b.dataset.id, b.getBoundingClientRect().left);
    ribbon.innerHTML = html;
    if (first || RM) return;
    for (const b of ribbon.querySelectorAll('.star')) {
      const x0 = old.get(b.dataset.id);
      if (x0 == null) { b.classList.add('new'); continue; }
      const dx = x0 - b.getBoundingClientRect().left;
      if (Math.abs(dx) < 1) continue;
      b.style.transition = 'none';
      b.style.transform = `translateX(${dx}px)`;
      requestAnimationFrame(() => requestAnimationFrame(() => { b.style.transition = ''; b.style.transform = ''; }));
    }
  };
  const focusUnit = (u) => {
    if (!u) return;
    if (typeof V.focusUnit === 'function') V.focusUnit(u.id, { smooth: true });
    else V.focus(u.x, u.z);
  };
  ribbon.addEventListener('click', e => {
    const b = e.target.closest('.star');
    if (!b) return;
    const u = R.unitById(game.s, b.dataset.id);
    if (u) { focusUnit(u); SFX.play('hover'); }
  });
  // 滑過先攻條或通緝令 → 棋盤上的單位也亮起來
  const boardHover = (id) => { if (typeof V.hover === 'function') { try { V.hover(id); } catch (e) { /* 視圖尚未支援 */ } } };
  UI.boardHover = boardHover;
  for (const [el, sel] of [[ribbon, '.star'], [party, '.poster']]) {
    el.addEventListener('pointerover', e => { const b = e.target.closest(sel); if (b && e.pointerType !== 'touch') boardHover(b.dataset.id); });
    el.addEventListener('pointerout', e => { const b = e.target.closest(sel); if (b && !b.contains(e.relatedTarget)) boardHover(null); });
  }

  // ── 通緝令隊伍面板 ──
  let partyHtml = '', partyState = null;
  const lastHp = new Map();
  UI.party = () => {
    const s = game.s;
    if (!s) return;
    if (partyState !== s) { partyState = s; lastHp.clear(); }
    const cur = R.current(s);
    const hurt = [];
    const html = HERO_ORDER.map(k => {
      const u = R.unitById(s, k), H = HEROES[k];
      const prev = lastHp.get(k);
      if (prev != null && u.hp < prev) hurt.push([k, prev - u.hp, u.maxHp]);
      lastHp.set(k, u.hp);
      const h = s.grid[u.z] ? s.grid[u.z][u.x].h : 0;
      const loot = s.party.loot.filter(l => LOOT[l].who === k).map(l => `<i title="${esc(LOOT[l].name)}：${esc(LOOT[l].text)}">${LOOT[l].icon}</i>`).join('');
      const chip = s.party.chips[k] ? `<i class="chip${s.powerUsed[k] ? ' used' : ''}" title="5G 晶片：${esc(POWERS[s.party.chips[k]].name)}">🧠</i>` : '';
      const sts = Object.keys(u.st).map(st => `<i title="${esc(STATUSES[st] ? STATUSES[st].name + '：' + STATUSES[st].note : st)}">${STATUS_ICON[st] || ''}</i>`).join('');
      const slots = Array.from({ length: u.maxSlots }, (_, i) => `<i class="${i < u.slots ? 'on' : ''}"></i>`).join('');
      let state = '';
      if (u.gone) state = `<p class="gone">🚑 被救護車載走<br><b>$50,000 USD</b></p>`;
      else if (u.downed) state = `<p class="saves">🚑 死亡豁免 <span>${'✔'.repeat(u.saves.s)}${'·'.repeat(3 - u.saves.s)}</span> <span class="f">${'✘'.repeat(Math.min(3, u.saves.f))}${'·'.repeat(Math.max(0, 3 - u.saves.f))}</span></p>`;
      return `<div class="poster${cur && cur.id === k ? ' now' : ''}${u.downed ? ' down' : ''}${u.gone ? ' gone' : ''}" data-id="${k}" style="--c:${H.color}">
        <div class="ph"><img alt="" src="${portrait(k)}"></div>
        <div class="pi"><b>${esc(H.name)}</b><span class="ac" title="護甲等級">🛡️${u.ac}</span>${h > 0 ? `<span class="ht">⛰️${LAYER_LABEL[h]}</span>` : ''}
        <i class="bar"><i style="width:${u.hp / u.maxHp * 100}%"></i><em>${u.hp}/${u.maxHp}</em></i>
        <span class="slots" title="${esc(H.slotName)}">${slots}</span><span class="ic">${chip}${loot}${sts}</span>${state}</div></div>`;
    }).join('');
    if (html !== partyHtml) { partyHtml = html; party.innerHTML = html; }
    if (hurt.length) {
      let big = false;
      for (const [k, amt, max] of hurt) { replay(party.querySelector(`.poster[data-id="${k}"]`), 'hurt'); if (amt >= max * 0.3) big = true; }
      UI.vignette(big);
      vibrate(big ? [40, 30, 40] : 25);
    }
  };
  party.addEventListener('click', e => {
    const p = e.target.closest('.poster');
    if (!p) return;
    const u = R.unitById(game.s, p.dataset.id);
    if (u && R.alive(u)) { focusUnit(u); SFX.play('hover'); }
  });

  // ── 熱鍵列 ──
  const skillsEl = $('#skills'), whoEl = $('#who'), resEl = $('#res'), hotbar = $('#hotbar'), skTip = $('#skTip');
  let skHtml = '', whoHtml = '', resHtml = '', hotToken = '', lastRes = null;
  const skInfo = new Map();
  const setHtml = (el, html, prev) => { if (html !== prev) el.innerHTML = html; return html; };
  UI.hotbar = () => {
    const s = game.s;
    const u = s && R.current(s);
    const mine = u && u.side === 'hero' && game.playerTurn;
    hotbar.classList.toggle('idle', !mine);
    if (!u) { whoHtml = setHtml(whoEl, '', whoHtml); return; }
    const H = u.side === 'hero' ? HEROES[u.key] : null;
    // 換人時：頭像轉入、技能鍵依序彈出
    const token = u.id + ':' + s.round;
    const fresh = token !== hotToken;
    hotToken = token;
    // 技能鍵：輪到我方、而且這回合還沒彈過才彈出
    const skFresh = mine && token !== UI._skTok;
    if (skFresh) UI._skTok = token;
    whoHtml = setHtml(whoEl, `<img alt="" src="${portrait(u.transformed ? 'lizard2' : u.key)}"><div><b>${esc(H ? H.name : u.name)}</b><small>${esc(H ? H.title : (u.boss ? '首領' : '敵人') + (mine ? '' : '・行動中'))}</small>
      <i class="bar${u.downed ? ' down' : ''}"><i style="width:${u.hp / u.maxHp * 100}%"></i><em>${u.hp}/${u.maxHp}</em></i></div>`, whoHtml);
    if (fresh && !RM) { replay(hotbar, 'turnIn'); clearTimeout(UI._hti); UI._hti = setTimeout(() => hotbar.classList.remove('turnIn'), 700 / V.speed); }
    if (!mine) {
      resHtml = setHtml(resEl, `<span class="wait">${esc(u.side === 'hero' ? '' : '敵方回合……')}</span>`, resHtml);
      skHtml = setHtml(skillsEl, '', skHtml);
      skTip.hidden = true;
      $('#endBtn').disabled = true;
      lastRes = null;
      return;
    }
    $('#endBtn').disabled = false;
    const pw = s.party.chips[u.key];
    const pwOk = R.canUse(s, u, 'power').ok;
    resHtml = setHtml(resEl, `<span class="pip act ${u.action ? 'on' : ''}" data-r="act" title="主要動作">●</span><span class="pip bon ${u.bonus ? 'on' : ''}" data-r="bon" title="附贈動作">▲</span>
      <span class="slots" data-r="slots" title="${esc(H.slotName)}">${Array.from({ length: u.maxSlots }, (_, i) => `<i class="${i < u.slots ? 'on' : ''}"></i>`).join('')}</span>
      <span class="pip pw ${pwOk ? 'on' : ''}" data-r="pw" title="5G 晶片${pw ? '：' + esc(POWERS[pw].name) : ''}">🧠</span>
      <span class="mv" data-r="mv" title="剩餘移動格數">🥾 ${u.moveLeft}</span><span class="tips" data-r="tips" title="小費點數（可重擲 D20）">💵 ${s.party.tips}</span><span class="tips" data-r="mentos" title="曼陀珠手榴彈">🍬 ${s.mentos}</span>`, resHtml);
    // 資源變動：花掉的縮放淡出、新增的彈出
    const cur = { id: u.id, act: +!!u.action, bon: +!!u.bonus, slots: u.slots, pw: +pwOk, mv: u.moveLeft, tips: s.party.tips, mentos: s.mentos };
    if (lastRes && lastRes.id === u.id && !RM) {
      for (const k of ['act', 'bon', 'slots', 'pw', 'mv', 'tips', 'mentos']) {
        if (cur[k] === lastRes[k]) continue;
        replay(resEl.querySelector(`[data-r="${k}"]`), cur[k] < lastRes[k] ? 'spend' : 'gain');
      }
    }
    lastRes = cur;
    const list = [['move', '1', '🥾', '移動', `剩 ${u.moveLeft} 格`]];
    const keys = { melee: '2', ranged: '3', aoe: '4', bonus: '5', shove: '6' };
    for (const sk of ['melee', 'ranged', 'aoe', 'bonus', 'shove']) {
      const S = R.skillDef(u, sk);
      list.push([sk, keys[sk], S.icon, (SHORT[u.key] && SHORT[u.key][sk]) || SHORT.common[sk] || S.name, skillMeta(u, sk, S)]);
    }
    const extra = [['yeet', 'Y'], ['help', 'H'], ['mentos', 'M'], ['power', 'G']];
    if (s.L.center) extra.push(['valve', 'V']);
    if (s.L.throne) extra.push(['cancel', 'X']);
    extra.push(['rest', 'R']);
    for (const [sk, k] of extra) {
      if (sk === 'power') {
        const p = pw && !s.powerUsed[u.key] && pw !== 'refund' ? POWERS[pw] : (s.party.droneCharges ? POWERS.drone : (pw ? POWERS[pw] : null));
        list.push([sk, k, '🧠', p ? p.name.split('・').pop().slice(0, 6) : '5G 晶片', p ? (pw === 'refund' ? '自動觸發' : '不耗動作・每關 1 次') : '尚未取得', p]);
      } else if (sk === 'rest') list.push([sk, k, '🍔', '得來速短休', '全隊回 50%・每關 1 次']);
      else { const S = COMMON[sk]; list.push([sk, k, S.icon, SHORT.common[sk] || S.name, sk === 'mentos' ? `剩 ${s.mentos} 顆` : (S.cost === 'bonus' ? '附贈動作' : '主要動作')]); }
    }
    skInfo.clear();
    const html = list.map(([sk, k, icon, name, meta, P], i) => {
      const c = sk === 'move' ? { ok: u.moveLeft > 0, why: '沒有移動力了' } : R.canUse(s, u, sk);
      const S = sk === 'move' ? null : R.skillDef(u, sk);
      skInfo.set(sk, { sk, k, icon, name, meta, S, P, c, u });
      const cost = S ? (S.cost === 'action' ? '<i class="c act">●</i>' : S.cost === 'bonus' ? '<i class="c bon">▲</i>' : '') + (S.slot ? '<i class="c slot">■</i>' : '') : '';
      return `<button class="sk${game.sel === sk ? ' sel' : ''}${c.ok ? '' : ' off'}${i >= 6 ? ' ex' : ''}" data-sk="${sk}" style="--i:${i}" aria-label="${esc(S && S.name ? S.name : name)}${c.ok ? '' : '（' + esc(c.why) + '）'}">
        <kbd>${k}</kbd><span class="ico">${icon}</span><span class="nm">${esc(name)}</span><small>${esc(meta)}</small>${cost}</button>`;
    }).join('');
    if (html !== skHtml) {
      skHtml = html;
      skillsEl.innerHTML = html;
      if (tipSk) showTip(skillsEl.querySelector(`[data-sk="${tipSk}"]`));
    }
    if (skFresh && !RM) { skillsEl.classList.remove('enter'); void skillsEl.offsetWidth; skillsEl.classList.add('enter'); clearTimeout(UI._ski); UI._ski = setTimeout(() => skillsEl.classList.remove('enter'), 900 / V.speed); }
  };
  const SHORT = {
    chad: { melee: '槓鈴重劈', ranged: '壺鈴投擲', aoe: '泰山壓頂', bonus: '乾吞肌酸' },
    karen: { melee: '冰霸杯說服', ranged: '叫經理出來', aoe: '一星負評', bonus: '精油芳療' },
    dale: { melee: '鱷魚咬擊', ranged: '沖天炮', aoe: '核爆火球', bonus: '鱷魚瞬移' },
    doge: { melee: '跑路背刺', ranged: 'NFT 飛鏢', aoe: '電子菸毒霧', bonus: 'VPN 潛行' },
    common: { shove: '擒抱推撞', yeet: 'YEET', help: '扶我起來', mentos: '曼陀珠', valve: '啟動肉錘', cancel: '取消訂閱' },
  };
  function skillMeta(u, sk, S) {
    const r = R.skillRange(u, sk);
    const bits = [];
    if (S.dice) bits.push(S.dice);
    if (S.hit) bits.push('+' + S.hit);
    if (r && S.kind !== 'selfheal') bits.push(r + ' 格');
    if (S.radius) bits.push('半徑 ' + S.radius);
    return bits.join('・');
  }
  // 技能提示卡（滑鼠才顯示；手機看按鈕本身）
  let tipSk = null;
  function showTip(btn) {
    const info = btn && skInfo.get(btn.dataset.sk);
    if (!info) { skTip.hidden = true; tipSk = null; return; }
    tipSk = info.sk;
    const { S, P, c, u, k, icon, name } = info;
    const D = P || S;
    const kv = [];
    if (info.sk === 'move') kv.push(`🥾 剩 ${u.moveLeft} 格`);
    if (D && D.dice) kv.push('🎲 ' + D.dice);
    if (D && D.hit) kv.push('命中 +' + D.hit);
    const r = info.sk === 'power' ? (P && P.range) : (S ? R.skillRange(u, info.sk) : 0);
    if (r && !(S && S.kind === 'selfheal')) kv.push('📏 ' + r + ' 格');
    if (D && D.radius) kv.push('💥 半徑 ' + D.radius);
    if (S && S.cost === 'action') kv.push('● 主要動作');
    if (S && S.cost === 'bonus') kv.push('▲ 附贈動作');
    if (S && S.slot) kv.push('■ 法術位');
    if (S && S.type) kv.push(S.type);
    const text = info.sk === 'move' ? '點藍色格子移動；離開敵人身邊會吃借機攻擊。' : info.sk === 'rest' ? '得來速短休：全隊回復 50% 生命，消耗主要動作，每關 1 次。' : (D && D.text) || '';
    skTip.innerHTML = `<h5><span>${icon}</span>${esc(D && D.name ? D.name : name)}<kbd>${esc(k)}</kbd></h5>${kv.length ? `<p class="kv">${kv.map(x => `<span>${esc(x)}</span>`).join('')}</p>` : ''}<p>${esc(text)}</p>${c.ok ? '' : `<p class="why">🚫 ${esc(c.why || '現在不能用')}</p>`}`;
    skTip.hidden = false;
    const br = btn.getBoundingClientRect(), tr = skTip.getBoundingClientRect();
    skTip.style.left = Math.max(8, Math.min(innerWidth - tr.width - 8, br.left + br.width / 2 - tr.width / 2)) + 'px';
    skTip.style.top = Math.max(8, br.top - tr.height - 10) + 'px';
  }
  skillsEl.addEventListener('pointerover', e => {
    if (e.pointerType === 'touch') return;
    const b = e.target.closest('.sk');
    if (b && b.dataset.sk !== tipSk) { showTip(b); SFX.play('hover'); }
  });
  skillsEl.addEventListener('pointerleave', () => { skTip.hidden = true; tipSk = null; });
  skillsEl.addEventListener('focusin', e => { const b = e.target.closest('.sk'); if (b && b.matches(':focus-visible')) showTip(b); });
  skillsEl.addEventListener('focusout', () => { skTip.hidden = true; tipSk = null; });
  skillsEl.addEventListener('click', e => {
    const b = e.target.closest('.sk');
    if (b) game.selectSkill(b.dataset.sk);
  });
  // 不能用的技能：搖一下
  UI.shakeSkill = (sk) => {
    const b = skillsEl.querySelector(`[data-sk="${sk}"]`);
    if (!b) return;
    replay(b, 'shake');
    setTimeout(() => b.classList.remove('shake'), 400);
  };

  // ── 懸停偵測卡 ──
  const insp = $('#inspect');
  UI.inspect = (html, x, y) => {
    if (!html) { insp.hidden = true; insp.classList.remove('in'); return; }
    const wasHidden = insp.hidden;
    if (insp._h !== html || wasHidden) { insp.innerHTML = html; insp._h = html; }
    insp.hidden = false;
    if (wasHidden && !RM) replay(insp, 'in');
    const r = insp.getBoundingClientRect();
    const mobile = innerWidth < 700;
    if (mobile) { insp.style.left = '8px'; insp.style.top = ''; insp.style.right = '8px'; return; }
    insp.style.right = '';
    insp.style.left = Math.min(innerWidth - r.width - 8, x + 18) + 'px';
    insp.style.top = Math.min(innerHeight - r.height - 8, Math.max(8, y - r.height / 2)) + 'px';
  };

  UI.refresh = () => { UI.party(); UI.ribbon(); UI.hotbar(); V.updatePlates(); };

  // ── 對話框（進場：卡片彈出、內容依序升起；退場：縮小淡出）──
  const modal = $('#modal');
  let closeT = 0;
  UI.modal = (html, cls = '') => {
    clearTimeout(closeT);
    modal.className = 'show ' + cls;
    modal.innerHTML = `<div class="card">${html}</div>`;
    const card = modal.firstChild;
    // 主要按鈕取得焦點（鍵盤可直接 Enter）
    requestAnimationFrame(() => { const b = card.querySelector('.row .b:not(.ghost):not(:disabled)'); if (b && modal.contains(b) && !game.auto) b.focus({ preventScroll: true }); });
    return card;
  };
  UI.closeModal = () => {
    if (!modal.classList.contains('show')) { modal.className = ''; modal.innerHTML = ''; return; }
    if (RM || modal.classList.contains('out')) { clearTimeout(closeT); modal.className = ''; modal.innerHTML = ''; return; }
    modal.classList.add('out');
    clearTimeout(closeT);
    closeT = setTimeout(() => { modal.className = ''; modal.innerHTML = ''; }, 190);
  };
  // after(card)：卡片建好後的額外演出（例如蓋印章）
  UI.choose = (html, cls, after) => new Promise(res => {
    const card = UI.modal(html, cls);
    if (after) after(card);
    card.addEventListener('click', e => {
      const b = e.target.closest('[data-v]');
      if (!b) return;
      if (b.disabled) { replay(b, 'shake'); return; }
      SFX.play('click');
      res(b.dataset.v);
    });
  });
  // 收據印章：等列印完才蓋下去
  UI.stamp = (card, text, ok, delay) => {
    const host = card && (card.querySelector('.receipt') || card);
    if (!host) return;
    const st = document.createElement('i');
    st.className = 'stamp' + (ok ? ' ok' : '');
    st.textContent = text;
    const d = RM ? 0.1 : delay;
    st.style.setProperty('--sd', d + 's');
    host.appendChild(st);
    setTimeout(() => { if (st.isConnected) SFX.play('slam'); }, d * 1000 + 60);
  };

  // ── 公路旅行轉場：路線卡從 1 到 10，車子開到下一個出口 ──
  const trip = $('#trip');
  const pos = (i) => 4 + i * (92 / (LEVELS.length - 1));
  UI.tripIn = async (from, to, note = '') => {
    const L = LEVELS[to];
    UI.resetSkip();
    const p0 = from < 0 ? 0 : pos(Math.min(from, LEVELS.length - 1));
    const dots = LEVELS.map((_, i) => `<i class="${i < to ? 'done' : ''}" style="left:${pos(i)}%">${i + 1}</i>`).join('');
    trip.innerHTML = `<div class="tripc"><p class="tk">${esc(note || 'ROAD TRIP · NEXT EXIT')} · ${to + 1} / ${LEVELS.length}</p>
      <h3>第 ${L.n} 關・${esc(L.name)}</h3><p class="en">${esc(L.en || '')}</p>
      <div class="route" style="--p:${p0}">${dots}<b class="car" aria-hidden="true">🚙</b></div>
      <p class="mi">七天免費試用・剩 ${Math.max(0, LEVELS.length - to)} 個出口</p><span class="skip">點擊或按任意鍵略過</span></div>`;
    trip.hidden = false;
    replay(trip, 'in');
    trip.classList.remove('out');
    SFX.play('tele');
    await UI.swait(420);
    const route = trip.querySelector('.route');
    if (!route) return;
    route.classList.add('go');
    route.style.setProperty('--p', pos(to));
    await UI.swait(from === to ? 500 : 1150);
    route.classList.remove('go');
    const cur = route.querySelectorAll('i')[to];
    if (cur) cur.classList.add('cur');
    SFX.play('ding');
    await UI.swait(260);
  };
  UI.tripOut = async () => {
    if (trip.hidden) return;
    trip.classList.remove('in');
    replay(trip, 'out');
    await new Promise(r => setTimeout(r, (RM ? 200 : 500) / V.speed));
    trip.hidden = true;
    trip.className = '';
    trip.innerHTML = '';
  };
  trip.addEventListener('click', () => UI.skipNow());

  // ── 關卡標題卡（配合 V.intro 鏡頭飛入）──
  const lvCard = $('#lvCard');
  UI.levelCard = (L) => {
    UI.resetSkip();
    lvCard.innerHTML = `<span class="ex">EXIT ${L.n}</span><div class="sg"><h3>${esc(L.name)}</h3><p>${esc(L.en || '')}</p><small>點擊或按任意鍵略過</small></div>`;
    lvCard.classList.remove('bye');
    replay(lvCard, 'go');
  };
  UI.levelCardOut = async () => {
    if (!lvCard.classList.contains('go')) return;
    lvCard.classList.remove('go');
    replay(lvCard, 'bye');
    await new Promise(r => setTimeout(r, (RM ? 200 : 400) / V.speed));
    lvCard.classList.remove('bye');
    lvCard.innerHTML = '';
  };

  // ── 首領登場名字卡（配合 V.bossIntro 的鏡頭）──
  const bossCard = $('#bossCard');
  UI.bossCard = (u) => {
    if (!bossCard) return;
    const i = u.name.lastIndexOf('・');
    const nm = (i >= 0 ? u.name.slice(i + 1) : u.name).replace(/^【.*?】/, ''), sub = (i >= 0 ? u.name.slice(0, i) : '').replace(/^【.*?】/, '');
    bossCard.innerHTML = `<span class="tag">${u.final ? 'FINAL BOSS' : 'BOSS FIGHT'}</span><br><h3><span>${esc(u.icon || '')} ${esc(nm)}</span></h3>${sub ? `<p>${esc(sub)}</p>` : ''}`;
    bossCard.classList.remove('bye');
    replay(bossCard, 'go');
  };
  UI.bossCardOut = () => {
    if (!bossCard || !bossCard.classList.contains('go')) return;
    bossCard.classList.remove('go');
    replay(bossCard, 'bye');
    setTimeout(() => { bossCard.classList.remove('bye'); bossCard.innerHTML = ''; }, 340);
  };

  // 鏡頭／速度按鈕的小回饋
  UI.bump = (el, cls = 'bump') => replay(typeof el === 'string' ? $(el) : el, cls);
  return UI;
}
