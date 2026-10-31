// Sprite renderer: loads the atlas built by tools/atlas-pack.mjs and makes sprites in tile units.
// If the atlas fails to load, loadArt() returns null and the game uses the vector shapes in draw.ts.
import { Assets, Container, Graphics, Sprite, type Spritesheet, type Texture } from "pixi.js";
import { Tile, hash2, ENEMIES, type World } from "@emberfall/shared";
import { CHUNK, TIER_COLORS } from "./draw.ts";

export const ART_PX = 32; // texture pixels per tile

/** Creature views: front = walking down, back = walking up, side = walking right (mirrored for left). */
export type View = "front" | "back" | "side";

export interface Art {
  tex(name: string): Texture | undefined;
  /** Walk/idle frames for a creature in one view (4 when present, else front frames, else the still). */
  frames(id: string, view?: View): Texture[];
}

export async function loadArt(): Promise<Art | null> {
  try {
    const sheet = (await Assets.load("atlas.json")) as Spritesheet;
    sheet.textureSource.scaleMode = "nearest";
    const t = sheet.textures;
    const cache = new Map<string, Texture[]>();
    const art: Art = {
      tex: (n) => t[n],
      frames(id, view = "front") {
        const key = `${id}-${view}`;
        const hit = cache.get(key);
        if (hit) return hit;
        let f: Texture[] = [0, 1, 2, 3].map((k) => t[`${key}-${k}`]).filter(Boolean);
        if (f.length === 0 && view !== "front") f = art.frames(id, "front");
        if (f.length === 0 && t[id]) f = [t[id]];
        cache.set(key, f);
        return f;
      },
    };
    return art;
  } catch (err) {
    console.warn("[art] atlas failed to load, using vector shapes", err);
    return null;
  }
}

const GROUND: Record<number, string> = {
  [Tile.DeepWater]: "deepwater", [Tile.Shallows]: "shallows", [Tile.Sand]: "sand", [Tile.Meadow]: "meadow",
  [Tile.Woods]: "woods", [Tile.Highland]: "highland", [Tile.Ashland]: "ashland",
  // Obstacles stand on the ground of their biome.
  [Tile.Rock]: "highland", [Tile.Tree]: "woods", [Tile.Obsidian]: "ashland",
};
const OBSTACLE: Record<number, string> = { [Tile.Rock]: "rock", [Tile.Tree]: "tree", [Tile.Obsidian]: "obsidian" };

/** An obstacle stands on the ground of a walkable neighbor (else its biome default). */
function groundUnder(w: World, x: number, y: number, t: number): number {
  for (let r = 1; r <= 3; r++) for (const [dx, dy] of [[-r, 0], [0, -r], [r, 0], [0, r], [-r, -r], [r, r], [r, -r], [-r, r]]) {
    const X = x + dx, Y = y + dy;
    if (X < 0 || Y < 0 || X >= w.size || Y >= w.size) continue;
    const n = w.tiles[Y * w.size + X];
    if (!OBSTACLE[n] && n !== Tile.DeepWater && n !== Tile.Shallows) return n;
  }
  return t;
}

function tileSprite(tex: Texture, x: number, y: number): Sprite {
  const s = new Sprite(tex);
  s.position.set(x, y);
  s.scale.set(1 / ART_PX);
  return s;
}

/** One chunk of terrain as sprites, in tile units. */
export function buildChunkSprites(art: Art, w: World, cx: number, cy: number): Container {
  const c = new Container();
  const x0 = cx * CHUNK, y0 = cy * CHUNK;
  const obstacles: Sprite[] = [];
  for (let y = y0; y < y0 + CHUNK && y < w.size; y++) {
    for (let x = x0; x < x0 + CHUNK && x < w.size; x++) {
      const t = w.tiles[y * w.size + x];
      const v = Math.floor(hash2(x, y, w.seed) * 3);
      const g = art.tex(`${GROUND[OBSTACLE[t] ? groundUnder(w, x, y, t) : t]}-${v}`);
      if (g) c.addChild(tileSprite(g, x, y));
      const ob = OBSTACLE[t] && art.tex(OBSTACLE[t]);
      if (ob) obstacles.push(tileSprite(ob, x, y));
    }
  }
  for (const o of obstacles) c.addChild(o); // obstacles above all ground in the chunk
  return c;
}

/** Texture size in tiles (32 px = 1 tile). */
export const tilesOf = (tex: Texture): number => tex.width / ART_PX;

/** A creature view: soft ground shadow + animated sprite. */
export class CreatureSprite {
  readonly view = new Container();
  readonly sprite: Sprite;
  private shadow = new Graphics();
  private views: Record<View, Texture[]>;
  private view_: View = "front";
  private facing = 1; // 1 = right, -1 = left (side view only)
  private t = Math.random() * 1000;
  private readonly idleLoop: boolean;

  constructor(art: Art, id: string, radius: number) {
    this.views = { front: art.frames(id, "front"), back: art.frames(id, "back"), side: art.frames(id, "side") };
    this.sprite = new Sprite(this.views.front[0]);
    this.sprite.anchor.set(0.5);
    this.sprite.scale.set(1 / ART_PX);
    const size = tilesOf(this.views.front[0]);
    this.shadow.ellipse(0, size * 0.36, radius * 0.95, radius * 0.35).fill({ color: 0x14100e, alpha: 0.28 });
    this.view.addChild(this.shadow, this.sprite);
    // Creatures that never walk loop their frames all the time.
    this.idleLoop = id === "dunewisp" || id === "cragsentinel" || ENEMIES[id]?.speed === 0;
  }

  /**
   * dx, dy: movement direction this frame (any scale; +y is down); moving: true while walking.
   * The larger axis picks the view; an idle creature keeps its last view and facing.
   */
  update(dtMs: number, dx: number, dy: number, moving: boolean): void {
    if (moving && (dx !== 0 || dy !== 0)) {
      if (Math.abs(dx) >= Math.abs(dy)) { this.view_ = "side"; this.facing = dx < 0 ? -1 : 1; }
      else this.view_ = dy < 0 ? "back" : "front";
    }
    const frames = this.views[this.view_];
    const animate = moving || this.idleLoop;
    if (animate) this.t += dtMs;
    const k = animate ? Math.floor(this.t / (this.idleLoop && !moving ? 180 : 130)) % frames.length : 0;
    this.sprite.texture = frames[k];
    this.sprite.scale.x = (this.view_ === "side" ? this.facing : 1) / ART_PX;
  }
}

/** Loot bag sprite; the rim glow carries the tier color (one bag sprite for all tiers). */
export function bagView(art: Art, desc: string, soulbound: boolean): Container | null {
  const tex = art.tex("bag");
  if (!tex || desc === "potion") return null;
  const c = new Container();
  const tier = Number(desc.slice(1, 2)) || 0;
  const glow = new Graphics();
  if (soulbound) glow.circle(0, 0, 0.5).fill({ color: 0xf6e27a, alpha: 0.25 });
  glow.ellipse(0, 0.22, 0.34, 0.12).fill({ color: TIER_COLORS[tier], alpha: 0.7 });
  const s = new Sprite(tex);
  s.anchor.set(0.5);
  s.scale.set(0.75 / ART_PX);
  c.addChild(glow, s);
  return c;
}
