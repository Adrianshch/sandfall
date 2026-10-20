# Sandfall

Shared classroom falling-sand game, hosted on GitHub Pages and synced through Firebase Realtime Database.

## Updating the live site

The `main` branch is the website. GitHub Pages republishes it within a minute or two of every push.

- Repo: https://github.com/Adrianshch/sandfall
- Site: https://adrianshch.github.io/sandfall/ (`#play`, `#display`, `#teacher-CODE`)

After a change the user asked for: check it, commit with a short message, then `git push`. Then tell the user the site will update in a minute or two at the GitHub Pages address.

## Versions

Named versions are git tags (`git tag -l`). When the user says "save this as version N", make an annotated tag `vN` on the current commit and push it (`git push origin vN`).

- `v1` (2026-10-20): first working classroom version. Nine feelings (Happy, Sad, Mad, Scared, Worried, Excited, Sleepy, Calm, Proud), play/display/teacher modes, Firebase sync with teacher-code Start fresh.

- `v2` (2026-10-20): emotion-card picker. Nine framed cards in poster order and colors (Sadness, Disgust, Ennui, Anger, Anxiety, Embarrassment, Envy, Fear, Joy) with original drawn faces; Joy selected by default. Do not use the Inside Out character artwork from the user's reference image: it is copyrighted and the site is public.

To go back to a version, restore its files onto `main` with a new commit (`git checkout vN -- .` then commit and push) instead of rewriting history, so the site and every later version stay intact.

## Cat Emotions experiment (`memories.html`, page title "Cat Emotions")

Glowing cat-memory marbles instead of sand. Sixteen cat balls on offer, coloured by the mood meter (pleasant + calm green, pleasant + energetic yellow, unpleasant + calm blue, unpleasant + energetic red; each ball its own shade within its family): a main row of five (`PICKER`: Happy, Sad, Scared, Confused, Calm) plus a More button that opens a scrollable side panel listing every cat, starters included, grouped under colour headings (`MORE_GROUPS`: yellow Happy, Excited, Curious, Silly, Hungry; green Calm, Chill, Focused; blue Sad, Confused, Bored, Tired; red Scared, Angry, Nervous, Upset). Panel copies of starter buttons get ids ending in `-more`. Worried (id 15) and Playful (id 13) are retired from the panel but stay in `MOODS` so old drops still draw. When adding a cat, pick its quadrant and a new shade in that family. Hungry uses a still frame of the tongue-out cat; Playful (id 13) used the same cat and is left out of the panel but kept in `MOODS` so old drops still draw. `MOODS` index is the colour id stored in drops, so never reorder or remove entries; add new ones at the end. Cat photos live in `images/cat-*.webp`: the cat is cut out of its photo with macOS Vision subject lifting (transparent background), then the face is cropped, bulged like seen through glass and cut to a circle. `paintMarble` fills behind the cat with a light wash of the ball's colour and adds edge shading and glints; the cat itself is not tinted. GitHub Pages lets browsers cache files for 10 minutes, so whenever a cat picture changes, bump `ASSET_V` in memories.html (image URLs carry `?v=ASSET_V`), and tell the user a hard refresh (Cmd+Shift+R) shows the update immediately. Calm uses the sleeping kitten because the user's preferred calm photos were watermarked. Drawn faces (`faceSvg`) remain available for any marble without a photo. Never use watermarked stock photos (Adobe Stock, Shutterstock, etc.), product photos, or professional photos of trademarked celebrity pets (e.g. Grumpy Cat) on the public site. Same modes (`memories.html#play`, `#display`, `#teacher-CODE`). Same sync design: ordered drop log, commit horizon, checkpoints and rollback. Marble settling (`settle`) must stay deterministic like sand placement: seeded `rng32`, plain arithmetic and `Math.sqrt` only. Marbles push each other (`simulate`): settled marbles sleep; moving ones fall, bounce and roll, and a hit harder than `WAKE_V` (scaled by weight, capped at 2x) wakes a sleeping marble so it gets knocked along. Moving pairs share pushes by weight, except a marble pinned against the floor or a wall doesn't give way (`shares`, `pinned`). After each event `playOut` repeats: wake marbles near spots where something left that lost support, simulate, pour loose sand, then a whole-box cleanup (`relaxAll`) pushes every overlapping pair apart, then any touching same-kind pair combines (`anyMerge`), until nothing changes. Merging (`place`, `findMerge`): when a marble comes to rest touching a same-kind marble, and a marble with their combined area (r = sqrt(r1^2 + r2^2), agar.io style) fits at their area-weighted centre or up to one radius above it without overlapping anything, the two are replaced by that bigger marble, which then rolls to rest. Marbles left unsupported then drop into the gap (`supported`: floor, two marbles below, or one below plus a wall), and anything that comes to rest is checked for merges again, so chains can happen. Balls have their own radius `r` and memory count `n`; the counter shows total memories. Popping (`pop`): a drop log entry with `l: 1` is a tap at `p`; it removes the smallest marble under that point and turns about half its area into sand (2x2-unit grains in a 240x150 grid, `sand`, coloured from the marble's colour), scattered up to 1.2 radii and poured grain by grain (`pourGrain`) through open cells only, so sand never appears in sealed space. Marbles collide with sand grains, rest on them, and sand left hanging pours down (`pourLooseSand`). After anything is removed or moves, only marbles near that spot are rechecked for support (`dropLoose` with `gone` spots); never recheck every marble on every event (it was 5x slower). Checkpoints store the sand grid too. New drops have radius 18. Each live drop records a frame timeline (`makeTimeline`) for animation; replays don't animate. Checkpoints deep-copy balls because settling mutates them.

Its drops live in Firebase at `pours/c<gen>` (the earlier nine-colour marble test used `pours/m<gen>`) and its screens report modes `mplay`/`mdisplay`, so it works under the existing rules. Both pages share `state/gen`, so Start fresh on either page clears both.


### Memories: keeping it smooth (kids spam it)

- Drawing: settled marbles are drawn once into a cached layer (`layer`, rebuilt when `worldVersion`, `animsVersion` or the popping set changes); sand is a 240x150 canvas updated only when the world changes or grains are flying. Only moving/bursting marbles draw every frame. Keep it that way.
- Work per frame: replayed events run in full, new (animated) events stop after 8 ms of work per frame and continue next frame (`commit(frameStart)`).
- Each screen does at most one drop or pop every 350 ms (`ACTION_GAP`); faster taps are ignored on purpose.
- New events (never committed before) share an 8 ms budget per frame, including a big catch-up when a screen joins late; replays after a late arrival run in full so nothing flickers.
- A marble that appears in several overlapping animations is drawn once, from the newest.
- The dock shows `build YYYY-MM-DDx`; change it on every update so the user can check a screen has the latest version (GitHub Pages caches for 10 minutes).
- Pops carry the tapped marble's id (`t`) so they hit the marble the child saw, even mid-fall; the tapped marble starts bursting on that screen immediately (`popping`).
- Merging is immediate: `simulate` stops the moment two same-kind marbles touch (`lastHit`), they combine right away (6-frame animation), and marbles still moving carry on with their speed (`lastFlying`).
- No shivering: contacts slower than 1 unit/step don't bounce, and recorded motion is smoothed over 5 frames for display (`finish`).
- Taps: the whole glowing ball counts (radius x1.3 + 3); a tap on a ball that is still appearing does nothing.
- Touching same-kind marbles always combine (nearest open spot above, else dropped from the top; if the box is full they stay apart). After every roll the marble is pushed out of neighbours and, if still wedged, moved to the nearest clear spot in fixed directions; grains it was nudged into are moved over its top (`shiftSandOut`).
- Physics tests live in the conversation scratchpad, not the repo; when changing physics, re-check that shuffled arrival orders give identical marbles and sand, and that nothing overlaps.

## Files

- `index.html`: the whole game (HTML, CSS and JS in one file).
- `config.js`: public Firebase settings. Fine to commit.
- `database.rules.json`: template for the Firebase security rules. Ignored by git on purpose: the user puts their teacher code into the copy in the Firebase console, never in the repo. If the rules change, tell the user to paste the new version into Firebase and re-enter their code.
- `README.md`: setup guide for teachers.

## Things that must stay true

- Modes come from the URL hash: `#play` (default), `#display`, `#teacher-CODE` (display plus Start fresh).
- Every screen must compute the identical picture. Pour placement (`settle`, `pourAt`, `walk`, `applyChunk`) must use only the seeded `rng32` and plain arithmetic: no `Math.random`, `Math.sin`, `Math.cos` or `Math.hypot` there. Changing the grid size (480x300), the pour format or placement rules changes the picture for everyone; old pours in Firebase will replay differently, so suggest Start fresh after such a change.
- Cosmetic falling particles may use `Math.random`.
