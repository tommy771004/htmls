// 讀 core 狀態陣列：只依 SPEC 位移，回傳純物件給 UI、測試 API。
import { H, T, TRUCK0, TSTRIDE, PICK0 } from './consts.js';

export function header(s) {
  return {
    phase: s[H.PHASE] | 0,
    time: s[H.TIME],
    countdown: s[H.COUNT],
    laps: s[H.LAPS] | 0,
    playerPos: s[H.PLAYER_POS] | 0,
    trackId: s[H.TRACK] | 0,
    leaderLaps: s[H.LEADER_LAPS] | 0,
    lapStart: s[H.PLAYER_LAP_START], // 玩家本圈起算時間；上線前 -1
  };
}

export function truckAt(s, k) {
  const o = TRUCK0 + TSTRIDE * k;
  return {
    k,
    x: s[o + T.X], y: s[o + T.Y], z: s[o + T.Z], yaw: s[o + T.YAW],
    pitch: s[o + T.PITCH], roll: s[o + T.ROLL],
    speed: s[o + T.SPEED],
    steer: s[o + T.STEER],
    laps: s[o + T.LAPS] | 0,
    lapProg: s[o + T.LAP_PROG],
    pos: s[o + T.POS] | 0,
    surface: s[o + T.SURF] | 0,
    air: s[o + T.AIR] > 0.5,
    nitroCans: Math.round(s[o + T.NITRO_CANS]),
    nitroT: s[o + T.NITRO_T],
    // 時限到被 core 收尾的車（格 31）不算完賽
    finished: s[o + T.FINISHED] > 0.5 && !(s[o + T.DNF] > 0.5),
    dnf: s[o + T.DNF] > 0.5,
    finishT: s[o + T.FINISH_T],
    bestLap: s[o + T.BEST_LAP],
    lastLap: s[o + T.LAST_LAP],
    cash: Math.round(s[o + T.CASH]),
    rpm: s[o + T.RPM],
    slip: s[o + T.SLIP],
    vy: s[o + T.VY],
    isAi: s[o + T.IS_AI] > 0.5,
    aiMode: s[o + T.AI_MODE] | 0,
    mud: s[o + T.MUD],
  };
}

export function trucks(s) {
  return [0, 1, 2, 3].map((k) => truckAt(s, k));
}

export function pickups(s) {
  const out = [];
  for (let i = 0; i < 8; i++) {
    const o = PICK0 + i * 4;
    out.push({ x: s[o], z: s[o + 1], type: s[o + 2] | 0, active: s[o + 3] > 0.5 });
  }
  return out;
}

// 圈數＋本圈進度（排名用的連續進度）
export function progressOf(t) {
  return t.laps + Math.min(0.9999, Math.max(0, t.lapProg));
}

// 事件：core.events() 可能回傳 {type,truck,a,b} 陣列或扁平 Float32Array，統一成物件
export function normEvents(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  const out = [];
  for (let i = 0; i + 3 < raw.length; i += 4) {
    out.push({ type: raw[i] | 0, truck: raw[i + 1] | 0, a: raw[i + 2], b: raw[i + 3] });
  }
  return out;
}
