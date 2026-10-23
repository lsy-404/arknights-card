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
          : reject(new Error("QR decoder did not initialize"));
      script.onerror = () =>
        reject(new Error("QR decoder could not be loaded"));
      document.head.append(script);
    });
  }
  return decoderPromise;
}

const MAX_FILE_BYTES = 20 * 1024 * 1024;
const MAX_SIDE = 8192;
const MAX_PIXELS = 40_000_000;

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

export async function detectAndCrop(file) {
  const original = document.createElement("canvas");
  try {
    if (!(file instanceof Blob) || !file.type.startsWith("image/"))
      throw new Error("请选择图片文件");
    if (file.size > MAX_FILE_BYTES)
      throw new Error("图片文件过大，请选择 20 MB 以内的图片");
    const [image, decoder] = await Promise.all([
      loadImage(file),
      loadDecoder(),
    ]);
    const source = canvasFor(image);
    original.width = source.width;
    original.height = source.height;
    original.getContext("2d").drawImage(source, 0, 0);
    const pixels = source
      .getContext("2d", { willReadFrequently: true })
      .getImageData(0, 0, source.width, source.height);
    const result = decoder(pixels.data, pixels.width, pixels.height, {
      inversionAttempts: "attemptBoth",
    });
    if (!result?.location)
      return {
        canvas: original,
        detected: false,
        message: "未找到可识别的二维码。你可以手动框选裁切区域。",
      };
    const points = [
      "topLeftCorner",
      "topRightCorner",
      "bottomRightCorner",
      "bottomLeftCorner",
    ].map((k) => result.location[k]);
    const left = Math.min(...points.map((p) => p.x));
    const top = Math.min(...points.map((p) => p.y));
    const right = Math.max(...points.map((p) => p.x));
    const bottom = Math.max(...points.map((p) => p.y));
    const dimension = 17 + 4 * result.version;
    const distances = [
      Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y),
      Math.hypot(points[2].x - points[1].x, points[2].y - points[1].y),
      Math.hypot(points[3].x - points[2].x, points[3].y - points[2].y),
      Math.hypot(points[0].x - points[3].x, points[0].y - points[3].y),
    ];
    const modulePixels =
      distances.reduce((sum, distance) => sum + distance, 0) / (4 * dimension);
    const errorMargin = 2;
    const x = Math.max(0, Math.floor(left - errorMargin));
    const y = Math.max(0, Math.floor(top - errorMargin));
    const x2 = Math.min(source.width, Math.ceil(right + errorMargin));
    const y2 = Math.min(source.height, Math.ceil(bottom + errorMargin));
    const regionWidth = x2 - x;
    const regionHeight = y2 - y;
    const quietZone = Math.ceil(modulePixels * 4) + errorMargin;
    const side = Math.ceil(Math.max(regionWidth, regionHeight) + quietZone * 2);
    const cropped = document.createElement("canvas");
    cropped.width = side;
    cropped.height = side;
    const offsetX = Math.floor((side - regionWidth) / 2);
    const offsetY = Math.floor((side - regionHeight) / 2);
    const cropContext = cropped.getContext("2d");
    cropContext.fillStyle = "#fff";
    cropContext.fillRect(0, 0, side, side);
    cropContext.drawImage(
      source,
      x,
      y,
      regionWidth,
      regionHeight,
      offsetX,
      offsetY,
      regionWidth,
      regionHeight,
    );
    return {
      canvas: cropped,
      detected: true,
      message: "已定位二维码并保留周围白边。",
    };
  } catch (error) {
    return {
      canvas: original,
      detected: false,
      message:
        error instanceof Error
          ? error.message
          : "图片处理失败，可尝试手动裁切。",
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
      message: error instanceof Error ? error.message : "图片处理失败",
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
          message: error instanceof Error ? error.message : "提交裁切结果失败",
        });
      }
    });
  });
}
