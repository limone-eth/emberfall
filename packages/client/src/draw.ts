import { Graphics } from "pixi.js";
import { Tile, hash2, type World, type EnemyDef } from "@emberfall/shared";

export const TILE_COLORS: Record<number, number> = {
  [Tile.DeepWater]: 0x163352, [Tile.Shallows]: 0x2e6e8e, [Tile.Sand]: 0xd8c08a, [Tile.Meadow]: 0x6aa84f,
  [Tile.Woods]: 0x3d6b38, [Tile.Highland]: 0x8a8270, [Tile.Ashland]: 0x4a3a36,
  [Tile.Rock]: 0x8a8270, [Tile.Tree]: 0x3d6b38, [Tile.Obsidian]: 0x4a3a36,
};

function shade(c: number, f: number): number {
  const r = Math.min(255, ((c >> 16) & 255) * f), g = Math.min(255, ((c >> 8) & 255) * f), b = Math.min(255, (c & 255) * f);
  return (r << 16) | (g << 8) | b;
}

export const CHUNK = 16;

/** One chunk of terrain as static Graphics, in tile units (the world layer is scaled). */
export function buildChunk(w: World, cx: number, cy: number): Graphics {
  const g = new Graphics();
  const x0 = cx * CHUNK, y0 = cy * CHUNK;
  for (let y = y0; y < y0 + CHUNK && y < w.size; y++) {
    for (let x = x0; x < x0 + CHUNK && x < w.size; x++) {
      const t = w.tiles[y * w.size + x];
      const j = 0.96 + hash2(x, y, w.seed) * 0.07;
      g.rect(x, y, 1.02, 1.02).fill(shade(TILE_COLORS[t], j));
    }
  }
  // Obstacles on top.
  for (let y = y0; y < y0 + CHUNK && y < w.size; y++) {
    for (let x = x0; x < x0 + CHUNK && x < w.size; x++) {
      const t = w.tiles[y * w.size + x];
      const h = hash2(x + 7, y + 3, w.seed);
      if (t === Tile.Tree) {
        g.circle(x + 0.5, y + 0.62, 0.42).fill(0x1d3a1c);
        g.circle(x + 0.5, y + 0.45, 0.4 + h * 0.06).fill(0x2a5a28);
        g.circle(x + 0.38, y + 0.36, 0.14).fill(0x3f7a39);
      } else if (t === Tile.Rock) {
        g.poly([x + 0.1, y + 0.8, x + 0.25, y + 0.25, x + 0.6, y + 0.1, x + 0.92, y + 0.45, x + 0.85, y + 0.85]).fill(0x5e5a52);
        g.poly([x + 0.25, y + 0.3, x + 0.6, y + 0.15, x + 0.7, y + 0.4, x + 0.35, y + 0.5]).fill(0x7c776c);
      } else if (t === Tile.Obsidian) {
        g.poly([x + 0.5, y + 0.05, x + 0.9, y + 0.5, x + 0.5, y + 0.95, x + 0.1, y + 0.5]).fill(0x16101a);
        g.poly([x + 0.5, y + 0.15, x + 0.7, y + 0.45, x + 0.5, y + 0.5]).fill(0x5a3b6b);
      } else if (t === Tile.Ashland && h < 0.05) {
        g.circle(x + 0.5, y + 0.5, 0.12).fill(0xff6a2a); // ember vent
      } else if (t === Tile.Meadow && h < 0.06) {
        g.circle(x + h * 10, y + 0.5, 0.06).fill(0xf6e27a); // flowers
      }
    }
  }
  return g;
}

/** Enemy body drawn at origin, in tile units. */
export function drawEnemy(g: Graphics, def: EnemyDef): void {
  const r = def.radius, c = def.color, dark = shade(c, 0.55);
  g.clear();
  switch (def.shape) {
    case "crab":
      g.ellipse(0, 0, r, r * 0.7).fill(c).stroke({ color: dark, width: 0.06 });
      g.circle(-r * 1.05, -r * 0.4, r * 0.32).fill(dark); g.circle(r * 1.05, -r * 0.4, r * 0.32).fill(dark);
      break;
    case "wisp":
      g.circle(0, 0, r * 1.5).fill({ color: c, alpha: 0.18 });
      g.circle(0, 0, r).fill(c);
      g.circle(0, 0, r * 0.45).fill(0xffffff);
      break;
    case "thorn":
      g.star(0, 0, 8, r * 1.2, r * 0.6).fill(c).stroke({ color: dark, width: 0.05 });
      break;
    case "brute":
      g.roundRect(-r, -r * 0.85, r * 2, r * 1.7, r * 0.4).fill(c).stroke({ color: dark, width: 0.08 });
      g.circle(-r * 0.4, -r * 0.2, r * 0.13).fill(0xffe28a); g.circle(r * 0.4, -r * 0.2, r * 0.13).fill(0xffe28a);
      break;
    case "stag":
      g.poly([0, -r * 1.2, r, r * 0.8, -r, r * 0.8]).fill(c).stroke({ color: dark, width: 0.06 });
      g.poly([-r * 0.3, -r * 0.9, -r * 0.9, -r * 1.7, -r * 0.5, -r * 0.8]).fill(dark);
      g.poly([r * 0.3, -r * 0.9, r * 0.9, -r * 1.7, r * 0.5, -r * 0.8]).fill(dark);
      break;
    case "witch":
      g.poly([0, -r * 1.3, r, 0, 0, r * 1.1, -r, 0]).fill(c).stroke({ color: dark, width: 0.06 });
      g.circle(0, -r * 0.1, r * 0.25).fill(0x2a0f3a);
      break;
    case "sentinel":
      g.regularPoly(0, 0, r, 6).fill(c).stroke({ color: dark, width: 0.1 });
      g.circle(0, 0, r * 0.35).fill(0x9be7ff);
      break;
    case "reaver":
      g.poly([0, -r * 1.3, r * 0.9, r, 0, r * 0.4, -r * 0.9, r]).fill(c).stroke({ color: 0x220000, width: 0.06 });
      break;
    case "colossus":
      g.circle(0, 0, r * 1.25).fill({ color: c, alpha: 0.15 });
      g.star(0, 0, 10, r, r * 0.72).fill(0x3a1a12).stroke({ color: c, width: 0.12 });
      g.circle(0, 0, r * 0.45).fill(c);
      g.circle(0, 0, r * 0.2).fill(0xfff1b8);
      break;
  }
}

export const TIER_COLORS = [0xd8d8d8, 0x7bd88f, 0x6fb7ff, 0xc38bff, 0xffc94a];

export function drawBag(g: Graphics, desc: string, soulbound: boolean): void {
  g.clear();
  if (soulbound) g.circle(0, 0, 0.45).fill({ color: 0xffc94a, alpha: 0.25 });
  if (desc === "potion") {
    g.circle(0, 0.06, 0.2).fill(0xe04848).stroke({ color: 0x2a0a0a, width: 0.04 });
    g.rect(-0.06, -0.24, 0.12, 0.12).fill(0xcfc2b0);
  } else {
    const tier = Number(desc.slice(1, 2));
    g.roundRect(-0.24, -0.2, 0.48, 0.42, 0.08).fill(0x6b4a2b).stroke({ color: TIER_COLORS[tier], width: 0.06 });
    g.circle(0, 0, 0.08).fill(TIER_COLORS[tier]);
  }
}
