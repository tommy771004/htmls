// 驗收：1440×900 與 390×844 兩種尺寸，檢查錯誤、外部請求、viewport、水平溢出、
// 開始畫面、購買升級、海灘顧客與船隻、物流與海港（開港、投標、補給船卸貨、省下供應成本）、
// v1／v2 舊存檔遷移，以及模擬手機的影格時間。
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { open, raf } from './lib.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const html = resolve(root, '../../web/261-bayfront-empire.html');
let fail = 0;
const ok = (c, msg) => { console.log(`${c ? '✔' : '✘'} ${msg}`); if (!c) fail++; };

for (const [w, h] of [[1440, 900], [390, 844]]) {
  const mobile = w < 600;
  console.log(`\n── ${w}×${h} ──`);
  const { browser, page, log } = await open(html, { w, h, touch: mobile });
  try {
    ok(await page.evaluate(() => !!document.querySelector('meta[name=viewport]')), 'viewport meta');
    ok(await page.evaluate(() => !!document.querySelector('.mcard.start')), '開始畫面');
    // 新遊戲：買下咖啡館
    await page.click('[data-start=new]');
    await raf(page);
    await page.evaluate(() => { __bf.setTime(11); __bf.setWeather('sunny'); });
    const cafe0 = await page.evaluate(() => __bf.state.money);
    await page.evaluate(() => __bf.ui.openBiz('cafe'));
    await page.click('[data-buy=cafe]');
    ok(await page.evaluate(() => __bf.state.biz.cafe.lv === 1), '從面板買下咖啡館');
    ok(await page.evaluate((m) => __bf.state.money === m - 60000 + 20000, cafe0), '扣款並拿到第一個任務獎勵');
    await page.evaluate(() => __bf.ui.close());
    // 經營一段時間：有顧客上門收錢
    await page.evaluate(() => __bf.fast(25, 1));
    ok(await page.evaluate(() => __bf.state.biz.cafe.visits > 0), '咖啡館有顧客消費');
    // 海灘改版：全部商家開到 Lv2，正午晴天
    await page.evaluate(() => { __bf.buyAll(2); __bf.setTime(11.5); __bf.setWeather('sunny'); __bf.fast(50, 1); });
    const st = await page.evaluate(() => ({ s: __bf.stats(), v: Object.fromEntries(['snack', 'umbrella', 'surf', 'boat', 'jetski'].map((id) => [id, __bf.state.biz[id].visits])) }));
    for (const [id, n] of Object.entries(st.v)) ok(n > 0, `海灘商家 ${id} 有消費（${n}）`);
    ok(st.s.boatsOut + st.s.jetsOut > 0, `海上有出租船或水上摩托車（船 ${st.s.boatsOut}、摩托車 ${st.s.jetsOut}）`);
    ok(st.s.agents > 40, `街上與海灘有行人（${st.s.agents}）`);
    // 面板與標籤
    // 物流與海港：從面板開港、補給船到港卸貨、投標合約
    await page.evaluate(() => { __bf.ui.close(); __bf.give(2e6); });
    await page.click('.nav [data-p=port]');
    await page.click('[data-pbuy]');
    ok(await page.evaluate(() => __bf.state.port.lv === 1), '從物流面板開設海港');
    await page.evaluate(() => { __bf.setTime(8); __bf.setWeather('sunny'); });
    const port = await page.evaluate(() => {
      let seen = { unloading: false, stocked: false };
      for (let i = 0; i < 400 && !(seen.unloading && seen.stocked); i++) {
        __bf.fast(0.5, 6);
        const p = __bf.state.port;
        if (p.ships.some((q) => q.state === 'unloading')) seen.unloading = true;
        if (p.stock.food + p.stock.goods + p.stock.fuel > 0) seen.stocked = true;
      }
      return { ...seen, hulls: __bf.harbor.stats(), saved: __bf.state.today.saved, offers: __bf.state.port.offers.length };
    });
    ok(port.unloading, '補給船靠泊卸貨');
    ok(port.stocked, `卸下的貨櫃入庫（堆場 ${port.hulls.yard} 櫃）`);
    await page.evaluate(() => __bf.fast(20, 2));
    const saved = await page.evaluate(() => __bf.state.today.saved + __bf.state.history.reduce((t, h) => t + (h.saved || 0), 0));
    ok(saved > 0, `走港口進貨省下供應成本（${Math.round(saved)}）`);
    await page.evaluate(() => { for (let i = 0; i < 40 && !__bf.state.port.offers.length; i++) __bf.fast(1, 6); __bf.ui.portTab('bid'); __bf.ui.close(); });
    await page.click('.nav [data-p=port]');
    const hasOffer = await page.evaluate(() => !!document.querySelector('[data-bid]'));
    ok(hasOffer, '合約分頁有招標');
    if (hasOffer) {
      await page.evaluate(() => { const r = document.querySelector('[data-bidr]'); r.value = 60; r.dispatchEvent(new Event('input', { bubbles: true })); });
      ok(await page.evaluate(() => document.querySelector('[data-cv]').textContent === '96%' || parseInt(document.querySelector('[data-cv]').textContent) > 80), '滑桿調低出價提高得標機率');
      await page.click('[data-bid]');
      ok(await page.evaluate(() => /得標/.test(document.querySelector('.toast span').textContent)), '送出投標並顯示結果');
    }
    await page.evaluate(() => __bf.ui.close());
    for (const p of ['manage', 'shop', 'finance', 'port', 'alerts']) {
      await page.evaluate(() => __bf.ui.close());
      await page.click(`.nav [data-p=${p}]`);
      ok(await page.evaluate(() => !document.getElementById('sheet').hidden), `開啟 ${p} 面板`);
    }
    await page.evaluate(() => __bf.ui.close());
    // 水平溢出
    ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.body.scrollWidth <= innerWidth), '無水平溢出');
    // 存檔：v1 舊存檔放進 localStorage，重新載入後選「繼續」
    await page.evaluate(() => __bf.stopSaving());
    await page.evaluate(() => localStorage.setItem('bayfront-empire', JSON.stringify({ v: 1, cash: 777000, day: 4, time: 600, shops: { cafe: 2, bar: 1 }, quest: 3 })));
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(() => window.__bf && window.__bf.ready);
    await page.click('[data-start=cont]');
    await raf(page);
    const mig = await page.evaluate(() => ({ m: __bf.state.money, cafe: __bf.state.biz.cafe.lv, boat: __bf.state.biz.boat.lv, v: JSON.parse(localStorage.getItem('bayfront-empire')).v, modal: !!document.getElementById('goBeach') }));
    ok(mig.m === 777000 && mig.cafe === 2 && mig.boat === 0, 'v1 存檔遷移保留資金與店家');
    ok(mig.v === 3, '遷移後以 v3 格式存回');
    ok(mig.modal, '顯示海灘改版公告');
    await page.click('#goBeach');
    // v2 存檔（物流改版前）：保留海灘商家，顯示物流改版公告
    await page.evaluate(() => __bf.stopSaving());
    await page.evaluate(() => localStorage.setItem('bayfront-empire', JSON.stringify({ v: 2, money: 3210000, day: 12, minute: 700, quest: 10, biz: { cafe: { lv: 3, earned: 1, visits: 1 }, boat: { lv: 2, earned: 1, visits: 1 } }, today: { rev: { boat: 5000 }, visits: {}, turned: {}, cost: 0, buy: 0 } })));
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(() => window.__bf && window.__bf.ready);
    await page.click('[data-start=cont]');
    await raf(page);
    const m2 = await page.evaluate(() => ({ m: __bf.state.money, boat: __bf.state.biz.boat.lv, port: __bf.state.port.lv, v: JSON.parse(localStorage.getItem('bayfront-empire')).v, modal: !!document.getElementById('goPort') }));
    ok(m2.m === 3210000 && m2.boat === 2 && m2.port === 0, 'v2 存檔遷移保留資金與海灘商家，海港為未開設');
    ok(m2.v === 3 && m2.modal, '以 v3 存回並顯示物流改版公告');
    await page.click('#goPort');
    ok(await page.evaluate(() => __bf.ui.isOpen() === 'port'), '公告按鈕開啟物流面板');
    await page.evaluate(() => __bf.ui.close());
    // 效能：模擬中階手機（CPU 4 倍降速）量 3 秒的平均影格時間
    const cdp = await page.context().newCDPSession(page);
    if (mobile) await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await page.evaluate((mobile) => { __bf.buyAll(3); __bf.buyPort(3); __bf.state.port.reorder.food = 1500; __bf.setTime(13); __bf.setWeather('sunny'); __bf.fast(6, 6); __bf.look(-120, 30, mobile ? 150 : 140); }, mobile);
    await page.waitForTimeout(1500);
    const perf = await page.evaluate(() => new Promise((r) => {
      const ts = [];
      let t0 = performance.now();
      const f = (t) => { ts.push(t - t0); t0 = t; if (ts.length < 180) requestAnimationFrame(f); else r(ts.slice(10)); };
      requestAnimationFrame(f);
    }));
    const avg = perf.reduce((a, b) => a + b, 0) / perf.length;
    const fps = 1000 / avg;
    console.log(`  平均影格 ${avg.toFixed(1)} ms（${fps.toFixed(0)} fps）${mobile ? '，CPU 4× 降速' : ''}；draw calls ${await page.evaluate(() => __bf.renderer.info.render.calls)}`);
    ok(fps >= 50, `影格率 ≥ 50fps（${fps.toFixed(0)}）`);
    if (mobile) await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    await page.screenshot({ path: resolve(tmpdir(), `bayfront-accept-${w}.png`) });
    ok(log.pageerrors.length === 0, `無 uncaught exception ${log.pageerrors.join(' | ')}`);
    ok(log.errors.length === 0, `無 console.error ${log.errors.join(' | ')}`);
    ok(log.external.length === 0, `無外部網路請求 ${log.external.join(' ')}`);
    console.log(`  GPU：${log.gpu}`);
  } finally {
    await browser.close();
  }
}
console.log(fail ? `\n${fail} 項未通過` : '\n全部通過');
process.exit(fail ? 1 : 0);
