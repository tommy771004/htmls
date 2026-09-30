# 195 響尾蛇越野 · SIDEWINDER：規格與介面契約

致敬 1989 年街機《Ironman Ivan Stewart's Super Off-Road》的俯視角越野卡車賽。整條賽道一個畫面放得下（街機式固定鏡頭），四台卡車同場，比完拿獎金到車庫升級，再跑下一條。

這份文件是各模組之間的**契約**。改了介面就要同時改這裡。

## 0. 使用者需求（驗收對照）

1. 核心用 Rust 編成 WASM（`core/`，`wasm32-unknown-unknown`，不用 wasm-bindgen），前端 WebGL2 渲染、Canvas 2D 畫 HUD 與備援畫面。
2. 4 台卡車同場；泥地、跳台、水坑與坡道影響抓地與速度；對手 AI 會卡位（擋玩家的路線）。
3. 每場結束可用獎金升級輪胎、引擎、避震與氮氣。
4. 賽道與卡車模型由 Blender 腳本產生並匯出（`blender/`，headless 執行）。
5. 支援鍵盤、手把（Gamepad API），以及 USB 街機旋轉方向盤（旋轉編碼器當滑鼠用：Pointer Lock 後把滑鼠 X 軸位移映射成轉向）。
6. 預留背景音樂與音效掛點（預設以 WebAudio 即時合成）；可部署到 Cloudflare Pages（`--out=dist` + `wrangler.toml` + `_headers`，不自動部署）。

網站規則：輸出單檔 `web/195-sidewinder.html`，**不載入任何外部資源**（不用 Google Fonts、不用 CDN；只用系統字），所有資產以 base64 內嵌；1440×900 與 390×844 不得有 uncaught exception、`console.error`、外部請求、水平溢出，要有 viewport meta。

## 1. 目錄

```
games/195-sidewinder/
  SPEC.md  README.md  package.json  wrangler.toml
  core/                 Rust crate（cdylib），cargo test 可在原生目標跑
  blender/              build_all.py 等 Blender 腳本；out/ 為匯出結果（commit）
  src/                  前端 JS（esbuild 打包）與 index.html 樣板
  tools/                build.mjs、playtest.mjs、shot.mjs、check-assets.mjs
  public/_headers       Cloudflare Pages 標頭（build --out=dist 時複製）
```

## 2. 座標與單位

- 公尺、秒、弧度。遊戲世界 **Y 朝上**；X 朝東（畫面右），Z 朝南（畫面下方，靠近鏡頭）。
- Blender 是 Z 朝上：匯出時 `game = (bx, bz, -by)`。所有匯出檔都已經是遊戲座標。
- 朝向 `yaw`：前進方向 = `(cos yaw, 0, sin yaw)`。yaw 增加 = 從上往下看**順時針**轉（因為 Z 朝下）。`steer = +1` 代表向右轉（yaw 增加）。
- 場地約 72 m × 48 m（依賽道檔頭為準），卡車長約 2.5 m、寬約 1.7 m。

## 3. 賽道檔 SWTK v1（`blender/out/track_N.bin`，N = 0..3，小端序）

| 位移 | 型別 | 內容 |
|---|---|---|
| 0 | char[4] | `SWTK` |
| 4 | u16 | version = 1 |
| 6 | u16 | track_id |
| 8 | u16 | gw（X 方向取樣點數） |
| 10 | u16 | gh（Z 方向取樣點數） |
| 12 | f32 | cell（取樣間距，公尺，0.5） |
| 16 | f32 | origin_x（取樣點 (0,0) 的世界 X） |
| 20 | f32 | origin_z |
| 24 | u16 | n_path |
| 26 | u16 | n_pickup |
| 28 | u16 | n_props |
| 30 | u16 | laps（建議圈數，4） |
| 32 | f32[8] | 鏡頭提示：target x, y, z, yaw, pitch, fit_w, fit_h, 保留 |
| 64 | char[32] | 賽道名（UTF-8，0 補齊） |
| 96 | i16[gw*gh] | 高度（公分），列優先：index = j*gw + i，世界位置 (origin_x + i*cell, origin_z + j*cell) |
| … | u8[gw*gh] | 地面種類（同索引） |
| … | 補 0 到 4 的倍數 | |
| … | path[n_path] | 每點 f32 x, f32 z, f32 half_width, u32 flags。依行車方向排列的封閉迴圈，index 0 在起終點線 |
| … | start[4] | 每格 f32 x, f32 z, f32 yaw, f32 0（發車格，index 0 給玩家） |
| … | pickup[n_pickup] | 每點 f32 x, f32 z（氮氣／獎金道具的可能出現點） |
| … | prop[n_props] | u16 mesh_id, u16 0, f32 x, f32 y, f32 z, f32 yaw, f32 scale |

地面種類 enum（Rust、JS、Blender 共用）：

| 值 | 名稱 | 物理 |
|---|---|---|
| 0 | DIRT | 壓實泥土路面，基準抓地 |
| 1 | LOOSE | 鬆土／沙，抓地稍低、阻力稍高 |
| 2 | MUD | 泥地：抓地低、阻力高、容易甩尾 |
| 3 | WATER | 水坑：強阻力、濺水、抓地低 |
| 4 | JUMP | 跳台坡面（高度場本身已經有坡；此標記給 AI 與音效） |
| 5 | RAMP | 長坡道（上坡減速、下坡加速由高度場決定；此標記給 AI） |
| 6 | WALL | 牆、輪胎堆、土堤：不可通行，碰撞反彈 |
| 7 | INFIELD | 內場草地：可通行但很慢 |

path flags：bit0 跳台區、bit1 水坑、bit2 泥地、bit3 檢查點、bit4 坡道。

## 4. 模型檔 SWMS v1（`blender/out/meshes.bin`）

```
char[4] "SWMS", u16 version=1, u16 n_meshes
每個 mesh：
  char[16] name（0 補齊）, u32 nverts, u32 nindices, f32 bbox[6]（minx,miny,minz,maxx,maxy,maxz）
  f32 pos[3*nverts]
  i8  normal[4*nverts]（xyz * 127，第 4 位為 0）
  u8  color[4*nverts]（rgb 線性前的 sRGB；a：255 = 一般，0 = 車隊塗裝（渲染時用車色乘上 rgb 亮度），128 = 玻璃／車燈，自發光一點）
  u16 index[nindices]，之後補 0 到 4 的倍數
```

mesh 順序固定（prop 的 mesh_id 就是這個索引）：

| id | name | 說明 |
|---|---|---|
| 0 | truck_body | 卡車車身（不含輪子），原點在底盤中心、車軸高度；前方 +X、上方 +Y |
| 1 | wheel | 單顆輪胎＋輪框，原點在輪心，輪軸沿 Z |
| 2 | tire_stack | 輪胎堆（牆邊） |
| 3 | hay_bale | 乾草捆 |
| 4 | barrel | 油桶 |
| 5 | grandstand | 看台（含簡化觀眾） |
| 6 | floodlight | 照明燈塔 |
| 7 | flag_pole | 旗桿（旗子為塗裝色） |
| 8 | cactus | 仙人掌 |
| 9 | start_arch | 起終點拱門 |
| 10 | fence | 一段圍欄 |
| 11 | pickup_nitro | 氮氣瓶道具 |
| 12 | pickup_money | 錢袋道具 |

卡車固定幾何（Rust 物理與 JS 渲染共用）：前軸 x = +0.85、後軸 x = −0.85、輪距半寬 z = ±0.78、輪半徑 0.42。碰撞：卡車互撞用長 2.84 × 寬 1.72 的有向矩形（分離軸測試；對齊 `truck_body` 的保險桿 ±1.44、車側 ±0.87，畫面上不會互相陷進去）；撞牆用兩個半徑 0.85 的圓（圓心 x = ±0.45）。

地面貼圖：`blender/out/track_N.jpg`，覆蓋與高度場相同的範圍，每公尺 8 px（576×384，sRGB，JPEG 品質 88），由 Blender 腳本依地面種類加雜訊著色：先以每公尺 16 px 算色再 2×2 平均（超取樣），地面種類交界不會有階梯鋸齒。第 0 列是北（z = origin_z）、第 0 欄是 x = origin_x。另存 `track_N_check.png`（每公尺 2 px，一格一像素），只給 `blender/check.mjs` 驗顏色方向，不內嵌。JS 依高度場在 0.5 m 網格建地形網格並貼上這張圖。

另外匯出 `blender/out/track_N.glb`、`blender/out/trucks.glb` 給人檢查（不內嵌進網頁）。

## 5. WASM ABI（`core/`，全部 `#[unsafe(no_mangle)] pub extern "C"`）

| 函式 | 說明 |
|---|---|
| `sw_alloc(len: u32) -> *mut u8` | 配置一塊記憶體給 JS 寫入賽道檔 |
| `sw_load_track(ptr: *const u8, len: u32) -> i32` | 解析 SWTK；0 成功，負數錯誤碼 |
| `sw_set_truck(i: u32, is_ai: u32, tires: u32, engine: u32, shocks: u32, nitro: u32, skill: f32)` | 設定卡車（升級等級 0..5；skill 0..1 只對 AI 有效） |
| `sw_race_start(seed: u32, laps: u32)` | 放到發車格，進入 3 秒倒數 |
| `sw_set_input(i: u32, steer: f32, throttle: f32, brake: f32, nitro: u32)` | steer −1..1（+1 向右）；throttle／brake 0..1；nitro 1 = 這一步按下（邊緣觸發由 core 處理） |
| `sw_step(dt: f32)` | 前進一步；JS 以固定 1/120 s 呼叫，core 內部夾住 dt ≤ 1/30 |
| `sw_state_ptr() -> *const f32`、`sw_state_len() -> u32` | 狀態陣列（見下） |
| `sw_events_ptr() -> *const f32`、`sw_events_count() -> u32`、`sw_events_clear()` | 事件佇列，每筆 4 個 f32：type, truck, a, b |
| `sw_upgrade_stat(kind: u32, level: u32) -> f32` | 升級效果數值（給商店顯示，kind 0 輪胎抓地倍率、1 引擎極速 m/s、2 避震的落地／顛簸恢復秒數（1.00 → 0.20）、3 氮氣瓶數） |

JS 每次讀取前都要重新建立 `new Float32Array(memory.buffer, ptr, len)`（記憶體可能成長）。

### 狀態陣列（f32）

表頭 16 格：0 phase（0 閒置、1 倒數、2 比賽中、3 結束）、1 比賽時間、2 倒數剩餘秒、3 總圈數、4 卡車數（4）、5 道具數（8）、6 玩家名次（未完賽為 0）、7 track_id、8 領先者圈數、9 玩家（第 0 台）本圈起算的比賽時間（第 1 圈從第一次過起終點線才開始計；上線前為 −1。HUD 的本圈碼錶 = 比賽時間 − 這格）、10..15 保留。

卡車 4 台，每台 32 格，從索引 16 開始（第 k 台在 16 + 32k）：

| 位移 | 內容 |
|---|---|
| 0,1,2 | x, y, z（車身原點） |
| 3,4,5 | yaw, pitch, roll |
| 6 | 速度（m/s，前進為正） |
| 7 | 目前前輪轉角（−1..1） |
| 8 | 輪子累計轉角（弧度） |
| 9..12 | 懸吊壓縮 FL, FR, RL, RR（公尺，壓縮為正） |
| 13 | 已完成圈數 |
| 14 | 本圈進度 0..1 |
| 15 | 名次 1..4 |
| 16 | 腳下地面種類 |
| 17 | 滯空（0／1） |
| 18 | 剩餘氮氣瓶 |
| 19 | 氮氣剩餘噴射秒數（> 0 表示噴射中） |
| 20 | 完賽（0／1） |
| 21 | 完賽時間 |
| 22 | 最佳單圈 |
| 23 | 上一圈 |
| 24 | 本場撿到的獎金 |
| 25 | 引擎轉速 0..1（給音效） |
| 26 | 側滑量 0..1（給胎痕、音效） |
| 27 | 垂直速度 |
| 28 | 是否 AI |
| 29 | AI 模式（0 跑線、1 卡位、2 脫困） |
| 30 | 沾泥／濕度 0..1（給車身變色） |
| 31 | 時限到而結束（DNF；格 20 同時為 1，前端不算完賽） |

道具 8 個，從索引 144 開始，每個 4 格：x, z, type（0 無、1 氮氣、2 獎金）, active（0／1）。總長 176。

### 事件 type

1 倒數嗶聲（a = 3,2,1；a = 3 由 `sw_race_start` 放進佇列，JS 要在呼叫它**之前**清佇列）、2 起跑、3 起跳、4 落地（a = 衝擊 0..1）、5 濺水（a = 速度）、6 進入泥地、7 卡車互撞（a = 衝量 0..1, b = 另一台）、8 撞牆（a = 衝量 0..1）、9 氮氣啟動、10 撿到道具（a = type, b = 金額）、11 完成一圈（a = 圈數）、12 完賽（a = 名次）、13 最後一圈、14 超車（a = 新名次）、15 逆向（a = 1：車頭方向和路線切線夾角 > 120°、前進速度 > 3 m/s 持續 1 秒，倒車不算；a = 0：車頭轉回、往前開 0.5 秒後解除）。

## 6. 玩法與物理（core 的責任）

- 地面：車輪取樣高度場（雙線性內插）；接地時車身高度與 pitch／roll 由四個輪子的地面高度決定，懸吊以彈簧阻尼平滑。
- 跳台：接地時若地面下降得比重力能跟上的還快，就離地，保留垂直速度；滯空時不能轉向加速（可微幅修正 yaw），車頭 pitch 以彈簧追飛行路徑角（0.7 × atan(vy / 水平速度)，夾在 ±0.4），上升抬頭、下降壓低，大致平著落地（±0.9 的夾限只是安全網）；落地衝擊依垂直速度，避震等級越高恢復越快、掉速越少。
- 顛簸：貼地時地面垂直速度一步（1/120 s）內的變化量（坡面轉折、搓板路、土包）取指數平均當「路面震動」，超過門檻的部分折成極速、加速與側向抓地的折扣（最多約 35%），單步的大衝擊另外直接掉速；避震每級吸收 17%（5 級只剩 15%）。
- 坡道：沿坡度的重力分量加減速。
- 地面種類影響抓地（側向摩擦上限）、滾動阻力、極速上限；泥地與水坑讓車身「沾泥」值上升。
- 牆：WALL 格子不可進入，碰撞時沿法線反彈並掉速，產生事件 8。
- 卡車互撞：圓形近似的衝量交換，產生事件 7。
- 氮氣：每瓶噴射 1.6 秒，推力大幅增加、極速上限提高。
- 道具：比賽中隨機在 pickup 點出現氮氣瓶或錢袋，撿到加到該車（錢袋 $10 000–$40 000）。
- 圈數與名次：依 path 的累計進度（圈數 + 本圈進度）排名；必須依序通過檢查點才算一圈，防止抄捷徑或倒著跑。
- AI：沿 path 的前瞻點開，依 skill 決定路線誤差、煞車點與用氮氣時機；賽道解析時沿中心線高度剖面找出「起跳點」（會離地的凸折點），AI 依預測的飛行距離（撞牆與否、落地掉速、落地後剩下的煞車距離，泥地／水坑煞車打折）算出每個起跳點的安全起跳速度，飛行中不能煞車，所以在起跳前就減到這個速度，需要減速的起跳點前不放氮氣；**卡位**：玩家在後方 12 m 內、且在 AI 的路線附近時，AI 把橫向偏移移向玩家的路線（被超車前擋線），有冷卻時間，不會一直擋；卡住（速度很低超過 1.5 秒）時倒車脫困；有溫和的追趕平衡。
- 完賽：領先者完賽後其他車最多再跑 20 秒，未完賽依進度排名。
- 決定性：同樣的 seed、輸入與 dt 產生同樣的結果；不用系統時間與外部亂數（xorshift32）。

升級（等級 0..5，由 core 決定數值）：輪胎 = 抓地、引擎 = 加速與極速、避震 = 跳台落地掉速（撞擊 1.0 時 lvl0 掉 40%、lvl5 掉 7%）與落地後抓地／加速恢復時間（1.0 → 0.2 秒），以及上面的顛簸折扣、氮氣 = 每場起始氮氣瓶數（3 + 等級）。避震在跳台多、路面顛簸的賽道差得多（實測滿級快 0–6 秒，輪胎、引擎約 4–6 秒），商店價格打 7 折。

## 7. 前端（`src/`）

- `window.Sidewinder`：頁面一載入就存在（含 `version` 與 `ready`：開機完成後 resolve 的 Promise），開機完成後補上 `audio`、`input`，並在 window 送出 `sidewinder:ready` 事件（detail 為同一個物件）。
- `window.__sw`：測試用 API（`state()`、`startRace(trackId, opts)`、`fastForward(sec)`、`buy(kind)`、`career()`、`input`（含 `spinner.feed(dx)`）、`audio`）。
- 畫面流程：標題（背景跑 4 台 AI 的示範賽）→ 賽道介紹 → 倒數 → 比賽 → 結果（名次、獎金）→ 車庫升級 → 下一條賽道。四條賽道一季，之後難度提高重新開始。對手技巧每站上升；改裝約每季每項 +1 級，而且夾在玩家平均改裝等級的 −1..+1 級之間。進度存 localStorage（try/catch，存不了也能玩）。
- 暫停：比賽中按 Esc／P、手把 Start、分頁隱藏或視窗失去焦點，以及旋轉方向盤的 Pointer Lock 在比賽中失去時，都會自動暫停。暫停時音樂沿用比賽曲目，引擎、打滑、氮氣等持續音停止。
- 鏡頭：固定、整條賽道在畫面內、從南方斜上方俯視（街機式）。直式手機：賽道縮放在上方，觸控按鈕在下方，不得水平溢出。
- 輸入：統一成 `{steer, throttle, brake, nitro}`。鍵盤（方向鍵／WASD、空白鍵或 Shift 氮氣）、Gamepad（左搖桿／十字鍵轉向、RT／A 油門、LT／B 煞車、X／RB 氮氣；比賽中 B 只當煞車，暫停只用 Start）、旋轉方向盤（Pointer Lock 後累積 `movementX`，模式：「速率」＝轉得越快轉向越大、「位置」＝累積角度並自動回中；靈敏度、反向可調，設定頁有即時指示；在設定頁鎖定過一次後，比賽中點畫面就會自動鎖定（可關）；暫停選單有「鎖定游標並繼續」；離開比賽畫面時放開游標）、觸控按鈕。
- 音效掛點 `window.Sidewinder.audio`（`await Sidewinder.ready` 之後可用）：`on(eventName, fn)`（快轉收尾時不發聲，但掛點照樣收到事件）、`registerSfx(name, fnOrAudioBuffer)`、`setMusic(slot, source)`（slot：`title`、`race`、`garage`；source 可為 AudioBuffer、URL 字串或 `null`）、`setVolume(bus, v)`。預設全部用 WebAudio 合成（引擎聲依轉速、打滑、濺水、落地、氮氣、倒數、群眾），背景音樂預設為合成的簡單循環，可被替換。
- 字型：只用系統字（例如 `"DIN Condensed", "Avenir Next Condensed", "Arial Narrow", system-ui`；中文用系統黑體）。標誌 SIDEWINDER 以 SVG 路徑手繪字形，不用網路字型。

## 8. 美術方向

白天的沙漠競技場：夯實的赭紅黏土賽道、邊緣乾裂的鹼土、灰綠山艾與仙人掌、輪胎堆與乾草捆圍牆、帆布遮陽的木看台與照明燈塔。泥地是深褐濕亮、水坑是混濁的灰綠。四台車色：鐵鏽紅、牛仔藍、芥末黃、骨白。
介面語彙：手漆夾板賽事看板＋響尾蛇背紋。深赭土色面板、骨白與芥末黃字、菱形背紋鏈當分隔與進度（圈數、升級等級用菱形格）、看板式名次塔。禁止：藍紫漸層、發光膠囊按鈕、玻璃擬態、Inter／Space Grotesk、點陣像素字（和 011 區隔）、CRT 掃描線（和 005 區隔）。

## 9. 建置與測試

- `npm run build`：`cargo build --release --target wasm32-unknown-unknown`（core/）→ 讀 `blender/out/` → gzip + base64 內嵌 → esbuild 打包 `src/main.js` → 輸出 `web/195-sidewinder.html`。`--out=dist` 改輸出 `dist/index.html` 並複製 `public/_headers`。
- `npm run assets`：`blender -b --factory-startup --python blender/build_all.py -- --out blender/out`。
- `npm run test:core`：`cargo test`（原生目標），包含用 `blender/out/track_*.bin` 跑完整 4 台 AI 比賽的整合測試。
- `npm test`：無頭 Chrome 開單檔：兩種尺寸的錯誤／請求／溢出檢查，快轉完成一場比賽，商店購買會改變卡車數值，spinner 的 feed 會改變轉向。
- 部署：`npx wrangler pages deploy dist --project-name sidewinder`（需要使用者自己的 Cloudflare 帳號，不在建置中自動執行）。
