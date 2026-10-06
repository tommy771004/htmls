// 開發用：骨架／權重壓力測試。每名英雄擺 12 個大動作 × 2 個角度＋手腳特寫，拼成 dist/stress/<id>.png（每格標註動作與角度）。
// node tools/stress.mjs [id,id…] [動作清單]   （預設全部 14 人；一次打包、同一個瀏覽器依序拍）
// 動作清單（選填）：逗號分隔的 動作[:技能鍵]@時間，例如 "atk1@0.06,atk1@0.13,cast:Q@0.2"，取代預設的 12 個動作；輸出 dist/stress/<id>.png
import { build } from 'esbuild';
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { loadPlaywright, GPU_ARGS } from './lib.mjs';
import { HERO_IDS } from '../src/models.js';
const ids = (process.argv[2] || HERO_IDS.join(',')).split(',');
const r = await build({ entryPoints: ['tools/viewer-entry.js'], bundle: true, format: 'iife', write: false, logLevel: 'warning' });
mkdirSync('dist/stress/cells', { recursive: true });
writeFileSync('dist/stress/viewer.html', `<!doctype html><meta charset="utf-8"><style>body{margin:0;overflow:hidden}</style><body></body><script>${r.outputFiles[0].text.replace(/<\/script/gi, '<\\/script')}</script>`);
const custom = process.argv[3] ? process.argv[3].split(',').map((e) => { const [a, t] = e.split('@'); const [n, key] = a.split(':'); return [n, +(t || 0.2), key]; }) : null;
const POSES = custom || [['idle', 0.4], ['run', 0.3], ['atk1', 0.13], ['atk2', 0.15], ['atk3', 0.19], ['dash', 0.1], ['beam', 0.8], ['cast', 0.2], ['overhead', 0.35], ['air', 0.4], ['rush', 0.05], ['dead', 1]];
const CLOSE = [['stand', 0, 'handL', 10], ['beam', 0.8, 'handR', 7], ['atk1', 0.13, 'handR', 7], ['stand', 0, 'head', 4]];
const chromium = await loadPlaywright();
const browser = await chromium.launch({ headless: true, args: GPU_ARGS });
const page = await browser.newPage({ viewport: { width: 420, height: 420 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e))); page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
const shot = async (q, file) => {
  await page.goto('file://' + process.cwd() + '/dist/stress/viewer.html?' + q);
  await page.waitForFunction(() => window.__v && window.__v.ready, null, { timeout: 30000 }).catch(() => errs.push('timeout ' + q));
  await page.screenshot({ path: file });
};
for (const id of ids) {
  const cells = [];
  for (const [a, t, key] of POSES) for (const ang of [35, -125]) {
    const tag = `${a}${key ? '_' + key : ''}${custom ? '@' + t : ''}`;
    const f = `dist/stress/cells/${id}-${tag}-${ang}.png`;
    await shot(`ids=${id}&anim=${a}&t=${t}&ang=${ang}&zoom=1.05&y=0.9&pitch=18${key ? '&key=' + key : ''}`, f); cells.push([f, `${tag} ${ang}°`]);
  }
  if (!custom) for (const [a, t, focus, zm] of CLOSE) for (const ang of [30, -60]) {
    const f = `dist/stress/cells/${id}-${a}-${focus}-${ang}.png`;
    await shot(`ids=${id}&anim=${a}&t=${t}&ang=${ang}&zoom=${zm}&focus=${focus}&pitch=10`, f); cells.push([f, `${a} ${focus} ${ang}°`]);
  }
  const html = `<body style="margin:0;background:#222;display:grid;grid-template-columns:repeat(8,210px);gap:2px;font:12px sans-serif;color:#ff0">` +
    cells.map(([f, l]) => `<div style="position:relative"><img src="data:image/png;base64,${readFileSync(f).toString('base64')}" style="width:210px;display:block"><span style="position:absolute;left:2px;top:1px;background:#000">${l}</span></div>`).join('') + '</body>';
  const p2 = await browser.newPage({ viewport: { width: 8 * 212, height: 400 } });
  await p2.setContent(html); await p2.waitForTimeout(300);
  await p2.screenshot({ path: `dist/stress/${id}.png`, fullPage: true }); await p2.close();
  console.log(`dist/stress/${id}.png`);
}
console.log(errs.length ? errs.slice(0, 5) : 'ok');
await browser.close();
