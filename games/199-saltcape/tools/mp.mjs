// 多人實測：同一個行程起靜態伺服器＋鹽岬 WebSocket，開兩個瀏覽器分頁走完「建房 → 分享房號加入 → 起飛 → 互射」。
// node tools/mp.mjs（截圖輸出到 dist/）
import { createJadeServer } from '../../../server/jade-table/server.mjs';
import { createSaltcape } from '../../../server/saltcape/server.mjs';
import { loadPlaywright, GPU_ARGS, raf } from './lib.mjs';

const salt = createSaltcape({ target: 12, log: (s) => console.log('  [伺服器]', s) });
const app = createJadeServer({ port: 0, onUpgrade: salt.handleUpgrade });
const addr = await app.listen();
const base = `http://127.0.0.1:${addr.port}/web/199-saltcape.html`;
const chromium = await loadPlaywright();
const browser = await chromium.launch({ headless: true, args: GPU_ARGS });
const errs = [];
async function page(name) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errs.push(`${name}: ${e.message}`));
  p.on('console', (m) => { if (m.type() === 'error') errs.push(`${name}: ${m.text()}`); });
  return p;
}
const ok = (c, msg) => { console.log(`${c ? '✓' : '✗'} ${msg}`); if (!c) process.exitCode = 1; };
try {
  const A = await page('A'), B = await page('B');
  await A.goto(base); await A.waitForFunction(() => window.__sc?.ready);
  await A.fill('#name', '房主阿鹽'); await A.click('#bCreate');
  await A.waitForFunction(() => document.querySelector('#roomCode').textContent.length === 5 && !document.querySelector('#roomView').classList.contains('hidden'));
  const code = await A.textContent('#roomCode');
  ok(/^[A-Z0-9]{5}$/.test(code), `建立好友房，房號 ${code}`);
  ok((await A.evaluate(() => location.search)).includes(code), '網址列已換成可分享的 ?room= 連結');
  // B 開分享網址
  await B.goto(`${base}?room=${code}`); await B.waitForFunction(() => window.__sc?.ready);
  ok((await B.inputValue('#code')) === code, '分享網址自動帶入房號');
  await B.fill('#name', '朋友小岬'); await B.click('#bJoin');
  await B.waitForFunction(() => document.querySelectorAll('#roster li').length === 2);
  await A.waitForFunction(() => document.querySelectorAll('#roster li').length === 2);
  ok(true, '兩人都在乘客名單上');
  ok(await B.isDisabled('#bLaunch'), '非機長不能按起飛');
  await A.click('#bLaunch');
  await Promise.all([A.waitForFunction(() => window.__sc.G.match, null, { timeout: 10000 }), B.waitForFunction(() => window.__sc.G.match, null, { timeout: 10000 })]);
  ok(true, '機長起飛，兩邊同時開局');
  const n = await A.evaluate(() => window.__sc.G.match.players.size);
  ok(n === 12, `AI 補滿到 ${n} 人`);
  await A.waitForTimeout(3500);
  await A.keyboard.down('Space'); await A.waitForTimeout(150); await A.keyboard.up('Space');
  await A.waitForFunction(() => window.__sc.G.me.mode === 1 || window.__sc.G.me.mode === 2, null, { timeout: 5000 });
  ok(true, 'A 按空白鍵跳出運輸機（伺服器確認）');
  // 伺服器端把兩人放到老街同一條街上，面對面相距 12 公尺
  const room = [...salt.rooms.values()][0], M = room.match;
  const ids = [...room.members.values()].map((m) => m.id);
  const pa = M.byId.get(ids[0]), pb = M.byId.get(ids[1]);
  for (const [p, z] of [[pa, 14], [pb, 2]]) { Object.assign(p, { mode: 3, x: -60, z, y: 25.75, vx: 0, vy: 0, vz: 0, og: 1 }); p.slots[1] = ['ar', 1, 30]; p.cur = 1; p.ammo.h = 90; }
  // 其他 AI 移遠，避免干擾
  for (const p of M.players) if (p.bot) Object.assign(p, { mode: 3, x: 600 + Math.random() * 50, z: -100, y: 30 });
  await A.waitForTimeout(1200);
  const seen = await A.evaluate((id) => { const o = window.__sc.G.others.get(id); return o ? o.s.root.position.toArray().map((v) => +v.toFixed(1)) : null; }, ids[1]);
  ok(seen && Math.abs(seen[2] - 2) < 0.5, `A 看到 B 在 ${JSON.stringify(seen)}`);
  await A.evaluate(() => window.__sc.look(0, 0));            // 面向北（-z）= B 的方向
  await B.evaluate(() => window.__sc.look(Math.PI, 0));
  await A.waitForTimeout(400);
  const hp0 = pb.hp + pb.ar;
  await A.mouse.move(640, 400); await A.mouse.down(); await A.waitForTimeout(700); await A.mouse.up();
  await A.waitForTimeout(500);
  ok(pb.hp + pb.ar < hp0, `A 射擊命中 B：生命＋護甲 ${hp0} → ${(pb.hp + pb.ar).toFixed(0)}`);
  const bHud = await B.evaluate(() => +document.querySelector('#hpNum').textContent);
  ok(bHud <= pb.hp + 1, `B 的 HUD 顯示生命 ${bHud}`);
  await A.screenshot({ path: 'dist/mp-A.png' });
  await raf(B); await B.screenshot({ path: 'dist/mp-B.png' });
  // 擊殺 B
  // 點放：每次重新瞄準
  for (let k = 0; k < 14 && pb.mode !== 4; k++) {
    await A.evaluate(() => window.__sc.look(0, -0.02));
    await A.mouse.down(); await A.waitForTimeout(260); await A.mouse.up(); await A.waitForTimeout(250);
    if (pa.slots[pa.cur][2] === 0) { await A.keyboard.press('KeyR'); await A.waitForTimeout(2500); }
  }
  await A.waitForTimeout(600);
  ok(pb.mode === 4, `B 被淘汰（第 ${pb.place} 名），A 擊殺 ${pa.kills}`);
  const dead = await B.evaluate(() => !document.querySelector('#deadBox').classList.contains('hidden') && document.querySelector('#deadBox').textContent);
  ok(!!dead, `B 看到淘汰畫面：${String(dead).slice(0, 40)}`);
  await raf(B); await B.screenshot({ path: 'dist/mp-B-dead.png' });
  const feed = await A.evaluate(() => document.querySelector('#feed').textContent);
  ok(feed.includes('朋友小岬'), `擊殺紀錄：${feed.slice(0, 40)}`);
  // 換線接手：B 頁面主動換線，不應掉出對局
  await B.evaluate(() => window.__sc.G.net.handoff());
  await B.waitForTimeout(800);
  ok(await B.evaluate(() => !!window.__sc.G.match && window.__sc.G.net.ws.readyState === 1), 'B 換線接手後仍在對局中');
  // 結束：只留 A 與一個 AI，殺掉 AI 讓 A 獲勝
  for (const p of M.players) if (p !== pa && p.mode !== 4) M.kill(p, pa, 'ar', false, 10);
  await A.waitForFunction(() => !document.querySelector('#result').classList.contains('hidden'), null, { timeout: 8000 });
  const res = await A.textContent('#result');
  ok(res.includes('#1') && res.includes('最後的生還者'), '勝利畫面：#1 鹽岬最後的生還者');
  await A.screenshot({ path: 'dist/mp-A-win.png' });
} finally {
  console.log(errs.length ? `頁面錯誤：\n${errs.join('\n')}` : '頁面沒有錯誤');
  if (errs.length) process.exitCode = 1;
  await browser.close(); salt.close(); await app.close();
}
