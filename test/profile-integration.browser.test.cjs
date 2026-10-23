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
    const barcodeRegion = { x: 1292, y: 80, width: 220, height: 58 };
    const barcodeBox = box(barcodeRegion, isDark);
    let barcodeBits = '';
    for (let y = barcodeRegion.y; y < barcodeRegion.y + barcodeRegion.height; y++) {
      for (let x = barcodeRegion.x; x < barcodeRegion.x + barcodeRegion.width; x++) {
        const i = (y * canvas.width + x) * 4;
        barcodeBits += isDark(pixels[i], pixels[i + 1], pixels[i + 2]) ? '1' : '0';
      }
    }
    return {
      width: canvas.width,
      height: canvas.height,
      barcode: { box: barcodeBox, bits: barcodeBits },
      qr: [
        box({ x: 570, y: 486, width: 200, height: 200 }, isDark),
        box({ x: 790, y: 486, width: 200, height: 200 }, isDark),
      ],
      portrait: { x: 1044, y: 438, width: 350, height: 350 },
      emptyCode: box({ x: 1400, y: 194, width: 112, height: 44 }, isDark),
      choiceMarker: box({ x: 280, y: 770, width: 140, height: 65 }, (r, g, b) => b > r + 24 && g > r + 12 && b > 180),
      choiceText: box({ x: 290, y: 780, width: 115, height: 60 }, isDark),
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
    await nickname.fill('Alpha');
    const alpha = await pngMetrics(page, await exportPng(page));
    await nickname.fill('Beta');
    const beta = await pngMetrics(page, await exportPng(page));
    if (!alpha.barcode.box || !beta.barcode.box || alpha.barcode.bits === beta.barcode.bits) {
      failures.push(`Nickname edit did not change the exported barcode pixels: Alpha=${JSON.stringify(alpha.barcode.box)}, Beta=${JSON.stringify(beta.barcode.box)}`);
    }
    if (JSON.stringify(alpha.barcode.box && { ...alpha.barcode.box, count: 0 }) !== JSON.stringify(beta.barcode.box && { ...beta.barcode.box, count: 0 })) {
      failures.push(`Barcode pixel bounds changed with nickname: ${JSON.stringify({ alpha: alpha.barcode.box, beta: beta.barcode.box })}`);
    }

    await page.locator('#choice-gender button[data-value="女"]').click();
    const genderButton = page.locator('#choice-gender button[data-value="女"]');
    const choiceGeometry = await page.evaluate(() => {
      const sheet = document.querySelector('#sheet').getBoundingClientRect();
      const button = document.querySelector('#choice-gender button[data-value="女"]').getBoundingClientRect();
      return {
        scale: 1640 / sheet.width,
        button: { x: (button.x - sheet.x) * 1640 / sheet.width, y: (button.y - sheet.y) * 1640 / sheet.width,
          width: button.width * 1640 / sheet.width, height: button.height * 1640 / sheet.width },
      };
    });
    const sheetShot = await page.locator('#sheet').screenshot();
    const markedExport = await pngMetrics(page, await exportPng(page));
    const domChoice = await page.evaluate(async (base64) => {
      const image = new Image();
      image.src = `data:image/png;base64,${base64}`;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = 1640; canvas.height = 2360;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      const bounds = (region, predicate) => {
        let left = region.x + region.width, top = region.y + region.height, right = -1, bottom = -1;
        for (let y = region.y; y < region.y + region.height; y++) for (let x = region.x; x < region.x + region.width; x++) {
          const i = (y * canvas.width + x) * 4;
          if (!predicate(data[i], data[i + 1], data[i + 2])) continue;
          left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y);
        }
        return right < 0 ? null : { x: left, y: top, width: right - left + 1, height: bottom - top + 1 };
      };
      const marker = (r, g, b) => b > r + 24 && g > r + 12 && b > 180;
      const dark = (r, g, b) => r < 128 && g < 128 && b < 128;
      return {
        marker: bounds({ x: 280, y: 770, width: 140, height: 65 }, marker),
        text: bounds({ x: 290, y: 780, width: 115, height: 60 }, dark),
      };
    }, sheetShot.toString('base64'));
    const close = (a, b, tolerance) => a && b && Math.abs(a - b) <= tolerance;
    for (const part of ['choiceMarker', 'choiceText']) {
      const dom = part === 'choiceMarker' ? domChoice.marker : domChoice.text;
      const output = markedExport[part];
      if (!dom || !output || !close(dom.x, output.x, 8) || !close(dom.y, output.y, 8) ||
        !close(dom.width, output.width, 10) || !close(dom.height, output.height, 8)) {
        failures.push(`Selected option DOM/export ${part} geometry diverged: ${JSON.stringify({ dom, output, choiceGeometry, button: await genderButton.boundingBox() })}`);
      }
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
    await uploadQr('qr2');
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
