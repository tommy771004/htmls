# 響尾蛇越野（195）

- 原始碼在 `games/195-sidewinder/`，有自己的 `package.json`：`core/` 是 Rust crate（編成 `wasm32-unknown-unknown`，純 C ABI，不用 wasm-bindgen），`blender/` 是產生賽道與模型的 Blender 腳本（`npm run assets`，輸出 `blender/out/` 要 commit），`src/` 是前端（esbuild）。
- `npm run build` 會先 `cargo build`，再把 WASM、模型、賽道與貼圖 gzip＋base64 內嵌成單檔 `web/195-sidewinder.html`；改了 `core/`、`blender/out/` 或 `src/` 要重新 build 並把產出一起 commit。`npm test` 是無頭 Chrome 驗收（跑打包後的單檔），`npm run test:core` 是 `cargo test`。
- 模組契約（SWTK／SWMS 檔案格式、WASM ABI、狀態陣列、事件）見同資料夾的 `SPEC.md`；指令、`window.__sw` 測試 API、音效掛點與 Cloudflare Pages 部署見 `README.md`。部署到 Cloudflare 需要使用者自己的帳號，不要自動執行。
