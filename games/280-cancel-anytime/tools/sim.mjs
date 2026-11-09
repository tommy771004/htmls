// 無頭試玩機器人：用真正的規則引擎把 10 關各打 N 場，回報勝率、回合數與例外。
// node tools/sim.mjs [場數=40] [關卡=all]
import * as R from '../src/rules.js';
import { LEVELS } from '../src/data.js';
import { botTurn } from '../src/bot.js';

const N = +(process.argv[2] || 40);
const only = process.argv[3] && process.argv[3] !== 'all' ? [+process.argv[3] - 1] : LEVELS.map((_, i) => i);
const DIFF = process.argv[4] || 'standard';

function play(lv, seed, party) {
  const s = R.createState(lv, party, seed, DIFF);
  const C = s.L.check;
  const hk = C.hero === 'all' ? 'chad' : C.hero;
  const ck = R.rollCheck(s, hk);
  R.applyCheck(s, ck.success, hk);
  R.rollInitiative(s);
  let guard = 0;
  while (!s.over && s.round < 40 && guard++ < 2000) {
    const u = R.current(s);
    const b = R.beginTurn(s);
    if (!b.skip && !s.over) {
      if (u.side === 'hero') botTurn(s, u); else R.aiTurn(s, u);
    }
    R.endTurn(s);
    s.fx.length = 0;
  }
  return { s, check: ck.success };
}

let errs = 0;
for (const lv of only) {
  let win = 0, rounds = 0, downs = 0, gone = 0, checks = 0, hpLeft = 0;
  for (let i = 0; i < N; i++) {
    try {
      const { s, check } = play(lv, 1000 + i * 7919, R.partyForLevel(lv));
      if (s.over === 'win') { win++; hpLeft += s.units.filter(u => u.side === 'hero').reduce((a, u) => a + (u.gone ? 0 : u.hp / u.maxHp), 0) / 4; }
      rounds += s.round;
      gone += s.units.filter(u => u.side === 'hero' && u.gone).length;
      checks += check;
    } catch (e) { errs++; console.error(`L${lv + 1} seed ${i}:`, e.stack.split('\n').slice(0, 4).join('\n')); }
  }
  console.log(`L${String(lv + 1).padStart(2)} ${LEVELS[lv].name.padEnd(24, '　')} 勝率 ${(win / N * 100).toFixed(0).padStart(3)}%  平均回合 ${(rounds / N).toFixed(1)}  勝場剩血 ${(win ? hpLeft / win * 100 : 0).toFixed(0)}%  救護車 ${(gone / N).toFixed(2)}/場  嘴砲成功 ${(checks / N * 100).toFixed(0)}%`);
}
if (errs) { console.error(`${errs} 場丟出例外`); process.exit(1); }
