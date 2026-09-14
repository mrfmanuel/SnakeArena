# Snake Arena — Backend

FastAPI implementation of the contract in [`/openapi.yaml`](../openapi.yaml),
persisted to SQLite via SQLAlchemy (`app/store.py`, `app/db.py`).

## Install

From `backend/`:

```bash
python -m venv .venv
# macOS/Linux:
source .venv/bin/activate
# Windows (PowerShell):
.venv\Scripts\Activate.ps1
# Windows (Git Bash):
source .venv/Scripts/activate

pip install -r requirements-dev.txt   # includes runtime deps + pytest/httpx
```

(`requirements.txt` alone is enough if you only need to run the server,
not the tests.)

## Run the server

```bash
uvicorn app.main:app --reload
```

Serves at `http://127.0.0.1:8000`. Every path from openapi.yaml is
mounted under `/api` (e.g. `GET http://127.0.0.1:8000/api/leaderboard`),
matching that file's `servers` entry. `GET /health` is a plain liveness
check outside the contract.

## Database

Data is persisted to SQLite via SQLAlchemy. The database URL comes from
the `SNAKE_ARENA_DATABASE_URL` environment variable, defaulting to a
local file if unset:

```
sqlite:///./snake_arena.db
```

That file is created (tables included) automatically on first use —
nothing to run by hand. It's gitignored, so it's local to your machine
and never committed.

**Reset local data** (e.g. for a clean demo): stop the server and
delete the file:

```bash
rm snake_arena.db
```

It'll be recreated, empty-then-seeded, the next time the server runs.

**A little seed data** (a couple of profiles, scores, and matches) is
inserted the first time the database is empty, so the leaderboard/
profiles aren't empty on a fresh run — see `seed()` in `app/store.py`.
It only happens once; restarting the server with existing data does
not re-seed or duplicate it.

**Using a different database** (e.g. Postgres): set
`SNAKE_ARENA_DATABASE_URL` to that database's SQLAlchemy URL (e.g.
`postgresql+psycopg2://user:pass@host/dbname`) and install the matching
driver. `app/db.py`'s SQLite-specific connection options only apply to
`sqlite://` URLs, and nothing in `app/store.py` or the routers is
SQLite-specific — this is the only file that would need attention
(likely just adding the driver package to requirements.txt).

## Run the tests

```bash
pytest
```

Each test gets a fresh, isolated **in-memory** SQLite database via a
dependency override (see `tests/conftest.py`) — never the real
`snake_arena.db` file — so tests don't depend on, or leak state into,
real data or each other.

## Structure

- `app/models.py` — Pydantic schemas, matching `/openapi.yaml`'s schemas
  name-for-name.
- `app/db.py` — SQLAlchemy engine/session setup: reads
  `SNAKE_ARENA_DATABASE_URL`, and applies the SQLite-specific connection
  options (see "Database" above).
- `app/orm_models.py` — the SQLAlchemy ORM models (`ProfileORM`,
  `ScoreORM`, `MatchORM`, `MatchPlayerORM`) — the persisted shape of the
  data. Routers never see these directly.
- `app/store.py` — the `Store` class and the plain dataclasses it
  returns (`ProfileRecord`, `ScoreRecord`, `MatchRecord`). Routers only
  ever call `Store` methods (`get_or_create_profile`, `add_score`,
  `add_match`, `get_leaderboard`, `get_history`, ...) and get those
  dataclasses back — never an ORM instance or a raw row — so swapping
  the database again later should mean changing `app/db.py`, not this
  class's public surface or any router.
- `app/deps.py` — the process-wide `Store` instance, built lazily on
  first use (see the docstring there for why: eager construction at
  import time would create/seed the real database file even during
  test runs), and the `get_store` FastAPI dependency that hands it to
  routers.
- `app/routers/` — one module per resource (`profiles.py`, `scores.py`,
  `matches.py`, `leaderboard.py`), each implementing the paths
  openapi.yaml assigns it.
- `app/main.py` — creates the FastAPI app, mounts the routers under
  `/api`, and translates FastAPI's default error shapes
  (`{"detail": ...}` / 422) into the contract's `{"message": ...}` / 400
  shape.
- `tests/` — pytest + FastAPI's `TestClient`, one file per resource.
