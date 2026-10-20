// 規則層測試：node --test tools/core.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FISH, zoneFish, reelParams, LEGENDS } from '../src/core/fishdb.js';
import { judge, tierOfScore, potential, TIERS } from '../src/core/quality.js';
import { createReel } from '../src/core/reel.js';
import { mulberry } from '../src/core/rng.js';
import { SPOTS, CHECKPOINTS, height, BOULDERS, zoneAt } from '../src/core/map.js';
import { pickFish, CHAPTERS, chapterReady, claimChapter, ensureBoard, deliverQuest, questHave, matches } from '../src/core/quests.js';
import { fresh, sanitize, recordCatch, makeCatch, CREEL_MAX } from '../src/core/save.js';
import { createBoat, stepBoat, oarPose } from '../src/core/boat.js';
import { buildGrid } from '../src/core/grid.js';
import { current, BERTH } from '../src/core/map.js';

const DT = 1 / 60;
// 「會玩的人」：平靜時按住，張力到 70 或魚在暴衝就放開
function play(fish, opts = {}, strat = 'good') {
  const r = createReel(fish, { rng: mulberry(opts.seed || 1), ...opts });
  let t = 0;
  while (!r.result && t < 120) {
    let hold;
    if (strat === 'hold') hold = true;
    else if (strat === 'never') hold = false;
    else hold = r.tension < (r.show === 'calm' ? 74 : 42);
    r.step(DT, hold); t += DT;
  }
  return { r, t };
}

test('55 種魚、每區 11 種、傳奇各區一隻', () => {
  assert.equal(FISH.length, 55);
  for (let z = 1; z <= 5; z++) {
    const f = zoneFish(z);
    assert.equal(f.length, 11, `第 ${z} 區`);
    assert.equal(f.filter((x) => x.rarity === 'L').length, 1);
  }
  assert.deepEqual(LEGENDS.map((i) => FISH[i - 1].rarity), ['L', 'L', 'L', 'L', 'L']);
  for (const f of FISH) { assert.ok(f.times.length >= 1); assert.ok(f.best.every((t) => f.times.includes(t))); }
});

test('品質門檻與取得條件', () => {
  assert.equal(tierOfScore(44), 0); assert.equal(tierOfScore(45), 1); assert.equal(tierOfScore(65), 2);
  assert.equal(tierOfScore(82), 3); assert.equal(tierOfScore(95), 4);
  const rng = () => 0.5;
  // 王冠：正確時段＋完美提竿＋全程 < 80%
  assert.equal(judge({ base: 60, perfect: true, spotBonus: 15, timeBest: true, maxTension: 70, redEntries: 0, rng }).tier, 4);
  assert.equal(judge({ base: 60, perfect: true, spotBonus: 15, timeBest: false, maxTension: 70, redEntries: 0, rng }).tier, 3);
  // 沒完美提竿又進過 85% 以上 → 最多銀星；不在正確時段又沒完美 → 最多良質
  assert.equal(judge({ base: 60, perfect: false, spotBonus: 15, timeBest: true, maxTension: 90, redEntries: 1, rng }).tier, 2);
  assert.equal(judge({ base: 60, perfect: false, spotBonus: 15, timeBest: false, maxTension: 70, redEntries: 0, rng }).tier, 1);
  // 紅區少於 2 次至少良質
  assert.equal(judge({ base: 0, perfect: false, spotBonus: 0, timeBest: false, maxTension: 95, redEntries: 1, rng }).tier, 1);
  assert.equal(judge({ base: 0, perfect: false, spotBonus: 0, timeBest: false, maxTension: 99, redEntries: 4, rng }).tier, 0);
  // 體型倍率落在階級範圍內
  for (let t = 0; t < 5; t++) {
    const j = judge({ base: [0, 30, 45, 60, 60][t], perfect: t === 4, spotBonus: [0, 0, 0, 0, 15][t], timeBest: true, maxTension: t ? 50 : 95, redEntries: t ? 0 : 3, rng: mulberry(t) });
    assert.equal(j.tier, t);
    assert.ok(j.mult >= TIERS[t].size[0] && j.mult <= TIERS[t].size[1]);
  }
  assert.equal(potential({ base: 60, perfect: true, spotBonus: 15, timeBest: true }), 4);
});

test('收線：會玩的人釣得起每一種魚（大多數種子）', () => {
  const fails = [];
  for (const f of FISH) {
    let ok = 0;
    for (let seed = 1; seed <= 6; seed++) if (play(f, { seed, perfect: seed % 2 === 0, potentialTier: f.rarity === 'L' ? 3 : 1 }).r.result === 'caught') ok++;
    if (ok < 4) fails.push(`${f.no} ${f.en} ${ok}/6`);
  }
  assert.deepEqual(fails, []);
});

test('收線：一直按住會斷線、完全不收會脫鉤', () => {
  for (const id of [12, 21, 33, 44, 55]) {   // #01 銀鯛是新手魚，一直按也拉得上來
    assert.equal(play(FISH[id - 1], { seed: 3 }, 'hold').r.result, 'snap', `#${id} 一直按`);
    assert.equal(play(FISH[id - 1], { seed: 3 }, 'never').r.result, 'escape', `#${id} 不收`);
  }
});

test('收線：特技有發生（躍水、魚王大波、鎖死、下潛）', () => {
  const evs = (id) => { const r = createReel(FISH[id - 1], { rng: mulberry(9) }); const seen = new Set(); let t = 0; while (!r.result && t < 120) { r.step(DT, r.tension < (r.show === 'calm' ? 74 : 42)); r.events.forEach((e) => seen.add(e)); t += DT; } return seen; };
  assert.ok(evs(18).has('jump'));
  assert.ok(evs(11).has('wave'));
  assert.ok(evs(20).has('lock'));
  assert.ok(evs(52).has('dive'));
  assert.ok(evs(42).has('burst'));
  const s55 = evs(55); assert.ok(s55.has('wave') && (s55.has('dive') || s55.has('lock') || s55.has('jump')));
});

test('地圖：釣點、燈樁在水裡且屬於正確的區；巨石在急流區', () => {
  for (const s of SPOTS) {
    assert.ok(height(s.x, s.z) < -1.2, `${s.zh} 水深 ${-height(s.x, s.z)}`);
    assert.equal(zoneAt(s.x, s.z), s.zone, s.zh);
    for (const r of s.roam || []) assert.ok(height(r.x, r.z) < -1.2);
  }
  assert.equal(SPOTS.length, 15);
  assert.equal(SPOTS.filter((s) => s.kind === 'legend').length, 5);
  assert.equal(CHECKPOINTS.length, 6);
  for (const c of CHECKPOINTS) assert.ok(height(c.berth.x, c.berth.z) < -1, c.zh);
  assert.ok(BOULDERS.length > 10);
});

test('出魚：只出該區、該時段的魚，魚王只在 legend 釣點', () => {
  const rng = mulberry(5);
  for (const s of SPOTS) for (const t of ['am', 'pm', 'dusk']) for (let i = 0; i < 200; i++) {
    const f = pickFish(s, t, rng, 0);
    assert.equal(f.zone, s.zone); assert.ok(f.times.includes(t));
    if (f.rarity === 'L') assert.equal(s.kind, 'legend');
  }
  // 魚王抽得到（帶保底）
  const leg = SPOTS.find((s) => s.zone === 1 && s.kind === 'legend');
  let got = 0; for (let i = 0; i < 400; i++) if (pickFish(leg, 'dusk', rng, 10).rarity === 'L') got++;
  assert.ok(got > 20, `魚王 ${got}/400`);
});

test('主線與委託流程', () => {
  const s = fresh();
  const rng = mulberry(2);
  assert.equal(chapterReady(s), false);
  s.cps[1] = true;
  const bream = makeCatch(FISH[0], { tier: 1, mult: 1.05, flawless: false }, { time: 'am', perfect: false, day: 1 });
  recordCatch(s, bream); s.creel.push(bream);
  assert.equal(chapterReady(s), true);
  assert.equal(claimChapter(s), 'book');
  assert.equal(s.creel.length, 0); assert.equal(s.chapter, 1); assert.ok(s.upgrades.book);
  ensureBoard(s, rng);
  assert.equal(s.board.length, 3);
  assert.deepEqual(s.board.map((q) => q.kind).sort(), ['quality', 'size', 'time']);
  const qi = s.board.findIndex((q) => q.kind === 'size');
  const big = makeCatch(FISH[10], { tier: 0, mult: 0.9, flawless: false }, { time: 'dusk', perfect: false, day: 1 });
  s.creel.push(big);
  assert.equal(questHave(s, s.board[qi]), 1);
  const p0 = s.points;
  assert.ok(deliverQuest(s, qi, rng));
  assert.ok(s.points > p0); assert.equal(s.board.length, 3); assert.equal(s.creel.length, 0);
  // 第二章：下午 3 條銀星
  s.cps[2] = true;
  for (let i = 0; i < 3; i++) recordCatch(s, makeCatch(FISH[11], { tier: 2, mult: 1.2, flawless: true }, { time: 'pm', perfect: true, day: 1 }));
  assert.equal(chapterReady(s), true);
  assert.equal(claimChapter(s), 'line');
  assert.ok(matches({ minLen: 50 }, { len: 20, tier: 4 }));
});

test('存檔清理：壞資料不會讓遊戲壞掉', () => {
  assert.equal(sanitize(null).chapter, 0);
  const s = sanitize({ v: 1, cps: [false, true, 'x'], creel: [{ id: 99, tier: 0 }, { id: 3, tier: 2, len: 20 }, ...Array(20).fill({ id: 1, tier: 0 })], chapter: 99, paint: -3 });
  assert.equal(s.cps[0], true); assert.equal(s.cps[1], true);
  assert.equal(s.creel.length, CREEL_MAX); assert.equal(s.creel[0].id, 3);
  assert.equal(s.chapter, 5); assert.equal(s.paint, 0);
});

test('划船：往前划約 3 m/s，原地轉向，划不上岸', () => {
  const g = buildGrid(2);
  const world = { sample: g.sample, current, obstacles: BOULDERS };
  const b = createBoat(BERTH.x, BERTH.z, Math.PI);
  let strokes = 0;
  for (let i = 0; i < 12 * 60; i++) strokes += stepBoat(b, { fwd: 1 }, world, DT).filter((e) => e === 'stroke').length;
  assert.ok(b.speed > 2.2 && b.speed < 3.8, `速度 ${b.speed}`);
  assert.ok(strokes >= 8 && strokes <= 11, `槳數 ${strokes}`);
  // 一直往南划（往碼頭的岸）不會上岸
  b.yaw = 0;
  for (let i = 0; i < 40 * 60; i++) stepBoat(b, { fwd: 1 }, world, DT);
  assert.ok(g.sample(b.x, b.z) < -0.15, `船停在水深 ${-g.sample(b.x, b.z)}`);
  // 槳的公式：拉槳時槳葉壓得比回槳低，由船頭側掃到船尾側
  assert.ok(oarPose(0.2).lift < oarPose(0.7).lift);
  assert.ok(oarPose(0).sweep > 30 && oarPose(0.44).sweep < -15);
});
