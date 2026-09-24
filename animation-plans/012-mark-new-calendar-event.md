# 012 — 標出剛新增的行事曆事件

- **Status**: IMPLEMENTED — VISUAL QA PENDING
- **Commit**: 1f44f8b
- **Severity**: LOW
- **Category**: Missed opportunity
- **Estimated scope**: 1 file, one row state and CSS
- **Repository root**: `/Users/tommy/Documents/Proj/htmls`

## Problem

`app/089-swiss-calendar.html:4` saves a newly created event, closes the sheet, then rebuilds the calendar and agenda with `render()`. The new row has no visual indication after that full redraw, particularly on a day with several events.

```js
/* app/089-swiss-calendar.html:4 — current excerpt */
events.push({id:String(Date.now())+Math.random().toString(36).slice(2,5),title:$('#title').value.trim(),start:a,end:b,time:$('#eventTime').value,category:$('#category').value});save();selected=date(a);closeSheet();render()
```

## Target

Capture the new event ID during submit. After `render()`, find exactly its agenda row by `data-event` and apply a temporary `.fresh` class. Use a 200ms opacity highlight only: start at `opacity:.65`, finish at `opacity:1` with `cubic-bezier(0.23,1,0.32,1)`. Keep the row fully readable from the first frame. Remove `.fresh` after 200ms; under reduced motion, skip the animation and show `outline:2px solid #d9322e;outline-offset:-2px` for those 200ms so the event is still identifiable. Do not animate month, week, or day navigation.

## Repo conventions to follow

The agenda rows already receive `data-event` in `renderEvents()` at `app/089-swiss-calendar.html:4`; use that stable ID. The UI is Swiss-typographic with red as its only signal color (`#d9322e`), so use that color only for the brief reduced-motion border. The app's CSS and JS are compact inline blocks.

## Steps

1. Store the newly created event object and its `id` before `events.push`, then call the existing save/close/render sequence.
2. Add `.fresh` only to the row whose `data-event` matches that ID, after render. Remove it after 200ms; do not leave stale state in localStorage.
3. Add `@keyframes freshEvent{from{opacity:.65}to{opacity:1}}` and `.event.fresh{animation:freshEvent 200ms cubic-bezier(0.23,1,0.32,1)}`. Under `prefers-reduced-motion:reduce`, set `.event.fresh{animation:none;outline:2px solid #d9322e;outline-offset:-2px}`. Ensure the ID selector is safely constructed from the generated ID.

## Boundaries

- Do not add movement to ordinary calendar navigation or change sorting/date logic.
- Do not change event persistence or edit/delete behavior.
- If the cited code no longer matches commit `1f44f8b`, stop and report drift.

## Verification

- **Mechanical**: `rtk git diff --check -- app/089-swiss-calendar.html`.
- **Feel check**: create an event on a crowded day in month and day views. Its agenda row should be immediately recognizable without waiting for an entrance animation. Repeat under reduced motion and verify the border or focus cue remains.
- **Done when**: the newly created row can be found at a glance and routine navigation stays instant.
