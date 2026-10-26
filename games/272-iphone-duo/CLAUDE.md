# 272 iPhone Duo 鉸鏈逐件組裝

依 Apple 公開規格重建的書本式摺疊機。每件零件是一個函式，逐件放置，放一件查一次（間隙、干涉、彎曲），失敗就套修正再查，最後才開放動畫。頁面 `web/272-iphone-duo.html` 由本資料夾打包。

## 指令

```bash
node tools/run.mjs [件數] [起點]   # 逐件放置＋檢查（起點之前只套修正不重查，迭代用）
node tools/bake.mjs                 # 完整重播＋最終重驗＋間隙曲線 → build/log.json（約 15 分鐘，機器忙時更久）
node tools/geo.mjs                  # log.json → build/geo.json（截面輪廓、失敗處前後剖面）
node build.mjs                      # 打包成 ../../web/272-iphone-duo.html（esbuild 借 ../201-coral-cove/node_modules）
```

改了 `src/parts.mjs`、`src/fixes.mjs`、`src/check.mjs` 或 `src/kin.mjs` 都要依序重跑 bake → geo → build。`build/` 不進版控（只 commit 打包後的單檔）；`tools/.envcache.json` 是掃掠包絡快取，也不進版控，刪掉只會變慢。

## 架構

- 座標（mm）：x 寬（左半 x<0 背面是外螢幕），y 高，z 厚（+z 內螢幕）。左右半繞虛擬樞軸 (∓1.925, 1.125) 各轉 φ = (180 − θ)/2。
- `src/geom.mjs`：2D 截面 SDF（rect／polygon／sector、CSG、mirror、ribbon）與 marching squares `contour`。CSG 的 `sdf0` 是下界，`sdf` 在 1 mm 內以真實邊界取樣精確化（已扣 H/2，保守）。
- `src/kin.mjs`：內螢幕自由段（兩段等半徑圓弧，R 由幾何唯一決定）、排線自由段（對稱 elastica，牛頓打靶）。**排線要從 φ=90° 往 0 延拓**，φ=0 另有一個往下打 S 彎的平衡解，從 0 起算會落到那一支。
- `src/parts.mjs`：`designV1()` 是動工前的設計參數，`BUILD` 是放置順序（32 件）。零件 = 沿 y 拉伸的稜柱，`frame` 為 S（中脊）、L、R、PL、PR（支撐板）；`shapeAt` 是隨 φ 變形的件（螢幕摺彎、排線）。
- `src/check.mjs`：每對零件在 φ 0–90°（每 1°，最差處 ±1° 再 0.25° 細掃）量截面距離；黏合、齒條嚙合、錨點附近有例外規則。門檻 `TOL` 0.05（全部零件對相同）。
- `src/fixes.mjs`：依放置步驟觸發的修正，`why`／`what` 會直接顯示在頁面上。新增修正就是新增一筆，不要改寫歷史裡的初版參數。
- `src/app.mjs`＋`src/page.html`＋`src/log.html`：頁面。three.x = x、three.y = z、three.z = −y；剖切面是 y 平面，剖面蓋直接用零件截面（擠出件，所以是精確的）。

## 除錯

- `?step=N` 開在第 N 件；全部通過時 `?theta=90`、`?view=whole|hinge|part`。
- `window.__duo`：`goStep(n)`、`setTheta(deg)`、`setView(mode)`、`view.cut`（剖切 y）。
- 驗收用無頭 Chrome（兩種尺寸、不得有 console.error／外部請求、手機不得水平溢出），需經 HTTP 伺服器開（importmap 指向 `../vendor/three-0.186.0/`）。
