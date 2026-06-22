"""Shared FastAPI dependencies — injected via Depends(), overridable in tests."""

import redis.asyncio as aioredis
from fastapi import Request

from . import database as _database
from .repositories.feedback_repo import FeedbackRepository
from .repositories.session_repo import SessionRepository


def get_repo() -> SessionRepository:
    assert _database.db is not None, "Database not connected"
    return SessionRepository(_database.db)


def get_feedback_repo() -> FeedbackRepository:
    assert _database.db is not None, "Database not connected"
    return FeedbackRepository(_database.db)


def get_redis(request: Request) -> aioredis.Redis:
    return request.app.state.redis  # type: ignore[no-any-return]
