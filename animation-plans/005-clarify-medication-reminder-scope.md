# 005 — 說清楚用藥提醒的生效條件

- **Status**: IMPLEMENTED — VISUAL QA PENDING
- **Commit**: 1f44f8b
- **Severity**: MEDIUM
- **Category**: Layout detail / behavioral realism
- **Estimated scope**: 1 file, settings copy and accessible description
- **Repository root**: `/Users/tommy/Documents/Proj/htmls`

## Problem

`app/098-kusuri-meds.html:696` calls the setting `到點提醒`; `:799-817` shows an in-page notice, and `:860` invokes the check every 30 seconds while the page is running. No background notification is scheduled. The existing helper `在上方跳出紅框通知` describes appearance, but does not state the page-open requirement.

```js
/* app/098-kusuri-meds.html:696 — current */
'<div class="nm">到點提醒<small>在上方跳出紅框通知</small></div><button class="sw" role="switch" id="swRemind" aria-checked="' + settings.remind + '" aria-label="到點提醒"></button>'
```

## Target

Replace the helper with `僅在此頁開啟時，於上方顯示提醒；關閉頁面後不會通知。` Keep the setting name. Give the switch an `aria-describedby` referring to that same helper text, using a stable ID. The explanation must remain visible when the switch is on or off. Do not imply OS-level or background notifications elsewhere in the UI.

## Repo conventions to follow

The settings rows in `app/098-kusuri-meds.html:687-699` use a `.nm` label and `<small>` explanation, and the controls use `role="switch"` with `aria-checked`. Reuse this row structure and the existing type hierarchy.

## Steps

1. In `renderLog()`, replace the reminder row's `<small>` copy with the exact target string and add `id="remindScope"`.
2. Add `aria-describedby="remindScope"` to `#swRemind`.
3. Inspect the metadata and any other UI copy for claims of background notification; adjust only those claims if present.

## Boundaries

- Do not add Notification API, service workers, permissions, or external scheduling.
- Do not change dose logic, the 30-second check, records, or medication quantities.
- If the cited code no longer matches commit `1f44f8b`, stop and report drift.

## Verification

- **Mechanical**: `rtk git diff --check -- app/098-kusuri-meds.html`; confirm `remindScope` is unique and referenced by the switch.
- **Feel check**: view settings on a narrow phone. The condition should be readable beside the control, and a screen reader should announce it with the switch.
- **Done when**: the page does not suggest reminders continue after it is closed.

