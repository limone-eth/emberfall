# What do we build next for Emberfall?

Decided: 2026-10-31 · Case: c_8257771f-c499-4aff-a3c3-c9ec31c30798

## Question and choice
After the vertical slice, what is the next milestone: playtest build, content depth, art pass, or scale?

Choice: "Art pass: style guide and sprite families with the create-game-assets skill".

## Why
- The human chose to make the game look like a real game before other work.
- The slice draws everything as vector shapes. A locked style and sprite families make every later piece of content cheaper to add with the same look.

## Constraints
- All art is original. No assets, names or look copied from Realm of the Mad God or any other game.
- Gameplay readability comes first: enemy bullets must stay high-contrast on every biome; player, enemy and loot silhouettes must stay distinct at the game zoom (about 30 to 40 px per tile).
- Hitboxes do not change. Sprites follow the radii in `packages/shared/src/data.ts`.
- One small texture atlas, loaded with PixiJS `Assets`. The client stays light for the browser.
- The vector-shape renderer stays as a fallback until every sprite exists.

## Ruled out
- Playtest build (recommended by the agent): postponed. The unfair-dodge bug is still open.
- Content depth: postponed until the look is locked.
- Scale and netcode: there are no real players yet.

## Comments
- The agent recommended the playtest build first, because an unfair dodge is the worst bug in a permadeath game. The human chose the art pass. The dodge fix stays at the top of the backlog.

## Open questions
- Pixel art or clean vector style.
- Pixel scale per tile (for example 8, 16 or 32 px).
- Where the images come from: AI generation (which tool), hand-drawn, or code-generated.

## Sources
- Case c_8257771f-c499-4aff-a3c3-c9ec31c30798
- `.claude/skills/create-game-assets/SKILL.md`
- `packages/client/src/draw.ts` (current vector renderer)
- `packages/shared/src/data.ts` (entity radii and colors)
