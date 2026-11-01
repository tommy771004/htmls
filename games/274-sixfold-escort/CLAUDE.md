# 六器鏢行 · SIXFOLD ESCORT（274）

原創武俠動作 RPG。**動手前先讀同資料夾的 `GLOSSARY.md`**：世界觀、名詞對照（舊名禁用）、程式識別字、美術方向，以及 `chars.js`、scene／hud 之間的介面契約都在那裡。
這個資料夾的第一版照一款現存網遊做，現已全部改成原創；`GLOSSARY.md` 左欄的舊名在 `src/`、`tools/` 與打包產出裡都要維持 0 筆。esbuild 會把中文跳脫成 `\uXXXX`，掃打包產出前要先還原。

Three.js 0.186.0（`three/webgpu` + `three/tsl` 節點材質，無 WebGPU 時自動退回 WebGL2）+ esbuild，`npm run build` 打包成單檔 `web/274-sixfold-escort.html`，並把 `blender/out/*.glb`（不以 `_` 開頭者）gzip＋base64 內嵌成 `<script id="glb-<檔名>">`。場景、怪物、偃甲、六器與鏢局大堂全部程式建模，人物底模是 Quaternius CC0。零外部網路請求，系統字，WebAudio 即時合成音效。

## 指令

```bash
npm run build       # src/ → ../../web/274-sixfold-escort.html（壓縮）
npm run dev         # 不壓縮版 → dist/dev.html（不會蓋掉正式產出）
node tools/build.mjs --out=dist/world.html       # 打包到別處（截圖、比對用；加 --dev 不壓縮）
npm test            # node --test tools/core.test.mjs（規則層）＋ node tools/accept.mjs（驗 web/ 的正式產出：1440×900、390×844、667×375，截圖 dist/accept-*.png）
node tools/accept.mjs [單檔] --prefix=rv-       # 驗別的檔、截圖換前綴（或設 SHOT_PREFIX）
npm run shot -- [--soft] [--only=street,canopy]  # 先打包 dist/world.html 再拍場景鏡頭 → dist/world-<鏡頭>-<gpu|soft>.png
node tools/shot.mjs --file=../../web/274-sixfold-escort.html   # 直接拍正式產出（路徑相對於本資料夾）
npm run preview:actors -- [--only=gpu|soft] [--shots=lineup,back,close,weapons]   # 只打包 chars.js／weapons.js 的人物預覽 → dist/actors-*.png
npm run thumb       # ../../thumbs/274.jpg（640×400，構圖取 sceneView.thumbPose()）；試拍用 --out=dist/thumb-274.jpg（全尺寸原圖一律另寫 dist/thumb-full.png）
npm run assets      # Blender 無頭重建 blender/out/actors.glb（會覆寫已 commit 的檔）；素材讀 ../197-openworld/.cache/{ubc,ual}，可用 QUATERNIUS_CACHE 改路徑
```

改了 `src/` 或 `blender/out/` 要重新 build，把 `web/274-sixfold-escort.html` 一起 commit。`npm test` 驗的是 `web/` 裡的正式產出，所以要先 build 再 test。
無頭 Chrome：`tools/lib.mjs` 的 `open()` 依序用 `CHROME_PATH`、`~/Library/Caches/ms-playwright/chromium-*`，都沒有時改用系統 Chrome（會搶視窗焦點）；先試 Metal GPU，開不起來才退回 SwiftShader／WebGL2。網址預設帶 `?fresh=1`。

## 架構

- `src/core/`（純 JS，不 import three，`node --test` 直接驗證）：`data.js` 靜態資料、`combat.js` 四維屬性（臂力／身法／根骨／內息）／五行／罡氣破罡三態／通玄／鍛器爐溫／兵器光效名、`proto.js` 二進位封包與存檔、`world_sim.js` 確定性世界狀態機（`step`／`advance`，含寄攤、換手、烽燧、偃甲樞力、酣戰、`snapshot()` 存檔；沒有舊存檔遷移，讀檔時不認得的淬石 id 直接丟掉）。
  - 失敗一律走 `world_sim.js` 的 `fail(reason, msg)`：寫一則驛報加一個跳字，回 `{ ok: false, reason }`。新的操作也照這樣做，不要靜默失敗。同一個 reason 在 1 秒（`simTime`）內只提示一次；`fail(reason, msg, { log: false })` 只跳字不寫驛報（`COOLDOWN`、`IGNITING` 這樣用）。自動施放／自動服藥的失敗保持安靜。
  - 轉職只能往 `data.js` 的 `REBIRTH_NEXT` 列出的下一階或分支走，不能回頭；換五行要付 `REFORGE_ELEMENT_COST`（烏鋼＋銅錢），走 `world.reforgeWeaponElement(uid)`。
- `src/view/`：
  - `shaders.js`：建立 renderer；地面、水、天空、環境圖、朱砂引路線、刃風、兵器光暈的 TSL 材質；`groundHeight()`。
  - `kit.js`：程式建模工具 `Kit`（依材質收集幾何，每種材質合併成一個 mesh）、`T()` 矩陣、共用材質表 `MAT`、屋頂、齒輪、文字與鏢旗貼圖。
  - `scenery.js`：三張地圖，回傳 `{ group, npcs, beaconViews, portals, colliders, update }`；`paifang()`（四柱三間三樓牌坊）、`portalMarker(..., style)`（`'stele'` 界碑／`'crack'` 地縫）。
  - `creatures.js`：程式建模的怪物與練功樁。人形的蘆葦小賊、劫鏢匪、頭目改走 `chars.js`。
  - `mech.js`：偃甲三階（竹骨／銅骨／金樞「不周」）。`hall.js`：開場的順安鏢局大堂，位置在 `HALL_ORIGIN` (0, 0, 400)。
  - `weapons.js`：六器與背上的六器匣，握把座標系見檔頭。`chars.js`：骨架人物（actors.glb，衣著由 TSL 依綁定姿勢分區上色），契約見 GLOSSARY。
  - `models.js`：只剩每張地圖的天色表 `MAP_LOOK`，以及上面幾個模組的轉出口。
  - `scene.js`：相機、粒子、拾取、名牌錨點與開場切換。
- `src/ui/`：`hud.js`（PC 匣列／觸控扇匣雙模、鏢單、羅盤、名牌、跳字、入局帖）、`drawers.js`（八個抽屜：人物、六器匣、鍛爐、偃甲、行會、鏢路圖、懸紅榜、說明・操作）、`icons.js`（原創 inline SVG：兵器剪影、技能字形、鏢旗、朱文印 `stampSvg`、羅盤環）、`sfx.js`。
- `src/main.js`：輸入事件（抽屜開著時只收 Esc 與抽屜熱鍵；視窗失焦時放開所有按鍵）、主迴圈（每 5 秒自動存檔；入局帖還開著時不算）、`window.__sf`。
- 測試 API `window.__sf`：`ready`、`world`、`sceneView`、`hud`、`sfx`、`start()`（等同按「立帖入局」）、`state()`、`advance(sec, input)`（`input` 可為 `null`）、`info()`（draw call／三角形數）、`wipe()`（只清世界存檔 `sixfold_escort_274_v1`，外觀與匣序不清）。
- `sceneView` 對外：`updateVisuals`、`render`、`resize`、`projectToScreen`、`pickGroundOrEntity`、`orbitBy`（俯角夾在 0.32～1.08）、`zoomBy`（距離夾在 8.5～24）、`getCameraAngles`、`setIntro`、`setHeroLook`、`anchors`、`isIntro`、`heroActor`、`thumbPose()`（回傳 `{ map, x, z, rotY, yaw, pitch, dist }`）、`setShowcase(on)`（縮圖用：不畫鎖定圈、亮刃圈、衝擊圈，碎片減半）、`info`，以及 `setCamera({ yaw, pitch, dist, focus })`。`setCamera` 不夾範圍；`focus` 設了就一直有效，要 `setCamera({ focus: null })` 才會回到跟著主角。

## 網址參數與本機儲存

- `?fresh=1`：不讀也不寫世界存檔、入局帖外觀與六器匣次序（驗收工具預設帶）。`createGameWorld({ restoreSave, persist })` 的 `persist: false` 就是這個模式。
- `?gfx=webgl`：強制走 WebGL2，用來測退回路徑。`?debug`：鏢單顯示網路延遲。
- localStorage：`sixfold_escort_274_v1`（世界存檔，proto.js／`world.snapshot()`）、`sixfold_escort_274_look`（入局帖外觀，hud.js）、`sixfold_escort_274_box`（六器匣次序，hud.js）、`sixfold_escort_274_mute`（M 靜音，hud.js；`?fresh=1` 時不讀不寫）。

## 按鍵（main.js）

WASD／方向鍵移動；左鍵點地面走過去、點目標鎖定；右鍵拖曳轉視角、滾輪縮放。1～6 匣中取器出招（上機後 1、2 換成偃甲專屬技）、7～9 內功、Space 輕功、Q／E／R 服藥、V 偃甲（讀條中再按一次取消）、F 點烽燧、Z 自動狩獵、M 靜音；C 人物、K 六器匣、U 鍛爐、T 偃甲、B 行會、G 鏢路圖、J 懸紅榜、H 說明・操作；Esc 關抽屜（輸入框裡也行）；入局帖上按 Enter 立帖。亮刃只有介面按鈕。改按鍵時要一起改 `main.js` 的 `DRAWER_KEYS`、`hud.js` 的 `TABS[].key`，以及 `drawers.js`「說明・操作」裡的按鍵說明。

## 座標與相機

- 主城青萍渡（`1001`）出生點 `(0, 4)`。可走範圍 |x|、|z| ≤ 25.5，大建築放在範圍外或邊緣。走路只擋 `data.js` 的 `MAP_BLOCKERS`（每張圖幾個 `[x0, z0, x1, z1]` 矩形：鏢局院落、倉房、井、烽燧台基、遺墟石柱），`world_sim.js` 的 `pushOutOfBlockers` 在移動、輕功、自動走位與怪物追擊後把人推出去；新增建築要擋就加在這裡，並跑 `core.test.mjs` 的可達性測試（出生點、傳送點、攤位、NPC、烽燧都要走得到）。`colliders`（`THREE.Box3`，要包到屋簷）只給相機防擋用，鏡頭拉到 3.5 m 還在牆裡就往上爬俯角；焦點本身在某個 collider 裡時那個 collider 不算（`cameraBlocked` 的 `containsPoint` 跳過），不然射線在 t=0 就打中、鏡頭會縮成一團。
- 追尾相機在角色 `+z` 往 `-z` 看（`camYaw = 0`；鏡頭位置＝焦點＋(sin yaw, ·, cos yaw)×距離），預設俯角 0.46；焦點在主角前方 `camLead` 公尺（橫式 2.0、直式 0.8），主角落在畫面下三分之一。高的建築放在 `-z` 遠景或東西兩側。
- 順安鏢局在北邊（z ≈ 21.6），門樓與正廳朝 −z（朝街）。
- 朝向慣例各檔不同，以檔頭為準：`chars.js` 的 `actor.root.rotation.y = 0` 面向 −Z；`creatures.js`、`mech.js` 的模型面向 +Z，`root.rotation.y` 直接用 world 的 `rotY`。

## 坑

- 透視溶解（`kit.js` 的 `nearFade`）：`MAT` 裡每種材質都會把貼近鏡頭的片段點狀溶掉，近景道具不會變成黑楔。溶解半徑 r0＝max(2.3 m, 鏡頭到主角距離 × 0.35)，從 r0 到 0.56·r0 漸空；鏡頭離地＝1.35＋距離×sin(俯角 ≥ 0.32)，永遠大於 r0，所以地面不受影響。改 `orbitBy` 的俯角下限或 `zoomBy` 的距離上限前要重算這條。路邊樹另用 `canopy`／`canopyWood`：建模前設 `k.tag = [cx, cy, cz, R]`（那棵樹的包圍球），**建完要 `k.tag = null`**，不然後面的零件都會被標成同一棵樹。溶掉的只有畫面，陰影照投（`maskShadowNode`）；`scene.js` 每幀更新 `uSeeCam`／`uSeeFocus`，開場大堂時 `uSeeOn = 0`。
- `Kit.add` 只保留 position／normal／color（uv 會被刪），要貼圖的東西另做 mesh（`decalMaterial`）。`lathe` 的輪廓 y 要遞增，法線才朝外。
- 介面裡的朱文印一律叫 `stamp`（`stampSvg`、`#breakStamp`、`.low-stamp`）；偃甲合體時封住的匣格 class 是 `.shut`。不要用 `seal`，舊名掃描會把它抓出來。
- `tools/accept.mjs` 會檢查頁面文字不含舊名，禁用字本身用 `\u` 跳脫寫，讓腳本自己在掃描裡也是 0 筆。新增禁用字時照同樣寫法。
- 開場大堂用 `actor.setIntroHold(true)`：一律播 `idle`，兵器照 `chars.js` 的 `HOLD_Q` 擺成展示握法（飛針收在匣裡）；離開開場要 `setIntroHold(false)`。
- 跳字（`hud.js`）以名牌錨點往上堆疊；招式名跳字（kind `'skill'`）放在畫面下方，蓋「破」字印時先不顯示。玩家可輸入的字（名號、攤招）進 innerHTML 前一律 `escHtml`。
- 「破」字印（`stampBreak`）放在 `#targetCard` 下方，不蓋目標卡血條；印在畫面上時，跟印重疊的跳字會往左右較近的一側讓開，那側被面板擋住就換另一側，兩側都不行才落到印下方。
- `T()` 是平移·旋轉·縮放，縮放先於旋轉：要做「斜放再拉長」的零件（例如牆頂瓦脊），先把幾何本身轉好（`geometry.rotateY`），再用 `T()` 的縮放拉長，不然轉 45° 的方錐會被拉成一片斜楔。
- 鏢路圖節點字由 `drawers.js` 的 `layoutRouteLabels` 貪婪排位（右、左、右下、左下），重疊判斷分「圖釘」與 `.wl` 字兩塊；抽屜目前的頁面寫在 `.drawer-body[data-view]`（不要用 `data-tab`，hud 會對 `[data-tab]` 切 `active`）。直式（≤ 640px）鏢路圖獨佔一列；橫式抽屜頁籤是兩欄格。
- `shot.mjs` 不會自己重新打包（`npm run shot` 會）；`dist/world.html` 舊了，拍出來的就是舊畫面。
