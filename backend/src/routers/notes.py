from fastapi import APIRouter, Depends, Header, HTTPException

from ..dependencies import get_repo
from ..models.requests import AddNoteRequest, UpdateNoteRequest
from ..models.session import Note, Session
from ..repositories.session_repo import SessionRepository
from ..services.sse_manager import sse_manager

router = APIRouter(prefix="/api/v1/sessions")


def _public(session: Session) -> dict:
    d = session.model_dump()
    d.pop("facilitator_token", None)
    return d


@router.post("/{session_id}/notes", status_code=201)
async def add_note(
    session_id: str,
    body: AddNoteRequest,
    x_participant_name: str | None = Header(default=None),
    repo: SessionRepository = Depends(get_repo),
) -> dict:
    if not x_participant_name:
        raise HTTPException(status_code=400, detail="X-Participant-Name header required")

    session = await repo.get_by_id(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    note = Note(text=body.text, author_name=body.author_name)
    session.notes.append(note)
    session = await repo.update(session)
    await sse_manager.broadcast(session_id, _public(session))
    return note.model_dump()


@router.patch("/{session_id}/notes/{note_id}")
async def update_note(
    session_id: str,
    note_id: str,
    body: UpdateNoteRequest,
    x_participant_name: str | None = Header(default=None),
    repo: SessionRepository = Depends(get_repo),
) -> dict:
    if not x_participant_name:
        raise HTTPException(status_code=400, detail="X-Participant-Name header required")

    session = await repo.get_by_id(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    note = next((n for n in session.notes if n.id == note_id), None)
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    note.text = body.text
    session = await repo.update(session)
    await sse_manager.broadcast(session_id, _public(session))

    updated_note = next(n for n in session.notes if n.id == note_id)
    return updated_note.model_dump()


@router.delete("/{session_id}/notes/{note_id}", status_code=204)
async def delete_note(
    session_id: str,
    note_id: str,
    x_participant_name: str | None = Header(default=None),
    repo: SessionRepository = Depends(get_repo),
) -> None:
    if not x_participant_name:
        raise HTTPException(status_code=400, detail="X-Participant-Name header required")

    session = await repo.get_by_id(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    note = next((n for n in session.notes if n.id == note_id), None)
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    session.notes = [n for n in session.notes if n.id != note_id]
    session = await repo.update(session)
    await sse_manager.broadcast(session_id, _public(session))
