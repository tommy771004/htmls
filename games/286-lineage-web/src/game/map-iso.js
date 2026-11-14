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

const OBSTACLE_LABELS = {
  building: '建築物',
  fence: '圍牆／柵欄',
  scenery: '樹石障礙物',
  wall: '牆壁／地形邊界',
  portal: '傳送點',
  safety: '安全區邊界',
  npc: 'NPC',
  void: '地圖邊界',
  unreachable: '無法到達',
};

/** 輕量二元最小堆，加速大範圍 A* 繞牆尋路 */
class MinHeap {
  constructor() {
    this.items = [];
  }
  get length() {
    return this.items.length;
  }
  push(node) {
    const a = this.items;
    a.push(node);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p].f <= a[i].f) break;
      const tmp = a[p];
      a[p] = a[i];
      a[i] = tmp;
      i = p;
    }
  }
  pop() {
    const a = this.items;
    const top = a[0];
    const last = a.pop();
    if (a.length > 0) {
      a[0] = last;
      let i = 0;
      const n = a.length;
      while (true) {
        let smallest = i;
        const l = (i << 1) + 1;
        const r = l + 1;
        if (l < n && a[l].f < a[smallest].f) smallest = l;
        if (r < n && a[r].f < a[smallest].f) smallest = r;
        if (smallest === i) break;
        const tmp = a[i];
        a[i] = a[smallest];
        a[smallest] = tmp;
        i = smallest;
      }
    }
    return top;
  }
}

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
    this.chunkObjectMeta = new Map(); // `${mapId}/${hex}` -> { baseTiles: Map<"tx,ty", category> }
    this.passCache = new Map();
    this.walkableTileCache = new Map();
    this.blockedNeighborCache = new Map();
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
    const bytes = this.getCollisionBytes(tx, ty, mapId);
    if (!bytes) return false;
    return (bytes[0] & 4) !== 0 || (bytes[1] & 4) !== 0;
  }

  /**
   * 查詢指定地磚是否為建築物／圍牆／景物之地面佔位底層（排除屋頂懸挑）。
   */
  getStructureCategoryAt(tx, ty, mapId) {
    const hex = chunkHexKey(tx, ty);
    const meta = this.chunkObjectMeta.get(`${mapId}/${hex}`);
    return meta?.baseTiles?.get(`${tx},${ty}`) || null;
  }

  /**
   * 計算指定地磚周邊 8 格受牆壁或地形碰撞阻擋的鄰格數量（快取）。
   */
  countBlockedNeighbors(tx, ty, mapId) {
    const key = `${mapId}:${tx},${ty}`;
    const cached = this.blockedNeighborCache.get(key);
    if (cached !== undefined) return cached;
    let count = 0;
    for (const [dx, dy] of HEADING_DELTAS) {
      if (!this.canStep(tx, ty, dx, dy, mapId)) count += 1;
    }
    this.blockedNeighborCache.set(key, count);
    return count;
  }

  /**
   * 檢測單一地磚是否為靜態障礙物（牆壁、建築物、圍牆、景物、傳送點、安全區或 NPC；明確排除怪物）。
   */
  inspectTileObstacle(tx, ty, mapId, options = {}) {
    const key = `${tx},${ty}`;
    if (options.portalSet?.has(key)) {
      return { blocked: true, kind: 'portal', label: OBSTACLE_LABELS.portal, tx, ty };
    }
    if (options.avoidSafety && this.hasSafetyBit(tx, ty, mapId)) {
      return { blocked: true, kind: 'safety', label: OBSTACLE_LABELS.safety, tx, ty };
    }
    if (options.staticBlockedSet?.has(key)) {
      return { blocked: true, kind: 'npc', label: OBSTACLE_LABELS.npc, tx, ty };
    }
    const bytes = this.getCollisionBytes(tx, ty, mapId);
    if (!bytes) {
      return { blocked: true, kind: 'void', label: OBSTACLE_LABELS.void, tx, ty };
    }
    if (!this.isWalkableTile(tx, ty, mapId)) {
      const cat = this.getStructureCategoryAt(tx, ty, mapId);
      const kind = cat && OBSTACLE_LABELS[cat] ? cat : 'wall';
      return { blocked: true, kind, label: OBSTACLE_LABELS[kind], tx, ty };
    }
    return null;
  }

  /**
   * 檢測由 (tx, ty) 往 (dx, dy) 移動一步時是否碰觸靜態障礙（明確排除怪物）。
   */
  inspectStepObstacle(tx, ty, dx, dy, mapId, options = {}) {
    const nx = tx + dx;
    const ny = ty + dy;
    const tileObs = this.inspectTileObstacle(nx, ny, mapId, options);
    if (tileObs) return tileObs;
    if (!this.canStep(tx, ty, dx, dy, mapId)) {
      const cat = this.getStructureCategoryAt(nx, ny, mapId) || this.getStructureCategoryAt(tx, ty, mapId);
      const kind = cat && OBSTACLE_LABELS[cat] ? cat : 'wall';
      return { blocked: true, kind, label: OBSTACLE_LABELS[kind], tx: nx, ty: ny };
    }
    return null;
  }

  /**
   * 沿直線格追蹤尋找第一個靜態阻擋（牆壁／建築／圍牆／NPC／傳送點等，不將怪物視為障礙）。
   */
  #findLineBlocker(sx, sy, gx, gy, mapId, options = {}) {
    if (sx === gx && sy === gy) return null;
    let cx = sx;
    let cy = sy;
    const dx = Math.abs(gx - sx);
    const dy = Math.abs(gy - sy);
    const ix = Math.sign(gx - sx);
    const iy = Math.sign(gy - sy);
    let err = dx - dy;
    const maxSteps = dx + dy + 6;
    for (let s = 0; s < maxSteps; s += 1) {
      if (cx === gx && cy === gy) return null;
      let nx = cx;
      let ny = cy;
      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        nx += ix;
      }
      if (e2 < dx) {
        err += dx;
        ny += iy;
      }
      const stepDx = nx - cx;
      const stepDy = ny - cy;
      if (!this.canStep(cx, cy, stepDx, stepDy, mapId)) {
        const obs = this.inspectStepObstacle(cx, cy, stepDx, stepDy, mapId, options);
        return obs || { blocked: true, kind: 'wall', label: OBSTACLE_LABELS.wall, tx: nx, ty: ny };
      }
      if (nx !== gx || ny !== gy) {
        const tileObs = this.inspectTileObstacle(nx, ny, mapId, options);
        if (tileObs) return tileObs;
      }
      cx = nx;
      cy = ny;
    }
    return null;
  }

  /**
   * 判斷兩點之間是否存在靜態視線與無牆通道（檢查碰撞牆體／建築與靜態佔位，不將怪物視為障礙）。
   */
  hasStaticLineOfSight(sx, sy, gx, gy, mapId, options = {}) {
    return !this.#findLineBlocker(sx, sy, gx, gy, mapId, options);
  }

  /**
   * 沿既定路徑前瞻檢視未來數步是否將碰觸靜態障礙（牆壁、建築、圍牆、傳送點、NPC 等；不含怪物）。
   */
  detectObstacleAhead(tx, ty, path, mapId, lookahead = 4, options = {}) {
    if (!path?.length) return null;
    let cx = tx;
    let cy = ty;
    const limit = Math.min(path.length, lookahead);
    for (let i = 0; i < limit; i += 1) {
      const step = path[i];
      const dx = step.x - cx;
      const dy = step.y - cy;
      if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
        const tileObs = this.inspectTileObstacle(step.x, step.y, mapId, options);
        if (tileObs) return { index: i, ...tileObs };
      } else if (dx || dy) {
        const obs = this.inspectStepObstacle(cx, cy, dx, dy, mapId, options);
        if (obs) return { index: i, ...obs };
      }
      cx = step.x;
      cy = step.y;
    }
    return null;
  }

  /**
   * 細粒度 A* 尋路，使用 MinHeap 並回傳完整可達性、成本與靜態障礙歸因（不將怪物當作不可通行牆壁）。
   */
  findPathDetailed(sx, sy, gx, gy, mapId, options = {}) {
    const {
      blockedSet = null,
      softBlockedSet = null,
      softPenalty = 6,
      wallMarginCost = 0,
      goalRange = 0,
      requireLos = false,
      maxNodes = 2400,
      allowPartial = true,
      portalSet = null,
      avoidSafety = false,
    } = options;

    const inspectOpts = { staticBlockedSet: blockedSet, portalSet, avoidSafety };
    if (goalRange <= 0 && sx === gx && sy === gy) {
      return { path: [], reached: true, partial: false, expanded: 0, cost: 0, reason: null, blocker: null };
    }
    if (
      goalRange > 0 &&
      tileDistance(sx, sy, gx, gy) <= goalRange &&
      (!requireLos || this.hasStaticLineOfSight(sx, sy, gx, gy, mapId, { staticBlockedSet: blockedSet }))
    ) {
      return { path: [], reached: true, partial: false, expanded: 0, cost: 0, reason: null, blocker: null };
    }

    let targetX = gx;
    let targetY = gy;
    let goalBlocker = null;

    if (goalRange <= 0 && (!this.isWalkableTile(targetX, targetY, mapId) || blockedSet?.has(`${targetX},${targetY}`))) {
      goalBlocker = this.inspectTileObstacle(targetX, targetY, mapId, inspectOpts);
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
      if (!best) {
        const blocker = goalBlocker || { kind: 'unreachable', label: OBSTACLE_LABELS.unreachable, tx: gx, ty: gy };
        return { path: [], reached: false, partial: false, expanded: 0, cost: 0, reason: blocker.kind, blocker };
      }
      targetX = best.x;
      targetY = best.y;
    }

    const encode = (x, y) => `${x},${y}`;
    const startKey = encode(sx, sy);
    const goalKey = encode(targetX, targetY);
    const gScore = new Map([[startKey, 0]]);
    const parent = new Map();
    const closed = new Set();
    const open = new MinHeap();
    const initH = Math.max(0, tileDistance(sx, sy, targetX, targetY) - goalRange);
    open.push({ x: sx, y: sy, key: startKey, f: initH });

    let closestNode = { x: sx, y: sy, key: startKey, d: tileDistance(sx, sy, targetX, targetY) };
    let expanded = 0;

    while (open.length && expanded < maxNodes) {
      const cur = open.pop();
      if (closed.has(cur.key)) continue;

      if (goalRange > 0) {
        const curDist = tileDistance(cur.x, cur.y, gx, gy);
        if (
          curDist <= goalRange &&
          cur.key !== goalKey &&
          !blockedSet?.has(cur.key) &&
          (!requireLos || this.hasStaticLineOfSight(cur.x, cur.y, gx, gy, mapId, { staticBlockedSet: blockedSet }))
        ) {
          return {
            path: this.#reconstructPath(parent, startKey, cur.key),
            reached: true,
            partial: false,
            expanded,
            cost: gScore.get(cur.key) || 0,
            reason: null,
            blocker: null,
          };
        }
      } else if (cur.key === goalKey) {
        return {
          path: this.#reconstructPath(parent, startKey, cur.key),
          reached: true,
          partial: false,
          expanded,
          cost: gScore.get(cur.key) || 0,
          reason: null,
          blocker: null,
        };
      }

      closed.add(cur.key);
      expanded += 1;

      const curD = tileDistance(cur.x, cur.y, targetX, targetY);
      if (curD < closestNode.d) closestNode = { x: cur.x, y: cur.y, key: cur.key, d: curD };

      const curG = gScore.get(cur.key) || 0;
      for (const [dx, dy] of HEADING_DELTAS) {
        if (!this.canStep(cur.x, cur.y, dx, dy, mapId)) continue;
        const nx = cur.x + dx;
        const ny = cur.y + dy;
        const nKey = encode(nx, ny);
        if (closed.has(nKey)) continue;
        if (blockedSet?.has(nKey) && nKey !== goalKey) continue;
        let stepCost = dx && dy ? 1.414 : 1;
        if (softBlockedSet?.has(nKey) && nKey !== goalKey) {
          stepCost += softPenalty;
        }
        if (wallMarginCost > 0 && nKey !== goalKey) {
          stepCost += this.countBlockedNeighbors(nx, ny, mapId) * wallMarginCost;
        }
        const nextG = curG + stepCost;
        if (nextG < (gScore.get(nKey) ?? 1e9)) {
          gScore.set(nKey, nextG);
          parent.set(nKey, { prev: cur.key, x: nx, y: ny });
          const rawH = Math.max(Math.abs(nx - targetX), Math.abs(ny - targetY));
          const h = goalRange > 0 ? Math.max(0, rawH - goalRange) : rawH;
          open.push({ x: nx, y: ny, key: nKey, f: nextG + h * 1.12 });
        }
      }
    }

    const fallbackBlocker =
      goalBlocker ||
      this.inspectTileObstacle(targetX, targetY, mapId, inspectOpts) ||
      this.#findLineBlocker(closestNode.x, closestNode.y, targetX, targetY, mapId, inspectOpts) ||
      { kind: 'unreachable', label: OBSTACLE_LABELS.unreachable, tx: targetX, ty: targetY };

    if (allowPartial && closestNode.key !== startKey) {
      const partialPath = this.#reconstructPath(parent, startKey, closestNode.key);
      return {
        path: partialPath,
        reached: false,
        partial: partialPath.length > 0,
        expanded,
        cost: gScore.get(closestNode.key) || 0,
        reason: fallbackBlocker.kind,
        blocker: fallbackBlocker,
      };
    }
    return {
      path: [],
      reached: false,
      partial: false,
      expanded,
      cost: 0,
      reason: fallbackBlocker.kind,
      blocker: fallbackBlocker,
    };
  }

  /**
   * 尋路至目標格（或若目標被阻擋則自動找最近可走鄰格），使用帶啟發式的 A* 搜尋。
   */
  findPath(sx, sy, gx, gy, mapId, blockedSet = null, maxNodes = 900) {
    return this.findPathDetailed(sx, sy, gx, gy, mapId, { blockedSet, maxNodes }).path;
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
      const baseTiles = new Map();
      const catPriority = { building: 3, fence: 2, scenery: 1 };

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
        let category = 'scenery';
        if (houseMap[sgid]) {
          redrawPath = `/lineage163/village-houses-v3/${houseMap[sgid]}`;
          occludes = true;
          category = 'building';
        } else if (fenceMap[sgid]) {
          redrawPath = `/lineage163/fences-trees-v1/${fenceMap[sgid]}`;
          occludes = maxPy - minPy >= 64;
          category = 'fence';
        } else if (sceneryMap[sgid]) {
          redrawPath = `/lineage163/scenery-redraw-v1/${sceneryMap[sgid]}`;
          occludes = maxPy - minPy >= 64;
          category = 'scenery';
        } else if (villageMap[sgid]) {
          redrawPath = `/lineage163/village-redraw-v3/${villageMap[sgid]}`;
          occludes = maxPy - minPy >= 64;
          category = 'building';
        }

        const w = Math.max(24, maxPx - minPx);
        const h = Math.max(24, maxPy - minPy);
        const worldX = rec.baseWorldX + minPx;
        const worldY = rec.baseWorldY + minPy;
        const isGroundFlat = h <= 36 && maxZ <= 8;
        const sortY = isGroundFlat ? -1e9 : rec.baseWorldY + baseFootY;

        if (!isGroundFlat) {
          for (const o of pieces) {
            if (o[2] <= minZ + 6) {
              const lx = Math.floor(o[0] / 2);
              const tKey = `${chunk.x + lx},${chunk.y + o[1]}`;
              const prevCat = baseTiles.get(tKey);
              if (!prevCat || (catPriority[category] || 0) > (catPriority[prevCat] || 0)) {
                baseTiles.set(tKey, category);
              }
            }
          }
        }

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

      this.chunkObjectMeta.set(key, { baseTiles });
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
