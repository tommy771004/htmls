// 本機保存：設定、Free Ride 進度、Time Attack 最佳成績與幽靈車、離線排行榜。localStorage 可能不能用，全部包 try。
const KEY = 'rsa200:';

function get(k, fallback) {
  try { const v = localStorage.getItem(KEY + k); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
}
function set(k, v) {
  try { localStorage.setItem(KEY + k, JSON.stringify(v)); return true; } catch { return false; }
}

export const DEFAULTS = { name: '', quality: 'auto', volume: 0.7, units: 'mph', paint: 'pearl', cam: 'chase' };

export const store = {
  settings() { return { ...DEFAULTS, ...get('settings', {}) }; },
  saveSettings(s) { set('settings', s); },
  progress() { return get('free', { done: {}, best: 0 }); },
  saveProgress(p) { set('free', p); },
  // 幽靈車：Float32 → base64（每格 7 個數：位置＋四元數）
  best(track) {
    const b = get('ta:' + track, null);
    if (!b) return null;
    try {
      const bin = atob(b.ghost || '');
      const buf = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
      return { ...b, ghost: new Float32Array(buf.buffer) };
    } catch { return { ...b, ghost: null }; }
  },
  saveBest(track, time, splits, ghost) {
    const bytes = new Uint8Array(new Float32Array(ghost).buffer);
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return set('ta:' + track, { time, splits, ghost: btoa(s), at: Date.now() });
  },
  // 離線時的排行榜：本機每次完賽都記一筆
  runs() { return get('runs', []); },
  addRun(r) { const a = get('runs', []); a.push(r); a.sort((x, y) => x.time - y.time); set('runs', a.slice(0, 50)); },
};
