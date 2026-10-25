# 湖畔求生（197）

- 原始碼在 `games/197-openworld/`（Three.js 0.186.0；Vite 開發、esbuild 打包），有自己的 `package.json`；`npm run build` 輸出單檔 `web/197-openworld.html`，改了 `src/` 要重新 build 並把產出一起 commit。
- 模型與貼圖（約 55 MB）不內嵌，放在 `assets/197/`：`npm run dev` 把它當 publicDir，打包時 `import.meta.env.BASE_URL` 定義成 `../assets/197/`。`npm run assets`（含 `tools/fetch-polyhaven.mjs` 的 Poly Haven 掃描模型）／`npm run models`／`npm run characters`（Quaternius 人物與馬，需要 Blender；素材包快取在 gitignore 的 `.cache/`）也寫到那裡。
- 操作、結構與換模型的方法見同資料夾的 `README.md`，未完成的色調調整見 `HANDOFF.md`，第三方素材授權見 `CREDITS.md`；`?debug` 不請求 pointer lock，`window.__game` 可直接操作。
