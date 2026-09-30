# blender/：賽道與模型產生器

四條賽道、卡車與場邊擺設全部由這裡的 Blender 腳本產生，匯出成 SPEC §3、§4 的二進位格式。`out/` 是產出結果，要一起 commit。

## 重新產生

```bash
# 在 games/195-sidewinder/ 下（Blender 5.2，headless）
blender -b --factory-startup --python blender/build_all.py -- --out blender/out
node blender/check.mjs          # 驗證全部匯出檔，失敗時 exit 1
```

`-- --tracks 0,2` 只重建指定賽道（不重寫 `manifest.json`）。整套約 3 秒，結果是決定性的（同樣的腳本產生逐位元相同的檔案）。

## 檔案

| 檔案 | 內容 |
|---|---|
| `common.py` | 常數（網格 145×97、0.5 m、原點 (−36, −24)）、座標轉換 `game = (bx, bz, −by)`、雜訊（value / fbm / Worley）、SWTK / SWMS 寫出 |
| `tracks.py` | 四條賽道定義與產生器（純 numpy）：中心線、地面種類、高度、path、發車格、道具點、擺設、地面貼圖顏色 |
| `trucks.py` | 卡車車身（外殼加鏡射＋倒角修改器）與輪胎（旋轉剖面＋擠出胎紋塊） |
| `props.py` | mesh 2..12：輪胎堆、乾草捆、油桶、看台、燈塔、旗桿、仙人掌、拱門、圍欄、氮氣瓶、錢袋 |
| `meshkit.py` | bmesh 小工具（盒子、方柱、旋轉體、合併）；顏色走材質自訂屬性 `sw_srgb` / `sw_alpha` |
| `build_all.py` | 入口：建出 Blender 物件，從評估後的網格匯出 SWMS，以 bmesh 建地形網格並讀回高度寫 SWTK，用 `bpy.data.images` 存貼圖，匯出 glb |
| `check.mjs` | 重新讀取所有匯出檔並驗證（見下） |

## 產出（`out/`）

- `meshes.bin`：SWMS，13 個 mesh，順序同 SPEC 表格。平面著色（每個角點法線＝面法線）；alpha 只有 255 / 0（塗裝）/ 128（玻璃、車燈）。三角形繞序從外側看為逆時針（與 WebGL 預設相同）。
- `track_N.bin`：SWTK。`track_N.jpg`：地面貼圖 576×384（每公尺 8 px，RGB JPEG 品質 88；先以每公尺 16 px 算色再 2×2 平均，地面種類交界不會有階梯鋸齒）。**第 0 列是北（z = origin_z）、第 0 欄是 x = origin_x**，像素中心在 origin + (u + 0.5) / 8。`track_N_check.png`：同一份貼圖縮成每公尺 2 px（144×96，一格一像素），只給 `check.mjs` 驗顏色方向，不內嵌進網頁。
- `track_N.glb`、`trucks.glb`、`props.glb`：給人檢查用（Draco 壓縮），不內嵌進網頁。`manifest.json`：數量與大小摘要。

## 賽道約定

- 四條：0 響尾蛇峽 Sidewinder Gulch（四道 S 形折返）、1 乾河床 Dry Wash（上方凹入 U 彎、下方 34 m 長淺水河床）、2 泥沼盆地 Mudflat Basin（V 形凹口、五處泥地、路寬 8 m）、3 鐵砧台地 Anvil Mesa（中央台地、四座跳台＋桌台＋連續小丘）。二進位檔名只放英文名。
- 路面半寬 3.6 m（2 號 4.0 m），兩側各 0.8 m 鬆土路肩（LOOSE），部分彎道外側再有可通行的 INFIELD 草地；其餘全是 WALL（含內場，外框 2 格強制 WALL）。path 的 `half_width` 是夯實路面半寬（不含路肩）。
- 高度只隨弧長變化（橫向常數，跳台上不會側傾）；跳台 = 3.5–4.5 m 上坡後在 0.5 m 內落回；貼路面的第一圈牆格高度 = 旁邊路面，往外才隆起成土堤。
- 行車方向（從上往下看，北在上）：0 起點在下方車道往東、整體逆時針；1 起點在右側往北、逆時針；2、3 起點在上方車道往東、順時針。
- path 每 ~1.75 m 一點，index 0 在起終點線；flags：JUMP / RAMP 依地面標記，WATER / MUD 為該點 1.5 m 內有水坑／泥地，第 k·n/6（k = 1..5）點為檢查點（index 0 本身不標）。
- 發車格在起點線後 3.5 / 5 / 8.5 / 10 m、左右 ±1.8 m 交錯，0 號（玩家）在第一個彎的內側。
- 擺設 yaw 與卡車同一約定（前方 = (cos yaw, 0, sin yaw)，模型 +X 為前）；牆邊擺設 +X 沿牆方向，看台與燈塔 +X 面向賽道。所有擺設都在 WALL 格上（拱門跨在 path[0]，模型兩柱在 ±5.3 m，縮放 = (路面半寬 + 路肩 + 0.75) / 5.3）。
- 鏡頭提示 8 個 f32：`target x, y, z`（場地中心，y 為路面平均高）、`yaw = −π/2`（鏡頭從南往北看）、`pitch = 0.95`（俯角，弧度）、`fit_w = 72`、`fit_h = 48`（要放進畫面的世界範圍）、保留 0。

## check.mjs 驗證項目

SWMS / SWTK 的 magic、版本、數量與檔案長度逐位元對上；mesh 名稱順序、bbox、法線長度、alpha 值、索引範圍、三角形預算（車身 600–1500、輪胎 200–400）、輪胎半徑 0.42、車身不侵入輪子；meshes.bin < 600 KB。每條賽道：path 封閉且間距 1–2.5 m、中心與 ±half_width 都在可通行格；發車格在起點線後方、朝向對、彼此 ≥ 2.5 m；從 0 號發車格做 4 連通淹沒填充，要涵蓋所有 path、發車格與道具點，且外框上沒有任何可通行格；可達格離中心線不超過 half_width + 4 m、相鄰可達格不會分屬兩條車道（牆沒被打穿）、沒有只以對角相接或只有一格厚的牆、拱門兩柱落在牆格上；貼路面的牆格高度落差；地面貼圖 JPEG 尺寸、< 120 KB，並用檢查用小 PNG 以各地面種類的平均色確認貼圖方向沒顛倒；glb 標頭。
