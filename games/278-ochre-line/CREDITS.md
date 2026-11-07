# 赭線 素材來源與授權

本作品是受 @0xKense1 影片啟發的原創作品，與 Valve／Counter-Strike 及各槍廠無關。地圖、遊戲內武器名稱、介面造型都是原創。各素材的完整紀錄在 `credits/`。

## CC BY 4.0（需署名）

授權全文：<https://creativecommons.org/licenses/by/4.0/>。模型都有減面、重新貼圖與改名。

| 遊戲內 | 原模型 | 作者 |
| --- | --- | --- |
| R50 重型手槍（`guns.glb` 的 `p9` 幾何） | [Heckler & Koch USP Pistol](https://sketchfab.com/3d-models/heckler-koch-usp-pistol-972e3643000246e8959a6df509557bcc) | [Urpo](https://sketchfab.com/Urpo) |
| V11 衝鋒槍 | [MAC-11](https://sketchfab.com/3d-models/mac-11-9f0dbab63c6c4ab2bee9b141ed58383e) | [SK3D](https://sketchfab.com/SplashKid) |
| S8 霰彈槍 | [Remington 870 Shotgun](https://sketchfab.com/3d-models/remington-870-shotgun-05a6a02909ee4fcfa5cde3d76cb067f0) | [Urpo](https://sketchfab.com/Urpo) |
| 破片手雷 | [M67 Fragmentation Grenade](https://sketchfab.com/3d-models/m67-fragmentation-grenade-05e2a29118c3408eaa574bcec6997aba) | [Vextin](https://sketchfab.com/vextin) |
| 煙霧彈、閃光彈 | [Smoke Grenade](https://sketchfab.com/3d-models/smoke-grenade-3f88783a9e974a21bd43fef96c9ef54c) | [polyowlstudios](https://sketchfab.com/SairamJ) |
| 第一人稱手臂的綁定、袖子 | [FPS Benelli M4 Animations](https://sketchfab.com/3d-models/fps-benelli-m4-animations-225a62190f6043ca975eaa2798ab7e2c) | [Cransh](https://sketchfab.com/ccransh) |
| 第一人稱手套 | [Hand With Gloves](https://sketchfab.com/3d-models/hand-with-gloves-5a6a434b8ec943ffacc581358781eecb) | [JUST](https://sketchfab.com/teenjust500)（Cransh 的模型說明標示手套來源） |
| 士兵裝備 | [Military Character Kit 1.1](https://sketchfab.com/3d-models/military-character-kit-11-cc0-bf37b98b99534ed2b5eb4507f0564e1d) | britdawgmasterfunk |

`credits/guns.md` 另列了第一版 `guns.glb` 用過的 AKSU-74（Drus）、M4A1 Sopmod Remaster（minghauLoh）、M40A5（Urpo）。KS、AR5、L40、P9 後來由 `tools/build_guns_hd.py` 重建為原創高模，第一人稱不再使用，署名仍保留。

Military Character Kit 的授權標示不一致：Sketchfab 標題寫 CC0，檔內 `asset.extras` 寫 CC-BY-4.0。這裡以較嚴格的 CC BY 4.0 署名。

Cransh 的模型說明沒有標示袖子 `sleeve_st6_generalist` 的來源，這裡依模型頁的 CC BY 標示使用。第一人稱手臂只取手套與袖子網格，其骨架動畫與槍沒有使用。

## CC0

- 貼圖、天空：[Poly Haven](https://polyhaven.com/)，逐張作者見 `credits/textures.md`。
- 人物底模、骨架、動畫：Quaternius 的 Universal Base Characters、Universal Animation Library。

- 武器與動作音效的錄音：Freesound 上標示 CC0 的錄音，逐一開音效頁確認授權；標題、描述或標籤提到遊戲名稱、或疑似從遊戲擷取的一律不用。錄音都經過切段、等化與音量處理，每把武器用的來源互不重複。每個來源的網址、作者、授權見 `credits/sfx.md`，用 `node tools/sfx.mjs --verify` 重新確認（最近一次 2026-11-07，78 個來源）。

## 本作品自製

- `kit.glb` 的 41 件城鎮組件與 `palm_a.webp`：`tools/build-kit.py`。
- KS、AR5、L40、P9 高模：`tools/build_guns_hd.py`。
- C7、M7、B90、T4、X10、S6、N9 高模：`tools/guns/<id>.py`，由 `tools/build_guns_hd.py` 烘焙；外型是原創設計，只取槍種類別，沒有下載或改作任何模型。
- K2 戰鬥刀、破門裝藥：`tools/build-guns.py`，貼圖程序生成。
- 武器剪影 `assets/278/ui/`：`tools/gun-icons.py` 由上述模型算繪。
- 音效的合成層（低頻衝擊、機械聲、空間）：`src/audio/sfx.js` 即時算出。
