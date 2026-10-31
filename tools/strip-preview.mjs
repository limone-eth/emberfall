#!/usr/bin/env node
// Preview animation frames: one row per creature (<dir>/<id>-<view>-0..3.png) on its home tile, plus the approved still.
//   node tools/strip-preview.mjs <dir> <out.png> <id...> [--scale 3] [--view front|back|side]
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { PNG } from "pngjs";
const a = process.argv.slice(2), si = a.indexOf("--scale"), SC = si >= 0 ? +a[si + 1] : 3, vi = a.indexOf("--view"), VIEW = vi >= 0 ? a[vi + 1] : "front";
const [dir, out, ...ids] = a.filter((x, i) => !x.startsWith("--") && a[i - 1] !== "--scale" && a[i - 1] !== "--view");
const HOME = { emberwright: "sand", wayfinder: "sand", bulwark: "sand", tidecrab: "sand", dunewisp: "sand", thornling: "meadow", mossback: "meadow", hollowstag: "woods", bramblewitch: "woods", cragsentinel: "highland", ashenreaver: "ashland", colossus: "ashland" };
const load = (p) => PNG.sync.read(readFileSync(p));
const rows = ids.map((id) => ({ id, still: load(`packages/client/public/sprites/${id}.png`), frames: [0, 1, 2, 3].map((k) => `${dir}/${id}-${VIEW}-${k}.png`).filter(existsSync).map(load), tile: load(`packages/client/public/tiles/${HOME[id] ?? "sand"}-0.png`) }));
const C = 100, W = 5 * C * SC, H = rows.length * C * SC, o = new PNG({ width: W, height: H });
o.data.fill(20); for (let i = 3; i < o.data.length; i += 4) o.data[i] = 255;
rows.forEach((r, ri) => [r.still, ...r.frames].forEach((p, ci) => {
  for (let y = 0; y < 96; y++) for (let x = 0; x < 96; x++) {
    const ox = (96 - p.width) >> 1, oy = (96 - p.height) >> 1; let s = r.tile.data.subarray(((y % 32) * 32 + x % 32) * 4, ((y % 32) * 32 + x % 32) * 4 + 4);
    const sx = x - ox, sy = y - oy; if (sx >= 0 && sy >= 0 && sx < p.width && sy < p.height && p.data[(sy * p.width + sx) * 4 + 3]) s = p.data.subarray((sy * p.width + sx) * 4, (sy * p.width + sx) * 4 + 4);
    for (let dy = 0; dy < SC; dy++) for (let dx = 0; dx < SC; dx++) o.data.set(s, (((ri * C + 2 + y) * SC + dy) * W + (ci * C + 2 + x) * SC + dx) * 4);
  }
}));
writeFileSync(out, PNG.sync.write(o)); console.log(out);
