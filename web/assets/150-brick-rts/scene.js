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
function archOpening(width, height) {
  return { radius: Math.min(width * 0.32, height * 0.35), spring: height * 0.55 };
}
function createArchGeometry(T, width, height, depth) {
  if (![width, height, depth].every((n) => Number.isFinite(n) && n > 0)) throw Error("\u62F1\u4EF6\u5C3A\u5BF8\u5FC5\u9808\u70BA\u6709\u9650\u6B63\u6578");
  const half = width / 2, { radius, spring } = archOpening(width, height);
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
  const p = [], team2 = v.red ? "#b85c47" : "#456e87", wood2 = "#94734c", stone2 = "#b5b29e", top = 1.44 + (v.ageVariant - 1) * 0.16;
  const add = (id, phase, x, z, y, w, d, h, color, studs = false, shape) => p.push({ id, phase, x, z, y, w, d, h, color, studs, ...shape ? { shape } : {} });
  add("foundation", 0, -0.15, -0.15, 0, 3, 3, 0.16, "#b3aa8c");
  if (kind === "archery-range") {
    for (const x of [0.1, 2.5]) {
      add(`fence-post-${x}`, 1, x, 0.12, 0.16, 0.13, 2.1, 0.5, wood2);
    }
    add("backstop", 1, 0.1, 0.12, 0.16, 2.53, 0.18, 1.1, wood2);
    for (const x of [0.36, 1.67]) {
      add(`target-leg-${x}`, 2, x + 0.23, 0.75, 0.16, 0.1, 0.2, 0.75, wood2);
      add(`target-board-${x}`, 2, x, 0.72, 0.83, 0.56, 0.16, 0.6, "#cfbd87");
      add(`target-ring-${x}`, 3, x + 0.1, 0.88, 0.93, 0.36, 0.03, 0.4, "#aa5c48");
      add(`target-center-${x}`, 3, x + 0.2, 0.91, 1.03, 0.16, 0.03, 0.2, "#e5d4a8");
    }
    add("arrow-rack", 3, 0.22, 2.3, 0.16, 0.7, 0.27, 0.4, wood2);
    for (let i = 0; i < 4; i++) add(`arrow-${i}`, 3, 0.3 + i * 0.14, 2.4, 0.56, 0.03, 0.03, 0.42, "#d2be8f");
  } else {
    for (const x of [0.1, 2.44]) for (const z of [0.1, 1.65]) add(`post-${x}-${z}`, 1, x, z, 0.16, 0.16, 0.16, top - 0.16, v.ageVariant >= 3 ? stone2 : wood2);
    add("back-wall", 1, 0.1, 0.1, 0.16, 2.5, 0.15, top - 0.16, kind === "stable" ? wood2 : stone2);
    for (let level = 0; level < 3; level++) add(`roof-${level}`, 2, -0.05 + level * 0.28, -0.05, top + level * 0.16, 2.9 - level * 0.56, 1.98, 0.16, v.ageVariant === 1 ? "#b8a074" : team2, true);
    if (kind === "barracks") {
      add("drill-floor", 1, 0.3, 1.85, 0.16, 2.1, 0.85, 0.08, "#a59a76");
      add("weapon-rack", 3, 0.3, 0.5, 0.16, 0.15, 1.1, 0.75, wood2);
      for (let i = 0; i < 3; i++) {
        add(`spear-shaft-${i}`, 3, 0.32, 0.6 + i * 0.3, 0.16, 0.04, 0.04, 1.15, wood2);
        add(`spear-point-${i}`, 3, 0.28, 0.58 + i * 0.3, 1.31, 0.12, 0.08, 0.2, "#bdc5bd");
      }
      for (const x of [0.5, 1.05, 1.6]) {
        add(`shield-support-${x}`, 3, x, 1.9, 0.24, 0.08, 0.15, 0.62, wood2);
        add(`shield-${x}`, 3, x - 0.08, 2.02, 0.43, 0.36, 0.08, 0.44, team2);
        add(`shield-boss-${x}`, 3, x + 0.04, 2.1, 0.57, 0.1, 0.04, 0.12, "#bca36f");
      }
    } else {
      for (const x of [0.15, 1.75]) {
        add(`stall-divider-${x}`, 1, x, 0.35, 0.16, 0.1, 1.3, 0.65, wood2);
        add(`hay-${x}`, 3, x + 0.16, 0.4, 0.16, 0.62, 0.55, 0.3, "#beac69", true);
      }
      add("trough-base", 3, 0.6, 2.03, 0.16, 1.5, 0.4, 0.12, wood2);
      for (const z of [2.03, 2.35]) add(`trough-rim-${z}`, 3, 0.6, z, 0.28, 1.5, 0.08, 0.2, wood2);
      for (const x of [0.6, 2.02]) add(`trough-end-${x}`, 3, x, 2.11, 0.28, 0.08, 0.24, 0.2, wood2);
      add("trough-water", 3, 0.69, 2.12, 0.28, 1.32, 0.22, 0.035, "#6a9297");
      add("saddle-rack", 3, 2.48, 0.9, 0.16, 0.12, 0.15, 0.85, wood2);
      add("spare-saddle", 3, 2.3, 0.84, 1.01, 0.45, 0.4, 0.16, "#716045");
    }
  }
  if (v.ageVariant >= 2) {
    if (kind === "archery-range") {
      for (const x of [0.1, 2.44]) add(`canopy-post-${x}`, 1, x, 0.12, 0.16, 0.16, 0.18, top - 0.16, wood2);
      add("canopy-beam", 1, 0.1, 0.12, top, 2.5, 0.18, 0.16, wood2);
      add("canopy-roof", 2, -0.05, -0.02, top + 0.16, 2.8, 0.7, 0.16, team2, true);
    } else {
      for (const x of [0.1, 2.44]) add(`porch-foot-${x}`, 1, x - 0.07, 1.58, 0.16, 0.3, 0.3, 0.32, stone2);
      add("porch-beam", 1, 0.1, 1.65, top - 0.16, 2.5, 0.16, 0.16, wood2);
      add("ridge-cap", 2, 0.79, -0.05, top + 0.48, 1.22, 1.98, 0.16, team2, true);
    }
  }
  if (v.ageVariant >= 3) {
    if (kind === "archery-range") {
      add("stone-backstop", 1, 0.1, -0.04, 0.16, 2.5, 0.16, 1.28, stone2);
      for (const x of [0.1, 2.3]) add(`backstop-buttress-${x}`, 1, x, 0.13, 0.16, 0.3, 0.35, 1.12, stone2);
      for (let i = 0; i < 5; i++) add(`backstop-crenel-${i}`, 2, 0.1 + i * 0.5, -0.04, 1.44, 0.3, 0.16, 0.24, stone2, true);
    } else {
      for (const z of [0.1, 1.6]) for (const x of [-0.05, 2.6]) add(`buttress-${x}-${z}`, 1, x, z, 0.16, 0.15, 0.3, top - 0.16, stone2);
      add("porch-arch", 1, 0.26, 1.65, 0.16, 2.18, 0.16, top - 0.16, stone2, false, "arch");
    }
  }
  if (v.ageVariant === 4) {
    if (kind === "archery-range") {
      for (const x of [0.1, 2.2]) {
        add(`turret-base-${x}`, 2, x, 0.05, top + 0.32, 0.4, 0.4, 0.16, stone2);
        for (const dx of [0, 0.28]) add(`turret-post-${x}-${dx}`, 3, x + dx, 0.05, top + 0.48, 0.12, 0.4, 0.48, stone2);
        add(`turret-cap-${x}`, 3, x - 0.05, 0, top + 0.96, 0.5, 0.5, 0.16, team2, true);
      }
    } else {
      const base = top + 0.64;
      add("vent-base", 2, 0.91, 0.5, base, 0.96, 0.8, 0.16, stone2);
      for (const x of [0.91, 1.71]) for (const z of [0.5, 1.14]) add(`vent-post-${x}-${z}`, 3, x, z, base + 0.16, 0.16, 0.16, 0.48, stone2);
      add("vent-cap", 3, 0.83, 0.42, base + 0.64, 1.12, 0.96, 0.16, team2, true);
      add("vent-crown", 4, 1.07, 0.58, base + 0.8, 0.64, 0.64, 0.16, team2, true);
    }
  }
  add("flag-pole", 4, 2.67, 2.63, 0.16, 0.06, 0.06, 1.6, wood2);
  add("flag", 4, 2.24, 2.63, 1.42, 0.44, 0.05, 0.28, team2);
  if (v.health === 0) return [p[0], ...Array.from({ length: 12 }, (_, i) => ({ id: `debris-${i}`, phase: 0, x: 0.2 + i % 4 * 0.6, z: 0.2 + Math.floor(i / 4) * 0.7, y: 0.16, w: 0.34, d: 0.3, h: 0.12, color: wood2, studs: false }))];
  return p.filter((a) => a.phase <= Math.min(4, Math.floor(v.progress / 20))).filter((a) => v.health >= 50 || !(a.id === "flag" || a.id.startsWith("target-center") || a.id === "vent-crown" || a.id.startsWith("backstop-crenel")));
}

// apps/web/monastery-building.ts
function monasteryParts(v) {
  if (![1, 2, 3, 4].includes(v.ageVariant) || ![v.progress, v.health].every((n) => Number.isFinite(n) && n >= 0 && n <= 100)) throw Error("\u7121\u6548\u4FEE\u9053\u9662\u5916\u89C0");
  const p = [], age = v.ageVariant, team2 = v.red ? "#b85c47" : "#456e87", wood2 = "#94734c", lime2 = "#d8cfb6", stone2 = "#b9b39d", roof = age === 1 ? "#b8a074" : team2;
  const add = (id, phase, x, z, y, w, d, h, color, studs = false, shape) => p.push({ id, phase, x, z, y, w, d, h, color, studs, ...shape ? { shape } : {} });
  const wallTop = 1.12 + (age >= 3 ? 0.32 : 0), towerTop = age <= 2 ? 2.24 : 2.56 + (age === 4 ? 0.32 : 0);
  add("foundation", 0, -0.15, -0.15, 0, 3, 3, 0.16, "#b3aa8c");
  add("nave", 1, 0.2, 0.3, 0.16, 1.6, 2.2, wallTop - 0.16, lime2);
  add("door", 1, 0.75, 2.46, 0.16, 0.5, 0.08, 0.72, "#6e5a44", false, "arch");
  for (const z of [0.8, 1.6]) for (const x of [0.16, 1.76]) add(`window-${x}-${z}`, 1, x, z, 0.62, 0.08, 0.26, 0.36, "#5b5040");
  for (let level = 0; level < 3; level++) add(`roof-${level}`, 2, 0.1 + level * 0.3, 0.2, wallTop + level * 0.16, 1.8 - level * 0.6, 2.4, 0.16, roof, true);
  add("tower", 1, 2, 0.25, 0.16, 0.7, 0.7, towerTop - 0.16, age <= 2 ? wood2 : stone2);
  for (const x of [2, 2.56]) for (const z of [0.25, 0.81]) add(`belfry-post-${x}-${z}`, 2, x, z, towerTop, 0.14, 0.14, 0.48, age <= 2 ? wood2 : stone2);
  add("belfry-plate", 2, 2, 0.25, towerTop + 0.48, 0.7, 0.7, 0.12, wood2);
  add("bell", 3, 2.24, 0.49, towerTop + 0.26, 0.22, 0.22, 0.22, "#b8964a");
  add("bell-rope", 3, 2.33, 0.58, towerTop + 0.1, 0.04, 0.04, 0.16, "#d8c48a");
  add("belfry-floor", 2, 2, 0.25, towerTop - 0.02, 0.7, 0.7, 0.02, stone2);
  add("tower-cap", 3, 1.95, 0.2, towerTop + 0.6, 0.8, 0.8, 0.16, roof, true);
  add("tower-cap-2", 3, 2.1, 0.35, towerTop + 0.76, 0.5, 0.5, 0.16, roof, true);
  add("garden-soil", 1, 2, 1.35, 0.16, 0.7, 1.25, 0.06, "#8a6a48");
  for (const z of [1.35, 2.5]) add(`garden-wall-${z}`, 2, 2, z, 0.22, 0.7, 0.1, 0.24, stone2);
  add("garden-wall-side", 2, 2.6, 1.45, 0.22, 0.1, 1.05, 0.24, stone2);
  for (const z of [1.6, 1.95, 2.25]) add(`herb-${z}`, 3, 2.2, z, 0.22, 0.26, 0.2, 0.16, "#6f8a55", true);
  if (age >= 2) for (const z of [0.3, 2.34]) add(`plinth-${z}`, 1, 0.14, z, 0.16, 1.72, 0.16, 0.24, stone2);
  if (age >= 3) {
    for (const z of [0.6, 1.4]) for (const x of [0.05, 1.8]) add(`buttress-${x}-${z}`, 1, x, z, 0.16, 0.15, 0.3, wallTop - 0.48, stone2);
    add("roof-ridge", 2, 0.5, 0.3, wallTop + 0.48, 1, 2.2, 0.16, roof, true);
  }
  if (age === 4) {
    add("spire", 4, 2.25, 0.45, towerTop + 0.92, 0.2, 0.3, 0.48, roof);
    add("finial", 4, 2.3, 0.5, towerTop + 1.4, 0.1, 0.2, 0.16, "#c9a55a");
    add("rose-window", 3, 0.84, 2.5, wallTop - 0.46, 0.32, 0.03, 0.32, "#c9a55a");
  }
  add("flag-pole", 4, 0.02, 2.63, 0.16, 0.06, 0.06, 1.6, wood2);
  add("flag", 4, 0.08, 2.63, 1.42, 0.44, 0.05, 0.28, team2);
  if (v.health === 0) return [p[0], ...Array.from({ length: 12 }, (_, i) => ({ id: `debris-${i}`, phase: 0, x: 0.2 + i % 4 * 0.6, z: 0.2 + Math.floor(i / 4) * 0.7, y: 0.16, w: 0.34, d: 0.3, h: 0.12, color: lime2, studs: false }))];
  return p.filter((a) => a.phase <= Math.min(4, Math.floor(v.progress / 20))).filter((a) => v.health >= 50 || !(a.id === "flag" || a.id === "bell" || a.id === "bell-rope" || a.id === "finial"));
}

// apps/web/blacksmith-building.ts
function blacksmithParts(v) {
  if (![1, 2, 3, 4].includes(v.ageVariant) || ![v.progress, v.health].every((n) => Number.isFinite(n) && n >= 0 && n <= 100)) throw Error("\u7121\u6548\u9435\u5320\u92EA\u5916\u89C0");
  const p = [], age = v.ageVariant, team2 = v.red ? "#b85c47" : "#456e87", wood2 = "#94734c", stone2 = "#a9a693", dark2 = "#5d5a52", roof = age === 1 ? "#b8a074" : team2;
  const add = (id, phase, x, z, y, w, d, h, color, studs = false, shape) => p.push({ id, phase, x, z, y, w, d, h, color, studs, ...shape ? { shape } : {} });
  const top = 1.28 + (age >= 3 ? 0.16 : 0);
  add("foundation", 0, -0.15, -0.15, 0, 3, 3, 0.16, "#b3aa8c");
  add("back-wall", 1, 0.1, 0.1, 0.16, 2.5, 0.2, top - 0.16, stone2);
  for (const x of [0.1, 2.4]) add(`side-wall-${x}`, 1, x, 0.3, 0.16, 0.2, 1.5, top - 0.16, stone2);
  for (let level = 0; level < 2; level++) add(`roof-${level}`, 2, -0.05 + level * 0.3, -0.05, top + level * 0.16, 2.9 - level * 0.6, 1.95, 0.16, roof, true);
  add("chimney", 2, 1.75, 0.1, 0.16, 0.5, 0.5, top + 0.9, dark2);
  add("chimney-cap", 3, 1.7, 0.05, top + 1.06, 0.6, 0.6, 0.1, "#4a4740");
  add("hearth", 1, 1.7, 0.62, 0.16, 0.6, 0.4, 0.36, dark2);
  add("hearth-fire", 3, 1.8, 0.7, 0.52, 0.4, 0.25, 0.1, "#e8793c");
  add("stump", 3, 0.95, 1.95, 0.16, 0.36, 0.36, 0.3, wood2);
  add("anvil", 3, 0.88, 1.97, 0.46, 0.5, 0.3, 0.14, "#6b6f6c");
  add("anvil-horn", 3, 1.38, 2.03, 0.5, 0.14, 0.18, 0.08, "#6b6f6c");
  add("tub", 3, 1.7, 2.05, 0.16, 0.42, 0.42, 0.3, wood2);
  add("tub-water", 3, 1.76, 2.11, 0.44, 0.3, 0.3, 0.03, "#6a9297");
  add("rack", 3, 0.3, 0.5, 0.16, 0.15, 1.1, 0.75, wood2);
  for (let i = 0; i < 3; i++) add(`blade-${i}`, 3, 0.28, 0.6 + i * 0.3, 0.3, 0.06, 0.06, 0.7, "#c6cfca");
  if (age >= 2) {
    add("porch-beam", 1, 0.1, 1.75, top - 0.16, 2.5, 0.16, 0.16, wood2);
    for (const x of [0.1, 2.44]) add(`porch-post-${x}`, 1, x, 1.75, 0.16, 0.16, 0.16, top - 0.32, wood2);
  }
  if (age >= 3) for (const x of [-0.05, 2.6]) add(`buttress-${x}`, 1, x, 0.3, 0.16, 0.15, 0.3, top - 0.32, stone2);
  if (age === 4) {
    add("bellows", 4, 2, 0.7, 0.16, 0.3, 0.4, 0.3, "#7a5c40");
    add("ridge-crest", 4, 0.9, 0.4, top + 0.32, 1, 1.2, 0.16, roof, true);
  }
  add("flag-pole", 4, 2.67, 2.63, 0.16, 0.06, 0.06, 1.6, wood2);
  add("flag", 4, 2.24, 2.63, 1.42, 0.44, 0.05, 0.28, team2);
  if (v.health === 0) return [p[0], ...Array.from({ length: 12 }, (_, i) => ({ id: `debris-${i}`, phase: 0, x: 0.2 + i % 4 * 0.6, z: 0.2 + Math.floor(i / 4) * 0.7, y: 0.16, w: 0.34, d: 0.3, h: 0.12, color: stone2, studs: false }))];
  return p.filter((a) => a.phase <= Math.min(4, Math.floor(v.progress / 20))).filter((a) => v.health >= 50 || !(a.id === "flag" || a.id === "hearth-fire" || a.id === "chimney-cap"));
}

// apps/web/defense-building.ts
var check = (v, what) => {
  if (![1, 2, 3, 4].includes(v.ageVariant) || ![v.progress, v.health].every((n) => Number.isFinite(n) && n >= 0 && n <= 100)) throw Error(`\u7121\u6548${what}\u5916\u89C0`);
};
function finish(p, v, debris, keep) {
  if (v.health === 0) return [p[0], ...Array.from({ length: 6 }, (_, i) => ({ id: `debris-${i}`, phase: 0, x: i % 3 * 0.3, z: Math.floor(i / 3) * 0.4, y: 0.12, w: 0.26, d: 0.24, h: 0.1, color: debris, studs: false }))];
  return p.filter((a) => a.phase <= Math.min(4, Math.floor(v.progress / 20))).filter((a) => v.health >= 50 || keep(a.id));
}
function towerParts(v) {
  check(v, "\u7BAD\u5854");
  const p = [], age = v.ageVariant, team2 = v.red ? "#b85c47" : "#456e87", wood2 = "#94734c", stone2 = "#b5b29e", roof = age === 1 ? "#b8a074" : team2;
  const add = (id, phase, x, z, y, w, d, h, color, studs = false) => p.push({ id, phase, x, z, y, w, d, h, color, studs });
  const shaft2 = 1.6 + (age - 1) * 0.24;
  add("foundation", 0, -0.05, -0.05, 0, 1.1, 1.1, 0.12, "#b3aa8c");
  add("shaft", 1, 0.08, 0.08, 0.12, 0.84, 0.84, shaft2 * 0.55, stone2);
  add("shaft-upper", 2, 0.14, 0.14, 0.12 + shaft2 * 0.55, 0.72, 0.72, shaft2 * 0.45, stone2);
  add("door", 1, 0.36, 0.9, 0.12, 0.28, 0.04, 0.4, "#6e5a44");
  add("lookout", 3, 0, 0, 0.12 + shaft2, 1, 1, 0.14, wood2);
  for (const [x, z] of [[0, 0], [0.84, 0], [0, 0.84], [0.84, 0.84]]) add(`post-${x}-${z}`, 3, x, z, 0.26 + shaft2, 0.16, 0.16, 0.36, wood2);
  add("roof", 4, -0.06, -0.06, 0.62 + shaft2, 1.12, 1.12, 0.14, roof, true);
  add("roof-top", 4, 0.2, 0.2, 0.76 + shaft2, 0.6, 0.6, 0.14, roof, true);
  if (age >= 3) for (let i = 0; i < 4; i++) {
    const y = 0.5 + i * 0.3, upper = y >= 0.12 + shaft2 * 0.55;
    add(`slit-${i}`, 2, 0.47, i % 2 ? upper ? 0.12 : 0.1 : upper ? 0.86 : 0.9, y, 0.06, 0.02, 0.2, "#4a4740");
  }
  add("flag", 4, 0.46, 0.46, 0.9 + shaft2, 0.06, 0.06, 0.5, wood2);
  add("pennant", 4, 0.52, 0.46, 1.22 + shaft2, 0.3, 0.04, 0.16, team2);
  return finish(p, v, stone2, (id) => !(id === "pennant" || id === "roof-top" || id === "flag"));
}
function siegeWorkshopParts(v) {
  check(v, "\u653B\u57CE\u5668\u5DE5\u574A");
  const p = [], age = v.ageVariant, team2 = v.red ? "#b85c47" : "#456e87", wood2 = "#94734c", dark2 = "#6e5438", roof = age === 1 ? "#b8a074" : team2;
  const add = (id, phase, x, z, y, w, d, h, color, studs = false) => p.push({ id, phase, x, z, y, w, d, h, color, studs });
  const top = 1.44;
  add("foundation", 0, -0.15, -0.15, 0, 3, 3, 0.16, "#b3aa8c");
  for (const x of [0.1, 2.44]) for (const z of [0.1, 1.65]) add(`post-${x}-${z}`, 1, x, z, 0.16, 0.16, 0.16, top - 0.16, wood2);
  add("back-wall", 1, 0.1, 0.1, 0.16, 2.5, 0.15, top - 0.16, wood2);
  for (let level = 0; level < 2; level++) add(`roof-${level}`, 2, -0.05 + level * 0.35, -0.05, top + level * 0.16, 2.9 - level * 0.7, 1.98, 0.16, roof, true);
  add("ram-bed", 3, 0.5, 0.6, 0.16, 1.6, 0.7, 0.12, dark2);
  add("ram-log", 3, 0.45, 0.8, 0.4, 1.8, 0.3, 0.3, wood2);
  for (const x of [0.6, 1.8]) add(`ram-rib-${x}`, 3, x, 0.6, 0.28, 0.1, 0.7, 0.6, dark2);
  for (let i = 0; i < 3; i++) add(`log-${i}`, 3, 0.3, 2.05 + i * 0.2, 0.16, 1.4, 0.18, 0.18, wood2);
  add("log-top", 3, 0.5, 2.15, 0.34, 1, 0.18, 0.18, wood2);
  add("wheel", 3, 2.1, 2, 0.16, 0.14, 0.6, 0.6, dark2);
  add("wheel-hub", 3, 2.08, 2.2, 0.36, 0.18, 0.2, 0.2, "#c9a55a");
  if (age >= 3) add("crane-arm", 4, 2.2, 0.3, top - 0.1, 0.14, 1.2, 0.14, wood2);
  add("flag-pole", 4, 2.67, 2.63, 0.16, 0.06, 0.06, 1.6, wood2);
  add("flag", 4, 2.24, 2.63, 1.42, 0.44, 0.05, 0.28, team2);
  return finish(p, v, wood2, (id) => !(id === "flag" || id === "crane-arm"));
}

// packages/content/footprints.ts
var obstacleFootprints = {
  house: { x: -15, y: -15, width: 250, depth: 230 },
  // Barracks: solid 3x3 foundation for now; its open front is visual only (no walkable interior).
  barracks: { x: -15, y: -15, width: 300, depth: 300 },
  "town-center": { x: -15, y: -15, width: 300, depth: 300 },
  // Farm: a walkable 2x2 field (no blocking rectangle); its extent still stops other buildings.
  farm: { x: 0, y: 0, width: 200, depth: 200 },
  // Drop-off camps use the 3x3 models (same footprint as the barracks).
  "lumber-camp": { x: -15, y: -15, width: 300, depth: 300 },
  "mining-camp": { x: -15, y: -15, width: 300, depth: 300 },
  mill: { x: -15, y: -15, width: 300, depth: 300 },
  stable: { x: -15, y: -15, width: 300, depth: 300 },
  "archery-range": { x: -15, y: -15, width: 300, depth: 300 },
  monastery: { x: -15, y: -15, width: 300, depth: 300 },
  blacksmith: { x: -15, y: -15, width: 300, depth: 300 },
  "siege-workshop": { x: -15, y: -15, width: 300, depth: 300 },
  // Castle: a solid 4x4 keep (the reference's castle is 4x4).
  castle: { x: -15, y: -15, width: 400, depth: 400 },
  // Watch tower: one tile.
  "watch-tower": { x: 0, y: 0, width: 100, depth: 100 },
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
function check2(o, radius) {
  if (!obstacleFootprints[o.kind] || !Number.isSafeInteger(radius) || radius < 0) throw Error("\u7121\u6548\u5360\u5730\u6216\u534A\u5F91");
}
function obstacleBounds(o, radius = 0) {
  check2(o, radius);
  const f = obstacleFootprints[o.kind];
  return [o.x + f.x - radius, o.y + f.y - radius, o.x + f.x + f.width + radius, o.y + f.y + f.depth + radius];
}
function obstacleRects(o, radius = 0) {
  check2(o, radius);
  if (o.kind === "farm") return [];
  if (o.kind !== "town-center") return [obstacleBounds(o, radius)];
  return townCenterBlocking.map(([x0, y0, x1, y1]) => [o.x + x0 - radius, o.y + y0 - radius, o.x + x1 + radius, o.y + y1 + radius]);
}

// apps/web/castle-building.ts
function castleParts(v) {
  if (![1, 2, 3, 4].includes(v.ageVariant) || ![v.progress, v.health].every((n) => Number.isFinite(n) && n >= 0 && n <= 100)) throw Error("\u7121\u6548\u57CE\u5821\u5916\u89C0");
  const p = [], age = v.ageVariant, team2 = v.red ? "#b85c47" : "#456e87", wood2 = "#94734c", straw = "#b8a074", stone2 = "#b5b29e", dark2 = "#4a4740", oak = "#5a4632";
  const add = (id, phase, x, z, y, w, d, h, color, studs = false, shape) => p.push({ id, phase, x, z, y, w, d, h, color, studs, ...shape ? { shape } : {} });
  const f = obstacleFootprints.castle;
  add("foundation", 0, f.x / 100, f.y / 100, 0, f.width / 100, f.depth / 100, 0.16, "#b3aa8c");
  const wallH = 1.12 + (age >= 3 ? 0.32 : 0), wallTop = 0.16 + wallH, towerTop = wallTop + 0.64, keepTop = 0.16 + [1.6, 1.92, 2.24, 2.24][age - 1];
  const crest = (id, x, z, y, alongX) => age === 1 ? add(`stake-${id}`, 2, x + (alongX ? 0.04 : 0.12), z + (alongX ? 0.12 : 0.04), y, 0.12, 0.12, 0.3, wood2) : add(`merlon-${id}`, 2, x, z, y, alongX ? 0.2 : 0.36, alongX ? 0.36 : 0.2, 0.24, stone2);
  const towers = [[-0.1, -0.1], [2.9, -0.1], [-0.1, 2.9], [2.9, 2.9]];
  for (const [x, z] of towers) {
    const id = `${x}-${z}`;
    add(`tower-${id}`, 1, x, z, 0.16, 0.9, 0.9, towerTop - 0.16, stone2);
    if (age === 1) {
      add(`hoard-${id}`, 2, x - 0.05, z - 0.05, towerTop, 1, 1, 0.3, wood2);
      add(`hoard-roof-${id}`, 2, x + 0.05, z + 0.05, towerTop + 0.3, 0.8, 0.8, 0.16, straw, true);
      add(`hoard-cap-${id}`, 3, x + 0.25, z + 0.25, towerTop + 0.46, 0.4, 0.4, 0.16, straw);
    } else for (const dx of [0, 0.35, 0.7]) for (const dz of [0, 0.35, 0.7]) if (dx !== 0.35 || dz !== 0.35) add(`tmerlon-${id}-${dx}-${dz}`, 2, x + dx, z + dz, towerTop, 0.2, 0.2, 0.24, stone2);
    if (age >= 3) add(`slit-${id}`, 3, x + 0.6, z < 0 ? z - 0.03 : z + 0.9, towerTop - 1, 0.1, 0.03, 0.32, dark2);
    if (age === 4) {
      add(`drum-${id}`, 3, x + 0.2, z + 0.2, towerTop, 0.5, 0.5, 0.32, stone2);
      add(`cone-0-${id}`, 3, x + 0.1, z + 0.1, towerTop + 0.32, 0.7, 0.7, 0.16, team2, true);
      add(`cone-1-${id}`, 3, x + 0.22, z + 0.22, towerTop + 0.48, 0.46, 0.46, 0.16, team2);
      add(`cone-2-${id}`, 4, x + 0.34, z + 0.34, towerTop + 0.64, 0.22, 0.22, 0.2, team2);
    }
  }
  add("wall-back", 1, 0.8, 0.17, 0.16, 2.1, 0.36, wallH, stone2);
  add("wall-left", 1, 0.17, 0.8, 0.16, 0.36, 2.1, wallH, stone2);
  add("wall-right", 1, 3.17, 0.8, 0.16, 0.36, 2.1, wallH, stone2);
  add("wall-front-l", 1, 0.8, 3.17, 0.16, 0.6, 0.36, wallH, stone2);
  add("wall-front-r", 1, 2.3, 3.17, 0.16, 0.6, 0.36, wallH, stone2);
  for (let i = 0; i < 5; i++) {
    const at = 0.9 + i * 0.4;
    crest(`back-${i}`, at, 0.17, wallTop, true);
    crest(`left-${i}`, 0.17, at, wallTop, false);
    crest(`right-${i}`, 3.17, at, wallTop, false);
  }
  for (const x of [0.88, 1.16, 2.36, 2.64]) crest(`front-${x}`, x, 3.17, wallTop, true);
  add("gate-arch", 1, 1.4, 3.1, 0.16, 0.9, 0.5, wallH, stone2, false, "arch");
  add("gate-top", 2, 1.4, 3.1, wallTop, 0.9, 0.5, 0.32, stone2);
  add("portcullis", 3, 1.62, 3.3, 0.16, 0.46, 0.06, 0.76, oak);
  if (age >= 2) for (const x of [1.4, 1.75, 2.1]) add(`gate-merlon-${x}`, 3, x, 3.4, wallTop + 0.32, 0.2, 0.2, 0.24, stone2);
  if (age === 4) for (const x of [1.4, 2.04]) {
    add(`gate-turret-${x}`, 3, x, 3.1, wallTop + 0.32, 0.26, 0.26, 0.4, stone2);
    add(`gate-turret-cap-${x}`, 4, x - 0.02, 3.08, wallTop + 0.72, 0.3, 0.3, 0.12, team2);
  }
  add("keep", 1, 1.25, 1.1, 0.16, 1.2, 1.2, keepTop - 0.16, stone2);
  let crown = keepTop;
  if (age === 1) {
    add("keep-roof-0", 2, 1.2, 1.05, keepTop, 1.3, 1.3, 0.16, straw, true);
    add("keep-roof-1", 2, 1.45, 1.3, keepTop + 0.16, 0.8, 0.8, 0.16, straw, true);
    crown = keepTop + 0.32;
  } else {
    add("keep-parapet", 2, 1.2, 1.05, keepTop, 1.3, 1.3, 0.12, stone2);
    crown = keepTop + 0.12;
    for (const dx of [0, 0.55, 1.1]) for (const dz of [0, 0.55, 1.1]) if (dx !== 0.55 || dz !== 0.55) add(`keep-merlon-${dx}-${dz}`, 2, 1.2 + dx, 1.05 + dz, crown, 0.2, 0.2, 0.24, stone2);
  }
  if (age >= 3) {
    add("keep-turret", 2, 1.55, 1.4, crown, 0.6, 0.6, 0.64, stone2);
    add("keep-turret-cap", 3, 1.5, 1.35, crown + 0.64, 0.7, 0.7, 0.16, team2, true);
    crown += 0.8;
  }
  if (age === 4) {
    add("keep-spire-0", 3, 1.65, 1.5, crown, 0.4, 0.4, 0.16, team2);
    add("keep-spire-1", 4, 1.75, 1.6, crown + 0.16, 0.2, 0.2, 0.2, team2);
    crown += 0.36;
  }
  for (const x of [1.4, 2]) {
    add(`banner-keep-${x}`, 3, x, 2.3, keepTop - 1, 0.3, 0.04, 0.8, team2);
  }
  for (const x of [0, 3]) add(`banner-tower-${x}`, 3, x, 3.8, towerTop - 1.1, 0.3, 0.04, 0.7, team2);
  add("flag-pole", 4, 1.82, 1.67, crown, 0.06, 0.06, 0.9, wood2);
  add("flag", 4, 1.88, 1.67, crown + 0.5, 0.5, 0.05, 0.3, team2);
  if (v.health === 0) return [p[0], ...Array.from({ length: 12 }, (_, i) => ({ id: `debris-${i}`, phase: 0, x: 0.2 + i % 4 * 0.9, z: 0.2 + Math.floor(i / 4) * 1.2, y: 0.16, w: 0.4, d: 0.34, h: 0.12, color: stone2, studs: false }))];
  return p.filter((a) => a.phase <= Math.min(4, Math.floor(v.progress / 20))).filter((a) => v.health >= 50 || !(a.id === "flag" || a.id.startsWith("banner-") || /^(merlon|stake)-.*-[13]$/.test(a.id) || a.id.startsWith("cone-2-") || a.id.startsWith("hoard-cap-")));
}

// apps/web/siege-rig.ts
function createRamRig(T, player, box, material) {
  const root = new T.Group();
  root.name = "siege-ram";
  const team2 = player === 0 ? "#45728c" : "#b25441", wood2 = "#94734c", dark2 = "#6e5438";
  const part = (parent, x, y, z, w, h, d, color) => {
    const m = new T.Mesh(box(w, h, d), material(color));
    m.position.set(x, y, z);
    m.castShadow = true;
    parent.add(m);
    return m;
  };
  part(root, 0, 0.22, 0, 0.76, 0.1, 1.3, dark2);
  for (const x of [-0.36, 0.36]) for (const z of [-0.45, 0.45]) part(root, x, 0, z, 0.1, 0.36, 0.36, "#5c4a36");
  for (const x of [-0.3, 0.3]) part(root, x, 0.32, 0, 0.1, 0.55, 1.2, wood2);
  part(root, 0, 0.86, 0, 0.86, 0.1, 1.36, team2);
  part(root, 0, 0.96, 0, 0.5, 0.1, 1.36, team2);
  const log = new T.Group();
  root.add(log);
  part(log, 0, 0.4, 0.2, 0.24, 0.24, 1.2, "#8a6a45");
  part(log, 0, 0.38, 0.82, 0.3, 0.28, 0.12, "#6b6f6c");
  function pose(kind, time) {
    const t = Number.isFinite(time) ? Math.max(0, time) : 0;
    log.position.z = kind === "attack" ? Math.max(0, Math.sin(t * 8e-3)) * 0.25 : 0;
    root.rotation.x = kind === "walk" ? Math.sin(t * 0.02) * 0.015 : kind === "hit" && t < 300 ? -0.05 * Math.sin(Math.PI * t / 300) : 0;
  }
  return { root, sockets: { leftHand: new T.Group(), rightHand: new T.Group() }, equip: (_) => {
  }, dress: (_) => {
  }, pose };
}

// apps/web/relic-model.ts
var relicParts = [
  { x: -0.17, y: 0, z: -0.13, w: 0.34, d: 0.26, h: 0.08, color: "#6e5438" },
  { x: -0.14, y: 0.08, z: -0.1, w: 0.28, d: 0.2, h: 0.2, color: "#d9bf6f" },
  { x: -0.16, y: 0.28, z: -0.12, w: 0.32, d: 0.24, h: 0.06, color: "#b8964a" },
  { x: -0.03, y: 0.34, z: -0.03, w: 0.06, d: 0.06, h: 0.09, color: "#efe3b8" }
];

// apps/web/tech-icons.ts
var gold = "#d9bf6f";
var wood = "#8a6a45";
var stone = "#cfc7ae";
var habit = "#7a5c40";
var team = "#456e87";
var techIcons = {
  // Redemption: a small house wearing a halo (buildings can change sides).
  redemption: [{ x: 0, y: 0, z: 0, w: 0.8, d: 0.7, h: 0.5, color: stone }, { x: -0.05, y: 0.5, z: -0.05, w: 0.9, d: 0.8, h: 0.14, color: team }, { x: 0.2, y: 0.64, z: 0.15, w: 0.5, d: 0.5, h: 0.12, color: team }, { x: 0.3, y: 0.92, z: 0.25, w: 0.3, d: 0.3, h: 0.05, color: gold }, { x: 0.3, y: 0, z: 0.62, w: 0.2, d: 0.1, h: 0.3, color: wood }],
  // Atonement: a hooded figure under a halo (monks can be converted).
  atonement: [{ x: 0.2, y: 0, z: 0.2, w: 0.4, d: 0.34, h: 0.5, color: habit }, { x: 0.25, y: 0.5, z: 0.24, w: 0.3, d: 0.26, h: 0.24, color: "#dfbb7e" }, { x: 0.2, y: 0.72, z: 0.2, w: 0.4, d: 0.34, h: 0.12, color: habit }, { x: 0.22, y: 0.95, z: 0.22, w: 0.36, d: 0.3, h: 0.05, color: gold }],
  // Sanctity: a shield with a green plus (more hit points).
  sanctity: [{ x: 0.1, y: 0, z: 0.3, w: 0.7, d: 0.12, h: 0.8, color: "#9d885b" }, { x: 0.4, y: 0.15, z: 0.42, w: 0.1, d: 0.04, h: 0.5, color: "#5f9a6a" }, { x: 0.22, y: 0.35, z: 0.42, w: 0.46, d: 0.04, h: 0.1, color: "#5f9a6a" }],
  // Heresy: a staff broken in two (a converted unit is lost instead).
  heresy: [{ x: 0.1, y: 0, z: 0.3, w: 0.1, d: 0.1, h: 0.55, color: wood }, { x: 0.1, y: 0.55, z: 0.3, w: 0.12, d: 0.12, h: 0.1, color: gold }, { x: 0.45, y: 0, z: 0.3, w: 0.55, d: 0.1, h: 0.1, color: wood }, { x: 0.35, y: 0, z: 0.28, w: 0.12, d: 0.14, h: 0.06, color: "#6e5438" }],
  // Illumination: a lantern (faith returns faster).
  illumination: [{ x: 0.25, y: 0, z: 0.25, w: 0.4, d: 0.4, h: 0.08, color: wood }, { x: 0.3, y: 0.08, z: 0.3, w: 0.3, d: 0.3, h: 0.4, color: "#f5dc7a" }, { x: 0.25, y: 0.48, z: 0.25, w: 0.4, d: 0.4, h: 0.08, color: wood }, { x: 0.4, y: 0.56, z: 0.4, w: 0.1, d: 0.1, h: 0.16, color: wood }],
  // Block Printing: a stack of printed pages (a longer reach).
  "block-printing": [{ x: 0, y: 0, z: 0.1, w: 0.8, d: 0.6, h: 0.1, color: "#6e5438" }, { x: 0.05, y: 0.1, z: 0.12, w: 0.7, d: 0.55, h: 0.16, color: "#efe6cc" }, { x: 0.05, y: 0.26, z: 0.12, w: 0.7, d: 0.55, h: 0.06, color: "#6e5438" }, { x: 0.15, y: 0.32, z: 0.2, w: 0.5, d: 0.4, h: 0.12, color: "#efe6cc" }],
  // Theocracy: a stepped tower (one monk rests for the group).
  theocracy: [{ x: 0.1, y: 0, z: 0.1, w: 0.6, d: 0.6, h: 0.35, color: stone }, { x: 0.2, y: 0.35, z: 0.2, w: 0.4, d: 0.4, h: 0.3, color: stone }, { x: 0.28, y: 0.65, z: 0.28, w: 0.24, d: 0.24, h: 0.25, color: team }, { x: 0.35, y: 0.9, z: 0.35, w: 0.1, d: 0.1, h: 0.14, color: gold }],
  // Faith: a bell (one's own units hold firm).
  faith: [{ x: 0.1, y: 0.86, z: 0.3, w: 0.6, d: 0.1, h: 0.1, color: wood }, { x: 0.2, y: 0.2, z: 0.2, w: 0.4, d: 0.3, h: 0.5, color: "#b8964a" }, { x: 0.12, y: 0.1, z: 0.15, w: 0.56, d: 0.4, h: 0.12, color: "#b8964a" }, { x: 0.35, y: 0.7, z: 0.3, w: 0.1, d: 0.1, h: 0.16, color: wood }, { x: 0.36, y: 0, z: 0.3, w: 0.08, d: 0.08, h: 0.1, color: "#6e5438" }],
  // Economic technologies (town centre, lumber camp, mining camp, mill).
  // Loom: a frame with coloured threads (villagers +15 hit points).
  loom: [{ x: 0.05, y: 0, z: 0.3, w: 0.1, d: 0.1, h: 0.8, color: wood }, { x: 0.75, y: 0, z: 0.3, w: 0.1, d: 0.1, h: 0.8, color: wood }, { x: 0.05, y: 0.72, z: 0.3, w: 0.8, d: 0.1, h: 0.08, color: wood }, { x: 0.15, y: 0.15, z: 0.32, w: 0.6, d: 0.06, h: 0.5, color: "#c9b27a" }, { x: 0.2, y: 0.25, z: 0.36, w: 0.5, d: 0.04, h: 0.08, color: team }, { x: 0.2, y: 0.45, z: 0.36, w: 0.5, d: 0.04, h: 0.08, color: "#b25441" }],
  // Wheelbarrow: a tray on one wheel with two handles (villagers carry more).
  wheelbarrow: [{ x: 0.2, y: 0.25, z: 0.2, w: 0.5, d: 0.45, h: 0.25, color: wood }, { x: 0.05, y: 0.1, z: 0.3, w: 0.14, d: 0.25, h: 0.14, color: "#5c4a36" }, { x: 0.7, y: 0.3, z: 0.25, w: 0.25, d: 0.06, h: 0.06, color: wood }, { x: 0.7, y: 0.3, z: 0.55, w: 0.25, d: 0.06, h: 0.06, color: wood }, { x: 0.3, y: 0.5, z: 0.25, w: 0.3, d: 0.35, h: 0.08, color: "#c9b27a" }],
  // Hand Cart: a bigger box on two wheels.
  "hand-cart": [{ x: 0.1, y: 0.25, z: 0.15, w: 0.7, d: 0.6, h: 0.3, color: wood }, { x: 0.2, y: 0, z: 0.05, w: 0.25, d: 0.1, h: 0.25, color: "#5c4a36" }, { x: 0.2, y: 0, z: 0.7, w: 0.25, d: 0.1, h: 0.25, color: "#5c4a36" }, { x: 0.2, y: 0.55, z: 0.25, w: 0.5, d: 0.4, h: 0.12, color: "#c9b27a" }, { x: 0.8, y: 0.35, z: 0.4, w: 0.2, d: 0.1, h: 0.06, color: wood }],
  // Double-Bit Axe: a handle with a blade on both sides.
  "double-bit-axe": [{ x: 0.4, y: 0, z: 0.4, w: 0.08, d: 0.08, h: 0.85, color: wood }, { x: 0.15, y: 0.6, z: 0.38, w: 0.25, d: 0.12, h: 0.22, color: "#aab0a3" }, { x: 0.48, y: 0.6, z: 0.38, w: 0.25, d: 0.12, h: 0.22, color: "#aab0a3" }],
  // Bow Saw: a curved frame with a blade.
  "bow-saw": [{ x: 0.05, y: 0.1, z: 0.4, w: 0.8, d: 0.08, h: 0.05, color: "#c6cfca" }, { x: 0.05, y: 0.1, z: 0.4, w: 0.08, d: 0.08, h: 0.45, color: wood }, { x: 0.77, y: 0.1, z: 0.4, w: 0.08, d: 0.08, h: 0.45, color: wood }, { x: 0.1, y: 0.52, z: 0.4, w: 0.7, d: 0.08, h: 0.08, color: wood }],
  // Two-Man Saw: a long blade with a handle at each end.
  "two-man-saw": [{ x: 0.12, y: 0.3, z: 0.4, w: 0.76, d: 0.06, h: 0.12, color: "#c6cfca" }, { x: 0, y: 0.2, z: 0.38, w: 0.12, d: 0.1, h: 0.35, color: wood }, { x: 0.88, y: 0.2, z: 0.38, w: 0.12, d: 0.1, h: 0.35, color: wood }],
  // Gold Mining: a pick over a gold nugget; Gold Shaft Mining: a shaft frame over it.
  "gold-mining": [{ x: 0.2, y: 0, z: 0.25, w: 0.5, d: 0.45, h: 0.25, color: "#dec36f" }, { x: 0.42, y: 0.25, z: 0.42, w: 0.07, d: 0.07, h: 0.6, color: wood }, { x: 0.2, y: 0.8, z: 0.42, w: 0.5, d: 0.07, h: 0.07, color: "#aab0a3" }],
  "gold-shaft-mining": [{ x: 0.2, y: 0, z: 0.25, w: 0.5, d: 0.45, h: 0.25, color: "#dec36f" }, { x: 0.1, y: 0, z: 0.15, w: 0.08, d: 0.08, h: 0.85, color: wood }, { x: 0.72, y: 0, z: 0.15, w: 0.08, d: 0.08, h: 0.85, color: wood }, { x: 0.1, y: 0.85, z: 0.15, w: 0.7, d: 0.08, h: 0.08, color: wood }, { x: 0.42, y: 0.4, z: 0.18, w: 0.04, d: 0.04, h: 0.45, color: "#80674f" }],
  // Stone Mining and Stone Shaft Mining: the same with a stone block.
  "stone-mining": [{ x: 0.2, y: 0, z: 0.25, w: 0.5, d: 0.45, h: 0.25, color: stone }, { x: 0.42, y: 0.25, z: 0.42, w: 0.07, d: 0.07, h: 0.6, color: wood }, { x: 0.2, y: 0.8, z: 0.42, w: 0.5, d: 0.07, h: 0.07, color: "#aab0a3" }],
  "stone-shaft-mining": [{ x: 0.2, y: 0, z: 0.25, w: 0.5, d: 0.45, h: 0.25, color: stone }, { x: 0.1, y: 0, z: 0.15, w: 0.08, d: 0.08, h: 0.85, color: wood }, { x: 0.72, y: 0, z: 0.15, w: 0.08, d: 0.08, h: 0.85, color: wood }, { x: 0.1, y: 0.85, z: 0.15, w: 0.7, d: 0.08, h: 0.08, color: wood }, { x: 0.42, y: 0.4, z: 0.18, w: 0.04, d: 0.04, h: 0.45, color: "#80674f" }],
  // Horse Collar: a padded U; Heavy Plow: a plough blade on a beam; Crop Rotation: three fields of different crops.
  "horse-collar": [{ x: 0.15, y: 0, z: 0.4, w: 0.14, d: 0.14, h: 0.7, color: "#7a5c40" }, { x: 0.61, y: 0, z: 0.4, w: 0.14, d: 0.14, h: 0.7, color: "#7a5c40" }, { x: 0.15, y: 0.6, z: 0.4, w: 0.6, d: 0.14, h: 0.16, color: "#7a5c40" }, { x: 0.25, y: 0.1, z: 0.42, w: 0.4, d: 0.1, h: 0.08, color: gold }],
  "heavy-plow": [{ x: 0.05, y: 0.35, z: 0.4, w: 0.8, d: 0.1, h: 0.1, color: wood }, { x: 0.6, y: 0, z: 0.35, w: 0.25, d: 0.2, h: 0.35, color: "#aab0a3" }, { x: 0.05, y: 0.45, z: 0.4, w: 0.08, d: 0.1, h: 0.3, color: wood }],
  "crop-rotation": [{ x: 0, y: 0, z: 0.05, w: 0.9, d: 0.25, h: 0.12, color: "#9bb65a" }, { x: 0, y: 0, z: 0.33, w: 0.9, d: 0.25, h: 0.12, color: "#d9c26a" }, { x: 0, y: 0, z: 0.61, w: 0.9, d: 0.25, h: 0.12, color: "#806b49" }, { x: 0.1, y: 0.12, z: 0.1, w: 0.7, d: 0.15, h: 0.1, color: "#7e985f" }]
};
var metal = ["#9a8c78", "#aab0a3", "#d8dcd6"];
var band = (level) => Array.from({ length: level }, (_, i) => ({ x: 0.15 + i * 0.25, y: 0, z: 0.75, w: 0.18, d: 0.1, h: 0.08, color: gold }));
var hammer = (l) => [{ x: 0.42, y: 0.1, z: 0.4, w: 0.08, d: 0.08, h: 0.75, color: wood }, { x: 0.25, y: 0.7, z: 0.34, w: 0.42, d: 0.2, h: 0.18, color: metal[l - 1] }, ...band(l)];
var mail = (l) => [{ x: 0.2, y: 0.1, z: 0.35, w: 0.5, d: 0.2, h: 0.55, color: metal[l - 1] }, { x: 0.1, y: 0.5, z: 0.35, w: 0.7, d: 0.2, h: 0.15, color: metal[l - 1] }, { x: 0.35, y: 0.65, z: 0.35, w: 0.2, d: 0.2, h: 0.1, color: "#6e5438" }, ...band(l)];
var barding = (l) => [{ x: 0.1, y: 0.15, z: 0.35, w: 0.7, d: 0.3, h: 0.3, color: metal[l - 1] }, { x: 0.65, y: 0.35, z: 0.35, w: 0.2, d: 0.3, h: 0.35, color: metal[l - 1] }, { x: 0.12, y: 0.45, z: 0.38, w: 0.5, d: 0.24, h: 0.08, color: team }, ...band(l)];
var arrows = (l) => [...[0, 1, 2].map((i) => ({ x: 0.2 + i * 0.2, y: 0.1, z: 0.4, w: 0.05, d: 0.05, h: 0.65, color: wood })), ...[0, 1, 2].map((i) => ({ x: 0.17 + i * 0.2, y: 0.75, z: 0.37, w: 0.11, d: 0.11, h: 0.12, color: metal[l - 1] })), ...band(l)];
var vest = (l) => [{ x: 0.2, y: 0.1, z: 0.35, w: 0.5, d: 0.2, h: 0.5, color: ["#b89a6a", "#8a6a45", "#aab0a3"][l - 1] }, { x: 0.25, y: 0.2, z: 0.33, w: 0.4, d: 0.04, h: 0.06, color: "#6e5438" }, { x: 0.25, y: 0.4, z: 0.33, w: 0.4, d: 0.04, h: 0.06, color: "#6e5438" }, ...band(l)];
for (const [line, make] of [[["forging", "iron-casting", "blast-furnace"], hammer], [["scale-mail-armor", "chain-mail-armor", "plate-mail-armor"], mail], [["scale-barding-armor", "chain-barding-armor", "plate-barding-armor"], barding], [["fletching", "bodkin-arrow", "bracer"], arrows], [["padded-archer-armor", "leather-archer-armor", "ring-archer-armor"], vest]])
  line.forEach((id, i) => {
    techIcons[id] = make(i + 1);
  });
var metal2 = "#aab0a3";
var dark = "#4a4740";
var green = "#5f9a6a";
var grey = "#8d8c86";
var felt = "#ece6d6";
var sand = "#d8c9a6";
var red = "#b25441";
var plus = (x, y) => [{ x: x + 0.09, y, z: 0.42, w: 0.08, d: 0.04, h: 0.26, color: green }, { x, y: y + 0.09, z: 0.42, w: 0.26, d: 0.04, h: 0.08, color: green }];
var streaks = (x, y) => [0, 1, 2].map((i) => ({ x: x - i * 0.04, y: y + i * 0.14, z: 0.45, w: 0.18 + i * 0.06, d: 0.04, h: 0.05, color: "#efe6cc" }));
var shaft = (x, y, len) => [{ x, y, z: 0.45, w: len, d: 0.04, h: 0.04, color: wood }, { x: x + len, y: y - 0.02, z: 0.44, w: 0.08, d: 0.06, h: 0.08, color: metal2 }];
var merlons = (x, y, n, w = 0.14) => Array.from({ length: n }, (_, i) => ({ x: x + i * w * 2, y, z: 0.3, w, d: 0.36, h: 0.12, color: stone }));
Object.assign(techIcons, {
  // Yeomen: a tall longbow beside a tower top (archer range and tower attack).
  yeomen: [{ x: 0, y: 0, z: 0.3, w: 0.45, d: 0.4, h: 0.6, color: stone }, ...merlons(0, 0.6, 2, 0.12), ...[[0, 0], [0.06, 0.18], [0.09, 0.36], [0.06, 0.54], [0, 0.72]].map(([dx, y]) => ({ x: 0.7 + dx, y, z: 0.4, w: 0.06, d: 0.06, h: 0.2, color: wood })), { x: 0.66, y: 0, z: 0.42, w: 0.02, d: 0.02, h: 0.92, color: "#d9cba4" }],
  // Stronghold: a castle tower loosing arrows in quick succession.
  stronghold: [{ x: 0, y: 0, z: 0.25, w: 0.5, d: 0.5, h: 0.75, color: stone }, ...merlons(0, 0.75, 2), { x: 0.18, y: 0.35, z: 0.74, w: 0.12, d: 0.02, h: 0.2, color: dark }, ...shaft(0.55, 0.62, 0.3), ...shaft(0.55, 0.42, 0.3), ...shaft(0.55, 0.22, 0.3)],
  // Furor Celtica: a ram on its wheels under a green plus (siege hit points).
  "furor-celtica": [{ x: 0, y: 0.12, z: 0.3, w: 0.9, d: 0.3, h: 0.18, color: wood }, { x: 0.1, y: 0, z: 0.25, w: 0.18, d: 0.4, h: 0.18, color: "#5c4a36" }, { x: 0.62, y: 0, z: 0.25, w: 0.18, d: 0.4, h: 0.18, color: "#5c4a36" }, { x: 0.85, y: 0.12, z: 0.32, w: 0.12, d: 0.26, h: 0.18, color: metal2 }, ...plus(0.32, 0.45)],
  // Chivalry: a horseshoe with gold nails and speed streaks (faster stable).
  chivalry: [{ x: 0.1, y: 0, z: 0.1, w: 0.16, d: 0.7, h: 0.14, color: metal2 }, { x: 0.64, y: 0, z: 0.1, w: 0.16, d: 0.7, h: 0.14, color: metal2 }, { x: 0.1, y: 0, z: 0.1, w: 0.7, d: 0.16, h: 0.14, color: metal2 }, ...[0.14, 0.68].flatMap((x) => [0.35, 0.6].map((z) => ({ x: x + 0.04, y: 0.14, z, w: 0.06, d: 0.06, h: 0.04, color: gold }))), ...streaks(0.2, 0.3).map((p) => ({ ...p, y: 0, z: 0.85 + (p.y - 0.3) / 0.7, h: 0.04 }))],
  // Bearded Axe: the francisca in flight, its path drawn out behind it (longer throw).
  "bearded-axe": [{ x: 0.52, y: 0, z: 0.42, w: 0.08, d: 0.08, h: 0.8, color: wood }, { x: 0.6, y: 0.56, z: 0.41, w: 0.3, d: 0.1, h: 0.2, color: metal2 }, { x: 0.74, y: 0.38, z: 0.41, w: 0.16, d: 0.1, h: 0.2, color: metal2 }, { x: 0.44, y: 0.64, z: 0.41, w: 0.08, d: 0.1, h: 0.1, color: metal2 }, ...[0, 1, 2].map((i) => ({ x: 0.02 + i * 0.14, y: 0.3 + i * 0.12, z: 0.44, w: 0.1, d: 0.04, h: 0.05, color: "#efe6cc" }))],
  // Anarchy: a barracks arch with a Huskarl's round shield in the doorway.
  anarchy: [{ x: 0, y: 0, z: 0.2, w: 0.18, d: 0.4, h: 0.7, color: stone }, { x: 0.72, y: 0, z: 0.2, w: 0.18, d: 0.4, h: 0.7, color: stone }, { x: 0, y: 0.7, z: 0.2, w: 0.9, d: 0.4, h: 0.16, color: red }, { x: 0.27, y: 0.08, z: 0.52, w: 0.36, d: 0.05, h: 0.5, color: team }, { x: 0.2, y: 0.15, z: 0.52, w: 0.5, d: 0.05, h: 0.36, color: team }, { x: 0.4, y: 0.28, z: 0.57, w: 0.1, d: 0.03, h: 0.1, color: gold }],
  // Perfusion: two helmets side by side (twice the training speed).
  perfusion: [0, 0.46].flatMap((x) => [{ x: x + 0.06, y: 0, z: 0.35, w: 0.26, d: 0.2, h: 0.2, color: "#44514b" }, { x: x + 0.02, y: 0.2, z: 0.33, w: 0.34, d: 0.24, h: 0.3, color: team }, { x: x + 0.07, y: 0.5, z: 0.35, w: 0.24, d: 0.2, h: 0.2, color: "#dfbb7e" }, { x: x + 0.04, y: 0.7, z: 0.33, w: 0.3, d: 0.24, h: 0.08, color: metal2 }, { x: x + 0.36, y: 0.1, z: 0.42, w: 0.04, d: 0.04, h: 0.66, color: wood }]),
  // Ironclad: a ram under riveted iron plates (siege melee armour).
  ironclad: [{ x: 0, y: 0, z: 0.3, w: 0.9, d: 0.3, h: 0.2, color: wood }, { x: 0.05, y: 0.2, z: 0.25, w: 0.8, d: 0.4, h: 0.14, color: metal2 }, { x: 0.15, y: 0.34, z: 0.3, w: 0.6, d: 0.3, h: 0.14, color: "#8f9896" }, ...[0.15, 0.4, 0.65].map((x) => ({ x, y: 0.24, z: 0.65, w: 0.06, d: 0.02, h: 0.06, color: gold }))],
  // Crenellations: a crenellated wall with a helmeted defender between the merlons.
  crenellations: [{ x: 0, y: 0, z: 0.3, w: 0.9, d: 0.36, h: 0.45, color: stone }, { x: 0, y: 0.45, z: 0.3, w: 0.16, d: 0.36, h: 0.2, color: stone }, { x: 0.74, y: 0.45, z: 0.3, w: 0.16, d: 0.36, h: 0.2, color: stone }, { x: 0.34, y: 0.45, z: 0.38, w: 0.22, d: 0.2, h: 0.16, color: "#dfbb7e" }, { x: 0.32, y: 0.61, z: 0.36, w: 0.26, d: 0.24, h: 0.1, color: metal2 }, ...shaft(0.55, 0.72, 0.3)],
  // Chieftains: a helmet crowned with a gold circlet over a spear (infantry against horsemen).
  chieftains: [{ x: 0.1, y: 0.05, z: 0.44, w: 0.8, d: 0.04, h: 0.04, color: wood }, { x: 0.86, y: 0.03, z: 0.43, w: 0.12, d: 0.06, h: 0.08, color: metal2 }, { x: 0.25, y: 0.2, z: 0.3, w: 0.4, d: 0.38, h: 0.3, color: metal2 }, { x: 0.23, y: 0.42, z: 0.28, w: 0.44, d: 0.42, h: 0.06, color: gold }, ...[0.25, 0.43, 0.61].map((x) => ({ x, y: 0.48, z: 0.45, w: 0.04, d: 0.04, h: 0.12, color: gold }))],
  // Berserkergang: a wolf-pelt hood with a green plus (faster regeneration).
  berserkergang: [{ x: 0.1, y: 0, z: 0.3, w: 0.5, d: 0.4, h: 0.45, color: "#8a8272" }, { x: 0.2, y: 0.2, z: 0.7, w: 0.3, d: 0.1, h: 0.15, color: "#8a8272" }, { x: 0.12, y: 0.45, z: 0.35, w: 0.1, d: 0.1, h: 0.14, color: "#8a8272" }, { x: 0.48, y: 0.45, z: 0.35, w: 0.1, d: 0.1, h: 0.14, color: "#8a8272" }, { x: 0.22, y: 0.3, z: 0.7, w: 0.06, d: 0.02, h: 0.04, color: dark }, { x: 0.42, y: 0.3, z: 0.7, w: 0.06, d: 0.02, h: 0.04, color: dark }, ...plus(0.64, 0.5)],
  // Logistica: a hoof over scattered bricks (trample damage around the target).
  logistica: [{ x: 0.3, y: 0.18, z: 0.3, w: 0.3, d: 0.3, h: 0.5, color: "#6f5a44" }, { x: 0.26, y: 0.1, z: 0.26, w: 0.38, d: 0.38, h: 0.1, color: metal2 }, ...[[0, 0], [0.75, 0.05], [0.05, 0.6], [0.72, 0.62]].map(([x, z]) => ({ x, y: 0, z, w: 0.16, d: 0.14, h: 0.1, color: stone }))],
  // Kamandaran: a bow over a stack of logs (archers paid in wood).
  kamandaran: [...[0, 1, 2].map((i) => ({ x: 0.05, y: i * 0.14, z: 0.3 + i % 2 * 0.04, w: 0.8, d: 0.14, h: 0.14, color: i === 1 ? "#6e5438" : wood })), ...[[0, 0], [0.05, 0.14], [0.07, 0.28], [0.05, 0.42], [0, 0.56]].map(([dx, y]) => ({ x: 0.4 + dx, y: 0.42 + y * 0.6, z: 0.5, w: 0.06, d: 0.06, h: 0.14, color: "#997447" })), { x: 0.38, y: 0.42, z: 0.52, w: 0.02, d: 0.02, h: 0.46, color: "#d9cba4" }],
  // Mahouts: an elephant's head with tusks and speed streaks.
  mahouts: [{ x: 0.25, y: 0.3, z: 0.25, w: 0.5, d: 0.45, h: 0.5, color: grey }, { x: 0.05, y: 0.35, z: 0.35, w: 0.2, d: 0.08, h: 0.45, color: "#9a988f" }, { x: 0.75, y: 0.35, z: 0.35, w: 0.2, d: 0.08, h: 0.45, color: "#9a988f" }, { x: 0.28, y: 0.8, z: 0.3, w: 0.44, d: 0.36, h: 0.08, color: gold }, { x: 0.42, y: 0.12, z: 0.7, w: 0.16, d: 0.14, h: 0.4, color: grey }, { x: 0.43, y: 0, z: 0.78, w: 0.14, d: 0.18, h: 0.12, color: grey }, { x: 0.28, y: 0.3, z: 0.7, w: 0.07, d: 0.24, h: 0.07, color: "#efe8d2" }, { x: 0.65, y: 0.3, z: 0.7, w: 0.07, d: 0.24, h: 0.07, color: "#efe8d2" }, ...streaks(0.08, 0.4).map((p) => ({ ...p, z: 0.05 }))],
  // Madrasah: a domed hall over a gold coin (gold back when a monk falls).
  madrasah: [{ x: 0.05, y: 0, z: 0.25, w: 0.6, d: 0.5, h: 0.35, color: sand }, { x: 0.1, y: 0.35, z: 0.3, w: 0.5, d: 0.4, h: 0.12, color: felt }, { x: 0.18, y: 0.47, z: 0.36, w: 0.34, d: 0.28, h: 0.1, color: felt }, { x: 0.28, y: 0.57, z: 0.42, w: 0.14, d: 0.14, h: 0.08, color: felt }, { x: 0.33, y: 0.65, z: 0.47, w: 0.04, d: 0.04, h: 0.12, color: gold }, { x: 0.68, y: 0, z: 0.4, w: 0.26, d: 0.26, h: 0.08, color: gold }, { x: 0.72, y: 0.08, z: 0.44, w: 0.18, d: 0.18, h: 0.06, color: "#dec36f" }],
  // Zealotry: a camel with a green plus (camel and Mameluke hit points).
  zealotry: [{ x: 0.1, y: 0.3, z: 0.35, w: 0.6, d: 0.3, h: 0.25, color: sand }, { x: 0.3, y: 0.55, z: 0.38, w: 0.2, d: 0.24, h: 0.14, color: sand }, { x: 0.66, y: 0.4, z: 0.4, w: 0.1, d: 0.2, h: 0.4, color: sand }, { x: 0.66, y: 0.8, z: 0.38, w: 0.22, d: 0.24, h: 0.1, color: sand }, ...[0.14, 0.56].map((x) => ({ x, y: 0, z: 0.4, w: 0.08, d: 0.12, h: 0.3, color: "#b8a074" })), { x: 0.14, y: 0.52, z: 0.33, w: 0.52, d: 0.34, h: 0.04, color: team }, ...plus(0, 0.62)],
  // Great Wall: a long crenellated wall climbing to a watch tower (tougher walls and towers).
  "great-wall": [{ x: 0, y: 0, z: 0.35, w: 0.62, d: 0.28, h: 0.3, color: stone }, ...merlons(0, 0.3, 3, 0.11), { x: 0.62, y: 0, z: 0.28, w: 0.34, d: 0.42, h: 0.7, color: stone }, { x: 0.58, y: 0.7, z: 0.24, w: 0.42, d: 0.5, h: 0.1, color: "#3f4a4c" }, { x: 0.7, y: 0.8, z: 0.36, w: 0.18, d: 0.26, h: 0.1, color: "#3f4a4c" }],
  // Rocketry: a bolt carrying a red powder tube with flame at its tail.
  rocketry: [{ x: 0.05, y: 0.4, z: 0.45, w: 0.8, d: 0.05, h: 0.05, color: wood }, { x: 0.85, y: 0.38, z: 0.43, w: 0.1, d: 0.09, h: 0.09, color: metal2 }, { x: 0.3, y: 0.36, z: 0.41, w: 0.3, d: 0.13, h: 0.13, color: red }, { x: 0.1, y: 0.37, z: 0.42, w: 0.2, d: 0.11, h: 0.11, color: "#e0a040" }, { x: 0, y: 0.39, z: 0.44, w: 0.1, d: 0.07, h: 0.07, color: "#f5dc7a" }],
  // Yasama: a watch tower with three arrows fanning out (extra arrows).
  yasama: [{ x: 0, y: 0, z: 0.3, w: 0.4, d: 0.4, h: 0.7, color: stone }, { x: -0.04, y: 0.7, z: 0.26, w: 0.48, d: 0.48, h: 0.1, color: "#3f4a4c" }, ...shaft(0.45, 0.75, 0.35), ...shaft(0.45, 0.5, 0.35), ...shaft(0.45, 0.25, 0.35)],
  // Nomads: a round felt yurt with a team band (houses keep their population room).
  nomads: [{ x: 0.1, y: 0, z: 0.2, w: 0.7, d: 0.6, h: 0.35, color: felt }, { x: 0.05, y: 0.25, z: 0.15, w: 0.8, d: 0.7, h: 0.06, color: team }, { x: 0.18, y: 0.35, z: 0.28, w: 0.54, d: 0.44, h: 0.12, color: felt }, { x: 0.32, y: 0.47, z: 0.4, w: 0.26, d: 0.2, h: 0.08, color: felt }, { x: 0.38, y: 0, z: 0.8, w: 0.14, d: 0.02, h: 0.22, color: "#6e5438" }],
  // Drill: a siege wheel with speed streaks (faster siege).
  drill: [{ x: 0.2, y: 0, z: 0.4, w: 0.5, d: 0.12, h: 0.5, color: "#6e5438" }, { x: 0.35, y: 0.15, z: 0.52, w: 0.2, d: 0.04, h: 0.2, color: gold }, { x: 0.12, y: 0.5, z: 0.35, w: 0.66, d: 0.2, h: 0.1, color: wood }, ...streaks(0.84, 0.05)]
});

// apps/web/unit-rig.ts
var unitPoses = ["idle", "walk", "work", "attack", "hit", "death", "carry"];
var unitTools = ["none", "axe", "pick", "sickle", "hammer", "basket", "sword", "spear", "bow", "staff", "longbow", "repeater", "musket", "throwing-axe", "great-sword", "war-axe", "katana", "scimitar"];
var unitRoles = ["villager", "swordsman", "spearman", "archer", "monk", "longbowman", "woad-raider", "throwing-axeman", "huskarl", "teutonic-knight", "berserk", "samurai", "janissary", "chu-ko-nu", "cataphract-rider", "mameluke-rider", "mangudai-rider", "mahout"];
var roleTools = { swordsman: "sword", spearman: "spear", archer: "bow", monk: "staff", longbowman: "longbow", "woad-raider": "sword", "throwing-axeman": "throwing-axe", huskarl: "sword", "teutonic-knight": "great-sword", berserk: "war-axe", samurai: "katana", janissary: "musket", "chu-ko-nu": "repeater", "cataphract-rider": "spear", "mameluke-rider": "scimitar", "mangudai-rider": "bow", mahout: "spear" };
var skin = "#dfbb7e";
var metal3 = "#9aa3a1";
var leather = "#5a4632";
var fur = "#7d6a52";
var gold2 = "#c9a55a";
var woad = "#3f5f95";
var lacquer = "#3a3530";
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
    p.leftLeg = walk;
    p.rightLeg = -walk;
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
  const team2 = player === 0 ? "#45728c" : "#b25441";
  function joint(name, x, y, z) {
    const group = new T.Group();
    group.name = name;
    group.position.set(x, y, z);
    root.add(group);
    return group;
  }
  const leftLeg = joint("hip-left", -0.12, 0.3, 0), rightLeg = joint("hip-right", 0.12, 0.3, 0);
  for (const leg of [leftLeg, rightLeg]) part(leg, 0, -0.3, 0, 0.19, 0.3, 0.24, "#44514b");
  part(root, 0, 0.3, 0, 0.46, 0.4, 0.32, team2);
  part(root, 0, 0.71, 0, 0.34, 0.3, 0.3, "#dfbb7e");
  part(root, 0, 1.02, 0, 0.44, 0.11, 0.4, player === 0 ? "#cbbc94" : "#835243");
  for (const dx of [-0.075, 0.075]) part(root, dx, 0.86, 0.155, 0.035, 0.04, 0.018, "#3e3a2e");
  const leftArm = joint("shoulder-left", -0.19, 0.67, 0), rightArm = joint("shoulder-right", 0.19, 0.67, 0);
  const sockets = { leftHand: new T.Group(), rightHand: new T.Group() };
  for (const [arm, socket, name] of [[leftArm, sockets.leftHand, "hand-left"], [rightArm, sockets.rightHand, "hand-right"]]) {
    part(arm, 0, -0.28, 0, 0.1, 0.28, 0.16, team2);
    part(arm, 0, -0.38, 0, 0.1, 0.14, 0.17, "#dfbb7e");
    socket.name = name;
    socket.position.set(0, -0.31, 0.09);
    arm.add(socket);
  }
  let seated = false;
  const outfits = /* @__PURE__ */ new Map();
  function dress(role) {
    if (!unitRoles.includes(role)) throw Error("\u672A\u77E5\u6A21\u578B\u8ECD\u7A2E");
    for (const outfit2 of outfits.values()) for (const g of outfit2) g.visible = false;
    shield.visible = false;
    if (role === "villager") {
      equip("none");
      return;
    }
    let outfit = outfits.get(role);
    if (!outfit) {
      const o = new T.Group(), la = new T.Group(), ra = new T.Group();
      o.name = `outfit-${role}`;
      la.name = `outfit-${role}-arm-left`;
      ra.name = `outfit-${role}-arm-right`;
      root.add(o);
      leftArm.add(la);
      rightArm.add(ra);
      outfit = [o, la, ra];
      outfits.set(role, outfit);
      const arms = (x, y, z, w, h, d, color) => {
        for (const a of [la, ra]) part(a, x, y, z, w, h, d, color);
      };
      if (role === "monk") {
        const habit2 = "#7a5c40";
        part(o, 0, 0.3, 0, 0.5, 0.42, 0.36, habit2);
        part(o, 0, 0.06, 0, 0.44, 0.26, 0.34, habit2);
        for (const x of [-0.09, 0.09]) part(o, x, 0.34, 0.185, 0.07, 0.38, 0.02, team2);
        part(o, 0, 0.36, 0, 0.52, 0.04, 0.38, "#d8c48a");
        part(o, 0, 0.99, -0.01, 0.47, 0.14, 0.43, habit2);
        part(o, 0, 0.74, -0.17, 0.4, 0.3, 0.06, habit2);
      } else if (role === "archer") {
        part(o, 0, 1.1, 0, 0.36, 0.13, 0.32, "#667c4e");
        part(o, 0, 0.36, -0.24, 0.21, 0.43, 0.18, "#8b6746");
        for (const x of [-0.06, 0.06]) part(o, x, 0.77, -0.24, 0.025, 0.2, 0.025, "#d3b981");
      } else if (role === "longbowman") {
        part(o, 0, 1.1, 0, 0.54, 0.05, 0.5, "#6d5a3e");
        part(o, 0, 1.15, 0, 0.3, 0.13, 0.28, "#6d5a3e");
        part(o, 0, 0.42, 0, 0.48, 0.05, 0.34, leather);
        part(o, 0.08, 0.3, -0.23, 0.15, 0.6, 0.13, "#8b6746");
        for (const x of [0.04, 0.12]) part(o, x, 0.9, -0.23, 0.03, 0.18, 0.03, "#e8e0c8");
      } else if (role === "chu-ko-nu") {
        part(o, 0, 0.42, 0, 0.48, 0.28, 0.34, "#5b4a3a");
        part(o, 0, 0.66, 0, 0.3, 0.04, 0.35, gold2);
        part(o, 0, 1.1, 0, 0.34, 0.08, 0.3, lacquer);
        part(o, 0, 1.18, -0.02, 0.12, 0.1, 0.12, lacquer);
      } else if (role === "janissary") {
        part(o, 0, 1.1, -0.02, 0.32, 0.36, 0.3, "#ece6d6");
        part(o, 0, 0.96, -0.2, 0.28, 0.4, 0.06, "#ece6d6");
        part(o, 0, 1.1, 0, 0.34, 0.06, 0.34, gold2);
        part(o, 0, 0.42, 0, 0.48, 0.07, 0.34, gold2);
      } else if (role === "woad-raider") {
        part(o, 0, 0.44, 0, 0.475, 0.27, 0.335, skin);
        for (const y of [0.5, 0.6]) part(o, 0, y, 0, 0.48, 0.04, 0.34, woad);
        part(o, 0, 0.42, 0, 0.49, 0.04, 0.345, leather);
        part(o, 0, 0.8, 0.15, 0.3, 0.04, 0.012, woad);
        part(o, 0, 1.1, 0, 0.4, 0.1, 0.36, "#ece6d2");
        for (const x of [-0.12, 0, 0.12]) part(o, x, 1.2, 0, 0.08, 0.14, 0.08, "#ece6d2");
        arms(0, -0.3, 0, 0.12, 0.31, 0.18, skin);
        arms(0, -0.2, 0, 0.125, 0.04, 0.185, woad);
      } else if (role === "throwing-axeman") {
        part(o, 0, 1.02, -0.03, 0.46, 0.14, 0.44, "#9a5a30");
        part(o, 0, 0.76, -0.2, 0.36, 0.3, 0.06, "#9a5a30");
        part(o, 0, 0.79, 0.155, 0.2, 0.04, 0.02, "#9a5a30");
        part(o, 0, 0.64, -0.02, 0.52, 0.08, 0.38, "#a08a68");
        part(o, 0, 0.42, 0, 0.48, 0.05, 0.34, leather);
        for (const x of [-0.26, 0.26]) {
          part(o, x, 0.26, 0.06, 0.04, 0.22, 0.04, "#967447");
          part(o, x, 0.4, 0.1, 0.05, 0.08, 0.1, "#aab0a3");
        }
      } else if (role === "huskarl") {
        part(o, 0, 1.1, 0, 0.4, 0.14, 0.36, metal3);
        part(o, 0, 1.24, 0, 0.24, 0.08, 0.22, metal3);
        part(o, 0, 0.86, 0.16, 0.05, 0.24, 0.03, metal3);
        part(o, 0, 0.3, 0, 0.48, 0.26, 0.34, metal3);
        part(la, -0.14, -0.6, 0.16, 0.06, 0.5, 0.3, team2);
        part(la, -0.14, -0.5, 0.16, 0.06, 0.3, 0.5, team2);
        part(la, -0.18, -0.4, 0.16, 0.04, 0.1, 0.1, gold2);
      } else if (role === "teutonic-knight") {
        part(o, 0, 0.7, 0, 0.47, 0.46, 0.44, metal3);
        part(o, 0, 0.9, 0.22, 0.36, 0.035, 0.012, "#2c2e2c");
        part(o, 0, 1.16, 0, 0.08, 0.08, 0.32, team2);
        part(o, 0, 0.3, 0, 0.48, 0.4, 0.34, "#ece8dc");
        for (const z of [0.17, -0.17]) {
          part(o, 0, 0.34, z, 0.08, 0.3, 0.012, team2);
          part(o, 0, 0.5, z, 0.26, 0.08, 0.012, team2);
        }
        arms(0, -0.12, 0, 0.15, 0.14, 0.2, metal3);
      } else if (role === "berserk") {
        part(o, 0, 1.06, -0.02, 0.42, 0.14, 0.42, "#8a8272");
        part(o, 0, 1.12, 0.2, 0.16, 0.08, 0.1, "#8a8272");
        for (const x of [-0.13, 0.13]) part(o, x, 1.2, -0.04, 0.08, 0.1, 0.06, "#8a8272");
        part(o, 0, 0.62, -0.02, 0.54, 0.12, 0.38, fur);
        part(o, 0, 0.3, -0.2, 0.44, 0.36, 0.06, fur);
        part(o, 0, 0.71, 0.15, 0.26, 0.11, 0.05, "#a35f35");
        arms(0, -0.3, 0, 0.12, 0.28, 0.18, skin);
        arms(0, -0.3, 0, 0.125, 0.06, 0.185, leather);
      } else if (role === "samurai") {
        part(o, 0, 1.1, 0, 0.4, 0.14, 0.38, lacquer);
        part(o, 0, 0.92, -0.06, 0.52, 0.16, 0.36, lacquer);
        for (const x of [-0.1, 0.1]) part(o, x, 1.16, 0.17, 0.04, 0.26, 0.02, gold2);
        part(o, 0, 1.14, 0.2, 0.1, 0.08, 0.02, gold2);
        part(o, 0, 0.4, 0, 0.48, 0.3, 0.34, "#4a3a32");
        for (const y of [0.46, 0.58]) part(o, 0, y, 0, 0.49, 0.04, 0.345, team2);
        arms(0, -0.24, 0, 0.14, 0.24, 0.22, team2);
        arms(0, -0.16, 0, 0.145, 0.03, 0.225, lacquer);
      } else if (role === "cataphract-rider") {
        part(o, 0, 0.3, 0, 0.48, 0.4, 0.34, "#a89a6a");
        part(o, 0, 0.32, -0.19, 0.4, 0.4, 0.04, team2);
        part(o, 0, 1.1, 0, 0.4, 0.12, 0.36, "#a5b0ad");
        part(o, 0, 1.22, 0, 0.24, 0.1, 0.22, "#a5b0ad");
        part(o, 0, 1.32, 0, 0.06, 0.22, 0.06, team2);
      } else if (role === "mameluke-rider") {
        part(o, 0, 1.08, 0, 0.44, 0.14, 0.42, "#efe9da");
        part(o, 0, 1.12, 0, 0.46, 0.05, 0.44, team2);
        part(o, 0, 1.22, 0, 0.12, 0.14, 0.12, gold2);
        part(o, 0, 0.42, 0, 0.48, 0.05, 0.34, gold2);
      } else if (role === "mangudai-rider") {
        part(o, 0, 1.06, 0, 0.48, 0.1, 0.44, "#8a6a48");
        part(o, 0, 1.16, 0, 0.3, 0.14, 0.28, team2);
        part(o, 0, 1.3, 0, 0.1, 0.06, 0.1, gold2);
        part(o, 0.08, 0.44, 0.165, 0.14, 0.24, 0.02, "#d8c48a");
        part(o, 0.25, 0.3, -0.05, 0.1, 0.32, 0.14, "#8b6746");
      } else if (role === "mahout") {
        part(o, 0, 1.08, 0, 0.42, 0.12, 0.4, team2);
        part(o, 0, 1.2, 0, 0.14, 0.06, 0.14, gold2);
      } else {
        part(o, 0, 1.12, 0, 0.4, 0.14, 0.35, "#a5b0ad");
        part(o, 0, 0.4, 0.18, 0.36, 0.23, 0.055, "#a5b0ad");
        if (role === "spearman") part(o, 0, 1.26, 0, 0.065, 0.15, 0.25, team2);
      }
    }
    for (const g of outfit) g.visible = true;
    shield.visible = role === "swordsman";
    equip(roleTools[role]);
  }
  const shield = new T.Group();
  shield.name = "shield-left";
  sockets.leftHand.add(shield);
  shield.visible = false;
  part(shield, -0.12, -0.17, 0.07, 0.08, 0.48, 0.4, "#9d885b");
  part(shield, -0.17, -0.11, 0.07, 0.03, 0.34, 0.28, team2);
  const toolMeshes = /* @__PURE__ */ new Map();
  let selected = "none";
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
    } else if (kind === "staff") {
      part(group, 0, -0.2, 0, 0.05, 1.3, 0.05, "#8a6a45");
      part(group, 0, 0.49, 0, 0.1, 0.1, 0.1, "#c9a55a");
    } else if (kind === "bow") {
      for (const [y, z] of [[-0.12, 0], [0.04, 0.08], [0.2, 0.12], [0.36, 0.08], [0.52, 0]]) part(group, 0, y, z, 0.065, 0.17, 0.06, "#997447");
      part(group, 0, -0.12, 0, 0.018, 0.81, 0.018, "#d9cba4");
    } else if (kind === "longbow") {
      for (const [y, z] of [[-0.34, 0], [-0.12, 0.06], [0.1, 0.1], [0.32, 0.1], [0.54, 0.06], [0.76, 0]]) part(group, 0, y, z, 0.07, 0.23, 0.07, "#a57c4a");
      part(group, 0, -0.34, -0.01, 0.016, 1.33, 0.016, "#d9cba4");
    } else if (kind === "repeater") {
      part(group, 0, -0.02, 0.18, 0.07, 0.08, 0.56, "#8a6a45");
      part(group, 0, 0.06, 0.24, 0.08, 0.16, 0.2, "#6e5438");
      part(group, 0, 0.02, 0.42, 0.56, 0.05, 0.05, "#8a6a45");
      part(group, 0, 0.1, 0.08, 0.03, 0.2, 0.03, "#6e5438");
    } else if (kind === "musket") {
      part(group, 0, -0.3, 0, 0.09, 0.36, 0.08, "#7a5a3a");
      part(group, 0, 0.06, 0, 0.06, 0.9, 0.06, "#4a4a48");
      part(group, 0, 0.3, 0, 0.06, 0.03, 0.06, "#c9a55a");
      part(group, 0.04, -0.02, 0, 0.03, 0.06, 0.05, "#c9a55a");
    } else if (kind === "throwing-axe") {
      part(group, 0, -0.04, 0, 0.045, 0.32, 0.05, "#967447");
      part(group, 0.07, 0.2, 0, 0.1, 0.08, 0.05, "#aab0a3");
      part(group, 0.12, 0.12, 0, 0.06, 0.1, 0.05, "#aab0a3");
      part(group, 0.1, 0.28, 0, 0.05, 0.05, 0.05, "#aab0a3");
    } else if (kind === "great-sword") {
      part(group, 0, -0.16, 0, 0.08, 0.05, 0.08, "#baa167");
      part(group, 0, -0.12, 0, 0.05, 0.22, 0.06, "#5a4632");
      part(group, 0, 0.1, 0, 0.34, 0.05, 0.07, "#baa167");
      part(group, 0, 0.15, 0, 0.1, 0.8, 0.05, "#d2d8d4");
    } else if (kind === "war-axe") {
      part(group, 0, -0.3, 0, 0.055, 1.05, 0.06, "#6e5438");
      part(group, 0.1, 0.52, 0, 0.18, 0.22, 0.05, "#aab0a3");
      part(group, 0.16, 0.4, 0, 0.08, 0.14, 0.05, "#aab0a3");
      part(group, -0.06, 0.6, 0, 0.06, 0.06, 0.05, "#aab0a3");
    } else if (kind === "katana") {
      part(group, 0, -0.12, 0, 0.045, 0.2, 0.05, "#2f2a26");
      part(group, 0, 0.08, 0, 0.12, 0.025, 0.12, "#c9a55a");
      part(group, 0, 0.105, 0, 0.05, 0.3, 0.04, "#dfe4e0");
      part(group, 0, 0.4, -0.015, 0.05, 0.25, 0.04, "#dfe4e0");
      part(group, 0, 0.64, -0.035, 0.045, 0.16, 0.04, "#dfe4e0");
    } else if (kind === "scimitar") {
      part(group, 0, -0.1, 0, 0.05, 0.18, 0.06, "#5a4632");
      part(group, 0, 0.08, 0, 0.18, 0.04, 0.07, "#c9a55a");
      part(group, 0, 0.12, 0, 0.05, 0.24, 0.04, "#d2d8d4");
      part(group, 0, 0.34, 0.03, 0.07, 0.16, 0.04, "#d2d8d4");
      part(group, 0, 0.48, 0.07, 0.07, 0.1, 0.04, "#d2d8d4");
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
    selected = kind;
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
    for (const [tool, mesh] of toolMeshes) mesh.visible = tool === selected && kind !== "death";
  }
  return { root, sockets, equip, pose, dress, seat: (value) => {
    seated = value;
  } };
}

// apps/web/elephant-rig.ts
function createElephantMount(T, player, box, material) {
  const root = new T.Group();
  root.name = "elephant-root";
  const team2 = player === 0 ? "#45728c" : "#b25441", grey2 = "#8d8c86", ear = "#9a988f", ivory = "#efe8d2", gold3 = "#c9a55a", wood2 = "#6e5438";
  const part = (parent, x, y, z, w, h, d, color) => {
    const m = new T.Mesh(box(w, h, d), material(color));
    m.position.set(x, y, z);
    m.castShadow = true;
    parent.add(m);
    return m;
  };
  const legs = [];
  for (const x of [-0.3, 0.3]) for (const z of [-0.45, 0.45]) {
    const leg = new T.Group();
    leg.name = `elephant-leg-${legs.length}`;
    leg.position.set(x, 0.8, z);
    root.add(leg);
    legs.push(leg);
    part(leg, 0, -0.8, 0, 0.3, 0.8, 0.32, grey2);
    part(leg, 0, -0.8, 0.165, 0.26, 0.08, 0.03, "#d9d2c2");
  }
  const body = new T.Group();
  root.add(body);
  part(body, 0, 0.72, 0, 1, 0.86, 1.5, grey2);
  part(body, 0, 1.02, 0, 1.04, 0.58, 1.1, team2);
  part(body, 0, 0.98, 0, 1.05, 0.06, 1.11, gold3);
  part(body, 0, 1.02, 0.8, 0.72, 0.7, 0.46, grey2);
  part(body, 0, 1.72, 0.82, 0.5, 0.1, 0.34, grey2);
  for (const sx of [-1, 1]) {
    part(body, sx * 0.42, 1.02, 0.62, 0.1, 0.6, 0.46, ear);
    part(body, sx * 0.22, 1.42, 1.035, 0.06, 0.05, 0.02, "#2f3932");
    part(body, sx * 0.22, 0.9, 1.12, 0.08, 0.08, 0.34, ivory);
    part(body, sx * 0.22, 0.95, 1.32, 0.07, 0.12, 0.07, ivory);
  }
  part(body, 0, 0.96, -0.78, 0.06, 0.44, 0.06, ear);
  part(body, 0, 0.9, -0.78, 0.1, 0.1, 0.1, "#4a4640");
  const trunk = new T.Group();
  trunk.name = "elephant-trunk";
  trunk.position.set(0, 1.1, 0.96);
  body.add(trunk);
  part(trunk, 0, -0.34, 0.07, 0.22, 0.4, 0.2, grey2);
  part(trunk, 0, -0.66, 0.12, 0.17, 0.34, 0.17, grey2);
  part(trunk, 0, -0.86, 0.2, 0.14, 0.22, 0.14, grey2);
  part(trunk, 0, -0.88, 0.3, 0.12, 0.1, 0.12, grey2);
  part(body, 0, 1.6, -0.12, 0.9, 0.1, 0.96, wood2);
  for (const z of [0.3, -0.54]) part(body, 0, 1.7, z, 0.9, 0.3, 0.08, team2);
  for (const x of [-0.41, 0.41]) part(body, x, 1.7, -0.12, 0.08, 0.3, 0.76, team2);
  for (const z of [0.3, -0.54]) part(body, 0, 2, z, 0.94, 0.05, 0.1, gold3);
  for (const x of [-0.41, 0.41]) for (const z of [0.3, -0.54]) part(body, x, 2, z, 0.08, 0.3, 0.08, gold3);
  const saddle = new T.Group();
  saddle.name = "rider-saddle";
  saddle.position.set(0, 1.7, -0.12);
  body.add(saddle);
  function pose(kind, time) {
    const t = Number.isFinite(time) ? Math.max(0, time) : 0, phase = t * 8e-3, walking = kind === "walk";
    legs.forEach((leg, i) => {
      const swing = walking ? Math.sin(phase + (i === 0 || i === 3 ? 0 : Math.PI)) * 0.18 : 0;
      leg.rotation.x = swing;
      leg.position.y = 0.8 + Math.abs(Math.sin(swing)) * 0.2;
    });
    body.position.y = walking ? Math.abs(Math.sin(phase)) * 0.03 : 0;
    trunk.rotation.x = kind === "attack" ? -(0.5 + 0.4 * Math.sin(t * 0.01)) : 0;
    trunk.rotation.z = kind === "idle" ? Math.sin(t * 2e-3) * 0.12 : 0;
  }
  return { root, saddle, pose };
}

// apps/web/character-rig.ts
var mountedRoles = ["cavalry", "cataphract", "mameluke", "mangudai", "war-elephant"];
var isMounted = (role) => mountedRoles.includes(role);
var mounts = {
  cavalry: { rider: "swordsman", tool: "spear", horse: { coat: "#957350", head: "#a5835b", mane: "#64533d", barding: false } },
  cataphract: { rider: "cataphract-rider", tool: "spear", horse: { coat: "#6f5a44", head: "#7c6550", mane: "#3e3326", barding: true } },
  mameluke: { rider: "mameluke-rider", tool: "scimitar", horse: { coat: "#d6cdb9", head: "#e0d8c6", mane: "#8b8374", barding: false } },
  mangudai: { rider: "mangudai-rider", tool: "bow", horse: { coat: "#7a5b3c", head: "#8a6a48", mane: "#3e3326", barding: false } },
  "war-elephant": { rider: "mahout", tool: "spear", horse: null }
};
function createCharacterRig(T, player, box, material) {
  const root = new T.Group(), rider = createUnitRig(T, player, box, material);
  root.add(rider.root);
  const team2 = player === 0 ? "#45728c" : "#b25441";
  let horse = null, saddle = null, barding2 = null, mounted = null, elephant = null;
  const legs = [];
  const tints = { coat: [], head: [], mane: [] };
  const part = (parent, x, y, z, w, h, d, color) => {
    const m = new T.Mesh(box(w, h, d), material(color));
    m.position.set(x, y, z);
    m.castShadow = true;
    parent.add(m);
    return m;
  };
  function makeHorse() {
    horse = new T.Group();
    horse.name = "horse-root";
    root.add(horse);
    tints.coat.push(part(horse, 0, 0.62, 0, 0.56, 0.5, 1.15, "#957350"), part(horse, 0, 0.82, 0.43, 0.36, 0.65, 0.32, "#957350"));
    tints.head.push(part(horse, 0, 1.22, 0.61, 0.38, 0.28, 0.52, "#a5835b"));
    tints.mane.push(part(horse, 0, 1.5, 0.5, 0.3, 0.14, 0.12, "#64533d"));
    for (const x of [-0.2, 0.2]) part(horse, x, 1.39, 0.67, 0.03, 0.04, 0.05, "#2f3932");
    tints.mane.push(part(horse, 0, 0.72, -0.66, 0.16, 0.4, 0.15, "#64533d"));
    part(horse, 0, 1.12, 0, 0.68, 0.08, 0.5, team2);
    for (const x of [-0.19, 0.19]) for (const z of [-0.42, 0.42]) {
      const leg = new T.Group();
      leg.name = `horse-leg-${legs.length}`;
      leg.position.set(x, 0.62, z);
      horse.add(leg);
      legs.push(leg);
      tints.coat.push(part(leg, 0, -0.62, 0, 0.15, 0.62, 0.17, "#957350"));
      part(leg, 0, -0.62, 0.025, 0.18, 0.12, 0.22, "#514b3c");
    }
    saddle = new T.Group();
    saddle.name = "rider-saddle";
    saddle.position.set(0, 0.9, -0.05);
    horse.add(saddle);
  }
  function makeBarding() {
    barding2 = new T.Group();
    barding2.name = "horse-barding";
    horse.add(barding2);
    const steel = "#8f9896";
    part(barding2, 0, 0.58, 0, 0.6, 0.42, 1.19, steel);
    part(barding2, 0, 0.56, 0, 0.62, 0.06, 1.21, team2);
    part(barding2, 0, 0.84, 0.43, 0.4, 0.5, 0.36, steel);
    part(barding2, 0, 1.24, 0.86, 0.3, 0.24, 0.04, steel);
    part(barding2, 0, 1.48, 0.5, 0.06, 0.16, 0.06, team2);
  }
  function dress(role) {
    const next = isMounted(role) ? role : null;
    mounted = next;
    if (next) {
      const look = mounts[next];
      if (look.horse) {
        if (!horse) makeHorse();
        horse.visible = true;
        if (elephant) elephant.root.visible = false;
        for (const k of ["coat", "head", "mane"]) for (const m of tints[k]) m.material = material(look.horse[k]);
        if (look.horse.barding && !barding2) makeBarding();
        if (barding2) barding2.visible = look.horse.barding;
        saddle.add(rider.root);
      } else {
        if (!elephant) {
          elephant = createElephantMount(T, player, box, material);
          root.add(elephant.root);
        }
        elephant.root.visible = true;
        if (horse) horse.visible = false;
        elephant.saddle.add(rider.root);
      }
      rider.dress(look.rider);
      rider.equip(look.tool);
    } else {
      if (horse) horse.visible = false;
      if (elephant) elephant.root.visible = false;
      root.add(rider.root);
      rider.dress(role);
    }
    rider.seat(!!next);
    pose("idle", 0);
  }
  function pose(kind, time) {
    if (mounted && !["idle", "walk", "attack"].includes(kind)) throw Error("\u9A0E\u4E58\u6A21\u578B\u76EE\u524D\u50C5\u652F\u63F4\u5F85\u547D\u3001\u884C\u8D70\u8207\u653B\u64CA\u59FF\u614B");
    rider.pose(kind, time);
    if (horse) {
      const phase = Number.isFinite(time) ? Math.max(0, time) * 0.012 : 0, walking = mounted && mounted !== "war-elephant" && kind === "walk";
      legs.forEach((leg, i) => {
        const swing = walking ? Math.sin(phase + (i === 0 || i === 3 ? 0 : Math.PI)) * 0.26 : 0;
        leg.rotation.x = swing;
        leg.position.y = 0.62 + Math.abs(Math.sin(swing)) * 0.14;
      });
    }
    if (elephant) elephant.pose(mounted === "war-elephant" ? kind : "idle", time);
  }
  return { root, sockets: rider.sockets, equip: rider.equip, dress, pose };
}

// apps/web/animal-rig.ts
var animalLooks = {
  sheep: {
    legs: { h: 0.26, w: 0.09, x: 0.15, z: 0.2, color: "#4b4439" },
    body: [{ x: 0, y: 0.24, z: 0, w: 0.52, h: 0.36, d: 0.7, color: "#ece6d2" }, { x: 0, y: 0.56, z: -0.05, w: 0.4, h: 0.1, d: 0.52, color: "#f4efdf" }],
    head: [{ x: 0, y: 0.4, z: 0.42, w: 0.2, h: 0.22, d: 0.24, color: "#4b4439" }, { x: -0.12, y: 0.54, z: 0.4, w: 0.07, h: 0.04, d: 0.1, color: "#4b4439" }, { x: 0.12, y: 0.54, z: 0.4, w: 0.07, h: 0.04, d: 0.1, color: "#4b4439" }],
    collar: { y: 0.36, z: 0.3 }
  },
  deer: {
    legs: { h: 0.42, w: 0.08, x: 0.13, z: 0.24, color: "#8a643f" },
    body: [{ x: 0, y: 0.4, z: 0, w: 0.36, h: 0.32, d: 0.76, color: "#a67a4c" }, { x: 0, y: 0.42, z: -0.4, w: 0.12, h: 0.14, d: 0.06, color: "#efe6d2" }],
    head: [{ x: 0, y: 0.62, z: 0.36, w: 0.14, h: 0.3, d: 0.14, color: "#a67a4c" }, { x: 0, y: 0.86, z: 0.44, w: 0.16, h: 0.14, d: 0.24, color: "#a67a4c" }, { x: -0.08, y: 1, z: 0.4, w: 0.03, h: 0.18, d: 0.03, color: "#d8c7a0" }, { x: 0.08, y: 1, z: 0.4, w: 0.03, h: 0.18, d: 0.03, color: "#d8c7a0" }, { x: -0.12, y: 1.12, z: 0.4, w: 0.1, h: 0.03, d: 0.03, color: "#d8c7a0" }, { x: 0.12, y: 1.12, z: 0.4, w: 0.1, h: 0.03, d: 0.03, color: "#d8c7a0" }],
    collar: null
  },
  boar: {
    legs: { h: 0.22, w: 0.1, x: 0.16, z: 0.26, color: "#3f3226" },
    body: [{ x: 0, y: 0.2, z: 0, w: 0.5, h: 0.42, d: 0.86, color: "#5d4a36" }, { x: 0, y: 0.62, z: 0.02, w: 0.14, h: 0.08, d: 0.6, color: "#3f3226" }],
    head: [{ x: 0, y: 0.26, z: 0.48, w: 0.34, h: 0.3, d: 0.24, color: "#5d4a36" }, { x: 0, y: 0.3, z: 0.66, w: 0.18, h: 0.14, d: 0.12, color: "#b89078" }, { x: -0.12, y: 0.32, z: 0.66, w: 0.04, h: 0.12, d: 0.04, color: "#f1ead6" }, { x: 0.12, y: 0.32, z: 0.66, w: 0.04, h: 0.12, d: 0.04, color: "#f1ead6" }],
    collar: null
  }
};
function carcassParts(kind, share) {
  const look = animalLooks[kind], s = 0.5 + 0.5 * Math.max(0, Math.min(1, share)), b = look.body[0];
  return [{ x: -b.h * 0.6, y: 0, z: -b.d * s / 2, w: b.h * 1.2, h: b.w * 0.55, d: b.d * s, color: b.color }, { x: -0.08, y: 0, z: b.d * s / 2, w: 0.16, h: 0.12, d: 0.16, color: look.head[0].color }];
}
function createAnimalRig(T, kind, player, box, material) {
  const look = animalLooks[kind], root = new T.Group();
  root.name = `animal-${kind}`;
  const body = new T.Group();
  root.add(body);
  const part = (parent, p) => {
    const m = new T.Mesh(box(p.w, p.h, p.d), material(p.color));
    m.position.set(p.x, p.y, p.z);
    m.castShadow = true;
    parent.add(m);
    return m;
  };
  for (const p of look.body) part(body, p);
  const head = new T.Group();
  head.position.set(0, 0, 0);
  body.add(head);
  for (const p of look.head) part(head, p);
  if (look.collar && (player === 0 || player === 1)) part(body, { x: 0, y: look.collar.y, z: look.collar.z, w: 0.46, h: 0.08, d: 0.08, color: player === 0 ? "#45728c" : "#b25441" });
  const legs = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const leg = new T.Group();
    leg.position.set(sx * look.legs.x, look.legs.h, sz * look.legs.z);
    root.add(leg);
    legs.push(leg);
    part(leg, { x: 0, y: -look.legs.h, z: 0, w: look.legs.w, h: look.legs.h, d: look.legs.w, color: look.legs.color });
  }
  function pose(kind2, time) {
    const t = Number.isFinite(time) ? Math.max(0, time) : 0, swing = kind2 === "walk" ? Math.sin(t * 0.016) * 0.45 : 0;
    legs.forEach((leg, i) => {
      leg.rotation.x = (i === 0 || i === 3 ? 1 : -1) * swing;
    });
    const graze = kind2 === "idle" ? Math.max(0, Math.sin(t * 17e-4)) * 0.35 : 0, lunge = kind2 === "attack" ? Math.max(0, Math.sin(t * 0.012)) * 0.18 : 0;
    head.rotation.x = graze;
    body.position.z = lunge;
    body.rotation.x = kind2 === "hit" && t < 300 ? -0.2 * Math.sin(Math.PI * t / 300) : 0;
    root.rotation.z = 0;
  }
  return { root, sockets: { leftHand: new T.Group(), rightHand: new T.Group() }, equip: (_) => {
  }, dress: (_) => {
  }, pose };
}

// packages/sim/fauna.ts
var animalKinds = ["sheep", "deer", "boar"];
var isAnimal = (kind) => animalKinds.includes(kind);
var animalRules = {
  provenance: "design_default",
  // Food in the carcass; which resource kind the carcass is (sheep herd, the others hunt).
  food: { sheep: 100, deer: 140, boar: 340 },
  carcass: { sheep: "livestock", deer: "hunt", boar: "hunt" },
  // A sheep belongs to the only player with a unit (other than an animal) within captureRange; with both sides near it
  // keeps its owner. An owned sheep lets its owner see a little ground round it (visionRules.sheepRadius).
  // A sheep within holdRange of one of its owner's buildings cannot be taken.
  captureRange: 200,
  holdRange: 400,
  // A struck deer runs fleeDistance away from the hunter; a struck boar charges its attacker (combatRules.units.boar).
  fleeDistance: 350,
  boarLeash: 700,
  // Villager hunting: damage per strike, ticks between strikes, reach (Chebyshev, to the animal's centre).
  hunt: { damage: 3, cooldown: 30, range: { sheep: 50, deer: 150, boar: 150 } },
  // A carcass loses one food every decayTicks, whether or not anyone is working it.
  decayTicks: 100,
  // Villagers stand this close (Chebyshev) to a carcass or a shore fish to work it.
  pointReach: 100,
  fishReach: 150,
  // Ids of animals start here, apart from player units, so trained units keep the ids they always had.
  firstId: 900001
};

// apps/web/rig-roles.ts
var footUniques = ["longbowman", "woad-raider", "throwing-axeman", "huskarl", "teutonic-knight", "berserk", "samurai", "janissary", "chu-ko-nu"];
function roleOf(kind) {
  return kind === "militia" ? "swordsman" : kind === "spearman" ? "spearman" : kind === "archer" || kind === "skirmisher" ? "archer" : kind === "scout" || kind === "knight" ? "cavalry" : kind === "monk" ? "monk" : footUniques.includes(kind) ? kind : isMounted(kind) ? kind : "villager";
}
function poseFor(kind, pose) {
  return isMounted(roleOf(kind)) && !["idle", "walk", "attack"].includes(pose) ? "idle" : pose;
}
function corpseRole(kind) {
  const role = roleOf(kind);
  return isMounted(role) ? mounts[role].rider : role;
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
  const p = [], age = v.ageVariant, team2 = v.red ? "#b85c47" : "#456e87", wood2 = "#94734c", stone2 = "#aaa994", brass = "#bca068", water = "#6a9297", height = 1.28 + (age - 1) * 0.16;
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
    if (age <= 2) {
      add("boundary-back", 1, 0, 0, 0.16, 2.7, 0.08, 0.12, wood2);
      add("boundary-front", 1, 0, 2.62, 0.16, 2.7, 0.08, 0.12, wood2);
    } else {
      add("wall-back", 1, 0, 0, 0.16, 2.7, 0.08, 0.24, stone2);
      for (const [x, w] of [[0, 1.08], [1.62, 1.08]]) add(`wall-front-${x}`, 1, x, 2.62, 0.16, w, 0.08, 0.24, stone2);
      for (const x of [1.08, 1.46]) add(`gate-pier-${x}`, 1, x, 2.58, 0.16, 0.16, 0.16, 0.56, stone2, true);
    }
    if (age >= 2) {
      for (const x of [0, 2.62]) add(age >= 3 ? `wall-side-${x}` : `boundary-side-${x}`, 1, x, 0.08, 0.16, 0.08, 2.54, age >= 3 ? 0.24 : 0.12, age >= 3 ? stone2 : wood2);
      for (const x of [-0.12, 2.72]) for (const z of [-0.12, 2.72]) add(`fence-post-${x}-${z}`, 1, x, z, 0.16, 0.1, 0.1, age >= 3 ? 0.56 : 0.45, age >= 3 ? stone2 : wood2);
    }
    if (age === 4) {
      add("gate-lintel", 1, 1.08, 2.58, 0.72, 0.54, 0.16, 0.16, team2, true);
      add("scarecrow-post", 3, 1.3, 1.24, 0.16, 0.06, 0.06, 0.64, wood2);
      add("scarecrow-arms", 3, 1.1, 1.24, 0.8, 0.46, 0.06, 0.06, wood2);
      add("scarecrow-head", 3, 1.25, 1.19, 0.86, 0.16, 0.16, 0.22, "#c7b27a");
      add("scarecrow-hat", 3, 1.2, 1.15, 1.08, 0.26, 0.24, 0.06, "#6d563d");
    }
  } else {
    const hallHeight = 1.6 + (age - 1) * 0.16, towerTop = 0.16 + (age >= 3 ? 6 : 5) * 0.4, roofY = kind === "mill" ? towerTop : kind === "town-center" ? hallHeight + 0.16 : height + 0.16, masonry = kind !== "town-center", postBase = masonry && age >= 2 ? 0.4 : 0.16;
    for (const x of [0.1, 2.4]) for (const z of [0.1, 1.8]) add(`post-${x}-${z}`, 1, x, z, postBase, 0.16, 0.16, roofY - postBase, age >= 3 ? stone2 : wood2);
    add("back-brace", 1, 0.1, 0.1, roofY - 0.24, 2.46, 0.14, 0.24, wood2);
    if (kind === "market") {
      for (let stripe = 0; stripe < 6; stripe++) add(`awning-${stripe}`, 2, -0.05 + stripe * 0.48, -0.05, roofY, 0.48, 2.25, 0.16, stripe % 2 ? "#e4d4ab" : team2);
    } else for (let level = 0; level < 3; level++) add(`roof-${level}`, 2, -0.05 + level * 0.28, -0.05, roofY + level * 0.16, 2.9 - level * 0.56, 2.25, 0.16, age === 1 ? "#b8a074" : team2, true);
    if (masonry && age >= 2) for (const x of [0.1, 2.4]) for (const z of [0.1, 1.8]) add(`footing-${x}-${z}`, 1, x - 0.02, z - 0.02, 0.16, 0.2, 0.2, 0.24, stone2);
    if (masonry && age >= 3) {
      if (kind !== "smithy") add("stone-plinth", 1, 0.28, 0.1, 0.16, 2.1, 0.14, 0.48, stone2, true);
      for (const x of [-0.04, 2.56]) for (const z of [0.3, 1.46]) add(`buttress-${x}-${z}`, 1, x, z, 0.16, 0.14, 0.3, roofY - 0.16, stone2);
    }
    if (kind === "lumber-camp") {
      for (let row = 0; row < 3; row++) for (let layer = 0; layer < 2; layer++) add(`log-${row}-${layer}`, 3, 0.25, 0.3 + row * 0.28, 0.16 + layer * 0.2, 1.6, 0.22, 0.2, wood2, true);
      for (const x of [0.55, 1.75]) add(`saw-leg-${x}`, 3, x, 2.15, 0.16, 0.14, 0.32, 0.45, "#66563e");
      add("saw-worktop", 3, 0.35, 2.08, 0.61, 1.8, 0.48, 0.12, wood2);
      add("saw-blade", 3, 0.9, 2.24, 0.73, 0.85, 0.06, 0.14, "#b8c0b9");
      if (age >= 2) {
        add("chopping-block", 3, 2, 0.9, 0.16, 0.35, 0.35, 0.3, "#7c674b", true);
        add("axe-handle", 3, 2.15, 1.05, 0.46, 0.05, 0.05, 0.4, wood2);
        add("axe-head", 3, 2.08, 1.04, 0.78, 0.2, 0.07, 0.08, "#b8c0b9");
      }
      if (age === 4) {
        add("crane-mast", 3, 2.5, 2.3, 0.16, 0.16, 0.16, roofY + 0.32, wood2);
        add("crane-jib", 3, 1.2, 2.3, roofY + 0.48, 1.46, 0.16, 0.16, wood2);
        add("crane-rope", 3, 1.34, 2.36, roofY - 0.32, 0.04, 0.04, 0.8, "#8c8879");
        add("crane-hook", 3, 1.28, 2.3, roofY - 0.44, 0.16, 0.16, 0.12, "#76817d");
      }
    } else if (kind === "mining-camp") {
      add("hopper-base", 3, 0.35, 0.4, 0.16, 1.7, 0.9, 0.16, wood2);
      for (const x of [0.35, 1.89]) add(`hopper-wall-${x}`, 3, x, 0.4, 0.32, 0.16, 0.9, 0.55, wood2);
      add("hopper-back", 3, 0.35, 0.4, 0.32, 1.7, 0.16, 0.55, wood2);
      for (let i = 0; i < 6; i++) add(`ore-${i}`, 3, 0.59 + i % 3 * 0.39, 0.62 + Math.floor(i / 3) * 0.32, 0.32, 0.3, 0.26, 0.25, i % 2 ? stone2 : "#c0a557", true);
      add("pick-handle", 3, 2.42, 0.8, 0.16, 0.06, 0.06, 1.05, wood2);
      add("pick-head", 3, 2.2, 0.8, 1.12, 0.5, 0.08, 0.1, "#b8c0b9");
      if (age >= 2) {
        for (const z of [2.3, 2.62]) add(`rail-${z}`, 1, 0.7, z, 0.16, 1.1, 0.06, 0.06, "#76817d");
        add("cart-body", 3, 1, 2.26, 0.22, 0.5, 0.46, 0.3, "#7c674b");
        add("cart-ore", 3, 1.08, 2.34, 0.52, 0.34, 0.3, 0.12, "#c0a557", true);
      }
      if (age === 4) {
        for (const x of [0.4, 1.94]) add(`headframe-leg-${x}`, 3, x, 2.42, 0.16, 0.16, 0.16, roofY + 0.12, wood2);
        add("headframe-beam", 3, 0.4, 2.42, roofY + 0.28, 1.7, 0.16, 0.16, wood2);
        add("headframe-wheel", 3, 1.1, 2.44, roofY + 0.44, 0.3, 0.12, 0.3, "#76817d");
        add("headframe-rope", 3, 1.23, 2.48, 1.2, 0.04, 0.04, roofY - 0.92, "#8c8879");
        add("headframe-bucket", 3, 1.13, 2.38, 0.96, 0.24, 0.24, 0.24, "#7c674b");
      }
    } else if (kind === "mill") {
      for (let course = 0; course < (age >= 3 ? 6 : 5); course++) add(`mill-tower-${course}`, 1, 0.85, 0.6, 0.16 + course * 0.4, 1, 1, 0.4, course % 2 ? stone2 : "#c4bfa8", true);
      const hubY = towerTop - 0.5;
      add("axle", 3, 1.28, 1.6, hubY, 0.14, 0.83, 0.14, wood2);
      add("blade-vertical", 3, 1.26, 2.37, hubY - 1.12, 0.18, 0.1, 2.4, "#d6c6a0");
      add("blade-horizontal", 3, 0.15, 2.48, hubY, 2.4, 0.1, 0.18, "#d6c6a0");
      add("hub", 3, 1.19, 2.33, hubY - 0.04, 0.32, 0.29, 0.28, "#7c674b");
      for (const x of [0.22, 2.13]) add(`grain-bag-${x}`, 3, x, 0.7, 0.16, 0.38, 0.4, 0.48, "#c5b285", true);
      if (age >= 2) {
        add("sail-cloth-upper", 3, 1.44, 2.39, hubY + 0.36, 0.3, 0.06, 0.84, "#e8dcc0");
        add("sail-cloth-lower", 3, 0.96, 2.39, hubY - 1, 0.3, 0.06, 0.8, "#e8dcc0");
      }
      if (age === 4) {
        const base = roofY + 0.48;
        add("cupola-base", 2, 1, 0.6, base, 0.8, 0.8, 0.16, stone2);
        for (const x of [1, 1.68]) for (const z of [0.6, 1.28]) add(`cupola-post-${x}-${z}`, 3, x, z, base + 0.16, 0.12, 0.12, 0.4, stone2);
        add("cupola-cap", 3, 0.92, 0.52, base + 0.56, 0.96, 0.96, 0.16, team2, true);
        add("vane-pole", 4, 1.38, 0.98, base + 0.72, 0.04, 0.04, 0.5, "#76817d");
        add("vane-arrow", 4, 1.42, 0.98, base + 1.06, 0.3, 0.03, 0.12, brass);
      }
    } else if (kind === "town-center") {
      for (const x of [0.15, 2.05]) add(`hall-pier-${x}`, 1, x, 0.15, 0.16, 0.5, 1.5, hallHeight, stone2, true);
      add("entrance-lintel", 1, 0.65, 1.5, 0.16, 1.4, 0.25, 1.6, stone2, false, "arch");
      if (hallHeight > 1.6) add("entrance-course", 1, 0.65, 1.5, 1.76, 1.4, 0.25, hallHeight - 1.6, stone2);
      add("entrance-paving", 3, 0.95, 1.75, 0.16, 0.8, 1.05, 0.02, "#c8bea4");
      if (age >= 2) {
        let towerBase = roofY + 0.48;
        if (age >= 3) for (let course = 0; course < 2; course++) add(`tower-course-${course}`, 2, 0.87, 0.65, towerBase + course * 0.32, 0.96, 0.85, 0.32, stone2);
        if (age >= 3) towerBase += 0.64;
        add("belfry-floor", 3, 0.87, 0.65, towerBase, 0.96, 0.85, 0.16, stone2, true);
        for (const x of [0.91, 1.63]) for (const z of [0.69, 1.25]) add(`belfry-pillar-${x}-${z}`, 3, x, z, towerBase + 0.16, 0.12, 0.12, 0.65, stone2);
        add("belfry-top", 3, 0.8, 0.58, towerBase + 0.81, 1.1, 1, 0.16, team2, true);
        add("bell-hanger", 3, 1.33, 0.98, towerBase + 0.55, 0.05, 0.05, 0.26, wood2);
        add("bell", 3, 1.2, 0.88, towerBase + 0.4, 0.3, 0.28, 0.22, brass);
        if (age === 4) {
          const top = towerBase + 0.97;
          add("spire-0", 3, 0.95, 0.73, top, 0.8, 0.7, 0.16, team2, true);
          add("spire-1", 3, 1.1, 0.88, top + 0.16, 0.5, 0.4, 0.16, team2);
          add("spire-2", 3, 1.23, 0.98, top + 0.32, 0.24, 0.2, 0.24, team2);
          add("spire-finial", 4, 1.31, 1.04, top + 0.56, 0.08, 0.08, 0.3, brass);
        }
      }
      add("notice-board", 3, 0.14, 1.9, 0.72, 0.48, 0.08, 0.4, wood2);
      add("notice-paper", 3, 0.2, 1.98, 0.78, 0.34, 0.025, 0.27, "#e5d9b3");
      add("cargo-crate", 3, 2.1, 2.1, 0.16, 0.42, 0.42, 0.38, wood2, true);
    } else if (kind === "market") {
      for (const x of [0.24, 1.94]) {
        add(`stall-${x}`, 3, x, 0.35, 0.16, 0.52, 1.38, 0.48, wood2);
        for (let i = 0; i < 3; i++) add(`goods-${x}-${i}`, 3, x + 0.08, 0.48 + i * 0.4, 0.64, 0.34, 0.28, 0.18, i % 2 ? "#b9a76c" : "#8f9e5e", true);
      }
      add("scale-post", 3, 2.18, 1.48, 0.64, 0.04, 0.04, 0.46, "#8c8879");
      add("scale-beam", 3, 1.98, 1.48, 1.1, 0.44, 0.04, 0.04, "#8c8879");
      for (const x of [1.99, 2.36]) {
        add(`scale-wire-${x}`, 3, x, 1.48, 0.9, 0.025, 0.025, 0.2, "#8c8879");
        add(`scale-pan-${x}`, 3, x - 0.05, 1.43, 0.87, 0.13, 0.13, 0.04, "#b8b3a0");
      }
      if (age >= 2) for (let stripe = 0; stripe < 6; stripe++) add(`valance-${stripe}`, 2, -0.05 + stripe * 0.48, 2.14, roofY - 0.12, 0.48, 0.06, 0.12, stripe % 2 ? team2 : "#e4d4ab");
      if (age >= 3) add("arcade-arch", 1, 0.28, 1.8, 0.16, 2.1, 0.16, roofY - 0.16, stone2, false, "arch");
      if (age === 4) {
        const base = roofY + 0.16;
        add("pavilion-floor", 2, 0.95, 0.55, base, 0.9, 0.9, 0.12, stone2);
        for (const x of [0.99, 1.69]) for (const z of [0.59, 1.29]) add(`pavilion-post-${x}-${z}`, 3, x, z, base + 0.12, 0.12, 0.12, 0.44, wood2);
        add("pavilion-roof", 3, 0.87, 0.47, base + 0.56, 1.06, 1.06, 0.16, team2, true);
        add("pavilion-finial", 4, 1.36, 0.96, base + 0.72, 0.08, 0.08, 0.26, brass);
      }
    } else if (kind === "smithy") {
      add("forge-back", 1, 0.28, 0.22, 0.16, 1.05, 0.3, 1.05, stone2, true);
      for (const x of [0.28, 1.05]) add(`forge-side-${x}`, 1, x, 0.52, 0.16, 0.28, 0.7, 0.85, stone2);
      add("forge-lintel", 1, 0.28, 0.52, 1.01, 1.05, 0.7, 0.2, stone2);
      add("cold-hearth", 3, 0.56, 0.52, 0.16, 0.49, 0.7, 0.16, "#4e514b");
      add("chimney", 3, 0.55, 0.28, 1.21, 0.5, 0.5, roofY - 0.41, stone2, true);
      add("chimney-cap", 3, 0.49, 0.22, roofY + 0.8, 0.62, 0.62, 0.12, "#73786d");
      add("anvil-base", 3, 1.7, 1.7, 0.16, 0.5, 0.45, 0.34, wood2);
      add("anvil-neck", 3, 1.83, 1.8, 0.5, 0.23, 0.25, 0.2, "#76817d");
      add("anvil-face", 3, 1.6, 1.71, 0.7, 0.7, 0.43, 0.12, "#a0aaa5");
      add("bellows", 3, 1.34, 0.56, 0.16, 0.65, 0.5, 0.25, "#927052");
      add("coal-bin", 3, 0.25, 2.14, 0.16, 0.65, 0.42, 0.22, "#665940");
      for (let i = 0; i < 3; i++) add(`coal-${i}`, 3, 0.31 + i * 0.17, 2.21, 0.38, 0.13, 0.22, 0.1, "#424944");
      if (age >= 2) {
        add("quench-trough", 3, 1.2, 1.26, 0.16, 0.7, 0.36, 0.24, wood2);
        add("quench-water", 3, 1.26, 1.32, 0.4, 0.58, 0.24, 0.02, water);
      }
      if (age >= 3) add("side-wall", 1, 2.4, 0.28, 0.16, 0.16, 1.5, 0.8, stone2, true);
      if (age === 4) {
        add("race-channel", 1, 2.58, 0.62, 0.16, 0.26, 0.82, 0.08, wood2);
        add("race-water", 1, 2.6, 0.64, 0.24, 0.22, 0.78, 0.04, water);
        add("wheel-axle", 3, 2.56, 1.02, 0.66, 0.06, 0.08, 0.08, wood2);
        add("wheel-paddle-vertical", 3, 2.62, 0.98, 0.28, 0.12, 0.16, 0.8, wood2);
        add("wheel-paddle-horizontal", 3, 2.62, 0.68, 0.6, 0.12, 0.76, 0.16, wood2);
        add("wheel-hub", 3, 2.6, 0.94, 0.56, 0.16, 0.24, 0.24, "#76817d");
      }
    }
  }
  add("marker-pole", 4, 2.65, 2.7, 0.16, 0.06, 0.06, kind === "farm" ? 0.65 : height + 0.6, wood2);
  add("marker-flag", 4, 2.34, 2.7, kind === "farm" ? 0.61 : height + 0.44, 0.32, 0.05, 0.22, team2);
  if (v.health === 0) return [p[0], ...Array.from({ length: 12 }, (_, i) => ({ id: `debris-${i}`, phase: 0, x: 0.2 + i % 4 * 0.6, z: 0.2 + Math.floor(i / 4) * 0.7, y: 0.16, w: 0.34, d: 0.3, h: 0.12, color: wood2, studs: false }))];
  const built = p.filter((a) => a.phase <= Math.min(4, Math.floor(v.progress / 20)));
  if (v.health >= 50) return built;
  const roofTop = built.find((a) => a.id === "roof-2"), loaded = roofTop && built.some((a) => a !== roofTop && Math.abs(a.y - roofTop.y - roofTop.h) < 1e-8 && a.x < roofTop.x + roofTop.w && a.x + a.w > roofTop.x && a.z < roofTop.z + roofTop.d && a.z + a.d > roofTop.z);
  return built.filter((a) => !(a.id === "marker-flag" || a.id === "roof-2" && !loaded || /^(awning|valance)-[24]$/.test(a.id) || a.id.startsWith("grain-") || a.id === "blade-horizontal" || a.id.endsWith("-finial") || a.id === "vane-arrow"));
}

// apps/web/building-parts.ts
function buildingParts(visual) {
  const { ageVariant: age, progress, health, red: red2 } = visual;
  if (![1, 2, 3, 4].includes(age) || ![progress, health].every((v) => Number.isFinite(v) && v >= 0 && v <= 100)) throw Error("\u7121\u6548\u5EFA\u7BC9\u5916\u89C0\u72C0\u614B");
  const parts = [], team2 = red2 ? "#b85c47" : "#456e87";
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
  const roofBase = wallTop, roof = age === 1 ? "#b8a074" : age === 2 ? team2 : "#677681", levels = age === 1 ? 3 : 4;
  for (let level = 0; level < levels; level++) for (let row = 0; row < 5; row++) add(`roof-${level}-${row}`, 2, -0.2 + level * 0.25, -0.2 + row * 0.5, roofBase + level * 0.18, 2.5 - level * 0.5, 0.5, 0.18, roof, true);
  add("door", 3, 0.76, 1.98, 0.16, 0.48, 0.06, 0.92, "#685740");
  add("door-handle", 3, 0.81, 2.04, 0.61, 0.055, 0.03, 0.07, "#c2a664");
  for (const x of [0.13, 1.47]) {
    add(`window-frame-${x}`, 3, x, 1.99, 0.76, 0.38, 0.06, 0.38, "#786b55");
    add(`window-glass-${x}`, 3, x + 0.04, 2.05, 0.8, 0.3, 0.025, 0.29, "#334b4e");
  }
  if (age >= 2) {
    add("chimney", 3, 1.5, 0.3, wallTop, 0.4, 0.4, 0.95, "#b1aa95");
    add("chimney-cap", 3, 1.46, 0.26, wallTop + 0.95, 0.48, 0.48, 0.1, "#78796b");
  }
  if (age >= 3) {
    add("stone-door-header", 3, 0.6, 1.97, 0.16, 0.8, 0.15, 1.28, "#d0ceba", false, "arch");
    add("roof-ridge", 3, 0.7, -0.2, roofBase + 0.72, 0.7, 2.5, 0.16, team2, true);
  }
  if (age === 4) {
    for (const z of [0.05, 1.55]) {
      add(`dormer-base-${z}`, 3, 0.5, z, roofBase + 0.36, 0.5, 0.4, 0.64, "#c9c4ae");
      add(`dormer-cap-${z}`, 3, 0.45, z - 0.04, roofBase + 1, 0.6, 0.48, 0.16, team2, true);
    }
    add("cargo-platform", 3, 0.75, 0.7, 0.16, 0.5, 0.6, 0.12, "#96764c");
  }
  const poleBase = roofBase + 0.36;
  add("flag-pole", 4, 0.27, 0.25, poleBase, 0.07, 0.07, 0.9, "#786849");
  add("flag", 4, 0.34, 0.25, poleBase + 0.58, 0.6, 0.04, 0.3, team2);
  if (health === 0) {
    return [parts[0], ...Array.from({ length: 12 }, (_, i) => ({ id: `debris-${i}`, phase: 0, x: 0.1 + i % 4 * 0.43, z: 0.12 + Math.floor(i / 4) * 0.53, y: 0.16, w: 0.32, d: 0.27, h: 0.12, color: i % 3 ? wall : roof, studs: false }))];
  }
  const phase = Math.min(4, Math.floor(progress / 20));
  return parts.filter((p) => p.phase <= phase).filter((p) => health >= 50 || !(p.id.startsWith("roof-") && Number(p.id.split("-")[2]) % 2 === 0 || p.id === "flag"));
}
var architectures = ["neutral", "west", "central", "mideast", "eastasia"];
var slate = "#5d6670";
var tar = "#4a3d30";
var carved = "#6e5438";
var lime = "#e9e1cf";
var sand2 = "#d8c9a6";
var tile = "#3f4a4c";
var gilt = "#c9a55a";
var eave = (id) => id === "roof" || /^roof-0(-|$)/.test(id) || /^(canopy-roof|awning-\d|keep-roof-0|keep-parapet|hoard-roof-.*)$/.test(id);
var ornament = /flag|pole|pennant|banner|finial|vane|rope|bell|debris|style-/;
function regionalParts(parts, style) {
  if (!architectures.includes(style)) throw Error("\u672A\u77E5\u5EFA\u7BC9\u98A8\u683C");
  if (style === "neutral" || parts.length < 2 || !parts.some((p) => p.phase >= 2)) return parts;
  const out = [...parts], base = parts[0], x0 = base.x, x1 = base.x + base.w, z0 = base.z, z1 = base.z + base.d;
  const clash = (a) => out.some((b) => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 1e-8 && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 1e-8 && Math.min(a.z + a.d, b.z + b.d) - Math.max(a.z, b.z) > 1e-8);
  const place = (slot, phase, stack) => {
    if (stack.some(clash) || stack.some((s) => s.x < x0 - 1e-8 || s.z < z0 - 1e-8 || s.x + s.w > x1 + 1e-8 || s.z + s.d > z1 + 1e-8)) return;
    stack.forEach((s, i) => out.push({ id: `style-${style}-${slot}-${i}`, phase, studs: false, ...s }));
  };
  const eaves = parts.filter((p) => eave(p.id));
  if (eaves.length) {
    const y = Math.min(...eaves.map((p) => p.y)), tier = eaves.filter((p) => Math.abs(p.y - y) < 1e-6), top = y + tier[0].h;
    const rx0 = Math.max(x0, Math.min(...tier.map((p) => p.x))), rx1 = Math.min(x1, Math.max(...tier.map((p) => p.x + p.w))), rz0 = Math.max(z0, Math.min(...tier.map((p) => p.z))), rz1 = Math.min(z1, Math.max(...tier.map((p) => p.z + p.d))), c = 0.16;
    for (const [sx, sz] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
      const cx = sx ? rx1 - c : rx0, cz = sz ? rz1 - c : rz0, under = tier.find((p) => p.x <= cx + 1e-8 && p.x + p.w >= cx + c - 1e-8 && p.z <= cz + 1e-8 && p.z + p.d >= cz + c - 1e-8);
      if (!under) continue;
      const ox = sx ? cx + c - 0.1 : cx, oz = sz ? cz + c - 0.1 : cz;
      const stack = style === "eastasia" ? [{ x: cx, z: cz, y: top, w: c, d: c, h: 0.08, color: under.color }, { x: ox, z: oz, y: top + 0.08, w: 0.1, d: 0.1, h: 0.18, color: under.color }] : style === "west" ? [{ x: cx, z: cz, y: top, w: c, d: c, h: 0.3, color: slate }, { x: cx + 0.05, z: cz + 0.05, y: top + 0.3, w: 0.06, d: 0.06, h: 0.2, color: slate }] : style === "central" ? [{ x: cx + 0.02, z: cz + 0.02, y: top, w: 0.12, d: 0.12, h: 0.44, color: tar }, { x: ox, z: oz, y: top + 0.44, w: 0.1, d: 0.1, h: 0.12, color: carved }] : [{ x: cx, z: cz, y: top, w: c, d: c, h: 0.18, color: lime }, { x: cx + 0.04, z: cz + 0.04, y: top + 0.18, w: 0.08, d: 0.08, h: 0.1, color: lime }];
      place(`corner-${sx}${sz}`, under.phase, stack);
    }
  }
  const peak = Math.max(...parts.map((p) => p.y + p.h)), free = parts.slice(1).filter((p) => p.w >= 0.2 && p.d >= 0.2 && !ornament.test(p.id) && p.y + p.h >= 0.6 * peak && !parts.some((o) => o !== p && Math.abs(o.y - p.y - p.h) < 1e-8 && o.x < p.x + p.w && o.x + o.w > p.x && o.z < p.z + p.d && o.z + o.d > p.z)).sort((a, b) => b.y + b.h - (a.y + a.h) || b.w * b.d - a.w * a.d);
  const crowns = free.filter((p) => free.length && Math.abs(p.y + p.h - free[0].y - free[0].h) < 1e-6 && Math.abs(p.w * p.d - free[0].w * free[0].d) < 1e-6);
  crowns.forEach((crown, k) => {
    const top = crown.y + crown.h, cx = crown.x + crown.w / 2, cz = crown.z + crown.d / 2, s = Math.min(crown.w, crown.d), sq = (w, y, h, color) => ({ x: cx - w / 2, z: cz - w / 2, y, w, d: w, h, color });
    let stack = [];
    if (style === "west") {
      const b = Math.min(0.6 * s, 0.6);
      stack = [sq(b, top, 0.2, slate), sq(b * 0.66, top + 0.2, 0.28, slate), sq(b * 0.33, top + 0.48, 0.36, slate), sq(0.06, top + 0.84, 0.26, gilt)];
    } else if (style === "mideast") {
      const b = Math.min(0.7 * s, 0.7);
      stack = [sq(b, top, 0.16, sand2), sq(b * 0.9, top + 0.16, 0.18, lime), sq(b * 0.72, top + 0.34, 0.14, lime), sq(b * 0.48, top + 0.48, 0.12, lime), sq(b * 0.24, top + 0.6, 0.08, lime), sq(0.06, top + 0.68, 0.26, gilt)];
    } else if (style === "eastasia") {
      const e = 0.1, px0 = Math.max(x0, crown.x - e), px1 = Math.min(x1, crown.x + crown.w + e), pz0 = Math.max(z0, crown.z - e), pz1 = Math.min(z1, crown.z + crown.d + e), t = 0.1;
      stack = [{ x: px0, z: pz0, y: top, w: px1 - px0, d: pz1 - pz0, h: 0.08, color: tile }, ...[[px0, pz0], [px1 - t, pz0], [px0, pz1 - t], [px1 - t, pz1 - t]].map(([x, z]) => ({ x, z, y: top + 0.08, w: t, d: t, h: 0.16, color: tile })), sq(Math.min(0.6 * s, 0.6), top + 0.08, 0.2, tile), sq(Math.min(0.3 * s, 0.3), top + 0.28, 0.12, tile), sq(0.1, top + 0.4, 0.2, gilt)];
    } else {
      const alongX = crown.w >= crown.d, L = alongX ? crown.w : crown.d, r = Math.max(0.1, Math.min(0.4 * L, 0.5 * L - 0.12));
      const bar = (a0, a1, y, h, t, color) => alongX ? { x: cx + a0, z: cz - t / 2, y, w: a1 - a0, d: t, h, color } : { x: cx - t / 2, z: cz + a0, y, w: t, d: a1 - a0, h, color };
      stack = [bar(-r, r, top, 0.1, 0.12, tar), bar(-r, -r + 0.1, top + 0.1, 0.5, 0.1, tar), bar(r - 0.1, r, top + 0.1, 0.5, 0.1, tar), bar(-r - 0.12, -r + 0.1, top + 0.6, 0.12, 0.1, carved), bar(r - 0.1, r + 0.12, top + 0.6, 0.12, 0.1, carved)];
    }
    place(`crown-${k}`, crown.phase, stack);
  });
  return out;
}

// packages/content/civs.ts
var mulKinds = ["hp", "cooldown", "speed", "cost", "time", "buildingHp", "arrowCooldown", "healRange", "healRate"];
function fx(id, kind, select, value, text, o = {}) {
  const mul = o.op ? o.op === "mul" : mulKinds.includes(kind);
  return {
    id,
    kind,
    select,
    op: mul ? "mul" : "add",
    value,
    ...o.vs ? { vs: o.vs } : {},
    ...o.resource ? { resource: o.resource } : {},
    ...o.to ? { to: o.to } : {},
    trigger: { ...o.age ? { age: o.age } : {}, ...o.tech ? { tech: o.tech } : {} },
    stacking: mul ? "product" : "sum",
    priority: mul ? 1 : 0,
    scope: o.team ? "team" : "self",
    appliesToExisting: o.existing ?? !["cost", "costShift", "time", "workRate", "startStock", "startVillagers", "deathRefund", "keepHousing", "grant", "producer"].includes(kind),
    text
  };
}
var site = (page) => `aoetw.com/${page}\uFF082026-09-30 \u53D6\u81EA github.com/webrsb/aoetw \u539F\u59CB\u78BC\uFF09`;
var footArchers = { classes: ["archer"], exclude: ["skirmisher", "gunpowder", "cavalry-archer"] };
var infantry = { classes: ["infantry"] };
var neutralCiv = "settlers";
var civDefs = [
  { id: neutralCiv, name: "\u62D3\u8352\u8005", nameEn: "Settlers", type: "\u7121\u52A0\u6210\uFF08\u5747\u8861\u6E2C\u8A66\uFF09", architecture: "neutral", missing: [], missingLater: [], uniqueUnits: [], eliteUpgrades: [], uniqueTechs: [], effects: [], omitted: [], sources: ["\u672C\u4F5C\u539F\u5275\uFF1A\u6C92\u6709\u6587\u660E\u52A0\u6210\u8207\u57CE\u5821\uFF0C\u4F5C\u70BA\u6E2C\u8A66\u8207\u7DF4\u7FD2\u7684\u57FA\u6E96"] },
  {
    id: "britons",
    name: "\u4E0D\u5217\u985B",
    nameEn: "Britons",
    type: "\u5F13\u5175\u6587\u660E",
    architecture: "west",
    missing: ["crop-rotation", "stone-shaft-mining", "redemption", "atonement", "heresy"],
    missingLater: ["hussar", "paladin", "siege-ram", "thumb-ring", "parthian-tactics", "bloodlines", "camel", "bombard-cannon", "elite-cannon-galleon", "missionary", "bombard-tower"],
    uniqueUnits: ["longbowman"],
    eliteUpgrades: ["elite-longbowman"],
    uniqueTechs: [{ id: "yeomen", name: "\u7FA9\u52C7\u9A0E\u5175", nameEn: "Yeomen", age: 3, effectText: "\u5F92\u6B65\u5F13\u5175\u5C04\u7A0B +1\uFF0C\u7BAD\u5854\u653B\u64CA +2" }, { id: "warwolf", name: "\u6230\u72FC\u865F", nameEn: "Warwolf", age: 4, effectText: "\u5DE8\u578B\u6295\u77F3\u6A5F\u7372\u5F97\u7BC4\u570D\u50B7\u5BB3" }],
    effects: [
      fx("britons.archer-range", "range", footArchers, [0, 0, 50, 100], "\u5F92\u6B65\u5F13\u5175\uFF08\u6563\u5175\u9664\u5916\uFF09\u5C04\u7A0B\uFF1A\u7B2C\u4E09\u6642\u4EE3 +1\u3001\u7B2C\u56DB\u6642\u4EE3 +2"),
      fx("britons.shepherds", "gather", { sources: ["livestock"] }, 25, "\u7267\u7F8A\uFF08\u5BB0\u7F8A\u63A1\u96C6\uFF09\u901F\u5EA6 +25%"),
      fx("britons.team-range", "workRate", { buildings: ["archery-range"] }, 20, "\u5718\u968A\u52A0\u6210\uFF1A\u9776\u5834\u751F\u7522\u901F\u5EA6 +20%", { team: true }),
      fx("britons.yeomen-range", "range", { classes: ["archer"], exclude: ["gunpowder", "cavalry-archer"] }, 50, "\u7FA9\u52C7\u9A0E\u5175\uFF1A\u5F92\u6B65\u5F13\u5175\uFF08\u542B\u6563\u5175\uFF09\u5C04\u7A0B +1", { tech: "yeomen" }),
      fx("britons.yeomen-tower", "arrowDamage", { buildings: ["watch-tower"] }, 2, "\u7FA9\u52C7\u9A0E\u5175\uFF1A\u7BAD\u5854\u653B\u64CA +2", { tech: "yeomen" })
    ],
    omitted: [{ text: "\u7B2C\u4E09\u6642\u4EE3\u8D77\u57CE\u93AE\u4E2D\u5FC3\u6728\u6750 -50%", reason: "\u672C\u4F5C\u7684\u57CE\u93AE\u4E2D\u5FC3\u4E0D\u80FD\u53E6\u5916\u5EFA\u9020" }, { text: "\u7279\u6B8A\u79D1\u6280\u300C\u6230\u72FC\u865F\u300D", reason: "\u672C\u4F5C\u9084\u6C92\u6709\u5DE8\u578B\u6295\u77F3\u6A5F" }],
    sources: [site("civs/Britons"), site("units/Longbowman"), site("techs/Yeomen"), site("techs/Warwolf"), site("tree/bri")]
  },
  {
    id: "celts",
    name: "\u585E\u723E\u7279",
    nameEn: "Celts",
    type: "\u6B65\u5175\u8207\u653B\u57CE\u5668\u6587\u660E",
    architecture: "west",
    missing: ["two-man-saw", "crop-rotation", "bracer", "ring-archer-armor", "plate-barding-armor", "redemption", "atonement", "illumination", "block-printing", "theocracy"],
    missingLater: ["arbalest", "thumb-ring", "bloodlines", "camel", "bombard-cannon", "architecture", "missionary", "parthian-tactics", "bombard-tower", "elite-cannon-galleon"],
    uniqueUnits: ["woad-raider"],
    eliteUpgrades: ["elite-woad-raider"],
    uniqueTechs: [{ id: "stronghold", name: "\u5821\u58D8", nameEn: "Stronghold", age: 3, effectText: "\u57CE\u5821\u8207\u7BAD\u5854\u5C04\u901F +25%" }, { id: "furor-celtica", name: "\u585E\u723E\u7279\u72C2\u71B1", nameEn: "Furor Celtica", age: 4, effectText: "\u653B\u57CE\u5668\u5DE5\u574A\u7684\u55AE\u4F4D\u751F\u547D +40%" }],
    effects: [
      fx("celts.lumberjacks", "gather", { resources: ["wood"] }, 15, "\u4F10\u6728\u901F\u5EA6 +15%"),
      fx("celts.infantry-speed", "speed", infantry, [1, 1.15, 1.15, 1.15], "\u7B2C\u4E8C\u6642\u4EE3\u8D77\u6B65\u5175\u79FB\u52D5\u901F\u5EA6 +15%\uFF08\u672C\u4F5C\u4EE5\u6BCF tick \u6574\u6578\u6B65\u9577\u63DB\u7B97\uFF0C\u5BE6\u969B\u7D04 +11%\uFF09"),
      fx("celts.siege-rate", "cooldown", { classes: ["siege"] }, 1 / 1.25, "\u653B\u57CE\u5668\u653B\u64CA\u901F\u5EA6 +25%"),
      fx("celts.team-siege", "workRate", { buildings: ["siege-workshop"] }, 20, "\u5718\u968A\u52A0\u6210\uFF1A\u653B\u57CE\u5668\u5DE5\u574A\u751F\u7522\u901F\u5EA6 +20%", { team: true }),
      fx("celts.stronghold", "arrowCooldown", { buildings: ["castle", "watch-tower"] }, 1 / 1.25, "\u5821\u58D8\uFF1A\u57CE\u5821\u8207\u7BAD\u5854\u5C04\u901F +25%", { tech: "stronghold" }),
      fx("celts.furor", "hp", { classes: ["siege"] }, 1.4, "\u585E\u723E\u7279\u72C2\u71B1\uFF1A\u653B\u57CE\u5668\u751F\u547D +40%", { tech: "furor-celtica" })
    ],
    omitted: [{ text: "\u53EF\u5728\u5C0D\u624B\u55AE\u4F4D\u8996\u91CE\u5167\u6436\u8D70\u5C0D\u624B\u7684\u7F8A", reason: "\u672C\u4F5C\u7684\u6436\u7F8A\u898F\u5247\u4E0D\u770B\u8996\u91CE\uFF08\u5DF1\u65B9\u5EFA\u7BC9 4 \u683C\u5167\u7684\u7F8A\u672C\u4F86\u5C31\u4E0D\u6703\u88AB\u6436\uFF09" }],
    sources: [site("civs/Celts"), site("units/Woad_Raider"), site("techs/Stronghold"), site("techs/Furor_Celtica"), site("tree/cel")]
  },
  {
    id: "franks",
    name: "\u6CD5\u862D\u514B",
    nameEn: "Franks",
    type: "\u9A0E\u5175\u6587\u660E",
    architecture: "west",
    missing: ["two-man-saw", "stone-shaft-mining", "bracer", "ring-archer-armor", "redemption"],
    missingLater: ["arbalest", "hussar", "siege-ram", "keep", "thumb-ring", "parthian-tactics", "bloodlines", "camel", "bombard-tower", "heated-shot", "shipwright", "elite-cannon-galleon", "missionary"],
    uniqueUnits: ["throwing-axeman"],
    eliteUpgrades: ["elite-throwing-axeman"],
    uniqueTechs: [{ id: "chivalry", name: "\u9A0E\u58EB\u7CBE\u795E", nameEn: "Chivalry", age: 3, effectText: "\u99AC\u5EC4\u751F\u7522\u901F\u5EA6 +40%" }, { id: "bearded-axe", name: "\u5012\u9264\u65A7", nameEn: "Bearded Axe", age: 4, effectText: "\u64F2\u65A7\u5175\u5C04\u7A0B +1" }],
    effects: [
      fx("franks.foragers", "gather", { sources: ["berries"] }, 25, "\u63A1\u6F3F\u679C\u901F\u5EA6 +25%"),
      fx("franks.free-farming", "cost", { entries: ["horse-collar", "heavy-plow", "crop-rotation"] }, 0, "\u78E8\u574A\u7684\u8FB2\u7530\u79D1\u6280\u514D\u8CBB"),
      fx("franks.cavalry-hp", "hp", { kinds: ["scout", "knight"] }, [1, 1.2, 1.2, 1.2], "\u7B2C\u4E8C\u6642\u4EE3\u8D77\u99AC\u5EC4\u55AE\u4F4D\u751F\u547D +20%"),
      fx("franks.castle", "cost", { entries: ["castle"] }, 0.75, "\u57CE\u5821\u4FBF\u5B9C 25%"),
      fx("franks.team-los", "los", { kinds: ["knight"] }, 200, "\u5718\u968A\u52A0\u6210\uFF1A\u9A0E\u58EB\u8996\u91CE +2", { team: true }),
      fx("franks.chivalry", "workRate", { buildings: ["stable"] }, 40, "\u9A0E\u58EB\u7CBE\u795E\uFF1A\u99AC\u5EC4\u751F\u7522\u901F\u5EA6 +40%", { tech: "chivalry" }),
      fx("franks.bearded-axe", "range", { kinds: ["throwing-axeman"] }, 50, "\u5012\u9264\u65A7\uFF1A\u64F2\u65A7\u5175\u5C04\u7A0B +1", { tech: "bearded-axe" })
    ],
    omitted: [],
    sources: [site("civs/Franks"), site("units/Throwing_Axeman"), site("techs/Chivalry"), site("techs/Bearded_Axe"), site("tree/fra")]
  },
  {
    id: "goths",
    name: "\u54E5\u5FB7",
    nameEn: "Goths",
    type: "\u6B65\u5175\u6587\u660E",
    architecture: "central",
    missing: ["gold-shaft-mining", "plate-mail-armor", "plate-barding-armor", "redemption", "atonement", "heresy", "block-printing"],
    missingLater: ["paladin", "arbalest", "siege-ram", "guard-tower", "keep", "camel", "bombard-tower", "thumb-ring", "parthian-tactics", "elite-cannon-galleon", "missionary"],
    uniqueUnits: ["huskarl"],
    eliteUpgrades: ["elite-huskarl"],
    uniqueTechs: [{ id: "anarchy", name: "\u7121\u653F\u5E9C\u72C0\u614B", nameEn: "Anarchy", age: 3, effectText: "\u5175\u71DF\u4E5F\u80FD\u8A13\u7DF4\u54E5\u5FB7\u885B\u968A" }, { id: "perfusion", name: "\u4E95\u5674", nameEn: "Perfusion", age: 4, effectText: "\u5175\u71DF\u751F\u7522\u901F\u5EA6 +100%" }],
    effects: [
      fx("goths.infantry-cost", "cost", { entries: ["militia", "spearman", "huskarl"] }, [0.8, 0.75, 0.7, 0.65], "\u6B65\u5175\u4FBF\u5B9C\uFF1A\u7B2C\u4E00\u81F3\u7B2C\u56DB\u6642\u4EE3 -20% / -25% / -30% / -35%"),
      fx("goths.infantry-buildings", "bonus", infantry, [0, 1, 2, 3], "\u6B65\u5175\u5C0D\u5EFA\u7BC9\u653B\u64CA\uFF1A\u7B2C\u4E8C\u81F3\u7B2C\u56DB\u6642\u4EE3 +1 / +2 / +3", { vs: "building" }),
      fx("goths.boar", "huntDamage", { prey: ["boar"] }, 5, "\u6751\u6C11\u6253\u91CE\u8C6C\u653B\u64CA +5"),
      fx("goths.hunter-carry", "carry", { sources: ["hunt"] }, 15, "\u7375\u4EBA\u651C\u5E36\u91CF +15"),
      fx("goths.pop", "popCap", {}, [0, 0, 0, 10], "\u7B2C\u56DB\u6642\u4EE3\u4EBA\u53E3\u4E0A\u9650 +10"),
      fx("goths.loom", "time", { entries: ["loom"] }, 0, "\u7E54\u5E03\u6A5F\u7ACB\u5373\u5B8C\u6210\uFF08\u4ECD\u9700\u4ED8\u8CBB\uFF09"),
      fx("goths.team-barracks", "workRate", { buildings: ["barracks"] }, 20, "\u5718\u968A\u52A0\u6210\uFF1A\u5175\u71DF\u751F\u7522\u901F\u5EA6 +20%", { team: true }),
      fx("goths.anarchy", "producer", { entries: ["huskarl"], buildings: ["barracks"] }, 1, "\u7121\u653F\u5E9C\u72C0\u614B\uFF1A\u5175\u71DF\u4E5F\u80FD\u8A13\u7DF4\u54E5\u5FB7\u885B\u968A", { tech: "anarchy" }),
      fx("goths.perfusion", "workRate", { buildings: ["barracks"] }, 100, "\u4E95\u5674\uFF1A\u5175\u71DF\u751F\u7522\u901F\u5EA6 +100%", { tech: "perfusion" })
    ],
    omitted: [],
    sources: [site("civs/Goths"), site("units/Huskarl"), site("techs/Anarchy"), site("techs/Perfusion"), site("tree/got")]
  },
  {
    id: "teutons",
    name: "\u689D\u9813",
    nameEn: "Teutons",
    type: "\u6B65\u5175\u6587\u660E",
    architecture: "central",
    missing: ["bracer", "light-cavalry", "gold-shaft-mining"],
    missingLater: ["arbalest", "hussar", "siege-ram", "thumb-ring", "camel", "parthian-tactics", "architecture", "shipwright", "elite-cannon-galleon"],
    uniqueUnits: ["teutonic-knight"],
    eliteUpgrades: ["elite-teutonic-knight"],
    uniqueTechs: [{ id: "ironclad", name: "\u92FC\u9435\u7532", nameEn: "Ironclad", age: 3, effectText: "\u653B\u57CE\u5668\u8FD1\u6230\u8B77\u7532 +4" }, { id: "crenellations", name: "\u7832\u9580\u579B\u53E3", nameEn: "Crenellations", age: 4, effectText: "\u57CE\u5821\u5C04\u7A0B +3\uFF0C\u9032\u99D0\u7684\u6B65\u5175\u4E5F\u6703\u5C04\u7BAD" }],
    effects: [
      fx("teutons.heal-range", "healRange", {}, 2, "\u50E7\u4FB6\u6CBB\u7642\u8DDD\u96E2\u5169\u500D"),
      fx("teutons.tower-garrison", "garrison", { buildings: ["watch-tower"] }, 5, "\u7BAD\u5854\u53EF\u99D0\u7D2E\u5169\u500D\u55AE\u4F4D"),
      fx("teutons.farms", "cost", { entries: ["farm"] }, 0.6, "\u8FB2\u7530\u4FBF\u5B9C 40%"),
      fx("teutons.tc-garrison", "garrison", { buildings: ["town-center"] }, 10, "\u57CE\u93AE\u4E2D\u5FC3\u99D0\u8ECD +10"),
      fx("teutons.melee-armor", "meleeArmor", { kinds: ["militia", "spearman", "scout", "knight"] }, [0, 0, 1, 2], "\u5175\u71DF\u8207\u99AC\u5EC4\u55AE\u4F4D\u8FD1\u6230\u8B77\u7532\uFF1A\u7B2C\u4E09\u6642\u4EE3 +1\u3001\u7B2C\u56DB\u6642\u4EE3 +2"),
      fx("teutons.team-faith", "conversionResist", {}, 1, "\u5718\u968A\u52A0\u6210\uFF1A\u55AE\u4F4D\u8F03\u96E3\u88AB\u8F49\u5316\uFF08\u6BCF\u540D\u50E7\u4FB6\u7684\u5224\u5B9A\u591A\u4E00\u6B21\u5FC5\u5B9A\u5931\u6557\uFF09", { team: true }),
      fx("teutons.ironclad", "meleeArmor", { classes: ["siege"] }, 4, "\u92FC\u9435\u7532\uFF1A\u653B\u57CE\u5668\u8FD1\u6230\u8B77\u7532 +4", { tech: "ironclad" }),
      fx("teutons.crenellations-range", "arrowRange", { buildings: ["castle"] }, 150, "\u7832\u9580\u579B\u53E3\uFF1A\u57CE\u5821\u5C04\u7A0B +3", { tech: "crenellations" }),
      fx("teutons.crenellations-infantry", "garrisonArrows", { buildings: ["castle"], classes: ["infantry"] }, 1, "\u7832\u9580\u579B\u53E3\uFF1A\u9032\u99D0\u57CE\u5821\u7684\u6B65\u5175\u5404\u591A\u4E00\u652F\u7BAD", { tech: "crenellations" })
    ],
    omitted: [{ text: "\u514D\u8CBB\u6BBA\u4EBA\u5B54\u8207\u8349\u85E5\u5B78", reason: "\u672C\u4F5C\u9084\u6C92\u6709\u9019\u5169\u9805\u79D1\u6280" }],
    sources: [site("civs/Teutons"), site("units/Teutonic_Knight"), site("techs/Ironclad"), site("techs/Crenellations"), site("tree/teu")]
  },
  {
    id: "vikings",
    name: "\u7DAD\u4EAC",
    nameEn: "Vikings",
    type: "\u6B65\u5175\u8207\u6D77\u8ECD\u6587\u660E",
    architecture: "central",
    missing: ["stone-shaft-mining", "plate-barding-armor", "redemption", "sanctity", "illumination", "theocracy"],
    missingLater: ["halberdier", "hussar", "paladin", "keep", "herbal-medicine", "camel", "bombard-tower", "fire-ship", "bloodlines", "parthian-tactics", "bombard-cannon", "elite-cannon-galleon", "shipwright", "missionary"],
    uniqueUnits: ["berserk"],
    eliteUpgrades: ["elite-berserk"],
    uniqueTechs: [{ id: "chieftains", name: "\u914B\u9577", nameEn: "Chieftains", age: 3, effectText: "\u6B65\u5175\u5C0D\u9A0E\u5175\u653B\u64CA +5" }, { id: "berserkergang", name: "\u72C2\u6230\u58EB\u5E6B", nameEn: "Berserkergang", age: 4, effectText: "\u72C2\u6230\u58EB\u56DE\u8840\u901F\u5EA6\u5169\u500D" }],
    effects: [
      fx("vikings.infantry-hp", "hp", infantry, [1, 1.1, 1.15, 1.2], "\u6B65\u5175\u751F\u547D\uFF1A\u7B2C\u4E8C\u6642\u4EE3 +10%\u3001\u7B2C\u4E09\u6642\u4EE3 +15%\u3001\u7B2C\u56DB\u6642\u4EE3 +20%"),
      fx("vikings.wheelbarrow", "grant", { entries: ["wheelbarrow"] }, 1, "\u5347\u5230\u7B2C\u4E8C\u6642\u4EE3\u6642\u514D\u8CBB\u5F97\u5230\u624B\u63A8\u8ECA", { age: 2 }),
      fx("vikings.hand-cart", "grant", { entries: ["hand-cart"] }, 1, "\u5347\u5230\u7B2C\u4E09\u6642\u4EE3\u6642\u514D\u8CBB\u5F97\u5230\u624B\u62C9\u8ECA", { age: 3 }),
      fx("vikings.chieftains", "bonus", infantry, 5, "\u914B\u9577\uFF1A\u6B65\u5175\u5C0D\u9A0E\u5175\u653B\u64CA +5", { vs: "cavalry", tech: "chieftains" }),
      fx("vikings.berserkergang", "regen", { kinds: ["berserk"] }, 20, "\u72C2\u6230\u58EB\u5E6B\uFF1A\u72C2\u6230\u58EB\u6BCF\u5206\u9418\u56DE\u8840 20 \u2192 40", { tech: "berserkergang" })
    ],
    omitted: [{ text: "\u6230\u8239\u4FBF\u5B9C 15% / 15% / 20%", reason: "\u672C\u4F5C\u9084\u6C92\u6709\u8239\u96BB" }, { text: "\u5718\u968A\u52A0\u6210\uFF1A\u78BC\u982D\u4FBF\u5B9C 15%", reason: "\u672C\u4F5C\u9084\u6C92\u6709\u78BC\u982D" }, { text: "\u914B\u9577\uFF1A\u6B65\u5175\u5C0D\u99F1\u99DD\u9A0E\u5175 +4", reason: "\u672C\u4F5C\u9084\u6C92\u6709\u99F1\u99DD\u9A0E\u5175" }, { text: "\u7279\u6B8A\u55AE\u4F4D\u7DAD\u4EAC\u5927\u6230\u8239", reason: "\u672C\u4F5C\u9084\u6C92\u6709\u6D77\u6230" }],
    sources: [site("civs/Vikings"), site("units/Berserk"), site("techs/Chieftains"), site("techs/Berserkergang"), site("tree/vik")]
  },
  {
    id: "byzantines",
    name: "\u62DC\u5360\u5EAD",
    nameEn: "Byzantines",
    type: "\u9632\u79A6\u6587\u660E",
    architecture: "mideast",
    missing: ["blast-furnace"],
    missingLater: ["herbal-medicine", "bloodlines", "parthian-tactics", "missionary", "heated-shot", "heavy-scorpion", "bombard-tower", "architecture"],
    uniqueUnits: ["cataphract"],
    eliteUpgrades: ["elite-cataphract"],
    uniqueTechs: [{ id: "greek-fire", name: "\u5E0C\u81D8\u4E4B\u706B", nameEn: "Greek Fire", age: 3, effectText: "\u706B\u6230\u8239\u5C04\u7A0B +1" }, { id: "logistica", name: "\u5F8C\u52E4", nameEn: "Logistica", age: 4, effectText: "\u62DC\u5360\u5EAD\u8056\u9A0E\u5175\u8E10\u8E0F\u50B7\u5BB3\uFF0C\u5C0D\u6B65\u5175 +6" }],
    effects: [
      fx("byzantines.building-hp", "buildingHp", {}, [1.1, 1.2, 1.3, 1.4], "\u5EFA\u7BC9\u751F\u547D\uFF1A\u7B2C\u4E00\u81F3\u7B2C\u56DB\u6642\u4EE3 +10% / +20% / +30% / +40%"),
      fx("byzantines.counter-cost", "cost", { entries: ["spearman", "skirmisher"] }, 0.75, "\u9577\u69CD\u5175\u8207\u6563\u5175\u4FBF\u5B9C 25%"),
      fx("byzantines.imperial", "cost", { entries: ["age-4"] }, 0.67, "\u5347\u7B2C\u56DB\u6642\u4EE3\u4FBF\u5B9C 33%"),
      fx("byzantines.team-heal", "healRate", {}, 1.5, "\u5718\u968A\u52A0\u6210\uFF1A\u50E7\u4FB6\u6CBB\u7642\u901F\u5EA6 +50%", { team: true }),
      fx("byzantines.logistica", "bonus", { kinds: ["cataphract"] }, 6, "\u5F8C\u52E4\uFF1A\u62DC\u5360\u5EAD\u8056\u9A0E\u5175\u5C0D\u6B65\u5175 +6", { vs: "infantry", tech: "logistica" }),
      fx("byzantines.trample", "splash", { kinds: ["cataphract"] }, 5, "\u5F8C\u52E4\uFF1A\u62DC\u5360\u5EAD\u8056\u9A0E\u5175\u653B\u64CA\u6642\uFF0C\u76EE\u6A19\u65C1\u7684\u6575\u5175\u53D7 5 \u9EDE\u8E10\u8E0F\u50B7\u5BB3", { tech: "logistica" })
    ],
    omitted: [{ text: "\u706B\u6230\u8239\u653B\u64CA\u901F\u5EA6 +20%", reason: "\u672C\u4F5C\u9084\u6C92\u6709\u8239\u96BB" }, { text: "\u5C01\u5EFA\u6642\u4EE3\u514D\u8CBB\u57CE\u93AE\u77AD\u671B", reason: "\u672C\u4F5C\u9084\u6C92\u6709\u57CE\u93AE\u77AD\u671B" }, { text: "\u99F1\u99DD\u9A0E\u5175\u4FBF\u5B9C 25%", reason: "\u672C\u4F5C\u9084\u6C92\u6709\u99F1\u99DD\u9A0E\u5175" }, { text: "\u7279\u6B8A\u79D1\u6280\u300C\u5E0C\u81D8\u4E4B\u706B\u300D", reason: "\u672C\u4F5C\u9084\u6C92\u6709\u706B\u6230\u8239" }],
    sources: [site("civs/Byzantines"), site("units/Cataphract"), site("techs/Greek_Fire"), site("techs/Logistica"), site("tree/byz")]
  },
  {
    id: "persians",
    name: "\u6CE2\u65AF",
    nameEn: "Persians",
    type: "\u9A0E\u5175\u6587\u660E",
    architecture: "mideast",
    missing: ["bracer", "redemption", "atonement", "heresy", "sanctity", "illumination"],
    missingLater: ["two-handed-swordsman", "champion", "arbalest", "keep", "shipwright", "bombard-tower", "missionary"],
    uniqueUnits: ["war-elephant"],
    eliteUpgrades: ["elite-war-elephant"],
    uniqueTechs: [{ id: "kamandaran", name: "\u6CE2\u65AF\u5F13\u5175", nameEn: "Kamandaran", age: 3, effectText: "\u5F13\u624B\u6539\u7528\u6728\u6750\u652F\u4ED8\u539F\u672C\u7684\u9EC3\u91D1" }, { id: "mahouts", name: "\u8C61\u4F15", nameEn: "Mahouts", age: 4, effectText: "\u6230\u8C61\u79FB\u52D5\u901F\u5EA6 +30%" }],
    effects: [
      fx("persians.food", "startStock", {}, 50, "\u958B\u5C40\u98DF\u7269 +50", { resource: "food" }),
      fx("persians.wood", "startStock", {}, 50, "\u958B\u5C40\u6728\u6750 +50", { resource: "wood" }),
      fx("persians.tc-hp", "buildingHp", { buildings: ["town-center"] }, 2, "\u57CE\u93AE\u4E2D\u5FC3\u751F\u547D\u5169\u500D"),
      fx("persians.tc-rate", "workRate", { buildings: ["town-center"] }, [0, 10, 15, 20], "\u57CE\u93AE\u4E2D\u5FC3\u751F\u7522\u8207\u7814\u7A76\u901F\u5EA6\uFF1A\u7B2C\u4E8C\u81F3\u7B2C\u56DB\u6642\u4EE3 +10% / +15% / +20%"),
      fx("persians.team-knights", "bonus", { kinds: ["knight"] }, 2, "\u5718\u968A\u52A0\u6210\uFF1A\u9A0E\u58EB\u5C0D\u5F13\u5175\u653B\u64CA +2", { vs: "archer", team: true }),
      fx("persians.kamandaran", "costShift", { entries: ["archer"] }, 1, "\u6CE2\u65AF\u5F13\u5175\uFF1A\u5F13\u624B\u7684\u9EC3\u91D1\u6539\u4EE5\u6728\u6750\u652F\u4ED8", { resource: "gold", to: "wood", tech: "kamandaran" }),
      fx("persians.mahouts", "speed", { kinds: ["war-elephant"] }, 1.3, "\u8C61\u4F15\uFF1A\u6230\u8C61\u79FB\u52D5\u901F\u5EA6 +30%", { tech: "mahouts" })
    ],
    omitted: [{ text: "\u78BC\u982D\u751F\u547D\u5169\u500D\u3001\u78BC\u982D\u5DE5\u4F5C\u901F\u5EA6\u63D0\u5347", reason: "\u672C\u4F5C\u9084\u6C92\u6709\u78BC\u982D" }],
    sources: [site("civs/Persians"), site("units/War_Elephant"), site("techs/Kamandaran"), site("techs/Mahouts"), site("tree/pre")]
  },
  {
    id: "saracens",
    name: "\u85A9\u62C9\u68EE",
    nameEn: "Saracens",
    type: "\u99F1\u99DD\u8207\u6D77\u8ECD\u6587\u660E",
    architecture: "mideast",
    missing: ["crop-rotation", "stone-shaft-mining"],
    missingLater: ["halberdier", "cavalier", "paladin", "heavy-scorpion", "bombard-tower", "architecture", "heated-shot", "shipwright", "missionary"],
    uniqueUnits: ["mameluke"],
    eliteUpgrades: ["elite-mameluke"],
    uniqueTechs: [{ id: "madrasah", name: "\u7A46\u65AF\u6797\u5B78\u588A", nameEn: "Madrasah", age: 3, effectText: "\u50E7\u4FB6\u6B7B\u4EA1\u6642\u8FD4\u9084 33 \u9EC3\u91D1" }, { id: "zealotry", name: "\u72C2\u71B1", nameEn: "Zealotry", age: 4, effectText: "\u99F1\u99DD\u9A0E\u5175\u8207\u963F\u62C9\u4F2F\u5974\u96B8\u5175\u751F\u547D +30" }],
    effects: [
      fx("saracens.archer-buildings", "bonus", footArchers, [0, 1, 2, 3], "\u5F13\u5175\u5C0D\u5EFA\u7BC9\u653B\u64CA\uFF1A\u7B2C\u4E8C\u81F3\u7B2C\u56DB\u6642\u4EE3 +1 / +2 / +3", { vs: "building" }),
      fx("saracens.team-archers", "bonus", footArchers, 2, "\u5718\u968A\u52A0\u6210\uFF1A\u5F92\u6B65\u5F13\u5175\u5C0D\u5EFA\u7BC9\u653B\u64CA +2", { vs: "building", team: true }),
      fx("saracens.madrasah", "deathRefund", { kinds: ["monk"] }, 33, "\u7A46\u65AF\u6797\u5B78\u588A\uFF1A\u50E7\u4FB6\u6B7B\u4EA1\u6642\u8FD4\u9084 33 \u9EC3\u91D1", { tech: "madrasah" }),
      fx("saracens.zealotry", "hp", { kinds: ["mameluke"] }, 30, "\u72C2\u71B1\uFF1A\u963F\u62C9\u4F2F\u5974\u96B8\u5175\u751F\u547D +30", { tech: "zealotry", op: "add" })
    ],
    omitted: [{ text: "\u5E02\u96C6\u4EA4\u6613\u8CBB 5%\u3001\u5E02\u96C6\u4FBF\u5B9C 100 \u6728\u6750", reason: "\u672C\u4F5C\u9084\u6C92\u6709\u5E02\u96C6" }, { text: "\u904B\u8F38\u8239\u751F\u547D\u5169\u500D\u3001\u904B\u8F09 +5\uFF1B\u6230\u8239\u653B\u64CA\u901F\u5EA6 +25%", reason: "\u672C\u4F5C\u9084\u6C92\u6709\u8239\u96BB" }, { text: "\u99AC\u5F13\u9A0E\u5175\u5C0D\u5EFA\u7BC9\u518D +1", reason: "\u672C\u4F5C\u7684\u85A9\u62C9\u68EE\u6C92\u6709\u99AC\u5F13\u9A0E\u5175" }, { text: "\u72C2\u71B1\uFF1A\u99F1\u99DD\u9A0E\u5175\u751F\u547D +30", reason: "\u672C\u4F5C\u9084\u6C92\u6709\u99F1\u99DD\u9A0E\u5175" }],
    sources: [site("civs/Saracens"), site("units/Mameluke"), site("techs/Madrasah"), site("techs/Zealotry"), site("tree/sar")]
  },
  {
    id: "turks",
    name: "\u571F\u8033\u5176",
    nameEn: "Turks",
    type: "\u706B\u85E5\u6587\u660E",
    architecture: "mideast",
    missing: ["pikeman", "elite-skirmisher", "stone-shaft-mining", "faith", "illumination"],
    missingLater: ["halberdier", "arbalest", "paladin", "herbal-medicine"],
    uniqueUnits: ["janissary"],
    eliteUpgrades: ["elite-janissary"],
    uniqueTechs: [{ id: "sipahi", name: "\u91C7\u9091\u9A0E\u5175", nameEn: "Sipahi", age: 3, effectText: "\u99AC\u5F13\u9A0E\u5175\u8207\u6A19\u69CD\u9A0E\u5175\u751F\u547D +20" }, { id: "artillery", name: "\u7832\u5175", nameEn: "Artillery", age: 4, effectText: "\u706B\u7832\u3001\u706B\u7832\u5854\u3001\u706B\u7832\u6230\u8239\u5C04\u7A0B +2" }],
    effects: [
      fx("turks.gunpowder-hp", "hp", { classes: ["gunpowder"] }, 1.25, "\u706B\u85E5\u55AE\u4F4D\u751F\u547D +25%"),
      fx("turks.gold", "gather", { resources: ["gold"] }, 20, "\u63A1\u91D1\u901F\u5EA6 +20%"),
      fx("turks.free-light-cavalry", "cost", { entries: ["light-cavalry"] }, 0, "\u65A5\u5019\u7CFB\u5347\u7D1A\u514D\u8CBB"),
      fx("turks.scout-armor", "pierceArmor", { kinds: ["scout"] }, 1, "\u65A5\u5019\u7CFB\u9060\u7A0B\u8B77\u7532 +1"),
      fx("turks.team-gunpowder", "time", { entries: ["janissary"] }, 1 / 1.25, "\u5718\u968A\u52A0\u6210\uFF1A\u706B\u85E5\u55AE\u4F4D\u8A13\u7DF4\u901F\u5EA6 +25%", { team: true })
    ],
    omitted: [{ text: "\u706B\u85E5\u79D1\u6280\u4FBF\u5B9C 50%\u3001\u514D\u8CBB\u5316\u5B78", reason: "\u672C\u4F5C\u9084\u6C92\u6709\u5927\u5B78\u8207\u706B\u85E5\u79D1\u6280" }, { text: "\u7279\u6B8A\u79D1\u6280\u300C\u91C7\u9091\u9A0E\u5175\u300D", reason: "\u672C\u4F5C\u7684\u571F\u8033\u5176\u6C92\u6709\u99AC\u5F13\u9A0E\u5175" }, { text: "\u7279\u6B8A\u79D1\u6280\u300C\u7832\u5175\u300D", reason: "\u672C\u4F5C\u9084\u6C92\u6709\u706B\u7832\u8207\u706B\u7832\u5854" }],
    sources: [site("civs/Turks"), site("units/Janissary"), site("techs/Sipahi"), site("techs/Artillery"), site("tree/tur")]
  },
  {
    id: "chinese",
    name: "\u4E2D\u570B",
    nameEn: "Chinese",
    type: "\u5F13\u5175\u6587\u660E",
    architecture: "eastasia",
    missing: ["crop-rotation", "redemption", "heresy"],
    missingLater: ["hussar", "paladin"],
    uniqueUnits: ["chu-ko-nu"],
    eliteUpgrades: ["elite-chu-ko-nu"],
    uniqueTechs: [{ id: "great-wall", name: "\u9577\u57CE", nameEn: "Great Wall", age: 3, effectText: "\u7BAD\u5854\u8207\u57CE\u7246\u751F\u547D +30%" }, { id: "rocketry", name: "\u706B\u7BAD\u6280\u8853", nameEn: "Rocketry", age: 4, effectText: "\u9023\u5F29\u5175\u653B\u64CA +2\uFF0C\u5F29\u7832\u653B\u64CA +4" }],
    effects: [
      fx("chinese.villagers", "startVillagers", {}, 3, "\u958B\u5C40\u591A 3 \u540D\u6751\u6C11"),
      fx("chinese.food", "startStock", {}, -200, "\u958B\u5C40\u98DF\u7269 -200", { resource: "food" }),
      fx("chinese.wood", "startStock", {}, -50, "\u958B\u5C40\u6728\u6750 -50", { resource: "wood" }),
      fx("chinese.tc-housing", "housing", { buildings: ["town-center"] }, 5, "\u57CE\u93AE\u4E2D\u5FC3\u53EF\u4F4F 10 \u4EBA"),
      fx("chinese.tc-los", "los", { buildings: ["town-center"] }, 500, "\u57CE\u93AE\u4E2D\u5FC3\u8996\u91CE +5"),
      fx("chinese.techs", "cost", { allTechs: true, exclude: ["age-2", "age-3", "age-4"] }, [1, 0.9, 0.85, 0.8], "\u79D1\u6280\u4FBF\u5B9C\uFF1A\u7B2C\u4E8C\u81F3\u7B2C\u56DB\u6642\u4EE3 -10% / -15% / -20%"),
      fx("chinese.team-farms", "farmFood", {}, 45, "\u5718\u968A\u52A0\u6210\uFF1A\u8FB2\u7530\u98DF\u7269 +45", { team: true }),
      fx("chinese.great-wall", "buildingHp", { buildings: ["watch-tower"] }, 1.3, "\u9577\u57CE\uFF1A\u7BAD\u5854\u751F\u547D +30%", { tech: "great-wall" }),
      fx("chinese.rocketry", "attack", { kinds: ["chu-ko-nu"] }, 2, "\u706B\u7BAD\u6280\u8853\uFF1A\u9023\u5F29\u5175\u653B\u64CA +2", { tech: "rocketry" })
    ],
    omitted: [{ text: "\u7206\u7834\u8239\u751F\u547D +50%", reason: "\u672C\u4F5C\u9084\u6C92\u6709\u8239\u96BB" }, { text: "\u706B\u7BAD\u6280\u8853\u7684\u5F29\u7832 +4", reason: "\u672C\u4F5C\u9084\u6C92\u6709\u5F29\u7832" }, { text: "\u9577\u57CE\u7684\u57CE\u7246 +30%", reason: "\u672C\u4F5C\u9084\u6C92\u6709\u57CE\u7246" }],
    sources: [site("civs/Chinese"), site("units/Chu_Ko_Nu"), site("techs/Great_Wall"), site("techs/Rocketry"), site("tree/chi")]
  },
  {
    id: "japanese",
    name: "\u65E5\u672C",
    nameEn: "Japanese",
    type: "\u6B65\u5175\u6587\u660E",
    architecture: "eastasia",
    missing: ["crop-rotation", "stone-shaft-mining", "plate-barding-armor", "heresy"],
    missingLater: ["paladin", "siege-ram", "camel", "bombard-cannon", "bombard-tower", "heated-shot", "architecture", "missionary"],
    uniqueUnits: ["samurai"],
    eliteUpgrades: ["elite-samurai"],
    uniqueTechs: [{ id: "yasama", name: "\u5C04\u7BAD\u5B54", nameEn: "Yasama", age: 3, effectText: "\u7BAD\u5854\u591A\u5C04\u5169\u652F\u7BAD" }, { id: "kataparuto", name: "\u5F48\u5C04\u5668", nameEn: "Kataparuto", age: 4, effectText: "\u5DE8\u578B\u6295\u77F3\u6A5F\u7D44\u88DD\u8207\u5C04\u901F\u63D0\u5347" }],
    effects: [
      fx("japanese.camps", "cost", { entries: ["lumber-camp", "mining-camp", "mill"] }, 0.5, "\u4F10\u6728\u5834\u3001\u63A1\u7926\u5834\u3001\u78E8\u574A\u4FBF\u5B9C 50%"),
      fx("japanese.infantry-rate", "cooldown", infantry, [1, 0.9, 0.85, 0.75], "\u6B65\u5175\u653B\u64CA\u901F\u5EA6\uFF1A\u7B2C\u4E8C\u81F3\u7B2C\u56DB\u6642\u4EE3 +10% / +15% / +25%"),
      fx("japanese.yasama", "arrows", { buildings: ["watch-tower"] }, 2, "\u5C04\u7BAD\u5B54\uFF1A\u7BAD\u5854\u591A\u5C04\u5169\u652F\u7BAD", { tech: "yasama" })
    ],
    omitted: [{ text: "\u6F01\u8239\u751F\u547D\u5169\u500D\u3001\u9060\u7A0B\u8B77\u7532 +2\u3001\u5DE5\u4F5C\u901F\u5EA6\u63D0\u5347", reason: "\u672C\u4F5C\u9084\u6C92\u6709\u6F01\u8239" }, { text: "\u5718\u968A\u52A0\u6210\uFF1A\u6230\u8239\u8996\u91CE +50%", reason: "\u672C\u4F5C\u9084\u6C92\u6709\u8239\u96BB" }, { text: "\u7279\u6B8A\u79D1\u6280\u300C\u5F48\u5C04\u5668\u300D", reason: "\u672C\u4F5C\u9084\u6C92\u6709\u5DE8\u578B\u6295\u77F3\u6A5F" }],
    sources: [site("civs/Japanese"), site("units/Samurai"), site("techs/Yasama"), site("techs/Kataparuto"), site("tree/jap")]
  },
  {
    id: "mongols",
    name: "\u8499\u53E4",
    nameEn: "Mongols",
    type: "\u99AC\u5F13\u9A0E\u5175\u6587\u660E",
    architecture: "eastasia",
    missing: ["two-man-saw", "crop-rotation", "plate-barding-armor", "ring-archer-armor", "redemption", "sanctity", "faith", "block-printing"],
    missingLater: ["paladin", "keep", "halberdier", "bombard-cannon", "bombard-tower", "elite-cannon-galleon", "heated-shot", "architecture"],
    uniqueUnits: ["mangudai"],
    eliteUpgrades: ["elite-mangudai"],
    uniqueTechs: [{ id: "nomads", name: "\u6E38\u7267", nameEn: "Nomads", age: 3, effectText: "\u6C11\u5C45\u88AB\u6467\u6BC0\u5F8C\u4EBA\u53E3\u4E0A\u9650\u4E0D\u4E0B\u964D" }, { id: "drill", name: "\u947F\u5CA9\u6A5F", nameEn: "Drill", age: 4, effectText: "\u653B\u57CE\u5668\u5DE5\u574A\u7684\u55AE\u4F4D\u79FB\u52D5\u901F\u5EA6 +50%" }],
    effects: [
      fx("mongols.horse-archers", "cooldown", { classes: ["cavalry-archer"] }, 1 / 1.2, "\u99AC\u5F13\u9A0E\u5175\u5C04\u901F +20%"),
      fx("mongols.light-cavalry", "hp", { kinds: ["scout"] }, 1.3, "\u8F15\u9A0E\u5175\u751F\u547D +30%", { tech: "light-cavalry" }),
      fx("mongols.hunters", "gather", { sources: ["hunt"] }, 40, "\u6253\u7375\u901F\u5EA6 +40%"),
      fx("mongols.team-scouts", "los", { kinds: ["scout"] }, 200, "\u5718\u968A\u52A0\u6210\uFF1A\u65A5\u5019\u8996\u91CE +2", { team: true }),
      fx("mongols.nomads", "keepHousing", { buildings: ["house"] }, 1, "\u6E38\u7267\uFF1A\u6C11\u5C45\u88AB\u6467\u6BC0\u5F8C\u4EBA\u53E3\u4E0A\u9650\u4E0D\u4E0B\u964D", { tech: "nomads" }),
      fx("mongols.drill", "speed", { classes: ["siege"] }, 1.5, "\u947F\u5CA9\u6A5F\uFF1A\u653B\u57CE\u5668\u79FB\u52D5\u901F\u5EA6 +50%", { tech: "drill" })
    ],
    omitted: [],
    sources: [site("civs/Mongols"), site("units/Mangudai"), site("techs/Nomads"), site("techs/Drill"), site("tree/mon")]
  }
];
var uniqueUnitOwner = Object.fromEntries(civDefs.flatMap((c) => [...c.uniqueUnits, ...c.eliteUpgrades, ...c.uniqueTechs.map((t) => t.id)].map((id) => [id, c.id])));
var civById = (id) => civDefs.find((c) => c.id === id);

// packages/sim/terrain.ts
var terrainRules = { provenance: "design_default", size: 16, tileSize: 100, maxLandStep: 25, resourceCapacity: { tree: 300, stone: 250, gold: 250, berries: 150, hunt: 120, livestock: 100, fish: 200, farm: 250 }, generationAttempts: 8 };
var resourceDefinitions = { tree: { yield: "wood", method: "gather", movement: "land" }, stone: { yield: "stone", method: "gather", movement: "land" }, gold: { yield: "gold", method: "gather", movement: "land" }, berries: { yield: "food", method: "gather", movement: "land" }, hunt: { yield: "food", method: "hunt", movement: "land" }, livestock: { yield: "food", method: "herd", movement: "land" }, fish: { yield: "food", method: "fish", movement: "water" }, farm: { yield: "food", method: "gather", movement: "land" } };
var mapSizes = { meadow: 16, coast: 16, acceptance: 16, open: 32 };
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
  if (!(layout in mapSizes)) throw Error("\u672A\u77E5\u5730\u5716\u6A21\u5F0F");
  const size = mapSizes[layout];
  return Array.from({ length: size * size }, (_, id) => {
    const x = id % size, y = Math.floor(id / size);
    let terrainType = layout !== "open" && y === 8 ? "road" : "grass";
    if (layout === "coast") {
      const edge = 12 + (seed >>> 0 >>> Math.floor(x / 4) & 1);
      if (y >= edge) terrainType = "water";
      else if (y === edge - 1) terrainType = "sand";
    }
    if (layout === "acceptance") {
      if (x === 7 || x === 8) terrainType = y >= 7 && y <= 9 ? "shallow" : "water";
      else if (x === 6 || x === 9) terrainType = "sand";
    }
    const tile2 = { id, terrainType, ...terrainDefinitions[terrainType], resourceRefs: [], obstacleRefs: [] };
    if (layout === "acceptance") {
      if (x >= 2 && x <= 5 && y >= 11 && y <= 14) {
        tile2.terrainType = x === 2 && y === 11 ? "cliff" : x === 3 && y === 13 ? "stone" : "highland";
        Object.assign(tile2, terrainDefinitions[tile2.terrainType]);
        tile2.height = 100;
      }
      if (x === 4 && y >= 8 && y <= 10) {
        tile2.terrainType = "road";
        tile2.height = (y - 7) * 25;
        tile2.buildability = false;
      }
    }
    return tile2;
  });
}
var sizeOfTiles = (tiles) => Math.round(Math.sqrt(tiles.length));
function groundHeight(tiles, x, y) {
  return tiles[tileAt(x, y, sizeOfTiles(tiles))]?.height ?? 0;
}
function tileAt(x, y, size) {
  return Math.floor(y / 100) * size + Math.floor(x / 100);
}
function canTraverse(tile2, movement) {
  return tile2.walkClass === movement || tile2.walkClass === "both";
}

// packages/sim/navigation.ts
var navigationRules = { provenance: "design_default", spacing: 50, size: 31, radius: 25, expansionsPerTick: 128, speedPerTick: 5, maxGroupSize: 40, waitLimit: 8, queueWaitFactor: 4, detourLimit: 12, stuckTicks: 300, arrivalRadius: 150 };
var startingResourceRules = { provenance: "design_default", maxApproachDistance: 1200, maxNearestDistanceDifference: 500, minimum: { tree: 300, stone: 250, gold: 250, berries: 150 } };
var tables = /* @__PURE__ */ new WeakMap();
function blockedTable(map) {
  let t = tables.get(map);
  if (!t || t.list !== map.blocked || t.length !== map.blocked.length || t.revision !== map.navigationRevision) {
    const table = new Uint8Array(nodeTotal(map));
    for (const n of map.blocked) table[n] = 1;
    t = { list: map.blocked, length: map.blocked.length, revision: map.navigationRevision, table };
    tables.set(map, t);
  }
  return t.table;
}
function nodesNear(map, box, pad) {
  const side = sideOf(map), out = [];
  const x0 = Math.max(0, Math.ceil((box[0] - pad - 50) / 50)), x1 = Math.min(side - 1, Math.floor((box[2] + pad - 50) / 50)), y0 = Math.max(0, Math.ceil((box[1] - pad - 50) / 50)), y1 = Math.min(side - 1, Math.floor((box[3] + pad - 50) / 50));
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) out.push(y * side + x);
  return out;
}
var sideOf = (map) => map.size * 2 - 1;
var nodeTotal = (map) => sideOf(map) ** 2;
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
  if (layout === "open") return generateOpen(seed);
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
  const map = { size: mapSizes[layout], starts: [[{ x: 350, y: 700 }, { x: 450, y: 700 }, { x: 400, y: 800 }], [{ x: 1150, y: 700 }, { x: 1250, y: 700 }, { x: 1200, y: 800 }]], obstacles, blocked: [], tiles: createTiles(layout, seed), resources: [], navigationRevision: 0, generationAttempt: 0 };
  obstacles.forEach((o, index) => {
    o.id = `obstacle-${index}`;
    map.tiles[tileAt(o.x, o.y, map.size)].obstacleRefs.push(o.id);
    if (!isBuilding(o)) {
      const kind = o.kind === "rock" ? "stone" : o.kind;
      const id = `resource-${index}`, capacity = terrainRules.resourceCapacity[kind];
      map.resources.push({ id, kind, x: o.x, y: o.y, capacity, remaining: capacity, collectible: true, status: "available", obstacleId: o.id, depletedAt: null });
      map.tiles[tileAt(o.x, o.y, map.size)].resourceRefs.push(id);
    }
  });
  const addFish = (x, y) => {
    const id = `resource-fish-${x}-${y}`, capacity = terrainRules.resourceCapacity.fish;
    map.resources.push({ id, kind: "fish", x, y, capacity, remaining: capacity, collectible: true, status: "available", obstacleId: null, depletedAt: null });
    map.tiles[tileAt(x, y, map.size)].resourceRefs.push(id);
  };
  if (layout === "coast") for (const x of [300, 1200]) addFish(x, (12 + (seed >>> 0 >>> Math.floor(x / 400) & 1)) * 100 + 50);
  if (layout === "acceptance") for (const y of [300, 1200]) addFish(800, y);
  for (let i = 0; i < nodeTotal(map); i++) if (!clearSegment(map, position(map, i), position(map, i))) map.blocked.push(i);
  map.animals = [];
  [300, 1200].forEach((x, player) => flock(map, "sheep", x + 25, 925, 4, 200, player));
  for (const x of [500, 1e3]) flock(map, "deer", x + 25, 1025, 4);
  return map;
}
function flock(map, kind, x, y, count, within = 200, owner, open = 0) {
  const closed = blockedTable(map), taken = new Set([...map.starts.flat(), ...map.scouts ?? [], ...map.animals ?? []].map((p) => nodeAt(map, p)));
  const roomy = (n) => !open || nodesNear(map, [position(map, n).x, position(map, n).y, position(map, n).x, position(map, n).y], 100).filter((m) => !closed[m]).length >= open;
  const nodes = nodesNear(map, [x, y, x, y], within).filter((n) => !closed[n] && !taken.has(n) && roomy(n)).map((n) => ({ n, d: Math.abs(position(map, n).x - x) + Math.abs(position(map, n).y - y) })).sort((a, b) => a.d - b.d || a.n - b.n);
  for (const { n } of nodes.slice(0, count)) (map.animals ??= []).push({ kind, ...position(map, n), ...owner === void 0 ? {} : { owner } });
}
var openMapRules = {
  provenance: "design_default",
  size: 32,
  radius: [0.29, 0.34],
  oppositeJitter: Math.PI / 8,
  // Clear area around each town centre (the gate faces south, villagers start there): offsets from its centre.
  apron: { left: -320, top: -320, right: 320, bottom: 620 },
  // Kit: offsets from the town centre, identical for every player (the gate always faces south), so each base
  // has the same distances. margin: room the whole kit needs round a town centre (left, top, right, bottom).
  kit: [{ kind: "tree", dx: 0, dy: -560, group: 6 }, { kind: "gold", dx: 520, dy: -60 }, { kind: "rock", dx: -520, dy: -60 }, { kind: "berries", dx: 480, dy: 360 }, { kind: "livestock", dx: -480, dy: 340 }, { kind: "hunt", dx: 0, dy: 780 }],
  margin: { left: -700, top: -760, right: 700, bottom: 900 },
  forestClumps: 10,
  clumpTrees: [6, 13],
  clumpClearance: 1050,
  borderWood: 0.45,
  borderClearance: 750,
  neutral: { gold: 2, rock: 2 },
  neutralRadius: 650,
  dirtPatches: 7,
  // Animals per base (kit flock, kit herd, a boar and two more sheep farther out) and the shared pond.
  animals: { sheep: 4, deer: 3, boarDistance: 950, farSheepDistance: 1050 },
  pond: { size: 3, baseDistance: 1100, fairness: 300 }
};
function generateOpen(seed) {
  let rng = seed || 1;
  const random = () => {
    rng ^= rng << 13;
    rng ^= rng >>> 17;
    rng ^= rng << 5;
    return (rng >>> 0) / 4294967296;
  };
  const R = openMapRules, size = R.size, world = size * 100, mid = world / 2, tiles = createTiles("open", seed);
  for (let i = 0; i < R.dirtPatches; i++) {
    let tx = 2 + Math.floor(random() * (size - 4)), ty = 2 + Math.floor(random() * (size - 4));
    for (let k = 0; k < 4 + Math.floor(random() * 6); k++) {
      const t = tiles[ty * size + tx];
      Object.assign(t, { terrainType: "sand", ...terrainDefinitions.sand });
      tx = Math.min(size - 2, Math.max(1, tx + Math.floor(random() * 3) - 1));
      ty = Math.min(size - 2, Math.max(1, ty + Math.floor(random() * 3) - 1));
    }
  }
  const a0 = random() * Math.PI * 2, angles = [a0, a0 + Math.PI + (random() * 2 - 1) * R.oppositeJitter], centres = angles.map((a) => {
    const r = world * (R.radius[0] + random() * (R.radius[1] - R.radius[0]));
    const cx = Math.min(world - R.margin.right, Math.max(-R.margin.left, mid + Math.cos(a) * r)), cy = Math.min(world - R.margin.bottom, Math.max(-R.margin.top, mid + Math.sin(a) * r));
    const ax = Math.round((cx - 135 - 15) / 50) * 50 + 15, ay = Math.round((cy - 135) / 50) * 50;
    return { ax, ay, x: ax + 135, y: ay + 135 };
  });
  const obstacles = centres.map((c, p) => ({ kind: "town-center", x: c.ax, y: c.ay, ...p ? { red: true } : {} }));
  const starts = centres.map((c) => [{ x: c.ax + 85, y: c.ay + 350 }, { x: c.ax + 185, y: c.ay + 350 }, { x: c.ax + 135, y: c.ay + 450 }]), scouts = centres.map((c) => ({ x: c.ax + 235, y: c.ay + 450 }));
  const taken = /* @__PURE__ */ new Set(), aprons = centres.map((c) => [c.x + R.apron.left, c.y + R.apron.top, c.x + R.apron.right, c.y + R.apron.bottom]);
  for (const c of centres) for (let ty = Math.floor((c.y - 150) / 100); ty <= Math.floor((c.y + 150) / 100); ty++) for (let tx = Math.floor((c.x - 150) / 100); tx <= Math.floor((c.x + 150) / 100); tx++) taken.add(ty * size + tx);
  const free = (tx, ty) => tx >= 1 && ty >= 1 && tx < size - 1 && ty < size - 1 && !taken.has(ty * size + tx) && !aprons.some((b) => tx * 100 + 100 > b[0] && tx * 100 < b[2] && ty * 100 + 100 > b[1] && ty * 100 < b[3]);
  const offset = { tree: 12, gold: 15, rock: 15, berries: 15, livestock: 15, hunt: 15 };
  const animals = [];
  let kitOwner = -1;
  const put = (kind, tx, ty) => {
    taken.add(ty * size + tx);
    const x = tx * 100 + offset[kind], y = ty * 100 + offset[kind];
    if (kind === "hunt" || kind === "livestock") animals.push({ kind, x: tx * 100 + 50, y: ty * 100 + 50, base: kitOwner });
    else obstacles.push({ kind, x, y });
  };
  centres.forEach((c, player) => {
    kitOwner = player;
    for (const item of R.kit) {
      let placed = false;
      const d = Math.hypot(item.dx, item.dy), base = Math.atan2(item.dy, item.dx);
      for (let step = 0; step < 24 && !placed; step++) {
        const a = base + (step % 2 ? -1 : 1) * Math.ceil(step / 2) * 15 * Math.PI / 180, tx = Math.floor((c.x + Math.cos(a) * d) / 100), ty = Math.floor((c.y + Math.sin(a) * d) / 100);
        const cells = item.kind === "tree" ? [[0, 0], [1, 0], [0, 1], [1, 1], [-1, 0], [0, -1]].slice(0, item.group ?? 1).map(([dx, dy]) => [tx + dx, ty + dy]) : [[tx, ty]];
        if (cells.every(([x, y]) => free(x, y))) {
          for (const [x, y] of cells) put(item.kind, x, y);
          placed = true;
        }
      }
      if (!placed) continue;
    }
  });
  const far = (tx, ty, d) => centres.every((c) => Math.hypot(tx * 100 + 50 - c.x, ty * 100 + 50 - c.y) >= d);
  for (const [kind, count] of Object.entries(R.neutral)) for (let i = 0; i < count; i++) for (let k = 0; k < 40; k++) {
    const a = random() * Math.PI * 2, d = random() * R.neutralRadius, tx = Math.floor((mid + Math.cos(a) * d) / 100), ty = Math.floor((mid + Math.sin(a) * d) / 100);
    if (free(tx, ty) && far(tx, ty, R.clumpClearance)) {
      put(kind, tx, ty);
      break;
    }
  }
  for (let i = 0; i < R.forestClumps; i++) {
    let tx = 0, ty = 0, ok = false;
    for (let k = 0; k < 60 && !ok; k++) {
      tx = 1 + Math.floor(random() * (size - 2));
      ty = 1 + Math.floor(random() * (size - 2));
      ok = free(tx, ty) && far(tx, ty, R.clumpClearance);
    }
    if (!ok) continue;
    const want = R.clumpTrees[0] + Math.floor(random() * (R.clumpTrees[1] - R.clumpTrees[0] + 1));
    for (let n = 0, k = 0; n < want && k < want * 6; k++) {
      if (free(tx, ty) && far(tx, ty, R.clumpClearance)) {
        put("tree", tx, ty);
        n++;
      }
      const dir = Math.floor(random() * 4);
      tx += dir === 0 ? 1 : dir === 1 ? -1 : 0;
      ty += dir === 2 ? 1 : dir === 3 ? -1 : 0;
      tx = Math.min(size - 2, Math.max(1, tx));
      ty = Math.min(size - 2, Math.max(1, ty));
    }
  }
  for (let ty = 0; ty < size; ty++) for (let tx = 0; tx < size; tx++) {
    if (tx > 0 && ty > 0 && tx < size - 1 && ty < size - 1) continue;
    const v = random();
    if (v < R.borderWood && !taken.has(ty * size + tx) && far(tx, ty, R.borderClearance)) {
      taken.add(ty * size + tx);
      obstacles.push({ kind: "tree", x: tx * 100 + 12, y: ty * 100 + 12 });
    }
  }
  const pond = placePond(seed, size, taken, centres);
  for (const t of pond) Object.assign(tiles[t], { terrainType: "water", ...terrainDefinitions.water });
  const map = { size, starts, scouts, obstacles, blocked: [], tiles, resources: [], navigationRevision: 0, generationAttempt: 0 };
  obstacles.forEach((o, index) => {
    o.id = `obstacle-${index}`;
    map.tiles[tileAt(o.x, o.y, size)].obstacleRefs.push(o.id);
    if (!isBuilding(o)) {
      const kind = o.kind === "rock" ? "stone" : o.kind;
      const id = `resource-${index}`, capacity = terrainRules.resourceCapacity[kind];
      map.resources.push({ id, kind, x: o.x, y: o.y, capacity, remaining: capacity, collectible: true, status: "available", obstacleId: o.id, depletedAt: null });
      map.tiles[tileAt(o.x, o.y, size)].resourceRefs.push(id);
    }
  });
  if (pond.length) {
    const [t0] = pond, tx = t0 % size, ty = Math.floor(t0 / size);
    for (const [dx, dy] of [[1, 0], [0, 1], [2, 1], [1, 2]]) {
      const x = (tx + dx) * 100 + 50, y = (ty + dy) * 100 + 50, id = `resource-fish-${x}-${y}`, capacity = terrainRules.resourceCapacity.fish;
      map.resources.push({ id, kind: "fish", x, y, capacity, remaining: capacity, collectible: true, status: "available", obstacleId: null, depletedAt: null });
      map.tiles[tileAt(x, y, size)].resourceRefs.push(id);
    }
  }
  for (let i = 0; i < nodeTotal(map); i++) if (!clearSegment(map, position(map, i), position(map, i))) map.blocked.push(i);
  map.animals = [];
  for (const { kind, x, y, base } of animals) kind === "livestock" ? flock(map, "sheep", x, y, R.animals.sheep, 200, base) : flock(map, "deer", x, y, R.animals.deer);
  centres.forEach((c) => {
    const away = Math.atan2(c.y - mid, c.x - mid);
    for (const [kind, d, turn, count] of [["boar", R.animals.boarDistance, 0.9, 1], ["sheep", R.animals.farSheepDistance, -1.1, 2]]) flock(map, kind, Math.min(world - 150, Math.max(150, Math.round(c.x + Math.cos(away + turn) * d))), Math.min(world - 150, Math.max(150, Math.round(c.y + Math.sin(away + turn) * d))), count, 300, void 0, 25);
  });
  return map;
}
function placePond(seed, size, taken, centres) {
  const R = openMapRules.pond, spots = [];
  for (let ty = 2; ty + R.size + 1 < size - 1; ty++) for (let tx = 2; tx + R.size + 1 < size - 1; tx++) {
    const c = { x: (tx + R.size / 2) * 100, y: (ty + R.size / 2) * 100 }, [d0, d1] = centres.map((p) => Math.hypot(p.x - c.x, p.y - c.y));
    if (Math.min(d0, d1) < R.baseDistance || Math.abs(d0 - d1) > R.fairness) continue;
    let clear = true;
    for (let y = ty - 1; y <= ty + R.size && clear; y++) for (let x = tx - 1; x <= tx + R.size; x++) if (taken.has(y * size + x)) {
      clear = false;
      break;
    }
    if (clear) spots.push(ty * size + tx);
  }
  if (!spots.length) return [];
  let n = (seed ^ 2654435769) >>> 0 || 1;
  n ^= n << 13;
  n ^= n >>> 17;
  n ^= n << 5;
  n >>>= 0;
  const t0 = spots[n % spots.length], out = [];
  for (let dy = 0; dy < R.size; dy++) for (let dx = 0; dx < R.size; dx++) out.push(t0 + dy * size + dx);
  return out;
}
var buildingKinds = /* @__PURE__ */ new Set(["house", "town-center", "barracks", "farm", "lumber-camp", "mining-camp", "mill", "stable", "archery-range", "monastery", "blacksmith", "watch-tower", "siege-workshop"]);
function isBuilding(o) {
  return buildingKinds.has(o.kind);
}
function bounds(o) {
  return obstacleBounds(o, navigationRules.radius);
}
function clearSegment(map, a, b, movement = "land") {
  const size = map.size, edge = size * 100 - 50;
  if ([a.x, a.y, b.x, b.y].some((v) => !Number.isSafeInteger(v) || v < 50 || v > edge)) return false;
  const maxStep = movement === "land" ? terrainRules.maxLandStep : 0, radius = navigationRules.radius;
  const tx0 = Math.max(0, Math.floor((Math.min(a.x, b.x) - radius) / 100) - 1), tx1 = Math.min(size - 1, Math.floor((Math.max(a.x, b.x) + radius) / 100) + 1), ty0 = Math.max(0, Math.floor((Math.min(a.y, b.y) - radius) / 100) - 1), ty1 = Math.min(size - 1, Math.floor((Math.max(a.y, b.y) + radius) / 100) + 1);
  for (let y = ty0; y <= ty1; y++) for (let x = tx0; x <= tx1; x++) {
    const tile2 = map.tiles[y * size + x];
    if (x < size - 1 && Math.abs(tile2.height - map.tiles[tile2.id + 1].height) > maxStep && intersects(a, b, [(x + 1) * 100 - radius, y * 100 - radius, (x + 1) * 100 + radius, (y + 1) * 100 + radius])) return false;
    if (y < size - 1 && Math.abs(tile2.height - map.tiles[tile2.id + size].height) > maxStep && intersects(a, b, [x * 100 - radius, (y + 1) * 100 - radius, (x + 1) * 100 + radius, (y + 1) * 100 + radius])) return false;
    if (!canTraverse(tile2, movement) && intersects(a, b, [x * 100 - radius, y * 100 - radius, x * 100 + 100 + radius, y * 100 + 100 + radius])) return false;
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
  if (map.tiles.length !== map.size * map.size || map.tiles.some((t, i) => t.id !== i)) return ["\u5730\u683C\u6578\u91CF\u6216 ID \u4E0D\u7B26"];
  const obstacles = new Set(map.obstacles.map((o) => o.id)), resources = new Set(map.resources.map((r) => r.id));
  if (obstacles.size !== map.obstacles.length || obstacles.has(void 0)) errors.push("\u969C\u7919 ID \u91CD\u8907\u6216\u7F3A\u5C11");
  if (resources.size !== map.resources.length) errors.push("\u8CC7\u6E90 ID \u91CD\u8907");
  for (const tile2 of map.tiles) {
    if (!Number.isSafeInteger(tile2.height) || tile2.height < 0) errors.push(`\u5730\u683C ${tile2.id} \u9AD8\u5EA6\u7121\u6548`);
    if (!["land", "water", "both", "blocked"].includes(tile2.walkClass) || typeof tile2.buildability !== "boolean") errors.push(`\u5730\u683C ${tile2.id} \u901A\u884C\u6216\u5EFA\u9020\u898F\u5247\u7121\u6548`);
    if (tile2.resourceRefs.some((id) => !resources.has(id)) || tile2.obstacleRefs.some((id) => !obstacles.has(id))) errors.push(`\u5730\u683C ${tile2.id} \u53C3\u7167\u5931\u6548`);
  }
  for (const r of map.resources) {
    if (!resourceDefinitions[r.kind]) {
      errors.push(`\u8CC7\u6E90 ${r.id} \u985E\u5225\u7121\u6548`);
      continue;
    }
    const cell = map.tiles[tileAt(r.x, r.y, map.size)];
    if (!cell || !canTraverse(cell, resourceDefinitions[r.kind].movement)) errors.push(`\u8CC7\u6E90 ${r.id} \u5730\u5F62\u4E0D\u7B26`);
    if (!Number.isSafeInteger(r.capacity) || r.capacity <= 0 || !Number.isSafeInteger(r.remaining) || r.remaining < 0 || r.remaining > r.capacity) errors.push(`\u8CC7\u6E90 ${r.id} \u5BB9\u91CF\u7121\u6548`);
    if (r.status === "depleted" !== (r.remaining === 0) || r.collectible !== r.remaining > 0 || r.status === "depleted" && (r.obstacleId !== null || r.depletedAt === null)) errors.push(`\u8CC7\u6E90 ${r.id} \u72C0\u614B\u4E0D\u4E00\u81F4`);
    if (r.obstacleId && !obstacles.has(r.obstacleId)) errors.push(`\u8CC7\u6E90 ${r.id} \u969C\u7919\u53C3\u7167\u5931\u6548`);
    if (!map.tiles[tileAt(r.x, r.y, map.size)]?.resourceRefs.includes(r.id)) errors.push(`\u8CC7\u6E90 ${r.id} \u5730\u683C\u53C3\u7167\u5931\u6548`);
  }
  const spawns = [...map.starts.flat(), ...map.scouts ?? [], ...map.animals ?? []];
  if (spawns.some((p) => !clearSegment(map, p, p))) errors.push("\u51FA\u751F\u9EDE\u4E0D\u53EF\u901A\u884C");
  else {
    const job = createPathJob(map, 0, map.starts[0][0], map.starts[1][0]);
    advancePathJob(map, job, nodeTotal(map));
    if (job.status !== "found") errors.push("\u73A9\u5BB6\u51FA\u751F\u5340\u4E92\u4E0D\u9023\u901A");
  }
  return errors;
}
function position(map, id) {
  const side = sideOf(map);
  return { x: 50 + id % side * 50, y: 50 + Math.floor(id / side) * 50 };
}
function nodeAt(map, p) {
  const side = sideOf(map), x = (p.x - 50) / 50, y = (p.y - 50) / 50;
  return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && x < side && y >= 0 && y < side ? y * side + x : -1;
}
function validateStartingResources(map) {
  const errors = [];
  const players = map.starts.map((start) => start[0]).map((spawn, player) => {
    const side = sideOf(map), total = nodeTotal(map), distances = Array(total).fill(Infinity), start = nearest(map, spawn), frontier = [];
    if (start >= 0) {
      distances[start] = Math.abs(position(map, start).x - spawn.x) + Math.abs(position(map, start).y - spawn.y);
      frontier.push(start);
    }
    const closed = blockedTable(map);
    for (let head = 0; head < frontier.length; head++) {
      const id = frontier[head], x = id % side, y = Math.floor(id / side);
      for (const next of [x < side - 1 ? id + 1 : -1, y < side - 1 ? id + side : -1, x > 0 ? id - 1 : -1, y > 0 ? id - side : -1]) if (next >= 0 && !Number.isFinite(distances[next]) && !closed[next] && clearSegment(map, position(map, id), position(map, next))) {
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
        for (let i = 0; i < total; i++) {
          if (!Number.isFinite(distances[i])) continue;
          const p = position(map, i), gap = Math.max(x0 - p.x, 0, p.x - x1) + Math.max(y0 - p.y, 0, p.y - y1);
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
  const closed = blockedTable(map);
  let best = -1, distance = Infinity;
  for (let i = 0; i < nodeTotal(map); i++) {
    const q = position(map, i), d = Math.abs(p.x - q.x) + Math.abs(p.y - q.y);
    if (d < distance && !(movement === "land" ? closed[i] : !clearSegment(map, q, q, movement)) && (outbound ? connector(map, p, q, movement) : connector(map, q, p, movement))) {
      best = i;
      distance = d;
    }
  }
  return best;
}
function createPathJob(map, unitId, from, target, movement = "land") {
  const start = nearest(map, from, true, movement), goal = nearest(map, target, false, movement), parents = Array(nodeTotal(map)).fill(-2);
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
        path.push(position(map, cursor));
        cursor = job.parents[cursor];
      }
      job.path = path.reverse();
      if (job.path.at(-1).x !== job.target.x || job.path.at(-1).y !== job.target.y) job.path.push({ ...job.target });
      job.status = "found";
      break;
    }
    const side = sideOf(map), closed = blockedTable(map), x = id % side, y = Math.floor(id / side);
    for (const next of [x < side - 1 ? id + 1 : -1, y < side - 1 ? id + side : -1, x > 0 ? id - 1 : -1, y > 0 ? id - side : -1]) if (next >= 0 && job.parents[next] === -2 && !(job.movement === "water" ? !clearSegment(map, position(map, next), position(map, next), "water") : closed[next]) && clearSegment(map, position(map, id), position(map, next), job.movement ?? "land")) {
      job.parents[next] = id;
      job.frontier.push(next);
    }
  }
  return used;
}

// apps/web/scene.ts
var weaponOf = (kind) => kind === "militia" || kind === "knight" ? "sword" : kind === "archer" ? "bow" : kind === "scout" || kind === "spearman" || kind === "skirmisher" ? "spear" : kind === "monk" ? "staff" : uniqueWeapon(kind);
var uniqueWeapon = (kind) => {
  const role = roleOf(kind);
  return isMounted(role) ? mounts[role].tool : role === "villager" ? "none" : roleTools[role];
};
var iconUniques = ["longbowman", "woad-raider", "throwing-axeman", "huskarl", "teutonic-knight", "berserk", "cataphract", "war-elephant", "mameluke", "janissary", "chu-ko-nu", "samurai", "mangudai"];
var unitFrame = (kind) => {
  const role = roleOf(kind);
  return role === "war-elephant" ? { bar: 3.05, ring: 2.4 } : isMounted(role) ? { bar: 2.3, ring: 1.8 } : { bar: 1.42, ring: 1 };
};
var architectureOf = (civs, player) => civById(civs?.[player] ?? "")?.architecture ?? "neutral";
var brickStyle = { studPitch: 0.5, plateHeight: 0.16, brickHeight: 0.32, bevel: 0.025, roughness: 0.62, provenance: "original_procedural" };
function farmParts(progress, red2) {
  const out = [{ x: 0, y: 0, z: 0, w: 2, d: 2, h: 0.1, color: "#806b49", studs: false }];
  if (progress < 100) {
    out.push({ x: 0.05, y: 0.1, z: 0.05, w: 0.08, d: 0.08, h: 0.4, color: red2 ? "#b85c47" : "#456e87", studs: false });
    return out;
  }
  for (const z of [0.2, 0.7, 1.2, 1.7]) out.push({ x: 0.15, y: 0.1, z: z - 0.1, w: 1.7, d: 0.2, h: 0.12, color: "#9bb65a", studs: true });
  out.push({ x: 0.05, y: 0.1, z: 0.05, w: 0.08, d: 0.08, h: 0.4, color: red2 ? "#b85c47" : "#456e87", studs: false });
  return out;
}
async function createScene(canvas, onFailure, options = {}) {
  const T = await import(new URL("../../../vendor/three-0.186.0/three.module.js", import.meta.url).href);
  if (!canvas.getContext("webgl2")) throw Error("\u6B64\u88DD\u7F6E\u7121\u6CD5\u5EFA\u7ACB WebGL2\uFF0C\u8ACB\u4F7F\u7528\u652F\u63F4 WebGL2 \u7684\u700F\u89BD\u5668\u3002");
  let contextLost = false, previewLayout = "meadow";
  const renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFShadowMap;
  renderer.setClearColor("#d7e0cc");
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  const detail = createDetailController(T);
  const scene = new T.Scene();
  const camera = new T.OrthographicCamera(-12, 12, 10, -10, 0.1, 100);
  const ambient = new T.HemisphereLight("#fff5dc", "#819b75", 2.1);
  scene.add(ambient);
  const sun = new T.DirectionalLight("#fff1d8", 3);
  sun.position.set(-4, 20, 12);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 1, far: 60 });
  sun.shadow.normalBias = 0.03;
  sun.shadow.radius = 2.2;
  scene.add(sun);
  sun.target.position.set(8, 0, 8);
  scene.add(sun.target);
  const table = new T.Mesh(new T.PlaneGeometry(400, 400), new T.ShadowMaterial({ opacity: 0.24 }));
  table.rotation.x = -Math.PI / 2;
  table.position.y = -0.25;
  table.receiveShadow = true;
  scene.add(table);
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
  scene.add(staticGroup);
  const batches = /* @__PURE__ */ new Map();
  let muted = false, baseHeight = 0, worldTiles = createTiles();
  let platforms = [];
  function standingLift(x, y) {
    let lift = 0;
    for (const p of platforms) if (x >= p.x0 - 25 && x <= p.x1 + 25 && y >= p.y0 - 25 && y <= p.y1 + 25) lift = Math.max(lift, p.height);
    return lift;
  }
  function staticPart(geo, color, x, y, z) {
    if (muted) color = "#737b72";
    const key = geo.uuid + color + "@" + Math.floor(x / 8) + "," + Math.floor(z / 8);
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
      const b = 0.03, shape = new T.Shape();
      shape.moveTo(-0.5 + b, -0.5 + b);
      shape.lineTo(0.5 - b, -0.5 + b);
      shape.lineTo(0.5 - b, 0.5 - b);
      shape.lineTo(-0.5 + b, 0.5 - b);
      shape.closePath();
      const geo = new T.ExtrudeGeometry(shape, { depth: h - 2 * b, bevelEnabled: true, bevelSize: b, bevelThickness: b, bevelSegments: 1, steps: 1, curveSegments: 1 });
      geo.rotateX(-Math.PI / 2);
      geo.translate(0, b, 0);
      geometry.set(key, geo);
      groundGeometries.add(geo);
    }
    staticPart(geometry.get(key), color, x + 0.5, -0.24, z + 0.5);
  }
  let previewBuildingKind = "house", previewStyle = "neutral";
  let previewBuilding = { ageVariant: 2, progress: 100, health: 100 };
  function house(x, z, red2 = false, obstacleKind = "house", progress = 100, age = 2, health = 100, style = "neutral") {
    const kind = options.assetPreview ? previewBuildingKind : obstacleKind, visual = options.assetPreview ? previewBuilding : { ...previewBuilding, progress, health, ageVariant: Math.min(4, Math.max(1, age)) }, parts = regionalParts(kind === "house" ? buildingParts({ ...visual, red: red2 }) : kind === "monastery" ? monasteryParts({ ...visual, red: red2 }) : kind === "blacksmith" ? blacksmithParts({ ...visual, red: red2 }) : kind === "watch-tower" ? towerParts({ ...visual, red: red2 }) : kind === "siege-workshop" ? siegeWorkshopParts({ ...visual, red: red2 }) : kind === "castle" ? castleParts({ ...visual, red: red2 }) : militaryBuildings.includes(kind) ? militaryBuildingParts(kind, { ...visual, red: red2 }) : economicBuildingParts(kind, { ...visual, red: red2 }), kind === "farm" ? "neutral" : options.assetPreview ? previewStyle : style);
    for (const p of parts) brick(x + p.x, z + p.z, p.y, p.w, p.d, p.h, p.color, false, p.shape);
    for (const stud of buildingStuds(parts)) staticPart(studGeo, stud.color, x + stud.x, stud.y, z + stud.z);
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
    baseHeight = 0;
    const map = options.assetPreview ? makeMap(seed, previewLayout) : { tiles: view.terrain.map((tile2, id) => ({ ...tile2, id, resourceRefs: [], obstacleRefs: [] })), obstacles: view.known.map((k) => k.obstacle), resources: view.resources };
    worldTiles = map.tiles;
    board = sizeOfTiles(map.tiles);
    platforms = map.obstacles.flatMap((o) => {
      const p = walkablePlatforms[o.kind];
      return p ? [{ x0: o.x + p.rect[0], y0: o.y + p.rect[1], x1: o.x + p.rect[2], y1: o.y + p.rect[3], height: p.height }] : [];
    });
    let rng = seed || 1;
    for (const tile2 of map.tiles) {
      const x = tile2.id % board, z = Math.floor(tile2.id / board);
      rng ^= rng << 13;
      rng ^= rng >>> 17;
      rng ^= rng << 5;
      const n = (rng >>> 0) / 4294967296;
      groundBlock(x, z, tile2.height / 100, !options.assetPreview && view.fog[tile2.id] !== 2 ? view.fog[tile2.id] === 1 ? "#626e64" : "#293e38" : tile2.terrainType === "cliff" ? "#8a8065" : tile2.terrainType === "stone" ? "#a1a28e" : tile2.terrainType === "highland" ? "#879d69" : tile2.terrainType === "water" ? "#4b8291" : tile2.terrainType === "shallow" ? "#86b7b8" : tile2.terrainType === "sand" ? "#d5c598" : tile2.terrainType === "road" ? "#c4b18a" : n < 0.2 ? "#a6b582" : n < 0.5 ? "#b5c493" : "#becda0");
    }
    for (const o of map.obstacles) {
      baseHeight = groundHeight(map.tiles, o.x, o.y) / 100;
      muted = !options.assetPreview && view.fog[tileAt(o.x, o.y, sizeOfTiles(map.tiles))] !== 2;
      const x = o.x / 100, z = o.y / 100;
      if (o.kind === "farm") for (const p of farmParts(o.progress ?? 100, o.red)) brick(x + p.x, z + p.z, p.y, p.w, p.d, p.h, p.color, p.studs);
      else if (o.kind === "house" || o.kind === "town-center" || o.kind === "barracks" || o.kind === "lumber-camp" || o.kind === "mining-camp" || o.kind === "mill" || o.kind === "stable" || o.kind === "archery-range" || o.kind === "monastery" || o.kind === "blacksmith" || o.kind === "watch-tower" || o.kind === "siege-workshop" || o.kind === "castle") house(x, z, o.red, o.kind, o.progress ?? 100, o.age ?? 2, o.damaged ? 35 : 100, options.assetPreview ? "neutral" : architectureOf(view.civs, o.red ? 1 : 0));
      else if (o.kind === "tree") {
        let v = Math.imul(o.x | 0, 73856093) ^ Math.imul(o.y | 0, 19349663);
        v = Math.imul(v ^ v >>> 16, 73244475);
        v = (v ^ v >>> 16) >>> 0;
        const lift = [0, 0.16, -0.12, 0.08][v & 3], leaf = v >> 2 & 1 ? "#5d824e" : "#67835a";
        brick(x + 0.15, z + 0.15, 0, 0.3, 0.3, 0.8 + lift, "#80664b", false);
        brick(x - 0.2, z - 0.2, 0.7 + lift, 1, 1, 0.4, leaf);
        brick(x - 0.075, z - 0.075, 1.1 + lift, 0.75, 0.75, 0.4, "#7e985f");
        if ((v & 3) !== 2) brick(x + 0.05, z + 0.05, 1.5 + lift, 0.5, 0.5, 0.3, "#91a970");
        if ((v >> 3) % 3 === 0) brick(x + 0.175, z + 0.175, (v & 3) === 2 ? 1.5 + lift : 1.8 + lift, 0.25, 0.25, 0.2, "#91a970", false);
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
    for (const resource of map.resources ?? []) if ((resource.kind === "hunt" || resource.kind === "livestock") && !resource.obstacleId && resource.status === "available") {
      const kind = Object.keys(animalRules.food).find((k) => animalRules.food[k] === resource.capacity) ?? "sheep";
      baseHeight = groundHeight(map.tiles, resource.x, resource.y) / 100;
      muted = false;
      for (const p of carcassParts(kind, resource.remaining / resource.capacity)) brick(resource.x / 100 + p.x, resource.y / 100 + p.z, p.y, p.w, p.d, p.h, p.color, false);
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
      mesh.computeBoundingSphere();
      mesh.userData.studs = geo === studGeo;
      mesh.userData.ground = groundGeometries.has(geo);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      staticGroup.add(mesh);
    }
  }
  const units = /* @__PURE__ */ new Map();
  function relic() {
    const g = new T.Group();
    g.name = "relic";
    for (const p of relicParts) {
      const m = new T.Mesh(box(p.w, p.h, p.d), material(p.color));
      m.position.set(p.x + p.w / 2, p.y, p.z + p.d / 2);
      m.castShadow = true;
      g.add(m);
    }
    return g;
  }
  const relics = /* @__PURE__ */ new Map();
  const arrows2 = /* @__PURE__ */ new Map(), arrowGeo = new T.BoxGeometry(0.04, 0.04, 1), arrowMaterial = new T.MeshBasicMaterial({ color: "#4a3b2a" });
  const fallen = /* @__PURE__ */ new Map();
  const barBack = new T.MeshBasicMaterial({ color: "#2d3a33" }), barGeo = new T.BoxGeometry(0.5, 0.05, 0.05);
  const ringGeo = new T.RingGeometry(0.4, 0.47, 32);
  ringGeo.rotateX(-Math.PI / 2);
  geometry.set("ring", ringGeo);
  const ringMaterial = new T.MeshBasicMaterial({ color: "#fff2a1", side: T.DoubleSide });
  function unit(id, player, kind = "villager") {
    const group = new T.Group();
    scene.add(group);
    const beast = isAnimal(kind), frame = unitFrame(kind), bar = new T.Group();
    bar.position.y = beast ? kind === "deer" ? 1.3 : 0.95 : frame.bar;
    bar.visible = false;
    const back = new T.Mesh(barGeo, barBack);
    const fill = new T.Mesh(barGeo, new T.MeshBasicMaterial({ color: player === 0 ? "#5f9a6a" : player === 1 ? "#c0604c" : "#c9b27a" }));
    fill.position.z = 0.012;
    bar.add(back, fill);
    group.add(bar);
    const rig = beast ? createAnimalRig(T, kind, player, box, material) : kind === "ram" ? createRamRig(T, player, box, material) : createCharacterRig(T, player, box, material);
    if (!beast && kind !== "ram") {
      if (!options.assetPreview && kind !== "villager") rig.dress(roleOf(kind));
      rig.equip(previewTool);
    }
    group.add(rig.root);
    detail.apply(group, zoom);
    const ring = new T.Mesh(ringGeo, ringMaterial);
    ring.position.y = 0.025;
    if (!beast) ring.scale.set(frame.ring, 1, frame.ring);
    group.add(ring);
    units.set(id, { group, rig, ring, player, moving: false, activity: "idle", tool: "none", poseStart: 0, bar, fill, goal: null, kind, relic: null });
    return units.get(id);
  }
  let previewRole = "villager";
  let previewPose = "idle", previewTool = "none", previewAnimated = false, poseStart = 0;
  const focus = { x: 8, y: 0, z: 8 };
  let worldKey = "", angle = Math.PI / 4, zoom = 1, width = 0, height = 0, selected = /* @__PURE__ */ new Set([1]), latest = null;
  let board = 16;
  const minZoom = () => Math.min(0.7, 0.7 * 16 / board);
  function cameraUpdate() {
    if (width <= 0 || height <= 0) return;
    const aspect = width / Math.max(1, height);
    const halfH = Math.max(10.5, 12 / aspect) / zoom;
    sun.target.position.set(focus.x, 0, focus.z);
    sun.position.set(focus.x - 12, 20, focus.z + 4);
    const reach = Math.max(14, halfH * aspect * 1.1);
    Object.assign(sun.shadow.camera, { left: -reach, right: reach, top: reach, bottom: -reach });
    sun.shadow.camera.updateProjectionMatrix();
    camera.left = -halfH * aspect;
    camera.right = halfH * aspect;
    camera.top = halfH;
    camera.bottom = -halfH;
    camera.position.set(focus.x + Math.sin(angle) * 24, focus.y + 24, focus.z + Math.cos(angle) * 24);
    camera.lookAt(focus.x, focus.y, focus.z);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    detail.apply(scene, zoom);
    canvas.dataset.camera = `${focus.x.toFixed(4)},${focus.z.toFixed(4)},${halfH.toFixed(4)},${angle.toFixed(4)}`;
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
  function update(view, ids) {
    latest = view;
    selected = new Set(typeof ids === "number" ? [ids] : ids);
    const key = JSON.stringify([previewBuildingKind, previewBuilding, previewStyle, previewLayout, view.layout, view.seed, view.civs, view.fog, view.known?.map((k) => k.obstacle), view.resources]);
    if (worldKey !== key) {
      worldKey = key;
      const t = performance.now();
      buildWorld(view);
      cameraUpdate();
      canvas.dataset.rebuilds = String(Number(canvas.dataset.rebuilds ?? 0) + 1);
      canvas.dataset.rebuildMs = (performance.now() - t).toFixed(1);
    }
    const alive = new Set(view.units.map((u) => u.id));
    for (const [key2, u] of units) if (!alive.has(key2)) {
      scene.remove(u.group);
      units.delete(key2);
    }
    for (const data of view.units) {
      const kept = units.get(data.id);
      if (kept && kept.player !== data.player) {
        scene.remove(kept.group);
        units.delete(data.id);
      }
      const u = units.get(data.id) ?? unit(data.id, data.player, data.kind);
      const goal = new T.Vector3(data.x / 100, (groundHeight(worldTiles, data.x, data.y) + standingLift(data.x, data.y)) / 100, data.y / 100), from = u.goal ?? u.group.position;
      const dx = goal.x - from.x, dz = goal.z - from.z;
      if (Math.abs(dx) + Math.abs(dz) > 1e-3) u.group.rotation.y = Math.atan2(dx, dz);
      if (!u.goal || options.assetPreview || u.group.position.distanceTo(goal) > 1.5) u.group.position.copy(goal);
      u.goal = goal;
      u.ring.visible = selected.has(data.id);
      u.moving = data.navigation === "moving";
      if (!options.assetPreview && (data.work === "gathering" || data.work === "hunting" || data.action === 1) && !u.moving && data.target) u.group.rotation.y = Math.atan2(data.target.x / 100 - u.group.position.x, data.target.y / 100 - u.group.position.z);
      if (!options.assetPreview) {
        const gathering = (data.work === "gathering" || data.work === "hunting") && !u.moving, activity = u.moving ? data.cargo ? "carry" : "walk" : gathering || data.rite ? "work" : "idle";
        const source = data.work === "gathering" && data.target ? view.resources.find((r) => r.x === data.target.x && r.y === data.target.y && !r.obstacleId) : void 0, food = data.work === "hunting" || source?.kind === "fish" ? "spear" : source ? "sickle" : "basket";
        const weapon = weaponOf(data.kind), tool = data.cargo && activity !== "work" ? "basket" : gathering ? { wood: "axe", stone: "pick", gold: "pick", food }[data.workResource ?? "food"] : weapon;
        if (tool !== u.tool) {
          u.rig.equip(tool);
          u.tool = tool;
        }
        if (data.relic && !u.relic) {
          u.relic = relic();
          u.relic.position.set(0, 0.98, -0.3);
          u.group.add(u.relic);
        } else if (!data.relic && u.relic) {
          u.group.remove(u.relic);
          u.relic = null;
        }
        const next = data.action === 1 && !u.moving ? "attack" : data.action === 2 && !u.moving ? "hit" : activity;
        if (next !== u.activity) u.poseStart = performance.now();
        u.activity = next;
        const share = Math.max(0, data.hp) / Math.max(1, data.maxHp);
        u.bar.visible = share < 1;
        u.fill.scale.x = Math.max(1e-3, share);
        u.fill.position.x = -0.25 * (1 - share);
        u.bar.rotation.y = angle - u.group.rotation.y;
      }
    }
    const spots = new Set((view.relicSpots ?? []).map((r) => r.id));
    for (const [id, g] of relics) if (!spots.has(id)) {
      scene.remove(g);
      relics.delete(id);
    }
    for (const r of view.relicSpots ?? []) {
      let g = relics.get(r.id);
      if (!g) {
        g = relic();
        scene.add(g);
        relics.set(r.id, g);
      }
      g.position.set(r.x / 100, (groundHeight(worldTiles, r.x, r.y) + standingLift(r.x, r.y)) / 100, r.y / 100);
    }
    const flying = new Set((view.shots ?? []).map((v) => `${v.tick}:${v.from.x},${v.from.y}>${v.to.x},${v.to.y}`));
    for (const [k, m] of arrows2) if (!flying.has(k)) {
      scene.remove(m);
      arrows2.delete(k);
    }
    for (const v of view.shots ?? []) {
      const k = `${v.tick}:${v.from.x},${v.from.y}>${v.to.x},${v.to.y}`;
      if (arrows2.has(k)) continue;
      const a = new T.Vector3(v.from.x / 100, groundHeight(worldTiles, v.from.x, v.from.y) / 100 + 2.2, v.from.y / 100), b = new T.Vector3(v.to.x / 100, groundHeight(worldTiles, v.to.x, v.to.y) / 100 + 0.6, v.to.y / 100);
      const m = new T.Mesh(arrowGeo, arrowMaterial);
      m.position.copy(a).lerp(b, 0.5);
      m.scale.z = a.distanceTo(b);
      m.lookAt(b);
      scene.add(m);
      arrows2.set(k, m);
    }
    const lying = new Set((view.corpses ?? []).map((c) => c.id));
    for (const [id, f] of fallen) if (!lying.has(id)) {
      scene.remove(f.group);
      fallen.delete(id);
    }
    for (const c of view.corpses ?? []) if (!fallen.has(c.id)) {
      const group = new T.Group();
      const rig = createCharacterRig(T, c.player, box, material);
      if (c.kind !== "villager") rig.dress(corpseRole(c.kind));
      group.add(rig.root);
      group.position.set(c.x / 100, groundHeight(worldTiles, c.x, c.y) / 100, c.y / 100);
      scene.add(group);
      fallen.set(c.id, { group, rig, start: performance.now() });
    }
  }
  const raycaster = new T.Raycaster(), ground = new T.Plane(new T.Vector3(0, 1, 0), 0);
  function pick(clientX, clientY) {
    const r = canvas.getBoundingClientRect();
    raycaster.setFromCamera(new T.Vector2((clientX - r.left) / r.width * 2 - 1, -(clientY - r.top) / r.height * 2 + 1), camera);
    const hits = detail.withSelectionGeometry(scene, () => visibleMeshHits(raycaster, [...units.values()].map((u) => u.group)));
    if (hits.length) {
      let obj = hits[0].object;
      while (obj.parent && obj.parent !== scene) obj = obj.parent;
      for (const [id, u] of units) if (u.group === obj) return { unitId: id };
    }
    const groundHit = raycaster.intersectObjects(staticGroup.children.filter((mesh) => mesh.userData.ground), false)[0];
    if (groundHit) return { x: groundHit.point.x, y: groundHit.point.z };
    return {};
  }
  const buildingHeights = { "town-center": 2.6, barracks: 2.2, house: 1.9, farm: 0.25, "lumber-camp": 1.9, "mining-camp": 1.9, mill: 2.6, stable: 2.2, "archery-range": 2.2, blacksmith: 2.4, "watch-tower": 3.2, "siege-workshop": 2.2, monastery: 3.4, castle: 4.7 };
  function pickBuilding(clientX, clientY) {
    if (!latest) return;
    const r = canvas.getBoundingClientRect();
    raycaster.setFromCamera(new T.Vector2((clientX - r.left) / r.width * 2 - 1, -(clientY - r.top) / r.height * 2 + 1), camera);
    let best, dist = Infinity;
    const hit = new T.Vector3();
    for (const { obstacle: o } of latest.known) {
      const h = buildingHeights[o.kind];
      if (!h || !o.id) continue;
      const [x0, y0, x1, y1] = obstacleBounds(o), base = groundHeight(worldTiles, o.x, o.y) / 100;
      if (raycaster.ray.intersectBox(new T.Box3(new T.Vector3(x0 / 100, base, y0 / 100), new T.Vector3(x1 / 100, base + h, y1 / 100)), hit)) {
        const d = hit.distanceTo(raycaster.ray.origin);
        if (d < dist) {
          dist = d;
          best = o.id;
        }
      }
    }
    return best;
  }
  function pickGround(clientX, clientY) {
    const r = canvas.getBoundingClientRect();
    raycaster.setFromCamera(new T.Vector2((clientX - r.left) / r.width * 2 - 1, -(clientY - r.top) / r.height * 2 + 1), camera);
    const hit = raycaster.intersectObjects(staticGroup.children.filter((mesh) => mesh.userData.ground), false)[0];
    return hit ? { x: hit.point.x, y: hit.point.z } : {};
  }
  function unitsInRect(x0, y0, x1, y1) {
    const r = canvas.getBoundingClientRect(), out = [], p = new T.Vector3();
    for (const [id, u] of units) {
      if (!u.group.visible) continue;
      p.set(u.group.position.x, u.group.position.y + 0.55, u.group.position.z).project(camera);
      const sx = r.left + (p.x + 1) / 2 * r.width, sy = r.top + (1 - p.y) / 2 * r.height;
      if (sx >= Math.min(x0, x1) && sx <= Math.max(x0, x1) && sy >= Math.min(y0, y1) && sy <= Math.max(y0, y1)) out.push(id);
    }
    return out.sort((a, b) => a - b);
  }
  let lastDraw = 0;
  let zoomGoal = null;
  function draw(time) {
    if (contextLost) return;
    resize();
    const dt = lastDraw ? Math.min(100, Math.max(0, time - lastDraw)) : 0, ease = 1 - Math.exp(-dt / 60);
    lastDraw = time;
    if (zoomGoal !== null) {
      zoom += (zoomGoal - zoom) * (1 - Math.exp(-dt / 70));
      if (Math.abs(zoomGoal - zoom) < 2e-3) {
        zoom = zoomGoal;
        zoomGoal = null;
      }
      cameraUpdate();
    }
    for (const u of units.values()) if (u.goal) {
      if (u.group.position.distanceTo(u.goal) < 2e-3) u.group.position.copy(u.goal);
      else u.group.position.lerp(u.goal, ease);
    }
    stepMarker(time);
    for (const u of units.values()) {
      const pose = options.assetPreview ? previewPose : poseFor(u.kind, u.activity);
      u.rig.pose(pose, options.assetPreview ? previewAnimated ? time - poseStart : pose === "death" ? 700 : pose === "hit" ? 150 : 350 : pose === "hit" ? time - u.poseStart : time);
      u.ring.visible = [...units].some(([id, v]) => v === u && selected.has(id)) && pose !== "death";
    }
    for (const f of fallen.values()) f.rig.pose("death", time - f.start);
    renderer.render(scene, camera);
    if (++frames % 30 === 0) {
      canvas.dataset.draws = String(renderer.info.render.calls);
      canvas.dataset.triangles = String(renderer.info.render.triangles);
    }
  }
  let frames = 0;
  canvas.addEventListener("webglcontextlost", (event) => {
    event.preventDefault();
    contextLost = true;
    canvas.dataset.renderState = "context-lost";
    onFailure(options.assetPreview ? "\u6A21\u578B\u7E6A\u5716\u9023\u7DDA\u4E2D\u65B7\uFF0C\u8ACB\u91CD\u65B0\u8F09\u5165\u6A21\u578B\u9801\u3002" : "3D \u7E6A\u5716\u9023\u7DDA\u4E2D\u65B7\uFF0C\u6A21\u64EC\u5DF2\u66AB\u505C\uFF1B\u8ACB\u91CD\u65B0\u8F09\u5165\u9801\u9762\u5F8C\u8B80\u53D6\u624B\u52D5\u5B58\u6A94\u3002");
  });
  canvas.dataset.renderer = "webgl2";
  canvas.dataset.renderState = "ready";
  const markerGroup = new T.Group(), markerRing = new T.Mesh(new T.RingGeometry(0.22, 0.3, 24), new T.MeshBasicMaterial({ color: "#fff2a1", transparent: true, side: T.DoubleSide, depthWrite: false }));
  markerRing.rotation.x = -Math.PI / 2;
  const markerCross = [0, 1].map((i) => {
    const m = new T.Mesh(new T.BoxGeometry(0.42, 0.02, 0.07), markerRing.material);
    m.rotation.y = Math.PI / 4 + i * Math.PI / 2;
    return m;
  });
  markerGroup.add(markerRing, ...markerCross);
  markerGroup.visible = false;
  scene.add(markerGroup);
  let markerStart = 0;
  const markerColors = { move: "#fff2a1", gather: "#bfe38a", attack: "#e2573f", rally: "#9cc8e6" };
  function setMarker(kind, x, z) {
    markerRing.material.color.set(markerColors[kind] ?? "#fff2a1");
    markerGroup.position.set(x, groundHeight(worldTiles, x * 100, z * 100) / 100 + 0.06, z);
    markerGroup.visible = true;
    markerStart = 0;
  }
  function stepMarker(time) {
    if (!markerGroup.visible) return;
    if (!markerStart) markerStart = time;
    const t = (time - markerStart) / 700;
    if (t >= 1) {
      markerGroup.visible = false;
      return;
    }
    markerRing.material.opacity = 1 - t;
    markerGroup.scale.setScalar(1 + 0.35 * t);
  }
  const rallyFlag = new T.Group();
  {
    const pole = new T.Mesh(box(0.05, 0.9, 0.05), material("#80674f")), cloth = new T.Mesh(box(0.32, 0.2, 0.03), material("#456e87"));
    cloth.position.set(0.17, 0.66, 0);
    rallyFlag.add(pole, cloth);
  }
  rallyFlag.visible = false;
  scene.add(rallyFlag);
  function setRally(p) {
    rallyFlag.visible = !!p;
    if (p) rallyFlag.position.set(p.x, groundHeight(worldTiles, p.x * 100, p.z * 100) / 100, p.z);
  }
  const ghost = new T.Mesh(new T.BoxGeometry(1, 0.3, 1), new T.MeshBasicMaterial({ color: "#6f9d6a", transparent: true, opacity: 0.42, depthWrite: false }));
  ghost.visible = false;
  scene.add(ghost);
  function setGhost(g) {
    ghost.visible = !!g;
    if (!g) return;
    const [x0, y0, x1, y1] = obstacleBounds({ kind: g.kind, x: g.x, y: g.y });
    ghost.scale.set((x1 - x0) / 100, 1, (y1 - y0) / 100);
    ghost.position.set((x0 + x1) / 200, groundHeight(worldTiles, g.x, g.y) / 100 + 0.15, (y0 + y1) / 200);
    ghost.material.color.set(g.ok ? "#6f9d6a" : "#b8574a");
  }
  function renderIcons(size = 160) {
    const off = document.createElement("canvas");
    off.width = off.height = size;
    const r = new T.WebGLRenderer({ canvas: off, antialias: true, alpha: true, preserveDrawingBuffer: true });
    r.outputColorSpace = T.SRGBColorSpace;
    r.toneMapping = T.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.35;
    r.setClearColor(0, 0);
    const s = new T.Scene();
    s.add(new T.HemisphereLight("#fff5dc", "#819b75", 2.6));
    const key = new T.DirectionalLight("#fff1d8", 3);
    key.position.set(-4, 20, 12);
    s.add(key);
    const cam = new T.OrthographicCamera(-1, 1, 1, -1, 0.1, 200), out = {}, corner = new T.Vector3();
    const parts = (list, studs = true) => {
      const g = new T.Group();
      for (const p of list) {
        const m = new T.Mesh(p.shape === "arch" ? arch(p.w - 0.018, p.h, p.d - 0.018) : box(p.w - 0.018, p.h, p.d - 0.018), material(p.color));
        m.position.set(p.x + p.w / 2, p.y, p.z + p.d / 2);
        g.add(m);
      }
      if (studs) for (const st of buildingStuds(list)) {
        const m = new T.Mesh(studGeo, material(st.color));
        m.position.set(st.x, st.y, st.z);
        g.add(m);
      }
      return g;
    };
    const shoot = (name, g, view = { angle: Math.PI / 4, lift: 1 }) => {
      s.add(g);
      g.updateMatrixWorld(true);
      const b = new T.Box3().setFromObject(g), c = b.getCenter(new T.Vector3());
      if (view.crop) c.y = b.min.y + (b.max.y - b.min.y) * view.crop;
      cam.position.set(c.x + Math.sin(view.angle) * 30, c.y + 30 * view.lift, c.z + Math.cos(view.angle) * 30);
      cam.lookAt(c);
      cam.updateMatrixWorld();
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (let i = 0; i < 8; i++) {
        corner.set(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z).applyMatrix4(cam.matrixWorldInverse);
        x0 = Math.min(x0, corner.x);
        x1 = Math.max(x1, corner.x);
        y0 = Math.min(y0, corner.y);
        y1 = Math.max(y1, corner.y);
      }
      const half = view.crop ? (y1 - y0) * (view.span ?? 0.36) : Math.max(x1 - x0, y1 - y0) / 2 * 1.06, cx = (x0 + x1) / 2, cy = view.crop ? 0 : (y0 + y1) / 2;
      Object.assign(cam, { left: cx - half, right: cx + half, top: cy + half, bottom: cy - half });
      cam.updateProjectionMatrix();
      r.render(s, cam);
      out[name] = off.toDataURL("image/png");
      s.remove(g);
    };
    try {
      {
        const rig = createRamRig(T, 0, box, material);
        rig.pose("idle", 0);
        const g = new T.Group();
        g.add(rig.root);
        shoot("ram", g, { angle: Math.PI / 4, lift: 0.5 });
        shoot("ram-face", g, { angle: Math.PI / 4, lift: 0.5 });
      }
      for (const kind of ["sheep", "deer", "boar"]) {
        const rig = createAnimalRig(T, kind, 0, box, material);
        rig.pose("idle", 0);
        const g = new T.Group();
        g.add(rig.root);
        shoot(kind, g, { angle: Math.PI / 3, lift: 0.35 });
        shoot(`${kind}-face`, g, { angle: Math.PI / 3, lift: 0.35 });
      }
      for (const kind of ["villager", "militia", "archer", "scout", "monk", "spearman", "skirmisher", "knight", ...iconUniques]) {
        const rig = createCharacterRig(T, 0, box, material);
        if (kind !== "villager") rig.dress(roleOf(kind));
        rig.equip(weaponOf(kind));
        rig.pose("idle", 0);
        const g = new T.Group();
        g.add(rig.root);
        const role = roleOf(kind);
        shoot(kind, g, { angle: Math.PI / 7, lift: 0.35 });
        shoot(`${kind}-face`, g, role === "war-elephant" ? { angle: Math.PI / 7, lift: 0.35, crop: 0.81, span: 0.15 } : role === "mameluke" || role === "mangudai" ? { angle: Math.PI / 7, lift: 0.35, crop: 0.84, span: 0.23 } : isMounted(role) ? { angle: Math.PI / 7, lift: 0.35, crop: 0.74, span: 0.21 } : { angle: Math.PI / 7, lift: 0.35, crop: 0.72 });
      }
      const visual = (age) => ({ ageVariant: age, progress: 100, health: 100, red: false });
      for (const age of [1, 2, 3, 4]) {
        shoot(`house-${age}`, parts(buildingParts(visual(age))));
        shoot(`barracks-${age}`, parts(militaryBuildingParts("barracks", visual(age))));
        shoot(`stable-${age}`, parts(militaryBuildingParts("stable", visual(age))));
        shoot(`archery-range-${age}`, parts(militaryBuildingParts("archery-range", visual(age))));
        shoot(`monastery-${age}`, parts(monasteryParts(visual(age))));
        shoot(`blacksmith-${age}`, parts(blacksmithParts(visual(age))));
        shoot(`watch-tower-${age}`, parts(towerParts(visual(age))));
        shoot(`siege-workshop-${age}`, parts(siegeWorkshopParts(visual(age))));
        shoot(`castle-${age}`, parts(castleParts(visual(age))));
        shoot(`town-center-${age}`, parts(economicBuildingParts("town-center", visual(age))));
        for (const camp of ["lumber-camp", "mining-camp", "mill"]) shoot(`${camp}-${age}`, parts(economicBuildingParts(camp, visual(age))));
      }
      shoot("farm", parts(farmParts(100, false), false));
      shoot("relic", parts(relicParts.map((p) => ({ ...p, x: p.x + 0.5, z: p.z + 0.5 })), false));
      for (const [id, list] of Object.entries(techIcons)) shoot(`tech-${id}`, parts(list, false));
      const bush = [{ x: 0.05, y: 0, z: 0.05, w: 0.55, d: 0.55, h: 0.45, color: "#5d824e" }, ...[0.12, 0.36].flatMap((x) => [0.12, 0.36].map((z) => ({ x, y: 0.45, z, w: 0.12, d: 0.12, h: 0.12, color: "#a84e59" })))];
      const tree = [{ x: 0.15, y: 0, z: 0.15, w: 0.3, d: 0.3, h: 0.8, color: "#80664b" }, { x: -0.2, y: 0.7, z: -0.2, w: 1, d: 1, h: 0.4, color: "#67835a" }, { x: -0.075, y: 1.1, z: -0.075, w: 0.75, d: 0.75, h: 0.4, color: "#7e985f" }, { x: 0.05, y: 1.5, z: 0.05, w: 0.5, d: 0.5, h: 0.3, color: "#91a970" }];
      const ore = (a, b) => [{ x: 0, y: 0, z: 0, w: 0.65, d: 0.7, h: 0.3, color: a }, { x: 0.15, y: 0.3, z: 0.15, w: 0.35, d: 0.4, h: 0.18, color: b }];
      shoot("food", parts(bush, false));
      shoot("wood", parts(tree, false));
      shoot("gold", parts(ore("#b59a48", "#dec36f"), false));
      shoot("stone", parts(ore("#a19f86", "#b8b39c"), false));
    } finally {
      r.dispose();
      r.forceContextLoss();
    }
    return out;
  }
  const cameraView = () => ({ x: focus.x, z: focus.z, angle, halfW: (camera.right - camera.left) / 2, halfH: (camera.top - camera.bottom) / 2 });
  function setQuality(level) {
    renderer.setPixelRatio(level === "high" ? Math.min(devicePixelRatio, 2) : level === "medium" ? 1 : 0.75);
    width = 0;
    height = 0;
    resize();
    const shadows = level !== "low", size = level === "high" ? 2048 : 1024;
    if (renderer.shadowMap.enabled !== shadows || sun.shadow.mapSize.x !== size) {
      renderer.shadowMap.enabled = shadows;
      sun.castShadow = shadows;
      sun.shadow.mapSize.set(size, size);
      sun.shadow.map?.dispose();
      sun.shadow.map = null;
      for (const m of materials.values()) m.needsUpdate = true;
      table.material.needsUpdate = true;
    }
    canvas.dataset.quality = level;
  }
  return {
    update,
    draw,
    pick,
    pickGround,
    pickBuilding,
    setMarker,
    setRally,
    setQuality,
    unitsInRect,
    setGhost,
    renderIcons,
    cameraView,
    setPreviewBuildingKind: (kind) => {
      if (!options.assetPreview || kind !== "house" && kind !== "castle" && !economicBuildings.includes(kind) && !militaryBuildings.includes(kind)) throw Error("\u672A\u77E5\u6A21\u578B\u5EFA\u7BC9");
      previewBuildingKind = kind;
      if (latest) update(latest, selected);
    },
    setPreviewStyle: (style) => {
      if (!options.assetPreview || !architectures.includes(style)) throw Error("\u672A\u77E5\u5EFA\u7BC9\u98A8\u683C");
      previewStyle = style;
      if (latest) update(latest, selected);
    },
    setPreviewRole: (role) => {
      if (!options.assetPreview || !unitRoles.includes(role) && !isMounted(role)) throw Error("\u50C5\u6A21\u578B\u6AA2\u8996\u53EF\u6307\u5B9A\u6709\u6548\u8ECD\u7A2E");
      previewRole = role;
      previewPose = "idle";
      const ring = role === "war-elephant" ? 2.4 : isMounted(role) ? 1.8 : 1;
      for (const u of units.values()) {
        u.rig.dress(role);
        u.ring.scale.set(ring, 1, ring);
        detail.apply(u.group, zoom);
      }
    },
    setPreviewBuilding: (visual) => {
      if (!options.assetPreview) throw Error("\u50C5\u6A21\u578B\u6AA2\u8996\u53EF\u6307\u5B9A\u5EFA\u7BC9\u5916\u89C0");
      buildingParts({ ...visual, red: false });
      previewBuilding = { ...visual };
      if (latest) update(latest, selected);
    },
    focusPreviewHouse: () => {
      if (!options.assetPreview) throw Error("\u50C5\u6A21\u578B\u6AA2\u8996\u53EF\u805A\u7126\u5EFA\u7BC9");
      focus.x = 4;
      focus.y = 1;
      focus.z = 4.85;
      zoomGoal = null;
      zoom = 2.5;
      cameraUpdate();
    },
    focusPreviewUnit: (id) => {
      if (!options.assetPreview) throw Error("\u50C5\u6A21\u578B\u6AA2\u8996\u53EF\u805A\u7126\u4EE3\u8868\u8CC7\u7522");
      const u = units.get(id);
      if (!u) throw Error("\u627E\u4E0D\u5230\u4EBA\u5076");
      focus.x = u.group.position.x;
      focus.y = u.group.position.y + 0.5;
      focus.z = u.group.position.z;
      zoomGoal = null;
      zoom = 2.5;
      cameraUpdate();
    },
    setPreviewMotion: (pose, tool, animated) => {
      if (!options.assetPreview) throw Error("\u50C5\u6A21\u578B\u6AA2\u8996\u53EF\u6307\u5B9A\u59FF\u614B");
      if (isMounted(previewRole) && !["idle", "walk", "attack"].includes(pose) || !unitPoses.includes(pose) || !unitTools.includes(tool)) throw Error("\u672A\u77E5\u6A21\u578B\u59FF\u614B\u6216\u5DE5\u5177");
      previewPose = pose;
      previewTool = tool;
      previewAnimated = animated;
      poseStart = performance.now();
      for (const u of units.values()) {
        u.rig.equip(tool);
        detail.apply(u.group, zoom);
      }
    },
    setPreviewLayout: (layout) => {
      if (!options.assetPreview) throw Error("\u50C5\u6A21\u578B\u6AA2\u8996\u53EF\u5207\u63DB\u9A57\u6536\u5716");
      if (!["meadow", "coast", "acceptance"].includes(layout)) throw Error("\u672A\u77E5\u5730\u5716\u6A21\u5F0F");
      previewLayout = layout;
      if (latest) update(latest, selected);
    },
    zoom: (delta) => {
      zoomGoal = null;
      zoom = Math.max(minZoom(), Math.min(2.5, zoom + delta));
      cameraUpdate();
    },
    wheelZoom: (delta) => {
      const goal = Math.max(minZoom(), Math.min(2.5, (zoomGoal ?? zoom) + delta));
      if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
        zoomGoal = null;
        zoom = goal;
        cameraUpdate();
      } else zoomGoal = goal;
    },
    rotate: () => {
      angle += Math.PI / 2;
      cameraUpdate();
    },
    // Screen-aligned pan (right, away from camera), scaled by zoom and clamped to the board.
    pan: (right, up) => {
      const step = 1.2 / zoom, c = Math.cos(angle), s = Math.sin(angle);
      focus.x = Math.max(0, Math.min(board, focus.x + (c * right - s * up) * step));
      focus.z = Math.max(0, Math.min(board, focus.z + (-s * right - c * up) * step));
      cameraUpdate();
    },
    // Opening view of a match: the home town centre, close enough that the base fills the window (wide or tall).
    focusHome: (x, z) => {
      resize();
      const aspect = width / Math.max(1, height), halfH = Math.max(10.5, 12 / aspect);
      zoomGoal = null;
      zoom = Math.max(1, Math.min(2.5, Math.max(halfH * aspect / 10, halfH / 6)));
      focus.x = Math.max(0, Math.min(board, x));
      focus.z = Math.max(0, Math.min(board, z));
      cameraUpdate();
    },
    focusOn: (x, z) => {
      focus.x = Math.max(0, Math.min(board, x));
      focus.z = Math.max(0, Math.min(board, z));
      cameraUpdate();
    },
    resetCamera: () => {
      focus.x = board / 2;
      focus.y = 0;
      focus.z = board / 2;
      zoomGoal = null;
      zoom = Math.max(minZoom(), 16 / board);
      angle = Math.PI / 4;
      cameraUpdate();
    },
    dispose: () => {
      renderer.dispose();
      detail.dispose();
      for (const geo of geometry.values()) geo.dispose();
      for (const m of materials.values()) m.dispose();
      ringMaterial.dispose();
    },
    stats: () => ({ detail: detailLevel(zoom), drawCalls: renderer.info.render.calls, triangles: renderer.info.render.triangles, geometries: renderer.info.memory.geometries })
  };
}
export {
  architectureOf,
  brickStyle,
  createScene,
  farmParts,
  unitFrame,
  weaponOf
};
