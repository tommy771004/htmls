// packages/sim/terrain.ts
var terrainRules = { provenance: "design_default", size: 16, tileSize: 100, maxLandStep: 25, resourceCapacity: { tree: 300, stone: 250, gold: 250, berries: 150, hunt: 120, livestock: 100, fish: 200 }, generationAttempts: 8 };
var resourceDefinitions = { tree: { yield: "wood", method: "gather", movement: "land" }, stone: { yield: "stone", method: "gather", movement: "land" }, gold: { yield: "gold", method: "gather", movement: "land" }, berries: { yield: "food", method: "gather", movement: "land" }, hunt: { yield: "food", method: "hunt", movement: "land" }, livestock: { yield: "food", method: "herd", movement: "land" }, fish: { yield: "food", method: "fish", movement: "water" } };
var terrainDefinitions = {
  grass: { walkClass: "land", buildability: true, height: 0 },
  road: { walkClass: "land", buildability: true, height: 0 },
  stone: { walkClass: "land", buildability: true, height: 0 },
  sand: { walkClass: "land", buildability: true, height: 0 },
  highland: { walkClass: "land", buildability: true, height: 100 },
  cliff: { walkClass: "blocked", buildability: false, height: 100 },
  water: { walkClass: "water", buildability: false, height: 0 },
  shallow: { walkClass: "both", buildability: false, height: 0 }
};
function createTiles(layout = "meadow", seed = 0) {
  if (!["meadow", "coast", "acceptance"].includes(layout)) throw Error("\u672A\u77E5\u5730\u5716\u6A21\u5F0F");
  return Array.from({ length: 256 }, (_, id) => {
    const x = id % 16, y = Math.floor(id / 16);
    let terrainType = y === 8 ? "road" : "grass";
    if (layout === "coast") {
      const edge = 12 + (seed >>> 0 >>> Math.floor(x / 4) & 1);
      if (y >= edge) terrainType = "water";
      else if (y === edge - 1) terrainType = "sand";
    }
    if (layout === "acceptance") {
      if (x === 7 || x === 8) terrainType = y >= 7 && y <= 9 ? "shallow" : "water";
      else if (x === 6 || x === 9) terrainType = "sand";
    }
    const tile = { id, terrainType, ...terrainDefinitions[terrainType], resourceRefs: [], obstacleRefs: [] };
    if (layout === "acceptance") {
      if (x >= 2 && x <= 5 && y >= 11 && y <= 14) {
        tile.terrainType = x === 2 && y === 11 ? "cliff" : x === 3 && y === 13 ? "stone" : "highland";
        Object.assign(tile, terrainDefinitions[tile.terrainType]);
        tile.height = 100;
      }
      if (x === 4 && y >= 8 && y <= 10) {
        tile.terrainType = "road";
        tile.height = (y - 7) * 25;
        tile.buildability = false;
      }
    }
    return tile;
  });
}
function tileAt(x, y) {
  return Math.floor(y / 100) * 16 + Math.floor(x / 100);
}
function canTraverse(tile, movement) {
  return tile.walkClass === movement || tile.walkClass === "both";
}

// packages/content/footprints.ts
var obstacleFootprints = {
  house: { x: -15, y: -15, width: 250, depth: 230 },
  "town-center": { x: -15, y: -15, width: 300, depth: 300 },
  tree: { x: -20, y: -20, width: 100, depth: 100 },
  rock: { x: 0, y: 0, width: 65, depth: 70 },
  gold: { x: 0, y: 0, width: 65, depth: 70 },
  berries: { x: 0, y: 0, width: 65, depth: 70 },
  hunt: { x: 0, y: 0, width: 65, depth: 70 },
  livestock: { x: 0, y: 0, width: 65, depth: 70 }
};
var townCenterBlocking = [
  [15, 15, 65, 165],
  [205, 15, 255, 165],
  [10, 10, 26, 26],
  [240, 10, 256, 26],
  [10, 180, 26, 196],
  [240, 180, 256, 196],
  // Arch flanks reach past the visible opening: 3D clearance for a villager on the plinth.
  [65, 150, 97, 175],
  [173, 150, 205, 175],
  [14, 190, 62, 198],
  [20, 198, 54, 201],
  [210, 210, 252, 252],
  [265, 270, 271, 276]
];
var walkablePlatforms = { "town-center": { rect: [-15, -15, 285, 285], height: 16 } };
var townCenterEntrance = { x: 135, y: 215 };
var footprintContract = { provenance: "design_default", obstacleFootprints, townCenterBlocking, walkablePlatforms, townCenterEntrance };
function check(o, radius) {
  if (!obstacleFootprints[o.kind] || !Number.isSafeInteger(radius) || radius < 0) throw Error("\u7121\u6548\u5360\u5730\u6216\u534A\u5F91");
}
function obstacleBounds(o, radius = 0) {
  check(o, radius);
  const f = obstacleFootprints[o.kind];
  return [o.x + f.x - radius, o.y + f.y - radius, o.x + f.x + f.width + radius, o.y + f.y + f.depth + radius];
}
function obstacleRects(o, radius = 0) {
  check(o, radius);
  if (o.kind !== "town-center") return [obstacleBounds(o, radius)];
  return townCenterBlocking.map(([x0, y0, x1, y1]) => [o.x + x0 - radius, o.y + y0 - radius, o.x + x1 + radius, o.y + y1 + radius]);
}

// packages/sim/vision.ts
function footprintTiles(o) {
  if (o.kind !== "house" && o.kind !== "town-center") return [tileAt(o.x, o.y)];
  const [x0, y0, x1, y1] = obstacleBounds(o), tiles = [];
  for (let ty = Math.max(0, Math.floor(y0 / 100)); ty <= Math.min(15, Math.floor((y1 - 1) / 100)); ty++) for (let tx = Math.max(0, Math.floor(x0 / 100)); tx <= Math.min(15, Math.floor((x1 - 1) / 100)); tx++) tiles.push(ty * 16 + tx);
  return tiles;
}
var visionRules = { provenance: "design_default", unitRadius: 400, houseRadius: 300, townCenterRadius: 300, shareVision: false, rememberStaticObjects: true };
function createVision() {
  return Array.from({ length: 2 }, () => ({ explored: [], visible: [], known: [], resources: [] }));
}
function updateVision(visions, map, units, tick2, sharing = [[0], [1]]) {
  if (sharing.length !== 2 || sharing.some((members, p) => !members.includes(p) || members.some((id) => !Number.isInteger(id) || id < 0 || id > 1))) throw Error("\u7121\u6548\u5171\u4EAB\u8996\u91CE\u898F\u5247");
  const own = [/* @__PURE__ */ new Set(), /* @__PURE__ */ new Set()];
  const reveal = (player, x, y, radius) => {
    for (let id = 0; id < 256; id++) {
      const dx = id % 16 * 100 + 50 - x, dy = Math.floor(id / 16) * 100 + 50 - y;
      if (dx * dx + dy * dy <= radius * radius) own[player].add(id);
    }
  };
  for (const u of units) reveal(u.player, u.x, u.y, visionRules.unitRadius);
  for (const o of map.obstacles) if (o.kind === "house") reveal(o.red ? 1 : 0, o.x + 100, o.y + 100, visionRules.houseRadius);
  else if (o.kind === "town-center") reveal(o.red ? 1 : 0, o.x + 135, o.y + 135, visionRules.townCenterRadius);
  for (let player = 0; player < 2; player++) {
    const vision = visions[player], visible = new Set(sharing[player].flatMap((id) => [...own[id]]));
    vision.resources = map.resources.filter((r) => r.status === "available" && visible.has(tileAt(r.x, r.y))).map((r) => ({ ...r }));
    vision.visible = [...visible].sort((a, b) => a - b);
    vision.explored = [.../* @__PURE__ */ new Set([...vision.explored, ...vision.visible])].sort((a, b) => a - b);
    const known = new Map(vision.known.filter((k) => !["hunt", "livestock"].includes(k.obstacle.kind) && !footprintTiles(k.obstacle).some((id) => visible.has(id))).map((k) => [k.obstacle.id, k]));
    for (const obstacle of map.obstacles) if (footprintTiles(obstacle).some((id) => visible.has(id))) known.set(obstacle.id, { obstacle: { ...obstacle }, lastSeenTick: tick2 });
    vision.known = [...known.values()].sort((a, b) => a.obstacle.id < b.obstacle.id ? -1 : a.obstacle.id > b.obstacle.id ? 1 : 0);
  }
}
function projectVision(vision) {
  const visible = new Set(vision.visible), explored = new Set(vision.explored);
  return { fog: Array.from({ length: 256 }, (_, id) => visible.has(id) ? 2 : explored.has(id) ? 1 : 0), known: structuredClone(vision.known), resources: structuredClone(vision.resources) };
}
function unitVisible(vision, unit, player) {
  return unit.player === player || vision.visible.includes(tileAt(unit.x, unit.y));
}

// packages/content/rules.ts
var resources = ["food", "wood", "gold", "stone"];
var entry = (id, kind, name, food = 0, wood = 0, gold = 0, stone = 0, requires = [], population = 0) => ({ referenceVersion: null, sourceEvidence: ["original design defaults: packages/content/rules.ts"], implementationStatus: id === "villager" ? "in_progress" : "not_started", testEvidence: ["tests/foundation.test.ts (data validation only)"], id, kind, name, cost: { food, wood, gold, stone }, time: 20, population, requires, verificationStatus: "design_default" });
var rules = {
  schemaVersion: 1,
  id: "brick-foundation-0.1",
  reference: { game: "Age of Empires II: Definitive Edition", version: null, build: null, contentPacks: [], verificationStatus: "unverified", sourceEvidence: [] },
  coverage: { contentDenominator: null, exactReferenceCoveragePercent: null },
  settings: { tickHz: 20, populationCap: 40, mapSize: 16, speed: 1, mode: "command-sandbox", seed: 260925, platform: "desktop browser", provenance: "design_default" },
  entries: [entry("villager", "unit", "\u6751\u6C11", 50, 0, 0, 0, [], 1), entry("town-center", "building", "\u57CE\u93AE\u4E2D\u5FC3", 0, 200, 0, 100), entry("house", "building", "\u6C11\u5C45", 0, 30), entry("barracks", "building", "\u5175\u71DF", 0, 150), entry("militia", "unit", "\u8FD1\u6230\u6C11\u5175", 60, 0, 20, 0, ["barracks"], 1), entry("archer", "unit", "\u5F13\u624B", 0, 40, 30, 0, ["age-2"], 1), entry("ram", "unit", "\u653B\u57CE\u69CC", 0, 160, 75, 0, ["age-3"], 3), entry("age-2", "technology", "\u7B2C\u4E8C\u6642\u4EE3", 300), entry("age-3", "technology", "\u7B2C\u4E09\u6642\u4EE3", 500, 0, 200, 0, ["age-2"]), entry("age-4", "technology", "\u7B2C\u56DB\u6642\u4EE3", 800, 0, 400, 0, ["age-3"])],
  civilizations: [{ id: "blue-settlement", available: ["villager", "town-center", "house", "barracks", "militia", "archer", "ram", "age-2", "age-3", "age-4"], unavailable: [] }, { id: "red-settlement", available: ["villager", "town-center", "house", "barracks", "militia", "archer", "ram", "age-2", "age-3", "age-4"], unavailable: [] }]
};

// packages/sim/economy.ts
var economyRules = { provenance: "design_default", initialStock: { food: 200, wood: 200, gold: 100, stone: 100 }, populationCap: rules.settings.populationCap, cancellationRefundPercent: 100 };
function createAccount(populationUsed) {
  return { stock: { ...economyRules.initialStock }, populationUsed, populationReserved: 0, populationCap: economyRules.populationCap, reservations: [] };
}
function reserve(account, id, entryId) {
  const entry2 = rules.entries.find((e) => e.id === entryId);
  if (!entry2 || typeof id !== "string" || !id || account.reservations.some((r) => r.id === id)) throw Error("\u7121\u6548\u6216\u91CD\u8907\u7684\u9810\u7559\u9805\u76EE");
  if (account.populationUsed + account.populationReserved + entry2.population > account.populationCap) throw Error("\u4EBA\u53E3\u5BB9\u91CF\u4E0D\u8DB3");
  for (const key of resources) if (!Number.isSafeInteger(account.stock[key]) || account.stock[key] < entry2.cost[key]) throw Error(`\u8CC7\u6E90\u4E0D\u8DB3\uFF1A${key}`);
  const record = { id, entryId, cost: { ...entry2.cost }, population: entry2.population, status: "reserved" };
  for (const key of resources) account.stock[key] -= record.cost[key];
  account.populationReserved += record.population;
  account.reservations.push(record);
}
function cancelReservation(account, id) {
  const r = account.reservations.find((r2) => r2.id === id);
  if (!r || r.status !== "reserved") throw Error("\u9810\u7559\u9805\u76EE\u4E0D\u5B58\u5728\u6216\u5DF2\u7D50\u675F");
  for (const key of resources) if (!Number.isSafeInteger(account.stock[key] + r.cost[key])) throw Error("\u9000\u6B3E\u8D85\u904E\u5B89\u5168\u6574\u6578\u7BC4\u570D");
  for (const key of resources) account.stock[key] += r.cost[key];
  account.populationReserved -= r.population;
  r.status = "cancelled";
}

// packages/sim/navigation.ts
var navigationRules = { provenance: "design_default", spacing: 50, size: 31, radius: 25, expansionsPerTick: 128, speedPerTick: 5, maxGroupSize: 40, waitLimit: 8, queueWaitFactor: 4, detourLimit: 12, stuckTicks: 300, arrivalRadius: 150 };
var startingResourceRules = { provenance: "design_default", maxApproachDistance: 1200, maxNearestDistanceDifference: 500, minimum: { tree: 300, stone: 250, gold: 250, berries: 150 } };
function makeMap(seed, layout = "meadow") {
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 4294967295) throw Error("\u5730\u5716 seed \u5FC5\u9808\u70BA uint32");
  let lastErrors = [];
  for (let attempt = 0; attempt < terrainRules.generationAttempts; attempt++) {
    const map = generateCandidate(seed + Math.imul(attempt, 2654435761) >>> 0, layout);
    map.generationAttempt = attempt;
    lastErrors = validateMap(map);
    if (!lastErrors.length) lastErrors = validateStartingResources(map).errors;
    if (!lastErrors.length) return map;
  }
  throw Error(`\u5730\u5716\u751F\u6210\u5931\u6557\uFF08${terrainRules.generationAttempts} \u6B21\uFF09\uFF1A${lastErrors.join("\uFF1B")}`);
}
function generateCandidate(seed, layout) {
  let rng = seed || 1;
  let obstacles = [{ kind: "town-center", x: 265, y: 350 }, { kind: "town-center", x: 1065, y: 350, red: true }];
  for (let x = 0; x < 16; x++) for (let y = 0; y < 16; y++) {
    rng ^= rng << 13;
    rng ^= rng >>> 17;
    rng ^= rng << 5;
    const v = (rng >>> 0) / 4294967296;
    if ((x < 2 || y < 2 || x > 13 || y > 13) && v < 0.34) obstacles.push({ kind: "tree", x: x * 100 + 12, y: y * 100 + 12 });
    else if (v < 0.028 && Math.abs(x - 8) < 3 && y > 3) obstacles.push({ kind: "rock", x: x * 100, y: y * 100 });
  }
  if (layout === "coast") obstacles = obstacles.filter((o) => o.y < 1e3);
  if (layout === "acceptance") obstacles = [...obstacles.slice(0, 2), { kind: "tree", x: 150, y: 250 }, { kind: "tree", x: 1350, y: 250 }, { kind: "rock", x: 500, y: 1100 }, { kind: "rock", x: 1050, y: 1100 }];
  const guaranteed = [{ kind: "tree", x: 150, y: 850 }, { kind: "tree", x: 1350, y: 850 }, { kind: "rock", x: 150, y: 1100 }, { kind: "rock", x: 1350, y: 1100 }];
  obstacles = obstacles.filter((o) => isBuilding(o) || !guaranteed.some((g) => Math.abs(g.x - o.x) < 140 && Math.abs(g.y - o.y) < 140));
  obstacles.push(...guaranteed);
  obstacles.push({ kind: "gold", x: 550, y: 200 }, { kind: "gold", x: 950, y: 200 }, { kind: "berries", x: 250, y: 1e3 }, { kind: "berries", x: 1250, y: 1e3 });
  const map = { obstacles, blocked: [], tiles: createTiles(layout, seed), resources: [], navigationRevision: 0, generationAttempt: 0 };
  obstacles.forEach((o, index) => {
    o.id = `obstacle-${index}`;
    map.tiles[tileAt(o.x, o.y)].obstacleRefs.push(o.id);
    if (!isBuilding(o)) {
      const kind = o.kind === "rock" ? "stone" : o.kind;
      const id = `resource-${index}`, capacity = terrainRules.resourceCapacity[kind];
      map.resources.push({ id, kind, x: o.x, y: o.y, capacity, remaining: capacity, collectible: true, status: "available", obstacleId: o.id, depletedAt: null });
      map.tiles[tileAt(o.x, o.y)].resourceRefs.push(id);
    }
  });
  const addResource = (kind, x, y) => {
    const id = `resource-${kind}-${x}-${y}`, capacity = terrainRules.resourceCapacity[kind], obstacleId = kind === "fish" ? null : `obstacle-${kind}-${x}-${y}`;
    if (obstacleId && kind !== "fish") {
      map.obstacles.push({ id: obstacleId, kind, x, y });
      map.tiles[tileAt(x, y)].obstacleRefs.push(obstacleId);
    }
    map.resources.push({ id, kind, x, y, capacity, remaining: capacity, collectible: true, status: "available", obstacleId, depletedAt: null });
    map.tiles[tileAt(x, y)].resourceRefs.push(id);
  };
  for (const x of [300, 1200]) addResource("livestock", x, 900);
  for (const x of [500, 1e3]) addResource("hunt", x, 1e3);
  if (layout === "coast") for (const x of [300, 1200]) addResource("fish", x, 1450);
  if (layout === "acceptance") for (const y of [300, 1200]) addResource("fish", 800, y);
  for (let i = 0; i < 961; i++) if (!clearSegment(map, position(i), position(i))) map.blocked.push(i);
  return map;
}
function isBuilding(o) {
  return o.kind === "house" || o.kind === "town-center";
}
function bounds(o) {
  return obstacleBounds(o, navigationRules.radius);
}
function clearSegment(map, a, b, movement = "land") {
  if ([a.x, a.y, b.x, b.y].some((v) => !Number.isSafeInteger(v) || v < 50 || v > 1550)) return false;
  const maxStep = movement === "land" ? terrainRules.maxLandStep : 0, radius = navigationRules.radius;
  for (const tile of map.tiles) {
    const x = tile.id % 16, y = Math.floor(tile.id / 16);
    if (x < 15 && Math.abs(tile.height - map.tiles[tile.id + 1].height) > maxStep && intersects(a, b, [(x + 1) * 100 - radius, y * 100 - radius, (x + 1) * 100 + radius, (y + 1) * 100 + radius])) return false;
    if (y < 15 && Math.abs(tile.height - map.tiles[tile.id + 16].height) > maxStep && intersects(a, b, [x * 100 - radius, (y + 1) * 100 - radius, (x + 1) * 100 + radius, (y + 1) * 100 + radius])) return false;
  }
  for (const tile of map.tiles) if (!canTraverse(tile, movement)) {
    const x = tile.id % 16 * 100, y = Math.floor(tile.id / 16) * 100, r = navigationRules.radius;
    if (intersects(a, b, [x - r, y - r, x + 100 + r, y + 100 + r])) return false;
  }
  for (const o of map.obstacles) for (const [x0, y0, x1, y1] of obstacleRects(o, navigationRules.radius)) {
    let lo = 0, hi = 1;
    for (const [start, delta, min, max] of [[a.x, b.x - a.x, x0, x1], [a.y, b.y - a.y, y0, y1]]) {
      if (delta === 0) {
        if (start < min || start > max) {
          lo = 2;
          break;
        }
      } else {
        const t0 = (min - start) / delta, t1 = (max - start) / delta;
        lo = Math.max(lo, Math.min(t0, t1));
        hi = Math.min(hi, Math.max(t0, t1));
      }
    }
    if (lo <= hi) return false;
  }
  return true;
}
function intersects(a, b, box) {
  let lo = 0, hi = 1;
  for (const [start, delta, min, max] of [[a.x, b.x - a.x, box[0], box[2]], [a.y, b.y - a.y, box[1], box[3]]]) {
    if (delta === 0) {
      if (start < min || start > max) return false;
    } else {
      const p = (min - start) / delta, q = (max - start) / delta;
      lo = Math.max(lo, Math.min(p, q));
      hi = Math.min(hi, Math.max(p, q));
    }
  }
  return lo <= hi;
}
function validateMap(map) {
  const errors = [];
  if (map.tiles.length !== 256 || map.tiles.some((t, i) => t.id !== i)) return ["\u5730\u683C\u6578\u91CF\u6216 ID \u4E0D\u7B26"];
  const obstacles = new Set(map.obstacles.map((o) => o.id)), resources2 = new Set(map.resources.map((r) => r.id));
  if (obstacles.size !== map.obstacles.length || obstacles.has(void 0)) errors.push("\u969C\u7919 ID \u91CD\u8907\u6216\u7F3A\u5C11");
  if (resources2.size !== map.resources.length) errors.push("\u8CC7\u6E90 ID \u91CD\u8907");
  for (const tile of map.tiles) {
    if (!Number.isSafeInteger(tile.height) || tile.height < 0) errors.push(`\u5730\u683C ${tile.id} \u9AD8\u5EA6\u7121\u6548`);
    if (!["land", "water", "both", "blocked"].includes(tile.walkClass) || typeof tile.buildability !== "boolean") errors.push(`\u5730\u683C ${tile.id} \u901A\u884C\u6216\u5EFA\u9020\u898F\u5247\u7121\u6548`);
    if (tile.resourceRefs.some((id) => !resources2.has(id)) || tile.obstacleRefs.some((id) => !obstacles.has(id))) errors.push(`\u5730\u683C ${tile.id} \u53C3\u7167\u5931\u6548`);
  }
  for (const r of map.resources) {
    if (!resourceDefinitions[r.kind]) {
      errors.push(`\u8CC7\u6E90 ${r.id} \u985E\u5225\u7121\u6548`);
      continue;
    }
    const cell = map.tiles[tileAt(r.x, r.y)];
    if (!cell || !canTraverse(cell, resourceDefinitions[r.kind].movement)) errors.push(`\u8CC7\u6E90 ${r.id} \u5730\u5F62\u4E0D\u7B26`);
    if (!Number.isSafeInteger(r.capacity) || r.capacity <= 0 || !Number.isSafeInteger(r.remaining) || r.remaining < 0 || r.remaining > r.capacity) errors.push(`\u8CC7\u6E90 ${r.id} \u5BB9\u91CF\u7121\u6548`);
    if (r.status === "depleted" !== (r.remaining === 0) || r.collectible !== r.remaining > 0 || r.status === "depleted" && (r.obstacleId !== null || r.depletedAt === null)) errors.push(`\u8CC7\u6E90 ${r.id} \u72C0\u614B\u4E0D\u4E00\u81F4`);
    if (r.obstacleId && !obstacles.has(r.obstacleId)) errors.push(`\u8CC7\u6E90 ${r.id} \u969C\u7919\u53C3\u7167\u5931\u6548`);
    if (!map.tiles[tileAt(r.x, r.y)]?.resourceRefs.includes(r.id)) errors.push(`\u8CC7\u6E90 ${r.id} \u5730\u683C\u53C3\u7167\u5931\u6548`);
  }
  const spawns = [{ x: 350, y: 700 }, { x: 450, y: 700 }, { x: 400, y: 800 }, { x: 1150, y: 700 }];
  if (spawns.some((p) => !clearSegment(map, p, p))) errors.push("\u51FA\u751F\u9EDE\u4E0D\u53EF\u901A\u884C");
  else {
    const job = createPathJob(map, 0, spawns[0], spawns[3]);
    advancePathJob(map, job, 961);
    if (job.status !== "found") errors.push("\u73A9\u5BB6\u51FA\u751F\u5340\u4E92\u4E0D\u9023\u901A");
  }
  return errors;
}
function position(id) {
  return { x: 50 + id % 31 * 50, y: 50 + Math.floor(id / 31) * 50 };
}
function validateStartingResources(map) {
  const errors = [];
  const players = [{ x: 350, y: 700 }, { x: 1150, y: 700 }].map((spawn, player) => {
    const distances = Array(961).fill(Infinity), start = nearest(map, spawn), frontier = [];
    if (start >= 0) {
      distances[start] = Math.abs(position(start).x - spawn.x) + Math.abs(position(start).y - spawn.y);
      frontier.push(start);
    }
    for (let head = 0; head < frontier.length; head++) {
      const id = frontier[head], x = id % 31, y = Math.floor(id / 31);
      for (const next of [x < 30 ? id + 1 : -1, y < 30 ? id + 31 : -1, x > 0 ? id - 1 : -1, y > 0 ? id - 31 : -1]) if (next >= 0 && !Number.isFinite(distances[next]) && !map.blocked.includes(next) && clearSegment(map, position(id), position(next))) {
        distances[next] = distances[id] + 50;
        frontier.push(next);
      }
    }
    const access = Object.entries(startingResourceRules.minimum).map(([kind, minimum]) => {
      const nodes = map.resources.filter((r) => r.kind === kind && r.collectible && r.remaining > 0).map((resource) => {
        const obstacle = map.obstacles.find((o) => o.id === resource.obstacleId);
        if (!obstacle) return { id: resource.id, remaining: resource.remaining, distance: Infinity, approach: null };
        const [x0, y0, x1, y1] = bounds(obstacle);
        let distance = Infinity, approach = null;
        for (let i = 0; i < 961; i++) {
          if (!Number.isFinite(distances[i])) continue;
          const p = position(i), gap = Math.max(x0 - p.x, 0, p.x - x1) + Math.max(y0 - p.y, 0, p.y - y1);
          if (gap > 0 && gap <= 50 && distances[i] < distance) {
            distance = distances[i];
            approach = p;
          }
        }
        return { id: resource.id, remaining: resource.remaining, distance, approach };
      }).filter((n) => n.distance <= startingResourceRules.maxApproachDistance);
      const available = nodes.reduce((sum, n) => sum + n.remaining, 0), nearestDistance = nodes.length ? Math.min(...nodes.map((n) => n.distance)) : null;
      if (available < minimum) errors.push(`\u73A9\u5BB6 ${player} \u8D77\u59CB ${kind} \u53EF\u9054\u5BB9\u91CF\u4E0D\u8DB3\uFF1A${available}/${minimum}`);
      return { kind, minimum, available, nearestDistance, nodes };
    });
    return { player, spawn, access };
  });
  for (let i = 0; i < players[0].access.length; i++) {
    const a = players[0].access[i], b = players[1].access[i];
    if (a.nearestDistance !== null && b.nearestDistance !== null && Math.abs(a.nearestDistance - b.nearestDistance) > startingResourceRules.maxNearestDistanceDifference) errors.push(`\u96D9\u65B9 ${a.kind} \u6700\u8FD1\u8DEF\u7A0B\u5DEE\u8D85\u51FA\u9650\u5236`);
  }
  return { rules: startingResourceRules, errors, players };
}
function connector(map, a, b, movement) {
  const elbow = { x: b.x, y: a.y };
  return clearSegment(map, a, elbow, movement) && clearSegment(map, elbow, b, movement);
}
function nearest(map, p, outbound = true, movement = "land") {
  let best = -1, distance = Infinity;
  for (let i = 0; i < 961; i++) {
    const q = position(i), d = Math.abs(p.x - q.x) + Math.abs(p.y - q.y);
    if (d < distance && !(movement === "land" ? map.blocked.includes(i) : !clearSegment(map, q, q, movement)) && (outbound ? connector(map, p, q, movement) : connector(map, q, p, movement))) {
      best = i;
      distance = d;
    }
  }
  return best;
}
function createPathJob(map, unitId, from, target, movement = "land") {
  const start = nearest(map, from, true, movement), goal = nearest(map, target, false, movement), parents = Array(961).fill(-2);
  if (start >= 0) parents[start] = -1;
  return { ...movement === "water" ? { movement } : {}, unitId, start, goal, target: { ...target }, frontier: start < 0 ? [] : [start], head: 0, parents, status: start < 0 || goal < 0 ? "unreachable" : "searching", path: [] };
}
function advancePathJob(map, job, budget) {
  if (!Number.isSafeInteger(budget) || budget < 0) throw Error("\u7121\u6548\u5C0B\u8DEF\u9810\u7B97");
  let used = 0;
  while (job.status === "searching" && used < budget) {
    if (job.head === job.frontier.length) {
      job.status = "unreachable";
      break;
    }
    const id = job.frontier[job.head++];
    used++;
    if (id === job.goal) {
      const path = [];
      let cursor = id;
      while (cursor !== -1) {
        path.push(position(cursor));
        cursor = job.parents[cursor];
      }
      job.path = path.reverse();
      if (job.path.at(-1).x !== job.target.x || job.path.at(-1).y !== job.target.y) job.path.push({ ...job.target });
      job.status = "found";
      break;
    }
    const x = id % 31, y = Math.floor(id / 31);
    for (const next of [x < 30 ? id + 1 : -1, y < 30 ? id + 31 : -1, x > 0 ? id - 1 : -1, y > 0 ? id - 31 : -1]) if (next >= 0 && job.parents[next] === -2 && !(job.movement === "water" ? !clearSegment(map, position(next), position(next), "water") : map.blocked.includes(next)) && clearSegment(map, position(id), position(next), job.movement ?? "land")) {
      job.parents[next] = id;
      job.frontier.push(next);
    }
  }
  return used;
}

// packages/sim/movement.ts
var navigationStates = ["idle", "searching", "moving", "waiting", "unreachable", "stuck"];
var NODES = 961;
var SIDE = 31;
var graphs = /* @__PURE__ */ new WeakMap();
function graph(map) {
  let g = graphs.get(map);
  if (!g || g.revision !== map.navigationRevision) {
    const blocked = new Uint8Array(NODES), open = new Uint8Array(NODES * 2);
    for (const n of map.blocked) blocked[n] = 1;
    for (let id = 0; id < NODES; id++) {
      if (blocked[id]) continue;
      const x = id % SIDE, y = Math.floor(id / SIDE);
      if (x < SIDE - 1 && !blocked[id + 1] && clearSegment(map, position(id), position(id + 1))) open[id * 2] = 1;
      if (y < SIDE - 1 && !blocked[id + SIDE] && clearSegment(map, position(id), position(id + SIDE))) open[id * 2 + 1] = 1;
    }
    g = { revision: map.navigationRevision, blocked, open };
    graphs.set(map, g);
  }
  return g;
}
function neighbours(map, id) {
  const { open } = graph(map), x = id % SIDE, out = [];
  if (open[id * 2]) out.push(id + 1);
  if (open[id * 2 + 1]) out.push(id + SIDE);
  if (x > 0 && open[(id - 1) * 2]) out.push(id - 1);
  if (id >= SIDE && open[(id - SIDE) * 2 + 1]) out.push(id - SIDE);
  return out;
}
function nodeAt(p) {
  const x = (p.x - 50) / 50, y = (p.y - 50) / 50;
  return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && x < SIDE && y >= 0 && y < SIDE ? y * SIDE + x : -1;
}
function makeUnit(id, player, x, y) {
  const node = nodeAt({ x, y });
  if (node < 0) throw Error("\u55AE\u4F4D\u5FC5\u9808\u7AD9\u5728\u5C0E\u822A\u7BC0\u9EDE\u4E0A");
  return { id, player, x, y, node, next: null, path: [], goal: null, target: null, navigation: "idle", wait: 0, detours: 0, partial: false, order: 0, outcome: null };
}
function search(start) {
  const parent = Array(NODES).fill(-2);
  parent[start] = -1;
  return { frontier: [start], head: 0, parent };
}
function held(units, except) {
  const nodes = /* @__PURE__ */ new Set();
  for (const u of units) if (!except.has(u.id)) {
    nodes.add(u.node);
    if (u.next !== null) nodes.add(u.next);
  }
  return [...nodes].sort((a, b) => a - b);
}
function cancel(s, id) {
  for (const job of s.pathJobs) if (job.kind === "group") job.unitIds = job.unitIds.filter((u) => u !== id);
  s.pathJobs = s.pathJobs.filter((j) => j.kind === "group" ? j.unitIds.length > 0 : j.unitId !== id);
}
function commandMove(s, unitIds, target) {
  const goal = nearest(s.map, target, false);
  if (goal < 0) throw Error("\u76EE\u6A19\u9644\u8FD1\u6C92\u6709\u53EF\u7AD9\u7ACB\u7684\u7BC0\u9EDE");
  const group = new Set(unitIds), units = unitIds.map((id) => s.units.find((u) => u.id === id));
  for (const u of units) {
    cancel(s, u.id);
    Object.assign(u, { path: [], goal: null, target: null, navigation: "searching", wait: 0, detours: 0, partial: false, order: s.nextJobId, outcome: null });
  }
  s.pathJobs.push({ kind: "group", id: s.nextJobId++, unitIds: [...unitIds], goal, starts: units.map((u) => u.next ?? u.node), held: held(s.units, group), slots: [], status: "searching", ...search(goal) });
}
function commandStop(s, unitIds) {
  for (const id of unitIds) {
    const u = s.units.find((u2) => u2.id === id);
    cancel(s, id);
    Object.assign(u, { path: [], goal: null, target: null, wait: 0, detours: 0, partial: false, outcome: null, navigation: u.next === null ? "idle" : "moving" });
  }
}
function advance(s, job, budget) {
  let used = 0;
  while (job.status === "searching" && used < budget) {
    if (job.kind === "group" && job.slots.length >= job.unitIds.length && job.starts.every((n) => job.parent[n] !== -2)) {
      job.status = "done";
      break;
    }
    if (job.head === job.frontier.length) {
      job.status = "done";
      break;
    }
    const id = job.frontier[job.head++];
    used++;
    if (job.kind === "group") {
      if (job.slots.length < job.unitIds.length && !job.held.includes(id)) job.slots.push(id);
    } else {
      const g = job.goal, d = (n) => Math.abs(n % SIDE - g % SIDE) + Math.abs(Math.floor(n / SIDE) - Math.floor(g / SIDE));
      if (d(id) < d(job.best)) job.best = id;
      if (id === g) {
        job.status = "done";
        break;
      }
    }
    for (const next of neighbours(s.map, id)) if (job.parent[next] === -2 && !(job.kind === "unit" && job.excluded.includes(next))) {
      job.parent[next] = id;
      job.frontier.push(next);
    }
  }
  return used;
}
function chain(parent, from) {
  const out = [from];
  while (parent[out.at(-1)] >= 0) out.push(parent[out.at(-1)]);
  return out;
}
function finishGroup(s, job) {
  const order = new Map(job.frontier.map((n, i) => [n, i]));
  const units = job.unitIds.map((id) => s.units.find((u) => u.id === id)), start = (u) => u.next ?? u.node;
  const reached = units.filter((u) => order.has(start(u))).sort((a, b) => order.get(start(a)) - order.get(start(b)) || a.id - b.id);
  const cx = reached.reduce((t, u) => t + position(start(u)).x, 0) / Math.max(1, reached.length), cy = reached.reduce((t, u) => t + position(start(u)).y, 0) / Math.max(1, reached.length);
  const far = (n) => Math.abs(position(n).x - cx) + Math.abs(position(n).y - cy);
  const slots = job.slots.slice(0, reached.length).sort((a, b) => far(b) - far(a) || order.get(a) - order.get(b));
  reached.forEach((u, i) => {
    const slot = slots[i];
    if (slot === void 0) {
      Object.assign(u, { navigation: u.next === null ? "unreachable" : "moving", partial: true });
      return;
    }
    const up = chain(job.parent, start(u)), down = chain(job.parent, slot), index = new Map(down.map((n, k) => [n, k]));
    let i2 = 0;
    while (!index.has(up[i2])) i2++;
    u.path = [...up.slice(1, i2 + 1), ...down.slice(0, index.get(up[i2])).reverse()];
    Object.assign(u, { goal: slot, target: position(slot), partial: false, navigation: u.path.length || u.next !== null ? "moving" : "idle" });
  });
  for (const u of units) if (!order.has(start(u))) s.pathJobs.push(unitJob(s, u, job.goal, [], []));
}
function unitJob(s, u, goal, excluded, keep) {
  const start = u.next ?? u.node;
  return { kind: "unit", id: s.nextJobId++, unitId: u.id, start, goal, excluded, best: start, keep, status: "searching", ...search(start) };
}
function finishUnit(s, job) {
  const u = s.units.find((u2) => u2.id === job.unitId), end = job.parent[job.goal] !== -2 ? job.goal : job.best;
  const path = chain(job.parent, end).reverse().slice(1);
  if (job.keep.length && (end !== job.goal || !path.length)) {
    u.path = job.keep;
    u.navigation = "waiting";
    return;
  }
  u.path = path;
  u.goal = u.goal ?? job.goal;
  u.partial = end !== job.goal;
  u.target = position(end);
  u.navigation = path.length || u.next !== null ? "moving" : u.partial ? "unreachable" : "idle";
}
function stepMovement(s) {
  s.pathJobs.sort((a, b) => a.id - b.id);
  let budget = navigationRules.expansionsPerTick, expanded = 0;
  while (budget > 0 && s.pathJobs.some((j) => j.status === "searching")) for (const job of s.pathJobs) {
    if (budget <= 0) break;
    if (job.status === "searching") {
      const n = advance(s, job, 1);
      budget -= n;
      expanded += n;
    }
  }
  for (const job of s.pathJobs.filter((j) => j.status === "done")) job.kind === "group" ? finishGroup(s, job) : finishUnit(s, job);
  s.pathJobs = s.pathJobs.filter((j) => j.status === "searching");
  const searching = new Set(s.pathJobs.flatMap((j) => j.kind === "group" ? j.unitIds : [j.unitId]));
  const owner = new Int32Array(NODES);
  for (const u of s.units) {
    owner[u.node] = u.id;
    if (u.next !== null) owner[u.next] = u.id;
  }
  const byId = new Map(s.units.map((u) => [u.id, u]));
  function tryReserve(u) {
    if (!u.path.length || searching.has(u.id)) return;
    const n = u.path[0], o = owner[n];
    if (o === 0 || o === u.id) {
      owner[n] = u.id;
      u.next = n;
      u.path.shift();
      u.navigation = "moving";
      u.wait = 0;
      return;
    }
    const b = byId.get(o), idleFriend = b.player === u.player && b.next === null && !b.path.length && !searching.has(b.id);
    const settledMate = idleFriend && b.order === u.order && (b.navigation === "idle" || b.navigation === "stuck");
    const toGoal = u.goal === null ? Infinity : Math.abs(position(u.goal).x - position(u.node).x) + Math.abs(position(u.goal).y - position(u.node).y);
    if (settledMate && toGoal <= navigationRules.arrivalRadius) {
      Object.assign(u, { path: [], goal: null, target: null, navigation: "idle", wait: 0 });
      return;
    }
    if (idleFriend) {
      const free = neighbours(s.map, b.node).filter((c) => owner[c] === 0), step = free.find((c) => !u.path.includes(c));
      if (step !== void 0) b.path = [step];
      else if (settledMate && u.goal !== null && u.goal !== n) {
        Object.assign(b, { path: u.path.slice(1), goal: u.goal, target: position(u.goal), outcome: null });
        Object.assign(u, { path: [n], goal: n, target: position(n) });
      } else if (free.length) b.path = [free[0]];
    }
    if (b.player === u.player && b.order === u.order && b.next === null && b.path[0] === u.node && !searching.has(b.id)) {
      const mine = u.path.slice(1), theirs = b.path.slice(1), goal = u.goal;
      Object.assign(u, { path: theirs, goal: b.goal, target: b.goal === null ? null : position(b.goal) });
      Object.assign(b, { path: mine, goal, target: goal === null ? null : position(goal) });
      for (const v of [u, b]) if (!v.path.length) Object.assign(v, { goal: null, target: null, navigation: v.partial ? "unreachable" : "idle", wait: 0 });
      tryReserve(u);
      return;
    }
    u.wait++;
    u.navigation = "waiting";
    if (u.wait >= navigationRules.stuckTicks) {
      Object.assign(u, { path: [], goal: null, target: null, navigation: "stuck", partial: false, outcome: "stuck", wait: 0 });
      return;
    }
    const queued = b.next !== null || b.path.length > 0 || searching.has(b.id);
    if (u.wait % (navigationRules.waitLimit * (queued ? navigationRules.queueWaitFactor : 1) * (u.id < o ? 2 : 1)) !== 0 || u.detours >= navigationRules.detourLimit) return;
    u.detours++;
    const excluded = [.../* @__PURE__ */ new Set([...s.units.filter((v) => v !== u && v.next === null).map((v) => v.node), b.node, ...b.next === null ? [] : [b.next]])].sort((a, b2) => a - b2);
    s.pathJobs.push(unitJob(s, u, u.goal ?? u.path.at(-1), excluded, u.path));
    u.path = [];
    u.navigation = "searching";
    searching.add(u.id);
  }
  for (const u of [...s.units].sort((a, b) => a.id - b.id)) {
    if (u.next === null) tryReserve(u);
    if (u.next === null) continue;
    const target = position(u.next), step = navigationRules.speedPerTick;
    const p = { x: u.x + Math.sign(target.x - u.x) * Math.min(step, Math.abs(target.x - u.x)), y: u.y + Math.sign(target.y - u.y) * Math.min(step, Math.abs(target.y - u.y)) };
    if (!clearSegment(s.map, u, p)) throw Error(`entity ${u.id}: \u975E\u6CD5\u78B0\u649E\u8DEF\u5F91`);
    u.x = p.x;
    u.y = p.y;
    if (u.x === target.x && u.y === target.y) {
      if (owner[u.node] === u.id) owner[u.node] = 0;
      u.node = u.next;
      u.next = null;
      if (u.path.length) tryReserve(u);
      else if (!searching.has(u.id)) {
        u.navigation = u.outcome === "stuck" ? "stuck" : u.partial ? "unreachable" : "idle";
        u.target = null;
        u.goal = null;
        u.wait = 0;
      }
    }
  }
  return { expanded };
}

// packages/sim/sim.ts
function canonical(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  return "{" + Object.keys(value).sort().map((k) => JSON.stringify(k) + ":" + canonical(value[k])).join(",") + "}";
}
function hash(value) {
  let h = 2166136261;
  for (const c of canonical(value)) {
    h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}
var rulesetHash = hash({ rules, navigationRules, economyRules, terrainRules, terrainDefinitions, resourceDefinitions, visionRules, startingResourceRules, footprints: footprintContract, simulationVersion: 11 });
function createState(seed, layout = "meadow") {
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 4294967295) throw Error("seed \u5FC5\u9808\u70BA uint32");
  const state = { version: 11, layout, vision: createVision(), accounts: [createAccount(3), createAccount(1)], transactions: [], map: makeMap(seed, layout), pathJobs: [], nextJobId: 1, seed, rng: seed || 1, tick: 0, sequence: [0, 0], units: [makeUnit(1, 0, 350, 700), makeUnit(2, 0, 450, 700), makeUnit(3, 0, 400, 800), makeUnit(4, 1, 1150, 700)], queue: [], log: [] };
  updateVision(state.vision, state.map, state.units, 0);
  return state;
}
function submit(state, c) {
  if (!c || c.protocolVersion !== 1 || c.rulesetHash !== rulesetHash) throw Error("\u547D\u4EE4\u7248\u672C\u4E0D\u7B26");
  if (!Number.isSafeInteger(c.playerId) || c.playerId < 0 || c.playerId > 1) throw Error("\u7121\u6548\u73A9\u5BB6");
  if (!Number.isSafeInteger(c.sequence) || c.sequence !== state.sequence[c.playerId] + 1) throw Error("\u91CD\u8907\u6216\u932F\u5E8F\u547D\u4EE4");
  if (!Number.isSafeInteger(c.targetTick) || c.targetTick <= state.tick || c.targetTick > state.tick + 200) throw Error("\u547D\u4EE4\u5DF2\u904E\u671F\u6216\u904E\u9060");
  if (!c.payload) throw Error("\u7F3A\u5C11 payload");
  if (c.commandType === "move" || c.commandType === "stop") {
    const ids = c.payload.unitIds;
    if (!Array.isArray(ids) || !ids.length || ids.length > navigationRules.maxGroupSize || !ids.every((id, i) => Number.isSafeInteger(id) && (i === 0 || id > ids[i - 1]))) throw Error(`\u55AE\u4F4D\u6E05\u55AE\u9700\u70BA 1\u2013${navigationRules.maxGroupSize} \u500B\u905E\u589E\u4E14\u4E0D\u91CD\u8907\u7684 ID`);
    for (const id of ids) {
      const u = state.units.find((u2) => u2.id === id);
      if (!u || u.player !== c.playerId) throw Error("\u4E0D\u53EF\u63A7\u5236\u6575\u65B9\u6216\u4E0D\u5B58\u5728\u7684\u55AE\u4F4D");
    }
  }
  if (c.commandType === "move") {
    for (const k of ["x", "y"]) if (!Number.isSafeInteger(c.payload[k]) || c.payload[k] < 50 || c.payload[k] > 1550) throw Error("\u76EE\u6A19\u8D85\u51FA\u5730\u5716");
    if (!clearSegment(state.map, c.payload, c.payload)) throw Error("\u76EE\u6A19\u4F4D\u65BC\u5EFA\u7BC9\u3001\u8CC7\u6E90\u6216\u4E0D\u53EF\u901A\u884C\u5730\u5F62\u7684\u5360\u5730\u5167");
  } else if (c.commandType === "stop") {
  } else if (c.commandType === "reserve") {
    if (!rules.entries.some((e) => e.id === c.payload.entryId)) throw Error("\u672A\u77E5\u9810\u7559\u5167\u5BB9");
  } else if (c.commandType === "cancelReservation") {
    if (typeof c.payload.reservationId !== "string" || !c.payload.reservationId.startsWith(`${c.playerId}:`)) throw Error("\u4E0D\u53EF\u53D6\u6D88\u6575\u65B9\u6216\u7121\u6548\u7684\u9810\u7559");
  } else throw Error("\u4E0D\u652F\u63F4\u7684\u547D\u4EE4");
  const copy = structuredClone(c);
  delete copy.acceptedTick;
  state.queue.push(copy);
  state.queue.sort((a, b) => a.targetTick - b.targetTick || a.playerId - b.playerId || a.sequence - b.sequence);
  state.log.push({ ...structuredClone(copy), acceptedTick: state.tick });
  state.sequence[c.playerId] = c.sequence;
}
function tick(s) {
  s.tick++;
  s.queue.sort((a, b) => a.targetTick - b.targetTick || a.playerId - b.playerId || a.sequence - b.sequence);
  while (s.queue.length && s.queue[0].targetTick === s.tick) {
    const c = s.queue.shift();
    if (c.commandType === "move") {
      commandMove(s, c.payload.unitIds, { x: c.payload.x, y: c.payload.y });
      continue;
    }
    if (c.commandType === "stop") {
      commandStop(s, c.payload.unitIds);
      continue;
    }
    {
      const result = { tick: s.tick, playerId: c.playerId, sequence: c.sequence, ok: true };
      try {
        if (c.commandType === "reserve") reserve(s.accounts[c.playerId], `${c.playerId}:${c.sequence}`, c.payload.entryId);
        else cancelReservation(s.accounts[c.playerId], c.payload.reservationId);
      } catch (e) {
        result.ok = false;
        result.error = e.message;
      }
      s.transactions.push(result);
      continue;
    }
  }
  const stats = stepMovement(s);
  updateVision(s.vision, s.map, s.units, s.tick);
  return stats;
}
function replay(seed, commands, ticks, layout = "meadow") {
  if (!Number.isSafeInteger(ticks) || ticks < 0 || ticks > 1e5 || !Array.isArray(commands) || commands.length > 1e4) throw Error("\u7121\u6548\u91CD\u64AD\u7BC4\u570D");
  const s = createState(seed, layout);
  let previousTick = 0;
  for (const c of commands) {
    if (!c || !Number.isSafeInteger(c.acceptedTick) || c.acceptedTick < previousTick || c.acceptedTick > ticks) throw Error("\u7121\u6548\u547D\u4EE4\u63A5\u6536\u6642\u9593");
    while (s.tick < c.acceptedTick) tick(s);
    submit(s, c);
    previousTick = c.acceptedTick;
  }
  while (s.tick < ticks) tick(s);
  return s;
}
function serialize(s) {
  if (s.tick > 1e5 || s.log.length > 1e4) throw Error("\u5DF2\u8D85\u904E\u6B64\u968E\u6BB5\u6C99\u76D2\u5B58\u6A94\u5BB9\u91CF\uFF08100000 ticks / 10000 \u6307\u4EE4\uFF09");
  return JSON.stringify({ format: "brick-sandbox-11", rulesetHash, state: s, checksum: hash(s) });
}
function deserialize(raw) {
  const v = JSON.parse(raw);
  if (!v || v.format !== "brick-sandbox-11" || v.rulesetHash !== rulesetHash || !v.state || v.checksum !== hash(v.state)) throw Error("\u5B58\u6A94\u7248\u672C\u4E0D\u7B26\u6216\u5167\u5BB9\u640D\u58DE");
  const s = v.state;
  if (s.version !== 11 || !Number.isSafeInteger(s.tick) || s.tick < 0 || s.tick > 1e5 || !Array.isArray(s.log) || s.log.length > 1e4) throw Error("\u7121\u6548\u5B58\u6A94\u72C0\u614B");
  const rebuilt = replay(s.seed, s.log, s.tick, s.layout);
  if (hash(rebuilt) !== hash(s)) throw Error("\u5B58\u6A94\u72C0\u614B\u7121\u6CD5\u7531\u547D\u4EE4\u91CD\u5EFA");
  return structuredClone(s);
}

// packages/sim/protocol.ts
function createService() {
  let state = createState(260925), lastId = 0;
  return (raw) => {
    const req = raw;
    try {
      if (!req || req.protocol !== 1 || !Number.isSafeInteger(req.id) || req.id <= lastId) throw Error("\u8A0A\u606F\u7248\u672C\u6216 request ID \u7121\u6548");
      lastId = req.id;
      const op = req.operation;
      if (!op || typeof op.kind !== "string") throw Error("\u7F3A\u5C11 operation");
      let accepted, commands, snapshot, replayMatches;
      switch (op.kind) {
        case "move":
        case "stop":
          if (state.log.length >= 1e4) throw Error("\u5DF2\u9054\u6C99\u76D2 10000 \u6307\u4EE4\u4E0A\u9650\uFF0C\u8ACB\u5132\u5B58\u6216\u91CD\u5EFA");
          {
            const envelope = { acceptedTick: state.tick, protocolVersion: 1, rulesetHash, playerId: 0, sequence: state.sequence[0] + 1, targetTick: state.tick + 1 };
            const command = op.kind === "move" ? { ...envelope, commandType: "move", payload: { unitIds: op.unitIds, x: op.x, y: op.y } } : { ...envelope, commandType: "stop", payload: { unitIds: op.unitIds } };
            submit(state, command);
            accepted = command;
          }
          break;
        case "advance":
          if (!Number.isSafeInteger(op.count) || op.count < 1 || op.count > 20 || state.tick + op.count > 1e5) throw Error("\u6B65\u9032\u9700\u70BA 1\u201320 ticks\uFF0C\u7E3D\u91CF\u4E0D\u5F97\u8D85\u904E 100000");
          for (let i = 0; i < op.count; i++) tick(state);
          break;
        case "reset":
          state = createState(op.seed, op.layout);
          commands = [];
          break;
        case "restore":
          state = deserialize(op.snapshot);
          commands = structuredClone(state.log);
          break;
        case "recover": {
          if (!op.checkpoint) throw Error("\u7F3A\u5C11\u6062\u5FA9\u9EDE");
          const candidate = replay(op.checkpoint.seed, op.checkpoint.commands, op.checkpoint.ticks, op.checkpoint.layout);
          state = candidate;
          commands = structuredClone(state.log);
          break;
        }
        case "snapshot":
          snapshot = serialize(state);
          break;
        case "replay":
          replayMatches = hash(replay(state.seed, state.log, state.tick, state.layout)) === hash(state);
          break;
        default:
          throw Error("\u4E0D\u652F\u63F4\u7684 operation");
      }
      const visibleUnits = state.units.filter((u) => unitVisible(state.vision[0], u, 0));
      const positions = new Int32Array(visibleUnits.length * 7);
      visibleUnits.forEach((u, i) => positions.set([u.id, u.player, u.x, u.y, u.target?.x ?? -1, u.target?.y ?? -1, navigationStates.indexOf(u.navigation)], i * 7));
      return { protocol: 1, id: req.id, ok: true, seed: state.seed, layout: state.layout, terrain: state.map.tiles.map(({ terrainType, height, walkClass, buildability }) => ({ terrainType, height, walkClass, buildability })), tick: state.tick, stateHash: hash(state), positions: positions.buffer, ...projectVision(state.vision[0]), accepted, commands, snapshot, replayMatches };
    } catch (error) {
      return { protocol: 1, id: Number.isSafeInteger(req?.id) ? req.id : 0, ok: false, tick: state.tick, message: error.message, entityId: req?.operation?.kind === "move" || req?.operation?.kind === "stop" ? req.operation.unitIds?.[0] : void 0 };
    }
  };
}

// apps/web/worker.ts
var handle = createService();
var scope = globalThis;
scope.onmessage = (event) => {
  const response = handle(event.data);
  scope.postMessage(response, response.ok ? [response.positions] : []);
};
