# Model Y 積木模型（第 164 件）

用 LEGO 現行零件拼出的 1:30 特斯拉 Model Y：116 片、25 步。網頁是 `web/164-model-y-bricks.html`。

## 產出檔

| 檔案 | 內容 |
|---|---|
| `model-y.ldr` | LDraw 模型，以 `0 STEP` 分步；`0 !MY TITLE`、`0 !MY META_STEP view below`（翻面）為自訂註解 |
| `verify-report.md` / `.json` | 驗證報告：接點、碰撞、逐步組裝、零件現行供貨、重心 |
| `model-y-instructions.pdf` | A4 橫式分步說明書（封面、說明、25 步、零件總表） |
| `parts.csv` / `bom.json` | 零件清單（BrickLink、Rebrickable、LDraw 編號與數量） |
| `wanted-list.xml` | BrickLink Wanted List 上傳格式 |
| `prices.json` / `weights.json` | BrickLink 查價結果、購物車方案與零件重量 |
| `availability.json` | 由 Rebrickable 資料算出的零件＋顏色在 2024 年後套組的出現次數 |
| `model-y.mesh.json`、`parts/*.png` | 網頁用的三角網格與零件縮圖 |

`build/` 是說明書排版的中間檔，不提交。

## 流程

需要 Node.js 22、[LDraw 零件庫](https://library.ldraw.org/library/updates/complete.zip)（解壓後的 `ldraw/` 目錄）、[Rebrickable CSV](https://rebrickable.com/downloads/)（sets、inventories、inventory_parts、colors），以及 `playwright-core` 與一個 Chrome 執行檔（說明書與查價）。

```bash
cd assets/model-y-bricks/src
export LDRAW_DIR=/path/to/ldraw RB_DIR=/path/to/rebrickable-csv
export PLAYWRIGHT=/path/to/node_modules/playwright-core/index.mjs CHROME=/path/to/chrome

node availability.mjs                              # 現行零件表
node design.mjs ../model-y.ldr                     # 產生模型與組裝順序
node verify.mjs ../model-y.ldr --out ../verify-report
node mesh.mjs ../model-y.ldr ../model-y.mesh.json
node bom.mjs ../model-y.ldr                        # 零件清單、需求清單
node bricklink.mjs                                 # BrickLink 查價、重量、購物車方案（REUSE=1 重用上次抓的資料）
node bom.mjs ../model-y.ldr && node verify.mjs ../model-y.ldr --out ../verify-report   # 併入價格、用實際重量重算重心
node instructions.mjs                              # 零件縮圖與說明書 PDF
```

## 程式

- `ldraw.mjs`：解析 LDraw 檔、展開子檔，取出三角面、邊線與凸點原始檔位置。
- `parts.mjs`：零件幾何表。碰撞體多數由網格自動推導（包圍盒、側面輪廓凸包），軸磚、軸銷、輪子手工定義；`checkCoverage()` 確認碰撞體包住真實網格的每個取樣點。
- `geom.mjs`：世界座標幾何、凸點與科技接點配對、分離軸碰撞、沿插入方向的路徑檢查。
- `design.mjs`：車身以體素描形，拼砌器挑現行零件並錯開接縫；斜面、底盤、輪子手工放置；排程器替每個零件指定「往下壓」或「翻面往上插」後排出組裝順序。
- `verify.mjs`：只讀 `.ldr`，獨立重做全部檢查並輸出報告。
- `bricklink.mjs`：BrickLink 公開的價格指南與在售清單（全新、可寄台灣），以貪婪集合覆蓋挑店家，並遵守店家最低消費。

## 限制

- 碰撞以保守凸體判定：不會漏判，但可能比真實零件略嚴。互相插接的科技零件（軸銷、輪子）改以同軸與插入深度檢查。
- 沒有做結構強度或夾力分析；「裝得上」指每個零件沿單一方向能無碰撞地插到定位。
- 價格是查詢當天的在售價，不含運費與稅，賣家庫存隨時會變。
