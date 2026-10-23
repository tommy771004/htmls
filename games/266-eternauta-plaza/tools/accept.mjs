// 驗收：PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node games/266-eternauta-plaza/tools/accept.mjs [輸出資料夾]
// 以 repo 根目錄起靜態伺服器，用系統 Chrome 在 1440×900 與 390×844 各跑一次：
// 木箱要鐵撬、巡邏車後車廂 → 頭盔與背心、金屬人任務（短步槍 → 擊毀兩具）、新槍射擊，
// 最後檢查沒有 pageerror／console.error、外部請求只有上游素材與 CDN、warn 只有上游缺的 fall／land 片段。
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { dirname, join, extname, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const OUT = resolve(process.argv[2] || join(REPO, 'games/266-eternauta-plaza/.cache/accept'));
await mkdir(OUT, { recursive: true });
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };
const server = createServer(async (req, res) => {
  const p = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname));
  try { const body = await readFile(join(REPO, p)); res.writeHead(200, { 'Content-Type': MIME[extname(p)] || 'application/octet-stream' }); res.end(body); }
  catch { res.writeHead(404); res.end(); }
}).listen(0);
const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const ALLOWED = /^(http:\/\/127\.0\.0\.1|data:|blob:|https:\/\/(cdn\.jsdelivr\.net|raw\.githubusercontent\.com|media\.githubusercontent\.com|github\.com|objects\.githubusercontent\.com))/;
let failed = 0;
const check = (ok, msg) => { console.log(`${ok ? '  ✓' : '  ✗'} ${msg}`); if (!ok) failed++; };

for (const [W, H] of [[1440, 900], [390, 844]]) {
  console.log(`${W}×${H}`);
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('request', r => { if (!ALLOWED.test(r.url())) errors.push('外部請求：' + r.url().slice(0, 100)); });
  await page.goto(`http://127.0.0.1:${server.address().port}/web/266-eternauta-plaza.html`);
  await page.waitForFunction(() => { const s = window.__eter?.state; return s && s.load.actors === 'done' && s.load.col === 'done' && s.load.splat === 'done'; }, null, { timeout: 240000, polling: 500 });
  await page.evaluate(() => __eter.start());
  await page.waitForTimeout(2500);
  const G = () => page.evaluate(() => __eter.game);
  const kinds = await page.evaluate(() => [...new Set(__eter.zombies.map(z => z.kind))].sort().join(','));
  check(kinds === 'robot,soldier,zombie', `敵人池有三種 kind（${kinds}）`);
  check(await page.evaluate(() => __eter.props.length) >= 3, '靜態道具已擺放');

  // 木箱：沒有鐵撬打不開
  await page.evaluate(() => { __eter.god(true); __eter.mission(1); const [x, z] = __eter.PTS.crate; __eter.place(x, z + 1.2); });
  await page.waitForTimeout(500); await page.evaluate(() => __eter.interact()); await page.waitForTimeout(200);
  check(!(await G()).data.opened, '沒有鐵撬時木箱不會開');
  await page.evaluate(() => { __eter.player.owned.crowbar = true; __eter.interact(); }); await page.waitForTimeout(200);
  check((await G()).data.opened, '有鐵撬就撬得開');

  // 巡邏車
  await page.evaluate(() => { __eter.mission(3); __eter.player.owned.crowbar = true; const [x, z] = __eter.PTS.trunk; __eter.place(x - 0.35, z + 0.9); });
  await page.waitForTimeout(600); await page.evaluate(() => __eter.interact()); await page.waitForTimeout(300);
  for (let i = 0; i < 2; i++) {
    await page.evaluate(() => { const p = __eter.pickups.find(p => p.kind === 'vest' || p.kind === 'helmet'); if (p) __eter.place(p.pos.x + 0.4, p.pos.z + 0.4); });
    await page.waitForTimeout(400); await page.evaluate(() => __eter.interact()); await page.waitForTimeout(300);
  }
  await page.waitForTimeout(400);
  let g = await G();
  check(g.helmet && g.vest && g.mission === 'pyramid', `巡邏車：頭盔與背心到手，進入下一段（${g.mission}）`);
  check(!g.pickups.some(p => p.kind === 'trunk'), '撬開的後車廂已清掉');

  // 金屬人
  await page.evaluate(() => { __eter.mission(5); const [x, z] = __eter.PTS.aksu; __eter.place(x, z + 1.2, Math.PI); });
  await page.waitForTimeout(600); await page.evaluate(() => __eter.interact()); await page.waitForTimeout(4500);
  g = await G();
  check(g.owned.includes('aksu') && g.zombies.filter(z => z.kind === 'robot' && z.alive).length === 2, '撿起短步槍後出現兩具金屬人');
  await page.screenshot({ path: join(OUT, `robots_${W}.png`) });
  for (let k = 0; k < 2; k++) { await page.evaluate(() => { const z = __eter.zombies.find(z => z.kind === 'robot' && z.alive); if (z) __eter.hurtZombie(z, 400, null, true); }); await page.waitForTimeout(1200); }
  g = await G();
  check(g.mission === 'radio' && g.pickups.filter(p => p.kind === 'smg').length === 1, `擊毀兩具後進入無線電，只掉一把衝鋒槍（${g.mission}）`);

  // 新槍
  await page.evaluate(() => { __eter.give('smg'); __eter.give('aksu'); });
  for (const w of ['smg', 'aksu']) { await page.evaluate(w => { __eter.equip(w); for (let i = 0; i < 5; i++) __eter.fire(); }, w); await page.waitForTimeout(200); }
  g = await G();
  check(g.mag.smg < 30 && g.mag.aksu < 30, '衝鋒槍與短步槍都能射擊');

  const warn = await page.evaluate(() => __eter.state.warn);
  check(warn.every(w => /fall|land/.test(w)), `warn 只有上游缺的片段（${warn.length} 則）`);
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), '沒有水平溢出');
  check(!errors.length, errors.length ? `錯誤：${errors.slice(0, 5).join(' | ')}` : '沒有錯誤與意外的外部請求');
  await page.close();
}
await browser.close(); server.close();
console.log(failed ? `${failed} 項失敗` : '全部通過');
process.exit(failed ? 1 : 0);
