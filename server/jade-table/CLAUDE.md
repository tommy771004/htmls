# 青雀真人麻將（127）架構

- `assets/jade-table/engine.mjs`：台灣十六張規則引擎（`MahjongGame`、`scoreHand`、台表），**瀏覽器單人模式與伺服器共用同一份**。改規則時兩邊會一起受影響。
- `assets/jade-table/art.mjs`：原創角色與大廳背景（參數化 SVG 字串）。`bust()` 座位頭像、`figure()` 大廳／結算立繪、`scene()` 月下庭園背景；座位頭像依伺服器座位號對應 `SEAT_CAST`，各客戶端一致。繪製依部位拆在 `art/face.mjs`、`art/hair.mjs`、`art/garment.mjs`（共用 `art/common.mjs`），各模組新 id 以 `${u}-f-`／`-h-`／`-g-` 分區；光源統一在右上。
- `server/jade-table/server.mjs`：`createJadeServer()` 同時提供靜態檔白名單與 WebSocket（本機為 `/mahjong`，Vercel 為 `/api/jade`）。伺服器負責裁定房號、身份、洗牌、出牌、搶牌與計台，**只傳送各玩家看得到的牌**。
- `api/jade.mjs`：Vercel function 入口，包裝 `createJadeServer` 並限制 origin。
- `server/jade-table/store.mjs`：`RoomStore`。有 `DATABASE_URL` 時用 Neon Postgres（`schema.sql` 建立 `jade_mahjong_rooms`），以版本條件更新避免多實例同時改牌局；沒有時改用行程內記憶體。房間在最後活動兩小時後失效。
- 部署、重連與斷線接手規則見 `server/jade-table/README.md`；規則來源與本桌差異見 `plans/127-jade-table-research.md`。
- 大廳與胡牌結算的 3D 立繪：`assets/jade-table/figure3d.mjs` 載入 `assets/jade-table/figures/<角色>.glb`（只在 http(s) 下載入，失敗時保留插畫）。GLB 由 `games/127-jade-table/tools/figures.mjs` 從 Sketchfab 原檔產生，骨頭對照寫在場景 extras 的 `rig`；遠山的原檔沒有骨架，先跑 `blender/rig_katya.py`。青雀與遠山是遊戲角色的非官方同人模型，規則帖的作者標示與 `assets/jade-table/CREDITS.md` 要保留。細節見 `games/127-jade-table/README.md`。
