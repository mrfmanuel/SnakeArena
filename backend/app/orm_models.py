"""
SQLAlchemy ORM models — the persisted shape of Snake Arena's data.

These mirror the plain dataclasses in store.py (ProfileRecord,
ScoreRecord, MatchRecord/MatchPlayerRecord) one-for-one, but routers
never see these directly: Store converts rows to those dataclasses
before returning, so swapping the database doesn't touch router code,
and ORM session lifecycle never leaks past store.py.
"""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.db import Base


def _now() -> datetime:
    return datetime.now(timezone.utc)


class ProfileORM(Base):
    __tablename__ = "profiles"

    id = Column(Integer, primary_key=True)
    name = Column(String(24), unique=True, nullable=False, index=True)
    wins = Column(Integer, nullable=False, default=0)
    draws = Column(Integer, nullable=False, default=0)
    losses = Column(Integer, nullable=False, default=0)
    best_length = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), nullable=False, default=_now)


class ScoreORM(Base):
    __tablename__ = "scores"

    id = Column(Integer, primary_key=True)
    profile_name = Column(String(24), nullable=False, index=True)
    length = Column(Integer, nullable=False)
    date = Column(DateTime(timezone=True), nullable=False, default=_now)


class MatchORM(Base):
    __tablename__ = "matches"

    id = Column(Integer, primary_key=True)
    outcome = Column(String(8), nullable=False)  # "win" | "draw"
    winner_name = Column(String(24), nullable=True)
    date = Column(DateTime(timezone=True), nullable=False, default=_now)

    players = relationship(
        "MatchPlayerORM",
        back_populates="match",
        cascade="all, delete-orphan",
        order_by="MatchPlayerORM.id",
    )


class MatchPlayerORM(Base):
    __tablename__ = "match_players"

    id = Column(Integer, primary_key=True)
    match_id = Column(Integer, ForeignKey("matches.id"), nullable=False, index=True)
    name = Column(String(24), nullable=False, index=True)
    length = Column(Integer, nullable=False)

    match = relationship("MatchORM", back_populates="players")
