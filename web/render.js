import { drawRichText } from "./rich-text-render.js";
import { LAYOUT, OPTIONS, SHEET, SLIDERS } from "./layout.js";
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
  ctx.fillRect(118, 200, 340, 34);
  text("个人档案", 132, 227, 26, "#fff", 700);
  text("PERSONAL PROFILE", 118, 253, 22, "#171918", 700);
  text("档案编号 DATA NUMBER", 1374, 185, 14, "#929592", 400);
  text(faction?.code || "B101", 1423, 228, 48, "#171918", 400);
  line(...Object.values(LAYOUT.headerRule), "#171918", 7);
  drawBarcode(ctx, profile.nickname, editing);

  if (!editing) drawRichText(ctx, profile.richText?.nickname || [], { ...LAYOUT.nickname, fontSize: 80, color: "#171918", fontFamily: FONT, bold: true, singleLine: true });
  text("Dr.", 203, 428, 156, "#171918", 400, "Arial, sans-serif");
  text("Doctor", 200, 477, 39, "#171918", 700, "Arial, sans-serif");
  if (images.logo?.complete && images.logo.naturalWidth) drawContain(ctx, logoMask(images.logo, faction?.logoOnDark), 120, 516, 166, 142);
  else drawIslandMark(ctx, 120, 516, 166, 142, "#111");
  if (!editing) drawRichText(ctx, profile.richText?.motto || [], { x: 292, y: 600, width: 520, height: 64, fontSize: 26, color: "#171918", fontFamily: FONT, singleLine: true });

  drawPortrait(ctx, images.avatar, editing);
  drawQr(ctx, images.qr1, LAYOUT.qr[0], profile.qrTypes?.[0] === "qq" ? "QQ" : "微信", editing && Number(profile.qrCount) >= 1);
  drawQr(ctx, images.qr2, LAYOUT.qr[1], profile.qrTypes?.[1] === "wechat" ? "微信" : "QQ", editing && Number(profile.qrCount) >= 2);
  drawCorners(ctx, LAYOUT.portrait);

  sectionTag(ctx, 118, 747, "基础信息");
  const basics = ["性　　别", "我　想　扩　列", "区　　服", "现 在 是", "更 侧 重"];
  basics.forEach((label, i) => text(label, 145, LAYOUT.optionRows[i] + 14, 34, "#171918", 700));
  for (let i = 0; i < 5; i++) text("▪", 122, LAYOUT.optionRows[i] + 14, 24, "#171918", 700);
  if (!editing) drawOptions(ctx, profile);

  sectionTag(ctx, 118, 1063, "详细资料");
  text("About me◢", 132, 1124, 28, "#171918", 700);
  text("关于氪金：", 118, 1174, 29, "#171918", 400);
  text("我推的角色 /cp/cb", 735, 1174, 23, "#171918", 400);
  line(735, 1184, 1115, 1184, "#777", 1.5);
  if (!editing) drawRichText(ctx, profile.richText?.oshi || [], { ...LAYOUT.oshi, fontSize: 24, color: "#171918", fontFamily: FONT });

  SLIDERS.forEach((slider, i) => drawSlider(ctx, slider, i, profile.sliders?.[slider.key] ?? slider.value, (profile.sliderTouched || []).includes(slider.key)));
  if (editing) drawSliderPlaceholders(ctx);

  const ops = operators.slice(0, 8);
  ops.forEach((op, i) => {
    const x = 742 + (i % 4) * 112;
    const y = 1210 + Math.floor(i / 4) * 112;
    const img = images.operators?.get(op.id);
    ctx.fillStyle = "#eee"; ctx.fillRect(x, y, 96, 92);
    if (img?.complete && img.naturalWidth) drawCover(ctx, img, x, y, 96, 92);
    text(String(op.name || "").slice(0, 8), x, y + 108, 15, "#252825", 500);
  });
  sectionTag(ctx, 735, 1632, "补充", 220, 393);
  if (!editing) drawRichText(ctx, profile.richText?.extra || [], { ...LAYOUT.extra, fontSize: 24, color: "#171918", fontFamily: FONT, lineHeight: 1.35 });
  if (images.logo?.complete && images.logo.naturalWidth) { ctx.save(); ctx.globalAlpha = 0.16; drawContain(ctx, logoMask(images.logo, faction?.logoOnDark), LAYOUT.insignia.x, LAYOUT.insignia.y, LAYOUT.insignia.width, LAYOUT.insignia.height); ctx.restore(); }
  else { ctx.save(); ctx.globalAlpha = 0.16; drawIslandMark(ctx, LAYOUT.insignia.x, LAYOUT.insignia.y, LAYOUT.insignia.width, LAYOUT.insignia.height, "#171918"); ctx.restore(); }
  text("鹰角网络素材由其权利人所有", 1108, 2075, 13, "#888", 400);

  line(...Object.values(LAYOUT.footerRule), "#171918", 8);
  if (!editing) {
    ctx.save(); ctx.setLineDash([9, 8]); ctx.strokeStyle = "#777"; ctx.lineWidth = 2;
    ctx.strokeRect(LAYOUT.signature.x, LAYOUT.signature.y - 32, LAYOUT.signature.width, LAYOUT.signature.height);
    ctx.restore();
    text("原作 Sayoko.　暝行镌无创建表单化", 132, 2200, 20, "#555", 400);
    text("创建我自己的 → tiny.leisiyu.dev", 132, 2232, 20, "#555", 400);
  }
  if (!editing) drawRichText(ctx, profile.richText?.quote || [], { ...LAYOUT.bottomQuote, fontSize: 21, color: "#171918", fontFamily: FONT, lineHeight: 1.3 });
  drawHatching(ctx, 1095, 2230, 380, 70);
  ctx.restore();
}

function drawBarcode(ctx, nickname, editing) {
  const x = LAYOUT.barcode.x, y = LAYOUT.barcode.y, w = LAYOUT.barcode.width, h = LAYOUT.barcode.height;
  const value = nickname ? [...new TextEncoder().encode(nickname)].map(byte => byte.toString(16).padStart(2, "0").toUpperCase()).join("") : "DOCTOR";
  try {
    if (!globalThis.JsBarcode) return;
    const barcode = document.createElement("canvas");
    globalThis.JsBarcode(barcode, value, { format: "CODE128", width: 2, height: h, displayValue: false, margin: 0, background: "#fff", lineColor: "#111" });
    ctx.fillStyle = "#fff"; ctx.fillRect(x, y, w, h);
    ctx.drawImage(barcode, x, y, w, h);
  } catch { }
}
function sectionTag(ctx, x, y, label, tagWidth = 220, lineWidth = 540) { ctx.fillStyle = "#171918"; ctx.beginPath(); ctx.roundRect(x, y, tagWidth, 33, 4); ctx.fill(); ctx.fillRect(x + tagWidth, y + 33, lineWidth, 2); ctx.font = `700 28px ${FONT}`; ctx.fillStyle = "#fff"; ctx.fillText(label, x + 13, y + 27); }
function drawCorners(ctx, r) { ctx.save(); ctx.strokeStyle = "#171918"; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(r.x - 20, r.y + 95); ctx.lineTo(r.x - 20, r.y - 20); ctx.lineTo(r.x + 95, r.y - 20); ctx.moveTo(r.x + r.width - 95, r.y + r.height + 20); ctx.lineTo(r.x + r.width + 20, r.y + r.height + 20); ctx.lineTo(r.x + r.width + 20, r.y + r.height - 95); ctx.stroke(); ctx.restore(); }
function drawPortrait(ctx, image, editing) { const r = LAYOUT.portrait; if (image) drawCover(ctx, image, r.x, r.y, r.width, r.height); else if (editing) { ctx.fillStyle = "#eee"; ctx.fillRect(r.x, r.y, r.width, r.height); ctx.fillStyle = "#171918"; ctx.font = `700 70px ${FONT}`; ctx.textAlign = "center"; ctx.fillText("此处", r.x + r.width / 2, r.y + 136); ctx.fillText("头像", r.x + r.width / 2, r.y + 244); ctx.textAlign = "left"; } }
function drawQr(ctx, image, r, label, placeholder) { if (image) drawContain(ctx, image, r.x, r.y, r.width, r.height); else if (placeholder) { ctx.fillStyle = "#f4f4f4"; ctx.fillRect(r.x, r.y, r.width, r.height); ctx.fillStyle = "#a4a4a4"; ctx.font = `500 27px ${FONT}`; ctx.textAlign = "center"; ctx.fillText(`${label}二维码`, r.x + r.width / 2, r.y + r.height / 2); ctx.textAlign = "left"; } }
const TRACK_YS = [1220, 1352, 1477, 1631, 1768, 1915, 2057];
const TRACK_XS = [122, 123, 123, 120, 117, 121, 121];
function drawSlider(ctx, item, i, value, touched) { const x = TRACK_XS[i], width = 378, trackY = TRACK_YS[i]; ctx.font = `400 28px ${FONT}`; ctx.fillStyle = "#171918"; ctx.fillText(item.title, x, trackY - 48); ctx.strokeStyle = "#222"; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x, trackY); ctx.lineTo(x + width, trackY); ctx.moveTo(x, trackY); ctx.lineTo(x, trackY - 17); ctx.moveTo(x + width, trackY); ctx.lineTo(x + width, trackY - 17); ctx.moveTo(x + width / 2, trackY); ctx.lineTo(x + width / 2, trackY - 15); ctx.stroke(); if (touched) { const ratio = Math.max(0, Math.min(100, Number(value))) / 100; ctx.fillStyle = "#61b9e6"; ctx.beginPath(); ctx.arc(x + width * ratio, trackY, 11, 0, Math.PI * 2); ctx.fill(); } ctx.font = `400 23px ${FONT}`; ctx.fillStyle = "#555"; ctx.textAlign = "left"; ctx.fillText(item.left, x - 14, trackY + 42); ctx.textAlign = "right"; ctx.fillText(item.right, x + width + 10, trackY + 42); ctx.textAlign = "left"; }
function drawSliderPlaceholders(ctx) { SLIDERS.forEach((item, i) => { if (!item.mid) return; ctx.font = `400 23px ${FONT}`; ctx.fillStyle = "#555"; ctx.textAlign = "center"; ctx.fillText(item.mid, TRACK_XS[i] + 189, TRACK_YS[i] + 42); ctx.textAlign = "left"; }); }
function drawOptions(ctx, profile) {
  const groups = { gender: OPTIONS.gender, contact: OPTIONS.contact, server: OPTIONS.server, seniority: OPTIONS.seniority, focus: OPTIONS.focus };
  const selected = { gender: profile.gender ? [profile.gender] : [], contact: profile.contacts || [], server: profile.server || [], seniority: profile.seniority || [], focus: profile.focus || [] };
  const geometry = { gender: [304, 784, [83, 83, 108]], contact: [304, 838, [108, 83, 185]], server: [304, 891, [58, 54, 86, 54, 54, 54]], seniority: [304, 944, [82, 82, 82, 172]], focus: [304, 997, [173, 119, 83, 57, 83, 83]] };
  for (const [group, items] of Object.entries(groups)) {
    const [startX, y, widths] = geometry[group]; let x = startX;
    items.forEach((value, index) => {
      const width = widths[index];
      if (selected[group].includes(value)) drawMarker(ctx, x, y + 2, width - 4, 34, "#62c5ed", profile.markerSeeds?.[`${group}:${value}`] || 1);
      ctx.font = `700 ${group === "focus" ? 26 : 29}px ${FONT}`; ctx.fillStyle = "#171918"; ctx.fillText(value + (index < items.length - 1 ? "/" : ""), x + 4, y + 31);
      x += width;
    });
  }
}
function drawHatching(ctx, x, y, width, height) { ctx.save(); ctx.strokeStyle = "#171918"; ctx.lineWidth = 2; for (let row = 0; row < 4; row++) { for (let col = 0; col < width - 20; col += 28) { const xx = x + col, yy = y + row * 18; ctx.beginPath(); ctx.moveTo(xx, yy + 12); ctx.lineTo(xx + 12, yy - 7); ctx.stroke(); } } ctx.restore(); }
function logoMask(image, onDark) { if (logoMasks.has(image)) return logoMasks.get(image); const mask = document.createElement("canvas"); mask.width = image.naturalWidth; mask.height = image.naturalHeight; const context = mask.getContext("2d"); context.drawImage(image, 0, 0); if (onDark) { const pixels = context.getImageData(0, 0, mask.width, mask.height); for (let i = 0; i < pixels.data.length; i += 4) pixels.data[i + 3] *= (pixels.data[i] + pixels.data[i + 1] + pixels.data[i + 2]) / 765; context.putImageData(pixels, 0, 0); } context.globalCompositeOperation = "source-in"; context.fillStyle = "#171918"; context.fillRect(0, 0, mask.width, mask.height); logoMasks.set(image, mask); return mask; }
function drawIslandMark(ctx, x, y, width, height, color) { ctx.save(); ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(x + width / 2, y); ctx.lineTo(x + width, y + height); ctx.lineTo(x, y + height); ctx.closePath(); ctx.fill(); ctx.globalCompositeOperation = "destination-out"; ctx.fillRect(x + width * .42, y + height * .38, width * .16, height * .43); ctx.globalCompositeOperation = "source-over"; ctx.fillStyle = color === "#111" ? "#fff" : "#fff"; ctx.font = `700 ${Math.max(13, width * .09)}px ${FONT}`; ctx.textAlign = "center"; ctx.fillText("RHODES ISLAND", x + width / 2, y + height * .91); ctx.textAlign = "left"; ctx.restore(); }
export function createSliderControls(container, onChange) { container.innerHTML = SLIDERS.map(item => `<input type="range" min="0" max="100" step="1" name="${item.key}" value="${item.value}" aria-label="${item.title}">`).join(""); container.addEventListener("input", onChange); return SLIDERS; }
export function drawCover(ctx, image, x, y, w, h) { const ratio = Math.max(w / image.width, h / image.height), dw = image.width * ratio, dh = image.height * ratio; ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip(); ctx.drawImage(image, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh); ctx.restore(); }
export function drawContain(ctx, image, x, y, w, h) { const ratio = Math.min(w / image.width, h / image.height), dw = image.width * ratio, dh = image.height * ratio; ctx.imageSmoothingEnabled = false; ctx.drawImage(image, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh); ctx.imageSmoothingEnabled = true; }
export function imageFromFile(file) { return new Promise((resolve, reject) => { const url = URL.createObjectURL(file), image = new Image(); image.onload = () => { URL.revokeObjectURL(url); resolve(image); }; image.onerror = () => { URL.revokeObjectURL(url); reject(new Error("图片无法读取，请选择有效的图片文件。")); }; image.src = url; }); }
