# 007 — 讓程式繪製與捲動遵守減少動態效果

- **Status**: IMPLEMENTED — VISUAL QA PENDING
- **Commit**: 1f44f8b
- **Severity**: MEDIUM
- **Category**: Accessibility
- **Estimated scope**: 3 files, JS motion branches
- **Repository root**: `/Users/tommy/Documents/Proj/htmls`

## Problem

All three apps have CSS reduced-motion rules, but scripted motion bypasses them. In `app/015-clay-water.html:539-549`, `fall()` still creates splashes, bubbles, and a running water simulation when `reduce` is true. In `app/006-neon-home.html:785-809`, the gate camera redraws moving noise and a scan band every ~80ms. In `app/008-doodle-habits.html:880`, adding a habit always calls smooth scrolling.

```js
/* app/015-clay-water.html:548 — current */
if (reduce || !dropEl.animate){ fall(); }
```

```js
/* app/008-doodle-habits.html:880 — current */
var pg = $('p-today'); setTimeout(function(){ pg.scrollTo({ top: pg.scrollHeight, behavior:'smooth' }); }, 60);
```

## Target

For 015 under reduced motion, update the water fill to its final level and draw one static frame; skip `poke`, `splash`, `bubbles`, and `kick` for the pour response. Preserve the numeric log, goal toast, and color/opacity feedback. For 006 under reduced motion, draw a stable camera image without the moving band or regenerated random noise; update its text timestamp independently every second if that timestamp is visible. For 008, use `behavior:'auto'` when `matchMedia('(prefers-reduced-motion: reduce)').matches` and `behavior:'smooth'` otherwise. Changes to the OS preference while the app stays open must affect the next interaction.

## Repo conventions to follow

`015:225`, `006:260`, and `008:248` already define component-specific reduced-motion CSS. `015:491` already avoids bottle rotation when `reduce` is true. Extend those local branches instead of adding a global `animation:none` override.

## Steps

1. In 015, split `fall()` into a reduced-motion static completion path and its existing physics path. Do not enter the rAF loop for a reduced-motion pour; evaluate the media query when the pour starts.
2. In 006, separate static corridor drawing from moving camera noise/band drawing. The reduced-motion camera should render once on entry and again only on resize or meaningful state change. Make the `reduce` value respond to media-query changes before the next camera frame.
3. In 008, branch the `scrollTo` behavior at the call site using the exact target values.

## Boundaries

- Do not disable all feedback or prevent users from logging water, viewing the gate camera, or adding a habit.
- Do not change the normal-motion timing or visual personality.
- If the cited code no longer matches commit `1f44f8b`, stop and report drift.

## Verification

- **Mechanical**: `rtk git diff --check -- app/015-clay-water.html app/006-neon-home.html app/008-doodle-habits.html`; inspect every scripted `requestAnimationFrame` path touched.
- **Feel check**: toggle the OS reduced-motion preference while each page is open. Log water, open the gate camera, and add a habit in both modes. Reduced mode should retain clear state changes without sloshing, moving scan bands, or automatic smooth travel.
- **Done when**: the three scripted effects respect the current preference without removing task feedback.

