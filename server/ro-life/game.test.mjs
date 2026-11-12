// 282 線上角色 API（/api/ro/game/…）測試：記憶體資料，登入工作階段直接寫進 store。
// npm run test:ro
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { createRoLife } from './server.mjs';
import { RoStore } from './store.mjs';
import { summarizeSave } from './game.mjs';
// 存檔與 op 的回應都帶可交易清單 trade（trade.test.mjs 另外測內容）
const noTrade = ({ trade, ...b }) => (assert.ok(trade && Array.isArray(trade.uids)), b);

const sha = (s) => createHash('sha256').update(s).digest('hex');
const TOKEN = 'tok_' + 'x'.repeat(30);

async function boot({ env = {}, store = new RoStore({}) } = {}) {
  const app = createRoLife({ env, store, fetchImpl: () => { throw Error('no network'); } });
  const id = await store.loginIdentity('google', 'sub-1', '阿光');
  await store.createSession(sha(TOKEN), id, 3600);
  const server = createServer(async (req, res) => { if (!(await app.handle(req, res))) { res.writeHead(404); res.end(); } });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}/api/ro/`;
  const call = async (method, path, body, headers = { 'x-session': TOKEN }) => {
    const r = await fetch(base + path, { method, headers: { ...headers, ...(body ? { 'content-type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, body: await r.json().catch(() => ({})) };
  };
  return { store, id, call, close: () => new Promise((r) => server.close(r)) };
}

const char = (o = {}) => ({ id: 'c1', name: 'Tommy', job: 'novice', level: 1, jobLevel: 1, exp: 0, jobExp: 0, ...o });
const docOf = (chars, account = { inventory: [], cards: {}, materials: {}, kafra: 0 }) => ({ 'characters.v1': JSON.stringify(chars), 'account.v1': JSON.stringify(account) });

test('線上存檔：讀寫、rev 衝突、回應遺失時用 mine 接回，且不動單機的雲端備份', async (t) => {
  const s = await boot();
  t.after(s.close);
  assert.deepEqual((await s.call('GET', 'config', null, {})).body.online, true);
  let r = await s.call('GET', 'game/save');
  assert.equal(r.status, 200);
  assert.deepEqual(noTrade(r.body), { rev: 0, doc: {}, name: '阿光' });

  r = await s.call('PUT', 'game/save', { rev: 0, doc: docOf([char()]), wid: 'w1', lite: true });
  assert.deepEqual({ ...r, body: noTrade(r.body) }, { status: 200, body: { rev: 1 } });
  r = await s.call('PUT', 'game/save', { rev: 0, doc: docOf([char({ name: 'X' })]), wid: 'w2' });
  assert.equal(r.status, 409);
  assert.equal(r.body.rev, 1);
  assert.equal(JSON.parse(r.body.doc['characters.v1'])[0].name, 'Tommy');
  // 上一筆 w1 其實寫進去了，這台不知道：帶 mine:[w1] 就接著寫
  r = await s.call('PUT', 'game/save', { rev: 0, doc: docOf([char({ exp: 5 })]), wid: 'w3', mine: ['w1'] });
  assert.deepEqual(noTrade(r.body), { rev: 2 });

  // Bearer 也可以；沒登入 401
  assert.equal((await s.call('GET', 'game/save', null, { authorization: `Bearer ${TOKEN}` })).body.rev, 2);
  assert.equal((await s.call('GET', 'game/save', null, {})).status, 401);
  // 單機的雲端備份沒被碰到
  assert.deepEqual((await s.call('GET', 'save', null, { authorization: `Bearer ${TOKEN}` })).body.rev, 0);
  // 不認得的 key、非字串的值都擋掉
  assert.equal((await s.call('PUT', 'game/save', { rev: 2, doc: { 'hack.v1': '{}' } })).status, 400);
  assert.equal((await s.call('PUT', 'game/save', { rev: 2, doc: { 'characters.v1': [] } })).status, 400);
});

test('關卡憑證：領取後記下關卡，重複領或沒憑證就加註疑點（只記錄不擋）', async (t) => {
  const s = await boot();
  t.after(s.close);
  await s.call('PUT', 'game/save', { rev: 0, doc: docOf([char()]), wid: 'a' });
  const run = (await s.call('POST', 'game/run', { stage: 'prontera', mult: 1 })).body.run;
  assert.match(run, /^[\w-]{20,}$/);
  let r = await s.call('PUT', 'game/save', { rev: 1, doc: docOf([char({ level: 3, exp: 40 })]), wid: 'b', run });
  assert.deepEqual(noTrade(r.body), { rev: 2 });
  r = await s.call('PUT', 'game/save', { rev: 2, doc: docOf([char({ level: 4, exp: 80 })]), wid: 'c', run });
  assert.deepEqual(noTrade(r.body), { rev: 3 });
  r = await s.call('PUT', 'game/save', { rev: 3, doc: docOf([char({ level: 4, exp: 90 })], { inventory: [{ uid: 'u1', itemId: 1101, tier: 3 }], cards: {}, materials: {}, kafra: 0 }), wid: 'd' });
  assert.deepEqual(noTrade(r.body), { rev: 4 });

  const logs = s.store.mem.gameLogs.filter((l) => l.kind === 'save');
  assert.equal(logs.length, 4);
  assert.deepEqual(logs[0].detail.chars[0].new, true);
  // 憑證才領到幾毫秒就升 2 級：超過這一場的經驗上限（影子模式照存，只記 would-fix）
  assert.deepEqual(logs[1].flags, ['would-fix']);
  assert.equal(logs[1].detail.fix[0].code, 'exp');
  assert.equal(logs[1].detail.stage, 'prontera');
  assert.equal(logs[1].detail.mult, 1);
  assert.equal(typeof logs[1].detail.secs, 'number');
  assert.deepEqual(logs[1].detail.chars[0].lv, [1, 3]);
  // 憑證已經用過：經驗當作沒有憑證
  assert.deepEqual(logs[2].flags, ['claim-reused', 'gain-no-claim', 'would-fix']);
  assert.equal(logs[2].detail.fix[0].code, 'exp-no-claim');
  // 沒有憑證的經驗與新物品
  assert.deepEqual(logs[3].flags, ['gain-no-claim', 'would-fix']);
  assert.deepEqual(logs[3].detail.fix.map((f) => f.code), ['exp-no-claim', 'item-no-claim']);
  assert.equal(logs[3].detail.addedCount, 1);
  assert.equal(JSON.parse(s.store.mem.gameSaves.get(s.id).doc['account.v1']).inventory.length, 1);
  assert.equal((await s.call('POST', 'game/run', {})).status, 400);
  // 存檔 409 不會用掉憑證；接續中斷的關卡沿用原本的開打時間，舊憑證作廢
  const r1 = (await s.call('POST', 'game/run', { stage: 'payon', mult: 1 })).body.run;
  const issued1 = s.store.mem.gameRuns.get(r1).issued;
  assert.equal((await s.call('PUT', 'game/save', { rev: 0, doc: docOf([char({ level: 4, exp: 95 })]), wid: 'x', run: r1 })).status, 409);
  assert.equal(s.store.mem.gameRuns.get(r1).claimed, null);
  await new Promise((r) => setTimeout(r, 5));
  const r2 = (await s.call('POST', 'game/run', { stage: 'payon', mult: 1, played: 30 })).body.run;
  assert.equal(s.store.mem.gameRuns.has(r1), false);
  assert.equal(s.store.mem.gameRuns.get(r2).issued, issued1);
  const r3 = (await s.call('POST', 'game/run', { stage: 'payon', mult: 1 })).body.run;
  assert.ok(s.store.mem.gameRuns.get(r3).issued > issued1);
  assert.equal(s.store.mem.gameRuns.has(r2), false);
  // 別人的憑證不能領
  const other = await s.store.loginIdentity('google', 'sub-2', '別人');
  await s.store.createGameRun(other, { id: 'someone-elses-run-0000', stage: 'prontera', mult: 1, skip: false, char: null });
  r = await s.call('PUT', 'game/save', { rev: 4, doc: docOf([char({ level: 5, exp: 90 })], { inventory: [{ uid: 'u1', itemId: 1101, tier: 3 }], cards: {}, materials: {}, kafra: 0 }), wid: 'e', run: 'someone-elses-run-0000' });
  assert.deepEqual(noTrade(r.body), { rev: 5 });
  assert.deepEqual(s.store.mem.gameLogs.at(-1).flags, ['claim-unknown', 'gain-no-claim', 'would-fix']);
});

test('summarizeSave：新角色等級過高、dev 角色、一次跳太多級都會標記；沒變化回 null', () => {
  const a = docOf([char()]);
  assert.equal(summarizeSave(a, a), null);
  assert.deepEqual(summarizeSave({}, docOf([char({ level: 60, jobLevel: 50, dev: true })])).flags, ['dev', 'new-high']);
  assert.deepEqual(summarizeSave(a, docOf([char({ level: 15 })]), { claim: { stage: 'x' } }).flags, ['big-jump']);
  // 建角時發的新手裝備（owner＝新角色）不算獲得；別人的 owner 照算
  const starter = summarizeSave({}, docOf([char()], { inventory: [{ uid: 's1', itemId: 1201, owner: 'c1' }], cards: {}, materials: {}, kafra: 0 }));
  assert.deepEqual([starter.flags, starter.detail.starter, starter.detail.added], [[], 1, undefined]);
  assert.deepEqual(summarizeSave(a, docOf([char()], { inventory: [{ uid: 's2', itemId: 1201, owner: 'c1' }], cards: {}, materials: {}, kafra: 0 })).flags, ['gain-no-claim']);
  // 用 Kafra 點數買礦石：材料增加但點數減少，不算獲得
  const before = docOf([char()], { inventory: [], cards: {}, materials: {}, kafra: 100 });
  const after = docOf([char()], { inventory: [], cards: {}, materials: { 984: 1 }, kafra: 40 });
  assert.deepEqual(summarizeSave(before, after).flags, []);
  assert.deepEqual(summarizeSave(before, after).detail, { kafra: [100, 40], materials: [0, 1] });
  // 同一件裝備被改成別的東西、或 Kafra 點數憑空增加
  const gear = (o) => docOf([char()], { inventory: [{ uid: 'g1', itemId: 1101, tier: 1, quality: 0, cards: [null], ...o }], cards: { 4001: 1 }, materials: {}, kafra: 100 });
  assert.deepEqual(summarizeSave(gear({}), gear({ tier: 5, quality: 4 })).flags, ['item-edit']);
  assert.deepEqual(summarizeSave(gear({}), gear({ refine: 1 })).flags, []);
  const sold = docOf([char()], { inventory: [], cards: { 4001: 1 }, materials: {}, kafra: 130 });
  assert.deepEqual(summarizeSave(gear({}), sold).flags, []);
  const free = docOf([char()], { inventory: [{ uid: 'g1', itemId: 1101, tier: 1, quality: 0, cards: [null] }], cards: { 4001: 1 }, materials: {}, kafra: 999 });
  assert.deepEqual(summarizeSave(gear({}), free).flags, ['kafra-no-sale']);
});

test('有 RO_ONLINE=1 但資料表還沒套用：一樣關閉', async (t) => {
  const store = new RoStore({});
  const s = await boot({ store, env: { RO_ONLINE: '1' } });
  t.after(s.close);
  store.sql = async () => [{ ok: false }];
  assert.equal((await s.call('GET', 'config', null, {})).body.online, false);
  const store2 = new RoStore({});
  const s2 = await boot({ store: store2, env: { RO_ONLINE: '1' } });
  t.after(s2.close);
  store2.sql = async () => [{ ok: true }];
  assert.equal((await s2.call('GET', 'config', null, {})).body.online, true);
});

test('有資料庫但沒設 RO_ONLINE=1：線上模式關閉，回 401 讓引擎退回單機', async (t) => {
  const store = new RoStore({});
  const s = await boot({ store });
  t.after(s.close);
  store.sql = () => Promise.resolve([]); // 假裝接了資料庫（只看 enabled 的判斷）
  store.sessionAccount = async () => s.id;
  store.account = async (id) => ({ id, name: '阿光', state: 0, unbanTime: null, providers: ['google'] });
  assert.equal((await s.call('GET', 'config', null, {})).body.online, false);
  assert.deepEqual(await s.call('GET', 'game/save'), { status: 401, body: { error: 'offline' } });
});
