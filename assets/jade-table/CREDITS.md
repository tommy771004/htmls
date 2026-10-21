# 青雀 3D 立繪來源

`figures/*.glb` 由 `games/127-jade-table/tools/figures.mjs` 從下列 Sketchfab 模型處理而來（拿掉武器與多餘網格、重新上色、只留需要的動作、貼圖轉 WebP、meshopt 壓縮）。四個模型都以 [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) 授權，頁面的規則帖內有同樣的標示。

| 角色 | 檔案 | 原模型 | 作者 | 修改 |
|---|---|---|---|---|
| 青雀 | `qingque.glb` | [Qingque - Honkai StarRail](https://sketchfab.com/3d-models/qingque-honkai-starrail-721423c0477a4d639753886403f5b6ba) | Gregman | 拿掉頂點色、陰影面罩與牌座，頭髮重新上色 |
| 月白 | `moon.glb` | [Priestess](https://sketchfab.com/3d-models/priestess-a7556957754d428ea59f23f01c086e1f) | tranb95 | 拿掉弓與全部動作 |
| 竹隱 | `bamboo.glb` | [Miko](https://sketchfab.com/3d-models/miko-b2c1cc3daa1045a78acbff7ff4da0f0d) | alienkatgames | 只留 Idle 動作 |
| 遠山 | `mountain.glb` | [Bloodstrike Katya Geisha Costume](https://sketchfab.com/3d-models/bloodstrike-katya-geisha-costume-6b18729e6c8c4f9c9f52b892ae9882eb) | AdklossD | 原檔沒有骨架，以 `blender/rig_katya.py` 綁骨刷權重 |

青雀與遠山是遊戲角色（《崩壞：星穹鐵道》、《Blood Strike》）的非官方同人模型，與 HoYoverse、網易無關，著作權屬原權利人。座位頭像、Q 版表情與 `illus/` 插畫仍是本作原創。
