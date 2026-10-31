# How do players move and shoot on a phone?

Decided: 2026-10-31 · Case: c_c3934837-da0a-4d87-9ff3-443cbcea72e2

## Question and choice
The human asked to make the game work on mobile. A phone has no keys and no mouse. Which touch controls do we use?

Choice: "Two sticks. The left thumb moves with a stick. The right thumb drags a second stick to aim, and the hero fires while that stick is held."

## Why
- The game is about dodging bullets and aiming well. Two sticks give phone players the same control as computer players.

## Constraints
- The left stick moves the hero in the same way as the movement keys (the same speed, and the same input to the server).
- The right stick aims. The hero fires while the right stick is held past a small dead zone.
- The sticks show only on touch screens. Keyboard and mouse controls do not change.
- Each stick appears where the thumb touches down in its half of the screen.
- The HUD, the login screen and the death screen fit on a phone screen in portrait and in landscape. No text is cut off and no page scrolls sideways.
- The game view keeps the 18-tile interest radius rule (the camera never shows more than the server sends).

## Ruled out
- One stick with auto-aim: phone players get less control. It can come back later as an option.
- One stick with tap to aim: the finger covers the enemies and their bullets.

## Open questions
- An auto-aim option for new players (later).

## Sources
- Case c_c3934837-da0a-4d87-9ff3-443cbcea72e2
- `packages/client/src/game.ts` (keyboard and mouse input), `packages/client/index.html` (HUD)
