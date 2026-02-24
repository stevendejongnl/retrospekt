"""Publish card specifications — single card and bulk publish-all."""

from httpx import AsyncClient

from tests.conftest import make_session


async def _setup_discussing(client: AsyncClient, *, author: str = "Alice") -> tuple[str, str, str]:
    """Create session, add a card, advance to discussing. Returns (session_id, facilitator_token, card_id)."""
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
    return session.id, session.facilitator_token, card["id"]


# ── publish single card ──────────────────────────────────────────────────────

async def test_author_can_publish_their_own_card(client: AsyncClient):
    session_id, _, card_id = await _setup_discussing(client)
    response = await client.post(
        f"/api/v1/sessions/{session_id}/cards/{card_id}/publish",
        headers={"X-Participant-Name": "Alice"},
    )
    assert response.status_code == 200
    assert response.json()["published"] is True


async def test_non_author_cannot_publish_a_card(client: AsyncClient):
    session_id, _, card_id = await _setup_discussing(client)
    response = await client.post(
        f"/api/v1/sessions/{session_id}/cards/{card_id}/publish",
        headers={"X-Participant-Name": "Bob"},
    )
    assert response.status_code == 403


async def test_publish_requires_discussing_phase(client: AsyncClient):
    session = await make_session(client)
    card = (
        await client.post(
            f"/api/v1/sessions/{session.id}/cards",
            json={"column": "Went Well", "text": "Too early", "author_name": "Alice"},
        )
    ).json()
    response = await client.post(
        f"/api/v1/sessions/{session.id}/cards/{card['id']}/publish",
        headers={"X-Participant-Name": "Alice"},
    )
    assert response.status_code == 409


async def test_publish_unknown_card_returns_404(client: AsyncClient):
    session_id, _, _ = await _setup_discussing(client)
    response = await client.post(
        f"/api/v1/sessions/{session_id}/cards/no-such-card/publish",
        headers={"X-Participant-Name": "Alice"},
    )
    assert response.status_code == 404


async def test_publish_missing_participant_name_returns_400(client: AsyncClient):
    session_id, _, card_id = await _setup_discussing(client)
    response = await client.post(f"/api/v1/sessions/{session_id}/cards/{card_id}/publish")
    assert response.status_code == 400


# ── publish-all ──────────────────────────────────────────────────────────────

async def test_publish_all_publishes_authors_cards_in_column(client: AsyncClient):
    session = await make_session(client)
    for text in ("Card A", "Card B"):
        await client.post(
            f"/api/v1/sessions/{session.id}/cards",
            json={"column": "Went Well", "text": text, "author_name": "Alice"},
        )
    # A card by Bob — should NOT be published
    await client.post(
        f"/api/v1/sessions/{session.id}/cards",
        json={"column": "Went Well", "text": "Bob card", "author_name": "Bob"},
    )
    await client.post(
        f"/api/v1/sessions/{session.id}/phase",
        json={"phase": "discussing"},
        headers={"X-Facilitator-Token": session.facilitator_token},
    )
    response = await client.post(
        f"/api/v1/sessions/{session.id}/cards/publish-all",
        json={"column": "Went Well"},
        headers={"X-Participant-Name": "Alice"},
    )
    assert response.status_code == 200
    published = response.json()
    assert len(published) == 2
    assert all(c["published"] for c in published)
    assert all(c["author_name"] == "Alice" for c in published)


async def test_publish_all_is_idempotent_for_already_published_cards(client: AsyncClient):
    session_id, _, card_id = await _setup_discussing(client)
    await client.post(
        f"/api/v1/sessions/{session_id}/cards/{card_id}/publish",
        headers={"X-Participant-Name": "Alice"},
    )
    response = await client.post(
        f"/api/v1/sessions/{session_id}/cards/publish-all",
        json={"column": "Went Well"},
        headers={"X-Participant-Name": "Alice"},
    )
    assert response.status_code == 200
    assert response.json() == []  # already published — nothing new


async def test_publish_all_requires_discussing_phase(client: AsyncClient):
    session = await make_session(client)
    response = await client.post(
        f"/api/v1/sessions/{session.id}/cards/publish-all",
        json={"column": "Went Well"},
        headers={"X-Participant-Name": "Alice"},
    )
    assert response.status_code == 409


async def test_publish_all_missing_participant_name_returns_400(client: AsyncClient):
    session_id, _, _ = await _setup_discussing(client)
    response = await client.post(
        f"/api/v1/sessions/{session_id}/cards/publish-all",
        json={"column": "Went Well"},
    )
    assert response.status_code == 400


async def test_publish_all_unknown_session_returns_404(client: AsyncClient):
    response = await client.post(
        "/api/v1/sessions/no-such/cards/publish-all",
        json={"column": "Went Well"},
        headers={"X-Participant-Name": "Alice"},
    )
    assert response.status_code == 404
