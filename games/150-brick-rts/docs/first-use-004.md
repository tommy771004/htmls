# 首次使用修正迴圈 004：真實 3D 戰場基礎

2026-09-25；C 階段部分里程碑。完成的是 3D 移動沙盒與模型檢視，完整 RTS 對局仍阻塞。

## 環境與重現

- Node 22.23.1、darwin arm64、Chromium 151.0.7922.34；1440×900 與 390×844。
- seed 260925（重建測試另用 7）、ruleset hash `470c9ac5`、state/snapshot v3；首次載入 tick 0，步進驗證 tick 1，其後由實際移動到達條件結束。
- 乾淨目錄：`/var/folders/05/x61j217d49g9k0_kccntyzsr0000gn/T/brick-rts-3d-first-use-8e30oz0s`。複製 source、首頁、縮圖與本地 Three.js vendor，不複製 node_modules。
- 依序執行 `npm ci --ignore-scripts`、`npm run build`、`npm run validate`、`npm test`、`PLAYWRIGHT_MODULE=/Users/tommy/Documents/Proj/OldBabyInfo/node_modules/playwright/index.mjs npm run test:browser`，全部成功；28 項程式測試通過。

首次進站 → 等待 WebGL2 與 Worker → 放大／旋轉／還原視角 → 選村民 → 地面與座標移動 → 步進／開始／暫停 → 存讀 → 重播 → 壞檔拒絕 → 更換 seed → 屋內目的地拒絕 → 繞屋到達 → Worker 中斷／重試 → 再開沙盒。兩尺寸皆通過，正常流程無 pageerror、console.error、外部網路請求或水平溢出。另以實際畫面座標點選村民 2，在兩尺寸確認 aria-pressed 正確切換。

模型檢視頁另測四個方向、近景、遠景與還原。視角改變時模擬 hash 保持一致。遠景測得 Draw calls 131、Triangles 31592、Geometries 33；這是 renderer 計數，不能當成目標硬體 FPS 驗收。

## 問題表與重測

| 問題／嚴重度 | 根因、處理與結果 |
|---|---|
| 缺少 WebGL2 無法進入場景／啟動阻塞 | 啟動明確顯示錯誤並停用模擬輸入。注入 WebGL2 不可用後確認提示與停用狀態通過；未宣稱此環境可玩。 |
| 繪圖 context 遺失／高 | 以真實 WEBGL_lose_context 擴充觸發；停止繪圖與操作，保留 Worker 狀態及儲存入口。實際按儲存成功。恢復方式為儲存後重新載入，不宣稱支援即時 context restore。 |
| 人偶輪廓超出碰撞半徑／中 | 縮窄手臂尺寸與偏移，將輪廓留在既有半徑內。調整後乾淨建置、繞屋測試與兩尺寸點選通過；單位彼此避讓仍未實作。 |
| RTS-LOOP-001／完整對局阻塞 | 採集、送返、建造、升級、造兵、戰鬥與勝敗尚未實作。prompt 19 完整流程在沙盒之後中斷，維持未完成，不提供假操作替代。 |

故障注入在指定操作各跑一次；未量測自然發生率。主要修正檔案為 apps/web/scene.ts、main.ts、index.html；新增 models.html 與共用 scene bundle。tests/browser.mjs 保留鏡頭、WebGL 故障及模型檢視回歸。

## 證據與剩餘範圍

乾淨目錄下 `games/150-brick-rts/test-results/` 保存 `desktop-1440.png`、`desktop-390.png`、`house-route-*.png`、`view-close-*.png`、`model-angle-0.png` 至 `model-angle-3.png`、`model-near.png`、`model-far.png`。主工作目錄亦有上一輪相同路徑截圖；近景已目視檢查。

房屋、樹、岩石、地面與村民是真實 Three.js 幾何；固定地物使用模擬共用位置。只有行走動畫，沒有工作／攻擊／死亡完整動畫矩陣。資源節點與耗盡、迷霧、地形高度／水域、完整年代與軍事資產、單位彼此碰撞及完整對局仍未完成。其他瀏覽器與目標硬體效能未驗證。原作規則仍為 unverified；工程數值仍是 design_default。

C 保持 in_progress；先完成其剩餘門檻才進入 D，不能以此報告宣稱完整 C 或完整遊戲驗收。
