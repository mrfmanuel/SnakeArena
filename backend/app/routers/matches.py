"""
Implements POST /matches (submitMatchResult) from openapi.yaml.
"""

from fastapi import APIRouter, Depends, status

from app.deps import get_store
from app.models import MatchEntry, MatchPlayerResult, SubmitMatchRequest
from app.store import Store

router = APIRouter(tags=["matches"])


@router.post("/matches", response_model=MatchEntry, status_code=status.HTTP_201_CREATED)
def submit_match_result(
    body: SubmitMatchRequest,
    store: Store = Depends(get_store),
) -> MatchEntry:
    players = [(p.name, p.length) for p in body.players]
    record = store.add_match(players=players, outcome=body.outcome, winner_name=body.winnerName)
    return MatchEntry(
        id=record.id,
        players=[MatchPlayerResult(name=p.name, length=p.length) for p in record.players],
        outcome=record.outcome,
        winnerName=record.winner_name,
        date=record.date,
    )
