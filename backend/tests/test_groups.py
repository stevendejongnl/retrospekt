"""Card grouping specifications."""

from httpx import AsyncClient

from tests.conftest import make_session

# ── Helpers ───────────────────────────────────────────────────────────────────


async def _add_card(
    client: AsyncClient,
    session_id: str,
    *,
    author: str,
    text: str = "Card text",
) -> dict:
    r = await client.post(
        f"/api/v1/sessions/{session_id}/cards",
        json={"column": "Went Well", "text": text, "author_name": author},
    )
    assert r.status_code == 201, r.text
    return r.json()


async def _publish(client: AsyncClient, session_id: str, card_id: str, *, author: str) -> None:
    r = await client.post(
        f"/api/v1/sessions/{session_id}/cards/{card_id}/publish",
        headers={"X-Participant-Name": author},
    )
    assert r.status_code == 200, r.text


async def _setup_discussing(client: AsyncClient, *, n: int = 2) -> tuple[str, str, list[dict]]:
    """Create session, add n cards, advance to discussing, publish all.

    Returns (session_id, facilitator_token, list[card]).
    """
    authors = ["Alice", "Bob", "Carol"]
    session = await make_session(client)

    raw_cards: list[tuple[dict, str]] = []
    for i in range(n):
        author = authors[i % len(authors)]
        card = await _add_card(client, session.id, author=author, text=f"Card {i + 1}")
        raw_cards.append((card, author))

    await client.post(
        f"/api/v1/sessions/{session.id}/phase",
        json={"phase": "discussing"},
        headers={"X-Facilitator-Token": session.facilitator_token},
    )

    cards = []
    for card, author in raw_cards:
        await _publish(client, session.id, card["id"], author=author)
        cards.append(card)

    return session.id, session.facilitator_token, cards


# ── POST /sessions/{id}/cards/{id}/group ─────────────────────────────────────


async def test_group_two_published_cards(client: AsyncClient):
    session_id, _, cards = await _setup_discussing(client, n=2)
    card1, card2 = cards

    r = await client.post(
        f"/api/v1/sessions/{session_id}/cards/{card1['id']}/group",
        json={"target_card_id": card2["id"]},
        headers={"X-Participant-Name": "Alice"},
    )
    assert r.status_code == 200, r.text

    data = (await client.get(f"/api/v1/sessions/{session_id}")).json()
    c1 = next(c for c in data["cards"] if c["id"] == card1["id"])
    c2 = next(c for c in data["cards"] if c["id"] == card2["id"])

    assert c1["group_id"] is not None
    assert c2["group_id"] is not None
    assert c1["group_id"] == c2["group_id"]


async def test_group_card_onto_group_member_joins_existing_group(client: AsyncClient):
    session_id, _, cards = await _setup_discussing(client, n=3)
    card1, card2, card3 = cards

    # First group card1 with card2
    await client.post(
        f"/api/v1/sessions/{session_id}/cards/{card1['id']}/group",
        json={"target_card_id": card2["id"]},
        headers={"X-Participant-Name": "Alice"},
    )

    # Now group card3 onto card2 (which is already in a group)
    r = await client.post(
        f"/api/v1/sessions/{session_id}/cards/{card3['id']}/group",
        json={"target_card_id": card2["id"]},
        headers={"X-Participant-Name": "Carol"},
    )
    assert r.status_code == 200, r.text

    data = (await client.get(f"/api/v1/sessions/{session_id}")).json()
    c1 = next(c for c in data["cards"] if c["id"] == card1["id"])
    c2 = next(c for c in data["cards"] if c["id"] == card2["id"])
    c3 = next(c for c in data["cards"] if c["id"] == card3["id"])

    assert c1["group_id"] == c2["group_id"] == c3["group_id"]


async def test_group_id_is_valid_uuid(client: AsyncClient):
    import re

    session_id, _, cards = await _setup_discussing(client, n=2)
    card1, card2 = cards

    await client.post(
        f"/api/v1/sessions/{session_id}/cards/{card1['id']}/group",
        json={"target_card_id": card2["id"]},
        headers={"X-Participant-Name": "Alice"},
    )

    data = (await client.get(f"/api/v1/sessions/{session_id}")).json()
    c1 = next(c for c in data["cards"] if c["id"] == card1["id"])
    uuid_re = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")
    assert uuid_re.match(c1["group_id"])


async def test_cannot_group_in_collecting_phase(client: AsyncClient):
    session = await make_session(client)
    card1 = await _add_card(client, session.id, author="Alice", text="A")
    card2 = await _add_card(client, session.id, author="Bob", text="B")

    r = await client.post(
        f"/api/v1/sessions/{session.id}/cards/{card1['id']}/group",
        json={"target_card_id": card2["id"]},
        headers={"X-Participant-Name": "Alice"},
    )
    assert r.status_code == 409


async def test_cannot_group_in_closed_phase(client: AsyncClient):
    session_id, fac_token, cards = await _setup_discussing(client, n=2)
    card1, card2 = cards

    await client.post(
        f"/api/v1/sessions/{session_id}/phase",
        json={"phase": "closed"},
        headers={"X-Facilitator-Token": fac_token},
    )

    r = await client.post(
        f"/api/v1/sessions/{session_id}/cards/{card1['id']}/group",
        json={"target_card_id": card2["id"]},
        headers={"X-Participant-Name": "Alice"},
    )
    assert r.status_code == 409


async def test_cannot_group_unpublished_source_card(client: AsyncClient):
    session = await make_session(client)
    draft = await _add_card(client, session.id, author="Alice", text="Draft")
    published = await _add_card(client, session.id, author="Bob", text="Published")

    await client.post(
        f"/api/v1/sessions/{session.id}/phase",
        json={"phase": "discussing"},
        headers={"X-Facilitator-Token": session.facilitator_token},
    )
    await _publish(client, session.id, published["id"], author="Bob")

    r = await client.post(
        f"/api/v1/sessions/{session.id}/cards/{draft['id']}/group",
        json={"target_card_id": published["id"]},
        headers={"X-Participant-Name": "Alice"},
    )
    assert r.status_code == 409


async def test_cannot_group_unpublished_target_card(client: AsyncClient):
    session = await make_session(client)
    published = await _add_card(client, session.id, author="Alice", text="Published")
    draft = await _add_card(client, session.id, author="Bob", text="Draft")

    await client.post(
        f"/api/v1/sessions/{session.id}/phase",
        json={"phase": "discussing"},
        headers={"X-Facilitator-Token": session.facilitator_token},
    )
    await _publish(client, session.id, published["id"], author="Alice")

    r = await client.post(
        f"/api/v1/sessions/{session.id}/cards/{published['id']}/group",
        json={"target_card_id": draft["id"]},
        headers={"X-Participant-Name": "Alice"},
    )
    assert r.status_code == 409


async def test_group_missing_source_card_returns_404(client: AsyncClient):
    session_id, _, cards = await _setup_discussing(client, n=2)
    _, card2 = cards

    r = await client.post(
        f"/api/v1/sessions/{session_id}/cards/nonexistent/group",
        json={"target_card_id": card2["id"]},
        headers={"X-Participant-Name": "Alice"},
    )
    assert r.status_code == 404


async def test_group_missing_target_card_returns_404(client: AsyncClient):
    session_id, _, cards = await _setup_discussing(client, n=2)
    card1, _ = cards

    r = await client.post(
        f"/api/v1/sessions/{session_id}/cards/{card1['id']}/group",
        json={"target_card_id": "nonexistent"},
        headers={"X-Participant-Name": "Alice"},
    )
    assert r.status_code == 404


async def test_group_missing_session_returns_404(client: AsyncClient):
    r = await client.post(
        "/api/v1/sessions/ghost/cards/card-1/group",
        json={"target_card_id": "card-2"},
        headers={"X-Participant-Name": "Alice"},
    )
    assert r.status_code == 404


async def test_group_missing_participant_name_returns_400(client: AsyncClient):
    session_id, _, cards = await _setup_discussing(client, n=2)
    card1, card2 = cards

    r = await client.post(
        f"/api/v1/sessions/{session_id}/cards/{card1['id']}/group",
        json={"target_card_id": card2["id"]},
    )
    assert r.status_code == 400


# ── DELETE /sessions/{id}/cards/{id}/group ────────────────────────────────────


async def test_ungroup_card_clears_group_id(client: AsyncClient):
    session_id, _, cards = await _setup_discussing(client, n=2)
    card1, card2 = cards

    # Group them first
    await client.post(
        f"/api/v1/sessions/{session_id}/cards/{card1['id']}/group",
        json={"target_card_id": card2["id"]},
        headers={"X-Participant-Name": "Alice"},
    )

    # Ungroup card1
    r = await client.delete(
        f"/api/v1/sessions/{session_id}/cards/{card1['id']}/group",
        headers={"X-Participant-Name": "Alice"},
    )
    assert r.status_code == 204

    data = (await client.get(f"/api/v1/sessions/{session_id}")).json()
    c1 = next(c for c in data["cards"] if c["id"] == card1["id"])
    assert c1["group_id"] is None


async def test_ungroup_last_two_members_cleans_up_both(client: AsyncClient):
    session_id, _, cards = await _setup_discussing(client, n=2)
    card1, card2 = cards

    # Group them
    await client.post(
        f"/api/v1/sessions/{session_id}/cards/{card1['id']}/group",
        json={"target_card_id": card2["id"]},
        headers={"X-Participant-Name": "Alice"},
    )

    # Ungroup card1 — only card2 remains → singleton → card2 cleared too
    await client.delete(
        f"/api/v1/sessions/{session_id}/cards/{card1['id']}/group",
        headers={"X-Participant-Name": "Alice"},
    )

    data = (await client.get(f"/api/v1/sessions/{session_id}")).json()
    c2 = next(c for c in data["cards"] if c["id"] == card2["id"])
    assert c2["group_id"] is None


async def test_ungroup_from_three_member_group_leaves_others_intact(client: AsyncClient):
    session_id, _, cards = await _setup_discussing(client, n=3)
    card1, card2, card3 = cards

    # Group all three
    await client.post(
        f"/api/v1/sessions/{session_id}/cards/{card1['id']}/group",
        json={"target_card_id": card2["id"]},
        headers={"X-Participant-Name": "Alice"},
    )
    await client.post(
        f"/api/v1/sessions/{session_id}/cards/{card3['id']}/group",
        json={"target_card_id": card2["id"]},
        headers={"X-Participant-Name": "Carol"},
    )

    # Ungroup just card1 — card2 and card3 should still be grouped
    await client.delete(
        f"/api/v1/sessions/{session_id}/cards/{card1['id']}/group",
        headers={"X-Participant-Name": "Alice"},
    )

    data = (await client.get(f"/api/v1/sessions/{session_id}")).json()
    c1 = next(c for c in data["cards"] if c["id"] == card1["id"])
    c2 = next(c for c in data["cards"] if c["id"] == card2["id"])
    c3 = next(c for c in data["cards"] if c["id"] == card3["id"])

    assert c1["group_id"] is None
    assert c2["group_id"] is not None
    assert c3["group_id"] is not None
    assert c2["group_id"] == c3["group_id"]


async def test_ungroup_in_collecting_phase_returns_409(client: AsyncClient):
    session = await make_session(client)
    card = await _add_card(client, session.id, author="Alice", text="A")

    r = await client.delete(
        f"/api/v1/sessions/{session.id}/cards/{card['id']}/group",
        headers={"X-Participant-Name": "Alice"},
    )
    assert r.status_code == 409


async def test_ungroup_in_closed_phase_returns_409(client: AsyncClient):
    session_id, fac_token, cards = await _setup_discussing(client, n=2)
    card1, card2 = cards

    # Group then close
    await client.post(
        f"/api/v1/sessions/{session_id}/cards/{card1['id']}/group",
        json={"target_card_id": card2["id"]},
        headers={"X-Participant-Name": "Alice"},
    )
    await client.post(
        f"/api/v1/sessions/{session_id}/phase",
        json={"phase": "closed"},
        headers={"X-Facilitator-Token": fac_token},
    )

    r = await client.delete(
        f"/api/v1/sessions/{session_id}/cards/{card1['id']}/group",
        headers={"X-Participant-Name": "Alice"},
    )
    assert r.status_code == 409


async def test_ungroup_missing_session_returns_404(client: AsyncClient):
    r = await client.delete(
        "/api/v1/sessions/ghost/cards/card-1/group",
        headers={"X-Participant-Name": "Alice"},
    )
    assert r.status_code == 404


async def test_ungroup_missing_card_returns_404(client: AsyncClient):
    session_id, _, _ = await _setup_discussing(client, n=2)

    r = await client.delete(
        f"/api/v1/sessions/{session_id}/cards/nonexistent/group",
        headers={"X-Participant-Name": "Alice"},
    )
    assert r.status_code == 404


async def test_ungroup_missing_participant_name_returns_400(client: AsyncClient):
    session_id, _, cards = await _setup_discussing(client, n=2)
    card1, card2 = cards

    await client.post(
        f"/api/v1/sessions/{session_id}/cards/{card1['id']}/group",
        json={"target_card_id": card2["id"]},
        headers={"X-Participant-Name": "Alice"},
    )

    r = await client.delete(
        f"/api/v1/sessions/{session_id}/cards/{card1['id']}/group",
    )
    assert r.status_code == 400


async def test_group_response_contains_full_session(client: AsyncClient):
    session_id, _, cards = await _setup_discussing(client, n=2)
    card1, card2 = cards

    r = await client.post(
        f"/api/v1/sessions/{session_id}/cards/{card1['id']}/group",
        json={"target_card_id": card2["id"]},
        headers={"X-Participant-Name": "Alice"},
    )
    assert r.status_code == 200
    data = r.json()
    # Response is the public session object (no facilitator_token)
    assert "id" in data
    assert "cards" in data
    assert "facilitator_token" not in data


async def test_group_card_that_is_already_in_a_different_group(client: AsyncClient):
    """Moving a card from group A to group B should leave group A intact (if 2+ remain)."""
    session_id, _, cards = await _setup_discussing(client, n=4)
    c1, c2, c3, c4 = cards

    # Group A: c1+c2
    await client.post(
        f"/api/v1/sessions/{session_id}/cards/{c1['id']}/group",
        json={"target_card_id": c2["id"]},
        headers={"X-Participant-Name": "Alice"},
    )
    # Group B: c3+c4
    await client.post(
        f"/api/v1/sessions/{session_id}/cards/{c3['id']}/group",
        json={"target_card_id": c4["id"]},
        headers={"X-Participant-Name": "Carol"},
    )

    # Move c1 into group B
    await client.post(
        f"/api/v1/sessions/{session_id}/cards/{c1['id']}/group",
        json={"target_card_id": c3["id"]},
        headers={"X-Participant-Name": "Alice"},
    )

    data = (await client.get(f"/api/v1/sessions/{session_id}")).json()
    cards_by_id = {c["id"]: c for c in data["cards"]}

    # c1 is now in group B
    assert cards_by_id[c1["id"]]["group_id"] == cards_by_id[c3["id"]]["group_id"]
    # c2 was alone → should be None (singleton cleanup)
    assert cards_by_id[c2["id"]]["group_id"] is None
