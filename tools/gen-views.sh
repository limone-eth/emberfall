#!/usr/bin/env bash
# Back and side views (4 frames each) with GPT Image 2 image edit, one creature at a time.
# Usage: bash tools/gen-views.sh [id...]   Record: docs/decisions/2026-10-31-four-directions.md
# 1. Turnaround: 3 copies of the approved sprite -> front / back / side (facing right).
# 2. Split with one shared scale -> stills (docs/art/drafts/views/still/<id>-1 back, -2 side).
# 3. For back and side: 4 copies of the still -> walk (or idle) strip -> frames/<id>-<dir>-0..3.png
set -u
G="$HOME/.claude/skills/gpt-image-2/scripts/gen.sh"
D="$PWD/docs/art/drafts/views"; mkdir -p "$D/ref" "$D/still" "$D/strips"
OUT=packages/client/public/frames
declare -A SIZE=([mossback]=64 [hollowstag]=64 [cragsentinel]=64 [ashenreaver]=64 [colossus]=96)
declare -A OUTL=([wayfinder]=1 [bulwark]=1 [bramblewitch]=1 [hollowstag]=1 [cragsentinel]=1)
WALK_BACK="copy 1 left foot forward, copy 2 feet together and body one pixel lower, copy 3 right foot forward, copy 4 feet together and body one pixel lower"
WALK_SIDE="copy 1 front leg forward and back leg back (long stride), copy 2 legs together under the body and body one pixel lower, copy 3 back leg forward and front leg back (long stride), copy 4 legs together and body one pixel lower"
declare -A M
M[dunewisp]="Change only the wispy tail and the height: copy 1 tail curls one way, copy 2 body one pixel higher, copy 3 tail curls the other way, copy 4 body one pixel lower"
M[cragsentinel]="Change only the glowing parts and runes: copy 1 normal, copy 2 runes brighter and one pixel larger glow, copy 3 normal, copy 4 runes dimmer"
M[thornling]="Change only the small feet and spikes: copy 1 one foot forward, copy 2 body squashed one pixel lower, copy 3 the other foot forward, copy 4 body squashed one pixel lower"
M[tidecrab]="Change only the legs and claws: copy 1 left legs forward and claws up, copy 2 legs together and body one pixel lower, copy 3 right legs forward and claws up, copy 4 legs together and body one pixel lower"
M[hollowstag]="Change only the legs: copy 1 front-left and back-right legs forward, copy 2 legs together and body one pixel lower, copy 3 front-right and back-left legs forward, copy 4 legs together and body one pixel lower"
TAIL="Keep the hard square pixels, no anti-aliasing, no blur. Keep the flat pure magenta background (#ff00ff), no text."
IDS=("$@"); [ ${#IDS[@]} -eq 0 ] && IDS=(emberwright wayfinder bulwark tidecrab dunewisp thornling bramblewitch mossback hollowstag cragsentinel ashenreaver colossus)
for id in "${IDS[@]}"; do
  sz="${SIZE[$id]:-32}"; ol=(); [ -n "${OUTL[$id]:-}" ] && ol=(--outline)
  if [ ! -f "$D/$id.png" ]; then
    node tools/strip-ref.mjs "packages/client/public/sprites/$id.png" "$D/ref/$id.png" --copies 3
    echo "turn $id"
    bash "$G" --ref "$D/ref/$id.png" --out "$D/$id.png" --timeout-sec 400 --prompt "Edit this image into a 3-view character turnaround for a top-down game. The image shows the same pixel-art creature three times. Copy 1: keep it exactly as it is (front view, facing the viewer). Copy 2: the same creature seen from behind (back view, moving away from the viewer): show the back of the head and body; no face or eyes visible. Copy 3: the same creature seen from the side, facing right (side view, profile). Keep the same size, proportions, pixel grid, palette colors, 1-pixel dark outline and light from the top left in all copies. Keep each copy in its position. $TAIL" || { echo "FAIL turn $id"; continue; }
  fi
  [ -f "$D/still/$id-2.png" ] || node tools/strip-split.mjs "$D/$id.png" "$D/still/$id" --size "$sz" --frames 3 "${ol[@]}" || { echo "FAIL split $id"; continue; }
  for v in back side; do
    k=1; [ $v = side ] && k=2
    [ -f "$OUT/$id-$v-3.png" ] && { echo "skip $id $v"; continue; }
    if [ ! -f "$D/strips/$id-$v.png" ]; then
      node tools/strip-ref.mjs "$D/still/$id-$k.png" "$D/ref/$id-$v.png"
      walk="$WALK_BACK"; [ $v = side ] && walk="$WALK_SIDE"
      how="${M[$id]:-Change only the lower part of each copy: $walk}"
      echo "gen $id $v"
      bash "$G" --ref "$D/ref/$id-$v.png" --out "$D/strips/$id-$v.png" --timeout-sec 400 --prompt "Edit this image into a 4-frame animation cycle. The image shows the same pixel-art creature four times, seen from the $v. Keep the layout, positions, size, pixel grid, colors, view direction and outline exactly as they are. $how. $TAIL" || { echo "FAIL gen $id $v"; continue; }
    fi
    node tools/strip-split.mjs "$D/strips/$id-$v.png" "$OUT/$id-$v" --size "$sz" "${ol[@]}" || echo "FAIL split $id $v"
  done
done
echo ALLDONE
