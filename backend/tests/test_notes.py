"""Board notes specifications."""

from httpx import AsyncClient

from tests.conftest import make_session


async def _add_note(
    client: AsyncClient,
    session_id: str,
    *,
    author: str = "Alice",
    text: str = "Don't forget to celebrate wins",
) -> dict:
    response = await client.post(
        f"/api/v1/sessions/{session_id}/notes",
        json={"text": text, "author_name": author},
        headers={"X-Participant-Name": author},
    )
    assert response.status_code == 201, response.text
    return response.json()


async def test_participant_can_add_a_note(client: AsyncClient):
    session = await make_session(client)
    note = await _add_note(client, session.id)
    assert note["text"] == "Don't forget to celebrate wins"
    assert note["author_name"] == "Alice"
    assert "id" in note
    assert "created_at" in note


async def test_added_note_appears_in_session(client: AsyncClient):
    session = await make_session(client)
    note = await _add_note(client, session.id)
    data = (await client.get(f"/api/v1/sessions/{session.id}")).json()
    assert len(data["notes"]) == 1
    assert data["notes"][0]["id"] == note["id"]


async def test_anyone_can_edit_a_note(client: AsyncClient):
    session = await make_session(client)
    note = await _add_note(client, session.id, author="Alice")
    response = await client.patch(
        f"/api/v1/sessions/{session.id}/notes/{note['id']}",
        json={"text": "Updated by Bob"},
        headers={"X-Participant-Name": "Bob"},
    )
    assert response.status_code == 200
    assert response.json()["text"] == "Updated by Bob"


async def test_edit_updates_note_in_session(client: AsyncClient):
    session = await make_session(client)
    note = await _add_note(client, session.id)
    await client.patch(
        f"/api/v1/sessions/{session.id}/notes/{note['id']}",
        json={"text": "Updated text"},
        headers={"X-Participant-Name": "Alice"},
    )
    data = (await client.get(f"/api/v1/sessions/{session.id}")).json()
    assert data["notes"][0]["text"] == "Updated text"


async def test_anyone_can_delete_a_note(client: AsyncClient):
    session = await make_session(client)
    note = await _add_note(client, session.id, author="Alice")
    response = await client.delete(
        f"/api/v1/sessions/{session.id}/notes/{note['id']}",
        headers={"X-Participant-Name": "Bob"},
    )
    assert response.status_code == 204
    data = (await client.get(f"/api/v1/sessions/{session.id}")).json()
    assert data["notes"] == []


async def test_delete_missing_note_returns_404(client: AsyncClient):
    session = await make_session(client)
    response = await client.delete(
        f"/api/v1/sessions/{session.id}/notes/nonexistent-id",
        headers={"X-Participant-Name": "Alice"},
    )
    assert response.status_code == 404


async def test_add_note_missing_session_returns_404(client: AsyncClient):
    response = await client.post(
        "/api/v1/sessions/no-such-session/notes",
        json={"text": "Hello", "author_name": "Alice"},
        headers={"X-Participant-Name": "Alice"},
    )
    assert response.status_code == 404


async def test_edit_note_missing_session_returns_404(client: AsyncClient):
    response = await client.patch(
        "/api/v1/sessions/no-such-session/notes/some-note-id",
        json={"text": "Updated"},
        headers={"X-Participant-Name": "Alice"},
    )
    assert response.status_code == 404


async def test_delete_note_missing_session_returns_404(client: AsyncClient):
    response = await client.delete(
        "/api/v1/sessions/no-such-session/notes/some-note-id",
        headers={"X-Participant-Name": "Alice"},
    )
    assert response.status_code == 404


async def test_add_note_missing_header_returns_400(client: AsyncClient):
    session = await make_session(client)
    response = await client.post(
        f"/api/v1/sessions/{session.id}/notes",
        json={"text": "Hello", "author_name": "Alice"},
    )
    assert response.status_code == 400


async def test_edit_note_missing_header_returns_400(client: AsyncClient):
    session = await make_session(client)
    note = await _add_note(client, session.id)
    response = await client.patch(
        f"/api/v1/sessions/{session.id}/notes/{note['id']}",
        json={"text": "Updated"},
    )
    assert response.status_code == 400


async def test_delete_note_missing_header_returns_400(client: AsyncClient):
    session = await make_session(client)
    note = await _add_note(client, session.id)
    response = await client.delete(
        f"/api/v1/sessions/{session.id}/notes/{note['id']}",
    )
    assert response.status_code == 400


async def test_notes_allowed_in_all_phases(client: AsyncClient):
    """Notes can be added in any phase, unlike cards."""
    session = await make_session(client)
    # Move to closed phase
    await client.post(
        f"/api/v1/sessions/{session.id}/phase",
        json={"phase": "discussing"},
        headers={"X-Facilitator-Token": session.facilitator_token},
    )
    await client.post(
        f"/api/v1/sessions/{session.id}/phase",
        json={"phase": "closed"},
        headers={"X-Facilitator-Token": session.facilitator_token},
    )
    # Notes still allowed
    response = await client.post(
        f"/api/v1/sessions/{session.id}/notes",
        json={"text": "Final note", "author_name": "Alice"},
        headers={"X-Participant-Name": "Alice"},
    )
    assert response.status_code == 201
