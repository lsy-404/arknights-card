import { factions, operators } from "./data.js";
import { detectAndCrop, openCropEditor } from "./qr.js";
import { createSliderControls, drawProfile, imageFromFile } from "./render.js";

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const form = $("#profile-form");
const canvas = $("#profile-canvas");
const factionSelect = $("#faction-select");
const selectedOperators = new Set();
const operatorImages = new Map();
const images = {
  avatar: null,
  logo: null,
  qrWechat: null,
  qrQq: null,
  operators: operatorImages,
};
const qrRuns = new WeakMap();
const qrFiles = new WeakMap();
let faction = factions[0];
let quoteCustom = false;
let currentQrSlot = null;
let avatarRun = 0;

const homeUrl = document.querySelector('meta[name="home-url"]')?.content;
$("#home-link").hidden = !homeUrl;
if (homeUrl) $("#home-link").href = homeUrl;

factionSelect.innerHTML = factions
  .map(
    (item) =>
      `<option value="${escapeAttr(item.id)}">${escapeHtml(item.name)} · ${escapeHtml(item.en)}</option>`,
  )
  .join("");
factionSelect.value = faction.id;
renderFactionShortcuts();
renderOperators();
const sliderDefinitions = createSliderControls($("#sliders"), render);

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
function escapeAttr(value) {
  return escapeHtml(value);
}
function renderFactionShortcuts() {
  $("#faction-shortcuts").innerHTML = factions
    .map(
      (item) =>
        `<button class="faction-chip${item.id === faction.id ? " active" : ""}" type="button" data-faction="${escapeAttr(item.id)}" style="--chip:${escapeAttr(item.color)}"><i></i>${escapeHtml(item.name)}</button>`,
    )
    .join("");
  $$(".faction-chip").forEach((button) =>
    button.addEventListener("click", () =>
      chooseFaction(button.dataset.faction),
    ),
  );
}
function chooseFaction(id) {
  const next = factions.find((item) => item.id === id);
  if (!next) return;
  faction = next;
  factionSelect.value = faction.id;
  document.documentElement.style.setProperty("--faction", faction.color);
  if (!quoteCustom) $("#quote-input").value = faction.quote || "";
  images.logo = null;
  if (faction.logo) {
    const logo = new Image();
    logo.onload = () => {
      if (faction.id === id) {
        images.logo = logo;
        render();
      }
    };
    logo.src = faction.logo;
  }
  renderFactionShortcuts();
  render();
}
factionSelect.addEventListener("change", () =>
  chooseFaction(factionSelect.value),
);
$("#quote-input").value = faction.quote || "";
$("#quote-input").addEventListener("input", () => {
  quoteCustom = true;
  $("#quote-state").textContent = "自定义语录";
  render();
});
$("#default-quote").addEventListener("click", () => {
  quoteCustom = false;
  $("#quote-input").value = faction.quote || "";
  $("#quote-state").textContent = "阵营语录";
  render();
});
chooseFaction(faction.id);

function renderOperators() {
  $("#operator-picker").innerHTML = operators
    .map(
      (op) =>
        `<button type="button" class="operator-button${selectedOperators.has(op.id) ? " selected" : ""}" data-operator="${escapeAttr(op.id)}" aria-label="${escapeAttr(op.name)}" aria-pressed="${selectedOperators.has(op.id)}"><img src="${escapeAttr(op.image)}" alt="${escapeAttr(op.name)}" loading="lazy"></button>`,
    )
    .join("");
  $$(".operator-button").forEach((button) => {
    const op = operators.find((item) => item.id === button.dataset.operator);
    const image = $("img", button);
    image.addEventListener(
      "load",
      () => {
        operatorImages.set(op.id, image);
        render();
      },
      { once: true },
    );
    button.addEventListener("click", () => {
      if (selectedOperators.has(op.id)) selectedOperators.delete(op.id);
      else if (selectedOperators.size < 8) selectedOperators.add(op.id);
      else {
        $("#export-status").textContent = "代表干员最多选择 8 位。";
        return;
      }
      renderOperators();
      render();
    });
  });
}

function readProfile() {
  const data = new FormData(form);
  const sliders = Object.fromEntries(
    sliderDefinitions.map(({ key }) => [key, Number(data.get(key) ?? 0)]),
  );
  const selected = (name) => data.getAll(name);
  return {
    nickname: data.get("nickname"),
    uid: data.get("uid"),
    gender: data.get("gender"),
    server: data.get("server"),
    seniority: data.get("seniority"),
    contacts: selected("contact"),
    focus: selected("focus"),
    bio: data.get("bio"),
    oshi: data.get("oshi"),
    extra: data.get("extra"),
    quote: data.get("quote"),
    sliders,
    wechat: "",
    qq: "",
  };
}
function render() {
  const profile = readProfile();
  const ops = operators.filter((op) => selectedOperators.has(op.id));
  drawProfile(canvas, profile, faction, ops, images);
  $$(".faction-chip").forEach((chip) =>
    chip.classList.toggle("active", chip.dataset.faction === faction.id),
  );
  const labels = ops
    .map((op) => `<span class="selected-pill">${escapeHtml(op.name)}</span>`)
    .join("");
  $("#selected-operators").innerHTML = labels;
}
form.addEventListener("input", (event) => {
  if (event.target.name !== "quote") render();
});
form.addEventListener("change", render);

function validImage(file, qr = false) {
  if (!file) return "没有选择文件。";
  if (
    ![
      "image/png",
      "image/jpeg",
      "image/webp",
      ...(qr ? [] : ["image/gif"]),
    ].includes(file.type)
  )
    return "文件格式不支持，请选择 PNG、JPG 或 WebP 图片。";
  if (file.size > 20 * 1024 * 1024) return "图片超过 20 MB，请先缩小后再试。";
  return "";
}
$("#avatar-file").addEventListener("change", async (event) => {
  const file = event.target.files[0];
  event.target.value = "";
  const error = validImage(file);
  if (error) {
    $("#export-status").textContent = error;
    return;
  }
  const run = ++avatarRun;
  try {
    const img = await imageFromFile(file);
    if (run !== avatarRun) return;
    images.avatar = img;
    $("#export-status").textContent = "";
    render();
  } catch (err) {
    $("#export-status").textContent = err.message;
  }
});
$("#remove-avatar").addEventListener("click", () => {
  avatarRun++;
  images.avatar = null;
  render();
});

function setQrStatus(slot, message, error = false) {
  const status = $(".qr-status", slot);
  status.textContent = message;
  status.classList.toggle("error", error);
}
function commitQr(slot, cropped) {
  const key = slot.dataset.qrSlot === "wechat" ? "qrWechat" : "qrQq";
  images[key] = cropped;
  const zone = $(".drop-zone", slot);
  zone.classList.add("has-image");
  const preview = document.createElement("canvas");
  preview.width = 110;
  preview.height = 72;
  const ctx = preview.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, 110, 72);
  const ratio = Math.min(72 / cropped.height, 110 / cropped.width);
  const w = cropped.width * ratio,
    h = cropped.height * ratio;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(cropped, (110 - w) / 2, (72 - h) / 2, w, h);
  zone.replaceChildren(preview, $(".qr-file", slot));
  render();
}
async function handleQrFile(slot, file) {
  const status = $(".qr-status", slot);
  const error = validImage(file, true);
  if (error) {
    setQrStatus(slot, error, true);
    return;
  }
  const run = (qrRuns.get(slot) || 0) + 1;
  qrRuns.set(slot, run);
  qrFiles.set(slot, file);
  $(".crop-link", slot).hidden = false;
  setQrStatus(slot, "正在本地检查二维码…");
  try {
    const result = await detectAndCrop(file);
    if (qrRuns.get(slot) !== run) return;
    if (result.detected) {
      commitQr(slot, result.canvas);
      setQrStatus(slot, result.message || "二维码已识别并裁切。");
      return;
    }
    setQrStatus(
      slot,
      `${result.message || "未能自动识别。"} 可继续手动调整裁切框。`,
    );
    await openManualCrop(slot, file, run);
  } catch (err) {
    if (qrRuns.get(slot) !== run) return;
    setQrStatus(slot, `自动检查未完成：${err.message} 可继续手动裁切。`, true);
    await openManualCrop(slot, file, run);
  }
}
async function openManualCrop(slot, file, run) {
  try {
    const result = await openCropEditor(file, (cropped) => {
      if (qrRuns.get(slot) === run) {
        commitQr(slot, cropped);
        setQrStatus(slot, "已手动裁切。");
      }
    });
    if (qrRuns.get(slot) !== run) return;
    if (result?.message) setQrStatus(slot, result.message);
    else if (result?.ok === false)
      setQrStatus(slot, "已取消手动裁切，当前二维码未变更。");
  } catch (err) {
    if (qrRuns.get(slot) === run)
      setQrStatus(slot, `无法打开手动裁切：${err.message}`, true);
  }
}
$$(".qr-slot").forEach((slot) => {
  const input = $(".qr-file", slot);
  const zone = $(".drop-zone", slot);
  input.addEventListener("change", () => {
    const file = input.files[0];
    input.value = "";
    if (file) handleQrFile(slot, file);
  });
  $(".upload-link", slot).addEventListener("click", () => input.click());
  $(".crop-link", slot).addEventListener("click", () => {
    const file = qrFiles.get(slot);
    if (file) openManualCrop(slot, file, qrRuns.get(slot));
  });
  zone.addEventListener("click", () => input.click());
  zone.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      input.click();
    }
  });
  zone.addEventListener("dragover", (event) => {
    event.preventDefault();
    zone.classList.add("dragging");
  });
  zone.addEventListener("dragleave", () => zone.classList.remove("dragging"));
  zone.addEventListener("drop", (event) => {
    event.preventDefault();
    zone.classList.remove("dragging");
    const file = [...event.dataTransfer.files].find((item) =>
      item.type.startsWith("image/"),
    );
    if (file) handleQrFile(slot, file);
    else setQrStatus(slot, "拖入的文件不是图片。", true);
  });
  $(".clear-qr", slot).addEventListener("click", () => {
    qrRuns.set(slot, (qrRuns.get(slot) || 0) + 1);
    images[slot.dataset.qrSlot === "wechat" ? "qrWechat" : "qrQq"] = null;
    qrFiles.delete(slot);
    $(".crop-link", slot).hidden = true;
    zone.classList.remove("has-image");
    zone.replaceChildren(
      Object.assign(document.createElement("span"), {
        className: "drop-icon",
        textContent: "＋",
      }),
      Object.assign(document.createElement("span"), {
        textContent: "拖放、粘贴或选择图片",
      }),
      input,
    );
    setQrStatus(slot, "");
    render();
  });
});
document.addEventListener("paste", (event) => {
  if (!currentQrSlot) return;
  const item = [...(event.clipboardData?.items || [])].find((entry) =>
    entry.type.startsWith("image/"),
  );
  if (item) {
    event.preventDefault();
    const file = item.getAsFile();
    if (file) handleQrFile(currentQrSlot, file);
  }
});
$$(".qr-slot").forEach((slot) => {
  slot.addEventListener("pointerenter", () => {
    currentQrSlot = slot;
  });
  slot.addEventListener("focusin", () => {
    currentQrSlot = slot;
  });
  slot.addEventListener("pointerleave", () => {
    if (currentQrSlot === slot) currentQrSlot = null;
  });
});

$("#export-button").addEventListener("click", () => {
  const scale = Number($("#export-scale").value);
  const output = document.createElement("canvas");
  output.width = 900 * scale;
  output.height = 1280 * scale;
  drawProfile(
    output,
    readProfile(),
    faction,
    operators.filter((op) => selectedOperators.has(op.id)),
    images,
  );
  output.toBlob((blob) => {
    if (!blob) {
      $("#export-status").textContent = "PNG 生成失败，请稍后重试。";
      return;
    }
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "doctor-profile.png";
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    $("#export-status").textContent = "档案 PNG 已导出。";
  }, "image/png");
});
render();
