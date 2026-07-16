# Tideline

A web-based human experimental data collection system for measuring finger
error behavior, presented as a rhythm-game-like catching game: neutral
bands fall at constant speed toward a target line and morph into colored
target objects at a reaction-time-controlled reveal moment; the participant
presses the matching key inside a timing window as the object crosses the
line. Because every trial looks identical until its reveal, there is no
early cue that a trial is 'impossible' — spontaneous finger selection is
exactly what gets measured. Every trial is
pregenerated, counterbalanced, and exported as CSV. Pressing the *exact*
right number of keys matters: missed objects and excess presses cost
points.

## Quick start

```bash
npm install
npm run dev        # local dev server
npm test           # unit tests (vitest)
npm run build      # type-check + static bundle in dist/
```

The build output in `dist/` is a plain static site — deploy it on any static
host. If your host allows custom headers, add
`Cross-Origin-Opener-Policy: same-origin` and
`Cross-Origin-Embedder-Policy: require-corp` to get finer
`performance.now()` resolution (the dev server already sets these).

## Playing / collecting data

1. The lobby shows a persistent random participant ID (Crockford base32) and
   an optional nickname field.
2. Pick hands (left/right/both), fingers per hand (3/4/5), objects per drop
   (1 = single, 2–3 = chords, always within one hand), speed
   (slow/fast/extreme — how often objects fall), and difficulty. The
   projected run length is shown below the selectors.
3. **Ready → press all to start**: every mapped key must be pressed once; in
   chord modes, also hold several keys together — if some don't light up,
   the keyboard is dropping chord presses (see *Keyboard rollover* below).
4. A countdown synced to the falling rhythm starts the run. During gameplay
   the key hints disappear and the finger indicators become crosshairs on
   the target line; they pulse while the capture window is open.
5. After the last drop, results are stored in `localStorage` and shown on
   the completion screen — **CSV export is manual** (the *save csv* button
   there, or later from the lobby's *past runs* list). Nothing downloads
   automatically.
6. Pressing all keys on the completion screen immediately starts another
   run with the same settings (endless continuation); every run is kept
   separately in past runs.

Keys (physical positions, so non-QWERTY layouts use the same fingers):

| hand  | little | ring | middle | index | thumb |
| ----- | ------ | ---- | ------ | ----- | ----- |
| left  | Q      | W    | E      | R     | V     |
| right | P      | O    | I      | U     | N     |

In single-hand modes the played hand's thumb moves to the **spacebar**
(shown as `_` in the key hints); V/N stay the thumbs in ten-finger mode.
3-finger mode uses index/middle/ring (W-E-R / U-I-O); 4-finger uses the
non-thumb four (Q-W-E-R / U-I-O-P). Mobile devices get a touch demo
(3/4/5-finger, 4 by default, chords capped at 2; 5-finger puts the thumb on
a full-width button beneath the four fingers); it demos the mechanics but is
not intended for serious collection.

Synthesized audio cues (a low pulse at each line crossing and per-outcome
score sounds — no background track, so feel free to play your own music)
accompany runs; set `audio.masterVolume` to 0 in the config for silent
collection.

Escape aborts a run at any time and returns to the lobby. Switching away
from the tab (or any freeze longer than ~0.6 s) also aborts: frozen frames
are scientifically void, so the partial data is saved with an `aborted`
flag instead of pausing. Append `?ignore-hidden` to the URL to disable the
tab-switch abort during development.

Press `` ` `` (backquote) for a timing debug overlay (cycle, ms to peak,
last press offset, frame deltas).

## Configuration

All experiment parameters live in [public/game-config.json](public/game-config.json)
(JSON with `//` comments allowed) and can be edited on the deployed server
without rebuilding. See [docs/config-reference.md](docs/config-reference.md)
for every field. Highlights:

- `speeds` — named periods between objects (slow/fast/extreme = 1500/1000/500 ms)
- `timing.captureWindowMs` — total window width, centered on the moment the
  band crosses the target line
- `difficulties.*.reactionTimesMs` — the reaction-time conditions; values
  near or below simple-RT floor (~250 ms) are intentionally impossible and
  probe finger-selection errors under time pressure
- `run.targetTrialCount` / `trialCountBounds` — the schedule picks the
  smallest fully counterbalanced trial count ≥ target inside the bounds

## Trial generation

Each run is pregenerated: every (target × reaction-time) condition occurs
exactly the same number of times, and trial order is built as a random
Eulerian circuit over the target transition graph so that **first-order
transitions between targets — including immediate repeats — are as close to
uniform as integer counts allow**. Chord modes with more transition types
than trials fall back to a maximally flat subset that always includes at
least one immediate repeat. The RNG seed is stored in the run record for
reproducibility.

## Data dictionary (CSV)

One row per **target object** (chord trials produce 2–3 rows with the same
trial number), plus one row per **excess press** (`target_finger` = `x`),
so a spammed trial can have more rows than its chord size. Filter
`target_finger != 'x'` for the per-object view. The points column sums to
the run score. Filename:
`bm_<id>[_<nickname>]_<hands><fingers>f<objects>o_<difficulty>_<speed>_<timestamp>[_aborted].csv`

| column           | meaning                                                                   |
| ---------------- | ------------------------------------------------------------------------- |
| `trial`          | 1-based trial (drop) number                                                |
| `target_finger`  | `t`/`i`/`m`/`r`/`l` (thumb…little), or `x` for an excess-press row         |
| `target_hand`    | `l`/`r`, or `x` for an excess-press row                                    |
| `pressed_finger` | finger attributed to this object, or `x` for no press                     |
| `pressed_hand`   | hand of that press, or `x`                                                 |
| `timing_ms`      | reaction-time condition (reveal → end of window)                            |
| `press_ms`       | press time relative to the line crossing (0 = perfect, −152 = early, 253 = late); empty for no press |
| `points`         | 3 correct-in-window, 1 wrong-finger-in-window, 0 early/late, −1 no-press or excess press |
| `chord_size`     | objects in this trial (1–3)                                                |
| `cycle`          | 0-based drop cycle index                                                 |

Scoring is press-intrinsic (decided the moment the key goes down); for
chords, correct presses are attributed to their own object and wrong presses
to the nearest remaining object (optimal assignment, deterministic
tie-break) after the drop resolves.

### Measurement notes for analysis

- Keyboard scan + OS + browser add a roughly constant 5–30 ms latency per
  device; treat `press_ms` as *relative* within a run, not absolute.
- Firefox quantizes event timestamps to ~2 ms by default; the run record in
  `localStorage` stores the user agent for each run.
- **Keyboard rollover**: Q/W/E sit in a classic ghosting cluster on 2-key
  rollover keyboards, so 3-object chords can silently drop a key and be
  misrecorded as an omission. The press-all gate's chord check surfaces
  this; prefer NKRO keyboards for chord experiments.

## Architecture notes

All experimental quantities are computed from timestamps on the
`performance.now()` timeline (`KeyboardEvent.timeStamp`, sanity-checked at
startup): trial windows are precomputed at run start and presses are
classified analytically against them. Rendering is a pure projection of
that timeline — dropped or janky frames cannot contaminate the data. See
`src/core/` (clock, trial generation, run controller, reconciliation), all
covered by `npm test`.

## Housekeeping

*(repo/package name: `button-mashers`; CSV files keep the `bm_` prefix)*

