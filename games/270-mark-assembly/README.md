# 裝甲進化殿堂（270）

`web/270-mark-assembly.html` 是單檔 Three.js 0.186.0 檢視器（介面與做法沿用 182）：鋼鐵人 Mark 1–85 的裝甲，滑過零件看部位與組裝幀區間，可播放 288 幀自組裝、爆炸圖、全息線框、尺寸、轉盤與兩座機庫。依據的企劃文件是 `mark_1_85_ai_blender.md`（使用者提供，未收進 repo）。

非官方同人作品，與 Marvel、Disney 無關。頁面上的「授權」面板與本資料夾的 `CREDITS.md` 要一起維持。

## 網格從哪裡來

只有三套授權清楚的模型（見 `CREDITS.md`），由 `tools/bake.py` 轉成 `assets/270/*.glb`：

| 檔案 | 來源 | 用於 |
| --- | --- | --- |
| `bruno.glb`（約 3.9 MB） | BrunoIkari 的 Mk.3（CC-BY-SA 3.0） | Mark 3、6 |
| `mk3.glb`（約 0.3 MB） | 2iemniak 的 Mk.3（CC0） | Mark 1、2、4、5 |
| `mk7.glb`（約 0.9 MB） | 2iemniak 的 Mk.7（CC-BY 3.0） | Mark 7–50、51–84（全息線框）、85 |

Mark 3 與 Mark 7 是對應型號的實體模型，其他型號都是「最接近的骨架＋依參考圖換色」，頁面的規格面板會標示「實體模型」或「近似」。Hulkbuster、Igor、Rescue、Mark 1 的體型以部位縮放近似（`BULK`），特化配件（重錘、夾爪、砲管、飛彈艙、推進器、寶石）用基本幾何補上。

GLB 不內嵌，頁面要透過網站伺服器開啟（`npm start` 的白名單已包含 `assets/` 與 `.glb`）；以檔案開啟會顯示錯誤說明，不會丟例外。

## 重新烘焙

原始 `.blend` 放在 gitignore 的 `.cache/`（從 Blend Swap 下載的 zip 解出來）：

```
.cache/2iemniak-mk3.blend
.cache/2iemniak-mk7.blend
.cache/bruno-mk3.blend
```

```bash
B=/Applications/Blender.app/Contents/MacOS/Blender
$B -b .cache/2iemniak-mk3.blend --python tools/bake.py -- mk3   ../../assets/270/mk3.glb   [debug.png]
$B -b .cache/2iemniak-mk7.blend --python tools/bake.py -- mk7   ../../assets/270/mk7.glb
$B -b .cache/bruno-mk3.blend    --python tools/bake.py -- bruno ../../assets/270/bruno.glb
```

`bake.py` 做的事：

1. `common.py` 的 `MODELS` 決定每個檔案保留哪些物件、細分上限與減面比例（Bruno 原檔 44 萬面，減到約 36 萬三角形）。
2. 套用修改器、拆成連通塊，依正規化座標（x/H、y/H、高度比例）找最近的骨段，分到 `helmet`、`chest`、`abdomen`、`pelvis`、`reactor`、`pauldron.L/R`、`upperArm.L/R`、`forearm.L/R`、`hand.L/R`、`thigh.L/R`、`shin.L/R`、`boot.L/R`。關節位置寫在 `LM`，用 `tools/grid.py` 輸出的格線圖量出來。
3. 原始材質依 `ROLE_MAP`（沒有時看顏色）換成塗裝角色 `role_p`（主色）、`role_s`（副色）、`role_t`（金屬）、`role_k`（關節）、`role_g`（發光）。
4. 每個部位一個物件、頂點在世界座標（物件本身沒有變換），以 meshopt 壓縮匯出；身高 1.95 m、腳底 y = 0、面向 +Z。

除錯圖（第三個參數）用固定配色標出每個部位，改了 `LM` 或分類規則後先看這張圖。

## 頁面結構

- **部位名稱**：three 的 GLTFLoader 會把節點名的「.」拿掉（`upperArm.L` → `upperArmL`），頁面用 `PART_RE` 還原。
- **型號資料** `MARKS`：`c` 是主色、副色、金屬、關節四色；`ov` 讓某個部位改用別的角色色（例如 85 的手臂改金、47 的腰腿改銀）；`rx` 是反應爐形狀（圓形沿用模型，其他形狀蓋一片發光片）；`att` 配件、`pat` 塗裝圖樣（1 數位迷彩、2 火焰、3 條紋、4 骷髏鏤空、6 微型反應爐節點、7 鑄鐵）、`bulk` 體型；`fix` 是企劃書與參考圖不一致時的更正說明。
- **自組裝**：每個部位的幀區間在 `PART[*].ord`，由腳到頭；頭盔先停在臉前、第 150–156 幀扣下，第 157 幀點亮，158–186 幀流光（`uPulse`），165 幀排氣。鏡頭腳本是 `CAMK`。
- **配件**跟著 `userData.follow` 指定的部位一起爆炸與飛入。

## 測試 API

`window.__mk`：`setMark(n)`、`goView('q'|'front'|'side'|'back'|'hero'|'face')`、`setMode('exploded')`、`startAsm()`／`stopAsm()`、`seek(frame)`、`hover(partId)`、`pick(x, y)`、`snap()`（跳過過場）、`set([x,y,z],[tx,ty,tz])`、`loaded()`、`tris()`。網址 `#mk42` 直接開某個型號。

## 已知限制

- 只有三套網格，Mark 1、38、41、44、48 等體型特殊的型號只能近似。
- Bruno 的 Mk.3 是原檔的伸手姿勢，向前伸的那隻手被分到前臂。
- 模型沒有骨架，終幕的「三步走＋英雄落地」改成下沉緩衝與仰角推鏡。
