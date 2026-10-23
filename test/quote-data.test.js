import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { factions } from "../web/data.js";
import test from "node:test";

test("all 25 factions have source-backed default motto and quote text", async () => {
  assert.equal(factions.length, 25);
  assert.equal(new Set(factions.map(({ id }) => id)).size, 25);
  assert.ok(
    factions.every(({ motto, quote }) => motto?.trim() && quote?.trim()),
  );
  assert.ok(
    factions.every(({ mottoSource, quoteSource }) => mottoSource && quoteSource),
  );

  const sources = await readFile(
    new URL("../web/QUOTE-SOURCES.md", import.meta.url),
    "utf8",
  );
  assert.ok(sources.includes("set1-2.jpg"));
  assert.ok(sources.includes("情报处理室"));
  assert.ok(sources.includes("杰西卡/语音记录"));
});
