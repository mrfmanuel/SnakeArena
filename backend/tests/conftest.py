import pytest
from fastapi.testclient import TestClient

from app.deps import get_store
from app.main import app
from app.store import Store


@pytest.fixture
def client():
    """
    A TestClient wired to a fresh, unseeded Store per test, via FastAPI's
    dependency override mechanism — so tests don't have to account for
    app/store.py's seed data and can't leak state into each other.
    """
    fresh_store = Store()
    app.dependency_overrides[get_store] = lambda: fresh_store
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
