# 266 雪夜五月廣場 · 延伸玩法素材

`web/266-eternauta-plaza.html` 仍是單檔、沒有 build step。這個資料夾只放**把模型烘焙成 Gaussian splat** 的工具，產出在 `assets/266/`（有 commit，頁面執行時從 `../assets/266/` 讀取，可用 `?actors=<url>` 改位置）。

## 為什麼要自己烘焙

網路上找不到授權清楚、可直接用的喪屍或武器 `.spz`（公開的 splat 多半是場景掃描，或者授權不明）。所以改用 CC0 與 CC BY 的網格模型，在瀏覽器裡把表面取樣成扁平的 Gaussian，寫成 SPZ v2。完整來源與作者見 [CREDITS.md](CREDITS.md)：

| 產出 | 來源（CC0） |
| --- | --- |
| `zombie-a/b/c.spz`、`.skin` | Quaternius Universal Base Characters（身體與髮型），動畫取自 Universal Animation Library |
| `pistol`、`rifle`、`crowbar`、`gasmask`、`medkit`、`ammo`、`tape`、`radio`、`food`、`crate` | Poly Haven：service_pistol、bolt_action_rifle_7_62、crowbar_01、old_gas_mask、medical_box、ammo_box、medical_tape、vintage_radio_transceiver、russian_food_cans_01、old_military_crate |
| `shotgun` | 199 鹽岬大逃殺的 `assets/199/guns.glb`（節點 `sg`，Blender 腳本建模） |
| `soldier-a`、`robot-a`、`robot-b`（`.skin` 綁 Quaternius 骨架） | Sketchfab CC BY：WW2 Panzergrenadier＋Military Character Kit 的頭盔與背心、UE4 Robot Cyborg Pack、Retextured model |
| `aksu`、`mp7`、`helmet`、`vest` | Sketchfab CC BY：AKSU-74、Low Poly MP7A2、Military Helmet、Military Character Kit |
| `cruiser`、`shelter-a`、`shelter-b`、`can`（廣場上的靜態道具） | Sketchfab CC BY：Fairheaven LT 80 Cop Cruiser、Bus Shelter Diorama、Modern Bus Stop Shelter、Soda Cans 3D Pack |
| `f35` | Sketchfab CC BY：F-35A Lightning II（頁面的 `JET` 每 2～3 分鐘讓它從 75～95 m 高空飛過，夜裡靠航行燈 Sprite 認出來；`__eter.jet()` 立刻叫一架） |

人形的 Sketchfab 模型用 `bake.html` 的 `fitHumanoid()` 換到 UBC 骨架：骨頭名稱對照（Mixamo、UE4、Unity 三種命名）、轉成左腿在 +X 面朝 +Z、每根骨頭對齊 UBC 的 T-pose 方向後在 CPU 上蒙皮、縮放到 UBC 身高，再把原本的權重改成 UBC 骨頭編號；頭盔、背心這類剛性配件用 `attachPart()` 依身體部位的包圍盒擺放並綁在 Head／spine_03。

場景、玩家角色與玩家動畫仍然來自上游 [santisiri/eternauta-online](https://github.com/santisiri/eternauta-online)（從 GitHub 固定版本即時下載，不在這裡）。

## 指令

```bash
node games/266-eternauta-plaza/tools/fetch-assets.mjs     # 下載 Poly Haven glTF 到 .cache/polyhaven/（gitignore）
PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs \
  node games/266-eternauta-plaza/tools/bake.mjs [all|items|zombies] [--only id,id]
```

- Sketchfab 原檔放在 gitignore 的 `games/266-eternauta-plaza/.cache/sketchfab/`（從已登入的 Chrome 下載，見 CREDITS.md 的連結）。`--only` 只重烘指定的 id，`manifest.json` 依 id 合併。
- `tools/glbview.html?src=<網站路徑>&only=<正規式>&hide=<正規式>` 把原檔拍成四視角，選節點、量尺寸用。
- `PLAYWRIGHT_MODULE=… node games/266-eternauta-plaza/tools/accept.mjs` 在 1440×900 與 390×844 跑驗收（鐵撬開木箱、巡邏車、聖堂與地鐵站的進出和任務、金屬人、新槍、Esc 選單暫停、錯誤與外部請求、`warn`），截圖寫到 gitignore 的 `.cache/accept/`。
- `node games/266-eternauta-plaza/tools/room-col.mjs <glb> '<json>' [格寬] [--png out.png]` 把室內場景的網格柵格化成碰撞盒（`b,…` 字串，貼進頁面 `ROOMS.<id>.prims`）：取近乎垂直的三角形，分低帶 0.25–1.7 m 與高帶 2.4–6 m 兩層，兩層都有的格子是 9 m 高的牆、只有低帶的是 1.6 m 的家具，再把連續的格子併成長方體。JSON 是 `origin`、`scale`、`rotY`（和烘焙一致）、`carve`（清開的矩形，門洞與車門用）、`exclude`（略過的節點名正規式）。

- Quaternius 素材包借用 `games/197-openworld/.cache/`（`ubc/`、`ual/`），要先在 197 跑過 `npm run characters`。
- `tools/preview.html?view=items&only=pistol,rifle` 或 `?view=zombies&clip=walk&t=0.3` 透過網站伺服器開啟，可以檢查烘焙結果；`tools/shot.mjs` 以無頭 Chrome 截圖。

## 格式

- **SPZ v2**：gzip；16 位元組標頭（magic `NGSP`、版本 2、數量、SH 階數 0、fracBits 12），之後依序是 24 位元定點座標、alpha、顏色、`(ln s + 10) × 16` 的尺度、w ≥ 0 的四元數 xyz。
- **`.skin`**：gzip 的 Uint16 陣列，每個 splat 4 組，低 8 位元是權重、高 8 位元是骨頭編號，直接寫進 Spark `SplatSkinning.skinData`。靜止姿勢是單位矩陣，每幀以 `boneWorld × inverseBind` 更新骨頭。
- **`manifest.json`**：道具的大小與包圍盒、喪屍對應的骨架（男／女，骨頭階層、inverse bind、身高），以及重新取樣成 20 fps 的動畫片段（walk、idle、jog、jab、cross、hit、hitHead、die、crouch）。
- 道具座標沿用 199 的慣例：−Z 是槍口、+Y 朝上、原點在握把。
- **室內場景**（`scene: true`）寫進 `manifest.json` 的 `scenes`，頁面第一次進門才下載。烘焙選項：`origin`＋`scale`（＋`rotY`）把原檔換到場景座標（地板 y = 0）、`minY` 切掉地板以下、`bands: [[y 上限, 間距], …]` 依高度給不同取樣間距（近地面細、天花板粗）、`blank: [[u0, u1, v0, v1, [r, g, b]]]` 把貼圖上一塊 UV 換素色（抹掉真實品牌招牌）。
- **地鐵站不烘 splat**：低面數貼圖模型烘成 splat，近看一定糊（加密取樣、縮小圓片、貼圖 mip 都試過，效果有限），所以 `node games/266-eternauta-plaza/tools/room-glb.mjs metro` 把車站與車廂原檔合成 `assets/266/metro.glb`（座標換成場景局部座標、spec-gloss 轉 metal-rough、貼圖 1K WebP、meshopt），頁面用 `GLTFLoader` 直接畫網格，照明是半球光與最近三盞提燈的點光。原檔的站名牌與販賣機包裝換素色（`flat`）、發車資訊板與零食貨架的真實地名和品牌模糊（`blur`），車廂壓低金屬度（頁面沒有環境貼圖）。

## 頁面裡的玩法

任務、喪屍 AI、武器、裝備與音效都寫在 `web/266-eternauta-plaza.html`。`window.__eter` 有測試用的 `spawn(x, z, opts)`（`opts.kind` 可指定 `soldier`／`robot`）、`give(weapon)`、`mission(i)`、`god(on)`、`fire()`、`melee(kind)`、`interact()`、`clear(x, z)`（檢查點位是否站得住）、`props`（靜態道具）與 `game`（目前狀態，含每隻敵人的 `kind`）。

- **敵人種類**取自 `manifest.json` 的 `kind`：一般池是三種平民喪屍加士兵（等級 1 以上才會混進來，身體傷害 ×0.7、爆頭 ×1.8），另有 3 具（手機 2 具）金屬人不參與一般出生，只由任務或 `DIR.robotP`（無線電任務與無盡模式）叫出來：血量 300 起、身體 ×0.55、爆頭 ×2.4、只有重擊才會踉蹌，擊毀後掉落衝鋒槍（已有就掉彈藥）。
- **靜態道具**在頁面的 `PROPS`（位置、地面高度、朝向）與 `PROP_BOX`（道具座標裡的碰撞盒）；碰撞盒由 `propPrims()` 接在 `PRIM_RAW` 後面，所以喪屍尋路也會繞開。位置是在可走網格上找起伏小於 0.3 m、避開出生點與任務點的地方挑的。
- **任務**共九段：鐵撬 → 軍用木箱 → 濾罐 → 巡邏車後車廂（頭盔＋背心）→ 野戰醫院（聖堂裡的三個血袋）→ 守住金字塔 → 金屬人（北邊路口的短步槍，擊毀兩具）→ 末班車（地鐵列車裡的補給箱）→ 無線電。`mission()` 可以給編號或 id（`mission('metro')`）。
- **室內場景**在頁面的 `ROOMS`：和廣場在同一個 three 場景裡，放在 400 m 外（聖堂 `o: [400, 0, 0]`、地鐵站 `[400, 0, 120]`），燈光、霧與剔除都只看距離所以互不干擾。碰撞網格共用一份，尋路網格換場時整個交換（`NAVS`）；`setWorld()` 切換 splat、光暈、雪、道具與鏡頭範圍並收回所有喪屍。門是 `kind: 'door'` 的固定互動點（`buildDoors()`），`useDoor()` 在波次、無線電與金屬人出現時不開門。場景可以是 splat（聖堂，`splat`，可以是幾份共用一個夜色修飾器）或網格（地鐵站，`glb: 'metro'`，`backdrop` 補原檔沒蓋到的牆面）。任務目標在另一個場景時，`objective()` 把導引改指到門口。`__eter.enter(id)` 直接進場景，`ROOMS`／`WORLD`／`roomW(id, x, z)` 可擺位置。
- **廣場上的地鐵入口**是 `PROPS` 的 `subway`（欄杆 splat＋`stairWell()` 畫的往下樓梯貼圖），樓梯井整塊用碰撞盒擋住，門在南端開口外。
- **Esc 選單**（`#menu`）：遊戲中按 Esc（游標鎖定時由 `pointerlockchange` 接手）打開、世界暫停；左邊是目前任務與戰績、回到廣場／回到檢查點／除錯面板，右邊三個分頁：設定（滑鼠靈敏度、反轉、視野、亮度、晃動、HUD、準心、音量、自動畫質與解析度、飄雪、失焦暫停）、操作說明、關於（完整的素材來源）。設定存在 `localStorage` 的 `eter266.settings`（`SET_DEF` 是預設值與範圍，`setApply(k)` 套用）。觸控裝置右下的「選單」按鈕打開它。`__eter.menuOpen()`／`menuClose()`／`MENU`／`SET` 可測。
