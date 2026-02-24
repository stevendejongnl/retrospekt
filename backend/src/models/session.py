from datetime import UTC, datetime
from enum import StrEnum
from uuid import uuid4

from pydantic import BaseModel, Field, field_validator

REACTION_EMOJI = frozenset(["❤️", "😂", "😮", "🎉", "🤔", "👀"])


class SessionPhase(StrEnum):
    COLLECTING = "collecting"
    DISCUSSING = "discussing"
    CLOSED = "closed"


class Vote(BaseModel):
    participant_name: str


class Reaction(BaseModel):
    emoji: str
    participant_name: str


class Card(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    column: str
    text: str
    author_name: str
    published: bool = False
    votes: list[Vote] = []
    reactions: list[Reaction] = []
    assignee: str | None = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


class TimerState(BaseModel):
    duration_seconds: int
    started_at: datetime | None = None
    paused_remaining: int | None = None

    @field_validator("started_at", mode="before")
    @classmethod
    def ensure_utc(cls, v: datetime | None) -> datetime | None:
        """MongoDB returns naive UTC datetimes — normalize to timezone-aware."""
        if v is not None and isinstance(v, datetime) and v.tzinfo is None:
            return v.replace(tzinfo=UTC)
        return v


class Participant(BaseModel):
    name: str
    joined_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


class Session(BaseModel):
    id: str
    name: str
    columns: list[str] = ["Went Well", "To Improve", "Action Items"]
    phase: SessionPhase = SessionPhase.COLLECTING
    facilitator_token: str = Field(default_factory=lambda: str(uuid4()))
    participants: list[Participant] = []
    cards: list[Card] = []
    timer: TimerState | None = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    last_accessed_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
