// ═══ 第五階段：支線委託（兩位街坊，各三段） ═══
// 紅磚巷的老鐘錶匠奧斯卡、中城的街頭畫家米卡站在人行道上，大地圖上是黃色的「?」。走近按 E 聽委託，接下來就是一項 side.act：
//   fight：目標路口有一群站著的赤蠍幫（calm，被看到或你先動手就開打），全部打倒就完成。
//   deliver：送東西到另一個城區，時間依直線距離算（直線距離 ÷ 9 m/s + 40 秒，留時間找車）；到目標 6 m 內完成，超時失敗。
//   collect：目標路口附近五個人行道轉角各有一件東西（黃色霓虹小圈），三分鐘內撿齊。
// 進度存在 motors.side.tale[委託人]（0–3）。失敗可以回去重接同一段。
// 兩位委託人用自己的 crowd(2)，PEOPLE 載入前不畫。

const TALE_HEX = '#ffe066';
const TALES = [
  {
    id: 'oskar', name: '奧斯卡', role: '老鐘錶匠 · 齒輪與發條', at: [2, 1, 30, -1], yaw: 0,
    look: { female: false, top: 0x5b4a3a, bot: 0x2b2a2e, hair: 2, coat: 1, hat: 1, scale: .96 },
    steps: [
      { type: 'fight', title: '祖父的懷錶', at: [4, 2], n: 3, pay: 2500,
        intro: `${GANG_NAME}的人每個月來收「保護費」，這次連我祖父留下的懷錶都拿走了。他們就在中城那個路口晃，三個人。`,
        done: '懷錶回來了。錶殼刮花了一點，機芯沒事。這是我的一點心意。' },
      { type: 'deliver', title: '準時的懷錶', at: [6, 2], pay: 3000, item: '修好的懷錶',
        intro: '冠石金融區有位客人等著拿他的懷錶。銀行家最討厭遲到，你開快一點，可別摔著它。',
        done: '客人說這是他見過最準時的送貨。他多付了小費，全給你。' },
      { type: 'collect', title: '風向齒輪', at: [1, 3], pay: 4000, item: '齒輪零件',
        intro: '昨晚雨太大，我屋頂風向儀的齒輪被吹散了，五個零件全掉在舊碼頭一帶。我這把老骨頭追不動了。',
        done: '五個都在。等風向儀轉起來，你從碼頭就看得到它。謝謝你，年輕人。' },
    ],
    end: '風向儀又轉起來了。有空來店裡坐，我請你喝茶。',
  },
  {
    id: 'mika', name: '米卡', role: '街頭畫家', at: [4, 3, 30, 1], yaw: Math.PI,
    look: { female: true, top: 0x2f6b78, bot: 0x3a2f45, hair: 0, longHair: 1, coat: 0, skirt: 0, scale: .95, glow: 0x3ad6ff, glowI: 1.2 },
    steps: [
      { type: 'collect', title: '散落的畫稿', at: [2, 6], pay: 2000, item: '畫稿',
        intro: '我的畫稿被風吹得滿街都是，就在雲杉坡那邊。五張，一張都不能少，那是下一面牆的草圖。',
        done: '全找回來了！有一張沾了雨水，暈開的顏色反而更好看。' },
      { type: 'deliver', title: '趁顏料還沒乾', at: [14, 2], pay: 3500, item: '一箱噴漆',
        intro: '灰石國宅那面牆今晚要開工，這箱噴漆得在助手收工前送到。路有點遠，拜託了。',
        done: '剛好趕上。等牆畫好，記得去看看。' },
      { type: 'fight', title: '牆是誰的', at: [10, 4], n: 4, pay: 5000,
        intro: '有一夥人把我在光環廣場的新作品塗掉了，還站在牆邊得意。去讓他們知道那面牆是誰的。',
        done: '他們不會再來了。這面牆我要畫一個打架的人，你不介意吧？' },
    ],
    end: '你的畫像在光環廣場那面牆上。很帥，真的。',
  },
];
const taleCrowd = crowd(2);
scene.add(taleCrowd.mesh);
// 委託人站的位置：路口 (i, j) 往東 dx 公尺、在街道的北側（s = -1）或南側（s = 1）人行道上
function taleAt(G) { if (!G.pos) { const [i, j, dx, s] = G.at; G.pos = spotW({ x: avX(i) + dx, z: stZ(j) + s * (HR + 2.4), yaw: G.yaw }); } return G.pos; }
const taleStage = G => motors.side.tale[G.id] || 0;
function taleIdle() {
  const out = player.where === 'out';
  TALES.forEach((G, k) => {
    const p = taleCrowd.people[k], P = taleAt(G);
    if (!p.rig && PEOPLE) { const L = G.look; taleCrowd.look(k, { r: rng(77 + k), ...L, top: lin(L.top), bot: lin(L.bot), hair: HAIRS[L.hair], skin: SKINS[(k * 3 + 1) % SKINS.length], shoe: SHOES[k], glow: L.glow ? lin(L.glow) : undefined, glowI: L.glowI || 0 }); taleCrowd.anim(k, ANIM.idle, k * 3, 1); }
    const busy = side.act && side.act.G === G;
    if (!out || busy) { taleCrowd.place(k, 0, -60, 0, 0); return; }
    const d = Math.hypot(P.x - pX(), P.z - pZ());
    taleCrowd.anim(k, d < 4 ? ANIM.talk : ANIM.idle, k * 3, 1);
    const yaw = d < 6 ? Math.atan2(pX() - P.x, pZ() - P.z) : P.yaw;
    taleCrowd.place(k, P.x, groundH(P.x, P.z) > 0 ? .15 : 0, P.z, yaw);
  });
}
// 排在最前面：委託人旁邊常停著車，不然會先跳出「撬車」
ctxHooks.unshift(p => {
  if (p.mode !== 'walk' || p.where !== 'out' || side.act) return null;
  for (const G of TALES) { const P = taleAt(G); if (Math.hypot(p.x - P.x, p.z - P.z) < 2.4) return { key: 'E', text: `${G.name} <i>· ${G.role}</i>`, fn: () => taleTalk(G) }; }
  return null;
});
function taleTalk(G) {
  const n = taleStage(G), who = `${G.name} · ${G.role}`;
  if (n >= G.steps.length) { dialog(who, G.end); return; }
  const S = G.steps[n];
  dialog(who, S.intro, [
    { t: `交給我（${S.title} · ${money(S.pay)}）`, fn: () => { closeDialog(); const b = sideBusy(); if (b) { toast(b); return; } taleStart(G, n); } },
    { t: '下次吧', fn: closeDialog },
  ]);
}

// ─── 委託進行中 ───
// 目標路口的人行道轉角（邏輯座標 → 所在區的世界座標）
const taleCorner = (i, j, sx, sz) => WP(avX(i) + sx * (HR + 2.2), stZ(j) + sz * (HR + 2.2));
function taleStart(G, n) {
  const S = G.steps[n], [ti, tj] = S.at, tgt = taleCorner(ti, tj, 1, 1);
  const a = {
    kind: 'tale', G, S, n, name: S.title, label: `<b>${S.title}</b> · ${G.name}的委託`, tgt, t: 0, lim: 0, items: [], grp: null,
    step: dt => taleStep(a, dt), hud: () => taleHud(a), mark: () => taleMark(a),
    fail: why => taleFail(a, why), clear: () => { turfFree(a); for (const it of a.items) { scene.remove(it.m); } },
  };
  if (S.type === 'fight') {
    const guns = ['pistol', 'smg', 'shotgun', 'pistol'];
    for (let i = 0; i < S.n; i++) {
      const t = i / S.n * Math.PI * 2, x = tgt.x + Math.sin(t) * 2, z = tgt.z + Math.cos(t) * 2;
      fRoom(1);
      const f = fSpawn('gang', x, z, Math.atan2(tgt.x - x, tgt.z - z), { gun: guns[i % guns.length] });
      if (f) { f.calm = true; f.grp = a; }
    }
  } else if (S.type === 'deliver') {
    a.lim = Math.round(Math.hypot(tgt.x - pX(), tgt.z - pZ()) / 9 + 40);
  } else {
    a.lim = 180;
    const C = [[0, 0, -1, -1], [1, 0, 1, 1], [0, 1, -1, 1], [-1, 0, 1, -1], [0, -1, 1, 1]];
    for (const [di, dj, sx, sz] of C) {
      const q = taleCorner(ti + di, tj + dj, sx, sz), m = neonRing(0xffe066, .42);
      ringAt(m, q.x, q.z, 1, 0, .8);
      a.items.push({ x: q.x, z: q.z, m });
    }
  }
  sideStart(a);
  toast(S.type === 'deliver' ? `拿到${S.item}：${a.lim} 秒內送到` : S.type === 'collect' ? `撿齊五個${S.item}` : `${S.title}：去目標路口`);
}
function taleStep(a, dt) {
  const S = a.S;
  a.t += dt;
  if (a.lim && a.t > a.lim) { taleFail(a, '時間到了'); return; }
  if (S.type === 'fight') {
    if (!SQ.f.some(f => fUp(f) && f.grp === a)) taleDone(a);
  } else if (S.type === 'deliver') {
    if (Math.hypot(a.tgt.x - pX(), a.tgt.z - pZ()) < (player.mode === 'drive' ? 9 : 6)) taleDone(a);
  } else {
    const r = player.mode === 'drive' ? 3.2 : 1.6;
    for (const it of [...a.items]) {
      it.m.rotation.y += dt * 2;
      if (Math.hypot(it.x - pX(), it.z - pZ()) < r) { scene.remove(it.m); a.items.splice(a.items.indexOf(it), 1); sfx.pickup(); toast(`${S.item} ${5 - a.items.length} / 5`); }
    }
    if (!a.items.length) taleDone(a);
  }
}
function taleHud(a) {
  const S = a.S, left = a.lim ? Math.max(0, a.lim - a.t) : 0;
  if (S.type === 'fight') { const n = SQ.f.filter(f => fUp(f) && f.grp === a).length; return { text: `打倒${GANG_NAME}`, bar: -1, num: `${n} 人` }; }
  if (S.type === 'deliver') return { text: `把${S.item}送到目標`, bar: left / a.lim * 100, num: `${Math.ceil(left)} 秒`, low: left < 15 };
  return { text: `撿${S.item} · ${5 - a.items.length} / 5`, bar: left / a.lim * 100, num: `${Math.ceil(left)} 秒`, low: left < 30 };
}
function taleMark(a) {
  let q = a.tgt;
  if (a.S.type === 'collect') { let bd = 1e9; for (const it of a.items) { const d = Math.hypot(it.x - pX(), it.z - pZ()); if (d < bd) { bd = d; q = it; } } }
  return { name: a.S.type === 'collect' ? a.S.item : a.S.title, x: q.x, y: 1.5, z: q.z, where: 'out' };
}
function taleDone(a) {
  const G = a.G, S = a.S;
  sideEnd();
  motors.side.tale[G.id] = a.n + 1; saveMotors();
  earn(S.pay, `${G.name}的委託`);
  sideDone('JOB DONE', `${G.name}的委託 · ${S.title}`, [['報酬', money(S.pay)], ['進度', `${a.n + 1} / ${G.steps.length}`]], 0);
  setTimeout(() => phoneMsg(`${G.name}：${S.done}`), 2500);
}
function taleFail(a, why) { sideEnd(); toast(`委託失敗：${why}（回去找${a.G.name}可以重接）`); }

// ─── 地圖 ───
function taleMini(ctx, P2, zoom) {
  const a = side.act;
  if (!a || a.kind !== 'tale') return;
  ctx.fillStyle = TALE_HEX;
  for (const it of a.items) { const [x, y] = P2(it.x, it.z); ctx.beginPath(); ctx.arc(x, y, 4 / zoom * 1.4, 0, 7); ctx.fill(); }
}
function taleBlips(add) {
  for (const G of TALES) {
    const P = taleAt(G), n = taleStage(G), S = G.steps[n];
    add('tale', { name: `${G.name} · ${G.role}`, txt: n >= G.steps.length ? '✓' : '?', x: P.x, z: P.z, type: '支線委託', rows: [['進度', `${n} / ${G.steps.length}`], ['下一段', S ? `${S.title}（${money(S.pay)}）` : '全部完成']], desc: S ? '走到他面前按 E 聽委託。' : G.end });
  }
}

// 測試 API（window.__nc.gta.tale）
const taleApi = {
  TALES, at: id => taleAt(TALES.find(G => G.id === id)), stage: id => taleStage(TALES.find(G => G.id === id)),
  start: (id, n) => { const G = TALES.find(q => q.id === id); taleStart(G, n ?? taleStage(G)); return !!side.act; },
  act: () => side.act && side.act.kind === 'tale' ? side.act : null,
  // 撿東西的位置：地面高度與碰撞推開的距離（落在樓裡會被推開好幾公尺）
  probe: () => (side.act ? side.act.items : []).map(it => { const r = collideCircle(it.x, it.z, .3, false); return { gh: +groundH(it.x, it.z).toFixed(2), push: +Math.hypot(r.x - it.x, r.z - it.z).toFixed(2), d: Math.round(Math.hypot(it.x - pX(), it.z - pZ())) }; }),
  // 直接完成目前這一段的條件：打倒、送達（把玩家擺到目標）、撿齊
  skip: () => {
    const a = side.act;
    if (!a || a.kind !== 'tale') return;
    if (a.S.type === 'fight') { for (const f of SQ.f) if (fUp(f) && f.grp === a) fHit(f, 999, 0, 1, true); }
    else if (a.S.type === 'deliver') { const o = player.mode === 'drive' ? player.veh : player; o.x = a.tgt.x; o.z = a.tgt.z; }
    else for (const it of a.items) { it.x = pX(); it.z = pZ(); }
  },
};
