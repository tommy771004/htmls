# 009 — 排序圖示翻轉，而不是換圖

- **Status**: DONE
- **Commit**: d37c05f
- **Severity**: LOW
- **Category**: Missed opportunities（狀態變化）
- **Estimated scope**: 1 個檔案（`index.html`），約 2 行 CSS + 3 行 JS/HTML
- **Depends on**: 001

## Problem

點排序按鈕時，箭頭圖示從 ↑ 直接換成 ↓（換 `<use href>`），沒有表達「順序反過來了」。

```html
<!-- index.html:463 — current -->
<button class="btn" id="btnSort"><svg class="ico" id="sortIco"><use href="#i-up"/></svg><span id="sortLbl">001 → 100</span></button>
```

```js
/* index.html:748 — current */
  $('sortIco').querySelector('use').setAttribute('href', state.sort === 'asc' ? '#i-up' : '#i-down');
```

```js
/* index.html:941 — current */
$('btnSort').addEventListener('click', function(){ state.sort = state.sort === 'asc' ? 'desc' : 'asc'; save('sort', state.sort); render(); });
```

## Target

- 永遠顯示 `#i-up`，降序時把整個 `<svg>` 旋轉 180°。
- 200ms，`var(--ease-in-out)`（在畫面上的形變），`transform-origin:center`。
- **只有點擊時才過場**：頁面載入時如果記住的排序是降序，箭頭要直接是朝下，不能在載入時轉一圈。做法是只在按鈕被點過之後（`data-anim` 屬性）才掛上 transition。

```css
/* target */
.btn.desc .sort-ico{transform:rotate(180deg)}
.btn[data-anim] .sort-ico{transform-origin:center;transition:transform 200ms var(--ease-in-out)}
```

## Repo conventions to follow

- 控制項樣式在 :216–232。ES5 JS。

## Steps

1. :463 把 `<svg class="ico" id="sortIco">` 改為 `<svg class="ico sort-ico" id="sortIco">`（`<use href="#i-up"/>` 保持不變）。
2. 在 `.mini.on,.mini.on:hover{...}`（:231）之後插入 Target 中的兩行 CSS。
3. :748 整行替換為：`  $('btnSort').classList.toggle('desc', state.sort === 'desc');`
4. :941 改為：`$('btnSort').addEventListener('click', function(){ this.setAttribute('data-anim', ''); state.sort = state.sort === 'asc' ? 'desc' : 'asc'; save('sort', state.sort); render(); });`
5. 在 reduced-motion 區塊內加入：`  .btn[data-anim] .sort-ico{transition:none}`

## Boundaries

- 不要動 `#sortLbl` 的文字與 `btnSort.title` 的邏輯（:747、:749）。
- 不要刪除 `#i-down` symbol（:425），可能有其他用途。
- 若程式碼與摘錄不符，停下回報。

## Verification

- **Mechanical**：Chrome 開 `index.html`，Console 無錯誤。
- **Feel check**：
  - 點排序：箭頭順暢轉半圈朝下，標籤變成「102 → 001」；再點轉回朝上。
  - 快速連點 5 次：箭頭從目前角度接續轉，不會跳回起點重播。
  - 設成降序後重新整理：箭頭直接朝下，**載入時不轉**。
  - Animations 面板 10%：以圖示中心旋轉，沒有偏移。
  - Emulate reduced-motion：直接翻轉，沒有旋轉過程。
- **Done when**：旋轉 200ms ease-in-out、載入不轉、reduced-motion 下無過程。
