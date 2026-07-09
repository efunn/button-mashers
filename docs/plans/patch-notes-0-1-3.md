# PATCH NOTES: V0.1.3

## General gameplay
- for single left/right hand gameplay, the spacebar (`_` in the hint display) replaces v/n keys for thumb presses (v/n are still used for thumbs in the 10 finger mode)
- added a soothing audio track which lines up with the frequency of the wave, including a specific yet not too annoying audio cue at the peak/timing window of the wave
- added further subtle audio cues for each score outcome

## Player balance
- increased the default timing window to 250ms
- all difficulties now have one impossible timing (150ms), with easy having only one impossible time (next hardest: 500ms), medium having two impossible times (150ms and 225ms; next hardest: 450ms), and hard having three impossible/difficult times (150ms, 225ms, and 300ms; next hardest: 400ms)

## Performance
- improved performance during glinting (especially noticeable in 10 finger mode on slower hardware)

## Bug fixes
- fixed a bug on mobile where controls were extremely difficult to use (extending beyond the bottom of the screen)
- fixed a bug on mobile where the colors of controls were flipped on the left-right axis when the left hand was selected
