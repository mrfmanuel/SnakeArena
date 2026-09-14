import pytest
from fastapi.testclient import TestClient

from app.db import create_engine_for_url
from app.deps import get_store
from app.main import app
from app.store import Store


@pytest.fixture
def client():
    """
    A TestClient wired to a fresh, in-memory SQLite-backed Store per
    test (never the app's real snake_arena.db file), via FastAPI's
    dependency override mechanism — so tests don't depend on, or leak
    state into, the real database or each other.
    """
    engine = create_engine_for_url("sqlite:///:memory:")
    fresh_store = Store(engine)
    app.dependency_overrides[get_store] = lambda: fresh_store
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
    engine.dispose()
