# 城鎮組件 kit.glb 來源

`assets/278/models/kit.glb` 的 41 件組件全部由 `tools/build-kit.py` 用 Blender Python 程式建模，沒有下載任何模型，歸屬本作品。
`assets/278/tex/palm_a.webp`（棕櫚、灌木、雜草的葉片圖集）由同一支腳本算繪，同樣沒有外部來源。

貼圖不在 glb 裡，材質名對應 `assets/278/tex/` 的貼圖，來源見 `credits/textures.md`。

## 看過但沒有採用的素材

Poly Haven（CC0）的 `Barrel_01`、`barrel_03` 看過預覽。它們的外觀幾乎全靠自帶的 2K 貼圖（紅漆與警示貼紙、藍漆），而這裡的材質走共用貼圖，留下來的只有一個普通鐵桶幾何，自建已能做到相同形狀，所以不用。木箱類（`wooden_crate_01`、`wooden_crate_02`）是扁長比例，對不上 1.25 m 方箱。

## 重新產生

```bash
blender --background --python tools/build-kit.py -- --tex --sheet
```

`--tex` 重畫葉片圖集（需要 `cwebp`），`--sheet` 用真實貼圖算繪 `dist/kit-sheet.png` 與 `dist/kit-detail.png`。節點、尺寸、材質清單在 `dist/kit-meta.json`，由腳本直接解析 glb 產生。
