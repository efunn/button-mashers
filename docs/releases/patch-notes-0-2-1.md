# PATCH NOTES: V0.2.1

Audio updates for the new visual paradigm with minor visual fixes. No
gameplay, timing, or data changes.

## Audio
- The soothing wave sounds have been removed — there is no background track
  anymore; feel free to vibe to your own (120bpm?) music. *(Amended: the
  whole noise-wash synth chain is gone, not just muted.)*
- The chime at the timing window has been replaced with a **low-frequency
  pulse** (a soft-attack ~200Hz swell centered on the window, distinct from
  the sharper early/late thud). *(Amended: pre-scheduled pulses are routed
  through a mutable gain node, so aborting a run now silences pulses that
  were already scheduled a couple of seconds ahead — previously a stray
  chime could sound after an abort.)*
- The +3 score sound is now more rewarding: a rising three-note major
  arpeggio with an octave sparkle on top. All other score sounds (wrong
  finger, early/late, excess, no-press) are unchanged.

## Visual
- The sideways-moving glint on the falling neutral band has been removed
  (the band is now a plain gradient bar — one less motion cue competing
  with the reveal).
