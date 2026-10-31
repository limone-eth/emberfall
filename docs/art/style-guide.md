# Emberfall style guide

Records: `docs/decisions/2026-10-31-art-direction.md`, `docs/decisions/2026-10-31-pixel-grid-32.md`.
Style target: `packages/client/public/sprites/emberwright.png`, `tidecrab.png`. Every new sprite must look like it belongs next to these two.

## 1. Grid and scale
- 32 px per tile. The world draws at a whole-number scale with `nearest` filtering.
- Canvas sizes: **32×32** (normal), **64×64** (large), **96×96** (boss). No other sizes.
- Choose the canvas: it must be at least 1.1 times the hitbox diameter (`radius × 2 × 32 px`).
- The hitbox circle sits inside the body mass. Thin parts (claws, antlers, rods, flames) can stick out past the hitbox. The body must not be smaller than the hitbox.

| Entity | radius | hitbox Ø px | canvas |
|---|---|---|---|
| Player (all 3 classes) | 0.35 | 22 | 32 |
| Tidecrab | 0.40 | 26 | 32 |
| Dune Wisp | 0.32 | 20 | 32 |
| Thornling | 0.38 | 24 | 32 |
| Bramble Witch | 0.45 | 29 | 32 |
| Ashen Reaver | 0.50 | 32 | 64 |
| Hollow Stag | 0.55 | 35 | 64 |
| Mossback Brute | 0.60 | 38 | 64 |
| Crag Sentinel | 0.70 | 45 | 64 |
| Cinder Colossus | 1.30 | 83 | 96 |
| Loot bag | — | — | 32 (art about 18 px) |
| Tile | — | — | 32 |

Radii come from `packages/shared/src/data.ts` and `constants.ts` (`PLAYER_RADIUS`). Sprites never change them.

## 2. Palette
- Only colors in `docs/art/palette.json`. Alpha is 0 or 255; no partial alpha. `tools/sprite-clean.mjs` enforces both.
- Aim for at most 8 colors per 32 px sprite and 12 per 64 or 96 px sprite (the outline counts). This is a soft target: the palette lock is the hard rule. The first batch has up to 16, because the palette snap splits some shades.
- If the cleaned edge is less than about 90 % ink, clean again with `--outline`: the art fits in SIZE-2 and the outline is closed outside it.
- **Reserved colors.** Ground tiles never use `ink`, `white`, `sea100`, `red` or `gold`. These colors are for outlines, bullets, eyes, loot and UI. Then a bullet never blends into the floor.

### Ground per biome (low contrast: base plus at most 2 neighbor shades)
| Tile | base | shades and detail | notes |
|---|---|---|---|
| DeepWater | sea900 | sea700 wave marks | |
| Shallows | sea700 | sea500, sea300 foam (sparse) | |
| Sand (tier 0) | sand300 | sand500, sand100 specks | |
| Meadow (tier 1) | leaf300 | leaf500, leaf100 tufts | |
| Woods (tier 2) | leaf500 | leaf700, leaf900 | |
| Highland (tier 3) | stone500 | stone700, stone300 | |
| Ashland (tier 4) | ash700 | ash900, ember700 cracks (at most 6 px per tile) | |

### Obstacles (they block movement, so they read as solid)
| Tile | colors | notes |
|---|---|---|
| Rock | stone300 top, stone500, stone700 side, ink outline | |
| Tree | leaf300 / leaf500 / leaf700 canopy, ash900 trunk, ink outline | |
| Obsidian | ash900, ink, violet700 glint | |

### Entity colors (keep the hue that `data.ts` already uses, snapped to the palette)
| Entity | main | second |
|---|---|---|
| Emberwright | ember500 | ember300, ash900 |
| Wayfinder | leaf100 | leaf500, sand700 |
| Bulwark | steel500 | stone300, sea700 |
| Tidecrab | blood500 | blood700, sand100 |
| Dune Wisp | sea300 | sea100, sea700 |
| Thornling | leaf100 | leaf500, leaf900 |
| Mossback Brute | leaf500 | stone500, leaf900 |
| Hollow Stag | bone | sand700, ash700 |
| Bramble Witch | violet500 | violet700, leaf700 |
| Crag Sentinel | stone300 | stone500, steel500 eye |
| Ashen Reaver | red | blood700, ash900 |
| Cinder Colossus | ember700 | ember500, gold core, ink |

Loot tiers (bag rim and weapon gem): T0 bone, T1 leaf100, T2 steel500, T3 violet500, T4 gold. The bag body is sand700 with an ink outline. A soulbound bag adds a gold rim.

## 3. Outline and light
- **Outline:** a 1 px `ink` outline goes all around every entity, bag and obstacle. In the approved sprites, 95 to 98 % of the edge pixels are ink. Ground tiles have no outline.
- **Light** comes from the top left. The top-left edge of each form gets the lighter shade, and the bottom-right gets the darker shade. There is no cast shadow in the sprite (code draws a soft ellipse under entities).
- **View:** top-down three-quarter. Heads and faces turn to the viewer. Chunky proportions with a big head.
- **Eyes:** 1 to 2 px of a reserved bright color (`white`, `gold`, `ember300` or `sea100`), so faces read at 1x.
- One frame per sprite. Code adds bob, squash, hit flash and particles.

## 4. Bullet readability rule
Enemy bullets must stay readable on all 5 biome grounds. Rule:

- **Enemy bullet** = a 2 px `ink` ring + a 1 px band in the enemy hue + a `white` core (for blue enemies, `sea100`). It is drawn in code, not from the atlas.
- **Player bullet** = the class color with no ink ring, at 85 % alpha. It must never look like an enemy bullet.

Contrast checked (WCAG ratio; for each ground, the stronger of ring or core counts):

| ground | ink ring | white core | best |
|---|---|---|---|
| Sand (sand300) | 10.7 | 1.5 | 10.7 |
| Meadow (leaf300) | 6.6 | 2.4 | 6.6 |
| Woods (leaf500) | 3.7 | 4.3 | 4.3 |
| Highland (stone500) | 4.2 | 3.7 | 4.2 |
| Ashland (ash700) | 1.8 | 9.0 | 9.0 |

The lowest is 4.2, and the minimum target is 3.0. The enemy-hue band carries identity only, never contrast: a red band alone on Meadow is 1.2.

## 5. Making a sprite
1. Write the prompt: `<Name>: <one-sentence description with the main and second colors as hex>. Cute chunky proportions. $COMMON`
2. `$COMMON` is fixed. It produced the approved style target, so do not edit it:
   > Original character, not from any existing game. Top-down three-quarter view game sprite in true pixel art: a 16x16 pixel sprite drawn on a visible pixel grid, scaled up 32x with hard square pixels, no anti-aliasing, no gradients, no blur. 1-pixel dark outline (#14100e). Limited palette of at most 8 colors. One single sprite centered, filling about 80 percent of the frame. Flat solid pure magenta background (#ff00ff), no shadow on the background, no text, no border, no frame.

   For 64 px sprites, replace "a 16x16 pixel sprite ... scaled up 32x" with "a 32x32 pixel sprite ... scaled up 16x", and "at most 8 colors" with "at most 12 colors". For the 96 px boss, use "a 48x48 pixel sprite ... scaled up 12x". Then the pixel density matches the 32 px sprites, and the sprites are not just enlarged.

   For tiles, replace "One single sprite centered, filling about 80 percent of the frame" with "One seamless square ground tile that fills the whole frame edge to edge, flat top-down view", and remove the outline sentence.
3. Generate: `bash ~/.claude/skills/gpt-image-2/scripts/gen.sh --prompt "..." --out docs/art/drafts/<id>.png`. Run one at a time.
4. Clean: `node tools/sprite-clean.mjs docs/art/drafts/<id>.png packages/client/public/sprites/<id>.png --size 32 --preview docs/art/previews/<id>@8x.png` (`--size 64` or `96` for large sprites).
5. Check: palette only, no partial alpha, an outline all around (entities), and it reads at 1x on its own biome ground.
6. Record provenance in `docs/art/provenance.md`: id, tool, prompt, date, hand edits.

## 6. Never
- Never name another game, studio or artist in a prompt.
- Never use gradients, dithering on ground tiles, or partial alpha.
- Never put reserved colors on the ground.
- Never make an enemy sprite whose main color is `ink` or `white`; it would compete with bullets.
