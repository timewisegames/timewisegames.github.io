# Aether Crucible

A 3D elemental arena fighter that runs in the browser. Pick a master, fight the AI through story, tournament and wave modes, or duel a friend online with a room code.

## Play online with a friend

1. Press **Online → Host a match** and send your friend the room code.
2. Your friend opens the same site, presses **Online → Join with a code**, and types it in.
3. Pick an arena and press **Start match**.

Matches run directly between the two browsers; the free PeerJS service only introduces them.

## Development

- `aether-crucible.html` is the whole game.
- `python3 build.py` builds `site/index.html` (and a zip for itch.io).
- Every push to `main` rebuilds and publishes the site through GitHub Pages (see `.github/workflows/pages.yml`).
- See [PUBLISHING.md](PUBLISHING.md) for other hosts.
