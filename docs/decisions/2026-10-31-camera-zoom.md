# How close should the camera be on a computer screen?

Decided: 2026-10-31 · Case: c_a47a2be0-e318-4b24-b030-2dd701d1d77f

## Question and choice
Each 32 px sprite can show at 1×, 2× or any free zoom. Which zoom do large screens use?

Choice: "Keep 2× on large screens. A 1440×900 screen shows about 22×14 tiles. Phones stay at 1×."

## Why
- At 2× the art is easy to read and the pixels stay sharp. In a bullet-hell game, clear bullets are more important than a very wide view.

## Constraints
- The zoom is a whole step of 32 px per tile (1×, 2×, 3×). It is the smallest step that keeps the view inside the box of 34 tiles (long side) by 24 tiles (short side).
- A 1440×900 screen shows about 22×14 tiles at 2×. A phone in portrait shows about 12×26 tiles at 1×.
- The view stays inside the area that the server sends (18 tiles around the hero).

## Ruled out
- 1× on large screens: sprites look small.
- Free zoom: pixels of different sizes make the art look uneven.

## Open questions
- None.

## Sources
- Case c_a47a2be0-e318-4b24-b030-2dd701d1d77f
- `packages/client/src/game.ts` (resize: the tile size rule)
