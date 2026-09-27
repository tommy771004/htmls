# agent-office — portfolio entry 181

Open `/web/181-agent-office.html` through an HTTP server. Three.js and RoundedBoxGeometry are vendored locally; initial loading requires no external assets.

## Interaction

- WASD / arrow keys: camera-relative walking with desk and room boundaries.
- T near a colleague, click a 3D colleague, or choose a member: task conversation.
- Each simulated task advances through four stages over about 16 seconds. Multiple colleagues can work concurrently. Completed characters stand up and a report card appears.
- Issues: sample data initially; workspace settings can load public GitHub issues (first 30 combined issues/PR records, PRs excluded). Refresh failures retain the previous list. Assignment is local only.
- PRs: local, simulated draft records, never real pull requests.
- Voice: optional microphone level check; no recording or transmission.
- Screen: optional local browser capture preview; no transmission.

## Scope

This is an interactive frontend prototype for the static portfolio. It does not launch Claude Code, access a repository directory, execute shell commands, create branches, submit GitHub changes, or implement multiplayer voice. The configured repo path is display metadata. All task state is in memory and resets on reload.

A production runner would require a separate authenticated local service, explicit per-repository authorization, isolated agent worktrees, streamed process events and lifecycle management. No runner or privileged endpoint is included here.

## Verification — 2026-09-27

- Chrome at 1440×900, 768×1024 and 390×844: scene renders, five character labels, no horizontal overflow.
- WASD, proximity T, typing focus isolation, real touch D-pad, member drawer, concurrent tasks, command stages, completion report, conflict scenario and PR draft records passed.
- Real public GitHub fetch succeeded against microsoft/vscode. Controlled fixtures verified PR filtering, HTML escaping, and preservation after request failure.
- Blocked renderer module retained the fallback notice and functional member chat.
- Media disclosure dialogs verified; actual microphone permission/device input and screen picker were not exercised.
- Existing 3D HTML syntax/local-import check passed. New modules passed node syntax checks.
