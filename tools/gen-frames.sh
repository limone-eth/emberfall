#!/usr/bin/env bash
# Make 4-frame strips with GPT Image 2 image edit from the approved sprites, one at a time.
# Usage: bash tools/gen-frames.sh [id...]   Record: docs/decisions/2026-10-31-movement-frames.md
set -u
G="$HOME/.claude/skills/gpt-image-2/scripts/gen.sh"
D="$PWD/docs/art/drafts/frames"; mkdir -p "$D/ref"
WALK="copy 1 left foot forward, copy 2 feet together and body one pixel lower, copy 3 right foot forward, copy 4 feet together and body one pixel lower"
declare -A M
M[dunewisp]="Change only the wispy tail and the height: copy 1 tail curls left, copy 2 body one pixel higher, copy 3 tail curls right, copy 4 body one pixel lower"
M[cragsentinel]="Change only the glowing eye and runes: copy 1 normal, copy 2 eye and runes brighter and one pixel larger glow, copy 3 normal, copy 4 eye and runes dimmer"
M[tidecrab]="Change only the legs and claws: copy 1 left legs forward and claws up, copy 2 legs together and body one pixel lower, copy 3 right legs forward and claws up, copy 4 legs together and body one pixel lower"
M[thornling]="Change only the small feet and spikes: copy 1 left foot forward, copy 2 body squashed one pixel lower, copy 3 right foot forward, copy 4 body squashed one pixel lower"
M[hollowstag]="Change only the legs: copy 1 front-left and back-right legs forward, copy 2 legs together and body one pixel lower, copy 3 front-right and back-left legs forward, copy 4 legs together and body one pixel lower"
IDS=("$@"); [ ${#IDS[@]} -eq 0 ] && IDS=(emberwright wayfinder bulwark tidecrab dunewisp thornling bramblewitch mossback hollowstag cragsentinel ashenreaver colossus)
for id in "${IDS[@]}"; do
  [ -f "$D/$id.png" ] && { echo "skip $id"; continue; }
  node tools/strip-ref.mjs "packages/client/public/sprites/$id.png" "$D/ref/$id.png"
  how="${M[$id]:-Change only the lower part of each copy: $WALK}"
  echo "gen $id"
  bash "$G" --ref "$D/ref/$id.png" --out "$D/$id.png" --timeout-sec 400 --prompt "Edit this image into a 4-frame animation cycle. The image shows the same pixel-art character four times. Keep the layout, positions, size, pixel grid, colors, face, eyes and outline exactly as they are. $how. Keep the hard square pixels, no anti-aliasing, no blur. Keep the flat pure magenta background (#ff00ff), no text." || echo "FAIL $id"
done
echo ALLDONE
