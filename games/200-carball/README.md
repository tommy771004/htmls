# 車球碗 · CARBALL BOWL（作品 200）

瀏覽器裡的車球對戰：一座清水混凝土澆成的室內球場，地面接牆、牆接天花板都是彎道，車開得上牆、也開得上天花板。對上一台電腦，把比車還大的球撞進對面的鐵門，一局五分鐘。頁面：`web/200-carball.html`（遊戲敘事）。

手感優先：物理數值照 Rocket League 的公開資料（RLBot wiki、RocketSim，1 uu = 1 cm 換成公尺）—— 重力 6.5 m/s²、只踩油門最高 14.1 m/s、加速 23 m/s、轉彎曲率表、跳躍 2.92 m/s 起跳＋按住 0.2 秒、1.25 秒內二段跳或翻滾、空中三軸角加速度與阻尼、車重 180／球重 30、撞球的額外衝量。

## 操作

| 動作 | 鍵盤滑鼠 | 手把（標準配置） | 觸控 |
| --- | --- | --- | --- |
| 油門／倒車（空中：俯仰） | W／S | RT／LT，左搖桿上下 | 左搖桿上下 |
| 轉向（空中：偏航） | A／D | 左搖桿左右 | 左搖桿左右 |
| 跳躍、二段跳、帶方向是翻滾 | 空白鍵、滑鼠右鍵 | A | 跳 |
| 加速 | Shift、滑鼠左鍵 | B | 加速 |
| 甩尾；空中按住變自由滾轉 | C | X | 甩尾 |
| 空中向左／右滾轉 | Q／E | LB／RB | — |
| 鏡頭：球鎖定 → 車尾 → 自由視角 | Y | Y | 鏡頭 |
| 轉視角（自由視角；其他鏡頭是偷看） | 點球場鎖定滑鼠後移動、方向鍵 | 右搖桿 | — |
| 暫停 | Esc、P | Start | 右上角 |

- 倒在地上（車頂朝下或側躺）按跳躍會彈起來翻正。
- 超音速（22 m/s 以上，掉到 21 以下或維持超過 1 秒才解除）撞上對手會把對方撞毀，3 秒後在自家門前重生。
- 補給點：六個大的補滿 100、10 秒後重生；28 個小的 +12、4 秒後重生。
- 進球：爆炸把附近的車推開，0.9 秒慢動作，接著是最後 5 秒的重播（最後 1.5 秒放慢，按跳躍略過），然後開球倒數。
- 時間到要等球落地才結束；平手進延長賽，先進球的贏。
- 難度：新手（慢、不加速、不跳）、職業（會跳、會翻滾射門）、全明星（反應快、瞄得準、會加速）。另有沒有對手、不計時的自由練習。

## 執行

需要 Node.js 22 以上。

```bash
npm ci
npm run build        # 打包成 ../../web/200-carball.html（改了 src/ 一定要重跑並一起 commit）
npm test             # 手感與規則的數值測試，再跑 1440×900／390×844 無頭 Chrome 驗收
npm run test:sim     # 只跑數值測試（Node，不用瀏覽器）
npm run thumb        # 重新產生 ../../thumbs/200.jpg
node tools/sim.mjs 300 allstar rookie   # Node 裡跑 AI 對 AI，印比分與事件統計（SEED=n 換開球序列、SWAP=1 對調剛體建立順序）
node tools/balance.mjs allstar 8 pro    # 難度平衡：兩邊各打 8 場（換邊抵消開球的先後偏差）
node tools/perf.mjs                     # 標題畫面跑 6 秒量幀率
```

無頭瀏覽器工具用本資料夾的 `playwright-core`，瀏覽器找 `~/Library/Caches/ms-playwright/chromium-*` 裡快取的 Chrome for Testing（可用 `CHROME_PATH` 指定），先用 Metal GPU、失敗退回 SwiftShader。

### 打包與 Rapier 的 WASM

物理用 `@dimforge/rapier3d-compat`。它把 WASM 以 base64 寫死在 JS 裡（約 4 MB）；`tools/build.mjs` 用 esbuild 外掛把那段換成 `globalThis.__RAPIER_WASM__`，另外把 WASM 以 gzip＋base64（約 1.5 MB）放進 `<script id="rapier-wasm">`，頁面載入時用 `DecompressionStream('gzip')` 解開後再 `RAPIER.init()`。所以瀏覽器需要 WebAssembly 與 DecompressionStream（Chrome 80、Safari 16.4、Firefox 113 以上）。升級 Rapier 版本後如果打包失敗，多半是 base64 那段的寫法變了。

## 結構

- `src/core/`（不碰 DOM，Node 測試與瀏覽器共用）
  - `const.js`：所有物理常數、球場尺寸、補給點與開球位置。
  - `arena.js`：球場幾何。剖面（地面 → 2.56 m 彎道 → 牆 → 5.2 m 彎道 → 天花板）沿圓角矩形繞一圈，兩端挖出球門；同一份頂點同時給畫面與 Rapier 三角網格（`FIX_INTERNAL_EDGES`），地面和天花板另用方塊。另有解析距離場 `arenaSDF`，給 AI 預測球路與鏡頭防穿牆。
  - `car.js`：車輛控制。Rapier 只負責碰撞；四條懸吊射線、側向抓地、照速度查曲率的轉向、貼地力、跳躍／二段跳／翻滾、空中姿態、翻正，都是逐 tick 直接寫速度。上牆時把撞進曲面的速度轉回切線方向、車身姿態追著地面法線（法線的轉速當前饋），彎道不掉速。
  - `sim.js`：對局。120 Hz 固定步長、撞球的額外衝量（用碰撞前的相對速度、延後一個 tick 疊上去）、超音速撞毀、補給點、計時、進球與延長賽、重播用的環狀緩衝（每秒 60 格、8 秒）。車的碰撞箱拆兩份：對球場無摩擦、對球與車照原作摩擦 2.0。
  - `ai.js`：球路預測（重力、阻力、對距離場反彈）→ 找最早趕得上的攔截點 → 沿射門線從球後方接近，依剩餘時間控制車速；球往自家門口跑就繞遠柱回防；地面球翻滾加力、半空球起跳。
- `src/client/`：`main.js`（主迴圈、畫面內插、事件、重播、HUD）、`scene.js`（清水模牆、地坪、天窗、球門、隊名大字、補給點、燈光）、`models.js`（放樣斷面的車身、輪子、加速火焰、足球）、`textures.js`（全部 canvas 程序貼圖）、`fx.js`（粒子與衝擊波）、`camera.js`、`input.js`、`audio.js`（WebAudio 合成，混凝土大廳殘響用產生的脈衝響應）。
- `tools/`：`build.mjs`、`sim.test.mjs`、`accept.mjs`、`thumb.mjs`、`sim.mjs`、`balance.mjs`、`perf.mjs`、`lib.mjs`。

## 測試 API（`window.__cb`）

| 呼叫 | 作用 |
| --- | --- |
| `start(mode, level)` | `mode` 是 `'match'`／`'practice'`，`level` 是 `'rookie'`／`'pro'`／`'allstar'` |
| `play()` | 跳過開球倒數，直接進比賽 |
| `place('car'\|'ai'\|'ball', x, y, z, vx, vy, vz, yaw)` | 擺位置與速度（球不吃 yaw） |
| `cam('ball'\|'car'\|'free')` | 切鏡頭 |
| `freezeAI(on)` | 讓對手不動 |
| `goal(team)` | 把球射向某隊要進的門 |
| `timeScale(k)` | 時間倍率（截圖時給 0.0001 可以定格） |
| `state()` | 階段、比分、時鐘、加速量、位置、是否在重播、鏡頭模式 |
| `game`／`sim` | 直接存取遊戲與對局物件 |

## 已知限制

- 開球雙方同時撞球時，Rapier 依剛體建立順序解碰撞，先建立的玩家車略佔一點便宜；AI 對 AI 的平衡測試因此要換邊各打一半。
- 天花板只能短暫開上去：貼地力只有半個重力，速度一慢就會掉下來（和原作一樣）。
- 一對一、單機；沒有連線對戰。
