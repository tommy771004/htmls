// 引擎自我測試：五個階段各自的可執行驗證，Node（tools/engine.test.mjs）與頁面內「測試」分頁共用。
import { PLACES, placeAt, isLand } from './places.js';
import { World, CURB, LIFT, SHOPS } from './world.js';
import { ChunkStreamer, collideBuildings } from './stream.js';
import { generateInterior, collideInterior } from './interior.js';
import { Weather } from './weather.js';
import { Traffic, signalState } from './traffic.js';
import { createPlayer, emptyInput, spawnPlayer, stepPlayer, setMode } from './player.js';
import { DEVLOG, PHOTO_OPTIONS, cycleOption } from './devlog.js';
import { OsmWorld, hasOsm, interiorView, osmData } from './osm.js';
import { OsmTraffic } from './osmtraffic.js';
import { roomLightP, roomLit } from './lights.js';

const place = (id) => PLACES.find((p) => p.id === id);
const OSM_IDS = ['nyc', 'ams', 'sf', 'venice', 'taipei', 'kirkwood'];
const osmWorld = (id) => new OsmWorld(place(id), osmData(id));

function env(world, extra = {}) {
  const streamer = new ChunkStreamer(world, { viewDist: 300 });
  return { world, streamer, traffic: null, t: 0, seaAmp: 0.4, ...extra };
}

function run(p, inp, secs, E, dt = 1 / 60) {
  for (let t = 0; t < secs; t += dt) {
    E.t += dt;
    stepPlayer(p, inp, dt, E);
    inp.jumpPressed = false;
    inp.use = false;
    inp.mxPressed = 0;
    inp.myPressed = 0;
  }
}

const TESTS = [
  // ── Stage 1 ──
  ['地圖串流', '運河圖磚含 transportation／building／water／park 四個圖層', () => {
    const W = new World(place('ams'));
    const c = W.generateChunk(0, 0);
    const L = c.layers;
    const ok = L.transportation.length > 0 && L.building.length > 0 && L.water.length > 0 && L.park.length > 0;
    return [ok, `道路 ${L.transportation.length}、建物 ${L.building.length}、水域 ${L.water.length}、綠地 ${L.park.length}`];
  }],
  ['地圖串流', '依距離分 L0／L1／L2 三級 LOD', () => {
    const S = new ChunkStreamer(new World(place('nyc')), { viewDist: 640, genPerUpdate: 999 });
    S.update(0, 0);
    const [a, b, c] = S.stats.lod;
    return [a > 0 && b > 0 && c > 0 && S.visible[0].lod === 0, `L0 ${a}、L1 ${b}、L2 ${c}`];
  }],
  ['地圖串流', '生成有上限、其餘排隊，LRU 命中與淘汰', () => {
    const S = new ChunkStreamer(new World(place('nyc')), { viewDist: 640, cacheSize: 40, genPerUpdate: 4 });
    S.update(0, 0);
    const q = S.stats.queued;
    const hits0 = S.stats.hits;
    S.update(5, 5);
    for (let k = 0; k < 40; k++) S.update(k * 30, 0);
    return [q > 0 && S.stats.hits > hits0 && S.cache.size <= 40 && S.stats.evicted > 0, `首幀排隊 ${q}、命中 ${S.stats.hits}、淘汰 ${S.stats.evicted}`];
  }],
  ['地圖串流', '同一塊圖磚重複生成結果相同（決定性）', () => {
    const W = new World(place('sf'));
    const a = JSON.stringify(W.generateChunk(3, -2));
    const b = JSON.stringify(W.generateChunk(3, -2));
    return [a === b, `${a.length} bytes`];
  }],
  ['地圖串流', '人行道比車道高一個路緣、運河有水面', () => {
    const W = new World(place('ams'));
    const road = W.groundAt(0, 30);
    const walk = W.groundAt(8.5, 30);
    const water = W.waterAt(40, 0);
    return [Math.abs(walk - road - CURB) < 1e-6 && water === W.waterY, `車道 ${road.toFixed(2)}、人行道 ${walk.toFixed(2)}、水面 ${water}`];
  }],
  ['地圖串流', '地圖任意落點：海上、雪地、城市', () => {
    const sea = placeAt(30, -40).kind;
    const north = placeAt(64.5, -147).kind;
    const tokyo = placeAt(35.69, 139.7).kind;
    return [sea === 'ocean' && north === 'ski' && tokyo === 'metro' && isLand(48.85, 2.35), `${sea}／${north}／${tokyo}`];
  }],
  // ── Stage 2 ──
  ['建物', '中城高樓有裙樓退縮與屋頂設備', () => {
    const W = new World(place('nyc'));
    let tall = 0;
    let set = 0;
    let roof = 0;
    for (let i = -3; i <= 3; i++)
      for (let j = -3; j <= 3; j++)
        for (const b of W.generateChunk(i, j).layers.building) {
          if (b.floors > 18) tall++;
          if (b.parts.length > 1) set++;
          roof += b.roofProps.length;
        }
    return [tall > 5 && set > 2 && roof > 10, `高樓 ${tall}、退縮 ${set}、屋頂設備 ${roof}`];
  }],
  ['建物', '室內格局以種子決定、可重現', () => {
    const W = new World(place('nyc'));
    const b = W.generateChunk(0, 0).layers.building[0];
    return [JSON.stringify(generateInterior(b, 2)) === JSON.stringify(generateInterior(b, 2)), b.id];
  }],
  ['建物', 'BSP 分割：房間、門洞、樓梯間', () => {
    const W = new World(place('nyc'));
    const b = W.generateChunk(1, 1).layers.building.find((x) => x.floors > 5 && (x.x1 - x.x0) > 18);
    const L = generateInterior(b, 3);
    return [L.rooms.length >= 3 && L.doors.length >= 2 && !!L.stairs, `${L.rooms.length} 個空間、${L.doors.length} 扇門`];
  }],
  ['建物', '花店一樓擺滿一桶桶花與櫃台', () => {
    const W = new World(place('nyc'));
    const b = { ...W.generateChunk(0, 0).layers.building[0] };
    b.shop = SHOPS[0];
    const L = generateInterior(b, 0);
    const flowers = L.furniture.filter((f) => f.kind === 'flowers').length;
    const counter = L.furniture.some((f) => f.kind === 'counter');
    return [flowers >= 10 && counter, `${flowers} 桶花`];
  }],
  ['建物', '夜間窗燈：依房間類型與時刻開燈，室內與窗外同一套規則', () => {
    const sched = roomLightP('living', 21) > 0.5 && roomLightP('living', 3) < 0.1 && roomLightP('office', 10) > 0.8 && roomLightP('office', 2) < 0.2 && roomLightP('stairs', 3) > 0.6;
    const W = new World(place('nyc'));
    let lit21 = 0;
    let lit3 = 0;
    let rooms = 0;
    let same = true;
    for (let i = 0; i < 3; i++) {
      for (const b of W.generateChunk(i, 0).layers.building) {
        for (let f = 1; f < Math.min(b.floors, 6); f++) {
          const L = generateInterior(b, f);
          L.rooms.forEach((_, k) => {
            rooms++;
            const a = roomLit(b, L, k, 21);
            if (a !== roomLit(b, L, k, 21)) same = false;
            lit21 += a ? 1 : 0;
            lit3 += roomLit(b, L, k, 3) ? 1 : 0;
          });
        }
      }
    }
    return [sched && same && lit21 > lit3 * 1.6 && rooms > 50, `${rooms} 間房：21 點亮 ${lit21} 間、凌晨 3 點亮 ${lit3} 間`];
  }],
  ['建物', '室內碰撞不會穿出外牆', () => {
    const W = new World(place('ams'));
    const b = W.generateChunk(0, 0).layers.building[2];
    const L = generateInterior(b, 1);
    const c = collideInterior(L, L.x1 + 5, L.z0 - 5, 0.3);
    return [c.x <= L.x1 && c.z >= L.z0, `(${c.x.toFixed(1)}, ${c.z.toFixed(1)})`];
  }],
  // ── Stage 3 ──
  ['天氣', '太陽：正午比早上高、午夜在地平線下', () => {
    const w = new Weather();
    w.hour = 12;
    const noon = w.sun(40).elevation;
    w.hour = 8;
    const morning = w.sun(40).elevation;
    w.hour = 0;
    const night = w.sun(40).elevation;
    return [noon > morning && night < 0, `${((noon * 180) / Math.PI).toFixed(0)}° / ${((morning * 180) / Math.PI).toFixed(0)}° / ${((night * 180) / Math.PI).toFixed(0)}°`];
  }],
  ['天氣', '縮時 40× 讓時鐘走得快 40 倍', () => {
    const a = new Weather();
    const b = new Weather();
    b.timeScale = 40;
    const h0 = a.hour;
    for (let k = 0; k < 60; k++) {
      a.step(0.1);
      b.step(0.1);
    }
    const da = a.hour - h0;
    const db = b.hour - h0;
    return [Math.abs(db / da - 40) < 0.5, `${(da * 60).toFixed(2)} 分 vs ${(db * 60).toFixed(1)} 分`];
  }],
  ['天氣', '颶風：眼牆附近風速超過 30 m/s', () => {
    const w = new Weather();
    w.setOverride('hurricane', 25, -75);
    const s = w.sample(25, -75);
    return [!!s.hurricane && s.wind > 30, `${s.label} · ${s.wind.toFixed(0)} m/s · 距眼 ${s.hurricane?.km.toFixed(0)} km`];
  }],
  ['天氣', '龍捲風生成在數公里內並朝玩家移動', () => {
    const w = new Weather();
    w.setOverride('tornado', 36, -97);
    const d0 = w.sample(36, -97).tornado.km;
    w.timeScale = 10;
    for (let k = 0; k < 60; k++) w.step(0.1);
    const d1 = w.sample(36, -97).tornado.km;
    return [d0 < 4 && d1 < d0, `${d0.toFixed(2)} km → ${d1.toFixed(2)} km`];
  }],
  ['天氣', '下雪：氣溫低於 0°C 時降水變雪', () => {
    const w = new Weather();
    w.setOverride('snow', 50, -123);
    const s = w.sample(50, -123, 1500);
    return [s.snow && s.temp < 0, `${s.label} ${s.temp.toFixed(0)}°C`];
  }],
  // ── Stage 4 ──
  ['移動', '步行撞到建物會被擋在外面', () => {
    const W = new World(place('nyc'));
    const E = env(W);
    const p = createPlayer();
    spawnPlayer(p, W, place('nyc').spawn);
    const b = E.streamer.buildingsNear(p.x, p.z, 40).find((x) => x.front === 'n' || x.front === 's');
    p.x = b.door.x;
    p.z = b.door.z + (b.front === 'n' ? -3 : 3);
    const inp = emptyInput();
    inp.camYaw = b.front === 'n' ? Math.PI : 0;
    inp.my = 1;
    run(p, inp, 2, E);
    const inside = p.x > b.x0 && p.x < b.x1 && p.z > b.z0 && p.z < b.z1;
    return [!inside, `停在 (${p.x.toFixed(1)}, ${p.z.toFixed(1)})`];
  }],
  ['移動', '走進店門 → 室內，再走出來', () => {
    const W = new World(place('nyc'));
    const E = env(W);
    const p = createPlayer();
    spawnPlayer(p, W, place('nyc').spawn);
    const b = E.streamer.buildingsNear(p.x, p.z, 60).find((x) => x.shop);
    p.x = b.door.x;
    p.z = b.door.z + (b.front === 'n' ? -1 : 1);
    const inp = emptyInput();
    inp.use = true;
    run(p, inp, 0.1, E);
    const entered = !!p.inside;
    inp.use = true;
    p.x = b.door.x;
    p.z = b.door.z + (b.front === 'n' ? 1.3 : -1.3);
    run(p, inp, 0.1, E);
    return [entered && !p.inside, `${b.shop.name}`];
  }],
  ['移動', '滑板：推進加速、豚跳離地、碗池裡會被坡度加速', () => {
    const W = new World(place('venice'));
    const E = env(W);
    const p = createPlayer();
    spawnPlayer(p, W, { x: 60, z: 50, yaw: Math.PI / 2 });
    setMode(p, 'board', E);
    const inp = emptyInput();
    inp.my = 1;
    run(p, inp, 1.5, E);
    const pushed = p.sp;
    inp.jumpPressed = true;
    E.t += 1 / 60;
    stepPlayer(p, inp, 1 / 60, E);
    const air = !p.grounded;
    // 碗池：從邊緣往碗心滑
    spawnPlayer(p, W, { x: 36, z: 31, yaw: Math.PI });
    setMode(p, 'board', E);
    p.sp = 0.5;
    p.grounded = true;
    const i2 = emptyInput();
    run(p, i2, 0.6, E);
    return [pushed > 4 && air && p.sp > 2, `推進 ${pushed.toFixed(1)} m/s、碗池 ${p.sp.toFixed(1)} m/s`];
  }],
  ['移動', '吉普車三秒內超過 10 m/s', () => {
    const W = new World(place('nyc'));
    const E = env(W);
    const p = createPlayer();
    spawnPlayer(p, W, { x: 3, z: 40, yaw: 0 });
    setMode(p, 'car', E);
    const inp = emptyInput();
    inp.my = 1;
    run(p, inp, 3, E);
    return [p.sp > 10, `${(p.sp * 3.6).toFixed(0)} km/h`];
  }],
  ['移動', '吊椅纜車上山、到站換雪板', () => {
    const W = new World(place('whistler'));
    const E = env(W);
    const p = createPlayer();
    spawnPlayer(p, W, { x: LIFT.x - LIFT.gauge, z: LIFT.zBase - 4, yaw: 0 });
    const inp = emptyInput();
    inp.use = true;
    run(p, inp, 0.05, E);
    const boarded = !!p.lift;
    const y0 = p.y;
    run(p, emptyInput(), 30, E, 0.05);
    const climbed = p.y - y0;
    run(p, emptyInput(), 400, E, 0.1);
    return [boarded && climbed > 20 && !p.lift && p.mode === 'board', `30 秒爬升 ${climbed.toFixed(0)} m`];
  }],
  ['移動', '太空梭：倒數升空、助推器分離、入軌、再入落到軌跡下方', () => {
    const pl = place('venice');
    const W = new World(pl);
    const E = env(W, { place: pl });
    const p = createPlayer();
    spawnPlayer(p, W, pl.spawn);
    const err = setMode(p, 'shuttle', E);
    const inp = emptyInput();
    inp.jumpPressed = true;
    run(p, inp, 0.05, E);
    const ev = [];
    const collect = (secs, dt) => {
      for (let t = 0; t < secs; t += dt) {
        stepPlayer(p, emptyInput(), dt, E);
        for (const e of p.events) ev.push(e);
        p.events.length = 0;
      }
    };
    collect(110, 0.05);
    const orbitAlt = p.shuttle.alt;
    const inOrbit = p.shuttle.phase === 'orbit' && orbitAlt > 100000;
    const lon0 = p.shuttle.lon;
    collect(30, 0.05);
    const moved = Math.abs(p.shuttle.lon - lon0);
    const deorbit = emptyInput();
    deorbit.use = true;
    stepPlayer(p, deorbit, 0.05, E);
    collect(22, 0.05);
    const types = ev.map((e) => e.type);
    const land = ev.find((e) => e.type === 'reentry');
    const ok = !err && types.includes('liftoff') && types.includes('sep') && types.includes('orbit') && inOrbit && moved > 1 && !!land;
    return [ok, `${types.filter((t) => t === 'liftoff' || t === 'sep' || t === 'orbit' || t === 'reentry').join('→')}；軌道高度 ${(orbitAlt / 1000).toFixed(0)} km；30 秒移動經度 ${moved.toFixed(1)}°；落點 ${land ? `${land.lat.toFixed(1)}, ${land.lon.toFixed(1)}` : '—'}`];
  }],
  ['移動', '車流：會出現、會前進、紅燈會停', () => {
    const W = new World(place('nyc'));
    const T = new Traffic(W, 3);
    const me = { x: 0, z: 0, y: 0, mode: 'walk' };
    for (let k = 0; k < 120; k++) T.update(0.05, me);
    const n = T.cars.length;
    const moving = T.cars.filter((c) => c.speed > 3).length;
    for (let k = 0; k < 400; k++) T.update(0.05, me);
    const waiting = T.cars.filter((c) => c.waiting).length;
    return [n > 10 && moving > 3 && signalState('z', 5) === 'green' && signalState('x', 5) === 'red', `${n} 台車、${moving} 台行進、${waiting} 台等紅燈`];
  }],
  // ── 真實街道（OpenStreetMap，tools/fetch-osm.mjs 烘焙；Node 由 tools/engine.test.mjs 先登錄）──
  ['真實街道', '六個地點的 OSM 資料都解得開：建物、道路、高程', () => {
    const rows = OSM_IDS.map((id) => {
      if (!hasOsm(id)) return { id, ok: false };
      const D = osmData(id);
      return { id, ok: D.blds.length > 100 && D.roads.length > 50 && (!!D.dem || D.flat), b: D.blds.length, r: D.roads.length };
    });
    return [rows.every((r) => r.ok), rows.map((r) => `${r.id} ${r.ok ? `${r.b} 棟／${r.r} 路` : '缺資料'}`).join('、')];
  }],
  ['真實街道', '坡地：路面在地形上線性內插的誤差（p99）小於 10 公分', () => {
    const W = osmWorld('sf');
    const errs = [];
    for (const p of W.osm.pieces.slice(0, 4000)) {
      const mx = (p.x0 + p.x1) / 2;
      const mz = (p.z0 + p.z1) / 2;
      const L = Math.hypot(p.x1 - p.x0, p.z1 - p.z0);
      const n = Math.max(1, Math.ceil(L / 3));
      const t = 0.5 / n;
      const ax = p.x0 + (p.x1 - p.x0) * (0.5 - t);
      const az = p.z0 + (p.z1 - p.z0) * (0.5 - t);
      const bx = p.x0 + (p.x1 - p.x0) * (0.5 + t);
      const bz = p.z0 + (p.z1 - p.z0) * (0.5 + t);
      errs.push(Math.abs((W.terrain(ax, az) + W.terrain(bx, bz)) / 2 - W.terrain(mx, mz)));
    }
    errs.sort((a, b) => a - b);
    const p99 = errs[Math.floor(errs.length * 0.99)];
    return [p99 < 0.1, `舊金山 ${errs.length} 段，p99 ${(p99 * 100).toFixed(1)} cm`];
  }],
  ['真實街道', '矩形建物門朝路、室內只取臨街一個單位，走進去再走出來', () => {
    const W = osmWorld('nyc');
    const E = env(W);
    const p = createPlayer();
    spawnPlayer(p, W, W.spawnPoint(place('nyc').spawn));
    const b = E.streamer.buildingsNear(p.x, p.z, 120).find((x) => x.frame && x.door && x.frame.hw > 9);
    const v = interiorView(b);
    // 門外 1 公尺（局部北 = 世界方向 (s, -c)）
    const out = { x: b.door.x + b.frame.s, z: b.door.z - b.frame.c };
    const road = W.roadAt(out.x, out.z, 14);
    p.x = out.x;
    p.z = out.z;
    p.y = W.groundAt(p.x, p.z);
    const inp = emptyInput();
    inp.use = true;
    run(p, inp, 0.1, E);
    const entered = !!p.inside;
    const small = v.x1 - v.x0 <= 16.01 && v.z1 - v.z0 <= 16.01;
    p.x = b.door.x - b.frame.s * 1.2;
    p.z = b.door.z + b.frame.c * 1.2;
    inp.use = true;
    run(p, inp, 0.1, E);
    return [entered && small && !!road && !p.inside, `${b.name || b.id}：${(b.frame.hw * 2).toFixed(0)}×${(b.frame.hd * 2).toFixed(0)} m，室內 ${(v.x1 - v.x0).toFixed(0)}×${(v.z1 - v.z0).toFixed(0)} m`];
  }],
  ['真實街道', '阿姆斯特丹運河：水面、橋與船屋', () => {
    const W = osmWorld('ams');
    let water = 0;
    let bridge = 0;
    for (const r of W.osm.roads) if (r.bridge) bridge++;
    for (let x = -300; x < 300; x += 10) for (let z = -300; z < 300; z += 10) if (W.waterAt(x, z) !== null) water++;
    let boats = 0;
    for (let i = -3; i < 3; i++) for (let j = -3; j < 3; j++) boats += W.generateChunk(i, j).props.boats.length;
    return [water > 100 && bridge > 10 && boats > 3, `水面取樣 ${water} 點、橋 ${bridge} 座、船 ${boats} 艘`];
  }],
  ['真實街道', '車流沿 OSM 道路行駛、號誌路口停車', () => {
    const W = osmWorld('nyc');
    const T = new OsmTraffic(W, 3);
    const me = { x: 0, z: 0, y: 0, mode: 'walk' };
    for (let k = 0; k < 120; k++) T.update(0.05, me);
    const n = T.cars.length;
    const moving = T.cars.filter((c) => c.speed > 3).length;
    let waiting = 0;
    for (let k = 0; k < 600; k++) {
      T.update(0.05, me);
      waiting = Math.max(waiting, T.cars.filter((c) => c.waiting && c.speed < 1).length);
    }
    const onRoad = T.cars.filter((c) => W.roadAt(c.x, c.z, 0.5)).length;
    return [n > 10 && moving > 3 && waiting > 0 && onRoad >= T.cars.length * 0.9 && T.peds.length > 10, `${n} 台車、${moving} 台行進、最多 ${waiting} 台等紅燈、${onRoad}/${T.cars.length} 在路上、${T.peds.length} 位行人`];
  }],
  // ── Stage 5 ──
  ['攝影與日誌', '攝影選項可循環切換', () => {
    const st = {};
    const a = cycleOption(st, 'aperture', 1);
    const b = cycleOption(st, 'aperture', -2);
    const w = cycleOption(st, 'weather', -1);
    return [a === 'f/4' && b === 'f/2' && w === '颶風' && PHOTO_OPTIONS.length >= 8, `${a} → ${b}；天氣 ${w}`];
  }],
  ['攝影與日誌', '五天進度摘要都有完成項目與明日計畫', () => {
    const ok = DEVLOG.length === 5 && DEVLOG.every((d) => d.done.length >= 3 && d.next.length >= 1);
    return [ok, DEVLOG.map((d) => d.title).join('、')];
  }],
];

export function runSelfTests() {
  const results = TESTS.map(([stage, name, fn]) => {
    try {
      const [passed, detail] = fn();
      return { stage, name, passed: !!passed, detail };
    } catch (e) {
      return { stage, name, passed: false, detail: String(e && e.stack ? e.stack.split('\n').slice(0, 2).join(' ') : e) };
    }
  });
  return { results, passed: results.filter((r) => r.passed).length, total: results.length };
}
