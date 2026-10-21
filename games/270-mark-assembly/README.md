# 裝甲進化殿堂（270）

`web/270-mark-assembly.html` 是單檔 Three.js 0.186.0 檢視器（介面與做法沿用 182）：鋼鐵人 Mark 1–85 的裝甲，滑過零件看部位與組裝幀區間，可播放 288 幀自組裝、爆炸圖、全息線框、尺寸、轉盤與兩座機庫。依據的企劃文件是 `mark_1_85_ai_blender.md`（使用者提供，未收進 repo）。

非官方同人作品，與 Marvel、Disney 無關。頁面上的「授權」面板與本資料夾的 `CREDITS.md` 要一起維持。目前進度與待辦見 `HANDOFF.md`。

## 網格從哪裡來

八套授權清楚的模型（見 `CREDITS.md`），由 `tools/bake.py` 轉成 `assets/270/*.glb`：

| 檔案 | 來源 | 用於 |
| --- | --- | --- |
| `bruno.glb`（約 3.9 MB） | BrunoIkari 的 Mk.3（Blend Swap，CC-BY-SA 3.0） | Mark 3、6 |
| `mk3.glb`（約 0.3 MB） | 2iemniak 的 Mk.3（Blend Swap，CC0） | Mark 2、4、5 |
| `mk7.glb`（約 0.9 MB） | 2iemniak 的 Mk.7（Blend Swap，CC-BY 3.0） | Mark 7–15、18–24、26–32、34–37、40、42、43、51–84（全息線框） |
| `mk1.glb`（約 0.6 MB） | Nathang30 的 Mark 1（Sketchfab，CC BY-NC-SA 4.0） | Mark 1 |
| `mk38.glb`（約 1.5 MB） | JorelPaul 的 Igor（Sketchfab，CC-BY 4.0） | Mark 38 |
| `mk46.glb`（約 2.5 MB） | Gource 的 Mark 46（Sketchfab，CC-BY 4.0） | Mark 45、46 |
| `mk47.glb`（約 2.7 MB） | Gource 的 Mark 47（Sketchfab，CC-BY 4.0） | Mark 47 |
| `mk85.glb`（約 2.9 MB） | LLIypuk 的 Mark 85（Sketchfab，CC-BY 4.0） | Mark 85 |

Mark 1、3、7、38、46、47、85 是對應型號的實體模型（`MARKS` 裡 `real: true`）。Mark 16、17、25、33、39、41、44、49、50 是改造模型（`kit: true`，見下節）。其他型號都是「最接近的模型＋依參考圖換色」，頁面的規格面板會標示「實體模型」「改造」或「近似」。特化配件（重錘、夾爪、砲管、飛彈艙、推進器）用基本幾何補上；`BULK` 部位縮放目前沒有型號使用。

## 改造模型（derive.py）

沒有授權模型、外型又和現有網格差很多的型號，以 `tools/derive.py` 從實體模型改造：先照 `bake.py` 拆件（設 `BAKE_NOEXPORT`，不匯出），再依 `DERIVE[key]` 改比例、包外殼、加零件，最後接地、身高正規化成 1.95 m，用同一個 `export()` 以 meshopt 匯出。參考 GK 與設定圖的比例，只取比例、不描圖。

| 檔案 | 來源 | 改了什麼 |
| --- | --- | --- |
| `mk44.glb` | mk7 | 浩克毀滅者：上身放大成桶狀、巨型前臂與手、短粗腿；四肢與肩甲包上 `shell()` 外殼（凸包膨脹 → 體素重建 → 平滑 → 減面，水平面切出分件縫與金色飾板），內層只留關節；腹部深色分節環、掌心推進器。Mark 48 也用它 |
| `mk41.glb` | mk46 | 骷髏：主副色裝甲板只留一條條水平肋骨帶（胸骨線保留），露出黑色內襯；四肢收細，背上加脊椎節 |
| `mk49.glb` | mk85 | 救援：窄肩細腰、腿收細、頭盔縮小；背後左右各三片帶發光線的翼板 |
| `mk17.glb` | mk7 | 碎心者：胸甲加大，原反應爐換成巨型圓形核心（發光盤＋金屬環＋八根金色放射肋） |
| `mk33.glb` | mk7 | 銀色百夫長：方正的銀色大肩甲外殼、胸口倒三角反應爐板、立領 |
| `mk16.glb` | mk7 | 夜店：四肢收細、肩甲縮小、胸甲收窄，整體比 Mk.7 緊湊 |
| `mk25.glb` | mk7 | 衝擊者：前臂加粗，外側裝上黃黑分節的氣動攻城錘（活塞桿與錘頭、兩道固定架） |
| `mk39.glb` | mk7 | 雙子星：背上掛次軌道推進器（主艙、鼻錐、雙噴嘴、尾翼與掛架），胸甲略加厚 |
| `mk50.glb` | mk85 | 出血邊緣：四肢略收、黑色接縫改成主色（奈米裝甲沒有螺絲縫），背後四片推進翼貼著背甲、兩個推進口 |

```bash
for k in mk44 mk41 mk49 mk17 mk33 mk16 mk25 mk39 mk50; do $B -b --factory-startup --python tools/derive.py -- $k ../../assets/270/$k.glb [debug.png]; done
```

由 Mk.85 改造的型號會先把右手背的六顆寶石換成金屬（`no_stones()`），寶石只留給 Mark 85。除錯圖（第三個參數）保留塗裝角色色，輸出正面、3/4 背面與側面三張。改了 `bake.py` 的拆件結果，改造模型也要重跑。頁面開啟後只在背景預先載入 1 MB 以下的模型，其他選到時才載入。

GLB 不內嵌，頁面要透過網站伺服器開啟（`npm start` 的白名單已包含 `assets/` 與 `.glb`）；以檔案開啟會顯示錯誤說明，不會丟例外。

## 重新烘焙

來源檔放在 gitignore 的 `.cache/`（Blend Swap 的 zip 解出來的 `.blend`、Sketchfab 下載的 GLB）：

```
.cache/2iemniak-mk3.blend   .cache/nathang30-mk1.glb    .cache/gource-mk46.glb
.cache/2iemniak-mk7.blend   .cache/jorelpaul-mk38.glb   .cache/gource-mk47.glb
.cache/bruno-mk3.blend      .cache/lliypuk-mk85.glb
```

```bash
B=/Applications/Blender.app/Contents/MacOS/Blender
$B -b .cache/2iemniak-mk3.blend --python tools/bake.py -- mk3   ../../assets/270/mk3.glb   [debug.png]
$B -b .cache/2iemniak-mk7.blend --python tools/bake.py -- mk7   ../../assets/270/mk7.glb
$B -b .cache/bruno-mk3.blend    --python tools/bake.py -- bruno ../../assets/270/bruno.glb
# GLB 來源不用開 .blend（common.load() 會清空場景再匯入）
for k in mk1 mk38 mk46 mk47 mk85; do $B -b --factory-startup --python tools/bake.py -- $k ../../assets/270/$k.glb; done
```

`bake.py` 做的事：

1. `common.py` 的 `MODELS` 決定每個檔案保留哪些物件（Mark 38 的地板、Mark 46／47 的 Icosphere 會丟掉）、細分上限與減面比例（Bruno 原檔 44 萬面減到約 36 萬三角形；Mark 85 原檔 225 萬面先減到約 31 萬，`predecimate`）。Mark 46／47 是綁了 `swat_` 骨架的 T 字站姿，`arms=64` 依權重把手臂繞肩關節往下轉 64°（自己做一次線性蒙皮，不靠骨頭位置，原檔骨架的座標是壞的）。
2. 套用修改器、拆成連通塊，依正規化座標（x/H、y/H、高度比例）找最近的骨段，分到 `helmet`、`chest`、`abdomen`、`pelvis`、`reactor`、`pauldron.L/R`、`upperArm.L/R`、`forearm.L/R`、`hand.L/R`、`thigh.L/R`、`shin.L/R`、`boot.L/R`。關節位置寫在 `LM`，用 `tools/grid.py` 輸出的格線圖量出來（`blender -b --factory-startup --python tools/grid.py -- mk38 out`）。Mark 46／47 改看骨架權重（`BONE_PART`，上臂靠肩三成改成肩甲）；Sketchfab 的模型多半是一整片連續網格，`split=True` 會逐面分類，同一塊有 `share`（預設八成）以上屬於同部位才整塊歸過去，硬殼的 Mark 1、38 放低以免切出鋸齒。體型粗壯的模型用 `RSCALE` 放大骨段半徑。
3. 原始材質依 `ROLE_MAP`（沒有時看顏色）換成塗裝角色 `role_p`（主色）、`role_s`（副色）、`role_t`（金屬）、`role_k`（關節）、`role_g`（發光）。Mark 85 的六顆寶石寫成 `g_<色碼>`，材質名 `role_g_<色碼>`，頁面讀出色碼、不跟著全身換成冰藍光，也就不再補幾何寶石。
4. 每個部位一個物件、頂點在世界座標（物件本身沒有變換），以 meshopt 壓縮匯出；身高 1.95 m、腳底 y = 0、面向 +Z。

除錯圖（第三個參數）用固定配色標出每個部位，改了 `LM` 或分類規則後先看這張圖。

## 頁面結構

- **部位名稱**：three 的 GLTFLoader 會把節點名的「.」拿掉（`upperArm.L` → `upperArmL`），頁面用 `PART_RE` 還原。
- **型號資料** `MARKS`：`base` 是用哪個 GLB、`real` 標示實體模型、`rxOwn` 表示模型本身就是那個形狀的反應爐（不蓋發光片）、`cam` 是自組裝鏡頭的額外拉遠倍數（Igor 1.5）、`fin.tm／tr` 改金屬角色的金屬度與粗糙度；`c` 是主色、副色、金屬、關節四色；`ov` 讓某個部位改用別的角色色（例如 85 的手臂改金、47 的腰腿改銀）；`rx` 是反應爐形狀（圓形沿用模型，其他形狀蓋一片發光片）；`att` 配件、`pat` 塗裝圖樣（1 數位迷彩、2 火焰、3 條紋、4 骷髏鏤空、6 微型反應爐節點、7 鑄鐵）、`bulk` 體型；`fix` 是企劃書與參考圖不一致時的更正說明。
- **自組裝**：每個部位的幀區間在 `PART[*].ord`，由腳到頭；頭盔先停在臉前、第 150–156 幀扣下，第 157 幀點亮，158–186 幀流光（`uPulse`），165 幀排氣。鏡頭腳本是 `CAMK`。
- **配件**跟著 `userData.follow` 指定的部位一起爆炸與飛入。

## 測試 API

`window.__mk`：`setMark(n)`、`goView('q'|'front'|'side'|'back'|'hero'|'face')`、`setMode('exploded')`、`startAsm()`／`stopAsm()`、`seek(frame)`、`hover(partId)`、`pick(x, y)`、`snap()`（跳過過場）、`set([x,y,z],[tx,ty,tz])`、`loaded()`、`tris()`。網址 `#mk42` 直接開某個型號。

## 已知限制

- 改造模型是程式加的外殼與零件，輪廓接近參考圖，但面板細節做不到 GK 的 1:1；Mark 48 沿用 Mark 44 的改造模型。
- Mark 38 的肩箱和胸甲在原檔是同一塊外殼，所以爆炸圖裡肩箱跟著胸甲走。
- Bruno 的 Mk.3 是原檔的伸手姿勢，向前伸的那隻手被分到前臂。
- 模型沒有骨架，終幕的「三步走＋英雄落地」改成下沉緩衝與仰角推鏡。
