// 主選單舞台：借士兵池的一格站在鏡頭前，走和遊戲中 bot 相同的 updateSoldiers，FAST 快照與零配置都不用特別處理。
// 開賽時 bindSoldiers 會把整個池子停放。?clean=1 的校色、雷達、快照量測不開舞台。
import { makeAgent, WEAPONS } from './state.js';
import { pool, assign, park, play } from './soldiers.js';

const reduced = matchMedia('(prefers-reduced-motion: reduce)'), D = Math.PI / 180;
// 士兵站在日晷前，太陽從鏡頭這側打在正面。鏡頭依士兵位置算：az 方位角、d 距離、h 高度；f 是垂直視角（度）；
// mx／my 是士兵中心在畫面上的位置（-1～1），side 是分頁開著時士兵讓到旁邊的 mx。
const FOOT = { x: 1.6, y: 0, z: -6, face: 120 };
const SHOT = {
  wide: { az: 152, d: 6.6, h: 1.35, f: 23, mx: 0.05, my: 0.02, side: 0.6 },
  tall: { az: 152, d: 6.6, h: 1.35, f: 33, mx: 0, my: 0.3, side: 0 },
  short: { az: 152, d: 6.6, h: 1.25, f: 21, mx: 0.03, my: 0, side: 0.6 },
};

export const stage = { on: false, side: 'atk', cur: 'ks', soldier: null, cam: { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, fov: 1 } };
let base = SHOT.wide, agent = null, t = 0, mx = 0, away = false, px = 0, py = 0;

/** 依畫面比例選鏡位、換算水平視角。resize 時重算。 */
export function fitStage() {
  const a = innerWidth / innerHeight;
  base = a < 1 ? SHOT.tall : innerHeight <= 520 ? SHOT.short : SHOT.wide;
  stage.cam.fov = 2 * Math.atan(a * Math.tan(base.f * D / 2));
  mx = away ? base.side : base.mx;
}
function dress() {
  const s = pool[stage.side][0];
  if (stage.soldier && stage.soldier !== s) park(stage.soldier);
  stage.soldier = s; agent ??= makeAgent(-1, 0, '', true);
  agent.rx = FOOT.x; agent.ry = FOOT.y; agent.rz = FOOT.z; agent.yaw = FOOT.face * D; agent.cur = stage.cur;
  assign(s, agent); if (WEAPONS[stage.cur]?.slot === 2) play(s, 'idle_pistol');
}
export function startStage() { stage.on = true; fitStage(); dress(); frameStage(0); }
export function setStage(side, cur) { stage.side = side; stage.cur = cur; if (stage.on) dress(); }
export function stopStage() { if (stage.soldier) park(stage.soldier); stage.soldier = null; stage.on = false; }
/** 分頁開著時把士兵讓到一邊。 */
export function asideStage(on) { away = on; if (reduced.matches) mx = on ? base.side : base.mx; }
export function pointStage(nx, ny) { px = nx; py = ny; }
/** 除錯：__ol.tuneStage({ az, d, h, f, mx, my }, { x, z, face }) 現場調鏡位。 */
export function tuneStage(s, f) { Object.assign(base, s); Object.assign(FOOT, f); fitStage(); dress(); }

/** 每幀：鏡頭慢慢呼吸，游標帶一點視差，分頁切換時平移。不配置。回傳士兵動畫要用的 dt。 */
export function frameStage(dt) {
  const c = stage.cam, still = reduced.matches, a = innerWidth / innerHeight, tv = Math.tan(base.f * D / 2);
  if (!still) { t += dt; mx += ((away ? base.side : base.mx) - mx) * Math.min(1, dt * 6); }
  const az = (base.az + (still ? 0 : Math.sin(t * 0.17) * 0.5 + px * 1.6)) * D, h = base.h + (still ? 0 : Math.sin(t * 0.23) * 0.015 - py * 0.05);
  c.x = FOOT.x + Math.sin(az) * base.d; c.y = FOOT.y + h; c.z = FOOT.z + Math.cos(az) * base.d;
  c.yaw = az / D + 180 - Math.atan(mx * a * tv) / D;
  c.pitch = Math.atan2(FOOT.y + 0.95 - c.y, base.d) / D - Math.atan(base.my * tv) / D;
  return still ? 0 : dt;
}
