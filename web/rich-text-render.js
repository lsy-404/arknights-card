const DEFAULT_FONT = 'Arial, "Microsoft YaHei", sans-serif';

function makeFont(run, options) {
  const size = Number(run.size) || options.fontSize;
  const bold = run.bold ?? options.bold;
  return { size, bold, font: `${bold ? '700 ' : ''}${size}px ${options.fontFamily}` };
}

function collectLines(ctx, runs, options) {
  const lines = [];
  let line = { parts: [], width: 0, maxSize: options.fontSize };
  const finish = () => {
    lines.push(line);
    line = { parts: [], width: 0, maxSize: options.fontSize };
  };

  for (const run of runs ?? []) {
    const text = String(run.text ?? '');
    const style = makeFont(run, options);
    let token = '';
    const flush = () => {
      if (!token) return;
      ctx.font = style.font;
      const tokenWidth = ctx.measureText(token).width;
      if (!options.singleLine && line.width > 0 && line.width + tokenWidth > options.width && !/^\s+$/.test(token)) finish();

      if (tokenWidth <= options.width || options.singleLine) {
        line.parts.push({ text: token, run, ...style, width: tokenWidth });
        line.width += tokenWidth;
        line.maxSize = Math.max(line.maxSize, style.size);
      } else {
        for (const character of token) {
          ctx.font = style.font;
          const width = ctx.measureText(character).width;
          if (!options.singleLine && line.width > 0 && line.width + width > options.width) finish();
          line.parts.push({ text: character, run, ...style, width });
          line.width += width;
          line.maxSize = Math.max(line.maxSize, style.size);
        }
      }
      token = '';
    };

    for (const character of text) {
      if (character === '\n') {
        flush();
        finish();
      } else if (/\s/.test(character)) {
        flush();
        token = character;
        flush();
      } else {
        token += character;
      }
    }
    flush();
  }
  if (line.parts.length || lines.length === 0) finish();
  return lines;
}

export function drawRichText(ctx, runs, {
  x, y, width, height, fontSize = 28, color = '#171918',
  fontFamily = DEFAULT_FONT, bold = false, lineHeight = 1.2, singleLine = false,
} = {}) {
  const options = { x, y, width, height, fontSize, color, fontFamily, bold, lineHeight, singleLine };
  let drawY = y;
  let drawnHeight = 0;
  let overflow = false;

  ctx.save();
  try {
    const lines = collectLines(ctx, runs, options);
    ctx.beginPath();
    ctx.rect(x, y, width, height);
    ctx.clip();
    ctx.textBaseline = 'alphabetic';

    for (const line of lines) {
      const lineSize = line.maxSize || fontSize;
      const lineStep = lineSize * lineHeight;
      if (drawY + lineStep > y + height) {
        overflow = true;
        break;
      }
      const baseline = drawY + lineSize * 0.82;
      let drawX = x;
      for (const part of line.parts) {
        ctx.font = part.font;
        ctx.fillStyle = part.run.color || color;
        ctx.fillText(part.text, drawX, baseline);
        const decorationY = baseline + part.size * (part.run.underline ? 0.08 : 0.02);
        ctx.lineWidth = Math.max(1, part.size / 18);
        ctx.strokeStyle = part.run.color || color;
        if (part.run.underline) {
          ctx.beginPath();
          ctx.moveTo(drawX, decorationY);
          ctx.lineTo(drawX + part.width, decorationY);
          ctx.stroke();
        }
        if (part.run.strike) {
          const strikeY = baseline - part.size * 0.3;
          ctx.beginPath();
          ctx.moveTo(drawX, strikeY);
          ctx.lineTo(drawX + part.width, strikeY);
          ctx.stroke();
        }
        drawX += part.width;
      }
      drawY += lineStep;
      drawnHeight += lineStep;
      if (singleLine) {
        overflow = lines.length > 1 || line.width > width;
        break;
      }
    }
  } finally {
    ctx.restore();
  }
  return { height: drawnHeight, overflow };
}
