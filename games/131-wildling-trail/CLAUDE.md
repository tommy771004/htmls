# 野靈旅記（131）

- 原始碼在 `games/131-wildling-trail/`（TypeScript + Vite + Phaser，Vitest 與 Playwright），有自己的 `package.json`。
- 網站仍然沒有 build step：`npm run build` 會把所有程式、樣式與程序化素材內嵌成單檔 `web/131-wildling-trail.html`，commit 的就是這個檔案。改了 `src/` 之後要重新 build，並把產出一起 commit。
- 分層：`src/core`（規則）與 `src/app`（狀態機）不能依賴 Phaser 或 DOM；畫面、輸入與音效只放在 `src/view`。
- 指令、自訂規則、測試結果與已知限制見 `games/131-wildling-trail/README.md`，需求規格見 `docs/pokemon.md`。
