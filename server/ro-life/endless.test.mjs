// 282 無盡之塔（/api/ro/game/endless…）測試：記憶體資料。npm run test:ro
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { createRoLife } from './server.mjs';
import { RoStore } from './store.mjs';
import { floorsOpen, buyUp, rebuild, encodeRuns, season } from './endless.mjs';
import R from './rules-data.mjs';

const sha = (s) => createHash('sha256').update(s).digest('hex');
const TOKEN = 'tok_' + 'e'.repeat(30);
const E = R.endless;

async function boot() {
  const store = new RoStore({});
  const app = createRoLife({ env: {}, store, fetchImpl: () => { throw Error('no network'); } });
  const id = await store.loginIdentity('google', 'sub-e', '塔塔');
  await store.createSession(sha(TOKEN), id, 3600);
  const server = createServer(async (req, res) => { if (!(await app.handle(req, res))) { res.writeHead(404); res.end(); } });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}/api/ro/`;
  const call = async (method, path, body) => {
    const r = await fetch(base + path, { method, headers: { 'x-session': TOKEN, ...(body ? { 'content-type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, body: await r.json().catch(() => ({})) };
  };
  const io = async (msgs, run = null) => (await call('POST', 'game/endless/io', { run, msgs })).body.msgs;
  return { store, id, call, io, close: () => new Promise((r) => server.close(r)) };
}
const knight = (o = {}) => ({ id: 'k1', name: 'Kn', job: 'swordsman', promotion: 'knight', level: 60, jobLevel: 30, mvpsDefeated: ['mastering', 'golden_thief_bug'], ...o });
const seed = async (s, chars) => s.store.putGameSave(s.id, 0, { 'characters.v1': JSON.stringify(chars), 'account.v1': '{}' }, 'w');
// 讓伺服器以為這場已經開打一段時間（牆鐘上限）
const age = (s, run, secs) => { s.store.mem.endlessRuns.get(run).started_at -= secs * 1000; };

test('開放樓層：轉職後依序打倒 MVP，每區 10 層；golden_thief_bug 可代替 mastering', () => {
  assert.equal(floorsOpen({ job: 'swordsman', mvpsDefeated: ['mastering'] }), 0);
  assert.equal(floorsOpen(knight({ mvpsDefeated: [] })), 0);
  assert.equal(floorsOpen(knight({ mvpsDefeated: ['mastering'] })), 10);
  assert.equal(floorsOpen(knight({ mvpsDefeated: ['mastering', 'drake'] })), 10);
  assert.equal(floorsOpen(knight({ mvpsDefeated: ['golden_thief_bug', 'drake'] })), 30);
  assert.equal(floorsOpen(knight({ mvpsDefeated: ['drake'] })), 0);
});

test('強化：價格照引擎，點數不夠或滿級不能買', () => {
  assert.deepEqual(buyUp({ earned: 0 }, 'damage'), { error: 'missing' });
  const r = buyUp({ earned: 10 }, 'damage');
  assert.equal(r.progress.ups.damage, 1);
  assert.equal(r.progress.spent, E.upCost.damage[0]);
  assert.deepEqual(buyUp({ earned: 999, ups: { targets: E.upMax.targets } }, 'targets'), { error: 'bad_op' });
  assert.deepEqual(buyUp({ earned: 999 }, 'nope'), { error: 'bad_op' });
});

test('操作重組：後來的段從 at 覆蓋（接續時截斷），雜湊同理', () => {
  const chunks = [
    { at: 0, runs: [1, 0, 3, 0, 0, 2], from: 0, checks: ['a'] },
    { at: 5, runs: [0, -1, 4], from: 1, checks: ['b'] },
    { at: 3, runs: [-1, 0, 2], from: 0, checks: ['c'] }, // 接續：退回第 3 格
  ];
  const r = rebuild(chunks, 5, 1);
  assert.deepEqual(r.moves, [1, 0, 1, 0, 1, 0, -1, 0, -1, 0]);
  assert.deepEqual(r.checks, ['c']);
  assert.deepEqual(encodeRuns(r.moves), [1, 0, 3, -1, 0, 2]);
});

test('一場塔：開局給伺服器的角色快照與種子、分段收操作、對不上要求重送、結束回 pending', async (t) => {
  const s = await boot();
  t.after(s.close);
  assert.equal((await s.call('GET', 'config')).body.endless, true);
  await seed(s, [knight(), { id: 'n1', name: 'Nov', job: 'novice' }]);
  // 沒轉職不能進
  assert.deepEqual(await s.io([{ t: 'start', token: 'x', charId: 'n1', wave: 1, engine: 28, build: 'abc' }]), [{ t: 'error', why: 'job' }]);
  assert.deepEqual(await s.io([{ t: 'start', charId: 'zz', wave: 1, engine: 28, build: 'abc' }]), [{ t: 'error', why: 'char' }]);
  const [st] = await s.io([{ t: 'start', charId: 'k1', wave: 1, engine: 28, build: 'abc123' }]);
  assert.equal(st.t, 'started');
  assert.equal(st.last, 20);
  assert.equal(st.wave, 1);
  assert.equal(st.char.level, 60); // 伺服器存檔裡的角色
  assert.deepEqual(st.char.endless, { reached: 1, best: 0, earned: 0, spent: 0, ups: {}, skills: [] });
  assert.ok(Number.isInteger(st.seed) && st.seed > 0);
  age(s, st.run, 60);
  // 第一段：40 格、1 個雜湊
  let m = await s.io([{ t: 'in', at: 0, runs: [1024, 0, 30, 0, 1024, 10], from: 0, checks: ['deadbeef'], picks: [12, 0] }], st.run);
  assert.deepEqual(m, []);
  // 重送同一段：要求從伺服器的進度重送
  m = await s.io([{ t: 'in', at: 0, runs: [1024, 0, 40], from: 0, checks: ['deadbeef'] }], st.run);
  assert.deepEqual(m, [{ t: 'resumed', ticks: 40, checks: 1 }]);
  // 斷線重連
  assert.deepEqual(await s.io([{ t: 'resume', token: 'x', run: st.run }]), [{ t: 'resumed', ticks: 40, checks: 1 }]);
  m = await s.io([{ t: 'in', at: 40, runs: [0, 0, 20], from: 1, checks: ['cafe'] }, { t: 'end', claim: { wave: 2, cleared: 1, points: 5, bestWave: 1, score: 900 } }], st.run);
  assert.deepEqual(m, [{ t: 'saved', status: 'pending' }]);
  const run = await s.store.getEndlessRun(s.id, st.run);
  assert.deepEqual([run.state, run.status, run.ticks, run.checks, run.picks, run.claim.score], ['ended', 'pending', 60, 2, [12, 0], 900]);
  // 結束後再送：照舊回 saved
  assert.deepEqual(await s.io([{ t: 'end', claim: {} }], st.run), [{ t: 'saved', status: 'pending' }]);
  assert.deepEqual(await s.io([{ t: 'in', at: 60, runs: [0, 0, 1], from: 2, checks: [] }], st.run), [{ t: 'error', why: 'gone' }]);
});

test('防護：操作比牆鐘 4 倍還快就結束這場（不排名）；別人的場次拿不到', async (t) => {
  const s = await boot();
  t.after(s.close);
  await seed(s, [knight()]);
  const [st] = await s.io([{ t: 'start', charId: 'k1', wave: 1, engine: 28, build: 'b' }]);
  // 快轉 ×4 是正常的：開局 60 秒送 4 分鐘的操作照收
  age(s, st.run, 60);
  assert.deepEqual(await s.io([{ t: 'in', at: 0, runs: [0, 0, 14400], from: 0, checks: [] }], st.run), []);
  // 一次送 1 小時的操作
  assert.deepEqual(await s.io([{ t: 'in', at: 14400, runs: [0, 0, 216000], from: 0, checks: [] }], st.run), [{ t: 'error', why: 'gone' }]);
  const run = await s.store.getEndlessRun(s.id, st.run);
  assert.deepEqual([run.state, run.status, run.verdict.why], ['ended', 'unranked', 'fast']);
  assert.equal(await s.store.getEndlessRun(s.id + 1, st.run), null);
  // 格式不對（方向不是整數）：直接結束，不要求重送
  const [st3] = await s.io([{ t: 'start', charId: 'k1', wave: 1, engine: 28, build: 'b' }]);
  age(s, st3.run, 60);
  assert.deepEqual(await s.io([{ t: 'in', at: 0, runs: [0.5, 0, 30], from: 0, checks: [] }], st3.run), [{ t: 'error', why: 'gone' }]);
  assert.equal((await s.store.getEndlessRun(s.id, st3.run)).status, 'unranked');
  // 雜湊數不能比格數多
  const [st2] = await s.io([{ t: 'start', charId: 'k1', wave: 1, engine: 28, build: 'b' }]);
  age(s, st2.run, 60);
  assert.deepEqual(await s.io([{ t: 'in', at: 0, runs: [0, 0, 30], from: 0, checks: ['a', 'b'] }], st2.run), [{ t: 'error', why: 'gone' }]);
});

test('存起來、接續（只能一次）：操作與選卡退回切點，接著從切點往下收', async (t) => {
  const s = await boot();
  t.after(s.close);
  await seed(s, [knight()]);
  const [st] = await s.io([{ t: 'start', charId: 'k1', wave: 1, engine: 28, build: 'b' }]);
  age(s, st.run, 120);
  await s.io([{ t: 'in', at: 0, runs: [1, 0, 60, 0, 1, 60], from: 0, checks: ['a', 'b', 'c', 'd'], picks: [30, 1, 90, 2] }], st.run);
  assert.deepEqual(await s.io([{ t: 'suspend', claim: { wave: 3, score: 1234 }, cut: 60 }], st.run), [{ t: 'suspended' }]);
  const info = (await s.call('GET', 'game/endless?char=k1')).body;
  assert.deepEqual(info.suspended && [info.suspended.run, info.suspended.wave, info.suspended.score], [st.run, 3, 1234]);
  const [r] = await s.io([{ t: 'resume', token: 'x', run: st.run, restore: true }]);
  assert.equal(r.t, 'resumed');
  assert.deepEqual([r.ticks, r.checks, r.restore.picks, r.restore.runs, r.restore.seed, r.restore.char.id], [60, 2, [30, 1], [1, 0, 60], st.seed, 'k1']);
  // 第二次接續不行
  assert.deepEqual(await s.io([{ t: 'resume', token: 'x', run: st.run, restore: true }]), [{ t: 'error', why: 'gone' }]);
  assert.deepEqual(await s.io([{ t: 'in', at: 60, runs: [-1, 0, 30], from: 2, checks: ['f0'] }], st.run), []);
  const run = await s.store.getEndlessRun(s.id, st.run);
  const { moves, checks } = rebuild(await s.store.endlessChunks(st.run), run.ticks, run.checks);
  assert.deepEqual([moves.length / 2, encodeRuns(moves), checks], [90, [1, 0, 60, -1, 0, 30], ['a', 'b', 'f0']]);
  // 接續過的再存就直接結束
  assert.deepEqual(await s.io([{ t: 'suspend', claim: {}, cut: 90 }], st.run), [{ t: 'suspended' }]);
  assert.equal((await s.store.getEndlessRun(s.id, st.run)).status, 'pending');
  // 開新的一場會結束存著的
  const [a] = await s.io([{ t: 'start', charId: 'k1', wave: 1, engine: 28, build: 'b' }]);
  await s.io([{ t: 'suspend', claim: {}, cut: 0 }], a.run);
  await s.io([{ t: 'start', charId: 'k1', wave: 1, engine: 28, build: 'b' }]);
  assert.deepEqual((await s.store.getEndlessRun(s.id, a.run)).state, 'ended');
});

test('驗證結果：verified 才加塔的點數與排行榜，同一場只算一次；強化用驗證過的點數買', async (t) => {
  const s = await boot();
  t.after(s.close);
  await seed(s, [knight()]);
  const [st] = await s.io([{ t: 'start', charId: 'k1', wave: 1, engine: 28, build: 'b' }]);
  age(s, st.run, 60);
  await s.io([{ t: 'in', at: 0, runs: [1, 0, 30], from: 0, checks: ['a'] }, { t: 'end', claim: { score: 99999 } }], st.run);
  assert.equal((await s.store.endlessPending()).length, 1);
  assert.equal(await s.store.endlessVerdict(st.run, { status: 'verified', verdict: { ok: true }, score: 4321, floor: 7, points: 30, best: 6 }), true);
  assert.equal(await s.store.endlessVerdict(st.run, { status: 'verified', verdict: { ok: true }, score: 4321, floor: 7, points: 30, best: 6 }), false);
  const info = (await s.call('GET', 'game/endless?char=k1')).body;
  assert.deepEqual([info.bestScore, info.progress.earned, info.progress.best, info.progress.reached], [4321, 30, 6, 7]);
  let r = await s.call('POST', 'game/endless/upgrade', { char: 'k1', id: 'damage' });
  assert.deepEqual([r.status, r.body.progress.ups.damage, r.body.progress.spent], [200, 1, E.upCost.damage[0]]);
  r = await s.call('POST', 'game/endless/skills', { char: 'k1', skills: ['bash', 'magnum'] });
  assert.deepEqual(r.body.progress.skills, ['bash', 'magnum']);
  // 下一場的開局快照帶著強化與技能
  const [st2] = await s.io([{ t: 'start', charId: 'k1', wave: 1, engine: 28, build: 'b' }]);
  assert.deepEqual([st2.char.endless.ups, st2.char.endless.skills, st2.best], [{ damage: 1 }, ['bash', 'magnum'], 6]);
  const lad = (await s.call('GET', `game/ladder?season=current&job=knight`)).body;
  assert.deepEqual([lad.season, lad.rows.map((x) => [x.rank, x.name, x.score, x.wave, x.mine])], [season(), [[1, 'Kn', 4321, 7, true]]]);
  assert.equal(lad.me.length, 1);
  assert.deepEqual((await s.call('GET', 'game/ladder?season=current&job=wizard')).body.rows, []);
  // 引擎預設 job=all、season=all（歷代）
  const all = (await s.call('GET', 'game/ladder?season=all&job=all')).body;
  assert.deepEqual([all.season, all.rows.length], ['all', 1]);
  // 重置強化：扣 500 Kafra，花掉的點數退回
  await s.store.putGameSave(s.id, (await s.store.getGameSave(s.id)).rev, { 'characters.v1': JSON.stringify([knight()]), 'account.v1': JSON.stringify({ kafra: 600 }) }, 'w2');
  r = await s.call('POST', 'game/op', { op: 'towerReset', char: 'k1' });
  assert.deepEqual([r.status, r.body.progress.ups, r.body.progress.spent, JSON.parse(r.body.doc['account.v1']).kafra], [200, {}, 0, 100]);
  r = await s.call('POST', 'game/op', { op: 'towerReset', char: 'k1' });
  assert.deepEqual([r.status, r.body.error], [400, 'missing']); // Kafra 不夠
});

test('守護者面板：待檢查的場次與自報點數', async (t) => {
  const s = await boot();
  t.after(s.close);
  await seed(s, [knight()]);
  const [st] = await s.io([{ t: 'start', charId: 'k1', wave: 1, engine: 28, build: 'b' }]);
  age(s, st.run, 60);
  await s.io([{ t: 'in', at: 0, runs: [0, 0, 30], from: 0, checks: ['a'], claim: { points: 12 } }, { t: 'end', claim: { points: 12 } }], st.run);
  assert.deepEqual((await s.call('GET', 'game/endless?char=k1')).body.pending, { runs: 1, points: 12 });
});
