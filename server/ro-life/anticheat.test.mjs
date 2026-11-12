// 282 線上角色的防作弊與安全測試：每一項都是一條實際打得穿的路（修之前這些測試會失敗）。npm run test:ro
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { checkSave, runExpCap, runKillCap, poissonCap } from './game-rules.mjs';
import { applyOp } from './game-ops.mjs';
import { takeForListing } from './market.mjs';
import { nameProblem, nameKey } from './name-rules.mjs';
import { onMessage, signTicket } from './lobby-core.mjs';
import { runMessage } from './lobby-party.mjs';
import { signReceipt, signer } from './coop.mjs';
import R from './rules-data.mjs';
import { createRoLife } from './server.mjs';
import { RoStore } from './store.mjs';

const NOW = 1_800_000_000_000;
const ch = (o = {}) => ({ id: 'c1', name: 'Tommy', job: 'swordsman', level: 10, jobLevel: 10, exp: 0, jobExp: 0, stats: { str: 1, agi: 1, vit: 1, int: 1, dex: 1, luk: 1 }, talents: {}, equipped: {}, ...o });
const acc = (o = {}) => ({ inventory: [], cards: {}, materials: {}, kafra: 0, ...o });
const doc = (chars, a = acc()) => ({ 'characters.v1': JSON.stringify(chars), 'account.v1': JSON.stringify(a) });
const chars = (d) => JSON.parse(d['characters.v1']);
const account = (d) => JSON.parse(d['account.v1']);
const codes = (r) => r.issues.map((i) => i.code);
const claim = (stage = 'prontera', secs = 600, o = {}) => ({ stage, mult: 1, skip: false, char: null, issued: NOW - secs * 1000, ...o });
const at = (c = null, o = {}) => ({ now: NOW, claim: c, ...o });
const SWORD = Object.keys(R.items).find((id) => R.sellBase[id] > 0 && R.items[id].slot === 'weapon' && !R.items[id].starter);
const sword = (o = {}) => ({ uid: 'u1', itemId: Number(SWORD), quality: 0, refine: 0, cards: [], affixes: [], ...o });
const cardOf = (mon) => Object.keys(R.cards).find((id) => R.cards[id].monster === mon);
const PORING = cardOf('poring'), MASTERING = cardOf('mastering') ?? cardOf('eclipse');
const FAR = Object.keys(R.cards).find((id) => { const s = R.stages.prontera, m = R.cards[id].monster; return !s.waves.some((w) => w.pool.includes(m)) && !s.bossAt.some((b) => b.id === m); });

test('複製物品：同一個 uid 放兩次只留一件；賣出也只算一次', () => {
  const prev = doc([ch()], acc({ inventory: [sword()] }));
  const r = checkSave(prev, doc([ch()], acc({ inventory: [sword(), sword(), sword()] })), at());
  assert.deepEqual(codes(r), ['item-dup', 'item-dup']);
  assert.equal(account(r.doc).inventory.length, 1);
  // 就算存檔裡已經有重複的（舊資料），賣出只給一次錢、而且全部移除
  const one = applyOp(doc([ch()], acc({ inventory: [sword()] })), { op: 'sell', uids: ['u1'] });
  const two = applyOp(doc([ch()], acc({ inventory: [sword(), sword()] })), { op: 'sell', uids: ['u1'] });
  assert.equal(two.result.gained, one.result.gained);
  assert.equal(account(two.doc).inventory.length, 0);
});

test('沒有 uid 的物品：一律拿掉（原本整段驗證都跳過，還能用 uid "undefined" 上架到市場）', () => {
  const fake = { itemId: Number(SWORD), quality: 4, refine: 20, cards: [], affixes: [{ stat: 'str', value: 9999 }] };
  const r = checkSave(doc([ch()]), doc([ch()], acc({ inventory: [fake, null, 5, { ...fake, uid: '' }] })), at(claim()));
  assert.deepEqual([...new Set(codes(r))], ['item-nouid']);
  assert.equal(account(r.doc).inventory.length, 0);
  // 市場、賣出：沒有 uid 的東西不能上架也不能賣
  const d = doc([ch()], acc({ inventory: [fake] }));
  assert.equal(takeForListing(d, { uid: 'undefined', price: 10 }).error, 'missing');
  assert.equal(applyOp(d, { op: 'sell', uids: ['undefined'] }).result.gained, 0);
  assert.equal(applyOp(d, { op: 'refine', uid: 'undefined' }).error, 'missing');
});

test('舊資料不追溯：上一版就有的重複 uid、沒有 uid 的物品、沒有 id 的角色照留，但不能再多、也不能拿去賣或上架', () => {
  const ghost = { itemId: Number(SWORD), quality: 4, refine: 20, cards: [Number(PORING)], affixes: [] };
  const noId = { name: 'Old', job: 'swordsman', level: 50 };
  const prev = doc([ch(), noId], acc({ inventory: [sword(), sword(), ghost] }));
  let r = checkSave(prev, structuredClone(prev), at());
  assert.deepEqual([r.issues, r.doc], [[], null]);
  r = checkSave(prev, doc([ch(), noId, noId, { ...noId, level: 99 }], acc({ inventory: [sword(), sword(), sword(), ghost, ghost, { ...ghost, refine: 9 }] })), at());
  assert.deepEqual(codes(r).sort(), ['char-noid', 'char-noid', 'item-dup', 'item-nouid', 'item-nouid']);
  assert.deepEqual([chars(r.doc).length, account(r.doc).inventory.length], [2, 3]);
  assert.equal(takeForListing(prev, { uid: 'undefined', price: 10 }).error, 'missing');
  assert.equal(applyOp(prev, { op: 'sell', uids: ['u1', 'undefined'] }).result.gained, applyOp(doc([ch()], acc({ inventory: [sword()] })), { op: 'sell', uids: ['u1'] }).result.gained);
});

test('卡片：便宜的卡不能換成別張（總數沒變也不行）；插在裝備上的也算', () => {
  const prev = doc([ch()], acc({ cards: { [PORING]: 5 }, inventory: [sword({ quality: 2, cards: [null, null] })] }));
  // 沒有憑證：5 張波利卡變成 5 張別的卡
  let r = checkSave(prev, doc([ch()], acc({ cards: { [MASTERING]: 5 }, inventory: [sword({ quality: 2, cards: [null, null] })] })), at());
  assert.ok(codes(r).includes('cards-no-claim'));
  assert.deepEqual(account(r.doc).cards, { [PORING]: 5 }); // 多出來的拿掉，原本的補回來
  // 沒有憑證：直接把新卡插到裝備上（庫存沒變）
  r = checkSave(prev, doc([ch()], acc({ cards: { [PORING]: 5 }, inventory: [sword({ quality: 2, cards: [Number(MASTERING), null] })] })), at());
  assert.ok(codes(r).includes('cards-no-claim'));
  assert.deepEqual(account(r.doc).inventory[0].cards, [null, null]);
  // 正常的鑲卡（庫存 −1、裝備 +1）與拆卡不算獲得
  r = checkSave(prev, doc([ch()], acc({ cards: { [PORING]: 4 }, inventory: [sword({ quality: 2, cards: [Number(PORING), null] })] })), at());
  assert.deepEqual([r.issues, r.doc], [[], null]);
  // 不存在的卡片編號不能變多（有憑證也一樣）
  r = checkSave(prev, doc([ch()], acc({ cards: { [PORING]: 5, 999999: 1 }, inventory: [sword({ quality: 2, cards: [null, null] })] })), at(claim()));
  assert.ok(codes(r).includes('card-unknown'));
  assert.equal(account(r.doc).cards['999999'], undefined);
  // 有憑證：超過上限時連插上去的一起退回
  const many = Object.fromEntries(Object.keys(R.cards).slice(0, 30).map((id) => [id, 3]));
  r = checkSave(doc([ch()], acc({ inventory: [sword({ quality: 2, cards: [null, null] })] })), doc([ch()], acc({ cards: many, inventory: [sword({ quality: 2, cards: [Number(PORING), null] })] })), at(claim('prontera', 30)));
  assert.ok(codes(r).includes('cards'));
  assert.deepEqual([account(r.doc).cards, account(r.doc).inventory[0].cards], [{}, [null, null]]);
});

test('卡槽：舊物品的卡槽不能變多', () => {
  const prev = doc([ch()], acc({ cards: { [PORING]: 9 }, inventory: [sword({ quality: 0, cards: [] })] }));
  const r = checkSave(prev, doc([ch()], acc({ cards: { [PORING]: 3 }, inventory: [sword({ quality: 0, cards: Array(6).fill(Number(PORING)) })] })), at());
  assert.ok(codes(r).includes('slots'));
  const max = Math.max(R.items[SWORD].cardSlots, ...R.items[SWORD].slotsByQuality);
  assert.ok(account(r.doc).inventory[0].cards.length <= max);
});

test('材料：不在價格表裡的礦（濃縮礦）也不能自己變多', () => {
  const r = checkSave(doc([ch()]), doc([ch()], acc({ materials: { [R.ores.enrichedOridecon]: 500, 123456: 9 } })), at(claim()));
  assert.deepEqual(codes(r).filter((c) => c === 'materials').length, 2);
  assert.deepEqual(account(r.doc).materials, {});
});

test('職業：不能換；新角色只能是一轉職業', () => {
  let r = checkSave(doc([ch()]), doc([ch({ job: 'mage' })]), at());
  assert.deepEqual(codes(r), ['job']);
  assert.equal(chars(r.doc)[0].job, 'swordsman');
  // 新角色直接用二轉職業：一轉的天賦樹會平白多 50 點
  r = checkSave(doc([ch()]), doc([ch(), ch({ id: 'c2', job: 'knight', level: 1, jobLevel: 1, talents: { 'swordsman.0.sword_mastery': 5 } })]), at());
  assert.ok(codes(r).includes('new-job'));
  assert.equal(chars(r.doc)[1].job, 'swordsman');
  // 規則資料沒有的職業（引擎之後加的）不動
  assert.deepEqual(checkSave(doc([ch()]), doc([ch(), ch({ id: 'c3', name: 'Shadow', job: 'ninja', level: 1, jobLevel: 1 })]), at()).issues, []);
  assert.ok(codes(r).includes('talents'));
  // 舊存檔的 novice 會被引擎改成 swordsman：這個要放行
  r = checkSave(doc([ch({ job: 'novice' })]), doc([ch({ job: 'swordsman' })]), at());
  assert.deepEqual(r.issues, []);
});

test('跳過劇情的憑證：沒有經驗、沒有卡片（引擎結算時就是 0）；無盡之塔不是關卡', () => {
  assert.equal(runExpCap('sunken_story', 0, { skip: true }), 0);
  assert.equal(runExpCap('endless', 3600, { mult: 2 }), 0);
  const c = claim('sunken_story', 0, { skip: true, char: 'c1' });
  let r = checkSave(doc([ch()]), doc([ch({ exp: 5 })], acc({ cards: { [PORING]: 1 } })), at(c));
  assert.deepEqual(codes(r).sort(), ['cards', 'exp']);
  assert.equal(chars(r.doc)[0].exp, 0);
  // 劇情獎勵（通關、打倒的頭目）照給
  const boss = R.stages.sunken_story.bossAt.at(-1).id;
  r = checkSave(doc([ch()]), doc([ch({ stagesCleared: ['sunken_story'], mvpsDefeated: [boss] })]), at(c));
  assert.deepEqual(r.issues, []);
});

test('先記錄的規則（strict 才擋）：頭目還沒出場就記打倒、卡片不是這一關的怪、秒領', () => {
  const boss = R.stages.prontera.bossAt.at(-1);
  const early = claim('prontera', 5);
  const next = doc([ch({ mvpsDefeated: [boss.id], stagesCleared: ['prontera'] })], acc({ cards: { [FAR]: 1 } }));
  let r = checkSave(doc([ch()]), next, at(early));
  assert.deepEqual(codes(r).sort(), ['card-stage', 'claim-quick', 'mvp-early', 'stage-early']);
  assert.ok(r.issues.every((i) => i.fixed === false));
  assert.equal(r.doc, null);
  r = checkSave(doc([ch()]), next, at(early, { strict: true }));
  assert.deepEqual([chars(r.doc)[0].mvpsDefeated, chars(r.doc)[0].stagesCleared, account(r.doc).cards], [[], [], {}]);
  // strict：剛發的憑證不給物品與卡片（這一關的卡也一樣）
  r = checkSave(doc([ch()]), doc([ch()], acc({ cards: { [PORING]: 1 }, inventory: [sword({ uid: 'q1' })] })), at(early, { strict: true }));
  assert.deepEqual([account(r.doc).cards, account(r.doc).inventory], [{}, []]);
  // 打夠久就沒事
  r = checkSave(doc([ch()]), doc([ch({ mvpsDefeated: [boss.id], stagesCleared: ['prontera'] })]), at(claim('prontera', boss.t + 30), { strict: true }));
  assert.deepEqual(r.issues, []);
});

test('同一件裝備穿在兩個欄位：先記錄，strict 才卸下', () => {
  const prev = doc([ch()], acc({ inventory: [sword()] }));
  const next = () => doc([ch({ equipped: { weapon: 'u1', shield: 'u1', armor: 'u1' } })], acc({ inventory: [sword()] }));
  let r = checkSave(prev, next(), at());
  // 劍放在盾牌欄、盔甲欄本身也不合（equip-bad），而且是同一件（equip-dup）
  assert.deepEqual([codes(r), r.issues.every((i) => i.fixed === false), r.doc], [['equip-bad', 'equip-bad', 'equip-dup'], true, null]);
  r = checkSave(prev, next(), at(null, { strict: true }));
  assert.deepEqual(chars(r.doc)[0].equipped, { weapon: 'u1' });
});

test('詞綴：數值照引擎的產生方式（階級倍率 × 基礎值），造假的先記錄、strict 才拿掉', () => {
  const A = R.affix;
  assert.ok(A && A.tierMult[1] > 0 && A.stats.length === 6 && Object.keys(A.base).length >= 7);
  const tier = R.stages.prontera.tier, m = A.tierMult[tier];
  const good = sword({ uid: 'n1', quality: 2, tier, ilvl: 5, cards: [null, null], affixes: [{ stat: 'str', value: m }, { stat: 'crit', value: Number((A.base.crit * m).toFixed(3)) }] });
  let r = checkSave(doc([ch()]), doc([ch()], acc({ inventory: [good] })), at(claim()));
  assert.deepEqual(r.issues, []);
  for (const bad of [[{ stat: 'str', value: 9999 }], [{ stat: 'crit', value: 5 }], [{ stat: 'godmode', value: 1 }], [{ stat: 'str', value: m }, { stat: 'str', value: m }], [{ stat: 'skill', value: 3, skill: 'bash' }], ['x']]) {
    const it = { ...good, affixes: bad };
    r = checkSave(doc([ch()]), doc([ch()], acc({ inventory: [it] })), at(claim()));
    assert.deepEqual(codes(r), ['item-affix'], JSON.stringify(bad));
    assert.equal(r.issues[0].fixed, false);
    r = checkSave(doc([ch()]), doc([ch()], acc({ inventory: [it] })), at(claim(), { strict: true }));
    assert.equal(account(r.doc).inventory.length, 0, JSON.stringify(bad));
  }
  // 傳說的技能詞綴：0.1～0.2
  const leg = { ...good, quality: 4, cards: [], affixes: [{ stat: 'str', value: m }, { stat: 'agi', value: m }, { stat: 'crit', value: Number((A.base.crit * m).toFixed(3)) }, { stat: 'hp', value: Number((A.base.hp * m).toFixed(3)) }, { stat: 'skill', value: 0.17, skill: 'bash' }] };
  r = checkSave(doc([ch()]), doc([ch()], acc({ inventory: [leg] })), at(claim()));
  assert.deepEqual(r.issues, []);
});

// ---- API ----
const sha = (s) => createHash('sha256').update(s).digest('hex');
const TOKEN = 'tok_' + 'y'.repeat(30);
async function boot(env = {}, lobby = null) {
  const store = new RoStore({});
  const app = createRoLife({ env, store, lobby, fetchImpl: () => { throw Error('no network'); } });
  const id = await store.loginIdentity('google', 'sub-ac', '阿光');
  await store.createSession(sha(TOKEN), id, 3600);
  const server = createServer(async (req, res) => { if (!(await app.handle(req, res))) { res.writeHead(404); res.end(); } });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}/api/ro/`;
  const call = async (method, path, body) => {
    const r = await fetch(base + path, { method, headers: { 'x-session': TOKEN, ...(body ? { 'content-type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, body: await r.json().catch(() => ({})) };
  };
  return { store, id, call, close: () => new Promise((r) => server.close(r)) };
}

test('API 發憑證：不存在的關卡、無盡之塔不發；跳過劇情要「別的角色通關過」', async (t) => {
  const s = await boot({ RO_ONLINE_ENFORCE: '1' });
  t.after(s.close);
  const base = ch({ level: 1, jobLevel: 1 });
  let r = await s.call('PUT', 'game/save', { rev: 0, doc: doc([base, { ...base, id: 'c2', name: 'Second' }]), wid: 'w1' });
  assert.equal(r.status, 200);
  assert.equal((await s.call('POST', 'game/run', { stage: 'endless', mult: 2 })).status, 400);
  assert.equal((await s.call('POST', 'game/run', { stage: 'nowhere' })).status, 400);
  assert.equal((await s.call('POST', 'game/run', { stage: 'prontera', mult: 1 })).status, 200);
  // 沒有任何角色通關過 sunken_story：不能跳過
  assert.deepEqual((await s.call('POST', 'game/run', { stage: 'sunken_story', skip: true, char: 'c2' })).body, { error: 'bad_run' });
  assert.equal((await s.call('POST', 'game/run', { stage: 'sunken_story', skip: true })).status, 400);
  assert.equal((await s.call('POST', 'game/run', { stage: 'sunken_story', skip: true, char: 'nope' })).status, 400);
  // c1 通關之後 c2 才能跳過；c1 自己不能
  const cur = await s.store.getGameSave(s.id);
  await s.store.putGameSave(s.id, cur.rev, doc([{ ...base, stagesCleared: ['sunken_story'] }, { ...base, id: 'c2', name: 'Second' }]), 'srv');
  assert.equal((await s.call('POST', 'game/run', { stage: 'sunken_story', skip: true, char: 'c2' })).status, 200);
  assert.equal((await s.call('POST', 'game/run', { stage: 'sunken_story', skip: true, char: 'c1' })).status, 400);
  // 還沒打倒上一區的 MVP 就開後面的關卡：先記錄（strict 才擋）
  assert.equal((await s.call('POST', 'game/run', { stage: 'payon_cave', mult: 1 })).status, 200);
  assert.ok(s.store.mem.gameLogs.some((l) => l.kind === 'run' && l.flags.includes('stage-locked')));
});

test('API strict：還沒解鎖的關卡不發憑證', async (t) => {
  const s = await boot({ RO_ONLINE_ENFORCE: '1', RO_ONLINE_STRICT: '1' });
  t.after(s.close);
  await s.call('PUT', 'game/save', { rev: 0, doc: doc([ch({ level: 1, jobLevel: 1 })]), wid: 'w1' });
  assert.equal((await s.call('POST', 'game/run', { stage: 'payon_cave', mult: 1 })).status, 400);
  assert.equal((await s.call('POST', 'game/run', { stage: 'prontera', mult: 1 })).status, 200);
});

test('API 角色名：不雅或冒充官方的名字回 offensive；存檔裡硬塞的會被換掉並要求改名', async (t) => {
  const s = await boot({ RO_ONLINE_ENFORCE: '1' });
  t.after(s.close);
  assert.deepEqual((await s.call('POST', 'game/name', { char: 'c1', name: 'Tommy' })).body, { ok: true });
  for (const bad of ['GM Tommy', 'Ａｄｍｉｎ', '官方客服', 'f.u.c.k', 'fuuuck you', '幹你娘', 'x', 'a'.repeat(17), '<b>hi</b>', 'ok​name'])
    assert.deepEqual((await s.call('POST', 'game/name', { char: 'c1', name: bad })).body, { error: 'offensive' }, bad);
  let r = await s.call('PUT', 'game/save', { rev: 0, doc: doc([ch({ level: 1, jobLevel: 1, name: '系統管理員' })]), wid: 'w1' });
  assert.equal(r.status, 200);
  const c = chars(r.body.doc)[0];
  assert.ok(c.rename === true && /^冒險者\d{4}$/.test(c.name));
  // 舊名字不追溯；改成不行的名字會退回原名
  r = await s.call('PUT', 'game/save', { rev: r.body.rev, doc: doc([{ ...c, name: 'Admin' }]), wid: 'w2' });
  assert.equal(chars(r.body.doc)[0].name, c.name);
});

test('角色名規則：正規化後比對', () => {
  for (const ok of ['Tommy', '阿光', '波利 殺手', 'Niño_99', 'たろう', '김철수', 'Classic', 'Grass', 'Sagami', '管理学', 'Yoshitaka', 'Matsushita', 'Vergara', 'Dev', 'Ignazio', 'Staff Master', 'Computadora', 'Ninja01'])
    assert.equal(nameProblem(ok), null, ok);
  for (const [bad, why] of [['ad min', 'reserved'], ['G-M', 'reserved'], ['ｇｍ', 'reserved'], ['Gamemaster1', 'reserved'], ['客 服', 'reserved'], ['sh1t', 'offensive'], ['ShitLord', 'offensive'], ['PUTA', 'offensive'], ['操你媽', 'offensive'], ['', 'format'], ['a\nb', 'format'], ['😀😀', 'format']])
    assert.equal(nameProblem(bad), why, bad);
  assert.equal(nameProblem('我的名字', { extra: ['名字'] }), 'offensive');
  assert.equal(nameKey('Ｔｏｍ_my 1'), 'tommy1');
});

test('大廳：登入玩家自填的角色名不雅時改用伺服器給的名字；本局轉送的封包不能帶 <', async () => {
  const peers = new Map(), sent = [];
  const io = {
    peers: () => peers.keys(), get: (ws) => peers.get(ws) ?? null, set: (ws, st) => (st ? peers.set(ws, st) : peers.delete(ws)),
    send: (ws, m) => sent.push([ws, m]), close: () => {}, verify: async () => ({ a: 7, n: 'x', exp: Date.now() + 1e6 }),
    db: new Proxy({}, { get: () => () => [] }),
  };
  const ws = { n: 1 };
  peers.set(ws, null); io.set(ws, {});
  await onMessage(io, ws, JSON.stringify({ t: 'hello', name: 'GM 官方', rt: await signTicket('s', { account: 7, name: 'x' }), look: null, x: 0, y: 0, f: 0 }));
  assert.match(io.get(ws).name, /^冒險者 \d{4}$/);
  // 本局轉送：房主的封包夾帶標籤時，隊友收到的字串裡沒有 <（\u003c 這種寫法也一樣），其他內容照送
  const a = { n: 2 }, b = { n: 3 }, raw = [];
  io.parties = new Map([[1, { pid: 1, leader: 1, run: { host: 1 }, members: [{ mid: 1, acc: '7' }, { mid: 2, acc: '8' }] }]]);
  io.set(a, { run: 1, acc: '7', mid: 1 }); io.set(b, { run: 1, acc: '8', mid: 2 });
  io.sendRaw = (w, s) => raw.push([w, s]);
  const evil = '{"t":"run","d":{"k":"got","name":"\\u003cimg src=x onerror=alert(1)>","n":5}}';
  runMessage(io, a, io.get(a), JSON.parse(evil), evil, Date.now());
  assert.equal(raw.length, 1);
  assert.equal(raw[0][0], b);
  assert.ok(!raw[0][1].includes('<'));
  assert.deepEqual(JSON.parse(raw[0][1]), { t: 'run', from: 1, d: { k: 'got', name: '‹img src=x onerror=alert(1)>', n: 5 } });
  runMessage(io, a, io.get(a), { t: 'run', d: { k: 'mobs', m: [[1, 2, 3]] } }, '{}', Date.now());
  assert.equal(raw[1][1], '{"t":"run","from":1,"d":{"k":"mobs","m":[[1,2,3]]}}');
});

// ---- 合作關卡獎勵裁決（收據由大廳簽，格式見 coop.mjs） ----
test('合作關卡的經驗上限：照行程收據上的人數；沒有收據時 RO_COOP_RECEIPT=1 當單人、沒開照舊用 3 人隊', () => {
  const solo = runExpCap('prontera', 300, { mult: 1, party: 1 }), duo = runExpCap('prontera', 300, { mult: 1, party: 2 }), trio = runExpCap('prontera', 300, { mult: 1, party: 3 });
  assert.ok(solo < duo && duo < trio);
  assert.equal(trio, runExpCap('prontera', 300, { mult: 1 }));
  // 塞一個超過單人上限、沒超過兩人隊上限的經驗值
  const big = (c, o) => checkSave(doc([ch({ level: 30 })]), doc([ch({ level: 30, exp: Math.round(runExpCap('payon_cave', 600, { mult: 1, level: 30, party: 1 }) * 1.5) })]), at(c, o));
  assert.deepEqual(codes(big(claim('payon_cave', 600))), []); // 沒開：照舊
  assert.deepEqual(codes(big(claim('payon_cave', 600), { coop: true })), ['exp']); // 開了、沒有收據：單人
  assert.deepEqual(codes(big(claim('payon_cave', 600, { party: 2 }), { coop: true })), []); // 有收據：兩人隊
  assert.equal(big(claim('payon_cave', 600, { party: 2 }), { coop: true }).meta.party, 2);
});

test('結算收據：連線秒數、房主宣布打倒的頭目、擲骰拿到的東西都要對得上（先記錄，strict 才擋）', () => {
  const boss = R.stages.prontera.bossAt.at(-1).id;
  const end = (o = {}) => ({ secs: 880, end: 'win', host: false, full: true, n: 2, killed: [boss], won: [['loot', Number(SWORD), 2], ['card', Number(PORING), 0]], ...o });
  const c = (o) => claim('prontera', 900, { party: 2, end: end(o) });
  const item = (o = {}) => sword({ uid: 'n1', quality: 2, tier: 1, ilvl: 5, cards: [null, null], affixes: [{ stat: 'str', value: 1 }], ...o });
  // 全部對得上：沒事
  let next = () => doc([ch({ mvpsDefeated: [boss], stagesCleared: ['prontera'] })], acc({ inventory: [item()], cards: { [PORING]: 1 } }));
  assert.deepEqual(checkSave(doc([ch()]), next(), at(c())).issues, []);
  // 房主沒宣布打倒 MVP、收據裡沒有的裝備與卡片
  next = () => doc([ch({ mvpsDefeated: [boss], stagesCleared: ['prontera'] })], acc({ inventory: [item(), item({ uid: 'n2' }), item({ uid: 'n3', quality: 3, affixes: [] })], cards: { [PORING]: 3 } }));
  let r = checkSave(doc([ch()]), next(), at(c({ killed: [] })));
  assert.deepEqual(codes(r).sort(), ['coop-loot', 'coop-loot', 'coop-loot', 'coop-mvp']);
  assert.ok(r.issues.every((i) => i.fixed === false) && r.doc === null);
  r = checkSave(doc([ch()]), next(), at(c({ killed: [] }), { strict: true }));
  assert.deepEqual([chars(r.doc)[0].mvpsDefeated, chars(r.doc)[0].stagesCleared, account(r.doc).inventory.map((i) => i.uid), account(r.doc).cards], [[], [], ['n1'], { [PORING]: 1 }]);
  // 合作關卡的憑證卻沒帶結算收據：先記錄；strict 時不給新物品、卡片，也不記打倒與通關（不帶收據不能比帶收據划算）
  const bare = claim('prontera', 900, { party: 2 });
  r = checkSave(doc([ch()]), next(), at(bare));
  assert.deepEqual([[...new Set(codes(r))], r.doc], [['coop-noend'], null]);
  r = checkSave(doc([ch()]), next(), at(bare, { strict: true }));
  assert.deepEqual([chars(r.doc)[0].mvpsDefeated, chars(r.doc)[0].stagesCleared, account(r.doc).inventory, account(r.doc).cards], [[], [], [], {}]);
  // 掉落帳不完整（房主是舊頁面、落單過）時不核對掉落
  assert.deepEqual(codes(checkSave(doc([ch()]), next(), at(c({ full: false })))), []);
  // 連線秒數比牆鐘短很多：照連線秒數算的上限先記錄
  const lots = Math.round(runExpCap('prontera', 900, { mult: 1, level: 10, party: 2 }) * 0.9);
  r = checkSave(doc([ch()]), doc([ch({ exp: lots })]), at(c({ secs: 60, killed: [], won: [] })));
  assert.deepEqual([codes(r), r.issues[0].fixed], [['coop-secs'], false]);
  r = checkSave(doc([ch()]), doc([ch({ exp: lots })]), at(c({ secs: 60, killed: [], won: [] }), { strict: true }));
  assert.ok(chars(r.doc)[0].exp < lots);
});

test('API 合作關卡：行程收據換到帶人數的憑證；冒用別人的、過期的、領過的都不算；結算收據記進紀錄', async (t) => {
  const SECRET = 'lobby-secret-0123456789';
  const s = await boot({ RO_ONLINE_ENFORCE: '1', RO_COOP_RECEIPT: '1' }, { url: 'ws://x/api/ro/lobby', secret: SECRET });
  t.after(s.close);
  const sign = signer(SECRET), now = Date.now();
  const trip = (o = {}) => signReceipt(sign, 'trip', { a: String(s.id), tid: 'ab12cd34ef567890', stage: 'prontera', n: 2, at: now, ...o });
  await s.call('PUT', 'game/save', { rev: 0, doc: doc([ch({ level: 1, jobLevel: 1 })]), wid: 'w1' });
  const ids = () => [...s.store.mem.gameRuns.keys()];
  // 壞的收據：照發憑證，但當單人
  for (const bad of [await trip({ a: '999' }), await trip({ at: now - 10 * 60_000 }), await trip({ stage: 'payon' }), await trip({ n: 9 }), { ...(await trip()), sig: 'x' }, await signReceipt(signer('other'), 'trip', { a: String(s.id), tid: 'ab12cd34ef567890', stage: 'prontera', n: 3, at: now })]) {
    const r = await s.call('POST', 'game/run', { stage: 'prontera', mult: 1, trip: bad });
    assert.equal(r.status, 200);
    assert.ok(!/^p\d\./.test(r.body.run));
  }
  assert.ok(s.store.mem.gameLogs.some((l) => l.kind === 'run' && l.flags.includes('trip-bad')));
  // 好的收據
  let r = await s.call('POST', 'game/run', { stage: 'prontera', mult: 1, trip: await trip() });
  assert.match(r.body.run, /^p2\.ab12cd34ef567890\./);
  // 頁面重新載入後接續：沒有收據，沿用原本那張的前綴
  r = await s.call('POST', 'game/run', { stage: 'prontera', mult: 1, played: 30 });
  assert.match(r.body.run, /^p2\.ab12cd34ef567890\./);
  const run = r.body.run;
  s.store.mem.gameRuns.get(run).issued -= 300_000;
  // 結算：帶大廳簽的結算收據
  const tripend = await signReceipt(sign, 'tripend', { a: String(s.id), tid: 'ab12cd34ef567890', stage: 'prontera', n: 2, secs: 290, end: 'lose', host: false, killed: ['poring'], won: [], full: true, rolls: 0, at: now });
  const cur = await s.store.getGameSave(s.id);
  const gain = Math.round(runExpCap('prontera', 300, { mult: 1, level: 1, party: 1 }) * 1.6); // 超過單人、沒超過兩人隊
  r = await s.call('PUT', 'game/save', { rev: cur.rev, doc: doc([ch({ level: 1, jobLevel: 1, exp: 0, ...lvFor(gain) })]), wid: 'w2', run, trip: tripend });
  assert.equal(r.status, 200);
  assert.equal(r.body.doc, undefined); // 沒有被修正
  const log = s.store.mem.gameLogs.filter((l) => l.kind === 'save').at(-1);
  assert.deepEqual([log.flags, log.detail.party, log.detail.cap.party, log.detail.cap.end.secs, log.detail.cap.end.full], [[], 2, 2, 290, true]);
  // 這一趟領過了：同一張行程收據不能再換
  r = await s.call('POST', 'game/run', { stage: 'prontera', mult: 1, trip: await trip() });
  assert.ok(!/^p\d\./.test(r.body.run));
  // 別人的結算收據、沒帶收據：記下來
  const run2 = (await s.call('POST', 'game/run', { stage: 'prontera', mult: 1, trip: await trip({ tid: 'ffffffff00000000' }) })).body.run;
  const cur2 = await s.store.getGameSave(s.id);
  await s.call('PUT', 'game/save', { rev: cur2.rev, doc: cur2.doc, wid: 'w3', run: run2, trip: tripend });
  assert.deepEqual(s.store.mem.gameLogs.filter((l) => l.kind === 'save').at(-1).flags, ['tripend-bad']);
});
// 累積經驗 gain 對應的等級與經驗（從 1 級 0 經驗起算）
function lvFor(gain) { let lv = 1, left = gain; while (left >= R.expNext[lv - 1]) { left -= R.expNext[lv - 1]; lv++; } return { level: lv, exp: left }; }

// ---- 照引擎掉落規則訂的上限、穿戴限制、寵物與成就、名字全站唯一、流量上限 ----
test('物品與卡片上限：小怪掉裝一場最多 floor(4 × 難度) 件加頭目各一件；卡片是萬分之一的稀有事件', () => {
  const k = runKillCap('prontera', 600, { mult: 1, party: 1 });
  assert.ok(k.kills > 500 && k.bosses === 4);
  assert.ok(runKillCap('prontera', 600, { mult: 1, party: 3 }).kills > k.kills * 3);
  assert.deepEqual(runKillCap('endless', 600), { kills: 0, bosses: 0 });
  // 卜瓦松上限：平均 0.3 張時最多 6 張（超過的機率低於千萬分之一），平均越高上限越高；平均 0 也留 1 張
  assert.deepEqual([poissonCap(0), poissonCap(0.3), poissonCap(1.2) > poissonCap(0.3), poissonCap(1.2) < 12], [1, 6, true, true]);
  const item = (i) => sword({ uid: 'n' + i, quality: 1, tier: 1, ilvl: 5, cards: [null], affixes: [{ stat: 'str', value: 1 }] });
  const many = (n) => doc([ch()], acc({ inventory: Array.from({ length: n }, (_, i) => item(i)) }));
  // 10 分鐘單人、難度 1：4（小怪）＋4（出場過的頭目）＋3（餘裕）＝11 件
  let r = checkSave(doc([ch()]), many(11), at(claim('prontera', 600), { coop: true }));
  assert.deepEqual(r.issues, []);
  r = checkSave(doc([ch()]), many(12), at(claim('prontera', 600), { coop: true }));
  assert.deepEqual([codes(r), r.issues[0].cap, r.issues[0].fixed], [['item-count'], 11, false]);
  r = checkSave(doc([ch()]), many(14), at(claim('prontera', 600), { coop: true, strict: true }));
  assert.equal(account(r.doc).inventory.length, 11);
  // 卡片：10 分鐘單人最多幾張就是幾張，多一張整批退回
  const cap = poissonCap((k.kills * R.drops.card + k.bosses * R.drops.cardBoss) * 1);
  assert.ok(cap >= 2 && cap <= 7, String(cap));
  assert.deepEqual(checkSave(doc([ch()]), doc([ch()], acc({ cards: { [PORING]: cap } })), at(claim('prontera', 600), { coop: true })).issues, []);
  r = checkSave(doc([ch()]), doc([ch()], acc({ cards: { [PORING]: cap + 1 } })), at(claim('prontera', 600), { coop: true }));
  assert.deepEqual([codes(r), account(r.doc).cards], [['cards'], {}]);
});

test('穿戴限制：欄位不對、職業不能穿、別人的新手裝備（先記錄，strict 才卸下）', () => {
  const MAGE = Object.keys(R.items).find((id) => R.items[id].slot === 'weapon' && !R.items[id].starter && R.items[id].jobsAll && !R.items[id].jobsAll.includes('swordsman'));
  const HAT = Object.keys(R.items).find((id) => R.items[id].slot === 'head_top' && !R.items[id].jobsAll && !R.items[id].gender);
  const inv = [sword(), { uid: 'm1', itemId: Number(MAGE), cards: [] }, { uid: 'h1', itemId: Number(HAT), cards: [] }, { uid: 's1', itemId: 1101, owner: 'someone-else', cards: [] }];
  const eq = (equipped) => checkSave(doc([ch()], acc({ inventory: inv })), doc([ch({ equipped })], acc({ inventory: inv })), at());
  assert.deepEqual(eq({ weapon: 'u1', head_top: 'h1' }).issues, []);
  assert.deepEqual(eq({ weapon: 'm1' }).issues.map((i) => [i.code, i.why, i.fixed]), [['equip-bad', 'job', false]]);
  assert.deepEqual(eq({ armor: 'h1' }).issues.map((i) => i.why), ['slot']);
  assert.deepEqual(eq({ nowhere: 'h1' }).issues.map((i) => i.why), ['slot']);
  assert.deepEqual(eq({ weapon: 's1' }).issues.map((i) => i.why), ['owner']);
  const r = checkSave(doc([ch()], acc({ inventory: inv })), doc([ch({ equipped: { weapon: 'm1', head_top: 'h1' } })], acc({ inventory: inv })), at(null, { strict: true }));
  assert.deepEqual(chars(r.doc)[0].equipped, { head_top: 'h1' });
});

test('寵物與成就：新寵物要有蛋（關卡憑證）或進化來源；親密度、殺怪數只在關卡結算時增加（先記錄，strict 才改回）', () => {
  const EVO = Object.keys(R.pets).find((id) => R.pets[id].from), FROM = R.pets[EVO].from;
  const pets = (o) => ({ 'pets.v1': JSON.stringify({ pets: o }) });
  const base = doc([ch()]), withPets = (o, extra = {}) => ({ ...doc([ch()]), ...pets(o), ...extra });
  // 沒有憑證就多一隻；有憑證可以孵蛋、親密度照時間漲；進化不用憑證
  let r = checkSave(base, withPets({ poring: { intimacy: 250 } }), at());
  assert.deepEqual(codes(r), ['pet-new']);
  assert.deepEqual(checkSave(base, withPets({ poring: { intimacy: 250 } }), at(claim('prontera', 300))).issues, []);
  assert.deepEqual(checkSave(withPets({ [FROM]: { intimacy: 900 } }), withPets({ [FROM]: { intimacy: 900 }, [EVO]: { intimacy: 250 } }), at()).issues, []);
  assert.deepEqual(codes(checkSave(base, withPets({ not_a_pet: { intimacy: 1 } }), at(claim('prontera', 300)))), ['pet-new']);
  r = checkSave(withPets({ poring: { intimacy: 250 } }), withPets({ poring: { intimacy: 1000 } }), at(claim('prontera', 300)));
  assert.deepEqual([codes(r), r.issues[0].cap], [['pet-intimacy'], 90]);
  r = checkSave(withPets({ poring: { intimacy: 250 } }), withPets({ poring: { intimacy: 1000 }, drops: { intimacy: 1000 } }), at(null, { strict: true }));
  assert.deepEqual(JSON.parse(r.doc['pets.v1']).pets, { poring: { intimacy: 250 } });
  // 成就
  const ach = (o) => ({ 'achievements.v1': JSON.stringify({ totalKills: 0, runs: 0, wins: 0, ...o }) });
  assert.deepEqual(checkSave({ ...base, ...ach({}) }, { ...base, ...ach({ totalKills: 300, runs: 1 }) }, at(claim('prontera', 600))).issues, []);
  assert.deepEqual(codes(checkSave({ ...base, ...ach({}) }, { ...base, ...ach({ totalKills: 300, runs: 1 }) }, at())), ['ach-gain']);
  r = checkSave({ ...base, ...ach({ totalKills: 5 }) }, { ...base, ...ach({ totalKills: 999999, runs: 1 }) }, at(claim('prontera', 600), { strict: true }));
  assert.deepEqual([JSON.parse(r.doc['achievements.v1']).totalKills, JSON.parse(r.doc['achievements.v1']).runs], [5, 0]);
});

test('API 角色名全站唯一：別的帳號登記過的名字回 nameTaken；存檔裡硬塞的要求改名；改名、刪角色後名字放出來', async (t) => {
  const s = await boot({ RO_ONLINE_ENFORCE: '1' });
  t.after(s.close);
  const other = await s.store.loginIdentity('google', 'sub-other', '別人');
  assert.equal(await s.store.claimName(other, 'x1', 'tommy', 'Tommy'), true);
  // 大小寫、全形、分隔符號不同也算同一個名字
  for (const n of ['Tommy', 'TOMMY', 'Ｔｏｍｍｙ', 'Tom_my', 'tom my']) assert.deepEqual((await s.call('POST', 'game/name', { char: 'c1', name: n })).body, { error: 'nameTaken' }, n);
  assert.deepEqual((await s.call('POST', 'game/name', { char: 'c1', name: 'Hikari' })).body, { ok: true });
  assert.deepEqual((await s.call('POST', 'game/name', { char: 'c1', name: 'hikari' })).body, { ok: true }); // 自己的名字可以再登記
  // 繞過頁面直接存一個別人的名字：換成冒險者NNNN、要求改名
  let r = await s.call('PUT', 'game/save', { rev: 0, doc: doc([ch({ level: 1, jobLevel: 1, name: 'Tommy' }), ch({ id: 'c2', level: 1, jobLevel: 1, name: 'Hikari' })]), wid: 'w1' });
  const cs = chars(r.body.doc);
  assert.ok(/^冒險者\d{4}$/.test(cs[0].name) && cs[0].rename === true);
  assert.equal(cs[1].name, 'Hikari');
  assert.equal((await s.store.nameOwners(['hikari'])).get('hikari'), s.id);
  // 別人現在拿不到 Hikari；刪掉 c2（登記超過 10 分鐘）之後就拿得到
  assert.equal(await s.store.claimName(other, 'x2', 'hikari', 'Hikari'), false);
  for (const v of s.store.mem.names.values()) v.at -= 700_000;
  r = await s.call('PUT', 'game/save', { rev: r.body.rev, doc: doc([cs[0]]), wid: 'w2' });
  assert.equal(await s.store.claimName(other, 'x2', 'hikari', 'Hikari'), true);
});

test('API 流量上限：同一個帳號一分鐘內太多請求回 429', async (t) => {
  const s = await boot({ RO_RATE_MAX: '20' });
  t.after(s.close);
  const codes_ = [];
  for (let i = 0; i < 24; i++) codes_.push((await s.call('GET', 'me')).status);
  assert.deepEqual([codes_.slice(0, 20).every((c) => c === 200), codes_.slice(20)], [true, [429, 429, 429, 429]]);
});
