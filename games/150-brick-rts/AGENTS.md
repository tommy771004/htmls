# Brick RTS 階段契約

遵循使用者要求及 `../../docs/Brick_RTS_Prompt_Pack/brick_rts_prompt_pack/docs/BUILD_ORDER.md`；Master 為該包 `prompts/00_PROJECT_MASTER.md`。

- 先讀 `docs/stage-dependencies.json`、`docs/feature-ledger.csv` 與當前階段 prompt，再實作。一次交付可執行、可驗證的階段成果，不一次生成整套假玩法。
- 原作未指定的版本、build、內容、成本、速度、戰鬥數值保留 null/unverified；自訂工程規則必須 design_default。原作分母未知時不計百分比。
- 已有來源為 packages/content/rules.ts；不要在 UI 複製另一套規則。實作狀態、資料存在、單元驗證、瀏覽器操作與目標硬體量測分開記錄。
- 尚未實作的功能不提供看似可用的按鈕；空介面、模型或說明不算遊戲行為完成。
- 每個可玩里程碑執行提示包 `prompts/19_FIRST_TIME_USER_FIX_LOOP.md`。从乾淨目錄安裝與首次進站開始，保留問題表、seed/ruleset/tick、環境、重現步驟、截圖/log、嚴重度、根因與原步驟重測結果。
- 優先處理無法啟動、卡住、黑屏、破圖、碰撞、無法完成對局與資料丟失，再擴充。不得把 sandbox 測試寫成完整對局通過。
- 本專案目前 C 階段 in_progress（B 核心基礎已驗證；完整玩法仍按後續階段接入）。原作資料待確認不阻止自訂工程，但阻止精確對照聲明；E 對局閉環及 19 驗收未通過前不能稱完整 RTS。
