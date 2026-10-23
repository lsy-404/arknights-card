import { factions } from "./data.js";
import { detectAndCrop, openCropEditor } from "./qr.js";
import { drawProfile, imageFromFile } from "./render.js";
import { createRichText, setupRichTextToolbar } from "./rich-text.js";
import { factionMotto, mottoFontSize, OPTIONS, SHEET, SLIDERS, quoteLayout } from "./layout.js";
import { markerSeed } from "./marker.js";
import { operators } from "./operators.js";

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const canvas = $("#profile-canvas");
const factionSelect = $("#faction-select");
const qrRuns = new WeakMap();
const qrFiles = new WeakMap();
const operatorImages = new Map();
const images = { avatar: null, logo: null, qr1: null, qr2: null, operators: operatorImages };
let faction = factions[0];
let currentQrSlot = null;
let avatarRun = 0;
let searchLimit = 60;
let searchQuery = "";
const selectedOperators = new Set();
const sliders = Object.fromEntries(SLIDERS.map(item => [item.key, item.value]));
const sliderTouched = new Set();
const selection = { gender: "", contact: new Set(), server: new Set(), seniority: new Set(), focus: new Set() };
const markerSeeds = {};
for (const [group, values] of Object.entries(selection)) {
  for (const value of group === "gender" ? [values] : values) markerSeeds[`${group}:${value}`] = markerSeed();
}
const plain = { nickname: "", motto: "", quote: "", oshi: "", extra: "" };
const richText = {};

const homeUrl = document.querySelector('meta[name="home-url"]')?.content;
if (homeUrl) { $("#home-link").href = homeUrl; $("#home-link").hidden = false; }
factionSelect.innerHTML = factions.map(item => `<option value="${esc(item.id)}">${esc(item.name)} · ${esc(item.en)}</option>`).join("");
setupRichTextToolbar($("#richtext-toolbar"));

for (const [key, label, initialText, placeholder, size, maxLength] of [
  ["nickname", "#field-nickname", plain.nickname, "此处填写名字", 132, 24],
  ["motto", "#field-motto", "", "阵营格言", 19, 300],
  ["quote", "#field-quote", "", "阵营语录", 16, 300],
  ["oshi", "#field-oshi", "", "我的角色 / CP / CB", 24, 60],
  ["extra", "#field-extra", "", "补充说明", 24, 120],
]) {
  richText[key] = await createRichText($(label), { initialText, placeholder, defaultSize: size, maxLength, onChange: (runs, text) => { plain[key] = text; if (key === "quote") updateQuoteSize(); if (key === "motto") updateMottoSize(); render(); } });
}

function updateQuoteSize() {
  const editor = $("#field-quote .rich-text-editor");
  const rect = quoteLayout(plain.quote, document.createElement("canvas").getContext("2d"));
  if (editor) {
    editor.style.setProperty("--rich-text-default-size", `${rect.fontSize}px`);
    editor.querySelector(".ql-editor").style.lineHeight = "1.05";
  }
}
function updateMottoSize() {
  const editor = $("#field-motto .rich-text-editor");
  if (editor) {
    editor.style.setProperty("--rich-text-default-size", `${mottoFontSize(plain.motto)}px`);
    $(".ql-editor", editor).style.lineHeight = "1";
  }
}

function esc(value) { return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;"); }
function chooseFaction(id) {
  const next = factions.find(item => item.id === id);
  if (!next) return;
  faction = next;
  factionSelect.value = faction.id;
  document.documentElement.style.setProperty("--accent", faction.color || "#61b9e6");
  plain.quote = faction.quote || "";
  plain.motto = factionMotto(faction);
  richText.quote.setText(plain.quote);
  richText.motto.setText(plain.motto);
  updateQuoteSize();
  updateMottoSize();
  $("#quote-default").value = plain.quote;
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
    sliderTouched: [...sliderTouched],
    markerSeeds,
    gender: selection.gender,
    contacts: [...selection.contact],
    server: [...selection.server],
    seniority: [...selection.seniority],
    focus: [...selection.focus],
    qrCount: $("#qr-count").value,
    showAttribution: $("#show-attribution").checked,
    selections: { gender: selection.gender, contact: [...selection.contact], server: [...selection.server], seniority: [...selection.seniority], focus: [...selection.focus] },
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
    for (const value of [item.left, item.mid, item.right]) { const label = document.createElement("span"); label.textContent = value; endpoints.append(label); }
    const output = document.createElement("output"); output.textContent = input.value;
    input.addEventListener("input", () => { sliders[item.key] = Number(input.value); sliderTouched.add(item.key); output.textContent = input.value; render(); });
    control.append(input, endpoints); row.append(title, control, output);
    return row;
  }));
}

function render() {
  const ops = operators.filter(item => selectedOperators.has(item.id));
  drawProfile(canvas, readProfile(), faction, ops, images, { editing: false });
  for (const button of $$("button[data-group]")) button.setAttribute("aria-pressed", String(isSelected(button.dataset.group, button.dataset.value)));
  renderSelectedOperators();
}


function validImage(file, qr = false) {
  if (!file) return "没有选择文件。";
  if (!["image/png", "image/jpeg", "image/webp", ...(qr ? [] : ["image/gif"])].includes(file.type)) return "文件格式不支持，请选择 PNG、JPG 或 WebP 图片。";
  if (file.size > 20 * 1024 * 1024) return "图片超过 20 MB，请先缩小后再试。";
  return "";
}
$("#avatar-file").addEventListener("change", async event => {
  const file = event.target.files[0]; event.target.value = "";
  const error = validImage(file); if (error) { $("#export-status").textContent = error; return; }
  const run = ++avatarRun;
  try { const image = await imageFromFile(file); if (run !== avatarRun) return; images.avatar = image; render(); }
  catch (error) { $("#export-status").textContent = error.message; }
});
$("#remove-avatar").addEventListener("click", () => { avatarRun++; images.avatar = null; render(); });
$("#qr-count").addEventListener("change", () => { $$('.qr-slot')[1].hidden = $("#qr-count").value !== "2"; render(); });
$("#show-attribution").addEventListener("change", render);

function qrKey(slot) { return slot.dataset.qrSlot; }
function setQrStatus(slot, message, error = false) { const status = $(".qr-status", slot); status.textContent = message; status.classList.toggle("error", error); }
function commitQr(slot, cropped) { images[qrKey(slot)] = cropped; render(); }
async function handleQrFile(slot, file) {
  const error = validImage(file, true); if (error) { setQrStatus(slot, error, true); return; }
  const run = (qrRuns.get(slot) || 0) + 1; qrRuns.set(slot, run); qrFiles.set(slot, file); $(".crop-link", slot).hidden = false; setQrStatus(slot, "正在识别二维码…");
  try {
    const result = await detectAndCrop(file);
    if (qrRuns.get(slot) !== run) return;
    if (result.detected) { commitQr(slot, result.canvas); setQrStatus(slot, result.message || "二维码已识别并裁切。"); return; }
    setQrStatus(slot, `${result.message || "未能自动识别。"} 可继续手动调整裁切框。`); await openManualCrop(slot, file, run);
  } catch { if (qrRuns.get(slot) !== run) return; setQrStatus(slot, "二维码未能自动识别，请手动调整裁切框。", true); await openManualCrop(slot, file, run); }
}
async function openManualCrop(slot, file, run) {
  try {
    const result = await openCropEditor(file, cropped => { if (qrRuns.get(slot) === run) { commitQr(slot, cropped); setQrStatus(slot, "已手动裁切。"); } });
    if (qrRuns.get(slot) !== run) return;
    if (result?.message) setQrStatus(slot, result.message); else if (result?.ok === false) setQrStatus(slot, "已取消手动裁切，当前二维码未变更。");
  } catch { if (qrRuns.get(slot) === run) setQrStatus(slot, "无法打开裁切，请重新选择图片。", true); }
}
$$('.qr-slot').forEach(slot => {
  const input = $(".qr-file", slot);
  input.addEventListener("change", () => { const file = input.files[0]; input.value = ""; if (file) handleQrFile(slot, file); });
  $(".upload-link", slot).addEventListener("click", () => input.click());
  $(".crop-link", slot).addEventListener("click", () => { const file = qrFiles.get(slot); if (file) openManualCrop(slot, file, qrRuns.get(slot)); });
  $(".clear-qr", slot).addEventListener("click", () => { qrRuns.set(slot, (qrRuns.get(slot) || 0) + 1); images[qrKey(slot)] = null; qrFiles.delete(slot); $(".crop-link", slot).hidden = true; setQrStatus(slot, ""); render(); });
  slot.addEventListener("pointerenter", () => currentQrSlot = slot); slot.addEventListener("focusin", () => currentQrSlot = slot); slot.addEventListener("pointerleave", () => { if (currentQrSlot === slot) currentQrSlot = null; });
  slot.addEventListener("dragover", event => event.preventDefault());
  slot.addEventListener("drop", event => { event.preventDefault(); const file = [...event.dataTransfer.files].find(item => item.type.startsWith("image/")); if (file) handleQrFile(slot, file); });
});
document.addEventListener("paste", event => {
  if (!currentQrSlot) return;
  const item = [...(event.clipboardData?.items || [])].find(entry => entry.type.startsWith("image/"));
  if (item) { event.preventDefault(); const file = item.getAsFile(); if (file) handleQrFile(currentQrSlot, file); }
});

$("#operator-open").addEventListener("click", () => $("#operator-dialog").showModal());
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
  $("#operator-results").innerHTML = shown.map(op => `<button class="operator-card${selectedOperators.has(op.id) ? " selected" : ""}" type="button" data-operator="${esc(op.id)}"><img src="${esc(op.image)}" loading="lazy" alt=""><span>${esc(op.name)}</span></button>`).join("");
  $("#operator-more").hidden = shown.length >= matches.length;
  for (const button of $$(".operator-card")) button.addEventListener("click", () => toggleOperator(button.dataset.operator));
  renderSelectedOperators();
}
function toggleOperator(id) {
  if (selectedOperators.has(id)) selectedOperators.delete(id);
  else if (selectedOperators.size < 8) selectedOperators.add(id);
  else { $("#export-status").textContent = "代表干员最多选择 8 位。"; return; }
  for (const op of operators.filter(item => selectedOperators.has(item.id))) {
    if (operatorImages.has(op.id)) continue;
    const img = new Image(); img.onload = () => { operatorImages.set(op.id, img); render(); }; img.src = op.image;
  }
  renderOperatorResults(); render();
}
function renderSelectedOperators() {
  const ops = operators.filter(item => selectedOperators.has(item.id));
  $("#selected-operators").innerHTML = ops.map(op => `<button type="button" class="selected-pill" data-remove="${esc(op.id)}">${esc(op.name)} ×</button>`).join("");
  $$(".selected-pill").forEach(button => button.addEventListener("click", () => toggleOperator(button.dataset.remove)));
}

$("#export-button").addEventListener("click", async () => {
  await document.fonts.ready;
  const factor = Number($("#export-scale").value), output = document.createElement("canvas");
  output.width = SHEET.width * factor; output.height = SHEET.height * factor;
  const profile = readProfile();
  drawProfile(output, profile, faction, operators.filter(item => selectedOperators.has(item.id)), images, { editing: false });
  output.toBlob(blob => {
    if (!blob) { $("#export-status").textContent = "PNG 生成失败，请稍后重试。"; return; }
    const url = URL.createObjectURL(blob), anchor = document.createElement("a"); anchor.href = url; anchor.download = "doctor-profile.png"; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); $("#export-status").textContent = "已导出 PNG。";
  }, "image/png");
});

await Promise.allSettled([document.fonts.load('400 28px Arimo'), document.fonts.load('700 31px "Noto Sans SC"')]);
await document.fonts.ready;
makeChoices(); makeSliders(); chooseFaction(faction.id); renderOperatorResults();
$("#restore-quote").addEventListener("click", () => {
  plain.quote = faction.quote || "";
  plain.motto = factionMotto(faction);
  richText.quote.setText(plain.quote);
  richText.motto.setText(plain.motto);
  updateQuoteSize();
  updateMottoSize();
  $("#quote-default").value = plain.quote;
  render();
});

