"""Shared FastAPI dependencies — injected via Depends(), overridable in tests."""

from .database import database
from .repositories.session_repo import SessionRepository


def get_repo() -> SessionRepository:
    assert database.db is not None, "Database not connected"
    return SessionRepository(database.db)
