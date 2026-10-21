# 角色模型來源

透過網站伺服器開啟時，13 名英雄的網格與貼圖改用下列 Sketchfab 模型（`assets/198/<id>.glb`，由 `blender/glb_heroes.py` 轉換：換到遊戲骨架、擺成 A 字綁定姿勢、減面、貼圖縮到 512）。以檔案開啟或載不到時，退回程式建模的 `src/models-baked.js`。卡卡西沒有 GLB，一律用程式建模。

全部標示為 CC BY 4.0（<http://creativecommons.org/licenses/by/4.0/>），作者、標題與網址取自各檔 `asset.extras`。修改內容：重新綁骨（沒有骨架的模型自動刷權重）、改姿勢、減面、縮貼圖、刪掉武器與部分配件（劍、刀、棍由遊戲另外繪製），以及疊在同一處的其他型態（香吉士的惡魔風腳、多餘的臉與手，特南克斯重複的眼白）。

| 英雄 | 模型 | 作者 | 原檔 |
| --- | --- | --- | --- |
| 悟空 | [Goku](https://sketchfab.com/3d-models/goku-6a79ab6b70b747b68e787da1458ab582) | [Nemix](https://sketchfab.com/nemix) | `goku/goku.glb` |
| 貝吉塔 | [TheSaiyajin - Vegeta Bodyguard](https://sketchfab.com/3d-models/thesaiyajin-vegeta-bodyguard-68e0da8646264a559468a2c1fbd23be4) | [schischu](https://sketchfab.com/schischu) | `vegeta/thesaiyajin_-_vegeta_bodyguard.glb` |
| 特南克斯 | [jump_force___future_trunks_by_petventh_dd3369z](https://sketchfab.com/3d-models/jump-force---future-trunks-by-petventh-dd3369z-bc4e07f174a142b09e0eb414fe5e272a) | [Chris](https://sketchfab.com/braxter) | `trunks/jump_force___future_trunks_by_petventh_dd3369z.glb` |
| 比克 | [Piccolo_Dbxv2](https://sketchfab.com/3d-models/piccolo-dbxv2-660bd56b41e64b3ba1316571f98ff27e) | [20062020year](https://sketchfab.com/20062020year) | `Piccolo/piccolo_dbxv2.glb` |
| 弗利沙 | [Frieza - Emperor of the Universe](https://sketchfab.com/3d-models/frieza-emperor-of-the-universe-84fa59c153f8403c9b805e8e408db077) | [HorrorKingMario](https://sketchfab.com/HorrorKingMario) | `Freezer/frieza_-_emperor_of_the_universe.glb` |
| 18 號 | [Android 18](https://sketchfab.com/3d-models/android-18-04cad82bd9b24b428d2747b6a968232d) | [giakogiako01](https://sketchfab.com/giakogiako01) | `android_18/android_18.glb` |
| 鳴人 | [Naruto Shippuden- Naruto](https://sketchfab.com/3d-models/naruto-shippuden-naruto-ea2e5dff481243b9973f2bb34a384031) | [#Anime resource!!!](https://sketchfab.com/lopuh22721) | `鳴人/naruto_shippuden-_naruto.glb` |
| 佐助 | [sasuke](https://sketchfab.com/3d-models/sasuke-eac52e1fd006488f801a914988f807c1) | [langifoaga](https://sketchfab.com/langifoaga) | `Sasuke/sasuke (1).glb` |
| 小櫻 | [Sakura](https://sketchfab.com/3d-models/sakura-6409fbcec6864a72b1011856a068fd52) | [danigamer495channel](https://sketchfab.com/danigamer495channel) | `Sakura/sakura.glb` |
| 魯夫 | [Monkey D. Luffy](https://sketchfab.com/3d-models/monkey-d-luffy-3d9fb8bd86854aa69ee6f69fcbeaca51) | [nitwit.friends](https://sketchfab.com/nitwit.friends) | `Luffy/monkey_d._luffy.glb` |
| 索隆 | [Roronoa Zoro (Post timeskip)](https://sketchfab.com/3d-models/roronoa-zoro-post-timeskip-533adf71b6d546d094b1d5481f12b578) | [Cyrone™](https://sketchfab.com/Cyrone) | `Roronoa/roronoa_zoro_post_timeskip.glb` |
| 香吉士 | [Vinsmoke Sanji (Post timeskip)](https://sketchfab.com/3d-models/vinsmoke-sanji-post-timeskip-51d524547569451fb84a1d92cf52cc68) | [Cyrone™](https://sketchfab.com/Cyrone) | `Vinsmoke/vinsmoke_sanji_post_timeskip.glb` |
| 娜美 | [Nami](https://sketchfab.com/3d-models/nami-84adc12ab2d345cead60a2d24bf16482) | [lev1953](https://sketchfab.com/lev1953) | `nami/nami (1).glb` |

「原檔」是 `glb_heroes.py` 讀的相對路徑（預設在 `~/Downloads`，`--src` 可改）；原檔不放進 repo。

注意：從檔名與骨架命名看，其中不少是遊戲角色模型的拆檔（Xenoverse 2、Jump Force、Bounty Rush、Fortnite 等），由上傳者以 CC BY 4.0 發布，上傳者未必擁有授權。角色本身的著作權屬各原作者與遊戲公司；本作是非官方同人作品。
