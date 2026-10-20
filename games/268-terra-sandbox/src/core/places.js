// 地點與地區類型。精選地點有固定的生成器；地圖上任意落點則依陸地輪廓與緯度挑一種類型。
import { LAND } from '../land.js';
import { haversine, hashStr, pointInRing } from './math.js';

// 網格類型的街廓尺寸（公尺）：PX 東西向街廓寬、PZ 南北向街廓深、avW 南北大道寬、stW 東西街寬、walk 人行道寬
export const KINDS = {
  metro: { grid: true, PX: 120, PZ: 78, avW: 22, stW: 14, walk: 5.5, traffic: 26, peds: 34, label: '高樓市中心' },
  canal: { grid: true, PX: 86, PZ: 66, avW: 11, stW: 10, walk: 3, canalW: 15, quay: 6, traffic: 10, peds: 26, label: '運河老城' },
  hills: { grid: true, PX: 100, PZ: 74, avW: 14, stW: 12, walk: 3.8, traffic: 16, peds: 16, label: '坡地街區' },
  town: { grid: true, PX: 110, PZ: 84, avW: 13, stW: 11, walk: 3.2, traffic: 8, peds: 8, label: '郊區小鎮' },
  beach: { grid: true, PX: 110, PZ: 84, avW: 15, stW: 12, walk: 4, traffic: 12, peds: 14, label: '海濱街區' },
  ski: { grid: false, CH: 128, traffic: 0, peds: 8, label: '高山雪場' },
  ocean: { grid: false, CH: 160, traffic: 0, peds: 0, label: '外海' },
};

export const PLACES = [
  {
    id: 'nyc',
    name: '紐約 · 中城',
    sub: '玻璃高樓、黃色計程車、斑馬線與店面',
    lat: 40.7614,
    lon: -73.9776,
    kind: 'metro',
    spawn: { x: 14.5, z: 36, yaw: 0 },
  },
  {
    id: 'ams',
    name: '阿姆斯特丹 · 運河帶',
    sub: '山形牆磚屋、船屋、單車與拱橋',
    lat: 52.3702,
    lon: 4.8852,
    kind: 'canal',
    spawn: { x: 8, z: 20, yaw: 0 },
  },
  {
    id: 'sf',
    name: '舊金山 · 俄羅斯山',
    sub: '陡坡街道、凸窗公寓與海灣',
    lat: 37.8011,
    lon: -122.4194,
    kind: 'hills',
    spawn: { x: 10, z: 30, yaw: 0 },
  },
  {
    id: 'venice',
    name: '洛杉磯 · 威尼斯海灘',
    sub: '海濱碗池滑板公園、停車場與棕櫚樹',
    lat: 33.985,
    lon: -118.4725,
    kind: 'beach',
    spawn: { x: 30, z: 58, yaw: -0.4 },
  },
  {
    id: 'whistler',
    name: '惠斯勒山 · 雪場',
    sub: '吊椅纜車、雪道、松林與山屋',
    lat: 50.0592,
    lon: -122.9575,
    kind: 'ski',
    spawn: { x: 120, z: 236, yaw: 0 },
  },
  {
    id: 'taipei',
    name: '台北 · 信義區',
    sub: '高樓街廓、騎樓店面與車流',
    lat: 25.0339,
    lon: 121.5645,
    kind: 'metro',
    spawn: { x: 14.5, z: 36, yaw: 0 },
  },
  {
    id: 'kirkwood',
    name: '柯克伍德 · 密蘇里',
    sub: '安靜的郊區小鎮與獨棟住宅',
    lat: 38.5834,
    lon: -90.4068,
    kind: 'town',
    spawn: { x: 9, z: 30, yaw: 0 },
  },
  {
    id: 'atlantic',
    name: '北大西洋 · 外海',
    sub: '湧浪、貨櫃輪與遠方的颶風',
    lat: 29.5,
    lon: -62.0,
    kind: 'ocean',
    spawn: { x: 0, z: 0, yaw: 0 },
  },
];

// 導航目的地（只用來算大圓距離與方位）
export const LANDMARKS = [
  { id: 'niagara', name: '尼加拉瀑布', lat: 43.0896, lon: -79.0849 },
  { id: 'fuji', name: '富士山', lat: 35.3606, lon: 138.7274 },
  { id: 'eiffel', name: '艾菲爾鐵塔', lat: 48.8584, lon: 2.2945 },
  { id: 'opera', name: '雪梨歌劇院', lat: -33.8568, lon: 151.2153 },
];

export const BIG_CITIES = [
  [40.71, -74.0], [34.05, -118.24], [41.88, -87.63], [51.51, -0.13], [48.86, 2.35], [35.68, 139.69],
  [25.03, 121.56], [22.32, 114.17], [1.35, 103.82], [37.57, 126.98], [31.23, 121.47], [39.9, 116.4],
  [-33.87, 151.21], [-23.55, -46.63], [19.43, -99.13], [55.76, 37.62], [52.52, 13.4], [43.65, -79.38],
  [47.61, -122.33], [25.2, 55.27], [28.61, 77.21], [-34.6, -58.38], [30.04, 31.24], [13.75, 100.5],
];

export function isLand(lat, lon) {
  for (const ring of LAND) if (pointInRing(ring, lon, lat)) return true;
  return false;
}

// 地圖任意落點 → 一個地點物件
export function placeAt(lat, lon, name = '') {
  const near = PLACES.find((p) => haversine(p.lat, p.lon, lat, lon) < 6000);
  if (near) return near;
  let kind;
  if (!isLand(lat, lon)) kind = 'ocean';
  else if (Math.abs(lat) > 56) kind = 'ski';
  else if (BIG_CITIES.some(([a, b]) => haversine(a, b, lat, lon) < 40000)) kind = 'metro';
  else kind = Math.abs(lat) > 43 ? 'canal' : (hashStr(`${lat.toFixed(1)},${lon.toFixed(1)}`) & 3) === 0 ? 'hills' : 'town';
  const spawn = kind === 'ski' ? { x: 120, z: 236, yaw: 0 } : kind === 'ocean' ? { x: 0, z: 0, yaw: 0 } : { x: 9, z: 30, yaw: 0 };
  return {
    id: `drop-${lat.toFixed(3)},${lon.toFixed(3)}`,
    name: name || `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? 'N' : 'S'} ${Math.abs(lon).toFixed(2)}°${lon >= 0 ? 'E' : 'W'}`,
    sub: KINDS[kind].label,
    lat,
    lon,
    kind,
    spawn,
  };
}

export function placeSeed(place) {
  return hashStr(place.id) % 100000;
}
