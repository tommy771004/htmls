# 築嵐島（196）

- 原始碼在 `games/196-stormwright/`（Three.js 0.186.0 + esbuild），有自己的 `package.json`；`npm run build` 輸出單檔 `web/196-stormwright.html`，改了 `src/` 要重新 build 並把產出一起 commit。
- 模組契約（ctx、事件、Actor／Intent、建造格、風暴階段、檔案分工）見同資料夾的 `SPEC.md`；指令、`window.__sw` 測試 API 與 `tools/accept.mjs`、`tools/check-*.mjs` 驗收腳本見 `README.md`（Playwright 路徑讀 `PLAYWRIGHT_MODULE`）。
