# Emberfall

An online, permadeath, top-down bullet-hell co-op game for the browser. You wash ashore on an island, and the monsters get harder the closer you walk to the burning core. If you die, that hero is gone for good: you get fame and a line in the graveyard.

## Run it

```bash
pnpm install
pnpm build          # build the client into packages/client/dist
pnpm start          # server + built client on http://localhost:8080
```

To work on it, run `pnpm dev`. The server reloads on change (:8080) and Vite serves the client with hot reload on http://localhost:5173. Vite forwards `/ws` to the server.

Checks: `pnpm typecheck`, `pnpm test`.

Environment: `PORT` (8080), `WORLD_SEED` (20261031), `DB_PATH` (`packages/server/emberfall.db`).

## Controls

WASD to move, aim with the mouse, hold the left button to fire, and press `T` to toggle autofire. You pick up loot by walking over a bag. A weapon is equipped only if it fits your class and is a higher tier than yours.

## Architecture

```
packages/
  shared/   rules both sides run: world gen, movement, bullet paths, game data, protocol
  server/   authoritative 20 Hz simulation, WebSocket, SQLite (node:sqlite)
  client/   PixiJS 8 renderer, prediction, interpolation, HTML HUD
```

- **The server decides everything.** Hits, damage, XP, loot and death are all decided on the server. The client sends only movement inputs and the angle of each shot.
- **Bullets are deterministic.** Each shot is one *volley* event (origin, angle, start time and pattern), and `bulletPos()` computes any bullet's position at any moment. The server sends one message per volley instead of updating every bullet each tick.
- **Your own movement responds instantly.** The client moves you as soon as you press a key, sends numbered inputs at 60 Hz, and corrects itself when the server confirms them. The server also caps how far you can move per tick, which stops speed hacks.
- **Other entities are smoothed.** Other players and monsters are drawn about 110 ms in the past and blended between server updates. Clocks are synced with ping/pong using the median of recent samples.
- **Players only get nearby data.** Each player receives entities within 18 tiles and volleys within 30 tiles. Lookups use a spatial grid.
- **The world is generated from a seed.** Both the server and the client build the 384×384 island from the same seed with FastNoiseLite, so no map data is sent. The biome rings from coast to core are Sand → Meadow → Woods → Highland → Ashland, with tiers 0–4.
- **Monsters stay in their ring.** A monster cannot leave the biome ring it spawned in, so core monsters never reach the beach. The Cinder Colossus lives in the core and respawns 3 minutes after it dies.

Decisions are recorded in `docs/decisions/`. Agent skills for this stack are in `.claude/skills/`.

## Next

- Account vault: items that survive death
- A binary protocol: about 13 KB/s per player today as JSON
- Effekseer WebGL effects for spells and boss phases
- A boss "director" on a slow decision model (for example Jev) that picks Colossus phases every few seconds, outside the 20 Hz loop
- Optional Apple on-device model sidecar for flavor text: taunts and epitaphs
- One process per realm, plus a nexus or hub
