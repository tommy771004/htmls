// 真實地圖的車流與行人：車沿 OSM 道路圖行駛（靠右、單行道只走順向、路口隨機選路偏好直行），
// 跟車、在有號誌的路口停止線前等紅燈（燈號與畫面上的號誌同一套 signalState）；行人沿人行道走，到路口換一條路。
// 對外介面與 traffic.js 的 Traffic 相同（cars、peds、t、enabled、update）。
import { CAR_COLORS, CAR_MODELS } from './world.js';
import { RC, segDist } from './osm.js';
import { clamp, mulberry32, pick, wrapAngle } from './math.js';
import { signalState } from './traffic.js';

// 車道圖：可行車道路在路口（三條以上的車道相接）切成邊
function buildGraph(D) {
  if (D.graph) return D.graph;
  const N = D.N;
  const drive = (r) => RC[r.cls].drive && r.cls <= 6;
  const deg = new Map();
  for (const r of D.roads) {
    if (!drive(r)) continue;
    r.idx.forEach((n, k) => deg.set(n, (deg.get(n) || 0) + (k === 0 || k === r.idx.length - 1 ? 1 : 2)));
  }
  const edges = [];
  const out = new Map();
  const addOut = (n, e) => {
    if (!out.has(n)) out.set(n, []);
    out.get(n).push(e);
  };
  for (const r of D.roads) {
    if (!drive(r)) continue;
    let a = 0;
    for (let k = 1; k < r.idx.length; k++) {
      const n = r.idx[k];
      if (k === r.idx.length - 1 || deg.get(n) >= 3) {
        const pts = [];
        const cum = [0];
        for (let q = a; q <= k; q++) {
          const m = r.idx[q];
          pts.push(N[m * 2], N[m * 2 + 1]);
          if (q > a) cum.push(cum[cum.length - 1] + Math.hypot(pts[pts.length - 2] - pts[pts.length - 4], pts[pts.length - 1] - pts[pts.length - 3]));
        }
        const len = cum[cum.length - 1];
        if (len > 1) {
          const e = { i: edges.length, r, pts, cum, len, from: r.idx[a], to: n, mx: (pts[0] + pts[pts.length - 2]) / 2, mz: (pts[1] + pts[pts.length - 1]) / 2 };
          edges.push(e);
          addOut(e.from, { e, dir: 1 });
          if (!r.oneway) addOut(e.to, { e, dir: -1 });
        }
        a = k;
      }
    }
  }
  // 路口半寬與號誌（號誌節點在路口 18 公尺內都算）
  const jr = new Map();
  const sig = new Set();
  const sigPts = [...D.sig].map((n) => [N[n * 2], N[n * 2 + 1]]);
  for (const [n, d] of deg) {
    if (d < 3) continue;
    let m = 0;
    for (const [r] of D.nodeRoads.get(n) || []) if (drive(r)) m = Math.max(m, r.w / 2);
    jr.set(n, m);
    const x = N[n * 2];
    const z = N[n * 2 + 1];
    if (sigPts.some(([sx, sz]) => Math.abs(sx - x) < 18 && Math.abs(sz - z) < 18)) sig.add(n);
  }
  D.graph = { edges, out, jr, sig };
  return D.graph;
}

// 折線上距起點 u 的位置與切線
function along(e, u) {
  const c = e.cum;
  let k = 1;
  while (k < c.length - 1 && c[k] < u) k++;
  const t = clamp((u - c[k - 1]) / Math.max(1e-6, c[k] - c[k - 1]), 0, 1);
  const p = e.pts;
  const ax = p[(k - 1) * 2];
  const az = p[(k - 1) * 2 + 1];
  const bx = p[k * 2];
  const bz = p[k * 2 + 1];
  const L = Math.hypot(bx - ax, bz - az) || 1;
  return { x: ax + (bx - ax) * t, z: az + (bz - az) * t, tx: (bx - ax) / L, tz: (bz - az) / L };
}

export class OsmTraffic {
  constructor(world, seed = 7) {
    this.world = world;
    this.rnd = mulberry32(seed);
    this.cars = [];
    this.peds = [];
    this.nextId = 1;
    this.t = 0;
    this.G = buildGraph(world.osm);
    this.enabled = world.K.traffic > 0 && this.G.edges.length > 0;
  }

  laneOff(e, dir, lane) {
    const r = e.r;
    const lanes = Math.max(1, r.lanes || Math.round(r.w / 3.4));
    if (r.oneway) return -r.w / 2 + (r.w / lanes) * (lane + 0.5);
    const per = Math.max(1, Math.floor(lanes / 2));
    return Math.min(r.w / 2 - 1.2, (r.w / 2 / per) * (lane + 0.5));
  }
  lanesFor(e) {
    const r = e.r;
    const lanes = Math.max(1, r.lanes || Math.round(r.w / 3.4));
    return r.oneway ? lanes : Math.max(1, Math.floor(lanes / 2));
  }

  place(c) {
    const e = c.e;
    const u = c.dir > 0 ? c.s : e.len - c.s;
    const a = along(e, u);
    const dx = a.tx * c.dir;
    const dz = a.tz * c.dir;
    const off = this.laneOff(e, c.dir, c.lane);
    c.x = a.x - dz * off;
    c.z = a.z + dx * off;
    c.hx = dx;
    c.hz = dz;
    return Math.atan2(dx, -dz);
  }

  spawnCar(px, pz, far) {
    const r = this.rnd;
    const E = this.G.edges;
    for (let tries = 0; tries < 12; tries++) {
      const e = E[Math.floor(r() * E.length)];
      const d = Math.hypot(e.mx - px, e.mz - pz);
      if (d > (far ? 260 : 200) || d < (far ? 120 : 15)) continue;
      const dir = e.r.oneway || r() < 0.5 ? 1 : -1;
      const c = { id: this.nextId++, e, dir, s: r() * e.len, lane: Math.floor(r() * this.lanesFor(e)), speed: 0, wheel: 0, brake: false, x: 0, z: 0, y: 0, yaw: 0 };
      c.yaw = this.place(c);
      if (Math.hypot(c.x - px, c.z - pz) < 14) continue;
      if (this.cars.some((o) => Math.hypot(o.x - c.x, o.z - c.z) < 9)) continue;
      const W = this.world;
      const taxi = W.kind === 'metro' && r() < 0.42;
      c.model = taxi ? 'taxi' : pick(r, CAR_MODELS.filter((m) => m !== 'taxi'));
      c.color = taxi ? 0xf4c531 : pick(r, CAR_COLORS);
      c.cruise = RC[e.r.cls].speed * (0.8 + r() * 0.3);
      c.speed = c.cruise * 0.7;
      c.y = W.groundAt(c.x, c.z);
      this.cars.push(c);
      return;
    }
  }

  spawnPed(px, pz) {
    const W = this.world;
    const r = this.rnd;
    const ang = r() * Math.PI * 2;
    const dist = 12 + r() * 80;
    const x = px + Math.cos(ang) * dist;
    const z = pz + Math.sin(ang) * dist;
    const h = W.roadAt(x, z, 12, (rr) => rr.cls !== 0 && rr.cls !== 7 && (RC[rr.cls].walk > 0 || rr.cls >= 8));
    if (!h) return;
    const p = {
      id: this.nextId++, r: h.p.r, k: h.p.k, t: 0, dir: r() < 0.5 ? 1 : -1, side: r() < 0.5 ? 1 : -1, speed: 1.1 + r() * 0.5,
      x: 0, z: 0, y: 0, yaw: 0, phase: r() * 10, look: Math.floor(r() * 6), stopped: false,
    };
    // 線段上的參數
    const D = W.osm;
    const a = p.r.idx[p.k];
    const b = p.r.idx[p.k + 1];
    p.t = segDist(x, z, D.N[a * 2], D.N[a * 2 + 1], D.N[b * 2], D.N[b * 2 + 1]).t;
    this.placePed(p);
    if (Math.hypot(p.x - px, p.z - pz) < 6 || W.buildingAt(p.x, p.z, 0.3)) return;
    this.peds.push(p);
  }

  pedOff(r) {
    const walk = RC[r.cls].walk;
    return walk > 0 ? r.w / 2 + walk * (this.world.kind === 'metro' ? 0.9 : 0.55) : r.cls >= 8 ? 0.6 : r.w / 2 - 0.6;
  }
  placePed(p) {
    const D = this.world.osm;
    const a = p.r.idx[p.k];
    const b = p.r.idx[p.k + 1];
    const ax = D.N[a * 2];
    const az = D.N[a * 2 + 1];
    const bx = D.N[b * 2];
    const bz = D.N[b * 2 + 1];
    const L = Math.hypot(bx - ax, bz - az) || 1;
    const dx = ((bx - ax) / L) * p.dir;
    const dz = ((bz - az) / L) * p.dir;
    const off = this.pedOff(p.r) * p.side;
    p.x = ax + (bx - ax) * p.t - dz * off * p.dir;
    p.z = az + (bz - az) * p.t + dx * off * p.dir;
    p.yaw = Math.atan2(dx, -dz);
    p.segLen = L;
  }

  update(dt, player) {
    this.t += dt;
    if (!this.enabled) {
      this.cars.length = 0;
      return;
    }
    const K = this.world.K;
    const px = player.x;
    const pz = player.z;
    for (let k = 0; k < 3 && this.cars.length < K.traffic; k++) this.spawnCar(px, pz, this.cars.length > K.traffic * 0.6);
    for (let k = 0; k < 3 && this.peds.length < K.peds; k++) this.spawnPed(px, pz);
    this.cars = this.cars.filter((c) => Math.hypot(c.x - px, c.z - pz) < 325);
    this.peds = this.peds.filter((p) => Math.hypot(p.x - px, p.z - pz) < 140);
    for (const c of this.cars) this.stepCar(c, dt, player);
    if (this.cars.some((c) => c.gone)) this.cars = this.cars.filter((c) => !c.gone);
    for (const p of this.peds) this.stepPed(p, dt, player);
  }

  stepCar(c, dt, player) {
    const W = this.world;
    const G = this.G;
    let target = c.cruise;
    const fx = c.hx;
    const fz = c.hz;
    let gap = 99;
    for (const o of this.cars) {
      if (o === c) continue;
      const dx = o.x - c.x;
      const dz = o.z - c.z;
      const ahead = dx * fx + dz * fz;
      const side = Math.abs(dx * fz - dz * fx);
      if (ahead > 0 && ahead < 30 && side < 1.6) gap = Math.min(gap, ahead);
    }
    if (player && player.mode !== 'plane') {
      const dx = player.x - c.x;
      const dz = player.z - c.z;
      const ahead = dx * fx + dz * fz;
      const side = Math.abs(dx * fz - dz * fx);
      if (ahead > 0 && side < 2.0 && Math.abs(player.y - c.y) < 3) gap = Math.min(gap, ahead - 1);
    }
    if (gap < 18) target = Math.min(target, Math.max(0, (gap - 7) * 1.2));
    // 號誌路口：停止線在路口半寬外 3 公尺
    const e = c.e;
    const endN = c.dir > 0 ? e.to : e.from;
    if (G.sig.has(endN)) {
      const toStop = e.len - c.s - ((G.jr.get(endN) || 4) + 3);
      const axis = Math.abs(fx) > Math.abs(fz) ? 'x' : 'z';
      c.waiting = signalState(axis, this.t) !== 'green' && toStop > 0 && toStop < 22;
      if (c.waiting) target = Math.min(target, Math.max(0, toStop - 1) * 0.9);
    } else c.waiting = false;
    const acc = target > c.speed ? 3.2 : 7.5;
    c.speed += clamp(target - c.speed, -acc * dt, acc * dt);
    c.brake = target < c.speed - 0.5 || c.speed < 0.3;
    const ds = c.speed * dt;
    c.wheel += ds / 0.35;
    c.s += ds;
    // 到路口：選下一條邊（不迴轉，除非死路）
    let guard = 0;
    while (c.s >= c.e.len && guard++ < 4) {
      const node = c.dir > 0 ? c.e.to : c.e.from;
      const opts = (G.out.get(node) || []).filter((o) => o.e !== c.e);
      const extra = c.s - c.e.len;
      let next;
      if (!opts.length) next = c.e.r.oneway ? null : { e: c.e, dir: -c.dir };
      else {
        const hy = Math.atan2(c.hx, -c.hz);
        const scored = opts.map((o) => {
          const a0 = along(o.e, o.dir > 0 ? 0.5 : o.e.len - 0.5);
          return { o, turn: Math.abs(wrapAngle(Math.atan2(a0.tx * o.dir, -a0.tz * o.dir) - hy)) };
        });
        scored.sort((a, b) => a.turn - b.turn);
        next = this.rnd() < 0.55 || scored.length === 1 ? scored[0].o : pick(this.rnd, scored.slice(1)).o;
      }
      if (!next) {
        c.s = c.e.len;
        c.speed = 0;
        c.gone = true;
        break;
      }
      c.e = next.e;
      c.dir = next.dir;
      c.s = extra;
      c.lane = Math.min(c.lane, this.lanesFor(c.e) - 1);
      c.cruise = RC[c.e.r.cls].speed * (0.8 + this.rnd() * 0.3);
    }
    const yaw = this.place(c);
    c.yaw += wrapAngle(yaw - c.yaw) * Math.min(1, dt * 8);
    c.y = W.groundAt(c.x, c.z);
  }

  stepPed(p, dt, player) {
    const W = this.world;
    const D = W.osm;
    const blocked = player && Math.hypot(player.x - p.x, player.z - p.z) < 1.3;
    p.stopped = blocked;
    if (!blocked) {
      p.t += (p.dir * p.speed * dt) / (p.segLen || 1);
      if (p.t > 1 || p.t < 0) {
        const end = p.t > 1;
        const nextK = p.k + (end ? 1 : -1);
        if (nextK >= 0 && nextK < p.r.idx.length - 1) {
          p.k = nextK;
          p.t = end ? 0 : 1;
        } else {
          // 道路盡頭：換一條相接的路，沒有就迴轉
          const node = end ? p.r.idx[p.r.idx.length - 1] : p.r.idx[0];
          const opts = (D.nodeRoads.get(node) || []).filter(([r]) => r !== p.r && r.cls !== 0 && r.cls !== 7 && (RC[r.cls].walk > 0 || r.cls >= 8));
          if (opts.length && this.rnd() < 0.85) {
            const [r, at] = pick(this.rnd, opts);
            const ox = p.x;
            const oz = p.z;
            p.r = r;
            if (at < r.idx.length - 1 && (at === 0 || this.rnd() < 0.5)) {
              p.k = at;
              p.t = 0;
              p.dir = 1;
            } else {
              p.k = at - 1;
              p.t = 1;
              p.dir = -1;
            }
            // 換路後留在原本那一側的人行道
            this.placePed(p);
            const d0 = Math.hypot(p.x - ox, p.z - oz);
            p.side = -p.side;
            this.placePed(p);
            if (Math.hypot(p.x - ox, p.z - oz) > d0) p.side = -p.side;
          } else {
            p.dir = -p.dir;
            p.t = clamp(p.t, 0, 1);
          }
        }
      }
      this.placePed(p);
    }
    p.y = W.groundAt(p.x, p.z);
    p.phase += dt * p.speed * (p.stopped ? 0 : 1);
  }
}
