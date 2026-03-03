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


async def test_creating_a_session_with_custom_columns(client: AsyncClient):
    response = await client.post(
        "/api/v1/sessions",
        json={"name": "Custom", "participant_name": "Alice", "columns": ["Roses", "Thorns", "Buds"]},
    )
    assert response.status_code == 201
    assert response.json()["columns"] == ["Roses", "Thorns", "Buds"]


async def test_joining_unknown_session_returns_404(client: AsyncClient):
    response = await client.post(
        "/api/v1/sessions/no-such/join",
        json={"participant_name": "Bob"},
    )
    assert response.status_code == 404


async def test_creating_a_session_defaults_reactions_enabled_to_true(client: AsyncClient):
    response = await client.post(
        "/api/v1/sessions",
        json={"name": "Sprint 1", "participant_name": "Alice"},
    )
    assert response.status_code == 201
    assert response.json()["reactions_enabled"] is True


async def test_creating_a_session_with_reactions_disabled(client: AsyncClient):
    response = await client.post(
        "/api/v1/sessions",
        json={"name": "Sprint 1", "participant_name": "Alice", "reactions_enabled": False},
    )
    assert response.status_code == 201
    assert response.json()["reactions_enabled"] is False


async def test_creating_a_session_defaults_open_facilitator_to_false(client: AsyncClient):
    response = await client.post(
        "/api/v1/sessions",
        json={"name": "Sprint 1", "participant_name": "Alice"},
    )
    assert response.status_code == 201
    assert response.json()["open_facilitator"] is False


async def test_creating_a_session_with_open_facilitator_enabled(client: AsyncClient):
    response = await client.post(
        "/api/v1/sessions",
        json={"name": "Sprint 1", "participant_name": "Alice", "open_facilitator": True},
    )
    assert response.status_code == 201
    assert response.json()["open_facilitator"] is True


# ── PATCH /sessions/{id} ──────────────────────────────────────────────────────

async def test_patch_session_renames_it(client: AsyncClient):
    session = await make_session(client)
    response = await client.patch(
        f"/api/v1/sessions/{session.id}",
        json={"name": "Renamed Retro"},
        headers={"X-Facilitator-Token": session.facilitator_token},
    )
    assert response.status_code == 200
    assert response.json()["name"] == "Renamed Retro"


async def test_patch_session_toggles_reactions_enabled(client: AsyncClient):
    session = await make_session(client)
    response = await client.patch(
        f"/api/v1/sessions/{session.id}",
        json={"reactions_enabled": False},
        headers={"X-Facilitator-Token": session.facilitator_token},
    )
    assert response.status_code == 200
    assert response.json()["reactions_enabled"] is False


async def test_patch_session_with_no_fields_is_a_no_op(client: AsyncClient):
    session = await make_session(client)
    response = await client.patch(
        f"/api/v1/sessions/{session.id}",
        json={},
        headers={"X-Facilitator-Token": session.facilitator_token},
    )
    assert response.status_code == 200
    assert response.json()["name"] == session.name


async def test_patch_session_with_wrong_token_returns_403(client: AsyncClient):
    session = await make_session(client)
    response = await client.patch(
        f"/api/v1/sessions/{session.id}",
        json={"name": "Hacked"},
        headers={"X-Facilitator-Token": "wrong-token"},
    )
    assert response.status_code == 403
