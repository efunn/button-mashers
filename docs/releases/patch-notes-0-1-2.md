# PATCH NOTES: V0.1.2

A score display bug fix and a few general gameplay/experience improvements.
No data or scoring changes.

## Bug fixes
- Fixed a bug where a −1 score display would appear over an object slipping
  back into the water even though a slow/fast press on a non-target finger
  was going to be attributed to it (cosmetic only — recorded scores were
  always correct). *(Amended with the root cause: the "lost object"
  feedback only checked for presses on the object's own finger; it now runs
  the same press-to-object reconciliation the data layer uses, so an object
  that a counted wrong-finger press will claim no longer shows the no-press
  penalty.)*

## General improvements
- Runs can be aborted with the escape key at any time, returning straight
  to shore (the lobby) — for example if the difficulty is set too high or
  too easy. *(Amended: the partial run is still saved to the browser with
  the aborted flag and remains exportable from the lobby's past-runs list;
  escape from the press-all, countdown, and run-complete screens goes back
  to the lobby as before.)*
- Moved the finger markers closer together in two-handed mode (finger
  spacing capped at 80px instead of 110px); the between-hands gap is 1.5×
  the finger spacing.
- Added a favicon of the shell.
