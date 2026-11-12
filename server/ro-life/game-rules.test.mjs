// 282 線上角色存檔驗證（game-rules.mjs）與伺服器 op（game-ops.mjs）測試。npm run test:ro
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { checkSave, statSpent, sellValue, runExpCap, talentProblem } from './game-rules.mjs';
import { applyOp } from './game-ops.mjs';
import R from './rules-data.mjs';
import { createRoLife } from './server.mjs';
import { RoStore } from './store.mjs';

const NOW = 1_800_000_000_000;
const ch = (o = {}) => ({ id: 'c1', name: 'T', job: 'swordsman', level: 10, jobLevel: 10, exp: 0, jobExp: 0, stats: { str: 1, agi: 1, vit: 1, int: 1, dex: 1, luk: 1 }, talents: {}, equipped: {}, ...o });
const acc = (o = {}) => ({ inventory: [], cards: {}, materials: {}, kafra: 0, ...o });
const doc = (chars, a = acc()) => ({ 'characters.v1': JSON.stringify(chars), 'account.v1': JSON.stringify(a) });
const chars = (d) => JSON.parse(d['characters.v1']);
const account = (d) => JSON.parse(d['account.v1']);
const codes = (r) => r.issues.map((i) => i.code);
const claim = (stage = 'prontera', secs = 600, o = {}) => ({ stage, mult: 1, skip: false, char: null, issued: NOW - secs * 1000, ...o });
const at = (c = null) => ({ now: NOW, claim: c });

test('規則資料：數值和引擎一致', () => {
  assert.equal(R.expNext[0], 32);
  assert.equal(R.expNext[98], 238443581);
  assert.equal(R.statPts[0], 48);
  assert.equal(R.statPts[98], 1273);
  assert.deepEqual(R.refineRate, [100, 100, 100, 100, 90, 80, 60, 40, 30, 20]);
  assert.equal(R.jobs.swordsman.jobMax, 50);
  assert.ok(R.items['1101'].starter);
  assert.ok(Object.keys(R.talents).length > 100);
  assert.deepEqual(R.stages.payon.bossAt.map((b) => b.t), [180, 360, 600, 840]);
  // 賣價公式：和引擎在頁面上算的樣本逐筆相同
  for (const s of R.sellSamples) assert.equal(sellValue({ ...s, affixes: Array(s.affixes).fill({}), cards: Array(s.cards).fill(null) }), s.value, JSON.stringify(s));
  assert.equal(statSpent({ str: 11, agi: 1, vit: 1, int: 1, dex: 1, luk: 1 }), 20);
});

test('經驗上限：時間越長、難度越高越多；等級遠高於怪物時幾乎沒有', () => {
  const a = runExpCap('prontera', 30, { mult: 1 }), b = runExpCap('prontera', 300, { mult: 1 }), c = runExpCap('prontera', 300, { mult: 2 });
  assert.ok(a > 0 && a < b && b < c);
  assert.ok(runExpCap('prontera', 300, { level: 60 }) <= runExpCap('prontera', 300, { level: 1 }) / 100 + 1e-6);
  // 第 180 秒的魔王只在打超過 180 秒時算進去
  const lv = 1, boss = R.monsters.angeling.exp;
  assert.ok(runExpCap('payon', 181, { mult: 1, level: lv }) - runExpCap('payon', 179, { mult: 1, level: lv }) >= boss);
  assert.equal(runExpCap('nowhere', 300), 0);
  // 跳過劇情：只有頭目的量
  assert.ok(runExpCap('sunken', 0, { skip: true }) > 0);
});

test('沒有違規：回傳 doc 為 null', () => {
  const r = checkSave(doc([ch()]), doc([ch({ exp: 100 })]), at(claim()));
  assert.deepEqual([r.issues, r.doc], [[], null]);
  assert.equal(r.meta.gain, 100);
  assert.ok(r.meta.cap > 100);
});

test('經驗：沒有憑證就不給；有憑證但超過上限就降回上限', () => {
  const n = checkSave(doc([ch()]), doc([ch({ exp: 50 })]), at());
  assert.deepEqual(codes(n), ['exp-no-claim']);
  assert.equal(chars(n.doc)[0].exp, 0);
  const r = checkSave(doc([ch({ level: 1 })]), doc([ch({ level: 99 })]), at(claim('prontera', 120)));
  assert.deepEqual(codes(r), ['exp']);
  const cap = runExpCap('prontera', 120, { mult: 1, level: 1 });
  const c = chars(r.doc)[0];
  let cum = 0; for (let l = 1; l < c.level; l++) cum += R.expNext[l - 1];
  assert.ok(cum + c.exp <= cap && cum + c.exp + R.expNext[c.level - 1] > cap, `lv ${c.level}`);
  // 一張憑證只給一個角色
  const two = checkSave(doc([ch(), ch({ id: 'c2' })]), doc([ch({ exp: 30 }), ch({ id: 'c2', exp: 30 })]), at(claim()));
  assert.deepEqual(codes(two), ['exp-no-claim']);
  assert.equal(two.issues[0].char, 'c2');
});

test('新角色：等級歸 1、拿掉 dev 與轉職；自己的新手裝備照收', () => {
  const next = doc([ch({ id: 'n1', level: 50, jobLevel: 30, exp: 9, dev: true, promotion: 'knight' })], acc({ inventory: [{ uid: 's1', itemId: 1101, owner: 'n1', cards: [] }] }));
  const r = checkSave({}, next, at());
  assert.deepEqual(codes(r).sort(), ['new-dev', 'new-high', 'new-promoted']);
  const c = chars(r.doc)[0];
  assert.deepEqual([c.level, c.jobLevel, c.exp, c.dev, c.promotion], [1, 1, 0, undefined, undefined]);
  assert.equal(account(r.doc).inventory.length, 1);
});

test('職業：不超過上限；轉職後職業經驗不再增加', () => {
  const r = checkSave(doc([ch({ jobLevel: 49 })]), doc([ch({ jobLevel: 70 })]), at(claim('payon', 3600)));
  assert.ok(codes(r).includes('job-exp'));
  assert.ok(chars(r.doc)[0].jobLevel <= 50);
  const p = checkSave(doc([ch({ promotion: 'knight' })]), doc([ch({ promotion: 'knight', jobExp: 5 })]), at(claim()));
  assert.deepEqual(codes(p), ['job-exp']);
});

test('能力點與天賦：超過就重置；沒變動的舊資料不追溯', () => {
  const over = { str: 99, agi: 99, vit: 1, int: 1, dex: 1, luk: 1 };
  const r = checkSave(doc([ch()]), doc([ch({ stats: over })]), at());
  assert.deepEqual(codes(r), ['stats']);
  assert.deepEqual(chars(r.doc)[0].stats, { str: 1, agi: 1, vit: 1, int: 1, dex: 1, luk: 1 });
  assert.equal(checkSave(doc([ch({ stats: over })]), doc([ch({ stats: over })]), at()).doc, null);
  // 天賦：自己職業的樹最多 = 職業等級；別的職業的樹 0 點；不能超過 maxRank
  const own = Object.entries(R.talents).filter(([, t]) => t.job === 'swordsman');
  const other = Object.entries(R.talents).find(([, t]) => t.job === 'mage');
  const pick = (n) => { const t = {}; let left = n; for (const [id, d] of own) { if (!left) break; const k = Math.min(d.maxRank, left); t[id] = k; left -= k; } return t; };
  assert.equal(talentProblem(ch({ jobLevel: 10, talents: pick(10) })), null);
  assert.equal(talentProblem(ch({ jobLevel: 10, talents: pick(11) })).max, 10);
  assert.equal(talentProblem(ch({ talents: { [other[0]]: 1 } })).max, 0);
  assert.equal(talentProblem(ch({ talents: { [own[0][0]]: own[0][1].maxRank + 1 } })).why, 'rank');
  const t = checkSave(doc([ch()]), doc([ch({ talents: pick(11) })]), at());
  assert.deepEqual(codes(t), ['talents']);
  assert.deepEqual(chars(t.doc)[0].talents, {});
  // 轉職後職業不變（job 還是一轉），天賦照一轉的點數算
  assert.equal(talentProblem(ch({ promotion: 'knight', jobLevel: 50, talents: pick(50) })), null);
  // 二轉職業樹只能點專精的那個分支
  const kn = (b) => Object.keys(R.talents).find((id) => R.talents[id].job === 'knight' && R.talents[id].branch === b);
  assert.equal(talentProblem(ch({ job: 'knight', jobLevel: 10, talents: { [kn(0)]: 1 } })), null);
  assert.equal(talentProblem(ch({ job: 'knight', jobLevel: 10, spec: 0, talents: { [kn(0)]: 1 } })), null);
  assert.equal(talentProblem(ch({ job: 'knight', jobLevel: 10, talents: { [kn(0)]: 1, [kn(1)]: 1 } })).why, 'spec');
  assert.equal(talentProblem(ch({ job: 'knight', jobLevel: 10, spec: 2, talents: { [kn(0)]: 1 } })).why, 'spec');
});

test('新物品：只能來自關卡結算，品質、等級、階級要合理；同一件不能換內容', () => {
  const ok = { uid: 'a', itemId: 1104, quality: 2, ilvl: 8, tier: 1, affixes: [{}], cards: [null, null] };
  assert.equal(checkSave(doc([ch()]), doc([ch()], acc({ inventory: [ok] })), at(claim())).doc, null);
  // 詞綴數照品質：普通 0、精良 1、稀有 2、史詩 4、傳說 4＋1 條特殊詞綴
  const affixed = (quality, n) => checkSave(doc([ch()]), doc([ch()], acc({ inventory: [{ ...ok, quality, affixes: Array(n).fill({}) }] })), at(claim()));
  assert.deepEqual(codes(affixed(4, 5)).filter((c) => c === 'item-affixes'), []);
  assert.deepEqual(codes(affixed(1, 2)).filter((c) => c === 'item-affixes'), ['item-affixes']);
  assert.deepEqual(codes(affixed(4, 6)).filter((c) => c === 'item-affixes'), ['item-affixes']);
  const none = checkSave(doc([ch()]), doc([ch({ equipped: { weapon: 'a' } })], acc({ inventory: [ok] })), at());
  assert.deepEqual(codes(none), ['item-no-claim']);
  assert.deepEqual([account(none.doc).inventory, chars(none.doc)[0].equipped], [[], {}]);
  const prev = doc([ch()], acc({ inventory: [{ uid: 'old', itemId: 1104, quality: 1, cards: [null], refine: 0 }] }));
  const next = doc([ch()], acc({ inventory: [
    { uid: 'old', itemId: 1105, quality: 4, cards: [null], refine: 2 },
    ok,
    { uid: 'b', itemId: 1104, quality: 5, cards: [] },
    { uid: 'c', itemId: 1104, quality: 1, ilvl: 30, tier: 2, cards: [] },
    { uid: 'd', itemId: 999999, quality: 0, cards: [] },
  ] }));
  const r = checkSave(prev, next, at(claim()));
  assert.deepEqual(codes(r), ['item-edit', 'refine', 'item-quality', 'item-ilvl', 'item-unknown-item']);
  const inv = account(r.doc).inventory;
  assert.deepEqual(inv.map((i) => i.uid), ['old', 'a']);
  assert.deepEqual([inv[0].itemId, inv[0].quality, inv[0].refine], [1104, 1, 0]);
});

test('卡片：沒有憑證不能變多；有憑證也有上限', () => {
  const n = checkSave(doc([ch()], acc({ cards: { 4001: 1 } })), doc([ch()], acc({ cards: { 4001: 2 } })), at());
  assert.deepEqual(codes(n), ['cards-no-claim']);
  assert.deepEqual(account(n.doc).cards, { 4001: 1 });
  assert.equal(checkSave(doc([ch()]), doc([ch()], acc({ cards: { 4001: 2 } })), at(claim())).doc, null);
  const c = checkSave(doc([ch()]), doc([ch()], acc({ cards: { 4002: 500 } })), at(claim('prontera', 60)));
  assert.deepEqual(codes(c), ['cards']);
  // 插卡：庫存少一張、裝備上多一張，總數不變
  const w = { uid: 'w', itemId: 1104, quality: 1, cards: [null] };
  assert.equal(checkSave(doc([ch()], acc({ inventory: [w], cards: { 4001: 1 } })), doc([ch()], acc({ inventory: [{ ...w, cards: [4001] }], cards: {} })), at()).doc, null);
});

test('Kafra、材料、精煉：存檔裡只能變少（增加要走伺服器 op）', () => {
  const w = { uid: 'w', itemId: 1104, quality: 0, cards: [], refine: 3 };
  const prev = doc([ch()], acc({ inventory: [w], kafra: 100, materials: { 1010: 2 } }));
  assert.equal(checkSave(prev, doc([ch()], acc({ inventory: [w], kafra: 40, materials: { 1010: 1 } })), at()).doc, null);
  const r = checkSave(prev, doc([ch()], acc({ inventory: [{ ...w, refine: 9 }], kafra: 5000, materials: { 1010: 9, 984: 3 } })), at());
  assert.deepEqual(codes(r), ['refine', 'kafra', 'materials', 'materials']);
  const a = account(r.doc);
  assert.deepEqual([a.kafra, a.materials, a.inventory[0].refine], [100, { 1010: 2 }, 3]);
  const u = checkSave(doc([ch()]), doc([ch()], acc({ materials: { weird: 3 } })), at());
  assert.deepEqual([codes(u), u.doc], [['material-unknown'], null]);
});

test('op：買礦、賣出、精煉照引擎的算法；精煉亂數在伺服器', () => {
  const sword = { uid: 'w', itemId: 1104, quality: 2, affixes: [{}], cards: [4001, null], refine: 0 };
  const worn = { uid: 'e', itemId: 1104, quality: 0, cards: [] };
  const d0 = doc([ch({ equipped: { weapon: 'e' } })], acc({ inventory: [sword, worn], cards: { 4002: 3 }, kafra: 100 }));
  // 買 4 顆 phracon（15/顆）
  const b = applyOp(d0, { op: 'buy', ore: 1010, count: 4 });
  assert.deepEqual([account(b.doc).kafra, account(b.doc).materials], [40, { 1010: 4 }]);
  assert.equal(applyOp(d0, { op: 'buy', ore: 984, count: 1 }).error, 'missing');
  assert.equal(applyOp(d0, { op: 'buy', ore: 1, count: 1 }).error, 'bad_op');
  // 賣：已裝備的不賣，插著的卡退回，卡片照張數算
  const s = applyOp(d0, { op: 'sell', uids: ['w', 'e'], cards: [[4002, 2], [4003, 9]] });
  const gained = sellValue(sword) + R.cardValue['4002'] * 2;
  assert.equal(s.result.gained, gained);
  const sa = account(s.doc);
  assert.deepEqual([sa.kafra, sa.inventory.map((i) => i.uid), sa.cards], [100 + gained, ['e'], { 4001: 1, 4002: 1 }]);
  // 精煉 +0→+1（100%）用一顆 phracon
  const r1 = applyOp(b.doc, { op: 'refine', uid: 'w' }, () => 0.99);
  assert.deepEqual([r1.result.ok, account(r1.doc).inventory[0].refine, account(r1.doc).materials[1010]], [true, 1, 3]);
  // +5→+6 是 80%：亂數 0.9 失敗，裝備壞掉並從身上卸下
  const hi = doc([ch({ equipped: { weapon: 'w' } })], acc({ inventory: [{ ...sword, refine: 5 }], materials: { 1011: 1 } }));
  const f = applyOp(hi, { op: 'refine', uid: 'w' }, () => 0.9);
  assert.deepEqual([f.result.ok, account(f.doc).inventory, chars(f.doc)[0].equipped, account(f.doc).materials], [false, [], {}, {}]);
  const g = applyOp(hi, { op: 'refine', uid: 'w' }, () => 0.5);
  assert.equal(account(g.doc).inventory[0].refine, 6);
  assert.equal(applyOp(hi, { op: 'refine', uid: 'zz' }).error, 'missing');
  assert.equal(applyOp(doc([ch()], acc({ inventory: [sword] })), { op: 'refine', uid: 'w' }).error, 'missing');
  // 伺服器存的是 op 之後的版本：用戶端把它原樣存回來不會被擋
  for (const d of [b.doc, s.doc, r1.doc, f.doc]) assert.equal(checkSave(d, d, at()).doc, null);
});

test('API：影子模式照存並記 would-fix；RO_ONLINE_ENFORCE=1 存修正版並回傳 doc；op 與信箱', async (t) => {
  const TOKEN = 'tok_' + 'r'.repeat(30);
  for (const enforce of [false, true]) {
    const store = new RoStore({});
    const app = createRoLife({ env: enforce ? { RO_ONLINE_ENFORCE: '1' } : {}, store, fetchImpl: () => { throw Error('no'); } });
    const id = await store.loginIdentity('google', 'sub-r', 'R');
    await store.createSession(createHash('sha256').update(TOKEN).digest('hex'), id, 3600);
    const srv = createServer(async (req, res) => { if (!(await app.handle(req, res))) { res.writeHead(404); res.end(); } });
    await new Promise((r) => srv.listen(0, '127.0.0.1', r));
    t.after(() => srv.close());
    const base = `http://127.0.0.1:${srv.address().port}/api/ro/`;
    const call = async (m, p, body) => { const r = await fetch(base + p, { method: m, headers: { 'x-session': TOKEN, 'content-type': 'application/json' }, body: body && JSON.stringify(body) }); return { status: r.status, body: await r.json() }; };
    // 已經有 50 Kafra 的存檔（直接放進 store；新帳號第一次存檔帶 Kafra 會被擋）
    store.mem.gameSaves.set(id, { doc: doc([ch({ id: 'k', level: 1, jobLevel: 1 })], acc({ kafra: 50 })), rev: 1, wid: 'a', updatedAt: Date.now() });
    const r = await call('PUT', 'game/save', { rev: 1, doc: doc([ch({ id: 'k', level: 1, jobLevel: 1 })], acc({ kafra: 999999 })), wid: 'b' });
    const saved = account(store.mem.gameSaves.get(id).doc);
    const log = store.mem.gameLogs.at(-1);
    if (!enforce) {
      assert.deepEqual(r.body, { rev: 2 });
      assert.equal(saved.kafra, 999999);
      assert.ok(log.flags.includes('would-fix'));
    } else {
      assert.equal(r.body.rev, 2);
      assert.equal(account(r.body.doc).kafra, 50);
      assert.equal(saved.kafra, 50);
      assert.ok(log.flags.includes('fixed'));
      const again = await call('PUT', 'game/save', { rev: 2, doc: r.body.doc, wid: 'c' });
      assert.deepEqual(again.body, { rev: 3 });
      // op：伺服器扣點數、加材料，回傳新版存檔
      const op = await call('POST', 'game/op', { op: 'buy', ore: 1010, count: 2 });
      assert.equal(op.status, 200);
      assert.equal(op.body.rev, 4);
      assert.deepEqual([account(op.body.doc).kafra, account(op.body.doc).materials], [20, { 1010: 2 }]);
      assert.equal(store.mem.gameLogs.at(-1).kind, 'op');
      assert.equal((await call('POST', 'game/op', { op: 'buy', ore: 1010, count: 99 })).body.error, 'missing');
      // 用戶端拿 op 回傳的 rev 繼續存檔：材料不會被當成憑空出現
      const after = await call('PUT', 'game/save', { rev: 4, doc: op.body.doc, wid: 'd' });
      assert.deepEqual(after.body, { rev: 5 });
    }
    assert.equal(log.detail.fix[0].code, 'kafra');
    assert.deepEqual((await call('GET', 'game/mail')).body, { mail: [], pending: 0 });
    // 難度倍率只承認 1～2
    const run = (await call('POST', 'game/run', { stage: 'prontera', mult: 50 })).body.run;
    assert.equal(store.mem.gameRuns.get(run).mult, 2);
  }
});

test('打倒的 MVP、通過的關卡、轉職：只能跟著該關憑證來（無盡之塔開幾層看這些）', () => {
  // 普隆德拉的憑證：可以記 mastering、通過 prontera；不能順便記別關的 MVP
  let r = checkSave(doc([ch()]), doc([ch({ mvpsDefeated: ['mastering', 'drake'], stagesCleared: ['prontera', 'sewer'] })]), at(claim()));
  assert.deepEqual(codes(r), ['mvps', 'stages']);
  assert.deepEqual([chars(r.doc)[0].mvpsDefeated, chars(r.doc)[0].stagesCleared], [['mastering'], ['prontera']]);
  // 沒憑證：全部拿掉；舊的照留
  r = checkSave(doc([ch({ mvpsDefeated: ['mastering'] })]), doc([ch({ mvpsDefeated: ['mastering', 'golden_thief_bug'] })]), at());
  assert.deepEqual([codes(r), chars(r.doc)[0].mvpsDefeated], [['mvps'], ['mastering']]);
  // 新角色不能一開始就有
  r = checkSave(doc([]), doc([ch({ id: 'n', level: 1, jobLevel: 1, mvpsDefeated: ['mastering'], stagesCleared: ['prontera'] })]), at());
  assert.deepEqual(codes(r), ['mvps', 'stages']);
  // 轉職：只在普隆德拉城的劇情關、要是同一條職業線，之後不能換
  assert.equal(checkSave(doc([ch()]), doc([ch({ promotion: 'knight' })]), at(claim('prt_castle', 300))).doc, null);
  r = checkSave(doc([ch()]), doc([ch({ promotion: 'knight' })]), at(claim()));
  assert.deepEqual([codes(r), chars(r.doc)[0].promotion], [['promotion'], undefined]);
  r = checkSave(doc([ch()]), doc([ch({ promotion: 'wizard' })]), at(claim('prt_castle', 300)));
  assert.deepEqual(codes(r), ['promotion']);
  r = checkSave(doc([ch({ promotion: 'knight' })]), doc([ch({ promotion: 'crusader' })]), at(claim('prt_castle', 300)));
  assert.deepEqual([codes(r), chars(r.doc)[0].promotion], [['promotion'], 'knight']);
  // 憑證綁別的角色就不算
  r = checkSave(doc([ch()]), doc([ch({ mvpsDefeated: ['mastering'] })]), at(claim('prontera', 600, { char: 'other' })));
  assert.deepEqual(codes(r), ['mvps']);
});
