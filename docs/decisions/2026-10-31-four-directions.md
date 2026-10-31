# Do creatures face all 4 directions?

Decided: 2026-10-31 · Case: c_08125764-595e-47fa-a72a-bb8d700dd862

## Question and choice
All frames face the viewer. Left and right are a mirror; up and down still show the face. Do we add back and side views?

Choice: "Add back and side views for all 12 creatures."

## Why
- The human wants every creature to turn the right way, not only the player classes.

## Constraints
- Each of the 12 creatures gets 2 more views: back (walking up) and side (walking right; mirrored for left). Each view has 4 frames, like the front view.
- File names: `frames/<id>-<dir>-<k>.png`, with dir = front, back or side and k = 0..3. The current front frames become `front`.
- The facing comes from the movement direction. The larger of |dx| and |dy| picks side or front/back. An idle creature keeps its last facing.
- The Dune Wisp and the Crag Sentinel loop idle in every view.
- New views must keep the approved look (palette, outline, proportions) and the shared scale and ground line of each creature.
- The atlas stays at 2048×2048 px or less.
- The frames and the renderer from case c_08125764 are part of this approval (the review question became this choice).

## Ruled out
- 4 directions for players only (recommended by the agent): the human wants all creatures.
- Front + mirror only: walking up shows the face.

## Comments
- The agent warned: GPT must draw back and side views as new poses, not as small edits. The look can drift, and some strips will need redos. About 24 strips, about 1 hour plus redos.

## Open questions
- Method for the side and back views. Plan: first GPT edits the approved front sprite into one still per view; then the same 4-copy edit as the front frames.

## Sources
- Case c_08125764-595e-47fa-a72a-bb8d700dd862
- `docs/decisions/2026-10-31-movement-frames.md`
