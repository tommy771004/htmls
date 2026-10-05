// 漁夫：載入骨架與動畫、走路（棧橋與沙灘的可走範圍）、播放各動作、提供竿尖與左手的世界座標。
import * as THREE from 'three';
import { getFisher, findClip, shadowify } from './assets.js';
import { fisherPH } from './placeholders.js';
import { floorY, onDeck, blocked, DECK_Y, WALK } from './terrain.js';

const LOOP = { idle: true, walk: true, wait: true, reel: true, cast: false, hook: false, stow: false, cheer: false };
const v3 = new THREE.Vector3();

export class Fisher {
  constructor(scene) {
    const { obj, clips, fromGLB } = getFisher();
    this.obj = obj; this.fromGLB = fromGLB;
    shadowify(obj, true, true);
    scene.add(obj);
    this.mixer = new THREE.AnimationMixer(obj);
    const fallback = fisherPH().clips;
    this.actions = {};
    for (const name of Object.keys(LOOP)) {
      const clip = findClip(clips, name) || findClip(fallback, name);
      if (!clip) continue;
      const a = this.mixer.clipAction(clip);
      a.setLoop(LOOP[name] ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
      a.clampWhenFinished = !LOOP[name];
      this.actions[name] = a;
    }
    this.rodTip = obj.getObjectByName('rod_tip');
    this.handL = obj.getObjectByName('hand_L');
    this.handR = obj.getObjectByName('hand_R');
    this.head = obj.getObjectByName('head');
    this.pos = new THREE.Vector3(0, DECK_Y, -4);
    this.yaw = Math.PI;
    this.deck = true;
    this.speed = 0;
    this.cur = null; this.curName = '';
    this.onFinish = null;
    this.mixer.addEventListener('finished', (e) => {
      if (e.action === this.cur && this.onFinish) { const f = this.onFinish; this.onFinish = null; f(); }
    });
    this.play('idle', 0);
    this.sync();
  }
  play(name, fade = 0.2, onFinish = null, from = 0) {
    const a = this.actions[name];
    if (!a) { if (onFinish) onFinish(); return; }
    if (this.cur === a && LOOP[name]) { this.onFinish = onFinish; return; }
    a.reset(); a.time = from; a.timeScale = 1; a.enabled = true; a.setEffectiveWeight(1); a.paused = false;
    a.play();
    if (this.cur && this.cur !== a && fade > 0) this.cur.crossFadeTo(a, fade, false);
    else if (this.cur && this.cur !== a) this.cur.stop();
    for (const k in this.actions) if (this.actions[k] !== a && this.actions[k] !== this.cur) this.actions[k].stop();
    this.cur = a; this.curName = name; this.onFinish = onFinish;
  }
  // 讓動作停在某時間點（截圖與蓄力用）
  hold(name, t, fade = 0.12) {
    if (this.curName !== name) this.play(name, fade);
    const a = this.cur; if (!a) return;
    a.time = Math.min(t, a.getClip().duration - 1e-3); a.paused = true;
  }
  resume() { if (this.cur) this.cur.paused = false; }
  // 在可走範圍內移動；回傳實際位移
  move(dx, dz, dt) {
    const len = Math.hypot(dx, dz);
    const sp = 2.0;   // 悠閒步行：walk 片段以 1.6 m/s 製作，main.js 依速度調 timeScale（≈1.25）
    if (len > 0.05) {
      const target = Math.atan2(dx, dz);
      let d = target - this.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
      this.yaw += d * Math.min(1, dt * 12);
      const step = sp * Math.min(1, len) * dt;
      const nx = this.pos.x + (dx / len) * step, nz = this.pos.z + (dz / len) * step;
      if (!this.tryMove(nx, nz)) { if (!this.tryMove(nx, this.pos.z)) this.tryMove(this.pos.x, nz); }
      this.speed = sp * Math.min(1, len);
    } else this.speed = 0;
  }
  tryMove(x, z) {
    if (Math.abs(x) > 40 || z < -40 || z > 40) return false;
    if (this.deck) {
      if (onDeck(x, z)) { if (blocked(x, z)) return false; this.pos.x = x; this.pos.z = z; return true; }
      if (z > 6 && Math.abs(x) < WALK.x1 && floorY(x, z) > -0.02) { this.deck = false; this.pos.x = x; this.pos.z = z; return true; }
      return false;
    }
    if (onDeck(x, z) || (Math.abs(x) < 1.35 && z <= 6 && z > -12.2)) {
      if (z > 5.3 && Math.abs(x) < WALK.x1) { this.deck = true; this.pos.x = x; this.pos.z = z; return true; }
      return false;
    }
    if (floorY(x, z) > 0.02) { this.pos.x = x; this.pos.z = z; return true; }
    return false;
  }
  place(x, z, yaw) {
    this.pos.x = x; this.pos.z = z; if (yaw != null) this.yaw = yaw;
    this.deck = onDeck(x, z);
    this.pos.y = this.groundY();
    this.sync();
  }
  groundY() { return this.deck ? DECK_Y : Math.max(floorY(this.pos.x, this.pos.z), -0.1); }
  update(dt) {
    const gy = this.groundY();
    this.pos.y += (gy - this.pos.y) * Math.min(1, dt * 10);
    this.mixer.update(dt);
    this.sync();
  }
  sync() {
    this.obj.position.copy(this.pos);
    this.obj.rotation.set(0, this.yaw, 0);
    this.obj.updateMatrixWorld(true);
  }
  tipWorld(out = new THREE.Vector3()) {
    if (this.rodTip) return this.rodTip.getWorldPosition(out);
    return out.set(this.pos.x + Math.sin(this.yaw) * 2, this.pos.y + 2, this.pos.z + Math.cos(this.yaw) * 2);
  }
  handLWorld(out = new THREE.Vector3()) {
    if (this.handL) return this.handL.getWorldPosition(out);
    return out.copy(this.pos).add(v3.set(0, 1.8, 0));
  }
  forward(out = new THREE.Vector3()) { return out.set(Math.sin(this.yaw), 0, Math.cos(this.yaw)); }
}
