# Art provenance

Every asset: tool, prompt, date, edits. Style rules: `docs/art/style-guide.md`.

## Sprites (GPT Image 2 via the Codex CLI, 2026-10-31)
Prompt = the text below + the fixed `$COMMON` block from the style guide (16/32/48 px variant). Script: `tools/gen-sprites.sh`. Draft: `docs/art/drafts/<id>.png`. Cleaned with `tools/sprite-clean.mjs`.

| id | size | clean flags | prompt |
|---|---|---|---|
| emberwright | 32 | `--size 32` | Emberwright: a small hooded fire mage holding a short wooden rod with a glowing ember at its tip. Robe in warm orange (#ff8a3d) with pale gold highlights (#ffd08a), dark brown hood lining, tiny glowing eyes. Cute chunky proportions, big head. |
| tidecrab | 32 | `--size 32` | Tidecrab: a small round beach crab monster seen from above, coral red shell (#e0795b) with darker red-brown claws (#8a3d2b), two raised claws, small black eyes on stalks, a few pale sand-colored spots on the shell. Cute chunky proportions. |
| wayfinder | 32 | `--size 32 --outline` | Wayfinder: a small nimble hooded ranger holding a short bow, light green cloak (#9bc53d) with darker green folds (#3f7a39), tan leather straps (#a88a5a), tiny bright eyes. Cute chunky proportions, big head. |
| bulwark | 32 | `--size 32 --outline` | Bulwark: a small sturdy knight in steel-blue plate armor (#6fb7ff) with pale grey trim (#a39d8f), holding a big round shield, dark blue visor slit (#2e6e8e) with two tiny bright eyes. Cute chunky proportions, big helmet. |
| dunewisp | 32 | `--size 32` | Dune Wisp: a small floating spirit of sea spray, a round glowing pale blue orb (#7fd6ff) with a white-blue core (#d9f5ff) and a curling wispy tail, two tiny dark eyes. Cute. |
| thornling | 32 | `--size 32` | Thornling: a small round bramble creature covered in sharp thorns, bright lime green (#9bc53d) with darker green spikes (#3f7a39) and deep green shadow (#1d3a1c), angry tiny gold eyes. Cute chunky proportions. |
| bramblewitch | 32 | `--size 32 --outline` | Bramble Witch: a small hunched forest witch in a violet hooded robe (#b07fd6) with dark purple shadow (#5a3b6b), vines and leaves (#2a5a28) wrapped around her, a crooked twig staff, glowing gold eyes. Cute chunky proportions. |
| mossback | 64 | `--size 64` | Mossback Brute: a big hulking stone-and-moss golem beast seen from above, mossy green back (#3f7a39) over grey stone body (#7c776c), deep green shadow (#1d3a1c), huge fists, small glowing gold eyes. Chunky heavy proportions. |
| hollowstag | 64 | `--size 64 --outline` | Hollow Stag: a large ghostly deer with a bone-white skull face (#cfc2b0), tan fur body (#a88a5a), dark hollow eye sockets with tiny pale blue glow, wide branching antlers, dark brown shadow (#4a3a36). Seen top-down three-quarter. |
| cragsentinel | 64 | `--size 64 --outline` | Crag Sentinel: a large ancient stone guardian totem, grey rock body (#a39d8f) with darker stone shading (#7c776c, #5e5a52), one big glowing steel-blue eye (#6fb7ff) in the middle, cracked runes. Squat and heavy, it does not move. |
| ashenreaver | 64 | `--size 64` | Ashen Reaver: a large fierce ash demon warrior with a crimson red body (#ff3d5a), dark red-brown armor plates (#8a3d2b), charcoal horns and claws (#2a201c), glowing gold eyes, two curved blades. Aggressive pose. |
| colossus | 96 | `--size 96` | The Cinder Colossus: a huge boss giant made of cooling lava rock, dark burnt orange crust (#b8431c) with bright orange cracks (#ff8a3d), a glowing gold molten core in the chest (#f6e27a), charcoal shoulders (#2a201c), small fiery eyes, massive arms. Menacing, seen top-down three-quarter. |
| rock | 32 | `--size 32 --outline` | Rock: a single chunky boulder obstacle, light grey top (#a39d8f), mid grey sides (#7c776c), dark grey shadow side (#5e5a52), a few cracks. Game map object, not a character. |
| tree | 32 | `--size 32` | Tree: a single round bushy tree seen from above, leafy canopy in greens (#6aa84f, #3f7a39, #2a5a28), a short dark brown trunk visible at the bottom (#2a201c). Game map object, not a character. |
| obsidian | 32 | `--size 32` | Obsidian: a single jagged black volcanic glass crystal cluster obstacle, near-black (#2a201c) with dark violet glints (#5a3b6b) and one pale highlight edge. Game map object, not a character. |
| bag | 32 | `--size 32` | Loot bag: a small tied leather sack (#a88a5a) with a darker brown shadow (#4a3a36), a tied rope neck, and a small round bright gem badge on the front. Game item, not a character. |

No hand edits so far.

## Ground tiles (script, 2026-10-31)
`tools/tile-gen.mjs`, seeded from the locked palette. Record: `docs/decisions/2026-10-31-ground-tiles.md`. No AI, no hand edits.

## Movement frames (GPT Image 2 image edit, 2026-10-31)
Record: `docs/decisions/2026-10-31-movement-frames.md`. Script: `tools/gen-frames.sh` (prompts inside).
- Reference: `tools/strip-ref.mjs` puts 4 exact copies of the approved sprite on magenta (`docs/art/drafts/frames/ref/<id>.png`).
- GPT edits only the legs (walk) or the tail/eye (idle loop for Dune Wisp and Crag Sentinel). Draft: `docs/art/drafts/frames/<id>.png`.
- Split and clean: `tools/strip-split.mjs` (one shared scale and ground line per strip; cuts off letterbox bars). `--outline` for wayfinder, bulwark, bramblewitch, hollowstag, cragsentinel.
- Output: `packages/client/public/frames/<id>-0..3.png`. No hand edits.
- A first try (redraw from a text prompt) lost the face; discarded.

## Back and side views (`tools/gen-views.sh`)
- Record: `docs/decisions/2026-10-31-four-directions.md`.
- Step 1, turnaround: 3 copies of the approved sprite (`tools/strip-ref.mjs --copies 3`). GPT Image 2 edit: copy 1 unchanged, copy 2 back view, copy 3 side view facing right. Split with `tools/strip-split.mjs --frames 3` (one shared scale) into stills in `docs/art/drafts/views/still/`.
- Step 2, walk: 4 copies of each still, then the same 4-copy edit as the front frames (back walk, side stride, or the custom idle prompts for the Wisp and the Sentinel). Split into `frames/<id>-<back|side>-0..3.png` with the same size and `--outline` flags as the front.
- Front frames were renamed `frames/<id>-front-0..3.png`.
