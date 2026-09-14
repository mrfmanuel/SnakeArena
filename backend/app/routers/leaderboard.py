"""
Implements GET /leaderboard (getLeaderboard) from openapi.yaml.
"""

from typing import List

from fastapi import APIRouter, Depends

from app.deps import get_store
from app.models import LeaderboardEntry
from app.store import Store

router = APIRouter(tags=["leaderboard"])


@router.get("/leaderboard", response_model=List[LeaderboardEntry])
def get_leaderboard(store: Store = Depends(get_store)) -> List[dict]:
    return store.get_leaderboard()
