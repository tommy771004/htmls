// ═══ 第九部曲之二：地鐵（HANDOFF「大型地景」的地鐵）═══
// 三條斜的大道（06-roads.js 的 DIAG：D2、F1、H1）穿過的廣場各有一個街上的入口（props/metro_gate.glb，johhny_3D 的 Subway Entrance V2），
// 按 E 下樓進場館 'metro'：Xlay3D 的 Subway Station & R46 Subway（props/metro.glb 的 mt_station，200 m，含兩端的隧道）。座標照原檔：
// 軌道沿 x，北側月台 x −50..20、z 2.25..6.24（地板 y 0.14），1 號軌中心 z 0、2 號軌 z −6.69，東端的出口走廊 x 16.4..20、z 6.24..9.2。
// 一班兩節 R46（mt_car，一節 25.1 m；左右車門 mt_doorL／mt_doorR 拆開來滑）每 MT_CYCLE 秒進 1 號軌停一次，開門 MT_DWELL 秒；
// 靠近開著的車門按 E 選目的地上車，車開進西邊的隧道後淡出，到站時車停好、開門下車。三站共用同一個場館，換站只重畫站名牌。
// 2 號軌每三班有一班不停站的列車開過去。以檔案開啟（或模型還沒下載好）用程式建模的替身。乘車免費；在車上不能開槍、不能換人。
const MT_PLAT = { x0: -49.6, x1: 19.6, z0: 2.25, z1: 6.24, y: .14 };
const MT_EXIT = { x0: 16.4, x1: 20, z0: 6.24, z1: 9.2 };
const MT_Z1 = 0, MT_Z2 = -6.69, MT_CAR = 25.1, MT_STOP = -15;   // 停車時兩節的中心在 −2.45 與 −27.55（車頭在 x 10.1）
const MT_DOORS = [-8.27, -2.76, 2.76, 8.27], MT_DOOR_SLIDE = .72;
const MT_IN = 9, MT_DWELL = 14, MT_OUT = 8, MT_GAP = 9, MT_CYCLE = MT_IN + MT_DWELL + MT_OUT + MT_GAP;   // 40 秒一班
const MT_RUN = 80, MT_EXP_V = 22, MT_RIDE_FADE = 60;   // 進出站在隧道裡跑 80 m；快車 22 m/s；乘車時開出 60 m 就淡出
const MT_BOARD_R = 1.7, MT_GATE_R = 2.6;
const MT_PILLARS = [-41.9, -31.2, -20.55, -9.85, .8, 11.5];
const MT_BENCHES = [[-39.5, -37.2], [-22.6, -20.1], [-5.5, -3.2], [11.4, 13.8]], MT_BINS = [-40.1, -23.1, -6.1, 10.9];
ENV.metro = { lampOn: 0, wet: 0, fogDen: .012, fog: 0x1c1e1a, fogHi: 0x262822, top: 0xb4b8aa, bot: 0x4a4c46, post: { exp: 1.02, thr: 1.8, bloom: .35, knee: 1.0, range: .85 } };

const MT = { st: 0, t: MT_IN + 2, n: 0, hold: false, ride: null, stations: [], trains: [], snd: 0 };
const mtScene = new T.Scene();
const mtData = { boxes: [], circles: [], lights: [] };

// ─── 街上的入口：每條斜大道的廣場格子裡找一塊空地（離斜線中心 HR + 5 m 左右、四周 3.4 m 內沒有別的設施），開口朝大道 ───
{
  for (const D of DIAG) {
    let best = null;
    D.cells.forEach(([ci, cj], k) => {
      const x0 = avX(ci) + HR + 3, x1 = avX(ci + 1) - HR - 3, z0 = stZ(cj) + HR + 3, z1 = stZ(cj + 1) - HR - 3, p = PLAZA.get(ci + ',' + cj);
      for (let x = x0; x <= x1; x += 2) for (let z = z0; z <= z1; z += 2) {
        const d = plazaD(x, z);
        if (d < HR + 4.5 || !free(x, z, 3.4)) continue;
        const sc = Math.abs(d - (HR + 5.5)) + Math.abs(k - (D.cells.length - 1) / 2) * 6;   // 靠大道、在中間那兩格
        if (!best || sc < best.sc) {
          const s = Math.sign((x - p.ax) * p.uz - (z - p.az) * p.ux) || 1, nx = -s * p.uz, nz = s * p.ux;   // 往斜線的方向
          best = { sc, x, z, ry: Math.atan2(nx, nz) };
        }
      }
    });
    if (!best) continue;
    claim(best.x, best.z, 3.4);
    const [cn, ...en] = district(best.x, best.z).split(' ');
    MT.stations.push({ D, x: best.x, z: best.z, ry: best.ry, zn: zoneAtL(best.x, best.z), name: cn + '站', en: `${en.join(' ')} · ${D.name}` });
  }
  // 同一區有兩站時改用大道的名字
  for (const s of MT.stations) if (MT.stations.filter(o => o.name === s.name).length > 1) s.name = s.name.replace('站', '') + ' ' + s.D.name.split(' ')[0] + '站';
}
// 物件的局部座標（開口朝 +z）→ 邏輯座標
const mtLoc = (s, lx, lz) => [s.x + lx * Math.cos(s.ry) + lz * Math.sin(s.ry), s.z - lx * Math.sin(s.ry) + lz * Math.cos(s.ry)];
const mtGates = MT.stations.map(s => {
  // 碰撞：欄杆圍出 2 × 4.4 m，用三個圓沿長邊擋住（開口那端留給人站）
  for (const lz of [-1.4, -.2, .9]) { const [x, z] = mtLoc(s, 0, lz); addCircleL({ x, z, r: 1.05 }); }
  const [ox, oz] = mtLoc(s, 0, 3.1);
  s.front = { x: ox, z: oz };   // 開口外面一點（邏輯座標）：出站的位置、E 的提示
  return s;
});
// 畫面：欄杆、燈柱與往下的黑洞（程式建模的替身），模型下載好就換掉；樓梯口的黑色蓋板兩種都留著（地面蓋住了樓梯）
{
  const k = new Kit(), kf = new Kit();
  for (const s of mtGates) {
    const yaw = s.ry, at = (lx, lz) => mtLoc(s, lx, lz);
    { const [x, z] = at(0, -.1); k.box(x, .16, z, 1.7, .02, 4.1, 0x050505, 2, 0, yaw); }
    for (const sx of [-1, 1]) {
      { const [x, z] = at(sx * .98, 0); kf.box(x, .65, z, .06, 1.0, 4.4, 0x1e4a32, 15, 0, yaw); }
      { const [x, z] = at(sx * .98, 2.2); kf.cyl(x, 1.35, z, .05, .06, 2.7, 8, 0x1e4a32, 15); kf.cyl(x, 2.75, z, .17, .17, .3, 12, 0xd8ffd0, 11); }
    }
    { const [x, z] = at(0, -2.2); kf.box(x, .65, z, 2, 1.0, .06, 0x1e4a32, 15, 0, yaw); }
  }
  if (mtGates.length) {
    cityAdd(new T.Mesh(k.build(), MAT.uber));
    const fb = new T.Mesh(kf.build(), MAT.uber); cityAdd(fb);
    if (GLB_ON) loadProps('metro_gate').then(items => {
      if (!items || !items.mt_gate) return;
      fb.removeFromParent();   // distCull 每幀重設 visible，替身要拿掉
      for (const s of mtGates) cityAdd(propObject(items.mt_gate, s.x, .15, s.z, s.ry), s.zn);
    });
    for (const s of mtGates) { const [x, z] = mtLoc(s, 0, 2.2); outLights.push({ x, y: 2.6, z, col: lin(0xc8ffd0), r: 7, i: .9 }); }
  }
}

// ─── 場館：碰撞（月台、牆、柱子、長椅、垃圾桶）與燈 ───
{
  const B = mtData.boxes, box = (x0, x1, z0, z1) => B.push({ x0, x1, z0, z1 });
  box(-80, 40, -30, MT_PLAT.z0);                 // 月台邊緣（不能走下軌道）
  box(-80, MT_PLAT.x0, -30, 30);                 // 西端牆
  box(-80, 16.3, MT_PLAT.z1, 30);                // 北牆（東端的出口走廊除外；樓梯在 x < 16.3）
  box(MT_EXIT.x1, 60, -30, 30);                  // 東端牆
  box(16.3, MT_EXIT.x1, MT_EXIT.z1, 30);         // 出口走廊底
  for (const x of MT_PILLARS) mtData.circles.push({ x, z: 3.5, r: .38 });
  for (const [x0, x1] of MT_BENCHES) box(x0, x1, 5.55, MT_PLAT.z1);
  for (const x of MT_BINS) mtData.circles.push({ x, z: 5.9, r: .36 });
  for (let x = -45; x <= 15; x += 10) mtData.lights.push({ x, y: 2.9, z: 4.4, col: lin(0xe6eef2), r: 10, i: 1.05 });
  mtData.lights.push({ x: 18.2, y: 2.9, z: 7.6, col: lin(0xfff2d8), r: 6, i: .9 });
}
// 程式建模的車站（替身）：月台、牆、天花板、軌道溝、對面月台、柱子、長椅
{
  const k = new Kit(), tile = 0xd8d4c8, wall = 0xcfcbb8;
  k.box(-15, -.5, 4.25, 70, 1.28, 4, tile, 2).box(-15, .145, 2.45, 70, .01, .4, 0xd8b830, 2);
  k.box(-15, 1.6, 6.4, 72, 3.2, .3, wall, 2).box(-15, 3.3, -1.5, 200, .3, 20, 0x3a3a38, 2);
  k.box(-15, -1.3, -3.4, 200, .2, 11.4, 0x2a2826, 2).box(-15, -.5, -10.4, 70, 1.28, 2.6, tile, 2).box(-15, 1.6, -12, 72, 3.2, .3, wall, 2);
  k.box(-15, 1.6, -4, 70, 3.2, .4, 0x9a9a94, 2);
  for (const z of [-.75, .75, -7.44, -5.94]) k.box(0, -1.12, z, 200, .12, .08, 0x6a6660, 15);
  k.box(MT_PLAT.x0 - .2, 1.6, 0, .4, 3.2, 26, wall, 2).box(20.2, 1.6, 4.5, .4, 3.2, 10, wall, 2).box(18.2, 1.6, 9.4, 4, 3.2, .3, wall, 2);
  for (const x of MT_PILLARS) k.box(x, 1.6, 3.5, .4, 3.2, .4, 0x2e5a3a, 2);
  for (const [x0, x1] of MT_BENCHES) k.box((x0 + x1) / 2, .5, 5.9, x1 - x0, .1, .5, 0x8a5a32, 2);
  for (let x = -45; x <= 15; x += 10) k.box(x, 3.05, 4.4, 1.4, .06, .25, 0xfafaff, 11);
  const fb = new T.Mesh(k.build(), MAT.uber); mtScene.add(fb);
  propSwap('metro', fb, 'mt_station', [{ x: 0, z: 0 }], mtScene, null, 'metro');
}
// 站名牌：北牆五塊、出口走廊一塊（自己的畫布，換站時重畫）
const mtSignCv = document.createElement('canvas'); mtSignCv.width = 1024; mtSignCv.height = 160;
const mtSignTex = new T.CanvasTexture(mtSignCv); mtSignTex.colorSpace = T.SRGBColorSpace; mtSignTex.anisotropy = 4;
{
  const mat = new T.MeshBasicMaterial({ map: mtSignTex, toneMapped: false }), g = new T.PlaneGeometry(3.2, .5);
  for (const x of [-44, -30, -16, -2, 9]) { const m = new T.Mesh(g, mat); m.position.set(x, 2.25, MT_PLAT.z1 - .04); m.rotation.y = Math.PI; mtScene.add(m); }
  const m = new T.Mesh(g, mat); m.position.set(MT_EXIT.x1 - .04, 2.4, 7.7); m.rotation.y = -Math.PI / 2; mtScene.add(m);
}
function mtSigns(i) {
  const c = mtSignCv.getContext('2d'), s = MT.stations[i], w = 1024, h = 160;
  c.fillStyle = '#101211'; c.fillRect(0, 0, w, h);
  c.fillStyle = '#e9ece6'; c.fillRect(0, 10, w, 3); c.fillRect(0, h - 13, w, 3);
  c.fillStyle = '#3ad06a'; c.beginPath(); c.arc(82, h / 2, 46, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#101211'; c.font = `800 56px ${FONT_C}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('N', 82, h / 2 + 3);
  c.fillStyle = '#f4f4ee'; c.textAlign = 'left'; c.font = `700 62px ${FONT_C}`; c.fillText(s ? s.name : '', 160, 66);
  c.font = `500 30px ${FONT_C}`; c.fillStyle = '#b8beb4'; c.fillText(s ? s.en : '', 162, 118);
  mtSignTex.needsUpdate = true;
}
// 列車：1 號軌兩節（停站）、2 號軌兩節（快車）。每節一個群組，替身是一個銀色箱子，模型下載好換成 R46 的車身與左右車門
function mtTrain(z) {
  const T0 = { root: new T.Group(), cars: [], x: 1e4, z, vis: false };
  for (let c = 0; c < 2; c++) {
    const g = new T.Group(), dl = new T.Group(), dr = new T.Group(), k = new Kit();
    k.box(0, 1.55, 0, MT_CAR - .3, 3.1, 3.9, 0xc8c8c4, 15).box(0, 1.4, 1.96, MT_CAR - 1, .9, .02, 0x2a3036, 15).box(0, 1.4, -1.96, MT_CAR - 1, .9, .02, 0x2a3036, 15);
    for (const d of MT_DOORS) for (const s of [-1, 1]) k.box(d, 1.3, s * 1.97, 1.5, 2.3, .03, 0x9a9a96, 15);
    const fb = new T.Mesh(k.build(), MAT.uber); g.add(fb, dl, dr);
    g.position.set(c ? -MT_CAR : 0, 0, z);   // 照原檔的高度：車輪踩在 y −1.47（軌面），車廂地板 y 0.14 和月台齊
    propSwap('metro', fb, 'mt_car', [{ x: 0, z: 0 }], g, null, 'metro');
    propSwap('metro', null, 'mt_doorL', [{ x: 0, z: 0 }], dl, null, 'metro');
    propSwap('metro', null, 'mt_doorR', [{ x: 0, z: 0 }], dr, null, 'metro');
    T0.root.add(g); T0.cars.push({ g, dl, dr });
  }
  // 車廂燈（每節兩盞，跟著車走）
  T0.lights = [-1, 1].flatMap(s => [0, 1].map(c => ({ x: 1e4, y: 2.3, z, col: lin(0xf2f6ff), r: 8, i: 0, c, s })));
  mtData.lights.push(...T0.lights);
  T0.root.visible = false; mtScene.add(T0.root);
  return T0;
}
MT.trains = [mtTrain(MT_Z1), mtTrain(MT_Z2)];
function mtPlace(T0, x, open) {
  T0.x = x; T0.root.position.x = x; T0.root.visible = T0.vis = Math.abs(x) < 140;
  for (const C of T0.cars) { C.dl.position.x = -open * MT_DOOR_SLIDE; C.dr.position.x = open * MT_DOOR_SLIDE; }
  for (const L of T0.lights) { L.x = x - L.c * MT_CAR + L.s * 6; L.i = T0.vis ? .85 : 0; }
}
// 1 號軌的週期：進站（減速）→ 停站開門 → 出站（加速）→ 空檔
const mtSm = (a, b, t) => clamp((t - a) / (b - a), 0, 1);
function mtState(t) {
  if (t < MT_IN) { const u = 1 - t / MT_IN; return { x: MT_STOP + MT_RUN * u * u, v: 2 * MT_RUN * u / MT_IN, open: 0, ph: 'in' }; }
  if (t < MT_IN + MT_DWELL) { const s = t - MT_IN; return { x: MT_STOP, v: 0, open: mtSm(.8, 1.6, s) * (1 - mtSm(MT_DWELL - 1.6, MT_DWELL - .8, s)), ph: 'stop', left: MT_DWELL - s }; }
  if (t < MT_IN + MT_DWELL + MT_OUT) { const u = (t - MT_IN - MT_DWELL) / MT_OUT; return { x: MT_STOP - MT_RUN * u * u, v: 2 * MT_RUN * u / MT_OUT, open: 0, ph: 'out' }; }
  return { x: 1e4, v: 0, open: 0, ph: 'gone' };
}
// 乘車時頂替相機（車廂裡、站在車門旁的人斜後方），下車還原
function mtCam() {
  const R = MT.ride, T0 = MT.trains[0];
  if (!R) return;
  const cx = T0.x - R.car * MT_CAR + R.door;
  camState.over = [cx - 3.6, 1.85, -1.1, cx + 1.1, 1.3, .35];
}
function mtUpdate(dt) {
  if (player.where !== 'metro') { if (MT.snd) { MT.snd = 0; sfx.trainRun(0); } return; }
  if (MT.hold && !dlg.open) MT.hold = false;
  const R = MT.ride;
  // 停站時有人在選目的地：時鐘停在關門前
  if (!(MT.hold && MT.t >= MT_IN + MT_DWELL - 2.2 && MT.t < MT_IN + MT_DWELL)) MT.t += dt;
  if (MT.t >= MT_CYCLE) { MT.t -= MT_CYCLE; MT.n++; }
  const s = mtState(MT.t), T1 = MT.trains[0];
  if (s.ph === 'in' && !MT.horn && s.x < MT_STOP + 70) { MT.horn = 1; sfx.trainHorn(.5); }
  if (s.ph === 'gone') MT.horn = 0;
  if (s.ph === 'stop' && s.open > .02 && !MT.chime) { MT.chime = 1; sfx.beep(); }
  if (s.ph !== 'stop') MT.chime = 0;
  mtPlace(T1, s.x, s.open);
  // 2 號軌的快車：每三班一班，在 1 號軌空檔的時候開過去
  const T2 = MT.trains[1], te = MT.t - (MT_IN + MT_DWELL);
  mtPlace(T2, MT.n % 3 === 1 && te > 0 ? 150 - MT_EXP_V * te : 1e4, 0);
  const near = Math.max(T1.vis ? 1 - Math.abs(T1.x - player.x) / 120 : 0, T2.vis ? 1 - Math.abs(T2.x - player.x) / 140 : 0);
  const k = clamp(R ? .55 + Math.min(1, s.v / 18) * .45 : near * Math.min(1, (T2.vis ? MT_EXP_V : s.v) / 12), 0, 1);
  sfx.trainRun(k, k > .08); MT.snd = 1;
  if (!R) return;
  // 乘車：開出 MT_RIDE_FADE m 淡出，換站、車從東邊進站；停好開門就下車
  if (R.ph === 'go' && s.ph === 'out' && MT_STOP - s.x > MT_RIDE_FADE && !fading) {
    R.ph = 'fade';
    transition(() => { mtArrive(R.dest); MT.t = 0; MT.n++; R.ph = 'arr'; mtPlace(T1, mtState(0).x, 0); camState.snap = true; });
  }
  if (R.ph === 'arr' && s.ph === 'stop' && s.open > .95) mtAlight();
}
function mtArrive(i) {
  MT.st = i; mtSigns(i);
  const s = MT.stations[i], V = VENUES.metro;
  V.name = s.name; V.dist = `地鐵 · ${s.en}`; V.door = WP(s.x, s.z, s.zn); V.out = spotW({ x: s.front.x, z: s.front.z, yaw: s.ry }, s.zn);
}
// 乘車時的玩家（40-people.js 的 updatePlayerWalk 交給這裡）：站在車門旁扶著，跟著車走
function metroRide(inp, dt) {
  const R = MT.ride, T0 = MT.trains[0];
  player.x = T0.x - R.car * MT_CAR + R.door + 1.1; player.z = .35; player.y = MT_PLAT.y; player.yaw = -Math.PI / 2; player.v = 0;
  if (player.anim !== ANIM.idle) { player.prevAnim = player.anim; player.anim = ANIM.idle; player.blend = 1; }
  player.blend = Math.max(0, player.blend - dt * 4);
  me.anim(0, ANIM.idle, -uTimeNow(), 1, 0); me.anim2(0, player.prevAnim, player.blend, 1);
  me.place(0, player.x, player.y, player.z, player.yaw); me.flush();
  mtCam();
}
function mtBoardAt() {
  const s = mtState(MT.t), T0 = MT.trains[0];
  if (s.ph !== 'stop' || s.open < .95 || s.left < 2.4 || player.z > MT_PLAT.z0 + MT_BOARD_R) return null;
  for (let c = 0; c < 2; c++) for (const d of MT_DOORS) { const x = T0.x - c * MT_CAR + d; if (Math.abs(player.x - x) < MT_BOARD_R) return { car: c, door: d }; }
  return null;
}
function mtBoard(at) {
  MT.hold = true;
  const opts = MT.stations.map((s, i) => i === MT.st ? null : { t: `${s.name}（${s.en.split(' · ')[0]}）`, fn: () => { closeDialog(); MT.hold = false; mtGo(at, i); } }).filter(Boolean);
  dialog(`地鐵 · ${MT.stations[MT.st].name}`, '往哪一站？車門快關了。', [...opts, { t: '先不搭', fn: () => { closeDialog(); MT.hold = false; } }]);
}
function mtGo(at, dest) {
  const s = mtState(MT.t);
  if (s.ph !== 'stop') { toast('車門關了，等下一班'); return; }
  gta.aiming = false; player.crouch = false; player.dance = 0;
  MT.ride = { ...at, dest, ph: 'go' };
  player.ride = { metro: 1 };
  MT.t = Math.max(MT.t, MT_IN + MT_DWELL - 1.7);   // 上車就關門開車
  MT.stats.rides++;
  toast(`往 ${MT.stations[dest].name}`);
}
function mtAlight() {
  const R = MT.ride, T0 = MT.trains[0], x = T0.x - R.car * MT_CAR + R.door;
  MT.ride = null; player.ride = null; camState.over = null; camState.snap = true;
  player.x = x; player.z = MT_PLAT.z0 + .7; player.yaw = 0; camState.yaw = 0; camState.pitch = .1;
  toast(`${MT.stations[MT.st].name} · 出口在月台東端`);
}
function metroEnter(i) {
  if (MT.ride) return;
  mtArrive(i);
  enterVenue('metro');
}
MT.stats = { rides: 0 };
VENUES.metro = { scene: mtScene, data: mtData, spawn: { x: 18.2, z: 7.6, yaw: -Math.PI / 2 }, name: '地鐵', toast: '地鐵站', dist: '地鐵', ceil: 2.95, door: { x: 0, z: 0 }, out: { x: 0, z: 0, yaw: 0 } };
if (MT.stations.length) mtArrive(0);
// 互動：街上的入口、月台上的車門、出口走廊
ctxHooks.push(() => {
  const p = player;
  if (p.mode !== 'walk' || p.ride) return null;
  if (p.where === 'out') {
    for (const [i, s] of MT.stations.entries()) {
      const [x, z] = toW(s.front.x, s.front.z, s.zn);
      if (Math.hypot(p.x - x, p.z - z) < MT_GATE_R) return { key: 'E', text: `進地鐵站 <i>· ${s.name}</i>`, fn: () => metroEnter(i) };
    }
    return null;
  }
  if (p.where !== 'metro') return null;
  if (p.x > MT_EXIT.x0 && p.z > MT_EXIT.z0) return { key: 'E', text: `出站 <i>· ${MT.stations[MT.st].name}</i>`, fn: () => exitVenue() };
  const at = mtBoardAt();
  if (at) return { key: 'E', text: '上車 <i>· 選目的地</i>', fn: () => mtBoard(at) };
  return null;
});
// 大地圖（91-map.js）
function metroBlips(add) {
  for (const s of MT.stations) add('metro', { name: s.name, txt: 'M', ...WP(s.front.x, s.front.z, s.zn), type: '地鐵站', desc: `${s.en}。下樓到月台等車（約 40 秒一班），靠近車門按 E 選目的地，免費。` });
}
gtaApi.metro = {
  MT, scene: mtScene, stations: MT.stations, state: () => mtState(MT.t), enter: i => metroEnter(i), boardAt: () => mtBoardAt(), go: (i) => { const at = mtBoardAt(); if (at) mtGo(at, i); return !!at; },
  // 驗收：時鐘直接跳到某個階段（in／stop／out），玩家擺到某節某扇門前
  phase(ph) { MT.t = ph === 'in' ? 0 : ph === 'stop' ? MT_IN + 2 : ph === 'out' ? MT_IN + MT_DWELL + .5 : MT_IN + MT_DWELL + MT_OUT + 1; },
  atDoor(c = 0, k = 1) { player.x = MT_STOP - c * MT_CAR + MT_DOORS[k]; player.z = MT_PLAT.z0 + .6; player.yaw = Math.PI; },
  PLAT: MT_PLAT, EXIT: MT_EXIT, T: { IN: MT_IN, DWELL: MT_DWELL, OUT: MT_OUT, CYCLE: MT_CYCLE },
};
