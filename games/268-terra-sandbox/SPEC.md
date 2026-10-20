# SPEC — #268 TERRA

## 分層

- `src/core/`：規則層，不碰 DOM 與 three，瀏覽器與 Node 測試共用。
  - `math.js` 雜湊、雜訊、經緯度換算；`places.js` 地區類型 `KINDS`、精選地點 `PLACES`、導航目的地 `LANDMARKS`、`placeAt()`。
  - `world.js` `World`：地形、道路網格、`groundAt()`（路緣、拱橋、運河河床、滑板碗池）、`generateChunk(i, j)` 產生一塊向量圖磚（`transportation`／`building`／`water`／`park`／`landuse`／`poi` 圖層＋街道家具 `props`）；`LIFT`、`RUNS`、`SKATE` 是雪場與滑板公園的固定設施。
  - `stream.js` `ChunkStreamer`：依距離分 L0（<170 m）／L1（<400 m）／L2 三級，每次 `update()` 最多生成 6 塊、其餘排隊，LRU 快取（`Map` 插入順序）；`collideBuildings`、`raycastBuildings`。
  - `interior.js` `generateInterior(b, floor)`：以建物種子＋樓層做 BSP 分割（住宅、辦公、店面＋後場、門廳），牆段含門洞，依房型與店種擺家具；`collideInterior`。
  - `weather.js` `Weather`：全球雲量場（fbm）、會移動的鋒面／雷暴（含龍捲風）／颶風、強制天氣、太陽與月亮位置、縮時；`sample(lat, lon, elev)` 回傳在地天氣與附近系統的距離與方位。`WAVES`／`waveHeight` 由水面著色器與快艇共用。
  - `osm.js` 真實街道：`registerOsm(id, json)`／`osmData(id)` 解開 `tools/fetch-osm.mjs` 烘焙的資料（0.1 公尺整數差分、道路切成 ≤ 20 公尺小段並建空間格網）；`OsmWorld extends World` 介面相同（`terrain` 以三次 B 樣條內插 DEM、`groundAt`、`waterAt`、`roadAt`、`buildingAt`、`spawnPoint`、`generateChunk` 為 100 公尺見方圖磚）。矩形建物帶 `frame`（中心、方向、半寬半深），`localView(b)` 給外觀與室內用的局部版、`interiorView(b)` 是大樓臨街的室內單位，`toLocal`／`toWorldPt`／`toWorldDir` 互轉；不規則建物帶 `poly`、沒有門。
  - `traffic.js` 車流（車道、路口貝茲轉彎、30 秒號誌週期、跟車）與行人（繞街廓、過斑馬線）；`osmtraffic.js` `OsmTraffic` 介面相同，車沿 OSM 道路圖（路口切邊）行駛、號誌節點前停車，行人沿人行道走。
  - `lights.js` 房間燈光規則 `roomLightP(type, hour)`、`roomByte`、`roomLit(b, layout, i, hour)`：窗燈著色器與室內燈共用。
  - `player.js` 七種移動模式、吊椅、進出室內（真實街道在建物局部座標系生成室內再轉回世界）、接手車輛；事件放在 `p.events`。`shuttle.js` 太空梭的倒數、升空、分離、入軌、再入與滑翔。
  - `devlog.js` 每日進度與攝影選項；`selftest.js` 31 項自我測試（`tools/engine.test.mjs` 先讀 `data/osm/` 登錄，再包成 node:test）。
- `src/gfx/`：畫面層。
  - `geo.js` `Builder`：合併幾何（頂點色＋`atl` 圖集矩形屬性＋`wl` 窗燈屬性，`B.win(v, fn)` 標記 fn 裡加的頂點）；`atlas.js` 2048² 程序貼圖集與共用世界材質（重複貼圖、玻璃、雨濕、積雪、夜間窗燈、剖面切割 `uCutY`／`uCutBox`）。
  - `chunks.js` `buildChunk(W, chunk, lod, win)` → 地面／建物／家具／發光四個 Builder，加上路燈位置與號誌燈位置；`osmchunks.js` `buildOsmChunk` 是真實街道版（地面網格、道路與人行道帶狀面、路口圓盤、標線與斑馬線、運河岸壁、橋、矩形建物沿用 `buildBuilding` 再旋轉、多邊形建物擠出）。
  - `winlights.js` `WinLights`：1024² 資料貼圖（R 房間類型、G 房間亂數、B 窗戶亂數），近景圖磚的每棟建物依 `generateInterior` 每層的格局填入、圖磚丟掉時釋放；著色器以 `wl` 屬性（起點、每層欄數、欄位偏移、樓層偏移＋層數）查表，依 `uHour` 決定亮燈。
  - `character.js` 人物（`blender/out/people.glb`：Quaternius CC0 男女底模、換裝分區、髮型、UAL 動畫；玩家 `PlayerAvatar`、路人 `Crowd` 依編號換色換髮型）；`vehicles.js` 車款側面輪廓擠出、`TrafficRenderer`、單車、飛機、快艇、吊椅；`shuttle.js` 太空梭、外掛燃料箱與助推器、尾焰與煙柱；`earth.js` 高空的地球球面。
  - `sky.js` 天穹、卡通積雲、星空、極光、雨雪、遠方雷暴雲塔、颶風眼牆、龍捲風漏斗、閃電；`water.js` 水面；`interior.js` 室內網格；`renderer.js` 總管（每幀建網格預算、LOD 換檔、陰影跟隨、相機、後製）。
- `src/ui/map.js` 地球儀／平面地圖與小地圖；`src/main.js` 迴圈、輸入、HUD、面板、攝影模式與測試 API；`src/audio.js` WebAudio 合成。

## 真實街道資料（`data/osm/<id>.json`）

`{ v, id, lat, lon, half, sea, flat, skate, names, cats, nodes, sig, roads, bld, water, green, trees, lamps, pois, dem }`：座標是以 `lat/lon` 為原點的 0.1 公尺整數差分；`roads` 為 `[類別, 旗標（單行 1、橋 2）, 車道數, 寬（dm）, 名稱, 節點]`；`bld` 為 `[高（dm）, 底高, 樓層, 用途, 顏色, 名稱, 屋頂, 外框]`；`dem` 是 8 公尺間距、相對原點高度的 Int16 差分（base64）。打包時每個檔以 gzip＋base64 放進 `<script type="application/octet-stream" id="osm-<id>">`，頁面用 `DecompressionStream` 解開後才載入第一個地點。

## 座標與慣例

- 公尺；x 東、z 南、y 上。地點原點對應 `place.lat/lon`，`localToLatLon` 換算。
- 朝向 `yaw`：0 = 北（-z），前進向量 `(sin yaw, -cos yaw)`；three 的 `rotation.y = -yaw`。
- 網格類型的街廓：`x = i·PX` 為南北大道中心、`z = j·PZ` 為東西街中心；`blockRect` 是路緣到路緣，建地再往內退 `K.walk`。
- 真實街道的建物局部座標：`lx = dx·c + dz·s`、`lz = −dx·s + dz·c`（`c`、`s` 是 `frame.ang` 的餘弦正弦），局部北側（−z）是正面；畫面用 `rotation.y = −ang` 轉回世界。

## 驗收

`tools/accept.mjs`：1440×900 與 390×844；0 uncaught exception、0 console.error、0 外部請求、viewport meta、無水平溢出、自我測試全過、圖磚串流有內容；兩種尺寸都確認目前是真實街道；桌機走過紐約街景、紐約黃昏空拍、阿姆斯特丹運河（快艇）、滑板公園、雪場吊椅、太空梭升空與入軌、店內剖面、龍捲風、攝影模式、真實／程序街道切換、地圖等場景並截圖。
