// 玩家控制器：input → intent；準心射線 → aimPoint（SPEC §6）
import * as THREE from 'three';
import { clamp, lerp } from './shared.js';

const SENS = 0.0022;
const _o = new THREE.Vector3(), _d = new THREE.Vector3(), _e = new THREE.Vector3(), _t = new THREE.Vector3(), _d2 = new THREE.Vector3();

export class PlayerController {
  constructor(ctx) { this.ctx = ctx; this.yaw = 0; this.pitch = -0.15; this.aimDist = 400; }
  // 新對局：解除測試用的準心鎖定
  reset() { const c = this.ctx; c.aimLock = null; c.aimLockPoint = null; c.aimLockY = null; this.aimDist = 400; this.aimNear = false; }
  // 暫停中：只處理暫停／地圖鍵
  idle() { const s = this.ctx.input.poll(); if (s.pause) this.ctx.hud?.togglePause(); if (s.map) this.ctx.hud?.toggleMap(); }
  fixedUpdate(dt) {
    const ctx = this.ctx, inp = ctx.input, p = ctx.player, I = p.intent, m = ctx.match;
    const s = inp.poll();
    if (s.map) ctx.hud?.toggleMap();
    if (s.pause) ctx.hud?.togglePause();
    inp.setTouchVisible(m.state === 'bus' || m.state === 'playing');
    const active = !ctx.paused && m.state !== 'menu' && !ctx.hud?.mapOpen;
    if (!active) { I.moveX = I.moveZ = 0; I.fire = false; I.jump = false; I.interact = false; I.slot = -1; I.buildPlace = false; I.deploy = false; I.reload = false; I.buildToggle = false; I.buildPiece = null; I.buildCycleMaterial = false; return; }
    const st = ctx.settings, cm = ctx.cam;
    // ADS 降低靈敏度（隨 ADS 進度混合；狙擊鏡更低）；觸控另有輕量瞄準輔助（準心靠近敵人時減速）
    let adsMul = lerp(1, cm.scoped || (p.inventory.current()?.defId === 'sniper') ? 0.34 : 0.62, cm.adsBlend || 0);
    if (inp.device === 'touch' && p.alive) adsMul *= this.assist(p);
    this.yaw -= s.lookX * SENS * st.sens * adsMul;
    this.pitch = clamp(this.pitch - s.lookY * SENS * st.sens * adsMul * (st.invertY ? -1 : 1), -1.45, 1.45);
    // 舊式後座力（combat 寫 actor.recoil）→ 交給鏡頭處理：上抬＋部分回復＋視覺拉後
    if (p.recoil) { cm.addRecoil(p.recoil, (Math.random() - 0.5) * p.recoil * 0.7); p.recoil = 0; }
    // 測試用：鎖定準心對準某個 actor（__sw.aimAt）
    // （ctx.aimLockY：瞄準的高度，預設 1.1 身體、1.62 頭；ctx.aimLockPoint：改瞄任意世界點）
    if (ctx.aimLockPoint) { const c = ctx.camera.position, q = ctx.aimLockPoint; this.yaw = Math.atan2(-(q.x - c.x), -(q.z - c.z)); this.pitch = Math.atan2(q.y - c.y, Math.hypot(q.x - c.x, q.z - c.z)); }
    else if (ctx.aimLock != null) { const t = ctx.actors[ctx.aimLock]; if (t && t.alive) { const c = ctx.camera.position, tx = t.pos.x, ty = t.pos.y + (ctx.aimLockY ?? 1.1), tz = t.pos.z; this.yaw = Math.atan2(-(tx - c.x), -(tz - c.z)); this.pitch = Math.atan2(ty - c.y, Math.hypot(tx - c.x, tz - c.z)); } }
    p.yaw = this.yaw; p.pitch = this.pitch;
    if (!p.alive) { I.fire = false; if (s.jump || s.wheel > 0) cm.cycleSpectate(1); else if (s.wheel < 0) cm.cycleSpectate(-1); return; }
    I.moveX = s.moveX; I.moveZ = s.moveZ;
    // 自動衝刺（預設開）：往前走就跑，瞄準／開槍／蹲下時由 actor 取消；Shift 仍可按住強制衝刺
    I.sprint = s.sprint || (st.autoSprint !== false && s.moveZ > 0.1 && !(s.fire && !p.building)); I.crouch = s.crouch; I.jump = s.jump; I.deploy = s.jump;
    I.yaw = this.yaw; I.pitch = this.pitch;
    I.fire = s.fire; I.ads = s.ads; I.interact = s.interact; I.buildPlace = s.fire;
    I.reload = s.reload && !p.building; I.buildCycleMaterial = s.reload && p.building;
    I.buildToggle = s.buildToggle; I.buildPiece = s.piece;
    // 欄位：數字鍵直接選；滾輪循環（建造中循環建材）
    I.slot = s.slot;
    if (s.wheel) {
      if (p.building) { const ps = ['wall', 'floor', 'ramp']; I.buildPiece = ps[(ps.indexOf(p.buildPiece) + (s.wheel > 0 ? 1 : 2)) % 3]; }
      else { const inv = p.inventory; let i = inv.selected; for (let n = 0; n < 6; n++) { i = (i + (s.wheel > 0 ? 1 : 5)) % 6; if (i === 0 || inv.slots[i - 1]) break; } I.slot = i; }
    }
    if (ctx.hud && ctx.hud.slotClick >= 0) { I.slot = ctx.hud.slotClick; ctx.hud.slotClick = -1; }
    this.computeAim(p, I);
  }
  // 觸控輔助：敵人在準心附近（約 4°）且在 60 m 內 → 視角移動減速
  assist(p) {
    const cam = this.ctx.camera; cam.getWorldDirection(_d);
    let k = 1;
    for (const a of this.ctx.actors) {
      if (a === p || !a.alive || a.state === 'bus') continue;
      _t.set(a.pos.x, a.pos.y + 1.1, a.pos.z).sub(cam.position);
      const d = _t.length(); if (d > 60 || d < 1) continue;
      const ang = Math.acos(clamp(_t.dot(_d) / d, -1, 1)), lim = 0.075 + 0.5 / d * 0.5;
      if (ang < lim) k = Math.min(k, 0.45 + 0.55 * (ang / lim));
    }
    return k;
  }
  // 準心射線：從鏡頭出發（鏡頭已避開牆）。若眼睛 → 準心點在極近處被擋住（鏡頭探過矮牆／角落），改瞄眼睛正前方
  computeAim(p, I) {
    const ctx = this.ctx, P = ctx.physics, cam = ctx.camera;
    cam.getWorldDirection(_d); _o.copy(cam.position);
    const wh = P.raycast(_o, _d, 400, {});
    let dist = wh ? wh.dist : 400;
    const ah = ctx.combat.rayActors(_o, _d, dist, p);
    if (ah) dist = ah.t;
    if (!I.aimPoint) I.aimPoint = new THREE.Vector3();
    I.aimPoint.copy(_o).addScaledVector(_d, dist);
    p.eyePos(_e);
    _t.copy(I.aimPoint).sub(_e); const el = _t.length();
    if (el > 0.01 && p.state !== 'skydive' && p.state !== 'glide') {
      _t.divideScalar(el);
      const behind = _t.dot(_d) < 0.3;
      const blk = behind ? null : P.raycast(_e, _t, el - 0.05, {});
      if (behind || (blk && blk.dist < 2.2 && blk.dist < el - 0.5)) {
        // 眼睛正前方打到的東西（或無限遠）
        const eh = P.raycast(_e, _d, 400, {});
        let d2 = eh ? eh.dist : 400;
        const ea = ctx.combat.rayActors(_e, _d, d2, p); if (ea) d2 = ea.t;
        dist = d2; I.aimPoint.copy(_e).addScaledVector(_d, d2);
        this.aimDist = d2; this.aimNear = true; return;
      }
    }
    this.aimNear = false; this.aimDist = dist;
  }
}
