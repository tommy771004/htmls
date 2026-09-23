# 003 — Toast 進出場改用強 ease-out 與不對稱時長

- **Status**: DONE
- **Commit**: d37c05f
- **Severity**: LOW
- **Category**: Easing & duration
- **Estimated scope**: 1 個檔案（`index.html`），2 行 CSS
- **Depends on**: 001

## Problem

Toast（收藏／取消收藏時出現）進出場用的是瀏覽器預設 `ease`，進場起步偏慢；進出場時長也一樣。

```css
/* index.html:413-414 — current */
.toast{position:fixed;left:50%;bottom:24px;z-index:80;transform:translate(-50%,12px);padding:9px 18px;border-radius:var(--r-pill);background:var(--text);color:var(--bg);font-size:14px;opacity:0;pointer-events:none;transition:opacity .18s,transform .18s;box-shadow:var(--shadow)}
.toast.show{opacity:1;transform:translate(-50%,0)}
```

## Target

進場 220ms、退場 150ms，兩者都用 `--ease-out`。CSS 過場用的是「目標狀態」上的 `transition`：所以 `.toast.show` 上的時長控制進場，`.toast` 本身的時長控制退場。

```css
.toast{...（其餘不變）...;transition:opacity var(--dur-exit) var(--ease-out),transform var(--dur-exit) var(--ease-out);...}
.toast.show{opacity:1;transform:translate(-50%,0);transition-duration:var(--dur-enter)}
```

reduced-motion 區塊內加入（保留淡入淡出，移除 12px 位移）：

```css
  .toast{transform:translate(-50%,0)}
```

## Repo conventions to follow

- 保持一行一條規則。只替換 `transition:opacity .18s,transform .18s` 這一段，其餘屬性順序不動。

## Steps

1. :413 把 `transition:opacity .18s,transform .18s` 換成 `transition:opacity var(--dur-exit) var(--ease-out),transform var(--dur-exit) var(--ease-out)`。
2. :414 在 `.toast.show{...}` 大括號內末尾加上 `;transition-duration:var(--dur-enter)`。
3. 在 reduced-motion 區塊內加入 `.toast{transform:translate(-50%,0)}`。

## Boundaries

- 不要改 `toast()` JS 函式（:910–911）、顯示時間 1500ms、`box-shadow`。
- 不要改成 `@keyframes`——連按收藏時 toast 會重複觸發，transition 可以從當前狀態接續，keyframes 會從頭重播。
- 若程式碼與摘錄不符，停下回報。

## Verification

- **Mechanical**：Chrome 開 `index.html`，Console 無錯誤。
- **Feel check**：
  - 點卡片上的愛心：toast 從下方 12px 快速升起，起步就快；1.5 秒後較快地下沉淡出。
  - 快速連點同一顆愛心 5 次：toast 不閃爍、不從頭跳出，而是保持顯示或平順接續。
  - Animations 面板 10%：進場明顯比退場長。
  - Emulate reduced-motion：toast 只淡入淡出，不上下移動。
- **Done when**：進場 220ms / 退場 150ms，皆為 `cubic-bezier(0.23, 1, 0.32, 1)`，reduced-motion 下無位移。
