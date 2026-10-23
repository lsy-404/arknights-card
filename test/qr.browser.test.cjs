const { chromium } = require('playwright');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const server = http.createServer((req, res) => {
  const file = path.resolve(root, `.${decodeURIComponent(new URL(req.url, 'http://localhost').pathname)}`);
  if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  res.writeHead(200, { 'Content-Type': file.endsWith('.js') ? 'text/javascript' : 'text/html' });
  fs.createReadStream(file).pipe(res);
});

(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${server.address().port}/web/qr.js`);
    const screenshotData = `data:image/png;base64,${fs.readFileSync(path.join(__dirname, 'fixtures/chat-screenshot.png')).toString('base64')}`;
    const api = await page.evaluate(async screenshotData => {
      const mod = await import('/web/qr.js');
      const image = new Image(); image.src = screenshotData; await image.decode();
      const shot = document.createElement('canvas'); shot.width = image.naturalWidth; shot.height = image.naturalHeight;
      const ctx = shot.getContext('2d'); ctx.drawImage(image, 0, 0);
      const fileFrom = canvas => new Promise(resolve => canvas.toBlob(blob => resolve(new File([blob], 'chat-shot.png', { type: 'image/png' }))));
      const cropped = await mod.detectAndCrop(await fileFrom(shot));
      const decoded = globalThis.jsQR(cropped.canvas.getContext('2d').getImageData(0,0,cropped.canvas.width,cropped.canvas.height).data,cropped.canvas.width,cropped.canvas.height,{inversionAttempts:'attemptBoth'});
      const logoShot = document.createElement('canvas'); logoShot.width=360; logoShot.height=360;
      const qrOnly=document.createElement('canvas'); qrOnly.width=280; qrOnly.height=280; qrOnly.getContext('2d').drawImage(image,220,80,280,280,0,0,280,280);
      const logoCtx=logoShot.getContext('2d'); logoCtx.fillStyle='#fff'; logoCtx.fillRect(0,0,360,360); logoCtx.drawImage(qrOnly,40,40);
      logoCtx.fillStyle='#fff'; logoCtx.fillRect(160,160,40,40);
      const logoCrop=await mod.detectAndCrop(await fileFrom(logoShot));
      const logoDecoded=globalThis.jsQR(logoCrop.canvas.getContext('2d').getImageData(0,0,logoCrop.canvas.width,logoCrop.canvas.height).data,logoCrop.canvas.width,logoCrop.canvas.height,{inversionAttempts:'attemptBoth'});
      const blank = document.createElement('canvas'); blank.width=300; blank.height=180; blank.getContext('2d').fillRect(0,0,300,180);
      const failed = await mod.detectAndCrop(await fileFrom(blank));
      const edge = document.createElement('canvas'); edge.width=360; edge.height=360; edge.getContext('2d').fillStyle='#fff'; edge.getContext('2d').fillRect(0,0,360,360); edge.getContext('2d').drawImage(qrOnly,0,0);
      const nearEdge = await mod.detectAndCrop(await fileFrom(edge));
      document.body.innerHTML='<style>.qr-crop-stage{width:100%}.qr-crop-stage canvas{max-width:100%}</style><div></div>';
      const manualPromise = mod.openCropEditor(await fileFrom(shot));
      while (!document.querySelector('.qr-crop-box')) await new Promise(resolve => setTimeout(resolve, 10));
      const box = document.querySelector('.qr-crop-box');
      const start = box.getBoundingClientRect();
      box.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:1,clientX:start.x+50,clientY:start.y+50}));
      box.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,pointerId:1,clientX:start.x+70,clientY:start.y+60}));
      box.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerId:1}));
      document.querySelector('[data-confirm]').click();
      const manual = await manualPromise;
      const manualDecode = globalThis.jsQR(manual.canvas.getContext('2d').getImageData(0,0,manual.canvas.width,manual.canvas.height).data,manual.canvas.width,manual.canvas.height,{inversionAttempts:'attemptBoth'});
      return {detected:cropped.detected, decoded:decoded?.data, logoDecoded:logoDecoded?.data, failure:failed.detected, failureMessage:failed.message, edgeDetected:nearEdge.detected, manual:manual.ok, manualDecode:manualDecode?.data};
    }, screenshotData);
    if (!api.detected || api.decoded !== 'https://example.test/profile/arknights') throw new Error(`Screenshot auto crop failed: ${JSON.stringify(api)}`);
    if (api.logoDecoded !== 'https://example.test/profile/arknights') throw new Error(`Center-logo QR failed: ${JSON.stringify(api)}`);
    if (api.failure || !api.failureMessage.includes('未找到')) throw new Error(`No-QR feedback failed: ${JSON.stringify(api)}`);
    if (!api.edgeDetected) throw new Error(`QR near white image border failed: ${JSON.stringify(api)}`);
    if (!api.manual || api.manualDecode !== 'https://example.test/profile/arknights') throw new Error(`Manual crop failed: ${JSON.stringify(api)}`);
    console.log('QR browser behavior verified:', JSON.stringify(api));
  } finally { await browser.close(); server.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; server.close(); });
