# 011 — 讓完成打包的提示輕微淡入

- **Status**: IMPLEMENTED — VISUAL QA PENDING
- **Commit**: 1f44f8b
- **Severity**: LOW
- **Category**: Missed opportunity
- **Estimated scope**: 1 file, CSS only
- **Repository root**: `/Users/tommy/Documents/Proj/htmls`

## Problem

`app/094-luggage-packing.html:4` displays `行李準備好了，出發！` only when all items are packed. The toast toggles opacity instantly in the compact CSS at `:2`, so this rare success moment has no gentle arrival.

```css
/* app/094-luggage-packing.html:2 — current */
.toast{position:fixed;left:50%;bottom:80px;transform:translateX(-50%);background:#36281c;color:#fff4db;padding:9px 12px;font-size:12px;z-index:7;opacity:0;pointer-events:none}.toast.show{opacity:1}
```

## Target

Add `transition:opacity 180ms cubic-bezier(0.23,1,0.32,1)` to `.toast`. Keep its position fixed and never animate travel. In the existing `@media(prefers-reduced-motion:reduce)` block, use `transition-duration:120ms` for the toast so the text still has gentle state feedback. Show and hide remain controlled by the existing `.show` class and timer.

## Repo conventions to follow

This small app has compact inline CSS and already provides reduced-motion rules at `app/094-luggage-packing.html:2`. Other state changes such as `.sheet.open` use a local transition, so place this change next to `.toast` rather than adding a global motion system.

## Steps

1. Add the exact opacity transition to `.toast`.
2. Add the exact reduced-motion duration in the existing media query.
3. Leave the toast JavaScript and all packing interactions untouched.

## Boundaries

- Do not animate the checklist rows or delay completion.
- Do not alter the `fly` item animation or the packing data.
- If the cited code no longer matches commit `1f44f8b`, stop and report drift.

## Verification

- **Mechanical**: `rtk git diff --check -- app/094-luggage-packing.html`.
- **Feel check**: pack the final item, then wait for the toast to disappear. At 10% playback it should fade without changing position; repeat with reduced motion.
- **Done when**: completion remains immediate and its message arrives and leaves gently.

