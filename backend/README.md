# Snake Arena — Backend

FastAPI implementation of the contract in [`/openapi.yaml`](../openapi.yaml),
backed by an in-memory store (no database yet — see `app/store.py`).

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

A little seed data (a couple of profiles, scores, and matches) is
loaded on startup so the leaderboard/profiles aren't empty — see
`seed()` in `app/store.py`. It resets on every restart, since state is
in-memory only.

## Run the tests

```bash
pytest
```

Each test gets a fresh, unseeded store via a dependency override (see
`tests/conftest.py`), so tests don't depend on or interfere with the
seed data or each other.

## Structure

- `app/models.py` — Pydantic schemas, matching `/openapi.yaml`'s schemas
  name-for-name.
- `app/store.py` — the in-memory store (`Store` class) and its record
  types. Routers only ever call `Store` methods (`get_or_create_profile`,
  `add_score`, `add_match`, `get_leaderboard`, `get_history`, ...) —
  never touch its internal dicts/lists directly — so swapping this for
  a SQLite-backed store later should only mean writing a new class with
  the same methods, not touching router code.
- `app/deps.py` — the process-wide `Store` instance (seeded once) and
  the `get_store` FastAPI dependency that hands it to routers.
- `app/routers/` — one module per resource (`profiles.py`, `scores.py`,
  `matches.py`, `leaderboard.py`), each implementing the paths
  openapi.yaml assigns it.
- `app/main.py` — creates the FastAPI app, mounts the routers under
  `/api`, and translates FastAPI's default error shapes
  (`{"detail": ...}` / 422) into the contract's `{"message": ...}` / 400
  shape.
- `tests/` — pytest + FastAPI's `TestClient`, one file per resource.
