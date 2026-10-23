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
      const { createRichText, setupRichTextToolbar } = await import('/web/rich-text.js');
      const css = document.createElement('link');
      css.rel = 'stylesheet';
      css.href = '/web/rich-text.css';
      document.head.append(css);
      await new Promise((resolve) => { css.onload = resolve; });

      const toolbar = document.createElement('div');
      const firstNode = document.createElement('div');
      const secondNode = document.createElement('div');
      document.body.append(toolbar, firstNode, secondNode);
      setupRichTextToolbar(toolbar);
      const first = await createRichText(firstNode, { initialText: 'alpha', maxLength: 20 });
      const second = await createRichText(secondNode, { initialText: 'beta' });

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

      const editor1 = firstNode.querySelector('.ql-editor');
      await selectText(editor1, 0, 3);
      toolbar.querySelector('[aria-label="粗体"]').click();
      const boldRuns = first.getRuns();

      await selectText(editor1, 0, 3);
      const colorInput = toolbar.querySelector('[aria-label="文字颜色"]');
      colorInput.value = '#336699';
      colorInput.dispatchEvent(new Event('input', { bubbles: true }));
      const colorRuns = first.getRuns();

      await selectText(editor1, 0, 3);
      const sizeSelect = toolbar.querySelector('[aria-label="字号"]');
      sizeSelect.value = '64px';
      sizeSelect.dispatchEvent(new Event('change', { bubbles: true }));
      const sizeRuns = first.getRuns();

      await selectText(editor1, 0, 3);
      toolbar.querySelector('[aria-label="清除格式"]').click();
      const clearRuns = first.getRuns();

      const editor2 = secondNode.querySelector('.ql-editor');
      await selectText(editor2, 0, 2);
      toolbar.querySelector('[aria-label="下划线"]').click();
      const crossFieldRuns = second.getRuns();

      const pasted = document.createElement('div');
      pasted.id = 'rich-text-paste';
      const pasteEditor = await createRichText(pasted, { maxLength: 20 });
      document.body.append(pasted);

      return {
        boldRuns, colorRuns, sizeRuns, clearRuns, crossFieldRuns,
        injected: window.pastedScript === 1,
        getText: first.getText(),
      };
    });

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
    if (!result.colorRuns.some((run) => run.text === 'alp' && run.color === '#336699')) throw new Error(`Color selection was lost: ${JSON.stringify(result)}`);
    if (!result.sizeRuns.some((run) => run.text === 'alp' && run.size === 64)) throw new Error(`Size selection was lost: ${JSON.stringify(result)}`);
    if (result.clearRuns.some((run) => run.bold || run.underline || run.strike || run.size || run.color)) throw new Error(`Clear formatting failed: ${JSON.stringify(result)}`);
    if (!result.crossFieldRuns.some((run) => run.text === 'be' && run.underline)) throw new Error(`Toolbar did not target the second field: ${JSON.stringify(result)}`);
    if (pasteResult.injected || /javascript:|<script|<img|onerror/i.test(pasteResult.pastedHtml)) throw new Error(`Paste retained unsafe HTML: ${JSON.stringify(pasteResult)}`);
    if (!pasteResult.pastedText.includes('safe')) throw new Error(`Plain text was lost during paste: ${JSON.stringify(pasteResult)}`);
    if (result.getText !== 'alpha') throw new Error(`Text API mismatch: ${JSON.stringify(result)}`);
    if (errors.length) throw new Error(`Browser errors: ${errors.join('; ')}`);
    console.log('Rich text browser tests passed');
  } finally {
    await browser.close();
    server.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
