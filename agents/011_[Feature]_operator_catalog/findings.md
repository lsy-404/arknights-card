# Findings

The provided PRTS DOM snapshot contains 434 operator objects with `attributes`, `en`, `id`, `name`, `profession`, and `rarity`. The unique ID requested for output is the `data-char-id` attribute. The 434 source rows contain no duplicate character IDs, and required fields are populated. The source image URLs are not in this DOM file; inspect the adjacent image manifest before generating provenance.

- `pinyin-pro` 3.29.5 was available in the local npm cache and installed offline with `--no-save --package-lock=false`; only the generated `pinyin` and `initials` strings are committed.
- The combined PRTS avatar bundle contains 434 unique media URLs. After URL-decoding each `头像_<name>.png`, every basename exactly matches one metadata name, with no missing or duplicate match. The DOM snapshot itself has no image URLs; the complete mapping is documented in `web/ASSET-SOURCES.md` and the root work manifest `work/catalog/operators-image-manifest.json`.
