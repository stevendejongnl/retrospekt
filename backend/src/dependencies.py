"""Shared FastAPI dependencies — injected via Depends(), overridable in tests."""

import redis.asyncio as aioredis
from fastapi import Request

from .config import settings
from .database import database
from .repositories.session_repo import SessionRepository


def get_repo() -> SessionRepository:
    assert database.db is not None, "Database not connected"
    return SessionRepository(database.db)


def get_redis(request: Request) -> aioredis.Redis:
    return request.app.state.redis  # type: ignore[no-any-return]


def get_expiry_days() -> int:
    return settings.session_expiry_days
