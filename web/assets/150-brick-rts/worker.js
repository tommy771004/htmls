// packages/sim/terrain.ts
var terrainRules = { provenance: "design_default", size: 16, tileSize: 100, maxLandStep: 25, resourceCapacity: { tree: 300, stone: 250, gold: 250, berries: 150, hunt: 120, livestock: 100, fish: 200, farm: 250 }, generationAttempts: 8 };
var resourceDefinitions = { tree: { yield: "wood", method: "gather", movement: "land" }, stone: { yield: "stone", method: "gather", movement: "land" }, gold: { yield: "gold", method: "gather", movement: "land" }, berries: { yield: "food", method: "gather", movement: "land" }, hunt: { yield: "food", method: "hunt", movement: "land" }, livestock: { yield: "food", method: "herd", movement: "land" }, fish: { yield: "food", method: "fish", movement: "water" }, farm: { yield: "food", method: "gather", movement: "land" } };
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
function extractResource(node, amount, tick2) {
  if (!Number.isSafeInteger(amount) || amount <= 0 || !Number.isSafeInteger(tick2) || tick2 < 0) throw Error("\u7121\u6548\u63A1\u96C6\u91CF\u6216 tick");
  if (!node.collectible || node.status === "depleted") return 0;
  const yieldAmount = Math.min(amount, node.remaining);
  node.remaining -= yieldAmount;
  if (node.remaining === 0) {
    node.status = "depleted";
    node.collectible = false;
    node.depletedAt = tick2;
  }
  return yieldAmount;
}

// packages/content/footprints.ts
var obstacleFootprints = {
  house: { x: -15, y: -15, width: 250, depth: 230 },
  // Barracks: solid 3x3 foundation for now; its open front is visual only (no walkable interior).
  barracks: { x: -15, y: -15, width: 300, depth: 300 },
  "town-center": { x: -15, y: -15, width: 300, depth: 300 },
  // Farm: a walkable 2x2 field (no blocking rectangle); its extent still stops other buildings.
  farm: { x: 0, y: 0, width: 200, depth: 200 },
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
var walkablePlatforms = { "town-center": { rect: [-15, -15, 285, 285], height: 16 }, farm: { rect: [0, 0, 200, 200], height: 10 } };
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
  if (o.kind === "farm") return [];
  if (o.kind !== "town-center") return [obstacleBounds(o, radius)];
  return townCenterBlocking.map(([x0, y0, x1, y1]) => [o.x + x0 - radius, o.y + y0 - radius, o.x + x1 + radius, o.y + y1 + radius]);
}

// packages/sim/vision.ts
function footprintTiles(o) {
  if (o.kind !== "house" && o.kind !== "town-center" && o.kind !== "barracks" && o.kind !== "farm") return [tileAt(o.x, o.y)];
  const [x0, y0, x1, y1] = obstacleBounds(o), tiles = [];
  for (let ty = Math.max(0, Math.floor(y0 / 100)); ty <= Math.min(15, Math.floor((y1 - 1) / 100)); ty++) for (let tx = Math.max(0, Math.floor(x0 / 100)); tx <= Math.min(15, Math.floor((x1 - 1) / 100)); tx++) tiles.push(ty * 16 + tx);
  return tiles;
}
var visionRules = { provenance: "design_default", unitRadius: 400, houseRadius: 300, townCenterRadius: 600, shareVision: false, rememberStaticObjects: true };
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
  for (const o of map.obstacles) if (o.kind === "house" || o.kind === "barracks") reveal(o.red ? 1 : 0, o.x + 100, o.y + 100, visionRules.houseRadius);
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
  entries: [entry("villager", "unit", "\u6751\u6C11", 50, 0, 0, 0, [], 1), entry("town-center", "building", "\u57CE\u93AE\u4E2D\u5FC3", 0, 200, 0, 100), entry("house", "building", "\u6C11\u5C45", 0, 30), entry("barracks", "building", "\u5175\u71DF", 0, 150), entry("farm", "building", "\u8FB2\u7530", 0, 60), entry("militia", "unit", "\u8FD1\u6230\u6C11\u5175", 60, 0, 20, 0, ["barracks"], 1), entry("archer", "unit", "\u5F13\u624B", 0, 40, 30, 0, ["age-2"], 1), entry("ram", "unit", "\u653B\u57CE\u69CC", 0, 160, 75, 0, ["age-3"], 3), entry("age-2", "technology", "\u7B2C\u4E8C\u6642\u4EE3", 300), entry("age-3", "technology", "\u7B2C\u4E09\u6642\u4EE3", 500, 0, 200, 0, ["age-2"]), entry("age-4", "technology", "\u7B2C\u56DB\u6642\u4EE3", 800, 0, 400, 0, ["age-3"])],
  // Which building produces each unit/technology (design_default). null = defined but not producible yet.
  production: { villager: "town-center", militia: "barracks", archer: "barracks", ram: null, "age-2": "town-center", "age-3": "town-center", "age-4": "town-center" },
  civilizations: [{ id: "blue-settlement", available: ["villager", "town-center", "house", "barracks", "farm", "militia", "archer", "ram", "age-2", "age-3", "age-4"], unavailable: [] }, { id: "red-settlement", available: ["villager", "town-center", "house", "barracks", "farm", "militia", "archer", "ram", "age-2", "age-3", "age-4"], unavailable: [] }]
};

// packages/sim/economy.ts
var economyRules = { provenance: "design_default", initialStock: { food: 200, wood: 200, gold: 100, stone: 100 }, populationCap: rules.settings.populationCap, cancellationRefundPercent: 100, carryCapacity: 10, gatherTicks: { food: 20, wood: 20, gold: 25, stone: 25 }, workReach: 50, dropoffReach: 50 };
var zero = () => ({ food: 0, wood: 0, gold: 0, stone: 0 });
function createAccount(populationUsed) {
  return { stock: { ...economyRules.initialStock }, populationUsed, populationReserved: 0, populationCap: economyRules.populationCap, reservations: [], ledger: { extracted: zero(), deposited: zero(), lost: zero() } };
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
function commitReservation(account, id) {
  const r = account.reservations.find((r2) => r2.id === id);
  if (!r || r.status !== "reserved") throw Error("\u9810\u7559\u9805\u76EE\u4E0D\u5B58\u5728\u6216\u5DF2\u7D50\u675F");
  account.populationReserved -= r.population;
  account.populationUsed += r.population;
  r.status = "committed";
}
function forfeitReservation(account, id) {
  const r = account.reservations.find((r2) => r2.id === id);
  if (!r || r.status !== "reserved") throw Error("\u9810\u7559\u9805\u76EE\u4E0D\u5B58\u5728\u6216\u5DF2\u7D50\u675F");
  account.populationReserved -= r.population;
  r.status = "forfeited";
}

// packages/sim/stats.ts
var combatRules = {
  provenance: "design_default",
  units: {
    villager: { hp: 25, damage: 1, range: 50, cooldown: 30, sight: 0 },
    militia: { hp: 45, damage: 6, range: 50, cooldown: 20, sight: 350 },
    archer: { hp: 30, damage: 4, range: 250, cooldown: 30, sight: 400 }
  },
  buildings: { "town-center": 400, house: 150, barracks: 300, farm: 100 },
  corpseTicks: 40,
  hitFlashTicks: 6
};

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
  const woods = [];
  for (let x = 0; x < 16; x++) for (let y = 0; y < 16; y++) {
    rng ^= rng << 13;
    rng ^= rng >>> 17;
    rng ^= rng << 5;
    const v = (rng >>> 0) / 4294967296;
    if ((x < 2 || y < 2 || x > 13 || y > 13) && v < 0.34) {
      if (x < 8) woods.push({ kind: "tree", x: x * 100 + 12, y: y * 100 + 12 }, { kind: "tree", x: (15 - x) * 100 + 12, y: y * 100 + 12 });
    } else if (v < 0.028 && Math.abs(x - 8) < 3 && y > 3) obstacles.push({ kind: "rock", x: x * 100, y: y * 100 });
  }
  obstacles.push(...woods);
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
  return o.kind === "house" || o.kind === "town-center" || o.kind === "barracks" || o.kind === "farm";
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
function harvestMapResource(map, id, amount, tick2) {
  const resource = map.resources.find((r) => r.id === id);
  if (!resource) throw Error("\u672A\u77E5\u8CC7\u6E90\u7BC0\u9EDE");
  if (resource.obstacleId && !map.obstacles.some((o) => o.id === resource.obstacleId)) throw Error("\u8CC7\u6E90\u969C\u7919\u53C3\u7167\u5931\u6548");
  const harvested = extractResource(resource, amount, tick2), changedNodes = [];
  if (resource.status === "depleted" && resource.obstacleId) {
    const obstacle = map.obstacles.find((o) => o.id === resource.obstacleId);
    if (!obstacle) throw Error("\u8CC7\u6E90\u969C\u7919\u53C3\u7167\u5931\u6548");
    const area = bounds(obstacle);
    map.obstacles = map.obstacles.filter((o) => o !== obstacle);
    for (const tile of map.tiles) tile.obstacleRefs = tile.obstacleRefs.filter((ref) => ref !== resource.obstacleId);
    resource.obstacleId = null;
    changedNodes.push(...refreshNavigation(map, area));
  }
  return { amount: harvested, changedNodes };
}
function refreshNavigation(map, area) {
  const changed = [];
  for (let id = 0; id < 961; id++) {
    const p = position(id);
    if (p.x < area[0] || p.x > area[2] || p.y < area[1] || p.y > area[3]) continue;
    const blocked = !clearSegment(map, p, p), wasBlocked = map.blocked.includes(id);
    if (blocked !== wasBlocked) {
      changed.push(id);
      if (blocked) map.blocked.push(id);
      else map.blocked = map.blocked.filter((n) => n !== id);
    }
  }
  map.blocked.sort((a, b) => a - b);
  map.navigationRevision++;
  return changed;
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
        let distance = Infinity, approach2 = null;
        for (let i = 0; i < 961; i++) {
          if (!Number.isFinite(distances[i])) continue;
          const p = position(i), gap3 = Math.max(x0 - p.x, 0, p.x - x1) + Math.max(y0 - p.y, 0, p.y - y1);
          if (gap3 > 0 && gap3 <= 50 && distances[i] < distance) {
            distance = distances[i];
            approach2 = p;
          }
        }
        return { id: resource.id, remaining: resource.remaining, distance, approach: approach2 };
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
var unitKinds = ["villager", "militia", "archer"];
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
function makeUnit(id, player, x, y, kind = "villager") {
  const node = nodeAt({ x, y });
  if (node < 0) throw Error("\u55AE\u4F4D\u5FC5\u9808\u7AD9\u5728\u5C0E\u822A\u7BC0\u9EDE\u4E0A");
  return { id, player, kind, hp: combatRules.units[kind].hp, hitTick: -1, x, y, node, next: null, path: [], goal: null, target: null, navigation: "idle", wait: 0, detours: 0, partial: false, order: 0, outcome: null };
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
      if (job.slots.length < job.unitIds.length && !job.held.includes(id) && !s.map.blocked.includes(id)) job.slots.push(id);
    } else {
      const g = job.goal, d = (n) => Math.abs(n % SIDE - g % SIDE) + Math.abs(Math.floor(n / SIDE) - Math.floor(g / SIDE));
      if (d(id) < d(job.best)) job.best = id;
      if (job.targets ? job.targets.includes(id) : id === g) {
        job.found = id;
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
function unitJob(s, u, goal, excluded, keep, targets = null) {
  const start = u.next ?? u.node;
  return { kind: "unit", id: s.nextJobId++, unitId: u.id, start, goal, excluded, best: start, keep, targets, found: -1, status: "searching", ...search(start) };
}
function routeTo(s, u, targets) {
  if (!targets.length) throw Error("\u6C92\u6709\u53EF\u7528\u7684\u76EE\u6A19\u7BC0\u9EDE");
  cancel(s, u.id);
  Object.assign(u, { path: [], goal: null, target: null, navigation: "searching", wait: 0, detours: 0, partial: false, order: s.nextJobId, outcome: null });
  s.pathJobs.push(unitJob(s, u, targets[0], [], [], [...targets].sort((a, b) => a - b)));
}
function cancelMovement(s, id) {
  cancel(s, id);
}
function finishUnit(s, job) {
  const u = s.units.find((u2) => u2.id === job.unitId), end = job.found >= 0 ? job.found : job.parent[job.goal] !== -2 && !job.targets ? job.goal : job.best;
  const path = chain(job.parent, end).reverse().slice(1);
  if (job.keep.length && (end !== job.goal || !path.length)) {
    u.path = job.keep;
    u.navigation = "waiting";
    return;
  }
  u.path = path;
  u.goal = job.targets ? end : u.goal ?? job.goal;
  u.partial = job.targets ? job.found < 0 : end !== job.goal;
  u.target = position(end);
  u.navigation = path.length || u.next !== null ? "moving" : u.partial ? "unreachable" : "idle";
}
function reconcile(s) {
  if (s.navigationSeen === s.map.navigationRevision) return;
  s.navigationSeen = s.map.navigationRevision;
  for (const job of s.pathJobs) if (job.status === "searching") {
    const fresh = search(job.kind === "group" ? job.goal : job.start);
    Object.assign(job, fresh);
    if (job.kind === "group") job.slots = [];
    else {
      job.best = job.start;
      job.found = -1;
    }
  }
  const searching = new Set(s.pathJobs.flatMap((j) => j.kind === "group" ? j.unitIds : [j.unitId]));
  for (const u of s.units) {
    if (!u.path.length || searching.has(u.id)) continue;
    const route = [u.next ?? u.node, ...u.path];
    if (route.every((n, i) => i === 0 || neighbours(s.map, route[i - 1]).includes(n))) continue;
    const goal = u.goal ?? u.path.at(-1);
    u.path = [];
    u.navigation = "searching";
    s.pathJobs.push(unitJob(s, u, goal, [], []));
  }
}
function stepMovement(s) {
  reconcile(s);
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

// packages/sim/buildings.ts
var buildKinds = ["house", "barracks", "farm"];
var buildingRules = {
  provenance: "design_default",
  capacity: { "town-center": 5, house: 5, barracks: 0, farm: 0 },
  grid: 10,
  required: Object.fromEntries(buildKinds.map((k) => [k, rules.entries.find((e) => e.id === k).time * rules.settings.tickHz]))
};
var overlap = (a, b) => Math.min(a[2], b[2]) - Math.max(a[0], b[0]) > 0 && Math.min(a[3], b[3]) - Math.max(a[1], b[1]) > 0;
function placementProblem(input, kind, x, y) {
  if (!buildKinds.includes(kind)) return "\u672A\u77E5\u7684\u5EFA\u7BC9\u7A2E\u985E";
  if (!Number.isSafeInteger(x) || !Number.isSafeInteger(y) || x % buildingRules.grid || y % buildingRules.grid) return `\u4F4D\u7F6E\u5FC5\u9808\u5C0D\u9F4A ${buildingRules.grid} \u55AE\u4F4D\u683C\u7DDA`;
  const box = obstacleBounds({ kind, x, y });
  if (box[0] < 0 || box[1] < 0 || box[2] > 1600 || box[3] > 1600) return "\u8D85\u51FA\u5730\u5716\u7BC4\u570D";
  const tiles = [];
  for (let ty = Math.floor(box[1] / 100); ty <= Math.floor((box[3] - 1) / 100); ty++) for (let tx = Math.floor(box[0] / 100); tx <= Math.floor((box[2] - 1) / 100); tx++) tiles.push(ty * 16 + tx);
  if (tiles.some((t) => !input.explored(t))) return "\u5C1A\u672A\u63A2\u7D22\u7684\u5340\u57DF\u4E0D\u80FD\u5EFA\u9020";
  if (tiles.some((t) => !input.tiles[t]?.buildability)) return "\u5730\u5F62\u4E0D\u53EF\u5EFA\u9020\uFF08\u6C34\u57DF\u3001\u61F8\u5D16\u3001\u5761\u9053\u6216\u6DFA\u7058\uFF09";
  if (new Set(tiles.map((t) => input.tiles[t].height)).size > 1) return "\u5730\u9762\u9AD8\u5EA6\u4E0D\u4E00\u81F4";
  if (input.obstacles.some((o) => (o.kind === "farm" ? [obstacleBounds(o)] : obstacleRects(o)).some((r2) => overlap(r2, box)))) return "\u8207\u5EFA\u7BC9\u6216\u8CC7\u6E90\u91CD\u758A";
  const r = navigationRules.radius;
  if (input.units.some((u) => u.x >= box[0] - r && u.x <= box[2] + r && u.y >= box[1] - r && u.y <= box[3] + r)) return "\u6709\u55AE\u4F4D\u7AD9\u5728\u9810\u5B9A\u5730\u4E0A";
  return null;
}
function authoritativeProblem(s, player, kind, x, y) {
  const explored = new Set(s.vision[player].explored);
  const bodies = s.units.flatMap((u) => [{ x: u.x, y: u.y }, ...u.next === null ? [] : [{ x: 50 + u.next % 31 * 50, y: 50 + Math.floor(u.next / 31) * 50 }]]);
  return placementProblem({ tiles: s.map.tiles, obstacles: s.map.obstacles, units: bodies, explored: (t) => explored.has(t) }, kind, x, y);
}
var farmResourceId = (buildingId) => `resource-${buildingId}`;
function openFarm(s, b) {
  const capacity = terrainRules.resourceCapacity.farm;
  s.map.resources.push({ id: farmResourceId(b.id), kind: "farm", x: b.x, y: b.y, capacity, remaining: capacity, collectible: true, status: "available", obstacleId: b.id, depletedAt: null });
  s.map.tiles[tileAt(b.x, b.y)].resourceRefs.push(farmResourceId(b.id));
}
function closeFarm(s, buildingId, tick2) {
  const r = s.map.resources.find((r2) => r2.id === farmResourceId(buildingId));
  if (!r || r.status === "depleted") return;
  r.collectible = false;
  r.status = "depleted";
  r.obstacleId = null;
  r.depletedAt = tick2;
}
function farmOwner(s, resourceId) {
  return s.buildings.find((b) => farmResourceId(b.id) === resourceId)?.player ?? null;
}
function stageOf(b) {
  return b.complete ? 100 : Math.min(80, Math.floor(b.work * 5 / b.required) * 20);
}
function obstacleOf(s, b) {
  return s.map.obstacles.find((o) => o.id === b.id);
}
function recomputeCapacity(s, player) {
  const housed = s.buildings.filter((b) => b.player === player && b.complete).reduce((t, b) => t + buildingRules.capacity[b.kind], 0);
  s.accounts[player].populationCap = Math.min(rules.settings.populationCap, housed);
}
function initBuildings(s) {
  for (const o of s.map.obstacles) if (o.kind === "town-center") {
    s.buildings.push({ id: o.id, kind: "town-center", player: o.red ? 1 : 0, x: o.x, y: o.y, work: 0, required: 0, complete: true, reservationId: null, queue: [], rally: null, hp: combatRules.buildings["town-center"], maxHp: combatRules.buildings["town-center"] });
    o.age = s.ages[o.red ? 1 : 0];
  }
  for (const p of [0, 1]) recomputeCapacity(s, p);
}
function placeBuilding(s, player, kind, x, y, reservationId) {
  const problem = authoritativeProblem(s, player, kind, x, y);
  if (problem) throw Error(problem);
  reserve(s.accounts[player], reservationId, kind);
  const b = { id: `building-${s.nextBuildingId++}`, kind, player, x, y, work: 0, required: buildingRules.required[kind], complete: false, reservationId, queue: [], rally: null, hp: 1, maxHp: combatRules.buildings[kind] };
  s.buildings.push(b);
  const o = { id: b.id, kind, x, y, progress: 0, age: s.ages[player], ...player ? { red: true } : {} };
  s.map.obstacles.push(o);
  s.map.tiles[tileAt(x, y)].obstacleRefs.push(b.id);
  refreshNavigation(s.map, obstacleBounds(o, navigationRules.radius));
  return b;
}
function addWork(s, b) {
  if (b.complete) return false;
  b.work++;
  const o = obstacleOf(s, b);
  const gained = Math.floor(b.work * b.maxHp / b.required) - Math.floor((b.work - 1) * b.maxHp / b.required);
  b.hp = Math.min(b.maxHp, b.hp + gained);
  if (b.work >= b.required) {
    b.complete = true;
    commitReservation(s.accounts[b.player], b.reservationId);
    delete o.progress;
    recomputeCapacity(s, b.player);
    if (b.kind === "farm") openFarm(s, b);
    return true;
  }
  o.progress = stageOf(b);
  return false;
}
function cancelBuilding(s, player, id) {
  const b = s.buildings.find((b2) => b2.id === id);
  if (!b || b.player !== player) throw Error("\u627E\u4E0D\u5230\u9019\u68DF\u5DF1\u65B9\u5EFA\u7BC9");
  if (b.complete || !b.reservationId) throw Error("\u5DF2\u5B8C\u5DE5\u7684\u5EFA\u7BC9\u4E0D\u80FD\u53D6\u6D88");
  cancelReservation(s.accounts[player], b.reservationId);
  const o = obstacleOf(s, b);
  s.map.obstacles = s.map.obstacles.filter((v) => v !== o);
  for (const t of s.map.tiles) t.obstacleRefs = t.obstacleRefs.filter((r) => r !== b.id);
  s.buildings = s.buildings.filter((v) => v !== b);
  refreshNavigation(s.map, obstacleBounds(o, navigationRules.radius));
}

// packages/sim/work.ts
var workPhases = ["none", "toSource", "gathering", "toDropoff", "toSite", "building"];
var NODES2 = 961;
var gap = (p, [x0, y0, x1, y1]) => Math.max(x0 - p.x, 0, p.x - x1) + Math.max(y0 - p.y, 0, p.y - y1);
function ring(map, o, reach2) {
  const box = obstacleBounds(o, 25), out = [];
  for (let n = 0; n < NODES2; n++) {
    if (map.blocked.includes(n)) continue;
    const d = gap(position(n), box);
    if (d > 0 && d <= reach2) out.push(n);
  }
  return out;
}
function workSlots(map, resourceId) {
  const r = map.resources.find((r2) => r2.id === resourceId), o = r?.obstacleId ? map.obstacles.find((o2) => o2.id === r.obstacleId) : void 0;
  if (o?.kind === "farm") {
    const b = obstacleBounds(o), out = [];
    for (let n = 0; n < NODES2; n++) {
      const p = position(n);
      if (!map.blocked.includes(n) && p.x > b[0] && p.x < b[2] && p.y > b[1] && p.y < b[3]) out.push(n);
    }
    return out;
  }
  return o ? ring(map, o, economyRules.workReach) : [];
}
function dropoffNodes(map, player) {
  return [...new Set(map.obstacles.filter((o) => o.kind === "town-center" && (o.red ? 1 : 0) === player).flatMap((o) => ring(map, o, economyRules.dropoffReach)))].sort((a, b) => a - b);
}
function gatherable(map, resourceId) {
  const r = map.resources.find((r2) => r2.id === resourceId);
  if (!r) return "\u627E\u4E0D\u5230\u9019\u500B\u8CC7\u6E90";
  if (resourceDefinitions[r.kind].method !== "gather") return { hunt: "\u72E9\u7375", herd: "\u653E\u7267", fish: "\u6355\u9B5A" }[resourceDefinitions[r.kind].method] + "\u5C1A\u672A\u5BE6\u4F5C";
  if (!r.collectible) return "\u8CC7\u6E90\u5DF2\u8017\u76E1";
  return null;
}
function sourceTargets(s, u, resourceId) {
  const slots = workSlots(s.map, resourceId), taken = /* @__PURE__ */ new Set();
  for (const v of s.units) if (v !== u) {
    {
      const w = s.works[v.id];
      if (v.goal !== null && w?.kind === "gather" && w.resourceId === resourceId) taken.add(v.goal);
    }
    if (v.next === null && !v.path.length) taken.add(v.node);
  }
  const free = slots.filter((n) => !taken.has(n));
  return free.length ? free : slots;
}
function goToSource(s, u, w) {
  const t = sourceTargets(s, u, w.resourceId);
  if (!t.length) return stopWork(s, u);
  w.phase = "toSource";
  routeTo(s, u, t);
}
function goToDropoff(s, u, w) {
  const t = dropoffNodes(s.map, u.player);
  if (!t.length) return stopWork(s, u);
  w.phase = "toDropoff";
  routeTo(s, u, t);
}
function stopWork(s, u) {
  delete s.works[u.id];
  if (u.navigation !== "moving") u.navigation = u.partial ? "unreachable" : "idle";
}
function commandGather(s, unitIds, resourceId) {
  for (const id of unitIds) {
    const u = s.units.find((u2) => u2.id === id);
    cancelMovement(s, id);
    const w = { kind: "gather", resourceId, phase: "toSource", progress: 0, retries: 0 };
    s.works[id] = w;
    const kind = resourceDefinitions[s.map.resources.find((r) => r.id === resourceId).kind].yield, cargo = s.cargo[id];
    if (cargo && cargo.resource !== kind) goToDropoff(s, u, w);
    else goToSource(s, u, w);
  }
}
function clearWork(s, unitIds) {
  for (const id of unitIds) delete s.works[id];
}
function deposit(s, u) {
  const c = s.cargo[u.id];
  if (!c) return;
  const a = s.accounts[u.player];
  if (!Number.isSafeInteger(a.stock[c.resource] + c.amount)) throw Error("\u8CC7\u6E90\u8D85\u904E\u5B89\u5168\u6574\u6578\u7BC4\u570D");
  a.stock[c.resource] += c.amount;
  a.ledger.deposited[c.resource] += c.amount;
  delete s.cargo[u.id];
}
function nextSource(s, from, kind) {
  let best = null, dist2 = Infinity;
  for (const r of s.map.resources) if (r.collectible && r.kind !== "farm" && resourceDefinitions[r.kind].method === "gather" && resourceDefinitions[r.kind].yield === kind) {
    const d = Math.abs(r.x - from.x) + Math.abs(r.y - from.y);
    if (d <= 600 && (d < dist2 || d === dist2 && best !== null && r.id < best)) {
      best = r.id;
      dist2 = d;
    }
  }
  return best;
}
function buildSlots(map, b) {
  const o = map.obstacles.find((o2) => o2.id === b.id);
  return o ? ring(map, o, economyRules.workReach) : [];
}
function goToSite(s, u, w) {
  const b = s.buildings.find((b2) => b2.id === w.buildingId);
  const t = b ? buildSlots(s.map, b) : [];
  if (!t.length) return stopWork(s, u);
  w.phase = "toSite";
  routeTo(s, u, t);
}
function commandBuild(s, unitIds, buildingId) {
  for (const id of unitIds) {
    const u = s.units.find((u2) => u2.id === id);
    cancelMovement(s, id);
    const w = { kind: "build", buildingId, phase: "toSite", retries: 0 };
    s.works[id] = w;
    goToSite(s, u, w);
  }
}
function stepBuilder(s, u, w) {
  const b = s.buildings.find((b2) => b2.id === w.buildingId);
  if (!b || b.complete) return stopWork(s, u);
  if (!buildSlots(s.map, b).includes(u.node)) {
    if (++w.retries > 3) return stopWork(s, u);
    return goToSite(s, u, w);
  }
  w.phase = "building";
  w.retries = 0;
  u.navigation = "idle";
  addWork(s, b);
}
function stepWork(s) {
  const busy = new Set(s.pathJobs.flatMap((j) => j.kind === "group" ? j.unitIds : [j.unitId]));
  for (const u of [...s.units].sort((a, b) => a.id - b.id)) {
    const w = s.works[u.id];
    if (!w || busy.has(u.id) || u.next !== null || u.path.length) continue;
    if (w.kind === "build") {
      stepBuilder(s, u, w);
      continue;
    }
    const resource = s.map.resources.find((r) => r.id === w.resourceId), kind = resourceDefinitions[resource.kind].yield;
    if (w.phase === "toDropoff") {
      if (!dropoffNodes(s.map, u.player).includes(u.node)) {
        if (++w.retries > 3) {
          stopWork(s, u);
          continue;
        }
        goToDropoff(s, u, w);
        continue;
      }
      deposit(s, u);
      w.retries = 0;
      if (!resource.collectible) {
        const next = nextSource(s, resource, kind);
        if (!next) {
          stopWork(s, u);
          continue;
        }
        w.resourceId = next;
      }
      goToSource(s, u, w);
      continue;
    }
    if (!resource.collectible) {
      if (s.cargo[u.id]) {
        goToDropoff(s, u, w);
        continue;
      }
      const next = nextSource(s, resource, kind);
      if (!next) {
        stopWork(s, u);
        continue;
      }
      w.resourceId = next;
      goToSource(s, u, w);
      continue;
    }
    if (!workSlots(s.map, w.resourceId).includes(u.node)) {
      if (++w.retries > 3) {
        stopWork(s, u);
        continue;
      }
      goToSource(s, u, w);
      continue;
    }
    w.phase = "gathering";
    w.retries = 0;
    u.navigation = "idle";
    if (++w.progress < economyRules.gatherTicks[kind]) continue;
    w.progress = 0;
    const got = harvestMapResource(s.map, w.resourceId, 1, s.tick).amount;
    if (resource.kind === "farm" && resource.status === "depleted") s.buildings = s.buildings.filter((b) => farmResourceId(b.id) !== resource.id);
    if (got > 0) {
      const c = s.cargo[u.id] ?? (s.cargo[u.id] = { resource: kind, amount: 0 });
      c.amount += got;
      s.accounts[u.player].ledger.extracted[kind] += got;
    }
    if ((s.cargo[u.id]?.amount ?? 0) >= economyRules.carryCapacity) goToDropoff(s, u, w);
  }
}

// packages/sim/production.ts
var productionRules = { provenance: "design_default", queueLimit: 5 };
var names = { food: "\u98DF\u7269", wood: "\u6728\u6750", gold: "\u9EC3\u91D1", stone: "\u77F3\u982D" };
function ageOf(entryId) {
  const m = /^age-(\d)$/.exec(entryId);
  return m ? Number(m[1]) : 0;
}
var entryOf = (id) => rules.entries.find((e) => e.id === id);
function trainBlocker(i, entryId) {
  const e = entryOf(entryId), civ = rules.civilizations[i.player];
  if (!e || e.kind === "building") return "\u672A\u77E5\u7684\u751F\u7522\u9805\u76EE";
  if (!civ.available.includes(entryId)) return "\u6B64\u6587\u660E\u4E0D\u80FD\u751F\u7522";
  if (!i.building.complete) return "\u5EFA\u7BC9\u5C1A\u672A\u5B8C\u5DE5";
  if (rules.production[entryId] !== i.building.kind) return "\u9019\u68DF\u5EFA\u7BC9\u4E0D\u80FD\u751F\u7522\u9019\u500B\u9805\u76EE";
  for (const req of e.requires) {
    const need = entryOf(req);
    if (need?.kind === "building" && !i.ownBuildings.some((v) => v.kind === req && v.complete)) return `\u9700\u8981\u5B8C\u5DE5\u7684${need.name}`;
    if (need?.kind === "technology" && i.age < ageOf(req)) return `\u9700\u8981${need.name}`;
  }
  const age = ageOf(entryId);
  if (age) {
    if (i.age >= age) return "\u5DF2\u7814\u7A76";
    if (i.ownBuildings.some((v) => v.queue.some((q) => q.entryId === entryId))) return "\u5DF2\u5728\u7814\u7A76\u4E2D";
  }
  if (i.building.queue.length >= productionRules.queueLimit) return `\u4F47\u5217\u5DF2\u6EFF\uFF08${productionRules.queueLimit}\uFF09`;
  const short = resources.filter((r) => i.stock[r] < e.cost[r]);
  if (short.length) return short.map((r) => `${names[r]}\u4E0D\u8DB3\uFF1A\u9700\u8981 ${e.cost[r]}\uFF0C\u76EE\u524D ${i.stock[r]}`).join("\uFF1B");
  if (i.populationUsed + i.populationReserved + e.population > i.populationCap) return `\u4EBA\u53E3\u5DF2\u6EFF\uFF08${i.populationUsed + i.populationReserved}/${i.populationCap}\uFF09\uFF1A\u8ACB\u84CB\u4F4F\u5B85`;
  return null;
}
function trainable(s, player, b, entryId) {
  if (b.player !== player) return "\u4E0D\u80FD\u64CD\u4F5C\u6575\u65B9\u5EFA\u7BC9";
  const a = s.accounts[player];
  return trainBlocker({ player, age: s.ages[player], building: b, ownBuildings: s.buildings.filter((v) => v.player === player), stock: a.stock, populationUsed: a.populationUsed, populationReserved: a.populationReserved, populationCap: a.populationCap }, entryId);
}
function enqueue(s, player, buildingId, entryId, reservationId) {
  const b = s.buildings.find((v) => v.id === buildingId);
  if (!b) throw Error("\u627E\u4E0D\u5230\u9019\u68DF\u5EFA\u7BC9");
  const problem = trainable(s, player, b, entryId);
  if (problem) throw Error(problem);
  reserve(s.accounts[player], reservationId, entryId);
  b.queue.push({ id: s.nextQueueId++, entryId, reservationId, work: 0, required: entryOf(entryId).time * rules.settings.tickHz });
}
function dequeue(s, player, buildingId, itemId) {
  const b = s.buildings.find((v) => v.id === buildingId);
  if (!b || b.player !== player) throw Error("\u627E\u4E0D\u5230\u9019\u68DF\u5DF1\u65B9\u5EFA\u7BC9");
  const item = b.queue.find((q) => q.id === itemId);
  if (!item) throw Error("\u4F47\u5217\u9805\u76EE\u5DF2\u5B8C\u6210\u6216\u4E0D\u5B58\u5728");
  cancelReservation(s.accounts[player], item.reservationId);
  b.queue = b.queue.filter((q) => q !== item);
}
function exitNode(s, b) {
  const o = s.map.obstacles.find((o2) => o2.id === b.id), box = obstacleBounds(o, navigationRules.radius);
  const held2 = new Set(s.units.flatMap((u) => u.next === null ? [u.node] : [u.node, u.next]));
  const aim = b.rally ?? { x: (box[0] + box[2]) / 2, y: box[3] + 50 };
  let best = -1, dist2 = Infinity;
  for (let n = 0; n < 961; n++) {
    if (s.map.blocked.includes(n) || held2.has(n)) continue;
    const p = position(n), g = Math.max(box[0] - p.x, 0, p.x - box[2]) + Math.max(box[1] - p.y, 0, p.y - box[3]);
    if (g <= 0 || g > 50) continue;
    const d = Math.abs(p.x - aim.x) + Math.abs(p.y - aim.y);
    if (d < dist2) {
      dist2 = d;
      best = n;
    }
  }
  return best;
}
var unitKindOf = { villager: "villager", militia: "militia", archer: "archer" };
function stepProduction(s) {
  for (const b of [...s.buildings].sort((a, b2) => a.id < b2.id ? -1 : 1)) {
    const item = b.queue[0];
    if (!item) continue;
    if (item.work < item.required) {
      item.work++;
      if (item.work < item.required) continue;
    }
    const age = ageOf(item.entryId);
    if (age) {
      commitReservation(s.accounts[b.player], item.reservationId);
      b.queue.shift();
      s.ages[b.player] = age;
      const own = new Set(s.buildings.filter((v) => v.player === b.player).map((v) => v.id));
      for (const o of s.map.obstacles) if (o.id && own.has(o.id)) o.age = age;
      continue;
    }
    const node = exitNode(s, b);
    if (node < 0) continue;
    commitReservation(s.accounts[b.player], item.reservationId);
    b.queue.shift();
    const p = position(node), u = makeUnit(s.nextUnitId++, b.player, p.x, p.y, unitKindOf[item.entryId]);
    s.units.push(u);
    if (b.rally && nearest(s.map, b.rally, false) >= 0) commandMove(s, [u.id], b.rally);
  }
}

// packages/sim/combat.ts
var REPATH = 20;
function buildingBox(s, b) {
  const o = s.map.obstacles.find((o2) => o2.id === b.id);
  return o ? obstacleBounds(o) : null;
}
function reach(p, t) {
  if (!Array.isArray(t)) return Math.max(Math.abs(p.x - t.x), Math.abs(p.y - t.y));
  return Math.max(t[0] - p.x, 0, p.x - t[2], t[1] - p.y, 0, p.y - t[3]);
}
function resolve(s, t) {
  if (t.kind === "unit") {
    const u = s.units.find((u2) => u2.id === t.id);
    return u ? { player: u.player, shape: { x: u.x, y: u.y }, tiles: [tileAt(u.x, u.y)] } : null;
  }
  const b = s.buildings.find((b2) => b2.id === t.id), box = b && buildingBox(s, b);
  if (!b || !box) return null;
  const tiles = [];
  for (let ty = Math.floor(box[1] / 100); ty <= Math.floor((box[3] - 1) / 100); ty++) for (let tx = Math.floor(box[0] / 100); tx <= Math.floor((box[2] - 1) / 100); tx++) tiles.push(ty * 16 + tx);
  return { player: b.player, shape: box, tiles };
}
function targetProblem(s, player, t) {
  const r = resolve(s, t);
  if (!r) return "\u627E\u4E0D\u5230\u76EE\u6A19";
  if (r.player === player) return "\u4E0D\u80FD\u653B\u64CA\u5DF1\u65B9";
  const seen = new Set(s.vision[player].visible);
  if (!r.tiles.some((id) => seen.has(id))) return "\u627E\u4E0D\u5230\u76EE\u6A19";
  return null;
}
function commandAttack(s, unitIds, t) {
  for (const id of unitIds) {
    cancelMovement(s, id);
    delete s.works[id];
    s.attacks[id] = { target: t, cooldown: 0, auto: false, repath: 0, firedTick: -1 };
  }
}
function clearAttacks(s, unitIds) {
  for (const id of unitIds) delete s.attacks[id];
}
var limit = (u, shape) => combatRules.units[u.kind].range + (Array.isArray(shape) ? navigationRules.radius : 0);
function approach(s, u, shape) {
  const range = limit(u, shape), out = [];
  for (let n = 0; n < 961; n++) {
    if (s.map.blocked.includes(n)) continue;
    const p = position(n), d = reach(p, shape);
    if (d <= range && (Array.isArray(shape) || d > 0)) out.push(n);
  }
  const held2 = new Set(s.units.filter((v) => v !== u && v.next === null && !v.path.length).map((v) => v.node)), free = out.filter((n) => !held2.has(n));
  return free.length ? free : out;
}
function killUnit(s, u) {
  const a = s.accounts[u.player], c = s.cargo[u.id];
  if (c) {
    a.ledger.lost[c.resource] += c.amount;
    delete s.cargo[u.id];
  }
  delete s.works[u.id];
  delete s.attacks[u.id];
  cancelMovement(s, u.id);
  a.populationUsed--;
  s.units = s.units.filter((v) => v !== u);
  s.corpses.push({ id: u.id, player: u.player, kind: u.kind, x: u.x, y: u.y, tick: s.tick });
}
function destroyBuilding(s, b) {
  const a = s.accounts[b.player];
  if (!b.complete && b.reservationId) forfeitReservation(a, b.reservationId);
  for (const q of b.queue) forfeitReservation(a, q.reservationId);
  const o = s.map.obstacles.find((o2) => o2.id === b.id);
  s.map.obstacles = s.map.obstacles.filter((v) => v !== o);
  for (const t of s.map.tiles) t.obstacleRefs = t.obstacleRefs.filter((r) => r !== b.id);
  s.buildings = s.buildings.filter((v) => v !== b);
  if (b.kind === "farm") closeFarm(s, b.id, s.tick);
  refreshNavigation(s.map, obstacleBounds(o, navigationRules.radius));
  recomputeCapacity(s, b.player);
}
function damage(s, t, amount) {
  if (t.kind === "unit") {
    const u = s.units.find((u2) => u2.id === t.id);
    u.hp -= amount;
    u.hitTick = s.tick;
    if (u.hp <= 0) killUnit(s, u);
    return;
  }
  const b = s.buildings.find((b2) => b2.id === t.id);
  b.hp -= amount;
  const o = s.map.obstacles.find((o2) => o2.id === b.id);
  if (b.hp * 2 < b.maxHp) o.damaged = true;
  if (b.hp <= 0) destroyBuilding(s, b);
}
function stepCombat(s) {
  s.corpses = s.corpses.filter((c) => s.tick - c.tick < combatRules.corpseTicks);
  const busy = new Set(s.pathJobs.flatMap((j) => j.kind === "group" ? j.unitIds : [j.unitId]));
  for (const u of [...s.units].sort((a, b) => a.id - b.id)) {
    const sight = combatRules.units[u.kind].sight;
    if (!sight || s.attacks[u.id] || s.works[u.id] || u.next !== null || u.path.length || busy.has(u.id)) continue;
    const seen = new Set(s.vision[u.player].visible);
    let best = null, dist2 = Infinity;
    for (const e of s.units) if (e.player !== u.player && seen.has(tileAt(e.x, e.y))) {
      const d = reach(u, e);
      if (d <= sight && (d < dist2 || d === dist2 && best && e.id < best.id)) {
        best = e;
        dist2 = d;
      }
    }
    if (best) s.attacks[u.id] = { target: { kind: "unit", id: best.id }, cooldown: 0, auto: true, repath: 0, firedTick: -1 };
  }
  for (const id of Object.keys(s.attacks).map(Number).sort((a, b) => a - b)) {
    const a = s.attacks[id], u = s.units.find((u2) => u2.id === id);
    if (!a || !u) continue;
    if (targetProblem(s, u.player, a.target)) {
      delete s.attacks[id];
      cancelMovement(s, u.id);
      Object.assign(u, { path: [], goal: null, target: null, navigation: u.next === null ? "idle" : "moving" });
      continue;
    }
    const r = resolve(s, a.target), stats = combatRules.units[u.kind];
    if (a.cooldown > 0) a.cooldown--;
    if (reach(u, r.shape) <= limit(u, r.shape)) {
      if (u.next !== null) continue;
      if (u.path.length || busy.has(u.id)) {
        cancelMovement(s, u.id);
        u.path = [];
        u.goal = null;
        u.target = null;
      }
      u.navigation = "idle";
      if (a.cooldown === 0) {
        a.cooldown = stats.cooldown;
        a.firedTick = s.tick;
        damage(s, a.target, stats.damage);
      }
      continue;
    }
    if (u.next !== null) continue;
    if (a.repath > 0 && (u.path.length || busy.has(u.id))) {
      a.repath--;
      continue;
    }
    const nodes = approach(s, u, r.shape);
    if (!nodes.length) {
      delete s.attacks[id];
      continue;
    }
    routeTo(s, u, nodes);
    a.repath = REPATH;
  }
  if (!s.outcome) {
    const alive = [0, 1].filter((p) => s.units.some((u) => u.player === p) || s.buildings.some((b) => b.player === p));
    if (alive.length < 2) s.outcome = { winner: alive.length === 1 ? alive[0] : null, defeated: [0, 1].filter((p) => !alive.includes(p)), tick: s.tick };
  }
}

// packages/sim/ai.ts
var aiRules = {
  provenance: "design_default",
  player: 1,
  thinkTicks: 20,
  thinkOffset: 7,
  villagerTarget: 12,
  gatherWeights: { food: 4, wood: 3, gold: 2, stone: 0 },
  houseMargin: 2,
  barracksAtVillagers: 3,
  ageUpAtVillagers: 9,
  waveSize: 5,
  firstWaveTick: 4800,
  engageRange: 500,
  defendRadius: 700,
  baseMargin: 50,
  siteRange: 900,
  siteStep: 20,
  halfMargin: 100,
  spill: 100
};
var gap2 = (a, b) => Math.max(a[0] - b[2], b[0] - a[2], a[1] - b[3], b[1] - a[3], 0);
var centre = (b) => ({ x: (b[0] + b[2]) / 2, y: (b[1] + b[3]) / 2 });
var dist = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
function stepAI(s, order) {
  if (s.outcome || s.tick % aiRules.thinkTicks !== aiRules.thinkOffset) return;
  const P = aiRules.player, vision = s.vision[P], seen = new Set(vision.visible), explored = new Set(vision.explored);
  const busy = new Set(s.pathJobs.flatMap((j) => j.kind === "group" ? j.unitIds : [j.unitId]));
  const idle = (u) => !s.works[u.id] && !s.attacks[u.id] && u.next === null && !u.path.length && !busy.has(u.id);
  const mine = s.units.filter((u) => u.player === P).sort((a, b) => a.id - b.id), villagers = mine.filter((u) => u.kind === "villager"), soldiers = mine.filter((u) => u.kind !== "villager");
  const own = s.buildings.filter((b) => b.player === P), tc = own.find((b) => b.kind === "town-center"), tcBox = tc ? boxOf(s, tc) : null;
  const foes = s.units.filter((u) => u.player !== P && seen.has(tileAt(u.x, u.y))).sort((a, b) => a.id - b.id);
  army(s, order, soldiers, foes, tcBox, idle, explored);
  if (!tc || !tcBox) return;
  const account = s.accounts[P], stock = account.stock;
  for (const b of own.filter((b2) => !b2.complete)) {
    if (villagers.some((u) => {
      const w = s.works[u.id];
      return w?.kind === "build" && w.buildingId === b.id;
    })) continue;
    const builder = pickBuilder(s, villagers, idle, centre(boxOf(s, b)));
    if (builder) order("construct", { unitIds: [builder.id], buildingId: b.id });
  }
  const pending = (k) => own.some((b) => b.kind === k && !b.complete);
  const room = account.populationCap - account.populationUsed - account.populationReserved;
  const barracksDue = villagers.length >= aiRules.barracksAtVillagers && !own.some((b) => b.kind === "barracks");
  if (barracksDue) place(s, order, "barracks", villagers, idle, tcBox, own);
  if (room <= aiRules.houseMargin && account.populationCap < rules.settings.populationCap && !pending("house") && (!barracksDue || room <= 0)) place(s, order, "house", villagers, idle, tcBox, own);
  const queued = (id) => own.reduce((t, b) => t + b.queue.filter((q) => q.entryId === id).length, 0);
  if (tc.complete && !tc.queue.length) {
    if (villagers.length + queued("villager") < aiRules.villagerTarget && !trainable(s, P, tc, "villager")) order("train", { buildingId: tc.id, entryId: "villager" });
    else if (s.ages[P] < 2 && villagers.length >= aiRules.ageUpAtVillagers && own.some((b) => b.kind === "barracks" && b.complete) && !trainable(s, P, tc, "age-2")) order("train", { buildingId: tc.id, entryId: "age-2" });
  }
  const savingForAge = s.ages[P] < 2 && villagers.length >= aiRules.ageUpAtVillagers && stock.food < rules.entries.find((e) => e.id === "age-2").cost.food + 60;
  for (const b of own.filter((b2) => b2.kind === "barracks" && b2.complete && b2.queue.length < 2)) {
    const pick = ["archer", "militia"].find((id) => !trainable(s, P, b, id) && !(id === "militia" && savingForAge));
    if (pick) order("train", { buildingId: b.id, entryId: pick });
  }
  const staff = { food: 0, wood: 0, gold: 0, stone: 0 }, farmers = /* @__PURE__ */ new Set();
  for (const u of villagers) {
    const w = s.works[u.id];
    if (w?.kind === "gather") {
      const r = s.map.resources.find((r2) => r2.id === w.resourceId);
      if (r) {
        staff[resourceDefinitions[r.kind].yield]++;
        if (r.kind === "farm") farmers.add(r.id);
      }
    }
  }
  for (const u of villagers.filter(idle)) {
    const kinds = Object.keys(aiRules.gatherWeights).filter((k) => aiRules.gatherWeights[k] > 0).sort((a, b) => staff[a] / aiRules.gatherWeights[a] - staff[b] / aiRules.gatherWeights[b]);
    for (const kind of kinds) {
      const source = s.map.resources.filter((r) => resourceDefinitions[r.kind].yield === kind && explored.has(tileAt(r.x, r.y)) && !gatherable(s.map, r.id) && (r.kind !== "farm" || farmOwner(s, r.id) === P && !farmers.has(r.id))).sort((a, b) => dist(u, a) - dist(u, b) || (a.id < b.id ? -1 : 1))[0];
      if (source && order("gather", { unitIds: [u.id], resourceId: source.id })) {
        staff[kind]++;
        if (source.kind === "farm") farmers.add(source.id);
        break;
      }
      if (kind === "food" && !source && !own.some((b) => b.kind === "farm" && !b.complete) && place(s, order, "farm", villagers, idle, tcBox, own, u)) break;
    }
  }
}
function boxOf(s, b) {
  const o = s.map.obstacles.find((o2) => o2.id === b.id);
  return o ? obstacleBounds(o) : null;
}
function pickBuilder(s, villagers, idle, near) {
  const free = villagers.filter(idle).sort((a, b) => dist(a, near) - dist(b, near) || a.id - b.id)[0];
  if (free) return free;
  return villagers.filter((u) => s.works[u.id]?.kind !== "build").sort((a, b) => dist(a, near) - dist(b, near) || a.id - b.id)[0];
}
function place(s, order, kind, villagers, idle, tcBox, own, worker) {
  const cost = rules.entries.find((e) => e.id === kind).cost, stock = s.accounts[aiRules.player].stock;
  if (Object.keys(cost).some((r) => stock[r] < cost[r]) || !buildKinds.includes(kind)) return false;
  const c = centre(tcBox), others = own.filter((b) => b.kind !== "farm" && b.kind !== "town-center").map((b) => boxOf(s, b)).filter((b) => b !== null), [x0, y0, x1, y1] = obstacleBounds({ kind, x: 0, y: 0 }), right = c.x >= 800;
  const explored = new Set(s.vision[aiRules.player].explored), bodies = s.units.flatMap((u) => [{ x: u.x, y: u.y }, ...u.next === null ? [] : [{ x: 50 + u.next % 31 * 50, y: 50 + Math.floor(u.next / 31) * 50 }]]);
  const input = { tiles: s.map.tiles, obstacles: s.map.obstacles, units: bodies, explored: (t) => explored.has(t) }, sites = [];
  const g = buildingRules.grid, from = (v) => Math.ceil(-v / g) * g;
  for (let x = from(x0); x <= 1600 - x1; x += aiRules.siteStep) for (let y = from(y0); y <= 1600 - y1; y += aiRules.siteStep) {
    const box = [x + x0, y + y0, x + x1, y + y1], mid = centre(box);
    const margin = kind === "barracks" ? aiRules.halfMargin : -aiRules.spill, ownHalf = right ? box[0] >= 800 + margin : box[2] <= 800 - margin;
    if (!ownHalf || dist(mid, c) > aiRules.siteRange || gap2(box, tcBox) < (kind === "farm" ? 50 : aiRules.baseMargin) || kind !== "farm" && others.some((o) => gap2(box, o) < 50)) continue;
    sites.push({ x, y, d: dist(mid, c) });
  }
  sites.sort((a, b) => a.d - b.d || a.y - b.y || a.x - b.x);
  for (const site of sites) {
    if (placementProblem(input, kind, site.x, site.y)) continue;
    const builder = worker ?? pickBuilder(s, villagers, idle, site);
    if (!builder) return false;
    return order("build", { unitIds: [builder.id], kind, x: site.x, y: site.y });
  }
  return false;
}
function army(s, order, soldiers, foes, tcBox, idle, explored) {
  const P = aiRules.player, attackers = /* @__PURE__ */ new Map();
  const assign = (u, target) => {
    const key = target.kind + ":" + target.id;
    if (!attackers.has(key)) attackers.set(key, { target, ids: [] });
    attackers.get(key).ids.push(u.id);
  };
  const home = tcBox ? centre(tcBox) : null, intruder = home ? foes.filter((f) => dist(f, home) <= aiRules.defendRadius).sort((a, b) => dist(a, home) - dist(b, home) || a.id - b.id)[0] : void 0;
  const enemyBuildings = s.buildings.filter((b) => b.player !== P).map((b) => ({ b, box: boxOf(s, b) })).filter((v) => v.box && !targetProblem(s, P, { kind: "building", id: v.b.id }));
  const free = [], offensive = s.tick >= aiRules.firstWaveTick;
  for (const u of soldiers) {
    if (s.attacks[u.id]) continue;
    const foe = intruder ?? foes.filter((f) => dist(f, u) <= aiRules.engageRange && (offensive || home && dist(f, home) <= aiRules.defendRadius)).sort((a, b) => dist(a, u) - dist(b, u) || a.id - b.id)[0];
    if (foe) {
      assign(u, { kind: "unit", id: foe.id });
      continue;
    }
    const site = offensive && idle(u) && dist(u, home ?? u) > aiRules.defendRadius ? enemyBuildings.sort((a, b) => dist(centre(a.box), u) - dist(centre(b.box), u) || (a.b.id < b.b.id ? -1 : 1))[0] : void 0;
    if (site) {
      assign(u, { kind: "building", id: site.b.id });
      continue;
    }
    if (idle(u)) free.push(u);
  }
  for (const { target, ids } of attackers.values()) order("attack", { unitIds: ids.sort((a, b) => a - b), target });
  if (!free.length || !home) return;
  const atHome = free.filter((u) => dist(u, home) <= aiRules.defendRadius), away = free.filter((u) => dist(u, home) > aiRules.defendRadius);
  if (s.tick >= aiRules.firstWaveTick && atHome.length >= aiRules.waveSize) march(s, order, atHome, objective(s, home, explored, true));
  if (away.length) march(s, order, away, offensive ? objective(s, home, explored, false) : { x: home.x, y: home.y + 250 });
}
function objective(s, home, explored, wave) {
  const P = aiRules.player, known = s.vision[P].known.map((k) => k.obstacle).filter((o) => isBuilding(o) && !o.red).map((o) => centre(obstacleBounds(o)));
  if (known.length) return known.sort((a, b) => dist(a, home) - dist(b, home))[0];
  const mirror = { x: 1600 - home.x, y: home.y };
  if (wave && !explored.has(tileAt(mirror.x, mirror.y))) return mirror;
  for (let t = 0; t < 256; t++) {
    const id = t * 97 % 256;
    if (!explored.has(id)) return { x: id % 16 * 100 + 50, y: Math.floor(id / 16) * 100 + 50 };
  }
  return mirror;
}
function march(s, order, units, goal) {
  for (let r = 0; r <= 400; r += 50) for (let dy = -r; dy <= r; dy += 50) for (let dx = -r; dx <= r; dx += 50) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
    const p = { x: Math.round((goal.x + dx) / 50) * 50, y: Math.round((goal.y + dy) / 50) * 50 };
    if (p.x < 50 || p.y < 50 || p.x > 1550 || p.y > 1550 || !clearSegment(s.map, p, p)) continue;
    if (order("move", { unitIds: units.map((u) => u.id).sort((a, b) => a - b).slice(0, 40), x: p.x, y: p.y })) return;
  }
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
var rulesetHash = hash({ rules, navigationRules, economyRules, terrainRules, terrainDefinitions, resourceDefinitions, visionRules, startingResourceRules, footprints: footprintContract, combat: combatRules, ai: aiRules, simulationVersion: 16 });
function createState(seed, layout = "meadow", opponent = "idle") {
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 4294967295) throw Error("seed \u5FC5\u9808\u70BA uint32");
  if (opponent !== "ai" && opponent !== "idle") throw Error("\u672A\u77E5\u7684\u5C0D\u624B\u8A2D\u5B9A");
  const state = { buildings: [], nextBuildingId: 1, ages: [1, 1], nextUnitId: 5, nextQueueId: 1, attacks: {}, corpses: [], outcome: null, version: 16, opponent, works: {}, cargo: {}, layout, vision: createVision(), accounts: [createAccount(3), createAccount(opponent === "ai" ? 3 : 1)], transactions: [], map: makeMap(seed, layout), pathJobs: [], nextJobId: 1, navigationSeen: 0, seed, rng: seed || 1, tick: 0, sequence: [0, 0], units: [makeUnit(1, 0, 350, 700), makeUnit(2, 0, 450, 700), makeUnit(3, 0, 400, 800), makeUnit(4, 1, 1150, 700)], queue: [], log: [] };
  if (opponent === "ai") {
    state.units.push(makeUnit(5, 1, 1250, 700), makeUnit(6, 1, 1200, 800));
    state.nextUnitId = 7;
  }
  initBuildings(state);
  updateVision(state.vision, state.map, state.units, 0);
  return state;
}
function submit(state, c, record = true) {
  if (!c || c.protocolVersion !== 1 || c.rulesetHash !== rulesetHash) throw Error("\u547D\u4EE4\u7248\u672C\u4E0D\u7B26");
  if (!Number.isSafeInteger(c.playerId) || c.playerId < 0 || c.playerId > 1) throw Error("\u7121\u6548\u73A9\u5BB6");
  if (!Number.isSafeInteger(c.sequence) || c.sequence !== state.sequence[c.playerId] + 1) throw Error("\u91CD\u8907\u6216\u932F\u5E8F\u547D\u4EE4");
  if (!Number.isSafeInteger(c.targetTick) || c.targetTick <= state.tick || c.targetTick > state.tick + 200) throw Error("\u547D\u4EE4\u5DF2\u904E\u671F\u6216\u904E\u9060");
  if (!c.payload) throw Error("\u7F3A\u5C11 payload");
  if (state.outcome) throw Error("\u5C0D\u5C40\u5DF2\u7D50\u675F\uFF1A\u8ACB\u518D\u958B\u4E00\u5C40");
  if (c.commandType === "move" || c.commandType === "stop" || c.commandType === "gather" || c.commandType === "build" || c.commandType === "construct" || c.commandType === "attack") {
    const ids = c.payload.unitIds;
    if (!Array.isArray(ids) || !ids.length || ids.length > navigationRules.maxGroupSize || !ids.every((id, i) => Number.isSafeInteger(id) && (i === 0 || id > ids[i - 1]))) throw Error(`\u55AE\u4F4D\u6E05\u55AE\u9700\u70BA 1\u2013${navigationRules.maxGroupSize} \u500B\u905E\u589E\u4E14\u4E0D\u91CD\u8907\u7684 ID`);
    for (const id of ids) {
      const u = state.units.find((u2) => u2.id === id);
      if (!u || u.player !== c.playerId) throw Error("\u4E0D\u53EF\u63A7\u5236\u6575\u65B9\u6216\u4E0D\u5B58\u5728\u7684\u55AE\u4F4D");
      if (c.commandType !== "move" && c.commandType !== "stop" && c.commandType !== "attack" && u.kind !== "villager") throw Error("\u53EA\u6709\u6751\u6C11\u80FD\u63A1\u96C6\u6216\u5EFA\u9020");
    }
  }
  if (c.commandType === "move") {
    for (const k of ["x", "y"]) if (!Number.isSafeInteger(c.payload[k]) || c.payload[k] < 50 || c.payload[k] > 1550) throw Error("\u76EE\u6A19\u8D85\u51FA\u5730\u5716");
    if (!clearSegment(state.map, c.payload, c.payload)) throw Error("\u76EE\u6A19\u4F4D\u65BC\u5EFA\u7BC9\u3001\u8CC7\u6E90\u6216\u4E0D\u53EF\u901A\u884C\u5730\u5F62\u7684\u5360\u5730\u5167");
  } else if (c.commandType === "stop") {
  } else if (c.commandType === "attack") {
    const t = c.payload.target;
    if (!t || !["unit", "building"].includes(t.kind)) throw Error("\u7121\u6548\u7684\u653B\u64CA\u76EE\u6A19");
    const problem = targetProblem(state, c.playerId, t);
    if (problem) throw Error(problem);
  } else if (c.commandType === "build") {
    const { kind, x, y } = c.payload;
    if (!buildKinds.includes(kind)) throw Error("\u672A\u77E5\u7684\u5EFA\u7BC9\u7A2E\u985E");
    const problem = authoritativeProblem(state, c.playerId, kind, x, y);
    if (problem) throw Error(problem);
    const cost = rules.entries.find((e) => e.id === kind).cost, stock = state.accounts[c.playerId].stock, short = Object.keys(cost).filter((k) => stock[k] < cost[k]);
    if (short.length) throw Error(`\u8CC7\u6E90\u4E0D\u8DB3\uFF1A${short.map((k) => `${{ food: "\u98DF\u7269", wood: "\u6728\u6750", gold: "\u9EC3\u91D1", stone: "\u77F3\u982D" }[k]}\u9700\u8981 ${cost[k]}\uFF0C\u76EE\u524D ${stock[k]}`).join("\uFF1B")}`);
  } else if (c.commandType === "train" || c.commandType === "cancelTrain" || c.commandType === "rally") {
    const b = state.buildings.find((b2) => b2.id === c.payload.buildingId);
    if (!b || b.player !== c.playerId) throw Error("\u627E\u4E0D\u5230\u9019\u68DF\u5DF1\u65B9\u5EFA\u7BC9");
    if (c.commandType === "train") {
      const problem = trainable(state, c.playerId, b, c.payload.entryId);
      if (problem) throw Error(problem);
    } else if (c.commandType === "cancelTrain") {
      if (!b.queue.some((q) => q.id === c.payload.itemId)) throw Error("\u4F47\u5217\u9805\u76EE\u5DF2\u5B8C\u6210\u6216\u4E0D\u5B58\u5728");
    } else {
      if (!b.complete) throw Error("\u5EFA\u7BC9\u5C1A\u672A\u5B8C\u5DE5");
      for (const k of ["x", "y"]) if (!Number.isSafeInteger(c.payload[k]) || c.payload[k] < 50 || c.payload[k] > 1550) throw Error("\u96C6\u7D50\u9EDE\u8D85\u51FA\u5730\u5716");
      if (!clearSegment(state.map, c.payload, c.payload)) throw Error("\u96C6\u7D50\u9EDE\u4E0D\u80FD\u8A2D\u5728\u5EFA\u7BC9\u3001\u8CC7\u6E90\u6216\u4E0D\u53EF\u901A\u884C\u5730\u5F62\u4E0A");
    }
  } else if (c.commandType === "construct" || c.commandType === "cancelBuild") {
    const b = state.buildings.find((b2) => b2.id === c.payload.buildingId);
    if (!b || b.player !== c.playerId) throw Error("\u627E\u4E0D\u5230\u9019\u68DF\u5DF1\u65B9\u5EFA\u7BC9");
    if (b.complete) throw Error("\u5EFA\u7BC9\u5DF2\u5B8C\u5DE5");
  } else if (c.commandType === "gather") {
    const r = typeof c.payload.resourceId === "string" ? state.map.resources.find((r2) => r2.id === c.payload.resourceId) : void 0;
    if (!r || !state.vision[c.playerId].explored.includes(tileAt(r.x, r.y))) throw Error("\u627E\u4E0D\u5230\u9019\u500B\u8CC7\u6E90");
    if (r.kind === "farm" && farmOwner(state, r.id) !== c.playerId) throw Error("\u53EA\u80FD\u8015\u4F5C\u5DF1\u65B9\u7684\u8FB2\u7530");
    const problem = gatherable(state.map, r.id);
    if (problem) throw Error(problem);
  } else if (c.commandType === "reserve") {
    if (!rules.entries.some((e) => e.id === c.payload.entryId)) throw Error("\u672A\u77E5\u9810\u7559\u5167\u5BB9");
  } else if (c.commandType === "cancelReservation") {
    if (typeof c.payload.reservationId !== "string" || !c.payload.reservationId.startsWith(`${c.playerId}:`)) throw Error("\u4E0D\u53EF\u53D6\u6D88\u6575\u65B9\u6216\u7121\u6548\u7684\u9810\u7559");
  } else throw Error("\u4E0D\u652F\u63F4\u7684\u547D\u4EE4");
  const copy = structuredClone(c);
  delete copy.acceptedTick;
  state.queue.push(copy);
  state.queue.sort((a, b) => a.targetTick - b.targetTick || a.playerId - b.playerId || a.sequence - b.sequence);
  if (record) state.log.push({ ...structuredClone(copy), acceptedTick: state.tick });
  state.sequence[c.playerId] = c.sequence;
}
function tick(s) {
  s.tick++;
  s.queue.sort((a, b) => a.targetTick - b.targetTick || a.playerId - b.playerId || a.sequence - b.sequence);
  while (s.queue.length && s.queue[0].targetTick === s.tick) {
    const c = s.queue.shift();
    if (c.commandType === "attack") {
      if (!targetProblem(s, c.playerId, c.payload.target)) commandAttack(s, c.payload.unitIds, c.payload.target);
      else {
        clearAttacks(s, c.payload.unitIds);
        commandStop(s, c.payload.unitIds);
      }
      continue;
    }
    if (c.commandType === "move" || c.commandType === "stop" || c.commandType === "gather" || c.commandType === "build" || c.commandType === "construct") clearAttacks(s, c.payload.unitIds);
    if (c.commandType === "move") {
      clearWork(s, c.payload.unitIds);
      commandMove(s, c.payload.unitIds, { x: c.payload.x, y: c.payload.y });
      continue;
    }
    if (c.commandType === "stop") {
      clearWork(s, c.payload.unitIds);
      commandStop(s, c.payload.unitIds);
      continue;
    }
    if (c.commandType === "gather") {
      if (!gatherable(s.map, c.payload.resourceId)) commandGather(s, c.payload.unitIds, c.payload.resourceId);
      else {
        clearWork(s, c.payload.unitIds);
        commandStop(s, c.payload.unitIds);
      }
      continue;
    }
    if (c.commandType === "rally") {
      const b = s.buildings.find((b2) => b2.id === c.payload.buildingId);
      if (b) b.rally = { x: c.payload.x, y: c.payload.y };
      continue;
    }
    if (c.commandType === "train" || c.commandType === "cancelTrain") {
      const result = { tick: s.tick, playerId: c.playerId, sequence: c.sequence, ok: true };
      try {
        if (c.commandType === "train") enqueue(s, c.playerId, c.payload.buildingId, c.payload.entryId, `${c.playerId}:${c.sequence}`);
        else dequeue(s, c.playerId, c.payload.buildingId, c.payload.itemId);
      } catch (e) {
        result.ok = false;
        result.error = e.message;
      }
      s.transactions.push(result);
      continue;
    }
    if (c.commandType === "build" || c.commandType === "construct" || c.commandType === "cancelBuild") {
      const result = { tick: s.tick, playerId: c.playerId, sequence: c.sequence, ok: true };
      try {
        if (c.commandType === "build") {
          const b = placeBuilding(s, c.playerId, c.payload.kind, c.payload.x, c.payload.y, `${c.playerId}:${c.sequence}`);
          clearWork(s, c.payload.unitIds);
          commandBuild(s, c.payload.unitIds, b.id);
        } else if (c.commandType === "construct") {
          const b = s.buildings.find((b2) => b2.id === c.payload.buildingId);
          if (!b || b.complete) throw Error("\u5EFA\u7BC9\u5DF2\u4E0D\u5B58\u5728\u6216\u5DF2\u5B8C\u5DE5");
          clearWork(s, c.payload.unitIds);
          commandBuild(s, c.payload.unitIds, b.id);
        } else cancelBuilding(s, c.playerId, c.payload.buildingId);
      } catch (e) {
        result.ok = false;
        result.error = e.message;
        if (c.commandType !== "cancelBuild") {
          clearWork(s, c.payload.unitIds);
          commandStop(s, c.payload.unitIds);
        }
      }
      s.transactions.push(result);
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
  stepProduction(s);
  const stats = stepMovement(s);
  stepCombat(s);
  stepWork(s);
  updateVision(s.vision, s.map, s.units, s.tick);
  if (s.opponent === "ai") stepAI(s, (commandType, payload) => {
    try {
      submit(s, { protocolVersion: 1, rulesetHash, playerId: aiRules.player, sequence: s.sequence[aiRules.player] + 1, targetTick: s.tick + 1, commandType, payload }, false);
      return true;
    } catch {
      return false;
    }
  });
  return stats;
}
function replay(seed, commands, ticks, layout = "meadow", opponent = "idle") {
  if (!Number.isSafeInteger(ticks) || ticks < 0 || ticks > 1e5 || !Array.isArray(commands) || commands.length > 1e4) throw Error("\u7121\u6548\u91CD\u64AD\u7BC4\u570D");
  const s = createState(seed, layout, opponent);
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
  return JSON.stringify({ format: "brick-sandbox-16", rulesetHash, state: s, checksum: hash(s) });
}
function deserialize(raw) {
  const v = JSON.parse(raw);
  if (!v || v.format !== "brick-sandbox-16" || v.rulesetHash !== rulesetHash || !v.state || v.checksum !== hash(v.state)) throw Error("\u5B58\u6A94\u7248\u672C\u4E0D\u7B26\u6216\u5167\u5BB9\u640D\u58DE");
  const s = v.state;
  if (s.version !== 16 || s.opponent !== "ai" && s.opponent !== "idle" || !Number.isSafeInteger(s.tick) || s.tick < 0 || s.tick > 1e5 || !Array.isArray(s.log) || s.log.length > 1e4) throw Error("\u7121\u6548\u5B58\u6A94\u72C0\u614B");
  const rebuilt = replay(s.seed, s.log, s.tick, s.layout, s.opponent);
  if (hash(rebuilt) !== hash(s)) throw Error("\u5B58\u6A94\u72C0\u614B\u7121\u6CD5\u7531\u547D\u4EE4\u91CD\u5EFA");
  return structuredClone(s);
}

// packages/sim/protocol.ts
var UNIT_STRIDE = 15;
var STRIDE = UNIT_STRIDE;
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
        case "attack":
        case "move":
        case "stop":
        case "gather":
        case "build":
        case "construct":
        case "cancelBuild":
        case "train":
        case "cancelTrain":
        case "rally":
          if (state.log.length >= 1e4) throw Error("\u5DF2\u9054\u6C99\u76D2 10000 \u6307\u4EE4\u4E0A\u9650\uFF0C\u8ACB\u5132\u5B58\u6216\u91CD\u5EFA");
          {
            const envelope = { acceptedTick: state.tick, protocolVersion: 1, rulesetHash, playerId: 0, sequence: state.sequence[0] + 1, targetTick: state.tick + 1 };
            const command = op.kind === "attack" ? { ...envelope, commandType: "attack", payload: { unitIds: op.unitIds, target: op.target } } : op.kind === "move" ? { ...envelope, commandType: "move", payload: { unitIds: op.unitIds, x: op.x, y: op.y } } : op.kind === "gather" ? { ...envelope, commandType: "gather", payload: { unitIds: op.unitIds, resourceId: op.resourceId } } : op.kind === "build" ? { ...envelope, commandType: "build", payload: { unitIds: op.unitIds, kind: op.building, x: op.x, y: op.y } } : op.kind === "construct" ? { ...envelope, commandType: "construct", payload: { unitIds: op.unitIds, buildingId: op.buildingId } } : op.kind === "cancelBuild" ? { ...envelope, commandType: "cancelBuild", payload: { buildingId: op.buildingId } } : op.kind === "train" ? { ...envelope, commandType: "train", payload: { buildingId: op.buildingId, entryId: op.entryId } } : op.kind === "cancelTrain" ? { ...envelope, commandType: "cancelTrain", payload: { buildingId: op.buildingId, itemId: op.itemId } } : op.kind === "rally" ? { ...envelope, commandType: "rally", payload: { buildingId: op.buildingId, x: op.x, y: op.y } } : { ...envelope, commandType: "stop", payload: { unitIds: op.unitIds } };
            submit(state, command);
            accepted = command;
          }
          break;
        case "advance":
          if (!Number.isSafeInteger(op.count) || op.count < 1 || op.count > 80 || state.tick + op.count > 1e5) throw Error("\u6B65\u9032\u9700\u70BA 1\u201380 ticks\uFF0C\u7E3D\u91CF\u4E0D\u5F97\u8D85\u904E 100000");
          for (let i = 0; i < op.count; i++) tick(state);
          break;
        case "reset":
          state = createState(op.seed, op.layout, op.opponent);
          commands = [];
          break;
        case "restore":
          state = deserialize(op.snapshot);
          commands = structuredClone(state.log);
          break;
        case "recover": {
          if (!op.checkpoint) throw Error("\u7F3A\u5C11\u6062\u5FA9\u9EDE");
          const candidate = replay(op.checkpoint.seed, op.checkpoint.commands, op.checkpoint.ticks, op.checkpoint.layout, op.checkpoint.opponent);
          state = candidate;
          commands = structuredClone(state.log);
          break;
        }
        case "snapshot":
          snapshot = serialize(state);
          break;
        case "replay":
          replayMatches = hash(replay(state.seed, state.log, state.tick, state.layout, state.opponent)) === hash(state);
          break;
        default:
          throw Error("\u4E0D\u652F\u63F4\u7684 operation");
      }
      const visibleUnits = state.units.filter((u) => unitVisible(state.vision[0], u, 0));
      const positions = new Int32Array(visibleUnits.length * STRIDE);
      visibleUnits.forEach((u, i) => {
        const own = u.player === 0, w = own ? state.works[u.id] : void 0, c = own ? state.cargo[u.id] : void 0;
        const src = w?.kind === "gather" && w.phase === "gathering" ? state.map.resources.find((r) => r.id === w.resourceId) : void 0, box = src?.obstacleId ? state.map.obstacles.find((o) => o.id === src.obstacleId) : void 0, [bx0, by0, bx1, by1] = box ? obstacleBounds(box) : [0, 0, 0, 0];
        const fight = state.attacks[u.id], foe = fight?.target.kind === "unit" ? state.units.find((v) => v.id === fight.target.id) : void 0, site = fight?.target.kind === "building" ? state.map.obstacles.find((o) => o.id === fight.target.id) : void 0, sb = site ? obstacleBounds(site) : null;
        const target = box ? { x: Math.round((bx0 + bx1) / 2), y: Math.round((by0 + by1) / 2) } : foe ? { x: foe.x, y: foe.y } : sb ? { x: Math.round((sb[0] + sb[2]) / 2), y: Math.round((sb[1] + sb[3]) / 2) } : u.target;
        const action = fight && fight.firedTick >= 0 && state.tick - fight.firedTick < 10 ? 1 : u.hitTick >= 0 && state.tick - u.hitTick < combatRules.hitFlashTicks ? 2 : 0;
        positions.set([u.id, u.player, u.x, u.y, target?.x ?? -1, target?.y ?? -1, navigationStates.indexOf(u.navigation), w ? workPhases.indexOf(w.phase) : 0, c ? resources.indexOf(c.resource) : -1, c?.amount ?? 0, w?.kind === "gather" ? resources.indexOf(resourceDefinitions[state.map.resources.find((r) => r.id === w.resourceId).kind].yield) : -1, unitKinds.indexOf(u.kind), u.hp, combatRules.units[u.kind].hp, action], i * STRIDE);
      });
      const account = state.accounts[0], economy = { stock: { ...account.stock }, populationUsed: account.populationUsed, populationReserved: account.populationReserved, populationCap: account.populationCap, age: state.ages[0] };
      return { protocol: 1, id: req.id, ok: true, seed: state.seed, layout: state.layout, opponent: state.opponent, terrain: state.map.tiles.map(({ terrainType, height, walkClass, buildability }) => ({ terrainType, height, walkClass, buildability })), tick: state.tick, stateHash: hash(state), positions: positions.buffer, economy, corpses: state.corpses.filter((c) => c.player === 0 || state.vision[0].visible.includes(tileAt(c.x, c.y))).map((c) => ({ ...c })), outcome: state.outcome ? { ...state.outcome } : null, buildings: state.buildings.filter((b) => b.player === 0).map(({ id, kind, x, y, work, required, complete, queue, rally, hp, maxHp }) => ({ id, kind, x, y, work, required, complete, hp, maxHp, queue: queue.map(({ id: id2, entryId, work: work2, required: required2 }) => ({ id: id2, entryId, work: work2, required: required2 })), rally })), transactions: state.transactions.filter((t) => t.playerId === 0).slice(-5).map(({ sequence, tick: tick2, ok, error }) => ({ sequence, tick: tick2, ok, ...error ? { error } : {} })), ...projectVision(state.vision[0]), accepted, commands, snapshot, replayMatches };
    } catch (error) {
      return { protocol: 1, id: Number.isSafeInteger(req?.id) ? req.id : 0, ok: false, tick: state.tick, message: error.message, entityId: ["attack", "move", "stop", "gather", "build", "construct"].includes(req?.operation?.kind) ? req.operation.unitIds?.[0] : void 0 };
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
