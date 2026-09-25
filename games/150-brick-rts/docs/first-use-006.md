# 首次使用修正迴圈 006：可操作的多地形沙盒

2026-09-25，C 階段地圖／移動里程碑；不是完整 RTS 對局。Node 22.23.1、darwin arm64、Chromium 151.0.7922.34。seed 260925，ruleset `ae7376fc`，state/snapshot v9。

## 實際流程

首次進站 → 草甸開局 → 選「高地與淺灘」→ 按重新建立 → 直接點選高地 (4.5,13.5) → 開始 → 村民沿可達路徑及階梯登上高地 → 待命 → 暫停並儲存 → 選海岸並重建 → 移動到深水 (8,14) 被拒絕 → 讀回存檔 → 恢復高地圖、位置、視野與 hash → 注入 Worker 故障 → 重試恢復 → 重播一致。

高地流程在 1440×900 實測，截圖 `test-results/playable-highland.png` 顯示 tick 161、村民 (4.5,13.5) 待命；不同執行的暫停時機可能相差數 tick。已目視確認村民腳底及選取環位於高地表面。既有 390×844 流程另驗證新控制項的布局、草甸移動、碰撞、存讀、重播、視野與錯誤恢復；不把桌面高地流程寫成手機觸控實測。

## 問題與修正

| 問題／嚴重度 | 原因、修正與重測 |
|---|---|
| 地圖只可檢視，無法實際走訪／功能缺口 | reset 增加明確 layout，State 保存地圖類型；三種地圖均可建立移動沙盒。高地實際點選與到達通過。 |
| 高地點選若投影到 y=0 會錯位／高 | 改以地形 mesh raycast 取得真實表面 x/y。瀏覽器直接點擊高地指定座標並確認村民到達，未改用輸入欄位繞過問題。 |
| 讀檔／Worker 重建可能返回草甸／資料恢復風險 | snapshot、replay、Recovery checkpoint、Response 與 UI 全部保留 layout；從海岸讀回高地與高地故障恢復的 hash 均一致。 |
| 無效地圖可能替換現況／資料風險 | 生成完成並驗證後才替換 Worker State。未知 layout 回傳錯誤，既有 hash 不變。 |
| RTS-LOOP-001／完整對局阻塞 | 採集、送返、建造、升級、造兵、戰鬥與勝敗仍未完成；prompt 19 完整流程在移動探索後仍阻塞，未宣稱完整對局可完成。 |

## 驗證

一般工作目錄 build、57 項程式測試及完整 browser 回歸通過。新增測試涵蓋三圖 snapshot/replay、layout 恢復、無效地圖原子拒絕，及地形投影不含 resourceRefs／obstacleRefs。一般 View 傳靜態地格的類別、高度、通行與可建造性，renderer 不再猜測生成重試使用的地形；本機靜態地圖資訊仍不是多人反作弊。

乾淨目錄 `/var/folders/05/x61j217d49g9k0_kccntyzsr0000gn/T/brick-rts-maps-first-use-tb2w729n` 排除 node_modules／test-results 後，執行 npm ci --ignore-scripts、npm run build、npm run validate、npm test，全部成功、57 tests 通過。接著以 PLAYWRIGHT_MODULE=/Users/tommy/Documents/Proj/OldBabyInfo/node_modules/playwright/index.mjs 執行 npm run test:browser，兩尺寸既有操作、高地點選與登階、深水拒絕、跨地圖讀檔、Worker 恢復、視野往返、模型檢視及 WebGL 故障全部通過。正常兩尺寸流程無 pageerror、console.error、外部請求或水平溢出；截圖保存於該目錄 games/150-brick-rts/test-results/。

舊 v1–v8 存檔明確拒絕而不改現況，尚無遷移。海岸模式仍只有陸地村民，深水不是可行走平面；沒有用船隻按鈕暗示海戰已完成。C 的完整村落／軍種資產、施工與戰鬥動畫、LOD 等尚未完成；後續仍按 BUILD_ORDER 進行。
