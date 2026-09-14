"""
Snake Arena backend — FastAPI app.

Implements exactly the contract in /openapi.yaml, mounted under /api to
match that file's `servers` entry. In-memory store only (app/store.py) —
no database yet.

Run locally:  uvicorn app.main:app --reload   (from backend/, venv active)
"""

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.routers import api_router

app = FastAPI(
    title="Snake Arena API",
    version="0.1.0",
    description="In-memory implementation of the contract in openapi.yaml.",
)

app.include_router(api_router, prefix="/api")


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    # openapi.yaml's Error schema is {"message": string}; FastAPI's
    # default HTTPException body is {"detail": ...} — translate so
    # responses match the contract exactly.
    return JSONResponse(status_code=exc.status_code, content={"message": str(exc.detail)})


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    # openapi.yaml documents 400 for invalid request bodies; FastAPI's
    # default for a body that fails Pydantic validation is 422. Translate
    # to keep the contract's documented status code rather than change it.
    messages = [error.get("msg", "Invalid request") for error in exc.errors()]
    return JSONResponse(status_code=400, content={"message": "; ".join(messages)})


@app.get("/health", include_in_schema=False)
def health() -> dict:
    return {"status": "ok"}
