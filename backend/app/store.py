"""
In-memory backing store for Snake Arena.

Plain Python data structures behind a small class, deliberately kept
storage-agnostic in its public interface: every router talks to a
`Store` only through the methods below (never touching `_profiles` /
`_scores` / `_matches` directly), so swapping this for a SQLite- or
Postgres-backed implementation later should mean writing a new class
with the same method signatures and return shapes — not touching
router code.
"""

from __future__ import annotations

import itertools
import threading
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple


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


class Store:
    def __init__(self) -> None:
        # Guards profile creation. With this store, a single dict means
        # a get-then-create is already atomic under the GIL (no `await`
        # happens in between) — the lock mainly documents the intent for
        # once this is backed by something that isn't, and matches the
        # concurrent-create race that openapi.yaml documents as a 409 on
        # POST /profiles (unreachable with *this* implementation, since
        # there's nothing to race between two in-process calls).
        self._lock = threading.Lock()
        self._profiles: Dict[str, ProfileRecord] = {}
        self._scores: List[ScoreRecord] = []
        self._matches: List[MatchRecord] = []
        self._profile_ids = itertools.count(1)
        self._score_ids = itertools.count(1)
        self._match_ids = itertools.count(1)

    # ---- profiles ----------------------------------------------------

    def get_profile(self, name: str) -> Optional[ProfileRecord]:
        return self._profiles.get(name)

    def get_or_create_profile(self, name: str) -> Tuple[ProfileRecord, bool]:
        """Returns (profile, created)."""
        with self._lock:
            existing = self._profiles.get(name)
            if existing is not None:
                return existing, False
            profile = ProfileRecord(id=next(self._profile_ids), name=name)
            self._profiles[name] = profile
            return profile, True

    def _ensure_profile(self, name: str) -> ProfileRecord:
        profile, _created = self.get_or_create_profile(name)
        return profile

    def bump_best_length(self, name: str, length: int) -> None:
        profile = self._ensure_profile(name)
        if length > profile.best_length:
            profile.best_length = length

    # ---- scores ---------------------------------------------------------

    def add_score(self, profile_name: str, length: int) -> ScoreRecord:
        # Auto-creates the profile if it doesn't exist yet, mirroring the
        # frontend mock's behavior (see the OpenAPI contract's notes on
        # this being a deliberate, revisitable choice).
        self.bump_best_length(profile_name, length)
        record = ScoreRecord(
            id=next(self._score_ids),
            profile_name=profile_name,
            length=length,
            date=_now(),
        )
        self._scores.append(record)
        return record

    # ---- matches ----------------------------------------------------

    def add_match(
        self,
        players: List[Tuple[str, int]],
        outcome: str,
        winner_name: Optional[str],
    ) -> MatchRecord:
        for name, length in players:
            self.bump_best_length(name, length)
            profile = self._ensure_profile(name)
            if outcome == "draw":
                profile.draws += 1
            elif name == winner_name:
                profile.wins += 1
            else:
                profile.losses += 1

        record = MatchRecord(
            id=next(self._match_ids),
            players=[MatchPlayerRecord(name=n, length=l) for n, l in players],
            outcome=outcome,
            winner_name=winner_name,
            date=_now(),
        )
        self._matches.append(record)
        return record

    def get_history(self, name: str) -> List[dict]:
        history = []
        for match in self._matches:
            player_names = [p.name for p in match.players]
            if name not in player_names:
                continue

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

        history.sort(key=lambda h: h["date"], reverse=True)
        return history

    # ---- leaderboard --------------------------------------------------

    def get_leaderboard(self) -> List[dict]:
        rows: List[dict] = []

        for score in self._scores:
            rows.append(
                {
                    "type": "single",
                    "profileName": score.profile_name,
                    "length": score.length,
                    "date": score.date,
                    "detail": "Single-player",
                }
            )

        for match in self._matches:
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


def seed(store: Store) -> None:
    """A little seed data so the leaderboard/profiles aren't empty on first run."""
    store.add_score(profile_name="Ada", length=9)
    store.add_score(profile_name="Grace", length=14)
    store.add_match(players=[("Ada", 11), ("Linus", 6)], outcome="win", winner_name="Ada")
    store.add_match(players=[("Grace", 8), ("Linus", 8)], outcome="draw", winner_name=None)
