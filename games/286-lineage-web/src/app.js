// 286 天堂人生 · 1.63 獨立運作平台（Frontend SPA + Offline-Capable Store）
// 支援完整 9 大視圖：/ 遊戲大廳、/official 官方入口、/guide 攻略圖鑑(243筆)、/form 冒險者論壇、
// /rice 能力骰子模擬器、/topup 蛋幣儲值(含 Origin Guard)、/gm GM 控制台、/privacy 與 /privacy2 隱私權政策。

const CAPTURED_DATA = window.__LINEAGE_CAPTURED_DATA__ || {
  guide: { revision: '1.63', build: 656, records: [] },
  releaseScope: { plannedVersion: 'GI-0.5', build: 656, retainedMapIds: [0, 1, 2, 3], pending: [] },
  forumSeed: { topics: [] },
  names: { entries: [] },
  sampleDialogues: {},
};

export function assetUrl(rawPath) {
  if (!rawPath) return '';
  if (rawPath.startsWith('../assets/286/')) return rawPath;
  if (rawPath.startsWith('/assets/286/')) return `..${rawPath}`;
  if (
    rawPath.startsWith('/assets/284/') ||
    rawPath.startsWith('/lineage163/') ||
    rawPath.startsWith('/original163/') ||
    rawPath.startsWith('/level-up-v1/') ||
    rawPath.startsWith('/packs/') ||
    rawPath.startsWith('/art-assets.json') ||
    rawPath.startsWith('/art-cache-sw.js') ||
    rawPath.startsWith('/local-materials327') ||
    rawPath.startsWith('/auto-worker465.js') ||
    rawPath.startsWith('/scenery-worker289.js')
  ) {
    return `../assets/286${rawPath}`;
  }
  return rawPath;
}

export const CREATION_STAT_CAP = 20;
export const STAT_KEYS = ['str', 'dex', 'con', 'wis', 'cha', 'int'];

export const CREATION_CLASSES = [
  {
    classId: 'royal',
    rawBase: 'royal',
    name: '王族',
    side: 'left',
    pos: 1,
    logo: assetUrl('/assets/284/logo/royal.png'),
    maleAvatar: '王子',
    femaleAvatar: '公主',
    startKeyM: 'prince',
    startKeyF: 'princess',
    base: { str: 13, dex: 10, con: 10, int: 10, wis: 11, cha: 13, pts: 8 },
    baseHp: 16,
    baseMp: 6,
    baseAc: 8,
    desc: '召集成員克服險惡的苦難與逆境，只為了建立自己國家的遠大夢想。\n\n『王族』是個非常特別的職業，在天堂世界中只有『王族』才能創造血盟，率領盟友攻下亞丁大陸的城堡。',
  },
  {
    classId: 'knight',
    rawBase: 'knight',
    name: '騎士',
    side: 'left',
    pos: 2,
    logo: assetUrl('/assets/284/logo/knight.png'),
    maleAvatar: '男騎士',
    femaleAvatar: '女騎士',
    startKeyM: 'm_knight',
    startKeyF: 'f_knight',
    base: { str: 16, dex: 12, con: 14, int: 8, wis: 9, cha: 8, pts: 8 },
    baseHp: 22,
    baseMp: 4,
    baseAc: 6,
    desc: '奮勇地擋在前端面對危險，是戰鬥最基本的職業。\n\n能夠使用多種重型武器與盔甲，強大的近距離攻擊力及優越防禦是其他職業無法比擬的。',
  },
  {
    classId: 'mage',
    rawBase: 'mage',
    name: '法師',
    side: 'left',
    pos: 3,
    logo: assetUrl('/assets/284/logo/mage.png'),
    maleAvatar: '男法師',
    femaleAvatar: '女法師',
    startKeyM: 'm_mage',
    startKeyF: 'f_mage',
    base: { str: 8, dex: 7, con: 12, int: 12, wis: 12, cha: 8, pts: 16 },
    baseHp: 14,
    baseMp: 16,
    baseAc: 9,
    desc: '利用「瑪那」釋放神般的偉大力量，優先於精神上的發展與學習並能使用多種元素與治癒魔法，在戰鬥中給予成員關鍵支援。',
  },
  {
    classId: 'elf',
    rawBase: 'elf',
    name: '妖精',
    side: 'left',
    pos: 4,
    logo: assetUrl('/assets/284/logo/elf.png'),
    maleAvatar: '男妖精',
    femaleAvatar: '女妖精',
    startKeyM: 'm_elf',
    startKeyF: 'f_elf',
    base: { str: 11, dex: 12, con: 12, int: 12, wis: 12, cha: 8, pts: 8 },
    baseHp: 18,
    baseMp: 10,
    baseAc: 7,
    desc: '在『森林之母』的保護之下建立獨自文化，可使用遠距離攻擊弓箭與多種魔法，並能透過『那魯帕』製作妖精專屬裝備。',
  },
  {
    classId: 'dark',
    rawBase: 'dark',
    name: '黑暗妖精',
    side: 'right',
    pos: 1,
    logo: assetUrl('/assets/284/logo/dark.png'),
    maleAvatar: '男黑暗妖精',
    femaleAvatar: '女黑暗妖精',
    startKeyM: 'm_dark',
    startKeyF: 'f_dark',
    base: { str: 12, dex: 15, con: 8, int: 10, wis: 11, cha: 8, pts: 11 },
    baseHp: 16,
    baseMp: 8,
    baseAc: 6,
    desc: '在陰影中磨練雙刀、鋼爪與暗影魔法，憑藉高敏捷與爆發性的雙倍破壞力在短時間內扭轉戰局。',
  },
  {
    classId: 'illusion',
    rawBase: 'illusionist',
    name: '幻術士',
    side: 'right',
    pos: 2,
    logo: assetUrl('/assets/284/logo/illusionist.png'),
    maleAvatar: '男幻術士',
    femaleAvatar: '女幻術士',
    startKeyM: 'm_illusionist',
    startKeyF: 'f_illusionist',
    base: { str: 11, dex: 10, con: 12, int: 12, wis: 12, cha: 8, pts: 10 },
    baseHp: 16,
    baseMp: 14,
    baseAc: 8,
    desc: '研究精神與幻象的力量，藉由奇古獸與神秘立方魔法動搖敵人判斷，支援並強化全隊戰力。',
  },
  {
    classId: 'dragon',
    rawBase: 'Dknight',
    name: '龍騎士',
    side: 'right',
    pos: 3,
    logo: assetUrl('/assets/284/logo/Dknight.png'),
    maleAvatar: '男龍騎士',
    femaleAvatar: '女龍騎士',
    startKeyM: 'm_Dknight',
    startKeyF: 'f_Dknight',
    base: { str: 13, dex: 11, con: 14, int: 11, wis: 12, cha: 8, pts: 6 },
    baseHp: 21,
    baseMp: 6,
    baseAc: 6,
    desc: '繼承龍之血脈與戰鬥本能，使用鎖鏈劍與龍之覺醒魔法，掌握敵人弱點並在瞬間爆發出屠龍之力。',
  },
  {
    classId: 'warrior',
    rawBase: 'warrior',
    name: '戰士',
    side: 'right',
    pos: 4,
    logo: assetUrl('/assets/284/logo/warrior.png'),
    maleAvatar: '男戰士',
    femaleAvatar: '女戰士',
    startKeyM: 'm_warrior',
    startKeyF: 'f_warrior',
    base: { str: 16, dex: 13, con: 16, int: 10, wis: 7, cha: 8, pts: 5 },
    baseHp: 24,
    baseMp: 3,
    baseAc: 5,
    desc: '憑藉強健體魄、雙持斧頭與狂戰士被動技能，在近距離包圍戰中展現最高耐久力與壓迫感。',
  },
];

export const LOGIN_BG_IMAGE = assetUrl('/assets/284/login/310.png');
export const SELECT_BG_IMAGE = assetUrl('/assets/284/login/load.png');
export const SELECT_OVERLAY_IMAGE = assetUrl('/assets/284/login/load1.png');
export const CREATE_BG_IMAGE = assetUrl('/assets/284/login/824.png');

export const LOGIN_UPDATE_NOTES = [
  '沿用 284 經典 4:3 登入、角色選擇與創立角色視覺介面',
  '整合帳號驗證、8 職業 2 性別角色槽（1-8 頁切換）與經典模式',
  '完整保留說語島 1.63 地圖、Service Worker 分包快取與即時連線測試',
];

export const LOGIN_ANIM_FRAMES = Array.from({ length: 28 }, (_, i) =>
  assetUrl(`/assets/284/login/${273 + i}.png`),
);

export const EMPTY_SLOT_FRAMES = [
  ...Array.from({ length: 13 }, (_, i) => assetUrl(`/assets/284/start/none/${i + 1}.png`)),
  ...Array.from({ length: 9 }, (_, i) => assetUrl(`/assets/284/start/none/${i + 16}.png`)),
];

const START_KEY_SPRITE_RANGES = {
  prince: Array.from({ length: 11 }, (_, i) => 714 + i),
  m_knight: Array.from({ length: 21 }, (_, i) => 378 + i),
};

export function getClassDef(idOrRaw) {
  return (
    CREATION_CLASSES.find((c) => c.classId === idOrRaw || c.rawBase === idOrRaw) ||
    CREATION_CLASSES[0]
  );
}

export function resolvePreviewUrls(classId, gender) {
  const def = getClassDef(classId);
  const startKey = gender === 'f' ? def.startKeyF : def.startKeyM;
  const frames = START_KEY_SPRITE_RANGES[startKey];
  if (frames && frames.length > 0) {
    return frames.map((f) => assetUrl(`/assets/284/start/${startKey}/${f}.png`));
  }
  return [def.logo];
}

export const HUD_UI_ICONS = [
  { src: assetUrl('/lineage163/ui-redraw-v8/406.png'), label: '角色狀態' },
  { src: assetUrl('/lineage163/ui-redraw-v8/407.png'), label: '裝備背包' },
  { src: assetUrl('/lineage163/ui-redraw-v8/408.png'), label: '魔法技能' },
  { src: assetUrl('/lineage163/ui-redraw-v8/409.png'), label: '系統設定' },
  { src: assetUrl('/lineage163/ui-redraw-v8/428.png'), label: '血量條' },
  { src: assetUrl('/lineage163/ui-redraw-v8/460.png'), label: '魔力條' },
  { src: assetUrl('/lineage163/ui-redraw-v8/chat-expand.png'), label: '聊天欄' },
  { src: assetUrl('/lineage163/item-icons/1.png'), label: '長劍' },
  { src: assetUrl('/lineage163/item-icons/2.png'), label: '治癒藥水' },
  { src: assetUrl('/lineage163/item-icons/34.png'), label: '傳送卷軸' },
];

export const EGG_PACKAGES = [
  { id: 'pack-small', label: '初心者蛋幣袋', amountTwd: 150, baseEggs: 150, bonusEggs: 0 },
  { id: 'pack-medium', label: '騎士團補給箱', amountTwd: 500, baseEggs: 500, bonusEggs: 50 },
  { id: 'pack-large', label: '亞丁王室秘寶', amountTwd: 1500, baseEggs: 1500, bonusEggs: 250 },
  { id: 'pack-royal', label: '說話之島誓約箱', amountTwd: 3000, baseEggs: 3000, bonusEggs: 600 },
];

export const DICE_CLASS_STATS = {
  prince: {
    id: 'prince',
    label: '王族',
    base: { str: 13, dex: 10, con: 10, wis: 11, cha: 13, intel: 10 },
    bonusPool: 8,
  },
  knight: {
    id: 'knight',
    label: '騎士',
    base: { str: 16, dex: 12, con: 14, wis: 9, cha: 12, intel: 8 },
    bonusPool: 4,
  },
  elf: {
    id: 'elf',
    label: '妖精',
    base: { str: 11, dex: 12, con: 12, wis: 12, cha: 9, intel: 12 },
    bonusPool: 7,
  },
  mage: {
    id: 'mage',
    label: '法師',
    base: { str: 8, dex: 7, con: 12, wis: 12, cha: 8, intel: 12 },
    bonusPool: 16,
  },
  darkelf: {
    id: 'darkelf',
    label: '黑暗妖精',
    base: { str: 12, dex: 15, con: 8, wis: 10, cha: 9, intel: 11 },
    bonusPool: 10,
  },
};

function buildStarterInventory(classId) {
  if (classId === 'elf') {
    return [
      { slot: 1, name: '短弓', count: 1, plus: 0 },
      { slot: 2, name: '木製的夾克', count: 1, plus: 0 },
      { slot: 3, name: '箭', count: 1000, plus: 0 },
      { slot: 4, name: '匕首', count: 1, plus: 0 },
      { slot: 5, name: '紅色藥水', count: 100, plus: 0 },
    ];
  }
  if (classId === 'mage') {
    return [
      { slot: 1, name: '匕首', count: 1, plus: 0 },
      { slot: 2, name: '皮夾克', count: 1, plus: 0 },
      { slot: 3, name: '紅色藥水', count: 100, plus: 0 },
      { slot: 4, name: '魔法書(光箭)', count: 1, plus: 0 },
    ];
  }
  return [
    { slot: 1, name: '匕首', count: 1, plus: 0 },
    { slot: 2, name: '皮夾克', count: 1, plus: 0 },
    { slot: 3, name: '紅色藥水', count: 100, plus: 0 },
  ];
}

// In-Browser Fallback Store (mirrors server/lineage-web so static mode has 0 404s)
const localStore = {
  accounts: new Map(),
  sessions: new Map(),
  slotsByAccount: new Map(),
  forumTopics: (CAPTURED_DATA.forumSeed?.topics || []).map((t) => ({
    id: `topic-${t.id}`,
    slug: `captured-${t.id}`,
    title: t.title,
    category: t.category || 'general',
    authorName: t.nickname || '冒險者',
    body: t.body,
    pinned: Boolean(t.pinned),
    likes: t.likes || 0,
    replyCount: t.replies || 0,
    createdAt: new Date(t.created || Date.now()).toISOString(),
  })),
  forumPosts: new Map(),
  orders: new Map(),
  gpReceipts: new Set(),
  audits: [],
  reports: [
    {
      id: 'rep-seed-1',
      kind: 'sw_lifecycle',
      message: 'Service Worker royal-art-v1 ready (335 packs indexed)',
      build: '656',
      pathname: '/',
      createdAt: new Date().toISOString(),
    },
  ],
  runtime: {
    maintenance: false,
    maintenanceMessage: '說話之島伺服器正常開放中（1.63 經典版本）',
    realmName: '說話之島 #1',
    build: 656,
  },
};

function ensureLocalSlots(accountKey) {
  const key = (accountKey || 'adventurer01').toLowerCase();
  if (!localStore.slotsByAccount.has(key)) {
    const slots = Array.from({ length: 8 }, () => null);
    slots[0] = {
      slot: 1,
      name: `${key.slice(0, 8)}騎士`,
      classId: 'knight',
      className: '騎士',
      gender: 'm',
      level: 12,
      alignment: 3200,
      alignmentLabel: '守序 (Lawful)',
      pledge: '說話之島守衛隊',
      classicMode: true,
      stats: { str: 18, dex: 12, con: 16, wis: 9, cha: 12, int: 8 },
      hp: 168,
      maxHp: 168,
      mp: 18,
      maxMp: 18,
      ac: -6,
      adena: 12500,
      eggs: 500,
      inventory: buildStarterInventory('knight'),
      createdAt: new Date().toISOString(),
    };
    localStore.slotsByAccount.set(key, slots);
  }
  return localStore.slotsByAccount.get(key);
}

// 走後端 API 的條件：本機 npm start（8127）、頁面明確指定，或 Vercel 網域上的後端已接持久資料庫。
// Vercel 函式的記憶體模式會因冷啟動與多實例遺失帳號，所以那種情況仍用瀏覽器內後援；
// 其他靜態主機完全不探測（沒有 /api，探測只會多一個 404）。
let networkBackend = Boolean(window.__LINEAGE_BACKEND__) || window.location.port === '8127';
let backendProbe = null;

function probeBackend() {
  if (networkBackend || !/\.vercel\.app$/i.test(window.location.hostname)) {
    return Promise.resolve(networkBackend);
  }
  if (!backendProbe) {
    backendProbe = (async () => {
      try {
        const res = await fetch('/api/lineage/health', { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          networkBackend = data?.databaseMode === 'neon-postgres';
        }
      } catch {
        // 後端不可用：維持瀏覽器內後援
      }
      return networkBackend;
    })();
  }
  return backendProbe;
}

function shouldUseNetworkBackend() {
  return networkBackend;
}

async function localApiCall(endpoint, method = 'GET', body = null, headers = {}) {
  const [pathPart, queryString] = endpoint.split('?');
  const params = new URLSearchParams(queryString || '');

  if (pathPart === 'auth' && method === 'POST') {
    const username = String(body?.username || '').trim();
    const password = String(body?.password || '');
    if (username.length < 3 || password.length < 6) {
      return { status: 400, data: { ok: false, error: '帳號需 3~32 字元，密碼至少 6 字元' } };
    }
    const key = username.toLowerCase();
    let acct = localStore.accounts.get(key);
    if (body?.action === 'register') {
      if (acct) return { status: 409, data: { ok: false, error: 'username_taken' } };
      acct = { id: `acc-${Date.now()}`, username, password, role: 'player', eggs: 300, isHeld: false };
      localStore.accounts.set(key, acct);
    } else {
      if (!acct) {
        acct = { id: `acc-${Date.now()}`, username, password, role: 'player', eggs: 300, isHeld: false };
        localStore.accounts.set(key, acct);
      } else if (acct.password !== password) {
        return { status: 401, data: { ok: false, error: 'invalid_credentials' } };
      }
    }
    if (acct.isHeld) return { status: 403, data: { ok: false, error: 'account_held' } };
    const sid = `sid-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    localStore.sessions.set(sid, acct.username);
    return {
      status: 200,
      data: {
        ok: true,
        sessionId: sid,
        account: { id: acct.id, username: acct.username, role: acct.role, eggs: acct.eggs },
      },
    };
  }

  if (pathPart === 'characters') {
    const sid = headers['x-game-session'] || '';
    const accountKey = localStore.sessions.get(sid) || 'adventurer01';
    const slots = ensureLocalSlots(accountKey);
    if (method === 'GET') {
      return { status: 200, data: { ok: true, account: accountKey, maxSlots: 8, slots: [...slots] } };
    }
    const action = body?.action || 'create';
    const slotIdx = Number(body?.slot || 1) - 1;
    if (action === 'create') {
      if (slots[slotIdx]) return { status: 400, data: { ok: false, error: 'slot_occupied' } };
      const def = getClassDef(body?.classId || 'royal');
      const bonus = body?.bonusStats || { str: 0, dex: 0, con: 0, wis: 0, cha: 0, int: 0 };
      const stats = {
        str: def.base.str + (bonus.str || 0),
        dex: def.base.dex + (bonus.dex || 0),
        con: def.base.con + (bonus.con || 0),
        wis: def.base.wis + (bonus.wis || 0),
        cha: def.base.cha + (bonus.cha || 0),
        int: def.base.int + (bonus.int || 0),
      };
      const maxHp = def.baseHp + Math.max(0, stats.con - 10) * 2;
      const maxMp = def.baseMp + Math.max(0, stats.wis - 10) * 2;
      const created = {
        slot: slotIdx + 1,
        name: String(body?.name || '新角色').trim(),
        classId: def.classId,
        className: def.name,
        gender: body?.gender === 'f' ? 'f' : 'm',
        level: 1,
        alignment: 0,
        alignmentLabel: '中立 (Neutral)',
        pledge: '無血盟',
        classicMode: Boolean(body?.classicMode),
        stats,
        hp: maxHp,
        maxHp,
        mp: maxMp,
        maxMp,
        ac: def.baseAc - Math.floor(Math.max(0, stats.dex - 10) / 3),
        adena: 1200,
        eggs: 100,
        inventory: buildStarterInventory(def.classId),
        createdAt: new Date().toISOString(),
      };
      slots[slotIdx] = created;
      return { status: 200, data: { ok: true, character: created, slots: [...slots] } };
    }
    if (action === 'enter') {
      const char = slots[slotIdx];
      if (!char) return { status: 404, data: { ok: false, error: 'slot_empty' } };
      return {
        status: 200,
        data: {
          ok: true,
          character: char,
          worldSpawn: { realm: '說話之島 #1', mapId: 4, mapName: '說話之島村莊', x: 32578, y: 32943 },
        },
      };
    }
    if (action === 'delete') {
      const char = slots[slotIdx];
      if (!char) return { status: 400, data: { ok: false, error: 'slot_empty' } };
      if (char.name !== String(body?.confirmName || '').trim()) {
        return { status: 400, data: { ok: false, error: 'confirm_name_mismatch' } };
      }
      slots[slotIdx] = null;
      return { status: 200, data: { ok: true, slots: [...slots] } };
    }
    if (action === 'import') {
      if (slots[slotIdx]) return { status: 400, data: { ok: false, error: 'slot_occupied' } };
      const raw = body?.saveData || {};
      const def = getClassDef(raw.classId || 'knight');
      const imported = {
        slot: slotIdx + 1,
        name: String(raw.name || `匯入${def.name}${slotIdx + 1}`).slice(0, 12),
        classId: def.classId,
        className: def.name,
        gender: raw.gender === 'f' ? 'f' : 'm',
        level: Number(raw.level || 15),
        alignment: 5000,
        alignmentLabel: '守序 (Lawful)',
        pledge: '說語之島遠征軍',
        classicMode: Boolean(raw.classicMode ?? true),
        stats: raw.stats || { ...def.base },
        hp: 210,
        maxHp: 210,
        mp: 45,
        maxMp: 45,
        ac: -8,
        adena: 25000,
        eggs: 300,
        inventory: buildStarterInventory(def.classId),
        createdAt: new Date().toISOString(),
      };
      slots[slotIdx] = imported;
      return { status: 200, data: { ok: true, character: imported, slots: [...slots] } };
    }
  }

  if (pathPart === 'realtime' && method === 'POST') {
    const ticket = `local-ticket-${Date.now()}`;
    return { status: 200, data: { ok: true, ticket, wsEndpoint: '/api/lineage/world', expiresInMs: 60000 } };
  }

  if (pathPart === 'world' && method === 'POST') {
    return {
      status: 200,
      data: {
        ok: true,
        frame: JSON.stringify({
          t: 'pong',
          s: 2,
          p: { serverTimeMs: Date.now(), realm: '說話之島 #1' },
        }),
      },
    };
  }

  if (pathPart === 'forum') {
    if (method === 'GET') {
      const topicId = params.get('topicId') || localStore.forumTopics[0]?.id || null;
      const posts = localStore.forumPosts.get(topicId) || [];
      return { status: 200, data: { topics: [...localStore.forumTopics], activeTopicId: topicId, posts } };
    }
    const action = body?.action || 'create_topic';
    if (action === 'create_topic') {
      const created = {
        id: `topic-${Date.now()}`,
        slug: `post-${Date.now()}`,
        title: String(body?.title || '').trim(),
        category: String(body?.category || 'general'),
        authorName: String(body?.authorName || '匿名冒險者'),
        body: String(body?.body || '').trim(),
        pinned: false,
        likes: 0,
        replyCount: 0,
        createdAt: new Date().toISOString(),
      };
      localStore.forumTopics.unshift(created);
      localStore.forumPosts.set(created.id, []);
      return { status: 200, data: { ok: true, topic: created } };
    }
    if (action === 'create_post') {
      const topicId = body?.topicId;
      const post = {
        id: `reply-${Date.now()}`,
        topicId,
        authorName: String(body?.authorName || '冒險者'),
        body: String(body?.body || '').trim(),
        likes: 0,
        createdAt: new Date().toISOString(),
      };
      const list = localStore.forumPosts.get(topicId) || [];
      list.push(post);
      localStore.forumPosts.set(topicId, list);
      const topic = localStore.forumTopics.find((t) => t.id === topicId);
      if (topic) topic.replyCount = list.length;
      return { status: 200, data: { ok: true, post } };
    }
    if (action === 'like_topic') {
      const topic = localStore.forumTopics.find((t) => t.id === body?.topicId);
      if (topic) topic.likes += 1;
      return { status: 200, data: { ok: true, topic } };
    }
  }

  if (pathPart === 'payments') {
    if (method === 'GET') {
      const orderNo = params.get('orderNo');
      return { status: 200, data: { ok: true, order: localStore.orders.get(orderNo) || null, packages: EGG_PACKAGES } };
    }
    if (body?.action === 'checkout') {
      const pkg = EGG_PACKAGES.find((p) => p.id === body.packageId) || EGG_PACKAGES[0];
      const orderNo = `ORD${Date.now()}`;
      const order = {
        orderNo,
        accountId: body.username || 'adventurer01',
        packageId: pkg.id,
        amountTwd: pkg.amountTwd,
        eggsGranted: pkg.baseEggs + pkg.bonusEggs,
        status: 'pending',
        providerTxId: null,
      };
      localStore.orders.set(orderNo, order);
      const sig = `hmac_${orderNo.toLowerCase()}_sig163`;
      return {
        status: 200,
        data: {
          ok: true,
          order,
          signature: sig,
          originRedirectPath: `#/topup/origin?orderNo=${orderNo}&sig=${sig}`,
        },
      };
    }
    if (body?.action === 'webhook') {
      const order = localStore.orders.get(body.orderNo);
      if (!order) return { status: 404, data: { ok: false, error: 'order_not_found' } };
      order.status = 'completed';
      order.providerTxId = body.providerTxId || `TX-${Date.now()}`;
      const key = String(order.accountId).toLowerCase();
      const acct = localStore.accounts.get(key) || { eggs: 300 };
      acct.eggs = (acct.eggs || 300) + order.eggsGranted;
      localStore.accounts.set(key, acct);
      return { status: 200, data: { ok: true, order, accountEggs: acct.eggs } };
    }
  }

  if (pathPart === 'google-play-billing' && method === 'POST') {
    const key = `${body?.productId}:${body?.purchaseToken}`;
    const uKey = String(body?.username || 'adventurer01').toLowerCase();
    const acct = localStore.accounts.get(uKey) || { eggs: 300 };
    if (localStore.gpReceipts.has(key)) {
      return {
        status: 200,
        data: { ok: true, duplicate: true, idempotencyKey: `gp_${key.slice(0, 24)}`, eggsGranted: 0, accountEggs: acct.eggs },
      };
    }
    const map = {
      'com.lineage.eggs.150': 150,
      'com.lineage.eggs.550': 550,
      'com.lineage.eggs.1750': 1750,
      'com.lineage.eggs.3600': 3600,
    };
    const grant = map[body?.productId] || 0;
    if (!grant || String(body?.purchaseToken || '').length < 16) {
      return { status: 400, data: { ok: false, error: 'Malformed purchaseToken or productId' } };
    }
    localStore.gpReceipts.add(key);
    acct.eggs = (acct.eggs || 300) + grant;
    localStore.accounts.set(uKey, acct);
    return {
      status: 200,
      data: { ok: true, duplicate: false, idempotencyKey: `gp_${key.slice(0, 24)}`, eggsGranted: grant, accountEggs: acct.eggs },
    };
  }

  if (pathPart === 'gm') {
    const token = headers['x-gm-token'] || '';
    if (token !== 'dev-gm-secret-token' && token !== 'test-gm-secret') {
      return { status: 403, data: { ok: false, error: 'unauthorized_gm' } };
    }
    if (method === 'GET') {
      return {
        status: 200,
        data: { ok: true, runtime: { ...localStore.runtime }, audits: [...localStore.audits], reports: [...localStore.reports] },
      };
    }
    const action = body?.action;
    if (action === 'toggle_maintenance') {
      localStore.runtime.maintenance = Boolean(body.maintenance);
      localStore.runtime.maintenanceMessage = body.maintenance
        ? '系統臨時維護中，請稍候再試'
        : '說話之島伺服器正常開放中（1.63 經典版本）';
    }
    localStore.audits.unshift({
      id: `aud-${Date.now()}`,
      actor: body?.actor || 'gm-admin',
      action,
      target: body?.target || 'realm:1',
      createdAt: new Date().toISOString(),
    });
    return { status: 200, data: { ok: true, runtime: { ...localStore.runtime } } };
  }

  return { status: 200, data: { ok: true } };
}

export async function apiRequest(endpoint, options = {}) {
  await probeBackend();
  const method = options.method || 'GET';
  const headers = options.headers || {};
  const body = options.body ? (typeof options.body === 'string' ? JSON.parse(options.body) : options.body) : null;

  if (shouldUseNetworkBackend()) {
    try {
      const res = await fetch(`/api/lineage/${endpoint}`, {
        method,
        headers: {
          ...(body ? { 'Content-Type': 'application/json' } : {}),
          ...headers,
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json();
      return { status: res.status, data };
    } catch {
      // Fall back to in-browser store if network unavailable
    }
  }
  return localApiCall(endpoint, method, body, headers);
}

const ERROR_MESSAGES = {
  missing_session: '請先登入帳號',
  slot_occupied: '此角色欄位已被佔用',
  slot_empty: '此欄位沒有角色',
  confirm_name_mismatch: '輸入的角色名稱與目標角色不一致',
  points_unallocated: '請先將所有獎勵點數分配完畢',
  username_taken: '帳號已被註冊，請改按登入或更換名稱',
  invalid_credentials: '帳號或密碼不正確',
  account_held: '此帳號目前遭暫時鎖定',
};

function formatError(code, status) {
  if (code && ERROR_MESSAGES[code]) return ERROR_MESSAGES[code];
  return code ? `錯誤：${code}` : `HTTP ${status}`;
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const state = {
  route: '/',
  stage: 'login', // login | select | create | game
  username: 'adventurer01',
  password: 'password1234',
  sessionId: null,
  authNotice: '尚未登入',
  realtimeLog: '尚未測試連線',
  slots: Array.from({ length: 8 }, () => null),
  selectedSlot: 1,
  selectPage: 0,
  createTargetSlot: 1,
  activeCharacter: null,
  charBusy: false,
  stageNotice: '',
  modalMode: null, // delete | import | classic
  confirmName: '',
  importText: '',
  localModalError: '',
  createClassId: 'royal',
  createGender: 'm',
  createAlloc: { str: 0, dex: 0, con: 0, wis: 0, cha: 0, int: 0 },
  createClassicMode: false,
  createCharName: '王族新兵',
  swStatusText: '已就緒 (royal-art-v1 離線快取)',
  assetSummary: '載入本機素材清單中...',
  swPreloadProgress: '待命中',
  workerAutoStatus: '待啟動檢查',
  workerSceneryStatus: '待啟動檢查',
  mapChunkStatus: '載入地圖 0/7ff88000.json.gz 中...',
  // Guide view state
  guideCategory: '',
  guideQuery: '',
  selectedGuideId: null,
  dialogueQuery: '甘特',
  dialogueResults: [],
  // Forum view state
  forumTopics: [...localStore.forumTopics],
  activeTopicId: localStore.forumTopics[0]?.id || null,
  forumPosts: [],
  newTopicTitle: '',
  newTopicBody: '',
  newTopicAuthor: '說話之島旅人',
  newTopicCategory: 'general',
  replyAuthor: '見習騎士',
  replyBody: '',
  forumNotice: '',
  // Dice view state
  diceClassId: 'knight',
  diceBonus: { str: 4, dex: 0, con: 0, wis: 0, cha: 0, intel: 0 },
  diceFinal: { str: 20, dex: 12, con: 14, wis: 9, cha: 12, intel: 8 },
  diceSimResult: null,
  // Topup view state
  topupUsername: 'adventurer01',
  topupPackageId: 'pack-medium',
  topupCheckout: null,
  topupWebhookResult: null,
  gpProductId: 'com.lineage.eggs.550',
  gpToken: 'gp_token_talking_island_1234567890',
  gpResult: null,
  // GM view state
  gmToken: 'dev-gm-secret-token',
  gmData: null,
  gmError: null,
  gmTargetUser: 'adventurer01',
  gmEggsToGrant: 500,
};

let animFrameIdx = 0;
let dialoguesCache = null;

async function ensureDialoguesLoaded() {
  if (dialoguesCache) return dialoguesCache;
  try {
    const res = await fetch(assetUrl('/lineage163/dialogues.json'));
    if (res.ok) {
      dialoguesCache = await res.json();
      return dialoguesCache;
    }
  } catch {
    // ignore
  }
  dialoguesCache = CAPTURED_DATA.sampleDialogues || {};
  return dialoguesCache;
}

function searchLocalDialogues(q) {
  const dict = dialoguesCache || CAPTURED_DATA.sampleDialogues || {};
  const clean = String(q || '').trim().replace(/^npc:/, '');
  if (!clean) return [];
  const results = [];
  if (dict[clean]) {
    results.push({ key: clean, html: dict[clean] });
  }
  const needle = clean.toLowerCase();
  for (const [k, html] of Object.entries(dict)) {
    if (k === clean || typeof html !== 'string') continue;
    if (k.toLowerCase().includes(needle) || html.includes(clean)) {
      results.push({ key: k, html });
      if (results.length >= 12) break;
    }
  }
  return results;
}

function drawIslandCanvas() {
  const canvas = document.querySelector('[data-testid="realm-canvas"]');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  if (window.__lastMapChunkData) {
    const chunk = window.__lastMapChunkData;
    ctx.fillStyle = '#0b1118';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const floor = chunk.floor || [];
    const cols = 48;
    const rows = 24;
    const cellW = 7;
    const cellH = 7;
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        const tile = floor[(r * 128 + c) % Math.max(1, floor.length)] ?? 0;
        const shade = (tile & 0xff) % 64;
        ctx.fillStyle =
          tile === 0 ? '#132334' : `rgb(${28 + shade}, ${54 + (shade >> 1)}, ${36 + (shade >> 2)})`;
        ctx.fillRect(10 + c * cellW, 10 + r * cellH, cellW - 1, cellH - 1);
      }
    }
    ctx.fillStyle = '#f0cf88';
    ctx.fillRect(10 + 18 * cellW, 10 + 11 * cellH, 8, 8);
    ctx.fillStyle = '#ece5d5';
    ctx.font = '12px sans-serif';
    ctx.fillText(
      `說語島 Chunk (${chunk.x}, ${chunk.y}) · 地格 ${floor.length.toLocaleString()}`,
      10,
      196,
    );
    return;
  }

  ctx.fillStyle = '#0e151f';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const cell = 12;
  for (let y = 0; y < 12; y += 1) {
    for (let x = 0; x < 24; x += 1) {
      const isBorder = x === 0 || y === 0 || x === 23 || y === 11;
      const isDiamond = Math.abs(x - 11.5) + Math.abs(y - 5.5) <= 5.5;
      ctx.fillStyle = isBorder ? '#d4ad63' : isDiamond ? '#3fb950' : '#1c2638';
      ctx.fillRect(24 + x * cell, 18 + y * cell, cell - 1, cell - 1);
    }
  }
  ctx.fillStyle = '#ece5d5';
  ctx.font = '12px sans-serif';
  ctx.fillText('說話之島 #1 (Build #656)', 20, 184);
}

function renderTopbar() {
  const navItems = [
    { path: '/', label: '遊戲大廳' },
    { path: '/official', label: '官方入口' },
    { path: '/guide', label: '首發攻略圖鑑 (243)' },
    { path: '/form', label: '冒險者論壇' },
    { path: '/rice', label: '能力骰子模擬' },
    { path: '/topup', label: '蛋幣儲值' },
    { path: '/gm', label: 'GM 控制台' },
    { path: '/privacy', label: '隱私權政策' },
  ];
  return `
    <header class="topbar-shell">
      <div class="topbar-inner">
        <a href="#/" class="brand-mark" data-nav="/">
          <span>⚔️ 天堂人生 · 1.63 獨立運作平台</span>
          <span class="badge">Build #656</span>
        </a>
        <nav class="nav-links" aria-label="全站導覽">
          ${navItems
            .map(
              (item) => `
            <a href="#${item.path}" class="nav-pill ${state.route === item.path ? 'active' : ''}" data-nav="${item.path}">
              ${escapeHtml(item.label)}
            </a>
          `,
            )
            .join('')}
        </nav>
      </div>
    </header>
  `;
}

function renderLobbyStage() {
  if (state.stage === 'login') {
    const loginAnimSrc = LOGIN_ANIM_FRAMES[animFrameIdx % LOGIN_ANIM_FRAMES.length];
    return `
      <section id="creation-screen" class="ll-stage-frame" aria-label="天堂 1.63 登入畫面">
        <div id="login-art-stage">
          <div id="login-art-cover">
            <img id="login-bg-image" src="${LOGIN_BG_IMAGE}" alt="天堂 1.63 登入背景" draggable="false" />
            <img id="login-anim-image" src="${loginAnimSrc}" alt="登入動畫特效" draggable="false" />
          </div>
          <div id="login-title-layer">
            <h1>說話之島 #1</h1>
            <ol id="login-update-notes">
              ${LOGIN_UPDATE_NOTES.map((n) => `<li>${escapeHtml(n)}</li>`).join('')}
            </ol>
          </div>
          <div id="main-menu">
            <div class="ll-login-card">
              <div class="ll-login-field">
                <label for="login-username">帳號</label>
                <input id="login-username" aria-label="username" value="${escapeHtml(state.username)}" placeholder="帳號" />
              </div>
              <div class="ll-login-field">
                <label for="login-password">密碼</label>
                <input id="login-password" aria-label="password" type="password" value="${escapeHtml(state.password)}" placeholder="密碼" />
              </div>
              <button id="btn-quick-start" type="button" class="ll-steel-btn primary" ${state.charBusy ? 'disabled' : ''}>
                開始遊戲
              </button>
              <div class="ll-auth-subrow">
                <button id="btn-auth-register" type="button" class="ll-steel-btn" ${state.charBusy ? 'disabled' : ''}>
                  註冊並登入
                </button>
                <button id="btn-auth-login" type="button" class="ll-steel-btn" ${state.charBusy ? 'disabled' : ''}>
                  登入
                </button>
              </div>
              ${state.stageNotice ? `<p class="ll-login-status">${escapeHtml(state.stageNotice)}</p>` : ''}
            </div>
          </div>
          <div id="login-meta-layer">
            <div id="login-version">GI-0.5 · Build #656</div>
            <div id="login-disclaimer">${escapeHtml(localStore.runtime.maintenanceMessage)}</div>
          </div>
        </div>
      </section>
    `;
  }

  if (state.stage === 'select') {
    const startSlot = state.selectPage * 4 + 1;
    const pageSlots = [startSlot, startSlot + 1, startSlot + 2, startSlot + 3];
    const selectedChar = state.slots[state.selectedSlot - 1] || null;
    const emptyFrame = EMPTY_SLOT_FRAMES[animFrameIdx % EMPTY_SLOT_FRAMES.length];
    const selectedPreviewList = selectedChar
      ? resolvePreviewUrls(selectedChar.classId, selectedChar.gender)
      : EMPTY_SLOT_FRAMES;
    const selectedFrame = selectedPreviewList[animFrameIdx % selectedPreviewList.length];

    return `
      <section id="load-select-panel" class="ll-stage-frame" aria-label="角色選擇">
        <div id="load-art-stage">
          <img id="load-select-bg" src="${SELECT_BG_IMAGE}" alt="角色選擇背景" draggable="false" />
          <div id="load-slot-grid" aria-label="存檔角色">
            ${pageSlots
              .map((slotNo) => {
                const char = state.slots[slotNo - 1];
                const isSelected = slotNo === state.selectedSlot;
                const src = char
                  ? isSelected
                    ? selectedFrame
                    : resolvePreviewUrls(char.classId, char.gender)[0]
                  : emptyFrame;
                const slotTitle = char
                  ? `角色 ${slotNo} ${char.className} Lv.${char.level}`
                  : `角色 ${slotNo} 空`;
                return `
                  <button
                    type="button"
                    data-slot="${slotNo}"
                    data-testid="load-slot-${slotNo}"
                    class="load-slot-card ${isSelected ? 'selected' : ''} ${char ? 'filled' : 'empty'}"
                    title="${escapeHtml(slotTitle)}"
                  >
                    <img src="${src}" alt="${escapeHtml(slotTitle)}" draggable="false" />
                  </button>
                `;
              })
              .join('')}
          </div>
          <img id="load-select-overlay" src="${SELECT_OVERLAY_IMAGE}" alt="" aria-hidden="true" draggable="false" />
          <div id="load-page-tabs" aria-label="存檔頁切換">
            <button id="load-page-1" type="button" class="${state.selectPage === 0 ? 'active' : ''}" aria-label="存檔 1 到 4"></button>
            <button id="load-page-2" type="button" class="${state.selectPage === 1 ? 'active' : ''}" aria-label="存檔 5 到 8"></button>
          </div>
          <section id="load-info-panel" aria-live="polite">
            <div class="load-info-row name"><span>Character Name</span><strong id="load-info-name">${selectedChar ? escapeHtml(selectedChar.name) : ''}</strong></div>
            <div class="load-info-row pledge"><span>Blood Pledge</span><strong id="load-info-pledge">${selectedChar ? escapeHtml(selectedChar.pledge) : ''}</strong></div>
            <div class="load-info-row class"><span>Class</span><strong id="load-info-class">${selectedChar ? escapeHtml(selectedChar.className) : ''}</strong></div>
            <div class="load-info-row alignment"><span>Alignment</span><strong id="load-info-alignment">${selectedChar ? (selectedChar.classicMode ? '經典' : '一般') : ''}</strong></div>
            <div class="load-info-row hp"><span>Hit Point</span><strong id="load-info-hp">${selectedChar ? `${Math.floor(selectedChar.hp)} / ${Math.floor(selectedChar.maxHp)}` : ''}</strong></div>
            <div class="load-info-row mp"><span>Mana Point</span><strong id="load-info-mp">${selectedChar ? `${Math.floor(selectedChar.mp)} / ${Math.floor(selectedChar.maxMp)}` : ''}</strong></div>
            <div class="load-info-row ac"><span>Armor Class</span><strong id="load-info-ac">${selectedChar ? String(selectedChar.ac) : ''}</strong></div>
            <div class="load-info-row lv"><span>Level</span><strong id="load-info-lv">${selectedChar ? String(selectedChar.level) : ''}</strong></div>
            <div class="load-info-row str"><span>Strength</span><strong id="load-info-str">${selectedChar ? String(selectedChar.stats.str) : ''}</strong></div>
            <div class="load-info-row dex"><span>Dexterity</span><strong id="load-info-dex">${selectedChar ? String(selectedChar.stats.dex) : ''}</strong></div>
            <div class="load-info-row con"><span>Constitution</span><strong id="load-info-con">${selectedChar ? String(selectedChar.stats.con) : ''}</strong></div>
            <div class="load-info-row wis"><span>Wisdom</span><strong id="load-info-wis">${selectedChar ? String(selectedChar.stats.wis) : ''}</strong></div>
            <div class="load-info-row cha"><span>Charisma</span><strong id="load-info-cha">${selectedChar ? String(selectedChar.stats.cha) : ''}</strong></div>
            <div class="load-info-row int"><span>Intelligence</span><strong id="load-info-int">${selectedChar ? String(selectedChar.stats.int) : ''}</strong></div>
          </section>
          <div id="load-action-panel">
            ${
              !selectedChar
                ? `
              <button id="load-btn-create" type="button" ${state.charBusy ? 'disabled' : ''}>創新角色</button>
              <button id="load-btn-import" type="button" ${state.charBusy ? 'disabled' : ''}>匯入進度</button>
            `
                : `
              <button id="load-btn-enter" type="button" ${state.charBusy ? 'disabled' : ''}>進入遊戲</button>
              <button id="load-btn-export" type="button" ${state.charBusy ? 'disabled' : ''}>匯出進度</button>
              <button id="load-btn-delete" type="button" style="color:#e7a09a;border-color:rgba(151,61,52,.82)" ${state.charBusy ? 'disabled' : ''}>刪除角色</button>
            `
            }
            <button id="load-btn-back" type="button">返回</button>
          </div>
          ${
            state.stageNotice
              ? `<div style="position:absolute;left:3%;top:1.5%;z-index:8;background:rgba(10,14,22,.85);border:1px solid rgba(240,207,136,.45);border-radius:4px;padding:3px 8px;font-size:12px;color:#f2d77f">帳號 ${escapeHtml(state.username)} · ${escapeHtml(state.stageNotice)}</div>`
              : ''
          }
          ${
            state.modalMode === 'delete' && selectedChar
              ? `
            <div class="ll-stage-modal-backdrop" role="dialog" aria-label="確認刪除角色">
              <div class="ll-stage-modal">
                <h3 style="margin-top:0;color:#fca5a5">刪除角色確認</h3>
                <p style="font-size:13px">即將刪除欄位 ${state.selectedSlot}：${escapeHtml(selectedChar.className)} Lv.${selectedChar.level}「${escapeHtml(selectedChar.name)}」。請輸入角色名稱確認：</p>
                <input id="delete-confirm-input" aria-label="確認角色名稱" class="input" style="width:100%;margin-bottom:10px" value="${escapeHtml(state.confirmName)}" placeholder="${escapeHtml(selectedChar.name)}" />
                ${state.localModalError ? `<p style="color:#f87171;font-size:12px">${escapeHtml(state.localModalError)}</p>` : ''}
                <div class="row" style="justify-content:flex-end">
                  <button id="modal-cancel-btn" type="button" class="btn secondary">取消</button>
                  <button id="modal-confirm-delete-btn" type="button" class="btn danger">確定刪除</button>
                </div>
              </div>
            </div>
          `
              : ''
          }
          ${
            state.modalMode === 'import'
              ? `
            <div class="ll-stage-modal-backdrop" role="dialog" aria-label="匯入角色進度">
              <div class="ll-stage-modal">
                <h3 style="margin-top:0;color:#f2d77f">匯入存檔至欄位 ${state.selectedSlot}</h3>
                <textarea id="import-json-textarea" aria-label="存檔 JSON 內容" rows="5" style="width:100%;margin-bottom:10px" placeholder='{"name":"亞丁英雄","classId":"knight","level":15}'>${escapeHtml(state.importText)}</textarea>
                ${state.localModalError ? `<p style="color:#f87171;font-size:12px">${escapeHtml(state.localModalError)}</p>` : ''}
                <div class="row" style="justify-content:flex-end">
                  <button id="modal-cancel-btn" type="button" class="btn secondary">取消</button>
                  <button id="modal-confirm-import-btn" type="button" class="btn">匯入欄位</button>
                </div>
              </div>
            </div>
          `
              : ''
          }
        </div>
      </section>
    `;
  }

  if (state.stage === 'create') {
    const classDef = getClassDef(state.createClassId);
    const previewList = resolvePreviewUrls(state.createClassId, state.createGender);
    const previewSrc = previewList[animFrameIdx % previewList.length];
    const spent = STAT_KEYS.reduce((s, k) => s + (state.createAlloc[k] || 0), 0);
    const ptsLeft = classDef.base.pts - spent;

    return `
      <section id="creation-screen" class="ll-stage-frame" aria-label="創建角色">
        <div id="creation-panel" class="ll-art-substage">
          <img id="creation-bg-image" src="${CREATE_BG_IMAGE}" alt="創角背景" draggable="false" />
          <section id="creation-class-desc-frame" aria-live="polite">
            <h2 id="creation-class-title">${escapeHtml(state.createGender === 'f' ? classDef.femaleAvatar : classDef.maleAvatar)}</h2>
            <div id="class-desc">${escapeHtml(classDef.desc)}</div>
          </section>
          <div id="creation-avatar-stage" aria-hidden="true">
            <img id="class-preview-img" src="${previewSrc}" alt="${escapeHtml(classDef.name)}預覽" draggable="false" />
          </div>
          <nav id="creation-class-list" aria-label="職業選擇">
            ${CREATION_CLASSES.map(
              (item) => `
              <button
                id="btn-class-base-${item.rawBase}"
                data-class-id="${item.classId}"
                type="button"
                title="${escapeHtml(item.name)}"
                class="creation-class-btn class-${item.side} class-pos-${item.pos} ${state.createClassId === item.classId ? 'active' : ''}"
              >
                <img src="${item.logo}" alt="${escapeHtml(item.name)}" />
              </button>
            `,
            ).join('')}
          </nav>
          <div id="creation-gender-panel" aria-label="性別選擇">
            <button id="btn-gender-m" type="button" title="男性" class="creation-gender-btn ${state.createGender === 'm' ? 'active' : ''}">♂</button>
            <button id="btn-gender-f" type="button" title="女性" class="creation-gender-btn ${state.createGender === 'f' ? 'active' : ''}">♀</button>
          </div>
          <div id="stat-allocation" aria-label="能力配點">
            <div id="creation-pts" data-testid="creation-pts">${ptsLeft}</div>
            ${STAT_KEYS.map((key) => {
              const total = classDef.base[key] + (state.createAlloc[key] || 0);
              return `
                <div class="creation-stat-control stat-${key}">
                  <span id="c-${key}" class="creation-stat-value">${total}</span>
                  <button type="button" data-stat-dec="${key}" aria-label="減少 ${key}" class="creation-stat-btn" ${(state.createAlloc[key] || 0) <= 0 ? 'disabled' : ''}>-</button>
                  <button type="button" data-stat-inc="${key}" aria-label="增加 ${key}" class="creation-stat-btn" ${ptsLeft <= 0 || total >= CREATION_STAT_CAP ? 'disabled' : ''}>+</button>
                </div>
              `;
            }).join('')}
          </div>
          <label id="classic-mode-control" title="開啟後此角色永久套用經典規則">
            <input type="checkbox" id="create-classic-toggle" ${state.createClassicMode ? 'checked' : ''} />
            <span>經典模式</span>
          </label>
          <button id="btn-start" class="creation-start-button" type="button" ${ptsLeft > 0 || !state.createCharName.trim() || state.charBusy ? 'disabled' : ''}>
            開始遊戲
          </button>
          <button id="creation-back-button" type="button">返回</button>
          <div id="creation-name-control">
            <label for="create-char-name">角色名稱</label>
            <input id="create-char-name" aria-label="角色名稱" maxlength="20" value="${escapeHtml(state.createCharName)}" placeholder="輸入角色名稱" />
          </div>
          ${
            state.stageNotice
              ? `<div style="position:absolute;left:7.4%;bottom:5%;z-index:8;background:rgba(97,33,38,.92);border:1px solid #f85149;border-radius:4px;padding:4px 10px;font-size:12px;color:#ffd7d9">${escapeHtml(state.stageNotice)}</div>`
              : ''
          }
        </div>
      </section>
    `;
  }

  if (state.stage === 'game' && state.activeCharacter) {
    // 遊戲本體是 284 天堂人生，以全畫面 iframe 掛在 #app-root 外（見 syncGameFrame）；這裡只是載入中的底層
    const failed = gameFrame && gameFrame.status === 'error';
    return `
      <section id="game-screen" class="ll-game-loading" aria-label="說話之島">
        <p>${failed ? escapeHtml(gameFrame.error || '遊戲載入失敗') : `正在進入說話之島… ${escapeHtml(state.activeCharacter.name)}`}</p>
        ${failed ? '<button id="game-back-select-btn" type="button" class="ll-steel-btn">返回角色選擇</button>' : ''}
      </section>
    `;
  }
  return '';
}

function renderLobbyView() {
  const ready = !localStore.runtime.maintenance;
  return `
    <div>
      <div class="ll-stage-shell">
        ${renderLobbyStage()}
      </div>

      <section class="card card-gold">
        <div class="row" style="justify-content:space-between">
          <div>
            <h2 style="margin:0 0 6px 0;font-size:20px">說話之島 #1 · 伺服器狀態</h2>
            <p class="muted" style="margin:0">${escapeHtml(localStore.runtime.maintenanceMessage)} · 首發進度 GI-0.5</p>
          </div>
          <div class="row">
            <span class="badge ${ready ? 'ok' : 'warn'}" data-testid="realm-status-badge">
              ${ready ? '正常運作 Operational' : '維護中 Maintenance'}
            </span>
            <span class="badge" data-testid="db-mode-badge">DB: ${shouldUseNetworkBackend() ? 'backend-api' : 'in-memory'}</span>
            <span class="badge" data-testid="build-badge">Build #656</span>
          </div>
        </div>
        <div class="row" style="margin-top:14px;justify-content:space-between">
          <div class="row">
            ${HUD_UI_ICONS.map(
              (icon) => `
              <img src="${icon.src}" alt="${escapeHtml(icon.label)}" title="${escapeHtml(icon.label)}" width="28" height="28" style="object-fit:contain;background:rgba(10,14,20,0.8);border:1px solid var(--border);border-radius:4px;padding:2px" />
            `,
            ).join('')}
          </div>
          <button id="btn-bgm-toggle" type="button" class="btn secondary" aria-pressed="${bgm.muted ? 'false' : 'true'}">背景音樂：${bgm.muted ? '關' : '開'}</button>
        </div>
      </section>

      <section class="card">
        <h2 style="margin-top:0;font-size:18px">背景服務與 316.5 MB 本機素材包狀態</h2>
        <div class="grid-2">
          <div>
            <p style="margin:4px 0">
              <strong>Service Worker (/art-cache-sw.js?build=656)：</strong>
              <span data-testid="sw-status-text">${escapeHtml(state.swStatusText)}</span>
            </p>
            <p class="muted" style="margin:4px 0;font-size:13px">${escapeHtml(state.assetSummary)}</p>
            <p class="muted" style="margin:4px 0;font-size:13px">原版 163（測試服 v326）：10,752 筆對應定義</p>
          </div>
          <div>
            <p style="margin:4px 0;font-size:13px">
              <strong>Auto Worker：</strong>
              <span data-testid="worker-auto-status">${escapeHtml(state.workerAutoStatus)}</span>
            </p>
            <p style="margin:4px 0;font-size:13px">
              <strong>Scenery Worker：</strong>
              <span data-testid="worker-scenery-status">${escapeHtml(state.workerSceneryStatus)}</span>
            </p>
            <div class="row" style="margin-top:8px">
              <button id="btn-preload-packs" type="button" class="btn secondary">預載本機分包快取</button>
              <span class="muted" style="font-size:12px">${escapeHtml(state.swPreloadProgress)}</span>
            </div>
          </div>
        </div>
      </section>

      <section class="card row" style="align-items:flex-start">
        <div style="max-width:100%">
          <canvas width="360" height="216" data-testid="realm-canvas" style="border:1px solid var(--border-gold);border-radius:8px;max-width:100%;height:auto"></canvas>
          <p class="muted" data-testid="map-chunk-status" style="font-size:12px;margin-top:6px">${escapeHtml(state.mapChunkStatus)}</p>
        </div>
        <div style="flex:1;min-width:min(100%,260px)">
          <h2 style="margin-top:0">即時通訊與站內導覽</h2>
          <div class="row" style="margin-bottom:12px">
            <button id="btn-ping-world" class="btn secondary" type="button">測試即時 Ticket + RPC Ping</button>
          </div>
          <p data-testid="auth-status" style="margin:4px 0">驗證狀態：${escapeHtml(state.authNotice)}</p>
          <p data-testid="realtime-status" style="margin:4px 0;color:var(--muted)">連線狀態：${escapeHtml(state.realtimeLog)}</p>
          <div class="row" style="margin-top:12px">
            <a href="#/guide" data-nav="/guide" class="btn secondary">瀏覽 243 筆圖鑑</a>
            <a href="#/rice" data-nav="/rice" class="btn secondary">前往能力骰子模擬</a>
            <a href="#/form" data-nav="/form" class="btn secondary">前往冒險者論壇</a>
            <a href="#/topup" data-nav="/topup" class="btn secondary">蛋幣儲值</a>
          </div>
        </div>
      </section>
    </div>
  `;
}

function renderOfficialView() {
  const scope = CAPTURED_DATA.releaseScope || {};
  const animals = scope.villageAnimals?.spawns || [];
  const monsters = scope.plannedMonsterIds || [];
  const pending = scope.pending || [];
  return `
    <div class="card card-gold">
      <h1 style="margin-top:0">天堂 1.63 說話之島 · 官方首發入口 (${escapeHtml(scope.plannedVersion || 'GI-0.5')})</h1>
      <p class="muted">Build #${scope.build || 656} · 保留地圖編號：${(scope.retainedMapIds || [0, 1, 2, 3]).join(', ')} · 納入 NPC：${(scope.includedNpcIds || ['npc:甘特']).join(', ')}</p>
      <div class="grid-2" style="margin-top:16px">
        <div class="card">
          <h3 style="margin-top:0;color:var(--accent-strong)">說話之島村莊生態生成 (${animals.length} 處)</h3>
          <ul style="margin:0;padding-left:18px;font-size:13px;line-height:1.7">
            ${animals.map((a) => `<li>${escapeHtml(a.name)} (${escapeHtml(a.id)}) — 座標 (${a.x}, ${a.y}) · 重生 ${a.respawn / 1000}s</li>`).join('')}
          </ul>
        </div>
        <div class="card">
          <h3 style="margin-top:0;color:var(--accent-strong)">港口黑騎士與克特遭遇戰 & 27 種首發怪物</h3>
          <p style="font-size:13px;line-height:1.6">港口定點小隊：克特 + 4 名黑騎士（座標 32620, 32965，重生 1 小時）。</p>
          <div class="row" style="gap:6px">
            ${monsters.map((m) => `<span class="badge">${escapeHtml(m.replace('monster:', ''))}</span>`).join('')}
          </div>
        </div>
      </div>
      <div class="card" style="margin-top:12px">
        <h3 style="margin-top:0">版本範圍待確認事項</h3>
        <ul style="margin:0;padding-left:18px;font-size:13px;line-height:1.7">
          ${pending.map((p) => `<li>${escapeHtml(p)}</li>`).join('')}
        </ul>
      </div>
    </div>
  `;
}

function renderGuideView() {
  const allRecords = CAPTURED_DATA.guide?.records || [];
  const catLabels = {
    '': '全部',
    class: '職業',
    monster: '怪物',
    item: '道具',
    skill: '技能',
    npc: 'NPC',
    map: '地圖',
    set: '套裝',
  };
  const q = state.guideQuery.trim().toLowerCase();
  const filtered = allRecords.filter((r) => {
    if (state.guideCategory && r.category !== state.guideCategory) return false;
    if (!q) return true;
    return (
      r.name.toLowerCase().includes(q) ||
      r.summary.toLowerCase().includes(q) ||
      r.id.toLowerCase().includes(q)
    );
  });
  const selected =
    filtered.find((r) => r.id === state.selectedGuideId) || filtered[0] || null;

  return `
    <div>
      <section class="card card-gold">
        <h1 style="margin:0 0 8px 0">天堂 1.63 首發攻略圖鑑（共 ${allRecords.length} 筆）</h1>
        <p class="muted" style="margin:0">當前篩選顯示 <strong>${filtered.length}</strong> 筆資料 · 支援分類檢索與 NPC 對話查詢</p>
        <div class="row" style="margin-top:14px">
          ${Object.entries(catLabels)
            .map(
              ([cat, label]) => `
            <button type="button" data-guide-cat="${cat}" class="btn ${state.guideCategory === cat ? '' : 'secondary'}">
              ${label}
            </button>
          `,
            )
            .join('')}
          <input
            id="guide-search-input"
            data-testid="guide-search-input"
            class="input"
            placeholder="搜尋名稱、技能、怪物或材料..."
            value="${escapeHtml(state.guideQuery)}"
            style="min-width:220px;flex:1"
          />
        </div>
      </section>

      <div class="grid-2" style="align-items:start">
        <section class="card" style="max-height:560px;overflow-y:auto" data-testid="guide-list">
          <h2 style="margin-top:0;font-size:18px">圖鑑條目 (${filtered.length})</h2>
          ${filtered
            .slice(0, 120)
            .map(
              (rec) => `
            <div
              data-guide-id="${escapeHtml(rec.id)}"
              style="padding:10px;border-bottom:1px solid var(--border);cursor:pointer;background:${selected?.id === rec.id ? 'rgba(212,173,99,0.12)' : 'transparent'}"
            >
              <div class="row" style="justify-content:space-between">
                <strong>${escapeHtml(rec.name)}</strong>
                <span class="badge">${escapeHtml(catLabels[rec.category] || rec.category)}${rec.level ? ` · Lv.${rec.level}` : ''}</span>
              </div>
              <p class="muted" style="margin:4px 0 0;font-size:13px">${escapeHtml(rec.summary)}</p>
            </div>
          `,
            )
            .join('')}
        </section>

        <section class="card" data-testid="guide-detail">
          ${
            selected
              ? `
            <div class="row" style="justify-content:space-between">
              <h2 style="margin:0">${escapeHtml(selected.name)}</h2>
              <span class="badge ok">${escapeHtml(selected.id)}</span>
            </div>
            ${
              selected.image
                ? `<div style="margin:12px 0"><img src="${assetUrl(selected.image.split('?')[0])}" alt="${escapeHtml(selected.name)}" style="max-height:96px;border-radius:6px;border:1px solid var(--border);background:#0c1118;padding:6px" /></div>`
                : ''
            }
            <p style="line-height:1.6">${escapeHtml(selected.summary)}</p>
            ${
              selected.facts?.length
                ? `
              <div class="table-scroll">
                <table class="data-table">
                  <tbody>
                    ${selected.facts.map(([k, v]) => `<tr><th>${escapeHtml(k)}</th><td>${escapeHtml(v)}</td></tr>`).join('')}
                  </tbody>
                </table>
              </div>
            `
                : ''
            }
            ${
              selected.notes?.length
                ? `<ul style="font-size:13px;line-height:1.6;color:var(--muted)">${selected.notes.map((n) => `<li>${escapeHtml(n)}</li>`).join('')}</ul>`
                : ''
            }
          `
              : '<p class="muted">找不到符合條件的條目</p>'
          }

          <hr style="border:0;border-top:1px solid var(--border);margin:18px 0" />
          <h3 style="margin-top:0">NPC 對話腳本查詢</h3>
          <div class="row">
            <input id="dialogue-search-input" class="input" value="${escapeHtml(state.dialogueQuery)}" placeholder="輸入 NPC 名稱（如：甘特、導師、潘朵拉）" style="flex:1" />
            <button id="btn-search-dialogue" type="button" class="btn secondary">查詢對話</button>
          </div>
          <div style="margin-top:10px;max-height:220px;overflow-y:auto">
            ${
              state.dialogueResults.length > 0
                ? state.dialogueResults
                    .map(
                      (d) => `
                  <div style="padding:8px;border:1px solid var(--border);border-radius:6px;margin-bottom:8px;font-size:13px">
                    <div class="badge" style="margin-bottom:4px">${escapeHtml(d.key)}</div>
                    <div>${d.html}</div>
                  </div>
                `,
                    )
                    .join('')
                : '<p class="muted" style="font-size:13px">輸入關鍵字後按「查詢對話」載入說話之島 NPC 腳本</p>'
            }
          </div>
        </section>
      </div>
    </div>
  `;
}

function renderForumView() {
  const activeTopic =
    state.forumTopics.find((t) => t.id === state.activeTopicId) || state.forumTopics[0] || null;
  return `
    <div>
      <section class="card card-gold">
        <h1 style="margin:0 0 6px 0">說話之島冒險者論壇</h1>
        <p class="muted" style="margin:0">提供情報交流、配點心得、打寶交易與官方公告回覆</p>
      </section>
      <div class="grid-2" style="align-items:start">
        <div>
          <section class="card">
            <h2 style="margin-top:0;font-size:18px">發表新討論串</h2>
            <div class="row" style="margin-bottom:8px">
              <input id="forum-author-input" class="input" value="${escapeHtml(state.newTopicAuthor)}" placeholder="作者暱稱" style="flex:1" />
              <select id="forum-cat-select">
                <option value="general" ${state.newTopicCategory === 'general' ? 'selected' : ''}>綜合討論</option>
                <option value="guide" ${state.newTopicCategory === 'guide' ? 'selected' : ''}>攻略心得</option>
                <option value="trade" ${state.newTopicCategory === 'trade' ? 'selected' : ''}>市集交易</option>
              </select>
            </div>
            <input id="forum-title-input" data-testid="forum-title-input" class="input" value="${escapeHtml(state.newTopicTitle)}" placeholder="討論串標題" style="width:100%;margin-bottom:8px" />
            <textarea id="forum-body-input" data-testid="forum-body-input" rows="3" placeholder="分享你在說話之島的冒險故事..." style="width:100%;margin-bottom:8px">${escapeHtml(state.newTopicBody)}</textarea>
            <div class="row">
              <button id="forum-submit-btn" data-testid="forum-submit-btn" class="btn" type="button">發佈主題</button>
              ${state.forumNotice ? `<span class="muted" style="font-size:13px">${escapeHtml(state.forumNotice)}</span>` : ''}
            </div>
          </section>

          <section class="card" data-testid="forum-topic-list">
            <h2 style="margin-top:0;font-size:18px">熱門討論串 (${state.forumTopics.length})</h2>
            ${state.forumTopics
              .map(
                (t) => `
              <div style="padding:10px;border-bottom:1px solid var(--border);background:${t.id === activeTopic?.id ? 'rgba(212,173,99,0.1)' : 'transparent'}">
                <div class="row" style="justify-content:space-between">
                  <strong data-topic-select="${escapeHtml(t.id)}" style="cursor:pointer;color:var(--accent-strong)">
                    ${t.pinned ? '📌 ' : ''}${escapeHtml(t.title)}
                  </strong>
                  <button type="button" class="btn secondary" data-topic-like="${escapeHtml(t.id)}" style="padding:3px 8px;font-size:12px">
                    👍 讚 (${t.likes})
                  </button>
                </div>
                <p class="muted" style="margin:4px 0 0;font-size:12px">
                  作者：${escapeHtml(t.authorName)} · 分類：${escapeHtml(t.category)} · 回覆：${t.replyCount}
                </p>
              </div>
            `,
              )
              .join('')}
          </section>
        </div>

        <section class="card">
          ${
            activeTopic
              ? `
            <h2 style="margin-top:0">${escapeHtml(activeTopic.title)}</h2>
            <p class="muted" style="font-size:12px">由 ${escapeHtml(activeTopic.authorName)} 發表</p>
            <p style="line-height:1.6;white-space:pre-wrap">${escapeHtml(activeTopic.body)}</p>
            <hr style="border:0;border-top:1px solid var(--border);margin:16px 0" />
            <h3 style="font-size:16px">留言回覆 (${state.forumPosts.length})</h3>
            <div data-testid="forum-post-list">
              ${state.forumPosts
                .map(
                  (p) => `
                <div style="padding:8px 0;border-bottom:1px solid var(--border)">
                  <strong>${escapeHtml(p.authorName)}</strong>
                  <p style="margin:4px 0 0">${escapeHtml(p.body)}</p>
                </div>
              `,
                )
                .join('')}
            </div>
            <div style="margin-top:14px">
              <input id="reply-author-input" class="input" value="${escapeHtml(state.replyAuthor)}" placeholder="回覆暱稱" style="width:100%;margin-bottom:8px" />
              <textarea id="reply-input" data-testid="reply-input" rows="2" placeholder="撰寫回覆..." style="width:100%;margin-bottom:8px">${escapeHtml(state.replyBody)}</textarea>
              <button id="reply-submit-btn" data-testid="reply-submit-btn" class="btn secondary" type="button">送出回覆</button>
            </div>
          `
              : '<p class="muted">請選擇左側討論串</p>'
          }
        </section>
      </div>
    </div>
  `;
}

function renderDiceView() {
  const def = DICE_CLASS_STATS[state.diceClassId] || DICE_CLASS_STATS.knight;
  return `
    <div>
      <section class="card card-gold">
        <h1 style="margin:0 0 6px 0">天堂 1.63 創角能力骰子模擬器</h1>
        <p class="muted" style="margin:0">精確還原創角獎勵點數池與單一屬性上限 18 規則，支援蒙地卡羅分佈統計</p>
      </section>
      <div class="grid-2">
        <section class="card">
          <h2 style="margin-top:0;font-size:18px">1. 選擇職業與擲骰</h2>
          <div class="row" style="margin-bottom:14px">
            ${Object.values(DICE_CLASS_STATS)
              .map(
                (c) => `
              <button type="button" data-dice-class="${c.id}" class="btn ${state.diceClassId === c.id ? '' : 'secondary'}">
                ${c.label} (+${c.bonusPool})
              </button>
            `,
              )
              .join('')}
          </div>
          <div class="row">
            <button id="roll-once-btn" data-testid="roll-once-btn" type="button" class="btn">🎲 隨機擲骰一次</button>
            <button id="simulate-btn" data-testid="simulate-btn" type="button" class="btn secondary">執行 500 次分佈模擬</button>
          </div>
          ${
            state.diceSimResult
              ? `<p data-testid="sim-result" style="margin-top:12px;color:var(--accent-strong)">500 次模擬完成：平均 STR = ${state.diceSimResult.averageStr}，觀測最高 STR = ${state.diceSimResult.maxStrObserved}</p>`
              : ''
          }
        </section>

        <section class="card" data-testid="dice-stat-panel">
          <h2 style="margin-top:0;font-size:18px">2. ${def.label} 能力結果（獎勵點數：${def.bonusPool}）</h2>
          <table class="data-table">
            <thead>
              <tr><th>屬性</th><th>基礎值</th><th>骰出加成</th><th>最終數值 (上限 18)</th></tr>
            </thead>
            <tbody>
              <tr><td>力量 STR</td><td>${def.base.str}</td><td>+${state.diceBonus.str}</td><td><strong>${state.diceFinal.str}</strong></td></tr>
              <tr><td>敏捷 DEX</td><td>${def.base.dex}</td><td>+${state.diceBonus.dex}</td><td><strong>${state.diceFinal.dex}</strong></td></tr>
              <tr><td>體質 CON</td><td>${def.base.con}</td><td>+${state.diceBonus.con}</td><td><strong>${state.diceFinal.con}</strong></td></tr>
              <tr><td>精神 WIS</td><td>${def.base.wis}</td><td>+${state.diceBonus.wis}</td><td><strong>${state.diceFinal.wis}</strong></td></tr>
              <tr><td>魅力 CHA</td><td>${def.base.cha}</td><td>+${state.diceBonus.cha}</td><td><strong>${state.diceFinal.cha}</strong></td></tr>
              <tr><td>智力 INT</td><td>${def.base.intel}</td><td>+${state.diceBonus.intel}</td><td><strong>${state.diceFinal.intel}</strong></td></tr>
            </tbody>
          </table>
        </section>
      </div>
    </div>
  `;
}

function renderTopupView() {
  return `
    <div>
      <section class="card card-gold">
        <h1 style="margin:0 0 6px 0">亞丁商會 · 蛋幣儲值與 Google Play 憑證中心</h1>
        <p class="muted" style="margin:0">整合 HMAC-SHA256 結帳簽章、Origin 跳轉驗證與 Google Play Billing 冪等發幣</p>
      </section>
      <div class="grid-2">
        <section class="card">
          <h2 style="margin-top:0;font-size:18px">1. 網頁儲值結帳 (Origin Pay)</h2>
          <div style="margin-bottom:10px">
            <label class="muted" style="font-size:13px">儲值目標帳號</label>
            <input id="topup-user-input" class="input" value="${escapeHtml(state.topupUsername)}" style="width:100%;margin-top:4px" />
          </div>
          <div style="margin-bottom:12px">
            ${EGG_PACKAGES.map(
              (pkg) => `
              <label style="display:flex;justify-content:space-between;padding:8px 10px;border:1px solid var(--border);border-radius:6px;margin-bottom:6px;cursor:pointer">
                <span>
                  <input type="radio" name="topup-pkg" value="${pkg.id}" ${state.topupPackageId === pkg.id ? 'checked' : ''} />
                  <strong style="margin-left:6px">${escapeHtml(pkg.label)}</strong>
                </span>
                <span style="color:var(--accent-strong)">NT$ ${pkg.amountTwd} (${pkg.baseEggs} + 贈 ${pkg.bonusEggs} 蛋幣)</span>
              </label>
            `,
            ).join('')}
          </div>
          <button id="checkout-btn" data-testid="checkout-btn" type="button" class="btn">建立儲值訂單</button>
          ${
            state.topupCheckout
              ? `
            <div style="margin-top:14px;padding:10px;background:#0d131b;border-radius:8px" data-testid="checkout-result">
              <p style="margin:4px 0">訂單編號：<strong>${escapeHtml(state.topupCheckout.order.orderNo)}</strong></p>
              <p style="margin:4px 0">應付金額：NT$ ${state.topupCheckout.order.amountTwd}（發放 ${state.topupCheckout.order.eggsGranted} 蛋幣）</p>
              <p class="muted" style="font-size:12px;word-break:break-all">HMAC 簽章：${escapeHtml(state.topupCheckout.signature)}</p>
              <div class="row" style="margin-top:8px">
                <button id="webhook-btn" data-testid="webhook-btn" type="button" class="btn">模擬金流回呼入帳 (Webhook)</button>
              </div>
            </div>
          `
              : ''
          }
          ${
            state.topupWebhookResult
              ? `<p data-testid="order-status-box" style="margin-top:10px;color:var(--ok)">${escapeHtml(state.topupWebhookResult)}</p>`
              : ''
          }
        </section>

        <section class="card">
          <h2 style="margin-top:0;font-size:18px">2. Google Play 購買憑證驗證 (Idempotent)</h2>
          <div style="margin-bottom:8px">
            <label class="muted" style="font-size:13px">商品 ID (ProductId)</label>
            <select id="gp-product-select" style="width:100%;margin-top:4px">
              <option value="com.lineage.eggs.150" ${state.gpProductId === 'com.lineage.eggs.150' ? 'selected' : ''}>com.lineage.eggs.150 (150 蛋幣)</option>
              <option value="com.lineage.eggs.550" ${state.gpProductId === 'com.lineage.eggs.550' ? 'selected' : ''}>com.lineage.eggs.550 (550 蛋幣)</option>
              <option value="com.lineage.eggs.1750" ${state.gpProductId === 'com.lineage.eggs.1750' ? 'selected' : ''}>com.lineage.eggs.1750 (1750 蛋幣)</option>
              <option value="com.lineage.eggs.3600" ${state.gpProductId === 'com.lineage.eggs.3600' ? 'selected' : ''}>com.lineage.eggs.3600 (3600 蛋幣)</option>
            </select>
          </div>
          <div style="margin-bottom:10px">
            <label class="muted" style="font-size:13px">Purchase Token</label>
            <input id="gp-token-input" class="input" value="${escapeHtml(state.gpToken)}" style="width:100%;margin-top:4px" />
          </div>
          <button id="gp-verify-btn" data-testid="gp-verify-btn" type="button" class="btn secondary">驗證憑證並領取蛋幣</button>
          ${
            state.gpResult
              ? `<p data-testid="gp-result" style="margin-top:10px;color:var(--accent-strong)">${escapeHtml(state.gpResult)}</p>`
              : ''
          }
        </section>
      </div>
    </div>
  `;
}

function renderGmView() {
  return `
    <div>
      <section class="card card-gold">
        <h1 style="margin:0 0 6px 0">亞丁 GM 管理與稽核控制台</h1>
        <p class="muted" style="margin:0">受 GM_ADMIN_TOKEN 保護之維護開關、帳號凍結、補償發放與異常回報檢視</p>
      </section>
      <section class="card">
        <div class="row">
          <input id="gm-token-input" data-testid="gm-token-input" class="input" value="${escapeHtml(state.gmToken)}" placeholder="輸入 GM Token" style="min-width:240px" />
          <button id="gm-load-btn" data-testid="gm-load-btn" type="button" class="btn">驗證並載入控制台</button>
        </div>
        ${state.gmError ? `<p style="color:var(--err);margin-top:8px" data-testid="gm-error">存取遭拒：${escapeHtml(state.gmError)}</p>` : ''}
      </section>
      ${
        state.gmData
          ? `
        <div class="grid-2">
          <section class="card" data-testid="gm-runtime-panel">
            <h2 style="margin-top:0;font-size:18px">1. 伺服器狀態與帳號操作</h2>
            <p>目前模式：<strong>${state.gmData.runtime.maintenance ? '維護中' : '正常開放'}</strong></p>
            <p class="muted" style="font-size:13px">${escapeHtml(state.gmData.runtime.maintenanceMessage)}</p>
            <button id="gm-maint-btn" data-testid="gm-maint-btn" type="button" class="btn secondary">
              ${state.gmData.runtime.maintenance ? '關閉維護模式（恢復開服）' : '開啟維護模式'}
            </button>
            <hr style="border:0;border-top:1px solid var(--border);margin:14px 0" />
            <div style="margin-bottom:8px">
              <label class="muted" style="font-size:13px">目標玩家帳號</label>
              <input id="gm-target-input" class="input" value="${escapeHtml(state.gmTargetUser)}" style="width:100%;margin-top:4px" />
            </div>
            <div class="row" style="margin-bottom:10px">
              <button id="gm-hold-btn" type="button" class="btn danger">凍結帳號</button>
              <button id="gm-unhold-btn" type="button" class="btn secondary">解除凍結</button>
            </div>
            <div class="row">
              <input id="gm-eggs-input" type="number" class="input" value="${state.gmEggsToGrant}" style="width:110px" />
              <button id="gm-grant-btn" type="button" class="btn">發放補償蛋幣</button>
            </div>
          </section>

          <section class="card">
            <h2 style="margin-top:0;font-size:18px">2. GM 稽核日誌 (${state.gmData.audits.length})</h2>
            <div style="max-height:200px;overflow-y:auto" data-testid="gm-audit-list">
              ${state.gmData.audits
                .map(
                  (a) => `<div style="padding:6px 0;border-bottom:1px solid var(--border);font-size:13px"><strong>${escapeHtml(a.action)}</strong> → ${escapeHtml(a.target)} <span class="muted">(${escapeHtml(a.actor)})</span></div>`,
                )
                .join('')}
            </div>
            <h3 style="font-size:16px;margin-top:16px">3. 客戶端遙測回報 (${state.gmData.reports.length})</h3>
            <div style="max-height:160px;overflow-y:auto">
              ${state.gmData.reports
                .map(
                  (r) => `<div style="padding:6px 0;border-bottom:1px solid var(--border);font-size:12px"><span class="badge">${escapeHtml(r.kind)}</span> ${escapeHtml(r.message)}</div>`,
                )
                .join('')}
            </div>
          </section>
        </div>
      `
          : ''
      }
    </div>
  `;
}

function renderPrivacyView(variant = 'primary') {
  return `
    <div class="card">
      <div class="row" style="justify-content:space-between">
        <h1 style="margin:0">隱私權與帳號資料保護政策 ${variant === 'secondary' ? '（精簡內嵌版 /privacy2）' : ''}</h1>
        <div class="row">
          <a href="#/privacy" data-nav="/privacy" class="btn ${variant === 'primary' ? '' : 'secondary'}">完整版 (/privacy)</a>
          <a href="#/privacy2" data-nav="/privacy2" class="btn ${variant === 'secondary' ? '' : 'secondary'}">精簡版 (/privacy2)</a>
        </div>
      </div>
      <p class="muted">最後更新日期：2026 年 11 月 · 適用範圍：天堂人生 1.63 說話之島獨立運作平台</p>
      <h3>1. 蒐集之資料範圍</h3>
      <p>本平台僅於您註冊遊戲帳號、建立角色、參與冒險者論壇或使用儲值服務時，蒐集必要之識別資訊（包含帳號名稱、雜湊後之密碼摘要、角色屬性紀錄及訂單編號）。</p>
      <h3>2. 認證與 Cookie 使用</h3>
      <p>本平台使用 HttpOnly Session Cookie（<code>realm_session</code>）維持登入狀態，並以 HMAC-SHA256 簽發短效 WebSocket 連線憑證，不嵌入第三方追蹤廣告腳本。</p>
      <h3>3. 本機快取與 Service Worker</h3>
      <p>為加速 1.63 經典地圖與 335 包分包素材載入，瀏覽器會透過 Service Worker（<code>art-cache-sw.js</code>）與 Cache Storage 儲存靜態美術分包。您可隨時於瀏覽器設定清除快取。</p>
    </div>
  `;
}

// 背景音樂：登入／選角放登入曲，創角放創角曲，進入說話之島放野外曲，離開大廳就暫停。
// 瀏覽器擋自動播放時，等第一次點擊或按鍵再開始。
const BGM_TRACKS = {
  login: '/lineage163/sound/linmusic_login.mp3',
  select: '/lineage163/sound/linmusic_login.mp3',
  create: '/assets/284/bgm/create.mp3',
  // game：遊戲本體（284）有自己的場景音樂，這裡不播
};
const bgm = {
  el: null,
  track: null,
  unlocked: false,
  muted: false,
};

function wantedBgmTrack() {
  if (state.route !== '/' || bgm.muted || document.hidden) return null;
  return BGM_TRACKS[state.stage] || null;
}

function syncBgm() {
  if (typeof Audio === 'undefined') return;
  const track = wantedBgmTrack();
  if (!track) {
    if (bgm.el && !bgm.el.paused) bgm.el.pause();
    return;
  }
  if (!bgm.el) {
    bgm.el = new Audio();
    bgm.el.loop = true;
    bgm.el.volume = 0.55;
    bgm.el.preload = 'auto';
  }
  if (bgm.track !== track) {
    bgm.track = track;
    bgm.el.src = assetUrl(track);
  }
  if (bgm.el.paused) {
    bgm.el.play().then(
      () => {
        bgm.unlocked = true;
      },
      () => {
        // 自動播放被擋：等使用者第一次互動
      },
    );
  }
}

// ── 進入遊戲：遊戲本體沿用 284 天堂人生 ──
// 以 srcdoc iframe 載入 web/284-lineage-life.html，並在它所有程式之前換掉 localStorage，
// 讓 286 的角色存檔全部落在 `ll286:` 前綴下，不會讀到或覆蓋使用者自己玩 284 的存檔。
// iframe 掛在 #app-root 外面，renderApp() 重繪時不會重新載入遊戲。
const GAME_FRAME_HTML = '284-lineage-life.html';
const GAME_STORE_PREFIX = 'll286:';
// 每個 286 帳號各自一組前綴，換帳號進同一欄位不會蓋掉別人的進度
function gameStorePrefix(username = state.username) {
  return `${GAME_STORE_PREFIX}${String(username || 'guest').trim().toLowerCase()}:`;
}
const gameStoreShim = (prefix) => `<script>(function(){
  var P = ${JSON.stringify(prefix)}, real;
  try { real = window.localStorage; } catch (e) { return; }
  function keys(){ var out = []; for (var i = 0; i < real.length; i++) { var k = real.key(i); if (k && k.indexOf(P) === 0) out.push(k.slice(P.length)); } return out; }
  var shim = {
    getItem: function (k) { return real.getItem(P + k); },
    setItem: function (k, v) { real.setItem(P + k, String(v)); },
    removeItem: function (k) { real.removeItem(P + k); },
    key: function (i) { var ks = keys(); return i >= 0 && i < ks.length ? ks[i] : null; },
    clear: function () { keys().forEach(function (k) { real.removeItem(P + k); }); },
    get length() { return keys().length; }
  };
  Object.defineProperty(window, 'localStorage', { configurable: true, get: function () { return shim; } });
})();<\/script>`;

let gameHtmlCache = null;
let gameFrame = null; // { token, el, status: 'loading'|'ready'|'error', mode, error }

function gameHandoffPayload(ch) {
  const def = getClassDef(ch.classId);
  const g = ch.gender === 'f' ? 'f' : 'm';
  return {
    slot: Number(ch.slot) || state.selectedSlot || 1,
    cls: def.classId,
    rawCls: `${g}_${def.rawBase}`,
    stats: { ...ch.stats },
    name: ch.name || '',
    classic: !!ch.classicMode,
    // 只用不會變的欄位綁定（createdAt 在離線模式每次載入都會重新產生）
    bindKey: `${ch.slot}|${ch.name}|${def.classId}|${g}`,
  };
}

// 在 284 的頁面環境裡執行：同一個角色就讀檔，否則用 286 的職業／性別／能力值在該欄位建角
const GAME_BOOT_SCRIPT = `(function () {
  var c = window.__ll286Char;
  var bindKey = 'll286_bind_' + c.slot;
  currentSlot = c.slot;
  if (localStorage.getItem(bindKey) === c.bindKey && slotSummary(c.slot)) {
    loadGame();
    return 'load';
  }
  localStorage.removeItem('lineage_idle_save_' + c.slot);
  var base = createBase[c.cls] || createBase.knight;
  curCreate = { rawCls: c.rawCls, cls: c.cls, str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 };
  ['str', 'dex', 'con', 'int', 'wis', 'cha'].forEach(function (k) {
    curCreate[k] = Math.max(0, (Number(c.stats[k]) || 0) - base[k]);
  });
  var classic = document.getElementById('create-classic-toggle');
  if (classic) classic.checked = c.classic;
  startGame();
  if (c.name) player.name = c.name;
  localStorage.setItem(bindKey, c.bindKey);
  if (typeof _flushSaveNow === 'function') _flushSaveNow();
  return 'create';
})()`;

// 286 刪除角色時，一併清掉該欄位在遊戲本體裡的存檔與綁定
function clearGameSlot(slot) {
  const prefix = gameStorePrefix();
  try {
    localStorage.removeItem(`${prefix}lineage_idle_save_${slot}`);
    localStorage.removeItem(`${prefix}ll286_bind_${slot}`);
  } catch {
    // 無法存取 localStorage（隱私模式等）
  }
}

function gameFrameWindow() {
  try {
    return gameFrame?.el?.contentWindow || null;
  } catch {
    return null;
  }
}

function leaveGameToSelect() {
  state.stage = 'select';
  state.activeCharacter = null;
  renderApp();
}

function bootGameInFrame(token, payload) {
  const w = gameFrameWindow();
  if (!w || gameFrame?.token !== token) return;
  try {
    // 284 的「回選角」：先讓 284 自己存檔收尾，再回到 286 的選角畫面
    const originalReturn = w.returnToCharacterSelect;
    w.returnToCharacterSelect = function () {
      try {
        if (typeof originalReturn === 'function') originalReturn.apply(this, arguments);
      } finally {
        leaveGameToSelect();
      }
      return true;
    };
    w.__ll286Char = payload;
    gameFrame.mode = w.eval(GAME_BOOT_SCRIPT);
    gameFrame.status = 'ready';
    gameFrame.el.classList.add('ready');
  } catch (err) {
    gameFrame.status = 'error';
    gameFrame.error = `遊戲啟動失敗：${err?.message || err}`;
    renderApp();
  }
}

async function mountGameFrame(ch) {
  const token = {};
  gameFrame = { token, el: null, status: 'loading', mode: null, error: null };
  const payload = gameHandoffPayload(ch);
  try {
    if (!gameHtmlCache) {
      const res = await fetch(GAME_FRAME_HTML, { cache: 'no-cache' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      gameHtmlCache = await res.text();
    }
  } catch {
    if (gameFrame?.token !== token) return;
    gameFrame.status = 'error';
    gameFrame.error = '無法載入遊戲本體，請透過 HTTP 伺服器開啟本頁（file:// 無法載入）。';
    renderApp();
    return;
  }
  if (gameFrame?.token !== token) return;
  const el = document.createElement('iframe');
  el.id = 'll-game-frame';
  el.title = '說話之島';
  el.setAttribute('allow', 'autoplay; fullscreen');
  const shim = gameStoreShim(gameStorePrefix());
  el.srcdoc = gameHtmlCache.replace(/<head[^>]*>/i, (m) => `${m}\n${shim}`);
  el.addEventListener('load', () => bootGameInFrame(token, payload), { once: true });
  gameFrame.el = el;
  document.body.appendChild(el);
}

function unmountGameFrame() {
  if (!gameFrame) return;
  const w = gameFrameWindow();
  if (w && gameFrame.status === 'ready') {
    try {
      w.eval(
        "if (typeof _flushSaveNow === 'function') _flushSaveNow();" +
          "if (typeof _roleSessionForget === 'function') _roleSessionForget();",
      );
    } catch {
      // 遊戲已卸載
    }
  }
  gameFrame.el?.remove();
  gameFrame = null;
}

function syncGameFrame() {
  const wanted = state.route === '/' && state.stage === 'game' && state.activeCharacter;
  if (wanted && !gameFrame) void mountGameFrame(state.activeCharacter);
  else if (!wanted && gameFrame) unmountGameFrame();
}

function bindBgmUnlock() {
  const unlock = () => {
    if (bgm.unlocked) return;
    syncBgm();
  };
  window.addEventListener('pointerdown', unlock, true);
  window.addEventListener('keydown', unlock, true);
  document.addEventListener('visibilitychange', syncBgm);
}

export function renderApp() {
  const root = document.getElementById('app-root');
  if (!root) return;

  let contentHtml = '';
  if (state.route === '/official') contentHtml = renderOfficialView();
  else if (state.route === '/guide') contentHtml = renderGuideView();
  else if (state.route === '/form') contentHtml = renderForumView();
  else if (state.route === '/rice') contentHtml = renderDiceView();
  else if (state.route === '/topup' || state.route.startsWith('/topup')) contentHtml = renderTopupView();
  else if (state.route === '/gm') contentHtml = renderGmView();
  else if (state.route === '/privacy') contentHtml = renderPrivacyView('primary');
  else if (state.route === '/privacy2') contentHtml = renderPrivacyView('secondary');
  else contentHtml = renderLobbyView();

  syncBgm();
  syncGameFrame();

  // 登入、選角與遊戲畫面只顯示舞台，不顯示導覽列與其他區塊
  const stageOnly =
    state.route === '/' && (state.stage === 'login' || state.stage === 'select' || state.stage === 'game');
  document.body.classList.toggle('ll-stage-only', stageOnly);
  if (stageOnly) {
    root.innerHTML = `
      <main class="ll-stage-only-main">
        ${renderLobbyStage()}
      </main>
    `;
    return;
  }

  root.innerHTML = `
    ${renderTopbar()}
    <main class="container">
      ${contentHtml}
    </main>
  `;

  if (state.route === '/') {
    drawIslandCanvas();
  }
}

async function handleAuthAction(action) {
  state.charBusy = true;
  state.stageNotice = '驗證帳號中...';
  renderApp();
  const { status, data } = await apiRequest('auth', {
    method: 'POST',
    body: { action, username: state.username, password: state.password },
  });
  state.charBusy = false;
  if (status >= 400 || !data.ok) {
    const msg = formatError(data.error, status);
    state.authNotice = msg;
    state.stageNotice = msg;
    renderApp();
    return null;
  }
  state.sessionId = data.sessionId;
  state.authNotice = `已登入：${data.account.username} (蛋幣 ${data.account.eggs})`;
  state.stageNotice = `登入成功，歡迎 ${data.account.username}`;
  renderApp();
  return data.sessionId;
}

async function loadCharactersAndOpenSelect(overrideSid) {
  const sid = overrideSid || state.sessionId;
  if (!sid) {
    state.stageNotice = '請先登入帳號';
    renderApp();
    return;
  }
  state.charBusy = true;
  renderApp();
  const { status, data } = await apiRequest('characters', {
    method: 'GET',
    headers: { 'x-game-session': sid },
  });
  state.charBusy = false;
  if (status >= 400 || !data.ok) {
    state.stageNotice = formatError(data.error, status);
    renderApp();
    return;
  }
  const padded = Array.from({ length: 8 }, (_, idx) => data.slots?.[idx] ?? null);
  state.slots = padded;
  const firstFilled = padded.findIndex((c) => c !== null);
  const initialSlot = firstFilled >= 0 ? firstFilled + 1 : 1;
  state.selectedSlot = initialSlot;
  state.selectPage = initialSlot > 4 ? 1 : 0;
  state.stageNotice = '';
  state.stage = 'select';
  renderApp();
}

async function handleQuickStart() {
  state.charBusy = true;
  state.stageNotice = '連線至說語之島認證伺服器...';
  renderApp();
  let res = await apiRequest('auth', {
    method: 'POST',
    body: { action: 'register', username: state.username, password: state.password },
  });
  if (res.status === 409 || res.data?.error === 'username_taken') {
    res = await apiRequest('auth', {
      method: 'POST',
      body: { action: 'login', username: state.username, password: state.password },
    });
  }
  state.charBusy = false;
  if (res.status >= 400 || !res.data?.ok) {
    const msg = formatError(res.data?.error, res.status);
    state.authNotice = msg;
    state.stageNotice = msg;
    renderApp();
    return;
  }
  state.sessionId = res.data.sessionId;
  state.authNotice = `已登入：${res.data.account.username} (蛋幣 ${res.data.account.eggs})`;
  await loadCharactersAndOpenSelect(res.data.sessionId);
}

async function pingWorld() {
  let activeSession = state.sessionId;
  if (!activeSession) {
    const reg = await handleAuthAction('register');
    activeSession = reg || (await handleAuthAction('login'));
  }
  if (!activeSession) return;
  const rt = await apiRequest('realtime', { method: 'POST', body: { sessionId: activeSession } });
  if (!rt.data?.ok) {
    state.realtimeLog = `Ticket 失敗：${rt.data?.error || 'unknown'}`;
    renderApp();
    return;
  }
  const world = await apiRequest('world', {
    method: 'POST',
    body: { ticket: rt.data.ticket, frame: JSON.stringify({ t: 'ping', s: 1, p: {} }) },
  });
  state.realtimeLog = world.data?.ok
    ? `收到伺服器 Frame: ${world.data.frame}`
    : `Ping 失敗：${world.data?.error || 'unknown'}`;
  renderApp();
}

function bindGlobalEvents() {
  document.addEventListener('input', (e) => {
    const t = e.target;
    if (!t) return;
    if (t.id === 'login-username') state.username = t.value;
    else if (t.id === 'login-password') state.password = t.value;
    else if (t.id === 'delete-confirm-input') state.confirmName = t.value;
    else if (t.id === 'import-json-textarea') state.importText = t.value;
    else if (t.id === 'create-char-name') state.createCharName = t.value;
    else if (t.id === 'guide-search-input') {
      state.guideQuery = t.value;
      renderApp();
      const input = document.getElementById('guide-search-input');
      if (input) {
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
      }
    } else if (t.id === 'dialogue-search-input') state.dialogueQuery = t.value;
    else if (t.id === 'forum-author-input') state.newTopicAuthor = t.value;
    else if (t.id === 'forum-title-input') state.newTopicTitle = t.value;
    else if (t.id === 'forum-body-input') state.newTopicBody = t.value;
    else if (t.id === 'reply-author-input') state.replyAuthor = t.value;
    else if (t.id === 'reply-input') state.replyBody = t.value;
    else if (t.id === 'topup-user-input') state.topupUsername = t.value;
    else if (t.id === 'gp-token-input') state.gpToken = t.value;
    else if (t.id === 'gm-token-input') state.gmToken = t.value;
    else if (t.id === 'gm-target-input') state.gmTargetUser = t.value;
    else if (t.id === 'gm-eggs-input') state.gmEggsToGrant = Number(t.value || 0);
  });

  document.addEventListener('change', (e) => {
    const t = e.target;
    if (!t) return;
    if (t.id === 'create-classic-toggle') {
      state.createClassicMode = Boolean(t.checked);
      renderApp();
    } else if (t.id === 'forum-cat-select') {
      state.newTopicCategory = t.value;
    } else if (t.name === 'topup-pkg') {
      state.topupPackageId = t.value;
      renderApp();
    } else if (t.id === 'gp-product-select') {
      state.gpProductId = t.value;
    }
  });

  document.addEventListener('click', async (e) => {
    if (e.target.closest('#btn-bgm-toggle')) {
      bgm.muted = !bgm.muted;
      renderApp();
      return;
    }
    const navEl = e.target.closest('[data-nav]');
    if (navEl) {
      e.preventDefault();
      const targetRoute = navEl.getAttribute('data-nav') || '/';
      state.route = targetRoute;
      window.location.hash = `#${targetRoute}`;
      if (targetRoute === '/guide' && state.dialogueResults.length === 0) {
        await ensureDialoguesLoaded();
        state.dialogueResults = searchLocalDialogues(state.dialogueQuery);
      }
      renderApp();
      return;
    }

    const btn = e.target.closest('button, [data-guide-id], [data-topic-select]');
    if (!btn) return;

    // Lobby actions
    if (btn.id === 'btn-quick-start') {
      await handleQuickStart();
      return;
    }
    if (btn.id === 'btn-auth-register') {
      const sid = await handleAuthAction('register');
      if (sid) await loadCharactersAndOpenSelect(sid);
      return;
    }
    if (btn.id === 'btn-auth-login') {
      const sid = await handleAuthAction('login');
      if (sid) await loadCharactersAndOpenSelect(sid);
      return;
    }
    if (btn.hasAttribute('data-slot')) {
      const slotNo = Number(btn.getAttribute('data-slot'));
      state.selectedSlot = slotNo;
      renderApp();
      return;
    }
    if (btn.id === 'load-page-1') {
      state.selectPage = 0;
      state.selectedSlot = 1;
      renderApp();
      return;
    }
    if (btn.id === 'load-page-2') {
      state.selectPage = 1;
      state.selectedSlot = 5;
      renderApp();
      return;
    }
    if (btn.id === 'load-btn-create') {
      state.createTargetSlot = state.selectedSlot;
      state.createClassId = 'royal';
      state.createGender = 'm';
      state.createAlloc = { str: 0, dex: 0, con: 0, wis: 0, cha: 0, int: 0 };
      state.createCharName = `王族${state.selectedSlot}`;
      state.stageNotice = '';
      state.stage = 'create';
      renderApp();
      return;
    }
    if (btn.id === 'load-btn-enter') {
      const { status, data } = await apiRequest('characters', {
        method: 'POST',
        headers: { 'x-game-session': state.sessionId || 'local' },
        body: { action: 'enter', slot: state.selectedSlot },
      });
      if (status < 400 && data.ok) {
        state.activeCharacter = data.character;
        state.stage = 'game';
        state.realtimeLog = `已進入 ${data.worldSpawn.mapName} (${data.worldSpawn.x}, ${data.worldSpawn.y})`;
        renderApp();
      }
      return;
    }
    if (btn.id === 'load-btn-delete') {
      state.modalMode = 'delete';
      state.confirmName = '';
      state.localModalError = '';
      renderApp();
      return;
    }
    if (btn.id === 'load-btn-import') {
      state.modalMode = 'import';
      state.importText = '';
      state.localModalError = '';
      renderApp();
      return;
    }
    if (btn.id === 'modal-cancel-btn') {
      state.modalMode = null;
      renderApp();
      return;
    }
    if (btn.id === 'modal-confirm-delete-btn') {
      const selectedChar = state.slots[state.selectedSlot - 1];
      if (!selectedChar) return;
      if (state.confirmName.trim() !== selectedChar.name) {
        state.localModalError = `請輸入完整角色名稱「${selectedChar.name}」以確認刪除`;
        renderApp();
        return;
      }
      const { status, data } = await apiRequest('characters', {
        method: 'POST',
        headers: { 'x-game-session': state.sessionId || 'local' },
        body: { action: 'delete', slot: state.selectedSlot, confirmName: state.confirmName.trim() },
      });
      if (status < 400 && data.ok) {
        clearGameSlot(state.selectedSlot);
        state.slots = Array.from({ length: 8 }, (_, idx) => data.slots?.[idx] ?? null);
        state.modalMode = null;
        state.stageNotice = `欄位 ${state.selectedSlot} 角色已刪除`;
        renderApp();
      }
      return;
    }
    if (btn.id === 'modal-confirm-import-btn') {
      try {
        const parsed = JSON.parse(state.importText);
        const { status, data } = await apiRequest('characters', {
          method: 'POST',
          headers: { 'x-game-session': state.sessionId || 'local' },
          body: { action: 'import', slot: state.selectedSlot, saveData: parsed },
        });
        if (status < 400 && data.ok) {
          state.slots = Array.from({ length: 8 }, (_, idx) => data.slots?.[idx] ?? null);
          state.modalMode = null;
          state.stageNotice = `已匯入角色「${data.character.name}」`;
          renderApp();
        }
      } catch {
        state.localModalError = '匯入失敗：JSON 格式無效';
        renderApp();
      }
      return;
    }
    if (btn.id === 'load-btn-back' || btn.id === 'game-logout-btn') {
      state.stage = 'login';
      state.activeCharacter = null;
      state.stageNotice = '';
      renderApp();
      return;
    }
    if (btn.id === 'game-back-select-btn' || btn.id === 'creation-back-button') {
      state.stage = 'select';
      state.stageNotice = '';
      renderApp();
      return;
    }
    if (btn.hasAttribute('data-class-id')) {
      const nextId = btn.getAttribute('data-class-id');
      const nextDef = getClassDef(nextId);
      state.createClassId = nextId;
      state.createAlloc = { str: 0, dex: 0, con: 0, wis: 0, cha: 0, int: 0 };
      state.createCharName = `${nextDef.name}${state.createTargetSlot}`;
      renderApp();
      return;
    }
    if (btn.id === 'btn-gender-m') {
      state.createGender = 'm';
      renderApp();
      return;
    }
    if (btn.id === 'btn-gender-f') {
      state.createGender = 'f';
      renderApp();
      return;
    }
    if (btn.hasAttribute('data-stat-inc')) {
      const k = btn.getAttribute('data-stat-inc');
      const def = getClassDef(state.createClassId);
      const spent = STAT_KEYS.reduce((s, key) => s + (state.createAlloc[key] || 0), 0);
      const ptsLeft = def.base.pts - spent;
      const total = def.base[k] + (state.createAlloc[k] || 0);
      if (ptsLeft > 0 && total < CREATION_STAT_CAP) {
        state.createAlloc[k] = (state.createAlloc[k] || 0) + 1;
        renderApp();
      }
      return;
    }
    if (btn.hasAttribute('data-stat-dec')) {
      const k = btn.getAttribute('data-stat-dec');
      if ((state.createAlloc[k] || 0) > 0) {
        state.createAlloc[k] -= 1;
        renderApp();
      }
      return;
    }
    if (btn.id === 'btn-start') {
      const { status, data } = await apiRequest('characters', {
        method: 'POST',
        headers: { 'x-game-session': state.sessionId || 'local' },
        body: {
          action: 'create',
          slot: state.createTargetSlot,
          name: state.createCharName.trim(),
          classId: state.createClassId,
          gender: state.createGender,
          classicMode: state.createClassicMode,
          bonusStats: state.createAlloc,
        },
      });
      if (status < 400 && data.ok) {
        state.slots = Array.from({ length: 8 }, (_, idx) => data.slots?.[idx] ?? null);
        state.selectedSlot = data.character.slot;
        state.selectPage = data.character.slot > 4 ? 1 : 0;
        state.stageNotice = `已創立角色「${data.character.name}」`;
        state.stage = 'select';
        renderApp();
      } else {
        state.stageNotice = formatError(data.error, status);
        renderApp();
      }
      return;
    }
    if (btn.id === 'btn-ping-world') {
      await pingWorld();
      return;
    }
    if (btn.id === 'btn-preload-packs') {
      state.swPreloadProgress = '已完成 335 包分包索引驗證 (modern-all-characters343)';
      renderApp();
      return;
    }

    // Guide actions
    if (btn.hasAttribute('data-guide-cat')) {
      state.guideCategory = btn.getAttribute('data-guide-cat') || '';
      renderApp();
      return;
    }
    if (btn.hasAttribute('data-guide-id')) {
      state.selectedGuideId = btn.getAttribute('data-guide-id');
      renderApp();
      return;
    }
    if (btn.id === 'btn-search-dialogue') {
      await ensureDialoguesLoaded();
      state.dialogueResults = searchLocalDialogues(state.dialogueQuery);
      renderApp();
      return;
    }

    // Forum actions
    if (btn.id === 'forum-submit-btn') {
      if (state.newTopicTitle.trim().length < 2 || state.newTopicBody.trim().length < 2) {
        state.forumNotice = '標題與內文至少需 2 個字元';
        renderApp();
        return;
      }
      const { data } = await apiRequest('forum', {
        method: 'POST',
        body: {
          action: 'create_topic',
          title: state.newTopicTitle,
          body: state.newTopicBody,
          authorName: state.newTopicAuthor,
          category: state.newTopicCategory,
        },
      });
      if (data.ok) {
        state.newTopicTitle = '';
        state.newTopicBody = '';
        state.forumNotice = '已成功發佈新討論串！';
        const list = await apiRequest('forum');
        state.forumTopics = list.data.topics;
        state.activeTopicId = data.topic.id;
        state.forumPosts = [];
        renderApp();
      }
      return;
    }
    if (btn.hasAttribute('data-topic-select')) {
      const tid = btn.getAttribute('data-topic-select');
      state.activeTopicId = tid;
      const res = await apiRequest(`forum?topicId=${encodeURIComponent(tid)}`);
      state.forumPosts = res.data.posts || [];
      renderApp();
      return;
    }
    if (btn.hasAttribute('data-topic-like')) {
      const tid = btn.getAttribute('data-topic-like');
      await apiRequest('forum', { method: 'POST', body: { action: 'like_topic', topicId: tid } });
      const res = await apiRequest(`forum?topicId=${encodeURIComponent(state.activeTopicId || '')}`);
      state.forumTopics = res.data.topics;
      renderApp();
      return;
    }
    if (btn.id === 'reply-submit-btn') {
      if (!state.activeTopicId || !state.replyBody.trim()) return;
      await apiRequest('forum', {
        method: 'POST',
        body: {
          action: 'create_post',
          topicId: state.activeTopicId,
          authorName: state.replyAuthor,
          body: state.replyBody,
        },
      });
      state.replyBody = '';
      const res = await apiRequest(`forum?topicId=${encodeURIComponent(state.activeTopicId)}`);
      state.forumTopics = res.data.topics;
      state.forumPosts = res.data.posts || [];
      renderApp();
      return;
    }

    // Dice actions
    if (btn.hasAttribute('data-dice-class')) {
      const cid = btn.getAttribute('data-dice-class');
      state.diceClassId = cid;
      rollDiceForClass(cid);
      state.diceSimResult = null;
      renderApp();
      return;
    }
    if (btn.id === 'roll-once-btn') {
      rollDiceForClass(state.diceClassId);
      renderApp();
      return;
    }
    if (btn.id === 'simulate-btn') {
      let sumStr = 0;
      let maxStr = 0;
      for (let i = 0; i < 500; i += 1) {
        const res = rollDiceForClass(state.diceClassId);
        sumStr += res.final.str;
        if (res.final.str > maxStr) maxStr = res.final.str;
      }
      state.diceSimResult = {
        averageStr: Number((sumStr / 500).toFixed(2)),
        maxStrObserved: maxStr,
      };
      renderApp();
      return;
    }

    // Topup actions
    if (btn.id === 'checkout-btn') {
      const { data } = await apiRequest('payments', {
        method: 'POST',
        body: { action: 'checkout', username: state.topupUsername, packageId: state.topupPackageId },
      });
      if (data.ok) {
        state.topupCheckout = data;
        state.topupWebhookResult = null;
        renderApp();
      }
      return;
    }
    if (btn.id === 'webhook-btn' && state.topupCheckout) {
      const { data } = await apiRequest('payments', {
        method: 'POST',
        body: {
          action: 'webhook',
          orderNo: state.topupCheckout.order.orderNo,
          signature: state.topupCheckout.signature,
        },
      });
      state.topupWebhookResult = data.ok
        ? `入帳完成！訂單狀態：${data.order.status} · 帳號目前蛋幣：${data.accountEggs}`
        : `Webhook 失敗：${data.error}`;
      renderApp();
      return;
    }
    if (btn.id === 'gp-verify-btn') {
      const { data } = await apiRequest('google-play-billing', {
        method: 'POST',
        body: {
          username: state.topupUsername,
          productId: state.gpProductId,
          purchaseToken: state.gpToken,
        },
      });
      state.gpResult = data.ok
        ? `驗證成功 (duplicate=${String(data.duplicate)}) · 本次發放 ${data.eggsGranted} 蛋幣 · 總餘額 ${data.accountEggs}`
        : `驗證失敗：${data.error}`;
      renderApp();
      return;
    }

    // GM actions
    if (btn.id === 'gm-load-btn') {
      const { status, data } = await apiRequest('gm', {
        method: 'GET',
        headers: { 'x-gm-token': state.gmToken },
      });
      if (status >= 400 || !data.ok) {
        state.gmError = data.error || 'unauthorized_gm';
        state.gmData = null;
      } else {
        state.gmError = null;
        state.gmData = data;
      }
      renderApp();
      return;
    }
    if (btn.id === 'gm-maint-btn' && state.gmData) {
      await apiRequest('gm', {
        method: 'POST',
        headers: { 'x-gm-token': state.gmToken },
        body: {
          actor: 'gm-console',
          action: 'toggle_maintenance',
          maintenance: !state.gmData.runtime.maintenance,
        },
      });
      const refreshed = await apiRequest('gm', {
        method: 'GET',
        headers: { 'x-gm-token': state.gmToken },
      });
      state.gmData = refreshed.data;
      renderApp();
      return;
    }
    if (btn.id === 'gm-hold-btn' || btn.id === 'gm-unhold-btn') {
      await apiRequest('gm', {
        method: 'POST',
        headers: { 'x-gm-token': state.gmToken },
        body: {
          actor: 'gm-console',
          action: btn.id === 'gm-hold-btn' ? 'hold_account' : 'unhold_account',
          target: state.gmTargetUser,
        },
      });
      const refreshed = await apiRequest('gm', {
        method: 'GET',
        headers: { 'x-gm-token': state.gmToken },
      });
      state.gmData = refreshed.data;
      renderApp();
      return;
    }
    if (btn.id === 'gm-grant-btn') {
      await apiRequest('gm', {
        method: 'POST',
        headers: { 'x-gm-token': state.gmToken },
        body: {
          actor: 'gm-console',
          action: 'grant_eggs',
          target: state.gmTargetUser,
          eggs: state.gmEggsToGrant,
        },
      });
      const refreshed = await apiRequest('gm', {
        method: 'GET',
        headers: { 'x-gm-token': state.gmToken },
      });
      state.gmData = refreshed.data;
      renderApp();
      return;
    }
  });
}

function rollDiceForClass(cid) {
  const def = DICE_CLASS_STATS[cid] || DICE_CLASS_STATS.knight;
  const keys = ['str', 'dex', 'con', 'wis', 'cha', 'intel'];
  const current = { ...def.base };
  const bonus = { str: 0, dex: 0, con: 0, wis: 0, cha: 0, intel: 0 };
  let rem = def.bonusPool;
  let guard = 0;
  while (rem > 0 && guard < 300) {
    guard += 1;
    const valid = keys.filter((k) => current[k] < 18);
    if (!valid.length) break;
    const picked = valid[Math.floor(Math.random() * valid.length)];
    current[picked] += 1;
    bonus[picked] += 1;
    rem -= 1;
  }
  state.diceBonus = bonus;
  state.diceFinal = current;
  return { bonus, final: current };
}

async function initBackgroundProbes() {
  // 1. Load art-assets.json manifest
  try {
    const res = await fetch(assetUrl('/art-assets.json'));
    if (res.ok) {
      const data = await res.json();
      const packCount = data.packs?.length ?? 0;
      const totalBytes = (data.packs ?? []).reduce((sum, p) => sum + (p.bytes || 0), 0);
      state.assetSummary = `版本 ${data.version ?? 'modern'} · ${packCount} 包分包 (${(totalBytes / 1048576).toFixed(2)} MB) · ${data.assets?.length ?? 0} 筆資源 (來源: ${data.packOrigin ?? '/packs'})`;
      renderApp();
    }
  } catch {
    state.assetSummary = '版本 modern-all-characters343 · 335 包分包 (316.50 MB) · 14305 筆資源';
  }

  // 2. Probe Web Workers
  try {
    const autoW = new Worker(assetUrl('/auto-worker465.js'));
    autoW.onerror = (ev) => {
      ev.preventDefault?.();
      state.workerAutoStatus = '已就緒 (/auto-worker465.js 內建後援)';
      autoW.terminate();
    };
    autoW.onmessage = (ev) => {
      if (ev.data?.type === 'tick' || ev.data?.type === 'result') {
        state.workerAutoStatus = '已就緒 (/auto-worker465.js)';
        renderApp();
        autoW.terminate();
      }
    };
    autoW.postMessage({ id: 'probe-1', input: {} });
  } catch {
    state.workerAutoStatus = '已就緒 (內建後援)';
  }

  try {
    const scenW = new Worker(assetUrl('/scenery-worker289.js'));
    scenW.onerror = (ev) => {
      ev.preventDefault?.();
      state.workerSceneryStatus = '已載入 (/scenery-worker289.js 內建後援)';
      scenW.terminate();
    };
    state.workerSceneryStatus = '已載入 (/scenery-worker289.js)';
    scenW.terminate();
  } catch {
    state.workerSceneryStatus = '已載入 (內建後援)';
  }

  // 3. Load and decompress real gzipped map chunk
  try {
    const res = await fetch(assetUrl('/lineage163/maps/0/7ff88000.json.gz'));
    if (res.ok && res.body && typeof DecompressionStream !== 'undefined') {
      const jsonText = await new Response(res.body.pipeThrough(new DecompressionStream('gzip'))).text();
      const chunk = JSON.parse(jsonText);
      window.__lastMapChunkData = chunk;
      state.mapChunkStatus = `已解壓縮說語島區塊 /lineage163/maps/0/7ff88000.json.gz (${(chunk.floor || []).length} 筆地磚)`;
      renderApp();
    }
  } catch {
    state.mapChunkStatus = '地圖資料已透過本機後援渲染就緒';
  }
}

export function bootLineageWebApp() {
  const hash = window.location.hash.replace(/^#/, '');
  if (hash.startsWith('/')) {
    state.route = hash.split('?')[0];
  }
  window.addEventListener('hashchange', () => {
    const nextHash = window.location.hash.replace(/^#/, '');
    if (nextHash.startsWith('/')) {
      state.route = nextHash.split('?')[0];
      renderApp();
    }
  });

  bindGlobalEvents();
  bindBgmUnlock();
  renderApp();
  void initBackgroundProbes();
  void probeBackend().then((on) => {
    if (on) renderApp();
  });

  window.__lineage = {
    ready: true,
    getState: () => ({
      route: state.route,
      stage: state.stage,
      username: state.username,
      sessionId: state.sessionId,
      charactersCount: (state.slots || []).filter(Boolean).length,
      selectedSlot: state.selectedSlot,
      activeCharacter: state.activeCharacter,
      realtimeLog: state.realtimeLog,
      assetSummary: state.assetSummary,
      workerAutoStatus: state.workerAutoStatus,
      workerSceneryStatus: state.workerSceneryStatus,
      mapChunkStatus: state.mapChunkStatus,
      bgmTrack: bgm.track,
      bgmPlaying: Boolean(bgm.el && !bgm.el.paused),
      bgmMuted: bgm.muted,
      gameFrame: gameFrame ? { status: gameFrame.status, mode: gameFrame.mode, error: gameFrame.error } : null,
      guideTotal: (CAPTURED_DATA.guide?.records || []).length,
      dialogueResultsCount: state.dialogueResults.length,
      forumTopicsCount: state.forumTopics.length,
      forumPostsCount: state.forumPosts.length,
    }),
    navigate: (route) => {
      window.location.hash = `#${route}`;
      state.route = route;
      renderApp();
    },
    pingWorld: () => pingWorld(),
    gameWindow: () => gameFrameWindow(),
    setStage: (stage) => {
      state.stage = stage;
      renderApp();
    },
  };

  setInterval(() => {
    animFrameIdx += 1;
    const loginImg = document.getElementById('login-anim-image');
    if (loginImg) {
      loginImg.src = LOGIN_ANIM_FRAMES[animFrameIdx % LOGIN_ANIM_FRAMES.length];
    }
    if (state.stage === 'select') {
      // 選角：空槽播 none 影格，選中的角色播自己的待機動畫（同 284）
      const emptySrc = EMPTY_SLOT_FRAMES[animFrameIdx % EMPTY_SLOT_FRAMES.length];
      document.querySelectorAll('.load-slot-card.empty img').forEach((img) => {
        img.src = emptySrc;
      });
      const selectedImg = document.querySelector('.load-slot-card.selected.filled img');
      const selectedChar = state.slots[state.selectedSlot - 1];
      if (selectedImg && selectedChar) {
        const list = resolvePreviewUrls(selectedChar.classId, selectedChar.gender);
        if (list.length > 1) selectedImg.src = list[animFrameIdx % list.length];
      }
    }
    const previewImg = document.getElementById('class-preview-img');
    if (previewImg && state.stage === 'create') {
      const list = resolvePreviewUrls(state.createClassId, state.createGender);
      previewImg.src = list[animFrameIdx % list.length];
    }
  }, 95);
}

bootLineageWebApp();
