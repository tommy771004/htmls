# 007 — 首次載入時卡片依序落定

- **Status**: DONE
- **Commit**: d37c05f
- **Severity**: LOW
- **Category**: Missed opportunities（很少發生的時刻，可以花一點愉悅預算）＋ Cohesion（stagger）
- **Estimated scope**: 1 個檔案（`index.html`），約 3 行 CSS + 4 行 JS
- **Depends on**: 001

## Problem

首頁載入時 100 張卡片一次全部出現，沒有任何進場。首次載入一個訪客只會經歷一次，是可以放一點動畫的時刻。

```js
/* index.html:775-776 — current（已經拿得到索引 i） */
function cardHTML(w, i){
  return '<article class="card">'+
```

```js
/* index.html:807-815 — current */
function render(){
  var list = filtered();
  renderControls(); renderCats(); renderStatus(list);
  var r = $('results');
  if (!list.length) r.innerHTML = emptyHTML();
  else if (state.view === 'table') r.innerHTML = tableHTML(list);
  else r.innerHTML = '<div class="grid">'+list.map(cardHTML).join('')+'</div>';
  if (state.current) syncPreviewMeta();
}
```

## Target

- **只做位移，完全不動透明度**：卡片從 `translateY(12px)` 落到 0。**不要**加 `opacity:0`。就算動畫沒有執行（背景分頁、截圖、動畫被節流），卡片也永遠看得到。這是硬性規定。
- 每張間隔 40ms，索引上限 8（最大延遲 320ms），首屏以外的卡片不會拖更久。
- 時長 400ms，`var(--ease-out)`（首次載入屬於少見時刻，可以比一般 UI 的 300ms 上限長一點）。
- **只在第一次渲染時播**。篩選、搜尋、排序、切換檢視、收藏引起的重新渲染**一律不播**。搜尋每打一個字就重畫一次，每次都播會非常煩。
- 動畫期間卡片可以正常點擊（stagger 不能擋住互動）。

```css
/* target */
@keyframes settle{from{transform:translateY(12px)}}
.grid.intro .card{animation:settle 400ms var(--ease-out) backwards;animation-delay:calc(var(--i) * 40ms)}
```

## Repo conventions to follow

- 卡片樣式在 `/* ---------- grid ---------- */`（:281 起）。
- ES5 JS，HTML 用字串串接產生。

## Steps

1. 在 `.card:hover{background:var(--fill)}`（:287）之後插入 Target 中的兩行 CSS。
2. :776 改為：`return '<article class="card" style="--i:'+Math.min(i, 8)+'">'+`
3. 在 `function render(){`（:807）的正上方插入一行：`var introDone = false;`
4. 把 :813 `else r.innerHTML = '<div class="grid">'+list.map(cardHTML).join('')+'</div>';` 改為：

```js
  else r.innerHTML = '<div class="grid'+(introDone ? '' : ' intro')+'">'+list.map(cardHTML).join('')+'</div>';
  introDone = true;
```

（注意：`introDone = true;` 放在 if/else 鏈**之後**，不論這次畫的是網格、表格或空狀態都設為 true，確保之後切回網格也不會播。）

5. 在 reduced-motion 區塊內加入：`  .grid.intro .card{animation:none}`

## Boundaries

- 不要給卡片任何初始 `opacity:0` 或 `visibility:hidden`。
- 不要用 IntersectionObserver 或捲動觸發進場。
- 不要動 `tableHTML`（列表檢視不做）。
- 不要加 hover 時的卡片位移。
- 若程式碼與摘錄不符，停下回報。

## Verification

- **Mechanical**：Chrome 開 `index.html`，Console 無錯誤。用 DevTools 把 CPU 降速 6×，重新整理：卡片全程可見。在載入後 50ms 截圖（Performance 面板的截圖列）：所有卡片都看得到，只是位置略低。
- **Feel check**：
  - 重新整理：前兩列卡片由左上往右下依序輕輕落定，整體在約 0.7 秒內結束。
  - 點分類、打字搜尋、切排序、切網格/列表再切回：卡片**不再**有任何進場。
  - 動畫期間立刻點第一張卡片：預覽正常打開。
  - Animations 面板 10%：只有位移，沒有淡入。
  - Emulate reduced-motion：卡片直接出現在原位。
- **Done when**：只有首次網格渲染播放、只動 transform、reduced-motion 下不播。
