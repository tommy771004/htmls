// ═══ CHROME WORKS 霓虹改車王總廠（規格書第六部曲 neon_nightcity_gta_v_neon_mega_customs.md）═══
// 雙層挑高的旗艦改裝廠：前排三道感應捲門通到三個工位（1 鈑金與烤漆、2 動力馬力機、3 低底盤重改區），中間一排是零件展示走廊、
// 首席技工鐵手強尼的工作站與工位 4 黑市拆解區，後段是 2 樓夾層（老闆辦公室、街機、10 車位的私人展示車庫）。
// 自己的車開進來停在工位 2 的滾筒馬力機上，走過去按 E 打開改裝面板；偷來的車停到工位 4 的地磅上（銷贓、追蹤器、噴漆）。
// 13 大改裝（第四節）：裝甲、煞車、保險桿與防撞鏟、引擎 EMS、排氣管、尾翼、渦輪、變速箱、懸吊與液壓、烤漆與車牌、輪胎與燒胎煙、
// 車燈與底盤霓虹、防盜保險與炸彈；價格在規格書的價格區間裡挑，效果照規格書的公式（MOD_FX），列在 README。
// 裝過的套件存在 motors.mods[車]（nc260.motors），跟著車走：換車、試駕結束、從車庫開出來都由 applyCar 的 carHooks 重新疊上去。
// 進廠規則、拔槍關店、銷贓、保險、炸彈、液壓彈跳、收購車廠與客戶委託在 69-v6-customs.js。
// 明亮的車間：環境光拉高；post 是 70-render.js 的場館後製（曝光、泛光門檻與強度、高光肩部 knee／range），燈泡與鍍鉻不會燒成整片白
ENV.chrome = { lampOn: 0, wet: 0, fogDen: .004, fog: 0x3a3632, fogHi: 0x4a443c, top: 0xd0ccc4, bot: 0x6a645c, post: { exp: 1.06, thr: 1.7, bloom: .45, knee: 1.0, range: .85 } };

// ─── 13 大改裝：類別 → 群組 → 各級 [名稱, 價格]；第 0 級是原廠（免費換回去）。cam：面板停在這一類時鏡頭的特寫錨點 ───
const CATS = [
  { k: 'arm', name: '防彈裝甲', cam: 'orbit', g: [{ k: 'arm', lv: [['無', 0], ['裝甲 20%', 1500], ['裝甲 40%', 4500], ['裝甲 60%', 9000], ['裝甲 80%', 15000], ['裝甲 100%', 25000]] }] },
  { k: 'brk', name: '煞車系統', cam: 'wheel', g: [{ k: 'brk', lv: [['原廠', 0], ['街頭煞車', 1000], ['運動煞車', 5000], ['賽道級陶瓷煞車', 12000]] }] },
  { k: 'bmp', name: '保險桿與防撞鏟', cam: 'front', g: [{ k: 'bmp', lv: [['原廠', 0], ['碳纖維前下巴', 800], ['賽博防撞鋼架', 4200], ['尖刺鏟', 8500]] }] },
  { k: 'eng', name: '引擎調校', cam: 'engine', g: [{ k: 'eng', lv: [['原廠', 0], ['EMS 改裝 1 級', 2500], ['EMS 改裝 2 級', 5000], ['EMS 改裝 3 級', 9000], ['EMS 改裝 4 級', 18000]] }] },
  { k: 'exh', name: '排氣管與喇叭', cam: 'rear', g: [{ k: 'exh', name: '排氣管', lv: [['原廠', 0], ['雙出鈦合金', 600], ['側排管', 2200], ['狂暴直通管', 4500]] }, { k: 'hn', name: '喇叭', lv: [['原廠喇叭', 0], ['氣動喇叭', 1200], ['音樂喇叭', 2500], ['警笛喇叭', 5000]] }] },
  { k: 'spl', name: '擾流尾翼', cam: 'wing', g: [{ k: 'spl', lv: [['無', 0], ['低調鴨尾', 1200], ['碳纖維 GT 大尾翼', 6500]] }] },
  { k: 'tur', name: '渦輪增壓', cam: 'engine', g: [{ k: 'tur', lv: [['自然進氣', 0], ['賽道雙渦輪增壓', 15000]] }] },
  { k: 'trn', name: '變速箱', cam: 'engine', g: [{ k: 'trn', lv: [['原廠', 0], ['街頭變速箱', 3000], ['運動變速箱', 8000], ['序列式賽車變速箱', 16000]] }] },
  { k: 'sus', name: '懸吊與液壓', cam: 'wheel', g: [{ k: 'sus', lv: [['原廠', 0], ['降低 1 階', 1000], ['降低 2 階', 2000], ['降低 3 階', 3500], ['降低 4 階', 6000], ['高功率液壓系統', 22000]] }] },
  { k: 'paint', name: '烤漆與車牌', cam: 'orbit', g: [{ k: 'pc', name: '車身顏色', paint: 1 }, { k: 'pf', name: '烤漆材質', lv: [['原廠亮面', 0], ['金屬漆', 1500], ['消光漆', 3500], ['珠光漆', 5000], ['電鍍鏡面', 10000]] }, { k: 'pl', name: '車牌', plate: 1 }] },
  { k: 'whl', name: '輪胎與燒胎煙', cam: 'wheel', g: [{ k: 'tir', name: '輪胎', lv: [['原廠輪胎', 0], ['防彈輪胎', 20000]] }, { k: 'smk', name: '燒胎煙', lv: [['原廠白煙', 0], ['霓虹紫煙', 1500], ['霓虹青煙', 1500], ['霓虹紅煙', 1500], ['霓虹綠煙', 1500]] }] },
  { k: 'lgt', name: '車燈與底盤霓虹', cam: 'front', g: [{ k: 'hl', name: '大燈', lv: [['原廠大燈', 0], ['氙氣白光', 1000], ['黃金大燈', 3000]] }, { k: 'ng', name: '底盤霓虹', lv: [['無', 0], ['霓虹紫', 4500], ['霓虹青', 4500], ['霓虹紅', 4500], ['霓虹綠', 4500], ['冰白', 4500]] }, { k: 'nm', name: '霓虹模式', lv: [['恆亮', 0], ['隨重低音閃爍', 1000]] }] },
  { k: 'sec', name: '防盜保險與炸彈', cam: 'orbit', g: [{ k: 'trk', name: '衛星追蹤器', sec: 1 }, { k: 'ins', name: '全額車輛保險', sec: 1 }, { k: 'bomb', name: '炸彈陷阱', lv: [['無', 0], ['點火引爆炸彈', 5000], ['手機遙控炸彈', 7500]] }] },
];
const GRP = {};
for (const c of CATS) for (const g of c.g) { g.cat = c; g.name ??= c.name; GRP[g.k] = g; }
const LV_KEYS = Object.keys(GRP).filter(k => GRP[k].lv);
// 機車裝不了的：保險桿、尾翼、液壓、烤漆材質（機車的模型是原廠彩繪）
const BIKE_NO = ['bmp', 'spl', 'pf'];
// 效果（規格書第四節的公式；乘在這台車原廠換算出來的數值上）：
//   arm 耐久上限 ×(1 + 裝甲%)；brk 煞車減速度 ×(1 + 0.12·級)；eng 加速 ×(1 + 0.08·級)、極速最多 +5%；tur 加速 ×1.22；
//   trn 換檔延遲 0.35 → 0.08 s（遊戲沒有逐檔模擬：省下的時間換算成加速 ×(1 + 0.25·省下的秒數)），倒車起步加快；
//   sus 車身下降（m）、過彎、重心（68-roll.js 的翻車門檻 ÷ cog）；spl 側向抓地 μ_lat +0.03／+0.06（driveVehicle 的 grip = μ·10）；
//   exh 放油門時回火的機率；bmp 2 級以上是防撞鏟（69-v6-customs.js：正面撞車把對方往上鏟 3.5 m/s）
const MOD_FX = {
  arm: { hpK: [1, 1.2, 1.4, 1.6, 1.8, 2] },
  brk: { brk: [1, 1.12, 1.24, 1.36] },
  eng: { eng: [1, 1.08, 1.16, 1.24, 1.32], top: [1, 1.0125, 1.025, 1.0375, 1.05] },
  tur: { eng: [1, 1.22], top: [1, 1.02] },
  trn: { shift: [.35, .25, .15, .08], rev: [1, 1.15, 1.3, 1.45] },
  sus: { rideY: [0, -.02, -.04, -.06, -.08, 0], grip: [1, 1.01, 1.02, 1.03, 1.04, 1.01], turn: [1, 1.01, 1.02, 1.04, 1.06, 1.02], cog: [1, .92, .85, .78, .7, 1] },
  spl: { mu: [0, .03, .06] },
  exh: { pop: [0, .08, .25, .75] },
};
const HL_COL = [null, lin(0xe6f0ff), lin(0xffc860)];
const NEON_COL = [null, lin(0xb04cff), lin(0x2cf2e0), lin(0xff2a48), lin(0x3aff7a), lin(0xe8f4ff)];
const SMOKE_COL = [[.75, .75, .78], [1.5, .5, 2], [.4, 1.7, 1.8], [2, .4, .45], [.5, 1.8, .6]];
const NEON_HEX = [0, 0xb04cff, 0x2cf2e0, 0xff2a48, 0x3aff7a, 0xe8f4ff];
const modsOf = id => motors.mods[id] || {};
const modCan = (id, k) => !(CARS[id].bike && BIKE_NO.includes(k));
const PLATE_RE = /^[A-Z0-9]{1,8}$/;
// 讀檔時檢查：只留認得的套件與範圍內的整數等級，等級 0 不存；車牌 1–8 個英數字；ins、trk 是 1
function modSanitize() {
  for (const id in motors.mods) {
    const m = motors.mods[id], out = {};
    if (CARS[id] && CARS[id].glb) {
      for (const k of LV_KEYS) if (Number.isInteger(m[k]) && m[k] > 0 && m[k] < GRP[k].lv.length && modCan(id, k) && !(k === 'sus' && m[k] === 5 && CARS[id].bike)) out[k] = m[k];
      if (typeof m.pl === 'string' && PLATE_RE.test(m.pl)) out.pl = m.pl;
      if (m.ins === 1) out.ins = 1;
    }
    if (Object.keys(out).length) motors.mods[id] = out; else delete motors.mods[id];
  }
}
modSanitize();
// 預設車牌：照車款編號雜湊出來的七碼
function plateOf(id, m = modsOf(id)) {
  if (m.pl) return m.pl;
  let h = 7; for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const A = 'ABCDEFGHJKLMNPRSTUVWXYZ'; return 'NC' + A[h % 23] + String(1000 + h % 9000);
}
const fxOf = (m, k, key, d) => (MOD_FX[k] && MOD_FX[k][key] || [])[m[k] || 0] ?? d;
// 這台車裝了套件之後的數值（不碰載具；改裝選單拿來預覽）
function modStats(id, m = modsOf(id)) {
  const c = CARS[id], shift = fxOf(m, 'trn', 'shift', .35);
  const eng = c.eng * fxOf(m, 'eng', 'eng', 1) * fxOf(m, 'tur', 'eng', 1) * (1 + (.35 - shift) * .25);
  const top = fxOf(m, 'eng', 'top', 1) * fxOf(m, 'tur', 'top', 1);
  const kmh = (c.kmh || c.vmax * 3.6 * .78) * top;
  return {
    eng, kmh, vmax: c.kmh ? vmaxFor(kmh, eng) : c.vmax * top, brk: (c.brk || 16) * fxOf(m, 'brk', 'brk', 1),
    grip: c.grip * fxOf(m, 'sus', 'grip', 1) + fxOf(m, 'spl', 'mu', 0) * 10, turn: (c.turn || 1.05) * fxOf(m, 'sus', 'turn', 1),
    rideY: fxOf(m, 'sus', 'rideY', 0), cog: fxOf(m, 'sus', 'cog', 1), hpK: fxOf(m, 'arm', 'hpK', 1), shift, rev: fxOf(m, 'trn', 'rev', 1),
    pop: fxOf(m, 'exh', 'pop', 0), bp: !!m.tir, hp: Math.round((c.hp || 1100) * fxOf(m, 'arm', 'hpK', 1)), ps: c.real ? c.real.ps * (eng / c.eng) : 0,
  };
}
// applyCar 換好車之後（30-vehicles.js 的 carHooks；實車模型下載好再呼叫一次，glb = true）：玩家座駕疊上改裝；試駕的車是車行的原廠車。
// v.custom：69-v6-customs.js 的客戶委託車，套的是客戶那份清單
function modApply(v, id = v.carId, glb) {
  if (v !== kestrel && !v.custom) return;
  const m = v.custom ? v.custom.m : motors.test ? {} : modsOf(id), S = modStats(id, m), c = CARS[id];
  v.eng = S.eng; v.vmax = S.vmax; v.brk = S.brk; v.grip = S.grip; v.turn = S.turn; v.rideY = S.rideY; v.bpTires = S.bp ? 1 : 0; v.armorK = 1;
  const k = v.hpMax ? clamp(v.hp / v.hpMax, 0, 1) : 1;
  v.hpLock = 1; v.hpMax = S.hp; if (!v.dead) v.hp = S.hp * k;
  Object.assign(v, { cog: S.cog, revK: S.rev, shiftT: S.shift, popK: S.pop, turbo: !!m.tur, hydra: m.sus === 5, plow: m.bmp >= 2 ? m.bmp - 1 : 0, hornT: m.hn || 0,
    headCol: HL_COL[m.hl || 0], neon: NEON_COL[m.ng || 0], neonBeat: m.nm === 1, smokeC: SMOKE_COL[m.smk || 0], plate: plateOf(id, m), bomb: m.bomb || 0 });
  if (v.inst && c.paintable) { const u = v.inst.uPaint.value; if (u.w < .5) u.set(-1, -1, -1, 1); u.w = 1 + (m.pf || 0); }   // 26-glb.js：烤漆材質（亮面／金屬／消光／珠光／電鍍）；r < 0 是原廠色
  if (v.modG) { v.modG.removeFromParent(); disposeKit(v.modG); v.modG = null; }
  if (!c.bike) { const g = modParts(id, m); if (g) { v.body.add(g); v.modG = g; } }
}
carHooks.push(modApply);
modApply(kestrel);   // 65-motors.js 開場已經照存檔 applyCar 過一次（那時這個 hook 還沒掛上）

// ─── 改裝件的外觀（程式建模，掛在車身上，跟著車身俯仰）：尾翼、前保險桿／防撞鏟、排氣尾管、側裙霓虹燈條 ───
const CARBON = 0x18191c, STEEL = 0x8a8e94;
function modParts(id, m) {
  const c = CARS[id], s = GLB_SPEC[id] || {}, L = c.len, Wd = c.w, H = s.h || 1.35, k = new Kit();
  let any = false;
  if (m.spl === 1) { k.box(0, H * .74, -L / 2 + .3, Wd * .78, .05, .32, CARBON, 15, -.28); any = true; }
  if (m.spl === 2) {
    const y = H * .74 + .34, z = -L / 2 + .36;
    k.box(0, y, z, Wd * .94, .05, .36, CARBON, 15, .08);
    for (const sx of [-1, 1]) k.box(sx * Wd * .25, y - .18, z + .02, .05, .34, .14, CARBON, 15).box(sx * Wd * .47, y + .02, z, .02, .2, .42, CARBON, 15);
    any = true;
  }
  if (m.bmp === 1) { k.box(0, .1, L / 2 - .06, Wd * .86, .03, .24, CARBON, 15); any = true; }
  if (m.bmp === 2) {
    for (const y of [.32, .6]) k.cyl(0, y, L / 2 + .12, .035, .035, Wd * .82, 8, 0x2a2c30, 15, 0, 0, Math.PI / 2);
    for (const x of [-Wd * .32, 0, Wd * .32]) k.cyl(x, .46, L / 2 + .12, .03, .03, .34, 8, 0x2a2c30, 15);
    any = true;
  }
  if (m.bmp === 3) {
    k.box(0, .34, L / 2 + .24, Wd * .96, .5, .07, STEEL, 15, .42);
    for (let i = 0; i < 7; i++) k.add(new T.ConeGeometry(.045, .22, 6), 0xc8ccd2, 15, tf(-Wd * .42 + i * Wd * .14, .2, L / 2 + .46, Math.PI / 2, 0, 0));
    any = true;
  }
  if (m.exh === 1) { for (const sx of [-1, 1]) k.cyl(sx * Wd * .22, .3, -L / 2 - .02, .05, .05, .16, 12, 0x6a5aa8, 15, Math.PI / 2, 0, 0); any = true; }
  if (m.exh === 2) { for (const sx of [-1, 1]) k.cyl(sx * (Wd / 2 + .03), .28, .1, .055, .055, 1.2, 12, 0xd8dce2, 15, Math.PI / 2, 0, 0); any = true; }
  if (m.exh === 3) { for (const sx of [-1, 1]) k.cyl(sx * .14, .3, -L / 2 - .04, .075, .075, .22, 12, 0x1a1a1a, 15, Math.PI / 2, 0, 0); any = true; }
  if (m.ng) { for (const sx of [-1, 1]) k.box(sx * Wd * .44, .1, 0, .03, .02, L * .62, NEON_HEX[m.ng], 8); any = true; }
  if (!any) return null;
  const g = new T.Group(), me = new T.Mesh(k.build(), MAT.uber); me.userData.kit = 1; g.add(me);
  return g;
}

// ─── 廠房：門在 z = 0，x −18..18、z 0..CD；前段 z < MEZ_Z 挑高 9.6 m，後段是 2 樓夾層（樓板 4.8 m） ───
const CW_X = 18, CD = 34, CW_H = 9.6, MEZ_Y = 4.8, MEZ_Z = 20;
const DOORS_X = [-12, 0, 12], DOOR_W = 5.5, DOOR_H = 4.5;
const CHROME_CAR = { x: 0, z: 7.4, yaw: Math.PI };   // 工位 2：滾筒馬力機（車頭朝門口）
const BAY1 = { x: -12, z: 5.4, yaw: Math.PI }, BAY3 = { x: 12, z: 6.2 }, BAY4 = { x: 12, z: 16.6, yaw: -Math.PI / 2 };
const JOHNNY = { x: 3.6, z: 15.6, yaw: Math.PI }, ROOK = { x: 16.4, z: 14.4, yaw: -Math.PI / 2 }, CW_DISP = { x: BAY3.x, z: BAY3.z, yaw: -2.5 };
const STAIR = { x: -4.8, z0: 12.6, z1: 20 };
const PRIV = [];   // 2 樓私人展示車庫的 10 個車位：前排車頭朝 +z、後排朝 −z
for (const [z, yaw] of [[23.2, 0], [31.2, Math.PI]]) for (const x of [2.2, 5.6, 9, 12.4, 15.8]) PRIV.push({ x, z, yaw });
const chromeScene = new T.Scene();
const chromeLv = [{ boxes: [], circles: [], lights: [] }, { boxes: [], circles: [], lights: [] }];
const chrome = { lv: chromeLv, people: null, show: null, parked: false, stolen: null, stoleShow: null, job: null, jobShow: null, priv: [], staff: [], doorB: null, doorT: 0, dim: false, rev: 0 };
// 美式招牌與工位牌（名稱都是原創）畫在自己的 1024 貼圖上：20-props.js 的招牌圖集已經滿了
const cwAtlas = document.createElement('canvas'); cwAtlas.width = cwAtlas.height = 1024;
const cwCells = {};
let cwX = 0, cwY = 0, cwRow = 0;
function cwCell(name, w, h, draw) {
  if (cwX + w > 1024) { cwX = 0; cwY += cwRow + 2; cwRow = 0; }
  const c = cwAtlas.getContext('2d'), x = cwX, y = cwY; cwX += w + 2; cwRow = Math.max(cwRow, h);
  c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip(); c.translate(x, y); draw(c, w, h); c.restore();
  cwCells[name] = { u0: x / 1024, v0: 1 - (y + h) / 1024, u1: (x + w) / 1024, v1: 1 - y / 1024 };
  if (y + h > 1024) console.warn('chrome sign atlas overflow', name);
}
cwCell('CW_SPEED', 512, 192, (c, w, h) => {
  plate(c, w, h, '#efe4c8'); c.strokeStyle = '#b3201c'; c.lineWidth = 12; c.strokeRect(10, 10, w - 20, h - 20); c.lineWidth = 3; c.strokeRect(24, 24, w - 48, h - 48);
  c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#1b2a4a'; c.font = `800 26px ${FONT_C}`; c.fillText('CHROME WORKS', w / 2, 50);
  c.fillStyle = '#b3201c'; c.font = `900 70px ${FONT_B}`; c.fillText('SPEED SHOP', w / 2, h * .54);
  c.fillStyle = '#1b2a4a'; c.font = `700 20px ${FONT_C}`; c.fillText('EST. 1987  ·  CUSTOM  ·  PAINT  ·  PERFORMANCE', w / 2, h - 40);
});
cwCell('CW_OIL', 256, 256, (c, w, h) => {
  plate(c, w, h, '#0d0d10'); c.fillStyle = '#f2ead6'; c.beginPath(); c.arc(128, 128, 122, 0, 6.2832); c.fill();
  c.fillStyle = '#167a3c'; c.beginPath(); c.arc(128, 128, 108, 0, 6.2832); c.fill();
  c.fillStyle = '#f2ead6'; c.beginPath(); for (let i = 0; i < 10; i++) { const a = i / 10 * 6.2832 - 1.5708, r = i % 2 ? 26 : 62; c.lineTo(128 + Math.cos(a) * r, 120 + Math.sin(a) * r); } c.fill();
  c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#f2ead6'; c.font = `800 26px ${FONT_C}`; c.fillText('NIGHTHAWK', 128, 46); c.font = `700 22px ${FONT_C}`; c.fillText('MOTOR OIL', 128, 204);
});
cwCell('CW_ROUTE', 256, 256, (c, w, h) => {
  plate(c, w, h, '#0d0d10'); const sh = () => { c.beginPath(); c.moveTo(28, 40); c.quadraticCurveTo(128, 0, 228, 40); c.lineTo(222, 150); c.quadraticCurveTo(190, 222, 128, 248); c.quadraticCurveTo(66, 222, 34, 150); c.closePath(); };
  c.fillStyle = '#f4f1ea'; sh(); c.fill(); c.lineWidth = 9; c.strokeStyle = '#141414'; sh(); c.stroke();
  c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#141414'; c.font = `800 30px ${FONT_C}`; c.fillText('NEON CITY', 128, 64); c.font = `900 120px ${FONT_C}`; c.fillText('9', 128, 150);
});
cwCell('CW_GAS', 256, 160, (c, w, h) => {
  plate(c, w, h, '#f2c21b'); c.fillStyle = '#121212'; for (let i = -3; i < 12; i++) { c.beginPath(); c.moveTo(i * 28, 0); c.lineTo(i * 28 + 14, 0); c.lineTo(i * 28 - 2, 22); c.lineTo(i * 28 - 16, 22); c.fill(); c.beginPath(); c.moveTo(i * 28, h - 22); c.lineTo(i * 28 + 14, h - 22); c.lineTo(i * 28 - 2, h); c.lineTo(i * 28 - 16, h); c.fill(); }
  c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = `900 46px ${FONT_B}`; c.fillText('HIGH', w / 2, 60); c.font = `800 34px ${FONT_C}`; c.fillText('OCTANE  ·  100', w / 2, 106);
});
cwCell('CW_HOT', 512, 128, (c, w, h) => { plate(c, w, h, '#050306'); neon(c, 'Hot Rods & Customs', w / 2, h * .5, 64, '#ff4f9a', FONT_S, 700); });
cwCell('CW_OPEN', 256, 96, (c, w, h) => { plate(c, w, h, '#050306'); neon(c, 'OPEN', 92, h * .5, 54, '#ff3a2a', FONT_C, 800); neon(c, '24H', 196, h * .5, 40, '#3aa0ff', FONT_C, 800); });
// 工位牌：黃底黑字的大號碼＋中文
const BAY_TXT = [['1', '鈑金與烤漆'], ['2', '動力馬力機'], ['3', '低底盤重改'], ['4', '黑市拆解']];
BAY_TXT.forEach(([n, t], i) => cwCell('CW_BAY' + (i + 1), 256, 128, (c, w, h) => {
  plate(c, w, h, i === 3 ? '#1a1612' : '#f2c21b'); c.fillStyle = i === 3 ? '#e8b048' : '#121212'; c.textBaseline = 'middle';
  c.font = `900 96px ${FONT_B}`; c.textAlign = 'center'; c.fillText(n, 56, h / 2 + 4); c.fillRect(104, 18, 4, h - 36);
  c.textAlign = 'left'; c.font = `800 22px ${FONT_C}`; c.fillText('BAY ' + n, 122, 40); c.font = `800 30px ${FONT_C}`; c.fillText(t, 122, 84);
}));
cwCell('CW_LOW', 512, 128, (c, w, h) => { plate(c, w, h, '#050306'); neon(c, 'Low & Slow', w / 2, h * .46, 62, '#ff4fd8', FONT_S, 700); c.fillStyle = '#ffd0f0'; c.font = `700 18px ${FONT_C}`; c.textAlign = 'center'; c.fillText('LOWRIDER · HYDRAULICS · ARMOR', w / 2, h - 16); });
cwCell('CW_CHOP', 512, 128, (c, w, h) => { plate(c, w, h, '#2a2016'); c.strokeStyle = '#e8b048'; c.lineWidth = 6; c.strokeRect(8, 8, w - 16, h - 16); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#e8b048'; c.font = `900 48px ${FONT_B}`; c.fillText('PARTS & SALVAGE', w / 2, 52); c.font = `700 22px ${FONT_C}`; c.fillText('現金收車 · 不問來歷', w / 2, 96); });
cwCell('CW_DYNO', 256, 128, (c, w, h) => { plate(c, w, h, '#0a0c10'); neon(c, 'DYNO', w / 2, 50, 56, '#2cf2d8', FONT_C, 800); c.fillStyle = '#9ff8ee'; c.font = `700 20px ${FONT_C}`; c.textAlign = 'center'; c.fillText('POWER · TORQUE · BOOST', w / 2, 102); });
cwCell('CW_MEGA', 512, 128, (c, w, h) => { plate(c, w, h, '#050306'); neon(c, 'CHROME WORKS', w / 2, 46, 52, '#2cf2d8', FONT_C, 900); neon(c, '霓虹改車王總廠 · MEGA CUSTOMS', w / 2, 100, 26, '#ff4f9a', FONT_C, 800); });
cwCell('CW_PRIV', 256, 96, (c, w, h) => { plate(c, w, h, '#14110c'); c.strokeStyle = '#c9a24a'; c.lineWidth = 3; c.strokeRect(6, 6, w - 12, h - 12); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#e6c878'; c.font = `800 26px ${FONT_C}`; c.fillText('PRIVATE GARAGE', w / 2, 36); c.font = `700 22px ${FONT_C}`; c.fillText('私人展示車庫', w / 2, 68); });
const cwTex = new T.CanvasTexture(cwAtlas);
cwTex.colorSpace = T.SRGBColorSpace; cwTex.anisotropy = 8; cwTex.minFilter = T.LinearMipmapLinearFilter;
const MAT_CW = MAT_SIGN.clone(); MAT_CW.uniforms = { ...shared(ALLU), tAtlas: { value: cwTex } };
const CW_SIGN = (S, name, x, y, z, ry, w, h, glow = 1.4, kind = 0) => {
  const own = name in cwCells, g = new T.PlaneGeometry(w, h), uv = g.attributes.uv, c = own ? cwCells[name] : cells[name];
  for (let i = 0; i < uv.count; i++) uv.setXY(i, lerp(c.u0, c.u1, uv.getX(i)), lerp(c.v0, c.v1, uv.getY(i)));
  g.setAttribute('aS', new T.Float32BufferAttribute(new Array(uv.count).fill(0).flatMap(() => [Math.random(), kind, glow, 0]), 4));
  const m = new T.Mesh(g, own ? MAT_CW : MAT_SIGN); m.position.set(x, y, z); m.rotation.y = ry; S.add(m); return m;
};
// 工位 4 的每日出口懸賞黑板：自己的畫布（69-v6-customs.js 每天換車單時重畫）
const cwBoard = document.createElement('canvas'); cwBoard.width = 512; cwBoard.height = 320;
const cwBoardTex = new T.CanvasTexture(cwBoard); cwBoardTex.colorSpace = T.SRGBColorSpace;
const MAT_BOARD = MAT_SIGN.clone(); MAT_BOARD.uniforms = { ...shared(ALLU), tAtlas: { value: cwBoardTex } };
function boardDraw(list, done = []) {
  const c = cwBoard.getContext('2d'), w = 512, h = 320;
  c.fillStyle = '#1d2a22'; c.fillRect(0, 0, w, h); c.strokeStyle = '#6a4a2a'; c.lineWidth = 14; c.strokeRect(0, 0, w, h);
  c.fillStyle = '#e8efe4'; c.textBaseline = 'middle'; c.textAlign = 'left';
  c.font = `800 30px ${FONT_C}`; c.fillText('今日出口車單  EXPORT', 30, 44);
  c.fillRect(30, 66, w - 60, 2);
  list.forEach((n, i) => { const ok = done.includes(n); c.globalAlpha = ok ? .45 : 1; c.font = `700 32px ${FONT_C}`; c.fillText(`${i + 1}. ${TYPE_NAME[n] || n}`, 40, 112 + i * 62); if (ok) { c.fillRect(36, 112 + i * 62, w - 80, 3); } c.globalAlpha = 1; });
  c.font = `700 20px ${FONT_C}`; c.fillStyle = '#c8d8c0'; c.fillText('完好交車 ×2.5 · 不算冷卻', 30, h - 28);
  cwBoardTex.needsUpdate = true;
}
{
  const S = chromeScene, k = new Kit(), rc = rng(1987), L0 = chromeLv[0], L1 = chromeLv[1];
  const B0 = L0.boxes, B1 = L1.boxes;
  const red = 0xb3121a, cream = 0xefe6d2, steel = 0x16171a, brass = 0xc9a24a, yel = 0xe8c020, wallC = 0xd8d6d0, panel = 0xc4c6c8;
  const both = b => { B0.push({ ...b }); B1.push({ ...b }); };
  // 外牆：下半是淺灰空心磚（水平灰縫），上半是白色浪板，腰線一條霓虹青色帶
  for (const s of [-1, 1]) {
    k.box(s * (CW_X + .2), CW_H / 2, CD / 2, .4, CW_H, CD + .4, wallC, 2); both({ x0: s > 0 ? CW_X : -CW_X - .4, x1: s > 0 ? CW_X + .4 : -CW_X, z0: 0, z1: CD });
    for (let y = .4; y < 3.6; y += .4) k.box(s * (CW_X - .01), y, CD / 2, .02, .02, CD, 0xa8a6a0, 2);
    k.box(s * (CW_X - .02), 3.75, CD / 2, .04, .14, CD, 0x2cf2d8, 8);
    for (let u = .25; u < CD; u += .5) k.box(s * (CW_X - .03), 6.7, u, .04, 5.6, .06, panel, 10);
  }
  k.box(0, CW_H / 2, CD + .2, CW_X * 2 + .8, CW_H, .4, wallC, 2); both({ x0: -CW_X, x1: CW_X, z0: CD, z1: CD + .4 });
  for (let y = .4; y < 3.6; y += .4) k.box(0, y, CD - .01, CW_X * 2, .02, .02, 0xa8a6a0, 2);
  k.box(0, 3.75, CD - .02, CW_X * 2, .14, .04, 0x2cf2d8, 8);
  // 前牆：三道 5.5 × 4.5 m 的捲門開口（A、B、C），門楣以上是浪板；A、C 關著，B 是你開進來的那道（進來之後自動放下）
  {
    let x = -CW_X;
    for (const dx of DOORS_X) {
      const a = dx - DOOR_W / 2, b = dx + DOOR_W / 2;
      k.box((x + a) / 2, CW_H / 2, -.2, a - x, CW_H, .4, wallC, 2); B0.push({ x0: x, x1: a, z0: -.4, z1: 0 });
      k.box(dx, (DOOR_H + CW_H) / 2, -.2, DOOR_W, CW_H - DOOR_H, .4, wallC, 2);
      for (const sx of [a, b]) k.box(sx, DOOR_H / 2, .02, .16, DOOR_H, .1, yel, 2).box(sx, DOOR_H / 2, .03, .17, DOOR_H, .02, 0x121212, 2, 0, 0, 0);
      k.box(dx, DOOR_H + .2, .02, DOOR_W + .3, .3, .1, 0x2a2c30, 15).cyl(dx, DOOR_H + .55, .4, .28, .28, DOOR_W, 16, 0x6c7176, 15, 0, 0, Math.PI / 2);
      if (dx !== 0) for (let y = .12; y < DOOR_H; y += .24) k.box(dx, y, -.05, DOOR_W, .2, .05, 0x8c9196, 15).box(dx, y + .11, -.03, DOOR_W, .03, .04, 0x5a5e62, 15);
      // 門頂的警示黃燈（旋轉燈罩）
      k.cyl(b - .3, DOOR_H + .55, .2, .1, .1, .16, 12, 0xffa020, 11);
      x = b;
    }
    k.box((x + CW_X) / 2, CW_H / 2, -.2, CW_X - x, CW_H, .4, wallC, 2); B0.push({ x0: x, x1: CW_X, z0: -.4, z1: 0 });
    B0.push({ x0: -CW_X, x1: CW_X, z0: -1.4, z1: -.45 });
    B1.push({ x0: -CW_X, x1: CW_X, z0: -.4, z1: 0 });
  }
  // 地板：反光環氧樹脂（深灰帶一點藍）、黃色工位線、行人走道斑馬線
  k.box(0, -.05, CD / 2, CW_X * 2 + .4, .1, CD + .4, 0x4a5058, 10);
  for (const x of [-6, 6]) k.box(x, .004, MEZ_Z / 2 - 3.5, .14, .006, MEZ_Z - 7, yel, 2);
  for (let i = -8; i <= 8; i++) k.box(i * 2, .004, 13.2, .14, .006, .06, yel, 2);
  k.box(0, .004, 13.2, CW_X * 2, .006, .1, yel, 2);
  for (let i = 0; i < 6; i++) k.box(-2.5 + i * 1, .005, 1.3, .5, .006, 2, 0xe8e4da, 2);
  // 天花板、黑色桁架、LED 高天井燈
  k.box(0, CW_H + .05, CD / 2, CW_X * 2 + .4, .1, CD + .4, 0x6a6862, 2);
  for (let z = 3; z < CD; z += 4.5) { k.box(0, CW_H - .35, z, CW_X * 2, .06, .24, steel, 15).box(0, CW_H - .06, z, CW_X * 2, .06, .24, steel, 15).box(0, CW_H - .2, z, CW_X * 2, .28, .03, steel, 15); }
  for (const x of [-12, -6, 0, 6, 12]) k.box(x, CW_H - .14, CD / 2, .14, .18, CD, steel, 15);
  for (const x of [-12, 0, 12]) for (const z of [4, 10, 16]) { k.cyl(x, CW_H - .9, z, .45, .55, .3, 20, 0x8a8e94, 15).cyl(x, CW_H - 1.06, z, .5, .5, .02, 20, 0xf6efe2, 11).cyl(x, CW_H - .45, z, .01, .01, .7, 4, 0x111111, 15); }
  // ─── 2 樓夾層：樓板、鋼柱、玻璃欄杆；樓梯在走廊左邊（x −5.6..−4，z 12.6 → 20） ───
  k.box(0, MEZ_Y - .15, (MEZ_Z + CD) / 2, CW_X * 2, .3, CD - MEZ_Z, 0x9a9690, 2);
  k.box(0, MEZ_Y + .002, (MEZ_Z + CD) / 2, CW_X * 2, .006, CD - MEZ_Z, 0x5a5e66, 10);   // 夾層地板：深灰橡膠地墊
  k.box(0, MEZ_Y - .32, MEZ_Z + .05, CW_X * 2, .34, .14, 0x2a2c30, 15);
  for (const x of [-12, -4, 4, 12]) for (const z of [MEZ_Z + .2, 27]) { k.box(x, (MEZ_Y - .3) / 2, z, .3, MEZ_Y - .3, .3, 0x2a2c30, 15); B0.push({ x0: x - .2, x1: x + .2, z0: z - .2, z1: z + .2 }); }
  for (let x = -CW_X + .3; x < CW_X; x += 1.6) if (x < -5.8 || x > -3.8) k.box(x, MEZ_Y + .5, MEZ_Z + .1, .04, 1, .04, 0x2a2c30, 15);
  k.box(0, MEZ_Y + 1.02, MEZ_Z + .1, CW_X * 2, .05, .08, 0x2a2c30, 15).box(0, MEZ_Y + .55, MEZ_Z + .12, CW_X * 2, .9, .02, 0x9fb8c0, 10);
  B1.push({ x0: -CW_X, x1: CW_X, z0: -1, z1: MEZ_Z + .2, low: 1 });   // 夾層邊緣（擋人不擋相機）
  // 樓梯：鋼構踏板、兩側扶手；底下擋起來
  {
    const n = 16, x0 = -5.6, x1 = -4;
    for (let i = 0; i < n; i++) { const z = STAIR.z0 + (i + .5) * (STAIR.z1 - STAIR.z0) / n, y = (i + 1) * MEZ_Y / n; k.box((x0 + x1) / 2, y - .03, z, x1 - x0, .06, (STAIR.z1 - STAIR.z0) / n + .02, 0x6a6e74, 15); }
    for (const x of [x0 - .05, x1 + .05]) k.box(x, MEZ_Y / 2 + .45, (STAIR.z0 + STAIR.z1) / 2, .05, .05, 8.4, yel, 2, -Math.atan2(MEZ_Y, STAIR.z1 - STAIR.z0)).box(x, MEZ_Y / 2, (STAIR.z0 + STAIR.z1) / 2, .1, .1, 8, 0x2a2c30, 15, -Math.atan2(MEZ_Y, STAIR.z1 - STAIR.z0));
    B0.push({ x0: x0 - .1, x1: x1 + .1, z0: STAIR.z0 + .8, z1: STAIR.z1 });
  }
  // ─── 工位 1：鈑金與烤漆。四柱液壓頂高機（客戶車／委託車）、無塵靜電烤漆房（後半） ───
  {
    const { x, z } = BAY1;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) { k.box(x + sx * 1.6, 1.4, z + sz * 2.7, .26, 2.8, .26, 0x1f5fa8, 0); B0.push({ x0: x + sx * 1.6 - .16, x1: x + sx * 1.6 + .16, z0: z + sz * 2.7 - .16, z1: z + sz * 2.7 + .16 }); }
    for (const sz of [-1, 1]) k.box(x, 2.82, z + sz * 2.7, 3.5, .12, .3, 0x1f5fa8, 0);
    chrome.lift1 = new T.Mesh(new Kit().box(-.85, 0, 0, .55, .1, 5.2, 0x3a3e44, 15).box(.85, 0, 0, .55, .1, 5.2, 0x3a3e44, 15).box(0, -.06, 0, 2.3, .04, .2, yel, 2).build(), MAT.uber);
    chrome.lift1.position.set(x, 1.6, z); S.add(chrome.lift1);
    const pb = { x0: -17.8, x1: -6.6, z0: 9.2, z1: 12.9 };
    k.box((pb.x0 + pb.x1) / 2, 3.6, (pb.z0 + pb.z1) / 2, pb.x1 - pb.x0, .12, pb.z1 - pb.z0, 0xe8e6e0, 2);
    for (let xx = pb.x0 + .8; xx < pb.x1; xx += 1.4) k.box(xx, 3.52, (pb.z0 + pb.z1) / 2, .9, .04, pb.z1 - pb.z0 - .4, 0xf4f8ff, 11);
    for (let xx = pb.x0 + .5; xx < pb.x1; xx += .5) k.box(xx, .006, (pb.z0 + pb.z1) / 2, .2, .01, pb.z1 - pb.z0 - .6, 0x0c0d0f, 15);
    k.box((pb.x0 + pb.x1) / 2, 1.8, pb.z0, pb.x1 - pb.x0, 3.6, .05, 0x3a4448, 10);   // 煙燻玻璃（不用玻璃材質：室內會映出城市環境貼圖的色塊）
    for (let xx = pb.x0; xx <= pb.x1 + .01; xx += (pb.x1 - pb.x0) / 6) k.box(xx, 1.8, pb.z0 - .03, .06, 3.6, .06, 0xe8e6e0, 10);
    for (const y of [.9, 2.7]) k.box((pb.x0 + pb.x1) / 2, y, pb.z0 - .03, pb.x1 - pb.x0, .05, .05, 0xe8e6e0, 10);
    k.box(pb.x1, 1.8, (pb.z0 + pb.z1) / 2, .06, 3.6, pb.z1 - pb.z0, 0xe8e6e0, 10).box((pb.x0 + pb.x1) / 2, 3.9, pb.z0 - .02, 3.4, .36, .04, red, 10);
    B0.push({ x0: pb.x0, x1: pb.x1, z0: pb.z0 - .1, z1: pb.z1 });
    // 噴漆機械臂的軌道與噴槍
    k.box((pb.x0 + pb.x1) / 2, 3.3, pb.z1 - .5, pb.x1 - pb.x0 - .4, .1, .1, 0x9aa0a6, 15).box(-12, 2.6, pb.z1 - .5, .14, 1.4, .14, 0xff8a20, 0).box(-12, 1.9, pb.z1 - .9, .1, .1, .7, 0x2a2c30, 15);
    // 工位 1 的工具櫃（紅色）與一組氧氣乙炔鋼瓶
    for (let i = 0; i < 4; i++) k.box(-17.5, .46, 1.4 + i * 1.2, .9, .9, 1.16, red, 0).box(-17.04, .5, 1.4 + i * 1.2, .02, .02, .9, 0xd8dce2, 3);
    B0.push({ x0: -18, x1: -17, z0: .8, z1: 5.8 });
  }
  // ─── 工位 2：滾筒馬力機（地坑裡兩組滾筒）、車頭前的大風扇、馬力機電腦 ───
  {
    const { x, z } = CHROME_CAR;
    k.box(x, .004, z, 3.6, .008, 6.2, 0x2a2e34, 10);
    for (const s of [-1, 1]) k.box(x + s * 1.82, .006, z, .08, .01, 6.2, yel, 2);
    for (const dz of [1.2, 1.55, -1.35, -1.0]) k.cyl(x, -.11, z + dz, .16, .16, 2.5, 20, 0x9aa0a6, 15, 0, 0, Math.PI / 2);   // 滾筒埋在地坑裡，頂面和地板齊平
    for (const dz of [1.375, -1.175]) k.box(x, .002, z + dz, 2.6, .004, .78, 0x15171a, 2);
    // 大風扇（車頭前）
    k.box(x, .9, z - 4.1, 1.7, 1.7, .4, 0x2a2c30, 15).cyl(x, .9, z - 3.88, .72, .72, .04, 28, 0x111111, 2, Math.PI / 2, 0, 0);
    for (let i = 0; i < 5; i++) k.box(x, .9, z - 3.86, .1, 1.3, .02, 0x8a8e94, 15, 0, 0, i * Math.PI / 5);
    B0.push({ x0: x - .9, x1: x + .9, z0: z - 4.35, z1: z - 3.85 });
    // 馬力機電腦（工位 2 右前）：機櫃與兩台螢幕
    k.box(3.6, .6, 3.2, .8, 1.2, .6, 0x2a2c30, 15).box(3.6, 1.55, 3.0, 1.1, .62, .05, 0x0a0c10, 1, -.1).box(3.6, 1.55, 3.03, 1.0, .54, .02, 0x2a8a7a, 11, -.1);
    B0.push({ x0: 3.15, x1: 4.05, z0: 2.85, z1: 3.55 });
    // 綁帶與輪擋
    for (const s of [-1, 1]) k.box(x + s * 1.2, .08, z + 2.6, .2, .16, .4, yel, 2).box(x + s * 1.2, .08, z - 2.4, .2, .16, .4, yel, 2);
  }
  // ─── 工位 3：低底盤重改區。棋盤格地、低底盤展示台（液壓起落）、焊裝甲的機械臂、裝炸彈的工作檯 ───
  {
    const { x, z } = BAY3;
    for (let i = 0; i < 10; i++) for (let j = 0; j < 14; j++) k.box(x - 2.7 + i * .6, .006, z - 3.9 + j * .6, .6, .01, .6, (i + j) % 2 ? 0x0e0e10 : 0xe8e4da, 0);
    k.cyl(x, .09, z, 2.9, 3.0, .18, 48, 0x0e0e10, 10).add(new T.TorusGeometry(2.95, .03, 4, 64), brass, 3, tf(x, .18, z, Math.PI / 2, 0, 0)).add(new T.TorusGeometry(3.02, .015, 4, 64), 0xff4fd8, 8, tf(x, .06, z, Math.PI / 2, 0, 0));
    L0.circles.push({ x, z, r: 2.95 });
    // 焊接機械臂：黃色基座、兩節手臂、焊槍（69-v6 那邊不動它；火花在 updateChrome）
    const ax = 16.2, az = 3.6;
    k.cyl(ax, .3, az, .5, .6, .6, 20, 0xe8a020, 0).cyl(ax, .9, az, .25, .25, .6, 16, 0x2a2c30, 15).box(ax - .7, 1.8, az + .3, 1.6, .26, .26, 0xe8a020, 0, 0, -.35, .55).box(ax - 1.9, 2.0, az + .9, 1.2, .2, .2, 0xe8a020, 0, 0, -.6, -.3).cyl(ax - 2.4, 1.8, az + 1.3, .06, .03, .4, 8, 0x2a2c30, 15);
    chrome.weld = { x: ax - 2.5, y: 1.62, z: az + 1.4 };
    L0.circles.push({ x: ax, z: az, r: .7 });
    // 炸彈工作檯（右後）：木檯面、電線、計時器
    k.box(16.6, .45, 11.6, 1.4, .9, 2.4, 0x5a3820, 10).box(16.6, .93, 11.6, 1.5, .06, 2.5, 0x2a1810, 0);
    k.box(16.5, 1.02, 11.2, .4, .12, .3, 0x2a2c30, 15).box(16.5, 1.09, 11.2, .2, .04, .12, 0xff2a2a, 8).box(16.7, 1.0, 12.0, .3, .1, .5, 0x8a6a30, 2);
    for (let i = 0; i < 4; i++) k.cyl(16.3 + i * .12, .97, 11.7, .008, .008, .6, 4, [0xff2020, 0x2040ff, 0xffd020, 0x20c040][i], 2, Math.PI / 2, 0, 0);
    B0.push({ x0: 15.85, x1: 17.4, z0: 10.35, z1: 12.85 });
    // 氧氣乙炔鋼瓶（綠色氧氣、紅色乙炔）放在推車上：69-v6-customs.js 開槍打中會連環爆炸
    for (const [cx, cz] of [[-7.4, 2.6], [7.6, 10.8]]) {
      k.box(cx, .2, cz, .7, .08, .5, 0x2a2c30, 15);
      k.cyl(cx - .17, .85, cz, .12, .12, 1.3, 14, 0x2f6a3a, 0).cyl(cx + .17, .8, cz, .14, .14, 1.2, 14, 0x8a1018, 0);
      k.add(new T.SphereGeometry(.12, 10, 6), 0x2f6a3a, 0, tf(cx - .17, 1.5, cz)).add(new T.SphereGeometry(.14, 10, 6), 0x8a1018, 0, tf(cx + .17, 1.4, cz));
      L0.circles.push({ x: cx, z: cz, r: .45 });
    }
  }
  // ─── 中段：零件展示走廊（輪框架、尾翼牆）、鐵手強尼的工作站、工位 4 拆解區的鐵網隔間 ───
  {
    // 輪框展示架（走廊左側，面向走廊）
    for (let i = 0; i < 6; i++) {
      const x = -16 + i * 1.5, z = 19.6;
      k.box(x, 1.6, z + .2, 1.3, 3.2, .1, 0x2a2c30, 15);
      for (let j = 0; j < 2; j++) { k.cyl(x, 1 + j * 1.2, z, .42, .42, .12, 24, [0xd8dce2, 0x1a1b1e, 0xc9a227, 0x9aa0a6, 0xb03040, 0x3a6ad8][(i + j) % 6], 3, Math.PI / 2, 0, 0); for (let s = 0; s < 6; s++) { const a = s / 6 * Math.PI * 2; k.box(x + Math.cos(a) * .2, 1 + j * 1.2 + Math.sin(a) * .2, z - .07, .05, .26, .03, 0x2a2c30, 15, 0, 0, a + Math.PI / 2); } }
    }
    B0.push({ x0: -16.8, x1: -7.6, z0: 19.3, z1: 20 });
    // 尾翼牆（走廊右側）：三支尾翼掛在牆上
    for (let i = 0; i < 3; i++) { const x = -2 + i * 2.1; k.box(x, 2.6 + (i % 2) * .5, 19.9, 1.8, .06, .3, [CARBON, 0xd8dce2, red][i], 15, -.2).box(x - .6, 2.4 + (i % 2) * .5, 19.95, .04, .4, .1, 0x2a2c30, 15).box(x + .6, 2.4 + (i % 2) * .5, 19.95, .04, .4, .1, 0x2a2c30, 15); }
    // 鐵手強尼的工作站（走廊中央，面向工位 2）：工作檯、診斷電腦、工具牆
    k.box(JOHNNY.x, .48, JOHNNY.z - .9, 3, .96, .8, 0x3a3e44, 15).box(JOHNNY.x, .98, JOHNNY.z - .9, 3.1, .06, .9, 0xb8bcc0, 15);
    k.box(JOHNNY.x - .8, 1.35, JOHNNY.z - .7, .7, .45, .05, 0x0a0c10, 1).box(JOHNNY.x - .8, 1.35, JOHNNY.z - .73, .64, .38, .02, 0x2a6a8a, 11);
    k.box(JOHNNY.x + .5, 1.1, JOHNNY.z - .8, .5, .2, .3, red, 0);
    B0.push({ x0: JOHNNY.x - 1.55, x1: JOHNNY.x + 1.55, z0: JOHNNY.z - 1.35, z1: JOHNNY.z - .45 });
    // 工位 4 的鐵網隔間（x = 6，z 13.6..20；留一個 2.4 m 的門）
    for (let z = 13.6; z < 20; z += 1.6) if (z < 15.4 || z > 17.6) { k.box(6, 1.25, z + .8, .04, 2.5, 1.56, 0x8a8e94, 15); for (let y = .2; y < 2.5; y += .25) k.box(6.02, y, z + .8, .01, .01, 1.56, 0x5a5e62, 15); }
    B0.push({ x0: 5.9, x1: 6.1, z0: 13.6, z1: 15.4 }, { x0: 5.9, x1: 6.1, z0: 17.6, z1: 20 });
  }
  // ─── 工位 4：黑市拆解區。地磅（黑黃斜紋邊）、銷贓秤、出口懸賞黑板、Rook 的收車檯、一堆拆下來的車門與引擎蓋 ───
  {
    const { x, z } = BAY4;
    k.box(x, .02, z, 6.4, .04, 3.2, 0x5a5e62, 15);
    for (let i = 0; i < 16; i++) k.box(x - 3.2 + i * .4 + .2, .045, z - 1.6, .2, .01, .12, i % 2 ? 0x111214 : yel, 2, 0, .6).box(x - 3.2 + i * .4 + .2, .045, z + 1.6, .2, .01, .12, i % 2 ? 0x111214 : yel, 2, 0, .6);
    k.box(17.6, 1.6, z - 1.8, .3, 1.4, 1, 0x2a2c30, 15).box(17.44, 1.7, z - 1.8, .02, .5, .7, 0x1a3a2a, 11);   // 秤的讀數盒
    k.box(16.9, .5, ROOK.z, .9, 1, 2.2, 0x4a2c18, 10).box(16.9, 1.03, ROOK.z, 1, .06, 2.3, 0x2a1810, 0);
    B0.push({ x0: 16.4, x1: 17.4, z0: ROOK.z - 1.15, z1: ROOK.z + 1.15 });
    for (let i = 0; i < 5; i++) k.box(14.6 + (i % 2) * .3, .1 + i * .12, 19.2, 1.2, .1, 1.6, [0x8a1018, 0x3c4148, 0x0d3b5c, 0xd8d4c8, 0x2f6a3a][i], 0, 0, i * .3);
    B0.push({ x0: 13.8, x1: 15.6, z0: 18.3, z1: 20 });
    const bd = new T.Mesh(new T.PlaneGeometry(2.4, 1.5), MAT_BOARD);
    bd.geometry.setAttribute('aS', new T.Float32BufferAttribute([0, 0, .55, 0, 0, 0, .55, 0, 0, 0, .55, 0, 0, 0, .55, 0], 4));
    bd.position.set(17.95, 2.4, z + 1.4); bd.rotation.y = -Math.PI / 2; S.add(bd);
    k.box(17.97, 2.4, z + 1.4, .04, 1.62, 2.52, 0x6a4a2a, 10);
  }
  // ─── 夾層底下（z 20..34）：休息區（左）、零件倉庫（右）、工具牆（後） ───
  {
    k.box(-15.6, .27, 26, .95, .34, 3.2, 0x5a2e1a, 10).box(-16.05, .72, 26, .26, .62, 3.2, 0x5a2e1a, 10);
    k.add(new T.TorusGeometry(.42, .17, 10, 22), 0x121212, 6, tf(-14.0, .18, 26, Math.PI / 2, 0, 0)).cyl(-14.0, .37, 26, .62, .62, .03, 28, 0x9fc4c8, 10);
    B0.push({ x0: -16.2, x1: -15.1, z0: 24.3, z1: 27.7 }); L0.circles.push({ x: -14, z: 26, r: .62 });
    const gp = { x: -17.3, z: 30.5 };
    k.box(gp.x, .95, gp.z, .5, 1.7, .7, red, 0).box(gp.x + .26, 1.25, gp.z, .02, .5, .5, cream, 2).add(new T.SphereGeometry(.24, 16, 12), 0xfff4e0, 11, tf(gp.x, 2.1, gp.z));
    B0.push({ x0: gp.x - .3, x1: gp.x + .3, z0: gp.z - .4, z1: gp.z + .4 });
    // 後牆的紅色工具櫃一整排
    for (let i = 0; i < 8; i++) { const x = -6 + i * 1.3; k.box(x, .46, CD - .6, 1.24, .9, .92, red, 0); for (let d = 0; d < 4; d++) k.box(x, .18 + d * .2, CD - 1.07, 1.0, .02, .02, 0xd8dce2, 3); }
    k.box(-1.45, .96, CD - .6, 10.5, .06, 1, 0xb8bcc0, 15);
    B0.push({ x0: -6.7, x1: 3.8, z0: CD - 1.1, z1: CD });
    k.box(-1.45, 2.25, CD - .1, 10.5, 1.3, .05, 0x3a3430, 2);
    for (let i = 0; i < 24; i++) k.box(-6.3 + i * .42, 2.1 + (i % 3) * .35, CD - .14, .05, .4 - (i % 2) * .12, .03, 0xb8bcc2, 15, 0, 0, (i % 3 - 1) * .3);
  }
  // ─── 2 樓：老闆辦公室（左，玻璃隔間）、街機區（中）、私人展示車庫（右） ───
  {
    const y = MEZ_Y;
    // 辦公室玻璃隔間（x = −8，留 1.4 m 的門）與一段前牆
    k.box(-8, y + 1.5, (23.4 + CD) / 2, .05, 3, CD - 23.4, 0x3a4448, 10).box(-8, y + 3.02, (MEZ_Z + CD) / 2, .08, .06, CD - MEZ_Z, 0x2a2c30, 15);
    B1.push({ x0: -8.1, x1: -7.9, z0: 23.4, z1: CD });
    k.box(-13, y + .38, 29.5, 2.4, .06, 1.2, 0x4a2c18, 10).box(-13, y + .2, 29.5, 2.2, .36, 1, 0x3a2414, 10);   // 辦公桌
    k.box(-13.4, y + .45, 29.4, .5, .02, .34, 0x0a0c10, 1).box(-12.4, y + .46, 29.6, .26, .02, .18, 0x2a2c30, 15);
    k.box(-13, y + .45, 30.6, .6, .9, .6, 0x1a1a1a, 10);   // 皮椅
    k.box(-17.4, y + .55, 32.8, .9, 1.1, .9, 0x3a3e44, 15).cyl(-16.94, y + .65, 32.8, .12, .12, .04, 16, 0xc9a24a, 3, 0, 0, Math.PI / 2);   // 保險箱
    B1.push({ x0: -14.3, x1: -11.7, z0: 28.8, z1: 30.2 }, { x0: -17.9, x1: -16.9, z0: 32.3, z1: 33.3 });
    // 私人展示車庫：灰色地坪、白色車格線、招牌
    k.box(9, y + .004, 27.2, 18, .006, 14, 0x707478, 10);
    for (const P of PRIV) for (const s of [-1, 1]) k.box(P.x + s * 1.7, y + .008, P.z, .06, .004, 4.6, 0xe8e4da, 2);
    CW_SIGN(S, 'CW_PRIV', 9, y + 3.6, CD - .1, Math.PI, 2.6, .98, .9);
    // 載車升降機（右前角，裝飾）
    k.box(17, y + 1.6, 26.8, .1, 3.2, 4.8, 0x2a2c30, 15).box(16.95, y + 2.9, 26.8, .04, .3, 3.4, yel, 2);
  }
  S.add(new T.Mesh(k.build(), MAT.uber));
  // 捲門 B 外的雨夜街景（和車行的落地窗同一個 shader）與門 B 本身（進來之後放下）
  { const m = new T.Mesh(new T.PlaneGeometry(DOOR_W - .2, DOOR_H - .1), new T.ShaderMaterial({ uniforms: shared(ALLU), vertexShader: `varying vec2 vUv; varying vec3 vW; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`, fragmentShader: WINDOW_FS }));
    m.position.set(0, DOOR_H / 2, -.6); S.add(m); }
  { const dk = new Kit(); for (let y = .12; y < DOOR_H; y += .24) dk.box(0, y, 0, DOOR_W, .2, .05, 0x8c9196, 15).box(0, y + .11, .02, DOOR_W, .03, .04, 0x5a5e62, 15);
    chrome.doorB = new T.Mesh(dk.build(), MAT.uber); chrome.doorB.position.set(0, 0, -.05); S.add(chrome.doorB); }
  // 招牌：後牆的 SPEED SHOP、前牆內側的總廠霓虹、工位牌、低底盤霓虹、拆解區招牌、馬力機、機油牌與公路盾牌、OPEN 24H
  CW_SIGN(S, 'CW_SPEED', -1.4, 3.9, CD - .1, Math.PI, 4.8, 1.8, .75);
  CW_SIGN(S, 'CW_MEGA', 0, 7.2, .25, 0, 8, 2, 1.5);
  CW_SIGN(S, 'CW_BAY1', -12, 5.3, .25, 0, 2.2, 1.1, .7);
  CW_SIGN(S, 'CW_BAY2', 0, 5.3, .25, 0, 2.2, 1.1, .7);
  CW_SIGN(S, 'CW_BAY3', 12, 5.3, .25, 0, 2.2, 1.1, .7);
  CW_SIGN(S, 'CW_BAY4', 17.95, 3.8, BAY4.z - 1.2, -Math.PI / 2, 2.2, 1.1, .7);
  CW_SIGN(S, 'CW_LOW', 17.95, 3.4, 7, -Math.PI / 2, 4, 1, 1.7);
  CW_SIGN(S, 'CW_CHOP', 6.06, 3.1, 16.8, Math.PI / 2, 3.6, .9, .8);
  CW_SIGN(S, 'CW_DYNO', 3.6, 2.4, 2.96, Math.PI, 1.3, .65, 1.6);
  CW_SIGN(S, 'CW_OIL', -17.95, 5.4, 26, Math.PI / 2, 1.5, 1.5, .7);
  CW_SIGN(S, 'CW_ROUTE', -17.95, 5.6, 7, Math.PI / 2, 1.4, 1.4, .7);
  CW_SIGN(S, 'CW_GAS', -17.95, 2.4, 30.5, Math.PI / 2, 1.6, 1.0, .7);
  CW_SIGN(S, 'CW_HOT', -17.95, 3.2, 26, Math.PI / 2, 3.6, .9, 1.7);
  CW_SIGN(S, 'CW_OPEN', -8.6, 2.6, .25, 0, 1.6, .6, 1.8, 1);
  // 輪胎架（右後倉庫）：http(s) 下換成三座 Tire Rack 模型；以檔案開啟是程式建模的鋼架
  const tk = new Kit();
  for (let r = 0; r < 3; r++) {
    tk.box(17.4, .3 + r * 1.1, 28, .9, .05, 7, steel, 15);
    for (let i = 0; i < 9; i++) tk.add(new T.TorusGeometry(.3, .12, 8, 18), 0x121212, 6, tf(17.4, .72 + r * 1.1, 24.9 + i * .76, 0, Math.PI / 2, 0));
  }
  const tw = new T.Mesh(tk.build(), MAT.uber); S.add(tw);
  propSwap('chrome', tw, 'cw_tires', [25.25, 28, 30.75].map(z => ({ x: 17.5, z })), S, null, 'chrome');
  B0.push({ x0: 16.9, x1: 18, z0: 24.2, z1: 31.8 });
  // 引擎吊架與吊著的 V8（工位 3 左邊）
  const ex = 7.6, ez = 4, ey = -.68, hk = new Kit(), ek = new Kit();
  ek.box(ex, 1.15 + ey, ez - .7, .7, .5, 1.0, 0x3a3e44, 3);
  for (const s of [-1, 1]) { ek.box(ex + s * .26, 1.5 + ey, ez - .7, .24, .26, .95, red, 0, 0, 0, s * .5); for (let i = 0; i < 4; i++) ek.cyl(ex + s * .5, 1.4 + ey, ez - 1.05 + i * .24, .05, .05, .16, 8, 0xd8dce2, 3, 0, 0, Math.PI / 2); }
  ek.box(ex, 1.75 + ey, ez - .7, .34, .14, .7, 0xd8dce2, 3).cyl(ex, 1.95 + ey, ez - .7, .16, .16, .16, 16, 0x1a1a1a, 2).cyl(ex, 1.42, ez - .7, .012, .012, .14, 4, 0x111111, 15);
  S.add(new T.Mesh(ek.build(), MAT.uber));
  hk.box(ex, .08, ez, .12, .16, 2.2, 0xd8a020, 15).box(ex, 1.3, ez + 1, .14, 2.5, .14, 0xd8a020, 15).box(ex, 2.5, ez + .1, .12, .12, 1.9, 0xd8a020, 15, -.25).cyl(ex, 1.92, ez - .7, .01, .01, 1.1, 4, 0x111111, 15);
  const hoist = new T.Mesh(hk.build(), MAT.uber); S.add(hoist);
  propSwap('chrome', hoist, 'cw_hoist', [{ x: ex, z: ez + .14, ry: Math.PI / 2 }], S, null, 'chrome');
  L0.circles.push({ x: ex, z: ez - .4, r: 1 });
  // 點唱機（休息區）與街機（2 樓）：替身是 interior_props，http(s) 下換成實體模型
  const JUKE = [{ x: -17.45, z: 23.2, ry: Math.PI / 2 }];
  propSwap('chrome', instancedIn(S, prop('jukebox'), MAT.uber, JUKE), 'jukebox', JUKE);
  B0.push({ x0: -18, x1: -16.9, z0: 22.6, z1: 23.8 });
  const ARC = [-6.6, -5.2, -3.8, -2.4].map(x => ({ x, y: MEZ_Y, z: CD - .5, ry: Math.PI }));
  propSwap('chrome', instancedIn(S, prop('arcade'), MAT.uber, ARC), 'arcade', ARC);
  B1.push({ x0: -7.2, x1: -1.8, z0: CD - 1, z1: CD });
  // 三角旗串（紅白藍）
  const fk = new Kit(), FL = [0xb3201c, 0xeeeeee, 0x1b3a7a];
  for (const z of [5.5, 12]) for (let i = 0, x = -17.5; x < 17.5; x += .5, i++) { const sag = .6 * (1 - ((x / 17.5) ** 2)); fk.add(new T.ConeGeometry(.17, .36, 3), FL[i % 3], 2, tf(x, CW_H - 1 - sag - .18, z, Math.PI, 0, 0, 1, 1, .2)); }
  S.add(new T.Mesh(fk.build(), MAT.uber));
}
// 工位 3 的低底盤展示車（Challenger 液壓起落）、工位 1 頂高機上的客戶車（69-v6 的委託會換掉）
{
  const m = carObject('chall'); m.position.set(CW_DISP.x, .18, CW_DISP.z); m.rotation.y = CW_DISP.yaw; chromeScene.add(m); chrome.low = m;
  const c = carObject('e92', 0x0d3b5c); c.position.set(0, .05, 0); c.rotation.y = BAY1.yaw; chrome.lift1.add(c); chrome.liftCar = c;
}
// 工具推車（工位 2 旁、工位 1 旁）與空壓機（倉庫）：http(s) 下走進來才換成模型，沒有替身
propSwap('chrome', null, 'cw_cart', [{ x: -3.4, z: 4.2, ry: Math.PI / 2 }, { x: -7.2, z: 6.2, ry: -Math.PI / 2 }], chromeScene,
  () => chromeLv[0].boxes.push({ x0: -3.7, x1: -3.1, z0: 3.65, z1: 4.75 }, { x0: -7.5, x1: -6.9, z0: 5.65, z1: 6.75 }), 'chrome');
propSwap('chrome', null, 'cw_air', [{ x: 13.4, z: 32.8, ry: Math.PI }], chromeScene, () => chromeLv[0].boxes.push({ x0: 12.65, x1: 14.15, z0: 32.4, z1: 33.4 }), 'chrome');
// 人：鐵手強尼（工作站）、兩名學徒（工位 1、工位 3）、Rook（拆解區）、休息區的客人、2 樓打街機的人。前三個是 69-v6-customs.js 拔槍事件的店員
{
  const cr = crowd(7); const rc = rng(1717);
  const list = [
    [ANIM.talk, JOHNNY.x, 0, JOHNNY.z, JOHNNY.yaw, { top: lin(0x1b2a4a), bot: lin(0x1b2a4a), skin: SKINS[3], hair: lin(0x1a1410), longHair: 0, coat: 0, skirt: 0, hat: 1, glowI: 0 }],
    [ANIM.cross, -9.2, 0, 3.2, Math.PI / 2, { top: lin(0x2a3a5a), bot: lin(0x2a3a5a), skin: SKINS[1], hair: lin(0x2a1a10), longHair: 0, coat: 0, skirt: 0, hat: 0, glowI: 0 }],
    [ANIM.interact, 13.6, 0, 3.2, -Math.PI / 2, { top: lin(0x3a2a1a), bot: lin(0x22252b), skin: SKINS[2], hair: lin(0x1a1410), longHair: 0, coat: 0, skirt: 0, hat: 1, glowI: 0 }],
    [ANIM.idle, ROOK.x, 0, ROOK.z, ROOK.yaw, { top: lin(0x3a3f4a), bot: lin(0x17181c), skin: SKINS[0], hair: lin(0x5f5a55), longHair: 0, coat: 1, skirt: 0, hat: 0, glowI: 0 }],
    [ANIM.sit, -15.5, -.12, 25.2, Math.PI / 2], [ANIM.talk, -13.6, 0, 24.4, -2.4], [ANIM.interact, -5.2, MEZ_Y, CD - 1.4, Math.PI],
  ];
  list.forEach(([a, x, y, z, yaw, look], i) => { cr.look(i, look || { r: rc, glowI: 0 }); cr.anim(i, a, rc() * 10, 1); cr.place(i, x, y, z, yaw); if (i && i !== 4 && i !== 6) chromeLv[0].circles.push({ x, z, r: .3 }); });
  cr.flush(); chromeScene.add(cr.mesh); chrome.people = cr;
  chrome.staff = list.slice(0, 3).map(([a, x, y, z, yaw], i) => ({ i, name: ['鐵手強尼', '學徒阿凱', '學徒小麥'][i], a, x, z, yaw, x0: x, z0: z, yaw0: yaw, hp: 80, st: 'work', t: 0 }));
}
// 燈：前段的 LED 高天井燈、夾層底下的嵌燈、各工位的重點光；比 NL 多的由 pickLights 挑離相機最近的
const CW_WARM = lin(0xffe2c0), CW_COOL = lin(0xf4f8ff);
{
  const front = [];
  for (const x of [-12, 0, 12]) for (const z of [4, 10, 16]) front.push({ x, y: CW_H - 1.2, z, col: CW_COOL, r: 13, i: 1.6 });
  const under = [];
  for (const x of [-13, -4, 4, 13]) for (const z of [23.5, 30]) under.push({ x, y: MEZ_Y - .5, z, col: CW_WARM, r: 8, i: 1.2 });
  const top = [];
  for (const x of [-13, -4.5, 4, 12]) for (const z of [24, 31]) top.push({ x, y: CW_H - 1, z, col: CW_WARM, r: 9, i: 1.3 });
  chromeLv[0].lights.push(...front, ...under,
    { x: CHROME_CAR.x, y: 4.6, z: CHROME_CAR.z, col: lin(0xfff4e4), r: 9, i: 1.8 }, { x: BAY3.x, y: 3.6, z: BAY3.z, col: lin(0xff6ad8), r: 8, i: 1.1 }, { x: BAY4.x + 1, y: 3.6, z: BAY4.z, col: lin(0xffb060), r: 9, i: 1.4 },
    { x: -12, y: 3.4, z: 11, col: CW_COOL, r: 7, i: 1.2 }, { x: -17, y: 3, z: 26, col: lin(0xff4f9a), r: 6, i: .9 });
  chromeLv[1].lights.push(...top, ...front.filter(l => l.z > 8), { x: -5, y: MEZ_Y + 2.4, z: CD - 1.6, col: lin(0x8a5aff), r: 6, i: 1.1 });
  // 動態燈：展示車的底盤霓虹與大燈（L 鍵關掉主照明時打開），由 updateChrome 每幀改亮度
  chrome.neonL = { x: CHROME_CAR.x, y: .3, z: CHROME_CAR.z, col: lin(0xb04cff), r: 5, i: 0, keep: 1 };
  chrome.headL = { x: CHROME_CAR.x, y: .8, z: CHROME_CAR.z - 3, col: lin(0xfff0d8), r: 14, i: 0, keep: 1, dir: [0, -.08, -1], cos: .82 };
  chromeLv[0].lights.unshift(chrome.neonL, chrome.headL);
}
VENUES.chrome = { scene: chromeScene, data: chromeLv[0], lvs: chromeLv, lv: 0, lvY: 0, spawn: { x: -2.9, z: 7.2, yaw: .35 }, name: 'CHROME WORKS', toast: 'CHROME WORKS 霓虹改車王總廠', dist: district(GAR_X, GAR_Z).split(' ')[0] + ' · 8 St', ceil: CW_H - .6, door: WP(GAR_X, GAR_Z), out: spotW({ x: GAR_X + 6.2, z: GAR_Z + 1.4, yaw: 0 }),
  // 相機天花板：前段挑高到桁架，夾層底下是樓板底
  ceilAt: (x, z) => VENUES.chrome.lv === 0 && z > MEZ_Z - .2 ? MEZ_Y - .5 : CW_H - .8 };
// 換層：碰撞表、燈、地板高度（樓梯走 chromeStairs）
function chromeLevel(k) {
  const V = VENUES.chrome; V.lv = k; V.lvY = k * MEZ_Y; V.data = chromeLv[k];
  if (player.where === 'chrome') { activeBoxes = V.data.boxes; activeCircles = V.data.circles; colDirty(); player.y = V.lvY; }
}
function chromeStairs(up) {
  transition(() => {
    chromeLevel(up ? 1 : 0);
    player.x = STAIR.x; player.z = up ? MEZ_Z + 1 : STAIR.z0 - .6; player.yaw = up ? 0 : Math.PI; player.v = 0; camState.yaw = player.yaw; camState.pitch = .12;
    toast(up ? '2F · 辦公室、街機與私人展示車庫' : '1F · 工位與零件走廊');
  });
}

// ─── 進出：車子開進來時把座駕收起來（像停進車庫一樣移到 9999），在馬力機上擺一台同款同色同改裝的展示車；出去時停回門口、直接坐進去 ───
// 進廠的規則（通緝、警察視野、歇業、偷來的超跑、坦克與直升機）在 69-v6-customs.js 的 v6EnterCheck
const chromePad = () => spotW({ x: GAR_X, z: GAR_Z + SW + 4, yaw: Math.PI });
function chromeCtx(v) {
  if (!v || motors.test || v.dead) return null;
  const p = chromePad();
  if (Math.hypot(v.x - p.x, v.z - p.z) > 6 || Math.hypot(v.vx, v.vz) > 2) return null;
  return v6EnterCheck(v);
}
function chromeShow() {
  if (chrome.show) { chrome.show.removeFromParent(); disposeKit(chrome.show); chrome.show = null; }
  if (!chrome.parked) return;
  const id = kestrel.carId, m = modsOf(id), g = chrome.show = carObject(id, kestrel.paint, 1 + (m.pf || 0));
  g.position.set(CHROME_CAR.x, CARS[id].bike ? 0 : modStats(id).rideY, CHROME_CAR.z); g.rotation.y = CHROME_CAR.yaw; chromeScene.add(g);
  if (!CARS[id].bike) { const pg = modParts(id, m); if (pg) g.add(pg); }
  chromeLv[0].circles.length = chrome.baseN ??= chromeLv[0].circles.length;
  const L = CARS[id].len * .28;
  for (const s of [-1, 1]) chromeLv[0].circles.push({ x: CHROME_CAR.x, z: CHROME_CAR.z + L * s, r: CARS[id].w / 2 + .1, car: 1 });
  if (player.where === 'chrome') colDirty();
}
// 開車進來：自己的車上馬力機；偷來的車（69-v6）上工位 4 的地磅
function chromeEnter(v) {
  exitVehicle();
  chrome.doorT = 1.2;   // 進來之後捲門 B 在 1.2 秒內放下（擋住外面的視線）
  if (v !== kestrel) return v6StolenIn(v);
  chrome.parked = true; v.vx = v.vz = 0; v.g.visible = false; v.x = v.z = 9999; poseVehicle(v);
  chromeLevel(0); chromeShow(); v6PrivBuild();
  enterVenue('chrome', () => { player.x = CHROME_CAR.x - 2.9; player.z = CHROME_CAR.z; v6Greet(); });
}
// 走路進來（門口按 E）：馬力機上是空的；在 2 樓的私人車庫挑一台車，就會開到馬力機上
function chromeWalkIn() {
  chrome.doorT = 0; chromeLevel(0); chromeShow(); v6PrivBuild();
  enterVenue('chrome', () => { player.x = 0; player.z = 1.6; player.yaw = 0; camState.yaw = 0; });
}
function chromeOut() {
  if (chrome.stolen) return v6StolenOut();
  chrome.parked = false;
  const p = chromePad();
  kestrel.g.visible = true; placeCarAt({ x: p.x, z: p.z, yaw: p.yaw + Math.PI });   // 車頭朝街上
}
function chromeLeave() {
  closeDialog(); cwClose();
  const drive = chrome.parked || chrome.stolen;
  const v = chrome.stolen ? chrome.stolen.v : kestrel;
  exitVenue(() => { chromeLevel(0); if (drive) { chromeOut(); enterVehicle(v); camState.yaw = v.yaw; } chromeShow(); });
}
// 每幀：展示車的模型下載、捲門、展示車的燈與霓虹、低底盤車的液壓起落、焊接火花；用別的方式離開改裝廠時把車停回門口
function updateChrome(dt) {
  const t = uTimeNow();
  if (player.where === 'chrome') {
    if (glbWait.length) glbWake(chromeScene);
    if (CW.open) cwCam(dt);
    chrome.doorT = Math.max(0, chrome.doorT - dt);
    const d = chrome.doorB; if (d) { const o = clamp(chrome.doorT / 1.2, 0, 1); d.scale.y = 1 - o * .96; d.position.y = o * (DOOR_H - .2); }
    // 低底盤展示車：每 6 秒前輪液壓頂起來一次
    if (chrome.low) { const u = (t % 6) / 6, up = u < .5 ? Math.sin(u * Math.PI * 2) : 0; chrome.low.position.y = .18 + Math.max(0, up) * .35; chrome.low.rotation.x = -Math.max(0, up) * .12; }
    // 焊接機械臂：一閃一閃的焊花（室內沒有粒子系統，用一盞閃爍的藍白燈和一顆發光的點）
    const L0 = chromeLv[0];
    if (!chrome.weldL) { chrome.weldL = { ...chrome.weld, col: lin(0xa8d0ff), r: 5, i: 0, keep: 1 }; L0.lights.push(chrome.weldL); }
    chrome.weldL.i = (Math.sin(t * 37) > .3 && Math.sin(t * .9) > -.2) ? 1.6 + Math.random() * 1.2 : 0;
    const S = chrome.parked && kestrel.carId;
    const nc = S && kestrel.neon, beat = kestrel.neonBeat ? .45 + .55 * Math.abs(Math.sin(sfx.beat() * Math.PI)) : 1;
    chrome.neonL.i = nc ? (chrome.dim ? 2.4 : 1.4) * beat : 0; if (nc) chrome.neonL.col = nc;
    chrome.headL.i = S && chrome.dim ? 3 : 0; if (S) chrome.headL.col = kestrel.headCol || HEAD_COL;
    v6ShopStep(dt);
    return;
  }
  if (CW.open) cwClose();
  if ((chrome.parked || chrome.stolen) && !fading) { chromeOut(); chromeShow(); }
  if (VENUES.chrome.lv && !fading) chromeLevel(0);
}

// ─── 改裝面板（仿 GTA V 洛聖都改車王的版面）：左上角的招牌、類別列與 n/N、清單（選到的那列反白）、說明、四條分段的性能條 ───
// 面板開著時鏡頭依類別滑到特寫錨點（0.45 秒），角色藏起來；↑↓ 移動、Enter／E 選、Esc／Backspace 返回，滑鼠與觸控點清單。
// 即時展示（第五節第 2 點）：按住 W 或空白鍵原地轟油門（車身晃、回火、洩壓閥）、H 試喇叭、L 關掉廠房主照明看大燈與底盤霓虹、O 車門（模型沒有可動車門，只提示）
const WHO_CW = '鐵手強尼 · CHROME WORKS';
const CAT_DESC = {
  fix: '先修好車才能改裝：凹痕、碎車窗、鬆脫的鈑金件、爆胎與撞歪的輪軸。',
  arm: '軍規複合裝甲：提高車體最大耐久度，撞歪輪軸的機率少四分之三。',
  brk: '升級卡鉗與碟盤，每一級煞車減速度 +12%。',
  bmp: '前下巴只是好看；防撞鋼架與尖刺鏟正面撞車時會把對方往上鏟起來。',
  eng: '升級引擎管理系統（EMS），每一級加速 +8%，極速最多 +5%。',
  exh: '換排氣管改變引擎聲；直通管放油門時會噴出藍色回火。喇叭在店裡按 H 試、開車時按 H 按喇叭。',
  spl: '尾翼的下壓力讓側向抓地力係數增加（鴨尾 +0.03、GT 尾翼 +0.06）。',
  tur: '賽道雙渦輪：加速 ×1.22，鬆油門時洩壓閥「啾——」一聲。',
  trn: '縮短換檔延遲（原廠 0.35 秒到序列式 0.08 秒），倒車起步也比較快。',
  sus: '降低車身與重心，比較不容易翻車；液壓系統開車時按 X 升降與彈跳（特殊能力改用 Caps Lock）。',
  paint: '換顏色、烤漆材質或車牌。通緝中只要警察沒看到，噴漆或換牌就能甩掉通緝。',
  whl: '防彈輪胎打不破也不怕釘刺帶；燒胎煙換成霓虹色。',
  lgt: '大燈顏色與底盤霓虹（恆亮或隨重低音閃爍）。按 L 關掉廠房的燈看效果。',
  sec: '追蹤器、全額保險（車價 10%，毀損後打給磐石互保付 1.5% 自付額）與炸彈陷阱。裝了炸彈就不能再改其他東西。',
  leave: '開著這台車回到街上。',
};
const CW = { open: false, path: [], sel: 0, rows: [], a: 0, top: 0, cam: null, camT: null, typing: false, T: null };
// 性能條的範圍（整間車行從最慢到改滿的最快）
const CW_BARS = [['最高速度', 'kmh', 120, 300], ['加速', 'eng', 8, 34], ['煞車', 'brk', 12, 27], ['抓地力', 'grip', 6.5, 13.6]];
{
  const el = document.createElement('div'); el.id = 'cw'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'CHROME WORKS 改裝');
  el.innerHTML = '<div id="cwHead"><b>CHROME WORKS</b><small>霓虹改車王總廠 · 24H</small></div><div id="cwBar"><span id="cwTitle">類別</span><span id="cwN">1/1</span></div>'
    + '<div id="cwList" role="listbox"></div><div id="cwMore" aria-hidden="true"></div><p id="cwDesc"></p><div id="cwPlate"><input id="cwPlateIn" maxlength="8" spellcheck="false" autocomplete="off" aria-label="自訂車牌"><small>英文字母與數字，最多 8 個 · Enter 確定、Esc 取消</small></div><div id="cwStats">'
    + CW_BARS.map(([n], i) => `<div class="cwS"><span>${n}</span><span class="cwB" id="cwB${i}"><em></em><u></u><i></i></span></div>`).join('') + '<small id="cwNote"></small></div>';
  const keys = document.createElement('div'); keys.id = 'cwKeys';
  keys.innerHTML = '<span><kbd>↑</kbd><kbd>↓</kbd> 移動</span><span><kbd>A</kbd><kbd>D</kbd> 鏡頭</span><span><kbd>W</kbd> 轟油門</span><span><kbd>H</kbd> 喇叭</span><span><kbd>L</kbd> 燈光</span><button id="cwOk"><kbd>Enter</kbd> 選擇</button><button id="cwBack"><kbd>Esc</kbd> 返回</button>';
  $('hud').append(el, keys);
  $('cwBack').addEventListener('click', () => { sfx.click(); cwBack(); });
  $('cwOk').addEventListener('click', () => { sfx.click(); cwPick(); });
  const inp = $('cwPlateIn');
  inp.addEventListener('input', () => { const v = inp.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8); if (v !== inp.value) inp.value = v; });
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); cwPlateDone(true); } else if (e.key === 'Escape') { e.preventDefault(); cwPlateDone(false); } });
}
const PAINTS = id => [[CARS[id].paint, '原廠色'], ...LIVERIES.filter(l => l[0] !== CARS[id].paint), [0x6a2a8a, '珠光紫'], [0x1a6a6a, '珠光青'], [0xe8782a, '日落橘'], [0xf2f0ea, '冰川白']];
const paintOk = id => !(CARS[id].glb && !CARS[id].paintable);
const PAINT_PRICE = 500, PLATE_RANDOM = 500, PLATE_CUSTOM = 1500;
// 面板的對象：自己的座駕，或 69-v6-customs.js 的客戶委託車（T.job：價錢由客戶付、清單在 job.m）
function cwTarget() {
  if (CW.T) return CW.T;
  const id = kestrel.carId;
  return { id, own: true, m: modsOf(id), paint: kestrel.paint, setM(m) { if (Object.keys(m).length) motors.mods[id] = m; else delete motors.mods[id]; this.m = m; }, setPaint(c) { applyCar(kestrel, id, c); poseVehicle(kestrel); motors.paint[id] = c; this.paint = c; }, apply() { modApply(kestrel); chromeShow(); }, hp: kestrel };
}
// ─── 動態車損維修估價（第三節）：C = 車款基準費 ×(1 − HP/HPmax) + 35·破窗 + 80·鈑金件 + 60·爆胎 + 150·歪軸 ───
// 基準費：轎跑 $300、肌肉車 $550、超跑 $1,200（照 25-cars.js 的級距）；破窗：碎過車窗算整台 6 片；鈑金件：照受損程度 0–6 件；
// 歪軸：69-v6-customs.js 的撞擊判定（v.axle，0–2）。老闆 Kael 買下車廠後免費（v6Free）
const REPAIR_BASE = { sedan: 300, muscle: 550, super: 1200, police: 550, bike: 300, heavy: 550 };
function repairParts(v) {
  const k = v.hpMax ? 1 - clamp(v.hp / v.hpMax, 0, 1) : 0;
  return { k, glass: v.glass && v.isCar !== false ? 6 : 0, doors: v.isCar === false ? 0 : clamp(Math.floor(k * 7.5) - 1, 0, 6), tires: v.tires ? v.tires.filter(t => t.flat).length : 0, axle: v.axle || 0 };
}
function repairCost(v, id = v.carId) {
  const P = repairParts(v);
  if (P.k < .005 && !P.glass && !P.tires && !P.axle) return 0;
  if (v6Free() || v.job) return 0;   // v.job：客戶委託車（客戶付）
  return Math.max(1, Math.round((REPAIR_BASE[carClass(id)] || 300) * P.k + 35 * P.glass + 80 * P.doors + 60 * P.tires + 150 * P.axle));
}
const needFix = v => { const P = repairParts(v); return P.k >= .005 || P.glass || P.tires || P.axle; };
// 每一級的效果說明（和 MOD_FX 對應）
function modFxText(k, n, id) {
  if (!n) return '原廠規格。';
  const S0 = modStats(id, {}), S1 = modStats(id, { [k]: n }), pct = (a, b, w) => Math.abs(b / a - 1) > .001 ? `${w} ${b > a ? '+' : ''}${Math.round((b / a - 1) * 1000) / 10}%` : '';
  if (k === 'arm') return `車體最大耐久 ${S0.hp} → ${S1.hp}（+${Math.round((S1.hpK - 1) * 100)}%），撞歪輪軸的機率 −75%`;
  if (k === 'tir') return '輪胎打不破，也不怕警察的道路釘刺帶。';
  if (k === 'trn') return `換檔延遲 0.35 → ${S1.shift.toFixed(2)} 秒 · ${pct(S0.eng, S1.eng, '加速')} · 倒車起步 +${Math.round((S1.rev - 1) * 100)}%`;
  if (k === 'spl') return `側向抓地力 μ +${MOD_FX.spl.mu[n].toFixed(2)}`;
  if (k === 'sus') return n === 5 ? '開車時按 X 升降車身、按住 X 放開彈跳 1.2 m、按住 X 加 W／A／S／D 單輪起伏。' : `車身下降 ${Math.round(-MOD_FX.sus.rideY[n] * 100)} cm · 重心 −${Math.round((1 - MOD_FX.sus.cog[n]) * 100)}% · ${pct(S0.grip, S1.grip, '抓地')}`;
  if (k === 'bmp') return n === 1 ? '碳纖維前下巴（外觀）。' : `正面撞車時把對方往上鏟 3.5 m/s${n === 3 ? '，尖刺把對方的前輪扎破' : ''}。`;
  if (k === 'exh') return ['', '鈦合金雙出：音色比較亮，偶爾回火。', '側排管：更大聲，常常回火。', '直通管：最大聲，放油門與換檔時幾乎都會噴出雙股藍色回火（點得著地上的汽油）。'][n];
  if (k === 'tur') return `加速 ×1.22 · 鬆油門有洩壓閥的口哨聲`;
  if (k === 'hn' || k === 'smk' || k === 'hl' || k === 'ng' || k === 'nm') return `${GRP[k].lv[n][0]}（外觀與聲音）。`;
  if (k === 'pf') return ['', '金屬漆：細細的金屬顆粒，反光比較銳利。', '消光漆：沒有清漆的霧面。', '珠光漆：斜看會泛出另一種顏色。', '電鍍鏡面：整台車像一面鏡子。'][n];
  if (k === 'bomb') return n === 1 ? '下一個發動這台車引擎的人（不是你）：嗶嗶嗶 0.5 秒後整台車引爆。停好車走遠一點，偷車賊會上鉤。' : '打開手機 → 聯絡人 → 鐵手強尼 → 引爆車載炸彈，隨時引爆。';
  return [pct(S0.eng, S1.eng, '加速'), pct(S0.kmh, S1.kmh, '極速'), pct(S0.brk, S1.brk, '煞車'), pct(S0.grip, S1.grip, '抓地')].filter(Boolean).join(' · ');
}
// 價錢：委託車由客戶付（0）、老闆 Kael 全免（v6Free）
const cwPrice = p => CW.T && CW.T.job || v6Free() ? 0 : p;
const cwMoney = p => cwPrice(p) ? money(cwPrice(p)) : '免費';
// 目前這一層的清單：{ key, name, val, own, poor, off }
function cwRows() {
  const T = cwTarget(), id = T.id, m = T.m, cash = motors.cash, [ck, gk] = CW.path;
  const v = T.hp, fixing = needFix(v), bombed = !!m.bomb && !T.job;
  if (!ck) {
    const rows = [];
    if (fixing) { const rc = repairCost(v, id); rows.push({ key: 'fix', name: '修復載具', val: rc ? money(rc) : '免費', poor: cash < rc }); }
    for (const c of CATS) {
      const gs = c.g.filter(g => modCan(id, g.k) && !(g.paint && !paintOk(id)));
      if (!gs.length) continue;
      const g = gs[0], cur = g.lv ? g.lv[m[g.k] || 0][0] : '';
      rows.push({ key: c.k, name: c.name, val: c.g.length > 1 ? '' : cur, off: (fixing && !T.job) || (bombed && c.k !== 'sec') });
    }
    if (!T.job) rows.push({ key: 'leave', name: '開車離開', val: '' });
    else rows.push({ key: 'done', name: '完成改裝、交車', val: '' });
    return rows;
  }
  const cat = CATS.find(c => c.k === ck);
  if (!gk && cat.g.length > 1) return cat.g.filter(g => modCan(id, g.k)).map(g => ({ key: g.k, name: g.name, val: g.lv ? g.lv[m[g.k] || 0][0] : g.k === 'pl' ? plateOf(id, m) : g.k === 'pc' ? (PAINTS(id).find(o => o[0] === T.paint) || [0, '自訂'])[1] : g.k === 'trk' ? (T.own ? '已登記' : '') : g.k === 'ins' ? (m.ins ? '已投保' : '') : '' }));
  const g = GRP[gk || cat.g[0].k];
  if (g.paint) return PAINTS(id).map(([c, name]) => ({ key: c, name, val: c === T.paint ? '✓' : cwMoney(PAINT_PRICE), own: c === T.paint, poor: c !== T.paint && cash < cwPrice(PAINT_PRICE) }));
  if (g.plate) return [{ key: 'rnd', name: '隨機新車牌', val: cwMoney(PLATE_RANDOM), poor: cash < cwPrice(PLATE_RANDOM) }, { key: 'custom', name: '自訂車牌…', val: cwMoney(PLATE_CUSTOM), poor: cash < cwPrice(PLATE_CUSTOM) }];
  if (g.k === 'trk') return [{ key: 'trk', name: T.own ? '已登記為你的私人載具' : '安裝衛星追蹤器', val: T.own ? '✓' : money(2000), own: T.own, off: T.own }];
  if (g.k === 'ins') { const p = insPrice(id); return [{ key: 'ins', name: m.ins ? '已投保磐石互保全額險' : `投保全額險（車價 10%）`, val: m.ins ? '✓' : cwMoney(p), own: !!m.ins, poor: !m.ins && cash < cwPrice(p) }]; }
  const cur = m[g.k] || 0;
  return g.lv.map(([name, price], n) => ({ key: n, name, val: n === cur ? '✓' : n ? cwMoney(price) : '免費', own: n === cur, poor: n !== cur && n > 0 && cash < cwPrice(price), off: g.k === 'sus' && n === 5 && CARS[id].bike }));
}
const insPrice = id => Math.round((CARS[id].price || 50000) * .1 / 50) * 50;
function cwRender() {
  const T = cwTarget(), id = T.id, rows = CW.rows = cwRows(), [ck, gk] = CW.path;
  CW.sel = clamp(CW.sel, 0, rows.length - 1);
  const r = rows[CW.sel];
  const cat = ck && CATS.find(c => c.k === ck), g = gk ? GRP[gk] : cat && cat.g.length === 1 ? cat.g[0] : null;
  $('cwTitle').textContent = g ? g.name : cat ? cat.name : T.job ? `客戶委託 · ${T.job.who}` : '類別';
  $('cwN').textContent = `${CW.sel + 1} / ${rows.length}`;
  const list = $('cwList'); list.innerHTML = '';
  rows.forEach((o, i) => {
    const b = document.createElement('button');
    b.className = (i === CW.sel ? 'sel' : '') + (o.poor ? ' poor' : '') + (o.off ? ' off' : '');
    b.setAttribute('role', 'option'); b.setAttribute('aria-selected', i === CW.sel);
    b.innerHTML = '<span></span><span class="v"></span>'; b.firstChild.textContent = o.name; b.lastChild.textContent = o.val;
    b.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse' && CW.sel !== i) { CW.sel = i; cwRender(); } });
    b.addEventListener('click', () => { sfx.click(); CW.sel = i; cwPick(); });
    list.append(b);
  });
  const sb = list.children[CW.sel]; if (sb) sb.scrollIntoView({ block: 'nearest' });
  $('cwMore').classList.toggle('on', list.scrollHeight > list.clientHeight + 2);
  // 說明與預覽：在某一級上，就預覽那一級的性能（多出來的是青色，少掉的是紅色）
  let desc = '', m1 = null;
  if (!ck) { desc = CAT_DESC[r.key] || ''; if (r.off && r.key !== 'fix') desc = needFix(T.hp) && !T.job ? '先修復載具，才能改裝。' : '車上裝了炸彈：引爆或拆掉之前不能改其他東西。'; }
  else if (!g) desc = CAT_DESC[ck] || '';
  else if (g.paint) desc = '換一個顏色（照目前的烤漆材質重新噴）。';
  else if (g.plate) desc = `目前車牌 ${plateOf(id, T.m)}。換牌和噴漆一樣能甩掉通緝。`;
  else if (g.lv) { desc = modFxText(g.k, r.key, id) + (r.poor ? `\n現金不夠（還差 ${money(cwPrice(g.lv[r.key][1]) - motors.cash)}）` : ''); m1 = { ...T.m, [g.k]: r.key }; }
  if (!ck && r.key === 'fix') { const P = repairParts(T.hp); desc += `\n車況 ${Math.round((1 - P.k) * 100)}% · 破窗 ${P.glass} · 鈑金 ${P.doors} · 爆胎 ${P.tires} · 歪軸 ${P.axle}`; }
  if (T.job && !ck) desc = v6JobText() + (desc ? '\n' + desc : '');
  $('cwDesc').textContent = desc;
  const S0 = modStats(id, T.m), S1 = m1 ? modStats(id, m1) : S0;
  CW_BARS.forEach(([, k, lo, hi], i) => {
    const a = clamp((S0[k] - lo) / (hi - lo), .02, 1) * 100, b = clamp((S1[k] - lo) / (hi - lo), .02, 1) * 100, el = $('cwB' + i);
    el.children[0].style.width = Math.max(a, b) + '%'; el.children[1].style.left = b + '%'; el.children[1].style.width = Math.max(0, a - b) + '%'; el.children[2].style.width = Math.min(a, b) + '%';
  });
  const P = repairParts(T.hp), dyno = S1.ps ? ` · 馬力機 ${Math.round(S1.ps * (.9 + .1 * chrome.rev))} PS` : '';
  $('cwNote').textContent = `${CARS[id].name} · ${plateOf(id, T.m)} · 極速 ${Math.round(S1.kmh)} km/h · 耐久 ${S1.hp}${S1.bp ? ' · 防彈胎' : ''} · 車況 ${Math.round((1 - P.k) * 100)}%${dyno}`;
  // 鏡頭錨點：停在哪一類就看哪裡
  CW.cam = (cat || (!ck && CATS.find(c => c.k === r.key)) || {}).cam || 'orbit';
}
function cwOpen(T = null) {
  if (CW.open) return;
  CW.T = T;
  CW.open = true; CW.path = []; CW.sel = 0; CW.a = 2.3; CW.camP = null;
  dlg.open = true; document.body.classList.add('talking', 'cwOn');   // dlg.open：走路與互動提示照對話框的規則停下來
  if (document.pointerLockElement) document.exitPointerLock();
  me.mesh.visible = false;
  $('cw').classList.add('on'); $('cwKeys').classList.add('on');
  if (!T) sfx.engineOn(kestrel);
  cwRender();
}
function cwClose() {
  if (!CW.open) return;
  if (CW.typing) cwPlateDone(false);
  CW.open = false; dlg.open = false; document.body.classList.remove('talking', 'cwOn');
  $('cw').classList.remove('on'); $('cwKeys').classList.remove('on');
  camState.over = null; camState.snap = true; me.mesh.visible = true;
  if (chrome.dim) cwDim(false);
  if (!CW.T) sfx.engineOff();
  CW.T = null; chrome.rev = 0;
}
function cwBack() {
  if (CW.typing) return cwPlateDone(false);
  if (!CW.path.length) return cwClose();
  const last = CW.path.pop();
  CW.rows = cwRows(); CW.sel = Math.max(0, CW.rows.findIndex(r => r.key === last)); cwRender();
}
function cwPick() {
  const r = CW.rows[CW.sel]; if (!r || CW.typing) return;
  const T = cwTarget(), [ck, gk] = CW.path;
  if (!ck) {
    if (r.key === 'fix') return chromeRepair(T);
    if (r.key === 'leave') { cwClose(); return chromeLeave(); }
    if (r.key === 'done') { cwClose(); return v6JobDone(); }
    if (r.off) { toast(needFix(T.hp) && !T.job ? '先修復載具才能改裝' : '炸彈還在車上'); return; }
    CW.path = [r.key]; CW.rows = cwRows(); CW.sel = Math.max(0, CW.rows.findIndex(o => o.own)); return cwRender();
  }
  const cat = CATS.find(c => c.k === ck);
  if (!gk && cat.g.length > 1) { CW.path = [ck, r.key]; CW.rows = cwRows(); CW.sel = Math.max(0, CW.rows.findIndex(o => o.own)); return cwRender(); }
  const g = GRP[gk || cat.g[0].k];
  if (r.off) return toast('這一項裝不上這台車');
  if (g.paint) return cwPaint(r);
  if (g.plate) return r.key === 'custom' ? cwPlateAsk() : cwPlate(null);
  if (g.k === 'trk') return toast('這台已經登記在你名下了');
  if (g.k === 'ins') return cwInsure();
  modBuy(g.k, r.key);
}
// 付錢：不夠就提示；委託與老闆免費。通緝中（警察沒看到）噴漆或換牌就消星（第二節第 1 點、第四節第 10 項）
function cwPay(p, what) {
  const n = cwPrice(p);
  if (motors.cash < n) { toast(`錢不夠：${what} 要 ${money(n)}`); cwRender(); return false; }
  motors.cash -= n; return true;
}
function cwDisguise() {
  if (CW.T || !W.stars) return;
  if (W.seen) { toast('警察還盯著這台車'); return; }
  wantedClear('respray'); W.lastVeh = null;
  toast('已完成全新烤漆，NCPD 通緝星數已全數消除！');
}
function cwPaint(r) {
  const T = cwTarget();
  if (r.own) return;
  if (!cwPay(PAINT_PRICE, '噴漆')) return;
  T.setPaint(r.key); saveMotors(); T.apply && T.apply();
  sfx.spray(); toast(`烤漆：${r.name}`); cwDisguise(); cwRender();
}
function cwPlate(txt) {
  const T = cwTarget(), p = txt == null ? PLATE_RANDOM : PLATE_CUSTOM;
  if (!cwPay(p, '換車牌')) return;
  const A = 'ABCDEFGHJKLMNPRSTUVWXYZ', pl = txt || A[Math.random() * 23 | 0] + A[Math.random() * 23 | 0] + A[Math.random() * 23 | 0] + String(1000 + Math.random() * 9000 | 0);
  T.setM({ ...T.m, pl }); saveMotors(); T.apply && T.apply();
  sfx.reload(); toast(`新車牌：${pl}`); cwDisguise(); cwRender();
}
function cwPlateAsk() {
  if (motors.cash < cwPrice(PLATE_CUSTOM)) { toast(`錢不夠：自訂車牌要 ${money(cwPrice(PLATE_CUSTOM))}`); return; }
  CW.typing = true; $('cwPlate').classList.add('on');
  const inp = $('cwPlateIn'); inp.value = ''; inp.focus();
}
function cwPlateDone(ok) {
  if (!CW.typing) return;
  CW.typing = false; $('cwPlate').classList.remove('on');
  const inp = $('cwPlateIn'), v = inp.value; inp.blur();
  if (ok && PLATE_RE.test(v)) cwPlate(v); else if (ok) toast('車牌要 1–8 個英文字母或數字');
}
function cwInsure() {
  const T = cwTarget(), p = insPrice(T.id);
  if (T.m.ins) return;
  if (!cwPay(p, '全額保險')) return;
  T.setM({ ...T.m, ins: 1 }); saveMotors(); sfx.pickup();
  toast(`磐石互保：${CARS[T.id].name} 已投保全額險（自付額 ${money(Math.round((CARS[T.id].price || 50000) * .015))}）`); cwRender();
}
function modBuy(k, n) {
  const T = cwTarget(), cur = T.m[k] || 0, price = GRP[k].lv[n][1];
  if (n === cur) return cwRender();
  if (n && !cwPay(price, GRP[k].lv[n][0])) return;
  const m = { ...T.m }; if (n) m[k] = n; else delete m[k];
  T.setM(m); saveMotors(); T.apply && T.apply();
  if (k === 'arm' || k === 'tir' || k === 'bmp') sfx.reload(); else if (k === 'bomb') sfx.beep(); else sfx.pickup();
  toast(n ? `已成功安裝【${GRP[k].lv[n][0]}】${cwPrice(price) ? `（${money(cwPrice(price))}）` : ''}` : `${GRP[k].name}換回原廠`);
  if (n && ((k === 'eng' && n === 4) || k === 'tur') && !T.job) dialog(WHO_CW, '「老兄，如果這台車是個女人，我一定狠狠親她一口！」', [{ t: '繼續改', fn: () => { closeDialog(); dlg.open = true; } }]);
  if (k === 'bomb' && n) { CW.path = []; CW.sel = 0; }
  cwRender();
}
// 修車：瞬間修復（凹痕、碎玻璃、黑煙、輪胎、歪軸），車身的泥巴與血跡一起洗掉
function chromeRepair(T) {
  const v = T.hp, cost = repairCost(v, T.id);
  if (motors.cash < cost) { toast('錢不夠修車'); return CW.open && cwRender(); }
  motors.cash -= cost; saveMotors();
  if (v.job) { v.hp = v.hpMax; v.glass = 0; v.axle = 0; }   // 委託車只是一份車況紀錄（69-v6-customs.js），不是載具
  else { wreckFix(v); v.axle = 0; v.dirt = v.blood = 0; v.bloodRep = false; if (v.grime) carGrime(v); modApply(v); }   // wreckFix 把破胎前的極速與抓地還原；再疊一次改裝
  sfx.reload(); sfx.spray(); toast(cost ? `載具已完全修復並完成鏡面拋光！ · ${money(cost)}` : '載具已完全修復並完成鏡面拋光！（老闆免費）');
  if (CW.open) { CW.sel = 0; cwRender(); }
}
// 按鍵（99-main.js 的 onKey 最先問）：面板開著就吃掉所有按鍵
function cwKey(code) {
  if (!CW.open) return false;
  if (CW.typing) return true;
  const n = CW.rows.length;
  if (code === 'ArrowUp') { CW.sel = (CW.sel - 1 + n) % n; sfx.click(); cwRender(); }
  else if (code === 'ArrowDown') { CW.sel = (CW.sel + 1) % n; sfx.click(); cwRender(); }
  else if (code === 'Enter' || code === 'NumpadEnter' || code === 'KeyE') { sfx.click(); cwPick(); }
  else if (code === 'Escape' || code === 'Backspace') { sfx.click(); cwBack(); }
  else if (code === 'KeyH' && !CW.T) sfx.hornT(cwTarget().m.hn || 0);
  else if (code === 'KeyL') cwDim(!chrome.dim);
  else if (code === 'KeyO') toast('這台車的模型沒有可以打開的車門');
  return true;
}
// L：廠房主照明調暗 60%（環境光也一起），只留展示車的大燈與底盤霓虹
function cwDim(on) {
  chrome.dim = on;
  const e = ENV.chrome, k = on ? .4 : 1;
  U.uAmbTop.value.set(e.top).multiplyScalar(k); U.uAmbBot.value.set(e.bot).multiplyScalar(k);
  toast(on ? '主照明調暗 · 看看大燈與底盤霓虹' : '主照明打開');
}
// 鏡頭錨點（第五節第 1 點，車身座標：+z 車頭、+x 車身右側）：0.45 秒滑過去；環繞全景距離 4.8 m、仰角 20°、每秒轉 0.15 rad（A／D 手動轉）
const CW_ANCH = {
  rear: [[-1.2, .5, -3.2], [0, .4, -1]], wheel: [[-2.2, .4, 1.4], [-.7, .35, 1.2]], engine: [[-.8, 1.5, 2.5], [0, .7, .9]],
  front: [[1.3, .55, 3.4], [0, .4, 1.6]], wing: [[-1.6, 1.7, -3.6], [0, 1, -1.6]],
};
function cwCam(dt) {
  const T = cwTarget();
  // 轟油門：按住 W 或空白鍵，轉速拉到紅線；放開的瞬間回火（排氣管）與洩壓閥（渦輪）
  const rev = !CW.typing && (keys.KeyW || keys.Space) && !T.job, m = T.m;
  if (rev && !chrome.revOn) chrome.revOn = true;
  else if (!rev && chrome.revOn) { chrome.revOn = false; if (chrome.rev > .5) v6RevRelease(m); }
  chrome.rev = damp(chrome.rev, rev ? 1 : .15, rev ? 5 : 3, dt);
  const car = T.job ? chrome.jobShow : chrome.show, base = T.job ? BAY1 : CHROME_CAR;
  if (car) { car.rotation.z = Math.sin(uTimeNow() * 34) * .012 * Math.max(0, chrome.rev - .2); }
  const cy = base === BAY1 ? (chrome.lift1 ? chrome.lift1.position.y : 0) : 0;
  const yaw = base.yaw ?? Math.PI, fx = Math.sin(yaw), fz = Math.cos(yaw), rx = -fz, rz = fx;
  const loc = (l) => [base.x + rx * l[0] + fx * l[2], cy + l[1], base.z + rz * l[0] + fz * l[2]];
  let P, Q;
  const an = CW_ANCH[CW.cam];
  if (an) { P = loc(an[0]); Q = loc(an[1]); }
  else {
    CW.a += ((keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0)) * 1.4 * dt + .15 * dt;
    const R = 4.8, el = .35, ox = Math.sin(CW.a) * R * Math.cos(el), oz = Math.cos(CW.a) * R * Math.cos(el), k = innerWidth > 760 ? 1.5 : 0;   // 窄螢幕的面板蓋住上半，車放中間
    P = [base.x + ox, cy + .5 + R * Math.sin(el), base.z + oz];
    const dx = -ox / R, dz = -oz / R;
    Q = [base.x + dz * k, cy + .45, base.z - dx * k];
  }
  if (!CW.camP) { CW.camP = P.slice(); CW.camQ = Q.slice(); }
  for (let i = 0; i < 3; i++) { CW.camP[i] = damp(CW.camP[i], P[i], 9, dt); CW.camQ[i] = damp(CW.camQ[i], Q[i], 9, dt); }
  camState.over = [...CW.camP, ...CW.camQ];
}
// 跟強尼說話：開場依車況說話；修車、原廠數字、打開面板
function talkJohnny() {
  const id = kestrel.carId, opts = [];
  if (chrome.parked) {
    opts.push({ t: '這台車的原廠數字？', fn: () => { const r = CARS[id].real; dialog(WHO_CW, r ? `${CARS[id].name}：${r.ps} 匹、車重 ${r.kg.toLocaleString('en-US')} kg、0–100 ${r.t100} 秒、極速 ${r.top} km/h、${{ R: '前置後驅', M: '中後置後驅', F: '前置前驅', A: '四輪驅動', B: '機車' }[r.dt]}。` : '這台沒有原廠資料。', [{ t: '好', fn: talkJohnny }]); } });
    if (needFix(kestrel)) opts.push({ t: `修車（${money(repairCost(kestrel))}）`, fn: () => { closeDialog(); chromeRepair(cwTarget()); } });
    opts.push({ t: '打開改裝面板', fn: () => { closeDialog(); cwOpen(); } });
  }
  opts.push(...v6JohnnyOpts());
  opts.push({ t: '先這樣', fn: closeDialog });
  dialog(WHO_CW, chrome.parked ? v6GreetText(kestrel) : '「走路來的？車開進來我才能動手。樓上的私人車庫有你的車，挑一台我幫你開到馬力機上。」', opts);
}
ctxHooks.push((p, near) => {
  if (p.where !== 'chrome' || p.mode !== 'walk') return null;
  const lv = VENUES.chrome.lv;
  if (lv === 1) {
    if (near(STAIR.x, MEZ_Z + 1, 1.4)) return { key: 'E', text: '下樓 <i>· 1F 工位</i>', fn: () => chromeStairs(false) };
    return v6Upstairs(p, near);
  }
  if (near(STAIR.x, STAIR.z0 - .4, 1.4)) return { key: 'E', text: '上樓 <i>· 2F 辦公室與私人車庫</i>', fn: () => chromeStairs(true) };
  if (near(0, .9, 2.2)) return chrome.parked || chrome.stolen ? { key: 'E', text: `開車離開 <i>· ${chrome.stolen ? chrome.stolen.v.name : kestrel.name}</i>`, fn: chromeLeave } : { key: 'E', text: '走出去', fn: chromeLeave };
  if (near(JOHNNY.x, JOHNNY.z - 2, 1.6)) return { key: 'E', text: '跟鐵手強尼說話', fn: talkJohnny };
  if (chrome.parked && near(CHROME_CAR.x, CHROME_CAR.z, 3.8)) return { key: 'E', text: `改裝 <i>· ${kestrel.name}</i>`, fn: () => cwOpen() };
  return v6Downstairs(p, near);
});
