// 上手與留存：關卡評分、成就、每日挑戰、戰報圖、第 1 關引導、手把。
// 這一層只「看」規則引擎的狀態與演出事件，不改規則、不動擲骰，也不碰戰役存檔（cancel-anytime-v1）；
// 紀錄另外存在 cancel-anytime-meta。
import { HEROES, HERO_ORDER, LEVELS } from './data.js';
import * as R from './rules.js';
import { SFX } from './audio.js';

const KEY = 'cancel-anytime-meta';
// 標準桿回合數：機器人在標準難度的平均回合 +1.5 後取整（tools/sim.mjs）
export const PAR = [5, 6, 7, 6, 7, 7, 8, 7, 9, 9];

export const ACHS = [
  { id: 'first', icon: '🧾', name: '第一筆退款', text: '打贏第 1 關' },
  { id: 'clean', icon: '🚑', name: '不用叫救護車', text: '整場沒有隊友倒地就過關' },
  { id: 'star3', icon: '⭐', name: '五星好評', text: '任一關拿到 3 顆星' },
  { id: 'crit', icon: '💥', name: '情緒傷害', text: '對敵人打出一次爆擊' },
  { id: 'fumble', icon: '🤡', name: '尷尬到腳趾抓地', text: '在自己的回合擲出大失敗' },
  { id: 'yeet', icon: '🪑', name: 'YEET！', text: '把東西（或人）丟出去' },
  { id: 'fall', icon: '🪂', name: '地心引力免運費', text: '把敵人推下高處' },
  { id: 'talk', icon: '🗣️', name: '嘴砲王', text: '戰前嘴砲成功 3 次' },
  { id: 'boss5', icon: '👔', name: '我要找你們經理', text: '擊倒 5 個首領' },
  { id: 'fast', icon: '⏱️', name: '趕時間', text: '比標準桿少 2 回合以上過關' },
  { id: 'hard', icon: '🔥', name: '硬派訂閱戶', text: '用硬派難度打贏任一關' },
  { id: 'daily', icon: '📅', name: '每日簽到', text: '完成一次每日挑戰' },
  { id: 'end', icon: '✅', name: '取消訂閱', text: '打完第 10 關' },
  { id: 'all3', icon: '🏆', name: '全勤獎', text: '同一難度 10 關全部 3 星' },
];

const blank = () => ({ v: 1, stars: {}, best: {}, ach: {}, n: { talk: 0, boss: 0 }, daily: {}, coach: 0 });
function loadData() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (d && typeof d === 'object') return Object.assign(blank(), d, { n: Object.assign({ talk: 0, boss: 0 }, d.n) });
  } catch (e) { /* 壞掉的紀錄當成沒有 */ }
  return blank();
}
const hash = (str) => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const pad2 = (n) => String(n).padStart(2, '0');
export const today = (d = new Date()) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
export const starStr = (n) => '★'.repeat(n) + '☆'.repeat(Math.max(0, 3 - n));

export function createMeta({ game, V, UI, $, esc }) {
  const D = loadData();
  const M = { data: D };
  const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(D)); } catch (e) { /* 無痕模式 */ } };
  let st = null;   // 這一場的統計

  // ── 成就 ──
  const toasts = [];
  let toastBusy = false;
  function nextToast() {
    const host = $('#ach');
    if (toastBusy || !toasts.length || !host) return;
    const a = toasts.shift();
    toastBusy = true;
    host.innerHTML = `<i>${a.icon}</i><div><small>成就解鎖</small><b>${esc(a.name)}</b><span>${esc(a.text)}</span></div>`;
    host.hidden = false;
    host.classList.remove('show'); void host.offsetWidth; host.classList.add('show');
    SFX.play('ding');
    setTimeout(() => { host.classList.remove('show'); setTimeout(() => { host.hidden = true; toastBusy = false; nextToast(); }, 260); }, 2600);
  }
  M.unlock = (id) => {
    if (D.ach[id] || game.auto) return false;
    const a = ACHS.find(x => x.id === id);
    if (!a) return false;
    D.ach[id] = Date.now();
    persist();
    toasts.push(a);
    nextToast();
    return true;
  };

  // ── 一場戰鬥的統計（從演出事件數，不讀也不改擲骰）──
  M.begin = () => { st = { crits: 0, fumbles: 0, kills: 0, bosses: 0, downs: 0, yeets: 0, falls: 0 }; };
  M.observe = (evs, s) => {
    if (!st || !s) return;
    const unit = (id) => s.units.find(u => u.id === id);
    for (const e of evs) {
      if (e.t === 'dmg' && e.crit) { const u = unit(e.id); if (u && u.side !== 'hero') { st.crits++; M.unlock('crit'); } }
      else if (e.t === 'sfx' && e.name === 'fumble') { const c = R.current(s); if (c && c.side === 'hero') { st.fumbles++; M.unlock('fumble'); } }
      else if (e.t === 'die') { const u = unit(e.id); if (u && u.side !== 'hero') { st.kills++; if (u.boss) { st.bosses++; if (!game.auto) { D.n.boss++; persist(); if (D.n.boss >= 5) M.unlock('boss5'); } } } }
      else if (e.t === 'down') { const u = unit(e.id); if (u && u.side === 'hero') st.downs++; }
      else if (e.t === 'yeet') { const u = unit(e.id); if (u && u.side === 'hero') { st.yeets++; M.unlock('yeet'); } }
      else if (e.t === 'push' && e.fall) { const u = unit(e.id); if (u && u.side !== 'hero') { st.falls++; M.unlock('fall'); } }
    }
  };
  M.talk = (ok) => { if (!ok || game.auto) return; D.n.talk++; persist(); if (D.n.talk >= 3) M.unlock('talk'); };

  // ── 過關評分：過關 1 星、沒人倒地 +1、標準桿內 +1 ──
  M.result = (s) => {
    const lv = s.lv, par = PAR[lv] || 8, x = st || { crits: 0, fumbles: 0, kills: 0, bosses: 0, downs: 0, yeets: 0, falls: 0 };
    const stars = 1 + (x.downs === 0 ? 1 : 0) + (s.round <= par ? 1 : 0);
    const res = { lv, diff: s.diff, rounds: s.round, par, stars, ...x, daily: game.daily || null, best: false };
    if (game.auto) return res;
    const k = s.diff + ':' + lv;
    if (!game.daily) {
      if ((D.stars[k] || 0) < stars) D.stars[k] = stars;
      if (!D.best[k] || s.round < D.best[k]) { D.best[k] = s.round; res.best = true; }
    } else {
      const p = D.daily[game.daily];
      if (!p || stars > p.stars || (stars === p.stars && s.round < p.rounds)) { D.daily[game.daily] = { stars, rounds: s.round, lv }; res.best = true; }
      // 只留最近 30 天
      const keys = Object.keys(D.daily).sort();
      while (keys.length > 30) delete D.daily[keys.shift()];
    }
    persist();
    if (lv === 0) M.unlock('first');
    if (x.downs === 0) M.unlock('clean');
    if (stars === 3) M.unlock('star3');
    if (s.round <= par - 2) M.unlock('fast');
    if (s.diff === 'hard') M.unlock('hard');
    if (game.daily) M.unlock('daily');
    if (lv === LEVELS.length - 1 && !game.daily) M.unlock('end');
    if (LEVELS.every((_, i) => D.stars[s.diff + ':' + i] === 3)) M.unlock('all3');
    return res;
  };
  // 收據上的評分列
  M.resultHtml = (r) => `<div class="rate"><p class="stars" aria-label="${r.stars} 顆星">${[0, 1, 2].map(i => `<i class="${i < r.stars ? 'on' : ''}" style="--i:${i}">★</i>`).join('')}</p>
    <p class="rstat"><span>⏱️ ${r.rounds} 回合<small>標準桿 ${r.par}</small></span><span>🚑 倒地 ${r.downs}</span><span>💥 爆擊 ${r.crits}</span><span>☠️ 擊倒 ${r.kills}</span></p>
    ${r.best && !game.auto ? '<p class="rbest">NEW RECORD · 刷新紀錄</p>' : ''}</div>`;

  // ── 每日挑戰：日期決定關卡與擲骰種子，同一天大家打的是同一場 ──
  M.daily = (date = today()) => { const h = hash('cancel-anytime:' + date); return { date, lv: h % LEVELS.length, seed: (h >>> 3) || 1, diff: 'standard' }; };
  M.dailyNote = () => { const d = M.daily(), p = D.daily[d.date]; return p ? `今日已完成 ${starStr(p.stars)}・${p.rounds} 回合` : `第 ${LEVELS[d.lv].n} 關・固定擲骰`; };

  // ── 紀錄與成就（標題選單）──
  M.recordsHtml = () => {
    const got = ACHS.filter(a => D.ach[a.id]).length;
    const diffs = Object.keys(R.DIFFS);
    const rows = LEVELS.map((L, i) => `<tr><th>${L.n}</th><td class="ln">${esc(L.name.split('・')[0])}</td>${diffs.map(d => { const n = D.stars[d + ':' + i] || 0, b = D.best[d + ':' + i]; return `<td class="${n ? 'got' : ''}">${n ? starStr(n) : '—'}${b ? `<small>${b} 回合</small>` : ''}</td>`; }).join('')}</tr>`).join('');
    return `<h2>🏆 紀錄與成就</h2>
      <p class="intro">成就 ${got} / ${ACHS.length}　·　嘴砲成功 ${D.n.talk} 次　·　擊倒首領 ${D.n.boss} 個</p>
      <div class="achs">${ACHS.map(a => `<div class="ach${D.ach[a.id] ? ' got' : ''}"><i>${D.ach[a.id] ? a.icon : '🔒'}</i><b>${esc(a.name)}</b><small>${esc(a.text)}</small></div>`).join('')}</div>
      <table class="rec"><thead><tr><th></th><th></th>${diffs.map(d => `<th>${esc(R.DIFFS[d].name)}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table>
      <div class="row"><button class="b" data-v="ok">關閉</button></div>`;
  };

  // ── 戰報圖：2D 畫布合成（背景是當下的 3D 畫面，取不到就用純色）──
  const loadImg = (src) => new Promise(res => { if (!src) return res(null); const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });
  const FONT = 'system-ui,-apple-system,"PingFang TC","Microsoft JhengHei","Noto Sans TC",sans-serif';
  function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  function star(g, cx, cy, r, on) {
    g.beginPath();
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, q = i % 2 ? r * 0.46 : r; g.lineTo(cx + Math.cos(a) * q, cy + Math.sin(a) * q); }
    g.closePath();
    g.fillStyle = on ? '#ffc531' : '#ffffff22'; g.fill();
    g.lineWidth = 5; g.strokeStyle = '#000'; g.stroke();
  }
  M.card = async (s, r, snap) => {
    const W = 1200, H = 630, cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const g = cv.getContext('2d');
    g.fillStyle = '#1b1820'; g.fillRect(0, 0, W, H);
    const bg = await loadImg(snap);
    if (bg && bg.width > 8) {
      const k = Math.max(W / bg.width, H / bg.height), w = bg.width * k, h = bg.height * k;
      g.drawImage(bg, (W - w) / 2, (H - h) / 2, w, h);
    }
    // 右側壓暗，讓字讀得清楚
    const sh = g.createLinearGradient(0, 0, W, 0);
    sh.addColorStop(0, '#120e1a30'); sh.addColorStop(0.45, '#120e1a90'); sh.addColorStop(1, '#120e1af2');
    g.fillStyle = sh; g.fillRect(0, 0, W, H);
    // 公路牌
    const sx = 600, sy = 44, sw = 552, shh = 168;
    g.fillStyle = '#000'; rr(g, sx + 6, sy + 8, sw, shh, 22); g.fill();
    g.fillStyle = '#0e6b3f'; rr(g, sx, sy, sw, shh, 22); g.fill();
    g.lineWidth = 6; g.strokeStyle = '#fff'; rr(g, sx + 9, sy + 9, sw - 18, shh - 18, 15); g.stroke();
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = '#fff'; g.font = `900 76px ${FONT}`; g.fillText('絕命免運費', sx + sw / 2, sy + 76);
    g.fillStyle = '#ffc531'; g.font = `900 26px ${FONT}`; g.fillText('C A N C E L   A N Y T I M E', sx + sw / 2, sy + 132);
    // 關卡
    const L = LEVELS[r.lv];
    g.textAlign = 'left';
    g.fillStyle = '#ffc531'; g.font = `900 24px ${FONT}`;
    g.fillText(`${r.daily ? '每日挑戰 ' + r.daily + ' · ' : ''}第 ${L.n} 關 · ${R.DIFFS[r.diff] ? R.DIFFS[r.diff].name : ''}`, sx, 258);
    g.fillStyle = '#fff'; g.font = `900 40px ${FONT}`;
    let name = L.name; while (g.measureText(name).width > sw && name.length > 4) name = name.slice(0, -2) + '…';
    g.fillText(name, sx, 304);
    // 星星與數字
    for (let i = 0; i < 3; i++) star(g, sx + 52 + i * 104, 392, 46, i < r.stars);
    g.font = `900 30px ${FONT}`; g.fillStyle = '#fff';
    g.fillText(`${r.rounds} 回合`, sx + 330, 376);
    g.font = `700 22px ${FONT}`; g.fillStyle = '#ffffffb0';
    g.fillText(`標準桿 ${r.par}`, sx + 330, 412);
    g.font = `700 24px ${FONT}`; g.fillStyle = '#fff';
    g.fillText(`倒地 ${r.downs}　爆擊 ${r.crits}　擊倒 ${r.kills}`, sx, 474);
    // 隊伍頭像
    const ims = await Promise.all(HERO_ORDER.map(k => loadImg(UI.portrait(k))));
    ims.forEach((im, i) => {
      const x = sx + i * 92, y = 510, d = 80;
      g.fillStyle = HEROES[HERO_ORDER[i]].color || '#fff'; rr(g, x, y, d, d, 12); g.fill();
      if (im) { g.save(); rr(g, x + 4, y + 4, d - 8, d - 8, 9); g.clip(); g.drawImage(im, x + 4, y + 4, d - 8, d - 8); g.restore(); }
      g.lineWidth = 4; g.strokeStyle = '#000'; rr(g, x, y, d, d, 12); g.stroke();
    });
    g.textAlign = 'right'; g.font = `700 18px ${FONT}`; g.fillStyle = '#ffffff90';
    g.fillText('原創回合制戰術 RPG', W - 48, 560);
    g.fillText(today(), W - 48, 586);
    return cv;
  };
  // 存檔或分享。回傳 'share' | 'save' | null
  M.shareCard = async (s, r, snap) => {
    try {
      const cv = await M.card(s, r, snap);
      const blob = await new Promise(res => cv.toBlob(res, 'image/png'));
      if (!blob) return null;
      const name = `cancel-anytime-L${LEVELS[r.lv].n}-${r.stars}star.png`;
      const file = typeof File === 'function' ? new File([blob], name, { type: 'image/png' }) : null;
      if (file && matchMedia('(pointer: coarse)').matches && navigator.canShare && navigator.canShare({ files: [file] })) {
        try { await navigator.share({ files: [file], title: '絕命免運費 · CANCEL ANYTIME' }); return 'share'; } catch (e) { if (e && e.name === 'AbortError') return null; }
      }
      const a = document.createElement('a'), url = URL.createObjectURL(blob);
      a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      return 'save';
    } catch (e) { console.warn('card', e); return null; }
  };

  // ── 第 1 關引導：跟著玩家的實際操作前進，可隨時跳過；只看狀態，不擋操作 ──
  const coach = { on: false, step: 0 };
  const STEPS = [
    ['① 移動', '點發亮的青色格子走過去。站上高地打人命中 +2，從背後打有優勢。'],
    ['② 出手', '點下方的技能，再點目標；直接點敵人會自動用普通攻擊。'],
    ['③ 附贈動作', '一回合有「動作」和「附贈動作」各一次，還能再用一招。沒事做就按「結束回合」。'],
    ['④ 地形', '把敵人推下高處、推進地表或 YEET 出去都有額外效果。Q／E 或右上角的箭頭可以轉鏡頭。'],
  ];
  function coachShow() {
    const el = $('#coach');
    if (!el) return;
    if (!coach.on) { el.hidden = true; return; }
    const [h, t] = STEPS[coach.step];
    el.hidden = false;
    el.querySelector('b').textContent = h;
    el.querySelector('p').textContent = t;
    el.querySelector('em').textContent = `${coach.step + 1} / ${STEPS.length}`;
  }
  M.coachStart = (idx) => {
    coach.on = idx === 0 && !D.coach && !game.auto && !game.daily && !game.noCoach;
    coach.step = 0;
    const el = $('#coach');
    if (el) el.hidden = true;   // 輪到玩家才出現
  };
  M.coachEnd = (seen) => { if (!coach.on) return; coach.on = false; if (seen) { D.coach = 1; persist(); } coachShow(); };
  // when：'turn'（輪到玩家）、'act'（做完一個行動）、'end'（按了結束回合）
  M.coachSync = (when) => {
    if (!coach.on) return;
    const s = game.s, u = s && R.current(s);
    if (!s || s.over || !u) { M.coachEnd(false); return; }
    if (when === 'act') {
      if (coach.step === 0 && (u.moveLeft < u.move || !u.action)) coach.step = 1;
      if (coach.step === 1 && !u.action) coach.step = 2;
    } else if (when === 'end') {
      // 還沒做過的步驟不跳過（例如第一回合只走路沒出手，下一回合繼續教出手）
      if (coach.step === 2) coach.step = 3; else if (coach.step === 3) { M.coachEnd(true); return; }
    }
    coachShow();
  };
  M.coachHide = () => { const el = $('#coach'); if (el) el.hidden = true; };
  { const b = $('#coachSkip'); if (b) b.onclick = () => { SFX.play('click'); M.coachEnd(true); }; }

  // ── 手把（標準配置）──
  // 十字鍵／左類比：移動格子游標或選單焦點；A 確認、B 取消、X 換技能、Y 結束回合；
  // LB／RB 轉鏡頭、LT／RT 縮放、右類比平移、Start 設定。api 由 main.js 提供，這裡只負責輪詢與連發。
  M.padStart = (api) => {
    if (typeof navigator === 'undefined' || !navigator.getGamepads) return;
    const prev = [];
    let running = false, rep = { key: '', t: 0, n: 0 }, last = 0, hello = false;
    const pads = () => { try { return [...navigator.getGamepads()].filter(p => p && p.connected); } catch (e) { return []; } };
    const dirKey = (p) => {
      const b = (i) => !!(p.buttons[i] && p.buttons[i].pressed), ax = p.axes[0] || 0, ay = p.axes[1] || 0;
      if (b(12) || ay < -0.55) return 'up';
      if (b(13) || ay > 0.55) return 'down';
      if (b(14) || ax < -0.55) return 'left';
      if (b(15) || ax > 0.55) return 'right';
      return '';
    };
    const DIR = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
    function poll(now) {
      const list = pads();
      if (!list.length) { running = false; return; }
      requestAnimationFrame(poll);
      const dt = Math.min(0.05, (now - last) / 1000 || 0); last = now;
      const p = list[0];
      if (!hello) { hello = true; api.hello(); }
      // 按鈕：按下的那一幀觸發
      const hit = (i) => { const d = !!(p.buttons[i] && p.buttons[i].pressed), was = !!prev[i]; prev[i] = d; return d && !was; };
      if (hit(0)) api.confirm();
      if (hit(1)) api.cancel();
      if (hit(2)) api.cycle(1);
      if (hit(3)) api.endTurn();
      if (hit(4)) api.rotate(-1);
      if (hit(5)) api.rotate(1);
      if (hit(8) || hit(9)) api.menu();
      // 縮放與平移：按住連續
      const lt = p.buttons[6] ? p.buttons[6].value : 0, rt = p.buttons[7] ? p.buttons[7].value : 0;
      if (lt > 0.2) api.zoom(1 + 0.9 * lt * dt);
      if (rt > 0.2) api.zoom(1 - 0.9 * rt * dt);
      const rx = p.axes[2] || 0, ry = p.axes[3] || 0;
      if (Math.abs(rx) > 0.25 || Math.abs(ry) > 0.25) api.pan(rx * 14 * dt, ry * 14 * dt);
      // 方向：第一下立刻，按住 0.28 秒後每 0.12 秒連發
      const k = dirKey(p);
      if (k !== rep.key) { rep = { key: k, t: now, n: 0 }; if (k) api.dir(DIR[k][0], DIR[k][1]); }
      else if (k && now - rep.t > (rep.n ? 120 : 280)) { rep.t = now; rep.n++; api.dir(DIR[k][0], DIR[k][1]); }
    }
    const kick = () => { if (!running && pads().length) { running = true; last = performance.now(); requestAnimationFrame(poll); } };
    addEventListener('gamepadconnected', kick);
    kick();
    M.padKick = kick;
  };

  return M;
}
