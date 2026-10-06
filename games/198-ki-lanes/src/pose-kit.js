// 姿勢工具：所有動作共用的姿勢鍵、內插、出招時間軸（models.js 與 src/poses/<英雄>.js 共用）。
// 姿勢是一組角度（弧度）與位移：hips* 骨盆、torso* 上身（腰與胸分攤）、head* 頭（脖子分攤）、sh*／el* 肩肘、th*／kn* 髖膝、
// wr 手腕、an 腳踝（自動貼地之外再加）、cl 鎖骨前送、ho 手張開（0 拳～1 攤平）、hs 拇指張開、to 腳趾、spin 全身自轉、stretch 右臂伸長（魯夫）。
export const KEYS = ['hipsY', 'hipsZ', 'hipsRX', 'hipsRY', 'hipsRZ', 'torsoX', 'torsoY', 'torsoZ', 'headX', 'headY', 'headZ',
  'shLX', 'shLY', 'shLZ', 'elL', 'shRX', 'shRY', 'shRZ', 'elR', 'thLX', 'thLZ', 'knL', 'thRX', 'thRZ', 'knR', 'spin', 'stretch',
  'wrL', 'wrR', 'anL', 'anR', // 手腕前後彎、腳踝（在自動貼地之外再加的量）
  'clL', 'clR', 'hoL', 'hoR', 'hsL', 'hsR', 'toL', 'toR', // 鎖骨前送（自動之外再加）、手張開 0 拳～1 攤平、拇指 0 收～1 張、腳趾
  'prop']; // 武器（劍、天候棒）：1 拿在右手、−1 收在背後／腰間、0 依動作名的預設（models.js 的 SWORD_IN_HAND）
export function blank() { const p = {}; for (const k of KEYS) p[k] = 0; p.shLZ = 0.12; p.shRZ = 0.12; p.elL = -0.15; p.elR = -0.15; return p; }
export function lerpPose(a, b, k, out = {}) { for (const key of KEYS) out[key] = a[key] + (b[key] - a[key]) * k; return out; }
export const ease = (k) => k * k * (3 - 2 * k);
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const smooth01 = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
export const IMPACT = { atk1: 0.1, atk2: 0.12, atk3: 0.16, slash: 0.12, cast: 0.16, beam: 0.4, grab: 0.18, overhead: 0.3 };
// 出招：base 架式 → W 預備（ti×0.55）→ S 命中（ti）→ 順勢多送一點 → 收回（rec）
const _over = {};
export function strike(t, ti, base, W, S, rec = 0.36) {
  const a = ti * 0.55;
  if (t < a) return lerpPose(base, W, ease(t / a));
  if (t < ti) { const u = (t - a) / (ti - a); return lerpPose(W, S, u * u * (2 - u)); } // 出手越來越快
  // 命中後順勢多送一點（跟隨動作）再停住，然後收回架式
  for (const k of KEYS) _over[k] = S[k] + (S[k] - W[k]) * 0.12;
  if (t < ti + 0.08) return lerpPose(S, _over, Math.sin(Math.PI * 0.5 * clamp((t - ti) / 0.05, 0, 1)));
  return lerpPose(_over, base, ease(clamp((t - ti - 0.08) / Math.max(0.05, rec - ti - 0.08), 0, 1)));
}
