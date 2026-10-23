# Findings

The reference image uses a 1640 x 2360 coordinate system. Text and canvas layout share that coordinate system. The barcode frame is anchored at x=1292, y=80, width=220, height=58 with a right edge of 1512; preserving its frame keeps the original outer bounds while the Code 128 modules vary with the name. The nickname uses a natural 132px bold face and scales down only when its measured width exceeds the available 760px.

Option labels are painted as complete slash-separated strings once. Marker x positions are measured from the same text prefixes, so the highlight selection stays aligned without splitting glyph drawing.

The provided attribution flag suppresses the low-contrast footer block when false. QR placeholders remain generic.
