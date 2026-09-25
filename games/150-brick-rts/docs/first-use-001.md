# 首次使用修正迴圈 001 — 2026-09-25

依 prompts/19_FIRST_TIME_USER_FIX_LOOP.md 執行；範圍為 B 階段移動沙盒，不是完整對局。

## 環境與重現基準

- 新工作目錄：`/var/folders/05/x61j217d49g9k0_kccntyzsr0000gn/T/brick-rts-first-use-xa_puclf`；複製 source／lockfile，排除 node_modules，再執行 npm ci --ignore-scripts。
- Node v22.23.1、macOS / darwin arm64；Playwright Chromium 151.0.7922.34。
- seed 260925、ruleset hash `b66067ad`、首次進站 tick 0；桌機 1440×900、手機 390×844。
- 瀏覽器 runtime 為既有本機 Playwright；不是新安裝 Playwright。未測其他瀏覽器及目標內顯裝置。

## 實際路徑與結果

1. npm ci → build → validate → test：全部成功；13 tests / 13 pass。
2. 首次進站等待畫面：地圖、說明、村民及操作按鈕可見，無例外／外部请求。
3. 選村民 2 → 移動 → 前進一 tick：tick 1 且狀態改變。
4. 儲存 → 推進 → 讀取：回到相同指紋；重播一致。
5. 開始 → 暫停：tick 停止；壞檔讀取被拒絕，現況保留。
6. 種子改 7 → 重建 → 點地面移動：指令成功排入；改回 260925 重建得到初始指紋。
7. JSON 驗證：自訂規則通過；要求精確原作版本、壞 JSON、負成本均拒絕。還原及下載可用。
8. 首頁遊戲敘事分類 → 搜尋 Brick RTS：找到作品。
9. 依提示 19 尋找採集、建造、升時代、造兵、偵查、戰鬥與勝敗：目前尚未實作；不能繼續完整對局驗收。沒有假按鈕代替。

## 問題表

| ID | 嚴重度／重現 | 操作、預期、實際與根因 | 狀態與回歸 |
|---|---|---|---|
| B-REPLAY-001 | P1 API；5/5 非法參數 | replay 傳 Infinity／NaN／負數／小數／超量 ticks；應立即拒絕，原實作可能不終止或靜默截斷。根因是 replay 缺少公開參數邊界。 | 已修正 sim.ts；governance.test.ts 原參數重測全部拒絕。 |
| RTS-LOOP-001 | P1 完整對局；兩尺寸均缺功能 | 首次進站後派工採集→建造→勝敗；預期可完成一局，目前只接受 move。根因是 C–E 尚未實作。 | 未解決，阻止完整遊戲聲明；E 實作後必须從步驟 1 重測。 |
| RTS-COLLISION-001 | P1 完整戰場；程式確認、瀏覽器穿越路徑尚未量測 | 裝飾屋／樹與單位未共享 occupancy，tick 直接逐軸靠近目標。正式對局預期不能穿越建築。 | 未解決；C 建立地形與實體，D 加碰撞／尋路後先測房屋、狹道、堵門，再擴充 E。 |
| RTS-SETTINGS-001 | 範圍缺口 | 提示 19 的畫質／音量目前沒有對應 renderer 或 audio 功能。 | 未實作，不提供假設定。 |

本輪沒有新增已知黑屏、UI 卡住或資料丟失；上述完整對局阻塞仍存在，不能標為「無已知阻塞」。碰撞與完整對局沒有實測通過，亦未宣稱修復。

## 命令與證據

```sh
npm ci --ignore-scripts
npm run build
npm run validate
npm test
npm run sim:headless
PLAYWRIGHT_MODULE=/Users/tommy/Documents/Proj/OldBabyInfo/node_modules/playwright/index.mjs npm run test:browser
```

原始 headless 結果：`docs/headless-result.json`。乾淨目錄的瀏覽器截圖：`/var/folders/05/x61j217d49g9k0_kccntyzsr0000gn/T/brick-rts-first-use-xa_puclf/games/150-brick-rts/test-results/desktop-1440.png`、`desktop-390.png`。權威 state hash 一致不代表畫面、碰撞、目標硬體效能或原作規則一致。

下一步維持 B：Worker 訊息／錯誤恢復與狀態邊界；B 證據充分後依 C→D→E 實作。每個可玩里程碑新增一份問題表，未修且未重測的問題不得關閉。
