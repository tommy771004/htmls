// ═══ 車型目錄與載具級距：車都是 26-glb.js 的實車模型（GLB），車流與路邊停車是 traffic.glb 的低面數版（30-vehicles.js）═══

// ─── 載具級距（neon_nightcity_gta_v_2.md 第一節第 1 表）：質量 kg、極速 km/h、加速度 m/s²、轉向靈敏度、側向抓地 μ_lat、手煞車 μ_drift、耐久 ───
// 車流、警車、坦克與搶來的車整組套用（vehClass）；車行的實車保留自己調好的極速、加速與抓地，只套質量、耐久、轉向與手煞車（carClass）。
// 側向速度每幀乘上 exp(−μ·10·dt)（規格的 1 − μ·dt·10）；手煞車照規格的 ×10 會在半秒內抓回來甩不出去，這裡乘 DRIFT_K（超跑 ≈ 1.4，和改版前的手感一樣）
const VCLASS = {
  super: { name: '超跑', m: 1450, kmh: 240, acc: 14.5, turn: 1.25, lat: .92, drift: .45, hp: 1000 },
  muscle: { name: '肌肉車', m: 1750, kmh: 205, acc: 12, turn: .95, lat: .75, drift: .32, hp: 1250 },
  sedan: { name: '轎跑', m: 1600, kmh: 180, acc: 9.5, turn: 1.05, lat: .85, drift: .5, hp: 1100 },
  bike: { name: '重型機車', m: 280, kmh: 225, acc: 16, turn: 1.5, lat: .88, drift: .4, hp: 550 },
  heavy: { name: '廂型／運鈔車', m: 4800, kmh: 130, acc: 5.5, turn: .65, lat: .7, drift: .6, hp: 3500 },
  police: { name: '巡邏警車', m: 1800, kmh: 215, acc: 13, turn: 1.1, lat: .86, drift: .42, hp: 1400 },
  tank: { name: '重裝坦克', m: 12000, kmh: 75, acc: 4, turn: .5, lat: .98, drift: .9, hp: 10000 },
};
const DRIFT_K = 1 / 3.2;
// 車子的 vmax 參數是推力歸零的速度（driveVehicle：eng·(1 − (v/vmax)²) 對上阻力 .12v + .35），這裡反推成實際極速剛好是表上的 km/h
const vmaxFor = (kmh, acc) => { const V = kmh / 3.6; return V / Math.sqrt(Math.max(.05, 1 - (.12 * V + .35) / acc)); };
const CAR_CLS = { muscle: ['chall', 'zr1', 'gt500', 'viper'], sedan: ['ae86', 'e34', 'evo190', 'm3c', 'm3t24'], police: ['police', 'charger'] };
function carClass(id) {
  const c = CARS[id];
  if (!c) return 'sedan';
  if (c.bike) return 'bike';
  for (const k in CAR_CLS) if (CAR_CLS[k].includes(id)) return k;
  return c.vmax >= 70 ? 'super' : 'sedan';
}
// 車流車型（30-vehicles.js 的 TYPES）：沒列到的是轎跑
const TYPE_CLS = { super: ['tiara', 'milano'], muscle: ['carter', 'fh', 'il'], police: ['fh_cop', 'il_cop', 'urban_cop'], heavy: ['shvan', 'lct', 'conquer', 'fvan', 'ambulance', 'md84', 'grc_stepvan', 'grc_mailvan', 'tow', 'firetruck'], tank: ['tank'] };
const typeClass = type => Object.keys(TYPE_CLS).find(k => TYPE_CLS[k].includes(type)) || 'sedan';
// 套到載具上：full 時連極速、加速與抓地一起換（車流車型）；mass、hpMax、turn、hbGrip 每台都有
function vehClass(v, cls, full) {
  const C = VCLASS[cls], k = v.hpMax ? clamp(v.hp / v.hpMax, 0, 1) : 1;
  v.cls = cls; v.mass = C.m; v.turn = C.turn; v.hbGrip = C.drift * 10 * DRIFT_K;
  v.hpMax = C.hp; v.hp = C.hp * k; v.hpLock = full ? 0 : 1;   // full（車流造的車）：各模組之後還會改 hp，第一次受損時才鎖上限（68-wreck.js 的 hpLockOf）
  if (full) { v.vmax = vmaxFor(C.kmh, C.acc); v.eng = C.acc; v.grip = C.lat * 10; }
}

// ─── 車型 ───
// 26-glb.js 登錄：len／w 碰撞用車長車寬；wr 輪徑、ww 前後胎寬、track 輪距一半、fa／ra 前後軸 z；vmax m/s、eng 加速、grip 抓地
const CARS = {};
const car = (id, o) => { CARS[id] = { id, ...o }; };
// 車庫車格的順序
const CAR_ORDER = ['ae86', 'e92', 'm3c', 'm4wb', 'm3gtr', 'm3t24', 'm4gt3', 'gt3rs', 'gt3r', 's1krr', 's1krr19',
  'rx7', 'supra', 'r34', 'nsx', 'r35', 'p930', 'rwb', 'e34', 'evo190', 'm4csl', 'chall', 'police', 'zr1', 'f40', 'sf90', 'p1', 'svj', 'evija', 'spano', 'f8', 'scg', 'p9x8', 'c110', 'nevera', 'f488c', 'sc20', 'c63dtm', 'energ', 'spano8', 'mosler', 'csl3', 'slk55', 'giulietta', 'charger', 'zx6r', 'v4',
  // 街頭車（26-glb.js 的 street：車行不賣，搶來或騎走後收進車庫）
  'g63', 'lc200', 'rr06', 'ramtrx', 'ghost', 's65', 'm5f90', 'camry', 'gt500', 'viper', 'senna', 'r8', 'evo6', 'hd72', 'hdpol', 'r6', 'z1000'];
