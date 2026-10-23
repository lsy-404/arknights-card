export function markerSeed() {
  return crypto.getRandomValues(new Uint32Array(1))[0];
}

export function drawMarker(ctx, x, y, width, height, color, seed = 1) {
  const style = markerStyle(seed);
  ctx.save();
  ctx.translate(x + width / 2, y + height / 2);
  ctx.rotate(style.tilt);
  ctx.globalAlpha = style.opacity;
  ctx.fillStyle = color;
  ctx.beginPath();
  const first = style.points[0];
  ctx.moveTo((first[0] - 50) * width / 100, (first[1] - 50) * height / 100);
  for (const [px, py] of style.points.slice(1)) ctx.lineTo((px - 50) * width / 100, (py - 50) * height / 100);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function markerStyle(seed = 1) {
  let state = seed >>> 0 || 1;
  const random = () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 4294967296;
  };
  const tilt = (random() - 0.5) * 0.065;
  const opacity = 0.48 + random() * 0.14;
  const points = [[0, 10 + random() * 9]];
  for (let i = 1; i < 7; i++) points.push([i * 14.285, 9 + random() * 12]);
  points.push([100, 10 + random() * 9]);
  for (let i = 6; i >= 1; i--) points.push([i * 14.285, 83 + random() * 12]);
  points.push([0, 82 + random() * 12]);
  return { tilt, opacity, points };
}
