"""Assignee specifications."""

from httpx import AsyncClient

from tests.conftest import make_session


async def _published_card(client: AsyncClient) -> tuple[str, str, str]:
    """Returns (session_id, facilitator_token, card_id) with card published in discussing phase."""
    session = await make_session(client)
    card = (
        await client.post(
            f"/api/v1/sessions/{session.id}/cards",
            json={"column": "Went Well", "text": "Fix flaky test", "author_name": "Alice"},
        )
    ).json()
    await client.post(
        f"/api/v1/sessions/{session.id}/phase",
        json={"phase": "discussing"},
        headers={"X-Facilitator-Token": session.facilitator_token},
    )
    await client.post(
        f"/api/v1/sessions/{session.id}/cards/{card['id']}/publish",
        headers={"X-Participant-Name": "Alice"},
    )
    return session.id, session.facilitator_token, card["id"]


async def test_author_can_assign_themselves(client: AsyncClient):
    session_id, _, card_id = await _published_card(client)
    response = await client.patch(
        f"/api/v1/sessions/{session_id}/cards/{card_id}/assignee",
        json={"assignee": "Alice"},
        headers={"X-Participant-Name": "Alice"},
    )
    assert response.status_code == 200
    assert response.json()["assignee"] == "Alice"


async def test_facilitator_can_assign_any_card(client: AsyncClient):
    session_id, facilitator_token, card_id = await _published_card(client)
    response = await client.patch(
        f"/api/v1/sessions/{session_id}/cards/{card_id}/assignee",
        json={"assignee": "Bob"},
        headers={"X-Facilitator-Token": facilitator_token},
    )
    assert response.status_code == 200
    assert response.json()["assignee"] == "Bob"


async def test_assignee_can_be_cleared(client: AsyncClient):
    session_id, _, card_id = await _published_card(client)
    await client.patch(
        f"/api/v1/sessions/{session_id}/cards/{card_id}/assignee",
        json={"assignee": "Alice"},
        headers={"X-Participant-Name": "Alice"},
    )
    response = await client.patch(
        f"/api/v1/sessions/{session_id}/cards/{card_id}/assignee",
        json={"assignee": None},
        headers={"X-Participant-Name": "Alice"},
    )
    assert response.status_code == 200
    assert response.json()["assignee"] is None


async def test_unauthorized_user_cannot_assign_card(client: AsyncClient):
    session_id, _, card_id = await _published_card(client)
    response = await client.patch(
        f"/api/v1/sessions/{session_id}/cards/{card_id}/assignee",
        json={"assignee": "Bob"},
        headers={"X-Participant-Name": "Bob"},
    )
    assert response.status_code == 403


async def test_cannot_assign_during_collecting_phase(client: AsyncClient):
    session = await make_session(client)
    card = (
        await client.post(
            f"/api/v1/sessions/{session.id}/cards",
            json={"column": "Went Well", "text": "Draft", "author_name": "Alice"},
        )
    ).json()
    response = await client.patch(
        f"/api/v1/sessions/{session.id}/cards/{card['id']}/assignee",
        json={"assignee": "Alice"},
        headers={"X-Participant-Name": "Alice"},
    )
    assert response.status_code == 409


async def test_cannot_assign_unpublished_card(client: AsyncClient):
    session = await make_session(client)
    card = (
        await client.post(
            f"/api/v1/sessions/{session.id}/cards",
            json={"column": "Went Well", "text": "Draft", "author_name": "Alice"},
        )
    ).json()
    await client.post(
        f"/api/v1/sessions/{session.id}/phase",
        json={"phase": "discussing"},
        headers={"X-Facilitator-Token": session.facilitator_token},
    )
    response = await client.patch(
        f"/api/v1/sessions/{session.id}/cards/{card['id']}/assignee",
        json={"assignee": "Alice"},
        headers={"X-Participant-Name": "Alice"},
    )
    assert response.status_code == 409


async def test_assign_unknown_session_returns_404(client: AsyncClient):
    response = await client.patch(
        "/api/v1/sessions/no-such/cards/no-such/assignee",
        json={"assignee": "Alice"},
        headers={"X-Participant-Name": "Alice"},
    )
    assert response.status_code == 404


async def test_assign_unknown_card_returns_404(client: AsyncClient):
    session_id, _, _ = await _published_card(client)
    response = await client.patch(
        f"/api/v1/sessions/{session_id}/cards/no-such-card/assignee",
        json={"assignee": "Alice"},
        headers={"X-Participant-Name": "Alice"},
    )
    assert response.status_code == 404
