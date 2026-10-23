const { chromium } = require("playwright");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const server = http.createServer((req, res) => {
  const file = path.resolve(
    root,
    `.${decodeURIComponent(new URL(req.url, "http://localhost").pathname)}`,
  );
  if (!file.startsWith(root + path.sep)) {
    res.writeHead(403).end();
    return;
  }
  res.writeHead(200, {
    "Content-Type": file.endsWith(".js")
      ? "text/javascript"
      : file.endsWith(".css")
        ? "text/css"
        : "application/octet-stream",
  });
  fs.createReadStream(file).pipe(res);
});
const fail = (message) => {
  throw new Error(message);
};

(async () => {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 900 },
    });
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/web/qr.js`);
    const fixture = `data:image/png;base64,${fs.readFileSync(path.join(__dirname, "fixtures/chat-screenshot.png")).toString("base64")}`;
    const automatic = await page.evaluate(async (fixture) => {
      const mod = await import("/web/qr.js");
      window.qrModule = mod;
      const css = document.createElement("link");
      css.rel = "stylesheet";
      css.href = "/web/qr.css";
      document.head.append(css);
      await new Promise((resolve) => {
        css.onload = resolve;
      });
      const image = new Image();
      image.src = fixture;
      await image.decode();
      const fileFrom = (canvas) =>
        new Promise((resolve) =>
          canvas.toBlob((blob) =>
            resolve(new File([blob], "chat-shot.png", { type: "image/png" })),
          ),
        );
      const screenshot = document.createElement("canvas");
      screenshot.width = image.naturalWidth;
      screenshot.height = image.naturalHeight;
      screenshot.getContext("2d").drawImage(image, 0, 0);
      window.qrFile = await fileFrom(screenshot);
      const result = await mod.detectAndCrop(window.qrFile);
      const pixels = result.canvas
        .getContext("2d")
        .getImageData(0, 0, result.canvas.width, result.canvas.height);
      const decoded = globalThis.jsQR(
        pixels.data,
        pixels.width,
        pixels.height,
        { inversionAttempts: "attemptBoth" },
      );
      let bluePixels = 0;
      for (let i = 0; i < pixels.data.length; i += 4)
        if (
          pixels.data[i] < 80 &&
          pixels.data[i + 1] < 150 &&
          pixels.data[i + 2] > 180
        )
          bluePixels++;
      const corners = [
        "topLeftCorner",
        "topRightCorner",
        "bottomRightCorner",
        "bottomLeftCorner",
      ].map((key) => decoded.location[key]);
      const qrEdge = Math.hypot(
        corners[1].x - corners[0].x,
        corners[1].y - corners[0].y,
      );
      const modulePixels = qrEdge / (17 + 4 * decoded.version);
      const gap = Math.min(
        ...corners.map((point) =>
          Math.min(
            point.x,
            point.y,
            result.canvas.width - point.x,
            result.canvas.height - point.y,
          ),
        ),
      );
      const quietModules = gap / modulePixels;
      const logoCanvas = document.createElement("canvas");
      logoCanvas.width = 360;
      logoCanvas.height = 360;
      const logoContext = logoCanvas.getContext("2d");
      logoContext.fillStyle = "#fff";
      logoContext.fillRect(0, 0, 360, 360);
      logoContext.drawImage(image, 220, 80, 280, 280, 40, 40, 280, 280);
      logoContext.fillStyle = "#fff";
      logoContext.fillRect(160, 160, 40, 40);
      const logoCrop = await mod.detectAndCrop(await fileFrom(logoCanvas));
      const logoPixels = logoCrop.canvas
        .getContext("2d")
        .getImageData(0, 0, logoCrop.canvas.width, logoCrop.canvas.height);
      const logoDecoded = globalThis.jsQR(
        logoPixels.data,
        logoPixels.width,
        logoPixels.height,
        { inversionAttempts: "attemptBoth" },
      );
      const edge = document.createElement("canvas");
      edge.width = 360;
      edge.height = 360;
      const edgeContext = edge.getContext("2d");
      edgeContext.fillStyle = "#fff";
      edgeContext.fillRect(0, 0, 360, 360);
      edgeContext.drawImage(image, 220, 80, 280, 280, 0, 0, 280, 280);
      const nearEdge = await mod.detectAndCrop(await fileFrom(edge));
      const blank = document.createElement("canvas");
      blank.width = 300;
      blank.height = 180;
      const noQr = await mod.detectAndCrop(await fileFrom(blank));
      return {
        detected: result.detected,
        message: noQr.message,
        failure: noQr.detected,
        decoded: decoded?.data,
        logoDecoded: logoDecoded?.data,
        width: result.canvas.width,
        height: result.canvas.height,
        corner: [...pixels.data.slice(0, 4)],
        bluePixels,
        quietModules,
        edgeDetected: nearEdge.detected,
      };
    }, fixture);
    if (
      !automatic.detected ||
      automatic.decoded !== "https://example.test/profile/arknights"
    )
      fail(`Automatic crop failed: ${JSON.stringify(automatic)}`);
    if (automatic.logoDecoded !== "https://example.test/profile/arknights")
      fail(`Center-logo QR failed: ${JSON.stringify(automatic)}`);
    if (
      automatic.width !== automatic.height ||
      automatic.width >= 330 ||
      automatic.corner[0] < 245 ||
      automatic.corner[1] < 245 ||
      automatic.corner[2] < 245 ||
      automatic.bluePixels
    )
      fail(
        `Auto crop must be square, padded, and exclude nearby UI: ${JSON.stringify(automatic)}`,
      );
    if (automatic.quietModules < 4)
      fail(
        `Auto crop must preserve four clear modules: ${JSON.stringify(automatic)}`,
      );
    if (
      automatic.failure ||
      !automatic.message.includes("未找到") ||
      !automatic.edgeDetected
    )
      fail(`No-QR or edge behavior failed: ${JSON.stringify(automatic)}`);

    await page.evaluate(() => {
      window.manualPromise = window.qrModule.openCropEditor(
        window.qrFile,
        (canvas) => {
          window.manualCallback = canvas;
        },
      );
    });
    await page.waitForSelector(".qr-crop-box");
    const box = page.locator(".qr-crop-box");
    const initial = await box.boundingBox();
    await page.mouse.move(
      initial.x + initial.width / 2,
      initial.y + initial.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(
      initial.x + initial.width / 2 + 8,
      initial.y + initial.height / 2 + 8,
      { steps: 4 },
    );
    await page.mouse.up();
    const afterMouse = await box.boundingBox();
    await box.focus();
    await page.keyboard.press("ArrowRight");
    const moved = await box.boundingBox();
    const handle = await page.locator(".qr-crop-handle").boundingBox();
    await page.mouse.move(
      handle.x + handle.width / 2,
      handle.y + handle.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(
      handle.x + handle.width / 2 + 8,
      handle.y + handle.height / 2 + 8,
      { steps: 4 },
    );
    await page.mouse.up();
    const resized = await box.boundingBox();
    await page.locator("[data-confirm]").click();
    const manual = await page.evaluate(async () => {
      const result = await window.manualPromise;
      const canvas = window.manualCallback;
      const pixels = canvas
        .getContext("2d")
        .getImageData(0, 0, canvas.width, canvas.height);
      return {
        ok: result.ok,
        decoded: globalThis.jsQR(pixels.data, pixels.width, pixels.height, {
          inversionAttempts: "attemptBoth",
        })?.data,
      };
    });
    if (
      !manual.ok ||
      manual.decoded !== "https://example.test/profile/arknights"
    )
      fail(`Manual selection failed: ${JSON.stringify(manual)}`);
    if (
      initial.x === moved.x ||
      initial.width === resized.width ||
      initial.height === resized.height
    )
      fail("Mouse and keyboard did not change the selection geometry");
    if (afterMouse.x === moved.x)
      fail("Arrow key did not change the selection position");

    await page.evaluate(() => {
      window.canceledCallback = false;
      window.cancelPromise = window.qrModule.openCropEditor(
        window.qrFile,
        () => {
          window.canceledCallback = true;
        },
      );
    });
    await page.waitForSelector(".qr-crop-box");
    await page.locator("[data-cancel]").click();
    const canceled = await page.evaluate(async () => ({
      result: await window.cancelPromise,
      called: window.canceledCallback,
    }));
    if (canceled.result.ok || canceled.called)
      fail(`Cancel changed the QR slot: ${JSON.stringify(canceled)}`);

    const tiny = await page.evaluate(async () => {
      const canvas = document.createElement("canvas");
      canvas.width = 12;
      canvas.height = 9;
      canvas.getContext("2d").fillStyle = "#fff";
      canvas.getContext("2d").fillRect(0, 0, 12, 9);
      const file = await new Promise((resolve) =>
        canvas.toBlob((blob) =>
          resolve(new File([blob], "tiny.png", { type: "image/png" })),
        ),
      );
      window.tinyPromise = window.qrModule.openCropEditor(file);
    });
    await page.waitForSelector(".qr-crop-box");
    const tinyStage = await page.locator(".qr-crop-stage").boundingBox();
    const tinyBox = page.locator(".qr-crop-box");
    const tinyBefore = await tinyBox.boundingBox();
    await tinyBox.focus();
    for (const key of [
      "Shift+ArrowLeft",
      "Shift+ArrowRight",
      "Shift+ArrowUp",
      "Shift+ArrowDown",
    ])
      await page.keyboard.press(key);
    const tinyAfter = await tinyBox.boundingBox();
    await page.locator("[data-confirm]").click();
    const tinyResult = await page.evaluate(async () => {
      const canvas = (await window.tinyPromise).canvas;
      return { width: canvas.width, height: canvas.height };
    });
    if (
      tinyAfter.x < tinyStage.x ||
      tinyAfter.y < tinyStage.y ||
      tinyAfter.x + tinyAfter.width > tinyStage.x + tinyStage.width + 0.5 ||
      tinyAfter.y + tinyAfter.height > tinyStage.y + tinyStage.height + 0.5
    )
      fail(
        `Tiny selection is out of bounds: ${JSON.stringify({ tinyStage, tinyBefore, tinyAfter })}`,
      );
    if (tinyResult.width > 12 || tinyResult.height > 9)
      fail(
        `Tiny crop exceeds source: ${tinyResult.width}x${tinyResult.height}`,
      );
    if (pageErrors.length)
      fail(`Browser page errors: ${pageErrors.join("; ")}`);
    console.log(
      "QR browser behavior verified:",
      JSON.stringify({
        automatic,
        manual,
        canceledOk: !canceled.result.ok && !canceled.called,
        mouseMoved: initial.x !== moved.x,
        resized: initial.width !== resized.width,
        tinyCrop: [tinyResult.width, tinyResult.height],
      }),
    );
  } finally {
    await browser.close();
    server.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
  server.close();
});
