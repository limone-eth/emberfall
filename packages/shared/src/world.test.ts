import { test } from "node:test";
import assert from "node:assert/strict";
import { generateWorld, shoreSpawns, isSolid, tierAt } from "./world.ts";
import { bulletPos, type Volley } from "./bullets.ts";

test("world gen is deterministic and has every biome tier", () => {
  const t0 = performance.now();
  const a = generateWorld(1234);
  const ms = performance.now() - t0;
  const b = generateWorld(1234);
  assert.deepEqual(a.tiles, b.tiles);
  const counts = [0, 0, 0, 0, 0];
  for (const t of a.tier) if (t < 5) counts[t]++;
  console.log("gen ms", ms.toFixed(0), "tier counts", counts);
  for (const c of counts) assert.ok(c > 500);
});

test("shore spawns exist and are walkable", () => {
  const w = generateWorld(99);
  const s = shoreSpawns(w);
  assert.ok(s.length > 50, `spawns ${s.length}`);
  for (const p of s) { assert.ok(!isSolid(w, p.x, p.y)); assert.equal(tierAt(w, p.x, p.y), 0); }
});

test("bullet path is a pure function of volley and time", () => {
  const v: Volley = { id: 1, owner: 1, team: 0, x: 10, y: 10, angle: 0, t0: 1000, count: 3, spread: 0.1,
    speed: 10, lifetime: 1000, radius: 0.2, damage: [1, 2], color: 0 };
  const p = bulletPos(v, 1, 1500);
  assert.ok(Math.abs(p.x - 15) < 1e-9 && Math.abs(p.y - 10) < 1e-9);
});
