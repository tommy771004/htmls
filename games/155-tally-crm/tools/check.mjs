#!/usr/bin/env node
// 劃記 TALLY CRM · headless 驗收與截圖（無 npm 相依）
// 用 Node 22 內建 WebSocket 直接走 Chrome DevTools Protocol。
//
//   node games/155-tally-crm/tools/check.mjs [routes...] [options]
//     --eval "<js>"        頁面就緒後執行（可回傳 promise），再截圖
//     --tag name           截圖檔名加上後綴（互動截圖用，避免覆蓋路由截圖）
//     --full               整頁截圖
//     --sizes 1440x900,390x844
//     --themes light,dark
//     --keep-storage       不清 localStorage（預設每張截圖都從示範資料開始）
//     --dev                改測 src/dev.html（未內嵌的原始檔）
//     --wait 400           截圖前等待毫秒數
//     --scale 2            截圖像素密度（檢查細節用）
//
// 失敗條件：uncaught exception、console.error、非 file:/data:/blob: 的請求、
// 缺 viewport meta、手機寬度水平溢出。
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PROJECT = resolve(HERE, '..');
let HTML = resolve(PROJECT, '..', '..', 'web', '155-tally-crm.html');
const SHOTS = join(PROJECT, 'shots');
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const DEFAULT_ROUTES = ['/', '/contacts', '/companies', '/deals', '/tasks', '/activities', '/kit'];

// ── args ──
const args = process.argv.slice(2);
const opts = { routes: [], evalJs: null, tag: '', full: false, scale: 0, sizes: '1440x900,390x844', themes: 'light,dark', keep: false, wait: 400 };
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--eval') opts.evalJs = args[++i];
  else if (a === '--tag') opts.tag = args[++i];
  else if (a === '--full') opts.full = true;
  else if (a === '--scale') opts.scale = Number(args[++i]) || 0;
  else if (a === '--sizes') opts.sizes = args[++i];
  else if (a === '--themes') opts.themes = args[++i];
  else if (a === '--keep-storage') opts.keep = true;
  else if (a === '--dev') HTML = join(PROJECT, 'src', 'dev.html');
  else if (a === '--wait') opts.wait = Number(args[++i]) || 0;
  else if (a.startsWith('--')) { console.error('unknown option ' + a); process.exit(2); }
  else opts.routes.push(a.startsWith('/') ? a : '/' + a);
}
if (!opts.routes.length) opts.routes = DEFAULT_ROUTES;
const sizes = opts.sizes.split(',').map((s) => s.trim().split('x').map(Number)).filter(([w, h]) => w && h);
const themes = opts.themes.split(',').map((s) => s.trim()).filter(Boolean);

if (!existsSync(HTML)) { console.error('找不到 ' + HTML + '，請先執行 build.mjs'); process.exit(2); }
mkdirSync(SHOTS, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const slug = (route) => (route.replace(/\?.*$/, '').replace(/^\/+|\/+$/g, '').replace(/[^\w-]+/g, '-') || 'root');

// ── chrome ──
const profile = mkdtempSync(join(tmpdir(), 'tally-check-'));
const chrome = spawn(CHROME, [
  '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`,
  '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--hide-scrollbars',
  '--allow-file-access-from-files', '--disable-extensions', '--mute-audio', 'about:blank',
], { stdio: ['ignore', 'ignore', 'pipe'] });
chrome.stderr.on('data', () => {});

let cleaned = false;
function cleanup() {
  if (cleaned) return;
  cleaned = true;
  try { chrome.kill('SIGKILL'); } catch {}
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
}
process.on('exit', cleanup);
process.on('SIGINT', () => { cleanup(); process.exit(130); });

async function devtoolsUrl() {
  const file = join(profile, 'DevToolsActivePort');
  for (let i = 0; i < 200; i++) {
    if (existsSync(file)) {
      const [port, path] = readFileSync(file, 'utf8').trim().split('\n');
      if (port && path) return `ws://127.0.0.1:${port}${path}`;
    }
    await sleep(50);
  }
  throw new Error('Chrome 沒有寫出 DevToolsActivePort');
}

// ── CDP client ──
function connect(url) {
  return new Promise((res, rej) => {
    const ws = new WebSocket(url);
    let id = 0;
    const pending = new Map();
    const listeners = new Set();
    ws.onopen = () => res({
      send(method, params = {}, sessionId) {
        const msg = { id: ++id, method, params };
        if (sessionId) msg.sessionId = sessionId;
        ws.send(JSON.stringify(msg));
        return new Promise((ok, ko) => pending.set(msg.id, { ok, ko, method }));
      },
      on(fn) { listeners.add(fn); return () => listeners.delete(fn); },
      close() { ws.close(); },
    });
    ws.onerror = (e) => rej(e.error || new Error('websocket error'));
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && pending.has(msg.id)) {
        const p = pending.get(msg.id);
        pending.delete(msg.id);
        msg.error ? p.ko(new Error(`${p.method}: ${msg.error.message}`)) : p.ok(msg.result);
      } else if (msg.method) {
        for (const fn of listeners) fn(msg);
      }
    };
  });
}

const ALLOWED = /^(file|data|blob|about|chrome-extension|devtools):/;

async function shoot(cdp, route, [w, h], theme) {
  const mobile = w <= 760;
  const problems = [];
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  const send = (m, p) => cdp.send(m, p, sessionId);
  const off = cdp.on((msg) => {
    if (msg.sessionId !== sessionId) return;
    const p = msg.params || {};
    if (msg.method === 'Runtime.exceptionThrown') {
      const d = p.exceptionDetails || {};
      problems.push('exception: ' + ((d.exception && (d.exception.description || d.exception.value)) || d.text));
    } else if (msg.method === 'Runtime.consoleAPICalled' && (p.type === 'error' || p.type === 'assert')) {
      problems.push('console.error: ' + (p.args || []).map((a) => a.value ?? a.description ?? '').join(' '));
    } else if (msg.method === 'Log.entryAdded' && p.entry && p.entry.level === 'error') {
      problems.push('log error: ' + p.entry.text + (p.entry.url ? ' ' + p.entry.url : ''));
    } else if (msg.method === 'Network.requestWillBeSent') {
      const u = p.request && p.request.url;
      if (u && !ALLOWED.test(u)) problems.push('external request: ' + u);
    }
  });
  try {
    await Promise.all(['Runtime.enable', 'Page.enable', 'Network.enable', 'Log.enable'].map((m) => send(m)));
    await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: opts.scale || (mobile ? 2 : 1), mobile });
    if (mobile) await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: theme === 'dark' ? 'dark' : 'light' }] });
    if (!opts.keep) {
      await send('Page.addScriptToEvaluateOnNewDocument', { source: "try{localStorage.removeItem('tally:v1');localStorage.removeItem('tally:theme')}catch(e){}" });
    }
    const [path, q = ''] = route.split('?');
    const query = new URLSearchParams(q);
    query.set('theme', theme);
    const url = pathToFileURL(HTML).href + '#' + path + '?' + query.toString();
    await send('Page.navigate', { url });

    let ready = false;
    for (let i = 0; i < 150 && !ready; i++) {
      await sleep(60);
      const r = await send('Runtime.evaluate', { expression: 'window.CRM_READY === true', returnByValue: true }).catch(() => null);
      ready = !!(r && r.result && r.result.value);
    }
    if (!ready) problems.push('timeout: window.CRM_READY 沒有變成 true');

    if (ready && opts.evalJs) {
      const r = await send('Runtime.evaluate', { expression: `(async () => { ${opts.evalJs} })()`, awaitPromise: true, returnByValue: true, userGesture: true });
      if (r.exceptionDetails) problems.push('eval failed: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
      else if (r.result && r.result.value !== undefined) console.log(`  eval → ${JSON.stringify(r.result.value).slice(0, 300)}`);
    }
    await sleep(opts.wait);

    const probe = await send('Runtime.evaluate', {
      returnByValue: true,
      expression: `(() => { const W = ${w}; return {
        viewport: !!document.querySelector('meta[name="viewport"]'),
        sw: Math.max(document.documentElement.scrollWidth, innerWidth), iw: W,
        sh: document.documentElement.scrollHeight,
        wide: [...document.querySelectorAll('body *')].filter(e => { const r = e.getBoundingClientRect(); const p = e.parentElement.getBoundingClientRect(); return r.width && r.right > W + 1 && p.right <= W + 1; }).slice(0, 4).map(e => e.tagName.toLowerCase() + (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\\s+/).join('.') : '') + ' ' + Math.round(e.getBoundingClientRect().right))
      }; })()`,
    });
    const v = probe.result.value;
    if (!v.viewport) problems.push('viewport meta missing');
    if (mobile && v.sw > v.iw) problems.push(`horizontal overflow: scrollWidth ${v.sw} > ${v.iw} (${v.wide.join(', ')})`);

    if (opts.full && v.sh > h) await send('Emulation.setDeviceMetricsOverride', { width: w, height: Math.min(v.sh, 12000), deviceScaleFactor: opts.scale || (mobile ? 2 : 1), mobile });
    if (opts.full) await sleep(150);
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    const file = join(SHOTS, `${slug(route)}${opts.tag ? '-' + opts.tag : ''}-${w}-${theme}.png`);
    writeFileSync(file, Buffer.from(shot.data, 'base64'));
    return { file, problems };
  } finally {
    off();
    await cdp.send('Target.closeTarget', { targetId }).catch(() => {});
  }
}

let failed = 0;
try {
  const cdp = await connect(await devtoolsUrl());
  const started = Date.now();
  for (const route of opts.routes) {
    for (const size of sizes) {
      for (const theme of themes) {
        const { file, problems } = await shoot(cdp, route, size, theme);
        const label = `${route} ${size.join('×')} ${theme}`;
        if (problems.length) {
          failed++;
          console.log(`✗ ${label}`);
          for (const p of [...new Set(problems)]) console.log('    ' + p);
        } else {
          console.log(`✓ ${label} → ${file.replace(PROJECT + '/', '')}`);
        }
      }
    }
  }
  cdp.close();
  const total = opts.routes.length * sizes.length * themes.length;
  console.log(`\n${total - failed}/${total} passed · ${((Date.now() - started) / 1000).toFixed(1)}s`);
} catch (err) {
  console.error('check failed:', err.message);
  failed = failed || 1;
} finally {
  cleanup();
}
process.exit(failed ? 1 : 0);
