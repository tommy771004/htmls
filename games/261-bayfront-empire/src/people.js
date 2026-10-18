// 行人與顧客 AI：從住宅、公車站、步道兩端出發，沿人行道與斑馬線走到店家或海灘，
// 消費（入店、躺椅、排隊買小吃、上船、衝浪）後離開。另有不消費的路人與海灘遊客維持街景熱鬧。
import * as THREE from 'three';
import { Builder, prng, T } from './geo.js';
import { BIZ, BIZ_BY_ID, LIFT } from './data.js';
import { arrivalPerMin, capOf, stayOf, serve, turnAway, isOpen, beachCrowd } from './econ.js';
import { buffOf, hasCivic } from './items.js';
import { STAGE, CITY_LOTS, lotRect, lotKey, floorOf, STACKS, BEACH, umbrellaSlot, STAIRS_X, BOAT_SLOTS, JET_SLOTS, groundY, SAND_Y, DECK_Y, RAIL_Z } from './layout.js';
import { SEA_Y } from './sea.js';
import { seatsOf, elevatorOf, floorY, roomOf, FLOOR_GAP } from './interior.js';
import { liftLv, APT_BY_KEY } from './empire.js';

const TBOX = T.box;
const SHIRTS = ['#c8453c', '#2f7f8f', '#d9a63e', '#2d5a45', '#e07a5f', '#5f8790', '#f2e8cf', '#8a4f6e', '#3f7a8c', '#b5793a', '#f4f1e6', '#6a5a8a', '#e8c25a', '#7a9a5a'];
const SKINS = ['#f1c9a5', '#e0ac85', '#c68b62', '#a8704b', '#7d4f33', '#f5d5bc'];
const TOWELS = ['#c8453c', '#2f7f8f', '#d9a63e', '#e07a5f', '#5f8790', '#f2e8cf', '#c0607a'];
const BROLLY = ['#c8453c', '#2d5a45', '#d9a63e', '#2f3a3d', '#3f7a8c', '#8a4f6e', '#e8e2d0'];

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
function brollyGeo() {
  // 雨傘：頂在頭上的八角傘面＋傘柄
  const S = new Builder();
  S.cyl(0.18, 0.9, 0.12, 0.025, 1.25, '#3a3a3a', 5);
  S.add(T.cone8, 0.18, 2.05, 0.12, 1.5, 0.42, 1.5, 0, '#ffffff');
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
  const { graph, route, getState, sea, onIncome, onTurned, onDelivery, mobile } = ctx;
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

  // ── 疊樓建築的電梯（每棟一部，不同樓層是不同店家） ──
  // 叫車制：有人在等或車廂裡有人要去的樓層才會動，依掃描法（同方向優先）決定下一站；到站開門 2 秒。
  // 電梯等級（empire.js 的 liftLv）決定車廂容量與每層行程時間。
  const ELEV = Object.fromEntries(STACKS.map((st) => {
    const E = elevatorOf(st.base);
    return [st.key, { ...E, ids: st.ids, floors: st.floors, y: floorY(1), cur: 1, target: null, dwell: 0, dir: 0, at: 1 }];
  }));
  const ECAP = (key) => LIFT.cap[liftLv(getState(), key) - 1];
  let elevT = 0, clockMin = 0;
  function liftRequests(key) {
    const want = new Set();
    for (const a of A) {
      if (!a.on) continue;
      if (a.ride === key) want.add(a.rto);
      else if (a.lw && a.lw.key === key) want.add(a.lw.from);
    }
    return want;
  }
  function stepLift(key, sec) {
    const E = ELEV[key];
    if (E.dwell > 0) {
      E.dwell -= sec;
      E.at = E.cur;
      if (E.dwell > 0) return;
    }
    if (E.target === null) {
      const req = [...liftRequests(key)].filter((f) => f !== E.cur || riders(key) >= ECAP(key));
      const up = req.filter((f) => f > E.cur), dn = req.filter((f) => f < E.cur);
      if (E.dir >= 0 && up.length) E.target = Math.min(...up);
      else if (E.dir <= 0 && dn.length) E.target = Math.max(...dn);
      else if (up.length) E.target = Math.min(...up);
      else if (dn.length) E.target = Math.max(...dn);
      if (E.target === null) { E.dir = 0; E.at = E.cur; return; }
    }
    E.at = 0;
    const ty = floorY(E.target), v = (FLOOR_GAP / LIFT.move[liftLv(getState(), key) - 1]) * sec;
    E.dir = Math.sign(ty - E.y);
    if (Math.abs(ty - E.y) <= v) {
      E.y = ty;
      E.cur = E.target;
      E.target = null;
      E.dwell = 2;
      E.at = E.cur;
    } else E.y += E.dir * v;
  }
  const liftQueue = (key, from) => { let n = 0; for (const a of A) if (a.on && a.lw && a.lw.key === key && a.lw.from === from) n++; return n; };
  const riders = (id) => { let n = 0; for (const a of A) if (a.on && a.ride === id) n++; return n; };
  const cabGeo = (() => {
    const S = new Builder();
    S.add(TBOX, 0, -0.12, 0, 2.0, 0.12, 2.0, 0, '#3a4144');
    S.add(TBOX, 0, 2.3, 0, 2.0, 0.14, 2.0, 0, '#e0b646');
    for (const [dx, dz] of [[-0.95, -0.95], [0.95, -0.95], [-0.95, 0.95], [0.95, 0.95]]) S.add(TBOX, dx, 0, dz, 0.08, 2.3, 0.08, 0, '#e0b646');
    S.add(TBOX, 0, 0.9, -0.95, 1.9, 0.06, 0.04, 0, '#e0b646');
    return S.geometry();
  })();
  const cabs = new THREE.InstancedMesh(cabGeo, mat, Math.max(1, STACKS.length));
  const brollies = new THREE.InstancedMesh(brollyGeo(), mat, MAX);
  brollies.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  brollies.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 3), 3);
  brollies.frustumCulled = false;
  brollies.castShadow = true;
  brollies.count = 0;
  scene.add(brollies);
  cabs.count = 0;
  cabs.frustumCulled = false;
  cabs.castShadow = true;
  scene.add(cabs);
  // 走到電梯口按鈕等車廂，車廂停在 from 層開門時進去，跟著車廂移動，停在 to 層時出來接著走 path
  function takeElevator(a, key, from, to, then) {
    const E = ELEV[key];
    a.pose = 'stand';
    a.yaw = Math.PI / 2;
    a.wait = 0;
    a.lw = { key, from, to };
    a.waitFor = () => {
      if (E.at !== from || riders(key) >= ECAP(key)) return false;
      a.lw = null;
      a.ride = key;
      a.rto = to;
      E.dwell = Math.max(E.dwell, 0.8);
      const slot = (riders(key) - 1) % 4;
      a.x = E.x + (slot % 2 ? 0.45 : -0.45);
      a.z = E.z + (slot > 1 ? 0.45 : -0.45);
      a.pose = 'ride';
      a.waitFor = () => {
        a.y = E.y;
        if (E.at !== to) return false;
        a.ride = null;
        a.fy = to > 1 ? floorY(to) : null;
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

  let gen = 0;
  function spawn(kind, from) {
    const a = A.find((q) => !q.on);
    if (!a) return null;
    const [x, z] = P(from);
    Object.assign(a, {
      on: true, kind, x, z, y: groundY(x, z), fy: null, ride: null, rto: 0, lw: null, yaw: 0, path: [], pi: 0, pose: 'walk', timer: 0, biz: null, slot: -1, craft: null,
      surfer: null, from, phase: rnd() * 6, then: null, wait: 0, towel: -1, beach: false, waitFor: null,
      gen: ++gen, target: null, paid: 0, rejected: false, inside: false, release: null, home: null, rival: false, vip: false, watch: false, temp: false,
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
    a.lw = null;
    a.ride = null;
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
        // 樓上的店（同一棟的 F2、F3）從一樓大門進來，搭電梯上樓；電梯口排太長就不等了
        const f = floorOf(id), key = lotKey(id), E = ELEV[key];
        if (f > 1 && liftQueue(key, 1) >= ECAP(key) * 2) {
          s.today.liftLost = (s.today.liftLost || 0) + 1;
          return reject(a, id, false, 'lift');
        }
        occ[id]++;
        a.biz = id;
        a.inside = true;
        pay(a, id);
        // 剖面室內：走進店裡找空位坐下（或站在器材前），客滿的人在店裡看不到的地方
        const lv = s.biz[id].lv;
        const ck = `${id}|${lv}|${f}`;
        const seats = seatCache[ck] || (seatCache[ck] = seatsOf(id, lv));
        const busy = seatBusy[ck] || (seatBusy[ck] = new Set());
        const free = seats.map((_, k) => k).filter((k) => !busy.has(k));
        const stay = stayOf(s, id) * (0.8 + rnd() * 0.4);
        const out = () => { a.biz = null; a.inside = false; a.release = null; a.y = groundY(a.x, a.z); leave(a); };
        let k = -1, released = false;
        // 釋放容量與座位（離座或樓層交換時被請出去），只做一次
        a.release = () => { if (released) return; released = true; if (k >= 0) busy.delete(k); occ[id]--; };
        if (!free.length) {
          a.pose = 'hidden';
          a.timer = stay;
          a.then = () => { a.release(); out(); };
          return;
        }
        // 佔用容量的時間維持和以前一樣（付款起算 stay 分鐘）：路上與等電梯的時間從入座時間扣掉，離座就釋放
        const t0 = clockMin;
        k = free[Math.floor(rnd() * free.length)];
        busy.add(k);
        const st = seats[k];
        const inZ = r.z1 - 1.4;
        const sit = () => {
          a.pose = st.pose;
          a.x = st.x; a.z = st.z; a.y = st.y; a.yaw = st.yaw;
          a.timer = Math.max(stay * 0.25, stay - (clockMin - t0));
          a.then = () => {
            a.release();
            a.pose = 'walk';
            if (f === 1) return go(a, [[dx, st.z], [dx, inZ], [dx, r.z1 + 0.4]], out);
            // 從樓上搭電梯下樓再出門
            go(a, [[dx, st.z], [dx, E.z], E.wait], () => takeElevator(a, key, f, 1, () => go(a, [E.wait, [dx, inZ], [dx, r.z1 + 0.4]], out)));
          };
        };
        if (f === 1) go(a, [[dx, inZ], [dx, st.z], [st.x, st.z]], sit);
        else go(a, [[dx, inZ], E.wait], () => takeElevator(a, key, 1, f, () => go(a, [E.wait, [dx, E.z], [dx, st.z], [st.x, st.z]], sit)));
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
          a.timer = stayOf(getState(), id);
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
        const stay = stayOf(s, id);
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
          a.timer = stayOf(getState(), id);
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
          sea.launch(isBoat ? 'boat' : 'jet', craft, stayOf(s, id) * SEC_PER_MIN, () => {
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
    a.paid = amt;
    a.biz = id;
    counts.cust++;
    onIncome(id, amt, a.x, a.y, a.z);
  }
  function reject(a, id, beach = false, why = 'full') {
    // 有外送機車的店：客滿的客人改叫外送（店門口騎出一台機車）
    const d = turnAway(getState(), id);
    if (d) {
      if (onDelivery) onDelivery(id, d, a.x, a.y + 2.2, a.z);
      a.rejected = 'delivery';
      leave(a, beach);
      return;
    }
    onTurned(id, a.x, a.y + 2.2, a.z, why);
    a.rejected = why;
    leave(a, beach);
  }

  // ── 不消費的路人與海灘遊客 ──
  const towelFree = new Array(40).fill(true);
  // 表演台的觀眾：走到舞台前站著看一陣子
  function spawnAudience() {
    const from = homes[Math.floor(rnd() * homes.length)];
    const a = spawn('amb', from);
    if (!a) return;
    const near = nearestNode(STAGE.x, STAGE.z + 9);
    const ax = STAGE.x + (rnd() - 0.5) * (STAGE.w + 2), az = STAGE.z + STAGE.d / 2 + 2.2 + rnd() * 3.2;
    go(a, [...pathNodes(from, near), [ax, az]], () => {
      a.pose = 'stand';
      a.watch = true;
      a.yaw = Math.atan2(STAGE.x - ax, STAGE.z - az);
      a.timer = 15 + rnd() * 30;
      a.then = () => { a.watch = false; leave(a); };
    });
  }
  function spawnCityWalker() {
    const s0 = getState(), h0 = s0.minute / 60;
    if (hasCivic(s0, 'stage') && h0 >= 10 && h0 < 22 && rnd() < 0.3) return spawnAudience();
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

  // ── 店員：營業中的城市店每級一位店員在店內走動（端盤子、整理貨架、帶課），樓上的店員待在自己那層 ──
  const CITY_SHOPS = BIZ.filter((b) => b.zone === 'city').map((b) => b.id);
  const staffOf = Object.fromEntries(CITY_SHOPS.map((id) => [id, []]));
  function seatsFor(id, lv) {
    const ck = `${id}|${lv}|${floorOf(id)}`;
    return { seats: seatCache[ck] || (seatCache[ck] = seatsOf(id, lv)), busy: seatBusy[ck] || (seatBusy[ck] = new Set()) };
  }
  function spawnStaff(id, f, k) {
    const R = roomOf(id);
    const hx = R.cx + (k - 1) * 1.7, hz = R.z0 + 3.0;
    const a = spawn('staff', 0);
    if (!a) return null;
    a.x = hx; a.z = hz;
    a.fy = f > 1 ? floorY(f) : null;
    a.y = f > 1 ? floorY(f) : groundY(hx, hz);
    a.sbiz = id; a.sf = f; a.home = [hx, hz]; a.inside = true;
    _c.set(BIZ_BY_ID[id].color);
    a.shirt = [_c.r, _c.g, _c.b];
    a.pose = 'stand';
    a.yaw = Math.PI;
    a.timer = 1 + rnd() * 4;
    a.then = () => staffRound(a);
    return a;
  }
  function staffRound(a) {
    const s = getState(), id = a.sbiz, lv = s.biz[id].lv;
    if (!lv) return despawn(a);
    const { seats, busy } = seatsFor(id, lv);
    const taken = [...busy];
    const k = taken.length && rnd() < 0.75 ? taken[Math.floor(rnd() * taken.length)] : Math.floor(rnd() * seats.length);
    const st = seats[k];
    if (!st) { a.timer = 5; a.then = () => staffRound(a); return; }
    const dx = roomOf(id).cx, tx = st.x + (dx - st.x) * 0.45;
    go(a, [[dx, a.home[1]], [dx, st.z], [tx, st.z]], () => {
      a.pose = 'stand';
      a.yaw = Math.atan2(st.x - tx, 0.001);
      a.timer = 2 + rnd() * 4;
      a.then = () => go(a, [[dx, st.z], [dx, a.home[1]], a.home], () => {
        a.pose = 'stand';
        a.yaw = Math.PI;
        a.timer = 3 + rnd() * 6;
        a.then = () => staffRound(a);
      });
    });
  }
  function syncStaff(s) {
    for (const id of CITY_SHOPS) {
      const lv = s.biz[id].lv, f = floorOf(id);
      // 臨時工（道具）多派一位穿黃背心的店員
      const temp = lv && buffOf(s, 'temp', id) ? 1 : 0;
      const want = lv && isOpen(BIZ_BY_ID[id], s.minute) ? Math.min(lv, mobile ? 2 : 3) + temp : 0;
      const keep = [];
      for (const a of staffOf[id]) {
        if (!a.on || a.kind !== 'staff' || a.sbiz !== id) continue;
        if (a.sf !== f || keep.length >= want) despawn(a); else keep.push(a);
      }
      while (keep.length < want) {
        const a = spawnStaff(id, f, keep.length);
        if (!a) break;
        if (temp && keep.length === want - 1) { _c.set('#e9b93a'); a.shirt = [_c.r, _c.g, _c.b]; a.temp = true; }
        keep.push(a);
      }
      staffOf[id] = keep;
    }
  }
  // ── 競爭對手的客人：走進對街那棟公寓一樓的店 ──
  function spawnRivalCustomer(s) {
    const apt = APT_BY_KEY[s.rival.lot];
    const from = pickSpawn(apt.x, apt.z);
    const a = spawn('cust', from);
    if (!a) return;
    a.rival = true;
    a.target = 'rival';
    const end = nearestNode(apt.x, apt.z + 3);
    go(a, [...pathNodes(from, end), [apt.x + jitter(), apt.z + 0.4]], () => {
      a.pose = 'hidden';
      a.timer = BIZ_BY_ID[s.rival ? s.rival.id : 'cafe'].stay * 0.6;
      a.then = () => { a.z = apt.z + 0.6; leave(a); };
    });
  }
  let rivalAcc = 0, staffT = 0;

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
            a.target = b.id;
            (flows[b.id] || flows.city)(a, b.id);
          }
        }
        // 對手的客人（目標店家被搶走的那一份）
        if (s.rival && isOpen(BIZ_BY_ID[s.rival.id], s.minute)) {
          const lam = arrivalPerMin(s, s.rival.id);
          rivalAcc += (lam / Math.max(0.3, 1 - s.rival.power)) * s.rival.power * dMin;
          while (rivalAcc >= 1) { rivalAcc -= 1; spawnRivalCustomer(s); }
        }
        staffT -= dMin;
        if (staffT <= 0) { staffT = 2; syncStaff(s); }
        // 路人與海灘遊客：維持目標人數（週五夜派對的晚上街上人多很多）
        const h = s.minute / 60;
        const party = s.event === 'party' && (h >= 18 || h < 3);
        const cityTarget = (mobile ? 16 : 26) * (party ? (h < 3 ? 1.2 : 1.6) : h < 6 ? 0.15 : h < 8 ? 0.6 : h > 22 ? 0.3 : 1)
          * (buffOf(s, 'shuttle') ? 1.35 : 1) * (hasCivic(s, 'stage') && h >= 10 && h < 22 ? 1.25 : 1);
        const beachTarget = (mobile ? 30 : 46) * beachCrowd(s);
        let nc = 0, nb = 0;
        for (const a of A) if (a.on) { if (a.kind === 'amb') nc++; else if (a.kind === 'beach') nb++; }
        if (party) ambAcc += dMin * 0.8;
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
      for (const key in ELEV) {
        stepLift(key, dt * speed);
        const E = ELEV[key];
        _m.compose(_p.set(E.x, E.y, E.z), _q.identity(), _s.set(1, 1, 1));
        cabs.setMatrixAt(nc3++, _m);
      }
      cabs.count = nc3;
      cabs.instanceMatrix.needsUpdate = true;

      // 移動與狀態
      const step = WALK_SPEED * dt * speed;
      const tMin = dMin;
      const raining = s.weather.cur === 'rain';
      let n = 0, nt = 0, nu = 0;
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
        // 下雨時在戶外走路或等待的人撐傘
        if (raining && !a.inside && a.fy == null && (a.pose === 'walk' || a.pose === 'stand') && a.kind !== 'staff' && a.z < 44) {
          _m.compose(_p.set(a.x, y, a.z), _q.setFromEuler(_e.set(0, yaw, 0)), _s.set(1, 1, 1));
          brollies.setMatrixAt(nu, _m);
          _c.set(BROLLY[a.i % BROLLY.length]);
          brollies.instanceColor.setXYZ(nu++, _c.r, _c.g, _c.b);
        }
        if (a.towel >= 0 && a.pose === 'lie') {
          const [tx, tz, ry] = a.towelPos;
          _m.compose(_p.set(tx, SAND_Y, tz), _q.setFromEuler(_e.set(0, ry, 0)), _s.set(1.1, 1, 2.1));
          towels.setMatrixAt(nt++, _m);
        }
      }
      bodies.count = heads.count = n;
      towels.count = nt;
      brollies.count = nu;
      if (nu) { brollies.instanceMatrix.needsUpdate = true; brollies.instanceColor.needsUpdate = true; }
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
    // 網紅探店：派一位穿亮粉色的客人走到那家店（照一般流程消費）
    vip(id) {
      let tx = 0, tz = 25;
      if (CITY_LOTS[id]) { const r = lotRect(...CITY_LOTS[id]); tx = (r.x0 + r.x1) / 2; tz = r.z1; } else if (BEACH[id] && BEACH[id].x !== undefined) tx = BEACH[id].x;
      const a = spawn('cust', pickSpawn(tx, tz));
      if (!a) return null;
      _c.set('#ff5c8a');
      a.shirt = [_c.r, _c.g, _c.b];
      a.vip = true;
      a.target = id;
      (flows[id] || flows.city)(a, id);
      return a;
    },
    // 介面用：各棟電梯的位置、所在樓層、方向、乘客數與排隊人數（整棟都還沒開店就不顯示）
    elevators() {
      const s = getState();
      return Object.entries(ELEV).filter(([, E]) => E.ids.some((id) => s.biz[id] && s.biz[id].lv > 0)).map(([key, E]) => {
        let q = 0;
        for (const a of A) if (a.on && a.lw && a.lw.key === key) q++;
        return { id: key, base: E.ids[0], x: E.x, y: E.y + 2.9, z: E.z, floor: Math.round((E.y - floorY(1)) / FLOOR_GAP) + 1, dir: E.dir, n: riders(key), cap: ECAP(key), q };
      });
    },
    // 疊樓交換樓層：店內的客人與店員先請出門（容量與座位立刻釋放），店員在新樓層重新上班
    evict(ids) {
      for (const a of A) {
        if (!a.on) continue;
        if (a.kind === 'staff' && ids.includes(a.sbiz)) { despawn(a); continue; }
        if (!a.release || !ids.includes(a.biz)) continue;
        a.release();
        const r = lotRect(...CITY_LOTS[a.biz]);
        Object.assign(a, { release: null, ride: null, lw: null, waitFor: null, fy: null, inside: false, biz: null, then: null });
        a.x = (r.x0 + r.x1) / 2; a.z = r.z1 + 0.6; a.y = groundY(a.x, a.z);
        leave(a);
      }
      for (const id of ids) staffOf[id] = [];
      staffT = 0;
    },
    // 跟拍用：這個人現在在做什麼
    describe(a) {
      const name = (id) => (id === 'rival' ? (getState().rival ? getState().rival.name : '對手的店') : BIZ_BY_ID[id] ? BIZ_BY_ID[id].name : '');
      if (a.kind === 'staff' && a.temp) return { who: `${name(a.sbiz)}的臨時工`, what: '尖峰時段來支援' };
      if (a.kind === 'staff') return { who: `${name(a.sbiz)}的店員`, what: a.pose === 'walk' ? '送餐、整理座位' : '在櫃台待命' };
      if (a.kind === 'amb') return { who: '路人', what: a.watch ? '在看街頭表演' : '在街上散步' };
      if (a.kind === 'beach') return { who: '海灘遊客', what: a.pose === 'swim' ? '在海裡游泳' : a.pose === 'lie' ? '在沙灘上曬太陽' : '去海邊' };
      const who = a.vip ? '網紅' : a.rival ? `${name('rival')}的客人` : '顧客';
      if (a.rejected === 'delivery') return { who, what: `${name(a.target)}客滿，改叫外送` };
      if (a.rejected) return { who, what: a.rejected === 'lift' ? '電梯排太長，不等了' : `${name(a.target)}客滿，只好回家` };
      if (a.ride) return { who, what: `搭電梯往 F${a.rto}`, paid: a.paid };
      if (a.lw) return { who, what: `等電梯 F${a.lw.from} → F${a.lw.to}`, paid: a.paid };
      if (a.biz && a.pose !== 'walk') return { who, what: `在${name(a.biz)}消費中`, left: Math.max(0, Math.ceil(a.timer)), paid: a.paid };
      if (a.biz && a.inside) return { who, what: `走進${name(a.biz)}`, paid: a.paid };
      if (a.paid) return { who, what: '消費完回家', paid: a.paid };
      if (a.rival) return { who, what: `前往${name('rival')}` };
      return { who, what: a.target ? `前往${name(a.target)}` : '逛街' };
    },
    visible: () => bodies.count,
    agents: A,
  };
  return api;
}
