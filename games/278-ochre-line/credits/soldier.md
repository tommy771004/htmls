# 士兵與第一人稱手臂的素材來源

產出：`assets/278/models/soldier.glb`、`assets/278/models/arms.glb`、`dist/soldier-meta.json`。全部由 `tools/build-soldier.py`（Blender 5.2 背景腳本）產生，來源檔放在其他作品的 `.cache/`，不進 repo。

## 使用的素材

| 素材 | 作者 | 授權 | 用途 |
| --- | --- | --- | --- |
| [Universal Base Characters](https://quaternius.itch.io/universal-base-characters)（男性底模、骨架） | Quaternius | CC0 | 身體網格與骨架；借 `games/197-openworld/.cache/` |
| [Universal Animation Library](https://quaternius.itch.io/universal-animation-library) | Quaternius | CC0 | 所有動畫的底：Idle、Walk、Jog、Crouch、Jump、Hit_Chest、Death01、Fixing_Kneeling、Pistol_Idle |
| [Military Character Kit 1.1](https://sketchfab.com/3d-models/military-character-kit-11-cc0-bf37b98b99534ed2b5eb4507f0564e1d) | britdawgmasterfunk | 見下方說明 | 防彈背心、彈匣袋、腰帶、工具袋、無線電袋、護膝、靴子、頭盔與耳機、褲側袋、臂袋等靜態裝備；借 `games/266-eternauta-plaza/.cache/sketchfab/` |

Military Character Kit 的授權標示不一致：Sketchfab 標題寫 CC0，但 glTF 檔內 `asset.extras` 寫 CC-BY-4.0。兩者都如實記在這裡，並以較嚴格的 CC BY 4.0 署名：

> "Military Character Kit 1.1" by britdawgmasterfunk, CC BY 4.0, https://sketchfab.com/3d-models/military-character-kit-11-cc0-bf37b98b99534ed2b5eb4507f0564e1d

原件經過縮放（套件約 1:5）、重新拓撲（Voxel Remesh＋Decimate）、推出體表、綁到 UBC 骨架，並烘成每隊一張圖集。

## 刻意不用的東西

- `ww2_panzergrenadier` 等二戰德軍服裝、徽章或軍階符號：完全不用。
- `military_helmet.glb`：不用（守方頭盔取自 Military Character Kit）。
- 套件裡的英國旗布章、醫療十字包：烘焙前就排除。

## 本專案自建

- 巴拉克拉瓦、臂章（`#C4552D`、`#5FA89A`）、戰鬥服與迷彩、護目鏡、肩帶、戰術手套的手背硬殼與指節接縫：`build-soldier.py` 程式產生。
- 步槍與手槍持握動畫：以上列 UAL 動畫為底，用解析兩段 IK 把雙手烘到握把與護木，腿部另以 IK 調蹲高。`death_b` 是 `Death01` 的骨架鏡像，`strafe_*` 由 Walk 轉骨盆得來，`back_rifle` 是 Walk 反轉。
- 11 個命中部位膠囊：以貼合網格的方式由蒙皮後頂點擬合，存在 `dist/soldier-meta.json`。

授權以原始來源為準；這些素材檔不屬於本專案。

## 重新產生

```bash
blender -b -P tools/build-soldier.py -- --stage bake        # 兩隊低模與 2048 烘焙，輸出到 dist/soldier-work/
blender -b -P tools/build-soldier.py -- --stage all         # 動畫、合併、soldier.glb、dist/soldier-meta.json
blender -b -P tools/build-soldier.py -- --stage armsbake    # 第一人稱手臂烘焙
blender -b -P tools/build-soldier.py -- --stage arms        # arms.glb；要排在 all 之後
```
