# Snake Arena — Frontend

Plain HTML/CSS/JS, no build step, no dependencies.

## Run it

Just open `frontend/index.html` in a browser (double-click works — the
scripts are classic `<script src>` tags, not ES modules, so there's no
CORS issue loading it directly from disk via `file://`).

By default it talks to the real backend at `http://127.0.0.1:8000`
(see `../backend/README.md` to run that) — with it running, playing a
round and checking the Leaderboard confirms the two are actually
talking to each other. If the backend is unreachable, screens show an
inline error instead of hanging.

To work on the frontend without the backend running, append
`?api=mock` to the URL to use an in-memory mock instead (or set
`localStorage['snakeArena:useMockApi'] = 'true'`) — see "Structure"
below.

If you'd rather serve it (e.g. to test on another device), any static
file server works, for example:

```
npx serve frontend
```

## Structure

- `index.html`, `styles.css` — markup and styling for all screens
  (start, game, game-over, leaderboard, profile), toggled via `hidden`.
- `src/game/engine.js` — pure game logic (grid, snakes, food, collisions,
  win/draw rules, and the pre-play/pre-resume countdown's gating). No
  DOM or API code.
- `src/services/` — **the only** place that talks to "the backend";
  nothing else in the app should call `fetch` or reach into these files
  directly:
  - `api.js` — the entry point. Assigns `window.SnakeArenaAPI` to
    either the real client or the mock, based on `?api=mock`/`?api=real`
    in the URL or the `localStorage` flag above (real is the default).
  - `api.real.js` — the real backend client (`fetch`-based), matching
    `../openapi.yaml`'s paths/shapes exactly. Errors surface as an
    `ApiError` with a human-readable `.message` and `.status`.
  - `api.mock.js` — an in-memory mock with the same 6 function
    signatures, kept as a fallback (see above), not the default.
- `src/app.js` — screen navigation, canvas rendering, keyboard/countdown
  input handling, and the game loop; calls into `engine.js` and
  `window.SnakeArenaAPI`.
- `tests/` — Node's built-in test runner (`node --test`), see below.

## Run the tests

```bash
node --test
```

Requires Node.js 18+, nothing else — no `npm install`, no config; the
tests use only `node:test`/`node:assert`, matching the no-build-step,
no-dependencies stack. Covers `engine.js`'s game rules (collisions,
direction/countdown gating, the 2-player solo-continuation and
head-on-draw rules) and `api.real.js`'s request/error-translation logic
(via a stubbed `fetch`, so it never makes a real network call).

## Notes / deviations worth knowing about

- Single-player accepts both WASD and Arrow keys (no P2 to conflict with).
- Food is shared: in 2-player mode there's one food item on the board at
  a time, available to whichever snake reaches it first.
- Snake-vs-snake collision is checked against the other snake's body
  *before* it moves that tick (a minor simplification vs. resolving both
  moves fully simultaneously) — noted in `engine.js`.
- "Play Again" on the game-over screen restarts instantly with the same
  player name(s)/mode (through the countdown), skipping the start
  screen; "Change players" goes back to the start screen instead.
