// 旋轉方向盤（USB 旋轉編碼器當滑鼠）：把累積的 X 位移換成 steer。純邏輯，不碰 DOM。
// 速率模式：轉得越快轉向越大，停手就回 0（像街機方向盤甩車）。
// 位置模式：累積角度 / 滿舵計數，夾在 ±1，停手後慢慢回中。

export const SPINNER_DEFAULTS = {
  mode: 'rate',        // 'rate' | 'position'
  sensitivity: 400,    // 滿舵所需計數（位置模式）；速率模式以 sensitivity / rateTime 為滿舵角速度
  invert: false,
  rateTime: 0.25,      // 速率模式：在這麼多秒內轉完 sensitivity 計數 = 滿舵
  smooth: 0.06,        // 速率模式低通時間常數（秒）
  recenter: 0.7,       // 位置模式：停手後回中的時間常數（秒）
  idleBeforeCenter: 0.12,
};

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// settings 以 getter 讀入，外部改設定立即生效
export function createSpinnerFilter(getSettings) {
  const read = typeof getSettings === 'function' ? getSettings : () => getSettings || SPINNER_DEFAULTS;
  let pending = 0;   // 上次 poll 之後累積的計數
  let vel = 0;       // 濾波後的角速度（計數/秒）
  let acc = 0;       // 位置模式累積
  let idle = 0;      // 沒有輸入的秒數
  let out = 0;
  let lastMode = null;

  function opt(k) {
    const s = read();
    return s && s[k] !== undefined ? s[k] : SPINNER_DEFAULTS[k];
  }

  return {
    feed(dx) {
      if (!Number.isFinite(dx) || dx === 0) return;
      pending += dx;
    },
    // 每幀呼叫一次，回傳 steer（−1..1，已套用反向）
    poll(dt) {
      if (!(dt > 0)) return out;
      dt = Math.min(dt, 0.1);
      const mode = opt('mode') === 'position' ? 'position' : 'rate';
      if (mode !== lastMode) { vel = 0; acc = 0; lastMode = mode; }
      const sens = Math.max(10, +opt('sensitivity') || SPINNER_DEFAULTS.sensitivity);
      const dx = pending;
      pending = 0;
      idle = dx === 0 ? idle + dt : 0;
      let v;
      if (mode === 'rate') {
        const raw = dx / dt;
        // 事件叢集（滑鼠 125 Hz 對上 144 Hz 畫面）會出現單幀空白，用一般平滑；連續空白代表停手，快速收斂
        const tau = idle >= 0.02 ? 0.025 : Math.max(0.005, +opt('smooth') || 0.06);
        vel += (raw - vel) * (1 - Math.exp(-dt / tau));
        if (idle > 0.09) vel = 0;
        const full = sens / Math.max(0.05, +opt('rateTime') || 0.25);
        v = clamp(vel / full, -1, 1);
        if (Math.abs(v) < 0.004) v = 0;
      } else {
        acc = clamp(acc + dx, -sens, sens);
        if (idle > (+opt('idleBeforeCenter') || 0)) {
          acc *= Math.exp(-dt / Math.max(0.05, +opt('recenter') || 0.7));
          if (Math.abs(acc) < sens * 0.002) acc = 0;
        }
        v = clamp(acc / sens, -1, 1);
      }
      out = v === 0 ? 0 : opt('invert') ? -v : v;
      return out;
    },
    value: () => out,
    reset() { pending = 0; vel = 0; acc = 0; idle = 0; out = 0; },
  };
}
