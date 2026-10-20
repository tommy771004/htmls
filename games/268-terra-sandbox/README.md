# #268 TERRA · 地球尺度開放世界沙盒

依 @_chuckyc 的影片與提示詞製作：第三人稱的玩家（橘色上衣、深色長褲、背包掛滑板或雪板）走進一個以向量圖磚即時串流的世界。六個精選地點用**真實街道**：預先烘焙的 OpenStreetMap 建物、道路、水域、綠地、樹、路燈與店家，加上 Terrarium 高程；其餘地點（雪場、外海、地圖上任意落點）以同一套圖層格式程序生成。

打包後是單一 HTML（three 0.186.0、人物模型與街道資料都內嵌），不載入任何外部資源。玩家與路人是有骨架、會走路的人物模型（Quaternius CC0 底模與動畫，Blender 換裝），建物、車輛、太空梭、天空、雲與水面由程式建構。

## 地點

| id | 地點 | 街道 | 看點 |
| --- | --- | --- | --- |
| `nyc` | 紐約 · 中城 | OSM | 真實的中城街廓與高樓（OSM 高度／樓層）、水塔、黃色計程車、斑馬線、號誌、真實店名 |
| `ams` | 阿姆斯特丹 · 運河帶 | OSM | 真實運河與橋、山形牆磚屋、岸壁、船屋 |
| `sf` | 舊金山 · 俄羅斯山 | OSM＋高程 | 真實坡道（Terrarium 高程）、凸窗公寓、門前台階順著坡度、海灣 |
| `venice` | 洛杉磯 · 威尼斯海灘 | OSM＋高程 | 海濱步道與海灘、滑板公園（碗池、四分之一管、箱台、矮牆、扶手）、棕櫚樹 |
| `whistler` | 惠斯勒山 · 雪場 | 程序 | 吊椅纜車、藍線與紅線雪道、雪松、木屋 |
| `taipei` | 台北 · 信義區 | OSM＋高程 | 信義計畫區街廓與高樓 |
| `kirkwood` | 柯克伍德 · 密蘇里 | OSM＋高程 | 郊區住宅（龍捲風巷；OSM 只畫了部分房屋） |
| `atlantic` | 北大西洋 · 外海 | 程序 | 只能開船或飛機，貨櫃輪 |

地圖（M）上的任一點都能「落在這裡」：依 Natural Earth 1:110m 陸地輪廓、緯度與大城市清單選一種地區類型，以程序街區生成。設定面板的「真實街道」可關掉 OSM，六個地點改回程序街區（網址加 `?map=proc` 也一樣）。

真實街道的做法：

- 接近矩形的建物取最小外接矩形當局部座標系，正面朝最近的路，沿用程序建物的外觀、門、台階與室內；不規則的以多邊形擠出、不能進入。正面被隔壁擋住或離路太遠的不開門。大樓的室內只生成臨街的一個單位（16 × 16 公尺以內）。
- 車流沿 OSM 道路圖行駛（靠右、單行道只走順向、路口偏好直行），在有號誌的路口停紅燈；行人沿人行道走，到路口換一條路。
- 高程用三次 B 樣條內插（避免雙線性的格線折角），坡地上路面比人行道高一點、路面下的地面壓低，兩層各自細分時不會互相穿出。

夜間窗燈：近景建物的每一扇窗都對應到那一層室內生成的房間（店面、門廳、客廳、臥室、廚房、浴室、辦公室、樓梯間），房間類型決定幾點開燈與燈色，同一房間的窗一起亮；走進室內時用同一套規則決定哪些房間亮著。遠景建物依時刻的平均亮燈率。

## 操作

| 鍵 | 功能 |
| --- | --- |
| WASD／方向鍵 | 移動（滑板：W 推進、S 煞停、A/D 轉向；空中 A/D 翻板、S 轉板） |
| 拖曳／滾輪 | 轉視角／遠近 |
| Shift／C／空白 | 衝刺／蹲（空中抓板）／跳（滑板豚跳、扶手上跳磨桿） |
| E | 進店門（上樓梯時再按 E 上樓、C+E 下樓）、接手路上的車、搭吊椅纜車 |
| 1–7 | 步行、滑板（雪場是雪板）、單車、吉普車、螺旋槳飛機、快艇、太空梭（空白點火；入軌後 E 離軌，再入後滑翔降落） |
| R／F | 飛機油門 |
| V／P／M／H | 第一人稱／攝影模式／地圖與設定／隱藏 HUD |
| T／N | 縮時（1×–1000×）／切換天氣 |

觸控裝置有左下搖桿與跳、互動、蹲、衝刺按鈕。

## 指令

```bash
npm run build          # 打包成 ../../web/268-terra-sandbox.html（--dev 不壓縮）
npm run test:unit      # 31 項引擎自我測試（node:test；先讀 data/osm/ 登錄真實街道）
npm test               # 自我測試 + 兩種尺寸的無頭 Chrome 驗收，截圖到 dist/，縮圖到 ../../thumbs/268.jpg
node tools/accept.mjs ../../web/268-terra-sandbox.html skate   # 只跑名稱含 skate 的場景
node tools/shot.mjs out.png "T.goto('ams');;T.place(40,8,1.57);;wait 500"   # 除錯截圖（;; 分隔步驟）
node tools/fetch-land.mjs   # 重新下載並量化陸地輪廓到 src/land.js（需要網路）
npm run osm [id…] [--offline]   # 重抓 OSM（Overpass）與 Terrarium 高程 → data/osm/<id>.json；原始回應快取在 .cache/
npm run people              # Blender 5.x 重建人物模型 blender/out/people.glb（另需 gltfpack；素材包借 197 的 .cache/）
```

`data/osm/*.json` 與 `blender/out/people.glb` 有 commit，打包不需要網路或 Blender。

## `window.__terra` 測試 API

`ready`、`state()`、`goto(id, at?)`、`drop(lat, lon)`、`place(x, z, yaw)`、`mode(m)`、`cam(yaw, pitch, zoom)`、`time(h)`、`weather(id)`、`photo(on)`、`photoOpt(id, idx)`、`shoot()`、`overlay(tab|null)`、`enter()`（走到最近的店門口並進去）、`lift()`（到纜車站搭車）、`shuttle('pad'|'launch'|'orbit'|'reentry'|'advance', a?, b?)`、`realMap(on)`（切換真實／程序街道，回傳 `'osm'`／`'proc'`）、`hud(on)`、`quality('low'|'mid'|'high')`、`nav(id)`、`key(code, down)`、`tests()`；`state().map` 是目前的街道來源；`_r`／`_s` 是畫面層與狀態物件，只給除錯用。

## 已知限制

- 真實街道只涵蓋六個精選地點原點周圍約 1.5 公里見方（`tools/fetch-osm.mjs` 的 `half`），範圍外只有地形；其餘地點仍是程序生成。建物外觀（材質、窗型）依地區風格生成，不是真實立面。
- OSM 的覆蓋度不一：柯克伍德只畫了部分房屋；威尼斯滑板公園在 OSM 沒有畫成面，用固定位置放程序滑板場。
- 天氣系統與太陽位置用真實經緯度計算，但只在玩家附近畫出 3D 雲與風暴，地圖上的雲量場是同一份資料的取樣。
- 室內只在玩家進入時生成，牆只做到 3.2 公尺高，方便從上方以剖面視角觀看。

## 素材與資料來源

- 街道：© OpenStreetMap 貢獻者，ODbL 1.0（頁面右下角與設定面板標示）。
- 高程：Terrarium 格式的 AWS Terrain Tiles（Mapzen；來源含 SRTM、USGS 3DEP 等公有資料）。
- 人物：Quaternius「Universal Base Characters」與「Universal Animation Library」，CC0。
- 陸地輪廓：Natural Earth 1:110m，公有領域。
