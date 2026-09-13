# Snake Arena — Frontend

Plain HTML/CSS/JS, no build step, no dependencies.

## Run it

Just open `frontend/index.html` in a browser (double-click works — the
scripts are classic `<script src>` tags, not ES modules, so there's no
CORS issue loading it directly from disk via `file://`).

If you'd rather serve it (e.g. to test on another device), any static
file server works, for example:

```
npx serve frontend
```

## Structure

- `index.html`, `styles.css` — markup and styling for all screens (start,
  game, game-over, leaderboard, profile), toggled via `hidden`.
- `src/game/engine.js` — pure game logic (grid, snakes, food, collisions,
  win/draw rules). No DOM or API code.
- `src/services/api.js` — **the only** place that talks to "the backend".
  Currently an in-memory mock; every function is written to match what a
  real REST call will look like, so swapping the implementation for
  `fetch(...)` later shouldn't require touching any caller. See the
  JSDoc in that file for the exact request/response shapes.
- `src/app.js` — screen navigation, canvas rendering, keyboard input, and
  the game loop; calls into `engine.js` and `api.js`.

## Notes / deviations worth knowing about

- Single-player accepts both WASD and Arrow keys (no P2 to conflict with).
- Food is shared: in 2-player mode there's one food item on the board at
  a time, available to whichever snake reaches it first.
- Snake-vs-snake collision is checked against the other snake's body
  *before* it moves that tick (a minor simplification vs. resolving both
  moves fully simultaneously) — noted in `engine.js`.
