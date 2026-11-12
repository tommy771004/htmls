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
| 3 伺服器權威：存檔驗證 | 啟用引擎的線上模式（`Lh=false`、真的 `nt()`）；`POST run` 發憑證；`PUT save` 驗證差異；`POST op` 的買賣、精煉 | Vercel＋Neon（存檔已在 `ro_save`） | 2–4 週 |
| 4 交易 | 引擎原本的交易協定，成交時伺服器在 Neon 的同一個交易裡改雙方存檔 | 大廳 DO 撮合＋Neon 結算 | 1 週 |
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

階段 3 是關鍵，也是最大的未知數：存檔格式、每一關的獎勵上限、精煉與商店價格都要從引擎裡整理出來，寫成伺服器端規則。階段 2 的獎勵在階段 3 之前仍然可以作弊，這和現在的單機模式一樣。
