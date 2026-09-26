# 斥候與投降

曠野地圖上，雙方開局各有一名斥候（騎馬，移動速度是村民的兩倍，視野較廣，只在下令時戰鬥），開局人口 4/5，和原作的標準開局相同。斥候目前不能訓練。電腦用斥候探索地圖，進攻時優先攻擊看過的建築。選單新增「投降」（要按兩次）；電腦失去城鎮中心又沒有士兵時也會投降，大地圖上不必再追最後一名村民。State／snapshot 為 v18，詳見 docs/first-use-017.md。

# 放大地圖與隨機出生

一般進站改用新的「曠野」對戰圖：32×32 格（舊的驗收圖是 16×16），兩位玩家的城鎮中心放在以地圖中心為圓心的圓上，角度由種子決定，第二位玩家大致在相對方向。每座基地的資源配置相同，邊緣與內部有隨機生成的樹林，中央有中立金礦與石礦。選單的地圖可以改回 16×16 的草甸、海岸、高地與淺灘。地圖做法參考原作隨機地圖的概念，數值都是 design_default，查核紀錄見 docs/aoe2-rules-research.md。State／snapshot 為 v17，詳見 docs/first-use-016.md。

# 電腦對手與第一場完整對局

紅方由電腦操控（選單的「紅方」可改成「不行動」練習）：
- **經濟**：補村民、蓋住宅與兵營、天然食物用完後蓋農田。
- **升級**：升第二時代，之後訓練弓手。
- **戰鬥**：隨時防守基地；4 分鐘後才分波進攻。

新增農田（Q 住宅、W 兵營、E 農田）：木材 60，可以走上去，只有擁有者能耕作，250 食物耗盡後消失。

地圖的邊緣樹林改為左右對稱，建築格線改為 10 單位。State／snapshot 為 v16。從首次進站一路打到勝利並再開一局的流程是 `npm run test:match`，詳見 docs/first-use-014.md。

# 全畫面遊戲畫面

整頁就是遊戲畫面，配置取法《世紀帝國 II 決定版》，所有模型都是積木：上方資源列（食物、木材、黃金、石頭、人口、時代、遊戲時間、速度、暫停、選單），中間是 3D 戰場，下方由左到右是指令格、選取資訊、小地圖。進站後直接開始，鏡頭對準自己的城鎮中心。存讀、新遊戲、地圖與種子、重播驗證都在「選單」（F10）。頭像與圖示是遊戲內積木模型的即時算圖，沒有使用圖示套件。

逐 tick、狀態指紋、座標移動、迷霧除錯與規則 JSON 驗證器這些開發工具，只在網址加 `?debug=1` 時出現在右側抽屜；除錯模式開局是暫停的、紅方預設不行動，除了 `test:hud` 與 `test:match` 以外的自動測試都用這個模式。詳見 docs/first-use-013.md。以下紀錄保留當時版本。

# 多地形移動沙盒

目前 State／snapshot 為 v15。可建立草甸、海岸、高地與淺灘三種沙盒，兩方起始建築是可以從拱門走進大廳的城鎮中心；可框選、編組多名村民一起移動，單位互不重疊、會排隊讓路；村民可採集樹木、石礦、金礦與野果並送回城鎮中心；可放置、施工與取消住宅和兵營，住宅提高人口上限；城鎮中心生產村民並研究時代，兵營生產近戰民兵與弓手（弓手需第二時代）。HUD 顯示時代、真實庫存與人口。單位可以攻擊敵方單位與建築，摧毀對方所有單位與建築即獲勝，並可再開一局。存讀及 Worker 恢復保留地圖類型。紅方還沒有 AI，只會原地不動，所以還不是完整對戰。詳見 docs/first-use-012.md。

# 高度通行增量

目前 State／snapshot 使用 v8。手工驗收圖有高地與階梯，共用高度資料驅動導航及模型基座；正式沙盒仍為草甸。詳見 docs/heights-verification.md。

# 起始資源配置增量

目前 State／snapshot 使用 v7。生成器驗證雙方可接近的基本資源容量與路程差上限；不代表完整競技平衡。詳見 docs/starting-resources-verification.md。

# 七種資源增量

目前 State／snapshot 使用 v6。七種有限資源與代表模型已加入；採集、狩獵、放牧及捕魚工作仍待實作。詳見 docs/resources-verification.md。以下紀錄保留各輪當時版本。

# 三態視野增量

目前 State／snapshot 使用 v5；一般畫面僅顯示可見敵方與最後已見地物。已探索區保留快照，存讀與重播包含探索紀錄。C 仍進行中，詳見 docs/first-use-005.md。以下各節保留先前里程碑版本。

# 150 · 磚築紀元 / Brick RTS

依 `docs/Brick_RTS_Prompt_Pack` 的 00、01 與部分 02 起步。分類為「遊戲敘事」。本次交付可操作的規則驗證與移動沙盒，尚未實作完整對戰。

## 啟動與建置

需要 Node.js 22.18+、npm；靜態 HTTP server 可用 Python 3。指令從本目錄執行：

```sh
npm ci
npm run validate
npm test
npm run build
# 選用：監看 TypeScript；HTML 修改需重跑 build
npm run dev
```

在 repository root 執行 `python3 -m http.server 8000`，開啟 `http://localhost:8000/web/150-brick-rts.html`。靜態產物已提交於 `web/`，普通瀏覽無須安裝依賴。未使用 CDN 或遠端素材。

瀏覽器回歸沿用 repository 的 Playwright 外部 runtime 方式：

```sh
PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs npm run test:browser
PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs npm run test:rig-browser   # 模型檢視頁
PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs npm run test:first-use     # prompt 19 首次使用流程：滑鼠點選穿過城鎮中心拱門
PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs npm run test:controls       # 框選、編組、右鍵移動、停止、鏡頭平移、觸控
PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs npm run test:economy        # prompt 19 首次使用流程：採木、採野果、送返、存讀
PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs npm run test:build          # prompt 19 首次使用流程：放置、施工、人口、取消退款
PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs npm run test:production     # prompt 19 首次使用流程：生產村民、人口上限、集結點、升時代、兵營與弓手
PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs npm run test:combat         # prompt 19 首次使用流程：造兵、偵查、攻擊、攻城、勝利、再開一局
PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs npm run test:match          # prompt 19 完整對局（非除錯模式、對電腦）：開局、造兵、進軍、攻城、勝負畫面、再開一局
PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs npm run test:hud            # prompt 19 首次進站（非除錯模式）：全畫面配置、資源列、頭像、指令格、小地圖、選單、手機觸控；產生 thumbs/150.jpg
npm run bench:movement   # 3／8／24／40 名穿過城鎮中心大門的負載紀錄，輸出 test-results/movement-benchmark.json
```

執行環境需先安裝該 Playwright 對應 Chromium。測試自行啟動 loopback HTTP server、產生 `test-results/` 截圖；作品集縮圖 `thumbs/150.jpg` 由 `test:hud` 從正式遊戲畫面擷取。

## 操作

畫面：上方資源列，中間戰場，下方左起是指令格（5×3）、選取資訊、小地圖。

1. 選取
   - 左鍵點選單位，或在戰場上拖曳框選；Shift 加選或減選，左鍵點空地取消選取。
   - 左鍵點自己的建築選取建築；H 選取城鎮中心並把鏡頭移過去；「.」或小地圖旁的村民按鈕輪流選取閒置村民（按鈕角落是閒置人數）。
   - Ctrl＋數字儲存編組，按數字叫回；Esc 取消選取。多選時，選取資訊列出每個單位的頭像與血條，點頭像只選那一個，Shift＋點移出選取。
2. 命令
   - 右鍵地面：移動，各自分到目的地附近的站位；點在建築或樹上時走到最近的空地。右鍵樹木、石礦、金礦、野果或己方農田：村民採集，裝滿 10 單位後送回城鎮中心再回來。右鍵未完工的建築：協助施工。右鍵紅方單位或建築：攻擊。
   - S 或指令格的停止：在下一個節點停下。
   - 村民與士兵一起選取時，採集與建造只派出村民，並提示有幾名士兵沒有派出。
   - 狩獵、放牧、捕魚尚未實作，會直接說明原因。
3. 指令格
   - 選取村民時：Q 住宅、W 兵營、E 農田。在戰場上移動滑鼠看占地預覽（綠色可放、紅色會寫出原因），左鍵放置，Shift＋左鍵連續放置，右鍵或 Esc 取消。
   - 選取完工的城鎮中心或兵營時：生產與研究依序是 Q W E R T。已研究的時代會從指令格移除。未完工的建築有取消格（Del），全額退款。
   - 滑鼠停在指令格上，左下角會出現說明卡：名稱、快捷鍵、費用（不足的會標色）、時間、人口，以及不能按的原因。沒有停在指令格上時，這裡寫出目前不能建造或生產的原因。
   - 佇列顯示在選取資訊右側，第一項有進度條，每項都能取消並全額退款。選取建築時右鍵地面設定集結點。
4. 鏡頭與小地圖
   - 方向鍵平移，滾輪或小地圖旁的 +／− 縮放，旋轉鈕每次轉 90 度，F 對準選取的單位。
   - 小地圖依鏡頭方向繪製，白框就是目前看到的範圍。左鍵點或拖曳移動鏡頭；選取單位時右鍵下達移動，選取建築時右鍵設定集結點。
5. 時間
   - F3 或頂列的 ▶／❚❚ 暫停與繼續；速度可切 1×／2×／4×，每個 tick 都會執行。
   - 開啟選單（F10）會暫停，關閉後繼續。背景分頁或視窗失焦會自動暫停；畫面卡頓超過一秒時，遊戲暫時放慢，不會跳過 tick。
   - 選單的「投降」要按兩次才生效；電腦在失去城鎮中心又沒有士兵時也會投降。
6. 選單
   - 儲存／讀取遊戲使用 `brick-rts:sandbox:1` localStorage key；新遊戲不會覆蓋手動存檔。
   - 新遊戲可選地圖（曠野 32×32 隨機出生，或 16×16 的草甸、海岸、高地與淺灘）、紅方（電腦或不行動）與種子。
   - 「驗證指令重播」在當前種子下重跑所有指令，比較完整狀態指紋。
7. 勝負：摧毀對方所有單位與建築即獲勝，畫面顯示結果並可「再開一局」。紅方由電腦操控（或選「不行動」）。
8. 觸控：輕觸單位選取，選取後輕觸地面移動或輕觸資源採集。
9. 單位互不重疊也不互相穿過：會排隊、讓路、同組交換站位；無法前進 300 ticks 會顯示「受阻停止」，目標不可達則停在最近點並顯示「無法到達」。
10. 除錯模式 `?debug=1`：右側抽屜有逐 tick、狀態指紋、村民 1–3 按鈕、X／Y 座標移動、迷霧除錯與規則 JSON 驗證器（驗證、還原、匯出；不套用到遊戲）。

背景分頁、失焦或超過一秒的累積延遲會暫停，避免跳過 tick。模擬不依賴 DOM／Canvas；畫面採独立的種子 stream。移動採整數座標與 31×31 導航節點，單位之間有占位與讓路規則，詳見 docs/first-use-008.md。

## 檔案與追蹤

- `packages/content/rules.ts`：TypeScript schema、原創自訂資料及 unknown-input runtime validator。
- `packages/sim/sim.ts`：固定步進、命令、hash、序列化與重播。
- `apps/web/`：輸入、HUD、Canvas 程序插畫；與權威 state 分離。
- `docs/ruleset-manifest.json`：build 由規則來源匯出，不手動修改。
- `docs/scope-inventory.json`：原作全集獨立目錄與未知分母、首個完整切片目標。
- `docs/feature-ledger.csv`：保留完整提示包條目；只更新有實作的項目。
- `docs/asset-manifest.json`、`docs/completeness-matrix.md`、`docs/verification.md`：素材、缺口與實測證據。

參數全部為 `design_default`。未指定或核對原作版本，不宣稱最新版本、完整內容或精確移植。Canvas 插畫不是已完成的 3D 美術階段；完整功能清單與下一階段見 completeness matrix。

## 後續階段契約

`AGENTS.md` 固定逐階段與首次使用修正流程。版本逐項對照見 `docs/reference-comparison.json`；資料模型見 `docs/data-model.md`；A–J 的機器可讀依賴和完成門檻見 `docs/stage-dependencies.json`。目前 B 階段仍在進行，不能跳成已完成 C／D／E。

`npm run sim:headless -- 260925 10000` 執行真實無畫面命令、tick、存讀續跑與重播一致性檢查，並輸出觀測到的 tick CPU 耗時。量測不參與權威狀態，不代表浏览器 FPS 或整合式 GPU 驗收。首次使用證據見 `docs/first-use-001.md`。

## Worker 里程碑

瀏覽器已使用真正的 Dedicated Worker 執行模擬。建置產物必須同時包含 `web/assets/150-brick-rts/main.js` 與 `worker.js`。Worker 故障會暫停並顯示「重試模擬連線」，恢復至最後確認 tick；未確認的指令不會自動重送。首次使用與故障注入記錄見 `docs/first-use-002.md`。

## Navigation milestone update (2026-09-25)

The latest implementation supersedes earlier no-collision notes: `packages/sim/navigation.ts` supplies shared static house/tree/rock footprints and deterministic routing. State v2 includes map, pathJobs, frontier/parents/head, unit path and navigation status. All jobs share 32 node expansions per tick in stable order. Runtime defaults are recorded in `docs/runtime-manifest.json`; they are not reference-game values. Static obstacle clearance is implemented, but unit-to-unit avoidance, dynamic occupancy, formations, full resource economy and match completion remain pending.

Snapshots now use sandbox v2. Old v1 snapshots are explicitly rejected without changing the live state; no migration is claimed. Full RTS collision and match gates remain open. See `docs/first-use-003.md`.

## Resource transaction foundation

`packages/sim/economy.ts` now backs authoritative accounts and queued reserve/cancelReservation commands. This API is tested headlessly; it does not add fake building/training controls. Snapshot v3 includes account history and command admission ticks; older sandbox snapshots are explicitly incompatible. See docs/economy-verification.md. The B foundation gate now has evidence for atomic resource handling; C is the next implementation stage.

## C: 3D scene milestone

The gameplay page now renders real WebGL2 geometry through the locally vendored Three.js 0.186.0. Serve the repository root so `/vendor/three-0.186.0/` remains available; no CDN is used. `web/150-brick-rts-models.html` is a separate asset viewer, not a game mode. It shares the same scene generator, rotation, near/far detail and live renderer counters.

Static obstacle footprints remain authoritative in navigation.ts. Camera controls and walk animation do not decide movement. WebGL failure pauses input; an existing Worker stays available for saving before reload. This is the first C rendering slice; resources, fog, full village/army assets and all later gameplay remain incomplete.
# 地格與資源資料增量

目前 State／snapshot 使用 v4。地格資料、樹木／石塊有限容量、耗盡原語與局部導航更新已接入並驗證；村民採集玩法尚未提供。舊版存檔會明確拒絕，尚無遷移。詳見 docs/terrain-verification.md；C 階段仍在進行。
