# 外部資產來源與授權

本專案的程式碼之外，`npm run assets`（`tools/fetch-assets.mjs`）會從 **three.js 官方 repo**
（<https://github.com/mrdoob/three.js>，tag `r186`，`examples/` 目錄）下載下列檔案到 `assets/197/`。
這些檔案**不屬於本專案**，各自的授權以原始來源為準；若要公開散布或商用，請先逐一確認。

| 本專案路徑 | three.js 來源路徑 | 用途 | 原始出處／備註 |
|---|---|---|---|
| `assets/197/models/stork.glb` `parrot.glb` `flamingo.glb` | `models/gltf/Stork.glb` 等 | 飛鳥 | mirada（ro.me 專案） |
| `assets/197/textures/grass.jpg` | `textures/terrain/grasslight-big.jpg` | 地形草地 | 見來源目錄的 `readme.txt` |
| `assets/197/textures/waternormals.jpg` | `textures/waternormals.jpg` | 水面法線 | |
| `assets/197/textures/moon.jpg` | `textures/planets/moon_1024.jpg` | 月面 | |
| `assets/197/textures/smoke.png` `caustics.jpg` | `textures/opengameart/` | 營火煙霧、水底焦散 | OpenGameArt |
| `assets/197/textures/wood.jpg` `wood_bump.jpg` | `textures/hardwood2_*.jpg` | 木箱、碼頭、帳篷支架 | |

## Quaternius 人物與動物

`assets/197/models/q/` 的模型來自 [Quaternius](https://quaternius.com)，授權為 CC0（各素材包附的 `License*.txt` 都是 CC0 1.0）。
`tools/fetch-quaternius.py` 從作者的 itch.io 頁面下載免費的 Standard 版到 `.cache/`（不進 repo），再由下列工具組成：

| 本專案路徑 | 素材包 | 用途 | 產生方式 |
|---|---|---|---|
| `models/q/npc_camper.glb` `npc_fisher.glb` `npc_hiker.glb` | [Universal Base Characters](https://quaternius.itch.io/universal-base-characters)（頭、髮型、眉毛）＋[Modular Character Outfits – Fantasy](https://quaternius.itch.io/modular-character-outfits-fantasy)（遊俠、農民服裝） | 三個 NPC | `tools/build-characters.py`（Blender）：底模只留頭，服裝與頭髮改綁同一副骨架，貼圖縮成 1K |
| `models/q/npc_anims.glb` | [Universal Animation Library](https://quaternius.itch.io/universal-animation-library) | NPC 的待機、說話、走、跑、坐、坐著說話 | `tools/build-anims.mjs`：挑出六段、只留旋轉與骨盆位移 |
| `models/q/horse.glb` | [Farm Animals Animated](https://quaternius.itch.io/lowpoly-animated-animals) | 野馬群 | `tools/build-animals.py`（Blender）：FBX 轉 GLB |

## ambientCG 掃描貼圖

`assets/197/textures/acg/` 的 20 張地面、岩石、沙、泥土、樹皮、樹葉、針葉、木板與帆布貼圖（顏色、法線、透明度）來自
[ambientCG](https://ambientcg.com)，授權為 CC0；資產編號見 `tools/fetch-assets.mjs` 的 `ACG`。

## 沒有用到外部資產的部分

以下全部由本專案的程式生成，不涉及第三方素材：

- 地形、岩石／沙／泥土貼圖與法線、樹皮、樹葉與針葉圖樣、樹與灌木的幾何（沒有掃描模型時的石頭也是程序生成）
- 鹿、兔子、車、帳篷、木箱、碼頭等道具
- `assets/197/models/` 下的 `boat.glb`、`bed.glb`、`knife.glb`、`gun.glb`、`hands.glb`（由 `tools/make-models.mjs` 產生）
- 所有音效（Web Audio 即時合成）

## Poly Haven 掃描模型

`assets/197/models/ph/` 的模型來自 [Poly Haven](https://polyhaven.com)，授權為 CC0。由 `tools/fetch-polyhaven.mjs`
下載 1k 貼圖版的 glTF，用 meshoptimizer 減面、去掉粗糙度／AO 貼圖後存成 GLB（`<id>_far.glb` 是只有幾何的遠景版本）。

| 本專案路徑 | Poly Haven 資產 | 作者 | 用途 |
|---|---|---|---|
| `models/ph/rock_07.glb` | [Rock 07](https://polyhaven.com/a/rock_07) | Jenelle van Heerden | 小石塊 |
| `models/ph/rock_face_02.glb` | [Rock Face 02](https://polyhaven.com/a/rock_face_02) | Dario Barresi、Rico Cilliers | 大岩塊 |
| `models/ph/tree_stump_01.glb` | [Tree Stump 01](https://polyhaven.com/a/tree_stump_01) | Rob Tuytel | 林地的腐朽樹樁 |
| `models/ph/dead_tree_trunk.glb` | [Dead Tree Trunk](https://polyhaven.com/a/dead_tree_trunk) | Rob Tuytel | 倒木 |
| `models/ph/fern_02.glb` | [Fern 02](https://polyhaven.com/a/fern_02) | Rob Tuytel、Rico Cilliers | 樹下的蕨叢 |
