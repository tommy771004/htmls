// 人物外型、動作與群體檢視及效能量測工具（一次只開一個無頭 Chrome）
// 用法：node tools/people-check.mjs [before|after] [--webgpu]
import { chromePath, GPU_ARGS, SOFT_ARGS, toUrl, raf } from './lib.mjs';
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const argsIn = process.argv.slice(2);
const useWebGPU = argsIn.includes('--webgpu');
const quickOnly = argsIn.includes('--quick');
const tag = argsIn.find(a => !a.startsWith('--')) || 'after';
const outDir = resolve(root, '.cache/agy-people', tag);
mkdirSync(outDir, { recursive: true });

const htmlPath = resolve(root, '../../web/260-neon-nightcity.html');

async function openWithLog(url) {
  let lastErr;
  for (const args of [GPU_ARGS, SOFT_ARGS]) {
    const launchArgs = useWebGPU ? [...args, '--enable-unsafe-webgpu'] : args;
    const browser = await chromium.launch({ headless: true, args: launchArgs, executablePath: chromePath() });
    const log = { errors: [], warns: [], pageerrors: [], gpu: args === GPU_ARGS ? 'metal' : 'swiftshader' };
    try {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
      const page = await ctx.newPage();
      page.on('pageerror', (e) => {
        const msg = String(e.stack || e.message || e);
        log.pageerrors.push(msg);
        console.error('[PAGEERROR]', msg);
      });
      page.on('console', (m) => {
        if (m.type() === 'error') {
          log.errors.push(m.text());
          console.error('[CONSOLE.ERROR]', m.text());
        }
        if (m.type() === 'warning') log.warns.push(m.text());
      });
      // file:// 非安全來源無 navigator.gpu，WebGPURenderer 走 WebGL2 後端（webgpu-gl）
      const q = useWebGPU ? '?gfx=webgpu-gl&gpu=high&civ=0&story=0' : '?gpu=high&civ=0&story=0';
      await page.goto(toUrl(url) + q, { waitUntil: 'load', timeout: 60000 });
      await page.waitForFunction(() => window.__nc && window.__nc.ready, null, { timeout: 35000 });
      return { browser, page, log };
    } catch (e) {
      lastErr = e;
      console.error(`[BOOT FAILED on ${log.gpu}]`, e.message);
      await browser.close();
      if (log.pageerrors.length || log.errors.length) throw e;
    }
  }
  throw lastErr;
}

const { browser, page, log } = await openWithLog(htmlPath);

await page.evaluate(() => {
  __nc.start();
  __nc.menu.set('res', '1080p');
});
await page.waitForTimeout(600);
await raf(page);

if (quickOnly) {
  await raf(page, 6);
  const gfxCheck = await page.evaluate(() => ({
    err: __nc.gfx?.err ? __nc.gfx.err() : [],
    clash: __nc.gfx?.clash ? __nc.gfx.clash() : [],
    miss: __nc.gfx?.miss ? __nc.gfx.miss() : [],
    auto: __nc.gfx?.auto ? __nc.gfx.auto() : [],
  }));
  console.log('QUICK GFX CHECK:', JSON.stringify({ pageerrors: log.pageerrors, errors: log.errors, gfxCheck }, null, 2));
  await browser.close();
  if (log.pageerrors.length || log.errors.length || gfxCheck.clash.length) process.exit(1);
  const charErr = (gfxCheck.err || []).filter(e => String(e).includes('char'));
  if (charErr.length) { console.error('CHAR TSL ERROR:', charErr); process.exit(1); }
  process.exit(0);
}

// 在頁面內建立可重現的展示人群與輔助函式（不消耗遊戲原本的 rnd / rP）
await page.evaluate(() => {
  function rng32(seed) {
    let s = seed >>> 0;
    return () => {
      s += 0x6D2B79F5;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const clearStreet = () => {
    __nc.traffic.length = 0;
    __nc.parked.length = 0;
    for (const v of __nc.vehicles) v.g.visible = false;
  };
  window.__pchk = { rng32, clearStreet, groups: [] };
});

async function snap(name, setupFn) {
  await page.evaluate(setupFn);
  await page.waitForTimeout(350);
  await raf(page);
  const file = resolve(outDir, name);
  await page.screenshot({ path: file });
  console.log('saved', file);
}

// 1. 白天全身排排站（8 人：體型、高矮胖瘦、衣服層次、褲鞋分界、髮型與配色）
await snap('01-lineup-day.png', () => {
  const { crowd, ANIM, scene, Ws, U } = __nc;
  const { rng32, clearStreet, groups } = window.__pchk;
  clearStreet();
  __nc.time(585); // 09:45 白天
  __nc.weather('clear', true);
  __nc.peds.mesh.visible = false;
  __nc.me.mesh.visible = false;

  const anchor = Ws(-108, -31, 0); // 寬闊大道中心
  __nc.tp(anchor.x, anchor.z + 6, 0);
  __nc.me.mesh.visible = false;

  const fx = Math.sin(anchor.yaw), fz = Math.cos(anchor.yaw);
  const rx = fz, rz = -fx; // 右向向量
  const cr = crowd(8);
  const r = rng32(20261027);
  for (let k = 0; k < 8; k++) {
    cr.look(k, { r, female: k % 2 === 1, glowI: 0 });
    cr.anim(k, k % 3 === 1 ? ANIM.talk : ANIM.idle, k * 1.7, 1);
    const off = (k - 3.5) * 0.92;
    const px = anchor.x + rx * off, pz = anchor.z + rz * off;
    cr.place(k, px, 0.02, pz, anchor.yaw + (k % 2 ? -0.1 : 0.1));
  }
  scene.add(cr.mesh);
  groups.push(cr.mesh);
  U.uTime.value = 12.4;
  __nc.camAt(
    anchor.x + fx * 5.2, 1.25, anchor.z + fz * 5.2,
    anchor.x, 1.02, anchor.z
  );
});

// 2. 臉部、眼睛、皮膚次表面散射與手部近景特寫（4 人）
await snap('02-closeup-face-hand.png', () => {
  const { crowd, ANIM, scene, Ws, U } = __nc;
  const { rng32, groups } = window.__pchk;
  for (const g of groups) g.visible = false;
  __nc.time(610); // 10:10 柔和日光斜照
  __nc.weather('cloudy', true);

  const anchor = Ws(-108, -31, 0);
  const fx = Math.sin(anchor.yaw), fz = Math.cos(anchor.yaw);
  const rx = fz, rz = -fx;
  const cr = crowd(4);
  const r = rng32(8801);
  const poses = [ANIM.idle, ANIM.talk, ANIM.phone, ANIM.cross];
  for (let k = 0; k < 4; k++) {
    cr.look(k, { r, female: k % 2 === 1, coat: k < 2 ? 0 : 1, glowI: 0 });
    cr.anim(k, poses[k], 1.5 + k * 2.1, 1);
    const off = (k - 1.5) * 0.66;
    cr.place(k, anchor.x + rx * off, 0.02, anchor.z + rz * off, anchor.yaw + (k - 1.5) * -0.12);
  }
  scene.add(cr.mesh);
  groups.push(cr.mesh);
  U.uTime.value = 18.2;
  __nc.camAt(
    anchor.x + fx * 1.85, 1.48, anchor.z + fz * 1.85,
    anchor.x, 1.38, anchor.z
  );
});

// 3. 凌晨雨夜 LAZARUS 夜店門口排隊人龍與保鑣（檢驗群體間距、朝向、霓虹光影）
await snap('03-night-queue.png', () => {
  const { spots, Ws, U } = __nc;
  const { clearStreet, groups } = window.__pchk;
  for (const g of groups) g.visible = false;
  clearStreet();
  __nc.peds.mesh.visible = true;
  __nc.me.mesh.visible = false;
  __nc.time(120); // 02:00 雨夜
  __nc.weather('rain', true);

  const cd = spots.clubDoor;
  const wFocus = Ws(cd.x - 3.6, cd.z + 1.0, 0);
  const wCam = Ws(cd.x - 0.2, cd.z + 6.4, 0);
  __nc.tp(wFocus.x, wFocus.z + 3, 0);
  __nc.me.mesh.visible = false;
  U.uTime.value = 24.6;
  __nc.camAt(wCam.x, 1.58, wCam.z, wFocus.x, 1.12, wFocus.z);
});

// 4. 人行道群體步態（檢驗每人步頻、步幅、擺臂、上身姿態與撐傘/徒步差異）
await snap('04-sidewalk-gait.png', () => {
  const { peds, pedState, Ws, U } = __nc;
  const { clearStreet, groups } = window.__pchk;
  for (const g of groups) g.visible = false;
  clearStreet();
  __nc.time(1110); // 18:30 藍調時刻路燈剛亮
  __nc.weather('drizzle', true);
  peds.mesh.visible = true;
  __nc.me.mesh.visible = false;

  // 挑一個街區北側人行道，把前 7 個路人放到這條人行道上自然行走
  const b = pedState[0].b;
  const midX = (b.x0 + b.x1) * 0.5;
  const zSide = b.z0 + 2.2;
  const wMid = Ws(midX, zSide, Math.PI / 2);
  __nc.tp(wMid.x, wMid.z, 0);
  __nc.me.mesh.visible = false;

  for (let k = 0; k < 7; k++) {
    const ps = pedState[k];
    ps.out = 0; ps.down = 0; ps.panic = 0; ps.fsm = null;
    ps.b = b;
    ps.inset = 1.6 + (k % 3) * 0.55;
    ps.w = b.x1 - b.x0 - ps.inset * 2;
    ps.d = b.z1 - b.z0 - ps.inset * 2;
    ps.per = 2 * (ps.w + ps.d);
    ps.dir = k % 5 === 3 ? -1 : 1;
    ps.s = ps.w * 0.32 + k * 2.15;
    ps.dx = 0; ps.dz = 0;
  }
  U.uTime.value = 31.3;
  for (let i = 0; i < 20; i++) __nc.step(1 / 60);
  const wCam = Ws(midX + 12.5, zSide - 2.6, 0);
  const wTgt = Ws(midX + 2.5, zSide + 0.3, 0);
  __nc.camAt(wCam.x, 1.52, wCam.z, wTgt.x, 1.08, wTgt.z);
});

// 5. 各類角色職業與主角同框（Kael、Vance、Jax、警察、SWAT、赤蠍幫、店員、酒保）
await snap('05-roles-cast.png', () => {
  const { crowd, ANIM, scene, Ws, U } = __nc;
  const { rng32, clearStreet, groups } = window.__pchk;
  for (const g of groups) g.visible = false;
  clearStreet();
  __nc.peds.mesh.visible = false;
  __nc.me.mesh.visible = false;
  __nc.time(1320); // 22:00 路燈夜景
  __nc.weather('cloudy', true);

  const anchor = Ws(-108, -26, 0);
  __nc.tp(anchor.x, anchor.z + 6, 0);
  __nc.me.mesh.visible = false;
  const fx = Math.sin(anchor.yaw), fz = Math.cos(anchor.yaw);
  const rx = fz, rz = -fx;

  const CREW = __nc.gta.crew.CREW;
  const cr = crowd(7);
  const r = rng32(5566);
  // 0..2: Vance, Kael, Jax（強制不套 scan 以檢視底模主角外觀）
  for (let i = 0; i < 3; i++) {
    const lk = { ...CREW[i].look };
    delete lk.scan;
    cr.look(i, { r: rng32(31 + i), ...lk });
    cr.anim(i, CREW[i].idle || ANIM.idle, i * 2.3, 1);
  }
  // 3: 警察, 4: SWAT, 5: 赤蠍幫, 6: BODEGA 店員
  cr.look(3, { r, female: false, top: 0x1d2840, bot: 0x151a26, coat: 1, hat: 1, glowI: 0, scale: 1.02 });
  cr.anim(3, ANIM.idle, 1.2, 1);

  cr.look(4, { r, female: false, top: 0x121315, bot: 0x101113, coat: 1, hat: 1, glowI: 0, scale: 1.05 });
  cr.anim(4, ANIM.aimIdle, 0.5, 1);

  cr.look(5, { r, female: false, top: 0x5a1418, bot: 0x17181c, coat: 0, hat: 0, glowI: 1.2, scale: 1.01 });
  cr.anim(5, ANIM.cross, 3.1, 1);

  cr.look(6, { r: rng32(2601), female: true, coat: 0, glowI: 0 });
  cr.anim(6, ANIM.talk, 2.0, 1);

  for (let k = 0; k < 7; k++) {
    const off = (k - 3) * 0.95;
    cr.place(k, anchor.x + rx * off, 0.02, anchor.z + rz * off, anchor.yaw + (k - 3) * -0.06);
  }
  scene.add(cr.mesh);
  groups.push(cr.mesh);
  U.uTime.value = 40.5;
  __nc.camAt(
    anchor.x + fx * 4.9, 1.28, anchor.z + fz * 4.9,
    anchor.x, 1.05, anchor.z
  );
});

// 6. 動作與主角專屬動作（sprint / breast / jump + phone / smoke / umbrella / run）驗證
await snap('06-poses-actions.png', () => {
  const { crowd, ANIM, scene, Ws, U, player } = __nc;
  const { rng32, groups } = window.__pchk;
  for (const g of groups) g.visible = false;
  __nc.time(640); // 白天清楚檢視骨架姿勢
  __nc.weather('clear', true);

  const anchor = Ws(-108, -31, 0);
  const fx = Math.sin(anchor.yaw), fz = Math.cos(anchor.yaw);
  const rx = fz, rz = -fx;
  const list = [
    [ANIM.walk, 0.35, 0],
    [ANIM.umbrella, 0.6, 0],
    [ANIM.phone, 1.2, 0],
    [ANIM.smoke, 1.8, 0],
    [ANIM.run, 0.4, 0],
    [ANIM.sprint, 0.45, 0],
    [ANIM.breast, 0.52, 0.35],
    [ANIM.jump, 0, 0.55],
  ];
  player.jump = { t: 0.25, vy: 1.5, T: 0.85 };
  const cr = crowd(list.length);
  const r = rng32(9900);
  list.forEach(([id, ph, dy], k) => {
    cr.look(k, { r, female: k % 2 === 1, glowI: 0 });
    cr.anim(k, id, ph - 50, 1);
    const off = (k - 3.5) * 1.05;
    cr.place(k, anchor.x + rx * off, 0.02 + dy, anchor.z + rz * off, anchor.yaw + 0.55); // 斜側面看動作輪廓
  });
  scene.add(cr.mesh);
  groups.push(cr.mesh);
  U.uTime.value = 50;
  // 跑兩幀讓 breastPose 的 swK 收斂
  for (let i = 0; i < 30; i++) { U.uTime.value += 0.05; __nc.step(0.016); }
  player.jump = { t: 0.25, vy: 1.5, T: 0.85 };
  __nc.step(0.001);
  __nc.camAt(
    anchor.x + fx * 5.8, 1.38, anchor.z + fz * 5.8,
    anchor.x, 1.05, anchor.z
  );
  player.jump = null;
});

// 6b. 新增日常都市行為與髮型帽款特寫（慢跑 jog vs 逃跑 run、低頭滑手機站立 text 與邊走邊滑 textWalk、端莊步行與新髮型）
await snap('07-everyday-motions.png', () => {
  const { crowd, ANIM, scene, Ws, U } = __nc;
  const { rng32, groups } = window.__pchk;
  for (const g of groups) g.visible = false;
  __nc.time(980); // 16:20 午後暖陽斜射，突顯皮膚次表面散射與衣服皺褶立體感
  __nc.weather('clear', true);

  const anchor = Ws(-108, -31, 0);
  const fx = Math.sin(anchor.yaw), fz = Math.cos(anchor.yaw);
  const rx = fz, rz = -fx;
  const specs = [
    { id: ANIM.jog ?? ANIM.run, ph: 0.35, fem: true, coat: 0, longHair: 0, yawOff: 0.42 },
    { id: ANIM.run, ph: 0.35, fem: false, coat: 1, hat: 1, yawOff: 0.42 },
    { id: ANIM.text ?? ANIM.phone, ph: 1.1, fem: true, coat: 1, longHair: 1, yawOff: -0.15 },
    { id: ANIM.textWalk ?? ANIM.walk, ph: 0.55, fem: false, coat: 1, yawOff: 0.28 },
    { id: ANIM.talk, ph: 2.4, fem: true, coat: 0, yawOff: 0.25 },
    { id: ANIM.talk, ph: 4.1, fem: false, coat: 1, yawOff: -0.28 },
  ];
  const cr = crowd(specs.length);
  const r = rng32(202688);
  specs.forEach((s, k) => {
    cr.look(k, { r, female: s.fem, coat: s.coat, longHair: s.longHair, hat: s.hat, glowI: 0 });
    cr.anim(k, s.id, s.ph, 1);
    const off = (k - 2.5) * 0.92;
    cr.place(k, anchor.x + rx * off, 0.02, anchor.z + rz * off, anchor.yaw + s.yawOff);
  });
  scene.add(cr.mesh);
  groups.push(cr.mesh);
  U.uTime.value = 62.4;
  __nc.step(0.016);
  __nc.camAt(
    anchor.x + fx * 4.4, 1.32, anchor.z + fz * 4.4,
    anchor.x, 1.08, anchor.z
  );
});

// 7. 恢復正常雨夜街景，量測效能 __nc.perf.stats() 與人群更新耗時
const perfResult = await page.evaluate(async () => {
  for (const g of window.__pchk.groups) { g.visible = false; g.removeFromParent(); }
  __nc.camAt();
  __nc.peds.mesh.visible = true;
  __nc.me.mesh.visible = true;
  __nc.time(120);
  __nc.weather('rain', true);
  // 傳送到 LAZARUS 夜店外街口（同時有排隊人龍、保鑣與大量人行道路人）
  const cd = __nc.spots.clubDoor;
  __nc.tpL(cd.x - 10, cd.z + 8, 1.2);
  __nc.look(1.2, 0.08, 1);
  await new Promise(r => setTimeout(r, 2000));
  __nc.perf.on(true);
  __nc.perf.PF.ring.length = 0;
  await new Promise(r => setTimeout(r, 3500));
  const stats = __nc.perf.stats(180);

  // 額外單獨量測連續 200 次 __nc.step(1/60) 的純邏輯 CPU 毫秒（排除 rAF 60Hz 等待）
  const t0 = performance.now();
  const N = 120;
  for (let i = 0; i < N; i++) {
    __nc.U.uTime.value += 1 / 60;
    __nc.step(1 / 60);
  }
  const stepAvgMs = (performance.now() - t0) / N;

  // 統計目前 people 網格的面數與頂點數
  const bodyGeo = __nc.me.people[0].sm.geometry;
  const meshStats = {
    vertices: bodyGeo.attributes.position.count,
    triangles: bodyGeo.index ? bodyGeo.index.count / 3 : bodyGeo.attributes.position.count / 3,
    attributes: Object.keys(bodyGeo.attributes),
  };

  const gfxInfo = __nc.gfx ? {
    backend: __nc.gfx.name,
    err: __nc.gfx.err ? __nc.gfx.err() : [],
    clash: __nc.gfx.clash ? __nc.gfx.clash() : [],
    miss: __nc.gfx.miss ? __nc.gfx.miss() : [],
  } : null;

  return { stats, stepAvgMs: +stepAvgMs.toFixed(3), meshStats, gfxInfo };
});

const summary = {
  tag,
  timestamp: new Date().toISOString(),
  gpu: log.gpu,
  pageerrors: log.pageerrors,
  errors: log.errors,
  warns: log.warns.slice(0, 10),
  ...perfResult,
};
writeFileSync(resolve(outDir, 'perf.json'), JSON.stringify(summary, null, 2));
console.log('PERF SUMMARY:', JSON.stringify(summary, null, 2));

await browser.close();
if (log.pageerrors.length || log.errors.length) {
  console.error('Errors detected!', log.pageerrors, log.errors);
  process.exit(1);
}
