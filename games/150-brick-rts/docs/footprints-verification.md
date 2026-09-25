# 共用物理占地契約

2026-09-25。新增 packages/content/footprints.ts，集中住宅、樹木、石礦、金礦、野果、獵物與家畜的既有地面矩形。navigation.ts 的 bounds 改由 obstacleBounds 擴張單位半徑；building-parts.ts 的住宅地基讀取同一資料。導航本身的演算法與數值不變。

這些是 design_default 工程數值，不是原作對照數值。屋頂懸挑與上層裝飾不等於地面通行阻擋；展示用功能建築仍未加入權威占地種類。入口可通行／作業區整合仍待後續，不因這次共用資料而標記完成。

## 修改前後證據

修改前先保存 seed 7、42、260925 各自的 meadow、coast、acceptance 共九組資料。修改後以同一指令讓村民 1 移往 (600,900) 並跑 240 ticks；逐組比較初始 hash、最後 hash、blocked 陣列及 ruleset hash，全部完全一致。原始資料在 test-results/footprints-before.json 與 footprints-after.json。

新增測試檢查住宅四時代、完整／受損／殘骸地基均吻合物理範圍；所有七種障礙的四邊接觸都拒絕通行，而緊鄰擴張矩形外側一單位的點可通行。非法半徑拒絕。此處比較的是物理地基與碰撞，不拿視覺屋頂包圍盒當權威規則。

資料模型文件已明確區分目前 v9 與歷史演進。相容性成立是因為數值未變；未來變更物理尺寸需更新 simulationVersion／ruleset 身份，不能將此表當成可任意修改而不改存檔版本的外掛資料。

本輪是既有行為的共用契約整理，不新增可玩里程碑，也不宣稱完成建造、碰撞入口或完整對局。C 維持 in_progress。

執行結果：build、73 項程式測試與完整 test:browser 通過；Chromium 151.0.7922.34 驗證桌面／手機、繞行、地形、迷霧、存讀／重播、Worker／WebGL／繪圖例外恢復及分類。單元原始輸出在 test-results/footprints-tests.log；git diff --check 通過。
