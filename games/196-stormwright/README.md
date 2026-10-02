# 築嵐島 · STORMWRIGHT（作品 196）

第三人稱「建造大逃殺」：30 人（玩家 + 29 個 bot）從飛艇跳下、滑翔降落，搜刮、採集木／石／金屬，蓋牆、地板、斜坡，在紫色風暴縮圈中活到最後。Three.js 0.186.0 與全部程式一起由 esbuild 打包成單檔 `web/196-stormwright.html`；唯一的外部請求是 Google Fonts 的 Anton，載不到時退回系統字。

架構契約（ctx、事件、Actor／Intent、建造格、風暴階段、檔案分工）見 `SPEC.md`。

## 指令

```bash
npm ci
npm run build                    # → ../../web/196-stormwright.html（網站 commit 的就是這個檔案）
node tools/build.mjs --out=dist/x   # 輸出到 dist/x/index.html（測試用，dist/ 不進版控）
node tools/build.mjs --dev          # 不壓縮
npm run accept                   # 驗收：1440×900 與 390×844，例外、console.error、外部請求、viewport、手機溢出
npm test                         # 整合走查 check-integ：選單 → 飛艇 → 跳傘 → 開箱 → 射擊 → 採集 → 建造 → 風暴 → 勝利／淘汰 → 重開
```

`tools/` 其他腳本（都接受 `<html路徑> --out <資料夾>`）：`check-combat`、`check-build`、`check-world`、`check-chars`、`check-match`、`check-move`、`check-bots`（`--runs N` 跑整場模擬並印出存活人數曲線；`--only dps` 重新量測遠距簡化交戰的傷害表）、`check-perf`（各場景 draw call）、`shot.mjs`（單張截圖，`--eval` 可先執行 JS）。

瀏覽器流程用 Playwright：讀 `PLAYWRIGHT_MODULE`，預設 `~/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs`。Chromium 參數 `--use-angle=metal --enable-gpu --ignore-gpu-blocklist`（真實 GPU）。

## 操作

| 動作 | 鍵盤滑鼠 |
|---|---|
| 移動／衝刺／跳／蹲 | WASD／Shift（預設自動衝刺）／空白鍵／Ctrl 或 V |
| 開火／瞄準 | 左鍵／右鍵 |
| 換彈／撿取、開箱（按住） | R／E |
| 物品欄 | 1（十字鎬）–6、滾輪 |
| 建造 | Q 切換；Z 牆、X 地板、C 斜坡；左鍵放置（按住連續蓋）；建造中 R 換材料 |
| 飛艇跳下／張開滑翔翼 | 空白鍵 |
| 地圖／暫停 | M／Esc |

手把用標準配置；手機有左下浮動搖桿、右側拖曳轉視角與按鈕列。暫停選單可調靈敏度、反轉 Y、音量、畫質、視野、自動衝刺、小地圖旋轉（存在 localStorage）。

## 測試 API `window.__sw`

`state()`、`start()`、`restart()`、`skipToGround(x?, z?)`、`teleport(x, z)`、`give(defId, rarity)`、`giveMats(n)`、`giveAmmo(n)`、`killBots(n)`、`spawnBotNear(dist)`、`dropItem(defId, rarity, dist)`、`spawnChest(dist)`、`freezeBots(bool)`、`storm.skip()`、`storm.setPhase(n)`、`fastForward(sec)`（固定步長快轉，不渲染）、`stats()`、`setQuality(q)`、`press(intent)`（覆蓋輸入，`null` 清除）、`aimAt(actorId)`、`look(yaw, pitch)`。`ctx.bots.debug(id)` 回傳 bot 的狀態、目標與去向。

注意：bot 在飛艇上不受傷害，`killBots` 前先 `skipToGround()`；要穩定重現時先 `freezeBots(true)`。

## 已知限制

- 建造只有牆、地板、斜坡，沒有編輯模式與錐形屋頂；建造格是全域絕對格線，坡地上腳邊的地板可能因埋進地形而不能放。
- 房屋沒有結構支撐（拆掉一樓牆不會讓屋頂塌），屋頂碰撞是階梯狀近似。
- bot 不會編輯建材，一般移動不會把斜坡當樓梯用；距離觀看者 150 m 以外的 bot 對戰以量測過的傷害表簡化結算（仍會發出傷害與淘汰事件）。整場節奏由 `bots.js` 的 `PACE_CURVE` 與 `storm.js` 的階段表共同決定，改其中一個要一起調。
- 觀戰時若鏡頭被擠到 0.9 m 以內（樓梯間、鷹架），會平滑切成被觀戰者的第一人稱視角。
- 槍的手部是固定握拳，沒有手指動作；臉部沒有眨眼與表情。
