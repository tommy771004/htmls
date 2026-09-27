# 動態十六式 · Motion Studies（176）

final result: passed

本次範圍：依使用者提供的影片製作單一 HTML 動效展示，歸入「介面風格」。保留影片的 16 格順序、四欄組成與米白／炭黑／橘／藍配色；新增中文說明、播放控制與手機兩欄。這是重新實作的動效練習，非影片逐像素複製或原作者程式碼。

## 視覺證據

- 原始影片：https://x.com/charliejhills/status/2103893708550914076
- source visual truth path: `reports/motion-studies/reference.png`（800×1000，影片循環終點回到起始構圖）。
- implementation screenshot path: `reports/motion-studies/desktop.png`（1425×1499）與 `reports/motion-studies/mobile.png`（375×2071）。
- viewport: 桌機 1440×900、手機 390×844；DPR 1，截圖寬度扣除 15px 捲軸。桌機四欄、手機兩欄，均無水平溢出。
- state: `desktop-start.png` 為 0 秒；`desktop.png` 與手機圖為暫停的 4 秒展開狀態。
- full-view comparison evidence: `reports/motion-studies/comparison.jpg`，將影片和實作的 4×4 區域並排，等比正規化寬度；中文第二行標籤使實作格子較高，此為有意調整。
- focused region comparison: 在瀏覽器檢查搜尋、工作區、儀表板標題、卡片照片與底排粒子；完整桌機截圖足以讀取這些細節。參考圖是壓縮影片，未假設能取得其原始字型、圖示或逐幀 easing。

## 修正與複驗

1. [P2，已修正] 第 06 格放大時裁到 Overview 左側。降低縮放並修正平移，最新桌機／手機截圖中標題完整可見。
2. [P1，已修正] SVG 子節點持續更新時，快速點擊可能未觸發父按鈕。設 `pointer-events: none`，事件固定落在可鍵盤操作的原生按鈕。修正後逐一點擊 01–16，全部回報正確重播狀態。

目前無待處理 P0／P1／P2。

## 五項視覺檢查

- 字體：系統 Arial 搭配繁體中文 fallback；保留粗無襯線標題與小型等寬序號，桌機／手機標題不溢出。
- 間距：一致的圓角白框、13px 桌機格距、10px 手機格距；四列顺序與參考一致，控制列可在窄螢幕收縮。
- 色彩：米白底、深炭黑舞台、珊瑚橘強調與粉藍圖表；聚焦 outline 清楚可見。
- 影像：單張生成的橘色靜物照片，以 480×480 WebP 內嵌供堆疊卡片與揭幕使用，無拉伸、外部載入或破圖。圖表、介面轉場、字體與粒子為本次要求的原生動畫內容。
- 文案：16 格英文名稱、中文動效說明及原始影片出處完整；資料標示為示範，不沿用影片的模型宣傳主張。

## 功能驗證

- 16 個動效按鈕依序點擊，確認各自重播與狀態文字；播放／暫停及全部重播。
- 時間軸 0、1000、4000、7990、8000ms 均能顯示；沒有 NaN、undefined、Infinity；拖曳會暫停並清除個別偏移。
- 速度選單可選 2×；Dock 支援 pointer 與左右方向鍵。
- `prefers-reduced-motion: reduce` 下重新載入：初始為暫停，停在 4 秒可讀狀態。
- 瀏覽器 console error／warning 與 Runtime exception 檢查無錯誤；Network 記錄只有同來源 HTML 與內嵌 data 圖片，沒有外部資源請求。
- 首頁搜尋「動態十六式」並篩選「介面風格」可找到 176；縮圖 naturalWidth=640；點入預覽後 iframe 正確載入此頁與 Sixteen Motion Studies 標題。證據：`reports/motion-studies/catalog-preview.png`。
- `git diff --check` 通過。未執行與此單檔頁面無關的麻將伺服器測試。

## 實作清單

- [x] 單檔 HTML／CSS／SVG／JavaScript，圖片內嵌。
- [x] 16 種動效、時間軸與重播控制。
- [x] 桌機、手機、減少動態與鍵盤入口。
- [x] 首頁分類、README、llms、sitemap 與縮圖。
- [x] 本機瀏覽器驗證；尚未部署。

後續精修：小格內的示範文字依影片的縮小介面比例呈現；手機使用者可使用瀏覽器縮放閱讀。未測試實體 iOS Safari 裝置。

編號修正：本頁由 175 改為未使用的 176；入口、縮圖、README、llms 與 sitemap 同步更新。原視覺驗證截圖保留當時的編號，功能與版型不變。
