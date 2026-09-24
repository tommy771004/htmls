# 010 — 讓按讚貼紙直接出現

- **Status**: IMPLEMENTED — VISUAL QA PENDING
- **Commit**: 1f44f8b
- **Severity**: LOW
- **Category**: Physicality / easing & duration
- **Estimated scope**: 1 file, CSS and `setLike()`
- **Repository root**: `/Users/tommy/Documents/Proj/htmls`

## Problem

`app/042-polaroid-feed.html:105-106` scales the heart sticker from zero over 450ms. When the photo itself is liked, `setLike()` at `:499` waits another 720ms before adding `.liked`, so the primary state mark appears late.

```css
/* app/042-polaroid-feed.html:105-106 — current */
.pol .stick{position:absolute;right:-10px;bottom:52px;width:58px;height:58px;transform:rotate(14deg) scale(0);transition:transform .45s var(--spring);pointer-events:none}
.pol.liked .stick{transform:rotate(14deg) scale(1)}
```

```js
/* app/042-polaroid-feed.html:499 — current */
if (on && fromPhoto && !reduce){ pop(id); setTimeout(() => pol.classList.add('liked'), 720); } else pol.classList.toggle('liked', on);
```

## Target

Set the unliked sticker to `transform:rotate(14deg) scale(.95);opacity:0`, and liked to `transform:rotate(14deg) scale(1);opacity:1`. Transition `transform 160ms var(--out), opacity 160ms var(--out)`; `--out` is already `cubic-bezier(.2,.8,.2,1)` in this app. Add `.liked` immediately in both button and photo paths; the existing burst may play separately on a photo double-tap. On rapid unlike/re-like, the transition must retarget from the current visible state. Reduced motion should retain opacity feedback without scale travel.

## Repo conventions to follow

`app/042-polaroid-feed.html:19` defines local `--out` and `--spring`; `:264` has a component-specific reduced-motion block. Keep the photographic paper, sticker rotation, and burst illustration.

## Steps

1. Replace the sticker's zero-scale and 450ms transition with the exact target CSS.
2. Remove the 720ms delayed `.liked` update in `setLike()`; still call `pop(id)` for the photo path when normal motion is enabled.
3. In the reduced-motion block at `:264`, remove `.pol .stick` from the grouped `transition-duration:.01s!important` selector. Add `.pol .stick{transform:rotate(14deg) scale(1);transition:opacity 160ms var(--out)}` there, leaving the `.pol.liked .stick` opacity target intact.

## Boundaries

- Do not change like counts, persistence, sound, or the separate burst artwork.
- Do not rework the darkroom development animation; its long timing is thematic.
- If the cited code no longer matches commit `1f44f8b`, stop and report drift.

## Verification

- **Mechanical**: `rtk git diff --check -- app/042-polaroid-feed.html`; search for the removed `720` delay.
- **Feel check**: use the like button and photo double-tap, then toggle rapidly. At 10% playback, the sticker should never pass through a point-like size. Repeat with reduced motion.
- **Done when**: the saved like state is visible immediately and the sticker entry is subtle.
