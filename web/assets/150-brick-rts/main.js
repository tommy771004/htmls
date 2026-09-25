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
var rulesetHash = hash(rules);
function createState(seed) {
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 4294967295) throw Error("seed \u5FC5\u9808\u70BA uint32");
  return { version: 1, seed, rng: seed || 1, tick: 0, sequence: [0, 0], units: [{ id: 1, player: 0, x: 350, y: 600, target: null }, { id: 2, player: 0, x: 450, y: 650, target: null }, { id: 3, player: 0, x: 400, y: 750, target: null }, { id: 4, player: 1, x: 1150, y: 600, target: null }], queue: [], log: [] };
}
function submit(state2, c) {
  if (!c || c.protocolVersion !== 1 || c.rulesetHash !== rulesetHash) throw Error("\u547D\u4EE4\u7248\u672C\u4E0D\u7B26");
  if (!Number.isSafeInteger(c.playerId) || c.playerId < 0 || c.playerId > 1) throw Error("\u7121\u6548\u73A9\u5BB6");
  if (!Number.isSafeInteger(c.sequence) || c.sequence !== state2.sequence[c.playerId] + 1) throw Error("\u91CD\u8907\u6216\u932F\u5E8F\u547D\u4EE4");
  if (!Number.isSafeInteger(c.targetTick) || c.targetTick <= state2.tick || c.targetTick > state2.tick + 200) throw Error("\u547D\u4EE4\u5DF2\u904E\u671F\u6216\u904E\u9060");
  if (c.commandType !== "move" || !c.payload) throw Error("\u4E0D\u652F\u63F4\u7684\u547D\u4EE4");
  const u = state2.units.find((u2) => u2.id === c.payload.unitId);
  if (!u || u.player !== c.playerId) throw Error("\u4E0D\u53EF\u63A7\u5236\u6575\u65B9\u55AE\u4F4D");
  for (const k of ["x", "y"]) if (!Number.isSafeInteger(c.payload[k]) || c.payload[k] < 50 || c.payload[k] > 1550) throw Error("\u76EE\u6A19\u8D85\u51FA\u5730\u5716");
  const copy = structuredClone(c);
  state2.queue.push(copy);
  state2.queue.sort((a, b) => a.targetTick - b.targetTick || a.playerId - b.playerId || a.sequence - b.sequence);
  state2.log.push(structuredClone(copy));
  state2.sequence[c.playerId] = c.sequence;
}
function tick(s) {
  s.tick++;
  s.queue.sort((a, b) => a.targetTick - b.targetTick || a.playerId - b.playerId || a.sequence - b.sequence);
  while (s.queue.length && s.queue[0].targetTick === s.tick) {
    const c = s.queue.shift();
    s.units.find((u) => u.id === c.payload.unitId).target = { x: c.payload.x, y: c.payload.y };
  }
  for (const u of s.units) if (u.target) {
    u.x += Math.sign(u.target.x - u.x) * Math.min(5, Math.abs(u.target.x - u.x));
    u.y += Math.sign(u.target.y - u.y) * Math.min(5, Math.abs(u.target.y - u.y));
    if (u.x === u.target.x && u.y === u.target.y) u.target = null;
  }
}
function replay(seed, commands, ticks) {
  if (!Number.isSafeInteger(ticks) || ticks < 0 || ticks > 1e5 || !Array.isArray(commands) || commands.length > 1e4) throw Error("\u7121\u6548\u91CD\u64AD\u7BC4\u570D");
  const s = createState(seed);
  const pending = structuredClone(commands).sort((a, b) => a.targetTick - b.targetTick || a.playerId - b.playerId || a.sequence - b.sequence);
  for (const c of [...pending].sort((a, b) => a.playerId - b.playerId || a.sequence - b.sequence)) {
    const original = s.tick;
    s.tick = Math.max(0, c.targetTick - 1);
    submit(s, c);
    s.tick = original;
  }
  for (let i = 0; i < ticks; i++) tick(s);
  s.log = structuredClone(commands);
  return s;
}
function serialize(s) {
  if (s.tick > 1e5 || s.log.length > 1e4) throw Error("\u5DF2\u8D85\u904E\u6B64\u968E\u6BB5\u6C99\u76D2\u5B58\u6A94\u5BB9\u91CF\uFF08100000 ticks / 10000 \u6307\u4EE4\uFF09");
  return JSON.stringify({ format: "brick-sandbox-1", rulesetHash, state: s, checksum: hash(s) });
}
function deserialize(raw) {
  const v = JSON.parse(raw);
  if (!v || v.format !== "brick-sandbox-1" || v.rulesetHash !== rulesetHash || !v.state || v.checksum !== hash(v.state)) throw Error("\u5B58\u6A94\u7248\u672C\u4E0D\u7B26\u6216\u5167\u5BB9\u640D\u58DE");
  const s = v.state;
  if (s.version !== 1 || !Number.isSafeInteger(s.tick) || s.tick < 0 || s.tick > 1e5 || !Array.isArray(s.log) || s.log.length > 1e4) throw Error("\u7121\u6548\u5B58\u6A94\u72C0\u614B");
  const rebuilt = replay(s.seed, s.log, s.tick);
  if (hash(rebuilt) !== hash(s)) throw Error("\u5B58\u6A94\u72C0\u614B\u7121\u6CD5\u7531\u547D\u4EE4\u91CD\u5EFA");
  return structuredClone(s);
}

// apps/web/main.ts
var el = (id) => document.getElementById(id);
var state = createState(rules.settings.seed);
var selected = 1;
var running = false;
var last = 0;
var accumulator = 0;
var notice = (s) => {
  el("notice").textContent = s;
};
var canvas = el("map");
var ctx = canvas.getContext("2d");
if (!ctx) throw Error("\u6B64\u700F\u89BD\u5668\u7121\u6CD5\u5EFA\u7ACB Canvas 2D \u756B\u9762");
var g = ctx;
var width = 0;
var height = 0;
var scale = 1;
var ox = 0;
var oy = 0;
function point(x, y, z = 0) {
  return [ox + (x - y) * scale, oy + (x + y) * scale * 0.5 - z * scale];
}
function polygon(points, fill, stroke) {
  g.beginPath();
  points.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y));
  g.closePath();
  g.fillStyle = fill;
  g.fill();
  if (stroke) {
    g.strokeStyle = stroke;
    g.lineWidth = 0.65;
    g.stroke();
  }
}
function brick(x, y, z, w, d, h, color, studs = true) {
  const p = (a, b, c) => point(a, b, c);
  polygon([p(x, y + d, z), p(x + w, y + d, z), p(x + w, y + d, z + h), p(x, y + d, z + h)], color);
  g.fillStyle = "#0003";
  g.beginPath();
  [p(x, y + d, z), p(x + w, y + d, z), p(x + w, y + d, z + h), p(x, y + d, z + h)].forEach(([a, b], i) => i ? g.lineTo(a, b) : g.moveTo(a, b));
  g.closePath();
  g.fill();
  polygon([p(x + w, y, z), p(x + w, y + d, z), p(x + w, y + d, z + h), p(x + w, y, z + h)], color);
  polygon([p(x, y, z + h), p(x + w, y, z + h), p(x + w, y + d, z + h), p(x, y + d, z + h)], color, "#34462a22");
  if (studs) for (let a = 0.25; a < w; a += 0.5) for (let b = 0.25; b < d; b += 0.5) {
    const [sx, sy] = p(x + a, y + b, z + h);
    g.fillStyle = "#0002";
    g.beginPath();
    g.ellipse(sx, sy, scale * 0.14, scale * 0.08, 0, 0, 7);
    g.fill();
    g.fillStyle = color;
    g.beginPath();
    g.ellipse(sx, sy - scale * 0.045, scale * 0.14, scale * 0.075, 0, 0, 7);
    g.fill();
    g.strokeStyle = "#fff5";
    g.lineWidth = 0.7;
    g.stroke();
  }
}
function house(x, y, red = false) {
  const roof = red ? "#bd624d" : "#466e86";
  brick(x - 0.15, y - 0.15, 0, 2.5, 2.3, 0.18, "#b2ad93");
  for (let level = 0; level < 4; level++) for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) brick(x + a, y + b, 0.18 + level * 0.34, 0.97, 0.97, 0.33, level % 2 ? "#d8c7a7" : "#e3d4b6", false);
  brick(x + 0.72, y + 2, 0.2, 0.55, 0.035, 0.95, "#514b3e", false);
  brick(x + 2, y + 0.35, 0.8, 0.03, 0.5, 0.45, "#354c46", false);
  brick(x - 0.03, y + 1.97, 1.42, 2.09, 0.08, 0.13, "#766650", false);
  for (let level = 0; level < 4; level++) brick(x - 0.2 + level * 0.23, y - 0.2, 1.6 + level * 0.2, 2.4 - level * 0.46, 2.4, 0.18, roof);
  brick(x + 1.5, y + 0.25, 2.05, 0.35, 0.4, 0.8, "#b9aa8b");
  const [fx, fy] = point(x + 0.3, y + 0.4, 3.5);
  g.strokeStyle = "#756b52";
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(fx, fy + scale * 0.9);
  g.lineTo(fx, fy);
  g.stroke();
  polygon([[fx, fy], [fx + scale * 0.7, fy + scale * 0.1], [fx, fy + scale * 0.38]], roof);
}
function tree(x, y) {
  brick(x + 0.15, y + 0.15, 0, 0.3, 0.3, 0.8, "#807057", false);
  brick(x - 0.2, y - 0.2, 0.7, 1, 1, 0.45, "#638360");
  brick(x - 0.08, y - 0.08, 1.15, 0.75, 0.75, 0.4, "#779367");
  brick(x + 0.06, y + 0.06, 1.55, 0.48, 0.48, 0.3, "#8da777");
}
function villager(u) {
  const x = u.x / 100, y = u.y / 100, blue = u.player === 0;
  if (u.id === selected) {
    const p2 = point(x + 0.17, y + 0.17);
    g.strokeStyle = "#fdf9cb";
    g.lineWidth = 2;
    g.beginPath();
    g.ellipse(p2[0], p2[1], scale * 0.62, scale * 0.3, 0, 0, Math.PI * 2);
    g.stroke();
  }
  brick(x - 0.1, y, 0, 0.18, 0.24, 0.28, "#45514c", false);
  brick(x + 0.13, y, 0, 0.18, 0.24, 0.28, "#45514c", false);
  brick(x - 0.12, y - 0.04, 0.29, 0.46, 0.34, 0.43, blue ? "#47788f" : "#b65943", false);
  brick(x - 0.07, y, 0.73, 0.36, 0.3, 0.33, "#e6c68c");
  brick(x - 0.13, y - 0.06, 1.04, 0.48, 0.42, 0.12, blue ? "#d9c99e" : "#804d3c");
  brick(x - 0.28, y + 0.05, 0.32, 0.14, 0.15, 0.36, "#d2ac75", false);
  brick(x + 0.37, y + 0.05, 0.32, 0.14, 0.15, 0.36, "#d2ac75", false);
  const p = point(x + 0.13, y + 0.1, 1.45);
  g.font = `bold ${Math.max(9, scale * 0.4)}px system-ui`;
  g.textAlign = "center";
  g.fillStyle = blue ? "#254b62" : "#8b3728";
  g.fillText(blue ? String(u.id) : "\u25C6", p[0], p[1]);
}
function render() {
  const r = canvas.getBoundingClientRect();
  if (r.width !== width || r.height !== height) {
    width = r.width;
    height = r.height;
    const d = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * d);
    canvas.height = Math.round(height * d);
    g.setTransform(d, 0, 0, d, 0, 0);
  }
  scale = Math.min((width - 42) / 33, (height - 86) / 18);
  ox = width / 2;
  oy = (height - 16 * scale) / 2;
  g.clearRect(0, 0, width, height);
  let rng = state.seed || 1;
  const rand = () => {
    rng ^= rng << 13;
    rng ^= rng >>> 17;
    rng ^= rng << 5;
    return (rng >>> 0) / 4294967296;
  };
  const objects = [];
  for (let x = 0; x < 16; x++) for (let y = 0; y < 16; y++) {
    const v = rand(), color = v < 0.15 ? "#a6b489" : v < 0.4 ? "#b5c398" : "#bfcca1";
    brick(x, y, -0.22, 1, 1, 0.22, color, false);
    if ((x < 2 || y < 2 || x > 13 || y > 13) && v < 0.34) objects.push({ depth: x + y, draw: () => tree(x + 0.12, y + 0.12) });
    else if (v < 0.028 && Math.abs(x - 8) < 3) objects.push({ depth: x + y, draw: () => brick(x, y, 0, 0.65, 0.7, 0.35, "#aaa88b") });
  }
  for (let i = 6; i < 11; i++) brick(i, 8, -0.015, 0.9, 0.9, 0.05, "#d0c7a3", false);
  objects.push({ depth: 9, draw: () => house(3, 4) }, { depth: 17, draw: () => house(11, 4, true) });
  for (const u2 of state.units) {
    if (u2.target) {
      const p = point(u2.target.x / 100, u2.target.y / 100);
      g.strokeStyle = "#ba633e";
      g.lineWidth = 1.5;
      g.beginPath();
      g.ellipse(p[0], p[1], scale * 0.3, scale * 0.15, 0, 0, 7);
      g.stroke();
    }
    objects.push({ depth: u2.x / 100 + u2.y / 100, draw: () => villager(u2) });
  }
  objects.sort((a, b) => a.depth - b.depth).forEach((o) => o.draw());
  el("tick").textContent = String(state.tick);
  el("hash").textContent = hash(state);
  const u = state.units.find((u2) => u2.id === selected);
  el("position").textContent = `\u6751\u6C11 ${selected} \xB7 (${(u.x / 100).toFixed(1)}, ${(u.y / 100).toFixed(1)}) \xB7 ${u.target ? "\u79FB\u52D5\u4E2D" : "\u5F85\u547D"}`;
}
function setRunning(v) {
  running = v;
  accumulator = 0;
  last = 0;
  el("pause").textContent = v ? "\u66AB\u505C\u6A21\u64EC" : "\u958B\u59CB\u6A21\u64EC";
  el("pause").setAttribute("aria-pressed", String(v));
  el("run-state").textContent = v ? "\u6A21\u64EC\u904B\u884C\u4E2D \xB7 20 Hz" : "\u5DF2\u66AB\u505C \xB7 \u7B49\u5F85\u6307\u4EE4";
  el("step").disabled = v;
}
function choose(id) {
  selected = id;
  document.querySelectorAll("[data-unit]").forEach((b) => b.setAttribute("aria-pressed", String(Number(b.dataset.unit) === id)));
  el("selected").textContent = `#0${id}`;
  render();
}
function move(x, y) {
  try {
    submit(state, { protocolVersion: 1, rulesetHash, playerId: 0, sequence: state.sequence[0] + 1, targetTick: state.tick + 1, commandType: "move", payload: { unitId: selected, x: Math.round(x * 100), y: Math.round(y * 100) } });
    notice(`\u6751\u6C11 ${selected} \u7684\u79FB\u52D5\u6307\u4EE4\u5DF2\u6392\u5165 tick ${state.tick + 1}\u3002${running ? "" : "\u6309\u300C\u958B\u59CB\u6A21\u64EC\u300D\u6216\u300C\u524D\u9032 1 tick\u300D\u57F7\u884C\u3002"}`);
    render();
  } catch (e) {
    notice(e.message);
  }
}
canvas.addEventListener("click", (e) => {
  const r = canvas.getBoundingClientRect();
  const px = e.clientX - r.left, py = e.clientY - r.top;
  const unit = state.units.find((u) => {
    const p = point(u.x / 100, u.y / 100, 0.5);
    return Math.hypot(p[0] - px, p[1] - py) < Math.max(12, scale * 0.55);
  });
  if (unit) {
    if (unit.player === 0) choose(unit.id);
    else notice("\u7D05\u65B9\u55AE\u4F4D\u4E0D\u53EF\u7531\u85CD\u65B9\u63A7\u5236\u3002");
    return;
  }
  const dx = (px - ox) / scale, dy = (py - oy) / scale;
  const x = dy + dx / 2, y = dy - dx / 2;
  if (x < 0.5 || x > 15.5 || y < 0.5 || y > 15.5) {
    notice("\u8ACB\u9EDE\u9078\u5730\u5716\u5167\u5074\u7684\u5730\u9762\u3002");
    return;
  }
  move(x, y);
});
document.querySelectorAll("[data-unit]").forEach((b) => b.onclick = () => choose(Number(b.dataset.unit)));
el("move").onclick = () => {
  const x = el("target-x"), y = el("target-y");
  if (x.reportValidity() && y.reportValidity() && x.value !== "" && y.value !== "") move(Number(x.value), Number(y.value));
  else notice("\u8ACB\u8F38\u5165 0.5 \u5230 15.5 \u4E4B\u9593\u7684\u5EA7\u6A19\u3002");
};
el("pause").onclick = () => setRunning(!running);
el("step").onclick = () => {
  tick(state);
  render();
};
el("restart").onclick = () => {
  try {
    const input = el("seed");
    if (input.value === "") throw Error("\u8ACB\u8F38\u5165\u7A2E\u5B50");
    const next = createState(Number(input.value));
    state = next;
    setRunning(false);
    choose(1);
    notice("\u5DF2\u5EFA\u7ACB\u65B0\u6C99\u76D2\u3002\u5148\u524D\u7684\u624B\u52D5\u5B58\u6A94\u4ECD\u7136\u4FDD\u7559\u3002");
  } catch (e) {
    notice(e.message);
  }
};
el("save").onclick = () => {
  try {
    localStorage.setItem("brick-rts:sandbox:1", serialize(state));
    notice(`\u5DF2\u5132\u5B58 tick ${state.tick} \u7684\u6C99\u76D2\u3002`);
  } catch (e) {
    notice(`\u5132\u5B58\u5931\u6557\uFF1A${e.message}\u3002\u5148\u524D\u5B58\u6A94\u4FDD\u7559\u3002`);
  }
};
el("load").onclick = () => {
  try {
    const raw = localStorage.getItem("brick-rts:sandbox:1");
    if (!raw) throw Error("\u5C1A\u7121\u624B\u52D5\u5B58\u6A94\u3002");
    const restored = deserialize(raw);
    state = restored;
    setRunning(false);
    el("seed").value = String(state.seed);
    choose(1);
    notice(`\u5DF2\u6062\u5FA9 tick ${state.tick}\uFF1B\u6309\u958B\u59CB\u6A21\u64EC\u7E7C\u7E8C\u3002`);
  } catch (e) {
    notice(`\u8B80\u53D6\u5931\u6557\uFF1A${e.message}\u3002\u76EE\u524D\u6C99\u76D2\u4FDD\u7559\u3002`);
  }
};
el("replay").onclick = () => {
  setRunning(false);
  try {
    const result = replay(state.seed, state.log, state.tick);
    notice(hash(result) === hash(state) ? `\u91CD\u64AD\u4E00\u81F4\uFF1A${state.log.length} \u689D\u6307\u4EE4\u3001${state.tick} ticks\uFF0C\u6307\u7D0B ${hash(result)}\u3002` : "\u91CD\u64AD\u4E0D\u4E00\u81F4\uFF0C\u8ACB\u4FDD\u7559\u76EE\u524D\u72C0\u614B\u56DE\u5831\u3002");
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
      notice("\u756B\u9762\u5EF6\u9072\u8D85\u904E 1 \u79D2\uFF0C\u6A21\u64EC\u5DF2\u66AB\u505C\uFF1B\u672A\u8DF3\u904E\u4EFB\u4F55 tick\u3002");
    } else {
      while (accumulator >= 50) {
        tick(state);
        accumulator -= 50;
      }
      render();
    }
  }
  requestAnimationFrame(frame);
}
render();
requestAnimationFrame(frame);
