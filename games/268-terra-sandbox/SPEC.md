# SPEC — #268 TERRA

## 分層

- `src/core/`：規則層，不碰 DOM 與 three，瀏覽器與 Node 測試共用。
  - `math.js` 雜湊、雜訊、經緯度換算；`places.js` 地區類型 `KINDS`、精選地點 `PLACES`、導航目的地 `LANDMARKS`、`placeAt()`。
  - `world.js` `World`：地形、道路網格、`groundAt()`（路緣、拱橋、運河河床、滑板碗池）、`generateChunk(i, j)` 產生一塊向量圖磚（`transportation`／`building`／`water`／`park`／`landuse`／`poi` 圖層＋街道家具 `props`）；`LIFT`、`RUNS`、`SKATE` 是雪場與滑板公園的固定設施。
  - `stream.js` `ChunkStreamer`：依距離分 L0（<170 m）／L1（<400 m）／L2 三級，每次 `update()` 最多生成 6 塊、其餘排隊，LRU 快取（`Map` 插入順序）；`collideBuildings`、`raycastBuildings`。
  - `interior.js` `generateInterior(b, floor)`：以建物種子＋樓層做 BSP 分割（住宅、辦公、店面＋後場、門廳），牆段含門洞，依房型與店種擺家具；`collideInterior`。
  - `weather.js` `Weather`：全球雲量場（fbm）、會移動的鋒面／雷暴（含龍捲風）／颶風、強制天氣、太陽與月亮位置、縮時；`sample(lat, lon, elev)` 回傳在地天氣與附近系統的距離與方位。`WAVES`／`waveHeight` 由水面著色器與快艇共用。
  - `traffic.js` 車流（車道、路口貝茲轉彎、30 秒號誌週期、跟車）與行人（繞街廓、過斑馬線）。
  - `player.js` 六種移動模式、吊椅、進出室內、接手車輛；事件放在 `p.events`。
  - `devlog.js` 每日進度與攝影選項；`selftest.js` 24 項自我測試（`tools/engine.test.mjs` 包成 node:test）。
- `src/gfx/`：畫面層。
  - `geo.js` `Builder`：合併幾何（頂點色＋`atl` 圖集矩形屬性）；`atlas.js` 2048² 程序貼圖集與共用世界材質（重複貼圖、玻璃、雨濕、積雪、夜間窗燈、剖面切割 `uCutY`／`uCutBox`）。
  - `chunks.js` `buildChunk(W, chunk, lod)` → 地面／建物／家具／發光四個 Builder，加上路燈位置與號誌燈位置。
  - `character.js` 木偶人骨架與程序動作（玩家 `PlayerAvatar`、路人 `Crowd` 以 InstancedMesh 一次畫完）；`vehicles.js` 車款側面輪廓擠出、`TrafficRenderer`、單車、飛機、快艇、吊椅。
  - `sky.js` 天穹、卡通積雲、星空、極光、雨雪、遠方雷暴雲塔、颶風眼牆、龍捲風漏斗、閃電；`water.js` 水面；`interior.js` 室內網格；`renderer.js` 總管（每幀建網格預算、LOD 換檔、陰影跟隨、相機、後製）。
- `src/ui/map.js` 地球儀／平面地圖與小地圖；`src/main.js` 迴圈、輸入、HUD、面板、攝影模式與測試 API；`src/audio.js` WebAudio 合成。

## 座標與慣例

- 公尺；x 東、z 南、y 上。地點原點對應 `place.lat/lon`，`localToLatLon` 換算。
- 朝向 `yaw`：0 = 北（-z），前進向量 `(sin yaw, -cos yaw)`；three 的 `rotation.y = -yaw`。
- 網格類型的街廓：`x = i·PX` 為南北大道中心、`z = j·PZ` 為東西街中心；`blockRect` 是路緣到路緣，建地再往內退 `K.walk`。

## 驗收

`tools/accept.mjs`：1440×900 與 390×844；0 uncaught exception、0 console.error、0 外部請求、viewport meta、無水平溢出、自我測試全過、圖磚串流有內容；桌機走過紐約街景、紐約黃昏空拍、阿姆斯特丹、滑板公園、雪場吊椅、店內剖面、龍捲風、攝影模式、地圖九個場景並截圖。
