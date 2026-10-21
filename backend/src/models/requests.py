from typing import Any

from pydantic import BaseModel, field_validator


def reject_half_emoji(value: Any) -> Any:
    """Raise on a lone UTF-16 surrogate (half an emoji) anywhere in the value.

    MongoDB stores text as UTF-8, which cannot encode a lone surrogate, so it
    would otherwise fail later as a 500 instead of a 422 here.
    """
    texts = value if isinstance(value, list) else [value]
    for text in texts:
        if isinstance(text, str):
            try:
                text.encode("utf-8")
            except UnicodeEncodeError as error:
                raise ValueError("text contains an incomplete emoji or character") from error
    return value


class RequestModel(BaseModel):
    """Base for request bodies: every text field must be valid Unicode."""

    @field_validator("*")
    @classmethod
    def text_is_valid_unicode(cls, value: Any) -> Any:
        return reject_half_emoji(value)


class CreateSessionRequest(RequestModel):
    name: str
    participant_name: str = "Facilitator"
    columns: list[str] | None = None
    reactions_enabled: bool = True
    open_facilitator: bool = False
    max_votes_per_participant: int | None = None


class JoinSessionRequest(RequestModel):
    participant_name: str


class SetPhaseRequest(RequestModel):
    phase: str


class AddCardRequest(RequestModel):
    column: str
    text: str
    author_name: str


class PublishAllRequest(RequestModel):
    column: str


class AddColumnRequest(RequestModel):
    name: str


class RenameColumnRequest(RequestModel):
    name: str


class AddReactionRequest(RequestModel):
    emoji: str


class AssignCardRequest(RequestModel):
    assignee: str | None


class SetTimerDurationRequest(RequestModel):
    duration_seconds: int


class UpdateCardTextRequest(RequestModel):
    text: str


class MoveCardRequest(RequestModel):
    column: str


class UpdateSessionRequest(RequestModel):
    name: str | None = None
    reactions_enabled: bool | None = None
    open_facilitator: bool | None = None
    max_votes_per_participant: int | None = None


class AddNoteRequest(RequestModel):
    title: str | None = None
    text: str
    author_name: str


class UpdateNoteRequest(RequestModel):
    title: str | None = None
    text: str


class GroupCardRequest(RequestModel):
    target_card_id: str


class SetColumnSortRequest(RequestModel):
    sort_by_votes: bool
