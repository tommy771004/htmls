# 巔峰試駕 · APEX STAGE '98（285）

- 原始碼在 `games/285-apex-stage/`（Three.js 0.186.0 + Cannon-es 0.20.0 + Web Audio API + esbuild），有自己的 `package.json`；`npm run build` 輸出離線單檔 `web/285-apex-stage.html`（零外部網路請求），改了 `src/` 要重新 build 並把產出一起 commit。
- `npm test` 先跑 Node 物理與輪胎單元測試（`test/physics.test.mjs`：5 級性能分級與 10 款原創車款規格、Pacejka 魔術公式輪胎模型、Cannon-es `RaycastVehicle` 懸吊與重心轉移），再跑無頭 Chrome 多視窗與 AI 實車試駕驗收（`tools/accept.mjs`：5 種解析度零水平溢位、Web Audio `AnalyserNode` 真實合成波形峰值檢測、封閉技術賽道完整單圈完賽與三段區間計時、綜合測試場甩尾／越野／跳台飛躍與落地驗證，並自動輸出 `thumbs/285.jpg`）。
- 100% 原創虛構車款與賽道致敬作品，頁面與 README 維持「非官方原創車款與賽道致敬作品，與任何車廠無關」聲明，不使用真實車廠標誌。
- 物理引擎重要注意事項：Cannon-es 的 `Body.prototype.applyForce(force, relativePoint)` 第二參數 `relativePoint` 為**相對於剛體質心的局部座標**（預設 `Vec3(0,0,0)`），不可傳入世界座標 `chassis.position`，否則當車輛駛離原點時會產生假性俯仰力矩。賽道 `CatmullRomCurve3` 取樣時需確保 `pt.y = Math.max(0, pt.y)` 高於底層草地平面（`y = -0.15`），並留意 `right = (-tan.z, 0, tan.x)` 時頂點繞序以維持正面朝上（`+Y`）。
- 頁面暴露 `window.__apexStage` 測試與遙測 API（`getTelemetry()`、`setAutoInput()`、`selectCar()`、`selectTrack()`、`startDriving()`、`openGarage()`），供自動化試駕與調校腳本讀取即時物理與音效狀態。
