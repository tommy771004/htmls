// 模擬測試：無頭 Chrome 開啟打包好的單檔，用 __game.simulate() 跑 bot 物理（不渲染），檢查 SPEC 的平衡基準與不變量。
// 用法：node tools/playtest.mjs [html=../../web/194-powder-peak.html] [--seeds=1,7,42,2026] [--secs=180] [--json]
// 先 npm run build。結束碼 0 = 全部通過。
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, toUrl } from './shot.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (k, d) => {
  const a = args.find((x) => x.startsWith(`--${k}=`));
  return a ? a.slice(k.length + 3) : d;
};
const html = args.find((a) => !a.startsWith('--')) || resolve(root, '../../web/194-powder-peak.html');
const seeds = opt('seeds', '1,7,42,2026').split(',').map(Number);
const secs = +opt('secs', 180);

const results = [];
let failed = 0;
function check(name, ok, detail) {
  results.push({ name, ok, detail });
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? '  ' + detail : ''}`);
}
const pct = (s) => (s.gatesPassed + s.gatesMissed ? (100 * s.gatesPassed) / (s.gatesPassed + s.gatesMissed) : 100);
const fmt = (s) =>
  `${s.distance.toFixed(0)} m, ${s.maxSpeedKmh.toFixed(0)} km/h, air ${s.longestAir.toFixed(2)} s, ` +
  `crash ${s.crashes}, gates ${s.gatesPassed}/${s.gatesPassed + s.gatesMissed}, hits ${s.hits}, fence ${s.fenceHits}`;
const finite = (s) => ['distance', 'maxSpeedKmh', 'longestAir', 'avgSpeedKmh', 'time', 'score'].every((k) => Number.isFinite(s[k]));

const browser = await launch();
try {
  for (const seed of seeds) {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    page.on('console', (m) => m.type() === 'error' && errors.push('console.error: ' + m.text()));
    await page.setViewport({ width: 960, height: 540 });
    await page.goto(toUrl(`${html}?seed=${seed}&mute=1`), { waitUntil: 'load' });
    await page.waitForFunction(() => window.__game && window.__game.state === 'title', { timeout: 20000 });

    // 1. 預設 bot（近乎完美）：SPEC「simulate(180)：約 4.8 km、0 摔、100% 過門」
    const perfect = await page.evaluate((t) => window.__game.simulate(t), secs);
    check(`seed ${seed} 完美 bot 數值有限`, finite(perfect), fmt(perfect));
    check(`seed ${seed} 完美 bot 0 摔`, perfect.crashes === 0, `crash ${perfect.crashes}`);
    check(`seed ${seed} 完美 bot 過門 ≥ 97%`, pct(perfect) >= 97, `${pct(perfect).toFixed(1)}%`);
    check(`seed ${seed} 完美 bot 距離 ≥ ${(secs * 22).toFixed(0)} m`, perfect.distance >= secs * 22, `${perfect.distance.toFixed(0)} m`);
    check(`seed ${seed} 模擬後回到暫停畫面`, perfect.state === 'paused' && !perfect.ended, `state ${perfect.state}`);

    // 2. 同一 seed 再跑一次要完全一樣（決定性）
    const again = await page.evaluate((t) => window.__game.simulate(t), secs);
    check(`seed ${seed} 可重現`, again.distance === perfect.distance && again.crashes === perfect.crashes && again.gatesPassed === perfect.gatesPassed,
      `${perfect.distance.toFixed(3)} vs ${again.distance.toFixed(3)}`);

    // 3. 弱化 bot：SPEC「reactionTime 0.45、aimNoise 0.15 → 約 4.1 km、0–2 摔、87–92% 過門」（放寬範圍，防 seed 差異）
    const weak = await page.evaluate((t) => {
      const b = window.__game.config.bot;
      const keep = { reactionTime: b.reactionTime, aimNoise: b.aimNoise };
      Object.assign(b, { reactionTime: 0.45, aimNoise: 0.15 });
      try {
        return window.__game.simulate(t);
      } finally {
        Object.assign(b, keep);
      }
    }, secs);
    check(`seed ${seed} 弱化 bot 設定有生效（結果和完美 bot 不同）`,
      weak.distance !== perfect.distance || weak.gatesMissed !== perfect.gatesMissed, fmt(weak));
    check(`seed ${seed} 弱化 bot 過門 70–99%`, pct(weak) >= 70 && pct(weak) <= 99.5, `${pct(weak).toFixed(1)}%`);
    check(`seed ${seed} 弱化 bot 距離 ≥ ${(secs * 18).toFixed(0)} m`, weak.distance >= secs * 18, `${weak.distance.toFixed(0)} m`);

    // 4. 還原設定後又要回到完美 bot 的結果（弱化參數不能殘留）
    const back = await page.evaluate((t) => window.__game.simulate(t), secs);
    check(`seed ${seed} 還原設定後結果一致`, back.distance === perfect.distance, `${back.distance.toFixed(3)}`);

    // 5. 摔三次結束：很爛的 bot + 非 endless，要進結算畫面，且摔倒次數 = 3
    const end = await page.evaluate(() => {
      const b = window.__game.config.bot;
      const keep = { reactionTime: b.reactionTime, aimNoise: b.aimNoise };
      Object.assign(b, { reactionTime: 0.9, aimNoise: 0.9 });
      try {
        return window.__game.simulate(900, undefined, { endless: false });
      } finally {
        Object.assign(b, keep);
      }
    });
    check(`seed ${seed} 摔滿三次會結束`, end.ended && end.crashes === 3, `ended ${end.ended}, crash ${end.crashes}, ${end.distance.toFixed(0)} m`);
    const st = await page.evaluate(() => window.__game.state);
    check(`seed ${seed} 結束後進結算畫面`, st === 'results', `state ${st}`);

    // 6. 結算後重開一局要歸零
    const fresh = await page.evaluate(() => {
      window.__game.restart();
      return window.__game.stats();
    });
    check(`seed ${seed} 重開後統計歸零`, fresh.distance < 1 && fresh.crashes === 0 && fresh.gatesPassed === 0, fmt(fresh));

    check(`seed ${seed} 沒有頁面錯誤`, errors.length === 0, errors.slice(0, 3).join(' | '));
    await page.close();
  }
} finally {
  await browser.close();
}

console.log(`\n${results.length - failed}/${results.length} 通過`);
if (args.includes('--json')) console.log(JSON.stringify(results, null, 1));
process.exit(failed ? 1 : 0);
