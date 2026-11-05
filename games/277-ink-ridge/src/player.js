// 角色控制器：跑、跳（土狼時間＋預輸入）、爬階、空中抓邊、掛邊橫移、上攀、側跳、往後躍、翻上崖頂、出手。
// 模擬以固定步長（1/60 s）推進；數值見 SPEC.md §5。
import * as THREE from 'three';

export const P = {
  r: 0.32, h: 1.75, run: 5.4, accG: 42, decG: 54, accA: 14, jumpV: 7.6, gUp: 23, gDown: 31, maxFall: 32,
  coyote: 0.12, buffer: 0.12, step: 0.45, snap: 0.42,
  hangDrop: 1.8, hangOut: 0.33, shimmy: 1.7, grabLo: 1.2, grabHi: 2.15, grabOut: 0.75,
  hopMin: 0.8, hopMax: 2.6, sideGap: 2.2, backV: 5.5, backUp: 6.8, grabCD: 0.3,
};

const tmpV = new THREE.Vector3();
const wrapPi = (a) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };

export function makePlayer(level, sfx) {
  const W = level.world;
  const s = {
    pos: level.start.pos.clone(), vel: new THREE.Vector3(), yaw: level.start.yaw, mode: 'ground',
    groundCol: null, coyote: 0, buffer: 0, grabCD: 0, ledge: null, lt: 0, tween: null, strike: -1, struck: false,
    land: 0, pushT: 0, shimmyV: 0, upHold: 0, downHold: 0, hopCD: 0, airT: 0, deadT: 0, falls: 0, hangSwing: 0, lastGround: level.start.pos.clone(),
  };

  const facing = () => tmpV.set(Math.sin(s.yaw), 0, Math.cos(s.yaw));
  const hangPos = (L, t, out = new THREE.Vector3()) => out.copy(L.a).addScaledVector(L.dir, t).addScaledVector(L.n, P.hangOut).setY(L.y - P.hangDrop);
  const hangFree = (L, t) => { const h = hangPos(L, t, new THREE.Vector3()); return !W.blocked(h.x, h.z, P.r * 0.9, h.y + 0.05, h.y + P.h - 0.05); };

  function enterHang(L, t) {
    s.mode = 'hang'; s.ledge = L; s.lt = t; s.vel.set(0, 0, 0);
    hangPos(L, t, s.pos);
    s.yaw = Math.atan2(-L.n.x, -L.n.z);
    s.hangSwing = 0.35;
    s.hopCD = 0.18;
    sfx.grab();
  }

  function tryGrab() {
    if (s.grabCD > 0 || s.vel.y > 3.5) return false;
    let best = null, bestScore = 1e9, bestT = 0;
    for (const L of W.ledges) {
      if (L.on === false) continue;
      const rx = s.pos.x - L.a.x, rz = s.pos.z - L.a.z;
      const tRaw = rx * L.dir.x + rz * L.dir.z;
      if (tRaw < -0.15 || tRaw > L.len + 0.15) continue;
      const out = rx * L.n.x + rz * L.n.z - tRaw * (L.dir.x * L.n.x + L.dir.z * L.n.z);
      if (out < -0.15 || out > P.grabOut) continue;
      const hy = L.y - s.pos.y;
      if (hy < P.grabLo || hy > P.grabHi) continue;
      if (s.vel.x * L.n.x + s.vel.z * L.n.z > 1.2) continue; // 正在遠離壁面
      const t = Math.max(0.2, Math.min(L.len - 0.2, tRaw));
      if (!hangFree(L, t)) continue;
      const score = Math.abs(out - P.hangOut) + Math.abs(hy - P.hangDrop) * 0.5;
      if (score < bestScore) { bestScore = score; best = L; bestT = t; }
    }
    if (best) { enterHang(best, bestT); return true; }
    return false;
  }

  /** 同一面牆上的其他岩縫 */
  function findLedge(L, P0, pred) {
    let best = null, bestD = 1e9, bestT = 0;
    for (const L2 of W.ledges) {
      if (L2 === L || L2.on === false || L2.n.dot(L.n) < 0.9) continue;
      const res = pred(L2, P0);
      if (res && res.d < bestD) { bestD = res.d; best = L2; bestT = res.t; }
    }
    return best ? { L: best, t: bestT } : null;
  }
  const ledgePoint = (L, t) => L.a.clone().addScaledVector(L.dir, t);

  function startTween(kind, to, dur, extra = {}) {
    s.tween = { kind, from: s.pos.clone(), to: to.clone(), t: 0, dur, ...extra };
    s.mode = kind;
  }

  function hangUpdate(dt, inp, camRight) {
    const L = s.ledge;
    if (L.on === false) { // 冰縫碎了
      s.mode = 'air'; s.ledge = null; s.vel.set(L.n.x * 0.6, 0, L.n.z * 0.6); s.grabCD = 0.5; s.shimmyV = 0; return;
    }
    const r = new THREE.Vector3(L.n.z, 0, -L.n.x);
    // 左右：鏡頭大致正對牆時直接用 A/D；側面時用世界方向投影
    const cr = camRight.dot(r);
    let side = Math.abs(cr) > 0.35 ? inp.mx * Math.sign(cr) : inp.mx * Math.sign(cr || 1);
    if (Math.abs(side) < 0.25) side = 0;
    const up = inp.my > 0.5, down = inp.my < -0.5;
    s.hopCD -= dt;
    s.hangSwing *= Math.exp(-dt * 3);
    const P0 = ledgePoint(L, s.lt);

    if (inp.jump) {
      if (down) { // 往後躍
        s.mode = 'air'; s.ledge = null;
        s.vel.set(L.n.x * P.backV, P.backUp, L.n.z * P.backV);
        s.yaw = Math.atan2(L.n.x, L.n.z); s.grabCD = 0.4; sfx.jump(); return;
      }
      if (side) { // 側跳
        const hit = findLedge(L, P0, (L2) => {
          const dy = L2.y - L.y; if (dy < -1.2 || dy > 1.4) return null;
          const off = Math.abs(L2.a.clone().sub(P0).dot(L.n)); if (off > 0.7) return null;
          const pa = L2.a.clone().sub(P0).dot(r) * side, pb = L2.b.clone().sub(P0).dot(r) * side;
          const lo = Math.min(pa, pb), hi = Math.max(pa, pb);
          if (hi < 0.3 || lo > P.sideGap + 0.4) return null;
          const along = Math.max(lo + 0.35, 0.3) * side; // 落點：近端往內 0.35 m
          const target = P0.clone().addScaledVector(r, along);
          let t = target.clone().sub(L2.a).dot(L2.dir); t = Math.max(0.2, Math.min(L2.len - 0.2, t));
          return { d: Math.max(lo, 0) + Math.abs(dy) * 0.5, t };
        });
        if (hit && hangFree(hit.L, hit.t)) { startTween('hop', hangPos(hit.L, hit.t), 0.42, { L: hit.L, lt: hit.t, arc: 0.45 }); sfx.jump(); return; }
        // 沒有岩縫：往旁邊躍出去
        s.mode = 'air'; s.ledge = null; s.vel.set(r.x * side * 3.6 + L.n.x * 1.5, 5.2, r.z * side * 3.6 + L.n.z * 1.5); s.grabCD = 0.25; sfx.jump(); return;
      }
    }
    if ((up || (inp.jump && !side && !down)) && s.hopCD <= 0) {
      const hit = findLedge(L, P0, (L2) => {
        const dy = L2.y - L.y; if (dy < P.hopMin || dy > P.hopMax) return null;
        const off = Math.abs(L2.a.clone().sub(P0).dot(L.n)); if (off > 0.7) return null;
        const t = P0.clone().sub(L2.a).dot(L2.dir);
        if (t < 0.1 || t > L2.len - 0.1) return null;
        return { d: dy, t: Math.max(0.2, Math.min(L2.len - 0.2, t)) };
      });
      if (hit && hangFree(hit.L, hit.t)) { startTween('hop', hangPos(hit.L, hit.t), 0.36, { L: hit.L, lt: hit.t, arc: 0.25 }); sfx.jump(); return; }
      if (L.top) {
        const top = P0.clone().addScaledVector(L.n, -0.5); top.y = L.y;
        if (!W.blocked(top.x, top.z, P.r, top.y + 0.05, top.y + P.h)) { startTween('mantle', top, 0.78, { mid: P0.clone().addScaledVector(L.n, 0.12).setY(L.y - 0.6) }); sfx.climb(); return; }
      }
      s.hopCD = 0.25; // 上面沒東西：稍等再試
    }
    if (down) { s.downHold += dt; } else s.downHold = 0;
    if (s.downHold > 0.12) { // 放手
      s.mode = 'air'; s.ledge = null; s.vel.set(L.n.x * 0.8, 0, L.n.z * 0.8); s.grabCD = P.grabCD; s.downHold = 0; return;
    }
    // 橫移
    const want = side * P.shimmy;
    s.shimmyV += (want - s.shimmyV) * Math.min(1, dt * 12);
    if (Math.abs(s.shimmyV) > 0.01) {
      let nt = s.lt + s.shimmyV * dt;
      if (nt < 0.2 || nt > L.len - 0.2) {
        // 接續的岩縫（同高、端點相接）
        const endP = ledgePoint(L, nt < 0.2 ? 0 : L.len);
        const cont = W.ledges.find((L2) => L2 !== L && L2.on !== false && L2.n.dot(L.n) > 0.95 && Math.abs(L2.y - L.y) < 0.12 && (L2.a.distanceTo(endP) < 0.5 || L2.b.distanceTo(endP) < 0.5));
        if (cont) { const t2 = endP.clone().sub(cont.a).dot(cont.dir); s.ledge = cont; s.lt = Math.max(0.2, Math.min(cont.len - 0.2, t2)); hangPos(cont, s.lt, s.pos); return; }
        nt = Math.max(0.2, Math.min(L.len - 0.2, nt));
        s.shimmyV = 0;
      }
      if (hangFree(L, nt)) { s.lt = nt; hangPos(L, nt, s.pos); } else s.shimmyV = 0;
    }
  }

  function tweenUpdate(dt) {
    const tw = s.tween;
    tw.t = Math.min(1, tw.t + dt / tw.dur);
    const k = tw.t;
    if (tw.kind === 'mantle') {
      const a = Math.min(1, k / 0.55), b = Math.max(0, (k - 0.55) / 0.45);
      if (k < 0.55) s.pos.lerpVectors(tw.from, tw.mid, a * a * (3 - 2 * a));
      else s.pos.lerpVectors(tw.mid, tw.to, b * b * (3 - 2 * b));
    } else {
      const e = k * k * (3 - 2 * k);
      s.pos.lerpVectors(tw.from, tw.to, e);
      s.pos.y += Math.sin(Math.PI * k) * tw.arc;
    }
    if (k >= 1) {
      if (tw.kind === 'mantle') { s.mode = 'ground'; s.pos.copy(tw.to); s.vel.set(0, 0, 0); s.ledge = null; s.coyote = 0; s.groundCol = null; }
      else enterHang(tw.L, tw.lt);
      s.tween = null;
    }
  }

  function groundAir(dt, inp, camFwd, camRight) {
    const grounded = s.mode === 'ground';
    // 被移動平台帶著走
    if (grounded && s.groundCol && s.groundCol.delta.lengthSq() > 0) s.pos.add(s.groundCol.delta);
    // 想走的方向
    const dir = tmpV.set(0, 0, 0).addScaledVector(camRight, inp.mx).addScaledVector(camFwd, inp.my);
    const mag = Math.min(1, dir.length());
    if (mag > 0.05) dir.divideScalar(dir.length());
    const strikeSlow = s.strike >= 0 && grounded ? 0.35 : 1;
    const tx = dir.x * P.run * mag * strikeSlow, tz = dir.z * P.run * mag * strikeSlow;
    const acc = grounded ? (mag > 0.05 ? P.accG : P.decG) : P.accA;
    const dvx = tx - s.vel.x, dvz = tz - s.vel.z, dl = Math.hypot(dvx, dvz), mx = acc * dt;
    if (grounded || mag > 0.05) { if (dl > mx) { s.vel.x += (dvx / dl) * mx; s.vel.z += (dvz / dl) * mx; } else { s.vel.x = tx; s.vel.z = tz; } }
    if (mag > 0.05 && s.strike < 0) {
      const ty = Math.atan2(dir.x, dir.z);
      s.yaw += wrapPi(ty - s.yaw) * Math.min(1, dt * (grounded ? 14 : 6));
    }
    // 跳
    if (inp.jump) s.buffer = P.buffer;
    s.buffer -= dt; s.coyote -= dt;
    if (s.buffer > 0 && (grounded || s.coyote > 0)) {
      // 從移動平台起跳：帶上平台的水平速度
      if (s.groundCol) { s.vel.x += s.groundCol.delta.x / dt; s.vel.z += s.groundCol.delta.z / dt; }
      s.vel.y = P.jumpV; s.mode = 'air'; s.buffer = 0; s.coyote = 0; s.groundCol = null; s.airT = 0; sfx.jump();
    }
    // 水平移動＋推出
    s.pos.x += s.vel.x * dt; s.pos.z += s.vel.z * dt;
    const y0 = s.pos.y + (s.mode === 'ground' ? P.step : 0.2);
    const hit = W.pushOut(s.pos, P.r, y0, s.pos.y + P.h);
    if (hit) { const vn = s.vel.x * hit.x + s.vel.z * hit.z; if (vn < 0) { s.vel.x -= hit.x * vn; s.vel.z -= hit.z * vn; } }
    // 推石：貼著石塊往裡走
    s.pushT = Math.max(0, s.pushT - dt);
    if (hit && hit.c.block && grounded && mag > 0.3 && dir.x * hit.x + dir.z * hit.z < -0.7 && level.push(hit, dt, s)) s.pushT = 0.14;
    // 垂直
    const oldY = s.pos.y;
    if (s.mode === 'air') {
      const g = s.vel.y > 0 && inp.jumpHeld ? P.gUp : s.vel.y > 0 ? P.gUp * 1.7 : P.gDown;
      s.vel.y = Math.max(-P.maxFall, s.vel.y - g * dt);
      s.pos.y += s.vel.y * dt;
      s.airT += dt;
      if (s.vel.y > 0) {
        const c = W.ceiling(s.pos.x, s.pos.z, P.r, oldY, s.pos.y + P.h);
        if (s.pos.y + P.h > c) { s.pos.y = c - P.h; s.vel.y = 0; }
      } else {
        const gr = W.ground(s.pos.x, s.pos.z, P.r * 0.62, oldY, 0.08);
        if (gr.col && s.pos.y <= gr.y) {
          s.pos.y = gr.y; const impact = -s.vel.y; s.vel.y = 0; s.mode = 'ground'; s.groundCol = gr.col;
          if (impact > 6) { s.land = Math.min(1, impact / 16); sfx.land(Math.min(1, impact / 18)); }
          else sfx.step(0.5);
        }
      }
      if (s.mode === 'air') tryGrab();
    } else {
      const gr = W.ground(s.pos.x, s.pos.z, P.r * 0.62, s.pos.y, P.step);
      if (gr.col && gr.y >= s.pos.y - P.snap) { s.pos.y = gr.y; s.groundCol = gr.col; s.vel.y = 0; s.lastGround.copy(s.pos); }
      else {
        if (s.groundCol) { s.vel.x += s.groundCol.delta.x / dt; s.vel.z += s.groundCol.delta.z / dt; }
        s.mode = 'air'; s.coyote = P.coyote; s.groundCol = null; s.vel.y = 0; s.airT = 0;
      }
    }
  }

  let stepAcc = 0;
  function update(dt, inp, camFwd, camRight) {
    s.grabCD -= dt;
    s.land = Math.max(0, s.land - dt * 3.5);
    if (s.mode === 'dead') { s.deadT += dt; return; }
    // 出手
    if (inp.strike && s.strike < 0 && (s.mode === 'ground' || s.mode === 'air')) { s.strike = 0; s.struck = false; sfx.swish(); }
    if (s.strike >= 0) {
      s.strike += dt / 0.46;
      if (!s.struck && s.strike > 0.42) { s.struck = true; const b = level.strike(s.pos, facing().clone()); if (b && b.id !== 'block') sfx.bell(b.id === 'gate' ? 0.82 : 1); }
      if (s.strike >= 1) s.strike = -1;
    }
    if (s.mode === 'ground' || s.mode === 'air') groundAir(dt, inp, camFwd, camRight);
    else if (s.mode === 'hang') hangUpdate(dt, inp, camRight);
    else if (s.mode === 'hop' || s.mode === 'mantle') tweenUpdate(dt);
    // 腳步聲
    if (s.mode === 'ground') {
      const sp = Math.hypot(s.vel.x, s.vel.z);
      stepAcc += sp * dt;
      if (stepAcc > 0.72) { stepAcc = 0; sfx.step(Math.min(1, sp / P.run)); }
    }
  }

  function teleport(p, yaw) {
    s.pos.copy(p); s.vel.set(0, 0, 0); s.yaw = yaw ?? s.yaw; s.mode = 'ground'; s.ledge = null; s.tween = null; s.groundCol = null; s.strike = -1;
    const gr = W.ground(p.x, p.z, P.r * 0.62, p.y + 0.5, 0.5);
    if (gr.col) s.pos.y = gr.y; else s.mode = 'air';
  }

  return { s, update, teleport, P };
}
