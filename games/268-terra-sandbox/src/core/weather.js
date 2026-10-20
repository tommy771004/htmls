// 地球尺度程序化天氣：全球雲量場＋會移動的天氣系統（鋒面、雷暴超級胞、龍捲風、颶風）。
// 任一經緯度都能取樣在地天氣；附近的系統會回報距離與方位，讓畫面在遠處畫出來。支援縮時。
import { clamp, fbm, haversine, bearing, smooth, lerp, mulberry32 } from './math.js';

export const OVERRIDES = [
  { id: 'live', name: '即時' },
  { id: 'clear', name: '晴朗' },
  { id: 'cloudy', name: '多雲' },
  { id: 'rain', name: '下雨' },
  { id: 'thunder', name: '雷雨' },
  { id: 'snow', name: '下雪' },
  { id: 'fog', name: '濃霧' },
  { id: 'tornado', name: '龍捲風' },
  { id: 'hurricane', name: '颶風' },
];
export const TIMESCALES = [1, 10, 40, 200, 1000];

const HURRICANE_NAMES = ['艾琳', '伯尼', '卡洛斯', '黛安', '埃德溫', '芙蘿拉'];

export class Weather {
  constructor(seed = 268) {
    this.seed = seed;
    this.hour = 13.2; // 遊戲時鐘（地方時）
    this.day = 180; // 一年中的第幾天
    this.timeScale = 1;
    this.dayMinutes = 48; // 現實幾分鐘＝遊戲一天
    this.timePasses = true;
    this.override = 'live';
    this.simHours = 0;
    this.flash = 0;
    this.flashPos = null;
    this.cells = [];
    this.forced = [];
    this.rnd = mulberry32(seed);
    this.spawnCells();
  }

  spawnCells() {
    const r = this.rnd;
    const C = this.cells;
    // 颶風（大西洋 2、西太平洋 1、東太平洋 1）
    const hz = [[24.5, -58.0], [17.5, -44.0], [19.0, 134.0], [15.5, -112.0]];
    hz.forEach(([lat, lon], k) => C.push({ id: `H${k}`, kind: 'hurricane', name: HURRICANE_NAMES[k], lat, lon, vlat: 0.09 + r() * 0.05, vlon: -0.22 - r() * 0.08, radius: 320, intensity: 0.75 + r() * 0.25, age: r() * 20 }));
    // 中緯度鋒面（自西向東）
    for (let k = 0; k < 14; k++) {
      const lat = (r() < 0.5 ? 1 : -1) * (35 + r() * 22);
      C.push({ id: `F${k}`, kind: 'front', lat, lon: -180 + r() * 360, vlat: (r() - 0.5) * 0.05, vlon: 0.35 + r() * 0.3, radius: 450 + r() * 350, intensity: 0.5 + r() * 0.5, age: 0 });
    }
    // 雷暴超級胞（美國平原、阿根廷、印度、東南亞）
    const sc = [[36.5, -98.0], [38.0, -94.5], [-31.0, -63.0], [23.0, 80.0], [14.0, 103.0], [33.0, -86.0]];
    sc.forEach(([lat, lon], k) => C.push({ id: `S${k}`, kind: 'storm', lat, lon, vlat: 0.04, vlon: 0.12, radius: 60, intensity: 0.8, tornado: k < 2, age: 0 }));
  }

  // dt：現實秒
  step(dt) {
    const gameHoursPerSec = 24 / (this.dayMinutes * 60);
    const dh = this.timePasses ? dt * this.timeScale * gameHoursPerSec : 0;
    // 天氣系統一律跟著縮時移動（就算時間停止，也用 1/60 的速度讓雲有動感）
    const moveH = dh || dt * gameHoursPerSec * 0.02;
    this.hour += dh;
    while (this.hour >= 24) {
      this.hour -= 24;
      this.day = (this.day + 1) % 365;
    }
    this.simHours += moveH;
    for (const c of [...this.cells, ...this.forced]) {
      c.lat += c.vlat * moveH;
      c.lon += c.vlon * moveH;
      c.age += moveH;
      if (c.lon > 180) c.lon -= 360;
      if (c.lon < -180) c.lon += 360;
      if (c.kind === 'hurricane' && c.lat > 28) c.vlon = Math.min(0.35, c.vlon + 0.002 * moveH * 60); // 轉向東北
      if (c.kind === 'hurricane' && c.lat > 48) this.recycle(c);
    }
    this.flash = Math.max(0, this.flash - dt * 3.2);
    return dh;
  }

  recycle(c) {
    c.lat = 14 + this.rnd() * 6;
    c.lon = c.lon > 0 ? 140 + this.rnd() * 10 : -50 - this.rnd() * 10;
    c.vlon = -0.22;
    c.age = 0;
  }

  setOverride(id, lat, lon) {
    this.override = id;
    this.forced = [];
    if (id === 'tornado') {
      // 在玩家西方 2.2 公里生成超級胞，龍捲風以約 3 km/h（遊戲時間）朝玩家移動，1× 下約一分半鐘抵達
      const d = 2.2 / 111;
      this.forced.push({ id: 'T*', kind: 'storm', lat: lat + d * 0.12, lon: lon - d / Math.cos((lat * Math.PI) / 180), vlat: 0, vlon: 0.032, radius: 14, intensity: 1, tornado: true, age: 0, forced: true });
    }
    if (id === 'hurricane') {
      this.forced.push({ id: 'H*', kind: 'hurricane', name: '茱莉亞', lat: lat - 0.55, lon: lon + 0.3, vlat: 0.05, vlon: -0.03, radius: 300, intensity: 1, age: 0, forced: true });
    }
  }

  allCells() {
    return this.override === 'live' ? this.cells : [...this.cells.filter((c) => c.kind === 'hurricane'), ...this.forced];
  }

  // 太陽位置（仰角、方位角：0 = 北、順時針）
  // dh：相對地點的時差（小時；太空梭在軌道上繞到別的經度時用）
  sun(lat, dh = 0) {
    const toR = Math.PI / 180;
    const decl = 23.44 * toR * Math.sin((2 * Math.PI * (284 + this.day)) / 365);
    const H = (this.hour + dh - 12) * 15 * toR;
    const phi = lat * toR;
    const sinEl = Math.sin(phi) * Math.sin(decl) + Math.cos(phi) * Math.cos(decl) * Math.cos(H);
    const el = Math.asin(clamp(sinEl, -1, 1));
    const az = Math.atan2(-Math.cos(decl) * Math.sin(H), Math.sin(decl) * Math.cos(phi) - Math.cos(decl) * Math.sin(phi) * Math.cos(H));
    return { elevation: el, azimuth: az };
  }

  moon(lat, dh = 0) {
    const h = this.hour;
    this.hour = (h + 12) % 24;
    const m = this.sun(lat, dh);
    this.hour = h;
    return m;
  }

  // 全球雲量場（0..1）
  baseCover(lat, lon) {
    const t = this.simHours;
    const itcz = Math.exp(-((lat - 5) * (lat - 5)) / 60) * 0.25; // 赤道輻合帶
    const desert = Math.exp(-((Math.abs(lat) - 25) ** 2) / 50) * 0.22; // 副熱帶高壓
    const n = fbm(lon / 16 - t * 0.012, lat / 12, 4, this.seed);
    return clamp(n * 1.25 - 0.22 + itcz - desert, 0, 1);
  }

  // 在地天氣（含天氣系統影響）。elevation 用公尺
  sample(lat, lon, elevation = 0) {
    let cover = this.baseCover(lat, lon);
    let rain = Math.max(0, cover - 0.7) * 2.2;
    let wind = 2 + 7 * fbm(lon / 9 + 5, lat / 9 - this.simHours * 0.01, 3, this.seed + 9);
    let windDir = fbm(lon / 30, lat / 30, 2, this.seed + 3) * Math.PI * 4;
    let thunder = 0;
    let fog = 0;
    let tornado = null;
    let hurricane = null;
    const nearby = [];
    for (const c of this.allCells()) {
      const dKm = haversine(lat, lon, c.lat, c.lon) / 1000;
      const reach = c.kind === 'hurricane' ? c.radius * 3 : c.kind === 'front' ? c.radius * 1.6 : 160;
      if (dKm > reach) continue;
      const brg = bearing(lat, lon, c.lat, c.lon);
      nearby.push({ cell: c, km: dKm, bearing: brg });
      const k = smooth(c.radius, c.radius * 0.25, dKm) * c.intensity;
      if (c.kind === 'front') {
        cover = Math.max(cover, 0.55 + k * 0.45);
        rain = Math.max(rain, k * 0.75);
        wind += k * 6;
      } else if (c.kind === 'storm') {
        const ks = smooth(c.radius * 1.4, c.radius * 0.2, dKm) * c.intensity;
        cover = Math.max(cover, 0.5 + ks * 0.5);
        rain = Math.max(rain, ks);
        thunder = Math.max(thunder, ks);
        wind += ks * 14;
        if (c.tornado) {
          // 龍捲風位於胞體西南側
          tornado = { km: dKm, bearing: brg, cell: c };
          const near = smooth(3, 0.15, dKm);
          wind += near * 60;
        }
      } else if (c.kind === 'hurricane') {
        const eye = 28;
        const wall = Math.exp(-((dKm - eye * 1.6) ** 2) / (2 * 30 * 30));
        const kh = smooth(c.radius * 1.2, eye * 1.2, dKm) * c.intensity;
        cover = Math.max(cover, dKm < eye ? 0.15 : 0.45 + kh * 0.55);
        rain = Math.max(rain, dKm < eye ? 0 : kh * 0.85 + wall * 0.3);
        wind += kh * 28 + wall * 40 * c.intensity;
        thunder = Math.max(thunder, wall * 0.6);
        hurricane = { km: dKm, bearing: brg, cell: c, eye };
      }
    }
    const season = Math.cos(((this.day - 196) / 365) * Math.PI * 2) * (lat >= 0 ? 1 : -1);
    const diurnal = Math.cos(((this.hour - 15) / 24) * Math.PI * 2);
    let temp = 29 - 0.58 * Math.abs(lat) + season * (4 + Math.abs(lat) * 0.25) + diurnal * 4 - Math.min(elevation, 11000) * 0.0065 - rain * 3;

    // 強制天氣
    switch (this.override) {
      case 'clear':
        cover = 0.12; rain = 0; thunder = 0; wind = Math.min(wind, 5);
        break;
      case 'cloudy':
        cover = 0.72; rain = 0; thunder = 0;
        break;
      case 'rain':
        cover = 0.9; rain = 0.7; thunder = 0;
        break;
      case 'thunder':
        cover = 1; rain = 1; thunder = 1; wind = Math.max(wind, 14);
        break;
      case 'snow':
        cover = 0.9; rain = 0.65; temp = Math.min(temp, -4);
        break;
      case 'fog':
        cover = 0.6; rain = 0; fog = 1; wind = 1.5;
        break;
      default:
        break;
    }
    const humidFog = clamp((cover - 0.85) * 2, 0, 0.35) + (this.hour < 7.5 && this.hour > 4.5 && cover > 0.5 ? 0.25 : 0);
    fog = Math.max(fog, humidFog, rain * 0.35);
    const snow = temp < 0.8 && rain > 0.05;
    return {
      cover: clamp(cover, 0, 1),
      rain: clamp(rain, 0, 1),
      snow,
      wind: Math.min(wind, 95),
      windDir,
      thunder: clamp(thunder, 0, 1),
      fog: clamp(fog, 0, 1),
      temp,
      tornado,
      hurricane,
      nearby,
      label: weatherLabel({ cover, rain, snow, thunder, fog, wind, tornado, hurricane }),
    };
  }

  // 閃電：由畫面層每幀呼叫，回傳是否要閃
  maybeFlash(dt, thunder) {
    if (thunder > 0.3 && this.rnd() < dt * thunder * 0.35) {
      this.flash = 1;
      this.flashPos = { a: this.rnd() * Math.PI * 2, d: 300 + this.rnd() * 1500 };
      return true;
    }
    return false;
  }
}

export function weatherLabel(w) {
  if (w.tornado && w.tornado.km < 6) return '龍捲風警報';
  if (w.hurricane && w.hurricane.km < w.hurricane.cell.radius) return w.hurricane.km < w.hurricane.eye ? '颶風眼' : '颶風';
  if (w.thunder > 0.5) return '雷雨';
  if (w.snow) return w.rain > 0.6 ? (w.wind > 15 ? '暴風雪' : '大雪') : '小雪';
  if (w.rain > 0.6) return '大雨';
  if (w.rain > 0.08) return '小雨';
  if (w.fog > 0.6) return '濃霧';
  if (w.cover > 0.8) return '陰天';
  if (w.cover > 0.5) return '多雲';
  if (w.cover > 0.25) return '晴時多雲';
  return '晴朗';
}

// 共用波浪函式（畫面的水面著色器用同一組參數）
export const WAVES = [
  { dx: 0.8, dz: 0.6, k: 0.09, w: 0.9, a: 0.55 },
  { dx: -0.5, dz: 0.86, k: 0.17, w: 1.4, a: 0.28 },
  { dx: 0.2, dz: -0.98, k: 0.31, w: 2.1, a: 0.17 },
];
export function waveHeight(x, z, t, amp) {
  let h = 0;
  for (const W of WAVES) h += W.a * Math.sin((W.dx * x + W.dz * z) * W.k + t * W.w);
  return h * amp;
}
export function seaState(kind, wind) {
  if (kind === 'canal') return 0.05;
  return lerp(0.25, 3.2, clamp(wind / 45, 0, 1)) * (kind === 'ocean' ? 1.3 : 0.7);
}
