// 第三人稱鏡頭：繞角色旋轉、自動回到背後、掛邊時拉近、撞牆拉近（對碰撞盒做射線測試，不掃三角形）。
import * as THREE from 'three';

const wrapPi = (a) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };

export function makeCamera(world, aspect) {
  const cam = new THREE.PerspectiveCamera(50, aspect, 0.1, 1200);
  const c = { yaw: 0, pitch: 0.23, dist: 5, curDist: 5, target: new THREE.Vector3(), lastInput: -99, init: false, shake: 0 };
  const fwd = new THREE.Vector3(), right = new THREE.Vector3();
  const blockers = () => world.cols.filter((k) => !k.small && !k.lift && (k.max.x - k.min.x > 0.9 && k.max.z - k.min.z > 0.9 && k.max.y - k.min.y > 0.9));
  let cache = null;

  function rayBoxes(o, d, maxT) {
    let best = maxT;
    for (const b of cache) {
      if (!b.on) continue;
      let t0 = 0, t1 = best;
      let ok = true;
      for (const ax of ['x', 'y', 'z']) {
        const inv = 1 / (d[ax] || 1e-9);
        let ta = (b.min[ax] - o[ax]) * inv, tb = (b.max[ax] - o[ax]) * inv;
        if (ta > tb) { const t = ta; ta = tb; tb = t; }
        t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
        if (t0 > t1) { ok = false; break; }
      }
      if (ok && t0 > 0.05 && t0 < best) best = t0;
    }
    return best;
  }

  function update(dt, player, look, now, mobile) {
    if (!cache) cache = blockers();
    const s = player.s;
    if (look[0] || look[1]) {
      c.yaw -= look[0] * 0.0042; c.pitch = Math.max(-0.25, Math.min(1.05, c.pitch + look[1] * 0.0032)); c.lastInput = now;
    }
    const idle = (now - c.lastInput) / 1000;
    const behind = s.yaw + Math.PI;
    const sp = Math.hypot(s.vel.x, s.vel.z);
    if (!c.init) { c.yaw = behind; c.init = true; }
    if (idle > 1.5) {
      let rate = 0;
      if (s.mode === 'hang' || s.mode === 'hop') rate = 2.2;
      else if (s.mode === 'ground' && sp > 1.5) rate = 0.9 * Math.min(1, sp / 5);
      // 往鏡頭跑時不回轉（避免鏡頭追著轉圈）
      const d = wrapPi(behind - c.yaw);
      if (Math.abs(d) > 2.5 && s.mode === 'ground') rate = 0;
      c.yaw += d * Math.min(1, rate * dt);
      const wantPitch = s.mode === 'hang' || s.mode === 'hop' ? 0.14 : 0.23;
      if (rate > 0) c.pitch += (wantPitch - c.pitch) * Math.min(1, dt * 1.2);
    }
    c.dist = (s.mode === 'hang' || s.mode === 'hop' || s.mode === 'mantle' ? 4.0 : 5.0) * (mobile ? 1.12 : 1);
    // 目標：頭部高度，垂直跟得慢一點
    const tgt = new THREE.Vector3(s.pos.x, s.pos.y + 1.45, s.pos.z);
    if (!c.inited2) { c.target.copy(tgt); c.inited2 = true; }
    const kx = 1 - Math.exp(-dt * 12), ky = 1 - Math.exp(-dt * (s.mode === 'air' ? 4.5 : 9));
    c.target.x += (tgt.x - c.target.x) * kx; c.target.z += (tgt.z - c.target.z) * kx; c.target.y += (tgt.y - c.target.y) * ky;
    // 撞牆
    const dir = new THREE.Vector3(Math.sin(c.yaw) * Math.cos(c.pitch), Math.sin(c.pitch), Math.cos(c.yaw) * Math.cos(c.pitch));
    const hit = rayBoxes(c.target, dir, c.dist + 0.3);
    const want = Math.max(1.2, Math.min(c.dist, hit - 0.35));
    c.curDist += (want - c.curDist) * Math.min(1, dt * (want < c.curDist ? 18 : 3));
    cam.position.copy(c.target).addScaledVector(dir, c.curDist);
    cam.lookAt(c.target.x, c.target.y + 0.1, c.target.z);
    if (c.shake > 0) { c.shake = Math.max(0, c.shake - dt * 2.5); cam.position.y += Math.sin(now * 0.06) * c.shake * 0.05; }
    fwd.set(-Math.sin(c.yaw), 0, -Math.cos(c.yaw));
    right.set(Math.cos(c.yaw), 0, -Math.sin(c.yaw));
  }
  function snapBehind(player) { c.yaw = player.s.yaw + Math.PI; c.pitch = 0.23; c.inited2 = false; c.curDist = c.dist; }
  function invalidate() { cache = null; }

  return { cam, c, update, fwd, right, snapBehind, invalidate };
}
