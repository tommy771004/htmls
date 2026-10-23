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
- `PLAYWRIGHT_MODULE=… node games/266-eternauta-plaza/tools/accept.mjs` 在 1440×900 與 390×844 跑驗收（鐵撬開木箱、巡邏車、金屬人、新槍、錯誤與外部請求、`warn`），截圖寫到 gitignore 的 `.cache/accept/`。

- Quaternius 素材包借用 `games/197-openworld/.cache/`（`ubc/`、`ual/`），要先在 197 跑過 `npm run characters`。
- `tools/preview.html?view=items&only=pistol,rifle` 或 `?view=zombies&clip=walk&t=0.3` 透過網站伺服器開啟，可以檢查烘焙結果；`tools/shot.mjs` 以無頭 Chrome 截圖。

## 格式

- **SPZ v2**：gzip；16 位元組標頭（magic `NGSP`、版本 2、數量、SH 階數 0、fracBits 12），之後依序是 24 位元定點座標、alpha、顏色、`(ln s + 10) × 16` 的尺度、w ≥ 0 的四元數 xyz。
- **`.skin`**：gzip 的 Uint16 陣列，每個 splat 4 組，低 8 位元是權重、高 8 位元是骨頭編號，直接寫進 Spark `SplatSkinning.skinData`。靜止姿勢是單位矩陣，每幀以 `boneWorld × inverseBind` 更新骨頭。
- **`manifest.json`**：道具的大小與包圍盒、喪屍對應的骨架（男／女，骨頭階層、inverse bind、身高），以及重新取樣成 20 fps 的動畫片段（walk、idle、jog、jab、cross、hit、hitHead、die、crouch）。
- 道具座標沿用 199 的慣例：−Z 是槍口、+Y 朝上、原點在握把。

## 頁面裡的玩法

任務、喪屍 AI、武器、裝備與音效都寫在 `web/266-eternauta-plaza.html`。`window.__eter` 有測試用的 `spawn(x, z, opts)`（`opts.kind` 可指定 `soldier`／`robot`）、`give(weapon)`、`mission(i)`、`god(on)`、`fire()`、`melee(kind)`、`interact()`、`clear(x, z)`（檢查點位是否站得住）、`props`（靜態道具）與 `game`（目前狀態，含每隻敵人的 `kind`）。

- **敵人種類**取自 `manifest.json` 的 `kind`：一般池是三種平民喪屍加士兵（等級 1 以上才會混進來，身體傷害 ×0.7、爆頭 ×1.8），另有 3 具（手機 2 具）金屬人不參與一般出生，只由任務或 `DIR.robotP`（無線電任務與無盡模式）叫出來：血量 300 起、身體 ×0.55、爆頭 ×2.4、只有重擊才會踉蹌，擊毀後掉落衝鋒槍（已有就掉彈藥）。
- **靜態道具**在頁面的 `PROPS`（位置、地面高度、朝向）與 `PROP_BOX`（道具座標裡的碰撞盒）；碰撞盒由 `propPrims()` 接在 `PRIM_RAW` 後面，所以喪屍尋路也會繞開。位置是在可走網格上找起伏小於 0.3 m、避開出生點與任務點的地方挑的。
- **任務**共七段：鐵撬 → 軍用木箱 → 濾罐 → 巡邏車後車廂（頭盔＋背心）→ 守住金字塔 → 金屬人（北邊路口的短步槍，擊毀兩具）→ 無線電。
