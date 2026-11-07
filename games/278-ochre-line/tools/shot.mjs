#!/usr/bin/env node
// node tools/shot.mjs --spot key,siteA --size 1600x900 --dir dist/shots [--q gfx=webgl]
import { startServer, launch, GAME_DIR } from './lib/serve.mjs';
import { resolve } from 'node:path';
import { mkdirSync } from 'node:fs';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
const spots = arg('spot', 'key,siteA,siteB,mid,alley').split(','), [w, h] = arg('size', '1600x900').split('x').map(Number);
const dir = resolve(GAME_DIR, arg('dir', 'dist/shots')), extra = arg('q', ''); mkdirSync(dir, { recursive: true });
const page0 = arg('page', 'web/278-ochre-line.html');
const s = await startServer(), b = await launch();
try {
  const p = await b.newPage({ viewport: { width: w, height: h } });
  p.on('console', m => { const t = m.text(); if (m.type() === 'error' || m.type() === 'warning' || /^boot/.test(t)) console.log(`[${m.type()}]`, t.slice(0, 400)); });
  p.on('pageerror', e => console.log('[pageerror]', String(e).slice(0, 400)));
  await p.goto(`${s.url}/${page0}?spot=${spots[0]}${extra ? '&' + extra : ''}`);
  await p.waitForFunction(() => window.__ol?.ready || /^ERR/.test(document.title), null, { timeout: 90000 });
  if (/^ERR/.test(await p.title())) process.exitCode = 1;
  for (const n of spots) {
    await p.evaluate(n => window.__ol?.spot?.(n), n);
    await p.waitForTimeout(1500);
    await p.screenshot({ path: `${dir}/${n}.png` });
    console.log('shot', n);
  }
  console.log(await p.evaluate(() => { const c = window.__ol?.ctx; return c ? JSON.stringify({ fps: c.engine.getFps(), active: c.scene.getActiveMeshes().length, meshes: c.scene.meshes.length, webgpu: c.isWebGPU }) : 'no'; }));
} finally { await b.close(); await s.close(); }
