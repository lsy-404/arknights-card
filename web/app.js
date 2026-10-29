import { factions } from "./data.js";
import { detectAndCrop, openCropEditor } from "./qr.js";
import { drawContain, drawCover, drawProfile, imageFromFile } from "./render.js";
import { createRichText } from "./rich-text.js";
import { onRichTextImageLoad } from "./rich-text-render.js";
import { factionMotto, mottoFontSize, OPTIONS, SHEET, SLIDERS, quoteLayout } from "./layout.js";
import { markerSeed } from "./marker.js";
import { operators } from "./operators.js";
import { clearState, loadState, saveState } from "./storage.js";
import { FONT } from "./typography.js";

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const canvas = $("#profile-canvas");
const factionSelect = $("#faction-select");
const avatarSlot = $("#avatar-slot");
const qrSlots = $$(".qr-slot");
const qrRuns = new WeakMap();
const qrStore = { qr1: null, qr2: null };
const images = { avatar: null, logo: null, qr1: null, qr2: null };
let avatarSource = null;
let faction = factions[0];
let currentQrSlot = null;
let avatarRun = 0;
let searchLimit = 60;
let searchQuery = "";
let saveTimer = 0;
let restoring = true;
const sliders = Object.fromEntries(SLIDERS.map(item => [item.key, item.value]));
const selection = { gender: "", contact: new Set(), server: new Set(), seniority: new Set(), focus: new Set() };
const markerSeeds = {};
for (const [group, values] of Object.entries(OPTIONS)) for (const value of values) markerSeeds[`${group}:${value}`] = markerSeed();
const plain = { nickname: "", motto: "", quote: "", oshi: "", extra: "" };
const richText = {};

const homeUrl = document.querySelector('meta[name="home-url"]')?.content;
if (homeUrl) { $("#home-link").href = homeUrl; $("#home-link").hidden = false; }
factionSelect.innerHTML = factions.map(item => `<option value="${esc(item.id)}">${esc(item.name)} · ${esc(item.en)}</option>`).join("");
onRichTextImageLoad(() => render());

for (const [key, label, placeholder, size, maxLength] of [
  ["motto", "#field-motto", "阵营格言", 19, 300],
  ["quote", "#field-quote", "阵营语录", 16, 300],
  ["oshi", "#field-oshi", "我的角色 / CP / CB", 24, 300],
  ["extra", "#field-extra", "补充说明", 24, 120],
]) {
  richText[key] = await createRichText($(label), { toolbar: $(`#toolbar-${key}`), initialText: "", placeholder, defaultSize: size, maxLength, onChange: (runs, text) => { plain[key] = text; if (key === "quote") updateQuoteSize(); if (key === "motto") updateMottoSize(); render(); } });
}
richText.oshi.addToolbarButton("插入干员", () => $("#operator-dialog").showModal());
$("#field-nickname").addEventListener("input", event => { plain.nickname = event.target.value; render(); });

function updateQuoteSize() {
  const rect = quoteLayout(plain.quote, document.createElement("canvas").getContext("2d"));
  richText.quote?.setDefaultSize(rect.fontSize);
}
function updateMottoSize() {
  richText.motto?.setDefaultSize(mottoFontSize(plain.motto));
}

function esc(value) { return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;"); }
function resetFactionTexts() {
  plain.quote = faction.quote || "";
  plain.motto = factionMotto(faction);
  richText.quote.setText(plain.quote);
  richText.motto.setText(plain.motto);
  updateQuoteSize();
  updateMottoSize();
  $("#quote-default").value = plain.quote;
}
function chooseFaction(id) {
  const next = factions.find(item => item.id === id);
  if (!next) return;
  faction = next;
  factionSelect.value = faction.id;
  document.documentElement.style.setProperty("--accent", faction.color || "#61b9e6");
  resetFactionTexts();
  images.logo = null;
  if (faction.logo) {
    const logo = new Image();
    logo.onload = () => { if (faction.id === id) { images.logo = logo; render(); } };
    logo.src = faction.logo;
  }
  render();
}
factionSelect.addEventListener("change", () => chooseFaction(factionSelect.value));

function readProfile() {
  return {
    ...plain,
    richText: Object.fromEntries(Object.entries(richText).map(([key, editor]) => [key, editor.getRuns()])),
    sliders: { ...sliders },
    markerSeeds,
    gender: selection.gender,
    contacts: [...selection.contact],
    server: [...selection.server],
    seniority: [...selection.seniority],
    focus: [...selection.focus],
    showAttribution: $("#show-attribution").checked,
  };
}

function makeChoices() {
  for (const [group, options] of Object.entries(OPTIONS)) {
    const host = $(`#choice-${group}`);
    let buttons = $(".choice-buttons", host);
    if (!buttons) { buttons = document.createElement("div"); buttons.className = "choice-buttons"; host.append(buttons); }
    buttons.replaceChildren(...options.map(value => {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.group = group;
      button.dataset.value = value;
      button.setAttribute("aria-pressed", String(isSelected(group, value)));
      button.textContent = value;
      return button;
    }));
  }
}
$("#profile-form").addEventListener("submit", event => event.preventDefault());
$("#profile-form").addEventListener("click", event => {
  const button = event.target.closest("button[data-group]");
  if (!button) return;
  const { group, value } = button.dataset;
  if (group === "gender") selection.gender = value;
  else if (selection[group].has(value)) selection[group].delete(value);
  else selection[group].add(value);
  markerSeeds[`${group}:${value}`] = markerSeed();
  render();
});
function isSelected(group, value) { return group === "gender" ? selection.gender === value : selection[group].has(value); }

function makeSliders() {
  const layer = $("#slider-layer");
  layer.replaceChildren(...SLIDERS.map(item => {
    const row = document.createElement("label");
    row.className = "slider-row";
    const title = document.createElement("span"); title.textContent = item.title;
    const control = document.createElement("span"); control.className = "slider-control";
    const input = document.createElement("input");
    input.type = "range"; input.min = "0"; input.max = "100"; input.step = "1";
    input.value = sliders[item.key]; input.setAttribute("aria-label", item.title); input.dataset.key = item.key;
    const endpoints = document.createElement("span"); endpoints.className = "slider-endpoints";
    for (const value of [item.left, ...item.mids, item.right]) { const label = document.createElement("span"); label.textContent = value; endpoints.append(label); }
    const output = document.createElement("output"); output.textContent = input.value;
    input.addEventListener("input", () => { sliders[item.key] = Number(input.value); output.textContent = input.value; render(); });
    control.append(input, endpoints); row.append(title, control, output);
    return row;
  }));
}

function render() {
  drawProfile(canvas, readProfile(), faction, images, { editing: false });
  for (const button of $$("button[data-group]")) button.setAttribute("aria-pressed", String(isSelected(button.dataset.group, button.dataset.value)));
  scheduleSave();
}

function buildState() {
  return {
    version: 1,
    faction: faction.id,
    nickname: plain.nickname,
    richText: Object.fromEntries(Object.entries(richText).map(([key, editor]) => [key, editor.getDelta()])),
    selection: { gender: selection.gender, contact: [...selection.contact], server: [...selection.server], seniority: [...selection.seniority], focus: [...selection.focus] },
    sliders: { ...sliders },
    markerSeeds: { ...markerSeeds },
    showAttribution: $("#show-attribution").checked,
    exportScale: $("#export-scale").value,
    avatar: avatarSource,
    qr: Object.fromEntries(Object.entries(qrStore).filter(([, entry]) => entry?.cropped)),
  };
}
function scheduleSave() {
  if (restoring) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flushSave, 400);
}
function flushSave() {
  clearTimeout(saveTimer);
  saveTimer = 0;
  return saveState(buildState()).catch(() => {});
}
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden" && saveTimer) flushSave(); });
$("#show-attribution").addEventListener("change", render);
$("#export-scale").addEventListener("change", scheduleSave);
$("#clear-saved").addEventListener("click", async () => {
  if (!confirm("清除浏览器中保存的全部填写内容与图片？此操作无法撤销。")) return;
  clearTimeout(saveTimer);
  await clearState().catch(() => {});
  location.reload();
});

function restoreSelections(saved) {
  selection.gender = saved.selection?.gender || "";
  for (const group of ["contact", "server", "seniority", "focus"]) selection[group] = new Set(saved.selection?.[group] || []);
  Object.assign(sliders, saved.sliders);
  Object.assign(markerSeeds, saved.markerSeeds);
  $("#show-attribution").checked = saved.showAttribution !== false;
  if (saved.exportScale) $("#export-scale").value = saved.exportScale;
  plain.nickname = saved.nickname || "";
  $("#field-nickname").value = plain.nickname;
}
function restoreTexts(saved) {
  for (const key of Object.keys(richText)) {
    if (!saved.richText?.[key]) continue;
    richText[key].setDelta(saved.richText[key]);
    plain[key] = richText[key].getText();
  }
  updateQuoteSize();
  updateMottoSize();
}
async function restoreImages(saved) {
  if (saved.avatar) await setAvatar(saved.avatar).catch(() => {});
  for (const slot of qrSlots) {
    const key = qrKey(slot), entry = saved.qr?.[key];
    if (!entry) continue;
    try {
      images[key] = await imageFromFile(entry.cropped);
      qrStore[key] = entry;
      $(".crop-link", slot).hidden = false;
      paintPreview(slot, images[key]);
    } catch { }
  }
}

function validImage(file, qr = false) {
  if (!file) return "没有选择文件。";
  if (!["image/png", "image/jpeg", "image/webp", ...(qr ? [] : ["image/gif"])].includes(file.type)) return "文件格式不支持，请选择 PNG、JPG 或 WebP 图片。";
  if (file.size > 20 * 1024 * 1024) return "图片超过 20 MB，请先缩小后再试。";
  return "";
}

function paintPreview(slot, image, cover = false) {
  const preview = $(".slot-preview", slot), context = preview.getContext("2d");
  context.fillStyle = "#eef0ec";
  context.fillRect(0, 0, preview.width, preview.height);
  if (image) (cover ? drawCover : drawContain)(context, image, 0, 0, preview.width, preview.height);
}
function setStatus(slot, message, error = false) { const status = $(".slot-status", slot); status.textContent = message; status.classList.toggle("error", error); }
function wireSlot(slot, { onFile, onClear }) {
  const input = $(".slot-file", slot);
  $(".upload-link", slot).addEventListener("click", () => input.click());
  input.addEventListener("change", () => { const file = input.files[0]; input.value = ""; if (file) onFile(file); });
  $(".clear-slot", slot).addEventListener("click", onClear);
  slot.addEventListener("dragover", event => { event.preventDefault(); slot.classList.add("drag-over"); });
  slot.addEventListener("dragleave", () => slot.classList.remove("drag-over"));
  slot.addEventListener("drop", event => { event.preventDefault(); slot.classList.remove("drag-over"); const file = [...event.dataTransfer.files].find(item => item.type.startsWith("image/")); if (file) onFile(file); });
}

async function setAvatar(file) {
  const run = ++avatarRun;
  const image = await imageFromFile(file);
  if (run !== avatarRun) return;
  images.avatar = image;
  avatarSource = file;
  paintPreview(avatarSlot, image, true);
  render();
}
wireSlot(avatarSlot, {
  async onFile(file) {
    const error = validImage(file);
    if (error) { setStatus(avatarSlot, error, true); return; }
    try { await setAvatar(file); setStatus(avatarSlot, ""); }
    catch (failure) { setStatus(avatarSlot, failure.message, true); }
  },
  onClear() { avatarRun++; images.avatar = null; avatarSource = null; paintPreview(avatarSlot, null); setStatus(avatarSlot, ""); render(); },
});

function qrKey(slot) { return slot.dataset.qrSlot; }
function commitQr(slot, cropped, source) {
  const key = qrKey(slot);
  images[key] = cropped;
  const entry = qrStore[key] = { source, cropped: null };
  cropped.toBlob(blob => { if (qrStore[key] === entry) { entry.cropped = blob; scheduleSave(); } }, "image/png");
  $(".crop-link", slot).hidden = false;
  paintPreview(slot, cropped);
  render();
}
async function handleQrFile(slot, file) {
  const error = validImage(file, true); if (error) { setStatus(slot, error, true); return; }
  const run = (qrRuns.get(slot) || 0) + 1; qrRuns.set(slot, run); setStatus(slot, "正在识别并裁切二维码…");
  const result = await detectAndCrop(file);
  if (qrRuns.get(slot) !== run) return;
  if (result.failed) { setStatus(slot, result.message, true); return; }
  commitQr(slot, result.canvas, file);
  setStatus(slot, result.message);
}
async function openManualCrop(slot) {
  const source = qrStore[qrKey(slot)]?.source;
  if (!source) return;
  const run = (qrRuns.get(slot) || 0) + 1; qrRuns.set(slot, run);
  try {
    const result = await openCropEditor(source, cropped => { if (qrRuns.get(slot) === run) { commitQr(slot, cropped, source); setStatus(slot, "已手动裁切。"); } });
    if (qrRuns.get(slot) !== run) return;
    if (result?.message) setStatus(slot, result.message); else if (result?.ok === false) setStatus(slot, "已取消手动裁切，当前二维码未变更。");
  } catch { if (qrRuns.get(slot) === run) setStatus(slot, "无法打开裁切，请重新选择图片。", true); }
}
for (const slot of qrSlots) {
  wireSlot(slot, {
    onFile: file => handleQrFile(slot, file),
    onClear() { qrRuns.set(slot, (qrRuns.get(slot) || 0) + 1); images[qrKey(slot)] = null; qrStore[qrKey(slot)] = null; $(".crop-link", slot).hidden = true; paintPreview(slot, null); setStatus(slot, ""); render(); },
  });
  $(".crop-link", slot).addEventListener("click", () => openManualCrop(slot));
  slot.addEventListener("pointerenter", () => currentQrSlot = slot); slot.addEventListener("focusin", () => currentQrSlot = slot); slot.addEventListener("pointerleave", () => { if (currentQrSlot === slot) currentQrSlot = null; });
}
document.addEventListener("paste", event => {
  if (!currentQrSlot) return;
  const item = [...(event.clipboardData?.items || [])].find(entry => entry.type.startsWith("image/"));
  if (item) { event.preventDefault(); const file = item.getAsFile(); if (file) handleQrFile(currentQrSlot, file); }
});

$("#operator-close").addEventListener("click", () => $("#operator-dialog").close());
$("#operator-search").addEventListener("input", event => { searchQuery = normalizeOperatorSearch(event.target.value); searchLimit = 60; renderOperatorResults(); });
$("#operator-more").addEventListener("click", () => { searchLimit += 60; renderOperatorResults(); });
function matchesOperator(op) {
  if (!searchQuery) return true;
  return [op.name, op.pinyin, op.initials, op.en].some(value => normalizeOperatorSearch(value).includes(searchQuery));
}
function normalizeOperatorSearch(value) { return String(value || "").toLocaleLowerCase().replace(/\s+/gu, ""); }
function renderOperatorResults() {
  const matches = operators.filter(matchesOperator), shown = matches.slice(0, searchLimit);
  $("#operator-results").innerHTML = shown.map(op => `<button class="operator-card" type="button" data-operator="${esc(op.id)}"><img src="${esc(op.image)}" loading="lazy" alt=""><span>${esc(op.name)}</span></button>`).join("");
  $("#operator-more").hidden = shown.length >= matches.length;
  for (const button of $$(".operator-card")) button.addEventListener("click", () => insertOperator(button.dataset.operator));
}
function loadImage(source) {
  return new Promise((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = reject; image.src = source; });
}
async function operatorBadge(op) {
  await document.fonts.ready;
  const icon = await loadImage(op.image);
  const badge = document.createElement("canvas"), ctx = badge.getContext("2d");
  badge.width = 192; badge.height = 224;
  ctx.fillStyle = "#eee"; ctx.fillRect(0, 0, 192, 184);
  drawCover(ctx, icon, 0, 0, 192, 184);
  let size = 30;
  const name = String(op.name || "");
  do { ctx.font = `500 ${size}px ${FONT}`; size -= 2; } while (size > 14 && ctx.measureText(name).width > 192);
  ctx.fillStyle = "#252825"; ctx.fillText(name, 0, 214);
  return badge.toDataURL("image/png");
}
async function insertOperator(id) {
  const op = operators.find(item => item.id === id);
  if (!op) return;
  try {
    richText.oshi.insertImage(await operatorBadge(op), 120);
    $("#operator-status").textContent = `已插入 ${op.name}`;
  } catch { $("#operator-status").textContent = `${op.name} 的头像加载失败，请重试。`; }
}

$("#export-button").addEventListener("click", async () => {
  await document.fonts.ready;
  const factor = Number($("#export-scale").value), output = document.createElement("canvas");
  output.width = SHEET.width * factor; output.height = SHEET.height * factor;
  drawProfile(output, readProfile(), faction, images, { editing: false });
  output.toBlob(blob => {
    if (!blob) { $("#export-status").textContent = "PNG 生成失败，请稍后重试。"; return; }
    const url = URL.createObjectURL(blob), anchor = document.createElement("a"); anchor.href = url; anchor.download = "doctor-profile.png"; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); $("#export-status").textContent = "已导出 PNG。";
  }, "image/png");
});
$("#restore-quote").addEventListener("click", () => { resetFactionTexts(); render(); });

await Promise.allSettled([document.fonts.load('400 28px Arimo'), document.fonts.load('700 31px "Noto Sans SC"')]);
await document.fonts.ready;
const saved = await loadState();
if (saved) restoreSelections(saved);
makeChoices(); makeSliders(); renderOperatorResults();
chooseFaction(saved && factions.some(item => item.id === saved.faction) ? saved.faction : faction.id);
if (saved) { restoreTexts(saved); await restoreImages(saved); }
restoring = false;
render();
