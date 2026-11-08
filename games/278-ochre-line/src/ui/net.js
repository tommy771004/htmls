// 主選單的「連線」分頁：取名、建房／輸入房號加入、選邊、房主開賽。比賽中加入的人挑一個電腦席位接手。
// 狀態全部來自 client.js 的 NET（伺服器的 lobby 訊息），這裡只畫畫面、送 side／start／diff。
import { NET, onNet, join, leave, send, serverBase, savedName, saveName, newRoomCode } from '../net/client.js';
import { TEAM_NAME, TEAM_COLOR, OPT } from '../game/state.js';
import { BOT_NAMES } from '../game/round.js';

const DIFF = ['簡單', '普通', '困難'];
const ERR = {
  notfound: '找不到這個房號，房間可能已經關閉。', taken: '房號剛好有人用，請再按一次建立。', full: '房間已滿 10 人。',
  replaced: '這個身分在另一個分頁進房了。', idle: '太久沒有回應，已離開房間。', sidefull: '那一邊已經 5 人。',
  hostgone: '房主斷線太久，比賽結束，回到房間。', hostleft: '房主離開了比賽，回到房間。', gone: '比賽在斷線期間結束了。', lost: '和伺服器的連線中斷了。',
};
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
let root, msg = '', acts;

function slots(team) {
  const side = team ? 'def' : 'atk', out = [];
  if (NET.phase === 'match' && NET.roster) {
    NET.roster.forEach((r, i) => { if (r.team !== team) return; const p = NET.players.find(q => q.id === r.pid); out.push(r.pid ? { name: r.name, me: r.pid === NET.id, host: r.pid === NET.host, off: p && !p.online } : { bot: BOT_NAMES[i] }); });
    return out;
  }
  for (const p of NET.players) if (p.side === side) out.push({ name: p.name, me: p.id === NET.id, host: p.id === NET.host, off: !p.online });
  while (out.length < 5) out.push({ bot: '' });
  return out;
}
function teamHtml(team) {
  const side = team ? 'def' : 'atk', list = slots(team), humans = list.filter(s => s.bot === undefined).length;
  const mineSide = NET.players.find(p => p.id === NET.id)?.side === side, inRoster = NET.roster?.some(r => r.pid === NET.id);
  const can = NET.phase === 'lobby' ? !mineSide && humans < 5 : !inRoster && list.some(s => s.bot !== undefined);
  const label = NET.phase === 'lobby' ? `加入${TEAM_NAME[team]}` : `加入${TEAM_NAME[team]}，接手電腦`;
  return `<section class="n-team" style="--c:${TEAM_COLOR[team]}"><h3><i class="m-sil"></i>${TEAM_NAME[team]}<small>${team ? '守方' : '攻方'} · 真人 ${humans}／5</small></h3>
    <ol>${list.map(s => s.bot !== undefined
      ? `<li class="bot"><i class="m-sil"></i><span>${s.bot ? esc(s.bot) : '電腦補位'}</span><small>電腦</small></li>`
      : `<li class="${s.me ? 'me' : ''}"><i class="m-sil"></i><span>${esc(s.name)}</span><small>${s.off ? '斷線中' : s.host ? '房主' : s.me ? '你' : '玩家'}</small></li>`).join('')}</ol>
    <button type="button" class="n-side" data-side="${side}" ${can ? '' : 'disabled'}>${mineSide && NET.phase === 'lobby' ? '你在這一邊' : label}</button></section>`;
}
function render() {
  if (!root) return;
  const base = serverBase();
  if (!base) {
    root.innerHTML = `<div class="m-sheet n-sheet"><h2>連線對戰</h2><p>這個版本沒有設定連線伺服器，只能和電腦對戰。</p><p class="m-snote">在本機執行 <b>npm start</b> 後開 http://127.0.0.1:8127/web/278-ochre-line.html 就能連線；公開網站要先部署 Cloudflare Worker，再用 OL_SERVER 重新打包（見 NET.md）。</p></div>`;
    return;
  }
  const err = msg ? `<p class="n-err" role="alert">${esc(msg)}</p>` : '';
  if (NET.status === 'off' || NET.status === 'connecting' && !NET.id) {
    const busy = NET.status === 'connecting';
    root.innerHTML = `<div class="m-sheet n-sheet"><h2>連線對戰</h2><p>五對五，自己選邊，人數不足由電腦補滿。房主的瀏覽器負責跑整場比賽，房主離開比賽就結束。</p>
      <div class="n-form"><label class="m-lab" for="n-name">你的名字</label><input id="n-name" maxlength="12" autocomplete="nickname" value="${esc(savedName())}" placeholder="最多 12 字">
      <div class="n-acts"><button type="button" id="n-create" class="n-main" ${busy ? 'disabled' : ''}>建立房間</button>
      <div class="n-join"><input id="n-code" inputmode="numeric" maxlength="6" pattern="\\d{6}" placeholder="六位數房號" aria-label="房號" value="${esc(new URLSearchParams(location.search).get('room') || '')}"><button type="button" id="n-go" ${busy ? 'disabled' : ''}>加入</button></div></div></div>
      ${busy ? '<p class="n-st">連線中</p>' : ''}${err}</div>`;
    const name = root.querySelector('#n-name'), code = root.querySelector('#n-code');
    const go = (c, create) => { const n = name.value.trim(); saveName(n); msg = ''; join(c, n, create); render(); };
    root.querySelector('#n-create').onclick = () => go(newRoomCode(), true);
    root.querySelector('#n-go').onclick = () => { const c = code.value.trim(); if (!/^\d{6}$/.test(c)) { msg = '房號是六位數字。'; render(); return; } go(c, false); };
    code.onkeydown = e => { if (e.key === 'Enter') root.querySelector('#n-go').click(); };
    return;
  }
  const host = NET.isHost, inMatch = NET.phase === 'match', st = NET.status === 'retry' ? '連線中斷，重新連線中' : NET.status === 'connecting' ? '連線中' : `已連線 · ${NET.ping || '–'} ms`;
  const hostName = NET.players.find(p => p.id === NET.host)?.name ?? '';
  const waitOut = NET.players.filter(p => !p.side || (inMatch && !NET.roster?.some(r => r.pid === p.id)));
  root.innerHTML = `<div class="m-sheet n-sheet n-room"><header class="n-head"><div><h2>房號 <b class="n-code">${NET.code}</b></h2><p class="n-st">${st}</p></div>
      <button type="button" id="n-copy">複製邀請網址</button><button type="button" id="n-leave">離開房間</button></header>
    <p class="n-info">房主 ${esc(hostName)} · 電腦難度${DIFF[NET.diff] ?? '普通'}（房主的設定）${inMatch ? ' · <b>比賽進行中</b>，選一邊就能接手那邊的電腦' : ''}</p>
    <div class="n-teams">${teamHtml(0)}${teamHtml(1)}</div>
    ${waitOut.length ? `<p class="n-wait">還沒選邊：${waitOut.map(p => esc(p.name)).join('、')}${inMatch ? '' : '（開賽時自動分到人少的一邊）'}</p>` : ''}
    <div class="n-foot">${inMatch ? '' : host ? `<button type="button" id="n-start" class="n-main">開始比賽</button><span>空位由電腦補滿</span>` : '<span>等房主開始比賽</span>'}</div>${err}</div>`;
  for (const b of root.querySelectorAll('.n-side')) b.onclick = () => { msg = ''; send({ t: 'side', side: b.dataset.side }); };
  root.querySelector('#n-leave').onclick = () => { msg = ''; leave(); render(); };
  root.querySelector('#n-copy').onclick = e => {
    const u = new URL(location.href); u.search = ''; u.searchParams.set('room', NET.code); if (new URLSearchParams(location.search).get('server')) u.searchParams.set('server', new URLSearchParams(location.search).get('server'));
    navigator.clipboard?.writeText(u.href).then(() => { e.target.textContent = '已複製'; setTimeout(() => { e.target.textContent = '複製邀請網址'; }, 1600); }, () => { e.target.textContent = u.href; });
  };
  const s = root.querySelector('#n-start'); if (s) s.onclick = () => { acts.netWarm?.(); send({ t: 'diff', diff: OPT.diff }); send({ t: 'start' }); };
}

export function initNet(el, actions) {
  root = el; acts = actions;
  for (const t of ['welcome', 'lobby', 'status', 'pong']) onNet(t, () => { if (t === 'pong' && root.offsetParent === null) return; render(); });
  for (const t of ['notfound', 'taken', 'full', 'replaced', 'idle']) onNet(t, () => { msg = ERR[t]; render(); });
  onNet('err', m => { msg = ERR[m.why] ?? '伺服器拒絕了這個動作。'; render(); });
  onNet('welcome', () => { if (NET.isHost) send({ t: 'diff', diff: OPT.diff }); });
  render();
}
/** main.js：比賽被迫結束回到房間時顯示原因。 */
export function netNotice(why) { msg = ERR[why] ?? ''; render(); }
export const renderNet = render;
