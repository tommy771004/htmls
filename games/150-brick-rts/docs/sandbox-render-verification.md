# 沙盒繪圖例外與存檔保留

2026-09-25。既有模型頁已捕捉 frame exception，但正式沙盒 main.ts 仍直接呼叫 scene.draw。若 draw 拋例外，requestAnimationFrame 不會繼續排程，且 running 旗標與畫面提示可能仍是運行中，形成沒有可見原因的卡住。

## 修正

- 每幀繪圖與 Worker 投影的場景更新都捕捉例外，進入 graphicsError。
- 失敗時暫停模擬、停用命令與鏡頭按鈕；不再排程繪圖，也不接受滑鼠滾輪的場景調整。
- 仍接收已送出的 Worker 回覆，更新 tick／指紋等文字資訊；模擬已連線時保留儲存功能，並提示先存檔再重新載入。
- 不改權威模擬、命令規則或 snapshot v9；已被 Worker 接受的進度不回滾或丟棄。

## 驗證範圍

build 通過。新增瀏覽器故障注入在運行超過 3 ticks 後讓 WebGL draw 方法拋出例外，檢查明確錯誤、暫停、按鈕狀態、沒有逸出 pageerror；等待在途回覆結束後確認 tick 保持不變。接著透過真實儲存按鈕保存，再重新載入、讀檔、比對 tick 與 hash、驗證重播並前進一 tick。

此變更修正既有沙盒故障路徑，未新增可玩里程碑；不以故障測試宣稱完整對局或新的乾淨安裝 prompt 19 通過。原本偶發模型空白仍無足夠根因證據，此修正也不代表該問題已消除。

實際結果：Chromium 151.0.7922.34 完整 test:browser 通過，新增「render exception pauses simulation, preserves save, reload/load/replay and resume」亦通過。截圖保存於 test-results/sandbox-render-failure.png。本輪未重跑未修改的純模擬單元測試；git diff --check 通過。
