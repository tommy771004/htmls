# index.html 動畫改善計畫

來源：`improve-animations` 對 `index.html` 的稽核，commit `d37c05f`。每份計畫都自成一體，可以交給任何 agent 單獨執行。

## 計畫與建議執行順序

依編號順序執行。001 必須最先做，010 必須最後做。

| # | 計畫 | 嚴重度 | 依賴 | 狀態 |
| --- | --- | --- | --- | --- |
| 001 | [建立動畫 token 與 reduced-motion 區塊](001-motion-tokens.md) | LOW | — | DONE |
| 002 | [按鈕按下時的縮放回饋](002-press-feedback.md) | LOW | 001 | DONE |
| 003 | [Toast 進出場改用強 ease-out](003-toast-easing.md) | LOW | 001 | DONE |
| 004 | [預覽寬度切換改用 clip-path](004-bezel-width-clip.md) | MEDIUM | 001 | DONE |
| 005 | [預覽與自評對話框的進出場](005-dialog-preview-enter-exit.md) | MEDIUM | 001 | DONE |
| 006 | [主題切換整頁同步淡換](006-theme-crossfade.md) | LOW | 001 | DONE |
| 007 | [首次載入時卡片依序落定](007-first-load-card-settle.md) | LOW | 001 | DONE |
| 008 | [收藏時愛心輕彈](008-favorite-heart-pop.md) | LOW | 001 | DONE |
| 009 | [排序圖示翻轉](009-sort-icon-flip.md) | LOW | 001 | DONE |
| 010 | [減少動態改為只拿掉位移](010-reduced-motion-selective.md) | MEDIUM | 001–009 | DONE |

執行方式：用 `/improve-animations execute plans/001-motion-tokens.md` 執行單一計畫（會在獨立的 worktree 實作，再依動畫標準審查），或把計畫檔直接交給任何 agent。

## 依賴說明

- **001** 定義 `--ease-out`、`--ease-in-out`、`--dur-*`，並在原本的全域減少動態規則上方建立一個空的 `@media (prefers-reduced-motion:reduce)` 區塊。002–009 都會用到這些 token，也都會把各自的減少動態規則加進這個區塊。
- **010** 刪除原本「全部歸零」的減少動態規則，並檢查 002–009 加入的規則是否齊全，所以必須最後做。在那之前，舊規則會繼續保護減少動態的使用者。
- 002–009 之間互不依賴，但全都修改同一個檔案，請**依序**執行，不要平行，以免合併衝突。
- 行號以 `d37c05f` 為準。前面的計畫會讓後面的行號往下移，所以執行者應該以程式碼摘錄來定位，不要只看行號。

## 刻意不做的動畫

- **搜尋、分類篩選、排序造成的網格重畫**：頻率太高，搜尋更是每打一個字就重畫一次，瞬間切換是對的。
- **預覽中用 ←/→ 或 R 切換作品**：這是鍵盤操作，用得很頻繁，只換 iframe 內容，不播進場。
- **卡片 hover**：只換背景色，不浮起、不縮放、不加陰影。
- **現有的 hover 顏色過場**（150ms `ease`）：已經正確，只把時長改成 token。
