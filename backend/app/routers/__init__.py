"""
Combines all per-resource routers into one `api_router`, mounted under
the `/api` prefix in app/main.py (matching openapi.yaml's `servers` entry).
"""

from fastapi import APIRouter

from . import leaderboard, matches, profiles, scores

api_router = APIRouter()
api_router.include_router(profiles.router)
api_router.include_router(scores.router)
api_router.include_router(matches.router)
api_router.include_router(leaderboard.router)
