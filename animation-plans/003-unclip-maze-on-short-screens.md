# 003 — 讓短螢幕仍可操作木迷宮

- **Status**: IMPLEMENTED — VISUAL QA PENDING
- **Commit**: 1f44f8b
- **Severity**: HIGH
- **Category**: Layout / responsive fit
- **Estimated scope**: 1 file, CSS only
- **Repository root**: `/Users/tommy/Documents/Proj/htmls`

## Problem

`app/061-wood-maze.html:3` sets `body{overflow:hidden}`, while `.shell` is at least 580px tall, or 530px below 680px viewport height. `.world` adds 12px padding on both ends. A viewport shorter than 554px cannot reveal the whole shell or scroll to its controls.

```css
/* app/061-wood-maze.html:3 — current, excerpts from compact CSS */
body{margin:0;min-height:100dvh;overflow:hidden}
.world{min-height:100dvh;display:grid;place-items:center;/* … */padding:12px}
.shell{width:min(100%,430px);height:min(920px,calc(100dvh - 24px));min-height:580px;/* … */overflow:hidden}
@media(max-height:680px){/* … */.shell{min-height:530px}}
```

## Target

Keep the physical wooden shell and its minimum playable board size. Allow vertical page scrolling when the viewport is shorter than the shell plus 24px padding:

```css
body{margin:0;min-height:100dvh;overflow-x:hidden;overflow-y:auto}
```

The `.world` must grow with its grid item; avoid fixed viewport height or an inner scroll area that steals the game's pointer gesture. At 320×480 and 390×500, the board and bottom controls must be reachable by a normal page scroll. At 390×844, the centered presentation should remain as before.

## Repo conventions to follow

The page is standalone with compact inline CSS. `.board{touch-action:none}` at `app/061-wood-maze.html:3` already isolates the game gesture from page scrolling; preserve it. The existing `@media(max-height:680px)` reduces top spacing before the scroll fallback is needed.

## Steps

1. Change only the `body` overflow declaration to the target CSS.
2. Check `.world` and `.shell` for any remaining height or overflow rule that prevents the outer page from growing; remove only the blocking rule if present.
3. Keep `.board` pointer handling and all game geometry unchanged.

## Boundaries

- Do not shrink the board below its current minimum or rework game physics.
- Do not add a scroll container around the canvas.
- If the cited code no longer matches commit `1f44f8b`, stop and report drift.

## Verification

- **Mechanical**: `rtk git diff --check -- app/061-wood-maze.html`.
- **Feel check**: inspect 320×480, 390×500, 390×844, and landscape. Scroll to the controls on short screens; drag the board and confirm the page does not scroll during the drag.
- **Done when**: the full game shell can be reached on short screens, and regular-height layout retains its framing.

