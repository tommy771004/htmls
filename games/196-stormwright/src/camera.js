// 第三人稱鏡頭：右肩跟隨、剛性視角（無旋轉延遲）、球形碰撞拉近、ADS／狙擊鏡、跳傘／滑翔／飛艇、觀戰與勝利環繞。
// 公開 API：update(dt)、addRecoil(pitch, yaw)、shake(intensity, dur)、follow(actor|null)、cycleSpectate(dir)、orbit(actor|null, radius)
import * as THREE from 'three';
import { damp, clamp, lerp, angleDiff } from './shared.js';
import { CAMERA as C } from './config.js';

const _q = new THREE.Quaternion(), _qb = new THREE.Quaternion(), _e = new THREE.Euler(0, 0, 0, 'YXZ');
const _off = new THREE.Vector3(), _dir = new THREE.Vector3(), _want = new THREE.Vector3(), _S = new THREE.Vector3(), _o = new THREE.Vector3();
const _rt = new THREE.Vector3(), _up = new THREE.Vector3(), _vp = new THREE.Vector3();
const SOLID = { solidOnly: true };
const smooth = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };

export class ThirdPersonCamera {
  constructor(ctx) {
    this.ctx = ctx; this.pivot = new THREE.Vector3(0, 30, 0);
    this.dist = C.dist; this.shoulder = C.shoulder; this.fov = C.fov; this.height = C.height; this.clear = 99;
    this.t = 0; this.init = false;
    this.target = null; this.followTarget = null; this.orbitTarget = null; this.orbitYaw = 0; this.orbitRadius = 5;
    this.adsT = 0; this.sprintBlend = 0; this.hid = false; this.busOff = 0;
    this.rcP = 0; this.rcY = 0; this.kickBack = 0; this.kickFov = 0;
    this.shk = { amp: 0, dur: 0.3, t: 0 }; this.dipY = 0; this.dipV = 0; this.roll = 0;
    this._lastYaw = null; this._lastPitch = null;
    const ev = ctx.events;
    ev.on('land', (e) => { if (e.actor === this.focus()) { const s = e.speed || 8; this.dipV = -clamp(s * 0.45, 2, 9); if (s > 12) this.shake(clamp((s - 10) / 25, 0.05, 0.5), 0.3); } });
    ev.on('mantle', (e) => { if (e.actor === this.focus()) this.dipV = -2.2; });
    ev.on('damage', (e) => { if (e.target === ctx.player && e.healthDamage + e.shieldDamage > 0) this.shake(clamp(0.1 + e.amount / 80, 0.1, 0.5), 0.28); });
    ev.on('glide', (e) => { if (e.actor === ctx.player) { this.shake(0.3, 0.45); this.kickFov = 7; } });
    ev.on('jump', (e) => { if (e.actor === ctx.player && ctx.player.state === 'skydive') { this.shake(0.25, 0.4); this.kickFov = 6; } });
    ev.on('eliminated', (e) => { if (e.victim === ctx.player) this.shake(0.5, 0.5); });
  }
  // 新對局：清掉環繞、觀戰、後座力與震動
  reset() {
    this.orbitTarget = null; this.followTarget = null; this.target = null; this.spectate = null; this.init = false;
    this.rcP = this.rcY = 0; this.kickBack = this.kickFov = 0; this.shk.amp = 0; this.dipY = this.dipV = 0; this.roll = 0; this.adsT = 0;
    this._lastYaw = null; this.busOff = 0; this.clear = 99; this.hid = false; this.fp = 0; this.fpOn = false; if (this._fpActor) { this._fpActor.view?.setVisible?.(true); this._fpActor = null; }
  }
  focus() { return this.target || this.ctx.player; }
  // ---- 公開 API ----
  // 後座力：視角上抬（會影響瞄準），其中一部分隨後自動回復；另有純視覺的拉後與 FOV 震動
  addRecoil(pitch = 0, yaw = 0) {
    const pc = this.ctx.playerCtl; if (!pc) return;
    pc.pitch = clamp(pc.pitch + pitch, -1.45, 1.45); pc.yaw += yaw;
    this.rcP += pitch * 0.62; this.rcY += yaw * 0.5;
    this.kickBack = Math.min(0.2, this.kickBack + 0.02 + Math.abs(pitch) * 2.4);
    this.kickFov = Math.min(3, this.kickFov + 0.25 + Math.abs(pitch) * 18);
  }
  // 震動（只位移與滾轉，不改變瞄準方向）
  shake(intensity = 0.3, dur = 0.3) {
    const s = this.shk, cur = s.amp * Math.max(0, 1 - s.t / s.dur);
    if (intensity >= cur) { s.amp = Math.min(1, intensity); s.dur = Math.max(0.05, dur); s.t = 0; }
    else s.amp = Math.min(1, cur + intensity * 0.3);
  }
  follow(actor) {
    this.followTarget = actor || null; this.spectate = this.followTarget;
    if (actor) { const pc = this.ctx.playerCtl; pc.yaw = actor.yaw; pc.pitch = -0.18; this.init = false; }
  }
  cycleSpectate(dir = 1) {
    const c = this.ctx, list = c.actors.filter((a) => a.alive && a !== c.player);
    if (!list.length) return null;
    const i = list.indexOf(this.followTarget), n = list[(i < 0 ? (dir > 0 ? 0 : list.length - 1) : (i + dir + list.length) % list.length)];
    this.follow(n); if (c.match) { c.match.spectateTarget = n; c.match.spectateLock = 2; } return n;
  }
  orbit(actor, radius = 5) {
    if (!actor) { this.orbitTarget = null; return; }
    this.orbitTarget = actor; this.orbitRadius = radius; this.orbitYaw = actor.yaw + Math.PI * 0.75; this.init = false;
  }
  focusActor() {
    const c = this.ctx, p = c.player;
    if (this.orbitTarget) return this.orbitTarget;
    if (p.alive) return p;
    const st = c.match && c.match.spectateTarget;
    if (st && st.alive && st !== this.followTarget) this.follow(st);
    if (this.followTarget && this.followTarget.alive) return this.followTarget;
    const k = p.lastDamagedBy && p.lastDamagedBy.alive && p.lastDamagedBy !== p ? p.lastDamagedBy : c.actors.find((a) => a.alive && a !== p);
    this.follow(k || p); return this.followTarget || p;
  }
  // ---- 每幀 ----
  update(dt) {
    const c = this.ctx, cam = c.camera, m = c.match, pc = c.playerCtl, P = c.physics, st = c.settings || {};
    this.t += dt;
    if (m.state === 'menu') {
      const a = this.t * 0.07;
      cam.position.set(Math.cos(a) * 300, 95, Math.sin(a) * 300); cam.lookAt(0, 8, 0);
      if (Math.abs(cam.fov - 60) > 0.01) { cam.fov = 60; cam.updateProjectionMatrix(); }
      this.init = false; this.setHidden(false); if (this._fpActor) { this._fpActor.view?.setVisible?.(true); this._fpActor = null; } this.fp = 0; this.fpOn = false; this.orbitTarget = null; this.followTarget = null; this.rcP = this.rcY = 0; return;
    }
    const f = this.focusActor(); this.target = f === c.player ? null : f;
    const isMe = f === c.player, base = st.fov || C.fov, fk = base / C.fov;
    const sky = f.state === 'skydive', glide = f.state === 'glide', bus = m.state === 'bus' && f.state === 'bus';
    const orb = !!this.orbitTarget || (m.state === 'ended' && c.player.alive);
    let yaw = pc.yaw, pitch = pc.pitch;

    // 後座力自動回復
    if (this.rcP || this.rcY) {
      const k = 1 - Math.exp(-7 * dt), dp = this.rcP * k, dy = this.rcY * k;
      if (isMe && c.player.alive) { pc.pitch = clamp(pc.pitch - dp, -1.45, 1.45); pc.yaw -= dy; yaw = pc.yaw; pitch = pc.pitch; }
      this.rcP -= dp; this.rcY -= dy; if (Math.abs(this.rcP) < 1e-5) this.rcP = 0; if (Math.abs(this.rcY) < 1e-5) this.rcY = 0;
    }
    // 觀戰：沒動滑鼠時，視角慢慢轉到目標面向
    if (!isMe && !orb && !bus) {
      if (this._lastYaw !== null && pc.yaw === this._lastYaw && pc.pitch === this._lastPitch) {
        pc.yaw += angleDiff(pc.yaw, f.yaw) * (1 - Math.exp(-2 * dt)); pc.pitch = damp(pc.pitch, -0.16, 2, dt);
      }
      this._lastYaw = pc.yaw; this._lastPitch = pc.pitch; yaw = pc.yaw; pitch = pc.pitch;
    } else this._lastYaw = null;

    // ---- 目標參數 ----
    let fovT = base, distT = C.dist, shT = C.shoulder, ph = C.height;
    const hs = Math.hypot(f.vel.x, f.vel.z);
    this.sprintBlend = damp(this.sprintBlend, f.sprinting && hs > 4 && f.grounded ? 1 : 0, 6, dt);
    fovT += C.sprintFov * fk * this.sprintBlend;
    let adsWant = 0, scope = false;
    if (bus) { distT = C.busDist; shT = 0; fovT = C.busFov * fk; ph = 5.5; }
    else if (sky) {
      const dive = clamp(-pitch / 1.1, 0, 1);
      distT = C.skyDist + dive * 1.5; shT = 0.3; ph = C.skyHeight; fovT = lerp(C.skyFov, C.diveFov, dive) * fk;
    } else if (glide) { distT = C.glideDist; shT = 0.45; ph = C.glideHeight; fovT = C.glideFov * fk; }
    else {
      if (f.crouching) ph = C.crouchHeight + 0.15;
      const it = f.inventory.current();
      if (isMe && f.alive && f.intent.ads && (f.state === 'ground' || f.state === 'air') && it && it.kind === 'weapon') { adsWant = 1; scope = it.defId === 'sniper'; }
    }
    if (orb) { const o = this.orbitTarget || c.player; this.orbitYaw += dt * 0.45; yaw = this.orbitYaw; pitch = -0.1; distT = this.orbitTarget ? this.orbitRadius : 5; shT = 0; ph = 1.8; /* 抬高注視點，角色落在結算標題與數據格之間 */ fovT = 62; adsWant = 0; scope = false; void o; }
    // ADS 進出：線性計時 + smoothstep（≈0.15 s）
    this.adsT = clamp(this.adsT + (adsWant ? 1 : -1) * dt / C.adsTime, 0, 1);
    const a = smooth(this.adsT);

    // 飛艇：鏡頭繞到艇頭 3/4 側前方（看得到氣囊與吊籃，不是艉部）；離艇後轉回
    if (!this.init && bus) this.busOff = Math.PI - 0.78;
    this.busOff = damp(this.busOff, bus ? Math.PI - 0.78 : 0, bus ? 6 : 2.5, dt);
    if (this.busOff > 0.001) { yaw += this.busOff; pitch = clamp(pitch + 0.12 * clamp(this.busOff / 2.3, 0, 1), -1.45, 1.45); }
    // ---- 樞軸（跟隨目標的視覺位置；腳步台階已在 actor.stepOff 平滑）----
    f.visPos ? f.visPos(_vp) : _vp.copy(f.pos);
    const tx = _vp.x, ty = _vp.y + ph, tz = _vp.z;
    if (!this.init || this.pivot.distanceToSquared(_want.set(tx, ty, tz)) > 900) {
      this.pivot.set(tx, ty, tz); this.init = true; this.dist = distT; this.shoulder = shT; this.fov = fovT; this.clear = 99; this.adsT = adsWant; this.height = ph;
    } else {
      const fast = sky || glide || bus;
      this.pivot.x = damp(this.pivot.x, tx, fast ? 30 : 32, dt); this.pivot.z = damp(this.pivot.z, tz, fast ? 30 : 32, dt);
      this.pivot.y = damp(this.pivot.y, ty, fast ? 26 : 16, dt);
    }
    this.dist = damp(this.dist, distT, 9, dt); this.shoulder = damp(this.shoulder, shT, 10, dt); this.fov = damp(this.fov, fovT, 7, dt);
    this.kickBack = damp(this.kickBack, 0, 14, dt); this.kickFov = damp(this.kickFov, 0, 9, dt);
    // 落地下沉彈簧
    this.dipV += (-this.dipY * 170 - this.dipV * 15) * dt; this.dipY += this.dipV * dt; this.dipY = clamp(this.dipY, -0.45, 0.2);

    // 混合 ADS
    const adsDist = scope ? 0 : C.adsDist, adsSh = scope ? 0 : C.adsShoulder;
    const adsFov = (scope ? C.sniperFov : C.adsFov * fk);
    let dist = lerp(this.dist, adsDist, a) + this.kickBack * (1 - a * 0.7), shoulder = lerp(this.shoulder, adsSh, a), fov = lerp(this.fov, adsFov, a) + this.kickFov * (1 - a * 0.8);
    if (sky || glide) this.roll = damp(this.roll, -f.bank * 0.35, 6, dt); else this.roll = damp(this.roll, 0, 8, dt);

    // ---- 姿態＋碰撞（solve）：樞軸 → 肩膀 → 後方（5 條平行射線近似 0.28 m 球）＋球形重疊保險 ----
    const lift = 0.14 * (1 - a) * (bus ? 0 : 1);
    // 觀戰／環繞：樞軸若埋在實體裡（頭上有屋簷、蘑菇傘），沿目標身體往下找可用的起點
    const piv = this._piv || (this._piv = new THREE.Vector3()); piv.copy(this.pivot);
    const watching = !isMe || orb;
    if (watching && P.overlapsCapsule && !bus && !sky && !glide) {
      const floorY = _vp.y + 0.7;
      for (let k = 0; k < 5 && piv.y > floorY && P.overlapsCapsule(piv.x, piv.y - 0.3, piv.z, 0.3, 0.6); k++) piv.y = Math.max(floorY, piv.y - 0.4);
    }
    const solve = (yw, pt) => {
      _e.set(pt, yw, 0); _qb.setFromEuler(_e);
      _rt.set(1, 0, 0).applyQuaternion(_qb); _up.set(0, 1, 0).applyQuaternion(_qb);
      _off.set(0, lift, dist).applyQuaternion(_qb);
      let shUse = shoulder;
      if (Math.abs(shoulder) > 0.02) {
        _dir.copy(_rt).multiplyScalar(Math.sign(shoulder));
        const h = P.raycast(piv, _dir, Math.abs(shoulder) + 0.22, SOLID);
        if (h) shUse = Math.sign(shoulder) * clamp(h.dist - 0.22, 0, Math.abs(shoulder));
      }
      _S.copy(piv).addScaledVector(_rt, shUse);
      _want.copy(_S).add(_off);
      _dir.copy(_off); const ln = _dir.length(); _dir.divideScalar(ln || 1);
      let al = ln;
      if (ln > 0.05) {
        const R = C.radius;
        for (let i = 0; i < 5; i++) {
          _o.copy(_S);
          if (i === 1) _o.addScaledVector(_rt, R); else if (i === 2) _o.addScaledVector(_rt, -R); else if (i === 3) _o.addScaledVector(_up, R); else if (i === 4) _o.addScaledVector(_up, -R);
          const h = P.raycast(_o, _dir, ln + R * 1.1, SOLID);
          if (h) al = Math.min(al, Math.max(0, h.dist - R * 1.05));
        }
        // 保險：射線漏掉的薄牆／起點在盒內，用球形重疊檢查再往回拉
        if (P.overlapsCapsule) {
          const CR = 0.3;
          for (let k = 0; k < 30 && al > 0; k++) {
            _o.copy(_S).addScaledVector(_dir, al);
            if (!P.overlapsCapsule(_o.x, _o.y - CR, _o.z, CR, CR * 2)) break;
            al = Math.max(0, al - 0.25);
          }
        }
      }
      return { al, ln };
    };
    let r = solve(yaw, pitch), allowed = r.al, len = r.ln;
    // 觀戰／環繞時視野被擋到太近：試試轉個角度、抬高視角，挑一個最空曠的（平滑轉過去，不跳）
    let altT = 0, altP = 0, probed = false;
    if (watching && !bus && !sky && !glide && allowed < Math.min(len, 2.4)) {
      let best = allowed; probed = true;
      for (const [dy, dp] of [[0.7, 0], [-0.7, 0], [0, -0.45], [1.4, -0.3], [-1.4, -0.3], [Math.PI, -0.2], [2.2, -0.3], [-2.2, -0.3]]) {
        const q = solve(yaw + dy, clamp(pitch + dp, -1.45, 1.45));
        if (q.al > best + 0.3) { best = q.al; altT = dy; altP = dp; }
        if (best >= Math.min(len, 2.4)) break;
      }
    }
    this.altYaw = damp(this.altYaw || 0, altT, 5, dt); this.altPitch = damp(this.altPitch || 0, altP, 5, dt);
    const alt = Math.abs(this.altYaw) > 0.01 || Math.abs(this.altPitch) > 0.01;
    if (alt) { yaw += this.altYaw; pitch = clamp(pitch + this.altPitch, -1.45, 1.45); }
    if (alt || probed) { r = solve(yaw, pitch); allowed = r.al; len = r.ln; }
    // 拉近立即、恢復緩慢（不鑽進幾何、也不彈跳）
    if (allowed < this.clear || this.clear > len) this.clear = allowed; else this.clear = damp(this.clear, allowed, 3.5, dt);
    const use = Math.min(this.clear, len);
    cam.position.copy(_S).addScaledVector(_dir, use);
    // 觀戰時第三人稱被窄空間（樓梯間、鷹架）擋到太近：平滑改成目標眼睛位置的第一人稱，避免鏡頭貼在牆內
    const fpWant = watching && !orb && !isMe && !bus && !sky && !glide;
    if (fpWant) { if (use < 0.9) this.fpOn = true; else if (allowed > 2.2) this.fpOn = false; } else this.fpOn = false;
    this.fp = damp(this.fp || 0, this.fpOn ? 1 : 0, this.fpOn ? 7 : 4, dt);
    if (this.fp > 0.002) {
      const k = smooth(this.fp);
      _o.set(_vp.x - Math.sin(yaw) * 0.0, _vp.y + 1.52, _vp.z).addScaledVector(_dir.set(-Math.sin(yaw), 0, -Math.cos(yaw)), 0.12);
      cam.position.lerp(_o, k);
      yaw += angleDiff(yaw, f.yaw) * k; pitch = lerp(pitch, clamp(f.pitch, -1.2, 1.2), k);
    }
    // 鏡頭一靠近就隱藏被觀戰者（避免頭／頭髮／鎬子擋滿畫面）；遲滯：>0.08 隱藏、<0.04 才恢復
    if (this.fp > 0.08) this._fpHide = true; else if (this.fp < 0.04) this._fpHide = false;
    const hideF = this._fpHide && this.fp > 0.002 ? f : null;
    if (this._fpActor && this._fpActor !== hideF) { this._fpActor.view?.setVisible?.(true); this._fpActor = null; }
    if (hideF && hideF.view && !this._fpActor) { hideF.view.setVisible?.(false); this._fpActor = hideF; }
    cam.position.y += this.dipY * (1 - a);
    // 不要鑽進地面
    const gh = Math.max(c.terrain.heightAt(cam.position.x, cam.position.z), 0) + 0.25;
    if (cam.position.y < gh) cam.position.y = gh;
    // 震動：位移＋滾轉
    const sk = this.shk; let roll = this.roll;
    if (sk.amp > 0) {
      sk.t += dt; const k = Math.max(0, 1 - sk.t / sk.dur), amp = sk.amp * k * k, tt = this.t;
      if (k <= 0) sk.amp = 0;
      else {
        cam.position.x += (Math.sin(tt * 61) + Math.sin(tt * 37 + 1)) * 0.5 * 0.06 * amp;
        cam.position.y += (Math.sin(tt * 53 + 2) + Math.sin(tt * 29)) * 0.5 * 0.06 * amp;
        cam.position.z += Math.sin(tt * 47 + 4) * 0.04 * amp;
        roll += Math.sin(tt * 43 + 3) * 0.02 * amp;
      }
    }
    _e.set(pitch, yaw, roll); cam.quaternion.setFromEuler(_e);

    // 太近時隱藏自己的模型（狙擊鏡、貼牆）
    if (isMe && f.view && f.alive) this.setHidden((scope && a > 0.5) || use < 0.9 && !bus && !sky && !glide && !orb);
    else this.setHidden(false);

    // FOV：直向螢幕補償（避免橫向視角過窄）
    const asp = cam.aspect || 1.6, comp = asp < 1.6 ? Math.min(1.45, Math.sqrt(1.6 / Math.max(asp, 0.9))) : 1;
    const vf = Math.min(112, 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(fov) / 2) * comp) * 180 / Math.PI);
    if (Math.abs(cam.fov - vf) > 0.01) { cam.fov = vf; cam.updateProjectionMatrix(); }
    this.adsBlend = a; this.scoped = scope && a > 0.85;
  }
  setHidden(h) {
    const v = this.ctx.player.view; if (!v) return;
    if (h) { v.setVisible(false); this.hid = true; } else if (this.hid) { v.setVisible(true); this.hid = false; }
  }
}
