// ═══ 主線《一手爛牌》（plans/260-story.md）：雙主角羅莎與戴恩，七幕 38 個任務 ═══
// 地圖上一次只出現一個主線起點（下一個沒完成的任務），走進去按 E 看任務卡再決定要不要開始；不倒數、不催，失敗不扣錢。
// 進行中的任務是一項 side.act（kind 'story'，69-side.js），missionMark 的順序照舊；duo：雙主角之間切換不算失敗。
// 任務是 { id, ch, title, who, star, at（起點）, giver（起點旁站的人）, sw（任務中能切換的人）, bonus（附加目標）, first（首次完成的獎勵）, steps }，
// 步驟依序跑（STEP 表）：card 全黑的字卡、say 字幕對白、go 走到／開到、car 坐上指定的車、fight 打倒一群、collect 撿東西、
// fade 黑場傳送、rob 搶 BODEGA、lose 甩掉警察、fn 直接做一件事。
// 報酬照難度（★1–★5）乘獎牌倍率；重玩只補新舊獎牌的差額。存檔在 motors.story（65-motors.js 第 13 版）。
// 腳鐐：自由活動時操作羅莎、離灰石國宅超過 MON_R 公尺，警告 30 秒後加 1 星（4-3 之後解除）；1-3 之後有警用掃描器的小條。
// ?story=0：整套主線關掉（舊的「門禁」開場、五人都能切換），tools/lib.mjs 的驗收預設帶著它。
// 排在 69-v9-switch 之後、70-render 之前：post、camState、keys、inp 只能在函式裡用。

const STORY_OFF = /[?&]story=0\b/.test(location.search);
const storyOn = () => !STORY_OFF;
const ROSA = CREW.findIndex(c => c.id === 'rosa'), DANE = CREW.findIndex(c => c.id === 'dane');
const STORY_HEX = '#ffcf4a';
const STAR_PAY = [0, 20000, 50000, 100000, 200000, 400000];
const MEDAL = [{ id: 'bronze', name: '銅牌', k: 1 }, { id: 'silver', name: '銀牌', k: 1.25 }, { id: 'gold', name: '金牌', k: 1.5 }];
const CHAPTER = { P: ['序章', '手氣'], 1: ['第一章', '房租'], 2: ['第二章', '容易的一票'], 3: ['第三章', '夜城生意'], 4: ['第四章', '塞拉斯'], 5: ['第五章', '帳本'], F: ['終章', '一起跳'] };
const MON_R = 380, MON_WARN = 30;

// ─── 地點（邏輯座標 → 世界座標） ───
const ROSA_L = { x: lerp(avX(14) + HR + SW, avX(15) - HR - SW, .4), z: stZ(3) + HR + SW * .5 };
const DANE_L = { x: lerp(avX(12) + HR + SW, avX(13) - HR - SW, .5), z: stZ(12) + HR + SW * .5 };
const stAt = (L, dx = 0, dz = 0, yaw = Math.PI) => spotW({ x: L.x + dx, z: L.z + dz, yaw });
const ST_HERON = BANK_WALKS[0], ST_HZC = (FERRY[0].z0 + FERRY[0].z1) / 2;
const ST_PRISON = spotW({ x: (ST_HERON.x0 + ST_HERON.x1) / 2, z: ST_HZC - 70, yaw: 0 });   // 灰鷺女子監獄的大門：鷺岸步道北段（監獄本身只在過場出現）
const ST_YARD = spotW({ x: (ST_HERON.x0 + ST_HERON.x1) / 2, z: ST_HZC - 110, yaw: 0 });    // 序章回憶的放風場
const ST_FERRY = spotW({ x: (FERRY[0].x0 + FERRY[0].x1) / 2, z: ST_HZC, yaw: Math.PI / 2 });
const ST_PIER = spotW({ x: lerp(FERRY_DOCK.x0, FERRY_DOCK.x1, .75), z: (FERRY_DOCK.z0 + FERRY_DOCK.z1) / 2, yaw: Math.PI / 2 });   // 舊碼頭的木棧（渡輪靠岸的那一座）
const ST_DOCKS = () => taleCorner(1, 3, 1, 1);   // 舊碼頭倉庫前的人行道轉角
const ST_BODEGA = () => APT.store.doorW;
// 1-5 的起點：離灰石國宅 MON_R + 120 m 上下、最近的路口轉角（羅莎要趕回範圍內）
let farSpot = null;
function storyFar() {
  if (farSpot) return farSpot;
  const H = CREW[ROSA].home;
  let best = null, bd = 1e9;
  for (let i = 1; i < NX; i++) for (let j = 1; j < NZ; j++) {
    const q = taleCorner(i, j, 1, 1), d = Math.abs(Math.hypot(q.x - H.x, q.z - H.z) - (MON_R + 120));
    if (d < bd && groundH(q.x, q.z) > 0) { bd = d; best = q; }
  }
  return (farSpot = best || taleCorner(9, 5, 1, 1));
}

// ─── 配角（自己的一組 crowd；雙主角與既有三人用 CREW 的外觀） ───
const CAST = {
  lupe: { name: '盧佩', role: '羅莎的母親', look: { female: true, top: 0x6a4a5a, bot: 0x3a3330, hair: 2, longHair: 1, coat: 1, skirt: 1, scale: .93 } },
  hollis: { name: '霍利斯', role: '「船長」· 船廠老闆', look: { female: false, top: 0x2e4a5a, bot: 0x3a352c, hair: 2, coat: 1, hat: 1, scale: 1.01 } },
  dottie: { name: '朵蒂', role: '船廠老闆娘', look: { female: true, top: 0xd86a8a, bot: 0x2b2a2e, hair: 1, longHair: 1, coat: 0, skirt: 1, scale: .95, glow: 0xff7ab0, glowI: .7 } },
  otis: { name: '奧帝斯', role: '隔壁聽無線電的人', look: { female: false, top: 0x4a5a3a, bot: 0x2a2c30, hair: 0, coat: 0, hat: 1, scale: .98 } },
  parole: { name: '假釋官', role: '霍布斯 · 第九分局轄區', look: { female: false, top: 0x1d2330, bot: 0x16181c, hair: 1, coat: 1, hat: 0, scale: 1.02 } },
  inmate: { name: '獄友', role: '', look: { female: true, top: 0xd8782a, bot: 0xd8782a, hair: 0, longHair: 0, coat: 0, skirt: 0, scale: .98 } },
  biker: { name: '鐵鏽騎士', role: '', look: { female: false, top: 0x2a1c14, bot: 0x1a1a1e, hair: 0, coat: 1, hat: 0, scale: 1.04 } },
  pit: { name: '擂台對手', role: '', look: { female: true, top: 0x8a1c22, bot: 0x18181c, hair: 0, longHair: 0, coat: 0, skirt: 0, scale: 1.02 } },
  silas: { name: '塞拉斯', role: '老派的銀行搶匪', look: { female: false, top: 0x3a2a20, bot: 0x22201e, hair: 2, coat: 1, hat: 0, scale: 1.02 } },
  nadia: { name: '娜迪亞', role: '羅莎的獄友 · 開保險箱的', look: { female: true, top: 0x23262c, bot: 0x18191c, hair: 0, longHair: 1, coat: 1, skirt: 0, scale: .96 } },
  hall: { name: '霍爾', role: '第九分局副局長', look: { female: false, top: 0x1a2232, bot: 0x14161c, hair: 0, coat: 1, hat: 1, scale: 1.03 } },
  oakes: { name: '蒙洛', role: '「大橡」· LAZARUS 老闆', look: { female: false, top: 0x1c1a20, bot: 0x16151a, hair: 0, coat: 1, hat: 0, scale: 1.05, glow: 0xd8b04a, glowI: .35 } },
  twade: { name: '泰倫斯', role: '「T-Wade」· 唱片公司合夥人', look: { female: false, top: 0xe8e2d4, bot: 0x2a3a5a, hair: 1, coat: 0, hat: 1, scale: 1 } },
  jada: { name: '潔妲', role: 'STEREO', look: { female: true, top: 0xb83a8a, bot: 0x1a1a22, hair: 1, longHair: 1, coat: 0, skirt: 0, scale: .96, glow: 0xff5ad0, glowI: .6 } },
  kiki: { name: '奇奇', role: 'STEREO', look: { female: true, top: 0x3ad0c8, bot: 0x22222a, hair: 2, longHair: 0, coat: 1, skirt: 1, scale: .94, glow: 0x5af0ff, glowI: .6 } },
  rosa: { ci: ROSA }, dane: { ci: DANE }, jax: { ci: CREW.findIndex(c => c.id === 'jax') }, kael: { ci: CREW.findIndex(c => c.id === 'kael') }, vance: { ci: CREW.findIndex(c => c.id === 'vance') },
};
// 雙主角的掃描身體（blender/scan_people.py 的 rosa、dane：renderpeople 的掃描綁到 UBC 骨架）：登記好再重看一次站在原地的兩人
Object.assign(SCAN_SEX, { rosa: 'Female', dane: 'Male' });
crewLook();
const CAST_IDS = Object.keys(CAST), CAST_CI = CAST_IDS.filter(id => CAST[id].ci !== undefined);
const castCrowd = crowd(CAST_IDS.length);
scene.add(castCrowd.mesh);
const castName = id => { const c = CAST[id]; return c.ci !== undefined ? CREW[c.ci].zh : c.name; };
function castLook(k, id) {
  const c = CAST[id];
  if (c.ci !== undefined) return { r: rng(31 + c.ci), ...CREW[c.ci].look };
  const L = c.look;
  return { r: rng(900 + k), ...L, top: lin(L.top), bot: lin(L.bot), hair: HAIRS[L.hair], skin: SKINS[(k * 2 + 1) % SKINS.length], shoe: SHOES[k % SHOES.length], glow: L.glow ? lin(L.glow) : undefined, glowI: L.glowI || 0 };
}

// ─── 存檔與狀態 ───
const ORDER = ['P-1', 'P-2', 'P-3', '1-1', '1-2', '1-3', '1-4', '1-5', 'next'];   // 'next'：還沒寫的下一章（storyAdd 插在它前面）
let S = null;   // motors.story
function storyInit() {
  if (!storyOn()) return;
  if (!motors.story || motors.story.v !== 1) {
    const old = !!motors.old;   // 舊存檔：三人照舊能操作，地圖上出現序章的起點，但不強迫進序章
    motors.story = { v: 1, m: 'P-1', ck: 0, medal: {}, flags: { monitor: 1, fame: 0, end: null, house: 0, scan: 0 }, cast: { vance: +old, kael: +old, jax: +old, dane: +old }, done: [], fresh: !old };
    saveMotors();
  }
  S = motors.story;
  S.flags ||= {}; S.cast ||= {}; S.medal ||= {}; S.done ||= [];
}
storyInit();
const isDone = id => S && S.done.includes(id);
const castOf = i => i === ROSA ? 1 : i === DANE ? S.cast.dane : S.cast[CREW[i].id];
// 69-crew.js 的轉盤、地圖與切換：這一位能不能切換過去
function storyAvail(i) {
  if (!S) return true;
  const a = side.act;
  if (a && a.kind === 'story') return a.M.sw.includes(i);
  return !!castOf(i);
}
function storyLockWhy(i) {
  const a = side.act;
  if (S && a && a.kind === 'story') return `主線任務「${a.M.title}」進行中，只能切換${a.M.sw.map(k => CREW[k].zh).join('和')}`;
  return `${CREW[i].zh}還沒登場`;
}
// 通緝中也能切換：主線任務裡的雙主角之間
function storyDuoSwitch(i) { const a = side.act; return !!(S && a && a.kind === 'story' && a.M.sw.length > 1 && a.M.sw.includes(i)); }
// 60-venues.js 的「門禁」：開場的任務框與目標（主線開著時）
function storyQuest0() { return !storyOn() ? 0 : S.fresh || !isDone('3-1') && !motors.old ? 6 : 5; }
function storyMarloAgain() { return !!(S && motors.old); }

// ─── 任務表 ───
// 字幕的說話人：CAST 的 id，或直接寫名字
const L = (who, text) => [who, text];
const MISSIONS = [
  { id: 'P-1', ch: 'P', title: '第 1094 天', who: ROSA, star: 0, at: () => CREW[ROSA].home, giver: null, auto: true,
    desc: '假釋審查前的最後一天。', bonus: [],
    steps: [
      { type: 'card', k: '序章', t: '手氣', hold: 2.4 },
      { type: 'card', k: '灰鷺女子監獄 · 假釋審查', t: '第 1094 天', lines: [
        L('假釋委員', '伊巴拉小姐，妳在這裡待了一千零九十四天。妳覺得自己為什麼會在這裡？'),
        L('羅莎', '……手氣差吧。'),
        L('假釋委員', '手氣。'),
        L('羅莎', '我替不該替的人扛了東西。這次出去，我只走聰明的棋。'),
        L('假釋委員', '妳的檔案說，妳在放風場不太安分。'),
      ] },
      { type: 'fade', to: () => ST_YARD, gray: .7, toast: '回憶 · 放風場' },
      { type: 'fight', text: '放風場的打架：空手按左鍵出拳', at: () => ST_YARD, n: 2, brawl: true, r: 3.2, cast: 'inmate' },
      { type: 'card', k: '灰鷺女子監獄 · 假釋審查', t: '第 1094 天', lines: [
        L('假釋委員', '本委員會核准假釋，附帶電子監控。範圍是妳母親在灰石國宅的住處。'),
        L('假釋委員', '走出範圍，警察會比妳先到家。下一位。'),
      ] },
      { type: 'fade', to: () => ST_PRISON, gray: 0, toast: '出獄當天的早上' },
    ] },
  { id: 'P-2', ch: 'P', title: '出閘', who: ROSA, star: 1, at: () => ST_PRISON, giver: 'dane', giverAt: () => spotW({ ...toLs(ST_PRISON), x: toLs(ST_PRISON).x + 1.6, yaw: Math.PI }),
    desc: '戴恩在監獄門口等。搭渡輪過河，再開他的破車回灰石國宅。',
    bonus: [{ t: '戴恩的車沒什麼刮傷（車況 85% 以上）', ok: a => !a.car || a.car.hp >= a.carHp0 * .85 }, { t: '4 分鐘內到家', ok: a => a.t < 240 }],
    first: () => { if (!motors.owned.includes('e34')) { motors.owned.push('e34'); toast('戴恩的破車（BMW E34）收進車庫了'); } },
    steps: [
      { type: 'say', with: 'dane', lines: [L('dane', '三年。妳看起來一點都沒變。'), L('rosa', '你看起來老了。車呢？'), L('dane', '停在對岸。這一頭的路被河切斷了，我們得搭渡輪。'), L('dane', '腳上那個東西會叫嗎？'), L('rosa', '只要我乖乖待在灰石國宅附近，它就不會。')] },
      { type: 'fn', fn: a => palOn(a, DANE) },
      { type: 'go', text: '和戴恩走到鷺岸渡口', to: () => ST_FERRY, r: 6, name: '鷺岸渡口' },
      { type: 'fade', to: () => ST_PIER, min: 20, toast: '渡輪靠上舊碼頭' },
      { type: 'fn', fn: a => storyCar(a, 'e34', ST_PIER, '戴恩的 E34') },
      { type: 'say', lines: [L('dane', '歡迎回到夜城。車就在前面，別嫌它。'), L('rosa', '它還發得動？'), L('dane', '大部分的時候。')] },
      { type: 'car', text: '坐上戴恩的破車' },
      { type: 'go', text: '開回灰石國宅', to: () => CREW[ROSA].home, r: 10, name: '灰石國宅', drive: true },
      { type: 'say', lines: [L('dane', '到了。妳媽還住在這裡？'), L('rosa', '她一直沒搬。謝謝你來接我。'), L('dane', '船廠那邊有事就打給我。')] },
      { type: 'fn', fn: a => { palOff(a); storyDropCar(a, true); } },
    ] },
  { id: 'P-3', ch: 'P', title: '母親的信', who: ROSA, star: 0, at: () => CREW[ROSA].home, giver: 'lupe', giverAt: () => stAt(ROSA_L, 1.8, -.6),
    desc: '回家。母親有話要說。', bonus: [],
    first: () => { S.flags.house = S.flags.house || 0; },
    steps: [
      { type: 'say', with: 'lupe', lines: [L('lupe', '羅莎……妳瘦了。進來，雨要下大了。'), L('lupe', '這封信上個月就到了。天際置業說這一整排要改建。'), L('rosa', '「九十天內付清四十八萬，否則收回」……他們憑什麼？'), L('lupe', '說是我晚繳了兩期。我繳了，收據都在，他們說系統裡沒有。'), L('rosa', '媽，別擔心。我來想辦法。'), L('lupe', '妳一說這句話，我就更擔心了。')] },
      { type: 'fn', fn: () => { phoneMsg('天際置業：伊巴拉女士的房屋貸款已列入法拍程序，請於 90 天內清償 $480,000。'); } },
    ] },
  { id: '1-1', ch: 1, title: '修漏水', who: DANE, star: 1, at: () => CREW[DANE].home, giver: 'hollis', giverAt: () => stAt(DANE_L, 2.2, -.4),
    desc: '船廠老闆霍利斯要戴恩去收這個月的房租。', sms: '霍利斯：屋頂又在漏了。修完過來，有活給你。',
    bonus: [{ t: '2 分 30 秒內收齊', ok: a => a.tStep[1] < 150 }, { t: '沒受傷', ok: a => a.hurt < 1 }],
    first: () => { S.cast.dane = 1; toast('現在可以切換成戴恩了（Q）'); },
    steps: [
      { type: 'say', with: 'hollis', lines: [L('hollis', '補好了？很好。屋頂不漏，房客就沒理由不繳。'), L('hollis', '這條街五戶，每戶一張支票。有人說手頭緊，你就看著他，看到他不緊為止。'), L('dane', '我是來修屋頂的，船長。'), L('hollis', '你是來住免錢的拖車屋的。去吧。')] },
      { type: 'collect', text: '挨家收支票', item: '支票', spots: () => [[12, 11, 1, 1], [13, 11, -1, 1], [13, 12, -1, -1], [11, 12, 1, 1], [12, 13, 1, -1]].map(([i, j, sx, sz]) => taleCorner(i, j, sx, sz)) },
      { type: 'go', text: '把支票交給霍利斯', to: () => stAt(DANE_L, 2.2, -.4), r: 3, name: '霍利斯' },
      { type: 'say', with: 'hollis', lines: [L('hollis', '五張，一張不少。你比上一個催收的好用。'), L('hollis', '他後來去哪了？我也不知道。')] },
    ] },
  { id: '1-2', ch: 1, title: '兩捆', who: DANE, star: 2, at: () => CREW[DANE].home, giver: 'hollis', giverAt: () => stAt(DANE_L, 2.2, -.4),
    desc: '有人在舊碼頭倉庫等著要回「兩捆貨」。', sms: '霍利斯：舊碼頭倉庫有幾個人在找我。你去跟他們聊聊。',
    bonus: [{ t: '生命沒掉超過 40', ok: a => a.hurt <= 40 }, { t: '爆頭 2 次', ok: a => a.heads >= 2 }],
    first: () => { S.flags.jaxDisc = 1; toast('賈克斯的軍火打 9 折'); },
    steps: [
      { type: 'say', with: 'hollis', lines: [L('hollis', '有個叫賈克斯的，說我欠他兩捆貨。'), L('dane', '你欠嗎？'), L('hollis', '我欠很多人很多東西。去舊碼頭倉庫，讓他知道這裡不是他喊價的地方。')] },
      { type: 'go', text: '開到舊碼頭倉庫', to: ST_DOCKS, r: 14, name: '舊碼頭倉庫' },
      { type: 'fight', text: `打倒賈克斯帶來的人`, at: ST_DOCKS, n: 4, guns: ['pistol', 'smg', 'pistol', 'shotgun'], r: 4, npc: { id: 'jax', dx: 6 } },
      { type: 'say', with: 'jax', lines: [L('jax', '好了好了！夠了。你不是霍利斯的人吧？你打起來像當過兵的。'), L('dane', '陸軍，兩次派駐。'), L('jax', '那兩捆貨是被霍利斯的人吃掉的。你替他擋子彈，他連你的名字都記不住。'), L('jax', '下次缺傢伙，來找我。看在你打倒我四個人的份上，算你便宜。')] },
    ] },
  { id: '1-3', ch: 1, title: '蘭姆潘趣', who: DANE, star: 0, at: () => CREW[DANE].home, giver: 'dottie', giverAt: () => stAt(DANE_L, -2.2, -.4),
    desc: '朵蒂要請喝一杯。', sms: '朵蒂：甜心，今晚來喝一杯我的蘭姆潘趣。', bonus: [],
    first: () => { S.flags.scan = 1; toast('解鎖：警用掃描器（右上角的小條）'); },
    steps: [
      { type: 'say', with: 'dottie', lines: [L('dottie', '霍利斯說你把碼頭那群人打發了。來，這杯算我的。'), L('dane', '這裡面放了多少蘭姆酒？'), L('dottie', '剛好讓人說實話的份量。'), L('otis', '（隔壁傳來無線電的雜音）……第九分局各單位，灰石國宅一帶……'), L('dane', '那是誰？'), L('dottie', '奧帝斯，住隔壁。他整天聽海巡跟警察的頻道，比報紙還準。')] },
      { type: 'say', with: 'otis', lines: [L('otis', '你就是那個退伍兵？給你。'), L('otis', '我改過的掃描器，接在手機上。警察要派車、搜到哪裡，你會比他們的車先知道。'), L('dane', '你為什麼幫我？'), L('otis', '因為霍利斯不會。')] },
    ] },
  { id: '1-4', ch: 1, title: '夜貓', who: DANE, star: 2, at: () => CREW[ROSA].home, giver: 'rosa', giverAt: () => stAt(ROSA_L, -1.6, -.6), sw: [DANE, ROSA],
    desc: '羅莎缺錢，戴恩缺膽子。中城的 BODEGA 夜貓便利店，搶完甩掉警察。', sms: '羅莎：你說過有事就打給你。現在有事。',
    bonus: [{ t: '店員毫髮無傷', ok: a => !a.clerkHit }, { t: '2 分鐘內甩掉警察', ok: a => a.tStep[a.loseK] < 120 }],
    first: () => { S.flags.mask = 1; S.flags.fame = (S.flags.fame || 0) + 10; toast('解鎖：面罩配件；名氣 +10'); },
    steps: [
      { type: 'say', with: 'rosa', lines: [L('rosa', '我算過了。照我現在洗碗的時薪，四十八萬要做二十年。'), L('dane', '所以？'), L('rosa', '所以中城那間 BODEGA，十點以後只有一個店員。'), L('dane', '……後車廂有兩頂面罩，跟一把我從來沒用過的槍。'), L('rosa', '那今晚就用一次。')] },
      { type: 'fn', fn: a => palOn(a, ROSA) },
      { type: 'go', text: '和羅莎到 BODEGA 夜貓便利店', to: ST_BODEGA, r: 2.6, name: 'BODEGA' },
      { type: 'enter', text: '走進便利店', where: 'store' },
      { type: 'rob', text: '拿槍指著店員，等他把錢倒進袋子' },
      { type: 'leave', text: '離開便利店' },
      { type: 'lose', text: '甩掉警察（Q 可以切換成羅莎）' },
      { type: 'say', lines: [L('rosa', '……我們真的做了。'), L('dane', '妳的手在抖。'), L('rosa', '是你的手在抖。')] },
      { type: 'fn', fn: a => { palOff(a); phoneMsg('奧帝斯：你們兩個上了街拍熱門。戴面罩那個女的，把店員的槍踢進冰櫃那一下，已經十萬次觀看了。'); } },
    ] },
  { id: '1-5', ch: 1, title: '假釋官', who: ROSA, star: 2, at: storyFar, giver: null,
    desc: '假釋官突擊家訪。羅莎得在 90 秒內趕回家。', sms: '羅莎（備忘）：週四下午別亂跑，假釋官可能會來。',
    bonus: [{ t: '60 秒內到家', ok: a => a.tStep[2] < 60 }, { t: '一路上沒被通緝', ok: a => !a.peak }],
    steps: [
      { type: 'fn', fn: a => storyCar(a, 'grc_sedan', storyFar(), '路邊的轎車', true) },
      { type: 'say', phone: '假釋官', lines: [L('假釋官', '伊巴拉小姐，我是霍布斯。我人在妳母親家門口。'), L('假釋官', '妳的腳鐐顯示妳不在範圍內。九十秒，我只等九十秒。')] },
      { type: 'go', text: '90 秒內趕回灰石國宅', to: () => CREW[ROSA].home, r: 6, name: '灰石國宅', lim: 90 },
      { type: 'fn', fn: a => { storyDropCar(a); a.npc.parole = stAt(ROSA_L, -1.8, -.4); } },
      { type: 'say', with: 'parole', lines: [L('parole', '八十七秒。妳跑得很喘。'), L('rosa', '我去買牛奶。'), L('parole', '牛奶呢？'), L('rosa', '……賣完了。'), L('parole', '下次腳鐐再叫，我就不打電話了，直接帶人來。')] },
    ] },
];
const MS = Object.fromEntries(MISSIONS.map(m => [m.id, m]));
for (const m of MISSIONS) m.sw ||= [m.who];
// 之後各章的檔案（69-w1-ch2.js…）把任務接在後面
function storyAdd(list) { for (const m of list) { m.sw ||= [m.who]; m.bonus ||= []; MISSIONS.push(m); MS[m.id] = m; if (!ORDER.includes(m.id)) ORDER.splice(ORDER.length - 1, 0, m.id); } }
const toLs = s => { const [x, z] = toL(s.x, s.z); return { x, z, yaw: s.yaw || 0 }; };

// ─── 起點與任務卡 ───
// 下一個要玩的任務：存檔記的是還沒寫好的下一章（'next'）時，新的章節接上後改成第一個沒完成的任務
function storyNext() {
  if (!S) return null;
  if (!MS[S.m] && S.m !== 'end') { const f = ORDER.find(id => MS[id] && !S.done.includes(id) && (!MS[id].route || MS[id].route === S.flags.route)); if (f) S.m = f; }   // route：終章兩條路只算選了的那條
  return MS[S.m] || null;
}
// 任務框（沒有任務在跑時）與地圖目標（60-venues.js 的 QUEST[5]、QUEST[6]）
function storyIdleText() {
  if (!S) return '';
  const m = storyNext();
  if (!m) return S.m !== 'end' ? '下一章即將開放 · 城市是你的' : '';
  return `主線 ${m.id}「${m.title}」· ${storyWhere(m)}`;
}
function storyWhere(m) { const p = m.at(); return districtW(p.x, p.z).split(' ')[0]; }
function storyIdleMark() {
  const m = storyNext();
  if (!m || side.act || SQ.def || heist.st !== 'off' && heist.st !== 'plan') return null;
  const p = m.at();
  return { name: `${CREW[m.who].name[0]} · ${m.title}`, x: p.x, y: 2.2, z: p.z, where: 'out' };
}
function storyObj() {
  if (!S || side.act || SQ.def || heist.st !== 'off' && heist.st !== 'plan') return;
  const m = storyNext(), sm = $('obj').querySelector('small'), c = m ? CHAPTER[m.ch] : null;
  if (SQ.objSmall || heist.objSmall) return;
  sm.innerHTML = c ? `${c[0]} <i>· ${c[1]}</i>` : '主線 <i>· 一手爛牌</i>';
  if (quest.n >= 5) setText('objText', storyIdleText() || QUEST[quest.n].text);
}
// split：搶案任務照分贓算（69-heist.js 的 heistPass 發），主線只發獎牌加成
const SPLIT_PAY = [0, 100000, 200000];
const payOf = (m, k) => m.split ? SPLIT_PAY[k] : m.star ? Math.round(STAR_PAY[m.star] * MEDAL[k].k) : 0;
function storyCard(m) {
  const c = CHAPTER[m.ch], best = S.medal[m.id];
  const rows = [m.split ? `難度 ${'★'.repeat(m.star)}${'☆'.repeat(5 - m.star)} · 報酬照搶案分贓（銀牌加 ${money(SPLIT_PAY[1])}、金牌加 ${money(SPLIT_PAY[2])}）` : m.star ? `難度 ${'★'.repeat(m.star)}${'☆'.repeat(5 - m.star)} · 報酬 ${money(STAR_PAY[m.star])}（金牌 ${money(payOf(m, 2))}）` : '劇情任務',
    ...(m.bonus.length ? [`附加目標：${m.bonus.map(b => b.t).join('、')}`] : []), ...(best != null ? [`最好成績：${MEDAL[best].name}`] : [])];
  dialog(`${c[0]} · ${c[1]} — ${m.id}「${m.title}」`, `${m.desc}\n${rows.join('\n')}`, [
    { t: `開始（操作${CREW[m.who].zh}）`, fn: () => { closeDialog(); const b = storyBusy(); if (b) { toast(b); return; } storyStart(m); } },
    { t: '先不要', fn: closeDialog },
  ]);
}
function storyBusy() {
  const b = sideBusy();
  if (b && b !== '先甩掉警察') return b;
  if (W.stars) return '先甩掉警察';
  return '';
}
// 起點的圈：走到 3 m 內按 E
ctxHooks.unshift(p => {
  if (!S || p.mode !== 'walk' || p.where !== 'out' || side.act || dlg.open) return null;
  const m = storyNext(); if (!m) return null;
  const q = m.at();
  if (Math.hypot(p.x - q.x, p.z - q.z) > 3) return null;
  return { key: 'E', text: `主線 ${m.id}「${m.title}」<i>· ${CREW[m.who].zh}</i>`, fn: () => storyCard(m) };
});
const startRing = neonRing(0xffcf4a, 1.05);

// ─── 進行中 ───
const STEP = {}, storyCleanups = [], storyTicks = [];   // 各章的任務收尾與每幀（運鈔車、快艇……）
function storyStart(m, ck = 0) {
  if (side.act) sideEnd();
  const a = {
    kind: 'story', duo: true, M: m, k: -1, name: m.title, label: `<b>${m.title}</b> · ${CHAPTER[m.ch][0]} ${m.id}`,
    t: 0, st: 0, tStep: [], hurt: 0, peak: 0, heads: 0, kills: 0, melee: 0, clerkHit: false, items: [], grp: null, pal: -1, car: null, npc: {}, cur: null, hp0: life.hp,
    step: dt => storyStep(a, dt), hud: () => storyHud(a), mark: () => storyMarkA(a), fail: why => storyFail(a, why), clear: () => storyClear(a),
  };
  S.retry = null;
  const go = () => {
    if (crew.cur !== m.who) { crewSave(); crewApply(m.who); }
    const p = m.at();
    if (player.mode === 'drive') exitVehicle();
    setWhere('out');
    if (Math.hypot(player.x - p.x, player.z - p.z) > 12) { player.x = p.x; player.z = p.z; player.y = spawnY(p.x, p.z); player.yaw = camState.yaw = p.yaw || 0; camState.snap = true; }
    a.hp0 = life.hp;
    sideStart(a);
    if (m.giver) a.npc[m.giver] = m.giverAt();
    if (m.cast) for (const id in m.cast) a.npc[id] = m.cast[id]();
    if (ck > 0) a.k = ck - 1;   // 從檢查點那一步開始
    storyAdvance(a);
  };
  if (crew.cur !== m.who || player.where !== 'out' || Math.hypot(pX() - m.at().x, pZ() - m.at().z) > 12) transition(go); else go();
}
function storyAdvance(a) {
  if (a.k >= 0) a.tStep[a.k] = a.st;
  a.k++; a.st = 0; a.cur = null;
  const s = a.M.steps[a.k];
  if (!s) { storyPass(a); return; }
  if (s.ck) a.ckK = a.k;   // 檢查點：失敗後從這一步重來
  a.cur = { s };
  (STEP[s.type].start || (() => {}))(a, s, a.cur);
}
function storyStep(a, dt) {
  if (!a.cur) return;
  a.t += dt; a.st += dt;
  const hp = life.hp + life.armor;
  if (a.hpPrev != null && hp < a.hpPrev) a.hurt += a.hpPrev - hp;
  a.hpPrev = hp;
  a.peak = Math.max(a.peak, W.stars);
  if (player.veh) (a.vehs ||= new Set()).add(player.veh);
  palStep(a, dt);
  for (const f of storyTicks) f(a, dt);
  const s = a.cur.s;
  if (s.lim && a.st > s.lim) { storyFail(a, '時間到了'); return; }
  if (STEP[s.type].step(a, s, a.cur, dt)) storyAdvance(a);
}
function storyHud(a) {
  const s = a.cur && a.cur.s;
  if (!s) return { text: a.M.title, bar: -1 };
  if (STEP[s.type].ownHud) return null;   // 69-side.js 的 sideUpdate 不寫任務框（搶案自己寫）
  const h = STEP[s.type].hud ? STEP[s.type].hud(a, s, a.cur) : { text: s.text || a.M.title, bar: -1 };
  if (s.lim) { const left = Math.max(0, s.lim - a.st); return { ...h, bar: left / s.lim * 100, num: `${Math.ceil(left)} 秒`, low: left < 15 }; }
  return h;
}
function storyMarkA(a) {
  const s = a.cur && a.cur.s;
  return s && STEP[s.type].mark ? STEP[s.type].mark(a, s, a.cur) : null;
}
function storyClear(a) {
  palOff(a);
  turfFree(a);
  for (const it of a.items) scene.remove(it.m);
  a.items.length = 0;
  storyDropCar(a);
  if (say.on) sayEnd(false);
  cardOff();
  for (const f of storyCleanups) f(a);
  a.npc = {};
}
function storyPass(a) {
  const m = a.M;
  const ok = m.bonus.map(b => !!b.ok(a)), n = ok.filter(Boolean).length;
  const k = !m.bonus.length ? 0 : n === m.bonus.length ? 2 : n * 2 >= m.bonus.length ? 1 : 0;
  const first = !isDone(m.id), prev = S.medal[m.id];
  const pay = Math.max(0, payOf(m, k) - (prev == null ? 0 : payOf(m, prev)));
  sideEnd();
  if (prev == null || k > prev) S.medal[m.id] = k;
  if (first) { S.done.push(m.id); m.first && m.first(); }
  const i = ORDER.indexOf(m.id);
  // next：分岔（F-3 選的路、F-4A／F-4B 接片尾）；重玩 F-3 時（主線已經走完，或停在另一條路的起點）也照新選的路走
  if (i >= 0 && (S.m === m.id || m.next && (S.m === 'end' || !m.route && MS[S.m] && MS[S.m].route))) {
    S.m = m.next ? m.next() : ORDER[i + 1] || 'end'; S.ck = 0;
    const nx = MS[S.m];
    if (nx && nx.sms) phoneMsg(nx.sms);
  }
  S.fresh = false;
  saveMotors();
  if (pay) earn(pay, `主線「${m.title}」`);
  storyObj();
  const rows = [...(m.star ? [[m.split ? '獎牌加成' : '報酬', pay ? money(pay) : prev != null ? '已領過（差額 $0）' : '$0']] : []), ...m.bonus.map((b, j) => [b.t, ok[j] ? '✓' : '—']), ...(m.bonus.length ? [['獎牌', MEDAL[k].name]] : [])];
  sideDone('MISSION PASSED', `${CHAPTER[m.ch][0]} ${m.id}「${m.title}」`, rows, 0);
  // 序章一開始是全黑的字卡：直接接下一關的起點（P-2 就在監獄門口）
}
function storyFail(a, why) {
  const m = a.M;
  sideEnd();
  if (!castOf(crew.cur)) S.back = 1;   // 失敗時操作的是還沒登場的人：之後換回羅莎
  S.retry = { id: m.id, why, ck: a.ckK || 0 }; S.ck = a.ckK || 0;
  saveMotors();
  toast(`任務失敗：${why}`);
}
// 失敗之後（等復活、出了室內）問要不要馬上重試
function storyRetryAsk() {
  const R = S.retry; if (!R) return;
  if (life.dead || dlg.open || fading || crew.sw || player.where !== 'out' || $('heistDone').classList.contains('on')) return;
  S.retry = null;
  const m = MS[R.id];
  dialog(`任務失敗 · ${m.id}「${m.title}」`, `${R.why}。失敗不扣錢，起點會一直留在地圖上。`, [
    ...(R.ck ? [{ t: '從檢查點重來', fn: () => { closeDialog(); const b = storyBusy(); if (b) { toast(b); storyBack(); return; } storyStart(m, R.ck); } }] : []),
    { t: R.ck ? '從頭開始' : '馬上重試', fn: () => { closeDialog(); const b = storyBusy(); if (b) { toast(b); storyBack(); return; } storyStart(m); } },
    { t: '先不要', fn: () => { closeDialog(); storyBack(); } },
  ]);
}
function storyBack() { if (S.back) { S.back = 0; if (!castOf(crew.cur)) transition(() => { crewSave(); crewApply(ROSA); }); } }

// ─── 步驟 ───
const tgtOf = c => c.to || (c.to = c.s.to());
STEP.fn = { start: (a, s) => s.fn(a), step: () => true };
STEP.card = {
  start: (a, s, c) => { c.i = -1; c.lt = 0; cardOn(s.k, s.t); if (!s.lines) c.lt = -(s.hold || 2.2); else cardNext(a, s, c); },
  step: (a, s, c, dt) => {
    c.lt += slowmo.raw;
    if (!s.lines) return c.lt >= 0 && cardDone(c);
    if (c.skip || c.lt > 2.4 + s.lines[c.i][1].length * .11) { c.skip = false; if (!cardNext(a, s, c)) return cardDone(c); }
    return false;
  },
  hud: (a, s) => ({ text: s.t, bar: -1 }),
};
function cardNext(a, s, c) {
  if (++c.i >= s.lines.length) return false;
  c.lt = 0;
  const [w, t] = s.lines[c.i];
  $('stCardS').innerHTML = `<em>${CAST[w] ? castName(w) : w}</em>${t}`;
  return true;
}
function cardDone(c) { if (!c.end) { c.end = 1; const nx = side.act && side.act.M.steps[side.act.k + 1]; if (!nx || nx.type !== 'card') cardOff(); } return true; }
function cardOn(k, t) { const el = $('stCard'); setText('stCardK', k); setText('stCardT', t); $('stCardS').innerHTML = ''; el.classList.add('on'); document.body.classList.add('cine'); }
function cardOff() { $('stCard').classList.remove('on'); if (!say.on) document.body.classList.remove('cine'); }
STEP.fade = {
  start: (a, s, c) => {
    c.wait = true;
    const nx = a.M.steps[a.k + 1];
    const keepCard = $('stCard').classList.contains('on');
    transition(() => {
      const p = s.to();
      if (player.mode === 'drive') exitVehicle();
      setWhere('out');
      player.x = p.x; player.z = p.z; player.y = spawnY(p.x, p.z); player.yaw = camState.yaw = p.yaw || 0; camState.snap = true;
      if (a.pal >= 0) palPlace(a);
      if (s.min) { clockSt.min = (clockSt.min + s.min) % 1440; }
      if (s.gray != null) a.gray = s.gray;
      if (!keepCard || !nx || nx.type !== 'card') cardOff();
      if (s.toast) toast(s.toast);
      c.wait = false;
    });
  },
  step: (a, s, c) => !c.wait && !fading,
  hud: () => ({ text: '……', bar: -1 }),
};
STEP.say = {
  start: (a, s, c) => sayStart(s, a, () => { c.fin = true; }),
  step: (a, s, c) => !!c.fin,
  hud: (a, s) => ({ text: s.phone ? `📞 ${s.phone}` : '對話中', bar: -1 }),
};
STEP.go = {
  step: (a, s, c) => {
    const q = tgtOf(c), r = s.r + (player.mode === 'drive' ? 4 : 0);
    if (s.drive && player.mode !== 'drive') return false;
    return player.where === 'out' && Math.hypot(q.x - pX(), q.z - pZ()) < r;
  },
  hud: (a, s, c) => { const q = tgtOf(c); return { text: s.text, bar: -1, num: `${Math.round(Math.hypot(q.x - pX(), q.z - pZ()))} m` }; },
  mark: (a, s, c) => { const q = tgtOf(c); return { name: s.name, x: q.x, y: 2, z: q.z, where: 'out' }; },
};
STEP.car = {
  step: (a) => !a.car || player.veh === a.car,
  hud: (a, s) => ({ text: s.text, bar: -1 }),
  mark: (a) => a.car && player.veh !== a.car ? { name: a.car.name, x: a.car.x, y: 2.2, z: a.car.z, where: 'out' } : null,
};
STEP.fight = {
  start: (a, s, c) => {
    const P = s.at(), guns = s.guns || ['pistol'];
    c.grp = a;   // storyClear 的 turfFree(a) 收掉沒打完的人
    fRoom(s.n);
    for (let i = 0; i < s.n; i++) {
      const t = i / s.n * Math.PI * 2, x = P.x + Math.sin(t) * s.r, z = P.z + Math.cos(t) * s.r;
      const f = fSpawn('gang', x, z, Math.atan2(P.x - x, P.z - z), { gun: s.brawl ? 'pistol' : guns[i % guns.length], brawl: s.brawl, esc: s.esc });   // esc：便衣（一身黑、和警察同一邊）
      if (!f) continue;
      f.grp = c.grp; f.calm = !s.brawl && !s.hot;   // hot：一出來就開打
      if (s.brawl) f.hp = s.hp || 70; else if (s.hp) f.hp = s.hp;
      if (s.brawl || s.cast) fighters.look(f.k, { ...castLook(f.k, s.cast || 'inmate'), r: rng(1300 + i), ...(s.tint ? { top: lin(s.tint[i % s.tint.length]) } : {}) });
    }
    if (s.npc) { const [lx, lz] = toL(P.x, P.z); a.npc[s.npc.id] = spotW({ x: lx + s.npc.dx, z: lz, yaw: -Math.PI / 2 }); }
  },
  step: (a, s, c) => !SQ.f.some(f => fUp(f) && f.grp === c.grp),
  hud: (a, s, c) => ({ text: s.text, bar: -1, num: `${SQ.f.filter(f => fUp(f) && f.grp === c.grp).length} 人` }),
  mark: (a, s) => { const P = s.at(); return { name: s.text, x: P.x, y: 2, z: P.z, where: 'out' }; },
};
STEP.collect = {
  start: (a, s, c) => {
    c.n = 0; c.all = 0;
    for (const q of s.spots()) { const m = neonRing(0xffcf4a, .42); ringAt(m, q.x, q.z, 1, 0, .8); a.items.push({ x: q.x, z: q.z, m }); c.all++; }
  },
  step: (a, s, c, dt) => {
    const r = player.mode === 'drive' ? 3.2 : 1.6;
    for (const it of [...a.items]) {
      it.m.rotation.y += dt * 2;
      if (Math.hypot(it.x - pX(), it.z - pZ()) < r) { scene.remove(it.m); a.items.splice(a.items.indexOf(it), 1); sfx.pickup(); c.n++; toast(`${s.item} ${c.n} / ${c.all}`); }
    }
    return !a.items.length;
  },
  hud: (a, s, c) => ({ text: `${s.text} · ${c.n} / ${c.all}`, bar: -1 }),
  mark: (a, s) => { let q = null, bd = 1e9; for (const it of a.items) { const d = Math.hypot(it.x - pX(), it.z - pZ()); if (d < bd) { bd = d; q = it; } } return q ? { name: s.item, x: q.x, y: 1.5, z: q.z, where: 'out' } : null; },
};
STEP.enter = {
  step: (a, s) => player.where === s.where,
  hud: (a, s) => ({ text: s.text, bar: -1 }),
  mark: () => { const q = ST_BODEGA(); return { name: 'BODEGA', x: q.x, y: 2.2, z: q.z, where: 'out' }; },
};
STEP.rob = {
  start: (a, s, c) => { c.done = false; a.robC = c; },
  step: (a, s, c) => { if (player.where === 'out' && !c.done) { storyFail(a, '還沒搶到錢就走了'); return false; } return c.done; },
  hud: (a, s) => ({ text: s.text, bar: -1 }),
};
STEP.leave = { step: () => player.where === 'out', hud: (a, s) => ({ text: s.text, bar: -1 }) };
STEP.lose = {
  start: (a, s, c) => { a.loseK = a.k; c.had = W.stars > 0; },
  step: (a, s, c) => { if (W.stars) c.had = true; return c.had && !W.stars || a.st > 4 && !W.stars; },
  hud: (a, s) => ({ text: W.stars ? s.text : '確認沒有人跟著……', bar: -1 }),
};

// ─── 字幕對白：鏡頭在說話的兩人旁邊（with 的人站在 a.npc 裡），沒有對象就繞著玩家轉 ───
const say = { on: false, lines: [], i: 0, lt: 0, t: 0, with: null, then: null, phone: '', side: 1, a0: 0 };
function sayStart(s, a, then) {
  Object.assign(say, { on: true, lines: s.lines, i: 0, lt: 0, t: 0, then, at: player.where, phone: s.phone || '', with: s.with ? sayWho(a, s.with) : null, a0: camState.yaw + Math.PI * .7, side: 1 });
  if (say.with) { const q = say.with, ux = q.x - pX(), uz = q.z - pZ(), l = Math.hypot(ux, uz) || 1, mx = (q.x + pX()) / 2, mz = (q.z + pZ()) / 2;
    const free = sd => { const x = mx - uz / l * sd * 3.4, z = mz + ux / l * sd * 3.4, r = collideCircle(x, z, .5, false); return -Math.hypot(r.x - x, r.z - z); };
    say.side = free(1) >= free(-1) ? 1 : -1; }
  if (player.mode === 'walk') player.v = 0;
  cineShow(true); sayLine(); sfx.click();
}
// 對白的對象：站在旁邊的配角（a.npc），或任務裡跟著的另一位主角
function sayWho(a, id) {
  if (a.npc[id]) return a.npc[id];
  const ci = CAST[id] && CAST[id].ci;
  if (ci !== undefined && a.palF && a.palF.on && a.pal === ci) return a.palF;
  return null;
}
function sayLine() {
  const [w, t] = say.lines[say.i];
  cineSub(`${say.phone ? '📞 ' : ''}${CAST[w] ? castName(w) : w}`, t);
}
function sayNext() {
  if (!say.on) return;
  say.lt = 0;
  if (++say.i < say.lines.length) { sayLine(); return; }
  sayEnd(true);
}
function sayEnd(fin) {
  const then = say.then; say.on = false; say.then = null;
  cineShow(false);
  if (fin && then) then();
}
// ─── 跟著的另一位主角（69-squads.js 的 'crew' 戰鬥員，打不死）；開車時收起來，下車再放到旁邊 ───
function palOn(a, ci) {
  for (const id in a.npc) if (CAST[id] && CAST[id].ci === ci) delete a.npc[id];   // 起點站著的那個身體換成跟著走的戰鬥員
  a.pal = ci; a.palAlt = a.M.sw.find(i => i !== ci) ?? -1; crew.st[ci].where = 'story'; palPlace(a); }
function palPlace(a) {
  if (a.palF && a.palF.on) fFree(a.palF);
  a.palF = null;
  if (a.pal < 0 || player.mode !== 'walk' || player.where !== 'out') return;
  fRoom(1);
  const yaw = player.yaw, x = pX() - Math.sin(yaw) * 1.8 + Math.cos(yaw) * 1.2, z = pZ() - Math.cos(yaw) * 1.8 - Math.sin(yaw) * 1.2;
  a.palF = fSpawn('crew', x, z, yaw, { ci: a.pal, gun: a.pal === DANE ? 'pistol' : 'smg', slot: 1 });
}
function palOff(a) {
  if (a.palF && a.palF.on) fFree(a.palF);
  a.palF = null;
  if (a.pal >= 0) { const st = crew.st[a.pal]; st.where = 'out'; if (st.x == null) { st.x = CREW[a.pal].home.x; st.z = CREW[a.pal].home.z; } }
  a.pal = -1;
}
function palStep(a) {
  if (a.pal < 0) return;
  // 雙主角互換以後：跟著的人換成另一位
  if (a.pal === crew.cur && a.palAlt >= 0) { const was = a.pal; a.pal = a.palAlt; a.palAlt = was; crew.st[was].where = 'out'; crew.st[a.pal].where = 'story'; a.palF && a.palF.on && fFree(a.palF); a.palF = null; }
  const want = player.mode === 'walk' && player.where === 'out' && !crew.sw && !player.air3 && !a.noPal;   // 在空中（跳傘、F-2 雙人跳）或站在戰鬥員站不上去的地方（F-4B 塔頂）：先收起來
  if (!want) { if (a.palF && a.palF.on) { fFree(a.palF); a.palF = null; } }
  else if (!a.palF || !a.palF.on || a.palF.team !== 'crew' || Math.hypot(a.palF.x - pX(), a.palF.z - pZ()) > 40) palPlace(a);
  // 切換角色時落在同伴的位置
  const st = crew.st[a.pal], f = a.palF;
  if (f && f.on) { st.x = f.x; st.z = f.z; st.yaw = f.yaw; }
  else { st.x = pX(); st.z = pZ(); }
}
// 任務的車（車流的車型）；任務結束時收掉，除非玩家正開著（留在路邊變成一般的車）
function storyCar(a, id, at, name, near) {
  const sp = rnLaneSpot(at.x, at.z, near ? 4 : 10);
  const v = buildVeh(TYPES[id] ? id : 'tiara', sp.x, sp.z, sp.yaw, 0, Math.random(), 2, 'story');   // 車流的車型（30-vehicles.js 的 TYPES）
  v.y = spawnY(v.x, v.z); v.name = name; v.storyOwn = 1; poseVehicle(v);
  a.car = v; a.carHp0 = v.hp;
}
function storyDropCar(a, keep) {
  const v = a.car; if (!v) return;
  a.car = null;
  if (keep || player.veh === v || !v.storyOwn) return;   // 借用的載具（碼頭的快艇）留在原地
  dropVeh(v);
}

// ─── 序章的徒手打架（69-squads.js 的 fStep 轉過來）：走近、出拳，打中扣 7 ───
function storyBrawl(f, dt) {
  const dx = pX() - f.x, dz = pZ() - f.z, d = Math.hypot(dx, dz) || 1;
  f.yaw += wrapA(Math.atan2(dx, dz) - f.yaw) * (1 - Math.exp(-8 * dt));
  fighters.people[f.k].aimK = 0;
  f.shotT -= dt;
  if (d > 1.15 && f.shotT < .45) {
    const sp = d > 3 ? 3.4 : 1.9, r = collideCircle(f.x + dx / d * sp * dt, f.z + dz / d * sp * dt, .32, false);
    f.x = r.x; f.z = r.z;
    fighters.anim(f.k, d > 3 ? ANIM.run : ANIM.walk, f.ph += dt, 1);
  } else if (f.shotT <= 0 && d < 1.5 && !life.dead) {
    f.shotT = 1.1 + Math.random() * .6; f.punchPh = -uTimeNow();
    fighters.anim(f.k, ANIM.punch, f.punchPh, 1);
    setTimeout(() => { if (f.on && f.state === 'act' && Math.hypot(pX() - f.x, pZ() - f.z) < 1.6) { sfx.punch(); hurtPlayer(7, -dx / d, -dz / d); } }, 260);
  } else if (f.shotT > .45) fighters.anim(f.k, ANIM.punch, f.punchPh || 0, 1);
  else fighters.anim(f.k, ANIM.idle, f.ph += dt, 1);
  fighters.place(f.k, f.x, fGround(f), f.z, f.yaw);
}

// 69-phone.js 的暗網軍火：1-2「兩捆」之後賈克斯的貨打 9 折
function storyArmsK() { return S && S.flags.jaxDisc ? .9 : 1; }

// ─── 事件（各模組呼叫） ───
// 'kill'(爆頭, 近戰)：69-crew.js 的 spEvent；'rob'：69-v5-shops.js 的 robDone；'clerk'：店員中槍
function storyEv(kind, x, y) {
  const a = side.act;
  if (!a || a.kind !== 'story') return;
  if (kind === 'kill') { a.kills++; if (x) a.heads++; if (y) a.melee++; }
  if (kind === 'rob' && a.robC) a.robC.done = true;
  if (kind === 'clerk') a.clerkHit = true;
  if (kind === 'truck' && a.truckC) a.truckC.open = true;
  if (kind === 'casino' && a.casC) { a.casC.end = true; a.casC.ok = !!x; }   // 69-v7-casino.js 的 casHeistEnd：主線 F-1
  if (kind === 'heist' && a.heistC) { a.heistC.done = true; a.heistNet = x; }   // 69-heist.js 的 heistPass   // 69-events.js 的 truckOpen：主線運鈔車的後門炸開了
}

// ─── 腳鐐與警用掃描器 ───
const mon = { out: 0, fired: false };
function monActive() { return !!(S && S.flags.monitor && isDone('P-2') && crew.cur === ROSA && !(side.act && side.act.kind === 'story') && player.where === 'out'); }
function monDist() { const H = CREW[ROSA].home; return Math.hypot(pX() - H.x, pZ() - H.z); }
function storyChip(dt) {
  const el = $('stChip');
  let txt = '', warn = false;
  if (monActive()) {
    const d = monDist();
    if (d > MON_R) {
      mon.out += dt;
      if (mon.out > MON_WARN && !mon.fired) { mon.fired = true; addHeat(1, 1); toast('腳鐐通報了假釋官 · 通緝 1 星'); }
      txt = mon.fired ? `腳鐐：已通報 · 回到國宅 ${MON_R} m 內` : `腳鐐：超出範圍 ${Math.round(d - MON_R)} m · ${Math.ceil(MON_WARN - mon.out)} 秒後通報`; warn = true;
    } else { mon.out = 0; mon.fired = false; txt = `腳鐐 · 離國宅 ${Math.round(d)} / ${MON_R} m`; }
  } else { mon.out = 0; }
  if (!warn && S && S.flags.scan && player.where === 'out') {
    const rep = W.reports.length ? Math.max(0, Math.min(...W.reports.map(r => r.t)) - uTimeNow()) : -1;
    if (rep >= 0) { txt = `掃描器：有人報警 · ${Math.ceil(rep)} 秒後派車`; warn = true; }
    else if (W.stars) { const n = W.units.filter(u => !u.v.dead && u.state !== 'leave').length; txt = `掃描器：${n} 輛警車 · ${W.seen ? '看得到你' : `搜索中 ${Math.ceil(Math.max(0, EVADE[W.stars - 1] - W.evade))} 秒`}`; warn = W.seen; }
    else if (!txt) txt = '掃描器 · 頻道安靜';
  }
  el.classList.toggle('on', !!txt); el.classList.toggle('warn', warn);
  if (txt) setText('stChipT', txt);
}
// 小地圖（69-side.js 的 sideMini）：腳鐐範圍、掃描器的搜索圈、任務要撿的東西
function storyMini(ctx, P2, zoom) {
  if (!S) return;
  if (monActive()) {
    const H = CREW[ROSA].home, [x, y] = P2(H.x, H.z);
    ctx.strokeStyle = mon.out > 0 ? 'rgba(255,90,110,.8)' : 'rgba(98,230,216,.55)'; ctx.lineWidth = 2.4 / zoom; ctx.setLineDash([7 / zoom, 6 / zoom]);
    ctx.beginPath(); ctx.arc(x, y, MON_R * MAP_S, 0, 7); ctx.stroke(); ctx.setLineDash([]);
  }
  if (S.flags.scan && W.stars && !W.seen && W.lkp) {
    const [x, y] = P2(W.lkp.x, W.lkp.z);
    ctx.fillStyle = 'rgba(90,130,255,.16)'; ctx.beginPath(); ctx.arc(x, y, (60 + W.stars * 25) * MAP_S, 0, 7); ctx.fill();
  }
  const a = side.act;
  if (a && a.kind === 'story') { ctx.fillStyle = STORY_HEX; for (const it of a.items) { const [x, y] = P2(it.x, it.z); ctx.beginPath(); ctx.arc(x, y, 4 / zoom * 1.4, 0, 7); ctx.fill(); } }
}
// 大地圖（91-map.js 的 mapBlips）：下一個主線起點
function storyBlips(add) {
  const m = storyNext(); if (!m || side.act && side.act.kind === 'story') return;
  const p = m.at(), c = CHAPTER[m.ch];
  add('story', { name: `${m.id}「${m.title}」`, txt: CREW[m.who].name[0], col: CREW[m.who].col, x: p.x, z: p.z, type: `主線 · ${c[0]}「${c[1]}」`,
    rows: [['操作', CREW[m.who].zh], ['難度', m.star ? '★'.repeat(m.star) : '劇情'], ['報酬', m.star ? money(STAR_PAY[m.star]) : '—']], desc: `${m.desc} 走到起點按 E。` });
}

// ─── 每幀（68-gta.js） ───
function storyPre() {
  if (say.on || $('stCard').classList.contains('on')) { inp.mx = inp.mz = 0; inp.run = false; inp.thr = inp.brk = 0; inp.steer = 0; inp.hb = false; }
}
function storyUpdate(dt) {
  if (!S) return;
  posterTick();   // 69-w5-fin.js：結局 B 的通緝海報
  const a = side.act, out = player.where === 'out';
  // 起點的圈與站在起點的人
  const m = storyNext(), idle = m && !a && out && !SQ.def && (heist.st === 'off' || heist.st === 'plan');
  if (idle) { const p = m.at(); ringAt(startRing, p.x, p.z, 1, 0, .05); startRing.rotation.set(-Math.PI / 2, 0, 0); } else startRing.visible = false;
  const want = {};
  if (idle && m.giver) want[m.giver] = m.giverAt();
  if (a && a.kind === 'story') Object.assign(want, a.npc);
  if (isDone('P-3') && !want.lupe && !(a && a.kind === 'story')) want.lupe = stAt(ROSA_L, 1.8, -.6);
  CAST_IDS.forEach((id, k) => {
    const p = castCrowd.people[k], q = want[id];
    if (!q || !out || !PEOPLE) { castCrowd.place(k, 0, -60, 0, 0); return; }
    if (!p.rig || p.lookId !== id) { castCrowd.look(k, castLook(k, id)); p.lookId = id; }
    const d = Math.hypot(q.x - pX(), q.z - pZ()), talking = say.on && say.with === q;
    castCrowd.anim(k, q.anim ?? (talking || d < 4 ? ANIM.talk : CAST[id].ci !== undefined ? CREW[CAST[id].ci].idle : ANIM.idle), q.anim ? q.ph ?? -uTimeNow() : k * 2.3, 1);   // anim、y：終章跳下去、站在塔頂；ph 給了就照常循環（范斯跑去登機）
    castCrowd.place(k, q.x, q.y ?? footY(q.x, q.z), q.z, d < 7 && !q.anim ? Math.atan2(pX() - q.x, pZ() - q.z) : q.yaw);
  });
  // 主線的配角站出來時，同一個人的閒置身體（69-crew.js 的 crewNpc）收起來
  for (const id of CAST_CI) { const ci = CAST[id].ci, st = crew.st[ci]; if (ci === crew.cur || a && a.pal === ci) continue; const on = !!want[id]; if (on && st.where === 'out') st.where = 'cast'; else if (!on && st.where === 'cast') st.where = 'out'; }
  storyChip(dt);
  storyRetryAsk();
  if (!a && !life.dead && !fading && !crew.sw && !dlg.open && !S.retry && S.back) storyBack();
  if (!a && !crew.sw && !life.dead && !fading && !dlg.open && !S.retry && !castOf(crew.cur)) { S.back = 1; storyBack(); }
}
function storyLate() {
  const a = side.act;
  if (a && a.kind === 'story' && a.gray) post.gray = Math.max(post.gray, a.gray);
  if (!say.on) return;
  const dt = slowmo.raw;
  say.t += dt;
  if (crew.sw || life.dead || player.where !== say.at) { sayEnd(true); return; }   // 在哪裡開始就在哪裡講完（終章頂層公寓的窗邊在室內）
  if ((say.lt += dt) > 2.4 + say.lines[say.i][1].length * .12) { sayNext(); if (!say.on) return; }
  const q = say.with, gy = say.at === 'out' ? groundH(pX(), pZ()) : player.y;
  if (q) {
    const ux = q.x - pX(), uz = q.z - pZ(), l = Math.hypot(ux, uz) || 1, sd = say.side, k = Math.min(1, say.t / .6), e = k * k * (3 - 2 * k), drift = Math.sin(say.t * .25) * .35;
    if (player.mode === 'walk') player.yaw += wrapA(Math.atan2(ux, uz) - player.yaw) * Math.min(1, dt * 6);
    _cl2.set((q.x + pX()) / 2, gy + 1.45, (q.z + pZ()) / 2);
    _cc.set(_cl2.x - uz / l * sd * 3.3 - ux / l * (.7 + drift), gy + 1.65, _cl2.z + ux / l * sd * 3.3 - uz / l * (.7 + drift));
    cineClip(_cl2, _cc);
    camera.position.lerpVectors(camState.pos, _cc, e); camera.lookAt(_cl2);
    U.uFocus.value.set(_cl2.x, _cl2.y, _cl2.z, 1);
  } else {
    const v = player.mode === 'drive' ? player.veh : null, x = v ? v.x : player.x, z = v ? v.z : player.z, y = (v ? v.y : player.y) + (v ? 1 : 1.3);
    const an = say.a0 + say.t * .22, r = v ? 8.5 : 4.6;
    _cl2.set(x, y, z); _cc.set(x - Math.sin(an) * r, y + (v ? 2.4 : .9), z - Math.cos(an) * r);
    cineClip(_cl2, _cc);
    camera.position.copy(_cc); camera.lookAt(_cl2);
    U.uFocus.value.set(x, y, z, 1);
  }
  camera.updateMatrixWorld();
  camState.snap = true;
}
// 99-main.js 的 onKey：字幕與字卡播放時吃掉按鍵，E／空白鍵／Enter 下一句
function storyKey(code) {
  const card = $('stCard').classList.contains('on');
  if (!say.on && !card) return false;
  if (code === 'KeyE' || code === 'Space' || code === 'Enter' || code === 'Escape') storySkipLine();
  return true;
}
function storySkipLine() {
  if (say.on) { sayNext(); return; }
  const a = side.act;
  if (a && a.kind === 'story' && a.cur && a.cur.s.type === 'card') { if (a.cur.s.lines) a.cur.skip = true; else a.cur.lt = 0; }
}
addEventListener('pointerdown', e => { if ((say.on || $('stCard').classList.contains('on')) && !e.target.closest('#dialog,#phone,#menu')) storySkipLine(); });

// ─── 開場（99-main.js）：主線開著時，新存檔從序章開始、操作羅莎 ───
function storyBoot() {
  if (!S) return 0;
  if (!castOf(crew.cur)) crewApply(ROSA);
  return storyQuest0();
}
function storyGo() {
  if (!S) return false;
  storyObj();
  if (S.fresh && S.m === 'P-1') { storyStart(MS['P-1']); return true; }
  const m = storyNext();
  if (m) toast(`主線 ${m.id}「${m.title}」：地圖上的 ${CREW[m.who].name[0]}`);
  return true;
}

// 測試 API（window.__nc.story）
const storyApi = {
  M: MS, ORDER, on: storyOn, st: () => S, act: () => side.act && side.act.kind === 'story' ? side.act : null,
  state: () => { const a = side.act && side.act.kind === 'story' ? side.act : null; return { m: S && S.m, done: S ? S.done.slice() : [], medal: S ? { ...S.medal } : {}, cast: S ? { ...S.cast } : {}, flags: S ? { ...S.flags } : {}, act: a ? { id: a.M.id, k: a.k, type: a.cur && a.cur.s.type, t: +a.t.toFixed(1) } : null, say: say.on, card: $('stCard').classList.contains('on'), retry: S && S.retry, fading, cur: CREW[crew.cur].id }; },
  // 跳到某一關（前面的都算完成，不發錢）並直接開始
  go(id, start = true) {
    if (!S || !MS[id]) return false;
    const i = ORDER.indexOf(id);
    // 終章另一條路（route 不同）不算做過
    for (const q of ORDER.slice(0, i)) if (!S.done.includes(q) && !(MS[q] && MS[q].route && MS[q].route !== MS[id].route)) { S.done.push(q); const mm = MS[q]; mm && mm.first && mm.first(); }
    S.m = id; S.fresh = false; S.retry = null; saveMotors(); storyObj();
    if (side.act) sideEnd();
    if (start) storyStart(MS[id]);
    return true;
  },
  // 直接完成目前這一步的條件
  skip() {
    const a = side.act; if (!a || a.kind !== 'story' || !a.cur) return null;
    const s = a.cur.s, c = a.cur;
    if (s.type === 'say') { while (say.on) sayNext(); }
    else if (s.type === 'card') { if (s.lines) c.i = s.lines.length; c.skip = true; c.lt = 0; }
    else if (s.type === 'go') { const q = tgtOf(c); if (s.drive && player.mode !== 'drive' && a.car) enterVehicle(a.car); const o = player.mode === 'drive' ? player.veh : player; o.x = q.x; o.z = q.z; }
    else if (s.type === 'car') { if (a.car && player.veh !== a.car) { if (player.mode === 'drive') exitVehicle(); enterVehicle(a.car); } }
    else if (s.type === 'fight') { for (const f of SQ.f) if (fUp(f) && f.grp === c.grp) fHit(f, 999, 0, 1, true); }
    else if (s.type === 'collect') { for (const it of a.items) { it.x = pX(); it.z = pZ(); } }
    else if (s.type === 'enter') { const sp = VENUES[s.where].spawn; setWhere(s.where); player.x = sp.x; player.z = sp.z; }
    else if (s.type === 'rob') { if (a.robC) a.robC.done = true; }
    else if (s.type === 'leave') { const o = VENUES[player.where] && VENUES[player.where].out; setWhere('out'); if (o) { player.x = o.x; player.z = o.z; } }
    else if (s.type === 'lose') { wantedClear('reset'); c.had = true; }
    else if (STEP[s.type].skip) STEP[s.type].skip(a, s, c);   // 各章自己的步驟
    return s.type;
  },
  // 一路跳到任務結束（測試：每一步都 skip、讓它跑幾幀）
  fail: why => { const a = side.act; if (a && a.kind === 'story') storyFail(a, why || '測試'); },
  avail: i => storyAvail(i), why: i => storyLockWhy(i), duo: i => storyDuoSwitch(i), ROSA, DANE,
  far: storyFar, mon: () => ({ ...mon, on: monActive(), d: Math.round(monDist()) }),
  spots: { ST_PRISON, ST_YARD, ST_FERRY, ST_PIER },
};
