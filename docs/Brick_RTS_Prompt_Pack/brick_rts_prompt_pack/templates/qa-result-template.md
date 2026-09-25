# 測試證據模板

## 身份與環境
- Test ID／對應 Feature ID：
- 類型：schema / unit / integration / replay / browser / multiplayer / performance / art-review
- Commit／ruleset hash／asset bundle hash：
- OS／browser 版本／CPU／GPU／RAM／解析度／畫質：
- Seed／遊戲設定／玩家數／單位數／可見數：
- 日期與執行方式：

## 步驟與結果
- 實際指令：
- 前置條件與完整重現步驟：
- 預期行為：
- 實際行為：
- 狀態：not_run（初始值；只有實際驗證後才改 pass／fail／blocked）
- 原始 log／截圖／影片／replay／trace 路徑：
- 重現率：

## 量測（適用時）
- 模擬 tick p50／p95／p99、backlog：
- Frame time p50／p95／p99；FPS 統計定義：
- Draw calls／triangles／textures／buffers：
- 記憶體指標、估算方法與限制：
- 網路 RTT／jitter／loss／每玩家流量：
- 場景中 idle／moving／fighting、近／遠與可見實體數：

## 修正與回歸
- 根因／嚴重度：
- 修改檔案與測試：
- 原重現步驟是否重測：
- 相關功能是否回歸：
- 仍未驗證項：

禁止用樣本值填成果欄；未執行保持空白和 not_run。
