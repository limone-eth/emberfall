#!/usr/bin/env node
// Build a reference strip for GPT image edit: 4 copies of a sprite, scaled up, on magenta, with gaps.
//   node tools/strip-ref.mjs <sprite.png> <out.png> [--copies 4]
import { readFileSync, writeFileSync } from "node:fs";
import { PNG } from "pngjs";
const a = process.argv.slice(2), ci = a.indexOf("--copies"), N = ci >= 0 ? +a[ci + 1] : 4;
const p = PNG.sync.read(readFileSync(a[0]));
const SC = Math.floor(384 / p.width), cell = p.width * SC, gap = Math.round(cell * 0.35);
const W = N * cell + (N + 1) * gap, H = cell + 2 * gap, o = new PNG({ width: W, height: H });
for (let i = 0; i < W * H; i++) o.data.set([255, 0, 255, 255], i * 4);
for (let k = 0; k < N; k++) for (let y = 0; y < cell; y++) for (let x = 0; x < cell; x++) {
  const s = (Math.floor(y / SC) * p.width + Math.floor(x / SC)) * 4;
  if (p.data[s + 3]) o.data.set(p.data.subarray(s, s + 4), ((gap + y) * W + gap + k * (cell + gap) + x) * 4);
}
writeFileSync(a[1], PNG.sync.write(o));
