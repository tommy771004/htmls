# 009 — 讓切燈光暈即時回應

- **Status**: IMPLEMENTED — VISUAL QA PENDING
- **Commit**: 1f44f8b
- **Severity**: MEDIUM
- **Category**: Physicality / purpose & frequency
- **Estimated scope**: 1 file, CSS only
- **Repository root**: `/Users/tommy/Documents/Proj/htmls`

## Problem

`app/006-neon-home.html:94-95` starts each room light at `scale(.001)` and takes 700ms to reach its lit state. The room switch at `:556` is a frequent core action, so the response begins from near invisibility and feels delayed.

```css
/* app/006-neon-home.html:94-95 — current */
.lightc{transform-box:fill-box;transform-origin:center;transform:scale(.001);transition:transform .7s var(--out),opacity .4s}
.lit .lightc{transform:scale(1)}
```

## Target

Use `transform:scale(.95);opacity:0` when off and `transform:scale(1);opacity:1` when lit. Transition both `transform` and `opacity` over `200ms var(--out)`; the existing `--out:cubic-bezier(.2,.8,.2,1)` matches this app's motion language. The bulb and room state should update on the same click. Under reduced motion, remove scaling but keep a `200ms` opacity change, following the existing reduced-motion block at `:260-267`.

## Repo conventions to follow

`app/006-neon-home.html:19` defines local `--out` and `--snap` curves. The light circle is an SVG element with `transform-box:fill-box` and a centered origin; keep that origin for a bulb glow rather than imposing a popover-style trigger origin. The scan and flicker are separate effects.

## Steps

1. Replace the two `.lightc` declarations with the exact target properties and durations.
2. Adjust the reduced-motion `.lightc` rule to remove only its scale transition and preserve the opacity response.
3. Check that flicker, scene switching, and the numeric light state still agree after rapid on/off taps.

## Boundaries

- Do not change brightness calculations, room state persistence, or the plan artwork.
- Do not alter the independent camera reduced-motion work in plan 007.
- If the cited code no longer matches commit `1f44f8b`, stop and report drift.

## Verification

- **Mechanical**: `rtk git diff --check -- app/006-neon-home.html`.
- **Feel check**: toggle one light repeatedly. At 10% playback, the glow should change near its final size rather than materialize from a point. With reduced motion, it should fade without growth.
- **Done when**: frequent light toggles give immediate, subtle feedback.

