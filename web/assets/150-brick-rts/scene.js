// packages/sim/terrain.ts
var terrainRules = { provenance: "design_default", size: 16, tileSize: 100, resourceCapacity: { tree: 300, stone: 250 }, generationAttempts: 8 };
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
function createTiles() {
  return Array.from({ length: 256 }, (_, id) => {
    const terrainType = Math.floor(id / 16) === 8 ? "road" : "grass";
    return { id, terrainType, ...terrainDefinitions[terrainType], resourceRefs: [], obstacleRefs: [] };
  });
}
function tileAt(x, y) {
  return Math.floor(y / 100) * 16 + Math.floor(x / 100);
}
function canTraverse(tile, movement) {
  return tile.walkClass === movement || tile.walkClass === "both";
}

// packages/sim/navigation.ts
var navigationRules = { provenance: "design_default", spacing: 50, size: 31, radius: 25, expansionsPerTick: 32, speedPerTick: 5 };
function makeMap(seed) {
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 4294967295) throw Error("\u5730\u5716 seed \u5FC5\u9808\u70BA uint32");
  let lastErrors = [];
  for (let attempt = 0; attempt < terrainRules.generationAttempts; attempt++) {
    const map = generateCandidate(seed + Math.imul(attempt, 2654435761) >>> 0);
    map.generationAttempt = attempt;
    lastErrors = validateMap(map);
    if (!lastErrors.length) return map;
  }
  throw Error(`\u5730\u5716\u751F\u6210\u5931\u6557\uFF08${terrainRules.generationAttempts} \u6B21\uFF09\uFF1A${lastErrors.join("\uFF1B")}`);
}
function generateCandidate(seed) {
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
  const map = { obstacles, blocked: [], tiles: createTiles(), resources: [], navigationRevision: 0, generationAttempt: 0 };
  obstacles.forEach((o, index) => {
    o.id = `obstacle-${index}`;
    map.tiles[tileAt(o.x, o.y)].obstacleRefs.push(o.id);
    if (o.kind !== "house") {
      const kind = o.kind === "tree" ? "tree" : "stone";
      const id = `resource-${index}`, capacity = terrainRules.resourceCapacity[kind];
      map.resources.push({ id, kind, x: o.x, y: o.y, capacity, remaining: capacity, collectible: true, status: "available", obstacleId: o.id, depletedAt: null });
      map.tiles[tileAt(o.x, o.y)].resourceRefs.push(id);
    }
  });
  for (let i = 0; i < 961; i++) if (!clearSegment(map, position(i), position(i))) map.blocked.push(i);
  return map;
}
function bounds(o) {
  const r = navigationRules.radius;
  return o.kind === "house" ? [o.x - 15 - r, o.y - 15 - r, o.x + 235 + r, o.y + 215 + r] : o.kind === "tree" ? [o.x - 20 - r, o.y - 20 - r, o.x + 80 + r, o.y + 80 + r] : [o.x - r, o.y - r, o.x + 65 + r, o.y + 70 + r];
}
function clearSegment(map, a, b) {
  if ([a.x, a.y, b.x, b.y].some((v) => !Number.isSafeInteger(v) || v < 50 || v > 1550)) return false;
  for (const tile of map.tiles) if (!canTraverse(tile, "land")) {
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
  const obstacles = new Set(map.obstacles.map((o) => o.id)), resources = new Set(map.resources.map((r) => r.id));
  if (obstacles.size !== map.obstacles.length || obstacles.has(void 0)) errors.push("\u969C\u7919 ID \u91CD\u8907\u6216\u7F3A\u5C11");
  if (resources.size !== map.resources.length) errors.push("\u8CC7\u6E90 ID \u91CD\u8907");
  for (const tile of map.tiles) {
    if (!Number.isSafeInteger(tile.height) || tile.height < 0) errors.push(`\u5730\u683C ${tile.id} \u9AD8\u5EA6\u7121\u6548`);
    if (!["land", "water", "both", "blocked"].includes(tile.walkClass) || typeof tile.buildability !== "boolean") errors.push(`\u5730\u683C ${tile.id} \u901A\u884C\u6216\u5EFA\u9020\u898F\u5247\u7121\u6548`);
    if (tile.resourceRefs.some((id) => !resources.has(id)) || tile.obstacleRefs.some((id) => !obstacles.has(id))) errors.push(`\u5730\u683C ${tile.id} \u53C3\u7167\u5931\u6548`);
  }
  for (const r of map.resources) {
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

// apps/web/scene.ts
var brickStyle = { studPitch: 0.5, plateHeight: 0.16, brickHeight: 0.32, bevel: 0.025, roughness: 0.72, provenance: "original_procedural" };
async function createScene(canvas, onFailure, options = {}) {
  const T = await import(new URL("../../../vendor/three-0.186.0/three.module.js", import.meta.url).href);
  if (!canvas.getContext("webgl2")) throw Error("\u6B64\u88DD\u7F6E\u7121\u6CD5\u5EFA\u7ACB WebGL2\uFF0C\u8ACB\u4F7F\u7528\u652F\u63F4 WebGL2 \u7684\u700F\u89BD\u5668\u3002");
  let contextLost = false;
  const renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.setClearColor("#d7e0cc");
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.35;
  const scene = new T.Scene();
  const camera = new T.OrthographicCamera(-12, 12, 10, -10, 0.1, 100);
  const ambient = new T.HemisphereLight("#fff5dc", "#819b75", 2.4);
  scene.add(ambient);
  const sun = new T.DirectionalLight("#fff1d8", 3);
  sun.position.set(-4, 20, 12);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 1, far: 60 });
  sun.shadow.normalBias = 0.03;
  scene.add(sun);
  sun.target.position.set(8, 0, 8);
  scene.add(sun.target);
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
    return geo;
  }
  const studGeo = new T.CylinderGeometry(0.13, 0.13, 0.08, 10);
  geometry.set("stud", studGeo);
  let staticGroup = new T.Group();
  scene.add(staticGroup);
  const batches = /* @__PURE__ */ new Map();
  let muted = false;
  function staticPart(geo, color, x, y, z) {
    if (muted) color = "#737b72";
    const key = geo.uuid + color;
    if (!batches.has(key)) batches.set(key, { geo, color, matrices: [] });
    batches.get(key).matrices.push(new T.Matrix4().makeTranslation(x, y, z));
  }
  function brick(x, z, y, w, d, h, color, studs = true) {
    staticPart(box(w - 0.018, h, d - 0.018), color, x + w / 2, y, z + d / 2);
    if (studs) for (let a = 0.25; a < w; a += 0.5) for (let b = 0.25; b < d; b += 0.5) staticPart(studGeo, color, x + a, y + h + 0.04, z + b);
  }
  function house(x, z, red = false) {
    const roof = red ? "#b85c47" : "#456e87";
    brick(x - 0.15, z - 0.15, 0, 2.5, 2.3, 0.16, "#b3aa8c", false);
    for (let level = 0; level < 4; level++) for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) brick(x + a, z + b, 0.16 + level * 0.32, 1, 1, 0.32, level % 2 ? "#e3cba4" : "#ddbc90", false);
    brick(x + 0.75, z + 2, 0.16, 0.5, 0.05, 0.92, "#574b39", false);
    brick(x + 0.81, z + 2.05, 0.22, 0.38, 0.04, 0.78, "#796448", false);
    brick(x + 0.83, z + 2.09, 0.63, 0.06, 0.04, 0.07, "#d8b76c", false);
    for (const dx of [0.14, 1.44]) {
      brick(x + dx, z + 2, 0.79, 0.42, 0.06, 0.43, "#7b654e", false);
      brick(x + dx + 0.055, z + 2.065, 0.85, 0.31, 0.025, 0.31, "#334b4e", false);
    }
    for (const dx of [0, 0.97, 1.94]) brick(x + dx, z + 1.99, 0.16, 0.06, 0.06, 1.3, "#866b50", false);
    brick(x, z + 2.01, 1.42, 2, 0.06, 0.11, "#826a50", false);
    for (let level = 0; level < 4; level++) for (let row = 0; row < 5; row++) brick(x - 0.2 + level * 0.25, z - 0.2 + row * 0.5, 1.53 + level * 0.18, 2.5 - level * 0.5, 0.5, 0.18, roof);
    brick(x + 1.5, z + 0.25, 2.03, 0.5, 0.5, 0.8, "#b9a98b");
    brick(x + 1.48, z + 0.23, 2.83, 0.54, 0.54, 0.1, "#7b7665", false);
    brick(x + 0.25, z + 0.25, 2.37, 0.07, 0.07, 0.9, "#786849", false);
    brick(x + 0.32, z + 0.25, 3, 0.6, 0.04, 0.3, roof, false);
  }
  function buildWorld(view) {
    const seed = view.seed;
    scene.remove(staticGroup);
    staticGroup.traverse((o) => {
      if (o.isInstancedMesh) o.dispose();
    });
    staticGroup = new T.Group();
    scene.add(staticGroup);
    batches.clear();
    const map = options.assetPreview ? makeMap(seed) : { tiles: createTiles(), obstacles: view.known.map((k) => k.obstacle) };
    let rng = seed || 1;
    for (const tile of map.tiles) {
      const x = tile.id % 16, z = Math.floor(tile.id / 16);
      rng ^= rng << 13;
      rng ^= rng >>> 17;
      rng ^= rng << 5;
      const n = (rng >>> 0) / 4294967296;
      brick(x, z, -0.24, 1, 1, 0.24, !options.assetPreview && view.fog[tile.id] !== 2 ? view.fog[tile.id] === 1 ? "#626e64" : "#293e38" : tile.terrainType === "road" ? "#c4b18a" : n < 0.2 ? "#a6b582" : n < 0.5 ? "#b5c493" : "#becda0", false);
    }
    for (const o of map.obstacles) {
      muted = !options.assetPreview && view.fog[tileAt(o.x, o.y)] !== 2;
      const x = o.x / 100, z = o.y / 100;
      if (o.kind === "house") house(x, z, o.red);
      else if (o.kind === "tree") {
        brick(x + 0.15, z + 0.15, 0, 0.3, 0.3, 0.8, "#80664b", false);
        brick(x - 0.2, z - 0.2, 0.7, 1, 1, 0.4, "#67835a");
        brick(x - 0.075, z - 0.075, 1.1, 0.75, 0.75, 0.4, "#7e985f");
        brick(x + 0.05, z + 0.05, 1.5, 0.5, 0.5, 0.3, "#91a970");
      } else {
        brick(x, z, 0, 0.65, 0.7, 0.3, "#a19f86");
        brick(x + 0.15, z + 0.15, 0.3, 0.35, 0.4, 0.18, "#b8b39c", false);
      }
    }
    muted = false;
    for (const { geo, color, matrices } of batches.values()) {
      const mesh = new T.InstancedMesh(geo, material(color), matrices.length);
      matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
      mesh.instanceMatrix.needsUpdate = true;
      mesh.userData.studs = geo === studGeo;
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
    scene.add(group);
    const part = (parent, x, y, z, w, h, d, color) => {
      const m = new T.Mesh(box(w, h, d), material(color));
      m.position.set(x, y, z);
      m.castShadow = true;
      parent.add(m);
      return m;
    };
    const left = new T.Group(), right = new T.Group();
    left.position.set(-0.12, 0.3, 0);
    right.position.set(0.12, 0.3, 0);
    group.add(left, right);
    part(left, 0, -0.3, 0, 0.19, 0.3, 0.24, "#44514b");
    part(right, 0, -0.3, 0, 0.19, 0.3, 0.24, "#44514b");
    part(group, 0, 0.3, 0, 0.46, 0.4, 0.32, player === 0 ? "#45728c" : "#b25441");
    part(group, 0, 0.71, 0, 0.34, 0.3, 0.3, "#dfbb7e");
    part(group, 0, 1.02, 0, 0.44, 0.11, 0.4, player === 0 ? "#cbbc94" : "#835243");
    for (const dx of [-0.19, 0.19]) {
      part(group, dx, 0.39, 0, 0.1, 0.28, 0.16, player === 0 ? "#45728c" : "#b25441");
      part(group, dx, 0.29, 0, 0.1, 0.14, 0.17, "#dfbb7e");
    }
    for (const dx of [-0.075, 0.075]) part(group, dx, 0.86, 0.155, 0.035, 0.04, 0.018, "#3e3a2e");
    const ring = new T.Mesh(ringGeo, ringMaterial);
    ring.position.y = 0.025;
    group.add(ring);
    units.set(id, { group, left, right, ring, player, moving: false });
    return units.get(id);
  }
  let worldKey = "", angle = Math.PI / 4, zoom = 1, width = 0, height = 0, selected = 1, latest = null;
  function cameraUpdate() {
    if (width <= 0 || height <= 0) return;
    const aspect = width / Math.max(1, height);
    const halfH = Math.max(10.5, 12 / aspect) / zoom;
    camera.left = -halfH * aspect;
    camera.right = halfH * aspect;
    camera.top = halfH;
    camera.bottom = -halfH;
    camera.position.set(8 + Math.sin(angle) * 24, 24, 8 + Math.cos(angle) * 24);
    camera.lookAt(8, 0, 8);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    for (const mesh of staticGroup.children) mesh.visible = !mesh.userData.studs || zoom >= 0.9;
  }
  function resize() {
    const r = canvas.getBoundingClientRect();
    if (r.width !== width || r.height !== height) {
      width = r.width;
      height = r.height;
      renderer.setSize(width, height, false);
      cameraUpdate();
    }
  }
  function update(view, id) {
    latest = view;
    selected = id;
    const key = JSON.stringify([view.seed, view.fog, view.known?.map((k) => k.obstacle)]);
    if (worldKey !== key) {
      worldKey = key;
      buildWorld(view);
      cameraUpdate();
    }
    const alive = new Set(view.units.map((u) => u.id));
    for (const [key2, u] of units) if (!alive.has(key2)) {
      scene.remove(u.group);
      units.delete(key2);
    }
    for (const data of view.units) {
      const u = units.get(data.id) ?? unit(data.id, data.player);
      const dx = data.x / 100 - u.group.position.x, dz = data.y / 100 - u.group.position.z;
      if (Math.abs(dx) + Math.abs(dz) > 1e-3) u.group.rotation.y = Math.atan2(dx, dz);
      u.group.position.set(data.x / 100, 0, data.y / 100);
      u.ring.visible = data.id === selected;
      u.moving = data.navigation === "moving";
    }
  }
  const raycaster = new T.Raycaster(), ground = new T.Plane(new T.Vector3(0, 1, 0), 0);
  function pick(clientX, clientY) {
    const r = canvas.getBoundingClientRect();
    raycaster.setFromCamera(new T.Vector2((clientX - r.left) / r.width * 2 - 1, -(clientY - r.top) / r.height * 2 + 1), camera);
    const hits = raycaster.intersectObjects([...units.values()].map((u) => u.group), true);
    if (hits.length) {
      let obj = hits[0].object;
      while (obj.parent && obj.parent !== scene) obj = obj.parent;
      for (const [id, u] of units) if (u.group === obj) return { unitId: id };
    }
    const p = new T.Vector3();
    if (raycaster.ray.intersectPlane(ground, p)) return { x: p.x, y: p.z };
    return {};
  }
  function draw(time) {
    if (contextLost) return;
    resize();
    for (const u of units.values()) {
      const swing = u.moving ? Math.sin(time * 0.012) * 0.35 : 0;
      u.left.rotation.x = swing;
      u.right.rotation.x = -swing;
    }
    renderer.render(scene, camera);
  }
  canvas.addEventListener("webglcontextlost", (event) => {
    event.preventDefault();
    contextLost = true;
    onFailure("3D \u7E6A\u5716\u9023\u7DDA\u4E2D\u65B7\uFF0C\u6A21\u64EC\u5DF2\u66AB\u505C\uFF1B\u8ACB\u91CD\u65B0\u8F09\u5165\u9801\u9762\u5F8C\u8B80\u53D6\u624B\u52D5\u5B58\u6A94\u3002");
  });
  canvas.dataset.renderer = "webgl2";
  return { update, draw, pick, zoom: (delta) => {
    zoom = Math.max(0.7, Math.min(2.5, zoom + delta));
    cameraUpdate();
  }, rotate: () => {
    angle += Math.PI / 2;
    cameraUpdate();
  }, resetCamera: () => {
    zoom = 1;
    angle = Math.PI / 4;
    cameraUpdate();
  }, dispose: () => {
    renderer.dispose();
    for (const geo of geometry.values()) geo.dispose();
    for (const m of materials.values()) m.dispose();
    ringMaterial.dispose();
  }, stats: () => ({ drawCalls: renderer.info.render.calls, triangles: renderer.info.render.triangles, geometries: renderer.info.memory.geometries }) };
}
export {
  brickStyle,
  createScene
};
