# 氣鬥三路 · KI LANES（作品 198）

格鬥遊戲的連段手感 × 三路推塔。選一名原創武人，和兩名 AI 隊友對上三名 AI 敵人，推倒敵方主堡就獲勝。機制分析、角色技能表、地圖座標與模組契約見 [SPEC.md](SPEC.md)。

- 成品：`web/198-ki-lanes.html`（單檔，Three.js 0.186.0 一起打包，不載入任何外部資源）
- 一場約 10～15 分鐘（全 AI 模擬 4 場：12～16 分鐘結束）

## 指令

```bash
npm ci
npm run build          # 打包成 ../../web/198-ki-lanes.html（--dev 不壓縮）
npm test               # 驗收：1440×900 與 390×844（觸控），見 tools/accept.mjs
node tools/sim.mjs 900 # Node 無頭模擬 15 分鐘（不渲染），每 30 秒印一次兵數、擊殺、倒塔與英雄位置
node tools/fight.mjs 1440 900 shimo   # 開發截圖：兵線與 QWER 特效
node tools/mobile.mjs  # 開發截圖：手機版選角與觸控介面
node tools/perf.mjs    # 開打 4 分鐘後的實際幀率
node tools/thumb.mjs   # 重拍 ../../thumbs/198.jpg
```

改了 `src/` 要重新 build，並把 `web/198-ki-lanes.html` 一起 commit。驗收工具用 `PLAYWRIGHT_MODULE` 指定 Playwright（預設讀 `~/.npm/_npx/…/playwright`），先試 Metal GPU、失敗再退 SwiftShader。

## 操作

| 輸入 | 作用 |
| --- | --- |
| 右鍵／左鍵 | 點地面移動、點敵人普攻；按住持續移動 |
| Q W E R | 朝游標施放（Ctrl＋鍵升級） |
| C（按住） | 集氣 |
| D | 爆氣 |
| B | 回城 |
| S | 停止 |
| Y／空白鍵 | 自由鏡頭／回到角色；滾輪縮放 |
| 小地圖 | 左鍵移鏡頭、右鍵移動 |
| H、Esc | 說明（暫停） |
| M | 靜音 |
| 觸控 | 左下搖桿、右下攻擊鍵（自動選最近的敵人）、技能鍵自動瞄準射程內的敵方英雄 |

## 測試 API：`window.__ki`

`start(heroId, lane, diff)`、`state()`、`fastForward(sec)`（跳過頓幀與慢動作，直接跑固定步長）、`teleport(x,z)`、`moveTo`、`attack(id)`、`cast(key,x,z)`、`levelUp(key)`、`setLevel(n)`、`learnAll()`、`give({ki,xp})`、`freezeAI(bool)`、`spawnEnemyHeroNear(d)`、`enemyHero()`、`killPlayer()`、`damageStructure(id, amt)`、`destroy(id)`、`win()`、`lose()`、`camera(x,z,zoom)`、`follow()`、`pick(id)`、`pause(bool)`、`setQuality(0..2)`。建築 id：`t{隊}{路}{i|o}`（例 `t11o` 是赤隊中路外塔）、`core0`／`core1`。

## 結構

模擬是 60 Hz 固定步長；命中頓幀（hit-stop）與必殺技慢動作是「模擬時間倍率」，只影響畫面節奏，冷卻、復活等全部以模擬時間計算。`src/units.js`、`combat.js`、`ai.js`、`map.js` 的規則部分不依賴 DOM，可以直接在 Node 跑（`tools/sim.mjs`）。

| 檔案 | 內容 |
| --- | --- |
| `config.js` | 數值：英雄、技能、小兵、塔、經驗曲線 |
| `map.js` | 路線、塔位、障礙物、手繪地面貼圖、河水、植被 |
| `units.js` | 單位、移動與繞障、傷害、經驗、小兵與塔的 AI |
| `combat.js` | 普攻三段鏈、四名角色的 QWER、投射物、區域效果 |
| `ai.js` | 英雄 AI（守線補兵、換血、連招、撤退回城、推塔） |
| `models.js` | 程式建模的角色、小兵、塔、主堡與動畫 |
| `fx.js` | 粒子、命中火花、光束、閃電、冰隕、地刺等特效 |
| `hud.js`、`icons.js` | HUD、技能圖示、選角與結算 |
| `input.js`、`minimap.js` | 滑鼠鍵盤、觸控、小地圖 |
| `audio.js` | WebAudio 合成音效 |
| `main.js` | 迴圈、場景同步、頭像算圖、測試 API |

## 已知限制

- 沒有戰爭迷霧、商店與裝備，也沒有野怪；經驗只來自小兵、英雄與塔。
- AI 只守自己那一路，不會主動遊走支援。
- 同一隊三名角色不重複，但兩隊之間可能出現同一名角色（以腳下圓環與血條顏色區分隊伍）。
