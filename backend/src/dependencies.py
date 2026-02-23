"""Shared FastAPI dependencies — injected via Depends(), overridable in tests."""

from .database import database
from .repositories.session_repo import SessionRepository


def get_repo() -> SessionRepository:
    return SessionRepository(database.db)
