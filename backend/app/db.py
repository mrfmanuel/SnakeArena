"""
SQLAlchemy engine/session/table setup for Snake Arena.

The database URL is read from SNAKE_ARENA_DATABASE_URL, defaulting to a
local SQLite file — see backend/README.md for how to point this at a
different database (e.g. Postgres) or reset local data. Nothing here is
SQLite-specific in principle except `create_engine_for_url`'s connection
options, which only kick in for `sqlite://` URLs.
"""

from __future__ import annotations

import os

from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import declarative_base, sessionmaker
from sqlalchemy.pool import StaticPool

DEFAULT_DATABASE_URL = "sqlite:///./snake_arena.db"

Base = declarative_base()


def get_database_url() -> str:
    return os.environ.get("SNAKE_ARENA_DATABASE_URL", DEFAULT_DATABASE_URL)


def create_engine_for_url(database_url: str) -> Engine:
    """
    Builds a SQLAlchemy engine for `database_url`, applying the options
    SQLite needs under FastAPI's threaded sync routes:

    - `check_same_thread=False` for any SQLite database, since a given
      request can run on a different thread than the one that opened
      the connection (SQLite's own driver forbids that by default).
    - `StaticPool` for an in-memory SQLite database (":memory:"), since
      each new connection to one is otherwise a *separate*, empty
      database — StaticPool keeps a single connection alive for the
      engine's lifetime so data actually persists across queries. Used
      for tests (see tests/conftest.py); not relevant for a file-based
      SQLite path or a real database.
    """
    connect_args = {}
    engine_kwargs = {}
    if database_url.startswith("sqlite"):
        connect_args["check_same_thread"] = False
        if ":memory:" in database_url:
            engine_kwargs["poolclass"] = StaticPool
    return create_engine(database_url, connect_args=connect_args, **engine_kwargs)


def make_session_factory(engine: Engine) -> sessionmaker:
    return sessionmaker(bind=engine, autoflush=False, expire_on_commit=False, future=True)
