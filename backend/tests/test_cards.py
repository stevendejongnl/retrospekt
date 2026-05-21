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


async def test_participant_can_add_a_card_in_discussing_phase(client: AsyncClient):
    session = await make_session(client)
    await client.post(
        f"/api/v1/sessions/{session.id}/phase",
        json={"phase": "discussing"},
        headers={"X-Facilitator-Token": session.facilitator_token},
    )
    response = await client.post(
        f"/api/v1/sessions/{session.id}/cards",
        json={"column": "Went Well", "text": "Late thought", "author_name": "Alice"},
    )
    assert response.status_code == 201
    card = response.json()
    assert card["text"] == "Late thought"
    assert not card["published"]


async def test_cards_cannot_be_added_in_closed_phase(client: AsyncClient):
    session = await make_session(client)
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


# ---------------------------------------------------------------------------
# Vote limit enforcement
# ---------------------------------------------------------------------------


async def _to_discussing(client: AsyncClient, session_id: str, token: str) -> None:
    await client.post(
        f"/api/v1/sessions/{session_id}/phase",
        json={"phase": "discussing"},
        headers={"X-Facilitator-Token": token},
    )


async def _publish(client: AsyncClient, session_id: str, card_id: str, author: str) -> None:
    await client.post(
        f"/api/v1/sessions/{session_id}/cards/{card_id}/publish",
        headers={"X-Participant-Name": author},
    )


async def _vote(client: AsyncClient, session_id: str, card_id: str, voter: str) -> int:
    r = await client.post(
        f"/api/v1/sessions/{session_id}/cards/{card_id}/votes",
        headers={"X-Participant-Name": voter},
    )
    return r.status_code


async def _set_max_votes(client: AsyncClient, session_id: str, token: str, limit: int) -> None:
    await client.patch(
        f"/api/v1/sessions/{session_id}",
        json={"max_votes_per_participant": limit},
        headers={"X-Facilitator-Token": token},
    )


async def test_vote_succeeds_when_under_limit(client: AsyncClient):
    session = await make_session(client)
    card = await _add_card(client, session.id, author="Bob")
    await _to_discussing(client, session.id, session.facilitator_token)
    await _publish(client, session.id, card["id"], "Bob")
    await _set_max_votes(client, session.id, session.facilitator_token, 2)

    status = await _vote(client, session.id, card["id"], "Alice")
    assert status == 200


async def test_vote_blocked_when_at_limit(client: AsyncClient):
    session = await make_session(client)
    card1 = await _add_card(client, session.id, author="Bob")
    card2_resp = await client.post(
        f"/api/v1/sessions/{session.id}/cards",
        json={"column": "Went Well", "text": "Second", "author_name": "Bob"},
    )
    card2 = card2_resp.json()
    await _to_discussing(client, session.id, session.facilitator_token)
    await _publish(client, session.id, card1["id"], "Bob")
    await _publish(client, session.id, card2["id"], "Bob")
    await _set_max_votes(client, session.id, session.facilitator_token, 1)

    await _vote(client, session.id, card1["id"], "Alice")  # uses the 1 vote
    status = await _vote(client, session.id, card2["id"], "Alice")  # should be blocked
    assert status == 409


async def test_vote_limit_counts_group_as_one(client: AsyncClient):
    """Two cards in the same group that Alice voted on count as 1 used vote, not 2."""
    session = await make_session(client)
    card1 = await _add_card(client, session.id, author="Bob")
    card2_resp = await client.post(
        f"/api/v1/sessions/{session.id}/cards",
        json={"column": "Went Well", "text": "Second", "author_name": "Bob"},
    )
    card2 = card2_resp.json()
    card3_resp = await client.post(
        f"/api/v1/sessions/{session.id}/cards",
        json={"column": "Went Well", "text": "Third", "author_name": "Bob"},
    )
    card3 = card3_resp.json()

    await _to_discussing(client, session.id, session.facilitator_token)
    for cid in [card1["id"], card2["id"], card3["id"]]:
        await _publish(client, session.id, cid, "Bob")

    # Group card1 + card2
    await client.post(
        f"/api/v1/sessions/{session.id}/cards/{card1['id']}/group",
        json={"target_card_id": card2["id"]},
        headers={"X-Participant-Name": "Bob"},
    )

    await _set_max_votes(client, session.id, session.facilitator_token, 2)
    # Vote on card1 (in a group) — uses 1 vote item (the group)
    await _vote(client, session.id, card1["id"], "Alice")
    # Vote on card3 (solo) — uses 1 more vote item. Total = 2, at limit
    await _vote(client, session.id, card3["id"], "Alice")
    # Add a 4th solo card - should be blocked (2 vote items already used)
    card4_resp = await client.post(
        f"/api/v1/sessions/{session.id}/cards",
        json={"column": "Went Well", "text": "Fourth", "author_name": "Bob"},
    )
    card4 = card4_resp.json()
    await _publish(client, session.id, card4["id"], "Bob")
    status = await _vote(client, session.id, card4["id"], "Alice")
    assert status == 409  # 2 vote items already used (group + card3)
