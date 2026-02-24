from datetime import UTC, datetime
from enum import StrEnum
from uuid import uuid4

from pydantic import BaseModel, Field


class SessionPhase(StrEnum):
    COLLECTING = "collecting"
    DISCUSSING = "discussing"
    CLOSED = "closed"


class Vote(BaseModel):
    participant_name: str


class Card(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    column: str
    text: str
    author_name: str
    published: bool = False
    votes: list[Vote] = []
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


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
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    last_accessed_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
