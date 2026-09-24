// 只提供建置好的單檔 HTML，給 Playwright 驗收用：
// node scripts/serve-built.mjs [port]
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const file = resolve(root, '../../web/131-wildling-trail.html');
const port = Number(process.argv[2] ?? 4318);

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  if (url.pathname === '/' || url.pathname === '/131-wildling-trail.html') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    res.end(await readFile(file));
    return;
  }
  res.writeHead(404).end();
}).listen(port, '127.0.0.1', () => console.log(`http://127.0.0.1:${port}/`));
