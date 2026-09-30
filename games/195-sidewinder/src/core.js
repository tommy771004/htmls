// Rust 核心（wasm32-unknown-unknown，無 wasm-bindgen）的 JS 包裝。ABI 見 SPEC §5。

export const SURF = Object.freeze({ DIRT: 0, LOOSE: 1, MUD: 2, WATER: 3, JUMP: 4, RAMP: 5, WALL: 6, INFIELD: 7 });
export const PHASE = Object.freeze({ IDLE: 0, COUNTDOWN: 1, RACE: 2, DONE: 3 });
export const EV = Object.freeze({
  COUNTDOWN: 1, GO: 2, TAKEOFF: 3, LAND: 4, SPLASH: 5, MUD: 6, TRUCK_HIT: 7, WALL_HIT: 8,
  NITRO: 9, PICKUP: 10, LAP: 11, FINISH: 12, FINAL_LAP: 13, OVERTAKE: 14,
});
// 事件 id → 音效掛點名稱（小寫蛇形）
export const EV_NAME = Object.freeze({
  1: 'countdown', 2: 'go', 3: 'takeoff', 4: 'land', 5: 'splash', 6: 'mud', 7: 'truck_hit', 8: 'wall_hit',
  9: 'nitro', 10: 'pickup', 11: 'lap', 12: 'finish', 13: 'final_lap', 14: 'overtake',
});
// 狀態陣列配置
export const LAYOUT = Object.freeze({ HEADER: 16, TRUCK0: 16, TRUCK_STRIDE: 32, TRUCKS: 4, PICKUP0: 144, PICKUP_STRIDE: 4, PICKUPS: 8, LEN: 176 });

// 從狀態陣列讀出一台卡車（純物件）
export function readTruck(s, k) {
  const o = LAYOUT.TRUCK0 + LAYOUT.TRUCK_STRIDE * k;
  return {
    x: s[o], y: s[o + 1], z: s[o + 2],
    yaw: s[o + 3], pitch: s[o + 4], roll: s[o + 5],
    speed: s[o + 6], steer: s[o + 7], wheelAngle: s[o + 8],
    susp: [s[o + 9], s[o + 10], s[o + 11], s[o + 12]],
    laps: s[o + 13], lapProgress: s[o + 14], place: s[o + 15],
    surface: s[o + 16], airborne: s[o + 17] > 0.5,
    nitro: s[o + 18], nitroTime: s[o + 19],
    finished: s[o + 20] > 0.5, finishTime: s[o + 21],
    bestLap: s[o + 22], lastLap: s[o + 23], money: s[o + 24],
    rpm: s[o + 25], slip: s[o + 26], vy: s[o + 27],
    isAi: s[o + 28] > 0.5, aiMode: s[o + 29], wet: s[o + 30], dnf: s[o + 31] > 0.5,
  };
}

export function readHeader(s) {
  return {
    phase: s[0], time: s[1], countdown: s[2], laps: s[3], trucks: s[4], pickups: s[5],
    playerPlace: s[6], trackId: s[7], leaderLap: s[8],
  };
}

export function readPickups(s) {
  const out = [];
  for (let k = 0; k < LAYOUT.PICKUPS; k++) {
    const o = LAYOUT.PICKUP0 + k * LAYOUT.PICKUP_STRIDE;
    out.push({ x: s[o], z: s[o + 1], type: s[o + 2], active: s[o + 3] > 0.5 });
  }
  return out;
}

export async function loadCore(wasmBytes) {
  const mod = await WebAssembly.compile(wasmBytes);
  // 依模組實際宣告的匯入補上空函式（正常情況沒有匯入）
  const imports = {};
  for (const imp of WebAssembly.Module.imports(mod)) {
    imports[imp.module] ||= {};
    if (imp.kind === 'function') imports[imp.module][imp.name] = () => 0;
    else if (imp.kind === 'memory') imports[imp.module][imp.name] = new WebAssembly.Memory({ initial: 17 });
  }
  const inst = await WebAssembly.instantiate(mod, imports);
  const x = inst.exports;
  const mem = () => x.memory.buffer;

  const state = () => new Float32Array(mem(), x.sw_state_ptr(), x.sw_state_len());

  return {
    exports: x,
    loadTrack(buf) {
      const bytes = new Uint8Array(buf);
      const ptr = x.sw_alloc(bytes.length);
      new Uint8Array(mem(), ptr, bytes.length).set(bytes); // alloc 之後才建立視圖
      return x.sw_load_track(ptr, bytes.length);
    },
    setTruck(i, isAi, tires, engine, shocks, nitro, skill) {
      x.sw_set_truck(i >>> 0, isAi ? 1 : 0, tires >>> 0, engine >>> 0, shocks >>> 0, nitro >>> 0, +skill || 0);
    },
    raceStart(seed, laps) { x.sw_race_start(seed >>> 0, laps >>> 0); },
    setInput(i, steer, throttle, brake, nitro) { x.sw_set_input(i >>> 0, +steer || 0, +throttle || 0, +brake || 0, nitro ? 1 : 0); },
    step(dt) { x.sw_step(dt); },
    state,
    header() { return readHeader(state()); },
    truck(k) { return readTruck(state(), k); },
    pickups() { return readPickups(state()); },
    events() {
      const n = x.sw_events_count();
      const out = [];
      if (n > 0) {
        const e = new Float32Array(mem(), x.sw_events_ptr(), n * 4);
        for (let k = 0; k < n; k++) {
          const type = e[k * 4];
          out.push({ type, name: EV_NAME[type] || 'unknown', truck: e[k * 4 + 1], a: e[k * 4 + 2], b: e[k * 4 + 3] });
        }
      }
      x.sw_events_clear();
      return out;
    },
    upgradeStat(kind, level) { return x.sw_upgrade_stat(kind >>> 0, level >>> 0); },
  };
}
