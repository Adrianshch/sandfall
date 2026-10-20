# Sandfall

Shared classroom falling-sand game, hosted on GitHub Pages and synced through Firebase Realtime Database.

## Updating the live site

The `main` branch is the website. GitHub Pages republishes it within a minute or two of every push.

- Repo: https://github.com/Adrianshch/sandfall
- Site: https://adrianshch.github.io/sandfall/ (`#play`, `#display`, `#teacher-CODE`)

After a change the user asked for: check it, commit with a short message, then `git push`. Then tell the user the site will update in a minute or two at the GitHub Pages address.

## Files

- `index.html`: the whole game (HTML, CSS and JS in one file).
- `config.js`: public Firebase settings. Fine to commit.
- `database.rules.json`: template for the Firebase security rules. Ignored by git on purpose: the user puts their teacher code into the copy in the Firebase console, never in the repo. If the rules change, tell the user to paste the new version into Firebase and re-enter their code.
- `README.md`: setup guide for teachers.

## Things that must stay true

- Modes come from the URL hash: `#play` (default), `#display`, `#teacher-CODE` (display plus Start fresh).
- Every screen must compute the identical picture. Pour placement (`settle`, `pourAt`, `walk`, `applyChunk`) must use only the seeded `rng32` and plain arithmetic: no `Math.random`, `Math.sin`, `Math.cos` or `Math.hypot` there. Changing the grid size (480x300), the pour format or placement rules changes the picture for everyone; old pours in Firebase will replay differently, so suggest Start fresh after such a change.
- Cosmetic falling particles may use `Math.random`.
