import { drawRichText } from "./rich-text-render.js";

export const SHEET = Object.freeze({ width: 1640, height: 2360 });
export const LAYOUT = Object.freeze({
  barcode: { x: 1292, y: 80, width: 220, height: 58 },
  headerRule: { x1: 115, y: 161.5, x2: 1526 },
  title: { x: 120, y: 201, width: 334, height: 32 },
  nickname: { x: 400, y: 347, width: 760, height: 120 },
  portrait: { x: 1044, y: 438, width: 350, height: 350 },
  qr: [{ x: 570, y: 486, width: 200, height: 200 }, { x: 790, y: 486, width: 200, height: 200 }],
  motto: { x: 293, y: 604, width: 270, height: 125 },
  basics: { x: 120, y: 747, width: 760 },
  optionRows: [805, 858, 911, 964, 1017],
  optionTextTopRows: [802, 855, 908, 961, 1014],
  optionStartX: 383,
  slider: { x: 117, y: 1220, width: 384, height: 837, row: 109 },
  oshi: { x: 735, y: 1187, width: 420, height: 56 },
  extra: { x: 740, y: 1697, width: 430, height: 180 },
  supplement: { bulletX: 712, labelX: 737, baseline: 1675, ruleX: 740, ruleY: 1682, ruleWidth: 237 },
  operators: { x: 740, y: 1000, width: 720, height: 270 },
  insignia: { x: 920, y: 1615, width: 585, height: 501 },
  footerRule: { x1: 123, y: 2143, x2: 1513 },
  signature: { x: 120, y: 2202, width: 720, height: 100 },
  bottomQuote: { x: 1120, y: 2149, width: 380, height: 48 },
});

export function quoteLayout(text, context, fontFamily = 'Arial, "Microsoft YaHei", "Noto Sans SC", sans-serif') {
  const value = String(text ?? "");
  const widthUnits = [...value].reduce((sum, character) => sum + (/[^\u0000-\u00ff]/u.test(character) ? 1 : /\s/.test(character) ? 0.25 : /[il.,'!]/i.test(character) ? 0.28 : 0.48), 0);
  const wide = [...value].length > 48 || widthUnits > 26;
  const area = { ...LAYOUT.bottomQuote, x: wide ? 860 : 1120, width: wide ? 640 : 380 };
  if (context) {
    for (const fontSize of [24, 22, 20, 18, 16, 14, 12, 10]) {
      const singleLine = !wide;
      const result = drawRichText(context, [{ text: value }], { x: 0, y: 0, width: area.width, height: 100, fontSize, fontFamily, lineHeight: 1.05, singleLine });
      if (!result.overflow && (wide || result.height <= 30)) {
        const height = Math.ceil(result.height);
        return { ...area, y: wide ? 2149 : 2160, height, fontSize };
      }
    }
  }
  for (const fontSize of [24, 22, 20, 18, 16, 14, 12, 10]) {
    const lines = Math.max(1, Math.ceil((widthUnits * fontSize) / area.width));
    const height = Math.ceil(lines * fontSize * 1.05);
    if (height <= 100) return { ...area, y: lines === 1 && !wide ? 2160 : 2149, height, fontSize };
  }
  return { ...area, y: 2149, height: 100, fontSize: 10 };
}

export function factionMotto(faction) {
  if (faction?.id === "rhodes-island" || faction?.id === "rhodes-elite") return "Bitter forces may\nhave wholesome results";
  return String(faction?.motto ?? "");
}

export function mottoFontSize(text) {
  const length = [...String(text ?? "")].length;
  if (length <= 45) return 23.7;
  if (length <= 75) return 20;
  if (length <= 105) return 18;
  return 16;
}

export const OPTIONS = Object.freeze({
  gender: ["女", "男", "其他"],
  contact: ["微信", "QQ", "游戏好友"],
  server: ["官", "B", "繁中", "日", "韩", "英"],
  seniority: ["小登", "中登", "老登", "究极老资历"],
  focus: ["游戏本身", "角色厨", "同人", "oc", "梦女", "其他"],
});
export const SLIDERS = [
  { key: "spending", title: "关于氪金：", left: "0氪", mid: "微氪", right: "重氪", value: 35 },
  { key: "goods", title: "关于吃谷：", left: "不太吃", mid: "理性吃", right: "为爱掏空钱包", value: 72 },
  { key: "story", title: "关于剧情：", left: "跳过党", mid: "挑感兴趣的看", right: "剧情党", value: 36 },
  { key: "tone", title: "剧情偏好：", left: "温馨日常", mid: "", right: "宏大悲壮", value: 18 },
  { key: "meta", title: "更偏向于：", left: "XP", mid: "", right: "强度", value: 0 },
  { key: "shipping", title: "吃更多的是：", left: "cb", mid: "", right: "cp", value: 40 },
  { key: "roguelike", title: "集成战略（肉鸽）：", left: "几乎不碰", mid: "为了奖励打", right: "深度沉迷", value: 50 },
];
