#!/usr/bin/env node
// Review sheet: every sprite at a given scale, on its home biome tile.
//   node tools/sprite-sheet.mjs <out.png> [--scale 3]
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { PNG } from "pngjs";
const args = process.argv.slice(2), out = args[0];
const si = args.indexOf("--scale"), SC = si >= 0 ? Number(args[si + 1]) : 3;
const HOME = { emberwright: "sand", wayfinder: "sand", bulwark: "sand", tidecrab: "sand", dunewisp: "sand", thornling: "meadow", mossback: "meadow",
  hollowstag: "woods", bramblewitch: "woods", cragsentinel: "highland", ashenreaver: "ashland", colossus: "ashland", rock: "highland", tree: "meadow", obsidian: "ashland", bag: "woods" };
const order = Object.keys(HOME);
const load = (p) => PNG.sync.read(readFileSync(p));
const sprites = order.map((n) => ({ n, png: load(`packages/client/public/sprites/${n}.png`), tile: load(`packages/client/public/tiles/${HOME[n]}-0.png`) }));
const CELL = 96 + 16, cols = 4, rows = Math.ceil(sprites.length / cols);
const W = cols * CELL * SC, H = rows * CELL * SC, o = new PNG({ width: W, height: H });
o.data.fill(20); for (let i = 3; i < o.data.length; i += 4) o.data[i] = 255;
sprites.forEach(({ png, tile }, k) => {
  const cx = (k % cols) * CELL, cy = Math.floor(k / cols) * CELL, ox = cx + 8 + (96 - png.width) / 2, oy = cy + 8 + (96 - png.height) / 2;
  for (let y = 0; y < 96; y++) for (let x = 0; x < 96; x++) {
    let s = tile.data.subarray(((y % 32) * 32 + (x % 32)) * 4, ((y % 32) * 32 + (x % 32)) * 4 + 4);
    const sx = cx + 8 + x - ox, sy = cy + 8 + y - oy;
    if (sx >= 0 && sy >= 0 && sx < png.width && sy < png.height) { const i = (sy * png.width + sx) * 4; if (png.data[i + 3]) s = png.data.subarray(i, i + 4); }
    for (let dy = 0; dy < SC; dy++) for (let dx = 0; dx < SC; dx++) o.data.set(s, (((cy + 8 + y) * SC + dy) * W + (cx + 8 + x) * SC + dx) * 4);
  }
});
writeFileSync(out, PNG.sync.write(o)); console.log(out, order.join(" "));
