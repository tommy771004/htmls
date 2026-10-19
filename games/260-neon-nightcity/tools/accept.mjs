// 作品 260 驗收：兩種尺寸開頁，走完「門禁 · 今夜」任務、開車、進出場館，檢查錯誤、外部請求與手機溢出
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';
import { open, raf } from './lib.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const htmlPath = resolve(root, '../../web/260-neon-nightcity.html');
const shotDir = process.env.SHOT_DIR ? resolve(process.env.SHOT_DIR) : null;
if (shotDir) mkdirSync(shotDir, { recursive: true });

let failed = 0;
function check(cond, msg) {
  console.log(`  ${cond ? '✓' : '✗'} ${msg}`);
  if (!cond) failed++;
}
const ev = (page, fn, arg) => page.evaluate(fn, arg);
const shot = async (page, name) => { if (shotDir) { await raf(page); await page.screenshot({ path: resolve(shotDir, name + '.png') }); } };
async function hold(page, key, ms) { await page.keyboard.down(key); await page.waitForTimeout(ms); await page.keyboard.up(key); }

async function desktop() {
  console.log('=== 1440×900 ===');
  const { browser, page, log } = await open(htmlPath, { w: 1440, h: 900 });
  try {
    const a = await ev(page, () => window.__nc.assets);
    check(a.loaded.length === 2 && a.missing.length === 0, `內嵌 GLB：${a.loaded.join('、')}（缺 ${a.missing.length}）`);
    await ev(page, () => window.__nc.start());
    await page.waitForTimeout(1200);
    await shot(page, 'd-start');

    // 走路
    const p0 = await ev(page, () => ({ x: window.__nc.player.x, z: window.__nc.player.z }));
    await hold(page, 'KeyW', 900);
    const p1 = await ev(page, () => ({ x: window.__nc.player.x, z: window.__nc.player.z }));
    check(Math.hypot(p1.x - p0.x, p1.z - p0.z) > 1, `按 W 走動 ${Math.hypot(p1.x - p0.x, p1.z - p0.z).toFixed(1)} m`);

    // 任務：Marlo → Juno → Marlo → 進門 → 跳舞
    const s = await ev(page, () => window.__nc.spots);
    await ev(page, (b) => window.__nc.tp(b.x + .3, b.z + 1.6, Math.PI), s.bouncer);
    await page.waitForTimeout(300);
    const club0 = await ev(page, (d) => { const nc = window.__nc; nc.player.x = d.x; nc.player.z = d.z; return nc.ctx(); }, s.clubDoor);
    check(/Marlo|門鎖/.test(club0 || ''), `放行前在門口：${club0}`);
    await ev(page, (b) => window.__nc.tp(b.x + .3, b.z + 1.6, Math.PI), s.bouncer);
    await page.waitForTimeout(200);
    check(/Marlo/.test((await ev(page, () => window.__nc.ctx())) || ''), 'Marlo 旁出現對話提示');
    await page.keyboard.press('KeyE');
    await page.waitForTimeout(200);
    check(await ev(page, () => window.__nc.dialog.open), '按 E 開啟對話');
    await shot(page, 'd-dialog');
    await page.keyboard.press('Digit2');
    await page.keyboard.press('Digit1');
    check((await ev(page, () => window.__nc.quest.n)) === 1, '選項推進到任務 1（找 Juno）');

    await ev(page, (d) => window.__nc.tp(d.x, d.z + 1, Math.PI), s.barDoor);
    await page.waitForTimeout(200);
    await page.keyboard.press('KeyE');
    await page.waitForTimeout(1600);
    check((await ev(page, () => window.__nc.player.where)) === 'bar', '進入 AFTERGLOW');
    await ev(page, (j) => { const p = window.__nc.player; p.x = j.x; p.z = j.z; }, s.juno);
    await page.waitForTimeout(200);
    await shot(page, 'd-bar');
    await page.keyboard.press('KeyE');
    await page.waitForTimeout(150);
    await page.keyboard.press('Digit1');
    await page.keyboard.press('Digit1');
    check((await ev(page, () => window.__nc.quest.n)) === 2, 'Juno 給火柴盒，任務 2');
    await ev(page, () => window.__nc.exit());
    await page.waitForTimeout(300);
    check((await ev(page, () => window.__nc.player.where)) === 'out', '回到街上');

    await ev(page, (b) => window.__nc.tp(b.x + .3, b.z + 1.6, Math.PI), s.bouncer);
    await page.waitForTimeout(200);
    await page.keyboard.press('KeyE');
    await page.waitForTimeout(150);
    await page.keyboard.press('Digit1');
    check((await ev(page, () => window.__nc.quest.n)) === 3, '出示火柴盒，絨布繩撤開（任務 3）');
    await ev(page, (d) => window.__nc.tp(d.x, d.z + .4, Math.PI), s.clubDoor);
    await page.waitForTimeout(200);
    await page.keyboard.press('KeyE');
    await page.waitForTimeout(1600);
    check((await ev(page, () => [window.__nc.player.where, window.__nc.quest.n].join())) === 'club,4', '走進 LAZARUS（任務 4）');
    await ev(page, (f) => { const p = window.__nc.player; p.x = f.x; p.z = f.z; }, s.floor);
    await page.waitForTimeout(200);
    await page.keyboard.press('KeyG');
    await page.waitForTimeout(5800);
    check((await ev(page, () => window.__nc.quest.n)) === 5, '舞池跳滿 5 秒，任務完成');
    await shot(page, 'd-club');
    const fpsClub = (await ev(page, () => window.__nc.getStats())).fps;

    // 開車
    await ev(page, () => window.__nc.drive());
    await page.waitForTimeout(300);
    const v0 = await ev(page, () => ({ x: window.__nc.player.veh.x, z: window.__nc.player.veh.z }));
    await hold(page, 'KeyW', 1500);
    const v1 = await ev(page, () => { const v = window.__nc.player.veh; return { x: v.x, z: v.z, s: Math.hypot(v.vx, v.vz) * 3.6 }; });
    check(Math.hypot(v1.x - v0.x, v1.z - v0.z) > 5, `油門 1.5 秒：移動 ${Math.hypot(v1.x - v0.x, v1.z - v0.z).toFixed(1)} m、${v1.s.toFixed(0)} km/h`);
    await shot(page, 'd-drive');
    await ev(page, () => window.__nc.drive('hanzo'));
    await page.waitForTimeout(300);
    check((await ev(page, () => window.__nc.player.veh.name)) === 'Hanzo', '換騎 Hanzo 機車');

    // 地圖
    await page.keyboard.press('KeyM');
    await page.waitForTimeout(200);
    check(await ev(page, () => document.getElementById('map').classList.contains('on')), 'M 開啟大地圖');
    await page.keyboard.press('Escape');

    const st = await ev(page, () => new Promise((r) => setTimeout(() => r(window.__nc.getStats()), 1500)));
    console.log(`  街道 ${st.fps} fps、${st.drawCalls} draw calls、${(st.triangles / 1e6).toFixed(2)} M 三角形；夜店 ${fpsClub} fps（GPU：${log.gpu}）`);
    check(!log.pageerrors.length && !log.errors.length, `無錯誤 ${[...log.pageerrors, ...log.errors].slice(0, 3).join(' | ')}`);
    check(!log.external.length, `無外部請求 ${log.external.slice(0, 3).join(' ')}`);
  } finally {
    await browser.close();
  }
}

async function mobile() {
  console.log('=== 390×844（觸控）===');
  const { browser, page, log } = await open(htmlPath, { w: 390, h: 844, touch: true });
  try {
    check(await ev(page, () => !!document.querySelector('meta[name=viewport]')), '有 viewport meta');
    await ev(page, () => window.__nc.start());
    await page.waitForTimeout(1200);
    check(await ev(page, () => document.getElementById('touch').classList.contains('on')), '觸控搖桿與按鈕顯示');
    await shot(page, 'm-start');
    await ev(page, () => window.__nc.talk.marlo());
    await page.waitForTimeout(200);
    check(await ev(page, () => getComputedStyle(document.getElementById('touch')).display === 'none'), '對話時隱藏觸控按鈕');
    await shot(page, 'm-dialog');
    await ev(page, () => window.__nc.closeDialog());
    await ev(page, () => window.__nc.drive());
    await page.waitForTimeout(500);
    await shot(page, 'm-drive');
    check(await ev(page, () => document.documentElement.scrollWidth <= innerWidth), '無水平溢出');
    check(!log.pageerrors.length && !log.errors.length, `無錯誤 ${[...log.pageerrors, ...log.errors].slice(0, 3).join(' | ')}`);
    check(!log.external.length, '無外部請求');
  } finally {
    await browser.close();
  }
}

await desktop();
await mobile();
console.log(failed ? `\n${failed} 項未通過` : '\n全部通過');
process.exit(failed ? 1 : 0);
