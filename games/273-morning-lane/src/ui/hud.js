// HUD：版面照 ref/ref-ui-hud.png（底色改成煙燻玻璃，見 ART.md 的 UI）：分數、報紙、路線條、訂戶標籤、命中跳字、狗叫／喇叭／濺水提示，
// 以及結算畫面（照 ref/ref-ui-results.png：一週日曆、逐項送報單、星等章、訂戶增減、明天預告）。
import * as THREE from 'three';
import { PAPER } from '../core/config.js';
import { upcoming, summary } from '../core/game.js';
import { DAYS, TIMES } from '../core/week.js';
import { mission, MISSION_PTS } from '../core/missions.js';

const $ = (s) => document.querySelector(s);
const LABEL = { mailbox: '正中信箱', doorstep: '送到門口', streak: '連投', window: '打破窗戶', bump: '撞到了', missed: '漏送', bundle: '報紙 +5', jump: '飛躍' };
const WHAT = { bin: '垃圾桶', hydrant: '消防栓', post: '信箱柱', car: '停著的車', tree: '行道樹', pole: '電線桿', carMove: '來車', lamp: '路燈' };

export function makeHud() {
  const score = $('#scoreN'), stock = $('#stockN'), rolls = $('#rolls'), route = $('#routeRow'), streak = $('#streak'), tags = $('#tags');
  const tagEls = [0, 1].map(() => { const e = document.createElement('div'); e.className = 'tag'; e.innerHTML = '<span>訂戶</span>'; tags.appendChild(e); return e; });
  const v = new THREE.Vector3();
  let order = [], shown = -1, stockShown = -1, mShown = '';
  const toastEl = $('#toast');
  function toast(text, cls) { toastEl.hidden = false; toastEl.className = cls; toastEl.innerHTML = text; void toastEl.offsetWidth; toastEl.classList.add('show'); }
  const project = (x, y, z, cam) => { v.set(x, y, z).project(cam); return v.z < 1 && Math.abs(v.x) < 1.2 && Math.abs(v.y) < 1.2 ? [(v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight] : null; };

  function reset(g, day) {
    if (day) {
      $('#day .lbl').textContent = `${day.street} · 第 ${day.index + 1} 天`;
      $('#day b').textContent = `${day.name} ${TIMES[day.time]}`;
      $('#introDay').innerHTML = `<b>${day.name} ${TIMES[day.time]} · ${day.street}</b>　${day.note}`;
      $('#introMissions').innerHTML = (day.missions || []).map((m) => `<li><i></i>${mission(m).label}<b>+${MISSION_PTS}</b></li>`).join('');
    }
    mShown = '';
    order = g.street.lots.filter((l) => l.sub).sort((a, b) => b.mailbox.z - a.mailbox.z);
    route.innerHTML = order.map((l) => `<i data-id="${l.id}"${l.vip ? ' data-vip' : ''}></i>`).join('') + '<b id="routeBike"></b>';
    rolls.innerHTML = Array.from({ length: PAPER.stock }, () => '<u></u>').join('');
    shown = -1; stockShown = -1;
    $('#end').hidden = true;
    for (const p of tags.querySelectorAll('.pop')) p.remove();
  }
  function popup(g, ev, text, cls) {
    const e = document.createElement('div');
    e.className = 'pop ' + (cls || '');
    e.innerHTML = text;
    e.dataset.x = ev.x; e.dataset.y = (ev.y || 1) + 0.6; e.dataset.z = ev.z; e.dataset.t = 1.1;
    tags.appendChild(e);
  }
  function event(g, e) {
    if (e.type === 'done') return;              // 結算畫面由 main 呼叫 end()
    if (e.type === 'bark') { const d = g.haz.dogs[e.dog]; popup(g, { x: d.x, y: 0.9, z: d.z }, '汪！', 'neg'); return; }
    if (e.type === 'honk') { const c = g.haz.cars[e.car]; popup(g, { x: c.x, y: 1.6, z: c.z }, '叭叭！', 'neg'); return; }
    if (e.type === 'splash') { popup(g, { x: g.bike.x, y: 1.3, z: g.bike.z }, '<small>濕身減速</small>', 'miss'); return; }
    if (e.type === 'mission') { toast((e.m.state === 'done' ? '任務完成　' : '任務失敗　') + e.m.label, e.m.state); return; }
    if (e.type === 'bundle' && !e.add) { popup(g, { x: e.x, y: 0.8, z: e.z }, '<small>報紙已經滿了</small>', 'miss'); }
    if (!e.lines) return;
    for (const ln of e.lines) {
      if (ln.kind === 'streak') { streak.hidden = false; streak.querySelector('b').textContent = '×' + ln.n; streak.classList.remove('bump'); void streak.offsetWidth; streak.classList.add('bump'); continue; }
      if (ln.kind === 'missed') { const l = g.street.lots[ln.lot]; popup(g, { x: l.mailbox.x, y: 1, z: l.mailbox.z }, '漏送', 'miss'); streak.hidden = true; continue; }
      const pts = ln.pts > 0 ? '+' + ln.pts : ln.pts < 0 ? '−' + -ln.pts : '';
      const lbl = ln.kind === 'bump' ? (ln.what === 'dog' ? '被狗咬到' : '撞到' + (WHAT[ln.what] || '')) : LABEL[ln.kind];
      const at = e.type === 'bump' || e.type === 'jump' ? { x: g.bike.x, y: 1.2 + (g.bike.y || 0), z: g.bike.z } : e.type === 'bundle' ? { x: e.x, y: 0.8, z: e.z } : e;
      if (ln.vip) { popup(g, at, `${pts}<small>金色信箱 ×3</small>`, ''); continue; }
      popup(g, at, `${pts}<small>${lbl}</small>`, ln.pts < 0 ? 'neg' : '');
    }
  }
  function update(g, cam, dt) {
    if (g.ledger.score !== shown) { shown = g.ledger.score; score.textContent = shown.toLocaleString('en-US'); }
    if (g.stock !== stockShown) {
      stockShown = g.stock; stock.textContent = g.stock;
      [...rolls.children].forEach((u, i) => u.classList.toggle('gone', i >= g.stock));
    }
    // 路線條：送到薄荷綠、漏送灰、還沒到芥末黃；腳踏車圖示照 z 進度擺
    for (const el of route.querySelectorAll('i')) {
      const id = +el.dataset.id;
      el.className = (g.ledger.delivered.has(id) ? 'ok' : g.ledger.missed.has(id) ? 'miss' : '') + (el.dataset.vip != null ? ' vip' : '');
    }
    const prog = Math.min(1, Math.max(0, g.bike.z / g.street.finishZ));
    $('#routeBike').style.left = (prog * 100).toFixed(1) + '%';
    // 接下來兩戶訂戶的信箱標籤
    const next = g.mode === 'ride' ? upcoming(g, 2) : [];
    tagEls.forEach((el, i) => {
      const l = next[i]; const p = l && project(l.mailbox.x, 1.95, l.mailbox.z, cam);
      el.hidden = !p;
      if (p) {
        el.style.transform = `translate(${p[0]}px,${p[1]}px) translate(-50%,-100%)`; el.classList.toggle('far', i > 0);
        el.classList.toggle('vip', !!l.vip); el.firstChild.textContent = l.vip ? '金色 ×3' : '訂戶';
      }
    });
    // 今日任務（狀態有變才重畫）
    const key = g.mstate.map((m) => m.state + m.have).join();
    if (key !== mShown) {
      mShown = key;
      $('#mList').innerHTML = g.mstate.map((m) => `<li class="${m.state}"><i></i>${m.label}${m.need > 1 ? `<b>${m.have}/${m.need}</b>` : ''}</li>`).join('');
    }
    for (const e of tags.querySelectorAll('.pop')) {
      const t = +e.dataset.t - dt; e.dataset.t = t;
      if (t <= 0) { e.remove(); continue; }
      e.dataset.y = +e.dataset.y + dt * 0.8;
      const p = project(+e.dataset.x, +e.dataset.y, +e.dataset.z, cam);
      if (!p) { e.style.opacity = 0; continue; }
      e.style.opacity = Math.min(1, t * 3);
      e.style.transform = `translate(${p[0]}px,${p[1]}px) translate(-50%,-50%) rotate(-6deg)`;
    }
  }
  // 結算畫面：s＝summary、r＝settle 結果、day＝今天、save＝更新後的存檔
  function end(s, r, day, save, lines, g) {
    $('#end').hidden = false;
    const n = (k, what) => lines.filter((x) => x.kind === k && (!what || what(x)));
    const sum = (a) => a.reduce((t, x) => t + x.pts, 0);
    const row = (color, label, count, pts) => `<tr><td><i style="background:${color}"></i>${label}</td><td>${count}</td><td class="${pts < 0 ? 'neg' : ''}">${pts < 0 ? '−' + (-pts).toLocaleString('en-US') : pts.toLocaleString('en-US')}</td></tr>`;
    const bumps = n('bump'), streaks = n('streak'), wins = n('window');
    $('#sheetNo').textContent = `第 ${save.week} 週`;
    $('#endSub').textContent = `${day.name} · ${day.street} · ${TIMES[day.time]} · 訂戶 ${s.subs} 戶，送到 ${s.delivered} 戶`;
    $('#endBody').innerHTML = [
      row('#e5aa35', '正中信箱', s.mailbox + ' ×', sum(n('mailbox'))),
      row('#79b8a2', '送到門口', s.doorstep + ' ×', sum(n('doorstep'))),
      row('#fffaf0', '連投獎勵', '最長 ×' + s.best, sum(streaks)),
      row('#a8a497', '漏送訂戶', s.missed + ' ×', 0),
      row('#f2b8ad', '打破窗戶', wins.length + ' ×', sum(wins)),
      row('#2f4c6e', '撞到東西', bumps.length + ' ×', sum(bumps)),
      row('#ebe5d5', '剩下的報紙', r.stock + ' 份', r.spare),
      s.bundles || s.jumps ? row('#e8b730', '補給包／飛躍', `${s.bundles} 包／${s.jumps} 跳`, sum(n('bundle')) + sum(n('jump'))) : '',
      r.bonus ? row('#ffd37a', '全勤獎金', '', r.bonus) : '',
      row('#9fd7c2', '任務獎勵', r.missionsDone.length + ' / 3', r.mission),
      `<tr class="tot"><td>今日合計</td><td></td><td>${r.total.toLocaleString('en-US')}</td></tr>`].join('');
    $('#stamp').innerHTML = `<div><b>${'★'.repeat(r.stars) + '☆'.repeat(3 - r.stars)}</b>${r.perfect ? '全勤' : r.stars >= 2 ? '準時' : r.stars ? '及格' : '再加油'}</div>`;
    $('#chips').innerHTML = (r.gained ? `<span>＋${r.gained} 新訂戶</span>` : '') + (r.lost ? `<span class="lost">−${r.lost} 退訂（漏送）</span>` : '') + (r.sloppy ? '<span class="lost">太粗心，扣一顆星</span>' : '');
    $('#endMissions').innerHTML = r.missions.map((m) => `<li class="${m.state}"><i></i>${m.label}<b>${m.state === 'done' ? '+' + MISSION_PTS : '—'}</b></li>`).join('');
    routeMap(g, lines);
    weekList(save, day.index);
    const last = day.index >= 6;
    $('#again').textContent = `重騎${day.name}`;
    $('#next').textContent = save.weekDone && last ? '開始新的一週 →' : `${day.index + 1 === save.day ? '明天' : '繼續'}：${DAYS[Math.min(save.day, 6)].name} →`;
    const nd = DAYS[Math.min(save.day, 6)];
    $('#tomorrow').innerHTML = save.weekDone ? `<b>這一週送完了！</b>七天合計 ${save.results.reduce((a, x) => a + (x ? x.score : 0), 0).toLocaleString('en-US')} 分。新的一週從週一重新開始，各天最佳分數會留著。`
      : `<b>${nd.name}（${nd.street}）</b>：${nd.note}`;
  }
  // 今天的路線小地圖：一條直街，兩側每一戶一格（送到薄荷綠、漏送灰、砸窗粉紅、非訂戶淡白、金色信箱金框），跳台與補給包標在路上
  function routeMap(g, lines) {
    const st = g.street, H = 300, W = 196, cx = W / 2, sy = (z) => 8 + (z / st.finishZ) * (H - 16);
    const broke = new Set(lines.filter((l) => l.kind === 'window').map((l) => l.lot));
    const cells = st.lots.map((l) => {
      const col = broke.has(l.id) ? '#f2b8ad' : !l.sub ? 'rgba(255,250,236,.28)' : g.ledger.delivered.has(l.id) ? '#79b8a2' : '#a8a497';
      const x = l.side > 0 ? cx + 22 : cx - 22 - 30, y = sy(l.z) - 9;
      return `<rect x="${x}" y="${y.toFixed(1)}" width="30" height="18" rx="3" fill="${col}"${l.vip ? ' stroke="#ffd37a" stroke-width="2.5"' : ''}/>`;
    }).join('');
    const ramps = st.ramps.map((r) => `<rect x="${cx + r.x * 4 - 4}" y="${(sy(r.z) - 3).toFixed(1)}" width="8" height="6" fill="#b0844f"/>`).join('');
    const buns = st.bundles.map((b) => `<circle cx="${cx + b.x * 4}" cy="${sy(b.z).toFixed(1)}" r="3.2" fill="${g.taken.has(b.id) ? '#ffd37a' : 'rgba(255,211,122,.35)'}"/>`).join('');
    $('#routeMap').innerHTML = `<span class="lbl">今天的路線</span><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="今天的路線">
      <rect x="${cx - 16}" y="0" width="32" height="${H}" rx="4" fill="rgba(20,24,34,.55)"/>
      <line x1="${cx}" y1="4" x2="${cx}" y2="${H - 4}" stroke="#e9c75a" stroke-width="1.5" stroke-dasharray="5 5"/>
      ${cells}${ramps}${buns}
      <text x="${cx}" y="${H - 1}" font-size="9" fill="#fffaf0" text-anchor="middle">終點</text></svg>
      <div class="legend"><span><i style="background:#79b8a2"></i>送到</span><span><i style="background:#a8a497"></i>漏送</span><span><i style="background:#f2b8ad"></i>砸窗</span><span><i style="border:2px solid #ffd37a"></i>金色</span><span><i style="background:#b0844f"></i>跳台</span><span><i style="background:#ffd37a;border-radius:50%"></i>補給</span></div>`;
  }
  // 一週七天的日曆條：騎過的顯示星等，可以點回去重騎；還沒到的鎖著
  function weekList(save, today) {
    $('#week').innerHTML = DAYS.map((d, i) => {
      const r = save.results[i], open = i <= save.day;
      const mm = r ? `<small>任務 ${(r.missions || []).length}/3</small>` : `<small>${d.street}</small>`;
      return `<li data-day="${i}" class="${i === today ? 'today' : ''} ${open ? '' : 'locked'}">${d.name}${r ? `<em>${'★'.repeat(r.stars)}${'☆'.repeat(3 - r.stars)}</em>` : ''}${mm}</li>`;
    }).join('');
  }
  return {
    reset, event, update, end,
    cam: (p) => { $('#camN').textContent = p === 'near' ? '近' : '遠'; },
    go: () => { $('#intro').hidden = true; $('#end').hidden = true; },
  };
}
export { summary };
