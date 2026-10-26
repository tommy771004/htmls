// ═══ 主線第四章「塞拉斯」（plans/260-story.md）：4-1 老派、4-2 獄友、4-3 卸腳鐐、4-4 前置：裝甲車、4-5 中央霓虹銀行、4-6 分贓 ═══
// 搶案沿用 69-heist.js／69-heist2.js 的整套流程（heist.st），主線只把角色表 heist.who 換成 [羅莎, 凱爾, 戴恩]、
// 大廳裡的兩個隊友換成塞拉斯（裝 C4）與娜迪亞（守門），分紅固定（heist.storyCuts），逃亡用 4-4 搶來改裝的裝甲車＋直升機（heist.storyAir）。
// 4-5 是潛行，但金庫門一炸開塞拉斯就多塞了兩塊 C4（heistAlarm：直接 4 星，戴恩守門 30 秒）。
// heist 步驟只看結果：heistPass 回報 storyEv('heist')；搶案自己處理陣亡（heistFail 退回 'go'），主線同一幀判失敗、
// 收尾時 heistAbort 整個收掉，重試從檢查點（ck）那一步重新擺好。任務框交給 heistHud（STEP.heist.ownHud）。
// 4-3 卸腳鐐用 69-heist2.js 的破譯小遊戲（hackOpen(free)，每幀在這裡推 hackStep）。
// 排在 69-w2-ch3.js 之後、70-render.js 之前：post、camState、keys 只能在函式裡用。

// ─── 地點 ───
const ST_PUB = () => APT.pub && APT.pub.doorW ? { ...APT.pub.doorW, yaw: 0 } : taleCorner(1, 4, 1, -1);   // 舊碼頭的鏽錨酒館門口
const ST_GULL = () => APT.office && APT.office.doorW ? { ...APT.office.doorW, yaw: 0 } : taleCorner(9, 12, 1, 1);   // 灰鷗島：辦公室門口
const ST_BANK = () => bankAt(0, 7, Math.PI);      // 中央霓虹銀行門口的人行道
const ST_SAFE = () => ({ ...SAFE, yaw: 0 });      // 舊碼頭倉庫（前置 B 換人的地方）

// ─── 搶案的主線設定 ───
const CUTS_4 = [['塞拉斯', .2], ['娜迪亞', .12], ['凱爾', .1]];
function heistStory(on) {
  if (on) {
    heist.who = [ROSA, CREW.findIndex(c => c.id === 'kael'), DANE];
    heist.storyCuts = CUTS_4; heist.storyK = { hack: 1.4, drill: .75 }; heist.npcN = ['塞拉斯', '娜迪亞']; heist.hire = null;
    bankCrew.look(0, { ...castLook(0, 'silas'), r: rng(33) }); bankCrew.look(1, { ...castLook(1, 'nadia'), r: rng(32) });
  } else {
    heist.who = null; heist.storyCuts = null; heist.storyK = null; heist.npcN = null; heist.storyAir = 0;
    bankCrew.look(0, { r: rng(33), ...CREW[2].look }); bankCrew.look(1, { r: rng(32), ...CREW[1].look });
  }
}
storyCleanups.push(a => { if (a.heistOn) { a.heistOn = 0; if (heist.st !== 'off') heistAbort(); heistStory(false); } });
// 破譯小遊戲不在搶案裡時，每幀由這裡推
storyTicks.push((a, dt) => { if (HACK.on && HACK.free) hackStep(dt); });
storyCleanups.push(() => { if (HACK.on && HACK.free) { HACK.free = null; hackClose(); } });

// ─── 步驟 ───
// 前置 B：搶 NCPD 的鎮暴裝甲車、開進 CHROME WORKS 改裝（69-heist2.js），做完 heist.enfReady
STEP.setupB = {
  ownHud: 1,
  start: (a, s, c) => { a.heistOn = 1; heistStory(true); heist.how = 'loud'; heist.enfReady = false; heist.alarm = false; setupBStart(); },
  step: () => !!heist.enfReady && !heist.busy && !fading,
  skip: () => { if (heist.st === 'setupB') enfRefit(); },
};
// 搶銀行：從銀行門口開始（heist.st 'go'），到 heistPass 的結算畫面關掉
STEP.heist = {
  ownHud: 1,
  start: (a, s, c) => {
    a.heistOn = 1; heistStory(true); a.heistC = c; c.seen = false; c.greedT = 0;
    Object.assign(heist, { how: 'smart', alarm: false, loss: 0, take: 0, passed: false, enfReady: isDone('4-4'), storyAir: 1, hackDone: false, holdT: 0 });
    heistStage('go');
    toast('到中央霓虹銀行門口按 E 開始');
  },
  step: (a, s, c, dt) => {
    if (heist.st !== 'go' && heist.st !== 'off') c.seen = true;
    // 塞拉斯的貪心：金庫門炸開一秒後，整棟樓的警報響了
    if (heist.st === 'drill' && !heist.alarm && player.where === 'bank' && (c.greedT += dt) > 1) { heistAlarm('塞拉斯多塞了兩塊 C4：整棟樓都聽到了！'); toast('羅莎：塞拉斯！你在幹什麼？'); }
    if (heist.st === 'escape' || heist.st === 'drive') a.heistLoss = heist.loss;
    if (c.seen && heist.st === 'go' && !c.done) { storyFail(a, '搶劫失敗'); return false; }
    return !!c.done && !$('heistDone').classList.contains('on');
  },
  skip: (a, s, c) => { heist.take = TAKE.smart; heist.loss = 0; heistPass(); $('heistDone').classList.remove('on'); },
};
// 破譯（卸腳鐐）：逾時就再開一次
STEP.hack = {
  start: (a, s, c) => { c.ok = false; a.hackN = 0; const go = () => { a.hackN++; hackOpen(how => { if (how === 'ok') c.ok = true; else { toast(how === 'late' ? '訊號對不上：重來' : '這次不能用鑽機：重來'); setTimeout(() => { if (side.act === a && !c.ok) go(); }, 600); } }); }; c.go = go; go(); },
  step: (a, s, c) => c.ok,
  hud: (a, s) => ({ text: s.text, bar: HACK.on ? HACK.t / HACK.T * 100 : -1, num: HACK.on ? `${HACK.cur} / 3` : '' }),
  skip: (a, s, c) => { c.ok = true; if (HACK.on) { HACK.free = null; hackClose(); } },
};
// 甩掉跟監：69-squads.js 的 gangChase；追兵的車都不在了（甩掉、打爛）就完成
STEP.shake = {
  start: (a, s, c) => { c.t = 0; if (!gangChase('story', s.n || 2)) c.none = true; },
  step: (a, s, c, dt) => { c.t += dt; return c.t > 2 && (c.none || !SQ.chase); },
  hud: (a, s) => { const ch = SQ.chase; let d = 999; if (ch) for (const q of ch.cars) if (!q.v.dead) d = Math.min(d, Math.hypot(q.v.x - pX(), q.v.z - pZ())); return { text: s.text, bar: -1, num: ch && d < 999 ? `最近的追兵 ${Math.round(d)} m` : '' }; },
  skip: () => { if (SQ.chase) chaseEnd(true); },
};
// 有人坐上車（npc 的身體收起來，到了再放回旁邊）
STEP.pick = {
  step: (a, s) => { const q = a.npc[s.who]; if (!q) return true; if (player.mode === 'drive' && Math.hypot(q.x - pX(), q.z - pZ()) < 9 && Math.hypot(player.veh.vx, player.veh.vz) < 3) { delete a.npc[s.who]; toast(`${castName(s.who)}上車了`); return true; } return false; },
  hud: (a, s) => ({ text: player.mode === 'drive' ? s.text : '先上車', bar: -1 }),
  mark: (a, s) => { const q = a.npc[s.who]; return q ? { name: castName(s.who), x: q.x, y: 2.2, z: q.z, where: 'out' } : null; },
  skip: (a, s) => { delete a.npc[s.who]; },
};

// ─── 任務表 ───
storyAdd([
  { id: '4-1', ch: 4, title: '老派', who: ROSA, star: 0, at: ST_PUB, giver: 'silas', giverAt: () => nearL(ST_PUB(), 1.8, .6, -Math.PI / 2),
    desc: '鏽錨酒館。有個看過 BODEGA 影片的老頭想見你們。', sms: '陌生號碼：BODEGA 那段影片拍得不錯。鏽錨酒館，明晚。',
    first: () => { S.flags.silas = 1; toast('聯絡人：塞拉斯'); },
    steps: [
      { type: 'say', with: 'silas', lines: [L('silas', '一間便利店、一個收銀機、兩頂面罩。你們讓我想起年輕的時候。'), L('rosa', '你是誰？'), L('silas', '塞拉斯。我搶過的銀行，比你們進過的還多。'), L('silas', '收銀機裡是零錢。真正的錢在金庫裡——中央霓虹銀行，10 St。'), L('rosa', '我還戴著腳鐐。'), L('silas', '那就先處理腳鐐。再找一個會開保險箱的人。')] },
    ] },
  { id: '4-2', ch: 4, title: '獄友', who: ROSA, star: 2, sw: [ROSA, DANE], at: ST_GULL, giver: 'nadia', giverAt: () => nearL(ST_GULL(), 1.8, .6, -Math.PI / 2),
    desc: '羅莎的獄友娜迪亞剛出來。灰鷗島，有人在盯她。', sms: '娜迪亞：我出來了。灰鷗島，辦公室那棟樓下。他們跟著我。',
    bonus: [{ t: '4 分鐘內送到', ok: a => a.t < 240 }, { t: '車子沒什麼刮傷（車況 70% 以上）', ok: a => !a.car || a.car.hp >= a.carHp0 * .7 }],
    first: () => { S.flags.nadia = 1; toast('娜迪亞入隊（開保險箱快）'); },
    steps: [
      { type: 'say', with: 'nadia', lines: [L('nadia', '羅莎·伊巴拉。我以為妳會比我晚出來。'), L('rosa', '我也以為。上車，有人跟著妳。'), L('nadia', '從我走出大門就跟著了。黑色的車，兩台。')] },
      { type: 'fn', fn: a => storyCar(a, 'kiri', ST_GULL(), '接人的車', true) },
      { type: 'car', text: '上車' },
      { type: 'pick', who: 'nadia', text: '開到娜迪亞旁邊讓她上車' },
      { type: 'shake', text: '甩掉跟監的車', n: 2 },
      { type: 'go', text: '把娜迪亞送到安全屋', to: homeDoor, r: 8, name: '安全屋', drive: true },
      { type: 'fn', fn: a => { a.npc.nadia = nearL(homeDoor(), 1.8, .6, -Math.PI / 2); } },
      { type: 'say', with: 'nadia', lines: [L('nadia', '所以，妳要我開什麼？'), L('rosa', '中央霓虹銀行的金庫。'), L('nadia', '……我喜歡妳出獄之後的樣子。')] },
    ] },
  { id: '4-3', ch: 4, title: '卸腳鐐', who: ROSA, star: 2, at: homeDoor, giver: 'otis', giverAt: () => nearL(homeDoor(), 1.6, .8, -Math.PI / 2),
    desc: '奧帝斯和 Zero 要造一個假訊號，讓腳鐐以為羅莎一直在家。', sms: '奧帝斯：Zero 說可以試試。帶著妳的腳回來。',
    bonus: [{ t: '一次就對上訊號', ok: a => a.hackN <= 1 }, { t: '90 秒內完成', ok: a => a.t < 90 }],
    first: () => { S.flags.monitor = 0; toast('腳鐐解除：羅莎可以自由走動了'); },
    steps: [
      { type: 'say', with: 'otis', lines: [L('otis', '腳鐐每三十秒回報一次位置。我們錄一段妳在家的訊號，一直重播。'), L('rosa', '要是被發現？'), L('otis', '那假釋官就會發現妳在家裡待得很乖。')] },
      { type: 'say', phone: 'Zero', lines: [L('Zero', '我把頻率表傳給奧帝斯了。三組波形，頻率和振幅都要對上。'), L('Zero', 'A／D 調頻率、W／S 調振幅。對歪了，腳鐐會叫。')] },
      { type: 'hack', text: '對上腳鐐的三組訊號' },
      { type: 'say', with: 'otis', lines: [L('otis', '……綠燈。它以為妳在沙發上看電視。'), L('rosa', '一千零九十四天，加上出來的這幾個月。'), L('otis', '去走走吧。走遠一點。')] },
    ] },
  { id: '4-4', ch: 4, title: '前置：裝甲車', who: DANE, star: 4, at: ST_SAFE, giver: 'silas', giverAt: () => nearL(ST_SAFE(), 1.8, .6, -Math.PI / 2),
    desc: '搶銀行要一台警察不會攔的車。第九分局今晚移防一台鎮暴裝甲車。', sms: '塞拉斯：銀行之前，先弄一台像樣的車。我在舊碼頭倉庫等你，戴恩。',
    bonus: [{ t: '押車特警沒叫到支援', ok: () => !heist.escCalled }, { t: '生命沒掉超過 50', ok: a => a.hurt <= 50 }],
    first: () => { S.flags.enf = 1; toast('改裝裝甲車停在銀行附近的逃亡點，等 4-5'); },
    steps: [
      { type: 'say', with: 'silas', lines: [L('silas', '第九分局的車隊停在 3 St 路口，四個特警押車。'), L('silas', '別開槍。電擊槍、催淚瓦斯，讓他們睡一下。'), L('dane', '然後開去改裝？'), L('silas', 'CHROME WORKS。防彈輪胎、市政工程的塗裝。警察看到也只會讓路。')] },
      { type: 'setupB', text: '搶鎮暴裝甲車', ck: true },
    ] },
  { id: '4-5', ch: 4, title: '中央霓虹銀行', who: ROSA, star: 5, split: true, sw: [ROSA, DANE, CREW.findIndex(c => c.id === 'kael')], at: ST_BANK, giver: 'silas', giverAt: () => nearL(ST_BANK(), 1.8, .4, -Math.PI / 2), cast: { nadia: () => nearL(ST_BANK(), 2.8, 1.4, -Math.PI / 2) },
    desc: '照計畫是潛行：壓住人質、娜迪亞破譯電子鎖、安安靜靜地出來。', sms: '塞拉斯：今晚。10 St。照計畫走，誰都不准即興。',
    bonus: [{ t: '中彈損失的贓款不超過 $150,000', ok: a => (a.heistLoss || 0) <= 150000 }, { t: '8 分鐘內分完贓', ok: a => a.t < 480 }],
    first: () => { S.flags.bank = 1; },
    steps: [
      { type: 'say', with: 'silas', lines: [L('silas', '羅莎壓大廳，我裝 C4，娜迪亞開鎖。戴恩在外面，凱爾開車。'), L('nadia', '電子鎖二十八秒。給我二十八秒，我給你們兩百萬。'), L('dane', '照計畫走。'), L('silas', '照計畫走。')] },
      { type: 'heist', text: '搶中央霓虹銀行', ck: true },
      { type: 'say', lines: [L('rosa', '你說好照計畫走的。'), L('silas', '計畫是兩百萬。金庫裡還有一層，我只是不想浪費。'), L('dane', '你差點害死所有人。'), L('silas', '差點。')] },
    ] },
  { id: '4-6', ch: 4, title: '分贓', who: DANE, star: 4, sw: [DANE, ROSA], at: () => YARD, giver: 'silas', giverAt: () => nearL(YARD, 2.2, .6, -Math.PI / 2),
    desc: '鐵灣貨場的貨櫃安全屋。分贓那天，有人知道地址。', sms: '塞拉斯：錢洗好了。貨櫃場，老地方。',
    bonus: [{ t: '生命沒掉超過 70', ok: a => a.hurt <= 70 }, { t: '爆頭 4 次', ok: a => a.heads >= 4 }],
    steps: [
      { type: 'say', with: 'silas', lines: [L('silas', '一人一袋，乾乾淨淨。'), L('dane', '外面那幾台車是誰的？'), L('silas', '……不是我的。')] },
      { type: 'fn', fn: a => { palOn(a, ROSA); toast('赤蠍幫包圍了貨櫃場'); } },
      { type: 'fight', text: '守住貨櫃場', at: () => YARD, n: 5, guns: ['smg', 'pistol', 'rifle', 'smg', 'shotgun'], r: 16, hot: true },
      { type: 'fn', fn: () => toast('第二波：赤蠍幫的車又開進來了') },
      { type: 'fight', text: '守住貨櫃場 · 第二波', at: () => YARD, n: 6, guns: ['rifle', 'smg', 'rifle', 'shotgun', 'smg', 'pistol'], r: 20, hot: true, hp: 120 },
      { type: 'say', with: 'silas', lines: [L('silas', '（按著肚子）……他們知道地址。只有我們五個知道地址。'), L('rosa', '還有付錢給赤蠍幫的人。'), L('dane', '天際置業。'), L('silas', '去查那本帳。我得先找個醫生。')] },
      { type: 'fn', fn: a => palOff(a) },
    ] },
]);
