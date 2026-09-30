# 195 響尾蛇越野 · SIDEWINDER

致敬 1989 年街機《Ironman Ivan Stewart's Super Off-Road》的俯視角越野卡車賽。整條賽道一個畫面放得下，四台卡車同場，比完拿獎金到車庫升級輪胎、引擎、避震與氮氣，再跑下一條。網址 `https://htmls-ruddy.vercel.app/web/195-sidewinder.html`。

- 物理、AI、圈數與名次在 Rust 寫的 `core/`，編成 `wasm32-unknown-unknown`（不用 wasm-bindgen，純 C ABI）。
- 畫面是 WebGL2（沒有 WebGL2 時退回 Canvas 2D 俯視圖），HUD 與介面是 DOM／Canvas 2D。
- 賽道高度場、地面種類、行車路線、擺設與卡車模型由 `blender/` 的 Python 腳本在 Blender headless 產生並匯出成自訂二進位格式。
- 網站沒有 build step：`npm run build` 把 WASM、模型、四條賽道與貼圖 gzip＋base64 後，連同 esbuild 打包的前端一起內嵌成單檔 `../../web/195-sidewinder.html`，**不載入任何外部資源**。改了 `core/`、`blender/out/` 或 `src/` 之後要重新 build，並把產出一起 commit。
- 模組之間的契約（檔案格式 SWTK／SWMS、WASM ABI、狀態陣列、事件、座標）見 [`SPEC.md`](SPEC.md)。

## 目錄

```
games/195-sidewinder/
  SPEC.md              介面契約（改介面要同時改這裡）
  core/                Rust crate（cdylib）：物理、AI、賽事；cargo test 在原生目標跑
  blender/             build_all.py 等腳本；out/ 是匯出結果（commit）
    out/meshes.bin       13 個模型（SWMS）
    out/track_N.bin      賽道 N = 0..3（SWTK）
    out/track_N.jpg      地面貼圖（每公尺 8 px，2×2 超取樣）；track_N_check.png 是給 check.mjs 的小圖
    out/*.glb            track_N／trucks／props，給人檢查用，不內嵌（另有 manifest.json）
  src/                 前端 ES module（esbuild 打包成 IIFE）
    index.html           樣板，含 <!--ASSETS--> 與 <!--BUNDLE--> 佔位符
    main.js style.css    進入點與樣式
    assets.js core.js track.js   解內嵌資產、包 WASM、解析賽道／模型
    render/  input/  audio/  ui/  game/
  tools/
    build.mjs            建置單檔（Cloudflare Pages 用 --out=dist）
    playtest.mjs         無頭 Chrome 驗收測試
    shot.mjs             截圖（1440×900、390×844、844×390）
    check-assets.mjs     驗證 blender/out 是否符合 SPEC 格式
    sim.mjs              在 Node 直接跑 WASM：四台 AI 的單圈、滯空、地面比例、卡位統計
  public/_headers      Cloudflare Pages 回應標頭
  wrangler.toml        Cloudflare Pages 專案設定
```

## 架構

```
 Blender（headless）                 Rust（cargo）
 blender/build_all.py                core/src/*.rs
        │ 匯出                               │ wasm32-unknown-unknown
        ▼                                    ▼
 meshes.bin  track_N.bin  track_N.jpg     sidewinder_core.wasm
        └───────────────┬────────────────────┘
                        │ tools/build.mjs：gzip（level 9）＋ base64
                        ▼
       <script>window.__SW_ASSETS = {v, wasm, meshes, tracks[4], albedo[4]}</script>
       <script>esbuild bundle（src/main.js …）</script>        → web/195-sidewinder.html
                        │
 瀏覽器 ───────────────┼──────────────────────────────────────────────────
  assets.js  DecompressionStream('gzip') 解回 ArrayBuffer／圖片
  core.js    WebAssembly.instantiate → sw_* 函式；state() 每次重建 Float32Array 視圖
  track.js   解析 SWTK／SWMS → 高度場、路線、擺設、網格
  main.js    固定步長迴圈：累積時間，每 1/120 s 呼叫 sw_step，每幀最多 8 步
     │   input.poll() ──► sw_set_input(0, steer, throttle, brake, nitro)
     │   sw_step() ──► state（176 個 f32）＋ 事件佇列（每筆 type, truck, a, b）
     ├─► render/  WebGL2 地形、卡車、擺設、塵土／濺水／胎痕／氮氣火焰（或 Canvas 2D 備援）
     ├─► audio/   事件 → 合成音效與外掛掛點；引擎聲依轉速
     └─► ui/ game/ 標題（示範賽）→ 賽道介紹 → 倒數 → 比賽 → 結果 → 車庫 → 下一條
```

## 指令

需要 Node.js 22 以上、Rust（含 `wasm32-unknown-unknown` target），重新產生美術資產需要 Blender（開發時用 5.2，`blender` 要在 PATH 上）。在本資料夾執行：

```bash
npm ci
npm run build                 # cargo build → 內嵌資產 → ../../web/195-sidewinder.html
npm test                      # 無頭 Chrome 驗收（先 build）
npm run test:core             # cargo test：規則引擎與用真實賽道檔跑完整四台 AI 比賽
npm run check                 # 驗證 blender/out 符合 SPEC 的 SWTK／SWMS 格式
npm run assets                # Blender headless 重新產生 blender/out（會覆寫）
npm run sim                   # Node 裡直接跑 WASM：四條賽道的單圈、滯空、地面比例、卡位（--all-ai 四台都用 core AI）
npm run shot                  # 截圖到 shots/（已 gitignore）

node tools/build.mjs --dev --skip-cargo --out=dist     # 不壓縮、沿用現有 wasm，輸出 dist/index.html
node tools/shot.mjs --race=2 --secs=8                  # 開第 2 條賽道快轉 8 秒後截圖
node tools/shot.mjs --swiftshader                      # 沒有 GPU 的環境（CI）改用軟體 WebGL
node tools/sim.mjs --tracks=1 --laps=2 --skill=1,1,1,1 --up=5 --det
```

`build.mjs` 旗標：`--dev` 不壓縮、`--skip-cargo` 不跑 cargo（沿用 `core/target/.../sidewinder_core.wasm`）、`--out=資料夾` 輸出 `資料夾/index.html` 並複製 `public/_headers`。任何輸入檔缺少時會一次列出全部缺漏再結束。

`shot.mjs` 與 `playtest.mjs` 用 puppeteer-core 開本機 Chrome，路徑依平台預設（見 `tools/shot.mjs`），可用環境變數 `CHROME` 覆寫。預設用真 GPU（macOS 為 `--use-angle=metal`），加 `--swiftshader` 改用軟體算繪。

## 操作

| 動作 | 鍵盤 | 手把（standard mapping） | 旋轉方向盤 | 觸控 |
|---|---|---|---|---|
| 轉向 | ← → ／ A D | 左搖桿、十字鍵 | 轉動旋鈕 | 左右按鈕 |
| 油門 | ↑ ／ W | RT、A | （搭配鍵盤或街機按鈕） | 油門鈕 |
| 煞車／倒車 | ↓ ／ S | LT、B | | 煞車鈕 |
| 氮氣 | 空白鍵、Shift | X、RB | | 氮氣鈕 |
| 選單 | 方向鍵、Enter、Esc | 十字鍵、A、B | | 點選 |
| 暫停 | Esc、P | Start（比賽中 B 是煞車，不會暫停） | | 左上暫停鈕 |

**USB 街機旋轉方向盤**：旋轉編碼器在電腦上就是一隻只有 X 軸的滑鼠。到「設定 → 操控 → 旋轉方向盤」按「鎖定游標」進入 Pointer Lock（可以先轉轉看即時指示條校正），遊戲累積 `movementX` 換成轉向。鎖定過一次之後，「比賽中點一下畫面就鎖定游標」會自動打開，之後每場比賽點一下畫面就好；暫停選單也有「鎖定游標並繼續」：

- 「速率」模式：轉得越快轉向越大，停手就回正（像街機甩方向盤）。
- 「位置」模式：累積角度當方向盤角度，停手後慢慢回中。
- 可調靈敏度、反向；設定頁有即時指示條可以校正。設定存在 localStorage（`sw195-input`），存不了也能玩。
- 比賽中失去鎖定（瀏覽器的 Esc、切到別的視窗）會自動暫停，不會在比賽途中突然不能轉向；離開比賽畫面（暫停、結果、車庫）時遊戲會放開游標，滑鼠才點得到按鈕。設定頁鎖定時點一下畫面就解除。
- 測試用：`__sw.input.spinner.feed(40)` 模擬向右轉 40 個計數。

## 音效與音樂掛點

預設全部以 WebAudio 即時合成（引擎聲依轉速、打滑、濺水、落地、氮氣、倒數、群眾），背景音樂是合成的簡單循環。要換成自己的素材，透過 `window.Sidewinder.audio`。`window.Sidewinder` 一載入就存在，但 `audio` 要等 WASM 與資產解壓完（約 0.1–0.3 秒）才補上：先 `await Sidewinder.ready`，或監聽 window 的 `sidewinder:ready` 事件：

```js
const { audio } = await window.Sidewinder.ready;   // 或 addEventListener('sidewinder:ready', (e) => e.detail.audio …)

// 換背景音樂：slot 為 title / race / garage（結果畫面沿用 garage）
// source：AudioBuffer、URL 字串、null（這一槽靜音）、'default'（恢復預設合成曲）
audio.setMusic('race', 'music/desert-rock.ogg');
audio.setMusic('title', null);
audio.setMusic('garage', 'default');

// 換音效：傳 AudioBuffer，或傳函式 fn(ctx, destination, {truck, a, b}) 自己發聲（回傳秒數 = 音效長度）；傳 null 恢復預設
const ctx = audio.context() || new AudioContext();   // AudioContext 在第一次使用者手勢後才建立
const buf = await ctx.decodeAudioData(await (await fetch('sfx/splash.wav')).arrayBuffer());
audio.registerSfx('splash', buf);
audio.registerSfx('wall_hit', (ctx, out, { a }) => {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.frequency.value = 70;
  g.gain.setValueAtTime(0.6 * a, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
  o.connect(g).connect(out);
  o.start();
  o.stop(ctx.currentTime + 0.25);
  return 0.25;
});

// 監聽遊戲事件（掛自己的震動、燈光或統計）；回傳值是取消監聽的函式，'*' 監聽全部
audio.on('land', ({ a }) => navigator.vibrate?.(Math.round(a * 60)));
const stop = audio.on('*', (name, { truck, a, b }) => console.log(name, truck, a, b));

audio.setVolume('music', 0.4);   // 匯流排：master / music / sfx / engine，0..1
audio.mute(true);
```

事件名稱：`countdown`（a = 3、2、1）、`go`、`takeoff`、`land`、`splash`、`mud`、`truck_hit`、`wall_hit`、`nitro`、`pickup`、`lap`、`finish`、`final_lap`、`overtake`、`wrong_way`（a = 1 開始逆向、0 回正；沒有預設音效）（對應 SPEC §5 事件 1–15，`truck`／`a`／`b` 與事件佇列相同），以及介面用的 `ui_move`、`ui_confirm`、`ui_back`、`purchase`。玩家完賽後其他車會快轉收尾：這段不發聲，但 `on()` 照樣收到每一台的 `lap`／`finish`。暫停時音樂繼續，引擎、打滑、氮氣等持續音會停。`?mute=1` 開頁即靜音。

注意：`public/_headers` 的 CSP 不允許任何外部來源，用 URL 換音樂時檔案要和頁面同源（放在 `dist/` 裡一起部署），或自行放寬 `media-src`／`connect-src`。

## 部署到 Cloudflare Pages

網站本體部署在 Vercel（整個 repo，這個作品就是 `web/195-sidewinder.html`）。這個資料夾另外可以獨立部署成 Cloudflare Pages 專案，不會自動執行，需要自己的 Cloudflare 帳號。

**方法一：本機用 wrangler 上傳**

```bash
npx wrangler login                 # 第一次：瀏覽器登入 Cloudflare
npm run deploy:dist                # 建置 dist/index.html 與 dist/_headers
npx wrangler pages deploy dist --project-name sidewinder
# 或一步：npm run deploy
```

第一次部署時 wrangler 會詢問是否建立 `sidewinder` 專案；`wrangler.toml` 已設定 `pages_build_output_dir = "dist"`。

**方法二：連接 Git 儲存庫自動建置**

Cloudflare 儀表板 → Workers & Pages → 建立 → Pages → 連接 Git，設定：

| 欄位 | 值 |
|---|---|
| 根目錄（Root directory） | `games/195-sidewinder` |
| 建置指令 | `npm ci && node tools/build.mjs --out=dist --skip-cargo` |
| 輸出目錄 | `dist` |
| 環境變數 | `NODE_VERSION=22` |

Cloudflare 的建置環境不保證有 Rust 與 `wasm32-unknown-unknown` target，所以用 `--skip-cargo`：這需要把 `core/target/wasm32-unknown-unknown/release/sidewinder_core.wasm` 一起 commit（預設被 `.gitignore` 排除），或改成直接上傳 `web/195-sidewinder.html` 當 `dist/index.html`（方法一不受影響）。

`public/_headers` 的內容：`nosniff`、`Referrer-Policy`、`X-Frame-Options: SAMEORIGIN`、只放行同源／inline／`data:`／`blob:` 與 `wasm-unsafe-eval` 的 CSP、`Permissions-Policy` 開放本站的 `gamepad` 與 `fullscreen`，以及 HTML 不快取（每次重新驗證）。

## 測試項目（`npm test`）

1. 1440×900 與 390×844：沒有 uncaught exception、`console.error`，除了單檔本身與 `data:`／`blob:` 沒有任何請求，有 viewport meta 與 `<title>`，標題畫面與比賽中都沒有水平溢出。
2. `__sw.startRace(0, {laps: 2, seed: 7, playerAI: true})` 快轉到結束：phase 3、沒有 NaN、名次是 1..4 的排列、每台完賽或在領先者完賽 20 秒後收尾、完賽名次與完賽時間一致。
3. 結算後獎金入帳；`__sw.buy('engine')` 讓引擎等級 +1 並扣錢，其他升級不變（錢不夠時會再跑幾場短賽累積獎金）。
4. 旋轉方向盤：速率模式 `feed(+40)` → `steer > 0`、`feed(−40)` → `steer < 0`、反向設定生效。
5. `window.Sidewinder.audio` 有 `on`／`off`／`registerSfx`／`setMusic`／`setVolume`／`getVolume`／`mute`，且與 `__sw.audio` 是同一組。
6. 四條賽道各跑 10 秒：比賽中、`track_id` 正確、四台都有移動、沒有 NaN；同一個 seed 跑兩次狀態逐位元相同。

## 驗收（2026-10-01，Apple GPU 無頭 Chrome）

- `npm run build`：單檔 0.59 MB（WASM 91 KB → gzip 38 KB；模型 164 KB → 33 KB；四條賽道各約 48 KB → 11 KB；四張地面貼圖各約 50–54 KB JPEG（576×384）；bundle 144 KB；CSS 29 KB）。
- `npm run check`：13 個模型、四條賽道 145×97 網格（72×48 m）與四張 576×384 貼圖全部符合 SPEC 格式；`node blender/check.mjs` 3,287 項通過。
- `npm test` 45/45 通過：兩種尺寸沒有錯誤、外部請求或水平溢出；2 圈比賽四台都完賽（約 43 s），巡迴賽獎金入帳、買引擎 0→1 級並扣 $30,000，極速 17.0→18.0 m/s；旋轉方向盤 ±40 計數 → steer ±0.36；四條賽道各跑 10 秒行駛 78–107 m；同 seed 狀態逐位元相同。
- `npm run sim -- --det`（seed 7、4 圈、第 0 台為循線機器人）：四條賽道都完賽且可重現，AI 最佳單圈 16.7–20.4 s、滯空 3–16%，AI 每場對玩家卡位 1–6 次。
- `npm run test:core`：20 個測試通過（含第 0 條賽道升級 3–5 級的 AI 平均每台每場脫困 0.12 s 的回歸測試、滯空 pitch、避震、逆向事件、表頭 9；另有 9 個標 `#[ignore]` 的調校／追蹤工具，例如 `flight_model` 比對起跳預測和實際飛行距離，用 `cd core && cargo test -- --ignored --nocapture` 執行）。
- 對手 AI 的跳台：`sim --all-ai --skill=0.98,0.93,0.88,0.5 --seed=3` 在第 0 條賽道 0.98 的車拿第 1（完賽 79.5 s，撞牆 2 次；修正前第 4 名、撞牆 25 次）；四台都 5 級時第 0 條賽道每場脫困合計 0.4 秒（修正前 15.4 秒）。
- 升級效果（`skill 0.85` 的 AI 當玩家、對手不改裝，8 個 seed 平均完賽時間，四條賽道）：輪胎 5 級 −5.0／−5.0／−4.6／−6.5 s、引擎 5 級 −4.3／−3.9／−6.4／−0.3 s、避震 5 級 −1.5／−0.2／−1.3／−5.6 s。

## 已知限制

- 旋轉方向盤依賴 Pointer Lock；Safari 與部分行動瀏覽器不支援或需要全螢幕，這時可開「不鎖游標」模式（滑鼠在畫布上移動就是轉向）。
- 真實的旋轉編碼器解析度差很多（每圈 24–1200 計數），第一次使用要到設定頁調靈敏度。
- 單檔內嵌 WASM、模型與四張地面貼圖，檔案比一般作品大；gzip 後的傳輸量由伺服器壓縮決定。
- `--skip-cargo` 的 Cloudflare Git 建置需要另外 commit 編好的 wasm（見上）。
- `tools/sim.mjs` 的玩家機器人只是簡單循線（會撞牆、比 AI 慢），用途是讓 AI 有卡位對象，不代表真人水準。
- 直式手機上整條賽道只有約 378×223 px；卡車在畫面很小時只在渲染上放大（最多 1.3 倍，碰撞尺寸不變），這時車緊貼會看起來略為重疊（桌機比例下碰撞矩形與車身一致）。
- 對手 AI 會把飛行中不能煞車算進去：跳台後緊接彎道時，AI 起跳前會先減速、不放氮氣，所以在第 3 條賽道（連續跳台）升級滿時單圈比以前慢約 1.5 秒，但不再飛進牆裡。
- 手把與觸控的氮氣是逐格讀取，比一格還短的點按可能漏掉（鍵盤已鎖存到下一格）。
