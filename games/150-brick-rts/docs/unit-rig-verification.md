# C：人偶關節、工具與姿態

2026-09-25。新增 apps/web/unit-rig.ts 共用人偶模組，renderer 使用相同模型於遊戲與模型檢視頁；不改權威模擬，state/snapshot 維持 v9。

## 已實作

- 髖部、肩部旋轉關節，命名的 hand-left／hand-right 掛點。斧、鎬、鐮刀、槌、籃及劍掛在手部階層，不靠每幀獨立猜測武器位置。
- idle、walk、work、attack、hit、death、carry 姿態取樣；只做剛體位移及旋轉，不伸縮身體。受擊與倒下有結束時間，重設待命可恢復原姿態。倒下時隱藏工具並抬正旋轉中心，避免工具穿地。
- 模型檢視頁可選工具／姿態、靜止檢查或播放、聚焦人偶、恢復全景。控制項明確標示只檢查模型，不執行採集或傷害。
- 遊戲仍只由 Worker 的移動狀態驅動 idle／walk。其餘姿態尚未接入工作、戰鬥與死亡系統；動畫不產生任何經濟或傷害事件。

## 驗證

build 與 59 項程式測試通過。實際 Three.js 物件測試掛點世界座標隨關節變換、工具切換只有一件可見、所有姿態矩陣有限、scale 恆為 1、倒下工具隱藏及待命還原。受擊結束時原本留有約 3e-17 的浮點角度，已在結束分支明確歸零並重測。

Chromium 151.0.7922.34 完整瀏覽器回歸通過：桌面／手機沙盒、地圖切換、高地點選、視野、存讀／重播、Worker／WebGL 故障、模型檢視。新增模型姿態及播放截圖檢查亦通過。

另以 `PLAYWRIGHT_MODULE=/Users/tommy/Documents/Proj/OldBabyInfo/node_modules/playwright/index.mjs npm run test:rig-browser` 驗證聚焦、六種工具、工作／搬運／攻擊／受擊／倒下、動畫播放及恢復全景。恢復後 canvas 截圖與起始圖相同，沒有 pageerror。`test-results/rig-focus-work-axe.png` 與 `rig-focus-death-none.png` 已目視檢查，其他姿態同目錄保存。

這是美術資產驗收，沒有新增可玩的採集／戰鬥里程碑；未另宣稱乾淨安裝或完整對局通過。軍種輪廓、騎乘模型、完整工作與戰鬥整合、修理／治療等擴充動畫仍待完成。完整 C 不標完成。
