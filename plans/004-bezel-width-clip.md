# 004 — 預覽寬度切換：以 clip-path 取代 max-width 過場

- **Status**: DONE
- **Commit**: d37c05f
- **Severity**: MEDIUM
- **Category**: Performance（並修正 Easing）
- **Estimated scope**: 1 個檔案（`index.html`），約 1 行 CSS + 25 行 JS
- **Depends on**: 001

## Problem

預覽時切換「桌機／平板／手機」寬度，是用 `max-width` 做 250ms 的 `ease` 過場：

```css
/* index.html:381-384 — current */
.bezel{position:relative;width:100%;height:100%;background:var(--surface);overflow:hidden;transition:max-width .25s ease}
@media (min-width:640px){.bezel{border-radius:16px;box-shadow:var(--frame-shadow)}}
.bezel.tablet{max-width:768px}
.bezel.mobile{max-width:390px}
```

```js
/* index.html:867-871 — current */
function setDevice(d){
  state.device = d;
  var b = $('bezel'); b.classList.toggle('tablet', d === 'tablet'); b.classList.toggle('mobile', d === 'mobile');
  document.querySelectorAll('[data-dev]').forEach(function(x){ x.setAttribute('aria-pressed', x.getAttribute('data-dev') === d); });
}
```

兩個問題：

1. **效能與畫面正確性**：`max-width` 是版面屬性，裡面的 iframe 在 250ms 內每一幀都被改變寬度，每一幀都對作品觸發 `resize`。至少 39 件作品的 resize 處理器沒有防抖，例如 `045-paper-layers.html:402`（每次都 `resetParticles()`）、`086-deep-sea.html:378`（每次都 `size();seed();`）、`091-dither-3d.html:506`、`100-fireworks.html:406`。設定 canvas 寬度會清空畫布，所以切換寬度時這些作品會連續閃爍或重置十幾次。
2. **緩動**：畫面上的形變應使用強 ease-in-out，而不是預設 `ease`。

## Target

iframe 寬度在每次切換時**只改變一次**。視覺上的收合／展開改由 `.bezel` 的 `clip-path` 動畫表現（不觸發版面重排、不送 resize 給作品）：

- **變寬**（例：手機 → 桌機）：立刻套用新寬度（iframe 只 resize 一次），再把 `clip-path` 從「舊寬度」展開到全寬。
- **變窄**（例：桌機 → 手機）：先保持舊寬度，把 `clip-path` 從全寬收到「新寬度」，動畫結束的同一個 task 內才套用新寬度並移除 clip。
- 時長 280ms，曲線 `cubic-bezier(0.77, 0, 0.175, 1)`（即 `--ease-in-out`）。
- reduced-motion：不做動畫，直接套用。
- JS 裡的 `280` 與 `cubic-bezier(0.77, 0, 0.175, 1)` 就是 001 的 `--dur-morph` 與 `--ease-in-out`（WAAPI 不能直接讀 CSS 變數）。改其中一邊時，另一邊也要同步改。
- 連點：新的一次點擊會取消進行中的動畫，並先完成它尚未套用的寬度，再開始新的。

## Repo conventions to follow

- JS 是 ES5 風格（`var`、`function`，不用箭頭函式或 `let`），見 :650–986。取元素用 `$('id')`（:700）。
- 預覽相關函式集中在 `// ---------- preview ----------`（:826 起）。

## Steps

1. :381 從 `.bezel{...}` 刪除 `;transition:max-width .25s ease`（刪掉後結尾是 `overflow:hidden}`）。
2. 把 :867–871 的 `setDevice` 整個替換為：

```js
var DEV_W = {tablet:768, mobile:390}, bezelAnim = null, bezelApply = null;
function devWidth(d, b){
  var st = b.parentNode, cs = getComputedStyle(st);
  var full = st.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  return d === 'desktop' ? full : Math.min(DEV_W[d], full);
}
function setDevice(d){
  var b = $('bezel');
  // 連點：取消進行中的動畫，先補上它還沒套用的寬度
  if (bezelAnim) { bezelAnim.onfinish = null; bezelAnim.cancel(); bezelAnim = null; }
  if (bezelApply) { bezelApply(); bezelApply = null; }
  document.querySelectorAll('[data-dev]').forEach(function(x){ x.setAttribute('aria-pressed', x.getAttribute('data-dev') === d); });
  var apply = function(){ state.device = d; b.classList.toggle('tablet', d === 'tablet'); b.classList.toggle('mobile', d === 'mobile'); };
  var from = b.getBoundingClientRect().width, to = devWidth(d, b), gap = Math.abs(from - to) / 2;
  if (gap < 1 || !b.animate || matchMedia('(prefers-reduced-motion: reduce)').matches) { apply(); return; }
  var r = getComputedStyle(b).borderTopLeftRadius;
  var open = 'inset(0 0 round '+r+')', shut = 'inset(0 '+gap+'px round '+r+')';
  var opts = {duration:280, easing:'cubic-bezier(0.77, 0, 0.175, 1)'};
  if (to > from) {
    apply();
    bezelAnim = b.animate([{clipPath:shut},{clipPath:open}], opts);
    bezelAnim.onfinish = function(){ bezelAnim = null; };
  } else {
    opts.fill = 'forwards';
    bezelApply = apply;
    bezelAnim = b.animate([{clipPath:open},{clipPath:shut}], opts);
    bezelAnim.onfinish = function(){ var a = bezelAnim; bezelAnim = null; bezelApply = null; apply(); a.cancel(); };
  }
}
```

3. 在 reduced-motion 區塊內**不需要**加 CSS（JS 已判斷 `prefers-reduced-motion`）。

## Boundaries

- 不要修改任何作品檔（`0xx-*.html`）的 resize 處理器——這個計畫的目的就是讓首頁不再狂送 resize 給它們。
- 不要改 `.bezel.tablet` / `.bezel.mobile` 的寬度值，也不要改 `.pv-dev` 按鈕的 HTML。
- 不要改成動畫 `width`、`max-width`、`transform: scale()`（scale 會把作品內容壓扁）。
- 若程式碼與摘錄不符，停下回報。

## Verification

- **Mechanical**：Chrome 以 ≥1024px 寬度開 `index.html`，Console 無錯誤。打開 100 號作品預覽，在 DevTools Console 左上角的 context 下拉選單切到 iframe（`100-fireworks.html`），執行 `var n=0; addEventListener('resize',function(){n++})`，接著切換桌機 → 手機 → 桌機，再讀 `n`：應為 **2**（每次切換一次）。改動前會明顯大於 2。
- **Feel check**：
  - 桌機 → 手機：框從兩側向中間收攏，最後內容以 390px 重新排版；過程中作品不閃爍、不重置。
  - 手機 → 桌機：作品先以全寬排版一次，框從中間向兩側展開。
  - 在 045、086、091、100 號作品上各試一次，確認動畫期間畫面不閃白、粒子不重置。
  - 在收合到一半時點另一個寬度：不跳回、不卡住，最終寬度正確。
  - 淺色主題下 `.bezel` 有細陰影（`--frame-shadow`），動畫期間陰影會被 clip 暫時切掉——若看起來刺眼，回報（可接受的取捨）。
  - Animations 面板 10%：收合/展開是對稱的 ease-in-out，起步與結尾都柔和。
  - Emulate reduced-motion：寬度直接切換，沒有動畫。
- **Done when**：iframe 每次切換只 resize 一次、視覺以 clip-path 280ms `cubic-bezier(0.77, 0, 0.175, 1)` 表現、連點不出錯。
