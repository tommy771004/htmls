# 大廳第三項：交易與組隊（評估，尚未實作）

2026-11-11 寫。這份文件只做評估：不改程式，使用者決定方向後才動手。

## 現況

- 遊戲是單機模式（`Lh = true`）。存檔在瀏覽器 localStorage，登入後把整包存檔上傳到 `/api/ro/save`，用 `rev` 防止互相覆蓋。伺服器只保存這包資料，**不會檢查裡面的內容**，所以裝備、卡片、礦石與 Kafra 點數都由用戶端說了算。
- 引擎原本有完整的線上交易與組隊程式，但前提是**伺服器擁有庫存**：
  - 交易（大廳協定）：
    - 用戶端送出 `tradeReq`、`tradeReply`、`tradeOffer`（`{gear:[uid], cards:[[id,n]], ores:[[id,n]], kafra}`）、`tradeLock`、`tradeConfirm`、`tradeCancel`、`tradeChat`。
    - 伺服器回 `tradeAsk`、`tradeOpen`、`tradeOffer`、`tradeState`、`tradeDone`、`tradeEnd`。
    - 收到 `tradeDone` 時，用戶端只執行 `settled()`（`y1()` → `xr()`：`GET save`，版本不同就套用伺服器那份存檔），自己不改庫存。能放上交易的物品也以伺服器那份帳號（`b1()`）為準。
  - 組隊（大廳協定）：
    - 用戶端送出 `partyInvite`、`partyReply`、`partyLeave`、`partyKick`、`partyLead`、`partyGo {trip}`、`partyReady`，跨大廳另有 `partyInviteFar`、`partyJoinFar`、`partyReplyFar`。
    - 伺服器回 `party`、`partyAsk`、`partyAskFar`、`partyCheck`、`partyCheckEnd`、`partyStart`、`partyErr`。
    - 隊伍頻道聊天是 `chat` 的 `ch:"party"`。
  - 合作關卡：開打後改連另一條「本局」WebSocket（`runWelcome`、`runJoin`、`runLeave`、`runHost`，資料包是 `run {d}`）。房主跑模擬，伺服器負責轉送；結算走 `POST /api/run`，由伺服器發獎勵。
- 目前的建置版在 `tools/build.mjs` 把選單上的「交易」「組隊」拿掉了，大廳伺服器也不處理上面這些訊息。

## 核心問題：庫存在用戶端

只要庫存還是用戶端說了算，伺服器就無法確認對方真的擁有拿出來交易的東西。作弊的人可以：

- 改 localStorage，憑空造出物品；
- 交易後還原舊存檔（或在另一台裝置用舊的那份），讓同一件物品出現兩次。

伺服器不能信任「交易後的存檔」，因為存檔本身就是玩家可以改的東西。

不過目前**沒有排行榜、拍賣場或任何多人比較**，所以作弊的損害只在作弊者自己和他的交易對象身上。如果以後加入排行榜或市場，這個問題就會變得嚴重。

## 交易的三個方案

工作量都是粗估，實際要看引擎程式能沿用多少。

| 方案 | 做法 | 工作量 | 風險 |
| --- | --- | --- | --- |
| A. 互送（不保證） | 大廳只轉送雙方的出價與確認，各自在本機扣除、加入物品，再上傳存檔 | 約 2–3 天（轉送、交易視窗、斷線處理、兩邊存檔衝突） | 可複製、可憑空造物；斷線時可能一邊扣了另一邊沒拿到。只能明講是「好友互送、不保證」 |
| B. 伺服器保管交易物品 | 物品先存進伺服器（Neon 新表），交易在伺服器上轉移，再領回本機 | 約 1 週 | 擋得住交易途中的複製；擋不住存入前就造假的物品，因為物品來源還是用戶端 |
| C. 伺服器擁有遊戲規則（引擎原本的線上模式） | 掉落、買賣、精煉、結算全部搬到伺服器，庫存以伺服器為準；引擎的交易與組隊程式就能照原樣使用 | 數週以上（要把戰鬥獎勵、商店、精煉、無盡之塔等規則寫成伺服器端，並遷移既有存檔） | 改動最大；單機、離線遊玩要另外保留一條路 |

## 組隊的兩個方案

| 方案 | 做法 | 工作量 | 風險 |
| --- | --- | --- | --- |
| A. 只組隊不開打 | 在大廳的 Durable Object 處理邀請、隊伍名單、隊長、隊伍頻道（用引擎原本的訊息與介面） | 約 1–2 天 | 小，和現在的好友功能同一套 |
| B. 合作關卡 | 再加上「本局」房間（每一局一個 Durable Object 或同一個物件分房），轉送房主的模擬資料；獎勵各自在本機結算 | 約 1–2 週（先確認引擎的合作程式在單機模式下能不能跑、房主斷線換人、延遲） | 獎勵和單機一樣由用戶端決定，作弊面不變；Cloudflare 免費方案對 Durable Object 的請求與 WebSocket 訊息有每日額度，合作關卡的封包量要先估算 |

## 使用者的決定（2026-11-12）

- ③ 先做「組隊＋合作打關卡」。
- 交易走「全面改成伺服器權威」（方案 C）。
- 近期會加排行榜／市場，所以獎勵與庫存最後都要由伺服器說了算。

## 引擎原本的線上架構（逆向整理，做 C 時的依據）

以下是從用戶端程式推測的，原版伺服器的程式我們沒有。

- **存檔**：`PUT save {rev, doc, wid, lite, mine?, run?, wipe?}`。用戶端仍然送整份存檔，`run` 是這次要領的關卡憑證（`claim`）；伺服器可以回修正過的 `doc`。所以原本的伺服器是「**驗證存檔差異**」：拿舊存檔、新存檔與關卡憑證比對，增加的東西不能超過那一關允許的上限。原版伺服器的程式我們沒有，這段驗證要自己寫。
- **關卡憑證**：開打時 `POST run {stage, mult, played?}` 拿 `run`；跳關 `POST run {stage, skip:true, char}`。
- **經濟操作**（伺服器直接改存檔、回 `{rev, doc, trade}`）：`POST op`，`op` 是 `buy`、`sell`、`refine`、`mail`、`towerReset`。
- **無盡之塔**：另開 `?endless=1` 的 WebSocket，送 `start {token, charId, wave, engine, build}`，再持續送操作紀錄（moves／checks／picks），斷線用 `resume` 接回。伺服器會**用同一份引擎重跑一次**來驗證，難度最高。另有 `GET endless`、`POST endless/upgrade`、`POST endless/skills`。
- **排行榜**：`GET ladder?season=&job=`。
- **其他**：`GET mail`、`POST mail/read`、`POST mail/delete`、`POST name`、`POST questions`、`POST visit`、`POST crash`、訪客相關。
- **合作關卡**：組隊在大廳的 WebSocket 上進行（大廳 hello 已帶分頁的 `key` 與 `lb`）。`partyStart` 之後，每個分頁另開 `ws-run?l=<大廳>`，hello 帶同一個 `key` 與 `run:true`，伺服器靠 `key` 把它對到大廳連線所屬的隊伍。房主跑戰鬥模擬，伺服器只轉送 `run {d}`，以及 `runWelcome`、`runJoin`、`runLeave`、`runHost`、隊伍聊天。掉落分配（`rollItems`）、傷害統計等都在房主端。

## 分階段

| 階段 | 內容 | 伺服器 | 粗估 |
| --- | --- | --- | --- |
| 1 組隊 | 邀請、接受、離隊、踢人、換隊長、隊伍頻道、出發前確認（`partyGo`／`partyReady`／`partyCheck`／`partyStart`） | 大廳 Durable Object | **完成（2026-11-12，待部署）** |
| 2 合作關卡 | `ws-run` 房間轉送、房主斷線換人、重連；獎勵暫時仍由各自的用戶端結算 | 同一個 Durable Object（以隊伍分房） | **完成（2026-11-12，待部署）**；實測房主每秒約 20 則、隊員約 10 則 |
| 3 伺服器權威：存檔驗證 | 啟用引擎的線上模式（`Lh=false`、真的 `nt()`）；`POST run` 發憑證；`PUT save` 驗證差異；`POST op` 的買賣、精煉 | Vercel＋Neon（線上存檔在 `ro_game_save`） | 2–4 週；**3a 完成（2026-11-12，待套表）** |
| 4 交易 | 引擎原本的交易協定，成交時伺服器在 Neon 的同一個交易裡改雙方存檔 | 大廳 DO 撮合＋Neon 結算 | **完成（2026-11-12，預設關閉，待開啟）** |
| 5 排行榜 | `GET ladder`；只收階段 3 驗證過的成績 | Vercel＋Neon | 數天 |
| 6 無盡之塔重跑驗證 | 伺服器端無頭跑引擎驗證操作紀錄 | 待評估 | 待評估（先做技術驗證） |

### 2026-11-12 追加調查（階段 3 開工前）

- **單機模式（`Lh=true`，`Mt()` 為真）和線上模式的差別**：
  - 單機的角色建立時就是 Base 60／Job 50、身上有 tier 3 的隨機詞綴裝備，標記 `dev: true`；全部職業與「二轉大師」NPC 都開放。
  - 單機的天賦重置免費、染色不受限，選項裡是「刪除測試資料」。
  - 單機沒有雲端存檔、訪客帳號、關卡憑證，也不能進無盡之塔（要登入的 token）。
- **存檔內容**：`characters.v1`（角色陣列：等級、經驗、天賦、屬性、裝備欄位、紀錄）、`account.v1`（`inventory` 物品陣列，每件有 uid、itemId、卡槽、quality、ilvl、tier、隨機 `affixes`；另有 `cards`、`materials`、`kafra`、`unlocks`）、`achievements.v1`、`pets.v1`、`run.v1.<角色>`、`stages-seen.v1.<角色>`。值都是 JSON 字串。
- **一般關卡只送** `POST run {stage, mult, played}` 拿憑證，結束時在 `PUT save` 帶憑證。**沒有上傳操作紀錄**，所以原版伺服器對一般關卡大概只能做「合理範圍」檢查（掉落數量、ilvl、詞綴範圍），擋不住小心的作弊者。
- **無盡之塔**才會串流操作紀錄（moves／checks／picks），引擎有確定性亂數（xoshiro128**）與軟體浮點數，原版的管理面板能把某一局「重播成 demo」（`api/admin/endless-run/<id>`，依 build 版本保存舊的頁面）。所以無盡之塔是伺服器重跑驗證。
- **排行榜（`GET ladder`）只排無盡之塔**（樓層、分數），引擎上寫「排行榜只收伺服器驗證過的對局，需要註冊帳號」。所以**排行榜要先有階段 6 的重跑驗證**，順序要調整。
- **合作關卡**是房主模擬、網路輸入，無法重跑；獎勵要另訂規則（例如由大廳物件簽一張「這一趟」收據，存檔 API 驗收據）。

### 2026-11-12 技術驗證：無盡之塔重跑（已通過）

- 方法：做一份不壓縮的暫時 build，把引擎的 `hr()`（開局，帶第 7 個參數就是重播）掛到 `window`。第一個分頁用固定 seed 開無盡之塔即時玩約 40 秒，取出每 tick 的移動輸入（`z.moves`）、選卡（`endless.picks`）、每 30 tick 的檢查碼（`z.checks`）與最後的 `stateHash()`；第二個分頁載入同一份存檔後重播。
- 結果：2,430 tick、81 個檢查碼全部相同，最後的 hash 一致（`9214ebfb`）。重播 364 ms（約每秒 6,700 tick，比即時快 30 倍）。
- **不用 GPU 也行**：無頭 Chrome 關掉 GPU（SwiftShader），開頁約 1 秒＋重播約 0.5 秒。
- **竄改會被抓到**：改一個 tick 的輸入，hash 不同，並指出第一個對不上的檢查碼（第 1020 個 tick 附近）。
- 還沒驗：長局（後段怪物多，每 tick 會變慢）、Node 不開瀏覽器直接跑（引擎和 PixiJS／three.js 綁在一起，要大量替身，不建議）。
- **重播要用同一版引擎**：存操作紀錄時要記 build 版本，驗證時載入同一版頁面（原版也是依 build 保存舊頁面）。
- **角色也要可信**：重播用的角色（等級、裝備）如果來自玩家自己的存檔，可以先改存檔再打。所以排行榜要用「線上角色」（伺服器保存、從 Lv1 練起），順序是：線上角色 → 無盡之塔＋重跑驗證 → 排行榜。

驗證主機的選項：

| 做法 | 延遲 | 費用 | 備註 |
| --- | --- | --- | --- |
| GitHub Actions 定時跑 Playwright | 5–30 分鐘 | 公開倉庫免費 | 要在倉庫設 Neon 連線字串當 secret；排行榜先顯示「驗證中」 |
| Cloudflare Browser Rendering | 幾秒 | 免費額度很小，付費方案另計 | 用使用者的 Cloudflare 帳號 |
| 使用者自己的常開電腦 | 幾秒 | 免費 | 電腦要一直開著 |

**使用者的決定（2026-11-12）**：單機與線上分成兩條（單機全解鎖保留、不上榜不交易；線上角色從 Lv1 練起、伺服器把關）；舊的雲端存檔留著當單機存檔；先做無盡之塔＋排行榜；重跑驗證放在**使用者自己的電腦**（定時取待驗證的對局、跑無頭 Chrome、把結果寫回資料庫）；順序是**線上角色 → 無盡之塔 → 排行榜**。

階段 3 是關鍵，也是最大的未知數：存檔格式、每一關的獎勵上限、精煉與商店價格都要從引擎裡整理出來，寫成伺服器端規則。階段 2 的獎勵在階段 3 之前仍然可以作弊，這和現在的單機模式一樣。

### 2026-11-12 線上角色第一步（3a：只記錄不擋）完成

- 後端 `server/ro-life/game.mjs`（`/api/ro/game/…`）、新表 `ro_game_save`／`ro_game_run`／`ro_game_log`（`schema.sql` 檔尾，要使用者自己套用，再在 Vercel 設 `RO_ONLINE=1`）。
- 頁面：登入後「單機／線上」切換；線上角色從 Lv1 開始，存檔進 `ro_game_save`，每次存檔的變化與疑點寫進 `ro_game_log`。
- 本機實測（記憶體資料）：建角 Lv1、非 dev；開打 1 個 `POST run`、結算時領取憑證並記下關卡；關卡中 30 秒只有 1 個請求、廣場閒置 60 秒 0 個；登入失效時重新載入一次退回單機、不跳視窗；單機模式與素材 CDN 照常。
- 刻意留在本機（3b 再搬）：買賣、精煉、信箱、無盡之塔。

**3b 下一步**：用 `ro_game_log` 的實際資料訂規則，依序改成伺服器裁決——① 新角色只能 Lv1＋新手裝備；② 經驗、等級、掉落只能透過領取憑證增加，上限依關卡與 `mult`（要從引擎整理每關怪物經驗與掉落表）；③ `op` 的買賣、精煉改由伺服器計算（價格表 `xy`、精煉機率 `uk` 等搬到伺服器）；④ 裝備、屬性點只能重新分配不能憑空增加。先記錄模式跑一段時間，確認正常玩家不會被誤擋再開啟擋下。

### 2026-11-12 3b 第一部分：規則資料＋影子模式驗證

- 使用者決定：線上模式繼續對所有人開放、不清檔；合作關卡與無盡之塔對線上角色照給獎勵、只記錄；違規時伺服器默默修正（回傳修正後的 doc）。
- 憑證強化：存檔與領憑證在同一個 SQL 語句（409 不會用掉憑證）；接續中斷的關卡沿用原本的開打時間；`mult` 限制在引擎難度倍率的範圍 1～2。
- 規則資料：`tools/dump-rules.mjs` → `server/ro-life/rules-data.mjs`（經驗曲線、能力點、職業上限、237 件道具、93 隻怪、9 個關卡的出怪表、礦石價格、精煉機率）。
- 驗證：`server/ro-life/game-rules.mjs`。①～②（新角色、經驗、掉落）與 ④（能力點）已做；③ 的買賣與精煉目前只核對帳目（Kafra 只能來自賣價、材料要花點數、精煉要用掉礦石），精煉機率仍在用戶端。
- 經驗上限：有關卡憑證時是「該關出怪速度 × 3 × 小怪最高經驗 × 2 × 開打秒數＋清場與頭目」，沒有憑證時（合作、無盡之塔）用全部關卡最快的速度 × 距上次存檔秒數。實測正常玩 32 秒拿 6 經驗、上限 1.8 萬，所以這個上限只擋得住直接改存檔；之後用 `ro_game_log` 裡 `detail.fix` 的 `ratio` 收緊。
- 已知限制：沒有憑證的存檔只能用最寬的速度估（作弊者可以不帶憑證，約每 2 分鐘多 14 萬經驗）；精煉成敗仍由用戶端決定；物品數量上限 30＋每 5 秒一件。
- 開 `RO_ONLINE_ENFORCE=1` 之前要確認：① 正式站影子模式跑一段時間，`SELECT detail->'fix' FROM ro_game_log WHERE 'would-fix' = ANY(flags)` 沒有正常玩家；② 用 `detail->'cap'`（每次有經驗的存檔都記 `{cap, window, gain}`）看實際 gain／cap 的分布，再決定要不要收緊；③ 用真的頁面走一遍買礦、精煉、賣裝備、配點、點天賦、打到有掉寶（目前只核對過引擎程式碼與單元測試）；④ 二轉天賦的點數規則補進規則資料（目前轉職角色不查天賦）。
- **下一步**：照上面確認完再設 `RO_ONLINE_ENFORCE=1`；接著把買賣、精煉改成伺服器 `op`（精煉亂數在伺服器），恢復 `Hl()`，`GET mail` 先回 `{mail:[],pending:0}`。

### 2026-11-12 3b 第二部分：收緊上限＋買賣精煉搬到伺服器

- 查引擎確認：線上模式下合作關卡也走 `hr()` → `Zq()` → `wL()` 發憑證，中斷關卡的結算經過 `SL()` 也會帶憑證，無盡之塔線上角色進不去，角色經驗只有關卡結算一個來源。所以**沒有憑證的存檔不給經驗、新物品、新卡片**。
- 經驗上限 `runExpCap()`：逐秒累加「該關當下波次的出怪速度 × 出怪數（由難度倍率推回，最多 3）× 3 人隊倍率 3.85 × 最高怪物經驗 × 等級差係數」，加上大群（每 120 秒／事件數）、菁英多出的 4 倍（每 45 秒／事件數）、已出場的魔王，再 ×1.25。普隆德拉 32 秒、難度 1 的上限從 18,803 降到 204（實際約 6）。組隊人數不需要用戶端報：作弊的人一定報最大，所以直接用 3 人隊。
- 一張憑證只給一個角色；轉職後職業經驗不再增加；職業經驗上限照該關的 `jobExp` 倍率。
- 天賦照引擎 `QE`／`JE`：每個職業一棵樹，角色職業的樹＝職業等級、同職業線前面的職業給滿點、其他 0 點，每項不超過 `maxRank`（天賦表從引擎 `Ze` 倒出）。轉職不會改 `job`，所以轉職角色也照這個規則檢查。
- 買賣、精煉、信箱：恢復 `Hl()`，引擎改走 `POST game/op`（`server/ro-life/game-ops.mjs`），精煉亂數在伺服器；存檔裡的 Kafra、材料、精煉值只能變少。
- 真實頁面實測（影子模式、本機記憶體資料）：建角配點 → 伺服器買礦、賣出、精煉 → 點天賦 → 打關卡，全程沒有 `would-fix`；強制模式下改存檔的 Lv80、Kafra 999999 完全擋下，畫面也同步回 Lv1。
- 還沒做：掉寶在真實頁面上沒實際撿到過（只對過引擎 `Dh()` 的格式）；排行榜、無盡之塔的伺服器重跑；信箱內容。


### 2026-11-12 3c：掉寶實測、無盡之塔與排行榜

- 掉寶實測：真實頁面打普隆德拉（關卡內無敵、怪物一擊死，好打到魔王），撿到魔王掉的品質 1 帶詞綴裝備，存檔沒有 `would-fix`；1,364 隻怪的經驗 3,446，上限 70,712。另外修正：傳說品質（4）有 5 條詞綴（`Dy` 加特殊詞綴），規則改成照品質的 `affixMax`；二轉職業樹只能點專精的分支（引擎 `r5`）。
- 大廳實測：兩個線上角色互加好友、查看對方裝備、郵差信箱（空的），沒有錯誤。
- 無盡之塔改走 HTTP（`server/ro-life/endless.mjs`，見 282 `CLAUDE.md` 線上段落），新表 `ro_endless_run`／`ro_endless_chunk`／`ro_endless_progress` 在 `schema.sql`。真實頁面實測（記憶體資料，Metal 顯卡）：開局 → 打 30～70 秒 → 結束回 `pending` → 驗證程式在另一個無頭 Chrome（SwiftShader）重跑，雜湊全部對上、分數一致 → `verified`、上排行榜；存起來再接續的那場也對得上；關卡中把自己設成無敵的那場在第 900 格對不上 → `unranked`。
- 長局實測：8 分鐘、通過 7 層、打倒 7 隻頭目、選卡 16 次、28,821 格，960 個雜湊全部對上，分數 155,044 與點數 +8 照重跑結果入帳；帳號裡沒穿的裝備、卡片、Kafra 都沒被動到。第 10 層的 MVP 與第 9 層換怪物圖後來由自動打塔腳本補測（見下）。
- 存檔規則補上：打倒的 MVP、通過的關卡只能跟著該關憑證；轉職只能在 `prt_castle` 的憑證下（塔的開放樓層靠這些）。塔要在 `RO_ONLINE_ENFORCE=1` 之後才開得起來。已通過的樓層可以 ×2／×4 快轉，所以牆鐘上限是 4 倍。
- 自動打塔＋自我測試（`tools/endless-bot.mjs`，用法見 282 `CLAUDE.md`）：獵人（70 級、塔用技能箭矢暴雨／箭雨／衝鋒箭／二連矢）13 分鐘、第 100 秒中斷再接續，打到第 12 層（通過 11 層，含第 10 層 MVP），43,878 格、1,462 個雜湊全部對上 → `verified`，分數 339,164、點數 +16、排行榜第 1；帳號沒被動到、存檔沒被修正。不帶塔用技能時第 1 層的分數門檻過不了（塔內沒有經驗，等級＝通過樓層數＋1）。
- 跨瀏覽器核心：WebKit 26.5（Safari／iPhone 的核心，Playwright）錄 2.5 分鐘、通過 2 層，Chrome 重跑 300 個雜湊全部對上 → `verified`。引擎的 `Math.hypot`／`sin`／`cos` 在這兩個核心上結果一致，不用換數學函式。Firefox 還沒測。
- 上線步驟（使用者）：套用 `schema.sql` → 確認影子紀錄沒有誤判後開 `RO_ONLINE_ENFORCE=1` → Vercel 設 `RO_ENDLESS=1` → 定期在自己電腦跑 `node --env-file=.env.local games/282-ro-life/tools/verify-endless.mjs`（先加 `--dry` 看結果）。每位玩家在塔裡每 10 秒送一次操作（一次 Vercel 呼叫）。

### 2026-11-12 階段 4：交易（伺服器權威）

- 做法照方案 C：大廳（`server/ro-life/lobby-trade.mjs`）用引擎原本的交易協定撮合，雙方確認後打 Vercel 的 `POST /api/ro/trade/settle`（`server/ro-life/trade.mjs`，HMAC 簽章、交易 id 冪等），在兩邊的 `ro_game_save` 上搬東西，一個 SQL 交易寫完（任一邊 rev 不符整筆回滾），兩邊各記 `ro_game_log` kind `trade`。不用新表、不用 DDL。細節見 282 `CLAUDE.md` 大廳段落。
- 只限線上角色；可交易的是沒裝在身上、沒上鎖、不是新手裝備的物品，以及卡片、礦石、Kafra。給對方看的裝備在結算時逐件比對伺服器上的那件，造假就 `missing`。
- 測試：`trade.test.mjs` 10 項（清單、出價清理、結算、造假、冪等、rev 被搶重讀、端點簽章與時效、大廳撮合全流程、逾時、斷線）；PGlite 驗證兩邊 rev 任一不符都整筆回滾（只證明 rev 不符時回滾，不是真的併發壓測）。
- 真實頁面雙人實測（本機記憶體資料）：A 從選單點「交易」→ B 接受 → A 放 +2 劍與 1 張卡、B 放 3,000 Kafra → 雙方 OK、確認 → 伺服器結算，兩邊頁面自動套用新存檔、聊天框顯示交易內容；之後的存檔沒有被修正、沒有錯誤或彈窗。
- 交易後把給出去的那件加回存檔：新物品規則本來就要求精煉 0、沒插卡、品質與 ilvl 在該關範圍內，所以最多等於在關卡憑證下偽造一件普通掉落（和交易無關的既有風險，物品數上限目前只記錄）。
- 開啟步驟（使用者）：Vercel 設 `RO_TRADE=1` 並重新部署 → Worker 的 `wrangler.toml` `[vars]` 加 `RO_TRADE_URL = "https://htmls-ruddy.vercel.app/api/ro/trade/settle"` → 在 `worker/` 執行 `npx wrangler deploy`。只做其中一邊時交易不會出現（Worker 沒設就不送 `trade`）或結算一律失敗（Vercel 沒開回 404，大廳回「已取消」）。


### 2026-11-12 市場＋信箱（規格，實作中）

- 順序：信箱 → 市場（市場的收款與到期退回走信箱）。只限線上角色；開關 `RO_MARKET=1`＋兩張新表（`to_regclass` 檢查），沒開時信箱照舊回空、`op:mail` 回 `missing`，頁面不出現市場鈕、不發請求。
- 新表（`schema.sql`，使用者自己套）：
  - `ro_game_mail(id bigint identity, account_id, kind 'notice'|'gift'|'recovered', title jsonb {es,en,zh}, body jsonb {es,en,zh}, attach jsonb {gear:[物品], cards:{id:n}, ores:{id:n}, kafra}, ref text UNIQUE（冪等）, created_at, read_at, claimed_at, deleted_at)`
  - `ro_market(id bigint identity, seller_id, seller_name, kind 'gear'|'card'|'ore', item_id, item jsonb（gear 才有，cleanItem 後）, count, price bigint, status 'open'|'sold'|'cancelled'|'expired', buyer_id, created_at, expires_at, closed_at)`
- 引擎信箱的格式：`GET mail → {mail:[{id(數字), kind, title, body, at, read, claimed, attach}], pending}`；`POST mail/read`（全部已讀）；`POST mail/delete {id}` 回新的 `{mail, pending}`（只能刪沒有待領附件的）；`op:'mail' {id}` 領附件 → `{rev, doc, trade}`，已領或沒有回 `missing`。
- 市場 op（POST game/op，都回 `{rev, doc, trade, …}`，引擎照 `ei()` 套用）：
  - `marketList {uid}` 或 `{card, count}` 或 `{ore, count}` ＋ `price`：從存檔拿出（可交易的才行）→ 新增上架；每人最多 `MARKET_MAX_LISTINGS` 筆。
  - `marketBuy {id}`：上架中、沒過期、不是自己的；扣買家 Kafra、物品進買家存檔、上架改 sold、賣家收到一封信（Kafra＝價格扣 `MARKET_FEE` 手續費，ref `market-sold-<id>`）。
  - `marketCancel {id}`：自己上架中的 → 物品回存檔。
  - 到期（`MARKET_DAYS`）：賣家開市場或信箱時，把自己過期的上架改 expired 並寄回（ref `market-expired-<id>`），一句 SQL。
- 讀取：`GET game/market?kind=&q=&page=`（上架中、沒過期，價格低到高，每頁 `MARKET_PAGE`）、`GET game/market/mine`。回傳只有清理過的物品樣子與賣家名。
- 每個 op 一個 `sql.transaction`：存檔照 rev 改寫＋上架／信件那一列的變更＋最後一句確認（以這次的 wid 或買家 id 判斷），否則除以零整筆回滾。
- 常數：手續費 3%（Kafra 回收），上架 7 天，每人 20 筆，價格 1～10 億 Kafra，每頁 40 筆。
- 風險（開啟前要知道）：物品數上限目前只記錄，關卡憑證下偽造的普通掉落可以在市場換成別人的 Kafra。
