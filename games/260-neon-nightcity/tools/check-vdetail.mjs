// 車輛細節（68-vdetail.js）的驗收：短按／長按 F 下車（長按不熄火、回來直接開、走遠自己熄）、原地燒胎與甜甜圈、彈射起步、
// 濕沙卡軸與前後搖出來、開進海裡泡水熄火、沉車逼玩家下車游泳、叫車送來修好的車
// 用法：node tools/check-vdetail.mjs [html]（預設 web/260-neon-nightcity.html）
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { open } from './lib.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const htmlPath = resolve(process.argv[2] || resolve(root, '../../web/260-neon-nightcity.html'));
let failed = 0;
function check(cond, msg) { console.log(`  ${cond ? '✓' : '✗'} ${msg}`); if (!cond) failed++; }
const { browser, page, log } = await open(htmlPath, { w: 1280, h: 800 });
async function sec(title, fn, arg) {
  console.log(title);
  try { return await page.evaluate(fn, arg); } catch (e) { check(false, `執行失敗：${String(e.message || e).split('\n')[0]}`); return null; }
}
await page.evaluate(() => {
  window.__t = {
    step(n) { for (let i = 0; i < n; i++) window.__nc.step(1 / 60); },
    keys(o) { const K = window.__nc.keys; for (const k of ['KeyW', 'KeyS', 'KeyA', 'KeyD', 'Space', 'KeyF']) K[k] = !!o[k]; },
    // 沙灘上的位置（照驗收下水那一段的 x，避開棧橋）：d 是從岸邊量起的距離，車頭朝海
    // open：沿沙灘找半徑 open 公尺內沒有陽傘、救生台這些碰撞物的地方（甜甜圈的車尾甩得開）
    beach(d, v0 = 0, open = 0) {
      const N = window.__nc, B = N.sea.BEACH, x0 = (B.x0 + B.x1) / 2 + 40;
      let s = N.Ws(x0, B.z0 + d, 0);
      for (let k = 0; open && k < 40; k++) {
        const t = N.Ws(x0 + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 12, B.z0 + d, 0), o = N.col.collide(t.x, t.z, open);
        if (Math.hypot(o.x - t.x, o.z - t.z) < .01) { s = t; break; }
      }
      N.drive(); const v = N.player.veh;
      N.gta.wreck.fix(v);
      this.yaw0 = s.yaw; v.x = s.x; v.z = s.z; v.yaw = s.yaw; v.vx = Math.sin(s.yaw) * v0; v.vz = Math.cos(s.yaw) * v0; v.y = N.sea.floor(s.x, s.z); v.yr = 0;
      return v;
    },
  };
});

try {
  const f = await sec('短按／長按 F', () => {
    const N = window.__nc, T = window.__t, vd = N.gta.vd, o = {};
    const v = T.beach(10); T.keys({}); T.step(10);
    // 短按：按下馬上放開，下一幀下車、大燈熄
    vd.keyF(); T.keys({}); T.step(2);
    o.tap = { mode: N.player.mode, lights: v.lights, idle: !!vd.st.idle };
    // 長按：按住過 VD_HOLD_T 才下車，大燈亮著、引擎沒熄
    N.drive(); T.step(2); vd.keyF(); T.keys({ KeyF: true }); T.step(10);
    o.mid = N.player.mode;
    T.step(30); T.keys({});
    o.hold = { mode: N.player.mode, lights: v.lights, idle: vd.st.idle === v };
    T.step(60);
    // 回來上車：沒熄火的車直接開
    N.drive(); o.back = { idle: !!vd.st.idle, lights: v.lights };
    // 再長按下車然後走遠：自己熄掉
    vd.keyF(); T.keys({ KeyF: true }); T.step(40); T.keys({});
    N.player.x += 80; T.step(3);
    o.far = { idle: !!vd.st.idle, lights: v.lights };
    return o;
  });
  if (f) {
    check(f.tap.mode === 'walk' && f.tap.lights === 0 && !f.tap.idle, `短按 F：下車熄火 ${JSON.stringify(f.tap)}`);
    check(f.mid === 'drive' && f.hold.mode === 'walk' && f.hold.lights === 1 && f.hold.idle, `長按 F：按滿才下車、大燈亮著、引擎沒熄 ${JSON.stringify(f.hold)}`);
    check(!f.back.idle && f.back.lights === 1, `回到沒熄火的車上直接開 ${JSON.stringify(f.back)}`);
    check(!f.far.idle && f.far.lights === 0, `走遠超過 60 m 引擎自己熄掉 ${JSON.stringify(f.far)}`);
  }

  const b = await sec('原地燒胎、甜甜圈、彈射起步', () => {
    const N = window.__nc, T = window.__t, vd = N.gta.vd, o = {};
    // 附近有一台在開的 AI 警車（AI 的車也走 driveVehicle，不能把玩家的燒胎計時歸零）
    N.gta.wanted.set(1); const v = T.beach(14, 0, 6), u = N.gta.wanted.unit('car', { x: v.x + 30, z: v.z, yaw: 0 }); T.keys({}); T.step(20);
    o.ai = !!u;
    const x0 = v.x, z0 = v.z, n0 = N.gta.state ? 0 : 0;
    T.keys({ KeyW: true, Space: true }); T.step(60);
    o.burn = { on: v.burnout, moved: +Math.hypot(v.x - x0, v.z - z0).toFixed(2), slip: v.slip, rpm: v.rpm };
    // 打方向：繞前軸甩，前軸那一點不太動
    const fa = () => [v.x + Math.sin(v.yaw) * v.wb / 2, v.z + Math.cos(v.yaw) * v.wb / 2], a0 = fa(), y0 = v.yaw;
    T.keys({ KeyW: true, Space: true, KeyA: true }); T.step(330);
    const a1 = fa();
    o.donut = { n: vd.st.donut, axle: +Math.hypot(a1[0] - a0[0], a1[1] - a0[1]).toFixed(2), turned: +Math.abs(v.yaw - y0).toFixed(1), sp: +Math.hypot(v.vx, v.vz).toFixed(1) };
    // 車頭轉回朝海（前面是空的沙灘），直線燒一下再放手煞、油門不放：彈射
    v.yaw = T.yaw0; v.yr = 0; T.keys({ KeyW: true, Space: true }); T.step(30);
    T.keys({ KeyW: true }); T.step(2);
    o.launch = +Math.hypot(v.vx, v.vz).toFixed(1);
    T.keys({}); T.step(120);
    N.gta.wanted.clear('reset');
    return o;
  });
  if (b) {
    check(b.ai, '旁邊有 AI 警車在開');
    check(b.burn.on === 1 && b.burn.moved < .3 && b.burn.slip >= 6 && b.burn.rpm > .9, `手煞＋油門：原地燒胎、輪胎打滑、轉速拉高 ${JSON.stringify(b.burn)}`);
    check(b.donut.n >= 1 && b.donut.axle < .3 && b.donut.turned > 6.3 && b.donut.sp < 5, `打方向甩甜甜圈（繞前軸、計圈） ${JSON.stringify(b.donut)}`);
    check(b.launch >= 6.5, `燒胎後放手煞彈射起步（${b.launch} m/s）`);
  }

  const s = await sec('濕沙卡軸', () => {
    const N = window.__nc, T = window.__t, vd = N.gta.vd, o = {};
    // 乾沙上起步不會陷
    let v = T.beach(15); T.keys({ KeyW: true }); T.step(120);
    o.dry = { stuck: !!v.stuck, kmh: +(Math.hypot(v.vx, v.vz) * 3.6).toFixed(0) };
    // 濕沙上停著催油：陷進去，輪子空轉、車不走
    v = T.beach(40); T.keys({ KeyW: true }); T.step(120);
    const x0 = v.x, z0 = v.z; T.step(120);
    o.wet = { stuck: !!v.stuck, moved: +Math.hypot(v.x - x0, v.z - z0).toFixed(2), slip: v.slip };
    // 前後交替三次：搖出來
    for (const k of ['KeyS', 'KeyW', 'KeyS']) { T.keys({ [k]: true }); T.step(20); }
    o.free = { stuck: !!v.stuck, sp: +Math.hypot(v.vx, v.vz).toFixed(1) };
    // 帶速度衝過濕沙不會陷
    v = T.beach(30, 14); T.keys({ KeyW: true }); T.step(150);
    o.fast = { stuck: !!v.stuck, d: +vd.beach(v.x, v.z).toFixed(0) };
    T.keys({});
    return o;
  });
  if (s) {
    check(!s.dry.stuck && s.dry.kmh > 20, `乾沙上起步不會陷 ${JSON.stringify(s.dry)}`);
    check(s.wet.stuck && s.wet.moved < .6 && s.wet.slip >= 6, `濕沙上停著催油：陷進去、輪子空轉 ${JSON.stringify(s.wet)}`);
    check(!s.free.stuck && s.free.sp > 2, `前後交替三次搖出來 ${JSON.stringify(s.free)}`);
    check(!s.fast.stuck && s.fast.d > 56, `帶速度衝過濕沙 ${JSON.stringify(s.fast)}`);
  }

  const w = await sec('泡水與沉車', () => {
    const N = window.__nc, T = window.__t, vd = N.gta.vd, o = {};
    // 從乾沙衝進海裡：水的阻力、引擎進水熄火、沉到水深過車廂就被逼下車
    const v = T.beach(20, 16); T.keys({ KeyW: true });
    let fl = null, sp48 = 0;
    for (let i = 0; i < 900 && N.player.mode === 'drive'; i++) {
      T.step(1);
      const d = vd.beach(v.x, v.z);
      if (!sp48 && d > 48) sp48 = Math.hypot(v.vx, v.vz);
      if (!fl && v.flood) fl = { d: +N.sea.depth(v.x, v.z).toFixed(2), lights: v.lights };
    }
    T.keys({});
    o.sp48 = +sp48.toFixed(1); o.flood = fl; o.mode = N.player.mode; o.depth = +N.sea.depth(v.x, v.z).toFixed(2);
    T.step(120);
    o.wade = { py: +(N.player.y - N.sea.SEA_Y).toFixed(2), swim: !!N.player.swim };
    // 泡水的車回去開不動
    N.drive(); T.keys({ KeyW: true }); const x0 = v.x, z0 = v.z; T.step(60); T.keys({});
    o.dead = { moved: +Math.hypot(v.x - x0, v.z - z0).toFixed(2), lights: v.lights };
    N.walk();
    // 直接停進更深的海裡（水深 1.4 m）：馬上進水，被逼下車後浮上來游泳
    const v2 = T.beach(88); T.keys({}); T.step(150);
    o.deep = { flood: v2.flood || 0, mode: N.player.mode, swim: !!N.player.swim, py: +(N.player.y - N.sea.SEA_Y).toFixed(2), depth: +N.sea.depth(v2.x, v2.z).toFixed(2) };
    T.step(60);
    // 叫車：送來修好的車
    N.tpL(window.__nc.sea.BEACH.x0 + 400, window.__nc.sea.BEACH.z0 - 60, 0); T.step(5);
    vd.summon(); o.fixed = { flood: v.flood || 0, mode: N.player.mode, lights: v.lights };
    N.walk();
    return o;
  });
  if (w) {
    check(w.flood && w.flood.d >= .45 && w.flood.lights === 0, `開進海裡：水深 ${w.flood?.d} m 時引擎進水熄火、大燈熄`);
    check(w.mode === 'walk' && w.depth >= 1 && w.wade.py > -1.6, `滑到水深 ${w.depth} m 停下：車廂進水、被逼下車站在水裡 ${JSON.stringify(w.wade)}`);
    check(w.deep.flood && w.deep.mode === 'walk' && w.deep.swim && Math.abs(w.deep.py) < .4, `停進水深 ${w.deep.depth} m 的海裡：被逼下車、浮上來游泳 ${JSON.stringify(w.deep)}`);
    check(w.dead.moved < .3 && w.dead.lights === 0, `泡水的車發不動 ${JSON.stringify(w.dead)}`);
    check(w.fixed.flood === 0 && w.fixed.mode === 'drive' && w.fixed.lights === 1, `V 叫車：送來修好的車 ${JSON.stringify(w.fixed)}`);
  }
  check(log.pageerrors.length === 0, `沒有頁面錯誤 ${log.pageerrors.slice(0, 3).join(' | ')}`);
} finally {
  await browser.close();
}
console.log(failed ? `\n${failed} 項沒過` : '\n全部通過');
process.exit(failed ? 1 : 0);
