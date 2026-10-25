# Groundline 機場停機坪即時調度（267）

- 原始碼在 `games/267-groundline/`（Three.js 0.186.0 + esbuild），有自己的 `package.json`（`node_modules` 連到 201 的）；`npm run build` 輸出單檔 `web/267-groundline.html`，改了 `src/` 或 `blender/out/` 要重新 build 並把產出一起 commit。`npm test` 先跑 `tools/sim.test.mjs`（過站六步驟、車輛指派、優先順序與連鎖延誤傳遞），再跑兩種尺寸的無頭 Chrome 驗收。
- 所有 3D 資產（`Terminal` 弧形玻璃屋頂航廈、`Jetbridge_1..5`／`JetbridgeRotunda`／`JetbridgeArm` 空橋、`Aircraft_A320`／`B738`／`A321`／`E190` 客機、`FuelTruck`、`BaggageTug`、`CateringTruck`、`CleaningVan`、`PushbackTug`、`FuelTankFarm` 油槽）由 `blender/build_apron.py` 以 Blender 無頭模式建模並匯出 `blender/out/groundline.glb`（有 commit，build 不需要 Blender），打包時以 gzip＋base64 內嵌。
- 規格與 `window.__gl` 測試 API 見同資料夾的 `SPEC.md` 與 `README.md`。
