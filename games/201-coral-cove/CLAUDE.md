# 珊瑚灣垂釣（201）

- 原始碼在 `games/201-coral-cove/`（Three.js 0.186.0 + esbuild），有自己的 `package.json`；`npm run build` 輸出單檔 `web/201-coral-cove.html`，改了 `src/` 或 `blender/out/` 要重新 build 並把產出一起 commit。`npm test` 是兩種尺寸的無頭 Chrome 驗收（跑打包後的單檔）。
- 所有模型（漁夫、棧橋、船、木箱、魚簍、珊瑚、海草、魚）都由 `blender/*.py` 以 Blender 5.2 無頭腳本建模、綁骨與做動畫（共用工具在 `blender/common.py`，action 要指定 slot、以 NLA 軌匯出），`npm run assets` 重建 `blender/out/*.glb`（有 commit，build 不需要 Blender），打包時以 gzip＋base64 內嵌。節點、骨頭與動作名稱是遊戲取用的契約，見 `SPEC.md`；改資產後用 `node tools/view.mjs <glb> --node … --anim …` 在 three 裡截圖檢查。
- 操作、`window.__cc` 測試 API 與已知限制見同資料夾的 `README.md`。
