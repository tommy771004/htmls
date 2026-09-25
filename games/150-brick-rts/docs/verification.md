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

## 3D 戰場基礎（最新）

乾淨目錄 npm ci、build、validate、28 項程式測試及兩尺寸瀏覽器流程通過。實際 WebGL2 場景、鏡頭控制、模型檢視、context loss 後儲存及 WebGL2 不可用的明確失敗狀態均已測試。詳見 [first-use-004.md](first-use-004.md)。此紀錄取代上文「3D 尚未驗證」的歷史狀態；C 的資源／迷霧與完整對局仍未完成。

## 地圖與資源資料 v4

目前工作目錄的 build、validate、33 項測試及完整既有瀏覽器回歸通過。新增地格、樹木／石塊容量與耗盡原語、局部導航更新；可玩採集及迷霧尚未接入。詳見 [terrain-verification.md](terrain-verification.md)。最新 state／snapshot 為 v4；歷史紀錄保留各輪當時版本。

## 三態視野 v5（最新）

乾淨目錄 npm ci、build、validate、38 項測試、兩尺寸完整瀏覽器回歸及實際走近／撤回視野測試通過。首次 build 缺少 web 輸出資料夾的問題已修正並從原失敗目錄重測。state／snapshot 現為 v5。詳見 [first-use-005.md](first-use-005.md)；仍不代表完整 C、完整對局或多人反作弊通過。

## 海岸與手工圖增量

42 項測試、建置、規則驗證、地圖 JSON 匯出與完整瀏覽器回歸通過。另確認驗收頁三圖切換及返回草甸的畫面一致。詳見 [map-examples-verification.md](map-examples-verification.md)。正式沙盒仍僅使用草甸；沒有以地圖檢視宣稱海戰已完成。

## 七種資源 v6（最新）

46 項測試、建置、地圖匯出與完整瀏覽器回歸通過；新增有限資源、動物占地、魚群地形與可見資源投影驗證。snapshot 現為 v6。詳見 [resources-verification.md](resources-verification.md)，仍未完成採集工作或完整對局。

## 起始資源門檻 v7（最新）

50 項測試、build、validate、maps:export 與完整瀏覽器回歸通過。生成器檢查容量下限、安全鄰近位置與最近路程差上限；不等同完整競技平衡。snapshot 現為 v7。詳見 [starting-resources-verification.md](starting-resources-verification.md)。

## 高度通行 v8（最新）

54 項測試、build、validate、地圖匯出與完整瀏覽器回歸通過；手工圖地台／階梯已目視檢查。詳見 [heights-verification.md](heights-verification.md)。snapshot 現為 v8；尚無高地正式對局與原作高度效果。

## 多地形移動 v9（最新）

乾淨目錄 npm ci、build、validate、57 項测试及 browser 首次使用流程通過。實測直接點選高地後登階到達、海岸深水拒絕、跨地圖讀檔及 Worker 恢復；草甸兩尺寸與故障流程亦通過。snapshot 現為 v9，詳見 [first-use-006.md](first-use-006.md)。完整採集、戰鬥與勝敗尚未完成。
