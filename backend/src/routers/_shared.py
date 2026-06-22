"""Shared helpers used across multiple routers."""

from ..models.session import Session


def _public(session: Session) -> dict:
    """Strip internal fields before sending to clients."""
    d = session.model_dump()
    d.pop("facilitator_token", None)
    d.pop("last_accessed_at", None)
    return d
