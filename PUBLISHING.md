# Aether Crucible — publishing the website

`aether-crucible.html` is the game. The same file runs on claude.ai and as a normal website:
online play uses the claude.ai room there, and the free PeerJS matchmaking service everywhere else.

## Build

```
python3 build.py
```

This writes:
- `site/index.html` — the website (one file, nothing else needed)
- `aether-crucible-web.zip` — the same page zipped, for itch.io or Netlify Drop

## Put it online (pick one)

- **Netlify Drop (fastest):** open https://app.netlify.com/drop and drag the `site` folder onto the page. Make a free account to keep the link permanently.
- **itch.io (best game page):** create a project, set *Kind of project* to **HTML**, upload `aether-crucible-web.zip`, tick **This file will be played in the browser**, and set the embed size to 1280 × 720 (or *Click to launch in fullscreen*).
- **GitHub Pages (best for frequent updates):** push this folder to a GitHub repository and enable Pages for the `site` folder (or copy `site/index.html` to the repository root).

## Updating

Change `aether-crucible.html`, run `python3 build.py`, then re-upload `site/` (Netlify), the zip (itch.io), or push (GitHub).
Raise `NET_VER` in the game file whenever the online code changes, so players on old and new versions are told to refresh instead of joining a broken match.

## Open world code (world.js)

The open world for The Unmarked lives in `world.js`. The game's main code runs inside one private scope,
so `world.js` is copied into `aether-crucible.html` between the `/*WORLD:BEGIN*/` and `/*WORLD:END*/` markers.
After editing `world.js`, run:

    python3 sync_world.py

then publish as usual (`build.py` / GitHub Pages and claude.ai both use `aether-crucible.html`).
