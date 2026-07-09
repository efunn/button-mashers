# PATCH NOTES: V0.1.3

Audio, one-handed ergonomics, difficulty rebalance, a glint performance
fix, and two mobile bug fixes. **No data/CSV format changes** — the only
experiment-relevant change is the new default reaction-time sets.

## General gameplay
- For single left/right hand gameplay, the spacebar (shown as `_` in the
  key hints) replaces V/N for thumb presses; V/N remain the thumbs in
  ten-finger mode. *(Amended details: the replaced key becomes unmapped for
  the played hand, the idle hand's keys — including its thumb key — still
  register as recordable wrong-hand presses, and the spacebar mapping also
  applies in 3-finger single-hand modes, where a thumb press counts as a
  wrong finger. The key is configurable via `modes.singleHandThumbKey`.)*
- Added a soothing audio track that lines up with the wave frequency — a
  filtered wash that swells into each peak — including a specific but
  gentle chime at the peak of the timing window. *(Amended: fully
  synthesized via WebAudio, no audio assets; scheduled from the same
  clock that drives the experiment so it stays aligned regardless of frame
  rate; game timing is never derived from audio.)*
- Added subtle audio cues for each score outcome: rising third for a
  correct catch, neutral tone for wrong-finger, low thud for early/late, a
  flat buzz for excess presses, and a soft descending sigh when objects
  float away. *(Amended: audio volume is configurable via
  `audio.masterVolume`; set 0 to disable for silent data collection.)*

## Player balance
- The default timing window is 250ms (formalizing the current setting).
- All difficulties now include one impossible timing (150ms):
  - easy: **150**, 500, 650, 800, 1000
  - medium: **150, 225**, 450, 600, 800
  - hard: **150, 225, 300**, 400, 500 (unchanged)
  *(Note: this changes the experimental conditions relative to v0.1.2
  data — treat difficulty sets before/after as different designs.)*

## Performance
- Improved performance during glinting, especially in 10-finger mode on
  slower hardware. *(Amended with the cause: crosshair glow used canvas
  `shadowBlur`, which is very slow on weak GPUs; glows are now cached
  radial-gradient sprites drawn per frame.)*

## Bug fixes
- Fixed mobile controls extending beyond the bottom of the screen. *(Root
  cause: the stage was sized with `100vh`, which includes the area behind
  the mobile browser chrome; it now uses `100dvh`.)*
- Fixed control colors being mirrored left-to-right on mobile when the
  left hand was selected. *(Root cause: touch buttons were built in config
  order rather than on-screen column order; they now use the same
  left-to-right display ordering as the canvas.)*
