# How do we make the ground tiles?

Decided: 2026-10-31 · Case: c_e1847b7a-ba32-4c47-9bfd-dd28539f0d2d

## Question and choice
Ground tiles must repeat with no visible seams. Do we make them with a script from the palette, or with GPT Image 2?

Choice: "A script makes the 7 ground tiles from the palette. GPT Image 2 makes rocks, trees, obsidian and all creatures."

## Why
- The ground is the background for every bullet. A script keeps it seamless and quiet.
- Variants cost nothing: a new seed gives a new variant.
- GPT Image 2 is used where it is strong: creatures and obstacles.

## Constraints
- This record changes the "Source" line of `2026-10-31-art-direction.md` for the 7 ground tiles only (DeepWater, Shallows, Sand, Meadow, Woods, Highland, Ashland).
- Ground tiles use only the colors in `docs/art/style-guide.md` section 2 (base plus at most 2 neighbor shades). They never use reserved colors.
- Each tile is 32×32 and repeats with no seam. 2 to 3 variants per tile.
- Rock, Tree and Obsidian come from GPT Image 2 with the normal sprite flow and an ink outline.

## Ruled out
- GPT Image 2 for every tile: seams are likely, busy ground can hide bullets, and each tile needs more hand work.

## Comments
none

## Open questions
- Edges between biomes (for example sand to water) are hard cuts for now. Transition tiles can come later.

## Sources
- Case c_e1847b7a-ba32-4c47-9bfd-dd28539f0d2d
- `docs/art/style-guide.md`
