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


async def test_add_card_unknown_session_returns_404(client: AsyncClient):
    response = await client.post(
        "/api/v1/sessions/no-such/cards",
        json={"column": "Went Well", "text": "Oops", "author_name": "Alice"},
    )
    assert response.status_code == 404


async def test_delete_card_missing_participant_name_returns_400(client: AsyncClient):
    session = await make_session(client)
    card = await _add_card(client, session.id)
    response = await client.delete(f"/api/v1/sessions/{session.id}/cards/{card['id']}")
    assert response.status_code == 400


async def test_delete_card_unknown_session_returns_404(client: AsyncClient):
    response = await client.delete(
        "/api/v1/sessions/no-such/cards/no-such-card",
        headers={"X-Participant-Name": "Alice"},
    )
    assert response.status_code == 404


# ---------------------------------------------------------------------------
# Edit card text
# ---------------------------------------------------------------------------


async def test_author_can_edit_card_text_in_collecting_phase(client: AsyncClient):
    session = await make_session(client)
    card = await _add_card(client, session.id, author="Alice")
    response = await client.patch(
        f"/api/v1/sessions/{session.id}/cards/{card['id']}/text",
        json={"text": "Updated text"},
        headers={"X-Participant-Name": "Alice"},
    )
    assert response.status_code == 200
    data = (await client.get(f"/api/v1/sessions/{session.id}")).json()
    updated = next(c for c in data["cards"] if c["id"] == card["id"])
    assert updated["text"] == "Updated text"


async def test_author_can_edit_published_card_and_it_stays_published(client: AsyncClient):
    session = await make_session(client)
    card = await _add_card(client, session.id, author="Alice")
    # Advance to discussing and publish the card
    await client.post(
        f"/api/v1/sessions/{session.id}/phase",
        json={"phase": "discussing"},
        headers={"X-Facilitator-Token": session.facilitator_token},
    )
    await client.post(
        f"/api/v1/sessions/{session.id}/cards/{card['id']}/publish",
        headers={"X-Participant-Name": "Alice"},
    )
    response = await client.patch(
        f"/api/v1/sessions/{session.id}/cards/{card['id']}/text",
        json={"text": "Edited after publish"},
        headers={"X-Participant-Name": "Alice"},
    )
    assert response.status_code == 200
    data = (await client.get(f"/api/v1/sessions/{session.id}")).json()
    updated = next(c for c in data["cards"] if c["id"] == card["id"])
    assert updated["text"] == "Edited after publish"
    assert updated["published"] is True


async def test_non_author_cannot_edit_card_text(client: AsyncClient):
    session = await make_session(client)
    card = await _add_card(client, session.id, author="Alice")
    response = await client.patch(
        f"/api/v1/sessions/{session.id}/cards/{card['id']}/text",
        json={"text": "Stolen edit"},
        headers={"X-Participant-Name": "Bob"},
    )
    assert response.status_code == 403


async def test_cannot_edit_card_text_in_closed_phase(client: AsyncClient):
    session = await make_session(client)
    card = await _add_card(client, session.id, author="Alice")
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
    response = await client.patch(
        f"/api/v1/sessions/{session.id}/cards/{card['id']}/text",
        json={"text": "Too late"},
        headers={"X-Participant-Name": "Alice"},
    )
    assert response.status_code == 409


async def test_edit_card_text_missing_card_returns_404(client: AsyncClient):
    session = await make_session(client)
    response = await client.patch(
        f"/api/v1/sessions/{session.id}/cards/no-such-card/text",
        json={"text": "Whatever"},
        headers={"X-Participant-Name": "Alice"},
    )
    assert response.status_code == 404


async def test_edit_card_text_missing_participant_header_returns_400(client: AsyncClient):
    session = await make_session(client)
    card = await _add_card(client, session.id)
    response = await client.patch(
        f"/api/v1/sessions/{session.id}/cards/{card['id']}/text",
        json={"text": "No header"},
    )
    assert response.status_code == 400
