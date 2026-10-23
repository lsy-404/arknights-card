import assert from 'node:assert/strict';
import { stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { factions, operators } from '../web/data.js';
import test from 'node:test';

const webRoot = new URL('../web/', import.meta.url);

async function assertLocalImage(path) {
  assert.match(path, /^\.\/assets\/游戏\/.+\.png$/);
  const file = fileURLToPath(new URL(path.slice(2), webRoot));
  const info = await stat(file);
  assert.ok(info.isFile() && info.size > 0, `${path} must exist and be non-empty`);
}

test('faction and operator image references resolve to local files', async () => {
  assert.ok(factions.length >= 25);
  assert.ok(factions.every(({ logo }) => logo));
  assert.ok(operators.length >= 8 && operators.length <= 16);
  assert.equal(new Set(factions.map(({ id }) => id)).size, factions.length);
  assert.equal(new Set(operators.map(({ id }) => id)).size, operators.length);

  await Promise.all([
    ...factions.filter(({ logo }) => logo).map(({ logo }) => assertLocalImage(logo)),
    ...operators.map(({ image }) => assertLocalImage(image)),
  ]);
});
