// 第一人稱玩家：輸入 → mover，64 Hz tick，渲染時內插。
import { input } from '../core/input.js';
import { step, canStand, STAND_H, CROUCH_H } from './mover.js';

export const RUN = 5.4, WALK = 2.9, CROUCH_SPD = 1.9, EYE = 1.70, CROUCH_EYE = 1.15;
export const you = { x: 0, y: 2, z: -44, vx: 0, vy: 0, vz: 0, px: 0, py: 2, pz: -44, yaw: 0, pitch: 0, h: STAND_H, eye: EYE, ground: true, crouch: false, fell: false, frozen: false, speedK: 1, sensK: 1, recoilP: 0, recoilY: 0 };

export function teleport(x, y, z, yaw = 0, pitch = 0) { you.x = you.px = x; you.y = you.py = y; you.z = you.pz = z; you.yaw = yaw; you.pitch = pitch; you.vx = you.vy = you.vz = 0; you.ground = true; }

/** 每個畫面幀消耗滑鼠位移。視角跟顯示幀走、移動跟 64 Hz tick 走：
 *  轉向若只在 tick 套用，120 Hz 螢幕約一半的幀視角不動，60 Hz 偶爾一幀跳兩格，橫移會一頓一頓。 */
export function look(on) {
  const p = you;
  if (on) {
    const sens = input.sens * p.sensK;
    p.yaw += input.dx * sens; p.pitch -= (input.invertY ? -input.dy : input.dy) * sens;
    p.pitch = Math.max(-1.5, Math.min(1.5, p.pitch));
  }
  input.dx = input.dy = 0;   // 死亡、暫停時丟掉，復活或繼續時才不會整個甩過去
}

export function tickPlayer(dt) {
  const p = you;
  p.px = p.x; p.py = p.y; p.pz = p.z;
  const want = input.crouch && !p.frozen;
  if (want) p.crouch = true; else if (p.crouch && canStand(p)) p.crouch = false;
  const hT = p.crouch ? CROUCH_H : STAND_H, eT = p.crouch ? CROUCH_EYE : EYE, r = Math.min(1, dt * 12);
  p.h += (hT - p.h) * r; p.eye += (eT - p.eye) * r;
  const sn = Math.sin(p.yaw), cs = Math.cos(p.yaw), f = p.frozen ? 0 : input.fwd, s = p.frozen ? 0 : input.side;
  const wx = sn * f + cs * s, wz = cs * f - sn * s;
  const speed = (p.crouch ? CROUCH_SPD : input.walk ? WALK : RUN) * p.speedK;
  step(p, wx, wz, speed, (input.jump || input.jumpPress) && !p.frozen && !p.crouch, dt);
  input.jumpPress = false;
}

export function applyCamera(cam, alpha, kickP = 0, kickY = 0) {
  const p = you, x = p.px + (p.x - p.px) * alpha, y = p.py + (p.y - p.py) * alpha, z = p.pz + (p.z - p.pz) * alpha;
  cam.position.copyFromFloats(x, y + p.eye, z);
  cam.rotation.copyFromFloats(-(p.pitch + kickP), p.yaw + kickY, 0);
}
