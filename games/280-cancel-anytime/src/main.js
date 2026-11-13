// 遊戲流程：標題 → 戰前嘴砲 → 先攻 → 回合迴圈 → 戰利品／晶片 → 下一關。
/* global THREE */
import { HEROES, HERO_ORDER, LEVELS, LOOT, POWERS, TIP_MAX, LAYER_LABEL, STATUSES, PROPS, SURFACES } from './data.js';
import * as R from './rules.js';
import { createView } from './view.js';
import { createUI, $, esc } from './ui.js';
import { SFX } from './audio.js';
import { botTurn } from './bot.js';
import { createMeta } from './meta.js';

const SAVE = 'cancel-anytime-v1';
const load = () => { try { return JSON.parse(localStorage.getItem(SAVE) || 'null'); } catch (e) { return null; } };
const save = (o) => { try { localStorage.setItem(SAVE, JSON.stringify(o)); } catch (e) { /* 無痕模式 */ } };

export function start() {
  const V = createView($('#gl'), $('#ov'));
  const game = { s: null, sel: 'move', playerTurn: false, busy: false, diff: 'standard', party: null, lv: 0, pending: null };
  window.__game = game; game.R = R; // 測試用（tools/play.mjs 會用到規則查詢）
  const UI = createUI(V, game);
  const M = createMeta({ game, V, UI, $, esc });
  window.__meta = M; // 測試用
  const q0 = new URLSearchParams(location.search);
  game.auto = q0.get('auto') === '1';
  if (game.auto) { V.speed = +(q0.get('speed') || 3); UI.choose0 = UI.choose; UI.choose = (html, cls, after) => { const c = UI.modal(html, cls); if (after) after(c); return Promise.resolve(cls === 'lose' ? 'retry' : 'next'); }; }
  UI.syncSpeed();
  const isTouch = matchMedia('(pointer: coarse)').matches;
  let endTurnResolve = null;
  // 呼叫視圖的新演出（平行開發中，可能不存在）；cap 毫秒後不再等
  const vcall = (name, cap, ...args) => {
    if (typeof V[name] !== 'function') return Promise.resolve();
    let p;
    try { p = Promise.resolve(V[name](...args)).catch(e => console.warn(name, e)); } catch (e) { console.warn(name, e); return Promise.resolve(); }
    return Promise.race([p, new Promise(r => setTimeout(r, cap))]);
  };
  // 點擊／按鍵略過目前的轉場
  game.skipFn = null;
  const trySkip = () => {
    if (!game.skipFn && !UI.canSkip()) return false;
    if (game.skipFn) game.skipFn();
    UI.skipNow();
    return true;
  };

  // ── 播放事件 ──
  async function flush() {
    const s = game.s;
    while (s.fx.length) {
      const evs = s.fx.splice(0, s.fx.length);
      M.observe(evs, s);
      await V.play(evs, UI);
    }
    UI.refresh();
  }

  // ── 關卡選單 ──
  const lvSel = $('#lvSel');
  lvSel.innerHTML = LEVELS.map((L, i) => `<option value="${i}">第 ${L.n} 關・${esc(L.name.split('・')[0])}</option>`).join('');
  lvSel.addEventListener('change', async () => {
    const i = +lvSel.value;
    if (game.s && !game.s.over) {
      const v = await UI.choose(`<h2>跳到第 ${i + 1} 關？</h2><p>目前這場戰鬥會放棄，前面關卡的戰利品與 5G 晶片會自動補齊（測試用）。</p><div class="row"><button class="b" data-v="y">跳關</button><button class="b ghost" data-v="n">繼續打</button></div>`);
      UI.closeModal();
      if (v !== 'y') { lvSel.value = game.lv; return; }
    }
    game.abort = true;
    if (endTurnResolve) endTurnResolve();
    setTimeout(() => runLevel(i, R.partyForLevel(i), game.lv), 50);
  });

  // ── 按鈕 ──
  $('#rotL').onclick = () => { V.rotate(-1); UI.bump('#rotL', 'spinL'); };
  $('#rotR').onclick = () => { V.rotate(1); UI.bump('#rotR', 'spinR'); };
  $('#zoomIn').onclick = () => { V.zoom(0.85); UI.bump('#zoomIn'); };
  $('#zoomOut').onclick = () => { V.zoom(1.18); UI.bump('#zoomOut'); };
  const setSpd = (v) => { V.speed = v; $('#spd').textContent = V.speed + '×'; $('#spd').classList.toggle('on', V.speed > 1); UI.syncSpeed(); UI.bump('#spd'); };
  $('#spd').onclick = () => { setSpd(V.speed === 1 ? 2 : V.speed === 2 ? 3 : 1); SFX.play('select'); };
  if (V.speed !== 1) { $('#spd').textContent = V.speed + '×'; $('#spd').classList.add('on'); }
  $('#snd').onclick = () => { SFX.init(); SFX.setMuted(!SFX.muted); $('#snd').textContent = SFX.muted ? '🔇' : '🔊'; UI.bump('#snd'); };
  $('#emoteBtn').onclick = () => emote();
  $('#restBtn').onclick = () => game.selectSkill('rest');
  $('#endBtn').onclick = () => endTurn();
  $('#trayBtn').onclick = () => $('#tray').classList.toggle('open');
  $('#helpBtn').onclick = () => showHelp();
  $('#menuBtn').onclick = () => { setGear(false); showTitle(); };

  // ── 設定面板（存在 localStorage，和進度分開）──
  const OPTS = 'cancel-anytime-opts';
  const opts = Object.assign({ cine: true, q: 'auto', log: false }, (() => { try { return JSON.parse(localStorage.getItem(OPTS) || '{}'); } catch (e) { return {}; } })());
  const saveOpts = () => { try { localStorage.setItem(OPTS, JSON.stringify(opts)); } catch (e) { /* 無痕模式 */ } };
  const gear = $('#gear'), gearBtn = $('#gearBtn');
  function setGear(on) { gear.hidden = !on; gearBtn.setAttribute('aria-expanded', on ? 'true' : 'false'); }
  gearBtn.onclick = () => { setGear(gear.hidden); SFX.play('select'); };
  addEventListener('pointerdown', (e) => { if (!gear.hidden && !(e.target.closest && e.target.closest('#gear, #gearBtn'))) setGear(false); });
  // 手機：紀錄面板開著時點面板以外的地方就收起來（它會蓋住棋盤）
  addEventListener('pointerdown', (e) => {
    const tray = $('#tray');
    if (innerWidth <= 700 && tray.classList.contains('open') && !tray.classList.contains('asking') && !(e.target.closest && e.target.closest('#tray, #trayBtn'))) tray.classList.remove('open');
  });
  const syncCine = () => { V.actionCam = !!opts.cine; $('#cineBtn').textContent = opts.cine ? '開' : '關'; $('#cineBtn').classList.toggle('on', !!opts.cine); };
  $('#cineBtn').onclick = () => { opts.cine = !opts.cine; syncCine(); saveOpts(); SFX.play('select'); if (!opts.cine && V.endShot) V.endShot(); };
  syncCine();
  const qSel = $('#qSel');
  const urlQ = /[?&]q=(high|med|low)\b/.exec(location.search);
  if (urlQ) qSel.value = urlQ[1];
  else { qSel.value = opts.q; if (opts.q !== 'auto') V.setQuality(opts.q); }
  qSel.addEventListener('change', () => { opts.q = qSel.value; saveOpts(); if (opts.q === 'auto') V.setAutoQuality(); else V.setQuality(opts.q); });
  const setLog = (on) => {
    $('#tray').classList.toggle('logopen', on);
    $('#logTgl').textContent = on ? '🧾 收合 ▴' : '🧾 紀錄 ▾';
    $('#logTgl').setAttribute('aria-expanded', on ? 'true' : 'false');
    const l = $('#log'); l.scrollTop = on ? l.scrollHeight : 0;
  };
  $('#logTgl').onclick = () => { opts.log = !opts.log; setLog(opts.log); saveOpts(); };
  $('#log').addEventListener('click', () => { if (!opts.log && innerWidth > 700) { opts.log = true; setLog(true); saveOpts(); } });
  setLog(!!opts.log);

  // ── 技能選擇 ──
  game.selectSkill = (sk) => {
    const s = game.s;
    if (!s || !game.playerTurn || game.busy) return;
    const u = R.current(s);
    SFX.play('select');
    if (sk === 'move') { game.sel = 'move'; game.pending = null; refreshHi(); UI.hotbar(); return; }
    const c = R.canUse(s, u, sk);
    if (!c.ok) { UI.banner(c.why || '現在不能用', 'warn'); UI.shakeSkill(sk); SFX.play('miss'); return; }
    const mode = sk === 'rest' ? 'self' : R.targetMode(u, sk);
    if (mode === 'self') { act(sk, u.x, u.z); return; }
    game.sel = game.sel === sk ? 'move' : sk;
    game.pending = null;
    refreshHi();
    UI.hotbar();
  };

  // ── 嘴砲（純娛樂）──
  const TAUNT = {
    chad: ['兄弟，你有在練嗎？', '今天不練腿，明天也不練！', '蛋白粉就是我的信仰！', '熱身？直接上啦！'],
    karen: ['我要找你們經理！', '這張優惠券明明還沒過期！', '我會給你一星負評喔。', '你知道我是誰嗎？'],
    dale: ['小乖，咬他！', '這是我家院子，滾出去！', '煙火不是拿來看的！', '嗆辣醬才是早餐！'],
    doge: ['只是社會實驗啦！', '趁低點全部梭哈！', '記得按讚訂閱開小鈴鐺～', '我只是路過的。'],
  };
  let emoteT = 0;
  function emote() {
    const s = game.s;
    if (!s || s.over || performance.now() - emoteT < 1200) return;
    const cur = R.current(s);
    const pool = s.units.filter(u => u.side === 'hero' && R.standing(u));
    const u = cur && cur.side === 'hero' && R.standing(cur) ? cur : pool[Math.floor(Math.random() * pool.length)];
    if (!u) return;
    emoteT = performance.now();
    const lines = TAUNT[u.key] || TAUNT.chad;
    V.floatText(u.x, u.z, '💬 ' + lines[Math.floor(Math.random() * lines.length)], 'quote');
    SFX.voice(u.key, 4 + Math.floor(Math.random() * 4));
    const b = $('#emoteBtn');
    UI.bump(b);
    b.classList.add('cool');
    setTimeout(() => b.classList.remove('cool'), 1200);
  }

  // ── 高亮 ──
  let hover = null;
  function refreshHi(cursor) {
    const s = game.s;
    if (!s || !game.playerTurn) { V.setHighlights(cursor ? { cursor } : null); return; }
    const u = R.current(s);
    const h = { reach: [], targets: [], cursor: cursor || null };
    if (game.sel === 'move') {
      const reach = R.reachable(s, u);
      for (const n of reach.values()) if (n.x !== u.x || n.z !== u.z) h.reach.push([n.x, n.z]);
      if (cursor) { const n = reach.get(cursor[0] + ',' + cursor[1]); if (n) h.path = R.pathTo(n); }
    } else {
      const mode = R.targetMode(u, game.sel);
      for (const t of s.grid.flat()) {
        if (t.void) continue;
        const tu = R.unitAt(s, t.x, t.z);
        if (mode === 'tile') { if (R.validTarget(s, u, game.sel, t.x, t.z).ok) h.targets.push([t.x, t.z, 'tile']); }
        else if (tu && R.validTarget(s, u, game.sel, t.x, t.z).ok) h.targets.push([t.x, t.z, R.isFoe(u, tu) ? 'enemy' : 'ally']);
      }
      // 可破壞物件也標出來
      if (game.sel === 'ranged' || game.sel === 'melee') for (const p of s.props) if (p.alive && p.maxHp > 0 && R.validTarget(s, u, game.sel, p.x, p.z, { pid: p.id }).ok) h.targets.push([p.x, p.z, 'tile']);
      if (cursor) {
        const pv = R.preview(s, u, game.sel, cursor[0], cursor[1], hover && hover.pid ? { pid: hover.pid } : {});
        if (pv.radius && pv.ok) h.aoe = { x: cursor[0], z: cursor[1], r: pv.radius, color: R.skillDef(u, game.sel).kind === 'heal' ? 0x6dff7a : 0xff8a1f };
        if (pv.push && pv.push.length > 1) h.push = pv.push.slice(1);
        h.cursorColor = pv.ok ? 0xffd23f : 0x888888;
      }
    }
    V.setHighlights(h);
  }

  // ── 懸停偵測卡內容 ──
  function inspectHtml(pk) {
    const s = game.s;
    if (!s || !pk) return '';
    const t = s.grid[pk.z][pk.x];
    const tu = pk.pid ? null : R.unitAt(s, pk.x, pk.z);
    const prop = pk.pid ? s.props.find(p => p.id === pk.pid) : R.propAt(s, pk.x, pk.z);
    const cur = R.current(s);
    let html = '';
    if (tu) {
      const nm = tu.side === 'hero' ? HEROES[tu.key].name : tu.name;
      const sts = Object.keys(tu.st).map(k => STATUSES[k] ? `<span class="st">${STATUSES[k].icon} ${esc(STATUSES[k].name)}</span>` : '').join('');
      html += `<h4>${esc(tu.side === 'hero' ? '' : tu.icon + ' ')}${esc(nm)}${tu.boss ? ' <em>BOSS</em>' : ''}</h4>
        <p class="kv"><span>HP <b>${tu.hp}/${tu.maxHp}</b></span><span>🛡️ AC <b>${tu.ac}</b></span><span>⛰️ ${LAYER_LABEL[t.h]}</span></p>`;
      if (tu.side === 'enemy') html += `<p class="kv"><span>🗡️ ${esc(tu.atk.name)} ${esc(tu.atk.dice)}・${tu.atk.range <= 1.5 ? '近戰' : tu.atk.range + ' 格'}</span>${tu.aoe ? `<span>💥 ${esc(tu.aoe.name)} ${esc(tu.aoe.dice)}</span>` : ''}</p>`;
      if (sts) html += `<p>${sts}</p>`;
      if (tu.downed) html += `<p class="bad">🚑 倒地：成功 ${tu.saves.s}/3・失敗 ${Math.min(3, tu.saves.f)}/3</p>`;
    } else if (prop) {
      const P = PROPS[prop.type];
      html += `<h4>${esc(P ? P.name : prop.type)}</h4>${prop.maxHp ? `<p class="kv"><span>耐久 <b>${prop.hp}/${prop.maxHp}</b></span></p>` : ''}`;
    }
    if (t.surf) { const S = SURFACES[t.surf.type]; if (S) html += `<p class="surf">${S.icon} <b>${esc(S.name)}</b>${t.surf.turns ? `（剩 ${t.surf.turns} 回合）` : ''}<br><small>${esc(S.note)}</small></p>`; }
    if (!tu && !prop) html = `<h4>${LAYER_LABEL[t.h]}</h4>` + html;
    if (game.playerTurn && cur && game.sel !== 'move') {
      const pv = R.preview(s, cur, game.sel, pk.x, pk.z, pk.pid ? { pid: pk.pid } : {});
      if (!pv.ok && pv.why) html += `<p class="no">🚫 ${esc(pv.why)}</p>`;
      if (pv.chance != null) html += `<p class="odds">命中機率 <b>${Math.round(pv.chance * 100)}%</b></p>`;
      for (const l of pv.lines || []) html += `<p class="ln">${esc(l)}</p>`;
      for (const tg of pv.tags || []) html += `<p class="tag">${esc(tg)}</p>`;
      if (pv.hits) html += `<p class="ln">波及 ${pv.hits.length} 名敵人</p>`;
      if (pv.ok && isTouch) html += `<p class="tap">再點一次確認</p>`;
    } else if (game.playerTurn && cur && game.sel === 'move') {
      const n = R.reachable(s, cur).get(pk.x + ',' + pk.z);
      if (n && (n.x !== cur.x || n.z !== cur.z)) {
        html += `<p class="ln">🥾 移動 ${n.cost} 格（剩 ${cur.moveLeft - n.cost}）</p>`;
        // 預告借機攻擊
        const path = R.pathTo(n);
        if (!cur.noOA && path.some((p, i) => i > 0 && game.s.units.some(o => R.isFoe(cur, o) && R.standing(o) && o.reaction && R.dist(o.x, o.z, path[i - 1][0], path[i - 1][1]) <= 1.5 && R.dist(o.x, o.z, p[0], p[1]) > 1.5))) html += `<p class="tag">⚖️ 會被借機攻擊</p>`;
        if (isTouch) html += `<p class="tap">再點一次確認</p>`;
      }
    }
    return html;
  }

  // ── 輸入：滑鼠／觸控 ──
  const cv = $('#gl');
  let drag = null;
  let hoverUid = null;
  const setHoverUnit = (pk) => {
    const s = game.s;
    const tu = s && pk && !pk.pid ? R.unitAt(s, pk.x, pk.z) : null;
    const id = tu && R.alive(tu) ? tu.id : null;
    if (id === hoverUid) return;
    hoverUid = id;
    UI.boardHover(id);
    if (id && !isTouch) SFX.play('hover');
  };
  cv.addEventListener('contextmenu', e => e.preventDefault());
  cv.addEventListener('pointerdown', e => {
    SFX.init();
    if (trySkip()) return;
    drag = { x: e.clientX, y: e.clientY, moved: false, btn: e.button, id: e.pointerId, pts: drag && drag.pts ? drag.pts : new Map() };
    drag.pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (drag.pts.size === 2) { const [a, b] = [...drag.pts.values()]; drag.pinch = Math.hypot(a.x - b.x, a.y - b.y); }
  });
  addEventListener('pointermove', e => {
    if (drag && drag.pts.has(e.pointerId)) {
      const prev = drag.pts.get(e.pointerId);
      drag.pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (drag.pts.size === 2) {
        const [a, b] = [...drag.pts.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (drag.pinch) V.zoom(drag.pinch / d);
        drag.pinch = d; drag.moved = true;
        return;
      }
      const dx = e.clientX - prev.x, dy = e.clientY - prev.y;
      if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 8) drag.moved = true;
      if (drag.moved) {
        if (drag.btn === 2 || (isTouch && e.pointerType === 'touch')) V.rotateFree(-dx * 0.006);
        else if (drag.btn === 1 || drag.btn === 0) V.pan(-dx * 0.05, -dy * 0.05);
      }
      return;
    }
    if (e.target !== cv || isTouch) { if (hoverUid && e.target !== cv) setHoverUnit(null); return; }
    const pk = V.pick(e.clientX, e.clientY);
    hover = pk;
    setHoverUnit(pk);
    if (!pk) { UI.inspect(''); refreshHi(); return; }
    refreshHi([pk.x, pk.z]);
    UI.inspect(inspectHtml(pk), e.clientX, e.clientY);
  });
  addEventListener('pointerup', e => {
    if (!drag || !drag.pts.has(e.pointerId)) return;
    drag.pts.delete(e.pointerId);
    const wasDrag = drag.moved;
    if (drag.pts.size) return;
    const btn = drag.btn;
    drag = null;
    if (wasDrag || btn !== 0 || e.target !== cv) return;
    const pk = V.pick(e.clientX, e.clientY);
    if (!pk) return;
    if (game.s && game.playerTurn && typeof V.ripple === 'function') {
      try { V.ripple(pk.x, pk.z, game.sel === 'move' ? 0x29e0c9 : 0xffc531); } catch (err) { /* 視圖尚未支援 */ }
    }
    if (isTouch) {
      // 第一下預覽、第二下確認
      const same = game.pending && game.pending.x === pk.x && game.pending.z === pk.z && game.pending.pid === pk.pid;
      setHoverUnit(pk);
      hover = pk;
      refreshHi([pk.x, pk.z]);
      UI.inspect(inspectHtml(pk), e.clientX, e.clientY);
      if (!same) { game.pending = pk; return; }
      game.pending = null;
    }
    click(pk);
  });
  cv.addEventListener('wheel', e => { e.preventDefault(); V.zoom(e.deltaY > 0 ? 1.1 : 0.9); }, { passive: false });
  addEventListener('keydown', e => {
    if (e.target.tagName === 'SELECT' || e.target.tagName === 'INPUT') return;
    SFX.init();
    if (['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) return;
    if (trySkip()) { e.preventDefault(); return; }
    // 對話框開著時讓 Enter／空白鍵交給按鈕
    if ($('#modal').classList.contains('show') && (e.key === 'Enter' || e.key === ' ')) return;
    // 熱鍵列／頂部按鈕有焦點時，Enter／空白鍵照遊戲熱鍵處理，不重複觸發按鈕
    if ((e.key === 'Enter' || e.key === ' ') && e.target.closest && e.target.closest('#hotbar,#top')) e.preventDefault();
    const k = e.key.toLowerCase();
    if (k === 'q') V.rotate(-1);
    else if (k === 'e') V.rotate(1);
    else if (k === ' ') { e.preventDefault(); const u = game.s && R.current(game.s); if (u) { if (typeof V.focusUnit === 'function') V.focusUnit(u.id, { smooth: true }); else V.focus(u.x, u.z); } }
    else if (k === 'w' || k === 'arrowup') V.pan(0, -2);
    else if (k === 's' || k === 'arrowdown') V.pan(0, 2);
    else if (k === 'a' || k === 'arrowleft') V.pan(-2, 0);
    else if (k === 'd' || k === 'arrowright') V.pan(2, 0);
    else if (k === '=' || k === '+') V.zoom(0.88);
    else if (k === '-') V.zoom(1.14);
    else if (k === 'escape') { game.sel = 'move'; game.pending = null; refreshHi(); UI.hotbar(); }
    else if (k === 'enter' || k === 't') endTurn();
    else if (k === 'b') emote();
    else {
      const map = { 1: 'move', 2: 'melee', 3: 'ranged', 4: 'aoe', 5: 'bonus', 6: 'shove', y: 'yeet', h: 'help', m: 'mentos', g: 'power', v: 'valve', x: 'cancel', r: 'rest' };
      if (map[k]) game.selectSkill(map[k]);
    }
  });

  // ── 手把 ──（輪詢在 meta.js；這裡把按鍵接到和滑鼠、鍵盤同一套流程）
  const visible = (el) => !!(el && el.getClientRects().length && !el.disabled);
  // 目前該由「選單焦點」接手的容器：對話框、小費提示、標題選單、設定面板
  const padMenu = () => {
    if ($('#modal').classList.contains('show')) return $('#modal');
    if (!$('#tipAsk').hidden && visible($('#tipAsk'))) return $('#tipAsk');
    if (!$('#title').hidden) return $('#title');
    if (!gear.hidden) return gear;
    return null;
  };
  const padBtns = (box) => [...box.querySelectorAll('button, select')].filter(visible);
  M.padStart({
    hello: () => UI.banner('🎮 手把已連線', 'good'),
    dir: (dx, dz) => {
      SFX.init();
      const box = padMenu();
      if (box) {   // 選單：在按鈕之間移動焦點
        const bs = padBtns(box);
        if (!bs.length) return;
        const i = bs.indexOf(document.activeElement);
        const j = i < 0 ? 0 : (i + (dx + dz > 0 ? 1 : -1) + bs.length) % bs.length;
        bs[j].focus({ preventScroll: false });
        SFX.play('hover');
        return;
      }
      const s = game.s;
      if (!s || s.over || $('#hud').hidden) return;
      const u = R.current(s);
      if (!hover) hover = { x: u.x, z: u.z };
      // 畫面方向 → 棋盤方向（跟鏡頭平移用同一組軸）
      const y = V.camYaw(), c = Math.cos(y), sn = Math.sin(y);
      const wx = dx * c + dz * sn, wz = -dx * sn + dz * c;
      let nx = hover.x, nz = hover.z;
      if (Math.abs(wx) >= Math.abs(wz)) nx += Math.sign(wx); else nz += Math.sign(wz);
      const t = s.grid[nz] && s.grid[nz][nx];
      if (!t || t.void) return;
      const pk = { x: nx, z: nz };
      const prop = R.propAt(s, nx, nz);
      if (prop && prop.alive && prop.maxHp > 0 && game.sel !== 'move' && !R.unitAt(s, nx, nz)) pk.pid = prop.id;
      hover = pk;
      setHoverUnit(pk);
      refreshHi([nx, nz]);
      V.focus(nx, nz);
      UI.inspect(inspectHtml(pk), innerWidth / 2 + 36, innerHeight / 2 - 60);
    },
    confirm: () => {
      SFX.init();
      if (trySkip()) return;
      const box = padMenu();
      if (box) {
        const bs = padBtns(box), a = document.activeElement;
        const b = bs.includes(a) ? a : box.querySelector('.row .b:not(.ghost):not(:disabled), .tip, #startBtn') || bs[0];
        if (b && b.tagName !== 'SELECT') b.click();
        return;
      }
      if (hover && game.playerTurn && !game.busy) click(hover);
    },
    cancel: () => {
      if (!$('#tipAsk').hidden && visible($('#tipAsk'))) { const b = $('#tipAsk .ghost'); if (b) b.click(); return; }
      if (!gear.hidden) { setGear(false); return; }
      if ($('#modal').classList.contains('show')) { const b = $('#modal .b.ghost[data-v]'); if (b) b.click(); return; }
      game.sel = 'move'; game.pending = null; refreshHi(hover ? [hover.x, hover.z] : null); UI.hotbar();
    },
    cycle: (d) => {
      if (padMenu() || !game.playerTurn || game.busy) return;
      const list = [...document.querySelectorAll('#hotbar .sk:not(.off)')].map(b => b.dataset.sk);
      if (!list.length) return;
      const i = list.indexOf(game.sel);
      game.selectSkill(list[(i + d + list.length) % list.length]);
      if (hover) refreshHi([hover.x, hover.z]);
    },
    endTurn: () => { if (!padMenu()) endTurn(); },
    rotate: (d) => { if (!padMenu() || padMenu() === gear) V.rotate(d); },
    zoom: (k) => { if (!padMenu()) V.zoom(k); },
    pan: (dx, dz) => { if (!padMenu()) V.pan(dx, dz); },
    menu: () => {
      SFX.init();
      if (!$('#title').hidden) { $('#startBtn').click(); return; }
      if ($('#hud').hidden || $('#modal').classList.contains('show')) return;
      setGear(gear.hidden);
      if (!gear.hidden) { const b = padBtns(gear)[0]; if (b) b.focus(); }
    },
  });

  // ── 點擊行動 ──
  async function click(pk) {
    const s = game.s;
    if (!s || !game.playerTurn || game.busy) return;
    const u = R.current(s);
    if (game.sel === 'move') {
      const tu = R.unitAt(s, pk.x, pk.z);
      // 點到敵人時，自動改用可用的攻擊
      if (tu && R.isFoe(u, tu)) {
        for (const sk of ['melee', 'ranged']) if (R.canUse(s, u, sk).ok && R.validTarget(s, u, sk, pk.x, pk.z).ok) { game.sel = sk; return act(sk, pk.x, pk.z); }
        UI.banner('先選技能，或走近一點', 'warn');
        return;
      }
      if (!R.reachable(s, u).get(pk.x + ',' + pk.z)) return;
      game.busy = true;
      R.moveTo(s, u.id, pk.x, pk.z);
      UI.inspect('');
      await flush();
      game.busy = false;
      afterAction();
      return;
    }
    act(game.sel, pk.x, pk.z, pk.pid);
  }

  async function act(sk, x, z, pid) {
    const s = game.s;
    const u = R.current(s);
    const opts = pid ? { pid } : {};
    if (sk !== 'rest' && R.targetMode(u, sk) !== 'self') {
      const v = R.validTarget(s, u, sk, x, z, opts);
      if (!v.ok) { UI.banner(v.why || '不能選這裡', 'warn'); return; }
    }
    game.busy = true;
    UI.inspect('');
    V.setHighlights(null);
    // 小費重擲：單體攻擊先預擲
    const S = R.skillDef(u, sk);
    const tu = !pid && R.unitAt(s, x, z);
    if (S && tu && R.isFoe(u, tu) && ['melee', 'ranged', 'yeet'].includes(S.kind) && !u.st.freedom) {
      const kind = S.kind === 'melee' ? 'melee' : 'ranged';
      const m = R.attackMods(s, u, tu, kind, S.kind === 'yeet' ? u.str : S.hit);
      let d20 = R.d(s, 20);
      if ((d20 === 1 || (d20 !== 20 && d20 + m.bonus < m.ac)) && s.party.tips > 0) {
        await UI.showRoll({ who: u.id, label: S.name, d20, parts: m.parts, total: d20 + m.bonus, ac: m.ac, acParts: m.acParts, hit: false, crit: false, fumble: d20 === 1 }, { noWait: true });
        if (await UI.askTip(`擲出 ${d20}，合計 ${d20 + m.bonus} 對 AC ${m.ac}：會失手。`)) { s.party.tips--; d20 = R.d(s, 20); UI.log(`💵 付了 25% 小費給 DM，重擲 D20！`, 'warn'); }
      }
      opts.d20 = d20;
    }
    const r = R.useSkill(s, u.id, sk, x, z, opts);
    if (!r.ok) { UI.banner(r.why || '不能這樣做', 'warn'); game.busy = false; refreshHi(); return; }
    await flush();
    game.busy = false;
    if (s.over) return endTurnResolve && endTurnResolve();
    game.sel = 'move';
    afterAction();
  }

  // 配樂強度：隊伍血量、有人倒地、魔王半血、殘局都會把配樂往上推
  function syncMood() {
    const s = game.s;
    if (!s || s.over) return;
    let hp = 0, max = 0, down = 0, foes = 0, bossLow = false;
    for (const u of s.units) {
      if (u.side === 'hero') { hp += Math.max(0, u.hp); max += u.maxHp; if (u.downed) down++; }
      else if (R.alive(u)) { foes++; if (u.boss && u.hp < u.maxHp * 0.5) bossLow = true; }
    }
    const k = max ? hp / max : 1;
    // 第 1 回合是平靜的編制（0.35），第 2 回合起回到曲子原本的樣子（0.5），之後由戰況往上推
    let m = (s.round >= 2 ? 0.5 : 0.35) + (k < 0.6 ? 0.12 : 0) + (k < 0.35 ? 0.12 : 0) + (down ? 0.12 : 0) + (bossLow ? 0.2 : 0) + (foes <= 2 ? 0.15 : 0);
    SFX.intensity(Math.min(1, m));
  }
  function afterAction() {
    const s = game.s;
    if (!s || s.over) { if (endTurnResolve) endTurnResolve(); return; }
    const u = R.current(s);
    if (!R.standing(u)) { if (endTurnResolve) endTurnResolve(); return; }
    refreshHi(hover ? [hover.x, hover.z] : null);
    UI.hotbar();
    syncMood();
    M.coachSync('act');
    const nothing = !u.action && !u.bonus && u.moveLeft <= 0;
    $('#endBtn').classList.toggle('pulse', nothing);
  }

  function endTurn() {
    if (!game.playerTurn || game.busy) return;
    SFX.play('click');
    UI.bump('#endBtn');
    M.coachSync('end');
    if (endTurnResolve) endTurnResolve();
  }

  // ── 關卡流程 ──
  // from：上一個出口（公路旅行卡的車子起點）；from === idx 表示重打
  async function runLevel(idx, party, from = idx - 1) {
    game.abort = false;
    game.lv = idx;
    lvSel.value = idx;
    game.party = party;
    // 每日挑戰：固定種子，不動戰役存檔
    game.daily = game.dailyNext || null;
    game.dailyNext = null;
    if (!game.daily) save({ lv: idx, party, diff: game.diff });
    const seed = game.daily ? M.daily(game.daily).seed : (Math.random() * 2 ** 31) >>> 0;
    M.begin();
    M.coachStart(idx);
    const s = R.createState(idx, party, seed, game.diff);
    game.s = s;
    game.playerTurn = false;
    game.sel = 'move';
    UI.closeModal();
    UI.clearLog();
    UI.boardHover(null);
    // 公路旅行轉場蓋住畫面，再在後面載入新關卡
    await UI.tripIn(from, idx, from === idx ? 'RETRY · 重新試用' : from < 0 ? 'ROAD TRIP · 出發' : '');
    if (game.abort || game.s !== s) return;
    $('#hud').hidden = false;
    $('#title').hidden = true;
    V.loadLevel(s);
    $('#lvName').textContent = `${game.daily ? '📅 每日挑戰・' : ''}第 ${s.L.n} 關・${s.L.name}`;
    $('#roundN').textContent = 0;
    UI.refresh();
    SFX.intensity(0.3);   // 每關從平靜的編制開始，戰況再把它推上去
    SFX.music(s.L.theme);
    UI.log(`📍 第 ${s.L.n} 關・${s.L.name}`, 'head');
    UI.log(s.L.intro, '');
    UI.tripOut();
    await levelIntro(s, idx);
    if (game.abort || game.s !== s) return;
    await precombat(s);
    if (game.abort || game.s !== s) return;
    R.rollInitiative(s);
    await flush();
    // 回合迴圈
    let lastSide = null;
    while (!s.over && !game.abort && game.s === s) {
      const u = R.current(s);
      const b = R.beginTurn(s);
      UI.refresh();
      syncMood();
      // 換邊時打出大橫幅：YOUR TURN · 名字／ENEMY TURN
      if (!b.skip && R.standing(u)) {
        if (u.side === 'hero') UI.turnBanner('hero', game.auto ? 'AUTO TURN' : 'YOUR TURN', HEROES[u.key].name, HEROES[u.key].color);
        else if (lastSide !== 'enemy') UI.turnBanner('foe', 'ENEMY TURN', u.name);
        lastSide = u.side === 'hero' ? 'hero' : 'enemy';
        if (typeof V.focusUnit === 'function') { try { V.focusUnit(u.id, { smooth: true }); } catch (err) { /* 視圖尚未支援 */ } }
      }
      await flush();
      if (game.abort || game.s !== s) return;
      if (!s.over && !b.skip) {
        if (u.side === 'hero' && game.auto) {
          UI.refresh();
          botTurn(s, u);
          await flush();
        } else if (u.side === 'hero') {
          game.playerTurn = true;
          game.sel = 'move';
          SFX.play('turn');
          if (V.speed < 3) SFX.voice(u.key, 2, { vol: 0.6, delay: 0.12 });
          UI.refresh();
          refreshHi();
          M.coachSync('turn');
          await new Promise(res => { endTurnResolve = res; });
          endTurnResolve = null;
          game.playerTurn = false;
          M.coachHide();
          $('#endBtn').classList.remove('pulse');
          V.setHighlights(null);
          UI.inspect('');
        } else {
          UI.refresh();
          await V.wait(260);
          R.aiTurn(s, u);
          await flush();
        }
      }
      if (game.abort || game.s !== s) return;
      if (s.over) break;
      R.endTurn(s);
      await flush();
    }
    if (game.abort || game.s !== s) return;
    window.__levelResult = { lv: idx, over: s.over, round: s.round };
    UI.inspect('');
    UI.refresh();
    await V.wait(500);
    if (s.over === 'win') await victory(s);
    else await defeat(s);
  }

  // 關卡開場：出口標誌卡＋視圖的鏡頭飛入（V.intro），點擊／按鍵可略過
  async function levelIntro(s, idx) {
    UI.levelCard(s.L);
    const skipIntro = () => { if (typeof V.skipIntro === 'function') { try { V.skipIntro(); } catch (e) { /* 略 */ } } };
    game.skipFn = skipIntro;
    const autoSkip = game.auto ? setTimeout(() => { skipIntro(); UI.skipNow(); }, 900 / V.speed) : 0;
    const hasIntro = typeof V.intro === 'function';
    await Promise.all([hasIntro ? vcall('intro', 6000, idx) : Promise.resolve(), UI.swait(hasIntro ? 700 : 1500)]);
    clearTimeout(autoSkip);
    game.skipFn = null;
    if (game.s === s) await UI.levelCardOut();
    // 首領登場：低角度繞拍＋名字卡（自動模式、3× 以上、reduced-motion、關掉演出鏡頭時不播）
    const boss = !game.auto && game.s === s && typeof V.bossIntro === 'function' && V.bossOf ? V.bossOf() : null;
    if (boss) {
      UI.resetSkip();
      game.skipFn = skipIntro;
      const p = vcall('bossIntro', 5000);
      if (V.shot && V.shot.wT) {
        UI.bossCard(boss);
        SFX.duck(2.4, 0.3); SFX.play('bossSting'); SFX.play('gasp', { delay: 0.5 });
        SFX.voice(boss.key, 7, { boss: true, delay: 1.0 });
      }
      await p;
      UI.bossCardOut();
      game.skipFn = null;
    }
  }

  async function precombat(s) {
    const C = s.L.check;
    if (game.auto) {
      const hk = C.hero === 'all' ? 'chad' : C.hero;
      const r = R.rollCheck(s, hk);
      R.applyCheck(s, r.success, hk);
      await flush();
      return;
    }
    const heroBtns = C.hero === 'all'
      ? `<button class="b big" data-v="all">🇺🇸 全隊合力（+7、優勢）</button>`
      : HERO_ORDER.map(k => {
        const { bonus, adv } = R.checkBonus(s, k);
        let p = 0; for (let a = 1; a <= 20; a++) for (let b = 1; b <= (adv ? 20 : 1); b++) { const r = adv ? Math.max(a, b) : a; if (r + bonus >= C.dc || r === 20) p++; }
        p /= adv ? 400 : 20;
        return `<button class="b hero${k === C.hero ? ' rec' : ''}" data-v="${k}" style="--c:${HEROES[k].color}"><img alt="" src="${UI.portrait(k)}"><span>${esc(HEROES[k].name)}<small>${bonus >= 0 ? '+' : ''}${bonus}${adv ? '・優勢' : ''}・${Math.round(p * 100)}%</small></span>${k === C.hero ? '<em>推薦</em>' : ''}</button>`;
      }).join('');
    const v = await UI.choose(`<p class="lvtag">第 ${s.L.n} 關 · ${esc(s.L.en)}</p><h2>${esc(s.L.name)}</h2>
      <p class="intro">${esc(s.L.intro)}</p>
      <div class="scene"><b>🗣️ 戰前嘴砲・${esc(C.label)} DC ${C.dc}</b><blockquote>${esc(C.line)}</blockquote><p class="win">成功：${esc(C.win)}</p></div>
      <p class="pick">指派一名隊員擲 D20：</p><div class="heroes">${heroBtns}</div>
      <div class="row"><button class="b ghost" data-v="skip">不嘴砲，直接開打</button></div>`, 'check');
    if (v === 'skip') { UI.closeModal(); return; }
    const hk = v === 'all' ? 'chad' : v;
    SFX.voice(hk, 8);   // 嘴砲開講
    let r = R.rollCheck(s, hk);
    await diceModal(s, C, r, v);
    if (!r.success && s.party.tips > 0) {
      const t = await UI.choose(`<h2>🤡 尬聊破局……</h2><p>擲出 ${r.used}${r.adv ? `（優勢 ${r.d20}/${r.d20b}）` : ''} + ${r.bonus} = ${r.total}，沒過 DC ${r.dc}。</p><p>要付 25% 小費給 DM 重擲嗎？（剩 ${s.party.tips} 點）</p><div class="row"><button class="b tip" data-v="y">💵 付小費重擲</button><button class="b ghost" data-v="n">算了，開打</button></div>`, 'check');
      if (t === 'y') { s.party.tips--; r = R.rollCheck(s, hk); await diceModal(s, C, r, v); }
    }
    R.applyCheck(s, r.success, hk);
    M.talk(r.success);
    SFX.play(r.success ? 'checkWin' : 'checkFail');
    SFX.play(r.success ? 'cheer' : 'laugh', { delay: 0.25 });
    UI.closeModal();
    await flush();
    if (r.success) UI.banner('嘴砲成功！', 'good'); else UI.banner('🤡 CRINGE', 'warn');
  }

  async function diceModal(s, C, r, who) {
    const card = UI.modal(`<p class="lvtag">${esc(C.label)} DC ${C.dc}</p><div class="bigdie"><svg viewBox="0 0 100 100"><polygon points="50,3 93,27 93,73 50,97 7,73 7,27"/><polygon class="f" points="50,22 76,66 24,66"/><text x="50" y="58">?</text></svg></div><p class="res">　</p>`, 'check dice');
    SFX.play('check');
    const t = card.querySelector('text'), svg = card.querySelector('svg');
    const t0 = performance.now();
    await new Promise(res => {
      const tick = () => {
        const k = (performance.now() - t0) / 1100;
        if (k >= 1) return res();
        t.textContent = 1 + Math.floor(Math.random() * 20);
        const hop = Math.abs(Math.sin(k * Math.PI * 4)) * (1 - k) * 26;
        svg.style.transform = `translateY(${-hop}px) rotate(${k * 720}deg) scale(${1 + Math.sin(k * Math.PI) * 0.3})`;
        requestAnimationFrame(tick);
      };
      tick();
    });
    svg.style.transform = '';
    t.textContent = r.used;
    const bd = card.querySelector('.bigdie');
    bd.classList.remove('land'); void bd.offsetWidth; bd.classList.add('land');
    UI.stamp(card, r.success ? 'APPROVED' : 'DENIED', r.success, 0.35);
    card.querySelector('.res').innerHTML = `d20(<b>${r.used}</b>)${r.adv ? ` <small>優勢：${r.d20} / ${r.d20b}</small>` : ''} + ${r.bonus} = <b>${r.total}</b> vs DC ${r.dc}<br><strong class="${r.success ? 'ok' : 'ng'}">${r.success ? '✅ 檢定成功！' : '🤡 檢定失敗'}</strong>`;
    if (r.used === 20) SFX.play('crit');
    await V.wait(1300);
  }

  async function victory(s) {
    const L = s.L;
    const P = game.party;
    const newLoot = L.loot.filter(k => !P.loot.includes(k));
    P.loot.push(...newLoot);
    P.tips = Math.min(TIP_MAX, P.tips + 1);
    P.cleared = Math.max(P.cleared, game.lv + 1);
    if (newLoot.includes('sunscreen')) P.droneCharges = (P.droneCharges || 0) + 1;
    if (s.party.droneCharges < P.droneCharges) { /* 同一物件 */ }
    SFX.play('win');
    SFX.play('cheerBig', { delay: 0.5 });
    SFX.music(null);
    M.coachEnd(true);
    const res = M.result(s);
    await vcall('celebrate', Math.max(700, 2400 / V.speed), 'hero');
    if (game.s !== s) return;
    const snap = !game.auto && typeof V.snap === 'function' ? V.snap() : null;   // 戰報圖的背景：慶祝中的畫面
    const cardBtn = '<button class="b ghost" id="cardBtn" type="button">📸 存戰報圖</button>';
    const bindCard = (card) => {
      const b = card.querySelector('#cardBtn');
      if (b) b.onclick = async () => { b.disabled = true; SFX.play('select'); const how = await M.shareCard(s, res, snap); b.disabled = false; b.textContent = how === 'save' ? '✅ 已存成圖片' : how === 'share' ? '✅ 已分享' : '📸 存戰報圖'; };
    };
    if (game.daily) {
      await UI.choose(`<p class="lvtag">每日挑戰 · ${esc(game.daily)}</p><h2>📅 今日份的免運費已領取</h2>
        <p class="intro">第 ${L.n} 關・${esc(L.name)}。每天的關卡與擲骰都固定，明天會換一場。</p>
        <div class="receipt"><p class="rh">*** DAILY SPECIAL ***</p>${M.resultHtml(res)}<p class="rh">SEE YOU TOMORROW</p></div>
        <div class="row"><button class="b" data-v="title">回標題</button>${cardBtn}</div>`, 'loot', (card) => { UI.stamp(card, 'PAID', true, 0.9); bindCard(card); });
      UI.closeModal();
      if (game.auto) { window.__autoDone = true; return; }
      return showTitle();
    }
    if (game.lv === LEVELS.length - 1) return ending(s, res, bindCard, cardBtn);
    const lootHtml = newLoot.map(k => `<li><span class="li">${LOOT[k].icon}</span><b>${esc(LOOT[k].name)}</b><small>${esc(LOOT[k].text)}</small></li>`).join('') || '<li><small>這關沒有掉落裝備。</small></li>';
    await UI.choose(`<p class="lvtag">第 ${L.n} 關 · 清場</p><h2>🍖 停車場車尾派對烤肉・長休</h2>
      <div class="receipt"><p class="rh">*** TAILGATE BBQ ***<br>RECEIPT #${String(L.n).padStart(4, '0')}</p>
      <ul>${lootHtml}<li><span class="li">💵</span><b>小費點數 +1</b><small>目前 ${P.tips}/${TIP_MAX}</small></li>
      <li><span class="li">❤️</span><b>全隊 HP 與法術位全滿</b><small>皮卡車後車廂烤肉架旁聊天吐嘈</small></li></ul>
      ${P.bills ? `<p class="bill">累積救護車帳單：$${P.bills.toLocaleString()} USD</p>` : ''}${M.resultHtml(res)}<p class="rh">THANK YOU · COME AGAIN</p></div>
      <div class="row"><button class="b" data-v="next">${L.chip ? '拆開 5G 試用包晶片 →' : '前往下一關 →'}</button>${cardBtn}</div>`, 'loot', (card) => { UI.stamp(card, 'PAID', true, 0.45 + (newLoot.length + 2) * 0.16); bindCard(card); });
    SFX.play('loot');
    if (L.chip && game.auto) { const [h, pw] = [['dale', 'drone'], ['doge', 'gaslight'], ['chad', 'refund'], ['karen', 'drone']][Object.keys(P.chips).length % 4]; P.chips[h] = pw; }
    else if (L.chip) await chipModal(P);
    UI.closeModal();
    save({ lv: game.lv + 1, party: P, diff: game.diff });
    await vcall('outro', Math.max(400, 1200 / V.speed));
    if (game.s !== s) return;
    runLevel(game.lv + 1, P, game.lv);
  }

  async function chipModal(P) {
    let power = null, hero = null;
    const card = UI.modal(`<h2>🧠 未拆封的 5G 試用包晶片</h2>
      <div class="tos"><p><b>使用者條款（第 1 頁，共 800 頁）</b></p><p>1. 您同意本晶片得自動續訂，並同意續訂後再續訂。2. 您同意與 3,141 家合作夥伴分享您的腦波、購物車與深夜搜尋紀錄。3. 取消訂閱請撥打客服專線，於第 48 層子選單按 #，並完成所有包含消防栓的圖片驗證。4. 本條款可能隨時變更，變更後您繼續呼吸即視為同意。……</p></div>
      <p class="pick">選一個企業異能：</p>
      <div class="powers">${Object.entries(POWERS).map(([k, p]) => `<button class="b pw" data-p="${k}"><span>${p.icon}</span><b>${esc(p.name)}</b><small>${esc(p.text)}</small></button>`).join('')}</div>
      <p class="pick">裝到誰的腦袋裡：</p>
      <div class="heroes">${HERO_ORDER.map(k => `<button class="b hero" data-h="${k}" style="--c:${HEROES[k].color}"><img alt="" src="${UI.portrait(k)}"><span>${esc(HEROES[k].name)}<small>${P.chips[k] ? '目前：' + esc(POWERS[P.chips[k]].name) : '尚無晶片'}</small></span></button>`).join('')}</div>
      <label class="agree"><input type="checkbox" id="agree"> 我已閱讀並同意長達 800 頁的使用者條款與所有第三方 Cookie</label>
      <div class="row"><button class="b" id="chipOk" disabled>安裝晶片</button></div>`, 'chip');
    await new Promise(res => {
      const upd = () => { card.querySelector('#chipOk').disabled = !(power && hero && card.querySelector('#agree').checked); };
      card.addEventListener('click', e => {
        const p = e.target.closest('[data-p]'), h = e.target.closest('[data-h]');
        if (p) { power = p.dataset.p; card.querySelectorAll('[data-p]').forEach(b => b.classList.toggle('sel', b === p)); SFX.play('select'); }
        if (h) { hero = h.dataset.h; card.querySelectorAll('[data-h]').forEach(b => b.classList.toggle('sel', b === h)); SFX.play('select'); }
        if (e.target.id === 'chipOk' && !e.target.disabled) { P.chips[hero] = power; SFX.play('gaslight'); res(); }
        upd();
      });
      card.querySelector('#agree').addEventListener('change', upd);
    });
  }

  async function defeat(s) {
    SFX.play('lose');
    SFX.play('aww', { delay: 0.3 });
    SFX.music(null);
    await vcall('celebrate', Math.max(700, 2000 / V.speed), 'enemy');
    if (game.s !== s) return;
    const bills = s.units.filter(u => u.side === 'hero' && u.gone).length * 50000 + 4 * 0;
    const v = await UI.choose(`<h2>🚑 全隊倒地，而且都沒買醫保</h2>
      <p class="intro">救護車一台接一台開進來。試用期還在倒數，晶片開始在你們腦中播放企業黑話。</p>
      <div class="receipt"><p class="rh">MEDICAL BILL</p><ul><li><span class="li">🚑</span><b>本關救護車</b><small>$${(bills || 200000).toLocaleString()} USD</small></li><li><span class="li">🧠</span><b>實習生喪屍化進度</b><small>${Math.min(99, 60 + s.L.n * 4)}%</small></li></ul></div>
      <div class="row"><button class="b" data-v="retry">再試一次（重打這關）</button>${game.daily ? '' : '<button class="b ghost" data-v="easy">改成「企劃原始數值」難度再試</button>'}<button class="b ghost" data-v="title">回標題</button></div>`, 'lose', (card) => UI.stamp(card, 'DENIED', false, 0.9));
    UI.closeModal();
    if (game.auto) { window.__autoLost = (window.__autoLost || 0) + 1; }
    if (v === 'title') return showTitle();
    if (v === 'easy') game.diff = 'story';
    if (game.daily) game.dailyNext = game.daily;
    await vcall('outro', Math.max(400, 1000 / V.speed));
    runLevel(game.lv, game.party, game.lv);
  }

  async function ending(s, res, bindCard, cardBtn = '') {
    const P = game.party;
    $('#hud').hidden = true;
    const fw = setInterval(() => V.burst(4 + Math.random() * 16, 6 + Math.random() * 6, 4 + Math.random() * 16, 60, { color: [0xff2a4a, 0xffffff, 0x2a6aff, 0xffd23f], up: 3, speed: 7, g: -3, life: 1.6, size: 0.45 }), 500);
    SFX.play('crit');
    await UI.choose(`<div class="gold"><p class="ok">✅</p><h2>您已成功取消自動續訂</h2><p class="save">共省下 <b>$14.99 / 月</b></p></div>
      <p class="intro">四名主角站在超級盃舞台中央，一邊喝冰鎮快樂水一邊放煙火，慶祝重獲美式自由。腦袋裡的 5G 晶片終於安靜了。</p>
      <div class="receipt"><p class="rh">FINAL STATEMENT</p><ul>
      <li><span class="li">🎖️</span><b>難度</b><small>${esc(R.DIFFS[game.diff].name)}</small></li>
      <li><span class="li">🧾</span><b>救護車帳單總額</b><small>$${P.bills.toLocaleString()} USD</small></li>
      <li><span class="li">🎒</span><b>收集裝備</b><small>${P.loot.map(k => LOOT[k].icon).join(' ')}</small></li></ul>${res ? M.resultHtml(res) : ''}<p class="rh">NO REFUNDS · NO RENEWALS</p></div>
      <div class="row"><button class="b" data-v="again">從第 1 關重新試用</button>${cardBtn}</div>`, 'ending', (card) => { UI.stamp(card, 'CANCELLED', true, 1.1); if (bindCard) bindCard(card); });
    if (game.auto) { window.__autoDone = true; return; }
    clearInterval(fw);
    save(null);
    game.party = R.newParty();
    runLevel(0, game.party, -1);
  }

  function showHelp() {
    UI.choose(`<h2>操作說明</h2>
      <ul class="help">
      <li><b>移動</b>：選中英雄後點藍色霓虹格子（1）。路徑上若會離開敵人身邊，會觸發「居所防衛法・借機攻擊」。</li>
      <li><b>技能</b>：熱鍵 2–6（近戰、遠程、範圍法術、附贈動作、推撞），Y 丟東西、H 扶隊友、M 曼陀珠、G 5G 晶片、R 得來速短休；L7 有 V 肉錘開關、L10 有 X 強制取消訂閱。</li>
      <li><b>資源</b>：每回合一個 ● 主要動作、一個 ▲ 附贈動作、移動格數；■ 是法術位（範圍招式消耗），過關長休回滿。</li>
      <li><b>命中</b>：d20＋命中加值 ≥ AC。高地往下打 +2、低處往上打（距離 >2）−2；從背後扇形或潛行出手是背刺 +3 命中、+1d6+2 傷害；躲在掩體旁 AC +2。</li>
      <li><b>地表連鎖</b>：快樂水＋曼陀珠＝間歇泉；炸雞油＋火＝火海；能量飲＋電＝電網；起司／綠黏液＋電子菸＝毒雲；打爆流動廁所會噴出惡臭泥漿。</li>
      <li><b>推撞</b>：把敵人推下高台每層 1d6 墜落傷害，推進火海或烤肉醬池就是 TOUCHDOWN。</li>
      <li><b>倒地</b>：英雄 0 HP 不會馬上死，每回合擲死亡豁免；隊友相鄰按 H 扶起，凱倫的精油也能拉人。三次失敗會被救護車載走。</li>
      <li><b>小費</b>：💵 單體攻擊或嘴砲檢定擲失手時，可以付小費給 DM 重擲。</li>
      <li><b>鏡頭</b>：Q / E 旋轉、滾輪縮放、右鍵拖曳自由旋轉、左鍵拖曳或 WASD 平移、空白鍵回到目前角色。手機：單指拖曳旋轉、雙指縮放，點一下預覽、再點一下確認。</li>
      <li><b>手把</b>：十字鍵或左類比移動格子游標、A 確認、B 取消、X 換技能、Y 結束回合；LB / RB 轉鏡頭、LT / RT 縮放、右類比平移、Start 開設定。</li>
      </ul><div class="row"><button class="b" data-v="ok">了解</button></div>`, 'help').then(() => UI.closeModal());
  }

  function showTitle() {
    game.abort = true;
    if (endTurnResolve) endTurnResolve();
    UI.closeModal();
    UI.boardHover(null);
    const tt = $('#title');
    tt.hidden = false;
    tt.classList.remove('enter'); void tt.offsetWidth; tt.classList.add('enter');
    $('#hud').hidden = true;
    // 標題背景：第 1 關的場景＋四位英雄的低角度特寫
    try { const ts = R.createState(0, R.newParty(), 7, 'standard'); game.s = null; V.loadLevel(ts); V.titleScene(true); } catch (e) { console.warn('title', e); }
    M.coachEnd(false);
    if (game.diffBack) { game.diff = game.diffBack; game.diffBack = null; }
    game.daily = null;
    $('#dailyNote').textContent = M.dailyNote();
    const sv = load();
    $('#contBtn').hidden = !(sv && sv.party && sv.lv > 0);
    if (sv && sv.lv > 0) $('#contBtn').textContent = `繼續試用（第 ${sv.lv + 1} 關）`;
    SFX.intensity(0.5);
    SFX.music('menu');
  }

  // 標題畫面
  document.querySelectorAll('#diffs button').forEach(b => b.addEventListener('click', () => {
    game.diff = b.dataset.d;
    document.querySelectorAll('#diffs button').forEach(x => x.classList.toggle('sel', x === b));
    $('#diffNote').textContent = R.DIFFS[game.diff].text.split('。')[0] + '。';   // 標題只留第一句（數值），完整說明在操作說明
    SFX.init(); SFX.play('select');
  }));
  $('#diffNote').textContent = R.DIFFS[game.diff].text.split('。')[0] + '。';   // 標題只留第一句（數值），完整說明在操作說明
  $('#startBtn').onclick = () => { SFX.init(); SFX.play('click'); runLevel(0, R.newParty(), -1); };
  $('#contBtn').onclick = () => { SFX.init(); SFX.play('click'); const sv = load(); if (sv) { game.diff = sv.diff || game.diff; runLevel(sv.lv, sv.party); } };
  document.querySelectorAll('#title .b, #diffs button').forEach(b => b.addEventListener('pointerenter', () => SFX.play('hover')));
  $('#titleHelp').onclick = () => { SFX.init(); showHelp(); };
  // 每日挑戰：日期決定關卡與擲骰種子，標準難度，不影響戰役存檔
  const startDaily = () => {
    const d = M.daily();
    if (!game.diffBack) game.diffBack = game.diff;
    game.diff = d.diff;
    game.dailyNext = d.date;
    runLevel(d.lv, R.partyForLevel(d.lv), -1);
  };
  $('#dailyBtn').onclick = () => { SFX.init(); SFX.play('click'); startDaily(); };
  $('#recBtn').onclick = async () => { SFX.init(); SFX.play('select'); await UI.choose(M.recordsHtml(), 'records'); UI.closeModal(); };
  const tl = $('#titleLv');
  tl.innerHTML = '<option value="">章節選擇</option>' + LEVELS.map((L, i) => `<option value="${i}">第 ${L.n} 關・${esc(L.name)}</option>`).join('');
  tl.addEventListener('change', () => { if (tl.value === '') return; SFX.init(); const i = +tl.value; runLevel(i, R.partyForLevel(i)); });

  // 網址參數：?lv=3&diff=hard&auto=1（測試用）
  const q = new URLSearchParams(location.search);
  if (q.get('diff') && R.DIFFS[q.get('diff')]) game.diff = q.get('diff');
  if (q.get('daily') === '1') { game.noCoach = true; startDaily(); }
  else if (q.get('lv')) { game.noCoach = true; const i = Math.max(0, Math.min(LEVELS.length - 1, +q.get('lv') - 1)); runLevel(i, R.partyForLevel(i)); }   // 直達連結不跑新手引導
  else showTitle();
  addEventListener('resize', () => { if (!$('#title').hidden && V.titleOn) V.titleScene(true); });
  return game;
}
