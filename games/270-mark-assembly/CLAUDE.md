# 裝甲進化殿堂（270）

- 單檔 `web/270-mark-assembly.html`（本地 Three.js 0.186.0，介面沿用 182），沒有 build；裝甲網格是 `assets/270/{bruno,mk3,mk7,mk1,mk38,mk44,mk46,mk47,mk85}.glb`（meshopt 壓縮，解碼器在 `vendor/three-0.186.0/addons/libs/`），要透過網站伺服器開啟。
- GLB 由 `games/270-mark-assembly/tools/bake.py`（Blender 無頭）從 Blend Swap 的三個 `.blend` 與 Sketchfab 的六個 GLB（`MODELS` 裡 `glb=` 的項目，不必先開 .blend）拆成十九個部位、材質換成 `role_p／s／t／k／g` 塗裝角色（85 的寶石是 `role_g_<色碼>`，保留原色）；來源檔在 gitignore 的 `.cache/`。Mark 46／47 是 T 字站姿，依骨架權重分部位並把手臂放下。three 會把節點名的「.」拿掉，頁面用 `PART_RE` 還原。Mark 1、3、7、38、44、46、47、85 是實體模型；Mark 16、17、25、33、39、41、49、50 由 `tools/derive.py` 從實體模型改造（先照 bake.py 拆件、不匯出，再改比例、包外殼、加零件，輸出 `assets/270/mk{16,17,25,33,39,41,49,50}.glb`，頁面標 `kit: true`）；其他型號換色近似，頁面要維持「實體模型／改造／近似」標示、授權面板與「非官方同人作品」聲明；`bruno.glb` 是 CC-BY-SA 3.0、`mk1.glb` 是 CC BY-NC-SA 4.0 衍生作品，要維持同樣授權。
- 型號資料 `MARKS`、部位與自組裝幀區間 `PART`、`window.__mk` 測試 API 與重新烘焙指令見 `games/270-mark-assembly/README.md`，授權見同資料夾的 `CREDITS.md`，進度、待辦與改造做法的取捨見 `HANDOFF.md`。
