# project overview

# goal

A web-based human experimental data collection system to measure finger error behavior. On the surface, a game (eventually, a set of games) involving typing or tapping, falling roughly in the 'guitar hero' style of games. Please do not make it look like guitar hero, but taking design cues from rhythm games is ok. The game is not synced up to music (it could be later, but everything should function purely visually). It should look GOOD, but looks should not come in the way of visual precision.

# architecture

- static site
- game parameters loaded from human readable config
- record data in localStorage and save/download it as a .csv

# basic game mechanic

- a small wave, or ripple, periodic laps at the edge of a pond. The shoreline is horizontal. The view is quite zoomed in (about 1:1, as if it is the correct scale to manipulate with your hands).
- your fingers (not literally shown, but with a visual indicator) lie fixed above the pond, just beyond the shoreline
- the ripples bring objects just in reach of your fingers, and then back out, lost forever unless you capture them
- The ripple moves at a constant frequency in and out (say, 0.5Hz or reaching the fingers once every 2 seconds)
- objects must be caught within a timing window (say, 200ms) corresponding to the time where the object lies under the fingers

# controls
- desktop: q-w-e-r-v and n-u-i-o-p keys correspond to the fingers of the left and right hands
- game can be played left hand only, right hand only, or both hands; can be all 5 fingers or only the 3 central ones
- mobile: 3 fingers only (virtual buttons at the bottom of the screen); not really intended for serious data collection but should still demo the game mechanics 

# single object

- as the ripple approaches, an object appear in the water at a pseudorandomized distance from the fingers, corresponding to a possible reaction time (e.g. spawning 300ms away -> adding 200ms response window, corresponds to a maximum 500ms reaction time to grab the object).
- at the beginning of each 'run' (about 5 minutes, or 150 object events), pregenerate the object targets and timings (actual number of events should be scaled to ensure counterbalancing of the experiment, e.g. 5 fingers + 5 different timings should modulo into 150, but 3 fingers and 8 timings might want 168 events).
- objects are generated vertically above each 'finger'; objects have a unique color for each finger (mirrored across the hands, although each hand should have a different object shape).
- only the first key press in a cycle counts (resets when the ripple hits its apex away from the player)
- successfully capturing an object should 'pop' it in a satisfying way and gain points
- not pressing at all or pressing too early/late has the worst point outcome (probably just 0 for now, but could be negative)
- pressing the wrong finger but at the right time is the middle outcome (at least 0 points)
- points are visually awarded at the time of press (or in the case of an object that floats back out and disappears, when it is safely out of reach and if no button has been pressed)
- scoring should encourage pressing even with impossible timing windows. Let's start with correct = 3 points, wrong finger = 1 point, early/late/none = 0 points

# multiple objects
- these work like 'chords': multiple items will simultaneously wash up
- each 'run' targets a certain number of objects (2 or 3, for now, and only targeting one hand at a time). 
- scoring should work for each finger individually (but up to 2/3 presses should be recorded/counted, compared to only 1 per cycle in the single object scenario)
- for mobile, can implement 2 object version only
- rest of design should be similar to single finger, but let me know if you see issues here

# gameplay loop
- the player spawns into a lobby screen with a randomized plaintext identifier. optionally, they can enter a nickname
- the lobby screen should show the game idle in the background
- the game select options are shown (num fingers/num objects/difficulty), with the controls for the selected mode updating at the bottom of the screen (for example: 10 finger version with 3 objects shows 10 finger indicators with 3 objects floating out of reach); for desktop the letters for each finger should also be indicated (q-w-e-r-v or whatever)
- "PRESS ALL TO START": after selecting the mode, pressing each of the controls highlights it; when all are highlighted, the game starts
- after each run, save a csv of the data and return to the lobby

# data recording
- for each object, record the trial number, target finger (t/i/m/r/l), target hand (l/r), pressed finger (t/i/m/r/l), pressed hand (l/r), target timing window in milliseconds (determined by previous pseudorandomization) and time of press in rounded milliseconds (centered around the ripple peak towards the finger, e.g. a perfect press = 0, early press = -152, late press = 253)
- for non-presses, set pressed finger and hand to 'x'
- in the case of chords, associate correct presses to the correct object, and incorrect presses to the nearest object (probably requires reconciling after the trial is over/presses are all consumed)
- user's randomized identifier, nickname (if selected), and game mode selection should be included in the .csv filename