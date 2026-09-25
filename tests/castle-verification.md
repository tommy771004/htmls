# 曦光城堡驗收紀錄

- 頁面：`web/142-aurielle-castle.html`；分類：創意藝術。
- Chrome / WebGL：1440×900、390×844，均檢查實際截圖。
- 正面、45°、側面、俯視；日夜、環繞、重設均通過。
- 手機無水平溢出，城堡完整呈現，控制列不遮蔽模型。
- glTF 2.0 匯出並以本地 GLTFLoader 重新載入：9 個材質、9 個網格、94,938 個三角形。
- 無 pageerror、console.error 或外部請求。
- 依材質合併靜態幾何，降低繪製呼叫；使用本地 Three.js 0.186.0。
- 模型為程序建構的外觀展示，非城堡室內建築或施工圖。

重跑：設定 `PLAYWRIGHT_MODULE` 和選用的 `BROWSER_EXECUTABLE`，執行 `node tests/castle-regression.mjs`。測試自行開啟本地靜態伺服器，截圖與下載檔保存至暫存資料夾。
