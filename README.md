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

- Move with `WASD` or the arrow keys.
- On touch screens, drag on the arena to move.
- Shooting is automatic.
- Use `Pause` or press `P` to pause.

## Game Loop

Asteroids and aliens drift toward Earth, the player auto-fires at the nearest threat, enemies drop crystals, and upgrades appear after levels or cleared waves. Every fifth wave introduces the Mother Ship mini boss.
