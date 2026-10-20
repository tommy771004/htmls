# 266 雪夜五月廣場 · 延伸玩法素材

`web/266-eternauta-plaza.html` 仍是單檔、沒有 build step。這個資料夾只放**把模型烘焙成 Gaussian splat** 的工具，產出在 `assets/266/`（有 commit，頁面執行時從 `../assets/266/` 讀取，可用 `?actors=<url>` 改位置）。

## 為什麼要自己烘焙

網路上找不到授權清楚、可直接用的喪屍或武器 `.spz`（公開的 splat 多半是場景掃描，或者授權不明）。所以改用 CC0 的網格模型，在瀏覽器裡把表面取樣成扁平的 Gaussian，寫成 SPZ v2：

| 產出 | 來源（CC0） |
| --- | --- |
| `zombie-a/b/c.spz`、`.skin` | Quaternius Universal Base Characters（身體與髮型），動畫取自 Universal Animation Library |
| `pistol`、`rifle`、`crowbar`、`gasmask`、`medkit`、`ammo`、`tape`、`radio`、`food`、`crate` | Poly Haven：service_pistol、bolt_action_rifle_7_62、crowbar_01、old_gas_mask、medical_box、ammo_box、medical_tape、vintage_radio_transceiver、russian_food_cans_01、old_military_crate |
| `shotgun` | 199 鹽岬大逃殺的 `assets/199/guns.glb`（節點 `sg`，Blender 腳本建模） |

場景、玩家角色與玩家動畫仍然來自上游 [santisiri/eternauta-online](https://github.com/santisiri/eternauta-online)（從 GitHub 固定版本即時下載，不在這裡）。

## 指令

```bash
node games/266-eternauta-plaza/tools/fetch-assets.mjs     # 下載 Poly Haven glTF 到 .cache/polyhaven/（gitignore）
PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs \
  node games/266-eternauta-plaza/tools/bake.mjs [all|items|zombies]
```

- Quaternius 素材包借用 `games/197-openworld/.cache/`（`ubc/`、`ual/`），要先在 197 跑過 `npm run characters`。
- `tools/preview.html?view=items&only=pistol,rifle` 或 `?view=zombies&clip=walk&t=0.3` 透過網站伺服器開啟，可以檢查烘焙結果；`tools/shot.mjs` 以無頭 Chrome 截圖。

## 格式

- **SPZ v2**：gzip；16 位元組標頭（magic `NGSP`、版本 2、數量、SH 階數 0、fracBits 12），之後依序是 24 位元定點座標、alpha、顏色、`(ln s + 10) × 16` 的尺度、w ≥ 0 的四元數 xyz。
- **`.skin`**：gzip 的 Uint16 陣列，每個 splat 4 組，低 8 位元是權重、高 8 位元是骨頭編號，直接寫進 Spark `SplatSkinning.skinData`。靜止姿勢是單位矩陣，每幀以 `boneWorld × inverseBind` 更新骨頭。
- **`manifest.json`**：道具的大小與包圍盒、喪屍對應的骨架（男／女，骨頭階層、inverse bind、身高），以及重新取樣成 20 fps 的動畫片段（walk、idle、jog、jab、cross、hit、hitHead、die、crouch）。
- 道具座標沿用 199 的慣例：−Z 是槍口、+Y 朝上、原點在握把。

## 頁面裡的玩法

任務、喪屍 AI、武器、裝備與音效都寫在 `web/266-eternauta-plaza.html`。`window.__eter` 有測試用的 `spawn(x, z, opts)`、`give(weapon)`、`mission(i)`、`god(on)`、`fire()`、`melee(kind)`、`interact()`、`clear(x, z)`（檢查點位是否站得住）與 `game`（目前狀態）。
