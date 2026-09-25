# Inspora 參考改造 · 第一批

2026-09-25。範圍：025 家具、096 旅行手記、142 童話城堡。保留原有題材、素材與核心操作，沒有新增外部依賴。

## 參考與實作

- [3D animated cards](https://www.inspora.design/posts/3d-animated-cards)：借用主體優先、資訊分層的展示方式。025 改為寬幅商品研究、側欄選材與可操作的木作／織品細節；延用原本的 CSS 椅子，不宣稱新增了真正 3D 視角。
- [Scenic Footer Section](https://www.inspora.design/posts/scenic-footer-section)：借用風景與編輯式版面的結合。096 改為固定風景搭配四日行程；142 改為左側建築說明、右側完整模型及底部控制。
- 所有動畫是配合既有頁面功能的本地實作，未複製第三方影片或素材。

## 實際驗證

透過 Codex 內建瀏覽器，以 1440×900 與 390×844 檢查畫面與操作，另以 DevTools 模擬 `prefers-reduced-motion: reduce`，驗證後清除模擬設定與視窗尺寸覆寫。

| 頁面 | 驗證結果 |
|---|---|
| 025 | 木作／織品聚焦；木材與布料切換；黑胡桃 2 件為 NT$30,400，購物車小計一致；移除後結帳停用；Escape 關閉且焦點回到購物車按鈕；手機無水平溢出；減少動態效果時 transition 為 0s、沒有飛入元素。 |
| 096 | 四日行程完整；Day 03 黃昏選取更新為 19:38 與 Out at sea；切換月份重建日照時刻並清除舊選取；播放後操作時間滑桿會停止播放；手機點選 Day 02 更新為 06:20 並回到風景；減少動態效果時直接更新；無水平溢出。 |
| 142 | WebGL 成功初始化；連續正面／側面／俯視切換保留最後選擇；拖曳接手並關閉自動環繞；日夜和重設正常；390px 下城堡完整可見；減少動態效果時頁面轉場為 0s；點選 glTF 匯出成功完成資料封裝並顯示完成訊息。內建瀏覽器的 download 事件等待逾時，因此本轮未以該事件驗證檔案落地；匯出器未改動，原始重新載入驗證見 tests/castle-verification.md。 |

三頁瀏覽器未出現 error 層級紀錄。修正城堡在新版 Three.js 中的 PCFSoftShadowMap 相容警告，改用 PCFShadowMap。三頁 inline JavaScript 語法檢查通過。原檔含 CRLF，使用 `git -c core.whitespace=cr-at-eol diff --check` 檢查本次頁面變更。

## 截圖

- [家具桌機](025-desktop.png) / [家具手機](025-mobile.png)
- [旅行桌機](096-desktop.png) / [旅行手機](096-mobile.png)
- [城堡桌機](142-desktop.png) / [城堡手機](142-mobile.png)

本批不包含 093 香水及 049 放射年曆。
