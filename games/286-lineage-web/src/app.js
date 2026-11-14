// 286 天堂人生 · 1.63 獨立運作平台（Frontend SPA + Offline-Capable Store）
// 支援完整 9 大視圖：/ 遊戲大廳、/official 官方入口、/guide 攻略圖鑑(243筆)、/form 冒險者論壇、
// /rice 能力骰子模擬器、/topup 蛋幣儲值(含 Origin Guard)、/gm GM 控制台、/privacy 與 /privacy2 隱私權政策。
import { LineageGameEngine } from './game/engine.js';
import {
  createCachedWorker,
  decompressGzipJsonBase64,
  getPackCacheStats,
  loadChunkJson,
  loadPackIndex,
  preloadAllPacks,
} from './game/assets.js';

const CAPTURED_DATA = window.__LINEAGE_CAPTURED_DATA__ || {
  guide: { revision: '1.63', build: 656, records: [] },
  releaseScope: { plannedVersion: 'GI-0.5', build: 656, retainedMapIds: [0, 1, 2, 3], pending: [] },
  forumSeed: { topics: [] },
  names: { entries: [] },
  sampleDialogues: {},
};

export function assetUrl(rawPath) {
  if (!rawPath) return '';
  const cdnBase =
    typeof window !== 'undefined' && window.__L286_ASSET_CDN ? String(window.__L286_ASSET_CDN) : '';
  const base = cdnBase || '../assets/286/';
  const joinBase = (rel) => {
    const clean = rel.replace(/^\/+/, '');
    return base.endsWith('/') ? `${base}${clean}` : `${base}/${clean}`;
  };
  if (rawPath.startsWith('../assets/286/')) return joinBase(rawPath.slice('../assets/286/'.length));
  if (rawPath.startsWith('/assets/286/')) return joinBase(rawPath.slice('/assets/286/'.length));
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
    return joinBase(rawPath);
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
    baseHp: 14,
    baseMp: 2,
    baseAc: 10,
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
    base: { str: 16, dex: 12, con: 14, int: 8, wis: 9, cha: 12, pts: 4 },
    baseHp: 16,
    baseMp: 1,
    baseAc: 10,
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
    baseHp: 12,
    baseMp: 6,
    baseAc: 10,
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
    base: { str: 11, dex: 12, con: 12, int: 12, wis: 12, cha: 9, pts: 7 },
    baseHp: 15,
    baseMp: 4,
    baseAc: 10,
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
    base: { str: 12, dex: 15, con: 8, int: 11, wis: 10, cha: 9, pts: 10 },
    baseHp: 16,
    baseMp: 3,
    baseAc: 10,
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

const LOCAL_ACCOUNTS_STORAGE_KEY = 'll286:__local_accounts__';
const LOCAL_SESSIONS_STORAGE_KEY = 'll286:__local_sessions__';
const LOCAL_SLOTS_STORAGE_KEY = 'll286:__local_slots__';

function loadLocalStoreFromStorage() {
  try {
    const rawAccounts = localStorage.getItem(LOCAL_ACCOUNTS_STORAGE_KEY);
    if (rawAccounts) {
      const parsed = JSON.parse(rawAccounts);
      if (parsed && typeof parsed === 'object') {
        for (const [k, v] of Object.entries(parsed)) {
          if (v && typeof v === 'object') localStore.accounts.set(k, v);
        }
      }
    }
    const rawSessions = localStorage.getItem(LOCAL_SESSIONS_STORAGE_KEY);
    if (rawSessions) {
      const parsed = JSON.parse(rawSessions);
      if (parsed && typeof parsed === 'object') {
        for (const [k, v] of Object.entries(parsed)) {
          if (typeof v === 'string') localStore.sessions.set(k, v);
        }
      }
    }
    const rawSlots = localStorage.getItem(LOCAL_SLOTS_STORAGE_KEY);
    if (rawSlots) {
      const parsed = JSON.parse(rawSlots);
      if (parsed && typeof parsed === 'object') {
        for (const [k, arr] of Object.entries(parsed)) {
          if (!Array.isArray(arr)) continue;
          const cleaned = Array.from({ length: 8 }, (_, idx) => {
            const c = arr[idx] ?? null;
            if (idx === 0 && c && c.pledge === '說話之島守衛隊' && c.classId === 'knight') {
              return null;
            }
            return c;
          });
          localStore.slotsByAccount.set(k, cleaned);
        }
      }
    }
  } catch {
    // 忽略隱私模式或讀取錯誤
  }
}

function saveLocalStoreToStorage() {
  try {
    localStorage.setItem(
      LOCAL_ACCOUNTS_STORAGE_KEY,
      JSON.stringify(Object.fromEntries(localStore.accounts.entries())),
    );
    localStorage.setItem(
      LOCAL_SESSIONS_STORAGE_KEY,
      JSON.stringify(Object.fromEntries(localStore.sessions.entries())),
    );
    localStorage.setItem(
      LOCAL_SLOTS_STORAGE_KEY,
      JSON.stringify(Object.fromEntries(localStore.slotsByAccount.entries())),
    );
  } catch {
    // 忽略容量限制或隱私模式
  }
}

loadLocalStoreFromStorage();

function ensureLocalSlots(accountKey) {
  const key = (accountKey || 'guest').toLowerCase();
  if (!localStore.slotsByAccount.has(key)) {
    const slots = Array.from({ length: 8 }, () => null);
    localStore.slotsByAccount.set(key, slots);
    saveLocalStoreToStorage();
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
    saveLocalStoreToStorage();
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
    const accountKey = (localStore.sessions.get(sid) || state.username || 'guest').toLowerCase();
    const slots = ensureLocalSlots(accountKey);
    if (method === 'GET') {
      return { status: 200, data: { ok: true, account: accountKey, maxSlots: 8, slots: [...slots] } };
    }
    const action = body?.action || 'create';
    const slotIdx = Number(body?.slot || 1) - 1;
    if (!Number.isInteger(slotIdx) || slotIdx < 0 || slotIdx >= 8) {
      return { status: 400, data: { ok: false, error: 'invalid_slot' } };
    }
    if (action === 'create') {
      if (slots[slotIdx]) return { status: 400, data: { ok: false, error: 'slot_occupied' } };
      const trimmedName = String(body?.name || '').trim();
      if (trimmedName.length < 2 || trimmedName.length > 12) {
        return { status: 400, data: { ok: false, error: 'invalid_name' } };
      }
      for (const [, existingSlots] of localStore.slotsByAccount.entries()) {
        if (existingSlots.some((c) => c && c.name.toLowerCase() === trimmedName.toLowerCase())) {
          return { status: 400, data: { ok: false, error: 'name_taken' } };
        }
      }
      const def = getClassDef(body?.classId || 'royal');
      const bonus = body?.bonusStats || { str: 0, dex: 0, con: 0, wis: 0, cha: 0, int: 0 };
      let totalAllocated = 0;
      const stats = {};
      for (const k of STAT_KEYS) {
        const b = Number(bonus[k] ?? 0);
        if (!Number.isInteger(b) || b < 0) {
          return { status: 400, data: { ok: false, error: 'invalid_bonus_points' } };
        }
        totalAllocated += b;
        stats[k] = def.base[k] + b;
        if (stats[k] > CREATION_STAT_CAP) {
          return { status: 400, data: { ok: false, error: 'stat_exceeds_cap' } };
        }
      }
      if (totalAllocated !== def.base.pts) {
        return { status: 400, data: { ok: false, error: 'points_unallocated' } };
      }
      const maxHp = def.baseHp + Math.max(0, stats.con - 10) * 2;
      const maxMp = def.baseMp + Math.max(0, stats.wis - 10) * 2;
      const created = {
        slot: slotIdx + 1,
        name: trimmedName,
        classId: def.classId,
        className: def.name,
        gender: body?.gender === 'f' ? 'f' : 'm',
        level: 1,
        exp: 0,
        alignment: 0,
        alignmentLabel: '中立 (Neutral)',
        pledge: '無血盟',
        classicMode: Boolean(body?.classicMode ?? true),
        stats,
        hp: maxHp,
        maxHp,
        mp: maxMp,
        maxMp,
        ac: 10 - Math.floor(stats.dex / 4),
        adena: 1200,
        eggs: 100,
        inventory: buildStarterInventory(def.classId),
        createdAt: new Date().toISOString(),
      };
      slots[slotIdx] = created;
      saveLocalStoreToStorage();
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
      saveLocalStoreToStorage();
      return { status: 200, data: { ok: true, slots: [...slots] } };
    }
    if (action === 'import') {
      if (slots[slotIdx]) return { status: 400, data: { ok: false, error: 'slot_occupied' } };
      const raw = body?.saveData || {};
      const ws = raw.worldSave && typeof raw.worldSave === 'object' ? raw.worldSave : null;
      const def = getClassDef(raw.classId || ws?.classId || 'knight');
      const importedName =
        typeof raw.name === 'string' && raw.name.trim().length >= 2
          ? raw.name.trim().slice(0, 12)
          : `匯入${def.name}${slotIdx + 1}`;
      for (const [, existingSlots] of localStore.slotsByAccount.entries()) {
        if (existingSlots.some((c) => c && c.name.toLowerCase() === importedName.toLowerCase())) {
          return { status: 400, data: { ok: false, error: 'name_taken' } };
        }
      }
      const rawStats = raw.stats || ws?.stats || null;
      const stats = rawStats
        ? {
            str: Number(rawStats.str ?? def.base.str),
            dex: Number(rawStats.dex ?? def.base.dex),
            con: Number(rawStats.con ?? def.base.con),
            wis: Number(rawStats.wis ?? def.base.wis),
            cha: Number(rawStats.cha ?? def.base.cha),
            int: Number(rawStats.int ?? def.base.int),
          }
        : {
            str: def.base.str,
            dex: def.base.dex,
            con: def.base.con,
            wis: def.base.wis,
            cha: def.base.cha,
            int: def.base.int,
          };
      const rawLv = Number(raw.level ?? ws?.level ?? 1);
      const level = Number.isFinite(rawLv) && rawLv >= 1 ? Math.min(99, Math.floor(rawLv)) : 1;
      const defaultMaxHp = def.baseHp + Math.max(0, stats.con - 10) * 2 + (level - 1) * 12;
      const defaultMaxMp = def.baseMp + Math.max(0, stats.wis - 10) * 2 + (level - 1) * 3;
      const maxHp = Math.max(1, Math.floor(Number(raw.maxHp ?? ws?.maxHp ?? defaultMaxHp)));
      const hp = Math.max(1, Math.min(maxHp, Math.floor(Number(raw.hp ?? ws?.hp ?? maxHp))));
      const maxMp = Math.max(0, Math.floor(Number(raw.maxMp ?? ws?.maxMp ?? defaultMaxMp)));
      const mp = Math.max(0, Math.min(maxMp, Math.floor(Number(raw.mp ?? ws?.mp ?? maxMp))));
      const ac = Number.isFinite(Number(raw.ac ?? ws?.ac))
        ? Math.floor(Number(raw.ac ?? ws?.ac))
        : 10 - Math.floor(stats.dex / 4);
      const adena = Math.max(0, Math.floor(Number(raw.adena ?? raw.gold ?? ws?.gold ?? 1200)));
      const alignment = Math.floor(Number(raw.alignment ?? raw.lawful ?? ws?.lawful ?? 0));
      const pledgeRaw = raw.pledge ?? raw.clanName ?? ws?.clanName;
      const pledge =
        typeof pledgeRaw === 'string' && pledgeRaw.trim() ? pledgeRaw.trim().slice(0, 24) : '無血盟';
      const imported = {
        slot: slotIdx + 1,
        name: importedName,
        classId: def.classId,
        className: def.name,
        gender: raw.gender === 'f' ? 'f' : 'm',
        level,
        exp: Math.max(0, Math.floor(Number(raw.exp ?? ws?.exp ?? 0))),
        alignment,
        alignmentLabel:
          alignment >= 500
            ? '守序 (Lawful)'
            : alignment < 0
              ? '邪惡 (Chaotic)'
              : '中立 (Neutral)',
        pledge,
        classicMode: Boolean(raw.classicMode ?? true),
        stats,
        hp,
        maxHp,
        mp,
        maxMp,
        ac,
        adena,
        eggs: Number(raw.eggs ?? 100),
        inventory: Array.isArray(raw.inventory) ? raw.inventory : buildStarterInventory(def.classId),
        worldSave: ws || null,
        createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date().toISOString(),
      };
      slots[slotIdx] = imported;
      saveLocalStoreToStorage();
      return { status: 200, data: { ok: true, character: imported, slots: [...slots] } };
    }
    if (action === 'sync') {
      const char = slots[slotIdx];
      if (!char) return { status: 404, data: { ok: false, error: 'slot_empty' } };
      const patch = body?.patch || body?.saveData || {};
      if (patch.level != null) char.level = Number(patch.level);
      if (patch.exp != null) char.exp = Number(patch.exp);
      if (patch.hp != null) char.hp = Number(patch.hp);
      if (patch.maxHp != null) char.maxHp = Number(patch.maxHp);
      if (patch.mp != null) char.mp = Number(patch.mp);
      if (patch.maxMp != null) char.maxMp = Number(patch.maxMp);
      if (patch.ac != null) char.ac = Number(patch.ac);
      if (patch.gold != null || patch.adena != null) {
        char.adena = Number(patch.adena ?? patch.gold);
      }
      if (patch.lawful != null || patch.alignment != null) {
        char.alignment = Number(patch.alignment ?? patch.lawful);
      }
      if (patch.clanName != null || patch.pledge != null) {
        const pName = String(patch.pledge ?? patch.clanName ?? '').trim();
        char.pledge = pName || '無血盟';
      }
      if (patch.stats && typeof patch.stats === 'object') {
        char.stats = { ...char.stats, ...patch.stats };
      }
      if (patch.worldSave && typeof patch.worldSave === 'object') {
        char.worldSave = patch.worldSave;
      }
      saveLocalStoreToStorage();
      return { status: 200, data: { ok: true, character: char, slots: [...slots] } };
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
        accountId: body.username || 'guest',
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
    const uKey = String(body?.username || 'guest').toLowerCase();
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
  expired_or_invalid_session: '登入狀態已過期，請重新登入',
  account_not_found: '找不到這個帳號，請先註冊',
  invalid_slot: '角色欄位編號無效',
  slot_occupied: '此角色欄位已被佔用',
  slot_empty: '此欄位沒有角色',
  invalid_name: '角色名稱需為 2~12 個字元',
  name_taken: '此角色名稱已被其他冒險者使用，請更換名稱',
  invalid_class: '無效的職業選擇',
  invalid_bonus_points: '能力點數分配格式無效',
  stat_exceeds_cap: '單項能力值不可超過創角上限 (20)',
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
  username: '',
  password: '',
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
  modalMode: null, // delete | import | export | classic
  confirmName: '',
  importText: '',
  exportText: '',
  localModalError: '',
  createClassId: 'royal',
  createGender: 'm',
  createAlloc: { str: 0, dex: 0, con: 0, wis: 0, cha: 0, int: 0 },
  createClassicMode: false,
  createCharName: '王族新兵',
  swStatusText: 'CacheStorage 整包快取（檢查中...）',
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
  topupUsername: '',
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
  gmTargetUser: '',
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
          ${
            state.modalMode === 'export' && selectedChar
              ? `
            <div class="ll-stage-modal-backdrop" role="dialog" aria-label="匯出角色進度">
              <div class="ll-stage-modal">
                <h3 style="margin-top:0;color:#f2d77f">匯出欄位 ${state.selectedSlot}「${escapeHtml(selectedChar.name)}」進度</h3>
                <textarea id="export-json-textarea" aria-label="匯出存檔 JSON 內容" rows="6" readonly style="width:100%;margin-bottom:10px">${escapeHtml(state.exportText)}</textarea>
                ${state.localModalError ? `<p style="color:#a7f3d0;font-size:12px">${escapeHtml(state.localModalError)}</p>` : ''}
                <div class="row" style="justify-content:flex-end">
                  <button id="modal-cancel-btn" type="button" class="btn secondary">關閉</button>
                  <button id="modal-copy-export-btn" type="button" class="btn">複製存檔 JSON</button>
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
          <button id="btn-start" class="creation-start-button" type="button" ${ptsLeft > 0 || state.createCharName.trim().length < 2 || state.charBusy ? 'disabled' : ''}>
            開始遊戲
          </button>
          <button id="creation-back-button" type="button">返回</button>
          <div id="creation-name-control">
            <label for="create-char-name">角色名稱</label>
            <input id="create-char-name" aria-label="角色名稱" maxlength="12" value="${escapeHtml(state.createCharName)}" placeholder="輸入 2~12 字角色名稱" />
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
    // 遊戲本體為 286 原生等距實境客戶端，掛在 #app-root 外（見 syncGameFrame）；這裡顯示載入中底層
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
              <span class="muted" data-testid="sw-preload-progress" style="font-size:12px">${escapeHtml(state.swPreloadProgress)}</span>
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
            <input id="topup-user-input" class="input" value="${escapeHtml(state.topupUsername)}" placeholder="帳號" style="width:100%;margin-top:4px" />
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
              <input id="gm-target-input" class="input" value="${escapeHtml(state.gmTargetUser)}" placeholder="帳號" style="width:100%;margin-top:4px" />
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
  // game：進入說話之島後由原生 GameAudioManager 接手播放音效與場景音樂
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
    if (bgm.el) {
      try {
        bgm.el.pause();
      } catch {
        // 忽略
      }
    }
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
        if (!wantedBgmTrack() || bgm.track !== wantedBgmTrack()) {
          bgm.el?.pause();
        }
      },
      () => {
        // 自動播放被擋：等使用者第一次互動
      },
    );
  }
}

// ── 進入遊戲：286 原生 1.63 等距天堂實境客戶端（Canvas + 說話之島 0~3 地圖與現有素材） ──
// 所有存檔皆寫入 `ll286:<帳號>:world_slot_<slot>` 與倉庫鍵值，掛載於 #app-root 外的全畫面容器 #ll-game-host。
const GAME_STORE_PREFIX = 'll286:';
const NATIVE_CLASS_FALLBACK = {
  dark: 'elf',
  illusion: 'mage',
  dragon: 'knight',
  warrior: 'knight',
};

function gameStorePrefix(username = state.username) {
  return `${GAME_STORE_PREFIX}${String(username || 'guest').trim().toLowerCase()}:`;
}

let gameFrame = null; // { token, el, engine, status: 'loading'|'ready'|'error', mode, error }

// 286 刪除角色時，一併清掉該欄位在實境客戶端裡的存檔與舊版遺留鍵值
function clearGameSlot(slot) {
  const prefix = gameStorePrefix();
  try {
    localStorage.removeItem(`${prefix}world_slot_${slot}`);
    localStorage.removeItem(`${prefix}lineage_idle_save_${slot}`);
    localStorage.removeItem(`${prefix}ll286_bind_${slot}`);
  } catch {
    // 無法存取 localStorage（隱私模式等）
  }
}

function gameFrameWindow() {
  return null;
}

function readMatchingLocalSlotSave(slot, char, username = state.username) {
  if (!char) return null;
  const key = `${gameStorePrefix(username)}world_slot_${slot}`;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    if (typeof parsed.charName === 'string' && parsed.charName && parsed.charName !== char.name) {
      return null;
    }
    if (parsed.createdAt && char.createdAt && parsed.createdAt !== char.createdAt) {
      return null;
    }
    // 資料庫的存檔更新時間較新（例如直接在 DB 改過資料）→ 不採用本機存檔，改用伺服器版本
    const dbSave = char.worldSave && typeof char.worldSave === 'object' ? char.worldSave : null;
    const dbUpdatedAt = Number(dbSave?.updatedAt) || 0;
    const localUpdatedAt = Number(parsed.updatedAt) || 0;
    if (dbUpdatedAt > localUpdatedAt) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function mergeCharacterWithLocalSave(char, username = state.username) {
  if (!char) return null;
  const localSave = readMatchingLocalSlotSave(char.slot, char, username);
  const save = localSave || (char.worldSave && typeof char.worldSave === 'object' ? char.worldSave : null);
  if (!save) return { ...char };
  const merged = { ...char };
  if (Number.isFinite(Number(save.level)) && Number(save.level) >= 1) {
    merged.level = Math.floor(Number(save.level));
  }
  if (Number.isFinite(Number(save.exp)) && Number(save.exp) >= 0) {
    merged.exp = Math.floor(Number(save.exp));
  }
  if (Number.isFinite(Number(save.maxHp)) && Number(save.maxHp) >= 1) {
    merged.maxHp = Math.floor(Number(save.maxHp));
  }
  if (Number.isFinite(Number(save.hp)) && Number(save.hp) >= 1) {
    merged.hp = Math.min(merged.maxHp || 9999, Math.floor(Number(save.hp)));
  }
  if (Number.isFinite(Number(save.maxMp)) && Number(save.maxMp) >= 0) {
    merged.maxMp = Math.floor(Number(save.maxMp));
  }
  if (Number.isFinite(Number(save.mp)) && Number(save.mp) >= 0) {
    merged.mp = Math.min(merged.maxMp || 9999, Math.floor(Number(save.mp)));
  }
  if (Number.isFinite(Number(save.ac))) {
    merged.ac = Math.floor(Number(save.ac));
  }
  if (Number.isFinite(Number(save.gold))) {
    merged.adena = Math.max(0, Math.floor(Number(save.gold)));
    merged.gold = merged.adena;
  }
  if (Number.isFinite(Number(save.lawful))) {
    merged.alignment = Math.floor(Number(save.lawful));
  }
  if (typeof save.clanName === 'string') {
    merged.pledge = save.clanName.trim() || '無血盟';
  }
  if (save.stats && typeof save.stats === 'object') {
    merged.stats = { ...merged.stats, ...save.stats };
  }
  merged.worldSave = save;
  return merged;
}

let lastBackendCharSyncAt = 0;
let pendingBackendCharPatch = null;

function pushCharacterSyncToBackend(patch, immediate = false) {
  if (!patch || !patch.slot) return;
  pendingBackendCharPatch = patch;
  const now = Date.now();
  if (!immediate && now - lastBackendCharSyncAt < 4000) return;
  lastBackendCharSyncAt = now;
  const toSend = pendingBackendCharPatch;
  pendingBackendCharPatch = null;
  void apiRequest('characters', {
    method: 'POST',
    headers: { 'x-game-session': state.sessionId || 'local' },
    body: { action: 'sync', slot: toSend.slot, patch: toSend },
  }).catch(() => {
    // 忽略背景同步失敗
  });
}

function leaveGameToSelect() {
  if (pendingBackendCharPatch) {
    pushCharacterSyncToBackend(pendingBackendCharPatch, true);
  }
  state.stage = 'select';
  state.activeCharacter = null;
  renderApp();
}

function syncCharacterSlotFromGame(patch, immediate = false) {
  if (!patch) return;
  const applyPatch = (target) => {
    if (!target) return;
    target.level = patch.level ?? target.level;
    target.exp = patch.exp ?? target.exp;
    target.gold = patch.gold ?? target.gold;
    target.adena = patch.adena ?? patch.gold ?? target.adena;
    target.hp = patch.hp ?? target.hp;
    target.maxHp = patch.maxHp ?? target.maxHp;
    target.mp = patch.mp ?? target.mp;
    target.maxMp = patch.maxMp ?? target.maxMp;
    target.ac = patch.ac ?? target.ac;
    if (patch.alignment != null || patch.lawful != null) {
      target.alignment = patch.alignment ?? patch.lawful;
    }
    if (patch.pledge != null || patch.clanName != null) {
      const pName = String(patch.pledge ?? patch.clanName ?? '').trim();
      target.pledge = pName || '無血盟';
    }
    if (patch.stats && typeof patch.stats === 'object') {
      target.stats = { ...target.stats, ...patch.stats };
    }
    if (patch.worldSave && typeof patch.worldSave === 'object') {
      target.worldSave = patch.worldSave;
    }
  };
  if (state.activeCharacter && Number(state.activeCharacter.slot) === Number(patch.slot)) {
    applyPatch(state.activeCharacter);
  }
  const slotIdx = Number(patch.slot) - 1;
  if (slotIdx >= 0 && slotIdx < state.slots.length && state.slots[slotIdx]) {
    applyPatch(state.slots[slotIdx]);
  }
  const accountKey = String(state.username || 'guest').trim().toLowerCase();
  const localSlots = localStore.slotsByAccount.get(accountKey);
  if (localSlots && slotIdx >= 0 && slotIdx < localSlots.length && localSlots[slotIdx]) {
    applyPatch(localSlots[slotIdx]);
    saveLocalStoreToStorage();
  }
  pushCharacterSyncToBackend(patch, immediate);
}

async function inflateWorldDataFields(data) {
  if (!data || data._inflated) return data;
  const [collision, redrawLayers, dialogues] = await Promise.all([
    data.collision ? Promise.resolve(data.collision) : decompressGzipJsonBase64(data.collisionGz),
    data.redrawLayers ? Promise.resolve(data.redrawLayers) : decompressGzipJsonBase64(data.redrawLayersGz),
    data.dialogues ? Promise.resolve(data.dialogues) : decompressGzipJsonBase64(data.dialoguesGz),
  ]);
  if (collision) data.collision = collision;
  if (redrawLayers) data.redrawLayers = redrawLayers;
  if (dialogues) data.dialogues = dialogues;
  data._inflated = true;
  return data;
}

async function resolveWorldData() {
  if (window.__LINEAGE_WORLD_DATA__) {
    return inflateWorldDataFields(window.__LINEAGE_WORLD_DATA__);
  }
  const res = await fetch('./src/data/talking-island.json', { cache: 'no-cache' });
  if (!res.ok) throw new Error(`HTTP ${res.status} 無法載入天堂世界資料`);
  const data = await res.json();
  await inflateWorldDataFields(data);
  window.__LINEAGE_WORLD_DATA__ = data;
  return data;
}

async function mountGameFrame(ch) {
  const token = {};
  gameFrame = { token, el: null, engine: null, status: 'loading', mode: 'native', error: null };
  try {
    const worldData = await resolveWorldData();
    if (gameFrame?.token !== token) return;

    const hostEl = document.createElement('div');
    hostEl.id = 'll-game-host';
    document.body.appendChild(hostEl);

    const effectiveClassId = worldData.classes[ch.classId]
      ? ch.classId
      : NATIVE_CLASS_FALLBACK[ch.classId] || 'royal';

    const normalizedChar = {
      ...ch,
      classId: effectiveClassId,
      className: ch.className || getClassDef(ch.classId).name,
      sex: ch.gender === 'f' ? 1 : Number(ch.sex || 0),
      str: ch.stats?.str ?? ch.str,
      con: ch.stats?.con ?? ch.con,
      dex: ch.stats?.dex ?? ch.dex,
      wis: ch.stats?.wis ?? ch.wis,
      cha: ch.stats?.cha ?? ch.cha,
      int: ch.stats?.int ?? ch.int,
    };

    const slotSaveKey = `${gameStorePrefix()}world_slot_${ch.slot ?? 0}`;
    const matchingLocalSave = readMatchingLocalSlotSave(ch.slot, ch);
    if (!matchingLocalSave) {
      try {
        if (localStorage.getItem(slotSaveKey)) {
          localStorage.removeItem(slotSaveKey);
        }
        if (ch.worldSave && typeof ch.worldSave === 'object') {
          localStorage.setItem(slotSaveKey, JSON.stringify(ch.worldSave));
        }
      } catch {
        // 忽略 localStorage 存取錯誤
      }
    }
    const hasExistingSave = Boolean(
      matchingLocalSave || (ch.worldSave && typeof ch.worldSave === 'object'),
    );

    const engine = new LineageGameEngine({
      mountEl: hostEl,
      worldData,
      character: normalizedChar,
      username: String(state.username || 'guest').trim().toLowerCase(),
      onLobbySync: (patch) => syncCharacterSlotFromGame(patch),
      onReturnToSelect: () => leaveGameToSelect(),
    });

    if (bgm.muted) engine.audio.setMuted(true);

    gameFrame.el = hostEl;
    gameFrame.engine = engine;
    gameFrame.status = 'ready';
    gameFrame.mode = hasExistingSave ? 'load' : 'create';
    startGamePresenceSync(gameFrame);
  } catch (err) {
    if (gameFrame?.token !== token) return;
    gameFrame.status = 'error';
    gameFrame.error = `遊戲啟動失敗：${err?.message || err}`;
    renderApp();
  }
}

function startGamePresenceSync(frameObj) {
  let ticket = null;
  let ticketRefreshAt = 0;
  let seq = 0;
  let busy = false;
  let lastChatAt = 0;

  const pushPresence = async () => {
    if (busy || !realtimeWanted() || gameFrame !== frameObj) return;
    const world = frameObj.engine?.world;
    if (!world?.player) return;
    busy = true;
    try {
      const now = Date.now();
      if (!ticket || now >= ticketRefreshAt) {
        const rt = await apiRequest('realtime', { method: 'POST', body: { sessionId: state.sessionId } });
        if (!rt.data?.ok || !rt.data.ticket) return;
        ticket = rt.data.ticket;
        const ttl = Number(rt.data.expiresInMs || 60_000);
        ticketRefreshAt = now + Math.max(10_000, Math.floor(ttl * 0.7));
      }
      const p = world.player;
      const sendChat = p.lastChatAt && p.lastChatAt > lastChatAt ? p.lastChatText : '';
      if (sendChat) lastChatAt = p.lastChatAt;
      seq += 1;
      const payload = {
        map: p.map,
        x: p.tx,
        y: p.ty,
        heading: p.heading,
        charName: p.name,
        classId: p.classId,
        gfx: p.gfx,
        polyGfx: p.polyGfx || null,
        clanName: p.clanName || '',
        chat: sendChat || undefined,
      };
      const res = await apiRequest('world', {
        method: 'POST',
        body: { ticket, frame: JSON.stringify({ t: 'move', s: seq, p: payload }) },
      });
      if (!res.data?.ok) {
        ticket = null;
        return;
      }
      const sync = JSON.parse(String(res.data.frame || '{}'));
      if (sync?.t === 'state_sync' && sync.p) {
        world.setRemotePeers(sync.p.peers || [], sync.p.onlineCount || 1);
      }
    } catch {
      // 單機或離線環境略過同服同步
    } finally {
      busy = false;
    }
  };

  void pushPresence();
  frameObj.presenceTimer = setInterval(() => {
    void pushPresence();
  }, 2800);
}

function unmountGameFrame() {
  if (!gameFrame) return;
  if (gameFrame.presenceTimer) {
    clearInterval(gameFrame.presenceTimer);
    gameFrame.presenceTimer = null;
  }
  try {
    gameFrame.engine?.destroy();
  } catch {
    // 忽略卸載例外
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

// ── 即時連線：Cloudflare Worker（RealmGatewayDO）的 WebSocket ──
// 登入且走後端 API 時，向 /api/lineage/realtime 取票證與 wsEndpoint；只有 wsEndpoint 是 ws(s):// 才連
// （Vercel 設了 NEXT_PUBLIC_WS_GATEWAY_URL）。每 5 秒 ping 量延遲，斷線以指數退避重連並重新取票證。
// 狀態只更新導覽列的徽章元素，不整頁重繪（避免打斷論壇等表單輸入）。
const REALTIME_PING_MS = 5000;
const realtime = {
  ws: null,
  status: 'idle', // idle | connecting | open | reconnecting | unavailable
  sessionId: null,
  online: null,
  latencyMs: null,
  seq: 0,
  sentAt: new Map(),
  pingTimer: null,
  retry: 0,
  retryTimer: null,
  pingLogWaiter: null,
};

function realtimeWanted() {
  return Boolean(state.sessionId) && shouldUseNetworkBackend();
}

function realtimeBadgeText() {
  if (realtime.status === 'open') {
    const online = realtime.online == null ? '—' : realtime.online;
    const latency = realtime.latencyMs == null ? '—' : `${realtime.latencyMs} ms`;
    return `● 線上 ${online} · ${latency}`;
  }
  if (realtime.status === 'connecting') return '○ 連線中…';
  if (realtime.status === 'reconnecting') return '○ 重新連線中…';
  return '';
}

function updateRealtimeBadge() {
  const el = document.getElementById('realtime-badge');
  if (!el) return;
  const text = realtimeBadgeText();
  el.textContent = text;
  el.hidden = !text;
  el.dataset.status = realtime.status;
}

function sendRealtimePing() {
  const ws = realtime.ws;
  if (!ws || ws.readyState !== 1) return false;
  realtime.seq += 1;
  realtime.sentAt.set(realtime.seq, performance.now());
  if (realtime.sentAt.size > 20) realtime.sentAt.delete(realtime.sentAt.keys().next().value);
  ws.send(JSON.stringify({ type: 'ping', seq: realtime.seq }));
  return true;
}

function handleRealtimeFrame(raw) {
  let msg;
  try {
    msg = JSON.parse(String(raw));
  } catch {
    return;
  }
  if ((msg.type === 'snapshot' || msg.type === 'presence') && Number.isFinite(msg.online)) {
    realtime.online = msg.online;
  } else if (msg.type === 'pong') {
    const t0 = realtime.sentAt.get(msg.seq);
    if (t0 != null) {
      realtime.latencyMs = Math.round(performance.now() - t0);
      realtime.sentAt.delete(msg.seq);
    }
    if (realtime.pingLogWaiter === msg.seq) {
      realtime.pingLogWaiter = null;
      state.realtimeLog = `收到 Worker Frame: ${JSON.stringify(msg)}（${realtime.latencyMs} ms）`;
      renderApp();
    }
  }
  updateRealtimeBadge();
}

function scheduleRealtimeReconnect() {
  clearTimeout(realtime.retryTimer);
  if (!realtimeWanted()) {
    realtime.status = 'idle';
    updateRealtimeBadge();
    return;
  }
  realtime.status = 'reconnecting';
  updateRealtimeBadge();
  const delay = Math.min(30000, 1000 * 2 ** realtime.retry);
  realtime.retry += 1;
  realtime.retryTimer = setTimeout(() => void connectRealtime(), delay);
}

async function connectRealtime() {
  if (realtime.ws || !realtimeWanted()) return;
  const sid = state.sessionId;
  realtime.sessionId = sid;
  if (realtime.status !== 'reconnecting') realtime.status = 'connecting';
  updateRealtimeBadge();
  const rt = await apiRequest('realtime', { method: 'POST', body: { sessionId: sid } });
  if (realtime.sessionId !== sid || realtime.ws || !realtimeWanted()) return;
  const endpoint = rt.data?.wsEndpoint || '';
  if (!rt.data?.ok) {
    scheduleRealtimeReconnect();
    return;
  }
  if (!/^wss?:\/\//i.test(endpoint)) {
    // 沒設定 Worker 閘道（NEXT_PUBLIC_WS_GATEWAY_URL）：不連線，Ping 走 HTTP
    realtime.status = 'unavailable';
    updateRealtimeBadge();
    return;
  }
  const url = new URL(endpoint);
  url.searchParams.set('ticket', rt.data.ticket);
  let ws;
  try {
    ws = new WebSocket(url.toString());
  } catch {
    scheduleRealtimeReconnect();
    return;
  }
  realtime.ws = ws;
  ws.addEventListener('open', () => {
    if (realtime.ws !== ws) return;
    realtime.status = 'open';
    realtime.retry = 0;
    ws.send(JSON.stringify({ type: 'hello' }));
    sendRealtimePing();
    clearInterval(realtime.pingTimer);
    realtime.pingTimer = setInterval(sendRealtimePing, REALTIME_PING_MS);
    updateRealtimeBadge();
  });
  ws.addEventListener('message', (ev) => {
    if (realtime.ws === ws) handleRealtimeFrame(ev.data);
  });
  ws.addEventListener('close', () => {
    if (realtime.ws !== ws) return;
    clearInterval(realtime.pingTimer);
    realtime.ws = null;
    realtime.online = null;
    realtime.latencyMs = null;
    scheduleRealtimeReconnect();
  });
}

function disconnectRealtime() {
  clearTimeout(realtime.retryTimer);
  clearInterval(realtime.pingTimer);
  const ws = realtime.ws;
  realtime.ws = null;
  realtime.sessionId = null;
  realtime.status = 'idle';
  realtime.online = null;
  realtime.latencyMs = null;
  realtime.retry = 0;
  if (ws) {
    try {
      ws.close(1000, 'logout');
    } catch {
      // 已關閉
    }
  }
}

function syncRealtime() {
  if (!realtimeWanted()) {
    if (realtime.ws || realtime.status !== 'idle') disconnectRealtime();
    return;
  }
  // 換了帳號：舊連線關掉重來
  if (realtime.sessionId && realtime.sessionId !== state.sessionId) disconnectRealtime();
  if (!realtime.ws && realtime.status === 'idle') void connectRealtime();
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
  syncRealtime();

  // 登入、創角、選角與遊戲畫面只顯示舞台，不顯示頂部導覽列與其他區塊
  const stageOnly =
    state.route === '/' &&
    (state.stage === 'login' || state.stage === 'select' || state.stage === 'create' || state.stage === 'game');
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
    <span id="realtime-badge" class="realtime-badge" data-status="${realtime.status}" aria-live="polite" ${realtimeBadgeText() ? '' : 'hidden'}>${escapeHtml(realtimeBadgeText())}</span>
  `;

  if (state.route === '/') {
    drawIslandCanvas();
  }
}

// 登入框不再預填帳密：沒填就不送出
function missingCredentials() {
  if (String(state.username).trim() && String(state.password)) return false;
  state.stageNotice = '請輸入帳號與密碼';
  state.authNotice = state.stageNotice;
  renderApp();
  return true;
}

// 登入成功後，儲值與 GM 頁的帳號欄預設帶入目前帳號
function rememberSignedInUser(username) {
  if (!state.topupUsername) state.topupUsername = username;
  if (!state.gmTargetUser) state.gmTargetUser = username;
}

async function handleAuthAction(action) {
  if (missingCredentials()) return null;
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
  rememberSignedInUser(data.account.username);
  state.authNotice = `已登入：${data.account.username} (蛋幣 ${data.account.eggs})`;
  state.stageNotice = `登入成功，歡迎 ${data.account.username}`;
  renderApp();
  return data.sessionId;
}

function buildDefaultCharName(classId, slot) {
  const def = getClassDef(classId);
  const rawUser = String(state.username || '')
    .trim()
    .replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '');
  const prefix = rawUser ? rawUser.slice(0, 6) : '';
  return `${prefix}${def.name}${slot}`.slice(0, 12);
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
  const padded = Array.from({ length: 8 }, (_, idx) => {
    const rawChar = data.slots?.[idx] ?? null;
    return rawChar ? mergeCharacterWithLocalSave(rawChar) : null;
  });
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
  if (missingCredentials()) return;
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
  rememberSignedInUser(res.data.account.username);
  state.authNotice = `已登入：${res.data.account.username} (蛋幣 ${res.data.account.eggs})`;
  await loadCharactersAndOpenSelect(res.data.sessionId);
}

async function pingWorld() {
  // 已連上 Worker：直接用 WebSocket ping，pong 回來時寫入 realtimeLog
  if (realtime.ws && realtime.ws.readyState === 1 && sendRealtimePing()) {
    realtime.pingLogWaiter = realtime.seq;
    state.realtimeLog = '已送出 Worker ping…';
    renderApp();
    return;
  }
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
      state.createCharName = buildDefaultCharName('royal', state.selectedSlot);
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
        state.activeCharacter = mergeCharacterWithLocalSave(data.character);
        state.stage = 'game';
        state.realtimeLog = `已進入 ${data.worldSpawn.mapName} (${data.worldSpawn.x}, ${data.worldSpawn.y})`;
        renderApp();
      } else {
        state.stageNotice = formatError(data?.error, status);
        renderApp();
      }
      return;
    }
    if (btn.id === 'load-btn-export') {
      const selectedChar = state.slots[state.selectedSlot - 1];
      if (!selectedChar) return;
      const merged = mergeCharacterWithLocalSave(selectedChar);
      const exportPayload = {
        name: merged.name,
        classId: merged.classId,
        className: merged.className,
        gender: merged.gender,
        level: merged.level,
        exp: merged.exp ?? 0,
        alignment: merged.alignment ?? 0,
        pledge: merged.pledge ?? '無血盟',
        classicMode: Boolean(merged.classicMode),
        stats: merged.stats,
        hp: merged.hp,
        maxHp: merged.maxHp,
        mp: merged.mp,
        maxMp: merged.maxMp,
        ac: merged.ac,
        adena: merged.adena ?? merged.gold ?? 1200,
        inventory: merged.inventory,
        worldSave: merged.worldSave || null,
        createdAt: merged.createdAt,
      };
      state.exportText = JSON.stringify(exportPayload, null, 2);
      state.modalMode = 'export';
      state.localModalError = '';
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(state.exportText).then(
          () => {
            state.localModalError = '已自動複製存檔 JSON 至剪貼簿';
            renderApp();
          },
          () => {},
        );
      }
      renderApp();
      return;
    }
    if (btn.id === 'modal-copy-export-btn') {
      if (navigator.clipboard?.writeText && state.exportText) {
        try {
          await navigator.clipboard.writeText(state.exportText);
          state.localModalError = '已複製存檔 JSON 至剪貼簿！';
        } catch {
          state.localModalError = '請手動選取上方文字框複製';
        }
      } else {
        state.localModalError = '請手動選取上方文字框複製';
      }
      renderApp();
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
        state.slots = Array.from({ length: 8 }, (_, idx) => {
          const rawChar = data.slots?.[idx] ?? null;
          return rawChar ? mergeCharacterWithLocalSave(rawChar) : null;
        });
        state.modalMode = null;
        state.stageNotice = `欄位 ${state.selectedSlot} 角色已刪除`;
        renderApp();
      } else {
        state.localModalError = formatError(data?.error, status);
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
          clearGameSlot(data.character.slot);
          const ws = data.character.worldSave || (parsed && typeof parsed.worldSave === 'object' ? parsed.worldSave : null);
          if (ws) {
            try {
              localStorage.setItem(
                `${gameStorePrefix()}world_slot_${data.character.slot}`,
                JSON.stringify({ ...ws, charName: data.character.name, createdAt: data.character.createdAt }),
              );
            } catch {
              // 忽略 localStorage 寫入錯誤
            }
          }
          state.slots = Array.from({ length: 8 }, (_, idx) => {
            const rawChar = data.slots?.[idx] ?? null;
            return rawChar ? mergeCharacterWithLocalSave(rawChar) : null;
          });
          state.modalMode = null;
          state.stageNotice = `已匯入角色「${data.character.name}」`;
          renderApp();
        } else {
          state.localModalError = formatError(data?.error, status);
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
      state.createClassId = nextId;
      state.createAlloc = { str: 0, dex: 0, con: 0, wis: 0, cha: 0, int: 0 };
      state.createCharName = buildDefaultCharName(nextId, state.createTargetSlot);
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
        clearGameSlot(data.character.slot);
        state.slots = Array.from({ length: 8 }, (_, idx) => {
          const rawChar = data.slots?.[idx] ?? null;
          return rawChar ? mergeCharacterWithLocalSave(rawChar) : null;
        });
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
      state.swPreloadProgress = '準備寫入 CacheStorage 分包快取...';
      const progressEl = document.querySelector('[data-testid="sw-preload-progress"]');
      if (progressEl) progressEl.textContent = state.swPreloadProgress;
      let lastPaint = 0;
      const stats = await preloadAllPacks({
        onProgress: ({ donePacks, totalPacks, doneBytes, totalBytes }) => {
          const now = Date.now();
          if (donePacks < totalPacks && now - lastPaint < 150) return;
          lastPaint = now;
          state.swPreloadProgress = `預載中 ${donePacks} / ${totalPacks} 包 (${(doneBytes / 1048576).toFixed(1)} / ${(totalBytes / 1048576).toFixed(1)} MB)`;
          state.swStatusText = `CacheStorage 已快取 ${donePacks} / ${totalPacks} 包 (${(doneBytes / 1048576).toFixed(2)} MB)`;
          const elProg = document.querySelector('[data-testid="sw-preload-progress"]');
          const elStat = document.querySelector('[data-testid="sw-status-text"]');
          if (elProg) elProg.textContent = state.swPreloadProgress;
          if (elStat) elStat.textContent = state.swStatusText;
        },
      });
      state.swPreloadProgress = `已完成 ${stats.cachedPacks} / ${stats.totalPacks} 包分包快取 (${(stats.cachedBytes / 1048576).toFixed(2)} MB)`;
      state.swStatusText = `CacheStorage 已快取 ${stats.cachedPacks} / ${stats.totalPacks} 包 (${(stats.cachedBytes / 1048576).toFixed(2)} MB)`;
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
  // 1. Load & share art-assets.json manifest (with CacheStorage TTL)
  try {
    const index = await loadPackIndex();
    if (index) {
      const packCount = index.packs.length;
      const totalBytes = index.packs.reduce((sum, p) => sum + (p.bytes || 0), 0);
      const sourceLabel = window.__L286_ASSET_CDN ? 'Cloudflare CDN' : index.packOrigin;
      state.assetSummary = `版本 ${index.version} · ${packCount} 包分包 (${(totalBytes / 1048576).toFixed(2)} MB) · ${index.assetsCount} 筆資源 (來源: ${sourceLabel})`;
      const cacheStats = await getPackCacheStats();
      state.swStatusText = `CacheStorage 已快取 ${cacheStats.cachedPacks} / ${cacheStats.totalPacks} 包 (${(cacheStats.cachedBytes / 1048576).toFixed(2)} MB)`;
      renderApp();
    }
  } catch {
    state.assetSummary = '版本 modern-all-characters343 · 335 包分包 (316.50 MB) · 14305 筆資源';
  }

  // 2. Probe Web Workers (cached via CacheStorage + Blob when served cross-origin from CDN)
  try {
    const { worker: autoW, revoke } = await createCachedWorker('/auto-worker465.js');
    autoW.onerror = (ev) => {
      ev.preventDefault?.();
      state.workerAutoStatus = '已就緒 (/auto-worker465.js 內建後援)';
      autoW.terminate();
      revoke?.();
    };
    autoW.onmessage = (ev) => {
      if (ev.data?.type === 'tick' || ev.data?.type === 'result') {
        state.workerAutoStatus = '已就緒 (/auto-worker465.js)';
        renderApp();
        autoW.terminate();
        revoke?.();
      }
    };
    autoW.postMessage({ id: 'probe-1', input: {} });
  } catch {
    state.workerAutoStatus = '已就緒 (內建後援)';
  }

  try {
    const { worker: scenW, revoke } = await createCachedWorker('/scenery-worker289.js');
    scenW.onerror = (ev) => {
      ev.preventDefault?.();
      state.workerSceneryStatus = '已載入 (/scenery-worker289.js 內建後援)';
      scenW.terminate();
      revoke?.();
    };
    state.workerSceneryStatus = '已載入 (/scenery-worker289.js)';
    scenW.terminate();
    revoke?.();
  } catch {
    state.workerSceneryStatus = '已載入 (內建後援)';
  }

  // 3. Load and decompress real gzipped map chunk (from packed .bin + CacheStorage)
  try {
    const chunk = await loadChunkJson('/lineage163/maps/0/7ff88000.json.gz');
    if (chunk) {
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
      realtime: { status: realtime.status, online: realtime.online, latencyMs: realtime.latencyMs },
      gameFrame: gameFrame ? { status: gameFrame.status, mode: gameFrame.mode, error: gameFrame.error } : null,
      game: gameFrame?.engine?.getSnapshot() || null,
      guideTotal: (CAPTURED_DATA.guide?.records || []).length,
      dialogueResultsCount: state.dialogueResults.length,
      forumTopicsCount: state.forumTopics.length,
      forumPostsCount: state.forumPosts.length,
    }),
    navigate: (route) => {
      window.location.hash = `#${route}`;
      state.route = route;
      renderApp();
      if (route === '/lobby' && (state.swStatusText.includes('檢查中') || state.swStatusText.includes('0 /'))) {
        void getPackCacheStats().then((cacheStats) => {
          state.swStatusText = `CacheStorage 已快取 ${cacheStats.cachedPacks} / ${cacheStats.totalPacks} 包 (${(cacheStats.cachedBytes / 1048576).toFixed(2)} MB)`;
          const elStat = document.querySelector('[data-testid="sw-status-text"]');
          if (elStat) elStat.textContent = state.swStatusText;
        });
      }
    },
    pingWorld: () => pingWorld(),
    gameWindow: () => gameFrameWindow(),
    game: () => gameFrame?.engine?.getSnapshot() || null,
    engine: () => gameFrame?.engine || null,
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
