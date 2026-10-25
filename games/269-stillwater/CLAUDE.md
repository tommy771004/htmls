# 靜水釣遊（269）

- 原始碼在 `games/269-stillwater/`（Three.js 0.186.0 + esbuild），有自己的 `package.json`（`node_modules` 連到 201 的）；`npm run build` 輸出單檔 `web/269-stillwater.html`，改了 `src/` 或 `blender/out/` 要重新 build 並把產出一起 commit。`npm test` 先跑 `tools/core.test.mjs`（魚種表、品質判定、收線可釣性、地圖、出魚、主線、存檔）再跑三種尺寸的無頭 Chrome 驗收（實際划船、拋竿、提竿、收線到釣起），`npm run thumb` 產生縮圖。
- 船、漁夫（`sit`／`row`／`row_L`／`row_R`／`cast`／`wait`／`hook`／`reel`／`cheer` 動作）、環境物件與 55 種魚都由 `blender/*.py` 建模（Blender 5.2，共用工具在 `common.py`／`meshkit.py`），`npm run assets` 重建 `blender/out/*.glb`（有 commit，build 不需要 Blender）。節點名、契約材質（`hull_paint`／`hat_ribbon`／`lamp_glow`／`win_glow`）與划槳公式見 `SPEC.md`；槳的角度由 `src/core/boat.js` 的 `oarPose()` 計算，必須和 `blender/rowing.py` 一致。
- `src/core/`（魚種表、品質、收線、地圖、船的物理、主線與委託、存檔）不碰 DOM 與 three；`src/view/` 是畫面，`src/game.js` 串起迴圈、面板動作與 `window.__st` 測試 API（`toSpot(k)`、`toCp(k)`、`setTime(min)`、`unlockAll()`、`fillBook(n)`、`give(id, tier)`、`act(type, down)`），`src/ui/` 是 HUD 與面板。座標：北方 −Z、船頭 = (sin yaw, cos yaw)，漁夫面向船尾坐，釣魚時整艘船轉成船尾朝釣點。存檔在 `localStorage` 的 `st269.save`。
- 指令、操作與已知限制見同資料夾的 `README.md`。
