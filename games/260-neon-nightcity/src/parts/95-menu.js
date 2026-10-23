// ═══ Esc 暫停選單：仿 GTA V 的暫停畫面（上方分頁、左邊類別、右邊設定列），設定值在 01-settings.js ═══
// 開著時世界停住（99-main.js 的 loop 不跑 step），背景是停住的那一幀，模糊後染成目前主角的顏色。
// 鍵盤：↑↓ 選列、←→ 調整、Enter 選擇、Esc／Backspace 返回、Q／E 換分頁；滑鼠點選、拖曳滑桿；觸控點選。
// 按鍵綁定：在 window 的捕獲階段把實體按鍵換成遊戲認得的 code 再轉送，其他 part 的按鍵處理不用改。
const menu = { on: false, tab: 'set', cat: 0, row: 0, focus: 'cats', listen: null, redraw: false, selfExit: 0, openT: 0, msg: '', drag: null, fovBase: SET.fov };

// ─── 按鍵綁定 ───
// k：遊戲裡的 code（也是預設的鍵）。方向鍵、數字鍵、Enter、Esc、Backspace 在地圖、手機與對話裡另有用途，不給綁
const KEY_ACTS = [
  { k: 'KeyW', n: '前進／油門' }, { k: 'KeyS', n: '後退／煞車' }, { k: 'KeyA', n: '左移／左轉' }, { k: 'KeyD', n: '右移／右轉' },
  { k: 'ShiftLeft', n: '奔跑／氮氣' }, { k: 'Space', n: '手煞車' }, { k: 'KeyF', n: '上車／下車、搶車' }, { k: 'KeyE', n: '互動' },
  { k: 'KeyR', n: '換彈匣' }, { k: 'KeyZ', n: '蹲下／站起' }, { k: 'Tab', n: '武器轉盤（按住）' }, { k: 'KeyQ', n: '角色轉盤（按住）' },
  { k: 'KeyX', n: '特殊能力' }, { k: 'KeyG', n: '跳舞／引爆黏彈' }, { k: 'KeyV', n: '叫車' }, { k: 'KeyC', n: '切換鏡頭距離' },
  { k: 'KeyP', n: '手機' }, { k: 'KeyM', n: '全區地圖' },
];
const KEY_NO = /^(Escape|Enter|NumpadEnter|Backspace|Delete|CapsLock|Meta(Left|Right)|Digit\d|Numpad\w*|Arrow\w+|F\d+)$/;
const KEYMAP = new Map();   // 實體鍵 → 遊戲 code（'Unbound' 是被換走、現在不做事的預設鍵）
const keyCur = k => SET.binds[k] || k;
function bindsBuild() {
  KEYMAP.clear();
  for (const a of KEY_ACTS) if (SET.binds[a.k]) KEYMAP.set(a.k, 'Unbound');
  for (const a of KEY_ACTS) if (SET.binds[a.k]) KEYMAP.set(SET.binds[a.k], a.k);
}
// 存檔裡的綁定先檢查：不認得的動作、不能綁的鍵、重複的鍵都丟掉
for (const k in SET.binds) if (!KEY_ACTS.some(a => a.k === k) || KEY_NO.test(SET.binds[k]) || SET.binds[k] === k) delete SET.binds[k];
{ const seen = new Set(); for (const a of KEY_ACTS) { const c = keyCur(a.k); if (seen.has(c)) delete SET.binds[a.k]; seen.add(keyCur(a.k)); } }
bindsBuild();
function bindSet(k, code) {
  const old = keyCur(k), b = KEY_ACTS.find(a => a.k !== k && keyCur(a.k) === code);
  if (b) { if (old === b.k) delete SET.binds[b.k]; else SET.binds[b.k] = old; }   // 新鍵已經有人用：兩個動作對調
  if (code === k) delete SET.binds[k]; else SET.binds[k] = code;
  bindsBuild(); setSave();
  return b;
}
const KEY_NAMES = { Space: '空白鍵', ShiftLeft: '左 Shift', ShiftRight: '右 Shift', ControlLeft: '左 Ctrl', ControlRight: '右 Ctrl', AltLeft: '左 Alt', AltRight: '右 Alt', Tab: 'Tab', Backquote: '`', Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Backslash: '\\', Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/', IntlBackslash: '\\' };
const keyName = c => KEY_NAMES[c] || c.replace(/^Key/, '');

addEventListener('keydown', e => {
  if (!e.isTrusted || e.target.tagName === 'INPUT') return;   // 自己轉送的事件直接放行
  if (menu.on) {
    e.preventDefault(); e.stopImmediatePropagation();
    if (menu.listen) { if (!e.repeat) menuBindKey(e.code); return; }
    if (e.code === 'Escape' && performance.now() - menu.openT < 300) return;   // 解除游標鎖定的那個 Esc 若也傳進來，別把剛打開的選單又關掉
    if (!e.repeat || /^Arrow/.test(e.code)) menuKey(e.code);
    return;
  }
  const c = KEYMAP.get(e.code);
  if (!c) return;
  e.preventDefault(); e.stopImmediatePropagation();
  dispatchEvent(new KeyboardEvent('keydown', { code: c, key: e.key, repeat: e.repeat, bubbles: true, cancelable: true }));
}, true);
addEventListener('keyup', e => {
  if (!e.isTrusted) return;
  const c = KEYMAP.get(e.code);
  if (!c) return;
  e.stopImmediatePropagation();
  dispatchEvent(new KeyboardEvent('keyup', { code: c, key: e.key, bubbles: true, cancelable: true }));
}, true);
// 瞄準模式「切換」：右鍵按一下開、再按一下關（69-combat.js 原本是按住）
addEventListener('pointerdown', e => {
  if (SET.aimHold !== 'toggle' || e.button !== 2 || e.pointerType !== 'mouse' || !document.pointerLockElement || menu.on) return;
  e.stopImmediatePropagation(); gta.rmb = !gta.rmb;
}, true);
addEventListener('pointerup', e => { if (SET.aimHold === 'toggle' && e.button === 2 && e.pointerType === 'mouse') e.stopImmediatePropagation(); }, true);

// ─── 套用設定 ───
function setApply(k) {
  const b = document.body;
  if (!k || k === 'hud') b.classList.toggle('noHud', !SET.hud);
  if (!k || k === 'radar') b.classList.toggle('noRadar', !SET.radar);
  if (!k || k === 'safe') document.documentElement.style.setProperty('--safe', SET.safe * 6 + 'px');
  if (!k || k === 'units') { const em = document.querySelector('#spRow em'); if (em) em.textContent = IMPERIAL() ? 'mph' : 'km/h'; }
  if (!k || /^v|muteBlur/.test(k)) sfx.mix();
  if (k === 'blur') post.blur = .5 * SET.blur;
  if (k === 'res') { post.scale = typeof SET.res === 'number' ? SET.res : 1; detail.k = 1; detail.v++; makeTargets(); }   // 切回自動從 100% 開始，太慢再往下降
  if (k === 'gpu') { tierSet(SET.gpu); tierDpr(); detail.v++; setSave(); }   // 00-core.js 的畫質等級：MSAA、幀率、距離、倒影換成那一級，tierDpr 重做渲染目標；menuSet 是先存檔再套用，換完要再存一次，舊等級下改過的值才不會留在設定檔裡
  if (k === 'msaa' || k === 'refl') makeTargets();
  if (k === 'dist') detail.v++;
  if (k === 'camFar') camState.far = SET.camFar;
  if (k === 'fov') { const d = SET.fov - menu.fovBase; menu.fovBase = SET.fov; camState.fov += d; camera.fov += d; camera.updateProjectionMatrix(); }
  if (k === 'aimHold') gta.rmb = false;
  menu.redraw = true;
}
setApply();

// ─── 選單內容 ───
// 列的種類：數值滑桿（lo–hi，取 SET_DEF）、開關、選項（o 的標籤）、動作（fn）、按鍵（bind）、唯讀（info）
const pct = v => Math.round(v * 100) + '%';
const MENU = {
  game: [
    { n: '暫停', rows: () => [
      { n: '繼續遊戲', act: () => menuClose(), d: '回到雨夜。' },
      { n: '快速存檔', act: menuSave, d: '存下主角、任務、彈藥、位置與正在開的車。通緝中、搶劫中或人在室內時不能存（安全屋請去床邊）。' },
      { n: '讀取快速存檔', act: menuLoad, off: !motors.game, val: motors.game ? new Date(motors.game.t).toLocaleString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '沒有存檔', d: '回到上次快速存檔的地方。現金與車庫本來就即時存著，不受影響。' },
    ] },
    { n: '角色能力', rows: skillRows },   // 69-v3-skills.js：目前主角的六圍
    { n: '操作說明', rows: () => [
      ...KEY_ACTS.map(a => ({ n: a.n, info: keyName(keyCur(a.k)) })),
      { n: '環顧', info: '滑鼠（點畫面鎖定游標）' }, { n: '開火／瞄準', info: SET.aimHold === 'toggle' ? '左鍵／右鍵切換' : '左鍵／右鍵按住' },
      { n: '換武器', info: '滾輪' }, { n: '傳送', info: '1–6' }, { n: '暫停與設定', info: 'Esc' },
    ] },
  ],
  set: [
    { n: '鍵盤／滑鼠', rows: () => [
      { k: 'sens', n: '滑鼠靈敏度', f: v => v.toFixed(1) + '×', d: '環顧時鏡頭轉動的速度。' },
      { k: 'aimSens', n: '瞄準靈敏度', f: v => v.toFixed(2) + '×', d: '按住右鍵瞄準時再乘上的倍率；狙擊鏡放大時會依視野再自動降低。' },
      { k: 'invY', n: '反轉滑鼠 Y 軸', d: '往前推滑鼠時鏡頭往上看。' },
      { k: 'aimHold', n: '瞄準模式', o: { hold: '按住', toggle: '切換' }, d: '按住：放開右鍵就收槍。切換：按一下右鍵舉槍，再按一下放下。' },
      { k: 'touchSens', n: '觸控環顧靈敏度', f: v => v.toFixed(1) + '×', off: !isTouch, d: isTouch ? '右半邊螢幕拖曳環顧的速度。' : '只在觸控裝置上有效。' },
      { reset: ['sens', 'aimSens', 'invY', 'aimHold', 'touchSens'] },
    ] },
    { n: '按鍵綁定', rows: () => [
      ...KEY_ACTS.map(a => ({ bind: a.k, n: a.n, d: menu.listen === a.k ? '按下新的按鍵，Esc 取消。新鍵若已有其他動作，兩邊會對調。' : 'Enter 或點一下更改；Delete 還原這一項。方向鍵、數字鍵與 Enter 另有用途，不能綁。' })),
      { reset: 'binds' },
    ] },
    { n: '聲音', rows: () => [
      { k: 'vMaster', n: '主音量', f: pct, d: '所有聲音的總音量。右上角的喇叭按鈕仍然是一鍵靜音。' },
      { k: 'vSfx', n: '音效音量', f: pct, d: '引擎、甩尾、槍聲、爆炸、腳步與介面音效。' },
      { k: 'vMusic', n: '音樂音量', f: pct, d: 'LAZARUS 夜店（124 BPM）與 AFTERGLOW 酒吧（84 BPM）的現場音樂。' },
      { k: 'vAmb', n: '環境音量', f: pct, d: '雨聲、雷聲、城市低頻與遠處的喇叭和警笛。' },
      { k: 'muteBlur', n: '切到其他分頁時靜音', d: '瀏覽器分頁或視窗不在前景時把聲音關掉。' },
      { reset: ['vMaster', 'vSfx', 'vMusic', 'vAmb', 'muteBlur'] },
    ] },
    { n: '攝影機', rows: () => [
      { k: 'fov', n: '視野', f: v => v + '°', d: '第三人稱鏡頭的基本視角；車速、氮氣與瞄準會在這個值上再加減。' },
      { k: 'camFar', n: '預設鏡頭距離', o: { 2: '近', 0: '標準', 1: '遠' }, d: '和 C 鍵切換的是同一個檔位。' },
      { k: 'recenter', n: '開車時鏡頭自動回正', d: '開車時滑鼠停 1.2 秒，鏡頭轉回車尾。' },
      { k: 'shake', n: '鏡頭晃動', f: pct, d: '撞車與爆炸時的畫面震動。' },
      { reset: ['fov', 'camFar', 'recenter', 'shake'] },
    ] },
    { n: '顯示', rows: () => [
      { k: 'hud', n: '顯示 HUD', d: '關掉後只留互動提示、訊息與對話。' },
      { k: 'radar', n: '小地圖', d: '左下角的雷達與生命、護甲、能力條。' },
      { k: 'safe', n: '安全區域', f: v => v * 6 + ' px', d: 'HUD 往畫面內縮的距離，電視或投影機邊緣被裁掉時調大。' },
      { k: 'units', n: '測量系統', o: { metric: '公制', imperial: '英制' }, d: '時速表、導航距離與地圖比例尺的單位。' },
      { k: 'bright', n: '亮度', f: pct, d: '整體曝光。雨夜很暗是刻意的，太暗看不清路再調高。' },
      { reset: ['hud', 'radar', 'safe', 'units', 'bright'] },
    ] },
    { n: '影像', stat: true, rows: () => [
      { k: 'gpu', n: '畫質等級', o: { auto: `自動（${GPU_TIERS[GPU.auto].name}）`, soft: '最低', low: '低', mid: '中', high: '高' },
        d: `顯示卡：${GPU.short}${GPU.api ? ' · ' + GPU.api : ''}。換等級會一起換掉 MSAA、幀率上限、細節距離與路面倒影；燈光數與陰影精細度重新整理後生效${GPU.hdr ? '' : '。這張顯示卡不支援浮點渲染目標，泛光會比較弱'}。` },
      { k: 'res', n: '內部解析度', o: { auto: '自動', .5: '50%', .6: '60%', .75: '75%', .85: '85%', 1: '100%' }, d: '自動：幀時太長就降、夠快再升回來（60%–100%）。固定比例不再自動調整。' },
      { k: 'msaa', n: 'MSAA', o: { 0: '關閉', 2: 'X2', 4: 'X4', 8: 'X8' }, lim: v => v <= (R.capabilities.maxSamples || 0), d: `多重取樣抗鋸齒。這張顯示卡最多 X${R.capabilities.maxSamples || 0}。` },
      { k: 'fps', n: '幀率上限', o: { 30: '30', 60: '60', 0: '不限' }, d: '螢幕更新率高於 60 Hz 時可以限在 60 省電；筆電可以限在 30。' },
      { k: 'pauseBlur', n: '失焦時暫停遊戲', d: '切到其他視窗或分頁時自動打開這個選單。' },
      { k: 'ped', n: '人口密集程度', f: pct, d: '街上路人的數量；在玩家 55 m 外慢慢增減。' },
      { k: 'dist', n: '細節距離', f: pct, d: '遠處立面、招牌與街道道具出現的距離。調低可以省下繪製量。' },
      { reset: ['gpu', 'res', 'msaa', 'fps', 'pauseBlur', 'ped', 'dist'] },
    ] },
    { n: '進階影像', stat: true, rows: () => [
      { k: 'refl', n: '路面倒影', o: { 0: '關閉', 1: '低', 2: '高' }, d: '積水路面上的霓虹倒影：低是三分之一解析度、高是一半。關掉最省，但雨夜會失色不少。' },
      { k: 'bloom', n: '泛光', f: pct, d: '霓虹與車燈的光暈強度。' },
      { k: 'blur', n: '動態模糊', f: pct, off: reduceMotion, d: reduceMotion ? '系統設定了減少動態效果，動態模糊固定關閉。' : '鏡頭轉動與高速時的模糊。' },
      { k: 'rainFx', n: '雨絲與水花', d: '畫面上的雨絲與地上的水花粒子；雨聲與積水不受影響。' },
      { k: 'ca', n: '鏡頭色散', d: '畫面邊緣的紅藍分離。' },
      { k: 'grain', n: '底片顆粒', d: '整個畫面上細微的雜訊。' },
      { reset: ['refl', 'bloom', 'blur', 'rainFx', 'ca', 'grain'] },
    ] },
  ],
};
const TABS = [{ id: 'map', n: '地圖' }, { id: 'game', n: '遊戲' }, { id: 'set', n: '設定' }];
const menuCats = () => MENU[menu.tab];
const menuRows = () => menuCats()[menu.cat].rows();
const rowOn = r => !r.off && !r.info;

function optList(r) { const D = SET_DEF[r.k]; return D.o.filter(v => !r.lim || r.lim(v)); }
function rowVal(r) {
  if (r.reset) return '';
  if (r.info) return `<span class="mnInfo">${r.info}</span>`;
  if (r.val) return `<span class="mnInfo">${r.val}</span>`;
  if (r.act) return '';
  if (r.bind) return menu.listen === r.bind ? '<span class="mnWait">按下新按鍵…</span>' : `<span class="mnOpt"><kbd${SET.binds[r.bind] ? ' class="mine"' : ''}>${keyName(keyCur(r.bind))}</kbd></span>`;
  const D = SET_DEF[r.k], v = SET[r.k];
  if (D.o) return `<span class="mnOpt"><i data-s="-1">‹</i><em>${r.o[v]}</em><i data-s="1">›</i></span>`;
  if (typeof D.d === 'boolean') return `<span class="mnOpt"><i data-s="-1">‹</i><em>${v ? '開啟' : '關閉'}</em><i data-s="1">›</i></span>`;
  return `<span class="mnNum"><em>${r.f(v)}</em><b class="mnBar" style="--v:${((v - D.lo) / (D.hi - D.lo) * 100).toFixed(1)}%"></b></span>`;
}
function menuDraw() {
  const el = $('menu'), c = CREW[crew.cur];
  el.style.setProperty('--mc', c.col);
  setText('mnName', `${c.name} ${c.zh}`);
  setText('mnTime', `${$('clock').textContent} · ${WX[wx.cur].n} · ${$('district').textContent}`);
  setText('mnCash', money(motors.cash));
  $('mnTabs').innerHTML = TABS.map(t => `<button role="tab" data-tab="${t.id}" aria-selected="${t.id === menu.tab}">${t.n}</button>`).join('');
  const cats = menuCats();
  $('mnCats').innerHTML = cats.map((k, i) => `<li><button data-cat="${i}" class="${i === menu.cat ? (menu.focus === 'cats' ? 'sel' : 'cur') : ''}">${k.n}</button></li>`).join('');
  const rows = menuRows();
  menu.row = clamp(menu.row, 0, rows.length - 1);
  $('mnRows').innerHTML = rows.map((r, i) => {
    const cls = [menu.focus === 'rows' && i === menu.row ? 'sel' : '', r.off ? 'off' : '', r.info ? 'info' : '', r.reset ? 'reset' : ''].join(' ').trim();
    return `<li><button data-row="${i}" class="${cls}"${r.off ? ' aria-disabled="true"' : ''}><span>${r.reset ? '恢復預設值' : r.n}</span>${rowVal(r)}</button></li>`;
  }).join('');
  scrollNear($('mnRows'), $('mnRows').querySelector('.sel'));
  scrollNear($('mnCats'), $('mnCats').querySelector('.sel, .cur'));   // 窄螢幕的類別是橫向捲動的一列
  const cur = menu.focus === 'rows' ? rows[menu.row] : null;
  $('mnDesc').textContent = menu.msg || (cur ? (cur.reset ? '把這一頁的設定還原成預設值。' : cur.d || '') : '');
  const st = $('mnStat');
  st.hidden = !cats[menu.cat].stat;
  if (cats[menu.cat].stat) {
    setText('mnStatT', `${GPU.short} · 等級${GT().name} · 內部解析度 ${rtScene.width} × ${rtScene.height}${SET.res === 'auto' ? `（自動 ${Math.round(post.scale * 100)}%${detail.k < 1 ? `、細節距離 ×${detail.k.toFixed(2)}` : ''}）` : ''} · 暫停前 ${Math.round(fps)} fps`);
    st.style.setProperty('--v', clamp(fps / 60, 0, 1) * 100 + '%');
  }
}
// 只捲清單自己（scrollIntoView 會連 overflow: hidden 的外層一起捲）
function scrollNear(box, el) {
  if (!el) return;
  const b = box.getBoundingClientRect(), r = el.getBoundingClientRect();
  if (r.top < b.top) box.scrollTop -= b.top - r.top; else if (r.bottom > b.bottom) box.scrollTop += r.bottom - b.bottom;
  if (r.left < b.left) box.scrollLeft -= b.left - r.left; else if (r.right > b.right) box.scrollLeft += r.right - b.right;
}
function menuStep(r, s) {
  if (!r || !rowOn(r)) return;
  if (r.act || r.reset || r.bind) return;
  const D = SET_DEF[r.k];
  let v = SET[r.k];
  if (D.o) { const L = optList(r), i = L.indexOf(v); v = L[(Math.max(0, i) + s + L.length) % L.length]; }
  else if (typeof D.d === 'boolean') v = !v;
  else v = clamp(Math.round((v + s * D.st) / D.st) * D.st, D.lo, D.hi), v = +v.toFixed(3);
  menuSet(r.k, v);
}
function menuSet(k, v) {
  if (SET[k] === v) return;
  SET[k] = v; setSave(); setApply(k); sfx.click(); menuDraw();
}
function menuEnter(r) {
  if (!r || !rowOn(r)) return;
  menu.msg = '';
  if (r.act) { sfx.click(); r.act(); return; }
  if (r.reset) {
    if (r.reset === 'binds') { SET.binds = {}; bindsBuild(); setSave(); }
    else for (const k of r.reset) if (SET[k] !== SET_DEF[k].d) { SET[k] = SET_DEF[k].d; setApply(k); }
    setSave(); sfx.click(); menu.msg = '已恢復預設值。'; menuDraw(); return;
  }
  if (r.bind) { menu.listen = r.bind; sfx.click(); menuDraw(); return; }
  menuStep(r, 1);
}
function menuBindKey(code) {
  const k = menu.listen;
  menu.listen = null;
  if (code !== 'Escape') {
    if (KEY_NO.test(code)) menu.msg = `${keyName(code)} 另有用途，不能綁。`;
    else { const b = bindSet(k, code); sfx.click(); menu.msg = b ? `${keyName(code)} 原本是「${b.n}」，已經和它對調。` : ''; }
  }
  menuDraw();
}
function menuKey(code) {
  const rows = menuRows(), cats = menuCats();
  if (code !== 'ArrowLeft' && code !== 'ArrowRight') menu.msg = '';
  if (code === 'KeyQ' || code === 'KeyE') { const i = TABS.findIndex(t => t.id === menu.tab), n = TABS[i + (code === 'KeyE' ? 1 : -1)]; if (n) menuTab(n.id); return; }   // 不繞圈：從「設定」按 E 不會跳回地圖
  if (code === 'Escape' || code === 'Backspace') {
    if (menu.focus === 'rows') { menu.focus = 'cats'; sfx.click(); menuDraw(); } else menuClose();
    return;
  }
  if (menu.focus === 'cats') {
    if (code === 'ArrowUp' || code === 'ArrowDown') { menu.cat = (menu.cat + (code === 'ArrowUp' ? -1 : 1) + cats.length) % cats.length; menu.row = 0; sfx.click(); menuDraw(); }
    else if (code === 'Enter' || code === 'NumpadEnter' || code === 'ArrowRight') { menu.focus = 'rows'; menu.row = Math.max(0, rows.findIndex(r => !r.info && !r.off)); if (rows.every(r => r.info)) menu.row = 0; sfx.click(); menuDraw(); }
    return;
  }
  if (code === 'ArrowUp' || code === 'ArrowDown') { menu.row = (menu.row + (code === 'ArrowUp' ? -1 : 1) + rows.length) % rows.length; sfx.click(); menuDraw(); }
  else if (code === 'ArrowLeft' || code === 'ArrowRight') menuStep(rows[menu.row], code === 'ArrowLeft' ? -1 : 1);
  else if (code === 'Enter' || code === 'NumpadEnter') menuEnter(rows[menu.row]);
  else if ((code === 'Delete') && rows[menu.row] && rows[menu.row].bind) { const k = rows[menu.row].bind; if (SET.binds[k]) { bindSet(k, k); sfx.click(); } menuDraw(); }
}
function menuTab(id) {
  if (id === 'map') { menuClose(); toggleMap(true); return; }
  if (menu.tab !== id) { menu.tab = id; menu.cat = 0; menu.row = 0; menu.focus = 'cats'; }
  menu.listen = null; menu.msg = ''; sfx.click(); menuDraw();
}
function menuSave() {
  phone.msg = '';
  menu.msg = quickSave() ? '存好了。' : phone.msg || '現在不能存檔。';
  menuDraw();
}
function menuLoad() {
  menuClose();
  phone.msg = '';
  quickLoad();
  if (!fading && phone.msg) toast(phone.msg);
}

// ─── 開關 ───
function menuOpen(tab) {
  if (menu.on || !started) return;
  if (arm.wheel.open) wheelClose(false);
  if (crew.wheel.open) crewWheelClose(false);
  for (const k in keys) keys[k] = false;
  triggerUp(); gta.rmb = false;
  menu.on = true; menu.openT = performance.now(); menu.redraw = false; menu.listen = null; menu.msg = '';
  if (tab) { menu.tab = tab; menu.cat = 0; menu.row = 0; }
  menu.focus = 'cats';
  if (document.pointerLockElement) document.exitPointerLock();
  sfx.mix({ duck: true });
  menuDraw();
  $('menu').classList.add('on'); $('menu').setAttribute('aria-hidden', 'false');
}
function menuClose() {
  if (!menu.on) return;
  menu.on = false; menu.listen = null; menu.drag = null;
  sfx.mix({ duck: false });
  $('menu').classList.remove('on'); $('menu').setAttribute('aria-hidden', 'true');
  last = performance.now();
}
// 99-main.js 的 loop 在暫停時每幀呼叫：改了畫面設定才重畫一張（世界不動，只換畫法）
function menuIdle() {
  if (!menu.redraw) return;
  menu.redraw = false;
  renderFrame(0, (performance.now() - T0) / 1000);
  if (menuCats()[menu.cat].stat) menuDraw();
}
addEventListener('resize', () => { if (menu.on) menu.redraw = true; });

// Esc 在游標鎖定時會被瀏覽器拿去解除鎖定、不會傳到頁面：鎖定被解除（又不是自己解除的）就當作按了 Esc
if (document.exitPointerLock) { const ex = document.exitPointerLock.bind(document); document.exitPointerLock = () => { menu.selfExit = performance.now(); return ex(); }; }
document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement || !started || menu.on || performance.now() - menu.selfExit < 400) return;
  if (dlg.open || phone.open || fading || life.dead || $('map').classList.contains('on')) return;
  menuOpen();
});
// 失焦時暫停、切到別的分頁時靜音
addEventListener('blur', () => { if (SET.pauseBlur && started) menuOpen(); });
document.addEventListener('visibilitychange', () => {
  sfx.mix({ hidden: document.hidden });
  if (document.hidden && SET.pauseBlur && started) menuOpen();
  if (!document.hidden && menu.on) menu.redraw = true;   // 回到前景時瀏覽器可能丟掉了畫布內容，重畫背景那一幀
});

// ─── 滑鼠與觸控 ───
$('bMenu').addEventListener('click', () => { sfx.init(); menuOpen(); });
$('mnTabs').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (b) menuTab(b.dataset.tab); });
$('mnCats').addEventListener('click', e => {
  const b = e.target.closest('[data-cat]'); if (!b) return;
  const i = +b.dataset.cat;
  menu.listen = null; menu.msg = '';
  if (i !== menu.cat) { menu.cat = i; menu.row = 0; }
  const rows = menuRows();
  menu.focus = 'rows'; menu.row = Math.max(0, rows.findIndex(r => !r.info && !r.off));
  sfx.click(); menuDraw();
});
const mnRows = $('mnRows');
mnRows.addEventListener('pointermove', e => {
  if (e.pointerType !== 'mouse' || menu.drag || menu.listen) return;
  const b = e.target.closest('[data-row]'); if (!b) return;
  const i = +b.dataset.row;
  if (menu.focus !== 'rows' || menu.row !== i) { menu.focus = 'rows'; menu.row = i; menu.msg = ''; menuDraw(); }
});
// 滑桿：在數值區按下就跟著指標設定、可以拖
function sliderAt(e, k) {
  const bar = mnRows.querySelector(`[data-row="${menu.row}"] .mnBar`); if (!bar) return;
  const r = bar.getBoundingClientRect(), D = SET_DEF[k];
  const t = clamp((e.clientX - r.left) / r.width, 0, 1);
  menuSet(k, +clamp(Math.round((D.lo + t * (D.hi - D.lo)) / D.st) * D.st, D.lo, D.hi).toFixed(3));
}
mnRows.addEventListener('pointerdown', e => {
  const b = e.target.closest('[data-row]'); if (!b) return;
  const i = +b.dataset.row, r = menuRows()[i], D = r && r.k && SET_DEF[r.k];
  if (!r || !rowOn(r) || !D || D.o || typeof D.d === 'boolean' || !e.target.closest('.mnNum')) return;
  e.preventDefault();
  menu.focus = 'rows'; menu.row = i; menu.msg = ''; menu.listen = null; menuDraw();
  menu.drag = { id: e.pointerId, k: r.k }; mnRows.setPointerCapture(e.pointerId); sliderAt(e, r.k);
});
// 其他列用 click（觸控捲動清單時不會誤觸）：點 ‹ › 調整，點列本身是 Enter
mnRows.addEventListener('click', e => {
  const b = e.target.closest('[data-row]'); if (!b || e.target.closest('.mnNum')) return;
  const i = +b.dataset.row, r = menuRows()[i];
  if (menu.listen) { menu.listen = null; menuDraw(); return; }
  menu.focus = 'rows'; menu.row = i; menu.msg = '';
  const s = e.target.closest('[data-s]');
  if (s && rowOn(r)) menuStep(r, +s.dataset.s); else if (rowOn(r)) menuEnter(r);
  if (menu.on) menuDraw();
});
mnRows.addEventListener('pointermove', e => { if (menu.drag && menu.drag.id === e.pointerId) sliderAt(e, menu.drag.k); });
const mnDragEnd = e => { if (menu.drag && menu.drag.id === e.pointerId) menu.drag = null; };
mnRows.addEventListener('pointerup', mnDragEnd); mnRows.addEventListener('pointercancel', mnDragEnd);
$('mnKeys').addEventListener('click', e => { const b = e.target.closest('[data-k]'); if (b) menuKey(b.dataset.k); });
$('menu').addEventListener('contextmenu', e => e.preventDefault());
