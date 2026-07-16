# game-config.json reference

Loaded at boot from `public/game-config.json` (served next to the bundle, so
it can be edited on the deployed server without rebuilding). `//` and
`/* */` comments are allowed. Every field is required unless noted; the
loader fails fast with the offending path.

## timing

| field                  | type   | meaning                                                                                      |
| ---------------------- | ------ | -------------------------------------------------------------------------------------------- |
| `captureWindowMs`      | number | Total width of the capture window. Centered on the moment the band crosses the target line: with 250, presses within ±125 ms score. |
| `windowCenterOffsetMs` | number | Shifts the window center relative to the peak (0 = symmetric). Escape hatch if the design needs an asymmetric window, e.g. ending exactly at the peak. |

## speeds / defaultSpeed / fall

| field            | meaning                                                                        |
| ---------------- | ------------------------------------------------------------------------------ |
| `speeds`         | Named periods between objects in ms (e.g. slow/fast/extreme = 1500/1000/500). Names appear in the lobby selector and the CSV filename. |
| `defaultSpeed`   | Which speed the lobby preselects. Must be a key of `speeds`.                   |
| `fall.fadeLeadMs`| How long before its crossing a band fades in near the top of the screen (whole trajectory prespawned). Must exceed the longest reaction time + half window; the validator warns otherwise. **Rendering only.** |

## difficulties

A map of difficulty name → `{ "reactionTimesMs": [...] }`. Names appear
verbatim in the lobby selector and the CSV filename.

`reactionTimesMs` are the timing conditions: the time from the band's
**reveal** (the neutral band morphing into the target) to the **end** of
the capture window — i.e. the maximum reaction time available. Each value is fully counterbalanced
against every target. Values near or below the simple-reaction floor
(~250–300 ms) are intentionally impossible and probe finger-selection
errors; the shipped defaults give every difficulty at least one impossible
timing (150 ms — easy has one, medium two, hard three).

## run

| field              | type             | meaning                                                                             |
| ------------------ | ---------------- | ------------------------------------------------------------------------------------ |
| `targetTrialCount` | number           | Desired trials per run. The actual count is the smallest fully counterbalanced multiple ≥ this that fits the bounds (default 100: 25 conditions → 100; 24 → 120). |
| `trialCountBounds` | [number, number] | Acceptable [min, max] total trials. If no counterbalanced multiple fits, the closest one is used and the lobby shows a warning. |

## scoring

| field         | meaning                                                        |
| ------------- | --------------------------------------------------------------- |
| `correct`     | Correct finger inside the window.                               |
| `wrongFinger` | Wrong finger inside the window.                                 |
| `earlyLate`   | A counted press outside the window.                             |
| `noPress`     | Each target object that floats away without an attributed press. |
| `excessPress` | Each press beyond the per-cycle limit (or a repeated key).       |

Press points are decided at press time and don't depend on chord
attribution; `noPress` is applied per object when the cycle resolves.

## keys

`KeyboardEvent.code` values (physical key positions — layout-independent)
per hand (`l`/`r`) and finger (`t`/`i`/`m`/`r`/`l` = thumb…little).
Duplicate codes are rejected. Remapping here is safe; the UI labels follow.

In single-hand modes the played hand's thumb key is replaced by
`modes.singleHandThumbKey` (default `"Space"`, displayed as `_`); the
replaced key becomes unmapped for that mode.

## audio

| field          | meaning                                                          |
| -------------- | ----------------------------------------------------------------- |
| `masterVolume` | 0–1 gain for the synthesized soundscape; `0` disables audio. Optional block (defaults to 0.5). |

## visuals

| field                  | meaning                                                        |
| ---------------------- | --------------------------------------------------------------- |
| `fingerColors`         | Hex color per finger, mirrored across hands.                    |
| `handShapes`           | `"diamond"` or `"circle"` per hand (distinct silhouettes per hand). |
| `popDurationMs`        | Capture pop animation length.                                   |
| `scoreFloatDurationMs` | Rising score text length.                                       |
| `glowIntensity`        | 0–1 strength of the crosshair halo during the window; `0` (default) shows only the ring swell and glint arc. Optional. |

## modes

| field             | meaning                                                                |
| ----------------- | ----------------------------------------------------------------------- |
| `threeFingerSet`  | Which 3 fingers the 3-finger mode uses (default index/middle/ring).     |
| `fourFingerSet`   | Which 4 fingers the 4-finger mode uses (default the non-thumb four). Optional; defaults to `["i","m","r","l"]`. |
| `mobile.fingers`  | Default finger count on touch devices (3/4/5; shipped default 4). Users can still switch. |
| `mobile.maxChord` | Chord cap on touch devices (2).                                          |
