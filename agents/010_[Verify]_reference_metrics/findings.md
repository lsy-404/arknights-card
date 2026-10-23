# Findings

## Source and method

- Read-only source: `set1-2.jpg`, 1640×2360 RGB.
- Text was isolated from grayscale crops and rendered with Pillow using the requested Windows font candidates. Candidate masks were translated within ±2 px and compared at several grayscale thresholds using Dice overlap. White text on black header bars was inverted within its crop.
- A high score supports a raster match, but low scores remain candidate comparisons only; Windows font files were not copied into the product.

## Font results

- `Doctor`, observed bbox `[198,447,331,476)`; Arial Bold 42 px scores 0.8048. CSS recommendation for the corresponding bold English line: `font-family: Arial, sans-serif; font-weight: 700; font-size: 42px` at the source's 1:1 canvas scale.
- `性　　别`, observed bbox `[146,801,289,834)`; Microsoft YaHei Bold 37 px scores 0.8685. The source lettering includes a visibly wide gap; preserve that spacing rather than applying regular unspaced text.
- `女/男/其他`, observed bbox `[386,806,538,836)`; Microsoft YaHei Bold 31 px scores 0.8097.
- `关于氪金：`, observed bbox `[120,1152,265,1182)`; Noto Sans SC variable weight 700 at 33 px scores 0.7842; Microsoft YaHei regular 33 px scores 0.7413. This does not justify shipping the locally installed font; use a system Chinese sans stack unless a licensed web font is separately selected.
- `基本信息`: Microsoft YaHei Bold 22 px scores 0.6308, close to Noto Sans SC weight 900 at 23 px (0.6399); font identity is not established.
- `个人档案`: best candidate Microsoft YaHei Bold 26 px scores 0.4449; not established.
- `Dr.`: no candidate fit the exact-size gate, so its observed source box is retained without a font claim. `B101`: the best candidate, Arial Bold 50 px, scores only 0.3932; this weak result does not establish the font identity.

## Geometry

- Barcode stripe bbox: `[1292,80,1513,139)`; the small `by Near` attribution is separately below at approximately `[1466,141,1513,145)`.
- Avatar corner-mark envelope: `[1020,416,1414,808)`. The heavy top-left horizontal segment projects to y=416..429 and the heavy bottom-right segment to y=794..807; the diagonal guide is light gray.
- Seven slider rails use the exact x/y ranges in `test/reference-metrics.json`. Additional horizontal rules at y=1063 and y=1094 belong to the nearby text/divider area, not the seven rails.
- The main-provided horizontal rules were retained in the JSON: top, basic divider, details divider, and footer.
