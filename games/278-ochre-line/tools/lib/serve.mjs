// 工具共用：repo 根目錄靜態伺服器（隨機埠）與 chrome-headless-shell 啟動。絕不開系統 Chrome。
import http from 'node:http';
import { createReadStream, statSync, existsSync } from 'node:fs';
import { resolve, extname, dirname, join, normalize } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const here = dirname(fileURLToPath(import.meta.url));
export const GAME_DIR = resolve(here, '../..');
export const REPO_ROOT = resolve(GAME_DIR, '../..');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.glb': 'model/gltf-binary', '.webp': 'image/webp', '.hdr': 'application/octet-stream', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.wasm': 'application/wasm', '.mp3': 'audio/mpeg' };

// isolate：加 COOP／COEP 開跨來源隔離，performance.now() 解析度從 100 µs 變 5 µs。量每幀 CPU 要開，0.7 ms 的量用 100 µs 的尺會差 14%。
export function startServer(root = REPO_ROOT, extra = {}, { isolate = false } = {}) {
  const srv = http.createServer((req, res) => {
    const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const f = extra[p] ?? normalize(join(root, p));
    if ((!extra[p] && !f.startsWith(root)) || !existsSync(f) || !statSync(f).isFile()) { res.writeHead(404); res.end('nf'); return; }
    res.writeHead(200, { 'content-type': MIME[extname(f)] || 'application/octet-stream', 'cache-control': 'no-store', ...(isolate ? { 'cross-origin-opener-policy': 'same-origin', 'cross-origin-embedder-policy': 'require-corp' } : {}) });
    createReadStream(f).pipe(res);
  });
  srv.keepAliveTimeout = 500;
  return new Promise(ok => srv.listen(0, '127.0.0.1', () => ok({
    port: srv.address().port, url: `http://127.0.0.1:${srv.address().port}`,
    close: () => new Promise(r => { srv.closeAllConnections?.(); srv.close(() => r()); }),
  })));
}

const SP = '/private/tmp/claude-501/-Users-tommy-Documents-Proj-htmls/d07b21bf-cb2c-4065-ad56-ac08ea3e6e5a/scratchpad';
export const CHROME_PATH = process.env.CHROME_PATH || `${SP}/pw/chromium_headless_shell-1248/chrome-headless-shell-mac-arm64/chrome-headless-shell`;
const PWT = process.env.PW_MODULES || `${SP}/pwt/node_modules`;

export async function launch() {
  if (!/headless-shell/.test(CHROME_PATH)) throw new Error('只能用 chrome-headless-shell：' + CHROME_PATH);
  if (!existsSync(CHROME_PATH)) throw new Error('找不到 chrome-headless-shell：' + CHROME_PATH);
  const req = createRequire(pathToFileURL(`${PWT}/x.js`));
  const { chromium } = req('playwright-core');
  return chromium.launch({ executablePath: CHROME_PATH, headless: true, args: ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist', '--use-angle=metal'] });
}
