# 002 — 按鈕按下時的縮放回饋

- **Status**: DONE
- **Commit**: d37c05f
- **Severity**: LOW
- **Category**: Physicality & origin
- **Estimated scope**: 1 個檔案（`index.html`），約 8 行 CSS
- **Depends on**: 001

## Problem

所有可按的控制項（`.btn`、`.iconbtn`、`.seg button`、`.cat`、`.mini`）按下時只有 hover 色，沒有「被按下去」的回饋，點擊感覺空。

```css
/* index.html:217, 220, 223, 229, 262 — 執行 001 之後的樣子 */
.btn{...;transition:background-color var(--dur-hover),color var(--dur-hover)}
.iconbtn{...;transition:background-color var(--dur-hover)}
.seg button{...;transition:background-color var(--dur-hover),color var(--dur-hover)}
.mini{...;transition:background-color var(--dur-hover),color var(--dur-hover)}
.cat{...;transition:background-color var(--dur-hover),color var(--dur-hover)}
```

## Target

- 在上述 5 條規則的 `transition` 末尾各加上 `,transform var(--dur-press) var(--ease-out)`。
- 新增一條按下規則，**只用 `:active`，hover 時絕對不移動**：

```css
.btn:active,.iconbtn:active,.seg button:active,.cat:active,.mini:active{transform:scale(.97)}
```

- 在 001 建立的 reduced-motion 區塊內加入：

```css
  .btn:active,.iconbtn:active,.seg button:active,.cat:active,.mini:active{transform:none}
```

## Repo conventions to follow

- 控制項樣式集中在 `/* ---------- controls ---------- */`（:216–232）。新的 `:active` 規則放在 `.mini.on,.mini.on:hover{...}`（:231）之後、`.weak{...}`（:232）之前。
- `.cat` 在 :262，只需修改它的 `transition`，`:active` 已涵蓋在上面那條合併規則裡。

## Steps

1. :217 `.btn` 的 transition 改為 `transition:background-color var(--dur-hover),color var(--dur-hover),transform var(--dur-press) var(--ease-out)`。
2. :220 `.iconbtn` → `transition:background-color var(--dur-hover),transform var(--dur-press) var(--ease-out)`。
3. :223 `.seg button` → 同步驟 1 的寫法。
4. :229 `.mini` → 同步驟 1 的寫法。
5. :262 `.cat` → 同步驟 1 的寫法。
6. 在 :231 之後插入 Target 中的 `:active` 規則。
7. 在 reduced-motion 區塊內加入 Target 中的 `transform:none` 規則。

## Boundaries

- **不要**加到 `.search .clear`（:253）——它已有 `transform:translateY(-50%)`，縮放會覆蓋掉置中位移。
- **不要**加到 `.card`——整張卡片是連結（`.card h2 a::after` 覆蓋全卡，:295），卡片縮放或浮起是 anti-slop 明列的「卡片 hover-lift」。
- **不要**加到 `.chip button`、`.linkbtn`。
- 不要加任何 `:hover` 的 transform。
- 若程式碼與摘錄不符，停下回報。

## Verification

- **Mechanical**：Chrome 開 `index.html`，Console 無錯誤。
- **Feel check**：
  - 按住「隨機一件」、排序、網格/列表、分類、卡片上的愛心：按住時縮小到 97%，放開回彈，160ms 內完成，不拖泥帶水。
  - 只 hover 不按：按鈕**不移動**，只換背景色。
  - DevTools → Animations 面板播放速度 10%：縮放從中心發生，沒有抖動。
  - 手機或 DevTools 觸控模擬：在分類列（`.cats`，可橫向滑動）上快速滑動，分類按鈕不應閃爍縮放；若會閃，回報（可能需要把 `.cat` 從 `:active` 規則移除）。
  - DevTools → Rendering → Emulate `prefers-reduced-motion: reduce`：按下不縮放，顏色變化仍在。
- **Done when**：5 個控制項按下時縮放到 .97、hover 不動、reduced-motion 下不縮放。
