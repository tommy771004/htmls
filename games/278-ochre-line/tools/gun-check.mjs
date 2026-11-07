#!/usr/bin/env node
// 單槍實機驗收：node tools/gun-check.mjs <id>[,<id>] [--page=dist/x.html]
// 沒給 --page 就先打包開發版到 dist/gun-check-<第一個 id>.html。不碰 web/，多個 agent 可以同時跑。
// 截圖存 dist/shots/gun_<id>_*.png：持槍、開火、換彈中段與後段、檢視、開鏡（桌機 1440×900、手機直式 390×844），
// 以及主選單舞台的第三人稱（stage）。這支工具只驗「能跑、沒錯誤、彈藥對」，手與槍的關係要自己看圖。
import { startServer, launch, GAME_DIR } from './lib/serve.mjs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const ids = process.argv[2]?.startsWith('--') ? null : process.argv[2]?.split(',');
const pageArg = process.argv.find(a => a.startsWith('--page='))?.slice(7);
if (!ids) { console.log('用法：node tools/gun-check.mjs m7[,b90] [--page=dist/x.html]'); process.exit(2); }
const html = pageArg ?? `dist/gun-check-${ids[0]}.html`;
if (!pageArg) execFileSync('node', ['tools/build.mjs', `--out=${html}`], { cwd: GAME_DIR, stdio: 'ignore' });
const dir = resolve(GAME_DIR, 'dist/shots'); mkdirSync(dir, { recursive: true });
const s = await startServer(undefined, { '/web/278-ochre-line.html': resolve(GAME_DIR, html) }), b = await launch();
let fails = 0;
const check = (n, ok, d = '') => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${d ? '  ' + d : ''}`); };

async function open(w, h, touch, q) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch, deviceScaleFactor: 1 }), p = await ctx.newPage(), bad = [];
  p.on('console', m => { if (m.type() === 'error' || /validation|Destroyed texture/i.test(m.text())) bad.push(m.text().slice(0, 240)); });
  p.on('pageerror', e => bad.push('uncaught ' + String(e.stack || e).slice(0, 260)));
  await p.goto(`${s.url}/web/278-ochre-line.html${q}`);
  await p.waitForFunction(() => window.__ol?.ready || /^ERR/.test(document.title), null, { timeout: 120000 });
  return { ctx, p, bad };
}

try {
  for (const [tag, w, h, touch] of [['desk', 1440, 900, false], ['port', 390, 844, true]]) {
    const { ctx, p, bad } = await open(w, h, touch, '?clean=1');
    await p.evaluate(async () => { const O = __ol, G = O.G, W = ms => new Promise(f => setTimeout(f, ms)); O.startMatch({ side: 'def' }); O.setClean(true); G.time = 1; while (G.phase === 'buy') await W(50); G.time = 900; G.me.hp = 1e6; await W(500); });
    for (const id of ids) {
      await p.evaluate(id => { const O = __ol; O.G.time = 900; O.G.me.hp = 1e6; O.giveWeapon(id); }, id);
      await p.waitForTimeout(900);
      await p.screenshot({ path: `${dir}/gun_${id}_fp_${tag}.png` });
      const info = await p.evaluate(() => { const c = __GAME_MCP__.vm.cur; return { group: c?.id, holder: c?.holder?.name, gun: c?.gun?.name, muzzle: c?.muzzle?.name }; });
      check(`${id} ${tag} 手上是這把`, info.group === id, JSON.stringify(info));

      const shot = await p.evaluate(id => { const O = __ol, m = O.G.me; return { a0: m.ammo[id], rate: O.fire(1) }; }, id);
      await p.waitForTimeout(70); await p.screenshot({ path: `${dir}/gun_${id}_shot_${tag}.png` }); await p.waitForTimeout(900);
      const a1 = await p.evaluate(id => __ol.G.me.ammo[id], id);
      check(`${id} ${tag} 開火扣彈`, a1 < shot.a0, `${shot.a0} -> ${a1}`);

      await p.evaluate(() => { __ol.input.reload = true; }); await p.waitForTimeout(80); await p.evaluate(() => { __ol.input.reload = false; });
      const T = await p.evaluate(() => __GAME_MCP__.vm.reloadT);
      check(`${id} ${tag} 開始換彈`, T > 0, `reloadT=${T}`);
      await p.waitForTimeout(T * 300); await p.screenshot({ path: `${dir}/gun_${id}_reloadA_${tag}.png` });
      await p.waitForTimeout(T * 250); await p.screenshot({ path: `${dir}/gun_${id}_reloadB_${tag}.png` });
      await p.waitForTimeout(T * 550 + 300);
      const a2 = await p.evaluate(id => __ol.G.me.ammo[id], id);
      check(`${id} ${tag} 換彈完補滿或補進一發`, a2 > a1, `${a1} -> ${a2}`);

      await p.evaluate(() => { __ol.input.inspect = true; }); await p.waitForTimeout(1250);
      await p.screenshot({ path: `${dir}/gun_${id}_inspect_${tag}.png` }); await p.waitForTimeout(1500);
      if (await p.evaluate(() => { const O = __ol; O.input.alt = true; return true; })) {
        await p.waitForTimeout(350);
        if (await p.evaluate(() => __ol.G.scoped)) await p.screenshot({ path: `${dir}/gun_${id}_scope_${tag}.png` });
        await p.evaluate(() => { __ol.input.alt = false; }); await p.waitForTimeout(60);
        await p.evaluate(() => { const O = __ol; if (O.G.scoped) { O.input.alt = true; } }); await p.waitForTimeout(60); await p.evaluate(() => { __ol.input.alt = false; });
      }
    }
    check(`${tag} 無錯誤`, !bad.length, bad[0] ?? '');
    await ctx.close();
  }
  // 第三人稱：軍械頁點槍，舞台士兵走和 bot 相同的 updateSoldiers
  const { ctx, p, bad } = await open(1440, 900, false, '');
  await p.evaluate(() => document.querySelector('[data-tab=arms]').click()); await p.waitForTimeout(300);
  for (const id of ids) {
    const i = await p.$$eval('.m-tile span', (e, n) => e.findIndex(x => x.textContent.startsWith(n + ' ')), id.toUpperCase());
    check(`${id} 軍械頁有這把`, i >= 0);
    if (i < 0) continue;
    await p.evaluate(i => document.querySelectorAll('.m-tile')[i].click(), i); await p.waitForTimeout(900);
    await p.evaluate(() => document.querySelector('[data-tab=play]').click()); await p.waitForTimeout(900);
    await p.screenshot({ path: `${dir}/gun_${id}_stage.png` });
    await p.evaluate(() => document.querySelector('[data-tab=arms]').click()); await p.waitForTimeout(200);
  }
  check('舞台無錯誤', !bad.length, bad[0] ?? '');
  await ctx.close();
} finally { await b.close(); await s.close(); }
console.log(fails ? `未通過 ${fails} 項` : '全部通過');
process.exitCode = fails ? 1 : 0;
