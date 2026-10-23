import test from 'node:test';
import assert from 'node:assert/strict';
import { createSliderControls, drawContain, drawProfile } from '../web/render.js';

test('renders seven continuously adjustable preference controls', () => {
  const container = { addEventListener(type, handler) { this.type = type; this.handler = handler; } };
  const items = createSliderControls(container, () => {});
  assert.equal(items.length, 7);
  assert.equal(container.type, 'input');
  assert.equal((container.innerHTML.match(/type="range"/g) || []).length, 7);
  assert.equal((container.innerHTML.match(/min="0" max="100" step="1"/g) || []).length, 7);
});

test('contains the complete QR image and restores canvas smoothing', () => {
  const draws = [];
  const context = { imageSmoothingEnabled: true, drawImage(...args) { draws.push(args); } };
  drawContain(context, { width: 300, height: 150 }, 10, 20, 140, 140);
  assert.deepEqual(draws[0].slice(1), [10, 55, 140, 70]);
  assert.equal(context.imageSmoothingEnabled, true);
});

test('draws the chosen faction accent, profile text, quote, and seven preference tracks', () => {
  const calls = [];
  const context = {
    save() {}, restore() {}, scale() {}, fillRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {}, closePath() {}, fill() {}, arc() {}, rect() {}, clip() {},
    fillText(value) { calls.push(String(value)); }, measureText(value) { return { width: String(value).length * 7 }; }
  };
  const canvas = { width: 900, height: 1280, getContext: () => context };
  drawProfile(canvas, {
    nickname: '测试博士', gender: '不公开', contacts: ['QQ'], server: '官服', seniority: '资深博士', focus: ['角色厨'],
    quote: '测试语录', sliders: Object.fromEntries(['spending', 'goods', 'story', 'tone', 'meta', 'shipping', 'roguelike'].map((key) => [key, 50]))
  }, { name: '罗德岛', en: 'RHODES ISLAND', code: 'RI-01', color: '#123456' });
  assert.ok(calls.includes('测试博士'));
  assert.ok(calls.includes('测试语录'));
  assert.ok(calls.includes('罗德岛'));
  assert.equal(calls.filter((value) => ['氪金倾向', '吃谷习惯', '剧情习惯', '剧情偏好', '培养取向', '关系偏好', '集成战略'].includes(value)).length, 7);
});
