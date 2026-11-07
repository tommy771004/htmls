#!/usr/bin/env node
// 俯視正交雷達底圖：dist/radar_overview_raw.png（無損）與 assets/278/radar.webp（遊戲內 HUD 用）。要先 build。
import { startServer, launch, GAME_DIR, REPO_ROOT } from './lib/serve.mjs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
const png = resolve(GAME_DIR, 'dist/radar_overview_raw.png'), webp = resolve(REPO_ROOT, 'assets/278/radar.webp');
const s = await startServer(), b = await launch();
try {
  const p = await b.newPage({ viewport: { width: 1000, height: 1000 } });
  p.on('pageerror', e => { console.log('[pageerror]', String(e).slice(0, 300)); process.exitCode = 1; });
  await p.goto(`${s.url}/web/278-ochre-line.html?clean=1&nosnap=1`);
  await p.waitForFunction(() => window.__ol?.ready, null, { timeout: 90000 });
  await p.evaluate(() => { __ol.setClean(true); __ol.orthoTop(); });
  await p.waitForTimeout(2500);
  await p.screenshot({ path: png });
} finally { await b.close(); await s.close(); }
execFileSync('cwebp', ['-quiet', '-q', '82', '-metadata', 'none', png, '-o', webp]);
console.log(png, webp);
