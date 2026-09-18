# Publishing the Green App — step by step

Written 18 September 2026. This is the guide for putting changes online, what to
do every time, and what to do when something breaks.

---

## 0. The mental model (read this once)

The app exists in **three places**. They are separate copies.

```
  YOUR MAC                GITHUB                    THE LIVE SITE
  ~/Projects/...   ──►    github.com/           ──► luhman-studio.github.io
  green-app-web           luhman-studio/            /green-app/
                          green-app

  where you edit          the copy on the           what your friends
  (source of truth)       internet                  actually see
```

Changes flow **left to right, and only when you push them**. Editing a file on
your Mac changes nothing online until you run the deploy command. There is no
automatic sync and nothing is watching the folder.

The live site updates about **one minute** after a push.

---

## 1. What is already set up (you do not need to redo this)

| Thing | Value |
|---|---|
| GitHub account | `luhman-studio` |
| Repository | https://github.com/luhman-studio/green-app (public) |
| Local folder | `~/Projects/Claude/Claude Cowork/Green App/green-app-web` |
| Live site | https://luhman-studio.github.io/green-app/ |
| Pages setting | Deploy from branch `main`, folder `/ (root)` |
| Git identity | `luhman-studio <luhman-studio@users.noreply.github.com>` |
| Login | A fine-grained access token, saved in your macOS Keychain |
| Helper script | `deploy.sh` in the project folder |

Your real email address appears nowhere in the repository. Keep it that way.

---

## 2. THE EVERYDAY LOOP — do this every time you want changes online

### Step 1 — Make your changes

Either you edit files yourself, or Claude edits them for you in that folder.
Either way the files on your Mac are now different from what is online.

### Step 2 — Look at it locally first

Open `index.html` by double-clicking it. Your browser shows your version
instantly — no internet involved. Press **Cmd+R** to reload after each edit.

Fix anything broken **here**, before publishing. It costs nothing.

### Step 3 — Run the tests (recommended, takes ~20 seconds)

Open Terminal (see section 3 if you have never done this) and paste:

```
cd ~/"Projects/Claude/Claude Cowork/Green App/green-app-web"
node tests/engine.test.js
node tests/audit.js
```

Both should end without errors. If a test fails, do **not** publish — the
numbers the app shows people would be wrong.

### Step 4 — Publish

In the same Terminal window, paste this (change the message to describe what
you actually changed):

```
./deploy.sh "fixed the Sankey labels on mobile"
```

You should see something like:

```
Committed: fixed the Sankey labels on mobile

Pushed. Live in ~1 min at:
  https://luhman-studio.github.io/green-app/
```

### Step 5 — Wait one minute, then check

Go to https://luhman-studio.github.io/green-app/ and press **Cmd+Shift+R**.

That is a *hard* reload. A normal reload often shows you the old cached version
and makes you think the deploy failed. This causes more false alarms than any
real bug — always hard-reload before worrying.

**That is the whole loop. Steps 2, 4 and 5 are the minimum; step 3 is the one
worth not skipping.**

---

### The click-only alternative: GitHub Desktop

If you would rather not use Terminal at all:

1. Install GitHub Desktop from https://desktop.github.com
2. **File → Add Local Repository**, choose the `green-app-web` folder
3. Your changes appear in the left panel
4. Type a message in the "Summary" box at the bottom left
5. Click **Commit to main**
6. Click **Push origin** at the top

Same result. Both methods talk to the same repository, so you can switch
between them freely.

---

## 3. How to open Terminal (if you have not before)

1. Press **Cmd + Space**
2. Type `Terminal`
3. Press **Enter**

A window with a text prompt appears. Paste with **Cmd+V**, run with **Enter**.
Nothing you type there can damage anything outside your own files.

The quotes in `cd ~/"Projects/Claude/..."` matter — the folder names contain
spaces, and without quotes the command stops at the first space.

---

## 4. WHEN THINGS GO WRONG

Each problem below lists what you will actually see, why, and the fix.

---

### 4.1 The access token expired — THIS WILL HAPPEN

**You will see:**

```
remote: Invalid username or password.
fatal: Authentication failed for 'https://github.com/luhman-studio/green-app.git/'
```

or

```
remote: Support for password authentication was removed.
```

**Why:** when we created the token we gave it an expiry date. On that date it
stops working. This is a security feature, not a fault. Everything else still
works — your files, your repository, your live site. Only pushing is blocked.

**Fix — two parts, both necessary:**

**Part A: make a new token**

1. Go to https://github.com/settings/personal-access-tokens
2. Make sure you are on the **Fine-grained tokens** tab (not "Tokens (classic)")
3. Click **Generate new token**
4. **Token name:** `green-app-push`
5. **Expiration:** pick a date. 90 days is a reasonable balance. The maximum is
   366 days. Do not choose "No expiration"
6. **Resource owner:** `luhman-studio`
7. **Repository access:** choose **Only select repositories** → select
   `green-app`. Not "All repositories"
8. **Permissions** → **Repository permissions** → find **Contents** → set to
   **Read and write**
9. Leave everything else at "No access". (**Metadata: Read-only** switches
   itself on and cannot be turned off — that is normal and required)
10. Click **Generate token**
11. Copy the token immediately. It starts with `github_pat_` and is shown
    **once only**

**Part B: forget the old token, or macOS will keep using it**

This is the step people miss. Your Mac saved the old token in the Keychain and
will keep offering it. In Terminal, paste this whole block and press Enter:

```
printf "protocol=https\nhost=github.com\n\n" | git credential-osxkeychain erase
```

Nothing is printed. That is correct — it worked.

Now push again. It will ask for credentials:

- **Username:** `luhman-studio`
- **Password:** paste the **new token** (not your GitHub password — that never
  works). The characters will not appear as you paste. That is normal. Press
  Enter.

**Write the new expiry date somewhere.** In six months you will not remember
why pushing suddenly broke.

---

### 4.2 The live site still shows the old version

**Why, in order of likelihood:**

1. **Browser cache.** Press **Cmd+Shift+R**. Ninety percent of cases.
2. **Still building.** Go to the repo → **Actions** tab. An orange dot means it
   is still deploying. Wait for the green tick.
3. **You did not actually push.** In Terminal:
   ```
   cd ~/"Projects/Claude/Claude Cowork/Green App/green-app-web"
   git status
   ```
   If it says `Your branch is ahead of 'origin/main' by 1 commit`, the commit
   exists but never went out. Run `git push`.

---

### 4.3 "Nothing to commit — working tree is clean"

You ran `./deploy.sh` but no files changed. Usually your editor has unsaved
changes — press **Cmd+S** in the editor and run it again.

---

### 4.4 "Updates were rejected" / "failed to push some refs"

**You will see:**

```
 ! [rejected]        main -> main (fetch first)
error: failed to push some refs
```

**Why:** GitHub has a commit your Mac does not. This happens if you edited a
file directly on the GitHub website, or pushed from a second computer.

**Fix:**

```
cd ~/"Projects/Claude/Claude Cowork/Green App/green-app-web"
git pull --rebase
./deploy.sh "merge remote changes"
```

`--rebase` puts your work on top of GitHub's instead of creating a messy merge.

---

### 4.5 "permission denied: ./deploy.sh"

The script lost its executable flag. Fix once:

```
cd ~/"Projects/Claude/Claude Cowork/Green App/green-app-web"
chmod +x deploy.sh
```

---

### 4.6 The live site shows 404

1. Repo → **Settings** → **Pages**
2. Confirm: Source = **Deploy from a branch**, Branch = **main**,
   folder = **/ (root)**
3. Confirm the file `.nojekyll` still exists in the project folder. If it were
   deleted, GitHub would try to process the site with Jekyll and could hide
   files

---

### 4.7 You published something broken and want the old version back

Do **not** delete anything. Every version is recoverable.

```
cd ~/"Projects/Claude/Claude Cowork/Green App/green-app-web"
git log --oneline
```

You get a list like:

```
9f2a1c4 broke the chart
2c7ad8b Add deploy.sh
5c4b609 Green App: static carbon footprint calculator
```

Undo the bad one by its code:

```
git revert 9f2a1c4
./deploy.sh "undo the broken chart change"
```

`revert` makes a *new* commit that cancels the bad one. The history stays
honest and nothing is lost. Avoid `git reset --hard` — it destroys work and is
the command people regret.

---

### 4.8 You accidentally committed something private

A password, an API key, a personal email address.

Assume it is compromised the moment it is pushed — bots scan public GitHub
within seconds. **Change or revoke the secret first**, then worry about the
history. Deleting the file in a later commit does *not* remove it; it stays in
the history forever. Ask Claude to help rewrite the history, but rotating the
secret is what actually protects you.

---

## 5. Quick reference card

**Folder**

```
~/Projects/Claude/Claude Cowork/Green App/green-app-web
```

**Publish**

```
cd ~/"Projects/Claude/Claude Cowork/Green App/green-app-web"
./deploy.sh "what changed"
```

**Check the tests**

```
node tests/engine.test.js
node tests/audit.js
```

**Rebuild METHOD.md after editing `data/docs.js`**

```
node tools/make-method.js
```

**Links**

- Live site — https://luhman-studio.github.io/green-app/
- Repository — https://github.com/luhman-studio/green-app
- Pages settings — https://github.com/luhman-studio/green-app/settings/pages
- Tokens — https://github.com/settings/personal-access-tokens

---

## 6. What is deliberately NOT set up

So you know where the edges are.

- **No custom domain.** The `github.io` address is free and permanent. A domain
  you own costs roughly €11–34 per year depending on the ending and the seller.
  Hosting stays free; adding one later is a DNS record and a settings change
- **No server, no database, no accounts.** Everything runs in the visitor's
  browser. Their answers never leave their own computer
- **No analytics.** You cannot see who visited or what they answered
- **Nothing to secure.** There is no server to break into and no stored user
  data to leak. This changes completely if accounts are ever added — see
  section 7 of the handover doc in the Claude project

---

## 7. Costs

Nothing here costs money. GitHub accounts, public repositories, and GitHub
Pages are free, with no trial period and no card on file. The only paid thing
you have been offered is a custom domain, which you declined.
