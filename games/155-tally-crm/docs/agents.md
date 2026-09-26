## Common rules for every page subagent of 「劃記 TALLY CRM」 (#155)
Repo: /Users/tommy/Documents/Proj/htmls. Project: games/155-tally-crm/. Output: web/155-tally-crm.html (single file, zero external resources). UI copy in Traditional Chinese; your final report in Traditional Chinese.

Before coding:
1. Read games/155-tally-crm/docs/brief.md (product spec + design system; follow it exactly) and games/155-tally-crm/docs/foundation.md (the API you build on).
   THE VISUAL REFERENCE IS THE CONTACTS PAGE, which the user has approved after two rejected rounds. Before coding, run `node games/155-tally-crm/tools/check.mjs /contacts /contacts/c041 --wait 1400` and look at the screenshots, and read src/pages/contacts.js + src/styles/pages/contacts.css. Your page must look like the same product: header on the canvas, 4 stat cards, white rounded cards, pill tabs, pastel badges/avatars, 64px table rows, same spacing. "Dribbble concept" richness at medium density: visually rich, never a bare spreadsheet. Skim src/core/ui.js, store.js, forms.js and src/pages/kit.js + src/styles/components.css to reuse existing components and classes instead of re-inventing them.
2. Load the skill `anti-slop-design` with the Skill tool and apply it (no purple/glow, no hover lift, no pill chips around every label, no em dashes in copy, content visible by default, real centering, no dead controls). If your page has charts, also load `dataviz`.
3. Mobbin MCP is NOT connected in this session. Instead do a few WebSearch/WebFetch lookups (load via ToolSearch "select:WebSearch,WebFetch") of how real apps lay out your page (mobbin.com public pages, Attio, Folk, Pipedrive, Twenty, HubSpot, Linear for tasks). Take layout/interaction language only, never copy content. List 2-3 takeaways in your report.

Ownership (other agents are editing the same project in parallel):
- You may ONLY create/edit the files listed as yours below. Never edit src/core/*, src/styles/{tokens,base,components,shell}.css, build.mjs, tools/, other pages, or anything outside games/155-tally-crm/ (the repo also has unrelated uncommitted work in games/150-brick-rts — don't touch). Do not commit.
- If you need a helper that belongs in core, write it locally inside your own file and list it under 「建議移入 core」 in your report.
- Style only with tokens from tokens.css (no hard-coded colors). Scope your CSS under a page root class (e.g. `.pg-contacts`) so it cannot leak into other pages.

Build & verify loop:
- `node --check` your JS file, then `node games/155-tally-crm/build.mjs`, then `node games/155-tally-crm/tools/check.mjs <your routes>` (see foundation.md for --eval/--tag/--full/--scale). Screenshots land in games/155-tally-crm/shots/ at 1440×900 and 390×844, light and dark.
- Because others build in parallel, a failure caused by ANOTHER page's file (syntax error, exception in their code) is not yours: wait ~60s and re-run; never edit their file. `--dev` tests src/dev.html, where one broken file doesn't take down the rest.
- After each meaningful step open EVERY screenshot of your routes with the Read tool and review like a strict designer: 4px-grid spacing consistency, shared alignment lines (columns, baselines, card edges), clear hierarchy (one focal point per region), text contrast, true centering, nothing clipped or overflowing, mobile at 390 has no horizontal scroll and stays usable (tables → list rows, drawers full-screen). Fix and re-shoot until satisfied. Use `--scale 3` to zoom into details.
- Exercise every control with --eval scripts (click/drag/type/keyboard), assert the outcome in the script (throw on failure), and screenshot interaction states with --tag. No control may look clickable but do nothing.
- Data must be realistic and read from CRM.store (never hard-code records). Mutations go through store/actions so undo toasts, tallies and other pages stay consistent.

Final report (under ~50 lines, Traditional Chinese): what you built (features), routes, check.mjs summary, research takeaways, 建議移入 core, known gaps.
