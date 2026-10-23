const SLIDERS = [
  {
    key: "spending",
    title: "关于氪金",
    left: "0氪",
    mid: "微氪",
    right: "重氪",
    value: 35,
  },
  {
    key: "goods",
    title: "关于吃谷",
    left: "不太吃",
    mid: "理性吃",
    right: "为爱买单",
    value: 72,
  },
  {
    key: "story",
    title: "关于剧情",
    left: "剧情跳过",
    mid: "感兴趣会看",
    right: "剧情党",
    value: 36,
  },
  {
    key: "tone",
    title: "剧情偏好",
    left: "温馨日常",
    mid: "",
    right: "宏大悲壮",
    value: 18,
  },
  {
    key: "meta",
    title: "更偏向于",
    left: "XP",
    mid: "",
    right: "强度",
    value: 0,
  },
  {
    key: "shipping",
    title: "关系偏好",
    left: "CB",
    mid: "",
    right: "CP",
    value: 40,
  },
  {
    key: "roguelike",
    title: "集成战略",
    left: "几乎不碰",
    mid: "为了奖励打",
    right: "深度沉迷",
    value: 50,
  },
];

const logoMasks = new WeakMap();

function logoMask(image, onDark) {
  if (logoMasks.has(image)) return logoMasks.get(image);
  const mask = document.createElement("canvas");
  mask.width = image.naturalWidth;
  mask.height = image.naturalHeight;
  const context = mask.getContext("2d");
  context.drawImage(image, 0, 0);
  if (onDark) {
    const pixels = context.getImageData(0, 0, mask.width, mask.height);
    for (let i = 0; i < pixels.data.length; i += 4) {
      pixels.data[i + 3] *= (pixels.data[i] + pixels.data[i + 1] + pixels.data[i + 2]) / 765;
    }
    context.putImageData(pixels, 0, 0);
  }
  context.globalCompositeOperation = "source-in";
  context.fillStyle = "#171918";
  context.fillRect(0, 0, mask.width, mask.height);
  logoMasks.set(image, mask);
  return mask;
}

export function createSliderControls(container, onChange) {
  container.innerHTML = SLIDERS.map(
    (item) =>
      `<label class="slider-row"><span class="slider-name">${item.title}<small>${item.mid || "拖动选择"}</small></span><span class="slider-control"><input type="range" min="0" max="100" step="1" name="${item.key}" value="${item.value}" aria-label="${item.title}"><span class="slider-ends"><span>${item.left}</span><span>${item.right}</span></span></span></label>`,
  ).join("");
  container.addEventListener("input", onChange);
  return SLIDERS;
}

export function drawProfile(
  canvas,
  profile,
  faction,
  operators = [],
  images = {},
) {
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const scale = w / 900;
  ctx.save();
  ctx.scale(scale, scale);
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, 900, 1280);
  const accent = faction?.color || "#57a9c7";
  const line = (x1, y1, x2, y2, color = "#161918", width = 1) => {
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  };
  const text = (
    value,
    x,
    y,
    size = 15,
    color = "#171918",
    weight = 400,
    font = "Noto Sans SC, sans-serif",
  ) => {
    ctx.fillStyle = color;
    ctx.font = `${weight} ${size}px ${font}`;
    ctx.fillText(String(value || ""), x, y);
  };
  const wrap = (
    value,
    x,
    y,
    maxWidth,
    lineHeight,
    size = 13,
    color = "#303532",
    maxLines = 4,
  ) => {
    ctx.fillStyle = color;
    ctx.font = `400 ${size}px Noto Sans SC, sans-serif`;
    let row = "",
      count = 0;
    for (const paragraph of String(value || "").split(/\r?\n/)) {
      for (const ch of paragraph) {
        const test = row + ch;
        if (ctx.measureText(test).width > maxWidth && row) {
          text(row, x, y + count * lineHeight, size, color);
          row = ch;
          if (++count >= maxLines) return;
        } else row = test;
      }
      if (row && count < maxLines) {
        text(row, x, y + count * lineHeight, size, color);
        row = "";
        count++;
      }
      if (count >= maxLines) return;
    }
  };
  ctx.fillStyle = accent;
  ctx.fillRect(65, 60, 6, 42);
  ctx.fillStyle = "#171918";
  ctx.fillRect(65, 24, 75, 24);
  text("个人档案", 70, 41, 11, "#fff", 700);
  text("PERSONAL PROFILE", 65, 67, 10, "#171918", 700, "DM Sans, sans-serif");
  text("DATA NUMBER", 765, 36, 9, "#898d89", 400, "DM Mono, monospace");
  text(
    faction?.code || "RI-01",
    765,
    61,
    20,
    "#171918",
    700,
    "DM Mono, monospace",
  );
  line(65, 82, 835, 82, "#171918", 2);
  const nickname = profile.nickname || "此处填写名字";
  text("DR.", 65, 159, 56, "#171918", 400, "DM Sans, sans-serif");
  textFit(nickname, 163, 156, 37, 420, "#858986", 700);
  text("DOCTOR", 67, 179, 14, "#171918", 700, "DM Sans, sans-serif");
  // The faction mark remains identifiable when its local image cannot be decoded.
  const logo = images.logo;
  if (logo?.complete && logo.naturalWidth) {
    drawContain(ctx, logoMask(logo, faction?.logoOnDark), 66, 202, 82, 82);
  } else {
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.moveTo(107, 199);
    ctx.lineTo(148, 276);
    ctx.lineTo(67, 276);
    ctx.closePath();
    ctx.fill();
    text(
      faction?.name?.slice(0, 2) || "RI",
      88,
      249,
      18,
      "#fff",
      700,
      "DM Sans, sans-serif",
    );
  }
  wrap(faction?.name || "RHODES ISLAND", 163, 224, 280, 20, 14, "#2c302d", 2);
  wrap(faction?.en || "PERSONAL PROFILE", 163, 249, 280, 17, 10, "#8b908b", 2);
  wrap(
    profile.quote ?? faction?.quote ?? "",
    163,
    274,
    310,
    16,
    12,
    "#3c413d",
    2,
  );
  const av = images.avatar;
  ctx.save();
  ctx.beginPath();
  ctx.rect(590, 110, 230, 230);
  ctx.clip();
  ctx.fillStyle = "#ededeb";
  ctx.fillRect(590, 110, 230, 230);
  if (av) {
    drawCover(ctx, av, 590, 110, 230, 230);
  } else {
    ctx.fillStyle = "#c8cac6";
    ctx.fillRect(610, 130, 190, 190);
    text("此处头像", 650, 235, 24, "#626762", 500);
  }
  ctx.restore();
  ctx.strokeStyle = "#171918";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(578, 119);
  ctx.lineTo(578, 102);
  ctx.lineTo(595, 102);
  ctx.moveTo(815, 347);
  ctx.lineTo(832, 347);
  ctx.lineTo(832, 330);
  ctx.stroke();
  sectionTag(65, 330, "基础信息");
  line(176, 348, 835, 348, "#171918", 1);
  const row = (label, value, y) => {
    text("▪", 68, y, 14, accent, 700);
    text(label, 88, y, 13, "#6b706b", 500);
    textFit(value || "—", 177, y, 13, 258, "#171918", 600);
  };
  row("性别", profile.gender, 382);
  row("想扩列", (profile.contacts || []).join(" / "), 411);
  row("所在区服", profile.server, 440);
  row("当前资历", profile.seniority, 469);
  row("游戏 UID", profile.uid, 498);
  row("更侧重", (profile.focus || []).join(" / "), 527);
  sectionTag(65, 560, "详细资料");
  line(176, 578, 835, 578, "#171918", 1);
  text("About me", 76, 603, 13, "#171918", 700, "DM Sans, sans-serif");
  wrap(
    profile.bio || "在这里写下关于博士的介绍。",
    76,
    628,
    294,
    19,
    12,
    "#444945",
    4,
  );
  text("我推的角色 / CP / CB", 416, 603, 12, "#171918", 600);
  line(416, 610, 820, 610, "#929792", 1);
  wrap(profile.oshi || "写下你的喜爱", 416, 632, 400, 18, 12, "#454a46", 2);
  operators.slice(0, 8).forEach((op, i) => {
    const x = 416 + (i % 4) * 96,
      y = 660 + Math.floor(i / 4) * 83;
    const img = images.operators?.get(op.id);
    ctx.fillStyle = "#eceeeb";
    ctx.fillRect(x, y, 68, 68);
    if (img?.complete && img.naturalWidth) drawCover(ctx, img, x, y, 68, 68);
    else {
      textFit(op.name, x + 4, y + 37, 11, 60, "#444", 500);
    }
    textFit(op.name, x, y + 80, 9, 68, "#555b56", 400);
  });
  const sliderLabels = {
    spending: ["0氪", "微氪", "重氪"],
    goods: ["不太吃", "理性吃", "为爱买单"],
    story: ["剧情跳过", "感兴趣会看", "剧情党"],
    tone: ["温馨日常", "均衡", "宏大悲壮"],
    meta: ["XP", "均衡", "强度"],
    shipping: ["CB", "均衡", "CP"],
    roguelike: ["几乎不碰", "为了奖励打", "深度沉迷"],
  };
  const sliderKeys = [
    "spending",
    "goods",
    "story",
    "tone",
    "meta",
    "shipping",
    "roguelike",
  ];
  const sliderY = 708;
  sliderKeys.forEach((key, i) => {
    const y = sliderY + i * 60;
    const titles = [
      "氪金倾向",
      "吃谷习惯",
      "剧情习惯",
      "剧情偏好",
      "培养取向",
      "关系偏好",
      "集成战略",
    ];
    text(titles[i], 76, y, 11, "#262b27", 600);
    const x1 = 77,
      x2 = 350,
      yy = y + 17;
    line(x1, yy, x2, yy, "#414642", 2);
    [0, 0.5, 1].forEach((v) => {
      const x = x1 + (x2 - x1) * v;
      line(x, yy - 4, x, yy + 5, "#414642", 1);
    });
    const val =
      Math.max(0, Math.min(100, Number(profile.sliders?.[key] ?? 50))) / 100;
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(x1 + (x2 - x1) * val, yy, 6, 0, Math.PI * 2);
    ctx.fill();
    const labels = sliderLabels[key];
    text(labels[0], x1, y + 36, 9, "#737973");
    text(
      labels[2],
      x2 - ctx.measureText(labels[2]).width,
      y + 36,
      9,
      "#737973",
    );
  });
  // Right-side detail rail and contact codes.
  line(390, 590, 390, 1164, "#d9dbd7", 1);
  text("CONTACT", 416, 840, 9, "#898e89", 400, "DM Mono, monospace");
  const qrBlocks = [
    ["微信", images.qrWechat],
    ["QQ", images.qrQq],
  ];
  qrBlocks.forEach(([label, img], i) => {
    const x = 416 + i * 185,
      y = 860;
    ctx.fillStyle = "#f2f3f1";
    ctx.fillRect(x, y, 150, 150);
    if (img) drawContain(ctx, img, x + 5, y + 5, 140, 140);
    else {
      text("二维码", x + 48, y + 81, 12, "#9da19d", 500);
    }
    text(label, x, y + 168, 10, "#505650", 500);
  });
  sectionTag(416, 1061, "补充");
  wrap(profile.extra || "—", 416, 1088, 400, 18, 11, "#434843", 4);
  if (faction?.logo) {
    const img = images.logo;
    if (img?.complete && img.naturalWidth) {
      ctx.globalAlpha = 0.12;
      drawContain(ctx, logoMask(img, faction?.logoOnDark), 570, 1040, 240, 190);
      ctx.globalAlpha = 1;
    }
  }
  line(65, 1190, 835, 1190, "#171918", 3);
  text("原作 Sayoko.  ·  非官方非商业同人作品", 65, 1220, 10, "#666c67", 400);
  text("素材：鹰角网络 / PRTS", 65, 1243, 9, "#858a85", 400);
  wrap(
    profile.quote ?? faction?.quote ?? "",
    467,
    1210,
    355,
    14,
    11,
    "#373c38",
    3,
  );
  ctx.restore();
  function sectionTag(x, y, label) {
    ctx.fillStyle = "#171918";
    ctx.fillRect(x, y - 17, 106, 22);
    text(label, x + 8, y, 12, "#fff", 700);
  }
  function textFit(
    value,
    x,
    y,
    size,
    maxWidth,
    color = "#171918",
    weight = 400,
  ) {
    let fitted = size;
    ctx.font = `${weight} ${fitted}px Noto Sans SC, sans-serif`;
    while (
      ctx.measureText(String(value || "")).width > maxWidth &&
      fitted > 8
    ) {
      fitted--;
      ctx.font = `${weight} ${fitted}px Noto Sans SC, sans-serif`;
    }
    ctx.fillStyle = color;
    ctx.fillText(String(value || ""), x, y, maxWidth);
  }
}

export function drawCover(ctx, image, x, y, w, h) {
  const ratio = Math.max(w / image.width, h / image.height),
    dw = image.width * ratio,
    dh = image.height * ratio;
  ctx.drawImage(image, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}
export function drawContain(ctx, image, x, y, w, h) {
  const ratio = Math.min(w / image.width, h / image.height),
    dw = image.width * ratio,
    dh = image.height * ratio,
    smoothing = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(image, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  ctx.imageSmoothingEnabled = smoothing;
}
export function imageFromFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("图片无法读取，请选择有效的图片文件。"));
    };
    image.src = url;
  });
}
