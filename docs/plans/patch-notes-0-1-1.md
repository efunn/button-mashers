# PATCH NOTES: V0.1.1

This patch adds logic and gameplay elements to encourage pressing of the exact correct number of buttons during each cycle. Some small UI and other gameplay elements (a new name and endless mode continuation) are also implemented.

## Fingers
- finger marker crosshairs now become translucent after presses and/or after all presses in the cycle have been consumed (non-translucent crosshairs indicate options that can still be pressed for points), resetting smoothly at the beginning of each cycle (downswing)

## Objects
- a 'damaged' version of each object can now be shown for early/late presses

## General gameplay
- early/late presses still give +0 points
- early/late presses now apply 'damage' to objects (it changes slightly visually, but remains intact)
- 'damage' is applied to an object in the same column as the finger if possible; otherwise it is applied randomly to objects
- 'damage' is only applied for valid early/late presses (not excess presses)
- when the maximum press number for the game mode (equal to number of objects) is reached, all crosshairs fade (they are still visible, but transluscent, and still visually react to presses; they fade back in to full visibility at the beginning of the next cycle)
- non-presses or excess presses (beyond the limit of the game mode per  cycle) now give -1 points (shown in red, highly discouraged)
- note: spamming buttons will result in a large loss of points!!
- at the end of a run, "press all buttons to start" reappears and a new run with the previous settings will begin if all buttons are pressed

## Multi-object gameplay
- 'damage' is applied as described in General gameplay
- The first press turns the associated finger's crosshair translucent, with following presses turning their finger's crosshairs translucent, until the press limit has been reached (then all turn translucent)
- in high quality gameplay, presses are basically simultaneous, so we wait a short time (say, equal to the timing window) for subsequent presses; sync up the fading animation (will be slightly delayed) for nearly simultaneous (within timing window) presses (game logic remains the same in regards to presses and ammo)

## UI
- the game is now called (COME UP WITH NEW NAME FOR GAME, GIVE SOME OPTIONS)
