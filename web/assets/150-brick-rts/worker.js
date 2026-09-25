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
var economyRules = { provenance: "design_default", initialStock: { food: 200, wood: 200, gold: 100, stone: 100 }, populationCap: 40, cancellationRefundPercent: 100 };
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
var navigationRules = { provenance: "design_default", spacing: 50, size: 31, radius: 25, expansionsPerTick: 32, speedPerTick: 5 };
function makeMap(seed) {
  let rng = seed || 1;
  const obstacles = [{ kind: "house", x: 300, y: 400 }, { kind: "house", x: 1100, y: 400, red: true }];
  for (let x = 0; x < 16; x++) for (let y = 0; y < 16; y++) {
    rng ^= rng << 13;
    rng ^= rng >>> 17;
    rng ^= rng << 5;
    const v = (rng >>> 0) / 4294967296;
    if ((x < 2 || y < 2 || x > 13 || y > 13) && v < 0.34) obstacles.push({ kind: "tree", x: x * 100 + 12, y: y * 100 + 12 });
    else if (v < 0.028 && Math.abs(x - 8) < 3) obstacles.push({ kind: "rock", x: x * 100, y: y * 100 });
  }
  const map = { obstacles, blocked: [] };
  for (let i = 0; i < 961; i++) if (!clearSegment(map, position(i), position(i))) map.blocked.push(i);
  return map;
}
function bounds(o) {
  const r = navigationRules.radius;
  return o.kind === "house" ? [o.x - 15 - r, o.y - 15 - r, o.x + 235 + r, o.y + 215 + r] : o.kind === "tree" ? [o.x - 20 - r, o.y - 20 - r, o.x + 80 + r, o.y + 80 + r] : [o.x - r, o.y - r, o.x + 65 + r, o.y + 70 + r];
}
function clearSegment(map, a, b) {
  if ([a.x, a.y, b.x, b.y].some((v) => !Number.isSafeInteger(v) || v < 50 || v > 1550)) return false;
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
function position(id) {
  return { x: 50 + id % 31 * 50, y: 50 + Math.floor(id / 31) * 50 };
}
function connector(map, a, b) {
  const elbow = { x: b.x, y: a.y };
  return clearSegment(map, a, elbow) && clearSegment(map, elbow, b);
}
function nearest(map, p, outbound = true) {
  let best = -1, distance = Infinity;
  for (let i = 0; i < 961; i++) {
    const q = position(i), d = Math.abs(p.x - q.x) + Math.abs(p.y - q.y);
    if (d < distance && !map.blocked.includes(i) && (outbound ? connector(map, p, q) : connector(map, q, p))) {
      best = i;
      distance = d;
    }
  }
  return best;
}
function createPathJob(map, unitId, from, target) {
  const start = nearest(map, from), goal = nearest(map, target, false), parents = Array(961).fill(-2);
  if (start >= 0) parents[start] = -1;
  return { unitId, start, goal, target: { ...target }, frontier: start < 0 ? [] : [start], head: 0, parents, status: start < 0 || goal < 0 ? "unreachable" : "searching", path: [] };
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
    for (const next of [x < 30 ? id + 1 : -1, y < 30 ? id + 31 : -1, x > 0 ? id - 1 : -1, y > 0 ? id - 31 : -1]) if (next >= 0 && job.parents[next] === -2 && !map.blocked.includes(next) && clearSegment(map, position(id), position(next))) {
      job.parents[next] = id;
      job.frontier.push(next);
    }
  }
  return used;
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
var rulesetHash = hash({ rules, navigationRules, economyRules, simulationVersion: 3 });
function createState(seed) {
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 4294967295) throw Error("seed \u5FC5\u9808\u70BA uint32");
  return { version: 3, accounts: [createAccount(3), createAccount(1)], transactions: [], map: makeMap(seed), pathJobs: [], seed, rng: seed || 1, tick: 0, sequence: [0, 0], units: [{ id: 1, player: 0, x: 350, y: 700, target: null }, { id: 2, player: 0, x: 450, y: 700, target: null }, { id: 3, player: 0, x: 400, y: 800, target: null }, { id: 4, player: 1, x: 1150, y: 700, target: null }], queue: [], log: [] };
}
function submit(state, c) {
  if (!c || c.protocolVersion !== 1 || c.rulesetHash !== rulesetHash) throw Error("\u547D\u4EE4\u7248\u672C\u4E0D\u7B26");
  if (!Number.isSafeInteger(c.playerId) || c.playerId < 0 || c.playerId > 1) throw Error("\u7121\u6548\u73A9\u5BB6");
  if (!Number.isSafeInteger(c.sequence) || c.sequence !== state.sequence[c.playerId] + 1) throw Error("\u91CD\u8907\u6216\u932F\u5E8F\u547D\u4EE4");
  if (!Number.isSafeInteger(c.targetTick) || c.targetTick <= state.tick || c.targetTick > state.tick + 200) throw Error("\u547D\u4EE4\u5DF2\u904E\u671F\u6216\u904E\u9060");
  if (!c.payload) throw Error("\u7F3A\u5C11 payload");
  if (c.commandType === "move") {
    const u = state.units.find((u2) => u2.id === c.payload.unitId);
    if (!u || u.player !== c.playerId) throw Error("\u4E0D\u53EF\u63A7\u5236\u6575\u65B9\u55AE\u4F4D");
    for (const k of ["x", "y"]) if (!Number.isSafeInteger(c.payload[k]) || c.payload[k] < 50 || c.payload[k] > 1550) throw Error("\u76EE\u6A19\u8D85\u51FA\u5730\u5716");
    if (!clearSegment(state.map, c.payload, c.payload)) throw Error("\u76EE\u6A19\u4F4D\u65BC\u5EFA\u7BC9\u6216\u6A39\u6728\u7684\u5360\u5730\u5167");
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
    if (c.commandType !== "move") {
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
    const u = s.units.find((u2) => u2.id === c.payload.unitId);
    u.target = { x: c.payload.x, y: c.payload.y };
    u.path = [];
    u.navigation = "searching";
    s.pathJobs = s.pathJobs.filter((j) => j.unitId !== u.id);
    s.pathJobs.push(createPathJob(s.map, u.id, u, u.target));
  }
  s.pathJobs.sort((a, b) => a.unitId - b.unitId);
  let budget = navigationRules.expansionsPerTick;
  while (budget > 0 && s.pathJobs.some((j) => j.status === "searching")) for (const job of s.pathJobs) {
    if (budget <= 0) break;
    if (job.status === "searching") budget -= advancePathJob(s.map, job, 1);
  }
  for (const job of s.pathJobs) if (job.status !== "searching") {
    const u = s.units.find((u2) => u2.id === job.unitId);
    u.path = job.path;
    u.navigation = job.status === "found" ? "moving" : "unreachable";
    if (job.status === "unreachable") u.target = null;
  }
  s.pathJobs = s.pathJobs.filter((j) => j.status === "searching");
  for (const u of s.units) if (u.path?.length) {
    const next = u.path[0];
    const p = { x: u.x + Math.sign(next.x - u.x) * Math.min(5, Math.abs(next.x - u.x)), y: u.x === next.x ? u.y + Math.sign(next.y - u.y) * Math.min(5, Math.abs(next.y - u.y)) : u.y };
    if (!clearSegment(s.map, u, p)) throw Error(`tick ${s.tick} / entity ${u.id}: \u975E\u6CD5\u78B0\u649E\u8DEF\u5F91`);
    u.x = p.x;
    u.y = p.y;
    if (u.x === next.x && u.y === next.y) u.path.shift();
    if (!u.path.length) {
      u.target = null;
      u.navigation = "idle";
    }
  }
}
function replay(seed, commands, ticks) {
  if (!Number.isSafeInteger(ticks) || ticks < 0 || ticks > 1e5 || !Array.isArray(commands) || commands.length > 1e4) throw Error("\u7121\u6548\u91CD\u64AD\u7BC4\u570D");
  const s = createState(seed);
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
  return JSON.stringify({ format: "brick-sandbox-3", rulesetHash, state: s, checksum: hash(s) });
}
function deserialize(raw) {
  const v = JSON.parse(raw);
  if (!v || v.format !== "brick-sandbox-3" || v.rulesetHash !== rulesetHash || !v.state || v.checksum !== hash(v.state)) throw Error("\u5B58\u6A94\u7248\u672C\u4E0D\u7B26\u6216\u5167\u5BB9\u640D\u58DE");
  const s = v.state;
  if (s.version !== 3 || !Number.isSafeInteger(s.tick) || s.tick < 0 || s.tick > 1e5 || !Array.isArray(s.log) || s.log.length > 1e4) throw Error("\u7121\u6548\u5B58\u6A94\u72C0\u614B");
  const rebuilt = replay(s.seed, s.log, s.tick);
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
          if (state.log.length >= 1e4) throw Error("\u5DF2\u9054\u6C99\u76D2 10000 \u6307\u4EE4\u4E0A\u9650\uFF0C\u8ACB\u5132\u5B58\u6216\u91CD\u5EFA");
          accepted = { acceptedTick: state.tick, protocolVersion: 1, rulesetHash, playerId: 0, sequence: state.sequence[0] + 1, targetTick: state.tick + 1, commandType: "move", payload: { unitId: op.unitId, x: op.x, y: op.y } };
          submit(state, accepted);
          break;
        case "advance":
          if (!Number.isSafeInteger(op.count) || op.count < 1 || op.count > 20 || state.tick + op.count > 1e5) throw Error("\u6B65\u9032\u9700\u70BA 1\u201320 ticks\uFF0C\u7E3D\u91CF\u4E0D\u5F97\u8D85\u904E 100000");
          for (let i = 0; i < op.count; i++) tick(state);
          break;
        case "reset":
          state = createState(op.seed);
          commands = [];
          break;
        case "restore":
          state = deserialize(op.snapshot);
          commands = structuredClone(state.log);
          break;
        case "recover": {
          if (!op.checkpoint) throw Error("\u7F3A\u5C11\u6062\u5FA9\u9EDE");
          const candidate = replay(op.checkpoint.seed, op.checkpoint.commands, op.checkpoint.ticks);
          state = candidate;
          commands = structuredClone(state.log);
          break;
        }
        case "snapshot":
          snapshot = serialize(state);
          break;
        case "replay":
          replayMatches = hash(replay(state.seed, state.log, state.tick)) === hash(state);
          break;
        default:
          throw Error("\u4E0D\u652F\u63F4\u7684 operation");
      }
      const positions = new Int32Array(state.units.length * 7);
      state.units.forEach((u, i) => positions.set([u.id, u.player, u.x, u.y, u.target?.x ?? -1, u.target?.y ?? -1, ["idle", "searching", "moving", "unreachable"].indexOf(u.navigation ?? "idle")], i * 7));
      return { protocol: 1, id: req.id, ok: true, seed: state.seed, tick: state.tick, stateHash: hash(state), positions: positions.buffer, accepted, commands, snapshot, replayMatches };
    } catch (error) {
      return { protocol: 1, id: Number.isSafeInteger(req?.id) ? req.id : 0, ok: false, tick: state.tick, message: error.message, entityId: req?.operation?.kind === "move" ? req.operation.unitId : void 0 };
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
