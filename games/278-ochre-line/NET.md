# 赭線多人連線

五對五，玩家自己選邊，人數不足由電腦補滿。流程照 127 青雀：六位數房號、邀請網址 `?room=`、選邊、房主開賽、斷線保留席位 30 秒後由電腦接手、主動離開立刻交給電腦。127 的 Neon 資料庫加每秒輪詢太慢，射擊遊戲用不上，所以傳輸改成 200 的做法：本機 Node 伺服器與 Cloudflare Durable Object 共用同一份房間邏輯。

## 架構

| 部分 | 檔案 | 做什麼 |
| --- | --- | --- |
| 房間邏輯 | `src/net/core.js`（`RoomCore`） | 名單、選邊（每邊最多 5 人）、開賽名單（真人依加入順序，空位填電腦）、斷線保留、主機轉送。不碰網路，不跑遊戲 |
| 本機伺服器 | `../../server/ochre/server.mjs`（`createOchre()`） | 掛在 `npm start` 的 8127 埠（jade 伺服器的 `onUpgrade` 鏈），路徑 `/api/ochre/room/<房號>` |
| Cloudflare | `worker/index.js`、`worker/wrangler.toml` | 每個房號一個 `Room` Durable Object，同一份 `core.js` |
| 瀏覽器連線 | `src/net/client.js` | 找伺服器、進房、心跳、斷線重連（150 ms 起退避）、`NET` 狀態 |
| 遊戲同步 | `src/net/sync.js` | 主機廣播快照與事件、客戶端回報；掛在 `world.net` 的掛鉤 |
| 大廳畫面 | `src/ui/net.js` | 主選單「連線」分頁 |

**主機是開房者的瀏覽器**：照單機規則跑整場（電腦、回合、經濟、傷害、投擲物），伺服器只轉送。好處是單機的程式全部沿用；代價是房主離開比賽就結束（其他人回到房間，房主交給下一個人），以及房主的網路會影響其他人。

- 客戶端自己的移動、開槍、命中判定在本機算，不等網路（打中先噴血、亮命中標記），把「打中誰、哪個部位」回報給主機，主機檢查射手與目標都活著、武器是自己的、距離在射程內，才用 `damage()` 扣血。
- 其他人照主機的快照擺，延遲 100 ms 內插（`sync.js` 的 `DELAY`），跑步時看到的位置約落後 0.5 m。主機看遠端玩家也一樣。
- 投擲物：丟的人回報起點與初速，每台機器各自模擬彈跳與煙霧，破片傷害只有主機算，閃光致盲每台各算自己。
- 安裝、拆除、丟裝藥、購買：客戶端送要求，主機檢查後執行，結果跟著快照回來。購買要等主機確認（約一個來回）才拿到槍。
- 回合序號 `rs`：主機每開一個回合加一。客戶端看到變了就照快照重置（位置、裝備、隊伍，換邊也走這條）；主機丟掉回合序號不對的客戶端訊息，上一回合晚到的位置不會把人拉回去。
- 連線對戰不會暫停：Esc 打開的畫面只是放開游標，角色站在原地。
- 主機分頁切到背景時 `requestAnimationFrame` 會停，`main.js` 改用 Worker 計時器推進（不渲染），其他人的比賽不會停。

## 協定（JSON over WebSocket）

連線：`/api/ochre/room/<六位數>?name=&token=&create=1`。`token` 是每個分頁、每個房號一個（sessionStorage），重整或換線時接回原席位。`create=1` 遇到有人的房號回 `taken`；不帶 `create` 遇到空房回 `notfound`。

| 方向 | 訊息 |
| --- | --- |
| 伺→客 | `welcome { id, code, host, phase, players, roster, diff, n }`、`lobby { … }`（名單有變就廣播） |
| 伺→客 | `start { roster, n, diff, host }`：名單 10 格 `{ team, pid, name }`，`pid` 0 是電腦；`n` 是第幾場 |
| 伺→客 | `ended { why }`：`over` 正常打完、`hostleft` 房主離開、`hostgone` 房主斷線超過 20 秒 |
| 伺→客 | `hostwait { ms }`、`hostback`；錯誤 `notfound`／`taken`／`full`／`replaced`／`idle`／`err { why }` |
| 客→伺 | `side { side }`（大廳選邊；比賽中挑一個那邊的電腦席位接手）、`start`、`diff`（房主）、`quit`、`ping { c }` |
| 伺→主機 | `claim { pid, slot, name }`（真人接回或接手席位）、`gone { pid }`（斷線）、`bot { slot }`（斷線超過 30 秒，交給電腦） |
| 主機→全部 | `s { n, g, a, e }` 快照，32 Hz（每 2 tick） |
| 客戶端→主機 | `st { n, r, s, e }`，32 Hz；伺服器加上 `from` 轉給主機 |
| 主機→伺 | `over`（比賽結束，房間回大廳）、`to { pid, m }`（指定對象，目前沒用到） |

快照 `g`：階段索引（buy live planted post over）、剩餘秒數、回合、比分×2、回合序號、能否購買、勝方、裝藥 `[x,y,z,炸點,剩餘]` 或 0、地上的裝藥 `[x,y,z]` 或 0。

快照 `a`（每人 20 欄）：x y z yaw pitch vx vy vz、旗標（1 活著、2 蹲、4 著地、8 帶裝藥、16 拆彈鉗、32 頭盔、64 瞄準中、128 安裝中、256 拆除中）、血、甲、錢、手上武器、主武器、手槍、投擲物（逗號分隔）、擊殺、死亡、隊伍、名字。

事件 `e`（主機）：`['f', 席位, 武器, x,y,z, 打中人]` 開槍、`['k', 擊殺者, 陣亡者, 武器, 爆頭]`、`['h', 中彈者, 射手, 傷害, x, z]`、`['e', 勝方, 原因, 落敗獎金, mvp]` 回合結束、`['p', 席位, 炸點]` 安裝、`['c', 席位]` 撿起裝藥、`['b', 席位, 品項]` 購買成功（只給遠端玩家）、`['n', 席位, 種類, x,y,z, vx,vy,vz]` 投擲。客戶端忽略自己席位的 `f`、`n`（本機已經演過）。

客戶端 `st.s`：x y z yaw pitch vx vy vz、旗標（1 蹲、2 著地、4 安裝中、8 拆除中、16 開槍或開鏡）、手上武器。`st.e`：`['f', 武器, x,y,z, 打中人]`、`['x', 目標席位, 部位 0–3, 武器, x,y,z]` 命中、`['n', 種類, x,y,z, vx,vy,vz]`、`['p', 炸點]`、`['d']`、`['g']`、`['b', 品項]`。

JSON 編解碼會配置記憶體，只在連線時發生；單機的零配置驗收不受影響（`world.net` 是 null，掛鉤是 `?.` 呼叫）。

## 部署

伺服器位置的順序：網址 `?server=wss://…` → 打包變數 `OL_SERVER` → 在 localhost／127.0.0.1 上用同一個網域（`npm start`）→ 都沒有就只能單機，「連線」分頁會說明。

- 本機：repo 根目錄 `npm start`，開 `http://127.0.0.1:8127/web/278-ochre-line.html`。同一個網路的其他電腦要用 `HOST=0.0.0.0 npm start`，再用這台的區網 IP 開。
- 公開網站（Vercel 只放靜態檔）：用**你自己的 Cloudflare 帳號**部署 Worker，不要讓 Claude 自動執行：
  ```bash
  cd games/278-ochre-line/worker
  npx wrangler login
  npx wrangler deploy
  cd .. && OL_SERVER=wss://ochre-line.<你的帳號>.workers.dev npm run build
  ```
  `wrangler.toml` 的 `ALLOWED_ORIGINS` 限制只有作品集網域能連。Durable Object 的 WebSocket 訊息數會計費，一場十人的比賽每秒約有 32 張快照乘上真人數。

## 測試

```bash
npm run test:net                  # 房間邏輯（node:test）；npm test 會先跑這個
node tools/mp.mjs [--quick] [--page=dist/x.html] [--shots=dir]   # 兩、三個無頭分頁實測
```

`mp.mjs` 在同一個行程起靜態伺服器與房間伺服器，走完：畫面上建房、輸入房號加入、選邊、開賽（名單 10 人、空位電腦）、位置雙向同步、客戶端打主機扣血、主機打客戶端扣血、擊殺列、下一回合復活與比分、客戶端購買、斷線 30 秒由電腦接手（`--quick` 跳過）、比賽中加入接手電腦席位、房主離開其他人回房間。`window.__ol` 有 `NET`、`SYNC`、`net.join(code, name, create)`、`net.leave()`、`buyNet(id)`。

## 已知限制

- 沒有延遲補償：客戶端打的是自己畫面上（落後約 100 ms＋網路延遲）的人，主機照單全收，對朋友局夠用，也代表改過的客戶端可以作弊。
- 房主離開比賽就結束，沒有轉移主機。
- 客戶端的彈藥在本機算；主機只檢查武器是不是自己的。
- 沒有公開房間列表與配對，靠房號或邀請網址。
