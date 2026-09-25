# 模型頁繪圖故障處理

2026-09-25。針對 infantry-visuals-verification.md 的一次空白畫面追蹤，檢查發現模型頁在 context loss 後仍保留可操作控制項與舊統計；requestAnimationFrame 內的例外也不會被初始化 try/catch 捕捉。這些是已確認的錯誤處理缺口，不足以證明之前空白畫面的根因。

## 修改

- scene.ts 對模型頁提供適用的中斷訊息，不再要求不存在的模型存檔；canvas.dataset.renderState 標示 ready／context-lost。
- models.html 捕捉每幀繪圖例外。失敗後停止排程、隱藏失效畫布、停用模型控制、顯示「繪圖已停止」及重新載入按鈕；返回沙盒連結仍可使用。
- tests/rig-browser.mjs 在正常路徑記錄 context loss、console 與 pageerror；失敗時保存 model-failure.png 與 model-failure.json，包含錯誤文字、統計與圖形事件，避免只留下巨大二進位截圖差異。

## 驗證範圍

build 通過。模型瀏覽器測試包含既有姿態／工具／步兵／建築的完整切換與畫面還原；另以 WEBGL_lose_context 注入中斷，驗證停止狀態、控制項停用及點選重新載入後恢復。再以繪圖方法拋出例外注入 frame failure，驗證錯誤可見、沒有逸出的 pageerror，並實際重新載入恢復。

這次沒有新增玩法或可玩里程碑；不宣稱乾淨安裝、完整對局或目標硬體通過。原本一次偶發空白仍保留根因未知，新增的故障診斷可供下次發生時定位。C 保持 in_progress。

最終隱藏失效畫布的版本再次通過模型全流程與兩種故障注入。完整 test:browser 亦通過桌面／手機、地形／迷霧、存讀／重播、Worker／WebGL 故障及分類搜尋。瀏覽器 Chromium 151.0.7922.34；本轮未重跑未受修改影響的純模擬單元測試。
