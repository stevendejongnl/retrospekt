"""Voting specifications."""

from httpx import AsyncClient

from tests.conftest import make_session


async def _session_with_card(client: AsyncClient) -> tuple[str, str, str]:
    """Returns (session_id, facilitator_token, card_id)."""
    session = await make_session(client)
    card_response = await client.post(
        f"/api/v1/sessions/{session.id}/cards",
        json={"column": "Went Well", "text": "CI is green", "author_name": "Alice"},
    )
    assert card_response.status_code == 201
    return session.id, session.facilitator_token, card_response.json()["id"]


async def test_participant_can_vote_on_a_card(client: AsyncClient):
    session_id, _, card_id = await _session_with_card(client)
    response = await client.post(
        f"/api/v1/sessions/{session_id}/cards/{card_id}/votes",
        headers={"X-Participant-Name": "Bob"},
    )
    assert response.status_code == 200
    assert len(response.json()["votes"]) == 1
    assert response.json()["votes"][0]["participant_name"] == "Bob"


async def test_voting_twice_is_idempotent(client: AsyncClient):
    session_id, _, card_id = await _session_with_card(client)
    for _ in range(2):
        await client.post(
            f"/api/v1/sessions/{session_id}/cards/{card_id}/votes",
            headers={"X-Participant-Name": "Bob"},
        )
    response = await client.get(f"/api/v1/sessions/{session_id}")
    card = next(c for c in response.json()["cards"] if c["id"] == card_id)
    assert len(card["votes"]) == 1


async def test_multiple_participants_can_vote_on_the_same_card(client: AsyncClient):
    session_id, _, card_id = await _session_with_card(client)
    for name in ("Bob", "Carol", "Dave"):
        await client.post(
            f"/api/v1/sessions/{session_id}/cards/{card_id}/votes",
            headers={"X-Participant-Name": name},
        )
    response = await client.get(f"/api/v1/sessions/{session_id}")
    card = next(c for c in response.json()["cards"] if c["id"] == card_id)
    assert len(card["votes"]) == 3


async def test_participant_can_remove_their_vote(client: AsyncClient):
    session_id, _, card_id = await _session_with_card(client)
    await client.post(
        f"/api/v1/sessions/{session_id}/cards/{card_id}/votes",
        headers={"X-Participant-Name": "Bob"},
    )
    response = await client.delete(
        f"/api/v1/sessions/{session_id}/cards/{card_id}/votes",
        headers={"X-Participant-Name": "Bob"},
    )
    assert response.status_code == 200
    assert response.json()["votes"] == []


async def test_removing_a_nonexistent_vote_is_a_no_op(client: AsyncClient):
    session_id, _, card_id = await _session_with_card(client)
    response = await client.delete(
        f"/api/v1/sessions/{session_id}/cards/{card_id}/votes",
        headers={"X-Participant-Name": "Nobody"},
    )
    assert response.status_code == 200
    assert response.json()["votes"] == []
