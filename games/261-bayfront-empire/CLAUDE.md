# 灣岸商業帝國（261）

- 原始碼在 `games/261-bayfront-empire/`（Three.js 0.186.0 + esbuild），有自己的 `package.json`（`node_modules` 連到 201 的）；`npm run build` 輸出單檔 `web/261-bayfront-empire.html`，改了 `src/` 要重新 build 並把產出一起 commit。`npm test` 先跑 `tools/econ.test.mjs`（經濟、海港、v1／v2→v3 存檔遷移）再跑兩種尺寸的無頭 Chrome 驗收；`npm run sim` 在 Node 跑經濟模擬看節奏。
- `src/data.js`／`src/econ.js`／`src/port.js` 不碰 DOM 與 three，海灘商家與城市商家共用同一份 `BIZ` 格式與 `arrivalPerMin` → `serve` 流程；物流與海港（供應成本、補給船、岸橋、合約）在 `port.js`，由 `econ.js` 的 `serve`／`tick` 呼叫，`src/portview.js` 只讀狀態畫出來。改存檔欄位要同步 `migrate()`／`sanitizePort()` 與測試；v1 是海灘改版前、v2 是物流改版前的格式，開始畫面的兩個「試玩」按鈕各載入一份舊存檔。
- 規格、存檔格式與效能策略見同資料夾的 `SPEC.md`，指令與 `window.__bf` 測試 API 見 `README.md`。
