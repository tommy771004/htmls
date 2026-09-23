# 006 — 主題切換整頁同步淡換

- **Status**: DONE
- **Commit**: d37c05f
- **Severity**: LOW
- **Category**: Cohesion & tokens（切換時不同步）＋ Missed opportunities
- **Estimated scope**: 1 個檔案（`index.html`），約 3 行 CSS + 12 行 JS
- **Depends on**: 001

## Problem

切換淺色／深色時，`body` 的底色與文字色是瞬間換掉的，但 `.btn`、`.iconbtn`、`.seg button`、`.cat`、`.mini`、`.card`、`.search input` 都有 150ms 的 `background-color` 過場（見 :217–286）。結果是頁面先換色，按鈕與卡片晚 150ms 才跟上，會短暫出現「深底配淺卡片」的錯配閃爍。

```css
/* index.html:199 — body 沒有過場，瞬間換色 */
body{margin:0;background:var(--bg);color:var(--text);...}
/* index.html:286 — 卡片有過場，延遲跟上 */
.card{...;background:var(--card);...;transition:background-color var(--dur-hover)}
```

```js
/* index.html:721-727 — current */
function applyTheme(t){
  document.documentElement.setAttribute('data-theme', t);
  var m = document.querySelector('meta[name="theme-color"]');
  if (m) m.setAttribute('content', t === 'dark' ? '#141412' : '#f6f5f1');
  document.querySelectorAll('[data-theme-set]').forEach(function(b){ b.setAttribute('aria-pressed', b.getAttribute('data-theme-set') === t); });
}
function setTheme(t){ save('theme', t); applyTheme(t); }
```

## Target

- 使用者點主題按鈕時，整頁以 **200ms、`ease`**（顏色變化用 `ease`）一起淡換，使用 View Transitions API（`document.startViewTransition`）。
- **無論瀏覽器是否支援 View Transitions**，在切換的那一刻都要暫停所有 CSS 過場（`.no-trans`），否則在 view transition 的即時畫面裡，按鈕仍會自己再慢 150ms。
- 不支援 View Transitions 的瀏覽器：瞬間同步換色（沒有錯配），兩幀後恢復過場。
- 系統主題改變（`onSystem`，:730）與頁面載入時的 `applyTheme`（:733）**不動畫**，只有使用者點擊的 `setTheme` 會。
- 這個淡換只有透明度，reduced-motion 下也保留（不是位移）。

```css
/* target */
.no-trans,.no-trans *,.no-trans *::before,.no-trans *::after{transition:none!important}
::view-transition-old(root),::view-transition-new(root){animation-duration:200ms;animation-timing-function:ease}
```

## Repo conventions to follow

- ES5 JS。主題程式在 `// ---------- theme ----------`（:720 起）。
- 全域工具 class（例如 `.sr`、`.hide-sm`）放在 :208–214 附近。

## Steps

1. 在 `[hidden]{display:none!important}`（:214）之後插入 Target 中的兩行 CSS。
2. 把 :727 的 `setTheme` 替換為：

```js
function setTheme(t){
  save('theme', t);
  var root = document.documentElement;
  if (root.getAttribute('data-theme') === t) { applyTheme(t); return; }
  // 切換當下暫停所有過場，避免按鈕與卡片比底色晚 150ms 才換色
  var run = function(){ root.classList.add('no-trans'); applyTheme(t); };
  var end = function(){ root.classList.remove('no-trans'); };
  if (document.startViewTransition) document.startViewTransition(run).finished.then(end, end);
  else { run(); requestAnimationFrame(function(){ requestAnimationFrame(end); }); }
}
```

## Boundaries

- 不要改 `applyTheme`、`onSystem`、`<head>` 裡的初始主題腳本（:145–153）。
- 不要做圓形擴散、滑動遮罩之類的主題切換特效——這是一個次要控制項，200ms 同步淡換就夠。
- 不要把 `.no-trans` 用在其他地方。
- 若程式碼與摘錄不符，停下回報。

## Verification

- **Mechanical**：Chrome 開 `index.html`，Console 無錯誤。點淺色／深色切換 10 次，`<html>` 最後不應殘留 `no-trans` class（Elements 面板確認）。Firefox（若不支援 View Transitions）也測一次，應瞬間同步換色。
- **Feel check**：
  - 點深色：整頁一起在 0.2 秒內淡換，**看不到任何卡片或按鈕比底色慢一步**。
  - Animations 面板 10%：看得到 `::view-transition` 的交叉淡入淡出，卡片沒有第二段顏色過場。
  - 切換後 hover 卡片，背景過場恢復正常（證明 `no-trans` 已移除）。
  - 更改作業系統深淺模式（且未手動選過主題時）：頁面直接換色，不動畫。
- **Done when**：主題切換同步、無殘留 class、hover 過場正常。
