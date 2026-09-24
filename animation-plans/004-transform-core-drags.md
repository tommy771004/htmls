# 004 — 核心拖曳改用 transform

- **Status**: IMPLEMENTED — VISUAL QA PENDING
- **Commit**: 1f44f8b
- **Severity**: HIGH
- **Category**: Performance
- **Estimated scope**: 2 files, drag and placement logic
- **Repository root**: `/Users/tommy/Documents/Proj/htmls`

## Problem

In `app/055-klein-solitaire.html:74,411-413`, every pointer move writes `left/top` for every card in the dragged stack, and `.card` transitions those layout properties. In `app/100-linen-springboard.html:69,418`, every home-screen icon drag also writes `left/top`. These core gestures repeatedly request layout and paint.

```js
/* app/055-klein-solitaire.html:413 — current */
st.ids.forEach(function(i, k){ var el = els[i]; el.style.left = (st.org[k].l + dx) + 'px'; el.style.top = (st.org[k].t + dy) + 'px'; });
```

```js
/* app/100-linen-springboard.html:418 — current */
function moveDrag(e){ var d = drag; if(!d) return; var sx = e.clientX - d.sr.left, sy = e.clientY - d.sr.top; d.el.style.left = (sx - d.gx)+'px'; d.el.style.top = (sy - d.gy)+'px';
```

## Target

Write positional `left/top` once when a drag starts or settles. During pointer movement, write `transform:translate3d(dx,dy,0)` directly to the dragged element(s), with transitions disabled for the active drag. On drop or cancellation, clear the temporary transform and use existing layout placement once. Change `will-change:left,top` to `will-change:transform` only while dragging; do not permanently promote every card/icon. Keep the existing `.26s var(--snap)` solitaire settle and `.3s var(--out)` home-screen layout timing for non-drag placement.

## Repo conventions to follow

Both files already use a `.drag`/`.dragging` state to disable transitions (`055:75`, `100:79`). `100:68` already uses `transform` for `.strip.snap`. Preserve these local motion tokens and the existing pointer capture and hit testing.

## Steps

1. In 055, retain `st.org` as the base coordinates. During `pointermove`, translate each dragged card by `(dx,dy)` instead of changing `left/top`; on end, clear the drag transform before a final placement or restore. Limit `will-change:transform` to `.card.drag`.
2. In 100, position the icon once when it enters `dragLayer`; record that pixel origin. In `moveDrag`, calculate deltas from that origin and apply `translate3d`. Clear the transform before reattaching and rendering the icon.
3. Confirm that hover targets, stack offsets, folder creation, page-edge switching, and cancellation use the visual pointer position rather than assuming live `left/top` values.

## Boundaries

- Do not alter game rules, card snap targets, icon ordering, or folder semantics.
- Do not add a motion library.
- If the cited code no longer matches commit `1f44f8b`, stop and report drift.

## Verification

- **Mechanical**: `rtk git diff --check -- app/055-klein-solitaire.html app/100-linen-springboard.html`; search both `pointermove` handlers for `style.left` and `style.top` writes.
- **Feel check**: drag a solitaire stack and home-screen icon slowly and rapidly, then cancel midway. At 10% playback, neither object should jump when released. Repeat home-screen folder creation and cross-page dragging.
- **Done when**: movement uses transforms throughout the active gesture and all drop destinations remain correct.

