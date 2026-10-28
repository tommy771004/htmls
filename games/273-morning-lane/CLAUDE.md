# 晨巷送報（273）

追尾鏡頭的騎車送報遊戲。Three.js 0.186.0 + esbuild，`npm run build` 打包成單檔 `web/273-morning-lane.html`（模型以 gzip＋base64 內嵌，可直接用檔案開啟）。美術規格是 `ART.md` 與 `ref/` 的參考圖，**畫面要對照參考圖，不要退回方塊拼的灰盒**（使用者看到灰盒會覺得是退步）。

## 指令

```bash
npm run build      # src/ + blender/out/*.glb → ../../web/273-morning-lane.html
npm test           # 規則層 node:test ＋ 兩種尺寸無頭 Chrome 驗收（截圖在 dist/）
npm run assets     # Blender 重新匯出模型（blender/export.py → out/_*.glb）再壓縮（tools/pack.mjs → out/*.glb）
npm run pack       # 只重跑壓縮
Blender -b --factory-startup -P blender/refs.py -- morning|dusk|night|action|sheet|kit   # 重出參考圖
node tools/uiref.mjs   # UI 參考圖 ref/ref-ui-*.png（從打包後的單檔截，要先 build）
node tools/shot.mjs 檔名 寬 高 "JS"   # 任意截圖＋回傳 JS 結果（量 info()／bench()）
```

改了 `blender/kit_*.py` 要跑 `npm run assets` 再 build；`out/*.glb` 與 `src/core/houses.json` 是產出，要一起 commit（`out/_*.glb` 原檔很大，不內嵌）。`tools/pack.mjs` 借 197 的 `node_modules`（gltf-transform、meshoptimizer）。`npm run assets` 匯出的組是 houses、housesLod、nature、props、rider；只重出一組用 `Blender … -P blender/export.py -- housesLod` 再 `node tools/pack.mjs housesLod`。

## 架構

- `src/core/`（不 import three，`node --test` 直接跑）：`config.js` 手感與尺度參數（調之前先跟使用者講觀察到的現象）、`street.js` 一條街的配置（房型、窗戶、信箱、柵欄門口、障礙物，房子尺寸讀 `houses.json`）、`bike.js` 運動學、`paper.js` 拋物線與落點判定（信箱 → 柵欄 → 房子正面窗／牆 → 落地）、`score.js` 帳本、`hazards.js` 會動的障礙（追人的狗、對向來車、灑水器）、`missions.js` 每日三個任務（計數型達標就完成；保持型如 noBump／dry 一犯規就失敗、騎完沒犯規才完成；每個 `MISSION_PTS` 150 分）、`week.js` 一週七天的街、難度、金色信箱（VIP ×3）、報紙補給包、跳台與當天任務、`settle.js` 每日結算（星等、全勤、訂戶增減）、`save.js` 存檔（純函式＋localStorage 包裝，失敗就當沒存檔）、`game.js` 固定 1/60 步的狀態機（補給包、跳台起飛／空中只會撞到車／落地；同一個障礙物只扣一次分，記在 `g.hit`）。
- `src/view/`：`assets.js` 解壓 glb、把材質標籤換成執行時材質；`world.js` 照配置擺模型（同模型同零件一個 InstancedMesh；實例照 z 存著，每前進 8 m 只裝填騎士後 30 m 到前方 270 m（手機 150 m）的實例；有 `lod:<名>` 的模型（目前只有房子）前方 70 m 內用原版、外面用遠景版）、地面 shader、晚上的亮窗（依實例位置×樓層雜湊）與路燈點光源池；`movers.js` 狗、車、灑水器（Blender 模型＋水珠）、補給包；`rider.js` 騎士；`stage.js` renderer、天空（Blender Noise Texture 的 GLSL 逐行移植，加上模擬 Blender Glare 大範圍泛光的一項）、三個時段 `LOOKS`、光、追尾鏡頭（直式螢幕另有 `CAMERA.portrait` 差量）、後製（GTAO → Bloom → 調色 → Output，NeutralToneMapping）、畫質 high／low（`?q=low`，觸控小螢幕預設 low）。
- `src/ui/`：`input.js`（三個操作：轉向、加速、丟報）、`sfx.js`（WebAudio 即時合成音效，第一次按鍵／觸控才解鎖，M 靜音）、`hud.js`（任務面板、提示、結算的任務列與「今天的路線」SVG 小地圖；版面照 `ref/ref-ui-hud.png`／`ref-ui-results.png`，底色是煙燻玻璃：使用者要求拿掉白底、融進場景但字要讀得到，見 ART.md）。

## Blender → 遊戲

- `blender/export.py` 用參考圖同一批 `kit_*.py` 建模型，把程序化材質烘成頂點色（底色 × 每面色差 × 近地面髒污）；葉片卡寫自訂法線（從樹冠中心往外）。材質名是標籤：`paint_b<筆刷>_r<粗糙度>[_e<自發光>]`、`glass`、`leaf`、`grass`，`assets.js` 依標籤建材質（筆刷條紋在 shader 用世界座標雜訊補回，葉形／草葉形是執行時畫的 alphaMap）。
- `pack.mjs` 的 `dedup` 不能合併材質（會吃掉標籤），`prune` 要 `keepAttributes`（不然葉片 UV 被刪）。meshopt 量化把縮放放在節點上，零件矩陣用 `matrixWorld`。
- 房子：`house0`–`house11` 對應 `kit_lots.py` 的前 12 種房型，正面在本地 x = 0 朝 −x。右側原樣擺在 x = 12，左側轉 180°；本地 u（沿牆寬）換成遊戲 z 是 `z − side × u`。
- 騎士：`rider`（靜態）＋ `pedal0`–`pedal7`（腿與曲柄依踏板角度換格）＋ `armsIdle`／`armsThrow`；往左丟時整台鏡射。`wheelR`／`wheelF` 由 `export.py` 的 `take_wheels` 從各格拆出（以輪軸為原點，`extras.hub` 是遊戲座標的輪軸位置），依騎過的距離轉。轉向組件 `fork`（照 151 的拆法：前叉、龍頭＋把手各是一組，都掛在轉向軸上）由 `take_fork` 從各格拆出：車架裡頭管下端以下的叉腳、金屬件裡頭管上端以上的龍頭／把手／鈴、整副握把；`extras.pivot`／`axis` 是遊戲座標的頭管軸，`extras.rad` 是打滿的角度（`kit_rider.STEER_RAD` 0.3）。前籃和車燈固定在車架上不轉。
- 手臂跟著握把：`armsIdle`／`armsThrow` 帶兩個 morph target（`steerNeg`／`steerPos`＝打滿 −1／+1）。skin modifier 重長的網格在分支點（手腕、胸口）拓樸會變，不能直接當 morph，所以 `export.py` 的 `follow()` 用回正姿勢的網格依 `kit_rider.SKEL` 骨架做線性混合蒙皮算出打滿的位置。執行時轉向輸入（−1／0／+1）平滑約 0.1 s；往左丟報整台鏡射時轉角與 morph 都要取反。
- 房子遠景版 `housesLod`：`kit_house.LOD = True` 時屋瓦一排一條長方塊（不逐片），12 種房型 38.9 萬 → 12.6 萬面。不能用 meshopt simplify：平面著色的頂點每個都是屬性接縫，一個面也減不掉。
- 天空對照：`Blender -b --factory-startup -P blender/refs.py -- sky-morning` 只渲天空到 `dist/`，和 `__ml.skyOnly()` 的截圖比。

## 座標

騎士往 −z 前進，+x 是右手邊。Blender X = 遊戲 x、Blender Y = 遊戲 −z。橫斷面：車道半寬 3.6、草帶到 5.0、人行道到 6.8、柵欄 7.0、房子正面 12.0，草坪高 0.12（`BASE`）。

## 測試 API（`window.__ml`）

`state()`（含 day、time、quality、dogs、cars、save）、`start()`、`pause(bool)`、`advance(n, {steer, accel, throw})`（確定性步進）、`reset(k)`（重騎第 k 天，0＝週一）、`wipe()`（清存檔）、`setCam('near'|'far')`、`set('HAZ.dogSpeed', v)`（即時調參）、`cfg`、`gtao(bool)`、`perf()`、`bench(n)`（同步渲染量耗時）、`info()`、`counts()`、`assets()`（各資產零件與面數）、`sky`（天空材質）、`skyOnly()`、`movers()`、`items()`（跳台與補給包）、`look([眼], [看向])`（相對騎士的特寫鏡頭，`look(null)` 還原）。`?fps` 在右上角顯示幀時間、draw calls、三角形（給實機量）。截圖用 `node tools/shot.mjs 檔名 寬 高 "JS"`。

## 還沒做

手機實機效能沒量過（`?fps` 可在手機上看；這台 Mac 上 390×844 low 畫質整幀約 131 萬三角形、413 draw calls）、天空的雲量與天頂色和參考圖仍有差（天頂 `#679be2` 對 `#70a5f6`）。
