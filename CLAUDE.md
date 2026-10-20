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

## Memories experiment (`memories.html`)

Glowing cat-memory marbles instead of sand. Sixteen cat balls on offer, coloured by the mood meter (pleasant + calm green, pleasant + energetic yellow, unpleasant + calm blue, unpleasant + energetic red; each ball its own shade within its family): a main row of five (`PICKER`: Happy, Sad, Scared, Confused, Calm) plus a More button that opens a scrollable side panel with the rest (`MORE_GROUPS`, grouped under colour headings: yellow Excited, Curious, Silly, Hungry; green Chill, Focused; blue Bored; red Angry, Nervous, Worried, Upset). When adding a cat, pick its quadrant and a new shade in that family. Hungry uses a still frame of the tongue-out cat; Playful (id 13) used the same cat and is left out of the panel but kept in `MOODS` so old drops still draw. `MOODS` index is the colour id stored in drops, so never reorder or remove entries; add new ones at the end. Cat photos live in `images/cat-*.webp`: the cat is cut out of its photo with macOS Vision subject lifting (transparent background), then the face is cropped, bulged like seen through glass and cut to a circle. `paintMarble` fills behind the cat with a light wash of the ball's colour and adds edge shading and glints; the cat itself is not tinted. Calm uses the sleeping kitten because the user's preferred calm photos were watermarked. Drawn faces (`faceSvg`) remain available for any marble without a photo. Never use watermarked stock photos (Adobe Stock, Shutterstock, etc.), product photos, or professional photos of trademarked celebrity pets (e.g. Grumpy Cat) on the public site. Same modes (`memories.html#play`, `#display`, `#teacher-CODE`). Same sync design: ordered drop log, commit horizon, checkpoints and rollback. Marble settling (`settle`) must stay deterministic like sand placement: seeded `rng32`, plain arithmetic and `Math.sqrt` only. Each new marble falls, bounces and rolls until it rests (`roll`). Merging (`place`, `findMerge`): when a marble comes to rest touching a same-kind marble, and a marble with their combined area (r = sqrt(r1^2 + r2^2), agar.io style) fits at their area-weighted centre or up to one radius above it without overlapping anything, the two are replaced by that bigger marble, which then rolls to rest. Marbles left unsupported then drop into the gap (`supported`: floor, two marbles below, or one below plus a wall), and anything that comes to rest is checked for merges again, so chains can happen. Balls have their own radius `r` and memory count `n`; the counter shows total memories. New drops have radius 18. Each live drop records a frame timeline (`makeTimeline`) for animation; replays don't animate. Checkpoints deep-copy balls because settling mutates them.

Its drops live in Firebase at `pours/c<gen>` (the earlier nine-colour marble test used `pours/m<gen>`) and its screens report modes `mplay`/`mdisplay`, so it works under the existing rules. Both pages share `state/gen`, so Start fresh on either page clears both.

## Files

- `index.html`: the whole game (HTML, CSS and JS in one file).
- `config.js`: public Firebase settings. Fine to commit.
- `database.rules.json`: template for the Firebase security rules. Ignored by git on purpose: the user puts their teacher code into the copy in the Firebase console, never in the repo. If the rules change, tell the user to paste the new version into Firebase and re-enter their code.
- `README.md`: setup guide for teachers.

## Things that must stay true

- Modes come from the URL hash: `#play` (default), `#display`, `#teacher-CODE` (display plus Start fresh).
- Every screen must compute the identical picture. Pour placement (`settle`, `pourAt`, `walk`, `applyChunk`) must use only the seeded `rng32` and plain arithmetic: no `Math.random`, `Math.sin`, `Math.cos` or `Math.hypot` there. Changing the grid size (480x300), the pour format or placement rules changes the picture for everyone; old pours in Firebase will replay differently, so suggest Start fresh after such a change.
- Cosmetic falling particles may use `Math.random`.
