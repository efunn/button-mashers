# game-config.json reference

Loaded at boot from `public/game-config.json` (served next to the bundle, so
it can be edited on the deployed server without rebuilding). `//` and
`/* */` comments are allowed. Every field is required unless noted; the
loader fails fast with the offending path.

## ripple

| field                  | type   | meaning                                                                                      |
| ---------------------- | ------ | -------------------------------------------------------------------------------------------- |
| `frequencyHz`          | number | Ripple cycles per second. Default ≈0.33 → one wave (one trial) every ~3 s.                   |
| `captureWindowMs`      | number | Total width of the capture window. Centered on the moment the ripple peak reaches the fingers: with 200, presses within ±100 ms score. |
| `windowCenterOffsetMs` | number | Shifts the window center relative to the peak (0 = symmetric). Escape hatch if the design needs an asymmetric window, e.g. ending exactly at the peak. |
| `amplitudePx`          | number | Visual travel of the water edge in px, hand-tuned for the default frequency/window. Clamped to the viewport. **Rendering only** — never affects timing or data. |

## difficulties

A map of difficulty name → `{ "reactionTimesMs": [...] }`. Names appear
verbatim in the lobby selector and the CSV filename.

`reactionTimesMs` are the timing conditions: the time from object spawn to
the **end** of the capture window (the spec's "spawn 300 ms away + 200 ms
window = 500 ms maximum reaction time"). Each value is fully counterbalanced
against every target. Values near or below the simple-reaction floor
(~250 ms) are intentionally impossible and probe finger-selection errors.

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

## visuals

| field                  | meaning                                                        |
| ---------------------- | --------------------------------------------------------------- |
| `fingerColors`         | Hex color per finger, mirrored across hands.                    |
| `handShapes`           | `"leaf"` or `"shell"` per hand (distinct silhouettes per hand). |
| `popDurationMs`        | Capture pop animation length.                                   |
| `scoreFloatDurationMs` | Rising score text length.                                       |

## modes

| field             | meaning                                                                |
| ----------------- | ----------------------------------------------------------------------- |
| `threeFingerSet`  | Which 3 fingers the 3-finger mode uses (default index/middle/ring).     |
| `mobile.fingers`  | Fingers on touch devices (3).                                            |
| `mobile.maxChord` | Chord cap on touch devices (2).                                          |
