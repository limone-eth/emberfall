/** Shape of a volley. Every bullet's path is a pure function of this + time. */
export interface Pattern {
  count: number;
  /** radians between bullets */
  spread: number;
  speed: number;
  lifetime: number;
  radius: number;
  damage: [number, number];
  /** sideways sine wobble, in tiles */
  wave?: number;
  waveFreq?: number;
  pierce?: boolean;
  /** tiles/s^2, negative slows down */
  accel?: number;
}

export interface Volley extends Pattern {
  id: number;
  owner: number;
  team: 0 | 1;
  x: number;
  y: number;
  angle: number;
  t0: number;
  /** client-side id for the shooter's own predicted volley */
  cid?: number;
  color: number;
}

export function bulletAngle(v: Volley, i: number): number {
  return v.angle + (i - (v.count - 1) / 2) * v.spread;
}

export function bulletPos(v: Volley, i: number, t: number, out = { x: 0, y: 0 }): { x: number; y: number } {
  const s = Math.max(0, (t - v.t0) / 1000);
  const a = bulletAngle(v, i);
  const accel = v.accel ?? 0;
  const dist = Math.max(0, v.speed * s + 0.5 * accel * s * s);
  const ca = Math.cos(a), sa = Math.sin(a);
  let px = v.x + ca * dist, py = v.y + sa * dist;
  if (v.wave) {
    const side = (i % 2 === 0 ? 1 : -1) * v.wave * Math.sin(s * (v.waveFreq ?? 6) * Math.PI);
    px += -sa * side;
    py += ca * side;
  }
  out.x = px;
  out.y = py;
  return out;
}

export function volleyExpired(v: Volley, t: number): boolean {
  return t - v.t0 > v.lifetime;
}
