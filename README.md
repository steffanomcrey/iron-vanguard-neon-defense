# Iron Vanguard: Neon Defense

A mech versus a drone swarm, played in a single arena. Hold the line through ten
waves, break the swarm's run each round, and bank shields between waves — the
mech that reaches wave ten with armour left is the one that survives.

## Play

Open `game/index.html` in any desktop browser. No build step, no server, no
network request: the whole game is static files.

- **Move** — `←` / `→` or `A` / `D`, or move the pointer over the arena
- **Fire** — `Space` (hold for continuous fire), or hold the pointer button
- **Pause** — `P` · **Restart** — `R`

Add `?seed=1234` to the URL to replay an exact arena layout.
Add `?shot=start|play|end` to freeze the game in one of the composed poses the
entry screenshots are taken from (this is how the three captures in
`screenshots/` were produced, so they are reproducible rather than lucky).

## Structure

| File | Job |
|---|---|
| `game/index.html` | Page shell: canvas, accessible status line, module entry |
| `game/src/main.js` | Boot, fixed-step loop, collision resolution, run lifecycle |
| `game/src/config.js` | Every tunable constant: arena, mech, bullets, drones, palette |
| `game/src/random.js` | Seeded xorshift32 generator — same seed, same arena |
| `game/src/collision.js` | Circle/rect overlap tests and the movement integrators |
| `game/src/input.js` | Keyboard and pointer sampling, normalised into one state |
| `game/src/pools.js` | Fixed-size object pools, so play never allocates mid-wave |
| `game/src/ship.js` | The mech: steering, firing, shield damage and invulnerability |
| `game/src/drones.js` | The three drone archetypes: weaving scouts, strikers, bulwarks |
| `game/src/waves.js` | Wave director: composition, spawn order, breathers, progress |
| `game/src/score.js` | Score, combo multiplier, wave bonuses, pickup drop rolls |
| `game/src/pickups.js` | Shield cells and score cores that fall from wrecks |
| `game/src/particles.js` | Explosion bursts |
| `game/src/render.js` | Arena renderer: starfield, floor grid, mech, drones, shots |
| `game/src/hud.js` | Shields, score, combo, wave meter, floating score popups |
| `game/src/screens.js` | Title, pause, game-over and victory cards |
| `game/src/shots.js` | The three composed screenshot poses |
| `main.ts` | Entry program: copies `game/` and `screenshots/` to `/output`, writes `dossier.json` |
| `serve.ts` | Local static server for development |

## Design notes

The swarm reads at a glance because shape and colour carry the role, not text:
scouts weave wide and die to a single hit, strikers press straight in, bulwarks
soak five hits and are worth the most. Hostile hues (magenta, orange, violet) are
kept clear of the cyan the mech, its bolts and its pickups own, so a player never
confuses a friendly shot with a hostile one.

Difficulty comes from the wave director rather than a global speed slider: each
wave changes which archetypes appear, how densely they arrive and in what order,
so later waves feel like a different fight instead of a faster one.

Simulation runs on a fixed 1/60 s step independent of frame rate, and every
random draw comes from one seeded generator — the arena, spawn order and drop
rolls are reproducible from the seed alone.
