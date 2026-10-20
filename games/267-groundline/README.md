# 267 — Groundline · 機場停機坪即時調度

像策略遊戲一樣玩的機場停機坪即時調度網頁（類別：**遊戲敘事**），成品打包為單一檔案 [`../../web/267-groundline.html`](../../web/267-groundline.html)。

## 建置與驗收

```bash
# 1. 以 Blender Python 腳本重建低多邊形 3D 資產（blender/out/groundline.glb）
node tools/assets.mjs

# 2. 執行模擬核心單元測試（過站 6 步驟、車輛派遣、連鎖延誤傳遞）
node tools/sim.test.mjs

# 3. 打包成零外部依賴單一 HTML（內嵌 gzip+base64 GLB 與 Three.js）
node tools/build.mjs

# 4. Playwright 無頭瀏覽器驗收（1440×900 桌機與 390×844 行動版）並擷取縮圖
node tools/accept.mjs
```

## 結構

- `blender/build_apron.py`：透過 Blender Python API 建立低多邊形、柔和配色的航廈（5 跨弧形玻璃屋頂與塔台）、5 座可轉向空橋（`Jetbridge_1..5`、`JetbridgeRotunda`、`JetbridgeArm`）、客機（`Aircraft_A320`、`Aircraft_B738`、`Aircraft_A321`、`Aircraft_E190`）、加油車（`FuelTruck`）、行李拖車（`BaggageTug`）、升降餐車（`CateringTruck`）、清潔車（`CleaningVan`）、後推車（`PushbackTug`）與航空油槽區（`FuelTankFarm`），匯出 `blender/out/groundline.glb`。
- `src/sim.js`：純 JS 停機坪調度模擬引擎（6 步驟過站流程：`到站 → 下客 → 清潔 → 加油 → 登機 → 推出`、各步驟時間與延誤機率、優先順序調度、車輛派遣路徑規劃與同登機門後續航班連鎖延誤計算）。
- `src/scene.js`：Three.js 等角俯視 3D 場景（支援 `OrbitControls` 縮放旋轉、DecompressionStream 解壓內嵌 GLB、跑道與滑行道黃色標線程序貼圖、空橋對接伸縮動畫、地勤車沿道路網自動行駛、3D 射線點選）。
- `src/audio.js`：WebAudio 合成調度點擊、車輛派遣、延誤警示與離場推出音效。
- `src/main.js`、`src/index.html`：HUD 介面（頂部 4 張 KPI 指標卡、右上模擬時鐘與倍速控制、左下選中航班過站時間軸與連鎖延誤提示、右下航班／車輛／登機門分頁清單與進度條）。
