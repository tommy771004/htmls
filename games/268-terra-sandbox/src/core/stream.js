// 圖磚串流：依攝影機位置決定要哪些圖磚、各自的 LOD，資料生成有每幀上限（排隊），用 LRU 快取保留最近用過的圖磚。
export const LOD_DIST = [170, 400];

export class ChunkStreamer {
  constructor(world, { viewDist = 640, cacheSize = 220, genPerUpdate = 6 } = {}) {
    this.world = world;
    this.viewDist = viewDist;
    this.cacheSize = cacheSize;
    this.genPerUpdate = genPerUpdate;
    this.cache = new Map(); // key → chunk（Map 的插入順序當作 LRU 順序）
    this.visible = [];
    this.stats = { resident: 0, drawn: 0, queued: 0, generated: 0, hits: 0, misses: 0, evicted: 0, lod: [0, 0, 0] };
  }

  key(i, j) {
    return `${i},${j}`;
  }

  // 立即取得（碰撞與交通需要時用），會計入快取
  get(i, j) {
    const k = this.key(i, j);
    let c = this.cache.get(k);
    if (c) {
      this.cache.delete(k);
      this.cache.set(k, c);
      this.stats.hits++;
      return c;
    }
    this.stats.misses++;
    c = this.world.generateChunk(i, j);
    this.stats.generated++;
    this.cache.set(k, c);
    this.evict();
    return c;
  }

  peek(i, j) {
    return this.cache.get(this.key(i, j)) || null;
  }

  evict() {
    while (this.cache.size > this.cacheSize) {
      const oldest = this.cache.keys().next().value;
      this.cache.delete(oldest);
      this.stats.evicted++;
    }
  }

  update(x, z) {
    const W = this.world;
    const cw = W.chunkW;
    const cd = W.chunkD;
    const r = this.viewDist;
    const i0 = Math.floor((x - r) / cw);
    const i1 = Math.floor((x + r) / cw);
    const j0 = Math.floor((z - r) / cd);
    const j1 = Math.floor((z + r) / cd);
    const want = [];
    for (let i = i0; i <= i1; i++) {
      for (let j = j0; j <= j1; j++) {
        const cx = Math.max(i * cw, Math.min(x, (i + 1) * cw));
        const cz = Math.max(j * cd, Math.min(z, (j + 1) * cd));
        const d = Math.hypot(cx - x, cz - z);
        if (d > r) continue;
        want.push({ i, j, d, lod: d < LOD_DIST[0] ? 0 : d < LOD_DIST[1] ? 1 : 2 });
      }
    }
    want.sort((a, b) => a.d - b.d);
    let budget = this.genPerUpdate;
    let queued = 0;
    const vis = [];
    const lod = [0, 0, 0];
    for (const w of want) {
      const k = this.key(w.i, w.j);
      let c = this.cache.get(k);
      if (c) {
        this.cache.delete(k);
        this.cache.set(k, c);
        this.stats.hits++;
      } else if (budget > 0 || w.d < cw) {
        budget--;
        this.stats.misses++;
        c = W.generateChunk(w.i, w.j);
        this.stats.generated++;
        this.cache.set(k, c);
      } else {
        queued++;
        continue;
      }
      lod[w.lod]++;
      vis.push({ chunk: c, lod: w.lod, d: w.d });
    }
    this.evict();
    this.visible = vis;
    this.stats.resident = this.cache.size;
    this.stats.drawn = vis.length;
    this.stats.queued = queued;
    this.stats.lod = lod;
    return vis;
  }

  // 半徑內的建物（碰撞、互動、室內入口）
  buildingsNear(x, z, rad) {
    const W = this.world;
    const out = [];
    const i0 = Math.floor((x - rad) / W.chunkW);
    const i1 = Math.floor((x + rad) / W.chunkW);
    const j0 = Math.floor((z - rad) / W.chunkD);
    const j1 = Math.floor((z + rad) / W.chunkD);
    for (let i = i0; i <= i1; i++) {
      for (let j = j0; j <= j1; j++) {
        const c = this.get(i, j);
        for (const b of c.layers.building) {
          if (x > b.x0 - rad && x < b.x1 + rad && z > b.z0 - rad && z < b.z1 + rad) out.push(b);
        }
      }
    }
    return out;
  }

  findBuilding(id) {
    for (const c of this.cache.values()) for (const b of c.layers.building) if (b.id === id) return b;
    return null;
  }
}

// 圓形角色對建物外框（AABB）的推出；只檢查腳下高度低於屋頂的部分
export function collideBuildings(streamer, x, z, r, y) {
  let hit = false;
  for (const b of streamer.buildingsNear(x, z, r + 1)) {
    for (const p of b.parts) {
      if (y > b.base + p.top - 0.2) continue;
      const cx = Math.max(p.x0, Math.min(x, p.x1));
      const cz = Math.max(p.z0, Math.min(z, p.z1));
      const dx = x - cx;
      const dz = z - cz;
      const d = Math.hypot(dx, dz);
      if (d < r) {
        hit = true;
        if (d > 1e-4) {
          x = cx + (dx / d) * r;
          z = cz + (dz / d) * r;
        } else {
          // 在內部：推向最近的邊
          const opts = [[p.x0 - r, z, x - p.x0], [p.x1 + r, z, p.x1 - x], [x, p.z0 - r, z - p.z0], [x, p.z1 + r, p.z1 - z]];
          opts.sort((a, b2) => a[2] - b2[2]);
          x = opts[0][0];
          z = opts[0][1];
        }
      }
    }
  }
  return { x, z, hit };
}

// 沿射線找第一棟建物的距離（相機避讓、準心距離）
export function raycastBuildings(streamer, ox, oy, oz, dx, dy, dz, maxD) {
  let best = maxD;
  const mx = ox + dx * maxD * 0.5;
  const mz = oz + dz * maxD * 0.5;
  for (const b of streamer.buildingsNear(mx, mz, maxD * 0.5 + 2)) {
    for (const p of b.parts) {
      const t = rayBox(ox, oy, oz, dx, dy, dz, p.x0, b.base, p.z0, p.x1, b.base + p.top, p.z1);
      if (t !== null && t < best) best = t;
    }
  }
  return best;
}

function rayBox(ox, oy, oz, dx, dy, dz, x0, y0, z0, x1, y1, z1) {
  let tmin = 0;
  let tmax = Infinity;
  for (const [o, d, a, b] of [[ox, dx, x0, x1], [oy, dy, y0, y1], [oz, dz, z0, z1]]) {
    if (Math.abs(d) < 1e-9) {
      if (o < a || o > b) return null;
    } else {
      let t1 = (a - o) / d;
      let t2 = (b - o) / d;
      if (t1 > t2) [t1, t2] = [t2, t1];
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return null;
    }
  }
  return tmin;
}
