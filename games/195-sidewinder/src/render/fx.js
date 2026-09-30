// 特效模擬（與繪圖後端無關）：揚塵、泥塊、濺水、水圈、落地爆土、氮氣火焰、道具閃光，以及胎痕圖層。
// 事件大多從狀態變化推得（events() 讀了就清，留給 UI／音效）；opts.events 若有給，另外補撞牆與互撞。
import { readTruck, readPickups, SURF } from '../core.js';
import { srgbToLinear } from './math.js';

const MAX = 2400;
const STRIDE = 12; // 給 GPU：x y z size | r g b a（線性、預乘）| kind rot 0 0
export const KIND = { PUFF: 0, BLOB: 1, RING: 2, FLAME: 3, SPARK: 4 };

const WHEELS = [[0.85, -0.78], [0.85, 0.78], [-0.85, -0.78], [-0.85, 0.78]]; // FL FR RL RR（車身座標 x, z）
const MARK_PX = 8; // 胎痕圖層每公尺像素

function rnd(a, b) { return a + Math.random() * (b - a); }

// 從地面貼圖取樣顏色（線性），給揚塵用
function makeGroundSampler(track, albedo) {
  let data = null, w = 0, h = 0;
  try {
    w = Math.min(albedo.width, 512); h = Math.min(albedo.height, 512);
    const c = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : Object.assign(document.createElement('canvas'), { width: w, height: h });
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(albedo, 0, 0, w, h);
    data = g.getImageData(0, 0, w, h).data;
  } catch { data = null; }
  const fallback = [0.42, 0.22, 0.12];
  return (x, z) => {
    if (!data) return fallback;
    const u = Math.min(Math.max((x - track.originX) / track.width, 0), 0.999);
    const v = Math.min(Math.max((z - track.originZ) / track.depth, 0), 0.999);
    const k = ((v * h | 0) * w + (u * w | 0)) * 4;
    return [srgbToLinear(data[k] / 255), srgbToLinear(data[k + 1] / 255), srgbToLinear(data[k + 2] / 255)];
  };
}

export function createFx(track, albedo, meshes) {
  const P = {
    x: new Float32Array(MAX), y: new Float32Array(MAX), z: new Float32Array(MAX),
    vx: new Float32Array(MAX), vy: new Float32Array(MAX), vz: new Float32Array(MAX),
    age: new Float32Array(MAX), life: new Float32Array(MAX),
    s0: new Float32Array(MAX), s1: new Float32Array(MAX),
    r: new Float32Array(MAX), g: new Float32Array(MAX), b: new Float32Array(MAX), a: new Float32Array(MAX),
    kind: new Uint8Array(MAX), drag: new Float32Array(MAX), grav: new Float32Array(MAX),
    rot: new Float32Array(MAX), spin: new Float32Array(MAX), splat: new Uint8Array(MAX),
  };
  let head = 0;
  const out = new Float32Array(MAX * STRIDE);
  const ground = makeGroundSampler(track, albedo);
  const body = meshes && meshes[0];
  const rearX = body ? body.bbox.min[0] + 0.05 : -1.2;
  const exhY = body ? body.bbox.min[1] + (body.bbox.max[1] - body.bbox.min[1]) * 0.45 : 0.5;

  // 胎痕圖層
  const mw = Math.max(2, Math.round(track.width * MARK_PX)), mh = Math.max(2, Math.round(track.depth * MARK_PX));
  const marks = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(mw, mh) : Object.assign(document.createElement('canvas'), { width: mw, height: mh });
  const mg = marks.getContext('2d');
  mg.lineCap = 'round';
  let marksDirty = true, fadeT = 0;

  const prev = [0, 1, 2, 3].map(() => ({ air: false, vy: 0, surf: -1, wheels: null, ringT: 0, dustAcc: 0, mudAcc: 0, sprayAcc: 0, flameAcc: 0, ok: false }));
  let prevPick = null;
  let pickT = 0;
  let time = 0, lastPhase = -1, lastTime = 0;

  function spawn(o) {
    const i = head; head = (head + 1) % MAX;
    P.x[i] = o.x; P.y[i] = o.y; P.z[i] = o.z;
    P.vx[i] = o.vx || 0; P.vy[i] = o.vy || 0; P.vz[i] = o.vz || 0;
    P.age[i] = 0; P.life[i] = o.life;
    P.s0[i] = o.s0; P.s1[i] = o.s1 ?? o.s0;
    P.r[i] = o.c[0]; P.g[i] = o.c[1]; P.b[i] = o.c[2]; P.a[i] = o.a;
    P.kind[i] = o.kind || 0; P.drag[i] = o.drag ?? 1.5; P.grav[i] = o.grav ?? 0;
    P.rot[i] = Math.random() * 6.283; P.spin[i] = o.spin ?? rnd(-1, 1);
    P.splat[i] = o.splat || 0;
  }

  const dustCol = (x, z, lift = 0.35) => {
    const g = ground(x, z);
    lift = Math.min(1, lift * 1.4);
    return [g[0] + (0.66 - g[0]) * lift, g[1] + (0.54 - g[1]) * lift, g[2] + (0.4 - g[2]) * lift];
  };

  function burst(x, y, z, n, power, col, opts = {}) {
    for (let k = 0; k < n; k++) {
      const a = Math.random() * 6.283, sp = rnd(0.4, 1) * power;
      spawn({ x: x + Math.cos(a) * 0.6, y: y + 0.2, z: z + Math.sin(a) * 0.6, vx: Math.cos(a) * sp, vy: rnd(0.5, 1.6) * (opts.up ?? 1), vz: Math.sin(a) * sp,
        life: rnd(0.9, 1.7), s0: rnd(0.7, 1.1), s1: rnd(2.4, 3.6) * (opts.grow ?? 1), c: col, a: opts.a ?? 0.5, kind: KIND.PUFF, drag: 2.2 });
    }
  }

  function clods(x, y, z, n, power, col, splat = 1) {
    for (let k = 0; k < n; k++) {
      const a = Math.random() * 6.283, sp = rnd(0.3, 1) * power;
      spawn({ x, y: y + 0.3, z, vx: Math.cos(a) * sp, vy: rnd(2.5, 5.5), vz: Math.sin(a) * sp, life: 1.6, s0: rnd(0.1, 0.2), c: col, a: 1, kind: KIND.BLOB, drag: 0.3, grav: 14, splat });
    }
  }

  function stampMark(x0, z0, x1, z1, rgba, w) {
    mg.strokeStyle = rgba;
    mg.lineWidth = w * MARK_PX;
    mg.beginPath();
    mg.moveTo((x0 - track.originX) * MARK_PX, (z0 - track.originZ) * MARK_PX);
    mg.lineTo((x1 - track.originX) * MARK_PX, (z1 - track.originZ) * MARK_PX);
    mg.stroke();
    marksDirty = true;
  }

  function splatMark(x, z, r, rgba) {
    mg.fillStyle = rgba;
    mg.beginPath();
    mg.ellipse((x - track.originX) * MARK_PX, (z - track.originZ) * MARK_PX, r * MARK_PX, r * 0.7 * MARK_PX, Math.random() * 3, 0, 6.283);
    mg.fill();
    marksDirty = true;
  }

  const MUD_LIN = [0.075, 0.042, 0.022];
  const WATER_LIN = [0.52, 0.56, 0.52];

  function truckFx(k, t, dt, attract) {
    const pv = prev[k];
    const cy = Math.cos(t.yaw), sy = Math.sin(t.yaw);
    const fwd = [cy, sy], right = [-sy, cy];
    const speed = Math.abs(t.speed);
    const wheels = WHEELS.map(([wx, wz]) => [t.x + cy * wx - sy * wz, t.z + sy * wx + cy * wz]);
    const surf = t.surface | 0;
    const back = -Math.sign(t.speed || 1);

    if (pv.ok) {
      // 落地爆土
      if (pv.air && !t.airborne) {
        const imp = Math.min(1, Math.abs(pv.vy) / 9);
        const col = dustCol(t.x, t.z, 0.4);
        const y = track.heightAt(t.x, t.z);
        if (surf === SURF.WATER) {
          splash(t.x, y, t.z, 10 + imp * 30, 3 + imp * 4);
        } else if (surf === SURF.MUD) {
          clods(t.x, y, t.z, 8 + imp * 20, 3 + imp * 4, MUD_LIN, 1);
          burst(t.x, y, t.z, 3, 2, dustCol(t.x, t.z, 0.2), { a: 0.25 });
        } else {
          burst(t.x, y, t.z, 10 + imp * 24, 2.5 + imp * 6, col, { a: 0.5 + imp * 0.35, grow: 1 + imp * 0.9 });
          clods(t.x, y, t.z, 4 + imp * 10, 2 + imp * 3.5, [col[0] * 0.55, col[1] * 0.5, col[2] * 0.45], 0);
          // 落地的一圈暗土：看得出落點，衝擊越大越大
          if (imp > 0.15) spawn({ x: t.x, y: y + 0.05, z: t.z, life: 0.55, s0: 0.8, s1: 2.4 + imp * 2.6, c: [col[0] * 0.35, col[1] * 0.3, col[2] * 0.26], a: 0.35 + imp * 0.25, kind: KIND.RING, drag: 0 });
        }
      }
      // 衝進水坑
      if (surf === SURF.WATER && pv.surf !== SURF.WATER && speed > 2 && !t.airborne) {
        splash(t.x, track.heightAt(t.x, t.z), t.z, 12 + speed * 1.2, 2 + speed * 0.25);
      }
    }

    if (!t.airborne && speed > 0.6) {
      const rearL = wheels[2], rearR = wheels[3];
      if (surf === SURF.DIRT || surf === SURF.LOOSE || surf === SURF.JUMP || surf === SURF.RAMP || surf === SURF.INFIELD) {
        const base = surf === SURF.LOOSE ? 1.5 : surf === SURF.INFIELD ? 0.35 : 1;
        pv.dustAcc += dt * base * (speed / 12) * (0.5 + t.slip * 2.2) * 20;
        while (pv.dustAcc >= 1) {
          pv.dustAcc -= 1;
          const w = Math.random() < 0.5 ? rearL : rearR;
          const col = dustCol(w[0], w[1], 0.38);
          const sp = speed * 0.18;
          spawn({ x: w[0] + fwd[0] * back * 0.3, y: track.heightAt(w[0], w[1]) + 0.25, z: w[1] + fwd[1] * back * 0.3,
            vx: fwd[0] * back * sp + right[0] * rnd(-1, 1) + rnd(-0.4, 0.4), vy: rnd(0.4, 1.3), vz: fwd[1] * back * sp + right[1] * rnd(-1, 1) + rnd(-0.4, 0.4),
            life: rnd(1.1, 2.1), s0: rnd(0.6, 0.9), s1: rnd(2.6, 4.2) * (0.7 + Math.min(speed, 20) / 40), c: col, a: rnd(0.38, 0.55) * (0.7 + t.slip * 0.5), kind: KIND.PUFF, drag: 1.8 });
        }
      } else if (surf === SURF.MUD) {
        pv.mudAcc += dt * (speed / 10) * (0.6 + t.slip * 2) * 22;
        while (pv.mudAcc >= 1) {
          pv.mudAcc -= 1;
          const w = Math.random() < 0.5 ? rearL : rearR;
          const sp = speed * rnd(0.2, 0.45);
          spawn({ x: w[0], y: track.heightAt(w[0], w[1]) + 0.3, z: w[1],
            vx: fwd[0] * back * sp + right[0] * rnd(-1.5, 1.5), vy: rnd(2, 4.5), vz: fwd[1] * back * sp + right[1] * rnd(-1.5, 1.5),
            life: 1.4, s0: rnd(0.09, 0.2), c: [MUD_LIN[0] * rnd(0.8, 1.4), MUD_LIN[1] * rnd(0.8, 1.3), MUD_LIN[2]], a: 1, kind: KIND.BLOB, drag: 0.4, grav: 14, splat: 1 });
        }
      } else if (surf === SURF.WATER) {
        pv.sprayAcc += dt * (speed / 8) * 30;
        while (pv.sprayAcc >= 1) {
          pv.sprayAcc -= 1;
          const w = wheels[(Math.random() * 4) | 0];
          const sp = speed * rnd(0.15, 0.4);
          const side = Math.random() < 0.5 ? -1 : 1;
          spawn({ x: w[0], y: track.heightAt(w[0], w[1]) + 0.2, z: w[1],
            vx: fwd[0] * back * sp + right[0] * side * rnd(1, 3), vy: rnd(1.5, 4), vz: fwd[1] * back * sp + right[1] * side * rnd(1, 3),
            life: 0.9, s0: rnd(0.06, 0.13), c: WATER_LIN, a: 0.85, kind: KIND.BLOB, drag: 0.5, grav: 12 });
        }
        pv.ringT -= dt;
        if (pv.ringT <= 0) {
          pv.ringT = 0.3;
          // 水圈只在「那顆輪子自己在水裡」時出現，小而短命，不會一圈圈擴散到岸上的土
          for (const w of [rearL, rearR]) {
            if (track.surfaceAt(w[0], w[1]) !== SURF.WATER) continue;
            spawn({ x: w[0], y: track.heightAt(w[0], w[1]) + 0.04, z: w[1], life: 0.7, s0: 0.5, s1: 1.6, c: [0.72, 0.75, 0.7], a: 0.3, kind: KIND.RING, drag: 0 });
          }
          if (speed > 6) {
            spawn({ x: t.x - fwd[0] * back * -1.4, y: track.heightAt(t.x, t.z) + 0.5, z: t.z - fwd[1] * back * -1.4, vx: fwd[0] * back * 1.5, vy: 0.6, vz: fwd[1] * back * 1.5, life: 0.8, s0: 1.0, s1: 2.8, c: [0.78, 0.8, 0.78], a: 0.28, kind: KIND.PUFF, drag: 2 });
          }
        }
      }

      // 胎痕
      if (pv.wheels) {
        for (let i = 0; i < 4; i++) {
          const a = pv.wheels[i], b = wheels[i];
          const d2 = (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;
          if (d2 > 9 || d2 < 1e-4) continue; // 瞬移或原地
          const front = i < 2;
          let rgba = null, w = 0.3;
          if (surf === SURF.MUD) { rgba = `rgba(34,20,11,${front ? 0.3 : 0.5})`; w = 0.38; }
          else if (surf === SURF.LOOSE) rgba = `rgba(70,44,26,${0.14 + t.slip * 0.3})`;
          else if (surf === SURF.INFIELD) rgba = `rgba(52,58,30,${0.2 + t.slip * 0.2})`;
          else if (surf === SURF.DIRT || surf === SURF.JUMP || surf === SURF.RAMP) {
            const a2 = 0.035 + t.slip * 0.45;
            if (a2 > 0.05 || !front) rgba = `rgba(52,28,16,${a2})`;
          }
          if (rgba) stampMark(a[0], a[1], b[0], b[1], rgba, w);
        }
      }
    }

    // 氮氣火焰
    if (t.nitroTime > 0) {
      pv.flameAcc += dt * 90;
      const ex = t.x + cy * rearX, ez = t.z + sy * rearX;
      const ey = t.y + exhY;
      while (pv.flameAcc >= 1) {
        pv.flameAcc -= 1;
        const sp = rnd(4, 9);
        const hot = Math.random();
        spawn({ x: ex + right[0] * rnd(-0.3, 0.3), y: ey + rnd(-0.1, 0.1), z: ez + right[1] * rnd(-0.3, 0.3),
          vx: -fwd[0] * sp + (t.speed * fwd[0]) * 0.8, vy: rnd(0, 0.8), vz: -fwd[1] * sp + (t.speed * fwd[1]) * 0.8,
          life: rnd(0.2, 0.35), s0: rnd(1.2, 1.6), s1: 0.25, c: hot < 0.3 ? [1.6, 1.3, 0.9] : [1.4, 0.45, 0.08], a: 0, kind: KIND.FLAME, drag: 3 });
        // 排氣口一團短命的大光暈（加法混色），遠看也認得出在噴氮氣
        if (Math.random() < 0.25) {
          spawn({ x: ex - fwd[0] * 0.4, y: ey, z: ez - fwd[1] * 0.4, vx: t.speed * fwd[0] * 0.9, vz: t.speed * fwd[1] * 0.9,
            life: 0.12, s0: 2.6, s1: 1.8, c: [0.9, 0.45, 0.12], a: 0, kind: KIND.FLAME, drag: 0 });
        }
        if (Math.random() < 0.18) {
          spawn({ x: ex, y: ey, z: ez, vx: -fwd[0] * 2, vy: 0.8, vz: -fwd[1] * 2, life: 0.9, s0: 0.4, s1: 1.6, c: [0.16, 0.14, 0.13], a: 0.25, kind: KIND.PUFF, drag: 2 });
        }
      }
    }

    pv.air = t.airborne;
    if (t.airborne) pv.vy = t.vy; else pv.vy = 0;
    pv.surf = surf;
    pv.wheels = t.airborne ? null : wheels;
    pv.ok = true;
  }

  function splash(x, y, z, n, power) {
    for (let k = 0; k < n; k++) {
      const a = Math.random() * 6.283, sp = rnd(0.3, 1) * power;
      spawn({ x: x + Math.cos(a) * 0.8, y: y + 0.2, z: z + Math.sin(a) * 0.8, vx: Math.cos(a) * sp, vy: rnd(3, 6.5), vz: Math.sin(a) * sp, life: 1.2, s0: rnd(0.07, 0.16), c: WATER_LIN, a: 0.9, kind: KIND.BLOB, drag: 0.4, grav: 12 });
    }
    for (let k = 0; k < 2; k++) spawn({ x, y: y + 0.05, z, life: 0.8 + k * 0.25, s0: 0.7, s1: 2.2 + k * 0.9, c: [0.75, 0.78, 0.74], a: 0.4, kind: KIND.RING, drag: 0 });
    for (let k = 0; k < 4; k++) spawn({ x: x + rnd(-1, 1), y: y + 0.4, z: z + rnd(-1, 1), vy: rnd(0.5, 1.5), life: 0.8, s0: 0.8, s1: 2.4, c: [0.8, 0.82, 0.8], a: 0.3, kind: KIND.PUFF, drag: 2 });
  }

  function onEvent(e, trucks) {
    const t = trucks[e.truck | 0];
    if (!t) return;
    if (e.type === 8) { // 撞牆
      const f = [Math.cos(t.yaw), Math.sin(t.yaw)];
      const x = t.x + f[0] * 1.2, z = t.z + f[1] * 1.2, y = track.heightAt(x, z);
      const col = dustCol(x, z, 0.45);
      burst(x, y, z, 4 + e.a * 10, 2 + e.a * 3, col, { a: 0.45 });
      clods(x, y, z, 2 + e.a * 6, 2 + e.a * 3, [col[0] * 0.5, col[1] * 0.45, col[2] * 0.4], 0);
    } else if (e.type === 7) { // 卡車互撞
      const o = trucks[e.b | 0] || t;
      const x = (t.x + o.x) / 2, z = (t.z + o.z) / 2, y = (t.y + o.y) / 2 + 0.3;
      for (let k = 0; k < 6 + e.a * 14; k++) {
        const a = Math.random() * 6.283, sp = rnd(2, 7);
        spawn({ x, y, z, vx: Math.cos(a) * sp, vy: rnd(1, 4), vz: Math.sin(a) * sp, life: rnd(0.2, 0.45), s0: 0.14, s1: 0.04, c: [2.2, 1.5, 0.6], a: 0, kind: KIND.SPARK, drag: 1, grav: 9 });
      }
      burst(x, y - 0.3, z, 2 + e.a * 4, 2, dustCol(x, z, 0.45), { a: 0.35 });
    }
  }

  const fx = {
    marks, markPx: MARK_PX, count: 0, data: out, stride: STRIDE,
    get marksDirty() { return marksDirty; },
    clearMarksDirty() { marksDirty = false; },
    reset() {
      for (let i = 0; i < MAX; i++) P.life[i] = 0;
      mg.clearRect(0, 0, mw, mh);
      marksDirty = true;
      for (const p of prev) { p.ok = false; p.wheels = null; }
      prevPick = null;
    },
    update(core, dt, opts = {}) {
      dt = Math.min(dt, 0.1);
      time += dt;
      const s = core.state();
      // 新的一場（倒數開始或時間倒退）→ 清掉胎痕與粒子
      const ph = s[0], tm = s[1];
      if ((ph === 1 && lastPhase !== 1 && lastPhase !== -1) || tm < lastTime - 0.5) fx.reset();
      lastPhase = ph; lastTime = tm;
      const trucks = [0, 1, 2, 3].map((k) => readTruck(s, k));
      for (let k = 0; k < 4; k++) truckFx(k, trucks[k], dt, opts.attract);
      if (opts.events) for (const e of opts.events) onEvent(e, trucks);

      // 道具被撿走時閃一下
      const picks = readPickups(s);
      if (prevPick) {
        for (let i = 0; i < picks.length; i++) {
          const p = prevPick[i];
          if (p.active && !picks[i].active) {
            const y = track.heightAt(p.x, p.z) + 0.8;
            const col = p.type === 2 ? [2.0, 1.5, 0.5] : [2.0, 1.1, 0.4];
            for (let k = 0; k < 18; k++) {
              const a = Math.random() * 6.283, sp = rnd(1.5, 4);
              spawn({ x: p.x, y, z: p.z, vx: Math.cos(a) * sp, vy: rnd(1, 4), vz: Math.sin(a) * sp, life: rnd(0.4, 0.8), s0: 0.22, s1: 0.05, c: col, a: 0, kind: KIND.SPARK, drag: 2, grav: 4 });
            }
            spawn({ x: p.x, y: y - 0.75, z: p.z, life: 0.6, s0: 0.6, s1: 3.2, c: [1.2, 0.95, 0.5], a: 0, kind: KIND.RING, drag: 0 });
          }
        }
      }
      prevPick = picks;
      // 場上的道具：地面一圈圈淡淡擴散的光環，遠看也知道那是可以撿的東西
      pickT += dt;
      if (pickT > 0.7) {
        pickT = 0;
        for (const p of picks) {
          if (!p.active || !(p.type > 0)) continue;
          const col = p.type === 2 ? [0.9, 0.78, 0.4] : [0.9, 0.55, 0.25];
          spawn({ x: p.x, y: track.heightAt(p.x, p.z) + 0.06, z: p.z, life: 1.1, s0: 0.9, s1: 2.6, c: col, a: 0.45, kind: KIND.RING, drag: 0 });
        }
      }

      // 胎痕慢慢淡去
      fadeT += dt;
      if (fadeT > 1.5) {
        fadeT = 0;
        mg.globalCompositeOperation = 'destination-out';
        mg.fillStyle = 'rgba(0,0,0,0.07)';
        mg.fillRect(0, 0, mw, mh);
        mg.globalCompositeOperation = 'source-over';
        marksDirty = true;
      }

      // 粒子積分
      let n = 0;
      for (let i = 0; i < MAX; i++) {
        if (P.life[i] <= 0) continue;
        P.age[i] += dt;
        if (P.age[i] >= P.life[i]) { P.life[i] = 0; continue; }
        const dr = Math.exp(-P.drag[i] * dt);
        P.vx[i] *= dr; P.vz[i] *= dr; P.vy[i] = P.vy[i] * dr - P.grav[i] * dt;
        P.x[i] += P.vx[i] * dt; P.y[i] += P.vy[i] * dt; P.z[i] += P.vz[i] * dt;
        P.rot[i] += P.spin[i] * dt;
        if (P.grav[i] > 0) {
          const gy = track.heightAt(P.x[i], P.z[i]);
          if (P.y[i] < gy + 0.05) {
            if (P.splat[i]) splatMark(P.x[i], P.z[i], P.s0[i] * 1.4, 'rgba(38,22,12,0.55)');
            P.life[i] = 0;
            continue;
          }
        }
        const f = P.age[i] / P.life[i];
        const size = P.s0[i] + (P.s1[i] - P.s0[i]) * (P.kind[i] === KIND.PUFF ? 1 - (1 - f) * (1 - f) : f);
        // 淡入淡出
        let fade = P.kind[i] === KIND.PUFF ? Math.min(1, f * 8) * Math.pow(1 - f, 1.5) : 1 - f * f;
        if (P.kind[i] === KIND.RING) fade = (1 - f) * (1 - f);
        const o = n * STRIDE;
        out[o] = P.x[i]; out[o + 1] = P.y[i]; out[o + 2] = P.z[i]; out[o + 3] = size;
        const a = P.a[i] * fade;
        const add = P.kind[i] === KIND.FLAME || P.kind[i] === KIND.SPARK || P.a[i] === 0;
        const m = add ? fade : a; // 預乘
        out[o + 4] = P.r[i] * m; out[o + 5] = P.g[i] * m; out[o + 6] = P.b[i] * m; out[o + 7] = add ? 0 : a;
        out[o + 8] = P.kind[i]; out[o + 9] = P.rot[i]; out[o + 10] = f; out[o + 11] = 0;
        n++;
      }
      fx.count = n;
    },
  };
  return fx;
}
