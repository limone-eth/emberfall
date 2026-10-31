#!/usr/bin/env node
// Turn an AI draft into a true pixel-art sprite.
//   node tools/sprite-clean.mjs <draft.png> <out.png> [--size 16] [--preview out@8x.png]
// Steps: key out the magenta background, crop to content, resample to an N×N grid by
// majority vote per cell (no averaging), snap every pixel to docs/art/palette.json,
// and drop isolated stray pixels. Output has only palette colors and alpha 0 or 255.
import { readFileSync, writeFileSync } from "node:fs";
import { PNG } from "pngjs";

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : def; };
const [src, out] = args.filter((a, i) => !a.startsWith("--") && !(i > 0 && args[i - 1].startsWith("--")));
if (!src || !out) { console.error("usage: sprite-clean <draft.png> <out.png> [--size 16] [--preview p.png]"); process.exit(2); }
let SIZE = opt("--size", "16");
const PREVIEW = opt("--preview");
const OUTLINE = args.includes("--outline");
const NOCROP = args.includes("--nocrop"); // the input is already a square frame: keep its framing (used for animation strips) // fit art in SIZE-2 and close the ink outline outside it

const palette = Object.values(JSON.parse(readFileSync(new URL("../docs/art/palette.json", import.meta.url))).colors)
  .map((h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);

// Perceptual-ish distance (weighted RGB, "redmean").
function dist(a, b) {
  const rm = (a[0] + b[0]) / 2, dr = a[0] - b[0], dg = a[1] - b[1], db = a[2] - b[2];
  return (2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db;
}
const nearest = (c) => { let bi = 0, bd = Infinity; palette.forEach((p, i) => { const d = dist(c, p); if (d < bd) { bd = d; bi = i; } }); return bi; };
const isKey = (r, g, b) => r > 170 && b > 170 && g < 110 && Math.abs(r - b) < 90; // magenta-ish

const img = PNG.sync.read(readFileSync(src));
const { width: W, height: H, data } = img;

// 1. alpha mask + bbox
let x0 = W, y0 = H, x1 = -1, y1 = -1;
const solid = new Uint8Array(W * H);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const i = (y * W + x) * 4;
  if (data[i + 3] < 128 || isKey(data[i], data[i + 1], data[i + 2])) continue;
  solid[y * W + x] = 1;
  if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
}
if (x1 < 0) { console.error("no sprite content found"); process.exit(1); }

// 2. square crop around the content, so aspect is kept
const side = NOCROP ? Math.min(W, H) : Math.max(x1 - x0 + 1, y1 - y0 + 1);
const cx = NOCROP ? W / 2 : (x0 + x1 + 1) / 2, cy = NOCROP ? H / 2 : (y0 + y1 + 1) / 2;
const sx = cx - side / 2, sy = cy - side / 2;
// --size auto: find the draft's own pixel grid (the N where cells are most uniform).
function disagreement(N) {
  const c = side / N; let bad = 0, n = 0;
  for (let gy = 0; gy < N; gy++) for (let gx = 0; gx < N; gx++) {
    const ax = sx + gx * c, ay = sy + gy * c, pad = c * 0.15, seen = new Map(); let t = 0;
    for (let y = Math.floor(ay + pad); y < ay + c - pad; y += Math.max(1, c / 6)) for (let x = Math.floor(ax + pad); x < ax + c - pad; x += Math.max(1, c / 6)) {
      const X = Math.floor(x), Y = Math.floor(y); if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
      const i = (Y * W + X) * 4, k = solid[Y * W + X] ? nearest([data[i], data[i + 1], data[i + 2]]) : -1;
      seen.set(k, (seen.get(k) ?? 0) + 1); t++;
    }
    if (!t) continue; bad += t - Math.max(...seen.values()); n += t;
  }
  return bad / n;
}
if (SIZE === "auto") {
  let best = 16, bs = Infinity;
  for (let N = 12; N <= 40; N++) { const d = disagreement(N); if (d < bs - 0.004) { bs = d; best = N; } }
  SIZE = best; console.log(`detected grid: ${best} px (disagreement ${(bs * 100).toFixed(1)}%)`);
} else SIZE = Number(SIZE);
const FIT = OUTLINE ? SIZE - 2 : SIZE;
const cell = side / FIT;

// 3. majority vote per cell over palette indices
const grid = new Int16Array(SIZE * SIZE).fill(-1);
const OFF = OUTLINE ? 1 : 0;
for (let gy = 0; gy < FIT; gy++) for (let gx = 0; gx < FIT; gx++) {
  const votes = new Map(); let empty = 0, total = 0;
  // sample the inner 60% of the cell to avoid edge bleed
  const ax = sx + gx * cell, ay = sy + gy * cell, pad = cell * 0.2;
  for (let y = Math.floor(ay + pad); y < Math.ceil(ay + cell - pad); y++) for (let x = Math.floor(ax + pad); x < Math.ceil(ax + cell - pad); x++) {
    total++;
    if (x < 0 || y < 0 || x >= W || y >= H || !solid[y * W + x]) { empty++; continue; }
    const i = (y * W + x) * 4;
    const k = nearest([data[i], data[i + 1], data[i + 2]]);
    votes.set(k, (votes.get(k) ?? 0) + 1);
  }
  if (empty > total / 2) continue;
  let best = -1, bv = -1; for (const [k, v] of votes) if (v > bv) { bv = v; best = k; }
  grid[(gy + OFF) * SIZE + gx + OFF] = best;
}

// 4. drop isolated opaque pixels (no orthogonal opaque neighbour)
for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
  if (grid[y * SIZE + x] < 0) continue;
  const n = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => { const X = x + dx, Y = y + dy; return X >= 0 && Y >= 0 && X < SIZE && Y < SIZE && grid[Y * SIZE + X] >= 0; });
  if (n.length === 0) grid[y * SIZE + x] = -1;
}

// 5. --outline: a transparent pixel next to a non-ink opaque pixel becomes ink.
if (OUTLINE) {
  const INK = palette.findIndex((p) => p.join() === "20,16,14");
  const add = [];
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    if (grid[y * SIZE + x] >= 0) continue;
    if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => { const X = x + dx, Y = y + dy; const k = X >= 0 && Y >= 0 && X < SIZE && Y < SIZE ? grid[Y * SIZE + X] : -1; return k >= 0 && k !== INK; })) add.push(y * SIZE + x);
  }
  for (const i of add) grid[i] = INK;
}

function write(path, scale) {
  const o = new PNG({ width: SIZE * scale, height: SIZE * scale });
  for (let y = 0; y < SIZE * scale; y++) for (let x = 0; x < SIZE * scale; x++) {
    const k = grid[Math.floor(y / scale) * SIZE + Math.floor(x / scale)], i = (y * SIZE * scale + x) * 4;
    if (k < 0) { o.data[i + 3] = 0; continue; }
    [o.data[i], o.data[i + 1], o.data[i + 2]] = palette[k]; o.data[i + 3] = 255;
  }
  writeFileSync(path, PNG.sync.write(o));
}
write(out, 1);
if (PREVIEW) write(PREVIEW, 8);
const used = new Set([...grid].filter((k) => k >= 0));
console.log(`${out}: ${SIZE}x${SIZE}, ${used.size} palette colors, ${[...grid].filter((k) => k >= 0).length} opaque px`);
