# Emberfall art direction: style, source, mood and motion?

Decided: 2026-10-31 · Case: c_cf2dd4ab-5b9d-4c9c-af12-c7f0bd85778b

## Question and choice
Which art direction do we use for the art pass?

- Style: "Detailed pixel art at 16 px per tile, scaled up about 2.5 times".
- Source: "GPT Image 2 drafts via your ChatGPT plan; I snap them to the grid and palette with a script and fix them by hand".
- Mood: "Warm: a sunny shore that turns to ash and embers toward the core (the current palette)".
- Motion: "One frame per sprite; code adds bob, squash, hit flash and particles".

## Why
- 16 px keeps a crisp pixel look and has enough pixels for clear silhouettes. At 8 px the Thornling lost its spikes on the style board.
- GPT Image 2 runs on the existing ChatGPT plan, so there is no cost per image. The cleanup script makes the drafts one coherent family.
- The warm palette tells the story of the island: the walk inward gets darker and more dangerous.
- Frame animation would multiply the sprite count by 3 to 4. Code motion is enough for this pass.

## Constraints
- Sprites are 16×16 px per tile. Large enemies and the boss can use 32×32 or 48×48.
- Every sprite pixel snaps to one locked palette. No anti-aliased edges and no partial alpha.
- The texture filter is `nearest`. The world scale is a whole multiple of 16 px when possible.
- Enemy bullets keep a dark outline and a bright core, and they stay readable on all 5 biome grounds.
- Hitboxes do not change. Sprites follow the radii in `packages/shared/src/data.ts`.
- All art is original. Prompts never name another game, studio or artist.
- Provenance is recorded for each asset: tool, prompt, date and edits.

## Ruled out
- Pixel art at 8 px: too few pixels for clear silhouettes.
- Clean vector: looks more like a web toy than a game.
- fal.ai: costs money per image.
- Sprites authored by hand in code: plainer art.
- Art by the human or a hired artist: slowest, and it needs a person.
- Dark and grim, or bright and saturated palettes: these do not tell the story of the walk inward.
- Frame animation: deferred to a later pass.

## Comments
none

## Open questions
- Does the GPT Image 2 skill work with the human's ChatGPT plan on this machine? Task 1 checks this.

## Sources
- Case c_cf2dd4ab-5b9d-4c9c-af12-c7f0bd85778b
- `docs/art/style-board/` (the 3-style board)
- `.claude/skills/create-game-assets/SKILL.md` (pixel art: draft, then enforce grid and palette)
