const { chromium } = require('playwright');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const mime = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' };
const server = http.createServer((request, response) => {
  const file = path.resolve(root, `.${decodeURIComponent(new URL(request.url, 'http://localhost').pathname)}`);
  if (!file.startsWith(root + path.sep)) return response.writeHead(403).end();
  fs.readFile(file, (error, bytes) => {
    if (error) return response.writeHead(404).end();
    response.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' });
    response.end(bytes);
  });
});

(async () => {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext();
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/web/index.html`);
    const result = await page.evaluate(async () => {
      const { createRichText } = await import('/web/rich-text.js');
      const css = document.createElement('link');
      css.rel = 'stylesheet';
      css.href = '/web/rich-text.css';
      document.head.append(css);
      await new Promise((resolve) => { css.onload = resolve; });
      await document.fonts.ready;

      const makeToolbar = (id) => {
        const element = document.createElement('div');
        element.id = id;
        document.body.append(element);
        return element;
      };
      const toolbar = makeToolbar('rich-text-test-toolbar');
      const secondToolbar = makeToolbar('rich-text-test-toolbar-second');
      const calibrationToolbar = makeToolbar('rich-text-test-toolbar-calibration');
      const oversizedToolbar = makeToolbar('rich-text-test-toolbar-oversized');
      const firstNode = document.createElement('div');
      const secondNode = document.createElement('div');
      document.body.append(firstNode, secondNode);
      const first = await createRichText(firstNode, { initialText: 'alpha', maxLength: 20, toolbar });
      const second = await createRichText(secondNode, { initialText: 'beta', toolbar: secondToolbar });
      const calibrationNode = document.createElement('div');
      calibrationNode.id = 'rich-text-calibration';
      calibrationNode.style.cssText = 'width:640px;height:240px;background:white';
      document.body.append(calibrationNode);
      const calibration = await createRichText(calibrationNode, {
        initialText: 'Ag中\nNy華', defaultSize: 28, maxLength: 100, toolbar: calibrationToolbar,
      });
      const oversizedNode = document.createElement('div');
      oversizedNode.id = 'rich-text-oversized';
      oversizedNode.style.cssText = 'width:640px;height:64px;background:white';
      document.body.append(oversizedNode);
      const oversized = await createRichText(oversizedNode, { initialText: 'Alpha', defaultSize: 28, toolbar: oversizedToolbar });
      const sizeSelect = toolbar.querySelector('[aria-label="字号"]');
      const colorInput = toolbar.querySelector('[aria-label="文字颜色"]');

      const selection = getSelection();
      const selectText = async (editor, start, end) => {
        editor.focus();
        const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
        const nodes = [];
        while (walker.nextNode()) nodes.push(walker.currentNode);
        const endpoint = (offset) => {
          let remaining = offset;
          for (const node of nodes) {
            if (remaining <= node.length) return [node, remaining];
            remaining -= node.length;
          }
          const last = nodes.at(-1);
          return [last, last.length];
        };
        const [startNode, startOffset] = endpoint(start);
        const [endNode, endOffset] = endpoint(end);
        const range = document.createRange();
        range.setStart(startNode, startOffset);
        range.setEnd(endNode, endOffset);
        selection.removeAllRanges();
        selection.addRange(range);
        document.dispatchEvent(new Event('selectionchange'));
        await new Promise((resolve) => requestAnimationFrame(resolve));
      };

      window.richTextTest = { toolbar, secondToolbar, calibrationToolbar, oversizedToolbar, firstNode, first, secondNode, second, calibrationNode, calibration, oversizedNode, oversized, selectText };
      sizeSelect.addEventListener('mousedown', (event) => { window.richTextTest.sizeMouseDownPrevented = event.defaultPrevented; });
      colorInput.addEventListener('mousedown', (event) => { window.richTextTest.colorMouseDownPrevented = event.defaultPrevented; });
      const pasted = document.createElement('div');
      pasted.id = 'rich-text-paste';
      const pasteEditor = await createRichText(pasted, { maxLength: 20 });
      document.body.append(pasted);

      return {
        injected: window.pastedScript === 1,
        getText: first.getText(),
      };
    });

    await page.evaluate(async () => {
      const refs = window.richTextTest;
      await refs.selectText(refs.firstNode.querySelector('.ql-editor'), 0, 3);
    });
    await page.locator('#rich-text-test-toolbar [aria-label="粗体"]').click();
    result.boldRuns = await page.evaluate(() => window.richTextTest.first.getRuns());
    const sizeSelect = page.locator('#rich-text-test-toolbar [aria-label="字号"]');
    await sizeSelect.selectOption('32px');
    result.sizeRuns = await page.evaluate(() => window.richTextTest.first.getRuns());
    result.selectedSize = await sizeSelect.inputValue();
    result.boldPressed = await page.locator('#rich-text-test-toolbar [aria-label="粗体"]').getAttribute('aria-pressed');
    result.sizeMouseDownPrevented = await page.evaluate(() => window.richTextTest.sizeMouseDownPrevented);

    await page.locator('#rich-text-test-toolbar [aria-label="文字颜色"]').click();
    await page.keyboard.press('Escape');
    result.colorRuns = await page.evaluate(() => {
      const input = window.richTextTest.toolbar.querySelector('[aria-label="文字颜色"]');
      input.value = '#336699';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      return {
        runs: window.richTextTest.first.getRuns(),
        value: input.value,
        selected: getSelection().toString(),
        mouseDownPrevented: window.richTextTest.colorMouseDownPrevented,
      };
    });
    await page.locator('#rich-text-test-toolbar [aria-label="下划线"]').click();
    await page.locator('#rich-text-test-toolbar [aria-label="删除线"]').click();
    result.formattedBeforeClear = await page.evaluate(() => window.richTextTest.first.getRuns());

    result.clearRuns = await page.evaluate(async () => {
      const refs = window.richTextTest;
      await refs.selectText(refs.firstNode.querySelector('.ql-editor'), 0, 3);
      refs.toolbar.querySelector('[aria-label="清除格式"]').click();
      return refs.first.getRuns();
    });
    result.crossFieldRuns = await page.evaluate(async () => {
      const refs = window.richTextTest;
      await refs.selectText(refs.secondNode.querySelector('.ql-editor'), 0, 2);
      refs.secondToolbar.querySelector('[aria-label="下划线"]').click();
      return {
        runs: refs.second.getRuns(),
        toolbar: {
          underline: refs.secondToolbar.querySelector('[aria-label="下划线"]').getAttribute('aria-pressed'),
          size: refs.secondToolbar.querySelector('[aria-label="字号"]').value,
          defaultSize: refs.secondToolbar.querySelector('[aria-label="字号"]').selectedOptions[0].textContent,
          color: refs.secondToolbar.querySelector('[aria-label="文字颜色"]').value,
        },
      };
    });

    result.pixelComparison = await page.evaluate(async () => {
      const refs = window.richTextTest;
      const { FONT } = await import('/web/typography.js');
      const editor = refs.calibrationNode.querySelector('.ql-editor');
      const toolbarSize = window.richTextTest.calibrationToolbar.querySelector('[aria-label="字号"]');
      const styleSelection = async (start, end, size) => {
        await refs.selectText(editor, start, end);
        toolbarSize.value = `${size}px`;
        toolbarSize.dispatchEvent(new Event('change', { bubbles: true }));
      };
      await styleSelection(0, 1, 64);
      await styleSelection(2, 3, 24);
      await styleSelection(4, 5, 40);
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const runs = refs.calibration.getRuns();
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 240;
      const context = canvas.getContext('2d');
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      const { drawRichText } = await import('/web/rich-text-render.js');
      drawRichText(context, runs, {
        x: 0, y: 0, width: canvas.width, height: canvas.height, fontSize: 28, fontFamily: FONT,
      });
      await refs.selectText(refs.oversizedNode.querySelector('.ql-editor'), 0, 5);
      const oversizedSize = refs.oversizedToolbar.querySelector('[aria-label="字号"]');
      oversizedSize.value = '200px';
      oversizedSize.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const oversizedRuns = refs.oversized.getRuns();
      const oversizedCanvas = document.createElement('canvas');
      oversizedCanvas.width = 640;
      oversizedCanvas.height = 64;
      const oversizedContext = oversizedCanvas.getContext('2d');
      oversizedContext.fillStyle = '#ffffff';
      oversizedContext.fillRect(0, 0, oversizedCanvas.width, oversizedCanvas.height);
      drawRichText(oversizedContext, oversizedRuns, {
        x: 0, y: 0, width: oversizedCanvas.width, height: oversizedCanvas.height, fontSize: 28, fontFamily: FONT,
      });
      document.activeElement.blur();
      getSelection().removeAllRanges();
      return { runs, canvas: canvas.toDataURL('image/png'), oversizedCanvas: oversizedCanvas.toDataURL('image/png') };
    });
    const editorPixels = await page.locator('#rich-text-calibration .ql-editor').screenshot();
    result.pixelComparison.dom = editorPixels.toString('base64');
    result.pixelComparison.oversizedDom = (await page.locator('#rich-text-oversized .ql-editor').screenshot()).toString('base64');
    result.pixelComparison.boxes = await page.evaluate(async ({ dom, canvas, domOversized, canvasOversized }) => {
      const pixels = async (source) => {
        const image = new Image();
        image.src = source.startsWith('data:') ? source : `data:image/png;base64,${source}`;
        await image.decode();
        const canvas = document.createElement('canvas');
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const context = canvas.getContext('2d');
        context.drawImage(image, 0, 0);
        const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
        const rows = [];
        for (let y = 0; y < canvas.height; y++) {
          let ink = false;
          for (let x = 0; x < canvas.width; x++) {
            const i = (y * canvas.width + x) * 4;
            if (data[i] < 225 && data[i + 1] < 225 && data[i + 2] < 225) { ink = true; break; }
          }
          rows.push(ink);
        }
        const boxes = [];
        for (let y = 0; y < rows.length;) {
          if (!rows[y]) { y++; continue; }
          const top = y;
          while (y + 1 < rows.length && rows[y + 1]) y++;
          boxes.push({ top, bottom: y });
          y++;
        }
        return boxes;
      };
      return {
        dom: await pixels(dom), canvas: await pixels(canvas),
        oversizedDom: await pixels(domOversized), oversizedCanvas: await pixels(canvasOversized),
      };
    }, {
      dom: result.pixelComparison.dom, canvas: result.pixelComparison.canvas,
      domOversized: result.pixelComparison.oversizedDom, canvasOversized: result.pixelComparison.oversizedCanvas,
    });
    delete result.pixelComparison.dom;
    delete result.pixelComparison.canvas;
    delete result.pixelComparison.oversizedDom;
    delete result.pixelComparison.oversizedCanvas;

    await page.evaluate(async () => navigator.clipboard.write([
      new ClipboardItem({
        'text/html': new Blob(['<p><b>safe</b><a href="javascript:alert(1)">link</a><script>window.pastedScript=1</script><img src=x onerror=alert(1)></p>'], { type: 'text/html' }),
        'text/plain': new Blob(['safe link'], { type: 'text/plain' }),
      }),
    ]));
    await page.locator('#rich-text-paste .ql-editor').focus();
    await page.keyboard.press('Control+V');
    await page.waitForTimeout(30);
    const pasteResult = await page.evaluate(() => ({
      pastedText: document.querySelector('#rich-text-paste .ql-editor').innerText,
      pastedHtml: document.querySelector('#rich-text-paste .ql-editor').innerHTML,
      injected: window.pastedScript === 1,
    }));

    if (!result.boldRuns.some((run) => run.text === 'alp' && run.bold)) throw new Error(`Bold selection was lost: ${JSON.stringify(result)}`);
    if (!result.colorRuns.runs.some((run) => run.text === 'alp' && run.color === '#336699')) throw new Error(`Color selection was lost: ${JSON.stringify(result)}`);
    if (!result.sizeRuns.some((run) => run.text === 'alp' && run.size === 32)) throw new Error(`Size selection was lost: ${JSON.stringify(result)}`);
    if (result.selectedSize !== '32px' || result.boldPressed !== 'true') throw new Error(`Toolbar state did not follow the active selection: ${JSON.stringify(result)}`);
    if (result.sizeMouseDownPrevented || result.colorRuns.mouseDownPrevented) throw new Error(`Native toolbar controls had their mousedown canceled: ${JSON.stringify(result)}`);
    if (!result.formattedBeforeClear.some((run) => run.text === 'alp' && run.bold && run.underline && run.strike && run.size === 32 && run.color === '#336699')) {
      throw new Error(`Formatting controls failed before the clear-format test: ${JSON.stringify(result.formattedBeforeClear)}`);
    }
    if (result.clearRuns.some((run) => run.bold || run.underline || run.strike || run.size || run.color)) throw new Error(`Clear formatting failed: ${JSON.stringify(result)}`);
    if (!result.crossFieldRuns.runs.some((run) => run.text === 'be' && run.underline)) throw new Error(`Toolbar did not target the second field: ${JSON.stringify(result)}`);
    if (result.crossFieldRuns.toolbar.underline !== 'true' || result.crossFieldRuns.toolbar.size !== '' || result.crossFieldRuns.toolbar.defaultSize !== '默认 · 28') throw new Error(`Toolbar state did not follow the second field: ${JSON.stringify(result.crossFieldRuns)}`);
    if (result.pixelComparison.boxes.dom.length !== 2 || result.pixelComparison.boxes.canvas.length !== 2) throw new Error(`Unexpected DOM/Canvas text pixel rows: ${JSON.stringify(result.pixelComparison)}`);
    const pixelErrors = result.pixelComparison.boxes.dom.flatMap((box, index) => [
      Math.abs(box.top - result.pixelComparison.boxes.canvas[index].top),
      Math.abs(box.bottom - result.pixelComparison.boxes.canvas[index].bottom),
    ]);
    const maxPixelError = Math.max(...pixelErrors);
    if (maxPixelError > 2) throw new Error(`DOM/Canvas glyph bounds differ by ${maxPixelError}px: ${JSON.stringify(result.pixelComparison)}`);
    if (!result.pixelComparison.boxes.oversizedDom.some((box) => box.bottom >= 50) ||
      !result.pixelComparison.boxes.oversizedCanvas.some((box) => box.bottom >= 50)) {
      throw new Error(`Oversized text disappeared instead of clipping at the editor edge: ${JSON.stringify(result.pixelComparison.boxes)}`);
    }
    if (pasteResult.injected || /javascript:|<script|<img|onerror/i.test(pasteResult.pastedHtml)) throw new Error(`Paste retained unsafe HTML: ${JSON.stringify(pasteResult)}`);
    if (!pasteResult.pastedText.includes('safe')) throw new Error(`Plain text was lost during paste: ${JSON.stringify(pasteResult)}`);
    if (result.getText !== 'alpha') throw new Error(`Text API mismatch: ${JSON.stringify(result)}`);
    if (errors.length) throw new Error(`Browser errors: ${errors.join('; ')}`);
    console.log(`Rich text browser tests passed; DOM/Canvas text bbox error ${maxPixelError}px`);
  } finally {
    await browser.close();
    server.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
