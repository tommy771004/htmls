// 作品 260 驗收：兩種尺寸開頁，走完「門禁 · 今夜」任務、開車、進出場館、車行買車試駕與車庫，檢查錯誤、外部請求與手機溢出
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
    check((await ev(page, () => window.__nc.player.veh.name)) === 'Kawasaki Ninja ZX-6R', '換騎路邊的 ZX-6R 機車');

    // 地圖
    await page.keyboard.press('KeyM');
    await page.waitForTimeout(200);
    check(await ev(page, () => document.getElementById('map').classList.contains('on')), 'M 開啟大地圖');
    await page.keyboard.press('Escape');

    // 車行與車庫：買車、試駕、停進車庫、開出庫、換色
    const nc = (fn, a) => ev(page, fn, a);
    const cash0 = await nc(() => window.__nc.motors.cash);
    check(cash0 >= 400000, `任務獎金入帳，現金 $${cash0.toLocaleString()}`);
    await nc((d) => window.__nc.tp(d.x, d.z + .4, Math.PI), s.dealerDoor);
    await page.waitForTimeout(200);
    check(/VELOCE/.test((await nc(() => window.__nc.ctx())) || ''), '車行門口出現進入提示');
    await page.keyboard.press('KeyE');
    await page.waitForTimeout(800);
    check((await nc(() => window.__nc.player.where)) === 'show', '進入 VELOCE MOTORS 展示廳');
    const r34 = s.showCars.find((c) => c.id === 'r34');
    await nc((c) => { const p = window.__nc.player; p.x = c.x; p.z = c.z - 2.9; }, r34);
    await page.waitForTimeout(200);
    check(/Skyline GT-R/.test((await nc(() => window.__nc.ctx())) || ''), '走到車旁出現看車提示');
    await shot(page, 'd-show');
    await page.keyboard.press('KeyE');
    await page.waitForTimeout(200);
    check(await nc(() => window.__nc.dialog.open), '看車對話框');
    await nc(() => window.__nc.pick(0));
    await nc(() => window.__nc.pick(0));
    await nc(() => window.__nc.pick(0));
    await page.waitForTimeout(900);
    const b = await nc(() => ({ mode: window.__nc.player.mode, name: window.__nc.player.veh && window.__nc.player.veh.name, cash: window.__nc.motors.cash, owned: window.__nc.motors.owned.slice(), where: window.__nc.player.where }));
    check(b.mode === 'drive' && b.name === 'Nissan Skyline GT-R (R34)' && b.where === 'out' && cash0 - b.cash === 135000 && b.owned.includes('r34'), `買下 R34 開出車行（${b.name}、扣款 $${(cash0 - b.cash).toLocaleString()}）`);
    await shot(page, 'd-bought');
    await nc(() => window.__nc.enter('show'));
    await nc(() => window.__nc.testDrive('f40'));
    await page.waitForTimeout(900);
    check((await nc(() => window.__nc.player.veh && window.__nc.player.veh.name)) === 'Ferrari F40' && (await nc(() => !!window.__nc.motors.test)), '試駕 Ferrari F40');
    await hold(page, 'KeyW', 800);
    await nc(() => window.__nc.walk());
    await page.waitForTimeout(200);
    check((await nc(() => window.__nc.vehicles[0].carId)) === 'r34' && !(await nc(() => window.__nc.motors.test)), '下車結束試駕，座駕換回 R34');
    await nc((sp) => { const nc = window.__nc, v = nc.vehicles[0]; v.x = sp.x; v.z = sp.z; v.yaw = sp.yaw; nc.drive(); }, s.homeSpot);
    await page.waitForTimeout(200);
    check(/停進車庫/.test((await nc(() => window.__nc.ctx())) || ''), '開到車庫門口出現停車提示');
    await page.keyboard.press('KeyE');
    await page.waitForTimeout(900);
    check((await nc(() => window.__nc.player.where)) === 'home' && (await nc(() => window.__nc.motors.stowed)), '停進 GARAGE 07');
    await nc(() => { const p = window.__nc.player; p.x = -3.4; p.z = 4.6; window.__nc.look(-Math.PI / 2 + .5, .2, 1); });
    await page.waitForTimeout(300);
    check(/AE86/.test((await nc(() => window.__nc.ctx())) || ''), '車庫裡 AE86 車格旁出現提示');
    await shot(page, 'd-garage');
    await nc(() => window.__nc.garageInfo('r34'));
    await nc(() => window.__nc.pick(0));
    await page.waitForTimeout(900);
    check((await nc(() => window.__nc.player.veh && window.__nc.player.veh.name)) === 'Nissan Skyline GT-R (R34)' && (await nc(() => window.__nc.player.where)) === 'out', '從車庫把 R34 開出去');
    await nc((g) => { const v = window.__nc.vehicles[0]; v.x = g.x; v.z = g.z; v.vx = v.vz = 0; }, s.garage);
    await page.waitForTimeout(100);
    const p0c = await nc(() => window.__nc.vehicles[0].paint);
    await page.keyboard.press('KeyE');
    await page.waitForTimeout(100);
    check((await nc(() => window.__nc.vehicles[0].paint)) !== p0c, 'CHROME WORKS 換色');
    const dr = await nc(() => {
      const nc = window.__nc, c0 = nc.motors.cash, car = { isCar: true, slip: 2.6 };
      for (let i = 0; i < 90; i++) nc.driftTick(1 / 60, car, 0, 80);
      car.slip = 0; for (let i = 0; i < 40; i++) nc.driftTick(1 / 60, car, 0, 80);
      const won = nc.motors.cash - c0;
      car.slip = 2.6; for (let i = 0; i < 90; i++) nc.driftTick(1 / 60, car, 0, 80);
      nc.driftTick(1 / 60, car, 9, 80); car.slip = 0; for (let i = 0; i < 40; i++) nc.driftTick(1 / 60, car, 0, 80);
      return { won, lost: nc.motors.cash - c0 - won };
    });
    check(dr.won > 0 && dr.lost === 0, `甩尾 1.5 秒打賞 $${dr.won}，撞車那段不算`);

    // GTA 式擴充第一階段：換武器、撬車、搶車、開槍與換彈、打到冒煙與爆炸、路人倒地與逃跑
    await nc(() => window.__nc.walk());
    await page.keyboard.press('Tab');
    check((await nc(() => window.__nc.gta.state.weapon)) === 'pistol', 'Tab 換成手槍');
    const pk = await nc(() => { const nc = window.__nc, c = nc.parked[0]; nc.tp(c.x + Math.cos(c.yaw) * 2.1, c.z - Math.sin(c.yaw) * 2.1, 0); return c.type; });
    await page.waitForTimeout(150);
    check(/撬車/.test((await nc(() => window.__nc.ctx())) || ''), `路邊車旁出現「撬車」（${pk}）`);
    await page.keyboard.press('KeyF');
    await page.waitForTimeout(2300);
    const j1 = await nc(() => ({ mode: window.__nc.player.mode, kind: window.__nc.player.veh && window.__nc.player.veh.kind, parts: window.__nc.gta.parts.length }));
    check(j1.mode === 'drive' && j1.kind === 'jack', `撬開路邊車開走 ${JSON.stringify(j1)}`);
    await nc(() => window.__nc.walk());
    const j2 = await nc(() => { const nc = window.__nc, c = nc.traffic.find(o => !o.turn) || nc.traffic[0]; c.v = 0; c.hit = 5; return nc.gta.jack(false); });
    await page.waitForTimeout(700);
    check((await nc(() => window.__nc.gta.extras.some(e => e.on))), `搶車流的車，駕駛被拖下車（${j2}）`);
    await page.waitForTimeout(900);
    check((await nc(() => window.__nc.player.mode)) === 'drive', '搶到車並坐進駕駛座');
    await nc(() => window.__nc.walk());
    await page.waitForTimeout(100);
    await nc(() => { window.__nc.gta.fire(); });
    const g1 = await nc(() => ({ mag: window.__nc.gta.state.mag, fx: window.__nc.gta.fxLights.length + window.__nc.gta.parts.length }));
    check(g1.mag === 11 && g1.fx > 0, `開一槍：彈匣 ${g1.mag}、粒子與閃光 ${g1.fx}`);
    await page.keyboard.press('KeyR');
    await page.waitForTimeout(1500);
    check((await nc(() => window.__nc.gta.state.mag)) === 12, '按 R 換彈匣');
    const boom = await nc(() => new Promise((r) => {
      const nc = window.__nc, v = nc.gta.jacked[0];
      nc.gta.damage(v, 600);
      setTimeout(() => { const smoke = nc.gta.parts.filter(p => p.kind === 'smoke').length; nc.gta.damage(v, 900); setTimeout(() => r({ smoke, dead: !!v.dead, burn: v.burn, dark: nc.gta.parts.filter(p => p.kind === 'dark').length }), 300); }, 800);
    }));
    check(boom.smoke > 0 && boom.dead && boom.burn === 1 && boom.dark > 0, `打到冒煙再爆炸 ${JSON.stringify(boom)}`);
    const ped = await nc(() => { const nc = window.__nc; nc.gta.knockPed(0, 1, 0); return { down: nc.pedState[0].down > 0, panic: nc.pedState.filter(p => p.panic > 0).length }; });
    check(ped.down, `路人中彈倒地，附近 ${ped.panic} 人逃跑`);
    await shot(page, 'd-gta');

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
    await ev(page, () => { window.__nc.enter('show'); window.__nc.player.z = 3; window.__nc.look(0, .2, 1); window.__nc.carInfo('p1'); });
    await page.waitForTimeout(500);
    await shot(page, 'm-show');
    check(await ev(page, () => document.documentElement.scrollWidth <= innerWidth && document.getElementById('dialog').getBoundingClientRect().right <= innerWidth), '車行看車對話框不溢出');
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
