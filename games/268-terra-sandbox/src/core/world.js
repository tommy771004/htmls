// 地形、地面高度與「向量圖磚」生成。
// 每個地點是一個無限延伸的程序化世界；圖磚（chunk）輸出的圖層對齊 OpenMapTiles：
// transportation（道路）、building（建物輪廓＋樓層）、water（水域）、park（綠地）、landuse（停車場等）、poi（店家），
// 另外附上街道家具（路燈、樹、紅綠燈、停放車輛、船屋…）。畫面層與小地圖、交通、碰撞都讀同一份資料。
import { KINDS, placeSeed } from './places.js';
import { clamp, fbm, hash2, lerp, mulberry32, pick, smooth } from './math.js';

export const FLOOR_H = { metro: 3.8, canal: 3.1, hills: 3.2, town: 3.0, beach: 3.4, ski: 3.3, ocean: 3 };
export const GROUND_H = { metro: 5.2, canal: 3.6, hills: 3.6, town: 3.0, beach: 4.0, ski: 3.6, ocean: 3 };
export const CURB = 0.16;

export const SHOPS = [
  { id: 'flower', name: '花店', sign: '#c2410c' },
  { id: 'cafe', name: '咖啡館', sign: '#7c4a2d' },
  { id: 'bakery', name: '麵包店', sign: '#b45309' },
  { id: 'books', name: '書店', sign: '#1e3a5f' },
  { id: 'grocery', name: '雜貨店', sign: '#166534' },
  { id: 'pizza', name: '披薩店', sign: '#b91c1c' },
  { id: 'laundry', name: '自助洗衣', sign: '#0e7490' },
  { id: 'pharmacy', name: '藥局', sign: '#15803d' },
  { id: 'bike', name: '單車行', sign: '#1d4ed8' },
  { id: 'records', name: '唱片行', sign: '#6b21a8' },
  { id: 'ramen', name: '拉麵店', sign: '#991b1b' },
  { id: 'gallery', name: '畫廊', sign: '#334155' },
  { id: 'surf', name: '衝浪店', sign: '#0891b2' },
  { id: 'deli', name: '熟食店', sign: '#a16207' },
];

const PAL = {
  glass: [0x6f93b8, 0x5d8792, 0x8c8070, 0x56657e, 0x7aa0c4, 0x4c6b86],
  stone: [0xd9ccb4, 0xcbb99e, 0xc2b9ab, 0xe5dccd, 0xb7a58a, 0xd3c4ae],
  brick: [0x9e523d, 0x8a4a3a, 0x7b4b3e, 0xa86448, 0x6e3b30],
  canal: [0x7b3a2e, 0x8e4434, 0x5a2e28, 0x3d2f2c, 0x9b5a3c, 0x6f2f27, 0xe6dfd0, 0x2f3d39],
  stucco: [0xeae3d2, 0xf0d9b5, 0xcfe0d8, 0xe8c7c0, 0xd6dbe8, 0xf1e6c8, 0xd9d2bf, 0xc7d6c0],
  siding: [0xf1efe8, 0xbcd0e0, 0xeedc9a, 0xb9c8b0, 0xa9adb3, 0xe3c9a8],
  beach: [0xf2a48c, 0x77c6c2, 0xf4d58d, 0xf5f1e6, 0x9fd8b8, 0xe9b6d0, 0xf0c27b],
};
export const CAR_MODELS = ['sedan', 'taxi', 'suv', 'pickup', 'van', 'hatch', 'jeep'];
const CAR_COLORS = [0xe9ecef, 0x22262b, 0x8b97a3, 0x9b1c1c, 0x1f3a63, 0x6b7f5a, 0xc9b98f, 0x7fb0c8, 0xd5d7d9, 0x4a4e55, 0x9ac0cf, 0xb64a2f];

// 雪場：吊椅纜車與雪道
export const LIFT = { name: '山峰快線', x: 150, zBase: 250, zTop: -760, spacing: 24, speed: 4.4, towerEvery: 112, gauge: 2.4 };
export const RUNS = [
  { name: '藍線 · 雲杉林道', color: '#2563eb', cx: (z) => 62 + 42 * Math.sin(z / 210), half: 24 },
  { name: '紅線 · 峰頂陡坡', color: '#dc2626', cx: (z) => 248 + 46 * Math.sin(z / 260 + 1.3), half: 22 },
];

// 滑板公園（海濱類型，街廓 (0,0)）：碗池、四分之一管、箱台、矮牆與扶手
export const SKATE = {
  cell: [0, 0],
  bowls: [
    { kind: 'rect', cx: 36, cz: 40, hx: 13, hz: 10, r: 7, depth: 3.2, R: 3.4 },
    { kind: 'circle', cx: 77, cz: 28, r: 10.5, depth: 2.6, R: 3 },
  ],
  quarter: { x0: 86, x1: 92, z0: 46, z1: 70, h: 2.2, deck: 96 },
  funbox: { cx: 62, cz: 61, hx: 4, hz: 2.6, slope: 2, h: 0.9 },
  ledge: { x0: 39, x1: 51, z0: 63.6, z1: 64.4, h: 0.5 },
  rails: [{ x0: 40, z0: 69, x1: 53, z1: 69, h: 0.72 }],
};

function sdRoundRect(px, pz, cx, cz, hx, hz, r) {
  const qx = Math.abs(px - cx) - (hx - r);
  const qz = Math.abs(pz - cz) - (hz - r);
  const ox = Math.max(qx, 0);
  const oz = Math.max(qz, 0);
  return Math.hypot(ox, oz) + Math.min(Math.max(qx, qz), 0) - r;
}
export function bowlSD(b, x, z) {
  return b.kind === 'circle' ? Math.hypot(x - b.cx, z - b.cz) - b.r : sdRoundRect(x, z, b.cx, b.cz, b.hx, b.hz, b.r);
}
function bowlProfile(sd, D, R) {
  if (sd >= 0) return 0;
  if (sd <= -R) return -D;
  return -D * Math.cos(((sd + R) / R) * Math.PI * 0.5);
}

export class World {
  constructor(place) {
    this.place = place;
    this.kind = place.kind;
    this.K = KINDS[place.kind];
    this.seed = placeSeed(place);
    this.floorH = FLOOR_H[this.kind];
    this.groundH = GROUND_H[this.kind];
    this.waterY = { canal: -1.8, hills: 0, beach: 0, ocean: 0 }[this.kind] ?? -999;
    this.chunkW = this.K.grid ? this.K.PX : this.K.CH;
    this.chunkD = this.K.grid ? this.K.PZ : this.K.CH;
  }

  // ── 地形 ──
  terrain(x, z) {
    const s = this.seed;
    switch (this.kind) {
      case 'hills': {
        let h = Math.max(1.5, 10 + 64 * (fbm(x / 520 + 3.1, z / 520 - 1.7, 3, s) - 0.5));
        return lerp(h, -9, smooth(-420, -640, z));
      }
      case 'town':
        return 7 * fbm(x / 640, z / 640, 3, s);
      case 'beach':
        return x > -122 ? 0.6 : lerp(0.6, -4, smooth(-122, -330, x));
      case 'ski': {
        const t = (300 - z) / 1300;
        let h = t > 0 ? 660 * Math.pow(Math.min(t, 1.25), 1.12) : t * 70;
        h += (x / 700) * (x / 700) * 170;
        h += 80 * (fbm(x / 380, z / 380, 4, s) - 0.5) * smooth(-0.05, 0.3, t);
        return h;
      }
      case 'ocean':
        return -60;
      default:
        return 0;
    }
  }

  streetW(j) {
    return this.kind === 'canal' && (j & 1) === 0 ? this.K.canalW + 2 * this.K.quay : this.K.stW;
  }
  isCanalLine(j) {
    return this.kind === 'canal' && (j & 1) === 0;
  }
  // 南北大道（x = i·PX）是否存在
  avenueExists(i) {
    return !(this.kind === 'beach' && i < -1);
  }
  avenueClass(i) {
    return this.kind === 'beach' && i === -1 ? 'path' : 'primary';
  }
  streetExists(i, j) {
    if (this.kind === 'beach' && i < -1) return false;
    if (this.kind === 'hills') {
      const K = this.K;
      return this.terrain(i * K.PX, j * K.PZ) > 0.6 && this.terrain((i + 1) * K.PX, j * K.PZ) > 0.6;
    }
    return true;
  }
  blockRect(i, j) {
    const K = this.K;
    return {
      x0: i * K.PX + K.avW / 2,
      x1: (i + 1) * K.PX - K.avW / 2,
      z0: j * K.PZ + this.streetW(j) / 2,
      z1: (j + 1) * K.PZ - this.streetW(j + 1) / 2,
    };
  }
  cellUse(i, j) {
    const k = this.kind;
    const r = hash2(i, j, this.seed + 17);
    if (k === 'beach') {
      if (i < -1) return 'beach';
      if (i === SKATE.cell[0] && j === SKATE.cell[1]) return 'skate';
      if ((i === -1 && j >= -1 && j <= 1) || (i === 1 && j === 0)) return 'parking';
      if (this.terrain(i * this.K.PX + 50, j * this.K.PZ + 40) < 0.4) return 'beach';
      return r < 0.08 ? 'park' : 'block';
    }
    if (k === 'hills') {
      const K = this.K;
      if (this.terrain(i * K.PX + K.PX / 2, j * K.PZ + K.PZ / 2) < 0.8) return 'water';
    }
    const spawnCell = (i === 0 || i === -1) && (j === 0 || j === -1);
    if (spawnCell) return 'block';
    if (k === 'metro' && r < 0.07) return 'park';
    if (k === 'hills' && r < 0.1) return 'park';
    if (k === 'canal' && r < 0.05) return 'park';
    if (k === 'town' && r < 0.06) return 'park';
    return 'block';
  }

  // 地表高度（不含建物），含人行道路緣、拱橋、滑板碗池與坡台
  groundAt(x, z) {
    const base = this.terrain(x, z);
    if (!this.K.grid) return base;
    const K = this.K;
    const i = Math.floor(x / K.PX);
    const j = Math.floor(z / K.PZ);
    const lx = x - i * K.PX;
    const lz = z - j * K.PZ;
    const ia = lx < K.PX / 2 ? i : i + 1;
    const jz = lz < K.PZ / 2 ? j : j + 1;
    const dxA = Math.min(lx, K.PX - lx);
    const dzS = Math.min(lz, K.PZ - lz);
    const onAve = dxA < K.avW / 2 && this.avenueExists(ia);
    const onSt = dzS < this.streetW(jz) / 2 && this.streetExists(lx < K.PX / 2 ? i : i, jz);
    if (this.kind === 'canal' && this.isCanalLine(jz) && dzS < K.canalW / 2) {
      if (dxA < K.avW / 2) return base + 1.1 * Math.cos((dzS / (K.canalW / 2 + 1.5)) * Math.PI * 0.5);
      return base - 4;
    }
    if (onAve || onSt) return base;
    const use = this.cellUse(i, j);
    if (use === 'beach' || use === 'water') return base;
    if (use === 'skate') return base + CURB + this.skateOffset(x, z);
    if (use === 'parking') return base + 0.02;
    return base + CURB;
  }

  skateOffset(x, z) {
    let h = 0;
    for (const b of SKATE.bowls) h = Math.min(h, bowlProfile(bowlSD(b, x, z), b.depth, b.R));
    if (h < 0) return h;
    const q = SKATE.quarter;
    if (z > q.z0 && z < q.z1 && x > q.x0 && x < q.deck) {
      const t = clamp((x - q.x0) / (q.x1 - q.x0), 0, 1);
      return q.h * (1 - Math.cos(t * Math.PI * 0.5));
    }
    const f = SKATE.funbox;
    if (Math.abs(z - f.cz) < f.hz) {
      const dx = Math.abs(x - f.cx);
      if (dx < f.hx) return f.h;
      if (dx < f.hx + f.slope) return f.h * (1 - (dx - f.hx) / f.slope);
    }
    const l = SKATE.ledge;
    if (x > l.x0 && x < l.x1 && z > l.z0 && z < l.z1) return l.h;
    return 0;
  }

  waterAt(x, z) {
    if (this.waterY < -900) return null;
    if (this.kind === 'canal') {
      const K = this.K;
      const j = Math.round(z / K.PZ);
      if (!this.isCanalLine(j) || Math.abs(z - j * K.PZ) > K.canalW / 2) return null;
      const dxA = Math.abs(x - Math.round(x / K.PX) * K.PX);
      return dxA < K.avW / 2 ? null : this.waterY;
    }
    return this.terrain(x, z) < this.waterY ? this.waterY : null;
  }

  surfaceAt(x, z) {
    if (this.waterAt(x, z) !== null && this.groundAt(x, z) < this.waterY) return 'water';
    if (this.kind === 'ski') return 'snow';
    if (this.kind === 'ocean') return 'water';
    const K = this.K;
    const i = Math.floor(x / K.PX);
    const j = Math.floor(z / K.PZ);
    const b = this.blockRect(i, j);
    const inBlock = x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1;
    if (!inBlock) return this.kind === 'beach' && x < -116 ? 'sand' : 'road';
    const use = this.cellUse(i, j);
    if (use === 'beach') return 'sand';
    if (use === 'skate') return 'concrete';
    if (use === 'parking') return 'road';
    if (use === 'park') return 'grass';
    return 'walk';
  }

  // ── 向量圖磚 ──
  chunkOf(x, z) {
    return [Math.floor(x / this.chunkW), Math.floor(z / this.chunkD)];
  }

  generateChunk(i, j) {
    const c = {
      key: `${i},${j}`,
      i,
      j,
      x0: i * this.chunkW,
      z0: j * this.chunkD,
      x1: (i + 1) * this.chunkW,
      z1: (j + 1) * this.chunkD,
      use: 'none',
      layers: { transportation: [], building: [], water: [], park: [], landuse: [], poi: [] },
      props: {
        lamps: [], trees: [], palms: [], pines: [], tlights: [], hydrants: [], benches: [], parked: [],
        boats: [], bikes: [], rocks: [], railings: [], hedges: [], lifeguard: [], towers: [], ship: [],
      },
    };
    if (this.K.grid) this.genGrid(c);
    else if (this.kind === 'ski') this.genSki(c);
    else this.genOcean(c);
    return c;
  }

  genGrid(c) {
    const { i, j } = c;
    const K = this.K;
    const L = c.layers;
    const P = c.props;
    const rnd = mulberry32((this.seed * 7919 + i * 92821 + j * 68917) >>> 0);
    const ax = i * K.PX;
    const sz = j * K.PZ;
    const swj = this.streetW(j);

    // 道路：本格負責西側大道段、北側街道段與西北角路口
    if (this.avenueExists(i)) {
      L.transportation.push({
        x0: ax, z0: sz + swj / 2, x1: ax, z1: (j + 1) * K.PZ - this.streetW(j + 1) / 2,
        w: K.avW, cls: this.avenueClass(i), axis: 'z', line: i,
      });
    }
    if (this.streetExists(i, j)) {
      L.transportation.push({
        x0: ax + K.avW / 2, z0: sz, x1: (i + 1) * K.PX - K.avW / 2, z1: sz,
        w: swj, cls: this.isCanalLine(j) ? 'quay' : 'secondary', axis: 'x', line: j,
      });
      if (this.avenueExists(i)) {
        L.transportation.push({
          x0: ax - K.avW / 2, z0: sz, x1: ax + K.avW / 2, z1: sz, w: swj,
          cls: this.isCanalLine(j) ? 'bridge' : 'junction', axis: 'x', line: j, junction: true,
        });
      }
    }
    if (this.isCanalLine(j)) {
      L.water.push({ x0: ax - K.PX / 2, x1: ax + K.PX / 2, z0: sz - K.canalW / 2, z1: sz + K.canalW / 2, y: this.waterY, canal: true });
      this.canalProps(c, rnd);
    }

    const b = this.blockRect(i, j);
    c.use = this.cellUse(i, j);
    c.block = b;
    const lampEvery = this.kind === 'metro' ? 28 : 24;
    const sidewalkProps = c.use !== 'beach' && c.use !== 'water';

    if (sidewalkProps) {
      this.edgeProps(c, b, rnd, lampEvery);
      if (this.kind !== 'canal' && this.kind !== 'town' && this.avenueExists(i) && this.streetExists(i, j)) {
        // 路口紅綠燈（對角兩支）
        P.tlights.push({ x: ax + K.avW / 2 + 0.8, z: sz + swj / 2 + 0.8, rot: 0 });
        P.tlights.push({ x: ax - K.avW / 2 - 0.8, z: sz - swj / 2 - 0.8, rot: Math.PI });
      }
    }

    switch (c.use) {
      case 'block': {
        // 建地：路緣往內退一條人行道
        const w = K.walk;
        const lot = { x0: b.x0 + w, x1: b.x1 - w, z0: b.z0 + w, z1: b.z1 - w };
        if (this.kind === 'metro') this.lotsMetro(c, lot, rnd);
        else if (this.kind === 'canal') this.lotsCanal(c, lot, rnd);
        else if (this.kind === 'hills') this.lotsHills(c, lot, rnd);
        else if (this.kind === 'town') this.lotsTown(c, lot, rnd);
        else this.lotsBeach(c, lot, rnd);
        break;
      }
      case 'park':
        this.parkBlock(c, b, rnd);
        break;
      case 'parking':
        this.parkingBlock(c, b, rnd);
        break;
      case 'skate':
        L.landuse.push({ ...b, cls: 'skatepark' });
        L.poi.push({ x: (b.x0 + b.x1) / 2, z: (b.z0 + b.z1) / 2, name: '海濱滑板公園', type: 'skate' });
        for (let k = 0; k < 9; k++) P.palms.push({ x: b.x0 + 2 + rnd() * 3, z: b.z0 + 4 + k * 7.5, h: 9 + rnd() * 5 });
        for (let k = 0; k < 4; k++) P.benches.push({ x: b.x0 + 18 + k * 14, z: b.z1 - 2, rot: 0 });
        break;
      case 'beach':
        this.beachCell(c, rnd);
        break;
      default:
        break;
    }
  }

  // 人行道邊：路燈、行道樹、消防栓、停放車輛
  edgeProps(c, b, rnd, every) {
    const P = c.props;
    const K = this.K;
    const inset = 0.7;
    const edges = [
      { x0: b.x0, z0: b.z0, x1: b.x1, z1: b.z0, nx: 0, nz: -1, street: true, line: c.j },
      { x0: b.x0, z0: b.z1, x1: b.x1, z1: b.z1, nx: 0, nz: 1, street: true, line: c.j + 1 },
      { x0: b.x0, z0: b.z0, x1: b.x0, z1: b.z1, nx: -1, nz: 0, street: false, line: c.i },
      { x0: b.x1, z0: b.z0, x1: b.x1, z1: b.z1, nx: 1, nz: 0, street: false, line: c.i + 1 },
    ];
    for (const e of edges) {
      const len = Math.hypot(e.x1 - e.x0, e.z1 - e.z0);
      const dx = (e.x1 - e.x0) / len;
      const dz = (e.z1 - e.z0) / len;
      const canalEdge = e.street && this.isCanalLine(e.line);
      // 只在自己這一側放路燈（避免和隔壁街廓重複）：北緣與西緣
      const own = (e.street && e.nz < 0) || (!e.street && e.nx < 0);
      if (own) {
        for (let s = 6; s < len - 3; s += every) {
          P.lamps.push({ x: e.x0 + dx * s + e.nx * -inset, z: e.z0 + dz * s + e.nz * -inset, rot: Math.atan2(e.nx, e.nz), kind: this.kind === 'canal' ? 'lantern' : 'cobra' });
        }
      }
      const treeChance = { metro: 0.5, canal: 0.0, hills: 0.25, town: 0.9, beach: 0 }[this.kind] ?? 0;
      if (rnd() < treeChance) {
        for (let s = 9; s < len - 6; s += 11 + rnd() * 5) {
          if (rnd() < 0.7) P.trees.push({ x: e.x0 + dx * s - e.nx * 1.1, z: e.z0 + dz * s - e.nz * 1.1, h: 6 + rnd() * 3, kind: 'street' });
        }
      }
      if (this.kind === 'beach' && !e.street) {
        for (let s = 7; s < len - 3; s += 13) P.palms.push({ x: e.x0 + dx * s - e.nx * 1.2, z: e.z0 + dz * s - e.nz * 1.2, h: 10 + rnd() * 6 });
      }
      if (rnd() < 0.55) P.hydrants.push({ x: e.x0 + dx * (5 + rnd() * (len - 10)) - e.nx * 0.6, z: e.z0 + dz * (5 + rnd() * (len - 10)) - e.nz * 0.6 });
      // 停放車輛：只停在街道（東西向）旁；運河邊另外處理
      if (e.street && !canalEdge && this.kind !== 'metro') {
        for (let s = 5 + rnd() * 4; s < len - 5; s += 6.4 + rnd() * 3) {
          if (rnd() < 0.62) {
            const off = 1.25;
            P.parked.push({
              x: e.x0 + dx * s + e.nx * off,
              z: e.z0 + dz * s + e.nz * off,
              rot: e.nz < 0 ? Math.PI / 2 : -Math.PI / 2,
              model: pick(rnd, ['sedan', 'suv', 'hatch', 'pickup', 'van', 'sedan', 'jeep']),
              color: pick(rnd, CAR_COLORS),
            });
          }
        }
      }
      if (e.street && this.kind === 'metro' && rnd() < 0.5) {
        for (let s = 8 + rnd() * 6; s < len - 8; s += 7 + rnd() * 6) {
          if (rnd() < 0.5) {
            P.parked.push({ x: e.x0 + dx * s + e.nx * 1.25, z: e.z0 + dz * s + e.nz * 1.25, rot: e.nz < 0 ? Math.PI / 2 : -Math.PI / 2, model: pick(rnd, ['sedan', 'suv', 'van']), color: pick(rnd, CAR_COLORS) });
          }
        }
      }
    }
  }

  canalProps(c, rnd) {
    const K = this.K;
    const P = c.props;
    const sz = c.j * K.PZ;
    const xa = c.i * K.PX + K.avW / 2 + 3;
    const xb = (c.i + 1) * K.PX - K.avW / 2 - 3;
    for (const side of [-1, 1]) {
      const edgeZ = sz + side * (K.canalW / 2);
      P.railings.push({ x0: xa - 3, z0: edgeZ, x1: xb + 3, z1: edgeZ });
      // 船屋沿岸停泊
      let x = xa + rnd() * 4;
      while (x < xb - 12) {
        const len = 14 + rnd() * 10;
        if (x + len > xb) break;
        if (rnd() < 0.78) {
          P.boats.push({
            x: x + len / 2,
            z: edgeZ - side * 2.6,
            len,
            w: 4.2 + rnd() * 0.6,
            rot: 0,
            kind: rnd() < 0.75 ? 'houseboat' : 'sloop',
            color: pick(rnd, [0x41604d, 0x1f3044, 0x23282c, 0x7a2a22, 0x2f4f6f, 0x5b6b3d, 0x8a7f6a]),
            roof: pick(rnd, [0x2a2f33, 0x6b4e3b, 0x8c8c86]),
          });
        }
        x += len + 2 + rnd() * 6;
      }
      // 岸邊行道樹與單車
      for (let tx = xa; tx < xb; tx += 8.5 + rnd() * 3) {
        P.trees.push({ x: tx, z: edgeZ + side * 2.2, h: 9 + rnd() * 4, kind: 'elm' });
        if (rnd() < 0.35) P.bikes.push({ x: tx + 2.5, z: edgeZ + side * 0.9, rot: Math.PI / 2 + (rnd() - 0.5) * 0.3, color: pick(rnd, [0x1f2933, 0x7a1f1f, 0x2b4a6f, 0xd1cfc9, 0x2f5233]) });
        if (rnd() < 0.3) {
          P.parked.push({ x: tx + 4.2, z: edgeZ + side * 4.1, rot: side < 0 ? -Math.PI / 2 : Math.PI / 2, model: pick(rnd, ['hatch', 'sedan', 'van', 'hatch']), color: pick(rnd, CAR_COLORS) });
        }
      }
      for (let lx = xa + 4; lx < xb; lx += 22) P.lamps.push({ x: lx, z: edgeZ + side * 1.0, rot: 0, kind: 'lantern' });
    }
  }

  addBuilding(c, b) {
    b.id = `${this.place.id}:${c.key}:${c.layers.building.length}`;
    b.seed = (this.seed * 31 + c.i * 7477 + c.j * 9431 + c.layers.building.length * 131) >>> 0;
    b.floorH = b.floorH ?? this.floorH;
    b.groundH = b.groundH ?? this.groundH;
    let lo = Infinity;
    let hi = -Infinity;
    for (const [x, z] of [[b.x0, b.z0], [b.x1, b.z0], [b.x0, b.z1], [b.x1, b.z1]]) {
      const h = this.groundAt(x, z);
      lo = Math.min(lo, h);
      hi = Math.max(hi, h);
    }
    b.base = lo - 0.6;
    b.floor0 = hi;
    b.height = b.floor0 - b.base + b.groundH + (b.floors - 1) * b.floorH;
    if (!b.parts) b.parts = [{ x0: b.x0, z0: b.z0, x1: b.x1, z1: b.z1, top: b.height }];
    // 店家門口
    const mid = (a, c2) => (a + c2) / 2;
    const f = b.front;
    b.door = {
      x: f === 'w' ? b.x0 : f === 'e' ? b.x1 : mid(b.x0, b.x1),
      z: f === 'n' ? b.z0 : f === 's' ? b.z1 : mid(b.z0, b.z1),
      side: f,
    };
    if (b.shop) c.layers.poi.push({ x: b.door.x, z: b.door.z, name: b.shop.name, type: b.shop.id, building: b.id });
    c.layers.building.push(b);
    return b;
  }

  lotsMetro(c, b, rnd) {
    const mid = (b.z0 + b.z1) / 2;
    const tw = fbm(c.i * 0.22 + 4, c.j * 0.31 - 2, 3, this.seed);
    for (const row of ['n', 's']) {
      let x = b.x0;
      let first = true;
      while (x < b.x1 - 6) {
        let w = 14 + rnd() * 22;
        if (b.x1 - (x + w) < 16) w = b.x1 - x;
        const z0 = row === 'n' ? b.z0 : mid;
        const z1 = row === 'n' ? mid : b.z1;
        let floors = Math.round(lerp(5, 56, smooth(0.32, 0.72, tw)) * (0.5 + rnd() * 0.8));
        floors = clamp(floors, 4, 68);
        const style = floors > 24 ? (rnd() < 0.62 ? 'glass' : 'stone') : floors > 9 ? (rnd() < 0.55 ? 'stone' : 'brick') : rnd() < 0.6 ? 'brick' : 'stone';
        const last = x + w >= b.x1 - 0.01;
        const bd = {
          x0: x, x1: x + w, z0, z1, floors, style, front: row,
          color: pick(rnd, PAL[style]),
          roof: 'flat',
          shop: rnd() < 0.85 ? pick(rnd, SHOPS) : null,
          corner: first ? 'w' : last ? 'e' : null,
          stoop: style === 'brick' && floors < 8 && rnd() < 0.5,
          roofProps: [],
        };
        const B = this.addBuilding(c, bd);
        // 退縮：裙樓＋塔樓
        if (floors > 18 && rnd() < 0.8 && w > 18) {
          const pod = B.floor0 - B.base + B.groundH + (4 + Math.floor(rnd() * 8)) * B.floorH;
          const ins = 2.5 + rnd() * 3;
          const t1 = { x0: B.x0 + ins, z0: B.z0 + ins, x1: B.x1 - ins, z1: B.z1 - ins, top: B.height };
          B.parts = [{ x0: B.x0, z0: B.z0, x1: B.x1, z1: B.z1, top: pod }, t1];
          if (floors > 36 && rnd() < 0.6 && t1.x1 - t1.x0 > 14) {
            const top2 = pod + (B.height - pod) * (0.62 + rnd() * 0.2);
            const ins2 = 2.5 + rnd() * 2;
            t1.top = top2;
            B.parts.push({ x0: t1.x0 + ins2, z0: t1.z0 + ins2, x1: t1.x1 - ins2, z1: t1.z1 - ins2, top: B.height });
          }
        }
        const topPart = B.parts[B.parts.length - 1];
        if ((style === 'brick' || style === 'stone') && floors < 24 && rnd() < 0.45) {
          B.roofProps.push({ type: 'watertower', x: lerp(topPart.x0, topPart.x1, 0.3 + rnd() * 0.4), z: lerp(topPart.z0, topPart.z1, 0.3 + rnd() * 0.4) });
        }
        if (rnd() < 0.7) B.roofProps.push({ type: 'hvac', x: lerp(topPart.x0, topPart.x1, 0.25 + rnd() * 0.5), z: lerp(topPart.z0, topPart.z1, 0.25 + rnd() * 0.5) });
        if (floors > 40 && rnd() < 0.5) B.roofProps.push({ type: 'antenna', x: (topPart.x0 + topPart.x1) / 2, z: (topPart.z0 + topPart.z1) / 2 });
        x += w;
        first = false;
      }
    }
  }

  lotsCanal(c, b, rnd) {
    const depthN = 11 + rnd() * 3;
    const depthS = 11 + rnd() * 3;
    for (const row of ['n', 's']) {
      let x = b.x0;
      while (x < b.x1 - 4) {
        let w = 5.4 + rnd() * 3.4;
        if (b.x1 - (x + w) < 5) w = b.x1 - x;
        const z0 = row === 'n' ? b.z0 : b.z1 - depthS;
        const z1 = row === 'n' ? b.z0 + depthN : b.z1;
        const floors = 3 + Math.floor(rnd() * 3);
        const painted = rnd() < 0.18;
        this.addBuilding(c, {
          x0: x, x1: x + w, z0, z1, floors, style: painted ? 'plaster' : 'canal', front: row,
          color: painted ? pick(rnd, [0xe8e2d4, 0xd8d3c5, 0x3b4a45, 0xefe9da]) : pick(rnd, PAL.canal),
          roof: pick(rnd, ['gable', 'step', 'neck', 'gable', 'bell']),
          shop: rnd() < 0.3 ? pick(rnd, SHOPS) : null,
          stoop: rnd() < 0.35,
          trim: 0xf4f1ea,
          roofProps: [],
        });
        x += w;
      }
    }
    // 中庭花園
    const g = { x0: b.x0 + 1, x1: b.x1 - 1, z0: b.z0 + depthN + 1, z1: b.z1 - depthS - 1 };
    if (g.z1 - g.z0 > 3) {
      c.layers.park.push({ ...g, cls: 'garden' });
      for (let k = 0; k < 4; k++) c.props.trees.push({ x: lerp(g.x0, g.x1, rnd()), z: lerp(g.z0, g.z1, rnd()), h: 7 + rnd() * 3, kind: 'elm' });
    }
  }

  lotsHills(c, b, rnd) {
    for (const row of ['n', 's']) {
      let x = b.x0;
      const depth = Math.min((b.z1 - b.z0) / 2, 16 + rnd() * 5);
      while (x < b.x1 - 6) {
        const apt = rnd() < 0.18;
        let w = apt ? 18 + rnd() * 6 : 7.5 + rnd() * 5;
        if (b.x1 - (x + w) < 7) w = b.x1 - x;
        const z0 = row === 'n' ? b.z0 : b.z1 - depth;
        const z1 = row === 'n' ? b.z0 + depth : b.z1;
        const floors = apt ? 4 + Math.floor(rnd() * 3) : 2 + Math.floor(rnd() * 3);
        const vic = !apt && rnd() < 0.3;
        this.addBuilding(c, {
          x0: x, x1: x + w, z0, z1, floors, style: 'stucco', front: row,
          color: pick(rnd, PAL.stucco),
          trim: pick(rnd, [0xffffff, 0xf3eee3, 0x8a3b2e, 0x2f4858]),
          roof: vic ? 'gablex' : 'flat',
          bay: floors >= 2 && rnd() < 0.7,
          garage: !apt && rnd() < 0.55,
          shop: apt && rnd() < 0.5 ? pick(rnd, SHOPS) : null,
          stoop: rnd() < 0.4,
          roofProps: [],
        });
        x += w + (rnd() < 0.1 ? 1.5 : 0);
      }
    }
  }

  lotsTown(c, b, rnd) {
    const P = c.props;
    for (const row of ['n', 's']) {
      let x = b.x0 + 2;
      while (x < b.x1 - 14) {
        const lotW = 18 + rnd() * 6;
        if (x + lotW > b.x1) break;
        const hw = 10 + rnd() * 3.5;
        const hd = 9 + rnd() * 3;
        const set = 5 + rnd() * 3;
        const cx = x + lotW / 2;
        const z0 = row === 'n' ? b.z0 + set : b.z1 - set - hd;
        this.addBuilding(c, {
          x0: cx - hw / 2, x1: cx + hw / 2, z0, z1: z0 + hd, floors: rnd() < 0.55 ? 2 : 1, style: 'siding', front: row,
          color: pick(rnd, PAL.siding), trim: 0xffffff,
          roof: rnd() < 0.5 ? 'hip' : 'gablex',
          roofColor: pick(rnd, [0x4a4f57, 0x6b4f3f, 0x3e4a5a, 0x5c5f63]),
          porch: rnd() < 0.6,
          roofProps: [],
        });
        c.layers.park.push({ x0: x, x1: x + lotW, z0: row === 'n' ? b.z0 : b.z1 - set - hd - 6, z1: row === 'n' ? b.z0 + set + hd + 6 : b.z1, cls: 'yard' });
        if (rnd() < 0.7) P.trees.push({ x: x + 2 + rnd() * 3, z: row === 'n' ? b.z0 + 2.5 : b.z1 - 2.5, h: 7 + rnd() * 4, kind: 'oak' });
        if (rnd() < 0.6) P.parked.push({ x: cx + hw / 2 + 2.6, z: row === 'n' ? b.z0 + 4 : b.z1 - 4, rot: 0, model: pick(rnd, ['suv', 'pickup', 'sedan', 'van']), color: pick(rnd, CAR_COLORS) });
        if (rnd() < 0.5) P.hedges.push({ x0: x + 0.5, x1: x + lotW - 0.5, z: row === 'n' ? b.z0 + 0.6 : b.z1 - 0.6 });
        x += lotW;
      }
    }
  }

  lotsBeach(c, b, rnd) {
    for (const row of ['n', 's']) {
      let x = b.x0;
      const depth = Math.min((b.z1 - b.z0) / 2 - 1, 15 + rnd() * 6);
      while (x < b.x1 - 8) {
        let w = 10 + rnd() * 10;
        if (b.x1 - (x + w) < 9) w = b.x1 - x;
        const z0 = row === 'n' ? b.z0 : b.z1 - depth;
        const z1 = row === 'n' ? b.z0 + depth : b.z1;
        this.addBuilding(c, {
          x0: x, x1: x + w, z0, z1, floors: 1 + Math.floor(rnd() * 3), style: 'stucco', front: row,
          color: pick(rnd, PAL.beach), trim: 0xffffff, roof: 'flat',
          shop: rnd() < 0.6 ? pick(rnd, SHOPS) : null,
          roofProps: rnd() < 0.5 ? [{ type: 'hvac', x: x + w / 2, z: (z0 + z1) / 2 }] : [],
        });
        x += w + (rnd() < 0.25 ? 3 : 0);
      }
    }
  }

  parkBlock(c, b, rnd) {
    const P = c.props;
    c.layers.park.push({ x0: b.x0, x1: b.x1, z0: b.z0, z1: b.z1, cls: 'park' });
    c.layers.poi.push({ x: (b.x0 + b.x1) / 2, z: (b.z0 + b.z1) / 2, name: '街區公園', type: 'park' });
    const n = Math.floor(((b.x1 - b.x0) * (b.z1 - b.z0)) / 70);
    for (let k = 0; k < n; k++) {
      const x = lerp(b.x0 + 3, b.x1 - 3, rnd());
      const z = lerp(b.z0 + 3, b.z1 - 3, rnd());
      if (Math.abs(z - (b.z0 + b.z1) / 2) < 2.5 || Math.abs(x - (b.x0 + b.x1) / 2) < 2.5) continue;
      if (this.kind === 'beach') P.palms.push({ x, z, h: 9 + rnd() * 6 });
      else P.trees.push({ x, z, h: 7 + rnd() * 6, kind: rnd() < 0.5 ? 'oak' : 'elm' });
    }
    for (let k = 0; k < 6; k++) P.benches.push({ x: lerp(b.x0 + 6, b.x1 - 6, k / 5), z: (b.z0 + b.z1) / 2 + 2.2, rot: 0 });
  }

  parkingBlock(c, b, rnd) {
    const P = c.props;
    c.layers.landuse.push({ ...b, cls: 'parking' });
    for (let x = b.x0 + 4; x < b.x1 - 3; x += 2.9) {
      for (const [zz, rot] of [[b.z0 + 4, 0], [b.z0 + 13, Math.PI], [b.z0 + 24, 0], [b.z0 + 33, Math.PI], [b.z0 + 44, 0], [b.z0 + 53, Math.PI], [b.z0 + 64, 0]]) {
        if (zz > b.z1 - 3) continue;
        if (rnd() < 0.72) P.parked.push({ x, z: zz, rot: rot + (rnd() - 0.5) * 0.06, model: pick(rnd, ['sedan', 'suv', 'pickup', 'hatch', 'van', 'jeep', 'pickup']), color: pick(rnd, CAR_COLORS) });
      }
    }
    for (let k = 0; k < 3; k++) P.lamps.push({ x: lerp(b.x0, b.x1, 0.2 + k * 0.3), z: (b.z0 + b.z1) / 2, rot: 0, kind: 'cobra' });
  }

  beachCell(c, rnd) {
    const P = c.props;
    c.use = 'beach';
    c.layers.landuse.push({ x0: c.x0, x1: c.x1, z0: c.z0, z1: c.z1, cls: 'sand' });
    for (let k = 0; k < 6; k++) {
      const x = lerp(c.x0, c.x1, rnd());
      const z = lerp(c.z0, c.z1, rnd());
      if (this.terrain(x, z) > 0.2 && x > -200) P.palms.push({ x, z, h: 10 + rnd() * 7 });
    }
    if (rnd() < 0.5) {
      const x = -175 + rnd() * 20;
      const z = lerp(c.z0 + 10, c.z1 - 10, rnd());
      P.lifeguard.push({ x, z, rot: Math.PI / 2, color: pick(rnd, [0x5fb3c9, 0xf2c14e, 0xe86a5a]) });
    }
  }

  // ── 雪場 ──
  onRun(x, z) {
    for (const r of RUNS) if (Math.abs(x - r.cx(z)) < r.half) return r;
    return null;
  }

  genSki(c) {
    const P = c.props;
    const rnd = mulberry32((this.seed * 7919 + c.i * 92821 + c.j * 68917) >>> 0);
    c.use = 'slope';
    for (let x = c.x0; x < c.x1; x += 8) {
      for (let z = c.z0; z < c.z1; z += 8) {
        const px = x + rnd() * 7;
        const pz = z + rnd() * 7;
        const h = this.terrain(px, pz);
        const dens = fbm(px / 140, pz / 140, 2, this.seed + 5);
        if (this.onRun(px, pz) || Math.abs(px - LIFT.x) < 12) continue;
        if (pz > 200 && pz < 420 && px > -120 && px < 210) continue;
        const tl = 1 - smooth(380, 560, h);
        if (rnd() < (dens - 0.35) * 1.6 * tl) P.pines.push({ x: px, z: pz, h: 9 + rnd() * 9, snow: rnd() < 0.8 });
        else if (h > 330 && rnd() < 0.04) P.rocks.push({ x: px, z: pz, s: 1.2 + rnd() * 3 });
      }
    }
    // 山腳小屋與山屋
    if (c.i === 0 && c.j === 2) {
      this.addBuilding(c, {
        x0: 30, x1: 70, z0: 296, z1: 318, floors: 2, style: 'lodge', front: 'n', color: 0x8b5a3c, roof: 'gablex',
        roofColor: 0xa83b2f, shop: { id: 'lodge', name: '山腳小屋', sign: '#7f1d1d' }, roofProps: [],
      });
    }
    if (c.i === -1 && c.j === 2) {
      for (let k = 0; k < 3; k++) {
        const x0 = -110 + k * 32;
        this.addBuilding(c, { x0, x1: x0 + 14, z0: 330, z1: 342, floors: 2, style: 'lodge', front: 'n', color: 0x7a5236, roof: 'gablex', roofColor: 0x3f4a55, roofProps: [] });
      }
    }
    if (c.i === 0 && c.j === 2) {
      for (let x = -40; x < 20; x += 3)
        for (const z of [330, 340, 350]) if (rnd() < 0.7) P.parked.push({ x, z, rot: 0, model: pick(rnd, ['suv', 'pickup', 'jeep', 'van']), color: pick(rnd, CAR_COLORS) });
    }
    // 纜車塔柱
    if (LIFT.x >= c.x0 && LIFT.x < c.x1) {
      for (let z = LIFT.zBase - LIFT.towerEvery; z > LIFT.zTop + 20; z -= LIFT.towerEvery) {
        if (z >= c.z0 && z < c.z1) P.towers.push({ x: LIFT.x, z });
      }
    }
    for (const r of RUNS) {
      c.layers.transportation.push({ cls: 'piste', name: r.name, color: r.color, pts: [], x0: r.cx(c.z0), z0: c.z0, x1: r.cx(c.z1), z1: c.z1, w: r.half * 2 });
    }
  }

  genOcean(c) {
    const rnd = mulberry32((this.seed * 7919 + c.i * 92821 + c.j * 68917) >>> 0);
    c.use = 'ocean';
    c.layers.water.push({ x0: c.x0, x1: c.x1, z0: c.z0, z1: c.z1, y: 0 });
    if (c.i === 1 && c.j === -2) c.props.ship.push({ x: 220, z: -260, rot: 0.6 });
    if (rnd() < 0.15) c.props.boats.push({ x: lerp(c.x0, c.x1, rnd()), z: lerp(c.z0, c.z1, rnd()), len: 2, w: 2, rot: 0, kind: 'buoy', color: 0xd9480f });
  }
}

// 纜車：吊椅在環狀鋼索上的位置（u ∈ [0,1)：前半上行、後半下行）
export function liftPoint(world, u) {
  const L = LIFT;
  const len = L.zBase - L.zTop;
  const up = u < 0.5;
  const t = up ? u * 2 : (u - 0.5) * 2;
  const z = up ? L.zBase - t * len : L.zTop + t * len;
  const x = L.x + (up ? -L.gauge : L.gauge);
  const g = world.terrain(L.x, z);
  // 鋼索高度：塔柱間下垂
  const seg = ((L.zBase - z) % L.towerEvery) / L.towerEvery;
  const sag = 4 * seg * (1 - seg) * 2.2;
  const endBlend = Math.min(1, (L.zBase - z) / 30, (z - L.zTop) / 30);
  const y = g + 4.2 + (9.5 - sag) * Math.max(0, endBlend);
  return { x, y, z, up };
}
