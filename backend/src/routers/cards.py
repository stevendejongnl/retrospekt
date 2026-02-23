from fastapi import APIRouter, Depends, Header, HTTPException

from ..dependencies import get_repo
from ..models.requests import AddCardRequest
from ..models.session import Card, Session, Vote
from ..repositories.session_repo import SessionRepository
from ..services.sse_manager import sse_manager

router = APIRouter(prefix="/api/v1/sessions")


def _public(session: Session) -> dict:
    d = session.model_dump()
    d.pop("facilitator_token", None)
    return d


@router.post("/{session_id}/cards", status_code=201)
async def add_card(
    session_id: str,
    body: AddCardRequest,
    repo: SessionRepository = Depends(get_repo),
) -> dict:
    session = await repo.get_by_id(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.phase != "collecting":
        raise HTTPException(status_code=409, detail="Cards can only be added during collecting phase")

    card = Card(column=body.column, text=body.text, author_name=body.author_name)
    session.cards.append(card)
    session = await repo.update(session)
    await sse_manager.broadcast(session_id, _public(session))
    return card.model_dump()


@router.delete("/{session_id}/cards/{card_id}", status_code=204)
async def delete_card(
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

    card = next((c for c in session.cards if c.id == card_id), None)
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    if card.author_name != x_participant_name:
        raise HTTPException(status_code=403, detail="Only the author can delete this card")

    session.cards = [c for c in session.cards if c.id != card_id]
    session = await repo.update(session)
    await sse_manager.broadcast(session_id, _public(session))


@router.post("/{session_id}/cards/{card_id}/votes")
async def add_vote(
    session_id: str,
    card_id: str,
    x_participant_name: str | None = Header(default=None),
    repo: SessionRepository = Depends(get_repo),
) -> dict:
    if not x_participant_name:
        raise HTTPException(status_code=400, detail="X-Participant-Name header required")

    session = await repo.get_by_id(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    card = next((c for c in session.cards if c.id == card_id), None)
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")

    # Idempotent — ignore duplicate votes
    if not any(v.participant_name == x_participant_name for v in card.votes):
        card.votes.append(Vote(participant_name=x_participant_name))
        session = await repo.update(session)
        await sse_manager.broadcast(session_id, _public(session))

    updated_card = next(c for c in session.cards if c.id == card_id)
    return updated_card.model_dump()


@router.delete("/{session_id}/cards/{card_id}/votes")
async def remove_vote(
    session_id: str,
    card_id: str,
    x_participant_name: str | None = Header(default=None),
    repo: SessionRepository = Depends(get_repo),
) -> dict:
    if not x_participant_name:
        raise HTTPException(status_code=400, detail="X-Participant-Name header required")

    session = await repo.get_by_id(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    card = next((c for c in session.cards if c.id == card_id), None)
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")

    card.votes = [v for v in card.votes if v.participant_name != x_participant_name]
    session = await repo.update(session)
    await sse_manager.broadcast(session_id, _public(session))

    updated_card = next(c for c in session.cards if c.id == card_id)
    return updated_card.model_dump()
