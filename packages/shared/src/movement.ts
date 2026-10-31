import { PLAYER_RADIUS } from "./constants.ts";
import { isSolid, tileAt, Tile, type World } from "./world.ts";

function blocked(w: World, x: number, y: number, r: number): boolean {
  return (
    isSolid(w, x - r, y - r) || isSolid(w, x + r, y - r) ||
    isSolid(w, x - r, y + r) || isSolid(w, x + r, y + r)
  );
}

/**
 * Deterministic player step, shared by client prediction and the server.
 * mx/my is the raw input direction (-1..1); speed in tiles/s.
 */
export function stepPlayer(
  w: World, pos: { x: number; y: number }, mx: number, my: number, speed: number, dtMs: number,
): void {
  let len = Math.hypot(mx, my);
  if (len < 1e-6) return;
  if (len > 1) { mx /= len; my /= len; len = 1; }
  const slow = tileAt(w, pos.x, pos.y) === Tile.Shallows ? 0.55 : 1;
  const d = speed * slow * (dtMs / 1000);
  const nx = pos.x + mx * d;
  if (!blocked(w, nx, pos.y, PLAYER_RADIUS)) pos.x = nx;
  const ny = pos.y + my * d;
  if (!blocked(w, pos.x, ny, PLAYER_RADIUS)) pos.y = ny;
}

export function moveEntity(w: World, pos: { x: number; y: number }, dx: number, dy: number, r: number): boolean {
  let moved = false;
  if (!blocked(w, pos.x + dx, pos.y, r)) { pos.x += dx; moved = true; }
  if (!blocked(w, pos.x, pos.y + dy, r)) { pos.y += dy; moved = true; }
  return moved;
}
