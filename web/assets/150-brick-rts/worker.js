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
  if (o.kind === "farm" || o.kind === "fish-trap" || o.kind === "gate" || o.kind === "palisade-gate") return [];
  if (o.kind !== "town-center") return [obstacleBounds(o, radius)];
  return townCenterBlocking.map(([x0, y0, x1, y1]) => [o.x + x0 - radius, o.y + y0 - radius, o.x + x1 + radius, o.y + y1 + radius]);
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
    missing: ["crop-rotation", "stone-shaft-mining", "redemption", "atonement", "heresy", "hussar", "paladin", "camel", "heavy-camel", "siege-ram", "siege-onager", "treadmill-crane", "bloodlines", "thumb-ring", "parthian-tactics", "hand-cannoneer", "bombard-cannon", "elite-cannon-galleon", "bombard-tower", "bombard-tower-tech"],
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
      fx("britons.warwolf", "blast", { kinds: ["trebuchet"] }, 75, "\u6230\u72FC\u865F\uFF1A\u5DE8\u578B\u6295\u77F3\u6A5F\u7684\u77F3\u5F48\u6CE2\u53CA\u843D\u9EDE\u5468\u570D\u7684\u6575\u5175", { tech: "warwolf" }),
      // aoetw: 100% against standing targets; here the trebuchet strikes buildings only, which always stand.
      fx("britons.warwolf-accuracy", "accuracy", { kinds: ["trebuchet"] }, 100, "\u6230\u72FC\u865F\uFF1A\u5DE8\u578B\u6295\u77F3\u6A5F\u5C04\u64CA\u975C\u6B62\u76EE\u6A19\u5FC5\u4E2D", { tech: "warwolf" })
    ],
    omitted: [],
    sources: [site("civs/Britons"), site("units/Longbowman"), site("techs/Yeomen"), site("techs/Warwolf"), site("tree/bri")]
  },
  {
    id: "celts",
    name: "\u585E\u723E\u7279",
    nameEn: "Celts",
    type: "\u6B65\u5175\u8207\u653B\u57CE\u5668\u6587\u660E",
    architecture: "west",
    missing: ["two-man-saw", "crop-rotation", "bracer", "ring-archer-armor", "plate-barding-armor", "redemption", "atonement", "illumination", "block-printing", "theocracy", "arbalest", "camel", "heavy-camel", "architecture", "bloodlines", "thumb-ring", "parthian-tactics", "squires", "hand-cannoneer", "bombard-cannon", "bombard-tower", "bombard-tower-tech", "elite-cannon-galleon", "fast-fire-ship"],
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
    missing: ["two-man-saw", "stone-shaft-mining", "bracer", "ring-archer-armor", "redemption", "arbalest", "hussar", "camel", "heavy-camel", "siege-ram", "siege-onager", "keep", "bloodlines", "thumb-ring", "parthian-tactics", "sappers", "bombard-tower", "bombard-tower-tech", "heated-shot", "shipwright", "elite-cannon-galleon", "guilds"],
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
    missing: ["gold-shaft-mining", "plate-mail-armor", "plate-barding-armor", "redemption", "atonement", "heresy", "block-printing", "arbalest", "paladin", "camel", "heavy-camel", "siege-ram", "siege-onager", "siege-engineers", "guard-tower", "keep", "treadmill-crane", "arrowslits", "thumb-ring", "parthian-tactics", "arson", "hoardings", "bombard-tower", "bombard-tower-tech", "elite-cannon-galleon", "dry-dock", "fortified-wall"],
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
    missing: ["stone-shaft-mining", "plate-barding-armor", "redemption", "sanctity", "illumination", "theocracy", "halberdier", "heavy-cavalry-archer", "hussar", "paladin", "camel", "heavy-camel", "siege-onager", "keep", "bloodlines", "husbandry", "parthian-tactics", "herbal-medicine", "hand-cannoneer", "bombard-cannon", "bombard-tower", "bombard-tower-tech", "fire-galley", "fast-fire-ship", "elite-cannon-galleon", "shipwright", "guilds"],
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
    missing: ["masonry", "architecture", "blast-furnace", "siege-onager", "heavy-scorpion", "siege-engineers", "treadmill-crane", "bloodlines", "parthian-tactics", "sappers", "herbal-medicine", "heated-shot", "bombard-tower", "bombard-tower-tech"],
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
    missing: ["bracer", "redemption", "atonement", "heresy", "sanctity", "illumination", "two-handed-swordsman", "champion", "arbalest", "siege-onager", "siege-engineers", "keep", "treadmill-crane", "arrowslits", "shipwright", "bombard-tower", "bombard-tower-tech", "fortified-wall"],
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
    missing: ["crop-rotation", "stone-shaft-mining", "halberdier", "cavalier", "paladin", "heavy-scorpion", "architecture", "sappers", "bombard-tower", "bombard-tower-tech", "heated-shot", "shipwright", "guilds", "fast-fire-ship"],
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
    missing: ["crop-rotation", "stone-shaft-mining", "plate-barding-armor", "heresy", "paladin", "camel", "heavy-camel", "siege-ram", "siege-onager", "architecture", "hoardings", "bombard-cannon", "bombard-tower", "bombard-tower-tech", "heated-shot", "guilds", "heavy-demolition-ship"],
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
    missing: ["halberdier", "two-man-saw", "crop-rotation", "plate-barding-armor", "ring-archer-armor", "redemption", "sanctity", "faith", "block-printing", "paladin", "architecture", "keep", "treadmill-crane", "arrowslits", "bombard-cannon", "bombard-tower", "bombard-tower-tech", "elite-cannon-galleon", "heated-shot", "guilds", "dry-dock"],
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

// packages/content/rules.ts
var resources = ["food", "wood", "gold", "stone"];
var entry = (id, kind, name, food = 0, wood = 0, gold = 0, stone = 0, requires = [], population = 0, time = 20, source = "original design defaults: packages/content/rules.ts") => ({ referenceVersion: null, sourceEvidence: [source], implementationStatus: id === "villager" ? "in_progress" : "not_started", testEvidence: ["tests/foundation.test.ts (data validation only)"], id, kind, name, cost: { food, wood, gold, stone }, time, population, requires, verificationStatus: "design_default" });
var aoetw = "aoetw.com via github.com/webrsb/aoetw (2026-09-30), design_default in this ruleset";
var unique = (id, name, food, wood, gold, time) => entry(id, "unit", name, food, wood, gold, 0, [], 1, time, aoetw);
var upgrade = (id, name, food, wood, gold, stone, age, time) => entry(id, "technology", name, food, wood, gold, stone, [`age-${age}`], 0, time, aoetw);
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
var unit = (id, name, food, wood, gold, age, time) => entry(id, "unit", name, food, wood, gold, 0, [`age-${age}`], 1, time, aoetw);
var line = (id, name, food, wood, gold, after, time) => entry(id, "technology", name, food, wood, gold, 0, after ? ["age-4", after] : ["age-4"], 0, time, aoetw);
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
var tech = (id, name, food, wood, gold, stone, requires, time) => entry(id, "technology", name, food, wood, gold, stone, requires, 0, time, aoetw);
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
  // The 戰術技巧 round (aoetw.com techs/Ballistics): every civilization of this game has it.
  tech("ballistics", "\u5F48\u9053\u5B78", 0, 300, 175, 0, ["age-3"], 60),
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
  ballistics: "university",
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
var building = (id, name, wood, gold, stone, requires, time, page) => entry(id, "building", name, 0, wood, gold, stone, requires, 0, time, `aoetw.com/building/${page}; build time design_default`);
var ship = (id, name, wood, gold, requires, time) => entry(id, "unit", name, 0, wood, gold, 0, requires, 1, time, aoetw);
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
function civilizationsOf(entries, allTechs = false) {
  const ids = entries.map((e) => e.id), uniqueIds = new Set(civDefs.flatMap((c) => [...c.uniqueUnits, ...c.eliteUpgrades, ...c.uniqueTechs.map((t) => t.id)]));
  return civDefs.map((c) => {
    const own = /* @__PURE__ */ new Set([...c.uniqueUnits, ...c.eliteUpgrades, ...c.uniqueTechs.map((t) => t.id)]);
    const unavailable = ids.filter((id) => !allTechs && c.missing.includes(id) || uniqueIds.has(id) && !own.has(id) || id === "castle" && !c.uniqueUnits.length);
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
var allTechCivilizations = civilizationsOf(rules.entries, true);

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
function tileAt(x, y, size) {
  return Math.floor(y / 100) * size + Math.floor(x / 100);
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
var dirtyAreas = /* @__PURE__ */ new WeakMap();
function dirtyLog(map) {
  return dirtyAreas.get(map) ?? dirtyAreas.set(map, []).get(map);
}
var waterTables = /* @__PURE__ */ new WeakMap();
function waterBlockedTable(map) {
  let t = waterTables.get(map);
  if (!t || t.revision !== map.navigationRevision) {
    const n = nodeTotal(map), table = new Uint8Array(n), side = sideOf(map), size = map.size;
    for (let id = 0; id < n; id++) {
      const x = id % side, y = Math.floor(id / side), tx = x >> 1, ty = y >> 1;
      let wet = false;
      for (const [a, b] of [[tx, ty], [tx + (x & 1), ty], [tx, ty + (y & 1)], [tx + (x & 1), ty + (y & 1)]]) {
        const tile = map.tiles[Math.min(size - 1, b) * size + Math.min(size - 1, a)];
        if (tile && (tile.walkClass === "water" || tile.walkClass === "both")) wet = true;
      }
      table[id] = wet && clearSegment(map, position(map, id), position(map, id), "water") ? 0 : 1;
    }
    t = { revision: map.navigationRevision, table };
    waterTables.set(map, t);
  }
  return t.table;
}
var blockedFor = (map, layer) => layer === "water" ? waterBlockedTable(map) : blockedTable(map);
var searchBudget = (map) => Math.round(navigationRules.expansionsPerTick * nodeTotal(map) / 961);
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
  const random3 = () => {
    rng ^= rng << 13;
    rng ^= rng >>> 17;
    rng ^= rng << 5;
    return (rng >>> 0) / 4294967296;
  };
  const R = openMapRules, size = R.size, world = size * 100, mid = world / 2, tiles = createTiles("open", seed);
  for (let i = 0; i < R.dirtPatches; i++) {
    let tx = 2 + Math.floor(random3() * (size - 4)), ty = 2 + Math.floor(random3() * (size - 4));
    for (let k = 0; k < 4 + Math.floor(random3() * 6); k++) {
      const t = tiles[ty * size + tx];
      Object.assign(t, { terrainType: "sand", ...terrainDefinitions.sand });
      tx = Math.min(size - 2, Math.max(1, tx + Math.floor(random3() * 3) - 1));
      ty = Math.min(size - 2, Math.max(1, ty + Math.floor(random3() * 3) - 1));
    }
  }
  const a0 = random3() * Math.PI * 2, angles = [a0, a0 + Math.PI + (random3() * 2 - 1) * R.oppositeJitter], centres = angles.map((a) => {
    const r = world * (R.radius[0] + random3() * (R.radius[1] - R.radius[0]));
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
    const ring2 = R.lake.shore;
    for (const t of lakeTiles) {
      const tx = t % size, ty = Math.floor(t / size);
      for (let dy = -ring2; dy <= ring2; dy++) for (let dx = -ring2; dx <= ring2; dx++) {
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
    const a = random3() * Math.PI * 2, d = lake ? R.lake.neutralRing[0] + random3() * (R.lake.neutralRing[1] - R.lake.neutralRing[0]) : random3() * R.neutralRadius, tx = Math.floor((mid + Math.cos(a) * d) / 100), ty = Math.floor((mid + Math.sin(a) * d) / 100);
    if (free(tx, ty) && far(tx, ty, R.clumpClearance)) {
      put(kind, tx, ty);
      break;
    }
  }
  for (let i = 0; i < R.forestClumps; i++) {
    let tx = 0, ty = 0, ok = false;
    for (let k = 0; k < 60 && !ok; k++) {
      tx = 1 + Math.floor(random3() * (size - 2));
      ty = 1 + Math.floor(random3() * (size - 2));
      ok = free(tx, ty) && far(tx, ty, R.clumpClearance);
    }
    if (!ok) continue;
    const want = R.clumpTrees[0] + Math.floor(random3() * (R.clumpTrees[1] - R.clumpTrees[0] + 1));
    for (let n = 0, k = 0; n < want && k < want * 6; k++) {
      if (free(tx, ty) && far(tx, ty, R.clumpClearance)) {
        put("tree", tx, ty);
        n++;
      }
      const dir = Math.floor(random3() * 4);
      tx += dir === 0 ? 1 : dir === 1 ? -1 : 0;
      ty += dir === 2 ? 1 : dir === 3 ? -1 : 0;
      tx = Math.min(size - 2, Math.max(1, tx));
      ty = Math.min(size - 2, Math.max(1, ty));
    }
  }
  for (let ty = 0; ty < size; ty++) for (let tx = 0; tx < size; tx++) {
    if (tx > 0 && ty > 0 && tx < size - 1 && ty < size - 1) continue;
    const v = random3();
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
  (dirtyAreas.get(map) ?? dirtyAreas.set(map, []).get(map)).push([...area]);
  for (const id of nodesNear(map, area, 0)) {
    const p = position(map, id);
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
  if (map.tiles.length !== map.size * map.size || map.tiles.some((t, i) => t.id !== i)) return ["\u5730\u683C\u6578\u91CF\u6216 ID \u4E0D\u7B26"];
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
        let distance = Infinity, approach2 = null;
        for (let i = 0; i < total; i++) {
          if (!Number.isFinite(distances[i])) continue;
          const p = position(map, i), gap3 = Math.max(x0 - p.x, 0, p.x - x1) + Math.max(y0 - p.y, 0, p.y - y1);
          if (gap3 > 0 && gap3 <= 50 && distances[i] < distance) {
            distance = distances[i];
            approach2 = p;
          }
        }
        return { id: resource.id, remaining: resource.remaining, distance, approach: approach2 };
      }).filter((n) => n.distance <= startingResourceRules.maxApproachDistance);
      const available = nodes.reduce((sum3, n) => sum3 + n.remaining, 0), nearestDistance = nodes.length ? Math.min(...nodes.map((n) => n.distance)) : null;
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
function nearestOpen(map, p, layer = "land") {
  const closed = blockedFor(map, layer);
  let best = -1, distance = Infinity;
  for (let i = 0; i < nodeTotal(map); i++) {
    if (closed[i]) continue;
    const q = position(map, i), d = Math.abs(p.x - q.x) + Math.abs(p.y - q.y);
    if (d < distance) {
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

// packages/sim/vision.ts
function footprintTiles(o, size) {
  if (!isBuilding(o)) return [tileAt(o.x, o.y, size)];
  const [x0, y0, x1, y1] = obstacleBounds(o), tiles = [];
  for (let ty = Math.max(0, Math.floor(y0 / 100)); ty <= Math.min(size - 1, Math.floor((y1 - 1) / 100)); ty++) for (let tx = Math.max(0, Math.floor(x0 / 100)); tx <= Math.min(size - 1, Math.floor((x1 - 1) / 100)); tx++) tiles.push(ty * size + tx);
  return tiles;
}
var visionRules = {
  provenance: "design_default",
  unitRadius: 400,
  scoutRadius: 550,
  sheepRadius: 200,
  houseRadius: 300,
  townCenterRadius: 600,
  towerRadius: 700,
  // The 建築 round: the outpost sees 6/8/10/12 tiles by age on aoetw.com, at the tower's 70 a tile (its 10 tiles -> 700);
  // walls a little, the wonder like its 8 tiles; market, dock and gates like a house.
  outpostRadius: [420, 560, 700, 840],
  wallRadius: 200,
  wonderRadius: 560,
  shareVision: false,
  rememberStaticObjects: true
};
var sighted = {
  outpost: (a) => visionRules.outpostRadius[Math.min(4, Math.max(1, a)) - 1],
  "bombard-tower": () => visionRules.towerRadius,
  "palisade-wall": () => visionRules.wallRadius,
  "stone-wall": () => visionRules.wallRadius,
  wonder: () => visionRules.wonderRadius,
  market: () => visionRules.houseRadius,
  dock: () => visionRules.houseRadius,
  "palisade-gate": () => visionRules.houseRadius,
  gate: () => visionRules.houseRadius
};
function createVision() {
  return Array.from({ length: 2 }, () => ({ explored: [], visible: [], known: [], resources: [] }));
}
function updateVision(visions, map, units, tick2, sharing = [[0], [1]], extra = () => 0, reveals2 = [], everything = false) {
  if (sharing.length !== 2 || sharing.some((members, p) => !members.includes(p) || members.some((id) => !Number.isInteger(id) || id < 0 || id > 1))) throw Error("\u7121\u6548\u5171\u4EAB\u8996\u91CE\u898F\u5247");
  const own = [/* @__PURE__ */ new Set(), /* @__PURE__ */ new Set()];
  const size = map.size, reveal2 = (player, x, y, radius) => {
    const t0 = Math.max(0, Math.floor((x - radius) / 100)), t1 = Math.min(size - 1, Math.floor((x + radius) / 100)), u0 = Math.max(0, Math.floor((y - radius) / 100)), u1 = Math.min(size - 1, Math.floor((y + radius) / 100));
    for (let ty = u0; ty <= u1; ty++) for (let tx = t0; tx <= t1; tx++) {
      const dx = tx * 100 + 50 - x, dy = ty * 100 + 50 - y;
      if (dx * dx + dy * dy <= radius * radius) own[player].add(ty * size + tx);
    }
  };
  for (const u of units) {
    if (u.player !== 0 && u.player !== 1) continue;
    reveal2(u.player, u.x, u.y, (u.kind === "scout" ? visionRules.scoutRadius : u.kind === "sheep" ? visionRules.sheepRadius : visionRules.unitRadius) + (u.kind ? extra(u.player, u.kind) : 0));
  }
  for (const o of map.obstacles) if (o.kind === "house" || o.kind === "barracks") reveal2(o.red ? 1 : 0, o.x + 100, o.y + 100, visionRules.houseRadius + (o.progress === void 0 ? extra(o.red ? 1 : 0, o.kind) : 0));
  else if (o.kind === "town-center" && o.progress === void 0) reveal2(o.red ? 1 : 0, o.x + 135, o.y + 135, visionRules.townCenterRadius + extra(o.red ? 1 : 0, o.kind));
  else if (o.progress === void 0 && o.kind in sighted || o.kind === "town-center") {
    const [x0, y0, x1, y1] = obstacleBounds(o), p = o.red ? 1 : 0, r = o.kind === "town-center" ? visionRules.houseRadius : sighted[o.kind](o.age ?? 1);
    reveal2(p, (x0 + x1) / 2, (y0 + y1) / 2, r + (o.kind === "town-center" ? 0 : extra(p, o.kind)));
  } else if (o.kind === "watch-tower" && o.progress === void 0) reveal2(o.red ? 1 : 0, o.x + 50, o.y + 50, visionRules.towerRadius + extra(o.red ? 1 : 0, o.kind));
  else if (o.kind === "castle" && o.progress === void 0) reveal2(o.red ? 1 : 0, o.x + 185, o.y + 185, visionRules.towerRadius + extra(o.red ? 1 : 0, o.kind));
  for (const r of reveals2) if (r.player === 0 || r.player === 1) own[r.player].add(r.tile);
  if (everything) for (let t = 0; t < size * size; t++) {
    own[0].add(t);
    own[1].add(t);
  }
  for (let player = 0; player < 2; player++) {
    const vision = visions[player], visible = new Set(sharing[player].flatMap((id) => [...own[id]]));
    vision.resources = map.resources.filter((r) => r.status === "available" && visible.has(tileAt(r.x, r.y, size))).map((r) => ({ ...r }));
    vision.visible = [...visible].sort((a, b) => a - b);
    vision.explored = [.../* @__PURE__ */ new Set([...vision.explored, ...vision.visible])].sort((a, b) => a - b);
    const known = new Map(vision.known.filter((k) => !["hunt", "livestock"].includes(k.obstacle.kind) && !footprintTiles(k.obstacle, size).some((id) => visible.has(id))).map((k) => [k.obstacle.id, k]));
    for (const obstacle of map.obstacles) if (footprintTiles(obstacle, size).some((id) => visible.has(id))) known.set(obstacle.id, { obstacle: { ...obstacle }, lastSeenTick: tick2 });
    vision.known = [...known.values()].sort((a, b) => a.obstacle.id < b.obstacle.id ? -1 : a.obstacle.id > b.obstacle.id ? 1 : 0);
  }
}
function projectVision(vision, size) {
  const visible = new Set(vision.visible), explored = new Set(vision.explored);
  return { fog: Array.from({ length: size * size }, (_, id) => visible.has(id) ? 2 : explored.has(id) ? 1 : 0), known: structuredClone(vision.known), resources: structuredClone(vision.resources) };
}
function unitVisible(vision, unit2, player, size) {
  return unit2.player === player || vision.visible.includes(tileAt(unit2.x, unit2.y, size));
}

// packages/sim/settings.ts
var defaultSettings = { difficulty: "standard", resources: "standard", popCap: 40, reveal: "normal", startAge: 1, victory: "standard", allTechs: false };
var settingRules = {
  provenance: "design_default",
  // Starting stock per player before civilization bonuses; 'standard' is this game's usual 200/200/100/100. The others
  // follow AoE II's low / medium / high presets in spirit (low: no gold or stone; medium and high: a big head start).
  resources: { low: { food: 100, wood: 100, gold: 0, stone: 0 }, standard: { food: 200, wood: 200, gold: 100, stone: 100 }, medium: { food: 500, wood: 500, gold: 300, stone: 300 }, high: { food: 1e3, wood: 1e3, gold: 700, stone: 700 } },
  // Population ceilings offered (40 is the game's usual cap; civilization bonuses such as the Goths' still add).
  popCaps: [25, 40, 75, 100],
  // The computer: how often it thinks (ticks between passes), how many villagers it keeps, how large an attack wave
  // must be and the earliest tick of the first wave. 'standard' is exactly the existing aiRules values.
  difficulty: {
    easy: { thinkTicks: 40, villagerTarget: 8, waveSize: 8, firstWaveTick: 9600 },
    standard: { thinkTicks: 20, villagerTarget: 12, waveSize: 5, firstWaveTick: 4800 },
    hard: { thinkTicks: 20, villagerTarget: 14, waveSize: 4, firstWaveTick: 3600 },
    hardest: { thinkTicks: 10, villagerTarget: 16, waveSize: 4, firstWaveTick: 2400 }
  }
};
var difficulties = ["easy", "standard", "hard", "hardest"];
var levels = ["low", "standard", "medium", "high"];
var reveals = ["normal", "explored", "all"];
var victories = ["standard", "conquest"];
function matchSettings(v = {}) {
  if (!v || typeof v !== "object" || Array.isArray(v)) throw Error("\u7121\u6548\u7684\u5C0D\u5C40\u8A2D\u5B9A");
  const o = { ...defaultSettings, ...v };
  if (!difficulties.includes(o.difficulty)) throw Error("\u672A\u77E5\u7684\u96E3\u6613\u5EA6");
  if (!levels.includes(o.resources)) throw Error("\u672A\u77E5\u7684\u8CC7\u6E90\u8A2D\u5B9A");
  if (!settingRules.popCaps.includes(o.popCap)) throw Error("\u672A\u77E5\u7684\u4EBA\u53E3\u4E0A\u9650");
  if (!reveals.includes(o.reveal)) throw Error("\u672A\u77E5\u7684\u5730\u5716\u986F\u793A\u8A2D\u5B9A");
  if (![1, 2, 3, 4].includes(o.startAge)) throw Error("\u672A\u77E5\u7684\u958B\u59CB\u6642\u4EE3");
  if (!victories.includes(o.victory)) throw Error("\u672A\u77E5\u7684\u52DD\u5229\u689D\u4EF6");
  if (typeof o.allTechs !== "boolean") throw Error("\u6240\u6709\u79D1\u6280\u8A2D\u5B9A\u7121\u6548");
  return { difficulty: o.difficulty, resources: o.resources, popCap: o.popCap, reveal: o.reveal, startAge: o.startAge, victory: o.victory, allTechs: o.allTechs };
}
var settingsOf = (s) => s.settings ?? defaultSettings;
var aiTuning = (s) => settingRules.difficulty[settingsOf(s).difficulty];

// packages/sim/economy.ts
var economyRules = {
  provenance: "design_default",
  initialStock: { food: 200, wood: 200, gold: 100, stone: 100 },
  populationCap: rules.settings.populationCap,
  cancellationRefundPercent: 100,
  carryCapacity: 10,
  gatherTicks: { food: 20, wood: 20, gold: 25, stone: 25 },
  // Faster food sources (after the reference's order: hunters and fishers outpace foragers; values design_default).
  sourceTicks: { hunt: 15, livestock: 18, fish: 14 },
  workReach: 50,
  dropoffReach: 50
};
var zero = () => ({ food: 0, wood: 0, gold: 0, stone: 0 });
function createAccount(populationUsed) {
  return { stock: { ...economyRules.initialStock }, populationUsed, populationReserved: 0, populationCap: economyRules.populationCap, reservations: [], ledger: { extracted: zero(), deposited: zero(), lost: zero(), relic: zero(), refund: zero(), market: zero(), trade: zero(), repair: zero() } };
}
function reserve(account, id, entryId, cost) {
  const found = rules.entries.find((e) => e.id === entryId), entry2 = found && cost ? { ...found, cost } : found;
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

// packages/sim/tech.ts
var techRules = {
  provenance: "reference effects (aoe2-rules-research.md); carry rounding design_default",
  // Gather rate in percent of the base rate, per yield: each researched entry adds its share.
  gather: { wood: { "double-bit-axe": 20, "bow-saw": 20, "two-man-saw": 10 }, gold: { "gold-mining": 15, "gold-shaft-mining": 15 }, stone: { "stone-mining": 15, "stone-shaft-mining": 15 }, food: {} },
  // Villager carry capacity: base economyRules.carryCapacity (10), 12 with Wheelbarrow, 15 with Hand Cart as well;
  // Heavy Plow adds 1 for farmers.
  carry: { wheelbarrow: 2, "hand-cart": 3 },
  farmerCarry: { "heavy-plow": 1 },
  // Food in each farm built (or reseeded) after the research.
  farmFood: { "horse-collar": 75, "heavy-plow": 125, "crop-rotation": 175 },
  // Villager hit points (Loom).
  villagerHp: { loom: 15 }
};
var sum = (table, techs) => techs.reduce((t, id) => t + (table[id] ?? 0), 0);
var gatherRate = (techs, resource) => 100 + sum(techRules.gather[resource] ?? {}, techs);
var carryOf = (techs, base, farming = false) => base + sum(techRules.carry, techs) + (farming ? sum(techRules.farmerCarry, techs) : 0);
var farmFoodOf = (techs, base) => base + sum(techRules.farmFood, techs);
var villagerHpBonus = (techs) => sum(techRules.villagerHp, techs);

// packages/content/techs.ts
var infantry2 = { classes: ["infantry"] };
var mounted = { classes: ["cavalry", "camel"] };
var ships = ["fishing-ship", "transport-ship", "trade-cog", "galley", "fire-galley", "demolition-raft", "cannon-galleon", "longboat"];
var footArchers2 = { classes: ["archer"], exclude: ["skirmisher", "gunpowder", "cavalry-archer", "chu-ko-nu"] };
var sighted2 = ["town-center", "house", "barracks", "watch-tower", "castle", "outpost", "bombard-tower", "market", "dock", "wonder", "palisade-wall", "stone-wall", "palisade-gate", "gate"];
var techEffects = [
  // University.
  fx("masonry.hp", "buildingHp", {}, 1.1, "\u78DA\u74E6\u6280\u8853\uFF1A\u5EFA\u7BC9\u751F\u547D +10%", { tech: "masonry" }),
  fx("masonry.melee", "buildingMeleeArmor", {}, 1, "\u78DA\u74E6\u6280\u8853\uFF1A\u5EFA\u7BC9\u8FD1\u6230\u8B77\u7532 +1", { tech: "masonry" }),
  fx("masonry.pierce", "buildingPierceArmor", {}, 1, "\u78DA\u74E6\u6280\u8853\uFF1A\u5EFA\u7BC9\u9060\u7A0B\u8B77\u7532 +1", { tech: "masonry" }),
  fx("masonry.class", "buildingClassArmor", {}, 1, "\u78DA\u74E6\u6280\u8853\uFF1A\u5EFA\u7BC9\u7684\u5EFA\u7BC9\u985E\u8B77\u7532 +1\uFF08\u539F\u4F5C +3\uFF0C\u653B\u57CE\u52A0\u6210 \xD70.32\uFF09", { tech: "masonry" }),
  fx("architecture.hp", "buildingHp", {}, 1.1, "\u5EFA\u7BC9\u5B78\uFF1A\u5EFA\u7BC9\u751F\u547D\u518D +10%", { tech: "architecture" }),
  fx("architecture.melee", "buildingMeleeArmor", {}, 1, "\u5EFA\u7BC9\u5B78\uFF1A\u5EFA\u7BC9\u8FD1\u6230\u8B77\u7532\u518D +1", { tech: "architecture" }),
  fx("architecture.pierce", "buildingPierceArmor", {}, 1, "\u5EFA\u7BC9\u5B78\uFF1A\u5EFA\u7BC9\u9060\u7A0B\u8B77\u7532\u518D +1", { tech: "architecture" }),
  fx("architecture.class", "buildingClassArmor", {}, 1, "\u5EFA\u7BC9\u5B78\uFF1A\u5EFA\u7BC9\u7684\u5EFA\u7BC9\u985E\u8B77\u7532\u518D +1", { tech: "architecture" }),
  fx("chemistry.missiles", "attack", { kinds: ["mangonel", "scorpion", "trebuchet"], classes: ["archer", "warship"], exclude: ["gunpowder"] }, 1, "\u5316\u5B78\uFF1A\u5F13\u5175\u3001\u6295\u5C04\u653B\u57CE\u5668\u8207\u6230\u8239\u653B\u64CA +1\uFF08\u706B\u85E5\u55AE\u4F4D\u3001\u885D\u649E\u8ECA\u9664\u5916\uFF09", { tech: "chemistry" }),
  fx("chemistry.buildings", "arrowDamage", { buildings: ["town-center", "watch-tower", "castle"] }, 1, "\u5316\u5B78\uFF1A\u57CE\u93AE\u4E2D\u5FC3\u3001\u7BAD\u5854\u8207\u57CE\u5821\u7684\u7BAD +1", { tech: "chemistry" }),
  fx("siege-engineers.range", "range", { kinds: ["mangonel", "scorpion", "trebuchet", "bombard-cannon"] }, 50, "\u653B\u57CE\u5DE5\u7A0B\u5E2B\uFF1A\u653B\u57CE\u5668\u5C04\u7A0B +1\uFF08\u885D\u649E\u8ECA\u9664\u5916\uFF09", { tech: "siege-engineers" }),
  fx("siege-engineers.buildings", "bonusScale", { classes: ["siege"] }, 1.2, "\u653B\u57CE\u5DE5\u7A0B\u5E2B\uFF1A\u653B\u57CE\u5668\u5C0D\u5EFA\u7BC9\u653B\u64CA +20%", { vs: "building", tech: "siege-engineers" }),
  fx("guard-tower.hp", "buildingHp", { buildings: ["watch-tower"] }, 1.47, "\u9632\u79A6\u7BAD\u5854\uFF1A\u7BAD\u5854\u751F\u547D +47%\uFF08\u539F\u4F5C 1020 \u2192 1500\uFF09", { tech: "guard-tower" }),
  fx("guard-tower.arrow", "arrowDamage", { buildings: ["watch-tower"] }, 1, "\u9632\u79A6\u7BAD\u5854\uFF1A\u7BAD\u5854\u653B\u64CA +1", { tech: "guard-tower" }),
  fx("keep.hp", "buildingHp", { buildings: ["watch-tower"] }, 1.5, "\u5927\u578B\u7BAD\u5854\uFF1A\u7BAD\u5854\u751F\u547D\u518D +50%\uFF08\u539F\u4F5C 1500 \u2192 2250\uFF09", { tech: "keep" }),
  fx("keep.arrow", "arrowDamage", { buildings: ["watch-tower"] }, 1, "\u5927\u578B\u7BAD\u5854\uFF1A\u7BAD\u5854\u653B\u64CA\u518D +1", { tech: "keep" }),
  fx("treadmill-crane", "buildRate", {}, 20, "\u78E8\u574A\u6C34\u8ECA\uFF1A\u6751\u6C11\u5EFA\u9020\u901F\u5EA6 +20%", { tech: "treadmill-crane" }),
  fx("arrowslits", "arrowDamage", { buildings: ["watch-tower"] }, 2, "\u7BAD\u72F9\u69FD\uFF1A\u7BAD\u5854\u653B\u64CA +2\uFF08\u539F\u4F5C\u4F9D\u5854\u7684\u7B49\u7D1A +1\uFF0F+2\uFF0F+3\uFF09", { tech: "arrowslits" }),
  // Barracks.
  fx("supplies", "cost", { entries: ["militia"] }, 0.75, "\u4F9B\u7D66\uFF1A\u6C11\u5175\u7CFB\u98DF\u7269 -15", { tech: "supplies", resource: "food" }),
  fx("squires", "speed", infantry2, 1.1, "\u8B77\u885B\u6280\u8853\uFF1A\u6B65\u5175\u79FB\u52D5\u901F\u5EA6 +10%", { tech: "squires" }),
  fx("arson", "bonus", infantry2, 2, "\u7E31\u706B\uFF1A\u6B65\u5175\u5C0D\u6A19\u6E96\u5EFA\u7BC9\u653B\u64CA +2", { vs: "standard-building", tech: "arson" }),
  // Archery range.
  fx("thumb-ring.foot", "cooldown", footArchers2, 1 / 1.18, "\u62C7\u6307\u74B0\uFF1A\u5F92\u6B65\u5F13\u5175\u5C04\u901F +18%", { tech: "thumb-ring" }),
  fx("thumb-ring.horse", "cooldown", { classes: ["cavalry-archer"], exclude: ["mangudai"] }, 1 / 1.11, "\u62C7\u6307\u74B0\uFF1A\u99AC\u5F13\u9A0E\u5175\u5C04\u901F +11%", { tech: "thumb-ring" }),
  // The 戰術技巧 round: the Mangudai takes the foot archers' +18% (aoetw.com Thumb Ring), not the horse archers' +11%.
  fx("thumb-ring.mangudai", "cooldown", { kinds: ["mangudai"] }, 1 / 1.18, "\u62C7\u6307\u74B0\uFF1A\u8499\u53E4\u7A81\u9A0E\u5C04\u901F +18%", { tech: "thumb-ring" }),
  // And sure shots at a standing target for the archer, skirmisher and horse archer lines, the Chu Ko Nu and the Mangudai.
  fx("thumb-ring.accuracy", "accuracy", { classes: ["archer"], exclude: ["gunpowder"] }, 100, "\u62C7\u6307\u74B0\uFF1A\u5F13\u5175\u5C04\u64CA\u975C\u6B62\u76EE\u6A19\u5FC5\u4E2D", { tech: "thumb-ring" }),
  fx("thumb-ring.chu-ko-nu", "cooldown", { kinds: ["chu-ko-nu"] }, 1 / 1.25, "\u62C7\u6307\u74B0\uFF1A\u9023\u5F29\u5175\u5C04\u901F +25%", { tech: "thumb-ring" }),
  fx("parthian.melee", "meleeArmor", { classes: ["cavalry-archer"] }, 1, "\u5B89\u606F\u4EBA\u6230\u8853\uFF1A\u99AC\u5F13\u9A0E\u5175\u8FD1\u6230\u8B77\u7532 +1", { tech: "parthian-tactics" }),
  fx("parthian.pierce", "pierceArmor", { classes: ["cavalry-archer"] }, 2, "\u5B89\u606F\u4EBA\u6230\u8853\uFF1A\u99AC\u5F13\u9A0E\u5175\u9060\u7A0B\u8B77\u7532 +2", { tech: "parthian-tactics" }),
  fx("parthian.spear", "bonus", { kinds: ["cavalry-archer"] }, 4, "\u5B89\u606F\u4EBA\u6230\u8853\uFF1A\u99AC\u5F13\u9A0E\u5175\u5C0D\u9577\u69CD\u5175 +4", { vs: "spear", tech: "parthian-tactics" }),
  fx("parthian.spear-unique", "bonus", { kinds: ["mangudai"] }, 2, "\u5B89\u606F\u4EBA\u6230\u8853\uFF1A\u5176\u4ED6\u99AC\u5F13\u9A0E\u5175\uFF08\u8499\u53E4\u7A81\u9A0E\uFF09\u5C0D\u9577\u69CD\u5175 +2", { vs: "spear", tech: "parthian-tactics" }),
  // Stable.
  fx("bloodlines", "hp", mounted, 20, "\u54C1\u7A2E\uFF1A\u9A0E\u5175\u8207\u99F1\u99DD\u751F\u547D +20", { tech: "bloodlines", op: "add" }),
  fx("husbandry", "speed", mounted, 1.1, "\u8015\u7A2E\u6280\u8853\uFF1A\u9A0E\u5175\u8207\u99F1\u99DD\u79FB\u52D5\u901F\u5EA6 +10%", { tech: "husbandry" }),
  // Town centre: sight of every building (a tile of sight is 100 here).
  fx("town-watch", "los", { buildings: sighted2 }, 400, "\u57CE\u93AE\u77AD\u671B\uFF1A\u5EFA\u7BC9\u8996\u91CE +4", { tech: "town-watch" }),
  fx("town-patrol", "los", { buildings: sighted2 }, 400, "\u57CE\u93AE\u5DE1\u908F\uFF1A\u5EFA\u7BC9\u8996\u91CE\u518D +4", { tech: "town-patrol" }),
  // Monastery.
  fx("fervor", "speed", { kinds: ["monk"] }, 1.15, "\u5B97\u6559\u72C2\u71B1\uFF1A\u50E7\u4FB6\u79FB\u52D5\u901F\u5EA6 +15%", { tech: "fervor" }),
  fx("herbal-medicine", "garrisonHeal", {}, 6, "\u8349\u85E5\u6CBB\u7642\uFF1A\u9032\u99D0\u55AE\u4F4D\u56DE\u8840\u5FEB 6 \u500D", { tech: "herbal-medicine" }),
  // Castle.
  fx("hoardings", "buildingHp", { buildings: ["castle"] }, 1.21, "\u570D\u7246\uFF1A\u57CE\u5821\u751F\u547D +21%", { tech: "hoardings" }),
  fx("sappers", "bonus", { kinds: ["villager"] }, 15, "\u5175\u5DE5\u5B78\uFF1A\u6751\u6C11\u5C0D\u5EFA\u7BC9\u653B\u64CA +15", { vs: "building", tech: "sappers" }),
  // University, the 建築 round: Heated Shot (towers and castles +125% against ships: the arrows' ship bonus here),
  // Fortified Wall (stone walls 1800 -> 3000, gates 2750 -> 4000 hit points in the reference).
  fx("heated-shot", "arrowBonus", { buildings: ["watch-tower", "castle"] }, 6, "\u706B\u7BAD\uFF1A\u7BAD\u5854\u8207\u57CE\u5821\u7684\u7BAD\u5C0D\u8239 +6\uFF08\u539F\u4F5C +125%\uFF09", { vs: "ship", tech: "heated-shot" }),
  fx("heated-shot.fishing", "arrowBonus", { buildings: ["watch-tower", "castle"] }, 6, "\u706B\u7BAD\uFF1A\u7BAD\u5854\u8207\u57CE\u5821\u7684\u7BAD\u5C0D\u6F01\u8239 +6", { vs: "fishing-ship", tech: "heated-shot" }),
  fx("fortified-wall.wall", "buildingHp", { buildings: ["stone-wall"] }, 5 / 3, "\u579B\u7246\uFF1A\u77F3\u7246\u751F\u547D +67%\uFF08\u539F\u4F5C 1800 \u2192 3000\uFF09", { tech: "fortified-wall" }),
  fx("fortified-wall.class", "buildingClassArmor", { buildings: ["stone-wall"] }, 3, "\u579B\u7246\uFF1A\u77F3\u7246\u7684\u5EFA\u7BC9\u985E\u8B77\u7532 5 \u2192 8\uFF08\u539F\u4F5C 16 \u2192 24\uFF09", { tech: "fortified-wall" }),
  fx("fortified-wall.gate", "buildingHp", { buildings: ["gate"] }, 4e3 / 2750, "\u579B\u7246\uFF1A\u57CE\u9580\u751F\u547D +45%\uFF08\u539F\u4F5C 2750 \u2192 4000\uFF09", { tech: "fortified-wall" }),
  // Dock.
  fx("gillnets", "gather", { kinds: ["fishing-ship"], sources: ["fish", "fish-trap"] }, 25, "\u6D41\u523A\u7DB2\uFF1A\u6F01\u8239\u5DE5\u4F5C\u901F\u5EA6 +25%", { tech: "gillnets" }),
  fx("careening.armor", "pierceArmor", { classes: ["ship", "fishing-ship"] }, 1, "\u822A\u6D77\u6280\u8853\uFF1A\u8239\u96BB\u9060\u7A0B\u8B77\u7532 +1", { tech: "careening" }),
  fx("careening.capacity", "transportCapacity", { kinds: ["transport-ship"] }, 5, "\u822A\u6D77\u6280\u8853\uFF1A\u904B\u8F38\u8239\u904B\u8F09 +5", { tech: "careening" }),
  fx("dry-dock.speed", "speed", { classes: ["ship", "fishing-ship"] }, 1.15, "\u8239\u5862\uFF1A\u8239\u96BB\u79FB\u52D5\u901F\u5EA6 +15%", { tech: "dry-dock" }),
  fx("dry-dock.capacity", "transportCapacity", { kinds: ["transport-ship"] }, 10, "\u8239\u5862\uFF1A\u904B\u8F38\u8239\u904B\u8F09 +10", { tech: "dry-dock" }),
  fx("shipwright.cost", "cost", { entries: ships }, 0.8, "\u9020\u8239\u54E1\uFF1A\u8239\u96BB\u6728\u6750 -20%", { tech: "shipwright", resource: "wood" }),
  fx("shipwright.time", "time", { entries: ships }, 0.65, "\u9020\u8239\u54E1\uFF1A\u8239\u96BB\u8A13\u7DF4\u6642\u9593 -35%", { tech: "shipwright" }),
  // Market.
  fx("caravan", "speed", { classes: ["trade"] }, 1.5, "\u5546\u968A\uFF1A\u8CBF\u6613\u8ECA\u968A\u8207\u8CBF\u6613\u5546\u8239\u79FB\u52D5\u901F\u5EA6 +50%", { tech: "caravan" }),
  fx("guilds", "marketFee", {}, -15, "\u516C\u6703\u5236\u5EA6\uFF1A\u5E02\u96C6\u4EA4\u6613\u8CBB 30% \u2192 15%", { tech: "guilds" }),
  // The 戰術技巧 round. Ballistics (University): shots aim where a moving target will be when they land, for the archers
  // (not gunpowder), the galley line, the Longboat and fire ships, and the buildings that shoot (aoetw.com Ballistics).
  fx("ballistics.units", "lead", { classes: ["archer", "warship", "fire"], exclude: ["gunpowder"] }, 1, "\u5F48\u9053\u5B78\uFF1A\u5F13\u5175\u3001\u6230\u8239\u8207\u706B\u6230\u8239\u7684\u7BAD\u6703\u9810\u5224\u79FB\u52D5\u4E2D\u7684\u76EE\u6A19", { tech: "ballistics" }),
  fx("ballistics.buildings", "lead", { buildings: ["town-center", "watch-tower", "castle", "bombard-tower"] }, 1, "\u5F48\u9053\u5B78\uFF1A\u57CE\u93AE\u4E2D\u5FC3\u3001\u7BAD\u5854\u3001\u57CE\u5821\u8207\u706B\u7832\u5854\u6703\u9810\u5224\u79FB\u52D5\u4E2D\u7684\u76EE\u6A19", { tech: "ballistics" }),
  fx("conscription", "workRate", { buildings: ["barracks", "archery-range", "stable", "castle"], allUnits: true }, 33, "\u5FB5\u5175\u6280\u8853\uFF1A\u5175\u71DF\u3001\u9776\u5834\u3001\u99AC\u5EC4\u8207\u57CE\u5821\u8A13\u7DF4\u901F\u5EA6 +33%\uFF08\u7814\u7A76\u4E0D\u8B8A\uFF09", { tech: "conscription" })
];
var ageEffects = [
  fx("tracking", "los", { classes: ["infantry"] }, 200, "\u8FFD\u8E64\uFF1A\u7B2C\u4E8C\u6642\u4EE3\u8D77\u6B65\u5175\u8996\u91CE +2", { age: 2 })
];

// packages/sim/civ.ts
function ownerOf(s, player) {
  const o = { civ: s.civs?.[player] ?? neutralCiv, age: s.ages?.[player] ?? 1, techs: s.techs?.[player] ?? [] };
  if (s.settings?.allTechs) o.allTechs = true;
  return o;
}
var asOwner = (o) => Array.isArray(o) ? { civ: neutralCiv, age: 1, techs: o } : o;
var byCiv = new Map(civDefs.map((c) => [c.id, c.effects]));
var civExists = (id) => typeof id === "string" && byCiv.has(id);
var withTechs = /* @__PURE__ */ new Map();
function activeEffects(o, kind) {
  let list = withTechs.get(o.civ);
  if (!list) {
    list = [...byCiv.get(o.civ) ?? [], ...techEffects, ...ageEffects];
    withTechs.set(o.civ, list);
  }
  return list.filter((e) => e.kind === kind && (e.trigger.age === void 0 || o.age >= e.trigger.age) && (e.trigger.tech === void 0 || o.techs.includes(e.trigger.tech)));
}
var valueOf = (e, o) => typeof e.value === "number" ? e.value : e.value[Math.min(3, Math.max(0, o.age - 1))];
var hit = (list, values) => !!list && values.some((v) => list.includes(v));
function unitMatches(sel, kind, classes) {
  if (hit(sel.exclude, [kind, ...classes])) return false;
  return hit(sel.kinds, [kind]) || hit(sel.classes, classes);
}
function entryMatches(sel, entryId) {
  if (sel.exclude?.includes(entryId)) return false;
  const e = rules.entries.find((e2) => e2.id === entryId);
  return !!sel.entries?.includes(entryId) || !!e && (sel.allUnits && e.kind === "unit" || sel.allTechs && e.kind === "technology");
}
var buildingMatches = (sel, kind) => !sel.buildings || sel.buildings.includes(kind);
var sum2 = (list, o) => list.reduce((t, e) => t + valueOf(e, o), 0);
var product = (list, o) => list.reduce((t, e) => t * valueOf(e, o), 1);
var unitSum = (o, kind, unit2, classes, op = "add") => sum2(activeEffects(o, kind).filter((e) => e.op === op && unitMatches(e.select, unit2, classes)), o);
var unitProduct = (o, kind, unit2, classes) => product(activeEffects(o, kind).filter((e) => e.op === "mul" && unitMatches(e.select, unit2, classes)), o);
function unitBonuses(o, unit2, classes) {
  const out = {};
  for (const e of activeEffects(o, "bonus")) if (e.vs && unitMatches(e.select, unit2, classes)) {
    const v = valueOf(e, o);
    if (v) out[e.vs] = (out[e.vs] ?? 0) + v;
  }
  return out;
}
var bonusScales = (o, unit2, classes) => activeEffects(o, "bonusScale").filter((e) => e.vs && unitMatches(e.select, unit2, classes)).map((e) => ({ vs: e.vs, scale: valueOf(e, o) }));
function costOf(entryId, o) {
  const e = rules.entries.find((e2) => e2.id === entryId);
  const cost = { food: 0, wood: 0, gold: 0, stone: 0, ...e?.cost ?? {} };
  for (const fx2 of activeEffects(o, "cost")) if (entryMatches(fx2.select, entryId)) {
    for (const r of resources) if (!fx2.resource || fx2.resource === r) cost[r] = cost[r] * valueOf(fx2, o);
  }
  for (const r of resources) cost[r] = Math.max(0, Math.round(cost[r]));
  for (const fx2 of activeEffects(o, "costShift")) if (entryMatches(fx2.select, entryId) && fx2.resource && fx2.to) {
    cost[fx2.to] += cost[fx2.resource];
    cost[fx2.resource] = 0;
  }
  return cost;
}
function timeTicks(entryId, o, building2) {
  const e = rules.entries.find((e2) => e2.id === entryId);
  if (!e) return 0;
  const scale = product(activeEffects(o, "time").filter((fx2) => entryMatches(fx2.select, entryId)), o), rate = sum2(activeEffects(o, "workRate").filter((fx2) => buildingMatches(fx2.select, building2) && (!fx2.select.allUnits || e.kind === "unit")), o);
  return Math.round(e.time * rules.settings.tickHz * scale * 100 / (100 + rate));
}
function producersOf(entryId, o) {
  const base = rules.production[entryId];
  const out = base ? [base] : [];
  for (const fx2 of activeEffects(o, "producer")) if (fx2.select.entries?.includes(entryId)) {
    for (const b of fx2.select.buildings ?? []) if (!out.includes(b)) out.push(b);
  }
  return out;
}
var civAvailable = (civ, entryId, allTechs = false) => {
  const list = allTechs ? allTechCivilizations : rules.civilizations, c = list.find((c2) => c2.id === civ) ?? list.find((c2) => c2.id === neutralCiv);
  return c.available.includes(entryId);
};
var ownerAvailable = (o, entryId) => civAvailable(o.civ, entryId, !!o.allTechs);
var gatherBonus = (o, yieldKind, source, kind = "villager") => sum2(activeEffects(o, "gather").filter((e) => (!e.select.kinds || e.select.kinds.includes(kind)) && (e.select.resources?.includes(yieldKind) || e.select.sources?.includes(source))), o);
var carryBonus = (o, source) => sum2(activeEffects(o, "carry").filter((e) => e.select.sources?.includes(source)), o);
var farmFoodBonus = (o) => sum2(activeEffects(o, "farmFood"), o);
var huntDamageBonus = (o, prey) => sum2(activeEffects(o, "huntDamage").filter((e) => !e.select.prey || e.select.prey.includes(prey)), o);
var buildingSum = (o, kind, building2) => sum2(activeEffects(o, kind).filter((e) => buildingMatches(e.select, building2)), o);
var buildingHpScale = (o, building2) => product(activeEffects(o, "buildingHp").filter((e) => buildingMatches(e.select, building2)), o);
var housingBonus = (o, building2) => buildingSum(o, "housing", building2);
var garrisonBonus = (o, building2) => buildingSum(o, "garrison", building2);
var popCapBonus = (o) => sum2(activeEffects(o, "popCap"), o);
var buildingArmorBonus = (o, building2) => [buildingSum(o, "buildingMeleeArmor", building2), buildingSum(o, "buildingPierceArmor", building2)];
var buildRateBonus = (o, building2) => buildingSum(o, "buildRate", building2);
var buildingClassArmorBonus = (o, building2) => buildingSum(o, "buildingClassArmor", building2);
var garrisonHealScale = (o, building2) => product(activeEffects(o, "garrisonHeal").filter((e) => buildingMatches(e.select, building2)), o);
var keepsHousing = (o, building2) => activeEffects(o, "keepHousing").some((e) => buildingMatches(e.select, building2));
function arrowsOf(o, building2) {
  return {
    extra: buildingSum(o, "arrows", building2),
    damage: buildingSum(o, "arrowDamage", building2),
    range: buildingSum(o, "arrowRange", building2),
    cooldown: product(activeEffects(o, "arrowCooldown").filter((e) => buildingMatches(e.select, building2)), o),
    garrisonClasses: activeEffects(o, "garrisonArrows").filter((e) => buildingMatches(e.select, building2)).flatMap((e) => [...e.select.classes ?? []]),
    bonus: activeEffects(o, "arrowBonus").filter((e) => e.vs && buildingMatches(e.select, building2)).reduce((t, e) => ({ ...t, [e.vs]: (t[e.vs] ?? 0) + valueOf(e, o) }), {})
  };
}
var marketFeeOf = (o, base) => Math.max(0, base + sum2(activeEffects(o, "marketFee"), o));
var transportCapacityOf = (o, base) => base + sum2(activeEffects(o, "transportCapacity").filter((e) => unitMatches(e.select, "transport-ship", ["ship", "transport"])), o);
var losBonus = (o, kind, classes = []) => sum2(activeEffects(o, "los").filter((e) => e.select.buildings ? e.select.buildings.includes(kind) : unitMatches(e.select, kind, classes)), o);
var healRangeScale = (o) => product(activeEffects(o, "healRange"), o);
var healRateScale = (o) => product(activeEffects(o, "healRate"), o);
var conversionResist = (o) => sum2(activeEffects(o, "conversionResist"), o);
var deathRefund = (o, unit2, classes) => sum2(activeEffects(o, "deathRefund").filter((e) => unitMatches(e.select, unit2, classes)), o);
function startStock(o) {
  const out = { food: 0, wood: 0, gold: 0, stone: 0 };
  for (const e of activeEffects(o, "startStock")) if (e.resource) out[e.resource] += valueOf(e, o);
  return out;
}
var startVillagers = (o) => sum2(activeEffects(o, "startVillagers"), o);
var grantsOf = (o) => activeEffects(o, "grant").flatMap((e) => [...e.select.entries ?? []]).filter((id) => !o.techs.includes(id));
var leadsUnit = (o, unit2, classes) => activeEffects(o, "lead").some((e) => !e.select.buildings && unitMatches(e.select, unit2, classes));
var leadsBuilding = (o, building2) => activeEffects(o, "lead").some((e) => !!e.select.buildings && e.select.buildings.includes(building2));
var steadyAccuracy = (o, unit2, classes) => Math.max(0, ...activeEffects(o, "accuracy").filter((e) => unitMatches(e.select, unit2, classes)).map((e) => valueOf(e, o)));

// packages/sim/stats.ts
var combatRules = {
  provenance: "design_default",
  // attack: melee or pierce (arrows, javelins); armor: [melee, pierce], subtracted from that kind of attack; classes:
  // what bonus damage keys on; bonus: extra damage against a class. Final damage = max(1, attack - armor + bonuses).
  units: {
    villager: { hp: 25, damage: 1, range: 50, cooldown: 30, sight: 0, attack: "melee", armor: [0, 0], classes: ["villager"], bonus: { building: 1, "stone-defense": 2 } },
    militia: { hp: 45, damage: 6, range: 50, cooldown: 20, sight: 350, attack: "melee", armor: [0, 1], classes: ["infantry"], bonus: {} },
    archer: { hp: 30, damage: 4, range: 250, cooldown: 30, sight: 400, attack: "pierce", armor: [0, 0], classes: ["archer"], bonus: { spear: 3 }, frameDelay: 5 },
    // Scout: the reference's standard start includes one (research doc); these numbers are design_default.
    // sight here is the automatic-engage radius (vision is visionRules): 0 means the unit only fights when ordered.
    // The scout scouts; it attacks only on an explicit order.
    scout: { hp: 45, damage: 3, range: 50, cooldown: 40, sight: 0, attack: "melee", armor: [0, 2], classes: ["cavalry"], bonus: { monk: 6 } },
    // Monk: hit points 30 as in the reference; no attack (converts and heals instead, see religion.ts).
    monk: { hp: 30, damage: 0, range: 0, cooldown: 0, sight: 0, attack: "none", armor: [0, 0], classes: ["monk"], bonus: {} },
    // Animals (fauna.ts): sheep and deer never fight; a boar only strikes back at whoever hunts it.
    sheep: { hp: 7, damage: 0, range: 0, cooldown: 0, sight: 0, attack: "none", armor: [0, 0], classes: ["animal"], bonus: {} },
    deer: { hp: 5, damage: 0, range: 0, cooldown: 0, sight: 0, attack: "none", armor: [0, 0], classes: ["animal"], bonus: {} },
    boar: { hp: 75, damage: 8, range: 50, cooldown: 40, sight: 0, attack: "melee", armor: [0, 0], classes: ["animal"], bonus: {} },
    // The counter units (after the reference's triangle): the spearman against cavalry, the skirmisher against archers,
    // the knight as heavy cavalry. Values design_default, in this game's scale.
    // Camels are their own class (aoetw: 駱駝, not 騎兵); the spear line's camel bonus keeps the site's ratio to its cavalry one.
    spearman: { hp: 45, damage: 4, range: 50, cooldown: 30, sight: 350, attack: "melee", armor: [0, 0], classes: ["infantry", "spear"], bonus: { cavalry: 12, camel: 10, elephant: 12, ship: 7, "fishing-ship": 7, mameluke: 3, "standard-building": 1 } },
    skirmisher: { hp: 30, damage: 2, range: 200, cooldown: 30, sight: 400, attack: "pierce", armor: [0, 3], classes: ["archer", "skirmisher"], bonus: { archer: 3, spear: 3 }, frameDelay: 5 },
    knight: { hp: 100, damage: 10, range: 50, cooldown: 18, sight: 350, attack: "melee", armor: [2, 2], classes: ["cavalry"], bonus: {} },
    // Battering ram: strikes buildings only (+40 against them), all but immune to arrows, slow.
    ram: { hp: 175, damage: 2, range: 50, cooldown: 60, sight: 0, attack: "melee", armor: [0, 120], classes: ["siege", "ram"], bonus: { building: 40, siege: 13 }, buildingsOnly: true, alsoSiege: true },
    // Unique units (trained at the Castle): hit points, attack, armor and bonuses from aoetw.com's unit pages; range at
    // 50 units per tile over a 150 base (Longbowman 5 -> 300), melee cooldown = the reference's seconds x 10, ranged x 15.
    // Classes: 'unique' (the Samurai's bonus), 'gunpowder' (Turks), 'cavalry-archer' (Mongols); see docs/aoe2-rules-research.md.
    longbowman: { hp: 35, damage: 6, range: 300, cooldown: 30, sight: 400, attack: "pierce", armor: [0, 0], classes: ["archer", "unique"], bonus: { spear: 2 }, frameDelay: 5 },
    "woad-raider": { hp: 65, damage: 8, range: 50, cooldown: 20, sight: 350, attack: "melee", armor: [0, 1], classes: ["infantry", "unique"], bonus: { "standard-building": 2 } },
    // Its axes are thrown: a melee attack from 3 tiles.
    "throwing-axeman": { hp: 60, damage: 7, range: 200, cooldown: 20, sight: 350, attack: "melee", armor: [0, 0], classes: ["infantry", "unique"], bonus: { "standard-building": 1 }, frameDelay: 10 },
    huskarl: { hp: 60, damage: 10, range: 50, cooldown: 20, sight: 350, attack: "melee", armor: [0, 6], classes: ["infantry", "unique"], bonus: { "standard-building": 2, archer: 6 } },
    "teutonic-knight": { hp: 80, damage: 12, range: 50, cooldown: 20, sight: 350, attack: "melee", armor: [5, 2], classes: ["infantry", "unique"], bonus: { "standard-building": 4 } },
    // Regains 20 hit points a minute (Berserkergang: 40).
    berserk: { hp: 54, damage: 9, range: 50, cooldown: 20, sight: 350, attack: "melee", armor: [0, 1], classes: ["infantry", "unique"], bonus: { "standard-building": 2 }, regen: 20 },
    cataphract: { hp: 110, damage: 9, range: 50, cooldown: 18, sight: 350, attack: "melee", armor: [2, 1], classes: ["cavalry", "unique"], bonus: { infantry: 9 }, classArmor: { cavalry: 10 } },
    "war-elephant": { hp: 450, damage: 15, range: 50, cooldown: 20, sight: 350, attack: "melee", armor: [1, 2], classes: ["cavalry", "unique", "elephant"], bonus: { building: 7, "stone-defense": 7 }, trample: 0.5 },
    // A melee attack from 3 tiles, like the Throwing Axeman.
    mameluke: { hp: 65, damage: 8, range: 200, cooldown: 20, sight: 350, attack: "melee", armor: [0, 0], classes: ["cavalry", "unique", "mameluke"], bonus: { cavalry: 9 }, classArmor: { cavalry: 9 }, frameDelay: 24 },
    janissary: { hp: 35, damage: 17, range: 450, cooldown: 50, sight: 450, attack: "pierce", armor: [1, 0], classes: ["archer", "gunpowder", "unique"], bonus: { ram: 2 }, frameDelay: 4 },
    // Fires three arrows a shot: the first at full attack, the other two at 3 each.
    "chu-ko-nu": { hp: 45, damage: 8, range: 250, cooldown: 55, sight: 400, attack: "pierce", armor: [0, 0], classes: ["archer", "unique"], bonus: { spear: 2 }, extraShots: 2, extraDamage: 3, frameDelay: 3 },
    samurai: { hp: 60, damage: 8, range: 50, cooldown: 19, sight: 350, attack: "melee", armor: [1, 1], classes: ["infantry", "unique"], bonus: { "standard-building": 2, unique: 10 } },
    mangudai: { hp: 60, damage: 6, range: 250, cooldown: 30, sight: 400, attack: "pierce", armor: [0, 0], classes: ["archer", "cavalry", "cavalry-archer", "unique"], bonus: { siege: 3, spear: 1 }, frameDelay: 5 },
    // The 單位 round (aoetw.com units pages). Ranges 50 + 50 a tile like the archers (mangonel 7 -> 400, below the
    // castle's 400 as the site's 7 is below its 8), minimum ranges 50 a tile; building bonuses x0.32
    // (the battering ram's 125 -> 40 here) so a trebuchet levels a castle in about as many shots as there; blast radii in
    // this map's units (a node is 50).
    "cavalry-archer": { hp: 50, damage: 6, range: 250, cooldown: 30, sight: 400, attack: "pierce", armor: [0, 0], classes: ["archer", "cavalry", "cavalry-archer"], bonus: { spear: 2 }, frameDelay: 10 },
    camel: { hp: 100, damage: 6, range: 50, cooldown: 20, sight: 350, attack: "melee", armor: [0, 0], classes: ["camel"], bonus: { cavalry: 9, camel: 5, ship: 5, "fishing-ship": 5 } },
    // Hurls a stone that hits every enemy unit near the impact; cannot shoot closer than 3 tiles.
    mangonel: { hp: 50, damage: 40, range: 400, cooldown: 60, sight: 500, attack: "melee", armor: [0, 6], classes: ["siege"], bonus: { building: 11, siege: 4 }, minRange: 150, blast: 75, friendlyFire: true },
    // A bolt that goes on through the target: the units behind it on its path take half.
    scorpion: { hp: 40, damage: 12, range: 400, cooldown: 54, sight: 500, attack: "pierce", armor: [0, 7], classes: ["siege"], bonus: { elephant: 6, building: 1, ram: 1 }, minRange: 100, passThrough: 200, frameDelay: 42 },
    // Strikes buildings only, from 16 tiles; unpacks before firing and packs before moving (7.5 s each).
    trebuchet: { hp: 150, damage: 25, range: 850, cooldown: 100, sight: 0, attack: "melee", armor: [1, 8], classes: ["siege", "ram"], bonus: { building: 50 }, minRange: 200, buildingsOnly: true, setup: 150, frameDelay: 24 },
    // Spent by its charge; goes only where it is sent (no automatic fights).
    // The 科技 round: the gunpowder units Chemistry opens (aoetw.com; no accuracy model, every shot hits).
    "hand-cannoneer": { hp: 35, damage: 17, range: 400, cooldown: 52, sight: 450, attack: "pierce", armor: [1, 0], classes: ["archer", "gunpowder"], bonus: { infantry: 10, ram: 2, spear: 1 }, frameDelay: 5 },
    // Heavy shot from 12 tiles (minimum 5); the site's half-tile blast is one node here (50).
    "bombard-cannon": { hp: 80, damage: 40, range: 650, cooldown: 65, sight: 650, attack: "melee", armor: [2, 5], classes: ["siege", "gunpowder"], bonus: { building: 64, siege: 6, "stone-defense": 13, ship: 13, "fishing-ship": 13 }, minRange: 250, blast: 50, friendlyFire: true, frameDelay: 7 },
    petard: { hp: 50, damage: 25, range: 50, cooldown: 20, sight: 0, attack: "melee", armor: [0, 2], classes: ["petard"], bonus: { building: 55, siege: 19, "wall-gate": 99, castle: 11 }, selfDestruct: true },
    // The 建築 round: the dock's ships and the market's trade cart (aoetw.com units pages). Same conversions as above;
    // 'ship' puts a unit on the water layer (movement.ts layerOf). Fishing ships, transports and the trade units never
    // fight. 'warship': the galley line and the Longboat, which take the archer attack lines (Fletching to Bracer).
    "fishing-ship": { hp: 60, damage: 0, range: 0, cooldown: 0, sight: 0, attack: "none", armor: [0, 4], classes: ["fishing-ship"], bonus: {} },
    "transport-ship": { hp: 100, damage: 0, range: 0, cooldown: 0, sight: 0, attack: "none", armor: [4, 8], classes: ["ship", "transport"], bonus: {} },
    "trade-cog": { hp: 80, damage: 0, range: 0, cooldown: 0, sight: 0, attack: "none", armor: [0, 6], classes: ["ship", "trade"], bonus: {} },
    "trade-cart": { hp: 70, damage: 0, range: 0, cooldown: 0, sight: 0, attack: "none", armor: [0, 0], classes: ["trade"], bonus: {} },
    galley: { hp: 120, damage: 6, range: 300, cooldown: 46, sight: 400, attack: "pierce", armor: [0, 6], classes: ["ship", "warship", "galley"], bonus: { ship: 8, "fishing-ship": 8, building: 2, ram: 3 } },
    // Fire: a short-range stream four times a second (the reference's 0.25 s), strong only against ships.
    "fire-galley": { hp: 100, damage: 1, range: 175, cooldown: 5, sight: 300, attack: "melee", armor: [0, 4], classes: ["ship", "fire"], bonus: { ship: 3, "fishing-ship": 1 }, classArmor: { ship: 6 } },
    // Spent by its blast (the petard's rule): every enemy unit within the radius of the target takes the hit.
    "demolition-raft": { hp: 45, damage: 90, range: 50, cooldown: 20, sight: 0, attack: "melee", armor: [0, 2], classes: ["ship", "demolition"], bonus: { building: 58 }, blast: 125, selfDestruct: true, classArmor: { ship: 1 } },
    "cannon-galleon": { hp: 120, damage: 35, range: 700, cooldown: 100, sight: 700, attack: "melee", armor: [0, 6], classes: ["ship", "gunpowder"], bonus: { building: 64, siege: 13, infantry: 15, archer: 15, cavalry: 15, mameluke: 4 }, minRange: 150 },
    // Four arrows a volley: the first at full attack, the other three at 1 each (aoetw).
    longboat: { hp: 130, damage: 7, range: 350, cooldown: 50, sight: 400, attack: "pierce", armor: [0, 6], classes: ["ship", "warship", "unique"], bonus: { ship: 9, "fishing-ship": 9, building: 2, ram: 4 }, extraShots: 3, extraDamage: 1 }
  },
  // Structures shrug off arrows: [melee, pierce] armor of every building.
  buildingArmor: [0, 2],
  buildings: {
    "town-center": 400,
    house: 150,
    barracks: 300,
    farm: 100,
    "lumber-camp": 200,
    "mining-camp": 200,
    mill: 200,
    stable: 300,
    "archery-range": 300,
    monastery: 350,
    blacksmith: 300,
    "watch-tower": 250,
    "siege-workshop": 300,
    castle: 800,
    university: 350,
    // The 建築 round: about the site's hit points / 6 like the castle (4800 -> 800); the fish trap keeps a token 40.
    market: 350,
    dock: 300,
    "fish-trap": 40,
    outpost: 100,
    "bombard-tower": 370,
    wonder: 800,
    "palisade-wall": 60,
    "palisade-gate": 70,
    "stone-wall": 300,
    gate: 450
  },
  corpseTicks: 40,
  hitFlashTicks: 6,
  // Movement per tick.
  // A unit stops exactly on each node; what a step cut short there leaves over carries to the next tick while the walk
  // goes on (movement.ts u.stride), so a walk covers speed x ticks for any speed to a hundredth (speedOf).
  speed: {
    villager: 5,
    militia: 5,
    archer: 5,
    scout: 10,
    monk: 5,
    sheep: 5,
    deer: 10,
    boar: 5,
    spearman: 5,
    skirmisher: 5,
    knight: 10,
    ram: 2,
    longbowman: 5,
    "woad-raider": 7,
    "throwing-axeman": 6,
    huskarl: 6,
    "teutonic-knight": 4,
    berserk: 6,
    cataphract: 10,
    "war-elephant": 4,
    mameluke: 10,
    janissary: 5,
    "chu-ko-nu": 5,
    samurai: 6,
    mangudai: 10,
    "cavalry-archer": 10,
    camel: 10,
    mangonel: 4,
    scorpion: 4,
    trebuchet: 5,
    petard: 5,
    "hand-cannoneer": 5,
    "bombard-cannon": 4.4,
    // Ships and the trade cart: the site's tiles a second x 6.25 (the villager's 0.8 -> 5).
    "fishing-ship": 7.9,
    "transport-ship": 9.1,
    "trade-cog": 8.25,
    "trade-cart": 6.25,
    galley: 8.9,
    "fire-galley": 8.1,
    "demolition-raft": 9.4,
    "cannon-galleon": 6.9,
    longboat: 9.6
  }
};
var religionBonus = { sanctityHp: 15 };
var projectileRules = {
  provenance: "aoetw.com accuracy and projectile speed; design_default hit radius, miss spread and melee reach",
  hitRadius: 30,
  missSpread: [40, 100],
  meleeReach: 75,
  units: {
    archer: { accuracy: 80, speed: 17.5 },
    skirmisher: { accuracy: 90, speed: 17.5 },
    "cavalry-archer": { accuracy: 50, speed: 17.5 },
    longbowman: { accuracy: 70, speed: 17.5 },
    "chu-ko-nu": { accuracy: 85, speed: 17.5 },
    mangudai: { accuracy: 95, speed: 17.5 },
    "throwing-axeman": { accuracy: 100, speed: 17.5 },
    mameluke: { accuracy: 100, speed: 17.5 },
    "hand-cannoneer": { accuracy: 65, speed: 13.75 },
    janissary: { accuracy: 50, speed: 13.75 },
    scorpion: { accuracy: 100, speed: 15 },
    mangonel: { accuracy: 100, speed: 8.75 },
    trebuchet: { accuracy: 80, speed: 8.75 },
    "bombard-cannon": { accuracy: 92, speed: 10 },
    galley: { accuracy: 100, speed: 15 },
    longboat: { accuracy: 100, speed: 15 },
    "fire-galley": { accuracy: 100, speed: 7.5 },
    "cannon-galleon": { accuracy: 50, speed: 4.875 }
  },
  // Line upgrades that change the accuracy (the others keep their line's).
  steps: { crossbowman: 85, arbalest: 90, "elite-longbowman": 80 },
  buildings: { "town-center": { accuracy: 100, speed: 17.5 }, "watch-tower": { accuracy: 100, speed: 17.5 }, castle: { accuracy: 100, speed: 17.5 }, "bombard-tower": { accuracy: 92, speed: 7.5 } }
};
function shotOf(kind, who = []) {
  const base = projectileRules.units[kind];
  if (!base) return null;
  const o = asOwner(who);
  let accuracy = base.accuracy;
  for (const up2 of lineUpgrades) if (up2.kind === kind && o.techs.includes(up2.id) && projectileRules.steps[up2.id]) accuracy = projectileRules.steps[up2.id];
  const classes = combatRules.units[kind]?.classes ?? [];
  return { accuracy, speed: base.speed, steady: steadyAccuracy(o, kind, classes), lead: leadsUnit(o, kind, classes) };
}
function buildingShotOf(kind, who = []) {
  const base = projectileRules.buildings[kind] ?? { accuracy: 100, speed: 17.5 };
  return { accuracy: base.accuracy, speed: base.speed, steady: 0, lead: leadsBuilding(asOwner(who), kind) };
}
var lineUpgrades = [
  { id: "man-at-arms", kind: "militia", name: "\u91CD\u6B65\u5175", set: { hp: 55, damage: 8, bonus: { "standard-building": 2 } } },
  { id: "long-swordsman", kind: "militia", name: "\u9577\u528D\u58EB", set: { hp: 60, damage: 9, armor: [1, 1], bonus: { "standard-building": 3 } } },
  { id: "pikeman", kind: "spearman", name: "\u9577\u77DB\u5175", set: { hp: 55, bonus: { cavalry: 18, camel: 15, elephant: 20, ship: 13, "fishing-ship": 13, mameluke: 9, "standard-building": 1 } } },
  { id: "crossbowman", kind: "archer", name: "\u5F29\u624B", set: { hp: 35, damage: 5, range: 300 } },
  { id: "elite-skirmisher", kind: "skirmisher", name: "\u7CBE\u92B3\u6563\u5175", set: { hp: 35, damage: 3, armor: [0, 4], bonus: { archer: 4, spear: 3, "cavalry-archer": 2 } } },
  { id: "light-cavalry", kind: "scout", name: "\u8F15\u9A0E\u5175", set: { hp: 60, damage: 5, bonus: { monk: 10 } } },
  // The 單位 round: each line's last upgrades (aoetw.com's numbers where this game's line already matched them; whole
  // fields again, so armor and bonus are listed in full).
  { id: "two-handed-swordsman", kind: "militia", name: "\u96D9\u624B\u528D\u5175", set: { hp: 65, damage: 12, armor: [1, 1], bonus: { "standard-building": 4 } } },
  { id: "champion", kind: "militia", name: "\u528D\u5175\u52C7\u58EB", set: { hp: 75, damage: 13, armor: [2, 1], bonus: { "standard-building": 4 } } },
  { id: "halberdier", kind: "spearman", name: "\u621F\u5175", set: { hp: 60, damage: 6, bonus: { cavalry: 26, camel: 21, elephant: 22, ship: 14, "fishing-ship": 14, mameluke: 9, "standard-building": 1 } } },
  { id: "arbalest", kind: "archer", name: "\u5F37\u5F29\u5175", set: { hp: 40, damage: 6, range: 300 } },
  { id: "heavy-cavalry-archer", kind: "cavalry-archer", name: "\u91CD\u88DD\u99AC\u5F13\u9A0E\u5175", set: { hp: 60, damage: 7, armor: [1, 0] } },
  { id: "hussar", kind: "scout", name: "\u5308\u7259\u5229\u8F15\u9A0E\u5175", set: { hp: 75, damage: 7, bonus: { monk: 12 } } },
  { id: "cavalier", kind: "knight", name: "\u91CD\u88DD\u9A0E\u58EB", set: { hp: 120, damage: 12 } },
  { id: "paladin", kind: "knight", name: "\u904A\u4FE0", set: { hp: 160, damage: 14, cooldown: 19, armor: [2, 3] } },
  { id: "heavy-camel", kind: "camel", name: "\u91CD\u88DD\u99F1\u99DD\u9A0E\u5175", set: { hp: 120, damage: 7, bonus: { cavalry: 18, camel: 9, ship: 9, "fishing-ship": 9, mameluke: 7 } } },
  { id: "capped-ram", kind: "ram", name: "\u88DD\u7532\u885D\u649E\u8ECA", set: { hp: 200, damage: 3, bonus: { building: 48, siege: 16 }, classArmor: { ram: 1 }, buildingSplash: 75 } },
  { id: "siege-ram", kind: "ram", name: "\u91CD\u578B\u885D\u649E\u8ECA", set: { hp: 270, damage: 4, bonus: { building: 64, siege: 21 }, classArmor: { ram: 2 }, buildingSplash: 100 } },
  { id: "onager", kind: "mangonel", name: "\u4E2D\u578B\u6295\u77F3\u8ECA", set: { hp: 60, damage: 50, range: 450, armor: [0, 7], bonus: { building: 14, siege: 4 }, blast: 90 } },
  { id: "siege-onager", kind: "mangonel", name: "\u91CD\u578B\u6295\u77F3\u8ECA", set: { hp: 70, damage: 75, range: 450, armor: [0, 8], bonus: { building: 19, siege: 4 }, blast: 110 } },
  { id: "heavy-scorpion", kind: "scorpion", name: "\u91CD\u578B\u5F29\u7832", set: { hp: 50, damage: 16, bonus: { elephant: 8, building: 1, ram: 2 }, frameDelay: 26 } },
  // Elite unique units (aoetw.com's elite columns; armor and bonus are whole fields, so each lists both).
  { id: "elite-longbowman", kind: "longbowman", name: "\u7CBE\u92B3\u9577\u5F13\u5175", set: { hp: 40, damage: 7, range: 350, armor: [0, 1] } },
  { id: "elite-woad-raider", kind: "woad-raider", name: "\u7CBE\u92B3\u83D8\u85CD\u6B66\u58EB", set: { hp: 80, damage: 13, bonus: { "standard-building": 3 } } },
  { id: "elite-throwing-axeman", kind: "throwing-axeman", name: "\u7CBE\u92B3\u64F2\u65A7\u5175", set: { hp: 70, damage: 8, range: 250, armor: [1, 0], bonus: { "standard-building": 2 }, frameDelay: 8 } },
  { id: "elite-huskarl", kind: "huskarl", name: "\u7CBE\u92B3\u54E5\u5FB7\u885B\u968A", set: { hp: 70, damage: 12, armor: [0, 8], bonus: { "standard-building": 3, archer: 10 } } },
  { id: "elite-teutonic-knight", kind: "teutonic-knight", name: "\u7CBE\u92B3\u689D\u9813\u6B66\u58EB", set: { hp: 100, damage: 17, armor: [10, 2] } },
  { id: "elite-berserk", kind: "berserk", name: "\u7CBE\u92B3\u72C2\u6230\u58EB", set: { hp: 62, damage: 14, armor: [2, 1], bonus: { "standard-building": 3 } } },
  { id: "elite-cataphract", kind: "cataphract", name: "\u7CBE\u92B3\u62DC\u5360\u5EAD\u8056\u9A0E\u5175", set: { hp: 150, damage: 12, cooldown: 17, bonus: { infantry: 12 }, classArmor: { cavalry: 13 } } },
  { id: "elite-war-elephant", kind: "war-elephant", name: "\u7CBE\u92B3\u6230\u8C61", set: { hp: 600, damage: 20, armor: [1, 3], bonus: { building: 10, "stone-defense": 10 } } },
  { id: "elite-mameluke", kind: "mameluke", name: "\u7CBE\u92B3\u963F\u62C9\u4F2F\u5974\u96B8\u5175", set: { hp: 80, damage: 10, armor: [1, 0], bonus: { cavalry: 12, mameluke: 1 }, frameDelay: 12 } },
  { id: "elite-janissary", kind: "janissary", name: "\u7CBE\u92B3\u571F\u8033\u5176\u706B\u69CD\u5175", set: { hp: 40, damage: 22, armor: [2, 0], bonus: { ram: 3 }, frameDelay: 0 } },
  { id: "elite-chu-ko-nu", kind: "chu-ko-nu", name: "\u7CBE\u92B3\u9023\u5F29\u5175", set: { hp: 50, cooldown: 58, extraShots: 4 } },
  { id: "elite-samurai", kind: "samurai", name: "\u7CBE\u92B3\u65E5\u672C\u6B66\u58EB", set: { hp: 80, damage: 12, bonus: { "standard-building": 3, unique: 12 } } },
  { id: "elite-mangudai", kind: "mangudai", name: "\u7CBE\u92B3\u8499\u53E4\u7A81\u9A0E", set: { damage: 8, armor: [1, 0], bonus: { siege: 5, spear: 1 } } },
  // The dock's upgrades (aoetw.com). War Galley upgrades all three Feudal ships at once.
  { id: "war-galley", kind: "galley", name: "\u5F29\u7832\u6230\u8239", set: { hp: 135, damage: 7, range: 350, bonus: { ship: 9, "fishing-ship": 9, building: 2, ram: 4 } } },
  { id: "galleon", kind: "galley", name: "\u91CD\u578B\u5F29\u7832\u6230\u8239", set: { hp: 165, damage: 8, range: 400, armor: [0, 8], bonus: { ship: 11, "fishing-ship": 11, building: 3, ram: 4 } } },
  { id: "war-galley", kind: "fire-galley", name: "\u706B\u6230\u8239", set: { hp: 120, damage: 2, armor: [0, 6], bonus: { ship: 3, "fishing-ship": 3, building: 1 } } },
  { id: "fast-fire-ship", kind: "fire-galley", name: "\u91CD\u578B\u706B\u6230\u8239", set: { hp: 140, damage: 3, armor: [0, 8], bonus: { ship: 4, "fishing-ship": 4, building: 1 }, classArmor: { ship: 9 } } },
  { id: "war-galley", kind: "demolition-raft", name: "\u7206\u7834\u8239", set: { hp: 60, damage: 110, armor: [0, 3], bonus: { building: 70 }, blast: 150, classArmor: { ship: 3 } } },
  { id: "heavy-demolition-ship", kind: "demolition-raft", name: "\u91CD\u578B\u7206\u7834\u8239", set: { hp: 70, damage: 140, armor: [0, 5], bonus: { building: 90 }, blast: 175, classArmor: { ship: 5 } } },
  { id: "elite-cannon-galleon", kind: "cannon-galleon", name: "\u7CBE\u92B3\u706B\u7832\u6230\u8239", set: { hp: 150, damage: 45, range: 800, armor: [0, 8], bonus: { building: 88, siege: 13, infantry: 15, archer: 15, cavalry: 15, mameluke: 4 } } },
  { id: "elite-longboat", kind: "longboat", name: "\u7CBE\u92B3\u7DAD\u4EAC\u5927\u6230\u8239", set: { hp: 160, damage: 8, range: 400, armor: [0, 8], bonus: { ship: 11, "fishing-ship": 11, building: 3, ram: 4 } } }
];
var blacksmith = {
  forging: { classes: ["infantry", "cavalry", "camel"], exclude: ["cavalry-archer"], attack: 1 },
  "iron-casting": { classes: ["infantry", "cavalry", "camel"], exclude: ["cavalry-archer"], attack: 1 },
  "blast-furnace": { classes: ["infantry", "cavalry", "camel"], exclude: ["cavalry-archer"], attack: 2 },
  "scale-mail-armor": { classes: ["infantry"], melee: 1, pierce: 1 },
  "chain-mail-armor": { classes: ["infantry"], melee: 1, pierce: 1 },
  "plate-mail-armor": { classes: ["infantry"], melee: 1, pierce: 2 },
  "scale-barding-armor": { classes: ["cavalry", "camel"], exclude: ["cavalry-archer"], melee: 1, pierce: 1 },
  "chain-barding-armor": { classes: ["cavalry", "camel"], exclude: ["cavalry-archer"], melee: 1, pierce: 1 },
  "plate-barding-armor": { classes: ["cavalry", "camel"], exclude: ["cavalry-archer"], melee: 1, pierce: 2 },
  fletching: { classes: ["archer", "warship"], exclude: ["gunpowder"], attack: 1, range: 50 },
  "bodkin-arrow": { classes: ["archer", "warship"], exclude: ["gunpowder"], attack: 1, range: 50 },
  bracer: { classes: ["archer", "warship"], exclude: ["gunpowder"], attack: 1, range: 50 },
  "padded-archer-armor": { classes: ["archer"], melee: 1, pierce: 1 },
  "leather-archer-armor": { classes: ["archer"], melee: 1, pierce: 1 },
  "ring-archer-armor": { classes: ["archer"], melee: 1, pierce: 2 }
};
function statsOf(kind, who = []) {
  const o = asOwner(who), techs = o.techs;
  let st = { ...combatRules.units[kind] };
  for (const up2 of lineUpgrades) if (up2.kind === kind && techs.includes(up2.id)) st = { ...st, ...up2.set };
  let [m, p] = st.armor;
  for (const id of techs) {
    const b = blacksmith[id];
    if (!b || !b.classes.some((c) => st.classes.includes(c))) continue;
    if (b.exclude?.some((c) => st.classes.includes(c))) continue;
    if (b.attack && st.attack !== "none") st.damage += b.attack;
    if (b.range && st.range > 50) st.range += b.range;
    m += b.melee ?? 0;
    p += b.pierce ?? 0;
  }
  const cls = st.classes;
  if (st.attack !== "none") st.damage += unitSum(o, "attack", kind, cls);
  if (st.range > 50) st.range += unitSum(o, "range", kind, cls);
  st.armor = [m + unitSum(o, "meleeArmor", kind, cls), p + unitSum(o, "pierceArmor", kind, cls)];
  const extra = unitBonuses(o, kind, cls);
  if (Object.keys(extra).length) {
    const bonus = { ...st.bonus };
    for (const [c, v] of Object.entries(extra)) bonus[c] = (bonus[c] ?? 0) + v;
    st.bonus = bonus;
  }
  for (const { vs, scale } of bonusScales(o, kind, cls)) if (st.bonus[vs]) {
    st.bonus = { ...st.bonus, [vs]: Math.round(st.bonus[vs] * scale) };
  }
  const pace = unitProduct(o, "cooldown", kind, cls);
  if (pace !== 1) st.cooldown = Math.max(1, Math.round(st.cooldown * pace));
  for (const k of ["regen", "extraShots", "splash", "blast"]) {
    const v = unitSum(o, k, kind, cls);
    if (v) st[k] = (st[k] ?? 0) + v;
  }
  const pack = unitProduct(o, "setup", kind, cls);
  if (st.setup && pack !== 1) st.setup = Math.max(1, Math.round(st.setup * pack));
  st.hp = Math.round(st.hp * unitProduct(o, "hp", kind, cls)) + (kind === "monk" && techs.includes("sanctity") ? religionBonus.sanctityHp : 0) + (kind === "villager" ? villagerHpBonus(techs) : 0) + unitSum(o, "hp", kind, cls);
  return st;
}
function maxHpOf(kind, who) {
  return statsOf(kind, who).hp;
}
function speedOf(kind, who = []) {
  const o = asOwner(who), base = combatRules.speed[kind];
  const scale = unitProduct(o, "speed", kind, combatRules.units[kind].classes);
  return scale === 1 ? base : Math.max(1, Math.round(base * scale * 100) / 100);
}
function buildingHpOf(kind, who = []) {
  return Math.round((combatRules.buildings[kind] ?? 0) * buildingHpScale(asOwner(who), kind));
}
function hitDamage(attacker, target) {
  if (attacker.attack === "none") return 0;
  const armor = attacker.attack === "pierce" ? target.armor[1] : target.armor[0];
  const bonus = target.classes.reduce((t, c) => t + (attacker.bonus[c] ? Math.max(0, attacker.bonus[c] - (target.classArmor?.[c] ?? 0)) : 0), 0);
  return Math.max(1, Math.max(0, attacker.damage - armor) + bonus);
}
var stoneDefense = /* @__PURE__ */ new Set(["stone-wall", "gate", "watch-tower", "bombard-tower"]);
var wallGate = /* @__PURE__ */ new Set(["palisade-wall", "stone-wall", "palisade-gate", "gate"]);
function buildingClassesOf(kind) {
  return ["building", ...kind === "wonder" ? [] : ["standard-building"], ...stoneDefense.has(kind) ? ["stone-defense"] : [], ...wallGate.has(kind) ? ["wall-gate"] : [], ...kind === "castle" ? ["castle"] : []];
}
var buildingClassArmor = { castle: 3, "stone-wall": 5, gate: 6 };
var buildingTarget = { armor: combatRules.buildingArmor, classes: ["building", "standard-building"] };
function buildingTargetOf(kind, who = []) {
  const o = asOwner(who), [m, p] = buildingArmorBonus(o, kind), c = (buildingClassArmor[kind] ?? 0) + buildingClassArmorBonus(o, kind);
  return { armor: [buildingTarget.armor[0] + m, buildingTarget.armor[1] + p], classes: buildingClassesOf(kind), ...c ? { classArmor: { building: c } } : {} };
}

// packages/content/openings.ts
var gatherKinds = ["sheep", "hunt", "berries", "wood", "gold", "stone", "farm"];
var all = ["britons", "celts", "franks", "goths", "teutons", "vikings", "byzantines", "persians", "saracens", "turks", "chinese", "japanese", "mongols"];
var w = (food, wood, gold = 0, stone = 0) => ({ food, wood, gold, stone });
var site2 = (page) => `aoetw.com/ar/${page}`;
var opening = [
  { label: "\u6751\u6C11 1\u20133\uFF1A3 \u4EBA\u63A1\u7F8A\u8089", phase: "dark", done: { villagers: 3, gather: { sheep: 3 } } },
  { label: "\u6751\u6C11 4\u20135\uFF1A2 \u4EBA\u4F10\u6728", phase: "dark", done: { villagers: 5, gather: { wood: 2 } } },
  { label: "\u6751\u6C11 6\uFF1A1 \u4EBA\u6253\u7375\uFF08\u91CE\u8C6C\u6216\u9E7F\uFF09", phase: "dark", done: { villagers: 6, gather: { hunt: 1 } } },
  { label: "\u6751\u6C11 7\u20138\uFF1A2 \u4EBA\u63A1\u679C\u6A39", phase: "dark", done: { villagers: 8, gather: { berries: 2 } } }
];
var loom = { label: "\u7814\u7A76\u7E54\u5E03\u6A5F", phase: "dark", done: { techs: ["loom"] } };
var up = (n) => ({ label: `\u6751\u6C11 ${n} \u4EBA\uFF1A\u5347\u7B2C\u4E8C\u6642\u4EE3`, phase: "dark", done: { villagers: n, clicked: 2 } });
var standardOpening = "standard";
var randomOpening = "random";
var openings = [
  {
    id: "scrush",
    zh: "\u8089\u99AC\u958B\u5C40",
    en: "Scout rush",
    page: site2("scrush"),
    age: 2,
    power: "\u666E",
    difficulty: "\u63A7\u7D93\u6FDF\u7C21\u55AE\u3001\u63A7\u99AC\u8F03\u96E3",
    pros: "\u5E7E\u4E4E\u4EFB\u4F55\u6587\u660E\u53EF\u7528\uFF0C\u9748\u6D3B\u5EA6\u9AD8",
    cons: "\u9047\u5230\u570D\u6B7B\u6216\u88DD\u7532\u5854\u6703\u5403\u8667",
    civs: all,
    best: ["mongols"],
    counters: ["\u628A\u5BB6\u570D\u6B7B", "\u88DD\u7532\u5854", "\u5927\u91CF\u5F13\u5175", "\u5927\u91CF\u9577\u69CD\u5175\uFF08\u9019\u6642\u8F49\u6563\u5175\u6216\u5F13\u5175\uFF09"],
    allocation: "\u5347\u7D1A\u524D\uFF1A\u98DF\u7269 5\uFF08\u7F8A\u3001\u679C\u6A39\u3001\u8FB2\u7530\uFF09\u3001\u6728\u6750 5",
    siteAllocation: "5\u7F8A2\u75304\u679C10\u6728\uFF0822 \u4EBA\u53E3\uFF09",
    steps: [
      ...opening,
      { label: "\u6751\u6C11 9\u201310\uFF1A2 \u4EBA\u4F10\u6728", phase: "dark", done: { villagers: 10, gather: { wood: 4 } } },
      loom,
      up(10),
      { label: "\u5347\u7D1A\u4E2D\u84CB\u5175\u71DF", phase: "up", done: { buildings: { barracks: 1 } } },
      { label: "\u7B2C\u4E8C\u6642\u4EE3\uFF1A\u84CB\u99AC\u5EC4", phase: "feudal", done: { age: 2, buildings: { stable: 1 } } },
      { label: "\u7814\u7A76\u96D9\u5203\u65A7\u8207\u99AC\u8EDB", phase: "feudal", done: { techs: ["double-bit-axe", "horse-collar"] } },
      { label: "\u8A13\u7DF4 3 \u96BB\u65A5\u5019\uFF0C\u9A37\u64FE\u5C0D\u65B9\u7684\u63A1\u96C6\u9EDE", phase: "feudal", done: { units: { scout: 4 }, raiding: 1 } },
      { label: "\u65B0\u6751\u6C11\u53BB\u7A2E\u7530", phase: "feudal", done: { gather: { farm: 3 } } },
      { label: "\u5C0D\u65B9\u51FA\u9577\u69CD\u5175\u5C31\u8F49\u6563\u5175\u6216\u5F13\u5175", phase: "feudal", done: null }
    ],
    plan: {
      villagers: 12,
      clickAt: 10,
      loom: true,
      barracks: "up",
      weights: { dark: w(5, 5), up: w(5, 5), feudal: w(8, 3, 1) },
      train: { feudal: { scout: 4 } },
      build: [{ kind: "stable", count: 1 }],
      research: ["double-bit-axe", "horse-collar"],
      raid: { kinds: ["scout"], sendAt: 2, reinforce: true },
      towers: null,
      castle: false,
      until: { tick: 9600 }
    },
    notes: ["\u65A5\u5019\u4EBA\u53E3\u542B\u958B\u5C40\u65A5\u5019\uFF1A\u8A13\u7DF4 3 \u96BB\u5F8C\u5171 4 \u96BB\uFF0C\u958B\u5C40\u90A3\u96BB\u7E7C\u7E8C\u5075\u5BDF\u3002"]
  },
  {
    id: "archerstar",
    zh: "\u5C0F\u5F13\u958B\u5C40",
    en: "Archer opening",
    page: site2("archerstar"),
    age: 2,
    power: "\u5F37",
    difficulty: "\u666E",
    pros: "\u5A01\u529B\u5F37\uFF0C\u4F46\u6210\u5F62\u6162",
    cons: "\u6210\u5F62\u6162\uFF0C\u5BB9\u6613\u88AB\u8089\u99AC\u8F49\u77DB\u6253\u6B7B",
    civs: all,
    best: ["britons"],
    counters: ["\u6563\u5175", "\u5148\u7528\u65A5\u5019\u6436\u653B\uFF0C\u518D\u8F49\u6563\u5175"],
    allocation: "\u5347\u7D1A\u524D\uFF1A\u98DF\u7269 5\uFF08\u7F8A\u3001\u679C\u6A39\u3001\u8FB2\u7530\uFF09\u3001\u6728\u6750 5\uFF1B\u9EDE\u5C01\u5F8C 2 \u4EBA\u6316\u91D1",
    siteAllocation: "12\u67284\u91D14\u679C2\u7530",
    steps: [
      ...opening,
      { label: "\u6751\u6C11 9\u201310\uFF1A2 \u4EBA\u7A2E\u7530", phase: "dark", done: { villagers: 10, gather: { farm: 2 } } },
      loom,
      up(10),
      { label: "\u9EDE\u5C01\u5F8C 2 \u4EBA\u6316\u91D1", phase: "up", done: { gather: { gold: 2 } } },
      { label: "\u5347\u7D1A\u4E2D\u84CB\u5175\u71DF", phase: "up", done: { buildings: { barracks: 1 } } },
      { label: "\u7B2C\u4E8C\u6642\u4EE3\uFF1A\u84CB\u5169\u5EA7\u9776\u5834", phase: "feudal", done: { age: 2, buildings: { "archery-range": 2 } } },
      { label: "\u5148\u51FA 1 \u96BB\u9577\u69CD\u5175\u9632\u65A5\u5019", phase: "feudal", done: { units: { spearman: 1 } } },
      { label: "\u5F13\u624B 6 \u540D\u5F8C\u51FA\u64CA", phase: "feudal", done: { units: { archer: 6 }, raiding: 1 } },
      { label: "\u5C0D\u65B9\u51FA\u6563\u5175\u5C31\u6DF7\u9577\u69CD\u5175\u6216\u6563\u5175", phase: "feudal", done: null }
    ],
    plan: {
      villagers: 12,
      clickAt: 10,
      loom: true,
      barracks: "up",
      weights: { dark: w(5, 5), up: w(3, 5, 2), feudal: w(2, 6, 3) },
      train: { feudal: { spearman: 1, archer: 12 } },
      build: [{ kind: "archery-range", count: 2 }],
      research: [],
      raid: { kinds: ["archer"], sendAt: 6, reinforce: true },
      towers: null,
      castle: false,
      until: { tick: 9600 }
    },
    notes: ["\u7DB2\u7AD9\u7684\u8CC7\u8A0A\u6846\u5BEB\u300C\u5F13\u5175\u570B\u300D\uFF0C\u5167\u6587\u5BEB\u6240\u6709\u6587\u660E\u90FD\u9069\u5408\uFF1B\u9019\u88E1\u7167\u5167\u6587\u3002"]
  },
  {
    id: "armstar",
    zh: "\u88DD\u7532\u958B\u5C40",
    en: "Men-at-arms opening",
    page: site2("armstar"),
    age: 2,
    power: "\u666E",
    difficulty: "\u666E",
    pros: "\u5C01\u5EFA\u521D\u671F\u8FD1\u6230\u6700\u5F37\uFF0C\u53EF\u64CB\u524D\u7F6E\u8207\u9ED1\u5FEB",
    cons: "\u6015\u5F13\u5175\uFF0C\u5C01\u5EFA\u4E2D\u5F8C\u671F\u8D70\u5F97\u6162",
    civs: all,
    best: [],
    counters: ["\u5F13\u5175", "\u628A\u5BB6\u570D\u6B7B"],
    allocation: "\u5347\u7D1A\u524D\uFF1A\u98DF\u7269 5\u3001\u6728\u6750 4\u3001\u9EC3\u91D1 1",
    siteAllocation: "5\u7F8A2\u75304\u679C8\u67282\u91D1",
    steps: [
      ...opening,
      { label: "\u6751\u6C11 9\uFF1A1 \u4EBA\u6316\u91D1", phase: "dark", done: { villagers: 9, gather: { gold: 1 } } },
      { label: "\u84CB\u5175\u71DF", phase: "dark", done: { buildings: { barracks: 1 } } },
      { label: "\u6751\u6C11 10\uFF1A\u4F10\u6728", phase: "dark", done: { villagers: 10, gather: { wood: 3 } } },
      loom,
      up(10),
      { label: "\u9EDE\u5C01\u5F8C\u7ACB\u523B\u51FA 3 \u96BB\u6C11\u5175\u53BB\u9A37\u64FE", phase: "up", done: { units: { militia: 3 }, raiding: 1 } },
      { label: "\u7B2C\u4E8C\u6642\u4EE3\uFF1A\u6C11\u5175\u9084\u6D3B\u8457\u5C31\u7814\u7A76\u91CD\u6B65\u5175", phase: "feudal", done: { age: 2, techs: ["man-at-arms"] } },
      { label: "\u5BB6\u88E1\u6539\u84CB\u9776\u5834\u6216\u99AC\u5EC4", phase: "feudal", done: { buildings: { "archery-range": 1 } } },
      { label: "\u63A5\u8457\u914D\u5F13\u5175\u6216\u65A5\u5019\u9032\u653B", phase: "feudal", done: null }
    ],
    plan: {
      villagers: 12,
      clickAt: 10,
      loom: true,
      barracks: "dark",
      barracksAt: 9,
      weights: { dark: w(5, 4, 1), up: w(5, 3, 2), feudal: w(5, 4, 2) },
      train: { up: { militia: 3 }, feudal: { militia: 3 } },
      build: [{ kind: "archery-range", count: 1 }],
      research: ["man-at-arms"],
      raid: { kinds: ["militia"], sendAt: 3, reinforce: false },
      towers: null,
      castle: false,
      until: { tick: 9600 }
    },
    notes: ["\u7DB2\u7AD9\u9019\u9801\u7684\u8CC7\u8A0A\u6846\uFF08\u9069\u5408\u6587\u660E\u3001\u96E3\u5EA6\u3001\u512A\u7F3A\u9EDE\uFF09\u662F\u5F9E\u8089\u99AC\u958B\u5C40\u8907\u88FD\u4F86\u7684\uFF1B\u9019\u88E1\u7684\u512A\u7F3A\u9EDE\u7167\u5167\u6587\u3002"]
  },
  {
    id: "armstower",
    zh: "\u88DD\u7532\u5854",
    en: "Men-at-arms into towers",
    page: site2("armstower"),
    age: 2,
    power: "\u975E\u5E38\u5F37",
    difficulty: "\u96E3",
    pros: "\u5E7E\u4E4E\u4EFB\u4F55\u6587\u660E\u53EF\u7528\uFF0C\u5A01\u529B\u6975\u5927",
    cons: "\u5403\u63A7\u5236\u529B\u8207\u904B\u6C23",
    civs: all,
    best: ["japanese", "goths", "celts"],
    counters: ["\u9ED1\u6697\u6C11\u5175\u6216\u65A5\u5019\u6293\u524D\u7F6E\u7684\u6751\u6C11", "\u6751\u6C11\u570D\u4F4F\u5854\u4E0B\u62C6\u5854"],
    allocation: "\u5347\u7D1A\u524D\uFF1A\u98DF\u7269 5\u3001\u6728\u6750 2\u3001\u9EC3\u91D1 1\uFF1B\u9EDE\u5C01\u5F8C 2 \u4EBA\u63A1\u77F3\u30012 \u4EBA\u524D\u7F6E",
    siteAllocation: "\u9EDE\u5C01\u5F8C 3\uFF5E4 \u4EBA\u524D\u7F6E\u30014 \u4EBA\u63A1\u77F3",
    steps: [
      ...opening,
      { label: "\u6751\u6C11 9\uFF1A\u84CB\u5175\u71DF", phase: "dark", done: { villagers: 9, buildings: { barracks: 1 } } },
      { label: "\u6751\u6C11 10\uFF1A1 \u4EBA\u6316\u91D1", phase: "dark", done: { villagers: 10, gather: { gold: 1 } } },
      loom,
      up(10),
      { label: "\u9EDE\u5C01\u5F8C\u51FA 3 \u96BB\u6C11\u5175", phase: "up", done: { units: { militia: 3 } } },
      { label: "2 \u4EBA\u63A1\u77F3\u982D", phase: "up", done: { gather: { stone: 2 } } },
      { label: "2 \u540D\u6751\u6C11\u524D\u5F80\u5C0D\u65B9\u5BB6", phase: "up", done: { forward: { villager: 2 } } },
      { label: "\u7B2C\u4E8C\u6642\u4EE3\uFF1A\u7814\u7A76\u91CD\u6B65\u5175", phase: "feudal", done: { age: 2, techs: ["man-at-arms"] } },
      { label: "\u5728\u5C0D\u65B9\u7684\u8CC7\u6E90\u9EDE\u84CB\u7BAD\u5854", phase: "feudal", done: { forward: { "watch-tower": 1 } } },
      { label: "\u9023\u74B0\u63D2\u5854", phase: "feudal", done: { forward: { "watch-tower": 2 } } },
      { label: "\u65B0\u6751\u6C11\u53BB\u7A2E\u7530", phase: "feudal", done: { gather: { farm: 2 } } }
    ],
    plan: {
      villagers: 12,
      clickAt: 10,
      loom: true,
      barracks: "dark",
      barracksAt: 9,
      weights: { dark: w(5, 2, 1), up: w(4, 2, 1, 2), feudal: w(4, 3, 1, 2) },
      train: { up: { militia: 3 }, feudal: { militia: 3 } },
      build: [],
      research: ["man-at-arms"],
      raid: { kinds: ["militia"], sendAt: 3, reinforce: false },
      towers: { builders: 2, count: 2, prefer: ["berries", "gold", "stone"], leave: "click" },
      castle: false,
      until: { tick: 10800 }
    },
    notes: ["\u7DB2\u7AD9\u8AAA\u7B2C\u4E00\u5EA7\u5854\u84CB\u5728\u597D\u5C01\u9396\u7684\u5730\u65B9\uFF0C\u5C0D\u99AC\u570B\u5148\u5C01\u679C\u6A39\uFF0C\u5C0D\u5F13\u5175\u570B\u5148\u5C01\u9EC3\u91D1\uFF1B\u96FB\u8166\u4F9D\u679C\u6A39\u3001\u9EC3\u91D1\u3001\u77F3\u982D\u7684\u9806\u5E8F\u627E\u3002", "\u7DB2\u7AD9\u5EFA\u8B70\u5854\u4E0B\u84CB\u7246\uFF0C\u96FB\u8166\u4E0D\u84CB\u3002"]
  },
  {
    id: "towerrush",
    zh: "\u7D14\u5854",
    en: "Tower rush",
    page: site2("towerrush"),
    age: 2,
    power: "\u770B\u5730\u5F62",
    difficulty: "\u96E3",
    pros: "\u5E7E\u4E4E\u4EFB\u4F55\u6587\u660E\u53EF\u7528",
    cons: "\u5403\u904B\u6C23\u8207\u5730\u5F62",
    civs: all,
    best: ["mongols", "teutons"],
    counters: ["\u5075\u5BDF\u627E\u51FA\u524D\u7F6E\u7684\u6751\u6C11\uFF0C\u5728\u7B2C\u4E00\u5EA7\u5854\u84CB\u597D\u524D\u6253\u6389", "\u5854\u84CB\u597D\u4E86\u5C31\u6316\u77F3\u982D\u3001\u7814\u7A76\u57CE\u93AE\u77AD\u671B\uFF0C\u4EE5\u5854\u5B88\u5854", "\u5C0D\u65B9\u5BB6\u88E1\u7A7A\u865B\uFF0C\u6D3E\u65A5\u5019\u6216\u5F13\u5175\u53CD\u6253"],
    allocation: "\u5347\u7D1A\u524D\uFF1A\u98DF\u7269 4\u3001\u6728\u6750 1\u3001\u77F3\u982D 3\uFF1B\u9EDE\u5C01\u5F8C 3 \u4EBA\u524D\u7F6E",
    siteAllocation: "7\u4EBA\u524D\u7F6E2\u67285\u77F35\u679C",
    steps: [
      opening[0],
      { label: "\u6751\u6C11 4\uFF1A1 \u4EBA\u4F10\u6728", phase: "dark", done: { villagers: 4, gather: { wood: 1 } } },
      { label: "\u6751\u6C11 5\uFF1A1 \u4EBA\u6253\u7375", phase: "dark", done: { villagers: 5, gather: { hunt: 1 } } },
      { label: "\u6751\u6C11 6\u20137\uFF1A2 \u4EBA\u63A1\u679C\u6A39", phase: "dark", done: { villagers: 7, gather: { berries: 2 } } },
      { label: "\u6751\u6C11 8\u20139\uFF1A\u84CB\u63A1\u7926\u5834\u63A1\u77F3\u982D", phase: "dark", done: { villagers: 9, buildings: { "mining-camp": 1 }, gather: { stone: 2 } } },
      loom,
      up(9),
      { label: "\u9EDE\u5C01\u5F8C 3 \u540D\u6751\u6C11\u524D\u5F80\u5C0D\u65B9\u5BB6", phase: "up", done: { forward: { villager: 3 } } },
      { label: "\u7B2C\u4E8C\u6642\u4EE3\uFF1A\u5728\u5C0D\u65B9\u7684\u77F3\u982D\u6216\u8CC7\u6E90\u5340\u540C\u6642\u84CB\u5169\u5EA7\u5854", phase: "feudal", done: { age: 2, forward: { "watch-tower": 2 } } },
      { label: "\u7E7C\u7E8C\u9023\u74B0\u63D2\u5854", phase: "feudal", done: { forward: { "watch-tower": 3 } } },
      { label: "\u5C0D\u65B9\u4F86\u62C6\u5854\u6642\u7ACB\u523B\u5728\u5854\u4E0B\u84CB\u6728\u7246", phase: "feudal", done: null }
    ],
    plan: {
      villagers: 12,
      clickAt: 9,
      loom: true,
      barracks: "none",
      weights: { dark: w(4, 1, 0, 3), up: w(3, 1, 0, 3), feudal: w(4, 2, 0, 3) },
      train: {},
      build: [],
      research: [],
      raid: null,
      towers: { builders: 3, count: 3, prefer: ["stone", "gold", "berries"], leave: "click" },
      castle: false,
      until: { tick: 10800 }
    },
    notes: ["\u7DB2\u7AD9 20 \u4EBA\u53E3\uFF0819 \u540D\u6751\u6C11\uFF09\u9EDE\u5C01\u5EFA\uFF0C\u9019\u88E1 9 \u540D\u3002", "\u4E0D\u84CB\u5175\u71DF\uFF0C\u7701\u4E0B\u7684\u6728\u6750\u7D66\u5854\u3002"]
  },
  {
    id: "bbrush",
    zh: "\u9ED1\u6697\u7206\u6C11\u5175",
    en: "Dark Age militia rush",
    page: site2("bbrush"),
    age: 1,
    power: "\u5F31",
    difficulty: "\u666E",
    pros: "\u5347\u7D1A\u6642\u653E\u9577\u69CD\u5175\u53EF\u4EE5\u7121\u7E2B\u63A5\u8ECC",
    cons: "\u5F88\u597D\u9632\uFF0C\u6728\u7246\u5C31\u64CB\u5F97\u4F4F",
    civs: all,
    best: [],
    counters: ["\u6709\u6548\u7684\u570D\u7246", "\u4E0A\u5C01\u5EFA\u5F8C\u51FA\u5F13\u5175"],
    allocation: "\u5347\u7D1A\u524D\uFF1A\u98DF\u7269 5\u3001\u6728\u6750 3\u3001\u9EC3\u91D1 2\uFF0C\u5175\u71DF\u4E0D\u505C\u51FA\u6C11\u5175",
    siteAllocation: "19\uFF5E20p \u84CB\u8ECD\u71DF\uFF0C\u4E4B\u5F8C\u6751\u6C11\u548C\u6C11\u5175\u4E0D\u65B7",
    steps: [
      ...opening,
      { label: "\u6751\u6C11 9\uFF1A1 \u4EBA\u6316\u91D1", phase: "dark", done: { villagers: 9, gather: { gold: 1 } } },
      { label: "\u84CB\u5175\u71DF\uFF08\u53EF\u524D\u7F6E\u6216\u5F8C\u7F6E\uFF09", phase: "dark", done: { buildings: { barracks: 1 } } },
      { label: "\u6751\u6C11\u8207\u6C11\u5175\u4E0D\u65B7\u751F\u7522", phase: "dark", done: { units: { militia: 3 } } },
      { label: "\u6C11\u5175 3 \u96BB\u5F8C\u53BB\u9A37\u64FE\uFF0C\u512A\u5148\u6253\u9EC3\u91D1\u5340", phase: "dark", done: { raiding: 1 } },
      { label: "\u98DF\u7269\u5230 300 \u5C31\u5347\u7B2C\u4E8C\u6642\u4EE3", phase: "dark", done: { clicked: 2 } },
      { label: "\u5BB6\u88E1\u9069\u6642\u84CB\u6728\u7246", phase: "dark", done: { buildings: { "palisade-wall": 3 } } },
      { label: "\u4E0A\u5C01\u5EFA\u5F8C\u77ED\u66AB\u505C\u7559\uFF0C\u76F4\u63A5\u8DF3\u57CE\u5821", phase: "feudal", done: null }
    ],
    plan: {
      villagers: 10,
      clickAt: 9,
      clickOnFood: true,
      loom: false,
      barracks: "dark",
      barracksAt: 9,
      weights: { dark: w(5, 3, 2), up: w(5, 3, 2), feudal: w(5, 3, 2) },
      train: { dark: { militia: 6 }, up: { militia: 6 } },
      build: [],
      research: [],
      raid: { kinds: ["militia"], sendAt: 3, reinforce: true },
      towers: null,
      castle: false,
      until: { tick: 8400 }
    },
    notes: ["\u7DB2\u7AD9\u5BEB\u300C\u98DF\u7269\u9054 500 \u5373\u9EDE\u5C01\u5EFA\u300D\uFF0C\u672C\u4F5C\u7B2C\u4E8C\u6642\u4EE3 300 \u98DF\u7269\u3002", "\u96FB\u8166\u4E0D\u84CB\u7246\u3002"]
  },
  {
    id: "brushtof",
    zh: "\u9ED1\u5FEB\u8F49\u5C01",
    en: "Drush into Feudal",
    page: site2("brushtof"),
    age: 2,
    power: "\u666E",
    difficulty: "\u96E3",
    pros: "\u7D93\u6FDF\u6BD4 22 \u4EBA\u53E3\u4E0A\u5C01\u5EFA\u66F4\u597D\uFF0C\u6253\u6CD5\u9748\u6D3B",
    cons: "\u5F88\u5403\u63A7\u5236\u529B",
    civs: all,
    best: [],
    counters: ["\u5BB6\u88E1\u5C0F\u570D\uFF0C\u4E0D\u8B93\u6C11\u5175\u9B27\u5230", "\u4E0A\u5C01\u5EFA\u5F8C\u65A5\u5019\u914D\u6751\u6C11\u6E05\u6389\u6C11\u5175\uFF0C\u518D\u53CD\u6253"],
    allocation: "\u9ED1\u6697\u51FA 3 \u96BB\u6C11\u5175\uFF0C\u6751\u6C11\u5230 12 \u540D\u9EDE\u5C01\u5EFA\uFF0C2 \u4EBA\u6316\u91D1",
    siteAllocation: "28 \u4EBA\u53E3\uFF08\u542B 3 \u6C11\u5175\uFF09\u9EDE\u5C01\u5EFA\uFF0C\u6316\u91D1 1\uFF5E4 \u4EBA",
    steps: [
      ...opening,
      { label: "\u6751\u6C11 9\uFF1A1 \u4EBA\u6316\u91D1", phase: "dark", done: { villagers: 9, gather: { gold: 1 } } },
      { label: "\u6751\u6C11 10\uFF1A\u84CB\u5175\u71DF", phase: "dark", done: { villagers: 10, buildings: { barracks: 1 } } },
      { label: "\u51FA 3 \u96BB\u6C11\u5175\u51FA\u767C\u9A37\u64FE", phase: "dark", done: { units: { militia: 3 }, raiding: 1 } },
      { label: "\u6316\u91D1\u589E\u52A0\u5230 2 \u4EBA", phase: "dark", done: { gather: { gold: 2 } } },
      up(12),
      { label: "\u7B2C\u4E8C\u6642\u4EE3\uFF1A\u6C11\u5175\u9084\u591A\u5C31\u7814\u7A76\u91CD\u6B65\u5175", phase: "feudal", done: { age: 2, techs: ["man-at-arms"] } },
      { label: "\u770B\u5C0D\u65B9\u914D\u5175\u8F49\u9577\u69CD\u5175\u6216\u5F13\u5175\uFF08\u84CB\u9776\u5834\uFF09", phase: "feudal", done: { buildings: { "archery-range": 1 } } }
    ],
    plan: {
      villagers: 12,
      clickAt: 12,
      loom: true,
      barracks: "dark",
      barracksAt: 10,
      weights: { dark: w(5, 3, 2), up: w(5, 3, 2), feudal: w(5, 4, 2) },
      train: { dark: { militia: 3 }, up: { militia: 3 }, feudal: { militia: 3 } },
      build: [{ kind: "archery-range", count: 1 }],
      research: ["man-at-arms"],
      raid: { kinds: ["militia"], sendAt: 3, reinforce: false },
      towers: null,
      castle: false,
      until: { tick: 10800 }
    },
    notes: ["\u7DB2\u7AD9 28 \u4EBA\u53E3\uFF0825 \u540D\u6751\u6C11\uFF09\u9EDE\u5C01\u5EFA\uFF0C\u9019\u88E1 12 \u540D\u3002", "\u7DB2\u7AD9\u5BEB\u300C\u4E00\u5B9A\u8981\u8D95\u9E7F\u300D\uFF0C\u672C\u4F5C\u7684\u9E7F\u8D95\u4E0D\u52D5\u3002", "\u7DB2\u7AD9\u9019\u9801\u7684\u8CC7\u8A0A\u6846\u662F\u5F9E\u9ED1\u5FEB\u6436\u57CE\u8907\u88FD\u4F86\u7684\uFF1B\u9019\u88E1\u7684\u512A\u7F3A\u9EDE\u7167\u5167\u6587\u3002"]
  },
  {
    id: "brushfc",
    zh: "\u9ED1\u5FEB\u6436\u57CE",
    en: "Drush fast castle",
    page: site2("brushfc"),
    age: 3,
    power: "\u666E",
    difficulty: "\u96E3",
    pros: "\u5730\u5F62\u597D\u7684\u8A71\u975E\u5E38\u597D\u6253",
    cons: "\u5730\u5F62\u5DEE\u7684\u8A71\u5C0D\u65B9\u975E\u5E38\u597D\u6253\uFF0C\u5F88\u6015\u88DD\u7532\u5854",
    civs: all,
    best: ["britons", "vikings"],
    counters: ["\u770B\u5230\u5C0D\u65B9\u5F88\u665A\u4E0A\u5C01\u5EFA\uFF0C\u5C31\u6D3E 3 \u540D\u6751\u6C11\u524D\u7F6E\u7BAD\u5854\uFF0C\u5BB6\u88E1\u6316\u77F3\u982D", "\u5C0D\u65B9\u570D\u6B7B\u5C31\u8DDF\u8457\u570D\u5BB6\uFF0C\u6BD4\u8AB0\u5148\u5230\u57CE\u5821\u6642\u4EE3"],
    allocation: "\u9ED1\u6697\u51FA 3 \u96BB\u6C11\u5175\uFF0C\u6751\u6C11\u5230 15 \u540D\u9EDE\u5C01\u5EFA\uFF0C3 \u4EBA\u6316\u91D1",
    siteAllocation: "\u7E3D\u4EBA\u53E3 33\uFF0C\u6316\u91D1 4\uFF5E6 \u4EBA",
    steps: [
      ...opening,
      { label: "\u6751\u6C11 9\uFF1A1 \u4EBA\u6316\u91D1", phase: "dark", done: { villagers: 9, gather: { gold: 1 } } },
      { label: "\u6751\u6C11 10\uFF1A\u84CB\u5175\u71DF", phase: "dark", done: { villagers: 10, buildings: { barracks: 1 } } },
      { label: "\u51FA 3 \u96BB\u6C11\u5175\u51FA\u767C\u722D\u53D6\u6642\u9593", phase: "dark", done: { units: { militia: 3 }, raiding: 1 } },
      { label: "\u6316\u91D1\u589E\u52A0\u5230 3 \u4EBA", phase: "dark", done: { gather: { gold: 3 } } },
      up(15),
      { label: "\u8D81\u5C0D\u65B9\u5C01\u5EFA\u9032\u653B\u524D\u628A\u5BB6\u570D\u597D", phase: "up", done: null },
      { label: "\u7B2C\u4E8C\u6642\u4EE3\uFF1A\u7ACB\u523B\u5347\u7B2C\u4E09\u6642\u4EE3", phase: "feudal", done: { clicked: 3 } },
      { label: "\u7B2C\u4E09\u6642\u4EE3\uFF1A\u51FA\u9A0E\u58EB\u6216\u57CE\u5821\u5175\u6253\u5C0D\u65B9\u7D93\u6FDF", phase: "castle", done: { age: 3, buildings: { stable: 1 } } }
    ],
    plan: {
      villagers: 15,
      clickAt: 15,
      loom: true,
      barracks: "dark",
      barracksAt: 10,
      weights: { dark: w(6, 4, 2), up: w(6, 4, 3), feudal: w(6, 4, 3) },
      train: { dark: { militia: 3 } },
      build: [],
      research: [],
      raid: { kinds: ["militia"], sendAt: 3, reinforce: false },
      towers: null,
      castle: true,
      until: { tick: 14400, age: 3 }
    },
    notes: ["\u7DB2\u7AD9\u7E3D\u4EBA\u53E3 33\uFF08\u7D04 29 \u540D\u6751\u6C11\uFF09\uFF0C\u9019\u88E1 15 \u540D\u6751\u6C11\u3002", "\u7DB2\u7AD9\u7684\u8CC7\u8A0A\u6846\u5BEB\u5C01\u5EFA\u6642\u4EE3\uFF0C\u5176\u5BE6\u662F\u6436\u57CE\u5821\u7684\u6253\u6CD5\u3002", "\u96FB\u8166\u4E0D\u570D\u5BB6\uFF0C\u4E0A\u57CE\u5821\u5F8C\u7531\u4E00\u822C\u6253\u6CD5\u63A5\u624B\uFF08\u57CE\u5821\u3001\u7279\u6B8A\u55AE\u4F4D\u3001\u9A0E\u58EB\uFF09\u3002"]
  },
  {
    id: "fontrush",
    zh: "\u524D\u7F6E\u69CD\u77DB",
    en: "Forward spears and skirmishers",
    page: site2("fontrush"),
    age: 2,
    power: "\u5F37",
    difficulty: "\u666E",
    pros: "\u58D3\u8FEB\u611F\u5F37\uFF0C\u9084\u7B97\u80FD\u524B\u8089\u99AC\u8207\u5C0F\u5F13\u958B\u5C40",
    cons: "\u98A8\u96AA\u9AD8\uFF0C\u5831\u916C\u4E0D\u5982\u88DD\u7532\u5854",
    civs: all,
    best: ["byzantines"],
    counters: ["\u9ED1\u6697\u6C11\u5175\u8F49\u88DD\u7532\u6293\u524D\u7F6E\u7684\u6751\u6C11", "\u6C92\u6293\u5230\u5C31\u56E4\u65A5\u5019\u52A0\u6563\u5175\u53CD\u6253"],
    allocation: "\u5347\u7D1A\u524D\uFF1A\u98DF\u7269 5\u3001\u6728\u6750 5\uFF1B\u9EDE\u5C01\u5F8C 2 \u4EBA\u524D\u7F6E\u30012 \u4EBA\u63A1\u77F3",
    siteAllocation: "12\u67284\u91D16\u679C\uFF0C\u9EDE\u5C01\u5F8C 3 \u4EBA\u524D\u7F6E",
    steps: [
      ...opening,
      { label: "\u6751\u6C11 9\u201310\uFF1A2 \u4EBA\u4F10\u6728", phase: "dark", done: { villagers: 10, gather: { wood: 4 } } },
      loom,
      up(10),
      { label: "\u9EDE\u5C01\u5F8C 2 \u540D\u6751\u6C11\u524D\u7F6E\u5175\u71DF", phase: "up", done: { forward: { barracks: 1 } } },
      { label: "2 \u4EBA\u6316\u77F3\u982D", phase: "up", done: { gather: { stone: 2 } } },
      { label: "\u7B2C\u4E8C\u6642\u4EE3\uFF1A\u5148\u51FA\u9577\u69CD\u5175", phase: "feudal", done: { age: 2, units: { spearman: 2 } } },
      { label: "\u84CB\u5169\u5EA7\u9776\u5834\u51FA\u6563\u5175", phase: "feudal", done: { buildings: { "archery-range": 2 }, units: { skirmisher: 3 } } },
      { label: "\u5728\u5C0D\u65B9\u8CC7\u6E90\u5340\u63D2\u7BAD\u5854\uFF0C\u69CD\u77DB\u63A9\u8B77\u63A8\u9032", phase: "feudal", done: { forward: { "watch-tower": 1 }, raiding: 1 } }
    ],
    plan: {
      villagers: 12,
      clickAt: 10,
      loom: true,
      barracks: "none",
      forwardBarracks: 2,
      weights: { dark: w(5, 5), up: w(4, 4, 1, 2), feudal: w(4, 4, 2, 2) },
      train: { feudal: { spearman: 3, skirmisher: 6 } },
      build: [{ kind: "archery-range", count: 2 }],
      research: [],
      raid: { kinds: ["spearman", "skirmisher"], sendAt: 5, reinforce: true },
      towers: { builders: 2, count: 1, prefer: ["gold", "berries", "stone"], leave: "click" },
      castle: false,
      until: { tick: 10800 }
    },
    notes: ["\u7DB2\u7AD9\u7684\u300C\u77DB\u5175\u300D\u662F\u672C\u4F5C\u7684\u6563\u5175\uFF0C\u300C\u69CD\u5175\u300D\u662F\u9577\u69CD\u5175\u3002", "\u7DB2\u7AD9\u9019\u9801\u7684\u512A\u7F3A\u9EDE\u662F\u5F9E\u5C0F\u5F13\u958B\u5C40\u8907\u88FD\u4F86\u7684\uFF1B\u9019\u88E1\u7167\u5167\u6587\u3002"]
  }
];
var unavailableOpenings = [
  { id: "eglerush", zh: "\u8001\u9DF9\u958B\u5C40", en: "Eagle scout opening", page: site2("eglerush"), reason: "\u8981\u7528\u9DF9\u65A5\u5019\uFF0C\u90A3\u662F\u4E2D\u7F8E\u6D32\u4E09\u570B\u7684\u55AE\u4F4D\uFF1B\u672C\u4F5C\u7684 13 \u500B\u539F\u7248\u6587\u660E\u90FD\u6C92\u6709" }
];
var openingById = (id) => openings.find((o) => o.id === id);
var openingChoices = [standardOpening, randomOpening, ...openings.map((o) => o.id)];
function pickOpening(seed, civ) {
  const best = openings.filter((o) => o.best.includes(civ)), pool = best.length ? best : openings;
  return pool[(Math.imul(seed >>> 0, 2654435761) >>> 0) % pool.length].id;
}

// packages/sim/garrison.ts
var carrierRules = {
  provenance: "aoetw.com (capacities, who boards, the per-infantry boosts); design_default for the conversions",
  ram: { capacity: { ram: 4, "capped-ram": 5, "siege-ram": 6 }, speedPerInfantry: 0.1, buildingPerInfantry: 3, buildingCap: { ram: 13, "capped-ram": 16, "siege-ram": 19 } }
};
var classesOf = (kind) => kind in combatRules.units ? combatRules.units[kind].classes : [];
var ridesRam = (kind) => {
  const c = classesOf(kind);
  return c.includes("infantry") || c.includes("archer") && !c.includes("cavalry") && !c.includes("cavalry-archer");
};
var ramStep = (techs = []) => techs.includes("siege-ram") ? "siege-ram" : techs.includes("capped-ram") ? "capped-ram" : "ram";
var ramCapacity = (s, player) => carrierRules.ram.capacity[ramStep(s.techs?.[player])];
var infantryIn = (s, id) => (s.transports?.[id] ?? []).filter((u) => classesOf(u.kind).includes("infantry")).length;
var carriedSpeedScale = (s, u) => u.kind === "ram" ? 1 + carrierRules.ram.speedPerInfantry * infantryIn(s, u.id) : 1;
function withCarried(state, u, st) {
  const s = state;
  if (u.kind !== "ram") return st;
  const n = infantryIn(s, u.id);
  if (!n) return st;
  const extra = Math.min(carrierRules.ram.buildingCap[ramStep(s.techs?.[u.player])], carrierRules.ram.buildingPerInfantry * n);
  return { ...st, bonus: { ...st.bonus, building: (st.bonus.building ?? 0) + extra } };
}

// packages/sim/fauna.ts
var animalKinds = ["sheep", "deer", "boar"];
var GAIA = 2;
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
var carcassId = (animalId) => `resource-carcass-${animalId}`;
function makeCarcass(map, animal) {
  const id = carcassId(animal.id), capacity = animalRules.food[animal.kind];
  if (map.resources.some((r) => r.id === id)) return;
  map.resources.push({ id, kind: animalRules.carcass[animal.kind], x: animal.x, y: animal.y, capacity, remaining: capacity, collectible: true, status: "available", obstacleId: null, depletedAt: null });
  map.tiles[Math.floor(animal.y / 100) * map.size + Math.floor(animal.x / 100)].resourceRefs.push(id);
}

// packages/sim/movement.ts
var navigationStates = ["idle", "searching", "moving", "waiting", "unreachable", "stuck"];
var unitKinds = ["villager", "militia", "archer", "scout", "monk", "sheep", "deer", "boar", "spearman", "skirmisher", "knight", "ram", "longbowman", "woad-raider", "throwing-axeman", "huskarl", "teutonic-knight", "berserk", "cataphract", "war-elephant", "mameluke", "janissary", "chu-ko-nu", "samurai", "mangudai", "cavalry-archer", "camel", "mangonel", "scorpion", "trebuchet", "petard", "hand-cannoneer", "bombard-cannon", "fishing-ship", "transport-ship", "trade-cog", "trade-cart", "galley", "fire-galley", "demolition-raft", "cannon-galleon", "longboat"];
var layerOf = (kind) => kind in combatRules.units && combatRules.units[kind].classes.some((c) => c === "ship" || c === "fishing-ship") ? "water" : "land";
var graphs = /* @__PURE__ */ new WeakMap();
function graph(map, layer = "land") {
  const all2 = graphs.get(map) ?? graphs.set(map, {}).get(map);
  let g = all2[layer];
  if (!g || g.revision !== map.navigationRevision) {
    const SIDE = sideOf(map), NODES = nodeTotal(map), blocked = blockedFor(map, layer).slice(), log = dirtyLog(map);
    const areas = g && g.open.length === NODES * 2 ? log.slice(g.cursor) : null, open = areas ? g.open : new Uint8Array(NODES * 2);
    const edges = (id) => {
      open[id * 2] = 0;
      open[id * 2 + 1] = 0;
      if (blocked[id]) return;
      const x = id % SIDE, y = Math.floor(id / SIDE);
      if (x < SIDE - 1 && !blocked[id + 1] && clearSegment(map, position(map, id), position(map, id + 1), layer)) open[id * 2] = 1;
      if (y < SIDE - 1 && !blocked[id + SIDE] && clearSegment(map, position(map, id), position(map, id + SIDE), layer)) open[id * 2 + 1] = 1;
    };
    if (areas) {
      const seen2 = /* @__PURE__ */ new Set();
      for (const area of areas) for (const id of nodesNear(map, area, 50)) if (!seen2.has(id)) {
        seen2.add(id);
        edges(id);
      }
    } else for (let id = 0; id < NODES; id++) edges(id);
    g = { revision: map.navigationRevision, cursor: log.length, blocked, open };
    all2[layer] = g;
    if (log.length > 4096 && Object.values(all2).every((v) => v.cursor === log.length)) {
      log.length = 0;
      for (const v of Object.values(all2)) v.cursor = 0;
    }
  }
  return g;
}
var gateKinds = /* @__PURE__ */ new Set(["gate", "palisade-gate"]);
var gateGraphs = /* @__PURE__ */ new WeakMap();
function landFor(map, player) {
  const base = graph(map, "land");
  if (player < 0) return base;
  const gates = map.obstacles.filter((o) => gateKinds.has(o.kind) && o.progress === void 0 && (o.red ? 1 : 0) !== player);
  if (!gates.length) return base;
  const all2 = gateGraphs.get(map) ?? gateGraphs.set(map, {}).get(map);
  let g = all2[player];
  if (!g || g.revision !== map.navigationRevision) {
    const SIDE = sideOf(map), open = base.open.slice(), blocked = base.blocked.slice();
    for (const o of gates) for (const id of nodesNear(map, obstacleBounds(o, navigationRules.radius), 0)) {
      blocked[id] = 1;
      open[id * 2] = 0;
      open[id * 2 + 1] = 0;
      if (id % SIDE > 0) open[(id - 1) * 2] = 0;
      if (id >= SIDE) open[(id - SIDE) * 2 + 1] = 0;
    }
    g = { revision: map.navigationRevision, open, blocked };
    all2[player] = g;
  }
  return g;
}
var graphFor = (map, layer = "land", player = -1) => layer === "water" ? graph(map, "water") : landFor(map, player);
function neighbours(map, id, layer = "land", player = -1) {
  const { open } = graphFor(map, layer, player), SIDE = sideOf(map), x = id % SIDE, out = [];
  if (open[id * 2]) out.push(id + 1);
  if (open[id * 2 + 1]) out.push(id + SIDE);
  if (x > 0 && open[(id - 1) * 2]) out.push(id - 1);
  if (id >= SIDE && open[(id - SIDE) * 2 + 1]) out.push(id - SIDE);
  return out;
}
var closedFor = (map, id, layer = "land", player = -1) => graphFor(map, layer, player).blocked[id] === 1;
var blockedOf = (map, layer = "land", player = -1) => graphFor(map, layer, player).blocked;
var unitLayer = (u) => ({ layer: layerOf(u.kind), player: u.player });
function makeUnit(map, id, player, x, y, kind = "villager") {
  const node = nodeAt(map, { x, y });
  if (node < 0) throw Error("\u55AE\u4F4D\u5FC5\u9808\u7AD9\u5728\u5C0E\u822A\u7BC0\u9EDE\u4E0A");
  return { id, player, kind, hp: combatRules.units[kind].hp, hitTick: -1, x, y, node, next: null, path: [], goal: null, target: null, navigation: "idle", wait: 0, detours: 0, partial: false, order: 0, outcome: null };
}
function search(map, start) {
  const parent = Array(nodeTotal(map)).fill(-2);
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
function commandMove(s, unitIds, target, spread = false) {
  const all2 = unitIds.map((id) => s.units.find((u) => u.id === id)), layers = [...new Set(all2.map((u) => layerOf(u.kind)))];
  for (const layer of layers) {
    const units = all2.filter((u) => layerOf(u.kind) === layer), ids = units.map((u) => u.id);
    const near = nearest(s.map, target, false, layer), goal = near >= 0 ? near : nearestOpen(s.map, target, layer);
    if (goal < 0) throw Error(layer === "water" ? "\u76EE\u6A19\u9644\u8FD1\u6C92\u6709\u53EF\u822A\u884C\u7684\u6C34\u9762" : "\u76EE\u6A19\u9644\u8FD1\u6C92\u6709\u53EF\u7AD9\u7ACB\u7684\u7BC0\u9EDE");
    const group = new Set(ids), player = units[0].player;
    for (const u of units) {
      cancel(s, u.id);
      delete u.spread;
      Object.assign(u, { path: [], goal: null, target: null, navigation: "searching", wait: 0, detours: 0, partial: false, order: s.nextJobId, outcome: null });
    }
    s.pathJobs.push({ kind: "group", id: s.nextJobId++, ...spread ? { spread: true } : {}, ...layer === "water" ? { layer } : {}, ...layer === "land" && gatesExist(s.map) ? { player } : {}, unitIds: [...ids], goal, starts: units.map((u) => u.next ?? u.node), held: held(s.units, group), slots: [], status: "searching", ...search(s.map, goal) });
  }
}
var gatesExist = (map) => map.obstacles.some((o) => gateKinds.has(o.kind));
function commandStop(s, unitIds) {
  for (const id of unitIds) {
    const u = s.units.find((u2) => u2.id === id);
    cancel(s, id);
    delete u.spread;
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
      const SIDE = sideOf(s.map), even = !job.spread || (id % SIDE - job.goal % SIDE) % 2 === 0 && (Math.floor(id / SIDE) - Math.floor(job.goal / SIDE)) % 2 === 0;
      if (even && job.slots.length < job.unitIds.length && !job.held.includes(id) && !closedFor(s.map, id, job.layer ?? "land", job.player ?? -1)) job.slots.push(id);
    } else {
      const SIDE = sideOf(s.map), g = job.goal, d = (n) => Math.abs(n % SIDE - g % SIDE) + Math.abs(Math.floor(n / SIDE) - Math.floor(g / SIDE));
      if (d(id) < d(job.best)) job.best = id;
      if (job.targets ? job.targets.includes(id) : id === g) {
        job.found = id;
        job.status = "done";
        break;
      }
    }
    for (const next of neighbours(s.map, id, job.layer ?? "land", job.player ?? -1)) if (job.parent[next] === -2 && !(job.kind === "unit" && job.excluded.includes(next))) {
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
  const cx = reached.reduce((t, u) => t + position(s.map, start(u)).x, 0) / Math.max(1, reached.length), cy = reached.reduce((t, u) => t + position(s.map, start(u)).y, 0) / Math.max(1, reached.length);
  const far = (n) => Math.abs(position(s.map, n).x - cx) + Math.abs(position(s.map, n).y - cy);
  const slots2 = job.slots.slice(0, reached.length).sort((a, b) => far(b) - far(a) || order.get(a) - order.get(b));
  reached.forEach((u, i) => {
    const slot = slots2[i];
    if (slot === void 0) {
      Object.assign(u, { navigation: u.next === null ? "unreachable" : "moving", partial: true });
      return;
    }
    if (job.spread) {
      u.spread = true;
      Object.assign(u, { goal: slot, target: position(s.map, slot), partial: false, navigation: "searching" });
      s.pathJobs.push(unitJob(s, u, slot, slots2.filter((n) => n !== slot).sort((a, b) => a - b), []));
      return;
    }
    const up2 = chain(job.parent, start(u)), down = chain(job.parent, slot), index = new Map(down.map((n, k) => [n, k]));
    let i2 = 0;
    while (!index.has(up2[i2])) i2++;
    u.path = [...up2.slice(1, i2 + 1), ...down.slice(0, index.get(up2[i2])).reverse()];
    Object.assign(u, { goal: slot, target: position(s.map, slot), partial: false, navigation: u.path.length || u.next !== null ? "moving" : "idle" });
  });
  for (const u of units) if (!order.has(start(u))) s.pathJobs.push(unitJob(s, u, job.goal, [], []));
}
function unitJob(s, u, goal, excluded, keep, targets = null) {
  const start = u.next ?? u.node, { layer, player } = unitLayer(u);
  return { ...layer === "water" ? { layer } : {}, ...layer === "land" && gatesExist(s.map) ? { player } : {}, kind: "unit", id: s.nextJobId++, unitId: u.id, start, goal, excluded, best: start, keep, targets, found: -1, status: "searching", ...search(s.map, start) };
}
function routeTo(s, u, targets) {
  if (!targets.length) throw Error("\u6C92\u6709\u53EF\u7528\u7684\u76EE\u6A19\u7BC0\u9EDE");
  cancel(s, u.id);
  delete u.spread;
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
  u.target = position(s.map, end);
  u.navigation = path.length || u.next !== null ? "moving" : u.partial ? "unreachable" : "idle";
}
function reconcile(s) {
  if (s.navigationSeen === s.map.navigationRevision) return;
  s.navigationSeen = s.map.navigationRevision;
  for (const job of s.pathJobs) if (job.status === "searching") {
    const fresh = search(s.map, job.kind === "group" ? job.goal : job.start);
    Object.assign(job, fresh);
    if (!job.layer && job.player === void 0 && gatesExist(s.map)) {
      const u = s.units.find((u2) => u2.id === (job.kind === "group" ? job.unitIds[0] : job.unitId));
      if (u) job.player = u.player;
    }
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
    const { layer, player } = unitLayer(u);
    if (route.every((n, i) => i === 0 || neighbours(s.map, route[i - 1], layer, gatesExist(s.map) ? player : -1).includes(n))) continue;
    const goal = u.goal ?? u.path.at(-1);
    u.path = [];
    u.navigation = "searching";
    s.pathJobs.push(unitJob(s, u, goal, [], []));
  }
}
function stepMovement(s) {
  reconcile(s);
  s.pathJobs.sort((a, b) => a.id - b.id);
  let budget = searchBudget(s.map), expanded = 0;
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
  const owner = new Int32Array(nodeTotal(s.map));
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
    const b = byId.get(o), idleFriend = (b.player === u.player || isAnimal(b.kind)) && b.next === null && !b.path.length && !searching.has(b.id);
    const settledMate = idleFriend && b.order === u.order && (b.navigation === "idle" || b.navigation === "stuck");
    const toGoal = u.goal === null ? Infinity : Math.abs(position(s.map, u.goal).x - position(s.map, u.node).x) + Math.abs(position(s.map, u.goal).y - position(s.map, u.node).y);
    if (settledMate && !u.spread && toGoal <= navigationRules.arrivalRadius) {
      Object.assign(u, { path: [], goal: null, target: null, navigation: "idle", wait: 0 });
      return;
    }
    if (idleFriend) {
      const lb = unitLayer(b), free = neighbours(s.map, b.node, lb.layer, gatesExist(s.map) ? lb.player : -1).filter((c) => owner[c] === 0), step = free.find((c) => !u.path.includes(c));
      if (step !== void 0) b.path = [step];
      else if (settledMate && u.goal !== null && u.goal !== n) {
        Object.assign(b, { path: u.path.slice(1), goal: u.goal, target: position(s.map, u.goal), outcome: null });
        Object.assign(u, { path: [n], goal: n, target: position(s.map, n) });
      } else if (free.length) b.path = [free[0]];
    }
    if (b.player === u.player && b.order === u.order && b.next === null && b.path[0] === u.node && !searching.has(b.id)) {
      const mine = u.path.slice(1), theirs = b.path.slice(1), goal = u.goal;
      Object.assign(u, { path: theirs, goal: b.goal, target: b.goal === null ? null : position(s.map, b.goal) });
      Object.assign(b, { path: mine, goal, target: goal === null ? null : position(s.map, goal) });
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
  const setups = s.setups;
  for (const u of [...s.units].sort((a, b) => a.id - b.id)) {
    const pack = setups?.[u.id];
    if (pack && (u.next !== null || u.path.length)) {
      if (pack.unpacked) {
        if (++pack.progress < (statsOf(u.kind, ownerOf(s, u.player)).setup ?? 0)) continue;
      }
      delete setups[u.id];
    }
    if (u.next === null) tryReserve(u);
    if (u.next === null) continue;
    const target = position(s.map, u.next), speed = Math.round(speedOf(u.kind, ownerOf(s, u.player)) * carriedSpeedScale(s, u) * 100) / 100;
    const acc = Math.round(((u.stride ?? 0) + speed) * 100), step = Math.min(Math.floor(acc / 100), Math.max(Math.abs(target.x - u.x), Math.abs(target.y - u.y))), rest2 = acc - step * 100;
    if (rest2) u.stride = rest2 / 100;
    else delete u.stride;
    const p = { x: u.x + Math.sign(target.x - u.x) * Math.min(step, Math.abs(target.x - u.x)), y: u.y + Math.sign(target.y - u.y) * Math.min(step, Math.abs(target.y - u.y)) };
    if (!clearSegment(s.map, u, p, layerOf(u.kind))) throw Error(`entity ${u.id}: \u975E\u6CD5\u78B0\u649E\u8DEF\u5F91`);
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
        delete u.spread;
      }
      if (u.next === null) delete u.stride;
    }
  }
  return { expanded };
}

// packages/sim/buildings.ts
var buildKinds = [
  "house",
  "barracks",
  "farm",
  "lumber-camp",
  "mining-camp",
  "mill",
  "stable",
  "archery-range",
  "monastery",
  "blacksmith",
  "watch-tower",
  "siege-workshop",
  "castle",
  "university",
  // The 建築 round (the town centre becomes buildable from the third age).
  "town-center",
  "market",
  "dock",
  "fish-trap",
  "outpost",
  "bombard-tower",
  "wonder",
  "palisade-wall",
  "palisade-gate",
  "stone-wall",
  "gate"
];
var buildingRules = {
  provenance: "design_default",
  capacity: { "town-center": 5, house: 5, barracks: 0, farm: 0, "lumber-camp": 0, "mining-camp": 0, mill: 0, stable: 0, "archery-range": 0, monastery: 0, blacksmith: 0, "watch-tower": 0, "siege-workshop": 0, castle: 10, university: 0, market: 0, dock: 0, "fish-trap": 0, outpost: 0, "bombard-tower": 0, wonder: 0, "palisade-wall": 0, "palisade-gate": 0, "stone-wall": 0, gate: 0 },
  grid: 10,
  required: Object.fromEntries(buildKinds.map((k) => [k, rules.entries.find((e) => e.id === k).time * rules.settings.tickHz]))
};
var overlap = (a, b) => Math.min(a[2], b[2]) - Math.max(a[0], b[0]) > 0 && Math.min(a[3], b[3]) - Math.max(a[1], b[1]) > 0;
var wallKinds = /* @__PURE__ */ new Set(["palisade-wall", "stone-wall"]);
var wallGate2 = { "palisade-gate": "palisade-wall", gate: "stone-wall" };
var replacesWall = (kind, o, owner) => wallGate2[kind] === o.kind && (o.red ? 1 : 0) === owner;
function placementProblem(input, kind, x, y, owner) {
  if (!buildKinds.includes(kind)) return "\u672A\u77E5\u7684\u5EFA\u7BC9\u7A2E\u985E";
  if (!Number.isSafeInteger(x) || !Number.isSafeInteger(y) || x % buildingRules.grid || y % buildingRules.grid) return `\u4F4D\u7F6E\u5FC5\u9808\u5C0D\u9F4A ${buildingRules.grid} \u55AE\u4F4D\u683C\u7DDA`;
  const box = obstacleBounds({ kind, x, y }), size = sizeOfTiles(input.tiles), world = size * 100;
  if (box[0] < 0 || box[1] < 0 || box[2] > world || box[3] > world) return "\u8D85\u51FA\u5730\u5716\u7BC4\u570D";
  const tiles = [];
  for (let ty = Math.floor(box[1] / 100); ty <= Math.floor((box[3] - 1) / 100); ty++) for (let tx = Math.floor(box[0] / 100); tx <= Math.floor((box[2] - 1) / 100); tx++) tiles.push(ty * size + tx);
  if (tiles.some((t) => !input.explored(t))) return "\u5C1A\u672A\u63A2\u7D22\u7684\u5340\u57DF\u4E0D\u80FD\u5EFA\u9020";
  const wet = (t) => input.tiles[t]?.terrainType === "water" || input.tiles[t]?.terrainType === "shallow";
  if (kind === "dock" && (x % 100 || y % 100)) return "\u78BC\u982D\u5FC5\u9808\u5C0D\u9F4A\u5730\u5716\u683C\u5B50";
  if (kind === "dock" || kind === "fish-trap") {
    if (tiles.some((t) => !wet(t))) return kind === "dock" ? "\u78BC\u982D\u5FC5\u9808\u84CB\u5728\u5CB8\u908A\u7684\u6C34\u9762\u4E0A" : "\u9B5A\u7DB2\u5FC5\u9808\u653E\u5728\u6C34\u9762\u4E0A";
    if (kind === "dock" && !tiles.some((t) => {
      const tx = t % size, ty = Math.floor(t / size);
      return [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
        const nx = tx + dx, ny = ty + dy, n = ny * size + nx;
        return nx >= 0 && ny >= 0 && nx < size && ny < size && !tiles.includes(n) && !!input.tiles[n]?.buildability;
      });
    })) return "\u78BC\u982D\u5FC5\u9808\u7DCA\u9130\u53EF\u5EFA\u9020\u7684\u9678\u5730";
  } else if (tiles.some((t) => !input.tiles[t]?.buildability)) return "\u5730\u5F62\u4E0D\u53EF\u5EFA\u9020\uFF08\u6C34\u57DF\u3001\u61F8\u5D16\u3001\u5761\u9053\u6216\u6DFA\u7058\uFF09";
  if (new Set(tiles.map((t) => input.tiles[t].height)).size > 1) return "\u5730\u9762\u9AD8\u5EA6\u4E0D\u4E00\u81F4";
  if (input.obstacles.some((o) => !(owner !== void 0 && replacesWall(kind, o, owner)) && (obstacleRects(o).length ? obstacleRects(o) : isBuilding(o) ? [obstacleBounds(o)] : []).some((r2) => overlap(r2, box)))) return "\u8207\u5EFA\u7BC9\u6216\u8CC7\u6E90\u91CD\u758A";
  const r = navigationRules.radius;
  if (kind !== "farm" && kind !== "fish-trap" && input.units.some((u) => u.x >= box[0] - r && u.x <= box[2] + r && u.y >= box[1] - r && u.y <= box[3] + r)) return "\u6709\u55AE\u4F4D\u7AD9\u5728\u9810\u5B9A\u5730\u4E0A";
  return null;
}
function authoritativeProblem(s, player, kind, x, y) {
  const explored = new Set(s.vision[player].explored);
  const bodies = s.units.flatMap((u) => [{ x: u.x, y: u.y }, ...u.next === null ? [] : [position(s.map, u.next)]]);
  const problem = placementProblem({ tiles: s.map.tiles, obstacles: s.map.obstacles, units: bodies, explored: (t) => explored.has(t) }, kind, x, y, player);
  if (problem) return problem;
  const relics = s.relics ?? [], [x0, y0, x1, y1] = obstacleBounds({ kind, x, y });
  if (relics.some((r) => r.carrier === null && r.monastery === null && r.x >= x0 - 25 && r.x <= x1 + 25 && r.y >= y0 - 25 && r.y <= y1 + 25)) return "\u8056\u7269\u6240\u5728\u7684\u4F4D\u7F6E\u4E0D\u80FD\u5EFA\u9020";
  return s.map.resources.some((r) => !r.obstacleId && r.status === "available" && r.x > x0 && r.x < x1 && r.y > y0 && r.y < y1) ? "\u8207\u8CC7\u6E90\u91CD\u758A" : null;
}
var farmResourceId = (buildingId) => `resource-${buildingId}`;
function openFarm(s, b) {
  const trap = b.kind === "fish-trap", capacity = trap ? terrainRules.resourceCapacity["fish-trap"] : farmFoodOf(s.techs?.[b.player] ?? [], terrainRules.resourceCapacity.farm) + farmFoodBonus(ownerOf(s, b.player));
  s.map.resources.push({ id: farmResourceId(b.id), kind: trap ? "fish-trap" : "farm", x: b.x, y: b.y, capacity, remaining: capacity, collectible: true, status: "available", obstacleId: b.id, depletedAt: null });
  s.map.tiles[tileAt(b.x, b.y, s.map.size)].resourceRefs.push(farmResourceId(b.id));
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
function buildRequirement(age, kind, own, civ = neutralCiv, techs = [], allTechs = false) {
  const entry2 = rules.entries.find((e) => e.id === kind);
  if (!entry2) return "\u672A\u77E5\u7684\u5EFA\u7BC9\u7A2E\u985E";
  if (!civAvailable(civ, kind, allTechs)) return "\u6B64\u6587\u660E\u4E0D\u80FD\u5EFA\u9020";
  for (const req of entry2.requires) {
    const need = rules.entries.find((e) => e.id === req), m = /^age-(\d)$/.exec(req);
    if (m && age < Number(m[1])) return `\u9700\u8981${need?.name ?? req}`;
    if (!m && need?.kind === "technology" && !techs.includes(req)) return `\u9700\u8981\u5148\u7814\u7A76\u300C${need.name}\u300D`;
    if (need?.kind === "building" && !own.some((b) => b.kind === req && b.complete)) return `\u9700\u8981\u5B8C\u5DE5\u7684${need.name}`;
  }
  return null;
}
function stageOf(b) {
  return b.complete ? 100 : Math.min(80, Math.floor(b.work * 5 / b.required) * 20);
}
function obstacleOf(s, b) {
  return s.map.obstacles.find((o) => o.id === b.id);
}
var housingOf = (s, player, kind) => buildingRules.capacity[kind] + housingBonus(ownerOf(s, player), kind);
function recomputeCapacity(s, player) {
  const owner = ownerOf(s, player), housed = s.buildings.filter((b) => b.player === player && b.complete).reduce((t, b) => t + housingOf(s, player, b.kind), 0) + (s.keptHousing?.[player] ?? 0);
  s.accounts[player].populationCap = Math.min((s.settings?.popCap ?? rules.settings.populationCap) + popCapBonus(owner), housed);
}
function initBuildings(s) {
  for (const o of s.map.obstacles) if (o.kind === "town-center") {
    {
      const p = o.red ? 1 : 0, hp = buildingHpOf("town-center", ownerOf(s, p));
      s.buildings.push({ id: o.id, kind: "town-center", player: p, x: o.x, y: o.y, work: 0, required: 0, complete: true, reservationId: null, queue: [], rally: null, hp, maxHp: hp });
    }
    o.age = s.ages[o.red ? 1 : 0];
  }
  for (const p of [0, 1]) recomputeCapacity(s, p);
}
function placeBuilding(s, player, kind, x, y, reservationId) {
  const owner = ownerOf(s, player), problem = authoritativeProblem(s, player, kind, x, y) ?? buildRequirement(s.ages[player], kind, s.buildings.filter((b2) => b2.player === player), owner.civ, owner.techs, !!owner.allTechs);
  if (problem) throw Error(problem);
  reserve(s.accounts[player], reservationId, kind, costOf(kind, owner));
  if (kind in wallGate2) {
    const box = obstacleBounds({ kind, x, y });
    for (const w2 of s.buildings.filter((w3) => w3.player === player && w3.kind === wallGate2[kind])) {
      const o2 = obstacleOf(s, w2);
      if (o2 && overlap(obstacleBounds(o2), box)) removeBuilding(s, w2);
    }
  }
  const b = { id: `building-${s.nextBuildingId++}`, kind, player, x, y, work: 0, required: buildingRules.required[kind], complete: false, reservationId, queue: [], rally: null, hp: 1, maxHp: buildingHpOf(kind, owner) };
  s.buildings.push(b);
  const o = { id: b.id, kind, x, y, progress: 0, age: s.ages[player], ...player ? { red: true } : {} };
  s.map.obstacles.push(o);
  s.map.tiles[tileAt(x, y, s.map.size)].obstacleRefs.push(b.id);
  refreshNavigation(s.map, obstacleBounds(o, navigationRules.radius));
  return b;
}
function addWork(s, b) {
  if (b.complete) return false;
  const rate = buildRateBonus(ownerOf(s, b.player), b.kind);
  if (rate) {
    b.boost = (b.boost ?? 0) + rate;
    if (b.boost >= 100 && b.work + 1 < b.required) {
      b.boost -= 100;
      if (addWork1(s, b)) return true;
    }
  }
  return addWork1(s, b);
}
function addWork1(s, b) {
  b.work++;
  const o = obstacleOf(s, b);
  const gained = Math.floor(b.work * b.maxHp / b.required) - Math.floor((b.work - 1) * b.maxHp / b.required);
  b.hp = Math.min(b.maxHp, b.hp + gained);
  if (b.work >= b.required) {
    b.complete = true;
    commitReservation(s.accounts[b.player], b.reservationId);
    delete o.progress;
    recomputeCapacity(s, b.player);
    if (b.kind === "farm" || b.kind === "fish-trap") openFarm(s, b);
    return true;
  }
  o.progress = stageOf(b);
  return false;
}
function removeBuilding(s, b) {
  const a = s.accounts[b.player];
  if (!b.complete && b.reservationId) forfeitReservation(a, b.reservationId);
  for (const q of b.queue) forfeitReservation(a, q.reservationId);
  const o = obstacleOf(s, b);
  if (o) {
    s.map.obstacles = s.map.obstacles.filter((v) => v !== o);
    for (const t of s.map.tiles) t.obstacleRefs = t.obstacleRefs.filter((r) => r !== b.id);
  }
  s.buildings = s.buildings.filter((v) => v !== b);
  if (o) refreshNavigation(s.map, obstacleBounds(o, navigationRules.radius));
  recomputeCapacity(s, b.player);
}
var wallRules = { provenance: "design_default", maxSegments: 24, builderReach: 300 };
function wallLine(from, to) {
  let x = Math.floor(from.x / 100), y = Math.floor(from.y / 100);
  const x1 = Math.floor(to.x / 100), y1 = Math.floor(to.y / 100), dx = Math.abs(x1 - x), dy = -Math.abs(y1 - y), sx = x < x1 ? 1 : -1, sy = y < y1 ? 1 : -1;
  let err = dx + dy;
  const out = [];
  for (; ; ) {
    out.push({ x: x * 100, y: y * 100 });
    if (out.length >= wallRules.maxSegments || x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
  return out;
}
function wallProblem(s, player, kind, from, to) {
  let first = null;
  for (const p of wallLine(from, to)) {
    const why = authoritativeProblem(s, player, kind, p.x, p.y);
    if (!why) return null;
    first ??= why;
  }
  return first;
}
function placeWall(s, player, kind, from, to, reservationId) {
  const out = [];
  let first = null;
  wallLine(from, to).forEach((p, i) => {
    try {
      out.push(placeBuilding(s, player, kind, p.x, p.y, i ? `${reservationId}:${i}` : reservationId));
    } catch (e) {
      first ??= e;
    }
  });
  if (!out.length) throw first ?? Error("\u7121\u6CD5\u5EFA\u9020\u57CE\u7246");
  return out;
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

// packages/sim/naval.ts
var navalRules = { provenance: "design_default", transportCapacity: 5, boardReach: 150, landReach: 150, repathTicks: 20 };
var naval = (s) => {
  const n = s;
  n.transports ??= {};
  n.boarding ??= {};
  n.unloading ??= {};
  return n;
};
var capacityOf = (s, t) => t.kind === "ram" ? ramCapacity(s, t.player) : transportCapacityOf(ownerOf(s, t.player), navalRules.transportCapacity);
var room = (s, t) => capacityOf(s, t) - (s.transports[t.id]?.length ?? 0) - Object.values(s.boarding).filter((b) => b.transportId === t.id).length;
function loadProblem(s, player, transportId, unitIds) {
  const n = naval(s), t = s.units.find((u) => u.id === transportId);
  if (t?.kind === "ram") {
    if (t.player !== player) return "\u53EA\u80FD\u9032\u99D0\u5DF1\u65B9\u7684\u885D\u649E\u8ECA";
  } else if (!t || t.player !== player || t.kind !== "transport-ship") return "\u53EA\u80FD\u767B\u4E0A\u5DF1\u65B9\u7684\u904B\u8F38\u8239";
  const units = unitIds.map((id) => s.units.find((u) => u.id === id));
  if (t.kind === "ram" && units.some((u) => !u || !ridesRam(u.kind))) return "\u53EA\u6709\u6B65\u5175\u8207\u5F92\u6B65\u5F13\u5175\u80FD\u9032\u99D0\u885D\u649E\u8ECA";
  if (units.some((u) => !u || layerOf(u.kind) !== "land" || isAnimal(u.kind))) return "\u53EA\u6709\u9678\u4E0A\u55AE\u4F4D\u80FD\u767B\u8239";
  const relics = s.relics ?? [];
  if (units.some((u) => u && relics.some((r) => r.carrier === u.id))) return "\u651C\u5E36\u8056\u7269\u7684\u50E7\u4FB6\u4E0D\u80FD\u767B\u8239";
  const free = room(n, t) + unitIds.filter((id) => n.boarding[id]?.transportId === t.id).length;
  if (free < unitIds.length) return `\u7A7A\u4F4D\u4E0D\u8DB3\uFF1A\u9084\u80FD\u767B\u8239 ${Math.max(0, free)} \u540D`;
  return null;
}
function commandLoad(s, unitIds, transportId) {
  const n = naval(s), t = s.units.find((u) => u.id === transportId);
  for (const id of unitIds) {
    cancelMovement(s, id);
    delete s.works[id];
    delete s.attacks[id];
    n.boarding[id] = { transportId, repath: 0 };
  }
  const first = s.units.find((u) => u.id === unitIds[0]);
  if (t.kind !== "ram" && first && reach(first, t) > navalRules.boardReach) {
    delete n.unloading[t.id];
    commandMove(s, [t.id], { x: first.x, y: first.y });
  }
}
function unloadProblem(s, player, transportId, x, y) {
  const n = naval(s), t = s.units.find((u) => u.id === transportId);
  if (!t || t.player !== player || t.kind !== "transport-ship") return "\u627E\u4E0D\u5230\u9019\u8258\u5DF1\u65B9\u904B\u8F38\u8239";
  if (!n.transports[t.id]?.length) return "\u904B\u8F38\u8239\u4E0A\u6C92\u6709\u55AE\u4F4D";
  if (!Number.isSafeInteger(x) || !Number.isSafeInteger(y) || x < 50 || y < 50 || x > s.map.size * 100 - 50 || y > s.map.size * 100 - 50) return "\u76EE\u6A19\u8D85\u51FA\u5730\u5716";
  return null;
}
function commandUnload(s, transportId, x, y) {
  const n = naval(s);
  n.unloading[transportId] = { x, y };
  commandMove(s, [transportId], { x, y });
}
function clearNaval(s, unitIds) {
  const n = naval(s);
  for (const id of unitIds) {
    delete n.boarding[id];
    delete n.unloading[id];
  }
}
function landing(s, t, aim) {
  const closed = blockedOf(s.map, "land", t.player), held2 = new Set(s.units.flatMap((u) => u.next === null ? [u.node] : [u.node, u.next]));
  return nodesNear(s.map, [t.x, t.y, t.x, t.y], navalRules.landReach).filter((id) => !closed[id] && !held2.has(id) && reach(position(s.map, id), t) <= navalRules.landReach).sort((a, b) => {
    const p = position(s.map, a), q = position(s.map, b);
    return Math.abs(p.x - aim.x) + Math.abs(p.y - aim.y) - (Math.abs(q.x - aim.x) + Math.abs(q.y - aim.y)) || a - b;
  });
}
function stepNaval(s) {
  const n = naval(s), busy = new Set(s.pathJobs.flatMap((j) => j.kind === "group" ? j.unitIds : [j.unitId]));
  for (const id of Object.keys(n.boarding).map(Number).sort((a, b) => a - b)) {
    const b = n.boarding[id], u = s.units.find((u2) => u2.id === id), t = s.units.find((v) => v.id === b.transportId);
    if (!u || !t || t.player !== u.player || (n.transports[t.id]?.length ?? 0) >= capacityOf(s, t)) {
      delete n.boarding[id];
      if (u && !u.path.length && u.next === null) u.navigation = "idle";
      continue;
    }
    if (u.next !== null) continue;
    if (reach(u, t) <= navalRules.boardReach) {
      delete n.boarding[id];
      cancelMovement(s, u.id);
      Object.assign(u, { path: [], goal: null, target: null, next: null, navigation: "idle", wait: 0 });
      delete u.stride;
      s.units = s.units.filter((v) => v !== u);
      (n.transports[t.id] ??= []).push(u);
      continue;
    }
    if (b.repath > 0 && (u.path.length || busy.has(u.id))) {
      b.repath--;
      continue;
    }
    const closed = blockedOf(s.map, "land", u.player), nodes = nodesNear(s.map, [t.x, t.y, t.x, t.y], navalRules.boardReach).filter((id2) => !closed[id2] && reach(position(s.map, id2), t) <= navalRules.boardReach);
    if (!nodes.length) {
      b.repath = navalRules.repathTicks;
      continue;
    }
    routeTo(s, u, nodes);
    b.repath = navalRules.repathTicks;
  }
  for (const id of Object.keys(n.unloading).map(Number).sort((a, b) => a - b)) {
    const t = s.units.find((u) => u.id === id), aim = n.unloading[id];
    if (!t || !n.transports[id]?.length) {
      delete n.unloading[id];
      continue;
    }
    if (t.next !== null || t.path.length || busy.has(t.id)) continue;
    delete n.unloading[id];
    const spots = landing(n, t, aim), out = [];
    for (const u of n.transports[id]) {
      const node = spots.shift();
      if (node === void 0) break;
      const p = position(s.map, node);
      Object.assign(u, { x: p.x, y: p.y, node, next: null, path: [], goal: null, target: null, navigation: "idle", wait: 0 });
      s.units.push(u);
      out.push(u);
    }
    n.transports[id] = n.transports[id].filter((u) => !out.includes(u));
    if (!n.transports[id].length) delete n.transports[id];
    if (out.length) s.units.sort((a, b) => a.id - b.id);
  }
}
function releaseCarried(s, carrierId, at) {
  const n = naval(s), t = s.units.find((u) => u.id === carrierId), from = t ?? (at ? { ...at, id: carrierId } : void 0), list = n.transports[carrierId];
  if (!from || !list?.length) return 0;
  delete n.unloading[carrierId];
  const spots = landing(n, from, { x: from.x, y: from.y }), out = [];
  for (const u of list) {
    const node = spots.shift();
    if (node === void 0) break;
    const p = position(s.map, node);
    Object.assign(u, { x: p.x, y: p.y, node, next: null, path: [], goal: null, target: null, navigation: "idle", wait: 0 });
    s.units.push(u);
    out.push(u);
  }
  n.transports[carrierId] = list.filter((u) => !out.includes(u));
  if (!n.transports[carrierId].length) delete n.transports[carrierId];
  if (out.length) s.units.sort((a, b) => a.id - b.id);
  return n.transports[carrierId]?.length ?? 0;
}
var passengers = (s, transportId) => s.transports?.[transportId] ?? [];

// packages/sim/combat.ts
var stances = ["aggressive", "defensive", "stand", "passive"];
var tacticsRules = { provenance: "design_default (aoetw.com names the stances and patrol but gives no numbers)", defensiveLeash: 300, patrolTurn: 100, patrolRetry: 20 };
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
    return u ? { player: u.player, shape: { x: u.x, y: u.y }, tiles: [tileAt(u.x, u.y, s.map.size)] } : null;
  }
  const b = s.buildings.find((b2) => b2.id === t.id), box = b && buildingBox(s, b);
  if (!b || !box) return null;
  const tiles = [];
  for (let ty = Math.floor(box[1] / 100); ty <= Math.floor((box[3] - 1) / 100); ty++) for (let tx = Math.floor(box[0] / 100); tx <= Math.floor((box[2] - 1) / 100); tx++) tiles.push(ty * s.map.size + tx);
  return { player: b.player, shape: box, tiles };
}
function remembered(s, player, id) {
  return s.vision[player].known.find((k) => k.obstacle.id === id && !!k.obstacle.red === (player === 0))?.obstacle ?? null;
}
function targetProblem(s, player, t) {
  const r = resolve(s, t);
  if (r && r.player === player) return "\u4E0D\u80FD\u653B\u64CA\u5DF1\u65B9";
  if (t.kind === "building" && remembered(s, player, t.id)) return null;
  if (!r) return "\u627E\u4E0D\u5230\u76EE\u6A19";
  const seen2 = new Set(s.vision[player].visible);
  if (!r.tiles.some((id) => seen2.has(id))) return "\u627E\u4E0D\u5230\u76EE\u6A19";
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
var limit = (u, shape, owner = []) => statsOf(u.kind, owner).range + (Array.isArray(shape) ? navigationRules.radius : 0);
var nearest2 = (u, owner = []) => statsOf(u.kind, owner).minRange ?? 0;
function damageOn(s, attacker, t) {
  if (t.kind === "building") {
    const b = s.buildings.find((b2) => b2.id === t.id);
    return hitDamage(attacker, buildingTargetOf(b?.kind ?? "", b ? ownerOf(s, b.player) : []));
  }
  const v = s.units.find((u) => u.id === t.id);
  return v ? hitDamage(attacker, statsOf(v.kind, ownerOf(s, v.player))) : 0;
}
function approach(s, u, shape, range = limit(u, shape), min = 0) {
  const out = [];
  const closed = blockedOf(s.map, layerOf(u.kind), u.player), area = Array.isArray(shape) ? shape : [shape.x, shape.y, shape.x, shape.y];
  for (const n of nodesNear(s.map, area, range)) {
    if (closed[n]) continue;
    const p = position(s.map, n), d = reach(p, shape);
    if (d <= range && d >= min && (Array.isArray(shape) || d > 0)) out.push(n);
  }
  const held2 = new Set(s.units.filter((v) => v !== u && v.next === null && !v.path.length).map((v) => v.node)), free = out.filter((n) => !held2.has(n));
  return free.length ? free : out;
}
function killUnit(s, u) {
  if (isAnimal(u.kind)) {
    delete s.beasts[u.id];
    delete s.attacks[u.id];
    cancelMovement(s, u.id);
    s.units = s.units.filter((v) => v !== u);
    makeCarcass(s.map, u);
    return;
  }
  const a = s.accounts[u.player], c = s.cargo[u.id];
  if (c) {
    a.ledger.lost[c.resource] += c.amount;
    delete s.cargo[u.id];
  }
  const refund = u.kind in combatRules.units ? deathRefund(ownerOf(s, u.player), u.kind, combatRules.units[u.kind].classes) : 0;
  if (refund) {
    a.stock.gold += refund;
    a.ledger.refund.gold += refund;
  }
  const naval2 = s, aboard = naval2.transports?.[u.id];
  if (aboard && u.kind === "ram") releaseCarried(s, u.id);
  const left = naval2.transports?.[u.id];
  if (left) {
    delete naval2.transports[u.id];
    for (const v of left) {
      v.x = u.x;
      v.y = u.y;
      killUnit(s, v);
    }
  }
  if (naval2.unloading) delete naval2.unloading[u.id];
  if (naval2.boarding) delete naval2.boarding[u.id];
  delete s.works[u.id];
  delete s.attacks[u.id];
  if (s.setups) delete s.setups[u.id];
  if (s.stances) delete s.stances[u.id];
  if (s.patrols) delete s.patrols[u.id];
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
  if (b.complete && keepsHousing(ownerOf(s, b.player), b.kind)) {
    (s.keptHousing ??= [0, 0])[b.player] += housingOf(s, b.player, b.kind);
  }
  s.buildings = s.buildings.filter((v) => v !== b);
  if (b.kind === "farm" || b.kind === "fish-trap") closeFarm(s, b.id, s.tick);
  refreshNavigation(s.map, obstacleBounds(o, navigationRules.radius));
  recomputeCapacity(s, b.player);
}
var revealTicks = 40;
function reveal(s, victim, from) {
  if (victim !== 0 && victim !== 1) return;
  const tile = tileAt(from.x, from.y, s.map.size);
  if (s.vision[victim].visible.includes(tile)) return;
  const list = s.reveals ??= [], old = list.find((r) => r.player === victim && r.tile === tile);
  if (old) old.until = s.tick + revealTicks;
  else list.push({ player: victim, tile, until: s.tick + revealTicks });
}
function strike(s, t, amount, attacker, from) {
  if (from) {
    const p = t.kind === "unit" ? s.units.find((u) => u.id === t.id)?.player : s.buildings.find((b2) => b2.id === t.id)?.player;
    if (p !== void 0) reveal(s, p, from);
  }
  if (t.kind === "unit") {
    const u = s.units.find((u2) => u2.id === t.id);
    u.hp -= amount;
    u.hitTick = s.tick;
    if (isAnimal(u.kind) && !s.beasts[u.id]) s.beasts[u.id] = { foe: attacker, cooldown: 0, repath: 0 };
    if (u.hp <= 0) killUnit(s, u);
    return;
  }
  const b = s.buildings.find((b2) => b2.id === t.id);
  b.hp -= amount;
  const o = s.map.obstacles.find((o2) => o2.id === b.id);
  if (b.hp * 2 < b.maxHp) o.damaged = true;
  if (b.hp <= 0) destroyBuilding(s, b);
}
function land(s, shooter, stats, t, where, box, from, extras) {
  const tid = t ? t.id : void 0;
  const foes = () => [...s.units].sort((a, b) => a.id - b.id).filter((v) => v.id !== tid && v.player !== shooter.player && !isAnimal(v.kind));
  const line2 = stats.passThrough && where ? { x0: from.x, y0: from.y, x1: where.x, y1: where.y } : null;
  const near = stats.trample && where && t?.kind === "unit" ? foes().filter((v) => reach(where, v) <= 50) : [];
  if (t) strike(s, t, damageOn(s, stats, t), shooter.id, from);
  const blasted = () => stats.friendlyFire ? [...s.units].sort((a, b) => a.id - b.id).filter((v) => v.id !== shooter.id && v.id !== tid && !isAnimal(v.kind)) : foes();
  if (stats.blast && (where || box)) {
    for (const v of blasted()) if (s.units.includes(v) && reach(v, box ?? where) <= stats.blast) strike(s, { kind: "unit", id: v.id }, damageOn(s, stats, { kind: "unit", id: v.id }), shooter.id, from);
  }
  for (const v of near) if (s.units.includes(v)) strike(s, { kind: "unit", id: v.id }, Math.max(1, Math.round(damageOn(s, stats, { kind: "unit", id: v.id }) * stats.trample)), shooter.id, from);
  if (stats.buildingSplash && box) for (const b of [...s.buildings].sort((a, b2) => a.id < b2.id ? -1 : 1)) {
    if (b.id === tid || b.player === shooter.player || !s.buildings.includes(b)) continue;
    const o = buildingBox(s, b);
    if (o && Math.max(o[0] - box[2], box[0] - o[2], o[1] - box[3], box[1] - o[3], 0) <= stats.buildingSplash) strike(s, { kind: "building", id: b.id }, damageOn(s, stats, { kind: "building", id: b.id }), shooter.id, from);
  }
  if (line2) {
    const dx = line2.x1 - line2.x0, dy = line2.y1 - line2.y0, len = Math.hypot(dx, dy) || 1, end = len + stats.passThrough;
    for (const v of foes()) {
      if (!s.units.includes(v)) continue;
      const along = ((v.x - line2.x0) * dx + (v.y - line2.y0) * dy) / len, off = Math.abs((v.x - line2.x0) * dy - (v.y - line2.y0) * dx) / len;
      if (along > 0 && along <= end && off <= 25) strike(s, { kind: "unit", id: v.id }, damageOn(s, { ...stats, damage: Math.max(1, Math.round(stats.damage / 2)) }, { kind: "unit", id: v.id }), shooter.id, from);
    }
  }
  if (extras && t) for (let i = 0; i < (stats.extraShots ?? 0); i++) {
    if (t.kind === "unit" && !s.units.some((v) => v.id === t.id)) break;
    strike(s, t, damageOn(s, { ...stats, damage: stats.extraDamage ?? 1, bonus: {} }, t), shooter.id, from);
  }
  if (stats.splash && where && t) {
    for (const v of [...s.units].sort((a, b) => a.id - b.id)) if (v.id !== tid && v.player !== shooter.player && !isAnimal(v.kind) && reach(where, v) <= 50 && s.units.includes(v)) strike(s, { kind: "unit", id: v.id }, damageOn(s, { ...stats, damage: stats.splash, bonus: {} }, { kind: "unit", id: v.id }), shooter.id, from);
  }
}
function random(s) {
  let n = (s.rng ?? 1) || 1;
  n ^= n << 13;
  n ^= n >>> 17;
  n ^= n << 5;
  s.rng = n >>> 0;
  return s.rng;
}
var moving = (u) => u.next !== null || u.path.length > 0;
function aimAt(s, t, from, speed, lead) {
  if (t.kind === "building") {
    const b = s.buildings.find((b2) => b2.id === t.id), box = b && buildingBox(s, b);
    return box ? { x: Math.round((box[0] + box[2]) / 2), y: Math.round((box[1] + box[3]) / 2) } : null;
  }
  const v = s.units.find((u) => u.id === t.id);
  if (!v) return null;
  if (!lead || v.next === null) return { x: v.x, y: v.y };
  const n = position(s.map, v.next), dx = n.x - v.x, dy = n.y - v.y, len = Math.hypot(dx, dy) || 1, pace = v.kind in combatRules.units ? speedOf(v.kind, ownerOf(s, v.player)) : 0;
  const flight = Math.hypot(v.x - from.x, v.y - from.y) / speed, ahead = pace * flight;
  return { x: Math.round(v.x + dx / len * ahead), y: Math.round(v.y + dy / len * ahead) };
}
function launch(s, shooter, stats, t, rule, extra = false) {
  const from = { x: shooter.x, y: shooter.y }, aim = aimAt(s, t, from, rule.speed, rule.lead);
  if (!aim) return;
  const tv = t.kind === "unit" ? s.units.find((u) => u.id === t.id) : void 0, standing = !tv || !moving(tv);
  const chance = standing && rule.steady ? Math.max(rule.accuracy, rule.steady) : rule.accuracy, sure = chance >= 100 || random(s) % 100 < chance;
  let to = aim;
  if (!sure) {
    const [lo, hi] = projectileRules.missSpread, a = random(s) % 3600 * Math.PI / 1800, d = lo + random(s) % (hi - lo + 1);
    to = { x: Math.round(aim.x + Math.cos(a) * d), y: Math.round(aim.y + Math.sin(a) * d) };
  }
  (s.projectiles ??= []).push({ id: s.nextProjectileId = (s.nextProjectileId ?? 0) + 1, player: shooter.player, attacker: shooter.id, kind: shooter.kind, from, x: from.x, y: from.y, to, speed: rule.speed, target: t, sure, stats, ...extra ? { extra } : {}, tick: s.tick });
}
function stepProjectiles(s) {
  if (!s.projectiles?.length) return;
  const R = projectileRules.hitRadius, done = /* @__PURE__ */ new Set();
  for (const p of [...s.projectiles].sort((a, b) => a.id - b.id)) {
    const dx = p.to.x - p.x, dy = p.to.y - p.y, d = Math.hypot(dx, dy), arrived = d <= p.speed;
    if (arrived) {
      p.x = p.to.x;
      p.y = p.to.y;
    } else {
      p.x += dx / d * p.speed;
      p.y += dy / d * p.speed;
    }
    const shooter = { id: p.attacker, player: p.player };
    if (p.sure && p.target.kind === "unit") {
      const v = s.units.find((u) => u.id === p.target.id);
      if (v && Math.hypot(v.x - p.x, v.y - p.y) <= R) {
        done.add(p.id);
        land(s, shooter, p.stats, p.target, { x: v.x, y: v.y }, null, p.from, false);
        continue;
      }
    }
    if (!arrived) continue;
    done.add(p.id);
    const at = { x: p.to.x, y: p.to.y };
    if (p.target.kind === "building") {
      const b = s.buildings.find((b2) => b2.id === p.target.id), box = b && buildingBox(s, b);
      if (box && reach(at, box) <= R) {
        land(s, shooter, p.stats, p.target, null, box, p.from, false);
        continue;
      }
    }
    const hit2 = [...s.units].filter((v) => v.player !== p.player && !isAnimal(v.kind) && Math.hypot(v.x - at.x, v.y - at.y) <= R).sort((a, b) => Math.hypot(a.x - at.x, a.y - at.y) - Math.hypot(b.x - at.x, b.y - at.y) || a.id - b.id)[0];
    if (p.extra) {
      if (hit2) strike(s, { kind: "unit", id: hit2.id }, damageOn(s, p.stats, { kind: "unit", id: hit2.id }), p.attacker, p.from);
      continue;
    }
    land(s, shooter, p.stats, hit2 ? { kind: "unit", id: hit2.id } : null, hit2 ? { x: hit2.x, y: hit2.y } : at, null, p.from, false);
  }
  s.projectiles = s.projectiles.filter((p) => !done.has(p.id));
}
function volley(s, u, stats, t) {
  const from = { x: u.x, y: u.y }, rule = stats.range > projectileRules.meleeReach ? shotOf(u.kind, ownerOf(s, u.player)) : null;
  if (rule) {
    const shooter = { id: u.id, player: u.player, kind: u.kind, x: u.x, y: u.y };
    launch(s, shooter, stats, t, rule);
    for (let i = 0; i < (stats.extraShots ?? 0); i++) launch(s, shooter, { ...stats, damage: stats.extraDamage ?? 1, bonus: {} }, t, rule, true);
    return;
  }
  const at = t.kind === "unit" ? s.units.find((v) => v.id === t.id) : void 0, where = at ? { x: at.x, y: at.y } : null;
  const box = t.kind === "building" ? (() => {
    const b = s.buildings.find((b2) => b2.id === t.id);
    return b ? buildingBox(s, b) : null;
  })() : null;
  land(s, { id: u.id, player: u.player }, stats, t, where, box, from, true);
}
function stepPatrols(s, busy) {
  for (const id of Object.keys(s.patrols ?? {}).map(Number).sort((a, b) => a - b)) {
    const p = s.patrols[id], u = s.units.find((u2) => u2.id === id);
    if (!u) {
      delete s.patrols[id];
      continue;
    }
    if (p.wait > 0) {
      p.wait--;
      continue;
    }
    if (s.attacks[id] || u.next !== null || u.path.length || busy.has(id)) continue;
    let goal = p.leg === "out" ? p.to : p.from;
    if (reach(u, goal) <= tacticsRules.patrolTurn) {
      p.leg = p.leg === "out" ? "back" : "out";
      goal = p.leg === "out" ? p.to : p.from;
    }
    try {
      commandMove(s, [id], goal);
    } catch {
      delete s.patrols[id];
      continue;
    }
    p.wait = tacticsRules.patrolRetry;
  }
}
function regenerate(s) {
  for (const u of s.units) {
    if (!(u.kind in combatRules.units)) continue;
    const st = statsOf(u.kind, ownerOf(s, u.player));
    if (!st.regen) continue;
    const every = Math.max(1, Math.round(60 * 20 / st.regen));
    if (s.tick % every === 0 && u.hp < st.hp) u.hp = Math.min(st.hp, u.hp + 1);
  }
}
function stepCombat(s) {
  regenerate(s);
  stepProjectiles(s);
  s.corpses = s.corpses.filter((c) => s.tick - c.tick < combatRules.corpseTicks);
  const busy = new Set(s.pathJobs.flatMap((j) => j.kind === "group" ? j.unitIds : [j.unitId]));
  stepPatrols(s, busy);
  for (const u of [...s.units].sort((a, b) => a.id - b.id)) {
    const own = statsOf(u.kind, ownerOf(s, u.player)), stance = s.stances?.[u.id] ?? "aggressive", patrolling = !!s.patrols?.[u.id];
    if (stance === "passive" || own.buildingsOnly || s.attacks[u.id] || s.works[u.id] || !patrolling && (u.next !== null || u.path.length || busy.has(u.id))) continue;
    const sight = stance === "stand" ? Math.min(own.sight, own.range) : own.sight;
    if (!sight) continue;
    const seen2 = new Set(s.vision[u.player].visible);
    let best = null, dist2 = Infinity;
    const layer = layerOf(u.kind), across = own.range >= 150;
    for (const e of s.units) if (e.player !== u.player && !isAnimal(e.kind) && (across || layerOf(e.kind) === layer) && seen2.has(tileAt(e.x, e.y, s.map.size))) {
      const d = reach(u, e);
      if (d <= sight && d >= (own.minRange ?? 0) && (d < dist2 || d === dist2 && best && e.id < best.id)) {
        best = e;
        dist2 = d;
      }
    }
    if (best) s.attacks[u.id] = { target: { kind: "unit", id: best.id }, cooldown: 0, auto: true, repath: 0, firedTick: -1, ...stance === "defensive" ? { anchor: { x: u.x, y: u.y } } : {} };
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
    const r = resolve(s, a.target);
    if (!r) {
      const o = a.target.kind === "building" ? remembered(s, u.player, a.target.id) : null;
      delete s.attacks[id];
      if (o) {
        const [x0, y0, x1, y1] = obstacleBounds(o);
        commandMove(s, [u.id], { x: Math.round((x0 + x1) / 2), y: Math.round((y0 + y1) / 2) });
      }
      continue;
    }
    const owner = ownerOf(s, u.player), stats = withCarried(s, u, statsOf(u.kind, owner));
    if (a.cooldown > 0) a.cooldown--;
    const d = reach(u, r.shape), min = nearest2(u, owner), stance = s.stances?.[u.id] ?? "aggressive";
    if (d < min && a.auto) {
      delete s.attacks[id];
      continue;
    }
    if (a.auto && stance === "stand" && d > limit(u, r.shape, owner)) {
      delete s.attacks[id];
      continue;
    }
    if (a.auto && a.anchor && reach(u, a.anchor) > tacticsRules.defensiveLeash) {
      const home = a.anchor;
      delete s.attacks[id];
      commandMove(s, [u.id], home);
      continue;
    }
    if (d <= limit(u, r.shape, owner) && d >= min) {
      if (u.next !== null) {
        delete a.windup;
        continue;
      }
      if (u.path.length || busy.has(u.id)) {
        cancelMovement(s, u.id);
        u.path = [];
        u.goal = null;
        u.target = null;
      }
      u.navigation = "idle";
      if (stats.setup) {
        const st = (s.setups ??= {})[u.id] ??= { unpacked: false, progress: 0 };
        if (!st.unpacked) {
          if (++st.progress < stats.setup) continue;
          st.unpacked = true;
          st.progress = 0;
          a.cooldown = 0;
        } else st.progress = 0;
      }
      if (stats.frameDelay && a.windup !== 0) {
        a.windup = a.windup === void 0 ? stats.frameDelay : a.windup - 1;
        if (a.windup > 0) continue;
      }
      if (a.cooldown === 0) {
        a.cooldown = stats.cooldown;
        a.firedTick = s.tick;
        volley(s, u, stats, a.target);
        if (stats.selfDestruct && s.units.includes(u)) {
          delete s.attacks[id];
          killUnit(s, u);
        }
      }
      continue;
    }
    delete a.windup;
    if (u.next !== null) continue;
    if (a.repath > 0 && (u.path.length || busy.has(u.id))) {
      a.repath--;
      continue;
    }
    const nodes = approach(s, u, r.shape, limit(u, r.shape, owner), min);
    if (!nodes.length) {
      delete s.attacks[id];
      continue;
    }
    routeTo(s, u, nodes);
    a.repath = REPATH;
  }
  if (!s.outcome) {
    const inside = (p) => Object.values(s.garrison ?? {}).some((g) => g.units.some((e) => e.unit.player === p)) || Object.values(s.transports ?? {}).some((l) => l.some((v) => v.player === p));
    const alive = [0, 1].filter((p) => s.units.some((u) => u.player === p && !isAnimal(u.kind)) || s.buildings.some((b) => b.player === p) || inside(p));
    if (alive.length < 2) s.outcome = { winner: alive.length === 1 ? alive[0] : null, defeated: [0, 1].filter((p) => !alive.includes(p)), tick: s.tick };
  }
}

// packages/sim/repair.ts
var repairRules = {
  provenance: "aoetw.com for the cost share, the extra-villager share and what can be repaired; design_default for the rates in this scale",
  buildingRate: 26,
  unitRate: 16,
  costShare: 0.5,
  siegeReach: 75,
  shipReach: 100,
  retries: 3,
  unrepairable: ["farm", "fish-trap"]
};
var keyOf = (t) => t.kind === "building" ? `b:${t.id}` : `u:${t.id}`;
var classesOf2 = (kind) => kind in combatRules.units ? combatRules.units[kind].classes : [];
var repairableUnit = (kind) => classesOf2(kind).some((c) => c === "siege" || c === "ship");
function resolve2(s, t) {
  if (t.kind === "building") {
    const b = s.buildings.find((b2) => b2.id === t.id);
    return b ? { player: b.player, hp: b.hp, max: b.maxHp, entry: b.kind, building: b, unit: null } : null;
  }
  const u = s.units.find((u2) => u2.id === t.id);
  return u && u.kind in combatRules.units ? { player: u.player, hp: u.hp, max: maxHpOf(u.kind, ownerOf(s, u.player)), entry: u.kind, building: null, unit: u } : null;
}
function repairProblem(s, player, t) {
  const target = t;
  if (!target || target.kind !== "building" && target.kind !== "unit" || target.kind === "building" && typeof target.id !== "string" || target.kind === "unit" && !Number.isSafeInteger(target.id)) return "\u7121\u6548\u7684\u4FEE\u7406\u76EE\u6A19";
  const r = resolve2(s, target);
  if (!r || r.player !== player) return "\u53EA\u80FD\u4FEE\u7406\u5DF1\u65B9\u7684\u5EFA\u7BC9\u3001\u653B\u57CE\u5668\u8207\u8239\u96BB";
  if (r.building) {
    if (!r.building.complete) return "\u5EFA\u7BC9\u5C1A\u672A\u5B8C\u5DE5\uFF1A\u7528\u5EFA\u9020\u7E7C\u7E8C\u65BD\u5DE5";
    if (repairRules.unrepairable.includes(r.building.kind)) return "\u8FB2\u7530\u8207\u9B5A\u7DB2\u4E0D\u80FD\u4FEE\u7406";
  } else if (!repairableUnit(r.entry)) return "\u53EA\u80FD\u4FEE\u7406\u5EFA\u7BC9\u3001\u653B\u57CE\u5668\u8207\u8239\u96BB\uFF1A\u5176\u4ED6\u55AE\u4F4D\u7531\u50E7\u4FB6\u6CBB\u7642";
  if (r.hp >= r.max) return "\u6C92\u6709\u53D7\u640D\uFF0C\u4E0D\u9700\u8981\u4FEE\u7406";
  return null;
}
function repairBase(s, player, entry2) {
  const c = { ...costOf(entry2, ownerOf(s, player)) };
  if (entry2 === "town-center") {
    c.wood *= 2;
    c.stone = 0;
  }
  return c;
}
function slots(s, t) {
  if (t.kind === "building") {
    const b = s.buildings.find((b2) => b2.id === t.id);
    return b ? buildSlots(s.map, b, "land") : [];
  }
  const u = s.units.find((u2) => u2.id === t.id);
  if (!u) return [];
  const range = classesOf2(u.kind).includes("ship") ? repairRules.shipReach : repairRules.siegeReach, closed = blockedFor(s.map, "land");
  return nodesNear(s.map, [u.x, u.y, u.x, u.y], range).filter((n) => {
    if (closed[n]) return false;
    const d = reach(position(s.map, n), u);
    return d > 0 && d <= range;
  });
}
var stop = (s, u) => {
  delete s.works[u.id];
  if (u.navigation !== "moving") u.navigation = "idle";
};
function goTo(s, u, w2) {
  const t = slots(s, w2.target);
  if (!t.length) return stop(s, u);
  const held2 = new Set(s.units.filter((v) => v !== u && v.next === null && !v.path.length).map((v) => v.node)), free = t.filter((n) => !held2.has(n));
  w2.phase = "toRepair";
  routeTo(s, u, free.length ? free : t);
}
function commandRepair(s, unitIds, target) {
  for (const id of unitIds) {
    const u = s.units.find((u2) => u2.id === id);
    cancelMovement(s, id);
    const w2 = { kind: "repair", target: { ...target }, phase: "toRepair", retries: 0 };
    s.works[id] = w2;
    goTo(s, u, w2);
  }
}
function stepRepairer(state, u, w2, credited) {
  const s = state, r = resolve2(s, w2.target);
  if (!r || r.player !== u.player || r.hp >= r.max || r.building && !r.building.complete) {
    if (r && r.hp >= r.max) delete s.repairs?.[keyOf(w2.target)];
    return stop(s, u);
  }
  if (!slots(s, w2.target).includes(u.node)) {
    if (++w2.retries > repairRules.retries) return stop(s, u);
    return goTo(s, u, w2);
  }
  w2.phase = "repairing";
  w2.retries = 0;
  u.navigation = "idle";
  const key = keyOf(w2.target), led = (s.repairs ??= {})[key] ??= { pool: 0, owed: { food: 0, wood: 0, gold: 0, stone: 0 } }, rate = r.building ? repairRules.buildingRate : repairRules.unitRate;
  led.pool += credited.has(key) ? rate / 2 : rate;
  credited.add(key);
  const base = repairBase(s, r.player, r.entry), stock = s.accounts[r.player].stock, unit2 = Math.round(r.max / repairRules.costShare);
  while (led.pool >= 100 && (r.building ? r.building.hp : r.unit.hp) < r.max) {
    const due = Object.fromEntries(resources.map((k) => [k, Math.floor((led.owed[k] + base[k]) / unit2)]));
    if (resources.some((k) => stock[k] < due[k])) {
      led.pool = Math.min(led.pool, 99);
      return stop(s, u);
    }
    for (const k of resources) {
      led.owed[k] += base[k] - due[k] * unit2;
      stock[k] -= due[k];
      s.accounts[r.player].ledger.repair[k] += due[k];
    }
    led.pool -= 100;
    if (r.building) r.building.hp++;
    else r.unit.hp++;
  }
  if ((r.building ? r.building.hp : r.unit.hp) >= r.max) {
    delete s.repairs[key];
    stop(s, u);
  }
}

// packages/sim/work.ts
var workPhases = ["none", "toSource", "gathering", "toDropoff", "toSite", "building", "hunting", "toRepair", "repairing"];
var gap = (p, [x0, y0, x1, y1]) => Math.max(x0 - p.x, 0, p.x - x1) + Math.max(y0 - p.y, 0, p.y - y1);
function ring(map, o, reach2, layer = "land") {
  const box = obstacleBounds(o, 25), out = [], closed = blockedFor(map, layer);
  for (const n of nodesNear(map, box, reach2)) {
    if (closed[n]) continue;
    const d = gap(position(map, n), box);
    if (d > 0 && d <= reach2) out.push(n);
  }
  return out;
}
function workSlots(map, resourceId, layer = "land") {
  const r = map.resources.find((r2) => r2.id === resourceId), o = r?.obstacleId ? map.obstacles.find((o2) => o2.id === r.obstacleId) : void 0;
  if (r && !r.obstacleId && r.status === "available") {
    const reach2 = r.kind === "fish" ? animalRules.fishReach : animalRules.pointReach, closed = blockedFor(map, layer);
    return nodesNear(map, [r.x, r.y, r.x, r.y], reach2).filter((n) => {
      if (closed[n]) return false;
      const p = position(map, n), d = Math.max(Math.abs(p.x - r.x), Math.abs(p.y - r.y));
      return d > 0 && d <= reach2;
    });
  }
  if (o?.kind === "farm" || o?.kind === "fish-trap") {
    const b = obstacleBounds(o), out = [], closed = blockedFor(map, o.kind === "farm" ? "land" : "water");
    for (const n of nodesNear(map, b, 0)) {
      const p = position(map, n);
      if (!closed[n] && p.x > b[0] && p.x < b[2] && p.y > b[1] && p.y < b[3]) out.push(n);
    }
    return out;
  }
  return o ? ring(map, o, economyRules.workReach, layer) : [];
}
var dropoffRules = { provenance: "design_default", accepts: { "town-center": ["food", "wood", "gold", "stone"], "lumber-camp": ["wood"], "mining-camp": ["gold", "stone"], mill: ["food"] }, ships: { dock: ["food"] } };
function dropoffNodes(map, player, resource, layer = "land") {
  const accepts = layer === "water" ? dropoffRules.ships : dropoffRules.accepts;
  return [...new Set(map.obstacles.filter((o) => accepts[o.kind] && o.progress === void 0 && (o.red ? 1 : 0) === player && (!resource || accepts[o.kind].includes(resource))).flatMap((o) => ring(map, o, economyRules.dropoffReach, layer)))].sort((a, b) => a - b);
}
function gatherable(map, resourceId, layer = "land") {
  const r = map.resources.find((r2) => r2.id === resourceId);
  if (!r) return "\u627E\u4E0D\u5230\u9019\u500B\u8CC7\u6E90";
  if (!r.collectible) return "\u8CC7\u6E90\u5DF2\u8017\u76E1";
  if (layer === "water") {
    if (r.kind !== "fish" && r.kind !== "fish-trap") return "\u6F01\u8239\u53EA\u80FD\u6355\u9B5A\u6216\u6536\u9B5A\u7DB2";
    if (!workSlots(map, r.id, "water").length) return "\u6F01\u8239\u5230\u4E0D\u4E86\u9019\u7FA4\u9B5A";
    return null;
  }
  if (r.kind === "fish-trap") return "\u9B5A\u7DB2\u53EA\u80FD\u7531\u6F01\u8239\u6536\u6210";
  if (r.kind === "fish" && !workSlots(map, r.id).length) return "\u6751\u6C11\u53EA\u80FD\u5F9E\u5CB8\u908A\u6355\u9B5A\uFF1A\u9019\u7FA4\u9B5A\u96E2\u5CB8\u592A\u9060";
  return null;
}
function huntProblem(s, player, animalId) {
  const a = s.units.find((u) => u.id === animalId);
  if (!a || !isAnimal(a.kind) || !s.vision[player].visible.includes(Math.floor(a.y / 100) * s.map.size + Math.floor(a.x / 100))) return "\u627E\u4E0D\u5230\u9019\u96BB\u52D5\u7269";
  if (a.kind === "sheep" && a.player !== player) return a.player === 1 - player ? "\u9019\u96BB\u7F8A\u5C6C\u65BC\u5C0D\u624B\uFF1A\u8B93\u4F60\u7684\u55AE\u4F4D\u9760\u8FD1\u7260\u3001\u5C0D\u624B\u7684\u55AE\u4F4D\u96E2\u958B\uFF0C\u5C31\u80FD\u6436\u904E\u4F86" : "\u9019\u96BB\u7F8A\u9084\u6C92\u6709\u4E3B\u4EBA\uFF1A\u6D3E\u4EFB\u4F55\u55AE\u4F4D\u8D70\u5230\u7260\u65C1\u908A\u5C31\u80FD\u53D6\u5F97";
  return null;
}
function sourceTargets(s, u, resourceId) {
  const slots2 = workSlots(s.map, resourceId, layerOf(u.kind)), taken = /* @__PURE__ */ new Set();
  for (const v of s.units) if (v !== u) {
    {
      const w2 = s.works[v.id];
      if (v.goal !== null && w2?.kind === "gather" && w2.resourceId === resourceId) taken.add(v.goal);
    }
    if (v.next === null && !v.path.length) taken.add(v.node);
  }
  const free = slots2.filter((n) => !taken.has(n));
  return free.length ? free : slots2;
}
function goToSource(s, u, w2) {
  if (w2.prey !== void 0 && !s.map.resources.some((r) => r.id === w2.resourceId)) {
    w2.phase = "toSource";
    return;
  }
  const t = sourceTargets(s, u, w2.resourceId);
  if (!t.length) return stopWork(s, u);
  w2.phase = "toSource";
  routeTo(s, u, t);
}
var cargoOf = (s, w2) => {
  const r = s.map.resources.find((r2) => r2.id === w2.resourceId);
  return r ? resourceDefinitions[r.kind].yield : w2.prey !== void 0 ? "food" : void 0;
};
function goToDropoff(s, u, w2) {
  const t = dropoffNodes(s.map, u.player, s.cargo[u.id]?.resource ?? cargoOf(s, w2), layerOf(u.kind));
  if (!t.length) return stopWork(s, u);
  w2.phase = "toDropoff";
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
    const w2 = { kind: "gather", resourceId, phase: "toSource", progress: 0, retries: 0 };
    s.works[id] = w2;
    const kind = resourceDefinitions[s.map.resources.find((r) => r.id === resourceId).kind].yield, cargo = s.cargo[id];
    if (cargo && cargo.resource !== kind) goToDropoff(s, u, w2);
    else goToSource(s, u, w2);
  }
}
function commandHunt(s, unitIds, animalId) {
  for (const id of unitIds) {
    const u = s.units.find((u2) => u2.id === id);
    cancelMovement(s, id);
    const w2 = { kind: "gather", resourceId: carcassId(animalId), phase: "toSource", progress: 0, retries: 0, prey: animalId };
    s.works[id] = w2;
    const cargo = s.cargo[id];
    if (cargo && cargo.resource !== "food") goToDropoff(s, u, w2);
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
function nextSource(s, u, from, kind) {
  if (resourceDefinitions[from.kind].method !== "gather") {
    let best = null, dist2 = Infinity;
    for (const r of s.map.resources) if (r.collectible && r.kind === from.kind && r.kind !== "fish-trap" && (r.kind !== "fish" || workSlots(s.map, r.id, layerOf(u.kind)).length)) {
      const d = Math.abs(r.x - from.x) + Math.abs(r.y - from.y);
      if (d <= 600 && (d < dist2 || d === dist2 && best !== null && r.id < best.resourceId)) {
        best = { resourceId: r.id };
        dist2 = d;
      }
    }
    if (best || from.kind !== "livestock") return best;
    for (const a of s.units) if (a.kind === "sheep" && a.player === u.player) {
      const d = Math.abs(a.x - from.x) + Math.abs(a.y - from.y);
      if (d <= 600 && (d < dist2 || d === dist2 && best !== null && a.id < best.prey)) {
        best = { resourceId: carcassId(a.id), prey: a.id };
        dist2 = d;
      }
    }
    return best;
  }
  const id = nearestGather(s, from, kind);
  return id ? { resourceId: id } : null;
}
function nearestGather(s, from, kind) {
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
function buildSlots(map, b, layer = "land") {
  const o = map.obstacles.find((o2) => o2.id === b.id);
  return o ? ring(map, o, economyRules.workReach, layer) : [];
}
function goToSite(s, u, w2) {
  const b = s.buildings.find((b2) => b2.id === w2.buildingId);
  const t = b ? buildSlots(s.map, b, layerOf(u.kind)) : [];
  if (!t.length) return stopWork(s, u);
  const held2 = new Set(s.units.filter((v) => v !== u && v.next === null && !v.path.length).map((v) => v.node)), free = t.filter((n) => !held2.has(n));
  w2.phase = "toSite";
  routeTo(s, u, free.length ? free : t);
}
function commandBuild(s, unitIds, buildingId) {
  for (const id of unitIds) {
    const u = s.units.find((u2) => u2.id === id);
    cancelMovement(s, id);
    const w2 = { kind: "build", buildingId, phase: "toSite", retries: 0 };
    s.works[id] = w2;
    goToSite(s, u, w2);
  }
}
function stepBuilder(s, u, w2) {
  const b = s.buildings.find((b2) => b2.id === w2.buildingId);
  if (b?.complete && (b.kind === "farm" || b.kind === "fish-trap") && s.map.resources.some((r) => r.id === farmResourceId(b.id) && r.collectible) && !s.units.some((v) => v !== u && s.works[v.id]?.resourceId === farmResourceId(b.id))) {
    const g = { kind: "gather", resourceId: farmResourceId(b.id), phase: "toSource", progress: 0, retries: 0 };
    s.works[u.id] = g;
    return goToSource(s, u, g);
  }
  if (b?.complete && (wallKinds.has(b.kind) || b.kind in wallGate2)) {
    const next = s.buildings.filter((v) => v.player === u.player && !v.complete && (wallKinds.has(v.kind) || v.kind in wallGate2) && Math.max(Math.abs(v.x - b.x), Math.abs(v.y - b.y)) <= wallRules.builderReach).sort((p, q) => Math.max(Math.abs(p.x - b.x), Math.abs(p.y - b.y)) - Math.max(Math.abs(q.x - b.x), Math.abs(q.y - b.y)) || (p.id < q.id ? -1 : 1))[0];
    if (next) {
      w2.buildingId = next.id;
      w2.retries = 0;
      return goToSite(s, u, w2);
    }
  }
  if (!b || b.complete) return stopWork(s, u);
  if (!buildSlots(s.map, b, layerOf(u.kind)).includes(u.node)) {
    if (++w2.retries > 3) return stopWork(s, u);
    return goToSite(s, u, w2);
  }
  w2.phase = "building";
  w2.retries = 0;
  u.navigation = "idle";
  addWork(s, b);
}
var ticksFor = (r, kind) => economyRules.sourceTicks[r.kind] ?? economyRules.gatherTicks[kind];
function stepHunt(s, u, w2) {
  const prey = s.units.find((a) => a.id === w2.prey);
  if (!prey) {
    if (s.map.resources.some((r) => r.id === w2.resourceId)) {
      delete w2.prey;
      w2.progress = 0;
      goToSource(s, u, w2);
    } else stopWork(s, u);
    return;
  }
  if (huntProblem(s, u.player, prey.id) || !isAnimal(prey.kind)) {
    stopWork(s, u);
    return;
  }
  const range = animalRules.hunt.range[prey.kind];
  if (reach(u, prey) <= range) {
    w2.phase = "hunting";
    w2.retries = 0;
    u.navigation = "idle";
    if (w2.progress > 0) {
      w2.progress--;
      return;
    }
    strike(s, { kind: "unit", id: prey.id }, animalRules.hunt.damage + huntDamageBonus(ownerOf(s, u.player), prey.kind), u.id);
    w2.progress = animalRules.hunt.cooldown;
    if (!s.units.includes(prey)) {
      delete w2.prey;
      w2.progress = 0;
      goToSource(s, u, w2);
    }
    return;
  }
  const nodes = approach(s, u, { x: prey.x, y: prey.y }, range);
  if (!nodes.length) {
    if (++w2.retries > 3) stopWork(s, u);
    return;
  }
  w2.phase = "toSource";
  routeTo(s, u, nodes);
}
function stepWork(s) {
  const busy = new Set(s.pathJobs.flatMap((j) => j.kind === "group" ? j.unitIds : [j.unitId])), credited = /* @__PURE__ */ new Set();
  for (const u of [...s.units].sort((a, b) => a.id - b.id)) {
    const w2 = s.works[u.id];
    if (!w2 || busy.has(u.id) || u.next !== null || u.path.length) continue;
    if (w2.kind === "build") {
      stepBuilder(s, u, w2);
      continue;
    }
    if (w2.kind === "repair") {
      stepRepairer(s, u, w2, credited);
      continue;
    }
    if (w2.prey !== void 0 && w2.phase !== "toDropoff") {
      stepHunt(s, u, w2);
      continue;
    }
    const resource = s.map.resources.find((r) => r.id === w2.resourceId);
    if (!resource) {
      if (w2.phase === "toDropoff" && w2.prey !== void 0) {
        if (!dropoffNodes(s.map, u.player, s.cargo[u.id]?.resource ?? "food").includes(u.node)) {
          if (++w2.retries > 3) {
            stopWork(s, u);
            continue;
          }
          goToDropoff(s, u, w2);
          continue;
        }
        deposit(s, u);
        w2.retries = 0;
        w2.phase = "toSource";
        continue;
      }
      stopWork(s, u);
      continue;
    }
    const kind = resourceDefinitions[resource.kind].yield;
    const follow = (next) => {
      w2.resourceId = next.resourceId;
      if (next.prey !== void 0) w2.prey = next.prey;
      else delete w2.prey;
      w2.progress = 0;
    };
    if (w2.phase === "toDropoff") {
      if (!dropoffNodes(s.map, u.player, s.cargo[u.id]?.resource ?? kind, layerOf(u.kind)).includes(u.node)) {
        if (++w2.retries > 3) {
          stopWork(s, u);
          continue;
        }
        goToDropoff(s, u, w2);
        continue;
      }
      deposit(s, u);
      w2.retries = 0;
      if (!resource.collectible) {
        const next = nextSource(s, u, resource, kind);
        if (!next) {
          stopWork(s, u);
          continue;
        }
        follow(next);
        if (w2.prey !== void 0) {
          w2.phase = "toSource";
          continue;
        }
      }
      goToSource(s, u, w2);
      continue;
    }
    if (!resource.collectible) {
      if (s.cargo[u.id]) {
        goToDropoff(s, u, w2);
        continue;
      }
      const next = nextSource(s, u, resource, kind);
      if (!next) {
        stopWork(s, u);
        continue;
      }
      follow(next);
      if (w2.prey !== void 0) {
        w2.phase = "toSource";
        continue;
      }
      goToSource(s, u, w2);
      continue;
    }
    if (!workSlots(s.map, w2.resourceId, layerOf(u.kind)).includes(u.node)) {
      if (++w2.retries > 3) {
        stopWork(s, u);
        continue;
      }
      goToSource(s, u, w2);
      continue;
    }
    w2.phase = "gathering";
    w2.retries = 0;
    u.navigation = "idle";
    const owner = ownerOf(s, u.player), ship2 = u.kind === "fishing-ship";
    w2.progress += (ship2 ? 100 : gatherRate(s.techs[u.player], kind)) + gatherBonus(owner, kind, resource.kind, u.kind);
    if (w2.progress < ticksFor(resource, kind) * 100) continue;
    w2.progress -= ticksFor(resource, kind) * 100;
    const got = harvestMapResource(s.map, w2.resourceId, 1, s.tick).amount;
    let reseeded = null;
    if (resource.kind === "fish-trap" && resource.status === "depleted") {
      const old = s.buildings.find((b) => farmResourceId(b.id) === resource.id);
      s.buildings = s.buildings.filter((b) => b !== old);
    }
    if (resource.kind === "farm" && resource.status === "depleted") {
      const old = s.buildings.find((b) => farmResourceId(b.id) === resource.id);
      s.buildings = s.buildings.filter((b) => b !== old);
      if (old && s.reseed[u.player]) {
        try {
          reseeded = placeBuilding(s, u.player, "farm", old.x, old.y, `${u.player}:reseed:${s.nextBuildingId}`).id;
        } catch {
        }
      }
    }
    if (got > 0) {
      const c = s.cargo[u.id] ?? (s.cargo[u.id] = { resource: kind, amount: 0 });
      c.amount += got;
      s.accounts[u.player].ledger.extracted[kind] += got;
    }
    if (reseeded) {
      const b = { kind: "build", buildingId: reseeded, phase: "toSite", retries: 0 };
      s.works[u.id] = b;
      goToSite(s, u, b);
      continue;
    }
    if ((s.cargo[u.id]?.amount ?? 0) >= (ship2 ? economyRules.carryCapacity : carryOf(s.techs[u.player], economyRules.carryCapacity, resource.kind === "farm")) + carryBonus(owner, resource.kind)) goToDropoff(s, u, w2);
  }
}

// packages/sim/animals.ts
var halt = (s, a) => {
  cancelMovement(s, a.id);
  Object.assign(a, { path: [], goal: null, target: null, navigation: a.next === null ? "idle" : "moving" });
};
function claimSheep(s) {
  for (const sheep of s.units) {
    if (sheep.kind !== "sheep") continue;
    const near = /* @__PURE__ */ new Set();
    for (const u of s.units) if (!isAnimal(u.kind) && u.player !== GAIA && reach(u, sheep) <= animalRules.captureRange) near.add(u.player);
    if (near.size !== 1 || near.has(sheep.player)) continue;
    if (sheep.player !== GAIA && s.buildings.some((b) => {
      if (b.player !== sheep.player) return false;
      const o = s.map.obstacles.find((o2) => o2.id === b.id);
      return !!o && reach(sheep, obstacleBounds(o)) <= animalRules.holdRange;
    })) continue;
    sheep.player = [...near][0];
    halt(s, sheep);
  }
}
function stepAnimals(s) {
  const animals = s.units.filter((u) => isAnimal(u.kind)).sort((a, b) => a.id - b.id), busy = new Set(s.pathJobs.flatMap((j) => j.kind === "group" ? j.unitIds : [j.unitId]));
  for (const id of Object.keys(s.beasts).map(Number)) if (!animals.some((a) => a.id === id)) delete s.beasts[id];
  claimSheep(s);
  for (const a of animals) {
    const b = s.beasts[a.id];
    if (!b) continue;
    const foe = s.units.find((u) => u.id === b.foe && !isAnimal(u.kind));
    if (a.kind === "sheep") {
      delete s.beasts[a.id];
      continue;
    }
    if (a.kind === "deer") {
      delete s.beasts[a.id];
      if (!foe) continue;
      const dx = a.x - foe.x, dy = a.y - foe.y, len = Math.hypot(dx, dy) || 1, edge = s.map.size * 100 - 50, clamp = (v) => Math.min(edge, Math.max(50, Math.round(v)));
      try {
        commandMove(s, [a.id], { x: clamp(a.x + dx / len * animalRules.fleeDistance), y: clamp(a.y + dy / len * animalRules.fleeDistance) });
      } catch {
      }
      continue;
    }
    let target = foe && reach(a, foe) <= animalRules.boarLeash ? foe : void 0;
    if (!target) {
      target = s.units.filter((u) => !isAnimal(u.kind) && reach(a, u) <= animalRules.boarLeash && (s.works[u.id]?.prey === a.id || s.attacks[u.id]?.target.kind === "unit" && s.attacks[u.id].target.id === a.id)).sort((p, q) => reach(a, p) - reach(a, q) || p.id - q.id)[0];
      if (!target) {
        delete s.beasts[a.id];
        halt(s, a);
        continue;
      }
      b.foe = target.id;
    }
    const stats = statsOf("boar");
    if (b.cooldown > 0) b.cooldown--;
    if (reach(a, target) <= stats.range) {
      if (a.next !== null) continue;
      if (a.path.length || busy.has(a.id)) halt(s, a);
      a.navigation = "idle";
      if (b.cooldown === 0) {
        b.cooldown = stats.cooldown;
        strike(s, { kind: "unit", id: target.id }, damageOn(s, stats, { kind: "unit", id: target.id }), a.id);
      }
      continue;
    }
    if (a.next !== null) continue;
    if (b.repath > 0 && (a.path.length || busy.has(a.id))) {
      b.repath--;
      continue;
    }
    const nodes = approach(s, a, { x: target.x, y: target.y });
    if (!nodes.length) {
      delete s.beasts[a.id];
      continue;
    }
    routeTo(s, a, nodes);
    b.repath = 20;
  }
  if (s.tick % animalRules.decayTicks === 0) {
    for (const r of s.map.resources) if (r.collectible && r.id.startsWith("resource-carcass-")) harvestMapResource(s.map, r.id, 1, s.tick);
  }
}

// packages/sim/defense.ts
var defenseRules = {
  provenance: "design_default",
  // The Castle (design_default in this scale: the reference's castle holds 20 and outranges a town centre).
  // The bombard tower (the 建築 round, aoetw.com): holds 5 like a tower, but those inside add no shots (shots: false).
  capacity: { "town-center": 15, "watch-tower": 5, castle: 20, "bombard-tower": 5 },
  // bonus: extra damage against a class (aoetw: the town centre's +5 and the tower's +7 against ships). The bombard
  // tower fires one cannonball (120 pierce, +40 against ships) every 6 s (cooldown x20 like the towers), from a tower's
  // range; it outshoots nothing, it one-shots most units.
  // Arrows against ships hit fishing ships as hard (aoetw.com: the fishing-ship armor class takes the towers' ship bonus).
  arrows: {
    "town-center": { base: 1, range: 300, damage: 5, cooldown: 40, bonus: { ship: 5, "fishing-ship": 5 } },
    "watch-tower": { base: 1, range: 350, damage: 5, cooldown: 40, bonus: { ship: 7, "fishing-ship": 7 } },
    castle: { base: 4, range: 400, damage: 5, cooldown: 40 },
    "bombard-tower": { base: 1, range: 350, damage: 120, cooldown: 120, bonus: { ship: 40, "fishing-ship": 40 }, shots: false }
  },
  // Who may go inside (foot units: no cavalry, no siege), and who adds an arrow while there.
  canGarrison: ["villager", "militia", "spearman", "archer", "skirmisher", "monk", "longbowman", "woad-raider", "throwing-axeman", "huskarl", "teutonic-knight", "berserk", "janissary", "chu-ko-nu", "samurai", "hand-cannoneer"],
  addsArrow: ["villager", "archer", "skirmisher", "longbowman", "janissary", "chu-ko-nu", "hand-cannoneer"],
  // Units inside heal one hit point every healTicks; a shot stays drawn for shotTicks.
  healTicks: 40,
  shotTicks: 10,
  // The 遊戲元素 round (aoetw.com elements/Garrison, Regeneration): the castle heals those inside twice as fast as a town
  // centre or a tower (12 against 6 hit points a minute there); a building at ejectPercent of its hit points or less
  // lets everyone out and takes nobody in. Production buildings hold 10 of the units they train, who go in only by the
  // building's rally point set on the building itself (and cannot be ordered back in once out).
  healRate: { castle: 2 },
  ejectPercent: 20,
  rallyGarrison: { barracks: 10, "archery-range": 10, stable: 10, "siege-workshop": 10, monastery: 10, dock: 10 }
};
var boxOf = (s, id) => {
  const o = s.map.obstacles.find((o2) => o2.id === id);
  return o ? obstacleBounds(o) : null;
};
function garrisonCapacity(s, b) {
  const base = defenseRules.capacity[b.kind] ?? 0;
  return base ? base + garrisonBonus(ownerOf(s, b.player), b.kind) : defenseRules.rallyGarrison[b.kind] ?? 0;
}
var battered = (b) => b.hp * 100 <= b.maxHp * defenseRules.ejectPercent;
function rallyInside(s, b, p) {
  if (!(b.kind in defenseRules.rallyGarrison)) return false;
  const o = s.map.obstacles.find((o2) => o2.id === b.id);
  if (!o) return false;
  const [x0, y0, x1, y1] = obstacleBounds(o);
  return p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1;
}
var room2 = (s, b) => garrisonCapacity(s, b) - (s.garrison[b.id]?.units.length ?? 0) - Object.values(s.entering).filter((e) => e.buildingId === b.id).length;
function garrisonProblem(s, player, buildingId, unitIds) {
  const b = s.buildings.find((b2) => b2.id === buildingId);
  if (!b || b.player !== player) return "\u53EA\u80FD\u9032\u99D0\u5DF1\u65B9\u7684\u57CE\u93AE\u4E2D\u5FC3\u3001\u7BAD\u5854\u6216\u57CE\u5821";
  if (!(b.kind in defenseRules.capacity)) return b.kind in defenseRules.rallyGarrison ? "\u9019\u68DF\u5EFA\u7BC9\u53EA\u6536\u81EA\u5DF1\u8A13\u7DF4\u7684\u55AE\u4F4D\uFF1A\u628A\u96C6\u7D50\u9EDE\u8A2D\u5728\u5EFA\u7BC9\u4E0A" : "\u53EA\u80FD\u9032\u99D0\u57CE\u93AE\u4E2D\u5FC3\u3001\u7BAD\u5854\u6216\u57CE\u5821";
  if (!b.complete) return "\u5EFA\u7BC9\u5C1A\u672A\u5B8C\u5DE5";
  if (battered(b)) return `\u5EFA\u7BC9\u53D7\u640D\u56B4\u91CD\uFF08\u751F\u547D ${defenseRules.ejectPercent}% \u4EE5\u4E0B\uFF09\uFF0C\u7121\u6CD5\u9032\u99D0`;
  const units = unitIds.map((id) => s.units.find((u) => u.id === id));
  if (units.some((u) => !u || !defenseRules.canGarrison.includes(u.kind))) return "\u53EA\u6709\u6751\u6C11\u3001\u6B65\u5175\u3001\u5F92\u6B65\u5F13\u5175\u8207\u50E7\u4FB6\u80FD\u9032\u99D0";
  if (units.some((u) => u && s.relics.some((r) => r.carrier === u.id))) return "\u651C\u5E36\u8056\u7269\u7684\u50E7\u4FB6\u4E0D\u80FD\u9032\u99D0";
  if (room2(s, b) < unitIds.length) return `\u7A7A\u4F4D\u4E0D\u8DB3\uFF1A\u9084\u80FD\u9032\u99D0 ${Math.max(0, room2(s, b))} \u540D`;
  return null;
}
function commandGarrison(s, unitIds, buildingId, bell = false) {
  for (const id of unitIds) {
    const w2 = s.works[id];
    cancelMovement(s, id);
    delete s.works[id];
    delete s.attacks[id];
    delete s.rites[id];
    s.entering[id] = { buildingId, repath: 0, work: bell ? w2 ?? null : null, bell };
  }
}
function doorNodes(s, box, from = 50, to = 100, layer = "land") {
  const closed = blockedFor(s.map, layer), r = navigationRules.radius;
  return nodesNear(s.map, box, to + r).filter((n) => {
    if (closed[n]) return false;
    const d = reach(position(s.map, n), box);
    return d > r && d <= r + to && d >= from - 50;
  });
}
function enter(s, u, id, work, bell) {
  const box = boxOf(s, id);
  cancelMovement(s, u.id);
  Object.assign(u, { path: [], goal: null, target: null, next: null, navigation: "idle", wait: 0 });
  s.units = s.units.filter((v) => v !== u);
  (s.garrison[id] ??= { box, units: [] }).units.push({ unit: u, work, bell });
}
function release(s, id, which = () => true) {
  const g = s.garrison[id];
  if (!g) return;
  const out = g.units.filter(which);
  if (!out.length) return;
  const held2 = new Set(s.units.flatMap((u) => u.next === null ? [u.node] : [u.node, u.next]));
  const c = { x: (g.box[0] + g.box[2]) / 2, y: g.box[3] + 50 }, need = {}, frees = {};
  for (const e of out) {
    const l = layerOf(e.unit.kind);
    need[l] = (need[l] ?? 0) + 1;
  }
  for (const l of Object.keys(need)) {
    let free = [];
    for (let to = 100; to <= 400 && free.length < need[l]; to += 100) free = doorNodes(s, g.box, 50, to, l).filter((n) => !held2.has(n));
    free.sort((a, b) => Math.abs(position(s.map, a).x - c.x) + Math.abs(position(s.map, a).y - c.y) - (Math.abs(position(s.map, b).x - c.x) + Math.abs(position(s.map, b).y - c.y)) || a - b);
    frees[l] = free;
  }
  const left = [];
  for (const e of g.units) {
    if (!out.includes(e)) continue;
    const n = frees[layerOf(e.unit.kind)].shift();
    if (n === void 0) {
      left.push(e);
      continue;
    }
    const p = position(s.map, n);
    Object.assign(e.unit, { x: p.x, y: p.y, node: n, next: null, path: [], goal: null, target: null, navigation: "idle" });
    s.units.push(e.unit);
    const w2 = e.work;
    if (w2?.kind === "gather") {
      if (w2.prey !== void 0 && s.units.some((a) => a.id === w2.prey)) commandHunt(s, [e.unit.id], w2.prey);
      else if (s.map.resources.some((r) => r.id === w2.resourceId && r.collectible)) commandGather(s, [e.unit.id], w2.resourceId);
    } else if (w2?.kind === "build" && s.buildings.some((b) => b.id === w2.buildingId && !b.complete)) commandBuild(s, [e.unit.id], w2.buildingId);
  }
  s.units.sort((a, b) => a.id - b.id);
  g.units = g.units.filter((e) => !out.includes(e) || left.includes(e));
  if (!g.units.length) delete s.garrison[id];
}
function ringBell(s, player, ring2) {
  if (!ring2) {
    for (const id of Object.keys(s.garrison).sort()) {
      const b = s.buildings.find((b2) => b2.id === id);
      if (b?.player === player) release(s, id, (e) => e.bell);
    }
    for (const [id, e] of Object.entries(s.entering)) if (e.bell && s.units.find((u) => u.id === Number(id))?.player === player) delete s.entering[Number(id)];
    return;
  }
  const shelters = s.buildings.filter((b) => b.player === player && b.complete && !battered(b) && b.kind in defenseRules.capacity).map((b) => ({ b, box: boxOf(s, b.id) })).filter((v) => v.box);
  for (const u of s.units.filter((u2) => u2.player === player && u2.kind === "villager" && !s.entering[u2.id]).sort((a, b) => a.id - b.id)) {
    const best = shelters.filter((v) => room2(s, v.b) > 0).sort((p, q) => reach(u, p.box) - reach(u, q.box) || (p.b.id < q.b.id ? -1 : 1))[0];
    if (best) commandGarrison(s, [u.id], best.b.id, true);
  }
}
function stepDefense(s) {
  const busy = new Set(s.pathJobs.flatMap((j) => j.kind === "group" ? j.unitIds : [j.unitId]));
  for (const id of Object.keys(s.entering).map(Number).sort((a, b) => a - b)) {
    const e = s.entering[id], u = s.units.find((u2) => u2.id === id), b = s.buildings.find((b2) => b2.id === e.buildingId), box = b && boxOf(s, b.id);
    if (!u || !b || !box || b.player !== u.player || !b.complete || battered(b) || (s.garrison[b.id]?.units.length ?? 0) >= garrisonCapacity(s, b)) {
      delete s.entering[id];
      if (u && !u.path.length && u.next === null) u.navigation = "idle";
      continue;
    }
    if (u.next !== null) continue;
    if (reach(u, box) <= navigationRules.radius + 100) {
      delete s.entering[id];
      enter(s, u, b.id, e.work, e.bell);
      continue;
    }
    if (e.repath > 0 && (u.path.length || busy.has(u.id))) {
      e.repath--;
      continue;
    }
    const doors = doorNodes(s, box);
    if (!doors.length) {
      delete s.entering[id];
      continue;
    }
    routeTo(s, u, doors);
    e.repath = 20;
  }
  for (const id of Object.keys(s.garrison).sort()) {
    const g = s.garrison[id], b = s.buildings.find((b2) => b2.id === id);
    if (!b || b.player !== g.units[0]?.unit.player || battered(b)) release(s, id);
  }
  for (const [id, g] of Object.entries(s.garrison)) {
    const b = s.buildings.find((b2) => b2.id === id), scale = b ? garrisonHealScale(ownerOf(s, b.player), b.kind) * (defenseRules.healRate[b.kind] ?? 1) : 1;
    const heal = Math.floor(s.tick * scale / defenseRules.healTicks) - Math.floor((s.tick - 1) * scale / defenseRules.healTicks);
    if (heal <= 0) continue;
    for (const e of g.units) {
      const max = maxHpOf(e.unit.kind, ownerOf(s, e.unit.player));
      if (e.unit.hp < max) e.unit.hp = Math.min(max, e.unit.hp + heal);
    }
  }
  s.shots = s.shots.filter((v) => s.tick - v.tick < defenseRules.shotTicks);
  const passive = s.opponent === "idle" ? 1 : -1;
  for (const b of [...s.buildings].sort((a, b2) => a.id < b2.id ? -1 : 1)) {
    const def = defenseRules.arrows[b.kind];
    if (!def || !b.complete || b.player === passive) continue;
    if ((s.volleys[b.id] ?? 0) > 0) {
      s.volleys[b.id]--;
      continue;
    }
    const box = boxOf(s, b.id);
    if (!box) continue;
    const seen2 = new Set(s.vision[b.player].visible);
    const mod = arrowsOf(ownerOf(s, b.player), b.kind), range = def.range + mod.range;
    const target = s.units.filter((u) => u.player !== b.player && !isAnimal(u.kind) && seen2.has(tileAt(u.x, u.y, s.map.size)) && reach(u, box) <= range).sort((p, q) => reach(p, box) - reach(q, box) || p.id - q.id)[0];
    if (!target) continue;
    const bonus = { ...def.bonus };
    for (const [c, v] of Object.entries(mod.bonus)) bonus[c] = (bonus[c] ?? 0) + v;
    const cooldown = Math.max(1, Math.round(def.cooldown * mod.cooldown)), arrow = { hp: 0, damage: def.damage + mod.damage, range, cooldown, sight: 0, attack: "pierce", armor: [0, 0], classes: [], bonus };
    const shooter = (k) => defenseRules.addsArrow.includes(k) || k in combatRules.units && combatRules.units[k].classes.some((c) => mod.garrisonClasses.includes(c));
    const count = def.base + mod.extra + (def.shots === false ? 0 : s.garrison[b.id]?.units.filter((e) => shooter(e.unit.kind)).length ?? 0);
    const from = { x: Math.round((box[0] + box[2]) / 2), y: Math.round((box[1] + box[3]) / 2) };
    const shot = buildingShotOf(b.kind, ownerOf(s, b.player));
    for (let i = 0; i < count; i++) launch(s, { id: -1, player: b.player, kind: b.kind, ...from }, arrow, { kind: "unit", id: target.id }, shot);
    s.volleys[b.id] = cooldown;
    s.shots.push({ player: b.player, from: { x: Math.round((box[0] + box[2]) / 2), y: Math.round((box[1] + box[3]) / 2) }, to: { x: target.x, y: target.y }, tick: s.tick });
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
  const e = entryOf(entryId), owner = { civ: i.civ ?? neutralCiv, age: i.age, techs: i.techs, ...i.allTechs ? { allTechs: true } : {} };
  if (!e || e.kind === "building") return "\u672A\u77E5\u7684\u751F\u7522\u9805\u76EE";
  if (!civAvailable(owner.civ, entryId, !!i.allTechs)) return "\u6B64\u6587\u660E\u4E0D\u80FD\u751F\u7522";
  if (!i.building.complete) return "\u5EFA\u7BC9\u5C1A\u672A\u5B8C\u5DE5";
  if (!producersOf(entryId, owner).includes(i.building.kind)) return "\u9019\u68DF\u5EFA\u7BC9\u4E0D\u80FD\u751F\u7522\u9019\u500B\u9805\u76EE";
  for (const req of e.requires) {
    const need = entryOf(req);
    if (need?.kind === "building" && !i.ownBuildings.some((v) => v.kind === req && v.complete)) return `\u9700\u8981\u5B8C\u5DE5\u7684${need.name}`;
    if (need?.kind === "technology" && ageOf(req) && i.age < ageOf(req)) return `\u9700\u8981${need.name}`;
    if (need?.kind === "technology" && !ageOf(req) && !i.techs.includes(req)) return `\u9700\u8981\u5148\u7814\u7A76\u300C${need.name}\u300D`;
  }
  const age = ageOf(entryId);
  if (age || e.kind === "technology") {
    if (age ? i.age >= age : i.techs.includes(entryId)) return "\u5DF2\u7814\u7A76";
    if (i.ownBuildings.some((v) => v.queue.some((q) => q.entryId === entryId))) return "\u5DF2\u5728\u7814\u7A76\u4E2D";
  }
  if (i.building.queue.length >= productionRules.queueLimit) return `\u4F47\u5217\u5DF2\u6EFF\uFF08${productionRules.queueLimit}\uFF09`;
  const cost = costOf(entryId, owner), short = resources.filter((r) => i.stock[r] < cost[r]);
  if (short.length) return short.map((r) => `${names[r]}\u4E0D\u8DB3\uFF1A\u9700\u8981 ${cost[r]}\uFF0C\u76EE\u524D ${i.stock[r]}`).join("\uFF1B");
  if (i.populationUsed + i.populationReserved + e.population > i.populationCap) return `\u4EBA\u53E3\u5DF2\u6EFF\uFF08${i.populationUsed + i.populationReserved}/${i.populationCap}\uFF09\uFF1A\u8ACB\u84CB\u4F4F\u5B85`;
  return null;
}
function trainable(s, player, b, entryId) {
  if (b.player !== player) return "\u4E0D\u80FD\u64CD\u4F5C\u6575\u65B9\u5EFA\u7BC9";
  const a = s.accounts[player];
  const o = ownerOf(s, player);
  return trainBlocker({ ...o.allTechs ? { allTechs: true } : {}, player, civ: o.civ, age: s.ages[player], techs: s.techs[player], building: b, ownBuildings: s.buildings.filter((v) => v.player === player), stock: a.stock, populationUsed: a.populationUsed, populationReserved: a.populationReserved, populationCap: a.populationCap }, entryId);
}
function enqueue(s, player, buildingId, entryId, reservationId) {
  const b = s.buildings.find((v) => v.id === buildingId);
  if (!b) throw Error("\u627E\u4E0D\u5230\u9019\u68DF\u5EFA\u7BC9");
  const problem = trainable(s, player, b, entryId);
  if (problem) throw Error(problem);
  const owner = ownerOf(s, player);
  reserve(s.accounts[player], reservationId, entryId, costOf(entryId, owner));
  b.queue.push({ id: s.nextQueueId++, entryId, reservationId, work: 0, required: timeTicks(entryId, owner, b.kind) });
}
function dequeue(s, player, buildingId, itemId) {
  const b = s.buildings.find((v) => v.id === buildingId);
  if (!b || b.player !== player) throw Error("\u627E\u4E0D\u5230\u9019\u68DF\u5DF1\u65B9\u5EFA\u7BC9");
  const item = b.queue.find((q) => q.id === itemId);
  if (!item) throw Error("\u4F47\u5217\u9805\u76EE\u5DF2\u5B8C\u6210\u6216\u4E0D\u5B58\u5728");
  cancelReservation(s.accounts[player], item.reservationId);
  b.queue = b.queue.filter((q) => q !== item);
}
function exitNode(s, b, layer = "land") {
  const o = s.map.obstacles.find((o2) => o2.id === b.id), box = obstacleBounds(o, navigationRules.radius);
  const held2 = new Set(s.units.flatMap((u) => u.next === null ? [u.node] : [u.node, u.next]));
  const aim = b.rally ?? { x: (box[0] + box[2]) / 2, y: box[3] + 50 };
  let best = -1, dist2 = Infinity;
  const closed = blockedFor(s.map, layer);
  for (const n of nodesNear(s.map, box, 50)) {
    if (closed[n] || held2.has(n)) continue;
    const p = position(s.map, n), g = Math.max(box[0] - p.x, 0, p.x - box[2]) + Math.max(box[1] - p.y, 0, p.y - box[3]);
    if (g <= 0 || g > 50) continue;
    const d = Math.abs(p.x - aim.x) + Math.abs(p.y - aim.y);
    if (d < dist2) {
      dist2 = d;
      best = n;
    }
  }
  return best;
}
var unitKindOf = (entryId) => {
  if (!unitKinds.includes(entryId)) throw Error(`\u6C92\u6709\u9019\u7A2E\u55AE\u4F4D\uFF1A${entryId}`);
  return entryId;
};
function refreshOwner(s, player, before) {
  const after = ownerOf(s, player), inside = Object.values(s.garrison ?? {}).flatMap((g) => g.units.map((e) => e.unit));
  for (const u of [...s.units, ...inside]) if (u.player === player && u.kind in combatRules.units) {
    const k = u.kind;
    u.hp += maxHpOf(k, after) - maxHpOf(k, before);
  }
  for (const b of s.buildings) if (b.player === player) {
    const max = buildingHpOf(b.kind, after);
    if (max !== b.maxHp && b.maxHp > 0) {
      b.hp = Math.max(1, Math.round(b.hp * max / b.maxHp));
      b.maxHp = max;
    }
  }
  recomputeCapacity(s, player);
}
function grantTechs(s, player) {
  for (const id of grantsOf(ownerOf(s, player))) s.techs[player].push(id);
}
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
      const before = { ...ownerOf(s, b.player), techs: [...s.techs[b.player]] };
      s.ages[b.player] = age;
      grantTechs(s, b.player);
      refreshOwner(s, b.player, before);
      const own = new Set(s.buildings.filter((v) => v.player === b.player).map((v) => v.id));
      for (const o of s.map.obstacles) if (o.id && own.has(o.id)) o.age = age;
      continue;
    }
    if (entryOf(item.entryId)?.kind === "technology") {
      commitReservation(s.accounts[b.player], item.reservationId);
      b.queue.shift();
      const before = { ...ownerOf(s, b.player), techs: [...s.techs[b.player]] };
      s.techs[b.player].push(item.entryId);
      refreshOwner(s, b.player, before);
      continue;
    }
    const g = s.garrison;
    if (b.rally?.inside && g && !battered(b) && (g[b.id]?.units.length ?? 0) < garrisonCapacity(s, b)) {
      commitReservation(s.accounts[b.player], item.reservationId);
      b.queue.shift();
      const box = obstacleBounds(s.map.obstacles.find((o) => o.id === b.id));
      const u2 = makeUnit(s.map, s.nextUnitId++, b.player, Math.round((box[0] + box[2]) / 100) * 50, Math.round((box[1] + box[3]) / 100) * 50, unitKindOf(item.entryId));
      u2.hp = maxHpOf(u2.kind, ownerOf(s, b.player));
      (g[b.id] ??= { box, units: [] }).units.push({ unit: u2, work: null, bell: false });
      continue;
    }
    const layer = layerOf(unitKindOf(item.entryId)), node = exitNode(s, b, layer);
    if (node < 0) continue;
    commitReservation(s.accounts[b.player], item.reservationId);
    b.queue.shift();
    const p = position(s.map, node), u = makeUnit(s.map, s.nextUnitId++, b.player, p.x, p.y, unitKindOf(item.entryId));
    u.hp = maxHpOf(u.kind, ownerOf(s, b.player));
    s.units.push(u);
    if (b.rally && !b.rally.inside && nearest(s.map, b.rally, false, layer) >= 0) commandMove(s, [u.id], b.rally);
  }
}

// packages/sim/religion.ts
var religionRules = {
  provenance: "reference research for timings, costs and effects; design_default for ranges, heal rate and relic placement",
  convertRange: 350,
  printingRange: 117,
  adjacentRange: 50,
  healRange: 150,
  healTicks: 20,
  healSight: 400,
  attemptTicks: 24,
  attempts: { min: 4, max: 10 },
  faithAttempts: { min: 6, max: 14 },
  attemptChance: 28,
  buildingTicks: { min: 360, max: 600 },
  rechargeTicks: 1240,
  // Walls, gates and the wonder cannot be converted either (the reference).
  unconvertibleBuildings: ["town-center", "monastery", "farm", "castle", "wonder", "palisade-wall", "stone-wall", "palisade-gate", "gate"],
  relics: { count: 5, goldTicks: 40, perMonastery: 10, victoryTicks: 2e4, baseDistance: 900, spacing: 600, fairness: 400, edge: 150 }
};
var random2 = (s) => {
  let n = s.rng;
  n ^= n << 13;
  n ^= n >>> 17;
  n ^= n << 5;
  s.rng = n >>> 0;
  return s.rng;
};
var has = (s, player, tech2) => s.techs[player].includes(tech2);
var recharge = (s, player) => religionRules.rechargeTicks / (has(s, player, "illumination") ? 2 : 1);
function faithOf(s, monkId) {
  const last = s.faith[monkId], m = s.units.find((u) => u.id === monkId);
  return last === void 0 || !m ? 1 : Math.min(1, (s.tick - last) / recharge(s, m.player));
}
var convertRangeOf = (s, player) => religionRules.convertRange + (has(s, player, "block-printing") ? religionRules.printingRange : 0);
var carrying = (s, monkId) => s.relics.some((r) => r.carrier === monkId);
var maxHp = (s, u) => maxHpOf(u.kind, ownerOf(s, u.player));
var healable = (kind) => !(kind in combatRules.units) || !combatRules.units[kind].classes.some((c) => c === "siege" || c === "ship");
var healRangeOf = (s, player) => Math.round(religionRules.healRange * healRangeScale(ownerOf(s, player)));
var healTicksOf = (s, player) => Math.max(1, Math.round(religionRules.healTicks / healRateScale(ownerOf(s, player))));
var seen = (s, player, x, y) => new Set(s.vision[player].visible).has(tileAt(x, y, s.map.size));
function buildingTiles(s, b) {
  const o = s.map.obstacles.find((o2) => o2.id === b.id);
  if (!o) return [];
  const box = obstacleBounds(o), out = [];
  for (let ty = Math.floor(box[1] / 100); ty <= Math.floor((box[3] - 1) / 100); ty++) for (let tx = Math.floor(box[0] / 100); tx <= Math.floor((box[2] - 1) / 100); tx++) out.push(ty * s.map.size + tx);
  return out;
}
var boxOf2 = (s, b) => {
  const o = s.map.obstacles.find((o2) => o2.id === b.id);
  return o ? obstacleBounds(o) : null;
};
function riteProblem(s, player, kind, target) {
  if (kind === "relic") {
    const r = s.relics.find((r2) => r2.id === target);
    if (!r) return "\u627E\u4E0D\u5230\u8056\u7269";
    if (s.relicMemory[player].some((m) => m.id === target)) return null;
    return r.monastery === null && r.carrier === null && seen(s, player, r.x, r.y) ? null : "\u627E\u4E0D\u5230\u8056\u7269";
  }
  if (kind === "deposit") {
    const b = s.buildings.find((b2) => b2.id === target);
    if (!b || b.player !== player || b.kind !== "monastery") return "\u53EA\u80FD\u628A\u8056\u7269\u653E\u9032\u5DF1\u65B9\u4FEE\u9053\u9662";
    if (!b.complete) return "\u4FEE\u9053\u9662\u5C1A\u672A\u5B8C\u5DE5";
    if (s.relics.filter((r) => r.monastery === b.id).length >= religionRules.relics.perMonastery) return `\u9019\u5EA7\u4FEE\u9053\u9662\u5DF2\u653E\u6EFF ${religionRules.relics.perMonastery} \u500B\u8056\u7269`;
    return null;
  }
  if (typeof target === "string") {
    if (kind !== "convert") return "\u53EA\u80FD\u6CBB\u7642\u55AE\u4F4D";
    const b = s.buildings.find((b2) => b2.id === target);
    if (!b || !buildingTiles(s, b).some((t2) => new Set(s.vision[player].visible).has(t2))) return "\u627E\u4E0D\u5230\u76EE\u6A19";
    if (b.player === player) return "\u4E0D\u80FD\u8F49\u5316\u5DF1\u65B9\u5EFA\u7BC9";
    if (!has(s, player, "redemption")) return "\u9700\u8981\u7814\u7A76\u300C\u6551\u8D16\u300D\u624D\u80FD\u8F49\u5316\u5EFA\u7BC9";
    if (religionRules.unconvertibleBuildings.includes(b.kind)) return "\u57CE\u93AE\u4E2D\u5FC3\u3001\u4FEE\u9053\u9662\u3001\u8FB2\u7530\u8207\u57CE\u5821\u4E0D\u80FD\u88AB\u8F49\u5316";
    if (!b.complete) return "\u53EA\u80FD\u8F49\u5316\u5B8C\u5DE5\u7684\u5EFA\u7BC9";
    return null;
  }
  const t = s.units.find((u) => u.id === target);
  if (!t) return "\u627E\u4E0D\u5230\u76EE\u6A19";
  if (isAnimal(t.kind)) return kind === "heal" ? "\u52D5\u7269\u4E0D\u80FD\u88AB\u6CBB\u7642" : "\u52D5\u7269\u4E0D\u80FD\u88AB\u8F49\u5316\uFF1A\u6751\u6C11\u53EF\u4EE5\u53F3\u9375\u7F8A\u96BB\u653E\u7267";
  if (kind === "heal") {
    if (t.player !== player) return "\u53EA\u80FD\u6CBB\u7642\u5DF1\u65B9\u55AE\u4F4D";
    if (t.kind === "monk") return "\u50E7\u4FB6\u4E0D\u80FD\u88AB\u6CBB\u7642";
    if (!healable(t.kind)) return "\u653B\u57CE\u5668\u8207\u8239\u96BB\u4E0D\u80FD\u88AB\u6CBB\u7642\uFF1A\u6D3E\u6751\u6C11\u4FEE\u7406";
    return null;
  }
  if (t.player === player) return "\u4E0D\u80FD\u8F49\u5316\u5DF1\u65B9\u55AE\u4F4D";
  if (!seen(s, player, t.x, t.y)) return "\u627E\u4E0D\u5230\u76EE\u6A19";
  if (t.kind === "monk" && !has(s, player, "atonement")) return "\u9700\u8981\u7814\u7A76\u300C\u8D16\u7F6A\u300D\u624D\u80FD\u8F49\u5316\u50E7\u4FB6";
  return null;
}
function commandRite(s, monkIds, kind, target) {
  for (const id of monkIds) {
    cancelMovement(s, id);
    delete s.works[id];
    delete s.attacks[id];
    s.rites[id] = { kind, target, progress: 0, needed: 0, repath: 0, attempt: 0 };
  }
}
function clearRites(s, unitIds) {
  for (const id of unitIds) delete s.rites[id];
}
function rest(s, monk, target) {
  s.faith[monk.id] = s.tick;
  if (has(s, monk.player, "theocracy")) return;
  for (const [id, r] of Object.entries(s.rites)) if (r.kind === "convert" && r.target === target) {
    const other = s.units.find((u) => u.id === Number(id));
    if (other && other.player === monk.player) s.faith[other.id] = s.tick;
  }
}
function convertUnit(s, monk, t) {
  rest(s, monk, t.id);
  if (has(s, t.player, "heresy")) {
    killUnit(s, t);
    return;
  }
  const from = s.accounts[t.player], to = s.accounts[monk.player], c = s.cargo[t.id];
  if (c) {
    from.ledger.lost[c.resource] += c.amount;
    delete s.cargo[t.id];
  }
  delete s.works[t.id];
  delete s.attacks[t.id];
  delete s.rites[t.id];
  cancelMovement(s, t.id);
  Object.assign(t, { path: [], goal: null, target: null, navigation: t.next === null ? "idle" : "moving" });
  from.populationUsed--;
  to.populationUsed++;
  t.player = monk.player;
  t.hp = Math.min(t.hp, maxHp(s, t));
}
function convertBuilding(s, monk, b) {
  rest(s, monk, b.id);
  const old = b.player, a = s.accounts[old];
  for (const q of b.queue) cancelReservation(a, q.reservationId);
  b.queue = [];
  b.rally = null;
  b.player = monk.player;
  const o = s.map.obstacles.find((o2) => o2.id === b.id);
  if (o) {
    if (monk.player === 1) o.red = true;
    else delete o.red;
    o.age = s.ages[monk.player];
  }
  recomputeCapacity(s, old);
  recomputeCapacity(s, monk.player);
}
function placeRelics(map, seed) {
  const R = religionRules.relics, centres = [false, true].map((red) => {
    const o = map.obstacles.find((o2) => o2.kind === "town-center" && !!o2.red === red), b = obstacleBounds(o);
    return { x: (b[0] + b[2]) / 2, y: (b[1] + b[3]) / 2 };
  });
  const closed = blockedTable(map), world = map.size * 100;
  let n = (seed ^ 1540483477) >>> 0 || 1;
  const next = () => {
    n ^= n << 13;
    n ^= n >>> 17;
    n ^= n << 5;
    n >>>= 0;
    return n;
  };
  const candidates = [];
  for (let id = 0; id < nodeTotal(map); id++) {
    if (closed[id]) continue;
    const p = position(map, id);
    if (p.x < R.edge || p.y < R.edge || p.x > world - R.edge || p.y > world - R.edge) continue;
    const [d0, d1] = centres.map((c) => Math.hypot(p.x - c.x, p.y - c.y));
    if (Math.min(d0, d1) >= R.baseDistance && Math.abs(d0 - d1) <= R.fairness) candidates.push(p);
  }
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = next() % (i + 1);
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  for (let spacing = R.spacing; spacing >= 100; spacing -= 100) {
    const relics = [];
    for (const p of candidates) {
      if (relics.length === R.count) break;
      if (relics.every((r) => Math.hypot(r.x - p.x, r.y - p.y) >= spacing)) relics.push({ id: relics.length + 1, x: p.x, y: p.y, carrier: null, monastery: null });
    }
    if (relics.length === R.count) return relics;
  }
  return [];
}
function stepRelics(s) {
  const R = religionRules.relics;
  for (const r of s.relics) {
    if (r.carrier !== null) {
      const m = s.units.find((u) => u.id === r.carrier);
      if (m && m.kind === "monk") {
        r.x = m.x;
        r.y = m.y;
      } else r.carrier = null;
    }
    if (r.monastery !== null && !s.buildings.some((b) => b.id === r.monastery)) r.monastery = null;
  }
  for (let p = 0; p < s.relicMemory.length; p++) {
    const visible = new Set(s.vision[p].visible), ground = s.relics.filter((r) => r.carrier === null && r.monastery === null);
    const memory = s.relicMemory[p].filter((m) => !visible.has(tileAt(m.x, m.y, s.map.size)));
    for (const r of ground) if (visible.has(tileAt(r.x, r.y, s.map.size))) memory.push({ id: r.id, x: r.x, y: r.y });
    s.relicMemory[p] = memory.sort((a, b) => a.id - b.id);
  }
  const held2 = s.relics.map((r) => r.monastery === null ? null : s.buildings.find((b) => b.id === r.monastery));
  if (s.tick % R.goldTicks === 0) {
    for (const b of held2) if (b) {
      const a = s.accounts[b.player];
      a.stock.gold++;
      a.ledger.relic.gold++;
    }
  }
  const owners = new Set(held2.map((b) => b ? b.player : -1));
  if (s.settings?.victory !== "conquest" && s.relics.length && owners.size === 1 && !owners.has(-1)) {
    const player = [...owners][0];
    if (!s.relicVictory || s.relicVictory.player !== player) s.relicVictory = { player, endsTick: s.tick + R.victoryTicks };
    if (!s.outcome && s.tick >= s.relicVictory.endsTick) s.outcome = { winner: player, defeated: [1 - player], tick: s.tick, reason: "relic" };
  } else s.relicVictory = null;
}
function stepReligion(s) {
  const monks = s.units.filter((u) => u.kind === "monk").sort((a, b) => a.id - b.id), busy = new Set(s.pathJobs.flatMap((j) => j.kind === "group" ? j.unitIds : [j.unitId]));
  for (const id of Object.keys(s.rites).map(Number)) if (!monks.some((m) => m.id === id)) delete s.rites[id];
  for (const id of Object.keys(s.faith).map(Number)) if (!monks.some((m) => m.id === id)) delete s.faith[id];
  for (const m of monks) {
    if (s.rites[m.id] || s.attacks[m.id] || m.next !== null || m.path.length || busy.has(m.id)) continue;
    let best = null, dist2 = Infinity;
    for (const u of s.units) if (u !== m && u.player === m.player && u.kind !== "monk" && !isAnimal(u.kind) && healable(u.kind) && u.hp < maxHp(s, u)) {
      const d = reach(m, u);
      if (d <= religionRules.healSight && (d < dist2 || d === dist2 && best && u.id < best.id)) {
        best = u;
        dist2 = d;
      }
    }
    if (best) s.rites[m.id] = { kind: "heal", target: best.id, progress: 0, needed: 0, repath: 0, attempt: 0 };
  }
  for (const m of monks) {
    const r = s.rites[m.id];
    if (!r) continue;
    const done = () => {
      delete s.rites[m.id];
      cancelMovement(s, m.id);
      Object.assign(m, { path: [], goal: null, target: null, navigation: m.next === null ? "idle" : "moving" });
    };
    if (riteProblem(s, m.player, r.kind, r.target)) {
      done();
      continue;
    }
    let shape, range;
    if (r.kind === "relic") {
      const spot = s.relicMemory[m.player].find((x) => x.id === r.target) ?? s.relics.find((x) => x.id === r.target);
      if (carrying(s, m.id)) {
        done();
        continue;
      }
      shape = { x: spot.x, y: spot.y };
      range = religionRules.adjacentRange;
    } else if (r.kind === "deposit") {
      const b = s.buildings.find((b2) => b2.id === r.target), box = boxOf2(s, b);
      if (!box || !carrying(s, m.id)) {
        done();
        continue;
      }
      shape = box;
      range = religionRules.adjacentRange + navigationRules.radius;
    } else if (typeof r.target === "string") {
      const b = s.buildings.find((b2) => b2.id === r.target), box = boxOf2(s, b);
      if (!box || carrying(s, m.id)) {
        done();
        continue;
      }
      shape = box;
      range = religionRules.adjacentRange + navigationRules.radius;
    } else {
      const t = s.units.find((u) => u.id === r.target);
      if (r.kind === "heal" && t.hp >= maxHp(s, t)) {
        done();
        continue;
      }
      if (r.kind === "convert" && (carrying(s, m.id) || r.attempt === 0 && r.progress === 0 && faithOf(s, m.id) < 1)) {
        done();
        continue;
      }
      shape = { x: t.x, y: t.y };
      range = r.kind === "convert" ? convertRangeOf(s, m.player) : healRangeOf(s, m.player);
    }
    if (reach(m, shape) <= range) {
      if (m.next !== null) continue;
      if (m.path.length || busy.has(m.id)) {
        cancelMovement(s, m.id);
        m.path = [];
        m.goal = null;
        m.target = null;
      }
      m.navigation = "idle";
      if (r.kind === "relic") {
        const relic = s.relics.find((x2) => x2.id === r.target), { x, y } = shape;
        if (relic.carrier === null && relic.monastery === null && relic.x === x && relic.y === y) {
          relic.carrier = m.id;
          relic.x = m.x;
          relic.y = m.y;
        }
        done();
        continue;
      }
      if (r.kind === "deposit") {
        const relic = s.relics.find((x) => x.carrier === m.id), b = s.buildings.find((b2) => b2.id === r.target), box = shape;
        relic.carrier = null;
        relic.monastery = b.id;
        relic.x = Math.round((box[0] + box[2]) / 2);
        relic.y = Math.round((box[1] + box[3]) / 2);
        done();
        continue;
      }
      if (r.kind === "heal") {
        const t2 = s.units.find((u) => u.id === r.target);
        if (++r.progress % healTicksOf(s, m.player) === 0) t2.hp = Math.min(maxHp(s, t2), t2.hp + 1);
        continue;
      }
      if (typeof r.target === "string") {
        if (r.needed === 0) {
          const { min: min2, max: max2 } = religionRules.buildingTicks;
          r.needed = min2 + random2(s) % (max2 - min2 + 1);
        }
        if (++r.progress >= r.needed) {
          convertBuilding(s, m, s.buildings.find((b) => b.id === r.target));
          delete s.rites[m.id];
        }
        continue;
      }
      if (++r.progress % religionRules.attemptTicks !== 0) continue;
      const t = s.units.find((u) => u.id === r.target), base = has(s, t.player, "faith") ? religionRules.faithAttempts : religionRules.attempts, resist = conversionResist(ownerOf(s, t.player)), min = base.min + resist, max = base.max + resist;
      r.attempt++;
      if (r.attempt >= min && (r.attempt >= max || random2(s) % 100 < religionRules.attemptChance)) {
        convertUnit(s, m, t);
        delete s.rites[m.id];
      }
      continue;
    }
    if (m.next !== null) continue;
    if (r.repath > 0 && (m.path.length || busy.has(m.id))) {
      r.repath--;
      continue;
    }
    const nodes = approach(s, m, shape, range);
    if (!nodes.length) {
      done();
      continue;
    }
    routeTo(s, m, nodes);
    r.repath = 20;
  }
  stepRelics(s);
}

// packages/sim/market.ts
var marketRules = {
  provenance: "design_default",
  start: { food: 100, wood: 100, stone: 130 },
  lot: 100,
  step: 2,
  min: 20,
  max: 9999,
  fee: 30,
  trade: { factor: 1.4, base: 0.3, cog: 0.75, reach: 100, retries: 3 }
};
var marketResources = ["food", "wood", "stone"];
var startPrices = () => ({ ...marketRules.start });
var names2 = { food: "\u98DF\u7269", wood: "\u6728\u6750", gold: "\u9EC3\u91D1", stone: "\u77F3\u982D" };
function marketQuote(prices, o, resource) {
  const fee = marketFeeOf(o, marketRules.fee), p = prices[resource];
  return { sell: Math.floor((p * (100 - fee) + 50) / 100), buy: Math.floor((p * (100 + fee) + 50) / 100), fee };
}
var hasMarket = (s, player) => s.buildings.some((b) => b.player === player && b.kind === "market" && b.complete);
function marketProblem(s, player, action, resource) {
  if (action !== "buy" && action !== "sell") return "\u7121\u6548\u7684\u4EA4\u6613";
  if (!marketResources.includes(resource)) return "\u5E02\u96C6\u53EA\u8CB7\u8CE3\u98DF\u7269\u3001\u6728\u6750\u8207\u77F3\u982D";
  if (!hasMarket(s, player)) return "\u9700\u8981\u4E00\u5EA7\u5B8C\u5DE5\u7684\u5E02\u96C6";
  const q = marketQuote(s.market, ownerOf(s, player), resource), stock = s.accounts[player].stock;
  if (action === "sell" && stock[resource] < marketRules.lot) return `${names2[resource]}\u4E0D\u8DB3\uFF1A\u9700\u8981 ${marketRules.lot}\uFF0C\u76EE\u524D ${stock[resource]}`;
  if (action === "buy" && stock.gold < q.buy) return `\u9EC3\u91D1\u4E0D\u8DB3\uFF1A\u9700\u8981 ${q.buy}\uFF0C\u76EE\u524D ${stock.gold}`;
  return null;
}
function marketTrade(s, player, action, resource) {
  const problem = marketProblem(s, player, action, resource);
  if (problem) throw Error(problem);
  const a = s.accounts[player], q = marketQuote(s.market, ownerOf(s, player), resource), lot = marketRules.lot, R = marketRules;
  if (action === "sell") {
    a.stock[resource] -= lot;
    a.stock.gold += q.sell;
    a.ledger.market[resource] -= lot;
    a.ledger.market.gold += q.sell;
    s.market[resource] = Math.max(R.min, s.market[resource] - R.step);
  } else {
    a.stock.gold -= q.buy;
    a.stock[resource] += lot;
    a.ledger.market.gold -= q.buy;
    a.ledger.market[resource] += lot;
    s.market[resource] = Math.min(R.max, s.market[resource] + R.step);
  }
}
var tradeHome = { "trade-cart": "market", "trade-cog": "dock" };
var boxOf3 = (s, id) => {
  const o = s.map.obstacles.find((o2) => o2.id === id);
  return o ? obstacleBounds(o) : null;
};
var centre = (b) => ({ x: (b[0] + b[2]) / 2, y: (b[1] + b[3]) / 2 });
function homeOf(s, u) {
  const kind = tradeHome[u.kind];
  let best = null, dist2 = Infinity;
  for (const b of s.buildings) {
    if (b.player !== u.player || b.kind !== kind || !b.complete) continue;
    const box = boxOf3(s, b.id);
    if (!box) continue;
    const d = reach(u, box);
    if (d < dist2 || d === dist2 && best && b.id < best.id) {
      best = b;
      dist2 = d;
    }
  }
  return best;
}
function tradeProblem(s, player, unitIds, buildingId) {
  const units = unitIds.map((id) => s.units.find((u) => u.id === id));
  if (units.some((u) => !u || !(u.kind in tradeHome))) return "\u53EA\u6709\u8CBF\u6613\u8ECA\u968A\u8207\u8CBF\u6613\u5546\u8239\u80FD\u8CBF\u6613";
  const b = typeof buildingId === "string" ? s.buildings.find((b2) => b2.id === buildingId) : void 0, known = b && s.vision[player].known.some((k) => k.obstacle.id === b.id);
  if (!b) return "\u627E\u4E0D\u5230\u9019\u68DF\u5EFA\u7BC9";
  if (b.player === player) return "\u53EA\u80FD\u8207\u5C0D\u624B\u7684\u5E02\u96C6\u6216\u78BC\u982D\u8CBF\u6613";
  if (!known) return "\u627E\u4E0D\u5230\u9019\u68DF\u5EFA\u7BC9";
  if (!b.complete) return "\u5C0D\u65B9\u7684\u5EFA\u7BC9\u5C1A\u672A\u5B8C\u5DE5";
  for (const u of units) {
    if (b.kind !== tradeHome[u.kind]) return u.kind === "trade-cart" ? "\u8CBF\u6613\u8ECA\u968A\u53EA\u80FD\u524D\u5F80\u5C0D\u624B\u7684\u5E02\u96C6" : "\u8CBF\u6613\u5546\u8239\u53EA\u80FD\u524D\u5F80\u5C0D\u624B\u7684\u78BC\u982D";
    if (!homeOf(s, u)) return u.kind === "trade-cart" ? "\u9700\u8981\u4E00\u5EA7\u5DF1\u65B9\u5B8C\u5DE5\u7684\u5E02\u96C6" : "\u9700\u8981\u4E00\u5EA7\u5DF1\u65B9\u5B8C\u5DE5\u7684\u78BC\u982D";
  }
  return null;
}
function commandTrade(s, unitIds, buildingId) {
  for (const id of unitIds) {
    const u = s.units.find((u2) => u2.id === id), home = u && homeOf(s, u);
    if (!u || !home) continue;
    cancelMovement(s, id);
    delete s.works[id];
    delete s.attacks[id];
    s.trades[id] = { home: home.id, target: buildingId, leg: "out", retries: 0 };
  }
}
function tradeGold(s, kind, home, target) {
  const a = centre(home), b = centre(target), T = marketRules.trade, d = Math.hypot(a.x - b.x, a.y - b.y) / 100;
  return Math.round(d * (d / s.map.size + T.base) * T.factor * (kind === "trade-cog" ? T.cog : 1));
}
function dockNodes(s, u, box) {
  const closed = blockedFor(s.map, layerOf(u.kind)), r = navigationRules.radius, R = marketRules.trade.reach;
  return nodesNear(s.map, box, R + r).filter((n) => {
    if (closed[n]) return false;
    const d = reach(position(s.map, n), box);
    return d > r && d <= r + R;
  });
}
function stepTrade(s) {
  const busy = new Set(s.pathJobs.flatMap((j) => j.kind === "group" ? j.unitIds : [j.unitId]));
  for (const id of Object.keys(s.trades).map(Number).sort((a, b) => a - b)) {
    const t = s.trades[id], u = s.units.find((u2) => u2.id === id);
    const home = s.buildings.find((b) => b.id === t.home), target = s.buildings.find((b) => b.id === t.target), hb = home && boxOf3(s, home.id), tb = target && boxOf3(s, target.id);
    if (!u || !home || !target || !hb || !tb || !home.complete || home.player !== u.player || target.player === u.player) {
      delete s.trades[id];
      if (u && !u.path.length && u.next === null) u.navigation = "idle";
      continue;
    }
    if (u.next !== null || u.path.length || busy.has(u.id)) continue;
    const box = t.leg === "out" ? tb : hb;
    if (reach(u, box) <= navigationRules.radius + marketRules.trade.reach) {
      if (t.leg === "back") {
        const gold = tradeGold(s, u.kind, hb, tb), a = s.accounts[u.player];
        if (Number.isSafeInteger(a.stock.gold + gold)) {
          a.stock.gold += gold;
          a.ledger.trade.gold += gold;
        }
      }
      t.leg = t.leg === "out" ? "back" : "out";
      t.retries = 0;
    } else if (++t.retries > marketRules.trade.retries) {
      delete s.trades[id];
      u.navigation = "unreachable";
      continue;
    }
    const nodes = dockNodes(s, u, t.leg === "out" ? tb : hb);
    if (!nodes.length) {
      delete s.trades[id];
      continue;
    }
    routeTo(s, u, nodes);
  }
}
function stepWonders(s) {
  const T = religionRules.relics.victoryTicks;
  if (s.settings?.victory === "conquest") {
    s.wonders = {};
    s.wonderVictory = null;
    return;
  }
  for (const id of Object.keys(s.wonders)) if (!s.buildings.some((b) => b.id === id && b.kind === "wonder" && b.complete)) delete s.wonders[id];
  for (const b of [...s.buildings].sort((a, b2) => a.id < b2.id ? -1 : 1)) if (b.kind === "wonder" && b.complete && !(b.id in s.wonders)) s.wonders[b.id] = s.tick + T;
  let best = null;
  for (const [id, endsTick] of Object.entries(s.wonders).sort(([a], [b]) => a < b ? -1 : 1)) {
    const b = s.buildings.find((b2) => b2.id === id);
    if (!best || endsTick < best.endsTick) best = { player: b.player, building: id, endsTick };
  }
  s.wonderVictory = best;
  if (best && !s.outcome && s.tick >= best.endsTick) s.outcome = { winner: best.player, defeated: [1 - best.player], tick: s.tick, reason: "wonder" };
}

// packages/sim/ai.ts
var aiRules = {
  provenance: "design_default",
  player: 1,
  tauntGap: 3600,
  tauntQuiet: 600,
  thinkTicks: 20,
  thinkOffset: 7,
  villagerTarget: 12,
  gatherWeights: { food: 4, wood: 3, gold: 2, stone: 0 },
  houseMargin: 2,
  barracksAtVillagers: 3,
  ageUpAtVillagers: 9,
  waveSize: 5,
  firstWaveTick: 4800,
  herdRadius: 450,
  rams: 2,
  bellFoes: 3,
  bellRadius: 450,
  penSize: 3,
  wildFoodWorkers: 6,
  wildRange: 650,
  engageRange: 500,
  defendRadius: 700,
  baseMargin: 110,
  laneGap: 110,
  siteRange: 900,
  siteSpread: 1.5,
  siteStep: 20,
  siteChecks: 80,
  worldStep: 50,
  halfMargin: 100,
  spill: 100,
  sourceMargin: 100,
  campDistance: 350,
  campWorkers: 2,
  monkTarget: 2,
  uniqueTarget: 5,
  stoneWorkers: 3,
  castleBuilders: 3,
  castleMargin: 0,
  // The 建築 round. Water (any map with a dock site within dockRange of the town centre, the lake map): a dock once the
  // barracks stands and dockAtVillagers work, fishingShips on the deep fish, fish traps (at most fishTraps, within
  // trapRange of the dock) once no fish is in sight, and from the third age warships galleys guarding navyRadius of
  // the dock. The market in the third age with marketSpare wood beyond its cost: a resource above sellAbove is sold
  // while gold is below goldShort, stone is bought for the castle while gold allows, and tradeCarts go to the
  // opponent's market once red has seen one finished (trade needs the other player's market).
  dockAtVillagers: 6,
  dockRange: 1300,
  fishingShips: 4,
  fishTraps: 3,
  trapRange: 700,
  warships: 2,
  navyRadius: 900,
  marketSpare: 100,
  sellAbove: 600,
  goldShort: 100,
  tradeCarts: 2,
  // The 遊戲元素 round: a town centre or castle below repairBelow percent of its hit points gets up to repairers
  // villagers within repairRange (idle ones first, never builders) to repair it.
  repairBelow: 70,
  repairers: 2,
  repairRange: 600,
  research: { blacksmith: ["forging", "fletching", "scale-mail-armor", "padded-archer-armor", "iron-casting", "bodkin-arrow", "chain-mail-armor", "scale-barding-armor"], barracks: ["man-at-arms", "long-swordsman"], "archery-range": ["crossbowman"], "town-center": ["loom", "wheelbarrow", "hand-cart"], dock: ["gillnets"], "lumber-camp": ["double-bit-axe", "bow-saw", "two-man-saw"], "mining-camp": ["gold-mining", "gold-shaft-mining"], mill: ["horse-collar", "heavy-plow", "crop-rotation"] }
};
var soldierKinds = unitKinds.filter((k) => k !== "villager" && k !== "monk" && k !== "scout" && !isAnimal(k) && combatRules.units[k].attack !== "none");
var classesOf3 = (kind) => combatRules.units[kind]?.classes ?? [];
function castlePlan(o) {
  const civ = civDefs.find((c) => c.id === o.civ), unit2 = civ?.uniqueUnits.find((k) => ownerAvailable(o, k) && soldierKinds.includes(k));
  if (!civ || !unit2 || !ownerAvailable(o, "castle")) return null;
  return { unit: unit2, techs: civ.uniqueTechs.filter((t) => t.age === 3 && ownerAvailable(o, t.id) && rules.entries.some((e) => e.id === t.id)).map((t) => t.id) };
}
var gap2 = (a, b) => Math.max(a[0] - b[2], b[0] - a[2], a[1] - b[3], b[1] - a[3], 0);
var centre2 = (b) => ({ x: (b[0] + b[2]) / 2, y: (b[1] + b[3]) / 2 });
var dist = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
var claimed = [];
var clashes = (box, lane = 0) => claimed.some((c) => lane ? gap2(box, c) < lane : Math.min(box[2], c[2]) > Math.max(box[0], c[0]) && Math.min(box[3], c[3]) > Math.max(box[1], c[1]));
function claim(ok, kind, x, y) {
  if (ok) claimed.push(obstacleBounds({ kind, x, y }));
  return ok;
}
function stepAI(s, order) {
  if (s.outcome || s.tick % aiTuning(s).thinkTicks !== aiRules.thinkOffset) return;
  claimed = [];
  const P = aiRules.player, vision = s.vision[P], seen2 = new Set(vision.visible), explored = new Set(vision.explored);
  const busy = new Set(s.pathJobs.flatMap((j) => j.kind === "group" ? j.unitIds : [j.unitId]));
  const idle = (u) => !s.works[u.id] && !s.attacks[u.id] && u.next === null && !u.path.length && !busy.has(u.id);
  const mine = s.units.filter((u) => u.player === P).sort((a, b) => a.id - b.id), allVillagers = mine.filter((u) => u.kind === "villager"), soldiers = mine.filter((u) => soldierKinds.includes(u.kind) && layerOf(u.kind) === "land"), warships = mine.filter((u) => soldierKinds.includes(u.kind) && layerOf(u.kind) === "water"), scout = mine.find((u) => u.kind === "scout");
  const own = s.buildings.filter((b) => b.player === P), tc = own.find((b) => b.kind === "town-center"), tcBox = tc ? boxOf4(s, tc) : null;
  const foes = s.units.filter((u) => u.player !== P && !isAnimal(u.kind) && seen2.has(tileAt(u.x, u.y, s.map.size))).sort((a, b) => a.id - b.id);
  if (!tc && !soldiers.length && !warships.length) {
    order("resign", {});
    return;
  }
  const op = activeOpening(s), phase = op ? openingPhase(s, own) : null, half = tcBox ? sideFrom(s, centre2(tcBox)) : null;
  const raiding = op && half && tcBox ? raid(s, order, op, mine, scout, foes, idle, centre2(tcBox), half, explored) : /* @__PURE__ */ new Set();
  const wave = army(s, order, soldiers.filter((u) => !raiding.has(u.id)), foes, tcBox, idle, explored);
  taunt(s, order, wave, tc, tcBox, foes);
  if (tcBox) {
    const home2 = centre2(tcBox), raiders = foes.filter((f) => f.kind !== "villager" && dist(f, home2) <= aiRules.bellRadius).length, guards = soldiers.filter((u) => dist(u, home2) <= aiRules.bellRadius).length;
    const belled = Object.values(s.garrison).some((g) => g.units.some((e) => e.bell && e.unit.player === P));
    if (!belled && raiders >= aiRules.bellFoes && guards < raiders) order("bell", { ring: true });
    else if (belled && !foes.some((f) => dist(f, home2) <= aiRules.bellRadius + 150)) order("bell", { ring: false });
  }
  if (scout && idle(scout)) {
    const size = s.map.size;
    let best = -1, far = Infinity;
    for (let t = 0; t < size * size; t++) {
      if (explored.has(t) || s.map.tiles[t].terrainType === "water") continue;
      const d = Math.hypot(t % size * 100 + 50 - scout.x, Math.floor(t / size) * 100 + 50 - scout.y);
      if (d < far) {
        far = d;
        best = t;
      }
    }
    if (best >= 0) march(s, order, [scout], { x: best % size * 100 + 50, y: Math.floor(best / size) * 100 + 50 });
  }
  if (!tc || !tcBox) return;
  const forward = op && half ? forwardWork(s, order, op, allVillagers, own, idle, centre2(tcBox), half, explored) : /* @__PURE__ */ new Set(), villagers = allVillagers.filter((u) => !forward.has(u.id));
  const account = s.accounts[P], stock = account.stock, owner = ownerOf(s, P), cost = (id) => costOf(id, owner);
  const queued = (id) => own.reduce((t, b) => t + b.queue.filter((q) => q.entryId === id).length, 0);
  const plan = s.ages[P] >= 3 ? castlePlan(owner) : null, castle = own.find((b) => b.kind === "castle");
  const stoneDue = !!plan && stock.stone < (castle ? 0 : cost("castle").stone) + plan.techs.filter((id) => !s.techs[P].includes(id) && !queued(id)).reduce((t, id) => t + cost(id).stone, 0);
  for (const b of own.filter((b2) => !b2.complete && !(op && half && half(centre2(boxOf4(s, b2))) < 0))) {
    if (allVillagers.filter((u) => {
      const w2 = s.works[u.id];
      return w2?.kind === "build" && w2.buildingId === b.id;
    }).length >= (b.kind === "castle" ? aiRules.castleBuilders : 1)) continue;
    const builder = pickBuilder(s, villagers, idle, centre2(boxOf4(s, b)));
    if (builder) order("construct", { unitIds: [builder.id], buildingId: b.id });
  }
  const pending = (k) => own.some((b) => b.kind === k && !b.complete);
  const room3 = account.populationCap - account.populationUsed - account.populationReserved;
  const barracksDue = !own.some((b) => b.kind === "barracks") && (op ? op.plan.barracks === "dark" ? allVillagers.length >= (op.plan.barracksAt ?? aiRules.barracksAtVillagers) : op.plan.barracks === "up" && phase !== "dark" : villagers.length >= aiRules.barracksAtVillagers);
  if (barracksDue) place(s, order, "barracks", villagers, idle, tcBox, own);
  const holdForCastle = !!plan && !castle && (stock.stone < cost("castle").stone || place(s, order, "castle", villagers, idle, tcBox, own));
  const monasteryLost = s.ages[P] >= 3 && !own.some((b) => b.kind === "monastery") && stock.wood >= cost("monastery").wood && !place(s, order, "monastery", villagers, idle, tcBox, own);
  if (!op && s.ages[P] >= 2 && own.some((b) => b.kind === "archery-range" && b.complete) && !own.some((b) => b.kind === "blacksmith") && stock.wood >= cost("blacksmith").wood) place(s, order, "blacksmith", villagers, idle, tcBox, own);
  if (s.ages[P] >= 3 && !holdForCastle && own.some((b) => b.kind === "blacksmith" && b.complete) && !own.some((b) => b.kind === "siege-workshop") && stock.wood >= cost("siege-workshop").wood) place(s, order, "siege-workshop", villagers, idle, tcBox, own);
  if (s.ages[P] >= 3 && !holdForCastle && !own.some((b) => b.kind === "stable") && stock.wood >= cost("stable").wood) place(s, order, "stable", villagers, idle, tcBox, own);
  if (!op && s.ages[P] >= 2 && !own.some((b) => b.kind === "archery-range") && !buildRequirement(s.ages[P], "archery-range", own, owner.civ, s.techs[P], !!owner.allTechs) && stock.wood >= cost("archery-range").wood) place(s, order, "archery-range", villagers, idle, tcBox, own);
  if (op && s.ages[P] >= 2) for (const { kind, count } of op.plan.build) {
    const k = kind;
    if (own.filter((b) => b.kind === k).length >= count || own.some((b) => b.kind === k && !b.complete) || buildRequirement(s.ages[P], k, own, owner.civ, s.techs[P], !!owner.allTechs)) continue;
    if (place(s, order, k, villagers, idle, tcBox, own)) break;
  }
  const monasteryDue = s.ages[P] >= 3 && ownerAvailable(owner, "monastery") && !own.some((b) => b.kind === "monastery") && !monasteryLost;
  if (room3 <= (monasteryDue ? 0 : aiRules.houseMargin) && account.populationCap < settingsOf(s).popCap && !pending("house") && (!barracksDue || room3 <= 0)) place(s, order, "house", villagers, idle, tcBox, own);
  const accepts = dropoffRules.accepts, drops = own.filter((b) => b.complete && accepts[b.kind]).map((b) => ({ kinds: accepts[b.kind], box: boxOf4(s, b) })).filter((d) => d.box);
  for (const [camp, kinds] of [["lumber-camp", ["wood"]], ["mining-camp", ["gold", "stone"]], ["mill", ["food"]]]) {
    if (monasteryDue || own.some((b) => b.kind === camp && !b.complete)) continue;
    const far = villagers.map((u) => s.works[u.id]).filter((w2) => w2?.kind === "gather").map((w2) => s.map.resources.find((r) => r.id === w2.resourceId)).filter((r) => !!r && r.kind !== "farm" && kinds.includes(resourceDefinitions[r.kind].yield) && Math.min(...drops.filter((d) => d.kinds.includes(resourceDefinitions[r.kind].yield)).map((d) => gap2([r.x, r.y, r.x, r.y], d.box))) > aiRules.campDistance);
    if (far.length >= aiRules.campWorkers && place(s, order, camp, villagers, idle, tcBox, own, void 0, { x: far[0].x, y: far[0].y })) break;
  }
  const villagerCount = allVillagers.length + queued("villager");
  if (op && tc.complete && !tc.queue.length) {
    const plan2 = op.plan, clicked = phase !== "dark", ready = allVillagers.length >= plan2.clickAt;
    if (!clicked && ready && (!plan2.clickOnFood || stock.food >= cost("age-2").food)) {
      const next = plan2.loom && !s.techs[P].includes("loom") ? "loom" : "age-2";
      if (!trainable(s, P, tc, next)) order("train", { buildingId: tc.id, entryId: next });
    } else if (villagerCount < (clicked ? Math.max(plan2.villagers, aiTuning(s).villagerTarget) : plan2.clickOnFood ? plan2.villagers : plan2.clickAt) && !trainable(s, P, tc, "villager")) order("train", { buildingId: tc.id, entryId: "villager" });
    else if (plan2.castle && s.ages[P] === 2 && !trainable(s, P, tc, "age-3")) order("train", { buildingId: tc.id, entryId: "age-3" });
  } else if (tc.complete && !tc.queue.length) {
    if (villagers.length + queued("villager") < aiTuning(s).villagerTarget && !trainable(s, P, tc, "villager")) order("train", { buildingId: tc.id, entryId: "villager" });
    else if (s.ages[P] < 2 && villagers.length >= aiRules.ageUpAtVillagers && own.some((b) => b.kind === "barracks" && b.complete) && !trainable(s, P, tc, "age-2")) order("train", { buildingId: tc.id, entryId: "age-2" });
    else if (s.ages[P] === 2 && villagers.length >= aiTuning(s).villagerTarget && own.some((b) => b.kind === "archery-range" && b.complete) && !trainable(s, P, tc, "age-3")) order("train", { buildingId: tc.id, entryId: "age-3" });
  }
  const savingForAge = op ? phase === "dark" && allVillagers.length >= op.plan.clickAt && !op.plan.clickOnFood : s.ages[P] < 2 && villagers.length >= aiRules.ageUpAtVillagers && stock.food < cost("age-2").food + 60;
  const savingForCastle = s.ages[P] === 2 && !own.some((b) => b.queue.some((q) => q.entryId === "age-3")) && (op ? op.plan.castle : villagers.length >= aiTuning(s).villagerTarget && own.some((b) => b.kind === "archery-range" && b.complete)) && (stock.food < cost("age-3").food + 60 || stock.gold < cost("age-3").gold + 30);
  const planned = op ? Object.entries(op.plan.train[phase === "castle" ? "feudal" : phase] ?? {}) : null;
  const buildingsDue = !!op && s.ages[P] >= 2 && op.plan.build.some(({ kind, count }) => own.filter((b) => b.kind === kind).length < count && !buildRequirement(s.ages[P], kind, own, owner.civ, s.techs[P], !!owner.allTechs));
  const monks = mine.filter((u) => u.kind === "monk"), seenCavalry = foes.some((u) => classesOf3(u.kind).includes("cavalry") && (u.kind !== "scout" || s.tick > aiTuning(s).firstWaveTick)), seenArchers = foes.filter((u) => classesOf3(u.kind).includes("archer") && !classesOf3(u.kind).includes("skirmisher")).length;
  const slots2 = plan && castle ? Math.max(0, aiRules.uniqueTarget - mine.filter((u) => u.kind === plan.unit).length - queued(plan.unit)) : 0, unitCost = plan ? cost(plan.unit) : null;
  const reserve2 = (r) => !slots2 || !unitCost ? 0 : r === "gold" ? slots2 * unitCost.gold : unitCost[r], left = { ...stock };
  const spare = (id) => {
    const c = cost(id);
    return !slots2 || Object.keys(c).every((r) => left[r] >= reserve2(r) + c[r]);
  };
  let open = room3;
  for (const b of own.filter((b2) => b2.complete && b2.queue.length < 2)) {
    if (planned && !b.kind.startsWith("castle") && b.kind !== "town-center") {
      if (savingForAge || savingForCastle) continue;
      const pick2 = planned.find(([k, n]) => producersOf(k, owner).includes(b.kind) && mine.filter((u) => u.kind === k).length + queued(k) < n && !(buildingsDue && cost(k).wood > 0) && !trainable(s, P, b, k))?.[0];
      if (pick2) order("train", { buildingId: b.id, entryId: pick2 });
      continue;
    }
    const unique2 = plan && slots2 && producersOf(plan.unit, owner).includes(b.kind) ? plan.unit : null;
    const pick = unique2 ?? (savingForCastle && b.kind !== "monastery" ? null : b.kind === "barracks" && !savingForAge ? seenCavalry ? "spearman" : "militia" : b.kind === "archery-range" ? seenArchers >= 2 ? "skirmisher" : "archer" : b.kind === "stable" && s.ages[P] >= 3 ? "knight" : b.kind === "siege-workshop" && mine.filter((u) => u.kind === "ram").length + queued("ram") < aiRules.rams ? "ram" : b.kind === "monastery" && monks.length + queued("monk") < aiRules.monkTarget ? "monk" : null);
    if (pick && pick !== unique2 && slots2 && (open <= slots2 || !spare(pick))) continue;
    if (pick && !trainable(s, P, b, pick) && order("train", { buildingId: b.id, entryId: pick }) && slots2 && pick !== unique2) {
      open--;
      const c = cost(pick);
      for (const r of Object.keys(c)) left[r] -= c[r];
    }
  }
  const research = { ...aiRules.research, ...plan ? { castle: plan.techs } : {} };
  if (op) for (const id of op.plan.research) for (const b of producersOf(id, owner)) {
    const list = research[b] ?? [];
    if (!list.includes(id)) research[b] = [id, ...list];
  }
  if (op) for (const k of Object.keys(research)) research[k] = research[k].filter((id) => op.plan.research.includes(id));
  if (!savingForAge && !savingForCastle) for (const b of own.filter((b2) => b2.complete && !b2.queue.length)) {
    if (b.kind === "town-center" && villagers.length + queued("villager") < aiTuning(s).villagerTarget) continue;
    const next = research[b.kind]?.find((id) => !trainable(s, P, b, id) && spare(id));
    if (next) order("train", { buildingId: b.id, entryId: next });
  }
  water(s, order, { own, mine, villagers, warships, idle, tcBox, cost, queued, spare, explored, foes });
  repairHome(s, order, own, villagers, idle);
  trade(s, order, { own, mine, villagers, idle, tcBox, cost, queued, saving: savingForAge || savingForCastle || monasteryDue, stoneDue: !!plan && !castle && stock.stone < cost("castle").stone });
  const monastery = own.find((b) => b.kind === "monastery" && b.complete), home = tcBox ? centre2(tcBox) : null, fetching = new Set(Object.values(s.rites).filter((r) => r.kind === "relic").map((r) => r.target));
  for (const m of monks) {
    const rite = s.rites[m.id];
    if (carrying(s, m.id)) {
      if (monastery && rite?.kind !== "deposit") order("deposit", { unitIds: [m.id], buildingId: monastery.id });
      continue;
    }
    if (rite?.kind === "convert" || rite?.kind === "relic") continue;
    const intruder = home && faithOf(s, m.id) >= 1 ? foes.filter((u) => dist(u, home) <= aiRules.defendRadius && !riteProblem(s, P, "convert", u.id)).sort((a, b) => dist(a, m) - dist(b, m) || a.id - b.id)[0] : void 0;
    if (intruder) {
      order("convert", { unitIds: [m.id], targetId: intruder.id });
      continue;
    }
    const relic = s.relicMemory[P].filter((r) => !fetching.has(r.id)).sort((a, b) => dist(a, m) - dist(b, m) || a.id - b.id)[0];
    if (relic && !rite && monastery) {
      order("relic", { unitIds: [m.id], relicId: relic.id });
      fetching.add(relic.id);
    }
  }
  const staff = { food: 0, wood: 0, gold: 0, stone: 0 }, farmers = /* @__PURE__ */ new Set();
  const hunted = /* @__PURE__ */ new Set();
  let wild = 0;
  for (const u of villagers) {
    const w2 = s.works[u.id];
    if (w2?.kind === "gather") {
      if (w2.prey !== void 0) {
        staff.food++;
        wild++;
        hunted.add(w2.prey);
        continue;
      }
      const r = s.map.resources.find((r2) => r2.id === w2.resourceId);
      if (r) {
        staff[resourceDefinitions[r.kind].yield]++;
        if (r.kind === "farm") farmers.add(r.id);
        else if (resourceDefinitions[r.kind].yield === "food") wild++;
      }
    }
  }
  {
    const home2 = centre2(tcBox), pen = penSpot(s, tcBox), sheep = mine.filter((u) => u.kind === "sheep"), penned = sheep.filter((u) => dist(u, home2) <= aiRules.herdRadius || !idle(u)).length;
    const stray = sheep.filter((u) => idle(u) && !hunted.has(u.id) && dist(u, home2) > aiRules.herdRadius).sort((a, b) => dist(a, home2) - dist(b, home2) || a.id - b.id).slice(0, Math.max(0, aiRules.penSize - penned));
    if (stray.length) march(s, order, stray, pen);
  }
  const yieldOf = (u) => {
    const w2 = s.works[u.id];
    if (w2?.kind !== "gather" || w2.prey !== void 0) return null;
    const r = s.map.resources.find((r2) => r2.id === w2.resourceId);
    return r ? resourceDefinitions[r.kind].yield : null;
  };
  if (stoneDue && staff.stone < aiRules.stoneWorkers) {
    const home2 = centre2(tcBox), rock = s.map.resources.filter((r) => resourceDefinitions[r.kind].yield === "stone" && explored.has(tileAt(r.x, r.y, s.map.size)) && !gatherable(s.map, r.id)).sort((a, b) => dist(a, home2) - dist(b, home2) || (a.id < b.id ? -1 : 1))[0];
    if (rock) for (const kind of ["wood", "gold"]) for (const u of villagers.filter((u2) => yieldOf(u2) === kind).sort((a, b) => dist(a, rock) - dist(b, rock) || a.id - b.id)) {
      if (staff.stone >= aiRules.stoneWorkers) break;
      if (order("gather", { unitIds: [u.id], resourceId: rock.id })) {
        staff.stone++;
        staff[kind]--;
      }
    }
  }
  const towersLeft = op?.plan.towers ? Math.max(0, op.plan.towers.count - own.filter((b) => b.kind === "watch-tower").length) : 0, planWeights = op ? op.plan.weights[phase === "castle" ? "feudal" : phase] : null;
  const weights = planWeights ? { ...planWeights, stone: stock.stone >= towersLeft * cost("watch-tower").stone ? 0 : planWeights.stone } : aiRules.gatherWeights;
  for (const u of villagers.filter((u2) => idle(u2) || !stoneDue && !weights.stone && yieldOf(u2) === "stone")) {
    const kinds = Object.keys(weights).filter((k) => weights[k] > 0).sort((a, b) => staff[a] / weights[a] - staff[b] / weights[b]);
    for (const kind of kinds) {
      const natural = wild < aiRules.wildFoodWorkers && s.ages[P] < 2, source = s.map.resources.filter((r) => resourceDefinitions[r.kind].yield === kind && (kind !== "food" || natural || r.kind === "farm") && explored.has(tileAt(r.x, r.y, s.map.size)) && (kind !== "food" || dist(r, centre2(tcBox)) <= (r.kind === "farm" ? aiRules.siteRange : aiRules.wildRange)) && !gatherable(s.map, r.id) && (r.kind !== "farm" || farmOwner(s, r.id) === P && !farmers.has(r.id))).sort((a, b) => dist(u, a) - dist(u, b) || (a.id < b.id ? -1 : 1))[0];
      if (kind === "food" && natural) {
        const prey = s.units.filter((a) => (a.kind === "sheep" ? dist(a, centre2(tcBox)) <= aiRules.herdRadius + 50 : a.kind === "deer" && dist(a, centre2(tcBox)) <= aiRules.wildRange) && !huntProblem(s, P, a.id) && !s.map.resources.some((r) => r.id === carcassId(a.id))).sort((a, b) => Number(hunted.has(a.id)) - Number(hunted.has(b.id)) || dist(u, a) - dist(u, b) || a.id - b.id)[0];
        if (prey && (!source || source.kind === "farm" || dist(u, prey) < dist(u, source)) && order("hunt", { unitIds: [u.id], animalId: prey.id })) {
          staff.food++;
          wild++;
          hunted.add(prey.id);
          break;
        }
      }
      if (source && order("gather", { unitIds: [u.id], resourceId: source.id })) {
        staff[kind]++;
        if (source.kind === "farm") farmers.add(source.id);
        else if (kind === "food") wild++;
        break;
      }
      if (kind === "food" && !source && !own.some((b) => b.kind === "farm" && !b.complete) && place(s, order, "farm", villagers, idle, tcBox, own, u)) break;
    }
  }
}
var affords = (s, c, extra = 0) => Object.keys(c).every((r) => s.accounts[aiRules.player].stock[r] >= c[r] + (c[r] ? extra : 0));
function knownInput(s) {
  const explored = new Set(s.vision[aiRules.player].explored), bodies = [...s.units.flatMap((u) => [{ x: u.x, y: u.y }, ...u.next === null ? [] : [position(s.map, u.next)]]), ...s.relics.filter((r) => r.carrier === null && r.monastery === null).map((r) => ({ x: r.x, y: r.y }))];
  return { tiles: s.map.tiles, obstacles: s.map.obstacles, units: bodies, explored: (t) => explored.has(t) };
}
function waterSite(s, kind, near, range) {
  const size = s.map.size, [, , w2, d] = obstacleBounds({ kind, x: 0, y: 0 }), n = w2 / 100, sites = [];
  const wet = (t) => s.map.tiles[t]?.terrainType === "water" || s.map.tiles[t]?.terrainType === "shallow";
  for (let ty = 0; ty + d / 100 <= size; ty++) for (let tx = 0; tx + n <= size; tx++) {
    if (!wet(ty * size + tx)) continue;
    const c = { x: tx * 100 + w2 / 2, y: ty * 100 + d / 2 }, dd = dist(c, near);
    if (dd <= range) sites.push({ x: tx * 100, y: ty * 100, d: dd });
  }
  sites.sort((a, b) => a.d - b.d || a.y - b.y || a.x - b.x);
  const input = knownInput(s);
  return sites.find((v) => !clashes(obstacleBounds({ kind, x: v.x, y: v.y })) && !placementProblem(input, kind, v.x, v.y)) ?? null;
}
function water(s, order, c) {
  const P = aiRules.player, owner = ownerOf(s, P), docks = c.own.filter((b) => b.kind === "dock"), dock = docks.find((b) => b.complete), home = centre2(c.tcBox);
  if (!docks.length) {
    if (ownerAvailable(owner, "dock") && c.villagers.length >= aiRules.dockAtVillagers && c.own.some((b) => b.kind === "barracks") && affords(s, c.cost("dock"))) {
      const site3 = waterSite(s, "dock", home, aiRules.dockRange);
      const builder = site3 && pickBuilder(s, c.villagers, c.idle, { x: site3.x + 150, y: site3.y + 150 });
      if (site3 && builder) claim(order("build", { unitIds: [builder.id], kind: "dock", x: site3.x, y: site3.y }), "dock", site3.x, site3.y);
    }
    return;
  }
  if (!dock) return;
  const dockBox = boxOf4(s, dock), at = centre2(dockBox), ships2 = c.mine.filter((u) => u.kind === "fishing-ship");
  if (!dock.queue.length) {
    const pick = ships2.length + c.queued("fishing-ship") < aiRules.fishingShips ? "fishing-ship" : s.ages[P] >= 3 && c.warships.length + c.queued("galley") < aiRules.warships && c.spare("galley") ? "galley" : null;
    if (pick && !trainable(s, P, dock, pick)) order("train", { buildingId: dock.id, entryId: pick });
  }
  const worked = new Set(c.mine.map((u) => s.works[u.id]).filter((w2) => w2?.kind === "gather").map((w2) => w2.resourceId));
  const traps = c.own.filter((b) => b.kind === "fish-trap").length;
  let laid = false;
  for (const u of ships2.filter(c.idle)) {
    const source = s.map.resources.filter((r) => (r.kind === "fish" || r.kind === "fish-trap" && farmOwner(s, r.id) === P && !worked.has(r.id)) && c.explored.has(tileAt(r.x, r.y, s.map.size)) && !gatherable(s.map, r.id, "water")).sort((a, b) => dist(u, a) - dist(u, b) || (a.id < b.id ? -1 : 1))[0];
    if (source) {
      if (order("gather", { unitIds: [u.id], resourceId: source.id }) && source.kind === "fish-trap") worked.add(source.id);
      continue;
    }
    const sighted3 = s.map.resources.some((r) => r.kind === "fish" && r.collectible && c.explored.has(tileAt(r.x, r.y, s.map.size)));
    if (!sighted3 && !laid && traps < aiRules.fishTraps && ownerAvailable(owner, "fish-trap") && s.ages[P] >= 2 && affords(s, c.cost("fish-trap"), 50)) {
      const site3 = waterSite(s, "fish-trap", at, aiRules.trapRange);
      if (site3 && claim(order("build", { unitIds: [u.id], kind: "fish-trap", x: site3.x, y: site3.y }), "fish-trap", site3.x, site3.y)) {
        laid = true;
        continue;
      }
    }
    const size = s.map.size;
    let best = -1, far = Infinity;
    for (let t = 0; t < size * size; t++) {
      if (c.explored.has(t) || s.map.tiles[t].terrainType !== "water") continue;
      const d = Math.hypot(t % size * 100 + 50 - u.x, Math.floor(t / size) * 100 + 50 - u.y);
      if (d < far) {
        far = d;
        best = t;
      }
    }
    if (best >= 0) order("move", { unitIds: [u.id], x: best % size * 100 + 50, y: Math.floor(best / size) * 100 + 50 });
  }
  const prey = c.foes.filter((f) => layerOf(f.kind) === "water" && dist(f, at) <= aiRules.navyRadius).sort((a, b) => dist(a, at) - dist(b, at) || a.id - b.id)[0];
  const enemyDock = prey ? void 0 : s.buildings.filter((b) => b.player !== P && b.kind === "dock").map((b) => ({ b, box: boxOf4(s, b) })).filter((v) => v.box && dist(centre2(v.box), at) <= aiRules.navyRadius && !targetProblem(s, P, { kind: "building", id: v.b.id })).sort((a, b) => dist(centre2(a.box), at) - dist(centre2(b.box), at) || (a.b.id < b.b.id ? -1 : 1))[0];
  const target = prey ? { kind: "unit", id: prey.id } : enemyDock ? { kind: "building", id: enemyDock.b.id } : null;
  const free = c.warships.filter((u) => !s.attacks[u.id]);
  if (target && free.length) order("attack", { unitIds: free.map((u) => u.id), target });
  else {
    const away = free.filter((u) => c.idle(u) && dist(u, at) > 400);
    if (away.length) order("move", { unitIds: away.map((u) => u.id), x: Math.round(at.x), y: Math.round(at.y) });
  }
}
function trade(s, order, c) {
  const P = aiRules.player, owner = ownerOf(s, P), stock = s.accounts[P].stock, markets = c.own.filter((b) => b.kind === "market"), market = markets.find((b) => b.complete);
  if (!markets.length) {
    if (s.ages[P] >= 3 && !c.saving && ownerAvailable(owner, "market") && stock.wood >= c.cost("market").wood + aiRules.marketSpare) place(s, order, "market", c.villagers, c.idle, c.tcBox, c.own);
    return;
  }
  if (!market) return;
  if (!market.rally) {
    const box = boxOf4(s, market), m = centre2(box), h = centre2(c.tcBox), d = Math.hypot(h.x - m.x, h.y - m.y) || 1, k = Math.min(d, (box[2] - box[0]) / 2 + 150) / d;
    const spot = standable(s, { x: m.x + (h.x - m.x) * k, y: m.y + (h.y - m.y) * k });
    if (spot) order("rally", { buildingId: market.id, x: spot.x, y: spot.y });
  }
  if (s.market && c.stoneDue && stock.gold >= marketQuote(s.market, owner, "stone").buy + aiRules.goldShort) order("market", { action: "buy", resource: "stone" });
  else if (stock.gold < aiRules.goldShort) {
    const surplus = [...marketResources].filter((r) => stock[r] >= aiRules.sellAbove + marketRules.lot).sort((a, b) => stock[b] - stock[a] || (a < b ? -1 : 1))[0];
    if (surplus) order("market", { action: "sell", resource: surplus });
  }
  const theirs = s.vision[P].known.map((k) => k.obstacle).filter((o) => o.kind === "market" && !o.red && o.progress === void 0).map((o) => ({ id: o.id, c: centre2(obstacleBounds(o)) })).sort((a, b) => dist(a.c, centre2(c.tcBox)) - dist(b.c, centre2(c.tcBox)) || (a.id < b.id ? -1 : 1))[0];
  if (!theirs || !ownerAvailable(owner, "trade-cart")) return;
  const carts = c.mine.filter((u) => u.kind === "trade-cart");
  if (!market.queue.length && !c.saving && carts.length + c.queued("trade-cart") < aiRules.tradeCarts && !trainable(s, P, market, "trade-cart")) order("train", { buildingId: market.id, entryId: "trade-cart" });
  const idleCarts = carts.filter((u) => c.idle(u) && !s.trades?.[u.id]);
  if (idleCarts.length) order("trade", { unitIds: idleCarts.map((u) => u.id), buildingId: theirs.id });
}
function repairHome(s, order, own, villagers, idle) {
  const hurt = own.filter((b) => (b.kind === "town-center" || b.kind === "castle") && b.complete && b.hp * 100 < b.maxHp * aiRules.repairBelow).sort((a, b) => a.hp * b.maxHp - b.hp * a.maxHp || (a.id < b.id ? -1 : 1))[0];
  const box = hurt && boxOf4(s, hurt);
  if (!hurt || !box) return;
  const on = villagers.filter((v) => {
    const w2 = s.works[v.id];
    return w2?.kind === "repair" && w2.target?.id === hurt.id;
  }).length;
  const dist2 = (v) => Math.max(box[0] - v.x, 0, v.x - box[2], box[1] - v.y, 0, v.y - box[3]), busy = (v) => {
    const k = s.works[v.id]?.kind;
    return k === "build" || k === "repair";
  };
  const free = villagers.filter((v) => !busy(v) && dist2(v) <= aiRules.repairRange).sort((a, b) => Number(idle(b)) - Number(idle(a)) || dist2(a) - dist2(b) || a.id - b.id).slice(0, Math.max(0, aiRules.repairers - on));
  if (free.length) order("repair", { unitIds: free.map((v) => v.id).sort((a, b) => a - b), target: { kind: "building", id: hurt.id } });
}
function penSpot(s, tcBox) {
  const c = centre2(tcBox), closed = blockedTable(s.map), edge = s.map.size * 100 - 100;
  let best = { x: c.x, y: c.y }, room3 = -1;
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [-1, -1], [1, -1], [-1, 1], [1, 1], [0, 1]]) {
    const x = Math.round(dx < 0 ? tcBox[0] - 150 : dx > 0 ? tcBox[2] + 150 : c.x), y = Math.round(dy < 0 ? tcBox[1] - 150 : dy > 0 ? tcBox[3] + 150 : c.y);
    if (x < 100 || y < 100 || x > edge || y > edge) continue;
    const open = nodesNear(s.map, [x, y, x, y], 100).filter((n) => !closed[n]).length;
    if (open > room3) {
      room3 = open;
      best = { x, y };
    }
  }
  return best;
}
function boxOf4(s, b) {
  const o = s.map.obstacles.find((o2) => o2.id === b.id);
  return o ? obstacleBounds(o) : null;
}
function pickBuilder(s, villagers, idle, near) {
  const free = villagers.filter(idle).sort((a, b) => dist(a, near) - dist(b, near) || a.id - b.id)[0];
  if (free) return free;
  return villagers.filter((u) => s.works[u.id]?.kind !== "build").sort((a, b) => dist(a, near) - dist(b, near) || a.id - b.id)[0];
}
function place(s, order, kind, villagers, idle, tcBox, own, worker, near) {
  const owner = ownerOf(s, aiRules.player), cost = costOf(kind, owner), stock = s.accounts[aiRules.player].stock;
  if (Object.keys(cost).some((r2) => stock[r2] < cost[r2]) || !buildKinds.includes(kind) || !ownerAvailable(owner, kind)) return false;
  const home = centre2(tcBox), c = near ?? home, others = own.filter((b) => b.kind !== "farm" && b.kind !== "town-center").map((b) => boxOf4(s, b)).filter((b) => b !== null), [x0, y0, x1, y1] = obstacleBounds({ kind, x: 0, y: 0 }), world = s.map.size * 100, sources = s.map.obstacles.filter((o) => o.kind === "gold" || o.kind === "rock" || o.kind === "berries" || o.kind === "hunt" || o.kind === "livestock").map((o) => obstacleBounds(o)), middle = world / 2, axis = Math.hypot(home.x - middle, home.y - middle) || 1, ux = (home.x - middle) / axis, uy = (home.y - middle) / axis;
  const side = (x, y) => (x - middle) * ux + (y - middle) * uy;
  const explored = new Set(s.vision[aiRules.player].explored), bodies = [...s.units.flatMap((u) => [{ x: u.x, y: u.y }, ...u.next === null ? [] : [position(s.map, u.next)]]), ...s.relics.filter((r2) => r2.carrier === null && r2.monastery === null).map((r2) => ({ x: r2.x, y: r2.y }))];
  const input = { tiles: s.map.tiles, obstacles: s.map.obstacles, units: bodies, explored: (t) => explored.has(t) }, sites = [];
  const g = buildingRules.grid, from = (v) => Math.ceil(-v / g) * g;
  const size = s.map.size, r = navigationRules.radius, bucket = /* @__PURE__ */ new Map(), put = (b) => {
    for (let ty = Math.max(0, Math.floor(b[1] / 100)); ty <= Math.min(size - 1, Math.floor(b[3] / 100)); ty++) for (let tx = Math.max(0, Math.floor(b[0] / 100)); tx <= Math.min(size - 1, Math.floor(b[2] / 100)); tx++) {
      const k = ty * size + tx;
      (bucket.get(k) ?? bucket.set(k, []).get(k)).push(b);
    }
  };
  for (const o of s.map.obstacles) {
    const rects = obstacleRects(o);
    for (const b of rects.length ? rects : isBuilding(o) ? [obstacleBounds(o)] : []) put(b);
  }
  const bodies2 = kind === "farm" ? [] : bodies.map((u) => [u.x - r, u.y - r, u.x + r, u.y + r]);
  const bodyBucket = /* @__PURE__ */ new Map();
  for (const b of bodies2) {
    const k = Math.floor(b[1] / 100) * size + Math.floor(b[0] / 100);
    for (const dk of [0, 1, size, size + 1]) {
      const key = k + dk;
      (bodyBucket.get(key) ?? bodyBucket.set(key, []).get(key)).push(b);
    }
  }
  const dry = (box) => {
    let h = null;
    for (let ty = Math.floor(box[1] / 100); ty <= Math.floor((box[3] - 1) / 100); ty++) for (let tx = Math.floor(box[0] / 100); tx <= Math.floor((box[2] - 1) / 100); tx++) {
      const t = ty * size + tx, tile = s.map.tiles[t];
      if (!tile?.buildability || !explored.has(t) || h !== null && tile.height !== h) return false;
      h = tile.height;
      if (bucket.get(t)?.some((o) => Math.min(o[2], box[2]) > Math.max(o[0], box[0]) && Math.min(o[3], box[3]) > Math.max(o[1], box[1]))) return false;
      if (bodyBucket.get(t)?.some((o) => o[2] >= box[0] && o[0] <= box[2] && o[3] >= box[1] && o[1] <= box[3])) return false;
    }
    return true;
  };
  for (const range of kind === "farm" || kind === "lumber-camp" || kind === "mining-camp" || kind === "mill" ? [aiRules.siteRange] : kind === "castle" ? [aiRules.siteRange, aiRules.siteRange * aiRules.siteSpread, world] : [aiRules.siteRange, aiRules.siteRange * aiRules.siteSpread]) {
    sites.length = 0;
    const step = range === world ? aiRules.worldStep : aiRules.siteStep;
    const lo = (v, o) => Math.max(from(o), Math.ceil((v - range) / g) * g), hi = (v, o) => Math.min(world - o, v + range);
    for (let x = lo(c.x, x0); x <= hi(c.x, x1); x += step) for (let y = lo(c.y, y0); y <= hi(c.y, y1); y += step) {
      const box = [x + x0, y + y0, x + x1, y + y1], mid = centre2(box);
      const margin = kind === "castle" ? aiRules.castleMargin : kind === "barracks" || kind === "archery-range" || kind === "monastery" || kind === "stable" || kind === "siege-workshop" ? aiRules.halfMargin : -aiRules.spill, half = Math.min(side(box[0], box[1]), side(box[2], box[1]), side(box[0], box[3]), side(box[2], box[3])), ownHalf = half >= margin;
      if (!ownHalf || dist(mid, c) > range || !dry(box) || gap2(box, tcBox) < (kind === "farm" ? 50 : aiRules.baseMargin) || kind !== "farm" && (others.some((o) => gap2(box, o) < aiRules.laneGap) || sources.some((o) => gap2(box, o) < aiRules.sourceMargin)) || kind === "castle" && placementProblem(input, kind, x, y)) continue;
      sites.push({ x, y, d: dist(mid, c), half });
    }
    const short = (v) => kind === "castle" && v.half < aiRules.halfMargin ? 1 : 0;
    sites.sort((a, b) => short(a) - short(b) || a.d - b.d || a.y - b.y || a.x - b.x);
    let checks = 0;
    for (const site3 of sites) {
      if (clashes(obstacleBounds({ kind, x: site3.x, y: site3.y }), kind === "farm" ? 0 : aiRules.laneGap)) continue;
      if (++checks > aiRules.siteChecks) break;
      if (placementProblem(input, kind, site3.x, site3.y)) continue;
      const builder = worker ?? pickBuilder(s, villagers, idle, site3);
      if (!builder) return false;
      return claim(order("build", { unitIds: [builder.id], kind, x: site3.x, y: site3.y }), kind, site3.x, site3.y);
    }
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
  const home = tcBox ? centre2(tcBox) : null, intruder = home ? foes.filter((f) => dist(f, home) <= aiRules.defendRadius).sort((a, b) => dist(a, home) - dist(b, home) || a.id - b.id)[0] : void 0;
  const enemyBuildings = s.buildings.filter((b) => b.player !== P).map((b) => ({ b, box: boxOf4(s, b) })).filter((v) => v.box && !targetProblem(s, P, { kind: "building", id: v.b.id }));
  const free = [], offensive = s.tick >= aiTuning(s).firstWaveTick;
  for (const u of soldiers) {
    if (s.attacks[u.id]) continue;
    const foe = combatRules.units[u.kind]?.buildingsOnly ? void 0 : intruder ?? foes.filter((f) => dist(f, u) <= aiRules.engageRange && (offensive || home && dist(f, home) <= aiRules.defendRadius)).sort((a, b) => dist(a, u) - dist(b, u) || a.id - b.id)[0];
    if (foe) {
      assign(u, { kind: "unit", id: foe.id });
      continue;
    }
    const site3 = offensive && idle(u) && dist(u, home ?? u) > aiRules.defendRadius ? enemyBuildings.sort((a, b) => dist(centre2(a.box), u) - dist(centre2(b.box), u) || (a.b.id < b.b.id ? -1 : 1))[0] : void 0;
    if (site3) {
      assign(u, { kind: "building", id: site3.b.id });
      continue;
    }
    if (idle(u)) free.push(u);
  }
  for (const { target, ids } of attackers.values()) order("attack", { unitIds: ids.sort((a, b) => a - b), target });
  if (!free.length || !home) return;
  const atHome = free.filter((u) => dist(u, home) <= aiRules.defendRadius), away = free.filter((u) => dist(u, home) > aiRules.defendRadius);
  let wave = false;
  if (s.tick >= aiTuning(s).firstWaveTick && atHome.length >= aiTuning(s).waveSize) {
    march(s, order, atHome, objective(s, home, explored, true));
    wave = true;
  }
  if (away.length) march(s, order, away, offensive ? objective(s, home, explored, false) : { x: home.x, y: home.y + 250 });
  return wave;
}
function taunt(s, order, wave, tc, tcBox, foes) {
  const P = aiRules.player, mine = (s.chat ?? []).filter((m) => m.player === P), last = (n) => Math.max(-Infinity, ...mine.filter((m) => n === void 0 || m.taunt === n).map((m) => m.tick));
  if (s.tick - last() < aiRules.tauntQuiet) return;
  const say = (n) => s.tick - last(n) >= aiRules.tauntGap && order("taunt", { number: n });
  const home = tcBox ? centre2(tcBox) : null, raiders = home ? foes.filter((f) => f.kind !== "villager" && dist(f, home) <= aiRules.defendRadius) : [];
  if (wave && say(23)) return;
  if (tc && tc.hp * 2 < tc.maxHp && raiders.length && say(12)) return;
  if (Object.keys(s.wonders ?? {}).some((id) => s.buildings.some((b) => b.id === id && b.player !== P)) && say(26)) return;
  const towns = new Set(s.buildings.filter((b) => b.player !== P && b.kind === "town-center").map((b) => b.id));
  if (Object.entries(s.attacks).some(([id, a]) => a.target.kind === "building" && towns.has(a.target.id) && s.units.some((u) => u.id === Number(id) && u.player === P)) && say(21)) return;
  if (raiders.length) say(16);
}
function objective(s, home, explored, wave) {
  const P = aiRules.player, known = s.vision[P].known.map((k) => k.obstacle).filter((o) => isBuilding(o) && !o.red).map((o) => centre2(obstacleBounds(o)));
  if (known.length) return known.sort((a, b) => dist(a, home) - dist(b, home))[0];
  const middle = s.map.size * 50, mirror = { x: 2 * middle - home.x, y: 2 * middle - home.y };
  if (wave && !explored.has(tileAt(mirror.x, mirror.y, s.map.size))) return mirror;
  const size = s.map.size, count = size * size;
  for (let t = 0; t < count; t++) {
    const id = t * 97 % count;
    if (!explored.has(id)) return { x: id % size * 100 + 50, y: Math.floor(id / size) * 100 + 50 };
  }
  return mirror;
}
function standable(s, goal) {
  const edge = s.map.size * 100 - 50;
  for (let r = 0; r <= 200; r += 50) for (let dy = -r; dy <= r; dy += 50) for (let dx = -r; dx <= r; dx += 50) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
    const p = { x: Math.round((goal.x + dx) / 50) * 50, y: Math.round((goal.y + dy) / 50) * 50 };
    if (p.x >= 50 && p.y >= 50 && p.x <= edge && p.y <= edge && clearSegment(s.map, p, p)) return p;
  }
  return null;
}
function march(s, order, units, goal) {
  for (let r = 0; r <= 400; r += 50) for (let dy = -r; dy <= r; dy += 50) for (let dx = -r; dx <= r; dx += 50) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
    const p = { x: Math.round((goal.x + dx) / 50) * 50, y: Math.round((goal.y + dy) / 50) * 50 };
    const edge = s.map.size * 100 - 50;
    if (p.x < 50 || p.y < 50 || p.x > edge || p.y > edge || !clearSegment(s.map, p, p)) continue;
    if (order("move", { unitIds: units.map((u) => u.id).sort((a, b) => a - b).slice(0, 40), x: p.x, y: p.y })) return;
  }
}
function activeOpening(s) {
  const o = openingById(s.aiOpening ?? "");
  if (!o) return null;
  const u = o.plan.until;
  return s.tick >= u.tick || u.age !== void 0 && s.ages[aiRules.player] >= u.age ? null : o;
}
function openingPhase(s, own) {
  const P = aiRules.player;
  if (s.ages[P] >= 3) return "castle";
  if (s.ages[P] >= 2) return "feudal";
  return own.some((b) => b.queue.some((q) => ageOf(q.entryId) === 2)) ? "up" : "dark";
}
function sideFrom(s, home) {
  const middle = s.map.size * 50, axis = Math.hypot(home.x - middle, home.y - middle) || 1, ux = (home.x - middle) / axis, uy = (home.y - middle) / axis;
  return (p) => (p.x - middle) * ux + (p.y - middle) * uy;
}
function enemyHome(s, home) {
  const P = aiRules.player, known = s.vision[P].known.map((k) => k.obstacle).filter((o) => o.kind === "town-center" && !!o.red !== (P === 1)).map((o) => centre2(obstacleBounds(o))).sort((a, b) => dist(a, home) - dist(b, home))[0];
  return known ? { at: known, known: true } : { at: { x: s.map.size * 100 - home.x, y: s.map.size * 100 - home.y }, known: false };
}
function raid(s, order, op, mine, explorer, foes, idle, home, half, explored) {
  const r = op.plan.raid, out = /* @__PURE__ */ new Set();
  if (!r) return out;
  const units = mine.filter((u) => r.kinds.includes(u.kind) && u !== explorer), away = (u) => half(u) < 0 || !!u.target && half(u.target) < 0 || !!s.attacks[u.id] && dist(u, home) > aiRules.defendRadius;
  const gone = units.filter(away), ready = units.filter((u) => !away(u) && idle(u) && !s.attacks[u.id]);
  const leave = ready.length >= r.sendAt || r.reinforce && gone.length > 0 && ready.length > 0 ? ready : [];
  for (const u of [...gone, ...leave]) out.add(u.id);
  const prey = foes.filter((f) => f.kind === "villager"), target = enemyHome(s, home).at;
  for (const u of [...gone.filter((u2) => idle(u2) && !s.attacks[u2.id]), ...leave]) {
    const v = prey.filter((f) => !targetProblem(s, aiRules.player, { kind: "unit", id: f.id })).sort((a, b) => dist(a, u) - dist(b, u) || a.id - b.id)[0];
    if (v) order("attack", { unitIds: [u.id], target: { kind: "unit", id: v.id } });
  }
  const marching = leave.filter((u) => !prey.length);
  if (marching.length) march(s, order, marching, target);
  const lost = gone.filter((u) => idle(u) && !s.attacks[u.id] && !prey.length && dist(u, target) < 300);
  if (lost.length) march(s, order, lost, objective(s, home, explored, false));
  return out;
}
function forwardWork(s, order, op, villagers, own, idle, home, half, explored) {
  const P = aiRules.player, plan = op.plan, towers = plan.towers, need = towers?.builders ?? plan.forwardBarracks ?? 0, out = /* @__PURE__ */ new Set();
  if (!need) return out;
  const phase = openingPhase(s, own);
  if (phase === "dark" && towers?.leave !== "start") return out;
  const enemy = enemyHome(s, home), farOwn = (k) => own.filter((b) => b.kind === k && half(centre2(boxOf4(s, b))) < 0);
  const barracksDone = !plan.forwardBarracks || farOwn("barracks").length > 0, towersDone = !towers || farOwn("watch-tower").length >= towers.count;
  const building2 = (u) => {
    const w2 = s.works[u.id];
    if (w2?.kind !== "build") return false;
    const b = own.find((b2) => b2.id === w2.buildingId);
    return !!b && half(centre2(boxOf4(s, b))) < 0;
  };
  const members = villagers.filter((u) => half(u) < 0 || !!u.target && half(u.target) < 0 || building2(u));
  if (barracksDone && towersDone && !members.some(building2)) return out;
  for (const u of members) out.add(u.id);
  const res = towers ? s.map.resources.filter((r) => r.collectible && towers.prefer.includes(r.kind) && explored.has(tileAt(r.x, r.y, s.map.size)) && dist(r, enemy.at) <= 800).sort((a, b) => towers.prefer.indexOf(a.kind) - towers.prefer.indexOf(b.kind) || dist(a, enemy.at) - dist(b, enemy.at) || (a.id < b.id ? -1 : 1))[0] : void 0;
  const away = (p) => {
    if (!enemy.known) return p;
    const d = Math.hypot(p.x - enemy.at.x, p.y - enemy.at.y) || 1;
    return d >= openingRules.towerGap ? p : { x: Math.round(enemy.at.x + (p.x - enemy.at.x) * openingRules.towerGap / d), y: Math.round(enemy.at.y + (p.y - enemy.at.y) * openingRules.towerGap / d) };
  };
  const spot = !barracksDone ? { x: home.x + (enemy.at.x - home.x) * 0.6, y: home.y + (enemy.at.y - home.y) * 0.6 } : away(res ? { x: res.x, y: res.y } : { x: (home.x + enemy.at.x * 2) / 3, y: (home.y + enemy.at.y * 2) / 3 });
  const yieldOf = (u) => {
    const w2 = s.works[u.id];
    const r = w2?.kind === "gather" ? s.map.resources.find((r2) => r2.id === w2.resourceId) : void 0;
    return r ? resourceDefinitions[r.kind].yield : null;
  };
  const extra = villagers.filter((u) => !out.has(u.id) && s.works[u.id]?.kind !== "build").sort((a, b) => Number(yieldOf(b) === "wood" || yieldOf(b) === "gold") - Number(yieldOf(a) === "wood" || yieldOf(a) === "gold") || a.id - b.id).slice(0, Math.max(0, need - members.length));
  if (extra.length) {
    march(s, order, extra, spot);
    for (const u of extra) out.add(u.id);
  }
  const strays = members.filter((u) => idle(u) && dist(u, spot) > 500);
  if (strays.length) march(s, order, strays, spot);
  const free = members.filter((u) => idle(u) && dist(u, spot) <= 500);
  if (!free.length) return out;
  const site3 = own.find((b) => !b.complete && half(centre2(boxOf4(s, b))) < 0);
  if (site3) {
    order("construct", { unitIds: free.map((u) => u.id), buildingId: site3.id });
    return out;
  }
  const owner = ownerOf(s, P), kind = !barracksDone ? "barracks" : !towersDone && s.ages[P] >= 2 ? "watch-tower" : null;
  if (kind && affords(s, costOf(kind, owner))) {
    const at = forwardSite(s, kind, spot, enemy.known ? enemy.at : null);
    if (at && claim(order("build", { unitIds: free.map((u) => u.id), kind, x: at.x, y: at.y }), kind, at.x, at.y)) return out;
  }
  return out;
}
function forwardSite(s, kind, spot, enemyTc) {
  const input = knownInput(s), [x0, y0, x1, y1] = obstacleBounds({ kind, x: 0, y: 0 }), world = s.map.size * 100, sites = [];
  for (let dy = -400; dy <= 400; dy += 50) for (let dx = -400; dx <= 400; dx += 50) {
    const x = Math.round((spot.x + dx - (x1 + x0) / 2) / 100) * 100, y = Math.round((spot.y + dy - (y1 + y0) / 2) / 100) * 100;
    if (x + x0 < 0 || y + y0 < 0 || x + x1 > world || y + y1 > world) continue;
    const c = { x: x + (x0 + x1) / 2, y: y + (y0 + y1) / 2 };
    sites.push({ x, y, d: dist(c, spot), safe: enemyTc && dist(c, enemyTc) < openingRules.towerGap ? 1 : 0 });
  }
  sites.sort((a, b) => a.safe - b.safe || a.d - b.d || a.y - b.y || a.x - b.x);
  const seen2 = /* @__PURE__ */ new Set();
  for (const v of sites) {
    const k = v.x + "," + v.y;
    if (seen2.has(k)) continue;
    seen2.add(k);
    if (!clashes(obstacleBounds({ kind, x: v.x, y: v.y })) && !placementProblem(input, kind, v.x, v.y)) return v;
  }
  return null;
}
var openingRules = { provenance: "design_default", towerGap: 600 };
function openingView(s, player) {
  const own = s.buildings.filter((b) => b.player === player), tc = own.find((b) => b.kind === "town-center"), box = tc ? boxOf4(s, tc) : null;
  const half = box ? sideFrom(s, centre2(box)) : null, mine = s.units.filter((u) => u.player === player);
  const gather = Object.fromEntries(gatherKinds.map((k) => [k, 0])), count = (list) => list.reduce((t, v) => ({ ...t, [v.kind]: (t[v.kind] ?? 0) + 1 }), {});
  for (const u of mine) {
    const w2 = s.works[u.id];
    if (w2?.kind !== "gather") continue;
    if (w2.prey !== void 0) {
      const a = s.units.find((a2) => a2.id === w2.prey);
      gather[a?.kind === "sheep" ? "sheep" : "hunt"]++;
      continue;
    }
    const r = s.map.resources.find((r2) => r2.id === w2.resourceId);
    if (!r) continue;
    const k = r.kind === "livestock" ? "sheep" : r.kind === "hunt" ? "hunt" : r.kind === "tree" ? "wood" : r.kind === "berries" || r.kind === "gold" || r.kind === "stone" || r.kind === "farm" ? r.kind : null;
    if (k) gather[k]++;
  }
  const far = half ? { ...count(own.filter((b) => half(centre2(boxOf4(s, b) ?? [b.x, b.y, b.x, b.y])) < 0)), villager: mine.filter((u) => u.kind === "villager" && half(u) < 0).length } : {};
  const fighters = half ? mine.filter((u) => soldierKinds.includes(u.kind) && half(u) < 0).length : 0, scoutsOut = half ? mine.filter((u) => u.kind === "scout" && half(u) < 0).length : 0;
  return {
    age: s.ages[player],
    clicking: Math.max(0, ...own.flatMap((b) => b.queue.map((q) => ageOf(q.entryId)))),
    villagers: mine.filter((u) => u.kind === "villager").length,
    gather,
    buildings: count(own),
    forward: far,
    units: count(mine),
    techs: [...s.techs[player]],
    raiding: fighters + Math.max(0, scoutsOut - 1)
  };
}

// packages/content/taunts.ts
var taunts = [
  { n: 1, zh: "\u597D\u3002", en: "Yes." },
  { n: 2, zh: "\u4E0D\u3002", en: "No." },
  { n: 3, zh: "\u8ACB\u7D66\u6211\u98DF\u7269\u3002", en: "Food please." },
  { n: 4, zh: "\u8ACB\u7D66\u6211\u6728\u6750\u3002", en: "Wood please." },
  { n: 5, zh: "\u8ACB\u7D66\u6211\u9EC3\u91D1\u3002", en: "Gold please." },
  { n: 6, zh: "\u8ACB\u7D66\u6211\u77F3\u982D\u3002", en: "Stone please." },
  { n: 7, zh: "\u5509~~\u6B38......", en: "Ahh!" },
  { n: 8, zh: "\u55E8~\u8089\u8173\u4F60\u5011\u597D\u554A", en: "All hail, king of the losers!" },
  { n: 9, zh: "\u55DA~~\u8036", en: "Ooh!" },
  { n: 10, zh: "\u770B\u6211\u628A\u4F60\u6253\u56DE\u4E16\u7D00\u5E1D\u570B\u4E00\u4EE3\u53BB", en: "I'll beat you back to Age of Empires." },
  { n: 11, zh: "\uFF08\u5978\u7B11\uFF09", en: "(Herb laugh)" },
  { n: 12, zh: "\u6211\u5FEB\u62DB\u67B6\u4E0D\u4F4F\u4E86......", en: "Ah! Being rushed." },
  { n: 13, zh: "\u53BB\u602A\u4F60\u7684\u7DB2\u8DEF\u516C\u53F8\u5427\uFF01", en: "Sure, blame it on your ISP." },
  { n: 14, zh: "\u6B38\uFF01\u904A\u6232\u5DF2\u7D93\u958B\u59CB\u56C9\uFF01", en: "Start the game already!" },
  { n: 15, zh: "\u62DC\u8A17\uFF01\u4E0D\u8981\u7528\u90A3\u500B\u6771\u897F\u6307\u8457\u6211\u597D\u55CE\uFF1F", en: "Don't point that thing at me!" },
  { n: 16, zh: "\u767C\u73FE\u6575\u4EBA\u3002", en: "Enemy sighted!" },
  { n: 17, zh: "\u5750\u4E0A\u738B\u4F4D\u7684\u611F\u89BA\u771F\u597D\u3002", en: "It is good to be the king." },
  { n: 18, zh: "\u6211\u9084\u5C11\u500B\u50E7\u4FB6\u3002", en: "Monk! I need a monk!" },
  { n: 19, zh: "\u6709\u4E00\u9663\u5B50\u6C92\u4EA4\u624B\u56C9\uFF1F", en: "Long time, no siege." },
  { n: 20, zh: "\u6B38\u4F60\u4E5F\u5E6B\u5E6B\u5FD9\uFF0C\u9023\u6211\u963F\u5B24\u90FD\u6BD4\u4F60\u884C\u3002", en: "My granny could scrap better than that." },
  { n: 21, zh: "\u597D\u5730\u65B9\uFF0C\u6211\u8981\u5B9A\u4E86\uFF01", en: "Nice town, I'll take it." },
  { n: 22, zh: "\u5225\u518D\u6253\u6211\u4E86\u5566\uFF01", en: "Quit touching me!" },
  { n: 23, zh: "\u5927\u4F19\u9032\u653B\u56C9\uFF01", en: "Raiding party!" },
  { n: 24, zh: "\u539A\uFF01\u771F\u96D6\uFF01", en: "Dadgum." },
  { n: 25, zh: "\u4F60\u6562\u5C31\u4F86\u554A\uFF1F", en: "Eh, smite me." },
  { n: 26, zh: "\u7CDF\u4E86\uFF01\u662F\u4E16\u754C\u5947\u89C0\uFF01", en: "The wonder, the wonder, the... no!" },
  { n: 27, zh: "\u6B38\uFF0C\u4F60\u73A9\u9019\u9EBC\u4E45\u624D\u73A9\u9019\u6A23\u5594\uFF1F", en: "You played two hours to die like this?" },
  { n: 28, zh: "\u9084\u6709\u4EBA\u6BD4\u4F60\u66F4\u6158\u52D2\u3002", en: "Yeah, well, you should see the other guy." },
  { n: 29, zh: "\u8089\u8173\u3002", en: "Roggan." },
  { n: 30, zh: "\u55DA~~\u547C~~~", en: "Wololo." },
  { n: 31, zh: "\u653B\u64CA\u6575\u4EBA\uFF0C\u885D\u554A\uFF01", en: "Attack an enemy now." },
  { n: 32, zh: "\u505C\u6B62\u751F\u7522\u984D\u5916\u7684\u6751\u6C11\u3002", en: "Cease creating extra villagers." },
  { n: 33, zh: "\u751F\u7522\u984D\u5916\u6751\u6C11\u3002", en: "Create extra villagers." },
  { n: 34, zh: "\u5EFA\u7ACB\u6D77\u8ECD\u3002", en: "Build a navy." },
  { n: 35, zh: "\u505C\u6B62\u5EFA\u7ACB\u6D77\u8ECD\u3002", en: "Stop building a navy." },
  { n: 36, zh: "\u7B49\u6211\u4E0B\u4EE4\u653B\u64CA", en: "Wait for my signal to attack." },
  { n: 37, zh: "\u5EFA\u9020\u4E16\u754C\u5947\u89C0\u3002", en: "Build a wonder." },
  { n: 38, zh: "\u8ACB\u4F60\u628A\u591A\u7684\u8CC7\u6E90\u7D66\u6211\u3002", en: "Give me your extra resources." },
  { n: 39, zh: "\uFF08\u540C\u76DF\u8072\u97F3\uFF09", en: "(Ally sound)" },
  { n: 40, zh: "\uFF08\u6575\u4EBA\u8072\u97F3\uFF09", en: "(Enemy sound)" },
  { n: 41, zh: "\uFF08\u4E2D\u7ACB\u8072\u97F3\uFF09", en: "(Neutral sound)" },
  { n: 42, zh: "\u4F60\u5728\u54EA\u4E00\u500B\u6642\u4EE3\u554A\uFF1F", en: "What age are you in?" }
];
var tauntRules = { provenance: "design_default", keep: 20, everyTicks: 20 };
var tauntOf = (n) => taunts.find((t) => t.n === n);

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
var rulesetHash = hash({ openings, repair: repairRules, carriers: carrierRules, taunts: tauntRules, rules, navigationRules, economyRules, terrainRules, terrainDefinitions, resourceDefinitions, visionRules, startingResourceRules, footprints: footprintContract, combat: combatRules, ai: aiRules, maps: { mapSizes, openMapRules }, dropoffs: dropoffRules, naval: navalRules, market: marketRules, religion: religionRules, animals: animalRules, tech: techRules, defense: defenseRules, civs: civDefs, techs: techEffects, unitLines: { lineUpgrades, blacksmith, religionBonus }, projectiles: projectileRules, tactics: tacticsRules, settings: settingRules, simulationVersion: 33 });
var settingKeys = ["difficulty", "resources", "popCap", "reveal", "startAge", "victory", "allTechs"];
var pickSettings = (o) => Object.fromEntries(settingKeys.filter((k) => k in o).map((k) => [k, o[k]]));
function createState(seed, layout = "meadow", opponent = "idle", civs = [neutralCiv, neutralCiv], aiOpening = standardOpening, options = {}) {
  if (layout && typeof layout === "object") return createState(seed, layout.layout ?? "meadow", layout.opponent ?? "idle", layout.civs ?? [neutralCiv, neutralCiv], layout.aiOpening ?? standardOpening, pickSettings(layout));
  const settings = matchSettings(pickSettings(options));
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 4294967295) throw Error("seed \u5FC5\u9808\u70BA uint32");
  if (opponent !== "ai" && opponent !== "idle") throw Error("\u672A\u77E5\u7684\u5C0D\u624B\u8A2D\u5B9A");
  if (!Array.isArray(civs) || civs.length !== 2 || !civs.every(civExists)) throw Error("\u672A\u77E5\u7684\u6587\u660E");
  if (!openingChoices.includes(aiOpening)) throw Error("\u672A\u77E5\u7684\u96FB\u8166\u958B\u5C40");
  const map = makeMap(seed, layout);
  const state = { settings, aiOpening: aiOpening === randomOpening ? pickOpening(seed, civs[1]) : aiOpening, buildings: [], nextBuildingId: 1, ages: [1, 1], nextUnitId: 5, nextQueueId: 1, attacks: {}, corpses: [], outcome: null, rites: {}, faith: {}, techs: [[], []], relics: layout === "open" || layout === "lakes" ? placeRelics(map, seed) : [], relicMemory: [[], []], relicVictory: null, market: startPrices(), trades: {}, wonders: {}, wonderVictory: null, transports: {}, boarding: {}, unloading: {}, beasts: {}, reseed: [true, true], garrison: {}, entering: {}, volleys: {}, shots: [], version: 33, repairs: {}, chat: [], opponent, civs: [...civs], keptHousing: [0, 0], reveals: [], projectiles: [], nextProjectileId: 0, stances: {}, patrols: {}, setups: {}, works: {}, cargo: {}, layout, vision: createVision(), accounts: [createAccount(3), createAccount(opponent === "ai" ? 3 : 1)], transactions: [], map, pathJobs: [], nextJobId: 1, navigationSeen: 0, seed, rng: seed || 1, tick: 0, sequence: [0, 0], units: [...map.starts[0].map((p, i) => makeUnit(map, 1 + i, 0, p.x, p.y)), makeUnit(map, 4, 1, map.starts[1][0].x, map.starts[1][0].y)], queue: [], log: [] };
  if (opponent === "ai") {
    state.units.push(...map.starts[1].slice(1).map((p, i) => makeUnit(map, 5 + i, 1, p.x, p.y)));
    state.nextUnitId = 5 + map.starts[1].length - 1;
  }
  if (map.scouts) {
    for (const p of opponent === "ai" ? [0, 1] : [0]) {
      const at = map.scouts[p];
      state.units.push(makeUnit(map, state.nextUnitId++, p, at.x, at.y, "scout"));
      state.accounts[p].populationUsed++;
    }
  }
  (map.animals ?? []).forEach((a, i) => state.units.push(makeUnit(map, animalRules.firstId + i, a.owner ?? GAIA, a.x, a.y, a.kind)));
  for (const a of state.accounts) a.stock = { ...settingRules.resources[settings.resources] };
  if (settings.startAge > 1) {
    state.ages = [settings.startAge, settings.startAge];
    for (const p of [0, 1]) grantTechs(state, p);
  }
  for (const p of [0, 1]) {
    const o = ownerOf(state, p), stock = startStock(o), a = state.accounts[p];
    for (const k of ["food", "wood", "gold", "stone"]) a.stock[k] = Math.max(0, a.stock[k] + stock[k]);
    const extra = startVillagers(o);
    if (!extra) continue;
    const at = map.starts[p][0], closed = blockedTable(map);
    const held2 = new Set(state.units.map((u) => u.node)), free = nodesNear(map, [at.x, at.y, at.x, at.y], 400).filter((n) => !closed[n] && !held2.has(n)).sort((a2, b) => {
      const pa = position(map, a2), pb = position(map, b);
      return Math.hypot(pa.x - at.x, pa.y - at.y) - Math.hypot(pb.x - at.x, pb.y - at.y) || a2 - b;
    });
    for (const n of free.slice(0, extra)) {
      const q = position(map, n);
      state.units.push(makeUnit(map, state.nextUnitId++, p, q.x, q.y));
      a.populationUsed++;
    }
  }
  state.units.sort((a, b) => a.id - b.id);
  for (const u of state.units) if (u.player === 0 || u.player === 1) u.hp = maxHpOf(u.kind, ownerOf(state, u.player));
  initBuildings(state);
  if (settings.startAge > 1) {
    for (const o of state.map.obstacles) if (o.kind === "town-center") o.age = settings.startAge;
  }
  claimSheep(state);
  updateVision(state.vision, state.map, state.units, 0, void 0, sightOf(state), [], settings.reveal === "all");
  if (settings.reveal === "explored") {
    const all2 = [...Array(state.map.size ** 2).keys()];
    for (const v of state.vision) v.explored = all2;
  }
  return state;
}
function sightOf(s) {
  return (player, kind) => kind in combatRules.units ? losBonus(ownerOf(s, player), kind, combatRules.units[kind].classes) : losBonus(ownerOf(s, player), kind);
}
function riteTarget(c) {
  const p = c.payload;
  if (c.commandType === "relic") return Number.isSafeInteger(p.relicId) ? p.relicId : null;
  if (c.commandType === "deposit") return typeof p.buildingId === "string" ? p.buildingId : null;
  if (c.commandType === "convert" && typeof p.buildingId === "string") return p.buildingId;
  return Number.isSafeInteger(p.targetId) ? p.targetId : null;
}
function submit(state, c, record = true) {
  if (!c || c.protocolVersion !== 1 || c.rulesetHash !== rulesetHash) throw Error("\u547D\u4EE4\u7248\u672C\u4E0D\u7B26");
  if (!Number.isSafeInteger(c.playerId) || c.playerId < 0 || c.playerId > 1) throw Error("\u7121\u6548\u73A9\u5BB6");
  if (!Number.isSafeInteger(c.sequence) || c.sequence !== state.sequence[c.playerId] + 1) throw Error("\u91CD\u8907\u6216\u932F\u5E8F\u547D\u4EE4");
  if (!Number.isSafeInteger(c.targetTick) || c.targetTick <= state.tick || c.targetTick > state.tick + 200) throw Error("\u547D\u4EE4\u5DF2\u904E\u671F\u6216\u904E\u9060");
  if (!c.payload) throw Error("\u7F3A\u5C11 payload");
  if (state.outcome) throw Error("\u5C0D\u5C40\u5DF2\u7D50\u675F\uFF1A\u8ACB\u518D\u958B\u4E00\u5C40");
  if (c.commandType === "move" || c.commandType === "stop" || c.commandType === "gather" || c.commandType === "hunt" || c.commandType === "garrison" || c.commandType === "build" || c.commandType === "construct" || c.commandType === "attack" || c.commandType === "convert" || c.commandType === "heal" || c.commandType === "relic" || c.commandType === "deposit" || c.commandType === "trade" || c.commandType === "load" || c.commandType === "repair" || c.commandType === "stance" || c.commandType === "patrol") {
    const ids = c.payload.unitIds;
    if (!Array.isArray(ids) || !ids.length || ids.length > navigationRules.maxGroupSize || !ids.every((id, i) => Number.isSafeInteger(id) && (i === 0 || id > ids[i - 1]))) throw Error(`\u55AE\u4F4D\u6E05\u55AE\u9700\u70BA 1\u2013${navigationRules.maxGroupSize} \u500B\u905E\u589E\u4E14\u4E0D\u91CD\u8907\u7684 ID`);
    for (const id of ids) {
      const u = state.units.find((u2) => u2.id === id);
      if (!u || u.player !== c.playerId) throw Error("\u4E0D\u53EF\u63A7\u5236\u6575\u65B9\u6216\u4E0D\u5B58\u5728\u7684\u55AE\u4F4D");
      if (c.commandType === "convert" || c.commandType === "heal" || c.commandType === "relic" || c.commandType === "deposit") {
        if (u.kind !== "monk") throw Error("\u53EA\u6709\u50E7\u4FB6\u80FD\u8F49\u5316\u3001\u6CBB\u7642\u6216\u642C\u904B\u8056\u7269");
      } else if (c.commandType === "attack") {
        if (u.kind === "monk") throw Error("\u50E7\u4FB6\u4E0D\u80FD\u653B\u64CA\uFF1A\u53F3\u9375\u6575\u65B9\u55AE\u4F4D\u6539\u70BA\u8F49\u5316");
        if (isAnimal(u.kind)) throw Error("\u52D5\u7269\u4E0D\u80FD\u653B\u64CA");
        if (statsOf(u.kind, ownerOf(state, u.player)).attack === "none") throw Error(`${rules.entries.find((e) => e.id === u.kind)?.name ?? u.kind}\u4E0D\u80FD\u653B\u64CA`);
        {
          const st = statsOf(u.kind, ownerOf(state, u.player)), t = c.payload.target, v = t?.kind === "unit" ? state.units.find((x) => x.id === t.id) : void 0;
          const siege = !!v && v.kind in combatRules.units && combatRules.units[v.kind].classes.includes("siege");
          if (st.buildingsOnly && t?.kind !== "building" && !(st.alsoSiege && siege)) throw Error(`${rules.entries.find((e) => e.id === u.kind)?.name ?? u.kind}\u53EA\u80FD\u653B\u64CA\u5EFA\u7BC9${st.alsoSiege ? "\u8207\u653B\u57CE\u5668" : ""}`);
        }
      } else if (c.commandType === "garrison" || c.commandType === "trade") {
      } else if (c.commandType === "repair") {
        if (u.kind !== "villager") throw Error("\u53EA\u6709\u6751\u6C11\u80FD\u4FEE\u7406");
      } else if (c.commandType === "stance") {
        if (u.kind === "villager" || u.kind === "monk" || isAnimal(u.kind) || !(u.kind in combatRules.units) || statsOf(u.kind, ownerOf(state, u.player)).attack === "none") throw Error("\u53EA\u6709\u6230\u9B25\u55AE\u4F4D\u6709\u6230\u9B25\u59FF\u614B");
      } else if (c.commandType === "patrol") {
      } else if (c.commandType === "load" || (c.commandType === "gather" || c.commandType === "build" || c.commandType === "construct") && u.kind === "fishing-ship") {
      } else if (c.commandType !== "move" && c.commandType !== "stop" && u.kind !== "villager") throw Error("\u53EA\u6709\u6751\u6C11\u80FD\u63A1\u96C6\u6216\u5EFA\u9020");
    }
    if ((c.commandType === "gather" || c.commandType === "build" || c.commandType === "construct") && new Set(ids.map((id) => state.units.find((u) => u.id === id).kind)).size > 1) throw Error("\u6F01\u8239\u8207\u6751\u6C11\u4E0D\u80FD\u4E00\u8D77\u63A1\u96C6\u6216\u5EFA\u9020");
  }
  if (c.commandType === "move" || c.commandType === "patrol") {
    for (const k of ["x", "y"]) if (!Number.isSafeInteger(c.payload[k]) || c.payload[k] < 50 || c.payload[k] > state.map.size * 100 - 50) throw Error("\u76EE\u6A19\u8D85\u51FA\u5730\u5716");
    if (c.commandType === "move" && c.payload.spread !== void 0 && typeof c.payload.spread !== "boolean") throw Error("\u5206\u6563\u8A2D\u5B9A\u7121\u6548");
  } else if (c.commandType === "stop") {
  } else if (c.commandType === "convert" || c.commandType === "heal" || c.commandType === "relic" || c.commandType === "deposit") {
    const t = riteTarget(c);
    if (t === null) throw Error("\u7121\u6548\u7684\u76EE\u6A19");
    const problem = riteProblem(state, c.playerId, c.commandType, t);
    if (problem) throw Error(problem);
    const ids = c.payload.unitIds;
    if (c.commandType === "convert") {
      if (ids.every((id) => carrying(state, id))) throw Error("\u651C\u5E36\u8056\u7269\u7684\u50E7\u4FB6\u4E0D\u80FD\u8F49\u5316");
      if (ids.every((id) => faithOf(state, id) < 1)) throw Error("\u4FE1\u4EF0\u5C1A\u672A\u6062\u5FA9\uFF1A\u8F49\u5316\u5F8C\u9700\u8981\u4E00\u6BB5\u6642\u9593");
    }
    if (c.commandType === "relic" && ids.every((id) => carrying(state, id))) throw Error("\u9019\u540D\u50E7\u4FB6\u5DF2\u7D93\u651C\u5E36\u8056\u7269");
    if (c.commandType === "deposit" && !ids.some((id) => carrying(state, id))) throw Error("\u6240\u9078\u50E7\u4FB6\u6C92\u6709\u651C\u5E36\u8056\u7269");
  } else if (c.commandType === "attack") {
    const t = c.payload.target;
    if (!t || !["unit", "building"].includes(t.kind)) throw Error("\u7121\u6548\u7684\u653B\u64CA\u76EE\u6A19");
    const problem = targetProblem(state, c.playerId, t);
    if (problem) throw Error(problem);
  } else if (c.commandType === "build") {
    const { kind, x, y, to } = c.payload;
    if (!buildKinds.includes(kind)) throw Error("\u672A\u77E5\u7684\u5EFA\u7BC9\u7A2E\u985E");
    {
      const ship2 = state.units.some((u) => u.id === c.payload.unitIds[0] && u.kind === "fishing-ship");
      if (ship2 !== (kind === "fish-trap")) throw Error(ship2 ? "\u6F01\u8239\u53EA\u80FD\u653E\u7F6E\u9B5A\u7DB2" : "\u9B5A\u7DB2\u53EA\u80FD\u7531\u6F01\u8239\u653E\u7F6E");
    }
    if (to !== void 0 && (!wallKinds.has(kind) || !to || !Number.isSafeInteger(to.x) || !Number.isSafeInteger(to.y) || to.x < 0 || to.y < 0 || to.x >= state.map.size * 100 || to.y >= state.map.size * 100)) throw Error(wallKinds.has(kind) ? "\u57CE\u7246\u7D42\u9EDE\u8D85\u51FA\u5730\u5716" : "\u53EA\u6709\u57CE\u7246\u53EF\u4EE5\u62D6\u66F3\u6210\u4E00\u5217");
    const problem = buildRequirement(state.ages[c.playerId], kind, state.buildings.filter((b) => b.player === c.playerId), state.civs[c.playerId], state.techs[c.playerId], settingsOf(state).allTechs) ?? (to ? wallProblem(state, c.playerId, kind, { x, y }, to) : authoritativeProblem(state, c.playerId, kind, x, y));
    if (problem) throw Error(problem);
    const cost = costOf(kind, ownerOf(state, c.playerId)), stock = state.accounts[c.playerId].stock, short = Object.keys(cost).filter((k) => stock[k] < cost[k]);
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
      for (const k of ["x", "y"]) if (!Number.isSafeInteger(c.payload[k]) || c.payload[k] < 50 || c.payload[k] > state.map.size * 100 - 50) throw Error("\u96C6\u7D50\u9EDE\u8D85\u51FA\u5730\u5716");
      if (!rallyInside(state, b, c.payload) && !clearSegment(state.map, c.payload, c.payload, b.kind === "dock" ? "water" : "land")) throw Error(b.kind === "dock" ? "\u78BC\u982D\u7684\u96C6\u7D50\u9EDE\u8981\u8A2D\u5728\u6C34\u9762\u4E0A" : "\u96C6\u7D50\u9EDE\u4E0D\u80FD\u8A2D\u5728\u5EFA\u7BC9\u3001\u8CC7\u6E90\u6216\u4E0D\u53EF\u901A\u884C\u5730\u5F62\u4E0A");
    }
  } else if (c.commandType === "construct" || c.commandType === "cancelBuild") {
    const b = state.buildings.find((b2) => b2.id === c.payload.buildingId);
    if (!b || b.player !== c.playerId) throw Error("\u627E\u4E0D\u5230\u9019\u68DF\u5DF1\u65B9\u5EFA\u7BC9");
    if (b.complete) throw Error("\u5EFA\u7BC9\u5DF2\u5B8C\u5DE5");
    if (c.commandType === "construct") {
      const ship2 = state.units.some((u) => u.id === c.payload.unitIds[0] && u.kind === "fishing-ship");
      if (ship2 !== (b.kind === "fish-trap")) throw Error(ship2 ? "\u6F01\u8239\u53EA\u80FD\u5EFA\u9020\u9B5A\u7DB2" : "\u9B5A\u7DB2\u53EA\u80FD\u7531\u6F01\u8239\u5EFA\u9020");
    }
  } else if (c.commandType === "gather") {
    const r = typeof c.payload.resourceId === "string" ? state.map.resources.find((r2) => r2.id === c.payload.resourceId) : void 0;
    if (!r || !state.vision[c.playerId].explored.includes(tileAt(r.x, r.y, state.map.size))) throw Error("\u627E\u4E0D\u5230\u9019\u500B\u8CC7\u6E90");
    if (r.kind === "farm" && farmOwner(state, r.id) !== c.playerId) throw Error("\u53EA\u80FD\u8015\u4F5C\u5DF1\u65B9\u7684\u8FB2\u7530");
    if (r.kind === "fish-trap" && farmOwner(state, r.id) !== c.playerId) throw Error("\u53EA\u80FD\u6536\u6210\u5DF1\u65B9\u7684\u9B5A\u7DB2");
    const problem = gatherable(state.map, r.id, layerOf(state.units.find((u) => u.id === c.payload.unitIds[0]).kind));
    if (problem) throw Error(problem);
  } else if (c.commandType === "hunt") {
    if (!Number.isSafeInteger(c.payload.animalId)) throw Error("\u627E\u4E0D\u5230\u9019\u96BB\u52D5\u7269");
    const problem = huntProblem(state, c.playerId, c.payload.animalId);
    if (problem) throw Error(problem);
  } else if (c.commandType === "garrison") {
    const problem = garrisonProblem(state, c.playerId, c.payload.buildingId, c.payload.unitIds);
    if (problem) throw Error(problem);
  } else if (c.commandType === "ungarrison") {
    if (c.payload.unitId !== void 0) {
      const u = Number.isSafeInteger(c.payload.unitId) ? state.units.find((u2) => u2.id === c.payload.unitId) : void 0;
      if (!u || u.player !== c.playerId) throw Error("\u627E\u4E0D\u5230\u9019\u500B\u5DF1\u65B9\u55AE\u4F4D");
      if (!passengers(state, u.id).length) throw Error("\u88E1\u9762\u6C92\u6709\u55AE\u4F4D");
    } else {
      const b = state.buildings.find((b2) => b2.id === c.payload.buildingId);
      if (!b || b.player !== c.playerId) throw Error("\u627E\u4E0D\u5230\u9019\u68DF\u5DF1\u65B9\u5EFA\u7BC9");
      if (!state.garrison[b.id]?.units.length) throw Error("\u5EFA\u7BC9\u88E1\u6C92\u6709\u9032\u99D0\u7684\u55AE\u4F4D");
    }
  } else if (c.commandType === "repair") {
    const problem = repairProblem(state, c.playerId, c.payload.target);
    if (problem) throw Error(problem);
  } else if (c.commandType === "bell") {
    if (typeof c.payload.ring !== "boolean") throw Error("\u9418\u8072\u8A2D\u5B9A\u7121\u6548");
    if (c.payload.ring && !state.buildings.some((b) => b.player === c.playerId && b.complete && b.kind in defenseRules.capacity)) throw Error("\u6C92\u6709\u53EF\u4EE5\u8EB2\u7684\u57CE\u93AE\u4E2D\u5FC3\u3001\u7BAD\u5854\u6216\u57CE\u5821");
  } else if (c.commandType === "stance") {
    if (!stances.includes(c.payload.stance)) throw Error("\u672A\u77E5\u7684\u6230\u9B25\u59FF\u614B");
  } else if (c.commandType === "reseed") {
    if (typeof c.payload.enabled !== "boolean") throw Error("\u81EA\u52D5\u88DC\u7A2E\u8A2D\u5B9A\u7121\u6548");
  } else if (c.commandType === "load") {
    if (!Number.isSafeInteger(c.payload.transportId)) throw Error("\u53EA\u80FD\u767B\u4E0A\u5DF1\u65B9\u7684\u904B\u8F38\u8239");
    const problem = loadProblem(state, c.playerId, c.payload.transportId, c.payload.unitIds);
    if (problem) throw Error(problem);
  } else if (c.commandType === "unload") {
    if (!Number.isSafeInteger(c.payload.transportId)) throw Error("\u627E\u4E0D\u5230\u9019\u8258\u5DF1\u65B9\u904B\u8F38\u8239");
    const problem = unloadProblem(state, c.playerId, c.payload.transportId, c.payload.x, c.payload.y);
    if (problem) throw Error(problem);
  } else if (c.commandType === "resign") {
  } else if (c.commandType === "taunt") {
    const n = c.payload.number;
    if (!Number.isSafeInteger(n) || !tauntOf(n)) throw Error(`\u5632\u8AF7\u7DE8\u865F\u662F 1\u2013${taunts.length}`);
    const last = Math.max(-Infinity, ...state.chat.filter((m) => m.player === c.playerId).map((m) => m.tick), ...state.queue.filter((q) => q.playerId === c.playerId && q.commandType === "taunt").map((q) => q.targetTick));
    if (c.targetTick - last < tauntRules.everyTicks) throw Error("\u5632\u8AF7\u592A\u983B\u7E41\uFF1A\u6BCF\u79D2\u6700\u591A\u4E00\u5247");
  } else if (c.commandType === "market") {
    const problem = marketProblem(state, c.playerId, c.payload.action, c.payload.resource);
    if (problem) throw Error(problem);
  } else if (c.commandType === "trade") {
    const problem = tradeProblem(state, c.playerId, c.payload.unitIds, c.payload.buildingId);
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
    if ("unitIds" in c.payload && Array.isArray(c.payload.unitIds)) {
      const ids = c.payload.unitIds.filter((id) => s.units.some((u) => u.id === id && u.player === c.playerId));
      if (!ids.length) continue;
      c.payload.unitIds = ids;
    }
    if (c.commandType === "reseed") {
      s.reseed[c.playerId] = c.payload.enabled;
      continue;
    }
    if (c.commandType === "ungarrison") {
      if (c.payload.unitId !== void 0) releaseCarried(s, c.payload.unitId);
      else release(s, c.payload.buildingId);
      continue;
    }
    if (c.commandType === "bell") {
      ringBell(s, c.playerId, c.payload.ring);
      continue;
    }
    if (c.commandType === "stance") {
      for (const id of c.payload.unitIds) {
        if (c.payload.stance === "aggressive") delete s.stances[id];
        else s.stances[id] = c.payload.stance;
        if ((c.payload.stance === "passive" || c.payload.stance === "stand") && s.attacks[id]?.auto) delete s.attacks[id];
      }
      continue;
    }
    if ("unitIds" in c.payload && Array.isArray(c.payload.unitIds)) for (const id of c.payload.unitIds) delete s.patrols[id];
    if ("unitIds" in c.payload && Array.isArray(c.payload.unitIds)) for (const id of c.payload.unitIds) {
      delete s.entering[id];
      delete s.trades[id];
    }
    if ("unitIds" in c.payload && Array.isArray(c.payload.unitIds)) clearNaval(s, c.payload.unitIds);
    if (c.commandType === "load") {
      clearWork(s, c.payload.unitIds);
      clearAttacks(s, c.payload.unitIds);
      clearRites(s, c.payload.unitIds);
      if (!loadProblem(s, c.playerId, c.payload.transportId, c.payload.unitIds)) commandLoad(s, c.payload.unitIds, c.payload.transportId);
      else commandStop(s, c.payload.unitIds);
      continue;
    }
    if (c.commandType === "unload") {
      clearNaval(s, [c.payload.transportId]);
      if (!unloadProblem(s, c.playerId, c.payload.transportId, c.payload.x, c.payload.y)) {
        clearAttacks(s, [c.payload.transportId]);
        commandUnload(s, c.payload.transportId, c.payload.x, c.payload.y);
      }
      continue;
    }
    if (c.commandType === "market") {
      const result = { tick: s.tick, playerId: c.playerId, sequence: c.sequence, ok: true };
      try {
        marketTrade(s, c.playerId, c.payload.action, c.payload.resource);
      } catch (e) {
        result.ok = false;
        result.error = e.message;
      }
      s.transactions.push(result);
      continue;
    }
    if (c.commandType === "trade") {
      clearWork(s, c.payload.unitIds);
      clearAttacks(s, c.payload.unitIds);
      clearRites(s, c.payload.unitIds);
      if (!tradeProblem(s, c.playerId, c.payload.unitIds, c.payload.buildingId)) commandTrade(s, c.payload.unitIds, c.payload.buildingId);
      else commandStop(s, c.payload.unitIds);
      continue;
    }
    if (c.commandType === "garrison") {
      clearWork(s, c.payload.unitIds);
      clearAttacks(s, c.payload.unitIds);
      clearRites(s, c.payload.unitIds);
      if (!garrisonProblem(s, c.playerId, c.payload.buildingId, c.payload.unitIds)) commandGarrison(s, c.payload.unitIds, c.payload.buildingId);
      else commandStop(s, c.payload.unitIds);
      continue;
    }
    if (c.commandType === "taunt") {
      s.chat.push({ player: c.playerId, taunt: c.payload.number, tick: s.tick });
      if (s.chat.length > tauntRules.keep) s.chat.splice(0, s.chat.length - tauntRules.keep);
      continue;
    }
    if (c.commandType === "resign") {
      if (!s.outcome) s.outcome = { winner: 1 - c.playerId, defeated: [c.playerId], tick: s.tick, reason: "resign" };
      continue;
    }
    if (c.commandType === "attack") {
      if (!targetProblem(s, c.playerId, c.payload.target)) commandAttack(s, c.payload.unitIds, c.payload.target);
      else {
        clearAttacks(s, c.payload.unitIds);
        commandStop(s, c.payload.unitIds);
      }
      continue;
    }
    if (c.commandType === "convert" || c.commandType === "heal" || c.commandType === "relic" || c.commandType === "deposit") {
      const t = riteTarget(c);
      if (!riteProblem(s, c.playerId, c.commandType, t)) commandRite(s, c.payload.unitIds, c.commandType, t);
      else {
        clearRites(s, c.payload.unitIds);
        commandStop(s, c.payload.unitIds);
      }
      continue;
    }
    if (c.commandType === "move" || c.commandType === "stop" || c.commandType === "gather" || c.commandType === "hunt" || c.commandType === "build" || c.commandType === "construct") {
      clearAttacks(s, c.payload.unitIds);
      clearRites(s, c.payload.unitIds);
    }
    if (c.commandType === "hunt") {
      clearWork(s, c.payload.unitIds);
      if (!huntProblem(s, c.playerId, c.payload.animalId)) commandHunt(s, c.payload.unitIds, c.payload.animalId);
      else commandStop(s, c.payload.unitIds);
      continue;
    }
    if (c.commandType === "move") {
      clearWork(s, c.payload.unitIds);
      commandMove(s, c.payload.unitIds, { x: c.payload.x, y: c.payload.y }, c.payload.spread === true);
      continue;
    }
    if (c.commandType === "patrol") {
      clearWork(s, c.payload.unitIds);
      clearAttacks(s, c.payload.unitIds);
      clearRites(s, c.payload.unitIds);
      const to = { x: c.payload.x, y: c.payload.y };
      try {
        commandMove(s, c.payload.unitIds, to);
      } catch {
        commandStop(s, c.payload.unitIds);
        continue;
      }
      for (const id of c.payload.unitIds) {
        const u = s.units.find((u2) => u2.id === id);
        s.patrols[id] = { from: { x: u.x, y: u.y }, to, leg: "out", wait: tacticsRules.patrolRetry };
      }
      continue;
    }
    if (c.commandType === "stop") {
      clearWork(s, c.payload.unitIds);
      commandStop(s, c.payload.unitIds);
      continue;
    }
    if (c.commandType === "gather") {
      if (!gatherable(s.map, c.payload.resourceId, layerOf(s.units.find((u) => u.id === c.payload.unitIds[0]).kind))) commandGather(s, c.payload.unitIds, c.payload.resourceId);
      else {
        clearWork(s, c.payload.unitIds);
        commandStop(s, c.payload.unitIds);
      }
      continue;
    }
    if (c.commandType === "rally") {
      const b = s.buildings.find((b2) => b2.id === c.payload.buildingId);
      if (b) b.rally = { x: c.payload.x, y: c.payload.y, ...rallyInside(s, b, c.payload) ? { inside: true } : {} };
      continue;
    }
    if (c.commandType === "repair") {
      clearWork(s, c.payload.unitIds);
      clearAttacks(s, c.payload.unitIds);
      clearRites(s, c.payload.unitIds);
      if (!repairProblem(s, c.playerId, c.payload.target)) commandRepair(s, c.payload.unitIds, c.payload.target);
      else commandStop(s, c.payload.unitIds);
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
          const b = c.payload.to ? placeWall(s, c.playerId, c.payload.kind, c.payload, c.payload.to, `${c.playerId}:${c.sequence}`)[0] : placeBuilding(s, c.playerId, c.payload.kind, c.payload.x, c.payload.y, `${c.playerId}:${c.sequence}`);
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
        if (c.commandType === "reserve") reserve(s.accounts[c.playerId], `${c.playerId}:${c.sequence}`, c.payload.entryId, costOf(c.payload.entryId, ownerOf(s, c.playerId)));
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
  stepDefense(s);
  stepNaval(s);
  stepAnimals(s);
  stepReligion(s);
  stepWork(s);
  stepTrade(s);
  stepWonders(s);
  s.reveals = s.reveals.filter((r) => r.until > s.tick);
  updateVision(s.vision, s.map, s.units, s.tick, void 0, sightOf(s), s.reveals, settingsOf(s).reveal === "all");
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
function replay(seed, commands, ticks, layout = "meadow", opponent = "idle", civs = [neutralCiv, neutralCiv], aiOpening = standardOpening, options = {}) {
  if (!Number.isSafeInteger(ticks) || ticks < 0 || ticks > 1e5 || !Array.isArray(commands) || commands.length > 1e4) throw Error("\u7121\u6548\u91CD\u64AD\u7BC4\u570D");
  const s = createState(seed, layout, opponent, civs, aiOpening, options);
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
  return JSON.stringify({ format: "brick-sandbox-33", rulesetHash, state: s, checksum: hash(s) });
}
function deserialize(raw) {
  const v = JSON.parse(raw);
  if (!v || v.format !== "brick-sandbox-33" || v.rulesetHash !== rulesetHash || !v.state || v.checksum !== hash(v.state)) throw Error("\u5B58\u6A94\u7248\u672C\u4E0D\u7B26\u6216\u5167\u5BB9\u640D\u58DE");
  const s = v.state;
  if (s.version !== 33 || s.opponent !== "ai" && s.opponent !== "idle" || !Array.isArray(s.civs) || s.civs.length !== 2 || !s.civs.every(civExists) || !Number.isSafeInteger(s.tick) || s.tick < 0 || s.tick > 1e5 || !Array.isArray(s.log) || s.log.length > 1e4) throw Error("\u7121\u6548\u5B58\u6A94\u72C0\u614B");
  if (typeof s.aiOpening !== "string" || s.aiOpening === randomOpening || !openingChoices.includes(s.aiOpening)) throw Error("\u7121\u6548\u5B58\u6A94\u72C0\u614B");
  let settings;
  try {
    settings = matchSettings(s.settings);
  } catch {
    throw Error("\u7121\u6548\u5B58\u6A94\u72C0\u614B");
  }
  const rebuilt = replay(s.seed, s.log, s.tick, s.layout, s.opponent, s.civs, s.aiOpening, settings);
  if (hash(rebuilt) !== hash(s)) throw Error("\u5B58\u6A94\u72C0\u614B\u7121\u6CD5\u7531\u547D\u4EE4\u91CD\u5EFA");
  return structuredClone(s);
}

// packages/sim/protocol.ts
var UNIT_STRIDE = 19;
var STRIDE = UNIT_STRIDE;
function navalView(state) {
  const o = ownerOf(state, 0), hp = (u) => maxHpOf(u.kind, ownerOf(state, u.player));
  return {
    market: { prices: { ...state.market }, fee: marketQuote(state.market, o, "food").fee },
    transports: state.units.filter((u) => u.player === 0 && (u.kind === "transport-ship" || u.kind === "ram")).map((t) => ({ id: t.id, capacity: capacityOf(state, t), passengers: passengers(state, t.id).map((p) => ({ id: p.id, kind: p.kind, hp: p.hp, maxHp: hp(p) })) })),
    trades: Object.entries(state.trades).map(([id, t]) => ({ id: Number(id), t, u: state.units.find((u) => u.id === Number(id)) })).filter((v) => v.u?.player === 0).map(({ id, t, u }) => {
      const a = state.map.obstacles.find((o2) => o2.id === t.home), b = state.map.obstacles.find((o2) => o2.id === t.target);
      return { unitId: id, home: t.home, target: t.target, leg: t.leg, gold: a && b ? tradeGold(state, u.kind, obstacleBounds(a), obstacleBounds(b)) : 0 };
    }),
    wonders: Object.entries(state.wonders).flatMap(([id, endsTick]) => {
      const b = state.buildings.find((b2) => b2.id === id);
      return b ? [{ player: b.player, building: id, x: b.x, y: b.y, endsTick }] : [];
    }).sort((a, b) => a.endsTick - b.endsTick),
    wonderVictory: state.wonderVictory ? { ...state.wonderVictory } : null,
    chat: state.chat.map((m) => ({ ...m })),
    repairs: Object.entries(state.works).flatMap(([id, w2]) => {
      const r = w2;
      return r.kind === "repair" && r.target && state.units.some((u) => u.id === Number(id) && u.player === 0) ? [{ villager: Number(id), target: { ...r.target } }] : [];
    })
  };
}
function createService(initial) {
  let state = initial ?? createState(260925), lastId = 0;
  return (raw) => {
    const req = raw;
    try {
      if (!req || req.protocol !== 1 || !Number.isSafeInteger(req.id) || req.id <= lastId) throw Error("\u8A0A\u606F\u7248\u672C\u6216 request ID \u7121\u6548");
      lastId = req.id;
      const op = req.operation;
      if (!op || typeof op.kind !== "string") throw Error("\u7F3A\u5C11 operation");
      let accepted, commands, snapshot, replayMatches;
      switch (op.kind) {
        case "stance":
        case "patrol":
        case "repair":
        case "taunt":
        case "market":
        case "trade":
        case "load":
        case "unload":
        case "garrison":
        case "ungarrison":
        case "bell":
        case "reseed":
        case "hunt":
        case "convert":
        case "heal":
        case "relic":
        case "deposit":
        case "resign":
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
            const command = op.kind === "stance" ? { ...envelope, commandType: "stance", payload: { unitIds: op.unitIds, stance: op.stance } } : op.kind === "patrol" ? { ...envelope, commandType: "patrol", payload: { unitIds: op.unitIds, x: op.x, y: op.y } } : op.kind === "taunt" ? { ...envelope, commandType: "taunt", payload: { number: op.number } } : op.kind === "load" ? { ...envelope, commandType: "load", payload: { unitIds: op.unitIds, transportId: op.transportId } } : op.kind === "unload" ? { ...envelope, commandType: "unload", payload: { transportId: op.transportId, x: op.x, y: op.y } } : op.kind === "garrison" ? { ...envelope, commandType: "garrison", payload: { unitIds: op.unitIds, buildingId: op.buildingId } } : op.kind === "ungarrison" ? { ...envelope, commandType: "ungarrison", payload: op.unitId !== void 0 ? { unitId: op.unitId } : { buildingId: op.buildingId } } : op.kind === "repair" ? { ...envelope, commandType: "repair", payload: { unitIds: op.unitIds, target: op.target } } : op.kind === "bell" ? { ...envelope, commandType: "bell", payload: { ring: op.ring } } : op.kind === "reseed" ? { ...envelope, commandType: "reseed", payload: { enabled: op.enabled } } : op.kind === "hunt" ? { ...envelope, commandType: "hunt", payload: { unitIds: op.unitIds, animalId: op.animalId } } : op.kind === "convert" || op.kind === "heal" ? { ...envelope, commandType: op.kind, payload: op.buildingId !== void 0 ? { unitIds: op.unitIds, buildingId: op.buildingId } : { unitIds: op.unitIds, targetId: op.targetId } } : op.kind === "relic" ? { ...envelope, commandType: "relic", payload: { unitIds: op.unitIds, relicId: op.relicId } } : op.kind === "deposit" ? { ...envelope, commandType: "deposit", payload: { unitIds: op.unitIds, buildingId: op.buildingId } } : op.kind === "resign" ? { ...envelope, commandType: "resign", payload: {} } : op.kind === "attack" ? { ...envelope, commandType: "attack", payload: { unitIds: op.unitIds, target: op.target } } : op.kind === "move" ? { ...envelope, commandType: "move", payload: { unitIds: op.unitIds, x: op.x, y: op.y, ...op.spread ? { spread: true } : {} } } : op.kind === "gather" ? { ...envelope, commandType: "gather", payload: { unitIds: op.unitIds, resourceId: op.resourceId } } : op.kind === "build" ? { ...envelope, commandType: "build", payload: { unitIds: op.unitIds, kind: op.building, x: op.x, y: op.y, ...op.to ? { to: { x: op.to.x, y: op.to.y } } : {} } } : op.kind === "market" ? { ...envelope, commandType: "market", payload: { action: op.action, resource: op.resource } } : op.kind === "trade" ? { ...envelope, commandType: "trade", payload: { unitIds: op.unitIds, buildingId: op.buildingId } } : op.kind === "construct" ? { ...envelope, commandType: "construct", payload: { unitIds: op.unitIds, buildingId: op.buildingId } } : op.kind === "cancelBuild" ? { ...envelope, commandType: "cancelBuild", payload: { buildingId: op.buildingId } } : op.kind === "train" ? { ...envelope, commandType: "train", payload: { buildingId: op.buildingId, entryId: op.entryId } } : op.kind === "cancelTrain" ? { ...envelope, commandType: "cancelTrain", payload: { buildingId: op.buildingId, itemId: op.itemId } } : op.kind === "rally" ? { ...envelope, commandType: "rally", payload: { buildingId: op.buildingId, x: op.x, y: op.y } } : { ...envelope, commandType: "stop", payload: { unitIds: op.unitIds } };
            submit(state, command);
            accepted = command;
          }
          break;
        case "advance":
          if (!Number.isSafeInteger(op.count) || op.count < 1 || op.count > 80 || state.tick + op.count > 1e5) throw Error("\u6B65\u9032\u9700\u70BA 1\u201380 ticks\uFF0C\u7E3D\u91CF\u4E0D\u5F97\u8D85\u904E 100000");
          for (let i = 0; i < op.count; i++) tick(state);
          break;
        case "reset":
          state = createState(op.seed, op.layout, op.opponent, op.civs, op.aiOpening, op.settings ?? {});
          commands = [];
          break;
        case "restore":
          state = deserialize(op.snapshot);
          commands = structuredClone(state.log);
          break;
        case "recover": {
          if (!op.checkpoint) throw Error("\u7F3A\u5C11\u6062\u5FA9\u9EDE");
          const candidate = replay(op.checkpoint.seed, op.checkpoint.commands, op.checkpoint.ticks, op.checkpoint.layout, op.checkpoint.opponent, op.checkpoint.civs, op.checkpoint.aiOpening, op.checkpoint.settings ?? {});
          state = candidate;
          commands = structuredClone(state.log);
          break;
        }
        case "snapshot":
          snapshot = serialize(state);
          break;
        case "replay":
          replayMatches = hash(replay(state.seed, state.log, state.tick, state.layout, state.opponent, state.civs, state.aiOpening, state.settings)) === hash(state);
          break;
        default:
          throw Error("\u4E0D\u652F\u63F4\u7684 operation");
      }
      const visibleUnits = state.units.filter((u) => unitVisible(state.vision[0], u, 0, state.map.size));
      const positions = new Int32Array(visibleUnits.length * STRIDE);
      visibleUnits.forEach((u, i) => {
        const own = u.player === 0, w2 = own ? state.works[u.id] : void 0, c = own ? state.cargo[u.id] : void 0;
        const src = w2?.kind === "gather" && w2.phase === "gathering" ? state.map.resources.find((r) => r.id === w2.resourceId) : void 0, box = src?.obstacleId ? state.map.obstacles.find((o) => o.id === src.obstacleId) : void 0, [bx0, by0, bx1, by1] = box ? obstacleBounds(box) : [0, 0, 0, 0];
        const fight = state.attacks[u.id], foe = fight?.target.kind === "unit" ? state.units.find((v) => v.id === fight.target.id) : void 0, site3 = fight?.target.kind === "building" ? state.map.obstacles.find((o) => o.id === fight.target.id) : void 0, sb = site3 ? obstacleBounds(site3) : null;
        const flock2 = state.rites[u.id] ? state.units.find((v) => v.id === state.rites[u.id].target) : void 0;
        const prey = w2?.kind === "gather" && w2.prey !== void 0 ? state.units.find((v) => v.id === w2.prey) : state.beasts[u.id] ? state.units.find((v) => v.id === state.beasts[u.id].foe) : void 0;
        const target = box ? { x: Math.round((bx0 + bx1) / 2), y: Math.round((by0 + by1) / 2) } : src ? { x: src.x, y: src.y } : prey ? { x: prey.x, y: prey.y } : foe ? { x: foe.x, y: foe.y } : flock2 ? { x: flock2.x, y: flock2.y } : sb ? { x: Math.round((sb[0] + sb[2]) / 2), y: Math.round((sb[1] + sb[3]) / 2) } : u.target;
        const rite = state.rites[u.id], beast = state.beasts[u.id], action = fight && fight.firedTick >= 0 && state.tick - fight.firedTick < 10 || u.kind === "boar" && beast && beast.cooldown > combatRules.units.boar.cooldown - 10 || w2?.kind === "gather" && w2.phase === "hunting" && w2.progress > animalRules.hunt.cooldown - 10 ? 1 : u.hitTick >= 0 && state.tick - u.hitTick < combatRules.hitFlashTicks ? 2 : 0;
        positions.set([u.id, u.player, u.x, u.y, target?.x ?? -1, target?.y ?? -1, navigationStates.indexOf(u.navigation), w2 ? workPhases.indexOf(w2.phase) : 0, c ? resources.indexOf(c.resource) : -1, c?.amount ?? 0, w2?.kind === "gather" ? resources.indexOf(w2.prey !== void 0 ? "food" : resourceDefinitions[state.map.resources.find((r) => r.id === w2.resourceId)?.kind ?? "berries"].yield) : -1, unitKinds.indexOf(u.kind), u.hp, maxHpOf(u.kind, ownerOf(state, u.player)), action, rite?.kind === "convert" ? 1 : rite?.kind === "heal" ? 2 : 0, own && u.kind === "monk" ? Math.floor(faithOf(state, u.id) * 100) : -1, carrying(state, u.id) ? 1 : 0, state.setups[u.id]?.unpacked ? 1 : 0], i * STRIDE);
      });
      const account = state.accounts[0], economy = { stock: { ...account.stock }, populationUsed: account.populationUsed, populationReserved: account.populationReserved, populationCap: account.populationCap, age: state.ages[0], techs: [...state.techs[0]], reseed: state.reseed[0] };
      return {
        protocol: 1,
        id: req.id,
        ok: true,
        settings: settingsOf(state),
        aiOpening: state.aiOpening,
        coach: openingView(state, 0),
        seed: state.seed,
        layout: state.layout,
        size: state.map.size,
        opponent: state.opponent,
        civs: [...state.civs],
        terrain: state.map.tiles.map(({ terrainType, height, walkClass, buildability }) => ({ terrainType, height, walkClass, buildability })),
        tick: state.tick,
        stateHash: hash(state),
        positions: positions.buffer,
        economy,
        corpses: state.corpses.filter((c) => c.player === 0 || state.vision[0].visible.includes(tileAt(c.x, c.y, state.map.size))).map((c) => ({ ...c })),
        outcome: state.outcome ? { ...state.outcome } : null,
        buildings: state.buildings.filter((b) => b.player === 0).map(({ id, kind, x, y, work, required, complete, queue, rally, hp, maxHp: maxHp2 }) => ({ id, kind, x, y, work, required, complete, hp, maxHp: maxHp2, garrison: state.garrison[id]?.units.length ?? 0, capacity: garrisonCapacity(state, { kind, player: 0 }), belled: state.garrison[id]?.units.filter((e) => e.bell).length ?? 0, queue: queue.map(({ id: id2, entryId, work: work2, required: required2 }) => ({ id: id2, entryId, work: work2, required: required2 })), rally, relics: state.relics.filter((r) => r.monastery === id).length, inside: (state.garrison[id]?.units ?? []).map(({ unit: u }) => ({ id: u.id, kind: u.kind, hp: u.hp, maxHp: maxHpOf(u.kind, ownerOf(state, u.player)) })) })),
        relicSpots: state.relicMemory[0].map((r) => ({ ...r })),
        relicsHeld: [0, 1].map((p) => state.relics.filter((r) => r.monastery !== null && state.buildings.find((b) => b.id === r.monastery)?.player === p).length),
        relicTotal: state.relics.length,
        relicVictory: state.relicVictory ? { ...state.relicVictory } : null,
        projectiles: state.projectiles.filter((p) => p.player === 0 || state.vision[0].visible.includes(tileAt(Math.round(p.x), Math.round(p.y), state.map.size))).map((p) => ({ id: p.id, from: { ...p.from }, x: Math.round(p.x), y: Math.round(p.y), to: { ...p.to }, player: p.player, kind: p.kind })),
        stances: Object.fromEntries(Object.entries(state.stances).filter(([id]) => state.units.some((u) => u.id === Number(id) && u.player === 0))),
        patrols: Object.fromEntries(Object.entries(state.patrols).filter(([id]) => state.units.some((u) => u.id === Number(id) && u.player === 0)).map(([id, p]) => [id, { from: { ...p.from }, to: { ...p.to } }])),
        shots: state.shots.filter((v) => v.player === 0 || state.vision[0].visible.includes(tileAt(v.to.x, v.to.y, state.map.size)) || state.vision[0].visible.includes(tileAt(v.from.x, v.from.y, state.map.size))).map((v) => structuredClone(v)),
        ...navalView(state),
        transactions: state.transactions.filter((t) => t.playerId === 0).slice(-5).map(({ sequence, tick: tick2, ok, error }) => ({ sequence, tick: tick2, ok, ...error ? { error } : {} })),
        ...projectVision(state.vision[0], state.map.size),
        accepted,
        commands,
        snapshot,
        replayMatches
      };
    } catch (error) {
      return { protocol: 1, id: Number.isSafeInteger(req?.id) ? req.id : 0, ok: false, tick: state.tick, message: error.message, entityId: ["garrison", "hunt", "attack", "move", "stop", "gather", "build", "construct", "convert", "heal", "relic", "deposit"].includes(req?.operation?.kind) ? req.operation.unitIds?.[0] : void 0 };
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
