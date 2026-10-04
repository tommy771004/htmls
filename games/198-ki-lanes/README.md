# 氣鬥三路 · KI LANES（作品 198）

《七龍珠 FighterZ》的連段手感 × 三路推塔。從悟空、貝吉塔、特南克斯、比克、弗利沙、人造人18號選一名，和兩名 AI 隊友對上三名 AI 敵人，推倒敵方主堡就獲勝。機制分析、角色技能表、地圖座標與模組契約見 [SPEC.md](SPEC.md)。

非官方同人作品：角色與招式名稱版權屬原作者；模型、特效、地圖與音效全部以程式產生，不含原作的貼圖、模型、圖示、音效或文字素材。

- 成品：`web/198-ki-lanes.html`（單檔，Three.js 0.186.0 一起打包，不載入任何外部資源）
- 一場約 10～20 分鐘（全 AI 模擬 4 場：8～23 分鐘結束，中位數約 15 分鐘）

## 指令

```bash
npm ci
npm run build          # 打包成 ../../web/198-ki-lanes.html（--dev 不壓縮）
npm test               # 驗收：1440×900 與 390×844（觸控），見 tools/accept.mjs
node tools/sim.mjs 900 # Node 無頭模擬 15 分鐘（不渲染），每 60 秒印一次兵數、營地、擊殺、倒塔與英雄等級／金幣
node tools/fight.mjs 1440 900 frieza   # 開發截圖：兵線與 QWER 特效
node tools/mobile.mjs  # 開發截圖：手機版選角與觸控介面
node tools/jungleshot.mjs # 開發截圖：野區營地、戰爭迷霧、大猿
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
| D | 爆氣（悟空、貝吉塔、特南克斯變身超級賽亞人） |
| P／點金幣 | 商店（泉水附近或陣亡時才能買） |
| 1 | 吃仙豆 |
| B | 回城 |
| S | 停止 |
| Y／空白鍵 | 自由鏡頭／回到角色；滾輪縮放 |
| 小地圖 | 左鍵移鏡頭、右鍵移動 |
| H、Esc | 說明（暫停） |
| M | 靜音 |
| 觸控 | 左下搖桿、右下攻擊鍵（自動選最近的敵人）、技能鍵自動瞄準射程內的敵方英雄 |

## 測試 API：`window.__ki`

`start(heroId, lane, diff)`（heroId：`goku`／`vegeta`／`trunks`／`piccolo`／`frieza`／`a18`）、`state()`、`fastForward(sec)`（跳過頓幀與慢動作，直接跑固定步長）、`teleport(x,z)`、`moveTo`、`attack(id)`、`cast(key,x,z)`、`levelUp(key)`、`setLevel(n)`、`learnAll()`、`give({ki,xp})`、`freezeAI(bool)`、`spawnEnemyHeroNear(d)`、`enemyHero()`、`killPlayer()`、`damageStructure(id, amt)`、`destroy(id)`、`win()`、`lose()`、`camera(x,z,zoom)`、`follow()`、`pick(id)`、`pause(bool)`、`setQuality(0..2)`、`buy(itemId)`、`senzu()`、`setGold(g)`、`visible(unitId)`、`fog(bool)`、`camps()`、`boss()`、`heroes()`。建築 id：`t{隊}{路}{i|o}`（例 `t11o` 是赤隊中路外塔）、`core0`／`core1`。

## 結構

模擬是 60 Hz 固定步長；命中頓幀（hit-stop）與必殺技慢動作是「模擬時間倍率」，只影響畫面節奏，冷卻、復活等全部以模擬時間計算。規則層（`world.js`、`units.js`、`combat.js`、`ai.js`、`items.js`、`jungle.js`、`vision.js`、`nav.js`、`map.js` 的資料部分）不依賴 DOM，可以直接在 Node 跑（`tools/sim.mjs`）。

| 檔案 | 內容 |
| --- | --- |
| `config.js` | 數值：英雄、技能、小兵、塔、經驗曲線 |
| `map.js` | 路線、塔位、障礙物、手繪地面貼圖、河水、植被 |
| `units.js` | 單位、移動與繞障、傷害、經驗、小兵與塔的 AI |
| `combat.js` | 普攻三段鏈、六名角色的 QWER、投射物、區域效果 |
| `ai.js` | 英雄 AI（守線補兵、換血連招、撤退回城買裝、遊走、打野、集合打大猿） |
| `models.js` | 程式建模的角色、小兵、塔、主堡與動畫 |
| `fx.js` | 粒子、命中火花、光束、死亡球、魔空包圍彈、圓頂爆炸、變身等特效 |
| `hud.js`、`icons.js` | HUD、技能圖示、選角與結算 |
| `input.js`、`minimap.js` | 滑鼠鍵盤、觸控、小地圖 |
| `audio.js` | WebAudio 合成音效 |
| `world.js` | 建立對戰、固定步長推進（畫面與 Node 模擬共用） |
| `nav.js` | A* 尋路 |
| `vision.js`、`fog.js` | 戰爭迷霧的可見格與畫面變暗 |
| `items.js`、`jungle.js` | 商店與道具、野怪與大猿 |
| `map-props.js` | 地圖裝飾（樹、岩石、懸崖、河道、基地） |
| `main.js` | 迴圈、場景同步、頭像算圖、測試 API |

## 已知限制

- 戰爭迷霧沒有草叢與視線遮擋（樹叢不擋視野），也沒有眼。
- 道具沒有合成樹，只能單件購買，介面上不能賣回。
- AI 會遊走、打野、集合打大猿，但不會主動繞後包夾或守主堡。
