import test from "node:test";
import assert from "node:assert/strict";
import {
  createSliderControls,
  drawContain,
  drawProfile,
} from "../web/render.js";

test("renders seven continuously adjustable preference controls", () => {
  const container = {
    addEventListener(type, handler) {
      this.type = type;
      this.handler = handler;
    },
  };
  const items = createSliderControls(container, () => {});
  assert.equal(items.length, 7);
  assert.equal(container.type, "input");
  assert.equal((container.innerHTML.match(/type="range"/g) || []).length, 7);
  assert.equal(
    (container.innerHTML.match(/min="0" max="100" step="1"/g) || []).length,
    7,
  );
});

test("contains the complete QR image and restores canvas smoothing", () => {
  const draws = [];
  const context = {
    imageSmoothingEnabled: true,
    drawImage(...args) {
      draws.push(args);
    },
  };
  drawContain(context, { width: 300, height: 150 }, 10, 20, 140, 140);
  assert.deepEqual(draws[0].slice(1), [10, 55, 140, 70]);
  assert.equal(context.imageSmoothingEnabled, true);
});

test("draws the full-size sheet structure and all seven preference scales", () => {
  const calls = [];
  const context = {
    save() {},
    restore() {},
    scale() {},
    setTransform() {},
    clearRect() {},
    fillRect() {},
    beginPath() {},
    moveTo() {},
    lineTo() {},
    stroke() {},
    closePath() {},
    roundRect() {},
    fill() {},
    arc() {},
    rect() {},
    clip() {},
    fillText(value) {
      calls.push(String(value));
    },
    measureText(value) {
      return { width: String(value).length * 7 };
    },
  };
  const canvas = { width: 1640, height: 2360, getContext: () => context };
  drawProfile(
    canvas,
    {
      nickname: "测试博士",
      gender: "不公开",
      contacts: ["QQ"],
      server: "官服",
      seniority: "资深博士",
      focus: ["角色厨"],
      quote: "测试语录",
      sliders: Object.fromEntries(
        [
          "spending",
          "goods",
          "story",
          "tone",
          "meta",
          "shipping",
          "roguelike",
        ].map((key) => [key, 50]),
      ),
    },
    { name: "罗德岛", en: "RHODES ISLAND", code: "RI-01", color: "#123456" },
  );
  assert.ok(calls.includes("个人档案"));
  assert.ok(calls.includes("基础信息"));
  assert.ok(calls.includes("详细资料"));
  for (const title of [
        "关于氪金：",
        "关于吃谷：",
        "关于剧情：",
        "剧情偏好：",
        "更偏向于：",
        "吃更多的是：",
        "集成战略（肉鸽）：",
  ]) assert.ok(calls.includes(title), `missing scale label: ${title}`);
});
