"""Feedback domain model."""

from datetime import UTC, datetime
from uuid import uuid4

from pydantic import BaseModel, Field, field_validator


class Feedback(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    rating: int  # 1–5
    comment: str = ""
    session_id: str | None = None
    app_version: str = ""
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))

    @field_validator("created_at", mode="before")
    @classmethod
    def ensure_utc(cls, v: datetime) -> datetime:
        if isinstance(v, datetime) and v.tzinfo is None:
            return v.replace(tzinfo=UTC)
        return v
