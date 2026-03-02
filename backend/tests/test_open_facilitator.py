"""Open Facilitator Mode — participants get full facilitator powers when open_facilitator=True."""

from httpx import AsyncClient

from tests.conftest import make_session


async def test_open_facilitator_defaults_to_false_on_new_session(client: AsyncClient):
    response = await client.post(
        "/api/v1/sessions",
        json={"name": "Sprint 1", "participant_name": "Alice"},
    )
    assert response.status_code == 201
    assert response.json()["open_facilitator"] is False


async def test_open_facilitator_included_in_public_session_data(client: AsyncClient):
    session = await make_session(client)
    response = await client.get(f"/api/v1/sessions/{session.id}")
    assert response.status_code == 200
    assert "open_facilitator" in response.json()


async def test_facilitator_can_enable_open_facilitator(client: AsyncClient):
    session = await make_session(client)
    response = await client.patch(
        f"/api/v1/sessions/{session.id}",
        json={"open_facilitator": True},
        headers={"X-Facilitator-Token": session.facilitator_token},
    )
    assert response.status_code == 200
    assert response.json()["open_facilitator"] is True


async def test_facilitator_can_disable_open_facilitator(client: AsyncClient):
    session = await make_session(client)
    await client.patch(
        f"/api/v1/sessions/{session.id}",
        json={"open_facilitator": True},
        headers={"X-Facilitator-Token": session.facilitator_token},
    )
    response = await client.patch(
        f"/api/v1/sessions/{session.id}",
        json={"open_facilitator": False},
        headers={"X-Facilitator-Token": session.facilitator_token},
    )
    assert response.status_code == 200
    assert response.json()["open_facilitator"] is False


async def test_participant_cannot_change_phase_when_open_facilitator_false(client: AsyncClient):
    session = await make_session(client)
    response = await client.post(
        f"/api/v1/sessions/{session.id}/phase",
        json={"phase": "discussing"},
        headers={"X-Participant-Name": "Bob"},
    )
    assert response.status_code == 403


async def test_participant_can_change_phase_when_open_facilitator_true(client: AsyncClient):
    session = await make_session(client)
    await client.patch(
        f"/api/v1/sessions/{session.id}",
        json={"open_facilitator": True},
        headers={"X-Facilitator-Token": session.facilitator_token},
    )
    response = await client.post(
        f"/api/v1/sessions/{session.id}/phase",
        json={"phase": "discussing"},
        headers={"X-Participant-Name": "Bob"},
    )
    assert response.status_code == 200


async def test_participant_can_add_column_when_open_facilitator_true(client: AsyncClient):
    session = await make_session(client)
    await client.patch(
        f"/api/v1/sessions/{session.id}",
        json={"open_facilitator": True},
        headers={"X-Facilitator-Token": session.facilitator_token},
    )
    response = await client.post(
        f"/api/v1/sessions/{session.id}/columns",
        json={"name": "New Column"},
        headers={"X-Participant-Name": "Bob"},
    )
    assert response.status_code == 201


async def test_participant_can_rename_column_when_open_facilitator_true(client: AsyncClient):
    session = await make_session(client)
    await client.patch(
        f"/api/v1/sessions/{session.id}",
        json={"open_facilitator": True},
        headers={"X-Facilitator-Token": session.facilitator_token},
    )
    response = await client.patch(
        f"/api/v1/sessions/{session.id}/columns/Went%20Well",
        json={"name": "Good Stuff"},
        headers={"X-Participant-Name": "Bob"},
    )
    assert response.status_code == 200


async def test_participant_can_delete_column_when_open_facilitator_true(client: AsyncClient):
    session = await make_session(client)
    await client.patch(
        f"/api/v1/sessions/{session.id}",
        json={"open_facilitator": True},
        headers={"X-Facilitator-Token": session.facilitator_token},
    )
    response = await client.delete(
        f"/api/v1/sessions/{session.id}/columns/Went%20Well",
        headers={"X-Participant-Name": "Bob"},
    )
    assert response.status_code == 204


async def test_participant_can_update_session_settings_when_open_facilitator_true(client: AsyncClient):
    session = await make_session(client)
    await client.patch(
        f"/api/v1/sessions/{session.id}",
        json={"open_facilitator": True},
        headers={"X-Facilitator-Token": session.facilitator_token},
    )
    response = await client.patch(
        f"/api/v1/sessions/{session.id}",
        json={"name": "New Name"},
        headers={"X-Participant-Name": "Bob"},
    )
    assert response.status_code == 200
    assert response.json()["name"] == "New Name"


async def test_participant_missing_name_header_gets_403_even_when_open_facilitator_true(
    client: AsyncClient,
):
    session = await make_session(client)
    await client.patch(
        f"/api/v1/sessions/{session.id}",
        json={"open_facilitator": True},
        headers={"X-Facilitator-Token": session.facilitator_token},
    )
    # No participant name header and no facilitator token
    response = await client.post(
        f"/api/v1/sessions/{session.id}/phase",
        json={"phase": "discussing"},
    )
    assert response.status_code == 403


async def test_actual_facilitator_still_works_when_open_facilitator_false(client: AsyncClient):
    session = await make_session(client)
    response = await client.post(
        f"/api/v1/sessions/{session.id}/phase",
        json={"phase": "discussing"},
        headers={"X-Facilitator-Token": session.facilitator_token},
    )
    assert response.status_code == 200


async def test_actual_facilitator_still_works_when_open_facilitator_true(client: AsyncClient):
    session = await make_session(client)
    await client.patch(
        f"/api/v1/sessions/{session.id}",
        json={"open_facilitator": True},
        headers={"X-Facilitator-Token": session.facilitator_token},
    )
    response = await client.post(
        f"/api/v1/sessions/{session.id}/phase",
        json={"phase": "discussing"},
        headers={"X-Facilitator-Token": session.facilitator_token},
    )
    assert response.status_code == 200


async def test_participant_can_control_timer_when_open_facilitator_true(client: AsyncClient):
    session = await make_session(client)
    await client.patch(
        f"/api/v1/sessions/{session.id}",
        json={"open_facilitator": True},
        headers={"X-Facilitator-Token": session.facilitator_token},
    )
    # Set timer duration first (as facilitator)
    await client.patch(
        f"/api/v1/sessions/{session.id}/timer",
        json={"duration_seconds": 300},
        headers={"X-Facilitator-Token": session.facilitator_token},
    )
    # Participant starts timer
    response = await client.post(
        f"/api/v1/sessions/{session.id}/timer/start",
        headers={"X-Participant-Name": "Bob"},
    )
    assert response.status_code == 200
