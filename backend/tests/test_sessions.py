"""Session lifecycle specifications."""

from httpx import AsyncClient

from tests.conftest import make_session


async def test_creating_a_session_returns_facilitator_token(client: AsyncClient):
    response = await client.post(
        "/api/v1/sessions",
        json={"name": "Sprint 1", "participant_name": "Alice"},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["facilitator_token"]
    assert data["phase"] == "collecting"
    assert data["participants"][0]["name"] == "Alice"


async def test_facilitator_token_is_hidden_on_get(client: AsyncClient):
    session = await make_session(client)
    response = await client.get(f"/api/v1/sessions/{session.id}")
    assert response.status_code == 200
    assert "facilitator_token" not in response.json()


async def test_getting_unknown_session_returns_404(client: AsyncClient):
    response = await client.get("/api/v1/sessions/does-not-exist")
    assert response.status_code == 404


async def test_participant_can_join_an_existing_session(client: AsyncClient):
    session = await make_session(client, facilitator="Alice")
    response = await client.post(
        f"/api/v1/sessions/{session.id}/join",
        json={"participant_name": "Bob"},
    )
    assert response.status_code == 200
    names = [p["name"] for p in response.json()["participants"]]
    assert "Alice" in names
    assert "Bob" in names


async def test_joining_with_an_existing_name_is_idempotent(client: AsyncClient):
    session = await make_session(client, facilitator="Alice")
    await client.post(f"/api/v1/sessions/{session.id}/join", json={"participant_name": "Alice"})
    response = await client.get(f"/api/v1/sessions/{session.id}")
    assert len(response.json()["participants"]) == 1
