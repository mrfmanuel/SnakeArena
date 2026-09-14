"""
Shared FastAPI dependencies.

The single, process-wide `Store` instance lives here (seeded on import)
so routers can depend on `get_store` without importing `main` (which
would create a circular import). Tests override this dependency with a
fresh, unseeded `Store` per test — see tests/conftest.py.
"""

from app.store import Store, seed

_store = Store()
seed(_store)


def get_store() -> Store:
    return _store
