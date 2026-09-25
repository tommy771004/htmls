# C 階段：地格與資源資料增量

2026-09-25。本輪建立後續資源與迷霧需要的權威地圖資料，沒有新增可採集玩法或完成對局；C 維持 in_progress。

## 已接入

- 每張生成圖包含 256 個穩定 ID 地格，各自保存 terrainType、height、walkClass、buildability、resourceRefs、obstacleRefs。當前實際生成草地與平坦土路；道路外觀讀取地格資料。
- 通行由 walkClass 與單位半徑決定，與材質名稱分離。地形定義還包含水域、淺水、高地與懸崖，但尚無相應生成模式或完整高度導航，不算完成這些地形。
- 現有樹木／石塊對應獨立資源，含 capacity、remaining、collectible、status、obstacleId 與 depletedAt。容量是 design_default，列於 runtime-manifest.json，並非原作數值。
- harvestMapResource 是內部模擬原語：有限產出、拒絕無效輸入、耗盡僅一次、移除對應障礙與地格參照，更新原占地內導航節點；保留耗盡資源紀錄。它尚未接到村民工作／攜帶／送返命令，不能從 UI 採集，也不能把直接呼叫原語的 state 當作已有命令重播。
- 生成器驗證四個出生位置與雙方主要出生區連通性；失敗最多 8 次確定性重試並回傳可讀原因。尚未保證資源分配公平、全部資源可達或海岸合理。

## 檢查與修正

Node 22.23.1、darwin arm64。`npm run build`、`npm run validate`、`npm test` 通過，33 項測試。

`PLAYWRIGHT_MODULE=/Users/tommy/Documents/Proj/OldBabyInfo/node_modules/playwright/index.mjs npm run test:browser` 亦通過。Chromium 151.0.7922.34 的 1440×900、390×844 操作、繞屋、存讀／重播、Worker 故障恢復、模型頁、WebGL2 失敗與 context loss 後儲存、首頁搜尋均成功。正常流程無 pageerror、console.error、外部請求或水平溢出。截圖留於 test-results/；desktop-390.png 已目視確認土路、模型與控制項正常。這是目前工作目錄的回歸，沒有把它寫成新乾淨目錄驗收。

新增測試涵蓋 30 次 seed 輸入（含 0、uint32 上限與重複基準）、可重現地格／資源、無效 seed、水域／淺水通行、半徑接觸邊界、出生點阻塞、兩側斷路、壞參照、負容量、有限採集、重複耗盡、局部 blocked 更新與全圖重新計算相等。另測試資源狀態遭竄改，即使重新計算 checksum，仍因命令重建不符而拒絕存檔。

首輪地形測試錯誤：測試區域同時含隨機岩石，將地格改為可走仍應被岩石阻擋。已在純地形測試中隔離障礙物後重測；沒有停用遊戲碰撞檢查。原有固定地物繞行回歸仍通過。

State／snapshot 升為 v4，ruleset hash 為 `e8199f72`。舊 v1–v3 存檔明確拒絕且不改現況；尚無遷移。地圖、資源與導航 revision 參與 canonical hash。歷史 first-use-004 的 v3 紀錄保留作當時證據。

本輪是既有沙盒的資料增量，未宣稱新的可玩里程碑或 prompt 19 完整對局成功。下一個 C 可玩里程碑仍需由乾淨目錄執行首次使用修正迴圈。迷霧、最後已見快照、完整資源種類、海域圖、手工驗收圖、資源公平性及後續 E 對局閉環仍待實作。
