# Roadster Stunt Arena：模組契約

## 檔案分工

| 路徑 | 內容 | 依賴 |
| --- | --- | --- |
| `src/core/const.js` | 物理常數：`TICK`（1/120 s）、`GRAVITY`、`CAR`（懸吊、油門表、轉向曲率、冷氣推進、空力三檔）、`ARENA`、`BALL`、`LEAGUE`、碰撞群組 | 無 |
| `src/core/car.js` | `makeCar`／`placeCar`／`stepCar`：Rapier 只管碰撞，懸吊射線、抓地、甩尾、跳躍、懸停、空中姿態、吸附都逐 tick 寫進速度 | three（向量）、Rapier |
| `src/core/geom.js`、`park.js`、`world.js` | 特技場幾何（掃掠跳台、通道、迴圈）、物件表（`RINGS`、`PADS`、`TA`、`SIGNS`）、建 Rapier 世界 | three |
| `src/core/stunt.js`、`tricks.js` | `FreeRide`（任務、紅環、分數）、`TimeAttack`（倒數、檢查點、分段、逆向、幽靈車）、`medalFor`、特技判定 | three |
| `src/core/arena.js`、`league.js` | 聯賽球場網格與距離場、`League`（本機車、遠端運動學車、球、規則）、`Bot`（AI）、`kickoffSpot` | three、Rapier |
| `src/net/core.js` | `BoardCore`、`LobbyCore`、`RoomCore`：連線的純邏輯，不碰網路與儲存 | `const.js` |
| `src/client/*` | 畫面（`gfx`、`parkview`、`leagueview`、`roadster`、`showroom`、`fx`、`camera`）、輸入、HUD、音效、`drive`（Free Ride／計時賽）、`match`（聯賽）、`net`、`store`、`main` | DOM、three |
| `assets/roadster.glb` | 車輛模型（`tools/car.mjs` 產生、有 commit）：節點 `body`、`wheel_FL`／`FR`／`RL`／`RR`，地面 y=0、車頭 +z，前後軸對齊 `CAR.WHEELS` 的 z；meshopt 量化把縮放寫進節點矩陣，原點另存在節點 extras `c`（輪心）。打包時 gzip＋base64 放進 `#roadster-glb`，`main.js` 和 Rapier 一起 `loadRoadster()` 後才建車 | 無 |
| `../../server/roadster/server.mjs` | Node 轉接：`createRoadster()` 把 `core.js` 接到 `ws`，掛在 `npm start` 的 8127 埠 | ws |
| `worker/index.js` | Cloudflare 轉接：`Lobby`、`Room` 兩個 Durable Object，同一份 `core.js` | Workers runtime |

`src/core/` 與 `src/net/` 不碰 DOM，Node 測試、瀏覽器、伺服器共用。

## 座標與單位

Y 朝上、公尺、秒。車身本地：+Z 車頭、+Y 車頂、+X 車身左側。車的原點在輪軸高度，平地停車時 y = `CAR.REST_Y`（0.36）。偏航角 0 朝 +Z。特技場範圍 ±470 m，聯賽球場半寬 `A`、半長 `B`，球門在 z = ±B（+Z 是冰藍隊的門，紅隊往 +Z 攻）。

## 車的狀態

`car.state.input`：`{ throttle, steer, pitch, yaw, roll, jump, boost, handbrake }`，`throttle`／`steer`／`pitch` 在 −1…1。空中 `pitch` −1 是車頭往下（鍵盤 W、搖桿往前推）。

主要輸出欄位：`speed`、`gas`（0–100）、`contacts`（著地輪數）、`onGround`、`boosting`、`hovering`、`drifting`、`slip`、`aero`（AUTO／LOW／HIGH）、`suction`（GRIP／WALL）、`lights`（0–2）、`wingH`／`wingA`（尾翼高度與角度，畫面用）。

`stepCar` 推入事件：`jump`、`hover`、`launch`、`land`（`impact`、`air`、`height`）、`speed88` 等。開下跳台的前 0.25 秒（非自己起跳、沒有俯仰輸入）會吃掉台口給的俯仰轉速。

## 計時賽與幽靈車

`TA.gates`（5 個）＋`TA.finish`，每個有中心、半徑、穿越方向 `dir`。`crossed(gate, prev, cur)`：前後兩個 tick 在環面兩側、穿越點在半徑 ×1.15 內。

事件：`count`（2、1）、`go`、`gate`（`i`、`time`，畫面補 `delta`）、`wrongway`、`finish`（`time`、`splits` 共 6 個）。

幽靈車：`TimeAttack.ghost` 每秒 30 格，每格 7 個數（位置 xyz＋四元數 xyzw）；`store.saveBest` 存成 Float32Array 的 base64。

## 連線協定（JSON over WebSocket，`PROTO` = 1）

### 大廳 `/api/rsa`

| 方向 | 訊息 |
| --- | --- |
| 伺→客 | `hello { v, online, rooms, playing }`；每 5 秒 `count { online, rooms, playing }` |
| 客→伺 | `ping { c }` → `pong { c, … }` |
| 客→伺 | `quick` → `room { code }`（找人最多但沒滿的房，沒有就開新房號） |
| 客→伺 | `board { kind: world/week }` → `board { kind, rows: [{ name, time, at }], wk }` |
| 客→伺 | `score { name, time, splits }` → `scored { ok, improved, rank, time } / { ok:false, error }`（同一連線 8 秒一次） |

房間每次人數變動向大廳回報（Node 版直接呼叫、Cloudflare 版 `fetch('/report')`），2 分鐘沒更新的回報作廢。

### 房間 `/api/rsa/room/<房號>?name=<名字>`

房號 5 碼，字元 `A–Z` 去掉 I、O 加 `2–9`。

| 方向 | 訊息 |
| --- | --- |
| 伺→客 | `welcome { id, team, code, players, phase, clock, score, owner, ball, idx, overtime, seq }`，滿 20 人回 `full` |
| 伺→客 | `join { p }`、`leave { id }`、`teams { players }`（開新比賽時依加入順序交錯分隊） |
| 伺→客 | `ko { idx: {id: 站位}, seq, ends, phase, clock, score, overtime }` 開球（3 秒倒數） |
| 伺→客 | `phase { phase, clock, score, overtime, ends }`：`warmup`／`kickoff`／`play`／`goal`／`ended` |
| 伺→客 | `own { id, b, seq }` 球權換人（`id` 0＝沒人） |
| 伺→客 | `goal { team, by, byId, own, score, warmup? }`、`overtime`、`end { winner, score }`、`reset { b, seq }`（熱身進球後放回中場） |
| 伺→客 | `s { T, c: [[id, …車 14 個數]], b, o, k, ph, sq }` 快照，15 Hz |
| 客→伺 | `st { s: 車 14 個數 }`，20 Hz |
| 客→伺 | `ball { b: 球 13 個數, seq }`，只有球權人送，20 Hz |
| 客→伺 | `claim { b, seq }` 碰到球時要求球權 |
| 客→伺 | `goal { team, seq, b }` 球權人偵測到進球；伺服器沒回應時每秒重送 |
| 客→伺 | `ping { c }` → `pong { c, s: 伺服器時間 }`（客戶端算時間差與 RTT） |

車 14 個數：位置 xyz、四元數 xyzw、速度 xyz、旗標（1 推進、2 懸停、4 煞車、8 甩尾、燈光檔位 <<4）、`wingH`、`wingA`、`steerVis`。球 13 個數：位置 xyz、四元數 xyzw、速度 xyz、角速度 xyz。所有數值四捨五入到 0.001，伺服器只收長度正確、有限且絕對值小於 1e5 的陣列。

### 裁定規則（`RoomCore`）

- 伺服器不跑物理。每人模擬自己的車；球由球權人模擬，其他人把球設成運動學剛體、照快照內插（落後 120 ms）。
- `claim`：沒人有球權，或上次換手超過 200 ms 才給；倒數與賽後不給；`seq` 不對不給。碰球的人在本機先接手（立刻有反應），被拒時下一個 `own` 會把球權改回去。
- `goal`：只收球權人、`seq` 相符、`play` 或 `warmup` 階段。用訊息附的球位置檢查：`|x| < GW + 1`、`y < GH + 1`、`|z| > B + 0.8R`。通過後加分、`seq` 加一（之後同一球的回報都失效）、進 3.5 秒的 `goal` 階段。
- 時間到：球落地（或 2 秒沒有球的回報）才判。平手進延長，延長賽進球就結束；比賽結束 9 秒後，兩人以上自動開新局。
- 球權人 3 秒沒送 `ball` 就收回球權；任何人 15 秒沒有訊息就踢出；剩一人回到熱身；空房 30 秒後關閉。

### 排行榜（`BoardCore`）

每個名字只留最佳：`all`（世界紀錄）與 `week`（本 ISO 週）各一筆，各留前 200 名，換週時舊的週紀錄丟掉。成績要在 30–600 秒、6 個嚴格遞增（間隔大於 0.5 秒）的分段、最後一段等於總時間（誤差 2 ms）。名字去掉控制字元與 `<>&"'\`` 等，最多 16 字。
