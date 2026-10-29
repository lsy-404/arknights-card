const scriptUrl = new URL("./vendor/jsQR.js", import.meta.url);
let decoderPromise;

function loadDecoder() {
  if (globalThis.jsQR) return Promise.resolve(globalThis.jsQR);
  if (!decoderPromise) {
    decoderPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = scriptUrl.href;
      script.onload = () =>
        globalThis.jsQR
          ? resolve(globalThis.jsQR)
          : reject(new Error("二维码识别暂不可用"));
      script.onerror = () =>
        reject(new Error("二维码识别暂不可用"));
      document.head.append(script);
    });
  }
  return decoderPromise;
}

const MAX_FILE_BYTES = 20 * 1024 * 1024;
const MAX_SIDE = 8192;
const MAX_PIXELS = 40_000_000;
const USER_ERRORS = new Set([
  "请选择图片文件",
  "图片文件过大，请选择 20 MB 以内的图片",
  "图片内容无效",
  "图片尺寸过大，请先缩小后再导入",
  "无法读取这张图片",
  "二维码识别暂不可用",
]);

function userMessage(error, fallback) {
  return error instanceof Error && USER_ERRORS.has(error.message)
    ? error.message
    : fallback;
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      if (!image.naturalWidth || !image.naturalHeight)
        return reject(new Error("图片内容无效"));
      if (
        image.naturalWidth > MAX_SIDE ||
        image.naturalHeight > MAX_SIDE ||
        image.naturalWidth * image.naturalHeight > MAX_PIXELS
      )
        return reject(new Error("图片尺寸过大，请先缩小后再导入"));
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("无法读取这张图片"));
    };
    image.src = url;
  });
}

function canvasFor(image) {
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  canvas.getContext("2d", { willReadFrequently: true }).drawImage(image, 0, 0);
  return canvas;
}

const OUTPUT_MAX = 800;
const DECODE_SIDES = [Infinity, 1024, 600];

function scaled(canvas, maxSide) {
  const ratio = Math.min(1, maxSide / Math.max(canvas.width, canvas.height));
  if (ratio === 1) return { canvas, ratio };
  const out = document.createElement("canvas");
  out.width = Math.max(1, Math.round(canvas.width * ratio));
  out.height = Math.max(1, Math.round(canvas.height * ratio));
  const context = out.getContext("2d", { willReadFrequently: true });
  context.imageSmoothingQuality = "high";
  context.drawImage(canvas, 0, 0, out.width, out.height);
  return { canvas: out, ratio: out.width / canvas.width };
}

function luma(data, i) {
  return 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
}

function otsuBinarize(pixels) {
  const { data } = pixels;
  const histogram = new Array(256).fill(0);
  for (let i = 0; i < data.length; i += 4) histogram[Math.round(luma(data, i))]++;
  const total = data.length / 4;
  let sum = 0;
  for (let t = 0; t < 256; t++) sum += t * histogram[t];
  let backgroundSum = 0, backgroundCount = 0, best = 0, threshold = 127;
  for (let t = 0; t < 256; t++) {
    backgroundCount += histogram[t];
    if (!backgroundCount) continue;
    const foregroundCount = total - backgroundCount;
    if (!foregroundCount) break;
    backgroundSum += t * histogram[t];
    const between = backgroundCount * foregroundCount * (backgroundSum / backgroundCount - (sum - backgroundSum) / foregroundCount) ** 2;
    if (between > best) { best = between; threshold = t; }
  }
  const out = new Uint8ClampedArray(data.length);
  for (let i = 0; i < data.length; i += 4) {
    out[i] = out[i + 1] = out[i + 2] = luma(data, i) > threshold ? 255 : 0;
    out[i + 3] = 255;
  }
  return { data: out, width: pixels.width, height: pixels.height };
}

function decodeCode(decoder, source) {
  for (const maxSide of DECODE_SIDES) {
    const { canvas, ratio } = scaled(source, maxSide);
    if (maxSide !== Infinity && ratio === 1) continue;
    const pixels = canvas.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, canvas.width, canvas.height);
    for (const variant of [pixels, otsuBinarize(pixels)]) {
      const result = decoder(variant.data, variant.width, variant.height, { inversionAttempts: "attemptBoth" });
      if (result?.location) return { result, ratio };
    }
  }
  return null;
}

function squareCanvas(source, region, margin, fill) {
  const side = Math.ceil(Math.max(region.w, region.h) + margin * 2);
  const out = document.createElement("canvas");
  out.width = side;
  out.height = side;
  const context = out.getContext("2d");
  context.fillStyle = fill;
  context.fillRect(0, 0, side, side);
  context.drawImage(source, region.x, region.y, region.w, region.h, Math.floor((side - region.w) / 2), Math.floor((side - region.h) / 2), region.w, region.h);
  return scaled(out, OUTPUT_MAX).canvas;
}

function cropDecoded(source, { result, ratio }) {
  const points = ["topLeftCorner", "topRightCorner", "bottomRightCorner", "bottomLeftCorner"].map((k) => ({ x: result.location[k].x / ratio, y: result.location[k].y / ratio }));
  const dimension = 17 + 4 * result.version;
  const modulePixels = points.reduce((sum, point, i) => sum + Math.hypot(points[(i + 1) % 4].x - point.x, points[(i + 1) % 4].y - point.y), 0) / (4 * dimension);
  const errorMargin = 2;
  const x = Math.max(0, Math.floor(Math.min(...points.map((p) => p.x)) - errorMargin));
  const y = Math.max(0, Math.floor(Math.min(...points.map((p) => p.y)) - errorMargin));
  const region = {
    x,
    y,
    w: Math.min(source.width, Math.ceil(Math.max(...points.map((p) => p.x)) + errorMargin)) - x,
    h: Math.min(source.height, Math.ceil(Math.max(...points.map((p) => p.y)) + errorMargin)) - y,
  };
  return squareCanvas(source, region, Math.ceil(modulePixels * 4) + errorMargin, "#fff");
}

function isSquarish(box) {
  const ratio = box.w / box.h;
  return box.w >= 12 && box.h >= 12 && ratio >= 0.8 && ratio <= 1.25;
}

function projectionBox(flags, width, height, minCount) {
  const rows = new Array(height).fill(0), columns = new Array(width).fill(0);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (flags[y * width + x]) { rows[y]++; columns[x]++; }
  const first = (counts) => counts.findIndex((count) => count >= minCount);
  const last = (counts) => counts.length - 1 - [...counts].reverse().findIndex((count) => count >= minCount);
  const left = first(columns), top = first(rows);
  if (left < 0 || top < 0) return null;
  return { x: left, y: top, w: last(columns) - left + 1, h: last(rows) - top + 1 };
}

function densestBox(data, width, height) {
  const block = Math.max(4, Math.round(Math.max(width, height) / 50));
  const gw = Math.ceil(width / block), gh = Math.ceil(height / block);
  const dense = new Uint8Array(gw * gh);
  for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) {
    let edges = 0, samples = 0;
    for (let y = gy * block; y < Math.min(height - 1, (gy + 1) * block); y++) for (let x = gx * block; x < Math.min(width - 1, (gx + 1) * block); x++) {
      const i = (y * width + x) * 4, here = luma(data, i);
      if (Math.abs(here - luma(data, i + 4)) > 48) edges++;
      if (Math.abs(here - luma(data, i + width * 4)) > 48) edges++;
      samples += 2;
    }
    dense[gy * gw + gx] = samples && edges / samples > 0.12 ? 1 : 0;
  }
  const grown = new Uint8Array(gw * gh);
  for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) if (dense[gy * gw + gx]) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const x = gx + dx, y = gy + dy;
    if (x >= 0 && y >= 0 && x < gw && y < gh) grown[y * gw + x] = 1;
  }
  const seen = new Uint8Array(gw * gh);
  let best = null;
  for (let start = 0; start < grown.length; start++) {
    if (!grown[start] || seen[start]) continue;
    const queue = [start];
    seen[start] = 1;
    let count = 0, minX = gw, minY = gh, maxX = -1, maxY = -1;
    while (queue.length) {
      const index = queue.pop(), x = index % gw, y = (index - x) / gw;
      if (dense[index]) count++;
      minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy, next = ny * gw + nx;
        if (nx >= 0 && ny >= 0 && nx < gw && ny < gh && grown[next] && !seen[next]) { seen[next] = 1; queue.push(next); }
      }
    }
    if (!best || count > best.count) best = { count, minX, minY, maxX, maxY };
  }
  if (!best || best.count < 6) return null;
  const x = Math.max(0, (best.minX + 1) * block), y = Math.max(0, (best.minY + 1) * block);
  return { x, y, w: Math.min(width, best.maxX * block) - x, h: Math.min(height, best.maxY * block) - y };
}

function trimToCode(source) {
  const { canvas: small, ratio } = scaled(source, 400);
  const { width, height } = small;
  const { data } = small.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, width, height);
  const ring = [];
  for (let x = 0; x < width; x++) ring.push(x * 4, ((height - 1) * width + x) * 4);
  for (let y = 1; y < height - 1; y++) ring.push(y * width * 4, (y * width + width - 1) * 4);
  const median = (channel) => ring.map((i) => data[i + channel]).sort((a, b) => a - b)[ring.length >> 1];
  const background = [median(0), median(1), median(2)];
  const distance = (i) => Math.abs(data[i] - background[0]) + Math.abs(data[i + 1] - background[1]) + Math.abs(data[i + 2] - background[2]);
  const uniform = ring.filter((i) => distance(i) > 60).length / ring.length < 0.08;
  let box = null;
  if (uniform) {
    const flags = new Uint8Array(width * height);
    for (let p = 0; p < flags.length; p++) flags[p] = distance(p * 4) > 60 ? 1 : 0;
    const filled = projectionBox(flags, width, height, 2);
    if (filled && isSquarish(filled)) box = filled;
  }
  if (!box) {
    const dense = densestBox(data, width, height);
    if (dense && isSquarish(dense)) box = dense;
  }
  if (!box) return null;
  const region = { x: Math.floor(box.x / ratio), y: Math.floor(box.y / ratio), w: Math.ceil(box.w / ratio), h: Math.ceil(box.h / ratio) };
  region.w = Math.min(source.width - region.x, region.w);
  region.h = Math.min(source.height - region.y, region.h);
  const fill = uniform ? `rgb(${background.join(",")})` : "#fff";
  return squareCanvas(source, region, Math.ceil(Math.max(region.w, region.h) * 0.06), fill);
}

export async function detectAndCrop(file) {
  try {
    if (!(file instanceof Blob) || !file.type.startsWith("image/"))
      throw new Error("请选择图片文件");
    if (file.size > MAX_FILE_BYTES)
      throw new Error("图片文件过大，请选择 20 MB 以内的图片");
    const [image, decoder] = await Promise.all([loadImage(file), loadDecoder().catch(() => null)]);
    const source = canvasFor(image);
    const decoded = decoder ? decodeCode(decoder, source) : null;
    if (decoded) return { canvas: cropDecoded(source, decoded), detected: true, message: "已定位二维码并保留周围白边。" };
    const trimmed = trimToCode(source);
    if (trimmed) return { canvas: trimmed, detected: false, auto: true, message: "已按图案边界自动裁切，可点击“调整裁切”微调。" };
    return { canvas: source, detected: false, auto: true, message: "未能定位二维码，已使用整张图片，可点击“调整裁切”。" };
  } catch (error) {
    return {
      canvas: document.createElement("canvas"),
      detected: false,
      failed: true,
      message: userMessage(error, "二维码识别失败，请重新选择图片。"),
    };
  }
}

export async function openCropEditor(file, onConfirm) {
  let image;
  try {
    if (!(file instanceof Blob) || !file.type.startsWith("image/"))
      throw new Error("请选择图片文件");
    if (file.size > MAX_FILE_BYTES)
      throw new Error("图片文件过大，请选择 20 MB 以内的图片");
    image = await loadImage(file);
  } catch (error) {
    return {
      ok: false,
      message: userMessage(error, "无法打开裁切工具，请重试。"),
    };
  }
  const dialog = document.createElement("dialog");
  dialog.className = "qr-crop-dialog";
  dialog.setAttribute("aria-label", "手动裁切二维码");
  dialog.innerHTML =
    '<form method="dialog" class="qr-crop-panel"><h2>手动裁切</h2><p id="qr-crop-help">拖动虚线框移动，拖动右下角控制点调整大小。键盘：方向键移动，Shift 加方向键调整大小。</p><div class="qr-crop-stage"><canvas></canvas><div class="qr-crop-box" role="slider" tabindex="0" aria-label="裁切框" aria-describedby="qr-crop-help"><span class="qr-crop-handle" aria-hidden="true"></span></div></div><div class="qr-crop-actions"><button value="cancel" type="button" data-cancel>取消</button><button type="button" data-confirm>确认裁切</button></div></form>';
  document.body.append(dialog);
  const canvas = dialog.querySelector("canvas");
  const ctx = canvas.getContext("2d");
  const stage = dialog.querySelector(".qr-crop-stage");
  const box = dialog.querySelector(".qr-crop-box");
  const maxW = Math.min(760, innerWidth - 36);
  const maxH = Math.min(innerHeight - 180, 640);
  const scale = Math.min(
    maxW / image.naturalWidth,
    maxH / image.naturalHeight,
    1,
  );
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  stage.style.width = `${canvas.width}px`;
  stage.style.height = `${canvas.height}px`;
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  const minWidth = Math.min(40, canvas.width);
  const minHeight = Math.min(40, canvas.height);
  const initialWidth = Math.min(
    canvas.width,
    Math.max(minWidth, canvas.width * 0.7),
  );
  const initialHeight = Math.min(
    canvas.height,
    Math.max(minHeight, canvas.height * 0.7),
  );
  let rect = {
    x: (canvas.width - initialWidth) / 2,
    y: (canvas.height - initialHeight) / 2,
    w: initialWidth,
    h: initialHeight,
  };
  const paint = () => {
    box.style.left = `${rect.x}px`;
    box.style.top = `${rect.y}px`;
    box.style.width = `${rect.w}px`;
    box.style.height = `${rect.h}px`;
    box.setAttribute(
      "aria-valuetext",
      `x ${Math.round(rect.x)}, y ${Math.round(rect.y)}, 宽 ${Math.round(rect.w)}, 高 ${Math.round(rect.h)}`,
    );
  };
  paint();
  dialog.showModal();
  return new Promise((resolve) => {
    let drag = null;
    box.addEventListener("pointerdown", (event) => {
      drag = {
        x: event.clientX,
        y: event.clientY,
        left: rect.x,
        top: rect.y,
        w: rect.w,
        h: rect.h,
        resize: event.target.classList.contains("qr-crop-handle"),
      };
      box.setPointerCapture(event.pointerId);
      event.preventDefault();
    });
    box.addEventListener("pointermove", (event) => {
      if (!drag) return;
      const dx =
        ((event.clientX - drag.x) * canvas.width) /
        stage.getBoundingClientRect().width;
      const dy =
        ((event.clientY - drag.y) * canvas.height) /
        stage.getBoundingClientRect().height;
      if (drag.resize) {
        rect.w = Math.min(
          canvas.width - rect.x,
          Math.max(minWidth, drag.w + dx),
        );
        rect.h = Math.min(
          canvas.height - rect.y,
          Math.max(minHeight, drag.h + dy),
        );
      } else {
        rect.x = Math.max(0, Math.min(canvas.width - rect.w, drag.left + dx));
        rect.y = Math.max(0, Math.min(canvas.height - rect.h, drag.top + dy));
      }
      paint();
    });
    box.addEventListener("pointerup", () => {
      drag = null;
    });
    box.addEventListener("keydown", (event) => {
      const step = event.shiftKey ? 10 : 2;
      if (
        !["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)
      )
        return;
      event.preventDefault();
      if (event.shiftKey) {
        rect.w = Math.min(
          canvas.width - rect.x,
          Math.max(
            minWidth,
            rect.w +
              (event.key === "ArrowRight"
                ? step
                : event.key === "ArrowLeft"
                  ? -step
                  : 0),
          ),
        );
        rect.h = Math.min(
          canvas.height - rect.y,
          Math.max(
            minHeight,
            rect.h +
              (event.key === "ArrowDown"
                ? step
                : event.key === "ArrowUp"
                  ? -step
                  : 0),
          ),
        );
      } else {
        rect.x = Math.max(
          0,
          Math.min(
            canvas.width - rect.w,
            rect.x +
              (event.key === "ArrowRight"
                ? step
                : event.key === "ArrowLeft"
                  ? -step
                  : 0),
          ),
        );
        rect.y = Math.max(
          0,
          Math.min(
            canvas.height - rect.h,
            rect.y +
              (event.key === "ArrowDown"
                ? step
                : event.key === "ArrowUp"
                  ? -step
                  : 0),
          ),
        );
      }
      paint();
    });
    const finish = (result) => {
      dialog.close();
      dialog.remove();
      resolve(result);
    };
    dialog
      .querySelector("[data-cancel]")
      .addEventListener("click", () => finish({ ok: false }));
    dialog.addEventListener(
      "cancel",
      (event) => {
        event.preventDefault();
        finish({ ok: false });
      },
      { once: true },
    );
    dialog.querySelector("[data-confirm]").addEventListener("click", () => {
      const sx = image.naturalWidth / canvas.width;
      const sy = image.naturalHeight / canvas.height;
      const out = document.createElement("canvas");
      out.width = Math.max(1, Math.round(rect.w * sx));
      out.height = Math.max(1, Math.round(rect.h * sy));
      out
        .getContext("2d")
        .drawImage(
          image,
          Math.round(rect.x * sx),
          Math.round(rect.y * sy),
          out.width,
          out.height,
          0,
          0,
          out.width,
          out.height,
        );
      try {
        onConfirm?.(out);
        finish({ ok: true, canvas: out });
      } catch (error) {
        finish({
          ok: false,
          message: "无法应用裁切结果，请重试。",
        });
      }
    });
  });
}
