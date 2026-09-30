// 一場比賽的控制：設定四台車、固定步長推進、玩家輸入／自動駕駛、名次差距、結算。
import { STEP, MAX_SUB, PHASE } from './consts.js';
import { header, trucks, truckAt, progressOf, normEvents } from './state.js';

const BUCKETS = 40; // 每圈切 40 格記錄抵達時間，用來算與領先者的秒差

export function createRace(core, tracks) {
  let cfg = null; // 目前這場的設定
  let acc = 0;
  let reach = []; // reach[k][bucket] = 抵達時間
  let first = []; // first[bucket] = 最早抵達時間（領先者）
  const pilot = createAutopilot();

  function start(opts) {
    const o = {
      trackId: 0, laps: 4, seed: 1, mode: 'practice', playerAI: false,
      player: { tires: 0, engine: 0, shocks: 0, nitro: 0 }, extraNitro: 0, rivals: [],
      ...opts,
    };
    o.trackId = ((o.trackId | 0) % tracks.raw.length + tracks.raw.length) % tracks.raw.length;
    core.events(); // 清掉上一場殘留的事件（race_start 會送出倒數 3 的嗶聲，不能在它之後清）
    const rc = core.loadTrack(tracks.raw[o.trackId]);
    if (rc < 0) throw new Error('賽道載入失敗（' + rc + '）');
    const p = o.player;
    const nitro = Math.min(5, (p.nitro | 0) + (o.extraNitro | 0));
    core.setTruck(0, o.playerAI, p.tires | 0, p.engine | 0, p.shocks | 0, nitro, o.playerAI ? 0.85 : 0);
    for (let i = 1; i < 4; i++) {
      const r = o.rivals[i - 1] || { skill: 0.5, up: { tires: 0, engine: 0, shocks: 0, nitro: 0 } };
      core.setTruck(i, 1, r.up.tires, r.up.engine, r.up.shocks, r.up.nitro, r.skill);
    }
    core.raceStart(o.seed >>> 0, o.laps | 0);
    cfg = o;
    acc = 0;
    reach = [[], [], [], []];
    first = [];
    pilot.reset(tracks.parsed[o.trackId]);
    return o;
  }

  function trackGaps(s) {
    const t = s[1];
    for (let k = 0; k < 4; k++) {
      const tk = truckAt(s, k);
      const b = Math.floor(progressOf(tk) * BUCKETS);
      if (b < 0) continue;
      if (reach[k][b] === undefined) reach[k][b] = t;
      if (first[b] === undefined || first[b] > t) first[b] = t;
    }
  }

  // 單一子步：inp = {steer,throttle,brake,nitro}；auto = 玩家改由自動駕駛
  function stepOnce(inp, auto) {
    if (!cfg) return;
    if (!cfg.playerAI) {
      const i = auto ? pilot.drive(core.state(), STEP) : inp;
      core.setInput(0, i.steer, i.throttle, i.brake, !!i.nitro);
    }
    core.step(STEP);
  }

  // 每幀：累積時間、最多 MAX_SUB 子步；回傳本幀事件
  function tick(dt, inp, auto) {
    if (!cfg) return [];
    acc += Math.min(0.25, Math.max(0, dt));
    let n = 0;
    while (acc >= STEP && n < MAX_SUB) {
      stepOnce(inp, auto);
      acc -= STEP;
      n++;
    }
    if (n >= MAX_SUB) acc = Math.min(acc, STEP); // 掉幀時放棄追趕，避免螺旋
    const s = core.state();
    trackGaps(s);
    return normEvents(core.events());
  }

  // 快轉：不渲染；玩家若非 AI 就交給自動駕駛。onEvents 收事件（UI 狀態同步）
  function fastForward(sec, onEvents) {
    if (!cfg) return;
    const n = Math.max(0, Math.round(sec / STEP));
    for (let i = 0; i < n; i++) {
      stepOnce(null, true);
      if ((i & 31) === 31) {
        const s = core.state();
        trackGaps(s);
        const ev = normEvents(core.events());
        if (ev.length && onEvents) onEvents(ev);
        if ((s[0] | 0) === PHASE.DONE) break;
      }
    }
    const ev = normEvents(core.events());
    if (ev.length && onEvents) onEvents(ev);
    trackGaps(core.state());
  }

  // 跑到結束（上限 sim 秒數），回傳是否真的跑完
  function runToEnd(onEvents, capSec = 900) {
    if (!cfg) return false;
    let t = 0;
    while (t < capSec) {
      fastForward(5, onEvents);
      t += 5;
      if ((core.state()[0] | 0) === PHASE.DONE) return true;
    }
    return false;
  }

  // 秒差：與領先者抵達同一格的時間差
  function gaps() {
    const s = core.state();
    const out = [0, 0, 0, 0];
    for (let k = 0; k < 4; k++) {
      const tk = truckAt(s, k);
      const b = Math.floor(progressOf(tk) * BUCKETS);
      const rk = reach[k][b];
      out[k] = rk !== undefined && first[b] !== undefined ? Math.max(0, rk - first[b]) : 0;
    }
    return out;
  }

  // 結算：依名次排序；未完賽者依 core 的名次（進度）
  function results() {
    const s = core.state();
    const h = header(s);
    const list = trucks(s).map((t) => ({ ...t, progress: progressOf(t) }));
    list.sort((a, b) => {
      if (a.finished !== b.finished) return a.finished ? -1 : 1;
      if (a.finished && b.finished && a.finishT !== b.finishT) return a.finishT - b.finishT;
      if (a.pos && b.pos && a.pos !== b.pos) return a.pos - b.pos;
      return b.progress - a.progress;
    });
    list.forEach((t, i) => { t.place = i + 1; });
    return { header: h, order: list, player: list.find((t) => t.k === 0) };
  }

  return {
    start, tick, fastForward, runToEnd, gaps, results,
    get config() { return cfg; },
    get active() { return !!cfg; },
    phase: () => (cfg ? core.state()[0] | 0 : PHASE.IDLE),
    stop() { cfg = null; },
  };
}

// 自動駕駛（玩家車）：沿 path 前瞻點，卡住時倒車。只給 finishRaceNow／快轉用。
function createAutopilot() {
  let path = null;
  let idx = 0;
  let stuck = 0;
  let reverse = 0;
  return {
    reset(track) {
      path = track && track.path && track.path.length > 2 ? track.path : null;
      idx = 0;
      stuck = 0;
      reverse = 0;
    },
    drive(s, dt) {
      const t = truckAt(s, 0);
      if (!path) return { steer: 0, throttle: 1, brake: 0, nitro: false };
      const n = path.length;
      // 在目前索引附近找最近點
      let best = idx;
      let bd = Infinity;
      for (let j = -6; j <= 20; j++) {
        const q = path[(idx + j + n) % n];
        const d = (q.x - t.x) ** 2 + (q.z - t.z) ** 2;
        if (d < bd) { bd = d; best = (idx + j + n) % n; }
      }
      if (bd > 400) {
        for (let j = 0; j < n; j++) {
          const q = path[j];
          const d = (q.x - t.x) ** 2 + (q.z - t.z) ** 2;
          if (d < bd) { bd = d; best = j; }
        }
      }
      idx = best;
      // 前瞻約 7 m
      let k = idx;
      let dist = 0;
      while (dist < 7) {
        const a = path[k];
        const b = path[(k + 1) % n];
        dist += Math.hypot(b.x - a.x, b.z - a.z) || 0.5;
        k = (k + 1) % n;
        if (k === idx) break;
      }
      const tg = path[k];
      let ang = Math.atan2(tg.z - t.z, tg.x - t.x) - t.yaw;
      while (ang > Math.PI) ang -= Math.PI * 2;
      while (ang < -Math.PI) ang += Math.PI * 2;
      const racing = (s[0] | 0) === PHASE.RACE;
      if (racing && Math.abs(t.speed) < 1.2) stuck += dt; else stuck = Math.max(0, stuck - dt * 2);
      if (stuck > 1.5) { reverse = 1.1; stuck = 0; }
      if (reverse > 0) {
        reverse -= dt;
        return { steer: -Math.sign(ang) || 1, throttle: 0, brake: 1, nitro: false };
      }
      const steer = Math.max(-1, Math.min(1, ang * 2.2));
      return { steer, throttle: 1 - Math.min(0.55, Math.abs(ang) * 0.45), brake: 0, nitro: false };
    },
  };
}

