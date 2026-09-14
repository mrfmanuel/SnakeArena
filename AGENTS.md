# AGENTS.md

Orientation for an AI coding agent working in this repo. Read
[`product-spec.md`](product-spec.md) and [`openapi.yaml`](openapi.yaml)
before making product or API changes — they're the source of truth this
file summarizes, not a replacement for them.

## Repo structure

```
product-spec.md   Product scope: features, user stories, acceptance
                   criteria, explicit non-goals. Read before changing
                   game rules or flow.
openapi.yaml       The backend API contract (OpenAPI 3.0). Every
                   endpoint the frontend calls is defined here first.
AGENTS.md          This file.
frontend/          Plain HTML/CSS/JS, no build step, no dependencies.
  index.html
  styles.css
  src/
    game/engine.js       Pure game-rule logic (grid, snakes, food,
                          collisions, win/draw). No DOM/API code.
    services/
      api.js              Loader: picks real vs. mock, sets
                          window.SnakeArenaAPI. Nothing else should
                          call api.mock.js / api.real.js directly.
      api.real.js          Real backend client (fetch-based).
      api.mock.js          In-memory mock fallback (see below).
    app.js                Screens, canvas rendering, input, game loop.
  tests/            Node's built-in test runner, zero dependencies.
backend/           FastAPI, implements openapi.yaml exactly.
  app/
    models.py        Pydantic schemas — mirror openapi.yaml's schemas
                     name-for-name.
    db.py             SQLAlchemy engine/session setup.
    orm_models.py      SQLAlchemy ORM models (persisted shape).
    store.py           Store class: the ONLY thing routers talk to for
                     data. Returns plain dataclasses, never ORM rows.
    deps.py             The process-wide Store singleton (built lazily
                     — see its docstring for why) + get_store().
    routers/            One module per resource; each implements the
                     paths openapi.yaml assigns it.
    main.py             FastAPI app, mounted under /api, error-shape
                     translation to match the contract.
  tests/             pytest, one file per resource + tests/test_store.py.
docs/
  ai-usage-report.md  How AI was used building this project.
```

## Running it locally

**Backend** (from `backend/`):
```bash
python -m venv .venv && source .venv/Scripts/activate   # or .venv/bin/activate on macOS/Linux
pip install -r requirements-dev.txt
uvicorn app.main:app --reload
```
Serves at `http://127.0.0.1:8000`, all contract paths under `/api`. Data
persists to a local SQLite file (`SNAKE_ARENA_DATABASE_URL`, defaults to
`sqlite:///./snake_arena.db`) — see `backend/README.md` to reset it.

**Frontend**: just open `frontend/index.html` in a browser — no server,
no build. It talks to the real backend at `http://127.0.0.1:8000` by
default; append `?api=mock` to the URL to use the in-memory mock
instead (e.g. to work on the UI without the backend running).

## Running tests

**Backend**: `pytest` from `backend/` (venv active). Each test runs
against a fresh, isolated in-memory SQLite database — never the real
`snake_arena.db` file.

**Frontend**: `node --test` from `frontend/` (Node 18+, nothing to
install — uses only `node:test`/`node:assert`, deliberately no test
framework given the plain-JS, no-build-step stack).

## Key constraints (from product-spec.md — don't violate silently)

- **Grid is fixed 20×20, speed is constant.** No adjustable difficulty,
  grid size, or speed — these are explicit non-goals.
- **No wall wraparound.** Hitting a wall is always a death.
- **2-player is same-screen/same-keyboard only** (P1: WASD, P2: Arrow
  keys), max 2 players. No networked/remote multiplayer.
- **2-player death rule is specific:** if exactly one snake dies, it
  disappears immediately and the other keeps playing solo until *it*
  also dies — the solo survivor is then the winner. Only a simultaneous
  double-death (including head-on) is a draw. Don't "simplify" this to
  an immediate match-end on first death — that's a different, rejected
  design (see product-spec.md's Feature 2 history).
- **No power-ups, obstacles, or special food** — plain food only.
- **No login/auth** — profiles are name-only and unauthenticated by
  design.
- **Profile names are case-sensitive-unique.** `"Alex"` and `"alex"` are
  different profiles. POST /profiles is an idempotent upsert (200 if
  the name exists, 201 if new), not a strict create — see openapi.yaml's
  description on that endpoint for why.
- **Leaderboard ranks by snake length only** (descending), combining
  single-player runs and 2-player match results. No cross-deployment/
  global leaderboard — only this backend instance's own data.
- **The 3-2-1 countdown** (before Start, Play Again, and resuming from
  pause) must block both movement and directional input until it
  finishes — see engine.js's `status === 'countdown'` handling.

## Architecture rules to preserve

- **Routers never see ORM objects or SQL** — only `Store`'s plain
  dataclasses/dicts. If you change the database, change `db.py`/
  `store.py`/`orm_models.py`; routers and `models.py` shouldn't need to
  change at all.
- **All frontend backend-calls go through `window.SnakeArenaAPI`**
  (`src/services/api.js` and friends) — no other file should call
  `fetch` directly or reach into `api.mock.js`/`api.real.js`.
- **`openapi.yaml` is the contract.** If you add/change an endpoint,
  update it there too, in the same change — `backend/app/models.py` and
  `frontend/src/services/api.real.js` should both stay in sync with it.
- **Update `product-spec.md`** (the relevant feature's acceptance
  criteria, or Game Flow) when you change a game rule or user-facing
  flow — it's meant to stay accurate, not just be a historical record.
