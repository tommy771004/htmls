// 不開瀏覽器，在 Node 直接跑 WASM core：四台 AI 同場，回報單圈時間、滯空、各地面時間比例、卡位與碰撞，用來調物理與 AI。
// 用法：node tools/sim.mjs [--tracks=0,1,2,3] [--laps=4] [--seed=7] [--skill=0.55,0.7,0.85,1] [--up=0] [--cap=400]
//       [--wasm=core/target/wasm32-unknown-unknown/release/sidewinder_core.wasm] [--assets=blender/out] [--all-ai] [--det] [--json]
// 預設第 0 台是「玩家」（is_ai = 0），由這裡的簡單循線機器人開，AI 才會對它卡位；--all-ai 改成四台都是 core 的 AI。
// --up：四台共用的升級等級 0..5（或逗號分隔四個值：輪胎,引擎,避震,氮氣）。--det：同 seed 再跑一次比對決定性。
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readTrack } from './check-assets.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (k, d) => {
  const a = args.find((x) => x.startsWith(`--${k}=`));
  return a ? a.slice(k.length + 3) : d;
};
const tracks = opt('tracks', '0,1,2,3').split(',').map(Number);
const laps = +opt('laps', 4);
const seed = +opt('seed', 7);
const skills = opt('skill', '0.55,0.7,0.85,1').split(',').map(Number);
const upA = opt('up', '0').split(',').map(Number);
const up = upA.length === 4 ? upA : [upA[0], upA[0], upA[0], upA[0]];
const CAP = +opt('cap', 400);
const allAi = args.includes('--all-ai');
const DT = 1 / 120;
const wasmPath = resolve(root, opt('wasm', 'core/target/wasm32-unknown-unknown/release/sidewinder_core.wasm'));
const assetDir = resolve(root, opt('assets', 'blender/out'));
const SURF = ['DIRT', 'LOOSE', 'MUD', 'WATER', 'JUMP', 'RAMP', 'WALL', 'INFIELD'];
const EV = { COUNT: 1, GO: 2, TAKEOFF: 3, LAND: 4, SPLASH: 5, MUD: 6, HIT: 7, WALL: 8, NITRO: 9, PICKUP: 10, LAP: 11, FINISH: 12, FINAL: 13, OVERTAKE: 14 };

if (!existsSync(wasmPath)) {
  console.error(`找不到 ${wasmPath}\n先執行：cd core && cargo build --release --target wasm32-unknown-unknown（或 npm run build）`);
  process.exit(1);
}

// 載入 core：不預期有 import，若有就補空函式並提醒
async function loadCore() {
  const mod = await WebAssembly.compile(readFileSync(wasmPath));
  const imports = {};
  const need = WebAssembly.Module.imports(mod);
  for (const im of need) {
    (imports[im.module] ??= {})[im.name] = im.kind === 'function' ? () => 0 : im.kind === 'memory' ? new WebAssembly.Memory({ initial: 32 }) : 0;
  }
  if (need.length) console.warn(`注意：core 有 import（已用空函式補上）：${need.map((i) => `${i.module}.${i.name}`).join(', ')}`);
  const inst = await WebAssembly.instantiate(mod, imports);
  const x = inst.exports;
  const missing = ['memory', 'sw_alloc', 'sw_load_track', 'sw_set_truck', 'sw_race_start', 'sw_set_input', 'sw_step', 'sw_state_ptr', 'sw_state_len', 'sw_events_ptr', 'sw_events_count', 'sw_events_clear', 'sw_upgrade_stat'].filter((k) => !(k in x));
  if (missing.length) throw new Error(`core 缺少 export：${missing.join(', ')}`);
  return {
    x,
    state: () => new Float32Array(x.memory.buffer, x.sw_state_ptr(), x.sw_state_len()), // 每次重建，記憶體可能成長
    events() {
      const n = x.sw_events_count();
      const out = n ? Array.from(new Float32Array(x.memory.buffer, x.sw_events_ptr(), n * 4)) : [];
      x.sw_events_clear();
      return out;
    },
    loadTrack(bytes) {
      const p = x.sw_alloc(bytes.length);
      new Uint8Array(x.memory.buffer, p, bytes.length).set(bytes);
      return x.sw_load_track(p, bytes.length);
    },
  };
}

// 玩家機器人：追 path 前方約 7 m 的點，彎急就收油；卡住時倒車一下
function makeBot(t) {
  const P = t.path;
  let near = 0, stuckT = 0, backT = 0, nitroCd = 4;
  return (s) => {
    const x = s[16], z = s[18], yaw = s[19], v = s[22];
    let best = Infinity;
    for (let d = -3; d <= 12; d++) {
      const i = (near + d + P.length) % P.length, q = P[i], dd = (q.x - x) ** 2 + (q.z - z) ** 2;
      if (dd < best) (best = dd), (near = i);
    }
    if (best > 100) for (let i = 0; i < P.length; i++) { const dd = (P[i].x - x) ** 2 + (P[i].z - z) ** 2; if (dd < best) (best = dd), (near = i); }
    let i = near, acc = 0;
    while (acc < 7) { const a = P[i], b = P[(i + 1) % P.length]; acc += Math.hypot(b.x - a.x, b.z - a.z); i = (i + 1) % P.length; }
    const tgt = P[i];
    let d = Math.atan2(tgt.z - z, tgt.x - x) - yaw;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    if (s[0] === 2 && Math.abs(v) < 1) stuckT += DT; else stuckT = 0;
    if (stuckT > 1.5) (backT = 0.9), (stuckT = 0);
    if (backT > 0) { backT -= DT; return [-Math.sign(d) || 1, 0, 1, 0]; }
    nitroCd -= DT;
    const fire = nitroCd <= 0 && Math.abs(d) < 0.12 && s[0] === 2 ? ((nitroCd = 6), 1) : 0;
    return [Math.max(-1, Math.min(1, d * 2.5)), Math.abs(d) > 0.9 && v > 9 ? 0.3 : 1, 0, fire];
  };
}

function race(core, id) {
  const bytes = readFileSync(resolve(assetDir, `track_${id}.bin`));
  const rc = core.loadTrack(bytes);
  if (rc !== 0) throw new Error(`sw_load_track(track_${id}) 回傳 ${rc}`);
  for (let k = 0; k < 4; k++) core.x.sw_set_truck(k, allAi || k ? 1 : 0, up[0], up[1], up[2], up[3], skills[k] ?? 0.8);
  const bot = allAi ? null : makeBot(readTrack(bytes));
  core.x.sw_race_start(seed, laps);
  core.events();

  const T = [0, 1, 2, 3].map(() => ({ lapAt: [], air: 0, surf: new Array(8).fill(0), block: 0, blockN: 0, stuck: 0, stuckN: 0, top: 0, hits: 0, walls: 0, jumps: 0, landMax: 0, nitro: 0, pickups: 0, cash: 0, overtakes: 0, mode: 0, spd: new Array(8).fill(0), up: [0, 0], down: [0, 0], nitroV: [0, 0] }));
  let s = core.state(), t = 0, nan = 0, goAt = null, steps = 0;
  const wall0 = performance.now();
  while (s[0] !== 3 && t < CAP + 3) {
    if (bot) core.x.sw_set_input(0, ...bot(s));
    core.x.sw_step(DT);
    t += DT;
    steps++;
    s = core.state();
    const racing = s[0] === 2;
    for (let k = 0; k < 4; k++) {
      const o = 16 + 32 * k, a = T[k];
      if (!Number.isFinite(s[o]) || !Number.isFinite(s[o + 2]) || !Number.isFinite(s[o + 6])) nan++;
      if (!racing || s[o + 20]) continue;
      if (s[o + 17]) a.air += DT;
      const sf = s[o + 16] | 0;
      if (sf >= 0 && sf < 8) (a.surf[sf] += DT), (a.spd[sf] += s[o + 6] * DT);
      // 坡道上坡／下坡的平均速度（依垂直速度正負），氮氣噴射中的平均速度
      if (!s[o + 17] && sf === 5) { const b = s[o + 27] > 0.15 ? a.up : s[o + 27] < -0.15 ? a.down : null; if (b) (b[0] += DT), (b[1] += s[o + 6] * DT); }
      if (s[o + 19] > 0) (a.nitroV[0] += DT), (a.nitroV[1] += s[o + 6] * DT);
      a.top = Math.max(a.top, s[o + 6]);
      const m = s[o + 29];
      if (m === 1) a.block += DT;
      if (m === 2) a.stuck += DT;
      if (m === 1 && a.mode !== 1) a.blockN++;
      if (m === 2 && a.mode !== 2) a.stuckN++;
      a.mode = m;
    }
    const ev = core.events();
    for (let i = 0; i < ev.length; i += 4) {
      const [ty, k, va, vb] = [ev[i], ev[i + 1] | 0, ev[i + 2], ev[i + 3]];
      const a = T[k];
      if (ty === EV.GO) goAt = s[1];
      if (!a) continue;
      if (ty === EV.LAP) a.lapAt.push(s[1]);
      else if (ty === EV.HIT) a.hits++;
      else if (ty === EV.WALL) a.walls++;
      else if (ty === EV.TAKEOFF) a.jumps++;
      else if (ty === EV.LAND) a.landMax = Math.max(a.landMax, va);
      else if (ty === EV.NITRO) a.nitro++;
      else if (ty === EV.PICKUP) (a.pickups++, (a.cash += va === 2 ? vb : 0));
      else if (ty === EV.OVERTAKE) a.overtakes++;
    }
  }
  const ms = performance.now() - wall0;
  const start = goAt ?? 0;
  const out = T.map((a, k) => {
    const o = 16 + 32 * k;
    const lapT = a.lapAt.map((v, i) => v - (i ? a.lapAt[i - 1] : start));
    const racing = a.surf.reduce((p, c) => p + c, 0) || 1;
    return {
      truck: k, skill: skills[k], pos: s[o + 15], finished: s[o + 20] === 1, finish: s[o + 21], laps: s[o + 13] + s[o + 14],
      best: s[o + 22], lapTimes: lapT.map((v) => +v.toFixed(2)), air: +a.air.toFixed(2), airPct: +((100 * a.air) / racing).toFixed(1),
      top: +(a.top * 3.6).toFixed(0), surf: Object.fromEntries(SURF.map((n, i) => [n, +((100 * a.surf[i]) / racing).toFixed(1)]).filter(([, v]) => v > 0)),
      block: +a.block.toFixed(1), blockN: a.blockN, stuck: +a.stuck.toFixed(1), stuckN: a.stuckN, hits: a.hits, walls: a.walls, jumps: a.jumps,
      landMax: +a.landMax.toFixed(2), nitro: a.nitro,
      avgV: Object.fromEntries(SURF.map((n, i) => [n, a.surf[i] > 0.3 ? +((3.6 * a.spd[i]) / a.surf[i]).toFixed(0) : null]).filter(([, v]) => v != null)),
      rampUp: a.up[0] > 0.2 ? +((3.6 * a.up[1]) / a.up[0]).toFixed(0) : null, rampDown: a.down[0] > 0.2 ? +((3.6 * a.down[1]) / a.down[0]).toFixed(0) : null,
      nitroAvg: a.nitroV[0] > 0.2 ? +((3.6 * a.nitroV[1]) / a.nitroV[0]).toFixed(0) : null, avgAll: +((3.6 * a.spd.reduce((p, c) => p + c, 0)) / racing).toFixed(0), pickups: a.pickups, cash: s[o + 24], overtakes: a.overtakes,
    };
  });
  return { id, name: null, phase: s[0], time: +s[1].toFixed(2), nan, steps, ms: +ms.toFixed(0), trucks: out, state: Array.from(s) };
}

const core = await loadCore();
const stats = ['輪胎抓地倍率', '引擎極速 m/s', '避震恢復秒數', '氮氣瓶數'].map((n, k) => `${n} ${[0, 1, 2, 3, 4, 5].map((l) => +core.x.sw_upgrade_stat(k, l).toFixed(2)).join('/')}`);
const reports = [];
let bad = 0;
for (const id of tracks) {
  const r = race(core, id);
  const nb = readFileSync(resolve(assetDir, `track_${id}.bin`)).subarray(64, 96);
  r.name = new TextDecoder().decode(nb.subarray(0, nb.indexOf(0) < 0 ? 32 : nb.indexOf(0)));
  if (args.includes('--det')) {
    const r2 = race(core, id);
    r.deterministic = r.state.every((v, i) => Object.is(v, r2.state[i]));
    if (!r.deterministic) bad++;
  }
  if (r.phase !== 3 || r.nan) bad++;
  reports.push(r);
}

if (args.includes('--json')) {
  console.log(JSON.stringify(reports.map(({ state, ...r }) => r), null, 1));
} else {
  console.log(`升級表（0..5 級）：\n  ${stats.join('\n  ')}\n`);
  console.log(`seed ${seed}、${laps} 圈、skill ${skills.join('/')}、升級 ${up.join('/')}${allAi ? '、四台 AI' : '、第 0 台為循線機器人玩家（skill 欄不適用）'}\n`);
  for (const r of reports) {
    const head = `賽道 ${r.id}「${r.name}」：${r.phase === 3 ? '完賽' : `未結束（phase ${r.phase}）`}，比賽時間 ${r.time} s，${r.steps} 步 ${r.ms} ms`;
    console.log(head + (r.nan ? `，NaN ${r.nan} 次` : '') + (r.deterministic === undefined ? '' : r.deterministic ? '，可重現' : '，**不可重現**'));
    console.log('  車 skill 名次 完賽    最佳   單圈                       滯空       極速  卡位 次 脫困 次 互撞 撞牆 起跳 氮氣 道具 超車');
    for (const t of r.trucks) {
      const f = (v, w) => String(v).padStart(w);
      console.log(
        `  ${t.truck}  ${f(t.skill, 4)}  P${t.pos}  ${t.finished ? f(t.finish.toFixed(1), 6) : f('—' + t.laps.toFixed(2), 6)} ${f(t.best.toFixed(2), 6)}  ${t.lapTimes.join(' ').padEnd(26)}` +
          `${f(t.air + 's', 6)}(${f(t.airPct, 4)}%) ${f(t.top, 4)}  ${f(t.block, 4)} ${f(t.blockN, 2)} ${f(t.stuck, 4)} ${f(t.stuckN, 2)} ${f(t.hits, 4)} ${f(t.walls, 4)} ${f(t.jumps, 4)} ${f(t.nitro, 4)} ${f(t.pickups, 4)} ${f(t.overtakes, 4)}`,
      );
    }
    const agg = {};
    for (const t of r.trucks) for (const [k, v] of Object.entries(t.surf)) agg[k] = (agg[k] ?? 0) + v / 4;
    for (const t of r.trucks) {
      console.log(`  車 ${t.truck} 平均 km/h：全程 ${t.avgAll}、${Object.entries(t.avgV).map(([k, v]) => `${k} ${v}`).join('、')}；坡道上 ${t.rampUp ?? '—'}／下 ${t.rampDown ?? '—'}；噴氮氣 ${t.nitroAvg ?? '—'}；撿到獎金 $${t.cash}`);
    }
    console.log(`  地面時間：${Object.entries(agg).map(([k, v]) => `${k} ${v.toFixed(1)}%`).join('、')}\n`);
  }
}
process.exit(bad ? 1 : 0);
