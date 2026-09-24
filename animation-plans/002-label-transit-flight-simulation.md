# 002 — 標清交通與航班推算資料

- **Status**: IMPLEMENTED — VISUAL QA PENDING
- **Commit**: 1f44f8b
- **Severity**: HIGH
- **Category**: Layout detail / data realism
- **Estimated scope**: 2 files, labels and refresh copy
- **Repository root**: `/Users/tommy/Documents/Proj/htmls`

## Problem

`app/011-metro-arrivals.html:409-440` computes arrivals from a fixed interval and phase, but its train strip at `:322` calls the position `即時列車位置`. `app/074-panam-flights.html:293-297` derives flight states from a local catalog and an hourly anchor; `:229` calls its button `更新動態`, and `:364` redraws random delays on click.

```js
/* app/011-metro-arrivals.html:409-416 — current */
// ---------- simulation ----------
var SEG = 110; // seconds per code unit
function now(){ return Date.now() / 1000; }
```

```js
/* app/074-panam-flights.html:293-297 — current */
var anchor=new Date();anchor.setMinutes(0,0,0);anchor=+anchor;
function prog(f){var t=times(f),n=Date.now();return(n-t.dep)/(t.arr-t.dep)}
```

## Target

In 011, show `示範班次・到站時間為模擬推算，非即時資訊` adjacent to the arrival strip and set its accessible name to `模擬列車位置`. In 074, show `示範航班・位置與延誤為模擬資料` above the tracked list and label the refresh action `產生示範動態`; its toast must say `已更新示範航班狀態`. Keep these labels readable without opening a sheet. Do not call either feed live or imply official status.

## Repo conventions to follow

`APP-DIRECTIONS.md:3-6` specifies standalone inline HTML without external resources. Both apps already have compact subtitle/meta text near the principal data (`011:315-325`, `074:228-232`). Reuse those typographic styles and preserve the route, globe, and boarding-pass artwork.

## Steps

1. Add the exact visible and accessible 011 labels beside its existing strip; retain the countdown formula.
2. Add the exact 074 status next to `.phead`, rename the refresh accessible label, and update the button toast and any sheet copy that calls it a real update.
3. Inspect the initial state, filter states, and detail sheet for conflicting `即時` wording; replace only claims about data provenance.

## Boundaries

- Do not connect transit or flight APIs, create credentials, or change schedules.
- Do not rename route, station, airport, or flight identifiers merely to disguise simulation.
- If the cited code no longer matches commit `1f44f8b`, stop and report drift.

## Verification

- **Mechanical**: `rtk git diff --check -- app/011-metro-arrivals.html app/074-panam-flights.html`; search visible strings for `即時列車位置` and `更新動態`.
- **Feel check**: on each app's first screen and after refresh, read the primary data without opening another panel. The demo status must remain obvious and visually subordinate to the main value.
- **Done when**: the two screens explain their simulated source at the point of use.
