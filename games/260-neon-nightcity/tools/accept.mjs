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
    // World 第四輪之二（27-props.js 檔尾）：以檔案開啟不下載街道設施、植物與海岸的模型，程式建模全部留著
    const w2 = await ev(page, () => { const w = window.__nc.props.w2; return w && { on: w.on, sets: Object.keys(w.sets).length, failed: w.failed.length, kept: w.kept() }; });
    check(w2 && !w2.on && !w2.sets && !w2.failed && w2.kept >= 16, `以檔案開啟不換 world_2 模型、程式建模都在 ${JSON.stringify(w2)}`);

    // 走路
    const p0 = await ev(page, () => ({ x: window.__nc.player.x, z: window.__nc.player.z }));
    await hold(page, 'KeyW', 900);
    const p1 = await ev(page, () => ({ x: window.__nc.player.x, z: window.__nc.player.z }));
    check(Math.hypot(p1.x - p0.x, p1.z - p0.z) > 1, `按 W 走動 ${Math.hypot(p1.x - p0.x, p1.z - p0.z).toFixed(1)} m`);

    // 任務：Marlo → Juno → Marlo → 進門 → 跳舞
    const s = await ev(page, () => window.__nc.spots);
    await ev(page, (b) => window.__nc.tpL(b.x + .3, b.z + 1.6, Math.PI), s.bouncer);
    await page.waitForTimeout(300);
    const club0 = await ev(page, (d) => { const nc = window.__nc; [nc.player.x, nc.player.z] = nc.W(d.x, d.z); return nc.ctx(); }, s.clubDoor);
    check(/Marlo|門鎖/.test(club0 || ''), `放行前在門口：${club0}`);
    await ev(page, (b) => window.__nc.tpL(b.x + .3, b.z + 1.6, Math.PI), s.bouncer);
    await page.waitForTimeout(200);
    check(/Marlo/.test((await ev(page, () => window.__nc.ctx())) || ''), 'Marlo 旁出現對話提示');
    await page.keyboard.press('KeyE');
    await page.waitForTimeout(200);
    check(await ev(page, () => window.__nc.dialog.open), '按 E 開啟對話');
    await shot(page, 'd-dialog');
    await page.keyboard.press('Digit2');
    await page.keyboard.press('Digit1');
    check((await ev(page, () => window.__nc.quest.n)) === 1, '選項推進到任務 1（找 Juno）');

    await ev(page, (d) => window.__nc.tpL(d.x, d.z + 1, Math.PI), s.barDoor);
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

    await ev(page, (b) => window.__nc.tpL(b.x + .3, b.z + 1.6, Math.PI), s.bouncer);
    await page.waitForTimeout(200);
    await page.keyboard.press('KeyE');
    await page.waitForTimeout(150);
    await page.keyboard.press('Digit1');
    check((await ev(page, () => window.__nc.quest.n)) === 3, '出示火柴盒，絨布繩撤開（任務 3）');
    await ev(page, (d) => window.__nc.tpL(d.x, d.z + .4, Math.PI), s.clubDoor);
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
    {
      const m0 = await ev(page, () => ({ n: window.__nc.map.blips().length, leg: document.querySelectorAll('#mapLegend button').length, wp: !!window.__nc.gta.gps.gps.wp }));
      check(m0.n > 20 && m0.leg >= 10, `大地圖有 ${m0.n} 個地點、圖例 ${m0.leg} 類`);
      await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter'); await page.waitForTimeout(150);
      const m1 = await ev(page, () => ({ card: document.getElementById('mapCard').classList.contains('on'), wp: !!window.__nc.gta.gps.gps.wp }));
      check(m1.card && m1.wp !== m0.wp, '大地圖：↓ 選地點、Enter 切換導航點');
      if (m1.wp) await page.keyboard.press('Enter');
      const z0 = await ev(page, () => window.__nc.map.MV.tzoom);
      await page.mouse.wheel(0, -300); await page.waitForTimeout(300);
      check(await ev(page, (z) => window.__nc.map.MV.tzoom > z * 1.2, z0), '大地圖：滾輪放大');
    }
    await page.keyboard.press('Escape');

    // 車行與車庫：買車、試駕、停進車庫、開出庫、換色
    const nc = (fn, a) => ev(page, fn, a);
    const cash0 = await nc(() => window.__nc.motors.cash);
    check(cash0 >= 400000, `任務獎金入帳，現金 $${cash0.toLocaleString()}`);
    await nc((d) => window.__nc.tpL(d.x, d.z + .4, Math.PI), s.dealerDoor);
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
    await nc((g) => { const v = window.__nc.vehicles[0]; [v.x, v.z] = window.__nc.W(g.x, g.z); v.vx = v.vz = 0; }, s.garage);
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
    // 第二階段：按住 Tab 開武器轉盤（子彈時間），往右上移到「手槍」格放開
    await page.keyboard.down('Tab');
    await page.waitForTimeout(400);
    const wh = await nc(() => { const g = window.__nc.gta; g.wheelMove(70, -70); return { open: g.arm.wheel.open, slot: g.arm.wheel.slot, k: g.slowmo.k, svg: document.querySelectorAll('#wheel .sec').length }; });
    await page.keyboard.up('Tab');
    check(wh.open && wh.slot === 1 && wh.k < .6 && wh.svg === 8, `武器轉盤八格、子彈時間 ×${wh.k.toFixed(2)}、選到手槍格`);
    check((await nc(() => window.__nc.gta.state.weapon)) === 'pistol', '放開 Tab 換成手槍');
    const pk = await nc(() => { const nc = window.__nc, c = nc.parked[0]; nc.tp(c.x + Math.cos(c.yaw) * 2.1, c.z - Math.sin(c.yaw) * 2.1, 0); return c.type; });
    await page.waitForTimeout(150);
    check(/撬車/.test((await nc(() => window.__nc.ctx())) || ''), `路邊車旁出現「撬車」（${pk}）`);
    await page.keyboard.press('KeyF');
    for (let i = 0; i < 16 && (await nc(() => window.__nc.player.mode)) !== 'drive'; i++) await page.waitForTimeout(250);   // 撬車 1.9 秒（遊戲時間），剛放開子彈時間會慢一點
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
    const g1 = await nc(() => ({ mag: window.__nc.gta.arm.ammo.pistol.mag, fx: window.__nc.gta.fxLights.length + window.__nc.gta.parts.length }));
    check(g1.mag === 15 && g1.fx > 0, `開一槍：彈匣 ${g1.mag}、粒子與閃光 ${g1.fx}`);
    await page.keyboard.press('KeyR');
    await page.waitForTimeout(1500);
    check((await nc(() => window.__nc.gta.arm.ammo.pistol.mag)) === 16, '按 R 換彈匣');
    const boom = await nc(() => new Promise((r) => {
      const nc = window.__nc, v = nc.gta.jacked[0];
      nc.gta.damage(v, 600);
      setTimeout(() => { const smoke = nc.gta.parts.filter(p => p.kind === 'smoke').length; nc.gta.damage(v, 900); setTimeout(() => r({ smoke, dead: !!v.dead, burn: v.burn, dark: nc.gta.parts.filter(p => p.kind === 'dark').length }), 300); }, 800);
    }));
    check(boom.smoke > 0 && boom.dead && boom.burn === 1 && boom.dark > 0, `打到冒煙再爆炸 ${JSON.stringify(boom)}`);
    const ped = await nc(() => { const nc = window.__nc; nc.gta.knockPed(0, 1, 0); return { down: nc.pedState[0].down > 0, panic: nc.pedState.filter(p => p.panic > 0).length }; });
    check(ped.down, `路人中彈倒地，附近 ${ped.panic} 人逃跑`);
    // 電擊槍：倒地抽搐、原地爬起來逃跑（不瞬移）；車內射擊：汽車上可用手槍，霰彈槍只有機車
    const st0 = await nc(() => { const nc = window.__nc, g = nc.gta, p = nc.peds.people[1]; g.stunPed(1, .8, 1, 0); return { x: p.x, z: p.z, down: nc.pedState[1].down > 0, stun: nc.pedState[1].stun }; });
    await page.waitForTimeout(1600);
    const st1 = await nc(() => { const nc = window.__nc, p = nc.peds.people[1], s = nc.pedState[1]; return { x: p.x, z: p.z, down: s.down > 0, panic: s.panic > 0 }; });
    check(st0.down && st0.stun && !st1.down && st1.panic && Math.hypot(st1.x - st0.x, st1.z - st0.z) < 6, `電擊槍：路人倒地後原地爬起逃跑 ${JSON.stringify({ moved: +Math.hypot(st1.x - st0.x, st1.z - st0.z).toFixed(1), panic: st1.panic })}`);
    const db = await nc(() => { const nc = window.__nc, g = nc.gta; nc.drive(); g.wanted.clear('reset'); g.fill(); g.equip('pistol', true); g.state.fireT = g.state.reloadT = 0; g.fire(); return { mode: nc.player.mode, mag: g.arm.ammo.pistol.mag, sg: g.canDriveBy('shotgun'), rf: g.canDriveBy('rifle') }; });
    check(db.mode === 'drive' && db.mag === 15 && !db.sg && !db.rf, `車內射擊：手槍可開火、霰彈槍與步槍不行 ${JSON.stringify(db)}`);
    await nc(() => { const g = window.__nc.gta; g.wanted.clear('reset'); window.__nc.walk(); });
    await shot(page, 'd-gta');

    // 第二階段：火箭與爆炸、生命與護甲、通緝星級（警車調度、下車逮捕）、BUSTED／WASTED 重生、脫離視線消星、直升機與路障
    const rk = await nc(() => new Promise((r) => {
      const g = window.__nc.gta, p = window.__nc.player;
      g.wanted.clear('reset'); g.fill(); g.equip('rpg', true);
      const n0 = g.parts.length;
      g.launch('rocket', p.x, 1.6, p.z + 13, 0, -30, 8, 'npc');
      setTimeout(() => r({ fx: g.parts.length - n0, proj: g.proj.length, hp: Math.round(g.life.hp), ar: Math.round(g.life.armor) }), 900);
    }));
    check(rk.fx > 40 && rk.proj === 0, `火箭命中爆炸：粒子 +${rk.fx}`);
    const hp = await nc(() => { const g = window.__nc.gta; g.fill(); g.hurt(60); return { hp: Math.round(g.life.hp), ar: Math.round(g.life.armor), bar: getComputedStyle(document.getElementById('hpBar').firstElementChild).width }; });
    check(hp.ar === 60 && hp.hp === 80, `受傷先扣護甲：生命 ${hp.hp}、護甲 ${hp.ar}`);
    await nc(() => { const g = window.__nc.gta; g.fill(); g.equip('fist', true); g.wanted.set(1); });
    let bust = null;
    for (let i = 0; i < 70 && !bust; i++) { await page.waitForTimeout(500); bust = await nc(() => window.__nc.gta.life.dead); }
    const w1 = await nc(() => ({ stars: document.querySelectorAll('#wanted svg.lit').length, units: window.__nc.gta.wanted.W.units.length }));
    check(bust === 'busted', `1 星：警車沿路網趕到、警員下車逮捕 → ${bust}（${w1.units} 台警車）`);
    await shot(page, 'd-busted');
    await page.waitForTimeout(5200);
    // 離開的警車要開到 90 m 外、下車的警員也回到車上才消失：最多再等 10 秒
    let rs;
    for (let i = 0; i < 21; i++) {
      rs = await nc(() => { const nc = window.__nc, g = nc.gta, W = g.wanted.W; return { dead: g.life.dead, stars: W.stars, d: Math.round(Math.hypot(nc.player.x - g.pd.x, nc.player.z - g.pd.z)), units: W.units.length,
        u: W.units.map(u => ({ st: u.state, d: Math.round(Math.hypot(u.v.x - nc.player.x, u.v.z - nc.player.z)), out: u.out, stuck: +u.stuck.toFixed(1), cops: W.cops.filter(c => c.unit === u && c.on).map(c => c.state) })) }; });
      if (!rs.units) break;
      await page.waitForTimeout(500);
    }
    check(!rs.dead && rs.stars === 0 && rs.d < 3 && rs.units === 0, `BUSTED 後在警察局門口重生、通緝清除 ${JSON.stringify(rs)}`);
    await nc(() => window.__nc.gta.hurt(999));
    await page.waitForTimeout(1500);
    const wd = await nc(() => ({ dead: window.__nc.gta.life.dead, gray: window.__nc.post.gray, k: window.__nc.gta.slowmo.k, text: document.getElementById('deathW').textContent }));
    check(wd.dead === 'wasted' && wd.gray > .9 && wd.k < .5 && wd.text === 'WASTED', `WASTED：灰階 ${wd.gray.toFixed(2)}、慢動作 ×${wd.k.toFixed(2)}`);
    await shot(page, 'd-wasted');
    await page.waitForTimeout(4500);
    const rh = await nc(() => { const nc = window.__nc, g = nc.gta; return { dead: g.life.dead, hp: g.life.hp, d: Math.round(Math.hypot(nc.player.x - g.hosp.x, nc.player.z - g.hosp.z)) }; });
    check(!rh.dead && rh.hp === 100 && rh.d < 3, `WASTED 後在醫院門口重生 ${JSON.stringify(rh)}`);
    const ev1 = await nc(() => new Promise((r) => {
      const g = window.__nc.gta, W = g.wanted.W;
      g.wanted.set(1); W.spawnT = 99; W.seen = false; W.visT = 99; W.evade = 14.2;   // 留 .8 秒遊戲時間：慢一點的機器 1.2 秒真實時間跑不滿 1.2 秒
      setTimeout(() => { const cool = document.getElementById('wanted').classList.contains('cool'); W.visT = 99; setTimeout(() => r({ cool, stars: W.stars }), 900); }, 300);
    }));
    check(ev1.cool && ev1.stars === 0, `脫離視線星星閃爍，15 秒後消星 ${JSON.stringify(ev1)}`);
    const h3 = await nc(() => new Promise((r) => {
      const nc = window.__nc, g = nc.gta; g.god.on = true;
      nc.drive(); g.wanted.set(3);
      setTimeout(() => { const b = g.wanted.roadblock(); r({ heli: !!g.wanted.W.heli, block: !!b && b.spikes.length === 2 && b.units.length === 2 }); }, 1500);
    }));
    check(h3.heli && h3.block, `3 星：直升機出動、前方路口擺路障與釘刺帶 ${JSON.stringify(h3)}`);
    await page.waitForTimeout(6000);
    await shot(page, 'd-heli');
    await nc(() => { const g = window.__nc.gta; g.wanted.clear('reset'); g.god.on = false; g.fill(); window.__nc.walk(); });

    // 第三階段：切換到 Jax（高空鏡頭約 2.7 秒）→ 狂暴減傷與鎖血；切到 Vance → 子彈時間
    const ab = await nc(() => new Promise((r) => {
      const nc = window.__nc, g = nc.gta, c = g.crew;
      c.sw(2);
      const until = (f, fn) => { const id = setInterval(() => { if (f()) { clearInterval(id); fn(); } }, 100); };
      until(() => !c.crew.sw, () => {
        const max = g.life.max, cur = c.crew.cur; c.sp(100); c.on();
        const hp0 = g.life.hp, ar0 = g.life.armor; g.hurt(100); const took = hp0 + ar0 - g.life.hp - g.life.armor;
        g.hurt(999); const alive = !g.life.dead && g.life.hp >= 1;
        setTimeout(() => { const tint = nc.post.tint.w; c.off(); g.fill(); r({ cur, max, took: Math.round(took), alive, tint: +tint.toFixed(2) }); }, 400);
      });
    }));
    check(ab.cur === 2 && ab.max === 120 && ab.took <= 16 && ab.alive && ab.tint > .3, `切換到 Jax、狂暴受傷 ×0.15 並鎖血、畫面轉橘紅 ${JSON.stringify(ab)}`);
    const bt = await nc(() => new Promise((r) => {
      const g = window.__nc.gta, c = g.crew;
      c.sw(0);
      const until = (f, fn) => { const id = setInterval(() => { if (f()) { clearInterval(id); fn(); } }, 100); };
      until(() => !c.crew.sw, () => { c.sp(100); c.on(); setTimeout(() => { const k = g.slowmo.k, sp = c.crew.st[0].sp, spread = c.abil.spread; c.off(); r({ cur: c.crew.cur, k: +k.toFixed(2), sp: Math.round(sp), spread }); }, 800); });
    }));
    check(bt.cur === 0 && bt.k < .5 && bt.sp < 100 && bt.sp > 80, `切換到 Vance、子彈時間 ×0.4、能力條每秒耗 12.5 ${JSON.stringify(bt)}`);
    await shot(page, 'd-vance');
    await nc(() => new Promise((r) => { const c = window.__nc.gta.crew; c.sw(1); const id = setInterval(() => { if (!c.crew.sw) { clearInterval(id); r(); } }, 100); }));

    // 手機：P 滑出、Zero 消星（$500 × 星數²）、雷達隱形時路人不報案、空投彈藥箱、快速存檔與讀檔
    await page.keyboard.press('KeyP');
    await page.waitForTimeout(400);
    const ph = await nc(() => { const r = document.getElementById('phone').getBoundingClientRect(); return { open: window.__nc.gta.phone.phone.open, b: Math.round(r.bottom), h: innerHeight, w: Math.round(r.width), rows: document.querySelectorAll('#phScr li').length }; });
    check(ph.open && ph.b <= ph.h && ph.w === 280 && ph.rows === 5, `按 P 滑出手機 ${JSON.stringify(ph)}`);
    await shot(page, 'd-phone');
    const zw = await nc(() => { const nc = window.__nc, g = nc.gta, p = g.phone; nc.motors.cash = 100000; g.wanted.set(2); p.pick(0); p.pick(0); const c0 = nc.motors.cash; p.pick(0); return { cost: 100000 - nc.motors.cash, stars: g.wanted.W.stars, cd: Math.round(p.phone.cd.wipe), c0 }; });
    check(zw.cost === 2000 && zw.stars === 0 && zw.cd === 180, `Zero 消除 2 星通緝 ${JSON.stringify(zw)}`);
    const gh = await nc(() => { const nc = window.__nc, g = nc.gta, p = g.phone; p.pick(1); const n0 = g.wanted.W.reports.length; window.__nc.gta.wanted.crime('kill'); return { ghost: Math.round(p.phone.ghostT), reports: g.wanted.W.reports.length - n0, stars: g.wanted.W.stars }; });
    check(gh.ghost === 60 && gh.reports === 0, `雷達隱形 60 秒：犯罪沒有路人報案 ${JSON.stringify(gh)}`);
    const air = await nc(() => new Promise((r) => {
      const nc = window.__nc, g = nc.gta, p = g.phone, c0 = nc.motors.cash;
      p.back(); p.pick(2); p.pick(0);
      const c = p.phone.crates[0]; g.arm.ammo.rifle.res = 0; g.life.armor = 0;
      c.y = 0; nc.player.x = c.x; nc.player.z = c.z;
      setTimeout(() => r({ cost: c0 - nc.motors.cash, left: p.phone.crates.length, rifle: g.arm.ammo.rifle.res, armor: g.life.armor }), 400);
    }));
    check(air.cost === 1200 && air.left === 0 && air.rifle === 240 && air.armor === 100, `鐵幕保全空投彈藥箱，撿起來全部補滿 ${JSON.stringify(air)}`);
    const qs = await nc(() => new Promise((r) => {
      const nc = window.__nc, g = nc.gta, p = g.phone;
      p.phone.ghostT = 0; g.wanted.clear('reset');
      p.save(); const saved = JSON.parse(localStorage.getItem('nc260.motors')); const x0 = nc.player.x;
      g.arm.ammo.pistol.res = 3; nc.player.x += 20;
      p.load();
      setTimeout(() => r({ v: saved.v, game: !!saved.game, pistol: g.arm.ammo.pistol.res, dx: +Math.abs(nc.player.x - x0).toFixed(2), open: p.phone.open }), 1600);
    }));
    check(qs.v >= 2 && qs.game && qs.pistol === 96 && qs.dx < .5 && !qs.open, `快速存檔寫進同一個存檔、讀檔還原彈藥與位置 ${JSON.stringify(qs)}`);
    // 開著車存檔：讀檔後回到同一台車上（存檔第 4 版起帶時間戳，第 5 版的位置是世界座標）
    const qv = await nc(() => new Promise((r) => {
      const nc = window.__nc, p = nc.gta.phone;
      nc.drive(); const v0 = nc.player.veh, ok = p.save(), saved = JSON.parse(localStorage.getItem('nc260.motors'));
      nc.walk(); nc.player.x += 25;
      p.load();
      setTimeout(() => r({ ok, v: saved.v, ts: saved.ts > 0, veh: saved.game.veh, mode: nc.player.mode, same: nc.player.veh === v0 }), 1600);
    }));
    check(qv.ok && qv.v === 5 && qv.ts && qv.veh && qv.veh.k === 'own' && qv.mode === 'drive' && qv.same, `開車時快速存檔，讀檔回到座駕上 ${JSON.stringify(qv)}`);
    await nc(() => window.__nc.walk());

    // 第四階段：特技跳台（時速 60 以上衝出去：慢動作、側面機位、首次加倍獎金）
    await nc(() => { window.__nc.gta.god.on = true; });
    const sj = await nc(() => new Promise((r) => {
      const nc = window.__nc, s = nc.gta.stunt, rp = s.RAMPS[0];
      nc.drive(); const v = nc.player.veh, c0 = nc.motors.cash;
      v.x = rp.x - rp.dx * 16; v.z = rp.z - rp.dz * 16; v.yaw = Math.atan2(rp.dx, rp.dz); v.vx = rp.dx * 26; v.vz = rp.dz * 26;
      let cam = false, air = 0;
      const id = setInterval(() => { cam ||= !!s.stunt.cam; air = Math.max(air, v.y); }, 50);
      setTimeout(() => { clearInterval(id); r({ cam, air: +air.toFixed(1), landed: !v.air, done: nc.motors.stunts.includes(rp.i), got: nc.motors.cash - c0 }); }, 6000);
    }));
    check(sj.cam && sj.air > 2 && sj.landed && sj.done && sj.got > 1000, `特技跳台：慢動作機位、落地領首次加倍獎金 ${JSON.stringify(sj)}`);
    await shot(page, 'd-stunt');
    // 空中操控：按住右轉向翻滾一圈再放開，落地算「翻滾 ×1」加成；20 座跳台的助跑道與落地區沒被擋住
    await nc(() => {
      const nc = window.__nc, rp = nc.gta.stunt.RAMPS[1];
      nc.drive(); const v = nc.player.veh; window.__c0 = nc.motors.cash;
      v.x = rp.x - rp.dx * 16; v.z = rp.z - rp.dz * 16; v.yaw = Math.atan2(rp.dx, rp.dz); v.vx = rp.dx * 30; v.vz = rp.dz * 30;
    });
    for (let k = 0; k < 100 && !(await nc(() => !!window.__nc.player.veh.air)); k++) await page.waitForTimeout(40);
    await page.keyboard.down('KeyD');
    for (let k = 0; k < 200; k++) { const q = await nc(() => { const v = window.__nc.player.veh; return { air: !!v.air, a: Math.abs(v.roll) }; }); if (!q.air || q.a > 5.6) break; await page.waitForTimeout(20); }
    await page.keyboard.up('KeyD');
    await page.waitForTimeout(5000);
    const sr = await nc(() => ({ got: window.__nc.motors.cash - window.__c0, toast: document.getElementById('toast').textContent }));
    const sp = await nc(() => window.__nc.gta.stunt.probe().filter((r) => r.bad.some((a) => a > -32)));
    check(sr.got > 0 && /翻滾 ×1/.test(sr.toast) && !sp.length && (await nc(() => window.__nc.gta.stunt.RAMPS.length)) === 20, `空中翻滾一圈落地拿加成、20 座跳台路線淨空 ${JSON.stringify({ ...sr, blocked: sp })}`);
    // 運鈔車：Zero 標記叫出來、炸後車門掉三袋現金（3 星）、IVLT 下跌 SNTL 上漲
    const tr = await nc(() => new Promise((r) => {
      const nc = window.__nc, g = nc.gta, e = g.ev, px0 = { ...nc.motors.stk.px };
      nc.walk(); g.wanted.clear('reset');
      if (!e.spawn('zero')) return r({ spawn: false });
      const name = e.ev.truck.v.name;
      e.open();
      const bags = e.ev.bags.map(b => ({ x: b.x, z: b.z, amt: b.amt })), stars = g.wanted.W.stars, c0 = nc.motors.cash;
      g.wanted.clear('reset');
      let k = 0;
      const id = setInterval(() => {
        if (k < bags.length) { nc.player.x = bags[k].x; nc.player.z = bags[k].z; k++; return; }
        clearInterval(id);
        r({ name, n: bags.length, stars, got: nc.motors.cash - c0, sum: bags.reduce((a, b) => a + b.amt, 0), left: e.ev.bags.length, ivlt: nc.motors.stk.px.IVLT < px0.IVLT, sntl: nc.motors.stk.px.SNTL > px0.SNTL });
      }, 250);
    }));
    check(tr.n === 3 && tr.stars === 3 && tr.got === tr.sum && tr.got > 0 && !tr.left && tr.ivlt && tr.sntl, `運鈔車：炸開掉三袋現金、立刻 3 星、IVLT 跌 SNTL 漲 ${JSON.stringify(tr)}`);
    // 搶運鈔車後幫派開兩台車追殺過來（每台三人）
    const gc = await nc(() => { const q = window.__nc.gta.squad, c = q.SQ.chase; const r = { why: c && c.why, cars: c ? c.cars.length : 0, gang: q.count('gang') }; q.clear(); return r; });
    check(gc.why === 'truck' && gc.cars === 2 && gc.gang === 6, `搶完運鈔車：幫派兩台車追殺 ${JSON.stringify(gc)}`);
    // 流明電訊的藍色電訊箱：打兩下才爛，爛掉讓 LMNT 跌、PLSW 漲
    const bx = await nc(() => {
      const nc = window.__nc, m = nc.gta.market, px = nc.motors.stk.px, a = px.LMNT, b = px.PLSW, k = m.boxHp.findIndex(h => h > 0);
      m.boxHit(k, 30, true); const half = m.boxHp[k]; m.boxHit(k, 999, true);
      nc.gta.wanted.clear('reset');
      return { half, dead: m.boxHp[k] <= 0, lmnt: px.LMNT < a, plsw: px.PLSW > b };
    });
    check(bx.half === 30 && bx.dead && bx.lmnt && bx.plsw, `電訊箱打爛：LMNT 跌、PLSW 漲 ${JSON.stringify(bx)}`);
    const sk = await nc(() => { const nc = window.__nc, m = nc.gta.market; nc.motors.cash = 500000; const n = m.buy('SNTL', 100000), c1 = nc.motors.cash, got = m.sell('SNTL'); return { n, spent: Math.round(500000 - c1), back: Math.round(got), sh: nc.motors.stk.sh.SNTL }; });
    check(sk.n > 0 && sk.spent <= 100000 && sk.back === sk.spent && sk.sh === 0, `買進賣出股票 ${JSON.stringify(sk)}`);
    const es = await nc(() => new Promise((r) => {
      const nc = window.__nc, m = nc.gta.market, c0 = nc.motors.cash, ok = m.estBuy('afterglow'), again = m.estBuy('afterglow'), cost = c0 - nc.motors.cash;
      setTimeout(() => {
        const safe = nc.motors.props.safe.afterglow, c1 = nc.motors.cash, got = m.estCollect('afterglow');
        r({ ok, again, cost, safe: Math.round(safe), got, paid: nc.motors.cash - c1, own: JSON.parse(localStorage.getItem('nc260.motors')).props.own });
      }, 1500);
    }));
    check(es.ok && !es.again && es.cost === 120000 && es.safe > 3 && es.got > 3 && es.paid === es.got && es.own.includes('afterglow'), `買下 AFTERGLOW、保險箱累積收入、收取後存檔 ${JSON.stringify(es)}`);
    // 離線：離開兩小時，股價往基準回歸並帶雜訊、資產保險箱補上這段時間的收入
    const of = await nc(() => { const nc = window.__nc, m = nc.gta.market, px0 = { ...nc.motors.stk.px }, s0 = nc.motors.props.safe.afterglow; const a = m.offline(2 * 3600e3); return { min: Math.round(a.min), cash: a.cash, moved: Object.keys(px0).some((k) => nc.motors.stk.px[k] !== px0[k]), safe: Math.round(nc.motors.props.safe.afterglow - s0) }; });
    check(of.min === 120 && of.cash > 0 && Math.abs(of.safe - of.cash) <= 1 && of.moved, `離線兩小時：股價變動、保險箱補收入 ${JSON.stringify(of)}`);
    // 傭兵小隊：鐵幕保全派皮卡載四個人過來；資產防守：AFTERGLOW 被盯上，守住領賞
    const mc = await nc(() => { const q = window.__nc.gta.squad, ok = q.merc(); const r = { ok, merc: q.count('merc'), car: !!(q.SQ.merc && q.SQ.merc.c) }; q.clear(); return r; });
    check(mc.ok && mc.merc === 4 && mc.car, `叫傭兵小隊：一台車四個人 ${JSON.stringify(mc)}`);
    const df = await nc(() => { const nc = window.__nc, q = nc.gta.squad, ok = q.defend('afterglow'), st = q.SQ.def && q.SQ.def.st, obj = document.getElementById('obj').textContent, c0 = nc.motors.cash; q.win(); const r = { ok, st, obj: /資產防守/.test(obj), got: nc.motors.cash - c0, off: !q.SQ.def }; q.clear(); return r; });
    check(df.ok && df.st === 'go' && df.obj && df.got >= 6000 && df.off, `資產防守：任務列顯示、守住領賞 ${JSON.stringify(df)}`);

    // 搶銀行（潛行）：籌備費 → 偷鑽機廂型車 → 進銀行 → C4 → 鑽金庫 → Vance 出門（2 星）→ Kael 開回倉庫 → 結算
    const hs = (fn, ms = 1300) => nc(fn).then(async (v) => { await page.waitForTimeout(ms); return v; });
    await hs(() => { const nc = window.__nc, g = nc.gta, h = g.heist; nc.motors.cash = 50000; h.go('smart'); const v = h.heist.van; nc.tp(v.x + 2.6, v.z, 0); });
    const hz1 = await hs(() => { const nc = window.__nc; return { fee: 50000 - nc.motors.cash, act: nc.act() }; });
    await hs(() => { const nc = window.__nc, g = nc.gta, h = g.heist, v = h.heist.van; v.x = h.SAFE.x; v.z = h.SAFE.z + 2; v.vx = v.vz = 0; g.wanted.clear('reset'); });
    const hz2 = await hs(() => { const nc = window.__nc, h = nc.gta.heist; const st = h.heist.st; nc.tpL(h.BANK.x, h.BANK.z + 1.2, Math.PI); return { st, act: nc.act() }; });
    // 人質：威懾不夠時有人往門口跑，Kael 會喝止；沒人管、跑出門就響警報（測完把警報關掉，繼續走潛行路線）
    const hg = await nc(() => new Promise((r) => {
      const h = window.__nc.gta.heist, H = h.hostSt; h.heist.t = 15; h.run(0, true);
      setTimeout(() => { const kael = H[0].st; h.run(1); H[1].x = 0; H[1].z = 1.7; setTimeout(() => { const q = { kael, out: H[1].st, alarm: h.heist.alarm }; h.heist.alarm = false; r(q); }, 700); }, 1600);
    }));
    check(hg.kael === 'down' && hg.out === 'out' && hg.alarm, `人質逃跑：Kael 喝止、跑出門就響警報 ${JSON.stringify(hg)}`);
    const hz3 = await hs(() => { const nc = window.__nc, h = nc.gta.heist; const r = { where: nc.player.where, st: h.heist.st }; h.heist.t = .05; return r; }, 400);
    const hz4 = await hs(() => { const nc = window.__nc, h = nc.gta.heist; const st = h.heist.st; h.blow(); h.drill(); return { st, t: Math.round(h.heist.t), alarm: h.heist.alarm }; }, 300);
    await hs(() => { window.__nc.gta.heist.heist.t = .05; }, 1600);
    const hz5 = await hs(() => { const nc = window.__nc, g = nc.gta, h = g.heist, car = h.heist.car; const r = { st: h.heist.st, cur: g.crew.crew.cur, stars: g.wanted.W.stars, take: h.heist.take, crew: g.squad.count('crew') }; nc.tp(car.x + 2.5, car.z, 0); r.act = nc.act(); return r; }, 1600);
    const hz6 = await hs(() => { const nc = window.__nc, g = nc.gta, h = g.heist, v = nc.player.veh; const r = { st: h.heist.st, cur: g.crew.crew.cur, drive: nc.player.mode }; v.x = h.SAFE.x; v.z = h.SAFE.z; v.vx = v.vz = 0; g.wanted.clear('reset'); window.__c0 = nc.motors.cash; return r; });
    const hz7 = await nc(() => { const nc = window.__nc, h = nc.gta.heist; return { st: h.heist.st, got: nc.motors.cash - window.__c0, on: document.getElementById('heistDone').classList.contains('on') }; });
    check(hz1.fee === 10000 && hz2.st === 'go' && hz3.where === 'bank' && hz3.st === 'lobby', `搶劫前置：籌備費、廂型車開回倉庫、進銀行大廳 ${JSON.stringify({ h1: hz1, h2: hz2, h3: hz3 })}`);
    check(hz4.st === 'c4' && hz4.t === 40 && !hz4.alarm && hz5.st === 'escape' && hz5.cur === 0 && hz5.stars === 2 && hz5.take === 2000000 && hz5.crew === 2, `潛行：鑽 40 秒不響警報、Vance 帶 $2,000,000 出門（2 星）、Jax 與 Kael 跟著出來 ${JSON.stringify({ h4: hz4, h5: hz5 })}`);
    check(hz6.st === 'drive' && hz6.cur === 1 && hz6.drive === 'drive' && hz7.st === 'off' && hz7.got === 1800000 && hz7.on, `Kael 開回倉庫、扣 Zero 一成實得 $1,800,000 ${JSON.stringify({ h6: hz6, h7: hz7 })}`);
    await shot(page, 'd-heist');
    await nc(() => { document.getElementById('heistDone').classList.remove('on'); window.__nc.gta.god.on = false; });

    // 安全屋（69-safehouse.js）：門口看房 → 買下 → 進去 → 睡一覺存檔（存在門口）→ 出門
    const sa1 = await nc(() => {
      const nc = window.__nc, d = nc.gta.apt.APT.loft.door;
      nc.walk(); nc.gta.wanted.clear('reset'); nc.earn(400000, '測試');
      nc.tpL(d.x, d.z + .8, Math.PI);
      const c = nc.ctx(); nc.act(); nc.pick(0);
      return { c, own: nc.motors.props.own.includes('loft'), c2: nc.ctx() };
    });
    await nc(() => window.__nc.act());
    await page.waitForTimeout(900);
    const sa2 = await nc(() => {
      const nc = window.__nc, a = nc.gta.apt.APT.loft, p = nc.player;
      window.__g0 = nc.motors.game ? nc.motors.game.t : 0;
      const w = p.where; p.x = a.nap.x; p.z = a.nap.z + .2; nc.gta.life.hp = 40;
      return { w, c: nc.ctx(), st: document.getElementById('stName').textContent };
    });
    await nc(() => window.__nc.act());
    await page.waitForTimeout(900);
    const sa3 = await nc(() => {
      const nc = window.__nc, a = nc.gta.apt.APT.loft, g = nc.motors.game, s = g && g.st[g.cur], p = nc.player;
      const r = { saved: !!g && g.t > window.__g0, atDoor: !!s && Math.hypot(s.x - a.doorW.x, s.z - a.doorW.z) < 2, hp: nc.gta.life.hp === nc.gta.life.max };
      p.x = a.exit.x; p.z = a.exit.z; r.c = nc.ctx(); nc.act();
      return r;
    });
    await page.waitForTimeout(900);
    const sa4 = await nc(() => { const nc = window.__nc, d = nc.gta.apt.APT.loft.doorW; return { w: nc.player.where, d: Math.round(Math.hypot(nc.player.x - d.x, nc.player.z - d.z)) }; });
    check(/看房/.test(sa1.c) && sa1.own && /進入/.test(sa1.c2), `安全屋：門口看房、買下後變成進入 ${JSON.stringify(sa1)}`);
    check(sa2.w === 'loft' && /睡一覺/.test(sa2.c) && sa2.st === '冠石頂層公寓', `進入冠石頂層公寓、沙發可以睡覺 ${JSON.stringify(sa2)}`);
    check(sa3.saved && sa3.atDoor && sa3.hp && /回到街上/.test(sa3.c) && sa4.w === 'out' && sa4.d < 3, `睡一覺存檔在門口、補滿生命，出門回到街上 ${JSON.stringify({ ...sa3, ...sa4 })}`);
    // 在安全屋睡覺存的檔：出門後讀檔回到室內
    await nc(() => window.__nc.gta.phone.load());
    await page.waitForTimeout(1800);
    const sa5 = await nc(() => ({ w: window.__nc.player.where, saved: window.__nc.motors.game.where }));
    check(sa5.saved === 'loft' && sa5.w === 'loft', `安全屋存的檔讀回室內 ${JSON.stringify(sa5)}`);
    await nc(() => window.__nc.exit());
    await page.waitForTimeout(900);
    // 不用買的店（HANG_IDS）：便利店門口直接進入，結帳台買吃的補滿生命；酒館裡沒有睡覺
    const hg1 = await nc(() => { const nc = window.__nc, d = nc.gta.apt.APT.store.door; nc.tpL(d.x, d.z + .8, Math.PI); const c = nc.ctx(); nc.act(); return { c }; });
    await page.waitForTimeout(900);
    const hg2 = await nc(() => {
      const nc = window.__nc, a = nc.gta.apt.APT.store, p = nc.player, w = p.where;
      p.x = a.till.x; p.z = a.till.z; nc.gta.life.hp = 40; const cash = nc.motors.cash, c = nc.ctx(); nc.act();
      return { w, c, hp: nc.gta.life.hp === nc.gta.life.max, paid: cash - nc.motors.cash };
    });
    await nc(() => window.__nc.exit());
    await page.waitForTimeout(900);
    const hg3 = await nc(() => { const nc = window.__nc, d = nc.gta.apt.APT.pub.door; nc.tpL(d.x, d.z + .8, Math.PI); const c = nc.ctx(); nc.act(); return { c }; });
    await page.waitForTimeout(900);
    const hg4 = await nc(() => { const nc = window.__nc, a = nc.gta.apt.APT.pub, p = nc.player, w = p.where; p.x = a.bar.x; p.z = a.bar.z; const c = nc.ctx(); p.x = a.spawn.x; p.z = a.spawn.z; return { w, c, c2: nc.ctx() }; });
    check(/進入/.test(hg1.c) && hg2.w === 'store' && /買點吃的/.test(hg2.c) && hg2.hp && hg2.paid === 40, `便利店不用買就能進去，結帳台花 $40 補滿生命 ${JSON.stringify({ ...hg1, ...hg2 })}`);
    check(/進入/.test(hg3.c) && hg4.w === 'pub' && /點一杯/.test(hg4.c) && !/睡一覺/.test(hg4.c2), `酒館不用買就能進去，吧台點一杯、沒有沙發 ${JSON.stringify({ ...hg3, ...hg4 })}`);
    await nc(() => window.__nc.exit());
    await page.waitForTimeout(900);

    // 20×15 的新城區：走到最東南的錨灣港與西南的珊瑚灘，車流與路人要跟著過去、HUD 換區名
    const far = [];
    for (const [x, z] of [[1260, 713], [72, 651]]) {
      await nc((q) => window.__nc.tpL(q[0], q[1], 0), [x, z]);
      await page.waitForTimeout(1500);
      far.push(await nc((q) => {
        const nc = window.__nc, w = nc.W(q[0], q[1]), near = (a) => a.filter((o) => Math.hypot(o.x - w[0], o.z - w[1]) < 300).length;
        const peds = nc.pedState.map(({ b }) => { const [x, z] = nc.W((b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2); return { x, z }; });
        return { d: document.getElementById('district').textContent, cars: near(nc.traffic), peds: near(peds), fps: nc.getStats().fps };
      }, [x, z]));
    }
    check(/錨灣港/.test(far[0].d) && /珊瑚灘/.test(far[1].d) && far.every((f) => f.cars >= 6 && f.peds >= 6), `新城區：錨灣港、珊瑚灘有車流與路人 ${JSON.stringify(far)}`);
    await shot(page, 'e-far');

    // 海岸（21-coast.js）：步道往河裡走會被擋牆擋住；跨海橋走得上灰鷗島，HUD 換成島名；島上辦公室安全屋買下、進去、睡覺、收保險箱
    // 灰鷺河濱步道（x = −238 是河岸擋牆）往西走
    const sea = await nc(() => { const nc = window.__nc; nc.walk(); nc.gta.wanted.clear('reset'); nc.tpL(-233, 300, -Math.PI / 2); return nc.L(nc.player.x, nc.player.z)[0]; });
    await hold(page, 'KeyW', 2500);
    const sea2 = await nc(() => ({ x: window.__nc.L(window.__nc.player.x, window.__nc.player.z)[0], d: document.getElementById('district').textContent }));
    check(sea2.x < sea - 2 && sea2.x > -238.5 && /灰鷺河濱/.test(sea2.d), `河濱步道往河裡走會停在擋牆 ${JSON.stringify({ x0: sea, ...sea2 })}`);
    const isle0 = await nc(() => { const nc = window.__nc, d = nc.gta.apt.APT.office.door, bx = d.x - 8, iz = d.z - 133.4; nc.tpL(bx, iz - 5, 0); return { z: nc.L(nc.player.x, nc.player.z)[1], iz }; });
    await hold(page, 'KeyW', 5000);
    const isle1 = await nc(() => ({ z: window.__nc.L(window.__nc.player.x, window.__nc.player.z)[1], y: window.__nc.player.y, d: document.getElementById('district').textContent, st: document.getElementById('stName').textContent }));
    check(isle1.z > isle0.iz + 2 && /灰鷗島/.test(isle1.d) && /Gull Island/.test(isle1.st), `從跨海橋走上灰鷗島，HUD 顯示島名 ${JSON.stringify({ ...isle0, ...isle1 })}`);
    const of1 = await nc(() => {
      const nc = window.__nc, d = nc.gta.apt.APT.office.door;
      nc.earn(600000, '測試'); nc.tpL(d.x, d.z - .8, 0);
      const c = nc.ctx(); nc.act(); nc.pick(0);
      return { c, own: nc.motors.props.own.includes('office'), c2: nc.ctx() };
    });
    await nc(() => window.__nc.act());
    await page.waitForTimeout(900);
    const of2 = await nc(() => {
      const nc = window.__nc, a = nc.gta.apt.APT.office, p = nc.player, r = { w: p.where, st: document.getElementById('stName').textContent };
      nc.motors.props.safe.office = 1234; p.x = a.desk.x; p.z = a.desk.z - .4; r.desk = nc.ctx(); const c0 = nc.motors.cash; nc.act(); r.got = nc.motors.cash - c0;
      p.x = a.nap.x; p.z = a.nap.z + .2; r.nap = nc.ctx(); p.x = a.exit.x; p.z = a.exit.z; r.exit = nc.ctx(); nc.act();
      return r;
    });
    await page.waitForTimeout(900);
    const of3 = await nc(() => { const nc = window.__nc, d = nc.gta.apt.APT.office.doorW; return { w: nc.player.where, d: Math.round(Math.hypot(nc.player.x - d.x, nc.player.z - d.z)) }; });
    check(/看房/.test(of1.c) && of1.own && /進入/.test(of1.c2) && of2.w === 'office' && of2.got === 1234 && /睡一覺/.test(of2.nap) && /回到街上/.test(of2.exit) && of3.w === 'out' && of3.d < 3,
      `灰鷗島辦公室：門朝北、買下、進去收保險箱、沙發睡覺、出門 ${JSON.stringify({ ...of1, ...of2, ...of3 })}`);
    // 其他安全屋的短租收入：手機列出租金，進門自動收下
    const mi1 = await nc(() => {
      const nc = window.__nc, m = nc.gta.market, e = m.ESTATES.find(o => o.id === 'mini');
      nc.earn(200000, '測試'); const ok = m.estBuy('mini');
      nc.motors.props.safe.mini = 777; const c0 = nc.motors.cash; nc.gta.apt.enter('mini');
      return { ok, rate: e.rate, cap: e.cap, c0 };
    });
    await page.waitForTimeout(2400);
    const mi2 = await nc(() => { const nc = window.__nc, r = { w: nc.player.where, cash: nc.motors.cash, safe: nc.motors.props.safe.mini }; return r; });
    await nc(() => { const nc = window.__nc, a = nc.gta.apt.APT.mini; nc.player.x = a.exit.x; nc.player.z = a.exit.z; nc.act(); });
    await page.waitForTimeout(900);
    check(mi1.ok && mi1.rate > 0 && mi1.cap > mi1.rate && mi2.w === 'mini' && mi2.cash - mi1.c0 >= 777 && mi2.cash - mi1.c0 < 800 && mi2.safe < 5, `迷你閣樓短租收入：進門收下保險箱 ${JSON.stringify({ ...mi1, ...mi2 })}`);
    // 光環廣場（cyberpunk 街廓在 http 下才換模型；這裡是程式立面）、燈籠公園
    const halo = [];
    for (const [x, z] of [[504, 124], [576, 434]]) { await nc((q) => window.__nc.tpL(q[0], q[1], 0), [x, z]); await page.waitForTimeout(700); halo.push(await nc(() => document.getElementById('district').textContent)); }
    check(/光環/.test(halo[0]) && /燈籠/.test(halo[1]), `光環廣場、燈籠公園的區名 ${JSON.stringify(halo)}`);

    // 日夜循環與天氣（28-sky.js）：正午放晴、傍晚雷雨、雨停後積水慢慢乾
    await nc(() => { const nc = window.__nc; nc.tpL(nc.spots.bouncer.x + 6, nc.spots.bouncer.z + 4, 0); nc.time(720); nc.weather('clear'); });
    await page.waitForTimeout(600);
    const noon = await nc(() => { const nc = window.__nc, U = nc.U; return { day: +nc.atm.day.toFixed(2), sun: +U.uSunCol.value.x.toFixed(2), lamp: U.uLampOn.value, wet: U.uWet.value, rain: U.uRain.value, wx: document.getElementById('wxText').textContent, hm: U.uHM.value.w > 20 }; });
    check(noon.day > .95 && noon.sun > 1 && noon.lamp === 0 && noon.wet === 0 && noon.rain === 0 && noon.wx === '晴' && noon.hm, `正午放晴：日光、路燈關、路面乾、建築高度圖 ${JSON.stringify(noon)}`);
    await shot(page, 'd-noon');
    await nc(() => { const nc = window.__nc; nc.time(1110); nc.weather('storm'); nc.flash(); });
    await page.waitForTimeout(900);
    const storm = await nc(() => { const nc = window.__nc, U = nc.U; return { day: +nc.atm.day.toFixed(2), lamp: U.uLampOn.value, rain: U.uRain.value, wx: document.getElementById('wxText').textContent, umb: nc.pedState.filter(p => p.um).length, out: nc.pedState.filter(p => p.out).length, flash: nc.wx.bolts }; });
    check(storm.day < .5 && storm.lamp === 1 && storm.rain === 1 && storm.wx === '雷雨' && storm.umb > 0 && storm.out >= 4 && storm.flash, `傍晚雷雨：路燈亮、撐傘、遠處的路人躲雨、打雷 ${JSON.stringify(storm)}`);
    await shot(page, 'd-storm');
    const dry = await nc(() => new Promise((r) => { const nc = window.__nc; nc.time(720); nc.weather('clear', false); nc.wx.rain = 0; const w0 = nc.wx.wet; for (let i = 0; i < 900; i++) nc.step(1 / 30); r({ w0, w1: +nc.wx.wet.toFixed(2), rain: +nc.wx.rain.toFixed(2), umb: nc.pedState.filter(p => p.um).length, out: nc.pedState.filter(p => p.out).length }); }));
    check(dry.w0 === 1 && dry.w1 < .9 && dry.rain < .05 && dry.umb === 0 && dry.out === 0, `雨停後路面慢慢變乾、行人收傘、躲雨的人回到街上 ${JSON.stringify(dry)}`);
    // 下水：從沙灘走過水深 0.3 m 的擋牆、深水游泳、回到沙灘
    {
      await nc(() => { const n = window.__nc, B = n.sea.BEACH; n.tpL((B.x0 + B.x1) / 2 + 40, B.z1 - 4, 0); });
      await page.keyboard.down('KeyW'); await page.waitForTimeout(4000); await page.keyboard.up('KeyW');
      const w0 = await nc(() => { const n = window.__nc, B = n.sea.BEACH; return { past: n.L(n.player.x, n.player.z)[1] - B.z1, d: n.sea.depth(n.player.x, n.player.z) }; });
      check(w0.past > .5 && w0.d > .3, `走過沙灘外緣涉水（超過 ${w0.past.toFixed(1)} m、水深 ${w0.d.toFixed(2)} m）`);
      await nc(() => { const n = window.__nc, Q = n.sea.QUAY; n.tpL((Q.x0 + Q.x1) / 2, Q.z1 + 60, Math.PI); });
      await page.waitForTimeout(800);
      const w1 = await nc(() => { const n = window.__nc, p = n.player; return { swim: !!p.swim, dy: p.y - n.sea.SEA_Y, gun: n.gta.state.aiming }; });
      check(w1.swim && Math.abs(w1.dy) < .3, `深水游泳 ${JSON.stringify(w1)}`);
      // 通緝中游出去：碼頭上的警車背對著水面，110 m 內照樣算看得到（不會因為游遠就消星）
      const sw = await nc(() => { const n = window.__nc, Q = n.sea.QUAY, w = n.gta.wanted; w.set(1); const [x, z] = n.W((Q.x0 + Q.x1) / 2, Q.z1 - 8); const u = w.unit('car', { x, z, yaw: Math.PI });
        const r = { unit: !!u, seen: w.sees(), d: Math.round(Math.hypot(x - n.player.x, z - n.player.z)) }; w.clear(); return r; });
      check(sw.unit && sw.seen && sw.d < 110, `游泳時岸上的警察盯著水面 ${JSON.stringify(sw)}`);
      await nc(() => { const n = window.__nc, B = n.sea.BEACH; n.tpL((B.x0 + B.x1) / 2, B.z0 + 20, 0); });
      await page.waitForTimeout(500);
      check(await nc(() => !window.__nc.player.swim), '回到沙灘就不再游泳');
    }
    // 岬角（10-city.js 的 CAPES）：從東岸步道走上東灣觀景岬（岸邊擋牆在那裡斷開），再從岬尖往外走，被臨水的擋牆擋住
    {
      const x0 = await nc(() => { const n = window.__nc, h = n.capes.find(h => h.name.startsWith('東灣觀景岬')), [x0, z0] = n.L(...h.pts[0]), [, z1] = n.L(...h.pts[h.pts.length - 1]); n.tpL(x0 - 3, z0 + (z1 - z0) * .44, Math.PI / 2); return x0; });
      await page.keyboard.down('KeyW'); await page.waitForTimeout(4000); await page.keyboard.up('KeyW');
      const onCape = () => { const n = window.__nc, P = n.capes.find(h => h.name.startsWith('東灣觀景岬')).pts, { x, z } = n.player; let c = false; for (let k = 0, m = P.length - 1; k < P.length; m = k++) { const [ax, az] = P[k], [bx, bz] = P[m]; if ((az > z) !== (bz > z) && x < (bx - ax) * (z - az) / (bz - az) + ax) c = !c; } return c; };
      const c0 = await nc(([x0, src]) => { const n = window.__nc, p = n.player; return { on: (0, eval)(src)(), past: +(n.L(p.x, p.z)[0] - x0).toFixed(1), y: +p.y.toFixed(2) }; }, [x0, `(${onCape})`]);
      check(c0.on && c0.past > 2 && c0.y === 0, `從步道走上岬角 ${JSON.stringify(c0)}`);
      // 岬尖：離接岸那條邊最遠的點往裡 5 m，面朝外
      await nc(() => { const n = window.__nc, P = n.capes.find(h => h.name.startsWith('東灣觀景岬')).pts, [ax, az] = P[0], [bx, bz] = P[P.length - 1], ex = az - bz, ez = bx - ax, l = Math.hypot(ex, ez);
        let best = -1, tip = P[0]; for (const q of P) { const d = Math.abs((q[0] - ax) * ex + (q[1] - az) * ez); if (d > best) { best = d; tip = q; } }
        const sg = (tip[0] - ax) * ex + (tip[1] - az) * ez > 0 ? 1 : -1, ux = ex / l * sg, uz = ez / l * sg;
        n.tp(tip[0] - ux * 5, tip[1] - uz * 5, Math.atan2(ux, uz)); });
      await page.keyboard.down('KeyW'); await page.waitForTimeout(5000); await page.keyboard.up('KeyW');
      const c1 = await nc((src) => { const n = window.__nc, p = n.player; return { on: (0, eval)(src)(), d: n.sea.depth(p.x, p.z), swim: !!p.swim }; }, `(${onCape})`);
      check(c1.on && c1.d === 0 && !c1.swim, `岬尖臨水的擋牆擋住，不會走進水裡 ${JSON.stringify(c1)}`);
    }
    await nc(() => { const nc = window.__nc; nc.time(134); nc.weather('rain'); });

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
    // 第二階段：點「武器」開轉盤、點扇形選武器；通緝星級與生命條不擋到其他 HUD
    await ev(page, () => window.__nc.walk());
    await page.tap('#tbtn button[data-k="Tab"]');
    await page.waitForTimeout(300);
    const mw = await ev(page, () => { const r = document.getElementById('wheel').getBoundingClientRect(); return { open: window.__nc.gta.arm.wheel.open, l: Math.round(r.left), r: Math.round(r.right), w: innerWidth }; });
    check(mw.open && mw.l >= 0 && mw.r <= mw.w, `觸控開武器轉盤、不超出畫面 ${JSON.stringify(mw)}`);
    await shot(page, 'm-wheel');
    await page.tap('#wheel path[data-s="2"]');
    await page.waitForTimeout(200);
    check((await ev(page, () => window.__nc.gta.state.weapon)) === 'smg' && !(await ev(page, () => window.__nc.gta.arm.wheel.open)), '點扇形換成衝鋒槍並關閉轉盤');
    await ev(page, () => { window.__nc.gta.god.on = true; window.__nc.gta.wanted.set(2); });
    await page.waitForTimeout(800);
    const mh = await ev(page, () => {
      const box = id => document.getElementById(id).getBoundingClientRect(), w = box('wanted'), v = box('vitals'), m = box('mapBox'), t = box('tbtn');
      const hit = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
      return { stars: document.querySelectorAll('#wanted svg.lit').length, inside: w.right <= innerWidth && w.left >= 0, overlap: hit(v, t) || hit(v, box('joy')) || hit(w, t), vm: hit(v, m) };
    });
    check(mh.stars === 2 && mh.inside && !mh.overlap && !mh.vm, `手機上的通緝星級與生命條 ${JSON.stringify(mh)}`);
    await shot(page, 'm-wanted');
    await ev(page, () => { window.__nc.gta.wanted.clear('reset'); window.__nc.gta.god.on = false; });
    await page.tap('#tbtn button[data-k="Crew"]');
    await page.waitForTimeout(300);
    const mc = await ev(page, () => { const r = document.getElementById('crewW').getBoundingClientRect(), v = document.getElementById('spBar').getBoundingClientRect(); return { open: window.__nc.gta.crew.crew.wheel.open, l: Math.round(r.left), r: Math.round(r.right), w: innerWidth, sp: v.width > 10 }; });
    check(mc.open && mc.l >= 0 && mc.r <= mc.w && mc.sp, `觸控開角色轉盤、不超出畫面，生命條旁有能力條 ${JSON.stringify(mc)}`);
    await shot(page, 'm-crew');
    await page.tap('#crewW path[data-c="2"]');
    await page.waitForTimeout(3300);
    check((await ev(page, () => window.__nc.gta.crew.crew.cur)) === 2, '點扇形切換到 Jax');
    await page.tap('#bPhone');
    await page.waitForTimeout(400);
    const mp = await ev(page, () => { const r = document.getElementById('phone').getBoundingClientRect(); return { open: window.__nc.gta.phone.phone.open, l: Math.round(r.left), r: Math.round(r.right), t: Math.round(r.top), b: Math.round(r.bottom), w: innerWidth, h: innerHeight }; });
    check(mp.open && mp.l >= 0 && mp.r <= mp.w && mp.t > 120 && mp.b <= mp.h, `觸控開手機、不超出畫面 ${JSON.stringify(mp)}`);
    await page.tap('#phScr li:nth-child(2) button');
    await page.waitForTimeout(200);
    check((await ev(page, () => window.__nc.gta.phone.phone.scr)) === 'arms', '點列表進入暗網軍火');
    await shot(page, 'm-phone');
    await page.tap('#phBack');
    await page.tap('#phScr li:nth-child(3) button');
    await page.tap('#phScr li:nth-child(1) button');
    await page.waitForTimeout(200);
    const ms = await ev(page, () => { const r = document.getElementById('phScr').getBoundingClientRect(); return { scr: window.__nc.gta.phone.phone.scr, rows: document.querySelectorAll('#phScr li').length, b: Math.round(r.bottom), h: innerHeight, sw: document.getElementById('phScr').scrollWidth <= document.getElementById('phScr').clientWidth }; });
    check(ms.scr === 'stock' && ms.rows >= 4 && ms.b <= ms.h && ms.sw, `點證交所→個股，買賣列不溢出 ${JSON.stringify(ms)}`);
    await shot(page, 'm-stock');
    // 天際置業：資產與兩間安全屋的列（名稱、說明、價格）不溢出
    await page.tap('#phBack'); await page.tap('#phBack');
    await page.tap('#phScr li:nth-child(4) button');
    await page.waitForTimeout(200);
    const me = await ev(page, () => { const s = document.getElementById('phScr'), r = s.getBoundingClientRect(), li = [...s.querySelectorAll('li')]; return { scr: window.__nc.gta.phone.phone.scr, rows: li.length, home: li.filter(l => /安全屋|公寓|別墅/.test(l.textContent)).length, b: Math.round(r.bottom), h: innerHeight, sw: s.scrollWidth <= s.clientWidth, clip: li.some(l => l.scrollWidth > l.clientWidth + 1) }; });
    check(me.scr === 'estates' && me.home >= 2 && me.b <= me.h && me.sw && !me.clip, `點天際置業，安全屋列不溢出 ${JSON.stringify(me)}`);
    await shot(page, 'm-estates');
    await page.tap('#phBack'); await page.tap('#phBack');
    await page.waitForTimeout(300);
    check(!(await ev(page, () => window.__nc.gta.phone.phone.open)), '返回、再按關閉收起手機');
    // 搶劫的任務框（標題＋威懾／計時條）在手機上不壓到小地圖與觸控按鈕
    await ev(page, () => { const nc = window.__nc, h = nc.gta.heist; nc.gta.god.on = true; nc.motors.cash = 50000; h.go('loud'); h.stage('drill', 60); h.heist.t = 58; });
    await page.waitForTimeout(400);
    const mo = await ev(page, () => {
      const box = id => document.getElementById(id).getBoundingClientRect(), o = box('obj'), s = box('objSub');
      const hit = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
      return { inside: o.left >= 0 && o.right <= innerWidth && o.top >= 0, bar: s.width > 40 && s.bottom <= o.bottom, overlap: hit(o, box('mapBox')) || hit(o, box('tbtn')) || hit(o, box('wanted')) || hit(o, box('tools')) || hit(o, box('compass')) };
    });
    check(mo.inside && mo.bar && !mo.overlap, `手機上的搶劫任務框 ${JSON.stringify(mo)}`);
    await shot(page, 'm-heist');
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
