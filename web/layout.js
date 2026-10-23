export const SHEET = Object.freeze({ width: 1640, height: 2360 });
export const LAYOUT = Object.freeze({
  barcode: { x: 1292, y: 80, width: 220, height: 58 },
  headerRule: { x1: 115, y: 158, x2: 1522, y: 158 },
  title: { x: 118, y: 200 },
  nickname: { x: 400, y: 347, width: 760, height: 120 },
  portrait: { x: 1044, y: 438, width: 350, height: 350 },
  qr: [{ x: 570, y: 486, width: 200, height: 200 }, { x: 790, y: 486, width: 200, height: 200 }],
  basics: { x: 118, y: 745, width: 764 },
  optionRows: [805, 858, 911, 964, 1017],
  optionStartX: 304,
  slider: { x: 118, y: 1219, width: 382, height: 838, row: 109 },
  oshi: { x: 735, y: 1187, width: 420, height: 56 },
  extra: { x: 735, y: 1650, width: 440, height: 180 },
  operators: { x: 740, y: 1000, width: 720, height: 270 },
  insignia: { x: 920, y: 1580, width: 575, height: 465 },
  footerRule: { x1: 120, y: 2138, x2: 1515, y: 2138 },
  signature: { x: 120, y: 2202, width: 720, height: 76 },
  bottomQuote: { x: 1085, y: 2180, width: 410, height: 130 },
});

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
