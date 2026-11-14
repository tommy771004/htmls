# 巔峰試駕 · APEX STAGE '98（作品 285）

**非官方原創車款與賽道致敬作品，與任何車廠無關。** 致敬 90 年代末日本街機與家用主機擬真賽車黃金年代（如《Gran Turismo》、《Sega Rally》、《Ridge Racer Type 4》）的 3D 瀏覽器物理賽車與試駕模擬器。打包後為單一離線 HTML 檔案 `web/285-apex-stage.html`，不依賴任何外部網路資源或音效檔案。

## 核心架構與技術規格

| 模組 | 檔案 | 說明 |
| --- | --- | --- |
| 物理車庫與規格 | `src/physics/cars.js` | `D / C / B / A / S` 五級性能分級、10 款原創車款（涵蓋 `FWD` 前驅、`RWD` 後驅、`AWD` 四驅），定義真實車重、馬力、紅線轉速、齒比、懸吊行程、前後配重與空力下壓力係數。 |
| Pacejka 輪胎物理 | `src/physics/tires.js` | 簡化版 Pacejka 魔術公式（$F = D \sin(C \arctan(B x - E(Bx - \arctan(Bx))))$）結合摩擦圓（Friction Circle）耦合，並支援柏油（Asphalt）、路緣石（Curb）、砂石（Gravel）、泥地（Dirt）與草地（Grass）動態摩擦係數折減。 |
| 車輛剛體與懸吊 | `src/physics/vehicle.js` | 基於 `cannon-es` `RaycastVehicle` 實作四輪獨立懸吊、俯仰與側傾動態重心轉移（Weight Transfer）、防傾桿（Anti-roll Bar）、高速空力下壓力（Aerodynamic Downforce）與 AT／MT 變速箱邏輯。 |
| 程序化 PBR 材質 | `src/graphics/textures.js` | 執行期 Canvas 動態生成柏油路面、紅白路緣石、草地、砂石、泥地與起終點方格旗之 Albedo／Normal／Roughness 貼圖，以及 PMREM 環境反射貼圖。 |
| 3D 車體建模與塗裝 | `src/graphics/car-builder.js` | 依車款軸距、車寬、車鼻傾角、座艙罩與尾翼參數生成 10 款差異化 3D 車體、卡鉗碟盤與輪圈，支援金屬漆（Metallic）、珍珠漆（Pearl）、消光漆（Matte）3 大類共 9 種預設車漆與自訂選色器。 |
| 視覺特效與尾跡 | `src/graphics/effects.js` | 輪胎極限滑移黑煙／砂石塵土粒子、地面胎痕（Skidmarks）Ribbon Mesh、煞車燈與頭燈光束、回火尾焰（Exhaust Backfire Flame）與 >120 km/h 動態 FOV 速度感補償。 |
| 雙賽道與測試場 | `src/tracks/tracks.js` | **TSUKUBA APEX CIRCUIT**（含高低起伏、S 彎、髮夾彎、紅白路緣石、護欄、看台與 6 個檢查點／S1-S2-S3 三段計時）與 **ARIAKE PROVING GROUND**（含定圓甩尾區 Skidpad、雙飛躍跳台 Ramps、懸吊波浪路、越野泥地與砂石拉力區、外環高速跑道）。 |
| Web Audio 合成器 | `src/audio/synth.js` | 100% 原生 Web Audio API 即時 DSP 合成：多振盪器引擎聲浪（依汽缸數與紅線轉速調製基頻與奇偶次諧波）、`WaveShaperNode` 負載失真、渦輪增壓（Turbo Spool）與洩壓閥（BOV）、收油回火放炮（Pop & Bang）、雙共振峰輪胎尖叫、路緣石低頻震動、砂石底盤敲擊與 90 年代 FM 街機介面音效。 |
| 雙模輸入控制器 | `src/input/controller.js` | 完整支援 `Gamepad API`（線性扳機 RT/LT、搖桿死區過濾、換檔撥片與雙馬達震動回饋）與鍵盤轉向速率曲線（Speed-sensitive Steering Curve）及行動裝置觸控按鈕。 |
| 90 年代街機 HUD | `src/ui/hud.js` | 360° 旋轉展示間（Showroom Turntable）、五維性能長條圖、右下角高對比圓弧轉速錶（含紅線超轉閃爍燈）、左上角單圈與區間計時面板、右上角即時賽道縮圖（Minimap）。 |

## 操作說明

| 動作 | 鍵盤 | 手把（標準配置） | 觸控（行動裝置） |
| --- | --- | --- | --- |
| 油門／煞車（倒車） | `W`／`S` 或 `↑`／`↓` | `RT`／`LT`（線性扳機） | 右側 `GAS`／`BRAKE` |
| 左／右轉向 | `A`／`D` 或 `←`／`→` | 左搖桿 `Left Stick X` | 左側 `◀`／`▶` |
| 手煞車（甩尾起漂） | `Space` | `A` 鍵（按鈕 0） | 右側 `E-BRAKE` |
| 升檔／降檔（MT 模式） | `Shift`／`Ctrl`（或 `E`／`Q`） | `RB`／`LB` | — |
| 切換視角（追尾／引擎蓋／廣角） | `C` | `Y` 鍵（按鈕 3） | 上排 `CHASE [C]` |
| 切換變速箱（AT／MT） | `M` | `X` 鍵（按鈕 2） | 上排 `AT [M]` |
| 車輛重置回賽道 | `R` | `Back`／`Select` | 上排 `RESET [R]` |
| 開關車庫選車展示間 | `G` 或 `Esc` | `Start` | 上排 `GARAGE [G]` |
| 音效靜音切換 | `N` | — | 上排 `SOUND [N]` |

## 開發與驗收指令

```bash
npm run build   # 使用 esbuild 打包單一自包含檔案至 ../../web/285-apex-stage.html
npm run test:unit # 執行 Node 物理與輪胎模型單元測試 (test/physics.test.mjs)
npm test        # 執行單元測試 + Playwright 無頭瀏覽器自動試駕與多視窗驗收 (tools/accept.mjs)
```

## 自動化試駕與遙測 API (`window.__apexStage`)

- `window.__apexStage.getTelemetry()`：回傳即時車速（`speedKmh`）、引擎轉速（`rpm`）、檔位（`gear`）、渦輪增壓值（`boostBar`）、縱向／橫向 G 值（`longG`、`latG`）、車身俯仰與側傾角（`pitchDeg`、`rollDeg`）、車輪滑移率與側滑角（`maxWheelSlip`、`maxSlipAngleDeg`）、路面材質（`surface`）、單圈與三段區間時間（`lapCount`、`bestLapMs`、`sectorTimes`）以及 Web Audio `AnalyserNode` 即時音訊峰值（`audioPeak`）。
- `window.__apexStage.setAutoInput({ throttle, brake, steer, handbrake })`：注入測試控制訊號（傳入 `null` 恢復玩家控制）。
