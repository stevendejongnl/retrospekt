"""Phase transition specifications.

Also serves as a regression test for the 422 bug where Content-Type was
dropped when custom headers were passed alongside a JSON body.
"""

from httpx import AsyncClient

from tests.conftest import make_session


async def test_facilitator_can_advance_phase_to_discussing(client: AsyncClient):
    session = await make_session(client)
    response = await client.post(
        f"/api/v1/sessions/{session.id}/phase",
        json={"phase": "discussing"},
        headers={"X-Facilitator-Token": session.facilitator_token},
    )
    assert response.status_code == 200
    assert response.json()["phase"] == "discussing"


async def test_facilitator_can_close_a_session(client: AsyncClient):
    session = await make_session(client)
    response = await client.post(
        f"/api/v1/sessions/{session.id}/phase",
        json={"phase": "closed"},
        headers={"X-Facilitator-Token": session.facilitator_token},
    )
    assert response.status_code == 200
    assert response.json()["phase"] == "closed"


async def test_phase_change_requires_facilitator_token(client: AsyncClient):
    session = await make_session(client)
    response = await client.post(
        f"/api/v1/sessions/{session.id}/phase",
        json={"phase": "discussing"},
    )
    assert response.status_code == 403


async def test_wrong_facilitator_token_is_rejected(client: AsyncClient):
    session = await make_session(client)
    response = await client.post(
        f"/api/v1/sessions/{session.id}/phase",
        json={"phase": "discussing"},
        headers={"X-Facilitator-Token": "not-the-right-token"},
    )
    assert response.status_code == 403


async def test_invalid_phase_value_returns_400(client: AsyncClient):
    session = await make_session(client)
    response = await client.post(
        f"/api/v1/sessions/{session.id}/phase",
        json={"phase": "brainstorming"},
        headers={"X-Facilitator-Token": session.facilitator_token},
    )
    assert response.status_code == 400


async def test_phase_change_unknown_session_returns_404(client: AsyncClient):
    response = await client.post(
        "/api/v1/sessions/no-such/phase",
        json={"phase": "discussing"},
        headers={"X-Facilitator-Token": "any"},
    )
    assert response.status_code == 404
