
// ═══ 日夜循環與隨機天氣 ═══
// 時鐘每 2.5 秒走一遊戲分鐘（一天是真實的 60 分鐘），90-hud.js 推進、顯示。太陽依時間由東經南往西走，
// 天空、霧、環境光、日光、曝光、泛光門檻、路燈與窗燈都由時間與天氣算出來（atmApply，只在戶外寫進 uniform；室內的 ENV 把日光歸零）。
// 天氣在 WX 的幾種狀態之間隨機轉換（WX_NEXT 是下一個狀態的權重），雨量、雲量、霧慢慢過渡；雨停後路面慢慢變乾，雷雨才打雷。
const clockSt = { min: 2 * 60 + 14, acc: 0 };
const DEG = Math.PI / 180;
const WX = {
  clear: { n: '晴', rain: 0, cloud: .06, fog: 0 },
  cloudy: { n: '多雲', rain: 0, cloud: .48, fog: .05 },
  overcast: { n: '陰', rain: 0, cloud: .9, fog: .12 },
  drizzle: { n: '小雨', rain: .3, cloud: .93, fog: .15 },
  rain: { n: '雨', rain: .62, cloud: .97, fog: .15 },
  storm: { n: '雷雨', rain: 1, cloud: 1, fog: .2, thunder: true },
  fog: { n: '濃霧', rain: 0, cloud: .7, fog: 1 },
};
const WX_NEXT = {
  clear: { clear: 2, cloudy: 4, fog: 1 }, cloudy: { clear: 3, cloudy: 1, overcast: 3 }, overcast: { cloudy: 3, drizzle: 3, rain: 2, fog: 1 },
  drizzle: { overcast: 3, rain: 3, drizzle: 1 }, rain: { drizzle: 3, storm: 2, overcast: 2 }, storm: { rain: 3, drizzle: 1 }, fog: { cloudy: 2, overcast: 2, clear: 1 },
};
// 開場是凌晨兩點的雨夜；left 是這個天氣還剩幾遊戲分鐘
const wx = { cur: 'rain', left: 150, rain: .62, cloud: .97, fog: .15, wet: 1, next: 20 + Math.random() * 25, flash: [], force: false, umb: true, bolts: 0 };
function wxPick(from) {
  const h = clockSt.min / 60, w = { ...WX_NEXT[from] };
  if (h > 3.5 && h < 8.5 && w.fog) w.fog *= 3;   // 清晨容易起霧
  let s = Object.values(w).reduce((a, b) => a + b, 0) * Math.random();
  for (const [k, v] of Object.entries(w)) if ((s -= v) <= 0) return k;
  return from;
}
// 天氣直接換掉；snap 為真時數值不過渡（測試與讀檔用）
function setWeather(id, snap) {
  if (!WX[id]) return;
  wx.cur = id; wx.left = 70 + Math.random() * 150;
  if (snap) { const W = WX[id]; wx.rain = W.rain; wx.cloud = W.cloud; wx.fog = W.fog; wx.wet = W.rain > 0 ? 1 : 0; }
}

// 太陽方向：緯度 35°、接近春分，12:15 在正南（+z），06:12 日出、18:18 日落；月亮在對面（滿月）
function sunDir(min, out) {
  const H = (min - 735) / 1440 * Math.PI * 2, lat = 35 * DEG, dec = 1 * DEG;
  const east = -Math.cos(dec) * Math.sin(H), up = Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(H);
  const north = Math.cos(lat) * Math.sin(dec) - Math.sin(lat) * Math.cos(dec) * Math.cos(H);
  return out.set(east, up, -north).normalize();
}
// 顏色（sRGB 寫，Color 會轉成線性）
const SKY_PAL = {
  night: { fog: 0x1a1d26, hi: 0x3a2a3a, top: 0x1d2230, bot: 0x241a16 },   // 原本的雨夜：低雲被城市燈光照成紫灰
  nightC: { fog: 0x121722, hi: 0x22273a, top: 0x141a2a, bot: 0x1a1612 },  // 晴朗的夜
  day: { sky: 0x3d7ed2, hor: 0xbfd4e8, fog: 0xadbfd1 },
  dayO: { sky: 0x8d949c, hor: 0xa3a8ae, fog: 0x989ea4 },                  // 陰天
  dayR: { sky: 0x5a6068, hor: 0x737980, fog: 0x6a7076 },                  // 下雨的白天
  dusk: { sky: 0x2b447c, hor: 0xe3926a, fog: 0xa07c72 },                  // 日出日落
  dawn: { sky: 0x34558f, hor: 0xeea476, fog: 0x8a96aa },                  // 日出：霧偏藍灰（暖色留給朝太陽那一側的散射）
  fog: { day: 0xb7bbbf, night: 0x2c2a34 },
};
const SKYC = {};
for (const [k, o] of Object.entries(SKY_PAL)) { SKYC[k] = {}; for (const [n, h] of Object.entries(o)) SKYC[k][n] = C3(h); }
// 每小時開燈的窗戶比例（凌晨兩點和原本一樣 0.34）
const LIT_H = [[0, .38], [2, .34], [4, .24], [6, .16], [8, .08], [10, .05], [16, .06], [18, .24], [19.5, .44], [22, .44], [24, .38]];
function litAt(h) {
  for (let i = 1; i < LIT_H.length; i++) if (h <= LIT_H[i][0]) { const [a, va] = LIT_H[i - 1], [b, vb] = LIT_H[i]; return lerp(va, vb, (h - a) / (b - a)); }
  return LIT_H[0][1];
}
const atm = { exp: 1, bloom: 1, day: 0, lamp: 1, sunK: 0 };
const _c1 = new T.Color(), _c2 = new T.Color(), _c3 = new T.Color(), _c4 = new T.Color(), _sv = V3();
const WARM = C3(0xff8a48), NOON = C3(0xfff1de);
// 依時間與天氣算出戶外的一切（每幀，在戶外時）
function atmApply() {
  const min = clockSt.min + clockSt.acc / 2.5;
  const sun = sunDir(min, U.uSun.value); sunDir(min + 760, U.uMoon.value);
  const se = sun.y, c = wx.cloud, r = wx.rain, f = wx.fog;
  const day = sstep(-.11, .16, se), dusk = sstep(-.13, 0, se) * (1 - sstep(.06, .32, se));
  atm.day = U.uDay.value = day; U.uCloud.value = c;
  // 白天的天空：晴 → 陰 → 雨，日出日落時地平線偏橘
  const P = SKYC, oc = sstep(.3, .92, c);
  _c1.copy(P.day.sky).lerp(P.dayO.sky, oc).lerp(P.dayR.sky, r); _c2.copy(P.day.hor).lerp(P.dayO.hor, oc).lerp(P.dayR.hor, r);
  _c3.copy(P.day.fog).lerp(P.dayO.fog, oc).lerp(P.dayR.fog, r);
  const dk = dusk * (1 - .65 * c);
  const DS = min % 1440 < 720 ? P.dawn : P.dusk;
  _c1.lerp(DS.sky, dk); _c2.lerp(DS.hor, dk); _c3.lerp(DS.fog, dk);
  _c3.lerp(P.fog.day, f * .8); _c2.lerp(P.fog.day, f * .8);
  U.uSkyTop.value.set(_c1.r, _c1.g, _c1.b); U.uSkyHor.value.set(_c2.r, _c2.g, _c2.b);
  // 夜：雲多時是被城市照亮的紫灰低雲，晴朗時偏藍暗
  const N = P.night, NC = P.nightC;
  _c4.copy(NC.fog).lerp(N.fog, c).lerp(P.fog.night, f);
  U.uFogCol.value.copy(_c4).lerp(_c3, day);
  _c4.copy(NC.hi).lerp(N.hi, c).lerp(P.fog.night, f * .7);
  U.uFogHi.value.copy(_c4).lerp(_c3.clone().lerp(_c1, .25), day);
  // 環境光：天空的漫射（上）與地面反彈（下）
  _c4.copy(NC.top).lerp(N.top, c);
  // 日出日落：天光取偏藍的天頂、暗一點，和低角度的暖色日光拉開冷暖（晴天才明顯）
  const gold = dk * (1 - oc);
  U.uAmbTop.value.copy(_c4).lerp(_c1.clone().lerp(_c2, lerp(.72, .3, gold)).multiplyScalar((.75 + .3 * oc) * (1 - .15 * gold)), day);
  _c4.copy(NC.bot).lerp(N.bot, c);
  U.uAmbBot.value.copy(_c4).lerp(_c2.clone().multiplyScalar(.2).add(_c3.set(.035, .03, .026)), day);
  // 日光：低角度偏橘，被雲遮掉
  const sunK = sstep(-.015, .07, se) * (1 - .93 * sstep(.25, .95, c)) * (1 - .6 * f);
  atm.sunK = sunK;
  _c4.copy(WARM).lerp(NOON, sstep(.04, .42, se)).multiplyScalar(3 * sunK);
  U.uSunCol.value.set(_c4.r, _c4.g, _c4.b);
  // 00-core.js 的 uGI：天空可見度白天才算、中以上的畫質等級才算（夜裡的環境光是城市的光害，室內 60-venues 把 uDay 歸零也就關掉）；
  // 日光反彈跟著日照；清晨 5–9 點起貼地薄霧（雨天淡一半）；霧裡的前向散射低角度時強
  const hr = min / 60 % 24, mist = sstep(4.6, 6, hr) * (1 - sstep(7.6, 9.4, hr)) * (1 - .5 * r);
  U.uGI.value.set(GT().vol ? .85 * day : 0, sunK, mist * .0042 * SET.mist, lerp(.55, .25, sstep(.05, .4, se)));
  // 霧：夜裡的霧本來就用來藏住 420 m 外不畫的建築（distCull），白天也不能太薄
  U.uFogDen.value = lerp(.0145, .0046, day) + r * lerp(.0025, .0012, day) + f * f * lerp(.028, .02, day);
  // 路燈、窗燈：天色暗到一定程度才亮
  const light = day * (1 - .5 * oc) * (1 - .4 * f);
  atm.lamp = 1 - sstep(.32, .62, light);
  U.uLamp.value = atm.lamp; U.uLampOn.value = atm.lamp > .005 ? 1 : 0;
  U.uLit.value = litAt(min / 60 % 24) + .1 * oc * day;
  U.uWet.value = wx.wet;
  atm.exp = lerp(1, .74, day) * (1 + .25 * oc * day);
  atm.bloom = lerp(1, 2.4, day);
  rainMesh.visible = splashMesh.visible = r > .01 && SET.rainFx;   // 01-settings.js：雨絲可以關掉
}
// 每幀：天氣過渡、積水、打雷（取代原本 99-main 的雨勢正弦起伏）
function updateWeather(dt, t) {
  const out = player.where === 'out';
  wx.left -= dt / 2.5;
  if (wx.left <= 0) setWeather(wxPick(wx.cur));
  const W = WX[wx.cur], k = 1 - Math.exp(-dt / 30), kc = 1 - Math.exp(-dt / 22);
  wx.cloud += (W.cloud - wx.cloud) * kc;
  wx.rain += (Math.min(W.rain, wx.cloud) - wx.rain) * k;   // 雲先聚起來才下得大
  wx.fog += (W.fog - wx.fog) * k;
  if (wx.rain > .06) wx.wet = Math.min(1, wx.wet + dt * .05 * wx.rain);
  else wx.wet = Math.max(0, wx.wet - dt * (.0025 + .008 * atm.sunK));
  U.uRain.value = wx.rain;
  // 撐傘的行人：雨下起來才撐（40-people.js）
  if (wx.umb !== wx.rain > .12 && Math.abs(wx.rain - .12) > .04) { wx.umb = wx.rain > .12; pedUmbrellas(wx.umb); }
  // 雷雨才打雷（__nc.flash() 可以強制打一次）
  wx.next -= dt;
  if (wx.next <= 0 && out) {
    wx.next = 28 + Math.random() * 40;
    if (W.thunder || wx.force) {
      wx.force = false; wx.bolts++;
      wx.flash = [[0, .9], [.08, 0], [.16, .6], [.3, 0], [.42, .35], [.7, 0]].map(([d, v]) => [t + d, v]);
      sfx.thunder(1.2 + Math.random() * 2.5);
    }
  }
  let fl = U.uFlash.value;
  while (wx.flash.length && wx.flash[0][0] <= t) fl = wx.flash.shift()[1];
  U.uFlash.value = out ? Math.max(0, fl - dt * 2 * (wx.flash.length ? 0 : 1)) : 0;
  if (out) atmApply();
  wxHud();
}
// HUD 的天氣圖示與字（白天的晴是太陽、夜裡是月亮）
const WX_ICON = {
  rain: '<path d="M5 1C3.5 4 2 5.6 2 7.6a3 3 0 0 0 6 0C8 5.6 6.5 4 5 1z" fill="#a9a49a"/>',
  storm: '<path d="M6.2 .8 2 7h2.6L3.6 11.2 8 4.8H5.3z" fill="#e8c860"/>',
  sun: '<circle cx="5" cy="6" r="2.2" fill="#f0c860"/><path d="M5 1.2v1.3M5 9.5v1.3M.2 6h1.3M8.5 6h1.3M1.6 2.6l.9.9M7.5 8.5l.9.9M1.6 9.4l.9-.9M7.5 3.5l.9-.9" stroke="#f0c860" stroke-width=".8"/>',
  moon: '<path d="M6.8 1.6A4.4 4.4 0 1 0 8.6 9 3.6 3.6 0 0 1 6.8 1.6z" fill="#cfd4e0"/>',
  cloud: '<path d="M2.6 9.4a2 2 0 0 1-.2-4 2.8 2.8 0 0 1 5.4-.6 1.9 1.9 0 0 1 .3 4.6z" fill="#b8bcc4"/>',
  fog: '<path d="M1 4h8M2 6.4h7M1 8.8h7" stroke="#b8bcc4" stroke-width="1.1" stroke-linecap="round"/>',
};
function wxHud() {
  const id = wx.cur, night = U.uSun.value.y < -.03;
  const ic = id === 'storm' ? 'storm' : WX[id].rain > 0 ? 'rain' : id === 'fog' ? 'fog' : id === 'clear' || id === 'cloudy' && !night ? (night ? 'moon' : 'sun') : 'cloud';
  if (hudCache.wxIcon !== ic) { hudCache.wxIcon = ic; $('weather').querySelector('svg').innerHTML = WX_ICON[ic]; }
  setText('wxText', WX[id].n);
}
// 地上的陰影：離相機最近的車與行人寫進 uOccA／uOccB（00-core.js 的 occlude）
const _occ = [];
function occUpdate() {
  const cx = camera.position.x, cz = camera.position.z, L = _occ; L.length = 0;
  const add = (x, z, yaw, hl, hw, h) => { const d = (x - cx) ** 2 + (z - cz) ** 2; if (d < 1600) L.push({ x, z, yaw, hl, hw, h, d }); };
  const carH = (len, w) => len > 6 ? 3.2 : w > 2.05 ? 2.3 : 1.45;
  for (const c of traffic) { const t = TYPES[c.type]; add(c.x, c.z, c.yaw, t.len * .47, t.w * .46, carH(t.len, t.w)); }
  for (const c of parked) { const t = TYPES[c.type]; if (t) add(c.x, c.z, c.yaw, t.len * .47, t.w * .46, carH(t.len, t.w)); }
  for (const v of vehicles) if (v.g && v.g.visible && !(v === kestrel && motors.stowed)) add(v.x, v.z, v.yaw, (v.len || 4.4) * .47, (v.isCar || v.boat ? v.w || 1.9 : .5) * .46, v.isCar ? carH(v.len || 4.4, v.w || 1.9) : 1.25);
  if (player.mode === 'walk') add(player.x, player.z, 0, .24, .24, 1.75);
  for (const p of peds.people) if (p.h && p.h.visible !== false) add(p.x, p.z, 0, .22, .22, 1.7);
  L.sort((a, b) => a.d - b.d);
  for (let k = 0; k < NOCC; k++) {
    const o = L[k];
    if (!o) { U.uOccB.value[k].set(0, 0, 0, 0); continue; }
    U.uOccA.value[k].set(o.x, o.z, Math.cos(o.yaw), Math.sin(o.yaw));
    U.uOccB.value[k].set(o.hl, o.hw, o.h, 0);
  }
}
