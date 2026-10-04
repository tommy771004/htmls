// HUD：羅盤、小地圖與大地圖、毒圈倒數、擊殺紀錄、存活人數、生命護甲、武器彈藥、提示與命中回饋。
import { EXT, N, CELL } from '../core/map.js';
import { WEAPONS, RARITY, AMMO, STORM, PLATE, magOf, lootLabel, decodeLoot } from '../core/rules.js';
import { MODE } from '../core/player.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

// 全島地圖圖片（一次產生，小地圖與大地圖共用）
export function mapImage(W) {
  const S = 1024, c = document.createElement('canvas'); c.width = c.height = S;
  const x = c.getContext('2d');
  const img = x.createImageData(S, S), d = img.data;
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
    const gi = Math.min(N - 1, Math.round((i / (S - 1)) * (N - 1))), gj = Math.min(N - 1, Math.round((j / (S - 1)) * (N - 1)));
    const h = W.H[gj * N + gi];
    let r, g, b;
    if (h < -0.3) { const k = Math.min(1, -h / 12); r = 58 - 30 * k; g = 104 - 40 * k; b = 106 - 30 * k; }
    else if (h < 2.2) { r = 214; g = 196; b = 152; }
    else { const k = Math.min(1, h / 140); r = 150 + 40 * k; g = 152 + 18 * k; b = 96 + 40 * k; const sh = (h - (W.H[gj * N + Math.max(0, gi - 1)] || h)) * 2.2; r += sh; g += sh; b += sh; }
    const o = (j * S + i) * 4; d[o] = r; d[o + 1] = g; d[o + 2] = b; d[o + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  const k = S / (EXT * 2), P = (v) => (v + EXT) * k;
  x.lineCap = 'round'; x.lineJoin = 'round';
  x.strokeStyle = 'rgba(70,58,44,.75)'; x.lineWidth = 3.2;
  for (const rd of W.roads) { x.beginPath(); rd.pts.forEach((p, i) => (i ? x.lineTo(P(p[0]), P(p[2])) : x.moveTo(P(p[0]), P(p[2])))); x.stroke(); }
  x.strokeStyle = 'rgba(80,72,62,.85)'; x.lineWidth = W.runway.w * k;
  x.beginPath(); x.moveTo(P(W.runway.pts[0][0]), P(W.runway.pts[0][2])); x.lineTo(P(W.runway.pts[1][0]), P(W.runway.pts[1][2])); x.stroke();
  x.strokeStyle = '#d9d2c2'; x.lineWidth = 6 * k + 2;
  for (const b of W.bridges || []) { x.beginPath(); x.moveTo(P(b.ax), P(b.az)); x.lineTo(P(b.bx), P(b.bz)); x.stroke(); }
  x.fillStyle = 'rgba(120,112,98,.85)';
  for (const [x0, z0, x1, z1] of W.pads) x.fillRect(P(x0), P(z0), (x1 - x0) * k, (z1 - z0) * k);
  x.fillStyle = '#efe6d2';
  for (const b of W.buildings) x.fillRect(P(b.x0), P(b.z0), Math.max(1.5, (b.x1 - b.x0) * k), Math.max(1.5, (b.z1 - b.z0) * k));
  x.fillStyle = '#ece6da';
  for (const cy of W.cyls) if (cy[5] >= 0 && cy[2] > 1.5) { x.beginPath(); x.arc(P(cy[0]), P(cy[1]), Math.max(1.5, cy[2] * k), 0, 7); x.fill(); }
  return c;
}

export function makeHud(W, img) {
  const H = {};
  const mini = $('miniC').getContext('2d'), big = $('bigC').getContext('2d');
  // 羅盤刻度
  const strip = $('cstrip');
  const labels = { 0: '北', 45: '東北', 90: '東', 135: '東南', 180: '南', 225: '西南', 270: '西', 315: '西北' };
  let html = '';
  for (let a = -360; a <= 720; a += 15) { const n = ((a % 360) + 360) % 360; html += `<span class="tk${labels[n] ? ' c' : ''}" style="left:${(a + 360) * 3}px">${labels[n] || n}</span>`; }
  strip.innerHTML = html;
  const plates = $('plates');
  let lastPlates = -1, feedN = 0;
  const feed = $('feed');
  H.feed = (html, me) => {
    const el = document.createElement('div'); el.className = 'kf' + (me ? ' me' : ''); el.innerHTML = html; feed.prepend(el);
    while (feed.children.length > 6) feed.lastChild.remove();
    const id = ++feedN; setTimeout(() => { el.remove(); void id; }, 7000);
  };
  H.hit = (hs, kill, armor) => { const e = $('hit'); e.className = ''; void e.offsetWidth; e.className = 'on' + (kill ? ' kill' : hs ? ' hs' : armor ? ' armor' : ''); };
  H.dmgNum = (sx, sy, d, hs, ar) => {
    const e = document.createElement('div'); e.className = 'dn' + (hs ? ' hs' : ar ? ' ar' : ''); e.textContent = d; e.style.left = sx + 'px'; e.style.top = sy + 'px';
    $('dmgNums').appendChild(e); setTimeout(() => e.remove(), 700);
  };
  H.dirHit = (angle) => { const e = document.createElement('div'); e.className = 'dd'; e.style.transform = `rotate(${angle}rad)`; $('dirs').appendChild(e); setTimeout(() => e.remove(), 1100); };
  H.banner = (title, sub, cls = '', ms = 2600) => {
    const b = $('banner'); b.className = cls; b.querySelector('b').textContent = title; b.querySelector('span').textContent = sub || '';
    clearTimeout(H._bt); H._bt = setTimeout(() => b.classList.add('hidden'), ms);
  };
  H.toast = (t, ms = 2200) => { const e = $('toast'); e.textContent = t; e.classList.remove('hidden'); clearTimeout(H._tt); H._tt = setTimeout(() => e.classList.add('hidden'), ms); };

  function drawMap(ctx, size, cx, cz, R, st) {
    const k = size / (R * 2), sx = (wx) => (wx - cx) * k + size / 2, sz = (wz) => (wz - cz) * k + size / 2;
    ctx.fillStyle = '#2d4b4c'; ctx.fillRect(0, 0, size, size);
    const ik = img.width / (EXT * 2);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(img, (cx - R + EXT) * ik, (cz - R + EXT) * ik, R * 2 * ik, R * 2 * ik, 0, 0, size, size);
    // 毒圈：圈外塗色、目前圈與下一圈
    if (st.storm) {
      const s = st.storm;
      ctx.save();
      ctx.beginPath(); ctx.rect(0, 0, size, size); ctx.arc(sx(s.x), sz(s.z), s.r * k, 0, Math.PI * 2, true);
      ctx.fillStyle = 'rgba(110,60,220,.36)'; ctx.fill('evenodd');
      ctx.strokeStyle = 'rgba(170,130,255,.95)'; ctx.lineWidth = Math.max(2, size / 220);
      ctx.beginPath(); ctx.arc(sx(s.x), sz(s.z), s.r * k, 0, Math.PI * 2); ctx.stroke();
      if (st.next && st.next.r > 0) { ctx.strokeStyle = 'rgba(251,247,238,.95)'; ctx.setLineDash([size / 60, size / 90]); ctx.beginPath(); ctx.arc(sx(st.next.x), sz(st.next.z), st.next.r * k, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); }
      ctx.restore();
    }
    // 運輸機航線
    if (st.plane) {
      const p = st.plane;
      ctx.strokeStyle = 'rgba(251,247,238,.6)'; ctx.lineWidth = Math.max(1.5, size / 300); ctx.setLineDash([size / 80, size / 120]);
      ctx.beginPath(); ctx.moveTo(sx(p.ax), sz(p.az)); ctx.lineTo(sx(p.bx), sz(p.bz)); ctx.stroke(); ctx.setLineDash([]);
      if (st.planePos) { ctx.fillStyle = '#fbf7ee'; ctx.beginPath(); ctx.arc(sx(st.planePos.x), sz(st.planePos.z), Math.max(3, size / 120), 0, 7); ctx.fill(); }
    }
    // 城鎮名
    if (st.labels) {
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (const t of W.towns) {
        const fs = Math.max(11, size / (R > 800 ? 46 : 26));
        ctx.font = `700 ${fs}px "PingFang TC","Noto Sans TC","Microsoft JhengHei",sans-serif`;
        ctx.lineWidth = fs / 4; ctx.strokeStyle = 'rgba(22,18,13,.8)'; ctx.fillStyle = '#fbf7ee';
        ctx.strokeText(t.name, sx(t.x), sz(t.z)); ctx.fillText(t.name, sx(t.x), sz(t.z));
      }
    }
    // 玩家箭頭
    if (st.me) {
      const px = sx(st.me.x), pz = sz(st.me.z), a = st.me.yaw, s2 = Math.max(7, size / 40);
      ctx.save(); ctx.translate(px, pz); ctx.rotate(-a);
      ctx.fillStyle = '#e0a63a'; ctx.strokeStyle = '#16120d'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, -s2); ctx.lineTo(s2 * 0.7, s2 * 0.75); ctx.lineTo(0, s2 * 0.35); ctx.lineTo(-s2 * 0.7, s2 * 0.75); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
    }
    if (st.marks) for (const m of st.marks) { ctx.fillStyle = m.c; ctx.beginPath(); ctx.arc(sx(m.x), sz(m.z), Math.max(3, size / 150), 0, 7); ctx.fill(); }
  }

  let miniT = 0;
  H.update = (dt, s) => {
    // s: { me, stormCur, stormNext, storm(S), time, alive, kills, plane, planePos, prompt, mode, hag, speed, zone, aimLoot, spectate, ...}
    const me = s.me;
    // 羅盤：yaw 0 朝北（-z）
    const deg = ((-me.yaw * 180 / Math.PI) % 360 + 360) % 360;
    strip.style.transform = `translateX(${-(deg + 360) * 3 + $('compass').clientWidth / 2}px)`;
    $('heading').textContent = String(Math.round(deg) % 360).padStart(3, '0');
    $('alive').textContent = s.alive;
    $('kills').textContent = me.kills || 0;
    miniT -= dt;
    if (miniT <= 0) {
      miniT = 0.1;
      const R = me.mode === MODE.GROUND ? 260 : me.mode === MODE.CHUTE ? 360 : 700;
      drawMap(mini, 400, s.focus.x, s.focus.z, R, { storm: s.stormCur, next: s.stormNext, plane: s.plane, planePos: s.planePos, me: { x: s.focus.x, z: s.focus.z, yaw: s.focus.yaw }, labels: true });
      if (!$('bigmap').classList.contains('hidden')) drawMap(big, 1100, 0, 0, EXT * 0.86, { storm: s.stormCur, next: s.stormNext, plane: s.plane, planePos: s.planePos, me: { x: s.focus.x, z: s.focus.z, yaw: s.focus.yaw }, labels: true });
      $('zoneName').textContent = s.zone || '';
    }
    // 毒圈倒數
    const S = s.storm;
    if (S) {
      const P = STORM[S.phase];
      const rem = s.stormRem;
      if (!P) { $('stLbl').textContent = '最終圈'; $('stT').textContent = '0:00'; $('stBar').style.width = '100%'; }
      else {
        $('storm').classList.toggle('closing', S.state === 'shrink');
        $('stLbl').textContent = S.state === 'wait' ? (S.phase === 0 ? '毒圈形成' : '毒圈收縮倒數') : '毒圈收縮中';
        $('stT').textContent = fmt(rem);
        const total = S.state === 'wait' ? P.wait : P.shrink;
        $('stBar').style.width = `${(1 - rem / total) * 100}%`;
        $('stInfo').textContent = `第 ${S.phase + 1}／8 圈 · 圈外每秒 ${P.dps} 傷害`;
      }
    }
    // 生命與護甲
    $('hpNum').textContent = Math.max(0, Math.ceil(me.hp));
    const hb = $('hpbar'); hb.querySelector('b').style.transform = `scaleX(${Math.max(0, me.hp) / 100})`; hb.classList.toggle('low', me.hp < 35);
    if (lastPlates !== me.vest) { plates.innerHTML = Array.from({ length: me.vest }, () => '<i><b></b></i>').join(''); lastPlates = me.vest; }
    [...plates.children].forEach((el, i) => { el.firstChild.style.transform = `scaleX(${Math.max(0, Math.min(1, (me.ar - i * PLATE) / PLATE))})`; });
    $('pinv').textContent = me.pinv; $('vest').textContent = me.vest;
    // 武器
    const sl = me.slots[me.cur];
    if (sl) {
      const Wp = WEAPONS[sl[0]], R2 = RARITY[sl[1]];
      $('wName').innerHTML = `${esc(Wp.name)} <small style="color:${R2.color}">${R2.name}</small><small>${Wp.auto ? '全自動' : '半自動'}</small>`;
      $('mag').textContent = sl[2]; $('res').textContent = `/ ${me.ammo[Wp.ammo]}`;
      $('ammo').classList.toggle('low', sl[2] <= Math.ceil(magOf(sl[0], sl[1]) * 0.25));
      $('ammoType').textContent = AMMO[Wp.ammo].name;
    } else { $('wName').textContent = '空手'; $('mag').textContent = '-'; $('res').textContent = ''; $('ammoType').textContent = ''; }
    const other = me.slots[1 - me.cur];
    $('wAlt').innerHTML = other ? `<kbd>Q</kbd> ${esc(WEAPONS[other[0]].name)} <span class="num">${other[2]}</span>` : '';
    $('weapon').style.visibility = me.mode === MODE.GROUND ? 'visible' : 'hidden';
    $('vitals').style.visibility = me.mode === MODE.GROUND || me.mode === MODE.CHUTE || me.mode === MODE.FALL ? 'visible' : 'hidden';
    // 換彈與上甲進度
    const rb = $('reloadBar'), pb = $('plateBar');
    if (me.rt > 0 && sl) { rb.classList.remove('hidden'); rb.querySelector('b').style.width = `${(1 - me.rt / WEAPONS[sl[0]].reload) * 100}%`; } else rb.classList.add('hidden');
    if (me.pt > 0) { pb.classList.remove('hidden'); pb.querySelector('b').style.width = `${(1 - me.pt) * 100}%`; } else pb.classList.add('hidden');
    // 撿取提示
    const pr = $('prompt');
    if (s.aimLoot && me.mode === MODE.GROUND) {
      const d = decodeLoot(s.aimLoot.code);
      const rar = d.kind === 'w' ? `<span class="rar" style="color:${RARITY[d.r].color}">${RARITY[d.r].name}</span>` : '';
      const extra = d.kind === 'w' ? `<span class="num" style="color:var(--bone2)">${s.aimLoot.amt} 發</span>` : '';
      pr.innerHTML = `<kbd>${s.touch ? '撿' : 'E'}</kbd> ${esc(lootLabel(s.aimLoot.code, s.aimLoot.amt))} ${rar} ${extra}`;
      pr.classList.remove('hidden');
    } else pr.classList.add('hidden');
    // 跳傘：高度與按鍵提示
    const alt = $('alt'), kh = $('keyHint');
    if (me.mode === MODE.FALL || me.mode === MODE.CHUTE) {
      alt.classList.remove('hidden'); $('altN').textContent = Math.max(0, Math.round(s.hag)); $('altS').textContent = `${Math.round(s.speed * 3.6)} km/h`;
    } else alt.classList.add('hidden');
    const key = s.touch ? '跳' : '空白鍵';
    let hint = '';
    if (me.mode === MODE.PLANE) hint = s.canJump ? `<kbd>${key}</kbd> 跳出運輸機` : '運輸機即將飛抵鹽岬島';
    else if (me.mode === MODE.FALL) hint = s.hag > 12 ? `<kbd>${key}</kbd> 開傘　<span style="color:var(--bone2)">W 俯衝 · 95 公尺自動開傘</span>` : '';
    else if (me.mode === MODE.CHUTE) hint = s.hag > 130 ? `<kbd>${key}</kbd> 切斷傘繩` : '<span style="color:var(--bone2)">W 加速滑翔 · S 減速</span>';
    if (hint) { kh.innerHTML = hint; kh.classList.remove('hidden'); } else kh.classList.add('hidden');
    $('vign').style.opacity = s.inStorm ? 1 : 0;
    $('hurt').style.opacity = Math.max(0, Math.min(0.9, (1 - me.hp / 100) * 0.9 - 0.15 + s.hurtFlash));
    $('scope').style.opacity = s.scope ? 1 : 0;
    $('cross').style.opacity = me.mode === MODE.GROUND && !s.scope && !(sl && me.ads > 0.6 && WEAPONS[sl[0]].zoom > 1.3) ? 1 : 0;
    const spread = s.spread * 900 + 4;
    for (const [c, dx, dy] of [['l', -spread - 8, 0], ['r', spread, 0], ['u', 0, -spread - 8], ['d', 0, spread]]) { const e = $('cross').querySelector('.' + c); e.style.left = (c === 'u' || c === 'd' ? -1 : dx) + 'px'; e.style.top = (c === 'l' || c === 'r' ? -1 : dy) + 'px'; }
  };
  H.standings = (rows, meId) => {
    return `<table class="stand"><thead><tr><th>#</th><th>玩家</th><th class="n">擊殺</th><th class="n">傷害</th></tr></thead><tbody>${rows.map((r, i) => `<tr class="${r.id === meId ? 'me' : ''}${r.pl === 0 ? ' dead' : ''}"><td class="num">${r.pl || i + 1}</td><td>${esc(r.n)}${r.b ? '<span class="ai">AI</span>' : ''}${r.id === meId ? '（你）' : ''}</td><td class="n">${r.k}</td><td class="n">${r.d}</td></tr>`).join('')}</tbody></table>`;
  };
  H.drawMap = drawMap;
  return H;
}
export { esc, fmt };
void CELL;
