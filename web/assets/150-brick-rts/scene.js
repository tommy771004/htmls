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
  const p = [], team2 = v.red ? "#b85c47" : "#456e87", wood6 = "#94734c", stone6 = "#b5b29e", top = 1.44 + (v.ageVariant - 1) * 0.16;
  const add = (id, phase, x, z, y, w, d, h, color, studs = false, shape) => p.push({ id, phase, x, z, y, w, d, h, color, studs, ...shape ? { shape } : {} });
  add("foundation", 0, -0.15, -0.15, 0, 3, 3, 0.16, "#b3aa8c");
  if (kind === "archery-range") {
    for (const x of [0.1, 2.5]) {
      add(`fence-post-${x}`, 1, x, 0.12, 0.16, 0.13, 2.1, 0.5, wood6);
    }
    add("backstop", 1, 0.1, 0.12, 0.16, 2.53, 0.18, 1.1, wood6);
    for (const x of [0.36, 1.67]) {
      add(`target-leg-${x}`, 2, x + 0.23, 0.75, 0.16, 0.1, 0.2, 0.75, wood6);
      add(`target-board-${x}`, 2, x, 0.72, 0.83, 0.56, 0.16, 0.6, "#cfbd87");
      add(`target-ring-${x}`, 3, x + 0.1, 0.88, 0.93, 0.36, 0.03, 0.4, "#aa5c48");
      add(`target-center-${x}`, 3, x + 0.2, 0.91, 1.03, 0.16, 0.03, 0.2, "#e5d4a8");
    }
    add("arrow-rack", 3, 0.22, 2.3, 0.16, 0.7, 0.27, 0.4, wood6);
    for (let i = 0; i < 4; i++) add(`arrow-${i}`, 3, 0.3 + i * 0.14, 2.4, 0.56, 0.03, 0.03, 0.42, "#d2be8f");
  } else {
    for (const x of [0.1, 2.44]) for (const z of [0.1, 1.65]) add(`post-${x}-${z}`, 1, x, z, 0.16, 0.16, 0.16, top - 0.16, v.ageVariant >= 3 ? stone6 : wood6);
    add("back-wall", 1, 0.1, 0.1, 0.16, 2.5, 0.15, top - 0.16, kind === "stable" ? wood6 : stone6);
    for (let level = 0; level < 3; level++) add(`roof-${level}`, 2, -0.05 + level * 0.28, -0.05, top + level * 0.16, 2.9 - level * 0.56, 1.98, 0.16, v.ageVariant === 1 ? "#b8a074" : team2, true);
    if (kind === "barracks") {
      add("drill-floor", 1, 0.3, 1.85, 0.16, 2.1, 0.85, 0.08, "#a59a76");
      add("weapon-rack", 3, 0.3, 0.5, 0.16, 0.15, 1.1, 0.75, wood6);
      for (let i = 0; i < 3; i++) {
        add(`spear-shaft-${i}`, 3, 0.32, 0.6 + i * 0.3, 0.16, 0.04, 0.04, 1.15, wood6);
        add(`spear-point-${i}`, 3, 0.28, 0.58 + i * 0.3, 1.31, 0.12, 0.08, 0.2, "#bdc5bd");
      }
      for (const x of [0.5, 1.05, 1.6]) {
        add(`shield-support-${x}`, 3, x, 1.9, 0.24, 0.08, 0.15, 0.62, wood6);
        add(`shield-${x}`, 3, x - 0.08, 2.02, 0.43, 0.36, 0.08, 0.44, team2);
        add(`shield-boss-${x}`, 3, x + 0.04, 2.1, 0.57, 0.1, 0.04, 0.12, "#bca36f");
      }
    } else {
      for (const x of [0.15, 1.75]) {
        add(`stall-divider-${x}`, 1, x, 0.35, 0.16, 0.1, 1.3, 0.65, wood6);
        add(`hay-${x}`, 3, x + 0.16, 0.4, 0.16, 0.62, 0.55, 0.3, "#beac69", true);
      }
      add("trough-base", 3, 0.6, 2.03, 0.16, 1.5, 0.4, 0.12, wood6);
      for (const z of [2.03, 2.35]) add(`trough-rim-${z}`, 3, 0.6, z, 0.28, 1.5, 0.08, 0.2, wood6);
      for (const x of [0.6, 2.02]) add(`trough-end-${x}`, 3, x, 2.11, 0.28, 0.08, 0.24, 0.2, wood6);
      add("trough-water", 3, 0.69, 2.12, 0.28, 1.32, 0.22, 0.035, "#6a9297");
      add("saddle-rack", 3, 2.48, 0.9, 0.16, 0.12, 0.15, 0.85, wood6);
      add("spare-saddle", 3, 2.3, 0.84, 1.01, 0.45, 0.4, 0.16, "#716045");
    }
  }
  if (v.ageVariant >= 2) {
    if (kind === "archery-range") {
      for (const x of [0.1, 2.44]) add(`canopy-post-${x}`, 1, x, 0.12, 0.16, 0.16, 0.18, top - 0.16, wood6);
      add("canopy-beam", 1, 0.1, 0.12, top, 2.5, 0.18, 0.16, wood6);
      add("canopy-roof", 2, -0.05, -0.02, top + 0.16, 2.8, 0.7, 0.16, team2, true);
    } else {
      for (const x of [0.1, 2.44]) add(`porch-foot-${x}`, 1, x - 0.07, 1.58, 0.16, 0.3, 0.3, 0.32, stone6);
      add("porch-beam", 1, 0.1, 1.65, top - 0.16, 2.5, 0.16, 0.16, wood6);
      add("ridge-cap", 2, 0.79, -0.05, top + 0.48, 1.22, 1.98, 0.16, team2, true);
    }
  }
  if (v.ageVariant >= 3) {
    if (kind === "archery-range") {
      add("stone-backstop", 1, 0.1, -0.04, 0.16, 2.5, 0.16, 1.28, stone6);
      for (const x of [0.1, 2.3]) add(`backstop-buttress-${x}`, 1, x, 0.13, 0.16, 0.3, 0.35, 1.12, stone6);
      for (let i = 0; i < 5; i++) add(`backstop-crenel-${i}`, 2, 0.1 + i * 0.5, -0.04, 1.44, 0.3, 0.16, 0.24, stone6, true);
    } else {
      for (const z of [0.1, 1.6]) for (const x of [-0.05, 2.6]) add(`buttress-${x}-${z}`, 1, x, z, 0.16, 0.15, 0.3, top - 0.16, stone6);
      add("porch-arch", 1, 0.26, 1.65, 0.16, 2.18, 0.16, top - 0.16, stone6, false, "arch");
    }
  }
  if (v.ageVariant === 4) {
    if (kind === "archery-range") {
      for (const x of [0.1, 2.2]) {
        add(`turret-base-${x}`, 2, x, 0.05, top + 0.32, 0.4, 0.4, 0.16, stone6);
        for (const dx of [0, 0.28]) add(`turret-post-${x}-${dx}`, 3, x + dx, 0.05, top + 0.48, 0.12, 0.4, 0.48, stone6);
        add(`turret-cap-${x}`, 3, x - 0.05, 0, top + 0.96, 0.5, 0.5, 0.16, team2, true);
      }
    } else {
      const base = top + 0.64;
      add("vent-base", 2, 0.91, 0.5, base, 0.96, 0.8, 0.16, stone6);
      for (const x of [0.91, 1.71]) for (const z of [0.5, 1.14]) add(`vent-post-${x}-${z}`, 3, x, z, base + 0.16, 0.16, 0.16, 0.48, stone6);
      add("vent-cap", 3, 0.83, 0.42, base + 0.64, 1.12, 0.96, 0.16, team2, true);
      add("vent-crown", 4, 1.07, 0.58, base + 0.8, 0.64, 0.64, 0.16, team2, true);
    }
  }
  add("flag-pole", 4, 2.67, 2.63, 0.16, 0.06, 0.06, 1.6, wood6);
  add("flag", 4, 2.24, 2.63, 1.42, 0.44, 0.05, 0.28, team2);
  if (v.health === 0) return [p[0], ...Array.from({ length: 12 }, (_, i) => ({ id: `debris-${i}`, phase: 0, x: 0.2 + i % 4 * 0.6, z: 0.2 + Math.floor(i / 4) * 0.7, y: 0.16, w: 0.34, d: 0.3, h: 0.12, color: wood6, studs: false }))];
  return p.filter((a) => a.phase <= Math.min(4, Math.floor(v.progress / 20))).filter((a) => v.health >= 50 || !(a.id === "flag" || a.id.startsWith("target-center") || a.id === "vent-crown" || a.id.startsWith("backstop-crenel")));
}

// apps/web/monastery-building.ts
function monasteryParts(v) {
  if (![1, 2, 3, 4].includes(v.ageVariant) || ![v.progress, v.health].every((n) => Number.isFinite(n) && n >= 0 && n <= 100)) throw Error("\u7121\u6548\u4FEE\u9053\u9662\u5916\u89C0");
  const p = [], age = v.ageVariant, team2 = v.red ? "#b85c47" : "#456e87", wood6 = "#94734c", lime3 = "#d8cfb6", stone6 = "#b9b39d", roof = age === 1 ? "#b8a074" : team2;
  const add = (id, phase, x, z, y, w, d, h, color, studs = false, shape) => p.push({ id, phase, x, z, y, w, d, h, color, studs, ...shape ? { shape } : {} });
  const wallTop = 1.12 + (age >= 3 ? 0.32 : 0), towerTop = age <= 2 ? 2.24 : 2.56 + (age === 4 ? 0.32 : 0);
  add("foundation", 0, -0.15, -0.15, 0, 3, 3, 0.16, "#b3aa8c");
  add("nave", 1, 0.2, 0.3, 0.16, 1.6, 2.2, wallTop - 0.16, lime3);
  add("door", 1, 0.75, 2.46, 0.16, 0.5, 0.08, 0.72, "#6e5a44", false, "arch");
  for (const z of [0.8, 1.6]) for (const x of [0.16, 1.76]) add(`window-${x}-${z}`, 1, x, z, 0.62, 0.08, 0.26, 0.36, "#5b5040");
  for (let level = 0; level < 3; level++) add(`roof-${level}`, 2, 0.1 + level * 0.3, 0.2, wallTop + level * 0.16, 1.8 - level * 0.6, 2.4, 0.16, roof, true);
  add("tower", 1, 2, 0.25, 0.16, 0.7, 0.7, towerTop - 0.16, age <= 2 ? wood6 : stone6);
  for (const x of [2, 2.56]) for (const z of [0.25, 0.81]) add(`belfry-post-${x}-${z}`, 2, x, z, towerTop, 0.14, 0.14, 0.48, age <= 2 ? wood6 : stone6);
  add("belfry-plate", 2, 2, 0.25, towerTop + 0.48, 0.7, 0.7, 0.12, wood6);
  add("bell", 3, 2.24, 0.49, towerTop + 0.26, 0.22, 0.22, 0.22, "#b8964a");
  add("bell-rope", 3, 2.33, 0.58, towerTop + 0.1, 0.04, 0.04, 0.16, "#d8c48a");
  add("belfry-floor", 2, 2, 0.25, towerTop - 0.02, 0.7, 0.7, 0.02, stone6);
  add("tower-cap", 3, 1.95, 0.2, towerTop + 0.6, 0.8, 0.8, 0.16, roof, true);
  add("tower-cap-2", 3, 2.1, 0.35, towerTop + 0.76, 0.5, 0.5, 0.16, roof, true);
  add("garden-soil", 1, 2, 1.35, 0.16, 0.7, 1.25, 0.06, "#8a6a48");
  for (const z of [1.35, 2.5]) add(`garden-wall-${z}`, 2, 2, z, 0.22, 0.7, 0.1, 0.24, stone6);
  add("garden-wall-side", 2, 2.6, 1.45, 0.22, 0.1, 1.05, 0.24, stone6);
  for (const z of [1.6, 1.95, 2.25]) add(`herb-${z}`, 3, 2.2, z, 0.22, 0.26, 0.2, 0.16, "#6f8a55", true);
  if (age >= 2) for (const z of [0.3, 2.34]) add(`plinth-${z}`, 1, 0.14, z, 0.16, 1.72, 0.16, 0.24, stone6);
  if (age >= 3) {
    for (const z of [0.6, 1.4]) for (const x of [0.05, 1.8]) add(`buttress-${x}-${z}`, 1, x, z, 0.16, 0.15, 0.3, wallTop - 0.48, stone6);
    add("roof-ridge", 2, 0.5, 0.3, wallTop + 0.48, 1, 2.2, 0.16, roof, true);
  }
  if (age === 4) {
    add("spire", 4, 2.25, 0.45, towerTop + 0.92, 0.2, 0.3, 0.48, roof);
    add("finial", 4, 2.3, 0.5, towerTop + 1.4, 0.1, 0.2, 0.16, "#c9a55a");
    add("rose-window", 3, 0.84, 2.5, wallTop - 0.46, 0.32, 0.03, 0.32, "#c9a55a");
  }
  add("flag-pole", 4, 0.02, 2.63, 0.16, 0.06, 0.06, 1.6, wood6);
  add("flag", 4, 0.08, 2.63, 1.42, 0.44, 0.05, 0.28, team2);
  if (v.health === 0) return [p[0], ...Array.from({ length: 12 }, (_, i) => ({ id: `debris-${i}`, phase: 0, x: 0.2 + i % 4 * 0.6, z: 0.2 + Math.floor(i / 4) * 0.7, y: 0.16, w: 0.34, d: 0.3, h: 0.12, color: lime3, studs: false }))];
  return p.filter((a) => a.phase <= Math.min(4, Math.floor(v.progress / 20))).filter((a) => v.health >= 50 || !(a.id === "flag" || a.id === "bell" || a.id === "bell-rope" || a.id === "finial"));
}

// apps/web/blacksmith-building.ts
function blacksmithParts(v) {
  if (![1, 2, 3, 4].includes(v.ageVariant) || ![v.progress, v.health].every((n) => Number.isFinite(n) && n >= 0 && n <= 100)) throw Error("\u7121\u6548\u9435\u5320\u92EA\u5916\u89C0");
  const p = [], age = v.ageVariant, team2 = v.red ? "#b85c47" : "#456e87", wood6 = "#94734c", stone6 = "#a9a693", dark6 = "#5d5a52", roof = age === 1 ? "#b8a074" : team2;
  const add = (id, phase, x, z, y, w, d, h, color, studs = false, shape) => p.push({ id, phase, x, z, y, w, d, h, color, studs, ...shape ? { shape } : {} });
  const top = 1.28 + (age >= 3 ? 0.16 : 0);
  add("foundation", 0, -0.15, -0.15, 0, 3, 3, 0.16, "#b3aa8c");
  add("back-wall", 1, 0.1, 0.1, 0.16, 2.5, 0.2, top - 0.16, stone6);
  for (const x of [0.1, 2.4]) add(`side-wall-${x}`, 1, x, 0.3, 0.16, 0.2, 1.5, top - 0.16, stone6);
  for (let level = 0; level < 2; level++) add(`roof-${level}`, 2, -0.05 + level * 0.3, -0.05, top + level * 0.16, 2.9 - level * 0.6, 1.95, 0.16, roof, true);
  add("chimney", 2, 1.75, 0.1, 0.16, 0.5, 0.5, top + 0.9, dark6);
  add("chimney-cap", 3, 1.7, 0.05, top + 1.06, 0.6, 0.6, 0.1, "#4a4740");
  add("hearth", 1, 1.7, 0.62, 0.16, 0.6, 0.4, 0.36, dark6);
  add("hearth-fire", 3, 1.8, 0.7, 0.52, 0.4, 0.25, 0.1, "#e8793c");
  add("stump", 3, 0.95, 1.95, 0.16, 0.36, 0.36, 0.3, wood6);
  add("anvil", 3, 0.88, 1.97, 0.46, 0.5, 0.3, 0.14, "#6b6f6c");
  add("anvil-horn", 3, 1.38, 2.03, 0.5, 0.14, 0.18, 0.08, "#6b6f6c");
  add("tub", 3, 1.7, 2.05, 0.16, 0.42, 0.42, 0.3, wood6);
  add("tub-water", 3, 1.76, 2.11, 0.44, 0.3, 0.3, 0.03, "#6a9297");
  add("rack", 3, 0.3, 0.5, 0.16, 0.15, 1.1, 0.75, wood6);
  for (let i = 0; i < 3; i++) add(`blade-${i}`, 3, 0.28, 0.6 + i * 0.3, 0.3, 0.06, 0.06, 0.7, "#c6cfca");
  if (age >= 2) {
    add("porch-beam", 1, 0.1, 1.75, top - 0.16, 2.5, 0.16, 0.16, wood6);
    for (const x of [0.1, 2.44]) add(`porch-post-${x}`, 1, x, 1.75, 0.16, 0.16, 0.16, top - 0.32, wood6);
  }
  if (age >= 3) for (const x of [-0.05, 2.6]) add(`buttress-${x}`, 1, x, 0.3, 0.16, 0.15, 0.3, top - 0.32, stone6);
  if (age === 4) {
    add("bellows", 4, 2, 0.7, 0.16, 0.3, 0.4, 0.3, "#7a5c40");
    add("ridge-crest", 4, 0.9, 0.4, top + 0.32, 1, 1.2, 0.16, roof, true);
  }
  add("flag-pole", 4, 2.67, 2.63, 0.16, 0.06, 0.06, 1.6, wood6);
  add("flag", 4, 2.24, 2.63, 1.42, 0.44, 0.05, 0.28, team2);
  if (v.health === 0) return [p[0], ...Array.from({ length: 12 }, (_, i) => ({ id: `debris-${i}`, phase: 0, x: 0.2 + i % 4 * 0.6, z: 0.2 + Math.floor(i / 4) * 0.7, y: 0.16, w: 0.34, d: 0.3, h: 0.12, color: stone6, studs: false }))];
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
var towerGrades = ["guard-tower", "keep"];
var towerGradeOf = (techs) => techs.includes("keep") ? "keep" : techs.includes("guard-tower") ? "guard-tower" : null;
var towerLift = (grade) => grade === "keep" ? 0.64 : grade === "guard-tower" ? 0.32 : 0;
function towerParts(v, grade = null) {
  check(v, "\u7BAD\u5854");
  if (grade !== null && !towerGrades.includes(grade)) throw Error("\u7121\u6548\u7BAD\u5854\u5347\u7D1A\u5916\u89C0");
  const p = [], age = v.ageVariant, team2 = v.red ? "#b85c47" : "#456e87", wood6 = "#94734c", stone6 = "#b5b29e", roof = age === 1 ? "#b8a074" : team2;
  const add = (id, phase, x, z, y, w, d, h, color, studs = false) => p.push({ id, phase, x, z, y, w, d, h, color, studs });
  const shaft2 = 1.6 + (age - 1) * 0.24 + towerLift(grade), top = grade ? stone6 : wood6;
  add("foundation", 0, -0.05, -0.05, 0, 1.1, 1.1, 0.12, "#b3aa8c");
  add("shaft", 1, 0.08, 0.08, 0.12, 0.84, 0.84, shaft2 * 0.55, stone6);
  add("shaft-upper", 2, 0.14, 0.14, 0.12 + shaft2 * 0.55, 0.72, 0.72, shaft2 * 0.45, stone6);
  add("door", 1, 0.36, 0.9, 0.12, 0.28, 0.04, 0.4, "#6e5a44");
  add("lookout", 3, 0, 0, 0.12 + shaft2, 1, 1, 0.14, top);
  for (const [x, z] of [[0, 0], [0.84, 0], [0, 0.84], [0.84, 0.84]]) add(`post-${x}-${z}`, 3, x, z, 0.26 + shaft2, 0.16, 0.16, 0.36, top);
  if (grade) for (const [x, z, w, d] of [[0.16, 0, 0.18, 0.08], [0.66, 0, 0.18, 0.08], [0.16, 0.92, 0.18, 0.08], [0.66, 0.92, 0.18, 0.08], [0, 0.16, 0.08, 0.18], [0, 0.66, 0.08, 0.18], [0.92, 0.16, 0.08, 0.18], [0.92, 0.66, 0.08, 0.18]]) add(`${grade}-merlon-${x}-${z}`, 3, x, z, 0.26 + shaft2, w, d, 0.16, stone6);
  if (grade === "keep") for (const [x, z, w, d] of [[0.08, 0, 0.84, 0.08], [0.08, 0.92, 0.84, 0.08], [0, 0.08, 0.08, 0.84], [0.92, 0.08, 0.08, 0.84]]) add(`keep-corbel-${x}-${z}`, 3, x, z, shaft2, w, d, 0.12, "#9d9a88");
  add("roof", 4, -0.06, -0.06, 0.62 + shaft2, 1.12, 1.12, 0.14, roof, true);
  add("roof-top", 4, 0.2, 0.2, 0.76 + shaft2, 0.6, 0.6, 0.14, roof, true);
  if (grade === "keep") add("roof-spire", 4, 0.35, 0.35, 0.9 + shaft2, 0.3, 0.3, 0.2, roof);
  if (age >= 3) for (let i = 0; i < 4; i++) {
    const y = 0.5 + i * 0.3, upper = y >= 0.12 + shaft2 * 0.55;
    add(`slit-${i}`, 2, 0.47, i % 2 ? upper ? 0.12 : 0.1 : upper ? 0.86 : 0.9, y, 0.06, 0.02, 0.2, "#4a4740");
  }
  const flagBase = grade === "keep" ? 1.1 + shaft2 : 0.9 + shaft2;
  add("flag", 4, 0.46, 0.46, flagBase, 0.06, 0.06, 0.5, wood6);
  add("pennant", 4, 0.52, 0.46, flagBase + 0.32, 0.3, 0.04, 0.16, team2);
  return finish(p, v, stone6, (id) => !(id === "pennant" || id === "roof-top" || id === "flag" || id === "roof-spire"));
}
function siegeWorkshopParts(v) {
  check(v, "\u653B\u57CE\u5668\u5DE5\u574A");
  const p = [], age = v.ageVariant, team2 = v.red ? "#b85c47" : "#456e87", wood6 = "#94734c", dark6 = "#6e5438", roof = age === 1 ? "#b8a074" : team2;
  const add = (id, phase, x, z, y, w, d, h, color, studs = false) => p.push({ id, phase, x, z, y, w, d, h, color, studs });
  const top = 1.44;
  add("foundation", 0, -0.15, -0.15, 0, 3, 3, 0.16, "#b3aa8c");
  for (const x of [0.1, 2.44]) for (const z of [0.1, 1.65]) add(`post-${x}-${z}`, 1, x, z, 0.16, 0.16, 0.16, top - 0.16, wood6);
  add("back-wall", 1, 0.1, 0.1, 0.16, 2.5, 0.15, top - 0.16, wood6);
  for (let level = 0; level < 2; level++) add(`roof-${level}`, 2, -0.05 + level * 0.35, -0.05, top + level * 0.16, 2.9 - level * 0.7, 1.98, 0.16, roof, true);
  add("ram-bed", 3, 0.5, 0.6, 0.16, 1.6, 0.7, 0.12, dark6);
  add("ram-log", 3, 0.45, 0.8, 0.4, 1.8, 0.3, 0.3, wood6);
  for (const x of [0.6, 1.8]) add(`ram-rib-${x}`, 3, x, 0.6, 0.28, 0.1, 0.7, 0.6, dark6);
  for (let i = 0; i < 3; i++) add(`log-${i}`, 3, 0.3, 2.05 + i * 0.2, 0.16, 1.4, 0.18, 0.18, wood6);
  add("log-top", 3, 0.5, 2.15, 0.34, 1, 0.18, 0.18, wood6);
  add("wheel", 3, 2.1, 2, 0.16, 0.14, 0.6, 0.6, dark6);
  add("wheel-hub", 3, 2.08, 2.2, 0.36, 0.18, 0.2, 0.2, "#c9a55a");
  if (age >= 3) add("crane-arm", 4, 2.2, 0.3, top - 0.1, 0.14, 1.2, 0.14, wood6);
  add("flag-pole", 4, 2.67, 2.63, 0.16, 0.06, 0.06, 1.6, wood6);
  add("flag", 4, 2.24, 2.63, 1.42, 0.44, 0.05, 0.28, team2);
  return finish(p, v, wood6, (id) => !(id === "flag" || id === "crane-arm"));
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
  university: { x: -15, y: -15, width: 300, depth: 300 },
  // Castle: a solid 4x4 keep (the reference's castle is 4x4).
  castle: { x: -15, y: -15, width: 400, depth: 400 },
  // Watch tower: one tile.
  "watch-tower": { x: 0, y: 0, width: 100, depth: 100 },
  // The 建築 round. Market and dock: 3x3 like the other production buildings (the reference's market is 4x4, scaled like
  // the university). The dock stands on water next to the shore; ships leave it on the water side.
  market: { x: -15, y: -15, width: 300, depth: 300 },
  dock: { x: 0, y: 0, width: 300, depth: 300 },
  // Fish trap: a 2x2 net on the water; ships sail over it (no blocking rectangle, like the farm).
  "fish-trap": { x: 0, y: 0, width: 200, depth: 200 },
  // One-tile structures: the outpost, the bombard tower, and every wall segment and gate (walls are dragged as a line
  // of one-tile segments; a gate takes one segment's place). Gates block only the enemy (movement.ts gate overlay).
  outpost: { x: 0, y: 0, width: 100, depth: 100 },
  "bombard-tower": { x: 0, y: 0, width: 100, depth: 100 },
  "palisade-wall": { x: 0, y: 0, width: 100, depth: 100 },
  "stone-wall": { x: 0, y: 0, width: 100, depth: 100 },
  "palisade-gate": { x: 0, y: 0, width: 100, depth: 100 },
  gate: { x: 0, y: 0, width: 100, depth: 100 },
  // The wonder: a solid 5x5 (the reference's size).
  wonder: { x: 0, y: 0, width: 500, depth: 500 },
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
  if (o.kind === "farm" || o.kind === "fish-trap" || o.kind === "gate" || o.kind === "palisade-gate") return [];
  if (o.kind !== "town-center") return [obstacleBounds(o, radius)];
  return townCenterBlocking.map(([x0, y0, x1, y1]) => [o.x + x0 - radius, o.y + y0 - radius, o.x + x1 + radius, o.y + y1 + radius]);
}

// apps/web/university-building.ts
function universityParts(v) {
  if (![1, 2, 3, 4].includes(v.ageVariant) || ![v.progress, v.health].every((n) => Number.isFinite(n) && n >= 0 && n <= 100)) throw Error("\u7121\u6548\u5B78\u9662\u5916\u89C0");
  const p = [], age = v.ageVariant, team2 = v.red ? "#b85c47" : "#456e87";
  const wood6 = "#94734c", oak3 = "#6e5438", plaster = "#e3d7b8", sand4 = "#d6b77e", stone6 = "#c4bba2", straw3 = "#b8a074", dark6 = "#4a4740", brass2 = "#b8964a", gilt5 = "#c9a55a", paper = "#efe6cc", leather2 = "#7a4a32";
  const add = (id, phase, x, z, y, w, d, h, color, studs = false, shape) => p.push({ id, phase, x, z, y, w, d, h, color, studs, ...shape ? { shape } : {} });
  const f = obstacleFootprints.university;
  add("foundation", 0, f.x / 100, f.y / 100, 0, f.width / 100, f.depth / 100, 0.16, "#b3aa8c");
  const wall = age === 1 ? plaster : sand4, roof = age === 1 ? straw3 : team2, trim = age === 1 ? wood6 : stone6;
  const wallTop = 1.28 + (age >= 3 ? 0.32 : 0), beamY = wallTop - 0.36, towerTop = [1.9, 2.2, 2.5, 2.8][age - 1];
  add("hall", 1, 0.05, 0.1, 0.16, 2, 1.4, wallTop - 0.16, wall);
  if (age === 1) {
    for (const x of [0.05, 1.95]) add(`timber-front-${x}`, 1, x, 1.5, 0.24, 0.1, 0.06, beamY - 0.24, wood6);
    for (const z of [0.1, 1.4]) add(`timber-side-${z}`, 1, 2.05, z, 0.16, 0.06, 0.1, wallTop - 0.16, wood6);
  } else add("plinth", 1, 2.05, 0.1, 0.16, 0.06, 1.4, 0.2, stone6);
  add("porch", 1, 0.1, 1.5, 0.16, 1.9, 0.5, 0.08, trim);
  add("step", 1, 0.7, 2, 0.16, 0.7, 0.18, 0.05, trim);
  for (const [i, x] of [0.18, 0.62, 1.34, 1.78].entries()) add(`column-${i}`, 1, x, 1.76, 0.24, 0.14, 0.14, beamY - 0.24, age === 1 ? wood6 : "#e6dcc3");
  add("porch-beam", 2, 0.1, 1.5, beamY, 1.9, 0.42, 0.14, trim);
  const tiers = age >= 3 ? 4 : 3;
  for (let level = 0; level < tiers; level++) add(`roof-${level}`, 2, -0.05 + level * 0.25, level * 0.15, wallTop + level * 0.16, 2.2 - level * 0.5, 1.6 - level * 0.3, 0.16, roof, true);
  add("door", 3, 0.82, 1.5, 0.24, 0.46, 0.04, age >= 3 ? 0.8 : 0.64, "#5a4632", false, "arch");
  for (const x of [0.36, 1.46]) add(`window-front-${x}`, 3, x, 1.5, 0.62, 0.24, 0.03, age >= 3 ? 0.5 : 0.26, "#3f4a4c", false, age >= 3 ? "arch" : void 0);
  for (const z of [0.82, 1.14]) add(`window-side-${z}`, 3, 2.05, z, 0.66, 0.03, 0.2, 0.3, "#3f4a4c");
  add("lectern-post", 3, 0.46, 1.66, 0.24, 0.06, 0.06, 0.34, oak3);
  add("lectern-top", 3, 0.4, 1.6, 0.58, 0.2, 0.16, 0.05, oak3);
  add("book", 3, 0.42, 1.62, 0.63, 0.16, 0.12, 0.025, leather2);
  add("book-pages", 3, 0.43, 1.63, 0.655, 0.14, 0.1, 0.02, paper);
  add("scroll-rack", 1, -0.1, 0.35, 0.16, 0.15, 0.9, 0.78, oak3);
  for (let row = 0; row < 3; row++) for (let col = 0; col < 4; col++) add(`scroll-${row}-${col}`, 3, -0.13, 0.42 + col * 0.2, 0.26 + row * 0.22, 0.03, 0.1, 0.1, paper);
  add("tower", 1, 2.15, 0.1, 0.16, 0.6, 0.6, towerTop - 0.16, age === 1 ? wood6 : stone6);
  add("tower-deck", 2, 2.1, 0.05, towerTop, 0.7, 0.7, 0.1, trim);
  const deck3 = towerTop + 0.1;
  if (age <= 2) {
    add("tower-cap", 2, 2.15, 0.1, deck3, 0.6, 0.6, 0.16, roof, true);
    add("tower-cap-2", 2, 2.3, 0.25, deck3 + 0.16, 0.3, 0.3, 0.16, roof, true);
    for (const [x, z] of [[2.1, 0.05], [2.75, 0.05], [2.1, 0.7], [2.75, 0.7]]) add(`rail-${x}-${z}`, 3, x, z, deck3, 0.05, 0.05, 0.14, oak3);
  } else {
    add("observatory", 3, 2.2, 0.15, deck3, 0.5, 0.5, 0.32, stone6);
    add("sight-slit", 3, 2.41, 0.65, deck3 + 0.04, 0.08, 0.02, 0.26, dark6);
    add("observatory-cap", 3, 2.15, 0.1, deck3 + 0.32, 0.6, 0.6, 0.12, roof, true);
    add("observatory-cap-2", 3, 2.3, 0.25, deck3 + 0.44, 0.3, 0.3, 0.12, roof, true);
    add("telescope", 4, 2.42, 0.67, deck3 + 0.2, 0.07, 0.36, 0.07, brass2);
    add("telescope-lens", 4, 2.41, 1.03, deck3 + 0.19, 0.09, 0.04, 0.09, dark6);
  }
  if (age === 4) {
    const top = deck3 + 0.56;
    add("armillary-post", 4, 2.42, 0.37, top, 0.06, 0.06, 0.1, gilt5);
    add("armillary-low", 4, 2.26, 0.38, top + 0.1, 0.36, 0.04, 0.04, gilt5);
    add("armillary-high", 4, 2.26, 0.38, top + 0.42, 0.36, 0.04, 0.04, gilt5);
    for (const x of [2.22, 2.62]) add(`armillary-side-${x}`, 4, x, 0.38, top + 0.1, 0.04, 0.04, 0.36, gilt5);
    add("armillary-band", 4, 2.26, 0.38, top + 0.24, 0.36, 0.04, 0.04, brass2);
    add("armillary-ball", 4, 2.39, 0.34, top + 0.46, 0.12, 0.12, 0.12, gilt5);
    add("clock", 3, 2.32, 0.7, towerTop - 0.62, 0.26, 0.03, 0.26, "#efe9da");
    add("clock-hand", 3, 2.44, 0.73, towerTop - 0.56, 0.03, 0.02, 0.14, dark6);
    const r = wallTop + tiers * 0.16;
    add("dome-drum", 3, 0.75, 0.5, r, 0.6, 0.6, 0.2, stone6);
    for (const [i, s] of [0.5, 0.36, 0.22].entries()) add(`dome-${i}`, 3, 1.05 - s / 2, 0.8 - s / 2, r + 0.2 + [0, 0.14, 0.26][i], s, s, [0.14, 0.12, 0.1][i], team2);
    add("dome-finial", 4, 1.01, 0.76, r + 0.56, 0.08, 0.08, 0.2, gilt5);
  }
  add("crane-sill", 1, 2.12, 1.62, 0.16, 0.66, 1.2, 0.08, oak3);
  const segments = [["bottom", 1.92, 2.38, 0.24, 0.34], ["top", 1.92, 2.38, 1.06, 1.16], ["low-a", 1.76, 1.92, 0.28, 0.52], ["side-a", 1.7, 1.76, 0.48, 0.92], ["high-a", 1.76, 1.92, 0.88, 1.1], ["low-b", 2.38, 2.54, 0.28, 0.52], ["side-b", 2.54, 2.6, 0.48, 0.92], ["high-b", 2.38, 2.54, 0.88, 1.1], ["spoke-v", 2.11, 2.19, 0.34, 1.06], ["spoke-a", 1.76, 2.11, 0.65, 0.73], ["spoke-b", 2.19, 2.54, 0.65, 0.73]];
  for (const [rim, x] of [["a", 2.18], ["b", 2.64]]) for (const [name, z0, z1, y0, y1] of segments) add(`wheel-${rim}-${name}`, 3, x, z0, y0, 0.08, z1 - z0, y1 - y0, wood6);
  add("wheel-axle", 3, 2.26, 2.11, 0.65, 0.38, 0.08, 0.08, dark6);
  for (const [z, y] of [[1.98, 0.24], [2.26, 0.24], [1.72, 0.6], [2.52, 0.6], [1.98, 1.08]]) add(`tread-${z}-${y}`, 3, 2.26, z, y, 0.38, 0.08, 0.08, wood6);
  if (age >= 3) {
    add("crane-mast", 3, 2.74, 1.62, 0.24, 0.1, 0.12, 1.8, oak3);
    add("crane-jib", 4, 2.74, 1.74, 1.94, 0.1, 1.1, 0.1, oak3);
    add("crane-rope", 4, 2.77, 2.72, 1.36, 0.04, 0.04, 0.58, "#d8c48a");
    add("crane-load", 4, 2.66, 2.62, 1.14, 0.19, 0.22, 0.22, "#b5b29e");
  }
  add("flag-pole", 4, -0.12, 2.72, 0.16, 0.06, 0.06, 1.6, wood6);
  add("flag", 4, -0.06, 2.72, 1.48, 0.44, 0.05, 0.28, team2);
  if (v.health === 0) return [p[0], ...Array.from({ length: 12 }, (_, i) => ({ id: `debris-${i}`, phase: 0, x: 0.1 + i % 4 * 0.65, z: 0.15 + Math.floor(i / 4) * 0.85, y: 0.16, w: 0.36, d: 0.3, h: 0.12, color: i % 3 ? wall : stone6, studs: false }))];
  const lost = /^(flag|telescope|telescope-lens|armillary-.*|crane-rope|crane-load|column-1|dome-finial|clock-hand)$/;
  return p.filter((a) => a.phase <= Math.min(4, Math.floor(v.progress / 20))).filter((a) => v.health >= 50 || !lost.test(a.id));
}

// apps/web/castle-building.ts
function castleParts(v) {
  if (![1, 2, 3, 4].includes(v.ageVariant) || ![v.progress, v.health].every((n) => Number.isFinite(n) && n >= 0 && n <= 100)) throw Error("\u7121\u6548\u57CE\u5821\u5916\u89C0");
  const p = [], age = v.ageVariant, team2 = v.red ? "#b85c47" : "#456e87", wood6 = "#94734c", straw3 = "#b8a074", stone6 = "#b5b29e", dark6 = "#4a4740", oak3 = "#5a4632";
  const add = (id, phase, x, z, y, w, d, h, color, studs = false, shape) => p.push({ id, phase, x, z, y, w, d, h, color, studs, ...shape ? { shape } : {} });
  const f = obstacleFootprints.castle;
  add("foundation", 0, f.x / 100, f.y / 100, 0, f.width / 100, f.depth / 100, 0.16, "#b3aa8c");
  const wallH = 1.12 + (age >= 3 ? 0.32 : 0), wallTop = 0.16 + wallH, towerTop = wallTop + 0.64, keepTop = 0.16 + [1.6, 1.92, 2.24, 2.24][age - 1];
  const crest = (id, x, z, y, alongX) => age === 1 ? add(`stake-${id}`, 2, x + (alongX ? 0.04 : 0.12), z + (alongX ? 0.12 : 0.04), y, 0.12, 0.12, 0.3, wood6) : add(`merlon-${id}`, 2, x, z, y, alongX ? 0.2 : 0.36, alongX ? 0.36 : 0.2, 0.24, stone6);
  const towers = [[-0.1, -0.1], [2.9, -0.1], [-0.1, 2.9], [2.9, 2.9]];
  for (const [x, z] of towers) {
    const id = `${x}-${z}`;
    add(`tower-${id}`, 1, x, z, 0.16, 0.9, 0.9, towerTop - 0.16, stone6);
    if (age === 1) {
      add(`hoard-${id}`, 2, x - 0.05, z - 0.05, towerTop, 1, 1, 0.3, wood6);
      add(`hoard-roof-${id}`, 2, x + 0.05, z + 0.05, towerTop + 0.3, 0.8, 0.8, 0.16, straw3, true);
      add(`hoard-cap-${id}`, 3, x + 0.25, z + 0.25, towerTop + 0.46, 0.4, 0.4, 0.16, straw3);
    } else for (const dx of [0, 0.35, 0.7]) for (const dz of [0, 0.35, 0.7]) if (dx !== 0.35 || dz !== 0.35) add(`tmerlon-${id}-${dx}-${dz}`, 2, x + dx, z + dz, towerTop, 0.2, 0.2, 0.24, stone6);
    if (age >= 3) add(`slit-${id}`, 3, x + 0.6, z < 0 ? z - 0.03 : z + 0.9, towerTop - 1, 0.1, 0.03, 0.32, dark6);
    if (age === 4) {
      add(`drum-${id}`, 3, x + 0.2, z + 0.2, towerTop, 0.5, 0.5, 0.32, stone6);
      add(`cone-0-${id}`, 3, x + 0.1, z + 0.1, towerTop + 0.32, 0.7, 0.7, 0.16, team2, true);
      add(`cone-1-${id}`, 3, x + 0.22, z + 0.22, towerTop + 0.48, 0.46, 0.46, 0.16, team2);
      add(`cone-2-${id}`, 4, x + 0.34, z + 0.34, towerTop + 0.64, 0.22, 0.22, 0.2, team2);
    }
  }
  add("wall-back", 1, 0.8, 0.17, 0.16, 2.1, 0.36, wallH, stone6);
  add("wall-left", 1, 0.17, 0.8, 0.16, 0.36, 2.1, wallH, stone6);
  add("wall-right", 1, 3.17, 0.8, 0.16, 0.36, 2.1, wallH, stone6);
  add("wall-front-l", 1, 0.8, 3.17, 0.16, 0.6, 0.36, wallH, stone6);
  add("wall-front-r", 1, 2.3, 3.17, 0.16, 0.6, 0.36, wallH, stone6);
  for (let i = 0; i < 5; i++) {
    const at = 0.9 + i * 0.4;
    crest(`back-${i}`, at, 0.17, wallTop, true);
    crest(`left-${i}`, 0.17, at, wallTop, false);
    crest(`right-${i}`, 3.17, at, wallTop, false);
  }
  for (const x of [0.88, 1.16, 2.36, 2.64]) crest(`front-${x}`, x, 3.17, wallTop, true);
  add("gate-arch", 1, 1.4, 3.1, 0.16, 0.9, 0.5, wallH, stone6, false, "arch");
  add("gate-top", 2, 1.4, 3.1, wallTop, 0.9, 0.5, 0.32, stone6);
  add("portcullis", 3, 1.62, 3.3, 0.16, 0.46, 0.06, 0.76, oak3);
  if (age >= 2) for (const x of [1.4, 1.75, 2.1]) add(`gate-merlon-${x}`, 3, x, 3.4, wallTop + 0.32, 0.2, 0.2, 0.24, stone6);
  if (age === 4) for (const x of [1.4, 2.04]) {
    add(`gate-turret-${x}`, 3, x, 3.1, wallTop + 0.32, 0.26, 0.26, 0.4, stone6);
    add(`gate-turret-cap-${x}`, 4, x - 0.02, 3.08, wallTop + 0.72, 0.3, 0.3, 0.12, team2);
  }
  add("keep", 1, 1.25, 1.1, 0.16, 1.2, 1.2, keepTop - 0.16, stone6);
  let crown = keepTop;
  if (age === 1) {
    add("keep-roof-0", 2, 1.2, 1.05, keepTop, 1.3, 1.3, 0.16, straw3, true);
    add("keep-roof-1", 2, 1.45, 1.3, keepTop + 0.16, 0.8, 0.8, 0.16, straw3, true);
    crown = keepTop + 0.32;
  } else {
    add("keep-parapet", 2, 1.2, 1.05, keepTop, 1.3, 1.3, 0.12, stone6);
    crown = keepTop + 0.12;
    for (const dx of [0, 0.55, 1.1]) for (const dz of [0, 0.55, 1.1]) if (dx !== 0.55 || dz !== 0.55) add(`keep-merlon-${dx}-${dz}`, 2, 1.2 + dx, 1.05 + dz, crown, 0.2, 0.2, 0.24, stone6);
  }
  if (age >= 3) {
    add("keep-turret", 2, 1.55, 1.4, crown, 0.6, 0.6, 0.64, stone6);
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
  add("flag-pole", 4, 1.82, 1.67, crown, 0.06, 0.06, 0.9, wood6);
  add("flag", 4, 1.88, 1.67, crown + 0.5, 0.5, 0.05, 0.3, team2);
  if (v.health === 0) return [p[0], ...Array.from({ length: 12 }, (_, i) => ({ id: `debris-${i}`, phase: 0, x: 0.2 + i % 4 * 0.9, z: 0.2 + Math.floor(i / 4) * 1.2, y: 0.16, w: 0.4, d: 0.34, h: 0.12, color: stone6, studs: false }))];
  return p.filter((a) => a.phase <= Math.min(4, Math.floor(v.progress / 20))).filter((a) => v.health >= 50 || !(a.id === "flag" || a.id.startsWith("banner-") || /^(merlon|stake)-.*-[13]$/.test(a.id) || a.id.startsWith("cone-2-") || a.id.startsWith("hoard-cap-")));
}

// apps/web/siege-rig.ts
var wood = "#94734c";
var dark = "#6e5438";
var iron = "#6b6f6c";
var metal = "#9aa3a1";
var rope = "#7a5c40";
var stone = "#a19f86";
var gold = "#c9a55a";
var teamOf = (player) => player === 0 ? "#45728c" : "#b25441";
function kit(T, box, material) {
  const part = (parent, x, y, z, w, h, d, color) => {
    const m = new T.Mesh(box(w, h, d), material(color));
    m.position.set(x, y, z);
    m.castShadow = true;
    parent.add(m);
    return m;
  };
  const group = (parent, name, x = 0, y = 0, z = 0) => {
    const g = new T.Group();
    g.name = name;
    g.position.set(x, y, z);
    parent.add(g);
    return g;
  };
  const spokes = [];
  const wheel = (parent, x, z, size) => {
    part(parent, x, 0, z, 0.08, size, size, "#5c4a36");
    const s = group(parent, "wheel-spokes", x + Math.sign(x || 1) * 0.045, size / 2, z);
    part(s, 0, -size * 0.42, 0, 0.02, size * 0.84, 0.04, "#3f3226");
    const cross = part(s, 0, -size * 0.42, 0, 0.02, size * 0.84, 0.04, "#3f3226");
    cross.rotation.x = Math.PI / 2;
    cross.position.set(0, 0, -size * 0.42);
    part(s, 0, -0.04, 0, 0.03, 0.08, 0.08, iron);
    spokes.push(s);
  };
  return { part, group, wheel, spokes };
}
function motion(root, body, spokes, halfWidth) {
  return (kind, t) => {
    const fall = kind === "death" ? Math.min(t / 700, 1) : 0;
    for (const s of spokes) s.rotation.x = kind === "walk" ? -t * 6e-3 : 0;
    body.rotation.x = kind === "walk" ? Math.sin(t * 0.02) * 0.015 : kind === "hit" && t < 300 ? -0.05 * Math.sin(Math.PI * t / 300) : 0;
    body.position.y = Math.abs(Math.sin(body.rotation.x)) * 1.35;
    root.rotation.z = fall ? -fall * 0.5 : 0;
    root.position.y = Math.sin(fall * 0.5) * halfWidth;
  };
}
var clock = (time) => Number.isFinite(time) ? Math.max(0, time) : 0;
var noSockets = (T) => ({ leftHand: new T.Group(), rightHand: new T.Group() });
function createRamRig(T, player, box, material) {
  const root = new T.Group();
  root.name = "siege-ram";
  const team2 = teamOf(player), { part, group } = kit(T, box, material);
  const body = group(root, "siege-body");
  part(body, 0, 0.22, 0, 0.76, 0.1, 1.3, dark);
  for (const x of [-0.36, 0.36]) for (const z of [-0.45, 0.45]) part(body, x, 0, z, 0.1, 0.36, 0.36, "#5c4a36");
  for (const x of [-0.3, 0.3]) part(body, x, 0.32, 0, 0.1, 0.55, 1.2, wood);
  part(body, 0, 0.86, 0, 0.86, 0.1, 1.36, team2);
  part(body, 0, 0.96, 0, 0.5, 0.1, 1.36, team2);
  const log = group(body, "ram-log");
  part(log, 0, 0.4, 0.2, 0.24, 0.24, 1.2, "#8a6a45");
  part(log, 0, 0.38, 0.82, 0.3, 0.28, 0.12, iron);
  const looks = /* @__PURE__ */ new Map();
  function grade(look) {
    for (const g2 of looks.values()) for (const x of g2) x.visible = false;
    if (look !== "capped-ram" && look !== "siege-ram") return;
    let g = looks.get(look);
    if (!g) {
      const roof = group(body, `grade-${look}`), head = group(log, `grade-${look}-head`);
      g = [roof, head];
      looks.set(look, g);
      for (const x of [-0.34, 0.34]) {
        part(roof, x, 0.96, 0, 0.18, 0.04, 1.3, metal);
        for (const z of [-0.5, 0, 0.5]) part(roof, x, 1, z, 0.04, 0.02, 0.04, gold);
      }
      if (look === "siege-ram") {
        for (const x of [-0.36, 0.36]) part(roof, x, 0.36, 0, 0.03, 0.44, 1.14, metal);
        part(head, 0, 0.34, 0.86, 0.38, 0.36, 0.16, iron);
      }
    }
    for (const x of g) x.visible = true;
  }
  const move = motion(root, body, [], 0.43);
  function pose(kind, time) {
    const t = clock(time);
    move(kind, t);
    log.position.z = kind === "attack" ? Math.max(0, Math.sin(t * 8e-3)) * 0.25 : 0;
  }
  return { root, sockets: noSockets(T), equip: (_) => {
  }, dress: (_) => {
  }, pose, grade };
}
function createMangonelRig(T, player, box, material) {
  const root = new T.Group();
  root.name = "siege-mangonel";
  const team2 = teamOf(player), { part, group, wheel, spokes } = kit(T, box, material);
  const body = group(root, "siege-body");
  for (const z of [-0.62, 0.3]) for (const x of [-0.36, 0.36]) wheel(body, x, z, 0.34);
  for (const x of [-0.26, 0.26]) {
    part(body, x, 0.22, -0.25, 0.1, 0.12, 1.6, wood);
    part(body, x * 1.21, 0.25, -0.25, 0.02, 0.06, 1.4, team2);
  }
  for (const z of [0.45, -0.85]) part(body, 0, 0.22, z, 0.62, 0.1, 0.1, dark);
  for (const x of [-0.2, 0.2]) {
    part(body, x, 0.34, -0.12, 0.1, 0.72, 0.1, wood);
    const brace = part(body, x, 0.34, 0.4, 0.07, 0.62, 0.07, dark);
    brace.rotation.x = -0.75;
  }
  part(body, 0, 0.86, -0.12, 0.5, 0.12, 0.12, wood);
  part(body, 0, 0.84, -0.2, 0.36, 0.16, 0.04, team2);
  part(body, 0, 0.34, -0.3, 0.44, 0.18, 0.18, rope);
  part(body, 0, 0.34, -0.95, 0.5, 0.1, 0.1, "#5c4a36");
  for (const x of [-0.29, 0.29]) part(body, x, 0.28, -0.95, 0.04, 0.22, 0.04, dark);
  const arm = group(body, "mangonel-arm", 0, 0.43, -0.3);
  const makeArm = (name, len, cup) => {
    const a = group(arm, name);
    part(a, 0, 0, 0, 0.09, len, 0.09, wood);
    part(a, 0, len - 0.1, 0.06, cup, 0.16, cup - 0.02, "#5c4a36");
    const s = part(a, 0, len - 0.08, 0.06 + cup / 2, cup * 0.6, cup * 0.6, 0.1, stone);
    return { a, s };
  };
  const short = makeArm("arm-mangonel", 0.75, 0.24), long = makeArm("arm-onager", 0.95, 0.3);
  long.a.visible = false;
  const bands = group(long.a, "arm-bands");
  for (const y of [0.2, 0.45, 0.7]) part(bands, 0, y, 0, 0.11, 0.04, 0.11, iron);
  bands.visible = false;
  const extension = group(body, "onager-frame");
  for (const x of [-0.26, 0.26]) part(extension, x, 0.22, -1.18, 0.1, 0.12, 0.3, wood);
  part(extension, 0, 0.22, -1.28, 0.62, 0.1, 0.1, dark);
  extension.visible = false;
  const plates = group(body, "siege-onager-plates");
  for (const x of [-0.2, 0.2]) part(plates, x * 1.3, 0.5, -0.12, 0.02, 0.36, 0.12, iron);
  plates.visible = false;
  function grade(look) {
    const onager = look === "onager" || look === "siege-onager";
    short.a.visible = !onager;
    long.a.visible = onager;
    extension.visible = onager;
    bands.visible = look === "siege-onager";
    plates.visible = look === "siege-onager";
  }
  const rest = -1.4, fire = 0.12, move = motion(root, body, spokes, 0.45);
  function pose(kind, time) {
    const t = clock(time);
    move(kind, t);
    let angle = rest, loaded = true;
    if (kind === "attack") {
      const f = t % 1600 / 1600;
      angle = f < 0.1 ? rest + (fire - rest) * (1 - (1 - f / 0.1) ** 2) : f < 0.25 ? fire : fire + (rest - fire) * (f - 0.25) / 0.75;
      loaded = f < 0.08 || f > 0.85;
    }
    arm.rotation.x = angle;
    short.s.visible = long.s.visible = loaded;
  }
  return { root, sockets: noSockets(T), equip: (_) => {
  }, dress: (_) => {
  }, pose, grade };
}
function createScorpionRig(T, player, box, material) {
  const root = new T.Group();
  root.name = "siege-scorpion";
  const team2 = teamOf(player), { part, group, wheel, spokes } = kit(T, box, material);
  const body = group(root, "siege-body");
  for (const z of [-0.35, 0.35]) for (const x of [-0.32, 0.32]) wheel(body, x, z, 0.28);
  part(body, 0, 0.2, 0, 0.56, 0.08, 0.9, dark);
  part(body, 0, 0.28, 0.46, 0.62, 0.36, 0.05, wood);
  part(body, 0, 0.33, 0.49, 0.44, 0.24, 0.02, team2);
  part(body, 0, 0.28, -0.05, 0.14, 0.36, 0.14, wood);
  part(body, 0, 0.28, -0.05, 0.26, 0.06, 0.26, dark);
  const bow = group(body, "scorpion-bow", 0, 0.64, -0.05);
  part(bow, 0, 0, -0.05, 0.12, 0.1, 1, wood);
  part(bow, 0, -0.04, 0.42, 0.22, 0.18, 0.12, dark);
  for (const sx of [-1, 1]) {
    part(bow, sx * 0.14, -0.12, 0.42, 0.08, 0.32, 0.1, rope);
    part(bow, sx * 0.3, 0.02, 0.4, 0.24, 0.07, 0.07, wood);
    part(bow, sx * 0.5, 0.02, 0.32, 0.18, 0.07, 0.07, wood);
    part(bow, sx * 0.6, 0.02, 0.24, 0.06, 0.08, 0.06, metal);
    const cord = part(bow, sx * 0.3, 0.05, -0.03, 0.015, 0.015, 0.81, "#d9cba4");
    cord.rotation.y = sx * Math.atan2(0.6, 0.54);
  }
  part(bow, 0, -0.06, -0.5, 0.3, 0.08, 0.08, dark);
  for (const sx of [-1, 1]) part(bow, sx * 0.17, -0.14, -0.5, 0.03, 0.16, 0.03, dark);
  const bolt = group(bow, "scorpion-bolt");
  part(bolt, 0, 0.1, -0.1, 0.04, 0.04, 0.8, "#d9cba4");
  part(bolt, 0, 0.09, 0.32, 0.07, 0.06, 0.1, iron);
  part(bolt, 0, 0.09, -0.48, 0.02, 0.08, 0.1, "#efe9da");
  const armour = group(body, "heavy-scorpion-plates");
  part(armour, 0, 0.3, 0.515, 0.64, 0.32, 0.02, iron);
  for (const x of [-0.24, 0, 0.24]) part(armour, x, 0.58, 0.53, 0.04, 0.04, 0.02, gold);
  const caps = group(bow, "heavy-scorpion-caps");
  for (const sx of [-1, 1]) part(caps, sx * 0.6, 0, 0.24, 0.09, 0.11, 0.09, iron);
  armour.visible = caps.visible = false;
  function grade(look) {
    armour.visible = caps.visible = look === "heavy-scorpion";
  }
  const move = motion(root, body, spokes, 0.4);
  function pose(kind, time) {
    const t = clock(time);
    move(kind, t);
    let fly = 0, shown = true, kick = 0;
    if (kind === "attack") {
      const f = t % 1300 / 1300;
      if (f < 0.1) {
        fly = f / 0.1 * 1.6;
        kick = 0.1 * (1 - f / 0.1);
      } else shown = f > 0.55;
    }
    bolt.position.z = fly;
    bolt.visible = shown && fly < 1.5;
    bow.rotation.x = -0.08 - kick;
  }
  return { root, sockets: noSockets(T), equip: (_) => {
  }, dress: (_) => {
  }, pose, grade };
}
var trebuchetStates = ["packed", "unpacked"];
function createTrebuchetRig(T, player, box, material) {
  const root = new T.Group();
  root.name = "siege-trebuchet";
  const team2 = teamOf(player), { part, group, wheel, spokes } = kit(T, box, material);
  const body = group(root, "siege-body");
  const packed = group(body, "trebuchet-packed");
  for (const z of [-0.7, 0.7]) for (const x of [-0.4, 0.4]) wheel(packed, x, z, 0.4);
  part(packed, 0, 0.3, 0, 0.7, 0.1, 1.9, dark);
  for (const x of [-0.33, 0.33]) part(packed, x, 0.4, 0, 0.06, 0.12, 1.9, wood);
  part(packed, 0.14, 0.4, -0.12, 0.14, 0.14, 2.3, "#8a6a45");
  part(packed, -0.16, 0.4, -0.1, 0.12, 0.12, 1.6, wood);
  part(packed, -0.16, 0.52, -0.1, 0.12, 0.12, 1.4, wood);
  part(packed, 0.05, 0.4, 0.55, 0.5, 0.4, 0.45, "#5c4a36");
  part(packed, 0.05, 0.8, 0.55, 0.54, 0.06, 0.5, team2);
  part(packed, 0.05, 0.52, 0.79, 0.4, 0.28, 0.02, team2);
  part(packed, 0.14, 0.54, -0.95, 0.18, 0.06, 0.18, "#c9b27a");
  part(packed, 0, 0.3, 1.12, 0.08, 0.08, 0.4, wood);
  const standing = group(body, "trebuchet-unpacked");
  for (const x of [-0.42, 0.42]) {
    part(standing, x, 0, 0, 0.14, 0.14, 2.2, wood);
    part(standing, x, 0.14, 0, 0.14, 1.9, 0.14, wood);
    for (const [z, a] of [[0.85, -0.63], [-0.85, 0.63]]) {
      const brace = part(standing, x, 0.14, z, 0.1, 1.32, 0.1, dark);
      brace.rotation.x = a;
    }
  }
  for (const z of [-0.9, 0.9]) part(standing, 0, 0, z, 0.98, 0.12, 0.14, dark);
  part(standing, 0, 1.95, 0, 1, 0.1, 0.1, iron);
  part(standing, 0.42, 2.04, 0, 0.03, 0.42, 0.03, dark);
  part(standing, 0.53, 2.28, 0, 0.2, 0.14, 0.02, team2);
  const arm = group(standing, "trebuchet-arm", 0, 2, 0);
  part(arm, 0, -0.06, -0.7, 0.12, 0.12, 2.6, "#8a6a45");
  for (const z of [-1.6, -0.9, -0.2]) part(arm, 0, -0.07, z, 0.14, 0.14, 0.04, iron);
  part(arm, 0, -0.7, 0.5, 0.5, 0.55, 0.5, "#5c4a36");
  part(arm, 0, -0.5, 0.5, 0.52, 0.14, 0.52, team2);
  for (const x of [-0.15, 0.15]) part(arm, x, -0.15, 0.5, 0.04, 0.15, 0.04, metal);
  part(arm, 0, -0.45, -2, 0.03, 0.45, 0.03, "#c9b27a");
  part(arm, 0, -0.55, -2, 0.14, 0.1, 0.18, "#8b6746");
  const shot = part(arm, 0, -0.47, -2, 0.12, 0.1, 0.12, stone);
  let state = "packed";
  standing.visible = false;
  function dress(next) {
    if (!trebuchetStates.includes(next)) throw Error("\u672A\u77E5\u6295\u77F3\u6A5F\u72C0\u614B");
    state = next;
    packed.visible = state === "packed";
    standing.visible = state === "unpacked";
  }
  const rest = -0.9, fire = 1.2, moving = motion(root, body, spokes, 0.5), standingStill = motion(root, body, [], 1);
  function pose(kind, time) {
    const t = clock(time);
    (state === "packed" ? moving : standingStill)(kind, t);
    let angle = rest, loaded = true;
    if (kind === "attack" && state === "unpacked") {
      const f = t % 2500 / 2500;
      angle = f < 0.15 ? rest + (fire - rest) * (f / 0.15) ** 2 : f < 0.3 ? fire : fire + (rest - fire) * (f - 0.3) / 0.7;
      loaded = f < 0.12 || f > 0.9;
    }
    arm.rotation.x = angle;
    shot.visible = loaded;
  }
  return { root, sockets: noSockets(T), equip: (_) => {
  }, dress, pose, grade: (_) => {
  }, state: () => state };
}
function createBombardRig(T, player, box, material) {
  const root = new T.Group();
  root.name = "siege-bombard-cannon";
  const team2 = teamOf(player), { part, group, wheel, spokes } = kit(T, box, material);
  const body = group(root, "siege-body");
  for (const x of [-0.42, 0.42]) wheel(body, x, 0, 0.62);
  part(body, 0, 0.27, 0, 0.92, 0.08, 0.08, iron);
  part(body, 0, 0.3, -0.05, 0.5, 0.1, 1.1, dark);
  for (const x of [-0.27, 0.27]) {
    part(body, x, 0.4, -0.05, 0.06, 0.14, 1, wood);
    part(body, x * 1.13, 0.42, -0.05, 0.02, 0.1, 0.8, team2);
  }
  part(body, 0, 0.1, -0.66, 0.16, 0.2, 0.12, dark);
  part(body, 0, 0, -1, 0.2, 0.1, 0.66, dark);
  part(body, 0, 0.1, -1.26, 0.24, 0.06, 0.1, wood);
  for (const z of [-0.82, -0.98]) part(body, 0, 0.1, z, 0.12, 0.12, 0.12, stone);
  const barrel = group(body, "bombard-barrel", 0, 0.4, 0);
  barrel.rotation.x = -0.1;
  part(barrel, 0, 0.04, -0.38, 0.26, 0.26, 0.42, "#5b5e5c");
  part(barrel, 0, 0.08, -0.62, 0.12, 0.12, 0.08, "#5b5e5c");
  part(barrel, 0, 0, 0.02, 0.4, 0.4, 0.62, "#6b6f6c");
  for (const z of [-0.24, -0.1, 0.08, 0.24]) part(barrel, 0, -0.02, z, 0.44, 0.44, 0.05, "#3f4240");
  part(barrel, 0, -0.03, 0.34, 0.46, 0.46, 0.06, "#3f4240");
  part(barrel, 0, 0.08, 0.4, 0.22, 0.22, 0.01, "#1f1d1b");
  part(barrel, 0, 0.3, -0.5, 0.04, 0.02, 0.04, "#1f1d1b");
  const flash = part(barrel, 0, 0.08, 0.42, 0.24, 0.24, 0.14, "#f2c25a");
  flash.visible = false;
  const move = motion(root, body, spokes, 0.46);
  function pose(kind, time) {
    const t = clock(time);
    move(kind, t);
    let back = 0, jolt = 0, fired = false;
    if (kind === "attack") {
      const f = t % 1600 / 1600;
      back = f < 0.06 ? 0.2 * Math.sin(Math.PI / 2 * f / 0.06) : f < 0.5 ? 0.2 * (1 - (f - 0.06) / 0.44) : 0;
      jolt = f < 0.12 ? Math.sin(Math.PI * f / 0.12) : 0;
      fired = f < 0.05;
    }
    const fall = kind === "death" ? Math.min(t / 700, 1) : 0;
    barrel.position.set(0, 0.4 - 0.12 * fall, -back + 0.3 * fall);
    barrel.rotation.set(-0.1 - 0.04 * jolt + 0.5 * fall, 0, 0.35 * fall);
    body.position.z = -0.06 * jolt;
    flash.visible = fired;
  }
  return { root, sockets: noSockets(T), equip: (_) => {
  }, dress: (_) => {
  }, pose, grade: (_) => {
  } };
}
function createSiegeRig(T, kind, player, box, material) {
  return kind === "mangonel" ? createMangonelRig(T, player, box, material) : kind === "scorpion" ? createScorpionRig(T, player, box, material) : kind === "trebuchet" ? createTrebuchetRig(T, player, box, material) : kind === "bombard-cannon" ? createBombardRig(T, player, box, material) : createRamRig(T, player, box, material);
}

// apps/web/vessel-rig.ts
var wood2 = "#8a6a45";
var dark2 = "#5c4a36";
var deck = "#b8955f";
var plank = "#a4824f";
var iron2 = "#5b5e5c";
var gilt = "#c9a55a";
var rope2 = "#7a5c40";
var cloth = "#ece2c4";
var flame = "#e0a040";
var spark = "#f5dc7a";
var keg = "#7c5a3a";
var teamOf2 = (player) => player === 0 ? "#45728c" : "#b25441";
var clock2 = (time) => Number.isFinite(time) ? Math.max(0, time) : 0;
function kit2(T, box, material) {
  const part = (parent, x, y, z, w, h, d, color) => {
    const m = new T.Mesh(box(w, h, d), material(color));
    m.position.set(x, y, z);
    m.castShadow = true;
    parent.add(m);
    return m;
  };
  const group = (parent, name, x = 0, y = 0, z = 0) => {
    const g = new T.Group();
    g.name = name;
    g.position.set(x, y, z);
    parent.add(g);
    return g;
  };
  const hull2 = (g, L, B, H, color, trim) => {
    part(g, 0, -0.12, 0, B * 0.55, 0.12, L * 0.62, dark2);
    part(g, 0, 0, 0, B, H, L * 0.6, color);
    [0.78, 0.54, 0.3].forEach((s, i) => part(g, 0, 0, L * 0.3 + L * 0.08 * (i + 0.5), B * s, H + 0.03 * (i + 1), L * 0.08, color));
    [0.82, 0.6].forEach((s, i) => part(g, 0, 0, -(L * 0.3 + L * 0.07 * (i + 0.5)), B * s, H + 0.02 * (i + 1), L * 0.07, color));
    part(g, 0, H, 0, B * 0.78, 0.02, L * 0.56, deck);
    for (const x of [-1, 1]) part(g, x * (B / 2 - 0.025), H, 0, 0.05, 0.05, L * 0.6, trim);
    return H + 0.02;
  };
  const sail = (r, z, deckY, mastH, w, h, color, stripe) => {
    part(r.group, 0, deckY, z, 0.06, mastH, 0.06, wood2);
    const g = group(r.group, "sail", 0, 0, z);
    part(g, 0, deckY + mastH - 0.06, 0, w + 0.12, 0.04, 0.04, wood2);
    part(g, 0, deckY + mastH - 0.08 - h, 0.04, w, h, 0.02, color);
    part(g, 0, deckY + mastH - 0.08 - h * 0.62, 0.055, w, h * 0.24, 0.02, stripe);
    r.sails.push({ g, z });
  };
  const oars = (r, n, B, deckY, z0, step, len = 0.42) => {
    for (const side of [-1, 1]) for (let i = 0; i < n; i++) {
      const o = group(r.group, "oar", side * B / 2, deckY - 0.04, z0 + i * step);
      o.rotation.z = side * 0.55;
      part(o, side * len / 2, -0.015, 0, len, 0.03, 0.03, wood2);
      part(o, side * (len - 0.05), -0.03, 0, 0.1, 0.06, 0.03, plank);
      r.oars.push(o);
    }
  };
  return { part, group, hull: hull2, sail, oars };
}
function afloat(root, body) {
  return (kind, t) => {
    const fall = kind === "death" ? Math.min(t / 1400, 1) : 0, hit = kind === "hit" && t < 300 ? Math.sin(Math.PI * t / 300) : 0;
    body.position.y = fall ? 0 : Math.sin(t * 24e-4) * 0.02;
    body.rotation.z = fall ? 0 : Math.sin(t * 17e-4) * 0.03 + hit * 0.08;
    body.rotation.x = 0;
    root.position.y = -fall * 0.55;
    root.rotation.x = -fall * 0.45;
    root.rotation.z = fall * 0.18;
  };
}
function animate(r, kind, t) {
  const moving = kind === "walk" || kind === "carry";
  r.oars.forEach((o, i) => {
    o.rotation.y = moving ? Math.sin(t * 8e-3 + i % 2 * 0.4) * 0.4 : 0;
  });
  for (const s of r.sails) s.g.position.z = s.z + (moving ? 0.05 : 0);
  const f = t % 1500 / 1500;
  if (r.bolt) {
    r.bolt.m.position.z = r.bolt.z + (kind === "attack" ? f * 1.1 : 0);
    r.bolt.m.visible = kind !== "attack" || f < 0.55;
  }
  if (r.flash) r.flash.forEach((m, i) => {
    m.visible = kind === "attack" && t % 1500 < 90 + i * 20;
  });
  if (r.flames) r.flames.forEach((m, i) => {
    m.visible = kind === "attack" && (Math.floor(t / 125) + i) % 2 === 0;
  });
  if (r.net) {
    const dip = kind === "work" ? (Math.sin(t * 4e-3) + 1) / 2 : 0;
    r.net.rotation.x = 0.25 + dip * 0.55;
  }
}
function createShipRig(T, kind, player, box, material) {
  const root = new T.Group();
  root.name = `ship-${kind}`;
  const team2 = teamOf2(player), k = kit2(T, box, material), { part, group, hull: hull2, sail, oars } = k;
  const body = group(root, "ship-body");
  const looks = /* @__PURE__ */ new Map();
  const look = (name, build) => {
    const r = { group: group(body, `look-${name ?? "base"}`), oars: [], sails: [] };
    build(r);
    r.group.visible = name === null;
    looks.set(name, r);
  };
  const ballista = (r, y, z, arm = 0.3) => {
    part(r.group, 0, y, z, 0.08, 0.06, 0.26, dark2);
    part(r.group, 0, y + 0.06, z + 0.08, arm, 0.04, 0.04, wood2);
    const m = part(r.group, 0, y + 0.08, z, 0.03, 0.03, 0.3, "#d8c48a");
    r.bolt = { m, z };
  };
  const shields = (r, B, y, z0, n, step) => {
    for (const side of [-1, 1]) for (let i = 0; i < n; i++) part(r.group, side * (B / 2 + 0.015), y - 0.1, z0 + i * step, 0.03, 0.14, 0.14, i % 2 ? cloth : team2);
  };
  if (kind === "fishing-ship") {
    look(null, (r) => {
      const y = hull2(r.group, 0.9, 0.42, 0.24, wood2, dark2);
      sail(r, 0.08, y, 0.62, 0.34, 0.32, cloth, team2);
      part(r.group, 0, y, -0.22, 0.3, 0.1, 0.16, keg);
      const net2 = group(r.group, "net", 0.2, y + 0.36, -0.12);
      part(net2, 0, 0, 0, 0.04, 0.04, 0.36, wood2);
      part(net2, 0.02, -0.3, 0.16, 0.16, 0.3, 0.04, "#9aa08a");
      part(net2, 0.02, -0.3, 0.16, 0.18, 0.04, 0.05, team2);
      r.net = net2;
      for (const z of [-0.08, 0.02]) part(r.group, -0.1, y, z, 0.12, 0.06, 0.08, "#bad0ce");
    });
  } else if (kind === "transport-ship") {
    look(null, (r) => {
      const y = hull2(r.group, 1.25, 0.62, 0.22, wood2, dark2);
      part(r.group, 0, y, -0.1, 0.44, 0.04, 0.56, dark2);
      for (const [x, z] of [[-0.1, -0.24], [0.12, -0.02]]) part(r.group, x, y + 0.04, z, 0.18, 0.16, 0.18, plank);
      part(r.group, 0, y, 0.48, 0.36, 0.05, 0.12, deck);
      sail(r, 0.18, y, 0.58, 0.4, 0.28, cloth, team2);
      oars(r, 2, 0.62, y, -0.2, 0.3);
    });
  } else if (kind === "trade-cog") {
    look(null, (r) => {
      const y = hull2(r.group, 1.1, 0.58, 0.4, wood2, team2);
      part(r.group, 0, y, -0.38, 0.5, 0.18, 0.22, plank);
      part(r.group, 0, y + 0.18, -0.38, 0.54, 0.04, 0.26, dark2);
      sail(r, 0.08, y, 0.9, 0.48, 0.52, cloth, gilt);
      part(r.group, -0.12, y, 0.22, 0.16, 0.14, 0.16, "#d8c9a6");
      part(r.group, 0.1, y, 0.24, 0.12, 0.16, 0.12, keg);
      part(r.group, 0, y + 0.9, 0.08, 0.12, 0.06, 0.04, gilt);
    });
  } else if (kind === "galley") {
    look(null, (r) => {
      const y = hull2(r.group, 1.45, 0.48, 0.26, wood2, dark2);
      part(r.group, 0, -0.04, 0.74, 0.12, 0.1, 0.14, "#a07c4a");
      sail(r, -0.05, y, 0.78, 0.42, 0.38, team2, cloth);
      oars(r, 3, 0.48, y, -0.36, 0.22);
      ballista(r, y, 0.42);
    });
    look("war-galley", (r) => {
      const y = hull2(r.group, 1.55, 0.52, 0.3, wood2, team2);
      part(r.group, 0, -0.04, 0.8, 0.14, 0.12, 0.16, iron2);
      part(r.group, 0, y, 0.4, 0.42, 0.12, 0.3, plank);
      sail(r, -0.12, y, 0.86, 0.46, 0.42, team2, cloth);
      sail(r, 0.24, y + 0.12, 0.56, 0.28, 0.24, cloth, team2);
      oars(r, 3, 0.52, y, -0.4, 0.22);
      shields(r, 0.52, y, -0.42, 4, 0.2);
      ballista(r, y + 0.12, 0.48);
    });
    look("galleon", (r) => {
      const y = hull2(r.group, 1.7, 0.6, 0.36, dark2, gilt);
      part(r.group, 0, y, -0.52, 0.52, 0.26, 0.36, wood2);
      part(r.group, 0, y + 0.26, -0.52, 0.56, 0.04, 0.4, gilt);
      part(r.group, 0, y, 0.48, 0.46, 0.12, 0.26, plank);
      sail(r, -0.22, y, 1.1, 0.52, 0.48, team2, cloth);
      sail(r, 0.12, y, 0.96, 0.48, 0.42, cloth, team2);
      sail(r, 0.42, y + 0.12, 0.6, 0.3, 0.26, team2, cloth);
      shields(r, 0.6, y, -0.3, 4, 0.2);
      ballista(r, y + 0.12, 0.56, 0.36);
      part(r.group, 0, y + 1.1, -0.22, 0.14, 0.08, 0.04, gilt);
    });
  } else if (kind === "fire-galley") {
    const siphon = (r, y, z, size) => {
      part(r.group, 0, y, z, 0.12, 0.12, 0.16, iron2);
      part(r.group, 0, y + 0.04, z + 0.12, 0.06, 0.06, 0.16, iron2);
      r.flames = [part(r.group, 0, y + 0.02, z + 0.28, size, size * 0.8, size, flame), part(r.group, 0, y + 0.04, z + 0.28 + size, size * 0.8, size * 0.6, size * 0.9, spark)];
    };
    look(null, (r) => {
      const y = hull2(r.group, 1.2, 0.42, 0.22, wood2, dark2);
      sail(r, -0.12, y, 0.6, 0.32, 0.28, cloth, team2);
      oars(r, 2, 0.42, y, -0.28, 0.24);
      part(r.group, 0, y, 0, 0.16, 0.1, 0.16, iron2);
      part(r.group, 0, y + 0.1, 0, 0.1, 0.08, 0.1, flame);
      siphon(r, y, 0.38, 0.12);
    });
    look("war-galley", (r) => {
      const y = hull2(r.group, 1.35, 0.48, 0.26, wood2, team2);
      sail(r, -0.16, y, 0.7, 0.38, 0.32, team2, cloth);
      oars(r, 3, 0.48, y, -0.36, 0.2);
      part(r.group, 0, y, 0.3, 0.3, 0.18, 0.2, iron2);
      part(r.group, 0, y + 0.18, 0.3, 0.34, 0.04, 0.24, team2);
      for (const z of [-0.04, 0.14]) part(r.group, 0, y, z, 0.12, 0.12, 0.12, flame);
      siphon(r, y + 0.04, 0.42, 0.14);
    });
    look("fast-fire-ship", (r) => {
      const y = hull2(r.group, 1.5, 0.46, 0.26, dark2, gilt);
      part(r.group, 0, -0.04, 0.76, 0.12, 0.12, 0.14, iron2);
      sail(r, -0.2, y, 0.8, 0.38, 0.36, team2, flame);
      sail(r, 0.2, y, 0.5, 0.24, 0.2, cloth, team2);
      oars(r, 4, 0.46, y, -0.46, 0.2);
      for (const x of [-0.08, 0.08]) part(r.group, x, y, 0.44, 0.06, 0.06, 0.18, iron2);
      part(r.group, 0, y, 0.32, 0.28, 0.14, 0.14, iron2);
      siphon(r, y + 0.06, 0.5, 0.16);
    });
  } else if (kind === "demolition-raft") {
    const kegs = (r, y, spots, banded) => {
      for (const [x, z] of spots) {
        part(r.group, x, y, z, 0.14, 0.16, 0.14, keg);
        part(r.group, x, y + 0.06, z, 0.15, 0.03, 0.15, banded ? iron2 : dark2);
      }
      part(r.group, spots[0][0], y + 0.16, spots[0][1], 0.02, 0.08, 0.02, rope2);
      part(r.group, spots[0][0], y + 0.24, spots[0][1], 0.05, 0.05, 0.05, spark);
    };
    look(null, (r) => {
      for (let i = 0; i < 5; i++) part(r.group, -0.28 + i * 0.14, -0.06, 0, 0.12, 0.12, 0.78, i % 2 ? wood2 : plank);
      for (const z of [-0.28, 0.28]) part(r.group, 0, 0.06, z, 0.72, 0.04, 0.06, rope2);
      kegs(r, 0.06, [[-0.14, -0.12], [0.1, -0.12], [-0.02, 0.12]], false);
      part(r.group, 0.24, 0.06, 0.2, 0.04, 0.5, 0.04, wood2);
      part(r.group, 0.24, 0.38, 0.24, 0.02, 0.14, 0.14, team2);
      oars(r, 1, 0.7, 0.1, -0.16, 0, 0.34);
    });
    look("war-galley", (r) => {
      const y = hull2(r.group, 0.95, 0.46, 0.2, wood2, team2);
      kegs(r, y, [[-0.1, -0.16], [0.1, -0.16], [-0.1, 0.04], [0.1, 0.04], [0, 0.24]], false);
      part(r.group, 0, y, -0.38, 0.06, 0.36, 0.06, wood2);
      part(r.group, 0, y + 0.36, -0.38, 0.08, 0.08, 0.08, flame);
    });
    look("heavy-demolition-ship", (r) => {
      const y = hull2(r.group, 1.1, 0.52, 0.24, dark2, iron2);
      kegs(r, y, [[-0.12, -0.24], [0.12, -0.24], [-0.12, -0.04], [0.12, -0.04], [-0.12, 0.16], [0.12, 0.16], [0, 0.34]], true);
      for (const z of [-0.14, 0.06]) part(r.group, 0, y + 0.16, z, 0.34, 0.04, 0.04, iron2);
      sail(r, -0.42, y, 0.5, 0.24, 0.22, team2, keg);
    });
  } else if (kind === "cannon-galleon") {
    const gun = (r, x, y, z, along) => {
      const m = part(r.group, x, y, z, along ? 0.08 : 0.18, 0.08, along ? 0.2 : 0.08, iron2);
      r.flash ??= [];
      r.flash.push(part(r.group, along ? x : x + Math.sign(x) * 0.12, y, along ? z + 0.13 : z, 0.09, 0.09, 0.09, spark));
      return m;
    };
    look(null, (r) => {
      const y = hull2(r.group, 1.55, 0.64, 0.34, dark2, team2);
      part(r.group, 0, y, -0.5, 0.54, 0.24, 0.34, wood2);
      part(r.group, 0, y + 0.24, -0.5, 0.58, 0.04, 0.38, team2);
      for (const z of [-0.12, 0.18]) for (const x of [-0.34, 0.34]) gun(r, x, y - 0.16, z, false);
      gun(r, 0, y, 0.5, true);
      sail(r, -0.06, y, 1, 0.52, 0.46, cloth, team2);
      sail(r, 0.3, y, 0.7, 0.32, 0.28, team2, cloth);
    });
    look("elite-cannon-galleon", (r) => {
      const y = hull2(r.group, 1.7, 0.7, 0.4, dark2, gilt);
      part(r.group, 0, y, -0.56, 0.6, 0.34, 0.4, wood2);
      part(r.group, 0, y + 0.34, -0.56, 0.64, 0.04, 0.44, gilt);
      part(r.group, 0, y + 0.38, -0.62, 0.3, 0.16, 0.2, team2);
      for (const z of [-0.2, 0.06, 0.32]) for (const x of [-0.37, 0.37]) {
        gun(r, x, y - 0.2, z, false);
      }
      for (const z of [-0.06, 0.2]) for (const x of [-0.37, 0.37]) gun(r, x, y - 0.08, z, false);
      gun(r, 0, y, 0.56, true);
      sail(r, -0.12, y, 1.16, 0.58, 0.52, team2, cloth);
      sail(r, 0.32, y, 0.8, 0.36, 0.32, cloth, team2);
      part(r.group, 0, y + 1.16, -0.12, 0.16, 0.08, 0.04, gilt);
    });
  } else if (kind === "longboat") {
    const dragon = (r, y, L, color) => {
      part(r.group, 0, y - 0.02, L * 0.5, 0.06, 0.18, 0.06, color);
      part(r.group, 0, y + 0.14, L * 0.5 + 0.04, 0.08, 0.08, 0.14, color);
      part(r.group, 0, y + 0.2, L * 0.5 + 0.12, 0.04, 0.04, 0.06, "#1f1d1b");
      part(r.group, 0, y - 0.02, -L * 0.47, 0.06, 0.14, 0.06, color);
      part(r.group, 0, y + 0.12, -L * 0.47 - 0.06, 0.05, 0.06, 0.1, color);
    };
    const striped = (r, y, mast, w, h) => {
      part(r.group, 0, y, 0, 0.06, mast, 0.06, wood2);
      const g = group(r.group, "sail", 0, 0, 0);
      part(g, 0, y + mast - 0.06, 0, w + 0.12, 0.04, 0.04, wood2);
      for (let i = 0; i < 5; i++) part(g, -w / 2 + w * (i + 0.5) / 5, y + mast - 0.08 - h, 0.04, w / 5, h, 0.02, i % 2 ? cloth : team2);
      r.sails.push({ g, z: 0 });
    };
    look(null, (r) => {
      const y = hull2(r.group, 1.6, 0.44, 0.18, wood2, dark2);
      for (let i = 0; i < 3; i++) part(r.group, 0, 0.04 + i * 0.05, 0, 0.46 - i * 0.01, 0.02, 0.9, i % 2 ? plank : wood2);
      dragon(r, y, 1.6, wood2);
      striped(r, y, 0.8, 0.44, 0.36);
      oars(r, 4, 0.44, y, -0.48, 0.22, 0.4);
      shields(r, 0.44, y + 0.06, -0.52, 6, 0.2);
      ballista(r, y, 0.42, 0.24);
    });
    look("elite-longboat", (r) => {
      const y = hull2(r.group, 1.75, 0.48, 0.2, dark2, gilt);
      for (let i = 0; i < 3; i++) part(r.group, 0, 0.04 + i * 0.05, 0, 0.5 - i * 0.01, 0.02, 1, i % 2 ? gilt : wood2);
      dragon(r, y, 1.75, gilt);
      striped(r, y, 0.96, 0.5, 0.44);
      oars(r, 5, 0.48, y, -0.56, 0.22, 0.4);
      shields(r, 0.48, y + 0.06, -0.58, 7, 0.19);
      ballista(r, y, 0.48, 0.28);
    });
  } else throw Error(`\u672A\u77E5\u8239\u96BB\uFF1A${kind}`);
  let shown = looks.get(null);
  function grade(look2) {
    const next = looks.get(look2) ?? looks.get(null);
    for (const r of looks.values()) r.group.visible = r === next;
    shown = next;
  }
  const move = afloat(root, body);
  function pose(kind2, time) {
    const t = clock2(time);
    move(kind2, t);
    animate(shown, kind2, t);
  }
  return { root, sockets: { leftHand: new T.Group(), rightHand: new T.Group() }, equip: (_) => {
  }, dress: (_) => {
  }, pose, grade };
}
function createTradeCartRig(T, player, box, material) {
  const root = new T.Group();
  root.name = "vessel-trade-cart";
  const team2 = teamOf2(player), { part, group } = kit2(T, box, material);
  const body = group(root, "cart-body"), hide = "#8b6a4c", horn = "#efe6d2";
  const ox = group(body, "ox", 0, 0, 0.5);
  part(ox, 0, 0.3, 0, 0.32, 0.3, 0.56, hide);
  part(ox, 0, 0.5, 0.3, 0.22, 0.2, 0.2, hide);
  part(ox, 0, 0.5, 0.42, 0.16, 0.1, 0.06, "#5c4a36");
  for (const x of [-1, 1]) part(ox, x * 0.15, 0.66, 0.32, 0.12, 0.04, 0.04, horn);
  const legs = [];
  for (const [x, z] of [[-0.1, 0.18], [0.1, 0.18], [-0.1, -0.18], [0.1, -0.18]]) {
    const l = group(ox, "leg", x, 0.32, z);
    part(l, 0, -0.3, 0, 0.08, 0.3, 0.08, "#5c4a36");
    legs.push(l);
  }
  part(ox, 0, 0.6, 0.14, 0.4, 0.04, 0.06, wood2);
  for (const x of [-0.18, 0.18]) part(body, x, 0.36, 0.12, 0.04, 0.04, 0.5, wood2);
  const spokes = [];
  for (const x of [-0.32, 0.32]) {
    part(body, x, 0, -0.3, 0.06, 0.4, 0.4, dark2);
    const s = group(body, "wheel-spokes", x + Math.sign(x) * 0.035, 0.2, -0.3);
    part(s, 0, -0.17, 0, 0.02, 0.34, 0.04, "#3f3226");
    part(s, 0, -0.02, 0, 0.02, 0.04, 0.34, "#3f3226");
    spokes.push(s);
  }
  part(body, 0, 0.2, -0.3, 0.7, 0.04, 0.04, iron2);
  part(body, 0, 0.26, -0.3, 0.56, 0.08, 0.62, wood2);
  for (const x of [-0.27, 0.27]) part(body, x, 0.34, -0.3, 0.04, 0.12, 0.62, plank);
  part(body, -0.1, 0.34, -0.42, 0.2, 0.18, 0.2, "#d8c9a6");
  part(body, 0.12, 0.34, -0.2, 0.16, 0.16, 0.16, keg);
  part(body, 0.1, 0.34, -0.46, 0.16, 0.12, 0.16, deck);
  for (const z of [-0.58, -0.02]) for (const x of [-0.25, 0.25]) part(body, x, 0.46, z, 0.03, 0.3, 0.03, wood2);
  part(body, 0, 0.76, -0.3, 0.56, 0.05, 0.62, team2);
  part(body, 0, 0.81, -0.3, 0.36, 0.04, 0.62, cloth);
  function pose(kind, time) {
    const t = clock2(time), moving = kind === "walk" || kind === "carry", fall = kind === "death" ? Math.min(t / 700, 1) : 0;
    legs.forEach((l, i) => {
      l.rotation.x = moving ? Math.sin(t * 0.012 + (i % 3 ? Math.PI : 0)) * 0.45 : 0;
    });
    for (const s of spokes) s.rotation.x = moving ? -t * 6e-3 : 0;
    body.rotation.x = kind === "hit" && t < 300 ? -0.05 * Math.sin(Math.PI * t / 300) : 0;
    body.position.y = Math.abs(Math.sin(body.rotation.x)) * 0.6;
    root.rotation.z = -fall * 0.5;
    root.position.y = Math.sin(fall * 0.5) * 0.36;
  }
  return { root, sockets: { leftHand: new T.Group(), rightHand: new T.Group() }, equip: (_) => {
  }, dress: (_) => {
  }, pose, grade: (_) => {
  } };
}
function createVesselRig(T, kind, player, box, material) {
  return kind === "trade-cart" ? createTradeCartRig(T, player, box, material) : createShipRig(T, kind, player, box, material);
}
var vesselFrames = { "fishing-ship": { bar: 1.15, ring: 1.3 }, "transport-ship": { bar: 1.05, ring: 1.7 }, "trade-cog": { bar: 1.55, ring: 1.5 }, galley: { bar: 1.3, ring: 2 }, "fire-galley": { bar: 1.05, ring: 1.7 }, "demolition-raft": { bar: 0.85, ring: 1.3 }, "cannon-galleon": { bar: 1.6, ring: 2.1 }, longboat: { bar: 1.25, ring: 2.1 }, "trade-cart": { bar: 1.1, ring: 1.4 } };

// apps/web/fortification-building.ts
var wallKinds = ["palisade-wall", "stone-wall"];
var gateKinds = ["palisade-gate", "gate"];
var noLinks = { n: false, s: false, e: false, w: false, ne: false, nw: false, se: false, sw: false };
var wallFamily = (kind) => kind === "palisade-wall" || kind === "palisade-gate" ? "palisade" : kind === "stone-wall" || kind === "gate" ? "stone" : null;
var check3 = (v, what) => {
  if (![1, 2, 3, 4].includes(v.ageVariant) || ![v.progress, v.health].every((n) => Number.isFinite(n) && n >= 0 && n <= 100)) throw Error(`\u7121\u6548${what}\u5916\u89C0`);
};
var wood3 = "#94734c";
var oak = "#6e5438";
var dark3 = "#4a4740";
var stone2 = "#b5b29e";
var stoneDark = "#9d9a88";
var soil = "#806b49";
var iron3 = "#5b5e5c";
var flame2 = "#e0a040";
var spark2 = "#f5dc7a";
var straw = "#b8a074";
var gilt2 = "#c9a55a";
function builder() {
  const p = [];
  const add = (id, phase, x, z, y, w, d, h, color, studs = false) => {
    p.push({ id, phase, x, z, y, w, d, h, color, studs });
  };
  return { p, add };
}
function finish2(p, v, debris, lost, count = 4) {
  if (v.health === 0) return [p[0], ...Array.from({ length: count }, (_, i) => ({ id: `debris-${i}`, phase: 0, x: 0.1 + i % 2 * 0.45, z: 0.1 + Math.floor(i / 2) * 0.45, y: 0.04, w: 0.3, d: 0.28, h: 0.1, color: debris, studs: false }))];
  return p.filter((a) => a.phase <= Math.min(4, Math.floor(v.progress / 20))).filter((a) => v.health >= 50 || !lost.test(a.id));
}
var diagonals = [["ne", 1, -1], ["nw", -1, -1], ["se", 1, 1], ["sw", -1, 1]];
function wallParts(kind, v, links = noLinks) {
  check3(v, "\u57CE\u7246");
  if (!wallKinds.includes(kind)) throw Error("\u672A\u77E5\u57CE\u7246");
  const { p, add } = builder(), age = v.ageVariant, team2 = v.red ? "#b85c47" : "#456e87";
  if (kind === "palisade-wall") {
    const H2 = 1.04 + (age >= 3 ? 0.12 : 0), stake = (id, x, z, y, h, w, d) => {
      add(id, 1, x, z, y, w, d, h, wood3);
      add(`${id}-tip`, 2, x + w * 0.25, z + d * 0.25, y + h, w * 0.5, d * 0.5, 0.14, oak);
    };
    add("foundation", 0, 0.32, 0.32, 0, 0.36, 0.36, 0.06, soil);
    stake("stake-c", 0.4, 0.4, 0.06, H2 + 0.04, 0.2, 0.2);
    add("lashing", 3, 0.39, 0.39, 0.62, 0.22, 0.22, 0.08, team2);
    for (const [dir, dx, dz] of [["e", 1, 0], ["w", -1, 0], ["s", 0, 1], ["n", 0, -1]]) if (links[dir]) {
      for (let i = 1; i <= 2; i++) stake(`stake-${dir}-${i}`, dx ? 0.4 + 0.2 * i * dx : 0.41, dz ? 0.4 + 0.2 * i * dz : 0.41, 0, H2 - i % 2 * 0.06, dx ? 0.2 : 0.18, dz ? 0.2 : 0.18);
      add(`rail-${dir}`, 2, dx > 0 ? 0.6 : dx < 0 ? 0 : 0.45, dz > 0 ? 0.6 : dz < 0 ? 0 : 0.45, 0.52, dx ? 0.4 : 0.1, dz ? 0.4 : 0.1, 0.08, oak);
    }
    for (const [dir, dx, dz] of diagonals) if (links[dir]) for (const [i, t] of [0.2, 0.38].entries()) stake(`stake-${dir}-${i}`, 0.39 + dx * t, 0.39 + dz * t, 0, H2 - 0.06 * (i + 1), 0.22, 0.22);
    return finish2(p, v, wood3, /-tip$|^rail-/);
  }
  const H = 0.96 + (age >= 3 ? 0.16 : 0), top = 0.08 + H;
  add("foundation", 0, 0.2, 0.2, 0, 0.6, 0.6, 0.08, stoneDark);
  add("pier", 1, 0.22, 0.22, 0.08, 0.56, 0.56, H, stone2, true);
  for (const z of [0.2, 0.78]) add(`shield-${z}`, 3, 0.42, z, 0.42, 0.16, 0.02, 0.2, team2);
  for (const [dir, dx, dz] of [["e", 1, 0], ["w", -1, 0], ["s", 0, 1], ["n", 0, -1]]) if (links[dir]) {
    const x = dx > 0 ? 0.78 : dx < 0 ? 0 : 0.25, z = dz > 0 ? 0.78 : dz < 0 ? 0 : 0.25, w = dx ? 0.22 : 0.5, d = dz ? 0.22 : 0.5;
    add(`arm-${dir}`, 1, x, z, 0, w, d, top, stone2, true);
    add(`merlon-${dir}`, 2, dx > 0 ? 0.84 : dx < 0 ? 0 : 0.37, dz > 0 ? 0.84 : dz < 0 ? 0 : 0.37, top, dx ? 0.16 : 0.26, dz ? 0.16 : 0.26, 0.2, stone2);
    if (age >= 3) add(`slit-${dir}`, 3, dx ? x + 0.06 : 0.24, dz ? z + 0.06 : 0.24, 0.5, dx ? 0.1 : 0.02, dz ? 0.1 : 0.02, 0.24, dark3);
  }
  for (const [dir, dx, dz] of diagonals) if (links[dir]) for (const [i, t] of [0.28, 0.38].entries()) add(`arm-${dir}-${i}`, 1, 0.38 + dx * t, 0.38 + dz * t, 0, 0.24, 0.24, top - 0.04 * i, stone2, true);
  for (const [x, z] of [[0.22, 0.22], [0.64, 0.22], [0.22, 0.64], [0.64, 0.64]]) add(`merlon-c-${x}-${z}`, 2, x, z, top, 0.14, 0.14, 0.2, stone2);
  if (age >= 3) add("coping", 3, 0.3, 0.3, top, 0.4, 0.4, 0.06, stoneDark);
  return finish2(p, v, stone2, /^(merlon-[en]|merlon-c-0\.64-0\.64|coping)$/);
}
function gateParts(kind, v, links = noLinks) {
  check3(v, "\u57CE\u9580");
  if (!gateKinds.includes(kind)) throw Error("\u672A\u77E5\u57CE\u9580");
  const { p, add } = builder(), age = v.ageVariant, team2 = v.red ? "#b85c47" : "#456e87";
  if (kind === "gate") {
    const H = 1.32 + (age >= 3 ? 0.16 : 0);
    add("foundation", 0, 0, 0.22, 0, 1, 0.56, 0.06, stoneDark);
    for (const [i, x] of [0, 0.74].entries()) {
      add(`tower-${i}`, 1, x, 0.2, 0.06, 0.26, 0.6, H, stone2, true);
      for (const z of [0.2, 0.66]) add(`merlon-${i}-${z}`, 2, x + 0.06, z, 0.06 + H, 0.14, 0.14, 0.18, stone2);
      if (age === 4) {
        add(`cap-${i}`, 3, x + 0.02, 0.36, 0.06 + H, 0.22, 0.28, 0.12, team2, true);
        add(`finial-${i}`, 4, x + 0.09, 0.46, 0.18 + H, 0.08, 0.08, 0.16, gilt2);
      }
    }
    add("lintel", 2, 0.26, 0.24, 0.94, 0.48, 0.52, H - 0.88, stone2, true);
    add("door-l", 3, 0.26, 0.46, 0.06, 0.24, 0.08, 0.88, oak);
    add("door-r", 3, 0.5, 0.46, 0.06, 0.24, 0.08, 0.88, oak);
    for (const y of [0.24, 0.62]) add(`band-${y}`, 3, 0.28, 0.44, y, 0.44, 0.02, 0.06, iron3);
    add("crest", 3, 0.42, 0.42, 0.98, 0.16, 0.04, 0.18, team2);
  } else {
    const H = 1.2 + (age >= 3 ? 0.12 : 0);
    add("foundation", 0, 0, 0.3, 0, 1, 0.4, 0.04, soil);
    for (const [i, x] of [0, 0.78].entries()) {
      add(`post-${i}`, 1, x, 0.38, 0.04, 0.22, 0.24, H, wood3);
      add(`post-${i}-tip`, 2, x + 0.05, 0.44, 0.04 + H, 0.12, 0.12, 0.14, oak);
    }
    add("beam", 2, 0.22, 0.42, 0.04 + H - 0.16, 0.56, 0.16, 0.14, oak);
    add("door-l", 3, 0.22, 0.44, 0.04, 0.28, 0.1, H - 0.2, wood3);
    add("door-r", 3, 0.5, 0.44, 0.04, 0.28, 0.1, H - 0.2, wood3);
    for (const [i, y] of [0.22, 0.7].entries()) add(`brace-${i}`, 3, 0.24, 0.42, y, 0.52, 0.02, 0.06, oak);
    add("pennant", 4, 0.48, 0.5, 0.04 + H - 0.02, 0.06, 0.04, 0.28, team2);
  }
  const alongZ = !(links.e || links.w) && (links.n || links.s);
  const turned = alongZ ? p.map((a) => ({ ...a, x: a.z, z: a.x, w: a.d, d: a.w })) : p;
  return finish2(turned, v, kind === "gate" ? stone2 : wood3, /^(finial-|crest|pennant|post-\d-tip)/);
}
function outpostParts(v) {
  check3(v, "\u54E8\u7AD9");
  const { p, add } = builder(), age = v.ageVariant, team2 = v.red ? "#b85c47" : "#456e87", deckY = 1.18 + (age - 1) * 0.14;
  add("foundation", 0, 0.1, 0.1, 0, 0.8, 0.8, 0.1, age >= 2 ? stoneDark : soil);
  for (const [x, z] of [[0.14, 0.14], [0.74, 0.14], [0.14, 0.74], [0.74, 0.74]]) add(`leg-${x}-${z}`, 1, x, z, 0.1, 0.12, 0.12, deckY - 0.1, wood3);
  for (const y of [0.5, 0.9]) add(`brace-${y}`, 1, 0.26, 0.14, y, 0.48, 0.04, 0.06, oak);
  add("deck", 2, 0.06, 0.06, deckY, 0.88, 0.88, 0.08, wood3, true);
  for (const [x, z, w, d] of [[0.06, 0.06, 0.88, 0.06], [0.06, 0.88, 0.88, 0.06], [0.06, 0.12, 0.06, 0.76], [0.88, 0.12, 0.06, 0.76]]) add(`rail-${x}-${z}`, 3, x, z, deckY + 0.08, w, d, 0.2, oak);
  for (const x of [0.36, 0.58]) add(`ladder-rail-${x}`, 1, x, 0.88, 0.1, 0.04, 0.04, deckY - 0.1, oak);
  for (let i = 0; i < 4; i++) add(`rung-${i}`, 1, 0.4, 0.88, 0.3 + i * (deckY - 0.4) / 4, 0.18, 0.04, 0.04, oak);
  add("torch-post", 3, 0.8, 0.8, deckY + 0.08, 0.06, 0.06, 0.42, oak);
  add("torch-cup", 3, 0.78, 0.78, deckY + 0.5, 0.1, 0.1, 0.06, iron3);
  add("torch-flame", 4, 0.8, 0.8, deckY + 0.56, 0.06, 0.06, 0.12, flame2);
  add("torch-spark", 4, 0.815, 0.815, deckY + 0.68, 0.03, 0.03, 0.06, spark2);
  if (age >= 2) {
    for (const [x, z] of [[0.08, 0.08], [0.08, 0.8]]) add(`roof-post-${z}`, 3, x, z, deckY + 0.08, 0.06, 0.06, 0.5, oak);
    add("roof", 3, 0, 0.04, deckY + 0.58, 0.6, 0.9, 0.08, age >= 3 ? team2 : straw, true);
  }
  add("pennant-pole", 4, 0.12, 0.12, deckY + (age >= 2 ? 0.66 : 0.08), 0.04, 0.04, 0.34, oak);
  add("pennant", 4, 0.16, 0.12, deckY + (age >= 2 ? 0.86 : 0.28), 0.22, 0.03, 0.12, team2);
  return finish2(p, v, wood3, /^(pennant|torch-spark|torch-flame)/);
}
function bombardTowerParts(v) {
  check3(v, "\u706B\u7832\u5854");
  const { p, add } = builder(), team2 = v.red ? "#b85c47" : "#456e87", H = 0.86;
  add("foundation", 0, 0, 0, 0, 1, 1, 0.12, stoneDark);
  add("batter", 1, 0.02, 0.02, 0.12, 0.96, 0.96, 0.26, stoneDark, true);
  const y0 = 0.38;
  add("drum", 1, 0.1, 0.1, y0, 0.8, 0.8, H, stone2, true);
  add("drum-x", 1, 0.04, 0.22, y0, 0.92, 0.56, H, stone2);
  add("drum-z", 1, 0.22, 0.04, y0, 0.56, 0.92, H, stone2);
  for (const y of [y0 + 0.24, y0 + 0.62]) add(`band-${y}`, 2, 0.03, 0.21, y, 0.94, 0.58, 0.06, iron3);
  add("embrasure", 2, 0.34, 0.96, y0 + 0.26, 0.32, 0.02, 0.28, dark3);
  add("barrel-front", 3, 0.39, 0.97, y0 + 0.3, 0.22, 0.2, 0.2, iron3);
  add("muzzle", 3, 0.37, 1, y0 + 0.28, 0.26, 0.03, 0.24, "#3f4240");
  add("deck", 2, 0, 0, y0 + H, 1, 1, 0.08, stoneDark);
  const top = y0 + H + 0.08;
  for (const [x, z] of [[0, 0], [0.4, 0], [0.8, 0], [0, 0.4], [0.8, 0.4], [0, 0.8], [0.8, 0.8]]) add(`merlon-${x}-${z}`, 3, x, z, top, 0.2, 0.2, 0.2, stone2);
  add("gun-bed", 3, 0.3, 0.24, top, 0.4, 0.5, 0.08, "#6e5438");
  add("barrel-top", 3, 0.36, 0.3, top + 0.08, 0.28, 0.62, 0.24, iron3);
  for (const z of [0.44, 0.66]) add(`barrel-band-${z}`, 3, 0.34, z, top + 0.06, 0.32, 0.06, 0.28, "#3f4240");
  add("barrel-mouth", 3, 0.38, 0.92, top + 0.1, 0.24, 0.04, 0.2, "#1f1d1b");
  add("cap-post", 3, 0.06, 0.44, top, 0.08, 0.08, 0.5, "#6e5438");
  add("cap", 4, 0.02, 0.4, top + 0.5, 0.24, 0.2, 0.06, team2, true);
  for (const [x, z] of [[0, 0], [0.84, 0]]) add(`keg-${x}`, 3, x, z, 0.12, 0.16, 0.16, 0.18, "#7c5a3a");
  return finish2(p, v, stone2, /^(cap|barrel-mouth|barrel-band-0\.66|merlon-0\.4-0)$/);
}

// apps/web/harbor-building.ts
var check4 = (v, what) => {
  if (![1, 2, 3, 4].includes(v.ageVariant) || ![v.progress, v.health].every((n) => Number.isFinite(n) && n >= 0 && n <= 100)) throw Error(`\u7121\u6548${what}\u5916\u89C0`);
};
var wood4 = "#94734c";
var oak2 = "#6e5438";
var plank2 = "#a4824f";
var deck2 = "#8a6c48";
var stone3 = "#b5b29e";
var stoneDark2 = "#9d9a88";
var straw2 = "#b8a074";
var rope3 = "#d8c48a";
var iron4 = "#5b5e5c";
var brass = "#b8964a";
var net = "#7c8a78";
var keg2 = "#7c5a3a";
var fish = "#d5e7de";
var lamp = "#f5dc7a";
function turnParts(parts, size, quarters) {
  let out = parts;
  for (let q = 0; q < (quarters % 4 + 4) % 4; q++) out = out.map((a) => ({ ...a, x: size - a.z - a.d, z: a.x, w: a.d, d: a.w }));
  return out;
}
function finish3(p, v, debris, lost, size) {
  if (v.health === 0) return [p[0], ...Array.from({ length: 12 }, (_, i) => ({ id: `debris-${i}`, phase: 0, x: 0.15 + i % 4 * size / 4.4, z: 0.15 + Math.floor(i / 4) * size / 3.4, y: p[0].h, w: 0.32 * size / 3, d: 0.28 * size / 3, h: 0.1, color: debris, studs: false }))];
  return p.filter((a) => a.phase <= Math.min(4, Math.floor(v.progress / 20))).filter((a) => v.health >= 50 || !lost.test(a.id));
}
function dockParts(v, landSide = 0) {
  check4(v, "\u78BC\u982D");
  const p = [], age = v.ageVariant, team2 = v.red ? "#b85c47" : "#456e87";
  const add = (id, phase, x, z, y2, w, d, h, color, studs = false) => p.push({ id, phase, x, z, y: y2, w, d, h, color, studs });
  add("foundation", 0, 0, 0, 0, 3, 3, 0.16, deck2);
  for (let i = 0; i < 6; i++) add(`plank-${i}`, 1, 0.04, 0.04 + i * 0.49, 0.16, 2.92, 0.47, 0.03, i % 2 ? plank2 : deck2);
  const y = 0.19;
  for (const x of [0, 1.42, 2.84]) add(`pile-${x}`, 1, x, 2.84, 0, 0.16, 0.16, 0.72, oak2);
  for (const z of [1.5]) for (const x of [0, 2.84]) add(`pile-side-${x}`, 1, x, z, 0, 0.16, 0.16, 0.6, oak2);
  for (const x of [0.6, 2.2]) {
    add(`bollard-${x}`, 3, x, 2.7, y, 0.14, 0.14, 0.2, iron4);
    add(`rope-${x}`, 3, x - 0.06, 2.66, y, 0.26, 0.04, 0.06, rope3);
  }
  const wallH = 0.96 + (age >= 3 ? 0.16 : 0), shed = age === 1 ? wood4 : age === 2 ? plank2 : stone3;
  if (age >= 2) for (const x of [0.12, 1.52]) add(`footing-${x}`, 1, x, 0.12, y, 0.2, 1.16, 0.12, stoneDark2);
  const base = age >= 2 ? y + 0.12 : y;
  add("shed-back", 1, 0.12, 0.12, base, 1.6, 0.16, wallH, shed);
  for (const x of [0.12, 1.56]) add(`shed-side-${x}`, 1, x, 0.28, base, 0.16, 1, wallH, shed);
  add("shed-front-l", 1, 0.28, 1.12, base, 0.36, 0.16, wallH, shed);
  add("shed-front-r", 1, 1.2, 1.12, base, 0.36, 0.16, wallH, shed);
  add("shed-lintel", 1, 0.64, 1.12, base + 0.62, 0.56, 0.16, wallH - 0.62, shed);
  add("shed-door", 3, 0.64, 1.24, base, 0.56, 0.04, 0.6, oak2);
  const roofY = base + wallH, roof = age === 1 ? straw2 : team2;
  for (let i = 0; i < 3; i++) add(`roof-${i}`, 2, 0.04 + i * 0.26, 0.06 + i * 0.16, roofY + i * 0.16, 1.8 - i * 0.52, 1.36 - i * 0.32, 0.16, roof, true);
  add("barrel-0", 3, 1.86, 0.3, y, 0.22, 0.22, 0.28, keg2);
  add("barrel-1", 3, 1.86, 0.56, y, 0.22, 0.22, 0.22, keg2);
  add("basket", 3, 1.86, 1.3, y, 0.3, 0.26, 0.16, "#c9b27a");
  add("catch", 3, 1.9, 1.34, y + 0.16, 0.22, 0.18, 0.05, fish);
  const mastH = 1.7 + (age >= 3 ? 0.3 : 0);
  add("crane-foot", 1, 2.4, 0.2, y, 0.36, 0.36, 0.14, stoneDark2);
  add("crane-mast", 3, 2.5, 0.3, y + 0.14, 0.16, 0.16, mastH, oak2);
  add("crane-jib", 3, 2.5, 0.46, y + 0.14 + mastH - 0.16, 0.16, 1.9, 0.14, oak2);
  if (age >= 3) {
    add("crane-rope", 4, 2.56, 2.24, y + 0.62, 0.04, 0.04, mastH - 0.64, rope3);
    add("crane-net", 4, 2.46, 2.14, y + 0.4, 0.24, 0.24, 0.22, net);
    add("crane-fish", 4, 2.5, 2.18, y + 0.62, 0.16, 0.16, 0.06, fish);
  }
  if (age >= 3) add("quay", 1, 0, 0, y, 3, 0.12, 0.24, stone3, true);
  if (age === 4) {
    add("light-base", 3, 0.1, 2.2, y, 0.5, 0.5, 1.2, stone3, true);
    add("light-room", 3, 0.16, 2.26, y + 1.2, 0.38, 0.38, 0.26, lamp);
    add("light-cap", 4, 0.12, 2.22, y + 1.46, 0.46, 0.46, 0.12, team2, true);
    add("light-top", 4, 0.26, 2.36, y + 1.58, 0.18, 0.18, 0.14, brass);
  }
  add("flag-pole", 4, 2.82, 0.02, y, 0.06, 0.06, 1.3, wood4);
  add("flag", 4, 2.42, 0.02, y + 1.04, 0.4, 0.05, 0.24, team2);
  return turnParts(finish3(p, v, plank2, /^(flag|crane-net|crane-fish|crane-rope|light-top|roof-2|rope-.*)$/, 3), 3, landSide);
}
function fishTrapParts(v) {
  check4(v, "\u9B5A\u7DB2");
  const p = [], age = v.ageVariant, team2 = v.red ? "#b85c47" : "#456e87";
  const add = (id, phase, x, z, y, w, d, h, color, studs = false) => p.push({ id, phase, x, z, y, w, d, h, color, studs });
  add("foundation", 0, 0.12, 0.12, 0, 1.76, 1.76, 0.03, net);
  add("log-n", 1, 0, 0, 0, 2, 0.14, 0.1, wood4);
  add("log-s", 1, 0, 1.86, 0, 2, 0.14, 0.1, wood4);
  add("log-w", 1, 0, 0.14, 0, 0.14, 1.72, 0.1, wood4);
  add("log-e", 1, 1.86, 0.14, 0, 0.14, 1.72, 0.1, wood4);
  for (const [x, z] of [[0, 0], [1.86, 0], [0, 1.86], [1.86, 1.86]]) add(`stake-${x}-${z}`, 2, x + 0.02, z + 0.02, 0.1, 0.1, 0.1, 0.42, oak2);
  for (const [i, x] of [0.5, 0.95, 1.4].entries()) {
    add(`float-n-${i}`, 3, x, 0.02, 0.1, 0.1, 0.1, 0.08, i % 2 ? "#ece2c4" : team2);
    add(`float-s-${i}`, 3, x, 1.88, 0.1, 0.1, 0.1, 0.08, i % 2 ? "#ece2c4" : team2);
  }
  if (age >= 2) for (const t of [0.62, 1.02, 1.42]) {
    add(`mesh-x-${t}`, 3, 0.14, t - 0.02, 0.03, 1.72, 0.04, 0.02, "#5d6b5f");
    add(`mesh-z-${t}`, 3, t - 0.02, 0.14, 0.03, 0.04, 1.72, 0.02, "#5d6b5f");
  }
  for (const [x, z] of [[0.5, 0.7], [1.2, 1.1], [0.8, 1.4]]) add(`fish-${x}`, 3, x, z, 0.03, 0.22, 0.08, 0.05, fish);
  if (age === 4) {
    add("lantern", 4, 1.87, 1.87, 0.52, 0.08, 0.08, 0.1, lamp);
    add("lantern-cap", 4, 1.86, 1.86, 0.62, 0.1, 0.1, 0.04, iron4);
  }
  add("pennant", 4, 0.04, 0.04, 0.52, 0.04, 0.04, 0.26, oak2);
  add("pennant-cloth", 4, 0.08, 0.04, 0.66, 0.18, 0.03, 0.1, team2);
  return finish3(p, v, wood4, /^(pennant.*|lantern.*|float-.-1)$/, 2);
}

// apps/web/wonder-building.ts
var check5 = (v) => {
  if (![1, 2, 3, 4].includes(v.ageVariant) || ![v.progress, v.health].every((n) => Number.isFinite(n) && n >= 0 && n <= 100)) throw Error("\u7121\u6548\u4E16\u754C\u5947\u89C0\u5916\u89C0");
};
var stone4 = "#c4bba2";
var stoneDark3 = "#9d9a88";
var sand = "#d8c9a6";
var lime = "#e9e1cf";
var slate = "#5d6670";
var tar = "#4a3d30";
var carved = "#6e5438";
var tile = "#3f4a4c";
var gilt3 = "#c9a55a";
var dark4 = "#4a4740";
var glass = "#7fa3b0";
var cream = "#efe6cc";
var wonderStyles = ["neutral", "west", "central", "mideast", "eastasia"];
function wonderParts(v, style = "neutral") {
  check5(v);
  if (!wonderStyles.includes(style)) throw Error("\u672A\u77E5\u5EFA\u7BC9\u98A8\u683C");
  const p = [], team2 = v.red ? "#b85c47" : "#456e87";
  const add = (id, phase, x, z, y, w, d, h, color, studs = false, shape) => p.push({ id, phase, x, z, y, w, d, h, color, studs, ...shape ? { shape } : {} });
  const sq = (id, phase, c, y, s, h, color, studs = false) => add(id, phase, c - s / 2, c - s / 2, y, s, s, h, color, studs);
  add("foundation", 0, 0, 0, 0, 5, 5, 0.16, stoneDark3);
  add("step-0", 1, 0.2, 0.2, 0.16, 4.6, 4.6, 0.24, stone4, true);
  add("step-1", 1, 0.45, 0.45, 0.4, 4.1, 4.1, 0.24, stone4, true);
  add("stair-0", 1, 2, 4.8, 0.16, 1, 0.2, 0.12, lime);
  add("stair-1", 1, 2, 4.55, 0.4, 1, 0.25, 0.12, lime);
  const top = 0.64;
  if (style === "neutral") {
    [[3.6, 0.5], [2.8, 0.5], [2, 0.5]].forEach(([s, h], i) => sq(`tier-${i}`, 1, 2.5, top + i * 0.5, s, h, i % 2 ? sand : stone4, true));
    const y = top + 1.5;
    sq("shrine", 2, 2.5, y, 1.2, 0.7, lime);
    add("shrine-door", 3, 2.25, 3.1, y, 0.5, 0.02, 0.5, dark4);
    sq("shrine-roof", 2, 2.5, y + 0.7, 1.4, 0.16, team2, true);
    sq("shrine-roof-1", 3, 2.5, y + 0.86, 0.8, 0.16, team2);
    sq("finial", 4, 2.5, y + 1.02, 0.16, 0.4, gilt3);
    for (const [x, z] of [[0.22, 0.22], [4.58, 0.22], [0.22, 4.58], [4.58, 4.58]]) {
      add(`brazier-${x}-${z}`, 3, x, z, 0.4, 0.2, 0.2, 0.26, dark4);
      add(`fire-${x}-${z}`, 4, x + 0.04, z + 0.04, 0.66, 0.12, 0.12, 0.14, "#e0a040");
    }
  } else if (style === "west") {
    add("nave", 1, 1.3, 1, top, 2.4, 2.9, 1.7, sand, true);
    for (const x of [0.9, 3.7]) for (const z of [1.2, 2, 2.8]) add(`buttress-${x}-${z}`, 1, x, z, top, 0.4, 0.3, 1.2, stone4);
    for (let i = 0; i < 3; i++) add(`nave-roof-${i}`, 2, 1.2 + i * 0.35, 0.9, top + 1.7 + i * 0.18, 2.6 - i * 0.7, 3, 0.18, slate, true);
    for (const [i, x] of [1.1, 3.1].entries()) {
      add(`tower-${i}`, 1, x, 3.9, top, 0.8, 0.8, 2.6, stone4, true);
      add(`spire-${i}-0`, 2, x + 0.05, 3.95, top + 2.6, 0.7, 0.7, 0.3, slate);
      add(`spire-${i}-1`, 3, x + 0.17, 4.07, top + 2.9, 0.46, 0.46, 0.5, slate);
      add(`spire-${i}-2`, 3, x + 0.31, 4.21, top + 3.4, 0.18, 0.18, 0.6, slate);
      add(`cross-${i}`, 4, x + 0.36, 4.26, top + 4, 0.08, 0.08, 0.26, gilt3);
    }
    add("facade", 1, 1.9, 3.9, top, 1.2, 0.4, 1.9, sand, true);
    add("portal", 3, 2.15, 4.3, top, 0.7, 0.04, 0.9, dark4, false, "arch");
    add("rose", 3, 2.25, 4.3, top + 1.1, 0.5, 0.04, 0.5, glass);
    add("rose-ring", 3, 2.2, 4.34, top + 1.05, 0.6, 0.02, 0.08, gilt3);
    const cy = top + 1.7 + 3 * 0.18;
    sq("crossing", 3, 2.5, cy, 0.6, 0.5, stone4);
    sq("crossing-spire", 3, 2.5, cy + 0.5, 0.36, 0.5, slate);
    sq("crossing-tip", 4, 2.5, cy + 1, 0.12, 0.36, gilt3);
  } else if (style === "central") {
    sq("hall", 1, 2.5, top, 3, 1.1, carved, true);
    for (const [x, z] of [[0.95, 0.95], [3.75, 0.95], [0.95, 3.75], [3.75, 3.75]]) add(`post-${x}-${z}`, 1, x, z, top, 0.3, 0.3, 1.3, tar);
    [3.6, 2.8, 2.1, 1.4, 0.8].forEach((s, i) => {
      const y = top + 1.1 + i * 0.62;
      sq(`roof-${i}`, 2, 2.5, y, s, 0.16, tar, true);
      if (i < 4) sq(`storey-${i}`, 2, 2.5, y + 0.16, s * 0.62, 0.46, carved);
    });
    [3.6, 2.8, 2.1].forEach((s, i) => {
      for (const j of [-1, 1]) add(`head-${i}-${j}`, 3, 2.5 + j * (s / 2 - 0.2) - 0.1, 2.4, top + 1.1 + i * 0.62 + 0.16, 0.2, 0.2, 0.3, carved);
    });
    sq("spire", 3, 2.5, top + 1.1 + 5 * 0.62 - 0.46, 0.24, 0.7, tar);
    sq("finial", 4, 2.5, top + 1.1 + 5 * 0.62 + 0.24, 0.12, 0.3, gilt3);
    add("door", 3, 2.2, 4, top, 0.6, 0.02, 0.8, dark4, false, "arch");
  } else if (style === "mideast") {
    sq("hall", 1, 2.5, top, 2.8, 1.5, sand, true);
    add("portal-frame", 1, 1.8, 3.9, top, 1.4, 0.3, 1.9, lime, true);
    add("portal", 3, 2.1, 4.2, top, 0.8, 0.02, 1.2, dark4, false, "arch");
    const y = top + 1.5;
    sq("drum", 2, 2.5, y, 1.8, 0.4, lime);
    [1.7, 1.4, 1.05, 0.7, 0.36].forEach((s, i) => sq(`dome-${i}`, 2, 2.5, y + 0.4 + i * 0.22, s, 0.22, i % 2 ? lime : cream, i === 0));
    sq("finial", 4, 2.5, y + 1.5, 0.1, 0.36, gilt3);
    for (const [x, z] of [[0.45, 0.45], [4.15, 0.45], [0.45, 4.15], [4.15, 4.15]]) {
      add(`minaret-${x}-${z}`, 1, x, z, top, 0.4, 0.4, 2.8, lime, true);
      add(`balcony-${x}-${z}`, 3, x - 0.06, z - 0.06, top + 2, 0.52, 0.52, 0.08, sand);
      add(`minaret-cap-${x}-${z}`, 2, x + 0.05, z + 0.05, top + 2.8, 0.3, 0.3, 0.2, cream);
      add(`minaret-tip-${x}-${z}`, 4, x + 0.16, z + 0.16, top + 3, 0.08, 0.08, 0.24, gilt3);
    }
  } else {
    let y = top;
    [2.6, 2.2, 1.8, 1.4, 1].forEach((s, i) => {
      sq(`storey-${i}`, i ? 2 : 1, 2.5, y, s, 0.62, i % 2 ? lime : "#b0574a", true);
      y += 0.62;
      sq(`eave-${i}`, 2, 2.5, y, s + 0.6, 0.12, tile, true);
      for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) add(`tip-${i}-${dx}-${dz}`, 3, 2.5 + dx * (s / 2 + 0.3) - (dx > 0 ? 0.14 : 0), 2.5 + dz * (s / 2 + 0.3) - (dz > 0 ? 0.14 : 0), y + 0.12, 0.14, 0.14, 0.12, tile);
      y += 0.12;
    });
    sq("spire", 3, 2.5, y, 0.2, 0.9, gilt3);
    for (const [i, s] of [0.5, 0.38, 0.26].entries()) sq(`ring-${i}`, 3, 2.5, y + 0.2 + i * 0.22, s, 0.05, gilt3);
    add("door", 3, 2.15, 3.81, top, 0.7, 0.02, 0.5, dark4);
  }
  for (const x of [0.7, 3.9]) {
    add(`banner-pole-${x}`, 3, x, 4.4, 0.4, 0.08, 0.08, 1.6, carved);
    add(`banner-${x}`, 4, x + 0.08, 4.42, 1.2, 0.36, 0.04, 0.7, team2);
  }
  if (v.health === 0) return [p[0], ...Array.from({ length: 16 }, (_, i) => ({ id: `debris-${i}`, phase: 0, x: 0.3 + i % 4 * 1.15, z: 0.3 + Math.floor(i / 4) * 1.15, y: 0.16, w: 0.5, d: 0.42, h: 0.14, color: i % 3 ? stone4 : sand, studs: false }))];
  const lost = /^(banner-.*|finial|cross-\d|crossing-tip|minaret-tip-.*|ring-2|fire-.*|spire-\d-2|rose-ring)$/;
  return p.filter((a) => a.phase <= Math.min(4, Math.floor(v.progress / 20))).filter((a) => v.health >= 50 || !lost.test(a.id));
}

// apps/web/relic-model.ts
var relicParts = [
  { x: -0.17, y: 0, z: -0.13, w: 0.34, d: 0.26, h: 0.08, color: "#6e5438" },
  { x: -0.14, y: 0.08, z: -0.1, w: 0.28, d: 0.2, h: 0.2, color: "#d9bf6f" },
  { x: -0.16, y: 0.28, z: -0.12, w: 0.32, d: 0.24, h: 0.06, color: "#b8964a" },
  { x: -0.03, y: 0.34, z: -0.03, w: 0.06, d: 0.06, h: 0.09, color: "#efe3b8" }
];

// apps/web/tech-icons.ts
var gold2 = "#d9bf6f";
var wood5 = "#8a6a45";
var stone5 = "#cfc7ae";
var habit = "#7a5c40";
var team = "#456e87";
var techIcons = {
  // Redemption: a small house wearing a halo (buildings can change sides).
  redemption: [{ x: 0, y: 0, z: 0, w: 0.8, d: 0.7, h: 0.5, color: stone5 }, { x: -0.05, y: 0.5, z: -0.05, w: 0.9, d: 0.8, h: 0.14, color: team }, { x: 0.2, y: 0.64, z: 0.15, w: 0.5, d: 0.5, h: 0.12, color: team }, { x: 0.3, y: 0.92, z: 0.25, w: 0.3, d: 0.3, h: 0.05, color: gold2 }, { x: 0.3, y: 0, z: 0.62, w: 0.2, d: 0.1, h: 0.3, color: wood5 }],
  // Atonement: a hooded figure under a halo (monks can be converted).
  atonement: [{ x: 0.2, y: 0, z: 0.2, w: 0.4, d: 0.34, h: 0.5, color: habit }, { x: 0.25, y: 0.5, z: 0.24, w: 0.3, d: 0.26, h: 0.24, color: "#dfbb7e" }, { x: 0.2, y: 0.72, z: 0.2, w: 0.4, d: 0.34, h: 0.12, color: habit }, { x: 0.22, y: 0.95, z: 0.22, w: 0.36, d: 0.3, h: 0.05, color: gold2 }],
  // Sanctity: a shield with a green plus (more hit points).
  sanctity: [{ x: 0.1, y: 0, z: 0.3, w: 0.7, d: 0.12, h: 0.8, color: "#9d885b" }, { x: 0.4, y: 0.15, z: 0.42, w: 0.1, d: 0.04, h: 0.5, color: "#5f9a6a" }, { x: 0.22, y: 0.35, z: 0.42, w: 0.46, d: 0.04, h: 0.1, color: "#5f9a6a" }],
  // Heresy: a staff broken in two (a converted unit is lost instead).
  heresy: [{ x: 0.1, y: 0, z: 0.3, w: 0.1, d: 0.1, h: 0.55, color: wood5 }, { x: 0.1, y: 0.55, z: 0.3, w: 0.12, d: 0.12, h: 0.1, color: gold2 }, { x: 0.45, y: 0, z: 0.3, w: 0.55, d: 0.1, h: 0.1, color: wood5 }, { x: 0.35, y: 0, z: 0.28, w: 0.12, d: 0.14, h: 0.06, color: "#6e5438" }],
  // Illumination: a lantern (faith returns faster).
  illumination: [{ x: 0.25, y: 0, z: 0.25, w: 0.4, d: 0.4, h: 0.08, color: wood5 }, { x: 0.3, y: 0.08, z: 0.3, w: 0.3, d: 0.3, h: 0.4, color: "#f5dc7a" }, { x: 0.25, y: 0.48, z: 0.25, w: 0.4, d: 0.4, h: 0.08, color: wood5 }, { x: 0.4, y: 0.56, z: 0.4, w: 0.1, d: 0.1, h: 0.16, color: wood5 }],
  // Block Printing: a stack of printed pages (a longer reach).
  "block-printing": [{ x: 0, y: 0, z: 0.1, w: 0.8, d: 0.6, h: 0.1, color: "#6e5438" }, { x: 0.05, y: 0.1, z: 0.12, w: 0.7, d: 0.55, h: 0.16, color: "#efe6cc" }, { x: 0.05, y: 0.26, z: 0.12, w: 0.7, d: 0.55, h: 0.06, color: "#6e5438" }, { x: 0.15, y: 0.32, z: 0.2, w: 0.5, d: 0.4, h: 0.12, color: "#efe6cc" }],
  // Theocracy: a stepped tower (one monk rests for the group).
  theocracy: [{ x: 0.1, y: 0, z: 0.1, w: 0.6, d: 0.6, h: 0.35, color: stone5 }, { x: 0.2, y: 0.35, z: 0.2, w: 0.4, d: 0.4, h: 0.3, color: stone5 }, { x: 0.28, y: 0.65, z: 0.28, w: 0.24, d: 0.24, h: 0.25, color: team }, { x: 0.35, y: 0.9, z: 0.35, w: 0.1, d: 0.1, h: 0.14, color: gold2 }],
  // Faith: a bell (one's own units hold firm).
  faith: [{ x: 0.1, y: 0.86, z: 0.3, w: 0.6, d: 0.1, h: 0.1, color: wood5 }, { x: 0.2, y: 0.2, z: 0.2, w: 0.4, d: 0.3, h: 0.5, color: "#b8964a" }, { x: 0.12, y: 0.1, z: 0.15, w: 0.56, d: 0.4, h: 0.12, color: "#b8964a" }, { x: 0.35, y: 0.7, z: 0.3, w: 0.1, d: 0.1, h: 0.16, color: wood5 }, { x: 0.36, y: 0, z: 0.3, w: 0.08, d: 0.08, h: 0.1, color: "#6e5438" }],
  // Economic technologies (town centre, lumber camp, mining camp, mill).
  // Loom: a frame with coloured threads (villagers +15 hit points).
  loom: [{ x: 0.05, y: 0, z: 0.3, w: 0.1, d: 0.1, h: 0.8, color: wood5 }, { x: 0.75, y: 0, z: 0.3, w: 0.1, d: 0.1, h: 0.8, color: wood5 }, { x: 0.05, y: 0.72, z: 0.3, w: 0.8, d: 0.1, h: 0.08, color: wood5 }, { x: 0.15, y: 0.15, z: 0.32, w: 0.6, d: 0.06, h: 0.5, color: "#c9b27a" }, { x: 0.2, y: 0.25, z: 0.36, w: 0.5, d: 0.04, h: 0.08, color: team }, { x: 0.2, y: 0.45, z: 0.36, w: 0.5, d: 0.04, h: 0.08, color: "#b25441" }],
  // Wheelbarrow: a tray on one wheel with two handles (villagers carry more).
  wheelbarrow: [{ x: 0.2, y: 0.25, z: 0.2, w: 0.5, d: 0.45, h: 0.25, color: wood5 }, { x: 0.05, y: 0.1, z: 0.3, w: 0.14, d: 0.25, h: 0.14, color: "#5c4a36" }, { x: 0.7, y: 0.3, z: 0.25, w: 0.25, d: 0.06, h: 0.06, color: wood5 }, { x: 0.7, y: 0.3, z: 0.55, w: 0.25, d: 0.06, h: 0.06, color: wood5 }, { x: 0.3, y: 0.5, z: 0.25, w: 0.3, d: 0.35, h: 0.08, color: "#c9b27a" }],
  // Hand Cart: a bigger box on two wheels.
  "hand-cart": [{ x: 0.1, y: 0.25, z: 0.15, w: 0.7, d: 0.6, h: 0.3, color: wood5 }, { x: 0.2, y: 0, z: 0.05, w: 0.25, d: 0.1, h: 0.25, color: "#5c4a36" }, { x: 0.2, y: 0, z: 0.7, w: 0.25, d: 0.1, h: 0.25, color: "#5c4a36" }, { x: 0.2, y: 0.55, z: 0.25, w: 0.5, d: 0.4, h: 0.12, color: "#c9b27a" }, { x: 0.8, y: 0.35, z: 0.4, w: 0.2, d: 0.1, h: 0.06, color: wood5 }],
  // Double-Bit Axe: a handle with a blade on both sides.
  "double-bit-axe": [{ x: 0.4, y: 0, z: 0.4, w: 0.08, d: 0.08, h: 0.85, color: wood5 }, { x: 0.15, y: 0.6, z: 0.38, w: 0.25, d: 0.12, h: 0.22, color: "#aab0a3" }, { x: 0.48, y: 0.6, z: 0.38, w: 0.25, d: 0.12, h: 0.22, color: "#aab0a3" }],
  // Bow Saw: a curved frame with a blade.
  "bow-saw": [{ x: 0.05, y: 0.1, z: 0.4, w: 0.8, d: 0.08, h: 0.05, color: "#c6cfca" }, { x: 0.05, y: 0.1, z: 0.4, w: 0.08, d: 0.08, h: 0.45, color: wood5 }, { x: 0.77, y: 0.1, z: 0.4, w: 0.08, d: 0.08, h: 0.45, color: wood5 }, { x: 0.1, y: 0.52, z: 0.4, w: 0.7, d: 0.08, h: 0.08, color: wood5 }],
  // Two-Man Saw: a long blade with a handle at each end.
  "two-man-saw": [{ x: 0.12, y: 0.3, z: 0.4, w: 0.76, d: 0.06, h: 0.12, color: "#c6cfca" }, { x: 0, y: 0.2, z: 0.38, w: 0.12, d: 0.1, h: 0.35, color: wood5 }, { x: 0.88, y: 0.2, z: 0.38, w: 0.12, d: 0.1, h: 0.35, color: wood5 }],
  // Gold Mining: a pick over a gold nugget; Gold Shaft Mining: a shaft frame over it.
  "gold-mining": [{ x: 0.2, y: 0, z: 0.25, w: 0.5, d: 0.45, h: 0.25, color: "#dec36f" }, { x: 0.42, y: 0.25, z: 0.42, w: 0.07, d: 0.07, h: 0.6, color: wood5 }, { x: 0.2, y: 0.8, z: 0.42, w: 0.5, d: 0.07, h: 0.07, color: "#aab0a3" }],
  "gold-shaft-mining": [{ x: 0.2, y: 0, z: 0.25, w: 0.5, d: 0.45, h: 0.25, color: "#dec36f" }, { x: 0.1, y: 0, z: 0.15, w: 0.08, d: 0.08, h: 0.85, color: wood5 }, { x: 0.72, y: 0, z: 0.15, w: 0.08, d: 0.08, h: 0.85, color: wood5 }, { x: 0.1, y: 0.85, z: 0.15, w: 0.7, d: 0.08, h: 0.08, color: wood5 }, { x: 0.42, y: 0.4, z: 0.18, w: 0.04, d: 0.04, h: 0.45, color: "#80674f" }],
  // Stone Mining and Stone Shaft Mining: the same with a stone block.
  "stone-mining": [{ x: 0.2, y: 0, z: 0.25, w: 0.5, d: 0.45, h: 0.25, color: stone5 }, { x: 0.42, y: 0.25, z: 0.42, w: 0.07, d: 0.07, h: 0.6, color: wood5 }, { x: 0.2, y: 0.8, z: 0.42, w: 0.5, d: 0.07, h: 0.07, color: "#aab0a3" }],
  "stone-shaft-mining": [{ x: 0.2, y: 0, z: 0.25, w: 0.5, d: 0.45, h: 0.25, color: stone5 }, { x: 0.1, y: 0, z: 0.15, w: 0.08, d: 0.08, h: 0.85, color: wood5 }, { x: 0.72, y: 0, z: 0.15, w: 0.08, d: 0.08, h: 0.85, color: wood5 }, { x: 0.1, y: 0.85, z: 0.15, w: 0.7, d: 0.08, h: 0.08, color: wood5 }, { x: 0.42, y: 0.4, z: 0.18, w: 0.04, d: 0.04, h: 0.45, color: "#80674f" }],
  // Horse Collar: a padded U; Heavy Plow: a plough blade on a beam; Crop Rotation: three fields of different crops.
  "horse-collar": [{ x: 0.15, y: 0, z: 0.4, w: 0.14, d: 0.14, h: 0.7, color: "#7a5c40" }, { x: 0.61, y: 0, z: 0.4, w: 0.14, d: 0.14, h: 0.7, color: "#7a5c40" }, { x: 0.15, y: 0.6, z: 0.4, w: 0.6, d: 0.14, h: 0.16, color: "#7a5c40" }, { x: 0.25, y: 0.1, z: 0.42, w: 0.4, d: 0.1, h: 0.08, color: gold2 }],
  "heavy-plow": [{ x: 0.05, y: 0.35, z: 0.4, w: 0.8, d: 0.1, h: 0.1, color: wood5 }, { x: 0.6, y: 0, z: 0.35, w: 0.25, d: 0.2, h: 0.35, color: "#aab0a3" }, { x: 0.05, y: 0.45, z: 0.4, w: 0.08, d: 0.1, h: 0.3, color: wood5 }],
  "crop-rotation": [{ x: 0, y: 0, z: 0.05, w: 0.9, d: 0.25, h: 0.12, color: "#9bb65a" }, { x: 0, y: 0, z: 0.33, w: 0.9, d: 0.25, h: 0.12, color: "#d9c26a" }, { x: 0, y: 0, z: 0.61, w: 0.9, d: 0.25, h: 0.12, color: "#806b49" }, { x: 0.1, y: 0.12, z: 0.1, w: 0.7, d: 0.15, h: 0.1, color: "#7e985f" }]
};
var metal2 = ["#9a8c78", "#aab0a3", "#d8dcd6"];
var band = (level) => Array.from({ length: level }, (_, i) => ({ x: 0.15 + i * 0.25, y: 0, z: 0.75, w: 0.18, d: 0.1, h: 0.08, color: gold2 }));
var hammer = (l) => [{ x: 0.42, y: 0.1, z: 0.4, w: 0.08, d: 0.08, h: 0.75, color: wood5 }, { x: 0.25, y: 0.7, z: 0.34, w: 0.42, d: 0.2, h: 0.18, color: metal2[l - 1] }, ...band(l)];
var mail = (l) => [{ x: 0.2, y: 0.1, z: 0.35, w: 0.5, d: 0.2, h: 0.55, color: metal2[l - 1] }, { x: 0.1, y: 0.5, z: 0.35, w: 0.7, d: 0.2, h: 0.15, color: metal2[l - 1] }, { x: 0.35, y: 0.65, z: 0.35, w: 0.2, d: 0.2, h: 0.1, color: "#6e5438" }, ...band(l)];
var barding = (l) => [{ x: 0.1, y: 0.15, z: 0.35, w: 0.7, d: 0.3, h: 0.3, color: metal2[l - 1] }, { x: 0.65, y: 0.35, z: 0.35, w: 0.2, d: 0.3, h: 0.35, color: metal2[l - 1] }, { x: 0.12, y: 0.45, z: 0.38, w: 0.5, d: 0.24, h: 0.08, color: team }, ...band(l)];
var arrows = (l) => [...[0, 1, 2].map((i) => ({ x: 0.2 + i * 0.2, y: 0.1, z: 0.4, w: 0.05, d: 0.05, h: 0.65, color: wood5 })), ...[0, 1, 2].map((i) => ({ x: 0.17 + i * 0.2, y: 0.75, z: 0.37, w: 0.11, d: 0.11, h: 0.12, color: metal2[l - 1] })), ...band(l)];
var vest = (l) => [{ x: 0.2, y: 0.1, z: 0.35, w: 0.5, d: 0.2, h: 0.5, color: ["#b89a6a", "#8a6a45", "#aab0a3"][l - 1] }, { x: 0.25, y: 0.2, z: 0.33, w: 0.4, d: 0.04, h: 0.06, color: "#6e5438" }, { x: 0.25, y: 0.4, z: 0.33, w: 0.4, d: 0.04, h: 0.06, color: "#6e5438" }, ...band(l)];
for (const [line2, make] of [[["forging", "iron-casting", "blast-furnace"], hammer], [["scale-mail-armor", "chain-mail-armor", "plate-mail-armor"], mail], [["scale-barding-armor", "chain-barding-armor", "plate-barding-armor"], barding], [["fletching", "bodkin-arrow", "bracer"], arrows], [["padded-archer-armor", "leather-archer-armor", "ring-archer-armor"], vest]])
  line2.forEach((id, i) => {
    techIcons[id] = make(i + 1);
  });
var metal22 = "#aab0a3";
var dark5 = "#4a4740";
var green = "#5f9a6a";
var grey = "#8d8c86";
var felt = "#ece6d6";
var sand2 = "#d8c9a6";
var red = "#b25441";
var plus = (x, y) => [{ x: x + 0.09, y, z: 0.42, w: 0.08, d: 0.04, h: 0.26, color: green }, { x, y: y + 0.09, z: 0.42, w: 0.26, d: 0.04, h: 0.08, color: green }];
var streaks = (x, y) => [0, 1, 2].map((i) => ({ x: x - i * 0.04, y: y + i * 0.14, z: 0.45, w: 0.18 + i * 0.06, d: 0.04, h: 0.05, color: "#efe6cc" }));
var shaft = (x, y, len) => [{ x, y, z: 0.45, w: len, d: 0.04, h: 0.04, color: wood5 }, { x: x + len, y: y - 0.02, z: 0.44, w: 0.08, d: 0.06, h: 0.08, color: metal22 }];
var merlons = (x, y, n, w = 0.14) => Array.from({ length: n }, (_, i) => ({ x: x + i * w * 2, y, z: 0.3, w, d: 0.36, h: 0.12, color: stone5 }));
Object.assign(techIcons, {
  // Yeomen: a tall longbow beside a tower top (archer range and tower attack).
  yeomen: [{ x: 0, y: 0, z: 0.3, w: 0.45, d: 0.4, h: 0.6, color: stone5 }, ...merlons(0, 0.6, 2, 0.12), ...[[0, 0], [0.06, 0.18], [0.09, 0.36], [0.06, 0.54], [0, 0.72]].map(([dx, y]) => ({ x: 0.7 + dx, y, z: 0.4, w: 0.06, d: 0.06, h: 0.2, color: wood5 })), { x: 0.66, y: 0, z: 0.42, w: 0.02, d: 0.02, h: 0.92, color: "#d9cba4" }],
  // Stronghold: a castle tower loosing arrows in quick succession.
  stronghold: [{ x: 0, y: 0, z: 0.25, w: 0.5, d: 0.5, h: 0.75, color: stone5 }, ...merlons(0, 0.75, 2), { x: 0.18, y: 0.35, z: 0.74, w: 0.12, d: 0.02, h: 0.2, color: dark5 }, ...shaft(0.55, 0.62, 0.3), ...shaft(0.55, 0.42, 0.3), ...shaft(0.55, 0.22, 0.3)],
  // Furor Celtica: a ram on its wheels under a green plus (siege hit points).
  "furor-celtica": [{ x: 0, y: 0.12, z: 0.3, w: 0.9, d: 0.3, h: 0.18, color: wood5 }, { x: 0.1, y: 0, z: 0.25, w: 0.18, d: 0.4, h: 0.18, color: "#5c4a36" }, { x: 0.62, y: 0, z: 0.25, w: 0.18, d: 0.4, h: 0.18, color: "#5c4a36" }, { x: 0.85, y: 0.12, z: 0.32, w: 0.12, d: 0.26, h: 0.18, color: metal22 }, ...plus(0.32, 0.45)],
  // Chivalry: a horseshoe with gold nails and speed streaks (faster stable).
  chivalry: [{ x: 0.1, y: 0, z: 0.1, w: 0.16, d: 0.7, h: 0.14, color: metal22 }, { x: 0.64, y: 0, z: 0.1, w: 0.16, d: 0.7, h: 0.14, color: metal22 }, { x: 0.1, y: 0, z: 0.1, w: 0.7, d: 0.16, h: 0.14, color: metal22 }, ...[0.14, 0.68].flatMap((x) => [0.35, 0.6].map((z) => ({ x: x + 0.04, y: 0.14, z, w: 0.06, d: 0.06, h: 0.04, color: gold2 }))), ...streaks(0.2, 0.3).map((p) => ({ ...p, y: 0, z: 0.85 + (p.y - 0.3) / 0.7, h: 0.04 }))],
  // Bearded Axe: the francisca in flight, its path drawn out behind it (longer throw).
  "bearded-axe": [{ x: 0.52, y: 0, z: 0.42, w: 0.08, d: 0.08, h: 0.8, color: wood5 }, { x: 0.6, y: 0.56, z: 0.41, w: 0.3, d: 0.1, h: 0.2, color: metal22 }, { x: 0.74, y: 0.38, z: 0.41, w: 0.16, d: 0.1, h: 0.2, color: metal22 }, { x: 0.44, y: 0.64, z: 0.41, w: 0.08, d: 0.1, h: 0.1, color: metal22 }, ...[0, 1, 2].map((i) => ({ x: 0.02 + i * 0.14, y: 0.3 + i * 0.12, z: 0.44, w: 0.1, d: 0.04, h: 0.05, color: "#efe6cc" }))],
  // Anarchy: a barracks arch with a Huskarl's round shield in the doorway.
  anarchy: [{ x: 0, y: 0, z: 0.2, w: 0.18, d: 0.4, h: 0.7, color: stone5 }, { x: 0.72, y: 0, z: 0.2, w: 0.18, d: 0.4, h: 0.7, color: stone5 }, { x: 0, y: 0.7, z: 0.2, w: 0.9, d: 0.4, h: 0.16, color: red }, { x: 0.27, y: 0.08, z: 0.52, w: 0.36, d: 0.05, h: 0.5, color: team }, { x: 0.2, y: 0.15, z: 0.52, w: 0.5, d: 0.05, h: 0.36, color: team }, { x: 0.4, y: 0.28, z: 0.57, w: 0.1, d: 0.03, h: 0.1, color: gold2 }],
  // Perfusion: two helmets side by side (twice the training speed).
  perfusion: [0, 0.46].flatMap((x) => [{ x: x + 0.06, y: 0, z: 0.35, w: 0.26, d: 0.2, h: 0.2, color: "#44514b" }, { x: x + 0.02, y: 0.2, z: 0.33, w: 0.34, d: 0.24, h: 0.3, color: team }, { x: x + 0.07, y: 0.5, z: 0.35, w: 0.24, d: 0.2, h: 0.2, color: "#dfbb7e" }, { x: x + 0.04, y: 0.7, z: 0.33, w: 0.3, d: 0.24, h: 0.08, color: metal22 }, { x: x + 0.36, y: 0.1, z: 0.42, w: 0.04, d: 0.04, h: 0.66, color: wood5 }]),
  // Ironclad: a ram under riveted iron plates (siege melee armour).
  ironclad: [{ x: 0, y: 0, z: 0.3, w: 0.9, d: 0.3, h: 0.2, color: wood5 }, { x: 0.05, y: 0.2, z: 0.25, w: 0.8, d: 0.4, h: 0.14, color: metal22 }, { x: 0.15, y: 0.34, z: 0.3, w: 0.6, d: 0.3, h: 0.14, color: "#8f9896" }, ...[0.15, 0.4, 0.65].map((x) => ({ x, y: 0.24, z: 0.65, w: 0.06, d: 0.02, h: 0.06, color: gold2 }))],
  // Crenellations: a crenellated wall with a helmeted defender between the merlons.
  crenellations: [{ x: 0, y: 0, z: 0.3, w: 0.9, d: 0.36, h: 0.45, color: stone5 }, { x: 0, y: 0.45, z: 0.3, w: 0.16, d: 0.36, h: 0.2, color: stone5 }, { x: 0.74, y: 0.45, z: 0.3, w: 0.16, d: 0.36, h: 0.2, color: stone5 }, { x: 0.34, y: 0.45, z: 0.38, w: 0.22, d: 0.2, h: 0.16, color: "#dfbb7e" }, { x: 0.32, y: 0.61, z: 0.36, w: 0.26, d: 0.24, h: 0.1, color: metal22 }, ...shaft(0.55, 0.72, 0.3)],
  // Chieftains: a helmet crowned with a gold circlet over a spear (infantry against horsemen).
  chieftains: [{ x: 0.1, y: 0.05, z: 0.44, w: 0.8, d: 0.04, h: 0.04, color: wood5 }, { x: 0.86, y: 0.03, z: 0.43, w: 0.12, d: 0.06, h: 0.08, color: metal22 }, { x: 0.25, y: 0.2, z: 0.3, w: 0.4, d: 0.38, h: 0.3, color: metal22 }, { x: 0.23, y: 0.42, z: 0.28, w: 0.44, d: 0.42, h: 0.06, color: gold2 }, ...[0.25, 0.43, 0.61].map((x) => ({ x, y: 0.48, z: 0.45, w: 0.04, d: 0.04, h: 0.12, color: gold2 }))],
  // Berserkergang: a wolf-pelt hood with a green plus (faster regeneration).
  berserkergang: [{ x: 0.1, y: 0, z: 0.3, w: 0.5, d: 0.4, h: 0.45, color: "#8a8272" }, { x: 0.2, y: 0.2, z: 0.7, w: 0.3, d: 0.1, h: 0.15, color: "#8a8272" }, { x: 0.12, y: 0.45, z: 0.35, w: 0.1, d: 0.1, h: 0.14, color: "#8a8272" }, { x: 0.48, y: 0.45, z: 0.35, w: 0.1, d: 0.1, h: 0.14, color: "#8a8272" }, { x: 0.22, y: 0.3, z: 0.7, w: 0.06, d: 0.02, h: 0.04, color: dark5 }, { x: 0.42, y: 0.3, z: 0.7, w: 0.06, d: 0.02, h: 0.04, color: dark5 }, ...plus(0.64, 0.5)],
  // Logistica: a hoof over scattered bricks (trample damage around the target).
  logistica: [{ x: 0.3, y: 0.18, z: 0.3, w: 0.3, d: 0.3, h: 0.5, color: "#6f5a44" }, { x: 0.26, y: 0.1, z: 0.26, w: 0.38, d: 0.38, h: 0.1, color: metal22 }, ...[[0, 0], [0.75, 0.05], [0.05, 0.6], [0.72, 0.62]].map(([x, z]) => ({ x, y: 0, z, w: 0.16, d: 0.14, h: 0.1, color: stone5 }))],
  // Kamandaran: a bow over a stack of logs (archers paid in wood).
  kamandaran: [...[0, 1, 2].map((i) => ({ x: 0.05, y: i * 0.14, z: 0.3 + i % 2 * 0.04, w: 0.8, d: 0.14, h: 0.14, color: i === 1 ? "#6e5438" : wood5 })), ...[[0, 0], [0.05, 0.14], [0.07, 0.28], [0.05, 0.42], [0, 0.56]].map(([dx, y]) => ({ x: 0.4 + dx, y: 0.42 + y * 0.6, z: 0.5, w: 0.06, d: 0.06, h: 0.14, color: "#997447" })), { x: 0.38, y: 0.42, z: 0.52, w: 0.02, d: 0.02, h: 0.46, color: "#d9cba4" }],
  // Mahouts: an elephant's head with tusks and speed streaks.
  mahouts: [{ x: 0.25, y: 0.3, z: 0.25, w: 0.5, d: 0.45, h: 0.5, color: grey }, { x: 0.05, y: 0.35, z: 0.35, w: 0.2, d: 0.08, h: 0.45, color: "#9a988f" }, { x: 0.75, y: 0.35, z: 0.35, w: 0.2, d: 0.08, h: 0.45, color: "#9a988f" }, { x: 0.28, y: 0.8, z: 0.3, w: 0.44, d: 0.36, h: 0.08, color: gold2 }, { x: 0.42, y: 0.12, z: 0.7, w: 0.16, d: 0.14, h: 0.4, color: grey }, { x: 0.43, y: 0, z: 0.78, w: 0.14, d: 0.18, h: 0.12, color: grey }, { x: 0.28, y: 0.3, z: 0.7, w: 0.07, d: 0.24, h: 0.07, color: "#efe8d2" }, { x: 0.65, y: 0.3, z: 0.7, w: 0.07, d: 0.24, h: 0.07, color: "#efe8d2" }, ...streaks(0.08, 0.4).map((p) => ({ ...p, z: 0.05 }))],
  // Madrasah: a domed hall over a gold coin (gold back when a monk falls).
  madrasah: [{ x: 0.05, y: 0, z: 0.25, w: 0.6, d: 0.5, h: 0.35, color: sand2 }, { x: 0.1, y: 0.35, z: 0.3, w: 0.5, d: 0.4, h: 0.12, color: felt }, { x: 0.18, y: 0.47, z: 0.36, w: 0.34, d: 0.28, h: 0.1, color: felt }, { x: 0.28, y: 0.57, z: 0.42, w: 0.14, d: 0.14, h: 0.08, color: felt }, { x: 0.33, y: 0.65, z: 0.47, w: 0.04, d: 0.04, h: 0.12, color: gold2 }, { x: 0.68, y: 0, z: 0.4, w: 0.26, d: 0.26, h: 0.08, color: gold2 }, { x: 0.72, y: 0.08, z: 0.44, w: 0.18, d: 0.18, h: 0.06, color: "#dec36f" }],
  // Zealotry: a camel with a green plus (camel and Mameluke hit points).
  zealotry: [{ x: 0.1, y: 0.3, z: 0.35, w: 0.6, d: 0.3, h: 0.25, color: sand2 }, { x: 0.3, y: 0.55, z: 0.38, w: 0.2, d: 0.24, h: 0.14, color: sand2 }, { x: 0.66, y: 0.4, z: 0.4, w: 0.1, d: 0.2, h: 0.4, color: sand2 }, { x: 0.66, y: 0.8, z: 0.38, w: 0.22, d: 0.24, h: 0.1, color: sand2 }, ...[0.14, 0.56].map((x) => ({ x, y: 0, z: 0.4, w: 0.08, d: 0.12, h: 0.3, color: "#b8a074" })), { x: 0.14, y: 0.52, z: 0.33, w: 0.52, d: 0.34, h: 0.04, color: team }, ...plus(0, 0.62)],
  // Great Wall: a long crenellated wall climbing to a watch tower (tougher walls and towers).
  "great-wall": [{ x: 0, y: 0, z: 0.35, w: 0.62, d: 0.28, h: 0.3, color: stone5 }, ...merlons(0, 0.3, 3, 0.11), { x: 0.62, y: 0, z: 0.28, w: 0.34, d: 0.42, h: 0.7, color: stone5 }, { x: 0.58, y: 0.7, z: 0.24, w: 0.42, d: 0.5, h: 0.1, color: "#3f4a4c" }, { x: 0.7, y: 0.8, z: 0.36, w: 0.18, d: 0.26, h: 0.1, color: "#3f4a4c" }],
  // Rocketry: a bolt carrying a red powder tube with flame at its tail.
  rocketry: [{ x: 0.05, y: 0.4, z: 0.45, w: 0.8, d: 0.05, h: 0.05, color: wood5 }, { x: 0.85, y: 0.38, z: 0.43, w: 0.1, d: 0.09, h: 0.09, color: metal22 }, { x: 0.3, y: 0.36, z: 0.41, w: 0.3, d: 0.13, h: 0.13, color: red }, { x: 0.1, y: 0.37, z: 0.42, w: 0.2, d: 0.11, h: 0.11, color: "#e0a040" }, { x: 0, y: 0.39, z: 0.44, w: 0.1, d: 0.07, h: 0.07, color: "#f5dc7a" }],
  // Yasama: a watch tower with three arrows fanning out (extra arrows).
  yasama: [{ x: 0, y: 0, z: 0.3, w: 0.4, d: 0.4, h: 0.7, color: stone5 }, { x: -0.04, y: 0.7, z: 0.26, w: 0.48, d: 0.48, h: 0.1, color: "#3f4a4c" }, ...shaft(0.45, 0.75, 0.35), ...shaft(0.45, 0.5, 0.35), ...shaft(0.45, 0.25, 0.35)],
  // Nomads: a round felt yurt with a team band (houses keep their population room).
  nomads: [{ x: 0.1, y: 0, z: 0.2, w: 0.7, d: 0.6, h: 0.35, color: felt }, { x: 0.05, y: 0.25, z: 0.15, w: 0.8, d: 0.7, h: 0.06, color: team }, { x: 0.18, y: 0.35, z: 0.28, w: 0.54, d: 0.44, h: 0.12, color: felt }, { x: 0.32, y: 0.47, z: 0.4, w: 0.26, d: 0.2, h: 0.08, color: felt }, { x: 0.38, y: 0, z: 0.8, w: 0.14, d: 0.02, h: 0.22, color: "#6e5438" }],
  // Drill: a siege wheel with speed streaks (faster siege).
  drill: [{ x: 0.2, y: 0, z: 0.4, w: 0.5, d: 0.12, h: 0.5, color: "#6e5438" }, { x: 0.35, y: 0.15, z: 0.52, w: 0.2, d: 0.04, h: 0.2, color: gold2 }, { x: 0.12, y: 0.5, z: 0.35, w: 0.66, d: 0.2, h: 0.1, color: wood5 }, ...streaks(0.84, 0.05)],
  // Warwolf: a trebuchet (frame, counterweight, arm with its stone) and the stone landing among scattered enemy helmets
  // (the shot hits everyone around the impact).
  warwolf: [
    { x: 0.08, y: 0, z: 0.3, w: 0.08, d: 0.3, h: 0.55, color: wood5 },
    { x: 0.3, y: 0, z: 0.3, w: 0.08, d: 0.3, h: 0.55, color: wood5 },
    { x: 0.04, y: 0.55, z: 0.3, w: 0.38, d: 0.3, h: 0.07, color: wood5 },
    ...[[0, 0.4], [0.09, 0.5], [0.18, 0.6], [0.27, 0.7], [0.36, 0.8]].map(([x, y]) => ({ x, y, z: 0.42, w: 0.1, d: 0.08, h: 0.1, color: "#8a6a45" })),
    { x: -0.06, y: 0.22, z: 0.36, w: 0.16, d: 0.2, h: 0.18, color: dark5 },
    { x: 0.42, y: 0.9, z: 0.4, w: 0.1, d: 0.1, h: 0.1, color: stone5 },
    { x: 0.66, y: 0, z: 0.35, w: 0.22, d: 0.22, h: 0.2, color: "#a19f86" },
    ...[[0.54, 0.2], [0.96, 0.25], [0.64, 0.68], [0.9, 0.66]].map(([x, z]) => ({ x: x - 0.05, y: 0, z, w: 0.12, d: 0.12, h: 0.1, color: metal22 })),
    { x: 0.6, y: 0, z: 0.6, w: 0.34, d: 0.04, h: 0.04, color: red }
  ],
  // Kataparuto: a packed trebuchet on its wagon with speed streaks (it packs, unpacks and fires faster).
  kataparuto: [{ x: 0.05, y: 0.14, z: 0.3, w: 0.8, d: 0.36, h: 0.1, color: wood5 }, ...[0.12, 0.64].map((x) => ({ x, y: 0, z: 0.25, w: 0.16, d: 0.46, h: 0.16, color: "#5c4a36" })), { x: 0.1, y: 0.24, z: 0.42, w: 0.75, d: 0.1, h: 0.1, color: "#8a6a45" }, { x: 0.55, y: 0.24, z: 0.32, w: 0.24, d: 0.3, h: 0.22, color: team }, { x: 0.6, y: 0.46, z: 0.37, w: 0.14, d: 0.2, h: 0.06, color: metal22 }, ...streaks(0.14, 0.5)],
  // Sipahi: a horse archer (dark horse, team-clad rider, bow raised) with a green plus (cavalry archers gain hit points).
  sipahi: [
    { x: 0.1, y: 0.3, z: 0.3, w: 0.5, d: 0.26, h: 0.24, color: "#4a413a" },
    { x: 0.56, y: 0.42, z: 0.33, w: 0.12, d: 0.2, h: 0.28, color: "#4a413a" },
    { x: 0.58, y: 0.66, z: 0.32, w: 0.26, d: 0.22, h: 0.12, color: "#574a3f" },
    { x: 0.02, y: 0.36, z: 0.4, w: 0.08, d: 0.06, h: 0.2, color: "#1f1b18" },
    ...[0.12, 0.48].flatMap((x) => [0.3, 0.48].map((z) => ({ x, y: 0, z, w: 0.08, d: 0.08, h: 0.3, color: "#3d3631" }))),
    { x: 0.22, y: 0.54, z: 0.31, w: 0.22, d: 0.3, h: 0.05, color: "#6b5238" },
    { x: 0.25, y: 0.59, z: 0.34, w: 0.16, d: 0.2, h: 0.24, color: team },
    { x: 0.26, y: 0.83, z: 0.36, w: 0.14, d: 0.16, h: 0.14, color: "#dfbb7e" },
    { x: 0.25, y: 0.97, z: 0.35, w: 0.16, d: 0.18, h: 0.06, color: "#6b5238" },
    ...[[0, 0], [0.04, 0.12], [0.06, 0.24], [0.04, 0.36], [0, 0.48]].map(([dx, y]) => ({ x: 0.44 + dx, y: 0.52 + y * 0.8, z: 0.5, w: 0.05, d: 0.05, h: 0.1, color: "#997447" })),
    { x: 0.43, y: 0.52, z: 0.52, w: 0.02, d: 0.02, h: 0.48, color: "#d9cba4" },
    ...plus(0.78, 0.04)
  ]
});
var skin = "#dfbb7e";
var flame3 = "#e0a040";
var spark3 = "#f5dc7a";
var glass2 = "#bcd3cf";
var leaf = "#6f8a55";
var hay = "#d9c26a";
var iron5 = "#5b5e5c";
var bar = (x, y, w, h, color, z = 0.4, d = 0.1) => ({ x, y, z, w, d, h, color });
var backShaft = (x, y, len) => [{ x: x + 0.08, y, z: 0.45, w: len, d: 0.04, h: 0.04, color: wood5 }, { x, y: y - 0.02, z: 0.44, w: 0.08, d: 0.06, h: 0.08, color: metal22 }];
var eye = (y) => [bar(0.2, y, 0.5, 0.08, "#efe9da"), bar(0.08, y + 0.08, 0.74, 0.16, "#efe9da"), bar(0.2, y + 0.24, 0.5, 0.08, "#efe9da"), bar(0.34, y + 0.06, 0.22, 0.22, team, 0.45, 0.06), bar(0.41, y + 0.13, 0.08, 0.08, "#1f1d1b", 0.5, 0.02)];
Object.assign(techIcons, {
  // Masonry: three courses of bonded bricks with a trowel on top (building hit points and armour).
  masonry: [
    bar(0.05, 0, 0.42, 0.2, stone5),
    bar(0.48, 0, 0.42, 0.2, stone5),
    bar(0.05, 0.2, 0.2, 0.2, stone5),
    bar(0.26, 0.2, 0.42, 0.2, stone5),
    bar(0.69, 0.2, 0.21, 0.2, stone5),
    bar(0.05, 0.4, 0.42, 0.2, stone5),
    bar(0.48, 0.4, 0.42, 0.2, stone5),
    bar(0.3, 0.6, 0.34, 0.04, metal22, 0.35, 0.3),
    bar(0.64, 0.6, 0.06, 0.1, wood5),
    bar(0.7, 0.68, 0.2, 0.05, wood5)
  ],
  // Architecture: two columns under a lintel with a gilt keystone (buildings stronger again).
  architecture: [bar(0.02, 0, 0.86, 0.08, stone5), ...[0.1, 0.62].flatMap((x) => [bar(x, 0.08, 0.18, 0.06, stone5), bar(x + 0.03, 0.14, 0.12, 0.5, "#e6dcc3"), bar(x - 0.02, 0.64, 0.22, 0.08, stone5)]), bar(0, 0.72, 0.9, 0.12, stone5), bar(0.37, 0.72, 0.16, 0.2, gold2, 0.38, 0.14)],
  // Chemistry: a flask of green liquid over a small flame (gunpowder; missiles +1).
  chemistry: [bar(0.34, 0, 0.22, 0.1, flame3), bar(0.4, 0.1, 0.1, 0.08, spark3), bar(0.15, 0.18, 0.6, 0.12, glass2), bar(0.1, 0.3, 0.7, 0.22, glass2), bar(0.13, 0.32, 0.64, 0.14, green, 0.45, 0.06), bar(0.2, 0.52, 0.5, 0.1, glass2), bar(0.38, 0.62, 0.14, 0.22, glass2), bar(0.36, 0.84, 0.18, 0.08, wood5)],
  // Siege Engineers: a pair of dividers standing open with a long range arrow (siege range and building damage).
  "siege-engineers": [bar(0.08, 0, 0.08, 0.1, metal22), bar(0.12, 0.1, 0.08, 0.2, metal22), bar(0.16, 0.3, 0.08, 0.2, metal22), bar(0.48, 0, 0.08, 0.1, metal22), bar(0.44, 0.1, 0.08, 0.2, metal22), bar(0.4, 0.3, 0.08, 0.2, metal22), bar(0.2, 0.5, 0.24, 0.1, metal22), bar(0.27, 0.6, 0.1, 0.1, gold2), ...shaft(0.05, 0.82, 0.8)],
  // Guard Tower: a stone tower with a merloned lookout and a green plus (stronger towers).
  "guard-tower": [bar(0.08, 0, 0.36, 0.7, stone5, 0.3, 0.36), bar(0.02, 0.7, 0.48, 0.1, stone5, 0.24, 0.48), ...merlons(0.02, 0.8, 2, 0.12), bar(0.22, 0.2, 0.08, 0.02, dark5, 0.66, 0.02), ...plus(0.62, 0.3)],
  // Keep: a taller, wider tower on corbels under a team spire (towers stronger again).
  keep: [bar(0.22, 0, 0.46, 0.66, stone5, 0.28, 0.4), ...[0.18, 0.62].map((x) => bar(x, 0.66, 0.1, 0.08, "#9d9a88", 0.26, 0.44)), bar(0.14, 0.74, 0.62, 0.12, stone5, 0.22, 0.52), bar(0.2, 0.86, 0.5, 0.1, team, 0.26, 0.44), bar(0.3, 0.96, 0.3, 0.1, team, 0.33, 0.3), bar(0.4, 1.06, 0.1, 0.12, gold2, 0.38, 0.1), bar(0.4, 0.3, 0.08, 0.2, dark5, 0.68, 0.02)],
  // Treadmill Crane: an octagonal treadwheel under a jib lifting a stone (villagers build faster).
  "treadmill-crane": [
    bar(0.18, 0, 0.3, 0.08, wood5),
    bar(0.08, 0.06, 0.12, 0.14, wood5),
    bar(0.46, 0.06, 0.12, 0.14, wood5),
    bar(0.02, 0.18, 0.1, 0.3, wood5),
    bar(0.56, 0.18, 0.1, 0.3, wood5),
    bar(0.08, 0.46, 0.12, 0.14, wood5),
    bar(0.46, 0.46, 0.12, 0.14, wood5),
    bar(0.18, 0.56, 0.3, 0.08, wood5),
    bar(0.3, 0.08, 0.06, 0.48, dark5, 0.42, 0.06),
    bar(0.7, 0, 0.08, 0.9, "#6e5438"),
    bar(0.4, 0.9, 0.62, 0.07, "#6e5438"),
    bar(0.94, 0.6, 0.02, 0.3, "#d8c48a"),
    bar(0.86, 0.42, 0.18, 0.18, "#b5b29e")
  ],
  // Arrowslits: a stretch of wall pierced by two cross-shaped slits, an arrow leaving one (tower attack).
  arrowslits: [bar(0, 0, 0.6, 0.8, stone5, 0.3, 0.3), ...[0.14, 0.38].flatMap((x) => [bar(x, 0.18, 0.06, 0.44, dark5, 0.6, 0.02), bar(x - 0.06, 0.36, 0.18, 0.06, dark5, 0.6, 0.02)]), ...shaft(0.5, 0.39, 0.42)],
  // Supplies: a grain sack beside a militia helmet (cheaper militia line).
  supplies: [bar(0.05, 0, 0.46, 0.5, hay, 0.3, 0.36), bar(0.12, 0.5, 0.32, 0.1, hay, 0.34, 0.28), bar(0.18, 0.6, 0.2, 0.06, "#7a5c40", 0.38, 0.2), bar(0.14, 0.66, 0.28, 0.12, hay, 0.36, 0.24), bar(0.58, 0, 0.36, 0.16, metal22, 0.32, 0.32), bar(0.62, 0.16, 0.28, 0.14, metal22, 0.34, 0.28), bar(0.72, 0.3, 0.08, 0.06, metal22, 0.42, 0.1)],
  // Squires: a marching boot with speed streaks (infantry move faster).
  squires: [bar(0.32, 0, 0.5, 0.12, "#5a4632", 0.32, 0.3), bar(0.32, 0.12, 0.2, 0.5, "#5a4632", 0.32, 0.3), bar(0.3, 0.62, 0.24, 0.08, "#8b6746", 0.3, 0.34), bar(0.52, 0.12, 0.16, 0.1, "#5a4632", 0.32, 0.3), ...streaks(0.12, 0.2)],
  // Arson: a lit torch leaning on a burning house corner (infantry against buildings).
  arson: [
    bar(0.4, 0, 0.5, 0.45, stone5, 0.3, 0.4),
    bar(0.36, 0.45, 0.58, 0.12, "#b8a074", 0.26, 0.48),
    bar(0.5, 0.57, 0.3, 0.12, "#b8a074", 0.34, 0.32),
    bar(0.6, 0.6, 0.16, 0.2, flame3, 0.36, 0.16),
    bar(0.64, 0.8, 0.08, 0.12, spark3, 0.4, 0.08),
    bar(0.12, 0, 0.08, 0.6, wood5, 0.5, 0.08),
    bar(0.08, 0.6, 0.16, 0.14, flame3, 0.48, 0.12),
    bar(0.11, 0.74, 0.1, 0.12, spark3, 0.5, 0.08)
  ],
  // Thumb Ring: a gilt ring on a drawing thumb with speed streaks (archers shoot faster).
  "thumb-ring": [bar(0.42, 0, 0.26, 0.24, skin, 0.3, 0.3), bar(0.46, 0.24, 0.18, 0.5, skin, 0.36, 0.18), bar(0.42, 0.42, 0.26, 0.04, gold2, 0.32, 0.26), bar(0.42, 0.52, 0.26, 0.04, gold2, 0.32, 0.26), bar(0.42, 0.42, 0.04, 0.14, gold2, 0.32, 0.26), bar(0.64, 0.42, 0.04, 0.14, gold2, 0.32, 0.26), ...streaks(0.16, 0.3)],
  // Parthian Tactics: a horse archer riding right and loosing an arrow back over the tail (cavalry archer armour and bonus).
  "parthian-tactics": [
    bar(0.4, 0.3, 0.48, 0.24, "#957350", 0.3, 0.26),
    bar(0.84, 0.42, 0.12, 0.3, "#957350", 0.33, 0.2),
    bar(0.86, 0.72, 0.22, 0.1, "#957350", 0.32, 0.2),
    ...[0.44, 0.78].map((x) => bar(x, 0, 0.08, 0.3, "#7d5f42", 0.4, 0.08)),
    bar(0.54, 0.54, 0.2, 0.22, team, 0.34, 0.2),
    bar(0.56, 0.76, 0.16, 0.14, skin, 0.36, 0.16),
    bar(0.48, 0.6, 0.06, 0.26, "#997447", 0.5, 0.05),
    ...backShaft(0, 0.72, 0.44)
  ],
  // Bloodlines: a horse's head and neck with a green plus (mounted units gain hit points).
  bloodlines: [bar(0.18, 0, 0.26, 0.5, "#957350", 0.3, 0.24), bar(0.18, 0.5, 0.46, 0.2, "#957350", 0.3, 0.24), bar(0.5, 0.42, 0.2, 0.14, "#957350", 0.32, 0.2), bar(0.2, 0.7, 0.08, 0.12, "#7d5f42", 0.36, 0.08), bar(0.12, 0.2, 0.08, 0.5, "#4a3b2a", 0.3, 0.24), bar(0.5, 0.6, 0.04, 0.04, "#1f1d1b", 0.55, 0.02), ...plus(0.66, 0.6)],
  // Husbandry: a tied hay bale and a pitchfork (mounted units move faster).
  husbandry: [bar(0.05, 0, 0.5, 0.36, hay, 0.3, 0.36), ...[0.15, 0.39].map((x) => bar(x, 0, 0.06, 0.37, "#7a5c40", 0.29, 0.38)), bar(0.06, 0.36, 0.48, 0.04, hay, 0.32, 0.32), bar(0.7, 0, 0.06, 0.8, wood5, 0.45, 0.06), bar(0.62, 0.8, 0.22, 0.05, metal22, 0.45, 0.06), ...[0.62, 0.7, 0.79].map((x) => bar(x, 0.85, 0.04, 0.14, metal22, 0.45, 0.06))],
  // Town Watch: an open eye (buildings see farther); Town Patrol: the eye over a patrol's footprints (farther again).
  "town-watch": [...eye(0.25), bar(0.38, 0, 0.14, 0.25, stone5, 0.4, 0.14)],
  "town-patrol": [...eye(0.35), ...[[0.12, 0], [0.3, 0.12], [0.5, 0], [0.68, 0.12]].map(([x, z]) => bar(x, 0, 0.16, 0.06, "#5a4632", 0.25 + z, 0.26))],
  // Fervor: a hooded monk striding with speed streaks (monks move faster).
  fervor: [bar(0.4, 0, 0.36, 0.5, habit, 0.3, 0.3), bar(0.44, 0.5, 0.28, 0.22, skin, 0.33, 0.24), bar(0.4, 0.68, 0.36, 0.14, habit, 0.3, 0.3), bar(0.36, 0.4, 0.08, 0.1, "#d8c48a", 0.38, 0.14), ...streaks(0.18, 0.15)],
  // Herbal Medicine: a stone mortar with a pestle and green leaves (garrisoned units heal faster).
  "herbal-medicine": [bar(0.15, 0, 0.4, 0.1, stone5, 0.3, 0.36), bar(0.08, 0.1, 0.54, 0.24, stone5, 0.26, 0.44), bar(0.14, 0.34, 0.42, 0.04, leaf, 0.3, 0.32), bar(0.3, 0.36, 0.08, 0.44, wood5, 0.42, 0.08), bar(0.66, 0, 0.14, 0.3, leaf, 0.4, 0.1), bar(0.78, 0.24, 0.16, 0.1, leaf, 0.4, 0.1), bar(0.6, 0.28, 0.12, 0.14, leaf, 0.4, 0.1)],
  // Hoardings: a curtain wall with a timber gallery cantilevered over its top and a green plus (stronger castles).
  hoardings: [bar(0.08, 0, 0.5, 0.62, stone5, 0.3, 0.36), bar(0, 0.62, 0.66, 0.2, wood5, 0.24, 0.48), bar(0.02, 0.82, 0.62, 0.08, team, 0.26, 0.44), ...[0.1, 0.3, 0.5].map((x) => bar(x, 0.68, 0.06, 0.1, dark5, 0.72, 0.02)), ...plus(0.7, 0.25)],
  // Sappers: a pick biting into a cracked wall (villagers against buildings).
  sappers: [bar(0.4, 0, 0.5, 0.7, stone5, 0.3, 0.3), bar(0.6, 0.2, 0.04, 0.3, dark5, 0.6, 0.02), bar(0.64, 0.38, 0.12, 0.04, dark5, 0.6, 0.02), bar(0.5, 0.48, 0.12, 0.04, dark5, 0.6, 0.02), bar(0.18, 0.2, 0.08, 0.6, wood5, 0.45, 0.08), bar(0.04, 0.76, 0.4, 0.06, metal22, 0.44, 0.1), bar(0.44, 0.7, 0.06, 0.08, metal22, 0.44, 0.1)],
  // Conscription: an hourglass between wooden plates, the sand mostly run (units train faster).
  conscription: [bar(0.15, 0, 0.6, 0.08, wood5, 0.3, 0.36), bar(0.15, 0.86, 0.6, 0.08, wood5, 0.3, 0.36), ...[0.18, 0.66].map((x) => bar(x, 0.08, 0.06, 0.78, wood5, 0.4, 0.06)), bar(0.28, 0.08, 0.34, 0.14, glass2, 0.36, 0.24), bar(0.3, 0.08, 0.3, 0.12, gold2, 0.38, 0.2), bar(0.36, 0.22, 0.18, 0.14, glass2, 0.4, 0.16), bar(0.41, 0.36, 0.08, 0.14, glass2, 0.42, 0.08), bar(0.43, 0.36, 0.04, 0.14, gold2, 0.44, 0.04), bar(0.36, 0.5, 0.18, 0.14, glass2, 0.4, 0.16), bar(0.28, 0.64, 0.34, 0.22, glass2, 0.36, 0.24), bar(0.38, 0.72, 0.14, 0.08, gold2, 0.42, 0.08)],
  // Artillery: a hooped bombard on its wheel with a long arrow (bombard cannon range).
  artillery: [bar(0.12, 0, 0.12, 0.5, "#5c4a36", 0.24, 0.5), bar(0.04, 0.22, 0.64, 0.1, dark5, 0.36, 0.2), bar(0.2, 0.32, 0.5, 0.28, iron5, 0.35, 0.28), ...[0.3, 0.46, 0.62].map((x) => bar(x, 0.3, 0.04, 0.32, "#3f4240", 0.33, 0.32)), bar(0.68, 0.36, 0.04, 0.2, "#1f1d1b", 0.4, 0.2), ...shaft(0.3, 0.8, 0.66)]
});
var hull = (y, color, w = 0.84) => [bar(0.08, y, w, 0.18, color, 0.3, 0.4), bar(0.02, y + 0.08, 0.08, 0.12, color, 0.32, 0.36), bar(0.08 + w, y + 0.08, 0.08, 0.14, color, 0.32, 0.36), bar(0.16, y - 0.08, w - 0.16, 0.08, "#5c4a36", 0.36, 0.28)];
var water = (y) => [bar(0, y, 1, 0.04, "#6fa2ae", 0.3, 0.44), bar(0.12, y + 0.04, 0.3, 0.03, "#9cc8d0", 0.4, 0.1), bar(0.6, y + 0.04, 0.26, 0.03, "#9cc8d0", 0.4, 0.1)];
Object.assign(techIcons, {
  // Gillnets: a net hung between two floats with a fish caught in it (fishing ships work faster).
  gillnets: [...[0.14, 0.36, 0.58, 0.8].map((x) => bar(x, 0.12, 0.03, 0.62, "#7c8a78", 0.42, 0.03)), ...[0.2, 0.42, 0.64].map((y) => bar(0.12, y, 0.74, 0.03, "#7c8a78", 0.42, 0.03)), bar(0.06, 0.72, 0.16, 0.12, team, 0.4, 0.12), bar(0.72, 0.72, 0.16, 0.12, "#ece2c4", 0.4, 0.12), bar(0.34, 0.3, 0.28, 0.1, "#d5e7de", 0.46, 0.06), bar(0.62, 0.28, 0.08, 0.14, "#a9c2c0", 0.46, 0.06), ...water(0)],
  // Careening: a hull hauled onto its side, an iron plate on its flank (ships take less from arrows).
  careening: [...hull(0.2, wood5), bar(0.3, 0.24, 0.34, 0.26, iron5, 0.72, 0.04), bar(0.36, 0.3, 0.22, 0.04, metal22, 0.76, 0.02), bar(0.42, 0.26, 0.1, 0.2, metal22, 0.76, 0.02), ...water(0)],
  // Dry Dock: a hull in a stone basin with speed streaks (ships faster, transports carry more).
  "dry-dock": [bar(0, 0, 0.12, 0.5, stone5, 0.3, 0.4), bar(0.88, 0, 0.12, 0.5, stone5, 0.3, 0.4), bar(0.12, 0, 0.76, 0.08, stone5, 0.3, 0.4), ...hull(0.22, team, 0.6).map((p) => ({ ...p, x: p.x + 0.1 })), ...streaks(0.3, 0.6)],
  // Shipwright: the ribs of a hull on the slip and a mallet (ships cheaper and quicker to build).
  shipwright: [bar(0.06, 0, 0.8, 0.08, "#5c4a36", 0.3, 0.4), ...[0.12, 0.32, 0.52, 0.72].map((x) => bar(x, 0.08, 0.08, 0.42 - Math.abs(x - 0.42) * 0.4, wood5, 0.32, 0.36)), bar(0.08, 0.3, 0.76, 0.05, wood5, 0.3, 0.06), bar(0.66, 0.56, 0.06, 0.34, wood5, 0.45, 0.06), bar(0.58, 0.82, 0.24, 0.14, "#7c5a3a", 0.42, 0.14)],
  // Caravan: a loaded cart wheel and bale with speed streaks (trade carts and cogs faster).
  caravan: [bar(0.3, 0.2, 0.5, 0.12, wood5, 0.3, 0.4), bar(0.36, 0.32, 0.38, 0.3, "#d8c9a6", 0.32, 0.34), bar(0.34, 0.62, 0.42, 0.06, team, 0.3, 0.38), bar(0.44, 0, 0.1, 0.32, "#5c4a36", 0.72, 0.08), bar(0.46, 0.12, 0.06, 0.08, iron5, 0.8, 0.02), ...streaks(0.18, 0.25)],
  // Guilds: a balance with a gold coin on one pan and a bale on the other, level (a lower market fee).
  guilds: [bar(0.42, 0, 0.16, 0.08, wood5, 0.4, 0.2), bar(0.47, 0.08, 0.06, 0.64, wood5, 0.45, 0.06), bar(0.08, 0.72, 0.84, 0.05, metal22, 0.45, 0.06), ...[0.1, 0.84].map((x) => bar(x, 0.4, 0.03, 0.32, metal22, 0.46, 0.03)), bar(0.02, 0.36, 0.2, 0.04, metal22, 0.4, 0.16), bar(0.76, 0.36, 0.2, 0.04, metal22, 0.4, 0.16), bar(0.06, 0.4, 0.12, 0.06, gold2, 0.42, 0.12), bar(0.8, 0.4, 0.12, 0.1, "#d8c9a6", 0.42, 0.12)],
  // Heated Shot: a red-hot ball in tongs over a brazier (towers hit ships harder).
  "heated-shot": [bar(0.26, 0, 0.48, 0.1, dark5, 0.3, 0.4), bar(0.3, 0.1, 0.4, 0.18, iron5, 0.32, 0.36), bar(0.32, 0.28, 0.36, 0.1, flame3, 0.34, 0.32), bar(0.4, 0.38, 0.2, 0.2, "#d0603a", 0.4, 0.2), bar(0.44, 0.42, 0.12, 0.12, spark3, 0.44, 0.14), bar(0.12, 0.48, 0.32, 0.04, metal22, 0.48, 0.04), bar(0.56, 0.48, 0.32, 0.04, metal22, 0.48, 0.04)],
  // Fortified Wall: a thick stone wall with merlons and a green plus (stronger walls and gates).
  "fortified-wall": [bar(0.02, 0, 0.66, 0.5, stone5, 0.3, 0.36), bar(0.02, 0.46, 0.66, 0.06, "#9d9a88", 0.28, 0.4), ...merlons(0.02, 0.52, 3, 0.12), ...plus(0.68, 0.24)],
  // Bombard Tower: a squat banded tower with a cannon run out of it (the tower itself).
  "bombard-tower-tech": [bar(0.18, 0, 0.6, 0.66, stone5, 0.3, 0.36), bar(0.14, 0.3, 0.68, 0.06, iron5, 0.28, 0.4), bar(0.14, 0.66, 0.68, 0.08, "#9d9a88", 0.28, 0.4), ...merlons(0.14, 0.74, 3, 0.12), bar(0.4, 0.4, 0.16, 0.12, iron5, 0.66, 0.3), bar(0.38, 0.38, 0.2, 0.16, "#3f4240", 0.94, 0.03)],
  // Greek Fire: a bronze siphon nozzle shooting a long jet of flame (fire ships reach farther).
  "greek-fire": [bar(0, 0.2, 0.22, 0.24, "#b8964a", 0.36, 0.28), bar(0.22, 0.26, 0.16, 0.12, "#b8964a", 0.4, 0.12), bar(0.38, 0.24, 0.2, 0.16, flame3, 0.4, 0.16), bar(0.58, 0.26, 0.22, 0.12, flame3, 0.4, 0.14), bar(0.8, 0.28, 0.2, 0.08, spark3, 0.42, 0.1), bar(0.06, 0, 0.1, 0.2, wood5, 0.4, 0.1), ...shaft(0.3, 0.62, 0.5)]
});

// apps/web/unit-rig.ts
var unitPoses = ["idle", "walk", "work", "attack", "hit", "death", "carry"];
var unitTools = ["none", "axe", "pick", "sickle", "hammer", "basket", "sword", "spear", "bow", "staff", "longbow", "repeater", "musket", "throwing-axe", "great-sword", "war-axe", "katana", "scimitar", "powder-keg", "hand-cannon"];
var unitRoles = ["villager", "swordsman", "spearman", "archer", "monk", "longbowman", "woad-raider", "throwing-axeman", "huskarl", "teutonic-knight", "berserk", "samurai", "janissary", "chu-ko-nu", "cataphract-rider", "mameluke-rider", "mangudai-rider", "mahout", "cavalry-archer-rider", "camel-rider", "petard", "hand-cannoneer"];
var roleTools = { swordsman: "sword", spearman: "spear", archer: "bow", monk: "staff", longbowman: "longbow", "woad-raider": "sword", "throwing-axeman": "throwing-axe", huskarl: "sword", "teutonic-knight": "great-sword", berserk: "war-axe", samurai: "katana", janissary: "musket", "chu-ko-nu": "repeater", "cataphract-rider": "spear", "mameluke-rider": "scimitar", "mangudai-rider": "bow", mahout: "spear", "cavalry-archer-rider": "bow", "camel-rider": "scimitar", petard: "powder-keg", "hand-cannoneer": "hand-cannon" };
var riderLooks = ["two-handed-swordsman", "champion", "hussar", "heavy-cavalry-archer"];
var skin2 = "#dfbb7e";
var metal3 = "#9aa3a1";
var leather = "#5a4632";
var fur = "#7d6a52";
var gold3 = "#c9a55a";
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
  let seated = false, worn = "villager";
  const outfits = /* @__PURE__ */ new Map();
  function dress(role) {
    if (!unitRoles.includes(role)) throw Error("\u672A\u77E5\u6A21\u578B\u8ECD\u7A2E");
    for (const outfit2 of outfits.values()) for (const g of outfit2) g.visible = false;
    for (const look of grades.values()) for (const g of look) g.visible = false;
    shield.visible = false;
    worn = role;
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
        part(o, 0, 0.66, 0, 0.3, 0.04, 0.35, gold3);
        part(o, 0, 1.1, 0, 0.34, 0.08, 0.3, lacquer);
        part(o, 0, 1.18, -0.02, 0.12, 0.1, 0.12, lacquer);
      } else if (role === "janissary") {
        part(o, 0, 1.1, -0.02, 0.32, 0.36, 0.3, "#ece6d6");
        part(o, 0, 0.96, -0.2, 0.28, 0.4, 0.06, "#ece6d6");
        part(o, 0, 1.1, 0, 0.34, 0.06, 0.34, gold3);
        part(o, 0, 0.42, 0, 0.48, 0.07, 0.34, gold3);
      } else if (role === "woad-raider") {
        part(o, 0, 0.44, 0, 0.475, 0.27, 0.335, skin2);
        for (const y of [0.5, 0.6]) part(o, 0, y, 0, 0.48, 0.04, 0.34, woad);
        part(o, 0, 0.42, 0, 0.49, 0.04, 0.345, leather);
        part(o, 0, 0.8, 0.15, 0.3, 0.04, 0.012, woad);
        part(o, 0, 1.1, 0, 0.4, 0.1, 0.36, "#ece6d2");
        for (const x of [-0.12, 0, 0.12]) part(o, x, 1.2, 0, 0.08, 0.14, 0.08, "#ece6d2");
        arms(0, -0.3, 0, 0.12, 0.31, 0.18, skin2);
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
        part(la, -0.18, -0.4, 0.16, 0.04, 0.1, 0.1, gold3);
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
        arms(0, -0.3, 0, 0.12, 0.28, 0.18, skin2);
        arms(0, -0.3, 0, 0.125, 0.06, 0.185, leather);
      } else if (role === "samurai") {
        part(o, 0, 1.1, 0, 0.4, 0.14, 0.38, lacquer);
        part(o, 0, 0.92, -0.06, 0.52, 0.16, 0.36, lacquer);
        for (const x of [-0.1, 0.1]) part(o, x, 1.16, 0.17, 0.04, 0.26, 0.02, gold3);
        part(o, 0, 1.14, 0.2, 0.1, 0.08, 0.02, gold3);
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
        part(o, 0, 1.22, 0, 0.12, 0.14, 0.12, gold3);
        part(o, 0, 0.42, 0, 0.48, 0.05, 0.34, gold3);
      } else if (role === "mangudai-rider") {
        part(o, 0, 1.06, 0, 0.48, 0.1, 0.44, "#8a6a48");
        part(o, 0, 1.16, 0, 0.3, 0.14, 0.28, team2);
        part(o, 0, 1.3, 0, 0.1, 0.06, 0.1, gold3);
        part(o, 0.08, 0.44, 0.165, 0.14, 0.24, 0.02, "#d8c48a");
        part(o, 0.25, 0.3, -0.05, 0.1, 0.32, 0.14, "#8b6746");
      } else if (role === "cavalry-archer-rider") {
        const cap = "#6b5238";
        part(o, 0, 1.01, 0, 0.46, 0.13, 0.44, cap);
        part(o, 0, 1.14, 0, 0.32, 0.12, 0.3, cap);
        part(o, 0, 1.26, 0, 0.14, 0.1, 0.14, cap);
        for (const x of [-0.2, 0.2]) part(o, x, 0.84, 0, 0.04, 0.2, 0.2, cap);
        part(o, 0, 0.36, -0.18, 0.42, 0.34, 0.04, team2);
        part(o, -0.1, 0.4, -0.24, 0.12, 0.42, 0.1, "#8b6746");
        for (const x of [-0.13, -0.07]) part(o, x, 0.82, -0.24, 0.03, 0.12, 0.03, "#efe9da");
      } else if (role === "camel-rider") {
        const cloth2 = "#cdb88e";
        part(o, 0, 1, -0.01, 0.47, 0.16, 0.45, cloth2);
        part(o, 0, 0.7, -0.2, 0.3, 0.34, 0.05, cloth2);
        part(o, 0, 0.74, 0.16, 0.32, 0.1, 0.02, cloth2);
        part(o, 0, 1.1, 0, 0.49, 0.04, 0.47, team2);
        part(o, 0, 0.12, 0, 0.5, 0.2, 0.36, "#e8e0c8");
        part(o, 0, 0.5, 0.17, 0.4, 0.06, 0.02, team2);
      } else if (role === "petard") {
        part(o, 0, 1.01, 0, 0.46, 0.15, 0.42, leather);
        part(o, 0, 1.03, 0, 0.47, 0.04, 0.43, team2);
        part(o, 0, 0.64, 0, 0.4, 0.06, 0.34, team2);
        part(o, 0, 0.5, 0.17, 0.42, 0.05, 0.02, "#6e5438");
        for (const x of [-0.12, 0.02, 0.14]) part(o, x, 0.36, 0.17, 0.06, 0.1, 0.05, "#b8964a");
        part(la, 0, -0.52, 0.12, 0.03, 0.2, 0.03, "#6e5438");
        part(la, 0, -0.34, 0.12, 0.045, 0.045, 0.045, "#e0a040");
      } else if (role === "hand-cannoneer") {
        const jack = "#b9a27a", stitch = "#9c8660";
        part(o, 0, 1, 0, 0.46, 0.14, 0.42, "#3d3a34");
        const beret = part(o, -0.04, 1.13, 0.01, 0.34, 0.06, 0.32, "#3d3a34");
        beret.rotation.z = 0.14;
        part(o, 0.14, 1.14, -0.1, 0.05, 0.22, 0.05, "#e8e0c8");
        part(o, 0, 0.24, 0, 0.49, 0.4, 0.34, jack);
        for (const y of [0.36, 0.5]) part(o, 0, y, 0, 0.495, 0.02, 0.345, stitch);
        part(o, 0, 0.24, 0, 0.5, 0.05, 0.35, leather);
        const rod = part(o, 0, 0.2, -0.2, 0.03, 0.8, 0.03, "#5a4632");
        rod.rotation.z = 0.6;
        part(o, -0.26, 0.3, 0.05, 0.06, 0.16, 0.08, "#e3d6b4");
        part(o, -0.26, 0.44, 0.05, 0.07, 0.04, 0.09, "#6e5438");
        part(o, 0.26, 0.26, 0.04, 0.08, 0.14, 0.12, leather);
        arms(0, -0.14, 0, 0.12, 0.12, 0.18, jack);
      } else if (role === "mahout") {
        part(o, 0, 1.08, 0, 0.42, 0.12, 0.4, team2);
        part(o, 0, 1.2, 0, 0.14, 0.06, 0.14, gold3);
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
  const grades = /* @__PURE__ */ new Map();
  function grade(look) {
    for (const g2 of grades.values()) for (const x of g2) x.visible = false;
    shield.visible = worn === "swordsman" && look !== "two-handed-swordsman" && look !== "champion";
    if (!look || !riderLooks.includes(look)) return;
    let g = grades.get(look);
    if (!g) {
      const o = new T.Group(), la = new T.Group(), ra = new T.Group();
      o.name = `grade-${look}`;
      la.name = `grade-${look}-arm-left`;
      ra.name = `grade-${look}-arm-right`;
      root.add(o);
      leftArm.add(la);
      rightArm.add(ra);
      g = [o, la, ra];
      grades.set(look, g);
      const arms = (x, y, z, w, h, d, color) => {
        for (const a of [la, ra]) part(a, x, y, z, w, h, d, color);
      };
      if (look === "two-handed-swordsman" || look === "champion") {
        part(o, 0, 1.06, 0, 0.46, 0.2, 0.42, metal3);
        part(o, 0, 0.88, 0.18, 0.36, 0.16, 0.03, metal3);
        part(o, 0, 0.95, 0.196, 0.3, 0.03, 0.01, "#2c2e2c");
        if (look === "champion") {
          part(o, 0, 1.26, 0, 0.08, 0.2, 0.08, team2);
          part(o, 0, 1.06, 0, 0.47, 0.03, 0.43, gold3);
          arms(0, -0.12, 0, 0.16, 0.14, 0.21, metal3);
        }
      } else if (look === "hussar") {
        part(o, 0, 1.08, 0, 0.42, 0.32, 0.38, "#3a3530");
        part(o, 0.15, 1.4, 0, 0.06, 0.14, 0.06, team2);
        part(o, 0, 0.5, -0.22, 0.05, 1, 0.05, "#6e5438");
        for (const [y, z] of [[0.72, -0.27], [0.88, -0.29], [1.04, -0.3], [1.2, -0.29], [1.36, -0.27]]) part(o, 0, y, z, 0.04, 0.12, 0.1, "#efe9da");
      } else if (look === "heavy-cavalry-archer") {
        part(o, 0, 0.3, 0, 0.485, 0.32, 0.345, metal3);
        part(o, 0, 0.62, 0, 0.36, 0.05, 0.33, metal3);
        arms(0, -0.26, 0, 0.115, 0.24, 0.175, metal3);
      }
    }
    for (const x of g) x.visible = true;
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
    } else if (kind === "powder-keg") {
      part(group, -0.19, -0.2, 0.13, 0.34, 0.38, 0.3, "#7a5a3a");
      for (const y of [-0.12, 0.08]) part(group, -0.19, y, 0.13, 0.36, 0.04, 0.32, "#4a4a48");
      part(group, -0.19, 0.18, 0.13, 0.26, 0.03, 0.22, "#6e5438");
      part(group, -0.12, 0.21, 0.18, 0.03, 0.1, 0.03, "#d9cba4");
      part(group, -0.12, 0.31, 0.18, 0.05, 0.05, 0.05, "#f5dc7a");
    } else if (kind === "hand-cannon") {
      part(group, 0, -0.02, 0, 0.05, 0.5, 0.05, "#8a6a45");
      part(group, 0, -0.3, 0, 0.12, 0.28, 0.12, "#5b5e5c");
      for (const y of [-0.24, -0.12]) part(group, 0, y, 0, 0.135, 0.035, 0.135, "#3f4240");
      part(group, 0, -0.36, 0, 0.15, 0.06, 0.15, "#3f4240");
      part(group, 0, -0.08, 0.06, 0.03, 0.03, 0.02, "#2c2e2c");
      const flash = part(group, 0, -0.46, 0, 0.1, 0.1, 0.1, "#f2c25a");
      flash.name = "tool-hand-cannon-flash";
      flash.visible = false;
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
  function aim(time) {
    const t = Math.max(0, Number.isFinite(time) ? time : 0), f = t % 1400 / 1400, kick = f < 0.12 ? Math.sin(Math.PI * f / 0.12) : 0;
    return { right: -1.5 - 0.3 * kick, left: -1.25 - 0.2 * kick, lean: -0.08 * kick || 0, flash: f < 0.07 };
  }
  function pose(kind, time) {
    if (!unitPoses.includes(kind)) throw Error("\u672A\u77E5\u6A21\u578B\u59FF\u614B");
    const p = samplePose(kind, time);
    const firing = kind === "attack" && selected === "hand-cannon" && !seated, shot = firing ? aim(time) : null;
    if (shot) {
      p.rightArm = shot.right;
      p.leftArm = shot.left;
      p.lean = shot.lean;
    }
    const flash = toolMeshes.get("hand-cannon")?.getObjectByName("tool-hand-cannon-flash");
    if (flash) flash.visible = !!shot?.flash;
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
  return { root, sockets, equip, pose, dress, grade, seat: (value) => {
    seated = value;
  } };
}

// apps/web/elephant-rig.ts
function createElephantMount(T, player, box, material) {
  const root = new T.Group();
  root.name = "elephant-root";
  const team2 = player === 0 ? "#45728c" : "#b25441", grey2 = "#8d8c86", ear = "#9a988f", ivory = "#efe8d2", gold4 = "#c9a55a", wood6 = "#6e5438";
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
  part(body, 0, 0.98, 0, 1.05, 0.06, 1.11, gold4);
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
  part(body, 0, 1.6, -0.12, 0.9, 0.1, 0.96, wood6);
  for (const z of [0.3, -0.54]) part(body, 0, 1.7, z, 0.9, 0.3, 0.08, team2);
  for (const x of [-0.41, 0.41]) part(body, x, 1.7, -0.12, 0.08, 0.3, 0.76, team2);
  for (const z of [0.3, -0.54]) part(body, 0, 2, z, 0.94, 0.05, 0.1, gold4);
  for (const x of [-0.41, 0.41]) for (const z of [0.3, -0.54]) part(body, x, 2, z, 0.08, 0.3, 0.08, gold4);
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

// apps/web/camel-rig.ts
function createCamelMount(T, player, box, material) {
  const root = new T.Group();
  root.name = "camel-root";
  const team2 = player === 0 ? "#45728c" : "#b25441", coat = "#c8a46e", shade = "#a9844f", wood6 = "#6e5438";
  const part = (parent, x, y, z, w, h, d, color) => {
    const m = new T.Mesh(box(w, h, d), material(color));
    m.position.set(x, y, z);
    m.castShadow = true;
    parent.add(m);
    return m;
  };
  const legs = [];
  for (const x of [-0.17, 0.17]) for (const z of [-0.4, 0.42]) {
    const leg = new T.Group();
    leg.name = `camel-leg-${legs.length}`;
    leg.position.set(x, 0.95, z);
    root.add(leg);
    legs.push(leg);
    part(leg, 0, -0.9, 0, 0.12, 0.9, 0.13, coat);
    part(leg, 0, -0.5, 0, 0.15, 0.1, 0.16, shade);
    part(leg, 0, -0.95, 0.02, 0.18, 0.07, 0.2, "#8a6a45");
  }
  const body = new T.Group();
  root.add(body);
  part(body, 0, 0.9, 0, 0.5, 0.42, 1.12, coat);
  part(body, 0, 0.88, 0, 0.44, 0.06, 1, shade);
  part(body, 0, 1.32, -0.05, 0.38, 0.2, 0.52, coat);
  part(body, 0, 1.52, -0.05, 0.24, 0.08, 0.32, coat);
  part(body, 0, 0.98, -0.6, 0.06, 0.3, 0.06, shade);
  part(body, 0, 0.94, -0.6, 0.09, 0.07, 0.09, "#5c4a36");
  part(body, 0, 1.06, -0.05, 0.52, 0.28, 0.6, team2);
  part(body, 0, 1.05, -0.05, 0.53, 0.04, 0.61, "#d9bf6f");
  part(body, 0, 1.56, -0.05, 0.4, 0.06, 0.42, wood6);
  part(body, 0, 1.62, 0.17, 0.28, 0.14, 0.05, wood6);
  part(body, 0, 1.62, -0.27, 0.28, 0.14, 0.05, wood6);
  part(body, 0, 0.98, 0.6, 0.2, 0.3, 0.24, coat);
  part(body, 0, 1.12, 0.78, 0.18, 0.3, 0.2, coat);
  part(body, 0, 1.32, 0.9, 0.16, 0.36, 0.18, coat);
  const head = new T.Group();
  head.name = "camel-head";
  head.position.set(0, 1.6, 0.96);
  body.add(head);
  part(head, 0, 0, 0.08, 0.2, 0.2, 0.36, coat);
  part(head, 0, -0.02, 0.28, 0.16, 0.14, 0.12, shade);
  part(head, 0, 0.2, -0.04, 0.16, 0.06, 0.14, coat);
  for (const sx of [-1, 1]) {
    part(head, sx * 0.1, 0.12, 0.06, 0.02, 0.04, 0.05, "#2f3932");
    part(head, sx * 0.07, 0.2, -0.06, 0.04, 0.08, 0.04, shade);
  }
  part(head, 0, 0.04, 0.08, 0.22, 0.03, 0.2, team2);
  const saddle = new T.Group();
  saddle.name = "rider-saddle";
  saddle.position.set(0, 1.62, -0.05);
  body.add(saddle);
  let armour = null;
  function grade(look) {
    if (look === "heavy-camel" && !armour) {
      armour = new T.Group();
      armour.name = "camel-armour";
      body.add(armour);
      part(armour, 0, 0.9, -0.05, 0.54, 0.34, 0.98, "#8a6a45");
      for (const z of [-0.4, -0.1, 0.2]) part(armour, 0, 0.9, z, 0.55, 0.34, 0.04, team2);
      part(armour, 0, 0.92, 0.55, 0.3, 0.3, 0.06, "#b8964a");
      part(armour, 0, 1.4, 0.88, 0.18, 0.08, 0.22, "#b8964a");
    }
    if (armour) armour.visible = look === "heavy-camel";
  }
  function pose(kind, time) {
    const t = Number.isFinite(time) ? Math.max(0, time) : 0, phase = t * 0.01, walking = kind === "walk";
    legs.forEach((leg, i) => {
      const swing = walking ? Math.sin(phase + (i < 2 ? 0 : Math.PI)) * 0.24 : 0;
      leg.rotation.x = swing;
      leg.position.y = 0.95 + Math.abs(Math.sin(swing)) * 0.12;
    });
    body.position.y = walking ? Math.abs(Math.sin(phase)) * 0.03 : 0;
    head.rotation.x = walking ? Math.sin(phase * 2) * 0.08 : kind === "attack" ? -0.18 : 0;
    head.rotation.y = kind === "idle" ? Math.sin(t * 15e-4) * 0.25 : 0;
  }
  return { root, saddle, pose, grade };
}

// apps/web/character-rig.ts
var mountedRoles = ["cavalry", "cataphract", "mameluke", "mangudai", "war-elephant", "cavalry-archer", "camel"];
var isMounted = (role) => mountedRoles.includes(role);
var mounts = {
  cavalry: { rider: "swordsman", tool: "spear", mount: "horse", horse: { coat: "#957350", head: "#a5835b", mane: "#64533d", barding: false } },
  cataphract: { rider: "cataphract-rider", tool: "spear", mount: "horse", horse: { coat: "#6f5a44", head: "#7c6550", mane: "#3e3326", barding: true } },
  mameluke: { rider: "mameluke-rider", tool: "scimitar", mount: "horse", horse: { coat: "#d6cdb9", head: "#e0d8c6", mane: "#8b8374", barding: false } },
  mangudai: { rider: "mangudai-rider", tool: "bow", mount: "horse", horse: { coat: "#7a5b3c", head: "#8a6a48", mane: "#3e3326", barding: false } },
  "war-elephant": { rider: "mahout", tool: "spear", mount: "elephant", horse: null },
  // The cavalry archer rides a black horse (the Mangudai's is dun); the camel rider a camel.
  "cavalry-archer": { rider: "cavalry-archer-rider", tool: "bow", mount: "horse", horse: { coat: "#3d3631", head: "#4a413a", mane: "#1f1b18", barding: false } },
  camel: { rider: "camel-rider", tool: "scimitar", mount: "camel", horse: null }
};
function createCharacterRig(T, player, box, material) {
  const root = new T.Group(), rider = createUnitRig(T, player, box, material);
  root.add(rider.root);
  const team2 = player === 0 ? "#45728c" : "#b25441";
  let horse = null, saddle = null, barding2 = null, gilt5 = null, mounted = null;
  const legs = [];
  const beasts = /* @__PURE__ */ new Map();
  const beast = (kind) => {
    let b = beasts.get(kind);
    if (!b) {
      b = kind === "camel" ? createCamelMount(T, player, box, material) : createElephantMount(T, player, box, material);
      root.add(b.root);
      beasts.set(kind, b);
    }
    return b;
  };
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
  function makeGilt() {
    gilt5 = new T.Group();
    gilt5.name = "horse-gilt";
    horse.add(gilt5);
    const gold4 = "#c9a55a";
    part(gilt5, 0, 0.98, 0, 0.61, 0.04, 1.2, gold4);
    part(gilt5, 0, 1.48, 0.86, 0.08, 0.12, 0.05, gold4);
    part(gilt5, 0, 1.33, 0.84, 0.31, 0.03, 0.05, gold4);
  }
  function dress(role) {
    const next = isMounted(role) ? role : null;
    mounted = next;
    for (const b of beasts.values()) {
      b.root.visible = false;
      b.grade?.(null);
    }
    if (gilt5) gilt5.visible = false;
    if (next) {
      const look = mounts[next];
      if (look.horse) {
        if (!horse) makeHorse();
        horse.visible = true;
        for (const k of ["coat", "head", "mane"]) for (const m of tints[k]) m.material = material(look.horse[k]);
        if (look.horse.barding && !barding2) makeBarding();
        if (barding2) barding2.visible = look.horse.barding;
        saddle.add(rider.root);
      } else {
        const b = beast(look.mount);
        b.root.visible = true;
        if (horse) horse.visible = false;
        b.saddle.add(rider.root);
      }
      rider.dress(look.rider);
      rider.equip(look.tool);
    } else {
      if (horse) horse.visible = false;
      root.add(rider.root);
      rider.dress(role);
    }
    rider.seat(!!next);
    pose("idle", 0);
  }
  function grade(look) {
    rider.grade(look);
    const look0 = mounted ? mounts[mounted] : null;
    if (!look0) return;
    if (look0.horse && horse) {
      const armoured = look === "cavalier" || look === "paladin";
      if (armoured && !barding2) makeBarding();
      if (barding2) barding2.visible = look0.horse.barding || armoured;
      if (look === "paladin" && !gilt5) makeGilt();
      if (gilt5) gilt5.visible = look === "paladin";
    } else beasts.get(look0.mount)?.grade?.(look);
  }
  function pose(kind, time) {
    if (mounted && !["idle", "walk", "attack"].includes(kind)) throw Error("\u9A0E\u4E58\u6A21\u578B\u76EE\u524D\u50C5\u652F\u63F4\u5F85\u547D\u3001\u884C\u8D70\u8207\u653B\u64CA\u59FF\u614B");
    rider.pose(kind, time);
    if (horse) {
      const phase = Number.isFinite(time) ? Math.max(0, time) * 0.012 : 0, walking = mounted && mounts[mounted].mount === "horse" && kind === "walk";
      legs.forEach((leg, i) => {
        const swing = walking ? Math.sin(phase + (i === 0 || i === 3 ? 0 : Math.PI)) * 0.26 : 0;
        leg.rotation.x = swing;
        leg.position.y = 0.62 + Math.abs(Math.sin(swing)) * 0.14;
      });
    }
    for (const [kind0, b] of beasts) b.pose(mounted && mounts[mounted].mount === kind0 ? kind : "idle", time);
  }
  return { root, sockets: rider.sockets, equip: rider.equip, dress, pose, grade };
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
  }, grade: (_) => {
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
var footUniques = ["longbowman", "woad-raider", "throwing-axeman", "huskarl", "teutonic-knight", "berserk", "samurai", "janissary", "chu-ko-nu", "petard", "hand-cannoneer"];
var siegeKinds = ["ram", "mangonel", "scorpion", "trebuchet", "bombard-cannon"];
var isSiege = (kind) => siegeKinds.includes(kind);
var shipKinds = ["fishing-ship", "transport-ship", "trade-cog", "galley", "fire-galley", "demolition-raft", "cannon-galleon", "longboat"];
var vesselKinds = [...shipKinds, "trade-cart"];
var isVessel = (kind) => vesselKinds.includes(kind);
var upgradeLooks = {
  militia: ["two-handed-swordsman", "champion"],
  scout: ["hussar"],
  knight: ["cavalier", "paladin"],
  "cavalry-archer": ["heavy-cavalry-archer"],
  camel: ["heavy-camel"],
  ram: ["capped-ram", "siege-ram"],
  mangonel: ["onager", "siege-onager"],
  scorpion: ["heavy-scorpion"],
  // The dock's lines (War Galley turns all three Feudal ships at once).
  galley: ["war-galley", "galleon"],
  "fire-galley": ["war-galley", "fast-fire-ship"],
  "demolition-raft": ["war-galley", "heavy-demolition-ship"],
  "cannon-galleon": ["elite-cannon-galleon"],
  longboat: ["elite-longboat"]
};
function lookOf(kind, techs) {
  const line2 = upgradeLooks[kind] ?? [];
  for (let i = line2.length - 1; i >= 0; i--) if (techs.includes(line2[i])) return line2[i];
  return null;
}
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
  const p = [], age = v.ageVariant, team2 = v.red ? "#b85c47" : "#456e87", wood6 = "#94734c", stone6 = "#aaa994", brass2 = "#bca068", water2 = "#6a9297", height = 1.28 + (age - 1) * 0.16;
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
      add("boundary-back", 1, 0, 0, 0.16, 2.7, 0.08, 0.12, wood6);
      add("boundary-front", 1, 0, 2.62, 0.16, 2.7, 0.08, 0.12, wood6);
    } else {
      add("wall-back", 1, 0, 0, 0.16, 2.7, 0.08, 0.24, stone6);
      for (const [x, w] of [[0, 1.08], [1.62, 1.08]]) add(`wall-front-${x}`, 1, x, 2.62, 0.16, w, 0.08, 0.24, stone6);
      for (const x of [1.08, 1.46]) add(`gate-pier-${x}`, 1, x, 2.58, 0.16, 0.16, 0.16, 0.56, stone6, true);
    }
    if (age >= 2) {
      for (const x of [0, 2.62]) add(age >= 3 ? `wall-side-${x}` : `boundary-side-${x}`, 1, x, 0.08, 0.16, 0.08, 2.54, age >= 3 ? 0.24 : 0.12, age >= 3 ? stone6 : wood6);
      for (const x of [-0.12, 2.72]) for (const z of [-0.12, 2.72]) add(`fence-post-${x}-${z}`, 1, x, z, 0.16, 0.1, 0.1, age >= 3 ? 0.56 : 0.45, age >= 3 ? stone6 : wood6);
    }
    if (age === 4) {
      add("gate-lintel", 1, 1.08, 2.58, 0.72, 0.54, 0.16, 0.16, team2, true);
      add("scarecrow-post", 3, 1.3, 1.24, 0.16, 0.06, 0.06, 0.64, wood6);
      add("scarecrow-arms", 3, 1.1, 1.24, 0.8, 0.46, 0.06, 0.06, wood6);
      add("scarecrow-head", 3, 1.25, 1.19, 0.86, 0.16, 0.16, 0.22, "#c7b27a");
      add("scarecrow-hat", 3, 1.2, 1.15, 1.08, 0.26, 0.24, 0.06, "#6d563d");
    }
  } else {
    const hallHeight = 1.6 + (age - 1) * 0.16, towerTop = 0.16 + (age >= 3 ? 6 : 5) * 0.4, roofY = kind === "mill" ? towerTop : kind === "town-center" ? hallHeight + 0.16 : height + 0.16, masonry = kind !== "town-center", postBase = masonry && age >= 2 ? 0.4 : 0.16;
    for (const x of [0.1, 2.4]) for (const z of [0.1, 1.8]) add(`post-${x}-${z}`, 1, x, z, postBase, 0.16, 0.16, roofY - postBase, age >= 3 ? stone6 : wood6);
    add("back-brace", 1, 0.1, 0.1, roofY - 0.24, 2.46, 0.14, 0.24, wood6);
    if (kind === "market") {
      for (let stripe = 0; stripe < 6; stripe++) add(`awning-${stripe}`, 2, -0.05 + stripe * 0.48, -0.05, roofY, 0.48, 2.25, 0.16, stripe % 2 ? "#e4d4ab" : team2);
    } else for (let level = 0; level < 3; level++) add(`roof-${level}`, 2, -0.05 + level * 0.28, -0.05, roofY + level * 0.16, 2.9 - level * 0.56, 2.25, 0.16, age === 1 ? "#b8a074" : team2, true);
    if (masonry && age >= 2) for (const x of [0.1, 2.4]) for (const z of [0.1, 1.8]) add(`footing-${x}-${z}`, 1, x - 0.02, z - 0.02, 0.16, 0.2, 0.2, 0.24, stone6);
    if (masonry && age >= 3) {
      if (kind !== "smithy") add("stone-plinth", 1, 0.28, 0.1, 0.16, 2.1, 0.14, 0.48, stone6, true);
      for (const x of [-0.04, 2.56]) for (const z of [0.3, 1.46]) add(`buttress-${x}-${z}`, 1, x, z, 0.16, 0.14, 0.3, roofY - 0.16, stone6);
    }
    if (kind === "lumber-camp") {
      for (let row = 0; row < 3; row++) for (let layer = 0; layer < 2; layer++) add(`log-${row}-${layer}`, 3, 0.25, 0.3 + row * 0.28, 0.16 + layer * 0.2, 1.6, 0.22, 0.2, wood6, true);
      for (const x of [0.55, 1.75]) add(`saw-leg-${x}`, 3, x, 2.15, 0.16, 0.14, 0.32, 0.45, "#66563e");
      add("saw-worktop", 3, 0.35, 2.08, 0.61, 1.8, 0.48, 0.12, wood6);
      add("saw-blade", 3, 0.9, 2.24, 0.73, 0.85, 0.06, 0.14, "#b8c0b9");
      if (age >= 2) {
        add("chopping-block", 3, 2, 0.9, 0.16, 0.35, 0.35, 0.3, "#7c674b", true);
        add("axe-handle", 3, 2.15, 1.05, 0.46, 0.05, 0.05, 0.4, wood6);
        add("axe-head", 3, 2.08, 1.04, 0.78, 0.2, 0.07, 0.08, "#b8c0b9");
      }
      if (age === 4) {
        add("crane-mast", 3, 2.5, 2.3, 0.16, 0.16, 0.16, roofY + 0.32, wood6);
        add("crane-jib", 3, 1.2, 2.3, roofY + 0.48, 1.46, 0.16, 0.16, wood6);
        add("crane-rope", 3, 1.34, 2.36, roofY - 0.32, 0.04, 0.04, 0.8, "#8c8879");
        add("crane-hook", 3, 1.28, 2.3, roofY - 0.44, 0.16, 0.16, 0.12, "#76817d");
      }
    } else if (kind === "mining-camp") {
      add("hopper-base", 3, 0.35, 0.4, 0.16, 1.7, 0.9, 0.16, wood6);
      for (const x of [0.35, 1.89]) add(`hopper-wall-${x}`, 3, x, 0.4, 0.32, 0.16, 0.9, 0.55, wood6);
      add("hopper-back", 3, 0.35, 0.4, 0.32, 1.7, 0.16, 0.55, wood6);
      for (let i = 0; i < 6; i++) add(`ore-${i}`, 3, 0.59 + i % 3 * 0.39, 0.62 + Math.floor(i / 3) * 0.32, 0.32, 0.3, 0.26, 0.25, i % 2 ? stone6 : "#c0a557", true);
      add("pick-handle", 3, 2.42, 0.8, 0.16, 0.06, 0.06, 1.05, wood6);
      add("pick-head", 3, 2.2, 0.8, 1.12, 0.5, 0.08, 0.1, "#b8c0b9");
      if (age >= 2) {
        for (const z of [2.3, 2.62]) add(`rail-${z}`, 1, 0.7, z, 0.16, 1.1, 0.06, 0.06, "#76817d");
        add("cart-body", 3, 1, 2.26, 0.22, 0.5, 0.46, 0.3, "#7c674b");
        add("cart-ore", 3, 1.08, 2.34, 0.52, 0.34, 0.3, 0.12, "#c0a557", true);
      }
      if (age === 4) {
        for (const x of [0.4, 1.94]) add(`headframe-leg-${x}`, 3, x, 2.42, 0.16, 0.16, 0.16, roofY + 0.12, wood6);
        add("headframe-beam", 3, 0.4, 2.42, roofY + 0.28, 1.7, 0.16, 0.16, wood6);
        add("headframe-wheel", 3, 1.1, 2.44, roofY + 0.44, 0.3, 0.12, 0.3, "#76817d");
        add("headframe-rope", 3, 1.23, 2.48, 1.2, 0.04, 0.04, roofY - 0.92, "#8c8879");
        add("headframe-bucket", 3, 1.13, 2.38, 0.96, 0.24, 0.24, 0.24, "#7c674b");
      }
    } else if (kind === "mill") {
      for (let course = 0; course < (age >= 3 ? 6 : 5); course++) add(`mill-tower-${course}`, 1, 0.85, 0.6, 0.16 + course * 0.4, 1, 1, 0.4, course % 2 ? stone6 : "#c4bfa8", true);
      const hubY = towerTop - 0.5;
      add("axle", 3, 1.28, 1.6, hubY, 0.14, 0.83, 0.14, wood6);
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
        add("cupola-base", 2, 1, 0.6, base, 0.8, 0.8, 0.16, stone6);
        for (const x of [1, 1.68]) for (const z of [0.6, 1.28]) add(`cupola-post-${x}-${z}`, 3, x, z, base + 0.16, 0.12, 0.12, 0.4, stone6);
        add("cupola-cap", 3, 0.92, 0.52, base + 0.56, 0.96, 0.96, 0.16, team2, true);
        add("vane-pole", 4, 1.38, 0.98, base + 0.72, 0.04, 0.04, 0.5, "#76817d");
        add("vane-arrow", 4, 1.42, 0.98, base + 1.06, 0.3, 0.03, 0.12, brass2);
      }
    } else if (kind === "town-center") {
      for (const x of [0.15, 2.05]) add(`hall-pier-${x}`, 1, x, 0.15, 0.16, 0.5, 1.5, hallHeight, stone6, true);
      add("entrance-lintel", 1, 0.65, 1.5, 0.16, 1.4, 0.25, 1.6, stone6, false, "arch");
      if (hallHeight > 1.6) add("entrance-course", 1, 0.65, 1.5, 1.76, 1.4, 0.25, hallHeight - 1.6, stone6);
      add("entrance-paving", 3, 0.95, 1.75, 0.16, 0.8, 1.05, 0.02, "#c8bea4");
      if (age >= 2) {
        let towerBase = roofY + 0.48;
        if (age >= 3) for (let course = 0; course < 2; course++) add(`tower-course-${course}`, 2, 0.87, 0.65, towerBase + course * 0.32, 0.96, 0.85, 0.32, stone6);
        if (age >= 3) towerBase += 0.64;
        add("belfry-floor", 3, 0.87, 0.65, towerBase, 0.96, 0.85, 0.16, stone6, true);
        for (const x of [0.91, 1.63]) for (const z of [0.69, 1.25]) add(`belfry-pillar-${x}-${z}`, 3, x, z, towerBase + 0.16, 0.12, 0.12, 0.65, stone6);
        add("belfry-top", 3, 0.8, 0.58, towerBase + 0.81, 1.1, 1, 0.16, team2, true);
        add("bell-hanger", 3, 1.33, 0.98, towerBase + 0.55, 0.05, 0.05, 0.26, wood6);
        add("bell", 3, 1.2, 0.88, towerBase + 0.4, 0.3, 0.28, 0.22, brass2);
        if (age === 4) {
          const top = towerBase + 0.97;
          add("spire-0", 3, 0.95, 0.73, top, 0.8, 0.7, 0.16, team2, true);
          add("spire-1", 3, 1.1, 0.88, top + 0.16, 0.5, 0.4, 0.16, team2);
          add("spire-2", 3, 1.23, 0.98, top + 0.32, 0.24, 0.2, 0.24, team2);
          add("spire-finial", 4, 1.31, 1.04, top + 0.56, 0.08, 0.08, 0.3, brass2);
        }
      }
      add("notice-board", 3, 0.14, 1.9, 0.72, 0.48, 0.08, 0.4, wood6);
      add("notice-paper", 3, 0.2, 1.98, 0.78, 0.34, 0.025, 0.27, "#e5d9b3");
      add("cargo-crate", 3, 2.1, 2.1, 0.16, 0.42, 0.42, 0.38, wood6, true);
    } else if (kind === "market") {
      for (const x of [0.24, 1.94]) {
        add(`stall-${x}`, 3, x, 0.35, 0.16, 0.52, 1.38, 0.48, wood6);
        for (let i = 0; i < 3; i++) add(`goods-${x}-${i}`, 3, x + 0.08, 0.48 + i * 0.4, 0.64, 0.34, 0.28, 0.18, i % 2 ? "#b9a76c" : "#8f9e5e", true);
      }
      add("scale-post", 3, 2.18, 1.48, 0.64, 0.04, 0.04, 0.46, "#8c8879");
      add("scale-beam", 3, 1.98, 1.48, 1.1, 0.44, 0.04, 0.04, "#8c8879");
      for (const x of [1.99, 2.36]) {
        add(`scale-wire-${x}`, 3, x, 1.48, 0.9, 0.025, 0.025, 0.2, "#8c8879");
        add(`scale-pan-${x}`, 3, x - 0.05, 1.43, 0.87, 0.13, 0.13, 0.04, "#b8b3a0");
      }
      if (age >= 2) for (let stripe = 0; stripe < 6; stripe++) add(`valance-${stripe}`, 2, -0.05 + stripe * 0.48, 2.14, roofY - 0.12, 0.48, 0.06, 0.12, stripe % 2 ? team2 : "#e4d4ab");
      if (age >= 3) add("arcade-arch", 1, 0.28, 1.8, 0.16, 2.1, 0.16, roofY - 0.16, stone6, false, "arch");
      if (age === 4) {
        const base = roofY + 0.16;
        add("pavilion-floor", 2, 0.95, 0.55, base, 0.9, 0.9, 0.12, stone6);
        for (const x of [0.99, 1.69]) for (const z of [0.59, 1.29]) add(`pavilion-post-${x}-${z}`, 3, x, z, base + 0.12, 0.12, 0.12, 0.44, wood6);
        add("pavilion-roof", 3, 0.87, 0.47, base + 0.56, 1.06, 1.06, 0.16, team2, true);
        add("pavilion-finial", 4, 1.36, 0.96, base + 0.72, 0.08, 0.08, 0.26, brass2);
      }
    } else if (kind === "smithy") {
      add("forge-back", 1, 0.28, 0.22, 0.16, 1.05, 0.3, 1.05, stone6, true);
      for (const x of [0.28, 1.05]) add(`forge-side-${x}`, 1, x, 0.52, 0.16, 0.28, 0.7, 0.85, stone6);
      add("forge-lintel", 1, 0.28, 0.52, 1.01, 1.05, 0.7, 0.2, stone6);
      add("cold-hearth", 3, 0.56, 0.52, 0.16, 0.49, 0.7, 0.16, "#4e514b");
      add("chimney", 3, 0.55, 0.28, 1.21, 0.5, 0.5, roofY - 0.41, stone6, true);
      add("chimney-cap", 3, 0.49, 0.22, roofY + 0.8, 0.62, 0.62, 0.12, "#73786d");
      add("anvil-base", 3, 1.7, 1.7, 0.16, 0.5, 0.45, 0.34, wood6);
      add("anvil-neck", 3, 1.83, 1.8, 0.5, 0.23, 0.25, 0.2, "#76817d");
      add("anvil-face", 3, 1.6, 1.71, 0.7, 0.7, 0.43, 0.12, "#a0aaa5");
      add("bellows", 3, 1.34, 0.56, 0.16, 0.65, 0.5, 0.25, "#927052");
      add("coal-bin", 3, 0.25, 2.14, 0.16, 0.65, 0.42, 0.22, "#665940");
      for (let i = 0; i < 3; i++) add(`coal-${i}`, 3, 0.31 + i * 0.17, 2.21, 0.38, 0.13, 0.22, 0.1, "#424944");
      if (age >= 2) {
        add("quench-trough", 3, 1.2, 1.26, 0.16, 0.7, 0.36, 0.24, wood6);
        add("quench-water", 3, 1.26, 1.32, 0.4, 0.58, 0.24, 0.02, water2);
      }
      if (age >= 3) add("side-wall", 1, 2.4, 0.28, 0.16, 0.16, 1.5, 0.8, stone6, true);
      if (age === 4) {
        add("race-channel", 1, 2.58, 0.62, 0.16, 0.26, 0.82, 0.08, wood6);
        add("race-water", 1, 2.6, 0.64, 0.24, 0.22, 0.78, 0.04, water2);
        add("wheel-axle", 3, 2.56, 1.02, 0.66, 0.06, 0.08, 0.08, wood6);
        add("wheel-paddle-vertical", 3, 2.62, 0.98, 0.28, 0.12, 0.16, 0.8, wood6);
        add("wheel-paddle-horizontal", 3, 2.62, 0.68, 0.6, 0.12, 0.76, 0.16, wood6);
        add("wheel-hub", 3, 2.6, 0.94, 0.56, 0.16, 0.24, 0.24, "#76817d");
      }
    }
  }
  add("marker-pole", 4, 2.65, 2.7, 0.16, 0.06, 0.06, kind === "farm" ? 0.65 : height + 0.6, wood6);
  add("marker-flag", 4, 2.34, 2.7, kind === "farm" ? 0.61 : height + 0.44, 0.32, 0.05, 0.22, team2);
  if (v.health === 0) return [p[0], ...Array.from({ length: 12 }, (_, i) => ({ id: `debris-${i}`, phase: 0, x: 0.2 + i % 4 * 0.6, z: 0.2 + Math.floor(i / 4) * 0.7, y: 0.16, w: 0.34, d: 0.3, h: 0.12, color: wood6, studs: false }))];
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
var slate2 = "#5d6670";
var tar2 = "#4a3d30";
var carved2 = "#6e5438";
var lime2 = "#e9e1cf";
var sand3 = "#d8c9a6";
var tile2 = "#3f4a4c";
var gilt4 = "#c9a55a";
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
      const stack = style === "eastasia" ? [{ x: cx, z: cz, y: top, w: c, d: c, h: 0.08, color: under.color }, { x: ox, z: oz, y: top + 0.08, w: 0.1, d: 0.1, h: 0.18, color: under.color }] : style === "west" ? [{ x: cx, z: cz, y: top, w: c, d: c, h: 0.3, color: slate2 }, { x: cx + 0.05, z: cz + 0.05, y: top + 0.3, w: 0.06, d: 0.06, h: 0.2, color: slate2 }] : style === "central" ? [{ x: cx + 0.02, z: cz + 0.02, y: top, w: 0.12, d: 0.12, h: 0.44, color: tar2 }, { x: ox, z: oz, y: top + 0.44, w: 0.1, d: 0.1, h: 0.12, color: carved2 }] : [{ x: cx, z: cz, y: top, w: c, d: c, h: 0.18, color: lime2 }, { x: cx + 0.04, z: cz + 0.04, y: top + 0.18, w: 0.08, d: 0.08, h: 0.1, color: lime2 }];
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
      stack = [sq(b, top, 0.2, slate2), sq(b * 0.66, top + 0.2, 0.28, slate2), sq(b * 0.33, top + 0.48, 0.36, slate2), sq(0.06, top + 0.84, 0.26, gilt4)];
    } else if (style === "mideast") {
      const b = Math.min(0.7 * s, 0.7);
      stack = [sq(b, top, 0.16, sand3), sq(b * 0.9, top + 0.16, 0.18, lime2), sq(b * 0.72, top + 0.34, 0.14, lime2), sq(b * 0.48, top + 0.48, 0.12, lime2), sq(b * 0.24, top + 0.6, 0.08, lime2), sq(0.06, top + 0.68, 0.26, gilt4)];
    } else if (style === "eastasia") {
      const e = 0.1, px0 = Math.max(x0, crown.x - e), px1 = Math.min(x1, crown.x + crown.w + e), pz0 = Math.max(z0, crown.z - e), pz1 = Math.min(z1, crown.z + crown.d + e), t = 0.1;
      stack = [{ x: px0, z: pz0, y: top, w: px1 - px0, d: pz1 - pz0, h: 0.08, color: tile2 }, ...[[px0, pz0], [px1 - t, pz0], [px0, pz1 - t], [px1 - t, pz1 - t]].map(([x, z]) => ({ x, z, y: top + 0.08, w: t, d: t, h: 0.16, color: tile2 })), sq(Math.min(0.6 * s, 0.6), top + 0.08, 0.2, tile2), sq(Math.min(0.3 * s, 0.3), top + 0.28, 0.12, tile2), sq(0.1, top + 0.4, 0.2, gilt4)];
    } else {
      const alongX = crown.w >= crown.d, L = alongX ? crown.w : crown.d, r = Math.max(0.1, Math.min(0.4 * L, 0.5 * L - 0.12));
      const bar2 = (a0, a1, y, h, t, color) => alongX ? { x: cx + a0, z: cz - t / 2, y, w: a1 - a0, d: t, h, color } : { x: cx - t / 2, z: cz + a0, y, w: t, d: a1 - a0, h, color };
      stack = [bar2(-r, r, top, 0.1, 0.12, tar2), bar2(-r, -r + 0.1, top + 0.1, 0.5, 0.1, tar2), bar2(r - 0.1, r, top + 0.1, 0.5, 0.1, tar2), bar2(-r - 0.12, -r + 0.1, top + 0.6, 0.12, 0.1, carved2), bar2(r - 0.1, r + 0.12, top + 0.6, 0.12, 0.1, carved2)];
    }
    place(`crown-${k}`, crown.phase, stack);
  });
  return out;
}

// packages/content/civs.ts
var mulKinds = ["bonusScale", "garrisonHeal", "setup", "hp", "cooldown", "speed", "cost", "time", "buildingHp", "arrowCooldown", "healRange", "healRate"];
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
    missing: ["crop-rotation", "stone-shaft-mining", "redemption", "atonement", "heresy", "hussar", "paladin", "camel", "heavy-camel", "siege-ram", "siege-onager", "treadmill-crane", "bloodlines", "thumb-ring", "parthian-tactics", "hand-cannoneer", "bombard-cannon", "elite-cannon-galleon", "bombard-tower"],
    missingLater: ["missionary"],
    uniqueUnits: ["longbowman"],
    eliteUpgrades: ["elite-longbowman"],
    uniqueTechs: [{ id: "yeomen", name: "\u7FA9\u52C7\u9A0E\u5175", nameEn: "Yeomen", age: 3, effectText: "\u5F92\u6B65\u5F13\u5175\u5C04\u7A0B +1\uFF0C\u7BAD\u5854\u653B\u64CA +2" }, { id: "warwolf", name: "\u6230\u72FC\u865F", nameEn: "Warwolf", age: 4, effectText: "\u5DE8\u578B\u6295\u77F3\u6A5F\u7372\u5F97\u7BC4\u570D\u50B7\u5BB3" }],
    effects: [
      fx("britons.archer-range", "range", footArchers, [0, 0, 50, 100], "\u5F92\u6B65\u5F13\u5175\uFF08\u6563\u5175\u9664\u5916\uFF09\u5C04\u7A0B\uFF1A\u7B2C\u4E09\u6642\u4EE3 +1\u3001\u7B2C\u56DB\u6642\u4EE3 +2"),
      fx("britons.tc-wood", "cost", { entries: ["town-center"] }, [1, 1, 0.5, 0.5], "\u7B2C\u4E09\u6642\u4EE3\u8D77\u57CE\u93AE\u4E2D\u5FC3\u6728\u6750 -50%", { resource: "wood" }),
      fx("britons.shepherds", "gather", { sources: ["livestock"] }, 25, "\u7267\u7F8A\uFF08\u5BB0\u7F8A\u63A1\u96C6\uFF09\u901F\u5EA6 +25%"),
      fx("britons.team-range", "workRate", { buildings: ["archery-range"] }, 20, "\u5718\u968A\u52A0\u6210\uFF1A\u9776\u5834\u751F\u7522\u901F\u5EA6 +20%", { team: true }),
      fx("britons.yeomen-range", "range", { classes: ["archer"], exclude: ["gunpowder", "cavalry-archer"] }, 50, "\u7FA9\u52C7\u9A0E\u5175\uFF1A\u5F92\u6B65\u5F13\u5175\uFF08\u542B\u6563\u5175\uFF09\u5C04\u7A0B +1", { tech: "yeomen" }),
      fx("britons.yeomen-tower", "arrowDamage", { buildings: ["watch-tower"] }, 2, "\u7FA9\u52C7\u9A0E\u5175\uFF1A\u7BAD\u5854\u653B\u64CA +2", { tech: "yeomen" }),
      fx("britons.warwolf", "blast", { kinds: ["trebuchet"] }, 75, "\u6230\u72FC\u865F\uFF1A\u5DE8\u578B\u6295\u77F3\u6A5F\u7684\u77F3\u5F48\u6CE2\u53CA\u843D\u9EDE\u5468\u570D\u7684\u6575\u5175", { tech: "warwolf" })
    ],
    omitted: [{ text: "\u6230\u72FC\u865F\u5C0D\u975C\u6B62\u55AE\u4F4D 100% \u547D\u4E2D", reason: "\u672C\u4F5C\u7684\u5DE8\u578B\u6295\u77F3\u6A5F\u53EA\u6253\u5EFA\u7BC9\uFF0C\u4E5F\u6C92\u6709\u547D\u4E2D\u7387" }],
    sources: [site("civs/Britons"), site("units/Longbowman"), site("techs/Yeomen"), site("techs/Warwolf"), site("tree/bri")]
  },
  {
    id: "celts",
    name: "\u585E\u723E\u7279",
    nameEn: "Celts",
    type: "\u6B65\u5175\u8207\u653B\u57CE\u5668\u6587\u660E",
    architecture: "west",
    missing: ["two-man-saw", "crop-rotation", "bracer", "ring-archer-armor", "plate-barding-armor", "redemption", "atonement", "illumination", "block-printing", "theocracy", "arbalest", "camel", "heavy-camel", "architecture", "bloodlines", "thumb-ring", "parthian-tactics", "squires", "hand-cannoneer", "bombard-cannon", "bombard-tower", "elite-cannon-galleon", "fast-fire-ship"],
    missingLater: ["missionary"],
    uniqueUnits: ["woad-raider"],
    eliteUpgrades: ["elite-woad-raider"],
    uniqueTechs: [{ id: "stronghold", name: "\u5821\u58D8", nameEn: "Stronghold", age: 3, effectText: "\u57CE\u5821\u8207\u7BAD\u5854\u5C04\u901F +25%" }, { id: "furor-celtica", name: "\u585E\u723E\u7279\u72C2\u71B1", nameEn: "Furor Celtica", age: 4, effectText: "\u653B\u57CE\u5668\u5DE5\u574A\u7684\u55AE\u4F4D\u751F\u547D +40%" }],
    effects: [
      fx("celts.lumberjacks", "gather", { resources: ["wood"] }, 15, "\u4F10\u6728\u901F\u5EA6 +15%"),
      fx("celts.infantry-speed", "speed", infantry, [1, 1.15, 1.15, 1.15], "\u7B2C\u4E8C\u6642\u4EE3\u8D77\u6B65\u5175\u79FB\u52D5\u901F\u5EA6 +15%\uFF08\u672C\u4F5C\u4EE5\u6BCF tick \u6574\u6578\u6B65\u9577\u63DB\u7B97\uFF0C\u5BE6\u969B\u7D04 +11%\uFF09"),
      fx("celts.siege-rate", "cooldown", { classes: ["siege"] }, 1 / 1.25, "\u653B\u57CE\u5668\u653B\u64CA\u901F\u5EA6 +25%"),
      fx("celts.team-siege", "workRate", { buildings: ["siege-workshop"] }, 20, "\u5718\u968A\u52A0\u6210\uFF1A\u653B\u57CE\u5668\u5DE5\u574A\u751F\u7522\u901F\u5EA6 +20%", { team: true }),
      fx("celts.stronghold", "arrowCooldown", { buildings: ["castle", "watch-tower"] }, 1 / 1.25, "\u5821\u58D8\uFF1A\u57CE\u5821\u8207\u7BAD\u5854\u5C04\u901F +25%", { tech: "stronghold" }),
      fx("celts.furor", "hp", { kinds: ["ram", "mangonel", "scorpion", "bombard-cannon"] }, 1.4, "\u585E\u723E\u7279\u72C2\u71B1\uFF1A\u653B\u57CE\u5668\u751F\u547D +40%", { tech: "furor-celtica" })
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
    missing: ["two-man-saw", "stone-shaft-mining", "bracer", "ring-archer-armor", "redemption", "arbalest", "hussar", "camel", "heavy-camel", "siege-ram", "siege-onager", "keep", "bloodlines", "thumb-ring", "parthian-tactics", "sappers", "bombard-tower", "heated-shot", "shipwright", "elite-cannon-galleon", "guilds"],
    missingLater: ["missionary"],
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
    missing: ["gold-shaft-mining", "plate-mail-armor", "plate-barding-armor", "redemption", "atonement", "heresy", "block-printing", "arbalest", "paladin", "camel", "heavy-camel", "siege-ram", "siege-onager", "siege-engineers", "guard-tower", "keep", "treadmill-crane", "arrowslits", "thumb-ring", "parthian-tactics", "arson", "hoardings", "bombard-tower", "elite-cannon-galleon", "dry-dock", "fortified-wall"],
    missingLater: ["missionary"],
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
    missing: ["bracer", "light-cavalry", "gold-shaft-mining", "arbalest", "heavy-cavalry-archer", "hussar", "camel", "heavy-camel", "siege-ram", "architecture", "husbandry", "thumb-ring", "parthian-tactics", "sappers", "shipwright", "elite-cannon-galleon", "dry-dock"],
    missingLater: [],
    uniqueUnits: ["teutonic-knight"],
    eliteUpgrades: ["elite-teutonic-knight"],
    uniqueTechs: [{ id: "ironclad", name: "\u92FC\u9435\u7532", nameEn: "Ironclad", age: 3, effectText: "\u653B\u57CE\u5668\u8FD1\u6230\u8B77\u7532 +4" }, { id: "crenellations", name: "\u7832\u9580\u579B\u53E3", nameEn: "Crenellations", age: 4, effectText: "\u57CE\u5821\u5C04\u7A0B +3\uFF0C\u9032\u99D0\u7684\u6B65\u5175\u4E5F\u6703\u5C04\u7BAD" }],
    effects: [
      fx("teutons.heal-range", "healRange", {}, 2, "\u50E7\u4FB6\u6CBB\u7642\u8DDD\u96E2\u5169\u500D"),
      fx("teutons.tower-garrison", "garrison", { buildings: ["watch-tower"] }, 5, "\u7BAD\u5854\u53EF\u99D0\u7D2E\u5169\u500D\u55AE\u4F4D"),
      fx("teutons.farms", "cost", { entries: ["farm"] }, 0.6, "\u8FB2\u7530\u4FBF\u5B9C 40%"),
      fx("teutons.herbal", "cost", { entries: ["herbal-medicine"] }, 0, "\u8349\u85E5\u6CBB\u7642\u514D\u8CBB"),
      fx("teutons.tc-garrison", "garrison", { buildings: ["town-center"] }, 10, "\u57CE\u93AE\u4E2D\u5FC3\u99D0\u8ECD +10"),
      fx("teutons.melee-armor", "meleeArmor", { kinds: ["militia", "spearman", "scout", "knight"] }, [0, 0, 1, 2], "\u5175\u71DF\u8207\u99AC\u5EC4\u55AE\u4F4D\u8FD1\u6230\u8B77\u7532\uFF1A\u7B2C\u4E09\u6642\u4EE3 +1\u3001\u7B2C\u56DB\u6642\u4EE3 +2"),
      fx("teutons.team-faith", "conversionResist", {}, 1, "\u5718\u968A\u52A0\u6210\uFF1A\u55AE\u4F4D\u8F03\u96E3\u88AB\u8F49\u5316\uFF08\u6BCF\u540D\u50E7\u4FB6\u7684\u5224\u5B9A\u591A\u4E00\u6B21\u5FC5\u5B9A\u5931\u6557\uFF09", { team: true }),
      fx("teutons.ironclad", "meleeArmor", { classes: ["siege"] }, 4, "\u92FC\u9435\u7532\uFF1A\u653B\u57CE\u5668\u8FD1\u6230\u8B77\u7532 +4", { tech: "ironclad" }),
      fx("teutons.crenellations-range", "arrowRange", { buildings: ["castle"] }, 150, "\u7832\u9580\u579B\u53E3\uFF1A\u57CE\u5821\u5C04\u7A0B +3", { tech: "crenellations" }),
      fx("teutons.crenellations-infantry", "garrisonArrows", { buildings: ["castle"], classes: ["infantry"] }, 1, "\u7832\u9580\u579B\u53E3\uFF1A\u9032\u99D0\u57CE\u5821\u7684\u6B65\u5175\u5404\u591A\u4E00\u652F\u7BAD", { tech: "crenellations" })
    ],
    omitted: [{ text: "\u514D\u8CBB\u8FD1\u5C04\u5B54", reason: "\u672C\u4F5C\u7684\u7BAD\u5854\u6C92\u6709\u6700\u8FD1\u5C04\u7A0B\uFF0C\u8FD1\u5C04\u5B54\u6C92\u6709\u4F5C\u7528" }],
    sources: [site("civs/Teutons"), site("units/Teutonic_Knight"), site("techs/Ironclad"), site("techs/Crenellations"), site("tree/teu")]
  },
  {
    id: "vikings",
    name: "\u7DAD\u4EAC",
    nameEn: "Vikings",
    type: "\u6B65\u5175\u8207\u6D77\u8ECD\u6587\u660E",
    architecture: "central",
    missing: ["stone-shaft-mining", "plate-barding-armor", "redemption", "sanctity", "illumination", "theocracy", "halberdier", "heavy-cavalry-archer", "hussar", "paladin", "camel", "heavy-camel", "siege-onager", "keep", "bloodlines", "husbandry", "parthian-tactics", "herbal-medicine", "hand-cannoneer", "bombard-cannon", "bombard-tower", "fire-galley", "fast-fire-ship", "elite-cannon-galleon", "shipwright", "guilds"],
    missingLater: ["missionary"],
    uniqueUnits: ["berserk", "longboat"],
    eliteUpgrades: ["elite-berserk", "elite-longboat"],
    uniqueTechs: [{ id: "chieftains", name: "\u914B\u9577", nameEn: "Chieftains", age: 3, effectText: "\u6B65\u5175\u5C0D\u9A0E\u5175\u653B\u64CA +5" }, { id: "berserkergang", name: "\u72C2\u6230\u58EB\u5E6B", nameEn: "Berserkergang", age: 4, effectText: "\u72C2\u6230\u58EB\u56DE\u8840\u901F\u5EA6\u5169\u500D" }],
    effects: [
      fx("vikings.infantry-hp", "hp", infantry, [1, 1.1, 1.15, 1.2], "\u6B65\u5175\u751F\u547D\uFF1A\u7B2C\u4E8C\u6642\u4EE3 +10%\u3001\u7B2C\u4E09\u6642\u4EE3 +15%\u3001\u7B2C\u56DB\u6642\u4EE3 +20%"),
      fx("vikings.wheelbarrow", "grant", { entries: ["wheelbarrow"] }, 1, "\u5347\u5230\u7B2C\u4E8C\u6642\u4EE3\u6642\u514D\u8CBB\u5F97\u5230\u624B\u63A8\u8ECA", { age: 2 }),
      fx("vikings.hand-cart", "grant", { entries: ["hand-cart"] }, 1, "\u5347\u5230\u7B2C\u4E09\u6642\u4EE3\u6642\u514D\u8CBB\u5F97\u5230\u624B\u62C9\u8ECA", { age: 3 }),
      fx("vikings.chieftains", "bonus", infantry, 5, "\u914B\u9577\uFF1A\u6B65\u5175\u5C0D\u9A0E\u5175\u653B\u64CA +5", { vs: "cavalry", tech: "chieftains" }),
      fx("vikings.chieftains-camel", "bonus", infantry, 4, "\u914B\u9577\uFF1A\u6B65\u5175\u5C0D\u99F1\u99DD\u9A0E\u5175\u653B\u64CA +4", { vs: "camel", tech: "chieftains" }),
      fx("vikings.berserkergang", "regen", { kinds: ["berserk"] }, 20, "\u72C2\u6230\u58EB\u5E6B\uFF1A\u72C2\u6230\u58EB\u6BCF\u5206\u9418\u56DE\u8840 20 \u2192 40", { tech: "berserkergang" }),
      fx("vikings.warships", "cost", { entries: ["galley", "demolition-raft", "cannon-galleon", "longboat"] }, [1, 0.85, 0.85, 0.8], "\u6230\u8239\u4FBF\u5B9C\uFF1A\u7B2C\u4E8C\u3001\u7B2C\u4E09\u6642\u4EE3 -15%\uFF0C\u7B2C\u56DB\u6642\u4EE3 -20%"),
      fx("vikings.team-dock", "cost", { entries: ["dock"] }, 0.85, "\u5718\u968A\u52A0\u6210\uFF1A\u78BC\u982D\u4FBF\u5B9C 15%", { team: true })
    ],
    omitted: [],
    sources: [site("civs/Vikings"), site("units/Berserk"), site("units/Longboat"), site("techs/Chieftains"), site("techs/Berserkergang"), site("tree/vik")]
  },
  {
    id: "byzantines",
    name: "\u62DC\u5360\u5EAD",
    nameEn: "Byzantines",
    type: "\u9632\u79A6\u6587\u660E",
    architecture: "mideast",
    missing: ["masonry", "architecture", "blast-furnace", "siege-onager", "heavy-scorpion", "siege-engineers", "treadmill-crane", "bloodlines", "parthian-tactics", "sappers", "herbal-medicine", "heated-shot", "bombard-tower"],
    missingLater: ["missionary"],
    uniqueUnits: ["cataphract"],
    eliteUpgrades: ["elite-cataphract"],
    uniqueTechs: [{ id: "greek-fire", name: "\u5E0C\u81D8\u4E4B\u706B", nameEn: "Greek Fire", age: 3, effectText: "\u706B\u6230\u8239\u5C04\u7A0B +1" }, { id: "logistica", name: "\u5F8C\u52E4", nameEn: "Logistica", age: 4, effectText: "\u62DC\u5360\u5EAD\u8056\u9A0E\u5175\u8E10\u8E0F\u50B7\u5BB3\uFF0C\u5C0D\u6B65\u5175 +6" }],
    effects: [
      fx("byzantines.building-hp", "buildingHp", {}, [1.1, 1.2, 1.3, 1.4], "\u5EFA\u7BC9\u751F\u547D\uFF1A\u7B2C\u4E00\u81F3\u7B2C\u56DB\u6642\u4EE3 +10% / +20% / +30% / +40%"),
      fx("byzantines.counter-cost", "cost", { entries: ["spearman", "skirmisher", "camel"] }, 0.75, "\u9577\u69CD\u5175\u3001\u6563\u5175\u8207\u99F1\u99DD\u9A0E\u5175\u4FBF\u5B9C 25%"),
      fx("byzantines.town-watch", "cost", { entries: ["town-watch"] }, 0, "\u57CE\u93AE\u77AD\u671B\u514D\u8CBB"),
      fx("byzantines.imperial", "cost", { entries: ["age-4"] }, 0.67, "\u5347\u7B2C\u56DB\u6642\u4EE3\u4FBF\u5B9C 33%"),
      fx("byzantines.team-heal", "healRate", {}, 1.5, "\u5718\u968A\u52A0\u6210\uFF1A\u50E7\u4FB6\u6CBB\u7642\u901F\u5EA6 +50%", { team: true }),
      fx("byzantines.logistica", "bonus", { kinds: ["cataphract"] }, 6, "\u5F8C\u52E4\uFF1A\u62DC\u5360\u5EAD\u8056\u9A0E\u5175\u5C0D\u6B65\u5175 +6", { vs: "infantry", tech: "logistica" }),
      fx("byzantines.trample", "splash", { kinds: ["cataphract"] }, 5, "\u5F8C\u52E4\uFF1A\u62DC\u5360\u5EAD\u8056\u9A0E\u5175\u653B\u64CA\u6642\uFF0C\u76EE\u6A19\u65C1\u7684\u6575\u5175\u53D7 5 \u9EDE\u8E10\u8E0F\u50B7\u5BB3", { tech: "logistica" }),
      fx("byzantines.fire-ships", "cooldown", { kinds: ["fire-galley"] }, 1 / 1.25, "\u706B\u6230\u8239\u7CFB\u653B\u64CA\u901F\u5EA6 +25%"),
      fx("byzantines.greek-fire", "range", { kinds: ["fire-galley"] }, 50, "\u5E0C\u81D8\u4E4B\u706B\uFF1A\u706B\u6230\u8239\u7CFB\u5C04\u7A0B +1", { tech: "greek-fire" })
    ],
    omitted: [],
    sources: [site("civs/Byzantines"), site("units/Cataphract"), site("techs/Greek_Fire"), site("techs/Logistica"), site("tree/byz")]
  },
  {
    id: "persians",
    name: "\u6CE2\u65AF",
    nameEn: "Persians",
    type: "\u9A0E\u5175\u6587\u660E",
    architecture: "mideast",
    missing: ["bracer", "redemption", "atonement", "heresy", "sanctity", "illumination", "two-handed-swordsman", "champion", "arbalest", "siege-onager", "siege-engineers", "keep", "treadmill-crane", "arrowslits", "shipwright", "bombard-tower", "fortified-wall"],
    missingLater: ["missionary"],
    uniqueUnits: ["war-elephant"],
    eliteUpgrades: ["elite-war-elephant"],
    uniqueTechs: [{ id: "kamandaran", name: "\u6CE2\u65AF\u5F13\u5175", nameEn: "Kamandaran", age: 3, effectText: "\u5F13\u624B\u6539\u7528\u6728\u6750\u652F\u4ED8\u539F\u672C\u7684\u9EC3\u91D1" }, { id: "mahouts", name: "\u8C61\u4F15", nameEn: "Mahouts", age: 4, effectText: "\u6230\u8C61\u79FB\u52D5\u901F\u5EA6 +30%" }],
    effects: [
      fx("persians.food", "startStock", {}, 50, "\u958B\u5C40\u98DF\u7269 +50", { resource: "food" }),
      fx("persians.wood", "startStock", {}, 50, "\u958B\u5C40\u6728\u6750 +50", { resource: "wood" }),
      fx("persians.tc-hp", "buildingHp", { buildings: ["town-center", "dock"] }, 2, "\u57CE\u93AE\u4E2D\u5FC3\u8207\u78BC\u982D\u751F\u547D\u5169\u500D"),
      fx("persians.tc-rate", "workRate", { buildings: ["town-center", "dock"] }, [0, 10, 15, 20], "\u57CE\u93AE\u4E2D\u5FC3\u8207\u78BC\u982D\u751F\u7522\u8207\u7814\u7A76\u901F\u5EA6\uFF1A\u7B2C\u4E8C\u81F3\u7B2C\u56DB\u6642\u4EE3 +10% / +15% / +20%"),
      fx("persians.team-knights", "bonus", { kinds: ["knight"] }, 2, "\u5718\u968A\u52A0\u6210\uFF1A\u9A0E\u58EB\u5C0D\u5F13\u5175\u653B\u64CA +2", { vs: "archer", team: true }),
      fx("persians.kamandaran", "costShift", { entries: ["archer"] }, 1, "\u6CE2\u65AF\u5F13\u5175\uFF1A\u5F13\u624B\u7684\u9EC3\u91D1\u6539\u4EE5\u6728\u6750\u652F\u4ED8", { resource: "gold", to: "wood", tech: "kamandaran" }),
      fx("persians.mahouts", "speed", { kinds: ["war-elephant"] }, 1.3, "\u8C61\u4F15\uFF1A\u6230\u8C61\u79FB\u52D5\u901F\u5EA6 +30%", { tech: "mahouts" })
    ],
    omitted: [],
    sources: [site("civs/Persians"), site("units/War_Elephant"), site("techs/Kamandaran"), site("techs/Mahouts"), site("tree/pre")]
  },
  {
    id: "saracens",
    name: "\u85A9\u62C9\u68EE",
    nameEn: "Saracens",
    type: "\u99F1\u99DD\u8207\u6D77\u8ECD\u6587\u660E",
    architecture: "mideast",
    missing: ["crop-rotation", "stone-shaft-mining", "halberdier", "cavalier", "paladin", "heavy-scorpion", "architecture", "sappers", "bombard-tower", "heated-shot", "shipwright", "guilds", "fast-fire-ship"],
    missingLater: ["missionary"],
    uniqueUnits: ["mameluke"],
    eliteUpgrades: ["elite-mameluke"],
    uniqueTechs: [{ id: "madrasah", name: "\u7A46\u65AF\u6797\u5B78\u588A", nameEn: "Madrasah", age: 3, effectText: "\u50E7\u4FB6\u6B7B\u4EA1\u6642\u8FD4\u9084 33 \u9EC3\u91D1" }, { id: "zealotry", name: "\u72C2\u71B1", nameEn: "Zealotry", age: 4, effectText: "\u99F1\u99DD\u9A0E\u5175\u8207\u963F\u62C9\u4F2F\u5974\u96B8\u5175\u751F\u547D +30" }],
    effects: [
      fx("saracens.archer-buildings", "bonus", footArchers, [0, 1, 2, 3], "\u5F13\u5175\u5C0D\u5EFA\u7BC9\u653B\u64CA\uFF1A\u7B2C\u4E8C\u81F3\u7B2C\u56DB\u6642\u4EE3 +1 / +2 / +3", { vs: "building" }),
      fx("saracens.team-archers", "bonus", footArchers, 2, "\u5718\u968A\u52A0\u6210\uFF1A\u5F92\u6B65\u5F13\u5175\u5C0D\u5EFA\u7BC9\u653B\u64CA +2", { vs: "building", team: true }),
      fx("saracens.horse-archer-buildings", "bonus", { classes: ["cavalry-archer"] }, [0, 2, 3, 4], "\u99AC\u5F13\u9A0E\u5175\u5C0D\u5EFA\u7BC9\u653B\u64CA\uFF1A\u7B2C\u4E8C\u81F3\u7B2C\u56DB\u6642\u4EE3 +2 / +3 / +4\uFF08\u5F13\u5175\u7684\u52A0\u6210\u518D +1\uFF09", { vs: "building" }),
      fx("saracens.madrasah", "deathRefund", { kinds: ["monk"] }, 33, "\u7A46\u65AF\u6797\u5B78\u588A\uFF1A\u50E7\u4FB6\u6B7B\u4EA1\u6642\u8FD4\u9084 33 \u9EC3\u91D1", { tech: "madrasah" }),
      fx("saracens.zealotry", "hp", { kinds: ["mameluke", "camel"] }, 30, "\u72C2\u71B1\uFF1A\u99F1\u99DD\u9A0E\u5175\u8207\u963F\u62C9\u4F2F\u5974\u96B8\u5175\u751F\u547D +30", { tech: "zealotry", op: "add" }),
      fx("saracens.market-fee", "marketFee", {}, -25, "\u5E02\u96C6\u4EA4\u6613\u8CBB 5%\uFF08\u4E00\u822C 30%\uFF09"),
      fx("saracens.market-cost", "cost", { entries: ["market"] }, 100 / 175, "\u5E02\u96C6\u4FBF\u5B9C 75 \u6728\u6750", { resource: "wood" }),
      fx("saracens.transport-hp", "hp", { kinds: ["transport-ship"] }, 2, "\u904B\u8F38\u8239\u751F\u547D\u5169\u500D"),
      fx("saracens.transport-capacity", "transportCapacity", { kinds: ["transport-ship"] }, 5, "\u904B\u8F38\u8239\u904B\u8F09 +5"),
      fx("saracens.galleys", "cooldown", { classes: ["galley"] }, 1 / 1.25, "\u6230\u8239\u7CFB\u653B\u64CA\u901F\u5EA6 +25%")
    ],
    omitted: [],
    sources: [site("civs/Saracens"), site("units/Mameluke"), site("techs/Madrasah"), site("techs/Zealotry"), site("tree/sar")]
  },
  {
    id: "turks",
    name: "\u571F\u8033\u5176",
    nameEn: "Turks",
    type: "\u706B\u85E5\u6587\u660E",
    architecture: "mideast",
    missing: ["pikeman", "elite-skirmisher", "stone-shaft-mining", "faith", "illumination", "halberdier", "arbalest", "paladin", "onager", "siege-onager", "siege-engineers", "herbal-medicine", "shipwright", "fast-fire-ship"],
    missingLater: [],
    uniqueUnits: ["janissary"],
    eliteUpgrades: ["elite-janissary"],
    uniqueTechs: [{ id: "sipahi", name: "\u91C7\u9091\u9A0E\u5175", nameEn: "Sipahi", age: 3, effectText: "\u99AC\u5F13\u9A0E\u5175\u8207\u6A19\u69CD\u9A0E\u5175\u751F\u547D +20" }, { id: "artillery", name: "\u7832\u5175", nameEn: "Artillery", age: 4, effectText: "\u706B\u7832\u3001\u706B\u7832\u5854\u3001\u706B\u7832\u6230\u8239\u5C04\u7A0B +2" }],
    effects: [
      fx("turks.gunpowder-hp", "hp", { classes: ["gunpowder"] }, 1.25, "\u706B\u85E5\u55AE\u4F4D\u751F\u547D +25%"),
      fx("turks.gold", "gather", { resources: ["gold"] }, 20, "\u63A1\u91D1\u901F\u5EA6 +20%"),
      fx("turks.free-light-cavalry", "cost", { entries: ["light-cavalry", "hussar"] }, 0, "\u65A5\u5019\u7CFB\u5347\u7D1A\u514D\u8CBB"),
      fx("turks.sipahi", "hp", { classes: ["cavalry-archer"] }, 20, "\u91C7\u9091\u9A0E\u5175\uFF1A\u99AC\u5F13\u9A0E\u5175\u751F\u547D +20", { tech: "sipahi", op: "add" }),
      fx("turks.scout-armor", "pierceArmor", { kinds: ["scout"] }, 1, "\u65A5\u5019\u7CFB\u9060\u7A0B\u8B77\u7532 +1"),
      fx("turks.chemistry", "cost", { entries: ["chemistry"] }, 0, "\u5316\u5B78\u514D\u8CBB"),
      fx("turks.artillery", "range", { kinds: ["bombard-cannon", "cannon-galleon"] }, 100, "\u7832\u5175\uFF1A\u706B\u7832\u8207\u706B\u7832\u6230\u8239\u5C04\u7A0B +2", { tech: "artillery" }),
      fx("turks.artillery-tower", "arrowRange", { buildings: ["bombard-tower"] }, 100, "\u7832\u5175\uFF1A\u706B\u7832\u5854\u5C04\u7A0B +2", { tech: "artillery" }),
      fx("turks.gunpowder-techs", "cost", { entries: ["elite-cannon-galleon", "bombard-tower-tech"] }, 0.5, "\u706B\u85E5\u79D1\u6280\u4FBF\u5B9C 50%\uFF08\u7CBE\u92B3\u706B\u7832\u6230\u8239\u3001\u706B\u7832\u5854\uFF1B\u5316\u5B78\u53E6\u5916\u514D\u8CBB\uFF09"),
      fx("turks.team-gunpowder", "time", { entries: ["janissary", "hand-cannoneer", "bombard-cannon", "cannon-galleon"] }, 1 / 1.25, "\u5718\u968A\u52A0\u6210\uFF1A\u706B\u85E5\u55AE\u4F4D\u8A13\u7DF4\u901F\u5EA6 +25%", { team: true })
    ],
    omitted: [],
    sources: [site("civs/Turks"), site("units/Janissary"), site("techs/Sipahi"), site("techs/Artillery"), site("tree/tur")]
  },
  {
    id: "chinese",
    name: "\u4E2D\u570B",
    nameEn: "Chinese",
    type: "\u5F13\u5175\u6587\u660E",
    architecture: "eastasia",
    missing: ["crop-rotation", "redemption", "heresy", "hussar", "paladin", "siege-onager", "siege-engineers", "parthian-tactics", "hoardings", "hand-cannoneer", "bombard-cannon", "guilds", "fast-fire-ship", "elite-cannon-galleon"],
    missingLater: [],
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
      fx("chinese.great-wall", "buildingHp", { buildings: ["watch-tower", "palisade-wall", "stone-wall", "palisade-gate", "gate"] }, 1.3, "\u9577\u57CE\uFF1A\u7BAD\u5854\u8207\u57CE\u7246\uFF08\u542B\u57CE\u9580\uFF09\u751F\u547D +30%", { tech: "great-wall" }),
      fx("chinese.demolition-hp", "hp", { kinds: ["demolition-raft"] }, 1.5, "\u7206\u7834\u8239\u7CFB\u751F\u547D +50%"),
      fx("chinese.rocketry", "attack", { kinds: ["chu-ko-nu"] }, 2, "\u706B\u7BAD\u6280\u8853\uFF1A\u9023\u5F29\u5175\u653B\u64CA +2", { tech: "rocketry" }),
      fx("chinese.rocketry-scorpion", "attack", { kinds: ["scorpion"] }, 4, "\u706B\u7BAD\u6280\u8853\uFF1A\u5F29\u7832\u653B\u64CA +4", { tech: "rocketry" })
    ],
    omitted: [],
    sources: [site("civs/Chinese"), site("units/Chu_Ko_Nu"), site("techs/Great_Wall"), site("techs/Rocketry"), site("tree/chi")]
  },
  {
    id: "japanese",
    name: "\u65E5\u672C",
    nameEn: "Japanese",
    type: "\u6B65\u5175\u6587\u660E",
    architecture: "eastasia",
    missing: ["crop-rotation", "stone-shaft-mining", "plate-barding-armor", "heresy", "paladin", "camel", "heavy-camel", "siege-ram", "siege-onager", "architecture", "hoardings", "bombard-cannon", "bombard-tower", "heated-shot", "guilds", "heavy-demolition-ship"],
    missingLater: ["missionary"],
    uniqueUnits: ["samurai"],
    eliteUpgrades: ["elite-samurai"],
    uniqueTechs: [{ id: "yasama", name: "\u5C04\u7BAD\u5B54", nameEn: "Yasama", age: 3, effectText: "\u7BAD\u5854\u591A\u5C04\u5169\u652F\u7BAD" }, { id: "kataparuto", name: "\u5F48\u5C04\u5668", nameEn: "Kataparuto", age: 4, effectText: "\u5DE8\u578B\u6295\u77F3\u6A5F\u7D44\u88DD\u8207\u5C04\u901F\u63D0\u5347" }],
    effects: [
      fx("japanese.camps", "cost", { entries: ["lumber-camp", "mining-camp", "mill"] }, 0.5, "\u4F10\u6728\u5834\u3001\u63A1\u7926\u5834\u3001\u78E8\u574A\u4FBF\u5B9C 50%"),
      fx("japanese.infantry-rate", "cooldown", infantry, [1, 0.9, 0.85, 0.75], "\u6B65\u5175\u653B\u64CA\u901F\u5EA6\uFF1A\u7B2C\u4E8C\u81F3\u7B2C\u56DB\u6642\u4EE3 +10% / +15% / +25%"),
      fx("japanese.kataparuto-setup", "setup", { kinds: ["trebuchet"] }, 0.25, "\u5F48\u5C04\u5668\uFF1A\u5DE8\u578B\u6295\u77F3\u6A5F\u7D44\u88DD\u8207\u62C6\u88DD\u5FEB 4 \u500D", { tech: "kataparuto" }),
      fx("japanese.kataparuto-rate", "cooldown", { kinds: ["trebuchet"] }, 0.75, "\u5F48\u5C04\u5668\uFF1A\u5DE8\u578B\u6295\u77F3\u6A5F\u5C04\u901F +33%", { tech: "kataparuto" }),
      fx("japanese.yasama", "arrows", { buildings: ["watch-tower"] }, 2, "\u5C04\u7BAD\u5B54\uFF1A\u7BAD\u5854\u591A\u5C04\u5169\u652F\u7BAD", { tech: "yasama" }),
      fx("japanese.fishing-hp", "hp", { kinds: ["fishing-ship"] }, 2, "\u6F01\u8239\u751F\u547D\u5169\u500D"),
      fx("japanese.fishing-armor", "pierceArmor", { kinds: ["fishing-ship"] }, 2, "\u6F01\u8239\u9060\u7A0B\u8B77\u7532 +2"),
      fx("japanese.fishing-rate", "gather", { kinds: ["fishing-ship"], sources: ["fish", "fish-trap"] }, [5, 10, 15, 20], "\u6F01\u8239\u5DE5\u4F5C\u901F\u5EA6\uFF1A\u7B2C\u4E00\u81F3\u7B2C\u56DB\u6642\u4EE3 +5% / +10% / +15% / +20%"),
      fx("japanese.team-galley-los", "los", { classes: ["warship"] }, 200, "\u5718\u968A\u52A0\u6210\uFF1A\u6230\u8239\u8996\u91CE +50%", { team: true })
    ],
    omitted: [],
    sources: [site("civs/Japanese"), site("units/Samurai"), site("techs/Yasama"), site("techs/Kataparuto"), site("tree/jap")]
  },
  {
    id: "mongols",
    name: "\u8499\u53E4",
    nameEn: "Mongols",
    type: "\u99AC\u5F13\u9A0E\u5175\u6587\u660E",
    architecture: "eastasia",
    missing: ["halberdier", "two-man-saw", "crop-rotation", "plate-barding-armor", "ring-archer-armor", "redemption", "sanctity", "faith", "block-printing", "paladin", "architecture", "keep", "treadmill-crane", "arrowslits", "bombard-cannon", "bombard-tower", "elite-cannon-galleon", "heated-shot", "guilds", "dry-dock"],
    missingLater: [],
    uniqueUnits: ["mangudai"],
    eliteUpgrades: ["elite-mangudai"],
    uniqueTechs: [{ id: "nomads", name: "\u6E38\u7267", nameEn: "Nomads", age: 3, effectText: "\u6C11\u5C45\u88AB\u6467\u6BC0\u5F8C\u4EBA\u53E3\u4E0A\u9650\u4E0D\u4E0B\u964D" }, { id: "drill", name: "\u947F\u5CA9\u6A5F", nameEn: "Drill", age: 4, effectText: "\u653B\u57CE\u5668\u5DE5\u574A\u7684\u55AE\u4F4D\u79FB\u52D5\u901F\u5EA6 +50%" }],
    effects: [
      fx("mongols.horse-archers", "cooldown", { classes: ["cavalry-archer"] }, 1 / 1.2, "\u99AC\u5F13\u9A0E\u5175\u5C04\u901F +20%"),
      fx("mongols.light-cavalry", "hp", { kinds: ["scout"] }, 1.3, "\u8F15\u9A0E\u5175\u751F\u547D +30%", { tech: "light-cavalry" }),
      fx("mongols.hunters", "gather", { sources: ["hunt"] }, 40, "\u6253\u7375\u901F\u5EA6 +40%"),
      fx("mongols.team-scouts", "los", { kinds: ["scout"] }, 200, "\u5718\u968A\u52A0\u6210\uFF1A\u65A5\u5019\u8996\u91CE +2", { team: true }),
      fx("mongols.nomads", "keepHousing", { buildings: ["house"] }, 1, "\u6E38\u7267\uFF1A\u6C11\u5C45\u88AB\u6467\u6BC0\u5F8C\u4EBA\u53E3\u4E0A\u9650\u4E0D\u4E0B\u964D", { tech: "nomads" }),
      fx("mongols.drill", "speed", { kinds: ["ram", "mangonel", "scorpion", "bombard-cannon"] }, 1.5, "\u947F\u5CA9\u6A5F\uFF1A\u653B\u57CE\u5668\u79FB\u52D5\u901F\u5EA6 +50%", { tech: "drill" })
    ],
    omitted: [],
    sources: [site("civs/Mongols"), site("units/Mangudai"), site("techs/Nomads"), site("techs/Drill"), site("tree/mon")]
  }
];
var uniqueUnitOwner = Object.fromEntries(civDefs.flatMap((c) => [...c.uniqueUnits, ...c.eliteUpgrades, ...c.uniqueTechs.map((t) => t.id)].map((id) => [id, c.id])));
var civById = (id) => civDefs.find((c) => c.id === id);

// packages/sim/terrain.ts
var terrainRules = { provenance: "design_default", size: 16, tileSize: 100, maxLandStep: 25, resourceCapacity: { tree: 300, stone: 250, gold: 250, berries: 150, hunt: 120, livestock: 100, fish: 200, farm: 250, "fish-trap": 1e3 }, generationAttempts: 8 };
var resourceDefinitions = {
  tree: { yield: "wood", method: "gather", movement: "land" },
  stone: { yield: "stone", method: "gather", movement: "land" },
  gold: { yield: "gold", method: "gather", movement: "land" },
  berries: { yield: "food", method: "gather", movement: "land" },
  hunt: { yield: "food", method: "hunt", movement: "land" },
  livestock: { yield: "food", method: "herd", movement: "land" },
  fish: { yield: "food", method: "fish", movement: "water" },
  farm: { yield: "food", method: "gather", movement: "land" },
  // A finished fish trap (the 建築 round): owner-only food on the water, worked by fishing ships (site 715 food x this
  // game's farm factor 250/175 -> 1000, design_default).
  "fish-trap": { yield: "food", method: "fish", movement: "water" }
};
var mapSizes = { meadow: 16, coast: 16, acceptance: 16, open: 32, lakes: 32 };
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
    let terrainType = layout !== "open" && layout !== "lakes" && y === 8 ? "road" : "grass";
    if (layout === "coast") {
      const edge = 12 + (seed >>> 0 >>> Math.floor(x / 4) & 1);
      if (y >= edge) terrainType = "water";
      else if (y === edge - 1) terrainType = "sand";
    }
    if (layout === "acceptance") {
      if (x === 7 || x === 8) terrainType = y >= 7 && y <= 9 ? "shallow" : "water";
      else if (x === 6 || x === 9) terrainType = "sand";
    }
    const tile3 = { id, terrainType, ...terrainDefinitions[terrainType], resourceRefs: [], obstacleRefs: [] };
    if (layout === "acceptance") {
      if (x >= 2 && x <= 5 && y >= 11 && y <= 14) {
        tile3.terrainType = x === 2 && y === 11 ? "cliff" : x === 3 && y === 13 ? "stone" : "highland";
        Object.assign(tile3, terrainDefinitions[tile3.terrainType]);
        tile3.height = 100;
      }
      if (x === 4 && y >= 8 && y <= 10) {
        tile3.terrainType = "road";
        tile3.height = (y - 7) * 25;
        tile3.buildability = false;
      }
    }
    return tile3;
  });
}
var sizeOfTiles = (tiles) => Math.round(Math.sqrt(tiles.length));
function groundHeight(tiles, x, y) {
  return tiles[tileAt(x, y, sizeOfTiles(tiles))]?.height ?? 0;
}
function tileAt(x, y, size) {
  return Math.floor(y / 100) * size + Math.floor(x / 100);
}
function canTraverse(tile3, movement) {
  return tile3.walkClass === movement || tile3.walkClass === "both";
}

// packages/content/rules.ts
var entry = (id, kind, name, food = 0, wood6 = 0, gold4 = 0, stone6 = 0, requires = [], population = 0, time = 20, source = "original design defaults: packages/content/rules.ts") => ({ referenceVersion: null, sourceEvidence: [source], implementationStatus: id === "villager" ? "in_progress" : "not_started", testEvidence: ["tests/foundation.test.ts (data validation only)"], id, kind, name, cost: { food, wood: wood6, gold: gold4, stone: stone6 }, time, population, requires, verificationStatus: "design_default" });
var aoetw = "aoetw.com via github.com/webrsb/aoetw (2026-09-30), design_default in this ruleset";
var unique = (id, name, food, wood6, gold4, time) => entry(id, "unit", name, food, wood6, gold4, 0, [], 1, time, aoetw);
var upgrade = (id, name, food, wood6, gold4, stone6, age, time) => entry(id, "technology", name, food, wood6, gold4, stone6, [`age-${age}`], 0, time, aoetw);
var castleEntries = [
  entry("castle", "building", "\u57CE\u5821", 0, 0, 0, 300, ["age-3"], 0, 60, "aoetw.com/building/Castle (650 stone there); 300 stone and 60 s are design_default for this map"),
  unique("longbowman", "\u9577\u5F13\u5175", 0, 35, 40, 18),
  unique("woad-raider", "\u83D8\u85CD\u6B66\u58EB", 65, 0, 25, 10),
  unique("throwing-axeman", "\u64F2\u65A7\u5175", 55, 0, 25, 17),
  unique("huskarl", "\u54E5\u5FB7\u885B\u968A", 80, 0, 40, 16),
  unique("teutonic-knight", "\u689D\u9813\u6B66\u58EB", 85, 0, 40, 12),
  unique("berserk", "\u72C2\u6230\u58EB", 65, 0, 25, 14),
  unique("cataphract", "\u62DC\u5360\u5EAD\u8056\u9A0E\u5175", 70, 0, 75, 20),
  unique("war-elephant", "\u6230\u8C61", 200, 0, 75, 31),
  unique("mameluke", "\u963F\u62C9\u4F2F\u5974\u96B8\u5175", 55, 0, 85, 23),
  unique("janissary", "\u571F\u8033\u5176\u706B\u69CD\u5175", 60, 0, 55, 17),
  unique("chu-ko-nu", "\u9023\u5F29\u5175", 0, 40, 35, 16),
  unique("samurai", "\u65E5\u672C\u6B66\u58EB", 60, 0, 30, 9),
  unique("mangudai", "\u8499\u53E4\u7A81\u9A0E", 0, 55, 65, 26),
  upgrade("elite-longbowman", "\u7CBE\u92B3\u9577\u5F13\u5175", 850, 0, 850, 0, 4, 60),
  upgrade("elite-woad-raider", "\u7CBE\u92B3\u83D8\u85CD\u6B66\u58EB", 1e3, 0, 800, 0, 4, 45),
  upgrade("elite-throwing-axeman", "\u7CBE\u92B3\u64F2\u65A7\u5175", 1e3, 0, 750, 0, 4, 45),
  upgrade("elite-huskarl", "\u7CBE\u92B3\u54E5\u5FB7\u885B\u968A", 1200, 0, 550, 0, 4, 40),
  upgrade("elite-teutonic-knight", "\u7CBE\u92B3\u689D\u9813\u6B66\u58EB", 1200, 0, 600, 0, 4, 50),
  upgrade("elite-berserk", "\u7CBE\u92B3\u72C2\u6230\u58EB", 1300, 0, 550, 0, 4, 45),
  upgrade("elite-cataphract", "\u7CBE\u92B3\u62DC\u5360\u5EAD\u8056\u9A0E\u5175", 1600, 0, 800, 0, 4, 50),
  upgrade("elite-war-elephant", "\u7CBE\u92B3\u6230\u8C61", 1600, 0, 1200, 0, 4, 75),
  upgrade("elite-mameluke", "\u7CBE\u92B3\u963F\u62C9\u4F2F\u5974\u96B8\u5175", 600, 0, 500, 0, 4, 50),
  upgrade("elite-janissary", "\u7CBE\u92B3\u571F\u8033\u5176\u706B\u69CD\u5175", 850, 0, 750, 0, 4, 55),
  upgrade("elite-chu-ko-nu", "\u7CBE\u92B3\u9023\u5F29\u5175", 950, 0, 950, 0, 4, 50),
  upgrade("elite-samurai", "\u7CBE\u92B3\u65E5\u672C\u6B66\u58EB", 950, 0, 875, 0, 4, 60),
  upgrade("elite-mangudai", "\u7CBE\u92B3\u8499\u53E4\u7A81\u9A0E", 1100, 0, 675, 0, 4, 50),
  upgrade("yeomen", "\u7FA9\u52C7\u9A0E\u5175", 0, 750, 450, 0, 3, 60),
  upgrade("stronghold", "\u5821\u58D8", 250, 0, 200, 0, 3, 30),
  upgrade("furor-celtica", "\u585E\u723E\u7279\u72C2\u71B1", 750, 0, 450, 0, 4, 50),
  upgrade("chivalry", "\u9A0E\u58EB\u7CBE\u795E", 0, 400, 400, 0, 3, 40),
  upgrade("bearded-axe", "\u5012\u9264\u65A7", 400, 0, 400, 0, 4, 60),
  upgrade("anarchy", "\u7121\u653F\u5E9C\u72C0\u614B", 450, 0, 250, 0, 3, 40),
  upgrade("perfusion", "\u4E95\u5674", 0, 400, 600, 0, 4, 40),
  upgrade("ironclad", "\u92FC\u9435\u7532", 0, 400, 350, 0, 3, 60),
  upgrade("crenellations", "\u7832\u9580\u579B\u53E3", 600, 0, 0, 400, 4, 60),
  upgrade("chieftains", "\u914B\u9577", 700, 0, 500, 0, 3, 40),
  upgrade("berserkergang", "\u72C2\u6230\u58EB\u5E6B", 850, 0, 400, 0, 4, 40),
  upgrade("logistica", "\u5F8C\u52E4", 1e3, 0, 600, 0, 4, 50),
  upgrade("kamandaran", "\u6CE2\u65AF\u5F13\u5175", 400, 0, 300, 0, 3, 40),
  upgrade("mahouts", "\u8C61\u4F15", 300, 0, 300, 0, 4, 50),
  upgrade("madrasah", "\u7A46\u65AF\u6797\u5B78\u588A", 200, 0, 100, 0, 3, 30),
  upgrade("zealotry", "\u72C2\u71B1", 750, 0, 700, 0, 4, 50),
  upgrade("great-wall", "\u9577\u57CE", 0, 400, 0, 200, 3, 40),
  upgrade("rocketry", "\u706B\u7BAD\u6280\u8853", 0, 750, 750, 0, 4, 60),
  upgrade("yasama", "\u5C04\u7BAD\u5B54", 300, 300, 0, 0, 3, 40),
  upgrade("nomads", "\u6E38\u7267", 0, 300, 150, 0, 3, 40),
  upgrade("drill", "\u947F\u5CA9\u6A5F", 500, 0, 450, 0, 4, 60)
];
var unit = (id, name, food, wood6, gold4, age, time) => entry(id, "unit", name, food, wood6, gold4, 0, [`age-${age}`], 1, time, aoetw);
var line = (id, name, food, wood6, gold4, after, time) => entry(id, "technology", name, food, wood6, gold4, 0, after ? ["age-4", after] : ["age-4"], 0, time, aoetw);
var unitEntries = [
  line("two-handed-swordsman", "\u96D9\u624B\u528D\u5175", 300, 0, 100, "long-swordsman", 75),
  line("champion", "\u528D\u5175\u52C7\u58EB", 750, 0, 350, "two-handed-swordsman", 100),
  line("halberdier", "\u621F\u5175", 300, 0, 600, "pikeman", 50),
  line("arbalest", "\u5F37\u5F29\u5175", 350, 0, 300, "crossbowman", 50),
  unit("cavalry-archer", "\u99AC\u5F13\u9A0E\u5175", 0, 40, 60, 3, 34),
  line("heavy-cavalry-archer", "\u91CD\u88DD\u99AC\u5F13\u9A0E\u5175", 900, 0, 500, null, 50),
  line("hussar", "\u5308\u7259\u5229\u8F15\u9A0E\u5175", 500, 0, 600, "light-cavalry", 50),
  line("cavalier", "\u91CD\u88DD\u9A0E\u58EB", 300, 0, 300, null, 100),
  line("paladin", "\u904A\u4FE0", 1300, 0, 750, "cavalier", 170),
  unit("camel", "\u99F1\u99DD\u9A0E\u5175", 55, 0, 60, 3, 22),
  line("heavy-camel", "\u91CD\u88DD\u99F1\u99DD\u9A0E\u5175", 325, 0, 365, null, 105),
  line("capped-ram", "\u88DD\u7532\u885D\u649E\u8ECA", 300, 0, 0, null, 50),
  line("siege-ram", "\u91CD\u578B\u885D\u649E\u8ECA", 1e3, 0, 0, "capped-ram", 75),
  unit("mangonel", "\u8F15\u578B\u6295\u77F3\u8ECA", 0, 160, 135, 3, 46),
  line("onager", "\u4E2D\u578B\u6295\u77F3\u8ECA", 800, 0, 500, null, 75),
  line("siege-onager", "\u91CD\u578B\u6295\u77F3\u8ECA", 1450, 0, 1e3, "onager", 150),
  unit("scorpion", "\u5F29\u7832", 0, 75, 75, 3, 30),
  line("heavy-scorpion", "\u91CD\u578B\u5F29\u7832", 1e3, 1100, 0, null, 50),
  unit("trebuchet", "\u5DE8\u578B\u6295\u77F3\u6A5F", 0, 200, 200, 4, 50),
  unit("petard", "\u70B8\u85E5\u6876", 65, 0, 20, 3, 25),
  // Unique techs whose targets exist from this round on (they were deferred in the civilization round).
  upgrade("warwolf", "\u6230\u72FC\u865F", 0, 800, 400, 0, 4, 40),
  upgrade("kataparuto", "\u5F48\u5C04\u5668", 0, 750, 400, 0, 4, 60),
  upgrade("sipahi", "\u91C7\u9091\u9A0E\u5175", 350, 0, 150, 0, 3, 60)
];
var unitProducers = {
  "two-handed-swordsman": "barracks",
  champion: "barracks",
  halberdier: "barracks",
  arbalest: "archery-range",
  "cavalry-archer": "archery-range",
  "heavy-cavalry-archer": "archery-range",
  hussar: "stable",
  cavalier: "stable",
  paladin: "stable",
  camel: "stable",
  "heavy-camel": "stable",
  "capped-ram": "siege-workshop",
  "siege-ram": "siege-workshop",
  mangonel: "siege-workshop",
  onager: "siege-workshop",
  "siege-onager": "siege-workshop",
  scorpion: "siege-workshop",
  "heavy-scorpion": "siege-workshop",
  trebuchet: "castle",
  petard: "castle",
  warwolf: "castle",
  kataparuto: "castle",
  sipahi: "castle"
};
var tech = (id, name, food, wood6, gold4, stone6, requires, time) => entry(id, "technology", name, food, wood6, gold4, stone6, requires, 0, time, aoetw);
var techEntries = [
  entry("university", "building", "\u5B78\u9662", 0, 200, 0, 0, ["age-3"], 0, 40, "aoetw.com/building/University; 40 s is design_default like the other buildings"),
  tech("masonry", "\u78DA\u74E6\u6280\u8853", 150, 175, 0, 0, ["age-3"], 50),
  tech("architecture", "\u5EFA\u7BC9\u5B78", 300, 200, 0, 0, ["age-4", "masonry"], 70),
  tech("chemistry", "\u5316\u5B78", 300, 0, 200, 0, ["age-4"], 100),
  tech("siege-engineers", "\u653B\u57CE\u5DE5\u7A0B\u5E2B", 500, 600, 0, 0, ["age-4"], 45),
  tech("guard-tower", "\u9632\u79A6\u7BAD\u5854", 100, 250, 0, 0, ["age-3"], 30),
  tech("keep", "\u5927\u578B\u7BAD\u5854", 500, 350, 0, 0, ["age-4", "guard-tower"], 75),
  tech("treadmill-crane", "\u78E8\u574A\u6C34\u8ECA", 300, 200, 0, 0, ["age-3"], 50),
  tech("arrowslits", "\u7BAD\u72F9\u69FD", 250, 250, 0, 0, ["age-4"], 25),
  tech("supplies", "\u4F9B\u7D66", 150, 0, 100, 0, ["age-2"], 35),
  tech("squires", "\u8B77\u885B\u6280\u8853", 100, 0, 0, 0, ["age-3"], 40),
  tech("arson", "\u7E31\u706B", 150, 0, 50, 0, ["age-3"], 25),
  tech("thumb-ring", "\u62C7\u6307\u74B0", 300, 250, 0, 0, ["age-3"], 45),
  tech("parthian-tactics", "\u5B89\u606F\u4EBA\u6230\u8853", 200, 0, 250, 0, ["age-4"], 65),
  tech("bloodlines", "\u54C1\u7A2E", 150, 0, 100, 0, ["age-2"], 50),
  tech("husbandry", "\u8015\u7A2E\u6280\u8853", 150, 0, 0, 0, ["age-3"], 40),
  tech("town-watch", "\u57CE\u93AE\u77AD\u671B", 75, 0, 0, 0, ["age-2"], 25),
  tech("town-patrol", "\u57CE\u93AE\u5DE1\u908F", 300, 0, 100, 0, ["age-3", "town-watch"], 40),
  tech("fervor", "\u5B97\u6559\u72C2\u71B1", 0, 0, 140, 0, ["age-3"], 50),
  tech("herbal-medicine", "\u8349\u85E5\u6CBB\u7642", 0, 0, 350, 0, ["age-3"], 35),
  tech("hoardings", "\u570D\u7246", 400, 400, 0, 0, ["age-4"], 75),
  tech("sappers", "\u5175\u5DE5\u5B78", 400, 0, 200, 0, ["age-4"], 10),
  tech("conscription", "\u5FB5\u5175\u6280\u8853", 150, 0, 150, 0, ["age-4"], 60),
  entry("hand-cannoneer", "unit", "\u706B\u69CD\u5175", 45, 0, 50, 0, ["age-4", "chemistry"], 1, 34, aoetw),
  entry("bombard-cannon", "unit", "\u706B\u7832", 0, 225, 225, 0, ["age-4", "chemistry"], 1, 56, aoetw),
  // Turks' Artillery: its bombard cannon exists from this round on.
  upgrade("artillery", "\u7832\u5175", 0, 0, 500, 450, 4, 40)
];
var techProducers = {
  masonry: "university",
  architecture: "university",
  chemistry: "university",
  "siege-engineers": "university",
  "guard-tower": "university",
  keep: "university",
  "treadmill-crane": "university",
  arrowslits: "university",
  supplies: "barracks",
  squires: "barracks",
  arson: "barracks",
  "thumb-ring": "archery-range",
  "parthian-tactics": "archery-range",
  bloodlines: "stable",
  husbandry: "stable",
  "town-watch": "town-center",
  "town-patrol": "town-center",
  fervor: "monastery",
  "herbal-medicine": "monastery",
  hoardings: "castle",
  sappers: "castle",
  conscription: "castle",
  "hand-cannoneer": "archery-range",
  "bombard-cannon": "siege-workshop",
  artillery: "castle"
};
var building = (id, name, wood6, gold4, stone6, requires, time, page) => entry(id, "building", name, 0, wood6, gold4, stone6, requires, 0, time, `aoetw.com/building/${page}; build time design_default`);
var ship = (id, name, wood6, gold4, requires, time) => entry(id, "unit", name, 0, wood6, gold4, 0, requires, 1, time, aoetw);
var buildingEntries = [
  building("dock", "\u78BC\u982D", 150, 0, 0, [], 15, "Dock"),
  building("fish-trap", "\u9B5A\u7DB2", 100, 0, 0, ["age-2", "dock"], 15, "Fish_Trap"),
  building("market", "\u5E02\u96C6", 175, 0, 0, ["age-2"], 25, "Market"),
  building("outpost", "\u54E8\u7AD9", 25, 0, 5, [], 6, "Outpost"),
  building("palisade-wall", "\u6728\u7246", 2, 0, 0, [], 3, "Palisade_Wall"),
  building("palisade-gate", "\u6728\u9580", 30, 0, 0, [], 12, "Palisade_Gate"),
  building("stone-wall", "\u77F3\u7246", 0, 0, 5, ["age-2"], 4, "Stone_Wall"),
  building("gate", "\u57CE\u9580", 0, 0, 30, ["age-2"], 12, "Gate"),
  building("bombard-tower", "\u706B\u7832\u5854", 0, 100, 125, ["age-4", "bombard-tower-tech"], 30, "Bombard_Tower"),
  entry("wonder", "building", "\u4E16\u754C\u5947\u89C0", 0, 1e3, 500, 500, ["age-4"], 0, 600, "aoetw.com/building/Wonder (1000 wood, gold and stone, 3500 s); cost and time scaled to this map, design_default"),
  // Ships (the dock) and the trade cart (the market).
  ship("fishing-ship", "\u6F01\u8239", 75, 0, [], 40),
  ship("transport-ship", "\u904B\u8F38\u8239", 125, 0, [], 46),
  ship("trade-cog", "\u8CBF\u6613\u5546\u8239", 100, 50, ["age-2"], 36),
  ship("galley", "\u6230\u8239", 90, 30, ["age-2"], 60),
  ship("fire-galley", "\u706B\u8268\u825F", 75, 45, ["age-2"], 60),
  ship("demolition-raft", "\u81EA\u7206\u7B4F", 70, 50, ["age-2"], 45),
  ship("cannon-galleon", "\u706B\u7832\u6230\u8239", 200, 150, ["age-4", "chemistry"], 46),
  ship("longboat", "\u7DAD\u4EAC\u5927\u6230\u8239", 100, 50, ["age-3"], 25),
  entry("trade-cart", "unit", "\u8CBF\u6613\u8ECA\u968A", 0, 100, 50, 0, ["age-2"], 1, 51, aoetw),
  // Dock upgrades: War Galley also turns fire galleys into fire ships and demolition rafts into demolition ships.
  tech("war-galley", "\u5F29\u7832\u6230\u8239", 230, 0, 100, 0, ["age-3"], 50),
  tech("galleon", "\u91CD\u578B\u5F29\u7832\u6230\u8239", 400, 0, 315, 0, ["age-4", "war-galley"], 65),
  tech("fast-fire-ship", "\u91CD\u578B\u706B\u6230\u8239", 280, 0, 250, 0, ["age-4", "war-galley"], 50),
  tech("heavy-demolition-ship", "\u91CD\u578B\u7206\u7834\u8239", 0, 200, 300, 0, ["age-4", "war-galley"], 50),
  tech("elite-cannon-galleon", "\u7CBE\u92B3\u706B\u7832\u6230\u8239", 0, 525, 500, 0, ["age-4", "chemistry"], 30),
  upgrade("elite-longboat", "\u7CBE\u92B3\u7DAD\u4EAC\u5927\u6230\u8239", 750, 0, 475, 0, 4, 60),
  tech("gillnets", "\u6D41\u523A\u7DB2", 150, 0, 200, 0, ["age-3"], 45),
  tech("careening", "\u822A\u6D77\u6280\u8853", 250, 0, 150, 0, ["age-3"], 50),
  tech("dry-dock", "\u8239\u5862", 600, 0, 400, 0, ["age-4", "careening"], 60),
  tech("shipwright", "\u9020\u8239\u54E1", 1e3, 0, 300, 0, ["age-4"], 60),
  // The market's and the university's.
  tech("caravan", "\u5546\u968A", 200, 0, 200, 0, ["age-3"], 40),
  tech("guilds", "\u516C\u6703\u5236\u5EA6", 300, 0, 200, 0, ["age-4"], 50),
  tech("heated-shot", "\u706B\u7BAD", 350, 0, 100, 0, ["age-3"], 30),
  tech("fortified-wall", "\u579B\u7246", 200, 100, 0, 0, ["age-3"], 50),
  tech("bombard-tower-tech", "\u706B\u7832\u5854\u6280\u8853", 800, 400, 0, 0, ["age-4", "chemistry"], 60),
  // Byzantines' Greek Fire: its fire ships exist from this round on.
  upgrade("greek-fire", "\u5E0C\u81D8\u4E4B\u706B", 250, 0, 300, 0, 3, 40)
];
var dockItems = ["fishing-ship", "transport-ship", "trade-cog", "galley", "fire-galley", "demolition-raft", "cannon-galleon", "longboat", "war-galley", "galleon", "fast-fire-ship", "heavy-demolition-ship", "elite-cannon-galleon", "elite-longboat", "gillnets", "careening", "dry-dock", "shipwright"];
var buildingProducers = { ...Object.fromEntries(dockItems.map((id) => [id, "dock"])), "trade-cart": "market", caravan: "market", guilds: "market", "heated-shot": "university", "fortified-wall": "university", "bombard-tower-tech": "university", "greek-fire": "castle" };
function civilizationsOf(entries) {
  const ids = entries.map((e) => e.id), uniqueIds = new Set(civDefs.flatMap((c) => [...c.uniqueUnits, ...c.eliteUpgrades, ...c.uniqueTechs.map((t) => t.id)]));
  return civDefs.map((c) => {
    const own = /* @__PURE__ */ new Set([...c.uniqueUnits, ...c.eliteUpgrades, ...c.uniqueTechs.map((t) => t.id)]);
    const unavailable = ids.filter((id) => c.missing.includes(id) || uniqueIds.has(id) && !own.has(id) || id === "castle" && !c.uniqueUnits.length);
    for (let grew = true; grew; ) {
      grew = false;
      for (const e of entries) {
        if (unavailable.includes(e.id)) continue;
        const producer = rules.production[e.id];
        if (producer && unavailable.includes(producer) || e.requires.some((r) => unavailable.includes(r))) {
          unavailable.push(e.id);
          grew = true;
        }
      }
    }
    return { id: c.id, available: ids.filter((id) => !unavailable.includes(id)), unavailable: ids.filter((id) => unavailable.includes(id)) };
  });
}
var rules = {
  schemaVersion: 1,
  id: "brick-foundation-0.1",
  reference: { game: "Age of Empires II: Definitive Edition", version: null, build: null, contentPacks: [], verificationStatus: "unverified", sourceEvidence: [] },
  coverage: { contentDenominator: null, exactReferenceCoveragePercent: null },
  settings: { tickHz: 20, populationCap: 40, mapSize: 16, speed: 1, mode: "command-sandbox", seed: 260925, platform: "desktop browser", provenance: "design_default" },
  entries: [
    entry("villager", "unit", "\u6751\u6C11", 50, 0, 0, 0, [], 1),
    entry("town-center", "building", "\u57CE\u93AE\u4E2D\u5FC3", 0, 275, 0, 100, ["age-3"], 0, 60, "aoetw.com/building/Town_Center (275 wood, 100 stone, Castle Age); 60 s is design_default"),
    entry("house", "building", "\u6C11\u5C45", 0, 30),
    entry("barracks", "building", "\u5175\u71DF", 0, 150),
    entry("farm", "building", "\u8FB2\u7530", 0, 60),
    entry("lumber-camp", "building", "\u4F10\u6728\u5834", 0, 100),
    entry("mining-camp", "building", "\u63A1\u7926\u5834", 0, 100),
    entry("mill", "building", "\u78E8\u574A", 0, 100),
    entry("stable", "building", "\u99AC\u5EC4", 0, 175, 0, 0, ["age-2", "barracks"]),
    entry("archery-range", "building", "\u9776\u5834", 0, 175, 0, 0, ["age-2", "barracks"]),
    entry("monastery", "building", "\u4FEE\u9053\u9662", 0, 175, 0, 0, ["age-3"]),
    entry("militia", "unit", "\u8FD1\u6230\u6C11\u5175", 60, 0, 20, 0, ["barracks"], 1),
    entry("archer", "unit", "\u5F13\u624B", 0, 40, 30, 0, ["age-2"], 1),
    entry("ram", "unit", "\u653B\u57CE\u69CC", 0, 160, 75, 0, ["age-3"], 3),
    entry("watch-tower", "building", "\u7BAD\u5854", 0, 25, 0, 125, ["age-2"]),
    entry("siege-workshop", "building", "\u653B\u57CE\u5668\u5DE5\u574A", 0, 200, 0, 0, ["age-3", "blacksmith"]),
    entry("scout", "unit", "\u65A5\u5019", 80, 0, 0, 0, ["stable"], 1),
    entry("monk", "unit", "\u50E7\u4FB6", 0, 0, 100, 0, ["monastery"], 1),
    entry("redemption", "technology", "\u6551\u8D16", 0, 0, 475, 0, ["monastery", "age-3"]),
    entry("atonement", "technology", "\u8D16\u7F6A", 0, 0, 325, 0, ["monastery", "age-3"]),
    entry("sanctity", "technology", "\u8056\u6F54", 0, 0, 175, 0, ["monastery", "age-3"]),
    entry("heresy", "technology", "\u7570\u7AEF", 0, 0, 1e3, 0, ["monastery", "age-3"]),
    entry("illumination", "technology", "\u555F\u8499", 0, 0, 120, 0, ["monastery", "age-4"]),
    entry("block-printing", "technology", "\u6D3B\u5B57\u5370\u5237", 0, 0, 200, 0, ["monastery", "age-4"]),
    entry("theocracy", "technology", "\u795E\u6B0A\u653F\u6CBB", 0, 0, 200, 0, ["monastery", "age-4"]),
    entry("faith", "technology", "\u4FE1\u4EF0", 550, 0, 750, 0, ["monastery", "age-4"]),
    entry("spearman", "unit", "\u9577\u69CD\u5175", 35, 25, 0, 0, ["age-2"], 1),
    entry("skirmisher", "unit", "\u6563\u5175", 25, 35, 0, 0, ["age-2"], 1),
    entry("knight", "unit", "\u9A0E\u58EB", 60, 0, 75, 0, ["age-3"], 1),
    entry("blacksmith", "building", "\u9435\u5320\u92EA", 0, 150),
    entry("man-at-arms", "technology", "\u91CD\u6B65\u5175", 100, 0, 40, 0, ["age-2"]),
    entry("long-swordsman", "technology", "\u9577\u528D\u58EB", 200, 0, 65, 0, ["age-3", "man-at-arms"]),
    entry("pikeman", "technology", "\u9577\u77DB\u5175", 215, 0, 90, 0, ["age-3"]),
    entry("crossbowman", "technology", "\u5F29\u624B", 125, 0, 75, 0, ["age-3"]),
    entry("elite-skirmisher", "technology", "\u7CBE\u92B3\u6563\u5175", 0, 250, 160, 0, ["age-3"]),
    entry("light-cavalry", "technology", "\u8F15\u9A0E\u5175", 150, 0, 50, 0, ["age-3"]),
    entry("forging", "technology", "\u935B\u9020", 150, 0, 0, 0, ["age-2"]),
    entry("iron-casting", "technology", "\u9444\u9435", 220, 0, 120, 0, ["age-3", "forging"]),
    entry("blast-furnace", "technology", "\u9AD8\u7210", 275, 0, 225, 0, ["age-4", "iron-casting"]),
    entry("scale-mail-armor", "technology", "\u9C57\u7532", 100, 0, 0, 0, ["age-2"]),
    entry("chain-mail-armor", "technology", "\u9396\u5B50\u7532", 200, 0, 100, 0, ["age-3", "scale-mail-armor"]),
    entry("plate-mail-armor", "technology", "\u677F\u7532", 300, 0, 150, 0, ["age-4", "chain-mail-armor"]),
    entry("scale-barding-armor", "technology", "\u9C57\u7247\u99AC\u93A7", 150, 0, 0, 0, ["age-2"]),
    entry("chain-barding-armor", "technology", "\u9396\u5B50\u99AC\u93A7", 250, 0, 150, 0, ["age-3", "scale-barding-armor"]),
    entry("plate-barding-armor", "technology", "\u677F\u7532\u99AC\u93A7", 350, 0, 200, 0, ["age-4", "chain-barding-armor"]),
    entry("fletching", "technology", "\u7FBD\u7BAD", 100, 0, 50, 0, ["age-2"]),
    entry("bodkin-arrow", "technology", "\u9310\u5F62\u7BAD", 200, 0, 100, 0, ["age-3", "fletching"]),
    entry("bracer", "technology", "\u8B77\u8155", 300, 0, 200, 0, ["age-4", "bodkin-arrow"]),
    entry("padded-archer-armor", "technology", "\u896F\u588A\u5F13\u624B\u7532", 100, 0, 0, 0, ["age-2"]),
    entry("leather-archer-armor", "technology", "\u76AE\u9769\u5F13\u624B\u7532", 150, 0, 150, 0, ["age-3", "padded-archer-armor"]),
    entry("ring-archer-armor", "technology", "\u74B0\u7532\u5F13\u624B\u7532", 250, 0, 250, 0, ["age-4", "leather-archer-armor"]),
    entry("loom", "technology", "\u7E54\u5E03\u6A5F", 0, 0, 50),
    entry("wheelbarrow", "technology", "\u624B\u63A8\u8ECA", 175, 50, 0, 0, ["age-2"]),
    entry("hand-cart", "technology", "\u624B\u62C9\u8ECA", 300, 200, 0, 0, ["age-3", "wheelbarrow"]),
    entry("double-bit-axe", "technology", "\u96D9\u5203\u65A7", 100, 50, 0, 0, ["age-2"]),
    entry("bow-saw", "technology", "\u5F13\u92F8", 150, 100, 0, 0, ["age-3", "double-bit-axe"]),
    entry("two-man-saw", "technology", "\u96D9\u4EBA\u92F8", 300, 200, 0, 0, ["age-4", "bow-saw"]),
    entry("gold-mining", "technology", "\u63A1\u91D1\u8853", 100, 75, 0, 0, ["age-2"]),
    entry("gold-shaft-mining", "technology", "\u8C4E\u4E95\u63A1\u91D1", 200, 100, 0, 0, ["age-3", "gold-mining"]),
    entry("stone-mining", "technology", "\u63A1\u77F3\u8853", 100, 75, 0, 0, ["age-2"]),
    entry("stone-shaft-mining", "technology", "\u8C4E\u4E95\u63A1\u77F3", 200, 100, 0, 0, ["age-3", "stone-mining"]),
    entry("horse-collar", "technology", "\u99AC\u8EDB", 75, 75, 0, 0, ["age-2"]),
    entry("heavy-plow", "technology", "\u91CD\u7281", 125, 125, 0, 0, ["age-3", "horse-collar"]),
    entry("crop-rotation", "technology", "\u8F2A\u8015", 250, 250, 0, 0, ["age-4", "heavy-plow"]),
    entry("age-2", "technology", "\u7B2C\u4E8C\u6642\u4EE3", 300),
    entry("age-3", "technology", "\u7B2C\u4E09\u6642\u4EE3", 500, 0, 200, 0, ["age-2"]),
    entry("age-4", "technology", "\u7B2C\u56DB\u6642\u4EE3", 800, 0, 400, 0, ["age-3"]),
    ...castleEntries,
    ...unitEntries,
    ...techEntries,
    ...buildingEntries
  ],
  // Which building produces each unit/technology (design_default). null = defined but not producible yet.
  production: {
    villager: "town-center",
    militia: "barracks",
    "man-at-arms": "barracks",
    "long-swordsman": "barracks",
    spearman: "barracks",
    pikeman: "barracks",
    archer: "archery-range",
    crossbowman: "archery-range",
    skirmisher: "archery-range",
    "elite-skirmisher": "archery-range",
    ram: "siege-workshop",
    scout: "stable",
    "light-cavalry": "stable",
    knight: "stable",
    forging: "blacksmith",
    "iron-casting": "blacksmith",
    "blast-furnace": "blacksmith",
    "scale-mail-armor": "blacksmith",
    "chain-mail-armor": "blacksmith",
    "plate-mail-armor": "blacksmith",
    "scale-barding-armor": "blacksmith",
    "chain-barding-armor": "blacksmith",
    "plate-barding-armor": "blacksmith",
    fletching: "blacksmith",
    "bodkin-arrow": "blacksmith",
    bracer: "blacksmith",
    "padded-archer-armor": "blacksmith",
    "leather-archer-armor": "blacksmith",
    "ring-archer-armor": "blacksmith",
    monk: "monastery",
    redemption: "monastery",
    atonement: "monastery",
    sanctity: "monastery",
    heresy: "monastery",
    illumination: "monastery",
    "block-printing": "monastery",
    theocracy: "monastery",
    faith: "monastery",
    "double-bit-axe": "lumber-camp",
    "bow-saw": "lumber-camp",
    "two-man-saw": "lumber-camp",
    "gold-mining": "mining-camp",
    "gold-shaft-mining": "mining-camp",
    "stone-mining": "mining-camp",
    "stone-shaft-mining": "mining-camp",
    "horse-collar": "mill",
    "heavy-plow": "mill",
    "crop-rotation": "mill",
    "age-2": "town-center",
    "age-3": "town-center",
    "age-4": "town-center",
    // After the ages, so the town centre's age-up keeps its tile and hotkey.
    loom: "town-center",
    wheelbarrow: "town-center",
    "hand-cart": "town-center",
    // The Castle: unique units, their elite upgrades and the unique technologies.
    ...Object.fromEntries(castleEntries.filter((e) => e.kind !== "building").map((e) => [e.id, "castle"])),
    ...unitProducers,
    ...techProducers,
    ...buildingProducers
  },
  civilizations: []
};
rules.civilizations = civilizationsOf(rules.entries);

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
  if (layout === "open" || layout === "lakes") return generateOpen(seed, layout === "lakes");
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
  pond: { size: 3, baseDistance: 1100, fairness: 300 },
  // The 'lakes' variant: water within this radius of the centre (off the bases' aprons), deep-water fish for fishing
  // ships, and the neutral mines on a ring round the lake.
  // shore: tiles of open land kept round the lake (no mines or trees), so the walk round it is never one lane wide.
  lake: { radius: 720, fish: 8, fishSpacing: 300, neutralRing: [1e3, 1250], shore: 2 }
};
function generateOpen(seed, lake = false) {
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
  const lakeTiles = [];
  if (lake) {
    for (let ty = 1; ty < size - 1; ty++) for (let tx = 1; tx < size - 1; tx++) if (Math.hypot(tx * 100 + 50 - mid, ty * 100 + 50 - mid) <= R.lake.radius && free(tx, ty)) {
      lakeTiles.push(ty * size + tx);
      taken.add(ty * size + tx);
      Object.assign(tiles[ty * size + tx], { terrainType: "water", ...terrainDefinitions.water });
    }
  }
  if (lake) {
    const ring = R.lake.shore;
    for (const t of lakeTiles) {
      const tx = t % size, ty = Math.floor(t / size);
      for (let dy = -ring; dy <= ring; dy++) for (let dx = -ring; dx <= ring; dx++) {
        const x = tx + dx, y = ty + dy;
        if (x >= 0 && y >= 0 && x < size && y < size) taken.add(y * size + x);
      }
    }
  }
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
    const a = random() * Math.PI * 2, d = lake ? R.lake.neutralRing[0] + random() * (R.lake.neutralRing[1] - R.lake.neutralRing[0]) : random() * R.neutralRadius, tx = Math.floor((mid + Math.cos(a) * d) / 100), ty = Math.floor((mid + Math.sin(a) * d) / 100);
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
  const pond = lake ? [] : placePond(seed, size, taken, centres);
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
  if (lake) {
    const deep = lakeTiles.filter((t) => [-size - 1, -size, -size + 1, -1, 1, size - 1, size, size + 1].every((d) => tiles[t + d]?.terrainType === "water")).sort((a, b) => Math.atan2(Math.floor(a / size) * 100 - mid, a % size * 100 - mid) - Math.atan2(Math.floor(b / size) * 100 - mid, b % size * 100 - mid) || a - b);
    const picked = [];
    for (const t of deep) {
      if (picked.length >= R.lake.fish) break;
      const x = t % size * 100 + 50, y = Math.floor(t / size) * 100 + 50;
      if (picked.every((p) => Math.hypot(p % size * 100 + 50 - x, Math.floor(p / size) * 100 + 50 - y) >= R.lake.fishSpacing)) picked.push(t);
    }
    for (const t of picked) {
      const x = t % size * 100 + 50, y = Math.floor(t / size) * 100 + 50, id = `resource-fish-${x}-${y}`, capacity = terrainRules.resourceCapacity.fish;
      map.resources.push({ id, kind: "fish", x, y, capacity, remaining: capacity, collectible: true, status: "available", obstacleId: null, depletedAt: null });
      map.tiles[t].resourceRefs.push(id);
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
var buildingKinds = new Set(rules.entries.filter((e) => e.kind === "building").map((e) => e.id));
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
    const tile3 = map.tiles[y * size + x];
    if (x < size - 1 && Math.abs(tile3.height - map.tiles[tile3.id + 1].height) > maxStep && intersects(a, b, [(x + 1) * 100 - radius, y * 100 - radius, (x + 1) * 100 + radius, (y + 1) * 100 + radius])) return false;
    if (y < size - 1 && Math.abs(tile3.height - map.tiles[tile3.id + size].height) > maxStep && intersects(a, b, [x * 100 - radius, (y + 1) * 100 - radius, (x + 1) * 100 + radius, (y + 1) * 100 + radius])) return false;
    if (!canTraverse(tile3, movement) && intersects(a, b, [x * 100 - radius, y * 100 - radius, x * 100 + 100 + radius, y * 100 + 100 + radius])) return false;
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
  for (const tile3 of map.tiles) {
    if (!Number.isSafeInteger(tile3.height) || tile3.height < 0) errors.push(`\u5730\u683C ${tile3.id} \u9AD8\u5EA6\u7121\u6548`);
    if (!["land", "water", "both", "blocked"].includes(tile3.walkClass) || typeof tile3.buildability !== "boolean") errors.push(`\u5730\u683C ${tile3.id} \u901A\u884C\u6216\u5EFA\u9020\u898F\u5247\u7121\u6548`);
    if (tile3.resourceRefs.some((id) => !resources.has(id)) || tile3.obstacleRefs.some((id) => !obstacles.has(id))) errors.push(`\u5730\u683C ${tile3.id} \u53C3\u7167\u5931\u6548`);
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
var iconUniques = ["longbowman", "woad-raider", "throwing-axeman", "huskarl", "teutonic-knight", "berserk", "cataphract", "war-elephant", "mameluke", "janissary", "chu-ko-nu", "samurai", "mangudai", "cavalry-archer", "camel", "petard", "hand-cannoneer"];
var frameOfRole = (role) => role === "war-elephant" ? { bar: 3.05, ring: 2.4 } : role === "camel" ? { bar: 2.95, ring: 2 } : isMounted(role) ? { bar: 2.3, ring: 1.8 } : { bar: 1.42, ring: 1 };
var siegeFrames = { ram: { bar: 1.35, ring: 1.6 }, mangonel: { bar: 1.45, ring: 1.8 }, scorpion: { bar: 1.2, ring: 1.5 }, trebuchet: { bar: 1.3, ring: 2.3 }, "bombard-cannon": { bar: 1.3, ring: 1.7 } };
var unitFrame = (kind, unpacked = false) => kind === "trebuchet" && unpacked ? { bar: 2.9, ring: 2.4 } : siegeFrames[kind] ?? vesselFrames[kind] ?? frameOfRole(roleOf(kind));
var gradedWeapon = (kind, look) => look === "two-handed-swordsman" || look === "champion" ? "great-sword" : weaponOf(kind);
var architectureOf = (civs, player) => civById(civs?.[player] ?? "")?.architecture ?? "neutral";
var drawnBuildings = ["house", "town-center", "barracks", "lumber-camp", "mining-camp", "mill", "stable", "archery-range", "monastery", "blacksmith", "watch-tower", "siege-workshop", "castle", "university", "market", "dock", "fish-trap", "outpost", "bombard-tower", "wonder", "palisade-wall", "stone-wall", "palisade-gate", "gate"];
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
  const ownTower = (view) => options.assetPreview ? null : towerGradeOf(view.economy?.techs ?? []);
  function house(x, z, red2 = false, obstacleKind = "house", progress = 100, age = 2, health = 100, style = "neutral", tower = null, links = noLinks, land = 0) {
    const kind = options.assetPreview ? previewBuildingKind : obstacleKind, visual = options.assetPreview ? previewBuilding : { ...previewBuilding, progress, health, ageVariant: Math.min(4, Math.max(1, age)) };
    const joined = options.assetPreview ? { ...noLinks, e: true, w: true } : links, styleOf = options.assetPreview ? previewStyle : style;
    const parts = kind === "wonder" ? wonderParts({ ...visual, red: red2 }, styleOf) : regionalParts(kind === "house" ? buildingParts({ ...visual, red: red2 }) : kind === "palisade-wall" || kind === "stone-wall" ? wallParts(kind, { ...visual, red: red2 }, joined) : kind === "palisade-gate" || kind === "gate" ? gateParts(kind, { ...visual, red: red2 }, joined) : kind === "outpost" ? outpostParts({ ...visual, red: red2 }) : kind === "bombard-tower" ? bombardTowerParts({ ...visual, red: red2 }) : kind === "dock" ? dockParts({ ...visual, red: red2 }, options.assetPreview ? 0 : land) : kind === "fish-trap" ? fishTrapParts({ ...visual, red: red2 }) : kind === "monastery" ? monasteryParts({ ...visual, red: red2 }) : kind === "blacksmith" ? blacksmithParts({ ...visual, red: red2 }) : kind === "watch-tower" ? towerParts({ ...visual, red: red2 }, tower) : kind === "university" ? universityParts({ ...visual, red: red2 }) : kind === "siege-workshop" ? siegeWorkshopParts({ ...visual, red: red2 }) : kind === "castle" ? castleParts({ ...visual, red: red2 }) : militaryBuildings.includes(kind) ? militaryBuildingParts(kind, { ...visual, red: red2 }) : economicBuildingParts(kind, { ...visual, red: red2 }), kind === "farm" ? "neutral" : styleOf);
    for (const p of parts) brick(x + p.x, z + p.z, p.y, p.w, p.d, p.h, p.color, false, p.shape);
    for (const stud of buildingStuds(parts)) staticPart(studGeo, stud.color, x + stud.x, stud.y, z + stud.z);
  }
  const deepWater = (tiles, id) => {
    const n = sizeOfTiles(tiles), x = id % n, z = Math.floor(id / n);
    return [[1, 0], [-1, 0], [0, 1], [0, -1]].every(([dx, dz]) => {
      const tx = x + dx, tz = z + dz;
      return tx >= 0 && tz >= 0 && tx < n && tz < n && tiles[tz * n + tx].terrainType === "water";
    });
  };
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
    const map = options.assetPreview ? makeMap(seed, previewLayout) : { tiles: view.terrain.map((tile3, id) => ({ ...tile3, id, resourceRefs: [], obstacleRefs: [] })), obstacles: view.known.map((k) => k.obstacle), resources: view.resources };
    worldTiles = map.tiles;
    board = sizeOfTiles(map.tiles);
    platforms = map.obstacles.flatMap((o) => {
      const p = walkablePlatforms[o.kind];
      return p ? [{ x0: o.x + p.rect[0], y0: o.y + p.rect[1], x1: o.x + p.rect[2], y1: o.y + p.rect[3], height: p.height }] : [];
    });
    let rng = seed || 1;
    for (const tile3 of map.tiles) {
      const x = tile3.id % board, z = Math.floor(tile3.id / board);
      rng ^= rng << 13;
      rng ^= rng >>> 17;
      rng ^= rng << 5;
      const n = (rng >>> 0) / 4294967296;
      groundBlock(x, z, tile3.height / 100, !options.assetPreview && view.fog[tile3.id] !== 2 ? view.fog[tile3.id] === 1 ? "#626e64" : "#293e38" : tile3.terrainType === "cliff" ? "#8a8065" : tile3.terrainType === "stone" ? "#a1a28e" : tile3.terrainType === "highland" ? "#879d69" : tile3.terrainType === "water" ? deepWater(map.tiles, tile3.id) ? "#41768a" : "#4b8291" : tile3.terrainType === "shallow" ? "#86b7b8" : tile3.terrainType === "sand" ? "#d5c598" : tile3.terrainType === "road" ? "#c4b18a" : n < 0.2 ? "#a6b582" : n < 0.5 ? "#b5c493" : "#becda0");
    }
    for (const tile3 of map.tiles) if (tile3.terrainType === "water" && (options.assetPreview || view.fog[tile3.id] === 2)) {
      const tx = tile3.id % board, tz = Math.floor(tile3.id / board);
      let v = Math.imul(tx + 1, 73856093) ^ Math.imul(tz + 1, 19349663);
      v = Math.imul(v ^ v >>> 16, 73244475);
      v = (v ^ v >>> 16) >>> 0;
      if (v % 3 === 0) brick(tx + 0.12 + (v >> 3 & 3) * 0.1, tz + 0.2 + (v >> 5 & 3) * 0.15, tile3.height / 100, 0.42, 0.06, 0.02, "#6fa2ae", false);
      if (v % 5 === 1) brick(tx + 0.5 - (v >> 7 & 1) * 0.3, tz + 0.62, tile3.height / 100, 0.28, 0.05, 0.02, "#6fa2ae", false);
    }
    const fortAt = /* @__PURE__ */ new Map();
    for (const o of map.obstacles) {
      const f = wallFamily(o.kind);
      if (f) fortAt.set(`${Math.floor(o.x / 100)},${Math.floor(o.y / 100)}`, `${f}:${o.red ? 1 : 0}`);
    }
    const linksOf = (o) => {
      const tx = Math.floor(o.x / 100), tz = Math.floor(o.y / 100), me = fortAt.get(`${tx},${tz}`), at = (dx, dz) => fortAt.get(`${tx + dx},${tz + dz}`) === me;
      return { n: at(0, -1), s: at(0, 1), e: at(1, 0), w: at(-1, 0), ne: at(1, -1), nw: at(-1, -1), se: at(1, 1), sw: at(-1, 1) };
    };
    const landOf = (o) => {
      const tx = Math.floor(o.x / 100), tz = Math.floor(o.y / 100), dry = (x, z) => {
        if (x < 0 || z < 0 || x >= board || z >= board) return 0;
        const t = map.tiles[z * board + x];
        return t.terrainType === "water" || t.terrainType === "shallow" ? 0 : 1;
      };
      const sides = [0, 1, 2].map((i) => [dry(tx + i, tz - 1), dry(tx + 3, tz + i), dry(tx + i, tz + 3), dry(tx - 1, tz + i)]).reduce((a, b) => a.map((v, i) => v + b[i]), [0, 0, 0, 0]);
      return sides.indexOf(Math.max(...sides));
    };
    for (const o of map.obstacles) {
      baseHeight = groundHeight(map.tiles, o.x, o.y) / 100;
      muted = !options.assetPreview && view.fog[tileAt(o.x, o.y, sizeOfTiles(map.tiles))] !== 2;
      const x = o.x / 100, z = o.y / 100;
      if (o.kind === "farm") for (const p of farmParts(o.progress ?? 100, o.red)) brick(x + p.x, z + p.z, p.y, p.w, p.d, p.h, p.color, p.studs);
      else if (drawnBuildings.includes(o.kind)) house(x, z, o.red, o.kind, o.progress ?? 100, o.age ?? 2, o.damaged ? 35 : 100, options.assetPreview ? "neutral" : architectureOf(view.civs, o.red ? 1 : 0), o.kind === "watch-tower" && !o.red ? ownTower(view) : null, wallFamily(o.kind) ? linksOf(o) : noLinks, o.kind === "dock" ? landOf(o) : 0);
      else if (o.kind === "tree") {
        let v = Math.imul(o.x | 0, 73856093) ^ Math.imul(o.y | 0, 19349663);
        v = Math.imul(v ^ v >>> 16, 73244475);
        v = (v ^ v >>> 16) >>> 0;
        const lift = [0, 0.16, -0.12, 0.08][v & 3], leaf2 = v >> 2 & 1 ? "#5d824e" : "#67835a";
        brick(x + 0.15, z + 0.15, 0, 0.3, 0.3, 0.8 + lift, "#80664b", false);
        brick(x - 0.2, z - 0.2, 0.7 + lift, 1, 1, 0.4, leaf2);
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
      let v = Math.imul(resource.x | 0, 73856093) ^ Math.imul(resource.y | 0, 19349663);
      v = Math.imul(v ^ v >>> 16, 73244475);
      v = (v ^ v >>> 16) >>> 0;
      const n = 2 + Math.round(3 * Math.max(0, Math.min(1, resource.remaining / Math.max(1, resource.capacity))));
      for (let i = 0; i < n; i++) {
        const ox = [-0.26, 0.06, -0.08, 0.18, -0.3][i] + (v >> i & 1) * 0.04, oz = [-0.12, 0.1, -0.3, -0.22, 0.16][i], left = (v >> i + 3 & 1) === 1;
        brick(x + ox, z + oz, 0.025, 0.24, 0.09, 0.05, i % 2 ? "#c6dcd6" : "#d5e7de", false);
        brick(left ? x + ox + 0.24 : x + ox - 0.08, z + oz - 0.02, 0.025, 0.08, 0.13, 0.06, "#a9c2c0", false);
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
  function unit2(id, player, kind = "villager") {
    const group = new T.Group();
    scene.add(group);
    const beast = isAnimal(kind), frame = unitFrame(kind), bar2 = new T.Group();
    bar2.position.y = beast ? kind === "deer" ? 1.3 : 0.95 : frame.bar;
    bar2.visible = false;
    const back = new T.Mesh(barGeo, barBack);
    const fill = new T.Mesh(barGeo, new T.MeshBasicMaterial({ color: player === 0 ? "#5f9a6a" : player === 1 ? "#c0604c" : "#c9b27a" }));
    fill.position.z = 0.012;
    bar2.add(back, fill);
    group.add(bar2);
    const rig = beast ? createAnimalRig(T, kind, player, box, material) : isSiege(kind) ? createSiegeRig(T, kind, player, box, material) : isVessel(kind) ? createVesselRig(T, kind, player, box, material) : createCharacterRig(T, player, box, material);
    if (!beast && !isSiege(kind) && !isVessel(kind)) {
      if (!options.assetPreview && kind !== "villager") rig.dress(roleOf(kind));
      rig.equip(previewTool);
    }
    group.add(rig.root);
    detail.apply(group, zoom);
    const ring = new T.Mesh(ringGeo, ringMaterial);
    ring.position.y = 0.025;
    if (!beast) ring.scale.set(frame.ring, 1, frame.ring);
    group.add(ring);
    units.set(id, { group, rig, ring, player, moving: false, activity: "idle", tool: "none", poseStart: 0, bar: bar2, fill, goal: null, kind, relic: null, look: null, unpacked: false });
    return units.get(id);
  }
  let previewRole = "villager";
  const previewSiege = (role) => role === "trebuchet-packed" || role === "trebuchet-unpacked" ? "trebuchet" : isSiege(role) || isVessel(role) ? role : null;
  function previewRig(u, family) {
    u.rigs ??= /* @__PURE__ */ new Map([["character", u.rig]]);
    let rig = u.rigs.get(family);
    if (!rig) {
      rig = family === "character" ? createCharacterRig(T, u.player, box, material) : isVessel(family) ? createVesselRig(T, family, u.player, box, material) : createSiegeRig(T, family, u.player, box, material);
      u.group.add(rig.root);
      u.rigs.set(family, rig);
    }
    for (const r of u.rigs.values()) r.root.visible = r === rig;
    u.rig = rig;
    return rig;
  }
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
    const key = JSON.stringify([previewBuildingKind, previewBuilding, previewStyle, previewLayout, view.layout, view.seed, view.civs, view.fog, view.known?.map((k) => k.obstacle), view.resources, ownTower(view)]);
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
      const u = units.get(data.id) ?? unit2(data.id, data.player, data.kind);
      const goal = new T.Vector3(data.x / 100, (groundHeight(worldTiles, data.x, data.y) + standingLift(data.x, data.y)) / 100, data.y / 100), from = u.goal ?? u.group.position;
      const dx = goal.x - from.x, dz = goal.z - from.z;
      if (Math.abs(dx) + Math.abs(dz) > 1e-3) u.group.rotation.y = Math.atan2(dx, dz);
      if (!u.goal || options.assetPreview || u.group.position.distanceTo(goal) > 1.5) u.group.position.copy(goal);
      u.goal = goal;
      u.ring.visible = selected.has(data.id);
      u.moving = data.navigation === "moving";
      if (!options.assetPreview && (data.work === "gathering" || data.work === "hunting" || data.action === 1) && !u.moving && data.target) u.group.rotation.y = Math.atan2(data.target.x / 100 - u.group.position.x, data.target.y / 100 - u.group.position.z);
      if (!options.assetPreview) {
        const look = data.player === 0 ? lookOf(data.kind, view.economy?.techs ?? []) : null;
        if (look !== u.look) {
          u.look = look;
          u.rig.grade(look);
          u.tool = "";
          detail.apply(u.group, zoom);
        }
        if (data.kind === "trebuchet" && !!data.unpacked !== u.unpacked) {
          u.unpacked = !!data.unpacked;
          u.rig.dress(u.unpacked ? "unpacked" : "packed");
          const f = unitFrame("trebuchet", u.unpacked);
          u.bar.position.y = f.bar;
          u.ring.scale.set(f.ring, 1, f.ring);
          detail.apply(u.group, zoom);
        }
        const gathering = (data.work === "gathering" || data.work === "hunting") && !u.moving, activity = u.moving ? data.cargo ? "carry" : "walk" : gathering || data.rite ? "work" : "idle";
        const source = data.work === "gathering" && data.target ? view.resources.find((r) => r.x === data.target.x && r.y === data.target.y && !r.obstacleId) : void 0, food = data.work === "hunting" || source?.kind === "fish" ? "spear" : source ? "sickle" : "basket";
        const weapon = gradedWeapon(data.kind, u.look), tool = data.cargo && activity !== "work" ? "basket" : gathering ? { wood: "axe", stone: "pick", gold: "pick", food }[data.workResource ?? "food"] : weapon;
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
      let rig;
      if (isSiege(c.kind)) rig = createSiegeRig(T, c.kind, c.player, box, material);
      else if (isVessel(c.kind)) rig = createVesselRig(T, c.kind, c.player, box, material);
      else {
        const body = createCharacterRig(T, c.player, box, material);
        if (c.kind !== "villager") body.dress(corpseRole(c.kind));
        rig = body;
      }
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
  const buildingHeights = { "town-center": 2.6, barracks: 2.2, house: 1.9, farm: 0.25, "lumber-camp": 1.9, "mining-camp": 1.9, mill: 2.6, stable: 2.2, "archery-range": 2.2, blacksmith: 2.4, "watch-tower": 3.2, "siege-workshop": 2.2, monastery: 3.4, castle: 4.7, university: 3.6, market: 2.2, dock: 2.4, "fish-trap": 0.4, outpost: 2.1, "bombard-tower": 2.4, wonder: 4.6, "palisade-wall": 1.3, "stone-wall": 1.3, "palisade-gate": 1.5, gate: 1.6 };
  function pickBuilding(clientX, clientY) {
    if (!latest) return;
    const r = canvas.getBoundingClientRect();
    raycaster.setFromCamera(new T.Vector2((clientX - r.left) / r.width * 2 - 1, -(clientY - r.top) / r.height * 2 + 1), camera);
    let best, dist = Infinity;
    const hit = new T.Vector3();
    for (const { obstacle: o } of latest.known) {
      const h = buildingHeights[o.kind] + (o.kind === "watch-tower" && !o.red ? towerLift(ownTower(latest)) : 0);
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
    const pole = new T.Mesh(box(0.05, 0.9, 0.05), material("#80674f")), cloth2 = new T.Mesh(box(0.32, 0.2, 0.03), material("#456e87"));
    cloth2.position.set(0.17, 0.66, 0);
    rallyFlag.add(pole, cloth2);
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
  const wallGhosts = [];
  function setGhosts(list) {
    while (wallGhosts.length < list.length) {
      const m = new T.Mesh(ghost.geometry, new T.MeshBasicMaterial({ color: "#6f9d6a", transparent: true, opacity: 0.42, depthWrite: false }));
      scene.add(m);
      wallGhosts.push(m);
    }
    wallGhosts.forEach((m, i) => {
      const g = list[i];
      m.visible = !!g;
      if (!g) return;
      const [x0, y0, x1, y1] = obstacleBounds({ kind: g.kind, x: g.x, y: g.y });
      m.scale.set((x1 - x0) / 100, 1, (y1 - y0) / 100);
      m.position.set((x0 + x1) / 200, groundHeight(worldTiles, g.x, g.y) / 100 + 0.15, (y0 + y1) / 200);
      m.material.color.set(g.ok ? "#6f9d6a" : "#b8574a");
    });
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
      for (const kind of siegeKinds) {
        const rig = createSiegeRig(T, kind, 0, box, material);
        if (kind === "trebuchet") rig.dress("unpacked");
        rig.pose("idle", 0);
        const g = new T.Group();
        g.add(rig.root);
        shoot(kind, g, { angle: Math.PI / 4, lift: 0.5 });
        shoot(`${kind}-face`, g, { angle: Math.PI / 4, lift: 0.5 });
      }
      for (const kind of vesselKinds) {
        const rig = createVesselRig(T, kind, 0, box, material);
        rig.pose("idle", 0);
        const g = new T.Group();
        g.add(rig.root);
        shoot(kind, g, { angle: Math.PI / 4, lift: 0.6 });
        shoot(`${kind}-face`, g, { angle: Math.PI / 4, lift: 0.6 });
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
        shoot(`${kind}-face`, g, role === "war-elephant" ? { angle: Math.PI / 7, lift: 0.35, crop: 0.81, span: 0.15 } : role === "camel" ? { angle: Math.PI / 7, lift: 0.35, crop: 0.89, span: 0.19 } : role === "mameluke" || role === "mangudai" || role === "cavalry-archer" ? { angle: Math.PI / 7, lift: 0.35, crop: 0.84, span: 0.23 } : isMounted(role) ? { angle: Math.PI / 7, lift: 0.35, crop: 0.74, span: 0.21 } : { angle: Math.PI / 7, lift: 0.35, crop: 0.72 });
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
        shoot(`university-${age}`, parts(universityParts(visual(age))));
        shoot(`town-center-${age}`, parts(economicBuildingParts("town-center", visual(age))));
        for (const camp of ["lumber-camp", "mining-camp", "mill", "market"]) shoot(`${camp}-${age}`, parts(economicBuildingParts(camp, visual(age))));
        const run = { ...noLinks, e: true, w: true };
        shoot(`dock-${age}`, parts(dockParts(visual(age))));
        shoot(`fish-trap-${age}`, parts(fishTrapParts(visual(age))));
        shoot(`outpost-${age}`, parts(outpostParts(visual(age))));
        shoot(`bombard-tower-${age}`, parts(bombardTowerParts(visual(age))));
        shoot(`wonder-${age}`, parts(wonderParts(visual(age))));
        for (const k of ["palisade-wall", "stone-wall"]) shoot(`${k}-${age}`, parts(wallParts(k, visual(age), run)));
        for (const k of ["palisade-gate", "gate"]) shoot(`${k}-${age}`, parts(gateParts(k, visual(age), run)));
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
    setGhosts,
    renderIcons,
    cameraView,
    setPreviewBuildingKind: (kind) => {
      if (!options.assetPreview || !drawnBuildings.includes(kind) && !economicBuildings.includes(kind) && !militaryBuildings.includes(kind)) throw Error("\u672A\u77E5\u6A21\u578B\u5EFA\u7BC9");
      previewBuildingKind = kind;
      if (latest) update(latest, selected);
    },
    setPreviewStyle: (style) => {
      if (!options.assetPreview || !architectures.includes(style)) throw Error("\u672A\u77E5\u5EFA\u7BC9\u98A8\u683C");
      previewStyle = style;
      if (latest) update(latest, selected);
    },
    setPreviewRole: (role) => {
      const siege = previewSiege(role);
      if (!options.assetPreview || !unitRoles.includes(role) && !isMounted(role) && !siege) throw Error("\u50C5\u6A21\u578B\u6AA2\u8996\u53EF\u6307\u5B9A\u6709\u6548\u8ECD\u7A2E");
      previewRole = role;
      previewPose = "idle";
      const frame = siege ? unitFrame(siege, role === "trebuchet-unpacked") : frameOfRole(role);
      for (const u of units.values()) {
        const rig = previewRig(u, siege ?? "character");
        if (siege === "trebuchet") rig.dress(role === "trebuchet-unpacked" ? "unpacked" : "packed");
        else if (!siege) rig.dress(role);
        rig.grade(null);
        u.ring.scale.set(frame.ring, 1, frame.ring);
        detail.apply(u.group, zoom);
      }
    },
    // Line-upgrade look on the inspected model ('' or null: the base look); dressing again clears it.
    setPreviewGrade: (look) => {
      if (!options.assetPreview || look && !Object.values(upgradeLooks).some((line2) => line2.includes(look))) throw Error("\u672A\u77E5\u5347\u7D1A\u5916\u89C0");
      for (const u of units.values()) {
        u.rig.grade(look || null);
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
      if (!["meadow", "coast", "acceptance", "lakes"].includes(layout)) throw Error("\u672A\u77E5\u5730\u5716\u6A21\u5F0F");
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
  drawnBuildings,
  farmParts,
  unitFrame,
  weaponOf
};
