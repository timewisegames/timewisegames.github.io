#!/usr/bin/env python3
"""Build the public website version of Aether Crucible.

Reads aether-crucible.html (the same file published on claude.ai) and writes:
  site/index.html          - ready for GitHub Pages, Netlify, Cloudflare Pages...
  aether-crucible-web.zip  - upload this to itch.io (HTML game) or Netlify Drop
Run:  python3 build.py
"""
import os, re, zipfile

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, 'aether-crucible.html')
SITE = os.path.join(ROOT, 'site')
ZIP = os.path.join(ROOT, 'aether-crucible-web.zip')

FAVICON = ("data:image/svg+xml,"
           "%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E"
           "%3Crect width='64' height='64' rx='14' fill='%230d0b1f'/%3E"
           "%3Cpath d='M32 8c4 10 14 14 14 28a14 14 0 0 1-28 0c0-8 4-12 7-16 1 6 4 8 7 9-2-8 0-15 0-21z' fill='%23f5c76b'/%3E"
           "%3C/svg%3E")

HEAD = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="description" content="Aether Crucible: a 3D elemental arena fighter. Pick a master, fight the AI, or duel a friend online with a room code.">
<meta property="og:title" content="Aether Crucible">
<meta property="og:description" content="A 3D elemental arena fighter you play in the browser. Duel a friend online with a room code.">
<meta name="theme-color" content="#0d0b1f">
<link rel="icon" href="{FAVICON}">
<style>html,body{{margin:0}}</style>
"""

def main():
    src = open(SRC, encoding='utf-8').read()
    # the claude.ai copy has no document skeleton; the site needs one
    # mod tools (fly, teleport, speed) are only for the claude.ai copy
    src, n = re.subn(r'/\*MOD:BEGIN\*/.*?/\*MOD:END\*/', '', src, flags=re.S)
    assert n == 1, 'mod block not found'
    body = src.replace('<meta charset="utf-8">', '', 1)
    page = HEAD + body.strip() + "\n</html>\n"
    os.makedirs(SITE, exist_ok=True)
    out = os.path.join(SITE, 'index.html')
    open(out, 'w', encoding='utf-8').write(page)
    with zipfile.ZipFile(ZIP, 'w', zipfile.ZIP_DEFLATED) as z:
        z.write(out, 'index.html')
    print(f'built {out} ({len(page)//1024} KB) and {ZIP}')

if __name__ == '__main__':
    main()
