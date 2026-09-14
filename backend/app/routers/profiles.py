"""
Implements the /profiles paths from openapi.yaml:
  POST /profiles               (upsertProfile)
  GET  /profiles/{name}        (getProfile)
  GET  /profiles/{name}/history (getProfileMatchHistory)
"""

from typing import List

from fastapi import APIRouter, Depends, HTTPException, Response, status

from app.deps import get_store
from app.models import CreateProfileRequest, MatchHistoryEntry, Profile, ProfileStats
from app.store import ProfileRecord, Store

router = APIRouter(tags=["profiles"])


def _to_profile(record: ProfileRecord) -> Profile:
    return Profile(
        id=record.id,
        name=record.name,
        stats=ProfileStats(
            wins=record.wins,
            draws=record.draws,
            losses=record.losses,
            bestLength=record.best_length,
        ),
        createdAt=record.created_at,
    )


@router.post(
    "/profiles",
    response_model=Profile,
    responses={
        200: {"description": "An existing profile with this name was found."},
        201: {"description": "A new profile was created."},
    },
)
def upsert_profile(
    body: CreateProfileRequest,
    response: Response,
    store: Store = Depends(get_store),
) -> Profile:
    profile, created = store.get_or_create_profile(body.name)
    response.status_code = status.HTTP_201_CREATED if created else status.HTTP_200_OK
    return _to_profile(profile)


@router.get("/profiles/{name}", response_model=Profile)
def get_profile(name: str, store: Store = Depends(get_store)) -> Profile:
    profile = store.get_profile(name)
    if profile is None:
        raise HTTPException(status_code=404, detail=f'No profile named "{name}".')
    return _to_profile(profile)


@router.get("/profiles/{name}/history", response_model=List[MatchHistoryEntry])
def get_profile_history(name: str, store: Store = Depends(get_store)) -> List[dict]:
    profile = store.get_profile(name)
    if profile is None:
        raise HTTPException(status_code=404, detail=f'No profile named "{name}".')
    return store.get_history(name)
