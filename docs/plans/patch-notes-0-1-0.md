# PATCH NOTES: V0.1.0

General UI fixes and game balance pass, with modified output file saving behavior.

## Fingers
- key button hints (e.g. Q-W-E-R-V on the keys) now only appear during the lobby and 'press all to start' screen
- During gameplay, fingers now turn into crosshairs
- Objects now appear centered under the crosshairs as the ripple reaches its peak
- Objects are now 'hit' if their vertical hitbox lies anywhere within the crosshair's vertical range (note: this is only a visual change, the game logic remains untouched)
- All finger crosshairs now pulse/glint during the timing window
- Pressed keys are still indicated by the background of the crosshair becoming more opaque

## Objects
- objects for left and right hands (leaf and shell) are now balanced to have the same approximate vertical height
- the approximate vertical height of objects now corresponds to the timing window in relation to the finger crosshairs (if any part of the virtual object hitbox is touching the crosshairs, you are within the timing window)
- size of objects/fingers and the wave height are tuned by default for a 200ms timing window and 0.33Hz object frequency
- wave height (lowest point of the ripple) is now driven by the visual requirements
- note: the size of objects and fingers still remains consistent when the timing window is changed (the timing window is fixed once the game starts, as it is loaded from config)
- added 'glancing hit' destruction to objects when the wrong key is pressed at the right time

## Multi-object gameplay
- 'glancing hits' are randomly assigned to an unhit object (i.e. one that has not been correctly hit or had glancing applied)
- if a glancing hit object is later correctly hit by a finger, a glancing hit is now applied to another random unhit object

## General gameplay
- the default frequency of objects is now 0.33Hz (3 seconds between objects)

## UI
- score additions now appear above the finger (crosshair) indicators and are more visible
- scores now always appear above the pressed finger

## File management
- .csv files no longer autosave (at the end of runs or on aborted runs)
- a manual .csv save option button still exists at the end of each run