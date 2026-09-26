// 產生分步說明書 PDF：以 render.html 在無頭 Chrome 渲染每一步與每種零件，再排成 A4 橫式頁面輸出。
// 用法：PLAYWRIGHT=…/playwright-core/index.mjs CHROME=…/Google Chrome for Testing node instructions.mjs
// 需要先跑 mesh.mjs（../model-y.mesh.json）、verify.mjs（../verify-report.json）、bom.mjs（../bom.json）。
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const ASSET = path.join(HERE, '..');
const REPO = path.join(ASSET, '..', '..');
const BUILD = path.join(ASSET, 'build');               // 說明書中間檔（不提交）
const THUMBS = path.join(ASSET, 'parts');              // 零件縮圖（網頁也會用）
fs.mkdirSync(BUILD, { recursive: true }); fs.mkdirSync(THUMBS, { recursive: true });
const { chromium } = await import(process.env.PLAYWRIGHT || 'playwright-core');

const mesh = JSON.parse(fs.readFileSync(path.join(ASSET, 'model-y.mesh.json'), 'utf8'));
const report = JSON.parse(fs.readFileSync(path.join(ASSET, 'verify-report.json'), 'utf8'));
const bom = JSON.parse(fs.readFileSync(path.join(ASSET, 'bom.json'), 'utf8'));

// 以專案根目錄為根的靜態伺服器（render.html 用相對路徑載入 vendor 與模型）
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.css': 'text/css' };
const server = http.createServer((req, res) => {
  const p = path.join(REPO, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!p.startsWith(REPO) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
}).listen(0, '127.0.0.1');
await new Promise((r) => server.once('listening', r));
const BASE = `http://127.0.0.1:${server.address().port}/assets/model-y-bricks/`;

const browser = await chromium.launch({ executablePath: process.env.CHROME, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
page.on('pageerror', (e) => console.error('[render]', e.message));
async function shot(query, file, opts = {}) {
  await page.goto(BASE + 'src/render.html?' + query);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 120000 });
  await page.locator('canvas').screenshot({ path: file, omitBackground: !!opts.transparent, type: file.endsWith('.jpg') ? 'jpeg' : 'png', quality: file.endsWith('.jpg') ? 86 : undefined });
}

// 1. 每一步的組裝圖
const steps = mesh.steps;
for (let i = 0; i < steps.length; i++) {
  const view = steps[i].view === 'below' ? '&view=below' : '';
  await shot(`mode=step&n=${i}${view}&w=1500&h=860&dpr=2&bg=ffffff`, path.join(BUILD, `step-${i + 1}.jpg`));
  process.stdout.write(`step ${i + 1} `);
}
await shot(`mode=step&hl=0&az=32&el=18&w=1500&h=900&dpr=2&pad=1.02`, path.join(BUILD, 'hero.png'), { transparent: true });
await shot(`mode=step&hl=0&az=212&el=16&w=1000&h=600&dpr=2&pad=1.02`, path.join(BUILD, 'rear.png'), { transparent: true });
// 2. 每種零件＋顏色的縮圖：長邊依零件大小壓縮在 110–300 px（2 倍解析度）
for (const l of bom.lots) {
  const g = mesh.geo[l.ldraw];
  let mx = 0; for (const arr of Object.values(g.tris)) for (let i = 0; i < arr.length; i += 3) mx = Math.max(mx, Math.abs(arr[i]), Math.abs(arr[i + 2]));
  const px = Math.round(Math.min(300, Math.max(110, mx * 2.2)));
  await shot(`mode=part&f=${encodeURIComponent(l.ldraw)}&c=${l.color}&px=${px}&dpr=2&pad=1.06`, path.join(THUMBS, `${l.id}-${l.color}.png`), { transparent: true });
}
console.log('\nthumbs', bom.lots.length);

// 3. 排版
const lotOf = new Map(bom.lots.map((l) => [l.key, l]));
const partsByStep = steps.map(() => new Map());
for (const p of mesh.parts) {
  const id = bom.lots.find((l) => l.ldraw === p.f && l.color === p.c).key;
  const m = partsByStep[p.s]; m.set(id, (m.get(id) || 0) + 1);
}
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const thumb = (l) => `../parts/${l.id}-${l.color}.png`;
// 翻面記號：車身剖面加一道弧形箭頭（自繪）
const FLIP = `<svg class="flip" viewBox="0 0 120 84" aria-hidden="true"><path d="M18 58h84l-6-14H70l-10-12H40l-12 12H22z" fill="none" stroke="#1d1d1b" stroke-width="5" stroke-linejoin="round"/><circle cx="36" cy="62" r="7" fill="#1d1d1b"/><circle cx="84" cy="62" r="7" fill="#1d1d1b"/><path d="M26 22a40 26 0 0 1 68 0" fill="none" stroke="#e8590c" stroke-width="6" stroke-linecap="round"/><path d="M86 9l10 14-17 2" fill="none" stroke="#e8590c" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const S = report.summary;
const pages = [];
pages.push(`<section class="page cover">
  <div class="cover-text">
    <h1>Model Y</h1>
    <p class="sub">1:30 積木模型　${S.parts} 片　${S.steps} 步</p>
  </div>
  <img class="hero" src="hero.png" alt="">
  <p class="fine">非官方愛好者設計。參考 tesla.com/zh_tw/modely 的外觀比例，非 LEGO® 或 Tesla 官方產品；LEGO 為 LEGO Group 的商標。</p>
</section>`);
pages.push(`<section class="page intro">
  <div class="intro-grid">
    <div>
      <h2>開始之前</h2>
      <p>每一頁左上角的藍框是這一步要用的零件與數量；圖中橘色描邊的是這一步新加上的零件。出現翻面記號時，把車身翻過來，從底部往上裝。</p>
      <p>所有零件都是 LEGO 現行生產的零件與顏色，依 Rebrickable 2024 年以後的官方套組清單確認；每種零件至少出現在 2 個套組裡。</p>
      <div class="legend"><span class="legend-flip">${FLIP}</span><span>翻面：從車底往上裝</span></div>
    </div>
    <div>
      <h2>程式驗證結果</h2>
      <table class="facts">
        <tr><th>接點</th><td>${S.connections}</td><td>凸點 ${S.studConnections}、科技軸銷 ${S.technicConnections}</td></tr>
        <tr><th>碰撞</th><td>${S.collisions}</td><td>碰撞體已確認包住 LDraw 真實網格</td></tr>
        <tr><th>裝不上的零件</th><td>${S.buildFailures}</td><td>逐一檢查插入方向與整段路徑</td></tr>
        <tr><th>連通塊</th><td>${S.components}</td><td>整台車是一體</td></tr>
        <tr><th>重心餘裕</th><td>${(S.comMarginLDU * 0.4).toFixed(1)} mm</td><td>重心投影在四輪接地範圍內</td></tr>
        <tr><th>外露凸點</th><td>${S.exposedStuds}</td><td>車身外觀沒有露出的凸點</td></tr>
      </table>
    </div>
  </div>
  <img class="rear" src="rear.png" alt="">
</section>`);
steps.forEach((st, i) => {
  const items = [...partsByStep[i]].map(([k, q]) => { const l = lotOf.get(k); return `<figure><img src="${thumb(l)}" alt=""><figcaption>${q}x</figcaption></figure>`; }).join('');
  pages.push(`<section class="page step">
  <header><span class="num">${i + 1}</span><div class="callout">${items}</div>${st.view === 'below' ? `<div class="flipnote">${FLIP}</div>` : ''}</header>
  <img class="shot" src="step-${i + 1}.jpg" alt="">
  <footer><span>${esc(st.title)}</span><span class="pg">${pages.length + 1}</span></footer>
</section>`);
});
// 零件總表（每頁最多 24 格）
const inv = bom.lots.map((l) => `<figure><img src="${thumb(l)}" alt=""><figcaption><b>${l.qty}x</b><span>${esc(l.bl)}</span><span>${esc(l.colorZh)}　${esc(l.zh)}</span></figcaption></figure>`);
for (let i = 0; i < inv.length; i += 20) pages.push(`<section class="page inventory"><h2>${i === 0 ? '零件總表' : '零件總表（續）'}</h2><div class="inv">${inv.slice(i, i + 20).join('')}</div><footer><span>編號為 BrickLink 目錄編號</span><span class="pg">${pages.length + 1}</span></footer></section>`);

const css = `
@page { size: 297mm 210mm; margin: 0 }
* { box-sizing: border-box }
body { margin: 0; font-family: "Helvetica Neue", "PingFang TC", "Heiti TC", sans-serif; color: #1d1d1b; -webkit-print-color-adjust: exact }
.page { width: 297mm; height: 210mm; position: relative; overflow: hidden; page-break-after: always; background: #fff; padding: 12mm 14mm }
.cover { background: #fff; display: grid; grid-template-rows: auto minmax(0, 1fr) auto }
.cover h1 { font-size: 64pt; font-weight: 800; letter-spacing: -0.5pt; margin: 4mm 0 0 }
.cover .sub { font-size: 15pt; margin: 2mm 0 0; font-weight: 500 }
.cover .hero { width: 100%; height: 100%; min-height: 0; object-fit: contain; object-position: center }
.cover .fine, footer { font-size: 8pt; color: #6a6a66 }
.intro-grid { display: grid; grid-template-columns: 1fr 1.15fr; gap: 14mm }
.intro h2, .inventory h2 { font-size: 17pt; margin: 0 0 4mm; font-weight: 700 }
.intro p { font-size: 10.5pt; line-height: 1.75; margin: 0 0 3mm }
.legend { display: flex; align-items: center; gap: 4mm; font-size: 10pt; margin-top: 6mm }
.legend .flip { width: 22mm; height: auto }
.facts { border-collapse: collapse; width: 100%; font-size: 10pt }
.facts th { text-align: left; font-weight: 600; padding: 2.4mm 0; width: 30% }
.facts td { padding: 2.4mm 0; border-bottom: 0.3mm solid #d5e3ec }
.facts td:nth-child(2) { font-weight: 800; font-size: 14pt; width: 22% }
.facts th { border-bottom: 0.3mm solid #d5e3ec }
.intro .rear { position: absolute; right: 10mm; bottom: 6mm; width: 120mm }
.step header { display: flex; align-items: flex-start; gap: 6mm; height: 44mm }
.num { font-size: 58pt; font-weight: 800; line-height: .9; min-width: 22mm }
.callout { display: flex; align-items: flex-end; flex-wrap: wrap; gap: 3mm 5mm; background: #d9e8f1; border: 0.35mm solid #9dbdd0; border-radius: 3mm; padding: 3mm 5mm; max-width: 200mm }
.callout figure { margin: 0; text-align: center }
.callout img { height: auto; display: block; margin: 0 auto; zoom: 0.5 }
.callout figcaption { font-size: 12pt; font-weight: 700; margin-top: 1mm }
.flipnote .flip { width: 26mm }
.shot { position: absolute; left: 14mm; right: 14mm; bottom: 12mm; top: 50mm; width: calc(100% - 28mm); height: calc(100% - 62mm); object-fit: contain }
footer { position: absolute; left: 14mm; right: 14mm; bottom: 6mm; display: flex; justify-content: space-between }
.pg { font-size: 12pt; font-weight: 700; color: #1d1d1b }
.inv { display: grid; grid-template-columns: repeat(5, 1fr); gap: 3mm 6mm }
.inv figure { margin: 0; display: grid; grid-template-columns: 24mm 1fr; align-items: center; gap: 3mm; min-height: 27mm; border-bottom: 0.3mm solid #d5e3ec }
.inv img { max-width: 24mm; max-height: 22mm; justify-self: center }
.inv figcaption { display: grid; font-size: 8pt; line-height: 1.4 }
.inv b { font-size: 12pt }
`;
const html = `<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><title>Model Y 積木說明書</title><style>${css}</style><body>${pages.join('\n')}</body></html>`;
fs.writeFileSync(path.join(BUILD, 'booklet.html'), html);
await page.goto(BASE + 'build/booklet.html');
await page.waitForLoadState('networkidle');
await page.pdf({ path: path.join(ASSET, 'model-y-instructions.pdf'), width: '297mm', height: '210mm', printBackground: true, preferCSSPageSize: true });
console.log('pdf pages', pages.length, fs.statSync(path.join(ASSET, 'model-y-instructions.pdf')).size);
await browser.close(); server.close();
