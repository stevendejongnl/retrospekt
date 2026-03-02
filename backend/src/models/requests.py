from pydantic import BaseModel


class CreateSessionRequest(BaseModel):
    name: str
    participant_name: str = "Facilitator"
    columns: list[str] | None = None
    reactions_enabled: bool = True


class JoinSessionRequest(BaseModel):
    participant_name: str


class SetPhaseRequest(BaseModel):
    phase: str


class AddCardRequest(BaseModel):
    column: str
    text: str
    author_name: str


class PublishAllRequest(BaseModel):
    column: str


class AddColumnRequest(BaseModel):
    name: str


class RenameColumnRequest(BaseModel):
    name: str


class AddReactionRequest(BaseModel):
    emoji: str


class AssignCardRequest(BaseModel):
    assignee: str | None


class SetTimerDurationRequest(BaseModel):
    duration_seconds: int


class UpdateCardTextRequest(BaseModel):
    text: str


class UpdateSessionRequest(BaseModel):
    name: str | None = None
    reactions_enabled: bool | None = None


class AddNoteRequest(BaseModel):
    text: str
    author_name: str


class UpdateNoteRequest(BaseModel):
    text: str


class GroupCardRequest(BaseModel):
    target_card_id: str
