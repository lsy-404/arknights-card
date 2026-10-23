import { drawRichText } from "./rich-text-render.js";
import { factionMotto, LAYOUT, mottoFontSize, OPTIONS, SHEET, SLIDERS, quoteLayout } from "./layout.js";
import { drawMarker } from "./marker.js";

const FONT = 'Arial, "Microsoft YaHei", "Noto Sans SC", sans-serif';
const logoMasks = new WeakMap();

export function drawProfile(canvas, profile, faction, operators = [], images = {}, { editing = true } = {}) {
  const ctx = canvas.getContext("2d");
  const scale = canvas.width / SHEET.width;
  ctx.save();
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.clearRect(0, 0, SHEET.width, SHEET.height);
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, SHEET.width, SHEET.height);
  const accent = faction?.color || "#69bce3";
  const text = (value, x, y, size, color = "#171918", weight = 400, font = FONT) => {
    ctx.font = `${weight} ${size}px ${font}`;
    ctx.fillStyle = color;
    ctx.fillText(String(value ?? ""), x, y);
  };
  const line = (x1, y1, x2, y2, color = "#171918", width = 2) => {
    ctx.beginPath(); ctx.strokeStyle = color; ctx.lineWidth = width;
    ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  };
  ctx.fillStyle = accent;
  ctx.fillRect(118, 324, 22, 178);
  ctx.fillStyle = "#171918";
  ctx.fillRect(LAYOUT.title.x, LAYOUT.title.y, LAYOUT.title.width, LAYOUT.title.height);
  text("个人档案", 132, 227, 26, "#fff", 700);
  text("PERSONAL PROFILE", 118, 253, 22, "#171918", 700);
  text("档案编号 DATA NUMBER", 1374, 185, 14, "#929592", 400);
  if (faction?.code) {
    ctx.font = `400 53px "Arial Narrow", Arial, sans-serif`;
    ctx.fillStyle = "#171918";
    ctx.textAlign = "right";
    ctx.save();
    ctx.translate(1429, 0);
    ctx.scale(1.13, 1);
    ctx.translate(-1431, 0);
    ctx.fillText(faction.code, 1514, 228, 88);
    ctx.restore();
    ctx.textAlign = "left";
  }
  line(LAYOUT.headerRule.x1, LAYOUT.headerRule.y, LAYOUT.headerRule.x2, LAYOUT.headerRule.y, "#171918", 7);
  drawBarcode(ctx, profile.nickname, editing);
  ctx.save();
  ctx.font = `400 11px Arial, sans-serif`;
  ctx.fillStyle = "#555";
  ctx.textAlign = "right";
  ctx.fillText(`by ${profile.nickname || "Doctor"}`, 1512, 153, 220);
  ctx.restore();

  if (!editing) drawRichText(ctx, profile.richText?.nickname || [], { ...LAYOUT.nickname, fontSize: 80, color: "#171918", fontFamily: FONT, bold: true, singleLine: true });
  text("Dr.", 203, 428, 156, "#171918", 400, "Arial, sans-serif");
  text("Doctor", 195, 477, 42, "#171918", 700, "Arial, sans-serif");
  if (images.logo?.complete && images.logo.naturalWidth) drawContain(ctx, logoMask(images.logo, faction?.logoOnDark), 120, 516, 166, 142);
  if (!editing) drawRichText(ctx, profile.richText?.motto || [], { ...LAYOUT.motto, fontSize: mottoFontSize(profile.motto), color: "#171918", fontFamily: FONT, lineHeight: 1 });

  drawPortrait(ctx, images.avatar, editing);
  if (Number(profile.qrCount) >= 1) drawQr(ctx, images.qr1, LAYOUT.qr[0], profile.qrTypes?.[0] === "qq" ? "QQ" : "微信", editing);
  if (Number(profile.qrCount) >= 2) drawQr(ctx, images.qr2, LAYOUT.qr[1], profile.qrTypes?.[1] === "wechat" ? "微信" : "QQ", editing);
  drawCorners(ctx, Boolean(images.avatar));

  sectionTag(ctx, 120, 747, "基础信息");
  const basics = ["性　　别", "我　想　扩", "区　　服", "现 在 是", "更 侧 重"];
  basics.forEach((label, i) => text(label, 145, LAYOUT.optionRows[i] + 29, 37, "#171918", 700));
  for (let i = 0; i < 5; i++) text("▪", 122, LAYOUT.optionRows[i] + 29, 24, "#171918", 700);
  if (!editing) drawOptions(ctx, profile);

  sectionTag(ctx, 120, 1063, "详细资料");
  ctx.save();
  ctx.translate(133, 1129);
  ctx.scale(0.983, 1.2);
  ctx.translate(-132, -1129);
  text("About me◢", 132, 1129, 35, "#171918", 700);
  ctx.restore();
  text("我推的角色 /cp/cb", 735, 1174, 23, "#171918", 400);
  line(735, 1184, 1115, 1184, "#777", 1.5);
  if (!editing) drawRichText(ctx, profile.richText?.oshi || [], { ...LAYOUT.oshi, fontSize: 24, color: "#171918", fontFamily: FONT });

  SLIDERS.forEach((slider, i) => drawSlider(ctx, slider, i, profile.sliders?.[slider.key] ?? slider.value, (profile.sliderTouched || []).includes(slider.key)));
  drawSliderPlaceholders(ctx);

  const ops = operators.slice(0, 8);
  ops.forEach((op, i) => {
    const x = 742 + (i % 4) * 112;
    const y = 1210 + Math.floor(i / 4) * 112;
    const img = images.operators?.get(op.id);
    ctx.fillStyle = "#eee"; ctx.fillRect(x, y, 96, 92);
    if (img?.complete && img.naturalWidth) drawCover(ctx, img, x, y, 96, 92);
    text(String(op.name || "").slice(0, 8), x, y + 108, 15, "#252825", 500);
  });
  text("▪", LAYOUT.supplement.bulletX, LAYOUT.supplement.baseline, 22, "#171918", 700);
  text("补充", LAYOUT.supplement.labelX, LAYOUT.supplement.baseline, 28, "#171918", 400);
  line(LAYOUT.supplement.ruleX, LAYOUT.supplement.ruleY, LAYOUT.supplement.ruleX + LAYOUT.supplement.ruleWidth, LAYOUT.supplement.ruleY, "#171918", 2);
  if (!editing) drawRichText(ctx, profile.richText?.extra || [], { ...LAYOUT.extra, fontSize: 24, color: "#171918", fontFamily: FONT, lineHeight: 1.35 });
  if (images.logo?.complete && images.logo.naturalWidth) { ctx.save(); ctx.globalAlpha = 0.16; ctx.drawImage(logoMask(images.logo, faction?.logoOnDark), LAYOUT.insignia.x, LAYOUT.insignia.y, LAYOUT.insignia.width, LAYOUT.insignia.height); ctx.restore(); }
  text("游戏素材：鹰角网络 · PRTS", 1108, 2075, 13, "#888", 400);

  line(LAYOUT.footerRule.x1, LAYOUT.footerRule.y, LAYOUT.footerRule.x2, LAYOUT.footerRule.y, "#171918", 8);
  if (!editing) {
    ctx.save(); ctx.setLineDash([9, 8]); ctx.strokeStyle = "#777"; ctx.lineWidth = 2;
    ctx.strokeRect(LAYOUT.signature.x, LAYOUT.signature.y - 32, LAYOUT.signature.width, LAYOUT.signature.height);
    ctx.restore();
    text("原作 Sayoko.　暝行镌无创建表单化", 132, 2200, 20, "#555", 400);
    text("创建我自己的 → tiny.leisiyu.dev", 132, 2232, 20, "#555", 400);
  }
  const measureContext = typeof document === "undefined" ? null : document.createElement("canvas").getContext("2d");
  const quoteBox = quoteLayout(profile.quote, measureContext, FONT);
  if (!editing) drawRichText(ctx, profile.richText?.quote || [], { ...quoteBox, color: "#171918", fontFamily: FONT, lineHeight: 1.05 });
  drawHatching(ctx, 1095, Math.max(2197, quoteBox.y + quoteBox.height + 4), 400, 70);
  ctx.restore();
}

export function barcodeValue(nickname) {
  if (!nickname) return "DOCTOR";
  if (/^[\x20-\x7E]+$/.test(nickname)) return nickname;
  return [...new TextEncoder().encode(nickname)].map(byte => byte.toString(16).padStart(2, "0").toUpperCase()).join("");
}
function drawBarcode(ctx, nickname) {
  const x = LAYOUT.barcode.x, y = LAYOUT.barcode.y, w = LAYOUT.barcode.width, h = LAYOUT.barcode.height;
  const value = barcodeValue(nickname);
  try {
    if (!globalThis.JsBarcode) return;
    const barcode = document.createElement("canvas");
    globalThis.JsBarcode(barcode, value, { format: "CODE128", width: 2, height: h, displayValue: false, margin: 0, background: "#fff", lineColor: "#111" });
    ctx.fillStyle = "#fff"; ctx.fillRect(x, y, w, h);
    ctx.drawImage(barcode, x, y, w, h);
  } catch { }
}
function sectionTag(ctx, x, y, label, tagWidth = 220, lineWidth = 541) { ctx.fillStyle = "#171918"; ctx.beginPath(); ctx.roundRect(x, y, tagWidth, 34, 4); ctx.fill(); ctx.fillRect(x + tagWidth, y + 34, lineWidth, 2); ctx.font = `700 28px ${FONT}`; ctx.fillStyle = "#fff"; ctx.fillText(label, x + 13, y + 27); }
function drawCorners(ctx, hasPortrait) { ctx.save(); ctx.strokeStyle = "#171918"; ctx.lineWidth = 13; ctx.beginPath(); ctx.moveTo(1026.5, 522); ctx.lineTo(1026.5, 422.5); ctx.lineTo(1127, 422.5); ctx.moveTo(1307, 802); ctx.lineTo(1408, 802); ctx.lineTo(1408, 701); ctx.stroke(); if (!hasPortrait) { ctx.strokeStyle = "#e9e9e9"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(1032, 840); ctx.lineTo(1432, 431); ctx.stroke(); } ctx.restore(); }
function drawPortrait(ctx, image, editing) { const r = LAYOUT.portrait; if (image) drawCover(ctx, image, r.x, r.y, r.width, r.height); else if (editing) { ctx.fillStyle = "#eee"; ctx.fillRect(r.x, r.y, r.width, r.height); ctx.fillStyle = "#171918"; ctx.font = `700 70px ${FONT}`; ctx.textAlign = "center"; ctx.fillText("此处", r.x + r.width / 2, r.y + 136); ctx.fillText("头像", r.x + r.width / 2, r.y + 244); ctx.textAlign = "left"; } }
function drawQr(ctx, image, r, label, placeholder) { if (image) drawContain(ctx, image, r.x, r.y, r.width, r.height); else if (placeholder) { ctx.fillStyle = "#f4f4f4"; ctx.fillRect(r.x, r.y, r.width, r.height); ctx.fillStyle = "#a4a4a4"; ctx.font = `500 27px ${FONT}`; ctx.textAlign = "center"; ctx.fillText(`${label}二维码`, r.x + r.width / 2, r.y + r.height / 2); ctx.textAlign = "left"; } }
const TRACK_YS = [1220, 1352, 1477, 1631, 1768, 1915, 2057];
const TRACK_XS = [121, 122, 123, 123, 120, 117, 121];
const TRACK_X2S = [498, 500, 501, 501, 498, 495, 499];
function drawSlider(ctx, item, i, value, touched) { const x = TRACK_XS[i], x2 = TRACK_X2S[i], width = x2 - x, trackY = TRACK_YS[i]; ctx.font = `400 33px ${FONT}`; ctx.fillStyle = "#171918"; ctx.fillText(item.title, x, trackY - 38); ctx.fillStyle = "#222"; ctx.fillRect(x, trackY - 1, x2 - x + 1, 3); ctx.fillRect(x - 1, trackY - 14, 3, 16); ctx.fillRect(x2 - 1, trackY - 14, 3, 16); if (i === 0) { for (const fraction of [1 / 3, 2 / 3]) ctx.fillRect(Math.round(x + width * fraction) - 1, trackY - 13, 3, 15); } else ctx.fillRect(Math.round((x + x2) / 2) - 1, trackY - 13, 3, 15); if (touched) { const ratio = Math.max(0, Math.min(100, Number(value))) / 100; ctx.fillStyle = "#61b9e6"; ctx.beginPath(); ctx.arc(x + width * ratio, trackY, 11, 0, Math.PI * 2); ctx.fill(); } ctx.font = `400 23px ${FONT}`; ctx.fillStyle = "#555"; ctx.textAlign = "left"; ctx.fillText(item.left, x - 21, trackY + 42); ctx.textAlign = "right"; ctx.fillText(item.right, x2 + 20, trackY + 42); ctx.textAlign = "left"; }
function drawSliderPlaceholders(ctx) { SLIDERS.forEach((item, i) => { ctx.font = `400 23px ${FONT}`; ctx.fillStyle = "#555"; ctx.textAlign = "center"; if (i === 0) { ctx.fillText("微氪", TRACK_XS[i] + (TRACK_X2S[i] - TRACK_XS[i]) / 3, TRACK_YS[i] + 42); ctx.fillText("中氪", TRACK_XS[i] + 2 * (TRACK_X2S[i] - TRACK_XS[i]) / 3, TRACK_YS[i] + 42); } else if (item.mid) ctx.fillText(item.mid, (TRACK_XS[i] + TRACK_X2S[i]) / 2, TRACK_YS[i] + 42); ctx.textAlign = "left"; }); }
function drawOptions(ctx, profile) {
  const groups = { gender: OPTIONS.gender, contact: OPTIONS.contact, server: OPTIONS.server, seniority: OPTIONS.seniority, focus: OPTIONS.focus };
  const selected = { gender: profile.gender ? [profile.gender] : [], contact: profile.contacts || [], server: profile.server || [], seniority: profile.seniority || [], focus: profile.focus || [] };
  const geometry = { gender: 805, contact: 858, server: 911, seniority: 964, focus: 1017 };
  for (const [group, items] of Object.entries(groups)) {
    const y = geometry[group]; let x = LAYOUT.optionStartX;
    ctx.font = `700 ${group === "focus" ? 27 : 31}px ${FONT}`;
    items.forEach((value, index) => {
      const label = value + (index < items.length - 1 ? "/" : ""), width = Math.ceil(ctx.measureText(label).width) + 5;
      if (selected[group].includes(value)) drawMarker(ctx, x - 2, y + 2, width, 34, "#62c5ed", profile.markerSeeds?.[`${group}:${value}`] || 1);
      ctx.fillStyle = "#171918"; ctx.fillText(label, x, y + 31);
      x += width;
    });
  }
}
function drawHatching(ctx, x, y, width, height) { ctx.save(); ctx.strokeStyle = "#171918"; ctx.lineWidth = 2; for (let row = 0; row < 3; row++) { for (let col = 0; col < width - 20; col += 24) { const xx = x + col, yy = y + row * 25; ctx.beginPath(); ctx.moveTo(xx, yy + 12); ctx.lineTo(xx + 12, yy - 7); ctx.stroke(); } } ctx.restore(); }
function logoMask(image, onDark) { if (logoMasks.has(image)) return logoMasks.get(image); const source = document.createElement("canvas"); source.width = image.naturalWidth; source.height = image.naturalHeight; const context = source.getContext("2d"); context.drawImage(image, 0, 0); if (onDark) { const pixels = context.getImageData(0, 0, source.width, source.height); for (let i = 0; i < pixels.data.length; i += 4) pixels.data[i + 3] *= (pixels.data[i] + pixels.data[i + 1] + pixels.data[i + 2]) / 765; context.putImageData(pixels, 0, 0); } const pixels = context.getImageData(0, 0, source.width, source.height).data; let left = source.width, top = source.height, right = -1, bottom = -1; for (let y = 0; y < source.height; y++) for (let x = 0; x < source.width; x++) if (pixels[(y * source.width + x) * 4 + 3] > 0) { left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y); } const mask = document.createElement("canvas"); mask.width = right - left + 1; mask.height = bottom - top + 1; const cropped = mask.getContext("2d"); cropped.drawImage(source, left, top, mask.width, mask.height, 0, 0, mask.width, mask.height); cropped.globalCompositeOperation = "source-in"; cropped.fillStyle = "#171918"; cropped.fillRect(0, 0, mask.width, mask.height); logoMasks.set(image, mask); return mask; }
export function createSliderControls(container, onChange) { container.innerHTML = SLIDERS.map(item => `<input type="range" min="0" max="100" step="1" name="${item.key}" value="${item.value}" aria-label="${item.title}">`).join(""); container.addEventListener("input", onChange); return SLIDERS; }
export function drawCover(ctx, image, x, y, w, h) { const ratio = Math.max(w / image.width, h / image.height), dw = image.width * ratio, dh = image.height * ratio; ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip(); ctx.drawImage(image, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh); ctx.restore(); }
export function drawContain(ctx, image, x, y, w, h) { const ratio = Math.min(w / image.width, h / image.height), dw = image.width * ratio, dh = image.height * ratio; ctx.imageSmoothingEnabled = false; ctx.drawImage(image, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh); ctx.imageSmoothingEnabled = true; }
export function imageFromFile(file) { return new Promise((resolve, reject) => { const url = URL.createObjectURL(file), image = new Image(); image.onload = () => { URL.revokeObjectURL(url); resolve(image); }; image.onerror = () => { URL.revokeObjectURL(url); reject(new Error("图片无法读取，请选择有效的图片文件。")); }; image.src = url; }); }
