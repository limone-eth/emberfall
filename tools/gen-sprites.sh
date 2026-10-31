#!/usr/bin/env bash
# Generate sprite drafts with GPT Image 2, one at a time. Usage: bash tools/gen-sprites.sh [id...]
set -u
G="$HOME/.claude/skills/gpt-image-2/scripts/gen.sh"
D="$PWD/docs/art/drafts"; mkdir -p "$D"
C16="Original character, not from any existing game. Top-down three-quarter view game sprite in true pixel art: a 16x16 pixel sprite drawn on a visible pixel grid, scaled up 32x with hard square pixels, no anti-aliasing, no gradients, no blur. 1-pixel dark outline (#14100e). Limited palette of at most 8 colors. One single sprite centered, filling about 80 percent of the frame. Flat solid pure magenta background (#ff00ff), no shadow on the background, no text, no border, no frame."
C32="${C16/a 16x16 pixel sprite/a 32x32 pixel sprite}"; C32="${C32/scaled up 32x/scaled up 16x}"; C32="${C32/at most 8 colors/at most 12 colors}"
C48="${C32/a 32x32 pixel sprite/a 48x48 pixel sprite}"; C48="${C48/scaled up 16x/scaled up 12x}"
declare -A P S
P[wayfinder]="Wayfinder: a small nimble hooded ranger holding a short bow, light green cloak (#9bc53d) with darker green folds (#3f7a39), tan leather straps (#a88a5a), tiny bright eyes. Cute chunky proportions, big head."; S[wayfinder]=16
P[bulwark]="Bulwark: a small sturdy knight in steel-blue plate armor (#6fb7ff) with pale grey trim (#a39d8f), holding a big round shield, dark blue visor slit (#2e6e8e) with two tiny bright eyes. Cute chunky proportions, big helmet."; S[bulwark]=16
P[dunewisp]="Dune Wisp: a small floating spirit of sea spray, a round glowing pale blue orb (#7fd6ff) with a white-blue core (#d9f5ff) and a curling wispy tail, two tiny dark eyes. Cute."; S[dunewisp]=16
P[thornling]="Thornling: a small round bramble creature covered in sharp thorns, bright lime green (#9bc53d) with darker green spikes (#3f7a39) and deep green shadow (#1d3a1c), angry tiny gold eyes. Cute chunky proportions."; S[thornling]=16
P[bramblewitch]="Bramble Witch: a small hunched forest witch in a violet hooded robe (#b07fd6) with dark purple shadow (#5a3b6b), vines and leaves (#2a5a28) wrapped around her, a crooked twig staff, glowing gold eyes. Cute chunky proportions."; S[bramblewitch]=16
P[mossback]="Mossback Brute: a big hulking stone-and-moss golem beast seen from above, mossy green back (#3f7a39) over grey stone body (#7c776c), deep green shadow (#1d3a1c), huge fists, small glowing gold eyes. Chunky heavy proportions."; S[mossback]=32
P[hollowstag]="Hollow Stag: a large ghostly deer with a bone-white skull face (#cfc2b0), tan fur body (#a88a5a), dark hollow eye sockets with tiny pale blue glow, wide branching antlers, dark brown shadow (#4a3a36). Seen top-down three-quarter."; S[hollowstag]=32
P[cragsentinel]="Crag Sentinel: a large ancient stone guardian totem, grey rock body (#a39d8f) with darker stone shading (#7c776c, #5e5a52), one big glowing steel-blue eye (#6fb7ff) in the middle, cracked runes. Squat and heavy, it does not move."; S[cragsentinel]=32
P[ashenreaver]="Ashen Reaver: a large fierce ash demon warrior with a crimson red body (#ff3d5a), dark red-brown armor plates (#8a3d2b), charcoal horns and claws (#2a201c), glowing gold eyes, two curved blades. Aggressive pose."; S[ashenreaver]=32
P[colossus]="The Cinder Colossus: a huge boss giant made of cooling lava rock, dark burnt orange crust (#b8431c) with bright orange cracks (#ff8a3d), a glowing gold molten core in the chest (#f6e27a), charcoal shoulders (#2a201c), small fiery eyes, massive arms. Menacing, seen top-down three-quarter."; S[colossus]=48
P[rock]="Rock: a single chunky boulder obstacle, light grey top (#a39d8f), mid grey sides (#7c776c), dark grey shadow side (#5e5a52), a few cracks. Game map object, not a character."; S[rock]=16
P[tree]="Tree: a single round bushy tree seen from above, leafy canopy in greens (#6aa84f, #3f7a39, #2a5a28), a short dark brown trunk visible at the bottom (#2a201c). Game map object, not a character."; S[tree]=16
P[obsidian]="Obsidian: a single jagged black volcanic glass crystal cluster obstacle, near-black (#2a201c) with dark violet glints (#5a3b6b) and one pale highlight edge. Game map object, not a character."; S[obsidian]=16
P[bag]="Loot bag: a small tied leather sack (#a88a5a) with a darker brown shadow (#4a3a36), a tied rope neck, and a small round bright gem badge on the front. Game item, not a character."; S[bag]=16
IDS=("$@"); [ ${#IDS[@]} -eq 0 ] && IDS=(wayfinder bulwark dunewisp thornling bramblewitch mossback hollowstag cragsentinel ashenreaver colossus rock tree obsidian bag)
for id in "${IDS[@]}"; do
  [ -f "$D/$id.png" ] && { echo "skip $id"; continue; }
  case ${S[$id]} in 16) c="$C16";; 32) c="$C32";; 48) c="$C48";; esac
  echo "gen $id"; bash "$G" --prompt "${P[$id]} $c" --out "$D/$id.png" --timeout-sec 400 || echo "FAIL $id"
done
echo ALLDONE
