// 主線《一手爛牌》（69-w0-story.js）的驗收：新存檔從序章開始、操作羅莎；每一關用 __nc.story.skip() 一步步跳完，
// 檢查步驟都走得到、報酬與獎牌、首次完成的獎勵（戴恩解鎖、掃描器、E34 收進車庫）、轉盤鎖定、腳鐐超出範圍加星；兩種尺寸各截一張圖。
// 另外開一頁不帶 story（lib.mjs 預設 story=0）：照舊的「門禁」開場、五人都能切換。
// 用法：node tools/check-story.mjs [html]（預設 web/260-neon-nightcity.html）；SHOT=目錄 另存截圖
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';
import { open } from './lib.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const htmlPath = resolve(process.argv[2] || resolve(root, '../../web/260-neon-nightcity.html'));
const shotDir = process.env.SHOT || '';
if (shotDir) mkdirSync(shotDir, { recursive: true });
let failed = 0;
function check(cond, msg) { console.log(`  ${cond ? '✓' : '✗'} ${msg}`); if (!cond) failed++; }
const helpers = () => {
  window.__t = {
    step(n) { for (let i = 0; i < n; i++) window.__nc.step(1 / 60); },
    // 一關跑到底：每一步先讓它跑一下（過場、傳送），再 skip；回傳走過的步驟
    sleep: ms => new Promise(r => setTimeout(r, ms)),
    // 黑場（60-venues.js 的 transition）是真實時間的 setTimeout：等它跑完
    async settle() { for (let i = 0; i < 20 && (document.getElementById('fade').classList.contains('on') || window.__nc.story.state().fading); i++) { await __t.sleep(120); __t.step(2); } },
    async run(id, max = 160) {
      const N = window.__nc, St = N.story, seen = [];
      for (let i = 0; i < max; i++) {
        await __t.settle();
        const s = St.state();
        if (!s.act || s.act.id !== id) break;
        if (seen[seen.length - 1] !== `${s.act.k}:${s.act.type}`) seen.push(`${s.act.k}:${s.act.type}`);
        __t.step(40);
        await __t.settle();
        const s2 = St.state();
        if (s2.act && s2.act.k === s.act.k) St.skip();
        __t.step(10);
        if (N.dialog.open) N.closeDialog();
      }
      __t.step(30);
      return seen;
    },
    dismiss() { const el = document.getElementById('heistDone'); el.classList.remove('on'); },
  };
};

async function pass(page, sec, id, extra) {
  return sec(`${id}`, async ([id, extra]) => {
    const N = window.__nc, St = N.story;
    __t.dismiss();
    const cash0 = N.motors.cash;
    if (!St.state().act || St.state().act.id !== id) St.go(id);
    await __t.settle(); __t.step(40);
    const steps = await __t.run(id);
    const s = St.state();
    return { steps, done: s.done.includes(id), m: s.m, cur: s.cur, pay: N.motors.cash - cash0, medal: s.medal[id], cast: s.cast, flags: s.flags, owned: N.motors.owned.slice(), retry: s.retry,
      x: extra === 'mon' ? St.mon() : null };
  }, [id, extra]);
}

for (const [w, h] of [[1440, 900], [390, 844]]) {
  console.log(`── ${w}×${h} ──`);
  const { browser, page, log } = await open(htmlPath, { w, h, touch: w < 600, query: '?story=1' });
  async function sec(title, fn, arg) {
    console.log(title);
    try { return await page.evaluate(fn, arg); } catch (e) { check(false, `執行失敗：${String(e.message || e).split('\n')[0]}`); return null; }
  }
  await page.evaluate(helpers);
  try {
    const b = await sec('開場：新存檔從序章開始、操作羅莎，其他人鎖著', () => {
      const N = window.__nc, St = N.story;
      const before = { quest: N.quest.n, cur: St.state().cur, obj: document.getElementById('objText').textContent };
      N.start(); __t.step(60);
      const s = St.state();
      return { ...before, act: s.act && s.act.id, card: s.card, kael: St.avail(1), dane: St.avail(St.DANE), rosa: St.avail(St.ROSA), why: St.why(1), title: document.getElementById('stCardT').textContent };
    });
    if (b) {
      check(b.cur === 'rosa' && b.quest === 6, `開場操作 ${b.cur}、門禁停在第 ${b.quest} 步（等 3-1）`);
      check(b.act === 'P-1' && b.card, `按進場直接開始 P-1，字卡「${b.title}」`);
      check(!b.kael && !b.dane && b.rosa, `序章只能操作羅莎（凱爾：${b.why}）`);
    }
    if (shotDir) await page.screenshot({ path: `${shotDir}/story-card-${w}.png` });
    const order = ['P-1', 'P-2', 'P-3', '1-1', '1-2', '1-3', '1-4', '1-5'];
    const R = {};
    for (const id of order) {
      R[id] = await pass(page, sec, id, id === 'P-2' ? 'mon' : '');
      const r = R[id];
      if (!r) continue;
      check(r.done, `${id} 完成（${r.steps.join(' ')}），下一關 ${r.m}，報酬 $${r.pay.toLocaleString('en-US')}${r.medal != null ? `、獎牌 ${r.medal}` : ''}`);
      if (id === 'P-2' && shotDir) await page.screenshot({ path: `${shotDir}/story-p2-${w}.png` });
    }
    if (R['P-2']) check(R['P-2'].owned.includes('e34') && R['P-2'].pay >= 20000, `P-2：E34 收進車庫、報酬 ≥ $20,000`);
    if (R['1-1']) check(R['1-1'].cast.dane === 1 && R['1-1'].cur === 'dane', `1-1：操作戴恩、完成後戴恩解鎖`);
    if (R['1-3']) check(R['1-3'].flags.scan === 1 && R['1-3'].pay === 0, '1-3：劇情任務不給錢，解鎖警用掃描器');
    if (R['1-4']) check(R['1-4'].done && R['1-4'].pay >= 50000, `1-4：搶 BODEGA、甩掉警察（$${R['1-4'] && R['1-4'].pay}）`);
    const re = await sec('重玩：同樣的獎牌不再發錢', async () => {
      const N = window.__nc, St = N.story, cash0 = N.motors.cash;
      __t.dismiss(); St.go('1-1'); await __t.settle(); __t.step(40); await __t.run('1-1');
      return { pay: N.motors.cash - cash0, m: St.state().m };
    });
    if (re) check(re.pay >= 0 && re.pay <= 10000, `重玩 1-1 只補獎牌差額（$${re.pay}）`);
    const mon = await sec('腳鐐：羅莎走出範圍，30 秒後加 1 星', () => {
      const N = window.__nc, St = N.story;
      __t.dismiss(); N.gta.wanted.clear('reset');
      St.go('1-5', false); St.state();
      if (St.state().cur !== 'rosa') N.gta.crew.load(St.ROSA);
      const f = St.far(); N.tp(f.x, f.z); __t.step(30);
      const m0 = St.mon(), chip = document.getElementById('stChipT').textContent;
      __t.step(60 * 32);
      return { m0, chip, stars: N.gta.wanted.W ? N.gta.wanted.W.stars : null, m1: St.mon(), cur: St.state().cur };
    });
    if (mon) check(mon.m0.on && mon.m0.d > 380 && (mon.stars === null || mon.stars >= 1), `離國宅 ${mon.m0.d} m：「${mon.chip}」→ 通緝 ${mon.stars} 星`);
  } catch (e) { check(false, String(e.message || e)); }
  check(!log.pageerrors.length, `沒有頁面錯誤${log.pageerrors.length ? '：' + log.pageerrors.slice(0, 3).join(' | ') : ''}`);
  check(!log.errors.length, `沒有 console.error${log.errors.length ? '：' + log.errors.slice(0, 3).join(' | ') : ''}`);
  await browser.close();
}

{
  console.log('── story=0（lib.mjs 預設）──');
  const { browser, page, log } = await open(htmlPath, { w: 1280, h: 800 });
  const r = await page.evaluate(() => { const N = window.__nc; N.start(); for (let i = 0; i < 30; i++) N.step(1 / 60); return { quest: N.quest.n, on: N.story.on(), act: !!N.story.act(), all: [0, 1, 2, 3, 4].every(i => N.story.avail(i)), obj: document.getElementById('objText').textContent }; });
  check(r.quest === 0 && !r.on && !r.act && r.all, `照舊的開場：「${r.obj}」、主線關掉、五人都能切換`);
  check(!log.pageerrors.length && !log.errors.length, `沒有錯誤${[...log.pageerrors, ...log.errors].slice(0, 3).join(' | ')}`);
  await browser.close();
}
console.log(failed ? `✗ ${failed} 項沒過` : '✓ 全部通過');
process.exit(failed ? 1 : 0);
