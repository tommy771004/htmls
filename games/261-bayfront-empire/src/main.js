// 灣岸商業帝國 · BAYFRONT EMPIRE — 進入點：渲染器、等角鏡頭、日夜與天氣、輸入、存檔與主迴圈。
import * as THREE from 'three';
import { BIZ, BIZ_BY_ID, WEATHER, EVENTS, BEACH_IDS, PORT, LANDMARKS, LANDMARK_BY_ID, TIERS } from './data.js';
import { newState, migrate, serialize, tick, buyOrUpgrade, nextCost, capOf, SAVE_KEY, empireLevel, rand, investedOf } from './econ.js';
import { setTier, startPromo, upgradeLift, swapFloors, floorOrder, buyApt, buyMark, buyoutRival, offlineEarnings, APTS, APT_BY_KEY, aptLv, hasMark, liftLv } from './empire.js';
import { createEstate, aptBox } from './estate.js';
import { buyPort, placeBid, setReorder, portNextCost, absMin } from './port.js';
import { createHarbor } from './portview.js';
import { buildWorld } from './world.js';
import { createDecor } from './decor.js';
import { createSea } from './sea.js';
import { createPeople } from './people.js';
import { createTraffic } from './traffic.js';
import { createUI, money } from './ui.js';
import { createAudio } from './audio.js';
import { icon } from './icons.js';
import { buildWalkGraph, buildNextHop, CITY_LOTS, lotRect, floorOf, stackOf, setFloor, STACKS, lotKey, BEACH, labelAnchor, HARBOR } from './layout.js';
import { floorY } from './interior.js';
import { lotFloors, roofY } from './world.js';

const SEC_PER_MIN = 0.3; // 1 倍速時，一遊戲分鐘 = 0.3 秒（一天約 7 分鐘）
const params = new URLSearchParams(location.search);
const mobile = matchMedia('(pointer: coarse)').matches || Math.min(innerWidth, innerHeight) < 600;

// ───────── 狀態與存檔 ─────────
const store = {
  get() { try { return localStorage.getItem(SAVE_KEY); } catch { return null; } },
  set(v) { try { localStorage.setItem(SAVE_KEY, v); return true; } catch { return false; } },
  del() { try { localStorage.removeItem(SAVE_KEY); } catch { /* 無痕模式 */ } },
};
let S = newState(Date.now() % 100000);
let started = false;
let speed = 1;
let selected = null;

// ───────── 渲染器與場景 ─────────
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
const quality = { dpr: Math.min(devicePixelRatio, mobile ? 1.5 : 2), shadowEvery: mobile ? 2 : 1, shadows: true, size: mobile ? 1024 : 2048 };
renderer.setPixelRatio(quality.dpr);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#62a19c');
const hemi = new THREE.HemisphereLight('#e9f1ff', '#9a8e72', 1.4);
scene.add(hemi);
const sun = new THREE.DirectionalLight('#fff3df', 2.4);
sun.castShadow = true;
sun.shadow.mapSize.set(quality.size, quality.size);
sun.shadow.bias = -0.0006;
sun.shadow.normalBias = 0.35;
scene.add(sun, sun.target);

const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 1600);
const AZ = Math.PI / 4, EL = 0.6;
const camDir = new THREE.Vector3(Math.sin(AZ) * Math.cos(EL), Math.sin(EL), Math.cos(AZ) * Math.cos(EL));
const view = { x: -24, z: 4, h: mobile ? 105 : 92, tx: -24, tz: 4, th: mobile ? 105 : 92 };
const LIMIT = { x0: -290, x1: 150, z0: -95, z1: 120, h0: 34, h1: 190 };

const world = buildWorld(scene);
const decor = createDecor(scene);
const sea = createSea(scene);
const harbor = createHarbor(scene, {
  sea, getState: () => S,
  // 物流車停在店門口卸貨：飄一個「補貨」
  onDeliver(id, x, z) { if (BIZ_BY_ID[id]) ui.pop(`補貨 · ${{ food: '食材', goods: '零售貨', fuel: '燃油' }[BIZ_BY_ID[id].cargo]}`, x, 3.4, z, 'dlv'); },
});
const estate = createEstate(scene);
const graph = buildWalkGraph();
const route = buildNextHop(graph);
const audio = createAudio();

// 選取框
const selBox = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0)), new THREE.LineBasicMaterial({ color: '#f5c451', transparent: true, opacity: 0.95 }));
selBox.visible = false;
scene.add(selBox);

// 點選範圍
const PICK = {};
function cityPick() {
  for (const b of BIZ) {
    if (!CITY_LOTS[b.id]) continue;
    const [c, r, side] = CITY_LOTS[b.id];
    const rr = lotRect(c, r, side);
    // 疊樓建築每層是不同店家，各自點自己那層（交換樓層後重算）
    const f = floorOf(b.id), y0 = f > 1 ? floorY(f) - 0.6 : 0;
    const y1 = stackOf(b.id).floors > 1 ? floorY(f) + 5.4 : Math.max(roofY(lotFloors(c, r, side)) + 1, 11);
    PICK[b.id] = [new THREE.Box3(new THREE.Vector3(rr.x0, y0, rr.z0), new THREE.Vector3(rr.x1, y1, rr.z1 + 2.4))];
  }
}
cityPick();
// 公寓、地標與對手的店面
for (const a of APTS) {
  const q = aptBox(a.key);
  PICK['apt:' + a.key] = [new THREE.Box3(new THREE.Vector3(q.x0, 0, q.z0), new THREE.Vector3(q.x1, q.top + 1, q.z1 + 1.5))];
}
const MARK_PICK = { lighthouse: [6, 22, 6], market: [11, 6, 7.5], ferris: [8, 26, 8] };
function markPick() {
  for (const m of LANDMARKS) {
    const [x, , z] = m.at, [w, h, d] = MARK_PICK[m.id];
    if (hasMark(S, m.id)) PICK['mark:' + m.id] = [new THREE.Box3(new THREE.Vector3(x - w, 0, z - d), new THREE.Vector3(x + w, h, z + d))];
    else delete PICK['mark:' + m.id];
  }
}
function rivalPick() {
  if (!S.rival) { delete PICK.rival; return; }
  const q = aptBox(S.rival.lot);
  PICK.rival = [new THREE.Box3(new THREE.Vector3(q.x0, 0, q.z1 - 2), new THREE.Vector3((q.x0 + q.x1) / 2 - 1.5, 4.2, q.z1 + 2.6))];
}
const box = (x0, z0, x1, z1, h = 4) => new THREE.Box3(new THREE.Vector3(x0, 0, z0), new THREE.Vector3(x1, h, z1));
PICK.snack = [box(-86, 20, -72, 33)];
PICK.umbrella = [box(-47, 19, -6, 40, 3)];
PICK.surf = [box(94, 19, 108, 30)];
PICK.jetski = [box(54, 19, 66, 57, 3)];
PICK.boat = [box(6, 17, 30, 28, 5), box(13, 28, 23, 64, 2)];
// 海港：倉庫、堆場與泊位（點選開物流面板）
PICK.port = [box(HARBOR.x0, HARBOR.z0, HARBOR.x1, HARBOR.z1, 9), box(HARBOR.x0, HARBOR.z1, HARBOR.x1, 70, 3)];
const PORT_ANCHOR = [-232, 14, 30];

const people = createPeople(scene, {
  graph, route, getState: () => S, sea, mobile,
  onIncome(id, amt, x, y, z) {
    const a = anchorOf(id);
    ui.income(id, amt, a[0], a[1] - 2, a[2]);
    audio.coin(amt);
  },
  onTurned(id, x, y, z, why) { ui.turned(id, x, y, z, why); },
});
people.setSecPerMin(SEC_PER_MIN);
const traffic = createTraffic(scene, { mobile });

// 雨
const RAIN_N = mobile ? 500 : 900;
const rainGeo = new THREE.BufferGeometry();
{
  const pos = new Float32Array(RAIN_N * 6), top = new Float32Array(RAIN_N * 2);
  for (let i = 0; i < RAIN_N; i++) {
    const x = Math.random() * 2 - 1, y = Math.random() * 40, z = Math.random() * 2 - 1;
    pos.set([x, y, z, x, y, z], i * 6);
    top.set([0, 1], i * 2);
  }
  rainGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  rainGeo.setAttribute('aTop', new THREE.BufferAttribute(top, 1));
}
const rainMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false,
  uniforms: { uTime: { value: 0 }, uC: { value: new THREE.Vector3() }, uR: { value: 60 }, uA: { value: 0 } },
  vertexShader: `attribute float aTop; uniform float uTime, uR; uniform vec3 uC; varying float vT;
    void main(){ vec3 p = position; p.y = mod(p.y - uTime * 30.0, 40.0); p.xz *= uR; p += vec3(aTop * 0.25, aTop * 1.6, aTop * 0.15);
      vT = aTop; gl_Position = projectionMatrix * viewMatrix * vec4(uC + p, 1.0); }`,
  fragmentShader: `uniform float uA; varying float vT; void main(){ gl_FragColor = vec4(0.86, 0.92, 0.98, uA * (0.25 + 0.5 * vT)); }`,
});
const rain = new THREE.LineSegments(rainGeo, rainMat);
rain.frustumCulled = false;
rain.visible = false;
scene.add(rain);

// ───────── 介面 ─────────
function anchorOf(id) {
  if (id.startsWith('apt:')) {
    const q = aptBox(id.slice(4));
    return [(q.x0 + q.x1) / 2, q.top + 3.2, q.z1];
  }
  if (id.startsWith('mark:')) {
    const m = LANDMARK_BY_ID[id.slice(5)];
    return [m.at[0], { lighthouse: 21, market: 7, ferris: 27 }[m.id], m.at[2]];
  }
  if (id === 'rival') {
    const q = aptBox(S.rival ? S.rival.lot : APTS[0].key);
    return [q.x0 + (q.x1 - q.x0) * 0.25, 5.2, q.z1 + 0.8];
  }
  if (CITY_LOTS[id]) {
    const rr = lotRect(...CITY_LOTS[id]);
    return [(rr.x0 + rr.x1) / 2, floorY(floorOf(id)) + 4.9, rr.z1 + 0.8];
  }
  const a = labelAnchor(id);
  return [a[0], a[1] + 2.2, a[2]];
}
const _v = new THREE.Vector3();
function projectPoint(x, y, z) {
  _v.set(x, y, z).project(camera);
  return { x: (_v.x * 0.5 + 0.5) * innerWidth, y: (-_v.y * 0.5 + 0.5) * innerHeight };
}
const ui = createUI(document.getElementById('ui'), {
  state: () => S,
  occ: (id) => people.occ[id],
  speed: () => speed,
  selected: () => selected,
  projectPoint,
  projectPort() {
    const p = projectPoint(...PORT_ANCHOR);
    p.vis = p.x > -60 && p.x < innerWidth + 60 && p.y > 40 && p.y < innerHeight + 40;
    p.far = view.h > 130;
    return p;
  },
  shipLabels: () => harbor.shipLabels(),
  elevators: () => people.elevators(),
  anchor: anchorOf,
  far: () => view.h > 130,
  project(id) {
    const a = anchorOf(id);
    const p = projectPoint(a[0], a[1], a[2]);
    p.vis = p.x > -60 && p.x < innerWidth + 60 && p.y > 40 && p.y < innerHeight + 40;
    p.far = view.h > 130;
    return p;
  },
  actions: {
    buy(id) {
      const was = S.biz[id].lv;
      const lv = buyOrUpgrade(S, id);
      if (!lv) { audio.deny(); return; }
      audio.buy();
      applyBiz(id);
      const b = BIZ_BY_ID[id];
      ui.toast(was ? `${b.name} 升級到 Lv${lv}` : `${b.name} 開幕！客人正從街區走過來`, was ? 'up' : 'shop', 'good');
      if (!was && b.zone === 'beach' && !BEACH_IDS.some((k) => k !== id && S.biz[k].lv)) ui.toast('海灘改版第一家店開張：晴天與熱浪天客人最多', 'sun');
      handle(tick(S, 0));
      save();
    },
    focus(id) {
      const a = anchorOf(id);
      view.tx = a[0];
      view.tz = a[2] + (BIZ_BY_ID[id] && BIZ_BY_ID[id].zone === 'beach' ? 6 : 4);
      if (follow) stopFollow();
      view.th = Math.min(view.th, mobile ? 92 : 80);
      selected = id;
    },
    select(id) { selected = id; },
    buyPort() {
      const lv = buyPort(S);
      if (!lv) { audio.deny(); return; }
      audio.buy();
      harbor.setLevel(lv);
      ui.toast(lv === 1 ? `${PORT.name}開港！補給船會自動送貨，進貨價立刻打折` : `${PORT.name}擴建為${PORT.stage[lv - 1]}`, lv === 1 ? 'anchor' : 'up', 'good');
      handle(tick(S, 0));
      save();
    },
    bid(id, bid) {
      const r = placeBid(S, rand, id, bid);
      if (!r) return;
      if (r.won) { audio.buy(); ui.toast(`得標！${r.offer.client} ${r.offer.containers} 櫃，每櫃 ${money(bid, true)}，${r.offer.name} 約 ${Math.round(r.offer.arrive / 60)} 小時後到港`, 'contract', 'good'); }
      else { audio.deny(); ui.toast(`未得標：${r.offer.client} 選了更便宜的報價（得標機率 ${Math.round(r.chance * 100)}%）`, 'contract', 'warn'); }
      save();
    },
    reorder(c, d) { setReorder(S, c, S.port.reorder[c] + d * 60); },
    focusPort,
    setSpeed(v) { speed = v; },
    zoom(k) { view.th = clamp(view.th * k, LIMIT.h0, LIMIT.h1); },
    overview() { view.tx = S.port.lv ? -60 : 0; view.tz = 5; view.th = view.th > 150 ? (mobile ? 105 : 92) : 175; },
    toggleSound() { S.opts.sound = !S.opts.sound; audio.setOn(S.opts.sound); },
    setQuality(q) { S.opts.quality = q; applyQuality(); },
    save() { save(); },
    reset() { store.del(); startGame(newState(Date.now() % 100000)); },
    // ── 城市生活改版 ──
    tier(id, t) { if (setTier(S, id, t)) { audio.buy(); ui.toast(`${BIZ_BY_ID[id].name}改成${TIERS[t].name}定價`, 'tag'); save(); } },
    promo(id) {
      if (!startPromo(S, id)) { audio.deny(); return; }
      audio.buy();
      ui.toast(`${BIZ_BY_ID[id].name}促銷開跑：接下來 3 小時客流 +60%`, 'megaphone', 'good');
      handle(tick(S, 0));
      save();
    },
    lift(key) {
      const lv = upgradeLift(S, key);
      if (!lv) { audio.deny(); return; }
      audio.buy();
      S.stats.invested = investedOf(S);
      ui.toast(`大樓電梯升級：${['', '標準電梯', '雙速電梯', '高速觀景梯'][lv]}`, 'lift', 'good');
      handle(tick(S, 0));
      save();
    },
    swap(key, a, b) {
      if (!swapFloors(S, key, a, b)) { audio.deny(); return; }
      audio.buy();
      const ids = stackOf(a).ids;
      people.evict(ids);
      applyOrder();
      for (const id of ids) decor.set(id, S.biz[id].lv);
      cityPick();
      ui.toast(`${BIZ_BY_ID[a].name}換到 F${floorOf(a)}，${BIZ_BY_ID[b].name}換到 F${floorOf(b)}`, 'swap', 'good');
      save();
    },
    apt(key) {
      const was = aptLv(S, key), hadRival = !!S.rival;
      const lv = buyApt(S, key);
      if (!lv) { audio.deny(); return; }
      audio.buy();
      S.stats.invested = investedOf(S);
      estate.setApt(key, lv);
      const a = APT_BY_KEY[key];
      ui.toast(was ? `${a.name}翻修完成：房租與住戶都變多了` : `買下${a.name}：每天收房租，住戶也會來你的店消費`, 'home', 'good');
      if (hadRival && !S.rival) rivalGone();
      handle(tick(S, 0));
      save();
    },
    mark(id) {
      if (!buyMark(S, id)) { audio.deny(); return; }
      audio.buy();
      S.stats.invested = investedOf(S);
      estate.setMark(id, true);
      markPick();
      const m = LANDMARK_BY_ID[id];
      ui.toast(`${m.name}落成！${m.note}`, m.icon, 'good');
      view.tx = m.at[0]; view.tz = m.at[2] + 4; view.th = Math.min(view.th, mobile ? 100 : 86);
      handle(tick(S, 0));
      save();
    },
    buyout() {
      if (!buyoutRival(S)) { audio.deny(); return; }
      audio.buy();
      rivalGone();
      handle(tick(S, 0));
      save();
    },
    follow(on = true) { if (on) followSomeone(); else stopFollow(); },
    photo(on) { photoMode(on); },
    photoTime(h) { S.minute = Math.round(h * 60) % 1440; },
    photoWeather(w) { if (WEATHER[w]) { S.weather.cur = w; S.weather.until = S.minute + 240; if (w === 'rain') people.clearBeach(); } },
    timelapse() { lapse = lapse ? null : { left: 1440, prev: speed }; if (lapse) speed = 20; else speed = 1; },
    record() { toggleRecord(); },
    snapshot() { snap = true; },
  },
});

// ───────── 城市生活改版：樓層、對手、跟拍、照片模式 ─────────
function applyOrder() {
  for (const st of STACKS) floorOrder(S, st.key).forEach((id, i) => setFloor(id, i + 1));
}
function rivalGone() {
  const r = S.rivalLog;
  estate.setRival(null);
  rivalPick();
  if (r) ui.toast(r.how === 'evict' ? `${r.name}的店面租約被你收回，搬走了` : `你收購了${r.name}，對街又是你的天下`, 'rival', 'good');
}
// 跟拍：點人或按「跟拍」挑一位正在路上的顧客，鏡頭跟著走
let follow = null;
function followAgent(a) {
  follow = { a, gen: a.gen };
  view.th = Math.min(view.th, mobile ? 70 : 60);
  ui.follow(people.describe(a), a);
}
function followSomeone() {
  const A = people.agents.filter((a) => a.on && a.kind === 'cust' && !a.paid && a.pose === 'walk' && !a.rival);
  // 優先挑要去疊樓上層的客人（會搭電梯）
  const up = A.filter((a) => a.target && CITY_LOTS[a.target] && floorOf(a.target) > 1);
  const pool = up.length ? up : A;
  if (!pool.length) { ui.toast('現在街上沒有客人可以跟', 'eye'); return; }
  followAgent(pool[Math.floor(Math.random() * pool.length)]);
}
function stopFollow() { follow = null; ui.follow(null); }
function pickPerson(cx, cy) {
  let best = null, bd = 24 * 24;
  for (const a of people.agents) {
    if (!a.on || a.pose === 'hidden') continue;
    const p = projectPoint(a.x, a.y + 0.9, a.z);
    const d = (p.x - cx) ** 2 + (p.y - cy) ** 2;
    if (d < bd) { bd = d; best = a; }
  }
  return best;
}
// 照片模式：藏起介面、可調時間天氣、24 小時縮時、錄影與截圖
let lapse = null, snap = false, rec = null;
function photoMode(on) {
  document.getElementById('ui').classList.toggle('photo', on);
  if (!on && lapse) { lapse = null; speed = 1; }
  if (!on && rec) toggleRecord();
}
function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
const stamp = () => `bayfront-D${S.day}-${String(Math.floor(S.minute / 60)).padStart(2, '0')}${String(Math.floor(S.minute % 60)).padStart(2, '0')}`;
function toggleRecord() {
  if (rec) { rec.stop(); rec = null; ui.recording(false); return; }
  if (!canvas.captureStream || typeof MediaRecorder === 'undefined') { ui.toast('這個瀏覽器不支援錄影', 'film', 'warn'); return; }
  const type = ['video/webm;codecs=vp9', 'video/webm', 'video/mp4'].find((t) => MediaRecorder.isTypeSupported(t));
  if (!type) { ui.toast('這個瀏覽器不支援錄影', 'film', 'warn'); return; }
  const chunks = [];
  const r = new MediaRecorder(canvas.captureStream(30), { mimeType: type, videoBitsPerSecond: 8e6 });
  r.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  r.onstop = () => download(new Blob(chunks, { type }), `${stamp()}.${type.includes('mp4') ? 'mp4' : 'webm'}`);
  r.start(500);
  rec = r;
  ui.recording(true);
}

function focusPort() {
  view.tx = -222; view.tz = 40; view.th = Math.min(Math.max(view.th, mobile ? 120 : 100), 140);
  selected = 'port';
}

function applyBiz(id) {
  decor.set(id, S.biz[id].lv);
  if (id === 'boat') sea.setFleet('boat', S.biz.boat.lv ? capOf(S, 'boat') : 0);
  if (id === 'jetski') sea.setFleet('jet', S.biz.jetski.lv ? capOf(S, 'jetski') : 0);
}
function applyAll() {
  applyOrder();
  cityPick();
  for (const b of BIZ) applyBiz(b.id);
  for (const a of APTS) estate.setApt(a.key, aptLv(S, a.key));
  for (const m of LANDMARKS) estate.setMark(m.id, hasMark(S, m.id));
  markPick();
  estate.setRival(S.rival);
  rivalPick();
}

function save() {
  if (!started) return;
  store.set(serialize(S));
}

function handle(events) {
  for (const e of events) {
    if (e.type === 'weather') {
      const w = WEATHER[e.to];
      ui.toast(`${w.name} · ${w.note}`, e.to === 'rain' ? 'rain' : e.to === 'heat' ? 'heat' : e.to === 'cloudy' ? 'cloudy' : 'sun', e.to === 'rain' ? 'warn' : '');
      if (e.to === 'rain') people.clearBeach();
    } else if (e.type === 'quest') {
      ui.toast(`任務完成：${e.title}　+${money(e.reward)}`, 'check', 'good');
      audio.buy();
    } else if (e.type === 'day') {
      ui.toast(`第 ${e.day} 天結算：營收 ${money(e.rev)}，成本 ${money(e.cost)}`, 'finance');
      save();
    } else if (e.type === 'event') {
      const ev = EVENTS[e.id];
      ui.toast(`今日活動：${ev.name} · ${ev.note}`, 'people', 'good');
    } else if (e.type === 'port') {
      ui.toast(e.msg, e.ic || 'anchor', e.tone || '');
      if (e.msg.includes('準備靠泊')) audio.horn();
    } else if (e.type === 'daily') {
      ui.toast(`每日目標完成：${e.text}　+${money(e.reward)}`, 'target', 'good');
      audio.coin(e.reward);
    } else if (e.type === 'ach') {
      ui.toast(`成就解鎖：${e.name} · ${e.desc}　+${money(e.reward)}`, 'trophy', 'good');
      audio.buy();
    } else if (e.type === 'rival') {
      estate.setRival(S.rival);
      rivalPick();
      ui.toast(`競爭對手進駐：${e.name}開在${APT_BY_KEY[S.rival.lot].name}一樓，搶走${BIZ_BY_ID[e.id].name}的客人`, 'rival', 'warn');
    } else if (e.type === 'season') {
      ui.toast(`換季：${e.season.name}天到了 · 海灘 ${Math.round(e.season.beach * 100)}%、城市 ${Math.round(e.season.city * 100)}%`, { spring: 'flower', summer: 'sun', autumn: 'leaf', winter: 'snow' }[e.season.id]);
    } else if (e.type === 'contract') {
      ui.toast(e.late ? `${e.name} 卸貨完成，逾期 ${e.hours} 小時扣 ${Math.round(e.pen * 100)}%：收款 ${money(e.pay)}` : `合約完成：${e.client} 付款 ${money(e.pay)}`, 'contract', e.late ? 'warn' : 'good');
      const q = harbor.shipLabels().find((v) => v.name === e.name);
      ui.income('port', e.pay, q ? q.x : -214, 12, q ? q.z : 60);
      audio.coin(e.pay);
    }
  }
}

// ───────── 開始畫面 ─────────
// 物流改版前（v2）的海灘存檔：城市與海灘大致開好，沒有海港
const V2_DEMO = { v: 2, money: 2380000, day: 15, minute: 10 * 60 + 20, rng: 31337, quest: 10, rating: 88, event: null, weather: { cur: 'sunny', until: 14 * 60, next: 'partly' },
  biz: { cafe: { lv: 3, earned: 1.9e6, visits: 6100 }, bakery: { lv: 2, earned: 8.4e5, visits: 3300 }, burger: { lv: 3, earned: 1.6e6, visits: 5200 }, mart: { lv: 2, earned: 9.1e5, visits: 3900 },
    books: { lv: 2, earned: 4.2e5, visits: 1500 }, pizza: { lv: 2, earned: 1.1e6, visits: 3600 }, nail: { lv: 1, earned: 3.2e5, visits: 900 }, boutique: { lv: 2, earned: 6.6e5, visits: 1200 },
    gym: { lv: 2, earned: 7.7e5, visits: 2400 }, bar: { lv: 2, earned: 1.2e6, visits: 3100 }, snack: { lv: 2, earned: 7.2e5, visits: 4100 }, umbrella: { lv: 2, earned: 9.6e5, visits: 1800 },
    surf: { lv: 1, earned: 5.1e5, visits: 600 }, jetski: { lv: 1, earned: 6.4e5, visits: 420 }, boat: { lv: 2, earned: 1.5e6, visits: 520 } },
  stats: { invested: 4.6e6, earned: 1.5e7, served: 38000, turned: 2100 }, history: [], today: { rev: {}, visits: {}, turned: {}, cost: 0, buy: 0 }, opts: { sound: true, quality: 'auto' } };
const LEGACY_DEMO = { v: 1, cash: 1450000, day: 6, time: 9 * 60 + 40, shops: { cafe: 3, bakery: 2, burger: 2, mart: 2, books: 1, pizza: 2, nail: 1, boutique: 1, gym: 1, bar: 1 }, earnedTotal: 2650000, quest: 4, rating: 86, seed: 4242 };

function startGame(state, resumed = false) {
  S = state;
  started = true;
  speed = 1;
  stopFollow();
  // 離線收入：繼續經營時結算不在的這段時間（店長代管）
  const off = resumed ? offlineEarnings(S, Date.now()) : { amount: 0 };
  if (off.amount > 0) { S.money += off.amount; S.stats.earned += off.amount; }
  audio.setOn(S.opts.sound);
  applyAll();
  applyQuality();
  ui.closeModal();
  ui.close();
  if (S.notice === 'beach-update') {
    const n = BIZ.filter((b) => S.biz[b.id].lv).length;
    ui.modal(`<div class="mcard">
      <p class="kick">${icon('wave', 18)} 改版公告 · 存檔 v1 → v2</p>
      <h2>海灘改版上線</h2>
      <p>你的城市存檔已完整轉換：<b>${n} 家店</b>、資金 <b>${money(S.money)}</b>、第 ${S.day} 天，等級與任務進度都保留。</p>
      <ul><li>沿海道路以南新開放：步道與護欄、沙灘、防波堤、碼頭與海面</li><li>五種新商家：租船碼頭、水上摩托車、遮陽傘躺椅、浪花小吃攤、衝浪學校</li><li>客人會從街區穿過斑馬線走到海灘消費，晴天與熱浪天最多</li></ul>
      <button class="big" id="goBeach">${icon('arrow', 18)} 去看看海灘</button></div>`);
    document.getElementById('goBeach').onclick = () => {
      S.notice = null;
      ui.closeModal();
      view.tx = -4; view.tz = 26; view.th = mobile ? 96 : 86;
      ui.openShop('beach');
      save();
    };
  } else if (S.notice === 'port-update') {
    const n = BIZ.filter((b) => S.biz[b.id].lv).length;
    ui.modal(`<div class="mcard">
      <p class="kick">${icon('anchor', 18)} 改版公告 · 存檔 v2 → v3</p>
      <h2>物流與海港改版上線</h2>
      <p>你的存檔已完整轉換：<b>${n} 家店</b>、資金 <b>${money(S.money)}</b>、第 ${S.day} 天，海灘商家、船隊與任務進度都保留。</p>
      <ul><li>每位客人消費都會用掉一份貨（食材、零售貨、燃油耗材），進貨成本現在會列進財務</li><li>防波堤西邊開放灣岸海港：補給船、岸橋卸貨、堆場與物流車，批發價便宜 22% 起</li><li>貨運合約投標：出價越低越容易得標，逾期交貨會被扣款</li></ul>
      <button class="big" id="goPort">${icon('arrow', 18)} 去看看海港</button></div>`);
    document.getElementById('goPort').onclick = () => {
      S.notice = null;
      ui.closeModal();
      focusPort();
      ui.openPanel('port', true);
      save();
    };
  } else if (S.notice === 'life-update') {
    ui.modal(`<div class="mcard">
      <p class="kick">${icon('home', 18)} 改版公告 · 存檔 v3 → v4</p>
      <h2>城市生活改版上線</h2>
      <p>你的存檔已完整轉換，所有商家、海港與任務進度都保留。這次新增：</p>
      <ul><li>定價（平價／標準／精品）與促銷活動；疊樓的店互相帶客，電梯改成叫車制、可以升級，也能付錢交換樓層</li><li>買下公寓收房租、增加住戶；三座地標：燈塔、海濱夜市、摩天輪</li><li>競爭對手會開到對街搶客；四季、週五夜派對、批發短缺</li><li>每日目標與成就、離線收入、跟拍客人與照片模式</li></ul>
      <button class="big" id="goLife">${icon('arrow', 18)} 開始經營</button></div>`);
    document.getElementById('goLife').onclick = () => { S.notice = null; ui.closeModal(); ui.openShop('estate'); save(); };
  } else if (off.amount > 0) {
    S.notice = null;
    ui.modal(`<div class="mcard">
      <p class="kick">${icon('clock', 18)} 歡迎回來</p>
      <h2>店長幫你顧店</h2>
      <p>你離開了 ${off.minutes >= 60 ? `${Math.floor(off.minutes / 60)} 小時 ${Math.round(off.minutes % 60)} 分` : `${Math.round(off.minutes)} 分鐘`}。各店照常營業，結算${off.days >= 1 ? '一整天' : '這段時間'}平均淨利的一半：</p>
      <p class="offamt">+${money(off.amount, true)}</p>
      <p class="muted">離線收入最多結算遊戲裡的一天（約真實 7 分鐘），想賺更多就回來親自經營。</p>
      <button class="big" id="goBack">${icon('check', 18)} 收下</button></div>`);
    document.getElementById('goBack').onclick = () => { ui.closeModal(); audio.coin(off.amount); };
  } else {
    S.notice = null;
  }
  save();
}

function startScreen() {
  const raw = store.get();
  let prev = null;
  if (raw) { try { prev = migrate(raw); } catch { prev = null; } }
  const owned = prev ? BIZ.filter((b) => prev.biz[b.id].lv).length : 0;
  ui.modal(`<div class="mcard start">
    <p class="kick">BAYFRONT EMPIRE · 等角經營大亨</p>
    <h1>灣岸商業帝國</h1>
    <p class="sub">從一間街角咖啡館開始，把連鎖店開滿海濱大道，再把生意做到沙灘、碼頭與海上。</p>
    <div class="choices">
      ${prev && owned ? `<button class="big" data-start="cont">${icon('arrow', 18)} 繼續經營<small>第 ${prev.day} 天 · ${owned} 家店 · ${money(prev.money)}</small></button>` : ''}
      <button class="big ${prev && owned ? 'alt' : ''}" data-start="new">${icon('shop', 18)} ${prev && owned ? '新的帝國' : '開始經營'}<small>資金 ${money(250000)}，從零開店</small></button>
      <button class="big alt" data-start="v2">${icon('anchor', 18)} 試玩物流改版<small>載入一份改版前（v2）的海灘存檔，接著開海港</small></button>
      <button class="big alt" data-start="legacy">${icon('wave', 18)} 試玩海灘改版<small>載入一份更早（v1）的城市存檔，看它如何轉換</small></button>
    </div>
    <p class="muted">拖曳移動、滾輪或雙指縮放、點店面看詳情。進度自動存在這台裝置。</p>
  </div>`);
  document.querySelectorAll('[data-start]').forEach((b) => b.addEventListener('click', () => {
    audio.start();
    const k = b.dataset.start;
    if (k === 'cont') startGame(prev, true);
    else if (k === 'new') startGame(newState(Date.now() % 100000));
    else if (k === 'v2') startGame(migrate(JSON.stringify(V2_DEMO)));
    else startGame(migrate(JSON.stringify(LEGACY_DEMO)));
  }));
}

// ───────── 輸入 ─────────
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ray = new THREE.Raycaster();
const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const ptrs = new Map();
let drag = null, pinch = null, moved = 0;
function groundAt(cx, cy) {
  const ndc = new THREE.Vector2((cx / innerWidth) * 2 - 1, -(cy / innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const p = new THREE.Vector3();
  return ray.ray.intersectPlane(ground, p) ? p : null;
}
canvas.addEventListener('pointerdown', (e) => {
  audio.start();
  canvas.setPointerCapture(e.pointerId);
  ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  moved = 0;
  if (ptrs.size === 1) drag = { start: groundAt(e.clientX, e.clientY), x: e.clientX, y: e.clientY };
  if (ptrs.size === 2) {
    const [a, b] = [...ptrs.values()];
    pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), h: view.th };
    drag = null;
  }
});
canvas.addEventListener('pointermove', (e) => {
  if (!ptrs.has(e.pointerId)) return;
  const prev = ptrs.get(e.pointerId);
  moved += Math.hypot(e.clientX - prev.x, e.clientY - prev.y);
  ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pinch && ptrs.size === 2) {
    const [a, b] = [...ptrs.values()];
    view.th = view.h = clamp(pinch.h * pinch.d / Math.max(20, Math.hypot(a.x - b.x, a.y - b.y)), LIMIT.h0, LIMIT.h1);
  } else if (drag && drag.start) {
    if (follow && moved > 8) stopFollow();
    placeCamera();
    const p = groundAt(e.clientX, e.clientY);
    if (p) {
      view.x = view.tx = clamp(view.x + drag.start.x - p.x, LIMIT.x0, LIMIT.x1);
      view.z = view.tz = clamp(view.z + drag.start.z - p.z, LIMIT.z0, LIMIT.z1);
    }
  }
});
const endPtr = (e) => {
  if (!ptrs.has(e.pointerId)) return;
  ptrs.delete(e.pointerId);
  if (ptrs.size < 2) pinch = null;
  if (ptrs.size === 0) {
    if (moved < 8 && drag) tap(e.clientX, e.clientY);
    drag = null;
  } else if (ptrs.size === 1) {
    const [p] = [...ptrs.values()];
    drag = { start: groundAt(p.x, p.y) };
  }
};
canvas.addEventListener('pointerup', endPtr);
canvas.addEventListener('pointercancel', endPtr);
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  view.th = clamp(view.th * Math.exp(e.deltaY * 0.0012), LIMIT.h0, LIMIT.h1);
}, { passive: false });
function tap(cx, cy) {
  // 先看有沒有點到人（放大時才容易點到）
  if (view.h < 110) {
    const a = pickPerson(cx, cy);
    if (a) { followAgent(a); return; }
  }
  const ndc = new THREE.Vector2((cx / innerWidth) * 2 - 1, -(cy / innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  let best = null, bd = Infinity;
  const hit = new THREE.Vector3();
  for (const [id, boxes] of Object.entries(PICK)) {
    for (const b of boxes) {
      if (ray.ray.intersectBox(b, hit)) {
        const d = hit.distanceTo(ray.ray.origin);
        if (d < bd) { bd = d; best = id; }
      }
    }
  }
  if (best === 'port') { selected = 'port'; ui.openPanel('port', true); }
  else if (best && best.startsWith('apt:')) ui.openApt(best.slice(4));
  else if (best && best.startsWith('mark:')) ui.openMark(best.slice(5));
  else if (best === 'rival') ui.openRival();
  else if (best) ui.openBiz(best);
  else ui.close();
}
const keys = new Set();
addEventListener('keydown', (e) => {
  if (e.target.closest && e.target.closest('input, textarea')) return;
  keys.add(e.key.toLowerCase());
  if (e.key === ' ') { speed = speed ? 0 : 1; e.preventDefault(); }
  if (e.key === '1') speed = 1;
  if (e.key === '2') speed = 2;
  if (e.key === '3') speed = 4;
  if (e.key === 'Escape') { if (document.getElementById('ui').classList.contains('photo')) ui.photo(false); else if (follow) stopFollow(); else ui.close(); }
});
addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
addEventListener('blur', () => keys.clear());

// ───────── 鏡頭 ─────────
function placeCamera() {
  const aspect = innerWidth / innerHeight;
  // 直式手機畫面：以寬度為準，避免左右看得太少
  const h = aspect < 0.8 ? view.h * 0.8 / aspect * 0.62 : view.h;
  camera.left = (-h * aspect) / 2;
  camera.right = (h * aspect) / 2;
  camera.top = h / 2;
  camera.bottom = -h / 2;
  camera.updateProjectionMatrix();
  camera.position.set(view.x + camDir.x * 400, camDir.y * 400, view.z + camDir.z * 400);
  camera.lookAt(view.x, 0, view.z);
  camera.updateMatrixWorld();
  return h;
}
function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  placeCamera();
}
addEventListener('resize', resize);

// ───────── 畫質 ─────────
function applyQuality() {
  const q = S.opts.quality;
  if (q === 'high') Object.assign(quality, { dpr: Math.min(devicePixelRatio, 2), shadowEvery: 1, shadows: true });
  else if (q === 'low') Object.assign(quality, { dpr: Math.min(devicePixelRatio, 1), shadowEvery: 4, shadows: false });
  else Object.assign(quality, { dpr: Math.min(devicePixelRatio, mobile ? 1.5 : 2), shadowEvery: mobile ? 2 : 1, shadows: true });
  renderer.setPixelRatio(quality.dpr);
  renderer.shadowMap.enabled = quality.shadows;
  sun.castShadow = quality.shadows;
  scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; });
  resize();
}
// 自動模式：連續 3 秒低於 47fps 就降一級
let perf = { t: 0, frames: 0, low: 0, step: 0 };
function autoQuality(dt) {
  if (S.opts.quality !== 'auto' || document.hidden) return;
  perf.t += dt;
  perf.frames++;
  if (perf.t < 1) return;
  const fps = perf.frames / perf.t;
  perf.t = 0; perf.frames = 0;
  perf.low = fps < 47 ? perf.low + 1 : 0;
  if (perf.low >= 3 && perf.step < 3) {
    perf.low = 0;
    perf.step++;
    if (perf.step === 1) quality.shadowEvery = 3;
    if (perf.step === 2) { quality.dpr = Math.max(1, quality.dpr - 0.5); renderer.setPixelRatio(quality.dpr); resize(); }
    if (perf.step === 3) { quality.shadows = false; renderer.shadowMap.enabled = false; sun.castShadow = false; scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; }); }
  }
}

// ───────── 日夜與天氣 ─────────
const C = (h) => new THREE.Color(h);
const SKY = { day: C('#62a19c'), night: C('#1b2a48') };
const SUNC = { noon: C('#fff4e2'), gold: C('#ffb36b'), moon: C('#7d98dc') };
let rainK = 0, cloudK = 0;
function lighting(dt) {
  const h = S.minute / 60;
  const w = WEATHER[S.weather.cur];
  const elev = Math.sin(((h - 6) / 13) * Math.PI); // 6 點日出、19 點日落
  const day = clamp((elev + 0.12) / 0.4, 0, 1);
  const night = 1 - day;
  rainK += ((S.weather.cur === 'rain' ? 1 : 0) - rainK) * Math.min(1, dt * 0.8);
  cloudK += ((S.weather.cur === 'cloudy' ? 0.7 : S.weather.cur === 'rain' ? 1 : S.weather.cur === 'partly' ? 0.25 : 0) - cloudK) * Math.min(1, dt * 0.8);
  // 太陽從東南東升起、往西南西落下，陰影大多落在建築背後
  const az = -0.9 + ((h - 6) / 13) * 1.8;
  const e = Math.max(0.12, elev) * 1.1;
  if (day > 0) {
    sun.position.set(view.x + Math.sin(az) * 120 * Math.cos(e), Math.sin(e) * 160 + 20, view.z + Math.cos(az) * 90 * Math.cos(e) + 30);
  } else {
    sun.position.set(view.x - 60, 140, view.z + 80);
  }
  sun.target.position.set(view.x, 0, view.z);
  const gold = clamp(1 - elev * 2.2, 0, 1) * day;
  sun.color.copy(SUNC.noon).lerp(SUNC.gold, gold).lerp(SUNC.moon, night);
  // 夜裡是偏藍的月光，亮到能投出影子（影片的夜景）
  sun.intensity = (day * 2.5 * w.light * (1 - cloudK * 0.55) + night * 0.95 * (1 - cloudK * 0.4));
  hemi.intensity = 0.55 + day * 0.95 * (1 - cloudK * 0.2);
  hemi.color.setRGB(0.92 - night * 0.52, 0.95 - night * 0.45, 1.0 - night * 0.16);
  hemi.groundColor.setRGB(0.6 - night * 0.4, 0.55 - night * 0.32, 0.45 - night * 0.06);
  scene.background.copy(SKY.day).lerp(SKY.night, night);
  const nightK = clamp(1 - day * 1.3 + cloudK * 0.2 * day, 0, 1);
  world.setNight(nightK);
  decor.setNight(nightK);
  harbor.setNight(nightK);
  sea.uniforms.uNight.value = night * 0.9;
  sea.uniforms.uRain.value = rainK;
  sea.uniforms.uCloud.value = cloudK;
  // 陰影框跟著鏡頭
  const hh = placeCamera();
  const half = clamp(hh * (innerWidth / innerHeight) * 0.75, 50, 170);
  const sc = sun.shadow.camera;
  if (sc.right !== half) {
    sc.left = -half; sc.right = half; sc.top = half; sc.bottom = -half; sc.near = 1; sc.far = 500;
    sc.updateProjectionMatrix();
  }
  rain.visible = rainK > 0.02;
  rainMat.uniforms.uA.value = rainK * 0.85;
  rainMat.uniforms.uC.value.set(view.x, 0, view.z);
  rainMat.uniforms.uR.value = hh * 1.3;
  return { day, night };
}

// ───────── 主迴圈 ─────────
const clock = new THREE.Clock();
let time = 0, frame = 0, saveT = 0, fpsSm = 60, followT = 0;
function loop() {
  const dt = Math.min(0.05, clock.getDelta());
  time += dt;
  frame++;
  fpsSm += (1 / Math.max(dt, 1e-3) - fpsSm) * 0.1;
  const gameSpeed = started ? speed : 1;
  const dMin = (dt * gameSpeed) / SEC_PER_MIN;

  // 鍵盤平移
  const kx = (keys.has('d') || keys.has('arrowright') ? 1 : 0) - (keys.has('a') || keys.has('arrowleft') ? 1 : 0);
  const kz = (keys.has('s') || keys.has('arrowdown') ? 1 : 0) - (keys.has('w') || keys.has('arrowup') ? 1 : 0);
  if (kx || kz) {
    const sp = view.h * 0.9 * dt;
    view.tx = clamp(view.tx + (kx * 0.707 + kz * 0.707) * sp, LIMIT.x0, LIMIT.x1);
    view.tz = clamp(view.tz + (-kx * 0.707 + kz * 0.707) * sp, LIMIT.z0, LIMIT.z1);
  }
  if (keys.has('q')) view.th = clamp(view.th * (1 - dt), LIMIT.h0, LIMIT.h1);
  if (keys.has('e')) view.th = clamp(view.th * (1 + dt), LIMIT.h0, LIMIT.h1);
  // 跟拍：鏡頭對準這個人（在樓上時把高度換算回地面座標）
  if (follow) {
    const a = follow.a;
    if (!a.on || a.gen !== follow.gen) { stopFollow(); ui.toast('這位客人回家了', 'eye'); }
    else if (!drag) {
      const k = (a.y + 0.9) / camDir.y;
      view.tx = a.x - camDir.x * k;
      view.tz = a.z - camDir.z * k;
      followT -= dt;
      if (followT <= 0) { followT = 0.2; ui.follow(people.describe(a), a); }
    }
  }
  // 24 小時縮時
  if (lapse && started) {
    lapse.left -= dMin;
    if (lapse.left <= 0) { lapse = null; speed = 1; ui.toast('縮時結束', 'film'); }
  }
  const k = Math.min(1, dt * 7);
  if (!drag) { view.x += (view.tx - view.x) * k; view.z += (view.tz - view.z) * k; }
  view.h += (view.th - view.h) * k;

  if (dMin > 0) handle(tick(S, dMin));
  people.update(dt, gameSpeed, dMin);
  traffic.update(dt, gameSpeed);
  sea.update(dt, time, gameSpeed);
  harbor.update(dt, gameSpeed);
  const { day } = lighting(dt);
  estate.update(dt, gameSpeed, 1 - day);

  // 選取框
  if (selected && PICK[selected]) {
    const b = PICK[selected][0];
    selBox.visible = true;
    selBox.position.set((b.min.x + b.max.x) / 2, b.min.y + (b.min.y > 0 ? 0.6 : 0.3), (b.min.z + b.max.z) / 2);
    selBox.scale.set(b.max.x - b.min.x + 0.6, 0.02 + Math.abs(Math.sin(time * 3)) * 0.25, b.max.z - b.min.z + 0.6);
  } else selBox.visible = false;

  if (quality.shadows) renderer.shadowMap.needsUpdate = frame % quality.shadowEvery === 0;
  renderer.shadowMap.autoUpdate = false;
  renderer.render(scene, camera);
  if (snap) { snap = false; canvas.toBlob((b) => b && download(b, `${stamp()}.png`), 'image/png'); }
  ui.update(dt, fpsSm);
  audio.update(dt, { beach: clamp((view.z + 10) / 40, 0, 1), port: clamp((-150 - view.x) / 60, 0, 1) * clamp((view.z + 10) / 40, 0, 1), day, rainK, speed: gameSpeed });
  autoQuality(dt);

  saveT += dt;
  if (saveT > 15) { saveT = 0; save(); }
  requestAnimationFrame(loop);
}

addEventListener('pagehide', save);
document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });

resize();
applyAll();
renderer.shadowMap.autoUpdate = false;
renderer.shadowMap.needsUpdate = true;
if (params.has('auto')) {
  // 測試與縮圖用：跳過開始畫面
  const k = params.get('auto');
  startGame(k === 'legacy' ? migrate(JSON.stringify(LEGACY_DEMO)) : k === 'v2' ? migrate(JSON.stringify(V2_DEMO)) : newState(7));
  if (k === 'legacy' || k === 'v2') { S.notice = null; ui.closeModal(); }
} else startScreen();
requestAnimationFrame(loop);

// ───────── 測試 API ─────────
window.__bf = {
  ready: true,
  get state() { return S; },
  view, camera, renderer, scene, people, sea, ui, quality, graph,
  setTime(h) { S.minute = Math.round(h * 60) % 1440; },
  setWeather(w) { if (WEATHER[w]) { S.weather.cur = w; S.weather.until = S.minute + 240; if (w === 'rain') people.clearBeach(); } },
  setSpeed(v) { speed = v; },
  look(x, z, h) { view.x = view.tx = x; view.z = view.tz = z; if (h) view.h = view.th = h; },
  give(m) { S.money += m; },
  buy(id) { return ui && buyOrUpgrade(S, id) && (applyBiz(id), S.biz[id].lv); },
  buyAll(lv = 3) { S.money += 1e9; for (const b of BIZ) while (S.biz[b.id].lv < lv && nextCost(S, b.id) !== null) buyOrUpgrade(S, b.id); applyAll(); },
  load(raw) { startGame(migrate(raw)); },
  exportSave: () => serialize(S),
  stopSaving() { started = false; },
  // 不渲染、直接推進模擬（秒）
  fast(sec, sp = 4) { const step = 1 / 30; for (let t = 0; t < sec; t += step) { const dMin = (step * sp) / SEC_PER_MIN; handle(tick(S, dMin)); people.update(step, sp, dMin); traffic.update(step, sp); sea.update(step, (time += step), sp); harbor.update(step, sp); } },
  buyPort(lv = 1) { S.money += 1e8; while (S.port.lv < lv && portNextCost(S) !== null) buyPort(S); harbor.setLevel(S.port.lv); },
  bid: (id, bid) => placeBid(S, rand, id, bid),
  bidWin(id) { const o = S.port.offers.find((x) => x.id === id) || S.port.offers[0]; return o && placeBid(S, () => 0, o.id, Math.round(o.guide * 0.8)); },
  now: () => absMin(S),
  harbor, estate, traffic,
  act: (k, ...a) => ui.act(k, ...a),
  follow(on = true) { if (on) followSomeone(); else stopFollow(); return follow && people.describe(follow); },
  photo(on = true) { ui.photo(on); },
  elevators: () => people.elevators(),
  stats: () => ({ ...harbor.stats(), fps: Math.round(fpsSm), agents: people.active(), visible: people.visible(), tris: Math.round(world.tris), calls: renderer.info.render.calls, level: empireLevel(S), ...sea.stats() }),
};
