import json
from datetime import UTC, datetime
from enum import StrEnum
from pathlib import Path
from uuid import uuid4

from pydantic import BaseModel, Field, field_validator

# Full standard Unicode emoji set (unicode.org, via the `unicode-emoji-json` npm
# package — see frontend/package.json) so reactions aren't limited to a curated
# handful. Regenerate by copying frontend/node_modules/unicode-emoji-json/data-ordered-emoji.json
# over this file if the frontend dependency is upgraded to a newer Unicode revision.
REACTION_EMOJI: frozenset[str] = frozenset(
    json.loads((Path(__file__).parent.parent / "data" / "emoji.json").read_text())
)


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
    group_id: str | None = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


class Note(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    title: str | None = None
    text: str
    author_name: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))

    @field_validator("created_at")
    @classmethod
    def ensure_utc(cls, v: datetime) -> datetime:
        return v if v.tzinfo else v.replace(tzinfo=UTC)


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
    notes: list[Note] = []
    timer: TimerState | None = None
    column_sorts: dict[str, bool] = Field(default_factory=dict)
    reactions_enabled: bool = True
    open_facilitator: bool = False
    max_votes_per_participant: int | None = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    last_accessed_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
