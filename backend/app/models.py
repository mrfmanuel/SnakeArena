"""
Pydantic schemas for the Snake Arena API.

These mirror the schemas in /openapi.yaml exactly (name-for-name, field-
for-field). If you change a shape here, update openapi.yaml to match —
and vice versa.
"""

from __future__ import annotations

from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, Field, model_validator

NAME_MIN_LENGTH = 1
NAME_MAX_LENGTH = 24


class ProfileStats(BaseModel):
    wins: int = Field(ge=0)
    draws: int = Field(ge=0)
    losses: int = Field(ge=0)
    bestLength: int = Field(ge=0)


class Profile(BaseModel):
    id: int
    name: str
    stats: ProfileStats
    createdAt: datetime


class CreateProfileRequest(BaseModel):
    name: str = Field(min_length=NAME_MIN_LENGTH, max_length=NAME_MAX_LENGTH)


class ScoreEntry(BaseModel):
    id: int
    profileName: str
    length: int = Field(ge=0)
    date: datetime


class SubmitScoreRequest(BaseModel):
    profileName: str = Field(min_length=NAME_MIN_LENGTH, max_length=NAME_MAX_LENGTH)
    length: int = Field(ge=0)


class MatchPlayerResult(BaseModel):
    name: str = Field(min_length=NAME_MIN_LENGTH, max_length=NAME_MAX_LENGTH)
    length: int = Field(ge=0)


class MatchEntry(BaseModel):
    id: int
    players: List[MatchPlayerResult] = Field(min_length=2, max_length=2)
    outcome: Literal["win", "draw"]
    winnerName: Optional[str] = None
    date: datetime


class SubmitMatchRequest(BaseModel):
    players: List[MatchPlayerResult] = Field(min_length=2, max_length=2)
    outcome: Literal["win", "draw"]
    winnerName: Optional[str] = None

    @model_validator(mode="after")
    def _check_players_and_winner(self) -> "SubmitMatchRequest":
        names = [p.name for p in self.players]
        if len(set(names)) != len(names):
            raise ValueError("players must have two distinct names")

        if self.outcome == "draw":
            if self.winnerName is not None:
                raise ValueError('winnerName must be omitted or null when outcome is "draw"')
        else:  # outcome == "win"
            if self.winnerName is None:
                raise ValueError('winnerName is required when outcome is "win"')
            if self.winnerName not in names:
                raise ValueError("winnerName must match one of players[].name")

        return self


class MatchHistoryEntry(BaseModel):
    opponent: Optional[str] = None
    result: Literal["win", "loss", "draw"]
    length: int = Field(ge=0)
    date: datetime


class LeaderboardEntry(BaseModel):
    type: Literal["single", "match"]
    profileName: str
    length: int = Field(ge=0)
    date: datetime
    detail: Literal["Single-player", "Win", "Loss", "Draw"]


class ErrorResponse(BaseModel):
    message: str
