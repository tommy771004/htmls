# 260 霓虹夜城 · NEON NIGHT CITY

單檔成品：[`web/260-neon-nightcity.html`](../../web/260-neon-nightcity.html)，縮圖 [`thumbs/260.jpg`](../../thumbs/260.jpg)。分類：遊戲敘事。

凌晨兩點的雨夜街區。可以開 AE86、騎路邊的 ZX-6R 機車，或下車走路；LAZARUS 夜店今晚只放名單上的人，要先到 7 St 的 AFTERGLOW 酒吧找 Juno 拿火柴盒，再回去說服門口的 Marlo。

9 St 的 VELOCE MOTORS 車行只賣實車模型：29 台 Sketchfab 上 CC BY／CC BY-NC-SA 的同人模型（25 台汽車、4 台機車），一排六台、奇數排中間兩台在轉盤上，可以看規格、試駕 60 秒或買下；買來的車停在舊碼頭 8 St 的私人車庫 GARAGE 07，可以從車庫開出去、賣回車行，或把座駕開回門口停進去。開場座駕是 AE86（不能賣），路邊那台機車是 ZX-6R。車款：日系 AE86、RX-7 FD、Supra A80、Skyline GT-R R34、NSX、GT-R R35 寬體；BMW M3 E92、M3 Competition、M4 寬體、M3 GTR、M3 Touring 24H、M4 GT3 EVO、M4 CSL、E34 低趴；Porsche 911 Turbo (930)、RAUH-Welt、GT3 RS、GT3 R；Mercedes-Benz 190E EVO、Ferrari F40、SF90 XX、McLaren P1、Corvette ZR1、Challenger SRT、退役警車；機車 S1000RR 兩代、Panigale V4、ZX-6R。保留原作的名稱、彩繪與標誌，看車對話標示作者與授權，來源見 [`assets/260/CREDITS.md`](../../assets/260/CREDITS.md)；非官方作品，與車廠無關。程式建模的虛構車款（金龜車、後置引擎跑車、肌肉車、日系雙門、跑旅、楔形跑車 Kestrel 等）已經下架，只留給街上的車流與沒下載到模型時的替身。錢靠甩尾打賞（手煞車側滑越久倍率越高，撞車那段不算）與任務獎金，現金、擁有的車、塗裝與目前座駕存在 `localStorage`（`nc260.motors`）；舊存檔裡程式建模的車會被移除。

畫面方向參考 @Ainthropos 的 Three.js 雨夜城市影片：紅磚與石材立面、濕地上的霓虹倒影、霧與路燈光錐、亮著窗的店面、成排車流與撐傘行人，HUD 有地名、時鐘與小地圖。

## 指令

```bash
npm run build    # 打包成 ../../web/260-neon-nightcity.html（--dev 不壓縮）
npm test         # tools/accept.mjs：1440×900 走完整段任務、開車、地圖，390×844 觸控版；SHOT_DIR=… 會存截圖
npm run thumb    # tools/thumb.mjs（本機 HTTP，座駕是 AE86 實車）→ ../../thumbs/260.jpg；THUMB="車 dx,dz,車 yaw,相機 yaw,pitch,遠近" 可調構圖
npm run assets   # 用 Blender 重建 blender/out/*.glb（需要 Blender 5.x）
npm run people   # tools/people.mjs：Blender 跑 blender/people.py（Quaternius 底模與動畫），再用 gltf-transform 壓成 blender/out/people.glb
node tools/pose-gallery.mjs [資料夾]   # 在大道上排一列人，每人一種動作，正面與側面截圖檢查姿勢
TRAFFIC=1 node tools/cars.mjs  # 先把 .cache/cars/ 裡車流專用的原檔整理到 .cache/traffic/（可只給 id，例如 fh_taxi lct）
npm run traffic  # tools/traffic.mjs：把 assets/260 與 .cache/traffic 的車烘成車流用的 blender/out/traffic.glb（頂點色＋uber 材質編號，近景約 3–4k 面、遠景約 1k 面；可只給 id）
npm run props    # tools/props.mjs：.cache/props/ 的原檔 → ../../assets/260/props/*.glb 與 props.json（建築組、拉麵攤、室內道具）
npm run cars     # tools/cars.mjs：.cache/cars/ 的 Sketchfab 原檔 → ../../assets/260/<id>.glb 與 cars.json（可只給 id）
npm run test:glb # tools/glb-check.mjs：本機 HTTP 開頁，檢查實車下載、展示廳、買車開車、機車、換色規則與車庫；CLOSEUPS=1／CITY=1 加拍特寫與街景
node tools/car-view.mjs <id>   # 四視角檢查單台模型（輪子塗紅、車漆塗藍），確認車頭朝 +z 與輪子拆分
```

### 實車模型

- 原檔放在 gitignore 的 `.cache/cars/`（檔名對應 `tools/cars.mjs` 的 `MODELS`），處理後的 `assets/260/*.glb`（29 台約 51 MB）與 `cars.json` 有 commit；`cars.json` 在打包時併進頁面（車長、輪距、軸距、輪徑、可否換色、作者與授權）。
- `tools/cars.mjs` 每台車：依 `len`（真實車長）縮放、長軸轉到 z、`flip` 讓車頭朝 +z、接地；從落地的連通塊找出輪胎，整塊落在輪子圓柱裡的零件（輪框、碟盤、卡鉗）拆成 `wheel_FL`…（機車 `wheel_F`／`wheel_R`），節點原點在輪軸；材質係數寫進頂點屬性（`COLOR_0`、`_PBR` 粗糙／金屬／清漆／車漆旗標、`_EMI` 自發光＋燈種），同一張貼圖的零件合成一個 primitive；最後減面到 `tris`、貼圖轉 1024 WebP、meshopt 壓縮。車漆材質自動挑（名稱有 paint 或面數最多的清漆材質），`paint: [名稱]` 指定、`paint: false` 不換色；有彩繪貼圖的車不能在 CHROME WORKS 換色。
- 頁面（`26-glb.js`）只有以 http(s) 開啟時才下載，而且是走進展示廳、車庫、走近車行門口（門前兩台展示車與櫥窗剪影）或換成那台車時才下載，座駕（新存檔是 AE86）與路邊的 ZX-6R 開場就下載，下載完才開放「進入雨夜」（手機也一樣等，卡住超過 60 秒才先用替身進場）；以檔案開啟或下載失敗就用 `proxy` 指定的程式建模車身（機車用 Hanzo）頂替。開始畫面的「進入雨夜」按鈕本身是 0–100 的進度條（`00-core.js` 的 `bootProgress`／`bootStep`，各段比例在 `BOOT`，最後 40% 是座駕下載的位元組數），展示廳、車庫與車行門口要下載時，HUD 上方顯示這一批的合計進度（`glbBatch`）。材質是 uber 光照的貼圖版本，金屬度在粗糙表面上壓到 0.5（很多模型把金屬漆標成 metallic 1，在夜城會整台變黑），自發光壓回 0–1 再依燈種隨頭燈與煞車變亮。
- 加新車：把 GLB 放進 `.cache/cars/`，在 `MODELS` 加一列、跑 `node tools/cars.mjs <id>` 與 `car-view.mjs` 確認方向，再到 `26-glb.js` 的 `GLB_CARS`、`25-cars.js` 的 `CAR_ORDER` 與 `65-motors.js` 的 `SHOW_ROWS` 登錄（展示廳深度、燈與車庫格數都依排數與 `CAR_ORDER` 自動算）。原檔有怪癖時在 `MODELS` 加：`opaque`（整台標成 BLEND 但其實不透明）、`noEmi`（底色貼圖也接到自發光的無光照匯出）、`wheelNodes`（輪胎和前叉黏在一起時，依節點名指定輪胎與輪框）。只收 CC0／CC BY（或接受 NC-SA）的模型，並更新 `assets/260/CREDITS.md`。

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
| `26-glb.js` | 實車模型：`GLB_CARS` 目錄（價格、手感、替身）、貼圖版 uber 材質（建築組另有窗戶編號貼圖 `USE_WINMAP`）、延遲下載與替身替換（`carObject`、`glbWake`）、`glbInstance` |
| `68-gta.js` | GTA 式擴充第一階段：搶車／撬車（`detachCar` 把車流車變成獨立載具）、手槍與徒手、準星射線（`castRay`）、車損（白煙 → 黑煙 → 起火 → 爆炸、燒毀殘骸）、路人倒地與逃跑、被拖下車的駕駛（`extras`）、火焰煙霧粒子與閃光燈、準星與武器欄 |
| `27-props.js` | 實體建築與道具（`assets/260/props/`）：`bldPlace` 的建築依組與材質合併擺放、霓虹區路邊的拉麵攤、酒吧點唱機與街機的替換（`propSwap`／`propWake`）、車庫的升降機與工具推車 |
| `30-vehicles.js` | 車流車型 `TYPES`（計程車、兩種警車、九種房車、四種廂型車與貨車都來自內嵌的 `traffic.glb`，40 m 外換遠景模型、相機後方不畫；`traffic.glb` 載入失敗才用程式建模）、程式建模的 Kestrel、Hanzo 等替身；車道圖、號誌停等、跟車與車輛物理；`applyCar()` 依目錄重建玩家座駕的車身、輪子與手感 |
| `40-people.js` | 人物：Quaternius 男女底模（`people.glb`）依髮型合併成蒙皮幾何、每人一個 SkinnedMesh＋AnimationMixer；動畫時間由 `uTime`／`uBeat` 換算（舞池對拍），調酒、DJ、撐傘、抽菸、抱胸、騎機車在播放後覆寫手臂與上身；行人、排隊人龍、玩家與更新 `updateCrowds()` |
| `50-assets.js` | 解開內嵌 GLB（`interior_props`、`street_props`），烘成 `Kit` 幾何（`people` 由 40 自己解） |
| `55-motor-front.js` | 車行落地窗、雨棚與門前展示車、車庫燈條與招牌（要在 60 合併室外招牌之前） |
| `60-venues.js` | 三座場館門面、夜店與酒吧室內場景、任務、對話、場館登錄 `VENUES` 與進出、互動掛鉤 `ctxHooks` |
| `65-motors.js` | 車行展示廳與車庫室內、看車／買車／試駕／出庫／賣車對話、停進車庫、甩尾打賞、存檔 |
| `70-render.js` | 反射相機、MSAA 半浮點渲染目標、5 階泛光、動態模糊、色散、ACES、調色、顆粒、動態解析度 |
| `80-audio.js` | WebAudio：雨聲、城市低頻、引擎、甩尾、124 BPM 夜店鼓組（拍點驅動舞步與燈光）、酒吧 lo-fi、喇叭、警笛、雷聲 |
| `90-hud.js` | 羅盤與街名、時鐘、小地圖、大地圖與傳送、目標標記、時速表 |
| `99-main.js` | 輸入、相機（防穿牆、遮擋物抖動淡出）、每幀挑燈、天氣、主迴圈、`window.__nc` |

`blender/vehicles.py`、`blender/characters.py` 是舊版用的模型，打包時不內嵌。

### 車流

- 車型：計程車（Fairheaven LT '80 Taxi）、警車（Fairheaven LT '80、Illinois '90，`police: 1` 會在車頂閃紅藍燈）、房車（車行的 E34、190E 與 Negotiator、Milano、Kiri、Carter、Compact、Urban、Tiara）、廂型車與貨車（Shvan、LCT 3000、Conquer 皮卡、French delivery van）。除了 E34 與 190E，都是 DanielZhabotinsky 的虛構廠牌低多邊形車（CC BY 4.0），原檔放在 gitignore 的 `.cache/cars/`，由 `cars.mjs` 裡標 `traffic: true` 的項目整理到 `.cache/traffic/`（不進車行、不 commit），這批原檔車頭朝 -z，要 `flip`。
- `tools/traffic.mjs` 讀 `assets/260/<id>.glb` 或 `.cache/traffic/<id>.glb`（cars.mjs 已經整理好車長、方向、輪子節點與材質頂點屬性），貼圖在頂點上取樣成頂點色，依 `_PBR`／`_EMI`／輪子節點分成 uber 材質編號（車漆 0 交給調色盤、玻璃 1、燈 4／5／11、輪胎 6、輪圈 7…），車身與每個輪子分開減面（先依位置＋材質焊接，否則硬邊拆開的面板只能 sloppy 減面、整台被撕碎），輸出近景 `id` 與遠景 `id_far` 兩級。
- 頁面裡量化的位置是正規化整數，要先轉成浮點再套節點矩陣（直接 `applyMatrix4` 會被截在 ±1）。每幀 `flushTraffic()` 依相機距離把車分進近景／遠景兩個 InstancedMesh。
- 加車型：原檔放進 `.cache/cars/`、在 `cars.mjs` 的 `MODELS` 加一列 `traffic: true`（`node tools/car-view.mjs <id>` 檢查方向），在 `TRAFFIC` 加一列（`pal` 決定車漆能不能吃調色盤）、`npm run traffic <id>`，再到 `30-vehicles.js` 的 `TYPES` 與 `pickType()` 登錄。

### 人物

- `blender/people.py`（改自 268）從 197 的 `.cache/` 讀 Quaternius Universal Base Characters 與 Universal Animation Library（CC0），把身體依面分成 skin／top／sleeve／bottom／shin／shoe 六個材質、男女各掛三種髮型，留下 12 段動畫（見 `KEEP`）；`npm run people` 再用 gltf-transform 去重、量化與 meshopt 壓縮（不用 gltfpack：它會清掉網格名稱；也不去重材質：上衣／袖子同色會被合併）。輸出約 1 MB，打包時內嵌成 `#glb-people`。
- 前端把每種「性別×髮型」合併成一份蒙皮幾何（`aSlot` 分區），衣服、膚色、髮色與鞋子霓虹是每人材質的 uniform，一人一次 draw。骨架不在場景圖裡（網格用 detached 綁定），只有在畫面內的人每幀擺姿勢，35 m 外隔幀、70 m 外每四幀；骨頭矩陣也只在擺過姿勢後重算。
- 女性骨架在檔案裡平移了 1.2 m（男女並排），inverse bind 要乘回那段位移，否則手臂會被甩成長條。坐與騎車的骨盆高度在載入時量出來，對齊舊版的座位高度。

### GTA 式擴充（第一階段）

依 `neon_nightcity_gta_v.md` 的路線圖先做 Phase 1；這部分是非官方致敬，開始畫面有「與 Rockstar Games 無關」的聲明，不用原作的字型、圖示或音效。
- 操作：Tab 徒手／手槍、右鍵瞄準（越肩視角，身體對準星、可側移後退）、左鍵開槍或出拳（要先鎖定游標）、R 換彈；靠近車流（慢於 6 m/s）或路邊車按 F：車流是拉開車門把駕駛拖下來，路邊車是敲破車窗接線（1.9 秒）。觸控多了「武器」「瞄準」「開火」三顆按鈕。
- 被搶、打到冒煙或被爆炸波及的車流車由 `detachCar()` 脫離車流（從 `traffic`／`parked`／`typeMesh` 移除），換成自己一份 `TYPES` 幾何的獨立載具加進 `vehicles`（`kind: 'jack'`，最多留 8 台，離遠的舊車會收掉）；不進車行存檔，玩家座駕仍只走 `applyCar`。
- 車損：每台載具 `hp` 1000，撞擊（`driveVehicle` 的 `imp`）與子彈扣血；600 以下白煙、350 以下黑煙、150 以下起火並持續扣血，歸零爆炸：火球、黑煙、閃光燈（進 `pickLights`）、震動、半徑 7–8 m 內的路人倒地、車輛連鎖受損，坐在車裡的玩家被炸飛。燒毀程度寫在 `uM.w`（uber 與實車材質都會變焦黑）。座駕燒毀後按 V 會修好送來。
- 動畫：`blender/people.py` 的 `KEEP` 加了持槍、瞄準、射擊、換彈、中彈、倒地、蹲、翻滾、揮砍；`ACLIP` 的 `once` 是單次動作（相位＝開始時刻，播完停在最後一格），`rev` 倒放（倒地動畫倒放當爬起來）。瞄準的手臂由 `aimArms()` 依 `p.aimP` 覆寫。
- 還沒做（第二到四階段）：通緝星級與警方、生命與護甲、WASTED／BUSTED、武器轉盤與其他武器、三主角切換、手機、GPS、隨機事件、搶劫任務。

### 街區建築與道具

- `tools/props.mjs` 把 `.cache/props/` 的 Sketchfab 原檔（DanielZhabotinsky 的四套建築組、拉麵攤、點唱機、街機、升降機、工具推車，見 `assets/260/CREDITS.md`）擺正、縮放、接地，依材質寫成 `COLOR_0`／`_PBR`／`_EMI` 頂點屬性（和實車同一套 `glbMaterial`），貼圖轉 1024 WebP、meshopt 壓縮，輸出 `assets/260/props/*.glb` 與 `props.json`（每件的寬、深、高與作者）。建築組依「建築名_材質名_0」的節點名拆成一棟一棟，太小的零件（h < 2.5 m）不收。
- 建築組的金屬粗糙貼圖是窗戶遮罩（洋紅＝玻璃）。`winTex` 把它膨脹 2 px 找連通區，改寫成 R＝玻璃、G＝窗戶編號的無損貼圖；`_WIN` 頂點屬性是同一棟同一層的亂數。頁面依編號（取第 0 層 mip）、貼圖重複格與 `_WIN` 決定每扇窗亮不亮，顏色和程式立面的窗燈同一套。逃生梯欄杆之類的鏤空（MASK／BLEND）材質不給遮罩，否則會被當成窗戶點亮。
- `10-city.js` 在地塊排好後挑建築：同一街區同一面的連續地塊（最多四塊、不含場館）依區域機率換成一棟寬度最接近的模型（等比縮放 0.85–1.18、深度要放得下），標上 `L.glb`，這些地塊不建程式立面與店面；`27-props.js` 下載後把同一組同一材質的建築合併成一個網格。以檔案開啟不換；下載失敗由 `lotFallback()` 補回程式立面（沒有店面）。開始畫面會等建築與拉麵攤下載完（約 7 MB）。
- 室內道具走進酒吧或車庫時才下載（HUD 顯示進度），下載好就把 Blender 版的點唱機與街機藏起來換上；車庫最裡面那格加上雙柱升降機與工具推車（碰撞箱在下載後才加）。

## 測試 API

`window.__nc`：`gta`（`state`、`weapon(w)`、`fire()`、`punch()`、`reload()`、`aim(on)`、`jack(parkedOnly)`、`damage(v, n)`、`hitCar(c, n)`、`explode(v)`、`knockPed(k)`、`castRay()`、`parts`／`fxLights`／`jacked`／`extras`）、`parked`、`props`（`bld` 擺放清單、`ramen` 拉麵攤位置）、`start()`、`tp(x, z, yaw)`、`drive('kestrel'|'hanzo')`、`walk()`、`enter('club'|'bar'|'show'|'home')`、`exit()`、`look(yaw, pitch, far)`、`setQuest(n)`、`talk.marlo()`／`talk.juno()`、`pick(n)`（選對話選項）、`ctx()`（目前的互動提示）、`spots`（Marlo、場館門口、Juno、舞池、改裝廠、車行與車庫門口、交車位置、展示車的座標）、`rain(v)`、`flash()`、`livery()`、`getStats()`。
車行與車庫：`glb`（實車下載紀錄）、`loadGLB(id)`／`loadAllGLB()`、`me`（玩家，`me.mesh.visible` 截圖時可隱藏）、`peds`／`pedState`（行人）、`crowd(n)`／`ANIM`（另建一群人測動作）、`motors`（現金、擁有的車、塗裝、目前座駕、試駕狀態）、`cars`（車型目錄）、`applyCar(id, paint)`、`carInfo(id)`／`garageInfo(id)`（開看車與車庫對話）、`testDrive(id)`、`endTest()`、`garage()`（重排車庫）、`stow()`、`earn(n, why)`、`driftTick(dt, car, impact, kmh)`。

## 已知限制

- 無頭 Chrome（Metal）街上約 120 fps、150–320 個 draw call、100–280 萬個三角形（以 http(s) 開啟、有實體建築時；以檔案開啟約 150–200 個、120–190 萬）；低階手機會自動降低點光數量與解析度。
- 人物的貼圖都換成素色（衣物分區上色），髮型只有男女各三種；調酒、DJ、撐傘、抽菸、抱胸與騎機車是在現成動畫上覆寫手臂方向，動作比較僵；舞池的人跟著拍點跳同一段舞，只有相位與手部覆寫不同。人物每幀多花約 2 ms CPU（街上約 20 人在畫面內）。
- 程式建模的車型是低多邊形的剪影致敬，比例與輪廓取自線稿，細節（曲面、內裝）都很簡化；車庫一次只開一台出門。
- 實車模型每台 4–20 萬面（第二批壓在 9 萬左右），展示廳 29 台全部載入時約 170 萬個三角形、365 個 draw call（無頭 Chrome Metal 約 108 fps），整間車行要下載約 51 MB，手機上會很吃力；輪子是用幾何自動拆的，少數卡鉗會跟著輪子轉，機車前叉不隨轉向轉動。車流 16 種車型的 `traffic.glb` 約 1.1 MB，頁面單檔因此約 2.5 MB；計程車是綠色的 Fairheaven（黃色的 Canyon '75 沒有下載到）。
- 車流是固定車道圖上的跟車模型，不會變換車道；車輛之間只有簡單的圓形碰撞。
- 城市只有 5×5 個街區，邊緣是一圈遠景剪影。
