# guns.glb 來源與授權

`assets/278/models/guns.glb` 由 `games/278-ochre-line/tools/build-guns.py` 產生。遊戲內的型號全部是虛構名稱，與下列真實槍廠、原作者的命名無關，也不代表他們認可本作品。

## 來源模型（CC BY 4.0）

授權全文：<https://creativecommons.org/licenses/by/4.0/>

| 節點 | 遊戲內名稱 | 原模型 | 作者 | 連結 |
| --- | --- | --- | --- | --- |
| `p9` | P9 手槍 | Heckler & Koch USP Pistol | [Urpo](https://sketchfab.com/Urpo) | <https://sketchfab.com/3d-models/heckler-koch-usp-pistol-972e3643000246e8959a6df509557bcc> |
| `r50` | R50 重型手槍 | 同上（共用 `p9` 幾何） | 同上 | 同上 |
| `v11` | V11 衝鋒槍 | MAC-11 | [SK3D](https://sketchfab.com/SplashKid) | <https://sketchfab.com/3d-models/mac-11-9f0dbab63c6c4ab2bee9b141ed58383e> |
| `s8` | S8 霰彈槍 | Remington 870 Shotgun | [Urpo](https://sketchfab.com/Urpo) | <https://sketchfab.com/3d-models/remington-870-shotgun-05a6a02909ee4fcfa5cde3d76cb067f0> |
| `ks` | KS 短突擊步槍 | AKSU-74 game ready | [Drus](https://sketchfab.com/Drus) | <https://sketchfab.com/3d-models/aksu-74-game-ready-3a735e998521443587b292cf52c3ac4e> |
| `ar5` | AR5 突擊步槍 | M4A1 Sopmod Remaster | [minghauLoh](https://sketchfab.com/minghau) | <https://sketchfab.com/3d-models/m4a1-sopmod-remaster-c417b8a56e4447fe9d627000dd305f32> |
| `l40` | L40 狙擊槍 | USMC M40A5 Sniper | [Urpo](https://sketchfab.com/Urpo) | <https://sketchfab.com/3d-models/usmc-m40a5-sniper-f724d89f40db46b0afce2b57ac6d4823> |
| `frag` | 破片手榴彈 | M67 Fragmentation Grenade | [Vextin](https://sketchfab.com/vextin) | <https://sketchfab.com/3d-models/m67-fragmentation-grenade-05e2a29118c3408eaa574bcec6997aba> |
| `smoke` | 煙霧彈 | Smoke Grenade | [polyowlstudios](https://sketchfab.com/SairamJ) | <https://sketchfab.com/3d-models/smoke-grenade-3f88783a9e974a21bd43fef96c9ef54c> |
| `flash` | 閃光彈 | 同上（共用 `smoke` 幾何） | 同上 | 同上 |

## 改作說明

所有來源模型都經過下列修改：

- 合併成單一網格，最多兩個材質；套用變換、統一朝向與公尺單位，並依真實尺寸重新縮放。
- 重新命名為虛構型號。
- 貼圖縮到 1024，重新打包：合併 AO／粗糙度／金屬度成一張 ORM，轉成 WebP 內嵌。材質超過兩個的 `p9`、`l40` 把 UV 島重新排進同一張貼圖。
- 塗掉廠牌與型號字樣，albedo、法線、ORM 三張圖都處理：
  - `p9`：滑套與握把片的廠牌標誌、型號、口徑。
  - `v11`：機匣上的廠牌、型號與產地字樣。
  - `s8`：序號。
  - `ks`：機匣的型號、製造廠標誌、口徑、產地字樣，星號與序號，以及配件廠牌字樣。
  - `ar5`：廠牌馬標、廠牌與地址、軍方財產字樣、序號。
  - `frag`：彈體環形標示。
  - `smoke`：型號、顏色與批號；`flash` 另外擦掉其餘文字。

個別修改：

- `ks`：逐零件減面，54k → 24k 三角形（小零件不動），法線由原模型轉印。
- `smoke`：24k → 9k 三角形，貼圖重新上色；`flash` 換成灰殼加淡黃標示帶。
- `v11`：原檔有兩把擺拍的槍，只取彈匣裝好、槍托收合的那一把，並移除背帶。
- `r50`：與 `p9` 共用幾何與法線，滑套換暗鎳塗裝。`p9`、`r50` 的底色貼圖加上程序磨損。

保留的字樣：保險與擊發模式標記（FIRE／SAFE 之類的通用詞）、煙霧彈的 SMOKE 與使用警語。

## 自建

`knife`（K2 戰鬥刀）與 `charge`（破門裝藥）由 `tools/build-guns.py` 以 Blender Python 程式建模，貼圖全部用 numpy 程序生成，沒有使用外部素材，隨本專案授權。

## 未採用

`games/260-neon-nightcity/.cache/arms/c4_explosive.glb` 雖然在 Sketchfab 標示 CC BY 4.0，但節點與材質路徑是 `models/weapons/w_eq_c4`、`materials/models/weapons/w_models/w_c4/c4`，這是 Source 引擎的資產路徑，貼圖版面也屬於 Counter-Strike 的 C4。上傳者很可能沒有授權權利，造型也違反 `SPEC.md` 的原創界線，所以不使用，改為自建 `charge`。作品 260 目前的 `arms` `c4` 也用到這個檔案，值得另外檢查。
