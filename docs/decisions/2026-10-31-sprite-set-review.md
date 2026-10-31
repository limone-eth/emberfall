# Review: first full sprite set

Decided: 2026-10-31 · Case: c_3db75b58-715b-4b61-8694-120d8c37e462

## Question and choice
Do the 14 new sprites match the Emberwright and Tidecrab style target?

Choice: "Approve all 14 sprites and the ground tiles. Start the renderer swap." With a comment (below).

## Why
- All sprites use the locked palette and a closed ink outline. Each one reads clearly on its home biome.
- Small fixes are cheaper after we see the sprites in the game.

## Constraints
- The set in `packages/client/public/sprites/` and `tiles/` is the approved set. Provenance: `docs/art/provenance.md`.
- The color count per sprite is a soft target (style guide section 2). The palette lock is the hard rule.
- One bag sprite for all tiers. Code tints the gem per tier.
- Next step: the renderer swap (plan task 4).

## Ruled out
- Redo sprites now: no sprite was flagged.

## Comments
- The human asked: "then they need to have movements supported frames?" This reopens the "One frame per sprite" line of `2026-10-31-art-direction.md`. It is asked as a separate decision (follow-up case).

## Open questions
- Movement frames: which sprites, how many frames, and how to make them. See the follow-up case.

## Sources
- Case c_3db75b58-715b-4b61-8694-120d8c37e462
- `docs/art/previews/sheet.png`, `docs/art/previews/tiles.png`
