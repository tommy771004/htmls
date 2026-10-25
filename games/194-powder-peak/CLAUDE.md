# 雪峰滑降（194）

- 原始碼在 `games/194-powder-peak/`（Three.js 0.186.0 + esbuild），有自己的 `package.json`；`npm run build` 輸出單檔 `web/194-powder-peak.html`，改了 `src/` 要重新 build 並把產出一起 commit。`npm test` 是無頭 Chrome 的模擬測試（跑打包後的單檔，要先 build）。
- 規格見 `games/194-powder-peak/SPEC.md`，指令、除錯參數與 `window.__game` 測試 API 見同資料夾的 `README.md`。
