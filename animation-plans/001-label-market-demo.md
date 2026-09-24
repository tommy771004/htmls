# 001 — 明示行情與委託皆為示範

- **Status**: IMPLEMENTED — VISUAL QA PENDING
- **Commit**: 1f44f8b
- **Severity**: HIGH
- **Category**: Layout detail / data realism
- **Estimated scope**: 1 file, copy and a few DOM updates
- **Repository root**: `/Users/tommy/Documents/Proj/htmls`

## Problem

`app/021-salmon-stocks.html:368-401` generates market history from seeded values ending on a fixed date. The order UI still uses real transaction language at `:322-348`, and the completion toast at `:968` says `成交` or `已送出隔日委託`.

```js
/* app/021-salmon-stocks.html:368,402 — current */
/* ================= seeded market ================= */
(function(){ var d = new Date(2026, 8, 23); while (DAYS.length < N){ var w = d.getDay(); if (w && w < 6) DAYS.unshift(new Date(d)); d.setDate(d.getDate() - 1); } })();
```

```html
<!-- app/021-salmon-stocks.html:322,348 — current -->
<button class="trade" id="tradeBtn">下單</button>
<button class="hold-btn" id="holdBtn"><i class="fill"></i><span id="holdL">按住一秒，送出買進委託</span></button>
```

## Target

Keep the self-contained simulation. Make its status visible beside the quote and inside the order drawer, without burying it in a footer. Use the exact labels `示範行情・非即時`, `模擬下單`, `模擬委託，不會送往券商`, `模擬成交`, and `已建立模擬隔日委託`. Display the model date from `DAYS[DAYS.length - 1]` as `模型日期 YYYY/MM/DD`; do not present that date as an actual quote timestamp. Change all order success and history status text accordingly. Preserve existing prices and trading mechanics.

## Repo conventions to follow

This is a single-file, offline app; `APP-DIRECTIONS.md:3-6` prohibits external resources. `app/021-salmon-stocks.html:309` already groups the quote and its metadata, while `:335-349` groups order context. Put the labels in those groups using the existing `--ink-3` and `--song` styling rather than introducing a new card style.

## Steps

1. In `app/021-salmon-stocks.html`, add the visible demo label and model date next to `.quote .meta`; populate the date from the existing `DAYS` array.
2. Rename the trade trigger, hold instruction, and order drawer heading with the exact target strings.
3. Update `submitOrder()` toast and the order-history output in `holdHtml()` so simulated fills and queued orders never claim a real transaction. Also replace the empty-holdings prompt's `下單` label.
4. Check any newspaper headline or timestamp next to the generated stories and mark that block `情境新聞・示範內容`.

## Boundaries

- Do not add a data provider, network request, account connection, or real trading action.
- Do not alter generated prices, holdings math, order validation, or the visual newspaper concept.
- If the cited code no longer matches commit `1f44f8b`, stop and report drift.

## Verification

- **Mechanical**: `rtk git diff --check -- app/021-salmon-stocks.html`; inspect `rtk git diff -- app/021-salmon-stocks.html` for every transaction label.
- **Feel check**: open quote, story, order drawer, and order history on a phone-sized viewport. The simulated status must be visible at the moment a user reads a price or presses the order control.
- **Done when**: no visible quote, story, order confirmation, or order history implies live brokerage data or an actual trade.
