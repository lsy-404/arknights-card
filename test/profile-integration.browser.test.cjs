const { chromium } = require('playwright');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg' };
const server = http.createServer((request, response) => {
  const file = path.resolve(root, `.${decodeURIComponent(new URL(request.url, 'http://localhost').pathname)}`);
  if (!file.startsWith(root + path.sep)) return response.writeHead(403).end();
  fs.readFile(file, (error, bytes) => {
    if (error) return response.writeHead(404).end();
    response.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' });
    response.end(bytes);
  });
});

async function pngMetrics(page, png) {
  return page.evaluate(async (base64) => {
    const image = new Image();
    image.src = `data:image/png;base64,${base64}`;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(image, 0, 0);
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const box = (region, test) => {
      let left = region.x + region.width;
      let top = region.y + region.height;
      let right = -1;
      let bottom = -1;
      let count = 0;
      for (let y = region.y; y < region.y + region.height; y++) {
        for (let x = region.x; x < region.x + region.width; x++) {
          const i = (y * canvas.width + x) * 4;
          if (!test(pixels[i], pixels[i + 1], pixels[i + 2])) continue;
          left = Math.min(left, x); top = Math.min(top, y);
          right = Math.max(right, x); bottom = Math.max(bottom, y);
          count++;
        }
      }
      return count ? { x: left, y: top, width: right - left + 1, height: bottom - top + 1, count } : null;
    };
    const isDark = (r, g, b) => r < 128 && g < 128 && b < 128;
    const barcodeRegion = { x: 1150, y: 80, width: 380, height: 58 };
    const nicknameRegion = { x: 400, y: 347, width: 760, height: 120 };
    const barcodeBox = box(barcodeRegion, isDark);
    let barcodeBits = '';
    for (let y = barcodeRegion.y; y < barcodeRegion.y + barcodeRegion.height; y++) {
      for (let x = barcodeRegion.x; x < barcodeRegion.x + barcodeRegion.width; x++) {
        const i = (y * canvas.width + x) * 4;
        barcodeBits += isDark(pixels[i], pixels[i + 1], pixels[i + 2]) ? '1' : '0';
      }
    }
    let nicknameBits = '';
    for (let y = nicknameRegion.y; y < nicknameRegion.y + nicknameRegion.height; y++) {
      for (let x = nicknameRegion.x; x < nicknameRegion.x + nicknameRegion.width; x++) {
        const i = (y * canvas.width + x) * 4;
        nicknameBits += isDark(pixels[i], pixels[i + 1], pixels[i + 2]) ? '1' : '0';
      }
    }
    return {
      width: canvas.width,
      height: canvas.height,
      barcode: { box: barcodeBox, bits: barcodeBits },
      nickname: { box: box(nicknameRegion, isDark), bits: nicknameBits },
      doctorTitle: box({ x: 180, y: 300, width: 220, height: 150 }, isDark),
      qr: [
        box({ x: 570, y: 486, width: 200, height: 200 }, isDark),
        box({ x: 790, y: 486, width: 200, height: 200 }, isDark),
      ],
      portrait: { x: 1044, y: 438, width: 350, height: 350 },
      operatorImagePixels: box({ x: 742, y: 1210, width: 96, height: 92 }, (r, g, b) =>
        Math.max(r, g, b) - Math.min(r, g, b) > 18 || Math.abs(r - 238) > 12 || Math.abs(g - 238) > 12 || Math.abs(b - 238) > 12),
      emptyCode: box({ x: 1400, y: 194, width: 112, height: 44 }, isDark),
      choiceMarker: box({ x: 280, y: 770, width: 140, height: 65 }, (r, g, b) => b > r + 24 && g > r + 12 && b > 180),
      choiceText: box({ x: 380, y: 805, width: 48, height: 43 }, isDark),
    };
  }, png.toString('base64'));
}

async function exportPng(page) {
  const downloadReady = page.waitForEvent('download');
  await page.locator('#export-button').click();
  const download = await downloadReady;
  return fs.promises.readFile(await download.path());
}

(async () => {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 1400, height: 1000 }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    const errors = [];
    const failures = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/web/index.html`);
    await page.locator('#field-nickname .ql-editor').waitFor();
    await page.locator('#export-scale').selectOption('1');

    const nickname = page.locator('#field-nickname .ql-editor');
    const toolbarSize = page.locator('#toolbar-nickname [aria-label="字号"]');
    const boldButton = page.locator('#toolbar-nickname [aria-label="粗体"]');
    await nickname.click();
    const nicknameDefaultLabel = await toolbarSize.locator('option:checked').innerText();
    if (await toolbarSize.inputValue() !== '' || nicknameDefaultLabel !== '默认 · 132') {
      failures.push(`Unformatted nickname should expose the 132px default option: ${nicknameDefaultLabel}`);
    }
    await nickname.fill('Font Test');
    await nickname.press('Control+A');
    const regularNickname = await pngMetrics(page, await exportPng(page));
    await boldButton.click();
    const boldNickname = await pngMetrics(page, await exportPng(page));
    if (await boldButton.getAttribute('aria-pressed') !== 'true' || regularNickname.nickname.bits === boldNickname.nickname.bits) {
      failures.push('Toggling nickname bold on must visibly change the exported glyph pixels.');
    }
    await boldButton.click();
    const restoredWeight = await pngMetrics(page, await exportPng(page));
    if (await boldButton.getAttribute('aria-pressed') !== 'false' || regularNickname.nickname.bits !== restoredWeight.nickname.bits) {
      failures.push('Toggling nickname bold off must restore the original exported glyph pixels.');
    }
    await nickname.press('Control+A');
    await toolbarSize.selectOption('120px');
    const explicitSize = await toolbarSize.inputValue();
    const explicitSizePixels = await pngMetrics(page, await exportPng(page));
    if (explicitSize !== '120px' || regularNickname.nickname.bits === explicitSizePixels.nickname.bits) {
      failures.push(`Selecting 120px should change the selected nickname's exported glyph pixels: ${explicitSize}`);
    }
    await nickname.press('Control+A');
    await page.locator('#toolbar-nickname [aria-label="清除格式"]').click();
    await nickname.press('Control+A');
    const restoredDefaultLabel = await toolbarSize.locator('option:checked').innerText();
    if (await toolbarSize.inputValue() !== '' || restoredDefaultLabel !== '默认 · 132') {
      failures.push(`Clearing explicit nickname formatting should restore the 132px default option: ${restoredDefaultLabel}`);
    }
    const restoredSize = await pngMetrics(page, await exportPng(page));
    if (regularNickname.nickname.bits !== restoredSize.nickname.bits) {
      failures.push('Clearing explicit nickname size should restore the default-size Canvas pixels.');
    }
    await nickname.fill('Alpha');
    const alpha = await pngMetrics(page, await exportPng(page));
    await nickname.fill('Beta');
    const beta = await pngMetrics(page, await exportPng(page));
    await nickname.fill('阿米娅');
    const chinese = await pngMetrics(page, await exportPng(page));
    if (!alpha.barcode.box || !beta.barcode.box || !chinese.barcode.box ||
      alpha.barcode.bits === beta.barcode.bits || beta.barcode.bits === chinese.barcode.bits) {
      failures.push(`ASCII and Chinese nickname edits must change the exported barcode pattern: ${JSON.stringify({ alpha: alpha.barcode.box, beta: beta.barcode.box, chinese: chinese.barcode.box })}`);
    }
    for (const [name, metrics] of [['Alpha', alpha], ['Beta', beta], ['阿米娅', chinese]]) {
      const barcode = metrics.barcode.box;
      if (!barcode || barcode.width < 220 || barcode.width > 340 || barcode.x + barcode.width < 1507 || barcode.x + barcode.width > 1515) {
        failures.push(`Barcode for ${name} must naturally fit the 220–340px frame ending at the card's right edge: ${JSON.stringify(barcode)}`);
      }
    }
    if (!alpha.nickname.box || !beta.nickname.box || !alpha.doctorTitle ||
      alpha.nickname.box.height < 70 || alpha.nickname.box.height > 145 ||
      alpha.nickname.box.height < alpha.doctorTitle.height * 0.75 || alpha.nickname.bits === beta.nickname.bits) {
      failures.push(`Nickname heading was not rendered near the Doctor title scale or did not update: ${JSON.stringify({ nickname: alpha.nickname.box, doctor: alpha.doctorTitle, beta: beta.nickname.box })}`);
    }
    await nickname.fill('Alpha');

    const gender = page.locator('#choice-gender');
    const choiceControl = gender.locator('select, input, button').first();
    if (await choiceControl.count()) {
      if (await choiceControl.evaluate((element) => element.tagName === 'SELECT')) {
        await choiceControl.selectOption({ label: '女' });
      } else if (await choiceControl.evaluate((element) => element.type === 'radio' || element.type === 'checkbox')) {
        await gender.getByLabel('女').check();
      } else {
        await gender.getByText('女', { exact: true }).click();
      }
    } else {
      await gender.getByText('女', { exact: true }).click();
    }
    const markedExport = await pngMetrics(page, await exportPng(page));
    if (!markedExport.choiceMarker) {
      failures.push(`Selecting a normal gender form option did not render its highlighter in Canvas: ${JSON.stringify(markedExport.choiceMarker)}`);
    }

    const factions = await page.evaluate(async () => (await import('/web/data.js')).factions);
    for (const id of ['blacksteel', 'columbia']) {
      const expected = factions.find((faction) => faction.id === id);
      await page.locator('#faction-select').selectOption(id);
      await page.waitForFunction(({ quote, motto }) =>
        document.querySelector('#field-quote .ql-editor').innerText === quote &&
        document.querySelector('#field-motto .ql-editor').innerText === motto &&
        document.querySelector('#quote-default').value === quote,
      { quote: expected.quote, motto: expected.motto });
    }
    const emptyCodeMetrics = await pngMetrics(page, await exportPng(page));
    if (emptyCodeMetrics.emptyCode) failures.push(`Faction with empty code rendered fallback text: ${JSON.stringify(emptyCodeMetrics.emptyCode)}`);

    for (const faction of factions) {
      await page.locator('#faction-select').selectOption(faction.id);
      const factionText = await page.evaluate(() => ({
        quote: document.querySelector('#field-quote .ql-editor').innerText.replace(/\s+/g, ' ').trim(),
        motto: document.querySelector('#field-motto .ql-editor').innerText.replace(/\s+/g, ' ').trim(),
        fits: ['#field-motto', '#field-quote'].every((selector) => {
        const editor = document.querySelector(`${selector} .ql-editor`);
        return editor.scrollHeight <= editor.clientHeight;
        }),
      }));
      if (factionText.quote !== faction.quote.replace(/\s+/g, ' ').trim() ||
        factionText.motto !== faction.motto.replace(/\s+/g, ' ').trim()) {
        failures.push(`Faction text did not retain the full defaults: ${faction.id} ${JSON.stringify(factionText)}`);
      }
      if (!factionText.fits) failures.push(`Faction text is clipped in its editor: ${faction.id}`);
      const quoteDefaultSize = await page.evaluate(async (quote) => {
        const { quoteLayout } = await import('/web/layout.js');
        const { FONT } = await import('/web/typography.js');
        return quoteLayout(quote, document.createElement('canvas').getContext('2d'), FONT).fontSize;
      }, faction.quote);
      await page.locator('#field-quote .ql-editor').click();
      await page.locator('#field-quote .ql-editor').press('Control+A');
      const quoteSizeSelect = page.locator('#toolbar-quote [aria-label="字号"]');
      const selectedQuoteSize = await quoteSizeSelect.inputValue();
      const quoteDefaultLabel = await quoteSizeSelect.locator('option:checked').innerText();
      if (selectedQuoteSize !== '' || quoteDefaultLabel !== `默认 · ${quoteDefaultSize}`) {
        failures.push(`Dynamic quote default size did not update the toolbar for ${faction.id}: expected 默认 · ${quoteDefaultSize}, got ${quoteDefaultLabel}`);
      }
    }

    await page.locator('#operator-open').click();
    const operatorMore = page.locator('#operator-more');
    let catalogCount = await page.locator('#operator-results .operator-card').count();
    for (let pageIndex = 0; pageIndex < 10 && catalogCount < 434; pageIndex++) {
      await operatorMore.click();
      catalogCount = await page.locator('#operator-results .operator-card').count();
    }
    if (catalogCount !== 434) failures.push(`Operator catalog exposed ${catalogCount} cards instead of 434`);
    const search = page.locator('#operator-search');
    for (const term of ['克莱门莎', 'kelaimensha', 'klms', 'Clementia']) {
      await search.fill(term);
      const result = page.locator('#operator-results [data-operator="char_4231_clemnt"]');
      if (!await result.count()) failures.push(`Operator catalog search did not find Clementia for ${JSON.stringify(term)}`);
    }
    await search.fill('');
    await page.locator('#operator-results [data-operator="char_4231_clemnt"]').click();
    await page.locator('#selected-operators [data-remove="char_4231_clemnt"]').waitFor();
    await page.locator('#operator-close').click();
    await page.waitForFunction(() => performance.getEntriesByType('resource').some((entry) =>
      entry.name.endsWith('/assets/operators/char_4231_clemnt.png')));
    const operatorExport = await pngMetrics(page, await exportPng(page));
    if (!operatorExport.operatorImagePixels || operatorExport.operatorImagePixels.count < 1000) {
      failures.push(`Selected operator portrait was absent from export: ${JSON.stringify(operatorExport.operatorImagePixels)}`);
    }

    const fixture = fs.readFileSync(path.join(__dirname, 'fixtures', 'chat-screenshot.png'));
    const qrFile = { name: 'chat-screenshot.png', mimeType: 'image/png', buffer: fixture };
    const uploadQr = async (slot) => {
      await page.locator(`[data-qr-slot="${slot}"] .qr-file`).setInputFiles(qrFile);
      await page.waitForFunction((name) => {
        const text = document.querySelector(`[data-qr-slot="${name}"] .qr-status`).textContent;
        return text.includes('二维码') && !text.includes('正在');
      }, slot);
    };
    await uploadQr('qr1');
    await page.evaluate(async (base64) => {
      const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
      const transfer = new DataTransfer();
      transfer.items.add(new File([bytes], 'chat-screenshot.png', { type: 'image/png' }));
      const target = document.querySelector('[data-qr-slot="qr2"]');
      target.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: transfer }));
      target.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer }));
    }, fixture.toString('base64'));
    await page.waitForFunction(() => {
      const status = document.querySelector('[data-qr-slot="qr2"] .qr-status').textContent;
      return status.includes('二维码') || status.includes('无法');
    }, undefined, { timeout: 1500 }).catch(() => {});
    const dropStatus = await page.locator('[data-qr-slot="qr2"] .qr-status').innerText();
    if (!dropStatus.includes('二维码')) {
      failures.push(`Dropping an image on the second QR slot did not import it: ${JSON.stringify(dropStatus)}`);
    }
    const bothQr = await pngMetrics(page, await exportPng(page));
    if (bothQr.qr.some((box) => !box || box.count < 100) ||
      bothQr.qr.some((box, index) => box.x + box.width > bothQr.portrait.x)) {
      failures.push(`Both exported QR images must render to the left of the portrait: ${JSON.stringify({ qr: bothQr.qr, portrait: bothQr.portrait })}`);
    }
    await page.locator('#qr-count').selectOption('1');
    const oneQr = await pngMetrics(page, await exportPng(page));
    if (!oneQr.qr[0] || oneQr.qr[0].count < 100 || oneQr.qr[1]) {
      failures.push(`Setting qrCount to 1 must remove the second exported QR: ${JSON.stringify(oneQr.qr)}`);
    }
    await page.locator('#qr-count').selectOption('2');
    const restoredQr = await pngMetrics(page, await exportPng(page));
    if (!restoredQr.qr[0] || !restoredQr.qr[1]) {
      failures.push(`Returning qrCount to 2 must retain both QR slots: ${JSON.stringify(restoredQr.qr)}`);
    }
    if (errors.length) throw new Error(`Browser errors: ${errors.join('; ')}`);
    if (failures.length) throw new Error(failures.join('\n'));
    console.log('Profile integration browser tests passed');
  } finally {
    await browser.close();
    server.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
