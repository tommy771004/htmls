# 隱藏配件誤選修正

2026-09-25。scene.ts 原本直接對人偶 group 執行遞迴 raycast。Three.js Object3D.visible 不會自動過濾 raycast 命中，因此已卸下、仍快取在手部的武器與隱藏軍種裝備也可能擴大選取範圍。

新增 apps/web/picking.ts，以 traverseVisible 收集真正可見的 mesh，再執行非遞迴 raycast。保留 LOD 使用詳細選取幾何的行為；單位 ID 判定、地面射線、模擬狀態、碰撞及 snapshot v9 未修改。

build 與 69 項測試通過，原始結果在 test-results/picking-tests.log。新增回歸先證明原始 Three.js raycast 可命中不可見的父群組，再驗證隱藏根節點、配件群組與 mesh 均不命中。另用實際人偶長矛，對武器高出頭盔的範圍射線，逐一驗證 near／medium／far：裝備時能命中、卸下後沒有命中。

此修正不新增可玩里程碑，不等同選取系統或完整對局完成。C 仍在進行；框選、編組與完整 D 操作仍按 BUILD_ORDER 後續實作。

Chromium 151.0.7922.34 完整 test:browser 通過：1440／390 畫面的選取與移動、存讀／重播、視野、高地與海岸、Worker／WebGL 故障及分類搜尋。
