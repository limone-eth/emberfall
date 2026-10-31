// Draws one Emberfall test scene (16x9 tiles) in three styles.
// Pixel styles render the same shapes at low resolution, snap every pixel to the palette, then upscale with no smoothing.
const PAL = {
  sand: "#d8c08a", sandD: "#c4a96f", meadow: "#6aa84f", meadowD: "#55913d", water: "#2e6e8e", waterL: "#4c90ad",
  treeD: "#1d3a1c", tree: "#2a5a28", treeL: "#3f7a39", rock: "#5e5a52", rockL: "#7c776c",
  ember: "#ff8a3d", emberL: "#ffd08a", ink: "#14100e", white: "#f3e9dc",
  crab: "#e0795b", crabD: "#8a3d2b", wisp: "#7fd6ff", wispL: "#d9f5ff", thorn: "#9bc53d", thornD: "#56701f",
  bulletE: "#ff3d5a", bag: "#6b4a2b", tier: "#6fb7ff", flower: "#f6e27a",
};
function hexToRgb(h) { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
const PAL_RGB = Object.values(PAL).map(hexToRgb);

function hash(x, y) { let h = (x * 374761393 + y * 668265263) >>> 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }

function drawScene(ctx, T, smooth) {
  const W = 16, H = 9;
  const c = (col) => (ctx.fillStyle = col);
  const circ = (x, y, r, col) => { c(col); ctx.beginPath(); ctx.arc(x * T, y * T, r * T, 0, Math.PI * 2); ctx.fill(); };
  const poly = (pts, col) => { c(col); ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x * T, y * T) : ctx.moveTo(x * T, y * T))); ctx.closePath(); ctx.fill(); };
  // ground
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const meadow = x + Math.sin(y * 0.9) * 0.8 > 8.5;
    const water = x + y * 0.6 < 3.2;
    const h = hash(x, y);
    c(water ? (h < 0.5 ? PAL.water : PAL.waterL) : meadow ? (h < 0.6 ? PAL.meadow : PAL.meadowD) : (h < 0.6 ? PAL.sand : PAL.sandD));
    ctx.fillRect(x * T, y * T, T + 0.5, T + 0.5);
    if (meadow && h > 0.9) circ(x + 0.5, y + 0.5, 0.08, PAL.flower);
  }
  // obstacles
  for (const [x, y] of [[12, 1], [13, 2], [14, 5], [11, 7], [15, 7]]) {
    circ(x + 0.5, y + 0.62, 0.44, PAL.treeD); circ(x + 0.5, y + 0.45, 0.42, PAL.tree); circ(x + 0.36, y + 0.34, 0.15, PAL.treeL);
  }
  for (const [x, y] of [[5, 1], [7, 7]]) {
    poly([[x + 0.1, y + 0.85], [x + 0.25, y + 0.25], [x + 0.6, y + 0.1], [x + 0.92, y + 0.45], [x + 0.85, y + 0.88]], PAL.rock);
    poly([[x + 0.25, y + 0.3], [x + 0.6, y + 0.15], [x + 0.7, y + 0.42], [x + 0.35, y + 0.5]], PAL.rockL);
  }
  // bag
  ctx.fillStyle = PAL.bag; ctx.fillRect(8.25 * T, 5.8 * T, 0.5 * T, 0.42 * T); circ(8.5, 6.0, 0.09, PAL.tier);
  // enemies
  circ(3.0, 3.7, 0.5, PAL.ink); circ(3.0, 3.7, 0.42, PAL.crab); circ(2.5, 3.35, 0.17, PAL.crabD); circ(3.5, 3.35, 0.17, PAL.crabD);
  circ(10.5, 3.2, 0.5, PAL.wispL); circ(10.5, 3.2, 0.36, PAL.wisp); circ(10.5, 3.2, 0.15, PAL.white);
  { const cx = 12.4, cy = 5.4, pts = []; for (let i = 0; i < 16; i++) { const r = i % 2 ? 0.26 : 0.5, a = (i / 16) * Math.PI * 2; pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } poly(pts, PAL.thornD); }
  { const cx = 12.4, cy = 5.4, pts = []; for (let i = 0; i < 16; i++) { const r = i % 2 ? 0.2 : 0.4, a = (i / 16) * Math.PI * 2; pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } poly(pts, PAL.thorn); }
  // player
  circ(6.5, 4.5, 0.42, PAL.ink); circ(6.5, 4.5, 0.34, PAL.ember); circ(6.4, 4.4, 0.12, PAL.emberL);
  ctx.fillStyle = PAL.white; ctx.fillRect(6.85 * T, 4.44 * T, 0.5 * T, 0.12 * T);
  // bullets: enemy (ring from wisp, aimed from crab), player embers
  for (let i = 0; i < 5; i++) { const a = Math.PI * 0.8 + i * 0.22; const x = 10.5 + Math.cos(a) * (1.4 + i * 0.1), y = 3.2 + Math.sin(a) * 1.4; circ(x, y, 0.2, PAL.ink); circ(x, y, 0.15, PAL.bulletE); circ(x, y, 0.06, PAL.white); }
  for (const [x, y] of [[4.6, 4.0], [5.3, 4.25]]) { circ(x, y, 0.2, PAL.ink); circ(x, y, 0.15, PAL.bulletE); circ(x, y, 0.06, PAL.white); }
  for (const [x, y] of [[8.0, 4.3], [8.0, 4.7], [9.1, 4.15], [9.1, 4.85]]) { circ(x, y, 0.16, PAL.emberL); circ(x, y, 0.1, PAL.ember); }
}

function quantize(ctx, w, h) {
  const img = ctx.getImageData(0, 0, w, h), d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    let best = 0, bd = Infinity;
    for (let k = 0; k < PAL_RGB.length; k++) { const p = PAL_RGB[k]; const e = (d[i] - p[0]) ** 2 + (d[i + 1] - p[1]) ** 2 + (d[i + 2] - p[2]) ** 2; if (e < bd) { bd = e; best = k; } }
    [d[i], d[i + 1], d[i + 2]] = PAL_RGB[best]; d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}

export function render(canvas, style) {
  const out = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;
  if (style === "vector") { drawScene(out, W / 16, true); return; }
  const T = style === "px8" ? 8 : 16;
  const off = document.createElement("canvas"); off.width = 16 * T; off.height = 9 * T;
  const o = off.getContext("2d");
  drawScene(o, T, false);
  quantize(o, off.width, off.height);
  out.imageSmoothingEnabled = false;
  out.drawImage(off, 0, 0, W, H);
}
