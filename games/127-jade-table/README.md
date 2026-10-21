# 127 青雀：3D 立繪工具

127 本身沒有 build（`web/127-jade-table.html` 直接載入 `assets/jade-table/*.mjs`）。這個資料夾只放大廳與胡牌結算 3D 立繪的資產工具。

## 檔案

- `tools/figures.mjs`：把 Sketchfab 原檔整理成 `assets/jade-table/figures/<角色>.glb`（有 commit）。`FIGURES` 表列出每個角色的原檔、要刪的網格、重新上色、要保留的動作，以及寫進場景 extras 的 `rig`（骨頭對照、眼皮、垂掛布片、描邊設定）。gltf-transform、meshoptimizer、sharp 借用 `../197-openworld/node_modules`。
- `blender/rig_katya.py`：遠山的原檔沒有骨架。這支腳本依量好的關節建骨架、自己刷權重（Blender 的 bone heat 對這種斷開面片很多的遊戲網格會失敗），輸出 gitignore 的 `.cache/katya_rigged.glb`。
- 頁面端是 `assets/jade-table/figure3d.mjs`，來源與授權見 `assets/jade-table/CREDITS.md`。

## 指令

```bash
# 原檔放在 ~/Downloads/japan（可用 FIG_SRC 改）：qingque_-_honkai_starrail.glb、miko.glb、priestess.glb、bloodstrike_katya_geisha_costume.glb
blender -b --factory-startup --python blender/rig_katya.py -- ~/Downloads/japan/bloodstrike_katya_geisha_costume.glb .cache/katya_rigged.glb
node tools/figures.mjs            # 全部；或 node tools/figures.mjs moon bamboo
```

## 頁面端（figure3d.mjs）

- 只在 http(s) 下載入；任何一個模型載入失敗時，那個位置照舊顯示插畫，不會報錯。
- 一個小 renderer，canvas 在大廳的 `.fig3d` 與結算的 `#resultFigure` 之間搬移；dialog 關閉就停止繪製，`prefers-reduced-motion` 時只畫靜止的一格。
- 有待機動作的模型（竹隱）直接播放；其他用程式姿勢：上臂與前臂以世界方向 `aim()` 放下、呼吸與轉頭、青雀用眼皮骨頭眨眼。勝利姿勢是舉起一手、另一手叉腰。
- 統一用三階 toon 著色；描邊是沿視空間法線外推的反向外殼。臉部不描邊；月白用原檔自帶的描邊網格；遠山的面朝向和法線相反，所以不描邊（`rig.noInk`）。
- `window.__jade.figures` 可以手動 `mount(元素, 角色, 'lobby'|'win')`，`current` 是目前的模型。

## 踩過的坑

- 只對動畫呼叫 `dispose()` 時 sampler 不會跟著釋放，被刪掉的動作的關鍵幀會留在檔案裡（月白多出 3 MB）。
- 原檔是 unlit 材質時，`prune()` 會刪掉 NORMAL，toon 著色就整隻變黑，所以要用 `prune({ keepAttributes: true })`。
- three 載入時會拿掉節點名稱裡的「.」：`Arm.L_013` 在 rig 裡要寫成 `ArmL_013`。
- 在 T-pose 下垂掛的布片，手臂放下後會跟著轉成水平。這種骨頭列在 `hang`（保持 T-pose 時的世界朝向）。原本沿手臂飄的飾帶則列在 `dangle`（直接朝下）。
