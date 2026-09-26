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
      add(`target-ring-${x}`, 3, x + 0.1, 0.88, 0.93, 0.36, 0.03, 0.4, "#aa5c48");
      add(`target-center-${x}`, 3, x + 0.2, 0.91, 1.03, 0.16, 0.03, 0.2, "#e5d4a8");
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
        add(`shield-boss-${x}`, 3, x + 0.04, 2.1, 0.57, 0.1, 0.04, 0.12, "#bca36f");
      }
    } else {
      for (const x of [0.15, 1.75]) {
        add(`stall-divider-${x}`, 1, x, 0.35, 0.16, 0.1, 1.3, 0.65, wood);
        add(`hay-${x}`, 3, x + 0.16, 0.4, 0.16, 0.62, 0.55, 0.3, "#beac69", true);
      }
      add("trough-base", 3, 0.6, 2.03, 0.16, 1.5, 0.4, 0.12, wood);
      for (const z of [2.03, 2.35]) add(`trough-rim-${z}`, 3, 0.6, z, 0.28, 1.5, 0.08, 0.2, wood);
      for (const x of [0.6, 2.02]) add(`trough-end-${x}`, 3, x, 2.11, 0.28, 0.08, 0.24, 0.2, wood);
      add("trough-water", 3, 0.69, 2.12, 0.28, 1.32, 0.22, 0.035, "#6a9297");
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

// apps/web/rig-roles.ts
function roleOf(kind) {
  return kind === "militia" ? "swordsman" : kind === "archer" ? "archer" : kind === "scout" ? "cavalry" : "villager";
}
function poseFor(kind, pose) {
  return roleOf(kind) === "cavalry" && !["idle", "walk", "attack"].includes(pose) ? "idle" : pose;
}
function corpseRole(kind) {
  const role = roleOf(kind);
  return role === "cavalry" ? "swordsman" : role;
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
  const p = [], age = v.ageVariant, team = v.red ? "#b85c47" : "#456e87", wood = "#94734c", stone = "#aaa994", brass = "#bca068", water = "#6a9297", height = 1.28 + (age - 1) * 0.16;
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
      add("boundary-back", 1, 0, 0, 0.16, 2.7, 0.08, 0.12, wood);
      add("boundary-front", 1, 0, 2.62, 0.16, 2.7, 0.08, 0.12, wood);
    } else {
      add("wall-back", 1, 0, 0, 0.16, 2.7, 0.08, 0.24, stone);
      for (const [x, w] of [[0, 1.08], [1.62, 1.08]]) add(`wall-front-${x}`, 1, x, 2.62, 0.16, w, 0.08, 0.24, stone);
      for (const x of [1.08, 1.46]) add(`gate-pier-${x}`, 1, x, 2.58, 0.16, 0.16, 0.16, 0.56, stone, true);
    }
    if (age >= 2) {
      for (const x of [0, 2.62]) add(age >= 3 ? `wall-side-${x}` : `boundary-side-${x}`, 1, x, 0.08, 0.16, 0.08, 2.54, age >= 3 ? 0.24 : 0.12, age >= 3 ? stone : wood);
      for (const x of [-0.12, 2.72]) for (const z of [-0.12, 2.72]) add(`fence-post-${x}-${z}`, 1, x, z, 0.16, 0.1, 0.1, age >= 3 ? 0.56 : 0.45, age >= 3 ? stone : wood);
    }
    if (age === 4) {
      add("gate-lintel", 1, 1.08, 2.58, 0.72, 0.54, 0.16, 0.16, team, true);
      add("scarecrow-post", 3, 1.3, 1.24, 0.16, 0.06, 0.06, 0.64, wood);
      add("scarecrow-arms", 3, 1.1, 1.24, 0.8, 0.46, 0.06, 0.06, wood);
      add("scarecrow-head", 3, 1.25, 1.19, 0.86, 0.16, 0.16, 0.22, "#c7b27a");
      add("scarecrow-hat", 3, 1.2, 1.15, 1.08, 0.26, 0.24, 0.06, "#6d563d");
    }
  } else {
    const hallHeight = 1.6 + (age - 1) * 0.16, towerTop = 0.16 + (age >= 3 ? 6 : 5) * 0.4, roofY = kind === "mill" ? towerTop : kind === "town-center" ? hallHeight + 0.16 : height + 0.16, masonry = kind !== "town-center", postBase = masonry && age >= 2 ? 0.4 : 0.16;
    for (const x of [0.1, 2.4]) for (const z of [0.1, 1.8]) add(`post-${x}-${z}`, 1, x, z, postBase, 0.16, 0.16, roofY - postBase, age >= 3 ? stone : wood);
    add("back-brace", 1, 0.1, 0.1, roofY - 0.24, 2.46, 0.14, 0.24, wood);
    if (kind === "market") {
      for (let stripe = 0; stripe < 6; stripe++) add(`awning-${stripe}`, 2, -0.05 + stripe * 0.48, -0.05, roofY, 0.48, 2.25, 0.16, stripe % 2 ? "#e4d4ab" : team);
    } else for (let level = 0; level < 3; level++) add(`roof-${level}`, 2, -0.05 + level * 0.28, -0.05, roofY + level * 0.16, 2.9 - level * 0.56, 2.25, 0.16, age === 1 ? "#b8a074" : team, true);
    if (masonry && age >= 2) for (const x of [0.1, 2.4]) for (const z of [0.1, 1.8]) add(`footing-${x}-${z}`, 1, x - 0.02, z - 0.02, 0.16, 0.2, 0.2, 0.24, stone);
    if (masonry && age >= 3) {
      if (kind !== "smithy") add("stone-plinth", 1, 0.28, 0.1, 0.16, 2.1, 0.14, 0.48, stone, true);
      for (const x of [-0.04, 2.56]) for (const z of [0.3, 1.46]) add(`buttress-${x}-${z}`, 1, x, z, 0.16, 0.14, 0.3, roofY - 0.16, stone);
    }
    if (kind === "lumber-camp") {
      for (let row = 0; row < 3; row++) for (let layer = 0; layer < 2; layer++) add(`log-${row}-${layer}`, 3, 0.25, 0.3 + row * 0.28, 0.16 + layer * 0.2, 1.6, 0.22, 0.2, wood, true);
      for (const x of [0.55, 1.75]) add(`saw-leg-${x}`, 3, x, 2.15, 0.16, 0.14, 0.32, 0.45, "#66563e");
      add("saw-worktop", 3, 0.35, 2.08, 0.61, 1.8, 0.48, 0.12, wood);
      add("saw-blade", 3, 0.9, 2.24, 0.73, 0.85, 0.06, 0.14, "#b8c0b9");
      if (age >= 2) {
        add("chopping-block", 3, 2, 0.9, 0.16, 0.35, 0.35, 0.3, "#7c674b", true);
        add("axe-handle", 3, 2.15, 1.05, 0.46, 0.05, 0.05, 0.4, wood);
        add("axe-head", 3, 2.08, 1.04, 0.78, 0.2, 0.07, 0.08, "#b8c0b9");
      }
      if (age === 4) {
        add("crane-mast", 3, 2.5, 2.3, 0.16, 0.16, 0.16, roofY + 0.32, wood);
        add("crane-jib", 3, 1.2, 2.3, roofY + 0.48, 1.46, 0.16, 0.16, wood);
        add("crane-rope", 3, 1.34, 2.36, roofY - 0.32, 0.04, 0.04, 0.8, "#8c8879");
        add("crane-hook", 3, 1.28, 2.3, roofY - 0.44, 0.16, 0.16, 0.12, "#76817d");
      }
    } else if (kind === "mining-camp") {
      add("hopper-base", 3, 0.35, 0.4, 0.16, 1.7, 0.9, 0.16, wood);
      for (const x of [0.35, 1.89]) add(`hopper-wall-${x}`, 3, x, 0.4, 0.32, 0.16, 0.9, 0.55, wood);
      add("hopper-back", 3, 0.35, 0.4, 0.32, 1.7, 0.16, 0.55, wood);
      for (let i = 0; i < 6; i++) add(`ore-${i}`, 3, 0.59 + i % 3 * 0.39, 0.62 + Math.floor(i / 3) * 0.32, 0.32, 0.3, 0.26, 0.25, i % 2 ? stone : "#c0a557", true);
      add("pick-handle", 3, 2.42, 0.8, 0.16, 0.06, 0.06, 1.05, wood);
      add("pick-head", 3, 2.2, 0.8, 1.12, 0.5, 0.08, 0.1, "#b8c0b9");
      if (age >= 2) {
        for (const z of [2.3, 2.62]) add(`rail-${z}`, 1, 0.7, z, 0.16, 1.1, 0.06, 0.06, "#76817d");
        add("cart-body", 3, 1, 2.26, 0.22, 0.5, 0.46, 0.3, "#7c674b");
        add("cart-ore", 3, 1.08, 2.34, 0.52, 0.34, 0.3, 0.12, "#c0a557", true);
      }
      if (age === 4) {
        for (const x of [0.4, 1.94]) add(`headframe-leg-${x}`, 3, x, 2.42, 0.16, 0.16, 0.16, roofY + 0.12, wood);
        add("headframe-beam", 3, 0.4, 2.42, roofY + 0.28, 1.7, 0.16, 0.16, wood);
        add("headframe-wheel", 3, 1.1, 2.44, roofY + 0.44, 0.3, 0.12, 0.3, "#76817d");
        add("headframe-rope", 3, 1.23, 2.48, 1.2, 0.04, 0.04, roofY - 0.92, "#8c8879");
        add("headframe-bucket", 3, 1.13, 2.38, 0.96, 0.24, 0.24, 0.24, "#7c674b");
      }
    } else if (kind === "mill") {
      for (let course = 0; course < (age >= 3 ? 6 : 5); course++) add(`mill-tower-${course}`, 1, 0.85, 0.6, 0.16 + course * 0.4, 1, 1, 0.4, course % 2 ? stone : "#c4bfa8", true);
      const hubY = towerTop - 0.5;
      add("axle", 3, 1.28, 1.6, hubY, 0.14, 0.83, 0.14, wood);
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
        add("cupola-base", 2, 1, 0.6, base, 0.8, 0.8, 0.16, stone);
        for (const x of [1, 1.68]) for (const z of [0.6, 1.28]) add(`cupola-post-${x}-${z}`, 3, x, z, base + 0.16, 0.12, 0.12, 0.4, stone);
        add("cupola-cap", 3, 0.92, 0.52, base + 0.56, 0.96, 0.96, 0.16, team, true);
        add("vane-pole", 4, 1.38, 0.98, base + 0.72, 0.04, 0.04, 0.5, "#76817d");
        add("vane-arrow", 4, 1.42, 0.98, base + 1.06, 0.3, 0.03, 0.12, brass);
      }
    } else if (kind === "town-center") {
      for (const x of [0.15, 2.05]) add(`hall-pier-${x}`, 1, x, 0.15, 0.16, 0.5, 1.5, hallHeight, stone, true);
      add("entrance-lintel", 1, 0.65, 1.5, 0.16, 1.4, 0.25, 1.6, stone, false, "arch");
      if (hallHeight > 1.6) add("entrance-course", 1, 0.65, 1.5, 1.76, 1.4, 0.25, hallHeight - 1.6, stone);
      add("entrance-paving", 3, 0.95, 1.75, 0.16, 0.8, 1.05, 0.02, "#c8bea4");
      if (age >= 2) {
        let towerBase = roofY + 0.48;
        if (age >= 3) for (let course = 0; course < 2; course++) add(`tower-course-${course}`, 2, 0.87, 0.65, towerBase + course * 0.32, 0.96, 0.85, 0.32, stone);
        if (age >= 3) towerBase += 0.64;
        add("belfry-floor", 3, 0.87, 0.65, towerBase, 0.96, 0.85, 0.16, stone, true);
        for (const x of [0.91, 1.63]) for (const z of [0.69, 1.25]) add(`belfry-pillar-${x}-${z}`, 3, x, z, towerBase + 0.16, 0.12, 0.12, 0.65, stone);
        add("belfry-top", 3, 0.8, 0.58, towerBase + 0.81, 1.1, 1, 0.16, team, true);
        add("bell-hanger", 3, 1.33, 0.98, towerBase + 0.55, 0.05, 0.05, 0.26, wood);
        add("bell", 3, 1.2, 0.88, towerBase + 0.4, 0.3, 0.28, 0.22, brass);
        if (age === 4) {
          const top = towerBase + 0.97;
          add("spire-0", 3, 0.95, 0.73, top, 0.8, 0.7, 0.16, team, true);
          add("spire-1", 3, 1.1, 0.88, top + 0.16, 0.5, 0.4, 0.16, team);
          add("spire-2", 3, 1.23, 0.98, top + 0.32, 0.24, 0.2, 0.24, team);
          add("spire-finial", 4, 1.31, 1.04, top + 0.56, 0.08, 0.08, 0.3, brass);
        }
      }
      add("notice-board", 3, 0.14, 1.9, 0.72, 0.48, 0.08, 0.4, wood);
      add("notice-paper", 3, 0.2, 1.98, 0.78, 0.34, 0.025, 0.27, "#e5d9b3");
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
      if (age >= 2) for (let stripe = 0; stripe < 6; stripe++) add(`valance-${stripe}`, 2, -0.05 + stripe * 0.48, 2.14, roofY - 0.12, 0.48, 0.06, 0.12, stripe % 2 ? team : "#e4d4ab");
      if (age >= 3) add("arcade-arch", 1, 0.28, 1.8, 0.16, 2.1, 0.16, roofY - 0.16, stone, false, "arch");
      if (age === 4) {
        const base = roofY + 0.16;
        add("pavilion-floor", 2, 0.95, 0.55, base, 0.9, 0.9, 0.12, stone);
        for (const x of [0.99, 1.69]) for (const z of [0.59, 1.29]) add(`pavilion-post-${x}-${z}`, 3, x, z, base + 0.12, 0.12, 0.12, 0.44, wood);
        add("pavilion-roof", 3, 0.87, 0.47, base + 0.56, 1.06, 1.06, 0.16, team, true);
        add("pavilion-finial", 4, 1.36, 0.96, base + 0.72, 0.08, 0.08, 0.26, brass);
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
      if (age >= 2) {
        add("quench-trough", 3, 1.2, 1.26, 0.16, 0.7, 0.36, 0.24, wood);
        add("quench-water", 3, 1.26, 1.32, 0.4, 0.58, 0.24, 0.02, water);
      }
      if (age >= 3) add("side-wall", 1, 2.4, 0.28, 0.16, 0.16, 1.5, 0.8, stone, true);
      if (age === 4) {
        add("race-channel", 1, 2.58, 0.62, 0.16, 0.26, 0.82, 0.08, wood);
        add("race-water", 1, 2.6, 0.64, 0.24, 0.22, 0.78, 0.04, water);
        add("wheel-axle", 3, 2.56, 1.02, 0.66, 0.06, 0.08, 0.08, wood);
        add("wheel-paddle-vertical", 3, 2.62, 0.98, 0.28, 0.12, 0.16, 0.8, wood);
        add("wheel-paddle-horizontal", 3, 2.62, 0.68, 0.6, 0.12, 0.76, 0.16, wood);
        add("wheel-hub", 3, 2.6, 0.94, 0.56, 0.16, 0.24, 0.24, "#76817d");
      }
    }
  }
  add("marker-pole", 4, 2.65, 2.7, 0.16, 0.06, 0.06, kind === "farm" ? 0.65 : height + 0.6, wood);
  add("marker-flag", 4, 2.34, 2.7, kind === "farm" ? 0.61 : height + 0.44, 0.32, 0.05, 0.22, team);
  if (v.health === 0) return [p[0], ...Array.from({ length: 12 }, (_, i) => ({ id: `debris-${i}`, phase: 0, x: 0.2 + i % 4 * 0.6, z: 0.2 + Math.floor(i / 4) * 0.7, y: 0.16, w: 0.34, d: 0.3, h: 0.12, color: wood, studs: false }))];
  const built = p.filter((a) => a.phase <= Math.min(4, Math.floor(v.progress / 20)));
  if (v.health >= 50) return built;
  const roofTop = built.find((a) => a.id === "roof-2"), loaded = roofTop && built.some((a) => a !== roofTop && Math.abs(a.y - roofTop.y - roofTop.h) < 1e-8 && a.x < roofTop.x + roofTop.w && a.x + a.w > roofTop.x && a.z < roofTop.z + roofTop.d && a.z + a.d > roofTop.z);
  return built.filter((a) => !(a.id === "marker-flag" || a.id === "roof-2" && !loaded || /^(awning|valance)-[24]$/.test(a.id) || a.id.startsWith("grain-") || a.id === "blade-horizontal" || a.id.endsWith("-finial") || a.id === "vane-arrow"));
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
var sizeOfTiles = (tiles) => Math.round(Math.sqrt(tiles.length));
function groundHeight(tiles, x, y) {
  return tiles[tileAt(x, y, sizeOfTiles(tiles))]?.height ?? 0;
}
function tileAt(x, y, size) {
  return Math.floor(y / 100) * size + Math.floor(x / 100);
}
function canTraverse(tile, movement) {
  return tile.walkClass === movement || tile.walkClass === "both";
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
  const addResource = (kind, x, y) => {
    const id = `resource-${kind}-${x}-${y}`, capacity = terrainRules.resourceCapacity[kind], obstacleId = kind === "fish" ? null : `obstacle-${kind}-${x}-${y}`;
    if (obstacleId && kind !== "fish") {
      map.obstacles.push({ id: obstacleId, kind, x, y });
      map.tiles[tileAt(x, y, map.size)].obstacleRefs.push(obstacleId);
    }
    map.resources.push({ id, kind, x, y, capacity, remaining: capacity, collectible: true, status: "available", obstacleId, depletedAt: null });
    map.tiles[tileAt(x, y, map.size)].resourceRefs.push(id);
  };
  for (const x of [300, 1200]) addResource("livestock", x, 900);
  for (const x of [500, 1e3]) addResource("hunt", x, 1e3);
  if (layout === "coast") for (const x of [300, 1200]) addResource("fish", x, 1450);
  if (layout === "acceptance") for (const y of [300, 1200]) addResource("fish", 800, y);
  for (let i = 0; i < nodeTotal(map); i++) if (!clearSegment(map, position(map, i), position(map, i))) map.blocked.push(i);
  return map;
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
  dirtPatches: 7
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
  const put = (kind, tx, ty) => {
    taken.add(ty * size + tx);
    const x = tx * 100 + offset[kind], y = ty * 100 + offset[kind];
    if (kind === "hunt" || kind === "livestock") animals.push({ kind, x, y });
    else obstacles.push({ kind, x, y });
  };
  centres.forEach((c) => {
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
  for (const { kind, x, y } of animals) {
    const id = `resource-${kind}-${x}-${y}`, capacity = terrainRules.resourceCapacity[kind], obstacleId = `obstacle-${kind}-${x}-${y}`;
    map.obstacles.push({ id: obstacleId, kind, x, y });
    map.tiles[tileAt(x, y, size)].obstacleRefs.push(obstacleId);
    map.resources.push({ id, kind, x, y, capacity, remaining: capacity, collectible: true, status: "available", obstacleId, depletedAt: null });
    map.tiles[tileAt(x, y, size)].resourceRefs.push(id);
  }
  for (let i = 0; i < nodeTotal(map); i++) if (!clearSegment(map, position(map, i), position(map, i))) map.blocked.push(i);
  return map;
}
var buildingKinds = /* @__PURE__ */ new Set(["house", "town-center", "barracks", "farm", "lumber-camp", "mining-camp", "mill", "stable", "archery-range"]);
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
    const tile = map.tiles[y * size + x];
    if (x < size - 1 && Math.abs(tile.height - map.tiles[tile.id + 1].height) > maxStep && intersects(a, b, [(x + 1) * 100 - radius, y * 100 - radius, (x + 1) * 100 + radius, (y + 1) * 100 + radius])) return false;
    if (y < size - 1 && Math.abs(tile.height - map.tiles[tile.id + size].height) > maxStep && intersects(a, b, [x * 100 - radius, (y + 1) * 100 - radius, (x + 1) * 100 + radius, (y + 1) * 100 + radius])) return false;
    if (!canTraverse(tile, movement) && intersects(a, b, [x * 100 - radius, y * 100 - radius, x * 100 + 100 + radius, y * 100 + 100 + radius])) return false;
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
  for (const tile of map.tiles) {
    if (!Number.isSafeInteger(tile.height) || tile.height < 0) errors.push(`\u5730\u683C ${tile.id} \u9AD8\u5EA6\u7121\u6548`);
    if (!["land", "water", "both", "blocked"].includes(tile.walkClass) || typeof tile.buildability !== "boolean") errors.push(`\u5730\u683C ${tile.id} \u901A\u884C\u6216\u5EFA\u9020\u898F\u5247\u7121\u6548`);
    if (tile.resourceRefs.some((id) => !resources.has(id)) || tile.obstacleRefs.some((id) => !obstacles.has(id))) errors.push(`\u5730\u683C ${tile.id} \u53C3\u7167\u5931\u6548`);
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
  const spawns = [...map.starts.flat(), ...map.scouts ?? []];
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
var brickStyle = { studPitch: 0.5, plateHeight: 0.16, brickHeight: 0.32, bevel: 0.025, roughness: 0.72, provenance: "original_procedural" };
function farmParts(progress, red) {
  const out = [{ x: 0, y: 0, z: 0, w: 2, d: 2, h: 0.1, color: "#806b49", studs: false }];
  if (progress < 100) {
    out.push({ x: 0.05, y: 0.1, z: 0.05, w: 0.08, d: 0.08, h: 0.4, color: red ? "#b85c47" : "#456e87", studs: false });
    return out;
  }
  for (const z of [0.2, 0.7, 1.2, 1.7]) out.push({ x: 0.15, y: 0.1, z: z - 0.1, w: 1.7, d: 0.2, h: 0.12, color: "#9bb65a", studs: true });
  out.push({ x: 0.05, y: 0.1, z: 0.05, w: 0.08, d: 0.08, h: 0.4, color: red ? "#b85c47" : "#456e87", studs: false });
  return out;
}
async function createScene(canvas, onFailure, options = {}) {
  const T = await import(new URL("../../../vendor/three-0.186.0/three.module.js", import.meta.url).href);
  if (!canvas.getContext("webgl2")) throw Error("\u6B64\u88DD\u7F6E\u7121\u6CD5\u5EFA\u7ACB WebGL2\uFF0C\u8ACB\u4F7F\u7528\u652F\u63F4 WebGL2 \u7684\u700F\u89BD\u5668\u3002");
  let contextLost = false, previewLayout = "meadow";
  const renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.setClearColor("#d7e0cc");
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.35;
  const detail = createDetailController(T);
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
      const geo = new T.BoxGeometry(1, h, 1);
      geo.translate(0, h / 2, 0);
      geometry.set(key, geo);
      groundGeometries.add(geo);
    }
    staticPart(geometry.get(key), color, x + 0.5, -0.24, z + 0.5);
  }
  let previewBuildingKind = "house";
  let previewBuilding = { ageVariant: 2, progress: 100, health: 100 };
  function house(x, z, red = false, obstacleKind = "house", progress = 100, age = 2, health = 100) {
    const kind = options.assetPreview ? previewBuildingKind : obstacleKind, visual = options.assetPreview ? previewBuilding : { ...previewBuilding, progress, health, ageVariant: Math.min(4, Math.max(1, age)) }, parts = kind === "house" ? buildingParts({ ...visual, red }) : militaryBuildings.includes(kind) ? militaryBuildingParts(kind, { ...visual, red }) : economicBuildingParts(kind, { ...visual, red });
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
    const map = options.assetPreview ? makeMap(seed, previewLayout) : { tiles: view.terrain.map((tile, id) => ({ ...tile, id, resourceRefs: [], obstacleRefs: [] })), obstacles: view.known.map((k) => k.obstacle), resources: view.resources };
    worldTiles = map.tiles;
    board = sizeOfTiles(map.tiles);
    platforms = map.obstacles.flatMap((o) => {
      const p = walkablePlatforms[o.kind];
      return p ? [{ x0: o.x + p.rect[0], y0: o.y + p.rect[1], x1: o.x + p.rect[2], y1: o.y + p.rect[3], height: p.height }] : [];
    });
    let rng = seed || 1;
    for (const tile of map.tiles) {
      const x = tile.id % board, z = Math.floor(tile.id / board);
      rng ^= rng << 13;
      rng ^= rng >>> 17;
      rng ^= rng << 5;
      const n = (rng >>> 0) / 4294967296;
      groundBlock(x, z, tile.height / 100, !options.assetPreview && view.fog[tile.id] !== 2 ? view.fog[tile.id] === 1 ? "#626e64" : "#293e38" : tile.terrainType === "cliff" ? "#8a8065" : tile.terrainType === "stone" ? "#a1a28e" : tile.terrainType === "highland" ? "#879d69" : tile.terrainType === "water" ? "#4b8291" : tile.terrainType === "shallow" ? "#86b7b8" : tile.terrainType === "sand" ? "#d5c598" : tile.terrainType === "road" ? "#c4b18a" : n < 0.2 ? "#a6b582" : n < 0.5 ? "#b5c493" : "#becda0");
    }
    for (const o of map.obstacles) {
      baseHeight = groundHeight(map.tiles, o.x, o.y) / 100;
      muted = !options.assetPreview && view.fog[tileAt(o.x, o.y, sizeOfTiles(map.tiles))] !== 2;
      const x = o.x / 100, z = o.y / 100;
      if (o.kind === "farm") for (const p of farmParts(o.progress ?? 100, o.red)) brick(x + p.x, z + p.z, p.y, p.w, p.d, p.h, p.color, p.studs);
      else if (o.kind === "house" || o.kind === "town-center" || o.kind === "barracks" || o.kind === "lumber-camp" || o.kind === "mining-camp" || o.kind === "mill" || o.kind === "stable" || o.kind === "archery-range") house(x, z, o.red, o.kind, o.progress ?? 100, o.age ?? 2, o.damaged ? 35 : 100);
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
      mesh.computeBoundingSphere();
      mesh.userData.studs = geo === studGeo;
      mesh.userData.ground = groundGeometries.has(geo);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      staticGroup.add(mesh);
    }
  }
  const units = /* @__PURE__ */ new Map();
  const fallen = /* @__PURE__ */ new Map();
  const barBack = new T.MeshBasicMaterial({ color: "#2d3a33" }), barGeo = new T.BoxGeometry(0.5, 0.05, 0.05);
  const ringGeo = new T.RingGeometry(0.4, 0.47, 32);
  ringGeo.rotateX(-Math.PI / 2);
  geometry.set("ring", ringGeo);
  const ringMaterial = new T.MeshBasicMaterial({ color: "#fff2a1", side: T.DoubleSide });
  function unit(id, player, kind = "villager") {
    const group = new T.Group();
    scene.add(group);
    const bar = new T.Group();
    bar.position.y = 1.42;
    bar.visible = false;
    const back = new T.Mesh(barGeo, barBack);
    const fill = new T.Mesh(barGeo, new T.MeshBasicMaterial({ color: player === 0 ? "#5f9a6a" : "#c0604c" }));
    fill.position.z = 0.012;
    bar.add(back, fill);
    group.add(bar);
    const rig = createCharacterRig(T, player, box, material);
    if (!options.assetPreview && kind !== "villager") rig.dress(roleOf(kind));
    rig.equip(previewTool);
    group.add(rig.root);
    detail.apply(group, zoom);
    const ring = new T.Mesh(ringGeo, ringMaterial);
    ring.position.y = 0.025;
    group.add(ring);
    units.set(id, { group, rig, ring, player, moving: false, activity: "idle", tool: "none", poseStart: 0, bar, fill, goal: null, kind });
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
    const key = JSON.stringify([previewBuildingKind, previewBuilding, previewLayout, view.layout, view.seed, view.fog, view.known?.map((k) => k.obstacle), view.resources]);
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
      const u = units.get(data.id) ?? unit(data.id, data.player, data.kind);
      const goal = new T.Vector3(data.x / 100, (groundHeight(worldTiles, data.x, data.y) + standingLift(data.x, data.y)) / 100, data.y / 100), from = u.goal ?? u.group.position;
      const dx = goal.x - from.x, dz = goal.z - from.z;
      if (Math.abs(dx) + Math.abs(dz) > 1e-3) u.group.rotation.y = Math.atan2(dx, dz);
      if (!u.goal || options.assetPreview || u.group.position.distanceTo(goal) > 1.5) u.group.position.copy(goal);
      u.goal = goal;
      u.ring.visible = selected.has(data.id);
      u.moving = data.navigation === "moving";
      if (!options.assetPreview && (data.work === "gathering" || data.action === 1) && !u.moving && data.target) u.group.rotation.y = Math.atan2(data.target.x / 100 - u.group.position.x, data.target.y / 100 - u.group.position.z);
      if (!options.assetPreview) {
        const gathering = data.work === "gathering" && !u.moving, activity = u.moving ? data.cargo ? "carry" : "walk" : gathering ? "work" : "idle";
        const weapon = data.kind === "militia" ? "sword" : data.kind === "archer" ? "bow" : data.kind === "scout" ? "spear" : "none", tool = data.cargo && activity !== "work" ? "basket" : gathering ? { wood: "axe", stone: "pick", gold: "pick", food: "basket" }[data.workResource ?? "food"] : weapon;
        if (tool !== u.tool) {
          u.rig.equip(tool);
          u.tool = tool;
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
  const buildingHeights = { "town-center": 2.6, barracks: 2.2, house: 1.9, farm: 0.25, "lumber-camp": 1.9, "mining-camp": 1.9, mill: 2.6, stable: 2.2, "archery-range": 2.2 };
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
  function draw(time) {
    if (contextLost) return;
    resize();
    const dt = lastDraw ? Math.min(100, Math.max(0, time - lastDraw)) : 0, ease = 1 - Math.exp(-dt / 60);
    lastDraw = time;
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
      for (const kind of ["villager", "militia", "archer", "scout"]) {
        const rig = createCharacterRig(T, 0, box, material);
        if (kind !== "villager") rig.dress(roleOf(kind));
        rig.equip(kind === "militia" ? "sword" : kind === "archer" ? "bow" : kind === "scout" ? "spear" : "none");
        rig.pose("idle", 0);
        const g = new T.Group();
        g.add(rig.root);
        shoot(kind, g, { angle: Math.PI / 7, lift: 0.35 });
        shoot(`${kind}-face`, g, kind === "scout" ? { angle: Math.PI / 7, lift: 0.35, crop: 0.74, span: 0.21 } : { angle: Math.PI / 7, lift: 0.35, crop: 0.72 });
      }
      const visual = (age) => ({ ageVariant: age, progress: 100, health: 100, red: false });
      for (const age of [1, 2, 3, 4]) {
        shoot(`house-${age}`, parts(buildingParts(visual(age))));
        shoot(`barracks-${age}`, parts(militaryBuildingParts("barracks", visual(age))));
        shoot(`stable-${age}`, parts(militaryBuildingParts("stable", visual(age))));
        shoot(`archery-range-${age}`, parts(militaryBuildingParts("archery-range", visual(age))));
        shoot(`town-center-${age}`, parts(economicBuildingParts("town-center", visual(age))));
        for (const camp of ["lumber-camp", "mining-camp", "mill"]) shoot(`${camp}-${age}`, parts(economicBuildingParts(camp, visual(age))));
      }
      shoot("farm", parts(farmParts(100, false), false));
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
      if (!options.assetPreview || kind !== "house" && !economicBuildings.includes(kind) && !militaryBuildings.includes(kind)) throw Error("\u672A\u77E5\u6A21\u578B\u5EFA\u7BC9");
      previewBuildingKind = kind;
      if (latest) update(latest, selected);
    },
    setPreviewRole: (role) => {
      if (!options.assetPreview || !unitRoles.includes(role) && role !== "cavalry") throw Error("\u50C5\u6A21\u578B\u6AA2\u8996\u53EF\u6307\u5B9A\u6709\u6548\u8ECD\u7A2E");
      previewRole = role;
      previewPose = "idle";
      for (const u of units.values()) {
        u.rig.dress(role);
        u.ring.scale.set(role === "cavalry" ? 1.8 : 1, 1, role === "cavalry" ? 1.8 : 1);
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
      zoom = 2.5;
      cameraUpdate();
    },
    setPreviewMotion: (pose, tool, animated) => {
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
    },
    setPreviewLayout: (layout) => {
      if (!options.assetPreview) throw Error("\u50C5\u6A21\u578B\u6AA2\u8996\u53EF\u5207\u63DB\u9A57\u6536\u5716");
      if (!["meadow", "coast", "acceptance"].includes(layout)) throw Error("\u672A\u77E5\u5730\u5716\u6A21\u5F0F");
      previewLayout = layout;
      if (latest) update(latest, selected);
    },
    zoom: (delta) => {
      zoom = Math.max(minZoom(), Math.min(2.5, zoom + delta));
      cameraUpdate();
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
  brickStyle,
  createScene,
  farmParts
};
