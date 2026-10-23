import { strict as assert } from "node:assert";
import { readFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { factions } from "../web/data.js";
import { operators } from "../web/operators.js";
import test from "node:test";

const webRoot = new URL("../web/", import.meta.url);

async function assertFactionLogo(path) {
  assert.match(path, /^\.\/assets\/游戏\/.+\.png$/);
  const file = fileURLToPath(new URL(path.slice(2), webRoot));
  const info = await stat(file);
  assert.ok(info.isFile() && info.size > 0, `${path} must exist and be non-empty`);
}

test("faction logos resolve to local files", async () => {
  assert.equal(factions.length, 25);
  assert.ok(factions.every(({ logo }) => logo));
  assert.equal(new Set(factions.map(({ id }) => id)).size, factions.length);
  await Promise.all(factions.map(({ logo }) => assertFactionLogo(logo)));
});

test("complete operator catalog uses unique character IDs and local asset paths", () => {
  assert.equal(operators.length, 434);
  assert.equal(new Set(operators.map(({ id }) => id)).size, operators.length);

  for (const operator of operators) {
    assert.match(operator.id, /^char_[a-z0-9_]+$/);
    assert.ok(operator.name);
    assert.ok(operator.en);
    assert.ok(Number.isInteger(operator.rarity) && operator.rarity >= 1 && operator.rarity <= 6);
    assert.ok(operator.profession);
    assert.ok(operator.pinyin);
    assert.ok(operator.initials);
    assert.equal(operator.image, `./assets/operators/${operator.id}.png`);
  }
});

test("every selectable operator has a local PNG portrait", async () => {
  for (const operator of operators) {
    const bytes = await readFile(new URL(operator.image.slice(2), webRoot));
    assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10], operator.name);
    assert.ok(bytes.readUInt32BE(16) >= 100 && bytes.readUInt32BE(20) >= 100, operator.name);
  }
});
