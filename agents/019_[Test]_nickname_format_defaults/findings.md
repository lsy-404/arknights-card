# Findings

- Nickname defaults to 132px; the shared toolbar represents unformatted text with an empty value and a dynamic `默认 · 132` option label.
- Clearing explicit nickname formatting restores that default rather than adding an explicit size run.
- Dynamic quote sizes are surfaced through the toolbar's `默认 · <size>` label when the quote text selection has no explicit size formatting.
- Rich-text DOM and Canvas calibration uses the shared font and awaited font readiness; measured glyph row difference is 1px.
