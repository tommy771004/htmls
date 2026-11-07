// 計分板：Tab 顯示。
import { TEAM_NAME, TEAM_COLOR } from '../game/state.js';
let G, el, on = false;
export function initScore(root, g) { G = g; el = document.createElement('div'); el.id = 'board'; root.appendChild(el); }
export function frameScore() {
  const want = G.scoreOpen && !!G.me;
  if (want !== on) { on = want; el.style.display = on ? 'block' : 'none'; if (on) render(); }
}
function render() {
  let h = '<table>';
  for (const t of [0, 1]) {
    h += `<tr class="t"><td style="color:${TEAM_COLOR[t]}">${TEAM_NAME[t]} ${G.score[t]}</td><td>擊殺</td><td>死亡</td><td>金錢</td></tr>`;
    for (const a of G.agents) if (a.team === t) h += `<tr class="${a.alive ? '' : 'dead'}"><td>${a.name}</td><td>${a.kills}</td><td>${a.deaths}</td><td>${t === G.me.team ? '$' + a.money : ''}</td></tr>`;
  }
  el.innerHTML = h + '</table>';
}
