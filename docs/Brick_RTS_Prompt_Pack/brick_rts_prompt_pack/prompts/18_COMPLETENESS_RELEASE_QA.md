# 18｜完整性稽核與交付驗收


依 docs/DEFINITION_OF_COMPLETE.md 檢查全專案。不得用測試總數或某張漂亮截圖推定完整玩法。

- 按固定版本的機制／內容／模式／品質四張矩陣，逐一核對 requirement、程式位置、資料 ID、runtime behavior、測試、證據。找出只改註解、只畫 UI、stub、TODO、假資料與禁用按鈕。
- coverage 的分母必須來自明確版本清冊；unknown／unverified 不可算入完成。自行排除的文明、地圖、海軍、多人、戰役或編輯器需保留未完成，不可從分母刪除後宣稱 100%。
- 執行真正的開始→經濟→發展→攻城→勝敗→再開一局；另跑海戰／運輸、宗教／遺跡、科技／文明差異、存讀、重播、多人與戰役編輯器流程。
- 交叉驗收轉化含遺跡單位、運輸船死亡、訓練中人口下降、科技研究中讀檔、城門變外交、迷霧下目標摧毀、建築塞出口、同 tick 勝敗與重連。
- 分開報告 schema/unit、integration、deterministic replay、真實瀏覽器、多人網路、目標硬體／長局與人工美術檢查。每項可標 pass、fail、not_run、blocked、not_applicable（有已核準理由）。
- 資產稽核來源、授權、原創性註記及 third-party notices；不能把「網路找到」當可商用授權。
- 檢查 npm install/dev/build/test 與 smoke 指令、clean checkout、lockfile、env.example、初次啟動、離線錯誤、存檔 migration、資產路徑、Windows/macOS/Linux 指令與大小寫敏感路徑。

交付 release report、阻塞清單、可重現問題、已完成／未完成分界、實際執行命令與原始結果。可發布 prototype、vertical slice 或 beta；只有所有目標與驗收門檻確實達成才可稱完整指定範圍。這份提示詞本身不代表產品已通過任何測試。
