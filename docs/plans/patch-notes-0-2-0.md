# PATCH NOTES: V0.2.0

Major visual/paradigm rework to counter fixed-button strategies on
impossible trials (a pilot participant just pressed middle every time —
the empty wave was an early tell). Game logic code stays as close as
possible to v0.1.x: same clock, scoring, latch, reconciliation, and CSV
columns. No more shells flying upwards.

## New paradigm
- Abstract shapes fly **downward at linear speed** toward the crosshair
  line (no more cyclic wave).
- Each cycle sends a single **neutral spanning band** — identical in
  height to an object but covering the width of all options — falling
  toward the line.
- At the reveal moment (= the old spawn timing: windowClose − reaction
  time), the band **morphs into the spatial target(s)**: the band
  dissolves and the target object(s) appear in place at their columns.
- Careful morph constraint: the far-side morph must not look different
  from the middle morph (pure in-place crossfade, no lateral motion).
- Until the reveal, every trial looks identical — there is no early
  warning that a trial is 'impossible', so no default motor plan can be
  armed in advance.
- Bands are prespawned all the way to the top of the screen at correct
  spacing (fading in at a cutoff around 2000–3000ms of travel, depending
  on screen height and speed).

## Speed setting (franticness)
- New second selector alongside difficulty: **speed** = slow / fast /
  extreme (objects every 1500 / 1000 / 500 ms; configurable). More
  frequent targeting forces more spontaneous presses.
- Difficulty (easy/medium/hard reaction-time sets) unchanged.
- Trial count stays fixed across speeds; extreme is a short intense burst.

## Visuals
- Minimal dark abstract theme (the pond aesthetic retires); Tideline name
  stays.
