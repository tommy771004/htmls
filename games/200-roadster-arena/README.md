# Roadster Stunt Arena（作品 200）

**非官方同人作品，與任何車廠無關。** 車子「RSA Roadster」的模型是 Sketchfab 上 asiphy007 的同人模型 [“Tesla Roadtser 2026”](https://sketchfab.com/3d-models/tesla-roadtser-2026-7630c9fe842d4f5ea86fc1f122753b89)（[CC BY 4.0](http://creativecommons.org/licenses/by/4.0/)），由 `tools/car.mjs` 減面、拆出四個輪子、重算法線後內嵌；主動尾翼兼空氣煞車、四個冷氣推進噴口的火焰與頭燈條是程式加上的。頁面主選單與展示間都標有作者與授權（另見 `assets/CREDITS.md`）；不使用車廠的標誌。

瀏覽器裡的夜間特技場：自由駕駛、計時賽與幽靈車、最多 20 人的車球聯賽、展示間、排行榜。頁面是打包後的單檔 `web/200-roadster-arena.html`；舊的「車球碗」（`web/200-carball.html`）由這個作品取代，`vercel.json` 會把舊網址轉過來。

參考：Aymeric Rabot 在 X 上的兩段影片（2111092194107068858、2111519266898169925）與他附的提示詞。技術照提示詞：Three.js 0.186.0、Rapier（`@dimforge/rapier3d-compat` 0.21.0）、房間與同步用 Cloudflare Durable Objects（另附本機 Node 伺服器，邏輯共用）。

## 模式

| 模式 | 內容 |
| --- | --- |
| FREE RIDE | 940 m 見方的夜間特技場：THE CURL 巨型曲牆、聯結車與整排車的飛越跳台、U 形牆、300 m 騎牆、大迴圈、天空跳台、加速墊、6 個紅環。10 個任務（0–60 mph 1.1 秒、飛越聯結車、Kickflip、騎牆 3 秒、連續飛行 5 秒、衝上 88 mph…），進度存在本機。 |
| TIME ATTACK | CIRCUIT 01：5 個檢查點環＋終點拱門。3 秒倒數、分段時間與個人紀錄比較（綠快紅慢）、逆向提示。作者 50 秒／金 58／銀 70／銅 90。個人最佳會存幽靈車軌跡（30 Hz），下一次一起跑。有伺服器時成績上傳排行榜。 |
| ROADSTER LEAGUE | 圓角室內球場（128×184 m、高 36 m，牆與天花板都開得上去）、直徑 8.4 m 的巨型足球、紅隊 vs 冰藍隊。一場 3 分鐘，平手延長、先進球勝。線上一房最多 20 人（兩人到齊開賽，只有一人時是熱身）；離線是和 AI 的 3 對 3 練習賽。 |
| SHOWROOM | 轉台上的車：拖曳環繞、滾輪／雙指縮放；燈光（關／近光／遠光）、主動空力（收起／下壓／空氣煞車）、6 種烤漆（存進設定，開車時也是這台）。 |
| LEADERBOARD | 世界紀錄、本週最佳（ISO 週，週一起算，UTC）、我的紀錄（本機前 50 次）。 |

主選單顯示在線人數（大廳連線）；沒有伺服器時顯示「離線模式」，聯賽的快速配對會停用。

## 操作

| 動作 | 鍵盤 | 手把（標準配置） | 觸控 |
| --- | --- | --- | --- |
| 油門／倒車（空中：俯仰） | W／S、方向鍵 | RT／LT，左搖桿上下 | 左搖桿 |
| 轉向（空中：偏航） | A／D | 左搖桿左右 | 左搖桿 |
| 冷氣推進 | Shift | B | BOOST |
| 跳躍；空中按住＝懸停飛行 | 空白鍵 | A | JUMP |
| 空中滾轉（起跳後馬上按＝Kickflip） | Q／E | LB／RB | 無 |
| 手煞車甩尾 | C、X | X | DRIFT |
| 主動空力 AUTO→LOW→HIGH | T | 十字鍵左 | 上排 AERO |
| 吸附 GRIP↔WALL（騎牆用） | F | 十字鍵上 | 上排 GRIP |
| 燈光 關／近／遠 | L | 十字鍵右 | 無 |
| 鏡頭（聯賽多一個球鎖定） | V | Y | 上排 CAM |
| 重生到上一個安全點 | R、Enter | Back | 上排 ↺ |
| 重新開始計時賽 | Backspace | 無 | 暫停面板 |
| 暫停 | Esc、P | Start | 上排 ❚❚ |
| 全部按鍵 | Tab | 無 | 無 |

## 指令

需要 Node.js 22 以上；這個資料夾有自己的 `package.json`（`npm ci` 一次）。

```bash
npm run build          # 打包成 ../../web/200-roadster-arena.html（壓縮）；--dev 不壓縮
npm test               # Node 測試（tools/sim.test.mjs）＋兩種尺寸的無頭 Chrome 驗收（tools/accept.mjs，跑打包後的單檔）
npm run test:sim       # 只跑 Node 測試：手感數值、任務、計時賽、聯賽規則、AI、大廳／房間／排行榜、本機 WebSocket 兩人整合
node tools/mp.mjs      # 起本機伺服器、開兩個分頁：快速配對 → 分享網址加入 → 開球 → 換球權 → 進球同步 → 排行榜
node tools/perf.mjs 1440 900 high     # 量幀率與 draw call
node tools/league-sim.mjs 120 3 pro   # Node 跑一場 AI 對戰
npm run thumb          # 產生 ../../thumbs/200.jpg
npm run car            # 重做車輛模型：.cache/tesla_roadtser_2026.glb（原檔 27 MB 不進 repo，從 Sketchfab 下載）→ assets/roadster.glb（gltf-transform、meshoptimizer、sharp 借 197 的 node_modules）
node tools/shot.mjs out.png "mode=ta" "" 2000 390x844 touch   # 開發用截圖
```

改了 `src/` 要重新 build，並把 `web/200-roadster-arena.html` 一起 commit。

網址參數：`?mode=free|ta|league|show|board` 直接進某個畫面，`?room=ABCDE` 加入房間，`?q=low|mid|high` 指定畫質（預設 auto：手機 mid、桌機 high，連續 4 秒低於 40 fps 自動降一級），`?server=wss://…` 指定連線伺服器。

## 連線

伺服器位置依序找：打包時的 `RSA_SERVER` 環境變數 → 網址 `?server=` → 頁面在 `localhost`／`127.0.0.1` 上時連同一個網址 → 否則離線。所以：

- **本機**：在 repo 根目錄 `npm start`，開 `http://127.0.0.1:8127/web/200-roadster-arena.html`，大廳是 `/api/rsa`、房間是 `/api/rsa/room/<房號>`，和麻將、鹽岬共用 8127 埠。只要 WebSocket 不要網站：`node server/roadster/server.mjs`（預設 8200 埠，`ALLOWED_ORIGINS` 限制來源）。
- **Vercel 上的網站**：Vercel function 撐不住長時間的房間狀態，所以預設離線；部署 Cloudflare Worker 後用 `RSA_SERVER` 打包。
- **以檔案開啟**：離線，不會嘗試連線，不會出現 WebSocket 錯誤。

### 部署到 Cloudflare（要用你自己的帳號，不會自動執行）

```bash
cd worker
npx wrangler login
npx wrangler deploy                      # 建立 Lobby、Room 兩個 Durable Object（SQLite 後端）
cd .. && RSA_SERVER=wss://roadster-stunt-arena.<帳號>.workers.dev npm run build
```

`wrangler.toml` 的 `ALLOWED_ORIGINS` 預設只允許 `https://htmls-ruddy.vercel.app`。健康檢查：`https://<worker>/health`。

## 測試與除錯 API

`window.__rsa`：

| 成員 | 用途 |
| --- | --- |
| `ready`、`screen` | 啟動完成、目前畫面（`menu`／`free`／`ta`／`league`／`show`） |
| `go(mode)`、`startLeague(online, code)` | 切畫面、開聯賽（`false`＝離線練習） |
| `openSheet(id)`、`closeSheet()`、`pause()`、`resume()` | 面板：`pause`／`result`／`controls`／`settings`／`board`／`lobby` |
| `auto` | 設成輸入物件（如 `{ throttle: 1, boost: true }`）會蓋過鍵盤，測試用 |
| `drive` | Free Ride／計時賽：`car`（Rapier 剛體＋狀態）、`rules`（`FreeRide`／`TimeAttack`）、`best`、`ghost`、`cam` |
| `match` | 聯賽：`lg`（`League`：`ball`、`cars`、`remotes`、`placeBall()`、`phase`、`score`）、`myId`、`owner`、`code`、`rc` |
| `show`、`gfx`、`lobby`、`settings`、`hud`、`input` | 展示間、渲染器（`setQuality`）、大廳連線、設定 |

本機儲存一律用 `rsa200:` 前綴（設定、Free Ride 進度、計時賽最佳與幽靈車、最近 50 次成績）。

## 已知限制

- 線上聯賽沒有伺服器端物理：每人模擬自己的車，球由最後碰到的人模擬並回報。延遲高時兩人同時碰球，以伺服器先收到的為準（0.2 秒內不換手），另一邊會看到球被拉回。
- 本機 Node 伺服器的房間與排行榜只存在單一行程（排行榜另寫入暫存資料夾的 `rsa200-board.json`）；Cloudflare 版存在 Durable Object。
- 排行榜只檢查成績格式（30–600 秒、6 個遞增分段、最後一段等於總時間），沒有重播驗證，防不了刻意偽造。
- 計時賽獎牌時間是依路線長度估的，不是實際跑出來的紀錄。
- 車輛模型原檔是 AI 生成風格的網格（單一貼圖、烘焙明暗、輪子和車身黏在一起）：輪子以「三角形重心在輪胎圓柱內」切出，輪拱內側留著深色內襯；車身表面的低頻起伏靠法線濾波（半徑 8 cm）抹平，擋風玻璃在強光下仍看得到一點波紋。車門打不開（原本的鷗翼門與塗裝選項已拿掉）。
- 車漆換色是在著色器裡把「亮而不飽和」的貼圖像素乘上烤漆色；尾燈是貼圖裡偏紅的像素自發光。
- 每台車約 8.6 萬面（車身 7 萬＋四輪各 4 千）。離線 3v3 在 1440×900 high 量到 120 fps（約 71 萬面）；線上 20 人滿房約 200 萬面，還沒實測，手機建議 mid 畫質。
