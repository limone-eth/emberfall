/// <reference path="./fastnoise-lite.d.ts" />
import FastNoiseLite from "fastnoise-lite";
import { WORLD_SIZE } from "./constants.ts";
import { hash2 } from "./rng.ts";

export const Tile = {
  DeepWater: 0,
  Shallows: 1,
  Sand: 2,
  Meadow: 3,
  Woods: 4,
  Highland: 5,
  Ashland: 6,
  Rock: 7,
  Tree: 8,
  Obsidian: 9,
} as const;
export type TileId = (typeof Tile)[keyof typeof Tile];

const SOLID = new Set<number>([Tile.DeepWater, Tile.Rock, Tile.Tree, Tile.Obsidian]);

export interface World {
  seed: number;
  size: number;
  tiles: Uint8Array;
  /** 0 (shore) .. 4 (ashen core) per tile, 255 for water. */
  tier: Uint8Array;
}

/** Normalised distance from the centre: 0 at the core, ~1 at the coast. */
function radial(x: number, y: number, size: number): number {
  const c = size / 2;
  return Math.hypot(x - c, y - c) / c;
}

export function generateWorld(seed: number, size = WORLD_SIZE): World {
  const shape = new FastNoiseLite(seed);
  shape.SetNoiseType(FastNoiseLite.NoiseType.OpenSimplex2);
  shape.SetFractalType(FastNoiseLite.FractalType.FBm);
  shape.SetFractalOctaves(4);
  shape.SetFrequency(0.012);

  const clutter = new FastNoiseLite(seed + 1);
  clutter.SetNoiseType(FastNoiseLite.NoiseType.OpenSimplex2);
  clutter.SetFrequency(0.08);

  const warp = new FastNoiseLite(seed + 2);
  warp.SetNoiseType(FastNoiseLite.NoiseType.OpenSimplex2);
  warp.SetFrequency(0.02);

  const tiles = new Uint8Array(size * size);
  const tier = new Uint8Array(size * size);
  const c = size / 2;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      const d = radial(x, y, size);
      const land = 1 - d * 1.05 + shape.GetNoise(x, y) * 0.22;
      if (land < 0.02) { tiles[i] = Tile.DeepWater; tier[i] = 255; continue; }
      if (land < 0.06) { tiles[i] = Tile.Shallows; tier[i] = 255; continue; }

      // Biome rings are warped so they don't look like perfect circles.
      const bd = d + warp.GetNoise(x, y) * 0.07;
      let base: number, t: number;
      if (bd > 0.78) { base = Tile.Sand; t = 0; }
      else if (bd > 0.58) { base = Tile.Meadow; t = 1; }
      else if (bd > 0.38) { base = Tile.Woods; t = 2; }
      else if (bd > 0.18) { base = Tile.Highland; t = 3; }
      else { base = Tile.Ashland; t = 4; }
      tier[i] = t;

      // Obstacles: clusters from noise plus sparse scatter. Keep the core arena open.
      const n = clutter.GetNoise(x, y);
      const r = hash2(x, y, seed);
      const coreArena = Math.hypot(x - c, y - c) < 14;
      let tile = base;
      if (!coreArena) {
        if (base === Tile.Woods && (n > 0.45 || r < 0.04)) tile = Tile.Tree;
        else if (base === Tile.Meadow && (n > 0.7 || r < 0.012)) tile = Tile.Tree;
        else if (base === Tile.Highland && (n > 0.5 || r < 0.02)) tile = Tile.Rock;
        else if (base === Tile.Ashland && (n > 0.6 || r < 0.015)) tile = Tile.Obsidian;
        else if (base === Tile.Sand && r < 0.006) tile = Tile.Rock;
      }
      tiles[i] = tile;
    }
  }
  return { seed, size, tiles, tier };
}

export function tileAt(w: World, x: number, y: number): number {
  const tx = Math.floor(x), ty = Math.floor(y);
  if (tx < 0 || ty < 0 || tx >= w.size || ty >= w.size) return Tile.DeepWater;
  return w.tiles[ty * w.size + tx];
}

export function isSolid(w: World, x: number, y: number): boolean {
  return SOLID.has(tileAt(w, x, y));
}

export function tierAt(w: World, x: number, y: number): number {
  const tx = Math.floor(x), ty = Math.floor(y);
  if (tx < 0 || ty < 0 || tx >= w.size || ty >= w.size) return 255;
  return w.tier[ty * w.size + tx];
}

/** Bullets fly over water but stop at rocks, trees and obsidian. */
export function blocksBullets(w: World, x: number, y: number): boolean {
  const t = tileAt(w, x, y);
  return t === Tile.Rock || t === Tile.Tree || t === Tile.Obsidian;
}

/** Walkable shore tiles, used as spawn points. */
export function shoreSpawns(w: World): Array<{ x: number; y: number }> {
  const out: Array<{ x: number; y: number }> = [];
  for (let y = 0; y < w.size; y += 3) {
    for (let x = 0; x < w.size; x += 3) {
      const i = y * w.size + x;
      if (w.tiles[i] === Tile.Sand && radial(x, y, w.size) > 0.82) out.push({ x: x + 0.5, y: y + 0.5 });
    }
  }
  return out;
}
