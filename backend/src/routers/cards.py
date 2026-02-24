from fastapi import APIRouter, Depends, Header, HTTPException, Query

from ..dependencies import get_repo
from ..models.requests import AddCardRequest, AddReactionRequest, AssignCardRequest, PublishAllRequest
from ..models.session import REACTION_EMOJI, Card, Reaction, Session, Vote
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

    if session.phase != "discussing":
        raise HTTPException(status_code=409, detail="Voting is only allowed during the discussion phase")

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


@router.post("/{session_id}/cards/publish-all")
async def publish_all_cards(
    session_id: str,
    body: PublishAllRequest,
    x_participant_name: str | None = Header(default=None),
    repo: SessionRepository = Depends(get_repo),
) -> list[dict]:
    if not x_participant_name:
        raise HTTPException(status_code=400, detail="X-Participant-Name header required")

    session = await repo.get_by_id(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.phase != "discussing":
        raise HTTPException(status_code=409, detail="Cards can only be published during the discussion phase")

    published = []
    for card in session.cards:
        if card.column == body.column and card.author_name == x_participant_name and not card.published:
            card.published = True
            published.append(card)

    if published:
        session = await repo.update(session)
        await sse_manager.broadcast(session_id, _public(session))

    return [c.model_dump() for c in published]


@router.post("/{session_id}/cards/{card_id}/publish")
async def publish_card(
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
    if session.phase != "discussing":
        raise HTTPException(status_code=409, detail="Cards can only be published during the discussion phase")

    card = next((c for c in session.cards if c.id == card_id), None)
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    if card.author_name != x_participant_name:
        raise HTTPException(status_code=403, detail="Only the author can publish this card")

    card.published = True
    session = await repo.update(session)
    await sse_manager.broadcast(session_id, _public(session))

    updated_card = next(c for c in session.cards if c.id == card_id)
    return updated_card.model_dump()


@router.post("/{session_id}/cards/{card_id}/reactions")
async def add_reaction(
    session_id: str,
    card_id: str,
    body: AddReactionRequest,
    x_participant_name: str | None = Header(default=None),
    repo: SessionRepository = Depends(get_repo),
) -> dict:
    if not x_participant_name:
        raise HTTPException(status_code=400, detail="X-Participant-Name header required")
    if body.emoji not in REACTION_EMOJI:
        raise HTTPException(status_code=400, detail="Invalid reaction emoji")

    session = await repo.get_by_id(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.phase not in ("discussing", "closed"):
        raise HTTPException(
            status_code=409, detail="Reactions are only allowed during discussing or closed phase"
        )

    card = next((c for c in session.cards if c.id == card_id), None)
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    if not card.published:
        raise HTTPException(status_code=409, detail="Card must be published to react")

    # Idempotent — ignore duplicate reactions
    if not any(r.emoji == body.emoji and r.participant_name == x_participant_name for r in card.reactions):
        card.reactions.append(Reaction(emoji=body.emoji, participant_name=x_participant_name))
        session = await repo.update(session)
        await sse_manager.broadcast(session_id, _public(session))

    updated_card = next(c for c in session.cards if c.id == card_id)
    return updated_card.model_dump()


@router.delete("/{session_id}/cards/{card_id}/reactions", status_code=204)
async def remove_reaction(
    session_id: str,
    card_id: str,
    emoji: str = Query(...),
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

    card.reactions = [
        r for r in card.reactions if not (r.emoji == emoji and r.participant_name == x_participant_name)
    ]
    session = await repo.update(session)
    await sse_manager.broadcast(session_id, _public(session))


@router.patch("/{session_id}/cards/{card_id}/assignee")
async def assign_card(
    session_id: str,
    card_id: str,
    body: AssignCardRequest,
    x_participant_name: str | None = Header(default=None),
    x_facilitator_token: str | None = Header(default=None),
    repo: SessionRepository = Depends(get_repo),
) -> dict:
    session = await repo.get_by_id(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.phase == "collecting":
        raise HTTPException(status_code=409, detail="Cards cannot be assigned during collecting phase")

    card = next((c for c in session.cards if c.id == card_id), None)
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    if not card.published:
        raise HTTPException(status_code=409, detail="Card must be published to assign")

    is_facilitator = session.facilitator_token == x_facilitator_token
    is_author = card.author_name == x_participant_name
    if not (is_facilitator or is_author):
        raise HTTPException(status_code=403, detail="Only the author or facilitator can assign this card")

    card.assignee = body.assignee
    session = await repo.update(session)
    await sse_manager.broadcast(session_id, _public(session))

    updated_card = next(c for c in session.cards if c.id == card_id)
    return updated_card.model_dump()
