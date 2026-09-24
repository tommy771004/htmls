# 006 — 加快常用分頁切換

- **Status**: IMPLEMENTED — VISUAL QA PENDING
- **Commit**: 1f44f8b
- **Severity**: MEDIUM
- **Category**: Purpose & frequency / easing & duration
- **Estimated scope**: 2 files, CSS durations
- **Repository root**: `/Users/tommy/Documents/Proj/htmls`

## Problem

`app/024-orbit-subs.html:68,73` takes 450ms for the indicator and 550ms for the two-view track on each Orbit/List tap (`:664-677`). `app/067-nature-aquarium.html:74,77` takes 450ms to switch among four tabs (`:496-504`). These are frequent navigation actions.

```css
/* app/024-orbit-subs.html:68,73 — current */
.vt .bar{position:absolute;left:0;bottom:6px;height:3px;background:var(--ink);transition:transform .45s var(--snap),width .45s var(--snap)}
.track{position:absolute;inset:0;display:flex;width:200%;transition:transform .55s var(--snap)}
```

```css
/* app/067-nature-aquarium.html:74,77 — current */
.tabs .leaf{position:absolute;bottom:4px;left:0;width:25%;height:10px;pointer-events:none;transition:transform .45s var(--spring)}
.track{display:flex;height:100%;transition:transform .45s var(--out)}
```

## Target

For 024, set the indicator to `transform 200ms var(--snap)` and change its measured width immediately; set the track to `transform 240ms var(--snap)`. For 067, set the leaf to `transform 200ms var(--out)` and track to `transform 240ms var(--out)`. Repeated taps and swipe reversals should retarget from the current visual position because these remain CSS transitions. Keep the existing reduced-motion rules; they must still suppress travel.

## Repo conventions to follow

Both apps keep their own easing tokens in `:root` (`024:19`, `067:19`); use those tokens. `067:501-504` already removes the transition during finger tracking with `.track.drag`, so preserve that gesture distinction.

## Steps

1. Apply the exact target transition declarations in `app/024-orbit-subs.html`.
2. Apply the exact target transition declarations in `app/067-nature-aquarium.html`.
3. Check the reduced-motion blocks and ensure the new durations do not override their zero-travel rules.

## Boundaries

- Do not alter tab markup, data loading, aquarium physics, or swipe thresholds.
- Do not replace the local easing tokens with global ones; the apps intentionally differ.
- If the cited code no longer matches commit `1f44f8b`, stop and report drift.

## Verification

- **Mechanical**: `rtk git diff --check -- app/024-orbit-subs.html app/067-nature-aquarium.html`.
- **Feel check**: tap tabs repeatedly, then reverse a swipe midway. The content should arrive in 240ms without jumping; inspect at 10% playback and with reduced motion enabled.
- **Done when**: common navigation responds promptly and remains interruptible.
