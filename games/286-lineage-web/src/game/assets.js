// 286 天堂實境客戶端：資源載入、.json.gz 地圖區塊解壓與音效控制
import { assetUrl } from '../app.js';

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
const packFileCache = new Map();

async function loadPackIndex() {
  if (!packIndexPromise) {
    packIndexPromise = fetch(assetUrl('/art-assets.json'))
      .then((res) => (res.ok ? res.json() : null))
      .then((manifest) => {
        if (!manifest?.assets || !manifest?.packs) return null;
        const map = new Map();
        for (const row of manifest.assets) {
          map.set(row[0], { size: row[2], packIdx: row[3], offset: row[4] });
        }
        return { packs: manifest.packs, map };
      })
      .catch(() => null);
  }
  return packIndexPromise;
}

async function fetchPackedBytes(relPath) {
  const index = await loadPackIndex();
  const entry = index?.map.get(relPath);
  if (!entry) return null;
  const pack = index.packs[entry.packIdx];
  if (!pack?.file) return null;

  const cachedBuf = packFileCache.get(pack.file);
  if (cachedBuf) {
    return cachedBuf.slice(entry.offset, entry.offset + entry.size);
  }

  const url = assetUrl(`/packs/${pack.file}`);
  const end = entry.offset + entry.size - 1;
  try {
    const res = await fetch(url, { headers: { Range: `bytes=${entry.offset}-${end}` } });
    if (res.status === 206) {
      return await res.arrayBuffer();
    }
    if (res.ok) {
      const full = await res.arrayBuffer();
      packFileCache.set(pack.file, full);
      return full.slice(entry.offset, entry.offset + entry.size);
    }
  } catch {
    return null;
  }
  return null;
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
    if (spell?.hasIcon) return assetUrl(`/lineage163/all-magic-v2/${spell.id}.png`);
    return assetUrl('/lineage163/all-magic-v2/1.png');
  }

  loadImage(relPath) {
    if (!relPath || this.disposed) return Promise.resolve(null);
    if (this.imageCache.has(relPath)) return this.imageCache.get(relPath);

    const p = (async () => {
      const url = assetUrl(relPath);
      const tryUrl = (src) =>
        new Promise((resolve) => {
          const img = new Image();
          img.decoding = 'async';
          img.onload = () => resolve(img);
          img.onerror = () => resolve(null);
          img.src = src;
        });

      let img = await tryUrl(url);
      if (!img && !this.disposed) {
        const bytes = await fetchPackedBytes(relPath);
        if (bytes && !this.disposed) {
          const blobUrl = URL.createObjectURL(new Blob([bytes], { type: guessMime(relPath) }));
          this.objectUrls.push(blobUrl);
          img = await tryUrl(blobUrl);
        }
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
      try {
        const res = await fetch(assetUrl(rel));
        if (!res.ok || !res.body) return null;
        let json;
        if (typeof DecompressionStream === 'function') {
          const stream = res.body.pipeThrough(new DecompressionStream('gzip'));
          const text = await new Response(stream).text();
          json = JSON.parse(text);
        } else {
          return null;
        }
        this.stats.chunksLoaded += 1;
        this.stats.lastChunkKey = key;
        return json;
      } catch {
        return null;
      }
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
    this.imageCache.clear();
    this.loadedImages.clear();
    this.chunkCache.clear();
  }
}

export class GameAudioManager {
  constructor(assets) {
    this.assets = assets;
    this.muted = false;
    this.bgmAudio = null;
    this.currentBgm = '';
    this.sfxLastAt = new Map();
    this.activeSfx = new Set();
  }

  setMuted(muted) {
    this.muted = Boolean(muted);
    if (this.bgmAudio) {
      this.bgmAudio.muted = this.muted;
      if (!this.muted && this.bgmAudio.paused && this.currentBgm) {
        this.bgmAudio.play().catch(() => {});
      }
    }
  }

  playBgm(relPath = '/lineage163/sound/0.mp3') {
    if (this.currentBgm === relPath && this.bgmAudio) {
      if (!this.muted && this.bgmAudio.paused) this.bgmAudio.play().catch(() => {});
      return;
    }
    this.stopBgm();
    this.currentBgm = relPath;
    try {
      const audio = new Audio(assetUrl(relPath));
      audio.loop = true;
      audio.volume = 0.24;
      audio.muted = this.muted;
      this.bgmAudio = audio;
      if (!this.muted) audio.play().catch(() => {});
    } catch {
      // 無音效環境略過
    }
  }

  stopBgm() {
    if (this.bgmAudio) {
      try {
        this.bgmAudio.pause();
        this.bgmAudio.currentTime = 0;
      } catch {
        // 忽略
      }
      this.bgmAudio = null;
    }
    this.currentBgm = '';
  }

  playSound(idOrPath, volume = 0.38) {
    if (this.muted || !idOrPath) return;
    let relPath = '';
    if (typeof idOrPath === 'string' && idOrPath.startsWith('/')) {
      relPath = idOrPath;
    } else {
      const id = Number(idOrPath);
      if (!this.assets.hasSound(id)) return;
      relPath = `/lineage163/sound-mp3-v1/${id}.mp3`;
    }
    const now = performance.now();
    if (now - (this.sfxLastAt.get(relPath) || 0) < 90) return;
    this.sfxLastAt.set(relPath, now);
    if (this.activeSfx.size >= 8) return;
    try {
      const audio = new Audio(assetUrl(relPath));
      audio.volume = volume;
      this.activeSfx.add(audio);
      const cleanup = () => this.activeSfx.delete(audio);
      audio.addEventListener('ended', cleanup, { once: true });
      audio.addEventListener('error', cleanup, { once: true });
      audio.play().catch(cleanup);
    } catch {
      // 無音效環境略過
    }
  }
}
