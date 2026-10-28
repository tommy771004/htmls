// 一趟送報的狀態機：固定 1/60 秒一步，騎車 → 丟報 → 判定 → 記帳。畫面只讀這裡的狀態，不改它。
import { PAPER, STREET, BIKE, HAZ, ITEMS } from './config.js';
import { makeStreet } from './street.js';
import { makeBike, stepBike } from './bike.js';
import { launch, stepPaper } from './paper.js';
import { makeLedger, scorePaper, scorePass, scoreBump, scoreBundle, scoreJump, summary } from './score.js';
import { evalMissions, statsOf } from './missions.js';
import { makeHazards, stepHazards } from './hazards.js';

export const DT = 1 / 60;

/** opts：week.js 的一天（seed、length、subRatio、bins、dogs、cars、sprinklers…），沒給就是第一輪的預設街 */
export function makeGame(opts = {}) {
  const street = makeStreet(opts);
  const g = {
    day: opts, street, haz: makeHazards(street, opts), wet: false, missions: opts.missions || [], taken: new Set(), hit: new Set(),
    stats: { escapes: 0, bites: 0, wets: 0 }, mstate: [],
    bike: makeBike(1.7, -2), papers: [], landed: [], ledger: makeLedger(street),
    stock: PAPER.stock, cool: 0, t: 0, mode: 'ride', events: [], throws: 0,
  };
  g.mstate = evalMissions(g.missions, statsOf(summary(g.ledger), g));
  return g;
}

/** 丟報的方向：按著轉向就往那邊丟，沒按就往腳踏車所在的那一側丟（在路中線右邊就往右） */
export function throwSide(g, steer) {
  if (steer) return Math.sign(steer);
  return g.bike.x >= 0 ? 1 : -1;
}

/** 一步。inp = { steer, accel, throw }（throw 是這一步剛按下）。這一步產生的事件放在 g.events */
export function step(g, inp) {
  g.events = [];
  if (g.mode !== 'ride') return g;
  g.t += DT;
  const b = g.bike;
  const hz = stepHazards(g.haz, b, DT, g.t);
  const z0 = b.z;
  // 在空中只會撞到來車（地上的垃圾桶、信箱柱都飛過去）
  const obs = b.air ? hz.obstacles : hz.obstacles.length ? g.street.obstacles.concat(hz.obstacles) : g.street.obstacles;
  const hit = stepBike(b, inp, DT, obs);
  stepItems(g, z0);
  // 同一個障礙物（同一台車）一趟只扣一次分：頂著停下來的車不會一直扣
  if (hit) {
    const key = hit.kind === 'carMove' ? 'car' + hit.car : hit;
    const first = !g.hit.has(key); g.hit.add(key);
    g.events.push({ type: 'bump', what: hit.kind, lines: first ? scoreBump(g.ledger, hit) : [] });
  }
  for (const e of hz.events) {
    if (e.type === 'bite') { b.v *= 0.6; b.bumpT = 0.6; g.stats.bites++; g.events.push({ ...e, type: 'bump', what: 'dog', lines: scoreBump(g.ledger, { kind: 'dog' }) }); }
    else { if (e.type === 'giveup') g.stats.escapes++; if (e.type === 'splash') g.stats.wets++; g.events.push(e); }
  }
  // 灑水器的水柱：速度一路掉，最低到巡航的 55%
  g.wet = hz.wet;
  if (hz.wet) b.v = Math.max(Math.min(b.v, BIKE.cruise * 0.55), b.v - HAZ.sprDrag * DT);
  g.cool = Math.max(0, g.cool - DT);
  if (inp.throw && g.cool === 0 && g.stock > 0) {
    const p = launch(b, throwSide(g, inp.steer));
    g.papers.push(p); g.stock--; g.cool = PAPER.cooldown; g.throws++;
    g.events.push({ type: 'throw', side: p.side });
  }
  for (const p of g.papers) {
    const ev = stepPaper(p, DT, g.street);
    if (!ev) continue;
    ev.lines = scorePaper(g.ledger, g.street, ev);
    g.events.push({ ...ev, type: 'land', hit: ev.type });
    g.landed.push({ x: p.x, y: p.y, z: p.z, side: p.side, hit: ev.type, t: g.t });
  }
  g.papers = g.papers.filter((p) => p.alive);
  if (g.landed.length > 40) g.landed.splice(0, g.landed.length - 40);
  for (const line of scorePass(g.ledger, g.street, b.z)) g.events.push({ type: 'missed', lot: line.lot, lines: [line] });
  const done = b.z <= g.street.finishZ;
  if (done) scorePass(g.ledger, g.street, -1e9);
  // 任務：狀態有變（完成或失敗）就發事件
  const ms = evalMissions(g.missions, statsOf(summary(g.ledger), g), done);
  ms.forEach((m, i) => { if (g.mstate[i] && g.mstate[i].state !== m.state && !done) g.events.push({ type: 'mission', m }); });
  g.mstate = ms;
  if (done) {
    g.mode = 'done';
    g.events.push({ type: 'done', summary: summary(g.ledger), missions: ms });
  }
  return g;
}

/** 補給包與跳台。z0：這一步之前的 z */
function stepItems(g, z0) {
  const b = g.bike, I = ITEMS;
  for (const it of g.street.bundles) {
    if (g.taken.has(it.id) || b.air || Math.hypot(b.x - it.x, b.z - it.z) > I.bundleR) continue;
    g.taken.add(it.id);
    const add = Math.min(I.bundleAdd, I.stockMax - g.stock); g.stock += add;
    g.events.push({ type: 'bundle', x: it.x, z: it.z, add, lines: scoreBundle(g.ledger) });
  }
  if (b.air) {
    b.vy -= I.gravity * DT; b.y += b.vy * DT;
    if (b.y <= 0) { b.y = 0; b.vy = 0; b.air = false; g.events.push({ type: 'touchdown' }); }
    return;
  }
  b.y = 0;
  for (const r of g.street.ramps) {
    if (Math.abs(b.x - r.x) > I.rampW / 2) continue;
    const top = r.z - I.rampL / 2, low = r.z + I.rampL / 2;
    if (b.z < low && b.z > top) b.y = I.rampH * (low - b.z) / I.rampL;     // 在斜面上
    if (z0 > top && b.z <= top) {                                           // 騎過最高的那一端 → 起飛
      b.air = true; b.y = I.rampH; b.vy = I.jumpUp + b.v * I.jumpK;
      g.events.push({ type: 'jump', x: b.x, z: b.z, lines: scoreJump(g.ledger) });
    }
  }
}

/** 前方接下來的訂戶（還沒送、還沒漏），最近的在前 */
export function upcoming(g, n = 2) {
  const L = g.ledger;
  return g.street.lots.filter((l) => l.sub && !L.delivered.has(l.id) && !L.missed.has(l.id) && l.mailbox.z < g.bike.z + 1)
    .sort((a, b) => b.mailbox.z - a.mailbox.z).slice(0, n);
}

export { summary, STREET };
