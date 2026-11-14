// 從 assets/286/auto-worker465.js 與封包 manifest 萃取說話之島（地圖 0~3）世界與精靈中繼資料
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const gameRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(gameRoot, '../..');
const assetsRoot = path.join(repoRoot, 'assets/286');
const outPath = path.join(gameRoot, 'src/data/talking-island.json');

const art = JSON.parse(fs.readFileSync(path.join(assetsRoot, 'art-assets.json'), 'utf8'));
const byPath = new Map(art.assets.map((a) => [a[0], a]));

function readPackBytes(relPath) {
  const entry = byPath.get(relPath);
  if (entry) {
    const pack = art.packs[entry[3]];
    const fd = fs.openSync(path.join(assetsRoot, 'packs', pack.file), 'r');
    const buf = Buffer.alloc(entry[2]);
    fs.readSync(fd, buf, 0, entry[2], entry[4]);
    fs.closeSync(fd);
    return buf;
  }
  const disk = path.join(assetsRoot, relPath.replace(/^\//, ''));
  return fs.existsSync(disk) ? fs.readFileSync(disk) : null;
}

function readJson(relPath) {
  const b = readPackBytes(relPath);
  return b ? JSON.parse(b.toString('utf8')) : null;
}

function webpDims(b) {
  if (!b) return null;
  if (b.slice(0, 4).toString() === 'RIFF' && b.slice(8, 12).toString() === 'WEBP') {
    if (b.slice(12, 16).toString() === 'VP8X') return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
    if (b.slice(12, 16).toString() === 'VP8L') {
      const bits = b.readUInt32LE(21);
      return [(bits & 0x3fff) + 1, ((bits >> 14) & 0x3fff) + 1];
    }
    if (b.slice(12, 16).toString() === 'VP8 ') return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
  }
  if (b.slice(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    return [b.readUInt32BE(16), b.readUInt32BE(20)];
  }
  return null;
}

let aw = fs.readFileSync(path.join(assetsRoot, 'auto-worker465.js'), 'utf8');
aw = aw.replace(
  /\}\)\(\);\s*$/,
  ';globalThis.__EXP={C,oA,_E,s,o,D,t,i,w,sE,HA,SA,iE};})();',
);
const sandbox = {
  postMessage: () => {},
  setInterval: () => 0,
  clearInterval: () => {},
  onmessage: null,
  globalThis: null,
  Math,
  Date,
  JSON,
  Object,
  Array,
  Map,
  Set,
  Number,
  String,
  Boolean,
  RegExp,
  Error,
  atob: (b) => Buffer.from(b, 'base64').toString('binary'),
};
sandbox.globalThis = sandbox;
vm.runInNewContext(aw, sandbox);
const E = sandbox.__EXP;

const TARGET_MAPS = new Set([0, 1, 2, 3]);
const releaseScope = JSON.parse(
  fs.readFileSync(path.join(gameRoot, 'src/data/captured/release-scope.json'), 'utf8'),
);

// 1. 地圖 0~3 碰撞區塊（僅萃取必要地圖，大幅縮小體積）
const collision = {};
for (const [k, v] of Object.entries(E.C)) {
  const mId = Number(k.split('/')[0]);
  if (TARGET_MAPS.has(mId)) collision[k] = v;
}

// 2. 地圖 0~3 傳送點
const portals = E.oA
  .filter((p) => TARGET_MAPS.has(Number(p.locM)) && TARGET_MAPS.has(Number(p.gotoM)))
  .map((p) => ({
    id: p.uid,
    map: Number(p.locM),
    x: Number(p.locX),
    y: Number(p.locY),
    toMap: Number(p.gotoM),
    toX: Number(p.gotoX),
    toY: Number(p.gotoY),
    heading: Number(p.gotoH || 4),
  }));

// 3. 怪物刷怪點與港口克特/闇騎士補遺事件
const spawns = E._E
  .filter((sp) => TARGET_MAPS.has(Number(sp.map)))
  .map((sp) => ({
    id: String(sp.id),
    name: sp.name,
    map: Number(sp.map),
    x: Number(sp.x),
    y: Number(sp.y),
    count: Math.max(1, Number(sp.count || 1)),
    size: Number(sp.size || 6),
    respawnMs: Math.max(8000, Number(sp.respawn || 30000)),
    villageAnimal: Boolean(sp.villageAnimal),
  }));

for (const sup of releaseScope.supplementalEncounters || []) {
  if (TARGET_MAPS.has(Number(sup.map))) {
    const counts = {};
    for (const mName of sup.members || []) counts[mName] = (counts[mName] || 0) + 1;
    Object.entries(counts).forEach(([mName, cnt], idx) => {
      spawns.push({
        id: `${sup.id}-${idx}`,
        name: mName,
        map: Number(sup.map),
        x: Number(sup.x) + (idx === 0 ? 0 : 1),
        y: Number(sup.y) + (idx === 0 ? 0 : 1),
        count: cnt,
        size: Math.max(3, Number(sup.spread || 3)),
        respawnMs: 120000,
        villageAnimal: false,
        boss: mName === '克德',
      });
    });
  }
}

// 4. 說話之島怪物定義與掉落表
const mobNames = new Set(spawns.map((sp) => sp.name));
const monsters = {};
for (const mName of mobNames) {
  const m = E.s[mName];
  if (!m) continue;
  monsters[mName] = {
    name: m.name,
    gfx: Number(m.gfx),
    level: Number(m.level || 1),
    hp: Number(m.hp || 20),
    mp: Number(m.mp || 0),
    ac: Number(m.ac || 10),
    str: Number(m.str || 8),
    exp: Math.max(1, Number(m.exp || 5)),
    lawful: Number(m.lawful || 0),
    range: Math.max(1, Number(m.range || m.atk_range || 1)),
    aggressive: Boolean(m.aggressive),
    aden: Boolean(m.aden),
    arrowGfx: Number(m.arrowGfx || 0),
    isPassiveCritter: ['鹿', '白兔', '灰兔', '青蛙'].includes(m.name),
  };
}

const drops = {};
for (const d of E.iE) {
  const mName = d.monster_name || d.name;
  if (!mobNames.has(mName)) continue;
  if (!drops[mName]) drops[mName] = [];
  drops[mName].push({
    item: d.item_name,
    min: Math.max(1, Number(d.count_min || 1)),
    max: Math.max(1, Number(d.count_max || 1)),
    chance: Math.max(1, Number(d.chance || 10000)),
  });
}

// 5. 地圖 0~3 NPC 與商店
const NPC_GFX_FALLBACK = {
  143: 54, // 朵琳（矮人倉庫）
  984: 237, // 凱瑟（傳送師）
  147: 940, // 港口主人（船長）
};
const npcs = E.o
  .filter((n) => TARGET_MAPS.has(Number(n.map)))
  .map((n) => ({
    id: n.id,
    name: n.name,
    map: Number(n.map),
    x: Number(n.mx),
    y: Number(n.my),
    gfx: Number(n.sprite),
    renderGfx: NPC_GFX_FALLBACK[Number(n.sprite)] ?? Number(n.sprite),
    heading: Number(n.heading || 4) % 8,
    type: n.type,
    shop: Boolean(n.shop),
  }));

const npcNameSet = new Set(npcs.map((n) => n.name));
const shops = {};
for (const row of E.i) {
  if (!npcNameSet.has(row.npc) || !row.sell) continue;
  if (!shops[row.npc]) shops[row.npc] = [];
  const itemDef = E.t[row.item];
  const unitPrice = row.price > 0 ? row.price : Math.max(1, Number(itemDef?.price || 10));
  if (!shops[row.npc].some((x) => x.item === row.item && x.plus === row.plus)) {
    shops[row.npc].push({
      item: row.item,
      count: Number(row.count || 1),
      plus: Number(row.plus || 0),
      price: unitPrice,
    });
  }
}

// 6. 道具表（包含初始裝備、消耗品、卷軸、掉落物、商店商品）
const neededItems = new Set([
  '金幣',
  '匕首',
  '短劍',
  '長劍',
  '雙手劍',
  '大馬士革刀',
  '銀長劍',
  '彎刀',
  '闊劍',
  '奧里哈魯根短劍',
  '武士刀',
  '細劍',
  '短弓',
  '獵人之弓',
  '十字弓',
  '妖魔弓',
  '精靈弓',
  '尤米弓',
  '箭',
  '銀箭',
  '米索莉箭',
  '木棒',
  '魔杖',
  '水晶魔杖',
  '瑪那魔杖',
  '皮夾克',
  '皮甲',
  '銀釘皮甲',
  '鎖子甲',
  '環甲',
  '藤甲',
  '青銅盔甲',
  '金屬盔甲',
  '鋼鐵金屬盔甲',
  '精靈鏈甲',
  '皮帽',
  '鋼盔',
  '騎士面甲',
  '皮盾',
  '小盾牌',
  '大盾牌',
  '銀盾',
  '精靈盾牌',
  '塔盾',
  '斗篷',
  '抗魔法斗篷',
  '保護斗篷',
  '短統靴',
  '長靴',
  '鋼鐵長靴',
  '皮手套',
  '手套',
  '紅色藥水',
  '橙色藥水',
  '白色藥水',
  '綠色藥水',
  '自我加速藥水',
  '勇敢藥水',
  '藍色藥水',
  '翡翠藥水',
  '慎重藥水',
  '解毒藥水',
  '蠟燭',
  '瞬間移動的卷軸',
  '傳送回家的卷軸',
  '血盟傳送卷軸',
  '對武器施法的卷軸',
  '對盔甲施法的卷軸',
  '解除咀咒的卷軸',
  '鑑定卷軸',
  '變形卷軸',
  '復活卷軸',
  '魔法寶石',
  '內掛符石',
  '喝水符石',
  '骨頭碎片',
  '皮革',
  '高級皮革',
]);
for (const rows of Object.values(shops)) for (const r of rows) neededItems.add(r.item);
for (const rows of Object.values(drops)) for (const r of rows) neededItems.add(r.item);
for (const key of ['royal', 'knight', 'elf', 'wizard']) {
  const raw = E.w[`${key}_first_inventory`] || '';
  for (const part of raw.split(',')) {
    const name = part.replace(/\(\d+\)$/, '').trim();
    if (name) neededItems.add(name);
  }
}

const groundJson = readJson('/lineage163/ground-items79.json') || {};
const groundPackedSet = new Set(
  art.assets
    .map((a) => a[0])
    .filter((p) => p.startsWith('/lineage163/ground-items79/'))
    .map((p) => p.split('/').pop().replace(/\..+$/, '')),
);

const items = {};
for (const name of neededItems) {
  const it = E.t[name];
  if (!it) continue;
  const spStr = String(it.sprite ?? '');
  items[name] = {
    name: it.name,
    kind: it.kind,
    type: it.type,
    small: Number(it.small || 0),
    large: Number(it.large || 0),
    ac: Number(it.ac || 0),
    hit: Number(it.hit || 0),
    damage: Number(it.damage || 0),
    safe: Number(it.safe || 0),
    enchant: Boolean(it.enchant),
    stack: Boolean(it.stack),
    twoHand: Boolean(it.twoHand),
    weight: Number(it.weight || 0),
    price: Number(it.price || 0),
    icon: Number(it.icon || 0),
    groundGfx: groundPackedSet.has(spStr) ? Number(spStr) : null,
    effect: Number(it.effect || 0),
    classes: Array.isArray(it.classes) ? it.classes : [1, 1, 1, 1],
    hp: Number(it.hp || 0),
    mp: Number(it.mp || 0),
    sp: Number(it.sp || 0),
    mr: Number(it.mr || 0),
    str: Number(it.str || 0),
    dex: Number(it.dex || 0),
    regenHp: Number(it.regenHp || 0),
    regenMp: Number(it.regenMp || 0),
  };
}

// 7. 法術（1~6 級經典法術）
const effectJson = readJson('/lineage163/effects.json') || {};
const spells = E.D.filter((sp) => Number(sp['사용레벨'] || 99) <= 6)
  .map((sp) => {
    const id = Number(sp['마법아이디']);
    const eff = Number(sp['이팩트'] || 0);
    return {
      id,
      name: sp['마법이름'],
      level: Number(sp['사용레벨']),
      mp: Number(sp['소모MP'] || 0),
      hp: Number(sp['소모HP'] || 0),
      duration: Number(sp['버프지속시간'] || 0),
      minDmg: Number(sp['최소데미지'] || 0),
      maxDmg: Number(sp['최대데미지'] || 0),
      range: Number(sp['범위'] || 0),
      delay: Number(sp.delay || 800),
      element: sp.element || 'none',
      effect: effectJson[String(eff)] ? eff : 167,
      hasIcon: byPath.has(`/lineage163/all-magic-v2/${id}.png`),
    };
  });

// 8. 職業初始與成長
const classMap = {
  royal: { id: 'royal', clsIdx: 0, prefix: 'royal' },
  knight: { id: 'knight', clsIdx: 1, prefix: 'knight' },
  elf: { id: 'elf', clsIdx: 2, prefix: 'elf' },
  mage: { id: 'mage', clsIdx: 3, prefix: 'wizard' },
};
const classes = {};
for (const [id, info] of Object.entries(classMap)) {
  const p = info.prefix;
  const [sx, sy, sm] = String(E.w[`${p}_spawn`] || '32578 32943 0')
    .split(/\s+/)
    .map(Number);
  const invRaw = String(E.w[`${p}_first_inventory`] || '');
  const startItems = invRaw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const m = s.match(/^(.+)\((\d+)\)$/);
      return m ? { name: m[1].trim(), count: Number(m[2]) } : { name: s, count: 1 };
    });
  classes[id] = {
    id,
    clsIdx: info.clsIdx,
    spawn: { map: sm || 0, x: sx || 32578, y: sy || 32943 },
    maleGfx: Number(E.w[`${p}_male_gfx`]),
    femaleGfx: Number(E.w[`${p}_female_gfx`]),
    baseHp: Number(E.w[`${p}_hp`] || 14),
    baseMp: Number(E.w[`${p}_mp`] || 2),
    maxHpCap: Number(E.w[`${p}_max_hp`] || 1000),
    maxMpCap: Number(E.w[`${p}_max_mp`] || 600),
    stats: {
      str: Number(E.w[`${p}_stat_str`] || 12),
      con: Number(E.w[`${p}_stat_con`] || 12),
      dex: Number(E.w[`${p}_stat_dex`] || 10),
      wis: Number(E.w[`${p}_stat_wis`] || 10),
      cha: Number(E.w[`${p}_stat_cha`] || 10),
      int: Number(E.w[`${p}_stat_int`] || 10),
    },
    startItems,
  };
}

// 9. 地圖 0~3 景物/房屋/圍籬重繪查找表 & 地圖區塊清單
const mapsJson = readJson('/lineage163/maps.json') || {};
const retainedChunks = {};
for (const mId of TARGET_MAPS) {
  retainedChunks[String(mId)] = mapsJson[String(mId)] || [];
}

function pickChunks(manifestPath) {
  const man = readJson(manifestPath);
  const out = {};
  if (!man?.chunks) return out;
  for (const [ck, cv] of Object.entries(man.chunks)) {
    const mId = Number(ck.split('/')[0]);
    if (TARGET_MAPS.has(mId)) out[ck] = cv;
  }
  return out;
}

const redrawLayers = {
  houses: pickChunks('/lineage163/village-houses-v3/manifest.json'),
  fences: pickChunks('/lineage163/fences-trees-v1/manifest.json'),
  scenery: pickChunks('/lineage163/scenery-redraw-v1/manifest.json'),
  village: pickChunks('/lineage163/village-redraw-v3/manifest.json'),
};

// 10. 精靈目錄與幾何查找（包含 8 個主角外觀與所有說話之島怪物/NPC）
const playerAtlasesFull = readJson('/lineage163/player-atlases.json') || {};
const seqJson = readJson('/lineage163/sequences.json') || {};
const motJson = readJson('/lineage163/motions.json') || {};
const actorsJson = readJson('/lineage163/actors.json') || {};
const geom71 = readJson('/lineage163/actor-geometry71.json') || {};
const animSoundsJson = readJson('/lineage163/animation-sounds.json') || {};

const playerGfxList = [0, 1, 61, 48, 138, 37, 734, 1186];
const neededGfx = new Set([
  ...playerGfxList,
  ...Object.values(monsters).map((m) => m.gfx),
  ...npcs.map((n) => n.renderGfx),
]);

// 先收集每個 gfx 在哪個封包目錄
const gfxDirCandidates = new Map();
for (const p of byPath.keys()) {
  const m = p.match(/^\/lineage163\/([^/]+)\/(\d+)-(\d+)\.(webp|png)$/);
  if (!m) continue;
  const [, dir, gStr, actStr, ext] = m;
  const g = Number(gStr);
  if (!neededGfx.has(g)) continue;
  if (!gfxDirCandidates.has(g)) gfxDirCandidates.set(g, new Map());
  const byDir = gfxDirCandidates.get(g);
  if (!byDir.has(dir)) byDir.set(dir, {});
  byDir.get(dir)[Number(actStr)] = ext;
}

const CUSTOM_DIR_PRIORITY = [
  'goblin-full-animation-v2',
  'orc-beast-v7',
  'orc-archer-beast-v1',
  'orc-warrior-full-v12',
  'orc-amethyst-v3',
  'frog-native-animation-v2',
  'floating-demon-eye-full-v7',
  'white-robed-sorcerer-v1',
  'shargo-v2-animation',
  'living-dead-native-v18',
  'rock-monster-full-v1',
  'werewolf-v9-lean-humanoid-v1',
  'slime-pink-death-v6',
  'skull-bone-native-v4',
  'skull-bone-archer-v1',
  'corpse-devourer-full-v4',
  'sparto-native-v3',
  'gnome-animation-v2',
  'wolf-slate-animation-v5',
  'doberman-v4-animation',
  'rabbit-two-colors-v2',
  'deer-natural-edge-v3',
  'kede-shield-v1',
  'dark-knight-shield-v6',
  'guards-fitted-silver-v5',
  'jansen-animation-v2',
  'basin-animation-v2',
  'selena-animation-v2',
  'judith-animation-v2',
  'lian-animation-v2',
  'mona-animation-v2',
  'fin-animation-v2',
  'ladar-animation-v2',
  'lucas-animation-v2',
  'geren-animation-v2',
  'touma-animation-v2',
  'farin-animation-v2',
  'pandora-animation-v2',
  'training-dummy-native-v2',
];

const spriteMeta = {};
for (const g of neededGfx) {
  const gStr = String(g);
  const info = {
    gfx: g,
    kind: playerGfxList.includes(g) ? 'player' : 'actor',
    dir: null,
    acts: {},
    geom: {},
    seq: seqJson[gStr] || null,
    mot: motJson[gStr] || null,
    sounds: animSoundsJson[gStr] || null,
  };

  if (info.kind === 'player') {
    const atl = {};
    for (const [k, v] of Object.entries(playerAtlasesFull)) {
      if (k.startsWith(gStr + '-')) {
        atl[k.slice(gStr.length + 1)] = {
          f: v.file,
          r: v.rects,
          w: v.width || 128,
          h: v.height || 160,
          x: v.x ?? -64,
          y: v.y ?? -148,
        };
      }
    }
    info.atlas = atl;
  } else {
    const byDir = gfxDirCandidates.get(g) || new Map();
    const chosenDir =
      CUSTOM_DIR_PRIORITY.find((d) => byDir.has(d)) ||
      [...byDir.keys()].find((d) => d !== 'creatures600' && d !== 'actors-webp' && d !== 'actors-full') ||
      [...byDir.keys()][0] ||
      null;
    info.dir = chosenDir;
    const actMap = chosenDir ? byDir.get(chosenDir) : {};
    info.acts = actMap;
    const dirGeom = chosenDir ? readJson(`/lineage163/${chosenDir}/geometry.json`) : null;
    for (const [actStr, ext] of Object.entries(actMap)) {
      const aKey = `${g}-${actStr}`;
      const frames = Number(E.HA[aKey] || actorsJson[aKey] || 0);
      let gEntry = E.SA[aKey] || geom71[aKey] || null;
      if (!gEntry && dirGeom) {
        gEntry = dirGeom[aKey] || dirGeom[Object.keys(dirGeom).find((k) => k.endsWith('-' + actStr))] || null;
      }
      if (gEntry) {
        info.geom[actStr] = {
          w: gEntry.width,
          h: gEntry.height,
          x: gEntry.x,
          y: gEntry.y,
          n: Number(gEntry.frames || frames || 1),
        };
      } else {
        const dims = webpDims(readPackBytes(`/lineage163/${chosenDir}/${g}-${actStr}.${ext}`));
        let n = frames;
        if (!n && dims) {
          // 自動依常見正方形或標準高度推定張數
          if (dims[1] === 160 || dims[1] === 256 || dims[1] === 320 || dims[1] === 224) {
            n = Math.max(1, Math.round(dims[0] / (dims[1] === 160 ? 128 : dims[1] === 224 ? 192 : dims[1])));
          } else {
            n = Math.max(1, Math.round(dims[0] / Math.max(24, Math.min(dims[1], 64))));
          }
        }
        const cw = dims && n ? Math.round(dims[0] / n) : 64;
        const ch = dims ? dims[1] : 64;
        info.geom[actStr] = {
          w: cw,
          h: ch,
          x: -Math.round(cw / 2),
          y: ch >= 160 ? -(ch - 48) : -(ch - 12),
          n: n || 1,
        };
        if (ch === 320 && cw === 320) {
          info.geom[actStr].x = -160;
          info.geom[actStr].y = -240;
        } else if (ch === 256 && cw === 256) {
          info.geom[actStr].x = -128;
          info.geom[actStr].y = -208;
        } else if (ch === 160 && cw === 128) {
          info.geom[actStr].x = -64;
          info.geom[actStr].y = -132;
        } else if (ch === 224 && cw === 192) {
          info.geom[actStr].x = -96;
          info.geom[actStr].y = -176;
        }
      }
    }
  }
  spriteMeta[gStr] = info;
}

// 11. 效果圖檔幀數幾何資訊
const effectsMeta = {};
for (const [eid, e] of Object.entries(effectJson)) {
  const variant = e.variants?.['0'] || `${eid}-0.webp`;
  const dims = webpDims(readPackBytes(`/lineage163/effects/${variant}`));
  const seqList = e.sequence || [];
  const maxIdx = seqList.reduce((acc, [fi]) => Math.max(acc, fi), 0);
  const frames = Math.max(1, maxIdx + 1);
  effectsMeta[eid] = {
    id: Number(eid),
    file: variant,
    seq: seqList,
    duration: Number(e.duration || 400),
    sounds: e.sounds || {},
    w: dims ? Math.round(dims[0] / frames) : 128,
    h: dims ? dims[1] : 128,
    frames,
  };
}
const lvlDef = readJson('/level-up-v1/definition.json');
if (lvlDef) {
  const b = readPackBytes('/lineage163/effects/751-0.webp');
  effectsMeta['levelup'] = {
    id: 2127,
    file: '/level-up-v1/2127-0.webp',
    seq: Array.from({ length: Number(lvlDef.frames || 16) }, (_, k) => [k, 2]),
    duration: 1200,
    sounds: { 0: '/level-up-v1/517.wav' },
    w: Number(lvlDef.width || 256),
    h: Number(lvlDef.height || 256),
    frames: Number(lvlDef.frames || 16),
    rawPath: true,
    legacyDims: b ? webpDims(b) : null,
  };
}

// 12. 萃取說話之島相關原版 NPC 對話 HTML（dialogues.json 子集）
const allDlgs = readJson('/lineage163/dialogues.json') || {};
const tiDlgRegex =
  /^(catty|dorin|farlin|gereng|gunter|judice|ladar|lucas|pandora|moria|touma|mona|selena|lengo|lian|jansen|basin|fin|aanon)/i;
const dialogues = {};
for (const [k, v] of Object.entries(allDlgs)) {
  if (tiDlgRegex.test(k)) dialogues[k] = v;
}

const validTiles = art.assets
  .map((a) => a[0])
  .filter((p) => /^\/lineage163\/tiles-lossless-v1\/\d+\.webp$/.test(p))
  .map((p) => Number(p.split('/').pop().replace('.webp', '')))
  .sort((a, b) => a - b);

const validIcons = art.assets
  .map((a) => a[0])
  .filter((p) => /^\/lineage163\/item-icons\/\d+\.png$/.test(p))
  .map((p) => Number(p.split('/').pop().replace('.png', '')))
  .sort((a, b) => a - b);

const validSounds = art.assets
  .map((a) => a[0])
  .filter((p) => /^\/lineage163\/sound-mp3-v1\/\d+\.mp3$/.test(p))
  .map((p) => Number(p.split('/').pop().replace('.mp3', '')))
  .sort((a, b) => a - b);

const out = {
  version: '286-ti-v1',
  expTable: E.sE,
  classes,
  portals,
  spawns,
  monsters,
  drops,
  npcs,
  shops,
  items,
  spells,
  groundItems: groundJson,
  retainedChunks,
  redrawLayers,
  collision,
  spriteMeta,
  effectsMeta,
  dialogues,
  validTiles,
  validIcons,
  validSounds,
};

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(out));
const stats = fs.statSync(outPath);
console.log(
  `Extracted ${outPath}: ${(stats.size / 1024).toFixed(1)} KB ` +
    `(chunks=${Object.keys(collision).length}, mobs=${Object.keys(monsters).length}, ` +
    `spawns=${spawns.length}, npcs=${npcs.length}, items=${Object.keys(items).length}, ` +
    `spells=${spells.length}, sprites=${Object.keys(spriteMeta).length}, dialogues=${Object.keys(dialogues).length})`,
);
