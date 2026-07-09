# PATCH NOTES: V0.1.0

General UI fixes and game balance pass, with modified output file saving
behavior. Data recording, press classification, chord reconciliation, and
the CSV format are **unchanged** — every gameplay item below is visual/UI
only, except the two pacing defaults called out under *General gameplay*.

## Fingers
- Key button hints (e.g. Q-W-E-R-V on the keys) now only appear during the
  lobby and 'press all to start' screens. *(Amended: they are also hidden
  during the pre-run countdown, which already shows the gameplay view.)*
- During gameplay, fingers now turn into crosshairs — letterless colored
  rings with tick marks, centered on the waterline peak so the object sits
  centered under them at the top of the ripple.
- Objects now appear centered under the crosshairs as the ripple reaches
  its peak.
- Objects read as 'hit' when their vertical hitbox lies within the
  crosshair's vertical range. *(Amended: with the cosine wave motion kept,
  the water is slowest right at the peak, so the visual overlap is an
  **approximation** of the timing window — it brackets the window rather
  than matching it exactly. The precise window remains the configured
  `captureWindowMs`, judged from timestamps; game logic untouched.)*
- All finger crosshairs now pulse/glint during the timing window (a swell
  plus a sweeping glint arc; same on every crosshair, so it signals timing
  without telegraphing the target).
- Pressed keys are still indicated by the crosshair's background becoming
  more opaque.

## Objects
- Objects for the left and right hands (leaf and shell) are now balanced to
  the same approximate vertical height.
- The default sizes of objects/fingers and the wave travel are tuned for a
  250 ms timing window at ≈0.33 Hz. *(Amended: wave height remains a
  hand-tuned config value — `ripple.amplitudePx` — rather than being
  derived from the window, since the cosine motion was kept.)*
- Object and finger sizes stay consistent when the timing window is changed
  in config (the window is fixed once a run starts).
- Added 'glancing hit' destruction to objects when the wrong key is pressed
  at the right time. *(Amended: glancing only triggers for wrong-key
  presses **inside** the window; early/late presses still just splash and
  the object floats away intact.)*

## Multi-object gameplay
- Glancing hits are randomly assigned to an unhit object (one that has not
  been correctly hit or had a glancing hit applied). *(Amended: the random
  choice is seeded per run for reproducibility; note that this visual
  assignment is independent of the CSV's nearest-object attribution, which
  is unchanged.)*
- If a glancing-hit object is later correctly hit by its finger, it pops
  normally and the glancing hit is re-applied to another random unhit
  object (if any remains).
- If a wrong-key press arrives when every object is already hit or glanced,
  it just splashes.

## General gameplay
- The default object frequency is now ≈0.33 Hz (3 seconds between objects).
- *(Added — missed in the draft:)* the default run target drops from 150 to
  **100 trials** (bounds 80–140) so runs stay ~5 minutes at the slower
  pace. Counterbalancing still resolves exactly (5 fingers × 5 timings →
  4 reps = 100; 3 fingers × 8 timings → 120).

## UI
- Score additions now appear directly above the finger (crosshair)
  indicators, larger and with a dark outline for legibility on both sand
  and water.
- Scores always appear above the pressed finger. *(Amended: for objects
  that float away with no press, the '0' appears above the missed target's
  crosshair — there is no pressed finger in that case. Objects consumed by
  a glancing hit no longer also emit a '0'.)*

## File management
- .csv files no longer autosave — neither at the end of a run nor on
  aborted runs.
- A manual 'save csv' button on the run-complete screen exports the file
  (disabled when a run produced no completed trials).
- *(Added:)* every run is still stored in the browser's localStorage the
  moment it resolves, and remains exportable later from the lobby's
  'past runs' list — closing the tab without saving loses nothing.
