// 行人與顧客 AI：從住宅、公車站、步道兩端出發，沿人行道與斑馬線走到店家或海灘，
// 消費（入店、躺椅、排隊買小吃、上船、衝浪）後離開。另有不消費的路人與海灘遊客維持街景熱鬧。
import * as THREE from 'three';
import { Builder, prng, T } from './geo.js';
import { BIZ, BIZ_BY_ID } from './data.js';
import { arrivalPerMin, capOf, serve, turnAway, isOpen, beachCrowd } from './econ.js';
import { CITY_LOTS, lotRect, BEACH, umbrellaSlot, STAIRS_X, BOAT_SLOTS, JET_SLOTS, groundY, SAND_Y, DECK_Y, RAIL_Z } from './layout.js';
import { SEA_Y } from './sea.js';
import { seatsOf, elevatorOf, F2Y } from './interior.js';

const TBOX = T.box;
const SHIRTS = ['#c8453c', '#2f7f8f', '#d9a63e', '#2d5a45', '#e07a5f', '#5f8790', '#f2e8cf', '#8a4f6e', '#3f7a8c', '#b5793a', '#f4f1e6', '#6a5a8a', '#e8c25a', '#7a9a5a'];
const SKINS = ['#f1c9a5', '#e0ac85', '#c68b62', '#a8704b', '#7d4f33', '#f5d5bc'];
const TOWELS = ['#c8453c', '#2f7f8f', '#d9a63e', '#e07a5f', '#5f8790', '#f2e8cf', '#c0607a'];

export const WALK_SPEED = 3.2; // 公尺／秒（1 倍速）

function bodyGeo() {
  const S = new Builder();
  S.add(TBOX, -0.11, 0, 0, 0.17, 0.82, 0.2, 0, '#6b6f78');
  S.add(TBOX, 0.11, 0, 0, 0.17, 0.82, 0.2, 0, '#6b6f78');
  S.add(TBOX, 0, 0.78, 0, 0.48, 0.66, 0.28, 0, '#ffffff');
  S.add(TBOX, -0.31, 0.84, 0, 0.12, 0.58, 0.15, 0, '#ffffff');
  S.add(TBOX, 0.31, 0.84, 0, 0.12, 0.58, 0.15, 0, '#ffffff');
  return S.geometry();
}
function headGeo() {
  const S = new Builder();
  S.ball(0, 1.43, 0, 0.21, '#ffffff', 1);
  S.ball(0, 1.6, -0.04, 0.2, '#5a4a40', 0, 0.6);
  return S.geometry();
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _c = new THREE.Color();

export function createPeople(scene, ctx) {
  const { graph, route, getState, sea, onIncome, onTurned, mobile } = ctx;
  const MAX = mobile ? 150 : 220;
  const rnd = prng(5150);
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const bodies = new THREE.InstancedMesh(bodyGeo(), mat, MAX);
  const heads = new THREE.InstancedMesh(headGeo(), mat, MAX);
  const towels = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.04, 1).translate(0, 0.02, 0), new THREE.MeshLambertMaterial(), 40);
  for (const m of [bodies, heads, towels]) {
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.frustumCulled = false;
    m.castShadow = m !== towels;
    m.receiveShadow = m === towels;
    m.count = 0;
    scene.add(m);
  }
  bodies.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 3), 3);

  // ── Lv3 城市商家的電梯 ──
  // 車廂依固定循環上下（下層停 2.5 秒 → 上行 3.5 秒 → 上層停 2.5 秒 → 下行 3.5 秒），客人在停靠時進出，最多 4 人
  const CITY_IDS = BIZ.filter((b) => b.zone === 'city').map((b) => b.id);
  const ELEV = Object.fromEntries(CITY_IDS.map((id, i) => [id, { ...elevatorOf(id), off: i * 2.7 }]));
  const ECAP = 4;
  let elevT = 0, clockMin = 0;
  const ease = (k) => k * k * (3 - 2 * k);
  function cabState(id) {
    const E = ELEV[id];
    const t = (elevT + E.off) % 12;
    let k, dir = 0;
    if (t < 2.5) k = 0;
    else if (t < 6) { k = ease((t - 2.5) / 3.5); dir = 1; }
    else if (t < 8.5) k = 1;
    else { k = 1 - ease((t - 8.5) / 3.5); dir = -1; }
    return { k, dir, y: E.y0 + (E.y1 - E.y0) * k, bottom: t < 2.3, top: t >= 6 && t < 8.3 };
  }
  const riders = (id) => { let n = 0; for (const a of A) if (a.on && a.ride === id) n++; return n; };
  const cabGeo = (() => {
    const S = new Builder();
    S.add(TBOX, 0, -0.12, 0, 2.0, 0.12, 2.0, 0, '#3a4144');
    S.add(TBOX, 0, 2.3, 0, 2.0, 0.14, 2.0, 0, '#e0b646');
    for (const [dx, dz] of [[-0.95, -0.95], [0.95, -0.95], [-0.95, 0.95], [0.95, 0.95]]) S.add(TBOX, dx, 0, dz, 0.08, 2.3, 0.08, 0, '#e0b646');
    S.add(TBOX, 0, 0.9, -0.95, 1.9, 0.06, 0.04, 0, '#e0b646');
    return S.geometry();
  })();
  const cabs = new THREE.InstancedMesh(cabGeo, mat, CITY_IDS.length);
  cabs.count = 0;
  cabs.frustumCulled = false;
  cabs.castShadow = true;
  scene.add(cabs);
  // 走到電梯口等車廂，進去後跟著車廂移動，到站後接著走 path
  function takeElevator(a, id, up, then) {
    const E = ELEV[id];
    a.pose = 'stand';
    a.yaw = Math.PI / 2;
    a.wait = 0;
    a.waitFor = () => {
      const c = cabState(id);
      if (!(up ? c.bottom : c.top) || riders(id) >= ECAP) return false;
      a.ride = id;
      const slot = riders(id) - 1;
      a.x = E.x + (slot % 2 ? 0.45 : -0.45);
      a.z = E.z + (slot > 1 ? 0.45 : -0.45);
      a.pose = 'ride';
      a.waitFor = () => {
        const cc = cabState(id);
        a.y = cc.y;
        if (!(up ? cc.top : cc.bottom)) return false;
        a.ride = null;
        a.fy = up ? E.y1 : null;
        then();
        return true;
      };
      return false;
    };
  }
  heads.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 3), 3);
  towels.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(40 * 3), 3);

  const A = Array.from({ length: MAX }, (_, i) => ({ i, on: false }));
  const occ = Object.fromEntries(BIZ.map((b) => [b.id, 0]));
  const acc = Object.fromEntries(BIZ.map((b) => [b.id, rnd()]));
  const umbBusy = new Array(12).fill(null);
  const seatCache = {}, seatBusy = {};
  const snackQ = [];
  let ambAcc = 0, beachAcc = 0;
  const counts = { city: 0, beach: 0, cust: 0 };

  const nodes = graph.nodes;
  const P = (id) => [nodes[id].x, nodes[id].z];
  const jitter = () => (rnd() - 0.5) * 1.2;
  const pathNodes = (a, b) => route(a, b).map((id) => {
    const [x, z] = P(id);
    return [x + jitter(), z + jitter()];
  });
  const nearestStair = (x) => {
    let best = 0;
    graph.stairs.forEach((id, k) => { if (Math.abs(nodes[id].x - x) < Math.abs(nodes[graph.stairs[best]].x - x)) best = k; });
    return graph.stairs[best];
  };
  const homes = [...graph.homes, ...graph.homes, graph.bus, graph.bus, ...graph.edges];
  function pickSpawn(tx, tz) {
    let best = -1, bd = Infinity;
    for (let k = 0; k < 3; k++) {
      const id = homes[Math.floor(rnd() * homes.length)];
      const d = Math.hypot(nodes[id].x - tx, nodes[id].z - tz);
      if (d < bd) { bd = d; best = id; }
    }
    return best;
  }

  function spawn(kind, from) {
    const a = A.find((q) => !q.on);
    if (!a) return null;
    const [x, z] = P(from);
    Object.assign(a, {
      on: true, kind, x, z, y: groundY(x, z), fy: null, ride: null, yaw: 0, path: [], pi: 0, pose: 'walk', timer: 0, biz: null, slot: -1, craft: null,
      surfer: null, from, phase: rnd() * 6, then: null, wait: 0, towel: -1, beach: false,
    });
    _c.set(SHIRTS[Math.floor(rnd() * SHIRTS.length)]);
    a.shirt = [_c.r, _c.g, _c.b];
    _c.set(SKINS[Math.floor(rnd() * SKINS.length)]);
    a.skin = [_c.r, _c.g, _c.b];
    return a;
  }
  const despawn = (a) => {
    if (a.towel >= 0) towelFree[a.towel] = true;
    a.on = false;
  };
  const go = (a, pts, then) => { a.path = pts; a.pi = 0; a.pose = 'walk'; a.then = then; };
  // 回家：從目前位置走回最近的路網點，再沿路網到出口
  function leave(a, viaStair = false) {
    a.pose = 'walk';
    const pts = [];
    let startNode;
    if (viaStair) {
      startNode = nearestStair(a.x);
      pts.push(P(startNode));
    } else {
      startNode = nearestNode(a.x, a.z);
    }
    const exit = pickSpawn(a.x, a.z);
    go(a, [...pts, ...pathNodes(startNode, exit === startNode ? graph.edges[0] : exit)], despawn);
  }
  function nearestNode(x, z) {
    let best = 0, bd = Infinity;
    nodes.forEach((n, i) => {
      const d = (n.x - x) ** 2 + (n.z - z) ** 2;
      if (d < bd) { bd = d; best = i; }
    });
    return best;
  }

  // ── 顧客流程 ──
  const flows = {
    city(a, id) {
      const r = lotRect(...CITY_LOTS[id]);
      const door = graph.doors[id];
      const dx = (r.x0 + r.x1) / 2;
      go(a, [...pathNodes(a.from, door), [dx, r.z1 + 0.4]], () => {
        const s = getState();
        if (!isOpen(BIZ_BY_ID[id], s.minute) || occ[id] >= capOf(s, id)) return reject(a, id);
        occ[id]++;
        a.biz = id;
        pay(a, id);
        // 剖面室內：走進店裡找空位坐下（或站在器材前），客滿的人在店裡看不到的地方
        const lv = s.biz[id].lv;
        const seats = seatCache[id + lv] || (seatCache[id + lv] = seatsOf(id, lv));
        const busy = seatBusy[id + lv] || (seatBusy[id + lv] = new Set());
        const free = seats.map((_, k) => k).filter((k) => !busy.has(k));
        const stay = BIZ_BY_ID[id].stay * (0.8 + rnd() * 0.4);
        const out = () => { a.biz = null; a.y = groundY(a.x, a.z); leave(a); };
        if (!free.length) {
          a.pose = 'hidden';
          a.timer = stay;
          a.then = () => { occ[id]--; out(); };
          return;
        }
        // 佔用容量的時間維持和以前一樣（付款起算 stay 分鐘）：路上與等電梯的時間從入座時間扣掉，離座就釋放
        const t0 = clockMin;
        const k = free[Math.floor(rnd() * free.length)];
        busy.add(k);
        const st = seats[k];
        const inZ = r.z1 - 1.4;
        const sit = () => {
          a.pose = st.pose;
          a.x = st.x; a.z = st.z; a.y = st.y; a.yaw = st.yaw;
          a.timer = Math.max(stay * 0.25, stay - (clockMin - t0));
          a.then = () => {
            busy.delete(k);
            occ[id]--;
            a.pose = 'walk';
            if (st.floor !== 2) return go(a, [[dx, st.z], [dx, inZ], [dx, r.z1 + 0.4]], out);
            // 從 F2 搭電梯下樓再出門
            const E = ELEV[id];
            go(a, [[dx, st.z], [dx, E.z], E.wait], () => takeElevator(a, id, false, () => go(a, [E.wait, [dx, inZ], [dx, r.z1 + 0.4]], out)));
          };
        };
        if (st.floor !== 2) go(a, [[dx, inZ], [dx, st.z], [st.x, st.z]], sit);
        else {
          const E = ELEV[id];
          go(a, [[dx, inZ], E.wait], () => takeElevator(a, id, true, () => go(a, [E.wait, [dx, E.z], [dx, st.z], [st.x, st.z]], sit)));
        }
      });
    },
    snack(a, id) {
      const st = nearestStair(BEACH.snack.x);
      const q = BEACH.snack.queue;
      go(a, [...pathNodes(a.from, st), [q[0] + jitter() * 2, q[1] + 1.5 + rnd() * 2]], () => {
        const s = getState();
        if (!isOpen(BIZ_BY_ID[id], s.minute) || occ[id] >= capOf(s, id)) return reject(a, id, true);
        occ[id]++;
        pay(a, id);
        const k = occ[id] - 1;
        go(a, [[q[0] - 2 + k * 1.2, q[1]]], () => {
          a.pose = 'stand';
          a.yaw = Math.PI;
          a.timer = BIZ_BY_ID[id].stay;
          a.then = () => { occ[id]--; afterBeach(a); };
        });
      });
    },
    umbrella(a, id) {
      const st = nearestStair(-24);
      go(a, pathNodes(a.from, st), () => {
        const s = getState();
        const cap = capOf(s, id);
        const k = umbBusy.findIndex((v, i) => i < cap && v === null);
        if (!isOpen(BIZ_BY_ID[id], s.minute) || k < 0) return reject(a, id, true);
        umbBusy[k] = a;
        occ[id]++;
        pay(a, id);
        const p = umbrellaSlot(k);
        const lx = p.x + (rnd() < 0.5 ? -0.9 : 0.9);
        const stay = BIZ_BY_ID[id].stay;
        const lie = () => {
          go(a, [[lx, p.z + 1.6]], () => {
            a.pose = 'lie'; a.x = lx; a.z = p.z + 1.15; a.y = SAND_Y + 0.42; a.yaw = 0;
            a.timer = a.swam ? stay * 0.55 : stay * 0.45;
            a.then = a.swam ? done : swim;
          });
        };
        const swim = () => {
          a.swam = true;
          const wx = p.x + jitter() * 4, wz = 48 + rnd() * 7;
          go(a, [[wx, 44]], () => {
            go(a, [[wx, wz]], () => {
              a.pose = 'swim';
              a.timer = stay * 0.3;
              a.then = () => go(a, [[wx, 43]], lie);
            });
          });
        };
        const done = () => { umbBusy[k] = null; occ[id]--; afterBeach(a); };
        a.swam = rnd() < 0.3;
        lie();
      });
    },
    surf(a, id) {
      const st = nearestStair(BEACH.surf.x);
      go(a, [...pathNodes(a.from, st), [BEACH.surf.x + 1 + jitter(), BEACH.surf.z + 3.4]], () => {
        const s = getState();
        if (!isOpen(BIZ_BY_ID[id], s.minute) || occ[id] >= capOf(s, id)) return reject(a, id, true);
        occ[id]++;
        pay(a, id);
        const z = BEACH.surf.zone;
        const wx = z.x0 + 4 + rnd() * (z.x1 - z.x0 - 8);
        go(a, [[wx, 44]], () => {
          const sf = sea.surferStart();
          a.surfer = sf;
          a.pose = 'hidden';
          if (sf) { sf.x = wx; sf.z = 47; }
          a.timer = BIZ_BY_ID[id].stay;
          a.then = () => {
            if (a.surfer) { a.x = Math.min(z.x1, Math.max(z.x0, a.surfer.x)); sea.surferEnd(a.surfer); a.surfer = null; }
            a.z = 45;
            a.pose = 'walk';
            occ[id]--;
            afterBeach(a);
          };
        });
      });
    },
    boat(a, id) { craftFlow(a, id, 'boat'); },
    jetski(a, id) { craftFlow(a, id, 'jet'); },
  };

  function craftFlow(a, id, kind) {
    const isBoat = kind === 'boat';
    const start = isBoat ? pathNodes(a.from, graph.deck) : [...pathNodes(a.from, nearestStair(BEACH.jetski.x)), [BEACH.jetski.x + 1.5, BEACH.jetski.z + 3.6]];
    go(a, start, () => {
      a.pose = 'stand';
      a.yaw = Math.PI * 0.8;
      a.wait = 0;
      a.timer = 0;
      a.then = null;
      a.waitFor = () => {
        const s = getState();
        if (!isOpen(BIZ_BY_ID[id], s.minute)) return reject(a, id, true);
        const craft = sea.freeCraft(isBoat ? 'boat' : 'jet');
        if (!craft) {
          if (a.wait > 30) return reject(a, id, true);
          return false;
        }
        craft.state = 'boarding';
        occ[id]++;
        pay(a, id);
        const px = isBoat ? BEACH.boat.pier.x : BEACH.jetski.dock.x;
        const walk = isBoat ? [[px, 29], [px + (craft.hx < px ? -1.2 : 1.2), craft.hz]] : [[px, 38], [px, craft.hz]];
        go(a, walk, () => {
          a.pose = 'hidden';
          sea.launch(isBoat ? 'boat' : 'jet', craft, BIZ_BY_ID[id].stay * SEC_PER_MIN, () => {
            occ[id]--;
            a.pose = 'walk';
            const back = isBoat ? [[px, 30], [18, 22]] : [[px, 40], [px, 37]];
            go(a, back, () => (isBoat ? leave(a) : afterBeach(a)));
          });
        });
        return true;
      };
    });
  }

  function afterBeach(a) {
    // 海灘消費完：有的順道買小吃，有的直接回家
    const s = getState();
    if (a.biz !== 'snack' && s.biz.snack.lv && rnd() < 0.25 && isOpen(BIZ_BY_ID.snack, s.minute)) {
      a.biz = 'snack';
      a.from = nearestStair(a.x);
      return flows.snack(a, 'snack');
    }
    leave(a, true);
  }

  function pay(a, id) {
    const s = getState();
    const amt = serve(s, id);
    a.biz = id;
    counts.cust++;
    onIncome(id, amt, a.x, a.y, a.z);
  }
  function reject(a, id, beach = false) {
    turnAway(getState(), id);
    onTurned(id, a.x, a.y + 2.2, a.z);
    leave(a, beach);
  }

  // ── 不消費的路人與海灘遊客 ──
  const towelFree = new Array(40).fill(true);
  function spawnCityWalker() {
    const from = homes[Math.floor(rnd() * homes.length)];
    const to = Math.floor(rnd() * nodes.length);
    if (nodes[to].tag === 'stair' || nodes[to].tag === 'deck') return;
    const a = spawn('amb', from);
    if (!a) return;
    go(a, pathNodes(from, to), () => leave(a));
  }
  function spawnBeachGoer() {
    const st = graph.stairs[Math.floor(rnd() * graph.stairs.length)];
    const from = pickSpawn(nodes[st].x, nodes[st].z);
    const a = spawn('beach', from);
    if (!a) return;
    a.beach = true;
    const r = rnd();
    const sx = nodes[st].x;
    go(a, pathNodes(from, st), () => {
      if (r < 0.45) {
        // 鋪毛巾做日光浴
        const k = towelFree.indexOf(true);
        const tx = sx + (rnd() - 0.5) * 50, tz = 24 + rnd() * 14;
        if (k < 0 || (tx > -42 && tx < -6) || (tx > 4 && tx < 32) || Math.abs(tx - BEACH.snack.x) < 8) return go(a, [[sx + jitter() * 20, 41]], () => leave(a, true));
        towelFree[k] = false;
        a.towel = k;
        a.towelPos = [tx, tz, rnd() * 0.6 - 0.3];
        _c.set(TOWELS[k % TOWELS.length]);
        towels.instanceColor.setXYZ(k, _c.r, _c.g, _c.b);
        go(a, [[tx, tz + 1.2]], () => {
          a.pose = 'lie'; a.x = tx; a.z = tz + 0.9; a.y = SAND_Y + 0.1; a.yaw = a.towelPos[2];
          a.timer = 60 + rnd() * 120;
          a.then = () => leave(a, true);
        });
      } else if (r < 0.8) {
        // 下水游泳
        const wx = sx + (rnd() - 0.5) * 40, wz = 47 + rnd() * 9;
        if (wx > 8 && wx < 28) return leave(a, true);
        go(a, [[wx, 43.5], [wx, wz]], () => {
          a.pose = 'swim';
          a.timer = 30 + rnd() * 60;
          a.then = () => go(a, [[wx + jitter() * 3, 43]], () => leave(a, true));
        });
      } else {
        // 沿著水邊散步
        const ex = sx + (rnd() < 0.5 ? -1 : 1) * (20 + rnd() * 30);
        go(a, [[sx + jitter(), 42], [ex, 42.5]], () => leave(a, true));
      }
    });
  }

  let SEC_PER_MIN = 0.3;
  const api = {
    setSecPerMin(v) { SEC_PER_MIN = v; },
    occ, counts,
    // 下雨時海灘遊客收拾離開
    clearBeach() {
      for (const a of A) if (a.on && a.beach && (a.pose === 'lie' || a.pose === 'swim')) a.timer = Math.min(a.timer, 1 + rnd() * 4);
    },
    update(dt, speed, dMin) {
      const s = getState();
      // 依經濟系統的來客率生客
      if (dMin > 0) {
        for (const b of BIZ) {
          const lam = arrivalPerMin(s, b.id);
          if (!lam) continue;
          acc[b.id] += lam * dMin;
          while (acc[b.id] >= 1) {
            acc[b.id] -= 1 + (rnd() - 0.5) * 0.6;
            let tx = 0, tz = 0;
            if (CITY_LOTS[b.id]) { const r = lotRect(...CITY_LOTS[b.id]); tx = (r.x0 + r.x1) / 2; tz = r.z1; } else { tx = b.id === 'umbrella' ? -24 : b.id === 'boat' ? 18 : BEACH[b.id].x; tz = 25; }
            const from = pickSpawn(tx, tz);
            const a = spawn('cust', from);
            if (!a) break;
            (flows[b.id] || flows.city)(a, b.id);
          }
        }
        // 路人與海灘遊客：維持目標人數
        const h = s.minute / 60;
        const cityTarget = (mobile ? 16 : 26) * (h < 6 ? 0.15 : h < 8 ? 0.6 : h > 22 ? 0.3 : 1);
        const beachTarget = (mobile ? 30 : 46) * beachCrowd(s);
        let nc = 0, nb = 0;
        for (const a of A) if (a.on) { if (a.kind === 'amb') nc++; else if (a.kind === 'beach') nb++; }
        counts.city = nc; counts.beach = nb;
        ambAcc += dMin * 0.6;
        beachAcc += dMin * 0.8;
        while (ambAcc >= 1) { ambAcc -= 1; if (nc < cityTarget) { spawnCityWalker(); nc++; } }
        while (beachAcc >= 1) { beachAcc -= 1; if (nb < beachTarget) { spawnBeachGoer(); nb++; } }
      }

      // 電梯車廂
      elevT += dt * speed;
      clockMin += dMin;
      let nc3 = 0;
      for (const id of CITY_IDS) {
        if ((s.biz[id] && s.biz[id].lv) < 3) continue;
        const E = ELEV[id];
        _m.compose(_p.set(E.x, cabState(id).y, E.z), _q.identity(), _s.set(1, 1, 1));
        cabs.setMatrixAt(nc3++, _m);
      }
      cabs.count = nc3;
      cabs.instanceMatrix.needsUpdate = true;

      // 移動與狀態
      const step = WALK_SPEED * dt * speed;
      const tMin = dMin;
      let n = 0, nt = 0;
      for (const a of A) {
        if (!a.on) continue;
        if (a.pose === 'walk') {
          let left = step;
          while (left > 0 && a.pi < a.path.length) {
            const [tx, tz] = a.path[a.pi];
            const dx = tx - a.x, dz = tz - a.z, d = Math.hypot(dx, dz);
            if (d <= left) { a.x = tx; a.z = tz; left -= d; a.pi++; }
            else { a.x += (dx / d) * left; a.z += (dz / d) * left; a.yaw = Math.atan2(dx, dz); left = 0; }
          }
          a.phase += step * 3.2;
          const gy = a.fy != null ? a.fy : groundY(a.x, a.z);
          a.y += (gy - a.y) * Math.min(1, dt * 12 + 0.2);
          if (a.z > 44.5 && !(Math.abs(a.x - 18) < 2.2 && a.z < 65) && !(Math.abs(a.x - 60) < 1.5 && a.z < 56)) a.y = SEA_Y - Math.min(0.9, (a.z - 44.5) * 0.25);
          if (a.pi >= a.path.length) {
            const cb = a.then;
            a.then = null;
            if (cb) cb(a); else leave(a);
          }
        } else if (a.waitFor) {
          a.wait += tMin;
          if (a.waitFor() !== false) a.waitFor = null;
        } else if (a.pose !== 'walk') {
          a.timer -= tMin;
          if (a.timer <= 0 && a.then) {
            const cb = a.then;
            a.then = null;
            cb(a);
          }
        }
        if (!a.on || a.pose === 'hidden') continue;
        // 寫入實例矩陣
        let pitch = 0, roll = 0, y = a.y, yaw = a.yaw;
        if (a.pose === 'walk') { y += Math.abs(Math.sin(a.phase)) * 0.06; roll = Math.sin(a.phase) * 0.04; }
        else if (a.pose === 'lie') { pitch = -Math.PI / 2; }
        else if (a.pose === 'sit') { y -= 0.4; }
        else if (a.pose === 'swim') { y = SEA_Y - 1.05 + Math.sin(a.phase + performance.now() * 0.002) * 0.06; a.phase += dt; }
        _m.compose(_p.set(a.x, y, a.z), _q.setFromEuler(_e.set(pitch, yaw, roll, 'YXZ')), _s.set(1, 1, 1));
        bodies.setMatrixAt(n, _m);
        heads.setMatrixAt(n, _m);
        bodies.instanceColor.setXYZ(n, a.shirt[0], a.shirt[1], a.shirt[2]);
        heads.instanceColor.setXYZ(n, a.skin[0], a.skin[1], a.skin[2]);
        n++;
        if (a.towel >= 0 && a.pose === 'lie') {
          const [tx, tz, ry] = a.towelPos;
          _m.compose(_p.set(tx, SAND_Y, tz), _q.setFromEuler(_e.set(0, ry, 0)), _s.set(1.1, 1, 2.1));
          towels.setMatrixAt(nt++, _m);
        }
      }
      bodies.count = heads.count = n;
      towels.count = nt;
      bodies.instanceMatrix.needsUpdate = heads.instanceMatrix.needsUpdate = towels.instanceMatrix.needsUpdate = true;
      bodies.instanceColor.needsUpdate = heads.instanceColor.needsUpdate = true;
      // 毛巾顏色以第幾條毛巾決定，重新排序後要跟著寫
      if (nt) {
        let k = 0;
        for (const a of A) if (a.on && a.towel >= 0 && a.pose === 'lie') { _c.set(TOWELS[a.towel % TOWELS.length]); towels.instanceColor.setXYZ(k++, _c.r, _c.g, _c.b); }
        towels.instanceColor.needsUpdate = true;
      }
    },
    active: () => A.filter((a) => a.on).length,
    // 介面用：各 Lv3 店家電梯的位置、所在樓層、方向與乘客數
    elevators() {
      const s = getState();
      return CITY_IDS.filter((id) => s.biz[id] && s.biz[id].lv >= 3).map((id) => {
        const c = cabState(id), E = ELEV[id];
        return { id, x: E.x, y: c.y + 2.9, z: E.z, floor: c.k < 0.5 ? 1 : 2, dir: c.dir, n: riders(id), cap: ECAP, tag: E.tag };
      });
    },
    visible: () => bodies.count,
    agents: A,
  };
  return api;
}
