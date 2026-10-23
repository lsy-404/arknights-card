import { factions } from "./data.js";
import { detectAndCrop, openCropEditor } from "./qr.js";
import { drawProfile, imageFromFile } from "./render.js";
import { createRichText, setupRichTextToolbar } from "./rich-text.js";
import { OPTIONS, SHEET, SLIDERS } from "./layout.js";
import { markerSeed, markerStyle } from "./marker.js";

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const canvas = $("#profile-canvas");
const sheet = $("#sheet");
const factionSelect = $("#faction-select");
const qrRuns = new WeakMap();
const qrFiles = new WeakMap();
const operatorImages = new Map();
const images = { avatar: null, logo: null, qr1: null, qr2: null, operators: operatorImages };
let operators = [];
let faction = factions[0];
let currentQrSlot = null;
let avatarRun = 0;
let searchLimit = 60;
let searchQuery = "";
let quoteState = { quote: "", motto: "" };
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
if (homeUrl) $("#home-link").href = homeUrl;
factionSelect.innerHTML = factions.map(item => `<option value="${esc(item.id)}">${esc(item.name)} · ${esc(item.en)}</option>`).join("");
setupRichTextToolbar($("#richtext-toolbar"));

for (const [key, label, initialText, placeholder, size, maxLength] of [
  ["nickname", "#field-nickname", plain.nickname, "此处填写名字", 80, 24],
  ["motto", "#field-motto", "", "阵营格言", 25, 70],
  ["quote", "#field-quote", "", "阵营语录", 24, 90],
  ["oshi", "#field-oshi", "", "我的角色 / CP / CB", 24, 60],
  ["extra", "#field-extra", "", "补充说明", 24, 120],
]) {
  richText[key] = await createRichText($(label), { initialText, placeholder, defaultSize: size, maxLength, onChange: (runs, text) => { plain[key] = text; render(); } });
}

function esc(value) { return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;"); }
function chooseFaction(id) {
  const next = factions.find(item => item.id === id);
  if (!next) return;
  faction = next;
  factionSelect.value = faction.id;
  document.documentElement.style.setProperty("--accent", faction.color || "#61b9e6");
  quoteState = { quote: faction.quote || "", motto: faction.motto || "" };
  plain.quote = quoteState.quote;
  plain.motto = quoteState.motto;
  richText.quote.setText(plain.quote);
  richText.motto.setText(plain.motto);
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
    qrTypes: $$(".qr-type").map(select => select.value),
    selections: { gender: selection.gender, contact: [...selection.contact], server: [...selection.server], seniority: [...selection.seniority], focus: [...selection.focus] },
  };
}

function makeChoices() {
  const geometries = {
    gender: { x: 304, y: 784, widths: [83, 83, 108] },
    contact: { x: 304, y: 838, widths: [108, 83, 185] },
    server: { x: 304, y: 891, widths: [58, 54, 86, 54, 54, 54] },
    seniority: { x: 304, y: 944, widths: [82, 82, 82, 172] },
    focus: { x: 304, y: 997, widths: [173, 119, 83, 57, 83, 83] },
  };
  for (const [group, options] of Object.entries(OPTIONS)) {
    const host = $(`#choice-${group}`), geo = geometries[group];
    host.innerHTML = "";
    const positionX = (value, index) => geo.x + geo.widths.slice(0, index).reduce((sum, width) => sum + width, 0);
    options.forEach((value, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.group = group;
      button.dataset.value = value;
      button.setAttribute("aria-pressed", String(isSelected(group, value)));
      button.textContent = value + (index < options.length - 1 ? "/" : "");
      Object.assign(button.style, { position: "absolute", left: `${positionX(value, index)}px`, top: `${geo.y}px`, width: `${geo.widths[index]}px`, height: `44px`, textAlign: "left", color: "#171918", "--marker": "#63c4ed" });
      host.append(button);
      refreshMarker(button);
    });
  }
}
$("#sheet-editors").addEventListener("click", event => {
  const button = event.target.closest("button[data-group]");
  if (!button) return;
  const { group, value } = button.dataset;
  if (group === "gender") selection.gender = value;
  else {
    if (selection[group].has(value)) selection[group].delete(value);
    else selection[group].add(value);
  }
  markerSeeds[`${group}:${value}`] = markerSeed();
  makeChoices(); render();
});
function isSelected(group, value) { return group === "gender" ? selection.gender === value : selection[group].has(value); }
function refreshMarker(button) {
  const { group, value } = button.dataset;
  const seed = markerSeeds[`${group}:${value}`] || 1;
  const active = isSelected(group, value);
  const style = markerStyle(seed);
  button.style.setProperty("--tilt", `${style.tilt}rad`);
  button.style.setProperty("--marker-alpha", style.opacity);
  button.style.setProperty("--marker-shape", `polygon(${style.points.map(([x, y]) => `${x}% ${y}%`).join(",")})`);
  button.classList.toggle("selected", active);
  button.setAttribute("aria-pressed", String(active));
}

function makeSliders() {
  const layer = $("#slider-layer");
  layer.innerHTML = "";
  const trackYs = [1220, 1352, 1477, 1631, 1768, 1915, 2057];
  SLIDERS.forEach((item, i) => {
    const input = document.createElement("input");
    input.type = "range"; input.min = "0"; input.max = "100"; input.value = sliders[item.key]; input.setAttribute("aria-label", item.title);
    input.dataset.key = item.key;
    Object.assign(input.style, { position: "absolute", left: `${(i === 0 ? 122 : [123,123,120,117,121,121][i - 1]) / SHEET.width * 100}%`, top: `${(trackYs[i] - 17) / 2360 * 100}%`, width: `${378 / SHEET.width * 100}%`, height: `${34 / 2360 * 100}%` });
    input.addEventListener("input", () => { sliders[item.key] = Number(input.value); sliderTouched.add(item.key); input.classList.add("touched"); render(); });
    layer.append(input);
  });
}

function render() {
  const ops = operators.filter(item => selectedOperators.has(item.id));
  drawProfile(canvas, readProfile(), faction, ops, images, { editing: true });
  for (const button of $$("button[data-group]")) refreshMarker(button);
  renderSelectedOperators();
}

function fitSheet() {
  $("#sheet-editors").style.transform = `scale(${sheet.clientWidth / SHEET.width})`;
}
new ResizeObserver(fitSheet).observe(sheet);
fitSheet();

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
$("#avatar-hit").addEventListener("click", () => $("#avatar-file").click());
$("#qr-count").addEventListener("change", () => { $("#qr-hit-2").hidden = $("#qr-count").value !== "2"; $$('.qr-slot')[1].hidden = $("#qr-count").value !== "2"; render(); });
$("#qr-hit-1").addEventListener("click", () => $$('.qr-slot')[0].querySelector(".qr-file").click());
$("#qr-hit-2").addEventListener("click", () => $$('.qr-slot')[1].querySelector(".qr-file").click());

function qrKey(slot) { return slot.dataset.qrSlot; }
function setQrStatus(slot, message, error = false) { const status = $(".qr-status", slot); status.textContent = message; status.classList.toggle("error", error); }
function commitQr(slot, cropped) { images[qrKey(slot)] = cropped; render(); }
async function handleQrFile(slot, file) {
  const error = validImage(file, true); if (error) { setQrStatus(slot, error, true); return; }
  const run = (qrRuns.get(slot) || 0) + 1; qrRuns.set(slot, run); qrFiles.set(slot, file); $(".crop-link", slot).hidden = false; setQrStatus(slot, "正在本地检查二维码…");
  try {
    const result = await detectAndCrop(file);
    if (qrRuns.get(slot) !== run) return;
    if (result.detected) { commitQr(slot, result.canvas); setQrStatus(slot, result.message || "二维码已识别并裁切。"); return; }
    setQrStatus(slot, `${result.message || "未能自动识别。"} 可继续手动调整裁切框。`); await openManualCrop(slot, file, run);
  } catch (error) { if (qrRuns.get(slot) !== run) return; setQrStatus(slot, `自动检查未完成：${error.message} 可继续手动裁切。`, true); await openManualCrop(slot, file, run); }
}
async function openManualCrop(slot, file, run) {
  try {
    const result = await openCropEditor(file, cropped => { if (qrRuns.get(slot) === run) { commitQr(slot, cropped); setQrStatus(slot, "已手动裁切。"); } });
    if (qrRuns.get(slot) !== run) return;
    if (result?.message) setQrStatus(slot, result.message); else if (result?.ok === false) setQrStatus(slot, "已取消手动裁切，当前二维码未变更。");
  } catch (error) { if (qrRuns.get(slot) === run) setQrStatus(slot, `无法打开手动裁切：${error.message}`, true); }
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

async function loadOperators() {
  try { ({ operators } = await import("./operators.js")); } catch { operators = []; }
  renderOperatorResults();
}
$("#operator-open").addEventListener("click", () => $("#operator-dialog").showModal());
$("#operator-close").addEventListener("click", () => $("#operator-dialog").close());
$("#operator-search").addEventListener("input", event => { searchQuery = event.target.value.trim().toLocaleLowerCase(); searchLimit = 60; renderOperatorResults(); });
$("#operator-more").addEventListener("click", () => { searchLimit += 60; renderOperatorResults(); });
function matchesOperator(op) {
  if (!searchQuery) return true;
  return [op.name, op.pinyin, op.initials, op.en].some(value => String(value || "").toLocaleLowerCase().includes(searchQuery));
}
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

$("#export-button").addEventListener("click", () => {
  const factor = Number($("#export-scale").value), output = document.createElement("canvas");
  output.width = SHEET.width * factor; output.height = SHEET.height * factor;
  const profile = readProfile();
  drawProfile(output, profile, faction, operators.filter(item => selectedOperators.has(item.id)), images, { editing: false });
  output.toBlob(blob => {
    if (!blob) { $("#export-status").textContent = "PNG 生成失败，请稍后重试。"; return; }
    const url = URL.createObjectURL(blob), anchor = document.createElement("a"); anchor.href = url; anchor.download = "doctor-profile.png"; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); $("#export-status").textContent = "档案 PNG 已导出。";
  }, "image/png");
});

makeChoices(); makeSliders(); chooseFaction(faction.id); loadOperators();
$("#restore-quote").addEventListener("click", () => {
  plain.quote = faction.quote || "";
  plain.motto = faction.motto || "";
  richText.quote.setText(plain.quote);
  richText.motto.setText(plain.motto);
  $("#quote-default").value = plain.quote;
  render();
});
$$('.qr-type').forEach(select => select.addEventListener("change", render));
