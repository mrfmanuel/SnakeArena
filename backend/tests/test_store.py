"""
Tests against the Store class directly (not through the HTTP API),
for behavior that's about the persistence layer itself rather than any
one endpoint — specifically, that the database actually enforces the
profile-name uniqueness the product spec requires, independent of the
application-level case-sensitive-uniqueness checks exercised via HTTP
in test_profiles.py.
"""

import pytest
from sqlalchemy.exc import IntegrityError

from app.db import create_engine_for_url
from app.orm_models import ProfileORM
from app.store import Store


@pytest.fixture
def store():
    engine = create_engine_for_url("sqlite:///:memory:")
    yield Store(engine)
    engine.dispose()


def test_profile_name_has_a_real_unique_constraint(store):
    """
    get_or_create_profile's IntegrityError handling (see store.py) only
    matters if the database actually rejects a duplicate name — this
    confirms that mechanism exists, independent of the recovery code
    around it. (A genuine concurrent-insert race is impractical to
    simulate deterministically against this test database, which uses a
    single shared connection — see app/db.py.)
    """
    with store._session() as session:
        session.add(ProfileORM(name="Ada"))
        session.commit()

    with store._session() as session:
        session.add(ProfileORM(name="Ada"))
        with pytest.raises(IntegrityError):
            session.commit()


def test_is_empty_true_before_any_data_false_after(store):
    assert store.is_empty() is True
    store.add_score(profile_name="Ada", length=5)
    assert store.is_empty() is False
