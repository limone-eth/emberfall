# Do you approve the back and side views for all 12 creatures?

Decided: 2026-10-31 · Case: c_c14eb21f-f49c-48ed-bf30-75356bc447db

## Question and choice
GPT drew back and side views (4 frames each) for the 12 creatures. Do they keep the approved look?

Choice: "Approve all 36 views. The game uses them now."

## Why
- All 96 new frames use the same palette, outline, height and ground line as the front view.
- In the game, the hero shows the back view when it walks up and the mirrored side view when it walks left.

## Constraints
- The files `packages/client/public/frames/<id>-<front|back|side>-0..3.png` are approved art. Change them only through a new review.
- The atlas has 181 frames at 2048×512 px. It must stay at 2048×2048 px or less.
- New creatures get all 3 views with `tools/gen-views.sh`.

## Ruled out
- Redo of single views: the human asked for no changes.

## Open questions
- None.

## Sources
- Case c_c14eb21f-f49c-48ed-bf30-75356bc447db
- `docs/art/previews/views-page1.png` .. `views-page3.png`
- `docs/decisions/2026-10-31-four-directions.md`
