# 008 — 收藏時愛心輕彈

- **Status**: DONE
- **Commit**: d37c05f
- **Severity**: LOW
- **Category**: Missed opportunities（回饋）
- **Estimated scope**: 1 個檔案（`index.html`），約 2 行 CSS + 10 行 JS
- **Depends on**: 001

## Problem

按下收藏時，愛心只是瞬間從空心變實心，沒有任何確認感（只有底部的 toast）。

陷阱：`toggleFav` 會呼叫 `render()`，它用 `innerHTML` 重建**所有**卡片與按鈕。如果直接寫「`.mini.on .ico` 播放動畫」的 CSS，之後每一次篩選、搜尋、排序，所有已收藏的愛心都會一起彈一次。所以必須用 JS，只對**剛被按下的那一顆**加上一次性的 class。

```js
/* index.html:818-824 — current */
function toggleFav(id){
  if (!byId[id]) return;
  if (state.favs.has(id)) { state.favs.delete(id); toast('已取消收藏 '+id); }
  else { state.favs.add(id); toast('已收藏 '+id); }
  save('favs', Array.from(state.favs));
  render();
}
```

愛心按鈕有兩種來源：

- 卡片與列表中的 `.mini[data-fav="ID"]`（由 `favBtn()` 產生，:765–768），`render()` 後是**全新的元素**。
- 預覽標題列的 `#pvFav`（:628），它**不會被重建**，由 `syncPreviewMeta()`（:846–848）切換 class。

## Target

- 只在**加入**收藏時彈，取消收藏不彈（避免連按時一直播）。
- 彈跳：`scale(.8)` → `scale(1.15)` → `scale(1)`，300ms，每段用 `var(--ease-out)`；作用在按鈕內的 `<svg class="ico">`（預設 transform-origin 為中心）。

```css
/* target */
@keyframes heartpop{0%{transform:scale(.8)}50%{transform:scale(1.15)}100%{transform:scale(1)}}
.ico.pop{animation:heartpop 300ms var(--ease-out)}
```

## Repo conventions to follow

- ES5 JS。收藏邏輯在 `// ---------- favorites ----------`（:817 起）。

## Steps

1. 在控制項區塊 `.weak{...}`（:232）之前插入 Target 中的兩行 CSS。
2. 把 :818–824 替換為：

```js
function popHeart(btn){
  var ico = btn && btn.querySelector('.ico'); if (!ico) return;
  ico.classList.remove('pop'); void ico.getBoundingClientRect(); ico.classList.add('pop');
  ico.addEventListener('animationend', function(){ ico.classList.remove('pop'); }, {once:true});
}
function toggleFav(id){
  if (!byId[id]) return;
  var added = !state.favs.has(id);
  if (added) { state.favs.add(id); toast('已收藏 '+id); }
  else { state.favs.delete(id); toast('已取消收藏 '+id); }
  save('favs', Array.from(state.favs));
  render();
  // render() 會重建卡片，所以要在它之後重新找按鈕；只彈剛按下的那一顆
  if (added) {
    popHeart(document.querySelector('#results [data-fav="'+id+'"]'));
    if (state.current === id) popHeart($('pvFav'));
  }
}
```

3. 在 reduced-motion 區塊內加入：`  .ico.pop{animation:none}`

## Boundaries

- 不要在 CSS 裡對 `.on` 狀態掛動畫。
- 不要改 `favBtn()`、`syncPreviewMeta()`、分類列的「收藏」愛心。
- 不要加粒子、光暈或顏色閃爍。
- 若程式碼與摘錄不符，停下回報。

## Verification

- **Mechanical**：Chrome 開 `index.html`，Console 無錯誤。
- **Feel check**：
  - 點卡片上的空心愛心：愛心先縮一下再彈起定位，約 0.3 秒；其他已收藏的愛心**不動**。
  - 收藏後點別的分類或打字搜尋：沒有任何愛心再彈。
  - 取消收藏：不彈。
  - 預覽中按 `F`：標題列的愛心彈一次；若該作品卡片在背後網格裡，那一顆也同步彈（看不到沒關係）。
  - Animations 面板 10%：縮放以愛心中心為原點，沒有偏移。
  - Emulate reduced-motion：不彈，只換成實心。
- **Done when**：只有剛加入收藏的那一顆愛心彈、重新渲染不重播、reduced-motion 下不播。
