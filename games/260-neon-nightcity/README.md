# 260 霓虹夜城 · NEON NIGHT CITY

單檔成品：[`web/260-neon-nightcity.html`](../../web/260-neon-nightcity.html)，縮圖 [`thumbs/260.jpg`](../../thumbs/260.jpg)。分類：遊戲敘事。

凌晨兩點的雨夜街區。可以開楔形跑車 Kestrel、騎 Hanzo 機車，或下車走路；LAZARUS 夜店今晚只放名單上的人，要先到 7 St 的 AFTERGLOW 酒吧找 Juno 拿火柴盒，再回去說服門口的 Marlo。

9 St 的 VELOCE MOTORS 車行展示 12 台程式建模的車與 10 台實車模型（8 台汽車、2 台機車），可以看規格、試駕 60 秒或買下；買來的車停在舊碼頭 8 St 的私人車庫 GARAGE 07，可以從車庫開出去、賣回車行，或把座駕開回門口停進去。程式建模的車型參考經典跑車、超跑、肌肉車與古董車的線稿剪影：金龜車、後置引擎跑車、美式肌肉車、日系性能雙門、長頭 V10、豪華跑旅、三〇年代敞篷、八〇年代楔形超跑、稜角 V12、中置單座、十六缸極速超跑與賽道級超跑，都是虛構車名，不放任何廠牌字樣或標誌。實車模型是 Sketchfab 上 CC BY／CC BY-NC-SA 的 BMW 與 Porsche 同人模型（M3 E92、M3 Competition、M4 寬體、M3 GTR、M3 Touring 24H、M4 GT3 EVO、911 GT3 RS、911 GT3 R、S1000RR 兩代），保留原作的名稱、彩繪與標誌，看車對話標示作者與授權，來源見 [`assets/260/CREDITS.md`](../../assets/260/CREDITS.md)；非官方作品，與車廠無關。錢靠甩尾打賞（手煞車側滑越久倍率越高，撞車那段不算）與任務獎金，現金、擁有的車、塗裝與目前座駕存在 `localStorage`（`nc260.motors`）。

畫面方向參考 @Ainthropos 的 Three.js 雨夜城市影片：紅磚與石材立面、濕地上的霓虹倒影、霧與路燈光錐、亮著窗的店面、成排車流與撐傘行人，HUD 有地名、時鐘與小地圖。

## 指令

```bash
npm run build    # 打包成 ../../web/260-neon-nightcity.html（--dev 不壓縮）
npm test         # tools/accept.mjs：1440×900 走完整段任務、開車、地圖，390×844 觸控版；SHOT_DIR=… 會存截圖
npm run thumb    # tools/thumb.mjs → ../../thumbs/260.jpg；THUMB="車 dx,dz,車 yaw,相機 yaw,pitch,遠近" 可調構圖
npm run assets   # 用 Blender 重建 blender/out/*.glb（需要 Blender 5.x）
npm run cars     # tools/cars.mjs：.cache/cars/ 的 Sketchfab 原檔 → ../../assets/260/<id>.glb 與 cars.json（可只給 id）
npm run test:glb # tools/glb-check.mjs：本機 HTTP 開頁，檢查實車下載、展示廳、買車開車、機車、換色規則與車庫；CLOSEUPS=1／CITY=1 加拍特寫與街景
node tools/car-view.mjs <id>   # 四視角檢查單台模型（輪子塗紅、車漆塗藍），確認車頭朝 +z 與輪子拆分
```

### 實車模型

- 原檔放在 gitignore 的 `.cache/cars/`（檔名對應 `tools/cars.mjs` 的 `MODELS`），處理後的 `assets/260/*.glb`（約 27 MB）與 `cars.json` 有 commit；`cars.json` 在打包時併進頁面（車長、輪距、軸距、輪徑、可否換色、作者與授權）。
- `tools/cars.mjs` 每台車：依 `len`（真實車長）縮放、長軸轉到 z、`flip` 讓車頭朝 +z、接地；從落地的連通塊找出輪胎，整塊落在輪子圓柱裡的零件（輪框、碟盤、卡鉗）拆成 `wheel_FL`…（機車 `wheel_F`／`wheel_R`），節點原點在輪軸；材質係數寫進頂點屬性（`COLOR_0`、`_PBR` 粗糙／金屬／清漆／車漆旗標、`_EMI` 自發光＋燈種），同一張貼圖的零件合成一個 primitive；最後減面到 `tris`、貼圖轉 1024 WebP、meshopt 壓縮。車漆材質自動挑（名稱有 paint 或面數最多的清漆材質），`paint: [名稱]` 指定、`paint: false` 不換色；有彩繪貼圖的車不能在 CHROME WORKS 換色。
- 頁面（`26-glb.js`）只有以 http(s) 開啟時才下載，而且是走進展示廳、車庫或換成那台車時才下載；以檔案開啟或下載失敗就用 `proxy` 指定的程式建模車身（機車用 Hanzo）頂替。材質是 uber 光照的貼圖版本，金屬度在粗糙表面上壓到 0.5（很多模型把金屬漆標成 metallic 1，在夜城會整台變黑），自發光壓回 0–1 再依燈種隨頭燈與煞車變亮。
- 加新車：把 GLB 放進 `.cache/cars/`，在 `MODELS` 加一列、跑 `node tools/cars.mjs <id>` 與 `car-view.mjs` 確認方向，再到 `26-glb.js` 的 `GLB_CARS`、`25-cars.js` 的 `CAR_ORDER` 與 `65-motors.js` 的 `SHOW_ROWS` 登錄（車庫格數 `GN` 不夠要加）。只收 CC0／CC BY（或接受 NC-SA）的模型，並更新 `assets/260/CREDITS.md`。

`node_modules` 連到 `../201-coral-cove/node_modules`（three 0.186.0、esbuild、playwright-core）。

## 操作

| 按鍵 | 開車 | 走路 |
| :-- | :-- | :-- |
| W A S D／方向鍵 | 油門、煞車倒車、轉向 | 移動 |
| Shift | 氮氣 | 跑步 |
| Space | 手煞車甩尾 | |
| F | 停穩後下車 | 靠近車輛時上車 |
| E | 停在 CHROME WORKS 門口時換塗裝、停在 GARAGE 07 門口時停進車庫 | 對話、進出場館、點酒、看車、開車出庫 |
| G | | 跳舞（舞池上跳滿 5 秒完成任務） |
| V | | 把目前的座駕叫到最近的車道（停在車庫裡也會開出來） |
| C | 切換相機遠近 | 同左 |
| M／Esc | 大地圖與傳送 | 同左 |
| 1–6 | 傳送：LAZARUS 門口、舞池、AFTERGLOW、CHROME WORKS、VELOCE MOTORS、GARAGE 07 | 同左 |
| 滑鼠 | 點畫面鎖定游標環顧，沒鎖定時拖曳 | 同左 |

手機顯示左下搖桿與六顆按鈕，拖曳畫面環顧。

## 結構

原始碼在 `src/parts/`，打包時依檔名順序串成同一個模組（共用頂層變數）：

| 檔案 | 內容 |
| :-- | :-- |
| `00-core.js` | renderer、城市尺寸常數、共用 uniform `U`、GLSL 函式庫（路燈格、點光、霧、環境反射）、uber 材質、`Kit` 幾何合併 |
| `10-city.js` | 街區與地塊、立面 shader（磚、石、玻璃帷幕、窗內房間、店面、鐵捲門塗鴉）、道路與人行道 shader（標線、積水、漣漪、平面反射） |
| `20-props.js` | 路燈與光錐、紅綠燈、街道設施、行道樹、施工區、招牌字圖集（店招、立式招牌、廣告牌）、全息頭像、燈串、蒸氣、雨與天空 |
| `25-cars.js` | 車型目錄 `CARS`（13 台：側面輪廓擠出的車身、上色座艙與嵌入車窗、燈具、進氣、尾翼，7 種輪框樣式）、`carKit(id, paint, wheels)` |
| `26-glb.js` | 實車模型：`GLB_CARS` 目錄（價格、手感、替身）、貼圖版 uber 材質、延遲下載與替身替換（`carObject`、`glbWake`）、`glbInstance` |
| `30-vehicles.js` | 程式建模的 Kestrel、計程車、房車、警車、貨車、Hanzo；車道圖、號誌停等、跟車與車輛物理；`applyCar()` 依目錄重建玩家座駕的車身、輪子與手感 |
| `40-people.js` | 11 根骨頭在 vertex shader 裡程序動畫的人物（走、跑、三種舞、坐、調酒、撐傘、DJ…），行人、排隊人龍與玩家 |
| `50-assets.js` | 解開內嵌 GLB（`interior_props`、`street_props`），烘成 `Kit` 幾何 |
| `55-motor-front.js` | 車行落地窗、雨棚與門前展示車、車庫燈條與招牌（要在 60 合併室外招牌之前） |
| `60-venues.js` | 三座場館門面、夜店與酒吧室內場景、任務、對話、場館登錄 `VENUES` 與進出、互動掛鉤 `ctxHooks` |
| `65-motors.js` | 車行展示廳與車庫室內、看車／買車／試駕／出庫／賣車對話、停進車庫、甩尾打賞、存檔 |
| `70-render.js` | 反射相機、MSAA 半浮點渲染目標、5 階泛光、動態模糊、色散、ACES、調色、顆粒、動態解析度 |
| `80-audio.js` | WebAudio：雨聲、城市低頻、引擎、甩尾、124 BPM 夜店鼓組（拍點驅動舞步與燈光）、酒吧 lo-fi、喇叭、警笛、雷聲 |
| `90-hud.js` | 羅盤與街名、時鐘、小地圖、大地圖與傳送、目標標記、時速表 |
| `99-main.js` | 輸入、相機（防穿牆、遮擋物抖動淡出）、每幀挑燈、天氣、主迴圈、`window.__nc` |

`blender/vehicles.py`、`blender/characters.py` 是舊版用的模型，現在車輛與人物都由程式建模，打包時不內嵌。

## 測試 API

`window.__nc`：`start()`、`tp(x, z, yaw)`、`drive('kestrel'|'hanzo')`、`walk()`、`enter('club'|'bar'|'show'|'home')`、`exit()`、`look(yaw, pitch, far)`、`setQuest(n)`、`talk.marlo()`／`talk.juno()`、`pick(n)`（選對話選項）、`ctx()`（目前的互動提示）、`spots`（Marlo、場館門口、Juno、舞池、改裝廠、車行與車庫門口、交車位置、展示車的座標）、`rain(v)`、`flash()`、`livery()`、`getStats()`。
車行與車庫：`glb`（實車下載紀錄）、`loadGLB(id)`／`loadAllGLB()`、`me`（玩家網格，截圖時可隱藏）、`motors`（現金、擁有的車、塗裝、目前座駕、試駕狀態）、`cars`（車型目錄）、`applyCar(id, paint)`、`carInfo(id)`／`garageInfo(id)`（開看車與車庫對話）、`testDrive(id)`、`endTest()`、`garage()`（重排車庫）、`stow()`、`earn(n, why)`、`driftTick(dt, car, impact, kmh)`。

## 已知限制

- 無頭 Chrome（Metal）約 120 fps、150 個 draw call、220 萬個三角形；低階手機會自動降低點光數量與解析度。
- 程式建模的車型是低多邊形的剪影致敬，比例與輪廓取自線稿，細節（曲面、內裝）都很簡化；車庫一次只開一台出門。
- 實車模型每台 11–20 萬面，展示廳全部載入時約 140 萬個三角形、370 個 draw call（無頭 Chrome Metal 約 110 fps）；輪子是用幾何自動拆的，少數卡鉗會跟著輪子轉，機車前叉不隨轉向轉動。實車只出現在車行、車庫與玩家座駕，不會進車流。
- 車流是固定車道圖上的跟車模型，不會變換車道；車輛之間只有簡單的圓形碰撞。
- 城市只有 5×5 個街區，邊緣是一圈遠景剪影。
