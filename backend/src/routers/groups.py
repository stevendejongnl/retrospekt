from uuid import uuid4

from fastapi import APIRouter, Depends, Header, HTTPException

from ..dependencies import get_repo
from ..models.requests import GroupCardRequest
from ..models.session import Session
from ..repositories.session_repo import SessionRepository
from ..services.sse_manager import sse_manager

router = APIRouter(prefix="/api/v1/sessions")


def _public(session: Session) -> dict:
    d = session.model_dump()
    d.pop("facilitator_token", None)
    return d


@router.post("/{session_id}/cards/{card_id}/group")
async def group_card(
    session_id: str,
    card_id: str,
    body: GroupCardRequest,
    x_participant_name: str | None = Header(default=None),
    repo: SessionRepository = Depends(get_repo),
) -> dict:
    if not x_participant_name:
        raise HTTPException(status_code=400, detail="X-Participant-Name header required")

    session = await repo.get_by_id(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.phase != "discussing":
        raise HTTPException(status_code=409, detail="Grouping is only allowed during the discussing phase")

    card = next((c for c in session.cards if c.id == card_id), None)
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")

    target = next((c for c in session.cards if c.id == body.target_card_id), None)
    if not target:
        raise HTTPException(status_code=404, detail="Target card not found")

    if not card.published:
        raise HTTPException(status_code=409, detail="Card must be published to group")
    if not target.published:
        raise HTTPException(status_code=409, detail="Target card must be published to group")

    # Determine the group UUID: reuse target's existing group or create a new one
    new_group_id = target.group_id if target.group_id is not None else str(uuid4())
    if target.group_id is None:
        target.group_id = new_group_id

    # Remove card from its old group, cleaning up any resulting singleton
    old_group_id = card.group_id
    card.group_id = new_group_id

    if old_group_id and old_group_id != new_group_id:
        remaining = [c for c in session.cards if c.group_id == old_group_id]
        if len(remaining) == 1:
            remaining[0].group_id = None

    session = await repo.update(session)
    await sse_manager.broadcast(session_id, _public(session))
    return _public(session)


@router.delete("/{session_id}/cards/{card_id}/group", status_code=204)
async def ungroup_card(
    session_id: str,
    card_id: str,
    x_participant_name: str | None = Header(default=None),
    repo: SessionRepository = Depends(get_repo),
) -> None:
    if not x_participant_name:
        raise HTTPException(status_code=400, detail="X-Participant-Name header required")

    session = await repo.get_by_id(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.phase != "discussing":
        raise HTTPException(status_code=409, detail="Ungrouping is only allowed during the discussing phase")

    card = next((c for c in session.cards if c.id == card_id), None)
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")

    old_group_id = card.group_id
    card.group_id = None

    if old_group_id:
        remaining = [c for c in session.cards if c.group_id == old_group_id]
        if len(remaining) == 1:
            remaining[0].group_id = None

    session = await repo.update(session)
    await sse_manager.broadcast(session_id, _public(session))
