# 實測紀錄 — 2026-09-25

本輪範圍：規則驗證與命令沙盒；不是首個完整 RTS 對局驗收。

| 檢查 | 實際結果 |
|---|---|
| `npm ci` / locked dependencies | npm install 建立 lockfile；npm ci 尚未另跑 |
| `npm run build` | PASS：TypeScript strict 型別檢查、manifest 匯出、靜態 JS／HTML 建置 |
| `npm run validate` | PASS：自訂規則資料有效；原作 coverage unknown |
| `npm test` | 9 tests、9 pass、0 fail；Node 22.23.1 |
| 10000 ticks | 同 seed／指令重播、分批更新及存讀續跑 hash 一致 |
| 錯誤資料 | 重複 ID、懸空前置、負成本、循環、禁用項、未知版本 exact check 均拒絕 |
| 錯誤命令 | 敵方控制、過期、重複、錯誤版本與無效座標拒絕且不改 state |
| Chromium 151.0.7922.34 / 1440×900 | PASS |
| Chromium 151.0.7922.34 / 390×844 | PASS |
| 首頁 | 「遊戲敘事」篩選＋Brick RTS 搜尋找到 150 |

瀏覽器腳本：`tests/browser.mjs`。實際操作選村民、輸入與地面移動、tick、暫停、存讀、破損存檔保留現況、重播、重建、JSON 驗證／還原／下載；兩種尺寸沒有水平溢出、pageerror、console.error 或外部網路請求。桌機與手機完整截圖已目視檢查。截圖留在本地 `test-results/desktop-1440.png`、`test-results/desktop-390.png`（gitignored）；作品縮圖為 repository `thumbs/150.jpg`。

執行：

```sh
PLAYWRIGHT_MODULE=/Users/tommy/Documents/Proj/OldBabyInfo/node_modules/playwright/index.mjs node games/150-brick-rts/tests/browser.mjs
```

第一次手機測試的 raw mouse click 因 canvas 已捲出視窗而未命中；測試腳本已改為 scrollIntoViewIfNeeded 後点击，同步重跑桌機與手機通過。未以此宣稱原作提示 19「首次進站到勝利」已完成。

未驗證：Firefox／Safari／Edge、原作精確數值、WebGL2 3D 場景、多人、完整遊戲存檔、實機內顯 FPS／frame time、正式 RTS 對局。沒有以自訂資料的驗證結果換算原作覆蓋率。

## 後續驗證

第二輪已在新工作目錄完成 npm ci、build、validate、13 項測試、headless 及兩尺寸瀏覽器測試。詳細首次使用路徑與仍阻塞完整對局的問題見 `first-use-001.md`；上一輪的 9 tests 為當時紀錄。

## Worker 里程碑

最新乾淨目錄驗證：16 tests／16 pass，桌機與手機流程、Worker 啟動失敗／中斷／timeout 的恢復均通過。詳細步驟與未完成項見 `first-use-002.md`，原始輸出見 `worker-verification.log`。

## Navigation milestone

Latest clean-directory run: 22 tests passed; desktop/mobile real house routing, blocked-target rejection, replay, Worker recovery and catalogue passed. See first-use-003.md for reproduction details and remaining gates.
