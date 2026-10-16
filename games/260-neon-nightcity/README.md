# 260 — 霓虹夜城 // NEON NIGHT CITY

> **分類**：遊戲敘事（Cyberpunk Open-World Driving & Walking Simulator）  
> **單檔成品**：[`web/260-neon-nightcity.html`](../../web/260-neon-nightcity.html)  
> **預覽縮圖**：[`thumbs/260.jpg`](../../thumbs/260.jpg)

## 作品簡介

《**霓虹夜城 // NEON NIGHT CITY**》是一座以 **Three.js (r186)** 與 **Blender 5.2 無頭建模管線**從零打造的賽博龐克開放式雨夜城市，完全不依賴任何外部網路素材（零外部請求，所有 3D `.glb` 資產皆以 `gzip + base64` 內嵌於單一 HTML 檔案中，由瀏覽器原生 `DecompressionStream` 即時解壓載入）。

玩家可以駕駛 **Quadra V-Tech 電馭跑車**穿梭於六大命名行政區的雙向四車道濕地大道，體驗積水霓虹倒影、雨滴漣漪、手煞車甩尾與氮氣加速；亦可隨時按 **`F` 下車步行**，直接走進街邊建築的敞開大門，進入 **PULSE // 脈衝夜店**（與 14 名骨架動畫舞客在 8×8 音訊律動 LED 舞池及雷射光束下熱舞）、**AFTERGLOW // 餘燼酒吧**（向調酒師點賽博調酒、欣賞復古街機與點唱機）以及 **CHROME WORKS // 電馭改裝廠**（切換 5 款高亮度車底霓虹與塗裝光效）。

---

## 核心特色與系統架構

### 1. 程序生成賽博龐克雨夜城市（`src/city.js` + `src/atmosphere.js`）
- **6×6 大道網格與 6 大行政區**：涵蓋「霓虹中樞 · NEON CORE」、「餘燼巷弄 · EMBER ALLEY」、「電馭車道 · CHROME SECTOR」、「財閥天際 · CORP PLAZA」、「黑市船塢 · RUST CANAL」與「合成住宅 · SYNTH HEIGHTS」。
- **多層退縮摩天大樓與全息廣告**：68 棟高聳大樓具備程序生成發光窗格、漢字/日文/英文霓虹招牌、跨街全息門廊（Gantry Bridges）與屋頂旋轉全息光環。
- **雨夜氛圍與濕地面 Shader**：2,200 道動態雨滴粒子（進入室內時自動遮蔽於屋頂外）、街道蒸氣孔煙霧、雙懸臂路燈體積光錐，以及自訂 `onBeforeCompile` 濕地面積水漣漪與霓虹倒影 Shader。
- **動態車流、飛車航道與撐傘行人**：街道雙向 AI 車流、高空環繞飛行巡邏車（Hover-Spinners），以及人行道手持發光霓虹雨傘的骨骼動畫行人。

### 2. Blender 5.2 建模與骨架動畫管線（`blender/*.py` → `blender/out/*.glb`）
- **`vehicles.glb`**：`player_car`（楔形超跑車體、分離式可轉向/滾動四輪 `wheel_FL/FR/RL/RR`、百葉後窗、貫穿式尾燈與車底霓虹燈管）、`traffic_car`、`hover_spinner`。
- **`characters.glb`**：15 根骨骼人形骨架（`human_rig` + `human`），內建 6 段烘焙 NLA 骨骼動畫（`idle`、`walk`、`run`、`dance_groove`、`dance_hype`、`bartend`）。載入時由 `src/assets.js` 將多材質子網格烘焙為單一 HDR 頂點色自發光 `SkinnedMesh`，大幅降低 Draw Calls。
- **`street_props.glb`**：雙懸臂路燈 `street_lamp`、漢字霓虹招牌 `neon_sign_kanji`、自動販賣機 `vending_machine`、全息投影基座 `holo_projector`、蒸氣排氣孔 `steam_vent`、防撞柱 `bollards_barrier`。
- **`interior_props.glb`**：DJ 控台 `dj_booth`、重低音音箱塔 `speaker_stack`、環形雷射燈架 `laser_rig`、VIP 卡座 `club_table`、發光吧台 `bar_counter`、酒瓶背牆 `bottle_rack`、高腳椅 `bar_stool`、街機框體 `arcade_cab`、點唱機 `jukebox`。

### 3. WebAudio 程序化音效與空間音樂合成器（`src/audio.js`）
- **雨聲與環境低頻**：粉紅噪音帶通濾波雨滴聲（進入建築內部時自動切換為室內悶響濾波）與 Vangelis 風格合成器低頻 Drone。
- **引擎與甩尾音效**：雙振盪器隨車速與檔位動態調頻，搭配氮氣增壓高頻渦輪聲與手煞車輪胎摩擦聲。
- **空間化場館音樂**：靠近或步入 **PULSE 脈衝夜店**時響起 124 BPM 電馭 Techno 鼓組與 Acid Bassline；靠近或步入 **AFTERGLOW 餘燼酒吧**時響起 92 BPM Lo-Fi Synth 琶音。

### 4. HUD 儀表板與全區導覽地圖（`src/ui.js`）
- 左上角**即時旋轉雷達小地圖**（顯示道路、車流、可進入場館輪廓、大門標記、停放座駕與玩家朝向）、行政區/場館名稱、動態推進的雨夜時鐘与 FPS 監測。
- 右下角**數位時速表、檔位、RPM 轉速條與 NITRO 氮氣量表**。
- 按 **`M`** 開啟全區導覽與快速傳送面板，亦支援行動裝置觸控方向鍵與功能鍵（`390×844` 直向與 `667×375` 橫向零溢出）。

---

## 建置與驗收指令

```bash
# 1. 重新由 Blender 5.2 生成所有 GLB 模型資產
node tools/assets.mjs

# 2. 打包單一 HTML 成品至 ../../web/260-neon-nightcity.html
node tools/build.mjs

# 3. 執行 Playwright 自動化端對端驗收測試
node tools/accept.mjs

# 4. 產生作品集預覽縮圖 ../../thumbs/260.jpg
node tools/thumb.mjs
```
