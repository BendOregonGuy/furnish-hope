# Mac Developer Setup

Complete instructions for getting Furnish Hope running on a Mac so
you can make changes to the app and test them locally before
deploying. **Written for non-technical staff** — no coding background
assumed. Every step shows what to click, what to paste, and what
you should see.

## What you'll have when you're done

- The full Furnish Hope code on your Mac
- A local database with the same structure as production
- A local copy of the app running at `http://localhost:5173`
- Everything you need to make changes, test them, and push them live

```mermaid
flowchart LR
  A[Your Mac] --> B[Tools installed<br/>brew, git, Node, Python, Postgres]
  B --> C[Repo cloned<br/>~/furnish-hope]
  C --> D[Dependencies installed<br/>npm install]
  D --> E[Local DB ready<br/>migrations run]
  E --> F[Dev servers running<br/>API + web]
  F --> G[Browse to localhost]
```

## How long it takes

**45–75 minutes** the first time. After that, opening the app each
day is just two commands.

---

## Before you start

You need these things ready:

1. **Admin access** to your Mac (you'll be installing software; the
   Mac asks for your login password during some installs).
2. **A GitHub account** with access to the Furnish Hope repository.
3. **About an hour** of uninterrupted time.
4. **About 2 GB of free disk space.**
5. **macOS 12 (Monterey) or newer.** Older versions may work but
   aren't tested.

---

## Part 1 — Open the Terminal

Terminal is the black-and-white window where you'll paste most of
these commands. You'll use it dozens of times.

1. Press **Cmd+Space** to open Spotlight.
2. Type `terminal` (no quotes).
3. Press **Enter**.

A window with a blinking cursor opens. The prompt looks like
`yourname@MacBook-Pro ~ %`. Leave it open.

> **🖼️ What you'll see:** A window labeled "Terminal — bash" or
> "Terminal — zsh" with a colored prompt. The default text is
> black on white; under macOS dark mode it's white on black.

> **🛟 You can have multiple Terminal windows open.** To open a
> second one, press **Cmd+N** while Terminal is focused. Later
> we'll need two running simultaneously.

---

## Part 2 — Install the tools (one-time, 30 min)

### 2.1 Install Homebrew (5 min)

Homebrew is the Mac's package manager — the equivalent of `winget`
on Windows. We'll use it to install every other tool.

Paste this in Terminal:

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

Press Enter. The installer asks for your Mac login password
(typing is invisible — that's normal). Follow the prompts and
press Enter where requested. Takes 3–5 minutes.

When it's done, you'll see two lines starting with
`==> Next steps:` that tell you to run two commands to add brew
to your PATH. They look like:

```bash
echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> /Users/yourname/.zprofile
eval "$(/opt/homebrew/bin/brew shellenv)"
```

Copy both lines from the installer's output and paste them in
Terminal. Press Enter after each.

Confirm Homebrew works:

```bash
brew --version
```

You should see `Homebrew 4.x.x`.

> **🛟 If you have an Intel Mac (older 2020 and earlier):** the
> path is `/usr/local/bin/brew` instead of `/opt/homebrew/bin/brew`.
> The installer prints the correct path for your machine; use what
> it shows you.

### 2.2 Install Git

```bash
brew install git
```

Takes about a minute. Confirm:

```bash
git --version
```

You should see `git version 2.x.x`.

> **🛟 Note:** macOS ships with an older Git pre-installed; if
> `which git` shows `/usr/bin/git`, you're seeing Apple's version.
> The brew install adds a newer one in `/opt/homebrew/bin` (Apple
> Silicon) or `/usr/local/bin` (Intel) — and `brew shellenv`
> already put those ahead in your PATH, so the new one wins.

### 2.3 Install Node.js (5 min)

```bash
brew install node@22
brew link --overwrite node@22 --force
```

Confirm:

```bash
node --version
npm --version
```

Expect Node `v22.x.x` and npm `10.x.x` or higher.

> **⚠️ Important:** Furnish Hope pins Node to version 22. If you
> already have a different version installed (via `nvm`, `n`, or
> a previous brew install), the build will warn or fail. Either:
>
> - Use `nvm use 22` if you have nvm, OR
> - `brew link --overwrite node@22 --force` to make brew's 22
>   the default.

### 2.4 Install Python (5 min)

```bash
brew install python@3.12
```

Confirm:

```bash
python3 --version
pip3 --version
```

Expect Python 3.12.x.

> **🛟 Note:** macOS includes a `python3` already. The brew install
> adds a newer one. To make sure `python` (without the `3`) also
> works, optionally:
>
> ```bash
> echo 'alias python=python3' >> ~/.zshrc
> echo 'alias pip=pip3' >> ~/.zshrc
> source ~/.zshrc
> ```

### 2.5 Install PostgreSQL 16 (10 min)

```bash
brew install postgresql@16
brew services start postgresql@16
```

Two things happen: brew installs the database engine, and the
`services start` command boots it as a background service so it
keeps running between reboots.

Confirm:

```bash
psql --version
```

Expect `psql (PostgreSQL) 16.x`.

> **🛟 If `psql` isn't found:** brew puts PostgreSQL 16 in a
> versioned path that needs explicit linking:
>
> ```bash
> brew link --force postgresql@16
> ```
>
> Then re-run `psql --version`.

By default, the Mac brew install of Postgres creates a database
user with your Mac username (no password). You can connect with
just `psql postgres`. If you want to match the Windows guide and
use a `postgres` user with password `postgres`, run:

```bash
psql postgres -c "CREATE ROLE postgres WITH SUPERUSER LOGIN PASSWORD 'postgres';"
```

(If you get `ERROR: role "postgres" already exists`, that's fine
— just set the password instead:)

```bash
psql postgres -c "ALTER USER postgres WITH PASSWORD 'postgres';"
```

### 2.6 Install VS Code (5 min, optional but recommended)

```bash
brew install --cask visual-studio-code
```

After install, you can open the project in VS Code from Terminal
with:

```bash
code ~/furnish-hope
```

### 2.7 Install Graphviz (5 min, optional)

Only needed if you want to regenerate the entity-relationship
diagram. Detailed in [REGENERATE_ERD.md](REGENERATE_ERD.md). Quick
install:

```bash
brew install graphviz
```

---

## Part 3 — Clone the repo (5 min)

### 3.1 Sign in to GitHub on your Mac

```bash
git config --global user.name "Your Name"
git config --global user.email "you@example.com"
```

Use your real name and the email tied to your GitHub account.

### 3.2 Clone the code

The standard location is `~/furnish-hope` (your home folder). Run:

```bash
cd ~
git clone https://github.com/<your-github-username>/furnish-hope.git
cd furnish-hope
```

The first time you talk to GitHub, your browser opens for a sign-in
prompt. Sign in normally; the window closes itself and Git
remembers you.

Confirm the code is on disk:

```bash
ls
```

You should see folders named `api`, `web`, `db`, `docs`, `scripts`,
and so on.

---

## Part 4 — Set up the database (10 min)

### 4.1 Create the empty database

```bash
psql -U postgres -c "CREATE DATABASE furnish_hope;"
```

You should see `CREATE DATABASE`.

> **🛟 If you skipped creating the `postgres` user in 2.5** and are
> using the default brew install behavior (no password, your Mac
> username as the user): the command above won't work. Use:
>
> ```bash
> createdb furnish_hope
> ```

### 4.2 Load the schema

```bash
psql -U postgres -d furnish_hope -f db/01_schema.sql
```

You'll see lots of `CREATE TABLE`, `ALTER TABLE`, etc. lines —
that's normal.

### 4.3 Load the seed data (optional but recommended)

```bash
psql -U postgres -d furnish_hope -f db/02_seed.sql
```

> **⚠️ Don't run the seed file against your production database.**
> It inserts fake data.

---

## Part 5 — Install the app's dependencies (10 min)

### 5.1 API dependencies

```bash
cd ~/furnish-hope/api
npm install
```

Takes 2–4 minutes.

### 5.2 Web dependencies

```bash
cd ~/furnish-hope/web
npm install
```

Another 2–4 minutes.

---

## Part 6 — Configure your environment (5 min)

The API reads database credentials and secrets from a `.env` file.

### 6.1 Create the .env file

In Terminal:

```bash
cd ~/furnish-hope/api
nano .env
```

(`nano` is a simple text editor that runs in Terminal. Type the
contents below, then save with Ctrl+O → Enter → Ctrl+X.)

Paste this:

```ini
# Local development environment
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/furnish_hope
SESSION_SECRET=local-dev-secret-do-not-use-in-prod
SESSION_SECURE=false
ATTACHMENT_ENCRYPTION_KEY=any-32-char-string-only-for-local-dev
PORT=4000
WEB_ORIGIN=http://localhost:5173
NODE_ENV=development
```

Save and exit:
- Press **Ctrl+O** (write out).
- Press **Enter** to confirm the filename.
- Press **Ctrl+X** to exit nano.

Confirm the file exists:

```bash
ls -la .env
```

> **⚠️ Don't commit `.env` to git.** The repo's `.gitignore` already
> excludes it. The values above are intentionally weak and ONLY
> safe on localhost.

---

## Part 7 — Run the app! (5 min)

You'll need TWO Terminal windows running side-by-side.

### 7.1 Start the API (window 1)

Open a fresh Terminal window (Cmd+N). Paste:

```bash
cd ~/furnish-hope/api
npm run dev
```

You'll see:

```
> furnish-hope-api@0.8.0 dev
> tsx watch src/index.ts

Furnish Hope API listening on http://localhost:4000 (development)

************************************************************************
INITIAL ADMIN ACCOUNT CREATED
  Username: admin
  Temporary password: cas-mor-len-417
  CHANGE THIS PASSWORD on first login.
************************************************************************
```

**Copy that temporary password — you'll need it in step 7.3.**

Leave this window open. Closing it stops the API.

### 7.2 Start the web front-end (window 2)

Open a SECOND Terminal window (Cmd+N from inside Terminal, or
right-click the Terminal dock icon → New Window). Paste:

```bash
cd ~/furnish-hope/web
npm run dev
```

You'll see:

```
VITE v5.4.x ready in 432 ms

➜  Local:   http://localhost:5173/
```

Leave this window open too.

### 7.3 Open the app in your browser

Open Chrome, Firefox, or Safari. Go to:

<http://localhost:5173>

Sign in:
- **Username:** `admin`
- **Password:** the temporary password from the API banner

Once signed in, **immediately** change your password — click your
name in the bottom-left corner → set a new password.

You should see the Furnish Hope dashboard with sample data (if
you loaded the seed in 4.3).

```mermaid
flowchart LR
  T1[Terminal #1<br/>API server<br/>:4000] --> Browser[Your browser<br/>localhost:5173]
  T2[Terminal #2<br/>Vite dev server<br/>:5173] --> Browser
  Browser --> User[You]
```

---

## Daily workflow

Every day after the one-time setup:

### Open the app for the day

Open two Terminal windows. In window 1:

```bash
cd ~/furnish-hope/api
npm run dev
```

In window 2:

```bash
cd ~/furnish-hope/web
npm run dev
```

Browse to <http://localhost:5173>. You're working.

### Make a code change

1. Edit any file in VS Code (or any editor).
2. Save the file (Cmd+S).
3. The dev servers auto-reload. Refresh your browser to see the
   change.

### Push changes to the live site

1. Open a third Terminal window (leave the dev servers running).
2. Paste:

   ```bash
   cd ~/furnish-hope
   git status                    # see what you changed
   git add -A
   git commit -m "What I changed in plain English"
   git push
   ```

3. DigitalOcean rebuilds the live site in 3–5 minutes. Watch the
   progress at <https://cloud.digitalocean.com/apps>.

### Stop the servers at the end of the day

In each Terminal window: press **Ctrl+C**. The server stops and
the prompt returns. You can close the window if you want.

---

## Troubleshooting

### "command not found: brew"

You didn't run the two `echo` / `eval` lines from the Homebrew
installer output. Re-open Terminal and re-run:

```bash
echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
eval "$(/opt/homebrew/bin/brew shellenv)"
```

(Use `/usr/local/bin/brew` instead of `/opt/homebrew/bin/brew` on
older Intel Macs.)

### "command not found: psql"

PostgreSQL was installed but isn't linked into PATH:

```bash
brew link --force postgresql@16
```

Open a new Terminal window and retry.

### "psql: error: connection to server on socket failed: No such file or directory"

PostgreSQL isn't running. Start it:

```bash
brew services start postgresql@16
```

Then retry your command.

### "FATAL: role 'postgres' does not exist"

The brew install of PostgreSQL doesn't create a `postgres` user
by default. Either create one:

```bash
psql postgres -c "CREATE ROLE postgres WITH SUPERUSER LOGIN PASSWORD 'postgres';"
```

…or use your Mac username instead:

```bash
psql -U $USER -d postgres -c "CREATE DATABASE furnish_hope;"
```

(and adjust the `.env` `DATABASE_URL` to use `$USER` instead of
`postgres`).

### "npm install fails with EACCES"

You shouldn't need sudo. If you see permission errors, npm is
trying to write into a system folder. Make sure you're running
`npm install` from inside `~/furnish-hope/api` or `~/furnish-hope/web`,
not from `/`.

If it's still failing, fix npm's default install path:

```bash
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.zshrc
source ~/.zshrc
```

### "Port 4000 already in use"

Something else is using port 4000. Find and kill it:

```bash
lsof -i :4000
kill -9 <PID-from-above>
```

…or restart your Mac.

### "Port 5173 already in use"

Same as above, replacing 4000 with 5173.

### "The app loads but every API call returns 'Not signed in'"

Your browser cleared its session cookies. Re-sign in at
<http://localhost:5173/login>.

### "I changed a file but the browser doesn't update"

- Hard refresh: **Cmd+Shift+R**.
- Look at the API Terminal window for an error message — a syntax
  error somewhere stops the server from reloading.

### "I broke something and can't undo"

If you haven't committed yet:

```bash
cd ~/furnish-hope
git checkout -- .
```

(Discards every uncommitted change. Be sure that's what you want.)

If you already committed but haven't pushed:

```bash
git reset --soft HEAD~1
```

(Un-commits the last commit; your changes stay in the working
tree.)

If you already pushed and broke production: see
[SETUP_DIGITAL_OCEAN.md](SETUP_DIGITAL_OCEAN.md) → "Restore from
backup" for the database, and push a revert commit:

```bash
git revert HEAD
git push
```

---

## When this guide gets out of date

If you follow a step and what you see doesn't match what's written:

1. Note the divergence.
2. Use the **Report Issue** button in the running app (top-right
   of any admin page) with a screenshot.
3. Or open this file (`docs/SETUP_DEV_MAC.md`) and submit a
   correction.

This guide is updated alongside install steps and tooling changes,
so out-of-date instructions are a real bug.
