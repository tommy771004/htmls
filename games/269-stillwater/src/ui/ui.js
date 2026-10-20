// 介面：HUD（任務追蹤、魚簍 8 格、時鐘、河道縱圖、按鍵提示、橫幅、張力條）、漁獲吊牌、
// 面板（木屋：主線／委託板／魚簍／外觀；燈樁：休息、快速移動、返航、放生；圖鑑；暫停）。
import { ICON, badge, slot, STRING, TIER_COL } from './icons.js';
import { FISH, byId, ZONES, RARITY, TIME_ZH, zoneFish } from '../core/fishdb.js';
import { TIERS } from '../core/quality.js';
import { CHAPTERS, goalState, chapterReady, questHave, MILESTONES, PAINTS, RIBBONS, speciesCount, PERIODS, periodOf, clockText, valueOf } from '../core/quests.js';
import { CHECKPOINTS, SPOTS, SAMPLES, N } from '../core/map.js';
import { CREEL_MAX } from '../core/save.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const TIER_ZH = (t) => `${TIERS[t].zh} ${TIERS[t].en}`;

export function createUI(G) {
  const el = {
    hud: $('hud'), quest: $('quest'), creel: $('creel'), creelN: $('creelN'), slots: $('slots'), clockT: $('clockT'), clockP: $('clockP'), dial: $('dial'),
    bBook: $('bBook'), bMute: $('bMute'), bPause: $('bPause'), rmap: $('rmap'), hints: $('hints'), banner: $('banner'), bannerEn: $('bannerEn'), bannerSub: $('bannerSub'),
    pops: $('pops'), biteMark: $('biteMark'), reelBox: $('reelBox'), reelFish: $('reelFish'), reelState: $('reelState'), tension: $('tension'), needle: $('needle'),
    tensionN: $('tensionN'), progN: $('progN'), progFill: $('progFill'), zoneToast: $('zoneToast'), zoneZh: $('zoneZh'), zoneEn: $('zoneEn'),
    tag: $('tag'), sheet: $('sheet'), act: $('act'), use: $('use'),
  };
  el.bBook.innerHTML = ICON.book; el.bPause.innerHTML = ICON.pause;
  el.bBook.onclick = () => G.act.book();
  el.bPause.onclick = () => G.act.pause();
  el.bMute.onclick = () => G.act.mute();
  el.creel.onclick = () => G.act.creel();
  el.creel.onkeydown = (e) => { if (e.key === 'Enter') G.act.creel(); };
  el.use.onclick = () => G.act.interact();
  el.quest.onclick = () => { if (innerWidth <= 760 || innerHeight <= 500) el.quest.classList.toggle('collapsed'); };

  // ---------- 時鐘刻度盤：06:00～20:00 的半圓，三時段分色，太陽是一顆點 ----------
  const arc = (a0, a1, r) => { const p = (a) => [37 + Math.cos(a) * r, 38 - Math.sin(a) * r]; const [x0, y0] = p(a0), [x1, y1] = p(a1); return `M${x0.toFixed(1)} ${y0.toFixed(1)}A${r} ${r} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`; };
  const ang = (min) => Math.PI * (1 - (min - 360) / 840);
  el.dial.innerHTML = `<path d="${arc(ang(360), ang(660), 30)}" stroke="#c9d6c8" stroke-width="4" fill="none" stroke-linecap="round" opacity=".55"/>
    <path d="${arc(ang(668), ang(1012), 30)}" stroke="#efe8d8" stroke-width="4" fill="none" stroke-linecap="round" opacity=".7"/>
    <path d="${arc(ang(1020), ang(1200), 30)}" stroke="#e0a752" stroke-width="4" fill="none" stroke-linecap="round" opacity=".75"/>
    <path d="M4 38h66" stroke="#8f8a78" stroke-width="1.2" stroke-linecap="round"/>
    <circle id="sunDot" r="5" fill="#ffe2a6" stroke="#16231c" stroke-width="1.5"/>`;
  const sunDot = el.dial.querySelector('#sunDot');

  // ---------- 河道縱圖 ----------
  const RM = { x0: -45, x1: 45, z0: -735, z1: 64, w: 62, h: 500 };
  const mx = (x) => 6 + ((x - RM.x0) / (RM.x1 - RM.x0)) * (RM.w - 12), mz = (z) => ((z - RM.z0) / (RM.z1 - RM.z0)) * RM.h;
  {
    let segs = '';
    for (let i = 0; i < N - 6; i += 6) segs += `<line x1="${mx(SAMPLES.x[i]).toFixed(1)}" y1="${mz(SAMPLES.z[i]).toFixed(1)}" x2="${mx(SAMPLES.x[i + 6]).toFixed(1)}" y2="${mz(SAMPLES.z[i + 6]).toFixed(1)}" stroke-width="${(SAMPLES.w[i] * 0.42).toFixed(1)}"/>`;
    el.rmap.setAttribute('viewBox', `0 0 ${RM.w} ${RM.h}`);
    el.rmap.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    el.rmap.innerHTML = `<g stroke="#4f7f74" stroke-linecap="round">${segs}</g>
      <g id="rmSpots">${SPOTS.map((s) => `<circle cx="${mx(s.x).toFixed(1)}" cy="${mz(s.z).toFixed(1)}" r="1.8" data-k="${s.k}"/>`).join('')}</g>
      <g id="rmCps">${CHECKPOINTS.map((c) => `<path d="M${mx(c.x).toFixed(1)} ${(mz(c.z) - 4).toFixed(1)}l3 4-3 4-3-4z" data-k="${c.k}"/>`).join('')}</g>
      <path id="rmBoat" d="M0-4.5L3.2 3.5 0 2 -3.2 3.5z" fill="#efe8d8" stroke="#16231c" stroke-width="1"/>`;
  }
  const rmBoat = el.rmap.querySelector('#rmBoat');

  let lastHints = '', lastQuest = '', lastCreel = '', bannerT = 0, zoneT = 0, tagT = 0, tagOpen = false;
  const api = {
    el,
    show(on) { el.hud.classList.toggle('hidden', !on); },
    setMute(m) { el.bMute.innerHTML = m ? ICON.bellOff : ICON.bell; el.bMute.classList.toggle('off', m); el.bMute.setAttribute('aria-label', m ? '開聲音（M）' : '靜音（M）'); },
    setPaused(p) { el.bPause.innerHTML = p ? ICON.play : ICON.pause; },
    // 每幀（有變化才改 DOM）
    hud(s, ctx) {
      // 任務追蹤
      const save = s;
      let q = '';
      const ch = CHAPTERS[save.chapter];
      if (ch) {
        q = `<p class="ch">第${'一二三四五'[save.chapter]}章 · ${esc(ch.zh)}<small>${esc(ch.en)}</small></p><ul>`;
        for (const g of ch.goals) { const st = goalState(save, g); q += `<li class="${st.done ? 'done' : ''}"><i class="k"></i><span>${esc(g.zh)}</span><span class="c num">${st.n > 1 ? `${st.have}/${st.n}` : ''}</span></li>`; }
        q += '</ul>';
        if (chapterReady(save)) q += `<div class="ready">目標達成：回木屋碼頭回報</div>`;
      } else q = `<p class="ch">大師釣手<small>Master Angler · 主線完成</small></p><ul><li class="${speciesCount(save) >= 55 ? 'done' : ''}"><i class="k"></i><span>點亮 55 魚種圖鑑</span><span class="c num">${speciesCount(save)}/55</span></li></ul>`;
      if (save.upgrades.book && save.board.length) {
        const ready = save.board.filter((b) => questHave(save, b) >= b.n).length;
        q += `<div class="board">佈告欄委託 ${save.board.length} 項${ready ? `，<span style="color:var(--amber)">${ready} 項可交付</span>` : ''}</div>`;
      }
      if (q !== lastQuest) { el.quest.innerHTML = q; lastQuest = q; }
      // 魚簍
      const ck = save.creel.map((c) => c.tier).join(',');
      if (ck !== lastCreel) {
        lastCreel = ck;
        el.creelN.textContent = `${save.creel.length}/${CREEL_MAX}`;
        let h = '';
        for (let i = 0; i < CREEL_MAX; i++) h += `<span class="slot">${slot(save.creel[i] ? save.creel[i].tier : null)}</span>`;
        el.slots.innerHTML = h;
        el.creel.classList.toggle('full', save.creel.length >= CREEL_MAX);
      }
      // 時鐘
      const p = periodOf(save.clock);
      el.clockT.textContent = clockText(save.clock);
      el.clockP.textContent = `${PERIODS[p].zh} · 第 ${save.day} 天`;
      const a = ang(save.clock);
      sunDot.setAttribute('cx', (37 + Math.cos(a) * 30).toFixed(1)); sunDot.setAttribute('cy', (38 - Math.sin(a) * 30).toFixed(1));
      // 河道縱圖
      if (ctx.boat) {
        rmBoat.setAttribute('transform', `translate(${mx(ctx.boat.x).toFixed(1)} ${mz(ctx.boat.z).toFixed(1)}) rotate(${(180 - ctx.boat.yaw * 57.3).toFixed(0)})`);
        el.rmap.querySelectorAll('#rmCps path').forEach((p) => { const lit = save.cps[+p.dataset.k]; p.setAttribute('fill', lit ? '#e0a752' : 'none'); p.setAttribute('stroke', lit ? '#e0a752' : '#8f8a78'); p.setAttribute('stroke-width', '1.2'); });
        el.rmap.querySelectorAll('#rmSpots circle').forEach((c) => { const seen = save.seen[c.dataset.k]; c.setAttribute('fill', seen ? '#efe8d8' : 'none'); c.setAttribute('stroke', seen ? 'none' : '#8f8a78'); c.setAttribute('stroke-width', '0.9'); });
      }
    },
    hints(list) {
      const key = list.map((h) => h.join('|')).join(';');
      if (key === lastHints) return;
      lastHints = key;
      el.hints.innerHTML = list.map(([k, t]) => `<span class="h">${k.split('+').map((x) => `<kbd>${esc(x)}</kbd>`).join('')}<span>${esc(t)}</span></span>`).join('');
      el.hints.classList.toggle('hidden', !list.length);
    },
    touchLabels(act, use) {
      if (el.act.textContent !== act) el.act.textContent = act;
      el.use.classList.toggle('hidden', !use);
      if (use && el.use.textContent !== use) el.use.textContent = use;
    },
    banner(en, sub, dur = 2.8) { el.bannerEn.textContent = en; el.bannerSub.textContent = sub || ''; el.banner.classList.remove('off'); bannerT = dur; },
    zone(z) { el.zoneZh.textContent = `第${'一二三四五'[z - 1]}區 · ${ZONES[z].zh}`; el.zoneEn.textContent = ZONES[z].en; el.zoneToast.classList.remove('off'); zoneT = 3.2; },
    pop(text, kind = '') {
      const d = document.createElement('div');
      d.className = 'pop ' + kind; d.textContent = text;
      el.pops.appendChild(d);
      setTimeout(() => d.remove(), 2000);
      while (el.pops.children.length > 3) el.pops.firstChild.remove();
    },
    bite(on) { el.biteMark.classList.toggle('hidden', !on); },
    biteAt(p) { if (p) { el.biteMark.style.left = p[0] + 'px'; el.biteMark.style.top = p[1] + 'px'; } },
    reel(r, fish) {
      el.reelBox.classList.remove('hidden'); el.hud.classList.add('reeling');
      el.reelFish.textContent = '？？？';
      const names = { calm: '平靜', struggle: '暴衝！', wave: '魚王猛扯！', jump: '躍出水面！', dive: '深淵下潛', lock: '鑽石縫，鎖死' };
      const s = r.show;
      el.reelState.textContent = names[s] || s;
      el.reelState.className = 'state ' + (s === 'calm' ? 'calm' : 'hot');
      el.needle.style.left = r.tension.toFixed(1) + '%';
      el.tension.classList.toggle('red', r.tension >= 80);
      el.tensionN.textContent = Math.round(r.tension) + '%';
      el.progFill.style.width = r.progress.toFixed(1) + '%';
      el.progN.textContent = Math.round(r.progress) + '%';
    },
    reelEnd() { el.reelBox.classList.add('hidden'); el.hud.classList.remove('reeling'); },
    tick(dt) {
      if (bannerT > 0) { bannerT -= dt; if (bannerT <= 0) el.banner.classList.add('off'); }
      if (zoneT > 0) { zoneT -= dt; if (zoneT <= 0) el.zoneToast.classList.add('off'); }
      if (tagOpen && tagT > 0) { tagT -= dt; if (tagT <= 0) api.hideTag(); }
    },
    get tagOpen() { return tagOpen; },
    // ---------- 漁獲吊牌 ----------
    showTag(c, info, j) {
      const f = byId(c.id);
      const flags = [];
      if (c.perfect) flags.push('完美提竿 +20');
      if (c.flawless) flags.push('無傷收線 +25');
      if (info.newSpecies) flags.push('新魚種，已記入圖鑑');
      else if (info.newTier) flags.push('圖鑑最高品質更新');
      flags.push(`品質分數 ${j.score}・價值 ${valueOf(c)} 分`);
      el.tag.innerHTML = `<div class="string">${STRING}</div><div class="paper"><span class="hole"></span>
        ${info.newRecord ? '<div class="stamp">New<br>Record!</div>' : ''}
        <img alt="" src="${G.portrait(c.id)}">
        <div class="en">${esc(f.en)}</div><div class="zhn">${esc(f.no)} ${esc(f.zh)}</div>
        <div class="qrow">${badge(c.tier, 40)}<div class="q"><b>${esc(TIERS[c.tier].zh)}</b><span>${esc(TIERS[c.tier].en)} · ${esc(RARITY[f.rarity].zh)}</span></div></div>
        <div class="size"><div><small>體長</small>${c.len.toFixed(1)} cm</div><div><small>重量</small>${c.kg.toFixed(2)} kg</div></div>
        <div class="flags">${flags.map(esc).join('<br>')}</div></div>`;
      el.tag.classList.remove('off');
      tagOpen = true; tagT = 5.5;
    },
    hideTag() { el.tag.classList.add('off'); tagOpen = false; },
    pauseTag(p) { el.tag.style.visibility = p ? 'hidden' : ''; },

    // ---------- 面板 ----------
    get sheetOpen() { return !el.sheet.classList.contains('hidden'); },
    close() { el.sheet.classList.add('hidden'); el.sheet.innerHTML = ''; G.onSheetClose && G.onSheetClose(); },
    sheet(title, en, tabs, active, body, onTab) {
      el.sheet.classList.remove('hidden');
      el.sheet.innerHTML = `<div class="plank" role="dialog" aria-modal="true" aria-label="${esc(title)}"><button class="x" aria-label="關閉（Esc）">${ICON.close}</button>
        <h2>${esc(title)}<span class="latin">${esc(en)}</span></h2>
        ${tabs ? `<div class="tabs" role="tablist">${tabs.map(([k, t]) => `<button class="tab ${k === active ? 'on' : ''}" data-tab="${k}" role="tab" aria-selected="${k === active}">${esc(t)}</button>`).join('')}</div>` : ''}
        <div class="body">${body}</div></div>`;
      el.sheet.querySelector('.x').onclick = () => api.close();
      el.sheet.onclick = (e) => { if (e.target === el.sheet) api.close(); };
      el.sheet.querySelectorAll('.tab').forEach((b) => (b.onclick = () => onTab(b.dataset.tab)));
      const pl = el.sheet.querySelector('.plank'); pl.tabIndex = -1; pl.focus({ preventScroll: true });
      return el.sheet.querySelector('.body');
    },
    bind(sel, fn) { el.sheet.querySelectorAll(sel).forEach((b) => (b.onclick = () => fn(b.dataset, b))); },

    creelHTML(save, mode) {
      if (!save.creel.length) return '<p class="note">魚簍是空的。</p>';
      return `<div class="creelList">${save.creel.map((c, i) => { const f = byId(c.id); return `<div class="cfish"><img alt="" src="${G.portrait(c.id)}"><div><div class="n">${esc(f.zh)} ${badge(c.tier, 16)}</div><div class="m">${c.len.toFixed(1)} cm · ${TIME_ZH[c.time]} · ${valueOf(c)} 分</div></div>${mode === 'release' ? `<button class="link" data-i="${i}">放生</button>` : ''}</div>`; }).join('')}</div>`;
    },

    openDock(save, tab = 'main') {
      const tabs = [['main', '主線回報'], ['board', '委託板'], ['creel', '魚簍'], ['look', '船與帽帶'], ['rest', '休息']];
      if (!save.upgrades.book) tabs.splice(1, 1);
      let body = '';
      if (tab === 'main') {
        const ch = CHAPTERS[save.chapter];
        if (ch) {
          body += `<div class="row"><div class="grow"><div class="zh" style="font-size:17px">第${'一二三四五'[save.chapter]}章　${esc(ch.zh)}</div><div class="meta latin">${esc(ch.en)}</div></div></div>`;
          for (const g of ch.goals) { const st = goalState(save, g); body += `<div class="goal ${st.done ? 'done' : ''}"><i class="k"></i><span>${esc(g.zh)}</span><span class="num" style="color:var(--birch-3)">${st.n > 1 ? `${st.have}/${st.n}` : ''}</span></div>`; }
          body += `<div class="row"><div class="grow"><div class="meta">獎勵：${esc(ch.rewardZh)}</div></div><button class="btn amber" id="claim" ${chapterReady(save) ? '' : 'disabled'}>回報</button></div>`;
        } else body += '<p class="note">五章主線都完成了。你已經是靜水河上的大師釣手，草帽上別著金羽徽章。繼續把 55 種魚記進圖鑑吧。</p>';
        body += `<div class="row"><div class="grow"><div class="meta">釣手積分</div><div class="zh num" style="font-size:20px">${save.points}</div></div><div class="note" style="text-align:right">升級：${[save.upgrades.line && '蠶絲釣線', save.upgrades.lantern && '船頭提燈', save.upgrades.rod && '竹製名竿', save.upgrades.badge && '金羽徽章'].filter(Boolean).join('、') || '尚無'}</div></div>`;
      } else if (tab === 'board') {
        body = save.board.map((q, i) => { const h = questHave(save, q); return `<div class="row"><div class="grow"><div>${esc(q.zh)}</div><div class="meta">魚簍裡符合 ${h}/${q.n} · 酬勞 ${q.reward} 積分</div></div><button class="btn" data-q="${i}" ${h >= q.n ? '' : 'disabled'}>交付</button></div>`; }).join('') + `<p class="note">交付後立刻換上一張新委託。委託會從已點亮燈樁的水域出題。</p>`;
      } else if (tab === 'creel') {
        const total = save.creel.reduce((s, c) => s + valueOf(c), 0);
        body = api.creelHTML(save) + (save.creel.length ? `<div class="row"><div class="grow note">卸下全部漁獲換成積分（委託要交的魚先交）。</div><button class="btn amber" id="sell">卸貨 +${total}</button></div>` : '');
      } else if (tab === 'look') {
        const n = speciesCount(save);
        const unlocked = (i) => i === 0 || n >= MILESTONES[i - 1].n;
        body = `<div class="row"><div class="grow"><div>船殼漆色</div><div class="meta">圖鑑 10／25／40／55 種各解鎖一款</div></div></div><div class="swatches">${PAINTS.map((p, i) => `<button class="sw ${save.paint === i ? 'on' : ''}" style="background:${p.hex}" data-paint="${i}" ${unlocked(i) ? '' : 'disabled'} aria-label="${esc(p.zh)}" title="${esc(p.zh)}${unlocked(i) ? '' : `（圖鑑 ${MILESTONES[i - 1].n} 種解鎖）`}"></button>`).join('')}</div>
          <div class="row" style="margin-top:8px"><div class="grow"><div>草帽帽帶</div></div></div><div class="swatches">${RIBBONS.map((p, i) => `<button class="sw ${save.ribbon === i ? 'on' : ''}" style="background:${p.hex}" data-ribbon="${i}" ${unlocked(i) ? '' : 'disabled'} aria-label="${esc(p.zh)}" title="${esc(p.zh)}"></button>`).join('')}</div>
          <p class="note" style="margin-top:12px">目前圖鑑 ${n}/55 種。${MILESTONES.filter((m) => n < m.n).slice(0, 1).map((m) => `再 ${m.n - n} 種解鎖：${m.zh}`).join('')}</p>`;
      } else if (tab === 'rest') body = api.restHTML(save);
      const b = api.sheet('木屋碼頭', 'Cabin Dock', tabs, tab, body, (t) => api.openDock(G.save, t));
      api.bind('#claim', () => G.act.claim());
      api.bind('[data-q]', (d) => G.act.deliver(+d.q));
      api.bind('#sell', () => G.act.sell());
      api.bind('[data-paint]', (d) => G.act.paint(+d.paint));
      api.bind('[data-ribbon]', (d) => G.act.ribbon(+d.ribbon));
      api.bind('[data-rest]', (d) => G.act.rest(+d.rest));
      return b;
    },
    restHTML(save) {
      const p = periodOf(save.clock);
      return `<p class="note">在這裡休息到下一個時段開始。不同時段出沒的魚不一樣，黃昏才有暮光鯉與魚王。</p><div class="row">${PERIODS.map((x, i) => `<button class="btn" data-rest="${i}" ${i === p ? 'disabled' : ''}>${esc(x.zh)} ${clockText(x.from)}</button>`).join('')}</div>`;
    },
    openCheckpoint(save, cp, tab = 'rest') {
      const tabs = [['rest', '休息'], ['travel', '快速移動'], ['release', '放生']];
      let body = '';
      const z = cp.zone, zf = zoneFish(z), got = zf.filter((f) => save.book[f.id]).length;
      const head = `<div class="row"><div class="grow"><div class="zh">第${'一二三四五'[z - 1]}區 · ${esc(ZONES[z].zh)}</div><div class="meta">此區魚種 ${got}/11 已記錄　·　燈樁已點亮，可在此停泊與重生</div></div></div>`;
      if (tab === 'rest') body = head + api.restHTML(save);
      else if (tab === 'travel') {
        body = head + CHECKPOINTS.filter((c) => save.cps[c.k] && c.k !== cp.k).map((c) => `<div class="row"><div class="grow"><div>${esc(c.zh)}</div><div class="meta latin">${esc(c.en)}</div></div><button class="btn ${c.k === 0 ? 'amber' : ''}" data-go="${c.k}">${c.k === 0 ? '順流返航' : '前往'}</button></div>`).join('');
        if (!CHECKPOINTS.some((c) => save.cps[c.k] && c.k !== cp.k)) body += '<p class="note">還沒有其他點亮的燈樁。</p>';
      } else body = head + api.creelHTML(save, 'release') + '<p class="note">放生的魚不會計入積分，但圖鑑紀錄會保留。</p>';
      api.sheet(cp.zh, cp.en, tabs, tab, body, (t) => api.openCheckpoint(G.save, cp, t));
      api.bind('[data-rest]', (d) => G.act.rest(+d.rest));
      api.bind('[data-go]', (d) => G.act.travel(+d.go));
      api.bind('[data-i]', (d) => G.act.release(+d.i));
    },
    openBook(save, zone = 1, fishId = null) {
      const n = speciesCount(save);
      const tabs = [1, 2, 3, 4, 5].map((z) => [String(z), `${'一二三四五'[z - 1]}・${ZONES[z].short}`]);
      let body = `<div class="mile"><div class="bar"><i style="width:${(n / 55) * 100}%"></i>${MILESTONES.map((m) => `<b class="${n >= m.n ? 'got' : ''}" style="left:${(m.n / 55) * 100}%" title="${m.n} 種：${esc(m.zh)}"></b>`).join('')}</div><span class="num note">${n}/55 種</span></div>`;
      if (fishId) {
        const f = byId(fishId), e = save.book[fishId];
        body += `<div class="detail" style="margin-top:14px"><div><img alt="" src="${G.portrait(f.id)}" style="${e ? '' : 'filter:brightness(0) opacity(.45)'}"><div class="latin" style="font-size:22px;margin-top:6px">${esc(e ? f.en : '???')}</div><div class="zh" style="font-size:17px;font-weight:700">${esc(f.no)} ${esc(e ? f.zh : '尚未釣獲')}</div><p class="note">${esc(f.desc)}</p></div>
          <dl><dt>稀有度</dt><dd>${esc(RARITY[f.rarity].zh)} ${esc(RARITY[f.rarity].en)}</dd><dt>出沒時段</dt><dd>${f.times.length === 3 ? '全天' : f.times.map((t) => TIME_ZH[t]).join('、')}${f.best.length < f.times.length ? `（${f.best.map((t) => TIME_ZH[t]).join('')}最佳）` : ''}</dd>
          <dt>基礎體型</dt><dd>${f.len} cm / ${f.kg} kg</dd><dt>棲息</dt><dd>第${'一二三四五'[f.zone - 1]}區 ${esc(ZONES[f.zone].short)}</dd>
          <dt>釣獲次數</dt><dd>${e ? e.n : 0}</dd><dt>最高品質</dt><dd>${e ? `${badge(e.tier, 18)} ${esc(TIER_ZH(e.tier))}` : '未記錄'}</dd><dt>最大紀錄</dt><dd>${e ? `${e.len.toFixed(1)} cm / ${e.kg.toFixed(2)} kg` : '未記錄'}</dd></dl></div>
          <button class="link" id="back">← 回到第${'一二三四五'[f.zone - 1]}區</button>`;
      } else {
        body += `<div class="book" style="margin-top:14px">${zoneFish(zone).map((f) => { const e = save.book[f.id]; return `<button class="card ${e ? '' : 'unk'}" data-f="${f.id}"><span class="no">${f.no} · ${esc(RARITY[f.rarity].zh)}</span>${e ? `<span class="badge">${badge(e.tier, 22)}</span>` : ''}<img alt="" src="${G.portrait(f.id)}"><span class="zhn">${esc(e ? f.zh : '？？？')}</span><span class="en">${esc(e ? f.en : f.times.map((t) => TIME_ZH[t]).join('・'))}</span></button>`; }).join('')}</div>`;
      }
      api.sheet('55 魚種生態圖鑑', 'Field Guide', tabs, String(fishId ? byId(fishId).zone : zone), body, (t) => api.openBook(G.save, +t));
      api.bind('[data-f]', (d) => api.openBook(G.save, zone, +d.f));
      api.bind('#back', () => api.openBook(G.save, byId(fishId).zone));
    },
    openPause(save, muted) {
      const body = `<div class="row"><div class="grow"><div>遊戲已暫停</div><div class="meta">第 ${save.day} 天 · 已釣 ${save.stats.caught} 條 · 完美提竿 ${save.stats.perfect} 次 · 斷線 ${save.stats.snap} 次</div></div><button class="btn amber" id="resume">繼續</button></div>
        <div class="row"><div class="grow">聲音</div><button class="btn" id="pmute">${muted ? '開聲音' : '靜音'}</button></div>
        <div class="row"><div class="grow"><div>操作</div><div class="meta">W／S 划槳前進與倒划，A／D 轉向（單邊划槳）；靠近釣點並放慢船速後按空白鍵拋竿，浮標沉下去時再按一次提竿（0.35 秒內是完美提竿），之後按住空白鍵收線、張力太高就放開。E 停泊燈樁或進木屋，Tab／B 圖鑑，T 休息到下一個時段，M 靜音，P 暫停。</div></div></div>
        <div class="row"><div class="grow"><div>重新開始</div><div class="meta">清除這台瀏覽器裡的存檔（圖鑑、魚簍、主線進度）。</div></div><button class="btn" id="wipe">清除存檔</button></div>`;
      api.sheet('暫停', 'Paused', null, null, body, () => {});
      api.bind('#resume', () => api.close());
      api.bind('#pmute', () => { G.act.mute(); api.openPause(G.save, G.muted); });
      api.bind('#wipe', (d, b) => { if (b.dataset.armed) G.act.wipe(); else { b.dataset.armed = '1'; b.textContent = '再按一次確認'; } });
    },
  };
  api.setMute(false);
  return api;
}
