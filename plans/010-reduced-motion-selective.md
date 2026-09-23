# 010 — 減少動態：從「全部歸零」改為「只拿掉位移」

- **Status**: DONE
- **Commit**: d37c05f
- **Severity**: MEDIUM
- **Category**: Accessibility
- **Estimated scope**: 1 個檔案（`index.html`），刪 1 行、檢查約 10 行
- **Depends on**: 001–009 全部完成後才做（最後一個）

## Problem

目前的減少動態規則把**所有**過場與動畫縮成 0.01ms：

```css
/* index.html:415（原始 commit 的行號，001–009 之後會往下移）— current */
@media (prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:.01ms!important;transition-duration:.01ms!important}}
```

減少動態的意思是**更少、更溫和**，不是零。這條規則連 hover 的顏色過場、toast 與對話框的淡入淡出、載入遮罩的淡出都拿掉了，這些都是幫助理解狀態的變化，不會造成暈眩。001–009 已在 001 建立的 reduced-motion 區塊裡逐一加上「只拿掉位移／縮放」的規則，這條全域規則已經不需要。

## Target

- 刪除上面那一行全域規則。
- 001 建立的 reduced-motion 區塊最後應該**恰好**包含以下規則（順序不拘，缺哪條就代表對應計畫漏做，停下回報，不要自己補）：

```css
/* 減少動態：保留透明度與顏色變化，只移除位移與縮放。各動畫計畫把自己的規則加在這裡 */
@media (prefers-reduced-motion:reduce){
  .btn:active,.iconbtn:active,.seg button:active,.cat:active,.mini:active{transform:none}   /* 002 */
  .toast{transform:translate(-50%,0)}                                                       /* 003 */
  .overlay.out .dialog,.pv.out{transform:none}                                             /* 005 */
  @starting-style{.overlay .dialog,.pv{transform:none}}                                    /* 005 */
  .grid.intro .card{animation:none}                                                         /* 007 */
  .ico.pop{animation:none}                                                                  /* 008 */
  .btn[data-anim] .sort-ico{transition:none}                                                /* 009 */
}
```

（上面的 `/* 00x */` 註解只是給你對照用，實際寫入時不要加。）

- 004（預覽寬度）由 JS 判斷 `prefers-reduced-motion`，不需要 CSS。
- 006（主題淡換）只有透明度，reduced-motion 下刻意保留。

## Repo conventions to follow

- 一行一條規則，區塊內兩格縮排。

## Steps

1. 找到 `@media (prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:.01ms!important;transition-duration:.01ms!important}}` 這一行並刪除。
2. 對照 Target 檢查 reduced-motion 區塊，確認 7 條規則都在。若有缺漏，**停下回報是哪一條**。
3. 確認 reduced-motion 區塊位於 `<style>` 的最後（在所有被它覆蓋的規則之後），否則同權重的覆蓋會失效。

## Boundaries

- 不要新增任何 `!important` 或 `*` 選擇器。
- 不要移除任何透明度或顏色過場。
- 若 001–009 有任何一個尚未完成，不要做這個計畫。

## Verification

- **Mechanical**：Chrome 開 `index.html`，Console 無錯誤。`grep -c "animation-duration:.01ms" index.html` 應為 0。
- **Feel check**（DevTools → Rendering → Emulate CSS media feature `prefers-reduced-motion: reduce`）：
  - hover 按鈕／卡片：顏色仍然 150ms 柔和過場。
  - 按下按鈕：不縮放。
  - 收藏：toast 淡入淡出但不上下移動；愛心不彈。
  - 開關預覽與自評對話框：只有淡入淡出，沒有縮放。
  - 切預覽寬度：瞬間切換。
  - 切主題：200ms 交叉淡換仍在。
  - 重新整理：卡片直接在原位，不落定。
  - 點排序：箭頭直接翻轉。
  - 關掉 emulate 後，以上動畫全部恢復。
- **Done when**：全域歸零規則已刪除，7 條選擇性規則齊全，reduced-motion 下只剩透明度與顏色變化。
