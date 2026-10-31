#!/usr/bin/env node
// Split a GPT animation strip (N frames in a row on magenta) into N square frames with one
// shared scale and ground line, then clean each frame with sprite-clean.
//   node tools/strip-split.mjs <strip.png> <outPrefix> --size 32 [--frames 4] [--outline]
// Writes <outPrefix>-0.png .. -(N-1).png.
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PNG } from "pngjs";

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const [src, prefix] = args.filter((a, i) => !a.startsWith("--") && !(i > 0 && args[i - 1].startsWith("--") && !["--outline"].includes(args[i - 1])));
const N = Number(opt("--frames", "4")), SIZE = opt("--size", "32"), OUTLINE = args.includes("--outline");
const img = PNG.sync.read(readFileSync(src)), { width: W, height: H, data } = img;
const keyPx = (i) => data[i + 3] < 128 || (data[i] > 170 && data[i + 2] > 170 && data[i + 1] < 110 && Math.abs(data[i] - data[i + 2]) < 90);
// GPT sometimes adds solid letterbox bars at the edges. The usable area is the band between the
// first and last rows/columns that are mostly magenta; everything outside it is background.
const magRow = (y) => { let m = 0; for (let x = 0; x < W; x++) if (keyPx((y * W + x) * 4)) m++; return m > W * 0.5; };
const magCol = (x) => { let m = 0; for (let y = 0; y < H; y++) if (keyPx((y * W + x) * 4)) m++; return m > H * 0.5; };
let ry0 = 0, ry1 = H - 1, rx0 = 0, rx1 = W - 1;
while (ry0 < H - 1 && !magRow(ry0)) ry0++; while (ry1 > 0 && !magRow(ry1)) ry1--;
while (rx0 < W - 1 && !magCol(rx0)) rx0++; while (rx1 > 0 && !magCol(rx1)) rx1--;
// Skip the blended edge rows/columns next to a bar.
if (ry0 > 0) ry0 += 4; if (ry1 < H - 1) ry1 -= 4; if (rx0 > 0) rx0 += 4; if (rx1 < W - 1) rx1 -= 4;
const isKey = (i) => { const p = i / 4, x = p % W, y = (p - x) / W; return keyPx(i) || y < ry0 || y > ry1 || x < rx0 || x > rx1; };

// Column occupancy (ignore columns with only a few stray pixels).
const col = new Array(W).fill(0); let y0 = H, y1 = -1;
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (!isKey((y * W + x) * 4)) col[x]++;
const segs = []; let start = -1;
for (let x = 0; x <= W; x++) {
  const on = x < W && col[x] > 2;
  if (on && start < 0) start = x;
  if (!on && start >= 0) { segs.push([start, x - 1]); start = -1; }
}
// Merge segments split by small gaps until N remain.
const gap = W * 0.02;
for (let i = segs.length - 1; i > 0; i--) if (segs[i][0] - segs[i - 1][1] < gap) { segs[i - 1][1] = segs[i][1]; segs.splice(i, 1); }
const frames = segs.sort((a, b) => (b[1] - b[0]) - (a[1] - a[0])).slice(0, N).sort((a, b) => a[0] - b[0]);
if (frames.length !== N) { console.error(`found ${frames.length} frames, expected ${N}`); process.exit(1); }
for (const [a, b] of frames) for (let y = 0; y < H; y++) for (let x = a; x <= b; x++) if (!isKey((y * W + x) * 4)) { y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
const side = Math.max(y1 - y0 + 1, ...frames.map(([a, b]) => b - a + 1)) + 2;
const tmp = mkdtempSync(join(tmpdir(), "strip-"));
frames.forEach(([a, b], k) => {
  const o = new PNG({ width: side, height: side });
  const ox = Math.round((a + b) / 2 - side / 2), oy = y1 + 1 - side; // shared ground line at the bottom
  for (let y = 0; y < side; y++) for (let x = 0; x < side; x++) {
    const X = ox + x, Y = oy + y, t = (y * side + x) * 4;
    if (X < a - 1 || X > b + 1 || X < 0 || Y < 0 || X >= W || Y >= H) { o.data.set([255, 0, 255, 255], t); continue; }
    o.data.set(data.subarray((Y * W + X) * 4, (Y * W + X) * 4 + 4), t);
  }
  const f = join(tmp, `f${k}.png`); writeFileSync(f, PNG.sync.write(o));
  const cl = ["tools/sprite-clean.mjs", f, `${prefix}-${k}.png`, "--size", SIZE, "--nocrop"];
  if (OUTLINE) cl.push("--outline");
  process.stdout.write(execFileSync("node", cl).toString());
});
