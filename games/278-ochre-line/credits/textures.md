# 貼圖與天空來源

全部來自 [Poly Haven](https://polyhaven.com/)，授權 CC0。此檔由 `tools/fetch-textures.mjs` 產生，要改請改該工具的 `SLOTS`。

## 貼圖（`assets/278/tex/<名稱>_{a,n,orm}.webp`）

「實際尺寸」是一張貼圖對應的真實公尺數，世界座標 UV 要依此縮放。

| 名稱 | 用途 | Poly Haven 素材 | 作者 | 實際尺寸 | 邊長 | 選擇理由 |
| --- | --- | --- | --- | --- | --- | --- |
| `sandstone` | 暖色砂岩牆 | [Sandstone Blocks 05](https://polyhaven.com/a/sandstone_blocks_05)（`sandstone_blocks_05`） | Rob Tuytel | 3 × 3 m | 1024 | 整層砌石，亮面偏奶油色，最接近 key.jpg 角石與牆腳 |
| `plaster` | 剝落灰泥牆 | [Damaged Plaster](https://polyhaven.com/a/damaged_plaster)（`damaged_plaster`） | Amal Kumar | 1.85 × 1.85 m | 1024 | 灰泥塊狀剝落露出磚石，平均色相 30° 與 key.jpg 牆面相同 |
| `whitewash` | 曝曬白灰泥 | [White Rough Plaster](https://polyhaven.com/a/white_rough_plaster)（`white_rough_plaster`） | Rob Tuytel | 1 × 1 m | 1024 | 白灰層龜裂剝落，色相近中性；實際 1 m，大牆建議放大到 2.5 m 左右再貼 |
| `ashlar` | 方整石塊（城門、基座） | [White Sandstone Blocks 02](https://polyhaven.com/a/white_sandstone_blocks_02)（`white_sandstone_blocks_02`） | Rob Tuytel | 2 × 2 m | 1024 | 淺色整層石塊，石緣圓鈍有真實起伏，像 key.jpg 左下的牆基；sandstone_blocks_08 顏色也對但法線幾乎全平 |
| `brick` | 老磚 | [Brick Wall 02](https://polyhaven.com/a/brick_wall_02)（`brick_wall_02`） | Dimitrios Savva | 2 × 2 m | 1024 | 暖色磚配淺色灰縫，比紅磚更貼近赭色主調 |
| `flag` | 不規則石板地 | [Stone Pathway](https://polyhaven.com/a/stone_pathway)（`stone_pathway`） | Amal Kumar | 2 × 2 m | 1024 | 不規則暖色石板，排列最像 key.jpg 地面；albedo 調色：提亮 ×1.3、飽和 ×0.8、色相 +4° |
| `cobble` | 卵石地 | [Cobblestone Floor 01](https://polyhaven.com/a/cobblestone_floor_01)（`cobblestone_floor_01`） | Rob Tuytel | 1 × 1 m | 1024 | 暖灰方卵石，沒有長草 |
| `sand` | 砂土 | [Dense Sand](https://polyhaven.com/a/dense_sand)（`dense_sand`） | Dimitrios Savva | 1.8 × 1.8 m | 1024 | 淺褐夯實砂土，比 dirt_floor 的橘色更接近 key.jpg 的塵土色 |
| `tile` | 褪色彩磚 | [Marble Mosaic Tiles](https://polyhaven.com/a/marble_mosaic_tiles)（`marble_mosaic_tiles`） | Amal Kumar | 2 × 2 m | 1024 | Poly Haven 沒有彩繪花磚，這張赭底碎石馬賽克的褪色感最接近 |
| `wood` | 風化木板（木箱） | [Brown Planks 03](https://polyhaven.com/a/brown_planks_03)（`brown_planks_03`） | Rob Tuytel | 1 × 1 m | 512 | 灰褐曝曬感最明顯；板條為垂直方向 |
| `woodpaint` | 剝漆藍木門 | [Blue Painted Planks](https://polyhaven.com/a/blue_painted_planks)（`blue_painted_planks`） | Rob Tuytel | 1 × 1 m | 512 | 色相 182° 接近 key.jpg 門板；板條為水平方向，做門時 UV 要轉 90° |
| `metal` | 鏽鐵 | [Rusty Metal 05](https://polyhaven.com/a/rusty_metal_05)（`rusty_metal_05`） | Amal Kumar | 1.25 × 1.25 m | 512 | 大面積片狀鏽，帶殘留漆色 |
| `military` | 軍綠漆鋼板 | [Green Metal Rust](https://polyhaven.com/a/green_metal_rust)（`green_metal_rust`） | Rob Tuytel | 1 × 1 m | 512 | 唯一帶刮痕的綠漆鋼板；albedo 調色：色相 -22°、飽和 ×0.85 |
| `canvas` | 粗帆布 | [Hessian 380](https://polyhaven.com/a/hessian_380)（`hessian_380`） | colormass、Rico Cilliers | 0.27 × 0.27 m | 512 | 密織無鏤空（hessian_230 是網眼）；實際只有 27 cm，UV 要依此縮放；原檔 metal 通道非零，已清為 0 |

- `_n` 是 Poly Haven 的 `nor_gl`（OpenGL，Y+）。
- `_orm` 是 Poly Haven 的 `arm`：R=AO、G=rough、B=metal，通道順序未改動（`canvas` 的 metal 清為 0）。
- `flag`、`military` 的 albedo 有調色（數值見選擇理由），其餘都是原色。

## 天空（`assets/278/sky/`）

| 檔案 | Poly Haven 素材 | 作者 | 處理 |
| --- | --- | --- | --- |
| `env.hdr` | [Qwantani Noon (Pure Sky)](https://polyhaven.com/a/qwantani_noon_puresky)（`qwantani_noon_puresky`） | Greg Zaal、Jarod Guest | 2k 降到 1024×512，移除半徑 3° 的太陽盤 |
| `sky.webp` | 同上 | 同上 | 2048×1024，tonemap 並對色到 `ref/targets.json` 的 sky |

萬里無雲、天空偏淡，太陽仰角實測 49.8°，符合 key.jpg 約 50° 的斜射。
