# 白城環線 · BELVEDERE LOOP（275）

以 **Three.js r187（`0.187.0`）** 打造的全程式碼生成等角視角歐風微縮城市（Architectural Miniature Diorama）。**零匯入 3D 模型、零外部貼圖、零外部網路請求**；由 `esbuild` 打包為單一檔案 `web/275-tramway-plaza.html`。

## 指令

```bash
/opt/homebrew/bin/node tools/build.mjs          # src/ → ../../web/275-tramway-plaza.html
/opt/homebrew/bin/node tools/build.mjs --dev --out=dist/dev.html
/opt/homebrew/bin/node tools/accept.mjs         # 1440×900 與 390×844 無頭驗收 + 各分區截圖 (dist/) + ../../thumbs/275.jpg
```

## Three.js r187 新特性與效能架構

- **`WebGPURenderer` + `RenderPipeline`（自動退回 WebGL2）**：採用 r187 正式取代 `PostProcessing` 的 `RenderPipeline`，避免棄用警告；原生支援 WebGPU，無 WebGPU 環境（或 `?gfx=webgl`）自動退回 WebGL2 TSL 後端。
- **`NodeMaterialInstance` + `materialReference()`**：r187 將 `ProxyNodeMaterial` 正式定名為 `NodeMaterialInstance`。四種奶油色歐風建築灰泥／石灰岩共用同一份 `stuccoMaster` TSL 著色器編譯結果，僅以實例屬性切換色溫與粗糙度偏移。
- **`GTAONode`（二次方近場步進 + `projectionDepth()` + `builtinAOContext`）**：透過法線與深度 MRT 預通道計算螢幕空間環境遮蔽，僅作用於間接環境光，不污染受光屋頂與暖光窗戶。另搭配 `ContactDecals`（`InstancedMesh` 徑向接觸貼片）與攝影棚桌面 TSL 柔光箱接觸陰影墊，確保建築基座、橋墩、樹穴與微縮底座皆有柔和接觸陰影。
- **為什麼不用 `SunLight`**：官方 `SunLight.js` 明載 CSM 級聯陰影不適合微縮模型／Diorama 等小型有界場景（內容會落入最低解析度級聯），因此採用緊密包圍盒的單一 `DirectionalLight`（2048×2048，r187 內建 5 點 Vogel Disk × IGN 等效 20-tap 柔邊濾波）。
- **Draw Call 與面數控制**：各區塊靜態幾何透過 `GeoKit` 依材質分桶合併（`mergeGeometries`）；行道樹／公園樹枝幹、樹冠葉團、古典街燈、軌道枕木與接觸陰影貼片皆為 `InstancedMesh`。

## 分區模組（支援「每次只改一個區塊」逐步細修）

- `src/config.js`：底座、道路網格、跑道形封閉曲線 `sampleLoop()`、7 棟奶油歐風建築參數與 7 組鏡頭預設。
- `src/materials.js`：TSL 程序材質庫與 `NodeMaterialInstance` 灰泥系列。
- `src/renderer.js`：渲染器、`RenderPipeline`、`GTAONode`、PMREM 柔光棚環境圖與 `OrbitControls`。
- `src/zones/plinthRoads.js`：微縮底座、桌面接觸柔影、沉降柏油車道、虛線、斑馬線、樹穴與街燈。
- `src/zones/plazaClock.js`：洞石中央廣場、綠籬圓形噴水池（含動態水珠）、鐘塔市政廳（四面可動指針時鐘）、露天陽傘咖啡座與長椅。
- `src/zones/buildings.js`：7 棟奶油色歐風街屋與高架環內花園公寓（門窗、雨棚、屋簷、女兒牆欄杆、屋頂閣樓與水塔）。
- `src/zones/viaductTrain.js`：環狀高架橋箱樑、圓柱橋墩、道碴雙軌、架空電車線、8 肋拱頂高架車站、雙段石造大階梯與持續行駛的雙節鉸接歐風輕軌電車。
- `src/zones/westPark.js`：西側圓角綠地公園、有機曲線水池、池岸景石與八角木造涼亭。
- `src/zones/foliage.js`：自然分叉枝幹與多團通透樹冠、灌木叢、屋頂花園植栽（2 個 `InstancedMesh`）。

## 測試與檢視 API（`window.__city`）

- `ready`、`revision`（`'187'`）、`backend`、`preset(key, instant)`、`setCamera({ pos, target, fov })`、`setGTAO(bool)`、`setLighting(mode)`、`setClean(bool)`、`setTrainU(u)`、`advance(sec)`、`info()`。
- 網址參數：`?clean=1` 隱藏介面、`?gfx=webgl` 強制 WebGL2 後端、`?q=low` 輕量畫質。
