// HUD：只在數值改變時寫 DOM。雷達以玩家為中心旋轉。
import { TEAM_COLOR, TEAM_NAME, WEAPONS } from '../game/state.js';
import { CSS } from './style.js';
import { ASSET_BASE } from '../core/assets.js';
import { spreadOf } from '../game/weapons.js';

let G, L, $ = {}, last = {}, rc, rctx, base, viewR = 42, acts, fpsT = 0, coneFill, coneEdge;
/** 設定頁寫入：比賽畫面右上角顯示幀率。 */
export const hudOpt = { fps: false, xdyn: true };
let xd = 0;   // 動態準星目前多開的間距（px）
const ICONS = Object.keys(WEAPONS);
const coarse = matchMedia('(pointer:coarse)').matches;
const el = (tag, id, cls, parent) => { const e = document.createElement(tag); if (id) e.id = id; if (cls) e.className = cls; parent?.appendChild(e); return e; };
function set(k, node, v) { if (last[k] !== v) { last[k] = v; node.textContent = v; } }

function drawBase(overview) {
  const S = 1000, c = document.createElement('canvas'); c.width = c.height = S;
  const x = c.getContext('2d'), b = L.bounds, k = S / (b.x1 - b.x0), X = v => (v - b.x0) * k, Y = v => (b.z1 - v) * k;
  x.fillStyle = '#17130e'; x.fillRect(0, 0, S, S);
  const shade = y => { const t = Math.max(0, Math.min(1, (y + 3) / 12.5)); return `rgb(${58 + t * 74},${50 + t * 58},${38 + t * 40})`; };
  for (const g of L.ground) { x.fillStyle = shade(g.y); x.fillRect(X(g.x0), Y(g.z1), (g.x1 - g.x0) * k, (g.z1 - g.z0) * k); }
  for (const r of L.ramps) { x.fillStyle = shade((r.y0 + r.y1) / 2); x.fillRect(X(r.x0), Y(r.z1), (r.x1 - r.x0) * k, (r.z1 - r.z0) * k); }
  for (const b2 of L.blocks) if (!b2.plinth && b2.y1 > 6) { x.fillStyle = '#100d09'; x.fillRect(X(b2.x0), Y(b2.z1), (b2.x1 - b2.x0) * k, (b2.z1 - b2.z0) * k); }
  if (overview) { x.globalAlpha = 0.42; x.drawImage(overview, 0, 0, S, S); x.globalAlpha = 1; }  // 俯視實拍底圖只當質感，動線仍以色塊為主才看得清楚
  x.font = '700 58px system-ui'; x.textAlign = 'center'; x.textBaseline = 'middle';
  for (const n of ['A', 'B']) { const s = L.sites[n]; x.fillStyle = '#C4552D55'; x.fillRect(X(s.x0), Y(s.z1), (s.x1 - s.x0) * k, (s.z1 - s.z0) * k); x.fillStyle = '#f2b49c'; x.fillText(n, X((s.x0 + s.x1) / 2), Y((s.z0 + s.z1) / 2)); }
  base = c;
}

export function initHud(root, g, layout, actions) {
  acts = actions;
  G = g; L = layout;
  const icons = ICONS.map(i => `.ic-${i}{--m:url(${ASSET_BASE}ui/${i}.webp)}`).join('');
  const st = document.createElement('style'); st.textContent = CSS + icons; document.head.appendChild(st);
  const h = el('div', 'hudroot', '', root); $.root = h;
  const rad = el('div', 'radar', 'h-b', h); rc = el('canvas', '', '', rad); rc.width = rc.height = 300; rctx = rc.getContext('2d');
  // 視野扇形：雷達以玩家為中心旋轉、玩家永遠朝上，漸層的圓心固定，開機建一次就好
  coneFill = rctx.createRadialGradient(150, 150, 8, 150, 150, CONE_R); coneFill.addColorStop(0, '#f2e9d85c'); coneFill.addColorStop(1, '#f2e9d800');
  coneEdge = rctx.createRadialGradient(150, 150, 8, 150, 150, CONE_R); coneEdge.addColorStop(0, '#f2e9d8a6'); coneEdge.addColorStop(1, '#f2e9d800');
  $.zone = el('div', 'zone', '', h);
  const top = el('div', 'top', '', h);
  $.r0 = el('div', '', 'roster', top); const s0 = el('div', '', 'sc sa', top); $.clock = el('div', 'clock', '', top); const s1 = el('div', '', 'sc sd', top); $.r1 = el('div', '', 'roster', top);
  $.s0 = el('b', '', '', s0); $.a0 = el('small', '', '', s0); $.s1 = el('b', '', '', s1); $.a1 = el('small', '', '', s1);
  for (const [n, c] of [[$.r0, TEAM_COLOR[0]], [$.r1, TEAM_COLOR[1]]]) { n.style.setProperty('--c', c); for (let i = 0; i < 5; i++) el('i', '', '', n); }
  // 底部一條赭線：左段是生命、右段是彈匣，兩端都朝中央回合徽章收。
  const strip = el('div', 'strip', '', h);
  const L0 = el('div', '', 'sd', strip); $.money = el('div', 'money', '', L0);
  $.hpW = el('div', '', 'nb', L0); $.hp = el('b', '', '', $.hpW); el('span', '', '', $.hpW).textContent = '生命';
  $.arW = el('div', '', 'nb', L0); $.ar = el('b', '', '', $.arW); $.arL = el('span', '', '', $.arW); $.arL.textContent = '護甲';
  $.lnL = el('div', '', 'ln', L0); $.bar = el('b', '', '', $.lnL);
  $.emblem = el('div', 'emblem', '', strip);
  const R0 = el('div', '', 'sd', strip); $.lnR = el('div', '', 'ln r', R0); $.mag = el('b', '', '', $.lnR);
  $.wn = el('div', 'wn', '', R0); $.amW = el('div', '', 'nb', R0); $.am = el('b', '', '', $.amW); $.rs = el('span', '', '', $.amW);
  $.rack = el('div', 'rack', '', h); $.log = el('div', 'log', '', h);
  $.feed = el('div', 'feed', '', h); for (let i = 0; i < 5; i++) { const d = el('div', '', '', $.feed); d.style.display = 'none'; }
  $.banner = el('div', 'banner', '', h); $.hint = el('div', 'hint', '', h);
  $.rwin = el('div', 'rwin', '', h); $.rwT = el('h3', '', '', $.rwin); $.rwP = el('p', '', '', $.rwin);
  $.fpsr = el('div', 'fpsr', '', h); $.fpsr.style.display = 'none';
  $.cross = el('div', 'cross', 'xh', h); for (let i = 0; i < 4; i++) el('i', '', '', $.cross);
  $.hit = el('div', 'hit', '', h); $.hurt = el('div', 'hurt', '', h); el('i', '', '', $.hurt);
  $.scope = el('div', 'scope', '', h); el('div', '', 'r', $.scope); el('div', '', 'x', $.scope); el('div', '', 'y', $.scope);
  $.prog = el('div', 'prog', '', h); $.pt = el('p', '', '', $.prog); const pb = el('div', '', '', $.prog); $.pb = el('b', '', '', pb);
  $.flash = el('div', 'flash', '', root);
  drawBase();
  const ov = new Image(); ov.onload = () => drawBase(ov); ov.src = ASSET_BASE + 'radar.webp';
}

const CONE_R = 138;   // 約 39 m，停在雷達圓框內
function radar() {
  const m = G.me, S = 300, x = rctx, b = L.bounds, k = 1000 / (b.x1 - b.x0), sc = (S / 2) / viewR;
  x.setTransform(1, 0, 0, 1, 0, 0); x.fillStyle = '#17130e'; x.fillRect(0, 0, S, S);
  x.save(); x.translate(S / 2, S / 2); x.rotate(-m.yaw); x.scale(sc / k, sc / k); x.translate(-(m.x - b.x0) * k, -(b.z1 - m.z) * k);
  x.drawImage(base, 0, 0); x.restore();
  // 張角用相機實際的水平視角：開鏡會收窄，直式手機較寬
  const h = Math.min(1.4, acts.viewFov() / 2), c0 = S / 2;
  x.beginPath(); x.moveTo(c0, c0); x.arc(c0, c0, CONE_R, -Math.PI / 2 - h, -Math.PI / 2 + h); x.closePath();
  x.fillStyle = coneFill; x.fill(); x.strokeStyle = coneEdge; x.lineWidth = 1.5; x.stroke();
  const P = (px, pz) => { const dx = px - m.x, dz = pz - m.z, c = Math.cos(m.yaw), s = Math.sin(m.yaw); return [S / 2 + (dx * c - dz * s) * sc, S / 2 - (dx * s + dz * c) * sc]; };
  for (const a of G.agents) {
    if (a === m || !a.alive || (a.team !== m.team && !(a.seen > 0))) continue;
    const [px, py] = P(a.x, a.z); x.fillStyle = a.team === m.team ? '#e8dcc4' : '#e0432a'; x.beginPath(); x.arc(px, py, 6, 0, 6.3); x.fill();
  }
  if (G.charge) { const [px, py] = P(G.charge.x, G.charge.z); x.fillStyle = '#ffd25a'; x.fillRect(px - 5, py - 5, 10, 10); }
  // 掉在地上的裝藥只有攻方看得到：空心框，和已安裝的實心框分開
  else if (G.drop.on && m.team === 0) { const [px, py] = P(G.drop.x, G.drop.z); x.strokeStyle = '#ffd25a'; x.lineWidth = 2.5; x.strokeRect(px - 5, py - 5, 10, 10); }
  x.fillStyle = TEAM_COLOR[m.team]; x.beginPath(); x.moveTo(S / 2, S / 2 - 11); x.lineTo(S / 2 + 7, S / 2 + 7); x.lineTo(S / 2 - 7, S / 2 + 7); x.fill();
}

const mmss = t => { t = Math.max(0, Math.ceil(t)); return `${t / 60 | 0}:${String(t % 60).padStart(2, '0')}`; };
let radT = 0, showing = false, canBuyShown = false;
// 右側武器欄：編號＋剪影，手上那把亮白並標名。
function rack(m) {
  const busy = m.reloadT > 0, k = `${m.primary}|${m.secondary}|${m.nades.join()}|${m.hasCharge}|${m.cur}|${busy}`;
  if (last.rk === k) return; last.rk = k;
  const row = (n, id) => { const on = m.cur === id; return `<div class="w${on ? ' on' : ''}">${on ? `<span>${busy ? '裝填中' : WEAPONS[id].name}</span>` : ''}<i class="ic ic-${id}"></i><s>${n}</s></div>`; };
  let h = '';
  if (m.primary) h += row(1, m.primary);
  h += row(2, m.secondary) + row(3, 'knife');
  if (m.nades.length) {
    const on = m.nades.includes(m.cur);
    h += `<div class="w n${on ? ' on' : ''}">${on ? `<span>${WEAPONS[m.cur].name}</span>` : ''}${m.nades.map(id => `<i class="ic ic-${id}${id === m.cur || !on ? '' : ' off'}"></i>`).join('')}<s>4</s></div>`;
  }
  if (m.hasCharge) h += row(5, 'charge');
  $.rack.innerHTML = h;
}

export function frameHud(dt) {
  if (canBuyShown !== !!G.canBuy) { canBuyShown = !!G.canBuy; document.body.classList.toggle('canbuy', canBuyShown); }
  const m = G.me, on = !!m && G.phase !== 'menu' && G.phase !== 'over';
  if (on !== showing) { showing = on; $.root.style.display = on ? 'block' : 'none'; document.body.classList.toggle('playing', on); }
  if ($.flash.style.opacity !== String(+Math.min(1, G.flash).toFixed(2))) $.flash.style.opacity = Math.min(1, G.flash).toFixed(2);
  if (!on) return;
  radT -= dt; if (radT <= 0) { radT = 1 / 20; radar(); }
  if (last.fpsOn !== hudOpt.fps) { last.fpsOn = hudOpt.fps; $.fpsr.style.display = hudOpt.fps ? 'block' : 'none'; }
  if (hudOpt.fps && (fpsT -= dt) <= 0) { fpsT = 0.5; set('fps', $.fpsr, Math.round(acts.fps()) + ' fps'); }
  set('s0', $.s0, String(G.score[0])); set('s1', $.s1, String(G.score[1]));
  set('clock', $.clock, mmss(G.time));
  const hot = G.phase === 'planted'; if (last.hot !== hot) { last.hot = hot; $.clock.className = hot ? 'hot' : ''; }
  for (let t = 0; t < 2; t++) {
    let c = 0, i = 0; for (const a of G.agents) if (a.team === t) { const d = a.alive ? 0 : 1; c = c * 2 + d; i++; }
    let n = 0; for (const a of G.agents) if (a.team === t && a.alive) n++; set('al' + t, t ? $.a1 : $.a0, `存活 ${n}`);
    const key = 'ros' + t; if (last[key] !== c) { last[key] = c; let j = 0; const nodes = (t ? $.r1 : $.r0).children; for (const a of G.agents) if (a.team === t) nodes[j++].className = a.alive ? '' : 'x'; }
  }
  set('hp', $.hp, String(Math.ceil(m.hp))); set('ar', $.ar, String(Math.ceil(m.armor))); set('arL', $.arL, m.helmet ? '護甲＋盔' : '護甲');
  const w = Math.round(m.hp), low = w <= 25;
  if (last.w !== w) { last.w = w; $.bar.style.transform = `scaleX(${w / 100})`; }
  if (last.low !== low) { last.low = low; $.hpW.classList.toggle('low', low); $.lnL.classList.toggle('low', low); }
  set('money', $.money, '$' + m.money);
  set('emb', $.emblem, String(G.round)); if (last.embT !== m.team) { last.embT = m.team; $.emblem.style.setProperty('--c', TEAM_COLOR[m.team]); }
  const W = WEAPONS[m.cur], cur = W?.mag ? (m.ammo[m.cur] ?? 0) : -1;
  set('am', $.am, cur < 0 ? '' : String(cur)); set('rs', $.rs, cur < 0 ? '' : `/ ${m.rsv[m.cur] ?? 0}`); set('wn', $.wn, m.reloadT > 0 ? '裝填中' : W?.name ?? '');
  const fill = cur < 0 ? 1 : Math.round(cur / W.mag * 100) / 100, dry = cur >= 0 && cur <= Math.ceil(W.mag * 0.2);
  if (last.fill !== fill) { last.fill = fill; $.mag.style.transform = `scaleX(${fill})`; }
  if (last.dry !== dry) { last.dry = dry; $.amW.classList.toggle('low', dry); $.lnR.classList.toggle('low', dry); }
  rack(m);
  set('zone', $.zone, G.zone);
  const won = G.phase === 'post' && !!G.mvp;
  set('banner', $.banner, !won && G.bannerT > 0 ? G.banner : '');
  const rw = won ? G.round + G.banner : '';
  if (last.rw !== rw) {
    last.rw = rw; $.rwin.style.display = won ? 'block' : 'none';
    if (won) {
      const v = G.mvp, i = G.banner.indexOf(' · ');
      $.rwin.style.setProperty('--c', TEAM_COLOR[v.team]);
      $.rwT.innerHTML = `${TEAM_NAME[v.team]}勝<small>${i > 0 ? G.banner.slice(i + 3) : ''}</small>`;
      $.rwP.innerHTML = `本回合最佳<b>${v.name}</b>${v.kills} 擊殺 · ${v.dmg} 傷害${v.obj ? ' · 完成目標' : ''}`;
    }
  }
  const hint = G.phase === 'buy' ? (coarse ? '點「買」開啟購買' : '按 B 開啟購買') : m.hasCharge && G.phase === 'live' ? (coarse ? '攜帶裝藥：到炸點按住手掌安裝' : '攜帶裝藥：到炸點按住 E 安裝，G 丟下') : G.drop.on && m.team === 0 && G.phase === 'live' ? '裝藥掉在地上，照雷達的空心框去撿' : G.charge && m.team === 1 ? '找到裝藥，按住 E 拆除' : '';
  set('hint', $.hint, hint);
  const hm = G.hitMark > 0 ? Math.min(1, G.hitMark).toFixed(2) : '0'; if (last.hm !== hm) { last.hm = hm; $.hit.style.opacity = hm; }
  const dd = G.dmgT > 0 ? G.dmgT.toFixed(2) : '0'; if (last.dd !== dd) { last.dd = dd; $.hurt.style.opacity = dd; $.hurt.style.transform = `rotate(${G.dmgDir.toFixed(2)}rad)`; }
  if (last.sc !== G.scoped) { last.sc = G.scoped; $.scope.style.display = G.scoped ? 'block' : 'none'; $.cross.style.display = G.scoped ? 'none' : 'block'; }
  // 動態準星：間距多開「目前散布 − 站定散布」換算成的像素，再加連發的後座量；和 fire() 用同一個 spreadOf
  let xt = 0;
  if (hudOpt.xdyn && m.alive) {
    const w = WEAPONS[m.cur], e = Math.max(0, spreadOf(m) - (w?.spread ?? 0)) + (w?.rec ? Math.min(0.02, m.burst * 0.0025) : 0);
    xt = Math.min(90, Math.tan(e) / Math.tan(acts.viewFov() / 2) * innerWidth / 2);
  }
  xd += (xt - xd) * Math.min(1, dt * (xt > xd ? 30 : 12));
  const xr = Math.round(xd * 2) / 2; if (last.xd !== xr) { last.xd = xr; $.cross.style.setProperty('--xd', xr + 'px'); }
  const p = G.plantP || G.defuseP, pv = p ? p.toFixed(3) : '0';
  if (last.p !== pv) { last.p = pv; $.prog.style.display = p ? 'block' : 'none'; $.pb.style.width = (p * 100) + '%'; $.pt.textContent = G.plantP ? '安裝裝藥' : '拆除裝藥'; }
  let key = ''; for (let i = 0; i < G.feed.length; i++) { const e = G.feed[i]; if (e.t > 0) key += e.killer + e.victim + (e.t < 1 ? e.t.toFixed(1) : ''); }
  if (last.fd !== key) {
    last.fd = key; const nodes = $.feed.children; let j = 0;
    for (let i = Math.max(0, G.feed.length - 5); i < G.feed.length; i++) {
      const e = G.feed[i]; if (e.t <= 0) continue; const n = nodes[j++]; n.style.display = ''; n.style.opacity = e.t < 1 ? e.t.toFixed(1) : ''; n.className = e.mine ? 'me' : '';
      const wp = e.wid ? `<i class="ic ic-${e.wid}" title="${e.weapon}"></i>` : `<span>${e.weapon}</span>`;
      n.innerHTML = `<u style="color:${TEAM_COLOR[e.kteam]}">${e.killer}</u>${wp}${e.head ? '<em>爆頭</em>' : ''}<u style="color:${TEAM_COLOR[e.vteam]}">${e.victim}</u>`;
    }
    for (; j < nodes.length; j++) nodes[j].style.display = 'none';
  }
  key = ''; for (let i = 0; i < G.log.length; i++) { const e = G.log[i]; if (e.t > 0) key += e.text + (e.t < 1 ? e.t.toFixed(1) : ''); }
  if (last.lg !== key) {
    last.lg = key; let h = '';
    for (let i = 0; i < G.log.length; i++) { const e = G.log[i]; if (e.t > 0) h += `<div class="${e.gold ? 'g' : ''}"${e.t < 1 ? ` style="opacity:${e.t.toFixed(1)}"` : ''}>${e.text}</div>`; }
    $.log.innerHTML = h;
  }
}
