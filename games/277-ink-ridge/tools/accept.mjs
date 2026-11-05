// 驗收：開打包後的單檔，在 1440×900（鍵盤）與 390×844（觸控）下檢查
// 沒有 uncaught exception、console.error、外部網路請求、缺 viewport、水平溢出；
// 再用確定性步進把整條路線走完：石階 → 五根石柱 → 抓岩縫 A → 橫移 → 上攀 B → 側跳 C → 上攀崖頂 → 翻上 → 跳斷崖
// → 敲鐘 → 搭吊台 → 敲第二口鐘開山門 → 走到終點燈籠。另測墜落重生、放手、往後躍、真實鍵盤／觸控輸入與幀時間。
// node tools/accept.mjs [html]（截圖輸出到 dist/accept-*.png）
import { mkdirSync } from 'node:fs';
import { open, raf } from './lib.mjs';

const html = process.argv[2] || '../../web/277-ink-ridge.html';
mkdirSync('dist', { recursive: true });
let fail = 0;
const ok = (c, m) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fail++; };
const rect = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); if (!e || e.hidden) return null; const b = e.getBoundingClientRect(); if (!b.width) return null; return [Math.round(b.left), Math.round(b.top), Math.round(b.right), Math.round(b.bottom)]; }, sel);
const inView = (r, w, h) => !!r && r[0] >= 0 && r[1] >= 0 && r[2] <= w && r[3] <= h;
const f2 = (a) => a.map((v) => v.toFixed(2)).join(', ');

// 頁面內的小工具：朝目標跑、到距離就跳、等落地
const HELPERS = () => {
  const I = window.__ink;
  const T = {
    st: () => I.state(),
    run(inp, n) { I.input({ ...inp }); let s; for (let i = 0; i < n; i++) { s = I.step(1); if (inp.until && inp.until(s)) break; } I.input({}); return I.state(); },
    // 鏡頭固定朝 −z（yaw=0）：mx=+x、my=−z
    dirTo(x, z) { const s = I.state(); const dx = x - s.pos[0], dz = z - s.pos[2], l = Math.hypot(dx, dz) || 1; return { mx: dx / l, my: -dz / l, d: l }; },
    hop(x, z, jumpAt) {
      I.setCamYaw(0);
      for (let i = 0; i < 240; i++) {
        const d = T.dirTo(x, z);
        const s = I.state();
        const jump = s.mode === 'ground' && d.d < jumpAt;
        I.input({ mx: d.mx, my: d.my, jump, jumpHeld: true });
        I.step(1);
        if (jump) break;
      }
      for (let i = 0; i < 120; i++) {
        const d = T.dirTo(x, z);
        I.input({ mx: d.d > 0.3 ? d.mx : 0, my: d.d > 0.3 ? d.my : 0, jumpHeld: true });
        const s = I.step(1);
        if (s.mode !== 'air') break;
      }
      // 停穩
      return T.run({}, 20);
    },
  };
  window.__t = T;
};

for (const [w, h, touch] of [[1440, 900, false], [390, 844, true]]) {
  const tag = `${w}×${h}`;
  const { browser, page, log } = await open(html, { w, h, touch });
  const shot = async (name) => { await raf(page); await page.screenshot({ path: `dist/accept-${name}-${w}.png` }); };
  const overflow = () => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.body.scrollWidth <= innerWidth);
  const st = () => page.evaluate(() => window.__ink.state());
  try {
    await page.waitForTimeout(500);
    const lay = await page.evaluate(() => ({ vp: !!document.querySelector('meta[name=viewport]'), title: document.title }));
    ok(lay.vp, `${tag} 有 viewport meta`);
    ok(lay.title.includes('墨嶺行'), `${tag} 標題 ${lay.title}`);
    ok(await overflow(), `${tag} 開場沒有水平溢出`);
    ok(inView(await rect(page, '#intro'), w, h), `${tag} 開場卡片完整在視窗內`);
    await shot('intro');
    if (touch) await page.tap('#startBtn'); else await page.click('#startBtn');
    await page.waitForTimeout(300);
    ok((await st()).started, `${tag} 按「啟程」開始`);
    for (const s of ['#sec', '#meta', '#pauseBtn', ...(touch ? ['#stick', '#bJump', '#bStrike'] : [])]) ok(inView(await rect(page, s), w, h), `${tag} ${s} 在視窗內`);

    // 真實輸入：前進＋跳
    const p0 = (await st()).pos;
    if (touch) {
      const b = await rect(page, '#stick'); const cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2;
      await page.evaluate(([cx, cy]) => { const e = document.querySelector('#stick'); e.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 5, pointerType: 'touch', isPrimary: true, bubbles: true, clientX: cx, clientY: cy })); e.dispatchEvent(new PointerEvent('pointermove', { pointerId: 5, pointerType: 'touch', bubbles: true, clientX: cx, clientY: cy - 60 })); }, [cx, cy]);
      await page.waitForTimeout(900);
      await page.evaluate(() => document.querySelector('#stick').dispatchEvent(new PointerEvent('pointerup', { pointerId: 5, pointerType: 'touch', bubbles: true })));
    } else { await page.keyboard.down('KeyW'); await page.waitForTimeout(900); await page.keyboard.up('KeyW'); }
    const p1 = (await st()).pos;
    ok(p1[2] < p0[2] - 2, `${tag} ${touch ? '搖桿' : 'W'} 往前跑（z ${p0[2].toFixed(2)} → ${p1[2].toFixed(2)}）`);
    if (touch) await page.evaluate(() => { const e = document.querySelector('#bJump'); e.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 6, pointerType: 'touch', bubbles: true })); });
    else await page.keyboard.down('Space');
    await page.waitForTimeout(150);
    const sj = await st();
    if (touch) await page.evaluate(() => document.querySelector('#bJump').dispatchEvent(new PointerEvent('pointerup', { pointerId: 6, pointerType: 'touch', bubbles: true })));
    else await page.keyboard.up('Space');
    ok(sj.mode === 'air' && sj.pos[1] > p1[1] + 0.3, `${tag} ${touch ? '「躍」' : '空白鍵'}跳起（${sj.mode}, y ${sj.pos[1].toFixed(2)}）`);
    await page.waitForTimeout(900);
    ok((await st()).mode === 'ground', `${tag} 落回地面`);
    await shot('run');
    // 幀時間（實時）
    await page.waitForTimeout(1500);
    const fm = (await st()).frameMs;
    ok(fm < 40, `${tag} 平均幀時間 ${fm.toFixed(1)} ms`);
    const dr = (await st()).draws;
    ok(dr < 320, `${tag} 每幀 draw call ${dr}（含陰影）`);
    if (!touch) {
      // 指標鎖定時按 Esc：瀏覽器解除鎖定＋只暫停一次；再按 Esc 繼續
      await page.mouse.click(w / 2, h / 2); await page.waitForTimeout(300);
      const locked = await page.evaluate(() => !!document.pointerLockElement);
      await page.keyboard.press('Escape'); await page.waitForTimeout(350);
      const a = await page.evaluate(() => ({ l: !!document.pointerLockElement, p: window.__ink.state().paused }));
      await page.keyboard.press('Escape'); await page.waitForTimeout(250);
      const b = (await st()).paused;
      ok(locked && !a.l && a.p && !b, `${tag} 鎖定指標時 Esc 暫停一次、再按 Esc 繼續（鎖定 ${locked}→${a.l}，暫停 ${a.p}→${b}）`);
    }

    // ---------- 確定性路線 ----------
    await page.evaluate(HELPERS);
    await page.evaluate(() => { window.__ink.manual(true); window.__ink.teleport(0, 0, 3.5); window.__ink.setCamYaw(0); });
    let s = await page.evaluate(() => window.__t.run({ my: 1 }, 200));
    ok(Math.abs(s.pos[1] - 3) < 0.05 && s.pos[2] < -13.9, `${tag} 跑上八階石階到 y=3（${f2(s.pos)}）`);
    s = await page.evaluate(() => window.__t.run({ my: 1, until: (s) => s.pos[2] < -19.6 }, 120));
    const pillars = [[0, -23.6, 3.0], [1.7, -26.9, 3.5], [-0.5, -30.2, 4.0], [1.2, -33.4, 3.6], [0, -36.6, 4.0], [0, -40.5, 4.0]];
    for (const [i, [x, z, top]] of pillars.entries()) {
      s = await page.evaluate(([x, z]) => window.__t.hop(x, z, 3.0), [x, z]);
      ok(s.mode === 'ground' && Math.abs(s.pos[1] - top) < 0.05, `${tag} 跳到${i < 5 ? `第 ${i + 1} 根石柱` : '岩壁下平台'}（${f2(s.pos)}, ${s.mode}）`);
      if (s.mode !== 'ground') break;
    }
    await shot('pillars');
    // 抓岩縫 A
    await page.evaluate(() => { window.__ink.teleport(1, 4, -41.2); window.__ink.setCamYaw(0); });
    s = await page.evaluate(() => { const t = window.__t; t.run({ my: 1 }, 12); return t.run({ my: 1, jump: true, jumpHeld: true, until: (s) => s.mode === 'hang' }, 60); });
    ok(s.mode === 'hang' && s.ledge === 'A', `${tag} 跳起抓住岩縫 A（${s.mode} ${s.ledge}, ${f2(s.pos)}）`);
    {
      const d = await page.evaluate(() => { window.__t.run({}, 20); return window.__ink.heroDbg(); });
      ok(d && d.ik > 0.98 && d.L < 0.01 && d.R < 0.01, `${tag} 掛邊時雙手釘在岩面上（IK ${d?.ik?.toFixed(2)}, 誤差 ${d?.L?.toFixed(4)} / ${d?.R?.toFixed(4)}）`);
      ok(d && d.tips.every((t) => t[2] < -43.55 && Math.abs(t[1] - 6.4) < 0.06), `${tag} 手指搭在岩面上、勾向壁面（指尖 ${d?.tips?.map((t) => t[2].toFixed(2)).join(' ')}）`);
      ok(d && d.skirtTop < d.hipsY + 0.08, `${tag} 衣襬沒有翻到腰帶以上（${d?.skirtTop?.toFixed(2)} / 腰 ${d?.hipsY?.toFixed(2)}）`);
    }
    await shot('hang');
    s = await page.evaluate(() => window.__t.run({ mx: 1, until: (s) => s.pos[0] > 3.4 }, 200));
    ok(s.mode === 'hang' && s.pos[0] > 3.3, `${tag} D 往右橫移（x=${s.pos[0].toFixed(2)}）`);
    s = await page.evaluate(() => window.__t.run({ my: 1, until: (s) => s.mode === 'hang' && s.ledge === 'B' }, 60));
    ok(s.ledge === 'B', `${tag} W 上攀到岩縫 B（${s.ledge}）`);
    s = await page.evaluate(() => { window.__t.run({}, 12); return window.__t.run({ mx: 1, until: (s) => s.pos[0] > 6.3 }, 200); });
    s = await page.evaluate(() => { const t = window.__t; t.run({ mx: 1, jump: true }, 1); return t.run({ mx: 1, until: (s) => s.mode === 'hang' && s.ledge === 'C' }, 60); });
    ok(s.ledge === 'C', `${tag} D＋空白 側跳到岩縫 C（${s.ledge}, ${f2(s.pos)}）`);
    s = await page.evaluate(() => { window.__t.run({}, 12); return window.__t.run({ my: 1, until: (s) => s.ledge === 'TOP' }, 60); });
    ok(s.ledge === 'TOP', `${tag} 上攀到崖頂邊（${s.ledge}）`);
    await shot('climb');
    s = await page.evaluate(() => { window.__t.run({}, 12); return window.__t.run({ my: 1, until: (s) => s.mode === 'ground' }, 90); });
    ok(s.mode === 'ground' && Math.abs(s.pos[1] - 11) < 0.05, `${tag} 翻上崖頂（${s.mode}, ${f2(s.pos)}）`);
    // 斷崖
    s = await page.evaluate(() => window.__t.hop(9.8, -58.5, 3.4));
    ok(s.mode === 'ground' && Math.abs(s.pos[1] - 11) < 0.05 && s.pos[2] < -56.2, `${tag} 助跑跳過斷崖（${f2(s.pos)}）`);
    s = await page.evaluate(() => window.__t.run({ my: 1, until: (s) => s.pos[2] < -74 }, 400));
    ok(s.section.includes('鐘庭'), `${tag} 進入鐘庭（${s.section}）`);
    ok(s.checkpoint >= 3, `${tag} 沿路點亮燈籠（目前檢查點 ${s.checkpoint}、共 ${s.lit} 盞）`);
    // 敲鐘 → 吊台
    await page.evaluate(() => { window.__ink.teleport(0.5, 11, -82.2, Math.PI); window.__ink.setCamYaw(0); });
    s = await page.evaluate(() => window.__t.run({ strike: true }, 40));
    ok(s.bells[0] === 1 && (s.lift.state === 'wait' || s.lift.state === 'up'), `${tag} 出手敲響第一口鐘（鐘 ${s.bells}, 吊台 ${s.lift.state}）`);
    await shot('bell');
    await page.evaluate(() => window.__t.run({ mx: -1, until: (s) => s.pos[0] < -1.6 }, 60));
    s = await page.evaluate(() => window.__t.hop(-4, -88.7, 1.6));
    ok(s.mode === 'ground' && s.pos[1] > 11.2, `${tag} 跳上吊台（${f2(s.pos)}, 吊台 ${s.lift.state}）`);
    s = await page.evaluate(() => window.__t.run({ until: (s) => s.lift.state === 'top' }, 600));
    ok(s.lift.state === 'top' && Math.abs(s.pos[1] - 17) < 0.06, `${tag} 吊台把人載到上庭（y=${s.pos[1].toFixed(2)}）`);
    s = await page.evaluate(() => window.__t.run({ my: 1, until: (s) => s.pos[2] < -91.5 }, 120));
    ok(s.mode === 'ground' && Math.abs(s.pos[1] - 17) < 0.05, `${tag} 走下吊台到上庭（${f2(s.pos)}）`);
    // 吊台下降時下方有人：要停住，不能把人壓進地板
    s = await page.evaluate(() => { const I = window.__ink; I.teleport(-4, 11, -88.7, Math.PI); let lo = 99; for (let i = 0; i < 900; i++) { const s = I.step(1); lo = Math.min(lo, s.pos[1]); } return { lo, s: I.state() }; });
    ok(s.lo > 10.9 && s.s.mode === 'ground' && s.s.lift.y > 12.9, `${tag} 吊台下方有人時停住（人最低 y=${s.lo.toFixed(2)}、吊台 y=${s.s.lift.y.toFixed(2)}）`);
    s = await page.evaluate(() => { const I = window.__ink; I.teleport(-1, 11, -86); for (let i = 0; i < 400 && I.state().lift.state !== 'down'; i++) I.step(1); return I.state(); });
    ok(s.lift.state === 'down', `${tag} 人走開後吊台降回原位（${s.lift.state}）`);
    await page.evaluate(() => { window.__ink.teleport(8, 17, -95.1, Math.PI); window.__ink.setCamYaw(0); });
    s = await page.evaluate(() => window.__t.run({ strike: true }, 200));
    ok(s.bells[1] === 1 && s.gate > 0.8, `${tag} 敲第二口鐘、山門打開（${s.gate.toFixed(2)}）`);
    await shot('gate');
    s = await page.evaluate(() => { const I = window.__ink; I.teleport(0.75, 17, -98.5, Math.PI); I.setCamYaw(0); return window.__t.run({ my: 1, until: (s) => s.pos[2] < -103 }, 200); });
    ok(s.pos[2] < -103 && s.pos[0] > 0.9, `${tag} 門扇往內開、貼著左側門框走也過得去且不穿門（${f2(s.pos)}）`);
    await page.evaluate(() => { window.__ink.teleport(2.5, 17, -98, Math.PI); window.__ink.setCamYaw(0); });
    s = await page.evaluate(() => window.__t.run({ my: 1, until: (s) => s.done }, 400));
    ok(s.done, `${tag} 穿過山門走到終點燈籠（${f2(s.pos)}）`);
    await page.evaluate(() => window.__t.run({}, 100));
    await page.waitForTimeout(1600);
    ok(inView(await rect(page, '#done'), w, h), `${tag} 過關卡片在視窗內`);
    await shot('done');
    await page.evaluate(() => document.querySelector('#againBtn').click());
    s = await st();
    ok(!s.done && s.pos[2] > 0 && s.lit === 0 && s.lift.state === 'down' && s.gate < 0.01, `${tag} 再走一次會重置（${f2(s.pos)}, 燈 ${s.lit}, 吊台 ${s.lift.state}）`);

    // 墜落重生
    await page.evaluate(() => { window.__ink.teleport(-1.5, 4, -40.5, Math.PI); window.__ink.setCamYaw(0); });
    s = await page.evaluate(() => window.__t.run({ my: 0, mx: 0 }, 30));
    s = await page.evaluate(() => window.__t.run({ my: -1, until: (s) => s.mode === 'dead' }, 300));
    ok(s.mode === 'dead', `${tag} 走下平台會墜落（${s.mode}）`);
    s = await page.evaluate(() => window.__t.run({}, 90));
    ok(s.mode === 'ground' && s.falls >= 1 && s.pos[1] > 3.9, `${tag} 回到最後點亮的燈籠（${f2(s.pos)}, 墜 ${s.falls}）`);
    // 放手、往後躍
    await page.evaluate(() => { window.__ink.teleport(0, 4, -41.2); window.__ink.setCamYaw(0); });
    s = await page.evaluate(() => { const t = window.__t; t.run({ my: 1 }, 12); return t.run({ my: 1, jump: true, jumpHeld: true, until: (s) => s.mode === 'hang' }, 60); });
    s = await page.evaluate(() => { const t = window.__t; t.run({}, 10); t.run({ my: -1 }, 12); return t.run({}, 60); });
    ok(s.mode === 'ground' && Math.abs(s.pos[1] - 4) < 0.05, `${tag} S 放手落回平台（${s.mode}）`);
    s = await page.evaluate(() => { const t = window.__t; t.run({ my: 1 }, 12); return t.run({ my: 1, jump: true, jumpHeld: true, until: (s) => s.mode === 'hang' }, 60); });
    s = await page.evaluate(() => { const t = window.__t; t.run({}, 10); return t.run({ my: -1, jump: true, jumpHeld: true }, 8); });
    ok(s.mode === 'air' && s.vel[2] > 3, `${tag} S＋空白 往後躍離牆（v=${f2(s.vel)}）`);
    s = await page.evaluate(() => window.__t.run({}, 120));
    ok(s.clothOK, `${tag} 布料數值穩定`);
    ok(await overflow(), `${tag} 遊戲中沒有水平溢出`);
    // 暫停
    await page.evaluate(() => window.__ink.manual(false));
    await page.click('#pauseBtn');
    await page.waitForTimeout(200);
    ok(inView(await rect(page, '#pause'), w, h) && (await st()).paused, `${tag} 暫停卡片在視窗內`);
    await shot('pause');
    await page.click('#resumeBtn');

    ok(log.pageerrors.length === 0, `${tag} 沒有 uncaught exception ${log.pageerrors.slice(0, 2).join(' | ')}`);
    ok(log.errors.length === 0, `${tag} 沒有 console.error ${log.errors.slice(0, 2).join(' | ')}`);
    ok(log.external.length === 0, `${tag} 沒有外部網路請求 ${log.external.slice(0, 2).join(' ')}`);
    console.log(`  (${log.gpu}${log.warns.length ? `, ${log.warns.length} 則警告：${log.warns[0].slice(0, 120)}` : ''})`);
  } catch (e) { ok(false, `${tag} 例外：${e.message}`); }
  await browser.close();
}
console.log(fail ? `\n${fail} 項失敗` : '\n全部通過');
process.exit(fail ? 1 : 0);
