# 001 — 建立動畫 token 與 reduced-motion 區塊

- **Status**: DONE
- **Commit**: d37c05f
- **Severity**: LOW（但 002–010 全部依賴它，必須最先做）
- **Category**: Cohesion & tokens
- **Estimated scope**: 1 個檔案（`index.html`），約 15 行 CSS

## Problem

`index.html` 沒有任何緩動或時長 token，時長手打散落在各處（`.15s`、`.18s`、`.2s`、`.25s`），之後的動畫計畫需要共用同一組曲線與時長。

```css
/* index.html:160-161 — current（:root 內） */
  --r-card:18px;
  --r-pill:999px;
```

```css
/* index.html 目前的 hover 過場（全部用瀏覽器預設 ease，這是對的，不要改曲線） */
/* :217 */ .btn{...;transition:background-color .15s,color .15s}
/* :220 */ .iconbtn{...;transition:background-color .15s}
/* :223 */ .seg button{...;transition:background-color .15s,color .15s}
/* :229 */ .mini{...;transition:background-color .15s,color .15s}
/* :248 */ .search input{...;transition:background-color .15s,box-shadow .15s}
/* :262 */ .cat{...;transition:background-color .15s,color .15s}
/* :286 */ .card{...;transition:background-color .15s}
```

```css
/* index.html:415 — current（全域 reduced-motion，暫時保留，由 010 處理） */
@media (prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:.01ms!important;transition-duration:.01ms!important}}
```

## Target

`:root` 內新增（值一字不差）：

```css
  --ease-out:cubic-bezier(0.23, 1, 0.32, 1);
  --ease-in-out:cubic-bezier(0.77, 0, 0.175, 1);
  --dur-hover:150ms;
  --dur-press:160ms;
  --dur-enter:220ms;
  --dur-exit:150ms;
  --dur-morph:280ms;
```

上面 7 條 hover 過場只把 `.15s` 換成 `var(--dur-hover)`，**不加任何緩動函式**（hover/顏色變化用預設 `ease` 是正確的）。

在第 415 行那條全域規則的**正上方**新增一個空的 reduced-motion 區塊，供 002–009 往裡面加規則：

```css
/* 減少動態：保留透明度與顏色變化，只移除位移與縮放。各動畫計畫把自己的規則加在這裡 */
@media (prefers-reduced-motion:reduce){
}
```

## Repo conventions to follow

- CSS 全寫在 `index.html` 的單一 `<style>`（:155–416），壓縮成一行一條規則、冒號後不加空格。
- token 放在 `:root`（:156–178），命名用 `--` 前綴短名，例如既有的 `--r-card`、`--r-pill`。新 token 緊接在 `--r-pill:999px;` 之後。
- 深色主題 `:root[data-theme="dark"]`（:179）不需要重複動畫 token。

## Steps

1. 在 `index.html:161` `--r-pill:999px;` 之後插入 Target 中 7 行 token（保留兩格縮排，與周圍一致）。
2. 把 :217、:220、:223、:229、:248、:262、:286 的每個 `.15s` 改成 `var(--dur-hover)`。例：`.btn{...;transition:background-color var(--dur-hover),color var(--dur-hover)}`。
3. 在 :415 那行（`@media (prefers-reduced-motion:reduce){*,*::before...`）的正上方插入 Target 中的空區塊與註解。第 415 行本身**不要動**。

## Boundaries

- 不要改任何 `ease` 或加上 `var(--ease-out)` 到 hover 過場。
- 不要動 `.toast`（:413）、`.bezel`（:381）、`.bezel .loading`（:386）——分別由 003、004 處理或刻意保留。
- 不要刪第 415 行的全域規則（由 010 處理）。
- 不要改 HTML 或 JS。
- 若行號或程式碼與上方摘錄不符（commit 之後有改動），停下回報，不要自行發揮。

## Verification

- **Mechanical**：在 Chrome 開 `index.html`，Console 無錯誤。DevTools → Elements → 選 `<html>`，Computed 面板能看到 `--ease-out` 等 7 個變數。`grep -c "\.15s" index.html` 應為 0。
- **Feel check**：hover 按鈕、分類、卡片，顏色過場與改動前完全一樣（這一步只是換名字，外觀不該有任何差異）。
- **Done when**：7 個 token 存在、`.15s` 全部改為 `var(--dur-hover)`、空的 reduced-motion 區塊位於第 415 行正上方。
