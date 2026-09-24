# 008 — 讓連續票數更新接續目前畫面

- **Status**: IMPLEMENTED — VISUAL QA PENDING
- **Commit**: 1f44f8b
- **Severity**: MEDIUM
- **Category**: Interruptibility / performance
- **Estimated scope**: 1 file, `updateCard()` and result CSS
- **Repository root**: `/Users/tommy/Documents/Proj/htmls`

## Problem

`app/048-aicher-poll.html:391-404` stores each bar's inline target width, replaces the entire card, forces layout, then starts a new 800ms width transition. A second vote during that transition uses the previous target instead of the currently visible width; the bar can jump. The page adds simulated votes every 4200ms (`:453-465`), and the user can vote while a previous update is moving.

```js
/* app/048-aicher-poll.html:393-403 — current */
var old = {}; box.querySelectorAll('.opt').forEach(function(b){ old[b.dataset.o] = b.querySelector('.fill').style.width; });
/* … */
el.replaceWith(nc); nc.querySelector('.cin').scrollTop = st;
void nc.offsetWidth;
requestAnimationFrame(function(){ targets.forEach(function(t){ var b = nc.querySelector('.opt[data-o="'+t[0]+'"]'); if (!b) return; b.querySelector('.fill').style.width = t[1]; b.style.transform = t[2]; }); });
```

## Target

Each update begins at the bar's **computed visual scale** and option's **computed transform** at the moment of replacement. Change `.fill` from inline width percentages to `width:100%;transform-origin:left center;transform:scaleX(pct/100)`, with `transition:transform 240ms var(--out)`. Keep the existing target ranks from `cardHtml(p)` but change `.opt` to `transition:transform 240ms var(--out)`. Change the runner from animated `left` to fixed `left:0` plus a pixel `translateX(trackWidth * pct/100 - 32)` computed after its track is mounted; give it `transition:transform 240ms var(--out)`. Store the percent as `data-pct` on each runner. The enclosing `.opts` height can remain `400ms var(--out)` for rare structural changes. After replacement, advance from captured visual transforms to targets in the next painted frame without `void nc.offsetWidth` on each vote. On resize, recompute runner translation from its `data-pct` and current track width.

## Repo conventions to follow

`app/048-aicher-poll.html:19` defines `--out:cubic-bezier(.22,1,.36,1)` and `:104-108` contains the three relevant transitions. Keep the same colors, ranking order, and accessible vote counts produced by `optsHtml()` at `:329-349`.

## Steps

1. Update `optsHtml()` to emit fill `scaleX` values and runner `data-pct` values. Give `.runner` `left:0`; after `renderDeck()` mounts the card, calculate `translateX(track.clientWidth * Number(runner.dataset.pct)/100 - 32)` for each runner. Use the existing option ID `data-o` as the mapping key.
2. Before replacement, capture `getComputedStyle(...).transform` for each `.fill`, option, and runner, then build the new card with `cardHtml(p)` and save its target transforms. Apply captured visual transforms before mounting.
3. After one paint, set targets; calculate each new runner's target translate from its mounted track width and `data-pct`. Remove the synchronous `void nc.offsetWidth`. Ensure a later vote can interrupt the new transition from its computed visible values.
4. Set the exact target durations in `.opt`, `.opt .fill`, and `.opt .runner`. Recompute runner translation on resize. Preserve the existing reduced-motion override.

## Boundaries

- Do not change poll totals, vote sorting, simulation cadence, card content, or colors.
- Do not add a motion library.
- If the cited code no longer matches commit `1f44f8b`, stop and report drift.

## Verification

- **Mechanical**: `rtk git diff --check -- app/048-aicher-poll.html`; verify `updateCard()` no longer reads `.fill.style.width` as the previous displayed width, uses `void nc.offsetWidth`, or animates width/left for results.
- **Feel check**: vote twice within 240ms and watch an incoming simulated vote. At 10% playback, every bar and rank should continue from its visible position; no reset or jump. Repeat with reduced motion.
- **Done when**: rapid vote updates are continuous and the result remains legible.
