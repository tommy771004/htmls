# 青雀真人麻將

頁面：`/web/127-jade-table.html`，遊戲敘事分類。單人與真人共用 `assets/jade-table/engine.mjs`；房號、身份、洗牌、出牌、搶牌與計台由伺服器裁定。只傳各玩家可見的牌。

## 執行與驗證

需要 Node.js 22 以上。根目錄執行 `npm ci`，再 `npm start`，開啟 `http://127.0.0.1:8127/web/127-jade-table.html`。未提供資料庫時只有本機記憶體模式。

`npm run test:mahjong` 驗證行牌／結算與跨實例四人房、手牌保密、越權拒絕和重連。若 `.env.local` 已有 `DATABASE_URL`，執行 `node --env-file=.env.local --test server/jade-table/game.test.mjs` 可驗證真實 Neon；測試只新增隨機房間，兩小時後失效。

## Vercel + Neon

1. 在 Neon 執行一次 `schema.sql`，建立專用 `jade_mahjong_rooms` 表。
2. 在 Vercel 的 htmls 專案 **Production** 環境設定 Secret `DATABASE_URL` 為 Neon 提供的連線字串；不可加到前端或 Git。
3. 從根目錄部署。`api/jade.mjs` 提供 `/api/jade` WebSocket，前端使用同網域，無需另購後端主機。
4. 部署後用四個獨立分頁開好友房、輸入六位房號、開局。可勾選 AI 補位；真人不足四人且未勾選則等待。

Vercel 的 WebSocket 為 Beta，達到 Function 時限會斷線；前端自動重連並重新取得狀態。房間存於 Neon，以版本條件更新避免多實例同時改牌局。房間在最後活動兩小時後失效，房號可覆用；舊資料不持續提供查詢。部署後沒有連線的房間會停止主動計時，重連時從已存狀態恢復並處理超時。無永久牌譜／觀戰／帳號排名。

同時開多個分頁時每頁各有自己的 sessionStorage 重連身份。斷線保留30秒，之後 AI 接手；明確離房立即由 AI 接手。積分不涉及現金。

規則、台表來源與本桌差異記於 [研究紀錄](../../plans/127-jade-table-research.md)，遊戲內「玩法」可直接查看。主要採神來也台表，並非全台統一規則。
