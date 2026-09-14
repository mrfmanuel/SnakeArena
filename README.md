# Snake Arena

A browser-based Snake game: single-player and 2-player (same-screen,
same-keyboard) modes, named player profiles, a length-ranked
leaderboard, and persistent match history — backed by a FastAPI +
SQLite backend.

- **Product scope**: [`product-spec.md`](product-spec.md) — features,
  user stories, acceptance criteria, and explicit non-goals.
- **API contract**: [`openapi.yaml`](openapi.yaml) — every backend
  endpoint the frontend uses.
- **For an AI coding agent working in this repo**: [`AGENTS.md`](AGENTS.md).
- **How AI was used to build this project**: [`docs/ai-usage-report.md`](docs/ai-usage-report.md).

## Project layout

```
frontend/   Plain HTML/CSS/JS — no build step, no dependencies.
backend/    FastAPI + SQLAlchemy/SQLite, implementing openapi.yaml.
```

Each has its own README with more detail:
[`frontend/README.md`](frontend/README.md),
[`backend/README.md`](backend/README.md).

## Run it (from a fresh clone)

You need Python 3.10+ and a browser. Node.js 18+ is only needed if you
want to run the frontend's test suite.

**1. Start the backend** (from `backend/`):

```bash
python -m venv .venv
source .venv/Scripts/activate      # Windows Git Bash / macOS / Linux
# .venv\Scripts\Activate.ps1       # Windows PowerShell, use this instead

pip install -r requirements-dev.txt
uvicorn app.main:app --reload
```

Leave this running. It serves at `http://127.0.0.1:8000`, with a local
SQLite database file created automatically on first use (see
`backend/README.md` to configure or reset it), pre-populated with a
little seed data so the leaderboard isn't empty.

**2. Open the frontend**: just open `frontend/index.html` in a browser
— double-click it, no server needed. It talks to the backend from step
1 by default.

**3. Play a round**: enter a name, pick single- or 2-player, hit Start.
After the 3-2-1 countdown, control with WASD (and Arrow keys for
Player 2, or also for Player 1 in single-player). On game over, check
the Leaderboard button — the result you just played should appear
there, confirming the frontend and backend are actually talking to
each other.

If the backend isn't running, the frontend shows an inline error
("Can't reach the server...") instead of hanging — that's expected
behavior, not a bug, if you skip step 1.

## Run the tests

**Backend** (from `backend/`, venv active):
```bash
pytest
```

**Frontend** (from `frontend/`, needs Node.js 18+):
```bash
node --test
```
No `npm install` needed — the frontend has no dependencies, and its
tests use only Node's built-in test runner.
