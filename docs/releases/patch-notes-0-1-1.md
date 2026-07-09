# PATCH NOTES: V0.1.1

This patch adds logic and gameplay elements to encourage pressing the exact
correct number of buttons during each cycle, plus a new name (**Tideline**)
and an endless-mode continuation. **Unlike v0.1.0, this patch changes
scoring and the exported data** — see *Data changes* at the bottom.

## Fingers
- Finger crosshairs now become translucent after presses, and all of them
  fade once every press in the cycle has been consumed — opaque crosshairs
  indicate options that can still be pressed for points. They fade back to
  full visibility smoothly over the first half-second of each new cycle.
- Faded crosshairs still visually react to presses (the press flash and
  held-key fill render at full strength).

## Objects
- A 'damaged' (cracked) version of each object is shown after early/late
  presses; the object stays afloat and can still be caught or glanced.

## General gameplay
- Early/late presses still give +0 points.
- Early/late presses now apply 'damage': to the object in the same column
  as the pressed finger when that object is a target and still intact,
  otherwise to a random intact, not-yet-damaged object. *(Amended: if every
  intact object is already damaged, nothing further happens.)*
- Damage only applies to valid (counted) early/late presses — never to
  excess presses.
- When the per-cycle press limit (= number of objects) is reached, all
  crosshairs fade; they return to full opacity at the start of the next
  cycle.
- Non-presses and excess presses now give **−1 point each** (shown in red).
  *(Amended per design decision: the non-press penalty is per object —
  ignoring a 3-object wave costs −3.)*
- Spamming buttons will lose a lot of points!!
- At the end of a run (including aborted runs), pressing all buttons starts
  a new run with the same settings. *(Amended: the completion screen stays
  up meanwhile — scores can still be saved manually before, between, or
  after runs; every run also remains in the lobby's past-runs list.)*

## Multi-object gameplay
- Damage works as described above.
- Each press turns its own finger's crosshair translucent, until the press
  limit is reached (then all turn translucent).
- Fade animations are synced for near-simultaneous presses: the fade starts
  one timing-window after the *first* press of the cycle, so chord presses
  made within the window fade together. Game logic (presses, "ammo", and
  timing classification) is unchanged by this delay.

## UI
- The game is now called **Tideline**. *(Amended: display name only — the
  package/repo name and the `bm_` CSV filename prefix are unchanged.)*

## Data changes (analyst-facing)

- The `points` column can now be negative: unattributed objects score
  `noPress` (−1) instead of 0.
- Excess presses produce **their own CSV rows** with
  `target_finger`/`target_hand` = `'x'`, the pressed finger/hand, the
  press's peak-relative `press_ms`, and `points` = −1. A trial can
  therefore have more rows than its chord size; filter `target_finger !=
  'x'` to recover the per-object view.
- The `points` column now sums exactly to the displayed run score.
- New config keys: `scoring.earlyLate`, `scoring.noPress`,
  `scoring.excessPress` (replacing `scoring.miss`).
