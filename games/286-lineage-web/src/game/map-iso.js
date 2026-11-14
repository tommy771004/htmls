// 286 天堂實境客戶端：等距地圖座標、碰撞解碼、A* 尋路、區塊地磚快取與 3D 景物深排序
const MAP_ORIGIN_X = 32256; // 0x7e00
const MAP_ORIGIN_Y = 32768; // 0x8000
const CHUNK_TILES = 64;
const CHUNK_CANVAS_W = 64 * 48; // 3072
const CHUNK_CANVAS_H = 64 * 24; // 1536
const CHUNK_Y_SHIFT = 63 * 12; // 756

/**
 * 原版天磚格座標 (tx, ty) 轉等距世界像素中心點。
 */
export function tileToWorld(tx, ty) {
  return {
    x: (tx + ty - MAP_ORIGIN_X - MAP_ORIGIN_Y) * 24 + 24,
    y: (ty - tx - MAP_ORIGIN_Y + MAP_ORIGIN_X) * 12 + 6144 + 12,
  };
}

/**
 * 世界像素 (px, py) 轉浮點格座標，回傳最近格需由呼叫端 Math.round。
 */
export function worldToTile(px, py) {
  const u = (px - 24) / 24;
  const v = (py - 6156) / 12;
  return {
    x: MAP_ORIGIN_X + (u - v) / 2,
    y: MAP_ORIGIN_Y + (u + v) / 2,
  };
}

export function chunkHexKey(tx, ty) {
  const cx = (Math.floor(tx / CHUNK_TILES) + MAP_ORIGIN_X) >>> 0;
  const cy = (Math.floor(ty / CHUNK_TILES) + MAP_ORIGIN_X) >>> 0;
  return cx.toString(16).padStart(4, '0') + cy.toString(16).padStart(4, '0');
}

export function tileDistance(ax, ay, bx, by) {
  return Math.max(Math.abs(ax - bx), Math.abs(ay - by));
}

export function headingBetween(dx, dy) {
  // 天堂 8 方向（依等距螢幕方向）：
  // 0:(-dy,-?), 驗證與原版 8 方向：0=北(-1,-1? or 0,-1), 2=東(1,-1? or 1,0)
  // 原版天堂：heading 0:(0,-1)上偏右? 實測 (dx,dy) 對應：
  const TABLE = [
    [0, -1], // 0: 上左 (N)
    [1, -1], // 1: 上 (NE)
    [1, 0],  // 2: 上右 (E)
    [1, 1],  // 3: 右 (SE)
    [0, 1],  // 4: 下右 (S)
    [-1, 1], // 5: 下 (SW)
    [-1, 0], // 6: 下左 (W)
    [-1, -1],// 7: 左 (NW)
  ];
  const sx = Math.sign(dx);
  const sy = Math.sign(dy);
  for (let i = 0; i < 8; i += 1) {
    if (TABLE[i][0] === sx && TABLE[i][1] === sy) return i;
  }
  return 4;
}

export const HEADING_DELTAS = [
  [0, -1],
  [1, -1],
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [-1, -1],
];

export class LineageIsoMap {
  constructor(worldData, assets) {
    this.worldData = worldData;
    this.assets = assets;
    this.rawCollision = worldData.collision || {};
    this.decodedCollision = new Map();
    this.redrawLayers = worldData.redrawLayers || {};
    this.retainedSetByMap = new Map();
    for (const [mId, list] of Object.entries(worldData.retainedChunks || {})) {
      this.retainedSetByMap.set(Number(mId), new Set(list.map((row) => row[0])));
    }
    this.renderedChunks = new Map(); // `${mapId}/${hex}` -> { status, groundCanvas, objects }
    this.passCache = new Map();
    this.walkableTileCache = new Map();
  }

  hasChunk(mapId, hex) {
    return this.retainedSetByMap.get(Number(mapId))?.has(hex) ?? false;
  }

  getCollisionBytes(tx, ty, mapId) {
    const hex = chunkHexKey(tx, ty);
    const key = `${mapId}/${hex}`;
    let buf = this.decodedCollision.get(key);
    if (!buf) {
      const b64 = this.rawCollision[key];
      if (!b64) return null;
      const bin = atob(b64);
      buf = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i += 1) buf[i] = bin.charCodeAt(i);
      this.decodedCollision.set(key, buf);
    }
    const lx = ((tx % 64) + 64) % 64;
    const ly = ((ty % 64) + 64) % 64;
    const idx = ly * 128 + lx * 2;
    let b0 = buf[idx] || 0;
    let b1 = buf[idx + 1] || 0;
    // 原版風木城地監 2 樓 (map 24) 通道穿牆修正
    if (Number(mapId) === 24) {
      if (tx === 32769 && (ty === 32785 || ty === 32786)) b0 &= ~1;
      if ((tx === 32749 || tx === 32750 || tx === 32784 || tx === 32785) && ty === 32769) b1 &= ~1;
    }
    return [b0, b1];
  }

  /**
   * 惰性掃描並快取指定地圖所有可行走格，供無固定座標的地監隨機刷怪與隨機傳送使用。
   */
  getWalkableTiles(mapId) {
    const m = Number(mapId);
    let cached = this.walkableTileCache.get(m);
    if (cached) return cached;

    cached = [];
    const prefix = `${m}/`;
    for (const key of Object.keys(this.rawCollision)) {
      if (!key.startsWith(prefix)) continue;
      const hex = key.slice(prefix.length);
      if (hex.length !== 8) continue;
      const cx = parseInt(hex.slice(0, 4), 16);
      const cy = parseInt(hex.slice(4, 8), 16);
      const baseX = (cx - MAP_ORIGIN_X) * CHUNK_TILES;
      const baseY = (cy - MAP_ORIGIN_X) * CHUNK_TILES;
      for (let ly = 0; ly < CHUNK_TILES; ly += 1) {
        const ty = baseY + ly;
        for (let lx = 0; lx < CHUNK_TILES; lx += 1) {
          const tx = baseX + lx;
          if (this.isWalkableTile(tx, ty, m)) {
            cached.push({ x: tx, y: ty });
          }
        }
      }
    }
    this.walkableTileCache.set(m, cached);
    return cached;
  }

  canStepCardinal(tx, ty, dx, dy, mapId) {
    if (Math.abs(dx) + Math.abs(dy) !== 1) return false;
    const cur = this.getCollisionBytes(tx, ty, mapId);
    const nxt = this.getCollisionBytes(tx + dx, ty + dy, mapId);
    if (!cur || !nxt) return false;
    if (dx === 1) return !(cur[1] & 1);
    if (dx === -1) {
      const prev = this.getCollisionBytes(tx - 1, ty, mapId);
      return prev ? !(prev[1] & 1) : false;
    }
    if (dy === -1) return !(cur[0] & 1);
    return !(nxt[0] & 1);
  }

  canStep(tx, ty, dx, dy, mapId) {
    if (Math.abs(dx) > 1 || Math.abs(dy) > 1 || (!dx && !dy)) return false;
    if (!dx || !dy) return this.canStepCardinal(tx, ty, dx, dy, mapId);
    return (
      (this.canStepCardinal(tx, ty, dx, 0, mapId) &&
        this.canStepCardinal(tx + dx, ty, 0, dy, mapId)) ||
      (this.canStepCardinal(tx, ty, 0, dy, mapId) &&
        this.canStepCardinal(tx, ty + dy, dx, 0, mapId))
    );
  }

  isWalkableTile(tx, ty, mapId) {
    return (
      this.canStepCardinal(tx, ty, 1, 0, mapId) ||
      this.canStepCardinal(tx, ty, -1, 0, mapId) ||
      this.canStepCardinal(tx, ty, 0, 1, mapId) ||
      this.canStepCardinal(tx, ty, 0, -1, mapId)
    );
  }

  /** 回傳該座標的 Lineage 原始安全區旗標（collision bit 0x04） */
  hasSafetyBit(tx, ty, mapId) {
    const [b0, b1] = this.getCollisionBytes(tx, ty, mapId);
    return (b0 & 4) !== 0 || (b1 & 4) !== 0;
  }

  /**
   * 尋路至目標格（或若目標被阻擋則自動找最近可走鄰格），使用帶啟發式的 A* 搜尋。
   */
  findPath(sx, sy, gx, gy, mapId, blockedSet = null, maxNodes = 900) {
    if (sx === gx && sy === gy) return [];
    let targetX = gx;
    let targetY = gy;
    if (!this.isWalkableTile(targetX, targetY, mapId) || blockedSet?.has(`${targetX},${targetY}`)) {
      let best = null;
      let bestD = 1e9;
      for (let r = 1; r <= 3 && !best; r += 1) {
        for (let oy = -r; oy <= r; oy += 1) {
          for (let ox = -r; ox <= r; ox += 1) {
            const nx = gx + ox;
            const ny = gy + oy;
            if (this.isWalkableTile(nx, ny, mapId) && !blockedSet?.has(`${nx},${ny}`)) {
              const d = Math.hypot(nx - sx, ny - sy);
              if (d < bestD) {
                bestD = d;
                best = { x: nx, y: ny };
              }
            }
          }
        }
      }
      if (!best) return [];
      targetX = best.x;
      targetY = best.y;
    }

    const encode = (x, y) => `${x},${y}`;
    const startKey = encode(sx, sy);
    const goalKey = encode(targetX, targetY);
    const gScore = new Map([[startKey, 0]]);
    const parent = new Map();
    const closed = new Set();
    const open = [{ x: sx, y: sy, key: startKey, f: tileDistance(sx, sy, targetX, targetY) }];

    let closestNode = { x: sx, y: sy, key: startKey, d: tileDistance(sx, sy, targetX, targetY) };
    let expanded = 0;

    while (open.length && expanded < maxNodes) {
      let bestIdx = 0;
      for (let i = 1; i < open.length; i += 1) {
        if (open[i].f < open[bestIdx].f) bestIdx = i;
      }
      const cur = open.splice(bestIdx, 1)[0];
      if (cur.key === goalKey) {
        return this.#reconstructPath(parent, startKey, cur.key);
      }
      if (closed.has(cur.key)) continue;
      closed.add(cur.key);
      expanded += 1;

      const curD = tileDistance(cur.x, cur.y, targetX, targetY);
      if (curD < closestNode.d) closestNode = { ...cur, d: curD };

      const curG = gScore.get(cur.key) || 0;
      for (const [dx, dy] of HEADING_DELTAS) {
        if (!this.canStep(cur.x, cur.y, dx, dy, mapId)) continue;
        const nx = cur.x + dx;
        const ny = cur.y + dy;
        const nKey = encode(nx, ny);
        if (closed.has(nKey)) continue;
        if (blockedSet?.has(nKey) && nKey !== goalKey) continue;
        const stepCost = dx && dy ? 1.414 : 1;
        const nextG = curG + stepCost;
        if (nextG < (gScore.get(nKey) ?? 1e9)) {
          gScore.set(nKey, nextG);
          parent.set(nKey, { prev: cur.key, x: nx, y: ny });
          const h = Math.max(Math.abs(nx - targetX), Math.abs(ny - targetY));
          open.push({ x: nx, y: ny, key: nKey, f: nextG + h * 1.15 });
        }
      }
    }

    if (closestNode.key !== startKey) {
      return this.#reconstructPath(parent, startKey, closestNode.key);
    }
    return [];
  }

  #reconstructPath(parent, startKey, endKey) {
    const out = [];
    let k = endKey;
    while (k && k !== startKey) {
      const p = parent.get(k);
      if (!p) break;
      out.push({ x: p.x, y: p.y });
      k = p.prev;
    }
    out.reverse();
    return out;
  }

  /**
   * 確保相機視野周邊的區塊已載入並烘焙地磚畫布與景物清單。
   */
  ensureVisibleChunks(mapId, camCenterTx, camCenterTy) {
    const cx0 = Math.floor(camCenterTx / CHUNK_TILES);
    const cy0 = Math.floor(camCenterTy / CHUNK_TILES);
    const needed = [];
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        const cx = ((cx0 + dx + MAP_ORIGIN_X) >>> 0).toString(16).padStart(4, '0');
        const cy = ((cy0 + dy + MAP_ORIGIN_X) >>> 0).toString(16).padStart(4, '0');
        const hex = cx + cy;
        if (!this.hasChunk(mapId, hex)) continue;
        const key = `${mapId}/${hex}`;
        needed.push({ mapId, hex, key });
        if (!this.renderedChunks.has(key)) {
          this.#prepareChunk(mapId, hex, key);
        }
      }
    }
    return needed;
  }

  #prepareChunk(mapId, hex, key) {
    const rec = { mapId, hex, key, status: 'loading', groundCanvas: null, objects: [], worldX: 0, worldY: 0 };
    this.renderedChunks.set(key, rec);

    this.assets.loadChunk(mapId, hex).then(async (chunk) => {
      if (!chunk || this.assets.disposed) {
        rec.status = 'error';
        return;
      }
      const origin = tileToWorld(chunk.x, chunk.y);
      rec.chunkX = chunk.x;
      rec.chunkY = chunk.y;
      rec.worldX = origin.x - 24;
      rec.worldY = origin.y - 12 - CHUNK_Y_SHIFT;
      rec.baseWorldX = origin.x - 24;
      rec.baseWorldY = origin.y - 12;

      // 預載此區塊所有地磚圖集與重繪物件圖檔
      const tileIds = new Set(chunk.tiles || []);
      for (const [, val] of chunk.groundBase || []) tileIds.add(val >> 8);
      for (const [, , val] of chunk.groundDecor || []) tileIds.add(val >> 8);
      for (const o of chunk.objects || []) tileIds.add(o[3]);

      const tileImgs = new Map();
      await Promise.all(
        [...tileIds]
          .filter((tid) => this.assets.hasTile(tid))
          .map(async (tid) => {
            const img = await this.assets.loadImage(`/lineage163/tiles-lossless-v1/${tid}.webp`);
            if (img) tileImgs.set(tid, img);
          }),
      );

      if (this.assets.disposed) return;

      // 烘焙 64x64 等距地面畫布
      const gCanvas = document.createElement('canvas');
      gCanvas.width = CHUNK_CANVAS_W;
      gCanvas.height = CHUNK_CANVAS_H;
      const gCtx = gCanvas.getContext('2d');

      const drawHalf = (hx, ly, packedVal) => {
        if (!packedVal) return;
        const tid = packedVal >> 8;
        const sid = packedVal & 255;
        const img = tileImgs.get(tid);
        if (!img) return;
        const half = hx & 1;
        const lx = hx >> 1;
        const dx = (lx + ly) * 24 + half * 24;
        const dy = (ly - lx) * 12 + CHUNK_Y_SHIFT;
        const sx = (sid & 15) * 48 + half * 24;
        const sy = (sid >> 4) * 24;
        gCtx.drawImage(img, sx, sy, 24, 24, dx, dy, 24, 24);
      };

      const baseMap = new Map(chunk.groundBase || []);
      const floor = chunk.floor || [];
      for (let ly = 0; ly < 64; ly += 1) {
        for (let hx = 0; hx < 128; hx += 1) {
          const idx = ly * 128 + hx;
          const baseVal = baseMap.get(idx);
          if (baseVal) drawHalf(hx, ly, baseVal);
          drawHalf(hx, ly, floor[idx]);
        }
      }
      for (const [hx, ly, val] of chunk.groundDecor || []) {
        drawHalf(hx, ly, val);
      }
      rec.groundCanvas = gCanvas;

      // 組裝物件群組並優先載入高畫質重繪貼圖（houses > fences > scenery > village）
      const groups = new Map();
      for (const o of chunk.objects || []) {
        const gid = o[5];
        let list = groups.get(gid);
        if (!list) {
          list = [];
          groups.set(gid, list);
        }
        list.push(o);
      }

      const houseMap = this.redrawLayers.houses?.[key]?.objects || {};
      const fenceMap = this.redrawLayers.fences?.[key]?.objects || {};
      const sceneryMap = this.redrawLayers.scenery?.[key]?.objects || {};
      const villageMap = this.redrawLayers.village?.[key]?.objects || {};

      const objLoadJobs = [];
      const builtObjs = [];

      for (const [gid, pieces] of groups.entries()) {
        const sgid = String(gid);
        let minPx = 1e9;
        let minPy = 1e9;
        let maxPx = -1e9;
        let maxPy = -1e9;
        let minZ = 999;
        let maxZ = -1;
        let baseFootY = -1e9;

        for (const o of pieces) {
          const lx = Math.floor(o[0] / 2);
          const half = ((o[0] % 2) + 2) % 2;
          const px = (lx + o[1]) * 24 + half * 24;
          const py = (o[1] - lx) * 12;
          if (px < minPx) minPx = px;
          if (py < minPy) minPy = py;
          if (px + 24 > maxPx) maxPx = px + 24;
          if (py + 24 > maxPy) maxPy = py + 24;
          if (o[2] < minZ) minZ = o[2];
          if (o[2] > maxZ) maxZ = o[2];
        }

        for (const o of pieces) {
          if (o[2] <= minZ + 6) {
            const lx = Math.floor(o[0] / 2);
            const py = (o[1] - lx) * 12;
            if (py + 12 > baseFootY) baseFootY = py + 12;
          }
        }
        if (baseFootY < -1e8) baseFootY = maxPy - 6;

        let redrawPath = null;
        let occludes = false;
        if (houseMap[sgid]) {
          redrawPath = `/lineage163/village-houses-v3/${houseMap[sgid]}`;
          occludes = true;
        } else if (fenceMap[sgid]) {
          redrawPath = `/lineage163/fences-trees-v1/${fenceMap[sgid]}`;
          occludes = maxPy - minPy >= 64;
        } else if (sceneryMap[sgid]) {
          redrawPath = `/lineage163/scenery-redraw-v1/${sceneryMap[sgid]}`;
          occludes = maxPy - minPy >= 64;
        } else if (villageMap[sgid]) {
          redrawPath = `/lineage163/village-redraw-v3/${villageMap[sgid]}`;
          occludes = maxPy - minPy >= 64;
        }

        const w = Math.max(24, maxPx - minPx);
        const h = Math.max(24, maxPy - minPy);
        const worldX = rec.baseWorldX + minPx;
        const worldY = rec.baseWorldY + minPy;
        const isGroundFlat = h <= 36 && maxZ <= 8;
        const sortY = isGroundFlat ? -1e9 : rec.baseWorldY + baseFootY;

        const objEntry = {
          gid,
          x: worldX,
          y: worldY,
          w,
          h,
          sortY,
          occludes,
          isGroundFlat,
          image: null,
        };

        if (redrawPath) {
          objLoadJobs.push(
            this.assets.loadImage(redrawPath).then((img) => {
              if (img) objEntry.image = img;
              else objEntry.image = this.#bakeRawObject(pieces, tileImgs, minPx, minPy, w, h);
            }),
          );
        } else {
          objEntry.image = this.#bakeRawObject(pieces, tileImgs, minPx, minPy, w, h);
        }
        builtObjs.push(objEntry);
      }

      await Promise.all(objLoadJobs);
      if (this.assets.disposed) return;
      rec.objects = builtObjs;
      rec.status = 'ready';
    });
  }

  #bakeRawObject(pieces, tileImgs, minPx, minPy, w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');
    const sorted = [...pieces].sort((a, b) => a[2] - b[2] || a[1] - b[1]);
    for (const o of sorted) {
      const img = tileImgs.get(o[3]);
      if (!img) continue;
      const sid = o[4] & 255;
      const lx = Math.floor(o[0] / 2);
      const half = ((o[0] % 2) + 2) % 2;
      const px = (lx + o[1]) * 24 + half * 24;
      const py = (o[1] - lx) * 12;
      const sx = (sid & 15) * 48 + half * 24;
      const sy = (sid >> 4) * 24;
      ctx.drawImage(img, sx, sy, 24, 24, px - minPx, py - minPy, 24, 24);
    }
    return c;
  }
}
