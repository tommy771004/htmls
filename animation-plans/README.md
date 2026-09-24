# App 001–100 layout realism and motion plans

Source audit: all 100 standalone files under `app/`, reviewed at commit `1f44f8b`. The user selected the findings in order. All 12 plans have been implemented sequentially and applied to the main project at `/Users/tommy/Documents/Proj/htmls`; its 16 changed app pages remain uncommitted for review. `plans/` already holds a different audit for `index.html`, so this series lives in `animation-plans/`.

## Recommended execution order

Execute the plans sequentially, in number order. Plans 007 and 009 both edit `app/006-neon-home.html`, so 007 must land before 009. Other plans are independent, but the numbered order keeps the user-selected priority.

| # | Plan | Severity | Status | Dependency |
| --- | --- | --- | --- | --- |
| 001 | [Label market demo](001-label-market-demo.md) | HIGH | IMPLEMENTED · VISUAL QA PENDING | — |
| 002 | [Label transit and flight simulation](002-label-transit-flight-simulation.md) | HIGH | IMPLEMENTED · VISUAL QA PENDING | — |
| 003 | [Unclip maze on short screens](003-unclip-maze-on-short-screens.md) | HIGH | IMPLEMENTED · VISUAL QA PENDING | — |
| 004 | [Transform core drags](004-transform-core-drags.md) | HIGH | IMPLEMENTED · VISUAL QA PENDING | — |
| 005 | [Clarify medication reminder scope](005-clarify-medication-reminder-scope.md) | MEDIUM | IMPLEMENTED · VISUAL QA PENDING | — |
| 006 | [Speed up frequent tabs](006-speed-up-frequent-tabs.md) | MEDIUM | IMPLEMENTED · VISUAL QA PENDING | — |
| 007 | [Cover scripted reduced motion](007-cover-scripted-reduced-motion.md) | MEDIUM | IMPLEMENTED · VISUAL QA PENDING | — |
| 008 | [Retarget poll results](008-retarget-poll-results.md) | MEDIUM | IMPLEMENTED · VISUAL QA PENDING | — |
| 009 | [Shorten light feedback](009-shorten-light-feedback.md) | MEDIUM | IMPLEMENTED · VISUAL QA PENDING | 007 |
| 010 | [Fix like sticker entry](010-fix-like-sticker-entry.md) | LOW | IMPLEMENTED · VISUAL QA PENDING | — |
| 011 | [Fade packing success](011-fade-packing-success.md) | LOW | IMPLEMENTED · VISUAL QA PENDING | — |
| 012 | [Mark new calendar event](012-mark-new-calendar-event.md) | LOW | IMPLEMENTED · VISUAL QA PENDING | — |

The original audit identified two intentional motion exceptions: the metro split-flap mechanics and the long Polaroid darkroom development. Do not shorten those while executing this series.

## Validation boundary

The local browser policy rejected opening `file:///...` pages during the audit and execution. The complete worktree diff passes `git diff --check`; all 16 changed pages' inline scripts pass `node --check`, and the executor's targeted source assertions pass. Each plan still needs its listed manual viewport or feel check in an approved preview environment before marking it DONE. The repository has no general `app/` test script.
