// 輸入設定：預設值、驗證、localStorage 'sw195-input'（存不了也照常運作）
import { SPINNER_DEFAULTS } from './spinner.js';

export const STORE_KEY = 'sw195-input';

export const INPUT_DEFAULTS = {
  spinnerMode: SPINNER_DEFAULTS.mode,          // 'rate' | 'position'
  spinnerSensitivity: SPINNER_DEFAULTS.sensitivity,
  spinnerInvert: false,
  spinnerNoLock: false,     // 不鎖游標：滑鼠在畫布上移動就當方向盤
  spinnerAutoLock: false,   // 比賽中點畫布自動 Pointer Lock（設定頁鎖定過一次就會打開，也可在設定頁切換）
  padDeadzone: 0.15,
  touch: 'auto',            // 'auto' | 'on' | 'off'（觸控按鈕顯示）
};

export function sanitize(obj, base = INPUT_DEFAULTS) {
  const o = { ...base };
  if (!obj || typeof obj !== 'object') return o;
  if (obj.spinnerMode === 'rate' || obj.spinnerMode === 'position') o.spinnerMode = obj.spinnerMode;
  const sens = +obj.spinnerSensitivity;
  if (Number.isFinite(sens)) o.spinnerSensitivity = Math.round(Math.max(20, Math.min(5000, sens)));
  if (typeof obj.spinnerInvert === 'boolean') o.spinnerInvert = obj.spinnerInvert;
  if (typeof obj.spinnerNoLock === 'boolean') o.spinnerNoLock = obj.spinnerNoLock;
  if (typeof obj.spinnerAutoLock === 'boolean') o.spinnerAutoLock = obj.spinnerAutoLock;
  const dz = +obj.padDeadzone;
  if (Number.isFinite(dz)) o.padDeadzone = Math.max(0, Math.min(0.6, dz));
  if (obj.touch === 'auto' || obj.touch === 'on' || obj.touch === 'off') o.touch = obj.touch;
  return o;
}

export function loadSettings() {
  try {
    const raw = globalThis.localStorage && globalThis.localStorage.getItem(STORE_KEY);
    if (raw) return sanitize(JSON.parse(raw));
  } catch { /* 私密模式等：用預設 */ }
  return { ...INPUT_DEFAULTS };
}

export function saveSettings(s) {
  try {
    if (globalThis.localStorage) globalThis.localStorage.setItem(STORE_KEY, JSON.stringify(s));
  } catch { /* 忽略 */ }
}
