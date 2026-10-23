# Findings

The blank reference is 1640x2360. The sheet and export share this coordinate space; editor fields and QR hit targets receive integer coordinates from `web/layout.js` and the editor layer scales as a whole.

Measured output against source after final geometry adjustments:

- Top rule: source bbox (115,158)-(1525,164); output (115,158)-(1525,164).
- Footer rule: source (123,2139)-(1512,2146); output identical.
- Basic section tag: source and output (120,747)-(349,782).
- About me title: source and output (120,1088)-(329,1128) in the measured region.
- Faction motto text: source (295,607)-(545,646); output (295,607)-(545,646).
- Faction code B101: source (1427,190)-(1514,228); output (1427,190)-(1514,227), a one-pixel bottom difference.
- Upper portrait corner: source (1020,416)-(1125,439); output (1020,416)-(1126,439), one pixel wider on the right.
- Lower portrait corner: source and output (1307,785)-(1413,807).
- Basic divider and Doctor glyph differ by at most one pixel at their measured endpoints.

All 25 faction defaults were checked in a browser. The DOM editors had no scroll-height overflow, and `drawRichText` reported no clipped motto or quote. A simulated QR image drop on the second canvas slot produced the expected successful QR status without browser errors. Pixel bounds for the QR slots are sourced from LAYOUT.qr.
