# 裝甲進化殿堂（270）轉交文件

更新：2026-10-21。結構、指令與 `window.__mk` 測試 API 見同資料夾的 `README.md`，授權見 `CREDITS.md`；這份只記目前進度、做法上的取捨與還沒做的事。

## 目前狀態

| 類別 | 型號 | 網格 |
| --- | --- | --- |
| 實體模型（`real: true`） | 1、3、7、38、46、47、85 | `bake.py` 從 Blend Swap／Sketchfab 的授權模型轉出 |
| 改造模型（`kit: true`） | 16、17、25、33、39、41、44、49、50 | `derive.py` 從實體模型改造 |
| 沿用改造模型 | 48 | 用 `mk44.glb` 換色 |
| 近似 | 其餘 | 最接近的模型換色＋頁面幾何配件 |

兩種尺寸（1440×900、390×844）的無頭 Chrome 驗收通過：沒有例外、`console.error`、外部請求或手機水平溢出。

## 改造模型的做法（derive.py）

使用者問過「能不能依網路上的 GK 或立體圖延伸現有模型」。結論是：**只參考比例，不描圖、不轉載圖片、不用圖轉 3D**，由腳本改現有授權模型，授權沿用來源（mk7 → CC-BY 3.0，mk46、mk85 → CC-BY 4.0）。

流程：`exec` `bake.py`（`BAKE_NOEXPORT=1`，只拆件不匯出）→ `DERIVE[key]['fn']` 改部位物件（頂點在世界座標）→ `finish()` 接地、置中、身高 1.95 m、重設平滑 → `bake.py` 的 `export()` 匯出。

常用工具：

- `place(names, s, piv, to)`：繞樞紐縮放並平移。`anchor(name, 'top'|'bot'|'c')` 取樞紐。
- `shell(names, …)`：凸包 → 沿法線膨脹 → 體素重建 → 平滑 → 減面，水平面切出分件縫，`cuts` 可再加任意平面。回傳 `(bm, seam_faces)`。浩克毀滅者、百夫長的外殼都用它。
- `append(name, bm, role_fn)`：把幾何併進部位，`role_fn(face)` 決定塗裝角色。`drop_faces`／`recolor` 刪面或換角色。
- 基本幾何：`prim_box`、`prim_cyl`、`prim_torus`、`prim_prism`（往 −Y 擠出）。
- `front_y`／`back_y(name, x, z, r)`：取某處的前、後表面。背上的零件要用 `back_y` 貼齊局部表面，不要用整塊胸甲的最大 y，否則會浮在背後（Mark 50 踩過）。
- `no_stones()`：從 Mk.85 改造的型號先把六顆寶石換成金屬，寶石只留給 85。

座標：Blender 裡正面是 −Y（匯出後 three 是 +Z），所以「刪背面」是刪 **y 大**的面（Mark 16 一開始寫反，把胸甲正面挖出洞）。

除錯圖：第三個參數輸出 `_front`、`_back`、`_side` 三張保留塗裝角色色的圖，每改一次都要看正、背、側三面。

## 頁面接線（新增一個改造型號時）

1. `BASES` 加 `{ file, name: 'Mk.N 改造（由 Mk.X）', short: 'Mk.X', mb }`。`mb <= 1` 的模型會在背景預先載入。
2. `MARKS` 對應型號改 `base`，加 `kit: true`。模型本身已有的形狀要拿掉頁面配件（例如 25 的 `hammer`、39 的 `booster`）。模型自帶的反應爐形狀不要再蓋發光片，加 `rxOwn: true`。體型很大的設 `h`（身高）與 `cam`（自組裝鏡頭拉遠倍數）。
3. 選單頁尾、授權面板（「用於」與「改造成」）、兩份 `CREDITS.md`、`README.md` 的表格與重建迴圈，以及根目錄 `CLAUDE.md`、`README.md`、`index.html`、`llms.txt` 的型號清單都要一起改。根目錄的登錄檔混用 CRLF／LF，要以位元組方式局部替換，改完看 `git diff --stat`。

## 還沒做的事

### 1. 浩克毀滅者換成實體模型（等使用者下載）

已在 Sketchfab 篩過候選。授權標籤幾乎都是 CC-BY，所以改看來源可不可靠：

| 建議 | 模型 | 授權 | 理由 |
| --- | --- | --- | --- |
| 首選 | [Shreyaxh〈Hulkbuster〉](https://sketchfab.com/3d-models/hulkbuster-9f6e426a7bda4da2bc7137bbd8e541e3)（約 26 萬面） | CC-BY 4.0 | 說明寫了製作工具（3ds Max、Vray、Substance），面數沒有重複，作者其他作品是自己做的載具與機甲 |
| 補頭盔 | [el_robotto〈Hulkbuster's helmet MCU version〉](https://sketchfab.com/3d-models/hulkbusters-helmet-mcu-version-63e0d0c4b342413eaeb9528fdd851311) | CC-BY 4.0 | 2017 年原創，只有頭盔，可換掉 `mk44.glb` 的圓頂頭盔 |
| 不建議 | [admehta550〈Hulkbuster〉](https://sketchfab.com/3d-models/hulkbuster-aa7e2b8214a74432b86d6a7223c77a74)（約 130 萬面） | CC-BY 4.0 | 沒有說明，作者只上傳過這一件 |

排除的：同一份網格被多個帳號重複上傳的（695,316 面那份有十個以上帳號，另有 538,396、540,464 面兩份）。el_robotto 自己的完整浩克毀滅者是付費商品，這些免費重傳很可能是盜版。另外也排除 Disney Infinity 遊戲拆檔、Minecraft、LEGO，以及原創的 Gamma 改版。

使用者下載後，檔案放 `.cache/shreyaxh-mk44.glb`，接著：

1. `common.py` 的 `MODELS` 加一項（`glb=`、保留物件、減面比例）。用 `tools/grid.py` 量關節，寫進 `bake.py` 的 `LM`，也要設 `ROLE_MAP`。
2. 轉出成 `assets/270/mk44.glb`。Mark 44 改成 `real: true`，拿掉 `kit`，48 跟著用。`derive.py` 的 `hulkbuster()` 可以留著當備案，或改從新模型做 Mark 48 的差異。
3. 授權面板、`CREDITS.md`、README 表格補上作者與連結。

我們不能代為登入或下載，也不能繞過 CAPTCHA。下載的檔案一律當不可信資料處理：放進獨立資料夾，用 Python 讀取時加 `-I`。

### 2. 可以再改造的型號

Mark 26 伽瑪（目前是頁面的灰色重錘配件）、40 霰彈槍、42（目前沿用 mk7 換色）都可以照同樣方法做。開工前先對照參考比例，挑出和現有網格差最多的部位。

### 3. 小瑕疵

- Mark 25 的攻城錘在正面看靠腕部那段和前臂之間還有一點縫，只靠兩道固定架連著。
- Mark 39 的推進器整支是主色，參考圖上有更多金色環。
- 改造模型的面板細節做不到 GK 那樣 1:1，README 的「已知限制」有寫。

## 驗收方式

這個 session 的截圖與驗收腳本放在暫存資料夾，沒有收進 repo。重做時：

- 用任何靜態伺服器開 repo 根目錄（`npm start` 也可以，白名單已含 `assets/` 與 `.glb`），用 Playwright（`PLAYWRIGHT_MODULE`）開 `web/270-mark-assembly.html#mkN`。
- 等 `__mk.loaded()` 載入完，再 `__mk.snap()`、`__mk.goView('q'|'back')` 截圖。
- 在 1440×900 與 390×844 收集 `pageerror`、`console.error` 與非 127.0.0.1 的請求，並比對 `scrollWidth` 與 `innerWidth`。
