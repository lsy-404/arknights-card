# Progress

- Merged main through `09a4d7f` by fast-forward in the isolated task worktree.
- Read existing profile browser integration and current web markup. No tests run, per instruction to await the new main integration.

- Fast-forwarded to integrated main `58721d33` after the classic form and rich-text CSS updates.
- Updated the browser checks for the live editor-panel/preview-panel structure, 1x export pixel coordinates, dynamically sized barcode, Chinese nickname barcode changes, slot-level QR drop, and attribution toggle.
- Rich-text pixel comparison now waits for `document.fonts.ready` and uses the shared `FONT` in Canvas; DOM/Canvas glyph row error is 1px.
- `npm test` passed: 11 unit tests plus QR, rich text, profile integration (25 factions / 434 operators), and classic editor layout browser tests.
