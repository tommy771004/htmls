// 驗收：開啟打包後的 web/268-terra-sandbox.html，在 1440×900 與 390×844 下檢查
// 0 uncaught exception、0 console.error、0 外部請求、有 viewport meta、手機無水平溢出，
// 並走過五個階段的代表場景各截一張圖（dist/*.png），最後輸出縮圖 thumbs/268.jpg。
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { open, raf } from './lib.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const html = process.argv[2] ? resolve(process.cwd(), process.argv[2]) : resolve(root, '../../web/268-terra-sandbox.html');
const only = process.argv[3] || '';
const distDir = resolve(root, 'dist');
const outThumb = resolve(root, '../../thumbs/268.jpg');
mkdirSync(distDir, { recursive: true });

let fail = 0;
const ok = (c, m) => {
  console.log(`${c ? '✓' : '✗'} ${m}`);
  if (!c) fail++;
};
const T = (page, fn, ...a) => page.evaluate(([f, args]) => window.__terra[f](...args), [fn, a]);
async function settle(page, ms = 600) {
  await page.waitForFunction(() => window.__terra.ready, null, { timeout: 40000 });
  await page.waitForTimeout(ms);
  await raf(page);
}

// 桌機場景：[名稱, 動作]
const SCENES = [
  ['nyc-street', async (p) => {
    await T(p, 'time', 15.6);
    await T(p, 'weather', 'clear');
    await T(p, 'cam', (await T(p, 'state')).yaw + 0.3, 0.12, 1);
  }],
  ['nyc-aerial', async (p) => {
    await T(p, 'time', 18.9);
    await T(p, 'mode', 'plane');
    await p.waitForTimeout(1500);
    await T(p, 'cam', 2.6, 0.32, 1.2);
  }],
  ['ams-canal', async (p) => {
    await T(p, 'goto', 'ams');
    await T(p, 'time', 11);
    await T(p, 'weather', 'cloudy');
    await settle(p);
    await T(p, 'place', -38, 60, -1.57);
    await T(p, 'mode', 'boat');
    await T(p, 'cam', -1.2, 0.25, 1.4);
  }],
  ['venice-skate', async (p) => {
    await T(p, 'goto', 'venice');
    await T(p, 'time', 13);
    await T(p, 'weather', 'clear');
    await settle(p);
    await T(p, 'place', 34, 55, 0);
    await T(p, 'mode', 'board');
    await T(p, 'cam', 0.25, 0.25, 1.4);
  }],
  ['whistler-lift', async (p) => {
    await T(p, 'goto', 'whistler');
    await T(p, 'time', 10.5);
    await T(p, 'weather', 'clear');
    await settle(p);
    await T(p, 'lift');
    await p.waitForTimeout(9000);
    await T(p, 'cam', 2.4, 0.15, 1.6);
  }],
  ['shuttle-launch', async (p) => {
    await T(p, 'goto', 'venice');
    await T(p, 'time', 9.5);
    await T(p, 'weather', 'clear');
    await settle(p);
    await T(p, 'place', 30, -60, 0.3);
    await T(p, 'shuttle', 'launch');
    await p.waitForTimeout(12000);
    const st = await T(p, 'shuttle');
    ok(st.phase === 'ascent' && st.alt > 800, `太空梭升空：${st.phase}、高度 ${Math.round(st.alt)} m`);
    await T(p, 'cam', 0.3 + 2.6, 0.05, 1.3);
  }],
  ['shuttle-orbit', async (p) => {
    await T(p, 'time', 17.2);
    await T(p, 'shuttle', 'orbit', 20, -150);
    await p.waitForTimeout(3000);
    const st = await T(p, 'shuttle');
    ok(st.phase === 'orbit' && st.alt > 100000, `太空梭入軌：高度 ${(st.alt / 1000).toFixed(0)} km`);
    await T(p, 'cam', 0.3, 0.38, 1.5);
  }],
  ['interior', async (p) => {
    await T(p, 'goto', 'nyc');
    await T(p, 'time', 20);
    await settle(p);
    const name = await T(p, 'enter');
    await p.waitForTimeout(500);
    const st = await T(p, 'state');
    ok(!!st.inside && st.inside.rooms > 0, `走進建物（${name}）：${st.inside ? `${st.inside.rooms} 個空間` : '失敗'}`);
  }],
  ['storm', async (p) => {
    await T(p, 'goto', 'kirkwood');
    await T(p, 'time', 17);
    await settle(p);
    await T(p, 'weather', 'tornado');
    await p.waitForTimeout(1200);
    await T(p, 'cam', -1.45, -0.05, 1.2);
  }],
  ['photo', async (p) => {
    await T(p, 'goto', 'taipei');
    await T(p, 'time', 19.2);
    await T(p, 'weather', 'rain');
    await settle(p);
    await T(p, 'photo', true);
    await T(p, 'cam', 0.3, 0.1, 0.9);
    await p.waitForTimeout(800);
  }],
  ['procedural', async (p) => {
    const a = await T(p, 'realMap', false);
    const b = await T(p, 'realMap', true);
    ok(a === 'proc' && b === 'osm', `切換程序街區／真實街道：${a} → ${b}`);
  }],
  ['map', async (p) => {
    await T(p, 'photo', false);
    await T(p, 'nav', 'niagara');
    await T(p, 'overlay', 'map');
    await p.waitForTimeout(300);
  }],
];

for (const [w, h, touch] of [[1440, 900, false], [390, 844, true]]) {
  const tag = `${w}×${h}`;
  const { browser, page, log } = await open(html, { w, h, touch });
  try {
    await settle(page, 900);
    const meta = await page.evaluate(() => ({
      vp: !!document.querySelector('meta[name=viewport]'),
      overflow: document.documentElement.scrollWidth <= innerWidth && document.body.scrollWidth <= innerWidth,
      st: window.__terra.state(),
      tests: window.__terra.tests(),
    }));
    ok(meta.vp, `${tag} viewport meta`);
    ok(meta.overflow, `${tag} 無水平溢出`);
    ok(meta.tests.passed === meta.tests.total, `${tag} 引擎自我測試 ${meta.tests.passed}/${meta.tests.total}`);
    ok(meta.st.map === 'osm', `${tag} 真實街道（OpenStreetMap）：${meta.st.place}`);
    ok(meta.st.stats.drawn > 10 && meta.st.render.chunkMeshes > 10, `${tag} 圖磚串流 繪製 ${meta.st.stats.drawn} · 網格 ${meta.st.render.chunkMeshes} · ${meta.st.render.calls} calls`);
    if (w > 1000) {
      for (const [name, act] of SCENES) {
        if (only && !name.includes(only)) continue;
        await act(page);
        await page.waitForTimeout(700);
        await raf(page);
        await page.screenshot({ path: resolve(distDir, `${name}.png`) });
        console.log(`  · ${name}.png`);
      }
      if (!only) {
        await T(page, 'overlay', null);
        await T(page, 'goto', 'nyc');
        await T(page, 'time', 16.2);
        await T(page, 'weather', 'clear');
        await settle(page);
        await T(page, 'hud', false);
        // 真實街道的出生點朝著街道方向：鏡頭沿街看過去
        await T(page, 'cam', (await T(page, 'state')).yaw + 0.3, 0.1, 1);
        await page.waitForTimeout(2800);
        await page.evaluate(() => ['toasts', 'dock', 'alert'].forEach((id) => (document.getElementById(id).style.visibility = 'hidden')));
        await page.screenshot({ path: resolve(distDir, 'thumb.png') });
        await page.evaluate(() => ['toasts', 'dock', 'alert'].forEach((id) => (document.getElementById(id).style.visibility = '')));
        await T(page, 'hud', true);
      }
    } else {
      await page.screenshot({ path: resolve(distDir, 'mobile.png') });
      await T(page, 'overlay', 'settings');
      await page.waitForTimeout(200);
      const ov = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
      ok(ov, `${tag} 設定面板無水平溢出`);
      await page.screenshot({ path: resolve(distDir, 'mobile-settings.png') });
    }
    ok(log.pageerrors.length === 0, `${tag} 0 uncaught exception${log.pageerrors.length ? `：${log.pageerrors.slice(0, 3).join(' | ')}` : ''}`);
    ok(log.errors.length === 0, `${tag} 0 console.error${log.errors.length ? `：${log.errors.slice(0, 3).join(' | ')}` : ''}`);
    ok(log.external.length === 0, `${tag} 0 外部請求${log.external.length ? `：${log.external.slice(0, 3).join(' ')}` : ''}`);
    if (log.warns.length) console.log(`  （${log.warns.length} 則 warning：${[...new Set(log.warns)].slice(0, 3).join(' | ')}）`);
    console.log(`  GPU：${log.gpu}`);
  } finally {
    await browser.close();
  }
}

if (!only) {
  try {
    execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '82', '-z', '400', '640', resolve(distDir, 'thumb.png'), '--out', outThumb], { stdio: 'ignore' });
    console.log(`縮圖：${outThumb}`);
  } catch {
    console.log('（略過縮圖：沒有 sips）');
  }
}
console.log(fail ? `\n${fail} 項失敗` : '\n全部通過');
process.exit(fail ? 1 : 0);
