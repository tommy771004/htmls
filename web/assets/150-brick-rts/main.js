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
function groundHeight(tiles, x, y) {
  return tiles[tileAt(x, y)]?.height ?? 0;
}
function tileAt(x, y) {
  return Math.floor(y / 100) * 16 + Math.floor(x / 100);
}
function canTraverse(tile, movement) {
  return tile.walkClass === movement || tile.walkClass === "both";
}

// apps/web/fog-debug.ts
var labels = ["\u672A\u63A2\u7D22", "\u5DF2\u63A2\u7D22\uFF0F\u76EE\u524D\u4E0D\u53EF\u898B", "\u76EE\u524D\u53EF\u898B"];
function fogCellSummary(view, x, y) {
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || x > 15 || y < 0 || y > 15) return "\u8ACB\u8F38\u5165 0\u201315 \u7684\u6574\u6578\u683C\u5EA7\u6A19\u3002";
  const id = y * 16 + x, state2 = view.fog[id];
  if (state2 === void 0) return "\u7B49\u5F85\u8996\u91CE\u8CC7\u6599\u3002";
  const memories = state2 === 0 ? [] : view.known.filter((k) => tileAt(k.obstacle.x, k.obstacle.y) === id && k.obstacle.kind === "house");
  return `\u683C (${x}, ${y}) \xB7 ${labels[state2]} \xB7 \u6295\u5F71 tick ${view.tick}` + memories.map((k) => `\uFF1B${k.obstacle.red ? "\u7D05\u65B9" : "\u85CD\u65B9"}\u4F4F\u5B85\uFF1A\u6700\u5F8C\u770B\u898B tick ${k.lastSeenTick}\uFF08${view.tick - k.lastSeenTick} ticks \u524D\uFF09`).join("");
}
function mountFogDebugger(root, getView) {
  const grid = root.querySelector(".fog-grid"), info = root.querySelector(".fog-cell-info"), memories = root.querySelector(".fog-memories");
  const x = root.querySelector('[name="fog-x"]'), y = root.querySelector('[name="fog-y"]');
  const cells = Array.from({ length: 256 }, (_, id) => {
    const cell = document.createElement("span");
    cell.setAttribute("aria-hidden", "true");
    cell.title = `(${id % 16}, ${Math.floor(id / 16)})`;
    grid.append(cell);
    return cell;
  });
  function update() {
    if (!root.open) return;
    const view = getView();
    cells.forEach((cell, id) => {
      const value = view.fog[id];
      cell.dataset.fog = String(value ?? -1);
      cell.textContent = value === 2 ? "\u25CF" : value === 1 ? "\xB7" : " ";
    });
    grid.setAttribute("aria-label", `\u85CD\u65B9 16\xD716 \u8996\u91CE\uFF1A\u672A\u63A2\u7D22 ${view.fog.filter((v) => v === 0).length} \u683C\uFF0C\u820A\u8996\u91CE ${view.fog.filter((v) => v === 1).length} \u683C\uFF0C\u76EE\u524D\u53EF\u898B ${view.fog.filter((v) => v === 2).length} \u683C\u3002`);
    info.textContent = fogCellSummary(view, x.value === "" ? NaN : Number(x.value), y.value === "" ? NaN : Number(y.value));
    const houses = view.known.filter((k) => k.obstacle.kind === "house" && view.fog[tileAt(k.obstacle.x, k.obstacle.y)] > 0);
    memories.textContent = houses.length ? houses.map((k) => `${k.obstacle.red ? "\u7D05\u65B9" : "\u85CD\u65B9"}\u4F4F\u5B85 (${Math.floor(k.obstacle.x / 100)}, ${Math.floor(k.obstacle.y / 100)})\uFF1A\u6700\u5F8C\u770B\u898B tick ${k.lastSeenTick}`).join("\uFF1B") : "\u5C1A\u7121\u5DF2\u77E5\u4F4F\u5B85\u3002";
  }
  root.addEventListener("toggle", update);
  x.addEventListener("input", update);
  y.addEventListener("input", update);
  return { update };
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
function validateRules(value, exact = false) {
  const errors = [];
  const obj = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
  if (!obj(value)) return ["\u898F\u5247\u5FC5\u9808\u662F JSON \u7269\u4EF6"];
  if (value.schemaVersion !== 1) errors.push("schemaVersion \u5FC5\u9808\u70BA 1");
  if (typeof value.id !== "string" || !value.id.trim()) errors.push("\u898F\u5247 ID \u4E0D\u53EF\u7A7A\u767D");
  if (!obj(value.reference)) errors.push("\u7F3A\u5C11 reference");
  else {
    const r = value.reference;
    if (typeof r.game !== "string" || !r.game.trim()) errors.push("\u7F3A\u5C11 reference.game");
    if (!["unverified", "verified_against_reference"].includes(r.verificationStatus)) errors.push("\u7121\u6548 reference verificationStatus");
    for (const k of ["version", "build"]) if (r[k] !== null && (typeof r[k] !== "string" || !r[k].trim())) errors.push(`\u7121\u6548 reference.${k}`);
    if (!Array.isArray(r.contentPacks) || !r.contentPacks.every((x) => typeof x === "string")) errors.push("contentPacks \u5FC5\u9808\u70BA\u5B57\u4E32\u9663\u5217");
    if (!Array.isArray(r.sourceEvidence) || !r.sourceEvidence.every((x) => typeof x === "string")) errors.push("sourceEvidence \u5FC5\u9808\u70BA\u5B57\u4E32\u9663\u5217");
    if ((exact || r.verificationStatus === "verified_against_reference") && (!r.version || !r.build || !r.sourceEvidence?.length)) errors.push("\u539F\u4F5C\u7CBE\u78BA\u9A57\u8B49\u5931\u6557\uFF1A\u7248\u672C\u3001build \u8207\u4F86\u6E90\u8B49\u64DA\u5C1A\u672A\u78BA\u8A8D");
  }
  if (!obj(value.coverage) || !(value.coverage.contentDenominator === null || Number.isSafeInteger(value.coverage.contentDenominator) && value.coverage.contentDenominator > 0) || value.coverage.exactReferenceCoveragePercent !== null) errors.push("\u6B64\u968E\u6BB5 coverage \u5206\u6BCD\u53EF\u70BA unknown\uFF0C\u539F\u4F5C\u8986\u84CB\u7387\u5FC5\u9808\u70BA null");
  if (!obj(value.settings)) errors.push("\u7F3A\u5C11 settings");
  else {
    for (const k of ["tickHz", "populationCap", "mapSize", "speed"]) if (!Number.isSafeInteger(value.settings[k]) || value.settings[k] <= 0) errors.push(`settings.${k} \u5FC5\u9808\u70BA\u6B63\u6574\u6578`);
    if (!Number.isSafeInteger(value.settings.seed) || value.settings.seed < 0 || value.settings.seed > 4294967295) errors.push("seed \u5FC5\u9808\u70BA uint32");
    if (value.settings.provenance !== "design_default") errors.push("\u6B64\u5207\u7247\u53C3\u6578\u5FC5\u9808\u6A19\u8A18 design_default");
  }
  if (!Array.isArray(value.entries)) return [...errors, "entries \u5FC5\u9808\u70BA\u9663\u5217"];
  const entries = value.entries.filter(obj);
  if (entries.length !== value.entries.length) errors.push("entry \u5FC5\u9808\u70BA\u7269\u4EF6");
  const ids = /* @__PURE__ */ new Set();
  for (const e of entries) {
    if (typeof e.id !== "string" || !e.id.trim()) errors.push("entry ID \u4E0D\u53EF\u7A7A\u767D");
    else if (ids.has(e.id)) errors.push(`\u91CD\u8907 ID\uFF1A${e.id}`);
    else ids.add(e.id);
    if (!["unit", "building", "technology"].includes(e.kind) || typeof e.name !== "string") errors.push(`${e.id} \u985E\u578B\u6216\u540D\u7A31\u7121\u6548`);
    if (e.referenceVersion !== null || !Array.isArray(e.sourceEvidence) || !e.sourceEvidence.length || !Array.isArray(e.testEvidence) || !["not_started", "in_progress"].includes(e.implementationStatus)) errors.push(`${e.id} \u8FFD\u8E64\u8CC7\u6599\u7121\u6548`);
    if (e.verificationStatus !== "design_default") errors.push(`${e.id} \u7F3A\u5C11 design_default`);
    for (const k of resources) if (!obj(e.cost) || !Number.isSafeInteger(e.cost[k]) || e.cost[k] < 0) errors.push(`${e.id} \u7121\u6548\u6210\u672C ${k}`);
    for (const k of ["time", "population"]) if (!Number.isSafeInteger(e[k]) || e[k] < 0) errors.push(`${e.id} \u7121\u6548 ${k}`);
    if (!Array.isArray(e.requires) || !e.requires.every((v) => typeof v === "string")) errors.push(`${e.id} requires \u5FC5\u9808\u70BA\u5B57\u4E32\u9663\u5217`);
  }
  const graph = new Map(entries.map((e) => [e.id, Array.isArray(e.requires) ? e.requires : []]));
  const visiting = /* @__PURE__ */ new Set(), done = /* @__PURE__ */ new Set();
  function visit(id) {
    if (visiting.has(id)) {
      errors.push(`\u79D1\u6280\u5716\u5FAA\u74B0\uFF1A${id}`);
      return;
    }
    if (done.has(id)) return;
    visiting.add(id);
    for (const dep of graph.get(id) || []) {
      if (!ids.has(dep)) errors.push(`${id} \u61F8\u7A7A\u524D\u7F6E\uFF1A${dep}`);
      else visit(dep);
    }
    visiting.delete(id);
    done.add(id);
  }
  for (const id of ids) visit(id);
  if (!Array.isArray(value.civilizations)) errors.push("civilizations \u5FC5\u9808\u70BA\u9663\u5217");
  else {
    const civIds = /* @__PURE__ */ new Set();
    for (const c of value.civilizations) {
      if (!obj(c) || typeof c.id !== "string" || !Array.isArray(c.available) || !Array.isArray(c.unavailable)) {
        errors.push("\u6587\u660E\u683C\u5F0F\u7121\u6548");
        continue;
      }
      if (civIds.has(c.id)) errors.push(`\u91CD\u8907\u6587\u660E ID\uFF1A${c.id}`);
      civIds.add(c.id);
      for (const id of [...c.available, ...c.unavailable]) if (!ids.has(id)) errors.push(`${c.id} \u61F8\u7A7A\u5167\u5BB9\uFF1A${id}`);
      for (const id of c.available) if (c.unavailable.includes(id)) errors.push(`${c.id} \u7981\u7528\u9805\u51FA\u73FE\u5728\u53EF\u7528\u5217\u8868\uFF1A${id}`);
    }
  }
  return [...new Set(errors)];
}

// apps/web/building-studs.ts
var studStyle = { pitch: 0.5, radius: 0.13, height: 0.08, seam: 0.018 };
function buildingStuds(parts) {
  const result = [];
  for (const part of parts) {
    if (!part.studs) continue;
    for (let dx = studStyle.pitch / 2; dx < part.w; dx += studStyle.pitch) for (let dz = studStyle.pitch / 2; dz < part.d; dz += studStyle.pitch) {
      const x = part.x + dx, z = part.z + dz, bottom = part.y + part.h;
      if (dx - studStyle.radius < studStyle.seam / 2 || dx + studStyle.radius > part.w - studStyle.seam / 2 || dz - studStyle.radius < studStyle.seam / 2 || dz + studStyle.radius > part.d - studStyle.seam / 2) continue;
      const covered = parts.some((other) => {
        if (other === part || other.y >= bottom + studStyle.height - 1e-8 || other.y + other.h <= bottom + 1e-8) return false;
        const nearestX = Math.max(other.x + studStyle.seam / 2, Math.min(x, other.x + other.w - studStyle.seam / 2));
        const nearestZ = Math.max(other.z + studStyle.seam / 2, Math.min(z, other.z + other.d - studStyle.seam / 2));
        return (x - nearestX) ** 2 + (z - nearestZ) ** 2 < studStyle.radius ** 2 - 1e-10;
      });
      if (!covered) result.push({ partId: part.id, x, y: bottom + studStyle.height / 2, z, color: part.color });
    }
  }
  return result;
}

// apps/web/brick-geometries.ts
function createArchGeometry(T, width, height, depth) {
  if (![width, height, depth].every((n) => Number.isFinite(n) && n > 0)) throw Error("\u62F1\u4EF6\u5C3A\u5BF8\u5FC5\u9808\u70BA\u6709\u9650\u6B63\u6578");
  const half = width / 2, radius = Math.min(width * 0.32, height * 0.35), spring = height * 0.55;
  const shape = new T.Shape();
  shape.moveTo(-half, 0);
  shape.lineTo(-half, height);
  shape.lineTo(half, height);
  shape.lineTo(half, 0);
  shape.lineTo(radius, 0);
  shape.lineTo(radius, spring);
  shape.absarc(0, spring, radius, 0, Math.PI, false);
  shape.lineTo(-radius, 0);
  shape.closePath();
  const geometry = new T.ExtrudeGeometry(shape, { depth, bevelEnabled: false, steps: 1, curveSegments: 8 });
  geometry.translate(0, 0, -depth / 2);
  return geometry;
}

// apps/web/military-building.ts
var militaryBuildings = ["barracks", "archery-range", "stable"];
function militaryBuildingParts(kind, v) {
  if (!militaryBuildings.includes(kind) || ![1, 2, 3, 4].includes(v.ageVariant) || ![v.progress, v.health].every((n) => Number.isFinite(n) && n >= 0 && n <= 100)) throw Error("\u7121\u6548\u8ECD\u4E8B\u5EFA\u7BC9\u5916\u89C0");
  const p = [], team = v.red ? "#b85c47" : "#456e87", wood = "#94734c", stone = "#b5b29e", top = 1.44 + (v.ageVariant - 1) * 0.16;
  const add = (id, phase, x, z, y, w, d, h, color, studs = false, shape) => p.push({ id, phase, x, z, y, w, d, h, color, studs, ...shape ? { shape } : {} });
  add("foundation", 0, -0.15, -0.15, 0, 3, 3, 0.16, "#b3aa8c");
  if (kind === "archery-range") {
    for (const x of [0.1, 2.5]) {
      add(`fence-post-${x}`, 1, x, 0.12, 0.16, 0.13, 2.1, 0.5, wood);
    }
    add("backstop", 1, 0.1, 0.12, 0.16, 2.53, 0.18, 1.1, wood);
    for (const x of [0.36, 1.67]) {
      add(`target-leg-${x}`, 2, x + 0.23, 0.75, 0.16, 0.1, 0.2, 0.75, wood);
      add(`target-board-${x}`, 2, x, 0.72, 0.83, 0.56, 0.16, 0.6, "#cfbd87");
      add(`target-ring-${x}`, 3, x + 0.1, 0.89, 0.93, 0.36, 0.03, 0.4, "#aa5c48");
      add(`target-center-${x}`, 3, x + 0.2, 0.93, 1.03, 0.16, 0.03, 0.2, "#e5d4a8");
    }
    add("arrow-rack", 3, 0.22, 2.3, 0.16, 0.7, 0.27, 0.4, wood);
    for (let i = 0; i < 4; i++) add(`arrow-${i}`, 3, 0.3 + i * 0.14, 2.4, 0.56, 0.03, 0.03, 0.42, "#d2be8f");
  } else {
    for (const x of [0.1, 2.44]) for (const z of [0.1, 1.65]) add(`post-${x}-${z}`, 1, x, z, 0.16, 0.16, 0.16, top - 0.16, v.ageVariant >= 3 ? stone : wood);
    add("back-wall", 1, 0.1, 0.1, 0.16, 2.5, 0.15, top - 0.16, kind === "stable" ? wood : stone);
    for (let level = 0; level < 3; level++) add(`roof-${level}`, 2, -0.05 + level * 0.28, -0.05, top + level * 0.16, 2.9 - level * 0.56, 1.98, 0.16, v.ageVariant === 1 ? "#b8a074" : team, true);
    if (kind === "barracks") {
      add("drill-floor", 1, 0.3, 1.85, 0.16, 2.1, 0.85, 0.08, "#a59a76");
      add("weapon-rack", 3, 0.3, 0.5, 0.16, 0.15, 1.1, 0.75, wood);
      for (let i = 0; i < 3; i++) {
        add(`spear-shaft-${i}`, 3, 0.32, 0.6 + i * 0.3, 0.16, 0.04, 0.04, 1.15, wood);
        add(`spear-point-${i}`, 3, 0.28, 0.58 + i * 0.3, 1.31, 0.12, 0.08, 0.2, "#bdc5bd");
      }
      for (const x of [0.5, 1.05, 1.6]) {
        add(`shield-support-${x}`, 3, x, 1.9, 0.24, 0.08, 0.15, 0.62, wood);
        add(`shield-${x}`, 3, x - 0.08, 2.02, 0.43, 0.36, 0.08, 0.44, team);
        add(`shield-boss-${x}`, 3, x + 0.04, 2.11, 0.57, 0.1, 0.04, 0.12, "#bca36f");
      }
    } else {
      for (const x of [0.15, 1.75]) {
        add(`stall-divider-${x}`, 1, x, 0.35, 0.16, 0.1, 1.3, 0.65, wood);
        add(`hay-${x}`, 3, x + 0.16, 0.4, 0.16, 0.62, 0.55, 0.3, "#beac69", true);
      }
      add("trough-base", 3, 0.6, 2.03, 0.16, 1.5, 0.4, 0.12, wood);
      for (const z of [2.03, 2.35]) add(`trough-rim-${z}`, 3, 0.6, z, 0.28, 1.5, 0.08, 0.2, wood);
      for (const x of [0.6, 2.02]) add(`trough-end-${x}`, 3, x, 2.11, 0.28, 0.08, 0.24, 0.2, wood);
      add("trough-water", 3, 0.69, 2.12, 0.29, 1.32, 0.22, 0.035, "#6a9297");
      add("saddle-rack", 3, 2.48, 0.9, 0.16, 0.12, 0.15, 0.85, wood);
      add("spare-saddle", 3, 2.3, 0.84, 1.01, 0.45, 0.4, 0.16, "#716045");
    }
  }
  if (v.ageVariant >= 2) {
    if (kind === "archery-range") {
      for (const x of [0.1, 2.44]) add(`canopy-post-${x}`, 1, x, 0.12, 0.16, 0.16, 0.18, top - 0.16, wood);
      add("canopy-beam", 1, 0.1, 0.12, top, 2.5, 0.18, 0.16, wood);
      add("canopy-roof", 2, -0.05, -0.02, top + 0.16, 2.8, 0.7, 0.16, team, true);
    } else {
      for (const x of [0.1, 2.44]) add(`porch-foot-${x}`, 1, x - 0.07, 1.58, 0.16, 0.3, 0.3, 0.32, stone);
      add("porch-beam", 1, 0.1, 1.65, top - 0.16, 2.5, 0.16, 0.16, wood);
      add("ridge-cap", 2, 0.79, -0.05, top + 0.48, 1.22, 1.98, 0.16, team, true);
    }
  }
  if (v.ageVariant >= 3) {
    if (kind === "archery-range") {
      add("stone-backstop", 1, 0.1, -0.04, 0.16, 2.5, 0.16, 1.28, stone);
      for (const x of [0.1, 2.3]) add(`backstop-buttress-${x}`, 1, x, 0.13, 0.16, 0.3, 0.35, 1.12, stone);
      for (let i = 0; i < 5; i++) add(`backstop-crenel-${i}`, 2, 0.1 + i * 0.5, -0.04, 1.44, 0.3, 0.16, 0.24, stone, true);
    } else {
      for (const z of [0.1, 1.6]) for (const x of [-0.05, 2.6]) add(`buttress-${x}-${z}`, 1, x, z, 0.16, 0.15, 0.3, top - 0.16, stone);
      add("porch-arch", 1, 0.26, 1.65, 0.16, 2.18, 0.16, top - 0.16, stone, false, "arch");
    }
  }
  if (v.ageVariant === 4) {
    if (kind === "archery-range") {
      for (const x of [0.1, 2.2]) {
        add(`turret-base-${x}`, 2, x, 0.05, top + 0.32, 0.4, 0.4, 0.16, stone);
        for (const dx of [0, 0.28]) add(`turret-post-${x}-${dx}`, 3, x + dx, 0.05, top + 0.48, 0.12, 0.4, 0.48, stone);
        add(`turret-cap-${x}`, 3, x - 0.05, 0, top + 0.96, 0.5, 0.5, 0.16, team, true);
      }
    } else {
      const base = top + 0.64;
      add("vent-base", 2, 0.91, 0.5, base, 0.96, 0.8, 0.16, stone);
      for (const x of [0.91, 1.71]) for (const z of [0.5, 1.14]) add(`vent-post-${x}-${z}`, 3, x, z, base + 0.16, 0.16, 0.16, 0.48, stone);
      add("vent-cap", 3, 0.83, 0.42, base + 0.64, 1.12, 0.96, 0.16, team, true);
      add("vent-crown", 4, 1.07, 0.58, base + 0.8, 0.64, 0.64, 0.16, team, true);
    }
  }
  add("flag-pole", 4, 2.67, 2.63, 0.16, 0.06, 0.06, 1.6, wood);
  add("flag", 4, 2.24, 2.63, 1.42, 0.44, 0.05, 0.28, team);
  if (v.health === 0) return [p[0], ...Array.from({ length: 12 }, (_, i) => ({ id: `debris-${i}`, phase: 0, x: 0.2 + i % 4 * 0.6, z: 0.2 + Math.floor(i / 4) * 0.7, y: 0.16, w: 0.34, d: 0.3, h: 0.12, color: wood, studs: false }))];
  return p.filter((a) => a.phase <= Math.min(4, Math.floor(v.progress / 20))).filter((a) => v.health >= 50 || !(a.id === "flag" || a.id.startsWith("target-center") || a.id === "vent-crown" || a.id.startsWith("backstop-crenel")));
}

// apps/web/unit-rig.ts
var unitPoses = ["idle", "walk", "work", "attack", "hit", "death", "carry"];
var unitTools = ["none", "axe", "pick", "sickle", "hammer", "basket", "sword", "spear", "bow"];
var unitRoles = ["villager", "swordsman", "spearman", "archer"];
function samplePose(pose, time) {
  const t = Math.max(0, Number.isFinite(time) ? time : 0), walk = Math.sin(t * 0.012) * 0.35;
  const p = { leftLeg: 0, rightLeg: 0, leftArm: 0, rightArm: 0, lean: 0, fall: 0 };
  if (pose === "walk") {
    p.leftLeg = walk;
    p.rightLeg = -walk;
    p.leftArm = -walk * 0.6;
    p.rightArm = walk * 0.6;
  }
  if (pose === "work") {
    p.rightArm = -0.9 + Math.sin(t * 0.01) * 0.7;
    p.leftArm = -0.25;
  }
  if (pose === "attack") {
    p.rightArm = -1.25 + Math.sin(t * 0.012) * 1;
    p.leftArm = -0.45;
  }
  if (pose === "carry") {
    p.leftArm = -1.1;
    p.rightArm = -1.1;
  }
  if (pose === "hit" && t > 0 && t < 300) p.lean = -0.24 * Math.sin(Math.PI * t / 300);
  if (pose === "death") p.fall = Math.min(t / 700, 1) * Math.PI / 2;
  return p;
}
function createUnitRig(T, player, box, material) {
  const root = new T.Group();
  root.name = "body-root";
  const part = (parent, x, y, z, w, h, d, color) => {
    const mesh = new T.Mesh(box(w, h, d), material(color));
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  };
  const team = player === 0 ? "#45728c" : "#b25441";
  function joint(name, x, y, z) {
    const group = new T.Group();
    group.name = name;
    group.position.set(x, y, z);
    root.add(group);
    return group;
  }
  const leftLeg = joint("hip-left", -0.12, 0.3, 0), rightLeg = joint("hip-right", 0.12, 0.3, 0);
  for (const leg of [leftLeg, rightLeg]) part(leg, 0, -0.3, 0, 0.19, 0.3, 0.24, "#44514b");
  part(root, 0, 0.3, 0, 0.46, 0.4, 0.32, team);
  part(root, 0, 0.71, 0, 0.34, 0.3, 0.3, "#dfbb7e");
  part(root, 0, 1.02, 0, 0.44, 0.11, 0.4, player === 0 ? "#cbbc94" : "#835243");
  for (const dx of [-0.075, 0.075]) part(root, dx, 0.86, 0.155, 0.035, 0.04, 0.018, "#3e3a2e");
  const leftArm = joint("shoulder-left", -0.19, 0.67, 0), rightArm = joint("shoulder-right", 0.19, 0.67, 0);
  const sockets = { leftHand: new T.Group(), rightHand: new T.Group() };
  for (const [arm, socket, name] of [[leftArm, sockets.leftHand, "hand-left"], [rightArm, sockets.rightHand, "hand-right"]]) {
    part(arm, 0, -0.28, 0, 0.1, 0.28, 0.16, team);
    part(arm, 0, -0.38, 0, 0.1, 0.14, 0.17, "#dfbb7e");
    socket.name = name;
    socket.position.set(0, -0.31, 0.09);
    arm.add(socket);
  }
  let seated = false;
  const outfits = /* @__PURE__ */ new Map();
  function dress(role) {
    if (!unitRoles.includes(role)) throw Error("\u672A\u77E5\u6A21\u578B\u8ECD\u7A2E");
    for (const outfit2 of outfits.values()) outfit2.visible = false;
    shield.visible = false;
    if (role === "villager") {
      equip("none");
      return;
    }
    let outfit = outfits.get(role);
    if (!outfit) {
      outfit = new T.Group();
      outfit.name = `outfit-${role}`;
      root.add(outfit);
      outfits.set(role, outfit);
      if (role === "archer") {
        part(outfit, 0, 1.1, 0, 0.36, 0.13, 0.32, "#667c4e");
        part(outfit, 0, 0.36, -0.24, 0.21, 0.43, 0.18, "#8b6746");
        for (const x of [-0.06, 0.06]) part(outfit, x, 0.77, -0.24, 0.025, 0.2, 0.025, "#d3b981");
      } else {
        part(outfit, 0, 1.12, 0, 0.4, 0.14, 0.35, "#a5b0ad");
        part(outfit, 0, 0.4, 0.18, 0.36, 0.23, 0.055, "#a5b0ad");
        if (role === "spearman") part(outfit, 0, 1.26, 0, 0.065, 0.15, 0.25, team);
      }
    }
    outfit.visible = true;
    shield.visible = role === "swordsman";
    equip(role === "swordsman" ? "sword" : role === "spearman" ? "spear" : "bow");
  }
  const shield = new T.Group();
  shield.name = "shield-left";
  sockets.leftHand.add(shield);
  shield.visible = false;
  part(shield, -0.12, -0.17, 0.07, 0.08, 0.48, 0.4, "#9d885b");
  part(shield, -0.17, -0.11, 0.07, 0.03, 0.34, 0.28, team);
  const toolMeshes = /* @__PURE__ */ new Map();
  let selected2 = "none";
  function makeTool(kind) {
    const group = new T.Group();
    group.name = `tool-${kind}`;
    sockets.rightHand.add(group);
    if (kind === "basket") {
      part(group, -0.15, -0.12, 0.16, 0.4, 0.28, 0.34, "#96764c");
      for (const x of [-0.32, 0.02]) part(group, x, 0.12, 0.16, 0.035, 0.15, 0.04, "#b79a67");
      part(group, -0.15, 0.25, 0.16, 0.38, 0.035, 0.04, "#b79a67");
    } else if (kind === "spear") {
      part(group, 0, -0.28, 0, 0.05, 1.42, 0.05, "#967447");
      part(group, 0, 1.14, 0, 0.11, 0.23, 0.06, "#c6cfca");
    } else if (kind === "bow") {
      for (const [y, z] of [[-0.12, 0], [0.04, 0.08], [0.2, 0.12], [0.36, 0.08], [0.52, 0]]) part(group, 0, y, z, 0.065, 0.17, 0.06, "#997447");
      part(group, 0, -0.12, 0, 0.018, 0.81, 0.018, "#d9cba4");
    } else if (kind !== "none") {
      part(group, 0, -0.08, 0, 0.055, 0.48, 0.06, kind === "sword" ? "#756449" : "#967447");
      if (kind === "axe") part(group, 0.08, 0.23, 0, 0.22, 0.15, 0.055, "#aab0a3");
      if (kind === "pick") part(group, 0, 0.32, 0, 0.38, 0.045, 0.06, "#aab0a3");
      if (kind === "hammer") part(group, 0, 0.28, 0, 0.23, 0.13, 0.12, "#979e93");
      if (kind === "sickle") {
        part(group, 0.05, 0.25, 0, 0.15, 0.045, 0.05, "#aab0a3");
        part(group, 0.11, 0.16, 0, 0.04, 0.12, 0.05, "#aab0a3");
      }
      if (kind === "sword") {
        part(group, 0, 0.22, 0, 0.22, 0.045, 0.07, "#baa167");
        part(group, 0, 0.27, 0, 0.07, 0.46, 0.045, "#c6cfca");
      }
    }
    toolMeshes.set(kind, group);
    return group;
  }
  function equip(kind) {
    if (!unitTools.includes(kind)) throw Error("\u672A\u77E5\u6A21\u578B\u5DE5\u5177");
    for (const mesh of toolMeshes.values()) mesh.visible = false;
    selected2 = kind;
    if (kind !== "none") (toolMeshes.get(kind) ?? makeTool(kind)).visible = true;
  }
  function pose(kind, time) {
    if (!unitPoses.includes(kind)) throw Error("\u672A\u77E5\u6A21\u578B\u59FF\u614B");
    const p = samplePose(kind, time);
    leftLeg.rotation.x = seated ? 0 : p.leftLeg;
    rightLeg.rotation.x = seated ? 0 : p.rightLeg;
    leftLeg.position.x = seated ? -0.4 : -0.12;
    rightLeg.position.x = seated ? 0.4 : 0.12;
    leftArm.rotation.x = p.leftArm;
    rightArm.rotation.x = p.rightArm;
    root.rotation.x = p.lean;
    root.rotation.z = -p.fall;
    root.position.y = 0.28 * Math.sin(p.fall);
    for (const [tool, mesh] of toolMeshes) mesh.visible = tool === selected2 && kind !== "death";
  }
  return { root, sockets, equip, pose, dress, seat: (value) => {
    seated = value;
  } };
}

// apps/web/character-rig.ts
function createCharacterRig(T, player, box, material) {
  const root = new T.Group(), rider = createUnitRig(T, player, box, material);
  root.add(rider.root);
  let horse = null, saddle = null, mounted = false;
  const legs = [];
  const part = (parent, x, y, z, w, h, d, color) => {
    const m = new T.Mesh(box(w, h, d), material(color));
    m.position.set(x, y, z);
    m.castShadow = true;
    parent.add(m);
  };
  function makeHorse() {
    horse = new T.Group();
    horse.name = "horse-root";
    root.add(horse);
    part(horse, 0, 0.62, 0, 0.56, 0.5, 1.15, "#957350");
    part(horse, 0, 0.82, 0.43, 0.36, 0.65, 0.32, "#957350");
    part(horse, 0, 1.22, 0.61, 0.38, 0.28, 0.52, "#a5835b");
    part(horse, 0, 1.5, 0.5, 0.3, 0.14, 0.12, "#64533d");
    for (const x of [-0.2, 0.2]) part(horse, x, 1.39, 0.67, 0.03, 0.04, 0.05, "#2f3932");
    part(horse, 0, 0.72, -0.66, 0.16, 0.4, 0.15, "#64533d");
    part(horse, 0, 1.12, 0, 0.68, 0.08, 0.5, player === 0 ? "#45728c" : "#b25441");
    for (const x of [-0.19, 0.19]) for (const z of [-0.42, 0.42]) {
      const leg = new T.Group();
      leg.name = `horse-leg-${legs.length}`;
      leg.position.set(x, 0.62, z);
      horse.add(leg);
      legs.push(leg);
      part(leg, 0, -0.62, 0, 0.15, 0.62, 0.17, "#957350");
      part(leg, 0, -0.62, 0.025, 0.18, 0.12, 0.22, "#514b3c");
    }
    saddle = new T.Group();
    saddle.name = "rider-saddle";
    saddle.position.set(0, 0.9, -0.05);
    horse.add(saddle);
  }
  function dress(role) {
    mounted = role === "cavalry";
    if (mounted) {
      if (!horse) makeHorse();
      horse.visible = true;
      saddle.add(rider.root);
      rider.dress("swordsman");
      rider.equip("spear");
    } else {
      if (horse) horse.visible = false;
      root.add(rider.root);
      rider.dress(role);
    }
    rider.seat(mounted);
    pose("idle", 0);
  }
  function pose(kind, time) {
    if (mounted && !["idle", "walk", "attack"].includes(kind)) throw Error("\u9A0E\u4E58\u6A21\u578B\u76EE\u524D\u50C5\u652F\u63F4\u5F85\u547D\u3001\u884C\u8D70\u8207\u653B\u64CA\u59FF\u614B");
    rider.pose(kind, time);
    if (horse) {
      const phase = Number.isFinite(time) ? Math.max(0, time) * 0.012 : 0;
      legs.forEach((leg, i) => {
        const swing = mounted && kind === "walk" ? Math.sin(phase + (i === 0 || i === 3 ? 0 : Math.PI)) * 0.26 : 0;
        leg.rotation.x = swing;
        leg.position.y = 0.62 + Math.abs(Math.sin(swing)) * 0.14;
      });
    }
  }
  return { root, sockets: rider.sockets, equip: rider.equip, dress, pose };
}

// apps/web/picking.ts
function visibleMeshHits(raycaster, roots) {
  const meshes = [];
  for (const root of roots) root.traverseVisible((object) => {
    if (object.isMesh) meshes.push(object);
  });
  return raycaster.intersectObjects(meshes, false);
}

// apps/web/lod.ts
function detailLevel(zoom) {
  return zoom >= 1.8 ? "near" : zoom >= 0.9 ? "medium" : "far";
}
function createDetailController(T) {
  const detailed = /* @__PURE__ */ new Map(), simple = /* @__PURE__ */ new Map();
  function register(geometry, w, h, d) {
    const low = new T.BoxGeometry(w, h, d);
    low.translate(0, h / 2, 0);
    detailed.set(geometry, geometry);
    detailed.set(low, geometry);
    simple.set(geometry, low);
    simple.set(low, low);
  }
  function apply(root, zoom) {
    const level = detailLevel(zoom);
    root.traverse((o) => {
      if (o.isMesh && detailed.has(o.geometry)) o.geometry = (level === "near" ? detailed : simple).get(o.geometry);
      if (o.userData.studs) o.visible = level !== "far";
    });
  }
  function withSelectionGeometry(root, read) {
    const previous = /* @__PURE__ */ new Map();
    root.traverse((o) => {
      if (o.isMesh && detailed.has(o.geometry)) {
        previous.set(o, o.geometry);
        o.geometry = detailed.get(o.geometry);
      }
    });
    try {
      return read();
    } finally {
      for (const [mesh, geometry] of previous) mesh.geometry = geometry;
    }
  }
  function dispose() {
    for (const geometry of new Set(simple.values())) geometry.dispose();
    simple.clear();
    detailed.clear();
  }
  return { register, apply, withSelectionGeometry, dispose };
}

// apps/web/economic-building.ts
var economicBuildings = ["lumber-camp", "mining-camp", "mill", "farm", "town-center", "market", "smithy"];
function economicBuildingParts(kind, v) {
  if (!economicBuildings.includes(kind) || ![1, 2, 3, 4].includes(v.ageVariant) || ![v.progress, v.health].every((n) => Number.isFinite(n) && n >= 0 && n <= 100)) throw Error("\u7121\u6548\u7D93\u6FDF\u5EFA\u7BC9\u5916\u89C0");
  const p = [], team = v.red ? "#b85c47" : "#456e87", wood = "#94734c", stone = "#aaa994", height = 1.28 + (v.ageVariant - 1) * 0.16;
  const add = (id, phase, x, z, y, w, d, h, color, studs = false, shape) => p.push({ id, phase, x, z, y, w, d, h, color, studs, ...shape ? { shape } : {} });
  add("foundation", 0, -0.15, -0.15, 0, 3, 3, 0.16, kind === "farm" ? "#806b49" : "#b3aa8c");
  if (kind === "farm") {
    for (let row = 0; row < 4; row++) {
      add(`furrow-${row}`, 1, 0.12, 0.12 + row * 0.65, 0.16, 2.45, 0.36, 0.12, "#6d563d");
      for (let col = 0; col < 5; col++) {
        add(`crop-${row}-${col}`, 2, 0.2 + col * 0.47, 0.19 + row * 0.65, 0.28, 0.18, 0.18, 0.24, "#879957", true);
        add(`grain-${row}-${col}`, 3, 0.22 + col * 0.47, 0.21 + row * 0.65, 0.52, 0.14, 0.14, 0.13, "#c0ad67");
      }
    }
    add("boundary-back", 1, 0, 0, 0.16, 2.7, 0.08, 0.12, wood);
    add("boundary-front", 1, 0, 2.62, 0.16, 2.7, 0.08, 0.12, wood);
  } else {
    const roofY = height + (kind === "mill" ? 0.96 : 0.16);
    for (const x of [0.1, 2.4]) for (const z of [0.1, 1.8]) add(`post-${x}-${z}`, 1, x, z, 0.16, 0.16, 0.16, roofY - 0.16, v.ageVariant >= 3 ? stone : wood);
    add("back-brace", 1, 0.1, 0.1, roofY - 0.24, 2.46, 0.14, 0.24, wood);
    if (kind === "market") {
      for (let stripe = 0; stripe < 6; stripe++) add(`awning-${stripe}`, 2, -0.05 + stripe * 0.48, -0.05, roofY, 0.48, 2.25, 0.16, stripe % 2 ? "#e4d4ab" : team);
    } else for (let level = 0; level < 3; level++) add(`roof-${level}`, 2, -0.05 + level * 0.28, -0.05, roofY + level * 0.16, 2.9 - level * 0.56, 2.25, 0.16, v.ageVariant === 1 ? "#b8a074" : team, true);
    if (kind === "lumber-camp") {
      for (let row = 0; row < 3; row++) for (let layer = 0; layer < 2; layer++) add(`log-${row}-${layer}`, 3, 0.25, 0.3 + row * 0.28, 0.16 + layer * 0.2, 1.6, 0.22, 0.2, wood, true);
      for (const x of [0.55, 1.75]) add(`saw-leg-${x}`, 3, x, 2.15, 0.16, 0.14, 0.32, 0.45, "#66563e");
      add("saw-worktop", 3, 0.35, 2.08, 0.61, 1.8, 0.48, 0.12, wood);
      add("saw-blade", 3, 0.9, 2.24, 0.73, 0.85, 0.06, 0.14, "#b8c0b9");
    } else if (kind === "mining-camp") {
      add("hopper-base", 3, 0.35, 0.4, 0.16, 1.7, 0.9, 0.16, wood);
      for (const x of [0.35, 1.89]) add(`hopper-wall-${x}`, 3, x, 0.4, 0.32, 0.16, 0.9, 0.55, wood);
      add("hopper-back", 3, 0.35, 0.4, 0.32, 1.7, 0.16, 0.55, wood);
      for (let i = 0; i < 6; i++) add(`ore-${i}`, 3, 0.59 + i % 3 * 0.39, 0.62 + Math.floor(i / 3) * 0.32, 0.32, 0.3, 0.26, 0.25, i % 2 ? stone : "#c0a557", true);
      add("pick-handle", 3, 2.42, 0.8, 0.16, 0.06, 0.06, 1.05, wood);
      add("pick-head", 3, 2.2, 0.8, 1.12, 0.5, 0.08, 0.1, "#b8c0b9");
    } else if (kind === "mill") {
      for (let course = 0; course < 6; course++) add(`mill-tower-${course}`, 1, 0.85, 0.6, 0.16 + course * 0.4, 1, 1, 0.4, course % 2 ? stone : "#c4bfa8", true);
      const hubY = height + 0.75;
      add("axle", 3, 1.28, 1.6, hubY, 0.14, 0.83, 0.14, wood);
      add("blade-vertical", 3, 1.26, 2.37, hubY - 1.12, 0.18, 0.1, 2.4, "#d6c6a0");
      add("blade-horizontal", 3, 0.15, 2.48, hubY, 2.4, 0.1, 0.18, "#d6c6a0");
      add("hub", 3, 1.19, 2.33, hubY - 0.04, 0.32, 0.29, 0.28, "#7c674b");
      for (const x of [0.22, 2.13]) add(`grain-bag-${x}`, 3, x, 0.7, 0.16, 0.38, 0.4, 0.48, "#c5b285", true);
    } else if (kind === "town-center") {
      for (const x of [0.15, 2.05]) add(`hall-pier-${x}`, 1, x, 0.15, 0.16, 0.5, 1.5, height, stone, true);
      add("entrance-lintel", 1, 0.65, 1.5, 0.16, 1.4, 0.25, height - 0.16, stone, false, "arch");
      for (let level = 0; level < 3; level++) add(`entrance-step-${level}`, 3, 0.8, 2.15 + level * 0.18, 0.16, 0.95, 0.18, 0.24 - level * 0.08, "#c8bea4");
      const towerBase = roofY + 0.48;
      add("belfry-floor", 3, 0.87, 0.65, towerBase, 0.96, 0.85, 0.16, stone, true);
      for (const x of [0.91, 1.63]) for (const z of [0.69, 1.25]) add(`belfry-pillar-${x}-${z}`, 3, x, z, towerBase + 0.16, 0.12, 0.12, 0.65, stone);
      add("belfry-top", 3, 0.8, 0.58, towerBase + 0.81, 1.1, 1, 0.16, team, true);
      add("bell-hanger", 3, 1.33, 0.98, towerBase + 0.55, 0.05, 0.05, 0.26, wood);
      add("bell", 3, 1.2, 0.88, towerBase + 0.4, 0.3, 0.28, 0.22, "#bca068");
      add("notice-board", 3, 0.14, 1.9, 0.72, 0.48, 0.08, 0.4, wood);
      add("notice-paper", 3, 0.2, 1.99, 0.78, 0.34, 0.025, 0.27, "#e5d9b3");
      add("cargo-crate", 3, 2.1, 2.1, 0.16, 0.42, 0.42, 0.38, wood, true);
    } else if (kind === "market") {
      for (const x of [0.24, 1.94]) {
        add(`stall-${x}`, 3, x, 0.35, 0.16, 0.52, 1.38, 0.48, wood);
        for (let i = 0; i < 3; i++) add(`goods-${x}-${i}`, 3, x + 0.08, 0.48 + i * 0.4, 0.64, 0.34, 0.28, 0.18, i % 2 ? "#b9a76c" : "#8f9e5e", true);
      }
      add("scale-post", 3, 2.18, 1.48, 0.64, 0.04, 0.04, 0.46, "#8c8879");
      add("scale-beam", 3, 1.98, 1.48, 1.1, 0.44, 0.04, 0.04, "#8c8879");
      for (const x of [1.99, 2.36]) {
        add(`scale-wire-${x}`, 3, x, 1.48, 0.9, 0.025, 0.025, 0.2, "#8c8879");
        add(`scale-pan-${x}`, 3, x - 0.05, 1.43, 0.87, 0.13, 0.13, 0.04, "#b8b3a0");
      }
    } else if (kind === "smithy") {
      add("forge-back", 1, 0.28, 0.22, 0.16, 1.05, 0.3, 1.05, stone, true);
      for (const x of [0.28, 1.05]) add(`forge-side-${x}`, 1, x, 0.52, 0.16, 0.28, 0.7, 0.85, stone);
      add("forge-lintel", 1, 0.28, 0.52, 1.01, 1.05, 0.7, 0.2, stone);
      add("cold-hearth", 3, 0.56, 0.52, 0.16, 0.49, 0.7, 0.16, "#4e514b");
      add("chimney", 3, 0.55, 0.28, 1.21, 0.5, 0.5, roofY - 0.41, stone, true);
      add("chimney-cap", 3, 0.49, 0.22, roofY + 0.8, 0.62, 0.62, 0.12, "#73786d");
      add("anvil-base", 3, 1.7, 1.7, 0.16, 0.5, 0.45, 0.34, wood);
      add("anvil-neck", 3, 1.83, 1.8, 0.5, 0.23, 0.25, 0.2, "#76817d");
      add("anvil-face", 3, 1.6, 1.71, 0.7, 0.7, 0.43, 0.12, "#a0aaa5");
      add("bellows", 3, 1.34, 0.56, 0.16, 0.65, 0.5, 0.25, "#927052");
      add("coal-bin", 3, 0.25, 2.14, 0.16, 0.65, 0.42, 0.22, "#665940");
      for (let i = 0; i < 3; i++) add(`coal-${i}`, 3, 0.31 + i * 0.17, 2.21, 0.38, 0.13, 0.22, 0.1, "#424944");
    }
  }
  add("marker-pole", 4, 2.65, 2.7, 0.16, 0.06, 0.06, kind === "farm" ? 0.65 : height + 0.6, wood);
  add("marker-flag", 4, 2.34, 2.7, kind === "farm" ? 0.61 : height + 0.44, 0.32, 0.05, 0.22, team);
  if (v.health === 0) return [p[0], ...Array.from({ length: 12 }, (_, i) => ({ id: `debris-${i}`, phase: 0, x: 0.2 + i % 4 * 0.6, z: 0.2 + Math.floor(i / 4) * 0.7, y: 0.16, w: 0.34, d: 0.3, h: 0.12, color: wood, studs: false }))];
  return p.filter((a) => a.phase <= Math.min(4, Math.floor(v.progress / 20))).filter((a) => v.health >= 50 || !(a.id === "marker-flag" || a.id === "roof-2" || a.id === "awning-2" || a.id === "awning-4" || a.id.startsWith("grain-") || a.id === "blade-horizontal"));
}

// packages/content/footprints.ts
var obstacleFootprints = {
  house: { x: -15, y: -15, width: 250, depth: 230 },
  tree: { x: -20, y: -20, width: 100, depth: 100 },
  rock: { x: 0, y: 0, width: 65, depth: 70 },
  gold: { x: 0, y: 0, width: 65, depth: 70 },
  berries: { x: 0, y: 0, width: 65, depth: 70 },
  hunt: { x: 0, y: 0, width: 65, depth: 70 },
  livestock: { x: 0, y: 0, width: 65, depth: 70 }
};
function obstacleBounds(o, radius = 0) {
  const f = obstacleFootprints[o.kind];
  if (!f || !Number.isSafeInteger(radius) || radius < 0) throw Error("\u7121\u6548\u5360\u5730\u6216\u534A\u5F91");
  return [o.x + f.x - radius, o.y + f.y - radius, o.x + f.x + f.width + radius, o.y + f.y + f.depth + radius];
}

// apps/web/building-parts.ts
function buildingParts(visual) {
  const { ageVariant: age, progress, health, red } = visual;
  if (![1, 2, 3, 4].includes(age) || ![progress, health].every((v) => Number.isFinite(v) && v >= 0 && v <= 100)) throw Error("\u7121\u6548\u5EFA\u7BC9\u5916\u89C0\u72C0\u614B");
  const parts = [], team = red ? "#b85c47" : "#456e87";
  const add = (id, phase2, x, z, y, w, d, h, color, studs = false, shape) => parts.push({ id, phase: phase2, x, z, y, w, d, h, color, studs, ...shape ? { shape } : {} });
  const footprint = obstacleFootprints.house;
  add("foundation", 0, footprint.x / 100, footprint.y / 100, 0, footprint.width / 100, footprint.depth / 100, 0.16, "#b3aa8c");
  const courses = age + 2, wallTop = 0.16 + courses * 0.32, wall = age <= 2 ? "#dec59b" : "#b7b6a5";
  for (let level = 0; level < courses; level++) {
    const y = 0.16 + level * 0.32;
    add(`back-${level}`, 1, 0, 0, y, 2, 0.18, 0.32, wall);
    for (const x of [0, 1.82]) add(`side-${x}-${level}`, 1, x, 0.18, y, 0.18, 1.64, 0.32, wall);
    for (const x of [0, 1.3]) add(`front-${x}-${level}`, 1, x, 1.82, y, 0.7, 0.18, 0.32, wall);
    if (level >= 3) add(`lintel-${level}`, 1, 0.7, 1.82, y, 0.6, 0.18, 0.32, wall);
  }
  if (age <= 2) for (const x of [0, 0.64, 1.3, 1.94]) add(`timber-${x}`, 1, x, 1.98, 0.16, 0.06, 0.06, wallTop - 0.16, "#80674f");
  else for (const x of [-0.05, 1.73]) add(`buttress-${x}`, 1, x, 1.78, 0.16, 0.32, 0.3, wallTop - 0.16, "#999e92");
  const roofBase = wallTop, roof = age === 1 ? "#b8a074" : age === 2 ? team : "#677681", levels = age === 1 ? 3 : 4;
  for (let level = 0; level < levels; level++) for (let row = 0; row < 5; row++) add(`roof-${level}-${row}`, 2, -0.2 + level * 0.25, -0.2 + row * 0.5, roofBase + level * 0.18, 2.5 - level * 0.5, 0.5, 0.18, roof, true);
  add("door", 3, 0.76, 1.98, 0.16, 0.48, 0.06, 0.92, "#685740");
  add("door-handle", 3, 0.81, 2.045, 0.61, 0.055, 0.03, 0.07, "#c2a664");
  for (const x of [0.13, 1.47]) {
    add(`window-frame-${x}`, 3, x, 1.99, 0.76, 0.38, 0.06, 0.38, "#786b55");
    add(`window-glass-${x}`, 3, x + 0.04, 2.055, 0.8, 0.3, 0.025, 0.29, "#334b4e");
  }
  if (age >= 2) {
    add("chimney", 3, 1.5, 0.3, wallTop, 0.4, 0.4, 0.95, "#b1aa95");
    add("chimney-cap", 3, 1.46, 0.26, wallTop + 0.95, 0.48, 0.48, 0.1, "#78796b");
  }
  if (age >= 3) {
    add("stone-door-header", 3, 0.6, 1.97, 0.16, 0.8, 0.15, 1.28, "#d0ceba", false, "arch");
    add("roof-ridge", 3, 0.7, -0.2, roofBase + 0.72, 0.7, 2.5, 0.16, team, true);
  }
  if (age === 4) {
    for (const z of [0.05, 1.55]) {
      add(`dormer-base-${z}`, 3, 0.5, z, roofBase + 0.36, 0.5, 0.4, 0.64, "#c9c4ae");
      add(`dormer-cap-${z}`, 3, 0.45, z - 0.04, roofBase + 1, 0.6, 0.48, 0.16, team, true);
    }
    add("cargo-platform", 3, 0.75, 0.7, 0.16, 0.5, 0.6, 0.12, "#96764c");
  }
  const poleBase = roofBase + 0.36;
  add("flag-pole", 4, 0.27, 0.25, poleBase, 0.07, 0.07, 0.9, "#786849");
  add("flag", 4, 0.34, 0.25, poleBase + 0.58, 0.6, 0.04, 0.3, team);
  if (health === 0) {
    return [parts[0], ...Array.from({ length: 12 }, (_, i) => ({ id: `debris-${i}`, phase: 0, x: 0.1 + i % 4 * 0.43, z: 0.12 + Math.floor(i / 4) * 0.53, y: 0.16, w: 0.32, d: 0.27, h: 0.12, color: i % 3 ? wall : roof, studs: false }))];
  }
  const phase = Math.min(4, Math.floor(progress / 20));
  return parts.filter((p) => p.phase <= phase).filter((p) => health >= 50 || !(p.id.startsWith("roof-") && Number(p.id.split("-")[2]) % 2 === 0 || p.id === "flag"));
}

// packages/sim/navigation.ts
var navigationRules = { provenance: "design_default", spacing: 50, size: 31, radius: 25, expansionsPerTick: 32, speedPerTick: 5 };
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
  let obstacles = [{ kind: "house", x: 300, y: 400 }, { kind: "house", x: 1100, y: 400, red: true }];
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
  obstacles = obstacles.filter((o) => o.kind === "house" || !guaranteed.some((g) => Math.abs(g.x - o.x) < 140 && Math.abs(g.y - o.y) < 140));
  obstacles.push(...guaranteed);
  obstacles.push({ kind: "gold", x: 550, y: 200 }, { kind: "gold", x: 950, y: 200 }, { kind: "berries", x: 250, y: 1e3 }, { kind: "berries", x: 1250, y: 1e3 });
  const map = { obstacles, blocked: [], tiles: createTiles(layout, seed), resources: [], navigationRevision: 0, generationAttempt: 0 };
  obstacles.forEach((o, index) => {
    o.id = `obstacle-${index}`;
    map.tiles[tileAt(o.x, o.y)].obstacleRefs.push(o.id);
    if (o.kind !== "house") {
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
  for (const o of map.obstacles) {
    const [x0, y0, x1, y1] = bounds(o);
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

// apps/web/scene.ts
var brickStyle = { studPitch: 0.5, plateHeight: 0.16, brickHeight: 0.32, bevel: 0.025, roughness: 0.72, provenance: "original_procedural" };
async function createScene(canvas2, onFailure, options = {}) {
  const T = await import(new URL("../../../vendor/three-0.186.0/three.module.js", import.meta.url).href);
  if (!canvas2.getContext("webgl2")) throw Error("\u6B64\u88DD\u7F6E\u7121\u6CD5\u5EFA\u7ACB WebGL2\uFF0C\u8ACB\u4F7F\u7528\u652F\u63F4 WebGL2 \u7684\u700F\u89BD\u5668\u3002");
  let contextLost = false, previewLayout = "meadow";
  const renderer = new T.WebGLRenderer({ canvas: canvas2, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.setClearColor("#d7e0cc");
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.35;
  const detail = createDetailController(T);
  const scene2 = new T.Scene();
  const camera = new T.OrthographicCamera(-12, 12, 10, -10, 0.1, 100);
  const ambient = new T.HemisphereLight("#fff5dc", "#819b75", 2.4);
  scene2.add(ambient);
  const sun = new T.DirectionalLight("#fff1d8", 3);
  sun.position.set(-4, 20, 12);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 1, far: 60 });
  sun.shadow.normalBias = 0.03;
  scene2.add(sun);
  sun.target.position.set(8, 0, 8);
  scene2.add(sun.target);
  const groundGeometries = /* @__PURE__ */ new Set();
  const geometry = /* @__PURE__ */ new Map(), materials = /* @__PURE__ */ new Map();
  function material(color) {
    if (!materials.has(color)) materials.set(color, new T.MeshStandardMaterial({ color, roughness: brickStyle.roughness }));
    return materials.get(color);
  }
  function box(w, h, d) {
    const key = `${w}:${h}:${d}`;
    if (geometry.has(key)) return geometry.get(key);
    const b = Math.min(brickStyle.bevel, w / 8, h / 8, d / 8);
    const shape = new T.Shape();
    shape.moveTo(-w / 2 + b, -d / 2 + b);
    shape.lineTo(w / 2 - b, -d / 2 + b);
    shape.lineTo(w / 2 - b, d / 2 - b);
    shape.lineTo(-w / 2 + b, d / 2 - b);
    shape.closePath();
    const geo = new T.ExtrudeGeometry(shape, { depth: Math.max(1e-3, h - 2 * b), bevelEnabled: true, bevelSize: b, bevelThickness: b, bevelSegments: 1, steps: 1, curveSegments: 1 });
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, b, 0);
    geometry.set(key, geo);
    detail.register(geo, w, h, d);
    return geo;
  }
  const studGeo = new T.CylinderGeometry(studStyle.radius, studStyle.radius, studStyle.height, 10);
  geometry.set("stud", studGeo);
  let staticGroup = new T.Group();
  scene2.add(staticGroup);
  const batches = /* @__PURE__ */ new Map();
  let muted = false, baseHeight = 0, worldTiles = createTiles();
  function staticPart(geo, color, x, y, z) {
    if (muted) color = "#737b72";
    const key = geo.uuid + color;
    if (!batches.has(key)) batches.set(key, { geo, color, matrices: [] });
    batches.get(key).matrices.push(new T.Matrix4().makeTranslation(x, y + baseHeight, z));
  }
  function arch(w, h, d) {
    const key = `arch:${w}:${h}:${d}`;
    if (!geometry.has(key)) geometry.set(key, createArchGeometry(T, w, h, d));
    return geometry.get(key);
  }
  function brick(x, z, y, w, d, h, color, studs = true, shape) {
    staticPart(shape === "arch" ? arch(w - 0.018, h, d - 0.018) : box(w - 0.018, h, d - 0.018), color, x + w / 2, y, z + d / 2);
    if (studs) for (let a = 0.25; a < w; a += 0.5) for (let b = 0.25; b < d; b += 0.5) staticPart(studGeo, color, x + a, y + h + 0.04, z + b);
  }
  function groundBlock(x, z, height2, color) {
    const h = height2 + 0.24, key = `ground:${h}`;
    if (!geometry.has(key)) {
      const geo = new T.BoxGeometry(1, h, 1);
      geo.translate(0, h / 2, 0);
      geometry.set(key, geo);
      groundGeometries.add(geo);
    }
    staticPart(geometry.get(key), color, x + 0.5, -0.24, z + 0.5);
  }
  let previewBuildingKind = "house";
  let previewBuilding = { ageVariant: 2, progress: 100, health: 100 };
  function house(x, z, red = false) {
    const parts = previewBuildingKind === "house" ? buildingParts({ ...previewBuilding, red }) : militaryBuildings.includes(previewBuildingKind) ? militaryBuildingParts(previewBuildingKind, { ...previewBuilding, red }) : economicBuildingParts(previewBuildingKind, { ...previewBuilding, red });
    for (const p of parts) brick(x + p.x, z + p.z, p.y, p.w, p.d, p.h, p.color, false, p.shape);
    for (const stud of buildingStuds(parts)) staticPart(studGeo, stud.color, x + stud.x, stud.y, z + stud.z);
  }
  function buildWorld(view) {
    const seed = view.seed;
    scene2.remove(staticGroup);
    staticGroup.traverse((o) => {
      if (o.isInstancedMesh) o.dispose();
    });
    staticGroup = new T.Group();
    scene2.add(staticGroup);
    batches.clear();
    baseHeight = 0;
    const map = options.assetPreview ? makeMap(seed, previewLayout) : { tiles: view.terrain.map((tile, id) => ({ ...tile, id, resourceRefs: [], obstacleRefs: [] })), obstacles: view.known.map((k) => k.obstacle), resources: view.resources };
    worldTiles = map.tiles;
    let rng = seed || 1;
    for (const tile of map.tiles) {
      const x = tile.id % 16, z = Math.floor(tile.id / 16);
      rng ^= rng << 13;
      rng ^= rng >>> 17;
      rng ^= rng << 5;
      const n = (rng >>> 0) / 4294967296;
      groundBlock(x, z, tile.height / 100, !options.assetPreview && view.fog[tile.id] !== 2 ? view.fog[tile.id] === 1 ? "#626e64" : "#293e38" : tile.terrainType === "cliff" ? "#8a8065" : tile.terrainType === "stone" ? "#a1a28e" : tile.terrainType === "highland" ? "#879d69" : tile.terrainType === "water" ? "#4b8291" : tile.terrainType === "shallow" ? "#86b7b8" : tile.terrainType === "sand" ? "#d5c598" : tile.terrainType === "road" ? "#c4b18a" : n < 0.2 ? "#a6b582" : n < 0.5 ? "#b5c493" : "#becda0");
    }
    for (const o of map.obstacles) {
      baseHeight = groundHeight(map.tiles, o.x, o.y) / 100;
      muted = !options.assetPreview && view.fog[tileAt(o.x, o.y)] !== 2;
      const x = o.x / 100, z = o.y / 100;
      if (o.kind === "house") house(x, z, o.red);
      else if (o.kind === "tree") {
        brick(x + 0.15, z + 0.15, 0, 0.3, 0.3, 0.8, "#80664b", false);
        brick(x - 0.2, z - 0.2, 0.7, 1, 1, 0.4, "#67835a");
        brick(x - 0.075, z - 0.075, 1.1, 0.75, 0.75, 0.4, "#7e985f");
        brick(x + 0.05, z + 0.05, 1.5, 0.5, 0.5, 0.3, "#91a970");
      } else if (o.kind === "hunt" || o.kind === "livestock") {
        const color = o.kind === "hunt" ? "#99714e" : "#e7e2cc";
        for (const dx of [0.1, 0.45]) for (const dz of [0.1, 0.5]) brick(x + dx, z + dz, 0, 0.09, 0.09, 0.28, "#615643", false);
        brick(x + 0.04, z + 0.06, 0.25, 0.54, 0.55, 0.35, color, false);
        brick(x + 0.16, z + 0.48, 0.47, 0.28, 0.2, 0.26, color, false);
        if (o.kind === "hunt") for (const dx of [0.18, 0.36]) brick(x + dx, z + 0.51, 0.73, 0.04, 0.04, 0.2, "#715a40", false);
      } else if (o.kind === "berries") {
        brick(x + 0.05, z + 0.05, 0, 0.55, 0.55, 0.45, "#5d824e");
        for (const dx of [0.12, 0.36]) for (const dz of [0.12, 0.36]) brick(x + dx, z + dz, 0.45, 0.12, 0.12, 0.12, "#a84e59", false);
      } else {
        brick(x, z, 0, 0.65, 0.7, 0.3, o.kind === "gold" ? "#b59a48" : "#a19f86");
        brick(x + 0.15, z + 0.15, 0.3, 0.35, 0.4, 0.18, o.kind === "gold" ? "#dec36f" : "#b8b39c", false);
      }
    }
    for (const resource of map.resources ?? []) if (resource.kind === "fish" && resource.status === "available") {
      const x = resource.x / 100, z = resource.y / 100;
      baseHeight = groundHeight(map.tiles, resource.x, resource.y) / 100;
      muted = false;
      for (const offset of [0, 0.22]) {
        brick(x - 0.2 + offset, z - 0.1 + offset, 0.025, 0.25, 0.1, 0.05, "#d5e7de", false);
        brick(x - 0.27 + offset, z - 0.1 + offset, 0.025, 0.09, 0.15, 0.06, "#bad0ce", false);
      }
    }
    baseHeight = 0;
    muted = false;
    for (const { geo, color, matrices } of batches.values()) {
      const mesh = new T.InstancedMesh(geo, material(color), matrices.length);
      matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
      mesh.instanceMatrix.needsUpdate = true;
      mesh.userData.studs = geo === studGeo;
      mesh.userData.ground = groundGeometries.has(geo);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      staticGroup.add(mesh);
    }
  }
  const units = /* @__PURE__ */ new Map();
  const ringGeo = new T.RingGeometry(0.4, 0.47, 32);
  ringGeo.rotateX(-Math.PI / 2);
  geometry.set("ring", ringGeo);
  const ringMaterial = new T.MeshBasicMaterial({ color: "#fff2a1", side: T.DoubleSide });
  function unit(id, player) {
    const group = new T.Group();
    scene2.add(group);
    const rig = createCharacterRig(T, player, box, material);
    rig.equip(previewTool);
    group.add(rig.root);
    detail.apply(group, zoom);
    const ring = new T.Mesh(ringGeo, ringMaterial);
    ring.position.y = 0.025;
    group.add(ring);
    units.set(id, { group, rig, ring, player, moving: false });
    return units.get(id);
  }
  let previewRole = "villager";
  let previewPose = "idle", previewTool = "none", previewAnimated = false, poseStart = 0;
  const focus = { x: 8, y: 0, z: 8 };
  let worldKey = "", angle = Math.PI / 4, zoom = 1, width = 0, height = 0, selected2 = 1, latest = null;
  function cameraUpdate() {
    if (width <= 0 || height <= 0) return;
    const aspect = width / Math.max(1, height);
    const halfH = Math.max(10.5, 12 / aspect) / zoom;
    camera.left = -halfH * aspect;
    camera.right = halfH * aspect;
    camera.top = halfH;
    camera.bottom = -halfH;
    camera.position.set(focus.x + Math.sin(angle) * 24, focus.y + 24, focus.z + Math.cos(angle) * 24);
    camera.lookAt(focus.x, focus.y, focus.z);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    detail.apply(scene2, zoom);
  }
  function resize() {
    const r = canvas2.getBoundingClientRect();
    if (r.width !== width || r.height !== height) {
      width = r.width;
      height = r.height;
      renderer.setSize(width, height, false);
      cameraUpdate();
    }
  }
  function update(view, id) {
    latest = view;
    selected2 = id;
    const key = JSON.stringify([previewBuildingKind, previewBuilding, previewLayout, view.layout, view.seed, view.fog, view.known?.map((k) => k.obstacle), view.resources]);
    if (worldKey !== key) {
      worldKey = key;
      buildWorld(view);
      cameraUpdate();
    }
    const alive = new Set(view.units.map((u) => u.id));
    for (const [key2, u] of units) if (!alive.has(key2)) {
      scene2.remove(u.group);
      units.delete(key2);
    }
    for (const data of view.units) {
      const u = units.get(data.id) ?? unit(data.id, data.player);
      const dx = data.x / 100 - u.group.position.x, dz = data.y / 100 - u.group.position.z;
      if (Math.abs(dx) + Math.abs(dz) > 1e-3) u.group.rotation.y = Math.atan2(dx, dz);
      u.group.position.set(data.x / 100, groundHeight(worldTiles, data.x, data.y) / 100, data.y / 100);
      u.ring.visible = data.id === selected2;
      u.moving = data.navigation === "moving";
    }
  }
  const raycaster = new T.Raycaster(), ground = new T.Plane(new T.Vector3(0, 1, 0), 0);
  function pick(clientX, clientY) {
    const r = canvas2.getBoundingClientRect();
    raycaster.setFromCamera(new T.Vector2((clientX - r.left) / r.width * 2 - 1, -(clientY - r.top) / r.height * 2 + 1), camera);
    const hits = detail.withSelectionGeometry(scene2, () => visibleMeshHits(raycaster, [...units.values()].map((u) => u.group)));
    if (hits.length) {
      let obj = hits[0].object;
      while (obj.parent && obj.parent !== scene2) obj = obj.parent;
      for (const [id, u] of units) if (u.group === obj) return { unitId: id };
    }
    const groundHit = raycaster.intersectObjects(staticGroup.children.filter((mesh) => mesh.userData.ground), false)[0];
    if (groundHit) return { x: groundHit.point.x, y: groundHit.point.z };
    return {};
  }
  function draw(time) {
    if (contextLost) return;
    resize();
    for (const u of units.values()) {
      const pose = options.assetPreview ? previewPose : u.moving ? "walk" : "idle";
      u.rig.pose(pose, options.assetPreview ? previewAnimated ? time - poseStart : pose === "death" ? 700 : pose === "hit" ? 150 : 350 : time);
      u.ring.visible = u.group === units.get(selected2)?.group && pose !== "death";
    }
    renderer.render(scene2, camera);
  }
  canvas2.addEventListener("webglcontextlost", (event) => {
    event.preventDefault();
    contextLost = true;
    canvas2.dataset.renderState = "context-lost";
    onFailure(options.assetPreview ? "\u6A21\u578B\u7E6A\u5716\u9023\u7DDA\u4E2D\u65B7\uFF0C\u8ACB\u91CD\u65B0\u8F09\u5165\u6A21\u578B\u9801\u3002" : "3D \u7E6A\u5716\u9023\u7DDA\u4E2D\u65B7\uFF0C\u6A21\u64EC\u5DF2\u66AB\u505C\uFF1B\u8ACB\u91CD\u65B0\u8F09\u5165\u9801\u9762\u5F8C\u8B80\u53D6\u624B\u52D5\u5B58\u6A94\u3002");
  });
  canvas2.dataset.renderer = "webgl2";
  canvas2.dataset.renderState = "ready";
  return { update, draw, pick, setPreviewBuildingKind: (kind) => {
    if (!options.assetPreview || kind !== "house" && !economicBuildings.includes(kind) && !militaryBuildings.includes(kind)) throw Error("\u672A\u77E5\u6A21\u578B\u5EFA\u7BC9");
    previewBuildingKind = kind;
    if (latest) update(latest, selected2);
  }, setPreviewRole: (role) => {
    if (!options.assetPreview || !unitRoles.includes(role) && role !== "cavalry") throw Error("\u50C5\u6A21\u578B\u6AA2\u8996\u53EF\u6307\u5B9A\u6709\u6548\u8ECD\u7A2E");
    previewRole = role;
    previewPose = "idle";
    for (const u of units.values()) {
      u.rig.dress(role);
      u.ring.scale.set(role === "cavalry" ? 1.8 : 1, 1, role === "cavalry" ? 1.8 : 1);
      detail.apply(u.group, zoom);
    }
  }, setPreviewBuilding: (visual) => {
    if (!options.assetPreview) throw Error("\u50C5\u6A21\u578B\u6AA2\u8996\u53EF\u6307\u5B9A\u5EFA\u7BC9\u5916\u89C0");
    buildingParts({ ...visual, red: false });
    previewBuilding = { ...visual };
    if (latest) update(latest, selected2);
  }, focusPreviewHouse: () => {
    if (!options.assetPreview) throw Error("\u50C5\u6A21\u578B\u6AA2\u8996\u53EF\u805A\u7126\u5EFA\u7BC9");
    focus.x = 4;
    focus.y = 1;
    focus.z = 5;
    zoom = 2.5;
    cameraUpdate();
  }, focusPreviewUnit: (id) => {
    if (!options.assetPreview) throw Error("\u50C5\u6A21\u578B\u6AA2\u8996\u53EF\u805A\u7126\u4EE3\u8868\u8CC7\u7522");
    const u = units.get(id);
    if (!u) throw Error("\u627E\u4E0D\u5230\u4EBA\u5076");
    focus.x = u.group.position.x;
    focus.y = u.group.position.y + 0.5;
    focus.z = u.group.position.z;
    zoom = 2.5;
    cameraUpdate();
  }, setPreviewMotion: (pose, tool, animated) => {
    if (!options.assetPreview) throw Error("\u50C5\u6A21\u578B\u6AA2\u8996\u53EF\u6307\u5B9A\u59FF\u614B");
    if (previewRole === "cavalry" && !["idle", "walk", "attack"].includes(pose) || !unitPoses.includes(pose) || !unitTools.includes(tool)) throw Error("\u672A\u77E5\u6A21\u578B\u59FF\u614B\u6216\u5DE5\u5177");
    previewPose = pose;
    previewTool = tool;
    previewAnimated = animated;
    poseStart = performance.now();
    for (const u of units.values()) {
      u.rig.equip(tool);
      detail.apply(u.group, zoom);
    }
  }, setPreviewLayout: (layout) => {
    if (!options.assetPreview) throw Error("\u50C5\u6A21\u578B\u6AA2\u8996\u53EF\u5207\u63DB\u9A57\u6536\u5716");
    if (!["meadow", "coast", "acceptance"].includes(layout)) throw Error("\u672A\u77E5\u5730\u5716\u6A21\u5F0F");
    previewLayout = layout;
    if (latest) update(latest, selected2);
  }, zoom: (delta) => {
    zoom = Math.max(0.7, Math.min(2.5, zoom + delta));
    cameraUpdate();
  }, rotate: () => {
    angle += Math.PI / 2;
    cameraUpdate();
  }, resetCamera: () => {
    focus.x = 8;
    focus.y = 0;
    focus.z = 8;
    zoom = 1;
    angle = Math.PI / 4;
    cameraUpdate();
  }, dispose: () => {
    renderer.dispose();
    detail.dispose();
    for (const geo of geometry.values()) geo.dispose();
    for (const m of materials.values()) m.dispose();
    ringMaterial.dispose();
  }, stats: () => ({ detail: detailLevel(zoom), drawCalls: renderer.info.render.calls, triangles: renderer.info.render.triangles, geometries: renderer.info.memory.geometries }) };
}

// packages/sim/vision.ts
var visionRules = { provenance: "design_default", unitRadius: 400, houseRadius: 300, shareVision: false, rememberStaticObjects: true };

// packages/sim/economy.ts
var economyRules = { provenance: "design_default", initialStock: { food: 200, wood: 200, gold: 100, stone: 100 }, populationCap: rules.settings.populationCap, cancellationRefundPercent: 100 };

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
var rulesetHash = hash({ rules, navigationRules, economyRules, terrainRules, terrainDefinitions, resourceDefinitions, visionRules, startingResourceRules, simulationVersion: 9 });

// packages/sim/protocol.ts
function decodeView(r) {
  const values = new Int32Array(r.positions), units = [];
  for (let i = 0; i < values.length; i += 7) units.push({ id: values[i], player: values[i + 1], x: values[i + 2], y: values[i + 3], navigation: ["idle", "searching", "moving", "unreachable"][values[i + 6]], target: values[i + 4] < 0 ? null : { x: values[i + 4], y: values[i + 5] } });
  return { seed: r.seed, layout: r.layout, terrain: r.terrain, tick: r.tick, stateHash: r.stateHash, fog: r.fog, known: r.known, resources: r.resources, units };
}

// apps/web/worker-client.ts
var SimulationClient = class {
  constructor(seed, update, failure) {
    this.update = update;
    this.failure = failure;
    this.checkpoint = { seed, commands: [], ticks: 0 };
  }
  worker = null;
  counter = 0;
  pending = /* @__PURE__ */ new Map();
  checkpoint;
  ready = false;
  async connect() {
    this.worker?.terminate();
    this.ready = false;
    try {
      this.worker = new Worker(new URL("./worker.js", import.meta.url), { type: "module" });
    } catch (e) {
      this.fail(e.message);
      throw e;
    }
    this.worker.onmessage = (event) => {
      const response = event.data;
      if (response?.protocol !== 1 || !this.pending.has(response.id)) {
        this.fail("Worker \u56DE\u61C9\u5354\u5B9A\u4E0D\u7B26");
        return;
      }
      const item = this.pending.get(response.id);
      clearTimeout(item.timer);
      this.pending.delete(response.id);
      if (!response.ok) {
        item.reject(Error(`tick ${response.tick} / request ${response.id}${response.entityId !== void 0 ? " / entity " + response.entityId : ""}\uFF1A${response.message}`));
        return;
      }
      if (response.commands) this.checkpoint.commands = response.commands;
      if (response.accepted) this.checkpoint.commands.push(response.accepted);
      this.checkpoint.layout = response.layout;
      this.checkpoint.seed = response.seed;
      this.checkpoint.ticks = response.tick;
      this.update(decodeView(response));
      item.resolve(response);
    };
    this.worker.onerror = (event) => {
      event.preventDefault();
      this.fail("Worker \u8F09\u5165\u6216\u57F7\u884C\u5931\u6557");
    };
    this.worker.onmessageerror = () => this.fail("Worker \u8CC7\u6599\u89E3\u78BC\u5931\u6557");
    try {
      await this.send({ kind: "recover", checkpoint: structuredClone(this.checkpoint) });
      this.ready = true;
    } catch (e) {
      this.fail(e.message);
      throw e;
    }
  }
  fail(reason) {
    this.ready = false;
    this.worker?.terminate();
    this.worker = null;
    for (const item of this.pending.values()) {
      clearTimeout(item.timer);
      item.reject(Error(reason));
    }
    this.pending.clear();
    this.failure(`${reason}\uFF1B\u5DF2\u66AB\u505C\uFF0C\u53EF\u91CD\u8A66\u6062\u5FA9\u81F3\u6700\u5F8C\u78BA\u8A8D\u7684 tick ${this.checkpoint.ticks}\u3002\u672A\u78BA\u8A8D\u6307\u4EE4\u4E0D\u6703\u81EA\u52D5\u91CD\u9001\u3002`);
  }
  send(operation) {
    return new Promise((resolve, reject) => {
      if (!this.worker) {
        reject(Error("Worker \u5C1A\u672A\u9023\u7DDA"));
        return;
      }
      const id = ++this.counter;
      const timer = setTimeout(() => this.fail("Worker \u8D85\u904E 5 \u79D2\u672A\u56DE\u61C9"), 5e3);
      this.pending.set(id, { resolve, reject, timer });
      try {
        this.worker.postMessage({ protocol: 1, id, operation });
      } catch (e) {
        this.fail(e.message);
      }
    });
  }
  request(operation) {
    if (!this.ready) return Promise.reject(Error("\u8ACB\u5148\u6062\u5FA9\u6A21\u64EC\u9023\u7DDA"));
    return this.send(operation);
  }
};

// apps/web/main.ts
var el = (id) => document.getElementById(id);
var state = { seed: rules.settings.seed, layout: "meadow", terrain: [], tick: 0, units: [], fog: [], known: [], resources: [], stateHash: "\u2014" };
var scene = null;
var graphicsFailed = false;
var selected = 1;
var running = false;
var last = 0;
var accumulator = 0;
var advancing = false;
var connected = false;
var notice = (s) => {
  el("notice").textContent = s;
};
var canvas = el("map");
var fogDebugger = mountFogDebugger(el("fog-debug"), () => state);
function render() {
  fogDebugger.update();
  if (!graphicsFailed) {
    try {
      scene?.update(state, selected);
    } catch (error) {
      graphicsError(`3D \u5834\u666F\u66F4\u65B0\u5931\u6557\uFF1A${error.message}`);
    }
  }
  el("fog-status").textContent = `\u53EF\u898B ${state.fog.filter((v) => v === 2).length} \u683C \xB7 \u5DF2\u63A2\u7D22\u820A\u8996\u91CE ${state.fog.filter((v) => v === 1).length} \u683C \xB7 \u672A\u63A2\u7D22 ${state.fog.filter((v) => v === 0).length} \u683C`;
  el("world-label").textContent = { meadow: "\u8349\u7538\u8A66\u9A57\u5834", coast: "\u6D77\u5CB8\u8A66\u9A57\u5834", acceptance: "\u9AD8\u5730\u8207\u6DFA\u7058\u9A57\u6536\u5834" }[state.layout];
  el("tick").textContent = String(state.tick);
  el("hash").textContent = state.stateHash;
  const u = state.units.find((u2) => u2.id === selected);
  if (!u) return;
  el("position").textContent = `\u6751\u6C11 ${selected} \xB7 (${(u.x / 100).toFixed(1)}, ${(u.y / 100).toFixed(1)}) \xB7 ${u.navigation === "searching" ? "\u5C0B\u8DEF\u4E2D" : u.navigation === "unreachable" ? "\u7121\u53EF\u9054\u8DEF\u5F91" : u.target ? "\u79FB\u52D5\u4E2D" : "\u5F85\u547D"}`;
}
function setRunning(v) {
  running = v;
  accumulator = 0;
  last = 0;
  el("pause").textContent = v ? "\u66AB\u505C\u6A21\u64EC" : "\u958B\u59CB\u6A21\u64EC";
  el("pause").setAttribute("aria-pressed", String(v));
  el("run-state").textContent = v ? "\u6A21\u64EC\u904B\u884C\u4E2D \xB7 20 Hz" : "\u5DF2\u66AB\u505C \xB7 \u7B49\u5F85\u6307\u4EE4";
  el("step").disabled = !connected || graphicsFailed || v;
}
function choose(id) {
  selected = id;
  document.querySelectorAll("[data-unit]").forEach((b) => b.setAttribute("aria-pressed", String(Number(b.dataset.unit) === id)));
  el("selected").textContent = `#0${id}`;
  render();
}
var client = new SimulationClient(rules.settings.seed, (v) => {
  state = v;
  render();
}, (reason) => {
  connected = false;
  setRunning(false);
  toggleControls();
  notice(reason);
  el("worker-retry").hidden = false;
});
function toggleControls() {
  for (const id of ["zoom-in", "zoom-out", "rotate-view", "reset-view"]) el(id).disabled = !scene || graphicsFailed;
  for (const id of ["move", "pause", "step", "restart", "save", "load", "replay"]) el(id).disabled = !connected || graphicsFailed && id !== "save" || id === "step" && running;
}
async function connect() {
  el("worker-retry").disabled = true;
  try {
    await client.connect();
    connected = true;
    el("worker-retry").hidden = true;
    notice(`\u6A21\u64EC\u5DF2\u9023\u7DDA \xB7 tick ${state.tick}\u3002\u9078\u53D6\u6751\u6C11\uFF0C\u518D\u9EDE\u5730\u9762\u4E0B\u9054\u6307\u4EE4\u3002`);
  } catch {
  } finally {
    toggleControls();
    el("worker-retry").disabled = false;
  }
}
el("worker-retry").onclick = () => void connect();
async function move(x, y) {
  const unitId = selected;
  try {
    await client.request({ kind: "move", unitId, x: Math.round(x * 100), y: Math.round(y * 100) });
    notice(`\u6751\u6C11 ${unitId} \u7684\u79FB\u52D5\u6307\u4EE4\u5DF2\u6392\u5165 tick ${state.tick + 1}\u3002${running ? "" : "\u6309\u300C\u958B\u59CB\u6A21\u64EC\u300D\u6216\u300C\u524D\u9032 1 tick\u300D\u57F7\u884C\u3002"}`);
  } catch (e) {
    notice(e.message);
  }
}
canvas.addEventListener("click", (e) => {
  if (!scene || graphicsFailed) return;
  const hit = scene.pick(e.clientX, e.clientY);
  if (hit.unitId !== void 0) {
    const unit = state.units.find((u) => u.id === hit.unitId);
    if (unit?.player === 0) choose(unit.id);
    else notice("\u7D05\u65B9\u55AE\u4F4D\u4E0D\u53EF\u7531\u85CD\u65B9\u63A7\u5236\u3002");
    return;
  }
  if (hit.x === void 0 || hit.y === void 0 || hit.x < 0.5 || hit.x > 15.5 || hit.y < 0.5 || hit.y > 15.5) {
    notice("\u8ACB\u9EDE\u9078\u5730\u5716\u5167\u5074\u7684\u5730\u9762\u3002");
    return;
  }
  void move(hit.x, hit.y);
});
canvas.addEventListener("wheel", (e) => {
  e.preventDefault();
  if (!graphicsFailed) scene?.zoom(e.deltaY < 0 ? 0.1 : -0.1);
}, { passive: false });
el("zoom-in").onclick = () => scene?.zoom(0.2);
el("zoom-out").onclick = () => scene?.zoom(-0.2);
el("rotate-view").onclick = () => scene?.rotate();
el("reset-view").onclick = () => scene?.resetCamera();
document.querySelectorAll("[data-unit]").forEach((b) => b.onclick = () => choose(Number(b.dataset.unit)));
el("move").onclick = () => {
  const x = el("target-x"), y = el("target-y");
  if (x.reportValidity() && y.reportValidity() && x.value !== "" && y.value !== "") move(Number(x.value), Number(y.value));
  else notice("\u8ACB\u8F38\u5165 0.5 \u5230 15.5 \u4E4B\u9593\u7684\u5EA7\u6A19\u3002");
};
el("pause").onclick = () => setRunning(!running);
el("step").onclick = async () => {
  try {
    await client.request({ kind: "advance", count: 1 });
  } catch (e) {
    setRunning(false);
    notice(e.message);
  }
};
el("restart").onclick = async () => {
  setRunning(false);
  try {
    const input = el("seed");
    if (input.value === "") throw Error("\u8ACB\u8F38\u5165\u7A2E\u5B50");
    await client.request({ kind: "reset", seed: Number(input.value), layout: el("layout").value });
    choose(1);
    notice("\u5DF2\u5EFA\u7ACB\u65B0\u6C99\u76D2\u3002\u5148\u524D\u7684\u624B\u52D5\u5B58\u6A94\u4ECD\u7136\u4FDD\u7559\u3002");
  } catch (e) {
    notice(e.message);
  }
};
el("save").onclick = async () => {
  try {
    const result = await client.request({ kind: "snapshot" });
    localStorage.setItem("brick-rts:sandbox:1", result.snapshot);
    notice(`\u5DF2\u5132\u5B58 tick ${result.tick} \u7684\u6C99\u76D2\u3002`);
  } catch (e) {
    notice(`\u5132\u5B58\u5931\u6557\uFF1A${e.message}\u3002\u5148\u524D\u5B58\u6A94\u4FDD\u7559\u3002`);
  }
};
el("load").onclick = async () => {
  setRunning(false);
  try {
    const raw = localStorage.getItem("brick-rts:sandbox:1");
    if (!raw) throw Error("\u5C1A\u7121\u624B\u52D5\u5B58\u6A94\u3002");
    await client.request({ kind: "restore", snapshot: raw });
    el("seed").value = String(state.seed);
    el("layout").value = state.layout;
    choose(1);
    notice(`\u5DF2\u6062\u5FA9 tick ${state.tick}\uFF1B\u6309\u958B\u59CB\u6A21\u64EC\u7E7C\u7E8C\u3002`);
  } catch (e) {
    notice(`\u8B80\u53D6\u5931\u6557\uFF1A${e.message}\u3002\u76EE\u524D\u6C99\u76D2\u4FDD\u7559\u3002`);
  }
};
el("replay").onclick = async () => {
  setRunning(false);
  try {
    const result = await client.request({ kind: "replay" });
    notice(result.replayMatches ? `\u91CD\u64AD\u4E00\u81F4\uFF1A${result.tick} ticks\uFF0C\u6307\u7D0B ${result.stateHash}\u3002` : "\u91CD\u64AD\u4E0D\u4E00\u81F4\uFF0C\u8ACB\u4FDD\u7559\u76EE\u524D\u72C0\u614B\u56DE\u5831\u3002");
  } catch (e) {
    notice(`\u91CD\u64AD\u5931\u6557\uFF1A${e.message}`);
  }
};
var editor = el("rules-json");
var reset = () => {
  editor.value = JSON.stringify(rules, null, 2);
  el("validation").textContent = "\u5C1A\u672A\u9A57\u8B49\u7DE8\u8F2F\u5167\u5BB9\u3002";
};
reset();
el("reset-rules").onclick = reset;
el("validate").onclick = () => {
  try {
    const errors = validateRules(JSON.parse(editor.value), el("exact").checked);
    el("validation").textContent = errors.length ? "\u9A57\u8B49\u672A\u901A\u904E\uFF1A\n" + errors.join("\n") : "\u9A57\u8B49\u901A\u904E\uFF1A\u81EA\u8A02\u898F\u5247\u7D50\u69CB\u6709\u6548\u3002\u539F\u4F5C\u7248\u672C\u8207\u8986\u84CB\u7387\u4ECD\u672A\u78BA\u8A8D\u3002";
  } catch {
    el("validation").textContent = "\u9A57\u8B49\u672A\u901A\u904E\uFF1AJSON \u683C\u5F0F\u932F\u8AA4\u3002";
  }
};
el("export").onclick = () => {
  try {
    const data = JSON.parse(editor.value), errors = validateRules(data, el("exact").checked);
    if (errors.length) {
      el("validation").textContent = "\u532F\u51FA\u5931\u6557\uFF1A\n" + errors.join("\n");
      return;
    }
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "brick-rts-rules.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1e3);
    el("validation").textContent = "\u5DF2\u532F\u51FA\u7D93\u7D50\u69CB\u9A57\u8B49\u7684\u81EA\u8A02\u898F\u5247\u3002";
  } catch {
    el("validation").textContent = "\u7121\u6CD5\u532F\u51FA\uFF1AJSON \u683C\u5F0F\u932F\u8AA4\u3002";
  }
};
document.addEventListener("visibilitychange", () => {
  if (document.hidden && running) {
    setRunning(false);
    notice("\u5206\u9801\u9032\u5165\u80CC\u666F\uFF0C\u6C99\u76D2\u5DF2\u81EA\u52D5\u66AB\u505C\u3002");
  }
});
window.addEventListener("blur", () => {
  if (running) {
    setRunning(false);
    notice("\u8996\u7A97\u5931\u7126\uFF0C\u6C99\u76D2\u5DF2\u81EA\u52D5\u66AB\u505C\u3002");
  }
});
new ResizeObserver(() => render()).observe(canvas.parentElement);
function frame(time) {
  if (running) {
    if (last) accumulator += time - last;
    last = time;
    if (accumulator > 1e3) {
      setRunning(false);
      notice("\u6A21\u64EC\u843D\u5F8C\u8D85\u904E 1 \u79D2\uFF0C\u5DF2\u66AB\u505C\uFF1B\u672A\u8DF3\u904E\u4EFB\u4F55 tick\u3002");
    } else if (!advancing && accumulator >= 50) {
      const count = Math.floor(accumulator / 50);
      accumulator -= count * 50;
      advancing = true;
      void client.request({ kind: "advance", count }).catch((e) => {
        setRunning(false);
        notice(e.message);
      }).finally(() => {
        advancing = false;
      });
    }
  }
  if (!graphicsFailed) {
    try {
      scene?.draw(time);
    } catch (error) {
      graphicsError(`3D \u7E6A\u5716\u5931\u6557\uFF1A${error.message}`);
    }
  }
  if (!graphicsFailed) requestAnimationFrame(frame);
}
function graphicsError(message) {
  graphicsFailed = true;
  setRunning(false);
  toggleControls();
  const box = el("boot-error");
  box.hidden = false;
  box.textContent = message;
  notice("3D \u5834\u666F\u66AB\u4E0D\u53EF\u7528\u3002\u82E5\u6A21\u64EC\u5DF2\u9023\u7DDA\uFF0C\u53EF\u5148\u5132\u5B58\u76EE\u524D\u6C99\u76D2\u518D\u91CD\u65B0\u8F09\u5165\u3002");
}
toggleControls();
render();
void createScene(canvas, graphicsError).then((result) => {
  scene = result;
  toggleControls();
  scene.update(state, selected);
  void connect();
  requestAnimationFrame(frame);
}).catch((error) => graphicsError(`3D \u8F09\u5165\u5931\u6557\uFF1A${error.message}`));
