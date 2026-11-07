// 載入與進度。素材在 ../assets/278/（相對 web/ 作品頁）。
export const ASSET_BASE = '../assets/278/';

const parts = new Map();
let onProgress = null;
export function setProgressHandler(fn) { onProgress = fn; }
export function track(name, weight = 1) { parts.set(name, { weight, done: 0 }); }
export function report(name, frac) {
  const p = parts.get(name); if (!p) return;
  p.done = Math.min(1, frac);
  let w = 0, d = 0; for (const v of parts.values()) { w += v.weight; d += v.weight * v.done; }
  onProgress?.(w ? d / w : 0, name);
}
export async function step(name, fn) {
  try { return await fn(); } finally { report(name, 1); }
}
