"""Move card to another column specifications."""

from httpx import AsyncClient

from tests.conftest import make_session


async def _setup(client: AsyncClient, *, author: str = "Alice") -> tuple[str, str, str]:
    """Create session and add a card in "Went Well". Returns (session_id, facilitator_token, card_id)."""
    session = await make_session(client)
    card = (
        await client.post(
            f"/api/v1/sessions/{session.id}/cards",
            json={"column": "Went Well", "text": "Smooth deploy", "author_name": author},
        )
    ).json()
    return session.id, session.facilitator_token, card["id"]


async def _set_phase(client: AsyncClient, session_id: str, token: str, phase: str) -> None:
    await client.post(
        f"/api/v1/sessions/{session_id}/phase",
        json={"phase": phase},
        headers={"X-Facilitator-Token": token},
    )


async def _move(client: AsyncClient, session_id: str, card_id: str, column: str, headers: dict):
    return await client.patch(
        f"/api/v1/sessions/{session_id}/cards/{card_id}/column",
        json={"column": column},
        headers=headers,
    )


async def test_author_can_move_their_card_to_another_column(client: AsyncClient):
    session_id, _, card_id = await _setup(client)
    response = await _move(client, session_id, card_id, "To Improve", {"X-Participant-Name": "Alice"})
    assert response.status_code == 200
    assert response.json()["column"] == "To Improve"
    session = (await client.get(f"/api/v1/sessions/{session_id}")).json()
    assert session["cards"][0]["column"] == "To Improve"


async def test_facilitator_can_move_any_card(client: AsyncClient):
    session_id, token, card_id = await _setup(client)
    response = await _move(client, session_id, card_id, "To Improve", {"X-Facilitator-Token": token})
    assert response.status_code == 200
    assert response.json()["column"] == "To Improve"


async def test_open_facilitator_participant_can_move_any_card(client: AsyncClient):
    session_id, token, card_id = await _setup(client)
    await client.patch(
        f"/api/v1/sessions/{session_id}",
        json={"open_facilitator": True},
        headers={"X-Facilitator-Token": token},
    )
    response = await _move(client, session_id, card_id, "To Improve", {"X-Participant-Name": "Bob"})
    assert response.status_code == 200


async def test_other_participant_cannot_move_a_card(client: AsyncClient):
    session_id, _, card_id = await _setup(client)
    response = await _move(client, session_id, card_id, "To Improve", {"X-Participant-Name": "Bob"})
    assert response.status_code == 403


async def test_move_keeps_votes_and_published_state(client: AsyncClient):
    session_id, token, card_id = await _setup(client)
    await _set_phase(client, session_id, token, "discussing")
    await client.post(
        f"/api/v1/sessions/{session_id}/cards/{card_id}/publish", headers={"X-Participant-Name": "Alice"}
    )
    await client.post(
        f"/api/v1/sessions/{session_id}/cards/{card_id}/votes", headers={"X-Participant-Name": "Bob"}
    )
    response = await _move(client, session_id, card_id, "To Improve", {"X-Participant-Name": "Alice"})
    card = response.json()
    assert card["published"] is True
    assert [v["participant_name"] for v in card["votes"]] == ["Bob"]


async def test_moved_card_lands_at_the_bottom_of_its_new_column(client: AsyncClient):
    session_id, _, card_id = await _setup(client)
    await client.post(
        f"/api/v1/sessions/{session_id}/cards",
        json={"column": "To Improve", "text": "Already here", "author_name": "Bob"},
    )
    await _move(client, session_id, card_id, "To Improve", {"X-Participant-Name": "Alice"})
    session = (await client.get(f"/api/v1/sessions/{session_id}")).json()
    assert [c["text"] for c in session["cards"] if c["column"] == "To Improve"] == [
        "Already here",
        "Smooth deploy",
    ]


async def test_move_to_unknown_column_returns_400(client: AsyncClient):
    session_id, _, card_id = await _setup(client)
    response = await _move(client, session_id, card_id, "Nope", {"X-Participant-Name": "Alice"})
    assert response.status_code == 400


async def test_move_in_closed_phase_returns_409(client: AsyncClient):
    session_id, token, card_id = await _setup(client)
    await _set_phase(client, session_id, token, "closed")
    response = await _move(client, session_id, card_id, "To Improve", {"X-Participant-Name": "Alice"})
    assert response.status_code == 409


async def test_move_grouped_card_returns_409(client: AsyncClient):
    session_id, token, card_id = await _setup(client)
    other = (
        await client.post(
            f"/api/v1/sessions/{session_id}/cards",
            json={"column": "Went Well", "text": "Fast CI", "author_name": "Alice"},
        )
    ).json()
    await _set_phase(client, session_id, token, "discussing")
    for cid in (card_id, other["id"]):
        await client.post(
            f"/api/v1/sessions/{session_id}/cards/{cid}/publish", headers={"X-Participant-Name": "Alice"}
        )
    await client.post(
        f"/api/v1/sessions/{session_id}/cards/{card_id}/group",
        json={"target_card_id": other["id"]},
        headers={"X-Participant-Name": "Alice"},
    )
    response = await _move(client, session_id, card_id, "To Improve", {"X-Participant-Name": "Alice"})
    assert response.status_code == 409


async def test_move_unknown_card_returns_404(client: AsyncClient):
    session_id, _, _ = await _setup(client)
    response = await _move(client, session_id, "no-such", "To Improve", {"X-Participant-Name": "Alice"})
    assert response.status_code == 404


async def test_move_unknown_session_returns_404(client: AsyncClient):
    response = await _move(client, "no-such", "no-such", "To Improve", {"X-Participant-Name": "Alice"})
    assert response.status_code == 404
