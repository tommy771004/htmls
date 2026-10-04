# 鹽岬大逃殺 · SALTCAPE（作品 199）

瀏覽器多人連線大逃殺。從 C-7 運輸機跳傘到鹽岬島，搜刮武器與護甲，在八階段收縮的毒圈裡活到最後。頁面：`web/199-saltcape.html`（遊戲敘事）。

畫面用 CC0 素材（ambientCG 掃描貼圖、Poly Haven 天空 HDRI 與道具、Kenney 車輛、Quaternius 動畫士兵，見 [CREDITS.md](CREDITS.md)），放在 `assets/199/`，所以頁面要透過網站伺服器開啟；以檔案直接開啟時退回程序貼圖與方塊人，只能離線練習。

## 玩法

| 操作 | 鍵盤滑鼠 | 觸控 |
| --- | --- | --- |
| 移動／衝刺 | WASD／Shift | 左搖桿（推到底衝刺） |
| 瞄準／開火／開鏡 | 滑鼠／左鍵／右鍵 | 右半螢幕拖曳／射擊／開鏡 |
| 跳、跳機、開傘、切斷傘繩 | 空白鍵 | 跳 |
| 蹲（切換） | C | 蹲 |
| 撿起準星對到的物品 | E | 撿 |
| 換彈／上護甲片 | R／F（或 4） | 換彈／上甲 |
| 換槍 | 1、2、Q、滾輪 | 換槍 |
| 第一／第三人稱 | V | 選單 |
| 大地圖／名單 | 按住 M／Tab | — |

- 運輸機飛過海岸後才能跳。自由落體時 W 俯衝、S 減速；離地 95 公尺自動開傘，130 公尺以上可以切斷傘繩再自由落體。
- 開局帶一把短號手槍、45 發輕型彈藥、一級背心與一片護甲。地上的武器分普通、精良、稀有、傳說四級（傷害與彈匣容量遞增，稀有以上有光柱），旁邊通常有對應的彈藥；彈藥與護甲片走過去會自動撿。
- 背心決定能掛幾片護甲（每片 50 點），護甲先吸收子彈傷害，打碎時會有藍色命中標記；毒圈傷害不受護甲減免。五秒沒受傷後生命自動回復。
- 毒圈 8 階段：公布下一圈 → 倒數 → 收縮，圈外每秒 1、2、4、6、8、11、14、18 點傷害，第 8 圈收到 0。整場約 8 到 9 分鐘。
- 淘汰後觀戰擊殺你的人（點擊畫面切換），結束時顯示名次表；勝者是「鹽岬最後的生還者」。

## 大廳與配對

- **快速配對**：加入這台伺服器上正在倒數（25 秒）的公開房，或運輸機還在航線前半的對局；都沒有就開新房。
- **建立好友房**：網址會變成 `…/199-saltcape.html?room=房號`，複製邀請連結給朋友；朋友開網址會自動帶入房號。機長（房主）按「立即起飛」，否則 10 分鐘後自動起飛。
- 真人不足 48 人時由 AI 補滿。運輸機離島後才加入的人先觀戰，下一場自動上機。
- 以檔案開啟或連不到伺服器時，可以按「離線練習」：同一份權威對局直接在瀏覽器裡跑，對手全是 AI。

## 執行

需要 Node.js 22 以上。

```bash
# 網站根目錄
npm ci
npm start                       # 靜態檔＋麻將（127）＋鹽岬（199），http://127.0.0.1:8127/web/199-saltcape.html

# 本資料夾
npm ci
npm run build                   # 打包成 ../../web/199-saltcape.html（改了 src/ 一定要重跑並一起 commit）
npm test                        # 規則層與伺服器測試，再跑 1440×900／390×844 無頭 Chrome 驗收
npm run mp                      # 兩個瀏覽器分頁：建房 → 分享網址加入 → 起飛 → 互射 → 換線接手 → 勝利
npm run sim                     # Node 裡跑整場 48 人 AI 對戰並印出統計
npm run thumb                   # 重新產生 ../../thumbs/199.jpg
node tools/fetch-assets.mjs     # 重新下載 CC0 素材到 ../../assets/199/（需要 curl、unzip、cwebp、sips）
blender -b -P tools/build-soldier.py   # 士兵模型（借 games/197-openworld/.cache/ 的 Quaternius 素材包）
```

截圖、驗收與多人工具都用 `tools/lib.mjs` 的 `serve()` 在同一個行程起網站伺服器（含 `/saltcape`）。

無頭瀏覽器工具讀 `PLAYWRIGHT_MODULE`（預設 `~/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs`）。獨立跑伺服器：`node server/saltcape/server.mjs`（`ws://127.0.0.1:8199/api/saltcape`），前端加 `?server=ws://主機:埠/saltcape` 指定。

## 結構

- `src/core/`：不碰 DOM、伺服器與前端共用。`terrain.js` 高度場與道路、`map.js` 城鎮與建築（全部是軸對齊方塊與直立圓柱）、`physics.js` 碰撞與射線、`player.js` 移動／跳傘／武器推進、`rules.js` 數值表、`storm.js` 毒圈、`sim.js` 權威對局（命中裁定、延遲補償、戰利品、擊殺、勝負）、`bots.js` AI。
- `src/client/`：`main.js` 大廳、預測與校正、內插、鏡頭、後製；`assets.js` 載入 `assets/199/`；`world.js` 場景（HDRI、級聯陰影、PBR 建築與地形混合、窗框室內細節、道路標線、樹、電線桿、車）；`actors.js` 士兵（動畫分上下半身、迷彩、頭盔背心）、槍、降落傘與運輸機；`viewmodel.js` 第一人稱槍與手套；`grass.js` 近景草叢；`fx.js` 曳光彈、毒圈牆與戰利品標記；`hud.js`；`audio.js`；`input.js`；`net.js` 連線與離線練習。
- 畫質：預設「高」（級聯陰影＋泛光），觸控裝置「低」（單張陰影、無後製），「極高」再加 GTAO 環境遮蔽；`?q=low|mid|high|ultra` 或選單切換（存在 localStorage）。
- `../../server/saltcape/server.mjs`：房間、配對、30 Hz 推進、15 Hz 快照、換線接手；`../../api/saltcape.mjs` 是 Vercel 入口。

協定、輸入位元與快照格式見 [SPEC.md](SPEC.md)。

## 測試 API（`window.__sc`）

`solo(name)` 開離線練習；之後 `place(x, z, mode, y)` 直接把自己擺到某處（0 機上、1 自由落體、2 開傘、3 地面），`give('ar', 稀有度)` 給武器與滿護甲，`look(yaw, pitch)` 轉視角，`bring(n)` 把 n 個 AI 定在面前（看角色用），`match()` 取瀏覽器裡的 `Match`，`assets` 是載入的素材。`?server=` 指定伺服器網址；預設連同網域的 `/api/saltcape`（本機伺服器也接受 `/saltcape`）。

## Vercel 與已知限制

- Vercel 上的 WebSocket function（`/api/saltcape`）每條連線最多活 300 秒，前端每 200 秒先開新連線、帶 token 接手座位再關舊連線；意外斷線會指數退避重連。
- **對局只存在單一行程的記憶體裡**，不寫資料庫（30 Hz 的位置同步不適合透過 Neon 輪詢）。Vercel 若把好友的連線或換線分到不同實例，加入會收到「找不到這個房號：可能分在另一台伺服器實例」、主動換線失敗時會保留舊連線並每 4 秒重試；斷線後重連若落在別的實例，會顯示「原本的對局不在這台伺服器上」並回到大廳，不會靜默分裂成兩場。要穩定多人，可用 `npm start` 或 `node server/saltcape/server.mjs` 自架，前端加 `?server=wss://…`。
- 部署後請實測：兩個分頁開同一個好友房、玩超過 200 秒確認換線不掉線、再開第三個分頁加入。
- 命中裁定以伺服器位置為準，回推最多 400 毫秒補償延遲；沒有子彈飛行時間與下墜。
- AI 只搜刮一樓的戰利品，落地時常撿不到主武器，開局手槍戰偏多；AI 不會爬樓梯上屋頂。
- 沒有載具、隊伍、復活（Gulag）、語音與帳號戰績。
