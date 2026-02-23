"""Card management specifications."""

from httpx import AsyncClient

from tests.conftest import make_session


async def _add_card(client: AsyncClient, session_id: str, *, author: str = "Alice") -> dict:
    response = await client.post(
        f"/api/v1/sessions/{session_id}/cards",
        json={"column": "Went Well", "text": "Good teamwork", "author_name": author},
    )
    assert response.status_code == 201, response.text
    return response.json()


async def test_participant_can_add_a_card_in_collecting_phase(client: AsyncClient):
    session = await make_session(client)
    card = await _add_card(client, session.id)
    assert card["text"] == "Good teamwork"
    assert card["column"] == "Went Well"
    assert card["author_name"] == "Alice"


async def test_cards_cannot_be_added_outside_collecting_phase(client: AsyncClient):
    session = await make_session(client)
    # Advance to discussing
    await client.post(
        f"/api/v1/sessions/{session.id}/phase",
        json={"phase": "discussing"},
        headers={"X-Facilitator-Token": session.facilitator_token},
    )
    response = await client.post(
        f"/api/v1/sessions/{session.id}/cards",
        json={"column": "Went Well", "text": "Too late", "author_name": "Alice"},
    )
    assert response.status_code == 409


async def test_author_can_delete_their_own_card(client: AsyncClient):
    session = await make_session(client)
    card = await _add_card(client, session.id, author="Alice")
    response = await client.delete(
        f"/api/v1/sessions/{session.id}/cards/{card['id']}",
        headers={"X-Participant-Name": "Alice"},
    )
    assert response.status_code == 204
    data = (await client.get(f"/api/v1/sessions/{session.id}")).json()
    assert not data["cards"]


async def test_non_author_cannot_delete_a_card(client: AsyncClient):
    session = await make_session(client)
    card = await _add_card(client, session.id, author="Alice")
    response = await client.delete(
        f"/api/v1/sessions/{session.id}/cards/{card['id']}",
        headers={"X-Participant-Name": "Bob"},
    )
    assert response.status_code == 403


async def test_deleting_missing_card_returns_404(client: AsyncClient):
    session = await make_session(client)
    response = await client.delete(
        f"/api/v1/sessions/{session.id}/cards/no-such-card",
        headers={"X-Participant-Name": "Alice"},
    )
    assert response.status_code == 404
