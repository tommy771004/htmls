// 第二關「寒潭渡」驗收：兩種尺寸，確定性步進走完整條路線，連失敗路徑一起測：
// 不跳橫木會落水且木筏歸位、地面跳不到高台、石塊掉下去／出手都會回原位、
// 人踩機關板跑不過閘門、石塊壓板後能過、冰縫裂開碎掉再長回來。
// node tools/accept2.mjs [html]（截圖輸出到 dist/l2-*.png）
import { mkdirSync } from 'node:fs';
import { open, raf } from './lib.mjs';

const html = process.argv[2] || '../../web/277-ink-ridge.html';
mkdirSync('dist', { recursive: true });
let fail = 0;
const ok = (c, m) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fail++; };
const f2 = (a) => a.map((v) => v.toFixed(2)).join(', ');

const HELPERS = () => {
  const I = window.__ink;
  const T = {
    run(inp, n) { const { until, ...i } = inp; let s; for (let k = 0; k < n; k++) { I.input(i); s = I.step(1); if (i.jump) i.jump = false; if (until && until(s)) break; } I.input({}); return I.state(); },
    dirTo(x, z) { const s = I.state(); const dx = x - s.pos[0], dz = z - s.pos[2], l = Math.hypot(dx, dz) || 1; return { mx: dx / l, my: -dz / l, d: l }; },
    goto(x, z, r = 0.12, n = 600) {
      I.setCamYaw(0);
      for (let k = 0; k < n; k++) { const d = T.dirTo(x, z); if (d.d < r) break; const q = Math.min(1, d.d / 0.5); I.input({ mx: d.mx * q, my: d.my * q }); I.step(1); }
      I.input({}); return T.run({}, 12);
    },
    hop(x, z, jumpAt) {
      I.setCamYaw(0);
      for (let k = 0; k < 240; k++) { const d = T.dirTo(x, z), s = I.state(), jump = s.mode === 'ground' && d.d < jumpAt; I.input({ mx: d.mx, my: d.my, jump, jumpHeld: true }); I.step(1); if (jump) break; }
      for (let k = 0; k < 120; k++) { const d = T.dirTo(x, z); I.input({ mx: d.d > 0.3 ? d.mx : 0, my: d.d > 0.3 ? d.my : 0, jumpHeld: true }); if (I.step(1).mode !== 'air') break; }
      return T.run({}, 20);
    },
    /** 騎在木筏上過一根橫木：靠近才起跳，過了就轉回筏中央 */
    overLog(logZ, stand = false) {
      I.setCamYaw(0);
      for (let k = 0; k < 900; k++) { const s = I.state(), rz = s.raft.z; I.input({ my: (s.pos[2] - rz) * 1.2 }); I.step(1); if (I.state().pos[2] - logZ < (stand ? 0.74 : 1.15)) break; }
      if (stand) {
        I.input({ jump: true, jumpHeld: true }); I.step(1);
        for (let k = 0; k < 120; k++) { I.input({ jumpHeld: true }); if (I.step(1).mode !== 'air') break; }
        return T.run({}, 10);
      }
      I.input({ my: 1, jump: true, jumpHeld: true }); I.step(1);
      for (let k = 0; k < 120; k++) {
        const s = I.state(), past = s.pos[2] < logZ - 0.45, rz = s.raft.z;
        I.input({ my: past ? Math.max(-1, Math.min(1, (s.pos[2] - rz) * 1.5)) : 1, jumpHeld: true });
        if (I.step(1).mode !== 'air') break;
      }
      return T.run({}, 10);
    },
    /** 推石塊直到條件成立 */
    push(inp, until, n = 900) { I.setCamYaw(0); return T.run({ ...inp, until }, n); },
  };
  window.__t = T;
};

for (const [w, h, touch] of [[1440, 900, false], [390, 844, true]]) {
  const tag = `${w}×${h}`;
  const { browser, page, log } = await open(html, { w, h, touch, query: '?lv=2' });
  const shot = async (name) => { await raf(page); await page.screenshot({ path: `dist/l2-${name}-${w}.png` }); };
  const overflow = () => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.body.scrollWidth <= innerWidth);
  const E = (fn, arg) => page.evaluate(fn, arg);
  try {
    await page.waitForTimeout(500);
    const lay = await E(() => ({ title: document.title, sub: document.querySelector('#lvSub').textContent, on: document.querySelector('.lvs a.on')?.dataset.lv, next: document.querySelector('#nextBtn').hidden }));
    ok(lay.title.includes('寒潭渡') && lay.sub.includes('第二關') && lay.on === '2' && lay.next, `${tag} 開場是第二關（${lay.title}）`);
    ok(await overflow(), `${tag} 開場沒有水平溢出`);
    await shot('intro');
    if (touch) await page.tap('#startBtn'); else await page.click('#startBtn');
    await page.waitForTimeout(1200);
    const live = await E(() => window.__ink.state());
    ok(live.started && live.frameMs < 40, `${tag} 開始，平均幀時間 ${live.frameMs.toFixed(1)} ms`);
    ok(live.draws < 320, `${tag} 每幀 draw call ${live.draws}（含陰影）、${(live.tris / 1000).toFixed(0)}k 三角形`);
    await shot('start');
    await E(HELPERS);
    await E(() => { window.__ink.manual(true); window.__ink.setCamYaw(0); });

    // 壹 雪徑
    let s = await E(() => window.__t.hop(0, -11.5, 3.4));
    ok(s.mode === 'ground' && Math.abs(s.pos[1] - 0.4) < 0.02, `${tag} 跳過第一道裂隙（y=${s.pos[1].toFixed(2)}）`);
    s = await E(() => window.__t.hop(0, -17, 3.2));
    ok(s.mode === 'ground' && s.pos[1] < 0.02 && s.pos[2] < -15.8, `${tag} 跳過第二道裂隙（${f2(s.pos)}）`);
    s = await E(() => window.__t.goto(0.9, -17.6));
    ok(s.lit === 1, `${tag} 點亮渡口燈籠（${s.lit}）`);

    // 貳 寒潭：站著不跳，被橫木掃下水
    s = await E(() => { window.__t.goto(0, -18.8); return window.__t.goto(0, -24.6); });
    ok(Math.abs(s.pos[1] + 0.25) < 0.03, `${tag} 走上木筏（y=${s.pos[1].toFixed(2)}, ${s.raft.state}）`);
    s = await E(() => window.__t.run({}, 40));
    ok(s.raft.state === 'go' && s.raft.z < -24.6, `${tag} 站上 0.6 秒木筏開動（z=${s.raft.z.toFixed(2)}）`);
    const f0 = s.falls;
    s = await E(() => window.__t.run({ until: (q) => q.falls > 0 && q.mode !== 'dead' }, 900));
    ok(s.falls === f0 + 1, `${tag} 不跳橫木會落水（falls=${s.falls}）`);
    ok(s.raft.state === 'idle' && Math.abs(s.raft.z + 25.1) < 0.01 && Math.abs(s.pos[2] + 18.7) < 0.11 && s.pos[0] === 0, `${tag} 重生在渡口、木筏歸位（${s.raft.state}, z=${s.raft.z}, p=${f2(s.pos)}）`);

    // 貳：跳過三根橫木
    s = await E(() => { window.__ink.setCamYaw(0); return window.__t.run({ my: 1 }, 40); });
    ok(s.falls === f0 + 1 && s.pos[1] > -0.3, `${tag} 重生後按住 W 不會走進水裡（p=${f2(s.pos)}）`);
    await E(() => window.__t.goto(0, -24.6));
    await E(() => window.__t.run({}, 40));
    for (const z of [-34, -45, -52.4]) {
      s = await E((lz) => window.__t.overLog(lz, lz === -34), z);
      ok(s.mode === 'ground' && s.pos[2] < z && Math.abs(s.pos[1] + 0.25) < 0.05, `${tag} ${z === -34 ? '原地跳' : '助跑跳'}過橫木 z=${z}（p=${f2(s.pos)}, 筏 ${s.raft.z.toFixed(1)}）`);
      if (z === -34) await shot('raft');
    }
    s = await E(() => window.__t.run({ until: (q) => q.raft.state === 'end' }, 600));
    ok(s.raft.state === 'end' && s.falls === 1, `${tag} 木筏靠岸（z=${s.raft.z.toFixed(2)}，falls=${s.falls}）`);
    s = await E(() => window.__t.goto(0, -63));
    ok(s.pos[1] > -0.02 && s.mode === 'ground', `${tag} 走上對岸碼頭（${f2(s.pos)}）`);

    // 參 石庭
    // 貼左邊走也不會漏掉檢查點
    s = await E(() => { window.__t.goto(-1.2, -63.5); return window.__t.goto(-5, -67); });
    ok(s.lit === 2 && s.section.includes('石庭'), `${tag} 點亮石庭燈籠（${s.section}）`);
    // 地面跳不到高台
    await E(() => window.__t.goto(-3, -78));
    s = await E(() => { const t = window.__t; t.run({ my: 1 }, 10); return t.run({ my: 1, jump: true, jumpHeld: true, until: (q) => q.mode === 'hang' }, 70); });
    ok(s.mode !== 'hang', `${tag} 地面跳不上高台（${s.mode}）`);
    // 出手讓石塊歸位
    await E(() => window.__t.run({}, 40));
    await E(() => window.__t.goto(3, -71.2));
    s = await E(() => window.__t.push({ my: 1 }, (q) => q.blocks[0].z < -74.4, 400));
    ok(s.blocks[0].z < -74.4 && s.pushing, `${tag} 推得動石塊（z=${s.blocks[0].z.toFixed(2)}）`);
    await shot('push');
    s = await E(() => { const t = window.__t; t.run({}, 30); t.run({ my: 1, strike: true }, 2); return t.run({}, 50); });
    ok(s.blocks[0].wait, `${tag} 出手後石塊消失，人站在原位時先等著`);
    await E(() => window.__t.goto(5.4, -73));
    s = await E(() => window.__t.run({}, 30));
    ok(Math.abs(s.blocks[0].z + 73) < 0.01 && !s.blocks[0].wait, `${tag} 人走開石塊回原位（z=${s.blocks[0].z.toFixed(2)}）`);
    // 推到高台壁下當墊腳
    await E(() => window.__t.goto(3, -71.2));
    s = await E(() => window.__t.push({ my: 1, mx: 0.14 }, (q) => q.blocks[0].z < -79.38, 700));
    ok(Math.abs(s.blocks[0].z + 79.4) < 0.03, `${tag} 方向偏 8° 也能把石塊推到高台壁（z=${s.blocks[0].z.toFixed(2)}）`);
    await E(() => window.__t.goto(3, -75.6));
    s = await E(() => window.__t.hop(3, -79.3, 2.3));
    ok(Math.abs(s.pos[1] - 1) < 0.03, `${tag} 跳上石塊（y=${s.pos[1].toFixed(2)}）`);
    s = await E(() => { const t = window.__t; t.run({ my: 1 }, 6); return t.run({ my: 1, jump: true, jumpHeld: true, until: (q) => q.mode === 'hang' }, 70); });
    ok(s.mode === 'hang' && s.ledge === 'T1', `${tag} 從石塊跳起抓住高台邊（${s.mode}, ${s.ledge}）`);
    s = await E(() => { const t = window.__t; t.run({}, 12); return t.run({ my: 1, until: (q) => q.mode === 'ground' }, 120); });
    ok(s.mode === 'ground' && Math.abs(s.pos[1] - 3.8) < 0.02, `${tag} 翻上高台（y=${s.pos[1].toFixed(2)}）`);
    s = await E(() => window.__t.goto(4.4, -82));
    ok(s.lit === 3, `${tag} 點亮高台燈籠（${s.lit}）`);

    // 推下高台前緣會自己回來
    await E(() => { window.__t.goto(2.4, -84.5); window.__t.goto(2.4, -89.2); return window.__t.goto(4, -89.2); });
    s = await E(() => window.__t.push({ my: -1 }, (q) => q.blocks[1].fall, 700));
    ok(s.blocks[1].fall, `${tag} 石塊推出高台前緣開始掉落（z=${s.blocks[1].z.toFixed(2)}）`);
    s = await E(() => window.__t.run({}, 90));
    ok(Math.abs(s.blocks[1].z + 87.5) < 0.01 && Math.abs(s.blocks[1].y - 3.8) < 0.01 && !s.blocks[1].wait, `${tag} 掉下去的石塊回原位（${f2([s.blocks[1].x, s.blocks[1].y, s.blocks[1].z])}）`);
    // 回歸：冰壁燈籠不能隔著閘門牆點亮（否則跳水重生就繞過整個謎題）
    await E(() => { window.__t.goto(-2.4, -88.8); return window.__t.goto(-2.4, -89.66); });
    s = await E(() => window.__t.run({}, 20));
    ok(s.lit === 3 && s.pos[2] < -89.5, `${tag} 隔牆點不到冰壁燈籠（z=${s.pos[2].toFixed(2)}，已點 ${s.lit}）`);
    // 人踩機關板跑不過閘門
    await E(() => window.__t.goto(-4, -84.2));
    s = await E(() => window.__t.run({}, 90));
    ok(s.gateOpen > 0.99, `${tag} 站上機關板閘門打開（${s.gateOpen.toFixed(2)}）`);
    await shot('gate');
    s = await E(() => { const t = window.__t, I = window.__ink; for (let k = 0; k < 150; k++) { const d = t.dirTo(0, -93); I.input({ mx: d.mx, my: d.my }); I.step(1); } I.input({}); return t.run({}, 10); });
    ok(s.pos[2] > -90.1 && s.gateOpen < 0.05, `${tag} 離開機關板跑不過閘門（z=${s.pos[2].toFixed(2)}，開度 ${s.gateOpen.toFixed(2)}）`);
    // 石塊壓機關板
    await E(() => { window.__t.goto(2.4, -85.4); window.__t.goto(5.6, -85.4); return window.__t.goto(5.6, -87.5); });
    s = await E(() => window.__t.push({ mx: -1 }, (q) => q.blocks[1].x <= -4.8, 500));
    ok(s.blocks[1].x <= -4.78 && s.blocks[1].x > -4.95, `${tag} 第二塊石頭可以推過頭，路上沒有障礙（x=${s.blocks[1].x.toFixed(2)}）`);
    await E(() => window.__t.run({}, 12));
    await E(() => window.__t.goto(-3.6, -89.3));
    await E(() => window.__t.goto(-4.85, -89.3));
    s = await E(() => window.__t.push({ my: -1 }, (q) => q.blocks[1].z > -84.3, 300));
    await E(() => window.__t.run({}, 12));
    s = await E(() => window.__t.run({}, 90));
    ok(s.gateOpen > 0.99 && Math.abs(s.blocks[1].z + 84.3) < 0.25, `${tag} 石塊偏 0.85 m 仍壓得住機關板，閘門常開（${s.gateOpen.toFixed(2)}，z=${s.blocks[1].z.toFixed(2)}）`);
    await E(() => window.__t.goto(0, -89));
    s = await E(() => window.__t.goto(0, -93));
    ok(s.pos[2] < -92 && s.section.includes('冰壁'), `${tag} 穿過閘門（${s.section}）`);
    s = await E(() => window.__t.goto(-1.2, -92.6));
    ok(s.lit === 4, `${tag} 點亮冰壁燈籠（${s.lit}）`);

    // 肆 冰壁
    await E(() => window.__t.goto(1, -94.5));
    s = await E(() => { const t = window.__t; t.run({ my: 1 }, 8); return t.run({ my: 1, jump: true, jumpHeld: true, until: (q) => q.mode === 'hang' }, 70); });
    ok(s.ledge === 'S1', `${tag} 抓住 S1（${s.mode}, ${s.ledge}）`);
    s = await E(() => { const t = window.__t; t.run({}, 12); return t.run({ mx: 1, until: (q) => q.pos[0] > 1.7 }, 90); });
    s = await E(() => { const t = window.__t; t.run({}, 8); return t.run({ my: 1, until: (q) => q.mode === 'hang' && q.ledge === 'I1' }, 80); });
    ok(s.ledge === 'I1', `${tag} 上攀到冰縫 I1（${s.ledge}）`);
    await shot('ice');
    s = await E(() => window.__t.run({ until: (q) => q.ice[0].t > 1.7 }, 130));
    ok(s.mode === 'hang' && !s.ice[0].broken, `${tag} 1.7 秒時冰縫開始裂、還撐著（t=${s.ice[0].t.toFixed(2)}）`);
    await shot('crack');
    s = await E(() => window.__t.run({ until: (q) => q.mode === 'air' }, 110));
    ok(s.mode === 'air' && s.ice[0].broken && !s.ice[0].on, `${tag} 掛 3 秒冰縫碎裂、人掉下去（t=${s.ice[0].t.toFixed(2)}）`);
    s = await E(() => window.__t.run({ until: (q) => q.mode === 'ground' }, 120));
    ok(s.mode === 'ground' && Math.abs(s.pos[1] - 3.8) < 0.02, `${tag} 掉回走道（y=${s.pos[1].toFixed(2)}）`);
    s = await E(() => window.__t.run({ until: (q) => q.ice[0].on }, 260));
    ok(s.ice[0].on && !s.ice[0].broken, `${tag} 冰縫長回來`);
    // 正式過冰壁
    await E(() => window.__t.goto(1.7, -94.5));
    s = await E(() => { const t = window.__t; t.run({ my: 1 }, 8); return t.run({ my: 1, jump: true, jumpHeld: true, until: (q) => q.mode === 'hang' }, 70); });
    s = await E(() => { const t = window.__t; t.run({}, 8); return t.run({ my: 1, until: (q) => q.mode === 'hang' && q.ledge === 'I1' }, 80); });
    s = await E(() => { const t = window.__t; t.run({}, 2); return t.run({ mx: 1, until: (q) => q.pos[0] > 3.85 }, 130); });
    ok(s.ledge === 'I1' && s.pos[0] > 3.8, `${tag} 橫移到 I1 右端（x=${s.pos[0].toFixed(2)}，t=${s.ice[0].t.toFixed(2)}）`);
    s = await E(() => { const t = window.__t; t.run({ mx: 1, jump: true }, 1); return t.run({ mx: 1, until: (q) => q.mode === 'hang' && q.ledge === 'I2' }, 70); });
    ok(s.ledge === 'I2', `${tag} 側跳到 I2（${s.mode}, ${s.ledge}）`);
    // I2 整段都能上攀：先橫移到另一端再按 W
    s = await E(() => { const t = window.__t; t.run({}, 2); return t.run({ mx: 1, until: (q) => q.pos[0] > 7.15 }, 50); });
    const i2x = s.pos[0];
    s = await E(() => { const t = window.__t; t.run({}, 8); return t.run({ my: 1, until: (q) => q.mode === 'hang' && q.ledge === 'S2' }, 80); });
    ok(s.ledge === 'S2', `${tag} 從 x=${i2x.toFixed(2)} 上攀到 S2（${s.ledge}）`);
    s = await E(() => { const t = window.__t; t.run({}, 12); return t.run({ my: 1, until: (q) => q.ledge === 'TOP' }, 80); });
    ok(s.ledge === 'TOP', `${tag} 上攀到壁頂（${s.ledge}）`);
    s = await E(() => { const t = window.__t; t.run({}, 12); return t.run({ my: 1, until: (q) => q.mode === 'ground' }, 120); });
    ok(s.mode === 'ground' && Math.abs(s.pos[1] - 12.8) < 0.02, `${tag} 翻上雪塔台（y=${s.pos[1].toFixed(2)}，${s.section}）`);

    // 伍 雪塔
    await shot('pagoda');
    s = await E(() => window.__t.goto(4.6, -100.8));
    await page.waitForTimeout(50);
    ok(s.done || (await E(() => window.__ink.state())).done, `${tag} 點亮終點燈籠、過關（${s.time?.toFixed(1)} s，${s.falls} 次落水）`);
    await E(() => window.__ink.manual(false));
    await page.waitForTimeout(1700);
    const d = await E(() => ({ show: !document.querySelector('#done').hidden, t: document.querySelector('#doneTitle').textContent, next: document.querySelector('#nextBtn').hidden }));
    ok(d.show && d.t.includes('寒潭渡') && d.next, `${tag} 過關卡片（${d.t}）`);
    await shot('done');
    if (touch) await page.tap('#againBtn'); else await page.click('#againBtn');
    await page.waitForTimeout(300);
    s = await E(() => window.__ink.state());
    ok(s.raft.state === 'idle' && s.gateOpen === 0 && Math.abs(s.blocks[0].z + 73) < 0.01 && Math.abs(s.blocks[1].x - 4) < 0.01 && s.lit === 0 && s.pos[2] > 3, `${tag} 再走一次全部歸位`);
    ok(await overflow(), `${tag} 遊戲中沒有水平溢出`);
    ok(log.pageerrors.length === 0, `${tag} 沒有 uncaught exception ${log.pageerrors.slice(0, 2).join(' | ')}`);
    ok(log.errors.length === 0, `${tag} 沒有 console.error ${log.errors.slice(0, 2).join(' | ')}`);
    ok(log.external.length === 0, `${tag} 沒有外部網路請求 ${log.external.slice(0, 2).join(' ')}`);
    console.log(`  (${log.gpu}${log.warns.length ? `, ${log.warns.length} 則警告：${log.warns[0].slice(0, 120)}` : ''})`);
  } catch (e) { ok(false, `${tag} 例外：${e.message.slice(0, 300)}`); }
  await browser.close();
}
console.log(fail ? `\n${fail} 項失敗` : '\n全部通過');
process.exit(fail ? 1 : 0);
