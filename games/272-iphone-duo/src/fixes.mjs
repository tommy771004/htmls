// 逐件放置時檢查失敗所做的修正（依放置步驟觸發）。每項都記錄失敗原因與改了什麼。
export const FIXES = {
  frameL: [{
    id: 'lobe272', zh: '中脊側翼切到 272°',
    why: '攤平時左中框下唇（x = −1.925）與中脊底部側面零間隙。',
    what: '中脊側翼外緣 R2.64 的範圍由 100°–270° 延伸到 100°–272°，底部側面內縮到 x = ±1.83。',
    apply: D => { D.lobeTo = 272; },
  }],
  sliderL: [{
    id: 'ygap', zh: '活動件與溝槽留 y 向間隙',
    why: '滑軌端面與中脊滑槽側壁在 y = ±20、±26.5 面貼面，轉動時摩擦。',
    what: '滑軌、齒輪軸兩端各縮 0.06（溝槽不變）。',
    apply: D => { D.yGap = 0.06; },
  }],
  sync: [{
    id: 'chain2', zh: '齒輪鏈改 17T／15T／15T，中框下唇讓出端齒輪',
    why: '端齒輪（16T，x = −1.80）齒頂與左中框下唇重疊 0.33；咬合角 272.6°–362.6° 超出齒條末端 365° 減一齒的範圍。',
    what: '端齒輪移到樞軸正下方（咬合角 270°），齒數 17／15／15 共線於 z = −1.70；齒輪鏈區段（|y| 20–33）的中框下唇依端齒輪掃掠挖出缺口，下緣 0.36 保留不破背面接縫。',
    apply: D => {
      D.gears = [{ x: -1.925, z: -1.70, n: 17 }, { x: -1.125, z: -1.70, n: 15 }, { x: -0.375, z: -1.70, n: 15 }];
      D.lipNotch = true;
    },
  }],
};
FIXES.display = [{
  id: 'recess', zh: '中框依螢幕包絡下挖',
  why: '螢幕自由段第一段圓弧往機身方向下彎，在黏著線外側壓進中板（φ = 90° 時 −0.21）。',
  what: '左右中框在 |x| < 6.5 範圍，依自由段在機身座標中 0–90° 的掃掠包絡外加 0.08 挖出凹面。',
  apply: D => { D.recess = true; },
}, {
  id: 'pocketEnv', zh: '中脊凹槽依螢幕包絡挖出',
  why: '小角度時螢幕在 |x| ≈ 3.3 下垂，壓到中脊側翼頂面（φ = 8° 時 −0.25）；原本的矩形凹槽只到 |x| = 3.02。',
  what: '中脊上方凹槽改為螢幕自由段在世界座標中 0–90° 掃掠包絡外加 0.08。',
  apply: D => { D.pocket = 'env'; },
}, {
  id: 'sliderB0', zh: '滑軌起點後移到 200°',
  why: '闔上時滑軌前端（170° → 80°）伸進水滴形螢幕下方（φ = 84° 時 −0.43）。',
  what: '滑軌弧帶起點由 170° 改為 200°，闔上時停在 110°，滑槽同步縮短。',
  apply: D => { D.slider.b0 = 200; },
}];

// 支撐板角度律：每個 φ 取「離螢幕自由段 ≥ 0.09」的最小 ψ（單調不減），每 0.5° 一格
import { PHIS, foldShape, plateShape, plateFrame } from './parts.mjs';
import { dist2 } from './check.mjs';
import { D2R, IDENT } from './kin.mjs';
export function solvePlateLaw(D, clear = 0.09) {
  const ps = plateShape(D), t = [];
  let psi = 0;
  const gap = (phi, s) => dist2(ps, plateFrame(D, s, -1), foldShape(phi), IDENT).d;
  for (const phi of PHIS) {
    if (gap(phi, psi) < clear) {
      let lo = psi, hi = psi;
      while (gap(phi, hi) < clear && hi < 120 * D2R) { lo = hi; hi += 2 * D2R; }
      for (let k = 0; k < 18; k++) { const m = (lo + hi) / 2; if (gap(phi, m) < clear) lo = m; else hi = m; }
      psi = hi;
    }
    t.push(+psi.toFixed(6));
  }
  return t;
}
FIXES.plates = [{
  id: 'plateLaw', focus: 'display', zh: '支撐板改用逐角度求解的翻轉律',
  why: '線性翻轉 ψ = 2φ/3 太慢，φ ≈ 44° 時板子頂到下垂的螢幕（−0.21）。',
  what: '每 0.5° 求「離螢幕 ≥ 0.09」的最小 ψ（單調不減），以表格內插；實際由凸輪曲線實現（推估）。',
  apply: D => { D.plate.law = 'table'; D.plate.table = solvePlateLaw(D); },
}, {
  id: 'plateHinge', focus: 'display', zh: '支撐板鉸點外移下移到 (∓4.00, 1.95)',
  why: '螢幕在 φ ≈ 2° 就垂到鉸點 (∓2.80, 2.05) 附近；鉸點本身不會動，翻多少都離不開 0.09。螢幕下緣包絡在 |x| = 4.0 處最低 2.09。',
  what: '鉸點改到 (∓4.00, 1.95)，板長 3.94、厚 0.30；攤平時板面低於螢幕 0.25，按壓時才承托。翻轉律重新求解。',
  apply: D => { Object.assign(D.plate, { hx: 4.00, hz: 1.95, L: 3.94 }); D.plate.table = solvePlateLaw(D); },
}, {
  id: 'pocketPlates', zh: '中脊凹槽加挖支撐板掃掠',
  why: '支撐板翻下時板尾掃進中脊凹槽底部。',
  what: '中脊凹槽再聯集支撐板在 0–90° 的掃掠包絡外加 0.08。',
  apply: D => { D.pocketPlates = true; },
}, {
  id: 'plateSeg', zh: '支撐板分段，避開滑軌／齒輪與排線區',
  why: '闔上時支撐板垂直掛下，與同一 y 區段的弧形滑軌重疊。',
  what: '支撐板改成 5 段：|y| ≤ 19.94、33.06–42.44、49.56–57.0，與滑軌、齒輪、排線區段留 0.06 y 向間隙。',
  apply: D => { D.plate.ys = [[-57, -49.56], [-42.44, -33.06], [-19.94, 19.94], [33.06, 42.44], [49.56, 57]]; },
}];
FIXES.fpc1 = [{
  id: 'fpcNotch', zh: '中框與中脊依排線掃掠挖出通道',
  why: '排線自由段攤平時下垂、闔上時繞到水滴形螢幕外側，掃過中框鉸鏈端與中脊側翼。',
  what: '排線區段（|y| 42.5–49.5）的中框依排線在機身座標的掃掠包絡外加 0.08 挖槽，並開出固定段走線槽；中脊同區段依世界座標包絡挖空。',
  apply: D => { D.fpc.notch = true; },
}];
