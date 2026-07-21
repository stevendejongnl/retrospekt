"""Unpublish card specifications."""

from httpx import AsyncClient

from tests.conftest import make_session


async def _setup_published(client: AsyncClient, *, author: str = "Alice") -> tuple[str, str, str]:
    """Create session, add + publish a card. Returns (session_id, facilitator_token, card_id)."""
    session = await make_session(client)
    card = (
        await client.post(
            f"/api/v1/sessions/{session.id}/cards",
            json={"column": "Went Well", "text": "Smooth deploy", "author_name": author},
        )
    ).json()
    await client.post(
        f"/api/v1/sessions/{session.id}/phase",
        json={"phase": "discussing"},
        headers={"X-Facilitator-Token": session.facilitator_token},
    )
    await client.post(
        f"/api/v1/sessions/{session.id}/cards/{card['id']}/publish",
        headers={"X-Participant-Name": author},
    )
    return session.id, session.facilitator_token, card["id"]


async def test_author_can_unpublish_their_own_card(client: AsyncClient):
    session_id, _, card_id = await _setup_published(client)
    response = await client.post(
        f"/api/v1/sessions/{session_id}/cards/{card_id}/unpublish",
        headers={"X-Participant-Name": "Alice"},
    )
    assert response.status_code == 200
    assert response.json()["published"] is False


async def test_non_author_cannot_unpublish_a_card(client: AsyncClient):
    session_id, _, card_id = await _setup_published(client)
    response = await client.post(
        f"/api/v1/sessions/{session_id}/cards/{card_id}/unpublish",
        headers={"X-Participant-Name": "Bob"},
    )
    assert response.status_code == 403


async def test_unpublish_works_in_closed_phase(client: AsyncClient):
    session_id, facilitator_token, card_id = await _setup_published(client)
    await client.post(
        f"/api/v1/sessions/{session_id}/phase",
        json={"phase": "closed"},
        headers={"X-Facilitator-Token": facilitator_token},
    )
    response = await client.post(
        f"/api/v1/sessions/{session_id}/cards/{card_id}/unpublish",
        headers={"X-Participant-Name": "Alice"},
    )
    assert response.status_code == 200
    assert response.json()["published"] is False


async def test_unpublish_unknown_card_returns_404(client: AsyncClient):
    session_id, _, _ = await _setup_published(client)
    response = await client.post(
        f"/api/v1/sessions/{session_id}/cards/no-such-card/unpublish",
        headers={"X-Participant-Name": "Alice"},
    )
    assert response.status_code == 404


async def test_unpublish_unknown_session_returns_404(client: AsyncClient):
    response = await client.post(
        "/api/v1/sessions/no-such/cards/no-such-card/unpublish",
        headers={"X-Participant-Name": "Alice"},
    )
    assert response.status_code == 404


async def test_unpublish_missing_participant_name_returns_400(client: AsyncClient):
    session_id, _, card_id = await _setup_published(client)
    response = await client.post(f"/api/v1/sessions/{session_id}/cards/{card_id}/unpublish")
    assert response.status_code == 400


async def test_cannot_unpublish_grouped_card(client: AsyncClient):
    session_id, _, card_id = await _setup_published(client)
    # second published card to group with
    other = (
        await client.post(
            f"/api/v1/sessions/{session_id}/cards",
            json={"column": "Went Well", "text": "Other card", "author_name": "Alice"},
        )
    ).json()
    await client.post(
        f"/api/v1/sessions/{session_id}/cards/{other['id']}/publish",
        headers={"X-Participant-Name": "Alice"},
    )
    await client.post(
        f"/api/v1/sessions/{session_id}/cards/{card_id}/group",
        json={"target_card_id": other["id"]},
        headers={"X-Participant-Name": "Alice"},
    )
    response = await client.post(
        f"/api/v1/sessions/{session_id}/cards/{card_id}/unpublish",
        headers={"X-Participant-Name": "Alice"},
    )
    assert response.status_code == 409
