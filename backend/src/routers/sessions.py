from collections.abc import AsyncGenerator
from datetime import UTC, datetime, timedelta
from uuid import uuid4

from fastapi import APIRouter, Depends, Header, HTTPException
from fastapi.responses import StreamingResponse

from ..dependencies import get_repo
from ..models.requests import (
    AddColumnRequest,
    CreateSessionRequest,
    JoinSessionRequest,
    RenameColumnRequest,
    SetPhaseRequest,
    SetTimerDurationRequest,
)
from ..models.session import Participant, Session, SessionPhase, TimerState
from ..repositories.session_repo import SessionRepository
from ..services.sse_manager import sse_manager

router = APIRouter(prefix="/api/v1/sessions")


def _public(session: Session) -> dict:
    """Strip internal fields before sending to clients."""
    d = session.model_dump()
    d.pop("facilitator_token", None)
    d.pop("last_accessed_at", None)
    return d


@router.post("", status_code=201)
async def create_session(
    body: CreateSessionRequest,
    repo: SessionRepository = Depends(get_repo),
) -> dict:
    session = Session(id=str(uuid4()), name=body.name, reactions_enabled=body.reactions_enabled)
    if body.columns:
        session.columns = body.columns
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
    await repo.touch(session_id)  # reset expiry clock
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


@router.post("/{session_id}/columns", status_code=201)
async def add_column(
    session_id: str,
    body: AddColumnRequest,
    x_facilitator_token: str | None = Header(default=None),
    repo: SessionRepository = Depends(get_repo),
) -> dict:
    session = await repo.get_by_id(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.facilitator_token != x_facilitator_token:
        raise HTTPException(status_code=403, detail="Facilitator token required")
    if session.phase != SessionPhase.COLLECTING:
        raise HTTPException(status_code=409, detail="Columns can only be modified during collecting phase")
    if body.name in session.columns:
        raise HTTPException(status_code=409, detail="Column already exists")

    session.columns.append(body.name)
    session = await repo.update(session)
    await sse_manager.broadcast(session_id, _public(session))
    return _public(session)


@router.patch("/{session_id}/columns/{column_name}")
async def rename_column(
    session_id: str,
    column_name: str,
    body: RenameColumnRequest,
    x_facilitator_token: str | None = Header(default=None),
    repo: SessionRepository = Depends(get_repo),
) -> dict:
    session = await repo.get_by_id(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.facilitator_token != x_facilitator_token:
        raise HTTPException(status_code=403, detail="Facilitator token required")
    if session.phase != SessionPhase.COLLECTING:
        raise HTTPException(status_code=409, detail="Columns can only be modified during collecting phase")
    if column_name not in session.columns:
        raise HTTPException(status_code=404, detail="Column not found")
    if body.name in session.columns and body.name != column_name:
        raise HTTPException(status_code=409, detail="Column name already in use")

    idx = session.columns.index(column_name)
    session.columns[idx] = body.name
    for card in session.cards:
        if card.column == column_name:
            card.column = body.name

    session = await repo.update(session)
    await sse_manager.broadcast(session_id, _public(session))
    return _public(session)


@router.delete("/{session_id}/columns/{column_name}", status_code=204)
async def remove_column(
    session_id: str,
    column_name: str,
    x_facilitator_token: str | None = Header(default=None),
    repo: SessionRepository = Depends(get_repo),
) -> None:
    session = await repo.get_by_id(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.facilitator_token != x_facilitator_token:
        raise HTTPException(status_code=403, detail="Facilitator token required")
    if session.phase != SessionPhase.COLLECTING:
        raise HTTPException(status_code=409, detail="Columns can only be modified during collecting phase")
    if column_name not in session.columns:
        raise HTTPException(status_code=404, detail="Column not found")

    session.columns.remove(column_name)
    session.cards = [c for c in session.cards if c.column != column_name]
    session = await repo.update(session)
    await sse_manager.broadcast(session_id, _public(session))


@router.patch("/{session_id}/timer")
async def set_timer_duration(
    session_id: str,
    body: SetTimerDurationRequest,
    x_facilitator_token: str | None = Header(default=None),
    repo: SessionRepository = Depends(get_repo),
) -> dict:
    session = await repo.get_by_id(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.facilitator_token != x_facilitator_token:
        raise HTTPException(status_code=403, detail="Facilitator token required")
    if not (30 <= body.duration_seconds <= 7200):
        raise HTTPException(status_code=400, detail="Duration must be between 30 and 7200 seconds")

    session.timer = TimerState(duration_seconds=body.duration_seconds)
    session = await repo.update(session)
    await sse_manager.broadcast(session_id, _public(session))
    return _public(session)


@router.post("/{session_id}/timer/start")
async def start_timer(
    session_id: str,
    x_facilitator_token: str | None = Header(default=None),
    repo: SessionRepository = Depends(get_repo),
) -> dict:
    session = await repo.get_by_id(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.facilitator_token != x_facilitator_token:
        raise HTTPException(status_code=403, detail="Facilitator token required")
    if not session.timer:
        raise HTTPException(status_code=409, detail="No timer configured")
    if session.timer.paused_remaining is not None and session.timer.paused_remaining <= 0:
        raise HTTPException(status_code=409, detail="Timer has expired — reset before starting")

    now = datetime.now(UTC)
    if session.timer.paused_remaining is not None:
        # Resume: adjust started_at so elapsed = duration - paused_remaining
        already_elapsed = session.timer.duration_seconds - session.timer.paused_remaining
        session.timer.started_at = now - timedelta(seconds=already_elapsed)
    else:
        session.timer.started_at = now
    session.timer.paused_remaining = None

    session = await repo.update(session)
    await sse_manager.broadcast(session_id, _public(session))
    return _public(session)


@router.post("/{session_id}/timer/pause")
async def pause_timer(
    session_id: str,
    x_facilitator_token: str | None = Header(default=None),
    repo: SessionRepository = Depends(get_repo),
) -> dict:
    session = await repo.get_by_id(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.facilitator_token != x_facilitator_token:
        raise HTTPException(status_code=403, detail="Facilitator token required")
    if not session.timer or not session.timer.started_at:
        raise HTTPException(status_code=409, detail="Timer is not running")

    now = datetime.now(UTC)
    elapsed = (now - session.timer.started_at).total_seconds()
    session.timer.paused_remaining = max(0, int(session.timer.duration_seconds - elapsed))
    session.timer.started_at = None

    session = await repo.update(session)
    await sse_manager.broadcast(session_id, _public(session))
    return _public(session)


@router.post("/{session_id}/timer/reset")
async def reset_timer(
    session_id: str,
    x_facilitator_token: str | None = Header(default=None),
    repo: SessionRepository = Depends(get_repo),
) -> dict:
    session = await repo.get_by_id(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.facilitator_token != x_facilitator_token:
        raise HTTPException(status_code=403, detail="Facilitator token required")
    if not session.timer:
        raise HTTPException(status_code=409, detail="No timer configured")

    session.timer.started_at = None
    session.timer.paused_remaining = None

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

    async def event_stream() -> AsyncGenerator[str, None]:  # pragma: no cover
        async for chunk in sse_manager.stream(session_id, initial_data=_public(session)):
            yield chunk

    return StreamingResponse(  # pragma: no cover
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )
