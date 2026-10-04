# 外部資產來源與授權

程式碼之外，畫面用到的掃描貼圖、天空與模型都是 **CC0（公眾領域）** 素材，放在 `assets/199/`（約 14 MB），由下列工具產生。
這些檔案不屬於本專案，授權以原始來源為準。素材載入失敗（例如以檔案直接開啟）時，前端會退回程序生成的貼圖與方塊模型。

## ambientCG 掃描貼圖

`assets/199/tex/` 的顏色與法線貼圖來自 [ambientCG](https://ambientcg.com)（CC0），由 `tools/fetch-assets.mjs` 下載 1K JPG 包後以 `cwebp` 縮成 1024 的 WebP。

| 檔名 | ambientCG 資產 | 用途 |
| --- | --- | --- |
| `brick` | Bricks085 | 紅磚街屋 |
| `plaster` | Plaster001 | 外牆灰泥（依建築染色） |
| `wall` | PaintedPlaster017 | 室內白牆、天花板 |
| `concrete` / `concrete2` | Concrete034 / Concrete031 | 混凝土、地基、港區鋪面 |
| `asphalt` | Road012A | 道路、跑道、老街街道 |
| `paving` | PavingStones070 | 廟埕石板 |
| `wood` | WoodFloor051 | 木地板、木箱、家具 |
| `tile` | Tiles107 | 磁磚地板 |
| `metal` / `rust` | CorrugatedSteel005 / Metal041B | 浪板、貨櫃、油槽／鏽鐵屋頂 |
| `roof` | RoofingTiles014B | 斜屋頂瓦片 |
| `grass` / `grassdirt` / `dirt` / `rock` / `sand` | Grass004 / Ground037 / Ground103 / Rock030 / Ground054 | 地形五層混合 |
| `facade` | Facade006 | 新村辦公大樓帷幕牆 |
| `bark` | Bark012 | 樹幹 |
| `siding` | WoodSiding009 | 鄉間房子的木壁板外牆 |
| `leaves` | LeafSet024（顏色＋透明度） | 樹葉卡片 |

## Poly Haven

- 天空：[Kloofendal 48d Partly Cloudy (Pure Sky)](https://polyhaven.com/a/kloofendal_48d_partly_cloudy_puresky)（Greg Zaal，CC0）。`sky/env.hdr` 是 1k HDR（環境光與太陽方向），`sky/sky.jpg` 是色調對應版縮成 4096×2048 的背景。
- 道具（glTF 1k，貼圖縮成 512）：[Old Military Crate](https://polyhaven.com/a/old_military_crate)（地上的彈藥箱）、[Metal Jerrycan Green](https://polyhaven.com/a/metal_jerrycan_green)、[Power Box 01](https://polyhaven.com/a/power_box_01)（街邊擺設），放在 `assets/199/props/`。

## Kenney

`assets/199/cars/` 的七台車（sedan、hatchback-sports、van、suv、taxi、truck、police）來自 [Kenney Car Kit](https://kenney.nl/assets/car-kit)（CC0），前端把色票降一半彩度。

## Quaternius

`assets/199/models/soldier.glb` 由 `tools/build-soldier.py`（Blender）把 [Universal Base Characters](https://quaternius.itch.io/universal-base-characters) 的男性底模與 [Universal Animation Library](https://quaternius.itch.io/universal-animation-library) 的 17 段動畫（皆 CC0）組成，另以 IK 烘焙出 5 段步槍動畫；依骨骼權重把身體分成皮膚、制服、手套、軍靴四個材質，制服的迷彩、頭盔、防彈背心、背包與槍都由前端程式生成。素材包借用 `games/197-openworld/.cache/`（`games/197-openworld/tools/fetch-quaternius.py` 下載，不進 repo）。

## 本專案用 Blender 腳本建的模型

以下由 `tools/` 的 Blender 腳本程式建模，沒有外部素材：`models/kit.glb`（鐵窗、浪板遮雨棚、鐵捲門、木門、門廊、陽台、屋頂水塔、機車、路燈、長椅，`build-kit.py`）、`models/guns.glb`（六把槍，`build-guns.py`）、`models/furniture.glb`（床、沙發、餐桌椅、書櫃、衣櫃、流理台、冰箱、電視櫃、書桌、貨架、紙箱、盆栽，`build-furniture.py`）。士兵的五段步槍動畫是 `build-soldier.py` 以 Quaternius 手槍瞄準動畫為底、用 IK 把雙手放到握把與護木後烘焙的。

## 沒有用到外部資產的部分

地形、建築與室內配置、窗框玻璃、道路標線、電線桿、棕櫚樹、草叢、槍枝、第一人稱手臂、降落傘、運輸機、HUD、所有音效（Web Audio 即時合成），以及沒有素材時的全部備援貼圖。
