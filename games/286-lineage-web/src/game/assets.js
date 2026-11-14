// 286 天堂實境客戶端：資源載入、.bin 整包 CacheStorage 快取、.json.gz 地圖區塊解壓與音效控制
import { assetUrl } from '../app.js';

const ASSET_CACHE_NAME = 'lineage-286-assets-v1';
const MANIFEST_TTL_MS = 5 * 60 * 1000;
const MAX_PACK_RAM_BYTES = 96 * 1024 * 1024;
const PACK_ONLY_SPELL_IDS = new Set([11, 20, 23, 24, 25, 27, 30, 31, 32, 33, 36, 37, 38, 39, 40, 42, 43, 44, 46, 47, 48]);

/**
 * 將數值清單轉為 Set 以便快速驗證資產是否存在，避免發出 404 請求。
 */
export function buildAssetSets(worldData) {
  return {
    tiles: new Set(worldData.validTiles || []),
    icons: new Set(worldData.validIcons || []),
    sounds: new Set(worldData.validSounds || []),
  };
}

let packIndexPromise = null;
let packRamBytes = 0;
const packFileCache = new Map();
const packPending = new Map();
const chunkPending = new Map();

function isHttpOrigin() {
  const origin = globalThis.location?.origin;
  return typeof origin === 'string' && /^https?:\/\//i.test(origin);
}

function isCrossOriginUrl(url) {
  if (!/^https?:\/\//i.test(url) || !isHttpOrigin()) return false;
  return !url.startsWith(`${globalThis.location.origin}/`) && url !== globalThis.location.origin;
}

function cacheKeyFor(kind, id) {
  if (!isHttpOrigin()) return null;
  const cleanKind = String(kind).replace(/^\/+|\/+$/g, '');
  const cleanId = encodeURIComponent(String(id));
  return `${globalThis.location.origin}/__l286_cache/${cleanKind}/${cleanId}`;
}

async function openAssetCache() {
  if (typeof globalThis.caches?.open !== 'function' || !isHttpOrigin()) return null;
  try {
    return await globalThis.caches.open(ASSET_CACHE_NAME);
  } catch {
    return null;
  }
}

async function readCacheEntry(kind, id, { expectedBytes = 0, maxAgeMs = 0 } = {}) {
  const key = cacheKeyFor(kind, id);
  if (!key) return null;
  const cache = await openAssetCache();
  if (!cache) return null;
  try {
    const res = await cache.match(key);
    if (!res) return null;
    const cachedAt = Number(res.headers.get('x-cached-at') || 0);
    const expired = Boolean(maxAgeMs > 0 && cachedAt > 0 && Date.now() - cachedAt > maxAgeMs);
    const buf = await res.arrayBuffer();
    if (!buf.byteLength || (expectedBytes > 0 && buf.byteLength !== expectedBytes)) {
      return null;
    }
    return { buf, expired };
  } catch {
    return null;
  }
}

async function writeCacheBytes(kind, id, buf, contentType = 'application/octet-stream', cacheControl = 'public, max-age=31536000, immutable') {
  const key = cacheKeyFor(kind, id);
  if (!key || !buf?.byteLength) return;
  const cache = await openAssetCache();
  if (!cache) return;
  try {
    await cache.put(
      key,
      new Response(buf, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Cache-Control': cacheControl,
          'x-cached-at': String(Date.now()),
        },
      }),
    );
  } catch {
    // 忽略儲存配額不足或隱私模式限制
  }
}

function getPackFromRam(file) {
  const buf = packFileCache.get(file);
  if (!buf) return null;
  packFileCache.delete(file);
  packFileCache.set(file, buf);
  return buf;
}

function setPackInRam(file, buf) {
  if (!buf?.byteLength) return;
  const prev = packFileCache.get(file);
  if (prev) {
    packRamBytes -= prev.byteLength;
    packFileCache.delete(file);
  }
  packFileCache.set(file, buf);
  packRamBytes += buf.byteLength;
  while (packRamBytes > MAX_PACK_RAM_BYTES && packFileCache.size > 1) {
    const oldest = packFileCache.keys().next().value;
    const oldBuf = packFileCache.get(oldest);
    packFileCache.delete(oldest);
    packRamBytes -= oldBuf?.byteLength || 0;
  }
}

function buildManifestIndex(manifest) {
  if (!manifest?.assets || !manifest?.packs) return null;
  const map = new Map();
  for (const row of manifest.assets) {
    map.set(row[0], { size: row[2], packIdx: row[3], offset: row[4] });
  }
  return {
    version: manifest.version ?? 'modern',
    packOrigin: manifest.packOrigin ?? '/packs',
    packs: manifest.packs,
    assetsCount: Array.isArray(manifest.assets) ? manifest.assets.length : map.size,
    map,
  };
}

/**
 * 載入並共享 art-assets.json 索引（於 CacheStorage 快取 5 分鐘，離線時可降級使用舊快取）。
 */
export async function loadPackIndex() {
  if (!packIndexPromise) {
    packIndexPromise = (async () => {
      const cached = await readCacheEntry('manifest', 'art-assets.json', { maxAgeMs: MANIFEST_TTL_MS });
      if (cached && !cached.expired) {
        try {
          const parsed = JSON.parse(new TextDecoder().decode(cached.buf));
          const built = buildManifestIndex(parsed);
          if (built) return built;
        } catch {
          // 繼續從網路重抓
        }
      }
      try {
        const res = await fetch(assetUrl('/art-assets.json'));
        if (res.ok) {
          const buf = await res.arrayBuffer();
          const parsed = JSON.parse(new TextDecoder().decode(buf));
          const built = buildManifestIndex(parsed);
          if (built) {
            void writeCacheBytes('manifest', 'art-assets.json', buf, 'application/json', 'public, max-age=300');
            return built;
          }
        }
      } catch {
        // 網路失敗時嘗試使用既有舊快取
      }
      if (cached?.buf) {
        try {
          return buildManifestIndex(JSON.parse(new TextDecoder().decode(cached.buf)));
        } catch {
          return null;
        }
      }
      return null;
    })();
  }
  return packIndexPromise;
}

async function loadPackBuffer(pack) {
  if (!pack?.file) return null;
  const ramHit = getPackFromRam(pack.file);
  if (ramHit) return ramHit;

  const inflight = packPending.get(pack.file);
  if (inflight) return inflight;

  const cacheId = pack.hash || pack.file;
  const task = (async () => {
    const cached = await readCacheEntry('packs', cacheId, { expectedBytes: pack.bytes || 0 });
    if (cached?.buf) {
      setPackInRam(pack.file, cached.buf);
      return cached.buf;
    }
    try {
      // 整包一次 GET（不送 Range），寫入 CacheStorage 後由本地記憶體直接切片給同包數十個資源
      const res = await fetch(assetUrl(`/packs/${pack.file}`));
      if (!res.ok) return null;
      const buf = await res.arrayBuffer();
      if (!buf.byteLength || (pack.bytes && buf.byteLength !== pack.bytes)) {
        return null;
      }
      await writeCacheBytes('packs', cacheId, buf);
      setPackInRam(pack.file, buf);
      return buf;
    } catch {
      return null;
    } finally {
      packPending.delete(pack.file);
    }
  })();

  packPending.set(pack.file, task);
  return task;
}

/**
 * 從對應 .bin 分包（優先 RAM LRU → CacheStorage → 整包 GET）切片取得資源位元組。
 */
export async function fetchPackedBytes(relPath) {
  const index = await loadPackIndex();
  const entry = index?.map.get(relPath);
  if (!entry) return null;
  const pack = index.packs[entry.packIdx];
  const buf = await loadPackBuffer(pack);
  if (!buf) return null;
  if (entry.offset < 0 || entry.offset + entry.size > buf.byteLength) return null;
  return buf.slice(entry.offset, entry.offset + entry.size);
}

async function decompressGzipBytes(bytes) {
  if (typeof DecompressionStream !== 'function') return null;
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Response(stream).text();
}

/**
 * 載入並解壓 .json.gz 地圖區塊（優先走 .bin 分包與 CacheStorage，避免逐塊重複請求 CDN）。
 */
export async function loadChunkJson(relPath) {
  if (!relPath) return null;
  const inflight = chunkPending.get(relPath);
  if (inflight) return inflight;

  const task = (async () => {
    try {
      let bytes = await fetchPackedBytes(relPath);
      if (!bytes) {
        const cached = await readCacheEntry('chunks', relPath);
        if (cached?.buf) {
          bytes = cached.buf;
        } else {
          const res = await fetch(assetUrl(relPath));
          if (!res.ok) return null;
          bytes = await res.arrayBuffer();
          if (bytes.byteLength) {
            void writeCacheBytes('chunks', relPath, bytes);
          }
        }
      }
      const text = await decompressGzipBytes(bytes);
      return text ? JSON.parse(text) : null;
    } catch {
      return null;
    } finally {
      chunkPending.delete(relPath);
    }
  })();

  chunkPending.set(relPath, task);
  return task;
}

/**
 * 統計目前瀏覽器 CacheStorage 已快取的分包數量與大小（不發出任何網路請求）。
 */
export async function getPackCacheStats() {
  const index = await loadPackIndex();
  const packs = index?.packs || [];
  const totalBytes = packs.reduce((sum, p) => sum + (p.bytes || 0), 0);
  const cache = await openAssetCache();
  if (!cache || !packs.length) {
    return { totalPacks: packs.length, cachedPacks: 0, cachedBytes: 0, totalBytes };
  }
  try {
    const keys = new Set((await cache.keys()).map((req) => req.url));
    let cachedPacks = 0;
    let cachedBytes = 0;
    for (const p of packs) {
      const k = cacheKeyFor('packs', p.hash || p.file);
      if (k && keys.has(k)) {
        cachedPacks += 1;
        cachedBytes += p.bytes || 0;
      }
    }
    return { totalPacks: packs.length, cachedPacks, cachedBytes, totalBytes };
  } catch {
    return { totalPacks: packs.length, cachedPacks: 0, cachedBytes: 0, totalBytes };
  }
}

let preloadPromise = null;

/**
 * 將尚未快取的分包依優先順序（core 優先，其後 background）寫入瀏覽器 CacheStorage。
 */
export async function preloadAllPacks({ onProgress, concurrency = 3 } = {}) {
  if (preloadPromise) return preloadPromise;
  preloadPromise = (async () => {
    const index = await loadPackIndex();
    const packs = index?.packs || [];
    if (!packs.length) return { totalPacks: 0, cachedPacks: 0, cachedBytes: 0, totalBytes: 0 };

    const totalBytes = packs.reduce((sum, p) => sum + (p.bytes || 0), 0);
    const cache = await openAssetCache();
    const existing = cache ? new Set((await cache.keys()).map((r) => r.url)) : new Set();

    const ordered = [
      ...packs.filter((p) => p.phase === 'core'),
      ...packs.filter((p) => p.phase !== 'core'),
    ];
    let donePacks = 0;
    let doneBytes = 0;
    const pending = [];
    for (const p of ordered) {
      const k = cacheKeyFor('packs', p.hash || p.file);
      if (k && existing.has(k)) {
        donePacks += 1;
        doneBytes += p.bytes || 0;
      } else {
        pending.push(p);
      }
    }
    onProgress?.({ donePacks, totalPacks: packs.length, doneBytes, totalBytes });

    let cursor = 0;
    const workers = Array.from({ length: Math.min(concurrency, Math.max(1, pending.length)) }, async () => {
      while (cursor < pending.length) {
        const pack = pending[cursor];
        cursor += 1;
        const buf = await loadPackBuffer(pack);
        if (buf) {
          donePacks += 1;
          doneBytes += pack.bytes || buf.byteLength;
          onProgress?.({ donePacks, totalPacks: packs.length, doneBytes, totalBytes });
        }
      }
    });
    await Promise.all(workers);
    return { totalPacks: packs.length, cachedPacks: donePacks, cachedBytes: doneBytes, totalBytes };
  })().finally(() => {
    preloadPromise = null;
  });
  return preloadPromise;
}

/**
 * 建立背景 Worker：同源時直接載入；若素材指到 Cloudflare 跨域 CDN，則經 CacheStorage 快取後以 Blob Worker 啟動。
 */
export async function createCachedWorker(relPath) {
  const url = assetUrl(relPath);
  if (!isCrossOriginUrl(url)) {
    return { worker: new Worker(url), revoke: null };
  }
  const cached = await readCacheEntry('workers', relPath);
  let buf = cached?.buf || null;
  if (!buf) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Worker load failed: ${res.status}`);
    buf = await res.arrayBuffer();
    if (buf.byteLength) {
      void writeCacheBytes('workers', relPath, buf, 'text/javascript; charset=utf-8');
    }
  }
  const blobUrl = URL.createObjectURL(new Blob([buf], { type: 'text/javascript' }));
  return {
    worker: new Worker(blobUrl),
    revoke: () => URL.revokeObjectURL(blobUrl),
  };
}

function guessMime(relPath) {
  if (relPath.endsWith('.webp')) return 'image/webp';
  if (relPath.endsWith('.png')) return 'image/png';
  if (relPath.endsWith('.mp3')) return 'audio/mpeg';
  if (relPath.endsWith('.wav')) return 'audio/wav';
  if (relPath.endsWith('.json')) return 'application/json';
  return 'application/octet-stream';
}

export class GameAssetLoader {
  constructor(worldData) {
    this.worldData = worldData;
    this.sets = buildAssetSets(worldData);
    this.imageCache = new Map();
    this.loadedImages = new Map();
    this.blobUrlByPath = new Map();
    this.chunkCache = new Map();
    this.objectUrls = [];
    this.disposed = false;
    this.stats = { imagesLoaded: 0, chunksLoaded: 0, lastChunkKey: '' };
  }

  getLoadedImage(relPath) {
    const img = this.loadedImages.get(relPath);
    if (img) return img;
    if (relPath && !this.imageCache.has(relPath)) {
      void this.loadImage(relPath);
    }
    return null;
  }

  hasTile(tileId) {
    return this.sets.tiles.has(Number(tileId));
  }

  hasIcon(iconId) {
    return this.sets.icons.has(Number(iconId));
  }

  hasSound(soundId) {
    return this.sets.sounds.has(Number(soundId));
  }

  itemIconUrl(iconId) {
    const id = Number(iconId);
    if (!this.sets.icons.has(id)) {
      return assetUrl('/lineage163/item-icons/5.png');
    }
    return assetUrl(`/lineage163/item-icons/${id}.png`);
  }

  spellIconUrl(spell) {
    if (!spell?.hasIcon) return assetUrl('/lineage163/all-magic-v2/1.png');
    const rel = `/lineage163/all-magic-v2/${spell.id}.png`;
    const cachedBlob = this.blobUrlByPath.get(rel);
    if (cachedBlob) return cachedBlob;
    if (PACK_ONLY_SPELL_IDS.has(Number(spell.id))) {
      void this.loadImage(rel);
      return assetUrl('/lineage163/all-magic-v2/1.png');
    }
    return assetUrl(rel);
  }

  /**
   * 預先從單一圖示分包解開只存在分包內的法術圖示，避免魔法書與快捷列發出 404 請求。
   */
  async hydrateSpellIcons(worldData, onReady) {
    if (this.disposed) return;
    const spells = Array.isArray(worldData?.spells) ? worldData.spells : Object.values(worldData?.spells || {});
    const targets = spells.filter((sp) => sp?.hasIcon && PACK_ONLY_SPELL_IDS.has(Number(sp.id)));
    if (!targets.length) return;
    await Promise.all(targets.map((sp) => this.loadImage(`/lineage163/all-magic-v2/${sp.id}.png`)));
    if (!this.disposed) onReady?.();
  }

  loadImage(relPath) {
    if (!relPath || this.disposed) return Promise.resolve(null);
    if (this.imageCache.has(relPath)) return this.imageCache.get(relPath);

    const p = (async () => {
      const tryUrl = (src, allowCors = false) =>
        new Promise((resolve) => {
          const img = new Image();
          img.decoding = 'async';
          if (allowCors && isCrossOriginUrl(src)) {
            img.crossOrigin = 'anonymous';
          }
          img.onload = () => resolve(img);
          img.onerror = () => resolve(null);
          img.src = src;
        });

      const index = await loadPackIndex();
      let img = null;
      // 先看 art-assets.json 索引：收在 .bin 分包裡的資源直接本地切片解碼，完全不送 404 散檔請求
      if (index?.map.has(relPath)) {
        const bytes = await fetchPackedBytes(relPath);
        if (bytes && !this.disposed) {
          const blobUrl = URL.createObjectURL(new Blob([bytes], { type: guessMime(relPath) }));
          this.objectUrls.push(blobUrl);
          this.blobUrlByPath.set(relPath, blobUrl);
          img = await tryUrl(blobUrl);
        }
      }
      if (!img && !this.disposed) {
        img = await tryUrl(assetUrl(relPath), true);
      }
      if (img) {
        this.loadedImages.set(relPath, img);
        this.stats.imagesLoaded += 1;
      }
      return img;
    })();

    this.imageCache.set(relPath, p);
    return p;
  }

  loadChunk(mapId, chunkHex) {
    const key = `${mapId}/${chunkHex}`;
    if (this.chunkCache.has(key)) return this.chunkCache.get(key);

    const p = (async () => {
      const rel = `/lineage163/maps/${mapId}/${chunkHex}.json.gz`;
      const json = await loadChunkJson(rel);
      if (json && !this.disposed) {
        this.stats.chunksLoaded += 1;
        this.stats.lastChunkKey = key;
      }
      return json;
    })();

    this.chunkCache.set(key, p);
    return p;
  }

  dispose() {
    this.disposed = true;
    for (const u of this.objectUrls) {
      try {
        URL.revokeObjectURL(u);
      } catch {
        // 忽略釋放失敗
      }
    }
    this.objectUrls = [];
    this.blobUrlByPath.clear();
    this.imageCache.clear();
    this.loadedImages.clear();
    this.chunkCache.clear();
  }
}

// ───────── 音效與背景音樂 ─────────
// 1.63 原版音效（/lineage163/sound-mp3-v1/<id>.mp3、/level-up-v1/517.wav）與動作音效表
// （/lineage163/animation-sounds.json：造型 gfx → 動作 → 影格 → 音效 id）只存在 .bin 分包裡，
// 直接用網址抓會 404，所以一律走 fetchPackedBytes 取位元組，再用 Web Audio 解碼快取。
// 背景音樂是硬碟上的 mp3，用 <audio> 串流，依區域切換並淡入淡出。

/** 動作 id（原版 sprite 動作編號）：攻擊、受擊、死亡 */
const ACT_ATTACK = 1;
const ACT_DAMAGE = 2;
const ACT_DIE = 8;

// 拿武器的怪物把音效記在武器動作下：劍 4–7、斧 11–14、弓 20–23、矛 24–27（攻擊／受擊各差 1）；30 是第二種攻擊
const ACTION_CANDIDATES = {
  [ACT_ATTACK]: [1, 5, 12, 21, 25, 30],
  [ACT_DAMAGE]: [2, 6, 13, 22, 26],
  [ACT_DIE]: [8],
};
const SPELL_ACTIONS = new Set(['17', '18', '19']);

/** 各區域平時的背景音樂 */
export const ZONE_BGM = {
  town: '/assets/286/assets/284/bgm/town_talking.mp3', // 說話之島村莊、甘特之家
  field: '/lineage163/sound/0.mp3', // 說話之島野外
  dungeon: '/lineage163/sound/0.mp3', // 說話之島地監 1、2 樓
};

/** 只要在打怪就放戰鬥音樂；最後一次交戰後過了脫戰時間才淡出，回到區域音樂 */
export const BATTLE_BGM = '/assets/286/assets/284/bgm/battle.mp3';
export const BATTLE_COOLDOWN_MS = 8000;
const TRACK_BGM_VOLUME = {
  [BATTLE_BGM]: 0.14,
};

/** 進遊戲就先載入的常用音效（拾取、喝水、裝備、揮擊、升級） */
const PRELOAD_SFX = [103, 104, 105, 246, 247, 248, 249, '/level-up-v1/517.wav'];

/** 與 HUD 的安全區判定一致：甘特之家整張圖，以及說話之島村莊範圍 */
export function zoneOf(player) {
  if (!player) return 'field';
  if (player.map === 1 || player.map === 2) return 'dungeon';
  if (player.map === 3) return 'town';
  if (player.map === 0 && player.tx >= 32550 && player.tx <= 32615 && player.ty >= 32915 && player.ty <= 32975) {
    return 'town';
  }
  return 'field';
}

let animSoundsPromise = null;
function loadAnimationSounds() {
  if (!animSoundsPromise) {
    animSoundsPromise = fetchPackedBytes('/lineage163/animation-sounds.json')
      .then((bytes) => (bytes ? JSON.parse(new TextDecoder().decode(bytes)) : {}))
      .catch(() => ({}));
  }
  return animSoundsPromise;
}

async function fetchAudioBytes(relPath) {
  const packed = await fetchPackedBytes(relPath);
  if (packed) return packed;
  const cached = await readCacheEntry('audio', relPath);
  if (cached?.buf) return cached.buf;
  try {
    const res = await fetch(assetUrl(relPath));
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    if (buf.byteLength) {
      void writeCacheBytes('audio', relPath, buf, guessMime(relPath));
    }
    return buf;
  } catch {
    return null;
  }
}

export class GameAudioManager {
  constructor(assets) {
    this.assets = assets;
    this.muted = false;
    this.bgmAudio = null;
    this.currentBgm = '';
    this.bgmVolume = 0.24;
    this.duckGain = 1;
    this.duckTimer = null;
    this.bgmSeq = 0;
    this.fadeTimers = new Set();
    this.bgmEls = new Map(); // 曲目 → <audio>，區域音樂被戰鬥打斷後從原處接著放
    this.inCombat = false;
    this.lastCombatAt = -Infinity;
    this.lastPlayerAttackAt = null;
    this.lastPlayerHp = null;
    try {
      // 戰鬥音樂先緩衝，避免一開打才開始下載
      const battle = new Audio(assetUrl(BATTLE_BGM));
      battle.loop = true;
      battle.preload = 'auto';
      this.bgmEls.set(BATTLE_BGM, battle);
    } catch {
      // 無音效環境略過
    }
    this.sfxLastAt = new Map();
    this.ctx = null;
    this.sfxBus = null;
    this.buffers = new Map();
    this.activeVoices = 0;
    this.animSounds = null;
    this.zone = '';
    this.zoneCandidate = '';
    this.zoneSince = 0;
    this.mobAnimSeen = new Map();
    this.preloadedGfx = new Set();
    this.stats = { played: 0, dropped: 0, failed: 0, last: '' };
    loadAnimationSounds().then((table) => {
      this.animSounds = table;
    });
    for (const snd of PRELOAD_SFX) void this.loadBuffer(this.soundPath(snd));
  }

  /** 第一次使用時建立 AudioContext；在使用者手勢內呼叫可解除瀏覽器的自動播放限制 */
  ensureContext() {
    if (!this.ctx) {
      const Ctor = typeof window !== 'undefined' ? window.AudioContext || window.webkitAudioContext : null;
      if (!Ctor) return null;
      try {
        this.ctx = new Ctor();
        this.sfxBus = this.ctx.createGain();
        this.sfxBus.gain.value = this.muted ? 0 : 1;
        this.sfxBus.connect(this.ctx.destination);
      } catch {
        this.ctx = null;
        return null;
      }
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    return this.ctx;
  }

  setMuted(muted) {
    this.muted = Boolean(muted);
    if (this.sfxBus) this.sfxBus.gain.value = this.muted ? 0 : 1;
    for (const audio of this.bgmEls.values()) {
      audio.muted = this.muted;
      if (this.muted && audio._fadeTimer) {
        clearInterval(audio._fadeTimer);
        this.fadeTimers.delete(audio._fadeTimer);
        audio._fadeTimer = null;
        audio._fadingOut = false;
        audio.pause();
      }
    }
    if (!this.muted && this.bgmAudio && this.bgmAudio.paused && this.currentBgm) {
      this.#playAudioExclusive(this.bgmAudio, this.currentBgm, this.bgmSeq);
    }
  }

  /** 目前區域該放的曲目（engine 開場與點擊恢復播放時用） */
  bgmFor(world) {
    return ZONE_BGM[zoneOf(world?.player)] || ZONE_BGM.field;
  }

  #targetBgmVolume(relPath = this.currentBgm) {
    const base = TRACK_BGM_VOLUME[relPath] ?? this.bgmVolume;
    return Math.max(0, Math.min(1, base * this.duckGain));
  }

  #stopAllBgmExcept(keepPath = null) {
    for (const [key, audio] of this.bgmEls.entries()) {
      if (key === keepPath) continue;
      if (audio._fadeTimer) {
        clearInterval(audio._fadeTimer);
        this.fadeTimers.delete(audio._fadeTimer);
        audio._fadeTimer = null;
      }
      audio._fadingOut = false;
      try {
        if (!audio.paused) audio.pause();
      } catch {
        // 忽略
      }
    }
  }

  #playAudioExclusive(audio, relPath, seq) {
    if (this.muted || this.currentBgm !== relPath || this.bgmSeq !== seq) return;
    this.#stopAllBgmExcept(relPath);
    const pr = audio.play();
    if (pr && typeof pr.then === 'function') {
      pr.then(() => {
        if (this.muted || this.currentBgm !== relPath || this.bgmSeq !== seq) {
          audio.pause();
        }
      }).catch(() => {});
    }
  }

  #duckBgm() {
    if (this.muted || !this.bgmAudio) return;
    this.duckGain = 0.65;
    if (!this.bgmAudio._fadeTimer) {
      this.bgmAudio.volume = this.#targetBgmVolume(this.currentBgm);
    }
    if (this.duckTimer) clearTimeout(this.duckTimer);
    this.duckTimer = setTimeout(() => {
      this.duckTimer = null;
      this.duckGain = 1;
      if (this.bgmAudio && !this.bgmAudio._fadeTimer && !this.bgmAudio.paused) {
        this.bgmAudio.volume = this.#targetBgmVolume(this.currentBgm);
      }
    }, 350);
  }

  #fade(audio, from, toOrFn, ms, done) {
    if (audio._fadeTimer) {
      clearInterval(audio._fadeTimer);
      this.fadeTimers.delete(audio._fadeTimer);
    }
    const steps = Math.max(1, Math.round(ms / 40));
    let n = 0;
    audio.volume = Math.max(0, Math.min(1, from));
    const timer = setInterval(() => {
      n += 1;
      const to = typeof toOrFn === 'function' ? toOrFn() : toOrFn;
      audio.volume = Math.max(0, Math.min(1, from + ((to - from) * n) / steps));
      if (n >= steps) {
        clearInterval(timer);
        this.fadeTimers.delete(timer);
        audio._fadeTimer = null;
        done?.();
      }
    }, 40);
    audio._fadeTimer = timer;
    this.fadeTimers.add(timer);
  }

  /** 目前該放的曲目：交戰中放戰鬥音樂，否則放區域音樂 */
  desiredBgm(world) {
    return this.inCombat ? BATTLE_BGM : this.bgmFor(world);
  }

  unlock(world) {
    this.ensureContext();
    if (this.muted) return;
    const want = this.desiredBgm(world);
    if (!this.currentBgm || this.currentBgm !== want) {
      this.playBgm(want);
    } else if (this.bgmAudio?.paused && !this.bgmAudio._fadingOut) {
      this.#playAudioExclusive(this.bgmAudio, this.currentBgm, this.bgmSeq);
    }
  }

  playBgm(relPath = ZONE_BGM.field, { fadeMs = 0, restart = false } = {}) {
    this.ensureContext();
    if (this.currentBgm === relPath && this.bgmAudio && !this.bgmAudio._fadingOut) {
      this.#stopAllBgmExcept(relPath);
      if (!this.muted && this.bgmAudio.paused) {
        this.#playAudioExclusive(this.bgmAudio, relPath, this.bgmSeq);
      }
      return;
    }

    this.bgmSeq += 1;
    const seq = this.bgmSeq;
    const old = this.bgmAudio;
    const oldKey = old ? [...this.bgmEls.entries()].find(([, el]) => el === old)?.[0] || null : null;
    this.#stopAllBgmExcept(old && fadeMs > 0 && !old.paused && !this.muted ? oldKey : null);
    this.currentBgm = relPath;

    const startNext = () => {
      if (this.bgmSeq !== seq || this.currentBgm !== relPath) return;
      this.#stopAllBgmExcept(relPath);
      try {
        let audio = this.bgmEls.get(relPath);
        if (!audio) {
          audio = new Audio(assetUrl(relPath));
          audio.loop = true;
          this.bgmEls.set(relPath, audio);
        }
        if (audio._fadeTimer) {
          clearInterval(audio._fadeTimer);
          this.fadeTimers.delete(audio._fadeTimer);
          audio._fadeTimer = null;
        }
        audio._fadingOut = false;
        if (restart) {
          try {
            audio.currentTime = 0;
          } catch {
            // 尚未載入時無法設定，略過
          }
        }
        audio.muted = this.muted;
        const targetFn = () => this.#targetBgmVolume(relPath);
        audio.volume = fadeMs > 0 ? 0 : targetFn();
        this.bgmAudio = audio;
        this.#playAudioExclusive(audio, relPath, seq);
        if (fadeMs > 0 && !this.muted) {
          this.#fade(audio, 0, targetFn, fadeMs);
        }
      } catch {
        // 無音效環境略過
      }
    };

    if (old && old !== this.bgmEls.get(relPath) && fadeMs > 0 && !old.paused && !this.muted) {
      old._fadingOut = true;
      const outMs = Math.min(280, Math.max(120, Math.round(fadeMs * 0.35)));
      this.#fade(old, old.volume, 0, outMs, () => {
        old._fadingOut = false;
        old.pause();
        startNext();
      });
    } else {
      if (old) {
        old._fadingOut = false;
        old.pause();
      }
      startNext();
    }
  }

  stopBgm() {
    this.bgmSeq += 1;
    if (this.duckTimer) {
      clearTimeout(this.duckTimer);
      this.duckTimer = null;
    }
    this.duckGain = 1;
    for (const t of this.fadeTimers) clearInterval(t);
    this.fadeTimers.clear();
    for (const audio of this.bgmEls.values()) {
      try {
        audio._fadeTimer = null;
        audio._fadingOut = false;
        audio.pause();
        audio.currentTime = 0;
      } catch {
        // 忽略
      }
    }
    this.bgmAudio = null;
    this.currentBgm = '';
  }

  soundPath(idOrPath) {
    if (typeof idOrPath === 'string' && idOrPath.startsWith('/')) return idOrPath;
    const id = Number(idOrPath);
    if (!Number.isFinite(id) || !this.assets.hasSound(id)) return '';
    return `/lineage163/sound-mp3-v1/${id}.mp3`;
  }

  loadBuffer(relPath) {
    if (!relPath) return Promise.resolve(null);
    let task = this.buffers.get(relPath);
    if (!task) {
      task = (async () => {
        const bytes = await fetchAudioBytes(relPath);
        if (!bytes) return null;
        const ctx = this.ensureContext();
        if (!ctx) return null;
        try {
          return await ctx.decodeAudioData(bytes.slice(0));
        } catch {
          return null;
        }
      })().then((buf) => {
        if (!buf) this.stats.failed += 1;
        return buf;
      });
      this.buffers.set(relPath, task);
    }
    return task;
  }

  playSound(idOrPath, volume = 0.38) {
    if (this.muted || !idOrPath) return;
    const relPath = this.soundPath(idOrPath);
    if (!relPath) return;
    const now = performance.now();
    if (now - (this.sfxLastAt.get(relPath) || 0) < 90) return;
    this.sfxLastAt.set(relPath, now);
    const ctx = this.ensureContext();
    if (!ctx) return;
    this.loadBuffer(relPath).then((buf) => {
      // 第一次要從分包取檔：超過 0.5 秒才到就不補放，免得音效和畫面脫節
      if (!buf || this.muted || performance.now() - now > 500 || this.activeVoices >= 10) {
        if (buf) this.stats.dropped += 1;
        return;
      }
      try {
        const src = ctx.createBufferSource();
        src.buffer = buf;
        const gain = ctx.createGain();
        gain.gain.value = volume;
        src.connect(gain).connect(this.sfxBus);
        this.activeVoices += 1;
        src.onended = () => {
          this.activeVoices -= 1;
        };
        src.start();
        this.#duckBgm();
        this.stats.played += 1;
        this.stats.last = relPath;
      } catch {
        // 忽略
      }
    });
  }

  /**
   * 找出這隻怪該用哪個動作的音效。原版素材裡少數怪缺某種音效時：
   * 受擊 → 改用牠自己的叫聲（移動／待機動作，例如青蛙只有 41 呱聲）；死亡 → 改用受擊音效。
   */
  mobSoundAction(gfx, kind) {
    const table = this.animSounds?.[String(gfx)];
    if (!table) return null;
    for (const act of ACTION_CANDIDATES[kind] || [kind]) {
      if (table[String(act)]) return act;
    }
    if (kind === ACT_DAMAGE) {
      const own = Object.keys(table).find((k) => k !== '8' && !SPELL_ACTIONS.has(k));
      return own !== undefined ? Number(own) : null;
    }
    if (kind === ACT_DIE) return this.mobSoundAction(gfx, ACT_DAMAGE);
    return null;
  }

  /** 怪物攻擊／受擊／死亡音效（每種怪各自不同） */
  playMobSound(gfx, kind, volume = 0.32) {
    const act = this.mobSoundAction(gfx, kind);
    return act === null ? false : this.playAnimationSound(gfx, act, volume);
  }

  /** 依原版動作音效表播放：同一動作有多個影格帶音效時，依影格間隔（約 80 ms）依序播放 */
  playAnimationSound(gfx, action, volume = 0.32) {
    const frames = this.animSounds?.[String(gfx)]?.[String(action)];
    if (!frames) return false;
    const entries = Object.entries(frames)
      .map(([frame, id]) => [Number(frame), id])
      .sort((a, b) => a[0] - b[0]);
    const first = entries[0]?.[0] ?? 0;
    for (const [frame, id] of entries) {
      const delay = (frame - first) * 80;
      if (delay <= 0) this.playSound(id, volume);
      else setTimeout(() => this.playSound(id, volume), delay);
    }
    return true;
  }

  #preloadGfx(gfx) {
    if (!this.animSounds || this.preloadedGfx.has(gfx)) return;
    this.preloadedGfx.add(gfx);
    const acts = this.animSounds[String(gfx)];
    if (!acts) return;
    for (const kind of [ACT_ATTACK, ACT_DAMAGE, ACT_DIE]) {
      const act = this.mobSoundAction(gfx, kind);
      if (act === null) continue;
      for (const id of Object.values(acts[String(act)] || {})) void this.loadBuffer(this.soundPath(id));
    }
  }

  /**
   * 每幀由 engine 呼叫：
   * 1. 區域變了（停留 1.2 秒以上，避免在邊界來回切）就淡入淡出換背景音樂。
   * 2. 附近怪物的動作切換到攻擊／受擊／死亡時，依原版動作音效表播放，距離越遠越小聲。
   */
  update(world, now = performance.now()) {
    const p = world?.player;
    if (!p) return;

    const zone = zoneOf(p);
    if (zone !== this.zoneCandidate) {
      this.zoneCandidate = zone;
      this.zoneSince = now;
    }
    const firstFrame = this.zone === '';
    if (zone !== this.zone && (firstFrame || now - this.zoneSince >= 1200)) {
      this.zone = zone;
    }

    // 交戰判定：主角攻擊真正怪物（非村內木人練習）、主角掉血、鎖定中或仇恨主角的怪物進入攻擊／受擊／死亡
    let combatNow = false;
    if (this.lastPlayerAttackAt !== null && p.lastAttackAt !== this.lastPlayerAttackAt && !p.isHittingDummy) {
      combatNow = true;
    }
    this.lastPlayerAttackAt = p.lastAttackAt ?? null;
    if (this.lastPlayerHp !== null && p.hp < this.lastPlayerHp) combatNow = true;
    this.lastPlayerHp = p.hp;

    const seen = this.mobAnimSeen;
    const mobs = Array.isArray(world.mobs) ? world.mobs : [];
    for (const mob of mobs) {
      if (mob.map !== p.map) continue;
      const dist = Math.max(Math.abs(mob.tx - p.tx), Math.abs(mob.ty - p.ty));
      if (dist > 16) {
        seen.delete(mob.id);
        continue;
      }
      this.#preloadGfx(mob.gfx);
      const key = `${mob.animState}@${mob.animStartedAt}`;
      const prev = seen.get(mob.id);
      seen.set(mob.id, key);
      if (prev === undefined || prev === key) continue;
      const act =
        mob.animState === 'attack' ? ACT_ATTACK : mob.animState === 'damage' ? ACT_DAMAGE : mob.animState === 'die' ? ACT_DIE : 0;
      if (!act) continue;
      if (mob.aggroTarget || mob.id === p.targetId) combatNow = true;
      if (this.animSounds) this.playMobSound(mob.gfx, act, 0.34 * Math.max(0.25, 1 - dist / 16));
    }
    if (seen.size > 200) {
      const alive = new Set(mobs.map((m) => m.id));
      for (const id of seen.keys()) if (!alive.has(id)) seen.delete(id);
    }

    if (combatNow) this.lastCombatAt = now;
    const wasInCombat = this.inCombat;
    this.inCombat = p.hp > 0 && now - this.lastCombatAt < BATTLE_COOLDOWN_MS;

    // 換曲：進入戰鬥快速淡入並從頭放；脫戰慢慢淡出回到區域音樂（區域音樂從被打斷處接著放）
    const want = this.desiredBgm(world);
    if (want !== this.currentBgm && (this.currentBgm || firstFrame)) {
      const entering = this.inCombat && !wasInCombat;
      this.playBgm(want, { fadeMs: firstFrame ? 0 : entering ? 400 : 1500, restart: entering });
    }
  }

  dispose() {
    this.stopBgm();
    try {
      this.ctx?.close();
    } catch {
      // 忽略
    }
    this.ctx = null;
    this.buffers.clear();
  }
}
