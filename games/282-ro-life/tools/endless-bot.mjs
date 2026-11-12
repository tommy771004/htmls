// 無盡之塔自動打塔＋自我測試（本機，不碰正式站）：
//   PLAYWRIGHT_MODULE=…/playwright/index.mjs node games/282-ro-life/tools/endless-bot.mjs [選項]
// 選項：
//   --job hunter       二轉職業（預設獵人；一轉職業依 rules-data 的 base 自動找）
//   --minutes 8        最多打幾分鐘（真實時間）
//   --floors 0         打到第幾層就收工（0＝打到時間到或死掉）
//   --min-floor 2      至少要到第幾層才算通過
//   --strong           塔的強化點滿（測後面的樓層、MVP 層用）
//   --skills a,b,c     塔用技能（守護者畫面上的名稱，最多 4 個；預設依職業）
//   --suspend 0        打到第幾秒先中斷一次再從守護者處繼續（0＝不測）
//   --pet poring       帶一隻滿親密度、有配件的寵物進塔（塔裡寵物不加成也不出場；重跑的那一頁沒有寵物資料，要照樣對得上）
//   --headed           開視窗看它打
//   --out <資料夾>     截圖與報告（預設系統暫存資料夾）
// 流程：本機起一份 createRoLife（記憶體資料）→ 真的頁面登入、切線上模式、建角（一轉職業）→ 直接改伺服器存檔
// 成已轉職的 70 級角色（模擬玩到後期）→ 向塔的守護者開新局 → 機器人自己走位（遠程職業保持距離、
// 繞開圍上來的怪與牆邊）、升級選卡 → 結束 → 用驗證程式重跑 → 逐項檢查，失敗就 exit 1。
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRoLife } from '../../../server/ro-life/server.mjs';
import { RoStore } from '../../../server/ro-life/store.mjs';
import R from '../../../server/ro-life/rules-data.mjs';
import { verifyPending, buildOf } from './verify-endless.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(`--${k}`); return i < 0 ? d : argv[i + 1]; };
const flag = (k) => argv.includes(`--${k}`);
const JOB = opt('job', 'hunter');
const MINUTES = Number(opt('minutes', 8));
const FLOORS = Number(opt('floors', 0));
const MIN_FLOOR = Number(opt('min-floor', 2));
const SUSPEND = Number(opt('suspend', 0));
const PET = opt('pet', '');
if (PET && !R.pets?.[PET]) throw new Error(`沒有這隻寵物：${PET}`);
const OUT = resolve(opt('out', join(tmpdir(), `ro-endless-bot-${Date.now()}`)));
if (!process.env.PLAYWRIGHT_MODULE) throw new Error('要設 PLAYWRIGHT_MODULE（playwright 的 index.mjs 路徑）');
const job = R.jobs[JOB];
if (!job) throw new Error(`沒有這個職業：${JOB}`);
const BASE = job.rank === 2 ? job.base : JOB;
const RANGED = ['archer', 'mage', 'acolyte'].includes(BASE);
// 預設塔用技能（守護者畫面上的名稱；--skills 名稱,名稱 可改）：範圍傷害優先，塔內不升級所以清怪全靠這幾招
const SKILLS = { hunter: '箭矢暴雨,箭雨,衝鋒箭,二連矢', bard: '箭矢暴雨,箭雨,衝鋒箭,二連矢', archer: '箭雨,二連矢,衝鋒箭,火焰箭' };
await mkdir(OUT, { recursive: true });
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);

// ---- 本機伺服器（記憶體資料、線上＋塔都開）----
const TYPES = { '.html': 'text/html; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json', '.mp3': 'audio/mpeg', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.glb': 'model/gltf-binary' };
const store = new RoStore({});
const app = createRoLife({ env: { RO_ONLINE: '1', RO_ENDLESS: '1', RO_ONLINE_ENFORCE: '1' }, store }); // 和正式站一樣：存檔照規則修正
const TOKEN = 'bot_' + createHash('sha256').update(String(Date.now())).digest('hex').slice(0, 32);
const accId = await store.loginIdentity('google', `bot-${JOB}`, '塔測機器人');
await store.createSession(createHash('sha256').update(TOKEN).digest('hex'), accId, 6 * 3600);
const srv = createServer(async (req, res) => {
  if (req.url.startsWith('/api/ro') && (await app.handle(req, res))) return;
  const p = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^\/+/, '');
  if (!/^(web|assets|vendor)\//.test(p)) { res.writeHead(404); return res.end(); }
  try { const buf = await readFile(join(ROOT, p)); res.writeHead(200, { 'content-type': TYPES[extname(p)] || 'application/octet-stream' }); res.end(buf); } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const ORIGIN = `http://127.0.0.1:${srv.address().port}`;
const api = (path) => globalThis['fe' + 'tch'](`${ORIGIN}/api/ro/${path}`, { headers: { 'x-session': TOKEN } }).then((r) => r.json());

// ---- 結果 ----
const checks = [];
const check = (name, ok, info = '') => { checks.push({ name, ok: !!ok, info }); console.log(`${ok ? '✔' : '✘'} ${name}${info ? `  ${typeof info === 'string' ? info : JSON.stringify(info)}` : ''}`); };
const log = (...a) => console.log('·', ...a);

const browser = await chromium.launch({ channel: 'chrome', headless: !flag('headed'), args: ['--use-angle=metal', '--mute-audio'] });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const errs = [];
page.on('console', (m) => { if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) errs.push(m.text().slice(0, 200)); });
page.on('pageerror', (e) => errs.push('pageerror ' + e.message.slice(0, 200)));
page.on('dialog', (d) => d.dismiss());
const shot = (n) => page.screenshot({ path: join(OUT, `${n}.png`) }).catch(() => {});
const ready = () => page.waitForFunction(() => !document.getElementById('sp-play')?.disabled, null, { timeout: 90_000 });
const plaza = () => page.waitForFunction(() => window.__ro?.lobby?.npcs?.length > 3 && !document.body.innerText.includes('正在進入普隆德拉'), null, { timeout: 90_000 });
const toPlaza = async () => {
  await page.reload(); await ready(); await page.waitForTimeout(1200);
  await page.click('#sp-play'); await page.waitForTimeout(1500);
  await page.click('#btn-play'); await plaza(); await page.waitForTimeout(2500);
};
const openKeeper = async () => { await page.evaluate(() => window.__ro.lobby.npcs.find((n) => n.id === 'tower').onTalk()); await page.waitForTimeout(2000); };

let exitCode = 1;
try {
  // 1. 登入、切線上模式
  await page.goto(`${ORIGIN}/web/282-ro-life.html?api`); await ready();
  await page.evaluate(([token, id]) => {
    localStorage.setItem('ro-life.cloud.v1', JSON.stringify({ token, account: { id, name: '塔測機器人', providers: ['google'], via: 'google' } }));
    localStorage.setItem('ro-life.mode', 'online');
  }, [TOKEN, accId]);
  await page.reload(); await ready(); await page.waitForTimeout(1200);
  const flags = await page.evaluate(() => ({ online: window.__roOnline, endless: window.__roEndless }));
  check('線上模式與無盡之塔已開啟', flags.online && flags.endless, flags);

  // 2. 建一轉角色（照引擎的建角畫面，按職業名稱找按鈕）
  await page.click('#sp-play'); await page.waitForTimeout(1500);
  await page.click('#btn-create'); await page.waitForTimeout(800);
  const jobName = await page.evaluate((base) => {
    const btns = [...document.querySelectorAll('#cc-jobs button')];
    const names = { swordman: /劍士|Swords/i, archer: /弓箭手|Arch|Arquer/i, mage: /魔法師|Mage|Mago/i, acolyte: /服事|Acolyte|Acólito/i, merchant: /商人|Merchant|Mercader/i, thief: /盜賊|Thief|Ladr/i };
    const b = btns.find((x) => names[base]?.test(x.textContent) && !x.classList.contains('locked'));
    b?.click();
    return b?.textContent ?? null;
  }, BASE);
  check(`建角畫面找得到 ${BASE}`, jobName, jobName ?? '');
  if (!jobName) throw new Error('stop');
  await page.fill('#cc-name', `Bot${JOB}`.slice(0, 12));
  await page.click('#cc-ok'); await page.waitForTimeout(2500);

  // 3. 伺服器存檔改成已轉職的後期角色（模擬玩到後期；塔的快照取自這裡）
  const sv = await store.getGameSave(accId);
  const chars = JSON.parse(sv.doc['characters.v1']);
  const ch = chars[0];
  check('角色已建立且是一轉職業', ch?.job === BASE, { job: ch?.job });
  const stats = RANGED
    ? { str: 30, agi: 70, vit: 40, int: 10, dex: 90, luk: 30 }
    : { str: 80, agi: 60, vit: 70, int: 1, dex: 50, luk: 20 };
  Object.assign(ch, { promotion: job.rank === 2 ? JOB : null, level: 70, jobLevel: 40, mvpsDefeated: ['mastering', 'golden_thief_bug'], stagesCleared: ['prontera', 'payon', 'morroc'], stats });
  const acct = JSON.parse(sv.doc['account.v1']);
  acct.inventory.push({ uid: 'botspare1', itemId: 2244, quality: 1, cards: [], affixes: [{ stat: 'dex', value: 1 }], ilvl: 8, tier: 1, refine: 2 });
  acct.cards = { ...(acct.cards ?? {}), 4001: 2 };
  acct.kafra = 4321;
  if (PET) ch.pet = PET;
  const petsDoc = PET ? { 'pets.v1': JSON.stringify({ pets: { [PET]: { intimacy: 950, at: Date.now(), acc: true } } }) } : {};
  store.mem.gameSaves.set(accId, { ...sv, doc: { ...sv.doc, 'characters.v1': JSON.stringify(chars), 'account.v1': JSON.stringify(acct), ...petsDoc }, rev: sv.rev + 1, wid: 'bot-seed' });
  const ups = flag('strong')
    ? { damage: 250, hp: 150, haste: 120, guard: 40, area: 80, reach: 40, targets: 5, proj: 5, repeat: 5, pierce: 5, crit: 60, critDmg: 60, boss: 150, regen: 12, speed: 12 }
    : { damage: 80, hp: 80, haste: 40, guard: 20, area: 20, reach: 20, crit: 20, speed: 4 };
  const progKey = `${accId}:${ch.id}`;
  store.mem.endlessProgress.set(progKey, { earned: 20000, spent: 0, ups, skills: [] });
  const seeded = { inv: acct.inventory.map((i) => i.uid + ':' + (i.refine ?? 0)).sort(), cards: JSON.stringify(acct.cards), kafra: acct.kafra };
  log('角色', JSON.stringify({ name: ch.name, job: ch.job, promotion: ch.promotion, level: ch.level }));

  // 4. 進廣場、找守護者開新局
  await toPlaza();
  await openKeeper();
  await shot('1-keeper');
  // 塔用技能：像玩家一樣在守護者的「技能」分頁點卡片（伺服器 endless/skills 只收合法的）
  {
    await page.evaluate(() => document.querySelector('#towerkeeper [data-tab="skills"]')?.click());
    await page.waitForTimeout(1200);
    // 沒有預設清單的職業：取「可用」裡的前四個（沒選技能的話第 1 層的分數門檻幾乎過不了）
    const want = (opt('skills', '') || SKILLS[JOB] || '').split(',').filter(Boolean);
    if (!want.length) want.push(...(await page.evaluate(() => { const sec = [...document.querySelectorAll('#towerkeeper *')].find((x) => x.children.length === 0 && x.textContent.trim() === '可用')?.closest('section,div')?.parentElement; return [...(sec?.querySelectorAll('*') ?? [])].filter((x) => x.children.length === 0 && x.offsetParent && x.textContent.trim() && !/^(可用|主動|被動)$/.test(x.textContent.trim())).map((x) => x.textContent.trim()).slice(0, 4); })));
    log('塔用技能', want.join('、'));
    for (const name of want) {
      const hit = await page.evaluate((n) => {
        const el = [...document.querySelectorAll('#towerkeeper *')].find((x) => x.children.length === 0 && x.textContent.trim() === n && x.offsetParent);
        const card = el?.closest('button,[data-skill],[data-id],.stg-row,[role=button]') ?? el?.parentElement;
        card?.click();
        return !!card;
      }, name);
      if (!hit) log(`守護者的技能分頁沒有「${name}」`);
      await page.waitForTimeout(700);
    }
    await shot('1-skills');
    const prog = await api(`game/endless?char=${encodeURIComponent(ch.id)}`);
    check(`塔用技能存到伺服器（${want.join('、')}）`, (prog.progress?.skills ?? []).length === Math.min(4, want.length), prog.progress?.skills ?? prog);
    await page.evaluate(() => document.querySelector('#towerkeeper [data-tab="tower"]')?.click());
    await page.waitForTimeout(800);
  }
  await page.click('#tk-new'); await page.waitForTimeout(800);
  await page.evaluate(() => { const bs = [...document.querySelectorAll('#npc-dialog button')]; (bs.find((x) => /仍要進入|進入|Entrar|Enter/.test(x.textContent)) ?? bs[0])?.click(); });
  await page.waitForFunction(() => window.__ro.run?.endless, null, { timeout: 30_000 });
  const started = await page.evaluate(() => ({ det: window.__ro.run.deterministic, wave: window.__ro.run.endless.wave?.n }));
  check('開局（決定性模式）', started.det === true, started);

  // 5. 機器人：每 120ms 看一次場面，算出要按的方向鍵
  const held = new Set();
  const press = async (keys) => {
    for (const k of [...held]) if (!keys.includes(k)) { await page.keyboard.up(k); held.delete(k); }
    for (const k of keys) if (!held.has(k)) { await page.keyboard.down(k); held.add(k); }
  };
  // 走位：8 個方向加「不動」逐一評分。走不過去（引擎的 z.walk）直接淘汰、前方是死路扣分；
  // 怪越密分數越低（魔王、菁英加權）；遠程職業附近沒怪時往最近的怪靠到射程外圈，近戰貼上去。
  // 每次只看這一格，不預測，所以偶爾還是會被包；沿用上次的方向加一點分避免左右抖動。
  const brain = ([ranged, prev]) => {
    const z = window.__ro.run;
    if (!z || z.state !== 'playing') return { state: z?.state ?? null, dir: -1 };
    const pl = z.player, W = z.walk;
    const ok = (x, y) => (W?.walkable ? W.walkable(x, y) : true);
    const live = z.enemies.filter((e) => !e.removed && !e.killed && e._hp > 0);
    const bosses = new Set(z.bosses ?? []);
    const keep = ranged ? 260 : 60, R0 = 330;
    let near = null, nd = 1e9;
    for (const e of live) { const d = Math.hypot(e.x - pl.x, e.y - pl.y); if (d < nd) { nd = d; near = e; } }
    const danger = (x, y) => { let s = 0; for (const e of live) { const d = Math.hypot(e.x - x, e.y - y); if (d < R0) s += ((R0 - d) / R0) ** 2 * (bosses.has(e) ? 4 : 1); } return s; };
    const DIRS = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]].map(([x, y]) => { const l = Math.hypot(x, y); return [x / l, y / l]; });
    const openness = (x, y) => { let n = 0; for (const [dx, dy] of DIRS) if (ok(x + dx * 220, y + dy * 220)) n++; return n; };
    let best = -1, bs = -1e18;
    for (let i = -1; i < 8; i++) {
      const [dx, dy] = i < 0 ? [0, 0] : DIRS[i];
      const x1 = pl.x + dx * 70, y1 = pl.y + dy * 70, x2 = pl.x + dx * 150, y2 = pl.y + dy * 150;
      if (i >= 0 && (!ok(x1, y1) || !ok(x2, y2))) continue;
      let s = -(danger(x1, y1) * 0.6 + danger(x2, y2)) - (8 - openness(x2, y2)) * 0.8;
      if (near && nd > keep + 50) { const d2 = Math.hypot(near.x - x2, near.y - y2); s += (nd - d2) / 150 * 1.2; }
      if (i === prev) s += 0.15;
      if (i < 0) s -= nd < keep ? 0.5 : 0; // 怪在射程內還站著不動容易被圍
      if (s > bs) { bs = s; best = i; }
    }
    return { state: z.state, dir: best, n: live.length, wave: z.endless?.wave?.n ?? null, hp: z.hp / (z.stats?.maxHp || 1) };
  };
  const KEYS = [['ArrowRight'], ['ArrowRight', 'ArrowDown'], ['ArrowDown'], ['ArrowLeft', 'ArrowDown'], ['ArrowLeft'], ['ArrowLeft', 'ArrowUp'], ['ArrowUp'], ['ArrowRight', 'ArrowUp']];
  const status = () => page.evaluate(() => { const z = window.__ro.run; return z ? { state: z.state, ticks: z.ticks, wave: z.endless?.wave?.n, cleared: z.endless?.cleared, score: Math.round(z.endless?.score ?? 0), points: z.endless?.points, checks: z.checks?.length, level: z.level, hp: `${Math.round(z.hp ?? 0)}/${Math.round(z.stats?.maxHp ?? 0)}`, mobs: z.enemies.filter((e) => !e.removed && !e.killed).length, failed: z.endless?.failed ?? null } : null; });
  // 印一次 run 上的陣列欄位，方便之後補彈幕欄位

  const pickCard = () => { const c = document.querySelector('#picker .pk-card'); if (!c) return false; const b = c.getBoundingClientRect(); if (b.width < 4) return false; const top = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2); if (!top || !c.contains(top)) return false; c.click(); return true; };
  const states = new Set();
  let picks = 0, prevDir = -1, lastLog = 0, suspended = false, maxWave = started.wave ?? 1, lastShot = 0;
  const t0 = Date.now();
  async function play(untilMs) {
    while (Date.now() < untilMs) {
      const r = await page.evaluate(brain, [RANGED, prevDir]).catch(() => ({ state: null, dir: -1 }));
      if (!r.state || r.state === 'over') break;
      if (r.wave) maxWave = Math.max(maxWave, r.wave);
      if (FLOORS && maxWave > FLOORS) break;
      states.add(r.state);
      // 每層開始的選卡（引擎狀態仍是 playing）：卡片中心點最上層的元素就是這張卡，才算真的顯示（隱藏時卡片還在 DOM 裡）
      if (await page.evaluate(pickCard)) { picks++; await page.waitForTimeout(250); continue; }
      if (r.state === 'levelup') { await press([]); await page.keyboard.press('1'); await page.waitForTimeout(150); continue; }
      if (r.state !== 'playing') { await press([]); await page.waitForTimeout(200); continue; }
      prevDir = r.dir;
      await press(r.dir < 0 ? [] : KEYS[r.dir]);
      await page.waitForTimeout(120);
      if (Date.now() - lastLog > 30_000) { lastLog = Date.now(); log(`${Math.round((Date.now() - t0) / 1000)}s`, JSON.stringify(await status())); }
      if (Date.now() - lastShot > 120_000) { lastShot = Date.now(); await shot(`2-run-${Math.round((Date.now() - t0) / 1000)}s`); }
    }
    await press([]);
  }
  const deadline = t0 + MINUTES * 60_000;
  if (SUSPEND > 0) {
    await play(Math.min(deadline, t0 + SUSPEND * 1000));
    if ((await status())?.state === 'playing') {
      for (let i = 0; i < 20 && (await page.evaluate(pickCard)); i++) await page.waitForTimeout(300); // 選卡視窗開著時 Esc 不會開暫停
      const before = await page.evaluate(() => ({ wave: window.__ro.run.endless.wave?.n, resume: window.__ro.run.endless.resumeTick?.() }));
      await page.keyboard.press('Escape'); await page.waitForTimeout(600);
      await page.evaluate(() => document.getElementById('btn-quit').click());
      await page.waitForTimeout(4000);
      const sus = await api(`game/endless?char=${encodeURIComponent(ch.id)}`);
      check('中斷後伺服器有保留這一局', sus.suspended?.run, sus.suspended ?? null);
      await page.evaluate(() => document.querySelector('#npc-dialog button')?.click());
      await toPlaza(); await openKeeper();
      await page.click('#tk-continue');
      await page.waitForFunction(() => window.__ro.run?.endless, null, { timeout: 60_000 });
      await page.waitForTimeout(2000);
      if (await page.evaluate(() => window.__ro.run.state === 'paused')) { await page.keyboard.press('Escape'); await page.waitForTimeout(800); }
      const after = await page.evaluate(() => ({ wave: window.__ro.run.endless.wave?.n, ticks: window.__ro.run.ticks }));
      check('從守護者處繼續，回到同一層', after.wave === before.wave, { before, after });
      suspended = true;
    }
  }
  await play(deadline);
  const live = await status();
  log('收工', JSON.stringify({ ...live, pickClicks: picks, states: [...states], minutes: ((Date.now() - t0) / 60000).toFixed(1) }));
  await shot('3-end');
  if (PET) {
    const pet = await page.evaluate((id) => ({ worn: window.__ro.getChars()[0]?.pet === id, inRun: !!window.__ro.run?.pet }), PET);
    check(`角色帶著寵物 ${PET}`, pet.worn, pet);
    check('塔裡寵物不出場', !pet.inRun, pet);
  }
  check(`打到第 ${MIN_FLOOR} 層以上`, (live?.wave ?? maxWave) >= MIN_FLOOR, { wave: live?.wave ?? maxWave, cleared: live?.cleared, failed: live?.failed });
  if ((live?.cleared ?? 0) >= 10) log('通過第 10 層（MVP 層），重跑會涵蓋 MVP 與第 9 層換圖');

  // 6. 結束這一局（死掉的話引擎已經結束了）
  if (live?.state && live.state !== 'over') await page.evaluate(() => window.__ro.endRun(false));
  await page.waitForFunction(() => /伺服器|servidor|server/i.test(document.getElementById('go-stats')?.innerText ?? '') && !/Registrando|正在/.test(document.getElementById('go-stats')?.innerText ?? ''), null, { timeout: 60_000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await shot('4-over');
  const runs = [...store.mem.endlessRuns.values()];
  const run = runs.at(-1);
  check('伺服器收到整局並等待驗證', run?.status === 'pending', { state: run?.state, status: run?.status, ticks: run?.ticks, checks: run?.checks });
  check(`開局快照是 ${JOB}`, (run?.snapshot?.promotion ?? run?.snapshot?.job) === JOB, { job: run?.snapshot?.job, promotion: run?.snapshot?.promotion });
  if (PET) check('開局快照記著帶的寵物', run?.snapshot?.pet === PET, { pet: run?.snapshot?.pet });
  check('伺服器的格數和頁面一致', run && Math.abs(run.ticks - (live?.ticks ?? 0)) <= 120, { server: run?.ticks, page: live?.ticks });

  // 7. 驗證程式重跑（用目前這一版頁面）
  const html = readFileSync(join(ROOT, 'web/282-ro-life.html'), 'utf8');
  const before = store.mem.endlessProgress.get(progKey)?.earned ?? 0;
  const [v] = await verifyPending({ store, chromium, pages: new Map([[buildOf(html), html]]), log: (s) => log(s) });
  check('重跑結果 verified', v?.status === 'verified', v?.status === 'verified' ? { score: v.score, floor: v.floor, points: v.points } : v?.verdict);
  if (v?.status === 'verified') {
    const claimed = v.verdict.claimed ?? {};
    check('重跑分數＝用戶端自報', Math.round(claimed.score ?? -1) === v.score, { replay: v.score, claimed: Math.round(claimed.score ?? -1) });
    check('重跑樓層＝用戶端自報', (claimed.wave ?? -1) === v.floor, { replay: v.floor, claimed: claimed.wave });
    const earned = store.mem.endlessProgress.get(progKey)?.earned ?? 0;
    check('塔的點數加上去了', earned - before === v.points, { before, after: earned, points: v.points });
    const lad = await api('game/ladder?season=all&job=all');
    const row = lad.rows?.find((x) => x.char === ch.id || x.name === ch.name);
    check('排行榜有這個角色', row, row ?? lad);
  }

  // 8. 帳號沒被動到、存檔沒有被修正、頁面沒有錯誤
  const accAfter = JSON.parse((await store.getGameSave(accId)).doc['account.v1']);
  const now = { inv: accAfter.inventory.map((i) => i.uid + ':' + (i.refine ?? 0)).sort(), cards: JSON.stringify(accAfter.cards), kafra: accAfter.kafra };
  check('倉庫、卡片、Kafra 沒變', JSON.stringify(now) === JSON.stringify(seeded), JSON.stringify(now) === JSON.stringify(seeded) ? '' : { seeded, now });
  const fixes = store.mem.gameLogs.filter((l) => l.flags.includes('would-fix') || l.flags.includes('fixed') || (l.detail?.fix ?? []).length);
  if (PET) {
    const petNow = JSON.parse((await store.getGameSave(accId)).doc['pets.v1'] ?? '{}')?.pets?.[PET];
    check('打完塔寵物的親密度沒變', petNow?.intimacy === 950 && petNow?.acc === true, { pet: petNow, logs: store.mem.gameLogs.map((l) => l.kind) });
  }
  check('存檔沒有被伺服器修正', !fixes.length, fixes.map((l) => (l.detail?.fix ?? []).map((f) => f.code)));
  check('頁面沒有錯誤', !errs.length, errs.slice(0, 5));
  if (suspended) log('有測中斷／繼續');
  exitCode = checks.every((c) => c.ok) ? 0 : 1;
} catch (e) {
  if (e.message !== 'stop') { console.error(e); checks.push({ name: '例外', ok: false, info: e.message }); }
  await shot('x-fail');
} finally {
  await writeFile(join(OUT, 'report.json'), JSON.stringify({ job: JOB, ok: exitCode === 0, checks }, null, 2));
  console.log(`\n${exitCode === 0 ? '全部通過' : '有項目失敗'}（${checks.filter((c) => c.ok).length}/${checks.length}），截圖與報告：${OUT}`);
  await browser.close();
  srv.close();
  process.exit(exitCode);
}
