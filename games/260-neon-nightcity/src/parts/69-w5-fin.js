// ═══ 主線終章「一起跳」（plans/260-story.md）：F-1 牌桌、F-2 天台、F-3 抉擇、F-4A 交帳／F-4B 直播，片尾與結局後的世界 ═══
// F-1 用 69-v7-casino.js 的整套金庫搶劫：casNew／casGo 建好 CAS.h（不扣準備費、不開自己的 side.act），每幀在這裡推 casHeistStep，
// 任務框與地圖目標借 casAct(H) 的 hud／mark；casHeistEnd 回報 storyEv('casino')，得手的錢照原本的算（主線只發獎牌加成）。
// F-2 雙人跳：冠石頂層公寓門口外、樓頂的高度起跳（69-v3-crash.js 的 air3 'fall'），每幀把水平速度修到落進樓旁的泳池（這裡建的模型）；
// airLand 落地扣血在 storyTicks 之前，所以離池面 3 m 內就先接手（濺水、不扣血）。戴恩用 a.npc 的身體（y、anim 覆寫）跟著跳。
// F-3 對白選擇：S.flags.route 決定下一關（m.next），F-4A／F-4B 是同一個位置的兩條路（m.route），做完都接 'end'。
// F-4A 護送：開車把帳本送到灰鷺角機場，69-squads.js 的幫派追殺與 3 星警察一路攔。
// F-4B 直播：霓峰塔（69-v5-tower.js）202 m 的屋頂步行面守 3 分鐘，六星（69-police.js 的 W.six）：只有直升機上得來（storyHeliY 讓它飛在屋頂以上）。
// 片尾：字幕（#stCred）在玩家還能動的時候跑完；結局後的世界（storyEnding）每次走完都照最後一次選的設定：A 消星、報案慢一點，B 名氣滿格、通緝海報、報案快一點。
// 排在 69-w4-ch5.js 之後、70-render.js 之前：post、camState、keys 只能在函式裡用。

// ─── 地點 ───
const ST_ALLEY = () => ({ ...VENUES.bar.out, yaw: VENUES.bar.out.yaw || 0 });   // AFTERGLOW 後巷（賭場搶劫的交貨點）
const ST_LOFT = () => APT.loft && APT.loft.doorW ? { ...APT.loft.doorW, yaw: 0 } : ST_CROWN();   // 冠石頂層公寓的大樓門口
const ST_BEACH = () => spotW({ x: avX(4) + 12, z: SHORE_Z + 10, yaw: Math.PI });   // 珊瑚灘：棧橋東邊的沙灘
const ST_JET = () => ST_DROP(-150, 0);   // 灰鷺角機場：聯邦專機停的草地旁
const ST_TGATE = () => { const t = towerSite(); return { x: t.gx, z: t.gz, yaw: 0 }; };   // 霓峰塔西面的空地
const finDeck = () => CR.on ? CR_DECK : 0;
// 霓峰塔屋頂上的一點（從大樓西牆往裡 dx、從中線往 dz）
function towerRoof(dx = 0, dz = 0) {
  if (!CR.on) { const p = ST_TGATE(); return { x: p.x + dx, z: p.z + dz, y: groundH(p.x, p.z), yaw: 0 }; }
  const Tw = CR.F.tower, cz = (Tw.z0 + Tw.z1) / 2, [x, z] = toW(Tw.x0 + 5 + dx, cz + dz), [ex, ez] = toW(Tw.x0 + 20, cz);
  return { x, z, y: CR_DECK, yaw: Math.atan2(ex - x, ez - z) };
}

// ─── F-1 金庫 ───
function casAsk(a, c) {
  c.ask = 0;
  const C = v7KS();
  if (!CAS_TGT[C.tgt]) { C.tgt = Object.keys(CAS_TGT)[Math.floor(Math.random() * 4)]; saveMotors(); }
  const T0 = CAS_TGT[C.tgt];
  dialog('計畫板 · 霓鑽賭場金庫', `金庫今天放的是 ${T0.name}（約 ${money(T0.val)}），帳本的正本也在裡面。\n準備費奧帝斯出了，挑一條路線。`,
    Object.entries(CAS_APPS).map(([id, A]) => ({ t: `${id} · ${A.name}（金庫 ${A.time} 秒）`, fn: () => { closeDialog(); casStory(a, c, id); } })));
}
function casStory(a, c, app) {
  if (c.H || !side.act || side.act !== a) return;
  v7KS().app = app; saveMotors(); sfx.pickup();
  const H = c.H = a.casH = casNew(app);
  c.A = casAct(H);
  casGo(H);
}
STEP.casino = {
  start: (a, s, c) => { a.casOn = 1; a.casC = c; c.ask = 0; if (!CASX.on) { c.end = c.ok = true; return; } casAsk(a, c); },
  step: (a, s, c, dt) => {
    if (!c.end && !c.H) { if (!dlg.open && (c.ask += dt) > .6) casAsk(a, c); return false; }
    if (!c.end && CAS.h === c.H) { casHeistStep(c.H, dt); if (c.H.alarm) a.casAlarm = true; return false; }
    if (!c.ok) { storyFail(a, c.H && !c.H.bag.val ? '金庫什麼都沒拿到' : '霓鑽賭場的搶劫失敗了'); return false; }
    return !$('heistDone').classList.contains('on');
  },
  hud: (a, s, c) => c.A && CAS.h === c.H ? c.A.hud() : { text: s.text, bar: -1 },
  mark: (a, s, c) => c.A && CAS.h === c.H ? c.A.mark() : null,
  skip: (a, s, c) => {
    if (!c.H && CASX.on) { if (dlg.open) closeDialog(); casStory(a, c, 'A'); }
    const H = c.H; if (!H || CAS.h !== H) { c.end = c.ok = true; return; }
    H.bag.val = CAS_TGT[H.tgt].val; H.daily = true; if (player.where !== 'out') { setWhere('out'); const o = casDrop(); player.x = o.x; player.z = o.z; }
    casHeistEnd(true); $('heistDone').classList.remove('on');
  },
};
storyCleanups.push(a => { if (a.casOn) { a.casOn = 0; a.casC = null; if (CAS.h) casHeistEnd(false); gpsClear(); } });

// ─── F-2 雙人跳 ───
// 起跳點：頂層公寓的陽台，在大樓碰撞盒的外牆上、樓頂往下一層，挑朝著泳池那一面（陽台下面要是空的，不能貼著隔壁的屋頂）。
// 泳池先找隔壁比較矮的樓頂（8×6 m 的池子整片放得下、夠平），找不到才退回樓外 14–56 m 的空地（不在樓裡、推不動、不在水裡、不在車道上）。
// 跳過去的拋物線每公尺量一次，不能碰到別的屋頂（屋頂的高度圖在這一帶有破洞，所以樓的範圍用碰撞盒，不用高度圖找外牆）
const finRoad = (x, z) => { const p = rnProject(x, z, 16); return onRoad(x, z) || !!p && p.d < 7; };   // 車道上（離路中心 7 m 內）
const POOL_W = 4.3, POOL_D = 3.2, POOL_WY = .62, POOL_STAND = 1.15;   // 池子外緣的半寬、半深；水面離池底座的高度；站在池裡時腳在水面下多深
const BALC_DOWN = 3.2, BALC_OUT = 1;   // 陽台樓板比樓頂低一層；起跳點離外牆 1 m（樓板中間）
function loftBox(D) {
  let best = null, bh = -1;
  for (const b of boxesNear(D.x, D.z, 8)) {
    const x0 = b.bx0 ?? b.x0, x1 = b.bx1 ?? b.x1, z0 = b.bz0 ?? b.z0, z1 = b.bz1 ?? b.z1;
    if (Math.max(x0 - D.x, D.x - x1, z0 - D.z, D.z - z1) > 4) continue;
    const h = roofH((x0 + x1) / 2, (z0 + z1) / 2);
    if (h > bh) { bh = h; best = { x0, x1, z0, z1, top: h }; }
  }
  return best;
}
// 這一點的屋頂高度：高度圖和「蓋住這一點的碰撞盒中心的屋頂」取高的（高度圖有破洞的地方靠碰撞盒補）
function boxRoof(x, z) {
  let h = roofH(x, z);
  for (const b of boxesNear(x, z, 1)) if (boxGap(b, x, z) <= 0) h = Math.max(h, roofH(((b.bx0 ?? b.x0) + (b.bx1 ?? b.x1)) / 2, ((b.bz0 ?? b.z0) + (b.bz1 ?? b.z1)) / 2));
  return h;
}
function leapPlan() {
  const D = ST_LOFT(), g0 = groundH(D.x, D.z), B = loftBox(D);
  const cx = B ? (B.x0 + B.x1) / 2 : D.x, cz = B ? (B.z0 + B.z1) / 2 : D.z;
  const top = Math.max(B ? B.top : roofH(D.x, D.z), g0 + 24);
  const yb = top - BALC_DOWN, y0 = yb + 1.1;   // 踩在欄杆上跳出去
  // 四面外牆上每 2.5 m 一個可以放陽台的點：外面 4 m 內都比陽台低 2 m 以上
  const starts = [];
  if (B) for (const [nx, nz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const along = nx ? [B.z0, B.z1] : [B.x0, B.x1], fx = nx > 0 ? B.x1 : nx < 0 ? B.x0 : 0, fz = nz > 0 ? B.z1 : nz < 0 ? B.z0 : 0;
    for (let u = along[0] + 2.5; u <= along[1] - 2.5; u += 2.5) {
      const x = nx ? fx + nx * BALC_OUT : u, z = nz ? fz + nz * BALC_OUT : u;
      let ok = true; for (let d = 0; d <= 4 && ok; d += 1) ok = boxRoof(x + nx * d, z + nz * d) < yb - 2;
      if (ok) starts.push({ x, z, nx, nz });
    }
  }
  if (!starts.length) starts.push({ x: D.x, z: D.z, nx: -Math.sin(D.yaw || 0), nz: -Math.cos(D.yaw || 0), none: true });
  // 離泳池最近、而且泳池在陽台外面那一側的起跳點
  const pick = (bx, bz) => { let s = null, sd = 1e9; for (const q of starts) { const dx = bx - q.x, dz = bz - q.z, d = Math.hypot(dx, dz); if ((dx * q.nx + dz * q.nz) / (d || 1) > .25 && d < sd) { sd = d; s = q; } } return s; };
  const clear = (S, bx, bz, by, vy0 = 4) => {
    const T0 = (vy0 + Math.sqrt(vy0 * vy0 + 19.6 * (y0 - by))) / 9.8;
    const du = 1 / Math.max(12, Math.hypot(bx - S.x, bz - S.z));   // 每公尺量一次，樓的邊緣才不會從兩個取樣點之間漏掉
    for (let u = du; u < .96; u += du) { const t = u * T0, y = y0 + vy0 * t - 4.9 * t * t; if (boxRoof(S.x + (bx - S.x) * u, S.z + (bz - S.z) * u) > y - 1.2) return false; }   // 腳離屋頂至少 1.2 m
    return true;
  };
  // 池子四角再往外 1 m 都要在同一片屋頂上（不貼著屋緣、不壓到水塔冷氣機）
  const flat = (bx, bz, yaw, by) => {
    const c = Math.cos(yaw), s = Math.sin(yaw);
    for (const [u, v] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, -1], [0, 1], [-1, 0], [1, 0]]) {
      const lx = u * (POOL_W + 1), lz = v * (POOL_D + 1);
      if (Math.abs(roofH(bx + lx * c + lz * s, bz - lx * s + lz * c) - by) > .3) return false;
    }
    return true;
  };
  const R0 = B ? Math.hypot(B.x1 - B.x0, B.z1 - B.z0) / 2 : 0;
  let best = null;
  for (let r = R0 + 12; r <= R0 + 70 && !best; r += 2) for (let j = 0, n = Math.ceil(Math.PI * r / 1.5); j <= 2 * n && !best; j++) {   // 從大樓中心往外一圈一圈找，每 1.5 m 一個點
    const t = j * 1.5 / r, bx = cx + Math.sin(t) * r, bz = cz + Math.cos(t) * r, by = roofH(bx, bz), g = groundH(bx, bz);
    if (by < g + 8 || by > yb - 18 || by < g0 + 8) continue;   // 至少低 18 m：要看得出是從高處跳下去
    const S = pick(bx, bz); if (!S) continue;
    if (flat(bx, bz, Math.atan2(bx - S.x, bz - S.z), by)) for (const v of [4, 6]) if (!best && clear(S, bx, bz, by + POOL_WY, v)) best = { S, bx, bz, by, vy0: v, roof: true };   // 隔著一棟樓：跳高一點越過去
  }
  colY = 0;
  for (let r = R0 + 6; r <= R0 + 50 && !best; r += 3) for (let j = 0, n = Math.ceil(Math.PI * r / 3); j <= 2 * n && !best; j++) {
    const t = j * 3 / r, bx = cx + Math.sin(t) * r, bz = cz + Math.cos(t) * r, by = groundH(bx, bz);
    if (Math.abs(by - g0) > 2 || roofH(bx, bz) > by + .5 || waterDepth(bx, bz) > 0 || finRoad(bx, bz)) continue;
    const q = collideCircle(bx, bz, 3.4, false);
    if (Math.hypot(q.x - bx, q.z - bz) > .05) continue;
    const S = pick(bx, bz); if (S && clear(S, bx, bz, by)) best = { S, bx, bz, by };
  }
  if (!best) { const S = starts[0], bx = S.x + S.nx * 16, bz = S.z + S.nz * 16; best = { S, bx, bz, by: groundH(bx, bz) }; }
  const S = best.S;
  return { ex: S.x, ez: S.z, ix: -S.nx, iz: -S.nz, yb, y0, vy0: 4, roof: false, balc: !S.none, ...best, wy: best.by + POOL_WY, yaw: Math.atan2(best.bx - S.x, best.bz - S.z) };
}
// 落水之後走到樓下：泳池那棟樓旁邊、不在樓裡、推不動的人行道
function leapStreet(L) {
  colY = 0;
  for (let r = 6; r <= 48; r += 2) for (let k = 0; k < 16; k++) {
    const t = k / 16 * Math.PI * 2, x = L.bx + Math.sin(t) * r, z = L.bz + Math.cos(t) * r, g = groundH(x, z);
    if (roofH(x, z) > g + .5 || waterDepth(x, z) > 0 || finRoad(x, z)) continue;
    const q = collideCircle(x, z, .8, false);
    if (Math.hypot(q.x - x, q.z - z) < .05) return { x, z, y: g, yaw: Math.atan2(x - L.bx, z - L.bz) };
  }
  return { x: L.ex, z: L.ez, y: groundH(L.ex, L.ez), yaw: L.yaw };
}
// 頂層公寓的陽台：樓板從外牆伸出 2 m、三面玻璃欄杆，盆栽靠牆（從前面的欄杆上跳出去）
function finBalcony(L) {
  const k = new Kit();
  k.box(0, -.12, 0, 3.6, .24, 2, 0xb9b3a8, 2);                                   // 樓板（混凝土）
  k.box(0, -.3, 0, 3.4, .12, 1.8, 0x2a2c2e, 2);                                  // 樓板下緣的陰影線
  for (const [x, z, sx, sz] of [[0, .95, 3.6, .04], [1.78, 0, .04, 1.9], [-1.78, 0, .04, 1.9]]) {
    k.box(x, .52, z, sx, 1, sz, 0x9fb8c0, 1);                                      // 玻璃欄杆
    k.box(x, 1.05, z, sx + .04, .06, sz + .04, 0x6e7276, 3);                       // 不鏽鋼扶手
  }
  k.box(-1.1, .45, -.55, .6, .9, .6, 0x2f3a2c, 2).box(-1.1, 1.1, -.55, .9, .5, .9, 0x3d5a34, 2);   // 盆栽
  const m = new T.Mesh(k.build(), MAT.uber);
  m.position.set(L.ex, L.yb, L.ez); m.rotation.y = Math.atan2(-L.ix, -L.iz); scene.add(m);
  return m;
}
function finPool(L) {
  const k = new Kit(), STONE = 0xcfc8b8, DECK = 0x6b5848, W = POOL_WY;
  k.box(0, .06, 0, 10.6, .12, 8.4, DECK, 2);                                   // 木棧板平台
  k.box(0, (W - .06) / 2, 0, 8.6, W - .06, 6.4, STONE, TX.tile);                // 池子外壁（石材，凸出屋頂）；頂面比水面低，不和水面搶同一個平面
  k.box(0, W - .03, 0, 7.4, .02, 5.2, 0x08303d, 11);                            // 水面：入夜被池底燈照成暗青色（不是整片亮青）
  for (const [x, z, sx, sz] of [[0, 2.9, 8.8, .64], [0, -2.9, 8.8, .64], [4, 0, .64, 5.2], [-4, 0, .64, 5.2]]) k.box(x, W + .03, z, sx, .14, sz, 0xe8e2d4, 2);   // 池緣壓頂（蓋住水面到外壁之間）
  // 水下燈從水面透出來的光斑：沿著長邊的池壁一排，由外往內一層比一層亮
  for (const x of [-2.4, 0, 2.4]) for (const z of [-2.2, 2.2]) {
    const zi = z * .97;
    k.box(x, W - .016, zi, 1.2, .004, .7, 0x0c4352, 11).box(x, W - .01, zi, .8, .004, .46, 0x13606f, 11).box(x, W - .004, z * 1.04, .4, .004, .2, 0x2a8c9c, 11);
  }
  for (const sx of [-1, 1]) {   // 兩張躺椅（棧板上、池子後面）
    k.box(sx * 1.6, .32, 3.75, .7, .1, 1.5, 0xf2efe8, 10).box(sx * 1.6, .55, 4.4, .7, .46, .08, 0xf2efe8, 10, -.5);
    for (const dz of [-.6, .6]) k.box(sx * 1.6, .18, 3.75 + dz, .62, .14, .05, 0x3a3836, 15);
  }
  for (const [x, z] of [[-5, -4], [5, -4], [-5, 4], [5, 4]]) k.box(x, .5, z, .1, .76, .1, 0x2a2c2e, 15).box(x, .92, z, .18, .1, .18, 0xffd9a0, 11);   // 棧板四角的矮燈
  const m = new T.Mesh(k.build(), MAT.uber); m.position.set(L.bx, L.by, L.bz); m.rotation.y = L.yaw; scene.add(m);
  return m;
}
function poolSplash(x, y, z, k = 1) {
  const n = Math.round((LOW ? 10 : 22) * k);
  for (let i = 0; i < n; i++) { const t = Math.random() * 6.3, s = (.6 + Math.random() * 1.8) * k; emit('spray', x, y + .3, z, { vx: Math.cos(t) * s, vy: 3 + Math.random() * 3.5 * k, vz: Math.sin(t) * s, max: 1.2, s0: .16, s1: .45 * k + .1, grav: 9.5, drag: .6, a: .65, c: [.75, .82, .88] }); }
  sfx.splash(1);
}
// 上樓：打完樓下的人進頂層公寓（69-safehouse.js 的 loft 場館，任務裡沒買也進得去），按 E 沿旋轉樓梯上夾層，走到西側欄杆的窗邊（陽台在窗外）；
// 一樓的西面落地窗前有沙發擋著，夾層的西北角有弧形欄杆，兩層都走不到玻璃邊，窗邊的點取夾層走得到、離玻璃最近的地方。
// 室內：戴恩跟著玩家走過的路（不用尋路，也不會穿過家具）；進門 LOFT_IN 秒後霍爾的三個人從大門進來，一樓照格子 BFS 走到樓梯口、沿踏階上夾層，
// 看得到就開槍（場館的座標，69-combat.js 的 shoot 在 'loft' 交給 loftShot）；戴恩也會還擊。時間到就破門（任務失敗）
const LOFT_WIN = { x: -1.9, z: -2.4 }, LOFT_T = 60, LOFT_IN = 7, LOFT_FOES = 3;
const loftCrowd = crowd(1 + LOFT_FOES);
// 一樓的格子路徑：0.25 m 格、離牆與家具 0.35 m，從大門走到樓梯口
function loftPath(fx, fz, tx, tz) {
  const D = VENUES.loft.lvs[0], G = .25, X0 = -3.9, Z0 = -3.9, NX = 56, NZ = 40, R = .35;
  const free = (x, z) => !D.boxes.some(b => !b.low && x > b.x0 - R && x < b.x1 + R && z > b.z0 - R && z < b.z1 + R) && !D.circles.some(c => Math.hypot(x - c.x, z - c.z) < c.r + R);
  const cell = (x, z) => [Math.round((x - X0) / G), Math.round((z - Z0) / G)], at = (i, j) => [X0 + i * G, Z0 + j * G];
  const ok = new Uint8Array(NX * NZ); for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) ok[j * NX + i] = free(...at(i, j)) ? 1 : 0;
  const near = (x, z) => { let b = -1, bd = 1e9; for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) if (ok[j * NX + i]) { const [px, pz] = at(i, j), d = Math.hypot(px - x, pz - z); if (d < bd) { bd = d; b = j * NX + i; } } return b; };
  const s0 = near(fx, fz), s1 = near(tx, tz), prev = new Int32Array(NX * NZ).fill(-1), q = [s0]; prev[s0] = s0;
  for (let h = 0; h < q.length && prev[s1] < 0; h++) { const c = q[h], i = c % NX, j = (c / NX) | 0; for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) { const a = i + di, b = j + dj, n = b * NX + a; if (a < 0 || b < 0 || a >= NX || b >= NZ || !ok[n] || prev[n] >= 0 || di && dj && (!ok[j * NX + a] || !ok[b * NX + i])) continue; prev[n] = c; q.push(n); } }
  if (prev[s1] < 0) return [[fx, 0, fz], [tx, 0, tz]];
  const pts = []; for (let c = s1; ; c = prev[c]) { const [x, z] = at(c % NX, (c / NX) | 0); pts.unshift([x, 0, z]); if (c === s0) break; }
  return pts.filter((p, i) => i % 3 === 0 || i === pts.length - 1);
}
// 沿折線 P（[x, y, z]…）走 d 公尺的位置與方向
function loftAlong(P, d) {
  for (let i = 1; i < P.length; i++) { const [ax, ay, az] = P[i - 1], [bx, by, bz] = P[i], L = Math.hypot(bx - ax, bz - az, by - ay); if (d <= L || i === P.length - 1) { const u = L ? Math.min(1, d / L) : 1; return { x: ax + (bx - ax) * u, y: ay + (by - ay) * u, z: az + (bz - az) * u, yaw: Math.atan2(bx - ax, bz - az), end: i === P.length - 1 && d >= L }; } d -= L; }
  const e = P[P.length - 1]; return { x: e[0], y: e[1], z: e[2], yaw: 0, end: true };
}
function loftOn(a) {
  const scn = APT.loft.scn; if (!scn) return;
  const L = a.loftK = { trail: [[5.5, 0, 4.6], [APT.loft.spawn.x, 0, APT.loft.spawn.z]], dane: { x: 5.5, y: 0, z: 4.6, yaw: Math.PI, d: 0 }, foes: [], t: 0 };
  scn.add(loftCrowd.mesh);
  loftCrowd.look(0, castLook(0, 'dane'));
  const R = rng(4404), up = APT.loft.up.path, door = APT.loft.spawn, foot = up[0];
  for (let i = 0; i < LOFT_FOES; i++) {
    loftCrowd.look(i + 1, { r: R, top: 0x1c1e22, bot: 0x16171a, female: false, glowI: 0 });
    L.foes.push({ i: i + 1, hp: 100, st: 'wait', at: LOFT_IN + i * 1.6, d: 0, x: door.x, y: 0, z: door.z, yaw: Math.PI, shotT: 1 + R(), c: { x: 0, z: -99, r: .32 }, lv: 0 });
  }
  // 大門 → 樓梯口（一樓 BFS）→ 踏階 → 夾層上停在樓梯頂往窗邊推進兩公尺
  const top = up[up.length - 1];
  L.path = [...loftPath(door.x, door.z - .6, foot[0], foot[2]), ...up, [top[0] - 1.2, top[1], top[2] - .2], [top[0] - 2.2, top[1], top[2] - .4]];
  a.npc.dane = L.dane;   // 對白（say）找得到戴恩
  loftCrowd.flush();
}
function loftOff(a) {
  const L = a.loftK; if (!L) return;
  for (const f of L.foes) for (const lv of VENUES.loft.lvs) { const k = lv.circles.indexOf(f.c); if (k >= 0) lv.circles.splice(k, 1); }
  loftCrowd.mesh.removeFromParent();
  if (a.npc.dane === L.dane) delete a.npc.dane;
  a.loftK = null;
}
// 敵人的碰撞圓放在他所在的那一層（樓梯上的不擋）
function loftCirc(f, lv) {
  if (f.lv === lv) return;
  for (const L of VENUES.loft.lvs) { const k = L.circles.indexOf(f.c); if (k >= 0) L.circles.splice(k, 1); }
  f.lv = lv; if (lv >= 0 && f.st !== 'down') VENUES.loft.lvs[lv].circles.push(f.c);
}
function loftStep(a, dt) {
  const L = a.loftK; if (!L || player.where !== 'loft') return;
  const live = !say.on;   // 窗邊對話的時候大家先停著（不然對白中被打）
  if (live) L.t += dt;
  const P = player, py = P.y, Lt = L.trail, last = Lt[Lt.length - 1];
  if (Math.hypot(P.x - last[0], P.z - last[2], py - last[1]) > .25) { Lt.push([P.x, py, P.z]); if (Lt.length > 400) Lt.shift(); }
  // 戴恩：沿玩家走過的路，落後 1.6 m
  let tot = 0; for (let i = 1; i < Lt.length; i++) tot += Math.hypot(Lt[i][0] - Lt[i - 1][0], Lt[i][2] - Lt[i - 1][2], Lt[i][1] - Lt[i - 1][1]);
  const D = L.dane, want = Math.max(0, tot - 1.6), step = Math.min(Math.max(0, want - D.d), dt * 5.5), q = loftAlong(Lt, D.d += step);
  const mv = step / Math.max(dt, 1e-4);
  D.x = q.x; D.y = q.y; D.z = q.z; if (mv > .3) D.yaw = q.yaw; else D.yaw += wrapA(Math.atan2(P.x - D.x, P.z - D.z) - D.yaw) * Math.min(1, dt * 4);
  // 霍爾的人
  let tgt = null, td = 14;
  for (const f of L.foes) {
    if (f.st === 'down') continue;
    if (f.st === 'wait') { if (L.t < f.at) { loftCrowd.place(f.i, 0, -60, 0, 0); continue; } f.st = 'go'; sfx.boom && sfx.boom(2); if (f.i === 1) toast('大門被撞開了 · 霍爾的人進來了'); }
    const dx = P.x - f.x, dz = P.z - f.z, d = Math.hypot(dx, dz, py - f.y), stairs = f.d > 0 && f.y > .2 && f.y < APT.loft.up.y - .2;
    if (f.st === 'go' && live) {
      const q2 = loftAlong(L.path, f.d += dt * (d < 9 ? 1.9 : 3.2));
      f.x = q2.x; f.y = q2.y; f.z = q2.z; f.yaw = q2.yaw;
      loftCirc(f, f.y < .2 ? 0 : f.y > APT.loft.up.y - .2 ? 1 : -1);
      if (q2.end) f.st = 'hold';
    }
    if (f.st === 'hold' || d < 9 && !stairs) f.yaw = Math.atan2(dx, dz);
    loftCrowd.anim(f.i, f.st === 'go' && live && !(d < 9 && !stairs) ? ANIM.run : ANIM.aimIdle, f.i * 1.7, 1, 0);
    if (live && !stairs && d < 16 && !life.dead && (f.shotT -= dt) <= 0) {
      f.shotT = .8 + Math.random() * .6;
      sfx.gun(.6, 1); muzzleFx(f.x + Math.sin(f.yaw) * .5, f.y + 1.4, f.z + Math.cos(f.yaw) * .5, .6);
      if (Math.random() < (P.crouch ? .22 : .32) * (d < 6 ? 1.4 : 1)) hurtPlayer(7, f.x, f.z);
    }
    f.c.x = f.x; f.c.z = f.z;
    loftCrowd.place(f.i, f.x, f.y, f.z, f.yaw);
    const dd = Math.hypot(f.x - D.x, f.z - D.z, f.y - D.y); if (dd < td && !stairs) { td = dd; tgt = f; }
  }
  // 戴恩還擊：最近、不在樓梯上的那個
  if (live && tgt && (L.dShot = (L.dShot ?? 1.2) - dt) <= 0) {
    L.dShot = 1 + Math.random() * .5; D.yaw = Math.atan2(tgt.x - D.x, tgt.z - D.z);
    sfx.gun(.7, 1); muzzleFx(D.x + Math.sin(D.yaw) * .5, D.y + 1.4, D.z + Math.cos(D.yaw) * .5, .6);
    if (Math.random() < .4) loftHit(tgt, 34, D.x, D.z);
  }
  loftCrowd.anim(0, say.on ? ANIM.talk : tgt ? ANIM.aimIdle : mv > 3 ? ANIM.run : mv > .3 ? ANIM.walk : ANIM.idle, .7, 1, 0);
  loftCrowd.place(0, D.x, D.y, D.z, D.yaw);
  loftCrowd.flush();
}
function loftHit(f, dmg, fx, fz) {
  if (f.st === 'down') return;
  if (f.st === 'wait') return;
  f.hp -= dmg;
  if (f.hp > 0) return;
  f.st = 'down'; loftCirc(f, -1);
  loftCrowd.anim(f.i, ANIM.die, -uTimeNow(), 1); loftCrowd.place(f.i, f.x, f.y, f.z, Math.atan2(f.x - fx, f.z - fz));
}
// 69-combat.js 的 shoot：在頂層公寓開槍（場館座標，射線只算霍爾的人）
function loftShot(R, dmg) {
  const L = side.act && side.act.loftK; if (!L) return;
  let best = null, bt = 40;
  for (const f of L.foes) if (f.st === 'go' || f.st === 'hold') { const t = rayCyl(R, f.x, f.z, .34, f.y + .1, f.y + 1.95); if (t < bt) { bt = t; best = f; } }
  if (best) loftHit(best, dmg * (R.oy + R.dy * bt - best.y > 1.55 ? 2.5 : 1), player.x, player.z);
}
storyTicks.push((a, dt) => loftStep(a, dt));
storyCleanups.push(a => loftOff(a));
STEP.loft = {
  start: (a, s, c) => {
    c.t = LOFT_T; c.wait = true;
    a.leapPre = leapPlan();   // 還在樓下時先算好跳的路線：進了室內，玩家座標是場館自己的，附近的建築與碰撞盒會照那個位置串流，量不到這棟樓
    if (player.mode === 'drive') exitVehicle();
    aptLevel('loft', 0); player.ride = null; aptLoad('loft');
    enterVenue('loft', () => { c.wait = false; loftOn(a); toast('他們在樓下了 · 上夾層，到西側的窗邊'); });
  },
  step: (a, s, c, dt) => {
    if (c.wait || fading) return false;
    if (player.where !== 'loft') { storyFail(a, '離開了公寓'); return false; }
    if ((c.t -= dt) <= 0) { storyFail(a, '霍爾的人破門進來了'); return false; }
    return VENUES.loft.lv === 1 && !player.ride && Math.hypot(player.x - LOFT_WIN.x, player.z - LOFT_WIN.z) < 1.2;
  },
  hud: (a, s, c) => ({ text: VENUES.loft.lv ? '走到西側的窗邊，陽台在窗外' : s.text, bar: -1, num: `${Math.max(0, Math.ceil(c.t))} 秒`, low: c.t < 15 }),
  mark: () => { const P = APT.loft.up.path[0]; return VENUES.loft.lv ? { name: '窗邊', x: LOFT_WIN.x, y: APT.loft.up.y + 1.4, z: LOFT_WIN.z, where: 'loft' } : { name: '樓梯', x: P[0], y: 1.6, z: P[2], where: 'loft' }; },
  skip: () => { if (player.where !== 'loft') return; player.ride = null; aptLevel('loft', 1); player.x = LOFT_WIN.x; player.y = APT.loft.up.y; player.z = LOFT_WIN.z; },
};
STEP.leap = {
  start: (a, s, c) => {
    if (a.pal < 0) palOn(a, DANE);   // 從檢查點重來：第一步的 palOn 沒跑
    const L = a.leap = a.leapPre || leapPlan(); a.leapPre = null;   // 從檢查點重來時人在樓下門口（storyStart 會帶回任務起點），當場算
    if (a.poolM) { scene.remove(a.poolM); a.poolM.geometry.dispose(); }
    a.poolM = finPool(L);
    if (a.balcM) { scene.remove(a.balcM); a.balcM.geometry.dispose(); }
    a.balcM = L.balc ? finBalcony(L) : null;
    c.wait = true;
    transition(() => {
      if (player.mode === 'drive') exitVehicle();
      loftOff(a);   // 室內的戴恩與霍爾的人收掉（a.npc.dane 是場館座標，出去前要拿掉）
      setWhere('out'); cardOff();
      player.x = L.ex; player.z = L.ez; player.y = L.y0; player.yaw = camState.yaw = L.yaw; camState.pitch = .7; camState.snap = true; player.down = 0;   // 鏡頭在頭頂上往下看：看得到泳池，也不會卡在背後那棟樓裡（跳傘鏡頭不拉近）
      player.air3 = { kind: 'fall', vx: 0, vy: L.vy0, vz: 0, t: 0, land: { y: L.wy + .2, fn: () => a.leapGo && leapSplash(a, a.leapGo) } };
      a.leapGo = { ...L, t: 0 }; a.leapDone = 0; slowmo.st = .45;
      sfx.swoosh && sfx.swoosh(false);
      c.wait = false;
    });
  },
  step: (a, s, c) => !c.wait && !fading && (a.leapDone || !a.leapGo && !a.leapHold && !player.air3),
  hud: (a, s) => ({ text: a.leapGo ? `${s.text} · F 開傘也可以` : s.text, bar: -1, num: a.leapGo ? `${Math.max(0, Math.round(player.y - a.leapGo.wy))} m` : '' }),
  mark: a => a.leap && !a.leapHold ? { name: '泳池', x: a.leap.bx, y: a.leap.wy + 2, z: a.leap.bz, where: 'out' } : null,
  skip: a => { const L = a.leapGo || a.leapHold; if (!L) return;
    player.air3 = null; chute.visible = false; slowmo.st = 1; const q = leapStreet(L);
    player.x = q.x; player.z = q.z; player.y = q.y; player.v = 0; delete a.npc.dane; a.leapGo = a.leapHold = null; a.leapDone = 1; leapBoxOff(a); },
};
// 落水：沒扣血，濺起水花。在池裡站一下，再黑場帶到樓下的街上
function leapSplash(a, L) {
  a.leapMiss = +Math.hypot(player.x - L.bx, player.z - L.bz).toFixed(2);
  player.air3 = null; chute.visible = false;
  player.x = L.bx; player.z = L.bz; player.y = L.wy - POOL_STAND; player.v = 0; player.down = 0; player.anim = -1; player.vig = 0;
  poolSplash(L.bx, L.wy, L.bz, 1.4); poolSplash(L.bx + Math.cos(L.yaw) * 1.2, L.wy, L.bz - Math.sin(L.yaw) * 1.2, 1);
  camState.shake = .5; slowmo.st = 1; camState.yaw = L.yaw + .4; camState.pitch = .6;   // 斜上方看下來：池子、兩個人都在畫面裡
  const rx = Math.cos(L.yaw), rz = -Math.sin(L.yaw);
  a.npc.dane = { x: L.bx + rx * 1.3, y: L.wy - POOL_STAND, z: L.bz + rz * 1.3, yaw: L.yaw };
  // 樓的碰撞盒沒有高度：站在屋頂上時鏡頭會被那棟樓拉到頭上。踩水這段暫時給盒子一個樓頂高度（和 69-v5-civic.js 的 hy 一樣）
  a.leapBox = L.roof ? boxesNear(L.bx, L.bz, 4).filter(b => b.hy === undefined && boxGap(b, L.bx, L.bz) <= 0) : [];
  for (const b of a.leapBox) b.hy = L.by;
  a.leapGo = null; a.leapHold = { ...L, t: 0 };
  toast('落進泳池了 · 快走');
}
function leapOut(a) {
  const L = a.leapHold; if (!L || L.out) return;
  L.out = 1;
  transition(() => {
    const q = leapStreet(L);
    player.x = q.x; player.z = q.z; player.y = q.y; player.yaw = camState.yaw = q.yaw; player.v = 0;
    delete a.npc.dane; a.leapHold = null; a.leapDone = 1; leapBoxOff(a);
  });
}
function leapBoxOff(a) {
  for (const b of a.leapBox || []) delete b.hy;
  a.leapBox = null;
}
storyTicks.push((a, dt) => {
  const H = a.leapHold;
  if (H) {   // 池子裡站 1.4 秒，水到胸口（推擠、步行面都不管，固定在水裡）
    player.x = H.bx; player.z = H.bz; player.y = H.wy - POOL_STAND; player.v = 0;
    me.place(0, player.x, player.y, player.z, player.yaw); me.flush();   // 步行那段已經照地面往下拉過一次了，重新擺回池裡
    if ((H.t += dt) > 1.4) leapOut(a);
    return;
  }
  const L = a.leapGo; if (!L) return;
  L.t += slowmo.raw;
  if (L.t > 1.6 && slowmo.st < 1) slowmo.st = 1;
  const A = player.air3;
  if (!A) { leapSplash(a, L); return; }   // 開傘落地或撞到東西：一樣算進泳池
  const h = player.y - L.wy, dx = L.bx - player.x, dz = L.bz - player.z;
  const tr = Math.max(.02, (A.vy + Math.sqrt(Math.max(0, A.vy * A.vy + 19.6 * Math.max(0, h)))) / 9.8);
  if (A.kind !== 'chute') { A.vx = dx / tr; A.vz = dz / tr; }
  // 戴恩在羅莎右手邊，牽著手一起掉
  const rx = Math.cos(player.yaw), rz = -Math.sin(player.yaw);
  a.npc.dane = { x: player.x + rx * 1.1, y: player.y, z: player.z + rz * 1.1, yaw: player.yaw, anim: ANIM.swimIdle };
  if (h < Math.max(1.2, -A.vy * .06)) leapSplash(a, L);
});
storyCleanups.push(a => {
  if (a.leapGo) { a.leapGo = null; if (player.air3) { player.air3 = null; chute.visible = false; player.y = groundH(pX(), pZ()); } }
  if (a.leapHold) { a.leapHold = null; player.y = groundH(pX(), pZ()); }
  leapBoxOff(a);
  if (a.poolM) { scene.remove(a.poolM); a.poolM.geometry.dispose(); a.poolM = null; }
  if (a.balcM) { scene.remove(a.balcM); a.balcM.geometry.dispose(); a.balcM = null; }
  if (slowmo.st < 1) slowmo.st = 1;
});

// ─── F-3 抉擇 ───
STEP.choose = {
  start: (a, s, c) => { c.ask = 0; finAsk(c); },
  step: (a, s, c, dt) => { if (c.pick) return true; if (!dlg.open && (c.ask += dt) > .6) finAsk(c); return false; },
  hud: () => ({ text: '帳本交給誰？', bar: -1 }),
  skip: (a, s, c) => { if (dlg.open) closeDialog(); c.pick = S.flags.route = S.flags.route || 'A'; },
};
function finAsk(c) {
  c.ask = 0;
  const go = r => { closeDialog(); c.pick = S.flags.route = r; saveMotors(); toast(r === 'A' ? '交帳：把帳本送到灰鷺角機場的聯邦專機' : '直播：帶著帳本攻上霓峰塔頂'); };
  dialog('抉擇 · 帳本交給誰？', '交給范斯：換到豁免，霍爾被捕，但史塔林全身而退。\n交給泰倫斯：在霓峰塔頂直播，史塔林下台，但你們永遠是逃犯。\n走完一種結局，可以從手機的「主線任務」重玩這一關，改走另一條路。', [
    { t: 'A · 交給范斯（交帳）', fn: () => go('A') },
    { t: 'B · 交給泰倫斯（直播）', fn: () => go('B') },
  ]);
}

// ─── F-4A 護送 ───
// 開車送到目標（STEP.go 的條件），路上沒有追兵就每 30 秒再叫兩台
STEP.run = {
  start: (a, s, c) => { c.chT = 0; },
  step: (a, s, c, dt) => {
    if (!SQ.chase && player.mode === 'drive' && (c.chT += dt) > 30) { c.chT = 0; gangChase('story', 2); }
    return STEP.go.step(a, s, c);
  },
  hud: (a, s, c) => STEP.go.hud(a, s, c),
  mark: (a, s, c) => STEP.go.mark(a, s, c),
  skip: (a, s, c) => { const q = tgtOf(c), o = player.mode === 'drive' ? player.veh : player; o.x = q.x; o.z = q.z; },
};
storyCleanups.push(a => { if (a.chaseOn) { a.chaseOn = 0; if (SQ.chase) chaseEnd(true); } });
// 聯邦專機：tools/props.mjs 的 fin_jet（Bombardier Global 7500，長 33.8 m，原檔機頭朝 +z），停在跑道與滑行道之間的草地（21-air.js 的機場座標），
// 機頭朝東、對著交帳點（ST_JET 在機頭前 13 m）；滑行道上有起降循環的客機在跑，所以不停在滑行道上。碰撞是 30-vehicles.js 的 dynMore 圓（機身三個、兩翼各一個），
// 任務收尾收掉。只在 http(s) 下載；以檔案開啟沒有替身，只有碰撞
const JET_OFF = 30;   // 機身中心在 ST_JET 西邊幾公尺
function finJet(a) {
  if (a.jet || !AIR_L) return;
  const R = AIR_L.rwy, lx = (R.x0 + R.x1) / 2 - 150 - JET_OFF, lz = R.z - 45, [X, Z] = airW(lx, lz), [ux, uz] = dirW(AIR_ZN, 1, 0), [vx, vz] = dirW(AIR_ZN, 0, 1);
  const g = new T.Group(); g.position.set(X, 0, Z); g.rotation.y = Math.PI / 2 + AIR_YAW; scene.add(g);
  const dyn = [[-12, 0, 2.1], [0, 0, 2.1], [12, 0, 1.6], [-2, 9, 1.4], [-2, -9, 1.4]].map(([u, v, r]) => ({ x: X + ux * u + vx * v, z: Z + uz * u + vz * v, r }));   // 機頭在 +u（東）
  dynMore.push(...dyn);
  a.jet = { g, dyn };
  if (GLB_ON) loadProps('fin_jet').then(it => { if (it && it.fin_jet && a.jet && a.jet.g === g) g.add(propObject(it.fin_jet, 0, 0, 0, 0)); }).catch(e => console.warn('fin_jet', e));
}
// 交帳之後：范斯走到機門登機，專機從草地沿 S 形的路線上跑道（機場座標的三次貝茲曲線，頭尾都朝東），加速、抬頭、爬升到 50 m 以上。
// 碰撞圓跟著機身移動，離地就拿掉；玩家站在原地看（鏡頭自己控制），也可以跳過
const JET_DOOR = [10.2, 2.4];   // 機門：機身座標（u 往機頭、v 往左側），在 ST_JET 那一側
function jetPath(a) {
  const R = AIR_L.rwy, lx = (R.x0 + R.x1) / 2 - 150 - JET_OFF, lz = R.z - 45;
  const B = [[lx, lz], [lx + 60, lz], [lx + 60, R.z], [lx + 120, R.z]], pts = [];
  for (let i = 0; i <= 24; i++) { const t = i / 24, u = 1 - t, w = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t]; pts.push([w.reduce((s, k, j) => s + k * B[j][0], 0), 0, w.reduce((s, k, j) => s + k * B[j][1], 0)]); }
  pts.push([R.x1 - 40, 0, R.z]);
  return pts;
}
function jetPose(a, J) {
  const q = loftAlong(J.path, J.s), q2 = loftAlong(J.path, J.s + 4), [X, Z] = airW(q.x, q.z), [X2, Z2] = airW(q2.x, q2.z), g = a.jet.g;
  g.position.set(X, J.y, Z); g.rotation.order = 'YXZ'; g.rotation.set(-J.pitch, Math.atan2(X2 - X, Z2 - Z), 0);
  const fx = Math.sin(g.rotation.y), fz = Math.cos(g.rotation.y);
  if (J.y > 2.5) { for (const c of a.jet.dyn) { const i = dynMore.indexOf(c); if (i >= 0) dynMore.splice(i, 1); } return; }
  [[-12, 0], [0, 0], [12, 0], [-2, 9], [-2, -9]].forEach(([u, v], i) => { const c = a.jet.dyn[i]; c.x = X + fx * u + fz * v; c.z = Z + fz * u - fx * v; });
}
STEP.jet = {
  start: (a, s, c) => {
    if (!a.jet) finJet(a);
    const g = a.jet.g, fx = Math.sin(g.rotation.y), fz = Math.cos(g.rotation.y), [u, v] = JET_DOOR;
    c.door = { x: g.position.x + fx * u + fz * v, z: g.position.z + fz * u - fx * v };
    c.ph = 'board'; c.J = { path: jetPath(a), s: 0, v: 0, y: 0, pitch: 0 };
    if (!a.npc.vance) a.npc.vance = nearL(ST_JET(), 3, .8, -Math.PI / 2);
  },
  step: (a, s, c, dt) => {
    if (!a.jet) return true;
    const J = c.J;
    if (c.ph === 'board') {   // 范斯走到機門、上去
      const V = a.npc.vance, dx = c.door.x - V.x, dz = c.door.z - V.z, d = Math.hypot(dx, dz);
      if (d < .4) { delete a.npc.vance; c.ph = 'taxi'; toast('范斯上了專機 · 帳本跟著他走'); return false; }
      const k = Math.min(d, dt * 2.4) / d; V.x += dx * k; V.z += dz * k; V.yaw = Math.atan2(dx, dz); V.anim = ANIM.run; V.ph = 0;
      return false;
    }
    if (c.ph === 'taxi') { J.v = Math.min(18, J.v + dt * 4); if (J.s > 140) { c.ph = 'roll'; toast('專機轉上跑道 · 全推力'); } }
    else if (c.ph === 'roll') { J.v += dt * 5; if (J.v > 62) { c.ph = 'climb'; sfx.swoosh && sfx.swoosh(false); } }
    else { J.v += dt * 2; J.pitch = Math.min(.2, J.pitch + dt * .12); J.y += dt * J.v * Math.sin(J.pitch); }
    J.s += dt * J.v;
    jetPose(a, J);
    return J.y > 55;
  },
  hud: (a, s, c) => ({ text: c.ph === 'board' ? '范斯登機' : '目送專機起飛', bar: -1, num: c.J && c.J.v > 1 ? `${Math.round(c.J.v * 3.6)} km/h` : '' }),
  mark: (a, s, c) => a.jet ? { name: '聯邦專機', x: a.jet.g.position.x, y: a.jet.g.position.y + 6, z: a.jet.g.position.z, where: 'out' } : null,
  skip: (a, s, c) => { delete a.npc.vance; c.ph = 'climb'; c.J.y = 60; },
};
storyCleanups.push(a => { if (!a.jet) return; a.jet.g.removeFromParent(); for (const c of a.jet.dyn) { const i = dynMore.indexOf(c); if (i >= 0) dynMore.splice(i, 1); } a.jet = null; });

// ─── F-4B 直播 ───
const UP_T = 180;   // 上傳要 3 分鐘
function rigMesh(p) {
  const k = new Kit();
  k.box(0, .3, 0, .9, .6, .55, 0x1c1e22, 2).box(0, .62, 0, .92, .04, .57, 0x3a3c40, 2);   // 器材箱
  k.box(0, .82, -.12, .62, .36, .03, 0x0e1014, 2, -.3).box(0, .82, -.105, .56, .3, .01, 0x9fd8ff, 16, -.3);   // 筆電螢幕
  for (let i = 0; i < 3; i++) { const t = i / 3 * Math.PI * 2; k.box(1.2 + Math.sin(t) * .35, .75, Math.cos(t) * .35, .04, 1.55, .04, 0x2a2c2e, 2, Math.cos(t) * .22, 0, -Math.sin(t) * .22); }   // 腳架
  k.box(1.2, 1.55, 0, .28, .2, .34, 0x16181a, 2).box(1.2, 1.55, .2, .14, .14, .08, 0x2a3440, 2);   // 攝影機
  k.cyl(-.9, .95, 0, .03, .03, 1.9, 6, 0x8a8c90, 2).cyl(-.9, 1.95, 0, .42, .06, .14, 16, 0xd8d8d4, 2, .5);   // 衛星天線
  k.box(.32, .66, .2, .08, .06, .08, 0xff3a2a, 9);   // 直播中的紅燈
  const m = new T.Mesh(k.build(), MAT.uber); m.position.set(p.x, p.y, p.z); m.rotation.y = p.yaw; scene.add(m);
  return m;
}
STEP.lift = {
  start: (a, s, c) => {
    if (a.pal < 0) palOn(a, DANE);
    c.wait = true;
    transition(() => {
      if (player.mode === 'drive') exitVehicle();
      loftOff(a);   // 室內的戴恩與霍爾的人收掉（a.npc.dane 是場館座標，出去前要拿掉）
      setWhere('out'); cardOff();
      const p = towerRoof(0, 0), r = towerRoof(3.5, -3);
      player.x = p.x; player.z = p.z; player.y = p.y + .05; player.yaw = camState.yaw = p.yaw; camState.snap = true; player.v = 0;
      a.noPal = 1;
      if (!a.rig) a.rig = { ...r, m: rigMesh(r) };
      a.npc.dane = { ...towerRoof(2.4, 1.8), yaw: p.yaw + Math.PI };
      life.armor = 100;
      for (const id of ['rpg', 'rifle']) if (arm.ammo[id]) arm.ammo[id].res = Math.max(arm.ammo[id].res, ARMS[id].mag * 4);
      c.wait = false;
    });
  },
  step: (a, s, c) => !c.wait && !fading,
  hud: () => ({ text: '工地升降機一路往上……', bar: -1 }),
};
// 塔頂的步兵：霍爾的人從塔吊那頭的直梯一波一波爬上來（69-squads 的 fy／area：站在樓板上、關在屋頂範圍裡）
const ROOF_WAVE = 30, ROOF_MAX = 3;
function roofArea(x, z) {
  const Tw = CR.F.tower, [lx, lz] = toL(x, z);
  const [wx, wz] = toW(clamp(lx, Tw.x0 + 1.2, Tw.x1 - 1.2), clamp(lz, Tw.z0 + 1.2, Tw.z1 - 1.2));   // Tw 是邏輯座標（和 towerRoof 一樣）
  return { x: wx, z: wz };
}
function roofFoes(a) { return SQ.f.filter(f => fUp(f) && f.grp === a && f.fy != null); }
function roofWave(a, n) {
  const R = a.rig;
  for (let i = 0; i < n; i++) {
    const q = towerRoof(15 + i * 1.5, (i % 2 ? -1 : 1) * (3 + i)), f = fSpawn('gang', q.x, q.z, R ? Math.atan2(R.x - q.x, R.z - q.z) : 0, { gun: i % 2 ? 'smg' : 'rifle', esc: true });
    if (!f) continue;
    Object.assign(f, { x: q.x, z: q.z, fy: CR_DECK, area: roofArea, grp: a, calm: false });
  }
  toast('霍爾的人從直梯爬上來了');
}
STEP.stream = {
  start: (a, s, c) => { c.p = 0; c.wave = ROOF_WAVE * .6; a.helis = a.helis || 0; a.streamOn = 1; W.six = 1; wantedApi.set(6); toast('直播開始 · 全城都看到了 · 六星通緝'); equip('rpg', true); },
  step: (a, s, c, dt) => {
    const R = a.rig, on = R && Math.hypot(pX() - R.x, pZ() - R.z) < 14 && Math.abs(player.y - R.y) < 3;
    c.on = on;
    if (on) c.p += dt / UP_T;
    const h = W.heli;
    if (h && h.fall && !h.cnt) { h.cnt = 1; a.helis++; toast(`打下第 ${a.helis} 架直升機`); }
    if (W.stars < 6 && !life.dead) { W.six = 1; wantedApi.set(6); }
    if (CR.on && (c.wave -= dt) <= 0) { c.wave = ROOF_WAVE; const n = Math.min(2, ROOF_MAX - roofFoes(a).length); if (n > 0) roofWave(a, n); }
    if (c.p >= 1) { a.streamOn = 0; for (const f of roofFoes(a)) fHit(f, 999, 0, 1, false); return true; }   // 上傳完成：塔頂剩下的人投降（倒下）
    return false;
  },
  hud: (a, s, c) => ({ text: c.on ? `${s.text}${W.heli && !W.heli.fall ? ' · 直升機來了' : ''}` : '回到直播器材旁邊（14 m 內）', bar: c.p * 100, num: `${Math.floor(c.p * 100)}%`, low: !c.on }),
  mark: a => a.rig ? { name: '直播器材', x: a.rig.x, y: a.rig.y + 2, z: a.rig.z, where: 'out' } : null,
  skip: (a, s, c) => { c.p = 1; },
};
// 69-police.js 的 heliStep：直播時直升機至少飛在屋頂以上 16 m
function storyHeliY() { const a = side.act; return a && a.kind === 'story' && a.streamOn ? finDeck() + 16 : 0; }
// 從塔頂下來（跳下去開傘、或爬直梯）
STEP.down = {
  step: (a, s, c) => player.where === 'out' && !player.air3 && (player.mode === 'drive' || player.y - groundH(pX(), pZ()) < 3),
  hud: (a, s) => ({ text: player.air3 ? (player.air3.kind === 'fall' ? '自由落體 · F 或空白鍵開傘' : s.text) : s.text, bar: -1, num: `${Math.max(0, Math.round(player.y - groundH(pX(), pZ())))} m` }),
  skip: () => { player.air3 = null; chute.visible = false; const p = ST_TGATE(); player.x = p.x; player.z = p.z; player.y = groundH(p.x, p.z); player.down = 0; },
};
storyCleanups.push(a => {
  a.streamOn = 0; a.noPal = 0;
  if (a.rig) { scene.remove(a.rig.m); a.rig.m.geometry.dispose(); a.rig = null; }
});

// ─── 片尾字幕（玩家還能動，字幕在畫面上方一組一組換） ───
const CRED_T = 3.6;
const cred = { on: false, rows: [], i: -1, t: 0 };
{ const el = document.createElement('div'); el.id = 'stCred'; el.setAttribute('aria-live', 'polite'); el.innerHTML = '<small></small><b></b><span></span>'; $('hud').append(el); }
function credRows(end) {
  return [
    ['霓虹夜城 · 主線', '一手爛牌', ''],
    ['主演', '羅莎·伊巴拉', '戴恩·默瑟'],
    ['家人', '盧佩·伊巴拉', '羅莎的母親'],
    ['街坊與同夥', '奧帝斯　凱爾　賈克斯', '塞拉斯　娜迪亞　泰倫斯'],
    ['反派', '霍爾副局長', '維多莉亞·史塔林'],
    ['紀念', '霍利斯與朵蒂', '錨灣港船廠'],
    [end === 'A' ? '結局 A' : '結局 B', end === 'A' ? '交帳' : '直播', end === 'A' ? '霍爾被捕，史塔林全身而退' : '史塔林下台，兩人成了城裡的傳說'],
    ['', '城市是你的', '手機的「主線任務」可以重玩每一關，F-3 可以改走另一條路'],
  ];
}
function credShow() {
  const el = $('stCred'), r = cred.rows[cred.i];
  el.querySelector('small').textContent = r[0]; el.querySelector('b').textContent = r[1]; el.querySelector('span').textContent = r[2];
  el.classList.add('on');
}
function credOff() { cred.on = false; cred.i = -1; $('stCred').classList.remove('on'); }
STEP.credits = {
  start: (a, s, c) => { Object.assign(cred, { on: true, rows: credRows(s.end), i: 0, t: 0 }); credShow(); },
  step: (a, s, c, dt) => {
    if (!cred.on) return true;
    cred.t += slowmo.raw;
    const k = Math.floor(cred.t / CRED_T);
    if (k !== cred.i) {
      if (k >= cred.rows.length) { credOff(); return true; }
      cred.i = k; credShow();
    } else if (cred.t - k * CRED_T > CRED_T - .7) $('stCred').classList.remove('on');   // 換下一組前先淡出
    return false;
  },
  hud: () => ({ text: '片尾 · 城市是你的', bar: -1 }),
  skip: () => { credOff(); },
};
storyCleanups.push(() => { if (cred.on) credOff(); });

// ─── 結局後的世界 ───
// 每次走完 F-4A／F-4B 都照這一次的結局設定（重玩 F-3 選另一條路，世界跟著換）
function storyEnding(end) {
  const F = S.flags;
  F.end = end; F.route = end;
  Object.assign(S.cast, { dane: 1, vance: 1, kael: 1, jax: 1 });
  if (end === 'A') { wantedClear('reset'); newsAdd('第九分局副局長霍爾遭聯邦逮捕', '聯邦檢察官手上有一本帳。天際置業發言人：「與本公司無關。」'); }
  else { F.fame = 100; newsAdd('天際置業大樓遭查封，史塔林宣布辭職', '一段三分鐘的直播轉傳了四百萬次。直播的兩人仍在通緝中。'); }
  saveMotors(); posterSync();
}
// 69-police.js 的 crime：路人報警到派車的秒數（第九分局換了人慢一點；兩人上了通緝海報就快一點）
function storyRepT() { return !S ? 3 : S.flags.end === 'B' ? 1.5 : S.flags.end === 'A' ? 4 : 3; }
// 結局 B 的通緝海報：玩家附近 PST_R 內的號誌桿與路燈桿，每根包一到三張紙（弧面貼著桿子）。牆面不貼：模型建築的碰撞面和畫面上的牆
// 差到一兩公尺（櫥窗退縮、鷹架），貼上去不是藏在牆裡就是浮在半空；桿子的位置與粗細是確定的。每根桿子用自己的亂數，走遠再回來還是同樣幾張。
// 紙照日光與路燈打光（shade），晚上不會自己亮
const PST_N = 700, PST_R = 300, PST_K = 4;
const pstCv = document.createElement('canvas'); pstCv.width = 512 * PST_K; pstCv.height = 736;
{
  const c = pstCv.getContext('2d', { willReadFrequently: true }); let x0c = 0; const F = (w, px) => `${w} ${px}px "PingFang TC","Heiti TC","Noto Sans CJK TC",system-ui,sans-serif`;
  const mug = (x, y, w, h, seed, hair) => {   // 半色調印出來的嫌犯照：身高刻度的背板、頭肩的剪影
    const R = rng(seed);
    c.fillStyle = '#b9b2a2'; c.fillRect(x, y, w, h);
    c.strokeStyle = 'rgba(40,36,30,.35)'; c.lineWidth = 2;
    for (let k = 1; k < 8; k++) { const yy = y + h * k / 8; c.beginPath(); c.moveTo(x, yy); c.lineTo(x + w * (k % 2 ? .18 : .1), yy); c.stroke(); }
    const cx = x + w * (.48 + R() * .04), hy = y + h * .4, hw = w * .2;
    c.fillStyle = '#4a443c';
    c.beginPath(); c.ellipse(cx, y + h * 1.02, w * .46, h * .3, 0, Math.PI, 0); c.fill();                  // 肩
    c.fillRect(cx - hw * .42, hy + hw * .9, hw * .84, h * .25);                                             // 脖子
    c.beginPath(); c.ellipse(cx, hy, hw, hw * 1.28, 0, 0, Math.PI * 2); c.fill();                           // 頭
    c.fillStyle = '#2a2622';
    if (hair) { c.beginPath(); c.ellipse(cx, hy - hw * .35, hw * 1.12, hw * 1.05, 0, Math.PI, 0); c.fill(); c.fillRect(cx - hw * 1.12, hy - hw * .4, hw * .5, h * .42); c.fillRect(cx + hw * .62, hy - hw * .4, hw * .5, h * .42); }
    else { c.beginPath(); c.ellipse(cx, hy - hw * .55, hw * 1.02, hw * .7, 0, Math.PI, 0); c.fill(); }
    c.fillStyle = 'rgba(232,224,204,.55)';                                                                   // 網點：亮的地方點大
    const D = c.getImageData(x0c + x, y, w, h).data;   // 先讀整塊再點（邊點邊讀會讀到剛點上去的）
    for (let yy = 3; yy < h; yy += 6) for (let xx = 3 + (yy / 6 % 2) * 3; xx < w; xx += 6) { const d = D[((yy | 0) * w + (xx | 0)) * 4] / 255; c.beginPath(); c.arc(x + xx, y + yy, .6 + d * 2.1, 0, Math.PI * 2); c.fill(); }
    c.strokeStyle = '#1c1814'; c.lineWidth = 3; c.strokeRect(x, y, w, h);
  };
  for (let k = 0; k < PST_K; k++) {
    const x0 = x0c = k * 512, W = 512, H = 736;
    c.save(); c.beginPath(); c.rect(x0, 0, W, H); c.clip(); c.translate(x0, 0);
    c.fillStyle = '#ebe4d2'; c.fillRect(0, 0, W, H);
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = '#9a2a22'; c.font = F(900, 104); c.fillText('通　緝', W / 2, 78);
    c.fillStyle = '#1c1814'; c.fillRect(36, 138, W - 72, 4); c.font = F(600, 24); c.fillText('第九分局 · 刑事案件 2026-0417', W / 2, 166);
    const duo = k === 0 || k === 3;
    if (duo) {
      mug(40, 196, 206, 250, 11, 1); mug(266, 196, 206, 250, 23, 0);
      c.fillStyle = '#1c1814'; c.font = F(800, 36); c.fillText('羅莎·伊巴拉', 143, 482); c.fillText('戴恩·默瑟', 369, 482);
      c.font = F(500, 21); c.fillStyle = '#3a3028'; c.fillText('女 · 約 30 歲 · 黑長髮', 143, 516); c.fillText('男 · 約 35 歲 · 左臂刺青', 369, 516);
    } else {
      const rosa = k === 1;
      mug(106, 196, 300, 296, rosa ? 11 : 23, rosa);
      c.fillStyle = '#1c1814'; c.font = F(800, 46); c.fillText(rosa ? '羅莎·伊巴拉' : '戴恩·默瑟', W / 2, 532);
      c.font = F(500, 22); c.fillStyle = '#3a3028'; c.fillText(rosa ? '女 · 約 30 歲 · 黑長髮 · 身高 168' : '男 · 約 35 歲 · 左臂刺青 · 身高 183', W / 2, 570);
    }
    c.fillStyle = '#9a2a22'; c.font = F(900, 58); c.fillText(duo ? '懸賞 $1,000,000' : '懸賞 $500,000', W / 2, duo ? 594 : 628);
    c.fillStyle = '#3a3028'; c.font = F(600, 22); c.fillText('持有武器，切勿自行接近', W / 2, duo ? 648 : 676); c.fillText('見到請立即撥打第九分局專線', W / 2, duo ? 680 : 706);
    if (k === 3) {   // 被人用紅漆噴了字（直播轉傳之後，街上有人站在他們那邊）
      c.save(); c.translate(W * .52, H * .42); c.rotate(-.22); c.strokeStyle = 'rgba(196,30,36,.9)'; c.lineWidth = 20; c.lineCap = 'round'; c.lineJoin = 'round';
      c.font = F(900, 170); c.fillStyle = 'rgba(196,30,36,.86)'; c.fillText('英雄', 0, 0);
      c.lineWidth = 9; c.beginPath(); c.moveTo(-190, 96); c.quadraticCurveTo(0, 130, 196, 84); c.stroke(); c.restore();
    }
    c.restore();
  }
}
const pstTex = new T.CanvasTexture(pstCv); pstTex.colorSpace = T.SRGBColorSpace; pstTex.anisotropy = 8;
const pstMat = new T.ShaderMaterial({ name: 'poster', uniforms: { ...shared(ALLU), tP: { value: pstTex } }, side: T.DoubleSide });
gfxLate.push(pstMat);   // 02-gfx.js：結局 B 才掛上物件，產生 TSL 時要另外轉
// 包在半徑 R 的桿子上、弧長 w、高 h 的紙（正中朝 +z）；離桿面 6 mm
function pstWrap(R, w, h) {
  const g = new T.BufferGeometry(), P = [], Nn = [], UV = [], I = [], S = 14, r = R + .006, th = w / r;
  for (let i = 0; i <= S; i++) { const u = i / S, a = (u - .5) * th, sx = Math.sin(a), cz = Math.cos(a); for (const v of [0, 1]) { P.push(sx * r, (v - .5) * h, cz * r); Nn.push(sx, 0, cz); UV.push(u, v); } }
  for (let i = 0; i < S; i++) { const k = i * 2; I.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
  g.setAttribute('position', new T.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(Nn, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(UV, 2)); g.setIndex(I);
  return g;
}
// 號誌桿：20-props.js 的 sigBuild 錐形柱（y .47 半徑 .165 → y 6.42 半徑 .118，沒有換模型）；路燈：程式建模的錐形柱（約 .095），換成 w1_grc 的模型後是 .053
const PST_POLE = { sig: { R0: .156, w: .32, rAt: y => .165 - (y - .47) / 5.95 * .047 }, lamp: { R0: .06, w: .27, rAt: () => W2.swapped.includes('lamps') ? .053 : .095 } };
const pst = { m: {}, n: 0, at: null, lamps: null };
const _pd = new T.Object3D();
function pstBuild(cx, cz) {
  const out = { sig: [], lamp: [] };
  // 一根桿子：P 是世界座標，face 是朝人行道的方向（弧度，世界座標的 yaw）；亂數照桿子的位置
  const pole = (kind, X, Z, face, chance) => {
    if (Math.hypot(X - cx, Z - cz) > PST_R || out[kind].length >= PST_N) return;
    const R = rng(Math.round(X * 10) * 73856093 ^ Math.round(Z * 10) * 19349663), cnt = R() < chance ? 1 + (R() < .45) + (R() < .2) : 0, gy = groundH(X, Z), off = R() * 6.28;
    for (let k = 0; k < cnt; k++) {
      const y = 1.35 + R() * .55 + (k === 2 ? .5 : 0), yaw = face + (k === 0 ? (R() - .5) * 1.2 : k === 1 ? Math.PI * (.55 + R() * .5) + off * .1 : -Math.PI * (.5 + R() * .4));
      out[kind].push({ x: X, z: Z, y: gy + y, yaw, k: PST_POLE[kind].rAt(y) / PST_POLE[kind].R0, kind: (R() * 4) | 0, s: R(), age: R() });
    }
  };
  for (const s of signals) {
    const [X, Z] = s.zn ? toW(s.x, s.z, s.zn) : [s.x, s.z], n = s.node, [NX, NZ] = s.zn ? toW(avX(n.i), stZ(n.j), s.zn) : [n.x, n.z];
    pole('sig', X, Z, Math.atan2(X - NX, Z - NZ), .8);   // 朝路口外（站在街角等紅燈的人看得到）
  }
  for (const L of [lampsA, lampsS]) for (const l of L) {
    const [X, Z] = toW(l.x, l.z, l.zn), [HX, HZ] = L === lampsA ? toW(l.hx, l.z, l.zn) : toW(l.x, l.hz, l.zn);
    pole('lamp', X, Z, Math.atan2(X - HX, Z - HZ), .5);   // 燈臂伸向車道，紙貼在背面（人行道那側）
  }
  pst.n = 0;
  for (const kind of ['sig', 'lamp']) {
    const P = PST_POLE[kind], L = out[kind];
    let m = pst.m[kind];
    if (!m) {
      m = pst.m[kind] = new T.InstancedMesh(pstWrap(P.R0, P.w, P.w * 1.44), pstMat, PST_N);
      m.geometry.setAttribute('aP', new T.InstancedBufferAttribute(new Float32Array(PST_N * 4), 4));
      m.userData.noTess = 1; scene.add(m);
    }
    const A = m.geometry.attributes.aP;
    L.forEach((p, i) => { _pd.position.set(p.x, p.y, p.z); _pd.rotation.set(0, p.yaw, 0); _pd.scale.set(p.k, 1, p.k); _pd.updateMatrix(); m.setMatrixAt(i, _pd.matrix); A.setXYZW(i, p.kind, p.s, p.age, 0); });
    m.count = L.length; pst.n += L.length; m.instanceMatrix.needsUpdate = true; A.needsUpdate = true; m.computeBoundingSphere();
  }
  pst.at = [cx, cz]; pst.lamps = PST_POLE.lamp.rAt(0);
}
// 每幀（storyUpdate）：結局 B 才貼；走離上次貼的中心 90 m，或路燈換成模型（桿子變細）就重貼
function posterTick() {
  const on = !!(S && S.flags.end === 'B'), out = player.where === 'out';
  for (const m of Object.values(pst.m)) m.visible = on && out;
  if (!on || !out) return;
  const x = pX(), z = pZ();
  if (!pst.at || Math.hypot(x - pst.at[0], z - pst.at[1]) > 90 || pst.lamps !== PST_POLE.lamp.rAt(0)) pstBuild(x, z);
}
function posterSync() { pst.at = null; posterTick(); }

// ─── 手機的「主線任務」：重玩做過的任務 ───
function storyPhoneRows() {
  if (!S) return [];
  const rows = ORDER.filter(id => MS[id] && isDone(id)).map(id => {
    const m = MS[id], md = S.medal[id];
    return { t: `${m.id}「${m.title}」`, sub: `${CHAPTER[m.ch][0]} · ${m.star ? '★'.repeat(m.star) : '劇情'}${md != null && m.bonus.length ? ` · ${MEDAL[md].name}` : ''}`, val: '重玩', ok: !side.act, fn: () => { closePhone(); const b = storyBusy(); if (b) { toast(b); return; } storyCard(m); } };
  });
  const nx = storyNext();
  return [...(nx ? [{ t: `下一關：${nx.id}「${nx.title}」`, sub: `${storyWhere(nx)} · 走到地圖上的起點按 E`, val: '', ok: true, fn: () => { const p = nx.at(); gpsSet(p.x, p.z); toast('已設定 GPS'); } }] : S.flags.end ? [{ t: `主線完成 · 結局 ${S.flags.end}`, sub: S.flags.end === 'A' ? '交帳：霍爾被捕' : '直播：史塔林下台', val: '', ok: true, fn: () => {} }] : []), ...rows];
}

// ─── 任務表 ───
// 片尾的台詞照「房子買回來沒有」（S.flags.house）換開頭幾句
const finA = () => [...(S.flags.house ? [L('lupe', '房子的錢付清了，法拍那封信我拿去生火了。'), L('rosa', '聯邦的人說，天際置業的帳也要一筆一筆查。')] : [L('lupe', '天際置業寄了信來，說法拍撤銷了。'), L('rosa', '聯邦的人辦事很快。')]),
  L('lupe', '霍爾上了新聞。那個史塔林呢？'), L('dane', '她還在電視上剪綵。'), L('rosa', '一次只能抓一條魚。'), L('lupe', '吃飯。湯要涼了。')];
const finB = () => [['dane', '新聞說我們是「直播大盜」。'], ['rosa', '比「假釋犯」好聽。'], S.flags.house ? ['dane', '妳媽的房子呢？'] : ['dane', '妳媽那邊怎麼辦？'], S.flags.house ? ['rosa', '付清了，誰也拿不走。'] : ['rosa', '等風頭過了，我會回去把房子買回來。'], ['dane', '通緝海報上的照片很難看。'], ['rosa', '那就別回來看。開船。']];
storyAdd([
  { id: 'F-1', ch: 'F', title: '牌桌', who: ROSA, star: 5, split: true, sw: [ROSA, DANE], at: ST_ALLEY, giver: 'otis', giverAt: () => nearL(ST_ALLEY(), 1.8, .6, -Math.PI / 2),
    desc: '史塔林帳上的錢最後都進了霓鑽賭場的金庫，帳本的正本也在裡面。', sms: '奧帝斯：正本不在帳上，在賭場的金庫裡。AFTERGLOW 後巷見。',
    bonus: [{ t: '沒觸發警報', ok: a => !a.casAlarm }, { t: '日間金庫也掃光', ok: a => !!(a.casH && a.casH.daily) }],
    steps: [
      { type: 'say', with: 'otis', lines: [L('otis', '史塔林的錢洗了一圈，最後都停在霓鑽賭場的金庫。'), L('rosa', '帳本的正本呢？'), L('otis', '也在裡面。她不信任電腦。'), L('rosa', '那就去拿。'), L('otis', '準備費我出了。路線妳挑。')] },
      { type: 'casino', text: '在計畫板上挑一條路線' },
      { type: 'say', phone: '奧帝斯', lines: [L('otis', '正本到手。現在帳上每一筆都對得起來了。'), L('rosa', '那霍爾也知道了。'), L('otis', '……今晚別回家。')] },
    ] },
  { id: 'F-2', ch: 'F', title: '天台', who: ROSA, star: 5, sw: [ROSA, DANE], at: ST_LOFT,
    desc: '霍爾的人包圍了冠石頂層公寓。', sms: '戴恩：冠石的公寓，樓下停了三台沒有車牌的車。快來。',
    bonus: [{ t: '生命沒掉超過 50', ok: a => a.hurt <= 50 }, { t: '爆頭 3 次', ok: a => a.heads >= 3 }],
    steps: [
      { type: 'fn', fn: a => palOn(a, DANE) },
      { type: 'say', with: 'dane', lines: [L('dane', '三台車，沒有車牌，引擎都沒熄。'), L('rosa', '霍爾知道正本在我們手上。'), L('dane', '頂樓有陽台。陽台下面是泳池。'), L('rosa', '你在開玩笑。')] },
      { type: 'fight', text: '霍爾的人堵在大樓門口', at: ST_LOFT, n: 6, r: 13, esc: true, hot: true, guns: ['rifle', 'smg', 'pistol'] },
      { type: 'loft', text: '上樓：按 E 沿旋轉樓梯上夾層' },
      { type: 'say', with: 'dane', lines: [['dane', '他們上樓了。電梯、樓梯，兩邊都是。'], ['rosa', '窗外就是陽台。你相信我嗎？'], ['dane', '從來沒有。'], ['rosa', '很好。牽著。']] },   // 在夾層的窗邊對話（場館裡，戴恩就站在旁邊），講完淡出接室外的陽台
      { type: 'leap', text: '牽著戴恩從頂樓跳進泳池', ck: true },
      { type: 'fn', fn: () => { addHeat(99, 4); toast('霍爾調了整個分局 · 4 星'); } },
      { type: 'lose', text: '甩掉霍爾調來的整個分局' },
    ] },
  { id: 'F-3', ch: 'F', title: '抉擇', who: ROSA, star: 0, sw: [ROSA, DANE], at: ST_BEACH, giver: 'twade', giverAt: () => nearL(ST_BEACH(), 1.8, .6, -Math.PI / 2),
    desc: '天亮的珊瑚灘。帳本只有一本，想要它的人有兩個。', sms: '泰倫斯：珊瑚灘，天亮的時候。我有個辦法，比交給條子大聲。',
    next: () => S.flags.route === 'B' ? 'F-4B' : 'F-4A',
    steps: [
      { type: 'fn', fn: a => { palOn(a, DANE); clockSt.min = 5 * 60 + 40; } },
      { type: 'say', with: 'twade', lines: [L('twade', '帳本我看過了。三分鐘，全城的手機都會看到。'), L('rosa', '然後呢？'), L('twade', '然後他們再也蓋不住。你們也再也躲不了。')] },
      { type: 'say', phone: '范斯', lines: [L('vance', '專機在灰鷺角等到中午。帳本給我，你們兩個的案子一筆勾銷。'), L('vance', '霍爾會進牢。'), L('dane', '史塔林呢？'), L('vance', '……下一次。')] },
      { type: 'choose' },
    ] },
  { id: 'F-4A', ch: 'F', title: '交帳', who: ROSA, star: 5, route: 'A', sw: [ROSA, DANE], at: ST_BEACH,
    desc: '開車把帳本送到灰鷺角機場的聯邦專機。', sms: '范斯：專機加好油了。路上小心，霍爾也知道你們要去哪。',
    next: () => 'end',
    bonus: [{ t: '4 分鐘內送到', ok: a => a.t < 240 }, { t: '沒換過車', ok: a => !a.vehs || a.vehs.size <= 1 }],
    steps: [
      { type: 'fn', fn: a => { palOn(a, DANE); storyCar(a, 'kiri', ST_BEACH(), '范斯安排的車', true); finJet(a); } },
      { type: 'car', text: '上車' },
      { type: 'fn', fn: a => { a.chaseOn = 1; gangChase('story', 3); addHeat(99, 3); toast('霍爾的人和赤蠍幫一起攔 · 3 星'); } },
      { type: 'run', text: '把帳本送到灰鷺角機場的聯邦專機', to: ST_JET, r: 12, drive: true, name: '聯邦專機' },
      { type: 'fn', fn: a => { a.chaseOn = 0; if (SQ.chase) chaseEnd(true); wantedClear('reset'); a.npc.vance = nearL(ST_JET(), 3, .8, -Math.PI / 2); } },
      { type: 'say', with: 'vance', lines: [L('vance', '準時。'), L('rosa', '正本跟副本都在。'), L('vance', '霍爾今天下午就會被帶走。'), L('dane', '史塔林呢？'), L('vance', '她請得起最好的律師。你們兩個自由了，這是我能給的。')] },
      { type: 'jet' },   // 范斯登機，專機滑行、起飛
      { type: 'fn', fn: () => storyEnding('A') },
      { type: 'card', k: '片尾', t: '星期天的晚餐', hold: 2.4 },
      { type: 'fade', to: () => stAt(ROSA_L, .6, .8, Math.atan2(1.2, -1.4)), gray: 0 },   // 面向母親（下一行站在 1.8, -0.6）
      { type: 'fn', fn: a => { a.npc.lupe = stAt(ROSA_L, 1.8, -.6); } },
      { type: 'say', with: 'lupe', get lines() { return finA(); } },
      { type: 'credits', end: 'A' },
    ] },
  { id: 'F-4B', ch: 'F', title: '直播', who: ROSA, star: 5, route: 'B', sw: [ROSA, DANE], at: ST_TGATE, giver: 'twade', giverAt: () => nearL(ST_TGATE(), 1.8, .6, -Math.PI / 2),
    desc: '帶著帳本攻上霓峰塔頂開直播，守住三分鐘。', sms: '泰倫斯：霓峰塔工地。塔頂的訊號最好，器材我搬上去了。',
    next: () => 'end',
    bonus: [{ t: '打下 2 架直升機', ok: a => (a.helis || 0) >= 2 }, { t: '生命沒掉超過 120', ok: a => a.hurt <= 120 }],
    steps: [
      { type: 'fn', fn: a => palOn(a, DANE) },
      { type: 'say', with: 'twade', lines: [L('twade', '上傳要三分鐘，塔頂的訊號最好。'), L('dane', '霍爾會派直升機。'), L('twade', '那就讓全城看他派直升機。')] },
      { type: 'fight', text: '霍爾的人守著工地', at: ST_TGATE, n: 6, r: 14, esc: true, hot: true, guns: ['rifle', 'smg'] },
      { type: 'card', k: '霓峰塔 · 202 m', t: '直播', lines: [['twade', '訊號滿格。鏡頭對著你們。'], ['rosa', '我叫羅莎·伊巴拉。這是維多莉亞·史塔林的帳本。'], ['dane', '每一筆都有簽名。']] },
      { type: 'lift', ck: true },
      { type: 'stream', text: '直播上傳中：守住塔頂' },
      { type: 'fn', fn: a => { delete a.npc.dane; toast('上傳完成 · 從塔頂邊上按空白鍵跳下去，F 開傘'); } },
      { type: 'down', text: '從塔頂下去' },
      { type: 'fn', fn: a => { a.noPal = 0; } },
      { type: 'lose', text: '六星通緝：甩掉全城的警察' },
      { type: 'fn', fn: () => storyEnding('B') },
      { type: 'card', k: '片尾', t: '出海', get lines() { return finB(); } },
      { type: 'fade', to: () => ST_SHIP, gray: 0 },
      { type: 'fn', fn: () => { const b = ST_BH; if (b && !b.dead && vehicles.includes(b) && Math.hypot(b.x - pX(), b.z - pZ()) < 40) enterVehicle(b); } },
      { type: 'credits', end: 'B' },
    ] },
]);
posterSync();

// ─── 母親家（P-3 之後）：走到盧佩旁邊按 E，可以存檔，也可以花 $480,000 把房子買回來（計畫第五節）───
const HOUSE_P = 480000;
const lupeAt = () => stAt(ROSA_L, 1.8, -.6);
const HOME_M = { id: 'H', ch: 'P', title: '回家', who: ROSA, star: 0, sw: [ROSA], bonus: [], at: () => stAt(ROSA_L, .6, .8, Math.atan2(1.2, -1.4)),
  desc: '把母親的房子從天際置業手上買回來。',
  steps: [
    { type: 'fn', fn: a => { a.npc.lupe = lupeAt(); } },
    { type: 'card', k: '灰石國宅', t: '房子是妳的了', hold: 2 },
    { type: 'say', with: 'lupe', lines: [L('rosa', '媽，天際置業那邊付清了。這是收據，正本。'), L('lupe', '四十八萬……妳哪來的錢？'), L('rosa', '別問。房子是妳的了，誰也收不走。'), L('lupe', '……我去把門上那張通知撕掉。'), L('lupe', '今天晚上留下來吃飯。')] },
  ] };
MS.H = HOME_M;   // 不在 ORDER 裡：不會出現在地圖與手機的任務列表，失敗重試照樣找得到
function houseBuy() {
  if (!S || S.flags.house || !isDone('P-3')) return false;
  if (motors.cash < HOUSE_P) { toast(`還差 ${money(HOUSE_P - motors.cash)}`); return false; }
  const b = storyBusy(); if (b) { toast(b); return false; }
  motors.cash -= HOUSE_P; S.flags.house = 1; saveMotors();
  newsAdd('灰石國宅一戶法拍案撤回', '天際置業：「屋主已全數清償。」');
  storyStart(HOME_M);
  return true;
}
function lupeAsk() {
  const own = !!S.flags.house;
  dialog('盧佩 · 灰石國宅', own ? '房子是我們的了。進來坐，湯還熱著。' : `門上還貼著天際置業的法拍通知：付清 ${money(HOUSE_P)}，房子就買回來了。`, [
    { t: '在家休息一下（存檔）', fn: () => { closeDialog(); if (quickSave()) toast('在媽媽家休息：已存檔'); } },
    ...(own ? [] : [{ t: motors.cash >= HOUSE_P ? `把房子買回來（${money(HOUSE_P)}）` : `把房子買回來（還差 ${money(HOUSE_P - motors.cash)}）`, fn: () => { closeDialog(); houseBuy(); } }]),
    { t: '先不要', fn: closeDialog },
  ]);
}
ctxHooks.push(p => {
  if (!S || !isDone('P-3') || p.mode !== 'walk' || p.where !== 'out' || side.act || dlg.open) return null;
  const q = lupeAt(); if (Math.hypot(p.x - q.x, p.z - q.z) > 2.4) return null;
  return { key: 'E', text: `跟盧佩說話 <i>· 存檔${S.flags.house ? '' : '、買回房子'}</i>`, fn: lupeAsk };
});

storyApi.fin = { start: id => storyStart(MS[id]), leapPlan, towerRoof, ending: storyEnding, repT: storyRepT, cred: () => ({ on: cred.on, i: cred.i }), posters: () => Object.values(pst.m).some(m => m.visible) ? pst.n : 0, posterAt: (x, z) => { pstBuild(x, z); return pst.n; }, poster: (i, kind = 'sig') => { const m = pst.m[kind]; if (!m || i >= m.count) return null; const M = new T.Matrix4(); m.getMatrixAt(i, M); const e = M.elements; return { x: e[12], y: e[13], z: e[14], nx: e[8], nz: e[10], k: Math.hypot(e[8], e[10]) }; }, phone: storyPhoneRows, heliY: storyHeliY, hgt: (x, z) => [roofH(x, z), groundH(x, z)], roofFoes: () => roofFoes(side.act).map(f => ({ x: f.x, z: f.z, y: fGround(f), hp: f.hp })), loft: ST_LOFT, jet: () => { const j = side.act && side.act.jet; return j ? { x: j.g.position.x, y: j.g.position.y, z: j.g.position.z, ry: j.g.rotation.y, model: j.g.children.length > 0, dyn: j.dyn.length } : null; }, house: { buy: houseBuy, ask: lupeAsk, at: lupeAt, P: HOUSE_P, lines: () => ({ A: finA().map(l => l[1]), B: finB().map(l => l[1]) }) } };
