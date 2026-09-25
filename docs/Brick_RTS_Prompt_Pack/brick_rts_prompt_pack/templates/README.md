# 模板使用說明

`feature-ledger.csv` 目前有 152 筆「提議的系統／品質檢查項」，全部未實作；它不是已核對的原作完整文明／兵種目錄。真正內容全集必須按所選 version/build 另行展開。

- scope_status=proposed：尚待範圍固定，不能自動當作使用者已同意刪減。
- reference_status=unverified：需要原作規則來源或對照證據。
- reference_status=design_proposal：本包提出的工程／原創美術規格，不代表原作機制。
- implementation_status=not_started：未實作。其餘狀態可用 in_progress、implemented、verified、blocked。
- implementation_files、test_ids、runtime_evidence：實際完成後填入；不能用描述性文字代替真實路徑或結果。

JSON 是「清冊範例」而非完整遊戲資料庫或 JSON Schema。null 是刻意保留的未知／未製作值，禁止當作原作數值 0 或無該項。`qa-result-template.md` 提供各種測試的證據欄位。
