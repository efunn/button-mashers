# PATCH NOTES: V0.1.4

Adds a 4-finger mode on desktop and reworks the mobile control layouts to
support 3-, 4-, and 5-finger play. **No changes to game logic, timing,
hitboxes, scoring, or recorded data** — counterbalancing simply falls out
of the existing scheduler with the new finger counts.

## General gameplay (desktop)
- The finger-count selector now offers **3, 4, and 5** (was 3 or 5).
- **4-finger** = the four non-thumb fingers: little/ring/middle/index
  (Q-W-E-R on the left, U-I-O-P on the right). Comfortable default — no
  thumb, no spacebar, hands rest on the home row. *(Amended: the set is
  configurable via the new `modes.fourFingerSet`, mirroring
  `threeFingerSet`; it defaults to the non-thumb four.)*
- 5-finger and 3-finger are unchanged.

## General gameplay (mobile)
- Mobile now offers **3-, 4-, and 5-finger** layouts; **4 is the default**
  (configurable via `modes.mobile.fingers`). Chords stay capped at
  `mobile.maxChord` and play remains single-hand.
- **4-finger mobile:** four finger buttons filling the region from the
  bottom of the screen up to the bottom of the wave (tall touch targets).
- **5-finger mobile:** the thumb becomes a **full-width button** across the
  very bottom, with the four finger buttons in a row above it — the "thumb
  underneath" experimental layout.
- *(Amended: touch buttons are laid out in on-screen column order, so the
  left-hand colors are not mirrored; the control area's top is anchored to
  the wave's lowest waterline and follows resizes.)*

## Config
- New `modes.fourFingerSet` (array of 4 finger codes; defaults to
  `["i","m","r","l"]` so older configs stay valid).
- `modes.mobile.fingers` now sets the **default** mobile finger count
  (shipped default bumped 3 → 4) rather than forcing 3-finger-only.
