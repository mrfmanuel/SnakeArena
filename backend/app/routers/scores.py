"""
Implements POST /scores (submitSinglePlayerScore) from openapi.yaml.
"""

from fastapi import APIRouter, Depends, status

from app.deps import get_store
from app.models import ScoreEntry, SubmitScoreRequest
from app.store import Store

router = APIRouter(tags=["scores"])


@router.post("/scores", response_model=ScoreEntry, status_code=status.HTTP_201_CREATED)
def submit_single_player_score(
    body: SubmitScoreRequest,
    store: Store = Depends(get_store),
) -> ScoreEntry:
    record = store.add_score(profile_name=body.profileName, length=body.length)
    return ScoreEntry(
        id=record.id,
        profileName=record.profile_name,
        length=record.length,
        date=record.date,
    )
