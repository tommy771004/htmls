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
    const w2 = await ev(page, () => { const w = window.__nc.props.w2; return w && { on: w.on, sets: Object.keys(w.sets).length, failed: w.failed.length, kept: w.kept(), proc: w.proc, ebox: w.n.ebox, pump: w.n.pump }; });
    check(w2 && !w2.on && !w2.sets && !w2.failed && w2.kept >= 19 && w2.proc && w2.ebox > 20 && w2.pump >= 4, `以檔案開啟不換 world_2 模型、程式建模都在（配電箱與加油機用替身） ${JSON.stringify(w2)}`);
    // world_1 第二批：北嶺鐵道橋以檔案開啟是程式替身（山溝照樣挖），gameready_city 的三台車照樣在路邊（車流 GLB 內嵌）
    const w1b = await ev(page, () => { const nc = window.__nc, V = nc.props.viaduct; return { via: !!(V && V.proxy && V.proxy.parent), deep: V ? +(nc.park.h(V.x + V.lx0 + V.W / 2, V.z + V.lz0 + V.D / 2) - V.deck).toFixed(1) : 0, grc: ['grc_sedan', 'grc_stepvan', 'grc_mailvan'].map(t => nc.parked.filter(p => p.type === t).length) }; });
    check(w1b.via && w1b.deep < -40 && w1b.grc.every(n => n > 10), `北嶺鐵道橋的程式替身在、谷底比橋面低 ${-w1b.deep} m；路邊停著 gameready_city 的三台車（${w1b.grc.join('、')}）`);

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
    // 舞池：動畫庫只有一段舞，另外三種舞步是上身覆寫；拍點錯開，路人上衣有花樣
    const dz = await ev(page, () => { const nc = window.__nc, A = nc.ANIM, D = [A.danceA, A.danceB, A.danceC, A.punch, A.danceD, A.danceE, A.danceF];
      const ds = nc.club.people.people.filter((p, i) => nc.club.dancers.includes(i));
      return { kinds: new Set(ds.map(p => p.a[0]).filter(a => D.includes(a))).size, offs: new Set(ds.map(p => p.a[3])).size, n: ds.length,
        pats: new Set(nc.peds.people.filter(p => p.sm).map(p => p.sm.material.uniforms.uPat.value.x)).size, me: nc.player.dance };
    });
    check(dz.kinds >= 6 && dz.offs >= 3 && dz.pats >= 4 && dz.me >= 1 && dz.me <= 7, `舞池 ${dz.n} 人跳 ${dz.kinds} 種舞步、${dz.offs} 種拍點，路人上衣 ${dz.pats} 種花樣（含素面）`);
    await shot(page, 'd-club');
    // 自動降載：內部解析度降到 60% 還是慢就縮短細節距離（01-settings.js 的 detail），變快了先放回來
    const dk = await ev(page, () => new Promise((r) => {
      const nc = window.__nc, P = nc.post, d0 = nc.menu.detail();
      nc.menu.set('res', 'auto'); P.scale = .6; P.ft = 60; P.slow = 2;
      requestAnimationFrame(() => requestAnimationFrame(() => {
        const d1 = nc.menu.detail(); P.ft = 4; P.fast = 5;
        requestAnimationFrame(() => requestAnimationFrame(() => r({ d0: d0.k, d1: d1.k, d2: nc.menu.detail().k, scale: P.scale })));
      }));
    }));
    check((dk.d1 < dk.d0 || dk.d0 <= .6) && dk.d2 > dk.d1 && dk.scale === .6, `太慢時縮短細節距離、變快先放回來 ${JSON.stringify(dk)}`);
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
    // 持槍姿勢（40-people.js 的 gunPose）：瞄準時雙手的手腕都送到槍上的握點；長槍沒瞄準時也雙手握著
    const grip = {};
    await nc(() => window.__nc.gta.fill());
    for (const [w, a] of [['pistol', 1], ['rifle', 1], ['rifle', 0], ['shotgun', 1], ['rpg', 1], ['minigun', 1]]) {
      await nc(([w, a]) => { window.__nc.gta.weapon(w); window.__nc.gta.aim(!!a); }, [w, a]);
      await page.waitForTimeout(700);
      const h = await nc(() => { const h = window.__nc.gta.held(); return h && h.ik; });
      grip[w + (a ? '' : '低姿')] = h ? Math.max(h.r, h.l) : null;
    }
    await nc(() => { window.__nc.gta.aim(false); window.__nc.gta.weapon('pistol'); });
    check(Object.values(grip).every(e => e != null && e < .03), `雙手握在槍上（手腕離握點的最大距離，公尺）${JSON.stringify(grip)}`);
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
    const db = await nc(() => { const nc = window.__nc, g = nc.gta; nc.drive(); g.wanted.clear('reset'); g.fill(); g.equip('pistol', true); g.state.fireT = g.state.reloadT = 0; g.fire(); return { mode: nc.player.mode, mag: g.arm.ammo.pistol.mag, sg: g.canDriveBy('shotgun'), rf: g.canDriveBy('rifle'), dead: g.life.dead, god: g.god.on, where: nc.player.where, pist: g.canDriveBy('pistol') }; });
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
    check(ph.open && ph.b <= ph.h && ph.w === 280 && ph.rows === 8, `按 P 滑出手機 ${JSON.stringify(ph)}`);
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
    check(qv.ok && qv.v === 7 && qv.ts && qv.veh && qv.veh.k === 'own' && qv.mode === 'drive' && qv.same, `開車時快速存檔，讀檔回到座駕上 ${JSON.stringify(qv)}`);
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
      nc.gta.roll.fix(v); // 上一跳落地的車損會隨機熄火，「引擎熄火」的提示會蓋掉翻滾加成
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
    // 翻車與堆疊（68-roll.js）：爆炸掀翻滾到停、側翻按住方向鍵推回、倒扣 4 秒起火、從上面落到車流車的車頂、開下來
    const ro1 = await nc(() => new Promise((r) => {
      const nc = window.__nc, R = nc.gta.roll; nc.drive(); const v = nc.player.veh;
      R.fix(v); v.vx = v.vz = 0; R.kick(v, 1, 1);
      const out = { kick: !!v.tumble, top: 0 };
      let t = 0;
      const id = setInterval(() => { t += .1; out.top = Math.max(out.top, +v.y.toFixed(1)); if (!v.tumble || t > 9) { clearInterval(id); out.settled = !v.tumble; out.st = R.st; r(out); } }, 100);
    }));
    await nc(() => { const v = window.__nc.player.veh; window.__nc.gta.roll.fix(v); v.roll = Math.PI / 2; v.flipped = { t: 0, side: 1, push: 0 }; });
    await page.waitForTimeout(200);
    await page.keyboard.down('KeyA'); await page.waitForTimeout(900); await page.keyboard.up('KeyA');
    await page.waitForTimeout(2200);
    const ro2 = await nc(() => window.__nc.gta.roll.st);
    await nc(() => { const v = window.__nc.player.veh; window.__nc.gta.roll.fix(v); v.roll = Math.PI; v.flipped = { t: 0, side: 0, push: 0 }; });
    await page.waitForTimeout(4600);
    const ro3 = await nc(() => { const v = window.__nc.player.veh, k = v.hp / v.hpMax; window.__nc.gta.roll.fix(v); return +k.toFixed(2); });
    const ro4 = await nc(() => new Promise((r) => {
      const nc = window.__nc, v = nc.player.veh, T = ['shvan', 'lct', 'conquer', 'fvan', 'ambulance', 'md84'];
      const c = nc.traffic.filter((c) => !T.includes(c.type) && !c.turn).sort((a, b) => Math.hypot(a.x - v.x, a.z - v.z) - Math.hypot(b.x - v.x, b.z - v.z))[0];
      const dbg = { type: c.type, d0: Math.round(Math.hypot(c.x - v.x, c.z - v.z)), ys: [] };
      c.hit = 3; c.v = 0; v.x = c.x; v.z = c.z; v.yaw = c.yaw; v.y = 3.5;   // 先停住：從 3.5 m 掉向開著的車，落下時它已經開走了
      v.vx = v.vz = 0; nc.gta.roll.start(v, 0, 0); window.__rc = c;
      const id = setInterval(() => dbg.ys.push(+v.y.toFixed(2), +Math.hypot(v.x - c.x, v.z - c.z).toFixed(1)), 500);
      setTimeout(() => {   // 落穩後讓下面那台往前滑 2 m（煞停前還在動）：上面的車要跟著走
        clearInterval(id); const st = { ...nc.gta.roll.st, stopped: c.v < .5, dbg }, x0 = c.x, z0 = c.z;
        const mv = setInterval(() => { c.s += .1; }, 25);
        setTimeout(() => { clearInterval(mv); r({ ...st, moved: +Math.hypot(c.x - x0, c.z - z0).toFixed(1), carry: +Math.hypot(v.x - c.x, v.z - c.z).toFixed(2), on2: !!v.onCar }); }, 500);
      }, 2500);
    }));
    await page.keyboard.down('KeyW'); await page.waitForTimeout(1600); await page.keyboard.up('KeyW');
    await page.waitForTimeout(600);
    const ro5 = await nc(() => { const v = window.__nc.player.veh, c = window.__rc; return { ...window.__nc.gta.roll.st, d: +Math.hypot(v.x - c.x, v.z - c.z).toFixed(1) }; });
    check(ro1.kick && ro1.settled && ro1.top > 1 && ro2 && !ro2.flipped && !ro2.tumble && Math.abs(ro2.roll) < .1 && ro3 <= .15
      && ro4.onCar && ro4.y > 1.3 && ro4.stopped && ro4.moved > 1 && ro4.carry < .3 && ro4.on2 && !ro5.onCar && ro5.y < .3 && ro5.d > 4,
      `翻車：爆炸掀翻滾到停、側翻推回、倒扣起火（耐久 ${ro3}）、落在車流車車頂跟著走再開下來 ${JSON.stringify({ ro1, ro2, ro4, ro5 })}`);

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
    // 倒地的身體：池子要騰位置時，畫面裡的身體搬到 bodies 留在原地，走遠了才收
    const bd = await nc(() => new Promise((r) => { const nc = window.__nc, q = nc.gta.squad, p = nc.player, fx = Math.sin(p.yaw), fz = Math.cos(p.yaw); nc.look(p.yaw, .05, 0); for (let i = 0; i < 3; i++) q.spawn('gang', p.x + fx * 7 + (i - 1) * 1.6, p.z + fz * 7, 'pistol'); for (const f of q.SQ.f) if (f.on && f.team === 'gang') { f.calm = true; f.state = 'down'; f.downT = 20; } setTimeout(() => { nc.gta.side.room(14); const a = { left: q.SQ.f.filter((f) => f.on).length, bodies: nc.gta.side.bodies() }; nc.player.x += 120; setTimeout(() => { a.gone = nc.gta.side.bodies(); nc.player.x -= 120; r(a); }, 500); }, 300); }));
    check(bd.left === 0 && bd.bodies === 3 && bd.gone === 0, `倒地的身體騰位置後留在畫面裡、走遠才收 ${JSON.stringify(bd)}`);
    // 掩蔽：站在電話亭後面，警察的視線被擋住；換個方向就看得到
    const cv = await nc(() => { const g = window.__nc.gta.wanted, b = g.booth(); if (!b) return null; const px = b.x + 1, pz = b.z; return { behind: g.cover(b.x - 12, b.z, px, pz), side: g.cover(px, pz + 9, px, pz) || g.cover(px, pz - 9, px, pz) }; });
    check(cv && !cv.behind && cv.side, `躲在電話亭後面擋住警察視線 ${JSON.stringify(cv)}`);
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
    const hz6 = await hs(() => { const nc = window.__nc, g = nc.gta, h = g.heist, v = nc.player.veh; const r = { st: h.heist.st, cur: g.crew.crew.cur, drive: nc.player.mode }; v.x = h.YARD.x; v.z = h.YARD.z; v.vx = v.vz = 0; g.wanted.clear('reset'); window.__c0 = nc.motors.cash; return r; });
    const hz7 = await nc(() => { const nc = window.__nc, h = nc.gta.heist; return { st: h.heist.st, got: nc.motors.cash - window.__c0, on: document.getElementById('heistDone').classList.contains('on') }; });
    check(hz1.fee === 10000 && hz2.st === 'go' && hz3.where === 'bank' && hz3.st === 'lobby', `搶劫前置：籌備費、廂型車開回倉庫、進銀行大廳 ${JSON.stringify({ h1: hz1, h2: hz2, h3: hz3 })}`);
    check(hz4.st === 'c4' && hz4.t === 40 && !hz4.alarm && hz5.st === 'escape' && hz5.cur === 0 && hz5.stars === 2 && hz5.take === 2000000 && hz5.crew === 2, `潛行：鑽 40 秒不響警報、Vance 帶 $2,000,000 出門（2 星）、Jax 與 Kael 跟著出來 ${JSON.stringify({ h4: hz4, h5: hz5 })}`);
    check(hz6.st === 'drive' && hz6.cur === 1 && hz6.drive === 'drive' && hz7.st === 'off' && hz7.got === 1800000 && hz7.on, `Kael 開到鐵灣貨場、扣 Zero 一成實得 $1,800,000 ${JSON.stringify({ h6: hz6, h7: hz7 })}`);
    await shot(page, 'd-heist');
    await nc(() => { document.getElementById('heistDone').classList.remove('on'); window.__nc.gta.god.on = false; });
    // 強攻：鑽金庫時人質從正門跑出來（跑遠了就多一台 SWAT）→ 逃亡車上路 3.5 秒後兩台「鐵砧」戰車封住往貨場的路、斷橋下排空車封鎖線
    // → 飛過鐵灣高架斷橋就降到最多 3 星、警察失去視線 → 開進貨櫃安全屋結算
    await hs(() => { const nc = window.__nc, g = nc.gta, h = g.heist; g.god.on = true; nc.motors.cash = 50000; h.go('loud'); h.stage('drill', 60); h.heist.alarm = true; h.drill(); }, 1800);
    await hs(() => { window.__nc.gta.heist.heist.runOutT = .05; }, 700);
    // 先推到人行道外（7 m 外會轉向沿街跑），再沿街推到 32 m 外：直接往門外推 40 m 會卡進對面的樓
    const hr = await hs(() => { const h = window.__nc.gta.heist, r = h.runSt.find((o) => o.on), q = { st: r && r.st, sw: window.__nc.gta.wanted.W.units.filter((u) => u.kind === 'swat').length }; if (r) { r.x += r.dx * 9; r.z += r.dz * 9; } return q; }, 300);
    await hs(() => { const r = window.__nc.gta.heist.runSt.find((o) => o.on); if (r) { r.x += r.dx * 36; r.z += r.dz * 36; } }, 600);
    const hr2 = await nc(() => { const g = window.__nc.gta, h = g.heist; return { leaks: h.heist.leaks, sw: g.wanted.W.units.filter((u) => u.kind === 'swat').length, on: h.runSt.filter((o) => o.on).length }; });
    check(hr.st === 'run' && hr2.leaks === 1 && hr2.sw === hr.sw + 1 && hr2.on === 0, `強攻守門：人質跑出正門、跑遠了多派一台 SWAT ${JSON.stringify({ hr, hr2 })}`);
    await hs(() => window.__nc.gta.heist.escape(), 1500);
    await hs(() => window.__nc.gta.heist.getaway(), 4500);
    const am = await nc(() => { const g = window.__nc.gta, h = g.heist, W = g.wanted.W; return { st: h.heist.st, amb: h.heist.amb, tanks: W.units.filter((u) => u.kind === 'tank' && u.heist).length, block: W.units.filter((u) => u.heist && u.kind !== 'tank' && u.crew === 0).length, mark: (h.mark() || {}).name }; });
    check(am.st === 'drive' && am.amb < 0 && am.tanks === 2 && am.block === 4 && am.mark === '鐵灣高架斷橋', `逃亡埋伏：兩台戰車封路、GPS 改指斷橋 ${JSON.stringify(am)}`);
    await nc(() => { const nc = window.__nc, B = nc.gta.heist.BROKEN, v = nc.player.veh; v.x = B.x - B.dx * (B.L + 6); v.z = B.z - B.dz * (B.L + 6); v.yaw = B.yaw; v.vx = B.dx * 32; v.vz = B.dz * 32; });
    await page.keyboard.down('KeyW'); await page.waitForTimeout(500); await page.keyboard.up('KeyW');
    await page.waitForTimeout(6500);
    const bj = await nc(() => { const nc = window.__nc, g = nc.gta, h = g.heist, B = h.BROKEN, v = nc.player.veh; return { jumped: h.heist.jumped, stars: g.wanted.W.stars, seen: g.wanted.W.seen, air: !!v.air, a: Math.round((v.x - B.x) * B.dx + (v.z - B.z) * B.dz), mark: (h.mark() || {}).name }; });
    check(bj.jumped && bj.stars <= 3 && !bj.seen && !bj.air && bj.a > 20 && bj.mark === '貨櫃安全屋', `飛過斷橋：降到 3 星以下、甩開視線，GPS 指回貨場 ${JSON.stringify(bj)}`);
    await hs(() => { const nc = window.__nc, g = nc.gta, h = g.heist, v = nc.player.veh; v.x = h.YARD.x; v.z = h.YARD.z; v.vx = v.vz = 0; g.wanted.clear('reset'); });
    const yd = await nc(() => { const h = window.__nc.gta.heist; return { st: h.heist.st, on: document.getElementById('heistDone').classList.contains('on') }; });
    check(yd.st === 'off' && yd.on, `強攻路線開進貨櫃安全屋結算 ${JSON.stringify(yd)}`);
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
    // 分層的安全屋：閣樓按 E 沿旋轉樓梯走上夾層，上面的提示變成下樓
    const lf1 = await nc(() => { const nc = window.__nc, s = nc.gta.apt.APT.loft.up.path[0], p = nc.player; p.x = s[0]; p.z = s[2] + .5; const c = nc.ctx(); nc.act(); return { c }; });
    await page.waitForTimeout(6500);
    const lf2 = await nc(() => {
      const nc = window.__nc, p = nc.player, a = nc.gta.apt.APT.loft, r = { y: +p.y.toFixed(2), ride: !!p.ride, c: nc.ctx() };
      nc.gta.apt.level('loft', 0); p.y = 0; p.x = a.spawn.x; p.z = a.spawn.z;
      return r;
    });
    // 換裝：衣架按 E，選第二套（顏色換掉、記在 localStorage），再換回原本那套
    const wr = await nc(() => {
      const nc = window.__nc, a = nc.gta.apt.APT.loft, p = nc.player, c = nc.gta.crew.CREW[nc.gta.crew.crew.cur], top0 = c.look.top.getHex();
      p.x = a.robe.x; p.z = a.robe.z - 1.3; const ctx = nc.ctx(); nc.act();
      const opts = nc.gta.apt.OUTFITS[c.id].length; nc.pick(1);
      let saved = null; try { saved = JSON.parse(localStorage.getItem('nc260.outfit'))[c.id]; } catch {}
      const r = { ctx, opts, k: nc.gta.apt.outfit[c.id], saved, changed: c.look.top.getHex() !== top0 };
      nc.gta.apt.wear(0); r.back = c.look.top.getHex() === top0;
      return r;
    });
    check(/換裝/.test(wr.ctx) && wr.opts === 4 && wr.k === 1 && wr.saved === 1 && wr.changed && wr.back, `安全屋衣架換裝、記住選擇、換回原本那套 ${JSON.stringify(wr)}`);
    check(/上樓/.test(lf1.c) && !lf2.ride && Math.abs(lf2.y - 3.85) < .1 && /下樓/.test(lf2.c), `閣樓沿旋轉樓梯走上夾層 ${JSON.stringify({ ...lf1, ...lf2 })}`);
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
    // 辦公室的夾層沒有樓梯：西牆邊的小間當電梯，淡出淡入後從夾層那側走出來
    const ol1 = await nc(() => { const nc = window.__nc, s = nc.gta.apt.APT.office.up.path[0], p = nc.player; p.x = s[0]; p.z = s[2]; const c = nc.ctx(); nc.act(); return { c }; });
    await page.waitForTimeout(3500);
    const ol2 = await nc(() => { const nc = window.__nc, p = nc.player, r = { y: +p.y.toFixed(2), ride: !!p.ride, c: nc.ctx() }; nc.gta.apt.level('office', 0); p.y = 0; return r; });
    check(/搭電梯上樓/.test(ol1.c) && !ol2.ride && Math.abs(ol2.y - 2.6) < .1 && /搭電梯下樓/.test(ol2.c), `辦公室搭電梯上夾層 ${JSON.stringify({ ...ol1, ...ol2 })}`);
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
    // 別墅：客廳西牆的門洞走得進側翼，南面落地窗拉開的那段走得到露台，其他段的玻璃擋住
    const vw0 = await nc(() => { const nc = window.__nc; if (!nc.motors.props.own.includes('villa')) nc.motors.props.own.push('villa'); nc.enter('villa'); return nc.player.where; });
    await page.waitForTimeout(900);
    const vwalk = async (x, z, yaw, ms) => {
      await nc(([x, z, yaw]) => { const nc = window.__nc, p = nc.player; p.x = x; p.z = z; nc.look(yaw, .15); }, [x, z, yaw]);
      await hold(page, 'KeyW', ms);
      return nc(() => [+window.__nc.player.x.toFixed(2), +window.__nc.player.z.toFixed(2)]);
    };
    const vw1 = await vwalk(-2, -3.8, -Math.PI / 2, 2400), vw2 = await vwalk(13.4, 4.6, 0, 1500), vw3 = await vwalk(9, 4.6, 0, 1500);
    check(vw0 === 'villa' && vw1[0] < -4.5 && vw2[1] > 6.8 && vw3[1] < 5.9, `別墅走進側翼、從拉開的落地窗走上露台、其他段玻璃擋住 ${JSON.stringify({ vw0, vw1, vw2, vw3 })}`);
    await nc(() => window.__nc.exit());
    await page.waitForTimeout(900);
    // 安全屋車庫：開自己的車停到買下的頂層公寓門口，停進去直接進門；出門後從捲門把車開出來
    const gr1 = await nc(() => { const nc = window.__nc, v = nc.vehicles[0], c = nc.gta.apt.curb('loft'); nc.walk(); v.x = c.x; v.z = c.z; v.yaw = c.yaw; v.vx = v.vz = 0; nc.drive(); return { c: nc.ctx() }; });
    await nc(() => window.__nc.act());
    await page.waitForTimeout(900);
    const gr2 = await nc(() => ({ w: window.__nc.player.where, stowed: window.__nc.motors.stowed }));
    await nc(() => window.__nc.exit());
    await page.waitForTimeout(900);
    const gr3 = await nc(() => { const nc = window.__nc, d = nc.gta.apt.APT.loft.door; nc.tpL(d.x + 3.5, d.z + .8, Math.PI); const c = nc.ctx(); nc.act(); nc.pick(0); return { c }; });
    await page.waitForTimeout(600);
    const gr4 = await nc(() => { const nc = window.__nc, p = nc.player, c = nc.gta.apt.curb('loft'), r = { mode: p.mode, d: p.veh ? Math.round(Math.hypot(p.veh.x - c.x, p.veh.z - c.z)) : -1, stowed: nc.motors.stowed }; nc.walk(); return r; });
    check(/停進車庫/.test(gr1.c) && gr2.w === 'loft' && gr2.stowed && /開車出門/.test(gr3.c) && gr4.mode === 'drive' && gr4.d === 0 && !gr4.stowed,
      `安全屋車庫：停進頂層公寓、從捲門開出來 ${JSON.stringify({ ...gr1, ...gr2, c3: gr3.c, ...gr4 })}`);
    // 車庫清單一頁六台，多的翻頁（暫時把九台車算成自己的）
    const gr5 = await nc(() => {
      const nc = window.__nc, m = nc.motors, own = m.owned.slice(), opts = () => [...document.querySelectorAll('#dlgOpts button')].map(b => b.textContent.slice(1));
      m.owned = [m.cur, ...Object.keys(nc.cars).filter(c => c !== m.cur).slice(0, 8)];
      nc.gta.apt.garage('loft'); const p1 = opts(), t1 = document.getElementById('dlgWho').textContent;
      nc.pick(6); const p2 = opts(), t2 = document.getElementById('dlgWho').textContent;
      nc.pick(p2.length - 2); const p3 = opts();
      nc.gta.apt.garage('loft', 0); nc.pick(p1.length - 1); m.owned = own;
      return { n1: p1.length, n2: p2.length, t1, t2, back: p3[0] === p1[0], open: !!document.querySelector('#dialog.on') };
    });
    check(gr5.n1 === 8 && gr5.n2 === 5 && /1\/2/.test(gr5.t1) && /2\/2/.test(gr5.t2) && gr5.back && !gr5.open, `安全屋車庫清單翻頁 ${JSON.stringify(gr5)}`);
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
    // 擋牆上的梯子（10-city.js 的 LADDERS）：在梯子底下往岸上游，爬上去就不再游泳
    {
      const L = await nc(() => window.__nc.boat.ladders());
      await nc((l) => { const n = window.__nc; n.tp(l.bot.x, l.bot.z, Math.atan2(l.top.x - l.bot.x, l.top.z - l.bot.z)); n.player.y = n.sea.SEA_Y; }, L[0]);
      await page.waitForTimeout(400);
      const l0 = await nc(() => !!window.__nc.player.swim);
      await page.keyboard.down('KeyW'); await page.waitForTimeout(1600); await page.keyboard.up('KeyW');
      await page.waitForTimeout(500);
      const l1 = await nc((l) => { const p = window.__nc.player; return { swim: !!p.swim, y: +p.y.toFixed(2), d: +Math.hypot(p.x - l.top.x, p.z - l.top.z).toFixed(1) }; }, L[0]);
      check(L.length >= 10 && l0 && !l1.swim && l1.y > 0 && l1.d < 3, `從梯子爬上岸（${L.length} 座梯子）${JSON.stringify(l1)}`);
    }
    // 灰鷗島的廢墟（tools/foot.mjs 量的佔地）：從東面拿掉一棟樓的缺口跑進圍起來的街道
    {
      await nc(() => { const n = window.__nc, R = n.sea.sites.ruin; n.walk(); n.tpL(R.x + 30, R.z + 1.2, -Math.PI / 2); });
      await page.waitForTimeout(300);
      await page.keyboard.down('ShiftLeft'); await page.keyboard.down('KeyW'); await page.waitForTimeout(3500); await page.keyboard.up('KeyW'); await page.keyboard.up('ShiftLeft');
      const ru = await nc(() => { const n = window.__nc, R = n.sea.sites.ruin, [x, z] = n.L(n.player.x, n.player.z); return { x: +(x - R.x).toFixed(1), z: +(z - R.z).toFixed(1), rects: n.sea.foot('ruin').length, office: n.sea.foot('office').length }; });
      check(ru.x < 17 && ru.rects > 50 && ru.office > 50, `從東面的缺口走進廢墟街區 ${JSON.stringify(ru)}`);
    }
    // 對岸步道（10-city.js 的 BANK_WALKS）：站得上去、不會游泳；往樓那邊走被高牆擋住；渡口停著船
    {
      const fw = [];
      for (const i of [0, 1]) {
        await nc((i) => { const n = window.__nc, B = n.sea.walks[i]; n.walk(); n.tpL((B.x0 + B.x1) / 2, (B.z0 + B.z1) / 2 + 30, i ? Math.PI / 2 : -Math.PI / 2); }, i);
        await page.waitForTimeout(300);
        await page.keyboard.down('KeyW'); await page.waitForTimeout(3000); await page.keyboard.up('KeyW');
        fw.push(await nc((i) => { const n = window.__nc, B = n.sea.walks[i], p = n.player, [x] = n.L(p.x, p.z); return { swim: !!p.swim, y: +p.y.toFixed(2), inside: x >= B.x0 - .1 && x <= B.x1 + .1, boat: n.boat.list().some(b => b.where === n.sea.ferry[i].name) }; }, i));
      }
      check(fw.every(f => !f.swim && f.y > .1 && f.inside && f.boat), `對岸步道走得上去、靠樓那側擋住、渡口有船 ${JSON.stringify(fw)}`);
    }
    // 北嶺公園（10-city.js 的 NPARK、21-park.js）：從樓牆的門走進去、在坡上貼著地、觀景台站在平台上、圍籬擋住、車被門口的路樁擋住
    {
      const run = async (ms) => { await page.keyboard.down('ShiftLeft'); await page.keyboard.down('KeyW'); await page.waitForTimeout(ms); await page.keyboard.up('KeyW'); await page.keyboard.up('ShiftLeft'); };
      const at = () => nc(() => { const n = window.__nc, p = n.player, [x, z] = n.L(p.x, p.z); return { x: +x.toFixed(1), z: +z.toFixed(1), y: +p.y.toFixed(2), h: +n.park.h(x, z).toFixed(2), swim: !!p.swim, d: n.park.district(p.x, p.z).split(' ')[0] }; });
      await nc(() => { const n = window.__nc; n.walk(); n.tpL(n.park.gx, n.park.z1 + 12, Math.PI); });
      await page.waitForTimeout(300); await run(5000);
      const gate = await at();
      await nc(() => { const n = window.__nc, P = n.park.trail[200]; n.tpL(P[0], P[1], Math.PI); });
      await page.waitForTimeout(300); await run(2500);
      const slope = await at();
      await nc(() => { const n = window.__nc, W = n.park.walk; n.tpL(W.x0 + 6, (W.z0 + W.z1) / 2, -Math.PI / 2); });
      await page.waitForTimeout(300); await run(3000);
      const fence = await at();
      await nc(() => { const n = window.__nc, L = n.park.look; n.tpL(L.cx, L.cz, 0); });
      await page.waitForTimeout(2200);   // 從坡上傳送過去，往上爬 0.8 m 以上是慢慢升（40-people.js 的 damp 4）
      const look = { ...(await at()), deck: await nc(() => window.__nc.park.look.h) };
      await nc(() => window.__nc.drive());
      await page.waitForFunction(() => window.__nc.player.veh, null, { timeout: 15000 });
      // 先修車：前面的撞擊累積下來，撞上路樁可能起火燒毀（68-wreck.js）
      await nc(() => { const n = window.__nc, v = n.player.veh, s = n.Ws(n.park.gx, n.park.z1 + 70, Math.PI); v.x = s.x; v.z = s.z; v.yaw = s.yaw; v.vx = v.vz = 0; if (n.gta.wreck) n.gta.wreck.fix(v); });
      await page.waitForTimeout(2400);   // 停 2 秒繫上安全帶（69-v3-crash.js），不然高速撞上路樁會飛出車外
      await page.keyboard.down('KeyW'); await page.waitForTimeout(4500); await page.keyboard.up('KeyW');
      const car = await nc(() => { const n = window.__nc, v = n.player.veh, [, z] = n.L(v.x, v.z); return +z.toFixed(1); });
      await nc(() => window.__nc.walk());
      const pk = { gate, slope, fence, look, car };
      const W0 = await nc(() => window.__nc.park.walk.x0), Z1 = await nc(() => window.__nc.park.z1);
      check(gate.z < Z1 && gate.d === '北嶺公園' && !gate.swim && slope.y > 5 && Math.abs(slope.y - slope.h) < .3 && fence.x > W0 && Math.abs(look.y - look.deck) < .05 && car > Z1 + 40,
        `北嶺公園：走進門、坡上貼地、圍籬擋住、觀景台平台、車擋在門口 ${JSON.stringify(pk)}`);
    }
    // 北嶺鐵道橋（10-city.js 的 VIADUCT、20-walk.js、21-rail.js）：圍籬圈進來；橋面走得上去、護欄擋住，橋下的谷底是另一層、橋墩擋住；
    // 從平台走進隧道、洞底擋住、相機在洞裡；列車整列在橋上時五節都在、在洞底時藏起來；站在軌道上被列車撞倒但留在橋面；夜裡有燈
    {
      const run = async (ms, yaw) => { if (yaw != null) await nc((y) => { const n = window.__nc, p = n.player, w = n.Ws(...n.L(p.x, p.z), y).yaw; p.yaw = w; n.look(w, .1, 0); }, yaw); await page.keyboard.down('ShiftLeft'); await page.keyboard.down('KeyW'); await page.waitForTimeout(ms); await page.keyboard.up('KeyW'); await page.keyboard.up('ShiftLeft'); };
      const at = () => nc(() => { const n = window.__nc, p = n.player, V = n.props.viaduct, [x, z] = n.L(p.x, p.z), o = Math.max(...V.ends.map(e => V.frame(e, x, z)[0])); return { x: +x.toFixed(1), z: +z.toFixed(1), y: +p.y.toFixed(2), deck: +V.deck.toFixed(2), dz: +(z - V.zc(x)).toFixed(2), o: +o.toFixed(1), cam: +n.camera.position.y.toFixed(2), down: p.down > 0, d: n.park.district(p.x, p.z).split(' ')[0] }; });
      await nc(() => { const n = window.__nc, V = n.props.viaduct; n.walk(); n.props.rail.hold(); n.tpL(V.x - 40, V.zc(V.x - 40), Math.PI / 2); n.player.y = V.deck; });
      await page.waitForTimeout(300); await run(2000, Math.PI / 2);
      const deck = await at();
      await run(2500, Math.PI);
      const rail = await at();
      await nc(() => { const n = window.__nc, V = n.props.viaduct, p = V.piers[1]; n.tpL((p.x0 + p.x1) / 2, p.z1 + 10, Math.PI); });
      await page.waitForTimeout(2500); await run(4000, Math.PI);
      const pier = { ...(await at()), z1: await nc(() => window.__nc.props.viaduct.piers[1].z1) };
      await nc(() => { const n = window.__nc, V = n.props.viaduct, e = V.ends[0]; n.tpL(e.x + e.ux * 10, e.z + e.uz * 10, Math.atan2(e.ux, e.uz)); });
      await page.waitForTimeout(1500); await run(14000, await nc(() => { const e = window.__nc.props.viaduct.ends[0]; return Math.atan2(e.ux, e.uz); }));
      const bore = { ...(await at()), A: await nc(() => window.__nc.props.viaduct.A), B: await nc(() => window.__nc.props.viaduct.BORE) };
      const vis = await nc(async () => {
        const n = window.__nc, R = n.props.rail.R, on = () => R.cars.filter(c => c.on && c.obj.visible).length;
        n.props.rail.go(1, R.len / 2 + 60); R.speed = 0; await new Promise(r => setTimeout(r, 300)); const mid = on();
        n.props.rail.go(1, 0); await new Promise(r => setTimeout(r, 300)); const hid = on();
        return { mid, hid, lights: R.lights };
      });
      // 撞人：站在橋中間的軌道上，列車從西邊 40 m 外開過來
      await nc(() => { const n = window.__nc, V = n.props.viaduct, R = n.props.rail.R; n.tpL(V.x, V.zc(V.x), -Math.PI / 2); n.player.y = V.deck; n.gta.life && (n.gta.life.hp = 100); let s = 0; for (; s < R.len && R.at(s)[0] < V.x; s += .5); n.props.rail.go(1, s - 40); R.speed = 17; });
      let hit = null;
      for (let i = 0; i < 30 && !(hit && hit.down); i++) { await page.waitForTimeout(150); hit = await at(); }
      await page.waitForTimeout(2600); const after = await at();
      await nc(() => { const n = window.__nc; n.props.rail.R.speed = 17; n.props.rail.R.state = 'wait'; n.props.rail.R.tw = 30; n.tpL(n.park.look.cx, n.park.look.cz, 0); });
      const rk = { deck, rail, pier, bore, vis, hit, after };
      check(deck.d === '北嶺鐵道橋' && Math.abs(deck.y - deck.deck) < .05 && deck.x > -40 + 5 && Math.abs(rail.dz) <= 4.5 && Math.abs(rail.y - rail.deck) < .05 && pier.y < pier.deck - 30 && pier.z > pier.z1 && pier.z < pier.z1 + 2
        && bore.o > bore.A + 20 && bore.o < bore.A + bore.B && Math.abs(bore.y - bore.deck) < .05 && bore.cam < bore.deck + 6.2 && vis.mid === 5 && vis.hid === 0 && vis.lights >= 40
        && hit && hit.down && Math.abs(after.y - after.deck) < .3 && Math.abs(after.dz) <= 4.5,
        `北嶺鐵道橋：橋面、護欄、谷底與橋墩、隧道、列車進出洞、撞人留在橋面、夜燈 ${JSON.stringify(rk)}`);
    }
    // 光格島（21-tron.js）：以檔案開啟沒有近景可以下載，不擺島上的碼頭與遊艇（上岸、騎光速機車的驗收在 glb-check.mjs，要 http）
    {
      const tr = await nc(() => { const n = window.__nc; return { T: n.props.tron.T, boat: n.boat.list().some(o => o.where === '光格島') }; });
      check(tr.T === null && !tr.boat, `光格島以檔案開啟只有遠景替身 ${JSON.stringify(tr)}`);
    }
    // 遊艇（31-boats.js）：上船、開出去有航跡、下船後回到水裡游泳或岸上
    {
      const b0 = await nc(() => { const n = window.__nc, b = n.boat; n.time(780); const name = b.board(0), v = n.player.veh; return { name, boat: !!(v && v.boat), x: v.x, z: v.z, n: b.boats.length }; });
      await page.keyboard.down('KeyW'); await page.waitForTimeout(3000); await page.keyboard.up('KeyW');
      const b1 = await nc((b) => { const n = window.__nc, v = n.player.veh; return { d: +Math.hypot(v.x - b.x, v.z - b.z).toFixed(1), y: +(v.y - n.sea.SEA_Y).toFixed(2), wake: n.boat.wake() }; }, b0);
      check(b0.boat && b0.n >= 4 && b1.d > 12 && Math.abs(b1.y) < 1 && b1.wake > 5, `開遊艇 ${b0.name}：${JSON.stringify(b1)}`);
      await shot(page, 'd-boat');
      await nc(() => window.__nc.walk());
      await page.waitForTimeout(400);
      const b2 = await nc(() => { const n = window.__nc, p = n.player; return { mode: p.mode, swim: !!p.swim, y: +p.y.toFixed(2), left: n.boat.list()[0].drive }; });
      check(b2.mode === 'walk' && !b2.left && (b2.swim || b2.y >= 0), `下船 ${JSON.stringify(b2)}`);
      await nc(() => window.__nc.boat.reset(0));
    }
    // 錨灣港（21-coast.js）：貨櫃船靠港→離港→出海，集卡在岸橋與堆場之間跑
    {
      const h = await nc(() => { const n = window.__nc, b = n.boat, T = b.SHIP_T, r = b.harbor.root, s = {};
        n.tpL(560, 936, 0);
        for (const [k, t] of [['dock', 30], ['push', T.dock + 20], ['turn', T.dock + T.push + 20], ['sail', T.dock + T.push + T.turn + 60]]) { s[k] = b.shipAt(t); n.step(1 / 30); s[k + 'X'] = Math.round(r.position.x); s[k + 'Z'] = Math.round(r.position.z); }
        b.shipAt(10); n.step(1 / 30); return s; });
      const moved = Math.hypot(h.sailX - h.dockX, h.sailZ - h.dockZ);
      check(h.dock === 'dock' && h.push === 'push' && h.turn === 'turn' && h.sail === 'sail' && moved > 60, `貨櫃船靠港→離港→轉向→出海（移動 ${moved.toFixed(0)} m）${JSON.stringify(h)}`);
      const t0 = await nc(() => window.__nc.boat.trucks());
      await page.waitForTimeout(2500);
      const t1 = await nc(() => window.__nc.boat.trucks());
      check(t0.length === 3 && t1.some((t, i) => Math.abs(t.s - t0[i].s) > 2), `集卡在港區行駛 ${JSON.stringify(t1)}`);
    }
    // 區與區之間的縫（20-props.js 的 SEAM_PATH／SEAM_SITES）：碎石步道、涼亭、小賣亭、公廁
    {
      const sm = await nc(() => { const s = window.__nc.seam; return { runs: s.path.length, pts: s.path.reduce((a, r) => a + r.length, 0), sites: s.sites.length, kinds: [...new Set(s.sites.map(x => x.type))].length }; });
      check(sm.runs >= 2 && sm.pts > 30 && sm.sites >= 6 && sm.kinds === 3, `接縫步道與小建築 ${JSON.stringify(sm)}`);
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

    // 第五階段（69-side／race／street／turf／survival／tale）：每項走完一次，最後重新載入確認 motors.side 存得住
    {
      const W = ms => page.waitForTimeout(ms);
      const reset = () => nc(() => { const g = window.__nc.gta; g.wanted.clear('reset'); g.squad.clear(); g.ev.end(); g.side.end(); g.god.on = true; window.__nc.closeDialog(); });
      const banner = () => nc(() => document.querySelector('#heistDone b').textContent + ' ' + document.getElementById('hpRows').textContent);
      await reset();
      // 街頭賽：開車停進起點 → 報名 → 一路跳檢查點
      const rs = await nc(() => { const nc = window.__nc, G = nc.gta.race.geo('neon'); nc.drive(); const v = nc.player.veh; v.x = G.start[0]; v.z = G.start[1]; v.vx = v.vz = 0; return nc.gta.race.start('neon'); });
      await W(4200);
      for (let i = 0; i < 40 && await nc(() => !!window.__nc.gta.race.act()); i++) { await nc(() => window.__nc.gta.race.skip()); await W(250); }
      const rb = await banner();
      check(rs !== false && /RACE WON|FINISHED/.test(rb), `街頭賽跑完一場：${rb}`);
      await nc(() => window.__nc.walk && window.__nc.walk());
      await reset();
      // 街頭事件：搶包賊打倒掉包、撿包選「還給失主」；逃犯車打到熄火後逮捕
      const th = await nc(() => window.__nc.gta.ev.street('thief'));
      await W(600);
      const dn = await nc(() => window.__nc.gta.ev.down());
      await W(300);
      await nc(() => { const nc = window.__nc, b = nc.gta.ev.ev.cur.bag; nc.tp(b.x, b.z); });
      await W(500);
      const dlg = await nc(() => document.getElementById('dialog').classList.contains('on') && document.getElementById('dlgOpts').textContent);
      await nc(() => document.querySelector('#dlgOpts button').click());
      check(th && dn && /還給失主/.test(dlg || '') && await nc(() => !window.__nc.gta.ev.ev.cur), `搶包賊：打倒、撿包、還給失主 ${JSON.stringify({ th, dn, dlg })}`);
      const bo = await nc(() => window.__nc.gta.ev.street('bounty'));
      await W(800);
      await nc(() => { const e = window.__nc.gta.ev.ev.cur; e.v.hp = e.v.hp0 * .2; });
      await W(1500);
      await nc(() => { const nc = window.__nc, v = nc.gta.ev.ev.cur.v; nc.tp(v.x + 3.5, v.z); });
      await W(600);
      const bb = await banner();
      check(bo && /BOUNTY/.test(bb) && await nc(() => !window.__nc.gta.ev.ev.cur), `懸賞逃犯車：熄火後逮捕 ${bb}`);
      await reset();
      // 幫派地盤：據點的人站著聊天 → 被看到開戰 → 三波打完搶下 → 反攻守住
      await nc(() => { const a = window.__nc.gta.turf.at('maple'); window.__nc.tp(a.x + 70, a.z + 20); });
      await W(1200);
      const calm = await nc(() => window.__nc.gta.squad.SQ.f.filter(f => f.on && f.calm).length);
      await nc(() => { const a = window.__nc.gta.turf.at('maple'), p = window.__nc.player; p.x = a.x + 12; p.z = a.z + 2; });
      await W(1200);
      const war = await nc(() => { const a = window.__nc.gta.turf.act(); return a && a.name; });
      for (let w = 0; w < 3; w++) { await nc(() => window.__nc.gta.turf.wipe()); await W(4200); }
      const tb = await banner(), own = await nc(() => window.__nc.gta.turf.owned());
      check(calm === 5 && war === '地盤戰' && /TURF TAKEN/.test(tb) && own.includes('maple'), `幫派地盤：據點五人、開戰、搶下楓林里 ${JSON.stringify({ calm, war, own })}`);
      await nc(() => window.__nc.gta.turf.start('maple', true));
      await W(800);
      for (let w = 0; w < 2; w++) { await nc(() => window.__nc.gta.turf.wipe()); await W(4200); }
      const hb = await banner();
      check(/TURF HELD/.test(hb) && (await nc(() => window.__nc.gta.turf.owned())).includes('maple'), `幫派地盤：反攻守住 ${hb}`);
      // 地盤影響街頭：赤蠍幫的地盤（琥珀工業區）路人少、街角有盯梢的，7 m 外不動手、靠近就動手；搶下來的楓林里沒有
      await reset();
      await nc(() => window.__nc.tpL(-180 + 14 * 72 + 10.4, -155 + 8 * 62 + 30, 0));
      await W(400);
      const lk = await nc(() => { const t = window.__nc.gta.turf; return { here: t.here() && t.here().id, share: t.share(), n: t.lurk() }; });
      await nc(() => { const nc = window.__nc, g = nc.gta.turf.lurkG(), f = g && nc.gta.squad.SQ.f.find((f) => f.on && f.grp === g); if (f) nc.tp(f.x + 10, f.z); });
      await W(900);
      const lk1 = await nc(() => { const g = window.__nc.gta.turf.lurkG(); return !!(g && !g.awake); });
      await nc(() => { const nc = window.__nc, g = nc.gta.turf.lurkG(), f = g && nc.gta.squad.SQ.f.find((f) => f.on && f.grp === g); if (f) nc.tp(f.x + 4, f.z); });
      await W(700);
      const lk2 = await nc(() => { const g = window.__nc.gta.turf.lurkG(); return !!(g && g.awake); });
      await reset();
      await nc(() => window.__nc.tpL(-180 + 2 * 72 + 10.4, -155 + 8 * 62 + 30, 0));
      await W(400);
      const lk3 = await nc(() => { const t = window.__nc.gta.turf; return { here: t.here() && t.here().id, share: t.share(), n: t.lurk() }; });
      check(lk.here === 'amber' && lk.share < 1 && lk.n >= 2 && lk1 && lk2 && lk3.here === 'maple' && lk3.share === 1 && !lk3.n, `地盤影響街頭：盯梢與路人密度 ${JSON.stringify({ lk, lk1, lk2, lk3 })}`);
      await reset();
      // 生存模式：霓虹圈按 E → 開始 → 清一波 → 走出貨場結算
      await nc(() => { const s = window.__nc.gta.surv.at().s; window.__nc.tp(s.x, s.z); });
      await W(400);
      const sc = await nc(() => window.__nc.ctx());
      await nc(() => window.__nc.act());
      await W(200);
      await nc(() => document.querySelector('#dlgOpts button').click());
      await W(9000);
      await nc(() => window.__nc.gta.surv.wipe());
      await W(800);
      const sv = await nc(() => { const a = window.__nc.gta.surv.act(); return a && { wave: a.wave, cleared: a.cleared, pay: a.pay }; });
      await nc(() => { window.__nc.player.x += 120; });
      await W(600);
      const sb = await banner();
      check(/生存模式/.test(sc) && sv && sv.cleared >= 1 && /SURVIVAL/.test(sb), `生存模式：撐過一波、走出貨場結算 ${JSON.stringify(sv)} ${sb}`);
      // 其他擂台：灰石圍城直接跳到第 5 波，有開車來的打手與幫派直升機（不報警），清空後紀錄存在 svb
      await nc(() => { const S = window.__nc.gta.surv, s = S.at('grey').s; window.__nc.gta.god.on = true; window.__nc.tp(s.x, s.z); S.start('grey'); S.wave(5); });
      await W(1500);
      const sg = await nc(() => { const g = window.__nc.gta, a = g.surv.act(), h = g.wanted.W.heli; return a && { arenas: g.surv.SURVS.length, w: a.wave, car: g.squad.SQ.cars.some((c) => c.grp === a && c.go), heli: !!(h && h.gang && h === a.heli), stars: g.wanted.W.stars }; });
      await nc(() => window.__nc.gta.surv.wipe());
      await W(800);
      const sg2 = await nc(() => { const a = window.__nc.gta.surv.act(); return { cl: a && a.cleared, rec: window.__nc.motors.side.svb.grey }; });
      await nc(() => { window.__nc.player.x += 120; window.__nc.gta.god.on = false; });
      await W(600);
      check(sg && sg.arenas === 3 && sg.w === 5 && sg.car && sg.heli && !sg.stars && sg2.cl === 5 && sg2.rec === 5, `生存模式第二座擂台：增援車、幫派直升機、紀錄 ${JSON.stringify({ sg, sg2 })}`);
      await reset();
      // 支線委託：找奧斯卡接第一段（打架）、米卡接第一段（撿畫稿）
      const tl = [];
      for (const id of ['oskar', 'mika']) {
        await nc((id) => { const P = window.__nc.gta.tale.at(id); window.__nc.tp(P.x + 1.2, P.z + (id === 'oskar' ? 1 : -1)); }, id);
        await W(300);
        const c = await nc(() => window.__nc.ctx());
        await nc(() => window.__nc.act());
        await W(200);
        const talk = await nc(() => window.__nc.gta.tale.cine() === 'talk' && document.body.classList.contains('cine'));
        await nc(() => document.querySelector('#dlgOpts button').click());
        await W(400);
        const ty = await nc(() => { const a = window.__nc.gta.tale.act(); return a && a.S.type; });
        const pr = await nc(() => window.__nc.gta.tale.probe());
        await nc(() => window.__nc.gta.tale.skip());
        await W(700);
        // 完成：委託人打電話來，上下黑邊、字幕逐句播；播完才跳結算畫面
        const call = await nc(() => window.__nc.gta.tale.cine() === 'call' && /📞/.test(document.getElementById('cineSub').textContent));
        await nc(() => { const t = window.__nc.gta.tale; for (let i = 0; i < 9 && t.cine() === 'call'; i++) t.next(); });
        await W(200);
        const banner = await nc(() => !window.__nc.gta.tale.cine() && !document.body.classList.contains('cine') && document.getElementById('heistDone').classList.contains('on'));
        tl.push({ c: c.replace(/<[^>]+>/g, ''), ty, talk, call, banner, items: pr.every(q => q.push < .05), stage: await nc((id) => window.__nc.gta.tale.stage(id), id) });
      }
      check(tl.every(t => t.ty && t.items && t.talk && t.call && t.banner && t.stage === 1), `支線委託：聽委託的側拍、接下、完成第一段、電話過場後結算 ${JSON.stringify(tl)}`);
      // 第四段跟蹤：靠近 70 m 內目標車上路，跟太近疑心會漲；開到終點完成，最後一段的結算是 STORY COMPLETE
      await nc(() => { const t = window.__nc.gta.tale; t.start('oskar', 3); const v = t.act().tk.v; window.__nc.tp(v.x + 15, v.z + 4); });
      await W(1500);
      const tk = await nc(() => { const a = window.__nc.gta.tale.act(); return a && { ty: a.S.type, st: a.tk.state, sus: a.sus, hud: document.getElementById('obj').textContent }; });
      await nc(() => window.__nc.gta.tale.skip());
      await W(600);
      await nc(() => { const t = window.__nc.gta.tale; for (let i = 0; i < 9 && t.cine() === 'call'; i++) t.next(); });
      await W(200);
      const tk2 = await nc(() => ({ stage: window.__nc.gta.tale.stage('oskar'), done: document.querySelector('#heistDone b').textContent, act: !!window.__nc.gta.tale.act() }));
      check(tk && tk.ty === 'tail' && tk.st === 'drive' && tk.sus > 0 && tk2.stage === 4 && tk2.done === 'STORY COMPLETE' && !tk2.act, `支線委託第四段：跟蹤目標車 ${JSON.stringify({ tk, tk2 })}`);
      // 存檔第 6 版：重新載入後街頭賽、地盤、生存、委託的進度都還在
      const side0 = await nc(() => JSON.stringify(window.__nc.motors.side));
      await page.reload();
      await page.waitForFunction(() => window.__nc && window.__nc.ready, null, { timeout: 60000 });
      await nc(() => window.__nc.start());
      await W(800);
      const side1 = await nc(() => JSON.stringify(window.__nc.motors.side));
      check(side0 === side1 && /maple/.test(side1) && /"oskar":4/.test(side1), `存檔第 6 版 motors.side 重新載入後一樣 ${side1}`);
    }

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
