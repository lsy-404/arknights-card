# Findings

- Existing integration test already covers all faction defaults, all 434 operators and search aliases, QR export/count, and selected operator export.
- Stale assumptions to remove: barcode bounds must be identical across names; choice DOM geometry must match an overlay button; QR drag/drop target is `#qr-hit-2`.
- Current checkout at the preparation point still has the old stacked controls, platform selects, and canvas hit buttons. Parent agents are changing those components; this test task does not alter product files.
- Layout selectors available at the preparation point are semantic sections `[aria-label="档案编辑工具"]` and `[aria-label="原尺寸档案画布"]`. New implementation may add explicit IDs, which should be preferred once integrated.
- Tests are intentionally not run until parent announces the new main integration.
