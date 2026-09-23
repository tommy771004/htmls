# 005 — 預覽與「弱點自評」對話框的進出場

- **Status**: DONE
- **Commit**: d37c05f
- **Severity**: MEDIUM
- **Category**: Missed opportunities（空間連續性）＋ Interruptibility
- **Estimated scope**: 1 個檔案（`index.html`），約 10 行 CSS + 30 行 JS 修改
- **Depends on**: 001

## Problem

全螢幕預覽（`#pv`）與弱點自評對話框（`#critModal`）只靠 `hidden` 屬性開關，出現與消失都是瞬間跳切，看不出畫面從哪裡來、到哪裡去。這是站上最常用的互動之一（每次點卡片、「隨機一件」都會開預覽）。

```css
/* index.html:214 */
[hidden]{display:none!important}
/* index.html:340-341 */
.overlay{position:fixed;inset:0;z-index:50;background:var(--scrim);display:flex;align-items:center;justify-content:center;padding:16px}
.dialog{width:100%;max-width:720px;max-height:88vh;display:flex;flex-direction:column;background:var(--surface);color:var(--text);border-radius:22px;box-shadow:var(--shadow);overflow:hidden}
/* index.html:363 */
.pv{position:fixed;inset:0;z-index:60;display:flex;flex-direction:column;background:var(--bg)}
/* index.html:385 */
.bezel iframe{position:absolute;inset:0;width:100%;height:100%;border:0;background:#fff}
```

```js
/* index.html:827-838 — current */
var lastFocus = null;
function openPreview(id, push){
  var w = byId[id]; if (!w) return;
  if (!state.current) lastFocus = document.activeElement;
  state.current = id;
  $('pv').hidden = false; document.body.style.overflow = 'hidden';
  $('pvLoading').classList.remove('done');
  $('pvFrame').src = w.file;
  syncPreviewMeta();
  if (push !== false) { try { history.replaceState(null, '', '#'+id); } catch(e){} }
  $('pvClose').focus({preventScroll:true});
}
```

```js
/* index.html:853-860 — current */
function closePreview(){
  if (!state.current) return;
  state.current = null; $('pv').hidden = true; document.body.style.overflow = '';
  $('pvFrame').src = 'about:blank';
  document.title = BASE_TITLE;
  try { history.replaceState(null, '', location.pathname + location.search); } catch(e){}
  if (lastFocus && lastFocus.focus) lastFocus.focus({preventScroll:true});
}
```

```js
/* index.html:875-877 — current */
function openModal(id){ lastFocus = document.activeElement; $(id).hidden = false; document.body.style.overflow = 'hidden'; var c = $(id).querySelector('[data-close]'); if (c) c.focus({preventScroll:true}); }
function closeModal(id){ $(id).hidden = true; if (!state.current) document.body.style.overflow = ''; if (lastFocus && lastFocus.focus) lastFocus.focus({preventScroll:true}); }
function anyModal(){ return !$('critModal').hidden ? 'critModal' : null; }
```

## Target

**進場**用 `@starting-style`（元素從 `display:none` 變成顯示時，從這個狀態過場到正常狀態）；**退場**用 `.out` class 播完再設 `hidden`。

| 元素 | 進場 | 退場 |
| --- | --- | --- |
| `.overlay`（遮罩） | opacity 0 → 1，220ms `--ease-out` | → 0，150ms |
| `.dialog`（對話框本體） | opacity 0 → 1、`scale(.96)` → 1，220ms `--ease-out`，從中心縮放（modal 置中，從中心是正確的） | → 0、`scale(.96)`，150ms |
| `.pv`（全螢幕預覽） | opacity 0 → 1、`scale(.98)` → 1，220ms `--ease-out` | → 0、`scale(.98)`，150ms |

重要行為：

- 在預覽裡按 ←/→ 或 R 切換作品**不播進場動畫**。因為 `#pv` 已經在顯示中，`@starting-style` 自然不會再觸發——**不要**額外加旗標或判斷。
- 瀏覽器不支援 `@starting-style` 時，預覽與對話框會瞬間出現（跟現在一樣），內容永遠看得到。這是刻意的保底。
- **競態**：按 Esc 關閉後 150ms 內又點了另一張卡片，尚未觸發的「隱藏」計時器必須被取消，否則會把剛打開的預覽藏起來。
- **白色閃光**：`closePreview` 目前立刻把 iframe 設成 `about:blank`，而 iframe 背景是 `#fff`，深色主題下退場時會看到白色矩形淡出。要把 `about:blank` 移到退場結束後。
- **進場卡頓**：第一次開預覽時，作品（很多是 canvas/WebGL）會在同一瞬間開始載入，搶走主執行緒讓 220ms 的進場掉幀。第一次打開時延後 220ms 才設定 iframe `src`；←/→ 切換時照舊立即設定。

## Repo conventions to follow

- ES5 JS（`var`、`function`），`$('id')` 取元素。
- CSS 一行一條規則。對話框樣式在 `/* ---------- dialog ---------- */`（:339 起），預覽在 `/* ---------- preview ---------- */`（:362 起）。

## Steps

1. **CSS — 對話框**。把 :340 `.overlay{...}` 的大括號結尾改為 `...;padding:16px;transition:opacity var(--dur-enter) var(--ease-out)}`。把 :341 `.dialog{...}` 結尾改為 `...;overflow:hidden;transition:opacity var(--dur-enter) var(--ease-out),transform var(--dur-enter) var(--ease-out)}`。在 :341 之後插入：

```css
.overlay.out{opacity:0;pointer-events:none;transition-duration:var(--dur-exit)}
.overlay.out .dialog{opacity:0;transform:scale(.96);transition-duration:var(--dur-exit)}
```

2. **CSS — 預覽**。把 :363 `.pv{...}` 結尾改為 `...;background:var(--bg);transition:opacity var(--dur-enter) var(--ease-out),transform var(--dur-enter) var(--ease-out)}`。在 :363 之後插入：

```css
.pv.out{opacity:0;transform:scale(.98);pointer-events:none;transition-duration:var(--dur-exit)}
```

3. **CSS — 進場起始狀態**。在 `.toast.show{...}` 那行（:414）之後、reduced-motion 區塊之前插入（必須放在 `.overlay`、`.dialog`、`.pv` 規則**之後**才會生效）：

```css
@starting-style{.overlay{opacity:0}.overlay .dialog{opacity:0;transform:scale(.96)}.pv{opacity:0;transform:scale(.98)}}
```

4. **CSS — reduced-motion**。在 reduced-motion 區塊內加入（保留淡入淡出、移除縮放）：

```css
  .overlay.out .dialog,.pv.out{transform:none}
  @starting-style{.overlay .dialog,.pv{transform:none}}
```

5. **JS — 預覽**。把 :827–838 替換為：

```js
var lastFocus = null, pvHideT = null, pvSrcT = null;
function openPreview(id, push){
  var w = byId[id]; if (!w) return;
  var first = !state.current, pv = $('pv');
  if (first) lastFocus = document.activeElement;
  clearTimeout(pvHideT); clearTimeout(pvSrcT); pv.classList.remove('out');
  state.current = id;
  pv.hidden = false; document.body.style.overflow = 'hidden';
  $('pvLoading').classList.remove('done');
  // 第一次打開時等進場動畫播完才載入作品，避免作品啟動時搶走主執行緒造成掉幀
  if (first) pvSrcT = setTimeout(function(){ $('pvFrame').src = w.file; }, 220);
  else $('pvFrame').src = w.file;
  syncPreviewMeta();
  if (push !== false) { try { history.replaceState(null, '', '#'+id); } catch(e){} }
  $('pvClose').focus({preventScroll:true});
}
```

6. **JS — 關閉預覽**。把 :853–860 替換為：

```js
function closePreview(){
  if (!state.current) return;
  state.current = null; clearTimeout(pvSrcT);
  var pv = $('pv'); pv.classList.add('out');
  pvHideT = setTimeout(function(){
    pv.hidden = true; pv.classList.remove('out');
    $('pvFrame').src = 'about:blank';
    if (!state.current && !anyModal()) document.body.style.overflow = '';
  }, 150);
  document.title = BASE_TITLE;
  try { history.replaceState(null, '', location.pathname + location.search); } catch(e){}
  if (lastFocus && lastFocus.focus) lastFocus.focus({preventScroll:true});
}
```

7. **JS — 對話框**。把 :875–877 替換為：

```js
var modalHideT = {};
function openModal(id){ var m = $(id); clearTimeout(modalHideT[id]); m.classList.remove('out'); lastFocus = document.activeElement; m.hidden = false; document.body.style.overflow = 'hidden'; var c = m.querySelector('[data-close]'); if (c) c.focus({preventScroll:true}); }
function closeModal(id){
  var m = $(id); if (m.hidden || m.classList.contains('out')) return;
  m.classList.add('out');
  modalHideT[id] = setTimeout(function(){ m.hidden = true; m.classList.remove('out'); if (!state.current) document.body.style.overflow = ''; }, 150);
  if (lastFocus && lastFocus.focus) lastFocus.focus({preventScroll:true});
}
function anyModal(){ var m = $('critModal'); return !m.hidden && !m.classList.contains('out') ? 'critModal' : null; }
```

8. 其餘呼叫點（`step`、`hashchange`、`data-crit-open` 在 :925、Esc 處理在 :957–961）**不需修改**。

## Boundaries

- 不要把 `[hidden]{display:none!important}`（:214）改掉或移除——`!important` 會壓過 `transition-behavior: allow-discrete`，所以本計畫刻意不用 display 過場，而是用 `.out` + 計時器。
- 不要加任何「是否第一次開啟」的旗標給 CSS；進場只靠 `@starting-style`。
- 不要改 `.bezel iframe` 的背景色、`step()`、`syncPreviewMeta()`。
- 不要用 JS 或 IntersectionObserver 把內容預設藏起來。
- 若程式碼與摘錄不符，停下回報。

## Verification

- **Mechanical**：Chrome（≥117）開 `index.html`，Console 無錯誤。依序測：點卡片開預覽 → Esc 關；「弱點自評」開 → Esc 關；自評內點「預覽」（會關對話框並開預覽）；網址帶 `#042` 直接載入。全部正常，焦點回到觸發按鈕。
- **Feel check**：
  - 點卡片：預覽從 98% 淡入放大到滿版，約 0.2 秒，起步就快；作品在動畫結束後才開始載入（先看到「載入中…」）。
  - 在預覽中連按 → 十次：**沒有**任何進場動畫重播，只有 iframe 內容切換。
  - Esc 關閉：預覽較快地淡出縮小；**深色主題下不會看到白色矩形**。
  - Esc 後立刻（150ms 內）點另一張卡片：新預覽正常打開，不會一閃就消失。
  - 開自評對話框：遮罩淡入，對話框從 96% 放大；點遮罩空白處關閉時較快退場，退場中點不到遮罩後面的東西也不會出錯。
  - 在 091、069 號作品上開預覽，確認進場不掉幀。
  - Animations 面板 10%：對話框從中心縮放，沒有從 `scale(0)` 出現；退場比進場短。
  - Emulate reduced-motion：只剩淡入淡出，沒有縮放。
- **Done when**：兩個對話層都有 220ms 進場 / 150ms 退場、←/→ 不觸發進場、無白閃、快速開關不出錯。
