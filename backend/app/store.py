"""
SQLite-backed (via SQLAlchemy) store for Snake Arena.

Public method signatures and return shapes are unchanged from the
original in-memory version: routers call the same methods and get back
the same plain dataclasses (ProfileRecord, ScoreRecord, MatchRecord) —
never a SQLAlchemy model instance. Only what backs those methods
changed. Swapping the database again later (e.g. to Postgres) should
mean changing app/db.py's connection setup, not this class's public
surface or any router.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import List, Optional, Tuple

from sqlalchemy.engine import Engine
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db import Base, make_session_factory
from app.orm_models import MatchORM, MatchPlayerORM, ProfileORM, ScoreORM


def _now() -> datetime:
    return datetime.now(timezone.utc)


@dataclass
class ProfileRecord:
    id: int
    name: str
    wins: int = 0
    draws: int = 0
    losses: int = 0
    best_length: int = 0
    created_at: datetime = field(default_factory=_now)


@dataclass
class ScoreRecord:
    id: int
    profile_name: str
    length: int
    date: datetime


@dataclass
class MatchPlayerRecord:
    name: str
    length: int


@dataclass
class MatchRecord:
    id: int
    players: List[MatchPlayerRecord]
    outcome: str  # "win" | "draw"
    winner_name: Optional[str]
    date: datetime


def _profile_to_record(row: ProfileORM) -> ProfileRecord:
    return ProfileRecord(
        id=row.id,
        name=row.name,
        wins=row.wins,
        draws=row.draws,
        losses=row.losses,
        best_length=row.best_length,
        created_at=row.created_at,
    )


class Store:
    def __init__(self, engine: Engine) -> None:
        self._engine = engine
        Base.metadata.create_all(bind=engine)  # no-op if tables already exist
        self._Session = make_session_factory(engine)

    def _session(self) -> Session:
        return self._Session()

    # ---- profiles ----------------------------------------------------

    def get_profile(self, name: str) -> Optional[ProfileRecord]:
        with self._session() as session:
            row = session.query(ProfileORM).filter_by(name=name).one_or_none()
            return _profile_to_record(row) if row is not None else None

    def get_or_create_profile(self, name: str) -> Tuple[ProfileRecord, bool]:
        """Returns (profile, created)."""
        with self._session() as session:
            row = session.query(ProfileORM).filter_by(name=name).one_or_none()
            if row is not None:
                return _profile_to_record(row), False

            row = ProfileORM(name=name)
            session.add(row)
            try:
                session.commit()
            except IntegrityError:
                # Another request created this exact name in between our
                # check and our insert — the race openapi.yaml documents
                # a 409 for on POST /profiles. Rather than surface that
                # here (which routers aren't set up to translate), treat
                # it the same as if we'd found it first.
                session.rollback()
                row = session.query(ProfileORM).filter_by(name=name).one()
                return _profile_to_record(row), False

            session.refresh(row)
            return _profile_to_record(row), True

    def _ensure_profile_row(self, session: Session, name: str) -> ProfileORM:
        row = session.query(ProfileORM).filter_by(name=name).one_or_none()
        if row is None:
            row = ProfileORM(name=name)
            session.add(row)
            session.flush()  # assigns row.id without ending the transaction
        return row

    def bump_best_length(self, name: str, length: int) -> None:
        with self._session() as session:
            row = self._ensure_profile_row(session, name)
            if length > row.best_length:
                row.best_length = length
            session.commit()

    # ---- scores ---------------------------------------------------------

    def add_score(self, profile_name: str, length: int) -> ScoreRecord:
        # Auto-creates the profile if it doesn't exist yet, mirroring the
        # frontend mock's behavior (see the OpenAPI contract's notes on
        # this being a deliberate, revisitable choice).
        with self._session() as session:
            profile_row = self._ensure_profile_row(session, profile_name)
            if length > profile_row.best_length:
                profile_row.best_length = length

            score_row = ScoreORM(profile_name=profile_name, length=length, date=_now())
            session.add(score_row)
            session.commit()
            session.refresh(score_row)

            return ScoreRecord(
                id=score_row.id,
                profile_name=score_row.profile_name,
                length=score_row.length,
                date=score_row.date,
            )

    # ---- matches ----------------------------------------------------

    def add_match(
        self,
        players: List[Tuple[str, int]],
        outcome: str,
        winner_name: Optional[str],
    ) -> MatchRecord:
        with self._session() as session:
            for name, length in players:
                profile_row = self._ensure_profile_row(session, name)
                if length > profile_row.best_length:
                    profile_row.best_length = length
                if outcome == "draw":
                    profile_row.draws += 1
                elif name == winner_name:
                    profile_row.wins += 1
                else:
                    profile_row.losses += 1

            match_row = MatchORM(outcome=outcome, winner_name=winner_name, date=_now())
            match_row.players = [MatchPlayerORM(name=n, length=l) for n, l in players]
            session.add(match_row)
            session.commit()
            session.refresh(match_row)

            return MatchRecord(
                id=match_row.id,
                players=[MatchPlayerRecord(name=p.name, length=p.length) for p in match_row.players],
                outcome=match_row.outcome,
                winner_name=match_row.winner_name,
                date=match_row.date,
            )

    def get_history(self, name: str) -> List[dict]:
        with self._session() as session:
            matches = (
                session.query(MatchORM)
                .join(MatchPlayerORM)
                .filter(MatchPlayerORM.name == name)
                .order_by(MatchORM.date.desc())
                .all()
            )

            history = []
            for match in matches:
                me = next(p for p in match.players if p.name == name)
                opponent = next((p.name for p in match.players if p.name != name), None)

                if match.outcome == "draw":
                    result = "draw"
                elif match.winner_name == name:
                    result = "win"
                else:
                    result = "loss"

                history.append(
                    {
                        "opponent": opponent,
                        "result": result,
                        "length": me.length,
                        "date": match.date,
                    }
                )
            return history

    # ---- leaderboard --------------------------------------------------

    def get_leaderboard(self) -> List[dict]:
        with self._session() as session:
            rows: List[dict] = []

            for score in session.query(ScoreORM).all():
                rows.append(
                    {
                        "type": "single",
                        "profileName": score.profile_name,
                        "length": score.length,
                        "date": score.date,
                        "detail": "Single-player",
                    }
                )

            for match in session.query(MatchORM).all():
                for p in match.players:
                    if match.outcome == "draw":
                        detail = "Draw"
                    elif p.name == match.winner_name:
                        detail = "Win"
                    else:
                        detail = "Loss"
                    rows.append(
                        {
                            "type": "match",
                            "profileName": p.name,
                            "length": p.length,
                            "date": match.date,
                            "detail": detail,
                        }
                    )

            rows.sort(key=lambda r: r["length"], reverse=True)
            return rows

    # ---- misc -----------------------------------------------------------

    def is_empty(self) -> bool:
        """True if there's no data at all yet — used to decide whether to seed on startup."""
        with self._session() as session:
            return session.query(ProfileORM.id).first() is None


def seed(store: Store) -> None:
    """A little seed data so the leaderboard/profiles aren't empty on first run."""
    store.add_score(profile_name="Ada", length=9)
    store.add_score(profile_name="Grace", length=14)
    store.add_match(players=[("Ada", 11), ("Linus", 6)], outcome="win", winner_name="Ada")
    store.add_match(players=[("Grace", 8), ("Linus", 8)], outcome="draw", winner_name=None)
