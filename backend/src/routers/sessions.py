from collections.abc import AsyncGenerator
from uuid import uuid4

from fastapi import APIRouter, Depends, Header, HTTPException
from fastapi.responses import StreamingResponse

from ..dependencies import get_repo
from ..models.requests import CreateSessionRequest, JoinSessionRequest, SetPhaseRequest
from ..models.session import Participant, Session, SessionPhase
from ..repositories.session_repo import SessionRepository
from ..services.sse_manager import sse_manager

router = APIRouter(prefix="/api/v1/sessions")


def _public(session: Session) -> dict:
    """Strip facilitator_token before sending to clients."""
    d = session.model_dump()
    d.pop("facilitator_token", None)
    return d


@router.post("", status_code=201)
async def create_session(
    body: CreateSessionRequest,
    repo: SessionRepository = Depends(get_repo),
) -> dict:
    session = Session(id=str(uuid4()), name=body.name)
    # Seed the creator as first participant
    session.participants.append(Participant(name=body.participant_name))
    session = await repo.create(session)
    # Return full dict including facilitator_token (only time it's exposed)
    return session.model_dump()


@router.get("/{session_id}")
async def get_session(
    session_id: str,
    repo: SessionRepository = Depends(get_repo),
) -> dict:
    session = await repo.get_by_id(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return _public(session)


@router.post("/{session_id}/join")
async def join_session(
    session_id: str,
    body: JoinSessionRequest,
    repo: SessionRepository = Depends(get_repo),
) -> dict:
    session = await repo.get_by_id(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    existing_names = {p.name for p in session.participants}
    if body.participant_name not in existing_names:
        session.participants.append(Participant(name=body.participant_name))
        session = await repo.update(session)
        await sse_manager.broadcast(session_id, _public(session))

    return _public(session)


@router.post("/{session_id}/phase")
async def set_phase(
    session_id: str,
    body: SetPhaseRequest,
    x_facilitator_token: str | None = Header(default=None),
    repo: SessionRepository = Depends(get_repo),
) -> dict:
    session = await repo.get_by_id(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.facilitator_token != x_facilitator_token:
        raise HTTPException(status_code=403, detail="Facilitator token required")

    try:
        session.phase = SessionPhase(body.phase)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid phase: {body.phase}")

    session = await repo.update(session)
    await sse_manager.broadcast(session_id, _public(session))
    return _public(session)


@router.get("/{session_id}/stream")
async def stream_session(
    session_id: str,
    repo: SessionRepository = Depends(get_repo),
) -> StreamingResponse:
    session = await repo.get_by_id(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    queue = sse_manager.subscribe(session_id)

    async def event_stream() -> AsyncGenerator[str, None]:
        async for chunk in sse_manager.stream(session_id, queue):
            yield chunk

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )
