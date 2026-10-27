# Cat Emotions cubbies (v6)

Each student gets their own cubby: a private cat-memory sand picture that only they can change. The class wall shows every cubby at once, live, with no names.

| Link | Who opens it | What it does |
|---|---|---|
| `https://adrianshch.github.io/sandfall/sandfall/` | Each student's tablet | Pick **I'm new** or **I've been here before**, type a username, then make art in their cubby. **Balls** drops cat memories (tap one to pop it into sand); **Sand** turns the cursor into the chosen cat and pours its sand while held |
| `https://adrianshch.github.io/sandfall/sandfall/display/` | Projector or TV | Every cubby at once, no names |
| `https://adrianshch.github.io/sandfall/sandfall/admin-cappy/` | You | The wall again; tap a cubby to remove it |

- **Usernames** are the only key to a cubby, so students should keep theirs to themselves. Capitals and extra spaces don't matter (`Maya Lee` = `maya lee`). A new student can't take a name that's already in use. A returning student who types a name that doesn't exist gets a new cubby with that name.
- **Leaving a cubby:** refresh the page. It always goes back to the start.
- **Deleting:** a student can delete their own cubby (button at the top right). You can remove any cubby from the admin link. Either way the art is gone for good and the username is free again.
- **No names are stored.** The database keeps only a scrambled code made from each username, so nobody can read the usernames there, not even you.
- Cubbies stay until deleted. **Start fresh** on the older pages doesn't touch them.

## One-time setup: add the cubby rules to Firebase

Do this once, or the cubby pages will say "Ask your teacher to check the setup".

1. Open https://console.firebase.google.com, pick your project, then **Realtime Database → Rules**.
2. Near the top, find the line `"rules": {`. Click at the very end of that line and press **Enter**.
3. Paste the block below there. Don't change anything else, and leave your teacher code where it is.
4. Click **Publish**. If Firebase shows a red error, the paste landed in the wrong spot: undo and try again.

```json
    "cubbies": {
      ".read": true,
      "$id": {
        ".write": "(!data.exists() && $id.matches(/^[0-9a-f]{64}$/)) || !newData.exists()",
        ".validate": "newData.hasChildren(['made'])",
        "made": { ".validate": "newData.isNumber()" },
        "$other": { ".validate": false }
      }
    },
    "drops": {
      ".read": true,
      "$id": {
        ".indexOn": ["k"],
        ".write": "!newData.exists()",
        "$drop": {
          ".write": "!data.exists() && root.child('cubbies/' + $id).exists()",
          ".validate": "newData.hasChildren(['i', 'k', 'c', 'r', 's', 'l', 'p'])",
          "i": { ".validate": "newData.val() === $drop && $drop.length <= 64" },
          "k": { ".validate": "newData.isNumber()" },
          "c": { ".validate": "newData.isNumber()" },
          "r": { ".validate": "newData.isNumber()" },
          "s": { ".validate": "newData.isNumber()" },
          "l": { ".validate": "newData.isNumber()" },
          "p": { ".validate": "newData.isString() && newData.val().length <= 400" },
          "t": { ".validate": "newData.isString() && newData.val().length <= 120" },
          "$other": { ".validate": false }
        }
      }
    },
    "snaps": {
      ".read": true,
      "$id": {
        ".write": "!newData.exists() || root.child('cubbies/' + $id).exists()",
        ".validate": "newData.hasChildren(['v', 'k', 'i', 'n', 'b', 's'])",
        "v": { ".validate": "newData.isNumber()" },
        "k": { ".validate": "newData.isNumber()" },
        "i": { ".validate": "newData.isString() && newData.val().length <= 64" },
        "n": { ".validate": "newData.isNumber()" },
        "b": { ".validate": "newData.isString() && newData.val().length <= 1000000" },
        "s": { ".validate": "newData.isString() && newData.val().length <= 3000000" },
        "$other": { ".validate": false }
      }
    },
```

## Good to know (v6)

- The wall downloads every cubby when it opens. Each student's tablet also saves a compact picture of its cubby now and then, so the wall doesn't have to replay every tap since the start. A brand-new wall shows **Catching up…** in its status pill until all the cubbies are drawn.
- The admin link works for anyone who knows it, and the repository is public, so treat it like a shared secret. The rules can't tell you apart from a student without sign-in, so a tech-savvy student could also delete cubbies straight from the database. Same trust as before: this is a classroom tool, not a vault.

---

The rest of this guide is the original Sandfall setup (the Firebase project and GitHub Pages), which v6 still uses. The original sand game itself (v2) has been replaced by the cubbies; it's saved as version `v2` in the repository.

# Sandfall

A shared classroom sand picture. Kids pour sand in feeling colors from tablets, and every screen, including the class display, shows the same picture as it builds. Nobody signs in.

| Link | Who opens it | What it shows |
|---|---|---|
| `https://YOUR-USERNAME.github.io/sandfall/#play` | Each kid's tablet | The sand plus the nine feeling buttons |
| `https://YOUR-USERNAME.github.io/sandfall/#display` | Projector or TV | The picture only |
| `https://YOUR-USERNAME.github.io/sandfall/#teacher-YOURCODE` | You | The display plus a **Start fresh** button |

**Start fresh** only works when the code in your teacher link matches the code in your database rules. Keep the teacher link to yourself, the same way you would a password.

## Files

| File | What it is | Upload to GitHub? |
|---|---|---|
| `index.html` | The game | Yes |
| `config.js` | Your Firebase settings (you edit this) | Yes |
| `database.rules.json` | Security rules you paste into Firebase | **No.** It's the template for your teacher code. |
| `README.md` | This guide | Optional |

Without Firebase settings, the game still works, but each screen has its own picture.

## Part 1: Set up Firebase (free, about 10 minutes)

1. Go to https://console.firebase.google.com and sign in with any Google account.
2. Click **Create a project**, name it (for example `sandfall`), and turn off Google Analytics.
3. **Create the database.** In the left menu, open **Build → Realtime Database → Create Database**, pick the location nearest you, and choose **Start in locked mode**.
4. **Add the rules and your teacher code.** In Realtime Database, open the **Rules** tab and delete what's there. Paste the contents of `database.rules.json`, then:
   - Replace `CHANGE-THIS-CODE` with a code only you know, for example `sunflower-4821`. Use letters, numbers and dashes only.
   - Click **Publish**.
   - Make this change only in Firebase, not in a file you upload. That way the code never appears on your website.
5. **Get your settings.** Click the gear icon → **Project settings** → **Your apps** → the web icon (`</>`). Register an app named `sandfall` and skip Firebase Hosting. Copy the values inside `firebaseConfig`.
6. **Fill in `config.js`.** Paste those values over the placeholders and check that `databaseURL` is filled in. If it's missing, reopen Project settings now that the database exists and copy it again.

No sign-in setup is needed. Screens connect on their own.

## Part 2: Put it on GitHub Pages

1. Sign in at https://github.com and click **New repository**. Name it `sandfall`, make it **Public**, and create it.
2. Click **uploading an existing file**, drag in `index.html` and `config.js` (plus `README.md` if you like), and click **Commit changes**.
3. Open **Settings → Pages**. Under **Build and deployment**, choose **Deploy from a branch**, branch **main**, folder **/ (root)**, then click **Save**.
4. Wait a minute or two and refresh. The page shows your site address, for example `https://YOUR-USERNAME.github.io/sandfall/`.

## Part 3: Use it in class

1. On the projector computer, open your teacher link (`…/sandfall/#teacher-YOURCODE`) and click **Full screen**. Bookmark it so you don't have to retype the code. If students can see the screen while you type, open plain `#display` for the projector and keep the teacher link on your own laptop or phone.
2. **Start fresh:** tap it once, then tap again within 4 seconds. The sand clears on every screen.
3. On each tablet, open `…/sandfall/#play`. Tip: use "Add to Home Screen" so kids can open it with one tap.
4. The status pill shows how many screens are connected, for example "Live · 12 tablets".

## Good to know

- **Free plan limits:** 100 screens connected at once, 1 GB stored, 10 GB downloaded per month. A class of 30 fits easily.
- **Clear between classes:** each new screen downloads the whole current picture when it opens, so pressing **Start fresh** between classes keeps things fast.
- **What the rules protect:** anyone with the play link can add sand, but nobody can erase anyone else's sand, and only someone with your code can clear the picture. The settings in `config.js` are designed to be public.
- **Changing your code:** edit it in the Firebase **Rules** tab, click **Publish**, and update your bookmark.
- **Changing the game later:** edit `index.html` on GitHub (pencil icon → Commit). The site updates within a minute or two.

## If something doesn't work

| What you see | Fix |
|---|---|
| "Sharing is off: add your Firebase settings…" | `config.js` still has placeholders, or `databaseURL` is missing. |
| "Could not read the shared sand…" or pours don't show up | The rules weren't published, or were pasted wrong. Paste `database.rules.json` again, set your code, and click **Publish**. |
| "Add your teacher code to the address…" | Your link ends in `#teacher` with no code. Use `#teacher-YOURCODE`. |
| "Could not start fresh. Check that the code…" | The code in your link doesn't match the one in your Firebase rules. Codes are case-sensitive. |
| Site shows a 404 | Wait a few minutes after turning on Pages, and check that `index.html` is in the top folder of the repository. |
