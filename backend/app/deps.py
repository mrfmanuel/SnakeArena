"""
Shared FastAPI dependencies.

The single, process-wide `Store` is created lazily, on first use, not
at import time — deliberately: `app.main` (and so `app.deps`) gets
imported by the test suite too, and if this eagerly built the real,
file-backed Store on import, that would create and seed the real
snake_arena.db on disk on every test run, before tests ever get a
chance to override the dependency. Lazy construction means the
override in tests/conftest.py fully replaces this — the real Store
here is never constructed at all during tests.

Backed by the database at SNAKE_ARENA_DATABASE_URL (see app/db.py).
Seed data is only inserted if the database is empty, so restarting the
server doesn't duplicate it.
"""

from typing import Optional

from app.db import create_engine_for_url, get_database_url
from app.store import Store, seed

_store: Optional[Store] = None


def get_store() -> Store:
    global _store
    if _store is None:
        engine = create_engine_for_url(get_database_url())
        _store = Store(engine)
        if _store.is_empty():
            seed(_store)
    return _store
