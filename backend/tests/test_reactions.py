"""Emoji reaction specifications."""

from httpx import AsyncClient

from tests.conftest import make_session


async def _published_card(client: AsyncClient) -> tuple[str, str, str]:
    """Create session, add + publish a card in discussing phase. Returns (session_id, facilitator_token, card_id)."""
    session = await make_session(client)
    card = (
        await client.post(
            f"/api/v1/sessions/{session.id}/cards",
            json={"column": "Went Well", "text": "Green CI", "author_name": "Alice"},
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


# ── add reaction ─────────────────────────────────────────────────────────────

async def test_participant_can_add_a_reaction(client: AsyncClient):
    session_id, _, card_id = await _published_card(client)
    response = await client.post(
        f"/api/v1/sessions/{session_id}/cards/{card_id}/reactions",
        json={"emoji": "❤️"},
        headers={"X-Participant-Name": "Bob"},
    )
    assert response.status_code == 200
    reactions = response.json()["reactions"]
    assert len(reactions) == 1
    assert reactions[0]["emoji"] == "❤️"
    assert reactions[0]["participant_name"] == "Bob"


async def test_adding_same_reaction_twice_is_idempotent(client: AsyncClient):
    session_id, _, card_id = await _published_card(client)
    for _ in range(2):
        await client.post(
            f"/api/v1/sessions/{session_id}/cards/{card_id}/reactions",
            json={"emoji": "❤️"},
            headers={"X-Participant-Name": "Bob"},
        )
    response = await client.get(f"/api/v1/sessions/{session_id}")
    card = next(c for c in response.json()["cards"] if c["id"] == card_id)
    assert len(card["reactions"]) == 1


async def test_multiple_participants_can_react_with_same_emoji(client: AsyncClient):
    session_id, _, card_id = await _published_card(client)
    for name in ("Bob", "Carol", "Dave"):
        await client.post(
            f"/api/v1/sessions/{session_id}/cards/{card_id}/reactions",
            json={"emoji": "🎉"},
            headers={"X-Participant-Name": name},
        )
    response = await client.get(f"/api/v1/sessions/{session_id}")
    card = next(c for c in response.json()["cards"] if c["id"] == card_id)
    assert len(card["reactions"]) == 3


async def test_invalid_emoji_returns_400(client: AsyncClient):
    session_id, _, card_id = await _published_card(client)
    response = await client.post(
        f"/api/v1/sessions/{session_id}/cards/{card_id}/reactions",
        json={"emoji": "🦄"},
        headers={"X-Participant-Name": "Bob"},
    )
    assert response.status_code == 400


async def test_reaction_missing_participant_name_returns_400(client: AsyncClient):
    session_id, _, card_id = await _published_card(client)
    response = await client.post(
        f"/api/v1/sessions/{session_id}/cards/{card_id}/reactions",
        json={"emoji": "❤️"},
    )
    assert response.status_code == 400


async def test_reaction_on_unknown_session_returns_404(client: AsyncClient):
    response = await client.post(
        "/api/v1/sessions/no-such/cards/no-such/reactions",
        json={"emoji": "❤️"},
        headers={"X-Participant-Name": "Bob"},
    )
    assert response.status_code == 404


async def test_reaction_on_unknown_card_returns_404(client: AsyncClient):
    session_id, _, _ = await _published_card(client)
    response = await client.post(
        f"/api/v1/sessions/{session_id}/cards/no-such-card/reactions",
        json={"emoji": "❤️"},
        headers={"X-Participant-Name": "Bob"},
    )
    assert response.status_code == 404


async def test_reaction_on_unpublished_card_returns_409(client: AsyncClient):
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
    response = await client.post(
        f"/api/v1/sessions/{session.id}/cards/{card['id']}/reactions",
        json={"emoji": "❤️"},
        headers={"X-Participant-Name": "Bob"},
    )
    assert response.status_code == 409


async def test_reaction_not_allowed_in_collecting_phase(client: AsyncClient):
    session = await make_session(client)
    card = (
        await client.post(
            f"/api/v1/sessions/{session.id}/cards",
            json={"column": "Went Well", "text": "Draft", "author_name": "Alice"},
        )
    ).json()
    response = await client.post(
        f"/api/v1/sessions/{session.id}/cards/{card['id']}/reactions",
        json={"emoji": "❤️"},
        headers={"X-Participant-Name": "Alice"},
    )
    assert response.status_code == 409


async def test_reaction_allowed_in_closed_phase(client: AsyncClient):
    session_id, facilitator_token, card_id = await _published_card(client)
    await client.post(
        f"/api/v1/sessions/{session_id}/phase",
        json={"phase": "closed"},
        headers={"X-Facilitator-Token": facilitator_token},
    )
    response = await client.post(
        f"/api/v1/sessions/{session_id}/cards/{card_id}/reactions",
        json={"emoji": "❤️"},
        headers={"X-Participant-Name": "Bob"},
    )
    assert response.status_code == 200


# ── remove reaction ──────────────────────────────────────────────────────────

async def test_participant_can_remove_their_reaction(client: AsyncClient):
    session_id, _, card_id = await _published_card(client)
    await client.post(
        f"/api/v1/sessions/{session_id}/cards/{card_id}/reactions",
        json={"emoji": "❤️"},
        headers={"X-Participant-Name": "Bob"},
    )
    response = await client.delete(
        f"/api/v1/sessions/{session_id}/cards/{card_id}/reactions",
        params={"emoji": "❤️"},
        headers={"X-Participant-Name": "Bob"},
    )
    assert response.status_code == 204
    data = (await client.get(f"/api/v1/sessions/{session_id}")).json()
    card = next(c for c in data["cards"] if c["id"] == card_id)
    assert card["reactions"] == []


async def test_removing_nonexistent_reaction_is_a_no_op(client: AsyncClient):
    session_id, _, card_id = await _published_card(client)
    response = await client.delete(
        f"/api/v1/sessions/{session_id}/cards/{card_id}/reactions",
        params={"emoji": "❤️"},
        headers={"X-Participant-Name": "Nobody"},
    )
    assert response.status_code == 204


async def test_remove_reaction_missing_participant_name_returns_400(client: AsyncClient):
    session_id, _, card_id = await _published_card(client)
    response = await client.delete(
        f"/api/v1/sessions/{session_id}/cards/{card_id}/reactions",
        params={"emoji": "❤️"},
    )
    assert response.status_code == 400


async def test_remove_reaction_unknown_session_returns_404(client: AsyncClient):
    response = await client.delete(
        "/api/v1/sessions/no-such/cards/no-such/reactions",
        params={"emoji": "❤️"},
        headers={"X-Participant-Name": "Bob"},
    )
    assert response.status_code == 404


async def test_remove_reaction_unknown_card_returns_404(client: AsyncClient):
    session_id, _, _ = await _published_card(client)
    response = await client.delete(
        f"/api/v1/sessions/{session_id}/cards/no-such-card/reactions",
        params={"emoji": "❤️"},
        headers={"X-Participant-Name": "Bob"},
    )
    assert response.status_code == 404
