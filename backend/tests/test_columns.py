"""Column management endpoint specifications.

Facilitator-only endpoints, collecting-phase-gated:
  POST   /sessions/{id}/columns
  PATCH  /sessions/{id}/columns/{column_name}
  DELETE /sessions/{id}/columns/{column_name}
"""

from urllib.parse import quote

import pytest
from httpx import AsyncClient

from tests.conftest import make_session


# ── helpers ─────────────────────────────────────────────────────────────────


def col_url(session_id: str, name: str | None = None) -> str:
    base = f"/api/v1/sessions/{session_id}/columns"
    if name is None:
        return base
    return f"{base}/{quote(name, safe='')}"


# ── add column ───────────────────────────────────────────────────────────────


async def test_facilitator_can_add_column(client: AsyncClient):
    session = await make_session(client)
    response = await client.post(
        col_url(session.id),
        json={"name": "Kudos"},
        headers={"X-Facilitator-Token": session.facilitator_token},
    )
    assert response.status_code == 201
    data = response.json()
    assert "Kudos" in data["columns"]


async def test_add_column_appends_in_order(client: AsyncClient):
    session = await make_session(client)
    await client.post(
        col_url(session.id),
        json={"name": "First Extra"},
        headers={"X-Facilitator-Token": session.facilitator_token},
    )
    response = await client.post(
        col_url(session.id),
        json={"name": "Second Extra"},
        headers={"X-Facilitator-Token": session.facilitator_token},
    )
    columns = response.json()["columns"]
    assert columns[-2] == "First Extra"
    assert columns[-1] == "Second Extra"


async def test_add_duplicate_column_returns_409(client: AsyncClient):
    session = await make_session(client)
    response = await client.post(
        col_url(session.id),
        json={"name": "Went Well"},
        headers={"X-Facilitator-Token": session.facilitator_token},
    )
    assert response.status_code == 409


async def test_add_column_requires_facilitator_token(client: AsyncClient):
    session = await make_session(client)
    response = await client.post(col_url(session.id), json={"name": "Kudos"})
    assert response.status_code == 403


async def test_add_column_blocked_after_collecting(client: AsyncClient):
    session = await make_session(client)
    await client.post(
        f"/api/v1/sessions/{session.id}/phase",
        json={"phase": "discussing"},
        headers={"X-Facilitator-Token": session.facilitator_token},
    )
    response = await client.post(
        col_url(session.id),
        json={"name": "Kudos"},
        headers={"X-Facilitator-Token": session.facilitator_token},
    )
    assert response.status_code == 409


# ── rename column ────────────────────────────────────────────────────────────


async def test_facilitator_can_rename_column(client: AsyncClient):
    session = await make_session(client)
    response = await client.patch(
        col_url(session.id, "Went Well"),
        json={"name": "What Went Well"},
        headers={"X-Facilitator-Token": session.facilitator_token},
    )
    assert response.status_code == 200
    data = response.json()
    assert "What Went Well" in data["columns"]
    assert "Went Well" not in data["columns"]


async def test_rename_updates_card_column_references(client: AsyncClient):
    session = await make_session(client)
    # Add a card in "Went Well"
    await client.post(
        f"/api/v1/sessions/{session.id}/cards",
        json={"column": "Went Well", "text": "Great sprint", "author_name": "Alice"},
    )
    # Rename the column
    response = await client.patch(
        col_url(session.id, "Went Well"),
        json={"name": "Highlights"},
        headers={"X-Facilitator-Token": session.facilitator_token},
    )
    assert response.status_code == 200
    card_columns = [c["column"] for c in response.json()["cards"]]
    assert all(col == "Highlights" for col in card_columns)


async def test_rename_column_not_found_returns_404(client: AsyncClient):
    session = await make_session(client)
    response = await client.patch(
        col_url(session.id, "Nonexistent"),
        json={"name": "Whatever"},
        headers={"X-Facilitator-Token": session.facilitator_token},
    )
    assert response.status_code == 404


async def test_rename_to_existing_name_returns_409(client: AsyncClient):
    session = await make_session(client)
    response = await client.patch(
        col_url(session.id, "Went Well"),
        json={"name": "To Improve"},
        headers={"X-Facilitator-Token": session.facilitator_token},
    )
    assert response.status_code == 409


async def test_rename_column_requires_facilitator_token(client: AsyncClient):
    session = await make_session(client)
    response = await client.patch(col_url(session.id, "Went Well"), json={"name": "X"})
    assert response.status_code == 403


async def test_rename_column_blocked_after_collecting(client: AsyncClient):
    session = await make_session(client)
    await client.post(
        f"/api/v1/sessions/{session.id}/phase",
        json={"phase": "discussing"},
        headers={"X-Facilitator-Token": session.facilitator_token},
    )
    response = await client.patch(
        col_url(session.id, "Went Well"),
        json={"name": "Renamed"},
        headers={"X-Facilitator-Token": session.facilitator_token},
    )
    assert response.status_code == 409


# ── remove column ────────────────────────────────────────────────────────────


async def test_facilitator_can_remove_column(client: AsyncClient):
    session = await make_session(client)
    response = await client.delete(
        col_url(session.id, "Action Items"),
        headers={"X-Facilitator-Token": session.facilitator_token},
    )
    assert response.status_code == 204


async def test_remove_column_deletes_its_cards(client: AsyncClient):
    session = await make_session(client)
    # Add cards in two different columns
    await client.post(
        f"/api/v1/sessions/{session.id}/cards",
        json={"column": "Action Items", "text": "Do the thing", "author_name": "Alice"},
    )
    await client.post(
        f"/api/v1/sessions/{session.id}/cards",
        json={"column": "Went Well", "text": "Nice job", "author_name": "Alice"},
    )
    await client.delete(
        col_url(session.id, "Action Items"),
        headers={"X-Facilitator-Token": session.facilitator_token},
    )
    data = (await client.get(f"/api/v1/sessions/{session.id}")).json()
    assert all(c["column"] != "Action Items" for c in data["cards"])
    assert any(c["column"] == "Went Well" for c in data["cards"])


async def test_remove_column_not_found_returns_404(client: AsyncClient):
    session = await make_session(client)
    response = await client.delete(
        col_url(session.id, "Nonexistent"),
        headers={"X-Facilitator-Token": session.facilitator_token},
    )
    assert response.status_code == 404


async def test_remove_column_requires_facilitator_token(client: AsyncClient):
    session = await make_session(client)
    response = await client.delete(col_url(session.id, "Went Well"))
    assert response.status_code == 403


async def test_remove_column_blocked_after_collecting(client: AsyncClient):
    session = await make_session(client)
    await client.post(
        f"/api/v1/sessions/{session.id}/phase",
        json={"phase": "discussing"},
        headers={"X-Facilitator-Token": session.facilitator_token},
    )
    response = await client.delete(
        col_url(session.id, "Went Well"),
        headers={"X-Facilitator-Token": session.facilitator_token},
    )
    assert response.status_code == 409
