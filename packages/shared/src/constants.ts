export const TICK_RATE = 20;
export const TICK_MS = 1000 / TICK_RATE;
export const CLIENT_STEP_MS = 1000 / 60;
export const WORLD_SIZE = 384;
export const VIEW_RADIUS = 18;
export const VOLLEY_VIEW_RADIUS = VIEW_RADIUS + 12;
export const PLAYER_RADIUS = 0.35;
export const INTERP_DELAY_MS = 110;
export const MAX_LEVEL = 20;
export const PICKUP_RADIUS = 0.9;
export const XP_SHARE_RADIUS = 16;

export function xpToNext(level: number): number {
  return Math.round(40 + level * level * 18);
}
