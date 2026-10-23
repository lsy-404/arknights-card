import test from 'node:test';
import assert from 'node:assert/strict';
import { drawRichText } from '../web/rich-text-render.js';

function makeContext() {
  const calls = [];
  const stack = [];
  const ctx = {
    font: 'initial', fillStyle: 'initial', strokeStyle: 'initial', lineWidth: 3,
    textBaseline: 'top',
    save() { stack.push([this.font, this.fillStyle, this.strokeStyle, this.lineWidth, this.textBaseline]); calls.push(['save']); },
    restore() {
      [this.font, this.fillStyle, this.strokeStyle, this.lineWidth, this.textBaseline] = stack.pop();
      calls.push(['restore']);
    },
    beginPath() { calls.push(['beginPath']); },
    rect(...args) { calls.push(['rect', ...args]); },
    clip() { calls.push(['clip']); },
    measureText(text) { return { width: [...text].length * Number.parseFloat(this.font.match(/([\d.]+)px/)[1]) * 0.5 }; },
    fillText(...args) { calls.push(['fillText', ...args, this.font, this.fillStyle]); },
    moveTo(...args) { calls.push(['moveTo', ...args]); },
    lineTo(...args) { calls.push(['lineTo', ...args]); },
    stroke() { calls.push(['stroke']); },
  };
  return { ctx, calls };
}

test('drawRichText clips to its box, wraps runs, decorates formatted text and restores context', () => {
  const { ctx, calls } = makeContext();
  const result = drawRichText(ctx, [
    { text: 'AB', bold: true, underline: true, size: 28, color: '#ff0000' },
    { text: 'CD', strike: true, size: 40 },
  ], { x: 10, y: 20, width: 45, height: 120, fontSize: 28 });

  assert.equal(calls[0][0], 'save');
  assert.ok(calls.some(([name, ...args]) => name === 'rect' && args.join(',') === '10,20,45,120'));
  assert.ok(calls.some(([name]) => name === 'clip'));
  assert.ok(calls.some(([name, ...args]) => name === 'fillText' && args[0] === 'AB' && args.at(-1) === '#ff0000'));
  assert.ok(calls.filter(([name]) => name === 'stroke').length >= 2);
  assert.equal(result.height, 81.6);
  assert.equal(result.overflow, false);
  assert.equal(calls.at(-1)[0], 'restore');
  assert.equal(ctx.font, 'initial');
  assert.equal(ctx.fillStyle, 'initial');
  assert.equal(ctx.lineWidth, 3);
});

test('single-line text keeps run styles and reports clipping overflow', () => {
  const { ctx, calls } = makeContext();
  const result = drawRichText(ctx, [
    { text: 'A', color: '#aa0000', size: 28 },
    { text: 'B', bold: true, color: '#0000aa', size: 48 },
  ], { x: 0, y: 0, width: 20, height: 60, fontSize: 28, singleLine: true });

  assert.deepEqual(calls.filter(([name]) => name === 'fillText').map((call) => [call[1], call.at(-1)]), [
    ['A', '#aa0000'], ['B', '#0000aa'],
  ]);
  assert.equal(result.overflow, true);
});
