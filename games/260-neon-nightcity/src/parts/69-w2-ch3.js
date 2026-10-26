// ═══ 主線第三章「夜城生意」（plans/260-story.md）：3-1 門禁 · 今夜、3-2 大橡、3-3 籠中、3-4 母帶、3-5 MV、3-6 擴音、3-7 新家 ═══
// 3-1 就是原本開場的「門禁」（60-venues.js 的 QUEST 0–4、99-main.js 的跳舞判定）：quest 步驟把 quest.n 撥回 0，跑到 5 算完成；
// 主線開著時跳舞不再給 $250,000，照主線的報酬表發。沒玩完就失敗或放棄，quest.n 撥回 6（絨布繩拉著，等下次 3-1）。
// 新步驟：quest（門禁）、cp（照順序開過檢查點）、own（買下一間安全屋）。籠鬥是 STEP.fight 的徒手版（brawl）加上這裡的八角籠（cageAt），
// 籠子在琥珀工業區街區裡找一塊 6 m 半徑內沒有碰撞的空地（stOpen），人和對手都推回籠子裡。
// 排在 69-w1-ch2.js 之後、70-render.js 之前：post、camState、keys 只能在函式裡用。

// ─── 地點 ───
const ST_CLUB = () => ({ ...WP(CLUB_X - 3, CLUB_Z + 5), yaw: Math.PI });   // LAZARUS 門口的人行道（90-hud.js 的 clubIn 也是這一點）
const ST_HALO = () => taleCorner(10, 3, 1, 1);    // 光環廣場：T-Wade 的錄音室樓下
const ST_TAPE = () => taleCorner(11, 5, -1, 1);   // 赤蠍幫拿著母帶的街角
const ST_NEON = () => taleCorner(2, 2, 1, 1);     // 霓虹區：MV 開拍的地方
// 琥珀工業區街區裡的空地（世界座標）：半徑 r 內和一圈 8 點都推不動、在地面上
let stOpenC = null;
function stOpen(r = 5.5) {
  if (stOpenC) return stOpenC;
  const d = DISTRICTS.find(o => o.name.startsWith('琥珀')) || { i0: 13, i1: NX, j0: 7, j1: 11 };
  const ok = (x, z) => { colY = 0; for (let k = -1; k < 8; k++) { const px = k < 0 ? x : x + Math.sin(k / 8 * Math.PI * 2) * r, pz = k < 0 ? z : z + Math.cos(k / 8 * Math.PI * 2) * r, q = collideCircle(px, pz, .5, false); if (Math.abs(q.x - px) + Math.abs(q.z - pz) > .01 || groundH(px, pz) <= 0) return false; } return true; };
  for (let i = d.i0; i < Math.min(d.i1, NX) && !stOpenC; i++) for (let j = d.j0; j < Math.min(d.j1, NZ) && !stOpenC; j++) {
    const x0 = avX(i) + HR + SW + r + 1, x1 = avX(i + 1) - HR - SW - r - 1, z0 = stZ(j) + HR + SW + r + 1, z1 = stZ(j + 1) - HR - SW - r - 1;
    for (let x = x0; x <= x1 && !stOpenC; x += 4) for (let z = z0; z <= z1 && !stOpenC; z += 4) { const [X, Z] = toW(x, z); if (ok(X, Z)) stOpenC = { x: X, z: Z, yaw: 0 }; }
  }
  return stOpenC || (stOpenC = ST_SHIP);
}
// 北嶺公園的大門外（公園自己的座標框，門在原點、公園往 −z）
const ST_PARK = () => NPARK ? { ...parkW(0, 9), yaw: 0 } : taleCorner(9, 8, 1, 1);

// ─── 八角籠：八根柱子、頂上一圈護欄、鐵絲網（程式畫的菱形網格，alphaTest 剪掉空的地方）、地上的帆布，四角的投光燈 ───
const CAGE_R = 5;
let cageMat = null;
function cageAt(a, p) {
  if (!cageMat) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 64;
    const g = cv.getContext('2d'); g.strokeStyle = '#e4e8ec'; g.lineWidth = 2.2;
    g.beginPath(); g.moveTo(0, 32); g.lineTo(32, 0); g.lineTo(64, 32); g.lineTo(32, 64); g.closePath(); g.stroke();
    const tx = new T.CanvasTexture(cv); tx.wrapS = tx.wrapT = T.RepeatWrapping; tx.repeat.set(36, 22); tx.colorSpace = T.SRGBColorSpace; tx.anisotropy = 4;   // 一格約 10 cm
    cageMat = new T.MeshStandardMaterial({ map: tx, alphaTest: .4, side: T.DoubleSide, metalness: .3, roughness: .5, emissive: 0x30343a });
  }
  const k = new Kit(), y = groundH(p.x, p.z), N = 8, H = 2.4;
  for (let i = 0; i < N; i++) {
    const t = i / N * Math.PI * 2, x = Math.sin(t) * CAGE_R, z = Math.cos(t) * CAGE_R;
    k.cyl(x, H / 2, z, .07, .07, H, 10, 0x18191c, 2);
    k.cyl(x, H + .05, z, .09, .09, .1, 10, 0x8a1c22, 2);
  }
  k.cyl(0, .03, 0, CAGE_R + .2, CAGE_R + .2, .06, 8, 0x2a2c30, 2).cyl(0, .065, 0, CAGE_R - .1, CAGE_R - .1, .02, 8, 0x7a6a58, 2);
  for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) k.cyl(sx * (CAGE_R + 1.6), 2, sz * (CAGE_R + 1.6), .05, .05, 4, 8, 0x202226, 2).box(sx * (CAGE_R + 1.6), 4.05, sz * (CAGE_R + 1.6), .5, .3, .3, 0xfff2d8, 4);
  const grp = new T.Group(); grp.position.set(p.x, y, p.z);
  grp.add(new T.Mesh(k.build(), MAT.uber));
  // 鐵絲網：八面直立的板子（沿柱子之間）
  const pos = [], uv = [];
  for (let i = 0; i < N; i++) {
    const t0 = i / N * Math.PI * 2, t1 = (i + 1) / N * Math.PI * 2, ax = Math.sin(t0) * CAGE_R, az = Math.cos(t0) * CAGE_R, bx = Math.sin(t1) * CAGE_R, bz = Math.cos(t1) * CAGE_R;
    pos.push(ax, .1, az, bx, .1, bz, bx, H, bz, ax, .1, az, bx, H, bz, ax, H, az);
    uv.push(0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1);
  }
  const ng = new T.BufferGeometry(); ng.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); ng.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); ng.computeVertexNormals();
  grp.add(new T.Mesh(ng, cageMat));
  scene.add(grp);
  a.cage = { x: p.x, z: p.z, g: grp };
}
storyCleanups.push(a => { if (a.cage) { scene.remove(a.cage.g); a.cage.g.traverse(o => { if (o.isMesh && o.geometry) o.geometry.dispose(); }); a.cage = null; } });
// 籠子裡：人和對手都推回圈內
function cageKeep(c, o, r) { const dx = o.x - c.x, dz = o.z - c.z, d = Math.hypot(dx, dz); if (d > r) { o.x = c.x + dx / d * r; o.z = c.z + dz / d * r; } }
storyTicks.push(a => {
  if (!a.cage || player.where !== 'out') return;
  if (player.mode === 'walk') cageKeep(a.cage, player, CAGE_R - .45);
  for (const f of SQ.f) if (fUp(f) && f.grp === a) cageKeep(a.cage, f, CAGE_R - .45);
});
function cageEnter(a) {
  const p = stOpen();
  cageAt(a, p);
  if (player.mode === 'drive') exitVehicle();
  player.x = p.x; player.z = p.z + CAGE_R - 1.4; player.y = groundH(p.x, p.z); player.yaw = camState.yaw = Math.PI; camState.snap = true;
  equip('fist', true);
  life.hp = life.max;
}

// 69-race.js：MV 上片之後街頭賽的獎金 ×1.2
function storyRaceK() { return S && S.flags.mv ? 1.2 : 1; }

// ─── 步驟 ───
// 門禁（60-venues.js 的 QUEST 0–4）
STEP.quest = {
  start: (a, s, c) => { setQuest(0); quest.danceT = 0; a.questOn = 1; },
  step: () => quest.n === 5,
  hud: () => ({ text: QUEST[quest.n].text, bar: quest.n === 4 && quest.danceT > 0 ? quest.danceT / 5 * 100 : -1 }),
  mark: () => QUEST[quest.n].mk(),
  skip: () => setQuest(5),
};
storyCleanups.push(a => { if (a.questOn) { a.questOn = 0; if (quest.n < 5) setQuest(storyQuest0()); } });
// 照順序開過檢查點（大圈，要開著車）
STEP.cp = {
  start: (a, s, c) => { c.pts = s.pts(); c.i = 0; c.ring = neonRing(0x5af0ff, 5); a.cpRing = c.ring; c.lim = s.limOf ? s.limOf(c.pts) : 0; },
  step: (a, s, c) => {
    const q = c.pts[c.i];
    if (!q) return true;
    const nx = c.pts[c.i + 1] || q;
    ringAt(c.ring, q.x, q.z, nx.x - q.x || 1, nx.z - q.z, 3.6);
    if (c.lim && a.st > c.lim) { storyFail(a, '時間到了，攝影車收工了'); return false; }
    if (player.mode === 'drive' && Math.hypot(q.x - pX(), q.z - pZ()) < 9) { c.i++; sfx.beep && sfx.beep(); if (c.i >= c.pts.length) return true; }
    return false;
  },
  hud: (a, s, c) => {
    const q = c.pts[c.i], left = c.lim ? Math.max(0, c.lim - a.st) : 0;
    return { text: `${player.mode === 'drive' ? s.text : '先上車'} · ${c.i} / ${c.pts.length}`, bar: c.lim ? left / c.lim * 100 : -1, low: c.lim && left < 15, num: c.lim ? `${Math.ceil(left)} 秒` : q ? `${Math.round(Math.hypot(q.x - pX(), q.z - pZ()))} m` : '' };
  },
  mark: (a, s, c) => { const q = c.pts[c.i]; return q ? { name: `檢查點 ${c.i + 1}`, x: q.x, y: 3, z: q.z, where: 'out' } : null; },
  skip: (a, s, c) => { c.i = c.pts.length; },
};
storyCleanups.push(a => { if (a.cpRing) { scene.remove(a.cpRing); a.cpRing.material.dispose(); a.cpRing = null; } });
// MV 的路線：霓虹區到北嶺公園的 GPS 路線，每隔 150 m 左右放一個檢查點
function mvPoints() {
  const A = ST_NEON(), B = ST_PARK(), r = routeTo(A.x, A.z, B.x, B.z) || [[B.x, B.z]], out = [];
  let acc = 0;
  for (let i = 1; i < r.length; i++) { acc += Math.hypot(r[i][0] - r[i - 1][0], r[i][1] - r[i - 1][1]); if (acc > 150 || i === r.length - 1) { out.push({ x: r[i][0], z: r[i][1] }); acc = 0; } }
  return out.slice(0, 14);
}
const mvLim = pts => { let L = 0, p = { x: pX(), z: pZ() }; for (const q of pts) { L += Math.hypot(q.x - p.x, q.z - p.z); p = q; } return Math.round(L / 15 + 25); };
// 買一間安全屋（69-market.js 的 ESTATES 裡 home 的）
const homeOwned = () => ESTATES.some(e => e.home && estOwned(e.id));
function homeCheap() { let best = null; for (const e of ESTATES) if (e.home && APT[e.id] && (!best || e.price < best.price)) best = e; return best; }
STEP.own = {
  step: () => homeOwned(),
  hud: (a, s) => { const e = homeCheap(); return { text: s.text, bar: -1, num: e ? `最便宜 ${money(e.price)}` : '' }; },
  mark: () => { const e = homeCheap(), d = e && APT[e.id].doorW; return d ? { name: e.name, x: d.x, y: 2.2, z: d.z, where: 'out' } : null; },
  skip: () => { const e = homeCheap(); if (e && !estOwned(e.id)) { motors.props.own.push(e.id); motors.props.safe[e.id] = 0; saveMotors(); } },
};
// 剛買下（或本來就有）的那一間的門口
function homeDoor() { const e = ESTATES.find(e => e.home && estOwned(e.id) && APT[e.id]) || homeCheap(); return e ? { ...APT[e.id].doorW, yaw: 0 } : CREW[ROSA].home; }

// ─── 任務表 ───
const nearL = (p, dx, dz, yaw) => { const [lx, lz] = toL(p.x, p.z); return spotW({ x: lx + dx, z: lz + dz, yaw }); };
storyAdd([
  { id: '3-1', ch: 3, title: '門禁 · 今夜', who: ROSA, star: 1, sw: [ROSA, DANE], at: ST_CLUB, giver: 'kael', giverAt: () => nearL(ST_CLUB(), 1.8, .4, -Math.PI / 2),
    desc: '凱爾說蒙洛在 LAZARUS 等你們。門口的 Marlo 只放熟面孔進去。', sms: '凱爾：今晚，LAZARUS。蒙洛想看看你們。',
    bonus: [{ t: '6 分鐘內進場跳舞', ok: a => a.t < 360 }, { t: '沒被通緝', ok: a => !a.peak }],
    first: () => { S.flags.vip = 1; },
    steps: [
      { type: 'say', with: 'kael', lines: [L('kael', '這是 LAZARUS。夜城的事，一半在這裡談成。'), L('rosa', '我們就這樣走進去？'), L('kael', '妳們走不進去。門口那位 Marlo 只認名單。'), L('kael', '想辦法讓他點頭。我在車上等。')] },
      { type: 'fn', fn: a => { delete a.npc.kael; palOn(a, DANE); } },
      { type: 'quest', text: '進入 LAZARUS' },
      { type: 'say', lines: [L('dane', '有人在樓上看我們。'), L('rosa', '穿西裝、戴金鍊的那個？'), L('dane', '他在招手。')] },
      { type: 'fn', fn: a => palOff(a) },
    ] },
  { id: '3-2', ch: 3, title: '大橡', who: ROSA, star: 0, sw: [ROSA, DANE], at: ST_CLUB, giver: null,
    desc: 'LAZARUS 的 VIP 包廂，蒙洛·奧克斯。',
    first: () => { S.flags.oakes = 1; toast('聯絡人：蒙洛'); },
    steps: [
      { type: 'card', k: 'LAZARUS · VIP 包廂', t: '大橡', lines: [
        L('oakes', '坐。全城的警察在找的兩個人，跳舞跳得還不錯。'),
        L('rosa', '你是蒙洛。'),
        L('oakes', '大家叫我「大橡」。這間店、樓下的唱片公司、半條街的燈，都是我的。'),
        L('dane', '你為什麼要幫我們？'),
        L('oakes', '因為霍爾想要你們手上那顆硬碟，而我不喜歡霍爾。'),
        L('oakes', '我給你們地方住、給你們工作。你們替我擺平幾件事。'),
        L('rosa', '什麼樣的事？'),
        L('oakes', '先從簡單的開始。妳會打架嗎，伊巴拉小姐？'),
      ] },
    ] },
  { id: '3-3', ch: 3, title: '籠中', who: ROSA, star: 3, at: () => nearL(stOpen(), 0, CAGE_R + 4, Math.PI), giver: 'oakes', giverAt: () => nearL(stOpen(), 1.6, CAGE_R + 4, -Math.PI / 2),
    desc: '琥珀工業區的地下擂台。連打三場，空手。', sms: '蒙洛：琥珀工業區，今晚有比賽。妳是壓軸。',
    bonus: [{ t: '生命沒掉超過 60', ok: a => a.hurt <= 60 }, { t: '2 分 30 秒內打完三場', ok: a => a.t < 150 }],
    first: () => { S.flags.cage = 1; toast('籠鬥擂台解鎖'); },
    steps: [
      { type: 'say', with: 'oakes', lines: [L('oakes', '三場，三個對手，一場比一場硬。'), L('rosa', '我十九歲之後就沒打過了。'), L('oakes', '那就讓他們看看妳十九歲的樣子。')] },
      { type: 'fn', fn: a => { delete a.npc.oakes; cageEnter(a); toast('第一回合'); } },
      { type: 'fight', text: '第一回合：空手打倒對手', at: () => stOpen(), n: 1, brawl: true, r: 2.6, cast: 'pit', hp: 90 },
      { type: 'fn', fn: () => { life.hp = Math.min(life.max, life.hp + 40); toast('第二回合 · 鐵鏽騎士的拳手'); } },
      { type: 'fight', text: '第二回合', at: () => stOpen(), n: 1, brawl: true, r: 2.6, cast: 'biker', hp: 150 },
      { type: 'fn', fn: () => { life.hp = Math.min(life.max, life.hp + 40); toast('第三回合 · 二打一'); } },
      { type: 'fight', text: '第三回合：二打一', at: () => stOpen(), n: 2, brawl: true, r: 2.8, cast: 'pit', hp: 110, tint: [0x1c2a4a, 0x2a4a1c] },
      { type: 'say', lines: [L('oakes', '（場邊）各位，記住這張臉！'), L('rosa', '……錢呢？'), L('oakes', '在妳的帳上。還有，從今晚起，妳是我的人。')] },
    ] },
  { id: '3-4', ch: 3, title: '母帶', who: ROSA, star: 2, sw: [ROSA, DANE], at: ST_HALO, giver: 'twade', giverAt: () => nearL(ST_HALO(), 1.8, 0, -Math.PI / 2), cast: { jada: () => nearL(ST_HALO(), 2.6, 1.4, -Math.PI / 2) },
    desc: 'STEREO 的第二張專輯母帶被赤蠍幫搶走了。', sms: '泰倫斯：我是 T-Wade，蒙洛給我妳的號碼。我們的母帶被搶了。',
    bonus: [{ t: '爆頭 2 次', ok: a => a.heads >= 2 }, { t: '生命沒掉超過 50', ok: a => a.hurt <= 50 }],
    first: () => { S.flags.fame = (S.flags.fame || 0) + 10; toast('名氣 +10'); },
    steps: [
      { type: 'say', with: 'twade', lines: [L('twade', '整整一年的錄音，就在那一顆硬碟裡。赤蠍幫衝進錄音室，拿了就走。'), L('jada', '他們說這一區的錄音室都要「繳保護費」。'), L('rosa', '他們在哪裡？'), L('twade', '轉角那間洗車場。我付妳錢，只要拿回來。')] },
      { type: 'fn', fn: a => palOn(a, DANE) },
      { type: 'go', text: '到赤蠍幫的街角', to: ST_TAPE, r: 16, name: '赤蠍幫' },
      { type: 'fight', text: '打倒赤蠍幫', at: ST_TAPE, n: 5, guns: ['pistol', 'smg', 'pistol', 'shotgun', 'smg'], r: 7 },
      { type: 'collect', text: '拿回母帶', item: '母帶', spots: () => [ST_TAPE()] },
      { type: 'go', text: '把母帶交給 T-Wade', to: () => nearL(ST_HALO(), 1.8, 0, -Math.PI / 2), r: 3, name: 'T-Wade' },
      { type: 'say', with: 'twade', lines: [L('twade', '……一點刮痕都沒有。'), L('jada', '妳要不要來拍我們的 MV？我是說真的。'), L('rosa', '我不會唱歌。'), L('jada', '不用唱。妳只要開車，跟今天一樣兇。')] },
      { type: 'fn', fn: a => palOff(a) },
    ] },
  { id: '3-5', ch: 3, title: 'MV', who: ROSA, star: 3, at: ST_NEON, giver: 'jada', giverAt: () => nearL(ST_NEON(), 1.8, 0, -Math.PI / 2), cast: { kiki: () => nearL(ST_NEON(), 2.6, 1.4, -Math.PI / 2) },
    desc: '從霓虹區一路飆到北嶺公園，攝影車只追得上一次。', sms: '潔妲：明晚十點，霓虹區。開妳最快的車來。',
    bonus: [{ t: '車子沒什麼刮傷（車況 75% 以上）', ok: a => !a.mvCar || a.mvCar.hp >= a.mvHp0 * .75 }, { t: '一路上沒被通緝', ok: a => !a.peak }],
    first: () => { S.flags.mv = 1; S.flags.fame = (S.flags.fame || 0) + 30; toast('MV 上片，名氣 +30；街頭賽的獎金 ×1.2'); },
    steps: [
      { type: 'say', with: 'jada', lines: [L('jada', '攝影車在前面，一鏡到底。'), L('kiki', '妳只要一直往前，別讓鏡頭看到妳減速。'), L('rosa', '終點？'), L('jada', '北嶺公園的大門。日出剛好打在山上。')] },
      { type: 'fn', fn: a => { if (player.mode !== 'drive') storyCar(a, 'carter', ST_NEON(), '拍片的車', true); } },
      { type: 'car', text: '上車' },
      { type: 'fn', fn: a => { a.mvCar = player.veh; a.mvHp0 = player.veh ? player.veh.hp : 1; } },
      { type: 'cp', text: '照著檢查點開到北嶺公園', pts: mvPoints, limOf: mvLim },
      { type: 'say', phone: '泰倫斯', lines: [L('泰倫斯', '上片三個小時，兩百萬次觀看。'), L('泰倫斯', '留言一半在講歌，一半在問那個開車的女生是誰。'), L('rosa', '那就讓他們繼續問。')] },
    ] },
  { id: '3-6', ch: 3, title: '擴音', who: ROSA, star: 3, sw: [ROSA, DANE], at: ST_CLUB, giver: 'twade', giverAt: () => nearL(ST_CLUB(), 1.8, .4, -Math.PI / 2),
    desc: 'STEREO 的首播派對。鐵鏽騎士說要來「捧場」。', sms: '泰倫斯：今晚首播派對，LAZARUS。蒙洛說鐵鏽騎士會來鬧，叫你們兩個在門口。',
    bonus: [{ t: '生命沒掉超過 60', ok: a => a.hurt <= 60 }, { t: '爆頭 3 次', ok: a => a.heads >= 3 }],
    first: () => { const C = v7CS(); C.pop = Math.min(100, C.pop + 20); saveMotors(); toast('LAZARUS 人氣 +20'); },
    steps: [
      { type: 'say', with: 'twade', lines: [L('twade', '鐵鏽騎士是琥珀工業區的機車幫，替某些人運貨。'), L('dane', '某些人？'), L('twade', '跟天際置業的車隊同一個倉庫進出的人。今晚他們想讓 LAZARUS 開不成。'), L('rosa', '那就讓他們進不了門。')] },
      { type: 'fn', fn: a => { delete a.npc.twade; palOn(a, DANE); toast('第一波：鐵鏽騎士'); } },
      { type: 'fight', text: '守住 LAZARUS 門口', at: ST_CLUB, n: 4, guns: ['pistol', 'smg', 'shotgun', 'pistol'], r: 14, cast: 'biker', hot: true },
      { type: 'fn', fn: () => toast('第二波：騎士們從街口衝過來了') },
      { type: 'fight', text: '守住 LAZARUS 門口 · 第二波', at: ST_CLUB, n: 5, guns: ['smg', 'rifle', 'smg', 'shotgun', 'pistol'], r: 18, cast: 'biker', hot: true, hp: 120 },
      { type: 'say', lines: [L('dane', '他們的外套背後……鐵庫保全的標誌。'), L('rosa', '運鈔車、警察、機車幫、天際置業。全是同一張網。'), L('dane', '那顆硬碟，就是這張網的帳本。')] },
      { type: 'fn', fn: a => palOff(a) },
    ] },
  { id: '3-7', ch: 3, title: '新家', who: ROSA, star: 0, at: () => CREW[ROSA].home, giver: 'lupe', giverAt: () => stAt(ROSA_L, 1.8, -.6),
    desc: '霍爾知道灰石國宅。兩人需要一個自己的地方。', sms: '盧佩：今天有兩個穿西裝的人在樓下問妳的事。',
    first: () => { S.flags.home2 = 1; toast('奧帝斯把掃描器搬進安全屋了'); },
    steps: [
      { type: 'say', with: 'lupe', lines: [L('lupe', '他們沒說是誰。只問妳幾點回家。'), L('rosa', '媽，我得搬出去一陣子。'), L('lupe', '是因為那個退伍兵？'), L('rosa', '是因為我想讓這間房子留下來。')] },
      { type: 'own', text: '買一間安全屋（手機的天際置業，或走到門口直接買）' },
      { type: 'go', text: '到安全屋的門口', to: homeDoor, r: 4, name: '安全屋' },
      { type: 'fn', fn: a => { a.npc.otis = nearL(homeDoor(), 1.6, .8, -Math.PI / 2); } },
      { type: 'say', with: 'otis', lines: [L('otis', '掃描器搬過來了，天線接在屋頂。'), L('dane', '你也要住這裡？'), L('otis', '我只是來看看。霍爾的人昨天燒了船廠的拖車屋。'), L('rosa', '……那就住下來吧。')] },
    ] },
]);
