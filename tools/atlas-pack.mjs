#!/usr/bin/env node
// Pack every sprite and tile into one atlas + a PixiJS spritesheet JSON.
//   node tools/atlas-pack.mjs [--preview docs/art/previews/atlas.png]
// Inputs: packages/client/public/{sprites,tiles,frames}/*.png
// Output: packages/client/public/atlas.png, atlas.json (frame names = file names without .png)
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { PNG } from "pngjs";

const PUB = "packages/client/public";
const MAX = 2048, PAD = 2;
const args = process.argv.slice(2);
const pi = args.indexOf("--preview");
const PREVIEW = pi >= 0 ? args[pi + 1] : null;

const items = [];
for (const dir of ["sprites", "tiles", "frames"]) {
  const d = `${PUB}/${dir}`;
  if (!existsSync(d)) continue;
  for (const f of readdirSync(d).filter((f) => f.endsWith(".png")).sort()) {
    const png = PNG.sync.read(readFileSync(`${d}/${f}`));
    items.push({ name: f.slice(0, -4), png, w: png.width, h: png.height });
  }
}
// Shelf packing, tallest first.
items.sort((a, b) => b.h - a.h || b.w - a.w);
let x = 0, y = 0, shelf = 0, W = 0;
for (const it of items) {
  if (x + it.w > MAX) { x = 0; y += shelf + PAD; shelf = 0; }
  it.x = x; it.y = y; x += it.w + PAD; shelf = Math.max(shelf, it.h); W = Math.max(W, x);
}
const H = y + shelf;
const pow2 = (n) => 2 ** Math.ceil(Math.log2(Math.max(n, 1)));
const AW = pow2(W), AH = pow2(H);
if (AW > MAX || AH > MAX) { console.error(`atlas ${AW}x${AH} is larger than ${MAX}`); process.exit(1); }

const out = new PNG({ width: AW, height: AH });
const frames = {};
for (const it of items) {
  for (let yy = 0; yy < it.h; yy++) for (let xx = 0; xx < it.w; xx++) {
    const s = (yy * it.w + xx) * 4, t = ((it.y + yy) * AW + it.x + xx) * 4;
    out.data.set(it.png.data.subarray(s, s + 4), t);
  }
  frames[it.name] = { frame: { x: it.x, y: it.y, w: it.w, h: it.h }, sourceSize: { w: it.w, h: it.h }, spriteSourceSize: { x: 0, y: 0, w: it.w, h: it.h } };
}
writeFileSync(`${PUB}/atlas.png`, PNG.sync.write(out));
writeFileSync(`${PUB}/atlas.json`, JSON.stringify({ frames, meta: { image: "atlas.png", size: { w: AW, h: AH }, scale: 1 } }, null, 1));
console.log(`atlas ${AW}x${AH}, ${items.length} frames`);

if (PREVIEW) {
  const sc = 3, bg = [0x2a, 0x20, 0x1c];
  const p = new PNG({ width: AW * sc, height: AH * sc });
  for (let yy = 0; yy < AH * sc; yy++) for (let xx = 0; xx < AW * sc; xx++) {
    const s = (Math.floor(yy / sc) * AW + Math.floor(xx / sc)) * 4, t = (yy * AW * sc + xx) * 4;
    if (out.data[s + 3]) p.data.set(out.data.subarray(s, s + 4), t); else p.data.set([...bg, 255], t);
  }
  writeFileSync(PREVIEW, PNG.sync.write(p));
  console.log(`preview: ${PREVIEW}`);
}
