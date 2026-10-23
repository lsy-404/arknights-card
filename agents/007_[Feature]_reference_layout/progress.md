# Progress

- Re-read the agent-mode instructions and project notes; preserved the repository's root `/test` convention and did not edit `agents/tasks.md`.
- Opened both supplied reference images at original resolution and calibrated the exported PNG against `set1-2.jpg`.
- Corrected the second basic-information label to “我 想 扩”, aligned rules, tags, motto, code, and portrait corners, and kept source irregularities in the slider positions.
- Updated the barcode caption to `by ${nickname || "Doctor"}` and retained the original barcode bounds. ASCII nicknames encode directly as Code 128; non-ASCII nicknames use UTF-8 hex bytes.
- Bound canvas QR hit targets to the same absolute QR rectangles, with click, drag/drop, and keyboard-focus paste targeting the matching slot.
- Removed stale percentage geometry for rich fields, added a global hidden-state rule, and removed the extra English masthead label.
- Ran `npm run test:unit`: 11 tests passed. Ran the QR browser suite: automatic and manual crop scenarios passed. Iterated all 25 factions in Playwright with no clipping. Simulated a QR drop onto the second canvas slot; it was recognized with no page errors.
- `test/profile-integration.browser.test.cjs` was also run. Its only failure was the selected-option text measurement ROI including the horizontal divider; the rich-text test owner is correcting that assertion. Parent root will rerun the integration suite.
- 2026-10-23 follow-up: trimmed transparent bounds from official faction marks before drawing, set the full-size watermark frame, matched the isolated About me glyph bbox, constrained the dynamic byline width, and simplified the materials credit. Exported a fresh PNG and checked logo frames and glyph bounds.
