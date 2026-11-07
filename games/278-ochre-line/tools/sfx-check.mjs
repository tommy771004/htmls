#!/usr/bin/env node
// 實機音效冒煙：node tools/sfx-check.mjs [--page=dist/audio.html]。真實點開始鈕建立 AudioContext，逐把開火與換彈，確認走的是錄音路徑、沒有錯誤。
import { startServer, launch, GAME_DIR } from './lib/serve.mjs';
import { resolve } from 'node:path';
const html = process.argv.find((a) => a.startsWith('--page='))?.slice(7) ?? 'dist/audio.html';
const s = await startServer(undefined, { '/web/278-ochre-line.html': resolve(GAME_DIR, html) }), b = await launch();
const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } }), p = await ctx.newPage(), bad = [], net = [];
p.on('console', (m) => { if (m.type() === 'error') bad.push(m.text().slice(0, 200)); });
p.on('pageerror', (e) => bad.push('uncaught ' + String(e).slice(0, 200)));
p.on('response', (r) => { if (/\/sfx\//.test(r.url())) net.push([r.url().split('/').pop(), r.status()]); });
let fails = 0; const check = (n, ok, d = '') => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${d ? '  ' + d : ''}`); };
await p.goto(`${s.url}/web/278-ochre-line.html`);
await p.waitForFunction(() => window.__ol?.ready, null, { timeout: 120000 });
console.log('boot ms', await p.evaluate(() => Math.round(__ol.boot)));
await p.click('button[data-s=atk]');
const t0 = Date.now();
await p.waitForFunction(() => __ol.sfx().guns >= 14 && __ol.G.me, null, { timeout: 30000 }).catch(() => {});
const st0 = await p.evaluate(() => __ol.sfx());
check('素材載入', st0.clips >= 40 && st0.guns >= 14 && !st0.failed, JSON.stringify(st0));
console.log('載入完成花', Date.now() - t0, 'ms');
for (const id of ['p9', 'c7', 'r50', 'v11', 'm7', 'b90', 't4', 'ks', 'ar5', 'x10', 's8', 's6', 'l40', 'n9']) {
  const before = await p.evaluate(() => __ol.sfx());
  await p.evaluate((id) => { const O = __ol, m = O.G.me; O.G.time = 900; m.hp = 1e6; O.giveWeapon(id); m.fireT = 0; m.ammo[id] = 3; m.rsv[id] = 30; O.G.phase = 'live'; }, id);
  await p.waitForTimeout(450);
  await p.evaluate(() => __ol.fire(4)); await p.waitForTimeout(700);
  await p.evaluate(() => { __ol.input.fire = false; __ol.input.reload = true; }); await p.waitForTimeout(120);
  await p.evaluate(() => { __ol.input.reload = false; }); await p.waitForTimeout(3700);
  const st = await p.evaluate(() => __ol.sfx());
  check(`${id} 開火與換彈`, st.shots > before.shots && st.foley > before.foley && st.synth === before.synth, `shots +${st.shots - before.shots} foley +${st.foley - before.foley} synth +${st.synth - before.synth} ctx ${st.ctx} voices ${st.voices} last ${st.last}`);
}
check('沒有錯誤', bad.length === 0, bad.slice(0, 3).join(' | '));
check('素材請求', net.length === 2 && net.every((n) => n[1] === 200), JSON.stringify(net));
await b.close(); await s.close();
process.exit(fails ? 1 : 0);
