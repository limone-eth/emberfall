# Which sprites get movement frames?

Decided: 2026-10-31 · Case: c_c802bddc-b148-46e4-853b-569638660c31

## Question and choice
You asked for movement frames. Which sprites get walk frames, and when do we make them?

Choice: "Give all 13 creatures 4 walk frames each before the renderer swap."

## Why
- The human wants everything to move the same way, and wants the frames in before the game shows the sprites.

## Constraints
- This record replaces the "One frame per sprite" line of `2026-10-31-art-direction.md` for creatures. Obstacles, tiles and the bag stay one frame.
- 12 creatures (the ask said 13; that was a counting error): 3 classes (Emberwright, Wayfinder, Bulwark) and 9 enemies (Tidecrab, Dune Wisp, Thornling, Mossback Brute, Hollow Stag, Bramble Witch, Crag Sentinel, Ashen Reaver, Cinder Colossus). 4 frames each.
- The Crag Sentinel does not move (speed 0) and the Dune Wisp floats. Their 4 frames are an idle loop (eye pulse; bob and tail sway), not a walk.
- Frames are made from the approved sprite with GPT Image 2 image edit (`--ref`), as one 4-frame strip per creature, so the look stays the same.
- All frames of one creature share one scale and one ground line. No frame changes the hitbox.
- Code motion (hit flash, squash, particles) stays. The code bob is replaced by the frames.
- The renderer swap (task 4) starts after the frames exist.

## Ruled out
- Players first, after the swap (recommended by the agent): the human wants all creatures done at once.
- Code motion only: no real leg movement.

## Comments
- The agent warned that GPT drifts between frames, so some strips may need redos. The cost is about 12 strips plus redos.

## Open questions
- Facing: the frames face the viewer. Code mirrors the sprite on x for left and right movement. Real up and down views are not in scope.

## Sources
- Case c_c802bddc-b148-46e4-853b-569638660c31
- Case c_3db75b58-715b-4b61-8694-120d8c37e462 (the question came from the sprite review)
