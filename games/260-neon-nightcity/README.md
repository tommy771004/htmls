# 260 霓虹夜城 · NEON NIGHT CITY

單檔成品：[`web/260-neon-nightcity.html`](../../web/260-neon-nightcity.html)，縮圖 [`thumbs/260.jpg`](../../thumbs/260.jpg)。分類：遊戲敘事。

從凌晨兩點的雨夜街區開始，時間會一直走（遊戲裡 1 分鐘 = 現實 2.5 秒），天氣在晴、多雲、陰、小雨、雨、雷雨、濃霧之間隨機變換。可以開 AE86、騎路邊的 ZX-6R 機車，或下車走路；LAZARUS 夜店今晚只放名單上的人，要先到 7 St 的 AFTERGLOW 酒吧找 Juno 拿火柴盒，再回去說服門口的 Marlo。

9 St 的 VELOCE MOTORS 車行只賣實車模型：47 台 Sketchfab 上 CC BY／CC BY-NC-SA 的同人模型（43 台汽車、4 台機車），擺在三層樓的美式豪華展示廳（`64-showroom.js`）：中庭挑空到天窗，實車沿左右兩側展廊排、每層每側 8 台，鎮店之寶 Bugatti Centodieci 在一樓中庭的旋轉台上，後方的玻璃電梯換樓層，可以看規格、試駕 60 秒或買下；買來的車停在舊碼頭 8 St 的私人車庫 GARAGE 07，可以從車庫開出去、賣回車行，或把座駕開回門口停進去。開場座駕是 AE86（不能賣），路邊那台機車是 ZX-6R。另外 17 台街頭車（Mercedes-AMG G63、Land Cruiser 200、Range Rover L322、RAM TRX、Rolls-Royce Ghost、S65 W222、M5 F90、Camry、Shelby GT500、Viper SRT、McLaren Senna、Audi R8、Lancer Evo VI，與 Harley-Davidson Seventy-Two、哈雷警用重機、YZF-R6、Z1000）車行不賣：汽車混在車流與路邊停車裡，搶到就是實車，機車停在路邊；開回 GARAGE 07 門口按 E 收進車庫。車款：日系 AE86、RX-7 FD、Supra A80、Skyline GT-R R34、NSX、GT-R R35 寬體；BMW M3 E92、M3 Competition、M4 寬體、M3 GTR、M3 Touring 24H、M4 GT3 EVO、M4 CSL、E34 低趴；Porsche 911 Turbo (930)、RAUH-Welt、GT3 RS、GT3 R；Mercedes-Benz 190E EVO、Ferrari F40、SF90 XX、McLaren P1、Corvette ZR1、Challenger SRT、退役警車；機車 S1000RR 兩代、Panigale V4、ZX-6R。保留原作的名稱、彩繪與標誌，看車對話標示作者與授權，來源見 [`assets/260/CREDITS.md`](../../assets/260/CREDITS.md)；非官方作品，與車廠無關。程式建模的虛構車款（金龜車、後置引擎跑車、肌肉車、日系雙門、跑旅、楔形跑車 Kestrel 等）已經下架，只留給街上的車流與沒下載到模型時的替身。錢靠甩尾打賞（手煞車側滑越久倍率越高，撞車那段不算）與任務獎金，現金、擁有的車、塗裝與目前座駕存在 `localStorage`（`nc260.motors`）；舊存檔裡程式建模的車會被移除。

畫面方向參考 @Ainthropos 的 Three.js 雨夜城市影片：紅磚與石材立面、濕地上的霓虹倒影、霧與路燈光錐、亮著窗的店面、成排車流與撐傘行人，HUD 有地名、時鐘與小地圖。

## 指令

```bash
npm run build    # 打包成 ../../web/260-neon-nightcity.html（--dev 不壓縮）
npm test         # tools/accept.mjs：1440×900 走完整段任務、開車、地圖，390×844 觸控版；SHOT_DIR=… 會存截圖，NC_QUERY='?zrot=25' 帶網址參數（test:glb 也吃）
npm run thumb    # tools/thumb.mjs（本機 HTTP，座駕是 AE86 實車）→ ../../thumbs/260.jpg；THUMB="車 dx,dz,車 yaw,相機 yaw,pitch,遠近" 可調構圖
npm run assets   # 用 Blender 重建 blender/out/*.glb（需要 Blender 5.x）
npm run people   # tools/people.mjs：Blender 跑 blender/people.py（Quaternius 底模與動畫），再用 gltf-transform 壓成 blender/out/people.glb（gltf-transform 借 197 的 node_modules，要先在 197 跑 npm ci）
node tools/scan-people.mjs [jason lucia]   # Blender 跑 blender/scan_people.py：沒有骨架的 Sketchfab 掃描人物綁到同一副 Quaternius 骨架，量化壓縮成 assets/260/people/<id>.glb（原檔在 .cache/people/）
node tools/pose-gallery.mjs [資料夾]   # 在大道上排一列人，每人一種動作，正面與側面截圖檢查姿勢
TRAFFIC=1 node tools/cars.mjs  # 先把 .cache/cars/ 裡車流專用的原檔整理到 .cache/traffic/（可只給 id，例如 fh_taxi lct）
npm run traffic  # tools/traffic.mjs：把 assets/260 與 .cache/traffic 的車烘成車流用的 blender/out/traffic.glb（頂點色＋uber 材質編號，近景約 3–4k 面、遠景約 1k 面；可只給 id）
npm run props    # tools/props.mjs：.cache/props/ 的原檔 → ../../assets/260/props/*.glb 與 props.json（建築組、拉麵攤、室內道具）
npm run cars     # tools/cars.mjs：.cache/cars/ 的 Sketchfab 原檔 → ../../assets/260/<id>.glb 與 cars.json（可只給 id）
npm run test:glb # tools/glb-check.mjs：本機 HTTP 開頁，檢查實車下載、展示廳、買車開車、機車、換色規則、車庫、安全屋室內，以及島上與對岸模型擺放的範圍；CLOSEUPS=1／CITY=1 加拍特寫與街景
npm run test:gpu # tools/check-gpu.mjs：顯示卡分級——?hdr=0 退回 8 位元、驅動重置後重畫、選單換等級、第 1 版設定檔遷移、最低等級開場
node tools/car-view.mjs <id>   # 四視角檢查單台模型（輪子塗紅、車漆塗藍、不隨輪轉的 `_fix` 塗綠），確認車頭朝 +z 與輪子拆分
node tools/foot.mjs [組名…]   # 量灰鷗島兩個基地模型的佔地（人身高度帶的牆＋屋頂），寫進 props.json 的 foot（換了 isle_* 模型後重跑）
node tools/seats.mjs [id…]     # 量實車的車頂輪廓，把車窗射擊的駕駛座 [座椅高度, 往前偏移] 寫進 cars.json 的 db（換了車模後重跑）
node tools/kitfit.mjs [id…]    # 量實車的保險桿輪廓、側裙、尾箱後緣與原廠尾翼，寫進 cars.json 的 kit（改裝外觀件照它貼著車身做；換了車模後重跑）
node tools/lamps.mjs [id…]     # 照位置、朝向與底色找出實車的頭燈與尾燈（很多原檔的燈只是貼圖上的顏色），改寫 assets/260/<id>.glb 的 _EMI（燈種 1.25／2.25）；--traffic 做 .cache/traffic/ 的車流車。cars.mjs 重新產生某台車之後要接著跑一次（不能對已經跑過的檔再跑：倒車燈歸零後就分不出來了）
node tools/kit-view.mjs <dir> [id…|all]   # 以本機 HTTP 開頁、裝上 MODS 指定的外觀件，從多個角度截圖（VIEWS=tail,nose 只拍幾個角度）
```

### 實車模型

- 原檔放在 gitignore 的 `.cache/cars/`（檔名對應 `tools/cars.mjs` 的 `MODELS`），處理後的 `assets/260/*.glb`（47 台約 64 MB）與 `cars.json` 有 commit；`cars.json` 在打包時併進頁面（車長、輪距、軸距、輪徑、可否換色、作者與授權）。
- `tools/cars.mjs` 每台車：依 `len`（真實車長）縮放、長軸轉到 z、`flip` 讓車頭朝 +z、接地；從落地的連通塊找出輪胎，整塊落在輪子圓柱裡的零件（輪框、碟盤、卡鉗）拆成 `wheel_FL`…（機車 `wheel_F`／`wheel_R`），節點原點在輪軸；材質或節點路徑符合 `fix`（預設 `/calip/i`）的零件另拆成不隨輪轉的 `wheel_XX_fix`，機車再沿前軸斜上 `fork.rake`（預設 24°）的轉向軸挑出前叉與龍頭，也放進 `wheel_F_fix`，`cars.json` 記下 `rake`，頁面把 `_fix` 掛在輪子的轉向節點 `piv` 上、機車繞斜軸轉；材質係數寫進頂點屬性（`COLOR_0`、`_PBR` 粗糙／金屬／清漆／車漆旗標、`_EMI` 自發光＋燈種），同一張貼圖的零件合成一個 primitive；最後減面到 `tris`、貼圖轉 1024 WebP、meshopt 壓縮。車漆材質自動挑（名稱有 paint 或面數最多的清漆材質），`paint: [名稱]` 指定、`paint: false` 不換色；有彩繪貼圖的車不能在 CHROME WORKS 換色。
- 頁面（`26-glb.js`）只有以 http(s) 開啟時才下載，而且是走進展示廳、車庫、走近車行門口（門前兩台展示車與櫥窗剪影）或換成那台車時才下載，座駕（新存檔是 AE86）與路邊的 ZX-6R 開場就下載，下載完才開放「進入雨夜」（手機也一樣等，卡住超過 60 秒才先用替身進場）；以檔案開啟或下載失敗就用 `proxy` 指定的程式建模車身（機車用 Hanzo）頂替。開始畫面的「進入雨夜」按鈕本身是 0–100 的進度條（`00-core.js` 的 `bootProgress`／`bootStep`，各段比例在 `BOOT`，最後 40% 是座駕下載的位元組數），展示廳、車庫與車行門口要下載時，HUD 上方顯示這一批的合計進度（`glbBatch`）。材質是 uber 光照的貼圖版本，金屬度在粗糙表面上壓到 0.5（很多模型把金屬漆標成 metallic 1，在夜城會整台變黑），自發光壓回 0–1 再依燈種隨頭燈與煞車變亮。燈種 1.25（頭燈）／2.25（尾燈）是 `tools/lamps.mjs` 標的燈的範圍：車尾 0.5 m 內朝後、不是車漆的面（紅色的車只挑很紅的或透明燈罩；有紅色透明燈罩的車只取燈罩），車頭 0.5 m 內朝前的透明燈罩或亮白的金屬反光碗；這兩種不乘自發光貼圖，改由片段的底色決定哪裡亮（尾燈只有底色紅的發光、頭燈只有亮的或透明的發光），所以整片範圍標大一點也只有燈罩會亮。原檔車尾白光、燈罩不紅的自發光當成倒車燈歸零。這是猜的：新車要在夜裡踩煞車看前後（`uM` 設成 (1, 1, 1, 0)）確認。
- 加新車：把 GLB 放進 `.cache/cars/`，在 `MODELS` 加一列、跑 `node tools/cars.mjs <id>` 與 `car-view.mjs` 確認方向，再到 `26-glb.js` 的 `GLB_CARS`、`25-cars.js` 的 `CAR_ORDER` 與 `64-showroom.js` 的 `SHOW_FLOORS` 登錄（每層每側 8 格；沒排進去的車自動補空格，車庫格數依 `CAR_ORDER` 自動算）。原檔有怪癖時在 `MODELS` 加：`opaque`（整台標成 BLEND 但其實不透明）、`noEmi`（底色貼圖也接到自發光的無光照匯出）、`wheelNodes`（輪胎和前叉黏在一起時，依節點名指定輪胎與輪框）。只收 CC0／CC BY（或接受 NC-SA）的模型，並更新 `assets/260/CREDITS.md`。

`node_modules` 連到 `../201-coral-cove/node_modules`（three 0.186.0、esbuild、playwright-core）。

## 操作

| 按鍵 | 開車 | 走路 |
| :-- | :-- | :-- |
| W A S D／方向鍵 | 油門、煞車倒車、轉向；飛離跳台後左右是翻滾、油門／煞車是前後空翻；車子倒扣時按住 A 或 D 翻回來 | 移動；跳傘時控制方向（開傘後 A／D 轉向、W 加速下降、S 減速） |
| Shift | 氮氣；開直升機時下降 | 跑步 |
| Space | 手煞車甩尾；停著時拉手煞＋W 是原地燒胎，再打方向甩甜甜圈，燒 1 秒以上放手煞（W 不放）彈射起步；開直升機時爬升 | 翻越前方的矮牆、護欄或停著的車；自由落體時開傘 |
| F | 停穩後下車：短按熄火，按住 0.45 秒下車不熄火（大燈亮著、引擎聲照距離變小，回來直接開；走遠 60 m 或進室內自己熄掉）（時速 15 km/h 以上是跳車：人往車門那側滾出去、車繼續滑）；開船時下船（近岸就上岸）；直升機離地 22 m 以上跳傘，低於這個高度要降落才能下 | 靠近車輛或遊艇時上車上船、5 m 內登上直升機；自由落體時開傘 |
| E | 停在 CHROME WORKS 門口時開進改裝廠、停在 GARAGE 07 門口時停進車庫 | 路人身邊打招呼（再按一次挑釁）、對話、進出場館、點酒、看車、開車出庫；搶劫的計畫板、銀行門口、金庫鑽機、上逃亡車；安全屋門口看房或進入、沙發睡覺；12 m 內招計程車、坐上停好的計程車後座 |
| G | 引爆黏性炸彈 | 跳舞（舞池上跳滿 5 秒完成任務）、引爆黏性炸彈、搶劫時引爆金庫門 |
| Z | | 游泳時下潛、再按一次浮上來 |
| V | | 把目前的座駕叫到最近的車道（停在車庫裡也會開出來） |
| Tab／滑鼠左右鍵／R | 車內射擊（手槍、電擊槍、衝鋒槍、黏性炸彈；機車另可用霰彈槍與武士刀；瞄準時手臂從瞄準那側的車窗伸出去） | 武器轉盤、開槍與瞄準、換彈 |
| Q | 角色轉盤（換主角） | 同左 |
| X／Caps Lock | 特殊能力：Kael 反射駕駛、Jax 狂暴；裝了液壓的座駕 X 是液壓（升降、彈跳、單輪起伏），特殊能力改用 Caps Lock | 特殊能力：Vance 子彈時間、Jax 狂暴 |
| P | 手機 | 同左 |
| C | 切換相機遠近 | 同左 |
| M | 大地圖：滾輪或＋／－縮放、拖曳或 WASD 平移、↑↓ 選地點、Enter 設導航點、T 傳送、C 回到自己，Esc 關閉 | 同左（雙指縮放、點圖例跳到該類地點） |
| Esc | 暫停與設定選單（游標鎖定時按 Esc 先解除鎖定，同時打開選單）；右上角的滑桿按鈕也能開 | 同左 |
| 1–6 | 傳送：LAZARUS 門口、舞池、AFTERGLOW、CHROME WORKS、VELOCE MOTORS、GARAGE 07 | 同左 |
| 滑鼠 | 點畫面鎖定游標環顧，沒鎖定時拖曳 | 同左 |

手機顯示左下搖桿與六顆按鈕，拖曳畫面環顧。

## 結構

原始碼在 `src/parts/`，打包時依檔名順序串成同一個模組（共用頂層變數）：

| 檔案 | 內容 |
| :-- | :-- |
| `00-core.js` | renderer、城市尺寸常數、共用 uniform `U`、GLSL 函式庫（路燈格、點光、霧、環境反射）、uber 材質、`Kit` 幾何合併 |
| `04-layout.js` | `tools/check-zones.mjs` 產生的版面：十五片的範圍與變換 `LAYOUT`、外緣 `CITY_EDGE`／`CITY_SHORE`／`CITY_CTR`、拿掉的格子 `DROP_CELLS`（不要手改，改 check-zones 再重跑） |
| `05-zones.js` | 分片：邏輯座標（方格）經彎曲 `warpJ`／`unwarp` 與剛體變換到世界座標 `ZONES`、換算 `toW`／`toL`／`dirW`／`yawW`／`spotW`／`rectW`、`zoneAtW`／`zoneOfW`／`zoneNearL`、座標框 `frameW`／`localZone`／`frameM4`；外緣 `CITY_POLY`、`inCity`、`shoreAt`；`?zrot=N` 把整座城再轉 N° 並平移、`?warp=0` 關掉彎曲（除錯用） |
| `06-roads.js` | 路網圖 `RN`：各區的路口（世界座標）與路段，加上縫裡把兩區同一個路口接起來的三次貝茲連接道路（`kind: 'c'`）；車流、警車、GPS、路障、叫車都走這張圖（`edgeAt`、`rnAt`、Dijkstra 的 `rnField`）；斜穿片的大道 `DIAG`（`kind: 'd'`，穿過的格子在 `PLAZA`，`plazaAt`／`plazaD`）與沿縫的快速道路 `FWY`（`kind: 'f'`，`seamMid` 取縫的中線、`fwyClear` 推離片的路；高架橋面高度 `F.h(弧長)`／`fwyH(e, u)`，跨過連接道路，銜接點是沒有片的路口 `free`；`deckTop`／`deckAt` 查橋面、`spawnY` 給生成載具的高度）；鐵灣高架斷橋 `BROKEN`（自動挑離鐵灣貨場最近、前後都是草地的連接道路，`brokenNear` 讓路燈與樹避開） |
| `07-kitx.js` | Kit 的細部建模工具（圓角盒 `rbox`、旋轉體 `lathe`、兩點間的 `rod`／`bar`、擠出多邊形 `prism`、`torus`、雙層遮光罩 `visor`）與程式紋理材質 `MAT.ux`／`MAT.uxI`：頂點色＋`aMat` ≥ 20 時在著色器裡畫紋路（`TX`：混凝土、塗漆鐵的鏽與掉漆、鍍鋅鋼、三個方向的木紋、混凝土磚、紅磚、石材、鋼板、橡膠，以及室內用的環氧地坪、烤漆鋼、毛絲面不鏽鋼、洞洞板，斜屋頂的筒瓦 `tile`、石板瓦 `slate`、立邊鋼板 `seam`），不用貼圖檔，細紋依 fwidth 在遠處淡掉。號誌（近處完整版 `sigMesh`、70 m 外遠景版 `sigFar`）、逃生梯、窗型冷氣、水塔、屋頂空調箱、燈籠、噴水池、縫上的涼亭／小賣亭／公廁、快速道路的護欄、大梁、帽梁與門架都用它 |
| `08-tex.js` | 照片材質：以 http(s) 開啟時下載 `assets/260/tex/fac_c.jpg`／`fac_n.jpg`（`tools/tex.mjs` 把 ambientCG 七種 CC0 材質疊成長條），拆成 texture2D 陣列 `U.uFacA`（底色×AO）與 `uFacN`（法線 xy＋粗糙度），層的順序與每層幾公尺在 `FAC_LAYERS`。程式立面的磚、混凝土、灰泥牆與平屋頂（10-city 的 `MAT_FACADE`）、斜屋頂的筒瓦與石板瓦（07-kitx 的 `texMat`）在 `uFac.x` 為 1 時改取照片；設定 `SET.tex`（進階影像「牆面與屋頂材質」：程式紋理／照片／照片＋凹凸）跟著畫質等級 `GPU_TIERS.tex`（soft 不下載、low 只有底色、mid 以上加法線），28-sky 的 `atmApply` 每幀呼叫 `facApply()`，換設定不用重新整理 |
| `10-city.js` | 20×15 街區（原本的 5×5 在西北角，第一輪的 8×7 在它外圍，第二輪的新區由 `DISTRICTS` 表分區）與地塊、`wholeBlocks` 把整個街區換成一個模型或一群建築（冠石的 `bld_fin`、光環的 `bld_cyber` 14 群加 `bld_fin` 三群、灰石的 `grey_18`／`grey_30`／`grey_31`、楓林里與公園大道的 `nbh_01`）、海岸地形（`LANDS`、`BEACH`、`QUAY`、`BRIDGE`、`ISLE`、`PIERS`、`groundH` 與擋牆）、外緣的擋牆、梯子與步道 `SHORE`、外緣外的山 `hillH`（網格上的高度 `hillMeshH`）與山坡住宅、北嶺公園的範圍與步道 `NPARK`、縫的草地與連接道路、地名 `district()`、距離剔除 `distCull`、碰撞空間索引 `boxesNear`／`circlesNear`、安全屋的門 `APT_DOORS`（門與捲門那一段店面畫成鐵捲門）、立面 shader（磚、石、玻璃帷幕、窗內房間、店面、鐵捲門塗鴉）、道路與人行道 shader（標線、積水、漣漪、平面反射） |
| `19-roofs.js` | 斜屋頂的種類與高度（排在 20-props 之前）：`roofKind(L)` 依區與地塊自己的 seed（不抽 `rnd()`）挑出低層程式立面的雙坡（山牆朝街）、四坡與復折式，記在 `L.rk`（坡度、高度、鋪面、顏色、煙囪、出簷）；`roofTop(L, x, z)` 回傳屋頂面高度。玻璃帷幕、夜店、特殊與換成模型的地塊、26 m 以上的樓不換；被 20-props 挑去掛屋頂廣告的地塊改回平頂（`L.rk = null`） |
| `20-props.js` | 路燈與光錐、紅綠燈、街道設施（流明電訊的電訊箱 `boxesN` 可以打爛；以檔案開啟是藍色的程式建模，http(s) 下 69-v5-street 換成 `v5works` 的模型）、特技跳台 `RAMPS`（`rampBlock` 清掉助跑道上的路邊停車）、行道樹、燈籠公園步道的紅燈籠路燈 `parkLamps`、施工區、招牌字圖集（店招、立式招牌、廣告牌）、全息頭像、燈串、蒸氣、雨與天空；`signLights` 另外收燈籠與實體建築原檔路燈（`props.json` 的 `lights`）的點光 |
| `20-relief.js` | 程式立面的浮雕（排在 20-props 之後）：沒換成模型的地塊（風格 8 除外）的窗台、窗楣與拱心石、店面柱、門框與雨棚、女兒牆與壓頂、磚樓的簷下飾帶與托架、塔樓的直鰭與樓層線腳；腰線（一樓頂與每一到三層一道，依樣式）、轉角石（磚樓與翻新樓兩端的轉角，長短交錯）、住宅入口（雙開木門與門板、黃銅把手、氣窗、壁燈、門牌）、翻新樓的百葉窗與花台；有斜屋頂的地塊不加女兒牆；窗框依種類與窗寬分組實例化（`RELIEF_R` 230 m 內），其餘每個街區一個合併網格，材質是 `MAT.ux`。側面只在高出鄰棟的部分加，背面不加；`lotFallback()` 補回的立面沒有浮雕 |
| `22-hmap.js` | 日照陰影用的建物高度圖：開場把地塊、`bldPlace` 建築、島上建物與燈塔的外框光柵化成 1.25 m 一格的半浮點貼圖（`uHMap`），建築組載入後再用實際三角形重畫（`hmModel`）；斜屋頂（19-roofs）每 0.6 m 取屋頂面高度寫進去（日光陰影的屋脊、直升機與跳傘落在坡上）；另有 2.5 m 一格的樹冠圖（`uTMap`／`uTM`，RG 半浮點：每棵行道樹、公園與島上的樹一顆橢球的頂與底），給日光穿過樹冠的碎光（00-core 的 `leafVis`）與體積光用 |
| `21-air.js` | 灰鷺角國際機場（`10-city.js` 的 `AIR`：城西外海的填海島 `AIR.isl` 與接回楓林西第 9 條街的 S 形堤道 `AIR.road`，`SEA_FR` 座標框）：島面、跑道與滑行道標線、機坪、航廈前路與停車場、護岸、0.9 m 矮牆（東緣在堤道接口斷開、梯子前是 `swim` 缺口）、跑道邊燈與進場燈、機坪高桿燈與路燈（`signLights`）、堤道的護欄與路燈；程式建模的替身 `AIR_M.proxies`；`air` 組模型（航廈、塔台、機庫、三座空橋、五架客機、餐車）走近 `AIR_NEAR` 才下載（`airModels`）；一架客機的起降循環 `AIR_P`；`00-core.js` 的 `uAirA`／`uAirB`（直升機飛到島上空時霧變淡）；`airApi` 測試 API；機坪的地勤車 `AIR_GSE`（`air_gse` 組：每座登機門西側停一列拖車＋兩台行李車，另一列拖車＋三台沿登機門後面與遠端機位之間的矩形 `AIR_GSE.path` 繞圈，`gseUpdate`，碰撞是 `dynMore` 的圓；`__nc.props.air.gse`） |
| `21-coast.js` | 海岸：水面 shader（倒影、九道方向波、離岸距離場 `SHD` 決定的淺水青綠、往岸上推的浪線與岸邊白沫）、沙灘、碼頭與島面、擋牆欄杆與步道路燈、步道長椅與花台；珊瑚灘的救生員塔、陽傘、排球網、椰子樹與棧橋盡頭的摩天輪；錨灣港（`harbor`）：貨櫃船靠港、離港、出海再回來（`SHIP_T` 各段長度），四座岸橋只在船停在吊臂下時搬貨櫃、岸橋整座沿軌道移位，三台集卡在岸橋與堆場間跑（會等岸橋、讓玩家），岸橋腳與集卡是每幀重建的動態碰撞圓 `dynCircles`；貨櫃堆與高桿燈；擋牆上的爬梯；區與區之間縫上的碎石步道、步道燈、涼亭、小賣亭與公廁（`SEAM_SITES`）；斜張跨海橋；灰鷗島的岩岸、樹與燈塔；遠景（北嶺國家公園三層山脊、灰鷺河對岸、東灣對岸 `FAR_SITES`、外海小島）與以檔案開啟時的替身 `ISLE_PROXY`；快速道路的高架橋面、橋墩、分隔島與門架 |
| `21-park.js` | 北嶺公園：冠石北端外緣上的門（石柱木樑的牌樓、路樁、兩側燈柱），門外沿著山的網格（`hillMeshH`）鋪的之字形泥土步道與往北嶺鐵道橋的三條岔路（`NPARK.trails`，進了鐵道橋模型的範圍就停）、約 2600 棵松樹與闊葉樹（圍籬裡的有碰撞）、圍籬、步道燈與長椅、管理站、山腰的雲階觀景台（平台、亭頂、欄杆、台階、望遠鏡）；網格是公園座標框 `NPARK.f` 的局部座標，圓柱與光源換成世界座標；材質是 `MAT.ridge`（150 m 內照一般的霧，再遠和遠景一樣淡） |
| `20-roof.js` | 斜屋頂的畫面（排在 20-relief 之後）：牆和樓板仍是 10-city 的方塊，屋頂蓋在平頂上——雙坡的兩片斜板、屋脊蓋、兩端的三角山牆（圓窗或工廠的百葉通風口、山牆封簷板、腰帶）、四坡的四片斜面與脊瓦、復折式的陡坡＋平台＋簷口線腳＋鐵花欄，老虎窗對齊立面的窗欄（窗框、窗格、窗台、小山花）；煙囪（磚身、石帽、兩支煙囪管）。每個街區合併成一個網格（`cityAdd`＋`cullAdd` 距離剔除） |
| `20-walk.js` | 多層的步行面 `WALKS`：同一個 x、z 有兩個高度的地方（鐵道橋的橋面與橋下、隧道與上面的山頭）。每項回傳站的高度、`null` 擋住或 `undefined` 照地形；`walkStep`（被擋就沿軸滑）、`walkY` 給 40-people 走路，`walkCam`（地板、天花板、拉回洞裡的相機位置）給 99-main 的相機 |
| `21-rail.js` | 北嶺鐵道橋的路堤、隧道（兩端洞門的程式替身、西端翼牆、封頂的山頭、洞裡的燈與越深越暗的襯砌、封底）、號誌、橋面與橋墩的夜燈；五節的電聯車（`RAIL`：從西洞底開到東洞底、停 38 秒再開回來，出洞與看到軌道上有人會鳴笛，撞到人擊倒並留在橋面）；每三趟有一趟是四節的貨運列車（`RAIL.sets.frt`：`rail_frt` 的柴電機車、兩節棚車、載四箱軍火貨箱的平車 `c.cargo`，時速 47 km；`railUse`／`railStart(dir, kind)` 換編成，`R.want` 指定下一趟）、軌道聲；`WALKS` 的那一項（橋面護欄、橋墩、隧道洞壁、山頭）。座標是公園框（`VIADUCT.zn` = `NPARK.f`），`railApi` 的 `tp`／`L`／`W`／`yaw` 給驗收擺位置；山頭蓋板是貼著 `parkLidH`（沒挖溝的山坡）的網格，頂點色和山一樣 |
| `21-tron.js` | 光格島（`10-city.js` 的 `TRON_SITE`／`TRON_LAND`，`SEA_FR` 座標框：城東南的開闊海面）：北端的碼頭與梯子、燈柱；近景 `isle_tron` 與步行格（`isle_tron.walk.bin`）的下載、走近換掉遠景 `far_tron`；`WALKS` 的那一項（樓、牆、護欄靠步行格擋住，樹另外擋，相機與子彈被樓擋住）；`21-coast.js` 的海面在島上挖掉（下層街區低於海面）；水池與光束的 shader；沿車道圖跑的光速機車（拖光牆）與三種車；騎路邊的光速機車（`tronRide`，40 走路時交給它）、販賣機買飲料、坐長椅、上下層的升降梯 |
| `21-xrail.js` | 港灣高架線（跨城的鐵路）：疊在港灣快速道路（`FWY` 的 Harbor Fwy）中心線上的雙線高架，西端從快速道路起點的平面路口後開始、越過東端的平面路口沿空的縫架到城東（`XR.aS`／`aE`，約 1.8 km）；箱梁、橋面、道碴與鋼軌、護欄、架空線與電桿、兩端車擋；柱子在快速道路的橋墩上從中央護欄穿出（`FWY_PIERS`），沒有橋墩的地方自己立（坡道的中央護欄上、分合流段從地面穿過橋面、縫裡立在地上，腳下是步道就改門形架），`XR.cols`；三站（兩端終點站與中間一站，名稱取區名）的月台、雨棚、燈與站名牌；一列電聯車（21-rail 的 `w1_train` 與替身）在三站間往返（`xrUpdate`，走近 `XR_NEAR` 才下載模型）；頭燈 `xrLights`；`xrApi` 測試 API |
| `25-cars.js` | 車型目錄 `CARS`（13 台：側面輪廓擠出的車身、上色座艙與嵌入車窗、燈具、進氣、尾翼，7 種輪框樣式）、`carKit(id, paint, wheels)` |
| `26-glb.js` | 實車模型：`GLB_CARS` 目錄（價格、手感、替身）、貼圖版 uber 材質（建築組另有窗戶編號貼圖 `USE_WINMAP`）、延遲下載與替身替換（`carObject`、`glbWake`）、`glbInstance`；`MASK` 材質的門檻是 `MASK_CUT`（預設 0.5，霓虹堡的鐵絲網用 0.12） |
| `68-gta.js` | GTA 式擴充第一階段：搶車／撬車（`detachCar` 把車流車變成獨立載具）、準星射線（`castRay`，`rayHooks` 讓 69 加入警察與直升機）、車損（白煙 → 黑煙 → 起火 → 爆炸、燒毀殘骸，撞擊扣血 `crashDmg`：ΔHP = max(0, (J/M − 6)·9)，乘上裝甲的 `armorK`）、路人倒地與逃跑、被拖下車的駕駛（`extras`）、火焰煙霧粒子與閃光燈 |
| `68-vdetail.js` | 車輛細節：F 的短按／長按（`vdKeyF`，`vdUpdate` 放開或按滿 `VD_HOLD_T` 才決定；長按 `exitVehicle(false, true)` 走 `vdIdleLeave`，`enterVehicle` 用 `vdIdleTake` 接回不重新發動，步行時的引擎聲乘 `vdIdleGain()`）、原地燒胎與甜甜圈（`vdPre`：手煞＋油門、時速低於 `BURN_V`，打方向繞前軸轉 `DONUT_YR`、計圈，燒 `LAUNCH_T` 秒放手煞彈射 `LAUNCH_V`）、沙灘的沙地阻力與濕沙卡軸（`vdBeachD`：乾沙 0–36 m、濕沙 36–56 m；濕沙上低速催油 `SAND_T` 秒陷住，4 秒內前後換向 3 次搖出來）、泡水（`vdWater`：水阻、水花、水深超過 0.45 m 撐 2 秒或一下子 0.8 m 熄火，`v.flood` 時 driveVehicle 換成 `FLOOD_INP`；比地面深的海裡沉到 `seaFloor`；水深過 1 m 撐 1.5 秒逼玩家下車），`wreckFix` 清掉，V 叫車送修好的。driveVehicle 開頭呼叫 `vdPre`、落地高度問 `vdWater`；測試 API `__nc.gta.vd`，`node tools/check-vdetail.mjs` 驗收 |
| `68-wreck.js` | `neon_nightcity_gta_v_2.md` 的車損補完：損壞階段（60% 碎窗、50% 白煙、30% 黑煙且動力 ×0.75 並偶爾熄火、12% 起火每秒 −25、AI 下車逃跑；`hpLockOf` 第一次受損時鎖定耐久上限）、單顆輪胎（每顆 50 HP，`tireShot`／`tireApply`：極速、抓地、往破胎側偏與車身傾斜）、撞人（傷害 1.8·v²、擊飛 1.15·v 與往上 min(12, .45v) 的拋物線、`wreckUpdate`）、`wreckFix` |
| `68-roll.js` | 翻車與堆疊：`v.tumble` 時 `driveVehicle()` 與 `coast()` 改走 `rollStep()`（繞車身中心翻、彈跳、停在最近的 0／±90°／180°），側躺或倒扣的 `v.flipped` 開不動（側躺按住方向鍵推回、倒扣 4 秒起火）；觸發是跳台落地翻車、近距離爆炸（`rollKick`）、側面被撞（`rollHit`）與時速 65 以上撞車流（`rollRam`，車流車脫離成臨時載具）；`surfaceH()` 讓從上面落下的車停在別台車的車頂上（`v.under` 記下墊在下面的那台，開下來前不和它碰撞）；傳送、修車、換車要 `rollClear()`；地面高度先問 `deckAt`（高架橋面） |
| `69-combat.js` | 第二階段戰鬥：武器表 `ARMS`（近戰 4、槍 7、投擲 2）、武器模型（`arms.glb`，握把 `grip`／槍口 `muzzle` 是模型座標，`holdAt` 擺到右手骨）、武器轉盤與子彈時間（`slowmo`）、射擊與換彈、火箭／手榴彈／黏性炸彈（`launch`／`stepProj`／`blast`）、生命與護甲、WASTED／BUSTED 與醫院／警察局重生、路人反應（投降、蹲下、還手、持槍路人開槍）、NPC 的槍、載具互撞 |
| `69-crew.js` | 第三階段三主角：`CREW`（Vance／Kael／Jax 的生命、護甲、家門口、外觀）、能力條充能事件（`spEvent`）與特殊能力（倍率寫進 69-combat 的 `abil`）、角色轉盤、高空切換鏡頭（`crewSwitch`／`crewCam`，`crewApply` 直接換人）、CHROME WORKS 噴漆消星（`resprayCtx`） |
| `69-events.js` | 第四階段隨機事件：鐵庫保全運鈔車（`truckSpawn` 從看不到的路口沿 `routeTo` 開、靠右偏一條車道；`evBlast` 後車門 4 m 內爆炸就打開、掉三袋現金），小地圖閃藍點；藍點事件的排程（`ev.t` 到了就問 69-street 的 `evPick`），`truckDrive` 的 `spd`／`flee` 也給逃犯車用 |
| `69-gps.js` | 第三階段 GPS：大地圖點選導航點、沿路網算路線（`routeTo`，用 69-police 的 `fieldTo`），小地圖與大地圖畫紫色導航線、黃色任務線 |
| `69-gunship.js` | 武裝直升機（`fly: true` 的載具，99-main 開的時候換成 `flyHeli`）：旋翼轉速、爬升下降、前傾加速、用 22-hmap 的 `HM` 高度圖撞樓與降落在屋頂、左右火箭莢（`gunshipFire`，16 發、4 秒裝填）；灰鷺河濱的停機坪 `HELIPAD` 與登機提示。模型是 `traffic.glb` 的 AH-64（`gunship`、`gunship_rotor`、`gunship_tail`），沒有時退回警用直升機機身加程式建模的火箭莢 |
| `69-heist.js` | 第四階段搶劫《中央霓虹銀行》：流程狀態 `heist.st`（plan → setup → go → lobby → c4 → drill → escape → drive）、銀行大廳與金庫（`VENUES.bank`、人質與威懾條）、街上的銀行門面、三主角在各階段之間換人（`heistFade` 等轉場結束才換）、人質逃跑與警衛拔槍（`hostSt`／`hostStep`，大廳裡的 Jax 與 Kael 是 `bankCrew`）、強攻守門時衝出正門的人質（`runSt`／`holdStep`）、逃亡的戰車埋伏（`heistAmbush`）與鐵灣高架斷橋的模型（位置在 06 的 `BROKEN`，飛越在 69-stunt、`brokenLanded` 降星）、終點貨櫃安全屋 `YARD`、任務框計時條與 HEIST PASSED 結算 |
| `69-heist2.js` | 搶劫補完：強攻的前置 B（`setupB`：Jax 埋伏 NCPD 移防車隊、`f.esc` 押車特警、CHROME WORKS 改裝 `enfRefit`）、金庫電子鎖破譯 `HACK`（三組波形、20 秒，`hackKey` 排在 `heistKey` 最前面）、依路線的逃亡載具 `getawayCar`（強攻：防彈輪胎 `bpTires`、偽裝 `disguise` 的裝甲車＋停機坪直升機，`heist.air`） |
| `69-kinema.js` | 第四部曲：碰撞響應與位移。推動層級與逆質量 `massOf`、車車的迭代解算 `kinVehicles`（69-combat 的 `vehPairs` 呼叫：連牆一起的位置修正、法線＋庫侖切向序列衝量、接觸點力臂讓車打轉 `v.yk`／`v.slideT`、夾扁 `crushVeh`）、步行的玩家推車與被夾 `kinWalk`（40-people 呼叫）、人與人軟性分離與衝刺撞人 `kinBarge`、近戰吸附 `kinLunge`、踉蹌 `kinStumble`（`ps.sv`）、警察與戰鬥員的擊飛滑行 `kinSlide`、路人飛出去 `pedFly`（68-wreck 的 `ps.fly`）、爆炸拋飛、霰彈轟飛 `kinBlow`、子彈推車 `kinBullet`、劫車門側 `kinDoorSide`、跳車 `jumpOut`（借 69-v3-crash 的 `player.air3`） |
| `69-market.js` | 第四階段經濟：霓虹證交所六檔股票 `STOCKS`（三組死對頭、`stockShock` 破壞 A 讓 A 跌 B 漲、每分鐘回歸基準價）、電訊箱的生命與連鎖爆炸、天際置業三處資產 `ESTATES`（每遊戲小時存進保險箱）、離線補算（`marketOffline`：依存檔的 `ts` 補上關掉遊戲那段時間的股價與資產收入，最多一天）；寫進存檔的 `stk`、`props`（第 4 版多了停業時間 `props.pause` 與 `ts`）；霓虹新聞台 `news`／`newsAdd`，離線期間補一到四則（`newsOffline`，有的帶股價變動，不進存檔） |
| `69-phone.js` | 第三階段 NeonPhone：清單式手機（聯絡人服務、暗網軍火、快速存檔）、空投彈藥箱、雷達隱形；霓虹證交所與天際置業的畫面；快速存檔寫進 `nc260.motors` 的 `game` 欄位（含座駕 `veh` 與所在的安全屋 `where`），鐵幕保全可以叫傭兵小隊；霓虹新聞台頁面（最新 10 則） |
| `69-police.js` | 第二階段通緝：犯罪熱度與星級、目擊報警、視線錐與脫離視線消星（`coverClear` 看樹與貨車擋住、直升機 `heliSees` 看樹冠與屋頂）、路網追捕（Dijkstra 場）、警車／SWAT 裝甲車／戰車、下車的警察與 SWAT、直升機與探照燈（看前方 3 秒的屋頂爬升，低於屋頂就撞毀）、路障與釘刺帶、掉落彈藥、警笛與旋翼聲、星級 HUD、小地圖上的視線錐；`coverClear` 另外看碰撞盒（矮牆只擋蹲著的人）、柱子與電話亭，直升機前方屋頂太高就往左右挑低的方向轉；`spawnHeli(true)` 是生存模式的幫派直升機（沒有探照燈、不報警）；甩掉 4 星以上發新聞 |
| `69-side.js` | 第五階段支線活動的共用部分：同一時間只有一項 `side.act`（`{ kind, name, label, step, hud, mark, fail, clear, noCrime }`），`sideBusy()` 列出不能開始的原因，任務框沿用搶劫的計時條、結算沿用 `#heistDone`（`sideDone`），`missionMark` 會問 `sideMark()`；立在地上的霓虹圈（`neonRing`／`ringAt`）、戰鬥員池的空位（`fFreeN`／`fRoom` 先收倒地最久的人） |
| `69-squads.js` | 第四階段的小隊：共用的戰鬥人員池 `fighters`（`SQ.f`，幫派 `gang`、傭兵 `merc`、搶劫隊友 `crew`，加上第五階段不開槍的搶包賊 `thief`；`fAlly` 只有 merc 與 crew；`calm` 的人站著聊天，`grp` 是所屬的活動、`onDown` 倒下時呼叫；玩家開車撞到敵方會倒，`TEAM` 是生命／命中／傷害）、找目標與開槍（`pickTarget`／`fireAt`，幫派打玩家與隊友，隊友打幫派與有星級時的警察）、小隊的車（`squadCar` 照警察的路網場開、`windowShot` 從車窗開火、到了就 `unload`）；搶運鈔車與鑽機廂型車後的幫派追殺（`gangChase`）、資產防守任務（`DEF_BIZ`、`defStep` 兩波進攻與資產耐久、輸了清空保險箱並停業 10 分鐘）、鐵幕保全傭兵（`mercCall`，$3,000、180 秒合約）、搶劫撤離時 Jax 與 Kael 跟著出來、上車後從車窗開火（`squadHeist`）；倒地的身體騰位置時搬到 `bodies` 留在原地（`bodyKeep`／`bodyStep`），`c.go` 的車開到指定地點放人（生存模式的增援），資產防守排隊補人 `D.pend`，2 星以上幫派和警察互打（`squadGang`），追殺中的槍聲算進通緝（`gangShots`） |
| `69-safehouse.js` | 安全屋 `APT`（`APT_IDS` 七間：冠石頂層公寓、雲杉坡崖邊別墅、灰鷗島辦公室、楓林里迷你閣樓、琥珀和室 Loft、公園大道白色大宅、珊瑚灘清水模公寓；`HANG_IDS` 兩間不用買的店 `open: true`：舊碼頭的鏽錨酒館 `pub`、中城的 BODEGA 夜貓便利店 `store`（結帳台花 `SNACK` 補滿生命）；`VENUES.<id>`，室內是 `apt_<id>`，走近門口 70 m 就下載，以檔案開啟是程式建模的房間），街上的門與門牌（`face: -1` 是朝北的門）、門口看房買下、沙發睡覺（推進 6 小時、補滿生命、以門口位置快速存檔）、島上辦公室在辦公桌收保險箱；分層的房間（`APT.<id>.up`：樓板高度 `y`、走得到的 `rects`、家具 `boxes`／`round`、上下樓路線 `path`，`'fade'` 是電梯的淡出淡入）有兩套碰撞 `VENUES.<id>.lvs`，`aptLevel` 換層、`aptClimb`／`aptRide` 沿路線走（40 的 `updatePlayerWalk` 交給它），`under` 是夾層下面較低的天花板（`ceilAt` 給 99 的相機），`cut` 用 shader 挖掉一段玻璃（`aptCutMat`）；換裝（衣架 `robe`、三位主角各四套 `OUTFITS`，`outfitApply` 改 `CREW[i].look`，選擇存在 `nc260.outfit`）、安全屋車庫（門旁的捲門，`aptStow` 停進去、`aptGarage`／`aptCarOut` 開出來，和 GARAGE 07 共用 `motors.stowed`） |
| `69-street.js` | 第五階段街頭事件（和運鈔車共用排程，一次一件 `ev.cur`）：搶包賊（`thiefStep` 沿 `fNav` 往遠離你的路口跑、倒下掉包 → 還給失主或自己留著）、赤蠍幫交易（路邊廂型車與四個 `calm` 的人、車尾的箱子）、懸賞逃犯車（`truckDrive` 的 `flee`、打到三成熄火後逮捕或炸毀領懸賞，`evBountyNear` 讓附近的槍聲不算罪）；`wakeGroup(g)` 叫醒整群人 |
| `69-stunt.js` | 第四階段特技跳台：斜面高度與俯仰（`stuntGround`）、衝出邊緣後的拋物線飛行（`stuntFly` 代替 `driveVehicle`）、飛行中翻滾與空翻（`v.air` 的 `rr`／`pr`／`rolls`／`flips`）、0.4 倍慢動作與側面固定機位、落地判定（歪太多失敗、翻過頭翻車）與獎金（每座第一次加倍、每轉一圈多五成，完成的跳台寫進存檔的 `stunts`） |
| `69-survival.js` | 第五階段生存模式：三座擂台 `SURVS`（鐵灣夜戰、灰石圍城、光環死鬥），路口的橘色霓虹圈按 E 開始，一波比一波多的赤蠍幫（`survGuns` 依波數換槍、生命每波 +10%），第 3 波起有開車來放人的座車（69-squads 的 `c.go`），第 5 波起的單數波有幫派直升機（69-police 的 `spawnHeli(true)`）；清一波給 $400 × n × 擂台倍率、補生命護甲、每兩波丟彈藥；走出擂台或倒下結算，最佳波數寫進 `motors.side.surv`（鐵灣）與 `svb`；`noCrime` 讓擂台裡的槍聲不報警 |
| `69-tactics.js` | 警察戰術：2 星以上的 PIT 擦撞（`pitAim`／`pitStep`）、催淚瓦斯（`gasCloud`，4 星警員往躲著不動的玩家丟、玩家丟的會嗆暈警察與敵人，`#gasFx` 畫面泛灰綠）、4 星的垂降直升機（`spawnRap`，四名特警沿繩滑下、可打下來）、榴彈發射器的拋射（`lobShot`）；每幀也跑 69-gunship 的 `gunshipStep` |
| `69-tale.js` | 第五階段支線委託 `TALES`：紅磚巷的老鐘錶匠奧斯卡、中城的街頭畫家米卡（自己的 `crowd(2)`），各四段 `fight`／`deliver`／`collect`／`tail`（跟蹤目標車）；進度寫進 `motors.side.tale`。過場 `cine`：聽委託的兩人側拍（`cineTalk`）、完成時的電話字幕（`cineCall`），`taleLate` 在 68 的 `gtaLate` 裡覆寫鏡頭、`talePre` 鎖輸入、`taleKey` 吃按鍵 |
| `69-turf.js` | 第五階段幫派地盤 `TURFS`（楓林里、琥珀工業區、灰石國宅、錨灣港）：所在地盤 `turfHere` 影響街頭（赤蠍幫的地盤路人少、`turfLurk` 盯梢的；`pedTurfShare` 給 40 的行人、`turfMine` 給 69-street 的事件挑選）；路口人行道的據點（`turfAt`）走近才生成 `calm` 的五個人，開戰後三波、搶下寫進 `motors.side.turf`；保護費每 3 分鐘、之後不定時反攻（`turfStart(T, true)` 150 秒內趕回去打退兩波）；大地圖依 `DISTRICTS` 每個街區各自 `rectW` 塗色 |
| `69-v3-break.js` | 第三部曲：撞得斷的路燈與消防栓。`brkInit` 第一次用到才把 `lampsA`／`lampsS`／`lampsC`／`hydrants` 對上碰撞圓；`breakSweep(v, dt)` 在 `driveSub`／`aiDrive` 開車前掃這一幀會碰到的圓，撞斷就把圓搬走、藏起那根的所有 instance（`instStreams` 與場景裡的 InstancedMesh）、路燈表那一盞熄掉，換一份倒下的模型；消防栓噴水柱、下雨天斷掉的路燈漏電 |
| `69-v3-chem.js` | 第三部曲：汽油桶（`ARMS.petrol`，投擲物格）、地上的油 `fuel` 與延燒 `fireStep`、車身弱點 `weakHit`（左後油箱、擋風玻璃，69-combat 的 `hitWith` 呼叫）、漏油 `leakStep`、輪框磨地起火 `rimStep`、雨天電擊連鎖 `chemStun`；建立 `gtaApi.v3` |
| `69-v3-crash.js` | 第三部曲：高速子步 `driveSub`（一幀移動超過半個碰撞半徑就切成最多 5 步）、安全帶與拋出車外 `crashStep`／`ejectPlayer`、空中狀態 `player.air3`（被拋出、自由落體、開傘：`airStep`／`airLand`）、直升機跳傘 `skyBail`、翻越 `vaultTry`／`vaultStep`、按鍵 `crashKey` |
| `69-v3-heist.js` | 第三部曲：搶劫同夥 `HIRE`（駭客、車手、槍手各一老一菜），`hireStart` 接在計畫板後面，`hireK` 給 69-heist／69-heist2 的鑽機、破譯與威懾，`hireCar` 改逃亡車，`heist3Update` 生成槍手；菜鳥升級寫進 `motors.gear.hire` |
| `69-v3-skills.js` | 第三部曲：六圍 `skills`（每位主角一份，`sk(k)`、倍率 `skK`、升級 `skUp`／`skillEvent`）、衝刺體力 `stam`、噪音圈 `noise`（小地圖淡藍圈）、消音器 `silOn`／`silFit` 與手機「改槍與裝備」`gearRows`、潛水 `diveToggle`／`breath`、水下打撈 `salv`；選單「角色能力」`skillRows` |
| `69-v3-world.js` | 第三部曲：計程車（招手、手機叫車、`taxiRide`／`taxiGo`、逃票）、日夜犯罪權重 `evNightW`、雨天 AI 抓地力 `aiDrive`、撬車警報 `alarmStep`；每幀入口 `v3Update`（99-main 在 `gtaUpdate` 之後呼叫） |
| `69-v5-civic.js` | 第五部曲之一：公共設施。10-city 的 `FAC` 街區（醫院 `FAC.hosp`、第九分局與拖吊場 `FAC.pd`）的雨遮、招牌、停機坪與屋頂直升機（69-gunship 的 `buildGunship(x, z, yaw, { kind })`）、員工電梯、醫療包、繃帶；拖吊場 `impound`／`impPay`／柵門 `gateOpen`／`gateBreak`、翻鐵絲網 `fenceStart`；外牆鐵梯 `V5_LADS`（`ladStep`，40-people 在 `V5.lad` 時交給它）、走得上去的屋頂 `v5Roof`（20-walk 的 `WALKS`）與 `roofJump`；醫藥費 `hospFee`、69-combat 呼叫的 `v5Die`／`v5Respawn`、按鍵 `v5Key`、每幀 `v5Update`（99-main 在 `v3Update` 之後呼叫） |
| `69-v5-shops.js` | 第五部曲之二：商業設施。BODEGA 的店員與搶劫（`storeStep`：拿槍指著店員 `aimAtClerk`、威嚇條 `SHOP.rob`、抽槍的店員、第二台收銀機、冰櫃飲料）、提款機 `ATM_SPOTS` 與被搶的人（`atmStep`）、酒 `booze`／`drunkStep`、CHROME WORKS 的自動捲門 `shutterStep`；楓林里商店街 `FAC.mall` 的鐵砧槍械（老闆 `ownerStep`、`gunShop`／`shopAmmo`／`shopArmor`／`shopMods`、擴充彈匣 `extApply`）、射擊場 `rangeStart`／`rangeStep`（69-police 的 `crime` 問 `v5Quiet`）、縫線服飾 `clothesShop`、泡泡洗車 `washStart`／`washStep`、車身泥巴與血跡 `carGrime`／`grimeStep`（68-wreck 撞人時呼叫 `v5Blood`）；進度條 `v5Bar`（`#v5bar`），每幀 `v5ShopUpdate`（v5Update 呼叫） |
| `69-v5-garage.js` | 第五部曲之三：公園大道 `FAC.gar` 的五層立體停車場。樓板與坡道的高度（06-roads 的 `DECKS`）、相機的天花板（20-walk 的 `WALKS`）、每層帶 `ly`／`hy` 的護牆（`pkBox` 把沿 z 的長盒切成 2 m；`boxToW` 改成仿射框之前為了剪切才切，留著不影響）、停著的車、招牌與燈；頂樓超跑 `pkCarSpawn`、傘包與跳車開傘 `pkBail`（v5Key 的 F）、電梯（`ctxHooks`）、入口柵欄桿；每幀 `pkUpdate`（v5Update 呼叫） |
| `69-v5-street.js` | 第五部曲之四：街道的微結構。路邊施工區 `ST_SITES`（`stSitesL`，30-vehicles 擺完路邊車後 `streetParkClear` 清掉那幾段）的圍籬、紐澤西護欄（含 20-props 原本施工段的兩座）、交通錐（`stPose` 寫進 `st.fMs`／`st.jMs`／`st.cMs` 每一串網格；以 http(s) 開啟時 `stWorksSwap` 換成 `v5works.glb` 的模型，另擺沙堆、發電機、拖車燈塔與旗手警示牌，人行道的電訊箱也在這裡換）、熱狗攤的攤販（`st.vend`，攤子倒了就跑開）；公車候車亭、熱狗攤（`v5street.glb`，以檔案開啟是程式建模的替身）、電話亭的玻璃、VELOCE MOTORS 的落地窗、銀行門前與霓虹堡大門外的液壓防撞柱（`stBollardsL`，霓虹堡的帶 `fort`；以 http(s) 開啟換成 `fort.glb` 的混凝土防撞柱）。撞擊看衝量（`ST_J`），69-v3-break 的 `breakSweep` 最前面呼叫 `streetSweep`；子彈走 68-gta 的 `rayHooks`（打中的種類是 `'prop'`，69-combat 的 `hitWith` 呼叫 `ref`）；69-combat 的 `blast` 呼叫 `stBlast`；推著走的護欄用 30-vehicles 的 `dynMore`；每幀 `streetUpdate`（v5Update 呼叫） |
| `69-v6-customs.js` | 第六部曲：大型改裝車廠的機制。進廠規則 `v6DoorBlock`／`v6EnterCheck`（通緝與警察視線、歇業、太燙手的超跑、坦克與飛行載具）、強尼的開場白、工位 4 銷贓 `v6Sell`（市價 `TYPE_VALUE`、出口車單 `v6Exp` 與黑板、15 分鐘冷卻）與追蹤器 `v6Track`、拔槍關店 `v6Violence`／`v6FightStep` 與鋼瓶連環爆炸 `v6Cylinder`、歇業倒數 `v6CloseStep`、保險與重建費 `v6Claim`、點火炸彈的偷車賊 `v6BaitStep`（69-squads 的 fStep 交過來）與遙控炸彈 `v6Detonate`、液壓 `v6Key`／`v6Input`／`v6HydStep`、回火／洩壓閥／燒胎煙／歪軸 `v6DriveStep`、防撞鏟 `v6Plow`（68-roll 的 rollRam 與 69-kinema 呼叫）、底盤霓虹與門頂警示燈 `v6Lights`、待售告示牌與老闆辦公室、2 樓私人車庫 `v6PrivBuild`／`v6PrivTake`、客戶委託 `v6JobOffer`／`v6JobDone`（`side.act`）；每幀 `v6Update`，`__nc.gta.v6` |
| `69-v7-bunker.js` | 第七部曲之一：北嶺地堡與霓虹堡。熱成像與毒氣的共用狀態 `V7FX`、熱源 `heatPts`（70-render 的 `uHeat`）；霓虹堡軍事基地 `FORT`（`FAC.fort`，圍牆、崗哨、機棚的坦克，進去 4 星；程式替身 `FORT.fb`，以 http(s) 開啟換成 `fort.glb` 的圍籬、崗哨塔、拱棚機棚、崗亭、柵欄桿、沙包、貨箱、油桶，紐澤西護欄與燈塔借 `v5works`，擺放清單在 `FORT.lists`）、地堡 `BUNK`（`FAC.bunker`，防爆門 `bunkerDoorW`）與室內 `VENUES.bunker`；物資與生產研究 `bunkerTick`（`SUP_*`、`STOCK_*`、`RES_RATE`、`ALPHAS`）、補給任務 `bunkerSupStart`（軍火列車是 21-rail 的貨運編成、打斷平車的掛鉤掉下最後一箱，錨灣港卡車、坦克）、出貨 `bunkerSellStart`（市中心 ×`CITY_K`）、Mk II 工作台 `bunkerBench`、彈種 `AMMO7`／`mkHit`（69-combat 的 shoot 先問）／`mkCycle`（B 鍵）、熱成像 `thermOk`；每幀 `v7BunkerUpdate` |
| `69-v7-casino.js` | 第七部曲之二：霓鑽賭場（`FAC.casino`，(8,4)）。外觀 `CASX`（雨遮、紅地毯、卸貨口、裙樓屋頂泳池與停機坪、通風井、東牆鐵梯、下水道鐵蓋；http(s) 下塔樓是 `cas_ext.glb` 一棟，`CAS_G` 時裙樓縮到南半、屋頂配置照 `CAS_ROOF`）、1 樓 `VENUES.casino`（`cas_hall.glb` 大廳，配置常數 `CS_*`；兌換櫃台、老虎機 `slotSpin`、21 點 `bjStart`、三張牌撲克 `tcpStart`、美式輪盤 `CS_RL`／`rlSpin`、Inside Track `trackRun`、幸運轉盤 `WHEEL`／`wheelSpin`、展示台的頭獎車 `PODIUM`）、B1 `VENUES.casinoB`（讀卡機、氣閘、6 道柵門、日間金庫、警衛 `casGS`、攝影機 `CB_CAMS`）、金庫劫案 `casPlan`／`casBreach`／`casHeistStep`／`casExit`／`casHeistEnd`（`side.act`）；每幀 `v7CasinoUpdate` |
| `69-v7-club.js` | 第七部曲之三：LAZARUS 夜店擴建。人氣與保險箱 `clubTick`（`SAFE_*`、`POP_DECAY`、離線補算）、2 樓夾層 `club2`（VIP 區、老闆辦公室的保險箱與電腦）、冷凍庫貨梯 `v7LiftTo` 到 B1（武裝廂型車、技術員終端機）與 B2–B5 倉庫、舞池節奏 `v7Beat*`、鬧事 `v7Trouble*`、馬克白斷片 `v7Macbeth`／`BLACKOUT`、DJ 與技術員 `v7DjMenu`／`v7TechJob`、全部出售 `v7SellStart`（砲塔 `v7TurretStep`、地雷 `v7Mine`）；三個 v7 檔的每幀入口 `v7Update`、按鍵 `v7Key`（gtaKey 最先問）、小地圖 `v7Mini`、`__nc.gta.v7` |
| `69-v8-civic.js` | 第八部曲：城市勤務。消防派遣（`fireStepCiv`、水砲 `douse`／`sprayFx`）、救護派遣 `ambStep`（停好處置時擺擔架 `ambStretcher`，`amb_str` 組）、派遣車的生成與行駛 `civSpawn`／`civGo`／`civDrive`、玩家的水砲 `playerSpray`、拖吊車 `towHook`／`towDrop`／`towStep`；每幀入口 `v8Update`、`__nc.gta.v8` |
| `69-v9-ai.js` | 第九部曲：AI。警察攔民車徵用 `copJack`／`copTake`（沒有警笛的 `quiet` 出勤）、車門掩護 `copCover`／`coverSpot`（`u.hold` 讓警車停著）、E 打招呼與挑釁 `aiGreet`／`aiHeckle`（路人狀態 `talk`／`heckle`，`aiPedFsm`）、目擊路人舉手機拍照 `snapWitness`／`snapStep`（拍完才報案，`repsStep`）與燒胎時的圍觀拍照 `funSnaps`、甩掉通緝後的便衣尾隨 `tailStart`／`tailStep`／`tailBust`、頭上台詞 `aiSay`／`saysStep`（`#says`）；每幀入口 `aiUpdate`、`__nc.gta.ai` |
| `69-v9-drain.js` | 排水道：河岸擋牆上的箱涵排水口（`DR.ents[0]`，挑在擋牆梯子旁、後面有陸地、附近人行道多的一段）與人行道上的兩個人孔（`sideSpots` 往內 1.5 m）通到同一個場館 `VENUES.drain`（排水口段、兩段各 4 節箱涵、中間與東端兩個檢查井，沿 +x 排成一列 `DR_X`）；`drEnter(i)`／`drExit(i)` 依入口換出生點與出口，東端檢查井的走私包 `drTake`；模型 `props/drain.glb` 以 `propSwap` 換掉程式建模；大地圖 `drainBlips`、`__nc.gta.drain` |
| `69-v9-metro.js` | 地鐵：三站共用一個月台場館 `VENUES.metro`（`mtArrive` 換站名、畫布站牌 `mtSigns` 與出口），入口 `MT.stations` 擺在三條 `DIAG` 的廣場上；列車週期 `mtState`（進站、停站、出站、空檔）與 2 號軌快車、車門旁選目的地 `mtBoard`／`mtGo`、乘車 `metroRide`（相機 `mtCam`）、換站 `transition` → `mtAlight`；模型 `props/metro.glb`／`metro_gate.glb` 以 `propSwap`／`loadProps` 換掉程式建模的替身；每幀入口 `mtUpdate`、`__nc.gta.metro` |
| `69-v9-switch.js` | 第九部曲：切換角色小劇場。每位主角三齣 `VIGS`（動作、台詞、有些有配角 `vigCrowd`），69-crew 的 `crewCam` 換人時呼叫 `vigStart`，40-people 照 `player.vig` 播動作；`vigUpdate`、`__nc.gta.vig` |
| `69-v5-tower.js` | 第五部曲之五：中城 (4,3) `FAC.crane` 的霓峰塔工地。框架大樓（`v5tower` 的底層、標準層 ×15、頂層，兩份背對背，屋頂 202.3 m 的鋼板平台與停機坪）、250 m 塔吊（`v5crane` 的桅桿標準節 ×78、塔頂；吊臂朝西伸 76 m），以檔案開啟或 700 m 外是程式建模的替身（`CR.fb`）；施工圍籬、工寮與材料棚（`v5site`）。桅桿東面的直梯用 69-v5-civic 的 `v5Ladder`（`L.sp`／`fast`／`slide` 自己的速度，`L.stops` 在 202 m 的附著平台可以踏上去）；屋頂、連接橋、附著平台是一個 `WALKS`，吊臂走道在自己的仿射框 `CR.f`（`frameM4` 在桅桿那一點）；兩者都登錄在 `V5.roofs`（空白鍵往下跳）。走在吊臂上不算城裡的碰撞（`skyWalk`，40-people 跳過 `collideCircle` 與 `kinWalk`：街區的整塊碰撞盒沒有高度上限）。吊臂末端的狙擊槍箱、120 m 以上用狙擊鏡射程 ×4 與倍率 ×2（`perchK`／`scopeK`，69-combat 與 99-main 呼叫）；每幀 `craneUpdate`（v5Update 呼叫） |
| `27-props.js` | 實體建築與道具（`assets/260/props/`，`loadProps(set)` 也用來載武器 `arms`）：`bldPlace` 的建築依組與材質合併擺放、霓虹區路邊的拉麵攤、酒吧點唱機與街機的替換（`propSwap`／`propWake`）、車庫的升降機與工具推車；海岸的 `COAST_MODELS`（灰鷗島的 `isle_ruin`／`isle_office`、遠景的 `far_london`／`far_golu`／`far_s7`，擺好就把 `ISLE_PROXY` 的替身 `removeFromParent()`：`distCull` 每幀都會重設 `visible`，只藏起來會被打開） |
| `27-bldfoot.js` | 實體建築的碰撞外形（空氣牆修正）：有實體建築的街區（含設施街區換模型的那幾塊地）原本整塊是一個碰撞盒，模型下載好之後 `bldCut` 在街區的 0.25 m 格子裡畫上模型在人的高度切出來的牆、頭頂下的朝上面（墊高的地面、台階），以及 8 m 以下的天花板；`blkFoot` 從街道往裡灌（牆先加厚 0.75 m，門窗縫灌不進模型的空殼，灌完再退回），屋頂下離露天超過 3 m 的地方不算，灌不到的格子合併成矩形換掉街區的盒（`blk` 標記；設施街區只換模型那幾塊、屋頂高度 `hy` 照舊）。程式立面的地塊、還沒下載或下載失敗的模型照舊整塊擋。格子往人行道多鋪 `FOOT_OUT`（2 m），推到街面後凸出的台階也擋。沿街模型與程式立面的交界以模型為主：`bldAlign`（27-props 的 `bldLoad` 擺放前呼叫，只管 10-city 標 `row` 的沿街一排）量模型在人的高度的前緣輪廓，40 百分位當一樓牆面，整棟往街面推到牆面貼齊地塊前緣（最前面的東西最多凸出 `ALIGN_OUT` 1.2 m；牆面退超過 `ALIGN_YARD` 3 m 是前院、不推；推了幾公尺記在 `e.gap`），模型幾何不改；`bldSeam`（切好外形後）在模型兩端側牆內縮、和隔壁程式立面之間的縫（0.2–3 m）照隔壁地塊的樣式與高度補一段立面（含簷口與腰帶，寬 1.2 m 以上的一樓是拉下鐵捲門的店面，掛 `seamAtlas` 的招牌：1.8 m 以上是店名橫招牌、較窄的是小燈箱，`e.signs` 計數），隔壁也是沿街模型時兩邊的縫加起來補素面石牆（高度取兩棟端部 `bldOver` 量的 `e.endH` 較低者，`e.seamG` 計數），碰撞記在街區的 `b.fill`、`e.seams` 是縫寬；`bldOver` 另外量模型在 2.4–10 m 高伸出地塊前緣多遠（每 1 m 一格的 `e.over`，逃生梯、雨棚），`bldTrees` 把枝葉會插進去的行道樹先縮小到剛好碰不到（20-props 的 `instScale`，改 `t.s`，之後才建的網格跟著縮；`e.treesSmall`），要縮到 0.55 倍以下的才拿掉（`instHide`，連樹穴與碰撞圓；樹換成模型的 W2 版也走 `instanced()`，前後順序都會藏；`e.treesCut`），40-people 的路人離街面最多走到 `SW − ALIGN_OUT − 0.3`，不穿過推出來的台階。`test:glb` 用碰撞格子量每棟前牆的中位數（要 85% 以上在 0.5 m 內），並檢查留下來的行道樹沒有插進模型 |
| `27-world1.js` | World 第四輪（`~/Downloads/world_1`）不在街區裡的地標與遠景 `W1_SITES`：東灣對岸的水泥廠（`far_cement`）與三棟長板樓（`bld_tram`）、舊碼頭河岸的木樁階梯（`w1_stairs`）、木棧橋入口的鐵絲網、岬角上的石塔與一圈石塊矮牆（`w1_tower`、`w1_fence`）；`w1Update()` 每 30 幀檢查一次，走近 `near` 公尺才下載，以檔案開啟不擺 |
| `28-sky.js` | 日夜與天氣：時鐘 `clockSt`、太陽與月亮方向（`sunDir`）、天空與霧的調色盤、天氣狀態機 `WX`（`updateWeather`、`setWeather`）、積水乾濕、撐傘、雷電；`atmApply()` 把結果寫進共用 uniform 與泛光、曝光；`occUpdate()` 每幀挑最近的車與人給地面陰影；清晨（04:36–09:24）有一層貼地的薄霧與偏冷的晨間調色盤（`SKY_PAL.dawn`），`U.uGI` 寫天空可見度強度、太陽反光、薄霧密度與霧的順光散射 |
| `31-boats.js` | 遊艇：兩款船（`BOAT_TYPES`；以 http(s) 開啟時船身換成 `boats.glb` 的 Yatch I 與 SpeedBoat，以檔案開啟是程式建模的 V 形船殼）停在六個碼頭（`BOAT_SPOTS`，含對岸的兩座渡口），`driveBoat()` 推力、阻力、側滑與舵效、隨浪起伏與俯仰、撞岸牆與貨櫃船（OBB），淺水擋住；下船時 9 m 內有岸就上岸，否則跳進水裡；船尾航跡（`wake` InstancedMesh）、浪花與游泳的水花 |
| `31-sea.js` | 水上的其他船（`sea.glb`，以檔案開啟是程式建模的替身）：灰鷺河的渡輪（`ferryPose`，兩岸往返、每頭停 45 秒）、錨灣港的拖船（`tugPose`，跟著 `harbor.st` 陪貨櫃船進出港）與水警艇（`PB`、`pbStep`：有通緝而玩家在水上時出動、追、開槍，`ai: true`，搶下來的在 `PB.taken`）；渡輪與拖船的船身矩形推開玩家的船與游泳的人（`seaHullHit`）；`__nc.boat.sea` 的 `route()`／`tugRoute()` 檢查航線有沒有擱淺、`ferryAt(T)` 把渡輪的時鐘撥到某一刻、`spawn()` 叫一艘水警艇 |
| `30-vehicles.js` | 車流車型 `TYPES`（計程車、兩種警車、九種房車、四種廂型車與貨車都來自內嵌的 `traffic.glb`，40 m 外換遠景模型、相機後方不畫；`traffic.glb` 載入失敗才用程式建模）、程式建模的 Kestrel、Hanzo 等替身；車道圖、號誌停等、跟車與車輛物理；`applyCar()` 依目錄重建玩家座駕的車身、輪子與手感 |
| `40-people.js` | 人物：Quaternius 男女底模（`people.glb`）依髮型合併成蒙皮幾何、每人一個 SkinnedMesh＋AnimationMixer；動畫時間由 `uTime`／`uBeat` 換算（舞池對拍），調酒、DJ、撐傘、抽菸、抱胸、騎機車與 `danceD`–`danceF` 三種舞步在播放後覆寫手臂與上身（`OVR`，舞池用 `DANCES` 七選一）；上衣花樣 `uPat`（橫條、格紋、胸前寬條、肩膀拼色）畫在綁定姿勢的座標 `aPat` 上；行人、排隊人龍、玩家（含涉水與游泳）與更新 `updateCrowds()` |
| `50-assets.js` | 解開內嵌 GLB（`interior_props`、`street_props`），烘成 `Kit` 幾何（`people` 由 40 自己解） |
| `55-motor-front.js` | 車行落地窗、雨棚與門前展示車、車庫燈條與招牌（要在 60 合併室外招牌之前） |
| `60-venues.js` | 三座場館門面、夜店與酒吧室內場景、任務、對話、場館登錄 `VENUES` 與進出、互動掛鉤 `ctxHooks` |
| `64-showroom.js` | VELOCE MOTORS 三層樓展示廳：明亮的建築（米色大理石地、奶油色牆板與藻井、胡桃木、黃銅、天窗、吊燈、欄杆、海報與樓層牌的 `svAtlas`；`ENV.show.post` 壓住吊燈與車漆的高光）、展車擺放 `SHOW_FLOORS`、每層的碰撞與燈 `show.lv[k]`、換層 `showLevel`、電梯 `showLift`、轉台與車廂 `updateShow` |
| `65-motors.js` | 車庫室內、看車／買車／試駕／出庫／賣車對話、停進車庫、甩尾打賞、存檔 |
| `66-chrome-kit.js` | CHROME WORKS 室內的程式建模道具（排在 66-chrome 之前）：`cwFrame`／`cwFrameM` 回傳套上座標框的 Kit 代理（`add` 先乘框矩陣，可以巢狀），各件在自己的框裡用 07-kitx 的工具建；四柱頂高機與升降平台、多層工具櫃、氣瓶推車、大風扇、馬力機電腦桌、櫃台、噴漆機械臂、木工作台與櫃台、皮沙發、加油機、引擎蓋與車門、輪圈、尾翼、洞洞板的掛牆工具、2 樓主管桌、皮椅、保險箱與載車升降機 |
| `66-chrome.js` | CHROME WORKS 霓虹改車王總廠（第六部曲）：雙層挑高的廠房（三道捲門、四個工位、零件走廊、2 樓夾層，兩層碰撞 `chromeLv`，換層 `chromeLevel`／樓梯 `chromeStairs`；明亮的車間，`ENV.chrome.post` 壓住高光）、開進／走進／開出（`chromeEnter`／`chromeWalkIn`／`chromeLeave`）、13 大改裝 `CATS`／`GRP` 與效果 `MOD_FX`、`modStats`／`modApply`（掛在 30 的 `carHooks`，實車模型下載好會再呼叫一次）、改裝件外觀 `modParts`、改裝面板 `CW`（類別 → 群組 → 等級的 `path`、鏡頭特寫錨點 `CW_ANCH`、轟油門與 L／H 即時展示、自訂車牌輸入框）、修車估價 `repairCost`／`repairParts` |
| `70-render.js` | 反射相機、MSAA 半浮點渲染目標、5 階泛光、動態模糊、色散、高光肩部、ACES、調色、顆粒、依幀時調整（`renderFrame` 尾段：整幀 CPU 送不完先讓戶外倒影隔幀更新、縮短細節距離，顯示卡畫不完才降內部解析度；有餘裕時往上到 `resMax()`，可以超過 100%）；室內場館的 `ENV.<場館>.post` 覆寫曝光、泛光門檻／強度與高光肩部；白天戶外的體積光（`mVol`，四分之一解析度：沿視線 12 步在高度圖與樹冠圖上問有沒有被擋，160 m 內、亮度隨薄霧與太陽高度，合成時四點平均） |
| `80-audio.js` | WebAudio：雨聲、城市低頻、124 BPM 夜店鼓組（拍點驅動舞步與燈光）、酒吧 lo-fi 是即時合成；槍聲、爆炸、撞擊（車／物件的金屬聲，`impact(k, "body")` 人摔落、`"ped"` 車撞人）、子彈打中人與車、拳腳、腳步、車門、喇叭、引擎、甩尾、警笛（遠 wail 近 yelp）、直升機、雷聲與列車汽笛是 Freesound 的錄音（引擎轉速層有兩段 CC BY 4.0，其餘 CC0；`tools/sfx.mjs` 下載到 `assets/260/sfx/`，只在 http(s) 載入，以檔案開啟或還沒解碼完退回合成音）。單發音解碼時裁好長度、最後 35% 淡出，同名有發聲上限與最短間隔；循環音要用才建、歸零 0.4 s 後停掉來源，`loops()` 停止呼叫（進室內）也會收掉。引擎：每台實車依引擎型式（`ENG_FAM`：bmw、jdm6、flat6、fer8、us8、v12、i4、bike4）用一組真實錄音的轉速層（`tools/sfx.mjs` 的 `ENG`，每層是一段穩定轉速的錄音與它的基頻，照 MP3 音框切到 `sfx/eng/`），開到那一型才下載；`engMix` 把轉速指數對應到最低層基頻～最高層 ×1.35，只讓夾住目標音高的兩層等功率交叉淡化並變調過去。沒有對應型式的（RX-7、搶來的車流車）或還沒下載好時用通用的四層轉速循環，電動車是合成的馬達與逆變器聲（音高跟車速、不跟檔位）。看車對話列出引擎錄音的出處（`sfx.engCredit`）。`__nc.sfx.rec`（`fam`、`want`、`engSets`）／`stats()`／`engMix(rpm)` 看載入狀態 |
| `90-hud.js` | 羅盤與街名（格網外的海邊、島與河濱顯示地名）、時鐘、天氣圖示、小地圖（底圖涵蓋兩岸、海、碼頭、跨海橋與灰鷗島，每公尺 1.5 px）、傳送 `teleport(k)`、目標標記、時速表 |
| `91-map.js` | 全區地圖（M）：向量重畫的街廓、道路、海岸與地名，可縮放平移；地點圖示（`MAP_ICON`）、右側圖例、左上資訊卡（導航點、傳送）、比例尺與游標所在的地名 |
| `96-perf.js` | 效能面板（網址加 `?perf=1`）：幀時、CPU 邏輯與送出、顯示卡時間（`EXT_disjoint_timer_query_webgl2`，Mac 的 Metal 後端多半沒有）、draw call 與三角形；超過 25 ms 的幀記成卡頓，附上那段時間新編的著色器、新上傳的貼圖與幾何數，以及載入程式標的事件（`perfTags`：模型解碼、建築組擺放）。`__nc.perf.route()` 走固定路線（光環廣場、機場、北嶺公園、賭場大廳，晚上 10 點下雨）回傳每站抵達時的卡頓與站定取樣 |
| `99-main.js` | 輸入、相機（防穿牆、遮擋物抖動淡出）、每幀挑燈、主迴圈、`window.__nc` |

### 車流

- 車型：計程車（Fairheaven LT '80 Taxi）、警車（Fairheaven LT '80、Illinois '90，`police: 1` 會在車頂閃紅藍燈）、房車（車行的 E34、190E 與 Negotiator、Milano、Kiri、Carter、Compact、Urban、Tiara）、廂型車與貨車（Shvan、LCT 3000、Conquer 皮卡、French delivery van）。除了 E34 與 190E，都是 DanielZhabotinsky 的虛構廠牌低多邊形車（CC BY 4.0），原檔放在 gitignore 的 `.cache/cars/`，由 `cars.mjs` 裡標 `traffic: true` 的項目整理到 `.cache/traffic/`（不進車行、不 commit），這批原檔車頭朝 -z，要 `flip`。
- `tools/traffic.mjs` 讀 `assets/260/<id>.glb` 或 `.cache/traffic/<id>.glb`（cars.mjs 已經整理好車長、方向、輪子節點與材質頂點屬性），貼圖在頂點上取樣成頂點色，依 `_PBR`／`_EMI`／輪子節點分成 uber 材質編號（車漆 0 交給調色盤、玻璃 1、燈 4／5／11、輪胎 6、輪圈 7…），車身與每個輪子分開減面（先依位置＋材質焊接，否則硬邊拆開的面板只能 sloppy 減面、整台被撕碎），輸出近景 `id` 與遠景 `id_far` 兩級。每個三角形只取一個材質編號（兩個頂點以上是燈就算燈，其餘取多數），頂點的編號在三角形裡內插，兩端不同時中間會掃過鍍鉻、燈、輪胎，整台變成彩虹條紋；車行的實車（`src`）先用 17 個方向的正交深度圖留下看得到的外殼（`shellCull`），內裝與板金內側不佔減面預算。燈照 `_EMI.w`：1／2 是原檔的燈，1.5／2.5 是 `lamps.mjs` 手量的燈，1.25／2.25 是它猜的燈範圍；低模只有頂點色，所以範圍裡的三角形在三角形內取 10 個點的底色，三成以上是紅的（尾燈）或亮的（頭燈，不算不透明的金屬；透明面只算亮的燈罩，暗的是車窗）就整片是燈。燈的三角形和車身不共用頂點，減面時另外減（`Prune` 會把這種獨立小島整塊拿掉），而且只把那組三角形用到的頂點交給 meshopt（它把同位置的頂點當成同一個，減完的燈會改用車身的頂點）。
- 頁面裡量化的位置是正規化整數，要先轉成浮點再套節點矩陣（直接 `applyMatrix4` 會被截在 ±1）。每幀 `flushTraffic()` 依相機距離把車分進近景／遠景兩個 InstancedMesh。
- 加車型：原檔放進 `.cache/cars/`、在 `cars.mjs` 的 `MODELS` 加一列 `traffic: true`（`node tools/car-view.mjs <id>` 檢查方向），在 `TRAFFIC` 加一列（`pal` 決定車漆能不能吃調色盤）、`npm run traffic <id>`，再到 `30-vehicles.js` 的 `TYPES` 與 `pickType()` 登錄。

### 人物

- `blender/people.py`（改自 268）從 197 的 `.cache/` 讀 Quaternius Universal Base Characters 與 Universal Animation Library（CC0），把身體依面分成 skin／top／sleeve／bottom／shin／shoe 六個材質、男女各掛三種髮型，留下 12 段動畫（見 `KEEP`）；`npm run people` 再用 gltf-transform 去重、量化與 meshopt 壓縮（不用 gltfpack：它會清掉網格名稱；也不去重材質：上衣／袖子同色會被合併）。輸出約 1 MB，打包時內嵌成 `#glb-people`。
- 掃描人物（`40-people.js` 的 `scanGet`／`SCAN`）：`people/jason.glb`、`people/lucia.glb` 只在 http(s) 下、第一次有人 `look({ scan })` 時下載，幾何換到 `PEOPLE` 的綁定空間、骨頭照骨名對回模板骨架，動畫與 IK 照用；下載好之前（與以檔案開啟時）是程式換色的身體，下載中登記的人下載好一起重新 look。換裝的「Jason／Lucia 造型」（`69-safehouse.js` 的 `SCAN_LOOKS`）、每 19 個路人一個 Lucia、夜店排隊與舞池各一個（`LUCIA(k)`）。
- 197 湖畔求生的三個 NPC（營地的阿哲、碼頭的老陳、健行的小安；Quaternius CC0，本來就是同一副骨架）也走 `scanGet`：`node tools/q197-people.mjs` 把 `assets/197/models/q/npc_*.glb` 的十幾個網格併成一個、各部位貼圖拼成一張 → `people/q_camper|q_fisher|q_hiker.glb`（300–450 KB）；街上路人編號除以 19 餘 2、12、16 的換成他們（`Q197`）。
- 前端把每種「性別×髮型」合併成一份蒙皮幾何（`aSlot` 分區），衣服、膚色、髮色與鞋子霓虹是每人材質的 uniform，一人一次 draw。骨架不在場景圖裡（網格用 detached 綁定），只有在畫面內的人每幀擺姿勢，35 m 外隔幀、70 m 外每四幀；骨頭矩陣也只在擺過姿勢後重算。
- 女性骨架在檔案裡平移了 1.2 m（男女並排），inverse bind 要乘回那段位移，否則手臂會被甩成長條。坐與騎車的骨盆高度在載入時量出來，對齊舊版的座位高度。

### GTA 式擴充（第一階段）

依 `neon_nightcity_gta_v.md` 的路線圖先做 Phase 1；這部分是非官方致敬，開始畫面有「與 Rockstar Games 無關」的聲明，不用原作的字型、圖示或音效。
- 操作：Tab 徒手／手槍、右鍵瞄準（越肩視角，身體對準星、可側移後退）、左鍵開槍或出拳（要先鎖定游標）、R 換彈；靠近車流（慢於 6 m/s）或路邊車按 F：車流是拉開車門把駕駛拖下來，路邊車是敲破車窗接線（1.9 秒）。觸控多了「武器」「瞄準」「開火」三顆按鈕。
- 被搶、打到冒煙或被爆炸波及的車流車由 `detachCar()` 脫離車流（從 `traffic`／`parked`／`typeMesh` 移除），換成自己一份 `TYPES` 幾何的獨立載具加進 `vehicles`（`kind: 'jack'`，最多留 8 台，離遠的舊車會收掉）；不進車行存檔，玩家座駕仍只走 `applyCar`。
- 車損：每台載具 `hp` 1000，撞擊（`driveVehicle` 的 `imp`）與子彈扣血；600 以下白煙、350 以下黑煙、150 以下起火並持續扣血，歸零爆炸：火球、黑煙、閃光燈（進 `pickLights`）、震動、半徑 7–8 m 內的路人倒地、車輛連鎖受損，坐在車裡的玩家被炸飛。燒毀程度寫在 `uM.w`（uber 與實車材質都會變焦黑）。座駕燒毀後按 V 會修好送來。
- 動畫：`blender/people.py` 的 `KEEP` 加了持槍、瞄準、射擊、換彈、中彈、倒地、蹲、翻滾、揮砍；`ACLIP` 的 `once` 是單次動作（相位＝開始時刻，播完停在最後一格），`rev` 倒放（倒地動畫倒放當爬起來）。拿槍走路與瞄準時的手臂由 `gunPose()` 擺（見第五階段），車內射擊與其他情況由 `aimArms()` 依 `p.aimP` 覆寫。
- 第一階段的手槍與徒手已經併進第二階段的武器轉盤（見下一節）。

### GTA 式擴充（第二階段）

數值照 `neon_nightcity_gta_v_2.md` 的表；股市、資產、隨機事件與搶劫在第四階段。
- 操作：按住 Tab 開武器轉盤（時間放慢到 0.3 倍，滑鼠方向選格，放開換上；轉盤開著時點滑鼠取消），滑鼠滾輪依序換武器，R 換彈，G 引爆黏性炸彈，狙擊槍右鍵開鏡。觸控是「武器」按鈕開轉盤、點扇形換上。
- 武器（`ARMS`）：近戰（徒手、警棍、球棒、武士刀）、手槍、電擊槍（一發 3 秒換彈、12 m，路人倒地 5 秒後原地爬起來逃跑、警察倒地 5 秒，沒有槍聲）、衝鋒槍、突擊步槍（彈匣 40）、霰彈槍（8 顆彈丸）、狙擊槍、火箭筒（每分鐘 20 發、射程 200 m）、轉管機槍（先轉 0.5 秒）、手榴彈（3 秒引信）、黏性炸彈（最多 5 顆）。爆頭（擊中點高於 1.55 m）倍率依武器：手槍 2.5、衝鋒槍 2、步槍 2.2、霰彈槍與轉管機槍 1.5、狙擊槍 3；子彈打車乘 2.4。
- 車內射擊：手槍、電擊槍、衝鋒槍、黏性炸彈在汽車與機車上都能用，霰彈槍與武士刀只有騎機車時能用；子彈從準星那一側的車窗射出（射線略過自己的車），武器欄疊在速度表上方。
- 生命 100、護甲 50（受傷時護甲先吸收 66%），5 秒沒受傷且低於 50 會慢慢回到 50。死亡：WASTED（灰階、四角壓暗、0.35 倍慢動作，4.2 秒後在醫院門口重生，付 $5000、護甲歸零）；被捕：BUSTED（警察局門口，保釋金 $2500、各槍備彈減半）；兩者都會清除通緝。
- 通緝：犯罪加熱度（搶車 35、傷人 25、開槍 45、殺人 60、爆炸 60/320、撞警車 100、拒捕 100、殺警 180、打下直升機 600），熱度 30／100／300／700／1500 對應 1–5 星；殺警、炸警車、打下直升機另有保底星數。沒被警察看到的犯罪要有人目擊（30 m 內的路人或 25 m 內的車流，大聲的 60 m）才會在 3 秒後報警。
- 警察看見：視線錐 85 m、半角 55°、要通過街區遮擋；10 m 內一定看見；換車後 18 m 外認不出來；直升機探照燈 35 m（5 星加 50%）內一律看見。脫離視線後星星閃爍，依星數 15／30／45／65／90 秒消星，警察往最後已知位置（小地圖的虛線圈）搜索。
- 出勤：每星 2／4／6／8／10 個單位、每 12／9／7／5／4 秒補一台，從玩家看不到的路口沿路網開過來；1–2 星會下車逮捕（走路時警察貼到 2.2 m 內、沒在瞄準超過 1 秒，或開車停在 3.4 m 內超過 1.5 秒，就 BUSTED），3 星起開槍並派直升機與路障（前方 70–150 m 的路口橫兩台警車與兩條釘刺帶，釘刺讓最高速 ×(1 − 0.15·N)、抓地力 ×0.45），4 星有 35% 是 SWAT 裝甲車（4 名重裝員警），5 星每 40 秒加派戰車（砲塔追玩家、每 5 秒一發砲彈）。被打倒的警察會掉彈藥。

### 街區建築與道具

- `tools/props.mjs` 把 `.cache/props/` 的 Sketchfab 原檔（DanielZhabotinsky 的四套建築組、拉麵攤、點唱機、街機、升降機、工具推車，見 `assets/260/CREDITS.md`；新城區與安全屋的原檔在 `.cache/world/`，見下面「城區與安全屋」）擺正、縮放、接地，依材質寫成 `COLOR_0`／`_PBR`／`_EMI` 頂點屬性（和實車同一套 `glbMaterial`），貼圖轉 1024 WebP、meshopt 壓縮，輸出 `assets/260/props/*.glb` 與 `props.json`（每件的寬、深、高與作者）。`dropPath` 依祖先節點路徑丟掉零件，`simplify` 用 meshopt 減面（誤差上限預設 0.002，`simplifyError` 可放寬），`heavy: [節點名, 比例]` 先把面數很高的小零件單獨減到指定比例（`bld_nbh` 的冷氣室外機、路燈、盆栽、路障減到一成，整組再減一半，約 23.6 萬面）。其他選項：`lightPath` 依節點名記下燈頭位置（寫進 `props.json` 的 `lights`，頁面補點光）、`tint: { 材質: [底色倍率, 最低粗糙度, 最高金屬度] }` 壓掉鏡面、`texEdit` 改貼圖（`ads` 換成原創廣告、`blur` 模糊真實招牌）、`dropBox` 依原檔座標的盒子與材質刪零件、`clip` 切掉盒子外的碎片、`groundY` 指定地面高度、`far` 輸出遠景（小貼圖、頁面用 `FAR` 版材質）、`winWhole` 整棟一個窗燈亂數（立面照片每扇窗都不同時用，避免跨兩個面片的窗只亮一半）。建築組依「建築名_材質名_0」的節點名拆成一棟一棟，太小的零件（h < 2.5 m）不收。
- 建築組的金屬粗糙貼圖是窗戶遮罩（洋紅＝玻璃）。`winTex` 把它膨脹 2 px 找連通區，改寫成 R＝玻璃、G＝窗戶編號的無損貼圖；`_WIN` 頂點屬性是同一棟同一層的亂數。頁面依編號（取第 0 層 mip）、貼圖重複格與 `_WIN` 決定每扇窗亮不亮，顏色和程式立面的窗燈同一套。逃生梯欄杆之類的鏤空（MASK／BLEND）材質不給遮罩，否則會被當成窗戶點亮。
- `10-city.js` 在地塊排好後挑建築：同一街區同一面的連續地塊（最多四塊、不含場館）依區域機率換成一棟寬度最接近的模型（等比縮放 0.85–1.18、深度要放得下），標上 `L.glb`，這些地塊不建程式立面與店面；`27-props.js` 依 4×4 街區一格、同一組同一材質把建築合併成網格，玩家 520 m 內的建築組才下載（`bldUpdate`，每 30 幀檢查一次），合併後的網格交給 `distCull` 依距離隱藏。以檔案開啟不換；下載失敗由 `lotFallback()` 補回程式立面（沒有店面）。開始畫面只等起點附近的建築組與拉麵攤。
- 室內道具走進酒吧或車庫時才下載（HUD 顯示進度），下載好就把 Blender 版的點唱機與街機藏起來換上；車庫最裡面那格加上雙柱升降機與工具推車（碰撞箱在下載後才加）。

## 測試 API

`window.__nc`：`menu`（Esc 選單：`st` 狀態、`SET` 設定值、`open(tab)`／`close()`、`set(k, v)`、`key(code)`、`rt()` 渲染目標大小與 MSAA、`t()` 著色器時間）、`gta`（`state`、`weapon(w)`、`fire()`、`punch()`、`reload()`、`aim(on)`、`jack(parkedOnly)`、`damage(v, n)`、`hitCar(c, n)`、`explode(v)`、`knockPed(k)`、`castRay()`、`parts`／`fxLights`／`jacked`／`extras`；第二階段：`arm`（目前武器與彈藥）、`life`、`ARMS`、`slowmo`、`fill()` 補滿彈藥生命護甲、`god.on`、`hurt(n)`、`die(kind)`、`respawn()`、`hosp`／`pd`（重生點）、`blast(x, y, z, r, dmg)`、`launch(...)`、`wheelOpen()`／`wheelMove(x, y)`／`wheelClose(apply)`、`held()`（手上武器與右手骨的世界座標）、`pedEnter(k, state)`、`stunPed(k, t, fx, fz)`／`stunCop(c, t)`、`canDriveBy(id)`；第三階段：`crew`（`crew` 狀態、`sw(i)` 切換、`sp(n)`、`on()`／`off()` 特殊能力、`wheelOpen()`／`wheelMove()`／`wheelClose()`、`event(kind)`、`respray()`／`resprayCtx()`）、`gps`（`gps`、`set(x, z)`、`clear()`、`route(px, pz, tx, tz)`）、`phone`（`phone` 狀態、`open()`／`close()`、`pick(i)`、`back()`、`key(code)`、`save()`／`load()`）；第四階段：`stunt`（`stunt` 狀態、`RAMPS`、`rampAt(x, z)`、`reset(v)`、`probe()` 回傳每座跳台助跑道與落地區被擋住的距離）、`roll`（`st` 座駕的翻滾／翻倒／疊車狀態、`kick(v, k, side)` 在車身一側爆炸掀翻、`start(v, vy, rr, pr, yr)`、`hit(v, dv, nx, nz)`、`top(x, z, skip)` 那一點的車頂高度、`surf(v)`、`fix(v)` 修車並擺正）、`squad`（`SQ`、`fighters`、`chase(why)`、`merc()` 免費叫傭兵、`defend(id)`、`win()`／`lose()`、`spawn(team, x, z, gun)`、`count(team)`、`clear()`）、`ev`（`ev` 狀態、`spawn(why)` 叫運鈔車、`open()` 炸開後車門、`street('thief'|'deal'|'bounty')` 生一件街頭事件、`end()` 收掉、`down()` 直接打倒搶包賊）、`market`（`STOCKS`、`ESTATES`、`offline(ms)` 假裝離開了 ms 毫秒、`shock(id)`、`tick()`、`buy(id, amt)`、`sell(id)`、`estBuy(id)`、`estCollect(id)`、`boxHp`、`boxHit(k, dmg, mine)`、`news`、`newsAdd(h, b)`、`newsOffline(min)`）、`heist`（`heist` 狀態、`hostSt`（人質）、`run(k, kael)` 讓人質 k 逃跑、`runSt`（守門時衝出去的人質）、`hold(dt)`、`BANK`／`PLAN`／`SAFE`／`YARD`（貨櫃安全屋）／`BROKEN`／`BRIDGE_IN`（斷橋與入口）／`VAN_AT`／`CAR_AT`、`ambush()` 立刻埋伏、`mark()` 目前的任務標記、`go('smart'|'loud')`、`stage(st, t)`、`enter()`、`blow()`、`drill()`、`escape()`、`getaway()`、`pass()`）；第五階段：`side`（`side.act`、`busy()`、`end()`、`room(n)` 騰出戰鬥員池、`bodies()` 留在畫面裡的身體數）、`race`（`RACES`、`geo(id)`、`start(id)`、`act()`、`skip()` 把車放到下一個檢查點）、`turf`（`TURFS`、`turf`、`at(id)`、`owned()`、`start(id, def)`、`act()`、`wipe()` 打倒場上這一波、`here()` 目前所在的地盤、`lurk()` 立刻生一群盯梢的、`lurkG()`、`share()` 路人密度倍率）、`surv`（`SURV`／`SURVS`、`at(id)` 的 `c` 是場地中心、`s` 是起點、`start(id)`、`act()`、`wave(n)` 跳到第 n 波、`wipe()`）、`tale`（`TALES`、`at(id)`、`stage(id)`、`start(id, n)`、`act()`、`skip()`、`probe()` 撿東西的位置會不會被碰撞推開、`cine()` 目前的過場（`talk`／`call`）、`next()` 下一句字幕）；安全屋：`apt`（`APT` 七間安全屋與兩間店的門、出口、沙發、碰撞與 `fb` 程式建模房間、`load(id)` 先下載室內、`enter(id)`、`nap()` 在室內睡覺、`out(id)` 出門站的位置、`level(id, k)` 換層、`climb(id, k)` 走樓梯／搭電梯、`OUTFITS`／`outfit`／`wear(k)` 換裝、`curb(id)` 車庫門口停車的位置、`stow(id)`／`carOut(id, carId)`）；`wanted`：`W`（星級、熱度、單位、直升機、路障）、`set(stars)`、`crime(kind, x, z)`、`addHeat(n)`、`clear()`、`sees()`、`cover(ax, az, bx, bz)` 兩點間有沒有掩蔽、`booth()` 一座電話亭的位置、`unit(kind, at)`、`heli(gang)`、`roadblock()`）、`parked`、`props`（`bld` 擺放清單、`ramen` 拉麵攤位置、`w1` 第四輪地標的擺放清單，`at` 是算好的世界座標）、`start()`、`tp(x, z, yaw)`（世界座標）、`tpL(x, z, yaw)`（邏輯座標，換到所在的區）、`W(x, z)`／`L(x, z)`（邏輯↔世界）、`Ws(x, z, yaw)`（邏輯的位置與朝向換成世界的 `{x, z, yaw}`）、`zones`、`roads`（路網 `RN`）、`capes`（岬角）、`camAt(px, py, pz, tx, ty, tz)` 截圖用的固定相機（世界座標，`camAt()` 還原）、`sea.sites`／`sea.foot(id)`（灰鷗島基地與量出來的佔地矩形）、`sea.walks`／`sea.ferry`（對岸步道與渡口，邏輯座標）、`tron`（光格島：`T` 狀態（`built`、`nearOn`、`agents`、`parked`、`walk`、`D` 是 props.json 的家具與車道圖）、`y(x, z, y0)`／`open(x, z, y)` 模型座標的步行高度與空不空、`W(x, z)` 模型座標換世界、`land(x, z)`、`mount(i)`、`dismount()`、`sit(i)`）、`rail`（北嶺鐵道橋：`R` 列車狀態（`state`、`s`、`dir`、`cars`、`loaded`、`lights`）、`go(dir, s)` 立刻出發、`hold()` 停住、`walk(X, Z, y0)` 那一點的步行高度（`null` 是擋住））、`viaduct`（`VIADUCT`：`deck` 橋面高度、`ends` 兩端、`frame(e, X, Z)`、`A`／`BORE` 洞口距離與隧道長、`piers`）、`park`（北嶺公園，邏輯座標：`walk` 圍籬範圍、`rail` 鐵道橋那一塊的範圍、`trails` 全部步道、`trail` 步道點、`look` 觀景台平台與高度、`cabin` 管理站、`gx`／`gw` 門的中線與半寬、`h(x, z)` 坡面高度、`district(X, Z)` 世界座標的地名）、`boat`（`boats`、`list()`、`board(i)`、`place(i, x, z, yaw)`、`reset(i)`、`harbor`、`SHIP_T`、`shipAt(T)` 把貨櫃船跳到這一輪第 T 秒並回傳狀態、`trucks()`、`wake()` 航跡數、`ladders()` 梯子的上下位置）、`seam`（`path` 接縫步道、`sites` 小建築）、`drive('kestrel'|'hanzo')`、`walk()`、`enter('club'|'bar'|'show'|'home'|'bank'|'loft'|'villa'|'office'|'mini'|'l16'|'i14'|'lr'|'pub'|'store')`（`tp` 會先回到戶外，室內要擺位置直接改 `player.x`／`z`）、`exit()`、`look(yaw, pitch, far)`（`far` 是相機遠近檔位 0–2）、`setQuest(n)`、`talk.marlo()`／`talk.juno()`、`pick(n)`（選對話選項）、`ctx()`（目前的互動提示）、`act()`（直接執行目前的互動提示）、`spots`（Marlo、場館門口、Juno、舞池、改裝廠、車行與車庫門口、交車位置、展示車的座標）、`rain(v)`（依雨量換天氣）、`flash()`（下一幀打雷）、`weather(id, snap)`（`clear`／`cloudy`／`overcast`／`drizzle`／`rain`／`storm`／`fog`，`snap` 為 false 時慢慢轉變）、`time(min)`（設定或讀取一天中的分鐘）、`wx`（天氣狀態：`cur`、`rain`、`cloud`、`fog`、`wet`、`bolts`）、`atm`（曝光、泛光、`day`、`lamp`、`sunK`）、`map`（大地圖：`MV` 視角、`blips()`、`select(i)`、`key(code)`、`zoom(f)`、`click(x, y)`）、`livery()`、`getStats()`。
車行與車庫：`glb`（實車下載紀錄）、`loadGLB(id)`／`loadAllGLB()`、`me`（玩家，`me.mesh.visible` 截圖時可隱藏）、`peds`／`pedState`（行人）、`crowd(n)`／`ANIM`（另建一群人測動作）、`motors`（現金、擁有的車、塗裝、目前座駕、試駕狀態）、`cars`（車型目錄）、`applyCar(id, paint)`、`carInfo(id)`／`garageInfo(id)`（開看車與車庫對話）、`testDrive(id)`、`endTest()`、`garage()`（重排車庫）、`stow()`、`earn(n, why)`、`driftTick(dt, car, impact, kmh)`。

### GTA 式擴充（第三階段）

- 三主角：Q 按住開角色轉盤（時間放慢，觸控是「角色」按鈕），選另一位後鏡頭拉到 150 m 高空、平移、俯衝到那位主角身上（約 2.7 秒）；通緝中、室內、對話或死亡時不能切換。Vance（中城公寓，生命 100、護甲 100）、Kael（CHROME WORKS，原本的玩家）、Jax（舊碼頭倉庫，生命 120、護甲 80）各自保存生命、護甲、能力條與位置，不在操作中的兩位站在自己最後的位置。
- 特殊能力：X 或 Caps Lock（觸控「技能」），能力條滿 100、每秒耗 12.5、至少 10 才能啟動。Vance 子彈時間（只限步行，0.4 倍時間、散布與後座力 0.2 倍、傷害 1.25 倍），Kael 反射駕駛（只限開車，0.35 倍時間、抓地力 2.5 倍、轉向 1.8 倍），Jax 狂暴（受傷 0.15 倍並鎖 1 血、傷害 2 倍、近戰一擊必殺、擊飛 3 倍）。充能：Vance 爆頭擊殺 +15、0 星偷襲近戰擊殺 +20、生命低於 25% 每秒 +2；Kael 高於 80% 極速每秒 +4、甩尾每秒 +6、擦身而過 +8；Jax 擊殺或爆炸 +12、每失去 10 生命 +5、猛烈撞車 +10。
- GPS：大地圖點一下道路或在地點資訊卡按 Enter 設導航點（紫線），再點一次取消，12 m 內抵達自動清除；任務目標在戶外且超過 25 m 時畫黃線。
- 噴漆消星：通緝中、警察看不到你時，開車停到 CHROME WORKS 門口按 E 躲進去（捲門放下），在改裝面板噴漆或換車牌就清除通緝；偷來的車在工位 4 跟 Rook 付 $1,000 噴漆換牌（第六部曲）。
- NeonPhone：P 或右上角的手機按鈕，從右下滑出 280×520 的清單式手機（數字鍵選列、0 是第 10 列、Esc／Backspace 返回；開著時游標會釋放，可直接點）。聯絡人：駭客 Zero（消除通緝 $500 × 星數²、冷卻 180 秒；雷達隱形 60 秒 $1,500，期間路人看到犯罪不報警）、技工鐵手（把座駕送到身後約 30 m 的路上，免費、冷卻 60 秒）、鐵幕保全（空投彈藥箱 $1,200：從 40 m 高落在前方路上、冒紅色信號煙，走過去撿起來彈藥全滿＋防彈衣）。暗網軍火：防彈衣 $500、各槍備彈補滿 $200–3,000、投擲物補滿 $1,500，直接進背包。快速存檔：在戶外、沒被通緝時存下三位主角的生命／護甲／能力條／位置、目前主角、任務進度、時間與彈藥；讀檔要下車。
- 原規格書手機是方向鍵 ↑ 開啟、九宮格圖示；這裡方向鍵是開車與走路，所以改用 P 與清單式介面。規格裡的股市、資產管理與運鈔車標記在第四階段加進手機；傳奇車業（買車）沿用 VELOCE MOTORS 車行，傭兵小隊在第四階段加進鐵幕保全。

### GTA 式擴充（第四階段）

- 運鈔車（藍點事件）：沒被通緝、在戶外時每 2.5–4 分鐘從看不到的路口開出一台鐵庫保全運鈔車（深綠廂型車、生命 2600），沿路網在城裡繞，小地圖閃藍點；手機找 Zero 付 $1,000 可以直接叫一台。用黏性炸彈、手榴彈或火箭在後車門 4 m 內引爆：停車、掉三袋現金（合計 $18,000–40,000），立刻 3 星；整台炸毀也會掉錢，但燒掉四成。錢袋走過去就撿起來，150 秒沒撿會消失。
- 特技跳台：二十一座灰色鋼板、兩側黃邊的跳台（大地圖上的黃色箭頭）擺在路口前的停車道，前面 26 m 不停車當助跑道；原本的六座在舊城區，新的十四座分散在 20×15 的新區，第二十一座在公園大道立體停車場的頂樓（第五部曲）。時速 60 以上衝出去：時間放慢到 0.4 倍、鏡頭換成跳台旁的固定機位。飛行中左右（A／D）翻滾、油門／煞車（W／S）前後空翻，放開就慢慢回正；落地車身歪不到 0.5 rad、車頭方向沒偏就領獎金（200 + 距離 × 25 + 最高點 × 150，每轉滿一圈多五成），每座跳台第一次完成加倍；歪超過 0.5 rad 算失敗並傷車，翻過 1.3 rad 就是翻車（重損、車速剩四成）。落地衝擊太大也會傷車。
- 霓虹證交所（手機）：三組死對頭共六檔股票（鐵庫保全 IVLT ↔ 哨衛防務 SNTL、凡托超跑 VNTR ↔ 蛟重工 MZCH、流明電訊 LMNT ↔ 脈線科技 PLSW）。你破壞 A 企業的東西（搶或炸運鈔車、炸掉路上的 Milano 與 Tiara GT、打爛路邊的藍色電訊箱）時 A 跌約 8%、B 漲約 7%；每分鐘（真實時間）隨機 ±1% 並向基準價回歸（半衰期 10 分鐘），價格限制在基準的 0.2–3.5 倍。個股畫面可以買 $10,000、$100,000、全部現金或全部賣出。
- 電訊箱：生命 60，射擊、爆炸或開車以時速 30 以上撞上就爛，爛掉時會炸開（可能連鎖）。
- 天際置業（手機）：買下 LAZARUS 夜店（$250,000）、AFTERGLOW 酒吧（$120,000）或 CHROME WORKS 改裝廠（$350,000，第六部曲；門口的待售告示牌也能買），AFTERGLOW 與 CHROME WORKS 每遊戲小時（150 秒）把 $1,100／$1,700 存進各自的保險箱（上限 20 小時的量），LAZARUS 照人氣每日 $1,500–$50,000（第七部曲，上限 $250,000）；從手機收取。第七部曲加上北嶺地堡（$1,150,000，沒有保險箱，收入靠出貨）。關掉遊戲的期間也照真實時間補算（最多一天）：股價往基準回歸並帶一點雜訊、資產收入補進保險箱，開場 4 秒後跳出提示。
- 搶劫《中央霓虹銀行》：Vance 公寓門口的計畫板付 $10,000 籌備費，選潛行（贓款 $2,000,000）或強攻（$2,500,000）。
  - 前置：偷舊碼頭路邊的黑色鑽機廂型車（上車即 2 星），甩掉警察後開回 Jax 的舊碼頭倉庫。
  - 進場：到 10 St 的銀行門口按 E，Vance 進大廳；8 名人質，威懾條每秒掉 7%，瞄準時回升、開槍大幅回升，掉到 0 有行員按警報（潛行就變強攻）。15 秒後 C4 裝好，按 G 炸開金庫門，走到門口按 E 裝鑽機。
  - 鑽金庫：潛行而且沒響警報時 Vance 留在大廳顧人質 40 秒；強攻或響了警報就換成 Jax 帶步槍到門口，4 星守 60 秒。
  - 撤離：換成背錢袋的 Vance 從正門出來（強攻 5 星、潛行 2 星），走到 120 m 外的逃亡車（Tiara GT），每受 10 點傷害掉 $15,000；上車後換 Kael 開，甩掉通緝、停進倉庫門口的黃圈就是 HEIST PASSED：扣掉中彈損失與 Zero 一成分紅後入帳，結算表列出三人各得多少。
  - 任何階段 WASTED 或 BUSTED 就失敗，回到「到銀行門口」重來（籌備費與前置保留）；搶劫中不能快速存檔或讀檔。
- 幫派追殺：搶了運鈔車（撿起第一袋錢）或偷了鑽機廂型車 4 秒後，赤蠍幫開兩台車（車型從 BMW E34、190E EVO、Carter 依序取，每台三人：衝鋒槍、手槍、手槍）從 90–170 m 外照路網追過來，邊開邊從車窗開槍，追上你停住後下車來打（小地圖上是紅色方塊與紅點）；全部倒下，或你在 280 m 外超過 20 秒就結束。幫派成員倒下有機會掉彈藥。
- 資產防守：擁有夜店、酒吧、改裝廠或島上辦公室時，開場 6 分鐘後起每 6–9 分鐘有一處被盯上（任務框改成「資產防守」、小地圖與大地圖畫紅圈）：180 秒內趕到 60 m 內，接著兩波（4 人、5 人）從 32–40 m 外圍過來，每個貼在門口 6 m 內的人每秒扣資產耐久 1.6%。全部打倒就領 $6,000＋每小時收入 × 4；逾時或耐久歸零則保險箱被搬空、停業 10 分鐘（停業期間不累積，離線補算也扣掉這段）。
- 傭兵小隊：手機 → 鐵幕保全 → 傭兵小隊（$3,000，冷卻 240 秒）。一台皮卡載四名傭兵（步槍兩名、衝鋒槍、霰彈槍）從 60–130 m 外開過來（小地圖綠點），下車後跟在你身邊 180 秒，打幫派與追你的警察；你上車時他們也上皮卡跟著，從車窗開火。
- 搶劫的隊友與人質：大廳裡 Jax 蹲在金庫門口、Kael 守大門。威懾低於 40% 時每 6–10 秒有一名人質往門口跑：瞄準他就趴回去，Kael 有四成機會喝止；跑出門就響警報（潛行變強攻）。威懾低於 25% 超過 2 秒，警衛會站起來拔槍朝你開槍，3 秒後被 Kael 放倒；打死無辜人質扣 $40,000。撤離時 Jax（步槍）與 Kael（衝鋒槍）跟著 Vance 出來掩護（生命不會低於 50），上逃亡車後不在操作中的那位從車窗開火。
- 車內射擊的手臂：瞄準時駕駛靠向瞄準那側的前門、右臂整隻伸出車窗握著槍；轉管機槍抱在腰間（右手握把、左手扶提把），火箭筒扛在右肩、左手往前扶住筒身（第五階段起由 `gunPose` 依 `GUN_HOLD` 每幀做兩手 IK）。
- 快速存檔：開車時存檔會記下座駕（自己的車、路邊機車或搶來的車流車型與塗裝），讀檔後坐回那台車上；在安全屋睡覺存檔會記下房間，讀檔後回到室內。
- 視線：警察的視線錐被樹（目標 10 m 內）與貨車、廂型車擋住就看不到（轎車擋不住站著的人，警方自己的車不算）；直升機的視線被樹冠與途中的屋頂擋住。直升機往前看 3 秒的屋頂高度爬升，掉到屋頂以下就撞毀。
- 存檔第 5 版：快速存檔的位置（`game.st`）改成世界座標，讀第 4 版以前的存檔時用 `spotW` 換過去。第 4 版：`nc260.motors` 第 3 版多了 `stunts`（完成的跳台）、`stk`（股價、持股、成本）、`props`（擁有的資產與保險箱金額），讀檔時對照 `STOCKS`／`ESTATES` 檢查；第 4 版加上存檔時間 `ts`（離線補算用）與 `props.pause`（停業到什麼時候）。

### GTA 式擴充（第五階段）

名稱都是原創的。同一時間只會有一項活動；搶劫、資產防守、幫派追殺或通緝中不能開始，活動進行中也不會冒出運鈔車、街頭事件與資產防守。任務框沿用搶劫的計時條，GPS 黃線指向目前的目標。

- 街頭賽（大地圖洋紅色「賽」）：三條賽道。霓虹環線（兩圈，報名費 $1,000、第一名 $6,000）、光環衝刺（$2,000／$12,000）、南岸長征（$3,000／$18,000）。開車停進起點的霓虹圈按 E 報名，三名對手（Vex 的 Tiara GT、Rin 的 190E EVO、Dante 的 E34）沿路網開、看不到時會重生回路線上。檢查點是立著的霓虹圈（終點是青色的），下車超過 10 秒、車毀或離下一個檢查點 450 m 以上算棄賽。第二名拿四成獎金、第三名退報名費，每條賽道第一次贏多五成；最佳成績存進存檔。
- 街頭事件（小地圖藍點）：和運鈔車共用排程，每 2–3.5 分鐘挑一件。
  - 搶包賊：附近的路人被搶，搶包賊往遠離你的方向跑，十秒後開始變慢。拳腳、開槍或開車撞倒他就掉包：還給失主拿 $1,200，或自己留著（$2,400–4,000，但算搶劫）。
  - 赤蠍幫交易：路邊廂型車旁四個人在交易，箱子放在車尾。被看到、有人中槍或附近有槍聲就整群開打；撿到箱子給 $8,000–15,000。
  - 懸賞逃犯車：第九分局懸賞的跑車往遠離你的方向逃（車速 1.35 倍）。炸毀、打到剩三成熄火後走到車旁逮捕，或連車帶人搶下都領懸賞（$5,000–8,000）；逃犯車 80 m 內的槍聲與爆炸不算你的罪。跑出 400 m 或四分鐘就失敗。
- 幫派地盤（大地圖紅色街區）：楓林里、琥珀工業區、灰石國宅、錨灣港是赤蠍幫的地盤，據點在路口人行道上。走到 90 m 內會看到五個人站著聊天；步行或慢速開車進到 22 m 內被看到（或你先動手）就開戰：據點的人加兩波援兵全部打倒就搶下地盤（獎金 $5,000–9,000），離據點 260 m 以上算撤退。搶下的地盤變綠色，每 3 分鐘收一次保護費（每塊 $600）；之後每 7–11 分鐘赤蠍幫挑一塊反攻，150 秒內趕回據點、打退兩波就守住（$3,000），沒趕到或陣亡就丟掉那塊地盤。
- 生存模式（三座擂台：鐵灣夜戰、灰石圍城、光環死鬥）：路口人行道上的橘色霓虹圈按 E。第 n 波有 3 + 2n 個打手（同時最多 4 + n 個，第 3 波起有霰彈槍、第 5 波起有步槍），第 3 波起一台、第 6 波起兩台座車各載三人開過來放人（車窗會開槍），第 5 波起的單數波多一架幫派直升機（機槍手一直掃射，打下來才算清空）。清空一波給 $400 × n × 擂台倍率（1／1.25／1.5）、補 35 生命與 25 護甲，每兩波在路口中央丟步槍與霰彈槍彈藥，兩波之間 8 秒。倒下、被捕或走出擂台（70–80 m）就結算；擂台裡的槍聲不報警。
- 支線委託（大地圖黃色「?」）：紅磚巷的老鐘錶匠奧斯卡（祖父的懷錶 → 準時的懷錶 → 風向齒輪 → 收錢的人）與中城的街頭畫家米卡（散落的畫稿 → 趁顏料還沒乾 → 牆是誰的 → 抄襲者），走近按 E 聽委託。四種任務：打倒一群赤蠍幫；限時送東西（直線距離 ÷ 9 m/s + 40 秒）；三分鐘內撿齊五個人行道轉角上的東西；跟蹤一台車到它的目的地（14 m 內疑心會漲滿、90 m 外超過 8 秒算跟丟，打到它也算被發現）。過場：聽委託時鏡頭換成兩人的側拍、上下黑邊；完成時委託人打電話來，字幕逐句播（E／空白鍵／點畫面下一句），鏡頭繞著你轉，播完才跳結算；最後一段之後接委託人的結語（STORY COMPLETE）。道謝也會傳到手機。
- 持槍姿勢：拿槍走路、跑步、蹲下與瞄準時，`40-people.js` 的 `gunPose` 每幀依 `GUN_HOLD`（每種槍的右手握點、左手扶的位置與槍托抵肩點）把槍擺好，兩隻手用兩節骨 IK 對到槍上、手掌依 `HAND` 握成對應的手型；沒瞄準時長槍放低（low ready）。`held().ik` 是兩隻手腕離握點的距離。
- 存檔第 6 版：`nc260.motors` 多了 `side`：`race`（每條賽道最佳秒數）、`win`（贏過的賽道）、`surv`（鐵灣夜戰最高波數）、`turf`（拿下的地盤）、`tale`（每位委託人完成幾段）、`svb`（其他擂台的最高波數，舊存檔沒有就是空的）；讀檔只檢查形狀。
- 存檔第 7 版：照 GTA V 地圖重排之後的位置。第 5、6 版的快速存檔位置是舊三區（`05-zones.js` 的 `ZONES_V6`）的世界座標，讀檔時換回邏輯座標再換到新的片；落在拿掉的格子、水裡或外緣外的挪到最近的車道（`rnLaneSpot`）。

### GTA 式擴充（補完）

HANDOFF 先前列為未做的項目：

- 搶劫的戰車與斷橋：上了逃亡車 3.5 秒後，兩台「鐵砧」戰車擋在往貨場路線上的路口，GPS 改指鐵灣高架斷橋；斷橋下排著沒人的警車封鎖線。從斷橋衝出去（0.25 倍慢動作、固定機位）飛過去落地，通緝降到最多 3 星、警察失去視線，GPS 指回終點「貨櫃安全屋」（鐵灣貨場的黃圈）。第一次飛過也領特技獎金。
- 強攻守門的人質：Jax 在門口守 60 秒時，每 12–18 秒有一名人質從正門衝出去、沿街往警察那邊跑：瞄準他就趴下，打死扣 $40,000，跑出 32 m 多派一台 SWAT；警員衝到門口 3.5 m 內會闖進大廳，Vance 擋下但鑽機慢 6 秒。
- 幫派與警察：2 星以上赤蠍幫會先打警察，警察也會打幫派；追殺時幫派在你附近開的槍算進你的通緝。資產防守的進攻者開車過來（每波一到兩台），池子滿了就排隊，有空位再從畫面外補上。
- 霓虹新聞台（手機）：運鈔車、懸賞、地盤、搶劫、資產防守、股市大跌、甩掉高星通緝都會發一則新聞（跳出提示）；離線期間依時間長短補一到四則，有的會讓股價先動。
- 倒地的身體：戰鬥員池要騰位置時，畫面裡的身體留在原地（另一組 crowd），走遠了才收，不會突然消失。
- 掩蔽：警察的視線還會被牆與實體建築的碰撞盒、矮牆（只擋蹲著的人）、蹲在後面的路燈／號誌／垃圾桶／電訊箱、電話亭擋住。直升機前方 3 秒的屋頂比飛行高度高時，往左右 35°／70° 挑低的方向轉。
- 車窗射擊：實車的座椅高度與前後位置由 `tools/seats.mjs` 量車頂輪廓得到（低趴跑車頭不會穿出車頂）；右手 IK 握槍從車窗伸出去、左手 IK 握方向盤。徒手按右鍵舉拳架式。程式建模的武器替身照 `GUN_HOLD` 的握點做握把、護木與槍托，雙手剛好握在替身上。
- 街頭賽對手會閃前方的車流、路邊車、玩家與其他對手（往空的一側偏一條車道、太近就煞車）。懸賞逃犯車在你 90 m 內會不時逆向、轉彎拉手煞甩尾。
- 地盤影響街頭：赤蠍幫的地盤路人少三成五，街角會站著兩三個盯梢的（有時旁邊停著座車），靠近 7 m 或拔槍就動手；搶下來的地盤沒有盯梢，也不會出現幫派交易。

### 車輛規格與改裝

- **每台車都不一樣**（`26-glb.js` 的 `CAR_REAL`）：47 台實車各自有原廠的車重、馬力、0–100 秒數、極速、繞圈側向 g、100–0 煞車距離與驅動方式（公開規格與媒體實測的概數；賽車是規格書的最低車重），`realTune` 換算成遊戲數值（`TUNE` 具名常數）：極速 = 原廠 × 0.8（再由 `vmaxFor` 反推推力歸零的 `vmax`）、加速 `eng` = 5.5 + 1.65·(27.8 / 0–100 秒)、抓地 = 5.2 + 4.2·g（機車 3.6 + 4.6·g）、質量 = 車重（機車加 80 kg 騎士）、轉向 1.05·(1500 / 車重)^0.3（四驅 ×0.97）、手煞車 μ 後驅 .4／前驅 .5／四驅 .56 × (車重 / 1500)^0.25、耐久 650 + 0.32·車重（防滾籠 +200、警用 +300；機車 380 + 車重）、煞車 16·(386 / 煞車距離 / 10.5)^0.8 m/s²。車行與車庫的看車對話列出遊戲裡的極速、加速／煞車／抓地評分與原廠數字。車流、警車與搶來的車照舊用 `VCLASS` 級距。
- **CHROME WORKS 霓虹改車王總廠**（`66-chrome.js`，規格書 `neon_nightcity_gta_v_neon_mega_customs.md`）：雙層挑高的旗艦改裝廠（36 × 34 m，前段挑高 9.6 m）。前牆三道 5.5 × 4.5 m 的感應捲門對著三個工位：工位 1 鈑金與烤漆（四柱液壓頂高機、無塵烤漆房與噴漆機械臂）、工位 2 動力馬力機（地坑滾筒、車頭前的大風扇、馬力機電腦，你的車停在這裡）、工位 3 低底盤重改區（棋盤格地、液壓起落的 Challenger 展示台、焊裝甲的機械臂與焊花、裝炸彈的工作檯）；中段是零件展示走廊（輪框架、尾翼牆）、首席技工鐵手強尼的工作站與鐵網隔開的工位 4 黑市拆解區（地磅、讀數盒、出口懸賞黑板、Rook 的收車檯）；後段夾層底下是休息區、工具牆與輪胎倉庫，2 樓（樓梯在走廊左邊）是老闆辦公室、四台街機與 10 個車位的私人展示車庫。地板是反光環氧樹脂，兩組氧氣乙炔鋼瓶放在工位旁。升降機以外的 Sketchfab 道具（工具推車、輪胎架、空壓機、引擎吊架，以及工位 4 後側的電焊機、拉桿工具箱、頂車架、工位 1 牆邊的工具箱與頂車架、零件倉庫後牆的三座鐵架）、點唱機與街機照舊在 http(s) 下走進來才下載。招牌（工位牌、Low & Slow、PARTS & SALVAGE、DYNO、總廠霓虹、PRIVATE GARAGE）畫在 `cwAtlas`，出口車單黑板是自己的畫布 `cwBoard`（每天換單時重畫）。
- 進出：自己的車停到門口（捲門 1.2 秒升起、門頂黃燈旋轉）按 E 開進去，座駕收起來、同款同色同改裝的展示車停上馬力機；偷來的車停到工位 4 的地磅。走路到門口按 E 也能走進去（馬力機上是空的，到 2 樓私人車庫挑一台就開下來）。進來之後捲門 B 在 1.2 秒內放下。門口的 E 是開車／走出去。
- **改裝面板**（版面仿 GTA V 洛聖都改車王）：走到馬力機旁按 E 打開。左上角招牌、類別列與「n / N」、清單（選到的那列反白，右邊是目前等級或價格，錢不夠是紅字，鎖住的是灰的）、說明、最高速度／加速／煞車／抓地力四條分段性能條（停在某一級時預覽），下面一行是車名、車牌、極速、耐久、車況與馬力機讀數。↑↓ 移動、Enter／E 選、Esc／Backspace 返回，滑鼠與觸控點清單。鏡頭依類別在 0.45 秒內滑到特寫錨點（規格書第五節第 1 點）：主選單／烤漆／裝甲環繞全景（距離 4.8 m、仰角 20°、每秒 0.15 rad，A／D 手動轉）、排氣管與喇叭在車尾左後方、輪胎／煞車／懸吊貼著左前輪、引擎／渦輪／變速箱從車頭上方俯拍、保險桿與車燈在車頭前、尾翼在車尾上方。即時展示：按住 W 或空白鍵原地轟油門（車身晃、放開時回火與洩壓閥）、H 試喇叭、L 把廠房主照明調暗 60% 看大燈與底盤霓虹。車子受損時只能先「修復載具」，其他類別鎖住；裝了炸彈也鎖住（防盜保險與炸彈那一類除外）。
- 13 大改裝（規格書第四節），效果是規格書的公式（`MOD_FX`），價格在規格書的區間裡挑；引擎、渦輪、變速箱的倍率照使用者要求比規格書低（規格書的 ×1.32、×1.22 全上滿是加速 ×1.72，再開氮氣 ×1.6 像火箭；現在全上滿是加速 ×1.24、極速 +3%）：

| 類別 | 等級與價格 | 效果 |
| --- | --- | --- |
| 防彈裝甲 | 20／40／60／80／100% $1,500／$4,500／$9,000／$15,000／$25,000 | 車體最大耐久 ×(1 + 裝甲%)；撞歪輪軸的機率 −75% |
| 煞車系統 | 街頭／運動／賽道級陶瓷 $1,000／$5,000／$12,000 | 煞車減速度 ×(1 + 0.12·級) |
| 保險桿與防撞鏟（機車沒有） | 碳纖維前下巴 $800、賽博防撞鋼架 $4,200、尖刺鏟 $8,500 | 前下巴只是外觀；鋼架與尖刺鏟正面撞車（4 m/s 以上）把對方往上鏟 3.5 m/s，尖刺鏟順便扎破對方前輪（`v6Plow`） |
| 引擎調校 | EMS 1–4 級 $2,500／$5,000／$9,000／$18,000 | 加速 ×(1 + 0.03·級)，極速 +0.5%／級（4 級 +2%） |
| 排氣管與喇叭 | 雙出鈦合金 $600、側排管 $2,200、狂暴直通管 $4,500；氣動／音樂／警笛喇叭 $1,200／$2,500／$5,000 | 引擎聲的音量與音高（`sfx.exhaust`）；放油門或換檔回火機率 8／25／75%（藍色回火、點得著地上的汽油）；開車按 H 按改裝喇叭 |
| 擾流尾翼（機車沒有） | 低調鴨尾 $1,200、碳纖維 GT 大尾翼 $6,500 | 側向抓地 μ +0.03／+0.06（`grip` = μ·10） |
| 渦輪增壓 | 賽道雙渦輪 $15,000 | 加速 ×1.08、極速 +1%；鬆油門有洩壓閥的口哨聲 |
| 變速箱 | 街頭／運動／序列式 $3,000／$8,000／$16,000 | 換檔延遲 0.35 → 0.25／0.15／0.08 秒，換算成加速 ×(1 + 0.1·省下的秒數)；倒車起步 +15／30／45% |
| 懸吊與液壓 | 降低 1–4 階 $1,000／$2,000／$3,500／$6,000、高功率液壓 $22,000 | 車身下降 2–8 cm、重心 −8／15／22／30%（側撞翻車門檻 ÷ 重心）；液壓見下面 |
| 烤漆與車牌 | 換色 $500；金屬／消光／珠光／電鍍鏡面 $1,500／$3,500／$5,000／$10,000；隨機車牌 $500、自訂車牌（8 個英數字）$1,500 | 烤漆材質是 `26-glb.js` 的 `uPaint.w`（原廠色也能換材質）；通緝中只要警察沒看到，噴漆或換牌就消星 |
| 輪胎與燒胎煙 | 防彈輪胎 $20,000；霓虹紫／青／紅／綠燒胎煙 $1,500 | 子彈打不破、不怕釘刺帶（`bpTires`）；甩尾與燒胎時後輪冒煙（原廠是白煙） |
| 車燈與底盤霓虹 | 氙氣白光 $1,000、黃金大燈 $3,000；底盤霓虹五色 $4,500；隨重低音閃爍 $1,000 | 大燈光色、車底的點光與側裙燈條（恆亮或跟著音樂拍子閃） |
| 防盜保險與炸彈 | 全額保險（車價 10%）；點火引爆炸彈 $5,000、手機遙控炸彈 $7,500 | 見下面「第六部曲」 |

- 選原廠免費換回；套件存在 `motors.mods[車]`，跟著車走：換車、試駕結束、從車庫開出來都由 `applyCar` 的 `carHooks` 重新疊上去（實車模型下載好會再呼叫一次，把改裝件掛回新的車身），試駕的車是原廠狀態，賣車時一起清掉。前下巴、防撞鋼架、尖刺鏟、鴨尾、GT 大尾翼、排氣尾管、側排管與底盤霓虹燈條是程式建模的改裝件（`modParts`）：實車照 `cars.json` 的 `kit`（`tools/kitfit.mjs` 量的保險桿平面輪廓、側裙、尾箱後緣）沿著真實車身擠出剖面（`07-kitx.js` 的 `Kit.loft`），碳纖維與燒鈦是 `MAT.ux` 的程式紋理（31、32）；原廠就有尾翼、或量不到尾箱後緣的車不能裝尾翼（`modCan`，選單裡沒有這一類，客戶委託也不會開這一項）；程式建模的替身照車長、車寬、車高擺。
- **修車估價**（規格書第三節）：C = 基準費 × (1 − HP/HPmax) + $35·破窗 + $80·鈑金件 + $60·爆胎 + $150·歪軸；基準費轎跑 $300、肌肉車 $550、超跑 $1,200（照 `carClass`），破窗是碎過車窗就算整台 6 片，鈑金件照受損程度 0–6 件，歪軸見下面。修好時泥巴與血跡一起洗掉。
- 鐵手強尼（工作站）依車況打招呼（40% 以下、85% 以下、完好三種），裝了 4 級 EMS 或渦輪會說那句經典台詞；工位 2 前面的馬力機電腦按 E 跑一次馬力機（原廠馬力乘上引擎與渦輪的倍率）。
- 測試 API `__nc.chrome`：`CATS`／`GRP`（類別與群組）、`MOD_FX`、`CAR_REAL`、`TUNE`、`CRASH`、`STAGE`、`st`（`parked`、`show`、`stolen`、`dim`、`rev`）、`CHROME_CAR`／`BAY1`／`BAY4`／`JOHNNY`／`ROOK`／`STAIR`／`PRIV`、`pad()`、`stats(id, m)`、`apply()`、`repairCost()`、`repairParts()`、`plate(id)`、`dlg()`；改裝面板的 `panel()`（`open`、`path`、`cat`、`sel`、`cam`、`title`、`rows`、`desc`、`note`）、`open()`／`close()`、`key(code)`、`choose(名稱)`、`plateIn(文字)`（自訂車牌的輸入框打開時填入並確定）、`dim(on)`、`rev()`。
- 室內是程式建模；想換成整間實體模型的話，Sketchfab 上的候選與下載方式見 HANDOFF.md。

### GTA 式擴充（v2 規格補完）

對照使用者的 `neon_nightcity_gta_v_2.md` 補上的部分（`node tools/check-gta-v2.mjs [html]` 驗收）：

- 車輛級距（`25-cars.js` 的 `VCLASS`）：超跑 240、肌肉車 205、轎車 180、機車 225、重型 130、警車 215、坦克 75 km/h，質量、加速、抓地、轉向、手煞車與耐久照表；`vmaxFor` 讓終端速度剛好等於表上的數字。`driveVehicle` 踩油門時的淨加速度（推力減阻力）再乘 `ACC_K`（0.75，2026-10-26 全部載具的基礎加速調降 25%），0–100 的時間是 1.33 倍、極速不變。
- 車損（`68-wreck.js`）：60% 碎窗、50% 冒白煙、30% 黑煙且動力打七五折並偶爾熄火、12% 起火每秒 −25（AI 下車逃跑；原本規格的 70%／40%／15% 撞兩下就冒煙，調得耐撞一點），撞擊扣血 ΔHP = max(0, (J/M − 6)·9)（時速 50 正面撞牆約 −100、時速 100 約 −260），爆炸半徑 12 m。子彈打輪胎（每顆 50 HP）會爆胎：極速每顆 −15%、抓地下降、往破胎那側偏、車身下沉。開車撞人：傷害 1.8·v²，被撞飛的人沿拋物線飛出去、撞牆反彈、落地翻滾。
- 警察戰術（`69-tactics.js`）：2 星起警車會瞄準你的車尾一角做 PIT；4 星起警員會往躲著不動的你丟催淚瓦斯（站在煙裡每秒 −6、畫面泛灰綠），並有直升機在 18–55 m 外的路口垂降四名特警（直升機可以打下來，繩上的人跟著摔）。路障擺在前方 70–200 m 內最接近 150 m 的路口。
- 榴彈發射器（武器轉盤第 6 格，暗網軍火 $2,800）：拋物線、落地爆炸半徑 7 m；催淚瓦斯（第 7 格）丟出去嗆暈警察與敵人。
- 強攻的前置 B：交完鑽機廂型車後換成 Jax，到 7 號大道的路口埋伏 NCPD 移防車隊（鎮暴裝甲車、護送警車、四名押車特警）。電擊槍或催淚瓦斯放倒的特警癱瘓 14 秒；有人站著盯你 2.5 秒就呼叫支援（2 星）。搶到裝甲車即 3 星，甩開視線後開進 CHROME WORKS 按 E 改裝防彈輪胎與偽裝塗裝（通緝清掉）。
- 金庫電子鎖破譯：炸開金庫門後自動開啟，20 秒內用 A／D 調頻率、W／S 調振幅，三組波形各對齊 0.6 秒（手機有按鈕）；按 E 改裝鋁熱鑽機。破譯時 Kael 接手壓人質，威懾不會掉。成功：潛行沒響警報就直接開金庫撤離；響了警報（強攻炸門一定響）Jax 只守 30 秒。逾時：潛行觸發警報。
- 潛行路線響警報（行員按鈕、人質跑出去、破譯逾時）立刻 4 星。
- 逃亡載具：潛行照舊是銀行附近路邊的 Tiara GT（城裡沒有能開車的暗巷）。強攻是改裝過的鎮暴裝甲車（防彈輪胎、釘刺帶無效，市政工程塗裝讓沒盯著你的警察視錐縮小），開到灰鷺河濱的停機坪換武裝直升機：Space 爬升、Shift 下降、左鍵發射火箭；飛到離地 30 m 以上地面的警察就看不到你，只剩警用直升機跟得住。降落在鐵灣貨場的黃圈（停在地面）才算 HEIST PASSED，強攻不會再有戰車封路。
- 測試 API：`__nc.gta.wreck`（`VCLASS`、`tires(v)`、`shootTire(v, i)`、`fix(v)`、`ram(k, sp)`）、`gta.tac`（`gas(x, z, by)`、`rap()`／`rapState()`、`pitAim(u)`、`cops()`）、`gta.gunship`（`HELIPAD`、`build(x, z, yaw)`、`fire()`、`roofH(x, z)`、`GS`）、`gta.heist` 多了 `setupB()`、`enf()`、`escorts()`、`refit()`、`garDoor()`、`HACK`、`hackOpen()`、`hackInput(k)`（`f-`／`f+`／`a-`／`a+`／`drill`）、`hackSolve()`、`heli()`、`getawayCar()`。

### GTA 式擴充（第三部曲：遺漏機制與碰撞範圍）

對照使用者的第三份規格書（《GTA V 開放世界擴充版》遺漏機制補完與物理碰撞範圍演算）補上的部分，`node tools/check-gta-v3.mjs [html]` 驗收。規格書的數字全部遺失，下面的值是自己挑的，都是程式裡具名的常數：

- **六圍屬性**（`69-v3-skills.js`）：體力、射擊、力量、潛行、駕駛、肺活量，三位主角各一份（起始值 `SK_BASE`：Vance 射擊 65／潛行 60、Kael 駕駛 70、Jax 力量 70／體力 60），Esc 選單「遊戲 › 角色能力」看得到。衝刺 18 秒、游泳 25 秒、蹲行 25 秒、時速 110 以上 25 秒、騰空 5 秒、潛水 6 秒各 +1；打中人 +0.05、擊倒 +0.3、爆頭 +0.8、近戰 +0.2、擦身而過 +0.25。效果：射擊降低後座力（×1.3→×0.6）、散布與換彈時間（最多 −35%）；力量提高近戰傷害（×0.8→×1.35）、減少摔落與飛出車外的傷害；潛行縮小噪音圈、蹲行加速；駕駛 40 以上讓騰空翻滾更靈活（滿級 ×1.3）、翻車翻回來更快；肺活量閉氣 30→120 秒。
- **衝刺體力**：0 級跑 8 秒、99 級 48 秒、100 級無限（`SK_RUN_T`）；喘的時候跑速 ×0.74，還硬按衝刺每秒 −1.5 生命（扣到 20 為止）。左下的細條顯示體力與閉氣。
- **噪音圈與消音器**：小地圖上淡藍色的圓，半徑蹲行 3.5、走路 9、跑步 18、游泳 6、開車 8–34、槍聲 60、裝消音器 7、爆炸 110 m（`NOISE`，潛行等級最多縮小一半）。警察的「聽到槍聲」與站著聊天的幫派醒來都改用這個半徑；背後蹲著近戰一擊倒（沒有通緝時）。消音器手槍、衝鋒槍、步槍、狙擊槍各 $1,800，手機「改槍與裝備」。
- **汽油與連鎖反應**（`69-v3-chem.js`）：汽油桶在投擲物格，按住開火邊走邊倒（每 0.45 m 一灘、1%，補滿 $400）；子彈打到地上的油、爆炸、燒著的車都會點著，火每 0.09 秒沿油線燒 1 m，每灘燒 7 秒，燒到的人倒地、車 1 秒後起火。車身左後的油箱（車長 −36%～−14%、離地 0.35–1 m）第一發打穿漏油（最多 45 灘）、第二發起火；子彈打穿擋風玻璃（離地 1–1.45 m、車頭 2%–30%）駕駛中彈，車流車與警車失控滑行。破胎還開到時速 45 以上，輪框噴火花，累積 9 秒起火（`RIM_HEAT`）。下雨或站在水裡用電擊槍，3 m 內的人一起觸電。
- **拋出車外與安全帶**（`69-v3-crash.js`）：沒繫安全帶時，車速 19 m/s 以上、一幀內往前的速度變化超過 20 m/s 就從擋風玻璃飛出去（機車任何方向 10 m/s），落地傷害照撞擊力道；停車 2 秒自動繫上（`CR_BELT_T`）。高速時一幀走超過半個碰撞半徑就切成最多 5 個子步（`driveSub`），不會穿過細的東西。
- **翻車與擦牆**：倒扣時按住 A 或 D 先晃再翻回來（1.3−0.7×駕駛 秒；放著不管 4 秒起火）。撞牆入射角 30° 以內算擦過（`SCRAPE_SIN`）：只去掉法向速度、切向留著（每秒衰減 `SCRAPE_DRAG` 0.55）、車頭被帶向牆的走向、噴火花；正面撞照舊反彈並掉一成速度。
- **跳傘與翻越**：直升機離地 22 m 以上按 F 跳下（`SKY_MIN`），自由落體終端速度 52 m/s，F 或空白鍵開傘：下降 5.2 m/s、Shift 9 m/s、滑翔 8.5 m/s（`CHUTE_*`）；落在屋頂會順著滑出去。走路按空白鍵翻越前方 0.3–1.1 m 的矮牆、護欄或停著的車（厚度 2.6 m 以內）。
- **潛水與打撈**：游泳時按 Z 下潛 2.4 m（`DIVE_D`），警察看不到、子彈打不到，閉氣用完每秒 −8；海裡沉著八個走私貨櫃（碼頭附近、水深 4 m 以上，水面冒泡，游泳或開船時小地圖 45 m 內有聲納圈），潛到 3.5 m 內撈起現金、重武器彈藥或防彈衣，撈過的寫進存檔。
- **計程車**（`69-v3-world.js`）：路上的計程車 12 m 內按 E 招手、靠停後按 E 坐後座，選導航點、自己的家、LAZARUS 或 VELOCE MOTORS，淡出淡入直接到（遊戲時間照路程往前推）；車資起跳 $30、每公里 $55，錢不夠就是逃票（1 星）。F 照舊是搶車。手機「霓虹計程車」6 秒後到。通緝中不載。
- **日夜與天氣**：20:00–05:00 算晚上：運鈔車白天 ×2、晚上 ×0.5，幫派交易反過來，懸賞逃犯晚上 ×1.3，幫派盯梢晚上來得快；下雨時警車、小隊車、賽車對手與運鈔車的側向抓地 ×(1−0.3×積水)、煞車 ×(1−0.2×積水)（`aiDrive`）。
- **搶劫同夥**（`69-v3-heist.js`）：計畫板選完潛行或強攻後挑三個人，Zero 原本固定的一成換成三人各自的分紅：

  | 角色 | 老手 | 菜鳥 |
  | :-- | :-- | :-- |
  | 駭客 | Zero 12%：破譯 ×1.4、鑽機 ×0.75、人質威懾掉得慢 | Pixel 5%：破譯 ×0.75、鑽機 ×1.25、威懾掉得快 |
  | 車手 | Nova 10%：逃亡車極速 +12%、耐久 +35% | Dash 4%：極速 −10%、耐久 −25% |
  | 槍手 | Rook 12%：逃出銀行時一起衝出來（步槍、520 HP） | Lu 5%：衝鋒槍、160 HP，倒下掉一成贓款 |

  菜鳥活著完成一次搶劫升一級（最多 3 級，每級往老手靠近 1/4，分紅不變），寫進 `motors.gear.hire`。
- **撞得斷的設施**（`69-v3-break.js`）：時速 22 km/h（`BRK_V` 6 m/s）以上的汽車撞上路燈或消防栓就撞斷：碰撞圓搬走、車只掉一成速度、模型倒下；路燈那一盞熄掉，下雨或有水時斷口漏電 10 秒（2.5 m 內觸電倒地）；消防栓噴 12 秒水柱，1.3 m 內的人被沖倒。機車撞上去是人摔出去；號誌桿與護柱撞不斷。
- **撬車警報**：撬路邊車（敲破車窗）響 8 秒、閃雙黃燈（`ALARM_T`），45 m 內有警察就直接 1 星（`ALARM_COP_R`）。把駕駛拖下車不響。
- **路人撲開**（`40-people.js`）：玩家的車 7 m/s 以上時，車頭前方 0.9 秒車程、車寬兩側各多 0.9 m 的長方形裡的人往車外側撲（每秒 7 m、最多 2.6 m，撲出去就不換邊），之後跑開。
- **碰撞**：規格書第二到四節的兩階段碰撞大多已經有了，沒有另外寫 `CollisionEngine.js`：寬相位是碰撞空間索引（`boxesNear`／`circlesNear`），車與牆用兩個圓推出，路燈、消防栓、樹是圓，建物是盒（帶區的旋轉框），子彈與火箭本來就是線段測試（CCD），撞人分級、PIT、輪胎、爆頭、掩護視線都在前兩部曲。這次補的是子步、擦牆、撞斷、弱點與撲開。
- 存檔第 7 版：`nc260.motors` 多了 `skills`（三位主角的六圍，0–100）與 `gear`（`sil` 裝了消音器的槍、`salv` 撈過的貨櫃、`hire` 菜鳥等級）；讀檔逐項檢查形狀與範圍，舊存檔用起始值。
- 存檔第 8 版：合併兩條分支的第 7 版（照 GTA V 地圖重排後的位置＋第三部曲的 `skills`／`gear`）。讀到第 7 版時，有 `skills` 的是第三部曲那一種，位置仍是舊三區的世界座標，照第 5、6 版換算；沒有的是重排那一種，位置不動。
- 測試 API：`__nc.gta.v3`：`skills`、`skK`、`sk(k)`、`skUp(k, n)`、`stam`、`noise`、`breath`、`salv`、`diveToggle()`、`silOn(id)`、`gearRows()`、`skillRows()`；`chem`（`fuel`、`leaks`、`drop(x, z, src)`、`ignite(x, z, r)`、`weakHit(ref, kind, x, y, z, mine)`、`localOf(ref, x, y, z)`、`rim(v)`）；`crash`（`crash`、`vault`、`chute`、`eject(dv)`、`bail()`、`open()`、`tryVault()`、`sub`）；`hire`（`HIRE`、`hireVal`、`hireK`、`hireCuts`、`start(how)`、`set(o)`）；`taxi`、`taxiRide()`、`isNight()`、`evW(kind, w)`；`brk`（`brk`、`init()`、`nearest(x, z, kind)`、`sweep(v, dt)`）；`alarm`；`wall(x0, z0, x1, z1)` 臨時放一面世界座標的牆（回傳拆掉的函式，驗收擦牆用）。

### GTA 式擴充（第四部曲：碰撞響應與位移）

依使用者的《人、事、物交互碰撞與物理位移演算規格書》，在 `69-kinema.js`。規格書裡別的模組已經做掉的部分照原本的：車撞牆的擦牆與反彈（`vehicleCollide`）、撞出擋風玻璃（`69-v3-crash.js`）、撞斷路燈與消防栓水柱（`69-v3-break.js`）、撞人擊飛（`68-wreck.js` 的 `pedRam`）、爆炸與側撞翻車、車疊在車頂上跟著走（`68-roll.js`）。貼上來的規格書公式與程式碼都掉了，下面的數字是補的（`KIN`）。

- **推動層級**：建築與地形不動（逆質量 0），其他依質量取逆質量（`massOf`，沒有設的汽車 1600、機車 280，人 85）。兩物穿透 d 時各退 max(d − 1 cm, 0)·0.8·W_i/(W_A+W_B)，一幀迭代 4 次（`KIN.slop`／`beta`／`iters`）。
- **車車**：位置修正的迴圈裡也推牆，貼牆的車把牆的反推傳給後面的車；速度用序列衝量 4 次，法線帶恢復係數 0.25（接近速度 1 m/s 以下不彈），切向庫侖摩擦 μ = 0.45；接觸點離車身中心的力臂讓車打轉（`v.yk`，最多 3.5 rad/s、每秒衰減 e^−2.4），轉得快的車 `v.slideT` 秒內側向抓地只剩四分之一（PIT）。傷害照原本的 (Δv − 3.5)·18，側面被撞得夠猛照樣交給 `rollHit` 翻車。
- **夾扁**：同一台車兩個接觸法線夾角超過 135°（另一邊是牆、路邊車或另一台車），推的那台 M·v ≥ 6000 kg·m/s：扣 320（3 噸以上 150）、碎窗、往旁邊擠出 3 m/s、輕的車往上拱一下（`rollStart`）。
- **人推車與被車夾**：停著沒人開的車被人推得動 m/(M+m)（轎車約 5%、機車 23%）；車頭以 1.2 m/s 以上把人往牆上推，扣 35 + 5·v、人往上彈到引擎蓋上（`player.air3`），冷卻 1.5 秒。
- **人與人**：玩家和路人、戰鬥員、警察 0.64 m 內各退一半（軟性分離）。衝刺（4 m/s 以上）正面撞上是肩膀撞人：玩家保留八成速度，對方踉蹌 0.8 m（0.35 秒），背後 0.6 m 有牆、設施或 25 cm 以上的高低差就直接倒；脾氣差的回頭揮拳。
- **近戰**：揮拳時前方 reach + 1.1 m、夾角約 57° 內最近的目標，出手前以 7 m/s 吸附到 0.7·reach、身體轉過去；打不倒的退 0.45 m，打倒的往後摔（路人 3.2 m/s、往上 0.6）。
- **擊飛**：警察與戰鬥員中彈倒地往中彈方向滑約 0.6 m（庫侖摩擦 μg = 6.5 m/s²、撞牆吃掉法向速度）；開車撞倒的戰鬥員照路人的 `pedRam` 飛出去（1.15·v、往上 min(12, 0.45·v)）。爆炸依距離衰減 f 把人拋出 3 + 11f m/s、往上 1 + 5f；玩家在 f > 0.45 時被拋到半空（其他照原本往後倒）。霰彈 6 m 內打倒的人往後飛約 3.5 m。被轟飛滑得快（3.5 m/s 以上）的路人會撞倒路上的人（保齡球）。
- **子彈推車**：沒人開的車每發往彈道方向推 dmg·6/M m/s（步槍一發約 0.1 m/s）。
- **劫車**：駕駛座那側（左）0.55 m 外貼著牆或設施就從副駕側拉人；駕駛被拖到車門外後方約 1.4 m，玩家最後 0.25 秒滑進駕駛座。
- **跳車**：時速 15 km/h（`KIN.jump` 4 m/s）以上按 F，人往車門那側滾出去（車速的七成 + 側向 2.6 m/s、往上 2.2），落地扣 (v − 6)·1.3（乘上力量的承傷倍率）；車沒人開，照 `coast` 滑到停，滑出去的 8 秒內撞到路人一樣撞飛。
- 沒做：消防車水砲（沒有消防車）、玩家站在車頂隨車移動（玩家不會站上車頂，翻越是直接翻過去）。
- 測試 API：`__nc.gta.kin`：`KIN`、`kin`（計數器 `crush`／`crushWalk`／`barge`／`jump`／`door`／`bowl` 與 `last` 吸附距離）、`massOf`、`jump()`、`door(v)`、`hit(x, z, r)`、`open(x, z, R, L)`（附近的空地與往前 L 公尺沒有東西的方向）、`wall(x, z, r)`（最近的平牆與法線）、`spawn(type, x, z, yaw)`、`drop(v)`、`me()`。

### GTA 式擴充（第六部曲：大型改裝車廠）

使用者提供的 `neon_nightcity_gta_v_neon_mega_customs.md`。廠房與 13 大改裝在上面「車輛規格與改裝」，這裡是第二、三、六、七節的機制（`69-v6-customs.js`），名稱都是原創的（保險公司是「磐石互保」）：

- **進廠規則**：沒通緝照常開進去；通緝中被警察看到時捲門鎖死，強尼大吼「別把 NCPD 條子引到我店裡來」；脫離視線（星星閃爍）可以躲進來，捲門在身後放下，噴漆或換牌就清掉通緝。坦克、直升機與船進不來；街上偷來、市價超過 $100,000 的超跑（例如停車場的 P1）「太燙手」，要等你買下車廠又裝了黑市晶片抹除儀。
- **強尼的開場白**：車況 40% 以下「她這次又是哪裡出毛病了？」、85% 以下「要先幫你把鈑金敲平嗎？」、完好「全夜之城最頂尖的技工」；裝 4 級 EMS 或渦輪時說那句經典台詞。
- **拔槍關店**：在店裡拿槍瞄準 0.35 秒或開槍：改裝鎖死、「修車廠已暫時關閉」。一半機率店員丟下板手往後面跑並報警（1 星）；一半機率強尼抽出泵動式霰彈槍（每 1.3 秒一發、16 傷害）、兩個學徒拿管鉗衝過來（每 0.9 秒 9 傷害）。小地圖的改裝廠加紅色鎖頭、捲門與大門都不開，你離開 300 m 以上累計 120 秒才重新營業（店員回到崗位）。工位旁的氧氣乙炔鋼瓶被打中會爆炸（5 m 內最多扣 80、店員倒下），0.6 秒後另一組跟著炸，也算暴力事件。
- **歪軸**：一幀裡速度掉 9 m/s 以上的重撞，有 35% 機率撞歪一側輪軸（最多兩側；有裝甲機率 ×0.25），車子往那邊偏（`axleYr`）；修車才會好，修車估價每側 $150。
- **保險**：防盜保險與炸彈 → 全額車輛保險（車價 10%）。投保的座駕燒毀時跳出「請撥打磐石互保申請理賠」，手機 → 磐石互保 → 申請理賠（或按 V、叫鐵手強尼送車）只付車價 1.5% 的自付額，車子連同改裝修好送到附近。沒投保的：座駕只有一台，不做「永久報銷」，改成付車價 12%（至少 $2,500）的原廠重建費。
- **炸彈陷阱**：點火引爆炸彈 $5,000：車停在戶外、你走開 15 m 以上 8 秒，一個偷車賊從 26 m 外走過來拉開車門，發動的瞬間嗶嗶嗶 0.5 秒後整台車炸掉（你自己上車不會炸）。手機遙控炸彈 $7,500：手機 → 鐵手強尼 → 引爆車載炸彈。炸彈裝上之後到引爆或拆掉之前不能改其他東西，炸完就用掉了。
- **液壓**：懸吊與液壓的「高功率液壓系統」：開車按一下 X 在最高（+22 cm）與貼地（−8 cm）之間切換、按住 X 超過 0.28 秒放開就彈跳 1.2 m（`v.air`，和跳台同一套飛行與落地）、按住 X 慢速時 W／S 讓車頭／車尾起伏、A／D 左右起伏（不會開動）。開著液壓車時特殊能力改用 Caps Lock。
- **黑市銷贓**：偷來的車（路邊車、車流車、路邊的機車）開到門口按 E 開進工位 4 的地磅，跟 Rook 談：出售（市價 10% × 車況，至少 20%）、衛星追蹤器 $2,000（只有車行目錄裡的實車能登記到你名下，送進 GARAGE 07）、噴漆換牌 $1,000、修車。賣一台街車之後 15 分鐘（真實時間）才能再賣；工位 4 的黑板每天（遊戲裡一天 = 真實一小時，依時間雜湊）列三款出口車單，耐久 90% 以上交車 ×2.5 而且不算冷卻。警車、救護車與運鈔車不收。
- **收購與委託**：門口的天際置業待售告示牌（或手機）$350,000 買下；保險箱照舊入帳，老闆 Kael 自己開進來修車與改裝全部免費。買下後在戶外、沒通緝、沒在做其他活動時，每 6–9 分鐘強尼傳訊息：工位 1 的頂高機降下來停著客戶的車（車況 55%、碎窗、歪軸），走過去按 E 打開改裝面板（客戶付錢、不收你的），照右上角的清單（修復車損、指定烤漆，再加兩項隨機改裝）改完選「完成改裝、交車」，車停在門口、你坐進去，黃色 GPS 指到客戶家（四間安全屋門口之一）。基本報酬 $25,000，完美車手紅利 $10,000，每擦撞一次（耐久掉 6 以上）扣 $1,500；車毀了或丟在路上（離車 60 m）就失敗。客戶等 10 分鐘沒人理就自己開走。
- **2 樓**：私人展示車庫的 10 個車位停著你名下的其他車（現在開的那台除外），走到車頭按 E，強尼就把那台開到樓下的馬力機上；老闆辦公桌可以買下車廠、收保險箱、買黑市晶片抹除儀（$150,000）；街機 $1 玩一局。
- **沒做到的**：廠房是獨立的室內場景，街上的立面只有原本那一道捲門（地塊 13 m 寬，放不下三道 5.5 m 的門），另外兩道門只在室內；實車模型沒有可動的車門與引擎蓋，所以「引擎蓋升起 65°」與 O 鍵「全車門展開」做不到（O 只提示）；輪框款式（跑車／越野／改裝）換不了（模型的輪框和輪胎是同一個網格），只做防彈輪胎與燒胎煙；副色沒有（模型只有一個車漆材質）；車牌字串存在存檔與面板、HUD 裡，沒畫到車尾（每台模型的車牌位置不同）；開車撞倒技工不會發生（技工只在室內）；第八節的 `NeonMegaCustomsManager` 類別沒照搬，邏輯拆進既有的模組。
- 驗收：`node tools/check-gta-v6.mjs`。

### GTA 式擴充（第七部曲：夜店、賭場、地堡）

使用者提供的 `neon_nightcity_gta_v_1.md`。三個檔案 `69-v7-bunker.js`／`69-v7-casino.js`／`69-v7-club.js`（照這個順序，排在 69-v6 之後、70 之前），名稱都是原創的（賭場是「霓鑽賭場」、保全主管是卡德、軍事基地是霓虹堡）。遊戲裡一天 = `GAME_HOUR` × 24 = 3600 秒（真實一小時）。

- **LAZARUS 夜店**（天際置業買下之後）：
  - 人氣 P（0–100%，新存檔 60%）每遊戲日 −5%；保險箱每日入帳 1500 + 48500·(P/100)²（P 100 是 $50,000），上限 $250,000，滿了卡德傳簡訊。P < 20% 舞池只剩三個人、VIP 區要 P > 80%（老闆自己隨時能上去）。
  - 1 樓舞池中間是全像 DJ 光環；站在舞池按 E 跳舞，跟著 128 BPM 的拍子按空白鍵或左鍵：誤差 0.12 拍內「完美」、0.25 拍內「不錯」，每連擊 8 拍倍率 +1（最高 4×），漏拍或整拍沒按歸零；命中提升體力（六圍的 `sta`）與人氣。
  - 吧台：啤酒 $5、香檳 $500（人氣 +1%）、馬克白威士忌 $350：搖晃 3.5 秒後倒下，醒在五處之一（霓峰塔塔吊的吊臂末端、北嶺鐵道橋正中間（電聯車開過來）、霓虹堡停機坪（4 星）、灰石國宅的垃圾子母車（滿身泥巴）、北嶺 NEON CITY 地標大字頂上（背著降落傘）），時間過了 6 小時、身上只剩內衣 4 分鐘、宿醉模糊 15 秒。
  - 鬧事（每 4–6 分鐘，卡德傳簡訊、小地圖藍點，6 分鐘沒處理人氣 −5%）：A 型（男廁吐滿地的醉漢、騷擾酒保的客人）按 E 拖到後門丟進子母車；B 型（卡座昏倒的大老闆）扛上禮車送聖瑪格麗特醫院急診，超過 28 m/s（約 100 km/h）或撞車會掉心率穩定度。完成都是人氣 +25%、$10,000。
  - 2 樓：VIP 區、老闆辦公室（牆上畫後面的保險箱；電腦預約 DJ（$10,000、人氣 +10%，一天一次）與分派技術員）。冷凍庫的貨梯下到 B1（夜梟改裝廂型車、5 台技術員終端機、物流電腦）與 B2–B5 倉庫（貨箱照庫存疊起來）。
  - 技術員（第 1 位免費，之後每位 $15,000，最多 5 位）各做一種貨：南美進口貨 $20,000／箱（120 秒、上限 10）、貨運與船運 $10,000（70 秒、50）、運動用品 $5,000（40 秒、100，要先買地堡）、醫藥研究 $8,500（60 秒、20）、現金製造 $3,500（30 秒、40）。全部出售：開車頂有 .50 機槍塔（左鍵）、車尾丟 12 顆感應地雷（E）的廂型車送到 500–1100 m 外的買家，10 秒後幫派追殺；洗錢仲介抽 10%、最多 $100,000。廂型車以 http(s) 開啟時換成 Danish337 的 Armored Van（`props/v7van.glb`，`v7VanBody`：蓋掉 shvan 車身、壓成 4.5 × 2.4 m，車長車寬跟著改，砲塔移到車廂頂），下載失敗留著 shvan。
- **霓鑽賭場**（光環廣場 (8,4)，兩棟 42／36 層的塔樓夾著裙樓）：
  - 1 樓禁止攜帶武器（進門自動收起，B1 劫案中才能開槍）。$1 = 1 籌碼，西邊櫃台買賣。
  - 幸運轉盤一天一次（轉盤本體是 aero1515 的 WHEEL OF FORTUNE，`casino.glb` 的 `cs_wheel`，立起來疊在程式建模的 20 格色盤前面一起轉，色盤從八個木托盤之間露出來），20 格 × 18°：頭獎跑車 1 格（展示台上的 Lotus Evija，已經有就改送 100,000 籌碼）、現金與大額籌碼 4 格、神秘獎 2 格（防彈背心、彈藥補滿或 $15,000）、其他籌碼 13 格。
  - 21 點（3:2、莊家停 17、可加倍）、三張牌撲克（底注與跟注、莊家 Q 高成局、順子以上底注紅利）、美式輪盤（0 與 00 共 38 格；紅黑、單雙、大小 1 賠 1，一打 2 賠 1，單號 0／00／17 是 35 賠 1，每種押法回報都是 36/38）、Inside Track 賽馬（六匹、依賠率押注）、老虎機（最多押 2,500，三顆鑽石 1000 倍，理論回報約 94%）。
  - 1 樓整個大廳是 Katydid 的 Gameready Casino scene（Sketchfab Standard，`props/cas_hall.glb`，`tools/props.mjs` 的 `cas_hall` 組；SketchUp 的英吋換成公尺、拿掉描邊線），12.3 × 25.8 m、高 5.2 m：門口在 z 0（大門只是牆面貼圖，玩家在門前出生、按 E 出去）、兩排各 24 台老虎機（`CS_SLOTS`，48 個站位）、西側吧台與兌換櫃台 `CS_CASH`、中央輪盤（`CS_RL[0]`，大廳自己的桌）、6 張 21 點與三張牌撲克的 D 形牌桌（`CS_TABLES`，每桌 7 個座位 `csSeat`）、後段的幸運轉盤台 `CS_WHEEL`、Inside Track 螢幕 `CS_TRACK`、員工門 `CS_STAFF`；頭獎車展示台 `CS_POD` 在東側。碰撞盒、燈與互動點照模型量好的尺寸擺（`69-v7-casino.js` 開頭的常數），以檔案開啟用同一個配置的程式建模替身 `hallFb`。
  - 入口兩張輪盤桌（`cs_rl`／`cs_rl2`）與 B1 的三扇門是 `props/casino.glb`（`casino` 組，原檔在 `.cache/props/`）：氣閘外門 m0（ShakibSKb 的 Vault Door）、氣閘內門 m1（CommonSpence 的 Bank Vault Door）、日間金庫門（OrlandoL 的 Vault door）；三扇都掛在鉸鏈的 `T.Group` 上轉開（`casBDoors[id].piv`，`casDoor(id, open)`，開著的門板有碰撞），走進 1 樓或 B1 才下載。
  - 裙樓屋頂是泳池、躺椅與停機坪，東牆鐵梯爬上去。
- **金庫劫案**：AFTERGLOW 酒吧街機旁的計畫板，踩點決定金庫放什麼（現金 $2,115,000、名畫 $2,350,000、金條 $2,585,000、鑽石 $3,290,000），選路線付準備費：
  - A 偽裝保全（$45,000，金庫 150 秒，出來 2 星）：從東南角卸貨口進去；拿槍指人或開槍就穿幫。
  - B 屋頂垂降（$35,000，135 秒，3 星）：通風井垂降，EMP 停電 60 秒（夜視鏡畫面、警衛只看得到 3 m 內）；蹲著從背後按 E 無聲制伏，攝影機看到你、警衛發現屍體都會報警。
  - C 下水道強攻（$25,000，85 秒，4 星）：炸開西邊人行道的鐵蓋（或開 2.6 噸以上的重型車以 9 m/s 撞進去），重型護甲（子彈 ×0.55）與鋁熱劑；一進去就是警報。
  - B1：保全室兩台讀卡機要在 1.5 秒內都刷（逾時三次報警）→ 氣閘外門關上 3 秒後開內門 → 主金庫倒數開始；6 道柵門各要 3 秒破解指紋鎖（C 用鋁熱劑 4 秒），每堆 4 秒裝袋（名畫割畫布 6 秒），每堆是金庫總值的 1/6；旁邊的日間金庫每天一次 $40,000–90,000。袋子裡金條過半：走路速度 ×0.68、不能跳。
  - 倒數剩 15 秒畫面閃紅、嗶聲；歸零釋放神經毒氣：每秒 −12 HP（無視護甲）、通緝鎖 5 星 90 秒。從卸貨口出來坐上逃亡廂型車，甩掉警察把贓物送回 AFTERGLOW 後巷才入帳（同夥抽成 0）。
- **北嶺地堡**（天際置業 $1,150,000，灰石國宅北端 (16,0)；霓虹堡在隔壁的 (15,0)）：
  - 製造區 3 台 CNC 銑床 `BK_CNC`、2 台立式銑床 `BK_MILL`、2 台車銑複合機 `BK_LATHE`，室內南牆與山坡入口旁的人員門是 `props/bunker.glb`（`bunker` 組：ambivalentBear、vramstudio、herdiansyahhadi、Gabriel Gauthier，CC BY），走近地堡 300 m 內或走進去才下載。
  - 物資 S（0–100%）：管理電腦買 $75,000，3 分鐘補滿；補給任務 +40%（攔截北嶺鐵道橋的軍火列車、搶錨灣港的幫派化學品卡車、從霓虹堡偷坦克，4 星）。
  - 每秒用掉 0.15% 物資；模式 α（全力生產 1、各半 0.5、全力研究 0）：庫存 += α·2100·dt（上限 $1,050,000）、研究 += (1−α)·0.45%·dt。出貨開軍火卡車，本地買家 ×1、冠石金融區的買家 ×1.5（追兵多一顆星）。
  - Mk II 工作台：手槍 $25,000、衝鋒槍 $40,000、步槍 $60,000、狙擊槍 $95,000（傷害 ×1.15），B 鍵切換彈種：燃燒彈（著火打滾 6 秒、每秒 18）、空尖彈（軟目標 ×1.65）預設解鎖；研究依序解開爆裂彈（半徑 4.5 m，打警車或直升機一發爆）、穿甲彈、全金屬被甲彈（車輛 ×2.5、打穿薄牆與防彈玻璃）、熱成像瞄準鏡（狙擊開鏡按 E：畫面變灰，人、警察、引擎發熱的車變亮）。
- **畫面效果**（70-render 的合成 shader，`uFx7`／`uHeat`）：熱成像、毒氣的綠霧與扭曲、夜視鏡、宿醉模糊。
- **沒做到的**：遊戲日用真實一小時；技術員只有 5 位、倉庫容量合計 220 箱；「只剩內衣」是把上衣、褲子換成膚色與白色的近似；劫案的計畫板放在 AFTERGLOW 的街機角落、同夥抽成是 0；頭獎車用車行目錄裡的 Lotus Evija（$2,100,000）；賭場的建築、轉盤與 B1 的其他東西、地堡都還是程式建模（Sketchfab 候選見 HANDOFF.md）；第四節的類別結構沒照搬，拆進既有的模組與 `side.act`。
- 存檔第 12 版：多了 `v7`（`club`：`pop`、`hired`、`job`、`goods`、`gT`、`dj`、`djDay`、`full`；`bunker`：`S`、`stock`、`res`、`ri`、`alpha`、`buyT`、`mk`、`rounds`、`sel`；`casino`：`chips`、`wheel`、`won`、`tgt`、`app`、`done`、`daily`）。
- 測試 API：`__nc.gta.v7`：`FX`、`key(code)`；`club`（`st()`、`daily(P)`、`tick(dt)`、`pop(n)`、`crowdN()`、`level(k)`、`stairs(up)`、`lift(k)`、`fee(v)`、`beat.{start,hit,end,st}`、`trouble.{start(id),a,b,clear,st}`、`macbeth(id)`、`drinkStep(dt)`、`last()`、`spots`、`sell()`、`mine()`、`safe()`）；`bunker`（`st()`、`tick(dt)`、`unl(id)`、`door()`、`fort`、`enter()`／`exit()`、`sup(kind)`、`sell(K)`、`mk(id)`、`ammo(id)`、`cycle()`、`thermOk()`、`heat()`）；`casino`（`st()`、`door()`、`enter()`、`spin()`、`ready()`、`wheelStep(dt)`、`SLOT_SYM`／`SLOT_STRIP`、`bj.val`、`tcp.rank`、`rl.{spin(押法, 注, 號碼),step(dt),BETS,st}`（號碼 −1 是 00）、`vault()`（金庫圓門開到幾成）、`door(id, open)`、`plan(app)`、`h()`、`breach(how)`、`hstep(dt)`、`card(i)`、`gate(i)`、`daily()`、`leave()`、`alarm()`、`gs()`、`takedown(i)`、`end(ok)`、`doors()`）。
- 驗收：`node tools/check-gta-v7.mjs`（直接呼叫規則函式，只推進很少幀；軟體繪圖下加 `NC_QUERY='?gpu=soft'`）。

### GTA 式擴充（第八部曲：城市勤務）

`69-v8-civic.js`（排在 69-v7 之後、70 之前），每幀入口 `v8Update`（99-main 在 `v5Update` 之後呼叫）。

- **消防派遣**：玩家 `FIRE_R`（220 m）內有車或油燒了 `FIRE_WAIT`（5 秒），消防水箱車（`firetruck`）與指揮車（`fire_chief`）從 200–420 m 外照 `routeTo` 的路網開過去，停在離火最近的路上（`FIRE_STOP`），用水砲滅 `FIRE_STOP + 12` m 內的火（`douse`：油火、燒著的車、殘骸；水柱推倒路人、電倒警察），閒 3 秒就找 140 m 內下一處或開走。等消防車的時候殘骸的火不熄（`FIRE_HOLD`）。
- **救護派遣**：路人倒地 `AMB_WAIT`（6 秒）後救護車開到傷者旁（`AMB_R` 150 m 內），停 `AMB_TREAT`（5 秒）扶起傷者與 `AMB_REACH` 內倒地的路人。
- 派遣車開警示燈與警笛（`civSirenD` 接進 69-police 的 `sirenNear`，車流照樣讓路）；被玩家搶走就變成一般的車（`civRelease`），離玩家 `CIV_DROP`（260 m）就收掉。卡住而且不在畫面裡時往前挪。
- **水砲**：開消防水箱車時開火鍵往準星指的地面打拋物線水柱（`SPRAY_MAX` 28 m，`sprayFx` 的 `spray` 粒子），不能車窗射擊（69-combat 的 `canDriveBy`）。醫院門口停著一台（30-vehicles 的 `HOSP.cars`），開走也有水砲（`fireKit`）。
- **拖吊車**（`tow`）：倒車到別台車的車頭或車尾 `TOW_REACH`（3.4 m）內按 E 掛上（路邊停的車先 `detachCar`），再按 E 放下；拖進分局拖吊場放下拿 `TOW_PAY`（$350，自己的座駕與沒搶來的車不給錢，車收走）。被拖的車不和拖吊車碰撞（69-kinema 的 `kinPairOk`）。拖吊場與 CHROME WORKS 門口各停一台。
- `?civ=0` 關掉派遣（`tools/lib.mjs` 的 `open()` 預設帶上，只有 `check-gta-v8.mjs` 打開）。
- 測試 API：`__nc.gta.v8`：`CIV`（`fire`、`amb`、`tow`、`on`、`done`）、`fireSpots(x, z, r)`、`douse(x, z, r, k, mine)`、`towTarget(T)`、`hook()`、`drop()`、`ped(k)`、`nearPed(x, z)`、`fire(x, z)`（點一灘油火）、`wreck(x, z, yaw)`（炸一台車）、`knock(k)`、`spawn(type, x, z, yaw)`、`enter(v)`、`rush()`（跳過等待）。
- 驗收：`node tools/check-gta-v8.mjs`。

### GTA 式擴充（第九部曲：AI 與切換角色小劇場）

`69-v9-ai.js` 與 `69-v9-switch.js`（排在 69-v8 之後、70 之前），每幀入口 `aiUpdate`、`vigUpdate`（99-main 在 `v8Update` 之後呼叫）。計時用自己累加的 `ai.clk`（快轉的驗收不推進 `uTimeNow()`）；報案的 3 秒與槍聲 `W.bangT` 仍是真實時間。

- **警察徵用民車**：玩家開車逃、警員下了車而附近沒有自己的警車可開（被搶、打爛或開走了），玩家又在 `JACK_MIN`（18 m）外時，跑到 `JACK_R`（35 m）內最近的一台民車（`NOJACK` 不搶警車與勤務車）；車子被攔停（`c.hit`），走到 `JACK_REACH`（1.4 m）內把駕駛拖下來（`detachCar`，駕駛跑掉；90 m 內會跳提示），換成一台 `quiet: 1, jack: 1` 的出勤：開著追、沒有警笛與警示燈，小地圖上是暗紅色。同時最多 `JACK_MAX`（2）台；跑 `JACK_GIVEUP`（12 秒）攔不到就放棄。
- **車門掩護**：2 星以上、玩家在走路、警車停著而且警員離玩家 `COVER_MIN`–`COVER_MAX`（7–45 m）時躲到自己警車離玩家較遠的那一側（車身側面對著玩家時躲在車門旁，車頭或車尾對著玩家時躲在另一端；`coverSpot`，走過去會繞過車身），蹲下 `COVER_DOWN`（2.2 秒）、探身開槍 `COVER_UP`（1.4 秒）輪流；蹲下時子彈的判定頂端從 1.95 m 降到 1.15 m。玩家衝到 `COVER_LEAVE`（6 m）內或走遠 `COVER_FAR`（50 m）就離開掩護，`COVER_COOL`（8 秒）內不再躲。掩護期間警車 `hold`（停著不開走）。
- **E 打招呼與挑釁**：走到路人 `TALK_R`（2.5 m）內出現「E 打招呼」：路人停下來面向玩家，主角說一句、路人回一句（依天氣、晚上與路人脾氣挑台詞），`TALK_T`（6 秒）內提示換成「E 挑釁」。挑釁時脾氣差的直接動手（`fight`）；其他的一半跑開、一半跟上來嗆（離玩家 `HECKLE_D` 2.2 m，`HECKLE_T` 8 秒後回去走路）。對話中聽到槍聲或被撞就照原本的恐慌跑開。
- **目擊路人拍照**：犯罪被路人看到時，`SNAP_R`（25 m）內最多 `SNAP_N`（2）位路人舉起手機（`phone.glb`）對著玩家拍 `SNAP_T`（2.4 秒，最後閃一下閃光），報案要等拍完才成立；拍的人全部在拍完前被撞倒、嚇跑（`SNAP_SCARE`），報案就取消。原地燒胎、飛車與燒胎甩尾時 `SNAP_FUN_R`（30 m）內的路人也會掏手機拍（不報案，同時最多 `SNAP_MAX` 4 人）。
- **便衣尾隨**：甩掉 `TAIL_STAR`（2）星以上的通緝時有 `TAIL_P`（40%）的機會，一台便衣車（一般房車）從 70–130 m 外出現，照路網跟在 `TAIL_NEAR`–`TAIL_FAR`（25–45 m）之間、沒有警笛，跟了 6 秒以上而且在 70 m 內時跳提示「後面那台房車跟了好幾個路口了…」。在它 `TAIL_SEE`（70 m）內犯罪直接 2 星、便衣車變成出勤（2 名警員）；撞它也一樣。拉開到 `TAIL_LOSE`（160 m）以上 `TAIL_LOSE_T`（8 秒）就放棄，最多跟 `TAIL_T`（90 秒）。
- **頭上台詞**：主角與路人說話時頭上出現一行字（`#says`，`SAY_T` 3.2 秒，`SAY_R` 32 m 外不顯示），進室內對話畫面時藏起來。台詞全部原創。
- **切換角色小劇場**：Q 轉盤換人時，鏡頭降下來會看到那位主角正在做自己的事：Vance 抽菸、講電話、蹲著看鞋，Kael 跟技師吵離合器（技師回話）、戴耳機跳舞、蹲著看輪胎，Jax 對空氣出拳、跟買家談價錢（買家回話）、雙手抱胸數錢。降落中段（`VIG_SAY` 1.15 秒）頭上出現台詞，有配角的再 `VIG_REPLY`（1.4 秒）回一句；同一位主角不連續兩次同一齣。一動（移動、瞄準、上車、進室內）或 `VIG_T`（6 秒）後就結束，配角轉身走開。
- 驗收：`node tools/check-ai.mjs`（每一項都直接擺場景），`NC_QUERY='?zrot=25'` 也要過。

### 主線《一手爛牌》（`69-w0-story.js`、`69-w1-ch2.js`、`69-w2-ch3.js`、`69-w3-ch4.js`、`69-w4-ch5.js`、`69-w5-fin.js`）

劇本與全部 38 個任務的規劃在 [`plans/260-story.md`](../../plans/260-story.md)：從 GTA VI 的預告與官方簡介取用情節元素，人物、地名與台詞全部原創。主角是剛假釋出獄的羅莎·伊巴拉與退伍兵戴恩·默瑟（Q 轉盤的第 4、5 格），既有的范斯、凱爾、賈克斯變成配角，照劇情登場後才能切換。序章到終章全部做完（第 A～E 階段，P-1～F-4B），終章有兩種結局。

- **解鎖與自由度**：地圖上只出現下一個沒完成的任務起點（黃色的圈，大地圖是「主線」類、角色字首 R／D），走進去按 E 看任務卡（難度、報酬、附加目標、最好成績）再決定開不開始；起點一直留著，不倒數、不催。新任務解鎖時委託人傳一則簡訊。
- **任務中**：轉盤只剩這一關能操作的人（雙主角都在的關卡，通緝中也能互換；另一位跟在身邊當隊友，開車時收起來，下車再出現）。陣亡、被捕都算失敗，不扣錢，復活後問要不要馬上重試。
- **報酬**：★1–★5 是 $20,000／$50,000／$100,000／$200,000／$400,000，劇情任務不給錢；附加目標完成一半以上是銀牌（×1.25），全部是金牌（×1.5）。重玩只補新舊獎牌之間的差額。結算畫面列出每個附加目標。4-5 搶銀行的錢是搶案自己的分贓（兩位主角各得一份），主線只另發獎牌加成（銀牌 $100,000、金牌 $200,000）。
- **檢查點**：步驟標了檢查點的任務（4-4 搶裝甲車、4-5 搶銀行、5-3 追貨機、5-4 吊貨櫃）失敗後，重試對話多一個「從檢查點重來」，跳過前面的對話直接從那一步開始。
- **電子腳鐐**：P-2 之後，自由活動時操作羅莎、離灰石國宅超過 380 m，右上角的小條倒數 30 秒後通報（通緝 1 星）；小地圖畫出範圍。戴恩不受限制。
- **警用掃描器**（1-3 之後）：同一條小條顯示有人報警的倒數、追捕中的警車數與搜索剩下的秒數，小地圖畫出警方的搜索圈。
- **首次完成的獎勵**：P-2 戴恩的 E34 收進車庫；1-1 可以切換成戴恩；1-2 暗網軍火打 9 折（賈克斯的貨）；1-3 警用掃描器；1-4 面罩與名氣（之後的街拍 App 用）；2-4 可以切換成凱爾；3-5 街頭賽的獎金 ×1.2；3-6 LAZARUS 人氣 +20；4-1 聯絡人塞拉斯；4-2 娜迪亞入隊；4-3 腳鐐解除（之後羅莎不受範圍限制）；4-4 改裝裝甲車停在銀行附近的逃亡點；5-2 可以切換成范斯；5-5 琥珀工業區收進自己的地盤；5-6 可以切換成賈克斯，地堡送一把突擊步槍 Mk II。

| # | 任務 | 操作 | 難度 | 內容 |
| :-- | :-- | :-- | :-- | :-- |
| P-1 | 第 1094 天 | 羅莎 | 劇情 | 新存檔一進場就開始：假釋審查的字卡，回憶放風場的徒手打架（近戰教學） |
| P-2 | 出閘 | 羅莎 | ★1 | 戴恩在監獄門口等，走到鷺岸渡口、渡輪過河，開他的 E34 回灰石國宅 |
| P-3 | 母親的信 | 羅莎 | 劇情 | 母親拿出天際置業的法拍通知（$480,000） |
| 1-1 | 修漏水 | 戴恩 | ★1 | 錨灣港船廠，替霍利斯挨家收五張支票 |
| 1-2 | 兩捆 | 戴恩 | ★2 | 舊碼頭倉庫打倒賈克斯的人，和賈克斯不打不相識 |
| 1-3 | 蘭姆潘趣 | 戴恩 | 劇情 | 朵蒂的蘭姆潘趣，隔壁的奧帝斯送警用掃描器 |
| 1-4 | 夜貓 | 戴恩＋羅莎 | ★2 | 一起搶 BODEGA 夜貓便利店，甩掉警察 |
| 1-5 | 假釋官 | 羅莎 | ★2 | 假釋官突擊家訪，90 秒內從城區另一頭趕回家 |
| 2-1 | 內線 | 戴恩 | 劇情 | 霍利斯說鐵庫保全有一台「只載收據」的運鈔車 |
| 2-2 | 盯車 | 戴恩＋羅莎 | ★2 | 從冠石金融區跟著運鈔車開到金庫，太近會讓司機起疑（可疑值），離太遠會跟丟 |
| 2-3 | 收據 | 羅莎＋戴恩 | ★3 | 黏性炸彈炸開運鈔車後門，押車的是第九分局的便衣；拿走硬碟、甩掉三星 |
| 2-4 | 全城通緝 | 羅莎＋戴恩 | ★4 | 腳鐐訊號被追蹤，五星不會自己消退；掀開人孔蓋躲進排水道，凱爾在出口接應 |
| 2-5 | 二樓 | 戴恩＋羅莎 | ★3 | 楓林里汽車旅館被赤蠍幫和霍爾的人包圍，從二樓窗戶跳下逃走 |
| 2-6 | 船長 | 戴恩＋羅莎 | ★4 | 船廠碼頭打倒霍利斯的人，開灣仔快艇在海上追他；霍利斯被遠處的狙擊滅口 |
| 3-1 | 門禁 · 今夜 | 羅莎＋戴恩 | ★1 | 原本開場的「門禁」：Marlo、AFTERGLOW 的 Juno、火柴盒、在 LAZARUS 跳舞 |
| 3-2 | 大橡 | 羅莎 | 劇情 | VIP 包廂裡的蒙洛·奧克斯收留兩人 |
| 3-3 | 籠中 | 羅莎 | ★3 | 琥珀工業區的八角籠，空手連打三場 |
| 3-4 | 母帶 | 羅莎＋戴恩 | ★2 | 從赤蠍幫手上搶回 STEREO 的母帶 |
| 3-5 | MV | 羅莎 | ★3 | 從霓虹區照檢查點飆到北嶺公園拍 MV（限時照路線長度算） |
| 3-6 | 擴音 | 羅莎＋戴恩 | ★3 | 首播派對，守住 LAZARUS 門口兩波鐵鏽騎士 |
| 3-7 | 新家 | 羅莎 | 劇情 | 買下一間安全屋，奧帝斯把掃描器搬過來 |
| 4-1 | 老派 | 羅莎 | 劇情 | 鏽錨酒館，老銀行搶匪塞拉斯看過 BODEGA 的影片，提起中央霓虹銀行 |
| 4-2 | 獄友 | 羅莎＋戴恩 | ★2 | 到灰鷗島接剛出獄的娜迪亞，甩掉兩台跟監的車，送到安全屋 |
| 4-3 | 卸腳鐐 | 羅莎 | ★2 | 奧帝斯與 Zero 造假訊號：對上三組波形（借 69-heist2 的 `HACK` 小遊戲） |
| 4-4 | 前置：裝甲車 | 戴恩 | ★4 | 搶第九分局的鎮暴裝甲車並開去改裝（69-heist2 的前置 B），有檢查點 |
| 4-5 | 中央霓虹銀行 | 羅莎＋戴恩＋凱爾 | ★5 | 照 69-heist 的潛行搶案：羅莎壓大廳、戴恩守外面、凱爾開車，娜迪亞與塞拉斯在大廳；塞拉斯在金庫起貪心、觸發警報 |
| 4-6 | 分贓 | 戴恩＋羅莎 | ★4 | 鐵灣貨場分贓時被赤蠍幫包圍，守住兩波 |
| 5-1 | 解密 | 羅莎＋戴恩 | 劇情 | 奧帝斯解開帳本：天際置業、鐵庫保全、霓鑽賭場、第九分局，母親的法拍案也在裡面 |
| 5-2 | 舊上司 | 戴恩 | 劇情 | 范斯現身：聯邦想要這本帳，願意給兩人豁免 |
| 5-3 | 貨機 | 羅莎 | ★5 | 灰鷺角機場：開超跑追上沿跑道滑跑的貨機，貼著後貨艙門跳上去；從貨艙跳傘下來，撿回三箱現金、甩掉機場警察 |
| 5-4 | 塔吊 | 戴恩 | ★5 | 河濱停機坪的武裝直升機吊起貨櫃（纜繩單擺），甩進霓峰塔 49 m 的工地辦公室，降落撿回證物箱 |
| 5-5 | 鐵鏽 | 羅莎＋戴恩 | ★4 | 琥珀工業區：打倒鐵鏽騎士、炸掉三台運貨的貨車、擋住第二波 |
| 5-6 | 北嶺 | 戴恩 | ★4 | 北嶺地堡：賈克斯給 RPG，打退埋伏的霍爾手下 |
| F-1 | 牌桌 | 羅莎＋戴恩 | ★5 | 奧帝斯出準備費，在計畫板上挑一條路線搶霓鑽賭場的金庫（就是 69-v7-casino 的搶案），帳本正本在裡面；錢照搶案分 |
| F-2 | 天台 | 羅莎＋戴恩 | ★5 | 冠石頂層公寓被霍爾的人包圍：打退樓下六個人，牽著戴恩從樓頂跳進隔壁矮樓屋頂的泳池（慢動作、沒扣血），再甩掉 4 星 |
| F-3 | 抉擇 | 羅莎＋戴恩 | 劇情 | 天亮的珊瑚灘：泰倫斯要直播、范斯要交帳，對話框選 A 或 B；決定下一關是 F-4A 還是 F-4B |
| F-4A | 交帳 | 羅莎＋戴恩 | ★5 | 結局 A：開范斯安排的車，頂著 3 星與赤蠍幫的追車把帳本送到灰鷺角機場的聯邦專機；回到國宅和母親吃星期天的晚餐 |
| F-4B | 直播 | 羅莎＋戴恩 | ★5 | 結局 B：打下霓峰塔工地，上到 202 m 的塔頂開直播，六星、直升機輪番來，守住三分鐘的上傳；從塔頂跳傘下去、甩掉六星，最後在錨灣港開快艇出海 |

- **結局之後**：兩種結局都會把五位主角全部解鎖、主線地圖點收起來；手機首頁多一列「主線任務」，列出下一關與每一關做過的任務，可以重玩（重玩 F-3 選另一條路，下一關就換成另一個結局）。結局 A：通緝清掉、新聞報霍爾被捕；結局 B：名氣 100、新聞是直播，街角貼著兩人的通緝海報（7 塊），報警只要 1.5 秒（平常 3～4 秒）。
- **六星**：F-4B 直播時通緝升到第 6 顆星（HUD 多一顆有色的星）：12 台警力、3 秒一波、每 1.8 秒一次狙擊、特警機率 0.6、坦克 20 秒一台，直升機飛在塔頂以上；任務結束或通緝清掉就回到最多 5 星。
- **片尾**：結局的最後一步是片尾字幕（8 列，每列 3.6 秒，字後面有一層往外淡掉的暗底），可以跳過。
- 配角（母親盧佩、霍利斯、朵蒂、奧帝斯、假釋官）是自己的一組 crowd，站在任務起點或劇情位置；雙主角的身體是 renderpeople 的掃描（CC BY 4.0，`blender/scan_people.py` 綁到 UBC 骨架，`assets/260/people/rosa.glb`、`dane.glb`；以檔案開啟時照舊是程式換色的身體）。
- 新存檔不再以「門禁」開場：門禁要等到第三章的 3-1 才能玩（絨布繩拉著、Marlo 不放行），主線開著時跳完舞照主線的報酬表發錢，不再給 $250,000；舊存檔照舊能進夜店，三位既有主角照舊能切換，地圖上一樣出現序章的起點，但不強迫進序章。
- `?story=0`：整套主線關掉（舊的門禁開場、五人都能切換）。`tools/lib.mjs` 開頁時預設帶著，其他驗收照舊；`node tools/check-story.mjs` 帶 `story=1`，從新存檔逐關跳完整條已做的主線（`FROM=2-1` 從某一關開始），檢查報酬、獎牌、首次獎勵、轉盤鎖定、重玩差額與腳鐐；另外實際跑一段 AI（運鈔車照路線開、跳窗落地、快艇逃跑）、真的走一次門禁對話、籠子把人推回去、MV 的檢查點、4-5 的搶案從銀行門口開始且失敗後角色表還原、5-3 的貨機會滑跑且貼著艙門就跳上去、自由落體、5-4 按 F 登機後掛上貨櫃且飛走時貨櫃跟著，終章的雙人跳（41 m 跳進隔壁樓頂的泳池、沒扣血、再帶到樓下）、F-4B 站在 202 m 塔頂六星與直升機高度、重玩 F-3 改選 B、手機的主線列表與結局 B 的海報，兩種尺寸都跑（`SHOT=目錄` 另存截圖）。
- 測試 API `window.__nc.story`：`go(id)`（前面的關卡算完成、直接開始這一關）、`state()`、`skip()`（直接完成目前這一步）、`avail(i)`、`mon()`（腳鐐）、`M`（任務表）；終章的 `fin`：`start(id)`（不管順序直接開始，重玩用）、`leapPlan()`（雙人跳的起跳點與泳池）、`towerRoof()`、`ending('A'|'B')`、`repT()`、`cred()`、`posters()`、`phone()`、`heliY()`、`hgt(x, z)`（屋頂與地面高度）。

### 地鐵（三站、40 秒一班）

`69-v9-metro.js`（排在 69-v9-ai 之後），每幀入口 `mtUpdate`（99-main 在 `vigUpdate` 之後呼叫），只在玩家在月台（`player.where === 'metro'`）時推進列車。站名、路線與廣告全部虛構。

- **入口**：三條斜穿大道（`DIAG`）各有一站，擺在大道旁的廣場上（`plazaD` 離路中心 12.5 m 以上、`free` 找空位、離中段的格子近的優先），站名取那一片的區域名：楓林里站、琥珀工業區站、錨灣港站（重名時加大道名）。欄杆與兩支球燈是 johhny_3D 的 Subway Entrance V2（`metro_gate.glb`，站牌重畫成「METRO · 霓虹城地鐵」與 N 線圓標），以檔案開啟或下載失敗用程式建模的欄杆。站在開口前 `MT_GATE_R`（2.6 m）內按 E 進站；大地圖有綠色「M」圖示。
- **月台**：Xlay3D 的 Subway Station & R46 Subway（`metro.glb` 的 `mt_station`：磁磚牆、綠色鋼柱、拱頂、長椅與垃圾桶），三站共用同一個場館，北牆五塊與出口走廊一塊站牌是畫布畫的（綠色 N 圓標、中文站名、英文區名 · 大道名）。出口在月台東端的樓梯走廊，走進去按 E 出站，回到那一站的入口。
- **列車**：兩節 R46 車廂（`mt_car`，車門左右扇 `mt_doorL`／`mt_doorR` 分開，開門時各滑 `MT_DOOR_SLIDE` 0.72 m），1 號軌的週期是進站 `MT_IN`（9 秒，從東邊減速進來，70 m 時鳴笛）→ 停站開門 `MT_DWELL`（14 秒，開門有提示音）→ 出站 `MT_OUT`（8 秒）→ 空檔 `MT_GAP`（9 秒），合計 40 秒一班；每三班一班，2 號軌在空檔時以 `MT_EXP_V`（22 m/s）開過一列不停站的快車。車廂裡有跟著車走的燈，車輪聲照距離與車速。
- **搭車**：車門開著、離關門還有 2.4 秒以上時，站在門邊 `MT_BOARD_R`（1.7 m）內按 E 選目的地（選的時候時鐘停在關門前 2.2 秒，車門不會關）；選好就上車、關門開車，主角站在車門旁扶著，鏡頭在車廂裡。開出 `MT_RIDE_FADE`（60 m）後淡出，換到目的站、列車從東邊進站，停好開門就自動下車。免費，不算犯罪。
- **商標**：原檔車廂裡的真實廣告圖集（`material`）換成原創海報（`tools/props.mjs` 的 `texEdit` `rects`，版面相連所以給矩形；兩面牆共用、一面轉了 180° 的那一格畫成點對稱的圖形海報），貼花圖集（`JoinedDecals`）的真實站名、路線圓標與報紙擦成透明；入口欄杆的站名牌與交通局標誌用 `paint` 整塊重畫。
- 測試 API：`__nc.gta.metro`：`MT`（`t`、`n`、`st`、`ride`、`hold`、`trains`、`stats.rides`）、`stations`、`scene`、`state()`、`enter(i)`、`boardAt()`、`go(i)`（站在門邊時直接上車往第 i 站）、`phase(ph)`（`in`／`stop`／`out`／`gone`）、`atDoor(c, k)`（站到第 c 節第 k 扇門前）、`PLAT`、`EXIT`、`T`。
- 驗收：`node tools/check-metro.mjs [--http]`（`--http` 另外檢查模型換掉替身、廣告與貼花圖集是換過的版本），`NC_QUERY='?zrot=25'` 也要過。

### 排水道（河濱排水口與兩個人孔）

`69-v9-drain.js`（排在 69-v9-ai 與 69-v9-metro 之間），沒有每幀入口：提示掛在 `ctxHooks`，走私包在提示裡順便更新顯示。數值都是自己挑的具名常數。

- **排水口**：擋牆上挑一段（擋牆梯子旁 8 m、前後都是水、背後是陸地、14 m 內沒有別的梯子，同條件下 260 m 內人行道空位最多的），箱涵一半凸出擋牆外，口上有黃黑警示條與一盞燈，三個碰撞圓擋住游泳的人穿過去。只能從水裡進：游到口前 `DR_IN_R`（5 m）內按 E。
- **人孔**：人行道上兩個鑄鐵人孔蓋（`sideSpots` 往街區裡 1.5 m、`free(1.1)` 的空位，離排水口 70–300 m、彼此 150 m 以上），名稱取那一片的區域名（同一區加一號、二號）。站上去 `DR_HOLE_R`（1.5 m）內按 E 爬下去；近的通到中間的檢查井、遠的通到東端。從人孔爬出來站在人孔的馬路那一側、面向馬路。
- **場館**：沿 +x 一列：排水口段 → 4 節箱涵 → 中間檢查井 → 4 節箱涵 → 東端檢查井，全長約 109 m。箱涵是 SPLEEN VISION 的 dirty tunnel（CC BY 4.0，原檔是 Specular-Glossiness 材質，先用 gltf-transform 的 `metalRough()` 換掉；縮放 1.6 倍，內寬約 4 m、內高 2.5 m）；檢查井（7 × 6.6 m、高 4.4 m，豎井到 7.2 m）的牆面與地面是從同一個箱涵切出來的牆面（`dr_wall`／`dr_wall2` 左右兩面輪流、開口上方 `dr_lintel`、開口兩側 `dr_pier`）與地面（`dr_floor`），一層層疊上去（切片用 `tools/props.mjs` 的 `clipFirst` 先切再減面，切邊才不會是鋸齒；整個場館約 66 萬面）；以檔案開啟或下載失敗用程式建模。爬梯貼在豎井北壁，梯子旁按 E 爬上那個人孔；排水口段按 E 游出去回到河裡。燈是箱涵頂上隔兩節一盞的籠罩燈、檢查井一盞、豎井頂透下來的冷光與口外的月光；口外看出去是畫布畫的夜裡河景。
- **走私包**：東端檢查井的角落，按 E 撿起入帳 `DR_STASH`（$1,800），包不見，`DR_STASH_T`（真實時間 20 分鐘）後再出現（不存檔，重新整理就重來）。
- **通緝**：和其他室內場館一樣，不在戶外就不生成警察、警察也看不到人（69-police 的 `sees()`），星級照甩開視線的規則下降；從另一個人孔或排水口出去就換了地方。
- 測試 API：`__nc.gta.drain`：`DR`（`ents`、`stash`、`stats`、`bag`）、`X`（各段的 x 範圍）、`scene`、`ents`、`enter(i)`、`exit(i)`、`take()`、`at(i)`（入口的世界座標；排水口給游泳靠近的那一點）、`resetStash()`。
- 驗收：`node tools/check-drain.mjs [--http]`（`--http` 另外檢查箱涵與檢查井換成模型），`NC_QUERY='?zrot=25'` 也要過。

### 灰鷺角國際機場（城西外海的填海機場）

`21-air.js`（排在 20-walk 之後、21-coast 之前），每幀入口 `airUpdate`（99-main 在 `tronUpdate` 之後呼叫）。島與堤道的陸地判斷在 `10-city.js`：`AIR`（島 `isl`、堤道 `road`、半寬 `hw`）、`airLandL`／`airLandW`，`landW`、`seaFloor`、`groundH`、`districtW` 都先問它（`SEA_FR` 搬到 `landW` 前面宣告）。數值都是自己挑的具名常數，名稱是原創的。

- **位置**：島在 `SEA_FR` 座標 x −3300…−1000、z 20…600（城西外海，離岸約一公里）。堤道從楓林西第 9 條街西端出海，三次貝茲曲線取樣成每 8 m 一段，雙向四線、兩側紐澤西護欄與消波石，岸邊的擋牆在接口自動斷開（`SHORE` 依 `landW` 判斷）。開車沿堤道就能上島。
- **版面**（由北到南）：航廈前路與停車場 → 航廈（`term`，玻璃拱門朝東）與塔台 → 機坪（三座空橋登機門、兩個遠端機位、機庫門前）→ 平行滑行道與七條連絡道 → 東西向跑道（2050 m，西端外海上有進場燈與 PAPI）。島邊一圈 0.9 m 矮牆擋住走路的人與車；東緣南段有梯子，`31-boats.js` 在旁邊停一艘船。
- **客機**：一次一架照固定流程跑：遠端機位停 30 秒 → 沿路線滑行到跑道東端 → 往西起飛（70 m/s 拉起、爬升）→ 飛出外海消失 15 秒、換機型 → 從西邊 4.2 km 外以 3° 下滑道進場 → 落地減速 → 滑回遠端機位。四個動態碰撞圓（`dynMore`）跟著機身，擋得住人和車。
- **模型**：`tools/props.mjs` 的 `air` 組（全部 CC BY 4.0，來源見 `assets/260/CREDITS.md`）：fDlruosne 的 A320 與 737 MAX 8、soysascha 的鯨魚造型航廈、lucassobral3d 的舊金山塔台、casadofer 的萊昂機庫、CyzaStore 的空橋、rwy00 的餐車。遠景組（`far`）從城西岸隔著海也看得到。玩家離島中心 `AIR_NEAR`（3.6 km）內、以 http(s) 開啟時才下載，擺好後拿掉程式建模的替身；以檔案開啟用替身。航廈的玻璃帷幕夜裡亮燈（`winRects`：量模型屋簷以下、接近垂直的三角形落在圖集哪些格子）；機庫原檔的線框色換成灰藍玻璃與鋼構色（`recolor`）。
- **夜裡**：機坪南緣每 100 m 一支 28 m 高桿燈（燈在高處，強度要比路燈大幾十倍）、航廈南面屋簷下的泛光燈、航廈前路與停車場的路燈、堤道路燈；跑道白色邊燈、跑道頭綠紅燈、滑行道藍燈都是自發光，從城裡看是一串燈點。
- **地圖**：HUD 小地圖與大地圖的底圖是預先畫好的城市範圍，機場不在裡面，`90-hud.js` 的 `airMapDraw` 每次畫的時候用 `MAP_AIR`（世界座標的島、堤道、跑道、滑行道、機坪、建物）疊上去；大地圖的範圍 `MAP_BOUNDS` 包進機場島，有地名標籤。
- 測試 API：`__nc.props.air`：`L`（版面）、`P`（客機狀態 `st`、`x`、`y`、`z`、`planes`）、`M`（`items`、`proxies`）、`AIR`、`land(x, z)`／`landW(X, Z)`、`W(x, z)`（`SEA_FR` → 世界）、`L2(X, Z)`、`district(X, Z)`、`tp(x, z, yaw)`、`set(st, t)`（`park`／`out`／`line`／`roll`／`gone`／`final`／`rollout`／`in`）。
- 驗收：`node tools/check-air.mjs [--http]`（地理、開車沿堤道上島、矮牆、梯子、起降循環；`--http` 另外檢查模型換掉替身；`SHOT_DIR` 存截圖），`NC_QUERY='?zrot=25'` 也要過。

### 港灣高架線（跨城的鐵路）

`21-xrail.js`（排在 21-rail、21-tron 之後，頂層用得到 `RAIL.EXT`、`railProxyCar`、`railGlbCar`、`FWY_PIERS`），每幀入口 `xrUpdate`（99-main 在 `airUpdate` 之後呼叫），頭燈 `xrLights` 推進 `dynLights`。座標全部是世界座標（快速道路的中心線本來就是），網格 `cityAdd(…, null)`。

- **路線**：港灣快速道路的中心線，`XR.at(a, lat)` 是弧長 a、往 (−hz, hx) 那一側橫移 lat 的位置。軌面 `XR_Y`（18.5 m），箱梁下緣 16.2 m，高過快速道路的門架；西端從快速道路起點的平面路口後 `HR + 8` 開始，東端快速道路在平面路口就結束了，線沿縫一路架到離城的外緣 40 m 內為止。
- **柱子**（`XR.cols` 是弧長）：快速道路橋墩（中央護欄那一條）上的直接往上接；分合流點前後 `JN`（24 m）不立（車要換線）。沒有橋墩的地方每 26 m 試一支：坡道上立在中央護欄上；分合流段（快速道路被匯入的橋面疊住、不立橋墩）從地面立整支穿過橋面，條件是中心線離開別條快速道路的橋面、底下不是連接道路；縫裡立在地上（離片的路、連接道路與步道建物夠遠），腳下是縫的步道就改成跨過步道的門形架。最後把超過 52 m 的跨距從中間往外每 2 m 找位置補柱（剩下最長約 72 m，都是跨過連接道路）。每支柱子都有碰撞圓（橋面上的也擋車）。
- **站**：兩端終點站與中間一站（中間一站避開快速道路東端的平面路口），月台寬 `XR_PW`、長 `XR_PLAT`，雨棚、月台燈（`signLights`）與畫布站名牌（站名取 `districtW` 的區名加「站」，下面一行「港灣高架線 · Harbor Skyline」）。站沒有樓梯，上不去。
- **列車**：編成同北嶺鐵道（車頭、中間、tail、中間、反向車頭），終點站停 40 秒、中間站 22 秒，最高 22 m/s；往 +a 開走 +`XR_TRK` 那一線、往 −a 走另一線，從終點站出發時出站 80 m 的渡線換線（`xrLat`）。玩家在任一站或列車 `XR_NEAR`（1.5 km）內才下載 `w1_train`；行駛聲只在北嶺鐵道的列車沒在出聲時由這裡出（同一個聲音節點），出站鳴笛。
- **地圖**：90-hud 的 `MAP_XR`，大小地圖都疊在快速道路上面（畫法同鐵道），三站是淺色方塊。
- 測試 API：`__nc.props.xrail`：`R`（`XR`）、`Y`、`at(a, lat)`、`go(i, dir)`（列車馬上從第 i 站往 dir 出發）、`tp(i, lat)`（傳到第 i 站旁）。
- 驗收：`node tools/check-xrail.mjs [--http]`（全長、站名、柱子數與最長一跨、線頭懸臂、箱梁淨高、站序與速度、車廂高度；`--http` 檢查列車換成模型；`SHOT_DIR` 存白天與夜間截圖），`NC_QUERY='?zrot=25'` 也要過。

### 車輛細節（短按／長按 F、燒胎、卡軸、泡水）

`68-vdetail.js`（排在 68-roll 之後、68-wreck 之前），每幀入口 `vdUpdate`（99-main 在 `v6Update` 之前呼叫），物理改寫在 30-vehicles 的 `driveVehicle` 裡（開頭 `vdPre`、落地高度 `vdWater`）。數值都是自己挑的具名常數。

- **F 的短按與長按**：停穩後按 F 不馬上下車，放開是短按（下車熄火、大燈熄），按住 `VD_HOLD_T`（0.45 秒）是長按：下車不熄火，大燈亮著、排氣管冒白煙，引擎聲照距離變小（`vdIdleGain`，45 m 外聽不到），回來上車直接開（不放發動聲）；走遠 `VD_IDLE_R`（60 m）、進室內、上別台車或車壞了就自己熄掉。開船、直升機、泡水的車照舊一按就下；時速 15 km/h 以上照舊是跳車。
- **原地燒胎與甜甜圈**：時速低於 `BURN_V`（3 m/s）拉手煞（Space）踩油門：車不走、後輪空轉冒煙、轉速拉高；同時打方向繞著前軸甩（`DONUT_YR` 2.3 rad/s），每轉一整圈提示「甜甜圈 ×N」；燒 `LAUNCH_T`（1 秒）以上、油門不放只放手煞是彈射起步（至少 `LAUNCH_V` 7 m/s）。座駕的燒胎煙是改裝的顏色（69-v6-customs），搶來的車是白煙。原地燒胎不算甩尾打賞（時速 25 以下不計）。
- **沙地與卡軸**：珊瑚灘從岸邊量起 0–36 m 是乾沙（動力 ×0.7、多一點阻力），36–56 m 是濕沙（水線在 48 m；動力 ×0.4、低速特別黏）。濕沙上時速低於 `SAND_KMH`（14）催油或倒車 `SAND_T`（1.4 秒）就陷住：輪子空轉、車身只隨搖車前後晃 0.25 m；`ROCK_T`（4 秒）內 W／S 換向 `ROCK_N`（3）次搖出來（往最後的方向推一下，之後 4 秒不會再陷）。帶著速度衝過去不會陷。
- **泡水**：沙灘外是 1.4 m 深的淺海，車開得下去。水裡有阻力（越深越重）、車頭推出水花，高速入水濺起水花。水深超過 `FLOOD_D`（0.45 m，機車 0.35）撐 `FLOOD_T`（2 秒），或一下子超過 0.8 m：引擎進水熄火、大燈熄，發不動也上不了油（`v.flood`，driveVehicle 換成 `FLOOD_INP`）；比地面深的地方（groundH 不知道海底）以 1.2 m/s 沉到 `seaFloor`。水深過 `SINK_D`（1 m）撐 1.5 秒逼玩家下車（水深 1.25 m 以上就浮起來游泳）。修車（`wreckFix`）或 V 叫車送一台修好的；AI 的車進水一樣熄火、滑到停。
- 測試 API：`__nc.gta.vd`：`st`（`f`、`idle`、`burnT`、`donut`）、`beach(X, Z)`（沙灘上從岸邊量起的距離，不在沙灘是 −1）、`keyF()`（在車上按下 F，放開與否看 `keys.KeyF`）、`summon()`（步行時的 V）。
- 驗收：`node tools/check-vdetail.mjs`。

### GTA 式擴充（第五部曲：城市建築設施）

依使用者的《城市建築設施藍圖與魔鬼細節》（`neon_nightcity_gta_v3.md`），`node tools/check-gta-v5.mjs [html]` 驗收。設施蓋在 `10-city.js` 的 `FAC` 街區：原本的地塊照樣生成（亂數序列不變）、當 ghost，實體建築拿掉，換成設施自己的地塊（`special: 'fac'`、自己的亂數），立面照城市 shader 畫，所以窗燈、高度圖、屋頂、防火梯都照舊；碰撞盒換成每棟樓自己的、帶屋頂高度 `hy`。

- **聖瑪格麗特醫院**（中城 (4,1)）：面向大道的急診樓以 http(s) 開啟時是 artfletch 掃描的紅磚維多利亞式舊院區正面（`props/v5hosp.glb`，背後補一個量體；雨遮伸到正門台階、紅色急診燈箱掛在雨遮前緣），以檔案開啟或下載失敗是 2 層程式立面；人行道上兩台救護車，8 層主樓用新的立面樣式 8（白色牆板）。WASTED 後在急診門口醒來，醫藥費是現金的 5%、最多 $5,000（`hospFee`），額頭與左前臂纏 5 分鐘繃帶。急診門口的醫療包 +50 生命（90 秒後補回）；坐進救護車駕駛座 +25（每台一次）。主樓北牆的員工電梯 E 直達屋頂，停機坪上是醫療直升機（警用直升機機身重新上漆，沒有火箭莢）。
- **第九分局與拖吊場**（舊碼頭 (0,4)）：北半是紅磚老分局（以 http(s) 開啟時是 katiewolfe 的空拍掃描模型 `props/v5pd.glb`，走近 520 m 才下載；以檔案開啟或下載失敗是程式立面），大門兩側是藍色球燈；南半是 4 層附樓（NCPD 燈箱），南牆有一道通到屋頂的逃生梯，屋頂停一架警用直升機（開走 2 星）；西半邊是 2.2 m 鐵絲網（刺絲）圍起來的拖吊場，北側一道滑門與守衛亭。被擊斃或被捕時開著自己的車（或車在 150 m 內）、通緝中棄車而甩掉警察時人離車 150 m 以上，車會被拖進來（`motors.v5.imp`，按 V 叫車沒用）。守衛亭 E 付 $250 開門 60 秒，或面向網子按空白鍵翻過去（1.6 秒），開車以 2.5 m/s 以上撞柵門直接撞破（沒付錢就 2 星，90 秒後修好）；車開出拖吊場就算領回。全區地圖有「P」拖吊場圖示。
- **外牆鐵梯**：底部 0.8 m 內按 E 吸附，W／S 爬（1.6 m/s）、按住 Shift 加速（3.4 m/s）、往下按 Shift 直接滑下去（8 m/s），爬到頂站上屋頂，屋頂上走到梯子口按 E 爬下去。爬梯的姿勢是待機動畫上覆寫四肢（`ANIM.climb`）。
- **屋頂**：設施樓的屋頂走得上去（`WALKS`，邊緣 0.45 m 擋住、樓梯間與空調箱也擋），站在邊上面向外面按空白鍵往外跳，變成 69-v3-crash 的自由落體（可以開傘）。相機在比樓頂高的地方不被那棟樓擋（99-main 的相機碰撞看 `hy`）。
- **BODEGA 搶劫**（`69-v5-shops.js`）：店裡多了一位站在結帳台後面的店員。拿槍指著她（7 m 內、身體對準）就開始搶：威嚇條每秒 8%（約 12.5 秒），轉開身子朝貨架開一槍之後 2 秒內 ×2.5（約 5 秒）；過半時她偷踩警鈴（1 星），搶完 $800–2,500、2 星，店休 5 分鐘。22% 的店員從櫃台下抽出霰彈槍，每 1.3 秒一發 18 點；打倒店員可以自己清空收銀機。搶過之後角落的第二台收銀機撬得開（$250–700）。冰櫃的能量飲料 $2、+15 生命。
- **提款機**：BODEGA 門口、中央霓虹銀行、醫院急診樓、第九分局四台，有時有人在提款；拿槍指著他約 1.2 秒，或手上有武器時走近按 E，他交出 $60–400 跑走（傷害罪）。
- **酒**：鏽錨酒館吧台 $8、夜店吧台 $15，每杯酒意 +0.4（最多 1.6，150 秒退 1），喝多了畫面搖晃，走路與開車的方向會飄。
- **CHROME WORKS 自動捲門**：車開到門口 6 m 內（紅外線感應），沒歇業、警察沒看到、不是太燙手的贓車或坦克才捲上去（氣壓閥一聲、1.2 秒升起、門頂黃燈旋轉），按 E 開進改裝廠（`66-chrome.js`，見「車輛規格與改裝」與「第六部曲」）。
- **楓林里商店街**（`FAC.mall`，(3,7)）：
  - 鐵砧槍械：騎樓下的櫃台，老闆賣彈藥、五級防彈背心（護甲 20–100，$250–2,500）、消音器與擴充彈匣（手槍、衝鋒槍、步槍、霰彈槍，$1,200，彈匣 ×1.5，存在 `motors.v5.ext`）；在店前拿槍指著他或開槍，他從櫃台下抽槍反擊（每 0.9 秒一發 12 點，打倒他店休 5 分鐘）。
  - 射擊場：店後面三面水泥牆圍起來，$20 玩 30 秒，9 個標靶輪流立起 2.2 秒，打中一個 1 分、射擊能力 +0.15；場內開槍不算犯罪。
  - 縫線服飾：$150 換一套衣服；通緝中、警察沒看到你時換裝，少一顆星。
  - 模型（只在 http(s)，走近 160 m 才下載 `props/v5shop.glb` 與 `arms.glb`）：服飾店是 jungle_jim 的兩間維多利亞式店面（玻璃後面是假人、ngdkh 的掛衣架與後牆層架），槍牆三排與玻璃展示櫃擺實體武器模型，射擊場是 FrodoUndead 的吊靶（人形靶紙）與五個射擊位；以檔案開啟或下載失敗時是程式建模（`MALL.fb`／`MALL.fg`）。
  - 泡泡隧道洗車：車停到入口按 E 付 $15，輸送帶以 2 m/s 把車拉過 24 m 的隧道（刷子轉、水霧），泥巴與血跡洗掉。車開久了兩側與車尾沾泥（下雨沾得快），撞到人車頭沾血；車頭有血、慢下來時附近的路人看 2.5 秒會報警（1 星）。
- **霓虹立體停車場**（`69-v5-garage.js`，公園大道 (8,8)，東邊隔著大道是燈籠公園）：整塊人行道內是五層停車場（地面層加四層樓板，層高 3.6 m，第五層是露天頂樓），程式建模（找到的停車場 GLB 都太粗糙）。北側一條螺旋坡道帶（四條坡道疊在一起，`06-roads.js` 的 `DECKS` 回傳車或人腳下那一層），上樓的路線是坡道 → 東側車道往南 → 南側車道往西 → 西側車道往北 → 下一條坡道；每層外牆是護牆加這層顏色的霓虹條（P1 青、P2 琥珀、P3 洋紅、P4 萊姆、P5 藍），中間兩排背對背的車位與南側一排停著程式建模的車，日光燈管、柱子上漆一圈這層的顏色，有頂的部分不算積水反射。地面入口在西邊大道（前面不停路邊車），中間是收費機島，兩支紅白柵欄桿時速 5 公里以上一碰就斷飛（不減速、不扣血，30 秒後人走開 40 m 換新的）。西北角的電梯 E 直達頂樓、從頂樓 E 下到地面層。頂樓：
  - 稀有超跑 McLaren P1（以檔案開啟是替身）停在西側的金色車格，車頭朝東正對跳台；開走或撞爛之後，人離開 300 m 以上半分鐘再換一台新的。
  - 「飛躍霓虹大道」特技跳台（`20-props.js` 的第 21 座跳台，`y0` 是頂樓樓板高度；69-stunt 的斜面、起飛高度與機位都加上 `y0`）：從車格直接衝 40 m，時速約 90 公里起飛、最高約 18 m，飛過大道落進燈籠公園，第一次完成約 $8,900。頂樓東側護牆在跳台處開口。
  - 東南角的降落傘包：撿起來（`V5.chute`，不存檔，60 秒後補回）之後，開車飛在半空（跳台、斷橋）時按 F 跳車變成自由落體，再按 F 或空白鍵開傘；車自己飛完落地。頂樓也算可以往下跳的屋頂（69-v5-civic 的 `roofJump`）。
- **街道的微結構**（`69-v5-street.js`，規格書第二節）：撞擊看衝量 J = 車重 × 撞上去的速度（法向，N·s；沒設 `mass` 的汽車算 1600 kg、機車 280 kg），門檻 `ST_J`：玻璃 800、圍籬 3500、候車亭與電話亭 9000。1600 kg 的轎車分別是時速 2、8、20 公里；沒過門檻照一般碰撞擋住。
  - 路邊施工區（8 處，大道停車道上圍起來的 21.6 m，挖開的路面、鋼板、土堆、發電機、工作燈）：三面是 2.4 m 一片的鐵絲網圍籬，上游擺兩座紐澤西護欄、五個交通錐與「道路施工」立牌，人行道上擺一攤熱狗攤。圍籬撞超過 3500 整排倒下（離撞點每片晚 0.07 秒、倒向車子前進的方向），倒在地上的圍籬開過去刮出火花與聲音、稍微拖慢；交通錐一碰就飛。
  - 紐澤西護欄（1200 kg）：轎車撞上照一般碰撞彈開；時速 70 以上正面撞上被斜面鏟起來翻飛（68-roll 的 `rollStart`）；車重 3000 kg 以上（運鈔車、戰車、裝甲車）推著走。
  - 熱狗攤（全城 20 攤，Sketchfab 模型拆成攤車、遮陽傘、醬料，把手下面加一支紅色液化瓦斯鋼瓶）：車撞上去遮陽傘與醬料飛走、攤車翻倒、路人逃開；時速 50 以上撞上或鋼瓶中兩槍（第一槍漏氣）：鋼瓶朝一個方向噴火 2 秒（站在火柱裡會受傷）後炸開，半徑 7 m、300 點。附近的爆炸會直接引燃，可以連鎖。
  - 公車候車亭（全城 35 座，開口朝馬路，前面前後 8 m 不停路邊車）：背牆三片玻璃打一槍碎一片，車撞（> 800）碰到的那幾片也碎；超過 9000 整座連根拔起翻滾（玻璃全碎）。電話亭（20-props 原本的 195 座）：打一槍玻璃碎出碎片（模型的玻璃沒有分開，外觀不變），車撞超過 9000 連根拔起。
  - VELOCE MOTORS 的落地窗：兩面展示窗前六片玻璃，一槍或車撞（> 800）就碎成幾十片反光的三角碎片；開車撞破算傷害罪。
  - 銀行門前的液壓防撞柱（10 St 路緣五支）：不會壞；時速 60 以上撞上車頭全毀（剩兩成耐久，68-wreck 的黑煙熄火階段），駕駛不管有沒有繫安全帶都從擋風玻璃飛出去（69-v3-crash 的 `ejectPlayer`）。裝甲車與機車不算。
  - 爆炸（`blast`）會震碎範圍裡的玻璃、掀翻候車亭與電話亭、推倒圍籬、推開護欄、炸飛交通錐，熱狗攤被引燃。
- **霓峰塔工地**（`69-v5-tower.js`，中城 (4,3)，醫院南邊兩個街區；規格書「城市建築設施藍圖」一之 3）：西半是蓋到 202 m 的框架大樓（Stas Gunko 的 Construction 照樓板高度切成底層 13 m、標準層 12 m、頂層 9 m，疊 15 層標準層、兩份背對背），屋頂是鋼板平台、欄杆、停機坪與四角的航空障礙燈，直升機可以直接降落（69-gunship 的升限從 170 m 提高到 290 m）。東邊是 Cem Alagozlu 的 Liebherr 塔吊：桅桿標準節疊 78 節（每節 2.98 m），旋轉機構在 232.8 m，吊臂走道 239 m，塔尖約 253 m；吊臂朝西伸 76 m、越過大樓與大道，平衡臂 27 m 掛配重，吊鉤小車掛著一條吊索。整塊人行道內圍 2.4 m 的施工圍籬，南面大門進去，裡面有工寮與材料棚（Şafak Binen 的 Construction Pack）。
  - 上去：桅桿東面的黃色直梯（2.4 m 以上有護籠）從地面直通吊臂，W 爬 6 m/s 約 40 秒，Shift 9 m/s，往下按 Shift 滑 14 m/s。爬到 202 m 按 E 踏上附著平台，經連接橋走到大樓屋頂；從屋頂走回平台按 E 抓住梯子繼續爬。
  - 吊臂走道 1.9 m 寬，末端有一箱重型狙擊槍（彈藥 +30，拿走 2 分鐘後補回）。站在 120 m 以上用狙擊鏡：射程 300 m → 1200 m、倍率加倍（視角 13° → 6.5°）。
  - 從吊臂側邊或屋頂邊上按空白鍵跳下去（自由落體），F 或空白鍵開傘；吊臂下方是大樓屋頂，在那裡沒開傘落下去會摔死。
  - 高處的視野：鏡頭升到 20–120 m 以上，城裡的霧改成集中在地面的指數大氣（往下看只穿過一小段濃霧），細節距離跟著放大到 1.6 倍，畫面邊緣（`uCullR`）照水平距離全進霧裡；城市外圍的山、河與海（`uCityM` 遮罩外）和遠景照舊在霧裡。
- 存檔第 9 版：多了 `v5`（`imp`：座駕在拖吊場；`ext`：擴充彈匣）。第 10 版多了 `mods`（66-chrome.js 的改裝套件，`{ 車: { 套件: 等級 } }`，`pl` 是車牌字串、`ins` 是全額保險）。第 11 版多了 `v6`（69-v6-customs.js：`sellT` 下次能賣街車的時間、`exp` 今天的出口車單、`wipe` 黑市晶片抹除儀）。第 12 版多了 `v7`（見「第七部曲」）。
- 測試 API：`__nc.gta.v5`：`V5`（`lad`、`imp`、`band`、`medkits`、`helis`）、`FAC`、`LADS`、`w(id, x, z)`（設施座標 → 世界）、`yaw(id, a)`、`lad(i, top)`、`impound(why)`、`pay()`、`gateBreak()`、`fenceNear()`、`roofJump()`、`hospFee()`、`inYard(x, z)`；商業設施的 `SHOP`（`rob`、`clerk`、`drunk`、`shutter`）、`ATM_SPOTS`、`MALL`（`owner`、`range`、`wash`、`targets`）、`robStart()`、`aimAtClerk()`、`booze(where)`、`gunShop()`、`shopArmor()`、`shopMods()`、`rangeStart()`／`rangeEnd(quit)`、`clothesShop()`、`washStart(v)`、`carGrime(v)`、`v5Blood(v)`、`mallW(x, z)`、`mallGlb()`（直接下載商店街模型）、`aimRay()`、`rayHitsCyl(R, x, z, y0, y1, r)`、`shutterAt()`、`blockInfo()`（每個街區的區名、特殊地塊、模型地塊數與興趣點，選址用）；停車場的 `gar`（`PK`：`car`、`bag`、`bars`、`elev`、`Y(k)` 每層高度；`spawn()`、`bail()`、`floorAt(x, z, y)`（設施座標）、`ramp()`（頂樓跳台）、`near(X, Z, r)`（附近的碰撞盒，除錯用））；街道微結構的 `street`（`st`：`items`、`jersey`、`cones`、`fence`、`shards`、`tumble`、`fires`、`n` 各種東西壞了幾個；`sites`、`J`、`near(kind, x, z, alive)`、`count()`、`free(x, z, r)`（連路邊車一起看有沒有空地）、`shoot(x, y, z, tx, ty, tz, dmg)`（走 castRay／hitWith 開一槍）、`ignite(o, fuse)`、`knock(o, vx, vz)`）；霓峰塔的 `crane`（`CR`：`lad` 直梯、`f` 吊臂的座標框、`caseM`／`caseAt` 狙擊槍箱、`glb`／`fb` 模型與替身；`TOP`／`JIB`／`DECK`／`PEAK` 各高度、`jib(X, Z)` 吊臂座標 → 世界（X 往吊臂是負的）、`lad(top)` 直接吸上直梯、`perchK(A)`、`scopeK()`）。

### 城區與安全屋（World 整合）

使用者提供的 `~/Downloads/World`（複製到 gitignore 的 `.cache/world/`）。第一輪只用 CC BY 4.0 的模型；第二輪城市擴到 20×15，使用者同意連 Sketchfab Standard 授權（可放進作品使用、不能單獨再散布）的三個模型一起用；第三輪把剩下的檔案全部用上，城市四周加上海岸、河、島與山，授權標示見 `assets/260/CREDITS.md` 與開始畫面 `#fanNote`。地名全部原創。

- 城市從 5×5 擴成 8×7（第一輪），再擴成 20×15 個街區（第二輪，約 1.4 × 0.9 km，面積是 8×7 的 5.4 倍）：原本的城區不動（`X0`、`Z0` 不變），新區往東、往南長，大道一路排到 Union Av、街到 21 St。街區依 0（5×5）、1（8×7）、2（新區）三個階段產生，舊地塊與立面的亂數序列不變。車流、路燈、紅綠燈、警方路網、小地圖與大地圖都照 `NX`／`NZ` 長出來。
- 第二輪的新區（`DISTRICTS`）：北半往東是光環廣場（golukumar Cyberpunk City 依原檔街廓拆成的 14 群 `bld_cyber`，放大 9 倍，加上重用的 `bld_fin` 三群）與灰石國宅（dasy444 street city buildings (8) 的照片立面板樓 `bld_grey`，放大 11 倍；最高的 `grey_18` 一個街區放一棟，雙層板樓 `grey_30` 與後面那棟大板樓 `grey_31` 各放一處）；中段是楓林里與公園大道（golukumar Neighbourhood 的整個街區 `nbh_01`，帶中庭、樹、原檔的路燈、冷氣機與路障，共六處；只拿掉路邊停的 BMW E46）、燈籠公園（3×2 個街區的草地與步道，沒有地塊；步道每 9 m 一盞紅燈籠路燈）、琥珀工業區；最南一排是珊瑚灘（dasy444 street city (7) 的七間兩層樓店面 `bld_shop`，窗框手量）與錨灣港。
- 城市變大後的效能：立面與合併網格依距離隱藏（`distCull`，420 m）；超過 160 個的 InstancedMesh 只送 380 m 內的實例（`instUpdate`）；碰撞框與圓用 24 m 格子的空間索引（`boxesNear`／`circlesNear`，增刪碰撞物要呼叫 `colDirty()`）；車流（`TRAFFIC_N`，43 台、低畫質 23）與路人（`PED_N`，48 人、低畫質 23）集中在玩家的生成圈裡（`30-vehicles.js` 的 `RING_CAR` 100–170 m、`RING_PED` 90–140 m，`ringR` 依速度把外環往外推、`ringAhead` 偏向前方）：走出外環又在鏡頭看不到的地方（`ringHidden`：背後、畫面外、霧裡或被街區擋住）就搬回外環上看不到的路段或街區，車再用點陣淡入 0.6 s（`TRAF_MAT` 的 `aIns.w`），一幀最多搬兩三個；超過 290 m（人 230 m）的不管看不看得到都搬；停車只畫 320 m 內、陰影只給 200 m 內。
- 冠石金融區（Crownstone，東側三欄）：golukumar 的「New York City」只取建築，依原檔座標的矩形拆成 12 群（`bld_fin`），`finBlocks` 把一群或兩群並排塞進一個街區（等比縮到 47×37 m 內，最多 1.08 倍，能轉 90° 放得更大就轉），整個街區不建程式立面。照片立面的暗色窗格自動做成窗戶編號貼圖（`photoWindows`；亮度分不出來的立面用手量的窗框 `winRects`），玻璃帷幕的牆面改成沿牆投影的格狀窗（`curtainUV`，每格 1.6 × 3.5 m）；同一塊窗戶照片被貼在每一層，所以亂數 `_WIN` 取每個三角形外框的最小角，每段牆各自亮燈。
- 雲杉坡（Spruce Hill，南側兩列）：住宅區，程式立面多半是 4–8 層的磚樓與石材樓，實體建築混入 abhayexe「city」的五棟公寓大樓（`bld_res`，放大 1.45 倍、大門轉成朝街）；藍灰玻璃用藍色比例找窗戶（`winBlue`）。
- 鐵灣貨場（Ironbay Yards，東南角）：工業區，DanielZhabotinsky 的工業建築組比例最高。
- 安全屋：天際置業多了六間房子，也可以走到門口按 E 看房直接買。冠石頂層公寓（$380,000，8 St）是 dasy444 的 loft17，兩層挑高、西面整片玻璃外是一圈發光的摩天樓卡片；雲杉坡崖邊別墅（$600,000，13 St）是同作者的 interior15，拿掉白天的天空半球，鏡面地板改成拋光石材。第三輪加上同作者的四間（Sketchfab Standard）：灰鷗島辦公室（$520,000，Loft 18，門朝北對著跨海橋過來的路；唯一有收入的安全屋，每遊戲小時 $900、上限 $18,000，在辦公桌收保險箱）、楓林里迷你閣樓（$160,000，interior 15 mini loft）、琥珀和室 Loft（$340,000，Loft 16）、公園大道白色大宅（$480,000，interior 14，鏡面地板與帶金屬度的牆改成霧面）。頂層公寓按 E 沿旋轉樓梯走上夾層，島上辦公室按 E 搭電梯上 L 形夾層，別墅走得進側翼、廚房，南面落地窗拉開的那段走得上露台。每間都有一個衣架，按 E 換裝（三位主角各四套，記在這台裝置上）；開自己的車停到買下的安全屋門口按 E 停進車庫並直接進門，門旁的捲門走過去按 E 能把車庫裡的車開出來（和 GARAGE 07 是同一個車庫）。買了才進得去，沙發旁按 E 睡一覺：時間推進 6 小時、補滿生命、以門口位置快速存檔（人在室內也能存）。手機裡已買的安全屋可以一鍵導航到門口。除了島上辦公室（生意，在辦公桌收），其他五間不在家時短租出去，每遊戲小時約售價的 0.16%（$260–$950，存滿 20 小時），進門時自動收下，也可以用手機收。
- 海岸（第三輪，`21-coast.js`）：城市南面是海，西半是珊瑚灘（沙灘、救生員塔、陽傘、排球網、椰子樹，190 m 的棧橋盡頭是霓虹摩天輪），東半是錨灣港（110 m 深的碼頭、岸橋、貨櫃堆、高桿燈與靠港的貨櫃船）；錨灣港碼頭往南的斜張跨海橋（灰鷗大橋）通到 360×250 m 的灰鷗島，島上西側是 dasy444 的廢墟街區（abandoned city street，放大 2.3 倍）、中間是 Loft 18 environment 的辦公園區與一圈板樓（安全屋辦公室的門就在這裡）、東端是燈塔。西面是灰鷺河（步道、欄杆、長椅與花台），對岸是 golukumar 的 London City（遠景，約 720×1270 m）；東面海灣對岸是舊港城（golukumar 的 City 放大 17 倍，後排是 street city (7) 剩下的弧形店屋與板樓 `far_s7`）；北面樓牆後是三層山脊的北嶺國家公園。水面用同一張平面倒影，波紋照 Na Pali 海岸空拍片做：九道順風的方向波（波長 60 m 起逐道 ×0.62，深水色散）加兩層雜訊，外海深藍、近岸 26 m 內轉青綠；開機時把陸地遮罩算成離岸距離場（`SHD`，1024² 的精確歐氏距離轉換，80 m 截斷），岸邊一圈蕾絲狀白沫、24 m 內一道道往岸上推的浪線、近處偶爾的白頭浪都從它算；遠景材質（`FAR`）不算積水反射，否則大片空地會映出一條條霓虹色塊。擋牆與欄杆擋住人和車，沙灘可以走到水深 0.3 m。以檔案開啟時島上與對岸是程式建模的方塊替身。
- World 的檔案全部用上了：cyberpunk（`bld_cyber`）、city_golu（`far_golu`）、abandoned（`isle_ruin`）、london_city（`far_london`）、loft18env（`isle_office`）、loft18／miniloft／loft16／interior14（四間安全屋）、street7 剩下的部分（`far_s7`）、street8 剩下的兩棟板樓（`grey_30`／`grey_31`）、Neighbourhood 先前拿掉的路燈與小零件。每個檔案拿掉了什麼見 `assets/260/CREDITS.md`；Cyberpunk City 的真實品牌廣告全部換成原創霓虹廣告、立面照片裡的真實招牌模糊掉、樓頂的服飾品牌立體字刪掉。
- World 第四輪（使用者提供的 `~/Downloads/world_1`，22 個 Sketchfab 模型（第一批用了 19 個，第二批把剩下三個也接上），複製到 gitignore 的 `.cache/world1/`；`tools/props.mjs` 的 `bld_pc5`、`bld_grc`、`bld_tram`、`bld_rural`、`bld_w1`、`bld_temple`、`w1_tower`、`w1_stairs`、`w1_fence`、`far_cement`、`apt_lr`、`apt_pub`、`apt_store`）：
  - 整街區（`wholeBlocks` 的 `PLAN`）：光環廣場北排與南排、冠石東排共 14 個街區換成 abhayexe 的 Procedural City 5（依原檔街廓切成 `pc5_01`…`pc5_15`，`pc5_10` 太寬沒用）；灰石國宅六個街區是 Tram Station 的板樓（依佔地連通塊拆開，`seg` 選項）；燈籠公園西北角是希臘神殿掃描、東北角 (10,7) 是白色塔樓，公園兩側各一棟 gameready_city 的大樓，琥珀工業區 (17,9) 是兩層商場（真實商標已模糊）。
  - 沿街地塊（`SETS`／`PROB`）：gameready_city 的 22 棟（`bld_grc`）混進紅磚、中城、冠石、光環、灰石、楓林、公園；舊辦公樓與清水模板樓（`bld_w1` 的 `h18`／`h42`）混進舊碼、光環、灰石、琥珀；鄉村木屋與小店（`bld_rural`）混進鐵灣、琥珀、珊瑚灘、錨灣。
  - 地標與遠景在 `27-world1.js`：東灣對岸三座水泥廠掃描與三棟長板樓；舊碼頭兩座木棧橋入口的鐵絲網（有碰撞）與中間沉到步道下的木樁階梯；岬角上離岸最遠、附近沒有樹的地方擺石塔，四周一圈石塊矮牆，缺口朝岬角根部。
  - 室內：第七間安全屋「珊瑚灘清水模公寓」（$220,000，19 St）；兩間不用買、走到門口就能進去的店：舊碼頭 10 St 的鏽錨酒館（英式木造酒館，吧台可以點一杯）與中城 9 St 的 BODEGA 夜貓便利店（門開在 BODEGA 招牌的店面，結帳台花 $40 補滿生命）；大地圖上分別是酒吧與「24」標記。
  - 第二批（2026-10-23，四個原檔從 Sketchfab 重新下載）：先前沒用上的三個檔與 gameready_city 拿掉的部分都接上了。
    - 鷹巖村（`far_eze`，Èze Village 的空拍掃描）：外海西南、珊瑚灘正前方的遠景島（`21-coast.js` 的 `FAR_SITES.eze`），山城那面朝北；掃描切邊由 `skirt` 往下補一圈山坡沉進海裡，夜裡照屋頂顏色撒的 `glow` 點放暖色窗燈（27 的 `COAST_MODELS` 的 `after`）。掃描附的 360° 空拍全景裁成珊瑚灘步道上的燈箱看板（`w1_board`，`W2.board` 是位置）。
    - 光格島（Arq Grid Tron）：城東南開闊海面上的人工島（`10-city.js` 的 `TRON_SITE`，`SEA_FR` 座標框；十五片版面的東面是山，從舊位置往西南挪到 (2100, 2900)），縮成 0.85（598×684 m）、原點在島心。遠景 `far_tron` 只留街區與亮線；近景 `isle_tron`（`21-tron.js`，走近 950 m 才下載）是整個街區含長椅、販賣機、樹與停著的車，光速機車、三種車（敞篷車、膠囊車、嘟嘟車）與光束拆成自己的物件。`tron` 選項（`tools/walkgrid.mjs`）在擺正後量：每 0.5 m 一格最多三層站得上去的高度（上面 1.9 m 內沒有別的面才算，寫成 `isle_tron.walk.bin`）、陸地遮罩（從外框灌水，灌不到的空地也算陸地，遊程編碼）、封閉的洞補島面、沿陸地邊界長岸壁（`edges`）、車道中心線圖（`graph`）、家具位置（`vend`／`bench`／`tree`／`lamp`／`cycle`／`pool`）與上下層街區之間的升降梯（`lift`）。開船到北端碼頭（`31-boats.js` 多一艘遊艇）下船走進去；下層街區低於海面，海面的 shader 用陸地遮罩挖掉。以檔案開啟只有遠景替身。
    - 北嶺鐵道橋（`far_rail`，Railway bridge with a feeling of coziness）：觀景台往山上約 200 m 的山溝（`10-city.js` 的 `VIADUCT`，座標是公園框 `NPARK.f`）。`tools/props.mjs` 量出軌道中心線（二次曲線 `line.c`、橋面高度）與四座橋墩，`hf` 是掃描每格地面最低點；`viaCarve()` 把公園山坡挖成山溝、貼到掃描的地面底下，兩端是路堤（南邊是 70 m 的長坡道）、洞門與 120 m 的隧道，隧道上面是封頂的山頭；洞門是 `w1_tunnel` 的掃描模型（每端照 `VIADUCT.ends[i].port` 設定挖地形：東端 `rock` 是 Marshall Tunnel 的岩壁切口，洞口上方的陡坡挖低成 `railRamp` 再蓋三塊崖壁 `cliff`；西端 `arch` 是石拱洞門，兩側加翼牆、牆外填土到牆頂，拱頂上方的山填到 `fill`），下載前用照模型形狀做的程式替身 `e.proxy`；全區地圖與小地圖畫出鐵道（`90-hud.js` 的 `MAP_RAIL`，隧道是虛線）（`21-rail.js`；山網格碰到挖過範圍 `NPARK.carve` 的三角形由 `21-coast.js` 細分成約 3.6 m 一格）。圍籬把整座橋圈進公園（`NPARK.rail`、`NPARK.fence`），西、東兩條步道接到兩端的路堤，第三條沿山溝下到谷底。橋面、護欄、橋墩與隧道是 `20-walk.js` 的多層步行面：走在橋上是橋面高度、在谷底從橋下穿過去，隧道裡相機有天花板。五節的電聯車（`w1_train`，Lastochka electric train，車頭、中間車、車尾）每趟從西洞底開到東洞底（約 465 m，17 m/s），兩端停 38 秒；晚上車窗與頭燈亮、橋兩側每 16 m 一盞球燈、橋墩頂的紅燈與投光燈、洞口燈、洞裡每 12 m 一盞、號誌依列車變紅綠。以檔案開啟或下載前是程式建模的鋼梁橋、橋墩與方塊車廂（`VIADUCT.proxy`、`railProxyCar`，模型由 `27-world1.js` 的 `W1_SITES` 下載好就拿掉；火車只在 1100 m 內才下載）。測試 API：`__nc.props.viaduct`、`__nc.props.rail`（`tp`／`L`／`W`／`yaw` 是公園框座標）、`__nc.props.coast.FAR_SITES`。
    - 遠景島下載前是 `ISLE_PROXY.eze`／`tron` 程式建模的岩丘，`near` 是 3600 m（城市南半都看得到）。
    - gameready_city 的三台車（藍色舊轎車、白色廂型貨車、藍色郵務車）烘進 `traffic.glb`（`grc_sedan`／`grc_stepvan`／`grc_mailvan`，`tools/traffic.mjs` 的 `rawFile` 讀 `w1_grc.glb`），在車流與路邊停車；彎臂路燈（`w1_grc` 的 `lamp`）換掉支路的程式路燈（燈頭的發光鏡片照舊）；柏油路面的三張貼圖（`w1_asphalt_*.webp`）由 `10-city.js` 的 `ASPH_U` 接進路面 shader 當 5.5 m 的重複貼圖。這三樣都在 world_2 那段的 `W2` 清單裡，以檔案開啟不換。
    - `tools/props.mjs` 加的選項：`skirt`（`d`、`slope`、`col`、`cap`、`ring`；極座標一圈往內找掃描邊緣，往下長成斜坡）、`hf`、`glow`、`texOut`、`board`、`tron`（光格島的步行格與陸地，`tools/walkgrid.mjs`）、`only`／`inst`（只留路徑符合的原件、取第幾份）；`props.json` 裡光格島的大陣列（`TIGHT` 的鍵）擠成一行。
  - 新的處理選項：`seg`（依 xz 佔地的連通塊把一整片城市拆成單棟，`segPick` 決定要不要與朝向）、`sloppy`（掃描模型用 meshopt 的 Permissive 減面到指定比例）。
- World 第四輪之二（使用者提供的 `~/Downloads/world_2`，21 個 CC BY 4.0 的 Sketchfab 模型，複製到 gitignore 的 `.cache/world2/`；`tools/props.mjs` 的 `st2_street`、`nat_trees`、`nat_bush`、`cst_beach`、`cst_ferris`、`cst_port`、`cst_mount` 七組，合計約 4 MB）：以 http(s) 開啟時開場在背景下載，下載好由 `27-props.js` 檔尾那段把 `20-props.js`／`21-coast.js` 的程式建模換掉，位置、碰撞與 `zn` 規則不變；以檔案開啟、下載失敗或網址加 `?w2=0` 時程式建模原封不動。換掉的有人行道消防栓（`street.glb` 的同一個模型）、垃圾桶（四款依位置雜湊混用）、電話亭、海濱與岬角長椅、行道樹（楓樹）與公園、岬角、灰鷗島的樹（楓樹、兩款垂柳、橡樹混用；程式建模的樹留在 200 m 外當遠景，`instUpdate` 的 `stream.R0`）、海濱花台的灌木、椰子樹、救生員塔、陽傘、棧橋摩天輪（支架、輪子、十個車廂，照舊轉動、車廂保持水平）、錨灣港四座岸橋（小車與吊具照舊動，船不在吊臂下的岸橋停在陸側）、貨櫃船（照舊起伏）與堆場貨櫃（一格 40 呎換成兩個門對門的 20 呎，顏色照原本六色）。人行道電箱（`street.glb` 的 `ebox`，沿路邊點約 2%）與遊艇碼頭岸上的加油機（`pump`，每個碼頭一台，貼圖上的品牌字樣模糊掉）兩種模型版與程式建模版都擺（`streetBoxes()`，要等 `99-main.js` 的 `cityWorld()` 之後呼叫 `W2.boot()` 才擺，因為船位在 `31-boats.js`；替身時 `w2.proc` 為真）。只有模型版才加的：人行道報紙箱、公園長椅與野餐桌、岬角野餐桌、樹下灌木、北嶺後面的六座雪山（遠景材質）。數量多的每個部件一個 InstancedMesh（`instanced()` 第六個參數 `R` 給了就一定串流：小件 110 m、中件 160 m、樹 200 m），材質是 `glbMaterial` 加上 `instanceMatrix` 的版本（`propMatI`，和原材質共用 uniforms）。田園一景（`cs_country` 組，abhayexe 的 Countryside Scene）也在這裡：三款槭樹和 `nat_trees` 四種一起分七種擺公園、縫與島上的樹（`treePick`），20 呎貨櫃疊在拖吊場西牆邊與霓峰塔工地；整景（`scene`、路上的小貨櫃 `boxes`）與島上的護欄（`rail`）由 `27-world1.js` 照 `21-coast.js` 的 `CS_SITES` 擺在灰鷗島兩條碎石路上。狀態在 `window.__nc.props.w2`（`on`、`sets`、`failed`、`swapped`、`n` 各類數量、`at` 每類一個位置、`kept()` 還在場景上的程式建模網格數）。

- 世界與地形（HANDOFF 實作）：島上、碼頭的擋牆與外緣臨水的低擋牆（每 260 m 一座）都有爬梯（`LADDERS`，擋牆在梯子處讓游泳的人通過，梯子外一定是水）；四個碼頭各停一艘遊艇（浪刃 Wavecut 24、灣仔 Bayhop 17），F 上船，海上有航跡與浪花，可以開到外海（`farClamp` 擋在遠景對岸的堤岸外）；灰鷺河對岸有一條走得上去的濱水步道（鷺岸步道，`BANK_WALKS`；東灣對岸在重排時拿掉了）：石板步道、臨水欄杆與路燈、長椅、一排近景樓面（一樓店面、樓上窗格，擋住後面遠景模型糊掉的底層），中間是渡船碼頭與售票亭，南北各停一艘船，從梯子或碼頭上岸；錨灣港的貨櫃船每輪約 13 分鐘靠港、離港、轉向、出海再回來，岸橋與集卡跟著工作；區與區之間的縫上有碎石步道與步道燈，每段步道中間是涼亭、小賣亭或公廁；遠景的河對岸跟著舊城那一片（`FAR_PARTS`），整座城轉角度時不會和城區錯開。
- 灰鷗島的兩個基地走得進去：`tools/foot.mjs` 量模型在人身高度（0.35–2 m）的牆與頭上的屋頂，得到每棟樓的佔地矩形（`props.json` 的 `foot`），碰撞、以檔案開啟時的方塊替身與日照高度圖都照它；樓與樓之間的街、中庭走得進去。廢墟原檔是一圈樓圍起來的遊戲關卡，拿掉東面一棟樓的南半，留一個朝跨海橋那條路的缺口。
- 北嶺公園（`10-city.js` 的 `NPARK`、`21-park.js`）：照 GTA V 地圖重排之後，搬到冠石北端外面的山坡（離冠石北端 400 m 內、山腳最緩的外緣頂點，`hillH` 在這個方向打折成一道緩坡山谷）。外緣上一道 12 m 寬的牌樓門（路樁間隔 1 m：人走得過，機車與汽車過不去；步行的警察與小隊也追得進來，站的高度用 `footY()`），圍籬沿著外緣、兩側與後面圈起約 200×270 m，1.1 km 的之字形泥土步道爬到約 50 m 高的雲階觀景台，沿路 36 m 一盞步道燈、四張長椅，門內側山腳是管理站。公園有自己的座標框 `NPARK.f`（門在原點、局部 −z 朝山上，`parkW`／`parkL` 換算）；`groundH`／`seaFloor` 在範圍裡回傳山的網格高度 `hillMeshH()`（21-coast 的極座標山網格是平面三角形，兩圈之間比 `hillH` 低），玩家與相機貼著畫出來的坡走，觀景台的平台高度固定。大地圖與小地圖畫出公園、步道與觀景台。

### 日夜與天氣

- 時鐘從 02:14 開始走，遊戲裡 1 分鐘 = 現實 2.5 秒（一天一小時）。太陽依北緯 35° 算方向，06:12 日出、12:15 正南、18:18 日落；月亮在對面。天空、霧色、環境光與太陽色由夜、晨昏、正午三組調色盤依太陽高度、雲量、雨量與霧混合；白天霧改成指數平方（遮住 420 m 的距離剔除邊界），曝光與泛光門檻跟著調低、調高。鏡頭在高處時（直升機、霓峰塔）霧的密度改成標高 20 m 的指數大氣、沿視線取平均，只在城市陸地上（`22-hmap.js` 的 `uCityM`，外緣往裡縮 90 m）；`01-settings.js` 的 `detail.alt` 把細節距離放大到 1.6 倍，`uCullR` 以外照水平距離全進霧裡。遠景材質（`FAR`）的部分距離霧也隨鏡頭高度回到完整的霧（`farK`）。
- 路燈在天色亮度 0.32–0.62 之間熄滅與點亮，窗戶亮燈比例依時刻變化（凌晨兩點約三分之一），車頭燈白天變暗、車流白天不挑頭燈光源。
- 日照陰影：建物用高度圖（`22-hmap.js`）沿太陽方向步進取樣，帶半影；車與人用最近 12 個（低階 6 個）方盒算接觸陰影與太陽投影。樹冠用樹冠圖沿太陽方向走 10 步，在葉團裡用雜訊挖出空隙，地上是長條的碎光。
- 間接光（近似，不是真的全域光照）：`skyVis()` 在高度圖上朝五個方向各取兩個距離找地平線仰角，算這一點看得到多少天空（窄巷與樓腳暗、屋頂與廣場亮，260 m 內才算）；再加一項太陽照在地面與對面牆上反彈回來的暖色光（看得到的天空越少越多）。體積光與薄霧見 `28-sky.js`、`70-render.js`；中以上的畫質等級才開（`GPU_TIERS` 的 `vol`），進階影像選單有「體積光」「清晨薄霧」兩列。
- 天氣是馬可夫鏈：每種狀態持續數十到一百多遊戲分鐘，再依權重換到下一種（凌晨三點半到八點半起霧的機率三倍）；雨量與雲量平滑過渡，地面積水在雨停後依日照慢慢變乾，行人在雨量超過 0.12 時撐傘。雨越大街上的人越少（雷雨時約剩一半，沒帶傘的先走；只在離玩家 55 m 外消失與回來）；路面濕的時候玩家座駕的側向抓地少三成、煞車力少兩成。只有雷雨會打雷。睡覺會換一次天氣，快速存檔記下目前天氣。

### 不規則城市（照 GTA V 地圖重排的十五片）

照 Los Santos 的地圖與藍圖讓整座城不規則（計畫與進度見 `../../plans/260-irregular-city.md`）。生成程式都不動，仍在方格的「邏輯座標」裡跑（亂數序列、舊城立面不變），上面多一層分片的變換：

- 十五片（`04-layout.js` 的 `LAYOUT`，由 `tools/check-zones.mjs` 產生並檢查不重疊；`05-zones.js` 讀成 `ZONES`）：舊城、冠石、光環北／南、灰石西／東、楓林西／東、公園大道、琥珀西／東、珊瑚灘北／南、錨灣西／東，各轉 −39° 到 26°。片的邊界在道路中心線上，邊界那條路兩邊各有一份。室內場館（x ≥ 9000）不屬於任何片。
- 片裡的街道不是直格子：世界 = 剛體(彎曲(邏輯))，彎曲 `warpJ` 是平滑的位移場（在城外 160 m 內漸漸消失），反算用牛頓法 `unwarp`。不改變換時的網格在 `cityAdd` 逐頂點烘焙到世界座標（長邊先切成 12 m，法線用 J⁻ᵀ），地面網格帶 `aL`（邏輯 xz 與邏輯 x 軸的方向）給 shader 算標線；會動的物件掛在剛體座標框 `localZone`，實例與模型用仿射的 `frameM4`；碰撞盒切成 ≤ 24 m 的幾段（`boxSplitW`），每段有自己的仿射框（`frameA`：盒中心那一點的 R·J，含伸縮與斜切，盒在世界裡是平行四邊形；`toW`／`toL`／`dirW`／`dirL` 都認得，圓對盒在 `quadPush` 直接用世界座標算，`rayBox` 方向照線性換算）。以前的框只照 x 軸，斜切到 20° 以上的片沿 z 的牆會偏 3 m，一邊是空氣牆、另一邊走得進牆裡。`?warp=0` 關掉彎曲。
- 外緣是不規則的多邊形 `CITY_POLY`（180 個頂點，`CITY_SHORE` 標出臨水的那幾段）；外緣裡面、片與片之間是草地，`DROP_CELLS` 拿掉的十九格讓外緣有缺口。臨水的邊有低擋牆（每 260 m 一座梯子）、欄杆、路燈、碎石步道與長椅（`10-city.js` 的 `SHORE`），靠山的邊是高牆，外面是 `hillH` 的山坡，山坡上散著住宅（夜裡窗燈像好萊塢山）。
- 連接道路（`06-roads.js`，`kind: 'c'`）：相鄰兩片共用邊界上的路口兩兩配對，近的、兩端大致面對面的先配，沿著縫的順序一致、不交叉；一對片一條都配不到時接最近的那一對。縫裡沿著兩片邊界路的中線鋪碎石步道（`SEAM_PATH`），寬的地方擺涼亭、小賣亭、公廁（`SEAM_SITES`）。鐵灣高架斷橋 `BROKEN` 自動挑一條離鐵灣貨場最近、前後都是草地的連接道路。
- 斜穿片的大道（`06-roads.js` 的 `DIAG`，`kind: 'd'`）：楓林里的 Marlowe Blvd、琥珀工業區的 Cobalt Blvd、錨灣港的 Sable Blvd，各從一個路口斜穿四個街區到對角的路口（邏輯座標的直線，跟著片彎）。穿過的街區改成廣場（`10-city.js` 的 `b.plaza`）：街區碰撞拿掉，地塊照原寬度抽亂數但不蓋樓（`ghost`，原本是實體建築的換成 `ghost: 2`），人行道板沿大道切成兩個三角形，`20-props.js` 在三角形裡擺樹與噴水池、大道兩側點路燈，路邊不停車；斜的路段不裝號誌（大道的兩端在片的路口上，照那個路口的號誌）。
- 快速道路（`06-roads.js` 的 `FWY`，`kind: 'f'`）：北嶺快速道路（Ridgeline Fwy）沿冠石與光環之間的縫南下，經楓林里與公園大道之間、公園大道南緣，到珊瑚灘與錨灣港之間；港灣快速道路（Harbor Fwy）沿北排（舊城、冠石、光環）與中排（楓林里、公園大道）之間的縫東西向，在冠石東南角和北嶺快速道路交叉。中線是兩片邊界路的中點（`seamMid`），段與段在最近的兩點剪開接起來、平滑後由 `fwyClear` 推到離片的路至少 `FWY_GAP`（兩個半路寬加人行道）、搬出片的範圍。大部分是高架（橋面 `DECK_H` 8 m、橋寬 `DECK_W`），跨過連接道路不設路口（`F.over`）；和平面道路的銜接點是號誌路口（`rnSplit` 在交點切開，交點是 `free` 路口，號誌兩相：快速道路一相、連接道路一相）：兩端最外面的連接道路，以及離其他銜接點太近、來不及爬上去的交叉（`FWY_CLR`）。銜接點前後 `FWY_PAD` 是平路，之後以 `FWY_LR` 長的緩和曲線爬升（最陡約 8.6%）；沒有跨越的路段留在地面，所以沒有死路。兩條快速道路的交會是高架上的共線段：北嶺快速道路拆成北段（`tail`）與南段（`head`），以 `FWY_ANG` 的角度在港灣快速道路的橋面上合流、走一段再分流（`H.joins`），分合流點是帶 `y`（橋面高度）與 `nosig`（沒有號誌、車流直接過）的路口。匝道（`FWY_RAMPS`）：出口在行車方向右手邊從主線分出，`RAMP_DIV` 內岔開到 18 m（放不下試 26 m）外，岔開段跟著主線高度，再以最陡約 11% 降到下一條從橋下穿過的連接道路，在那裡以號誌 T 字路口落地；入口反過來，同一個路口的出口與入口共用落地點。分合流點要在主線至少 4 m 高、離別的分合流點 30 m 以上，整條匝道要離片的路、別的快速道路與匝道夠遠，越過別的連接道路處要 6.6 m 高，平移出去的線不能在主線急彎內側折回。匝道的邊帶 `oneway: 1`（只能從 a 開到 b）、`ramp`、窄的 `hw`／`dw`：車流只順向生成與轉入、走路中間、不加速，`rnField` 與 GPS 只算順向，路面換成沒有中央雙黃線、兩側白實線的版本，地圖不標名字、小地圖畫窄一點，橋上沒有中央護欄與門架；橋面疊在一起的地方（`deckOn`）不蓋護欄、中央護欄與橋墩，車才開得過去。`21-coast.js` 建橋面：外側面、護欄、路肩、橋底、每 26 m 一根橋墩加蓋梁（避開下面的路；以 http(s) 開啟時柱身換成 `hwy.glb` 的混凝土柱，依高度拉長，`FWY_PIERS`）、中間的分隔島護欄（低矮，子彈打得過），長的路段有綠色門架與路名牌；護欄與分隔島的碰撞盒帶 `ly`（`colY` 低於它就略過，橋下走得過），橋墩的碰撞圓帶 `hy`。車流、玩家、步行與下車都看 `deckAt`（只有高度接近橋面時才站在橋上，在橋下就照地面）；`carAhead`、車與車的碰撞、推人、車撞人、搶車（`nearCar`、`detachCar` 保留車流的 `y`）都會比高度，橋上橋下互不干擾；`__nc.tp` 用 `spawnY`，最近的路是快速道路才站上橋面。路燈表的 `w` 帶高度（`1 + y`），著色器的燈位置是 `6.1 + w`；車流在快速道路上開快 35%；地圖畫成黃色、HUD 路名顯示快速道路的名字。
- 地圖：底圖全部是世界座標（`90-hud.js` 的 `MAP_GEO`、`drawCity`，大地圖與小地圖共用）：外緣外的地形是 8 m 一格的點陣（越高越亮），街區與地塊照邏輯矩形取點換過去，路面是路網每條邊描粗。

### 下水

- 從珊瑚灘外緣（水深 0.3 m 處）可以涉水走出去（水越深走越慢），水深超過 1.25 m 就改游泳：UAL 的 `Swim_Idle_Loop`／`Swim_Fwd_Loop`，Shift 加速，入水、出水與划水有水花聲。水深由 `10-city.js` 的 `waterDepth()` 算（沙灘外是 1.4 m 的淺海，其他水面當 8 m 深）。車也開得下去，會泡水熄火（見「車輛細節」）。
- 游泳時不能開槍、瞄準、跳舞或切換角色；碼頭、步道與島的岸邊擋牆照樣擋住，只能從沙灘上岸。游不到灰鷺河與東灣對岸。通緝中下水時，岸上 110 m 內的警察（步行或車上）一直看得見你、不會消星，85 m 內步行的警察會往水裡開槍。

### 全區地圖

- 仿 GTA 暫停地圖：近黑的街廓與地塊、淺灰道路、深藍水面，北面是山、兩側是對岸；拉遠顯示區名，拉近顯示街名與車道線。
- 地點：任務目標、座駕、其他兩位主角、三座場館、車行、車庫、六間安全屋（擁有是綠色）、銀行、警察局、醫院、拉麵攤、二十一座特技跳台（已完成的變淡）。右側圖例按類別列出與計數，點一下跳到該類的下一個；左上資訊卡顯示類型、地區、距離、產權與收入，可設導航點或傳送（通緝中不能傳送）。
- 左下是比例尺與游標所在的「地區 / 街名」，滑鼠移動時有十字線。手機版圖例改成底部橫向捲動條、資訊卡縮小並收起說明。

### 暫停與設定（Esc，`01-settings.js`／`95-menu.js`）

- 仿 GTA V 的暫停畫面：上方「地圖／遊戲／設定」分頁（Q／E 切換，地圖分頁直接打開全區地圖），左邊類別、右邊設定列（↑↓ 選列、←→ 調整、Enter 選擇、Esc／Backspace 返回），選中的列反白，滑桿可以點或拖。背景是停住的那一幀，模糊、去飽和後染上目前主角的顏色。開著時世界完全停住（`loop` 不跑 `step`，`uTime` 也不走），改了畫面設定只重畫一張預覽。
- 遊戲：繼續、快速存檔／讀取（同手機的規則）、操作說明（照目前的按鍵綁定列出）。
- 設定對照 GTA V 的類別：鍵盤／滑鼠（滑鼠與瞄準靈敏度、反轉 Y 軸、瞄準按住／切換、觸控環顧靈敏度）、按鍵綁定（18 個動作，新鍵已被占用時兩邊對調；方向鍵、數字鍵、Enter、Esc、Backspace 另有用途不給綁）、聲音（主、音效、音樂、環境四條匯流排，切到其他分頁時靜音）、攝影機（視野、預設鏡頭距離、開車自動回正、鏡頭晃動）、顯示（HUD、小地圖、安全區域、公制／英制、亮度）、影像（畫質等級自動／最低／低／中／高／極高、內部解析度自動或固定 50–100%、MSAA 關／X2／X4／X8（依顯示卡上限）、幀率上限、失焦時暫停、人口密集程度、細節距離）、進階影像（路面倒影關／低／高、泛光、動態模糊、雨絲與水花、鏡頭色散、底片顆粒）。每一頁最後一列是「恢復預設值」。
- 顯示卡分級（`00-core.js` 的 `GPU_TIERS`／`GPU`）：WebGL 碰不到驅動程式，只能讀 GPU 名稱（`WEBGL_debug_renderer_info`，Firefox 與 Safari 只給大概的名稱）與 ANGLE 的繪圖後端（Mac 是 Metal、Windows 是 Direct3D 11、Linux 是 OpenGL／Vulkan），照名稱分四級：`soft`（SwiftShader、llvmpipe、Microsoft Basic Render，或 `failIfMajorPerformanceCaveat` 被拒）、`low`（Intel UHD／HD、行動 GPU；觸控與小螢幕一律從這級起）、`mid`（Apple M 系列基本款與 Safari 的「Apple GPU」、Iris Xe、內顯 Radeon、較舊的 GeForce）、`high`（Apple M Pro／Max／Ultra、GeForce RTX／GTX 960 以上、Radeon RX／Pro、Arc A 系列）。等級決定解析度上限（1／1.25／1.25／1.5）、MSAA（0／0／2／4）、幀率上限（30／60／60／不限：120 Hz 的 ProMotion 與高更新率螢幕在中低階先鎖 60）、細節距離（0.7／0.8／0.9／1）、路面倒影（關／低／低／高），倒影的遠平面（`70-render.js` 的 `reflFar`：high 不縮，中低階只畫到霧差不多蓋滿的距離——夜裡約 250–300 m、白天約 570 m，鏡頭越高畫越遠，再遠的建築在倒影裡換成天空；雨夜街景看不出差別，`__nc.reflFar(m)` 可固定量測），以及開場就定下的 shader 常數：點光數 `NL`（8／8／12／16）、日光陰影步數 `SH_N`（10／16／20／26）、地上陰影的車人數 `NOCC`（6／6／12／12）。high 就是原本桌機的設定、low 是原本觸控裝置的設定。設定檔第 2 版只存改過的項目（`setSave`），沒動過的畫質設定跟著等級走；第 1 版存檔裡和當時預設一樣的畫質值當成沒改過。網址 `?gpu=soft|low|mid|high` 最優先、再來是選單、最後是自動；驗收工具（`tools/lib.mjs` 的 `open()`）固定帶 `gpu=high`（觸控 `low`），結果才不隨顯示卡變。
- 驅動相容：沒有 `EXT_color_buffer_float`／`_half_float` 的驅動（少數舊 Android、部分虛擬機）渲染目標退回 8 位元（`GPU.hdr`，`?hdr=0` 可強制測），畫得出來但泛光較弱；`webglcontextlost`（Windows 的 TDR、Mac 切換內顯與獨顯）時提示「顯示卡重置中」，恢復後重建渲染目標、材質與貼圖由 three 重新上傳；開始畫面在開放進場前用 `R.compileAsync` 先編好看得到的材質（有 `KHR_parallel_shader_compile` 時在背景編，Direct3D 後端編譯特別慢，進度條才不會凍住）。自動解析度的「夠快」改成貼著螢幕更新間隔與幀率上限判斷（原本要幀時低於 13 ms，60 Hz 螢幕永遠達不到，降下去就升不回來；鎖 30 fps 時也不再一直降），降過一次 15 秒內不升。太慢時先看是 CPU 還是顯示卡：整幀 CPU 超過目標的八成時先讓戶外倒影隔幀更新、再縮細節距離，不降解析度；顯示卡畫不完才降解析度。夠快時倒著放回來，CPU 也有餘裕時解析度可以升過 100%（`resMax()`，上限是 `GT().ss` 與 `px` 像素數；畫質等級「極高」`ultra` 不會自動選到，DPR 2、細節距離 1.2、超取樣到 1.5 倍）。Esc 選單的狀態列顯示 GPU 型號與等級，`npm run test:gpu` 驗收，`__nc.gpu` 是分級結果（`name`、`short`、`vendor`、`api`、`auto`、`tier`、`hdr`、`lost`、`compileMs`）。
- 各等級的實測（無頭 Chrome、1440×900、DPR 1、雨夜，draw call／三角形；倒影那一趟幾乎把場景再畫一次，是最大的一塊）：起點 高 985／844 萬、中 779／730 萬、低 697／658 萬、最低 436／329 萬；霓峰塔吊臂上 高 1286／1478 萬、中 1075／1280 萬、低 966／1071 萬、最低 546／474 萬；街區中央 高 1241／1430 萬、最低 485／439 萬。Retina（DPR 2）的螢幕上中低階的解析度上限 1.25 比高階的 1.5 少三成像素。SwiftShader 軟體繪圖（800×500）同一畫面高等級每幀約 2000 ms、最低等級約 370 ms（仍然玩不動，只保證畫得出來）。無頭 Metal 的幀時被垂直同步鎖在 16.7 ms、timer query 會把等待畫面緩衝算進去，所以只比較繪製量。
- GTA V 有但這裡沒做的：控制器（沒有手把輸入）、語音聊天、Rockstar 編輯器與社群（沒有對應功能）、全螢幕／解析度／更新頻率／垂直同步（瀏覽器管，改以內部解析度與幀率上限代替）、紋理與陰影品質（貼圖烘在 GLB 裡、場景沒有即時陰影）、車流密度（車流同時是搶車、警察追逐與碰撞的對象，隱藏要動五個系統）、字幕與語言（沒有語音台詞）、通知（只有一行提示訊息，沒有可分類開關的通知）。GTA V 的「儲存與啟動」對應到遊戲分頁的快速存檔／讀取。
- 設定存在 `localStorage` 的 `nc260.settings`（和遊戲存檔 `nc260.motors` 分開，讀檔時逐項檢查範圍）。按鍵綁定是在 window 的捕獲階段把實體鍵換成遊戲的 code 再轉送，其他 part 的按鍵處理不用改。

## 已知限制

還沒做的項目與從哪裡改，整理在 [`HANDOFF.md`](HANDOFF.md)。

- 無頭 Chrome（Metal）街上約 120 fps：起點附近約 165 個 draw call、240 萬個三角形；城市擴成 20×15 並加上第三輪的模型後，以 http(s) 開啟在光環廣場約 660 個 draw call、610 萬個三角形（最重的地方），楓林里約 460／430 萬、燈籠公園旁約 490／570 萬、灰鷗島約 100／43 萬、東灣邊約 270／120 萬，都還在 120 fps（Neighbourhood 街區每個約 23.6 萬面、模型檔 6.9 MB；Cyberpunk City 的 14 群合計 7.7 MB，這兩組用 meshopt 的 `high` 等級（`tools/props.mjs` 的 `meshopt`）；遠景三組 1500 m、島上兩組 900 m 內才下載）。第三輪新增的模型檔合計約 26 MB（全部 `assets/260/props/` 約 54 MB），頁面單檔約 3.4 MB。低階手機會自動降低點光數量與解析度，細節距離預設 0.8；內部解析度選「自動」時降到 60% 還是太慢，就再把細節距離（遠處的立面、建築組與街道設施）每次縮一成、最短到六成，變快了先放回來（`01-settings.js` 的 `detail`，Esc 選單的狀態列會顯示）。
- 人物的貼圖都換成素色（衣物分區上色，約一半的路人上衣有程式畫的條紋、格紋或拼色），髮型只有男女各三種（素材包的全部）；調酒、DJ、撐傘、抽菸、抱胸與騎機車是在現成動畫上覆寫手臂方向，動作比較僵；動畫庫只有一段舞，舞池的七種舞步多半是上身覆寫，腳步一樣。人物每幀多花約 2 ms CPU（街上約 20 人在畫面內）。
- 程式建模的車型是低多邊形的剪影致敬，比例與輪廓取自線稿，細節（曲面、內裝）都很簡化；車庫一次只開一台出門。
- 實車模型每台 4–20 萬面（第二批壓在 9 萬左右），展示廳 47 台全部載入時約 170 萬個三角形、365 個 draw call（無頭 Chrome Metal 約 108 fps），整間車行要下載約 51 MB，手機上會很吃力；輪子是用幾何自動拆的，只有 8 台汽車的卡鉗有獨立材質、拆成固定件，其他車的卡鉗仍會跟著輪子轉。車流 16 種車型的 `traffic.glb` 約 1.1 MB，頁面單檔因此約 2.5 MB；計程車是綠色的 Fairheaven（黃色的 Canyon '75 沒有下載到）。
- 車流是固定車道圖上的跟車模型，只會在前車停住時借對向車道超車、後面有亮燈追來的警車時靠邊減速讓路，不會為了轉彎併線；車輛之間是雙圓碰撞（`69-kinema.js` 的迭代解算有切向摩擦與打轉，但沒有 OBB，側面擦撞的接觸點不精準、車身中段的空檔碰不到人）；翻車與疊車是 `68-roll.js` 的簡化版（只繞車身縱軸與橫軸翻、碰撞仍是雙圓，疊車只看車身中心落在哪台車的範圍內），機車不會翻。
- 海岸、河與山大多是固定的畫面與擋牆：游泳與開船只到擋牆、淺水與遠景對岸的堤岸外；北嶺公園只有圍籬裡的高度貼著畫出來的坡（外面的山坡走得上去，但高度照 `hillH`，會比網格高一點），車（含機車）被門口的路樁擋住，步行的警察與小隊照直線追進來，路人與車流不進公園，從觀景台往城裡看只有遠處的剪影（420 m 外的立面不畫）；對岸的 London City 只有濱水步道走得上去，後面的樓是遠景。灰鷗島上的廢墟街區與辦公園區走得進樓與樓之間的街，樓本身是空殼、進不去（安全屋辦公室除外）。
- 楓林里與公園大道的 Neighbourhood 街區立面是拼貼圖集，自動找窗只會找出滿牆的碎點，所以真的窗戶只有窗簾貼圖會亮；其他立面在夜裡由 shader 補一層一樓往上衰減的洗牆光，加上依世界座標切格、隨窗燈比例亮起的「房間」（`WASH_SETS`），亮的是整格牆面，不是窗框。
- 驗收裡「1 星：警車趕到並逮捕」偶爾失敗（約五次一次，下一項「BUSTED 後重生」會跟著失敗），重跑即可。
- 安全屋的二樓只有頂層公寓（旋轉樓梯）與島上辦公室（電梯）上得去，上下樓是固定路線；迷你閣樓原檔只是一個角落，和室 Loft 原檔東面是開著的，缺的牆是補上的素色牆。換裝只換顏色與袖長、帽子，沒有新的衣服模型；安全屋車庫和 GARAGE 07 共用，只有自己的座駕停得進去。別墅的門在雲杉坡街區的南面，門外可能剛好是一棟公寓大樓。
