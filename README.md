# Asteroid Panic

A tiny top-down survival arcade game inspired by the "one more round" feeling of Astro Party and the upgrade loop of Vampire Survivors.

## Play

You can open `index.html` directly in a browser, or run it on localhost:

```bash
cd /Users/aryanbaki/Documents/AI-Workshop
python3 -m http.server 4173
```

Then open:

```text
http://localhost:4173
```

## Controls

- `W` / Up: thrust forward. `S` / Down: reverse/brake.
- `A` / Left and `D` / Right: turn the ship.
- Hold `Space` to fire. Bullets travel in a straight line from the ship's current heading.
- On touch screens, drag on the arena to steer, thrust, and fire in the drag direction.
- Use `Pause` or press `P` to pause.

## Game Loop

Asteroids and aliens drift toward Earth, the player pilots a heading-based ship, enemies drop crystals, and upgrades appear after levels or cleared waves. Every fifth wave introduces the Mother Ship mini boss.

Planet 1 is a deliberately gentle tutorial: small waves, slower and weaker enemies, extra starting shield, and a permanent Guardian turret on the pixel planet. Planet 2 remains forgiving but removes the Guardian so players can apply the controls on their own. The arena uses a larger 480 x 300 logical map while retaining the 16:10 layout.

## Assets

Art assets are loaded through `Assets/Data/AssetManifest.json` by the in-game `AssetManager`. The game uses a fixed low-resolution canvas with nearest-neighbor scaling so its ships, projectiles, pickups, particle effects, UI, Guardian turret, and block-built planet all retain crisp pixel edges. Eight selectable ships use frames from the licensed 8x8 Space Shooter Asset Pack. License and attribution details are documented in `Assets/Documentation/LICENSES.md` and `Assets/Documentation/CREDITS.md`.
