const { chromium } = require('playwright');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };
const server = http.createServer((request, response) => {
  const file = path.resolve(root, `.${decodeURIComponent(new URL(request.url, 'http://localhost').pathname)}`);
  if (!file.startsWith(root + path.sep)) return response.writeHead(403).end();
  fs.readFile(file, (error, bytes) => {
    if (error) return response.writeHead(404).end();
    response.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' });
    response.end(bytes);
  });
});

async function exportPng(page) {
  const ready = page.waitForEvent('download');
  await page.locator('#export-button').click();
  return fs.promises.readFile(await (await ready).path());
}

async function attributionPixels(page, bytes) {
  return page.evaluate(async (base64) => {
    const image = new Image();
    image.src = `data:image/png;base64,${base64}`;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.drawImage(image, 0, 0);
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    let faint = 0;
    let nonWhite = 0;
    for (let y = 2160; y < 2320; y++) for (let x = 100; x < 820; x++) {
      const i = (y * canvas.width + x) * 4;
      const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
      if (r < 250 || g < 250 || b < 250) nonWhite++;
      if (Math.max(r, g, b) - Math.min(r, g, b) < 12 && r >= 160 && r < 250) faint++;
    }
    return { faint, nonWhite };
  }, bytes.toString('base64'));
}

(async () => {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ acceptDownloads: true, viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/web/index.html`);
    await page.locator('#export-button').waitFor();

    const desktop = await page.evaluate(() => {
      const form = document.querySelector('[aria-label="档案编辑工具"]').getBoundingClientRect();
      const preview = document.querySelector('[aria-label="原尺寸档案画布"]').getBoundingClientRect();
      return { form: { left: form.left, right: form.right }, preview: { left: preview.left, right: preview.right } };
    });
    if (desktop.form.right > desktop.preview.left) throw new Error(`Desktop editor must place the form left of the preview: ${JSON.stringify(desktop)}`);
    if (await page.locator('.qr-type').count()) throw new Error('QR slots must not expose platform labels.');
    const credits = await page.locator('.credits').innerText();
    if (!credits.includes('Sayoko.') || !credits.includes('游戏素材')) throw new Error(`Original-work and game-asset credits must remain on the page: ${credits}`);

    const attribution = page.locator('#show-attribution');
    await attribution.check();
    const withAttribution = await attributionPixels(page, await exportPng(page));
    if (!withAttribution.faint) throw new Error(`Enabled attribution should render faint gray pixels at bottom-left: ${JSON.stringify(withAttribution)}`);
    await attribution.uncheck();
    const withoutAttribution = await attributionPixels(page, await exportPng(page));
    if (withoutAttribution.nonWhite) throw new Error(`Disabled attribution should leave its bottom-left area white: ${JSON.stringify(withoutAttribution)}`);

    await page.setViewportSize({ width: 375, height: 812 });
    const mobile = await page.evaluate(() => ({ viewport: innerWidth, page: document.documentElement.scrollWidth }));
    if (mobile.page > mobile.viewport) throw new Error(`Mobile editor must not overflow horizontally: ${JSON.stringify(mobile)}`);
    if (errors.length) throw new Error(`Browser errors: ${errors.join('; ')}`);
    console.log('Classic editor layout browser tests passed');
  } finally {
    await browser.close();
    server.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
