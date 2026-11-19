#!/usr/bin/env python3
"""Copy world.js (the open-world source) into aether-crucible.html between the WORLD markers.
The game's main code lives inside one private scope, so the world code is inlined there.
Run after editing world.js:  python3 sync_world.py"""
import os
ROOT=os.path.dirname(os.path.abspath(__file__))
H=os.path.join(ROOT,'aether-crucible.html');J=os.path.join(ROOT,'world.js')
s=open(H,encoding='utf-8').read();w=open(J,encoding='utf-8').read()
A,B='/*WORLD:BEGIN*/','/*WORLD:END*/'
a=s.index(A)+len(A);b=s.index(B)
s=s[:a]+'\n'+w+'\n'+s[b:]
open(H,'w',encoding='utf-8').write(s)
print('world.js synced into aether-crucible.html (%d chars)'%len(w))
