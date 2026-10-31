// ═══ 設定值（95-menu.js 的 Esc 選單）：預設值、讀檔與存檔 ═══
// 排在最前面，後面每個 part 開場就讀得到（70-render.js 開場就依 MSAA 與倒影建渲染目標）。
// 存在 localStorage 的 nc260.settings，和遊戲存檔 nc260.motors 分開，不動存檔版本。
// 數值：d 預設、lo–hi 範圍、st 一格；開關：d 是 true／false；選項：o 是可選的值
const SET_KEY = 'nc260.settings';
const SET_DEF = {
  // 鍵盤／滑鼠
  sens: { d: 1, lo: .3, hi: 2.5, st: .1 }, aimSens: { d: 1, lo: .3, hi: 1.5, st: .05 }, invY: { d: false }, aimHold: { d: 'hold', o: ['hold', 'toggle'] }, touchSens: { d: 1, lo: .4, hi: 2, st: .1 },
  // 開車：steerK 是方向盤打與回正的速度倍率（99-main.js 的 pedal）
  steerK: { d: 1, lo: .5, hi: 2, st: .1 },
  // 聲音
  vMaster: { d: 1, lo: 0, hi: 1, st: .1 }, vSfx: { d: 1, lo: 0, hi: 1, st: .1 }, vMusic: { d: 1, lo: 0, hi: 1, st: .1 }, vAmb: { d: 1, lo: 0, hi: 1, st: .1 }, muteBlur: { d: false },
  // 攝影機：camFar 是 camState.far 的檔位（0 標準、1 遠、2 近）
  fov: { d: 62, lo: 50, hi: 80, st: 2 }, camFar: { d: 0, o: [2, 0, 1] }, recenter: { d: true }, shake: { d: 1, lo: 0, hi: 1, st: .1 },
  // 顯示：safe 是 HUD 往內縮的格數（一格 6 px）
  hud: { d: true }, radar: { d: true }, safe: { d: 0, lo: 0, hi: 8, st: 1 }, units: { d: 'metric', o: ['metric', 'imperial'] }, bright: { d: 1, lo: .7, hi: 1.4, st: .05 },
  // 影像：res '1080p'（預設）是內部解析度的短邊固定 1080 px、'auto' 是依幀時自動調整（70-render.js），數字是固定的內部解析度比例；軟體繪圖預設自動；fps 0 是不限
  // gpu：畫質等級（00-core.js 的 GPU_TIERS），'auto' 照顯示卡名稱；msaa、fps、dist、refl 的預設值跟著等級
  gpu: { d: 'auto', o: ['auto', 'soft', 'low', 'mid', 'high', 'ultra'] },
  res: { d: GPU.tier === 'soft' ? 'auto' : '1080p', o: ['1080p', 'auto', .5, .6, .75, .85, 1] }, msaa: { d: GT().msaa, o: [0, 2, 4, 8] }, fps: { d: GT().fps, o: [30, 60, 0] }, pauseBlur: { d: true }, ped: { d: 1, lo: .2, hi: 1, st: .1 }, dist: { d: GT().dist, lo: .6, hi: 1.2, st: .1 },
  // 進階影像：refl 0 關、1 低（三分之一解析度）、2 高（一半）
  refl: { d: GT().refl, o: [0, 1, 2] }, bloom: { d: 1, lo: 0, hi: 1.5, st: .1 }, blur: { d: reduceMotion ? 0 : 1, lo: 0, hi: 1, st: .1 }, rainFx: { d: true }, ca: { d: true }, grain: { d: true },
  // 清晨的光（00-core.js 的 uGI、70-render.js 的體積光）：vol 0 是不畫體積光（等級沒有步數時固定關掉），mist 是清晨薄霧的濃度
  vol: { d: GT().vol ? 1 : 0, lo: 0, hi: 1.5, st: .1 }, mist: { d: 0, lo: 0, hi: 1.5, st: .1 },   // 使用者：拿掉霧氣（清晨薄霧預設關掉，設定裡還能打開）
  // 環境光遮蔽（70-render.js 的 mAO）：強度，0 是不畫；等級沒開（GT().ao）時不建渲染目標，固定關掉
  ao: { d: GT().ao, lo: 0, hi: 1.5, st: .1 },
  // 眼睛適應（70-render.js 的 mEyeAdapt）：亮度突然變化時先過曝或變暗、幾秒內適應回來；穩定時不改曝光
  eye: { d: true },
  // 照片材質（08-tex.js）：0 關（程式紋理）、1 只有底色、2 加法線與粗糙度
  tex: { d: GT().tex, o: [0, 1, 2] },
  // 程式立面的細模（09-mass.js）：鏡頭幾公尺內的街區換成挖出窗洞、店面凹進的細模，0 關（只有平面的盒）
  fac: { d: GT().fd, o: [0, 70, 110, 150, 210] },
};
function setValid(k, v) {
  const D = SET_DEF[k];
  if (D.o) return D.o.includes(v);
  if (typeof D.d === 'boolean') return typeof v === 'boolean';
  return Number.isFinite(v) && v >= D.lo - 1e-6 && v <= D.hi + 1e-6;
}
// binds：按鍵綁定（動作預設的鍵 → 玩家改成的鍵），由 95-menu.js 檢查
const SET = (() => {
  let d = null;
  try { d = JSON.parse(localStorage.getItem(SET_KEY) || 'null'); } catch (e) { /* 讀不到就用預設 */ }
  const s = { binds: {} };
  // 第 1 版把每一項都存下來（連預設值），畫質的預設值就被凍結了：和當時預設一樣的那幾項當成沒改過，改照等級
  if (d && !d.v) for (const [k, v] of [['msaa', LOW ? 0 : 4], ['fps', 0], ['dist', LOW ? .8 : 1], ['refl', LOW ? 1 : 2]]) if (d[k] === v) delete d[k];
  for (const k in SET_DEF) s[k] = d && k in d && setValid(k, d[k]) ? d[k] : SET_DEF[k].d;
  if (d && d.binds && typeof d.binds === 'object') for (const k in d.binds) if (typeof d.binds[k] === 'string') s.binds[k] = d.binds[k];
  return s;
})();
// 細節距離：選單的 SET.dist 再乘上自動降載的 k（70-render.js：內部解析度降到底還是太慢就縮短，快了再放回來）；
// 遠處的立面、建築組與街道設施都照它隱藏（10-city.js 的 distCull、20-props.js 的 instUpdate），v 變了要重算。
// alt：鏡頭升高（直升機、霓峰塔的塔吊）時看得更遠，70-render.js 依鏡頭高度設 1–1.6（霧也跟著鏡頭高度變淡，邊緣照 uCullR 全進霧裡）
const detail = { k: 1, v: 0, alt: 1 };
const detailK = () => SET.dist * detail.k * detail.alt;
// 只存改過的項目（第 2 版），預設值留給等級決定：換了顯示卡或等級，沒動過的畫質設定跟著走
function setSave() {
  const o = { v: 2, binds: SET.binds };
  for (const k in SET_DEF) if (SET[k] !== SET_DEF[k].d) o[k] = SET[k];
  try { localStorage.setItem(SET_KEY, JSON.stringify(o)); } catch (e) { /* 存不了就算了 */ }
}
// 換畫質等級（Esc 選單）：解析度上限、MSAA、幀率上限、細節距離與倒影換成那一級的預設值；燈數與陰影步數重新整理才生效
const TIER_KEYS = ['msaa', 'fps', 'dist', 'refl'];
function tierSet(v) {
  GPU.tier = v === 'auto' ? GPU.auto : v;
  for (const k of TIER_KEYS) SET[k] = SET_DEF[k].d = GT()[k];
}
// 距離與速度依測量系統顯示（90-hud.js、91-map.js）
const IMPERIAL = () => SET.units === 'imperial';
function fmtDist(m) {
  if (IMPERIAL()) { const mi = m / 1609.34; return mi < .1 ? `${Math.round(m * 3.28084 / 10) * 10} ft` : `${mi.toFixed(mi < 10 ? 2 : 1)} mi`; }
  return m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${Math.round(m)} m`;
}
