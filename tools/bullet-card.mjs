#!/usr/bin/env node
// Bullet readability card: every enemy bullet (style guide section 4) on every biome ground,
// at 64 px per tile like the game on a laptop screen. Rows = grounds, columns = enemies.
//   node tools/bullet-card.mjs <out.png>
import { readFileSync, writeFileSync } from "node:fs";
import { PNG } from "pngjs";
const ENEMY = { tidecrab: 0xe0795b, dunewisp: 0x7fd6ff, thornling: 0x9bc53d, mossback: 0x5f7f3a, hollowstag: 0xc9b38f, bramblewitch: 0xb07fd6, cragsentinel: 0x8d99ae, ashenreaver: 0xd64545, colossus: 0xff4d1f };
const RADIUS = { tidecrab: 0.22, dunewisp: 0.22, thornling: 0.22, mossback: 0.28, hollowstag: 0.18, bramblewitch: 0.22, cragsentinel: 0.26, ashenreaver: 0.22, colossus: 0.32 };
const GROUNDS = ["sand", "meadow", "woods", "highland", "ashland"];
const TP = 64, CELL = 96, cols = Object.keys(ENEMY).length;
const o = new PNG({ width: cols * CELL, height: GROUNDS.length * CELL });
const rgb = (c) => [(c >> 16) & 255, (c >> 8) & 255, c & 255, 255];
const core = (c) => ((c & 0xff) > 0xc0 && ((c >> 16) & 0xff) < 0x90 ? 0xd9f5ff : 0xf3e9dc); // same rule as game.ts
GROUNDS.forEach((g, r) => {
  const tile = PNG.sync.read(readFileSync(`packages/client/public/tiles/${g}-0.png`));
  Object.entries(ENEMY).forEach(([id, color], c) => {
    const R = RADIUS[id] * 1.15 * TP, px = TP / 32;
    for (let y = 0; y < CELL; y++) for (let x = 0; x < CELL; x++) {
      const tx = Math.floor(x / 2) % 32, ty = Math.floor(y / 2) % 32; // ground at 2x = 64 px per tile
      let p = [...tile.data.subarray((ty * 32 + tx) * 4, (ty * 32 + tx) * 4 + 4)];
      const d = Math.hypot(x + 0.5 - CELL / 2, y + 0.5 - CELL / 2);
      if (d < R - 3 * px) p = rgb(core(color)); else if (d < R - 2 * px) p = rgb(color); else if (d < R) p = rgb(0x14100e);
      o.data.set(p, ((r * CELL + y) * o.width + c * CELL + x) * 4);
    }
  });
});
writeFileSync(process.argv[2], PNG.sync.write(o)); console.log(process.argv[2]);
