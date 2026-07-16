# PATCH NOTES: V0.2.0

Major paradigm rework to counter fixed-button strategies on impossible
trials (a pilot participant pressed middle every time — the empty wave was
a ~1s early tell that let them arm a default motor plan). **Game logic is
unchanged**: same cycle clock, press classification, latch, scoring,
reconciliation, and CSV columns. Only the CSV *filename* gains a speed tag.

## New paradigm
- No more shells flying upwards: abstract shapes now fall **downward at
  constant linear speed** toward the crosshair line.
- Each cycle sends one **neutral spanning band** (object-height, covering
  the full width of the active columns) falling toward the line.
- At the reveal moment — `windowClose − reactionTime`, the exact formula
  that used to set spawn time — the band **morphs into the target(s)**: it
  dissolves while the target object(s) fade in at their columns at the same
  height. *(Amended: the morph is a strict in-place crossfade over ~120ms
  with no lateral motion, so a far-column reveal is visually identical to a
  middle-column reveal.)*
- Until the reveal, every trial looks identical: an 'impossible' 150ms
  trial keeps its neutral band until ~25ms *before* the crossing. There is
  no advance warning to trigger a pre-planned press.
- Bands are prespawned along their whole trajectory and fade in near the
  top of the screen (`fall.fadeLeadMs`, default 2500ms of travel), so
  several future bands are visible falling at once — more at faster speeds.
- Non-revealed remnants and missed objects continue below the line and fade
  out; pops, glancing hits, damage cracks, ammo-fade crosshairs, and the
  window pulse all carry over unchanged.

## Speed setting (franticness)
- New lobby selector alongside difficulty: **speed** = slow / fast /
  extreme (objects every 1500 / 1000 / 500 ms; fully configurable via
  `speeds` in the config, with `defaultSpeed`). *(Amended: the draft's
  ordering "500/1000/1500" was reversed.)*
- Difficulty (reaction-time sets) is unchanged and orthogonal to speed.
- Trial count stays fixed across speeds: extreme ≈ 0:50 burst, slow ≈ 2:30.
- The lobby's idle rain follows the selected speed for an honest preview.

## Visuals
- Minimal dark abstract theme: deep gradient backdrop, faint column guides,
  glowing target line. The Tideline name stays.
- Hand shapes are now abstract: **diamond** (left) / **circle** (right),
  same height, colored per finger as before.
- Mobile touch controls anchor just below the target line.

## Config changes (breaking for old config files)
- `ripple` → `timing` (`captureWindowMs`, `windowCenterOffsetMs` only);
  `frequencyHz` and `amplitudePx` are gone.
- New `speeds` map + `defaultSpeed`; new `fall.fadeLeadMs`.
- `visuals.handShapes` values are now `diamond`/`circle`.
- Validator warns if `fall.fadeLeadMs` can't contain the longest reaction
  time + half window.

## Data
- CSV columns are byte-identical to v0.1.x. The filename now includes the
  speed: `bm_<id>[_<nick>]_<mode>_<difficulty>_<speed>_<stamp>[_aborted].csv`.
- `timing_ms` still records the reaction-time condition; in the new
  paradigm it is the time from the band's reveal to the window's end.
