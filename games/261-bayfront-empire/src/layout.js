// 地圖座標與步行路網。x 東西向、z 南北向（+z 往海），y 向上，單位公尺。
// 鏡頭固定從 +x +z 斜上方俯看，所以每棟樓的正面朝 +z、側面朝 +x。

export const ROAD_W = 12;
export const COAST_W = 14;
// 南北向街道中心 x（核心區 6 條，外圍再各延伸 3 條當背景）
export const STREETS_X = [-264, -216, -168, -120, -72, -24, 24, 72, 120, 168, 216, 264];
export const CORE_STREETS_X = [-120, -72, -24, 24, 72, 120];
// 東西向大道中心 z；0 是沿海道路
export const AVES_Z = [-210, -168, -126, -84, -42];
export const COAST_Z = 0;
export const CORE_AVES_Z = [-84, -42, 0];

// 核心街區：5 欄 × 2 列
export const COLS = [[-114, -78], [-66, -30], [-18, 18], [30, 66], [78, 114]];
export const ROWS = [[-78, -48], [-36, -7]];
export const SIDEWALK = 3;

export const PROM = { z0: 7, z1: 17, y: 0.45 }; // 沿海步道
export const SAND_Y = 0.12;
export const SEA_Z0 = 34; // 海面網格從這裡開始（前段在 shader 裡畫成濕沙）
export const SHORE_Z = 44; // 平均水線
export const STAIRS_X = [-96, -44, 40, 100];
export const RAIL_Z = 16.6;

export const lotRect = (col, row, side) => {
  const [x0, x1] = COLS[col], [z0, z1] = ROWS[row];
  const mid = (x0 + x1) / 2;
  const ix0 = x0 + SIDEWALK, ix1 = x1 - SIDEWALK, iz0 = z0 + SIDEWALK, iz1 = z1 - SIDEWALK;
  if (side === 'W') return { x0: ix0, x1: mid - 0.5, z0: iz0, z1: iz1 };
  if (side === 'E') return { x0: mid + 0.5, x1: ix1, z0: iz0, z1: iz1 };
  return { x0: ix0, x1: ix1, z0: iz0, z1: iz1 };
};

// 城市商家的店面位置：[欄, 列, 東西半, 樓層]。同一塊地可以疊好幾家店（影片裡的 F1 服飾／F2 美甲／F3…），
// 各層是展開式的剖面樓板，以電梯連通
export const CITY_LOTS = {
  cafe: [0, 1, 'W', 1], bakery: [0, 1, 'E', 1], burger: [1, 1, 'W', 1], mart: [1, 1, 'E', 1],
  boutique: [3, 1, 'W', 1], nail: [3, 1, 'W', 2], books: [3, 1, 'W', 3], pizza: [4, 1, 'W', 1],
  gym: [0, 0, 'E', 1], bar: [0, 0, 'E', 2],
};
export const floorOf = (id) => (CITY_LOTS[id] && CITY_LOTS[id][3]) || 1;
// 玩家可以付裝修費交換疊樓的樓層（empire.js 的 swapFloors），讀檔與交換後由畫面層呼叫 setFloor 套用
export const DEFAULT_FLOOR = Object.fromEntries(Object.entries(CITY_LOTS).map(([id, v]) => [id, v[3]]));
export function setFloor(id, f) { CITY_LOTS[id][3] = f; }
export const lotKey = (id) => CITY_LOTS[id].slice(0, 3).join(',');
// 同一塊地上的店（依樓層排序）；只有一層的地不算「疊樓」
export function stackOf(id) {
  const key = lotKey(id);
  const ids = Object.keys(CITY_LOTS).filter((k) => lotKey(k) === key).sort((a, b) => floorOf(a) - floorOf(b));
  return { key, ids, floors: ids.length, base: ids[0] };
}
export const STACKS = [...new Set(Object.keys(CITY_LOTS).map(lotKey))].map((k) => stackOf(Object.keys(CITY_LOTS).find((id) => lotKey(id) === k))).filter((s) => s.floors > 1);
// 住宅（客人的出發點）
export const APT_LOTS = [[0, 0, 'W'], [1, 0, 'W'], [1, 0, 'E'], [3, 0, 'W'], [3, 0, 'E'], [4, 0, 'W'], [4, 0, 'E'], [3, 1, 'E'], [4, 1, 'E']];
export const PARK = [2, 1];
// 東區停車場：核心區東側沿海那一塊背景街區（平面停車場，蓋了全城建設後變成立體停車場）
export const PARKING = { x0: 129, x1: 159, z0: -33, z1: -10, i: 8, j: 4 };
// 公園街頭表演台（全城建設）：舞台中心與朝向，觀眾站在舞台南側
export const STAGE = { x: -8, z: -30.5, w: 8, d: 3.6 };
export const HALL = [2, 0];

// 海灘商家的擺設座標
export const BEACH = {
  snack: { x: -80, z: 23.5, w: 7, d: 4.2, queue: [-80, 28.2] },
  umbrella: { x0: -38, z0: 24, dx: 8, dz: 5.4, cols: 4 },
  surf: { x: 100, z: 22.5, zone: { x0: 82, x1: 124, z0: 52, z1: 66 } },
  jetski: { x: 60, z: 22.5, dock: { x: 60, z0: 40, z1: 56 } },
  boat: { deck: { x0: 6, x1: 30, z0: 17, z1: 28 }, pier: { x: 18, z0: 28, z1: 64 } },
};
export const UMBRELLA_MAX = 12;
export const umbrellaSlot = (k) => {
  const u = BEACH.umbrella;
  const col = k % u.cols, row = Math.floor(k / u.cols);
  return { x: u.x0 + col * u.dx + (row % 2) * 2, z: u.z0 + row * u.dz };
};
// 租船停泊位（船頭朝 +z）
export const BOAT_SLOTS = [[14.4, 37], [21.6, 37], [14.4, 47], [21.6, 47], [14.4, 57], [21.6, 57]];
export const JET_SLOTS = [[57.8, 44], [62.2, 44], [57.8, 48.5], [62.2, 48.5], [57.8, 53], [62.2, 53]];

// 標籤錨點
export function labelAnchor(id) {
  if (CITY_LOTS[id]) {
    const r = lotRect(...CITY_LOTS[id]);
    return [(r.x0 + r.x1) / 2, 0, r.z1];
  }
  const b = BEACH[id];
  if (id === 'umbrella') return [-24, 3.5, 30];
  if (id === 'boat') return [12, 4.5, 22];
  return [b.x, 4, b.z];
}

// ───────── 步行路網 ─────────
// 節點：每個街區人行道的四角、店門與住宅門口、沿海步道、樓梯口。
// 邊：同一條人行道上相鄰的點，以及跨越馬路的斑馬線。
export function buildWalkGraph() {
  const nodes = [];
  const adj = [];
  const key = new Map();
  const node = (x, z, tag) => {
    const k = `${x.toFixed(1)},${z.toFixed(1)}`;
    if (key.has(k)) return key.get(k);
    const id = nodes.length;
    nodes.push({ x, z, tag });
    adj.push([]);
    key.set(k, id);
    return id;
  };
  const link = (a, b) => {
    if (a === b || adj[a].some((e) => e.to === b)) return;
    const d = Math.hypot(nodes[a].x - nodes[b].x, nodes[a].z - nodes[b].z);
    adj[a].push({ to: b, d });
    adj[b].push({ to: a, d });
  };
  const h = SIDEWALK / 2;
  const doors = {}, homes = [];
  // 各街區人行道外圈：四邊上的點依序連起來
  const corner = {};
  for (let c = 0; c < COLS.length; c++) {
    for (let r = 0; r < ROWS.length; r++) {
      const [x0, x1] = COLS[c], [z0, z1] = ROWS[r];
      const a = node(x0 + h, z0 + h), b = node(x1 - h, z0 + h), cc = node(x1 - h, z1 - h), d = node(x0 + h, z1 - h);
      corner[`${c},${r}`] = { nw: a, ne: b, se: cc, sw: d };
      const south = [d, cc], north = [a, b];
      // 店門與住宅門在南側人行道
      for (const [id, [lc, lr, side]] of Object.entries(CITY_LOTS)) {
        if (lc !== c || lr !== r) continue;
        const rr = lotRect(lc, lr, side);
        const n = node((rr.x0 + rr.x1) / 2, z1 - h, 'door');
        doors[id] = n;
        south.push(n);
      }
      for (const [lc, lr, side] of APT_LOTS) {
        if (lc !== c || lr !== r) continue;
        const rr = lotRect(lc, lr, side);
        const n = node((rr.x0 + rr.x1) / 2 + 2.5, z1 - h, 'home');
        homes.push(n);
        south.push(n);
      }
      // 南側中點讓公園／會堂也有人經過
      south.push(node((x0 + x1) / 2, z1 - h));
      north.push(node((x0 + x1) / 2, z0 + h));
      for (const side of [south, north]) {
        side.sort((p, q) => nodes[p].x - nodes[q].x);
        for (let i = 1; i < side.length; i++) link(side[i - 1], side[i]);
      }
      link(a, d);
      link(b, cc);
    }
  }
  // 斑馬線：東西相鄰街區、南北相鄰街區
  for (let c = 0; c < COLS.length; c++) {
    for (let r = 0; r < ROWS.length; r++) {
      const k = corner[`${c},${r}`];
      if (c + 1 < COLS.length) {
        const e = corner[`${c + 1},${r}`];
        link(k.ne, e.nw);
        link(k.se, e.sw);
      }
      if (r + 1 < ROWS.length) {
        const s = corner[`${c},${r + 1}`];
        link(k.sw, s.nw);
        link(k.se, s.ne);
      }
    }
  }
  // 沿海步道：沿 z = 12 一條線，與第二列街區的南側角落以斑馬線相連
  const promZ = (PROM.z0 + PROM.z1) / 2;
  const prom = [];
  for (let c = 0; c < COLS.length; c++) {
    const k = corner[`${c},1`];
    const pw = node(nodes[k.sw].x, PROM.z0 + h), pe = node(nodes[k.se].x, PROM.z0 + h);
    link(k.sw, pw);
    link(k.se, pe);
    prom.push(pw, pe);
  }
  const promLine = [];
  for (const p of prom) {
    const q = node(nodes[p].x, promZ);
    link(p, q);
    promLine.push(q);
  }
  // 步道兩端延伸到地圖外（路過的觀光客從這裡出入）
  const edgeW = node(-150, promZ, 'edge'), edgeE = node(150, promZ, 'edge');
  promLine.push(edgeW, edgeE);
  // 樓梯口與海灘商家入口
  const stairs = [];
  for (const x of STAIRS_X) {
    const top = node(x, promZ);
    const foot = node(x, RAIL_Z + 2.4, 'stair');
    link(top, foot);
    promLine.push(top);
    stairs.push(foot);
  }
  const deckIn = node(18, promZ);
  promLine.push(deckIn);
  const deck = node(18, 21.5, 'deck');
  link(deckIn, deck);
  promLine.sort((p, q) => nodes[p].x - nodes[q].x);
  for (let i = 1; i < promLine.length; i++) link(promLine[i - 1], promLine[i]);
  // 公車站
  const bus = node(-40, promZ, 'bus');
  const near = promLine.reduce((best, p) => (Math.abs(nodes[p].x + 40) < Math.abs(nodes[best].x + 40) && p !== bus ? p : best), promLine[0]);
  link(bus, near);

  return { nodes, adj, doors, homes, stairs, deck, edges: [edgeW, edgeE], bus };
}

// 每個節點對所有節點的最短路「下一步」表（節點只有一百多個，啟動時算一次）
export function buildNextHop(g) {
  const n = g.nodes.length;
  const next = new Int16Array(n * n).fill(-1);
  const dist = new Float32Array(n);
  for (let s = 0; s < n; s++) {
    dist.fill(Infinity);
    const prev = new Int16Array(n).fill(-1);
    dist[s] = 0;
    const done = new Uint8Array(n);
    for (;;) {
      let u = -1, best = Infinity;
      for (let i = 0; i < n; i++) if (!done[i] && dist[i] < best) { best = dist[i]; u = i; }
      if (u < 0) break;
      done[u] = 1;
      for (const e of g.adj[u]) {
        const nd = best + e.d;
        if (nd < dist[e.to]) { dist[e.to] = nd; prev[e.to] = u; }
      }
    }
    // 由 s 到 t 的第一步：沿 prev 回溯
    for (let t = 0; t < n; t++) {
      if (t === s || prev[t] < 0) continue;
      let v = t;
      while (prev[v] !== s && prev[v] >= 0) v = prev[v];
      next[s * n + t] = v;
    }
  }
  return (a, b) => {
    const out = [a];
    let v = a, guard = 0;
    while (v !== b && guard++ < 400) {
      v = next[v * n + b];
      if (v < 0) break;
      out.push(v);
    }
    return out;
  };
}

// 行人腳下的高度
export const DECK_Y = 0.95;
export function groundY(x, z) {
  const { deck } = BEACH.boat;
  if (x > deck.x0 && x < deck.x1 && z > deck.z0 && z < deck.z1) return DECK_Y;
  if (Math.abs(x - BEACH.boat.pier.x) < 2.2 && z >= deck.z1 && z < BEACH.boat.pier.z1) return DECK_Y;
  if (z >= PROM.z0 && z < PROM.z1) return PROM.y;
  if (z >= PROM.z1) return SAND_Y;
  for (const [x0, x1] of COLS) {
    if (x < x0 || x > x1) continue;
    for (const [z0, z1] of ROWS) if (z >= z0 && z <= z1) return 0.22;
  }
  return 0.02;
}

// ───────── 海港（防波堤以西）─────────
export const HARBOR = {
  x0: -300, x1: -140, z0: 17, z1: 57, y: 1.3,
  gateX: -172,
  berths: [-266, -214, -162],   // 各泊位船身中心 x；船身中心 z = 64
  shipZ: 64,
  craneZ: [48.5, 56.2],          // 岸橋兩條軌道
  anchor: [[-250, 150], [-200, 170], [-150, 150], [-290, 175]],
  spawn: [-560, 380],
  yard: { x0: -264, z: [23, 26.2, 29.4, 34.6, 37.8, 41], cols: 13, step: 6.6, tiers: 2 },
};
export const harborY = (x, z) => (x > HARBOR.x0 && x < HARBOR.x1 && z >= HARBOR.z0 && z < HARBOR.z1 ? HARBOR.y : z >= 7 && z < 17 ? 0.45 : 0.02);
