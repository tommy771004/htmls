# Handoff — OpenWorld 求生（2026-10-02，10-03 更新）

> 2026-10-03 已移入作品集（第 197 件）：原本的 `public/` 改放在 repo 的 `assets/197/`，下文的 `public/…` 都對應到那裡；現在是 htmls repo 的一部分，有 git 版控。執行與打包見 `README.md`。

給下一個 session。專案說明、結構、操作、效能設計都在 `README.md`；外部資產來源與授權在 `CREDITS.md`；原始需求在 `Readme.txt`。這份文件只記錄那些地方沒寫的東西：目前做到哪、哪裡還沒調好、環境上的坑。

## 使用者的目標

「以最高標準接近真實、更精緻的畫面，包括人、事、物」。最後一個指示是：**從網路上找開放的高品質 CC0 的樹、岩石、動物、人物模型放進 `public/`**。

## 色調（2026-10-03 已調完）

接進 ambientCG 掃描貼圖後畫面泛白、帳篷灰、木頭灰的原因不是色彩空間（照片都已是 sRGB），而是**照片本身的平均色**：林地照片 sRGB(152,147,87) 偏亮偏黃、帆布 (91,90,91) 是中性灰、木板 (89,79,70) 灰褐。
做法是在 `src/world/surface.js` 加了 `tintToMean(image, targetSRGB)`：算出「照片平均色 → 目標色」的線性乘數，乘到材質 color 或地形 tint 上，紋理細節保留、整體色調對齊。用在：

| 對象 | 位置 | 目標平均色（sRGB） |
|---|---|---|
| 草地底色 | `surface.js` 的 `GROUND_MEAN`；`grassTint` 飽和度 0.92 | (92,102,60) |
| 草葉根部／尖端 | `grass.js` 的 `uBase`／`uTip` | (88,104,46)／(136,158,76) |
| 闊葉 | `scatter.js` 的 `broadTint`；`foliage.js` 葉片蓋章縮成 `len * 0.8`、密度 `seg / 6` | (60,84,34) |
| 帳篷帆布 | `props.js` 的 `clothColor` | (150,134,100) |
| 原木／深色木料／碼頭甲板 | `props.js` 的 `planks(...)`、`planksTint(...)` | (104,78,54)／(70,53,39)／(104,82,58) |
| 掃描岩石 | `scatter.js` 掃描岩石分支 | (92,84,70) |

另外：地形遠景岩壁的收斂色從 `vec3(0.2,0.19,0.17)` 改成掃描岩石的實際平均 `vec3(0.085,0.08,0.068)`（原本亮 2.5 倍，遠山因此發白）；地形頂點色整體壓低約 0.04。
這個場景的環境光很強（`hemi` 白天 3.0＋IBL 0.45，太陽 4.4），所以目標色要比「真實反照率」再暗一些，否則受光後會近乎白色。

## CC0 掃描模型（2026-10-03 已接上一部分）

這台 Mac 的網路可以直接連 Poly Haven（`api.polyhaven.com` 與 `dl.polyhaven.org/file/...`），先前被擋的是另一台電腦的公司網路。
`tools/fetch-polyhaven.mjs`（`npm run assets` 會接著跑）下載 1k glTF、用 meshoptimizer 減面、去掉 arm 貼圖，輸出 `assets/197/models/ph/<id>.glb`（近景）與 `<id>_far.glb`（遠景，只有幾何）。
執行時由 `src/game/assets.js` 的 `SCANS`／`loadScans()` 載入，`scatter.js` 的 `fitScan()` 把模型擺正後交給原本的分塊 InstancedMesh 與 LOD；缺檔時退回程序生成。

| 資產 | 用途 | 面數（近／遠） |
|---|---|---|
| `rock_07` | 小石塊（個體縮放 < 1.05） | 2200／258 |
| `rock_face_02` | 大岩塊 | 2997／463 |
| `tree_stump_01` | 110 個腐朽樹樁（原物就是像土丘的爛樹樁） | 2397／459 |
| `dead_tree_trunk` | 55 根順著坡度擺的倒木 | 3000／356 |
| `fern_02` | 四株併成一叢，420 叢，只在 120 m 內的區塊畫、不投影 | 6232／— |

試過但沒用：`boulder_01`（UV 接縫太碎，減面卡在 5.4 萬面）、`rock_09`（只有 14 cm）。素材總量從 43 MB 增加到 54 MB。

### 已知但還沒處理

- **夜裡草葉比地面暗很多**，看起來像一根根黑刺（22:00 營地視角最明顯）。草的 shader 只吃 `env.grassAmbient`／`grassSun`（`grass.js`），地形另外還有天空 IBL（`scene.environmentIntensity` 0.45）與月光，夜間兩者落差大。方向：讓草的環境光也加上 IBL 的平均亮度，或夜間把地形的 IBL 壓低。

### 樹

Poly Haven 的樹每棵 30 萬到 1700 萬面（`jacaranda_tree`、`fir_sapling`、`island_tree_*`），場景有上千棵 instanced 樹加風場與 LOD，換不動；頂多拿一兩棵當營地旁的主景。

## 人物與動物（2026-10-03，使用者選擇「接受卡通風」）

改用 Quaternius 的 CC0 素材，三個 NPC 與馬都換掉了，原本 three.js 範例裡授權不明的人物（Ready Player Me、Mixamo 的 Xbot／Soldier）與 ro.me 的馬已從專案移除。

- **下載**：`tools/fetch-quaternius.py` 走 itch.io 的官方免費下載流程（POST `/download_url` → 下載頁 → POST `/file/<upload_id>`，不帶 key 參數），三包 Standard 版共約 440 MB，解壓在 `.cache/`（gitignore）。
- **NPC**：`tools/build-characters.py`（`blender -b -P`）把 Universal Base Characters 的 Superhero 底模依骨頭權重只留頭與脖子，接上 Modular Character Outfits（阿哲：遊俠拿掉兜帽與護肩；老陳：農民第二組配色＋大鬍子；小安：女遊俠戴兜帽），服裝與頭髮改綁底模的 armature，貼圖縮成 1K JPEG、拿掉 ORM。每人約 2–3 萬面、1.7–3 MB。
- **動畫**：四包都是同一副 65 根骨頭、UE 命名（`pelvis`、`upperarm_r`、`Head`…）的骨架，`tools/build-anims.mjs` 從 Universal Animation Library 挑出六段（待機、說話、走、慢跑、坐、坐著說話），拿掉縮放與骨盆以外的位移軌，208 KB。執行時 `npc.js` 的 `RiggedBody` 直接播，原本給 Xbot 轉接用的 `getCivilianClips` 已刪。說話在 `facePlayer > 0` 時混進來；釣魚沒有現成動畫，沿用在待機之上擺手臂骨頭的做法。
- **頭髮貼圖是灰階**（原作在 shader 裡上色），`RiggedBody` 依 NPC 的 `look.hair` 把名稱含 hair 的材質染色。
- **馬**：Farm Animals Animated 的 Horse（375 面，平面著色），`tools/build-animals.py` 從 FBX 轉 GLB。FBX 匯入後材質 Alpha 會變 0、匯出成 MASK 就整隻透明，腳本裡已改回不透明。野馬群改播 `Run`（原本取第一段，在這包會是 Death）。

### 還沒做

- **鹿、雄鹿、狐狸、狼**：在 Quaternius 的 Ultimate Animated Animals，只放在作者的 Google Drive（資料夾 `1uJ3N5HfB7jKTseJUNQr3N4YaN0UuEtHk`，glTF 子資料夾 `1yJXdB1iSrI8Db7hG77zxZ66vKsqIt0ry`，檔案 ID 已記在 `fetch-quaternius.py`）。2026-10-03 整天都回「Quota exceeded」。解法：使用者在瀏覽器打開資料夾下載 `Deer.gltf`、`Stag.gltf` 等放進 `.cache/animals/`，或「新增捷徑／複製到自己的雲端硬碟」後下載。拿到後在 `build-animals.py` 的 `ANIMALS` 加一行，再把 `wildlife.js` 的鹿換成骨架動畫（目前鹿與兔是 `fauna.js` 程式放樣、可狩獵，換掉要接 Idle／Walk／Run／Death）。
- **鳥**：仍是 three.js 範例的 Stork／Parrot／Flamingo（ro.me），Quaternius 沒有對應的鳥。
- **兔子**：Quaternius 的動物包沒有兔子，維持程式放樣。

## 環境上的坑

- **記憶體很緊**（16 GB，常剩 1–2 GB）。headless 測試曾被 Claude Code 因記憶體不足終止；被終止後要等使用者同意才能重跑。
- **使用者要求測試在背景跑、不可操控滑鼠**。用 `?debug` 網址（不請求 pointer lock）、headless Edge、`--mute-audio`、`run_in_background`。
- `curl` 要加 `--ssl-no-revoke`。
- **在 bash heredoc 裡寫含中文的 node 腳本會亂碼**（比對字串失敗）。要改檔請用 Edit／Write，或把 patch 腳本用 Write 存成檔再執行。
- 不是 git repo，沒有版控可回復。
- dev server（`npx vite --port 5173 --strictPort`）可能還在背景跑；埠被佔用時先確認是不是它。

## 驗證方式

2026-10-03 在 Mac 上改用 Chrome for Testing 無頭模式＋`--use-angle=metal`（真 GPU），對 `npm run dev` 的 `?debug` 拍 16 個固定視角比對；`__game.worldInfo.spots` 有樹、石頭、樹樁、倒木、蕨叢的位置，可以直接把相機對準。

測試腳本在上一個 session 的 scratchpad，不在專案裡，需要重建。做法：`playwright-core` 用 `channel: 'msedge'` 開 `http://127.0.0.1:5173/?debug`，等 `window.__game.started`，用 `page.evaluate` 操作 `__game`（例：`__game.player.teleport(x, z)`、`__game.env.time = 22`、`__game.env.setWeather('rain')`、`__game.paused = true` 後直接設 `__game.camera`），再截圖。`__game.stats` 有 FPS、draw call、三角形數。

常用視角座標：營地 `(4.5, 8.5)`、樹林山坡 `(-14, -22)`、樹下 `(-30, -30)`、湖岸 `(16, -6)`、鳥瞰湖 camera `(-10, 24, 10)` 看向 `(72, 0, -34)`、岩壁 camera `(35, 30, -80)` 看向 `(70, 25, -150)`。碼頭與 NPC 位置從 `__game.dock`、`__game.npcs[i].pos` 取。

## 從未驗證過的

- 真實滑鼠操作（pointer lock 流程、視角手感）、背包面板的點擊與拖曳。
- 所有音效（`src/core/audio.js`，測試都是靜音）。

## 已知的實際水準

中畫質在 Intel UHD 630、1280×720 約 50–60 FPS；高畫質在這顆內顯上要降到 0.6× 解析度。第一人稱的手與武器、車、船、床、道具仍是程式建模（`tools/make-models.mjs`、`src/game/vehicles.js`、`src/world/props.js`）。

## Suggested skills

- `run`：啟動 dev server 並在真實畫面確認改動。
- `research`：找可連線的 CC0 模型來源時用，不要連續手動抓網頁。
- `diagnosing-bugs`：shader 編譯失敗或畫面異常（例如先前的 MSAA 爆亮點、動畫轉接翻轉）時用。
- `dataviz` 不需要；`artifact-*` 不需要。
