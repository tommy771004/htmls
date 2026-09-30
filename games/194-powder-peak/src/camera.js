// 第三人稱追尾鏡頭：行進方向後方、滯空拉遠、FOV 隨速度、不鑽地、震動。
// 鏡頭座標系沿「坡面」：後退距離沿坡面往上坡量、高度沿坡面法線量，視線順著坡往下看。
// → 陡坡時不會被地面淨空頂到半空中變成俯視；低速貼近角色（附圖構圖），速度越快拉遠拉高。
import * as THREE from 'three';
import { config } from './config.js';
import { clamp, lerp, smoothstep, damp, valueNoise2 } from './shared.js';

const LOCAL_DEFAULTS = config.camera; // 預設值唯一來源是 config.js（這裡不再重複寫數值）

const _desired = new THREE.Vector3();
const _look = new THREE.Vector3();
const _mid = new THREE.Vector3();

export class ChaseCamera {
  constructor(camera, cfg = config) {
    this.camera = camera;
    this.C = { ...LOCAL_DEFAULTS, ...((cfg && cfg.camera) || {}) };
    this.dirX = 0;
    this.dirZ = -1;
    this.airBlend = 0;
    this.crashBlend = 0;
    this.pull = 0;           // 0 = 近（低速），1 = 遠（高速）
    this.slope = 0;          // 平滑後的沿行進方向坡度（tan，正 = 下坡）
    this.anchor = new THREE.Vector3();
    this.predVel = new THREE.Vector3(); // 平滑後的速度（錨點預測用；起跳/落地速度突變不會讓鏡頭一幀急停）
    this.offBack = this.C.distance;
    this.offUp = this.C.height;
    this.lift = 0;
    this.occl = 1;           // 樹遮擋拉近比例（1 = 不拉近）
    this.occlVel = 0;
    this.fov = this.C.fovBase;
    this.shakeAmp = 0;
    this.shakeTime = 0;
    this.lookTarget = new THREE.Vector3();
    this._terrain = null;
    this._hasPlayer = false;
  }

  reset(player) {
    const C = this.C;
    const h = player.heading || 0;
    this.dirX = Math.sin(h);
    this.dirZ = -Math.cos(h);
    this.airBlend = 0;
    this.crashBlend = 0;
    this.lift = 0;
    this.shakeAmp = 0;
    this.anchor.copy(player.position);
    this.predVel.copy(player.velocity);
    this.pull = this._pullTarget(player);
    this.offBack = lerp(C.distance, C.distanceFast, this.pull);
    this.offUp = lerp(C.height, C.heightFast, this.pull);
    this.slope = this._slopeSample(player.position, this._terrain);
    this.fov = C.fovBase;
    this._hasPlayer = true;
    this._apply(player, this._terrain, true);
  }

  shake(amount) {
    if (!(amount > 0)) return;
    this.shakeAmp = Math.min(this.C.shakeMax, this.shakeAmp + amount);
  }

  _pullTarget(player) {
    const v = player.velocity;
    const hs = Math.sqrt(v.x * v.x + v.z * v.z);
    return smoothstep(this.C.pullSpeedMin, this.C.pullSpeedMax, hs);
  }

  // 沿目前鏡頭方向的地面坡度（不含跳台，避免過跳台時鏡頭點頭）
  _slopeSample(pos, terrain) {
    if (!terrain) return this.slope || 0;
    const L = this.C.slopeProbe;
    const hf = typeof terrain.groundHeight === 'function' ? terrain.groundHeight.bind(terrain) : terrain.heightAt.bind(terrain);
    const h0 = hf(pos.x, pos.z);
    const hb = hf(pos.x - this.dirX * L, pos.z - this.dirZ * L);
    return clamp((hb - h0) / L, -0.3, 0.9);
  }

  update(dt, player, terrain) {
    if (!player) return;
    if (terrain) this._terrain = terrain;
    if (!this._hasPlayer) {
      this.reset(player);
      return;
    }
    dt = clamp(dt || 0, 0, 0.1);
    const C = this.C;
    const pos = player.position;
    const vel = player.velocity;
    const state = player.state;
    const crashed = state === 'crashed';
    const airborne = state === 'air' || (!player.grounded && state !== 'crashed' && state !== 'ready');
    const followScale = crashed ? C.crashFollowScale : 1;

    // 目標行進方向：低速以 heading 為主，速度越快越偏向水平速度方向；空中以速度為主（空中自轉不甩鏡頭）
    const vx = vel.x;
    const vz = vel.z;
    const hs = Math.sqrt(vx * vx + vz * vz);
    const fx = Math.sin(player.heading || 0);
    const fz = -Math.cos(player.heading || 0);
    let w = smoothstep(C.velDirSpeedMin, C.velDirSpeedMax, hs);
    if ((airborne || crashed) && hs > 0.5) w = Math.max(w, 0.95);
    let tx = fx * (1 - w);
    let tz = fz * (1 - w);
    if (hs > 1e-4) {
      tx += (vx / hs) * w;
      tz += (vz / hs) * w;
    }
    let tl = Math.sqrt(tx * tx + tz * tz);
    if (tl < 1e-4) {
      tx = this.dirX;
      tz = this.dirZ;
      tl = 1;
    }
    tx /= tl;
    tz /= tl;
    const dRate = C.dirFollow * followScale;
    const nx = damp(this.dirX, tx, dRate, dt);
    const nz = damp(this.dirZ, tz, dRate, dt);
    const nl = Math.sqrt(nx * nx + nz * nz);
    if (nl > 1e-3) {
      this.dirX = nx / nl;
      this.dirZ = nz / nl;
    }

    // 坡度（平滑）
    if (this._terrain) this.slope = damp(this.slope, this._slopeSample(pos, this._terrain), C.slopeRate, dt);

    // 滯空拉遠
    const airTarget = airborne ? 1 : 0;
    this.airBlend = damp(this.airBlend, airTarget, airTarget > this.airBlend ? C.airBlendIn : C.airBlendOut, dt);

    this.crashBlend = damp(this.crashBlend, crashed ? 1 : 0, crashed ? 4 : 2, dt);

    // 速度拉遠（摔倒時維持原距離，不要因為減速突然貼近）
    if (!crashed) this.pull = damp(this.pull, this._pullTarget(player), 1.5, dt);

    // 錨點：以速度預測前進後再平滑拉向玩家 → 等速時無延遲，突變時平滑
    const pv = this.predVel;
    const k = 1 - Math.exp(-C.predVelRate * dt);
    pv.x += (vx - pv.x) * k;
    pv.y += (vel.y - pv.y) * k;
    pv.z += (vz - pv.z) * k;
    this.anchor.x += pv.x * dt;
    this.anchor.y += pv.y * dt;
    this.anchor.z += pv.z * dt;
    const aRate = C.anchorFollow * followScale;
    this.anchor.x = damp(this.anchor.x, pos.x, aRate, dt);
    this.anchor.y = damp(this.anchor.y, pos.y, aRate, dt);
    this.anchor.z = damp(this.anchor.z, pos.z, aRate, dt);

    // 距離 / 高度平滑
    const dist = lerp(C.distance, C.distanceFast, this.pull) + C.airPullback * this.airBlend + C.crashPullback * this.crashBlend;
    const height = lerp(C.height, C.heightFast, this.pull) + C.airRaise * this.airBlend + C.crashRaise * this.crashBlend;
    const pRate = C.follow * followScale;
    this.offBack = damp(this.offBack, dist, pRate, dt);
    this.offUp = damp(this.offUp, height, pRate, dt);

    // FOV
    const fovTarget = lerp(C.fovBase, C.fovMax, clamp(hs / C.fovSpeedRef, 0, 1));
    this.fov = damp(this.fov, fovTarget, C.fovFollow, dt);

    // 震動
    this.shakeTime += dt;
    this.shakeAmp *= Math.exp(-C.shakeDecay * dt);
    if (this.shakeAmp < 1e-3) this.shakeAmp = 0;

    this._apply(player, this._terrain, false, dt);
  }

  _apply(player, terrain, snap, dt = 0) {
    const C = this.C;
    const cam = this.camera;
    // 坡面座標：F = 沿坡往下的前進方向，U = 坡面法線（只取 slopeFollow 比例的坡度）
    const a = Math.atan(this.slope * C.slopeFollow);
    const ca = Math.cos(a), sa = Math.sin(a);
    const Fx = this.dirX * ca, Fy = -sa, Fz = this.dirZ * ca;
    const Ux = this.dirX * sa, Uy = ca, Uz = this.dirZ * sa;
    const back = this.offBack, up = this.offUp;
    const lookAhead = lerp(C.lookAhead, C.crashLookAhead, this.crashBlend);
    const lookHeight = lerp(C.lookHeight, C.lookHeightFast, this.pull);
    _desired.set(
      this.anchor.x - Fx * back + Ux * up,
      this.anchor.y - Fy * back + Uy * up,
      this.anchor.z - Fz * back + Uz * up,
    );
    _look.set(
      this.anchor.x + Fx * lookAhead + Ux * lookHeight,
      this.anchor.y + Fy * lookAhead + Uy * lookHeight,
      this.anchor.z + Fz * lookAhead + Uz * lookHeight,
    );

    // 樹遮擋：鏡頭→角色連線穿過樹冠（貼柵欄滑、彎道時鏡頭甩到柵欄外的樹林）→ 鏡頭沿連線拉近到樹前
    let occl = 1;
    if (terrain && typeof terrain.queryObstacles === 'function') {
      const ax = this.anchor.x, az = this.anchor.z;
      const dx = _desired.x - ax, dz = _desired.z - az;
      const L2 = dx * dx + dz * dz;
      if (L2 > 1e-4) {
        const L = Math.sqrt(L2);
        const list = terrain.queryObstacles(ax + dx * 0.5, az + dz * 0.5, L * 0.5 + 3.5) || [];
        for (let i = 0; i < list.length; i++) {
          const o = list[i];
          if (o.type !== 'tree' || o.top < _desired.y) continue;
          const rc = o.r * C.treeCanopyScale + C.treeMargin;
          const t = ((o.x - ax) * dx + (o.z - az) * dz) / L2;
          if (t < C.occlFromFrac) continue; // 角色身邊（剛擦過）的樹不算：只處理擋在鏡頭那一段的
          const ex = ax + dx * t - o.x, ez = az + dz * t - o.z;
          const e2 = ex * ex + ez * ez;
          if (e2 >= rc * rc) continue;
          occl = Math.min(occl, Math.max(C.occlMinFrac, t - Math.sqrt(rc * rc - e2) / L));
        }
      }
    }
    if (snap) {
      this.occl = occl;
      this.occlVel = 0;
    } else if (dt > 0) {
      // 二階（臨界阻尼彈簧）平滑：一階 damp 在遮擋出現瞬間會讓鏡頭速度一幀跳變（實測 90 g 抽動）
      const w = occl < this.occl ? C.occlIn : C.occlOut;
      this.occlVel += (w * w * (occl - this.occl) - 2 * w * this.occlVel) * dt;
      this.occl = clamp(this.occl + this.occlVel * dt, C.occlMinFrac * 0.9, 1);
    }
    if (this.occl < 0.999) {
      const k = this.occl;
      _desired.x = this.anchor.x + (_desired.x - this.anchor.x) * k;
      _desired.z = this.anchor.z + (_desired.z - this.anchor.z) * k;
      _desired.y = this.anchor.y + (_desired.y - this.anchor.y) * lerp(1, k, 0.4);
    }

    if (terrain && typeof terrain.heightAt === 'function') {
      // 中點遮擋：鏡頭到玩家頭部連線的中點要高於地面（彎道外側雪丘、起伏）
      const headY = this.anchor.y + lookHeight;
      _mid.set((_desired.x + this.anchor.x) * 0.5, 0, (_desired.z + this.anchor.z) * 0.5);
      const midGround = terrain.heightAt(_mid.x, _mid.z);
      const needMidY = 2 * (midGround + C.minClearance * 0.6) - headY;
      const liftTarget = Math.max(0, needMidY - _desired.y);
      if (snap) this.lift = liftTarget;
      else this.lift = damp(this.lift, liftTarget, liftTarget > this.lift ? 10 : 2.5, dt);
      _desired.y += this.lift;
      // 鏡頭本身的地面淨空（硬性下限）
      const g = terrain.heightAt(_desired.x, _desired.z);
      if (_desired.y < g + C.minClearance) _desired.y = g + C.minClearance;
    }

    if (this.shakeAmp > 0) {
      const t = this.shakeTime * C.shakeFreq;
      const s = this.shakeAmp * C.shakeScale;
      _desired.x += valueNoise2(t, 0.5, 11) * s;
      _desired.y += valueNoise2(t, 7.5, 23) * s * 0.8;
      _desired.z += valueNoise2(t, 13.5, 37) * s * 0.5;
      _look.x += valueNoise2(t, 19.5, 41) * s * 0.4;
      _look.y += valueNoise2(t, 29.5, 53) * s * 0.4;
    }

    cam.position.copy(_desired);
    this.lookTarget.copy(_look);
    cam.lookAt(_look);

    if (cam.isPerspectiveCamera) {
      if (snap) this.fov = C.fovBase;
      if (Math.abs(cam.fov - this.fov) > 0.05) {
        cam.fov = this.fov;
        cam.updateProjectionMatrix();
      }
    }
  }
}
